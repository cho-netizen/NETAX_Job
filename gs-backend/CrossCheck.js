// =========================================================
// [2026.10.18 교차검증 2번] 교차검증·묻기 — 사건처리 "처리개요" 단계 끝에서, 도구가 낸 질문 중 "어느 값인가"를 묻는 것을 쟁점으로 바꿔
//  ① GAS 객관 규칙(토큰 0)으로 풀고 ② 남은 것(미결)은 서버가 자동으로 싼 AI(LIGHT_MODEL)에게 사건당 한 번에 묶어 묻고
//  ③ AI가 확실하다고 한 값은 세액계산기 칸으로 바로 넣으며 "🤖 AI 판단(모델)"으로 표시하고 ④ AI도 못 푼 것·서류에 없는 사실만 사용자에게 묻는다.
//  세무사님 지시(2026-10-18): "AI에게 물을지를 사용자에게 묻는 것은 의미가 없다", "AI는 GAS보다 맥락을 잘 본다는 전제로 묻는다",
//  "GAS를 처음부터 완벽하게 하려 하지 마라(과최적화)" — 그래서 GAS에는 객관 규칙(같은 값·검산·법령 정의)만 두고, 맥락 판단은 처음부터 AI 몫.
//  AI 판단은 모두 기록(ai_logPaid_ kind 'cx')해서, 여러 사건에서 반복·일관·무수정인 것만 나중에 GAS 규칙으로 옮긴다(cxAiReport_).
//  설계: netax-inventory/maps/설계_2번.md 3장. 사실 모양: maps/두세션_공통_20261018.md 3절.
//  비용: 사건 폴더를 통째로 보내지 않고 "쟁점 묶음"(사건 요약 + 쟁점에 물린 사실·출처 원문 앞뒤 + 후보 + 못 푼 이유 + 계산기 칸의 쓰임)만 보낸다.
//  재현기·🧪 점검기(akSandbox_)에서는 CX_AI_DRY_ = true — 실제로 부르지 않고 "AI에게 물을 질문 목록"과 글자 수만 남긴다.
// =========================================================
var CX_AI_DRY_ = false;   // true면 AI를 부르지 않는다(점검·재현기)
// [2026.10.18 재점검 4] 가리기 — 세무사님 조건(원문 21) "주민번호·전화번호·계좌번호는 가려서". 쟁점 묶음을 만들 때(cxIssueText_·cxCaseSummary_ 결과)와
//  기록에 남길 때 반드시 거친다. 예전 함수는 날짜(2025-12-15)를 망가뜨리고 주민번호 13자리 중 9자리를 남기고 하이픈 없는 계좌를 못 가렸다(재점검 4).
//  ① 주민번호: 앞 6자리가 날짜 꼴(YYMMDD)이고 뒤 7자리(성별 1~8로 시작) — 하이픈·공백 있든 없든 → 앞 6자리만 남김
//  ② 전화: 0으로 시작하는 지역·휴대 번호(02·0XX·01X) → 앞 국번만 남김 ③ 계좌: 숫자 묶음 3개 이상(하이픈) 합 10자리 이상, 또는 "계좌·통장·번호" 낱말 뒤 숫자 10~16자리 → 첫 묶음만 남김
//  날짜(YYYY-MM-DD·YYYY.MM.DD), 쉼표 금액, 낱말 없는 맨 숫자 금액은 건드리지 않는다(AI가 금액을 맞대야 하므로)
// [밤 8바퀴 깨기] 글자인식이 한 글자씩 띄운 번호("6 4 0 7 2 2 - 1 2 …")와 빈칸으로 나뉜 계좌("계좌 123 456 789012")가 그대로 나가던 것 — 띄운 숫자 6개 이상은 먼저 붙이고, 낱말 뒤 빈칸 묶음도 계좌로 본다. 여권번호도 가린다
function cxMask_(s) {
  return String(s == null ? '' : s)
    .replace(/(^|[^\d,.])(\d(?: \d){5}\s*-\s*\d(?: \d){6})(?![\d,.])/g, function (m, p, x) { return p + x.replace(/\s/g, ''); }) // 띄운 주민번호 꼴만 붙임(표의 숫자 열을 붙이면 금액이 망가짐)
    .replace(/((?:계좌|통장|account|acct)(?:번호)?[\s:：]{0,3})(\d{3,6})((?: \d{3,8}){1,3})(?![\d,.:-])/gi, function (m, a, b, rest) { return (b + rest).replace(/ /g, '').length >= 11 ? a + b + rest.replace(/\d/g, '*') : m; }) // 낱말 바로 뒤 빈칸 묶음만(뒤 낱말·날짜·연도를 건너가 가리지 않게)
    .replace(/(여권\s*번호?\s*[:：]?\s*[A-Za-z]{1,2})\d{7,8}/g, function (m, a) { return a + '*'.repeat(m.length - a.length); })
    .replace(/(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))\s*-?\s*[1-8]\d{6}(?!\d)/g, '$1$2-*******')
    .replace(/(^|[^\d])(0(?:2|[3-6][1-5]|1[016789]|70|50\d?))[-.\s)]\s*\d{3,4}[-.\s]\d{4}(?!\d)/g, '$1$2-****-****')
    .replace(/(^|[^\d])(01[016789])\d{7,8}(?!\d)/g, '$1$2********')
    .replace(/(^|[^\d-])(\d{2,6})((?:-\d{1,8}){2,4})(?![\d-])/g, function (m, p, a, rest) {
      const total = (a + rest).replace(/-/g, '').length;
      if (/^-\d{2}-\d{2}$/.test(rest) && a.length === 4) return m; // 날짜 YYYY-MM-DD
      if (a.length === 3 && /^-\d{2}-\d{5}$/.test(rest)) return m; // 사업자등록번호(000-00-00000)는 개인 식별번호가 아니고 서류 맞대기 열쇠라 남김
      if (/\*/.test(m) || total < 10) return m;
      return p + a + rest.replace(/\d/g, '*');
    })
    .replace(/((?:계좌|통장|입금|출금|번호|account|acct)[^\d\n]{0,12})(\d{3})\d{7,13}(?!\d)/gi, function (m, a, b) { return a + b + '*'.repeat(m.length - a.length - 3); });
}
var CX_LAST_ = null;      // 이 실행의 쟁점 기록 — 🧪 점검기가 결과에 싣는다
var CX_IN_ = false;       // 다시 들어오지 않게

// 쟁점 종류 → 모델 등급. 값은 모델 ID가 아니라 등급 이름 — 실제 ID는 그때의 LIGHT_MODEL(Code.js 69줄)과 스크립트 속성 CX_GEMINI_MODEL에서 고른다.
//  (모델이 바뀌어도 이 표는 그대로. Sonnet·Opus(DEFAULT_MODEL)는 GAS 부분 호출에 쓰지 않는다 — 세무사님 지시)
//  [재점검 19] 실제로 생기는 쟁점 종류만 둔다 — 그림 다시 읽기는 3번(읽기) 세션 몫이라 뺐다. 짧은 글 대조(같은지)는 제미니가 동작 확인되면(속성 CX_GEMINI_MODEL) 그쪽, 아니면 light.
//   값고르기: 서류끼리 갈린 값 중 맞는 것(서류 뜻·앞뒤 사정) / 판단: 사건분류·관계·주택 여부 등 정황 / 빈칸: 서류 규칙이 못 찾은 값을 관련 사실에서 / 같은지: 이름·주소 표기 차이
const CX_AI_MODEL_ = { 값고르기: 'light', 판단: 'light', 빈칸: 'light', 같은지: 'gemini' };
function cxModelFor_(kind) {
  // [2026.10.19 보안] 같은지(이름·주소 표기)는 고객 자료 — 제미니 키가 무료 등급이면 하이쿠(LIGHT_MODEL)로 돌린다(geminiClientDataAllowed_, Code.js)
  if ((CX_AI_MODEL_[kind] || 'light') === 'gemini' && geminiClientDataAllowed_()) {
    let gm = ''; try { gm = PropertiesService.getScriptProperties().getProperty('CX_GEMINI_MODEL') || ''; } catch (e) {}
    if (gm && MODEL_CONFIG[gm] && MODEL_CONFIG[gm].provider === 'gemini') return gm;
  }
  return LIGHT_MODEL;
}
// 계산기에서 그 칸이 하는 일 — 쟁점 묶음 ⑤ (AI가 무엇을 위해 고르는지 알게)
const CX_ROLE_ = [
  [/totalPrice/, '양도가액(계약 전체) — 양도차익의 출발점'],
  [/acquisitionPrice/, '취득가액(실지거래가액) — 양도차익 = 양도가액 − 취득가액. 모르면 계산기가 매매사례·감정·환산으로 정함'],
  [/acquisitionDate/, '취득일 — 보유기간(장기보유특별공제율·단기 세율·1세대1주택 2년 요건)의 시작. 소득세법 §98·시행령 §162: 잔금청산일과 등기접수일 중 빠른 날, 증여는 증여등기 접수일, 상속은 상속개시일'],
  [/\.date$|^base$/, '양도일(기준일) — 신고기한·공시가격 연도·보유기간의 끝'],
  [/assetLocation/, '양도자산 소재지 — 공시가격·주택 여부·필지 묶음의 열쇠'],
  [/buyer\.relation/, '양수인과의 관계 — 특수관계면 부당행위계산(시가 비교)·이월과세 판정'],
  [/donorRelation/, '증여자와의 관계 — 배우자·직계존비속이면 이월과세(취득가액을 증여자 기준으로)'],
  [/assetType/, '주택 여부 — 1세대1주택·다주택 중과 판정'],
  [/사건분류/, '사건분류 — 비과세·중과·감면 체크(세율·공제가 달라짐)'],
  [/^ih:financial/, '금융재산 — 상속재산 가액·금융재산상속공제(상증법 §22)'],
  [/^ih:pg_/, '사전증여재산 — 상속세 과세가액에 더함(상증법 §13, 상속인 10년·그 외 5년)'],
  [/^ih:/, '상속재산 평가액 — 상속세 과세가액의 기초(시가 우선, 상증법 §60)'],
  [/giftAmount/, '증여재산가액 — 증여세 과세표준의 출발점'],
  [/giftRelation/, '증여자와의 관계 — 증여재산공제 한도·세대생략 할증'],
  [/seller\.|regNo|name$/, '신고서 인적사항 칸']
];
function cxRole_(target) { const t = String(target || ''); const r = CX_ROLE_.filter(function (x) { return x[0].test(t); })[0]; return r ? r[1] : '세액계산기 입력 칸'; }
// 사용자에게 바로 가는 질문(서류로는 원래 알 수 없는 사실) — AI에게 묻지 않는다
// [재점검 12·13] 사용자에게 바로 가는 것은 서류로는 원래 알 수 없는 사실만: 이 사무소 신고 세무비용(trTaxFee), 10년 안 다른 증여(국세청 자료, ov:giftPriorAmount), 서류 받기 표시·폴더.
//  기준일(base)·인수채무(giftDebtAssumed)는 서류(등기부·계약서·부채증명)로 알 수 있어 쟁점으로. 필요경비·채무 목록(expenses·debts)은 목록 확정이라 쟁점이 아님(목록 방식 질문)
const CX_USER_FACT_RE_ = /^(trTaxFee|ov:giftPriorAmount|evMark|folder)$/;
// AI가 정황으로 판단할 선택 질문(options) — 이 밖의 options(서류대로 제안하는 확인 질문·결정만)는 쟁점으로 바꾸지 않는다
// [재점검 13] 판단(선택) 질문 — 예전엔 다섯 칸만. 이제 계산기·처리개요·상속재산 칸을 겨냥한 선택 질문은 모두 쟁점(서류대로 제안한 확인 질문도 AI가 맥락으로 볼 수 있음)
const CX_JUDGE_OPT_RE_ = /^(ov:|calc:|ih:|tr[A-Z]|base$)/;

function cxHash_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s), Utilities.Charset.UTF_8)).slice(0, 12); }
function cxNormV_(v, input) {
  const s = String(v == null ? '' : v).trim();
  if (input === 'money' || input === 'number') return s.replace(/[^\d.-]/g, '');
  if (input === 'date') { const m = /(\d{4})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/.exec(s); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : s; }
  return s.replace(/\s+/g, '');
}
function cxReadCase_(id) {
  const sheet = work_getSheet_(), col = work_colMap_(sheet.getDataRange().getValues()[0]);
  const found = work_findCaseRow_(sheet, col, id);
  return found ? work_readRow_(col, found.row) : null;
}

// ── 사실(임시) — 임시 — cpFacts_ 들어오면 교체 ──
//  지금의 서류 정리 결과(caseProcParseAll_)를 공통 문서 3절 "사실 한 건" 모양으로 바꾼다. 칸 이름은 maps/사실종류_낱말표.md(1번 관리)를 따르되,
//  모르는 칸은 "기타:<서류 칸 이름>"으로 둔다. 판정은 하지 않는다(사실을 모으기만).
const CX_KIND_MAP_ = [
  [/^(소재지|주소지|부동산소재지|물건소재지|assetLocation)$/, '소재지'], [/^지번$/, '지번'], [/^(동호|호수|동|호)$/, '동호'], [/^(지목|용도|주용도)$/, '지목·용도'], [/면적/, '면적'],
  [/^(취득일|취득시기)$/, '취득일'], [/^(취득원인|원인)$/, '취득원인'], [/취득가액/, '취득가액'], [/^(양도일|양도시기)$/, '양도일'], [/양도가액/, '양도가액'], [/잔금일/, '잔금일'], [/^계약일$/, '계약일'],
  [/^(매매대금|거래가액|거래금액|매매가)$/, '매매대금'], [/^계약금/, '계약금'], [/^중도금/, '중도금'], [/^잔금$/, '잔금'], [/지분/, '지분'], [/(채권최고액)/, '근저당 채권최고액'], [/보증금/, '임대 보증금'], [/월세|차임/, '월세'],
  [/공시(가격|지가)|기준시가/, '공시가격'], [/감정(가액|평가액)/, '감정가액'], [/매매사례/, '매매사례가액'],
  [/^(성명|이름|name)$/, '성명'], [/주민(등록)?번호|regNo/, '주민번호'], [/생년월일/, '생년월일'], [/^관계$/, '관계'], [/사망(일|일자)/, '사망일'], [/증여일/, '증여일'],
  [/중개(보수|수수료)/, '중개보수'], [/법무사|보수액/, '법무사 비용'], [/취득세/, '취득세'], [/장례/, '장례비'], [/(합계|총액|금액)$/, '금액'], [/^(접수일|접수|일자|날짜|납부일)$/, '날짜']
];
function cxKindOf_(k) { const r = CX_KIND_MAP_.filter(function (x) { return x[0].test(k); })[0]; return r ? r[1] : '기타:' + k; }
function cxFactsFromParsed_(c) {
  const out = [];
  let all = [];
  try { all = caseProcParseAll_(c) || []; } catch (e) { all = []; }
  all.forEach(function (x, di) {
    const f = x.f || {}, p = x.p || {}, src0 = { fileId: f.id || '', file: f.name || '', docType: p.label || p.type || '', where: '', page: null, rec: '', part: x.famKey || '' };
    out.push({ kind: '서류', value: p.label || p.type || '', raw: '', src: src0, keys: {}, role: '', read: { how: '글자', conf: '확실', note: '' } });
    let n = 0;
    const walk = function (o, pathArr, rec, keys) {
      if (n > 400 || o == null) return;
      if (Array.isArray(o)) { o.slice(0, 200).forEach(function (v, i) { walk(v, pathArr.concat(['[' + i + ']']), (rec ? rec + '.' : '') + i, keys); }); return; }
      if (typeof o === 'object') {
        const k2 = Object.assign({}, keys);
        Object.keys(o).forEach(function (k) { const v = o[k]; if (v == null || typeof v === 'object') return; const kd = cxKindOf_(k); if (kd === '소재지') k2.asset = String(v); if (kd === '성명') k2.person = String(v).replace(/\s+/g, ''); if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) k2.date = k2.date || String(v); });
        Object.keys(o).forEach(function (k) { walk(o[k], pathArr.concat([k]), rec, k2); });
        return;
      }
      const key = pathArr.filter(function (s) { return !/^\[/.test(s); }).slice(-1)[0] || '';
      if (!key || /^(ok|type|label|sure|warn|_.*)$/.test(key)) return;
      const raw = String(o); if (!raw.trim() || raw.length > 200) return;
      const kind = cxKindOf_(key);
      let value = raw;
      if (typeof o === 'number' || /^-?[\d,]+원?$/.test(raw.trim())) value = Number(raw.replace(/[^\d.-]/g, '')) || 0;
      n++;
      out.push({ kind: kind, value: value, raw: raw, src: Object.assign({}, src0, { where: pathArr.join('.'), rec: rec }), keys: keys, role: '', read: { how: '글자', conf: /⚠|확인|불확실/.test(raw) ? '불확실' : '확실', note: '' } });
    };
    walk(p.result, [], '', {});
  });
  return out;
}

// ── 쟁점 만들기 — 질문 목록에서 "어느 값인가"를 묻는 것만 ──
function cxIssuesFromItems_(items) {
  const out = [];
  (items || []).forEach(function (it) {
    const a = it.ask || {}, mode = a.mode || '', t = String(a.target || (mode === 'base' ? 'base' : '')); // 기준일 질문은 target 없이 mode 'base'
    if (!a || !t || CX_USER_FACT_RE_.test(t) || /^cxai:/.test(it.id)) return;
    if ((a.options || []).some(function (o) { return o.decide; })) return; // 결정만 하는 선택(별건·무시 등)은 값 쟁점이 아님
    const cands = Array.isArray(a.cands) ? a.cands.filter(function (x) { return x && x.v != null && String(x.v).trim() !== ''; }) : [];
    const input = a.input || (mode === 'base' ? 'date' : 'text');
    if (mode === 'options') {
      if (!CX_JUDGE_OPT_RE_.test(t)) return;
      out.push({ iid: it.id, kind: '판단', target: t, label: a.label || '', input: 'option', text: it.text, detail: it.detail || '', options: (a.options || []).map(function (o) { return { v: String(o.value), label: String(o.label || o.value) }; }), cands: [] });
      return;
    }
    if (!/^(choose|input|base)$/.test(mode) || !/^(calc:|ov:|ih:|base$)/.test(t || (mode === 'base' ? 'base' : ''))) return; // [재점검 12] 기준일(base) 질문도 쟁점
    const uniq = []; cands.forEach(function (x) { const nv = cxNormV_(x.v, input); if (!uniq.some(function (u) { return u.n === nv; })) uniq.push({ n: nv, v: String(x.v), src: String(x.src || '') }); else { const u = uniq.filter(function (q) { return q.n === nv; })[0]; u.src += ' / ' + String(x.src || ''); } });
    if (uniq.length >= 2) out.push({ iid: it.id, kind: '값고르기', target: t, label: a.label || '', input: input, text: it.text, detail: it.detail || '', cands: uniq });
    else if (uniq.length === 1 && cands.length >= 2) out.push({ iid: it.id, kind: '값고르기', target: t, label: a.label || '', input: input, text: it.text, detail: it.detail || '', cands: uniq }); // 후보가 사실상 하나(같은 값 여러 출처) → GAS가 "일치"로 정함
    else if (!uniq.length && it.kind === 'missing') out.push({ iid: it.id, kind: '빈칸', target: t, label: a.label || '', input: input, text: it.text, detail: it.detail || '', cands: [] });
  });
  return out;
}

// ── GAS 객관 규칙(토큰 0) — 같은 값 · 검산 · 법령 정의(후보 출처 표시로 알 수 있을 때만). 맥락 판단은 넣지 않는다 ──
//  같은 서류의 사본은 독립 근거로 세지 않는다 — 후보가 하나로 모인 것은 "일치"일 뿐, 근거 수를 늘리지 않는다.
// 후보 값마다 사건 사실 중 같은 값을 가진 서류 종류(독립 근거) — 같은 서류 종류의 사본은 하나로, 공통 뽑기(불확실)는 세지 않음
// 날짜 칸은 그 칸에 해당하는 날짜 종류만 근거로 센다(같은 날 송금·발급된 다른 서류 날짜가 우연히 같아 "근거"가 되지 않게)
const CX_DATE_KINDS_ = { acquisitionDate: /^(취득일|잔금일|접수일|등기일|증여일|상속개시일|사망일)$/, date: /^(양도일|잔금일|접수일|등기일)$/, giftDate: /^(증여일|접수일|등기일)$/ };
// [재점검 10] 금액 칸마다 근거로 셀 사실 종류(낱말표) — 같은 금액이라도 다른 뜻(통장 잔액·보증금 등)은 세지 않음
function cxMoneyKinds_(target) {
  const t = String(target || '');
  if (/totalPrice/.test(t)) return /^(매매대금|양도가액|매매목록 거래가액|거래가액)$/;
  if (/acquisitionPrice/.test(t)) return /^(매매대금|취득가액|매매목록 거래가액|거래가액)$/;
  if (/StandardPrice|PricePerSqm|standardPrice/.test(t)) return /^공시가격$/;
  if (/^ih:financial/.test(t)) return /^(잔액|금융재산 줄)$/;
  if (/^ih:pg_|giftAmount|giftPrior/.test(t)) return /^(증여재산|증여재산가액|금액)$/;
  if (/^ih:/.test(t)) return /^(감정가액|공시가격|매매사례가액|매매대금)$/;
  if (/Debt|debt|채무/.test(t)) return /^(대출 잔액|채무|승계보증금|임대 보증금|잔액)$/;
  return null;
}
function cxSupport_(v, input, facts, target) {
  const n = cxNormV_(v, input), docs = {};
  if (!n || (input === 'money' && Number(n) < 100000)) return docs; // 작은 금액은 우연히 같은 값이 많아 근거로 안 셈
  const dk = input === 'date' ? (/acquisitionDate/.test(target) ? CX_DATE_KINDS_.acquisitionDate : /\.date$|^base$/.test(target) ? CX_DATE_KINDS_.date : CX_DATE_KINDS_.giftDate)
    : (input === 'money' || input === 'number') ? cxMoneyKinds_(target) : null;
  if ((input === 'money' || input === 'number') && !dk) return docs; // [재점검 10] 칸에 맞는 금액 종류를 모르면 우연히 같은 금액을 근거로 세지 않음
  (facts || []).forEach(function (f) {
    if (!f || !f.src || f.kind === '서류' || f._copy || typeof f.value === 'object' || (f.read && f.read.conf === '불확실')) return; // 사본(_copy)은 독립 근거 아님
    if (dk && !dk.test(f.kind)) return;
    if (cxNormV_(f.value, input) === n) docs[f.src.docType || '서류'] = (docs[f.src.docType || '서류'] || []).concat([f.src.file]);
  });
  return docs;
}
function cxJudge_(iss, facts) {
  if (iss.kind === '판단') { iss.why = '정황 판단(서류 뜻·앞뒤 사정) — AI 몫'; return null; }
  if (iss.kind === '빈칸') { iss.why = '서류 규칙이 그 칸 값을 못 찾음' + ((facts || []).length ? '' : '(사실 목록 없음)'); return null; }
  if (iss.kind !== '값고르기') return null;
  const cs = iss.cands;
  if (cs.length === 1) return { v: cs[0].v, why: '후보가 모두 같은 값(' + cs[0].src.slice(0, 80) + ')', rule: / \/ /.test(cs[0].src) ? '일치' : '단일 출처' }; // [재점검 14] 출처 하나면 단일 출처
  // 후보에 0원(= "없음·해당 아님")이 있으면 값 고르기가 아니라 있느냐 없느냐의 판단(사전증여·채무 등) — 금액이 서류에 나온다고 정할 수 없어 AI 몫
  if (cs.some(function (x) { return /^(money|number)$/.test(iss.input) && Number(cxNormV_(x.v, iss.input)) === 0; })) { iss.why = '0원(해당 없음) 후보가 있는 있음·없음 판단 — 정황 판단'; return null; }
  // 독립 서류 2종 이상이 같은 값이고 다른 후보는 1종 이하 — 사건 사실 전체에서 센다(질문 출처 글이 아니라)
  const sup = cs.map(function (x) { const d = cxSupport_(x.v, iss.input, facts, iss.target); return { x: x, n: Object.keys(d).length, docs: d }; });
  const strong = sup.filter(function (s) { return s.n >= 2; });
  if (strong.length === 1 && sup.every(function (s) { return s === strong[0] || s.n <= 1; })) return { v: strong[0].x.v, why: '서로 다른 서류 ' + strong[0].n + '종이 같은 값(' + Object.keys(strong[0].docs).join('·') + '), 다른 후보는 1종 이하', rule: '독립 서류 일치' };
  const ok = cs.filter(function (x) { return /검산\s*(일치|맞음|통과)/.test(x.src) && !/검산\s*안\s*됨/.test(x.src); });
  const bad = cs.filter(function (x) { return /검산\s*안\s*됨|검산\s*불일치|검산 못/.test(x.src); });
  if (ok.length === 1 && bad.length === cs.length - 1) return { v: ok[0].v, why: '검산이 맞는 후보는 하나뿐(' + ok[0].src.slice(0, 80) + ')', rule: '검산' };
  // 매매 취득·양도시기 = 잔금청산일과 등기접수일 중 빠른 날(소득세법 §98·시행령 §162①) — 후보 출처가 잔금·접수로만 나뉘고 증여·상속이 아닐 때만
  if (/acquisitionDate|\.date$/.test(iss.target) && cs.every(function (x) { return /잔금|접수/.test(x.src) && !/증여|상속|유증|분양|신축|수용/.test(x.src); }) && cs.some(function (x) { return /잔금/.test(x.src); }) && cs.some(function (x) { return /접수/.test(x.src); })) {
    const e = cs.slice().sort(function (a, b) { return a.n < b.n ? -1 : 1; })[0];
    return { v: e.v, why: '매매 취득·양도시기 = 잔금청산일과 등기접수일 중 빠른 날(소득세법 §98·시행령 §162①) — ' + e.src.slice(0, 60), rule: '법령 정의' };
  }
  // 못 푼 이유(표로 남김) — 객관 규칙이 왜 안 걸렸는지
  const tags = cs.map(function (x) { return /검산/.test(x.src) ? '검산' : /잔금|접수/.test(x.src) ? '날짜종류' : '없음'; });
  iss.why = strong.length >= 2 ? '여러 후보가 각각 서류 2종 이상으로 뒷받침됨(정황 판단 필요)'
    : sup.every(function (s) { return s.n <= 1; }) ? '후보마다 독립 서류 1종 이하' + (tags.every(function (t) { return t === '없음'; }) ? ', 출처 글에 검산·잔금·접수 표시 없음' : '')
    : '검산·법령 정의로 안 갈림';
  return null;
}

// ── 쟁점 묶음(AI에게 보낼 글) ──
function cxDocTextByName_(c, name) {
  if (!name) return '';
  try {
    const f = caseProcFiles_(c).filter(function (x) { return x.name === name; })[0];
    return f ? String(tc_docText_(f) || '') : '';
  } catch (e) { return ''; }
}
function cxValVariants_(v, input) {
  const s = String(v == null ? '' : v), out = [s];
  if (/^\d{5,}$/.test(s)) { out.push(Number(s).toLocaleString('ko-KR')); }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) { out.push(m[1] + '.' + m[2] + '.' + m[3], m[1] + '. ' + Number(m[2]) + '. ' + Number(m[3]), m[1] + '년 ' + Number(m[2]) + '월 ' + Number(m[3]) + '일', m[1].slice(2) + '.' + m[2] + '.' + m[3]); }
  return out.filter(function (x) { return x && x.length >= 4; });
}
// [2026.10.20 2번 밤샘 5바퀴 — ②-2 입체 재구성: 한 서류뿐인 사실 되찾기] 계산기에 쓰이는 금액(100만원 이상)·날짜 사실 중 사건 안 서류 하나에만 있는 것을,
//  다른 서류의 저장된 판독 글 전체에서 같은 값(쉼표·날짜 꼴 바꿔, cxValVariants_)으로 찾아 '되찾아 받침'으로 돌려준다. 결정(cxSupport_·cxJudge_)에는 쓰지 않는다 —
//  우연히 같은 숫자(다른 뜻)일 수 있어 근거 표시·AI 지휘(fact_map)·질문 출처 보강용. 앞으로의 사건: 서류 종류·양식과 무관(값 꼴만), 못 찾으면 한 서류 사실 그대로
const CX_REFIND_MONEY_ = /매매대금|거래가액|취득가액|양도가액|보상금|증여재산가액|증여가액|공시가격|기준시가|감정가액|채무|채권최고액|보증금|잔액|계약금|중도금|잔금|대금|공탁금|합계/;
const CX_REFIND_DATE_ = /^(계약일|잔금일|접수일|등기일|취득일|양도일|증여일|사망일|상속개시일|재결일|공탁일|사용승인일|전입일)$/;
function cxRefind_(c, facts, opt) {
  opt = opt || {};
  const key = function (x) { const d = CX_REFIND_DATE_.test(x.kind); return (d ? 'D|' : 'M|') + cxNormV_(x.value, d ? 'date' : 'money'); };
  const cand = (facts || []).filter(function (x) {
    if (!x || !x.src || x._copy || x.kind === '서류' || typeof x.value === 'object') return false;
    if (CX_REFIND_DATE_.test(x.kind)) return /^d{4}-d{2}-d{2}$/.test(cxNormV_(x.value, 'date'));
    return CX_REFIND_MONEY_.test(x.kind) && Number(cxNormV_(x.value, 'money')) >= 1000000;
  });
  const files = {}; cand.forEach(function (x) { const k = key(x); (files[k] = files[k] || {})[x.src.file] = 1; });
  const single = cand.filter(function (x) { return Object.keys(files[key(x)]).length === 1; });
  const seen = {}, uniq = single.filter(function (x) { const k = key(x); if (seen[k]) return false; seen[k] = 1; return true; });
  let texts = [];
  const prevNo = typeof TC_NO_NEW_OCR_ !== 'undefined' ? TC_NO_NEW_OCR_ : false; try { TC_NO_NEW_OCR_ = true; } catch (e) {} // 저장된 판독만(새 글자인식 안 함)
  // 독립 근거만 — 사실 목록이 입력으로 받은 서류(사무소 계산표·검토메모·결과물·참고자료는 cxFacts_가 이미 뺌)에서만 찾는다(같은 서류를 보고 만든 계산표는 받침이 아님)
  const inputFiles = {}; (facts || []).forEach(function (x) { if (x && x.src && x.src.file && !x._copy) inputFiles[x.src.file] = 1; });
  try { texts = caseProcFiles_(c).filter(function (f) { return inputFiles[f.name] && !/^_|^~\$/.test(f.name) && !caseProcIsOutputDocFor_(c, f.name, f.dir) && !/\.md$/i.test(f.name) && !/검\s*토|절\s*세|간\s*편\s*계\s*산|예\s*상\s*세|세\s*액\s*계\s*산/.test(f.name); }).map(function (f) { let t = ''; try { t = String(tc_docText_(f) || ''); } catch (e) {} return { name: f.name, text: t, flat: t.replace(/\s+/g, ' ') }; }).filter(function (x) { // 사무소가 만든 계산표·검토메모(사실 구획만 입력으로 받는 것 포함)는 같은 서류를 보고 만든 것 — 독립 받침 아님
    if (x.flat.length <= 20) return false; let oc = ''; try { oc = typeof caseProcOfficeCalcWhy_ === 'function' ? caseProcOfficeCalcWhy_(x.name, x.text) : ''; } catch (e) {} return !oc; }); } catch (e) { texts = []; } try { TC_NO_NEW_OCR_ = prevNo; } catch (e) {}
  const out = [];
  uniq.slice(0, opt.max || 300).forEach(function (x) {
    const d = CX_REFIND_DATE_.test(x.kind), n = cxNormV_(x.value, d ? 'date' : 'money');
    const vars = cxValVariants_(n, d ? 'date' : 'money').filter(function (v) { return d || /,/.test(v) || v.length >= 7; });
    const hits = [];
    texts.forEach(function (t) {
      if (t.name === x.src.file || hits.length >= 3) return;
      for (let i = 0; i < vars.length; i++) { const at = t.flat.indexOf(vars[i]); if (at >= 0 && !/d/.test(t.flat.charAt(at + vars[i].length)) && !/d/.test(t.flat.charAt(at - 1))) { hits.push({ file: t.name, near: t.flat.slice(Math.max(0, at - 40), at + vars[i].length + 40) }); break; } }
    });
    if (hits.length) out.push({ kind: x.kind, value: n, file: x.src.file, also: hits });
  });
  return { candidates: cand.length, single: uniq.length, refound: out.length, list: out };
}
// 출처 서류 원문에서 그 값 앞뒤 몇 줄(없으면 서류 앞부분 조금)
function cxSnippets_(c, iss, files, extraWords) {
  const out = [];
  files.slice(0, 4).forEach(function (fn) {
    const t = cxDocTextByName_(c, fn); if (!t) return;
    const words = [];
    iss.cands.forEach(function (x) { cxValVariants_(x.v, iss.input).forEach(function (w) { words.push(w); }); });
    (extraWords || []).forEach(function (w) { if (w && String(w).length >= 2) words.push(String(w)); });
    const hits = [];
    words.forEach(function (w) { let i = t.indexOf(w), k = 0; while (i >= 0 && k < 2) { hits.push(i); i = t.indexOf(w, i + w.length); k++; } });
    hits.sort(function (a, b) { return a - b; });
    const segs = []; hits.forEach(function (i) { const a = Math.max(0, i - 160), b = Math.min(t.length, i + 160); const last = segs[segs.length - 1]; if (last && a <= last[1]) last[1] = Math.max(last[1], b); else segs.push([a, b]); });
    const body = segs.length ? segs.slice(0, 4).map(function (s) { return '…' + t.slice(s[0], s[1]).replace(/\s+/g, ' ') + '…'; }).join('\n') : t.slice(0, 300).replace(/\s+/g, ' ') + '…';
    out.push('[' + fn + ']\n' + body);
  });
  return out.join('\n');
}
function cxFilesIn_(c, s) {
  const names = []; try { caseProcFiles_(c).forEach(function (f) { if (f.name && String(s).indexOf(f.name) !== -1 && names.indexOf(f.name) === -1) names.push(f.name); }); } catch (e) {}
  return names;
}
function cxCaseSummary_(c, facts) {
  const ov = c.사건개요 || {}, sv = caseProcLoad_(c.id) || {}, st = sv.trCalc && sv.trCalc.state;
  const L = ['세목 ' + (CASEPROC_TAX_LABEL_[c.세목] || c.세목) + ' · 업무 ' + (c.업무유형 || '') + ' · 납세자 ' + (c.납세자 || '') + ' · 고객 ' + (c.고객명 || '') + (c.기준일 ? ' · 기준일 ' + c.기준일 : '')];
  if (st) (st.transferAssets || []).slice(0, 6).forEach(function (a, i) { const ct = (st.transferContracts || []).filter(function (x) { return x.id === a.transferContractId; })[0] || {}; L.push('자산' + (i + 1) + ' ' + (a.assetLocation || '?') + ' · 양도 ' + (ct.date || '?') + ' ' + (ct.totalPrice ? Number(ct.totalPrice).toLocaleString('ko-KR') + '원' : '') + ' · 취득 ' + (a.acquisitionDate || '?') + ' ' + (a.acquisitionPrice ? Number(a.acquisitionPrice).toLocaleString('ko-KR') + '원' : '')); });
  ['ihDeceasedName', 'ihDeathDate', '상속인수', 'giftDonorName', 'giftDoneeName', 'giftAmount', 'giftRelation', '사건분류'].forEach(function (k) { if (ov[k] != null && String(ov[k]).trim() && typeof ov[k] !== 'object') L.push(k + ': ' + ov[k]); });
  const people = {}; (facts || []).forEach(function (f) { if (f.kind === '성명' && f.value) people[String(f.value).replace(/\s+/g, '')] = (people[String(f.value).replace(/\s+/g, '')] || 0) + 1; });
  const pl = Object.keys(people).sort(function (a, b) { return people[b] - people[a]; }).slice(0, 8); if (pl.length) L.push('서류에 나온 사람: ' + pl.join(', '));
  const docs = {}; (facts || []).forEach(function (f) { if (f.kind === '서류' && f.value) docs[f.value] = (docs[f.value] || 0) + 1; });
  const dl = Object.keys(docs); if (dl.length) L.push('서류 종류: ' + dl.slice(0, 20).map(function (k) { return k + (docs[k] > 1 ? '×' + docs[k] : ''); }).join(', '));
  try { const ihs = typeof cxInhSummary_ === 'function' ? cxInhSummary_(c) : ''; if (ihs) L.push(ihs); } catch (e) {} // [밤 28바퀴] 상속 금액 칸 요약
  return cxMask_(L.join('\n').slice(0, 1600)); // [재점검 4] 묶음은 만들 때 가린다
}
// [재점검 5] 쟁점 칸 → 근거가 될 사실 종류(낱말표 이름). 판단(사건분류·관계·주택 여부)은 그 판단에 쓰이는 서류 사실, 빈칸은 그 칸 값 종류
const CX_CTX_KINDS_ = [
  [/사건분류/, /^(지목·용도|주소|주소 대응|등기 원인|취득원인|사용승인일|상호|업종|개업일|관계|공시가격|근저당 채권최고액)$/], // [밤 29바퀴] 증여 부담부 판단 재료(을구 근저당)
  [/relation|Relation|관계/, /^(성명|관계|주민번호|생년월일|주소)$/],
  [/assetType|주택/, /^(지목·용도|전유면적|건물면적|사용승인일)$/],
  [/acquisitionDate|\.date$|^base$|Date/, /^(취득일|양도일|잔금일|접수일|등기일|증여일|사망일|상속개시일|계약일)$/],
  [/Price|price|Amount|amount|ih:/, /^(매매대금|취득가액|양도가액|매매목록 거래가액|감정가액|공시가격|매매사례가액|잔액|증여재산가액)$/],
  [/regNo|RegNo/, /^(주민번호|생년월일|성명)$/], [/address|Address|Location/, /^(주소|소재지|주소 대응)$/], [/Area|area/, /^(토지면적|건물면적|전유면적|대지권면적)$/]
];
function cxContextFor_(iss, facts) {
  const r = CX_CTX_KINDS_.filter(function (x) { return x[0].test(iss.target); })[0]; if (!r) return '';
  const seen = {}, out = [], grp = {};
  const judge = /사건분류|relation|Relation|관계/.test(iss.target);
  (facts || []).forEach(function (f) {
    if (!f || !f.src || f._copy || !r[1].test(f.kind) || typeof f.value === 'object') return;
    // [밤 33바퀴 묶음만 보고 판단] 영수증·견적서·세금계산서의 주소·상호는 공급자(업체·우리 사무소) 것 — 판단 재료가 아닌데 14줄을 채웠다(개발용 고객Q·고객X·고객AM·고객AV)
    if (judge && /^(주소|상호)$/.test(f.kind) && /견적서|영수증|세금계산서|카드|지출증빙/.test(String(f.src.docType || ''))) return;
    const k = f.kind + '|' + f.raw + '|' + (f.src.docType || ''); if (seen[k]) return; seen[k] = 1; // 같은 서류 종류·같은 값(사본)은 한 번만
    // [밤 33바퀴] 같은 서류의 같은 종류 값(근저당 채권최고액 12줄·표제부 용도 14줄)은 한 줄로 — 주소는 누구 주소인지 원문 앞뒤가 필요해 줄마다 둔다
    const gk = f.kind + '|' + (f.src.fileId || f.src.file);
    if (!/^주소/.test(f.kind) && grp[gk]) { grp[gk].vals.push(String(f.raw)); return; }
    if (out.length >= 14) return;
    const line = { f: f, vals: [String(f.raw)] }; out.push(line); if (!/^주소/.test(f.kind)) grp[gk] = line;
  });
  out.forEach(function (x, i) {
    const f = x.f, v = x.vals.length > 1 ? x.vals.slice(0, 6).join(' · ') + (x.vals.length > 6 ? ' 외 ' + (x.vals.length - 6) + '개' : '') + ' (' + x.vals.length + '개)' : x.vals[0];
    out[i] = '- ' + f.kind + ' ' + v + ' (' + (f.src.docType || '서류') + ' ' + f.src.file + (f.read && f.read.conf === '불확실' ? ', 판독 불확실' : '') + ')' + (x.vals.length === 1 && f.src.near ? ' 원문: …' + String(f.src.near).replace(/\s+/g, ' ').slice(0, 120) + '…' : '');
  });
  let own = '';
  try { if (/사건분류|assetType|donorRelation|relation|Relation|주택/.test(iss.target)) own = cxOwnerAssets_(facts, iss._taxpayer || ''); } catch (e) {}
  try { if (/사건분류|assetType|주택/.test(iss.target)) { const cl = cxContractList_(facts); if (cl) own = (own ? own + '\n' : '') + cl; } } catch (e) {}
  try { if (/사건분류|buyer|relation/.test(iss.target) && typeof cxTrJudgeMaterials_ === 'function') { const tm = cxTrJudgeMaterials_(iss._case || {}, facts); if (tm) own = (own ? own + '\n' : '') + tm; } } catch (e) {} // [밤 25바퀴] 저가양도·거주·재촌자경 재료
  // [밤 33바퀴] GAS가 정리한 판단 재료(명의 등기·계약서 목록·저가양도·거주)를 앞에 — 뒤에 두면 묶음 글 자르기에 먼저 잘렸다
  return (own ? own : '') + (out.length ? (own ? '\n' : '') + '관련 사실(사건 사실 목록에서 이 칸·판단에 쓰이는 종류):\n' + out.join('\n') : '');
}
// [2026.10.19 밤 9바퀴 계산기에서 거꾸로] 사건분류(일시적 2주택·대체취득 등)는 "다른 집을 언제 샀나"로 갈린다 — 서류 속 매매계약서마다 자산·계약일·잔금일·당사자(원문 그대로)를
//  판단 재료로 붙인다. 당사자 역할 판독이 자주 틀려(매수인 이름이 매도인으로 읽힘) GAS가 "납세자가 샀다"고 정하지 않고 AI·세무사가 본다(개발용 고객AF: 신규주택 취득 계약서만 있는 사건)
function cxContractList_(facts) {
  const cons = typeof cxContracts_ === 'function' ? cxContracts_(facts || [], '') : [];
  if (!cons.length) return '';
  const seen = {};
  const L = cons.filter(function (x) { const s = (x.total || '') + '|' + (x.balDate || '') + '|' + (x.date || ''); if (seen[s]) return false; seen[s] = 1; return true; }).slice(0, 6).map(function (x) {
    const inFile = (facts || []).filter(function (f) { return f && f.src && (f.src.fileId || f.src.file) === x.fid && !f._copy; });
    const loc = inFile.filter(function (f) { return f.kind === '소재지'; })[0];
    const ppl = {};
    inFile.forEach(function (f) { if (f.kind === '성명' && /^(매도인|매수인|양도인|양수인)$/.test(String(f.role || ''))) { const L2 = ppl[f.role] = ppl[f.role] || []; if (L2.indexOf(String(f.value)) === -1) L2.push(String(f.value)); } });
    const same = (ppl['매도인'] || []).some(function (n) { return (ppl['매수인'] || []).indexOf(n) !== -1; }); // 한 사람이 매도인·매수인 둘 다로 읽힘 = 역할 판독이 틀림(개발용 3건 되풀이)
    return '- ' + (loc ? String(loc.raw || loc.value).slice(0, 60) : '자산?') + ' · 계약일 ' + (x.date || '?') + ' · 잔금일 ' + (x.balDate || '?') + ' · 매매대금 ' + (x.total ? Number(x.total).toLocaleString('ko-KR') : '?') + (x.checked ? '(검산 일치)' : '') + // 단위는 안 붙임(외화 정산서도 있음)
      (Object.keys(ppl).length ? ' · ' + Object.keys(ppl).map(function (r) { return r + ' ' + ppl[r].join(','); }).join(' / ') + (same ? '(역할 판독 의심 — 같은 이름이 양쪽)' : '(판독 그대로)') : '') + ' (' + (x.doc || '계약서') + ' ' + x.file + ')';
  });
  return '서류 속 매매계약서(이 사건 양도분인지·다른 집 취득인지는 판단 몫 — 일시적 2주택·대체취득 판단 재료):\n' + L.join('\n');
}
// [2026.10.19 밤 6바퀴 법령 판단] 판단의 바탕 사실을 정리해 AI 쟁점 묶음에 넣는다(판정은 안 함 — 1세대1주택·중과·이월과세는 맥락 판단).
//  등기부 소유권 줄 중 납세자가 권리자인 것(어느 자산이든)과 그 줄의 원인·접수일, 증여·상속 원인이면 바로 앞 줄 권리자(증여자·피상속인 후보)
function cxOwnerAssets_(facts, taxpayer) {
  const rows = {};
  (facts || []).forEach(function (f) {
    if (!f || !f.src || f._copy || (f.read && f.read.conf === '불확실')) return;
    const m = /^(.*?소유권이력)(\d+)/.exec(String(f.src.rec || '')); if (!m) return;
    const k = (f.src.fileId || f.src.file) + '#' + m[1] + m[2], x = rows[k] = rows[k] || { file: f.src.file, base: (f.src.fileId || f.src.file) + '#' + m[1], no: Number(m[2]), names: [], asset: '' };
    if (f.kind === '접수일') x.date = String(f.value); else if (f.kind === '등기 원인' || f.kind === '취득원인') x.cause = String(f.value); else if (f.kind === '성명') x.names.push(String(f.value).replace(/\s+/g, ''));
    if (!x.asset && f.keys && f.keys.asset) x.asset = String(f.keys.asset);
  });
  const all = Object.keys(rows).map(function (k) { return rows[k]; });
  const tp = String(taxpayer || '').replace(/\s+/g, '');
  const mine = all.filter(function (r) { return tp ? r.names.indexOf(tp) !== -1 : false; });
  if (!mine.length) return '';
  const seen = {};
  const L = mine.filter(function (r) { const s = r.asset + '|' + r.date + '|' + r.cause; if (seen[s]) return false; seen[s] = 1; return true; }).map(function (r) {
    const prev = all.filter(function (p) { return p.base === r.base && p.no === r.no - 1; })[0];
    return '- ' + (r.asset || '자산?') + ' · ' + (r.cause || '원인?') + ' ' + (r.date || '날짜?') + (prev && /증여|상속|유증/.test(r.cause || '') ? ' · 앞 권리자 ' + prev.names.join(',') : '') + ' (등기부 ' + r.file + ')';
  });
  return '납세자(' + tp + ') 명의 소유권 등기(어느 자산이든 — 주택 수·이월과세 판단 재료):\n' + L.slice(0, 10).join('\n');
}
// 쟁점 하나의 묶음 글 — ② 물린 사실 ③ 원문 앞뒤 ④ 못 푼 이유 ⑤ 칸의 쓰임
function cxIssueText_(c, iss, facts, more) {
  const files = cxFilesIn_(c, iss.cands.map(function (x) { return x.src; }).join(' ') + ' ' + iss.text + ' ' + iss.detail);
  const related = (facts || []).filter(function (f) { return f.kind !== '서류' && f.src && typeof f.value !== 'object' && (files.indexOf(f.src.file) !== -1) && iss.cands.some(function (x) { return cxNormV_(x.v, iss.input) === cxNormV_(f.value, iss.input); }); }).slice(0, 12)
    .map(function (f) { return '- ' + f.kind + ' ' + f.raw + ' (' + f.src.file + ' ' + String(f.src.where || '').slice(0, 40) + (f.read && f.read.conf === '불확실' ? ', 판독 불확실' + (f.read.note ? ': ' + String(f.read.note).slice(0, 40) : '') : '') + ')' + (f.src.near ? '\n  원문: …' + String(f.src.near).replace(/\s+/g, ' ').slice(0, 160) + '…' : ''); });
  let snip = files.length ? cxSnippets_(c, iss, files, (more || {}).words) : '';
  if (iss.kind === '빈칸' && !files.length) {
    // 후보 없는 빈 칸 — 종류를 못 정한(미분류) 서류의 앞부분을 붙인다(그 안에 값이 있을 수 있음)
    try {
      const typed = {}; (facts || []).forEach(function (f) { if (f.kind === '서류' && f.src && !/종류\s*미정|못\s*읽음|대기/.test(String(f.value))) typed[f.src.file] = 1; }); // 낱말표: 서류 value = 종류 이름 | 종류 미정 | 제외 | 못 읽음 | 대기
      const und = caseProcFiles_(c).filter(function (f) { return /pdf|^image\//.test(String(f.mimeType || '')) && !/^_/.test(f.name) && !typed[f.name] && !caseProcIsOutputDocFor_(c, f.name, f.dir); }).slice(0, 3);
      snip = und.map(function (f) { return '[' + f.name + '(종류 못 정함)]\n' + String(tc_docText_(f) || '').slice(0, 600).replace(/\s+/g, ' '); }).join('\n');
    } catch (e) {}
  }
  // [2026.10.18 재점검 5] 판단·빈칸 쟁점에도 AI가 읽을 근거를 — 그 칸을 담을 법한 사실 종류의 값과 원문 앞뒤(src.near)를 붙인다(예전엔 근거가 없다고 AI를 건너뛰었다)
  iss._srcSnip = !!snip; // [밤 24바퀴] 관련 사실을 붙이기 전 — 값이 있을 법한 원문(후보 서류 앞뒤·종류 못 정한 서류)이 있었는지
  iss._taxpayer = iss._taxpayer || String(c.납세자 || ''); // 판단 묶음에 납세자 명의 등기 목록을 붙이려고
  iss._case = { 세목: c.세목, 기준일: c.기준일, 납세자: c.납세자 }; // [밤 25바퀴] 양도 판단 재료(양도일 기준 기준시가·매도인)
  const ctx = cxContextFor_(iss, facts);
  // [밤 33바퀴] 판단 재료(ctx)는 원문 앞뒤와 따로 — 예전엔 원문 뒤에 붙여 2,400자에서 함께 잘려 명의 등기·계약서 목록·저가양도 줄이 빠졌다(개발용 고객L·고객J·고객X·고객Z)
  if (more && more.files) more.files.forEach(function (fn) { const t = cxDocTextByName_(c, fn); if (t) snip += '\n[' + fn + ' — 더 보기]\n' + t.slice(0, 800).replace(/\s+/g, ' '); });
  const L = ['### 쟁점 ' + iss.iid + ' (' + iss.kind + ') — ' + (iss.label || iss.target), '칸: ' + iss.target + ' — ' + cxRole_(iss.target), '도구 질문: ' + String(iss.text).slice(0, 400)];
  if (iss.detail) L.push('도구 설명: ' + String(iss.detail).slice(0, 800)); // [밤 33바퀴] 300자에서 다른 주택·지분별 취득 줄이 잘렸다(개발용 고객L·고객J·고객X)
  if (iss.cands.length) L.push('후보:\n' + iss.cands.map(function (x, i) { return (i + 1) + ') ' + x.v + ' — 출처: ' + x.src.slice(0, 200); }).join('\n'));
  if (iss.options) L.push('선택지: ' + iss.options.map(function (o) { return o.v + (o.label !== o.v ? '(' + o.label.slice(0, 60) + ')' : ''); }).join(' / '));
  L.push('GAS가 못 푼 이유: ' + (iss.kind === '값고르기' ? '후보가 서로 다르고, 검산·법령 정의만으로 하나로 안 정해짐' : iss.kind === '판단' ? '서류의 정황을 읽어야 하는 판단' : '서류 규칙으로 값을 못 찾음'));
  if (related.length) L.push('같은 값이 나온 사실:\n' + related.join('\n'));
  if (snip) L.push('원문(앞뒤):\n' + snip.slice(0, 2400));
  if (ctx) L.push(ctx.slice(0, 3200));
  return cxMask_(L.join('\n')); // [재점검 4] 묶음은 만들 때 가린다 — 기록(물은 것)·글자 수·전송 모두 가린 글
}
// 폴더 전체 글자 수(비교용 — 통째로 보냈다면)
function cxFolderChars_(c) {
  let n = 0;
  try { caseProcFiles_(c).forEach(function (f) { if (/^_|^~\$/.test(f.name) || caseProcIsOutputDocFor_(c, f.name, f.dir)) return; try { n += String(tc_docText_(f) || '').length; } catch (e) {} }); } catch (e) {}
  return n;
}

// ── AI 호출 — 2026-10-19 세무사님 허락(원문): "2번 세션이 사건처리 쟁점 묶음을 하이쿠·제미니로 자동 전송하는 코드를 쓸 수 있게 … 주민번호·전화번호·계좌번호는
//  가려서 보내는 조건이다." 운영에서 실제로 보내는 것은 세무사님 승인 뒤 — 스크립트 속성 CX_AI_AUTO = "켜기"일 때만 보낸다(기본은 꺼짐).
//  · 보내는 것은 쟁점 묶음뿐(사건 폴더 통째 아님). 보내기 직전 이 한 곳(cxCallAi_ 첫 줄)에서 cxMask_로 다시 가린다(묶음 만들 때 이미 가렸어도 한 번 더)
//  · 사건당 모델마다 한 번 + "더 볼 것"이 있으면 한 번 더(쟁점당 최대 2번), 같은 글이면 6시간 캐시, 같은 쟁점·같은 사실이면 다시 묻지 않음(sv.cxAi.asked)
//  · 모델은 기존 모델 표에서 쟁점 종류별로(cxModelFor_: LIGHT_MODEL=하이쿠, 표기 대조만 속성 CX_GEMINI_MODEL의 제미니 2.5 계열). 불확실하면 비싼 모델로 올리지 않고 사용자에게
//  · 🧪 점검기·재현기(CX_AI_DRY_)에서는 보내지 않고 보낼 묶음만 기록
function cxAiOn_() {
  if (CX_AI_DRY_) return false;
  try { return String(PropertiesService.getScriptProperties().getProperty('CX_AI_AUTO') || '') === '켜기'; } catch (e) { return false; }
}
const CX_AI_SYSTEM_ = '너는 세무사 사무실의 사건처리 도우미다. 아래는 GAS(규칙 프로그램)가 서류를 맞대어 보고도 하나로 정하지 못한 쟁점들이다. 쟁점마다 주어진 서류 원문·후보·출처만 근거로 판단하라.\n'
  + '규칙: (1) 자료에 없는 사실은 지어내지 말고 sure를 "불확실"로. 서류에 없는 사실(실제 지급액·가족 사정·이전 증여 등)이면 value를 비우고 why에 "서류에 없음". (2) 값고르기는 후보 값 중 하나를 그대로, 판단은 선택지 값 중 하나를, 빈칸은 원문에 실제로 있는 값(금액은 원 정수, 날짜는 YYYY-MM-DD)을 value로. (3) why에는 어느 서류 어느 부분을 근거로 했는지 한두 문장, 그 부분 글자를 quote에 그대로. (4) 더 볼 서류·부분이 있으면 need에 파일 이름이나 찾을 낱말(없으면 빈 배열). (5) 가려진 번호(***)는 추측하지 마라.\n'
  + '답은 JSON 배열 하나만: [{"id":"쟁점 id","value":"…","sure":"확실|불확실","why":"…","quote":"…","need":["…"]}]';
function cxCallAi_(model, user) {
  user = cxMask_(user); // ← 보내기 직전 가리기(세무사님 조건). 이 아래에서 user 외의 사건 글은 보내지 않는다
  const cfg = MODEL_CONFIG[model] || {};
  const cache = CacheService.getScriptCache(), ck = 'cxai_' + cxHash_(model + '\n' + user);
  const hit = cache.get(ck); if (hit) return { text: hit, usd: 0, cached: true };
  let txt = '', usd = 0;
  if (cfg.provider === 'gemini') {
    if (!geminiClientDataAllowed_()) return { error: GEMINI_CLIENT_BLOCK_MSG_ }; // [2026.10.19 보안] 쟁점 묶음은 고객 자료
    const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key) return { error: 'GEMINI_API_KEY 없음' };
    const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: user }] }], systemInstruction: { parts: [{ text: CX_AI_SYSTEM_ }] }, generationConfig: { maxOutputTokens: 3000 } }) });
    let j = {}; try { j = JSON.parse(res.getContentText() || '{}'); } catch (e) {}
    if (res.getResponseCode() !== 200) return { error: (j.error && j.error.message) || ('Gemini ' + res.getResponseCode()) };
    txt = (((((j.candidates || [])[0] || {}).content || {}).parts) || []).map(function (p) { return p.text || ''; }).join('\n');
    const u = j.usageMetadata || {};
    usd = ((u.promptTokenCount || 0) / 1e6) * (cfg.input || 0) + (((u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0)) / 1e6) * (cfg.output || 0);
  } else {
    const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) return { error: 'ANTHROPIC_API_KEY 없음' };
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, muteHttpExceptions: true,
      payload: JSON.stringify({ model: model, max_tokens: 3000, system: CX_AI_SYSTEM_, messages: [{ role: 'user', content: user }] }) });
    let j = {}; try { j = JSON.parse(res.getContentText() || '{}'); } catch (e) {}
    if (j.error) return { error: 'AI 호출 실패: ' + (j.error.message || '') };
    txt = (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
    try { usd = buildClaudeUsageInfo_(j, cfg, model, null).costUsd || 0; } catch (e) {}
  }
  try { if (txt && txt.length < 90000) cache.put(ck, txt, 21600); } catch (e) {}
  return { text: txt, usd: usd };
}
function cxParseAnswers_(text) {
  const s = String(text || ''), a = s.indexOf('['), b = s.lastIndexOf(']');
  if (a < 0 || b <= a) return [];
  try { const arr = JSON.parse(s.slice(a, b + 1)); return Array.isArray(arr) ? arr.filter(function (x) { return x && x.id; }) : []; } catch (e) { return []; }
}
// AI 답이 그 쟁점에 쓸 수 있는 값인지 — 후보·선택지 밖의 값, 형식이 안 맞는 값은 불확실로
// [재점검 20] 빈칸에 AI가 낸 값은 보낸 원문(쟁점 묶음 글)에 실제로 있는지 GAS가 확인(토큰 0)한 뒤에만 — 원문에 없는 값은 지어낸 것으로 보고 반영하지 않음
function cxValidAnswer_(iss, ans, sentText) {
  const v = String(ans.value == null ? '' : ans.value).trim();
  if (!v) return null;
  if (iss.kind === '값고르기') { const hit = iss.cands.filter(function (x) { return cxNormV_(x.v, iss.input) === cxNormV_(v, iss.input); })[0]; return hit ? hit.v : null; }
  if (iss.kind === '판단') { const o = iss.options.filter(function (o) { return o.v === v || o.label === v || o.label.indexOf(v) === 0; })[0]; return o ? o.v : null; }
  let d = v;
  if (iss.input === 'money' || iss.input === 'number') { d = v.replace(/[^\d]/g, ''); if (!d) return null; }
  else if (iss.input === 'date') { d = cxNormV_(v, 'date'); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null; }
  const T = String(sentText || '');
  if (T && !cxValVariants_(d, iss.input).some(function (w) { return T.indexOf(w) !== -1; }) && T.indexOf(v) === -1) return null; // 원문에 없는 값
  return d;
}

// ── 사건 사실 — 1번 세션 cpFacts_(없으면 임시 변환). 결과물·이전 보고서·참고자료·사무소 계산표(read.use "제외 후보")는 입력으로 쓰지 않는다(블라인드 원칙),
//  단 경정·수정·불복 사건의 당초 신고서는 입력(기신고서가 입력 — 세무사님 원칙). 한 실행 안에서는 한 번만 만든다(2분 메모)
var CX_FACTS_MEMO_ = null;
function cxFacts_(cc) {
  if (CX_FACTS_MEMO_ && CX_FACTS_MEMO_.id === cc.id && Date.now() - CX_FACTS_MEMO_.at < 120000) return CX_FACTS_MEMO_.f;
  let all = [];
  try { const fx = typeof cpFacts_ === 'function' ? cpFacts_(cc) : cxFactsFromParsed_(cc); all = Array.isArray(fx) ? fx : (fx && Array.isArray(fx.facts) ? fx.facts : []); } catch (e) { try { all = cxFactsFromParsed_(cc); } catch (e2) { all = []; } }
  const amend = /경정|수정|불복/.test(String(cc.업무유형 || '') + String(cc._세목작업관리 || ''));
  const f = all.filter(function (x) { if (!x || !x.read || !x.read.use) return true; return amend && /신고서|결과물/.test(String(x.read.use)) && !/보고서|계산표|참고/.test(String(x.read.use)); });
  cxMarkCopies_(f);
  CX_FACTS_MEMO_ = { id: cc.id, at: Date.now(), f: f };
  return f;
}
// [2026.10.19 받는 자리 — 3번 세션 사본 표시] 홈택스 첨부 묶음 PDF 안의 구간과 낱장 파일이 같은 서류인 경우가 많다(첨부 개수 한도로 묶고 이름 앞에 일련번호).
//  3번의 tcCopyMarks_(items)가 낱장을 남기고 다른 쪽에 copyOf를 붙인다(vision 가지, 운영 전). 그 표시가 사실에 실려 오면(src.copyOf · read.copyOf · 서류 사실의 copyOf)
//  그 파일(구간)의 사실에 _copy를 붙여, 교차검증의 독립 근거 세기(cxGraph_·cxSupport_·cxContracts_·cxRegRows_·cxContextFor_·cxgValueCheck_)에서 뺀다.
//  표시가 아직 안 오면 아무것도 바꾸지 않는다(지금은 같은 서류 종류·같은 값을 근거 하나로 세는 것으로 사본을 막고 있음)
function cxCopyKey_(src) { return String((src && src.file) || '') + '#' + String((src && src.part) || ''); }
function cxMarkCopies_(facts) {
  const copy = {};
  (facts || []).forEach(function (x) { if (!x || !x.src) return; if (x.src.copyOf || (x.read && x.read.copyOf) || (x.kind === '서류' && x.copyOf)) copy[cxCopyKey_(x.src)] = String(x.src.copyOf || (x.read && x.read.copyOf) || x.copyOf); });
  if (!Object.keys(copy).length) return 0;
  let n = 0;
  (facts || []).forEach(function (x) { if (x && x.src && copy[cxCopyKey_(x.src)]) { x._copy = copy[cxCopyKey_(x.src)]; n++; } });
  return n;
}
// ── 사이드바 답 쌓기(CrossCheckAsk.js cxAnswerRecord_가 만든 한 건) — 업무관리자 폴더 "_사건처리답기록.json"(유료질문기록 옆), 최근 5000건 ──
//  반복되는 답(같은 칸·같은 출처 종류를 늘 고름 등)은 정기 점검이 규칙 후보로 본다(세무사님 원문 9·10 누적 관리)
function cxLogUserAnswer_(rec) {
  if (!rec || CX_AI_DRY_) return false;
  try {
    return withLock_(5000, function () {
      let folder = null; try { const pf = ai_paidLogFile_(), ps = pf.getParents(); folder = ps.hasNext() ? ps.next() : null; } catch (e) {}
      if (!folder) return false;
      const it = folder.getFilesByName('_사건처리답기록.json'), f = it.hasNext() ? it.next() : folder.createFile('_사건처리답기록.json', '[]', 'application/json');
      let arr = []; try { arr = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '[]'); } catch (e) { arr = []; }
      arr.push(JSON.parse(cxMask_(JSON.stringify(rec)))); // 답 기록에도 주민번호·전화·계좌는 가림
      f.setContent(JSON.stringify(arr.slice(-5000)));
      return true;
    });
  } catch (e) { return false; }
}
// ── 처리개요 끝에서 부름 — r(처리개요 결과: lines·items·case)를 고쳐서 돌려준다 ──
function cxResolve_(c, r) {
  if (CX_IN_ || !r || !r.ok) return r;
  CX_IN_ = true;
  try { return cxResolve0_(c, r); } finally { CX_IN_ = false; }
}
function cxResolve0_(c, r) {
  const cc = r.case || c, lines = r.lines = r.lines || [], items = r.items = r.items || [];
  const sv = caseProcLoad_(cc.id) || {}, store = sv.cxAi || { applied: {}, asked: {} };
  const aiOn = cxAiOn_(); // 스크립트 속성 CX_AI_AUTO = "켜기"일 때만(기본 꺼짐), 점검·재현기는 늘 꺼짐
  const rec = { caseId: cc.id, issues: [], gas: [], ai: [], user: [], bundleChars: 0, folderChars: 0, calls: 0, usd: 0, dry: !aiOn, why: CX_AI_DRY_ ? '점검 중' : (aiOn ? '' : 'AI 자동 묻기 꺼짐 — 스크립트 속성 CX_AI_AUTO를 "켜기"로 하면 보냄') };
  CX_LAST_ = rec;
  // 0) 이미 AI가 정한 칸 — 사용자가 다른 값으로 고쳤는지(그러면 기록에 "수정"을 붙이고 AI 판단 표시를 거둔다)
  const trAns = sv.trAns || {}, filled = sv.filled || {};
  const nowSrc = function (t) { const m = /^calc:(.+)$/.exec(t); if (m) return trAns[m[1]] ? { v: trAns[m[1]].v, src: String(trAns[m[1]].src || '') } : null; if (t === 'ov:사건분류' && trAns.사건분류) return { v: trAns.사건분류.v, src: String(trAns.사건분류.src || '') }; const o = /^ov:(.+)$/.exec(t); if (o && filled[o[1]]) return { v: filled[o[1]].v, src: String(filled[o[1]].src || '') }; return null; };
  const fixes = [];
  Object.keys(store.applied || {}).forEach(function (iid) {
    const a = store.applied[iid]; if (!a || a.user) return;
    const cur = nowSrc(a.target);
    if (cur && !/^🤖|^교차검증/.test(cur.src)) { a.user = { act: cxNormV_(cur.v, a.input) === cxNormV_(a.v, a.input) ? '확인' : '수정', v: cur.v, at: caseProcToday_() }; fixes.push(a); }
  });
  if (fixes.length) {
    fixes.forEach(function (a) { try { if (typeof cxLogUserFix_ === 'function') cxLogUserFix_(cc.id, a.iid, a.user); } catch (e) {} }); // [재점검 6] GAS 판정에도 세무사님 확인·수정을 붙임(GAS 규칙 되돌림 경고)
    lines.push('🤖 AI·교차검증 판단을 세무사님이 ' + fixes.map(function (a) { return a.label + ' ' + a.user.act; }).join(', ') + ' — 기록에 붙임');
  }
  // 0-1) 사건 사실 전부(제외 후보 거름)
  const facts = cxFacts_(cc);
  rec.facts = facts.length;
  // [2026.10.18 재점검 7] 교차검증·AI가 정한 값은 "답"으로 굳히지 않는다 — 계산기 칸(calc:)은 판정 기록(sv.cxAi.applied)에만 두고
  //  다음 처리에서 cxInlineTransfer_가 같은 후보 묶음일 때만 다시 넣는다(서류가 바뀌면 다시 판정). 그 밖의 칸은 근거를 "증빙: 교차검증…"으로 남겨
  //  서류 단계가 다시 정할 수 있는 값(세무사님 확인 값이 아님)으로 둔다
  const applyOne = function (iss, v, src, by, extra) {
    let res;
    const fp = cxHash_((iss.cands || []).map(function (x) { return cxNormV_(x.v, iss.input); }).sort().join('|'));
    if (/^calc:/.test(iss.target)) res = { ok: true };
    else { try { res = caseProcApply_(cxReadCase_(cc.id) || cc, { target: iss.target, value: v, src: ('증빙: ' + src).slice(0, 80), label: iss.label }); } catch (e) { res = { ok: false, error: String(e && e.message || e) }; } }
    if (extra) extra.fp = fp; else extra = { fp: fp };
    if (!res || !res.ok) { lines.push('⚠ ' + (by === 'ai' ? 'AI 판단' : '교차검증') + ' 값을 넣지 못함(' + (iss.label || iss.target) + '): ' + (res && (res.error || res.message) || '')); return false; }
    store.applied[iss.iid] = Object.assign({ iid: iss.iid, target: iss.target, label: iss.label || iss.target, input: iss.input, v: v, by: by, at: caseProcToday_(), cands: iss.cands.map(function (x) { return { v: x.v, src: x.src.slice(0, 160) }; }), options: iss.options || null, kind: iss.kind }, extra || {});
    return true;
  };
  // 0-2) 사실 전체 맞대기 — 계산기 칸마다 모든 서류 값(CrossCheckBind.js). 빈 칸은 객관 규칙으로 채우고, 어긋남은 출처 단 질문으로 items에 더한다
  try { if (typeof cxBindCheck_ === 'function') cxBindCheck_(cc, r, facts, rec, applyOne); } catch (e) { lines.push('⚠ 사실 맞대기 중 오류: ' + (e && e.message || e)); }
  // 0-3) 일반 맞대기 엔진 — 모든 사실 종류를 (대상 열쇠 × 종류)로 묶어 서류마다 값 맞대기, 계산기 칸은 이름 규칙으로 이어 비교(CrossCheckGraph.js)
  try { if (typeof cxGraphCheck_ === 'function') cxGraphCheck_(cc, r, facts, rec, applyOne); } catch (e) { lines.push('⚠ 사실 묶음 맞대기 중 오류: ' + (e && e.message || e)); }
  try { if (typeof cxgValueCheck_ === 'function') cxgValueCheck_(cc, r, facts, rec); } catch (e) { lines.push('⚠ 계산기 칸 값 대조 중 오류: ' + (e && e.message || e)); } // [재점검 1] 전 종류 칸
  // [밤 3바퀴 사람 축] 지분 합·상속인 명단 — 어긋나면 출처 단 확인 질문(판정 안 함)
  try {
    if (typeof cxPersonChecks_ === 'function') {
      const pc = cxPersonChecks_(cc, facts); rec.person = { checks: pc.checks, ok: pc.ok, issues: pc.issues.length };
      if (pc.checks) lines.push('👥 사람·지분 맞대기: 검사 ' + pc.checks + ' · 맞음 ' + pc.ok + ' · 어긋남 ' + pc.issues.length + (pc.issues.length ? ' — ' + pc.issues.map(function (x) { return x.what + ': ' + x.why; }).slice(0, 2).join(' / ') : ''));
      (pc.info || []).forEach(function (t) { lines.push(t); });
      pc.issues.slice(0, 4).forEach(function (x) { const id = 'cxp:' + cxHash_(x.what + x.why); if (!r.items.some(function (it) { return it.id === id; })) r.items.push(caseProcItem_(id, 'check', '👥 ' + x.what + ' — ' + x.why + ' (출처: ' + x.src + ')', { mode: 'note' })); });
    }
  } catch (e) { lines.push('⚠ 사람·지분 맞대기 중 오류: ' + (e && e.message || e)); }
  // [밤 28바퀴] 상속 칸 요약 한 줄(재산 평가·금융재산·채무·공과금·장례비·사전증여 합 — '필수 칸 모두 채움'만으로 끝난 것처럼 보이던 것)
  try { if (cc.세목 === 'inheritance' && typeof cxInhSummary_ === 'function') { const ihs = cxInhSummary_(cc); if (ihs) lines.push(ihs); } } catch (e) {}
  // [밤 10바퀴] 상속 재산 목록 맞대기(분할협의서 ↔ 등기부 대상 부동산)
  try {
    if (typeof cxEstateRoster_ === 'function') {
      const er = cxEstateRoster_(cc, facts); rec.roster = { div: er.div, reg: er.reg, notes: er.notes.length };
      er.lines.forEach(function (t) { lines.push(t); });
      er.notes.forEach(function (t) { const id = 'cxr:' + cxHash_(t); if (!r.items.some(function (it) { return it.id === id; })) r.items.push(caseProcItem_(id, 'check', t, { mode: 'note' })); });
    }
  } catch (e) { lines.push('⚠ 재산 목록 맞대기 중 오류: ' + (e && e.message || e)); }
  // [밤 18바퀴 — 세목별: 양도만] 양도 핵심 서류(양도 계약서·등기부)가 폴더에 없으면 같은 원인으로 빈칸 질문이 6~7개씩 따로 나온다(개발용 고객AK·고객AJ·고객AV·고객AF).
  //  세무사는 "이 서류를 넣어 주세요"를 먼저 한 번 말한다 — 원인 한 장을 맨 앞(사건 기본 카드)에 두고, 어떤 서류가 어느 칸을 채우는지 적는다. 빈칸 질문은 그대로 둔다(서류를 넣으면 다시 채워짐)
  try {
    if (cc.세목 === 'transfer') {
      const core = ['trc:seller.name', 'ov:기준일:none', 'trc:c0.totalPrice', 'trc:a0.assetLocation', 'trc:a0.acquisitionDate', 'trc:a0.acquisitionPrice'];
      const miss = (r.items || []).filter(function (it) { return core.indexOf(String(it.id || '')) !== -1; });
      const hasReg = facts.some(function (f) { return f && f.src && /등기부/.test(String(f.src.docType || '')); });
      if (miss.length >= 3 && !hasReg) {
        const cons = typeof cxContracts_ === 'function' ? cxContracts_(facts, '') : [];
        const fill = { 'trc:seller.name': '양도인', 'ov:기준일:none': '양도일', 'trc:c0.totalPrice': '양도가액', 'trc:a0.assetLocation': '소재지', 'trc:a0.acquisitionDate': '취득일', 'trc:a0.acquisitionPrice': '취득가액' };
        const t = '📂 사건파악 — 양도 핵심 서류가 폴더에 없어 ' + miss.map(function (it) { return fill[it.id]; }).join('·') + ' ' + miss.length + '칸이 비었습니다. 넣어 주실 서류: ① 양도(매도) 계약서 — 양도가액·잔금일·양수인 ② 양도 자산 등기부등본 — 소재지·취득일·취득 원인·양도 등기 접수일 ③ 취득 계약서(또는 분양계약서·상속·증여 서류) — 취득가액' + (cons.length ? '. 폴더의 매매계약서 ' + cons.length + '건은 날짜·당사자로 보아 이번 양도 계약인지 확실하지 않습니다(다른 집 취득 계약일 수 있음)' : '') + ' — 서류를 넣고 다시 처리하면 대부분 자동으로 채워집니다';
        if (!r.items.some(function (it) { return it.id === 'grasp:양도핵심서류'; })) r.items.unshift(caseProcItem_('grasp:양도핵심서류', 'missing', t, { mode: 'note' }));
        rec.coreDocs = miss.length;
      }
    }
  } catch (e) { lines.push('⚠ 양도 핵심 서류 점검 중 오류: ' + (e && e.message || e)); }
  // [밤 17바퀴] 증여 10년 합산 — 사무소의 같은 수증자 다른 증여 사건(판단 재료·합산 후보)
  try {
    if (typeof cxOtherGifts_ === 'function') {
      const og = cxOtherGifts_(cc, facts); rec.otherGifts = { n: og.lines.length, hits: og.hits.length };
      if (og.lines.length) {
        lines.push('🎁 ' + og.text);
        (r.items || []).forEach(function (it) {
          const a = it.ask || {}; if (a.target !== 'ov:giftPriorAmount') return;
          it.text = String(it.text || '') + ' — ' + og.text;
          if (og.hits.length && Array.isArray(a.options)) og.hits.slice().reverse().forEach(function (h) { if (h.v && !a.options.some(function (o) { return String(o.value) === h.v; })) a.options.unshift({ label: Number(h.v).toLocaleString('ko-KR') + '원 — ' + h.src, value: h.v }); });
        });
      }
    }
  } catch (e) { lines.push('⚠ 증여 합산 사건 찾기 중 오류: ' + (e && e.message || e)); }
  // [밤 11바퀴] 사망일 현재 임대차(보증금 채무)
  try {
    if (typeof cxLeaseAtDeath_ === 'function') {
      const la = cxLeaseAtDeath_(cc, facts); rec.lease = { n: la.n, notes: la.notes.length };
      la.lines.forEach(function (t) { lines.push(t); });
      la.notes.forEach(function (t) { const id = 'cxd:' + cxHash_(t); if (!r.items.some(function (it) { return it.id === id; })) r.items.push(caseProcItem_(id, 'check', t, { mode: 'note' })); });
    }
  } catch (e) { lines.push('⚠ 임대차 사망일 맞대기 중 오류: ' + (e && e.message || e)); }
  // [밤 5바퀴] 감정가액 평균(시행령 §49)·보증금 합계 검산 — 추론 걸음 중 여러 사건에서 되풀이된 GAS 몫
  try {
    if (typeof cxLawChecks_ === 'function') {
      const lc = cxLawChecks_(cc, facts); rec.law = { appraisal: lc.appraisal.length, depositOk: lc.deposit.ok, depositBad: lc.deposit.bad };
      lc.lines.slice(0, 6).forEach(function (t) { lines.push(t); });
      lc.notes.slice(0, 3).forEach(function (t) { const id = 'cxl:' + cxHash_(t); if (!r.items.some(function (it) { return it.id === id; })) r.items.push(caseProcItem_(id, 'check', t, { mode: 'note' })); });
      // 그 자산의 상속재산 평가 질문에 "감정가액 평균" 후보를 붙인다(이미 같은 값이 있으면 근거만 보탬)
      lc.appraisal.forEach(function (ap) {
        (r.items || []).forEach(function (it) {
          const a = it.ask || {}; if (!/^ih:/.test(String(a.target || '')) || !Array.isArray(a.cands)) return;
          if (!ap.vals.some(function (v) { return a.cands.some(function (x) { return Number(String(x.v).replace(/[^\d]/g, '')) === v; }); })) return; // 그 자산의 감정가액이 후보에 있는 질문만
          const hit = a.cands.filter(function (x) { return Number(String(x.v).replace(/[^\d]/g, '')) === ap.avg; })[0];
          if (hit) hit.src = String(hit.src || '') + ' — 감정가액 ' + ap.vals.length + '곳 평균(상증법 시행령 §49①)';
          else a.cands.unshift({ v: String(ap.avg), src: '감정가액 ' + ap.vals.length + '곳 평균 — ' + ap.files.join(' / ') + '(상증법 시행령 §49①: 둘 이상이면 평균)' });
        });
      });
    }
  } catch (e) { lines.push('⚠ 평가·보증금 검산 중 오류: ' + (e && e.message || e)); }
  // [밤 4바퀴 시간 축] 날짜 차이의 무게(보유기간 경계)·합산 기간 경계 가까운 증여일
  try {
    const nw = typeof cxWeighDateItems_ === 'function' ? cxWeighDateItems_(cc, r) : 0;
    const gw = typeof cxGiftWindows_ === 'function' ? cxGiftWindows_(cc, facts) : [];
    rec.time2 = { weighed: nw, giftEdge: gw.length };
    gw.slice(0, 4).forEach(function (t) { const id = 'cxw:' + cxHash_(t); if (!r.items.some(function (it) { return it.id === id; })) r.items.push(caseProcItem_(id, 'check', t, { mode: 'note' })); });
  } catch (e) { lines.push('⚠ 시간 맞대기 중 오류: ' + (e && e.message || e)); }
  // [재점검 15] 지표 — 맞대기가 닿은 칸 수(서류 값이 있어 실제로 맞댄 칸)와 찾아낸 어긋남 수. 점검기·보고서가 이것으로 맞대기 범위를 잰다
  try {
    const B = rec.bind || {}, G = rec.graph || {}, V = rec.valueCheck || {};
    rec.coverage = { touched: (B.withVals || 0) + (G.calcFields || 0) + Math.max(0, (V.fields || 0) - (V.noEvidence || 0)), fieldsSeen: (B.fields || 0) + (G.calcFields || 0) + (V.fields || 0),
      mismatch: ((B.mismatch || []).length + (B.open || []).length) + ((G.calcMismatch || []).length) + ((V.mismatch || []).length), groups: G.groups || 0, multiDoc: G.multi || 0 };
  } catch (e) {}
  // 0-4) 돈 연결·시간 순서(CrossCheckMoneyTime.js — 있을 때만)
  try {
    if (typeof cxMoneyLinks_ === 'function') { const m = cxMoneyLinks_(facts, { 세목: cc.세목, 납세자: cc.납세자 }); rec.money = { groups: m.groups || 0, linked: (m.linked || []).length, mismatch: (m.mismatch || []).length, unlinked: m.noBank ? 0 : (m.unlinked || []).length, noBank: m.noBank ? (m.unlinked || []).length : 0 }; lines.push(m.noBank ? '💸 돈 맞대기: 통장 자료 없음 — 대금 흐름 확인 못 함(서류의 큰 돈 ' + (m.unlinked || []).length + '건 — 실지거래가액 확인이 필요하면 통장 사본을 받으세요)' : '💸 돈 맞대기: 연결 ' + rec.money.linked + ' · 어긋남 ' + rec.money.mismatch + ' · 짝 없는 큰 돈 ' + rec.money.unlinked + ((m.mismatch || []).length ? ' — ' + m.mismatch.slice(0, 3).map(function (x) { return x.why; }).join(' / ') : '')); }
    if (typeof cxTimeOrder_ === 'function') { const t = cxTimeOrder_(facts, { 세목: cc.세목, 납세자: cc.납세자, 기준일: cc.기준일 }); rec.time = { checks: t.checks || 0, contradictions: (t.contradictions || []).length }; lines.push('⏱ 시간 순서 맞대기: 검사 ' + rec.time.checks + ' · 모순 ' + rec.time.contradictions + ((t.contradictions || []).length ? ' — ' + t.contradictions.slice(0, 3).map(function (x) { return x.what + ': ' + x.why; }).join(' / ') : ''));
      /* [밤 7바퀴 소통 → 8바퀴 보완, 3번 원본 대조로 바로잡음] 주소이력 신고일·발생일 차이는 원본에도 있는 서류상 정상이라 cxTimeOrder_가 아예 세지 않는다("판독 오차"라던 처음 설명은 틀렸음).
         남은 주소이력·거주기간 검사(번호 순서 뒤집힘·거주 시작 > 끝)는 사흘 이내면 거주 요건(2년·3년)을 가를 크기가 아니라 질문 대신 처리 줄에만 남긴다.
         이 규칙은 what이 "주소이력·거주기간"으로 시작하는 검사에만 걸린다 — 계약일·잔금일·등기 접수일·취득일·양도일·사망일·증여일 검사에는 절대 걸리지 않는다(하루로 §98·보유기간·10년 합산이 갈림) */
      const cxtSmall = []; const cxtBig = (t.contradictions || []).filter(function (x) { const d = String(x.why || '').match(/\d{4}-\d{2}-\d{2}/g) || []; if (/^(주소이력|거주기간)/.test(String(x.what || '')) && d.length === 2 && Math.abs(Date.parse(d[0]) - Date.parse(d[1])) <= 3 * 864e5) { cxtSmall.push(x); return false; } return true; });
      if (cxtSmall.length) lines.push('⏱ 주소이력 날짜 작은 차이(사흘 이내) ' + cxtSmall.length + '건 — 거주 요건을 가를 크기가 아니라 묻지 않음: ' + cxtSmall.slice(0, 2).map(function (x) { return x.why; }).join(' / '));
      cxtBig.slice(0, 5).forEach(function (x, i) { const id = 'cxt:' + cxHash_(x.what + x.why); if (!r.items.some(function (it) { return it.id === id; })) r.items.push(caseProcItem_(id, 'check', '⏱ 시간 순서 모순 — ' + x.what + ': ' + x.why + ' — 판독이 틀렸는지·서류가 다른 거래인지 확인해 주세요', { mode: 'note' })); }); }
  } catch (e) { lines.push('⚠ 돈·시간 맞대기 중 오류: ' + (e && e.message || e)); }
  const itemsNow = r.items;
  // 1) 쟁점(질문 중 "어느 값인가")
  const issues = cxIssuesFromItems_(itemsNow);
  // 2) GAS 객관 규칙
  const open = [];
  const decided = {}; (rec.gas || []).forEach(function (g) { const a = store.applied[g.iid]; if (a) decided[a.target] = 1; }); // 이번 실행에 이미 정한 칸
  issues.forEach(function (iss) {
    if (decided[iss.target]) return;
    const j = cxJudge_(iss, facts);
    if (j) decided[iss.target] = 1;
    rec.issues.push({ iid: iss.iid, kind: iss.kind, target: iss.target, label: iss.label, nCands: iss.cands.length + (iss.options ? iss.options.length : 0), why: j ? 'GAS(' + j.rule + ')' : (iss.why || '') });
    // GAS 객관 규칙은 토큰 0이라 점검 중에도 그대로 반영한다(점검기가 그 효과를 잴 수 있게)
    if (j) { if (applyOne(iss, j.v, '교차검증(' + j.rule + '): ' + j.why, 'gas', { why: j.why, rule: j.rule })) rec.gas.push({ iid: iss.iid, label: iss.label, v: j.v, rule: j.rule }); return; }
    open.push(iss);
  });
  // 3) 미결 → AI(사건당 한 번, 같은 쟁점·같은 글이면 다시 묻지 않음)
  if (open.length) {
    const summary = cxCaseSummary_(cc, facts);
    // AI가 읽을 근거(원문·후보)가 하나도 없는 쟁점은 AI에게 보내지 않고 바로 사용자에게 — 서류가 없으면 AI도 지어낼 수밖에 없다(원시서류 없는 사건 등)
    const texts0 = open.map(function (iss) { return { iss: iss, text: cxIssueText_(cc, iss, facts) }; });
    // [재점검 5] 판단 쟁점은 사건 요약·선택지·관련 사실로 AI가 볼 수 있어 늘 AI로. 빈칸·값고르기는 원문·후보·관련 사실 중 하나라도 있으면 AI로(사건에 서류가 하나도 없을 때만 바로 사용자)
    // [밤 24바퀴] 서류에 없는 빈 칸은 AI를 거치지 않고 바로 질문(5번 AI 자리 줄이기, 미관측에서도 되풀이) — 빈칸은 값이 있을 법한 원문(앞뒤)이나 종류 못 정한 서류 앞부분이 붙을 때만 AI로.
    //  '관련 사실'(그 종류의 다른 값들)만으로는 빈 칸 값을 AI가 지어낼 수밖에 없다(고객X 취득일 — 등기부·취득 계약서 없음)
    const texts = texts0.filter(function (x) { const ok = x.iss.kind === '판단' || (x.iss.kind === '빈칸' ? !!x.iss._srcSnip : (/\n원문\(앞뒤\):|\n관련 사실/.test(x.text) || x.iss.cands.length > 0)); if (!ok) rec.user.push({ iid: x.iss.iid, label: x.iss.label, why: x.iss.kind === '빈칸' ? '서류에 없는 빈 칸 — 바로 사용자에게' : '근거 원문 없음 — 바로 사용자에게' }); return ok; });
    open.splice(0, open.length).forEach(function (iss) { if (texts.some(function (x) { return x.iss === iss; })) open.push(iss); });
    // [2026.10.19 5번 세겹 ①] 쟁점 종류 표(AiLeadTiers.js caseProcAiRoute_ — 스크립트 속성 AI_ROUTE_TABLE로 바꿈)에서 총괄 AI 몫(사건분류·특수관계·돈 흐름·사전증여·시가·주택 여부)은
    //  저비용에 보내지 않는다 — 그 질문에 ask.route='lead'를 붙여 AI 지휘(총괄)가 받는다. 표가 없는 판(함수 없음)은 예전 그대로
    const leadIds = {};
    if (typeof caseProcAiRoute_ === 'function') texts.forEach(function (x) { try { if (caseProcAiRoute_(x.iss) === 'lead') leadIds[x.iss.iid] = 1; } catch (e) {} });
    rec.lead = Object.keys(leadIds);
    const fresh = texts.filter(function (x) { if (leadIds[x.iss.iid]) return false; const h = cxHash_(x.text); x.h = h; const old = store.asked[x.iss.iid]; return !(old && old.h === h); });
    const reuse = texts.filter(function (x) { return fresh.indexOf(x) === -1 && !leadIds[x.iss.iid]; });
    const byModel = {};
    fresh.forEach(function (x) { const m = cxModelFor_(x.iss.kind); (byModel[m] = byModel[m] || []).push(x); });
    rec.bundleChars = summary.length + fresh.reduce(function (s, x) { return s + x.text.length; }, 0);
    try { rec.folderChars = cxFolderChars_(cc); } catch (e) {}
    rec.ai = fresh.map(function (x) { return { iid: x.iss.iid, kind: x.iss.kind, label: x.iss.label, model: cxModelFor_(x.iss.kind), chars: x.text.length }; });
    const answers = {};
    reuse.forEach(function (x) { answers[x.iss.iid] = store.asked[x.iss.iid].a; });
    if (aiOn) {
      Object.keys(byModel).forEach(function (model) {
        let round = 0, pend = byModel[model].slice();
        while (pend.length && round < 2) { // 쟁점당 최대 2번(더 볼 것이 있을 때만 한 번 더)
          round++;
          const user = '## 사건 요약\n' + summary + '\n\n' + pend.map(function (x) { return x.text; }).join('\n\n');
          const res = cxCallAi_(model, user);
          rec.calls += res.cached ? 0 : 1; rec.usd += res.usd || 0;
          if (res.error) { lines.push('⚠ AI 판단 호출 실패(' + model + '): ' + res.error + ' — 그 쟁점은 세무사님 질문으로 남김'); break; }
          const got = cxParseAnswers_(res.text), next = [];
          pend.forEach(function (x) {
            const a = got.filter(function (g) { return String(g.id) === String(x.iss.iid); })[0];
            if (!a) return;
            answers[x.iss.iid] = { value: a.value, sure: a.sure, why: String(a.why || '').slice(0, 400), quote: String(a.quote || '').slice(0, 300), need: Array.isArray(a.need) ? a.need.slice(0, 4) : [], model: model, round: round };
            store.asked[x.iss.iid] = { h: x.h, a: answers[x.iss.iid], at: caseProcToday_() };
            if (round < 2 && a.sure !== '확실' && answers[x.iss.iid].need.length) { // 더 볼 것 — 열쇠(파일 이름·낱말)로 그 원문만 더 찾아 한 번 더
              const nf = [], nw = [];
              answers[x.iss.iid].need.forEach(function (w) { const fs = cxFilesIn_(cc, w); if (fs.length) fs.forEach(function (f) { nf.push(f); }); else nw.push(w); });
              next.push({ iss: x.iss, h: x.h, text: cxIssueText_(cc, x.iss, facts, { files: nf.slice(0, 2), words: nw.slice(0, 4) }) + '\n앞선 답(불확실): ' + String(a.value || '') + ' — ' + String(a.why || '').slice(0, 200) });
            }
          });
          // 빠짐없이 기록(유료질문기록 kind 'cx') — 가린 글만 남김
          try {
            ai_logPaid_({ entry: { kind: 'cx', model: model, usd: res.usd || 0, q: '사건처리 AI 판단 — ' + (cc.사건명 || cc.고객명 || '') + ' (쟁점 ' + pend.length + '개)', cx: {
              id: 'cx_' + Date.now() + '_' + String(cc.id).slice(0, 8), caseId: cc.id, case: cc.사건명 || '', 세목: cc.세목, round: round, bundleChars: user.length,
              items: pend.map(function (x) { const a = answers[x.iss.iid] || {}; return { iid: x.iss.iid, kind: x.iss.kind, shape: cxShape_(x.iss), target: x.iss.target, label: x.iss.label, facts: cxMask_(x.text).slice(0, 400), cands: x.iss.cands.slice(0, 6).map(function (q) { return { v: q.v, src: q.src.slice(0, 100) }; }), answer: a.value == null ? '' : String(a.value), why: a.why || '', sure: a.sure || '', need: a.need || [], user: null }; }) } } });
          } catch (e) {}
          pend = next;
        }
      });
      if (rec.calls || rec.usd) lines.push('🤖 AI 판단 호출 ' + rec.calls + '번(약 $' + rec.usd.toFixed(4) + ') — 쟁점 묶음만, 주민번호·전화·계좌 가려서');
    }
    // 4) 확실한 AI 답 → 계산기 칸, 아니면 사용자 질문(AI가 본 근거를 붙여)
    open.forEach(function (iss) {
      if (leadIds[iss.iid]) { const itL = items.filter(function (x) { return x.id === iss.iid; })[0]; if (itL) itL.ask = Object.assign({}, itL.ask, { route: 'lead' }); return; } // [5번 세겹] 총괄로
      const a = answers[iss.iid];
      if (!aiOn || !a) { rec.user.push({ iid: iss.iid, label: iss.label, why: !aiOn ? 'AI 묻기 예정(' + rec.why + ')' : 'AI 답 없음' }); return; }
      const v = a.sure === '확실' ? cxValidAnswer_(iss, a, cxIssueText_(cc, iss, facts)) : null;
      if (v != null && applyOne(iss, v, '🤖 AI 판단(' + a.model + '): ' + a.why, 'ai', { why: a.why, model: a.model, sure: a.sure, q: cxIssueText_(cc, iss, facts).slice(0, 1500) })) return;
      rec.user.push({ iid: iss.iid, label: iss.label, why: 'AI 불확실' });
      const it = items.filter(function (x) { return x.id === iss.iid; })[0];
      if (it) { it.text = '🤖 AI도 확실히 정하지 못함(' + a.model + (a.value ? ', AI가 기운 값 ' + a.value : '') + ') — ' + a.why.slice(0, 160) + ' · ' + it.text; it.ask = Object.assign({}, it.ask, { aiJudge: { model: a.model, sure: a.sure || '불확실', value: a.value == null ? '' : String(a.value), why: a.why, need: a.need || [], q: cxIssueText_(cc, iss, facts).slice(0, 1500) } }); } // [5번 세겹 ②] need(모자란 정보)도 — 총괄로 올릴 때 함께
    });
  }
  // 5) 정한 칸은 질문에서 빼고, AI·교차검증이 정한 값은 "🤖 AI 판단" 줄로 남긴다(누르면 물은 것·답·근거, "다른 값으로" 고치기)
  const done = Object.keys(store.applied).filter(function (iid) { const a = store.applied[iid]; return a && !a.user; });
  if (done.length) {
    r.items = items.filter(function (it) { return !(store.applied[it.id] && !store.applied[it.id].user); });
    done.forEach(function (iid) {
      const a = store.applied[iid];
      const other = (a.cands || []).filter(function (x) { return cxNormV_(x.v, a.input) !== cxNormV_(a.v, a.input); });
      const ask = a.options ? { mode: 'options', target: a.target, label: a.label, options: a.options.map(function (o) { return { label: (o.v === a.v ? '✔ ' : '') + o.label, value: o.v }; }) }
        : { mode: 'choose', target: a.target, input: a.input === 'option' ? 'text' : a.input, label: a.label, cands: [{ v: a.v, src: (a.by === 'ai' ? '🤖 AI 판단(' + a.model + ')' : '교차검증(' + a.rule + ')') + ' — ' + String(a.why || '').slice(0, 120) }].concat(other) };
      ask.aiJudge = { by: a.by, model: a.model || '', sure: a.sure || '', value: a.v, why: a.why || '', q: a.q || '' };
      r.items.push(caseProcItem_('cxai:' + iid, 'check', (a.by === 'ai' ? '🤖 AI 판단(' + a.model + ')' : '🧮 교차검증(' + a.rule + ')') + ' — ' + (a.label || a.target) + ': ' + a.v + ' · 근거: ' + String(a.why || '').slice(0, 140) + ' — 맞으면 그대로 두고, 다르면 눌러서 다른 값으로 고르세요.', ask, a.q ? '물은 것:\n' + a.q : ''));
    });
  }
  try { caseProcPatch_(cc.id, function (s) { s.cxAi = store; }); } catch (e) {}
  // [재점검 6] AI를 켜기 전에도 GAS 판정을 누적 기록(kind 'cx', 모델 'GAS') — 세무사님이 고치면 cxLogUserFix_가 붙어 정기 점검이 되돌림 경고를 낸다.
  //  같은 판정은 다시 쓰지 않음(판정 기록의 지문으로). 점검·재현기에서는 쓰지 않음
  try {
    const newGas = rec.gas.filter(function (g) { const a = store.applied[g.iid]; return a && !a.logged; });
    if (newGas.length && !CX_AI_DRY_ && typeof ai_logPaid_ === 'function') {
      ai_logPaid_({ entry: { kind: 'cx', model: 'GAS', usd: 0, q: '사건처리 교차검증(GAS) — ' + (cc.사건명 || cc.고객명 || '') + ' (판정 ' + newGas.length + '개)', cx: {
        id: 'cxg_' + Date.now() + '_' + String(cc.id).slice(0, 8), caseId: cc.id, case: cc.사건명 || '', 세목: cc.세목, round: 1, bundleChars: 0,
        items: newGas.map(function (g) { const a = store.applied[g.iid] || {}; return { iid: g.iid, kind: a.kind || '값고르기', shape: cxShape_({ kind: a.kind || '값고르기', target: a.target || '', cands: a.cands || [], options: a.options }), target: a.target || '', label: g.label || '', facts: '', cands: (a.cands || []).slice(0, 6), answer: String(g.v), why: (a.rule || g.rule || '') + ' — ' + String(a.why || '').slice(0, 200), sure: '확실', need: [], user: null }; }) } } });
      newGas.forEach(function (g) { if (store.applied[g.iid]) store.applied[g.iid].logged = true; });
      caseProcPatch_(cc.id, function (s) { s.cxAi = store; });
    }
  } catch (e) {}
  if (!aiOn && !CX_AI_DRY_ && rec.ai.length) lines.push('⚠ AI 자동 묻기 꺼짐(스크립트 속성 CX_AI_AUTO) — 서류로 못 정한 쟁점 ' + rec.ai.length + '개를 지금은 모두 세무사님께 여쭙니다'); // [재점검 16]
  // 6) 처리 줄 — 이번 실행 요약 + 사건당 AI 호출·비용
  const nGas = rec.gas.length, nAi = Object.keys(store.applied).filter(function (k) { return store.applied[k].by === 'ai' && !store.applied[k].user; }).length;
  if (issues.length || nAi) {
    lines.push('🧮 교차검증: 쟁점 ' + issues.length + '개 — GAS 객관 규칙으로 ' + nGas + '개' + (rec.gas.length ? '(' + rec.gas.map(function (g) { return g.label + ' ' + g.rule; }).slice(0, 4).join(', ') + ')' : '')
      + ' · AI에게 ' + rec.ai.length + '개' + (rec.dry ? '(' + rec.why + ' — 실제로 묻지 않음 · 묶음 ' + rec.bundleChars.toLocaleString('ko-KR') + '자 ≈ ' + Math.round(rec.bundleChars / 2).toLocaleString('ko-KR') + '토큰, 폴더 전체 ' + rec.folderChars.toLocaleString('ko-KR') + '자)' : '(호출 ' + rec.calls + '번 · 약 $' + rec.usd.toFixed(4) + ')')
      + ' · 사용자에게 ' + rec.user.length + '개');
    if (nAi) lines.push('🤖 이 사건 AI 판단 값 ' + nAi + '개: ' + Object.keys(store.applied).filter(function (k) { return store.applied[k].by === 'ai' && !store.applied[k].user; }).map(function (k) { const a = store.applied[k]; return a.label + ' ' + a.v + '(' + a.model + ')'; }).join(', ') + ' — 검토서에 따로 모음');
  }
  if (nGas || (aiOn && nAi)) r.loop = Object.assign({}, r.loop || {}, { again: r.loop && r.loop.again ? r.loop.again : '교차검증·AI 판단으로 계산기 칸을 채움 — 그 값으로 물린 판단(보유기간·공제·세율 등)을 다시' });
  return r;
}
// 쟁점의 입력 모양 서명 — 같은 모양이 여러 사건에서 반복되는지 보려고(보고서 cxAiReport_가 묶는 열쇠)
function cxShape_(iss) {
  const t = String(iss.target).replace(/\d+/g, '#');
  const srcKinds = (iss.cands || []).map(function (x) { const s = x.src; return /증여세/.test(s) ? '증여세신고' : /등기/.test(s) ? '등기부' : /계약서/.test(s) ? '계약서' : /신고필증/.test(s) ? '신고필증' : /통장|거래/.test(s) ? '통장' : /공시/.test(s) ? '공시가격' : /감정/.test(s) ? '감정' : /매매사례|실거래/.test(s) ? '매매사례' : '기타'; }).sort();
  return iss.kind + '|' + t + '|' + (srcKinds.length ? srcKinds.join('+') : (iss.options ? 'opt' + iss.options.length : '없음'));
}
// 검토서·계산 결과에 따로 모을 AI 판단 값 목록(다른 단계가 부름)
function cxAiJudgedList_(caseId) {
  const st = ((caseProcLoad_(caseId) || {}).cxAi || {}).applied || {};
  return Object.keys(st).map(function (k) { return st[k]; }).filter(function (a) { return a && a.by === 'ai'; })
    .map(function (a) { return { 칸: a.label || a.target, 값: a.v, 모델: a.model || '', 근거: a.why || '', 세무사님: a.user ? a.user.act + (a.user.act === '수정' ? '(' + a.user.v + ')' : '') : '아직 확인 안 함' }; });
}
