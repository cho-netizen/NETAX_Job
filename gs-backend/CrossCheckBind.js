// =========================================================
// [2026.10.18 교차검증 2번 — 핵심] 사실 전체 맞대기. 질문 후보만이 아니라, 계산기 칸마다 그 칸에 해당하는 "모든 서류의 값"을 열쇠로 모아(cxBind_)
//  객관 규칙(독립 서류 2개 이상 일치 · 계약금+중도금+잔금 = 매매대금 검산 · 소득세법 §98 양도·취득시기)으로 판정하고(cxJudgeField_),
//  지금 계산기에 들어간 값이 다른 서류들과 어긋나는데 아무도 묻지 않는 곳을 찾아낸다(cxBindCheck_ — CrossCheck.js cxResolve0_가 부름).
//  파일 순서·최신·고정 서류 우선순위는 쓰지 않는다. 같은 서류의 사본(같은 서류 종류·같은 값)은 근거 하나로 센다.
//  양도·취득 계약의 구분은 당사자 이름(판독이 흔들림) 대신 날짜로 — 계약 날짜가 계산기 양도일에 가까우면 양도 쪽, 취득일에 가까우면 취득 쪽.
//  사실은 1번 세션 cpFacts_(maps/사실종류_낱말표.md 모양). 공통 뽑기(규칙 없는 글자, conf 불확실) 값은 검산·판정에 쓰지 않는다.
// =========================================================
// 칸이 바뀌면 다시 볼 판단 — 바뀐 칸이 있으면 처리 줄에 적고 처리개요를 다시 돌린다(r.loop.again → 사이드바가 증빙·처리개요 재실행, 계산기가 다시 판정)
const CX_DEPS_ = {
  acquisitionDate: ['보유기간', '장기보유특별공제율', '단기 세율(1·2년)', '1세대1주택 2년 요건', '증여 이월과세 10년', '취득당시 기준시가(환산)', '거주연수'],
  acquisitionPrice: ['양도차익', '환산취득가액 여부', '필요경비 갈래(실가 ↔ 개산공제)', '이월과세 비교'],
  totalPrice: ['양도차익', '필지·지분 안분', '고가주택 12억 판정', '부당행위(시가 비교)'],
  date: ['사건 기준일·신고기한', '보유기간', '양도당시 기준시가 연도', '1세대1주택 판정 시점'],
  base: ['신고기한', '평가기준일(시가 기간·공시가격 연도)', '10년(5년) 합산 기간', '상속인·수증자 확정 시점']
};
function cxBindCheckGI_(cc, r, facts, rec, applyOne) {
  const fields = cxBindGI_(cc, facts), sv = caseProcLoad_(cc.id) || {}, fb = (sv.filled || {}).기준일;
  const B = rec.bind = { fields: fields.length, withVals: 0, agree: 0, filled: [], mismatch: [], open: [], changed: [] };
  fields.forEach(function (fd) {
    if (!fd.vals.length) return;
    B.withVals++;
    const j = cxJudgeField_(fd.vals), cur = cxNormV_(fd.cur, 'date');
    if ((j.d != null && cur && cxNormV_(j.d, 'date') === cur) || (j.d == null && cur && j.vals.every(function (e) { return cxNormV_(e.v, 'date') === cur; }))) { B.agree++; return; }
    const byUser = fb && fb.v === fd.cur && !/^증빙/.test(String(fb.src || ''));
    const asking = r.items.some(function (it) { return it.ask && (it.ask.mode === 'base' || it.ask.target === 'base') && (it.ask.cands || []).length >= 2; });
    const iid = 'cxb:base:' + cxHash_(JSON.stringify(j.vals.map(function (e) { return e.v; })) + '|' + cur);
    const cands = j.vals.slice().sort(function (x, y) { return (y.law - x.law) || (y.ndoc - x.ndoc); }).map(function (e) { return { v: String(e.v), src: e.srcs.slice(0, 3).join(' / ') + (e.law ? ' — 법령 정의' : '') + (e.ndoc >= 2 ? ' — 서류 ' + e.ndoc + '종 일치' : '') }; });
    if (!cur && j.d != null && !asking) {
      if (applyOne({ iid: iid, target: 'base', label: fd.label, input: 'date', cands: cands, kind: '빈칸' }, String(j.d), '교차검증(' + j.rule + '): ' + j.why, 'gas', { why: j.why, rule: j.rule })) { B.filled.push(fd.label + ' ← ' + j.d + '(' + j.rule + ')'); B.changed.push('base'); rec.gas.push({ iid: iid, label: fd.label, v: j.d, rule: j.rule }); }
      return;
    }
    if (!cur && asking) { (B.asking = B.asking || []).push(fd.label); return; }
    if (cur && !cands.some(function (x) { return cxNormV_(x.v, 'date') === cur; })) cands.push({ v: fd.cur, src: '지금 사건 기준일 — ' + String((fb && fb.src) || '작업관리').slice(0, 100) });
    const note = j.d != null ? '교차검증 판정: ' + j.d + '(' + j.rule + ' — ' + j.why + ')' : j.why;
    (j.d != null ? B.mismatch : B.open).push(fd.label + ' 지금 ' + (fd.cur || '빈 칸') + ' ↔ 서류 ' + j.vals.map(function (e) { return e.v + '(' + e.ndoc + '종)'; }).join(', '));
    if (asking || r.items.some(function (it) { return it.id === iid; })) return;
    r.items.push(caseProcItem_(iid, 'check', '🧮 교차검증 — ' + fd.label + ' ' + (fd.cur ? '지금 기준일 ' + fd.cur + '이(가) 서류와 다릅니다' : '이(가) 비었고 서류 값이 갈립니다') + '. ' + note + (byUser ? ' · 지금 값은 세무사님이 정한 날이라 덮지 않았습니다' : '') + ' — 물린 판단: ' + CX_DEPS_.base.join('·'),
      { mode: 'choose', target: 'base', input: 'date', label: fd.label, cands: cands }));
  });
  if (B.changed.length) r.lines.push('🔁 교차검증으로 채운 기준일에 물린 판단을 다시 봅니다: ' + CX_DEPS_.base.join('·'));
  if (B.withVals) r.lines.push('🧮 사실 맞대기(' + fields.map(function (f) { return f.label; }).join('·') + '): 일치 ' + B.agree + ' · 빈 칸 채움 ' + B.filled.length + ' · 어긋남 ' + B.mismatch.length + ' · 서류끼리 갈림 ' + B.open.length + (B.mismatch.concat(B.open).length ? ' — ' + B.mismatch.concat(B.open).join(' / ') : ''));
  // [2026.10.29] 칸마다 서류와 어떻게 이어졌는지 사건 장부 바탕(kb.links)에 — 세무사님이 📒에서 확인
  try { if (typeof ledgerKbLink_ === 'function') fields.forEach(function (fd) { const j = cxJudgeField_(fd.vals); ledgerKbLink_(rec, { by: '칸 맞대기', path: 'base', label: fd.label, cur: fd.cur, vals: j.vals.map(function (e) { return { v: e.v, n: e.ndoc, src: e.srcs.slice(0, 3).join(' / ') }; }), d: j.d, rule: j.rule, why: j.why, filled: B.filled.some(function (s) { return s.indexOf(fd.label + ' ←') === 0; }), norm: function (x) { return cxNormV_(x, 'date'); } }); }); } catch (e) {}
}
// [재점검 9] 취득 원인 → 취득시기 정의(소득세법 §98·시행령 §162①). 표에 없는 원인은 판정하지 않는다
const CX_ACQ_RULE_ = [
  [/매매|교환\s*없음|^$/, 'min', '매매 취득시기 = 잔금청산일과 등기접수일 중 빠른 날(소득세법 §98·시행령 §162①1·2호)'],
  [/증여/, 'reg', '증여 취득시기 = 증여 등기 접수일(소득세법 시행령 §162①5호)'],
  [/상속|유증/, 'death', '상속 취득시기 = 상속개시일(피상속인 사망일, 소득세법 시행령 §162①5호)'],
  [/보존|신축/, 'approval', '자기 건설 건물 취득시기 = 사용승인서 교부일(소득세법 시행령 §162①4호)']
];
function cxDays_(a, b) { const x = Date.parse(a), y = Date.parse(b); return isNaN(x) || isNaN(y) ? 1e9 : Math.abs(x - y) / 86400000; }
function cxAk_(loc) { try { return typeof cpfAssetKey_ === 'function' ? cpfAssetKey_(loc) : ''; } catch (e) { return ''; } }
// 자산 열쇠 같은지 — 동·리+지번이 같고, 동호는 둘 다 있을 때만 비교(동호 없는 열쇠는 앞부분 일치로 — 낱말표 2절)
function cxAkSame_(a, b) {
  if (!a || !b) return false;
  const A = String(a).split('|'), B = String(b).split('|');
  return A[0] === B[0] && (!A[1] || !B[1] || A[1] === B[1]);
}
function cxSure_(f) { return !(f.read && f.read.conf === '불확실') && !f._copy; } // 사본(_copy, 3번 사본 표시)은 맞대기 근거에서 뺀다 — 원본 쪽이 남아 있음
// [재점검 21] 법령 정의(§98 빠른 날 고르기)에 쓸 날짜는 판독이 확인된 것만 — 글자인식이 확인 안 된 날짜(read.ocrConf "글자인식(미확인)")가 틀려 더 이르면 그 틀린 날을 고르게 됨
function cxDateOk_(f) { return !(f && f.read && /미확인/.test(String(f.read.ocrConf || ''))) || (f.read && f.read.check === '일치'); }
// 계약 묶음 — 같은 파일·같은 기록(rec 앞부분)의 매매대금·계약금·중도금·잔금·잔금일·계약일
function cxContracts_(facts, ak) {
  const g = {};
  // [밤 8바퀴 깨기] 여러 필지를 한 계약서로 판 경우 대금 사실의 자산 열쇠는 첫 필지 하나뿐 — 같은 서류(파일+기록) 안 소재지 중 하나라도 이 자산이면 이 자산의 계약으로 본다(고객Y 3필지: 511-3 자산이 511-1 열쇠의 잔금일을 못 봐 등기 접수일만 남던 것)
  const docKeys = {};
  if (ak) facts.forEach(function (f) { if (f && f.src && f.kind === '소재지' && f.keys && f.keys.asset) { const dk = (f.src.fileId || f.src.file) + '#' + String(f.src.rec || '').split('.')[0] + '#' + (f.src.part || ''); (docKeys[dk] = docKeys[dk] || []).push(f.keys.asset); } });
  facts.forEach(function (f) {
    if (!f || !f.src || !/^(매매대금|계약금|중도금|잔금|잔금일|계약일)$/.test(f.kind) || !cxSure_(f)) return;
    const inDoc = ak && (docKeys[(f.src.fileId || f.src.file) + '#' + String(f.src.rec || '').split('.')[0] + '#' + (f.src.part || '')] || []).some(function (a) { return cxAkSame_(a, ak); });
    if (ak && f.keys && f.keys.asset && !cxAkSame_(f.keys.asset, ak) && !inDoc) return;
    if (ak && !(f.keys && f.keys.asset)) return;
    const k = (f.src.fileId || f.src.file) + '#' + String(f.src.rec || '').split('.')[0] + '#' + (f.src.part || '');
    const x = g[k] = g[k] || { file: f.src.file, fid: f.src.fileId || f.src.file, doc: f.src.docType || '', mids: [] };
    const num = Number(typeof f.value === 'object' && f.value ? f.value.금액 : f.value) || 0;
    if (f.kind === '매매대금') { x.total = x.total || num; if (f.read && f.read.check === '일치') x.ruleChecked = true; } // 1번 서류 정리 규칙의 서류 안 검산
    else if (f.kind === '계약금') x.down = num;
    else if (f.kind === '중도금') x.mids.push(num);
    else if (f.kind === '잔금') x.bal = num;
    else if (f.kind === '잔금일') { x.balDate = String(f.value); x.balDateOk = cxDateOk_(f); }
    else if (f.kind === '계약일') x.date = String(f.value);
    if (!x.date && f.keys && f.keys.date) x.date = f.keys.date;
  });
  return Object.keys(g).map(function (k) {
    const x = g[k], parts = (x.down || 0) + x.mids.reduce(function (s, v) { return s + v; }, 0) + (x.bal || 0);
    x.checked = !!(x.total && ((x.down != null && x.bal != null && parts === x.total) || x.ruleChecked)); x.parts = parts; return x;
  }).filter(function (x) { return x.total || x.balDate; });
}
// 등기부 소유권 줄 — {접수일, 원인, 권리자들}
function cxRegRows_(facts, ak) {
  const g = {};
  facts.forEach(function (f) {
    if (!f || !f.src || !/소유권이력\d+/.test(String(f.src.rec || '')) || !cxSure_(f)) return;
    if (ak && f.keys && f.keys.asset && !cxAkSame_(f.keys.asset, ak)) return;
    const m = /^(.*?소유권이력\d+)/.exec(String(f.src.rec)); if (!m) return;
    const k = (f.src.fileId || f.src.file) + '#' + m[1];
    const x = g[k] = g[k] || { file: f.src.file, names: [] };
    if (f.kind === '접수일') { x.date = String(f.value); x.dateOk = cxDateOk_(f); }
    else if (f.kind === '등기 원인' || f.kind === '취득원인') x.cause = String(f.value);
    else if (f.kind === '성명') x.names.push(String(f.value).replace(/\s+/g, ''));
  });
  // 같은 등기 줄이 등기부 사본 여러 장에 — 접수일·원인·권리자가 같으면 하나로(사본은 근거 하나)
  const seen = {};
  return Object.keys(g).map(function (k) { return g[k]; }).filter(function (x) { if (!x.date) return false; const s = x.date + '|' + (x.cause || '') + '|' + x.names.join(','); if (seen[s]) return false; seen[s] = 1; return true; });
}
// 칸 하나의 판정 — 값마다 독립 근거(서류 종류 수)·검산·법령 정의
function cxJudgeField_(vals) {
  const by = {};
  vals.forEach(function (x) {
    const n = String(x.v);
    const e = by[n] = by[n] || { v: x.v, srcs: [], docs: {}, checked: false, law: false, lawWhy: '' };
    if (e.srcs.indexOf(x.src) === -1) e.srcs.push(x.src);
    e.docs[x.doc || '서류'] = 1;
    if (x.checked) e.checked = true;
    if (x.law) { e.law = true; e.lawWhy = x.lawWhy || e.lawWhy; }
  });
  const list = Object.keys(by).map(function (k) { const e = by[k]; e.ndoc = Object.keys(e.docs).length; return e; });
  const out = { vals: list, d: null, rule: '', why: '' };
  if (!list.length) return out;
  if (list.length === 1 && list[0].ndoc < 2) { out.d = list[0].v; out.rule = '단일 출처'; out.why = '서류 1종에서만 나온 값(맞댈 다른 서류 없음 — ' + list[0].srcs[0] + ')'; return out; } // [재점검 14] 출처 하나뿐인 값은 "일치"가 아님
  if (list.length === 1) { out.d = list[0].v; out.rule = '일치'; out.why = '서류 ' + list[0].ndoc + '종이 같은 값(' + list[0].srcs.slice(0, 2).join(' / ') + ')'; return out; }
  const law = list.filter(function (e) { return e.law; });
  if (law.length === 1) { out.d = law[0].v; out.rule = '법령 정의'; out.why = law[0].lawWhy || '소득세법 §98·시행령 §162①(잔금청산일과 등기접수일 중 빠른 날)'; return out; }
  const ck = list.filter(function (e) { return e.checked; });
  if (ck.length === 1) { out.d = ck[0].v; out.rule = '검산'; out.why = '계약금+중도금+잔금 = 매매대금 검산이 맞는 값은 하나뿐(' + ck[0].srcs[0] + ')'; return out; }
  const strong = list.filter(function (e) { return e.ndoc >= 2; });
  if (strong.length === 1 && list.every(function (e) { return e === strong[0] || e.ndoc <= 1; })) { out.d = strong[0].v; out.rule = '독립 서류 일치'; out.why = '서로 다른 서류 ' + strong[0].ndoc + '종이 같은 값(' + Object.keys(strong[0].docs).join('·') + '), 다른 값은 서류 1종뿐'; return out; }
  out.why = '값이 ' + list.length + '가지로 갈리고 검산·법령 정의·독립 서류 수로 하나로 안 정해짐';
  return out;
}
// 양도 계산기 칸마다 그 칸의 모든 서류 값 모으기
function cxBind_(c, st, facts) {
  const seller = String(((st.transferSellers || [])[0] || {}).name || c.납세자 || '').replace(/\s+/g, '');
  const fields = [], assets = st.transferAssets || [], cts = st.transferContracts || [];
  assets.forEach(function (a, i) {
    const ct = cts.filter(function (x) { return x.id === a.transferContractId; })[0] || {}, ci = cts.indexOf(ct);
    const ak = cxAk_(a.assetLocation);
    if (!ak) return; // 소재지 열쇠가 없으면 맞댈 수 없음
    const cons = cxContracts_(facts, ak), regs = cxRegRows_(facts, ak);
    const td = ct.date || c.기준일 || '', adate = a.acquisitionDate || '';
    const sorted = cons.slice().sort(function (x, y) { return String(x.balDate || x.date || '') < String(y.balDate || y.date || '') ? -1 : 1; });
    // [8바퀴 깨기] 취득일이 비어 있으면 "양도일 400일 안"만으로는 1년 안 단기 보유의 취득 계약까지 양도 쪽으로 들어간다(단기 세율이 갈리는 바로 그 사건) — 양도일에 가장 가까운 계약(±30일, 같은 계약의 사본·변경 계약)만 양도로
    const minTd = td ? Math.min.apply(null, cons.map(function (x) { return cxDays_(x.balDate || x.date || '', td); }).concat([1e9])) : 1e9;
    cons.forEach(function (x) { const dd = x.balDate || x.date || ''; x.side = td && adate ? (cxDays_(dd, td) <= cxDays_(dd, adate) ? 'sell' : 'buy') : td ? (cxDays_(dd, td) <= Math.min(400, minTd + 30) ? 'sell' : 'buy') : (x === sorted[sorted.length - 1] ? 'sell' : 'buy'); });
    const sameCt = assets.filter(function (q) { return q.transferContractId === a.transferContractId; });
    const multi = sameCt.length > 1;
    const val = function (x, v, extra) { return Object.assign({ v: v, src: (x.doc || '서류') + ' ' + x.file + (x.checked ? '(계약금+중도금+잔금 검산 일치)' : ''), doc: x.doc, checked: !!x.checked }, extra || {}); };
    if (ci >= 0 && (!multi || sameCt[0] === a)) fields.push({ path: 'c' + ci + '.totalPrice', key: 'totalPrice', label: '양도가액', input: 'money', cur: ct.totalPrice ? String(ct.totalPrice) : '', vals: cons.filter(function (x) { return x.side === 'sell' && x.total; }).map(function (x) { return val(x, String(x.total)); }) });
    if (!multi) fields.push({ path: 'a' + i + '.acquisitionPrice', key: 'acquisitionPrice', label: '취득가액', input: 'money', cur: a.acquisitionPrice ? String(a.acquisitionPrice) : '', vals: cons.filter(function (x) { return x.side === 'buy' && x.total; }).map(function (x) { return val(x, String(x.total)); }) });
    else {
      // [재점검 11] 한 계약에 필지가 여럿 — 필지마다 그 필지 열쇠의 취득가액 사실(증여세 신고서 필지별 평가액 등)과 맞댐(계약 전체 매매대금은 필지 몫이 아니라 안 씀)
      const pv = facts.filter(function (f) { return f && f.src && f.kind === '취득가액' && cxSure_(f) && f.keys && f.keys.asset && cxAkSame_(f.keys.asset, ak); }).map(function (f) { return { v: String(Number(f.value) || 0), src: (f.src.docType || '서류') + ' ' + f.src.file + ' 취득가액(필지 ' + ak + ')', doc: f.src.docType || '서류' }; }).filter(function (x) { return x.v !== '0'; });
      if (pv.length) fields.push({ path: 'a' + i + '.acquisitionPrice', key: 'acquisitionPrice', label: '자산' + (i + 1) + ' 취득가액(필지)', input: 'money', cur: a.acquisitionPrice ? String(a.acquisitionPrice) : '', vals: pv });
    }
    // 취득일 — 매매: 취득 계약 잔금일 · 납세자 앞 소유권 이전 접수일, 둘 다 있으면 빠른 날(§98·시행령 §162①) / 증여: 증여 등기 접수일
    const mine = regs.filter(function (r) { return seller && r.names.indexOf(seller) !== -1; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
    const lastMine = mine[mine.length - 1];
    const acqVals = [];
    cons.filter(function (x) { return x.side === 'buy' && x.balDate; }).forEach(function (x) { acqVals.push(val(x, x.balDate, { kind: '잔금일', ok: x.balDateOk !== false })); });
    if (lastMine) acqVals.push({ v: lastMine.date, src: '등기부 ' + lastMine.file + ' 소유권 이전 접수(' + (lastMine.cause || '원인?') + ', 권리자 ' + seller + ')', doc: '등기부', kind: '접수일', ok: lastMine.dateOk !== false });
    // [2026.10.18 재점검 9] 취득 원인별 취득시기(소득세법 §98·시행령 §162①) — 원인마다 법령 정의가 다르다. 예전엔 매매·증여만 나눠 상속받은 자산에 등기 접수일을 채웠다.
    //  표에 없는 원인(경매·분양·수용·판결·교환 등)이나 정의에 필요한 사실이 없으면 판정하지 않고(noFill) 출처 단 질문으로 묻는다
    const cause = lastMine ? String(lastMine.cause || '') : '';
    const acqRule = CX_ACQ_RULE_.filter(function (x) { return x[0].test(cause || '매매'); })[0];
    let noFill = '';
    if (!acqRule) noFill = '취득 원인 「' + cause + '」은 취득시기 정의표에 없음 — 판정 안 하고 묻기';
    else if (acqRule[1] === 'min') {
      const bal = acqVals.filter(function (x) { return x.kind === '잔금일'; }), rg = acqVals.filter(function (x) { return x.kind === '접수일'; });
      if (bal.length && rg.length && acqVals.every(function (x) { return x.ok !== false; })) acqVals.slice().sort(function (x, y) { return x.v < y.v ? -1 : 1; })[0].law = true; // [재점검 21] 판독 확인된 날짜끼리만
    } else if (acqRule[1] === 'reg') acqVals.filter(function (x) { return x.kind === '접수일'; }).forEach(function (x) { x.law = true; x.lawWhy = acqRule[2]; });
    else if (acqRule[1] === 'death' || acqRule[1] === 'approval') {
      // 상속: 상속개시일 = 피상속인(직전 권리자) 사망일 / 신축: 사용승인일 — 그 사실이 서류에 있으면 그것이 법령 정의 값, 등기 접수일은 정의가 아님
      const prevOwners = lastMine ? regs.filter(function (r) { return r.date < lastMine.date; }).sort(function (x, y) { return x.date < y.date ? 1 : -1; })[0] : null;
      const want = acqRule[1] === 'death' ? /^(사망일|상속개시일)$/ : /^사용승인일$/;
      const hit = facts.filter(function (f) { return f && f.src && want.test(f.kind) && cxSure_(f) && (acqRule[1] === 'approval' ? f.keys && f.keys.asset && cxAkSame_(f.keys.asset, ak) : !prevOwners || !prevOwners.names.length || prevOwners.names.indexOf(cxgName_ ? cxgName_((f.keys || {}).person) : '') !== -1); });
      acqVals.forEach(function (x) { x.law = false; });
      hit.forEach(function (f) { acqVals.push({ v: String(f.value), src: (f.src.docType || '서류') + ' ' + f.src.file + ' ' + f.kind, doc: f.src.docType || '서류', kind: f.kind, law: true, lawWhy: acqRule[2] }); });
      if (!hit.length) noFill = acqRule[2] + ' — 그 날짜가 서류에 없어 판정 안 함(등기 접수일은 정의가 아님)';
    }
    // 지분마다 나눈 자산(같은 물건에 계약 여럿)은 취득일이 지분마다 다르다 — 그 자산 값이 납세자 소유권 줄 날짜 중 하나인지만 본다(재점검 11)
    const shareSplit = cts.length > 1 && assets.filter(function (q) { return cxAkSame_(cxAk_(q.assetLocation), ak); }).length > 1;
    if (shareSplit) fields.push({ path: 'a' + i + '.acquisitionDate', key: 'acquisitionDate', label: '취득일(지분)', input: 'date', cur: adate, vals: mine.map(function (r) { return { v: r.date, src: '등기부 ' + r.file + ' 소유권 이전 접수(' + (r.cause || '원인?') + ')', doc: '등기부', kind: '접수일' }; }), anyOf: true, noFill: '지분마다 취득일이 다름 — 판정 안 하고 그 값이 소유권 줄 날짜 중 하나인지만 봄' });
    else fields.push({ path: 'a' + i + '.acquisitionDate', key: 'acquisitionDate', label: '취득일', input: 'date', cur: adate, vals: acqVals, noFill: noFill, cause: cause });
    // 양도일 — 양도 계약 잔금일 · 납세자 다음 권리자로의 이전 접수일, 빠른 날(§98)
    if (ci >= 0 && (!multi || sameCt[0] === a)) {
      const after = lastMine ? regs.filter(function (r) { return r.date > lastMine.date && r.names.indexOf(seller) === -1; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; })[0] : null;
      const tv = [];
      cons.filter(function (x) { return x.side === 'sell' && x.balDate; }).forEach(function (x) { tv.push(val(x, x.balDate, { kind: '잔금일', ok: x.balDateOk !== false })); });
      if (after) tv.push({ v: after.date, src: '등기부 ' + after.file + ' 소유권 이전 접수(' + (after.cause || '원인?') + ')', doc: '등기부', kind: '접수일', ok: after.dateOk !== false });
      const b = tv.filter(function (x) { return x.kind === '잔금일'; }), r2 = tv.filter(function (x) { return x.kind === '접수일'; });
      if (b.length && r2.length && tv.every(function (x) { return x.ok !== false; }) && (!after || !after.cause || /매매/.test(after.cause))) tv.slice().sort(function (x, y) { return x.v < y.v ? -1 : 1; })[0].law = true;
      fields.push({ path: 'c' + ci + '.date', key: 'date', label: '양도일', input: 'date', cur: ct.date || '', vals: tv });
    }
  });
  return fields;
}
// 맞대기 결과 → 빈 칸은 판정 값으로 채움 / 어긋남은 출처 단 질문(지금 계산기 값도 후보로) — 지금 값이 세무사님 답이면 덮지 않고 묻는다
// 증여·상속 — 기준일(증여일·상속개시일)을 모든 서류 값과 맞댄다. 증여재산가액·상속재산 평가는 시가·보충적 평가 판단이라 여기서 정하지 않음
//  증여일: 증여 등기 접수일(상증령 §24 — 등기·등록 대상은 소유권이전등기 접수일)이 있으면 법령 정의, 그 밖에 증여일 사실(계약서·신고서)
//  상속개시일: 사망일·상속개시일 사실(기본증명서·사망진단서·제적등본 등)
function cxBindGI_(cc, facts) {
  const sure = (facts || []).filter(function (f) { return f && f.src && cxSure_(f); });
  const vals = [];
  if (cc.세목 === 'inheritance') {
    sure.filter(function (f) { return /^(사망일|상속개시일)$/.test(f.kind); }).forEach(function (f) { vals.push({ v: String(f.value), src: (f.src.docType || '서류') + ' ' + f.src.file + ' ' + f.kind, doc: f.src.docType || '서류' }); });
    return [{ path: 'base', key: 'base', label: '상속개시일(사망일)', input: 'date', cur: cc.기준일 || '', vals: vals }];
  }
  if (cc.세목 === 'gift') {
    const donee = String(((cc.사건개요 || {}).giftDoneeName) || cc.납세자 || '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ''); // [2026.10.23 ㅌ6] "김도윤(수증자)"의 괄호를 떼야 등기부 권리자와 맞는다 — 안 맞으면 등기접수일(§24) 법령 값이 빠져 계약서 증여일과 어긋난다며 되물었다(가상증여9)
    sure.filter(function (f) { return f.kind === '증여일'; }).forEach(function (f) { vals.push({ v: String(f.value), src: (f.src.docType || '서류') + ' ' + f.src.file + ' 증여일', doc: f.src.docType || '서류' }); });
    // 등기부 증여 줄(권리자 = 수증자) 접수일 — 이번 증여 기간(다른 증여일 사실 ±2년) 안의 것만
    const near = vals.map(function (x) { return x.v; });
    const rows = {};
    sure.forEach(function (f) { const m = /^(.*?소유권이력\d+)/.exec(String(f.src.rec || '')); if (!m) return; const k = (f.src.fileId || f.src.file) + '#' + m[1]; const x = rows[k] = rows[k] || { file: f.src.file, names: [] }; if (f.kind === '접수일') { x.date = String(f.value); x.dateOk = cxDateOk_(f); } else if (f.kind === '등기 원인' || f.kind === '취득원인') x.cause = String(f.value); else if (f.kind === '성명') x.names.push(String(f.value).replace(/\s+/g, '')); });
    const seen = {};
    Object.keys(rows).map(function (k) { return rows[k]; }).filter(function (x) { return x.date && /증여/.test(x.cause || '') && donee && x.names.indexOf(donee) !== -1 && (!near.length || near.some(function (d) { return cxDays_(d, x.date) <= 730; })); })
      .forEach(function (x) { if (seen[x.date]) return; seen[x.date] = 1; vals.push({ v: x.date, src: '등기부 ' + x.file + ' 소유권 이전 접수(증여, 권리자 ' + donee + ')', doc: '등기부', law: true, lawWhy: '증여재산 취득시기 = 소유권이전등기 접수일(상증령 §24①1호)' }); });
    // 증여 등기 줄이 여럿(다른 증여)이면 법령 정의 하나로 못 정함 — 판정에서 법령 표시를 뗀다
    if (vals.filter(function (x) { return x.law; }).length > 1) vals.forEach(function (x) { x.law = false; });
    return [{ path: 'base', key: 'base', label: '증여일', input: 'date', cur: cc.기준일 || '', vals: vals }];
  }
  return [];
}
function cxBindCheck_(cc, r, facts, rec, applyOne) {
  if (cc.세목 === 'gift' || cc.세목 === 'inheritance') return cxBindCheckGI_(cc, r, facts, rec, applyOne);
  if (cc.세목 !== 'transfer') return;
  const sv = caseProcLoad_(cc.id) || {}, tc = sv.trCalc; if (!tc || !tc.state) return;
  const fields = cxBind_(cc, tc.state, facts), trAns = sv.trAns || {};
  const B = rec.bind = { fields: fields.length, withVals: 0, agree: 0, filled: [], mismatch: [], open: [], changed: [] };
  fields.forEach(function (fd) {
    if (!fd.vals.length) return;
    B.withVals++;
    const cur = cxNormV_(fd.cur, fd.input);
    // 지분별 취득일 — 그 값이 납세자 소유권 줄 날짜 중 하나면 맞음
    if (fd.anyOf) { if (!cur || fd.vals.some(function (x) { return cxNormV_(x.v, fd.input) === cur; })) { if (cur) B.agree++; return; } }
    const j = fd.anyOf ? { vals: cxJudgeField_(fd.vals).vals, d: null, rule: '', why: fd.noFill } : cxJudgeField_(fd.vals);
    // 법령 정의에 필요한 날짜가 서류에 없음(상속개시일·사용승인일 등) — 판정하지 않는다. 지금 값이 등기 접수일 등 정의가 아닌 날이면 물음(재점검 9)
    if (fd.noFill && !fd.anyOf) {
      if (!cur) return;
      const lawish = j.vals.some(function (e) { return e.law; });
      if (!lawish) {
        const iidN = 'cxb:' + fd.path + ':nolaw:' + cxHash_(cur + fd.noFill);
        B.open.push(fd.label + ' 지금 ' + fd.cur + ' — ' + fd.noFill);
        if (!r.items.some(function (it) { return it.id === iidN; })) r.items.push(caseProcItem_(iidN, 'check', '🧮 교차검증 — 「' + fd.label + '」 지금 값 ' + fd.cur + '. ' + fd.noFill + '. 맞는 취득일을 고르거나 넣어 주세요 — 물린 판단: ' + (CX_DEPS_[fd.key] || []).join('·'),
          { mode: 'choose', target: 'calc:' + fd.path, input: fd.input, label: fd.label, cands: [{ v: String(fd.cur), src: '지금 계산기 값 — 원인 「' + (fd.cause || '?') + '」의 등기 접수일일 수 있음' }] }));
        return;
      }
    }
    const byUser = trAns[fd.path] && /^세무사님/.test(String(trAns[fd.path].src || ''));
    const many = tc.state.transferAssets.length > 1;
    const label = (many ? fd.path.replace(/^a(\d+)\..*$/, function (_, k) { return '자산' + (Number(k) + 1) + ' '; }).replace(/^c(\d+)\..*$/, function (_, k) { return '계약' + (Number(k) + 1) + ' '; }) : '') + fd.label;
    if (j.d != null && cur && cxNormV_(j.d, fd.input) === cur) { if (j.rule === '단일 출처') B.single = (B.single || 0) + 1; else B.agree++; return; } // [재점검 14] 단일 출처는 일치로 안 셈
    if (j.d == null && cur && j.vals.every(function (e) { return cxNormV_(e.v, fd.input) === cur; })) { B.agree++; return; }
    const iid = 'cxb:' + fd.path + ':' + cxHash_(JSON.stringify(j.vals.map(function (e) { return e.v; })) + '|' + cur);
    const cands = j.vals.slice().sort(function (x, y) { return (y.law - x.law) || (y.checked - x.checked) || (y.ndoc - x.ndoc); })
      .map(function (e) { return { v: String(e.v), src: e.srcs.slice(0, 3).join(' / ') + (e.law ? ' — 법령 정의' : e.checked ? ' — 검산 일치' : '') + (e.ndoc >= 2 ? ' — 서류 ' + e.ndoc + '종 일치' : '') }; });
    const asking = r.items.some(function (it) { return it.ask && it.ask.target === 'calc:' + fd.path && (it.ask.cands || []).length >= 2; }); // 이미 후보로 묻는 칸은 질문 쪽(cxJudge_)이 정한다 — 한 칸을 두 길에서 다르게 정하지 않게
    if (!cur && j.d != null && !asking && !fd.noFill) { // 빈 칸 — 객관 규칙으로 정해지면 채운다(정의가 없는 원인은 안 채움)
      if (applyOne({ iid: iid, target: 'calc:' + fd.path, label: label, input: fd.input, cands: cands, kind: '빈칸' }, String(j.d), '교차검증(' + j.rule + '): ' + j.why, 'gas', { why: j.why, rule: j.rule })) {
        B.filled.push(label + ' ← ' + j.d + '(' + j.rule + ')'); B.changed.push(fd.key); rec.gas.push({ iid: iid, label: label, v: j.d, rule: j.rule });
      }
      return;
    }
    if (!cur && asking) { (B.asking = B.asking || []).push(label); return; } // 빈 칸을 이미 후보 질문으로 묻는 중 — 새 어긋남이 아님
    // 지금 값이 서류들과 어긋남(또는 서류끼리 갈림) — 묻지 않고 지나가던 곳을 출처 단 질문으로
    const curSrc = String((tc.src || {})[fd.path] || (trAns[fd.path] && trAns[fd.path].src) || '지금 계산기 값');
    if (cur && !cands.some(function (x) { return cxNormV_(x.v, fd.input) === cur; })) cands.push({ v: fd.cur, src: '지금 계산기 값 — ' + curSrc.slice(0, 120) });
    const note = j.d != null ? '교차검증 판정: ' + j.d + '(' + j.rule + ' — ' + j.why + ')' : j.why;
    (j.d != null ? B.mismatch : B.open).push(label + ' 지금 ' + (fd.cur || '빈 칸') + ' ↔ 서류 ' + j.vals.map(function (e) { return e.v + '(' + e.ndoc + '종)'; }).join(', '));
    if (r.items.some(function (it) { return it.id === iid || (it.ask && it.ask.target === 'calc:' + fd.path && (it.ask.cands || []).length >= 2); })) return; // 이미 같은 칸을 후보로 묻고 있으면 겹쳐 묻지 않음
    r.items.push(caseProcItem_(iid, 'check', '🧮 교차검증 — 계산기 「' + label + '」 ' + (fd.cur ? '지금 값 ' + fd.cur + '이(가) 서류와 다릅니다' : '이(가) 비었고 서류 값이 갈립니다') + '. ' + note + (byUser ? ' · 지금 값은 세무사님 답이라 덮지 않았습니다' : '') + ' — 이 칸에 물린 판단: ' + (CX_DEPS_[fd.key] || []).join('·'),
      { mode: 'choose', target: 'calc:' + fd.path, input: fd.input, label: label, cands: cands }));
  });
  if (B.changed.length) r.lines.push('🔁 교차검증으로 채운 칸에 물린 판단을 다시 봅니다: ' + B.changed.map(function (k) { return (CX_DEPS_[k] || []).join('·'); }).join(' / '));
  r.lines.push('🧮 사실 맞대기: 계산기 칸 ' + B.fields + '개 중 서류 값이 있는 칸 ' + B.withVals + '개 — 일치 ' + B.agree + ' · 빈 칸 채움 ' + B.filled.length + ' · 어긋남(판정 값 있음) ' + B.mismatch.length + ' · 서류끼리 갈림 ' + B.open.length
    + (B.mismatch.length ? ' — ' + B.mismatch.slice(0, 3).join(' / ') : ''));
  // [2026.10.29] 칸마다 서류와 어떻게 이어졌는지 사건 장부 바탕(kb.links)에 — 서류 값이 없는 칸도 "서류에 없음"으로 남긴다(세무사님이 📒에서 확인)
  try {
    if (typeof ledgerKbLink_ === 'function') {
      const many2 = tc.state.transferAssets.length > 1;
      fields.forEach(function (fd) {
        const j = cxJudgeField_(fd.vals || []);
        const label = (many2 ? fd.path.replace(/^a(\d+)\..*$/, function (_, k) { return '자산' + (Number(k) + 1) + ' '; }).replace(/^c(\d+)\..*$/, function (_, k) { return '계약' + (Number(k) + 1) + ' '; }) : '') + fd.label;
        ledgerKbLink_(rec, { by: '칸 맞대기', path: fd.path, label: label, cur: fd.cur, vals: j.vals.map(function (e) { return { v: e.v, n: e.ndoc, src: e.srcs.slice(0, 3).join(' / ') + (e.law ? ' — 법령 정의' : e.checked ? ' — 검산 일치' : '') }; }), d: j.d, rule: j.rule, why: j.why,
          filled: B.filled.some(function (s) { return s.indexOf(label + ' ←') === 0; }), norm: function (x) { return cxNormV_(x, fd.input); } });
      });
    }
  } catch (e) {}
}

// =========================================================
// [2026.10.18 재점검 3·7] 계산기 입력이 만들어지는 자리의 교차검증(trcOverview_가 trcFromEvidence_ 직후·세무사님 답 덮기 전에 부름).
//  서류 규칙(tc_ruleTransferFacts_)이 서류 순서로 고른 값([0])을 사건 사실 전체 맞대기 판정으로 바꾼다 — 세무사님 원문 3
//  "입수한 파일이나 시간에 우선순위를 두지 말고 정확성에 우선을 두고 교차검증". 판정은 매 실행 서류로 다시 하므로 답 저장소에 굳지 않는다(재점검 7).
//  · 판정 값(법령 정의·검산·독립 서류 2종 이상)이 서류 순서 값과 다르면 판정 값으로 바꾸고 근거를 남긴다
//  · 서류끼리 갈리는데 판정이 안 되면 값은 그대로 두되 "서류끼리 다름 — 질문 중"을 근거에 붙이고 후보를 질문으로(cxBindCheck_가 출처 단 질문)
//  · 법령 정의가 다른 원인(상속·신축)인데 서류 순서 값이 등기 접수일이면 그 값을 빼고 묻는다(재점검 9)
// =========================================================
// [재점검 17] 바뀐 칸에 물린 판단의 전후 — 날짜가 바뀌면 보유기간(만 년) 전후를 적는다(장기보유공제·단기세율 갈림이 보이게)
function cxYears_(a, b) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b))) return null; let y = Number(b.slice(0, 4)) - Number(a.slice(0, 4)); if (b.slice(5) < a.slice(5)) y--; return y; }
function cxHoldDelta_(st, fd, oldV, newV) {
  try {
    const m = /^a(\d+)\.acquisitionDate$|^c(\d+)\.date$/.exec(fd.path); if (!m) return '';
    if (m[1] != null) { const a = st.transferAssets[Number(m[1])], ct = (st.transferContracts || []).filter(function (x) { return x.id === a.transferContractId; })[0] || {}; const y0 = cxYears_(oldV, ct.date), y1 = cxYears_(newV, ct.date); return y0 != null && y1 != null && y0 !== y1 ? ' — 보유 ' + y0 + '년 → ' + y1 + '년' : ''; }
    const ct = st.transferContracts[Number(m[2])]; const a = (st.transferAssets || []).filter(function (x) { return x.transferContractId === ct.id; })[0] || {}; const y0 = cxYears_(a.acquisitionDate, oldV), y1 = cxYears_(a.acquisitionDate, newV); return y0 != null && y1 != null && y0 !== y1 ? ' — 보유 ' + y0 + '년 → ' + y1 + '년' : '';
  } catch (e) { return ''; }
}
function cxSetPath_(st, path, v) {
  let m;
  if ((m = /^seller\.(\w+)$/.exec(path))) { st.transferSellers[0][m[1]] = v; return true; }
  if ((m = /^c(\d+)\.buyer\.(\w+)$/.exec(path))) { const ct = st.transferContracts[Number(m[1])]; if (!ct) return false; ct.buyers = ct.buyers && ct.buyers.length ? ct.buyers : [{}]; ct.buyers[0][m[2]] = v; return true; }
  if ((m = /^c(\d+)\.(\w+)$/.exec(path))) { const ct = st.transferContracts[Number(m[1])]; if (!ct) return false; ct[m[2]] = m[2] === 'totalPrice' ? (Number(String(v).replace(/[^\d]/g, '')) || 0) : v; return true; }
  if ((m = /^a(\d+)\.(\w+)$/.exec(path))) { const a = st.transferAssets[Number(m[1])]; if (!a) return false; a[m[2]] = v; return true; }
  return false;
}
function cxInlineTransfer_(c, S, lines) {
  if (!S || !S.state) return;
  // 지난 처리에서 교차검증(후보 판정)·AI가 정한 계산기 칸 — 후보 묶음이 그대로면 다시 넣고, 서류가 바뀌어 후보가 달라졌으면 버린다(다시 판정)
  try {
    const ap = ((caseProcLoad_(c.id) || {}).cxAi || {}).applied || {};
    Object.keys(ap).forEach(function (iid) {
      const a = ap[iid], m = /^calc:(.+)$/.exec(String(a && a.target || '')); if (!m || a.user) return;
      const cs = (S.cands || {})[m[1]];
      const fpNow = cs && cs.length ? cxHash_(cs.map(function (x) { return cxNormV_(x.v, a.input); }).sort().join('|')) : '';
      if (cs && cs.length && a.fp && fpNow !== a.fp) return; // 후보가 바뀜 — 지난 판정 버림
      if (cxSetPath_(S.state, m[1], a.v)) S.src[m[1]] = (a.by === 'ai' ? '🤖 AI 판단(' + (a.model || '') + ')' : '교차검증(' + (a.rule || '') + ')') + ': ' + String(a.why || '').slice(0, 120);
    });
  } catch (e) {}
  const facts = cxFacts_(c); if (!facts.length) return;
  const fields = cxBind_(c, S.state, facts);
  const chg = [], open = [], cleared = [];
  fields.forEach(function (fd) {
    if (!fd.vals.length || fd.anyOf) return;
    const j = cxJudgeField_(fd.vals), cur = cxNormV_(fd.cur, fd.input);
    const docsAll = {}; j.vals.forEach(function (e) { Object.keys(e.docs).forEach(function (d) { docsAll[d] = 1; }); });
    if (fd.noFill) {
      // 정의가 다른 원인인데 지금 값이 등기 접수일 — 정의가 아닌 날로 계산하지 않게 빼고 묻는다
      const lawV = j.vals.filter(function (e) { return e.law; })[0];
      if (lawV) { if (cur !== cxNormV_(lawV.v, fd.input)) { const old = fd.cur; cxSetPath_(S.state, fd.path, String(lawV.v)); S.src[fd.path] = '교차검증(법령 정의): ' + (lawV.lawWhy || '') + ' — ' + lawV.srcs[0]; chg.push(fd.label + ' ' + (old || '빈 칸') + ' → ' + lawV.v); } return; }
      if (cur && fd.vals.some(function (x) { return x.kind === '접수일' && cxNormV_(x.v, fd.input) === cur; }) && /상속|유증|보존|신축/.test(fd.cause || '')) { cxSetPath_(S.state, fd.path, ''); delete S.src[fd.path]; cleared.push(fd.label + ' ' + fd.cur + '(원인 ' + fd.cause + '의 등기 접수일 — 취득시기 정의가 아님)'); }
      return;
    }
    if (j.d != null && j.rule !== '일치' && j.rule !== '단일 출처') {
      if (cur !== cxNormV_(j.d, fd.input)) { const old = fd.cur; cxSetPath_(S.state, fd.path, fd.input === 'money' ? String(j.d) : String(j.d)); S.src[fd.path] = '교차검증(' + j.rule + '): ' + j.why + (old ? ' — 서류 순서로 고른 값 ' + old + ' 대신' : ''); chg.push(fd.label + ' ' + (old || '빈 칸') + ' → ' + j.d + '(' + j.rule + ')' + cxHoldDelta_(S.state, fd, old, j.d)); }
      else if (S.src[fd.path] && !/교차검증/.test(S.src[fd.path])) S.src[fd.path] += ' · 교차검증 ' + j.rule + ' 확인';
      return;
    }
    if (j.d != null) { // 값 하나(여러 서류 일치 또는 단일 출처) — 비었으면 채우고, 근거에 출처 수를 적는다
      if (!cur) { cxSetPath_(S.state, fd.path, String(j.d)); S.src[fd.path] = '교차검증(' + j.rule + '): ' + j.why; chg.push(fd.label + ' 빈 칸 → ' + j.d + '(' + j.rule + ')'); }
      else if (cur === cxNormV_(j.d, fd.input) && S.src[fd.path] && !/교차검증/.test(S.src[fd.path])) S.src[fd.path] += ' · 교차검증 ' + j.rule;
      return;
    }
    if (Object.keys(docsAll).length >= 2) { open.push(fd.label); if (S.src[fd.path]) S.src[fd.path] += ' ⚠ 서류끼리 다름(' + j.vals.map(function (e) { return e.v; }).join(' / ') + ') — 질문 중'; }
  });
  if (chg.length) lines.push('🧮 교차검증이 서류 순서로 고른 값을 바꿈: ' + chg.join(' / ') + ' — 물린 판단(보유기간·세율·공제·환산 등)은 이 값으로 다시 계산됩니다');
  if (cleared.length) lines.push('🧮 교차검증이 뺀 값(정의가 아닌 날): ' + cleared.join(' / ') + ' — 질문으로 받습니다');
  if (open.length) lines.push('🧮 서류끼리 다르고 판정이 안 된 칸: ' + open.join(', ') + ' — 출처 단 질문으로(AI 연결 전까지 세무사님께)');
}

// =========================================================
// [2026.10.19 밤 4바퀴 시간 축] 날짜 차이의 무게 — 날짜 후보가 갈릴 때 그 차이가 법적 경계를 넘나드는지(세액이 달라지는지) 본다.
//  양도: 보유기간 1년·2년(단기 세율, 1세대1주택 2년)·3년(장기보유특별공제 시작)·10년(증여 이월과세) 경계 / 상속·증여: 사전증여 합산 10년(상속인)·5년(그 외)·증여 10년 합산
//  넘나들면 "세액에 영향" 표시를 붙여 질문을 앞으로, 안 넘으면 "보유기간 같음"을 적어 덜 급함을 알린다(판정은 안 함)
// =========================================================
const CX_HOLD_BOUNDS_ = [1, 2, 3, 10];
function cxDateWeight_(cands, otherDate, kind) {
  const ys = (cands || []).map(function (d) { return kind === 'acq' ? cxYears_(d, otherDate) : cxYears_(otherDate, d); }).filter(function (y) { return y != null; });
  if (ys.length < 2) return null;
  const mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys);
  const crossed = CX_HOLD_BOUNDS_.filter(function (b) { return mn < b && mx >= b; });
  return { min: mn, max: mx, crossed: crossed, text: crossed.length ? '⚖ 세액에 영향 — 이 날짜 차이로 보유기간이 ' + mn + '년 ↔ ' + mx + '년(' + crossed.map(function (b) { return b + '년'; }).join('·') + ' 경계를 넘나듦: ' + crossed.map(function (b) { return b === 1 || b === 2 ? '단기 세율·1세대1주택 요건' : b === 3 ? '장기보유특별공제' : '증여 이월과세 10년'; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join('·') + ')' : '보유기간 같음(' + mn + '년) — 세율·공제는 그대로' };
}
// 질문 목록에서 날짜 고르기 질문에 무게를 붙이고, 세액에 영향 있는 것을 앞으로
function cxWeighDateItems_(cc, r) {
  if (cc.세목 !== 'transfer') return 0;
  const st = ((caseProcLoad_(cc.id) || {}).trCalc || {}).state; if (!st) return 0;
  let n = 0;
  (r.items || []).forEach(function (it) {
    const a = it.ask || {}, t = String(a.target || ''); if (!Array.isArray(a.cands) || a.cands.length < 2) return;
    let m = /^calc:a(\d+)\.acquisitionDate$/.exec(t), w = null;
    if (m) { const as = st.transferAssets[Number(m[1])] || {}, ct = (st.transferContracts || []).filter(function (x) { return x.id === as.transferContractId; })[0] || {}; w = cxDateWeight_(a.cands.map(function (x) { return cxNormV_(x.v, 'date'); }), ct.date || cc.기준일, 'acq'); }
    else if ((m = /^calc:c(\d+)\.date$/.exec(t)) || a.mode === 'base' || t === 'base') { const ct = m ? st.transferContracts[Number(m[1])] || {} : (st.transferContracts || [])[0] || {}; const as = (st.transferAssets || []).filter(function (x) { return x.transferContractId === ct.id; })[0] || {}; w = as.acquisitionDate ? cxDateWeight_(a.cands.map(function (x) { return cxNormV_(x.v, 'date'); }), as.acquisitionDate, 'tr') : null; }
    if (!w) return;
    it.text = w.text + ' · ' + it.text; it.weight = w.crossed.length ? 2 : 0; n++;
  });
  if (n) r.items.sort(function (x, y) { return (y.weight || 0) - (x.weight || 0); }); // 세액에 영향 있는 날짜 질문을 앞으로(같은 무게 안에서는 원래 순서 — 안정 정렬)
  return n;
}
// 상속·증여 — 다른 증여일이 합산 기간 경계 가까이(30일 안)거나 기간 안/밖이 서류마다 갈리면 알림
function cxGiftWindows_(cc, facts) {
  if (cc.세목 !== 'inheritance' && cc.세목 !== 'gift') return [];
  const base = cc.기준일 || ''; if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return [];
  const out = [];
  (facts || []).filter(function (f) { return f && f.src && f.kind === '증여일' && !f._copy && !(f.read && f.read.conf === '불확실'); }).forEach(function (f) {
    const d = cxNormV_(f.value, 'date'); if (!/^\d{4}-/.test(d) || d >= base) return;
    [10, 5].forEach(function (yrs) {
      const edge = String(Number(base.slice(0, 4)) - yrs) + base.slice(4);
      const gap = Math.abs((Date.parse(d) - Date.parse(edge)) / 86400000);
      if (gap <= 30) out.push('⏱ 증여일 ' + d + '(' + (f.src.docType || '서류') + ' ' + f.src.file + ')이 ' + (cc.세목 === 'inheritance' ? '상속개시일' : '이번 증여일') + ' ' + base + ' 기준 ' + yrs + '년 경계(' + edge + ')에서 ' + Math.round(gap) + '일 — 합산 대상인지 날짜를 원문으로 확인(' + (yrs === 10 ? (cc.세목 === 'inheritance' ? '상속인 사전증여 10년' : '동일인 10년 합산') : '상속인 아닌 자 5년') + ')');
    });
  });
  return out;
}
