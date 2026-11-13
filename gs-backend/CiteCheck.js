// ============================================================
// [2026.10.30] 근거 대조 도구 — 넥스 보고서·자문 장부 근거의 조문·판례·심판례가 실제로 있는지 원문과 맞대어 본다(GAS, 0원)
// ------------------------------------------------------------
// 세무사님 원문(10-30): "4번 시험사건에 내가 일일이 그런 걸 확인할 시간이 없다" — 넥스 보고서 속 세법 근거를 세무사님이 대조하실 수 없다.
//   / 계획서(총괄관리자\넥스_근거확인_계획서_20261030.md) "권하는 안대로": 반박은 넥스 스스로, ❌가 남으면 넥스에게 돌려 고치게 하고
//   그래도 남으면 ❌ 표시한 채 저장·알림.
// 실측(10-30): 국가법령정보센터 번호 찾기로 대법원 판례·조세심판원 결정은 찾아진다(밤샘 넥스 인용 6건 모두 실재). 국세청 예규(서면·사전·재산세과 등)는
//   그곳에 없어 자동 확인 못 함 → ❓로 정직하게 표시(국세법령정보시스템에서 확인).
// 같은 도구를 세무사님 화면(📒 ⑥ 자문 🔎 근거 확인)·넥스(case_ledger do=check_refs)·넥스 보고서 저장(자동)이 함께 쓴다.
// ============================================================
var CITE_TABLE_MARK_ = '## 근거 확인표 (GAS 자동 대조';
var CITE_REMOTE_MAX_ = 20;   // 판례·심판례 번호 찾기 한도(한 번 확인에) — 넘으면 ❓
var CITE_STATUTE_MAX_ = 40;  // 조문 한도
var CITE_COURT_ = '구합|구단|가합|가단|고합|고단|재두|두|누|다|도|후|허|므|스|나|노|부|마|카합|카단|구';
var CITE_NTS_RE_ = /(서면|사전|기준|법규|질의)\s*-?\s*(?:\d{4})\s*-\s*[가-힣]+(?:\s*-\s*[가-힣]+)?\s*-\s*\d+|(서면\s*\d\s*팀|재산세과|재산세제과|부동산납세과|소득세과|소득세제과|법인세과|재산세팀|조세법령운용과|징세과|자본거래관리과|소득세관리과|재산세국)\s*-\s*\d+/g;

// 글에서 인용을 뽑는다 → [{ 종류: 조문|판례|심판례|헌재|예규, 근거(보이는 이름), q(찾을 말), key/jo/hang(조문) }]
function citeExtract_(text) {
  const src = String(text || ''), out = [], seen = {};
  const add = function (o, k) { if (seen[k]) return; seen[k] = 1; out.push(o); };
  src.split('\n').forEach(function (line) {
    if (typeof sysAuditCitations_ === 'function') {
      try {
        sysAuditCitations_(line).forEach(function (c) { add({ 종류: '조문', 근거: c.label, key: c.key, jo: c.jo, hang: c.hang }, 'S|' + c.key + '|' + c.jo + '|' + c.hang); });
      } catch (e) { }
    }
  });
  let rest = src, m;
  // 조세심판원(조심·국심) — 판례 무늬보다 먼저(같은 글자를 판례로 또 잡지 않게 지운다)
  const tRe = /(조심|국심)\s*(\d{4})\s*([가-힣])\s*(\d{1,5})/g;
  while ((m = tRe.exec(src))) add({ 종류: '심판례', 근거: m[1] + ' ' + m[2] + m[3] + m[4], q: m[1] + m[2] + m[3] + m[4], cat: 'tax_tribunal', no: m[2] + m[3] + m[4] }, 'T|' + m[1] + m[2] + m[3] + m[4]);
  rest = rest.replace(tRe, ' ');
  const hRe = /(\d{4})\s*헌\s*([가-힣]{1,2})\s*(\d{1,5})/g;
  while ((m = hRe.exec(rest))) add({ 종류: '헌재', 근거: m[1] + '헌' + m[2] + m[3], q: m[1] + '헌' + m[2] + m[3], cat: 'constitutional', no: m[1] + '헌' + m[2] + m[3] }, 'H|' + m[1] + m[2] + m[3]);
  rest = rest.replace(hRe, ' ');
  const nRe = new RegExp(CITE_NTS_RE_.source, 'g');
  while ((m = nRe.exec(rest))) { const t = m[0].replace(/\s+/g, ''); add({ 종류: '예규', 근거: t }, 'N|' + t); }
  rest = rest.replace(nRe, ' ');
  const pRe = new RegExp('(?:^|[^\\d-])((?:19|20)\\d{2})\\s*-?\\s*(' + CITE_COURT_ + ')\\s*-?\\s*(\\d{2,6})(?!\\d)', 'g');
  while ((m = pRe.exec(rest))) add({ 종류: '판례', 근거: m[1] + m[2] + m[3], q: m[1] + m[2] + m[3], cat: 'precedent', no: m[1] + m[2] + m[3] }, 'P|' + m[1] + m[2] + m[3]);
  return out;
}

// 조문 한 줄 확인 — 정비본(사건 기준일 판)에 그 조·항이 있는지
function citeCheckStatute_(it, base) {
  let r = null;
  try { r = toolLookupStatuteArticle(it.key, it.jo, base); } catch (e) { return { 표시: '❓', 결과: '조문을 읽지 못함(' + String(e && e.message || e).slice(0, 60) + ')' }; }
  if (!r) return { 표시: '❓', 결과: '조문을 읽지 못함' };
  if (r.error) return /찾을 수 없습니다/.test(r.error) ? { 표시: '❌', 결과: '그 조문이 없음(' + (base ? base.slice(0, 4) + '-' + base.slice(4, 6) + '-' + base.slice(6, 8) + ' 시행판' : '현행판') + ')' } : { 표시: '❓', 결과: String(r.error).slice(0, 80) };
  const u = (r.조문 || [])[0] || {};
  const 판 = r.시행일자 ? String(r.시행일자).replace(/\D/g, '').replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3') + ' 시행판' : '';
  if (/^\s*삭제/.test(String(u.조문내용 || '')) || /^제\s*\d+\s*조(의\s*\d+)?\s*삭제/.test(String(u.조문내용 || ''))) return { 표시: '⚠', 결과: '삭제된 조(' + 판 + ') — 옛 시기 사건이면 시점을 밝혀 쓸 것' };
  if (it.hang) {
    const hs = u.항 || [];
    const num = function (h) { const mm = String(h.항내용 || '').match(/^\s*(?:([①-⑳])|<(\d+)>)/); return !mm ? 0 : mm[1] ? mm[1].charCodeAt(0) - 0x2460 + 1 : +mm[2]; };
    const last = hs.length ? Math.max.apply(null, hs.map(num).concat([0])) : 0;
    if (!hs.length || (last && it.hang > last)) return { 표시: '❌', 결과: '그 항이 없음 — 이 조는 ' + (hs.length ? last + '항까지' : '항이 나뉘지 않음') + '(' + 판 + ')' };
  }
  return { 표시: '✅', 결과: (u.조문제목 ? '「' + String(u.조문제목).slice(0, 30) + '」 ' : '') + 판 };
}

// 판례·심판례·헌재 한 줄 확인 — 국가법령정보센터 번호 찾기 + 결론(주문)
function citeCheckCase_(it, budget) {
  const ck = 'cite2|' + it.cat + '|' + it.no, cache = CacheService.getScriptCache();
  try { const hit = cache.get(ck); if (hit) return JSON.parse(hit); } catch (e) { }
  if (budget.left <= 0) return { 표시: '❓', 결과: '한 번에 확인하는 한도(' + CITE_REMOTE_MAX_ + '건)를 넘어 확인 못 함 — 다시 확인을 누르면 이어서' };
  budget.left--;
  const r = toolSearchTaxPrecedent(it.cat, it.q);
  if (!r || r.error) return { 표시: '❓', 결과: '찾기 실패(' + String((r && r.error) || '').slice(0, 60) + ')' };
  const norm = function (s) { return String(s || '').replace(/조세심판원|대법원|[\s\-.]/g, ''); };
  const want = norm(it.no);
  const hit = (r.results || []).filter(function (x) { const n = norm(x.청구번호 || x.사건번호 || ''); return n.indexOf(want) >= 0 || (want.length > 6 && n.slice(-want.length) === want); })[0];
  let out;
  if (!hit) out = { 표시: '❌', 결과: '국가법령정보센터에서 이 번호를 찾지 못함 — 지어낸 번호일 수 있다. 원문을 확인하기 전엔 근거로 쓰지 말 것' };
  else {
    const name = String(hit.사건명 || '').slice(0, 70), day = hit.의결일자 || hit.선고일자 || hit.종국일자 || '';
    let 결론 = '';
    if (budget.left > 0) {
      budget.left--;
      try {
        const d = toolGetTaxPrecedentDetail(it.cat, hit.id) || {};
        const body = String(d.주문 || '') || (String(d.판례내용 || '').match(/주\s*문\s*】?([\s\S]{0,240})/) || [])[1] || String(d.결정요지 || '').slice(0, 200);
        const t = String(body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        결론 = /파기/.test(t) ? '파기' : /각하/.test(t) ? '각하' : /(경정|취소)한다|취소하고|경정하고/.test(t) ? '인용(경정·취소)' : /기각/.test(t) ? '기각' : /인용/.test(t) ? '인용' : (t ? t.slice(0, 40) : '');
      } catch (e) { 결론 = ''; }
    }
    out = { 표시: '✅', 결과: (day ? day + ' ' : '') + name, 결론: 결론 || '주문 못 읽음 — 원문 확인' };
  }
  try { cache.put(ck, JSON.stringify(out), 21600); } catch (e) { }
  return out;
}

// 글 하나를 확인 → { at, 기준일, items:[{표시, 종류, 근거, 결과, 결론?}], 수:{ok,bad,warn,unk} }
function citeCheck_(c, text) {
  const base = String((c && c.기준일) || '').replace(/\D/g, '').slice(0, 8) || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
  const list = citeExtract_(text), budget = { left: CITE_REMOTE_MAX_ }, items = [];
  let ns = 0;
  list.forEach(function (it) {
    let r;
    if (it.종류 === '조문') { ns++; r = ns > CITE_STATUTE_MAX_ ? { 표시: '❓', 결과: '조문 확인 한도(' + CITE_STATUTE_MAX_ + '개)를 넘어 확인 못 함' } : citeCheckStatute_(it, base); }
    else if (it.종류 === '예규') r = { 표시: '❓', 결과: '국세청 예규는 국가법령정보센터에 없어 자동 확인 못 함 — 국세법령정보시스템(taxlaw.nts.go.kr)에서 확인' };
    else r = citeCheckCase_(it, budget);
    items.push(Object.assign({ 종류: it.종류, 근거: it.근거 }, r));
  });
  const 수 = { ok: 0, bad: 0, warn: 0, unk: 0 };
  items.forEach(function (x) { if (x.표시 === '✅') 수.ok++; else if (x.표시 === '❌') 수.bad++; else if (x.표시 === '⚠') 수.warn++; else 수.unk++; });
  return { at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 기준일: base, items: items, 수: 수 };
}

// [2026.11.04 전용택 사건 — 암산 검문] 넥스 보고서 속 세액 숫자가 이 사건의 계산 저장본(세액계산결과)에 실제로 있는 숫자인지 대조한다(GAS, 0원).
//  사연: 넥스가 엔진을 한 번도 안 돌리고 암산한 표를 "최종 계산기 실행값"이라 적어 저장했는데, 근거 확인은 조문·판례만 봐서 ✅5로 통과했다.
//  규칙: 세액·과세표준·공제 같은 낱말이 있는 줄의 100만 원 이상 숫자는 모두 저장본(최종세액·저장값 result·입력)에 있어야 한다. 없으면 ❌로 돌려주고 장부에 남긴다.
var CITE_TAX_LINE_RE_ = /세액|과세표준|납부|산출|공제|감면|양도차익|지방소득세|가산세|환급/;
function citeTaxFigures_(c, text) {
  const pool = {};
  const walk = function (v, depth) {
    if (v == null || depth > 6) return;
    if (typeof v === 'number') { if (isFinite(v) && Math.abs(v) >= 1000000) pool[String(Math.round(Math.abs(v)))] = 1; return; }
    if (typeof v === 'string') { (v.match(/\d[\d,]{6,}/g) || []).forEach(function (s) { const n = Number(s.replace(/,/g, '')); if (isFinite(n) && n >= 1000000) pool[String(n)] = 1; }); return; }
    if (Array.isArray(v)) { v.forEach(function (x) { walk(x, depth + 1); }); return; }
    if (typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k], depth + 1); });
  };
  const list = Array.isArray(c && c.세액계산결과) ? c.세액계산결과 : [];
  list.forEach(function (e) { walk(e, 0); });
  const found = [], missing = [], seen = {};
  let factSec = false; // [2026.11.13 5차 아] 「사실관계·확인된 사실·서류·증빙」 절 안의 숫자는 서류에서 읽은 값이지 이 사건 세액이 아니다
  String(text || '').split('\n').forEach(function (line) {
    const hm = /^\s*#{1,6}\s*(.+)$/.exec(line); if (hm) { factSec = /사실|서류|증빙|자료|현황|경위|개요/.test(hm[1]) && !/세액|계산|결론|비교|안/.test(hm[1]); return; }
    if (!CITE_TAX_LINE_RE_.test(line)) return;
    if (factSec) return;
    if (/^\s*(\||-|\*)?\s*(양도가액|취득가액|보상|면적|지분|㎡|단가)/.test(line)) return; // 가액·면적 줄은 세액이 아님(입력값은 서류 숫자)
    // [2026.11.13 5차 아] 다른 세금(취득세·등록세·재산세·종부세)의 과세표준·납부액, 서류 이름이 붙은 줄은 이 사건 계산 저장본과 대조하지 않는다(실사건 자문 11-12: 취득세 과세표준을 세액으로 오인해 ❌)
    if (/취득세|등록\s*세|등록면허세|재산세|종합부동산세|종부세|공시|기준시가|신고서상|납부확인서|영수증|고지서/.test(line) && !/양도소득세\s*(산출|결정|납부|액)|증여세\s*(산출|결정|납부|액)|상속세\s*(산출|결정|납부|액)|산출세액|결정세액|납부할\s*세액/.test(line)) return;
    (line.match(/\d{1,3}(?:,\d{3}){2,}|\d{7,}/g) || []).forEach(function (s) {
      const n = Number(s.replace(/,/g, '')); if (!isFinite(n) || n < 1000000 || seen[n]) return; seen[n] = 1;
      if (pool[String(n)]) found.push(s); else missing.push(s);
    });
  });
  return { 저장본수: list.length, 있음: found, 없음: missing, 수: { ok: found.length, bad: missing.length } };
}
function citeTaxNote_(tf) {
  if (!tf) return '';
  if (!tf.있음.length && !tf.없음.length) return '';
  if (!tf.없음.length) return '\n[세액 대조 — GAS 자동] 보고서의 세액 숫자 ' + tf.있음.length + '개가 모두 이 사건 계산 저장본에 있음 ✅';
  return '\n[세액 대조 — GAS 자동] ❌ 보고서의 세액 숫자 ' + tf.없음.length + '개가 이 사건의 어느 계산 저장본에도 없음(' + (tf.저장본수 ? '저장본 ' + tf.저장본수 + '개와 대조' : '이 사건엔 계산 저장본이 하나도 없음') + '): ' + tf.없음.slice(0, 12).join(', ')
    + ' — 이 숫자는 계산 도구를 돌린 값이 아니므로 보고서에 둘 수 없다. 지금 바로 calculate_*·case_ledger do=calc·calc_scenario로 계산해 저장본 숫자로 바꿔 다시 저장하고, 저장본 id를 보고서에 적어라. 계산 도구를 못 부르면 숫자를 지우고 "세액은 계산 도구로 아직 못 냈다"고 적어라. 사용자에게 이 ❌를 숨기지 말고 그대로 말하라.';
}

function citeSummary_(res) {
  if (!res || !res.items) return '';
  const s = res.수;
  return '✅' + s.ok + ' ❌' + s.bad + (s.warn ? ' ⚠' + s.warn : '') + ' ❓' + s.unk;
}

// [2026.10.30] 넥스 글 끝에 표를 붙이던 citeTableMd_는 뺐다(GAS는 넥스 글을 바꾸지 않음). 예전에 붙어 저장된 표는 대조할 때 떼고 본다.
function citeStripTable_(text) {
  const s = String(text || ''), i = s.indexOf(CITE_TABLE_MARK_);
  if (i < 0) return s;
  return s.slice(0, i).replace(/\n*-{3,}\s*\n*$/, '').replace(/\s+$/, '') + '\n';
}

// 장부 요약에 싣는 목록 — 화면(full)은 전부, 넥스 요약은 ✅가 아니거나 결론이 붙은 것만(토큰 절약)
function citeBriefList_(items, full) {
  const a = Array.isArray(items) ? items : [];
  return full ? a : a.filter(function (x) { return x && (x.표시 !== '✅' || x.결론); }).slice(0, 20);
}

// 넥스에게 돌려줄 한 덩이 — ❌는 고쳐 다시 저장, 판례 결론 방향 대조·반박 절은 넥스 몫
function citeNexNote_(res) {
  if (!res || !res.items) return '';
  if (!res.items.length) return '\n[근거 확인 — GAS 자동] 이 글에서 조문·판례·심판례 번호를 찾지 못함(인용 없음).';
  const bad = res.items.filter(function (x) { return x.표시 === '❌'; }), warn = res.items.filter(function (x) { return x.표시 === '⚠'; });
  const cases = res.items.filter(function (x) { return x.결론; });
  return '\n[근거 확인 — GAS 자동 대조, 글은 넥스가 쓴 그대로 저장됨·결과는 장부 보고서 칸에] ' + citeSummary_(res)
    + (bad.length ? '\n❌ 없는 근거 ' + bad.length + '개: ' + bad.map(function (x) { return x.근거 + '(' + x.결과 + ')'; }).join(' / ').slice(0, 900) + ' — law_lookup·law_search로 다시 찾아 맞는 근거로 고치거나 빼고, 같은 이름으로 다시 저장하라. 다시 저장해도 ❌가 남으면 장부에 ❌로 남는다 — 그때는 세무사님께 채팅으로 그 근거를 그대로 알려라.' : '')
    + (warn.length ? '\n⚠ ' + warn.map(function (x) { return x.근거 + '(' + x.결과 + ')'; }).join(' / ').slice(0, 400) : '')
    + (cases.length ? '\n판례·심판례 결론: ' + cases.map(function (x) { return x.근거 + ' ' + x.결론; }).join(' / ').slice(0, 600) + ' — 각 결론이 보고서 주장 방향과 맞는지 보고, 반대 결론을 유리한 근거처럼 쓴 곳은 고쳐라.' : '');
}

// 장부 보고서 칸에 확인 결과를 남긴다(세무사님 화면 📒 ⑥ 자문에 보임)
function citeLedgerMark_(c, advId, res) {
  if (!c || !advId || !res || !res.items) return;
  try {
    ledgerMutate_(c.id, function (L) {
      const list = (L.adv && L.adv.reports) || [], it = list.filter(function (x) { return x && x.id === advId; })[0];
      if (!it) return { ok: false };
      it.cite = { at: res.at, 수: res.수, bad: res.items.filter(function (x) { return x.표시 === '❌'; }).map(function (x) { return x.근거 + ' — ' + x.결과; }).slice(0, 20), items: res.items.slice(0, 60) };
      if (res.tax) it.taxCite = { at: res.at, 수: res.tax.수, 없음: res.tax.없음.slice(0, 20), 있음: res.tax.있음.slice(0, 20) }; // [2026.11.04] 세액 숫자 대조(저장본에 없는 세액)
      ledgerLogTo_(L, { by: 'GAS', what: '근거 확인', path: 'adv:' + it.id, detail: (it.title || '') + ' ' + citeSummary_(res) + (res.tax && res.tax.없음.length ? ' · ❌ 저장본에 없는 세액 ' + res.tax.없음.length + '개(' + res.tax.없음.slice(0, 4).join(', ') + ')' : (res.tax && res.tax.있음.length ? ' · 세액 ' + res.tax.있음.length + '개 저장본과 같음' : '')) });
      return { ok: true };
    });
  } catch (e) { }
}

// 📒 ⑥ 자문 🔎 근거 확인 · 넥스 case_ledger do=check_refs — 장부의 보고서 파일과 근거 항목을 모두 다시 대조
function ledgerCiteRun_(c, body, who) {
  body = body || {};
  const lists = ledgerAdvList_(ledgerLoad_(c.id)), done = [];
  // 글 하나만 주면(넥스가 저장 전 초안 확인) 그 글만
  if (body.text) { const r0 = citeCheck_(c, citeStripTable_(body.text)); return { ok: true, 확인: citeSummary_(r0), 목록: r0.items, message: '근거 확인 ' + citeSummary_(r0) }; }
  (lists.보고서 || []).forEach(function (rp) {
    if (!rp.file) return;
    let txt = '';
    try { txt = DriveApp.getFileById(rp.file).getBlob().getDataAsString('UTF-8'); } catch (e) { done.push({ 항목: rp.title, 오류: '파일을 읽지 못함(id 아님이거나 지워짐)' }); return; }
    const res = citeCheck_(c, citeStripTable_(txt));
    citeLedgerMark_(c, rp.id, res);
    done.push({ 항목: '보고서 ' + rp.title, 확인: citeSummary_(res), 없음: res.items.filter(function (x) { return x.표시 === '❌'; }).map(function (x) { return x.근거; }) });
  });
  const refs = (lists.근거 || []).map(function (g) { return [g.title, g.text || '', (g.refs || []).join(' ')].join(' '); }).join('\n');
  if (refs.trim()) {
    const rr = citeCheck_(c, refs);
    try {
      ledgerMutate_(c.id, function (L) { L.adv = L.adv || {}; L.adv.basisCite = { at: rr.at, 수: rr.수, items: rr.items.slice(0, 60) }; ledgerLogTo_(L, { by: String(who || '세무사님').slice(0, 6), what: '근거 확인', path: 'adv:basis', detail: '근거 칸 ' + citeSummary_(rr) }); return { ok: true }; });
    } catch (e) { }
    done.push({ 항목: '근거 칸 ' + (lists.근거 || []).length + '개', 확인: citeSummary_(rr), 없음: rr.items.filter(function (x) { return x.표시 === '❌'; }).map(function (x) { return x.근거; }) });
  }
  if (!done.length) return { ok: true, 결과: [], message: '확인할 보고서·근거 항목이 아직 없습니다.' };
  return { ok: true, 결과: done, message: '근거 확인 — ' + done.map(function (d) { return d.항목 + ' ' + (d.확인 || d.오류); }).join(' / ') };
}
