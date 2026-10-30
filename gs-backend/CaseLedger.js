// ============================================================
// CaseLedger.js — 사건 장부: 사건의 모든 사실을 적는 단일 저장소 [2026.10.28 신설]
// ------------------------------------------------------------
// 세무사님 원문(10-28): "확보할 수 있는 정보를 최대한 확보하고, 확보된 정보를 최대한 활용해서 사건처리를 하자는 것이고,
//   부족한 정보는 물어보거나 확보할 증빙으로 분류하자는 거 아닌가? 확인되지 않은 정보중에 추정치나 가정치를 넣어서 진행할 수도 있고 말야."
// 세무사님 원문(10-19): "변수담당은 ai이고 상수담당은 gas라고 생각하자."
// 세무사님 원문(10-15): 수집·반영·소통 3대 약점 → "사실 장부·칸 연결·한곳에서 묻기" 구조 — 그동안 만들지 않고 저장소 7곳(trCalc·trAns·filled·remaining·decisions·valueHist·사건개요)에
//   땜질만 하다 10-28 김향숙 사건(물건 1건·서류 7장)이 실패("그걸 알면서도 안 만들었다고?"). 이 파일이 그 장부다.
//
// 구조 — 계산기 칸 하나 = 장부 한 줄. 칸 경로는 세액계산기 입력 경로 그대로(서식이 기준):
//   seller.name · seller.regNo · seller.address · seller.multiHouseCount · seller.isTransferorResident
//   c0.date · c0.totalPrice · c0.transferCause · c0.buyer.name · c0.buyer.regNo · c0.buyer.relation   (c1·c2… 계약이 여럿일 때)
//   a0.assetLocation · a0.assetKind · a0.assetType · a0.assetDong · a0.assetHo · a0.assetArea · a0.acquisitionDate · a0.acquisitionPrice · a0.contract(이 자산이 걸린 계약 c0…)
//   a0.isOneHouseOneFamily · a0.isNonBusinessLand · a0.isUnregisteredTransfer · a0.acquisitionStandardPriceForExpense · a0.transferStandardPriceForConversion …(계산기 자산 카드 칸 전부)
//   costs({acq:[{label,amount,file,date}], tr:[…]}) · taxfee · 사건분류 · 기준일
//   doc:<파일 이름>.role — 서류의 역할(양도계약서·취득계약서·등기부·전소유자 분양계약서·영수증·간편계산서·기타): 사건 뼈대. 넥스가 읽어 정하고, 애매하면 물어볼 것으로.
// 줄: { v, label, src:{kind, who, file, page, quote}, sure, state, ask, cands, at, hist[] }
//   src.kind: 세무사님 | 넥스 | 서류 | 규칙 | 추정 | 계산      sure: 확실 | 애매 | 모름
//   state: 확정 | 추정 | 물어볼것 | 증빙받을것 | 보류 | 무시
// 쓰는 길 하나(ledgerSet_) — 규칙:
//   ① 세무사님이 정한 값은 아무도 덮지 않는다(넥스는 "지금 값·서류 값"만 말씀드린다). 세무사님만 바꾼다.
//   ② 넥스가 정한 값은 세무사님·넥스만 바꾼다(서류·규칙 결과가 뒤에 와도 덮지 않는다).
//   ③ 서류·규칙 값은 더 확실한 서류·규칙, 넥스, 세무사님이 덮는다.
//   ④ 서류·규칙이 "애매·모름"이면 값을 정하지 않고 후보와 함께 "물어볼것"으로 선다 — 혼자 정하지 않는다(10-18 "불확실하면 소통으로 보완").
//   ⑤ 고르기 칸(과세대상 구분·양수인 관계·자산 종류·양도 원인·주택 수·예/아니오)은 코드값만 받는다. 글은 코드로 바꾸고, 못 바꾸면 거절(10-27 긴급 "주택(주거용 오피스텔)" 글이 들어가 세액 0원).
//   ⑥ 값이 들어오면 그 칸의 "물어볼것·증빙받을것"은 그 자리에서 풀린다(질문 목록이 따로 없으니 어긋날 수 없다).
//   ⑦ 추정은 상태 "추정"으로 넣고 계산을 돌린다. 검토서 "추가로 확인할 사항"에 추정·증빙받을것·보류 줄이 그대로 들어간다.
// 읽는 길 하나 — 계산기 상태(ledgerCalcState_)·질문 목록(ledgerQuestions_)·검토서 메모(ledgerReviewNotes_)·화면 표(ledgerView_)는 전부 장부에서 뽑는다.
// 저장: 총괄관리자\_사건장부\<사건ID>.json (잠금 안에서 읽고-고치고-쓴다). 옛 저장소는 ledgerImportLegacy_로 한 번 옮겨 오고 그 뒤엔 보지 않는다.
// ============================================================

var LEDGER_FOLDER_ = '_사건장부';
var LEDGER_STATES_ = ['확정', '추정', '물어볼것', '증빙받을것', '보류', '무시'];
var LEDGER_KINDS_ = ['세무사님', '넥스', '서류', '규칙', '추정', '계산'];
var LEDGER_SURE_ = ['확실', '애매', '모름'];
// 값 주인 우열 — 같은 급 이상만 덮는다
var LEDGER_RANK_ = { 세무사님: 3, 넥스: 2, 서류: 1, 규칙: 1, 추정: 1, 계산: 1 };
// 고르기 칸 코드값 — 화면 세액계산기 select 값과 같다(CH_ASSET_TYPE_OPTIONS_·CH_ASSET_KIND_OPTIONS_·양수인 관계 질문 tr:buyerrel)
var LEDGER_ENUMS_ = {
  assetType: { codes: ['house', 'other', 'presale_right'], ko: { house: '주택·조합원입주권', other: '그 외 부동산', presale_right: '분양권' } },
  assetKind: { codes: ['land', 'building', 'land_building', 'stock', 'other'], ko: { land: '토지', building: '건물', land_building: '토지+건물', stock: '주식', other: '기타' } },
  'buyer.relation': { codes: ['none', 'sibling', 'lineal', 'spouse', 'relative'], ko: { none: '특수관계 없음', sibling: '형제자매', lineal: '직계존비속', spouse: '배우자', relative: '기타 친족' } },
  transferCause: { codes: ['sale', 'expropriation', 'exchange', 'gift_burden', 'other'], ko: { sale: '매매', expropriation: '수용', exchange: '교환', gift_burden: '부담부증여', other: '기타' } }
};
var LEDGER_DOC_ROLES_ = ['양도계약서', '취득계약서', '등기부', '전소유자 분양계약서', '분양권 매매계약서', '영수증', '간편계산서', '신고서', '등초본', '가족관계', '공부 자료(조회)', '기타'];

function ledgerFolder_() {
  const root = getChiefManagerFolder_();
  if (!root) throw new Error('총괄관리자 폴더가 설정되어 있지 않습니다');
  return getOrCreateSubfolder_(root, LEDGER_FOLDER_);
}
function ledgerFile_(caseId, create) {
  const folder = ledgerFolder_();
  const name = String(caseId).replace(/[^\w-]/g, '_') + '.json';
  const it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(name, '{}', 'application/json') : null;
}
// [2026.10.29 장부 하나로] 세무사님 "칸장부와 바탕장부가 분리되어 있으면 정보의 질이 떨어질 수 있고 중복관리의 문제만 생기는 것이 아닌가?" / "처음부터 그랬어야지"
//  서류 사실·서류끼리 맞대기·폴더 파일 장부(kb)를 칸(rows)과 같은 파일 하나에 두고 같은 잠금 안에서 함께 쓴다. 칸마다 그 값을 말한 서류 사실 번호(fx)를 쓸 때마다 다시 잇는다
//  kbFrom: 예전 짝 파일(<사건ID>.바탕.json)을 옮겨 왔는지 — '없음'이면 옮길 것이 없다(새 장부·🧪 점검기 모래상자)
function ledgerEmpty_(caseId) { return { caseId: String(caseId || ''), rows: {}, log: [], at: '', kbFrom: '없음' }; }
// 한 실행 안의 읽기 메모 — 사건 처리 저장 파일을 불러올 때마다(질문·결정을 장부에서 붙임) 드라이브를 다시 읽지 않게. 쓰기(ledgerMutate_)는 잠금 안에서 늘 새로 읽고, 쓴 뒤 메모를 바꾼다
var LEDGER_MEMO_ = {};
function ledgerLoad_(caseId, fresh) {
  const k = String(caseId || '');
  if (!fresh && LEDGER_MEMO_[k]) return JSON.parse(LEDGER_MEMO_[k]);
  try {
    const f = ledgerFile_(caseId, false);
    if (!f) return ledgerEmpty_(caseId);
    const o = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}') || {};
    o.caseId = k; o.rows = o.rows || {}; o.log = Array.isArray(o.log) ? o.log : [];
    LEDGER_MEMO_[k] = JSON.stringify(o);
    return o;
  } catch (e) { return ledgerEmpty_(caseId); }
}
// 잠금 안에서 읽고-고치고-쓴다(동시에 도는 넥스·화면이 서로 덮지 않게). mutate(L)가 돌려준 값을 그대로 돌려준다
function ledgerMutate_(caseId, mutate) {
  return withLock_(15000, function () {
    const L = ledgerLoad_(caseId, true);
    ledgerKbAdopt_(caseId, L);
    const out = mutate(L);
    ledgerKbRelink_(L);
    L.at = caseProcNow_();
    const f = ledgerFile_(caseId, true);
    const s = JSON.stringify(L);
    f.setContent(s);
    LEDGER_MEMO_[String(caseId || '')] = s;
    return out;
  });
}
function ledgerLogTo_(L, e) {
  L.log = (L.log || []).concat([{ at: caseProcNow_(), by: String(e.by || '').slice(0, 6), what: String(e.what || '').slice(0, 30), path: String(e.path || '').slice(0, 80), detail: String(e.detail || '').slice(0, 240) }]).slice(-400);
}

var LEDGER_GKO_ = { giftDoneeName: '수증자 성명', giftDonorName: '증여자 성명', giftRelation: '증여자와의 관계', giftAmount: '증여재산가액', giftDebtAssumed: '인수채무액', giftDebtProven: '입증된 채무', giftPriorAmount: '10년 내 기증여액', giftPriorPaidTax: '기납부세액', giftPriorDeductionUsed: '이미 쓴 증여공제', giftAppraisalFee: '감정평가수수료', giftDoneeRegNo: '수증자 주민등록번호', giftDonorRegNo: '증여자 주민등록번호', giftDoneeAddress: '수증자 주소', giftDonorAddress: '증여자 주소', trTransferorName: '양도인 성명', ihDeceasedName: '피상속인 성명', ihDeathDate: '상속개시일', 물건목록: '물건 목록' };
// ── 칸 이름(한글) — 기존 이름표를 그대로 쓴다(서식 기준 이름) ──
function ledgerLabel_(path) {
  const p = String(path || '');
  let m;
  if ((m = /^doc:(.+)\.role$/.exec(p))) return '서류 역할 — ' + m[1];
  if (/^q:/.test(p)) return '질문';
  if (/^(costs|taxfee|사건분류|기준일)$/.test(p)) return CASEPROC_FIELD_KO_[p] || p;
  if ((m = /^a(\d+)\.contract$/.exec(p))) return '자산' + (Number(m[1]) + 1) + ' 걸린 계약';
  // [2026.10.29] 상속 칸(i.*) 이름 — 화면·기록에 코드 이름이 보이던 것
  const IKO = { financialAmount: '금융재산', realEstateAmount: '부동산 등 재산 평가액', debtAmount: '채무', duesAmount: '공과금', funeralAmount: '장례비', nicheAmount: '봉안시설·자연장지 비용', heirCount: '상속인 수', isSpouse: '배우자 있음', childCount: '자녀 수', deceasedName: '피상속인 성명', priorGiftHeirAmount: '상속인에게 한 사전증여(10년)', priorGiftOtherAmount: '상속인 외에게 한 사전증여(5년)', appraisalFeeAmount: '감정평가수수료' };
  if ((m = /^i\.(\w+)$/.exec(p)) && IKO[m[1]]) return IKO[m[1]];
  if ((m = /^(?:g|ov)\.(\w+)$/.exec(p)) && LEDGER_GKO_[m[1]]) return LEDGER_GKO_[m[1]]; // [2026.10.29] 증여·사건개요 칸 이름(화면·바퀴 기록에 코드 이름이 보이던 것)
  try { const l = caseProcFieldLabel_('calc:' + p); if (l && l !== 'calc:' + p) return l; } catch (e) {}
  const last = p.split('.').pop();
  const MORE = { transferCause: '양도 원인', assetFloor: '층', assetKind: '자산 종류', assetType: '과세대상 구분' }; // [2026.10.29] 화면에 코드 이름이 보이던 칸
  return CASEPROC_FIELD_KO_[last] || MORE[last] || p;
}
// ── 고르기 칸 코드값 — 글을 코드로. 못 바꾸면 error ──
function ledgerEnumOf_(path) {
  const p = String(path || '');
  if (/\.assetType$/.test(p)) return 'assetType';
  if (/\.assetKind$/.test(p)) return 'assetKind';
  if (/\.buyer\.relation$/.test(p)) return 'buyer.relation';
  if (/\.transferCause$/.test(p)) return 'transferCause';
  return '';
}
function ledgerNorm_(path, value) {
  const p = String(path || ''), s = String(value == null ? '' : value).trim();
  const en = ledgerEnumOf_(p);
  if (en) {
    const spec = LEDGER_ENUMS_[en];
    if (spec.codes.indexOf(s) !== -1) return { v: s };
    const hit = ledgerEnumGuess_(en, s);
    if (hit) return { v: hit, note: '글 "' + s.slice(0, 30) + '" → ' + spec.ko[hit] };
    return { error: ledgerLabel_(p) + '은(는) ' + spec.codes.map(function (c) { return c + '=' + spec.ko[c]; }).join(' · ') + ' 중 하나여야 합니다 — 받은 값: ' + s.slice(0, 40) };
  }
  if (/\.multiHouseCount$/.test(p)) { const n = (s.match(/\d+/) || [])[0]; return n ? { v: String(Number(n)) } : { error: '보유 주택 수는 숫자여야 합니다 — 받은 값: ' + s.slice(0, 30) }; }
  if (/\.(is[A-Z]\w*)$/.test(p)) { if (typeof value === 'boolean') return { v: value }; if (/^(true|1|예|켬|yes|해당|맞)/.test(s)) return { v: true }; if (/^(false|0|아니|끔|no|비해당|없)/.test(s)) return { v: false }; return { error: ledgerLabel_(p) + '은(는) 예/아니오 칸입니다 — 받은 값: ' + s.slice(0, 30) }; }
  if (/(Price|Amount|Value|StandardPrice|Sqm|Assumed|Fee|PaidTax|DeductionUsed)$|^taxfee$/.test(p)) { const n = Number(s.replace(/[^\d]/g, '')); if (!s) return { v: '' }; if (!Number.isFinite(n)) return { error: ledgerLabel_(p) + '은(는) 금액 칸입니다 — 받은 값: ' + s.slice(0, 30) }; return { v: n }; }
  if (/(Date|^기준일)$/.test(p)) { const m = /((?:19|20)\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/.exec(s); if (!s) return { v: '' }; if (!m) return { error: ledgerLabel_(p) + '은(는) 날짜 칸(YYYY-MM-DD)입니다 — 받은 값: ' + s.slice(0, 30) }; return { v: m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) }; }
  if (p === 'costs') {
    let d = value; try { if (typeof d === 'string') d = JSON.parse(d); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') return { error: '필요경비는 {acq:[{label,amount,file,date}], tr:[…]} 모양이어야 합니다(acq=취득비용, tr=양도비용)' };
    const fix = function (l) { return (Array.isArray(l) ? l : []).map(function (x) { return { kind: x.kind ? String(x.kind).slice(0, 10) : undefined, label: String(x.label || '').slice(0, 60), amount: Number(String(x.amount == null ? '' : x.amount).replace(/[^\d]/g, '')) || 0, file: String(x.file || '').slice(0, 80), date: String(x.date || '').slice(0, 10) }; }).filter(function (x) { return x.amount > 0; }); };
    const items = Array.isArray(d.items) ? d.items : null;
    const acq = items ? items.filter(function (x) { return x && x.kind === '취득'; }) : d.acq, tr = items ? items.filter(function (x) { return x && x.kind !== '취득'; }) : d.tr;
    return { v: { acq: fix(acq), tr: fix(tr) } };
  }
  if ((/^doc:/.test(p))) { if (!s) return { error: '서류 역할이 비어 있습니다' }; return { v: s.slice(0, 40) }; } // GAS·넥스가 읽은 종류 이름 그대로 — 역할 목록에 부분 일치로 붙이지 않는다(10-28 "매매계약서"가 "분양권 매매계약서"로 바뀐 결함)
  if ((/^a\d+\.contract$/.test(p))) { const m = /c?(\d+)/.exec(s); return m ? { v: 'c' + Number(m[1]) } : { error: '걸린 계약은 c0·c1… 모양 — 받은 값: ' + s.slice(0, 20) }; }
  return { v: (value !== null && typeof value === 'object') || typeof value === 'number' || typeof value === 'boolean' ? value : s }; // 숫자·참거짓은 모양 그대로(답 저장소에서 온 금액이 글자로 바뀌지 않게)
}
function ledgerEnumGuess_(en, s) {
  if (en === 'assetType') {
    if (/분양권/.test(s) && !/주택/.test(s)) return 'presale_right';
    if (/아님|아니|업무용|그\s*외|기타|비주택|토지|상가|오피스텔\s*\(업무/.test(s)) return 'other';
    if (/주택|주거|아파트|입주권|house/i.test(s)) return 'house';
  }
  if (en === 'buyer.relation') {
    if (/배우자|부부|남편|아내/.test(s)) return 'spouse';
    if (/형제|자매|남매/.test(s)) return 'sibling';
    if (/직계|부모|자녀|아들|딸|조부|손/.test(s)) return 'lineal';
    if (/없|아님|아니|무관|타인|제3자/.test(s)) return 'none';
    if (/친족|친척|인척|관계\s*있|특수관계/.test(s)) return 'relative';
  }
  if (en === 'assetKind') {
    if (/토지\s*[+·]\s*건물|토지와\s*건물/.test(s)) return 'land_building';
    if (/토지|땅|농지|임야|대지|전\b|답\b/.test(s)) return 'land';
    if (/건물|아파트|오피스텔|주택|상가|빌라|다세대|구분소유/.test(s)) return 'building';
    if (/주식|출자/.test(s)) return 'stock';
  }
  if (en === 'transferCause') {
    if (/수용|보상/.test(s)) return 'expropriation';
    if (/교환/.test(s)) return 'exchange';
    if (/부담부/.test(s)) return 'gift_burden';
    if (/매매|매도|양도|거래/.test(s)) return 'sale';
  }
  return '';
}
function ledgerValueText_(path, v) {
  if (v === undefined || v === null || v === '') return '(비어 있음)';
  if (path === 'ov.세목' && typeof CASEPROC_TAX_LABEL_ !== 'undefined' && CASEPROC_TAX_LABEL_[v]) return CASEPROC_TAX_LABEL_[v]; // 세목 코드(transfer·gift·inheritance)를 화면에 그대로 보이지 않게
  const en = ledgerEnumOf_(path);
  if (en && LEDGER_ENUMS_[en].ko[v]) return LEDGER_ENUMS_[en].ko[v];
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  if (path === 'costs' && typeof v === 'object') { const s = function (l) { return (l || []).reduce(function (t, x) { return t + (Number(x.amount) || 0); }, 0); }; return '취득비용 ' + s(v.acq).toLocaleString('ko-KR') + '원(' + (v.acq || []).length + '건) · 양도비용 ' + s(v.tr).toLocaleString('ko-KR') + '원(' + (v.tr || []).length + '건)'; }
  if (/(Price|Amount|Value|StandardPrice|Assumed|Fee|PaidTax|DeductionUsed|Fmv)$|^taxfee$|^relFmv$/.test(path) && /^\d+$/.test(String(v))) return Number(v).toLocaleString('ko-KR') + '원'; // 금액 칸만 "원"(면적·층·사람 수에 원이 붙던 것)
  if (typeof v === 'number') return String(v);
  // [2026.10.29] 목록·묶음 값(물건목록·가설 거래 여러 건 등)은 사람이 읽는 글로 — 화면에 기계 형식({"assetType":…})이 보이던 것.
  //  묶음 안에서는 한글·숫자가 든 값만(코드값 house·building 같은 것은 뺌) 앞에서 넷까지
  if (Array.isArray(v)) return v.map(function (x) { return x && typeof x === 'object' ? ledgerObjText_(x) : String(x); }).filter(Boolean).join(' / ').slice(0, 160) || '(비어 있음)';
  if (typeof v === 'object') return ledgerObjText_(v).slice(0, 160) || '(비어 있음)';
  return String(v).slice(0, 120);
}

function ledgerObjText_(o) {
  const out = [];
  Object.keys(o || {}).forEach(function (k) { const x = o[k]; if (out.length >= 4 || x === '' || x == null || typeof x === 'object' || typeof x === 'boolean') return; const s = String(x).trim(); if (/[가-힣0-9]/.test(s)) out.push(/^\d{4,}$/.test(s) && /(Price|Amount|가액|금액)/i.test(k) ? Number(s).toLocaleString('ko-KR') + '원' : s); });
  return out.join(' · ');
}
// ── 쓰기 — 장부에 값을 적는 유일한 길 ──
// input: { path, value, kind(세무사님|넥스|서류|규칙|추정|계산), by(기록 주체 — 생략하면 kind), file, page, quote(원문 한 줄), why, sure(확실|애매|모름), cands:[{v,src}], label, estimate(true면 추정) }
function ledgerSet_(caseId, input) {
  const pre = ledgerSetPrep_(input);
  if (pre.error) return { ok: false, error: pre.error };
  return ledgerMutate_(caseId, function (L) { return ledgerSetInner_(L, pre); });
}
// 여러 줄을 한 번에(잠금·드라이브 쓰기 1회) — GAS 서류 읽기 결과·질문 목록 옮기기에
function ledgerBatch_(caseId, ops) {
  const preps = (ops || []).map(function (op) { return op && op.ask ? { ask: op } : op && op.drop ? { drop: op } : ledgerSetPrep_(op); });
  return ledgerMutate_(caseId, function (L) {
    const out = { ok: true, set: 0, asked: 0, refused: 0, dropped: 0, errors: [] };
    preps.forEach(function (p) {
      if (p.error) { out.errors.push(p.error); return; }
      if (p.drop) { const d = p.drop, r0 = L.rows[d.path]; if (!r0) return; delete L.rows[d.path]; out.dropped++; ledgerLogTo_(L, { by: d.by || 'GAS', what: '값 지움', path: d.path, detail: (r0.label || d.path) + ' ' + ledgerValueText_(d.path, r0.v) + ' — 서류를 다시 읽어 더는 나오지 않는 값' }); return; }
      // [2026.10.29] GAS 물음은 사람·넥스가 넣은 추정 칸을 물음으로 되돌리지 않는다(ledgerQWrite_와 같음)
      if (p.ask) { const a = p.ask, prev = L.rows[a.path]; if (prev && (prev.state === '확정' || prev.state === '추정') && ((LEDGER_RANK_[prev.src && prev.src.kind] || 0) > 1 || ((a.by || 'GAS') === 'GAS' && ledgerKeptEstimate_(prev)))) return; ledgerAskInner_(L, a.path, { label: a.label, question: a.question, cands: a.cands, by: a.by || 'GAS', needDoc: !!a.needDoc, keep: true }); out.asked++; return; }
      const r = ledgerSetInner_(L, p);
      if (r.ok && r.asked) out.asked++; else if (r.ok) out.set++; else if (r.refused) out.refused++; else out.errors.push(r.error);
    });
    return out;
  });
}
// [2026.10.29] 세무사님·넥스가 넣은 추정(의뢰서 값 추정으로·가정값) — GAS의 "서류에 없음" 물음이 되돌리지 않는 칸
function ledgerKeptEstimate_(r) { return !!(r && r.state === '추정' && r.v !== '' && r.v != null && r.src && /^(세무사님|넥스)$/.test(String(r.src.who || ''))); }
function ledgerSetPrep_(input) {
  input = input || {};
  const path = String(input.path || '').trim();
  if (!path) return { error: '칸 경로(path)가 필요합니다' };
  const kind = LEDGER_KINDS_.indexOf(input.kind) !== -1 ? input.kind : (input.estimate ? '추정' : '세무사님');
  const sure = input.estimate ? '애매' : (LEDGER_SURE_.indexOf(input.sure) !== -1 ? input.sure : '확실');
  const by = String(input.by || (kind === '서류' || kind === '규칙' || kind === '계산' ? 'GAS' : kind)).slice(0, 6);
  const hasValue = !(input.value === undefined || input.value === null || (typeof input.value === 'string' && !input.value.trim()));
  let norm = { v: '' };
  if (hasValue) { norm = ledgerNorm_(path, input.value); if (norm.error) return { error: norm.error }; }
  const label = String(input.label || ledgerLabel_(path)).slice(0, 40);
  const src = { kind: kind, who: by, file: String(input.file || '').slice(0, 80), page: String(input.page || '').slice(0, 10), quote: String(input.quote || '').slice(0, 160), why: String(input.why || '').slice(0, 160) };
  return { path: path, kind: kind, sure: sure, by: by, hasValue: hasValue, norm: norm, label: label, src: src, cands: input.cands || [], estimate: !!input.estimate, why: input.why };
}
function ledgerSetInner_(L, p) {
  const path = p.path, kind = p.kind, sure = p.sure, by = p.by, hasValue = p.hasValue, norm = p.norm, label = p.label, src = p.src, input = { cands: p.cands, estimate: p.estimate, why: p.why };
  {
    const prev = L.rows[path] || null;
    const prevKind = prev && prev.src ? prev.src.kind : '';
    const prevSettled = prev && (prev.state === '확정' || prev.state === '추정') && prev.v !== '' && prev.v !== undefined && prev.v !== null;
    // 서류·규칙(GAS)은 사람·넥스가 다룰 줄(물어볼것·증빙받을것·보류·무시)을 건드리지 않는다 — 질문은 사람·넥스가 풀거나, GAS가 ask로 후보를 더할 뿐
    // [2026.10.29 되먹임 — 서류를 나눠 넣는 시험에서 드러남] 단, 서류가 없어서 GAS가 세운 물음(물어볼것·증빙받을것, 값 없음, 출처 '질문'·GAS, 사람 결정 없음)은 서류가 들어오면 서류 값으로 채운다.
    //  예전엔 서류가 늦게 들어온 사건에서 처음 바퀴에 선 "양도가액 — 서류 없음" 물음이 끝까지 남아, 계약서가 들어와도 칸이 비었다(일방통행). 사람·넥스가 세운 물음·보류·무시와
    //  서류끼리 값이 달라 선 물음(출처가 서류)은 그대로 막는다
    //  장부가 "서류가 있는데 없다고 본 추정"을 물음으로 바꾼 칸(kbAsk — 바탕 후보 붙이기)도 같다: 그 서류를 GAS 규칙이 확실하게 읽어 오면 그 값으로 풀린다(추정 0원을 다시 쓰는 것은 막힘 — 추정은 확실이 아님)
    const noHumanQ = !(prev && prev.qd && Object.keys(prev.qd).some(function (id) { return prev.qd[id] && /^(보류|무시|done)$/.test(prev.qd[id].d); }));
    const gasMissingQ = prev && /^(물어볼것|증빙받을것)$/.test(prev.state) && noHumanQ && (kind === '서류' || kind === '규칙') && sure === '확실' && !input.estimate &&
      ((prev.src && prev.src.kind === '질문' && /^(GAS)?$/.test(String(prev.src.who || '')) && (prev.v === '' || prev.v === undefined || prev.v === null)) || (prev.kbAsk && prev.src && /^(규칙|서류|추정)$/.test(prev.src.kind)));
    if (prev && /^(물어볼것|증빙받을것|보류|무시)$/.test(prev.state) && (LEDGER_RANK_[kind] || 0) <= 1 && !input.estimate && !gasMissingQ) return { ok: false, refused: true, quiet: true, message: '「' + label + '」은 ' + prev.state + ' 상태 — 서류·규칙 값으로 바꾸지 않음' };
    // 같은 주인이 같은 값을 다시 적는 것은 기록하지 않는다(GAS가 서류를 다시 읽을 때마다 이력이 불지 않게)
    if (prevSettled && prevKind === kind && hasValue && JSON.stringify(prev.v) === JSON.stringify(norm.v)) return { ok: true, same: true, row: ledgerRowOut_(path, prev), message: '「' + label + '」 그대로' };
    // ①② 값 주인 우열 — 낮은 급은 높은 급의 값을 덮지 못한다(넥스가 넥스 값, 세무사님이 세무사님 값은 바꿀 수 있다)
    if (prevSettled && (LEDGER_RANK_[kind] || 0) < (LEDGER_RANK_[prevKind] || 0)) {
      return { ok: false, refused: true, prev: ledgerRowOut_(path, prev), message: '「' + label + '」은 ' + prevKind + '이 정한 값(' + ledgerValueText_(path, prev.v) + ')입니다 — ' + kind + '은(는) 바꾸지 못합니다. 서류 값이 다르면 그 사실만 말씀드립니다.' };
    }
    // ③ 서류·규칙끼리는 더 확실한 쪽만 덮는다(같은 확신이면 나중 것 — 교차검증은 넥스·규칙이 따로 한다)
    if (prevSettled && (kind === '서류' || kind === '규칙') && (prevKind === '서류' || prevKind === '규칙') && prev.sure === '확실' && sure !== '확실') {
      return ledgerAskInner_(L, path, { label: label, question: '서류끼리 값이 다릅니다 — ' + ledgerValueText_(path, prev.v) + '(' + (prev.src.file || prevKind) + ') / ' + ledgerValueText_(path, norm.v) + '(' + (src.file || kind) + ')', cands: [{ v: prev.v, src: prev.src.file || prevKind }, { v: norm.v, src: src.file || kind }].concat(input.cands || []), by: by, keep: true });
    }
    // ④ 서류·규칙이 애매·모름이면 값을 정하지 않고 물어볼 것으로(후보와 함께)
    if ((kind === '서류' || kind === '규칙') && sure !== '확실' && !input.estimate) {
      const cands = (input.cands || []).slice();
      if (hasValue && !cands.some(function (x) { return String(x.v) === String(norm.v); })) cands.unshift({ v: norm.v, src: (src.file ? src.file : kind) + (src.quote ? ' "' + src.quote.slice(0, 60) + '"' : '') });
      return ledgerAskInner_(L, path, { label: label, question: String(input.why || '서류로 확신하지 못함'), cands: cands, by: by, keep: true });
    }
    if (!hasValue) return { ok: false, error: '넣을 값(value)이 없습니다 — 비우려면 ledgerDecide_(무시) 또는 ledgerAsk_' };
    const state = (kind === '추정' || input.estimate) ? '추정' : '확정';
    const row = Object.assign({}, prev || {}, { v: norm.v, label: label, src: src, sure: sure, state: state, ask: '', cands: [], at: caseProcNow_() });
    delete row.kbAsk; // 물음이 값으로 풀렸으면 "서류 있는데 없다고 본 추정" 표시도 내린다
    row.hist = (prev && Array.isArray(prev.hist) ? prev.hist : []).concat([{ at: row.at, by: by, kind: kind, prev: prev ? { v: prev.v, kind: prevKind, state: prev.state } : null, next: { v: norm.v, kind: kind, state: state }, why: src.why || src.quote || '' }]).slice(-30);
    L.rows[path] = row;
    ledgerLogTo_(L, { by: by, what: state === '추정' ? '추정 넣음' : (prev && prev.state === '물어볼것' ? '답 반영' : '값 정함'), path: path, detail: label + ' ' + (prev ? ledgerValueText_(path, prev.v) : '(비어 있음)') + ' → ' + ledgerValueText_(path, norm.v) + ' (' + kind + (src.file ? ' · ' + src.file : '') + (src.why ? ' · ' + src.why.slice(0, 60) : '') + ')' });
    return { ok: true, row: ledgerRowOut_(path, row), note: norm.note || '', message: '「' + label + '」 ← ' + ledgerValueText_(path, norm.v) + (state === '추정' ? ' (추정 — 검토서에 표시)' : '') + (norm.note ? ' (' + norm.note + ')' : '') };
  }
}
function ledgerAskInner_(L, path, o) {
  const prev = L.rows[path] || {};
  // 같은 질문이 이미 서 있으면 그대로(기록·이력을 불리지 않음) — 화면이 질문 목록을 저장할 때마다 다시 오기 때문
  const sameState = prev.state === (o.needDoc ? '증빙받을것' : '물어볼것');
  if (sameState && String(prev.ask || '') === String(o.question || '').slice(0, 300) && JSON.stringify((prev.cands || []).map(function (x) { return String(x.v); })) === JSON.stringify((o.cands || []).slice(0, 8).map(function (x) { return String(x.v); }))) return { ok: true, asked: true, same: true, row: ledgerRowOut_(path, prev), message: '「' + (prev.label || path) + '」 ' + prev.state + ' 그대로' };
  const row = Object.assign({}, prev, { label: String(o.label || prev.label || ledgerLabel_(path)).slice(0, 40), state: o.needDoc ? '증빙받을것' : '물어볼것', ask: String(o.question || '').slice(0, 300), cands: (o.cands || []).slice(0, 8).map(function (x) { return { v: x.v, src: String(x.src || '').slice(0, 120) }; }), at: caseProcNow_() });
  if (!row.src) row.src = { kind: '질문', who: String(o.by || '').slice(0, 6), file: '', page: '', quote: '', why: '' };
  if (!o.keep) { row.v = prev.v; }
  row.hist = (Array.isArray(prev.hist) ? prev.hist : []).concat([{ at: row.at, by: o.by || '', kind: '질문', prev: prev.state ? { v: prev.v, state: prev.state } : null, next: { state: row.state }, why: row.ask }]).slice(-30);
  L.rows[path] = row;
  ledgerLogTo_(L, { by: o.by || '', what: row.state, path: path, detail: row.label + ' — ' + row.ask.slice(0, 120) + (row.cands.length ? ' · 후보 ' + row.cands.length + '개' : '') });
  return { ok: true, asked: true, row: ledgerRowOut_(path, row), message: '「' + row.label + '」 ' + row.state + '으로 둠' + (row.cands.length ? ' — 후보 ' + row.cands.map(function (x) { return ledgerValueText_(path, x.v); }).join(' / ') : '') };
}
// 물어볼 것·증빙 받을 것으로 세우기(값은 두고 상태만) — 넥스·GAS가 "모르겠다"를 적는 길
function ledgerAsk_(caseId, input) {
  input = input || {};
  const path = String(input.path || '').trim(); if (!path) return { ok: false, error: '칸 경로(path)가 필요합니다' };
  return ledgerMutate_(caseId, function (L) {
    const prev = L.rows[path];
    if (prev && prev.state === '확정' && prev.src && prev.src.kind === '세무사님' && input.by !== '세무사님') return { ok: false, refused: true, message: '「' + (prev.label || path) + '」은 세무사님이 정한 값입니다 — 다시 묻지 않습니다. 서류 값이 다르면 그 사실만 말씀드립니다.' };
    return ledgerAskInner_(L, path, { label: input.label, question: input.question, cands: input.cands, by: input.by || '넥스', needDoc: !!input.needDoc, keep: true });
  });
}
// 보류·무시·확인(값 그대로 확정) — 세무사님·넥스의 결정
function ledgerDecide_(caseId, input) {
  input = input || {};
  const path = String(input.path || '').trim(); if (!path) return { ok: false, error: '칸 경로(path)가 필요합니다' };
  const d = { 보류: '보류', 무시: '무시', 확인: '확정', done: '확정', 확정: '확정' }[String(input.decision || '').trim()];
  if (!d) return { ok: false, error: '결정은 확인·보류·무시 중 하나입니다' };
  const by = String(input.by || '세무사님').slice(0, 6);
  return ledgerMutate_(caseId, function (L) {
    const prev = L.rows[path] || { label: ledgerLabel_(path) };
    if (d === '확정' && (prev.v === undefined || prev.v === null || prev.v === '')) return { ok: false, error: '「' + prev.label + '」에 값이 없어 확인으로 닫지 못합니다 — 값을 넣거나 보류·무시로' };
    const row = Object.assign({}, prev, { state: d, at: caseProcNow_(), note: String(input.note || '').slice(0, 200) });
    if (d === '확정') { row.src = Object.assign({}, prev.src || {}, { kind: by === '넥스' ? '넥스' : '세무사님', who: by }); row.sure = '확실'; row.ask = ''; }
    row.hist = (Array.isArray(prev.hist) ? prev.hist : []).concat([{ at: row.at, by: by, kind: '결정', prev: { state: prev.state }, next: { state: d }, why: row.note }]).slice(-30);
    L.rows[path] = row;
    ledgerLogTo_(L, { by: by, what: '결정 ' + d, path: path, detail: row.label + (row.note ? ' — ' + row.note : '') });
    return { ok: true, row: ledgerRowOut_(path, row), message: '「' + row.label + '」 → ' + d };
  });
}
// 되돌리기 — 마지막 고침을 전 값으로(세무사님 요청 또는 넥스가 자기 값만)
function ledgerUndo_(caseId, input) {
  input = input || {};
  const path = String(input.path || '').trim(); if (!path) return { ok: false, error: '칸 경로(path)가 필요합니다' };
  const by = String(input.by || '세무사님').slice(0, 6);
  return ledgerMutate_(caseId, function (L) {
    const row = L.rows[path]; if (!row || !Array.isArray(row.hist) || !row.hist.length) return { ok: false, error: '되돌릴 기록이 없습니다' };
    const last = row.hist[row.hist.length - 1];
    if (by === '넥스' && row.src && row.src.kind === '세무사님') return { ok: false, refused: true, message: '세무사님이 정한 값은 넥스가 되돌리지 않습니다' };
    const back = last.prev || { v: '', state: '물어볼것' };
    const nrow = Object.assign({}, row, { v: back.v === undefined ? '' : back.v, state: back.state || (back.v ? '확정' : '물어볼것'), at: caseProcNow_() });
    if (back.kind) nrow.src = Object.assign({}, row.src || {}, { kind: back.kind });
    nrow.hist = row.hist.concat([{ at: nrow.at, by: by, kind: '되돌림', prev: { v: row.v, state: row.state }, next: { v: nrow.v, state: nrow.state }, why: '' }]).slice(-30);
    L.rows[path] = nrow;
    ledgerLogTo_(L, { by: by, what: '되돌림', path: path, detail: (row.label || path) + ' ' + ledgerValueText_(path, row.v) + ' → ' + ledgerValueText_(path, nrow.v) });
    return { ok: true, row: ledgerRowOut_(path, nrow), message: '「' + (row.label || path) + '」 ' + ledgerValueText_(path, nrow.v) + '로 되돌림' };
  });
}
function ledgerRowOut_(path, r) {
  r = r || {};
  return { path: path, label: r.label && !/^[a-zA-Z]/.test(String(r.label)) ? r.label : ledgerLabel_(path), v: r.v === undefined ? '' : r.v, 값: ledgerValueText_(path, r.v), state: r.state || '', kind: r.src ? r.src.kind : '', who: r.src ? r.src.who : '', file: r.src ? r.src.file : '', quote: r.src ? r.src.quote : '', why: r.src ? r.src.why : '', sure: r.sure || '', ask: r.ask || '', cands: (r.cands || []).map(function (x) { return { v: x.v, 값: ledgerValueText_(path, x.v), src: x.src }; }), at: r.at || '', note: r.note || '', histN: (r.hist || []).length, fx: r.fx || [], fk: r.fk || [] };
}
// ── 읽기 ──
function ledgerRows_(caseId, filter) {
  const L = ledgerLoad_(caseId);
  const st = filter && filter.state ? (Array.isArray(filter.state) ? filter.state : [filter.state]) : null;
  return Object.keys(L.rows).filter(function (p) { return !st || st.indexOf(L.rows[p].state) !== -1; }).sort(ledgerPathSort_).map(function (p) { return ledgerRowOut_(p, L.rows[p]); });
}
function ledgerPathSort_(a, b) {
  const g = function (p) { return /^doc:/.test(p) ? 0 : /^기준일$/.test(p) ? 1 : /^seller\./.test(p) ? 2 : /^c\d+\./.test(p) ? 3 : /^a\d+\./.test(p) ? 4 : /^(costs|taxfee)$/.test(p) ? 5 : 6; };
  return g(a) - g(b) || (a < b ? -1 : a > b ? 1 : 0);
}
function ledgerQuestions_(caseId) { return ledgerRows_(caseId, { state: ['물어볼것', '증빙받을것'] }); }
function ledgerReviewNotes_(caseId) { return ledgerRows_(caseId, { state: ['추정', '증빙받을것', '보류'] }); }
function ledgerSummary_(caseId) {
  const L = ledgerLoad_(caseId), n = {};
  LEDGER_STATES_.forEach(function (s) { n[s] = 0; });
  Object.keys(L.rows).forEach(function (p) { n[L.rows[p].state] = (n[L.rows[p].state] || 0) + 1; });
  n.전체 = Object.keys(L.rows).length; n.at = L.at || '';
  return n;
}

// ── 장부 → 세액계산기 상태(양도) — 확정·추정 줄만. 비어 있으면 비어 있는 대로(추정도 없으면 엔진이 "필요합니다"로 알린다) ──
// over: [{path, value}] — [2026.10.29 계획서 3판] 경우 계산의 가정(장부 값은 바꾸지 않고 이번 계산에만). 돌려주는 assumed에 무엇을 가정했는지
function ledgerCalcState_(caseId, over) {
  const L0 = ledgerLoad_(caseId), assumed = [];
  const L = { rows: L0.rows };
  if (Array.isArray(over) && over.length) {
    L.rows = Object.assign({}, L0.rows);
    over.slice(0, 30).forEach(function (x) {
      const p = String((x && x.path) || '').trim().replace(/^calc:/, ''); if (!p) return;
      const n = ledgerNorm_(p, x.value);
      if (n.error) { assumed.push({ 칸: p, 이름: ledgerLabel_(p), error: n.error }); return; }
      const prev = L0.rows[p];
      L.rows[p] = { v: n.v, state: '추정', src: { kind: '가정', who: '' }, label: ledgerLabel_(p) };
      assumed.push({ 칸: p, 이름: ledgerLabel_(p), 전: prev && prev.v !== '' && prev.v != null ? ledgerValueText_(p, prev.v) + (prev.state === '추정' ? '(추정)' : '') : '(비어 있음)', 후: ledgerValueText_(p, n.v) });
    });
  }
  const st = { transferSellers: [{}], transferContracts: [], transferAssets: [], acquisitionContracts: [] };
  const src = {}, used = [];
  const ct = function (i) { while (st.transferContracts.length <= i) { const k = st.transferContracts.length; st.transferContracts.push({ id: 'trc_c' + (k + 1), name: '양도계약 ' + ('0' + (k + 1)).slice(-2), date: '', totalPrice: 0, totalExpenseItems: [], externalMembers: [], buyers: [{}], transferCause: 'sale' }); } return st.transferContracts[i]; };
  const as = function (i) { while (st.transferAssets.length <= i) { const k = st.transferAssets.length; st.transferAssets.push({ id: 'trc_a' + (k + 1) + '_1', transferContractId: 'trc_c' + (k + 1), assetLocation: '', acquisitionDate: '', acquisitionPrice: '', acquisitionExpenseItems: [] }); } return st.transferAssets[i]; };
  Object.keys(L.rows).sort(ledgerPathSort_).forEach(function (p) {
    const r = L.rows[p];
    if (!(r.state === '확정' || r.state === '추정') || r.v === '' || r.v === undefined || r.v === null) return;
    let m;
    if ((m = /^seller\.(\w+)$/.exec(p))) st.transferSellers[0][m[1]] = r.v;
    else if ((m = /^c(\d+)\.buyer\.(\w+)$/.exec(p))) ct(Number(m[1])).buyers[0][m[2]] = r.v;
    else if ((m = /^c(\d+)\.(\w+)$/.exec(p))) ct(Number(m[1]))[m[2]] = r.v;
    else if ((m = /^a(\d+)\.contract$/.exec(p))) { const ci = Number(String(r.v).replace(/\D/g, '')) || 0; ct(ci); as(Number(m[1])).transferContractId = 'trc_c' + (ci + 1); }
    else if ((m = /^a(\d+)\.(\w+)$/.exec(p))) as(Number(m[1]))[m[2]] = r.v;
    else if (p === 'costs') { const a0 = as(0), c0 = ct(0); a0.acquisitionExpenseItems = (r.v.acq || []).map(function (x) { return { label: x.label + (x.file ? ' (' + x.file + ')' : ''), amount: Number(x.amount) || 0, payDate: x.date || '' }; }); c0.totalExpenseItems = (r.v.tr || []).map(function (x) { return { label: x.label + (x.file ? ' (' + x.file + ')' : ''), amount: Number(x.amount) || 0, payDate: x.date || '' }; }); }
    else if (p === 'taxfee') { if (Number(r.v)) ct(0).totalExpenseItems = (ct(0).totalExpenseItems || []).concat([{ label: '양도소득세 신고 세무비용', amount: Number(r.v), payDate: '' }]); }
    else if (p === '사건분류') { ledgerApplyClass_(st, String(r.v)); }
    else return;
    src[p] = r.src; used.push(p);
  });
  // 계약마다 양도자산이 하나는 있어야 엔진이 돈다 — 자산 줄이 전혀 없으면 계약 수만큼 빈 자산
  st.transferContracts.forEach(function (c, i) { if (!st.transferAssets.some(function (a) { return a.transferContractId === c.id; })) as(st.transferAssets.length).transferContractId = c.id; });
  // 자산 과세대상 구분이 비어 있으면 엔진 기본(other)이 조용히 쓰인다 — 비어 있는 자산을 알려 준다
  const gaps = [];
  st.transferAssets.forEach(function (a, i) { ['assetType', 'acquisitionDate', 'acquisitionPrice'].forEach(function (k) { if (a[k] === '' || a[k] === undefined) gaps.push('a' + i + '.' + k); }); });
  st.transferContracts.forEach(function (c, i) { ['date', 'totalPrice'].forEach(function (k) { if (!c[k]) gaps.push('c' + i + '.' + k); }); });
  return { state: st, src: src, used: used, gaps: gaps, 기준일: (L.rows['기준일'] && L.rows['기준일'].v) || '', assumed: assumed };
}
// 사건분류 글 → 계산기 체크(1세대1주택·비사업용·미등기·주택 수) — 서식의 체크 칸과 같다
function ledgerApplyClass_(st, cls) {
  const a0 = st.transferAssets[0] || (st.transferAssets.push({ id: 'trc_a1_1', transferContractId: 'trc_c1' }), st.transferAssets[0]);
  if (/1세대\s*1주택|비과세/.test(cls)) a0.isOneHouseOneFamily = true;
  if (/비사업용/.test(cls)) a0.isNonBusinessLand = true;
  if (/미등기/.test(cls)) a0.isUnregisteredTransfer = true;
  const m = /(\d)\s*주택/.exec(cls); if (m && !st.transferSellers[0].multiHouseCount) st.transferSellers[0].multiHouseCount = m[1];
  if (/특수관계/.test(cls) && st.transferContracts[0] && st.transferContracts[0].buyers[0] && !st.transferContracts[0].buyers[0].relation) st.transferContracts[0].buyers[0].relation = 'relative';
}
// ── 증여·상속 — 계산기 칸을 장부 줄로(처리개요 단계 끝에서 부름) ──
// 증여: 처리개요 칸 = 계산기 칸(GI_CALC_KEYS_ + 기납부세액·이미 쓴 공제) → g.<칸>. 값 주인은 그 칸 근거 기록(filled.src)으로 가른다.
// 상속: 상속 사실(caseProcInhFacts_ — 서류 + 세무사님 세부 답 ihChoices)을 계산기 입력 단위로 → i.<칸>. 세무사님이 장부에서 이 칸을 직접 고치면 그 값이 이긴다(규칙 ①).
var LEDGER_GIFT_KEYS_ = ['giftDoneeName', 'giftDonorName', 'giftRelation', 'giftAmount', 'giftDebtAssumed', 'giftDebtProven', 'giftPriorAmount', 'giftPriorPaidTax', 'giftPriorDeductionUsed', 'giftAppraisalFee'];
function ledgerFromGiftInh_(c, items) {
  if (!c || !/^(gift|inheritance)$/.test(c.세목)) return null;
  const sv = caseProcLoad_(c.id) || {}, filled = sv.filled || {}, ov = c.사건개요 || {}, ops = [];
  const kindOf = function (s) { s = String(s || ''); return /세무사님/.test(s) ? '세무사님' : /🤖|넥스|AI 판단/.test(s) ? '넥스' : /규칙|검산|교차|계산/.test(s) ? '규칙' : '서류'; };
  // est: 서류가 없어서 정한 값(채무 0원·공과금 0원·금융재산 0원처럼 "없음으로 봄")은 확정이 아니라 추정 — 계산은 진행하고 검토서 "추가로 확인할 사항"에 남는다(10-28 원문 "추정치나 가정치를 넣어서 진행할 수도")
  let L00 = null;
  const put = function (path, v, s, sure, est) {
    if (v === undefined || v === null || String(v).trim() === '') return;
    // [2026.10.29] 장부가 "서류가 있는데 없다고 본 추정"을 물음으로 바꾼 칸(kbAsk)은 같은 추정으로 다시 덮지 않는다(답이 오면 그 값이 주인)
    if (est) { L00 = L00 || ledgerLoad_(c.id); const pr = L00.rows[path]; if (pr && pr.kbAsk && pr.state === '물어볼것') return; }
    const kd = kindOf(s);
    ops.push({ path: path, value: v, kind: kd, by: kd === '세무사님' || kd === '넥스' ? kd : 'GAS', quote: String(s || '').slice(0, 160), why: est ? String(est).slice(0, 160) : kd === '세무사님' ? String(s || '').slice(0, 160) : '', sure: sure || '확실', estimate: !!est && kd !== '세무사님' && kd !== '넥스' });
  };
  // [2026.10.29] 기준일은 근거 기록(장부 기준일 줄)이 주인 — 사건 줄 값은 장부에 기준일 줄이 아예 없을 때만 처음 채운다(예전엔 매번 베껴 세무사님이 정한 기준일도 규칙으로 덮였다)
  if (c.기준일 && !(ledgerLoad_(c.id).rows['기준일'] || {}).v) put('기준일', c.기준일, '사건 기준일(작업관리 사건 줄)');
  if (c.세목 === 'gift') {
    // [2026.10.28 증여 값 단일화] 증여 칸은 근거 기록(filled)이 곧 장부 g.<칸> 줄이라 여기서 베끼지 않는다(예전엔 처리개요 값을 근거 기록 출처로 다시 적었다)
  } else {
    let f = null; try { f = caseProcInhFacts_(c); } catch (e) { f = null; }
    if (f) {
      const sum = function (l, key) { return (l || []).reduce(function (t, x) { return t + (Number(x[key || 'amount']) || 0); }, 0); };
      if (f.financialValue != null) put('i.financialAmount', f.financialValue, '규칙 — ' + String(f.financialSrc || '금융재산'), '', f.financialAssumedZero ? '금융재산 서류가 폴더에 없어 0원으로 봄' : '');
      const valued = (f.assets || []).filter(function (a) { return Number(a.value) > 0; });
      if (valued.length) put('i.realEstateAmount', valued.reduce(function (t, a) { return t + Number(a.value); }, 0), '규칙 — 상속재산 평가 ' + valued.length + '건(' + valued.map(function (a) { return String(a.loc || '').slice(0, 20); }).join(', ') + ')');
      const debts = Array.isArray(f.debtsConfirmed) ? f.debtsConfirmed : (f.debts || []).filter(function (d) { return d.sure; });
      const unsure = Array.isArray(f.debtsConfirmed) ? [] : (f.debts || []).filter(function (d) { return !d.sure; });
      if (unsure.length) { // 서류로 확실하지 않은 채무 후보가 있으면 정하지 않고 묻는다(후보와 출처를 함께)
        ops.push({ ask: true, path: 'i.debtAmount', label: '채무', question: '채무 후보 중 서류로 확실하지 않은 것이 ' + unsure.length + '건 있습니다 — ' + unsure.map(function (d) { return (d.src || d.file || '') + ' ' + Number(d.amount || 0).toLocaleString('ko-KR') + '원' + (d.note ? '(' + d.note + ')' : ''); }).join(' / ').slice(0, 220),
          cands: [{ v: sum(debts), src: '확실한 채무만 ' + debts.length + '건' }, { v: sum(debts) + sum(unsure), src: '후보 전부 ' + (debts.length + unsure.length) + '건' }], by: 'GAS' });
      } else put('i.debtAmount', sum(debts), (Array.isArray(f.debtsConfirmed) ? '세무사님 확정 채무' : '규칙 — 서류로 확실한 채무') + ' ' + debts.length + '건', '', debts.length ? '' : '채무 서류에서 읽은 채무가 없어 0원으로 봄');
      put('i.duesAmount', sum(f.dues), '규칙 — 공과금 ' + (f.dues || []).length + '건', '', (f.dues || []).length ? '' : '공과금 서류에서 읽은 것이 없어 0원으로 봄');
      if (f.funeral && f.funeral.value != null && Number(f.funeral.value) > 0) put('i.funeralAmount', f.funeral.value, String(f.funeral.src || '장례비'));
      if (f.niche && f.niche.value != null && Number(f.niche.value) > 0) put('i.nicheAmount', f.niche.value, String(f.niche.src || '봉안시설'));
      if (f.appraisalFee && f.appraisalFee.value) put('i.appraisalFeeAmount', f.appraisalFee.value, String(f.appraisalFee.src || '감정평가수수료'));
      const pgs = Array.isArray(f.priorGifts) ? f.priorGifts : [];
      if (pgs.length) { put('i.priorGiftHeirAmount', pgs.filter(function (g) { return g.heir; }).reduce(function (t, g) { return t + (Number(g.v) || 0); }, 0), '세무사님 답 — 사전증여(상속인 10년)'); put('i.priorGiftOtherAmount', pgs.filter(function (g) { return !g.heir; }).reduce(function (t, g) { return t + (Number(g.v) || 0); }, 0), '세무사님 답 — 사전증여(그 밖 5년)'); }
      if ((f.heirs || []).length) {
        const hs = f.heirs[0] && f.heirs[0].src;
        put('i.heirCount', String(f.heirs.length), '규칙 — ' + String(hs || '가족관계증명서'));
        put('i.isSpouse', f.heirs.some(function (h) { return h.relation === '배우자'; }), '규칙 — ' + String(hs || '가족관계증명서'));
        put('i.childCount', String(f.heirs.filter(function (h) { return h.relation === '자녀'; }).length), '규칙 — ' + String(hs || '가족관계증명서'));
      }
      if (f.deceased && f.deceased.name) put('i.deceasedName', f.deceased.name, String(f.deceased.src || '사망 서류'));
    }
  }
  const res = ledgerBatch_(c.id, ops); // 질문은 처리개요 끝(caseProcOverview_)에서 세목 가리지 않고 한 번에 장부로
  try { const kb = ledgerKbLoad_(c.id); if (kb && kb.facts) res.offered = ledgerKbOffer_(c.id, kb.facts); } catch (e) {} // [2026.10.29] 방금 쓴 칸이 추정·물음이면 장부가 모은 서류 사실을 후보로
  return res;
}
function ledgerGiftInput_(c, L) {
  const row = function (p) { const r = L.rows[p]; return r && (r.state === '확정' || r.state === '추정') ? r.v : ''; };
  const dg = function (x) { return Number(String(x == null ? '' : x).replace(/[^\d]/g, '')) || 0; };
  const amt = dg(row('g.giftAmount')), rel = String(row('g.giftRelation') || '');
  const gaps = []; if (!amt) gaps.push('g.giftAmount'); if (!rel) gaps.push('g.giftRelation');
  if (gaps.length) return { gaps: gaps };
  const input = { giftAmount: amt, relation: /^배우자/.test(rel) ? '배우자' : /^직계존속/.test(rel) ? '직계존속' : /^직계비속/.test(rel) ? '직계비속' : /기타\s*친족/.test(rel) ? '기타친족' : '기타', isGenerationSkip: /2촌\s*이상|조부|손자|손녀|세대\s*생략/.test(rel), giftDate: row('기준일') || c.기준일 || undefined, isDoneeResident: true };
  if (dg(row('g.giftDebtAssumed'))) { input.debtAssumedAmount = dg(row('g.giftDebtAssumed')); input.isDebtObjectivelyProven = !/없|아니|미입증/.test(String(row('g.giftDebtProven') || '')); }
  if (dg(row('g.giftPriorAmount'))) input.priorGiftAmount = dg(row('g.giftPriorAmount'));
  if (dg(row('g.giftPriorPaidTax'))) input.priorPaidTax = dg(row('g.giftPriorPaidTax'));
  if (dg(row('g.giftPriorDeductionUsed'))) input.priorRelationDeductionUsed = dg(row('g.giftPriorDeductionUsed'));
  if (dg(row('g.giftAppraisalFee'))) input.appraisalFeeAmount = dg(row('g.giftAppraisalFee'));
  const open = ledgerQuestions_(c.id).filter(function (q) { return /^g\.giftPrior/.test(q.path); });
  return { input: input, gaps: open.length ? open.map(function (q) { return q.path; }) : [] };
}
function ledgerInhInput_(c, L) {
  const row = function (p) { const r = L.rows[p]; return r && (r.state === '확정' || r.state === '추정') ? r.v : ''; };
  const dg = function (x) { return Number(String(x == null ? '' : x).replace(/[^\d]/g, '')) || 0; };
  const fin = dg(row('i.financialAmount')), re = dg(row('i.realEstateAmount')), gross = fin + re;
  const gaps = []; if (!gross) gaps.push('i.financialAmount·i.realEstateAmount'); if (row('i.heirCount') === '') gaps.push('i.heirCount');
  if (!gross) return { gaps: gaps };
  const pgH = dg(row('i.priorGiftHeirAmount')), pgO = dg(row('i.priorGiftOtherAmount'));
  const input = { taxableEstateAmount: Math.max(0, gross - dg(row('i.debtAmount')) - dg(row('i.duesAmount'))) + pgH + pgO, appraisalFeeAmount: dg(row('i.appraisalFeeAmount')),
    hasSpouse: row('i.isSpouse') === true || row('i.isSpouse') === 'true', childCount: dg(row('i.childCount')), netFinancialAssets: fin,
    funeralCostAmount: dg(row('i.funeralAmount')), funeralNicheCostAmount: dg(row('i.nicheAmount')), isDecedentResident: true };
  if (pgH + pgO) { input.priorGiftedAmountIncludedInEstate = pgH + pgO; if (pgH) input.giftToHeirsWithin10Years = pgH; if (pgO) input.nonHeirPriorGiftAmountTotal = pgO; }
  const open = ledgerQuestions_(c.id).filter(function (q) { return /^i\./.test(q.path); });
  return { input: input, gaps: gaps.concat(open.map(function (q) { return q.path; })) };
}
// 장부로 세액계산기를 돌려 사건에 저장(기본 저장본 — 구분 '장부 계산'). 추정 줄이 있으면 요약에 적는다
function ledgerCalcRun_(c, body) {
  body = body || {};
  if (c.세목 === 'gift' || c.세목 === 'inheritance') return ledgerCalcGiftInh_(c, body);
  if (c.세목 !== 'transfer') return { ok: false, error: '장부 계산은 양도·증여·상속만 합니다' };
  const by = String(body.by || '넥스').slice(0, 6);
  // [2026.10.29 계획서 3판] 시험 계산 — 언제든(물어볼 것이 남아도), 경우 이름(name)·가정(over)을 붙여 저장. 장부 값은 바뀌지 않는다
  const cs = ledgerCalcState_(c.id, body.over);
  const badOver = (cs.assumed || []).filter(function (a) { return a.error; });
  if (badOver.length) return { ok: false, error: '가정 값을 넣지 못함: ' + badOver.map(function (a) { return a.error; }).join(' / ') };
  if (!cs.state.transferContracts.length) return { ok: false, error: '장부에 양도계약 줄(양도일·양도가액)이 없습니다 — 의뢰서 등에 거래가 있으면 「의뢰서 값을 추정으로」(case_ledger do=estimate)로 먼저 넣거나, 가정(over)으로 주세요', gaps: cs.gaps };
  const inputs = trcEngineInputs_(cs.state, cs.기준일 || c.기준일 || '');
  const res = runUiEngineCalcTool_('calculate_transfer_tax_multi', { transactions: inputs });
  if (!res || res.error) return { ok: false, error: '계산 실패: ' + ((res && res.error) || '엔진 없음'), gaps: cs.gaps };
  const won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
  const est = ledgerReviewNotes_(c.id);
  const lines = ['거래 ' + res.거래건수 + '건 · 비과세 ' + res.비과세건수 + '건', '합산과세표준 ' + won(res.합산과세표준), '산출세액 합계 ' + won(res.산출세액_합계), '지방소득세 ' + won(res.지방소득세), '납부세액 합계 ' + won(res.납부세액_합계)];
  if ((cs.assumed || []).length) lines.push('이번 계산의 가정(장부 값은 그대로) ' + cs.assumed.length + '칸: ' + cs.assumed.map(function (a) { return a.이름 + ' ' + a.전 + ' → ' + a.후; }).join(', ').slice(0, 300));
  if (est.length) lines.push('추가로 확인할 사항 ' + est.length + '건: ' + est.map(function (r) { return r.label + '(' + r.state + (r.state === '추정' ? ' ' + r.값 : '') + ')'; }).join(', ').slice(0, 300));
  if (cs.gaps.length) lines.push('비어 있는 칸: ' + cs.gaps.map(ledgerLabel_).join(', ').slice(0, 200));
  const all = Array.isArray(c.세액계산결과) ? c.세액계산결과 : [];
  const nm = String(body.name || '').trim().slice(0, 60);
  const isCase = !!nm || (cs.assumed || []).length > 0;
  const name = nm || ('장부 경우 ' + (all.filter(function (e) { return e && e.안; }).length + 1));
  const entry = { id: 'tc_' + Date.now(), 세목: '양도소득세', 구분: isCase ? '경우(안) 장부 계산' : '장부 계산(서버)', 요약: [(isCase ? '[경우(안)] ' + name : '[장부 계산] ' + (c.사건명 || c.고객명 || '')), '장부 줄 ' + cs.used.length + '개(확정·추정)'].concat(lines, [body.why ? '이유: ' + String(body.why).slice(0, 200) : '']).filter(Boolean).join('\n'), 최종세액: Number(res.납부세액_합계), 계산일: caseProcToday_(), 기준일스냅샷: String(c.기준일 || ''),
    저장값: Object.assign({ ledger: true, inputs: { transactions: inputs }, result: { 거래건수: res.거래건수, 비과세건수: res.비과세건수, 합산과세표준: res.합산과세표준, 산출세액_합계: res.산출세액_합계, 지방소득세: res.지방소득세, 납부세액_합계: res.납부세액_합계 } }, cs.state) };
  if (isCase) entry.안 = { 이름: name, 세목: 'transfer', 바꾼칸: (cs.assumed || []).map(function (a) { return { 칸: a.칸, 이름: a.이름, 전: a.전, 후: a.후 }; }), 누가: by, 때: caseProcNow_(), 바탕: '사건 장부(정함+추정)', 바탕저장본id: '', 이유: String(body.why || '').slice(0, 200), 추정: est.filter(function (r) { return r.state === '추정'; }).map(function (r) { return r.label + ' ' + r.값; }).slice(0, 20) };
  const up = work_updateCase({ id: c.id, 세액계산결과추가: entry /* [2026.10.30] 잠금 안 덧붙이기 — 잇단 저장이 앞 저장본을 덮지 않게 */ });
  if (!up || up.success === false) return { ok: false, error: '저장 실패: ' + ((up && up.message) || '사건 행을 못 고침') };
  ledgerMutate_(c.id, function (L) { ledgerLogTo_(L, { by: by, what: isCase ? '경우 계산 저장' : '세액계산 저장', path: entry.id, detail: (isCase ? name + ' — ' : '') + '납부세액 ' + won(res.납부세액_합계) + ((cs.assumed || []).length ? ' · 가정 ' + cs.assumed.length + '칸' : '') + (est.length ? ' · 추정·보류 ' + est.length + '건' : '') + (cs.gaps.length ? ' · 빈 칸 ' + cs.gaps.length : '') }); });
  return { ok: true, id: entry.id, 이름: isCase ? name : '', 최종세액: Number(res.납부세액_합계), 요약: lines, gaps: cs.gaps, 가정: cs.assumed || [], 추가확인: est.map(function (r) { return r.label + ' — ' + r.state + (r.ask ? ': ' + r.ask : ''); }), message: (isCase ? '경우(안) 「' + name + '」 ' : '') + '세액계산 저장(' + entry.id + ') — 납부세액 ' + won(res.납부세액_합계) + (cs.gaps.length ? ' · 빈 칸 ' + cs.gaps.length + '개' : '') + (est.filter(function (r) { return r.state === '추정'; }).length ? ' · 추정 ' + est.filter(function (r) { return r.state === '추정'; }).length + '칸으로 계산' : '') };
}

function ledgerCalcGiftInh_(c, body) {
  const by = String((body && body.by) || '넥스').slice(0, 6), L = ledgerLoad_(c.id), gift = c.세목 === 'gift';
  const b = gift ? ledgerGiftInput_(c, L) : ledgerInhInput_(c, L);
  if (!b.input) return { ok: false, error: '장부에 계산기 필수 칸이 없음: ' + (b.gaps || []).join(', '), gaps: b.gaps };
  // [2026.10.29 계획서 3판] 경우 이름·가정 — 증여·상속은 엔진 입력 이름(giftAmount·relation·taxableEstateAmount…)으로 이번 계산에만 바꿔 넣는다(장부 값은 그대로)
  const nm = String((body && body.name) || '').trim().slice(0, 60), assumed = [];
  (Array.isArray(body && body.over) ? body.over : []).slice(0, 20).forEach(function (x) {
    const k = String((x && x.path) || '').trim(); if (!k) return;
    const prev = b.input[k]; let v = x.value;
    if (typeof prev === 'number' || /Amount|Count|Value|Price|Years|Total|Fee|Within/.test(k)) v = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')) || 0; else if (typeof prev === 'boolean' || /^(is|has)[A-Z]/.test(k)) v = /^(true|1|예|있음|해당|적용|yes|y)$/i.test(String(v).trim()); else v = String(v == null ? '' : v).trim();
    b.input[k] = v; assumed.push({ 칸: k, 이름: k, 전: prev == null ? '(비어 있음)' : String(prev), 후: String(v) });
  });
  const r = runUiEngineCalcTool_(gift ? 'calculate_gift_tax' : 'calculate_inheritance_tax', b.input);
  if (!r || r.error) return { ok: false, error: '계산 실패: ' + ((r && r.error) || '엔진 없음'), gaps: b.gaps };
  const won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
  const est = ledgerReviewNotes_(c.id), label = gift ? '증여세' : '상속세';
  const 산출 = gift ? (r.산출세액_할증후 != null ? r.산출세액_할증후 : r.산출세액) : r.산출세액;
  const lines = ['과세표준 ' + won(r.과세표준), '산출세액 ' + won(산출), '신고세액공제 ' + won(r.신고세액공제), '납부세액 ' + won(r.납부세액)];
  if (est.length) lines.push('추가로 확인할 사항 ' + est.length + '건: ' + est.map(function (x) { return x.label + '(' + x.state + ')'; }).join(', ').slice(0, 300));
  if ((b.gaps || []).length) lines.push('남은 물어볼 것·빈 칸: ' + b.gaps.map(ledgerLabel_).join(', ').slice(0, 200));
  const all = Array.isArray(c.세액계산결과) ? c.세액계산결과 : [];
  if (assumed.length) lines.push('이번 계산의 가정(장부 값은 그대로): ' + assumed.map(function (a) { return a.이름 + ' ' + a.전 + ' → ' + a.후; }).join(', ').slice(0, 300));
  const isCase = !!nm || assumed.length > 0, name = nm || (label + ' 장부 경우 ' + (all.filter(function (e) { return e && e.안; }).length + 1));
  const entry = { id: 'tc_' + Date.now(), 세목: label, 구분: isCase ? '경우(안) 장부 계산' : '장부 계산(서버)', 요약: [isCase ? '[경우(안)] ' + name : '[장부 계산] ' + (c.사건명 || c.고객명 || '')].concat(lines).join('\n'), 최종세액: Number(r.납부세액), 계산일: caseProcToday_(), 기준일스냅샷: String(c.기준일 || ''), 저장값: { ledger: true, tax: c.세목, inputs: b.input, result: { 과세표준: r.과세표준, 산출세액: 산출, 신고세액공제: r.신고세액공제, 납부세액: r.납부세액 } } };
  if (isCase) entry.안 = { 이름: name, 세목: c.세목, 바꾼칸: assumed, 누가: by, 때: caseProcNow_(), 바탕: '사건 장부(정함+추정)', 바탕저장본id: '', 이유: String((body && body.why) || '').slice(0, 200) };
  const up = work_updateCase({ id: c.id, 세액계산결과추가: entry /* [2026.10.30] 잠금 안 덧붙이기 — 잇단 저장이 앞 저장본을 덮지 않게 */ });
  if (!up || up.success === false) return { ok: false, error: '저장 실패: ' + ((up && up.message) || '사건 행을 못 고침') };
  ledgerMutate_(c.id, function (L2) { ledgerLogTo_(L2, { by: by, what: '세액계산 저장', path: entry.id, detail: label + ' 납부세액 ' + won(r.납부세액) + ((b.gaps || []).length ? ' · 남은 것 ' + b.gaps.length : '') }); });
  return { ok: true, id: entry.id, 최종세액: Number(r.납부세액), 요약: lines, gaps: b.gaps || [], input: b.input, message: label + ' 계산 저장(' + entry.id + ') — 납부세액 ' + won(r.납부세액) };
}
// ── 옛 저장소 → 장부 한 번 옮기기(장부가 비어 있을 때만) — 값 주인은 출처 글로 가른다(세무사님/🤖·넥스/그 외 서류) ──
function ledgerImportLegacy_(c) {
  const sv = caseProcLoad_(c.id) || {}; // 먼저 불러 둔다 — 옛 질문·결정이 있으면 이때 장부 질문 줄로 옮겨진다
  const L0 = ledgerLoad_(c.id), valued = Object.keys(L0.rows).filter(function (p) { return !/^q:/.test(p) && L0.rows[p].v !== '' && L0.rows[p].v !== undefined && L0.rows[p].v !== null; });
  if (valued.length) return { ok: true, skipped: true, message: '장부에 값이 이미 있어 옮기지 않음(' + valued.length + '줄)' };
  const tr = sv.trAns || {}, st = sv.trCalc && sv.trCalc.state, tsrc = (sv.trCalc && sv.trCalc.src) || {};
  const kindOf = function (s) { s = String(s || ''); return /세무사님/.test(s) ? '세무사님' : /🤖|AI 판단|넥스/.test(s) ? '넥스' : /규칙 정리|빠른 날|검산/.test(s) ? '규칙' : '서류'; };
  let n = 0, asked = 0;
  return ledgerMutate_(c.id, function (L) {
    const put = function (path, v, srcTxt, sure) {
      if (v === '' || v === undefined || v === null) return;
      const norm = ledgerNorm_(path, v); if (norm.error) { L.rows[path] = Object.assign(ledgerAskInner_(L, path, { question: '옛 값이 칸 모양에 안 맞음: ' + norm.error, cands: [{ v: v, src: srcTxt }], by: '옮김', keep: true }).row ? L.rows[path] : {}, {}); asked++; return; }
      const kind = kindOf(srcTxt);
      L.rows[path] = { v: norm.v, label: ledgerLabel_(path), src: { kind: kind, who: kind === '서류' || kind === '규칙' ? 'GAS' : kind, file: (String(srcTxt).match(/[\w가-힣().\- ]+\.(pdf|jpg|jpeg|png|xlsx?|hwp|docx?)/i) || [''])[0].slice(0, 80), page: '', quote: String(srcTxt).slice(0, 160), why: '옛 저장소에서 옮김' }, sure: sure || '확실', state: '확정', ask: '', cands: [], at: caseProcNow_(), hist: [{ at: caseProcNow_(), by: '옮김', kind: kind, prev: null, next: { v: norm.v, kind: kind, state: '확정' }, why: '옛 저장소(trAns·trCalc)에서' }] };
      n++;
    };
    if (st) {
      const s0 = (st.transferSellers || [])[0] || {};
      Object.keys(s0).forEach(function (k) { put('seller.' + k, s0[k], tsrc['seller.' + k] || '서류'); });
      (st.transferContracts || []).forEach(function (ct, i) { ['date', 'totalPrice', 'transferCause'].forEach(function (k) { put('c' + i + '.' + k, ct[k], tsrc['c' + i + '.' + k] || '서류'); }); const b = (ct.buyers || [])[0] || {}; Object.keys(b).forEach(function (k) { put('c' + i + '.buyer.' + k, b[k], tsrc['c' + i + '.buyer.' + k] || '서류'); }); });
      (st.transferAssets || []).forEach(function (a, i) { Object.keys(a).forEach(function (k) { if (/^(id|transferContractId|acquisitionExpenseItems)$/.test(k)) return; put('a' + i + '.' + k, a[k], tsrc['a' + i + '.' + k] || '서류'); }); const ci = Number(String(a.transferContractId || '').replace(/\D/g, '')) || 1; if (ci !== i + 1) put('a' + i + '.contract', 'c' + (ci - 1), '옛 계산기 입력'); });
    }
    Object.keys(tr).forEach(function (p) { const x = tr[p]; if (!x) return; if (p === 'costs') put('costs', x.v, x.src); else if (p === 'taxfee') put('taxfee', x.v, x.src); else if (p === '사건분류') put('사건분류', x.v, x.src); else put(p, x.v, x.src); });
    if (c.기준일) put('기준일', c.기준일, (sv.filled && sv.filled.기준일 && sv.filled.기준일.src) || '사건 기준일');
    // 질문·결정은 여기서 옮기지 않는다 — 사건 처리 저장 파일을 처음 불러올 때(caseProcQMigrate_) 장부 질문 줄로 옮겨진다
    ledgerLogTo_(L, { by: '옮김', what: '옛 저장소 옮김', detail: '값 ' + n + '줄 · 물어볼 것 ' + asked + '줄' });
    return { ok: true, moved: n, asked: asked, message: '옛 저장소에서 값 ' + n + '줄·물어볼 것 ' + asked + '줄을 장부로 옮김' };
  });
}

// ── 옛 처리 경로 → 장부 (이음새) ──
// 옛 칸 이름(calc:a0.assetType·expenses·trTaxFee·ov:사건분류·base·ovAsset:0:취득일·cls:양수인관계 …) → 장부 칸 경로. 모르는 것은 ''
function ledgerTargetPath_(target) {
  let t = String(target || '').trim(), m;
  if (!t) return '';
  const fixed = { expenses: 'costs', 'calc:costs': 'costs', trTaxFee: 'taxfee', 'calc:taxfee': 'taxfee', 'ov:사건분류': '사건분류', base: '기준일', 'ov:기준일': '기준일', 'cls:양수인관계': 'c0.buyer.relation', 'cls:세대주택수': 'seller.multiHouseCount', 'cls:오피스텔': 'a0.assetType', 'ov:trBuyerRelation': 'c0.buyer.relation', 'ov:trTransferorName': 'seller.name', 'ov:trTransferorRegNo': 'seller.regNo', 'ov:trTransferorAddress': 'seller.address', 'ov:trBuyerName': 'c0.buyer.name', 'ov:trBuyerRegNo': 'c0.buyer.regNo', trRelFmv: 'relFmv' };
  if (fixed[t]) return fixed[t];
  if ((m = /^ledger:(.+)$/.exec(t))) return m[1];
  if ((m = /^calc:(.+)$/.exec(t))) return m[1];
  // [2026.10.28] 증여 — 처리개요 칸(ov:gift…)이 곧 계산기 칸 → 장부 g.<칸>. 상속 — 세부 질문(ih:재산·장례비 줄·사전증여 …)은 장부 i.q.<열쇠>(답은 상속 사실 계산에 들어가 i.* 계산기 칸을 다시 만든다)
  if ((m = /^ov:(gift\w+)$/.exec(t))) return 'g.' + m[1];
  if (t === 'giftdeal') return 'g.deal';
  if ((m = /^ih:(.+)$/.exec(t))) return 'i.q.' + m[1];
  if ((m = /^ihdiv:(.+)$/.exec(t))) return 'i.qdiv.' + m[1];
  if (t === 'ihdebts') return 'i.q.debts';
  if (/^(g|i)\./.test(t)) return t;
  if ((m = /^ovAsset:(\d+):(.+)$/.exec(t))) { const k = { 양도가액: 'c0.totalPrice', 취득가액: 'a' + m[1] + '.acquisitionPrice', 취득일: 'a' + m[1] + '.acquisitionDate', assetLocation: 'a' + m[1] + '.assetLocation', 주택판단: 'a' + m[1] + '.assetType' }[m[2]]; return k || ''; }
  if (/^(seller\.|c\d+\.|a\d+\.|costs$|taxfee$|사건분류$|기준일$|doc:)/.test(t)) return t;
  return '';
}
// GAS 서류 읽기·규칙 정리가 만든 계산기 입력(S.state·S.src·S.cands) → 장부. 값은 서류/규칙(확실), 후보가 갈리는 칸은 물어볼 것.
//  서류 모순(양도일이 취득일보다 앞섬·양수인 이름 = 양도인)은 값을 믿지 않고 물어볼 것으로 — 혼자 정하지 않는다(10-28 김향숙: 취득계약서가 양도계약 01로 서서 양도일 2019 < 취득일 2022)
function ledgerFromGas_(c, S) {
  if (!S || !S.state) return { ok: false, error: '계산기 입력 없음' };
  const st = S.state, src = S.src || {}, cands = S.cands || {}, ops = [];
  const kindOf = function (s) { s = String(s || ''); return /규칙 정리|빠른 날|검산 일치|사건 기준일|교차검증/.test(s) ? '규칙' : '서류'; };
  const fileOf = function (s) { return (String(s || '').match(/[\w가-힣().\-_ ]+\.(pdf|jpg|jpeg|png|xlsx?|hwp|docx?)/i) || [''])[0].slice(0, 80); };
  const push = function (path, v) {
    if (v === '' || v === undefined || v === null || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) return;
    if (/^(seller\.|c\d+\.|a\d+\.)/.test(path) && /(^|\.)(id|transferContractId|acquisitionExpenseItems|totalExpenseItems|externalMembers|buyers|provisional|_\w+)$/.test(path)) return;
    const s = String(src[path] || '');
    if (!s) return; // 출처 없는 값은 계산기 입력의 기본값(양도가액 0·양도 원인 '매매' 등)이지 서류에서 읽은 사실이 아니다 — 장부에 적지 않는다(10-28 배애란: 양도가액 0원이 서류 값으로 섰던 것)
    if (v === 0 || v === '0') return;
    if (/^(세무사님|🤖|AI 판단|넥스)/.test(s)) return; // 답 저장소에서 온 값은 그 주인이 이미 장부에 적었다
    if (cands[path] && cands[path].length) return; // 후보가 갈리는 칸은 아래에서 물어볼 것으로
    ops.push({ path: path, value: v, kind: kindOf(s), by: 'GAS', file: fileOf(s), quote: s.slice(0, 160), sure: /⚠|확인 필요|원문 확인|검산 안 됨|추정/.test(s) ? '애매' : '확실' });
  };
  const s0 = (st.transferSellers || [])[0] || {};
  Object.keys(s0).forEach(function (k) { push('seller.' + k, s0[k]); });
  (st.transferContracts || []).forEach(function (ct, i) {
    Object.keys(ct).forEach(function (k) { if (k !== 'buyers' && k !== 'name') push('c' + i + '.' + k, ct[k]); });
    const b = (ct.buyers || [])[0] || {}; Object.keys(b).forEach(function (k) { push('c' + i + '.buyer.' + k, b[k]); });
  });
  (st.transferAssets || []).forEach(function (a, i) {
    Object.keys(a).forEach(function (k) { push('a' + i + '.' + k, a[k]); });
    const ci = Number(String(a.transferContractId || '').replace(/\D/g, '')) || (i + 1); if (ci !== i + 1) ops.push({ path: 'a' + i + '.contract', value: 'c' + (ci - 1), kind: '규칙', by: 'GAS', quote: '계산기 입력 자산-계약 연결' });
  });
  Object.keys(cands).forEach(function (p) {
    const path = ledgerTargetPath_(p) || p; if (!/^(seller\.|c\d+\.|a\d+\.|costs$|taxfee$|사건분류$|기준일$)/.test(path)) return;
    ops.push({ ask: true, path: path, question: '서류에서 값이 하나로 정해지지 않음 — 후보 중 고르거나 직접 넣어 주세요', cands: (cands[p] || []).map(function (x) { return { v: x.v, src: x.src }; }), by: 'GAS' });
  });
  // 서류 모순 → 물어볼 것(값을 믿지 않음). 모순이 하나라도 있으면 계약 수·역할 자체가 의심스러우니 둘째 계약부터는 값으로 적지 않고 전부 물어볼 것으로(허상 계약 방지)
  const sName = String(s0.name || '').replace(/\s+/g, '');
  const asks = [], suspect = [];
  (st.transferContracts || []).forEach(function (ct, i) {
    const b = (ct.buyers || [])[0] || {};
    if (b.name && sName && String(b.name).replace(/\s+/g, '') === sName) { suspect.push(i); asks.push({ ask: true, path: 'c' + i + '.buyer.name', question: '서명란 매수인 이름이 양도인(' + sName + ')과 같게 읽혔습니다 — 글자인식 순서가 섞인 것일 수 있어 양수인 이름을 정해 주세요', cands: [], by: 'GAS' }); }
    (st.transferAssets || []).forEach(function (a) {
      if (a.transferContractId !== ct.id || !ct.date || !a.acquisitionDate) return;
      if (String(ct.date) < String(a.acquisitionDate)) { suspect.push(i); asks.push({ ask: true, path: 'c' + i + '.date', question: '양도일(' + ct.date + ')이 취득일(' + a.acquisitionDate + ')보다 앞섭니다 — 이 계약서가 양도 계약인지(취득 계약을 양도로 읽은 것은 아닌지) 확인이 필요합니다. ' + String(src['c' + i + '.transferCause'] || ''), cands: [{ v: ct.date, src: src['c' + i + '.date'] || '' }], by: 'GAS' }); }
    });
  });
  if (suspect.length && (st.transferContracts || []).length >= 2) {
    const why = '계약서 ' + st.transferContracts.length + '건이 모두 양도로 읽혔는데 모순(양도일<취득일 또는 양수인=양도인)이 있어 계약 수·역할이 확실하지 않음 — 어느 서류가 양도계약서인지 정해 주세요';
    for (let k = ops.length - 1; k >= 0; k--) { const m = /^(c|a)(\d+)\./.exec(ops[k].path); if (m && Number(m[2]) >= 1 && !ops[k].ask) { const o = ops[k]; ops[k] = { ask: true, path: o.path, question: why, cands: [{ v: o.value, src: o.quote || o.file || o.kind }], by: 'GAS' }; } }
    asks.push({ ask: true, path: 'doc:양도계약서.role', question: why + '. ' + (st.transferContracts || []).map(function (ct, i) { return '계약 ' + (i + 1) + ': 양도일 ' + (ct.date || '?') + ' · ' + String(src['c' + i + '.transferCause'] || ''); }).join(' / '), cands: (st.transferContracts || []).map(function (ct, i) { return { v: '양도계약서', src: '계약 ' + (i + 1) + ' ' + String(src['c' + i + '.transferCause'] || '') }; }), by: 'GAS' });
  }
  asks.forEach(function (a) { ops.push(a); });
  if (c && c.기준일 && !(ledgerLoad_(c.id).rows['기준일'] || {}).v) ops.push({ path: '기준일', value: c.기준일, kind: '규칙', by: 'GAS', quote: '사건 기준일(작업관리 사건 줄)' }); // [2026.10.29] 장부에 기준일 줄이 없을 때만 처음 채움
  // GAS가 지난 읽기에서 적었는데 이번 읽기에는 없는 값은 GAS 자기 줄이므로 지운다(서류를 다시 읽으면 GAS 주장은 통째로 새로 선다 — 사람·넥스 줄은 그대로)
  const L0 = ledgerLoad_(c.id), have = {}; ops.forEach(function (o) { have[o.path] = true; });
  Object.keys(L0.rows).forEach(function (p) { const r0 = L0.rows[p]; if (!have[p] && r0 && r0.state === '확정' && r0.src && /^(서류|규칙)$/.test(r0.src.kind) && /^(seller\.|c\d+\.|a\d+\.)/.test(p)) ops.push({ drop: true, path: p, by: 'GAS' }); });
  const r = ledgerBatch_(c.id, ops);
  ledgerMutate_(c.id, function (L) { ledgerLogTo_(L, { by: 'GAS', what: '서류 읽기 반영', detail: '값 ' + r.set + '줄 · 물어볼 것 ' + r.asked + '줄' + (r.refused ? ' · 주인 있는 칸 ' + r.refused + '줄은 그대로' : '') + (r.errors.length ? ' · 못 넣음 ' + r.errors.length : '') }); });
  try { const kb = ledgerKbLoad_(c.id); if (kb && kb.facts) r.offered = ledgerKbOffer_(c.id, kb.facts); } catch (e) {} // [2026.10.29] 추정·물음 칸에 장부가 모은 서류 사실을 후보로
  return r;
}
// 서류 → 역할 → 칸. GAS 증빙 읽기가 본 모든 서류의 역할을 장부 줄(doc:<파일>.role)로 — 종류를 정한 서류는 규칙 값, 못 정한 서류(글자는 읽음·글자를 못 읽음)는 "이 서류가 무엇인지" 물어볼 것.
//  종류를 못 정한 서류를 조용히 버리지 않는다(10-15 "파일을 말없이 건너뛰지 않는다"). 넥스가 맡은 사건이면 넥스가 그 파일을 먼저 읽어 역할을 정하고 사실을 적는다.
function ledgerDocRoles_(c, docs, unknown) {
  const ops = [], seen = {};
  const unk = {}; (unknown || []).forEach(function (f) { if (f && f.name) unk[f.name] = true; });
  (docs || []).forEach(function (f) {
    if (!f || !f.name || seen[f.name]) return; seen[f.name] = true;
    const path = 'doc:' + String(f.name).slice(0, 80) + '.role';
    if (unk[f.name]) {
      const noText = !!(f.p && !f.p.t && f.p.nt);
      const n = f.p && typeof f.p.n === 'number' ? f.p.n : -1, head = (f.p && f.p.head) || '';
      // [2026.10.29 운영 확인에서 드러남] job이 공부 조회로 스스로 만든 확보자료 PDF(cpSecuredFlush_ — 머리 "○○ / 대상 / 조회 조건 / 조회 사이트")는 세무사님께 무슨 서류인지 묻지 않는다 — 공부 사실은 장부 공부 사실(L.pub)에 이미 있다
      if (/대상[\s\S]{0,240}조회 조건/.test(head) && /(토지이용계획|토지대장|임야대장|건축물대장|공시|공동주택가격|개별주택가격|매매사례|실거래|조정대상|기준시가)/.test(head.slice(0, 60))) {
        ops.push({ path: path, value: '공부 자료(조회)', kind: '규칙', sure: '확실', by: 'GAS', file: String(f.name).slice(0, 80), quote: head.slice(0, 120), why: 'job 공부 조회가 만든 확보자료 — 사람이 낸 서류가 아님' });
        return;
      }
      // 읽은 것이 무엇인지 그대로 보인다 — "글자는 읽음"이 아니라 "N자 읽음, 시작 글: …". 글자가 아주 적으면(암호 잠김·빈 쪽·그림) 증빙 받을 것으로
      const tiny = noText || (n >= 0 && n < 40);
      const readTxt = noText ? '글자를 하나도 읽지 못함(그림만·흐린 사진·암호 잠김)' : (n >= 0 ? '읽은 글자 ' + n + '자' + (head ? ' · 시작: "' + head.slice(0, 80) + '"' : '') : '읽은 글자 수 기록 없음(지난 읽기)');
      ops.push({ ask: true, path: path, label: '서류 역할 — ' + String(f.name).slice(0, 30), question: (tiny ? '서류를 제대로 읽지 못했습니다 — ' + readTxt + '. 암호가 걸린 PDF면 암호를 풀어 다시 넣어 주시거나, 무엇인지 정해 주세요' : '서류 종류를 규칙으로 정하지 못했습니다 — ' + readTxt + '. 넥스가 읽어 역할을 정하거나 골라 주세요') + '. 역할이 정해지기 전엔 칸 질문을 내지 않습니다', cands: LEDGER_DOC_ROLES_.map(function (r) { return { v: r, src: '역할 고르기' }; }), by: 'GAS', needDoc: tiny });
      return;
    }
    const label = f.p && (f.p.l || f.p.t) ? String(f.p.l || f.p.t) : '';
    if (!label) return;
    ops.push({ path: path, value: label, kind: '규칙', by: 'GAS', file: String(f.name).slice(0, 80), quote: '서류 규칙 판별', sure: '확실' });
  });
  if (!ops.length) return { ok: true, set: 0, asked: 0 };
  const r = ledgerBatch_(c.id, ops);
  ledgerMutate_(c.id, function (L) { ledgerLogTo_(L, { by: 'GAS', what: '서류 역할', detail: '정함 ' + r.set + '개 · 못 정함(물어볼 것) ' + r.asked + '개' }); });
  return r;
}
// ── 질문 = 장부 줄 [2026.10.28 시정 2단계 — 질문 목록 단일화] ──
// 예전: GAS가 낸 질문은 화면이 받아 서버에 "남은 질문(remaining)"으로 저장해야만 남았고(화면 없이 도는 길 — 넥스 지휘·점검 — 에선 질문이 사라짐),
//  질문 결정(decisions)은 또 따로, 장부에는 그 일부를 베껴 적었다(ledgerFromQuestions_·ledgerMirrorDecide_). 셋이 어긋나 "답했는데 질문이 안 닫힘"·"같은 답 세 번"이 났다(10-28 김향숙).
// 이제: 질문 하나 = 장부 줄. 넣을 칸이 있으면 그 칸 줄(rows[칸].qs[질문id]), 칸이 없는 판단·서류 확인 질문은 질문 줄(rows['q:'+질문id]). 결정은 그 줄의 qd[질문id]와 줄 상태.
//  사건 처리 저장 파일은 질문·결정을 갖지 않는다 — 저장 입구(caseProcStore_·caseProcPatch_)가 장부로 보내고, 불러오기(caseProcLoad_)는 ledgerQRead_로 붙인다.
//  칸 값이 세무사님·넥스로 정해지면 그 칸의 질문은 닫힌다(규칙 ⑥ — 질문 목록이 따로 없으니 어긋날 수 없다).
function ledgerQPath_(it) {
  const p = it && it.ask && it.ask.target ? ledgerTargetPath_(it.ask.target) : '';
  return p || ('q:' + String((it && it.id) || '').slice(0, 160));
}
function ledgerQOpenState_(s) { return /^(물어볼것|증빙받을것|보류)$/.test(String(s || '')); }
// 이 질문이 세운 물음을 거둘 때 돌아갈 상태 — 질문 전에 값이 정해져 있었으면 그 값·상태로
function ledgerQBack_(r) {
  const h = Array.isArray(r.hist) ? r.hist : [];
  for (let i = h.length - 1; i >= 0; i--) { if (h[i] && h[i].kind === '질문') { const pv = h[i].prev; return pv && (pv.state === '확정' || pv.state === '추정') && r.v !== '' && r.v !== undefined && r.v !== null ? pv : null; } }
  return null;
}
// ── 답 = 장부 줄 [2026.10.28 시정 2단계 — 답 저장소 단일화] ──
// 예전: 양도 답은 사건 처리 저장 파일의 답 저장소(trAns: 칸 경로 → {v, src, at})에 적고 장부에는 베껴 적었다(ledgerMirrorApply_). 장부(📒·넥스 도구)에서
//  세무사님이 넣은 값은 답 저장소에 없어 GAS 계산에 안 들어갔다. 이제 답 저장소는 장부에서 뽑은 모양일 뿐 — 세무사님·넥스가 정한 양도 칸 줄이 곧 답이다.
var LEDGER_ANS_RE_ = /^(seller\.|c\d+\.|a\d+\.|costs$|taxfee$|사건분류$|split$|relFmv$|compSplit$)/;
function ledgerAnsSrcText_(r) {
  const s = r.src || {}, q = String(s.quote || s.why || '').trim();
  if (q && (s.kind !== '넥스' || /🤖|넥스|AI 판단/.test(q)) && (s.kind !== '세무사님' || !/^(🤖|넥스|AI 판단)/.test(q))) return q;
  return s.kind === '넥스' ? '🤖 넥스 판단(장부)' : '세무사님 답(장부)';
}
// 답 묶음 ↔ 장부 줄 — 묶음 열쇠와 장부 칸 경로를 잇는 규칙(map)만 다르고 길은 하나.
//  양도 답(trAns): 열쇠 = 칸 경로 그대로. 상속 세부 답(ihChoices): 장례비 등 → i.q.<열쇠>, 분할 귀속 div:… → i.qdiv.<열쇠>(질문 줄과 같은 칸이라 답하면 그 질문이 닫힌다)
var LEDGER_ANS_MAPS_ = {
  tr: { toPath: function (k) { return LEDGER_ANS_RE_.test(k) ? k : ''; }, toKey: function (p) { return LEDGER_ANS_RE_.test(p) ? p : ''; } },
  ih: { toPath: function (k) { return /^div:/.test(k) ? 'i.qdiv.' + k : 'i.q.' + k; }, toKey: function (p) { let m = /^i\.qdiv\.(div:.+)$/.exec(p); if (m) return m[1]; m = /^i\.q\.(.+)$/.exec(p); return m ? m[1] : ''; } }
};
function ledgerMapRead_(caseId, kind) {
  const L = ledgerLoad_(caseId), out = {}, mp = LEDGER_ANS_MAPS_[kind];
  Object.keys(L.rows).forEach(function (p) {
    const k = mp.toKey(p), r = L.rows[p]; if (!k || !r.src || !/^(세무사님|넥스)$/.test(r.src.kind)) return;
    if (!(r.state === '확정' || r.state === '추정') || r.v === '' || r.v === undefined || r.v === null) return;
    const a = { src: ledgerAnsSrcText_(r), at: String(r.at || '').slice(0, 10) };
    if (kind === 'ih' && k === 'debts' && r.v && typeof r.v === 'object' && Array.isArray(r.v.items)) a.items = r.v.items; else a.v = r.v; // 상속 채무 확정은 {items:[…]} 모양 그대로
    out[k] = a;
  });
  return out;
}
// 답 묶음과 장부를 맞춘다 — 바뀐 답만 장부에 적고, 지운 답은 장부 줄에서 뗀다(그 칸은 서류를 다시 읽을 때 GAS가 채운다)
function ledgerMapWrite_(caseId, kind, ans) {
  ans = ans && typeof ans === 'object' ? ans : {};
  const mp = LEDGER_ANS_MAPS_[kind], cur = ledgerMapRead_(caseId, kind), ops = [];
  const valOf = function (a) { return a && Array.isArray(a.items) && a.v === undefined ? { items: a.items } : a ? a.v : undefined; };
  Object.keys(ans).forEach(function (k) {
    const a = ans[k], p = mp.toPath(k); if (!a || !p) return;
    if (cur[k] && JSON.stringify(valOf(cur[k])) === JSON.stringify(valOf(a))) return;
    const src = String(a.src || '세무사님 답'), who = /^(🤖|넥스|AI 판단)/.test(src) || /🤖 넥스/.test(src) ? '넥스' : '세무사님';
    ops.push({ path: p, value: valOf(a), kind: who, by: who, quote: src.slice(0, 160), why: src.slice(0, 160) });
  });
  Object.keys(cur).forEach(function (k) { if (!ans[k]) ops.push({ drop: true, path: mp.toPath(k), by: '세무사님' }); });
  return ops.length ? ledgerBatch_(caseId, ops) : { ok: true, set: 0, dropped: 0 };
}
// ── 증여 값 = 장부 줄 [2026.10.28 시정 2단계 — 증여] ──
// 세무사님 원칙(10-16) "처리개요는 요약, 증빙·사이드바 답은 계산기 칸으로 직접". 증여 계산 칸(LEDGER_GIFT_KEYS_)의 값과 출처는 장부 g.<칸> 줄 하나다.
//  근거 기록(filled)의 증여 칸은 장부에서 뽑은 모양, 처리개요 증여 칸은 장부를 보여 주는 요약(ledgerGiftOvSync_)이다.
//  처리개요·세액계산 화면에서 세무사님이 직접 고친 증여 칸은 사건 고치기 입구에서 세무사님 값으로 장부에 적는다(ledgerGiftFromOvEdit_, 세무사님 결정 10-28 "직접 고침 유지").
// [2026.10.29] 사건분류·기준일도 같은 길(세 세목 모두) — 근거 기록의 그 칸은 장부 줄에서, 화면 고침은 장부로, 장부 고침은 처리개요·사건 줄(기준일은 법정일까지)로
var LEDGER_FILLED_KEYS_ = LEDGER_GIFT_KEYS_.concat(['사건분류', '기준일']);
function ledgerFilledPath_(k) { return LEDGER_GIFT_KEYS_.indexOf(k) !== -1 ? 'g.' + k : k; }
function ledgerGiftKind_(s) { s = String(s || ''); return /세무사님/.test(s) ? '세무사님' : /🤖|넥스|AI 판단/.test(s) ? '넥스' : /규칙|검산|교차|계산/.test(s) ? '규칙' : '서류'; }
function ledgerGiftFilledRead_(caseId) {
  const L = ledgerLoad_(caseId), out = {};
  LEDGER_FILLED_KEYS_.forEach(function (k) {
    const r = L.rows[ledgerFilledPath_(k)]; if (!r || !(r.state === '확정' || r.state === '추정') || r.v === '' || r.v === undefined || r.v === null) return;
    const s = r.src || {};
    out[k] = { v: String(r.v), src: String(s.quote || s.why || (s.kind === '세무사님' ? '세무사님 확인(장부)' : s.kind === '넥스' ? '🤖 넥스 판단(장부)' : '증빙(장부)')).slice(0, 120), at: String(r.at || '').slice(0, 10) };
  });
  return out;
}
function ledgerGiftFilledWrite_(caseId, filled) {
  filled = filled && typeof filled === 'object' ? filled : {};
  const cur = ledgerGiftFilledRead_(caseId), ops = [];
  LEDGER_FILLED_KEYS_.forEach(function (k) {
    const f = filled[k], p = ledgerFilledPath_(k);
    if (!f) { if (cur[k] && /^(세무사님|넥스)$/.test(ledgerGiftKind_(cur[k].src)) === false) ops.push({ drop: true, path: p, by: 'GAS' }); return; }
    if (cur[k] && String(cur[k].v) === String(f.v) && cur[k].src === String(f.src || '').slice(0, 120)) return;
    if (String(f.v == null ? '' : f.v).trim() === '') return;
    const kd = ledgerGiftKind_(f.src), est = /^추정|(없어|없으므로).{0,20}(으로|로)\s*봄/.test(String(f.src || '')) && kd !== '세무사님' && kd !== '넥스'; // 서류가 없어서 정한 값은 추정 상태로
    ops.push({ estimate: est, path: p, value: f.v, kind: kd, by: kd === '세무사님' || kd === '넥스' ? kd : 'GAS', quote: String(f.src || '').slice(0, 160), why: kd === '세무사님' ? String(f.src || '').slice(0, 160) : '' });
  });
  return ops.length ? ledgerBatch_(caseId, ops) : { ok: true, set: 0 };
}
// 화면(처리개요·세액계산)에서 세무사님이 고친 증여 칸 → 장부 세무사님 값. 비운 칸은 물어볼 것으로(값을 지어내지 않음)
//  keys: 이 사건에서 장부가 주인인 처리개요 칸(증여 사건은 증여 칸 + 사건분류, 그 밖은 사건분류) + 기준일(사건 줄에서 바뀌었을 때). 경로는 ledgerFilledPath_
function ledgerGiftFromOvEdit_(caseId, prevOv, nextOv, where, who, keys) {
  prevOv = prevOv || {}; nextOv = nextOv || {}; who = who === '넥스' ? '넥스' : '세무사님';
  const ops = [], s = (who === '넥스' ? '🤖 넥스 고침(' : '세무사님 고침(') + (where || '화면') + ')';
  (keys || LEDGER_GIFT_KEYS_).forEach(function (k) {
    if (!(k in nextOv)) return;
    const p = ledgerFilledPath_(k);
    const a = String(prevOv[k] == null ? '' : prevOv[k]).trim(), b = String(nextOv[k] == null ? '' : nextOv[k]).trim();
    const money = /(Amount|Assumed|PaidTax|DeductionUsed|Fee)$/.test(k), same = money ? a.replace(/[^\d]/g, '') === b.replace(/[^\d]/g, '') : a === b;
    if (same) return; // 쉼표·원 표기만 다른 금액은 고친 것이 아니다(화면은 숫자만 보낸다)
    if (b === '') ops.push({ ask: true, path: p, label: ledgerLabel_(p), question: who + '이(가) ' + (where || '화면') + '에서 이 칸을 비웠습니다 — 값을 정해 주세요', cands: a ? [{ v: a, src: '비우기 전 값' }] : [], by: who });
    else ops.push({ path: p, value: b, kind: who, by: who, quote: s, why: s });
  });
  return ops.length ? ledgerBatch_(caseId, ops) : null;
}
// 장부 → 처리개요 요약·사건 줄(장부에서 세무사님·넥스가 고친 값이 처리개요·옛 계산 화면·법정일에도 보이게). 증여 칸(증여 사건)·사건분류(모든 세목)·기준일(법정일 다시 계산)
function ledgerGiftOvSync_(caseId) {
  const c = typeof job_findCase_ === 'function' ? job_findCase_(String(caseId)) : null;
  if (!c) return null;
  const L = ledgerLoad_(caseId), ov = JSON.parse(JSON.stringify(c.사건개요 || {}));
  // 세무사님·넥스가 정한 장부 값만 다시 쓴다 — GAS 서류 값은 GAS가 처리개요에 함께 적었고, 장부에 남은 옛 규칙 값이 세무사님이 시트에서 고친 새 값을 덮으면 안 되기 때문
  const val = function (p) { const r = L.rows[p]; return r && (r.state === '확정' || r.state === '추정') && r.v !== '' && r.v !== undefined && r.v !== null && r.src && /^(세무사님|넥스)$/.test(r.src.kind) ? r : null; };
  let ch = 0, out = { ok: true, changed: 0 };
  (c.세목 === 'gift' ? LEDGER_GIFT_KEYS_ : []).concat(['사건분류']).forEach(function (k) { const r = val(ledgerFilledPath_(k)); if (!r) return; if (String(ov[k] == null ? '' : ov[k]) !== String(r.v)) { ov[k] = String(r.v); ch++; } });
  if (ch) { const up = work_updateCase({ id: c.id, 사건개요: ov, 기대수정일: c.수정일 }); out = { ok: !!(up && up.success !== false), changed: ch, message: up && up.message }; }
  const b = val('기준일');
  if (b && String(b.v) !== String(c.기준일 || '') && typeof caseProcApplyBase_ === 'function') { // 기준일은 사건 줄 칸 — 법정일도 다시 계산(기준일 반영과 같은 길)
    const who = b.src && b.src.kind === '넥스' ? '🤖 넥스(장부)' : b.src && b.src.kind === '세무사님' ? '세무사님(장부)' : '장부';
    const rb = caseProcApplyBase_(c.id, String(b.v), who, '기준일'); out.기준일 = rb && rb.ok ? '반영' : (rb && rb.error) || '실패';
  }
  return out;
}
// ── 값 고치기 이력 = 장부 줄 이력 [2026.10.28 시정 2단계 — 값 이력] ──
// 예전: 세무사님·넥스가 칸 값을 고친 기록(valueHist)을 저장 파일에 따로 두고 되돌리기도 따로 했다 — 장부 줄마다 있는 이력·되돌리기(ledgerUndo_)와 두 길이었다.
//  이제 값 이력은 장부 줄 이력에서 세무사님·넥스 고침만 뽑은 모양이고, 되돌리기는 장부 되돌리기 하나다. 옛 기록은 처음 옮길 때 장부(fixHistOld)에 보관해 함께 보인다.
function ledgerPathToTarget_(p) {
  let m;
  if (p === 'costs') return 'expenses';
  if (p === 'taxfee') return 'trTaxFee';
  if (p === '사건분류' || p === '기준일') return 'ov:' + p;
  if ((m = /^g\.(.+)$/.exec(p))) return 'ov:' + m[1];
  if ((m = /^i\.qdiv\.(.+)$/.exec(p))) return 'ihdiv:' + m[1];
  if (p === 'i.q.debts') return 'ihdebts';
  if ((m = /^i\.q\.(.+)$/.exec(p))) return 'ih:' + m[1];
  if (/^(seller\.|c\d+\.|a\d+\.)/.test(p)) return 'calc:' + p;
  return 'ledger:' + p;
}
function ledgerFixHist_(caseId) {
  const L = ledgerLoad_(caseId), out = [];
  Object.keys(L.rows).forEach(function (p) {
    const r = L.rows[p], h = Array.isArray(r.hist) ? r.hist : [];
    h.forEach(function (e, i) {
      if (!e || !/^(세무사님|넥스)$/.test(e.kind) || !e.next || e.next.v === undefined) return;
      const undoneAt = h.slice(i + 1).filter(function (x) { return x && x.kind === '되돌림'; })[0];
      out.push({ at: e.at, by: e.kind, target: ledgerPathToTarget_(p), path: p, label: r.label || ledgerLabel_(p), prev: e.prev && e.prev.v !== undefined ? { v: e.prev.v, src: e.prev.kind || '' } : null, next: { v: e.next.v, src: String(e.why || e.kind) }, why: String(e.why || '').slice(0, 80), undone: undoneAt ? undoneAt.at : undefined });
    });
  });
  return (Array.isArray(L.fixHistOld) ? L.fixHistOld.map(function (x) { return Object.assign({ old: true }, x); }) : []).concat(out.sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : String(a.at) > String(b.at) ? 1 : 0; })).slice(-100);
}
function ledgerFixHistMigrate_(caseId, old) {
  if (!Array.isArray(old) || !old.length) return;
  ledgerMutate_(caseId, function (L) { const have = Array.isArray(L.fixHistOld) ? L.fixHistOld : []; if (have.length) return; L.fixHistOld = old.slice(-100).map(function (x) { return Object.assign({}, x, { undone: x.undone || '옛 기록(장부로 옮기기 전) — 되돌리기는 장부 이력으로' }); }); });
}
function ledgerAnsRead_(caseId) { return ledgerMapRead_(caseId, 'tr'); }
function ledgerAnsWrite_(caseId, ans) { return ledgerMapWrite_(caseId, 'tr', ans); }
// 서류 → 칸 이음 점검 [2026.10.28] — 파일 장부(caseProcLedger_)에서 "읽음·종류 앎"인데 내용이 어느 칸에도 쓰이지 않고 증빙목록 표시만 된 서류는 장부 물음(doc:<파일>.use).
//  관련 서류가 폴더에 있는데 칸에 들어간 것이 없으면 그 칸 값을 확정할 근거가 없다(10-28 원문 "확보된 정보를 최대한 활용 … 부족한 정보는 물어보거나 확보할 증빙으로").
//  그 서류가 나중에 칸에 쓰이면(처리에 씀) GAS가 세운 이 물음은 내려간다. 세무사님이 무시하면 그대로 무시.
function ledgerDocUse_(c, fileRows) {
  if (!c || !Array.isArray(fileRows)) return null;
  const L0 = ledgerLoad_(c.id), ops = [], want = {};
  // [2026.10.29] 그 서류의 사실이 이미 어떤 칸의 후보로 붙었으면(장부 바탕 ledgerKbOffer_) "무슨 서류인지 — 칸에 못 넣음" 질문을 따로 세우지 않는다 — 같은 서류로 두 번 묻지 않게
  const offered = {};
  Object.keys(L0.rows || {}).forEach(function (p) { ((L0.rows[p] || {}).cands || []).forEach(function (cd) { const m = /^서류 사실:\s*[^—]*—\s*(.+?)(?:\s·\s|$)/.exec(String(cd.src || '')); if (m) offered[m[1].trim()] = p; }); });
  fileRows.forEach(function (r) {
    if (!r || !r.n || r.st !== '읽음' || r.use !== '증빙목록 확보') return;
    if (offered[r.n]) return;
    const path = 'doc:' + String(r.n).slice(0, 80) + '.use'; want[path] = true;
    ops.push({ ask: true, path: path, label: '서류 내용 — ' + String(r.n).slice(0, 30), by: 'GAS', cands: [],
      question: '「' + String(r.kind || '서류') + '」(' + r.n + ')는 무슨 서류인지는 알아봤지만 그 안의 금액·날짜를 계산기 어느 칸에도 넣지 못했습니다. 이 서류의 값이 들어갈 칸(📒 사건 장부)에 넣어 주시거나, 넣을 것이 없으면 「무시」를 눌러 주세요.' });
  });
  Object.keys(L0.rows).forEach(function (p) { const r = L0.rows[p]; if (/^doc:.+\.use$/.test(p) && !want[p] && /^(물어볼것|증빙받을것)$/.test(r.state) && r.src && r.src.kind === '질문' && r.src.who === 'GAS' && !r.qd) ops.push({ drop: true, path: p, by: 'GAS' }); });
  return ops.length ? ledgerBatch_(c.id, ops) : { ok: true, asked: 0, dropped: 0 };
}
// 쓰기 — rem: 질문 목록(순서대로; undefined면 질문은 그대로), dec: 질문 결정 지도 {질문id:{d,at,text,note}}(undefined면 결정은 그대로)
//  o.partial: 이번 목록이 질문 전부가 아님(가벼운 다시 맞추기 — 사건파악·메모 질문을 다시 만들지 않음) → 목록에 없다고 떼지 않는다
function ledgerQWrite_(caseId, rem, dec, o) {
  o = o || {};
  const san = typeof caseProcQSan_ === 'function' ? caseProcQSan_ : function (x) { return JSON.parse(JSON.stringify(x)); };
  return ledgerMutate_(caseId, function (L) {
    const out = { asked: 0, attached: 0, removed: 0, decided: 0 };
    const rowOf = function (id) { const ps = Object.keys(L.rows); for (let i = 0; i < ps.length; i++) { const r = L.rows[ps[i]]; if ((r.qs && r.qs[id]) || (r.qd && r.qd[id])) return ps[i]; } return ''; };
    if (Array.isArray(rem)) {
      const want = {}; rem.forEach(function (it, i) { if (it && it.id) want[String(it.id)] = { it: it, n: i }; });
      // 1) GAS가 더는 묻지 않는 질문(이번 목록에 없고 결정도 없음)은 줄에서 뗀다 — 그 질문이 세운 물음이면 거둔다
      if (!o.partial) Object.keys(L.rows).forEach(function (p) {
        const r = L.rows[p]; if (!r.qs) return;
        Object.keys(r.qs).forEach(function (id) { if (!want[id] && !(r.qd && r.qd[id] && r.qd[id].d) && !(dec && dec[id] && dec[id].d)) { delete r.qs[id]; out.removed++; } });
        if (Object.keys(r.qs).length) return;
        delete r.qs;
        if (r.qAsk && /^(물어볼것|증빙받을것)$/.test(r.state)) {
          const back = ledgerQBack_(r);
          if (back) { r.state = back.state; r.ask = ''; r.cands = []; }
          else if (!r.qd || !Object.keys(r.qd).length) { delete L.rows[p]; return; }
        }
        delete r.qAsk;
      });
      // 2) 이번 목록의 질문 — 그 칸 줄(없으면 질문 줄)에 붙인다. 칸 값이 세무사님·넥스로 이미 정해졌으면 물음을 세우지 않는다(답하면 닫힘)
      Object.keys(want).forEach(function (id) {
        const it = want[id].it, path = rowOf(id) || ledgerQPath_(it), prev = L.rows[path];
        // [2026.10.29 운영 확인에서 드러남] 추정(의뢰서 등·가정값)이 들어 있는 칸은 GAS의 "서류에 없음" 물음이 물어볼 것으로 되돌리지 않는다 — 세무사님 10-28 "확인되지 않은 정보중에 추정치나 가정치를 넣어서 진행할 수도 있고".
        //  예전엔 공부 조회가 확보자료 PDF를 넣어 폴더 감시가 한 바퀴를 다시 돌리면 추정 칸이 물음으로 되돌아가 시험 계산이 "칸이 비었다"로 멈췄다. 서류 값이 오면 서류가 추정을 바꾸고(ledgerSetInner_), 받을 서류는 확보할 증빙에 그대로 남는다
        //  GAS가 스스로 넣은 추정(서류 없어 0원 등)은 예전처럼 물음으로 다시 선다 — 사람·넥스가 넣은 추정만 지킨다
        const hi = prev && (prev.state === '확정' || prev.state === '추정') && ((LEDGER_RANK_[prev.src && prev.src.kind] || 0) > 1 || ledgerKeptEstimate_(prev));
        const decided = (prev && prev.qd && prev.qd[id] && prev.qd[id].d) || (dec && dec[id] && dec[id].d);
        if (!hi && !decided && !/^ledger:/.test(id)) { // ledger:<칸> 질문은 장부 물음을 그대로 보인 것 — 다시 세우지 않는다
          const a = it.ask || {};
          const cands = (a.cands || []).map(function (x) { return { v: x.v, src: x.src || x.label || '' }; })
            .concat((a.options || []).filter(function (x) { return x && x.value !== undefined && x.value !== ''; }).map(function (x) { return { v: x.value, src: '선택지: ' + String(x.label || '') }; }));
          const lab = String(a.label || (/^q:/.test(path) ? String(it.text || '').slice(0, 30) : '') || ledgerLabel_(path));
          ledgerAskInner_(L, path, { label: lab, question: String(it.text || ''), cands: cands, by: 'GAS', needDoc: /증빙\s*(받|요청)|서류를\s*(넣|받)/.test(String(it.text || '')) && !cands.length, keep: true });
          L.rows[path].qAsk = true; out.asked++;
        }
        const row = L.rows[path] || (L.rows[path] = { label: ledgerLabel_(path), v: '', state: '물어볼것', src: { kind: '질문', who: 'GAS' }, at: caseProcNow_() });
        row.qs = row.qs || {}; const q = san(it); q._n = want[id].n; row.qs[id] = q; out.attached++;
      });
    }
    if (dec && typeof dec === 'object') {
      // 3) 결정 — 취소된 결정은 떼고(그 결정이 만든 보류·무시는 물음으로 되돌림), 새 결정은 줄 상태로
      Object.keys(L.rows).forEach(function (p) {
        const r = L.rows[p]; if (!r.qd) return;
        Object.keys(r.qd).forEach(function (id) {
          if (dec[id] && dec[id].d) return;
          delete r.qd[id];
          if (/^(보류|무시)$/.test(r.state) && r.qdState) { r.state = r.qs && Object.keys(r.qs).length ? '물어볼것' : r.state; delete r.qdState; }
        });
        if (!Object.keys(r.qd).length) { delete r.qd; if (/^q:/.test(p) && !r.qs) delete L.rows[p]; }
      });
      Object.keys(dec).forEach(function (id) {
        const d = dec[id]; if (!d || !d.d) return;
        const p = rowOf(id) || (/^ledger:/.test(id) ? id.slice(7) : 'q:' + String(id).slice(0, 160));
        const r = L.rows[p] || (L.rows[p] = { label: String(d.text || id).slice(0, 30), v: '', state: '물어볼것', src: { kind: '질문', who: '결정' }, at: caseProcNow_() });
        r.qd = r.qd || {};
        const nd = { d: String(d.d).slice(0, 4), at: String(d.at || '').slice(0, 10), text: String(d.text || '').slice(0, 200), note: String(d.note || '').slice(0, 200) };
        if (JSON.stringify(r.qd[id] || null) === JSON.stringify(nd)) return;
        r.qd[id] = nd; out.decided++;
        const open = ledgerQOpenState_(r.state) || r.state === '무시';
        if (/^(보류|예정)$/.test(nd.d) && open) { r.state = '보류'; r.qdState = true; }
        else if (nd.d === '무시' && open) { r.state = '무시'; r.qdState = true; }
        else if (nd.d === 'done' && open) {
          if (r.v !== '' && r.v !== undefined && r.v !== null) { r.state = '확정'; r.ask = ''; }
          else if (/^q:/.test(p)) { r.state = '확정'; r.v = '확인'; r.ask = ''; }
          delete r.qdState;
        }
        ledgerLogTo_(L, { by: '결정', what: '질문 결정 ' + nd.d, path: p, detail: (r.label || p) + (nd.text ? ' — ' + nd.text.slice(0, 100) : '') });
      });
    }
    return out;
  });
}
// 읽기 — 열린 질문 목록(옛 remaining 모양, 질문 순서대로)과 질문 결정 지도(옛 decisions 모양). 닫힌 질문(칸 값이 정해짐)은 결정 'done'으로 보인다
function ledgerQRead_(caseId) {
  const L = ledgerLoad_(caseId), items = [], dec = {};
  Object.keys(L.rows).forEach(function (p) {
    const r = L.rows[p];
    Object.keys(r.qd || {}).forEach(function (id) { dec[id] = r.qd[id]; });
    Object.keys(r.qs || {}).forEach(function (id) {
      const it = r.qs[id], qd = r.qd && r.qd[id];
      if (qd && (qd.d === 'done' || qd.d === '무시')) return;
      if (!ledgerQOpenState_(r.state) && !(qd && /^(보류|예정)$/.test(qd.d))) { dec[id] = { d: r.state === '무시' ? '무시' : 'done', at: String(r.at || '').slice(0, 10), text: String(it.text || '').slice(0, 200), note: '장부 ' + (r.label || p) + ' ' + r.state }; return; }
      items.push(it);
    });
    // GAS 질문이 붙지 않은 물음(서류 역할·서류 모순·넥스가 세운 물음)도 질문 목록에 — 세무사님이 AI 없이 GAS 화면만 쓰셔도 같은 물음을 보고 답한다(답은 장부 그 칸으로)
    if (!/^q:/.test(p) && ledgerQOpenState_(r.state) && !(r.qs && Object.keys(r.qs).some(function (id) { return !(r.qd && r.qd[id] && /^(done|무시)$/.test(r.qd[id].d)); }))) {
      const id = 'ledger:' + p;
      const opts = /\.role$/.test(p) && /^doc:/.test(p) ? LEDGER_DOC_ROLES_.map(function (x) { return { label: x, value: x }; }) : null;
      const en = ledgerEnumOf_(p);
      const it = { id: id, step: 'ledger', kind: r.state === '증빙받을것' ? 'missing' : 'judge', text: String((r.label || p) + ' — ' + (r.ask || '값을 정해 주세요')).slice(0, 300),
        ask: { mode: opts || en ? 'options' : 'choose', target: id, label: r.label || p, cands: (r.cands || []).map(function (x) { return { v: String(x.v), label: '', src: String(x.src || '') }; }), options: opts || (en ? LEDGER_ENUMS_[en].codes.map(function (k) { return { label: LEDGER_ENUMS_[en].ko[k], value: k }; }) : undefined), withInput: !opts && !en } };
      it._n = /^doc:/.test(p) ? -1000 : -1;
      if (r.qd && r.qd[id] && /^(보류|예정)$/.test(r.qd[id].d)) dec[id] = r.qd[id];
      items.push(it);
    }
  });
  items.sort(function (a, b) { return (a._n || 0) - (b._n || 0); });
  return { remaining: items.map(function (it) { const x = Object.assign({}, it); delete x._n; return x; }), decisions: dec };
}
// [2026.10.29] 사이드바 답을 장부로 베껴 쓰던 ledgerMirrorApply_는 걷어냈다 — 양도 답(답 저장소)·상속 세부 답·증여 칸·사건분류·기준일(근거 기록)이
//  모두 장부 줄 그 자체가 되어, 답 넣기(caseProcApply_)가 쓰는 저장소가 곧 장부다.
// 장부 값을 계산기 입력 위에 덮는다(장부가 이긴다) — 세액계산 화면이 받는 입력
function ledgerOverlayState_(caseId, state) {
  const L = ledgerLoad_(caseId);
  if (!Object.keys(L.rows).length) return { state: state, n: 0 };
  const st = JSON.parse(JSON.stringify(state || { transferSellers: [{}], transferContracts: [], transferAssets: [], acquisitionContracts: [] }));
  const cs = ledgerCalcState_(caseId);
  // 장부에서 만든 상태의 값이 있는 칸만 덮는다(장부에 없는 계산기 보조 칸은 옛 입력 그대로)
  const over = function (dst, srcO) { Object.keys(srcO || {}).forEach(function (k) { const v = srcO[k]; if (v === '' || v === undefined || v === null) return; if (Array.isArray(v) && !v.length) return; if (k === 'buyers') { dst.buyers = dst.buyers && dst.buyers.length ? dst.buyers : [{}]; over(dst.buyers[0], (v[0] || {})); return; } dst[k] = v; }); };
  st.transferSellers = st.transferSellers && st.transferSellers.length ? st.transferSellers : [{}];
  over(st.transferSellers[0], cs.state.transferSellers[0]);
  cs.state.transferContracts.forEach(function (ct, i) { if (!st.transferContracts[i]) st.transferContracts[i] = ct; else over(st.transferContracts[i], ct); });
  cs.state.transferAssets.forEach(function (a, i) { if (!st.transferAssets[i]) st.transferAssets[i] = a; else over(st.transferAssets[i], a); });
  // 장부에 계약·자산이 더 적으면(옛 입력이 허상 계약을 만들었으면) 장부 수에 맞춘다
  if (cs.state.transferContracts.length && st.transferContracts.length > cs.state.transferContracts.length) { st.transferContracts = st.transferContracts.slice(0, cs.state.transferContracts.length); const ids = st.transferContracts.map(function (x) { return x.id; }); st.transferAssets = st.transferAssets.filter(function (a) { return ids.indexOf(a.transferContractId) !== -1; }); }
  return { state: st, n: cs.used.length, gaps: cs.gaps };
}
// ── 화면·넥스용 한 묶음 ──
function ledgerView_(c) {
  const rows = ledgerRows_(c.id), L = ledgerLoad_(c.id);
  const by = {}; LEDGER_STATES_.forEach(function (s) { by[s] = []; });
  rows.forEach(function (r) { (by[r.state] || (by[r.state] = [])).push(r); });
  const calcs = (Array.isArray(c.세액계산결과) ? c.세액계산결과 : []).slice(-12).map(function (e) { return { id: e.id, 구분: e.구분, 이름: e.안 ? e.안.이름 : '기본 저장본', 최종세액: e.최종세액, 계산일: e.계산일 }; }); // [2026.10.30] 안 이름·id도(⑥ 자문과 맞대어 보게)
  return { ok: true, 사건: (c.사건명 || c.고객명 || '') + ' · ' + (c.세목 || ''), 요약: ledgerSummary_(c.id), 줄: rows, 상태별: by, 기록: (L.log || []).slice(-40), 계산저장본: calcs, 자문: ledgerAdvBrief_(c, L), 칸코드: LEDGER_ENUMS_, 서류역할: LEDGER_DOC_ROLES_, 바탕: ledgerKbView_(c.id, c), 흐름: ledgerFlowView_(c, L, rows) };
}
// [2026.10.29] 세무사님 "ai없이 수동으로 사건을 처리할때 사용자가 사건장부를 수시로 참조해야 하는 것이 아닌가?" → "권장대로 하자"(처리개요 맨 위 + 사건 화면 어디서나)
//  사건을 다루는 화면마다 맨 위 띠와 옆 패널이 부르는 가벼운 묶음 — 흐름(띠·마지막 한 바퀴·가설·사건개요·처리방향·확보할 증빙) + 남은 물음. 서류 사실 전부(kb)는 싣지 않는다
function ledgerFlowBrief_(c) {
  const L = ledgerLoad_(c.id), rows = ledgerRows_(c.id);
  const fl = ledgerFlowView_(c, L, rows);
  if (fl.마지막) fl.마지막 = { at: fl.마지막.at, why: fl.마지막.why, diff: fl.마지막.diff || [], rounds: (fl.마지막.rounds || []).slice(-5).map(function (x) { return { at: x.at, why: x.why, diff: x.diff || [] }; }) };
  const open = rows.filter(function (r) { return /^(물어볼것|증빙받을것|보류)$/.test(r.state); }).map(function (r) { return { label: r.label, state: r.state, ask: String(r.ask || '').slice(0, 200), 값: r.값 }; });
  const calc = rows.filter(function (r) { return !/^(q:|doc:|chk:)/.test(r.path) && /^(확정|추정)$/.test(r.state) && r.v !== '' && r.v != null; }).map(function (r) { return { label: r.label, 값: r.값, state: r.state, kind: r.kind, 이음: (r.fx || []).length }; });
  // [2026.10.30 비용 기록] 이 사건 AI 비용 누적 — 장부 띠에 함께(같은 2분 주기, 서버를 따로 부르지 않음). 시트 읽기만, 0원
  let cost = null; try { if (typeof aiCostCaseSummary_ === 'function') { const s = aiCostCaseSummary_(c.id); cost = { n: s.n, won: s.won, parts: s.parts, byKind: s.byKind, line: s.line }; } } catch (e) { cost = { error: String(e && e.message || e).slice(0, 80) }; }
  return { ok: true, 사건: (c.사건명 || c.고객명 || ''), 흐름: fl, 물음: open, 칸: calc.slice(0, 80), AI비용: cost };
}
// [2026.10.29 넥스 1] 넥스용 장부 요약 — 세무사님 "ai가 처리할때는 사건장부 속의 정보를 적재적소에 제대로 활용하지 못하고 있다는 것인가?" → "그래라"
//  예전엔 넥스가 장부를 보려면 장부 전체(ledger_read — 6,000자에서 잘려 뒤쪽 흐름이 늘 빠짐)를 따로 불러야 했고, 사건 현황(case_status·caseproc)에는 흐름이 없었다.
//  이제 넥스의 첫 현황에 이 한 묶음이 붙는다. 순서 = 먼저 볼 것부터: 띠 → 마지막 한 바퀴 → 남은 물음(가설과 다름 포함) → 사건개요(정함·가설) → 확보할 증빙(받을 것)
//  → 칸 값(이은 서류·값이 다른 서류). max 자를 넘으면 뒤 묶음부터 줄이고 줄인 사실을 적는다. 서류 사실 전부는 싣지 않는다(case_ledger do:facts로 찾는다)
function ledgerNexBrief_(c, max) {
  max = Number(max) || 6000;
  const L = ledgerLoad_(c.id), rows = ledgerRows_(c.id), fl = ledgerFlowView_(c, L, rows);
  const fById = {}; (((L.kb && L.kb.facts) || [])).forEach(function (f) { fById[f.id] = f; });
  const cut = function (s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; };
  const last = fl.마지막 ? { 때: fl.마지막.at || '', 까닭: cut(fl.마지막.why, 60), 바뀐것: (fl.마지막.diff || []).slice(0, 8).map(function (d) { return cut(d, 120); }) } : null;
  const open = rows.filter(function (r) { return /^(물어볼것|증빙받을것|보류)$/.test(r.state); }).map(function (r) {
    const o = { 칸: r.label, 상태: r.state, 물음: cut(r.ask || r.why, 140) };
    if (r.값) o.지금값 = cut(r.값, 50);
    if (/^chk:가설\./.test(r.path)) o.가설과다름 = true;
    if (r.cands && r.cands.length) o.후보 = r.cands.slice(0, 3).map(function (x) { return cut(x.값, 30) + (x.src ? '(' + cut(typeof x.src === 'object' ? (x.src.file || x.src.kind || '') : x.src, 30) + ')' : ''); });
    return o;
  });
  const ovOne = function (r) { const o = { 칸: r.label, 값: cut(r.값, 60), 주인: r.kind || '' }; if (r.hypNote) o.가설과다름 = cut(r.hypNote, 100); return o; };
  const ov = fl.사건개요 || [];
  const calc = rows.filter(function (r) { return !/^(q:|doc:|chk:)/.test(r.path) && /^(확정|추정)$/.test(r.state) && r.v !== '' && r.v != null; }).map(function (r) {
    const o = { 칸: r.label, 값: cut(r.값, 50), 주인: r.kind || '', 상태: r.state };
    const fx = (r.fx || []).map(function (id) { return fById[id]; }).filter(Boolean), fk = (r.fk || []).map(function (id) { return fById[id]; }).filter(Boolean);
    if (fx.length) o.같은값서류 = fx.map(function (f) { return f.f; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 3);
    if (fk.length) o.다른값서류 = fk.slice(0, 3).map(function (f) { return cut(f.v, 30) + '(' + cut(f.f, 30) + ')'; });
    return o;
  });
  const out = {
    띠: fl.띠, 마지막한바퀴: last, 남은물음: open,
    사건개요_정함: ov.filter(function (r) { return /^(확정|추정)$/.test(r.state); }).map(ovOne),
    사건개요_가설: ov.filter(function (r) { return r.state === '가설'; }).map(ovOne),
    확보할증빙_받을것: (fl.증빙 || []).filter(function (r) { return r.state === '증빙받을것'; }).map(function (r) { return '[' + (r.받는곳 || '고객') + (r.도구확보 ? ' — 조회로 받음: ' + cut(r.도구확보, 40) : '') + '] ' + cut((r.서류 && r.서류.label) || r.label, 60) + (r.why ? ' — ' + cut(r.why, 50) : ''); }),
    // [2026.10.29 계획서 3판] 공부 사실(있는 조회 도구로 받은 것)과 아직 조회 안 한 필지 — 필지가 있는데 조회가 없으면 case_ledger do=lookup
    공부사실: (fl.공부 || []).map(function (p) { return { 소재지: cut(p.소재지, 60), 받음: (p.받음 || []).map(function (it) { return cut(it.label, 20) + ': ' + cut(it.v, 70); }).slice(0, 8), 못받음: (p.못받음 || []).map(function (it) { return cut(it.label, 20) + ': ' + cut(it.err, 50); }).slice(0, 4) }; }),
    조회안한필지: (fl.조회대상 || []).filter(function (t) { return !t.조회함; }).map(function (t) { return cut(t.소재지, 60) + ' (' + cut(t.어디서, 40) + ')'; }),
    칸값: calc,
    자문: ledgerAdvBrief_(c, L), // [2026.10.30 2단계] 쟁점·대안·근거·위험·권고·보고서(저장본 이름·세액 붙임)
    거래사슬: ((fl.사슬 && fl.사슬.rows) || []).map(function (r) { return { 물건: cut(r.물건, 60), 납세자위치: r.납세자위치, 고리: (r.고리 || []).map(function (s) { return s.at + ' ' + (s.kind === '등기' ? '등기 ' + s.what + ' ' + s.to : s.what + ' ' + s.to) + (s.밖 ? ' [사슬 밖]' : ''); }).slice(0, 8) }; }),
    사슬밖계약서: ((fl.사슬 && fl.사슬.off) || []).map(function (o) { return o.file + ' — ' + cut(o.why, 120); }),
    안내: '사건 장부 요약(토큰 0). 가설과다름·다른값서류는 세무사님께 여쭐 거리다(세무사님 값은 바꾸지 않는다). 서류 사실은 case_ledger do:facts(find_kind·find_file·find_value·find_to)로 찾고, 장부 전체는 ledger_read(사건 지휘)·job_lookup kind=ledger(대화창). 조회안한필지가 있으면 case_ledger do=lookup, 의뢰서 등 가설에 거래가 있는데 칸이 비면 do=estimate 뒤 do=calc(시험 계산), 다른 세목과 견주려면 do=compare. 받을 것의 [도구]는 조회로, [세무사님]·[고객]은 세무사님께 항목별로 여쭐 거리다(고객에게 직접 보내지 않는다).'
  };
  let txt = JSON.stringify(out);
  ['칸값', '공부사실', '거래사슬', '확보할증빙_받을것', '사건개요_정함', '사건개요_가설', '남은물음'].forEach(function (k) {
    const n0 = (out[k] || []).length;
    while (txt.length > max && out[k] && out[k].length) { out[k] = out[k].slice(0, Math.floor(out[k].length / 2)); txt = JSON.stringify(out); }
    if (out[k] && out[k].length < n0) { out[k + '_줄임'] = n0 + '개 중 ' + out[k].length + '개만 — 나머지는 장부 전체에서'; txt = JSON.stringify(out); }
  });
  return out;
}
// [2026.10.29 넥스 2] 서류 사실 찾기(토큰 0) — 장부가 모아 둔 서류 사실(L.kb.facts)을 종류·파일·값·쓰인 칸으로 좁혀 번호와 함께. 다시 읽지 않고 장부에서만 찾는다
function ledgerKbFind_(c, q) {
  q = q || {};
  const L = ledgerLoad_(c.id), kb = L.kb || {}, facts = kb.facts || [];
  const lim = Math.max(1, Math.min(Number(q.limit) || 20, 60));
  const has = function (s, w) { return String(s || '').indexOf(String(w)) !== -1; };
  const vn = q.find_value ? ledgerKbNorm_('', q.find_value) : '';
  const lab = function (p) { const r = (L.rows || {})[p]; return r && r.label && !/^[a-zA-Z]/.test(String(r.label)) ? r.label : ledgerLabel_(p); };
  const hit = facts.filter(function (f) {
    if (q.find_kind && !has(f.k, q.find_kind)) return false;
    if (q.find_file && !has(f.f, q.find_file) && !has(f.t, q.find_file)) return false;
    if (q.find_value && !has(f.v, q.find_value) && !(vn && f.n === vn)) return false;
    if (q.find_to && !(f.to || []).some(function (p) { return has(p, q.find_to) || has(lab(p), q.find_to); })) return false;
    return true;
  });
  const kinds = {}; hit.forEach(function (f) { kinds[f.k] = (kinds[f.k] || 0) + 1; });
  return { ok: true, 모은때: kb.at || '', 전체사실: facts.length, 찾음: hit.length,
    사실: hit.slice(0, lim).map(function (f) { return { 번호: f.id, 종류: f.k, 값: f.v, 파일: f.f, 서류종류: f.t || undefined, 자리: f.w || undefined, 대상: f.s || undefined, 쓰인칸: f.to && f.to.length ? f.to.map(lab) : undefined, 판독: f.u ? '불확실' : undefined, 사본: f.cp ? '사본' : undefined }; }),
    종류별: q.find_kind ? undefined : Object.keys(kinds).sort(function (a, b) { return kinds[b] - kinds[a]; }).slice(0, 30).reduce(function (o, k) { o[k] = kinds[k]; return o; }, {}),
    안내: facts.length ? undefined : '장부에 모은 서류 사실이 아직 없습니다 — 서류 읽기(⚡ GAS로 처리·gas_run)가 한 번 돌아야 모입니다.' };
}
// [2026.10.29 거래 사슬] 양도 사실 정리(tcDealChain_)가 만든 물건별 사슬(계약서·등기 고리, 납세자 위치)과 사슬 밖 계약서를 장부에 — 바뀔 때만 적는다
function ledgerChainPut_(caseId, rf) {
  if (!caseId || !rf || !Array.isArray(rf.chain)) return false;
  const nx = { rows: rf.chain.slice(0, 20), off: (rf.chainOff || []).slice(0, 30) };
  return ledgerMutate_(caseId, function (L) {
    const old = L.chain ? JSON.stringify({ rows: L.chain.rows, off: L.chain.off }) : '';
    if (old === JSON.stringify(nx)) return false;
    L.chain = Object.assign({ at: caseProcNow_() }, nx);
    ledgerLogTo_(L, { by: 'GAS', what: '거래 사슬', detail: nx.rows.map(function (r) { return String(r.물건 || '').slice(0, 30) + ' — ' + (r.납세자위치 || ''); }).join(' / ').slice(0, 200) + (nx.off.length ? ' · 사슬 밖 계약서 ' + nx.off.length + '건' : '') });
    return true;
  });
}
// [2026.10.29 넥스 4] 중요한 순간 —한 바퀴 전후로 새로 생긴 "가설과 서류가 다름"·새 쟁점·새로 받을 서류. 세무사님 "중요한 순간이면 AI가 먼저 말을 걸어도 되겠지"(10-22)
//  무엇이 중요한 순간인지는 정해 두지 않고 쓰면서 늘린다(공통원칙 1) — 지금은 이 세 가지
function ledgerMomentKeys_(L) {
  const m = {};
  Object.keys((L && L.rows) || {}).forEach(function (p) { const r = L.rows[p]; if (/^chk:가설\./.test(p) && /^(보류|물어볼것)$/.test(r.state)) m['다름:' + p] = '가설과 서류가 다름 — ' + String(r.ask || r.label || p).slice(0, 160); });
  (((L && L.hyp && L.hyp.claims) || [])).forEach(function (x) { if (x.f === '쟁점') m['쟁점:' + x.v] = '새 쟁점(가설) — ' + String(x.v).slice(0, 60) + ((x.srcs || []).length ? ' [' + String(x.srcs[0]).slice(0, 40) + ']' : ''); });
  (((L && L.chain && L.chain.off) || [])).forEach(function (o) { m['사슬밖:' + o.file] = '사건 거래 사슬과 이어지지 않는 계약서 — ' + o.file + ': ' + String(o.why || '').slice(0, 120); }); // [2026.10.29 거래 사슬]
  Object.keys((L && L.ev) || {}).forEach(function (p) { const r = L.ev[p]; if (r.state === '증빙받을것') m['증빙:' + p] = '새로 받을 서류 — ' + String((r.v && r.v.label) || r.label || p).slice(0, 80); });
  return m;
}
// [2026.10.29 계획서 5단계] 사건 흐름 — 가설 → 사건개요 → 처리방향 → 확보할 증빙 → 서류 사실 → 칸 → 질문, 그리고 마지막 한 바퀴
function ledgerFlowView_(c, L, rows) {
  const ovRows = ledgerFlowRows_(L, 'ov').map(function (r) { const raw = (L.ov || {})[r.path] || {}; return Object.assign(r, { hypNote: raw.hypNote || '' }); });
  // 사건개요 중 칸 장부가 주인인 칸(사건분류·기준일·증여 칸)도 같은 표에 — 같은 값을 두 곳에 두지 않고 보여만 준다
  (rows || []).forEach(function (r) { if (/^(사건분류|기준일)$/.test(r.path) || /^g\./.test(r.path)) ovRows.push(Object.assign({}, r, { fromRows: true })); });
  // [2026.10.29 계획서 3판 4단계] 받는 곳(도구·세무사님·고객)과 도구로 이미 받았는지 — 보이기만(고객에게 보내지 않음)
  const ev = ledgerFlowRows_(L, 'ev').map(function (r) { const raw = (L.ev || {})[r.path] || {}, lb = (raw.v && raw.v.label) || r.label, where = ledgerEvWhere_(lb); return Object.assign(r, { 서류: raw.v || {}, owner: raw.src && raw.src.kind || '', 받는곳: where, 도구확보: where === '도구' ? ledgerEvToolHas_(L, lb) : '' }); });
  const kbs = (L.kb && L.kb.sum) || {};
  const q = (rows || []).filter(function (r) { return /^(물어볼것|증빙받을것)$/.test(r.state); }).length;
  const calcRows = (rows || []).filter(function (r) { return !/^(q:|doc:)/.test(r.path) && r.v !== '' && r.v !== undefined && r.v !== null && /^(확정|추정)$/.test(r.state); });
  const n = function (list, re) { return list.filter(function (r) { return re.test(r.state); }).length; };
  return {
    가설: ((L.hyp && L.hyp.claims) || []).map(function (x) { return x.f === '세목' && typeof CASEPROC_TAX_LABEL_ !== 'undefined' && CASEPROC_TAX_LABEL_[x.v] ? Object.assign({}, x, { v: CASEPROC_TAX_LABEL_[x.v] }) : x; }), 가설때: (L.hyp && L.hyp.at) || '',
    사건개요: ovRows, 처리방향: ledgerFlowRows_(L, 'dir'), 증빙: ev,
    띠: { 가설: ((L.hyp && L.hyp.claims) || []).length, 개요확정: n(ovRows, /^(확정|추정)$/), 개요가설: n(ovRows, /^가설$/), 개요다름: ovRows.filter(function (r) { return r.hypNote; }).length,
      증빙확보: n(ev, /^확정$/), 증빙미확보: n(ev, /^증빙받을것$/), 서류사실: kbs.사실 || 0, 칸값: calcRows.length, 칸이음: calcRows.filter(function (r) { return (r.fx || []).length; }).length, 질문: q, 사슬물건: ((L.chain && L.chain.rows) || []).length, 사슬밖: ((L.chain && L.chain.off) || []).length,
      공부: Object.keys(L.pub || {}).length, 추정: calcRows.filter(function (r) { return r.state === '추정'; }).length },
    사슬: L.chain || null, // [2026.10.29 거래 사슬] 물건별 계약서·등기 고리와 납세자 위치, 사슬 밖 계약서
    공부: ledgerPubRows_(L), 조회대상: (function () { try { return ledgerLookupTargets_(c, L).map(function (t) { return { 소재지: t.loc, 어디서: t.from || '', 조회함: !!(L.pub || {})[ledgerPubKey_(t.loc)] }; }); } catch (e) { return []; } })(), // [2026.10.29 계획서 3판 2단계] 공부 사실(조회 결과)·조회할 필지
    마지막: L.flow || null, 옮김: L.flowFrom || ''
  };
}
// 넥스 도구(채팅 넥스 case_ledger · 지휘 넥스 case_ledger) — 바로 실행. 세무사님 말씀을 옮긴 값은 kind 세무사님(값 주인)·by 넥스(적은 이)
function ledgerToolRun_(input, by) {
  input = input || {};
  const c = typeof job_findCase_ === 'function' ? job_findCase_(String(input.caseId || '')) : null;
  if (!c) return { ok: false, error: '사건을 찾을 수 없습니다: ' + (input.caseId || '(없음)') };
  const d = String(input.do || '').trim();
  const kind = input.kind === '세무사님' ? '세무사님' : input.kind === '추정' ? '추정' : '넥스';
  const who = String(by || '넥스').slice(0, 6);
  let r;
  if (d === 'set') r = ledgerSet_(c.id, { path: input.path, value: input.value, kind: kind, by: who, file: input.file, page: input.page, quote: input.quote, why: input.why, label: input.label, cands: input.cands });
  else if (d === 'ask') r = ledgerAsk_(c.id, { path: input.path, label: input.label, question: input.question || input.why, cands: input.cands, needDoc: !!input.needDoc, by: who });
  else if (d === 'decide') r = ledgerDecide_(c.id, { path: input.path, decision: input.decision, note: input.note || input.why, by: who });
  else if (d === 'undo') r = ledgerUndo_(c.id, { path: input.path, by: who });
  else if (d === 'calc') r = ledgerCalcRun_(c, { by: who, name: input.name, over: input.over, why: input.why }); // [2026.10.29 계획서 3판] 시험 계산 — 경우 이름·가정
  else if (d === 'lookup') r = ledgerLookup_(c, input, who); // [2026.10.29 계획서 3판] 공부 조회(있는 조회 도구를 낱개로)
  else if (d === 'estimate') r = ledgerEstimate_(c, input, who); // 의뢰서 등 가설·가정값 → 추정
  else if (d === 'compare') r = ledgerCompare_(c, input, who); // 세목 비교
  else if (d === 'import') r = ledgerImportLegacy_(c);
  else if (d === 'hyp') r = ledgerHypAdd_(c, input, who); // [2026.10.29 계획서 3단계 — 세무사님 결정 권장안 1] 규칙이 못 뽑은 의뢰서 글은 넥스가 읽어 가설을 보탬
  else if (d === 'facts') r = ledgerKbFind_(c, input); // [2026.10.29 넥스 2] 서류 사실 찾기(읽기만)
  else if (d === 'brief') r = Object.assign({ ok: true }, ledgerNexBrief_(c, Number(input.limit) > 1000 ? Number(input.limit) : 6000)); // [2026.10.29 넥스 1] 장부 요약(읽기만)
  else if (d === 'advice') r = ledgerAdvPut_(c, input, who); // [2026.10.30 2단계] 자문 장부 — 쟁점·대안·근거·위험·권고·보고서 적기·고치기·지우기
  else if (d === 'advice_view') r = { ok: true, 자문: ledgerAdvBrief_(c) }; // 자문 장부 보기(읽기만)
  else if (d === 'cite') { const ce = typeof caseProcCalcCite_ === 'function' ? caseProcCalcCite_(c, input.id) : null; r = ce ? Object.assign({ ok: true }, ce) : { ok: false, error: '그 계산 저장본이 이 사건에 없음: ' + (input.id || '') }; } // [2026.10.30] 저장본 하나 인용(입력·결과 — 보고서 숫자의 원천)
  else r = { ok: false, error: 'do는 set·ask·decide·undo·calc·lookup·estimate·compare·import·hyp·facts·brief·advice·advice_view·cite 중 하나' };
  if (r && r.ok) r.남은질문 = ledgerQuestions_(c.id).length;
  if (r && r.ok && /^(set|decide|undo)$/.test(d)) { try { r.처리개요 = ledgerGiftOvSync_(c.id); } catch (e) {} } // 증여 값은 장부가 주인 — 처리개요 요약을 다시 쓴다
  return r;
}
// case_proc 입구(step: ledger·ledgerSet·ledgerAsk·ledgerDecide·ledgerUndo·ledgerCalc·ledgerImport) — 화면·넥스·사이드바가 같은 길
function ledgerApi_(c, body) {
  body = body || {};
  const who = body.by === '넥스' ? '넥스' : '세무사님';
  if (/^ledger(Set|Decide|Undo)$/.test(String(body.step))) { // 증여 값은 장부가 주인 — 장부 화면(📒)에서 고치면 처리개요 요약도 다시 쓴다
    const fn = { ledgerSet: ledgerSet_, ledgerDecide: ledgerDecide_, ledgerUndo: ledgerUndo_ }[body.step];
    const r0 = fn(c.id, Object.assign({}, body, body.step === 'ledgerSet' ? { kind: body.kind || who, by: body.by || who } : { by: body.by || who }));
    if (r0 && r0.ok) { try { r0.처리개요 = ledgerGiftOvSync_(c.id); } catch (e) {} }
    if (r0 && r0.ok && !r0.same && typeof cpFlowQueueAdd_ === 'function') cpFlowQueueAdd_(c.id, who + ' 장부 ' + ({ ledgerSet: '값', ledgerDecide: '결정', ledgerUndo: '되돌림' }[body.step]) + ' — ' + String(body.path || '').slice(0, 30)); // [2026.10.29 계획서 2단계] 답·고침도 한 바퀴로
    return r0;
  }
  switch (body.step) {
    case 'ledger': return ledgerView_(c);
    case 'ledgerSet': return ledgerSet_(c.id, Object.assign({}, body, { kind: body.kind || who, by: body.by || who }));
    case 'ledgerAsk': return ledgerAsk_(c.id, Object.assign({}, body, { by: body.by || who }));
    case 'ledgerDecide': return ledgerDecide_(c.id, Object.assign({}, body, { by: body.by || who }));
    case 'ledgerUndo': return ledgerUndo_(c.id, Object.assign({}, body, { by: body.by || who }));
    case 'ledgerCalc': return ledgerCalcRun_(c, { by: body.by || who, name: body.name, over: body.over, why: body.why });
    case 'ledgerLookup': return ledgerLookup_(c, body, body.by || who); // [2026.10.29 계획서 3판] 📒 ⑤ 도구 — 넥스 case_ledger와 같은 함수
    case 'ledgerEstimate': return ledgerEstimate_(c, body, body.by || who);
    case 'ledgerCompare': return ledgerCompare_(c, body, body.by || who);
    case 'ledgerAdvice': return ledgerAdvPut_(c, body, body.by || who); // [2026.10.30 2단계] 📒 ⑥ 자문 — 넥스 case_ledger do=advice와 같은 함수
    case 'ledgerAdviceView': return { ok: true, 자문: ledgerAdvBrief_(c) };
    case 'ledgerImport': return ledgerImportLegacy_(c);
    case 'ledgerKbBuild': return ledgerKbBuild_(c);
    case 'ledgerFlow': return ledgerFlowBrief_(c); // [2026.10.29] 사건 화면마다 맨 위 장부 띠·옆 패널(가벼운 묶음 — 서류 사실 전부는 싣지 않음)
    default: return null;
  }
}

// ============================================================
// [2026.10.29] 사건 장부의 바탕 — 서류에서 모은 사실 · 서류끼리 맞대기 · 계산기 칸으로 간 길 · 파일별 읽음
// ------------------------------------------------------------
// 세무사님 원문(10-29): "사건장부를 왜 만든거냐? 최대한 많은 데이타를 확보하여 데이타들을 입체적으로 분석하여 유용한 정보를 확보하여
//   시스템에 활용하려고 만든거 아닌가? 혹시 gas가 필요로 하는 데이타만 모아둔 것인가?"
//   / "사건장부를 대체 얼마나 잘 만들고 얼마나 잘 업데이트하고 장부내 정보를 얼마나 입체적으로 비교검토매치시켜서 유용한 정보로 확보하여
//   gas의 적재적소에 뿌려서 원하는 정보를 확보하고 사건을 처리해 나가는지 내가 확인할 수가 없다"
// 위 줄(rows)은 계산기 칸 장부일 뿐이었다. 서류 사실 모으기(cxFacts_ — 모든 서류 정리 결과의 모든 칸)와 서류끼리 맞대기(cxGraph_·cxBind_)는
//   10-18부터 교차검증 안에서 돌았지만 결과를 한 줄 요약만 남기고 버려, 장부에도 화면에도 없었다. 이제 처리개요가 돌 때마다 그 결과를 장부(L.kb)에 남긴다:
//   kb.files  파일마다 읽음/일부/못읽음/제외·종류·이유·쓰인 곳(caseProcLedger_ — 10-15 "파일마다 장부")
//   kb.facts  서류에서 읽은 사실 한 건씩(종류·값·파일·서류 종류·칸 위치·대상(자산/사람))
//   kb.groups 같은 대상·같은 종류 사실을 서류끼리 맞댄 결과(일치·서류 1종·판정됨·시점 다름 가능·미결 — 판정 규칙과 이유)
//   kb.links  계산기·처리개요 칸마다 서류 값과 맞댄 결과(서류와 일치·빈 칸을 서류로 채움·서류와 다름(질문)·서류에 없음)
//   kb.sum / kb.prev  모은 양·맞댄 결과 숫자와 직전 숫자(무엇이 바뀌었는지 — 장부 기록에도 한 줄)
// 판단은 여기서 하지 않는다(모으고 남기기만). 계산기 칸 값의 주인은 위 rows 그대로다.
// ============================================================
var LEDGER_KB_FACT_MAX_ = 4000;
// 계산기 칸 ↔ 같은 뜻의 서류 사실 종류(칸의 서식상 뜻과 사실 종류 이름으로만 — 사건 맞춤 아님). ③ 보기와 후보 붙이기(ledgerKbOffer_)가 같이 쓴다
var LEDGER_KB_KIND_OF_ = [[/^i\.debtAmount$/, /대출 잔액|채무|부채|대출 원금/], [/^i\.financialAmount$/, /^(예금 잔액|금융재산|잔고|예금)$/], [/^i\.funeralAmount$/, /장례/], [/^i\.nicheAmount$/, /봉안|자연장/], [/^i\.realEstateAmount$/, /공시가격|감정가액|매매사례/],
  [/(^|\.)totalPrice$/, /매매대금|거래 금액|등기 거래가액|양도가액/], [/acquisitionPrice$/, /매매대금|거래 금액|등기 거래가액|취득가액/], [/^g\.giftAmount$/, /공시가격|감정가액|매매사례|예금 잔액|이체 금액|금액/]];
// 장부가 모은 서류 사실을 "정해지지 않은 칸"(추정·물어볼 것·증빙 받을 것)에 고를 수 있는 후보로 붙인다 — 값은 정하지 않는다(고르는 것은 세무사님·넥스).
//  세무사님 원문(10-29): "장부내 정보를 … 유용한 정보로 확보하여 gas의 적재적소에 뿌려서 원하는 정보를 확보하고 사건을 처리해 나가는지" — 예: 채무 칸 0원(추정)인데
//  대출잔액증명서에서 "대출 잔액 142,000,000"을 읽어 두었으면, 채무 칸 후보에 「142,000,000 — 대출 잔액(대출잔액증명서.pdf)」을 붙인다(📒 ④·사이드바 질문에서 한 번에 고름)
function ledgerKbOffer_(caseId, kbFacts) {
  if (!caseId || !Array.isArray(kbFacts) || !kbFacts.length) return 0;
  return ledgerMutate_(caseId, function (L) { return ledgerKbOfferInner_(L, kbFacts); }) || 0;
}
function ledgerKbOfferInner_(L, kbFacts) {
  let added = 0; const notes = [];
  if (!Array.isArray(kbFacts) || !kbFacts.length) return 0;
  (function () {
    Object.keys(L.rows || {}).forEach(function (p) {
      const r = L.rows[p];
      if (!r || !/^(추정|물어볼것|증빙받을것)$/.test(String(r.state || '')) || (r.src && /^(세무사님|넥스)$/.test(r.src.kind))) return;
      const m = LEDGER_KB_KIND_OF_.filter(function (x) { return x[0].test(p); })[0]; if (!m) return;
      const have = {}; (r.cands || []).forEach(function (c) { have[ledgerKbNorm_('', c.v)] = 1; });
      const curN = ledgerKbNorm_('', r.v), got = [];
      kbFacts.forEach(function (f) {
        if (!m[1].test(String(f.k || '')) || f.cp || /^기타:/.test(String(f.k || ''))) return;
        const n = ledgerKbNorm_(f.k, f.v); if (!n || !/^\d+$/.test(n) || have[n] || n === curN) return;
        have[n] = 1; added++;
        const cand = { v: n, 값: Number(n).toLocaleString('ko-KR') + '원', src: '서류 사실: ' + f.k + ' — ' + f.f + (f.t ? ' · ' + f.t : '') }; // 파일 이름에 괄호가 있을 수 있어 서류 종류는 " · "로 뗀다
        got.push(cand);
        r.cands = (r.cands || []).concat([cand]).slice(0, 8);
        notes.push(ledgerLabel_(p) + ' ← ' + Number(n).toLocaleString('ko-KR') + '원(' + f.f + ')');
      });
      // 추정의 전제가 "서류가 없어서"인데 장부에 같은 종류 서류 사실이 있으면 — 추정으로 넘기지 않고 묻는다(10-28 원문 "부족한 정보는 물어보거나 … 추정치나 가정치")
      //  서류가 있는데 "없다"고 보는 것은 추정이 아니라 틀린 전제다. 지금 추정 값도 후보에 남긴다(그 서류가 이 칸과 무관하면 그대로 고름)
      if (got.length && r.state === '추정' && /없어\s*0원으로\s*봄|없으므로|없어서/.test(String((r.src && (r.src.why + ' ' + r.src.quote)) || ''))) {
        const lb = r.label || ledgerLabel_(p);
        ledgerAskInner_(L, p, { label: lb, by: 'GAS', question: '「' + lb + '」을(를) ' + ledgerValueText_(p, r.v) + '(서류가 없다고 보고 추정)으로 두었는데, 장부가 모은 서류에 같은 종류 사실이 있습니다: ' + got.map(function (x) { return x.값 + '(' + x.src.replace(/^서류 사실:\s*/, '') + ')'; }).join(', ') + '. 맞는 값을 골라 주세요 — 그 서류가 이 칸과 무관하면 지금 값을 고르세요',
          cands: got.concat([{ v: String(r.v), src: '지금 추정 값 그대로(그 서류는 이 칸과 무관)' }]) });
        L.rows[p].kbAsk = true;
        notes.push(lb + ' 추정 → 물어볼 것(서류가 있는데 "없다"는 전제)');
      }
      // 그 서류에 대해 따로 서 있던 "무슨 서류인지 — 칸에 못 넣음" 질문은 이 칸 질문 하나로 합친다(같은 서류로 두 번 묻지 않게)
      got.forEach(function (cd) { const m = /—\s*(.+?)(?:\s·\s|$)/.exec(cd.src); const dp = m ? 'doc:' + m[1].trim().slice(0, 80) + '.use' : ''; const dr = dp && L.rows[dp]; if (dr && /^(물어볼것|증빙받을것)$/.test(dr.state) && dr.src && dr.src.who === 'GAS' && !dr.qd) { delete L.rows[dp]; notes.push('「' + m[1].trim() + '」 서류 질문 → ' + (r.label || ledgerLabel_(p)) + ' 질문으로 합침'); } });
    });
    if (notes.length) ledgerLogTo_(L, { by: 'GAS', what: '서류 사실을 후보로 붙임', detail: notes.slice(0, 6).join(' · ') + ' — 값은 정하지 않음(고르기는 세무사님·넥스)' });
  })();
  return added;
}
// [2026.10.29 장부 하나로] 바탕(kb)은 칸 장부 파일 안 L.kb — 따로 두던 짝 파일(<사건ID>.바탕.json)은 처음 쓸 때 한 번 옮겨 오고 더는 쓰지 않는다.
//  ledgerKbLoad_·ledgerKbStore_는 이름만 남긴 입구(직결 서비스·t6MergeLedger_가 부름) — 둘 다 칸 장부(ledgerLoad_·ledgerMutate_)를 거친다. 🧪 모래상자는 칸 장부만 바꿔 끼우면 바탕도 같이 메모리로 간다
function ledgerKbOldFile_(caseId) {
  try { const it = ledgerFolder_().getFilesByName(String(caseId).replace(/[^\w-]/g, '_') + '.바탕.json'); return it.hasNext() ? it.next() : null; } catch (e) { return null; }
}
function ledgerKbAdopt_(caseId, L) {
  if (!L || L.kb || L.kbFrom) return;
  const f = ledgerKbOldFile_(caseId);
  if (f) { try { const kb = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}') || {}; if (kb.facts || kb.files) { L.kb = kb; L.kbFrom = '짝 파일에서 옮김 ' + caseProcNow_(); ledgerLogTo_(L, { by: 'GAS', what: '장부 하나로 합침', detail: '따로 두던 바탕(서류 사실 ' + (kb.facts || []).length + '건·파일 ' + (kb.files || []).length + '개)을 칸 장부 안으로 옮김' }); return; } } catch (e) {} }
  L.kbFrom = '없음';
}
function ledgerKbLoad_(caseId) {
  const L = ledgerLoad_(caseId) || {};
  if (L.kb) return L.kb;
  if (L.kbFrom) return {};
  // 아직 옮기지 않은 장부 — 읽기만(옮기기는 다음 쓰기 때 잠금 안에서)
  try { const f = ledgerKbOldFile_(caseId); return f ? (JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}') || {}) : {}; } catch (e) { return {}; }
}
function ledgerKbStore_(caseId, kb) { ledgerMutate_(caseId, function (L) { L.kb = kb || {}; }); return true; }
// 사실 번호 — 같은 서류·같은 자리·같은 종류·같은 값이면 다시 모아도 같은 번호(칸이 가리키는 번호가 다시 모을 때마다 바뀌지 않게)
function ledgerKbFactId_(x) {
  const s = [x.f, x.w, x.k, x.v].join('|');
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 's' + h.toString(36);
}
function ledgerKbFacts_(facts) {
  const out = [], seen = {};
  (facts || []).forEach(function (f) {
    if (!f || !f.src || out.length >= LEDGER_KB_FACT_MAX_) return;
    let v = f.kind === '공시가격' && f.value && typeof f.value === 'object' ? (f.value.가격 || f.value.단가 || '') + (f.value.연도 ? '(' + f.value.연도 + ')' : '') : (f.raw != null && f.raw !== '' ? f.raw : f.value);
    if (v && typeof v === 'object') { try { v = JSON.stringify(v); } catch (e) { v = ''; } }
    let sj = ''; try { if (typeof cxgSubject_ === 'function') sj = cxgSubject_(f) || ''; } catch (e) { sj = ''; }
    const x = { k: String(f.kind || ''), v: String(v == null ? '' : v).slice(0, 120), f: String(f.src.file || ''), t: String(f.src.docType || ''), w: String(f.src.where || '').slice(0, 80), s: sj, u: f.read && f.read.conf === '불확실' ? 1 : 0, cp: f._copy ? 1 : 0 };
    let id = ledgerKbFactId_(x); while (seen[id]) id += 'x'; seen[id] = 1; x.id = id;
    const n = x.k === '서류' ? '' : ledgerKbNorm_(x.k, x.v); if (n) x.n = n;
    out.push(x);
  });
  return out;
}
// 칸 ↔ 사실 잇기 — 장부에 무엇이 쓰이든(칸 값·사실) 쓸 때마다 다시 잇는다(둘이 어긋날 수 없게).
//  fx = 이 칸의 지금 값과 같은 값을 말한 사실 번호(서류 사본 제외) · fk = 같은 뜻의 사실인데 값이 다른 것(LEDGER_KB_KIND_OF_ — 칸의 서식상 뜻과 사실 종류 이름으로만)
//  값을 정하지는 않는다 — 어느 서류가 이 칸을 받쳐 주는지·어긋나는지 장부 안에서 바로 보이게 할 뿐
function ledgerKbRelink_(L) {
  const kb = L && L.kb, facts = kb && Array.isArray(kb.facts) ? kb.facts : null;
  if (!facts || !L.rows) return;
  const idx = {};
  facts.forEach(function (f) {
    if (!f.id) { f.id = ledgerKbFactId_(f); }
    if (f.n === undefined) { const n = f.k === '서류' ? '' : ledgerKbNorm_(f.k, f.v); if (n) f.n = n; }
    if (!f.n || f.cp || f.n.length < 2) return;
    (idx[f.n] = idx[f.n] || []).push(f);
    const ho = /(\d+)\s*호/.exec(String(f.v || '')); if (ho) (idx['호:' + ho[1]] = idx['호:' + ho[1]] || []).push(f);
  });
  const used = {};
  Object.keys(L.rows).forEach(function (p) {
    const r = L.rows[p]; if (!r) return;
    delete r.fx; delete r.fk;
    if (/^(q:|doc:|chk:)/.test(p) || r.v === '' || r.v == null || typeof r.v === 'object' || typeof r.v === 'boolean') return;
    const n = ledgerKbNorm_('', r.v), hm = /^(?:\d+\s*동\s*)?(\d+)\s*호$/.exec(String(r.v).trim());
    const hit = (n && n.length >= 2 && idx[n]) || (hm ? idx['호:' + hm[1]] : null) || [];
    if (hit.length) { r.fx = hit.slice(0, 12).map(function (f) { return f.id; }); r.fx.forEach(function (id) { (used[id] = used[id] || []).push(p); }); }
    const m = LEDGER_KB_KIND_OF_.filter(function (x) { return x[0].test(p); })[0];
    if (m) { const other = facts.filter(function (f) { return m[1].test(String(f.k || '')) && !f.cp && f.n && /^\d+$/.test(f.n) && f.n !== n; }); if (other.length) r.fk = other.slice(0, 8).map(function (f) { return f.id; }); }
  });
  // 사실 쪽에도 "이 사실이 쓰인 칸"(to) — 같은 잇기에서 나온 것이라 칸 쪽 fx와 늘 맞는다
  facts.forEach(function (f) { if (used[f.id]) f.to = used[f.id].slice(0, 6); else delete f.to; });
}
// 값 맞대기용 고르기 — 날짜(yyyy-mm-dd)·금액·면적(쉼표·원·㎡ 뗌)·주민번호(앞 6자리, 가림 무관)·동호(○동○호)·이름표("매도인 ")를 뗀 글
var LEDGER_KB_ROLE_RE_ = /^(소유자|매도인|매수인|양도인|양수인|고객명|성명|대표자|상호|임대인|임차인|증여자|수증자|피상속인|상속인|본인)\s*[:：]?\s*/;
function ledgerKbNorm_(kind, v) {
  if (v == null || typeof v === 'object') return '';
  let s = String(v).replace(/\s+/g, ' ').trim(); if (!s) return '';
  s = s.replace(LEDGER_KB_ROLE_RE_, '');
  const d = /^(\d{4})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/.exec(s); if (d) return d[1] + '-' + ('0' + d[2]).slice(-2) + '-' + ('0' + d[3]).slice(-2);
  if (kind === '주민번호' || /\d{6}\s*-\s*[\d*]/.test(s)) { const m = /(\d{6})\s*-\s*[\d*]/.exec(s.replace(/\s+/g, '')) || /(\d{6})/.exec(s); if (m) return m[1] + '-'; }
  if (kind === '동호') { const dh = /(\d+)\s*동[\s\S]*?(\d+)\s*호/.exec(s) || /()(\d+)\s*호/.exec(s); if (dh) return (dh[1] ? dh[1] + '동' : '') + dh[2] + '호'; }
  const u = s.replace(/\s*(원|㎡|m2|m²|평|원정)$/i, '');
  if (/^-?[\d,]*\.?\d+$/.test(u)) return String(Number(u.replace(/[^\d.-]/g, '')));
  return s.replace(/[\s,()]/g, '');
}
// 칸 값마다 "이 값이 나온 서류" — 판정 엔진은 칸마다 정해진 종류의 서류만 세므로(예: 양도가액은 계약서만), 모든 사실에서 같은 값을 말한 파일을 따로 보여 준다(보기용)
function ledgerKbSeen_(facts, links) {
  const idx = {};
  (facts || []).forEach(function (f) {
    if (!f || !f.src || f.kind === '서류' || f._copy) return;
    const raw = f.raw != null && f.raw !== '' ? f.raw : f.value;
    const n = ledgerKbNorm_(f.kind, raw); if (!n || n.length < 2) return;
    const put = function (key) { const e = idx[key] = idx[key] || {}; e[f.src.file] = (e[f.src.file] || '') || (f.src.docType || ''); };
    put(n);
    const ho = /(\d+)\s*호/.exec(String(raw || '')); if (ho) put('호:' + ho[1]); // 호실은 "101동 제12층 제1203호"·"1203호"처럼 적는 법이 달라 호수로도 찾는다
  });
  (links || []).forEach(function (l) {
    if (l.cur === '' || l.cur == null) return;
    const n = ledgerKbNorm_('', l.cur), hm = /^(?:\d+\s*동\s*)?(\d+)\s*호$/.exec(String(l.cur).trim()), e = idx[n] || (hm ? idx['호:' + hm[1]] : null);
    l.seen = e ? Object.keys(e).slice(0, 8).map(function (fn) { return fn + (e[fn] ? '(' + e[fn] + ')' : ''); }) : [];
  });
  return links;
}
function ledgerKbGroups_(facts) {
  let gs = [];
  try { gs = typeof cxGraph_ === 'function' ? cxGraph_(facts) : []; } catch (e) { gs = []; }
  const out = gs.map(function (g) {
    return { s: g.subject, k: g.kind, st: g.status || '', d: g.d == null ? '' : String(g.d), rule: g.rule || '', why: g.why || '', route: g.route || '', how: '판정 맞대기',
      cl: (g.classes || []).map(function (c) { const docs = {}; Object.keys(c.docs || {}).forEach(function (dt) { docs[dt] = (c.docs[dt] || []).slice(0, 4); }); return { v: String(c.v == null ? '' : c.v).slice(0, 120), n: c.ndoc || Object.keys(docs).length, docs: docs, ck: c.check || 0 }; }) };
  });
  // 넓은 맞대기(보기용 — 판정·질문·칸 채움에는 쓰지 않는다): 판정 엔진(cxGraph_)은 대상 열쇠를 정할 수 있는 종류(지번·면적·주민번호 등)만 맞대서
  //  매매대금·계약일·잔금일·성명 같은 사실은 서류끼리 나란히 놓이지 않았다(가상양도 한 건: 사실 184건 중 맞댄 묶음 5개). 세무사님이 "입체적으로 비교검토매치"를
  //  확인하실 수 있게, 같은 부동산(사실이 붙은 기록의 소재지)·같은 종류의 사실을 서류마다 나란히 놓는다. 소재지가 안 붙은 사실은 "사건 전체"로 묶는다.
  //  서로 다른 거래(등기부의 옛 매매 등)도 같은 묶음에 들어올 수 있어 "서로 다름"은 판정이 아니라 살펴볼 거리로만 표시한다.
  try {
    const covered = {}; out.forEach(function (g) { covered[g.k] = 1; });
    // 맞댈 뜻이 없는 줄(서류 글 한 줄·항목 묶음·순위·접수번호)은 ① 모은 것에만 두고 맞대기에서 뺀다
    const SKIP = /^(글자 줄|항목|등기 순위|순위번호|접수번호|법무사 비용 항목|성명)$/;
    // 같은 뜻의 사실은 이름이 달라도 한 묶음으로(계약서 "매매대금" = 등기부 "거래가액" = 신고서·명세서 "취득가액·양도가액" — 같은 거래 금액을 서류마다 다르게 부름)
    const FAMILY = { 매매대금: '거래 금액', '등기 거래가액': '거래 금액', 거래가액: '거래 금액', 거래금액: '거래 금액', 취득가액: '거래 금액', 양도가액: '거래 금액', 잔금일: '잔금일', 계약일: '계약일' };
    // 값이 여럿인 것이 정상인 종류(한 부동산에 취득·양도 거래가 따로 있음·영수증마다 합계가 다름) — 값마다 몇 서류가 말하는지만 보이고 "다름"으로 치지 않는다
    const MULTI_OK = /^(거래 금액|계약금|중도금|잔금|계약일|잔금일|접수일|원인일|취득일|양도일|등기 원인|등기 목적|합계|금액|공시가격|날짜)$/;
    const ROLE = /^(소유자|매도인|매수인|양도인|양수인|고객명|성명|대표자|상호|임대인|임차인|증여자|수증자|피상속인|상속인|본인)\s*[:：]?\s*/;
    const norm = ledgerKbNorm_;
    // 사람: 사실에 붙은 사람 열쇠(이름만), 없으면 값 머리의 이름("강민준 780412-…"·"매도인 강민준")
    const personOf = function (f, raw) { const k = f.keys && f.keys.person; if (k) return String(k).split('|')[0].replace(/\s+/g, ''); const m = /^(?:[가-힣]{2,5}\s*[:：]?\s*)?([가-힣]{2,4})\s*\(?\s*\d{6}/.exec(String(raw || '').replace(ROLE, '')); return m ? m[1] : ''; };
    const G = {};
    (facts || []).forEach(function (f) {
      if (!f || !f.src || f.kind === '서류' || f._copy || /^기타:/.test(String(f.kind || '')) || SKIP.test(String(f.kind || ''))) return;
      if (covered[f.kind] && typeof cxgSubject_ === 'function' && cxgSubject_(f)) return; // 판정 맞대기가 이미 다룬 사실
      const raw = f.kind === '공시가격' && f.value && typeof f.value === 'object' ? (f.value.가격 || f.value.단가 || '') : (f.raw != null && f.raw !== '' ? f.raw : f.value);
      const n = norm(f.kind, raw); if (!n) return;
      const pn = /^(주민번호|생년월일|주소|관계|등록기준지)$/.test(f.kind) ? personOf(f, raw) : '';
      const a = String((f.keys && f.keys.asset) || '').split('|')[0];
      const sj = pn ? '사람:' + pn : a ? '자산:' + a : '사건 전체';
      const fam = FAMILY[f.kind] || f.kind;
      const key = sj + '#' + fam;
      const g = G[key] = G[key] || { s: sj, k: fam, classes: {}, kinds: {} };
      g.kinds[f.kind] = 1;
      const c = g.classes[n] = g.classes[n] || { v: String(raw).replace(/\s+/g, ' ').trim().slice(0, 120), docs: {}, files: {} };
      const dt = f.src.docType || '서류';
      c.files[f.src.file] = 1;
      c.docs[dt] = c.docs[dt] || []; if (c.docs[dt].indexOf(f.src.file) === -1 && c.docs[dt].length < 4) c.docs[dt].push(f.src.file);
    });
    Object.keys(G).forEach(function (k) {
      const g = G[k], cl = Object.keys(g.classes).map(function (n) { const c = g.classes[n]; return { v: c.v, n: Object.keys(c.docs).length, nf: Object.keys(c.files).length, docs: c.docs, ck: 0 }; });
      const files = {}; Object.keys(g.classes).forEach(function (n) { Object.keys(g.classes[n].files).forEach(function (fn) { files[fn] = 1; }); });
      let st, why = '';
      if (cl.length === 1) st = cl[0].nf >= 2 ? '일치' : '단독';
      else if (Object.keys(files).length === 1) st = '같은 서류 안 여러 값';
      else if (MULTI_OK.test(g.k) || g.s === '사건 전체') { st = '거래마다 다른 값'; why = (g.s === '사건 전체' ? '누구·어느 물건의 값인지 열쇠가 안 붙은 사실 — 값이 여럿인 것이 정상일 수 있음' : '한 부동산에 거래(취득·양도 등)가 여럿이면 값이 여럿인 것이 정상') + ' — 값마다 몇 서류가 같은 값을 말하는지 봅니다' + (cl.some(function (c) { return c.nf < 2; }) ? ' · 서류 1개만 말하는 값: ' + cl.filter(function (c) { return c.nf < 2; }).map(function (c) { return c.v; }).slice(0, 4).join(', ') : ''); }
      else { st = '서로 다름(살펴볼 것)'; why = '같은 ' + (/^사람:/.test(g.s) ? '사람' : '부동산') + '에 대해 서로 다른 서류가 다른 값을 말함 — 시점이 다른지(이사·지목 변경 등) 살펴볼 것. 계산에 쓰는 칸이면 ③ 칸으로 간 길에서 판정·질문을 봅니다'; }
      const kindsTxt = Object.keys(g.kinds || {}).length > 1 ? ' (서류마다 이름: ' + Object.keys(g.kinds).join('·') + ')' : '';
      out.push({ s: g.s, k: g.k + kindsTxt, st: st, d: cl.length === 1 ? cl[0].v : '', rule: '', why: why, route: '', how: '넓은 맞대기(보기용)', cl: cl.sort(function (x, y) { return y.nf - x.nf; }).slice(0, 12) });
    });
  } catch (e) {}
  return out;
}
function ledgerKbSum_(kb) {
  const s = { 사실: (kb.facts || []).length, 파일: (kb.files || []).length, 서류종류: 0, 묶음: (kb.groups || []).length, 칸: (kb.links || []).length };
  const dts = {}; (kb.facts || []).forEach(function (f) { if (f.t) dts[f.t] = 1; }); s.서류종류 = Object.keys(dts).length;
  (kb.groups || []).forEach(function (g) { s['맞대기:' + g.st] = (s['맞대기:' + g.st] || 0) + 1; });
  (kb.links || []).forEach(function (l) { s['칸:' + l.res] = (s['칸:' + l.res] || 0) + 1; });
  (kb.files || []).forEach(function (f) { s['파일:' + (f.st || '?')] = (s['파일:' + (f.st || '?')] || 0) + 1; });
  return s;
}
function ledgerKbDiff_(a, b) {
  if (!a) return '처음 모음';
  const keys = {}; Object.keys(a).concat(Object.keys(b || {})).forEach(function (k) { keys[k] = 1; });
  const ch = Object.keys(keys).filter(function (k) { return (a[k] || 0) !== ((b || {})[k] || 0); }).map(function (k) { return k + ' ' + (a[k] || 0) + '→' + ((b || {})[k] || 0); });
  return ch.length ? ch.slice(0, 12).join(' · ') : '바뀐 것 없음';
}
// 처리개요 끝 교차검증(cxResolve0_)이 부른다 — facts: 그 실행의 사건 사실 전부, rec.links: 칸 맞대기 기록
function ledgerKbSave_(cc, facts, rec) {
  if (!cc || !cc.id) return null;
  const links = ((rec && rec.links) || []).slice(0, 600);
  try { ledgerKbSeen_(facts, links); } catch (e) {}
  const kbNew = { at: caseProcNow_(), facts: ledgerKbFacts_(facts), groups: ledgerKbGroups_(facts), links: links, factsAll: (facts || []).length };
  return ledgerKbPut_(cc.id, kbNew, (rec && rec.what) || '서류 사실 다시 모음', true, rec && rec.why);
}
// ③ 칸으로 간 길 — 화면을 열 때마다 "지금" 장부 칸으로 맞춘다(서류 사실은 처리개요 교차검증 때 모으지만, 상속·증여 칸은 그 뒤에 장부에 들어가므로 저장해 둔 길만 보면 빠진다)
//  저장해 둔 교차검증 맞대기 줄 + 장부 칸 전부(세목 무관) + 증여·상속 처리개요 칸 — 칸마다 값을 넣은 주체와 그 값이 나온 서류(모은 사실 전부에서)
function ledgerKbLiveLinks_(caseId, kb, c) {
  const links = JSON.parse(JSON.stringify((kb && kb.links) || []));
  const cc = c || { id: caseId };
  try {
    const L0 = ledgerLoad_(caseId) || {}, rows = L0.rows || {};
    Object.keys(rows).forEach(function (p) {
      const r = rows[p] || {};
      if (/^(q:|doc:|tr:|ih:|chk:)/.test(p) || !/^(확정|추정)$/.test(String(r.state || ''))) return;
      let cur = r.v;
      if (cur && typeof cur === 'object') { try { cur = (Array.isArray(cur.acq) || Array.isArray(cur.tr)) ? [].concat(cur.acq || [], cur.tr || []).map(function (x) { return (x.label || '') + ' ' + (x.amount || ''); }).join(', ') : JSON.stringify(cur); } catch (e) { cur = ''; } }
      if (cur === '' || cur == null) return;
      const own = { kind: r.src && r.src.kind || '', file: r.src && r.src.file || '', state: r.state };
      const ex = links.filter(function (l) { return l.path === p; })[0];
      if (ex) { ex.owner = own; ex.fx = r.fx || []; ex.fk = r.fk || []; return; }
      let txt = ''; try { txt = ledgerValueText_(p, r.v); } catch (e) { txt = ''; }
      if (links.length < 800) links.push({ by: '장부 칸', path: p, label: String(r.label || p), cur: String(cur).slice(0, 120), curTxt: txt && txt !== String(cur) ? txt : '', res: '', d: '', rule: '', why: '', vals: [], owner: own, fx: r.fx || [], fk: r.fk || [] });
    });
  } catch (e) {}
  // 증여·상속 처리개요 칸(상속인·재산·채무·장례비 등 — 아직 장부 줄이 아닌 칸)도 같은 표에 — 처리개요 근거 기록(filled)의 출처를 주인으로
  try {
    if (cc.세목 === 'gift' || cc.세목 === 'inheritance') {
      const ov = cc.사건개요 || {}, sv0 = (typeof caseProcLoad_ === 'function' ? caseProcLoad_(cc.id) : {}) || {}, filled = sv0.filled || {};
      const KO = Object.assign({ ihDeceasedName: '피상속인 성명', ihDeathDate: '상속개시일' }, typeof CXG_OV_KO_ !== 'undefined' ? CXG_OV_KO_ : {});
      Object.keys(ov).forEach(function (k) {
        if (links.length >= 800 || links.some(function (l) { return l.path === k || l.path === 'g.' + k; })) return;
        const label = KO[k] || (/^[가-힣]/.test(k) ? k : ''); if (!label) return;
        if (/^(ihDeceasedName|상속인수)$/.test(k) && links.some(function (l) { return /^i\.(deceasedName|heirCount)$/.test(l.path); })) return; // 장부 칸과 같은 사실(피상속인 성명·상속인 수)은 한 번만
        let v = ov[k];
        if (Array.isArray(v)) v = v.map(function (x) { return x && typeof x === 'object' ? [x.name || x.이름 || '', x.relation || x.관계 || '', x.amount || x.금액 || ''].filter(Boolean).join(' ') : String(x); }).join(', ');
        else if (v && typeof v === 'object') { try { v = JSON.stringify(v); } catch (e) { v = ''; } }
        if (v === '' || v == null || v === false) return;
        const fsrc = filled[k] && filled[k].src ? String(filled[k].src) : '';
        const kind = /세무사님/.test(fsrc) ? '세무사님' : /넥스/.test(fsrc) ? '넥스' : /추정/.test(fsrc) ? '추정' : fsrc ? '서류' : '';
        links.push({ by: '처리개요 칸', path: k, label: label, cur: String(v).slice(0, 120), res: '', d: '', rule: '', why: fsrc.slice(0, 160), vals: [], owner: { kind: kind, file: '', state: kind === '추정' ? '추정' : '확정' } });
      });
    }
  } catch (e) {}
  // 모은 사실(짧은 모양)로 "그 값이 나온 서류"를 다시 찾는다 — 이미 찾아 둔 줄(seen)은 그대로
  try { const pf = ((kb && kb.facts) || []).map(function (f) { return { kind: f.k, raw: f.v, src: { file: f.f, docType: f.t } }; }); ledgerKbSeen_(pf, links.filter(function (l) { return !l.seen; })); } catch (e) {}
  // 칸과 같은 종류의 서류 사실을 옆에 붙인다(보기용) — 예: 채무 칸 0원(추정)인데 대출잔액증명서에 "대출 잔액 142,000,000"이 있으면 둘이 한 줄에 보이고 "다름 — 확인"
  //  종류 짝은 계산기 칸의 뜻(서식 칸)과 서류 사실 종류 이름으로만 정한다(사건 맞춤 아님)
  try {
    const KIND_OF = LEDGER_KB_KIND_OF_;
    const facts0 = (kb && kb.facts) || [];
    links.forEach(function (l) {
      if (l.vals && l.vals.length) return; // 교차검증 엔진이 이미 서류 값을 붙인 줄
      const m = KIND_OF.filter(function (x) { return x[0].test(String(l.path || '')); })[0]; if (!m) return;
      const hits = facts0.filter(function (f) { return m[1].test(String(f.k || '')) && !f.cp && !/^기타:/.test(String(f.k || '')) && !/^\d{4}-\d{2}-\d{2}$/.test(ledgerKbNorm_(f.k, f.v)); }); // 서류 고유 칸(기타:)·날짜는 금액 칸과 맞대지 않음
      if (!hits.length) return;
      const by = {}; hits.forEach(function (f) { const n = ledgerKbNorm_(f.k, f.v); if (!n) return; const e = by[n] = by[n] || { v: f.v, files: {}, kinds: {} }; e.files[f.f] = f.t || ''; e.kinds[f.k] = 1; });
      l.vals = Object.keys(by).slice(0, 6).map(function (n) { const e = by[n]; return { v: e.v, n: Object.keys(e.files).length, src: Object.keys(e.kinds).join('·') + ' — ' + Object.keys(e.files).join(', ') }; });
      const cn = ledgerKbNorm_('', l.cur);
      if (l.vals.length && !by[cn] && !/^(세무사님|넥스)$/.test((l.owner || {}).kind)) l.res = '서류 값과 다름 — 확인(서류: ' + l.vals.map(function (v) { return v.v; }).slice(0, 3).join(', ') + ')';
    });
  } catch (e) {}
  // 칸 이름은 한국어로(화면에 코드 이름을 보이지 않는다) — 장부 이름표 → 처리개요 이름표 → 계산기 칸 이름표 순
  const koOf = function (p) {
    const s = String(p || ''), bare = s.replace(/^g\./, '');
    let l = '';
    try { l = ledgerLabel_(s); } catch (e) { l = ''; }
    if (!l || l === s || /^[a-z]/.test(l) || /^g\./.test(l)) l = (typeof CXG_OV_KO_ !== 'undefined' && CXG_OV_KO_[bare]) || (typeof CASEPROC_FIELD_KO_ !== 'undefined' && CASEPROC_FIELD_KO_[bare]) || '';
    if (!l) {
      const PK = { giftDoneeName: '수증자 성명', giftDonorName: '증여자 성명', giftDoneeRegNo: '수증자 주민등록번호', giftDonorRegNo: '증여자 주민등록번호', giftRelation: '증여자와의 관계', giftDoneeAddress: '수증자 주소', giftDonorAddress: '증여자 주소',
        'i.financialAmount': '금융재산', 'i.realEstateAmount': '부동산 등 재산 평가액', 'i.debtAmount': '채무', 'i.duesAmount': '공과금', 'i.funeralAmount': '장례비', 'i.nicheAmount': '봉안시설·자연장지 비용', 'i.heirCount': '상속인 수', 'i.isSpouse': '배우자 있음', 'i.childCount': '자녀 수', 'i.deceasedName': '피상속인 성명', 'i.priorGiftHeirAmount': '상속인에게 한 사전증여(10년)', 'i.priorGiftOtherAmount': '상속인 외에게 한 사전증여(5년)', 'i.appraisalFeeAmount': '감정평가수수료',
        transferCause: '양도 원인', assetFloor: '층', assetKind: '자산 종류', assetType: '과세대상 구분' };
      const tail = s.replace(/^[ac]\d+\./, '');
      l = PK[s] || PK[bare] || PK[tail] || '';
      if (l && /^a(\d+)\./.test(s)) l = '자산' + (Number(/^a(\d+)\./.exec(s)[1]) + 1) + ' ' + l;
      if (l && /^c(\d+)\./.test(s)) l = '계약' + (Number(/^c(\d+)\./.exec(s)[1]) + 1) + ' ' + l;
    }
    return l || s;
  };
  links.forEach(function (l) { if (/^[a-z]/.test(String(l.label || '')) || /^g\./.test(String(l.label || ''))) { const k1 = koOf(l.path || l.label); l.label = k1 !== (l.path || l.label) ? k1 : koOf(l.label); } });
  links.forEach(function (l) {
    if (l.res) return;
    const o = l.owner || {}, n = (l.seen || []).length;
    let en = ''; try { en = ledgerEnumOf_(l.path || ''); } catch (e) { en = ''; }
    if (en && !/^(세무사님|넥스)$/.test(o.kind) && o.state !== '추정' && !n) { l.res = '고른 구분값(서류를 보고 고름)'; return; }
    l.res = /^(세무사님|넥스)$/.test(o.kind) ? (n ? '세무사님·넥스 값(서류에도 있음)' : '세무사님·넥스 값') : o.state === '추정' ? (n ? '추정(서류에 같은 값 있음)' : '추정(서류에 없음)') : o.kind === '계산' ? '계산한 값' : n >= 2 ? '서류와 일치(서류 2개 이상)' : n === 1 ? '서류 1개와 같음' : o.kind === '규칙' ? '규칙으로 만든 값(서류 사실을 세거나 고른 것)' : '서류에 없는 값';
  });
  return links;
}
// 새 바탕을 칸 장부 안(L.kb)에 쓰고(파일 장부는 지금 것 유지), 같은 쓰기에서 기록 한 줄·후보 붙이기·칸↔사실 잇기까지(잠금 한 번, 파일 한 번)
function ledgerKbPut_(caseId, kbNew, what, offer, why) {
  let sum = null, offered = 0;
  const w = ledgerMutate_(caseId, function (L) {
    const old = L.kb || {};
    if (!(kbNew.files || []).length) { kbNew.files = old.files || []; kbNew.filesAt = old.filesAt || ''; }
    (kbNew.facts || []).forEach(function (f) { if (!f.id) f.id = ledgerKbFactId_(f); }); // 직결 서비스 옛 판이 보낸 사실에도 번호
    kbNew.sum = ledgerKbSum_(kbNew);
    kbNew.prev = old.sum || null;
    kbNew.prevAt = old.at || '';
    L.kb = kbNew; sum = kbNew.sum;
    ledgerLogTo_(L, { by: 'GAS', what: what || '서류 사실 다시 모음', detail: (why ? String(why).slice(0, 90) + ' → ' : '') + '사실 ' + sum.사실 + '건(서류 ' + sum.서류종류 + '종) · 맞댄 묶음 ' + sum.묶음 + ' · 칸 ' + sum.칸 + ' — 직전과 달라진 것: ' + ledgerKbDiff_(kbNew.prev, sum) });
    if (offer !== false) { try { offered = ledgerKbOfferInner_(L, kbNew.facts); } catch (e) {} }
    return { ok: true };
  });
  if (!w || !w.ok) return { ok: false, error: (w && w.error) || '장부에 쓰지 못함' };
  return { ok: true, sum: sum, offered: offered };
}
// 상태 표(⑦)가 파일 장부(caseProcLedger_)를 만들 때 부른다 — 파일마다 읽음/일부/못읽음/제외·종류·이유·쓰인 곳
function ledgerKbFilesSave_(caseId, rows) {
  if (!caseId || !Array.isArray(rows)) return null;
  const files = rows.slice(0, 600).map(function (r) { return { n: String(r.n || ''), dir: String(r.dir || ''), st: String(r.st || ''), kind: String(r.kind || '').slice(0, 80), why: String(r.why || '').slice(0, 160), use: String(r.use || '').slice(0, 160) }; });
  const sig = function (list) { return JSON.stringify(list.map(function (f) { return f.n + '|' + f.st + '|' + f.use; })); };
  // 바뀐 것이 없으면 쓰지 않는다(상태 표를 열 때마다 장부 파일을 다시 쓰지 않게)
  const kb0 = ledgerKbLoad_(caseId) || {};
  if (sig(kb0.files || []) === sig(files) && kb0.filesAt) return { ok: true, changed: false };
  const w = ledgerMutate_(caseId, function (L) {
    const kb = L.kb = L.kb || {};
    const changed = sig(kb.files || []) !== sig(files);
    kb.files = files; kb.filesAt = caseProcNow_();
    if (kb.facts) kb.sum = ledgerKbSum_(kb);
    if (changed) ledgerLogTo_(L, { by: 'GAS', what: '폴더 파일 다시 봄', detail: '파일 ' + files.length + '개 — ' + ['읽음', '일부', '못읽음', '제외'].map(function (s) { const n = files.filter(function (f) { return f.st === s; }).length; return n ? s + ' ' + n : ''; }).filter(Boolean).join(' · ') });
    return { ok: true, changed: changed };
  });
  if (!w || !w.ok) return { ok: false, error: (w && w.error) || '파일 장부를 쓰지 못함' };
  return w;
}
// 교차검증이 칸 하나를 서류 값과 맞댈 때마다 부른다(CrossCheckBind·CrossCheckGraph) — 그 칸이 서류와 어떻게 이어졌는지 한 줄
//  o: {by, path, label, cur, vals:[{v, n(서류 종류 수), src}], d, rule, why, filled, asking, norm(값 → 비교용)}
//  res: 서류와 일치(서류 2종 이상) · 서류 1종과 같음 · 빈 칸을 서류로 채움 · 빈 칸(서류끼리 갈림 — 질문) · 빈 칸(서류 1종뿐 — 질문에 맡김) · 서류와 다름(질문) · 서류에 이 칸 값 없음
function ledgerKbLink_(rec, o) {
  if (!rec || !o) return;
  const norm = o.norm || function (x) { return String(x == null ? '' : x).replace(/[\s,원]/g, ''); };
  const cur = o.cur === '' || o.cur == null ? '' : norm(o.cur);
  const vals = (o.vals || []).filter(function (x) { return x && x.v !== '' && x.v != null; });
  const same = cur ? vals.filter(function (x) { return norm(x.v) === cur; })[0] : null;
  let res;
  if (!vals.length) res = '서류에 이 칸 값 없음';
  else if (o.filled) res = '빈 칸을 서류로 채움';
  else if (same) res = (same.n || 0) >= 2 ? '서류와 일치(서류 2종 이상)' : (vals.length > 1 ? '서류 1종과 같음(다른 서류 값도 있음)' : '서류 1종과 같음');
  else if (!cur) res = vals.length > 1 ? '빈 칸(서류끼리 갈림 — 질문)' : '빈 칸(서류 1종뿐 — 질문에 맡김)';
  else res = '서류와 다름(질문)';
  rec.links = rec.links || [];
  if (rec.links.length >= 600) return;
  rec.links.push({ by: String(o.by || ''), path: String(o.path || ''), label: String(o.label || o.path || ''), cur: o.cur == null ? '' : String(o.cur).slice(0, 80), res: res,
    d: o.d == null ? '' : String(o.d).slice(0, 80), rule: String(o.rule || ''), why: String(o.why || '').slice(0, 200),
    vals: vals.slice(0, 6).map(function (x) { return { v: String(x.v).slice(0, 80), n: x.n || 0, src: String(x.src || '').slice(0, 200) }; }) });
}
// 📒 화면 「🔄 서류 사실 다시 모으기」 — 칸 값은 건드리지 않고 폴더 파일 장부·서류 사실·서류끼리 맞대기만 지금 서류로 다시(칸으로 간 길은 다음 처리개요 때 갱신)
//  [2026.10.29] 사건 폴더 감시(cpWatchCase_)가 새 파일·바뀐 파일·없어진 파일을 알아채면 그 자리에서도 부른다(opt.what = 무엇 때문에 — 장부 기록에 남음)
function ledgerKbBuild_(c, opt) {
  opt = opt || {};
  const t0 = Date.now(), out = { ok: true };
  try { const fl = typeof caseProcLedger_ === 'function' ? caseProcLedger_(c) : null; if (fl && Array.isArray(fl.rows)) out.files = ledgerKbFilesSave_(c.id, fl.rows); } catch (e) { out.filesError = String(e && e.message || e); }
  let facts = [];
  try { if (typeof CX_FACTS_MEMO_ !== 'undefined' && opt.fresh) CX_FACTS_MEMO_ = null; } catch (e) {} // 폴더가 바뀌었으면 2분 메모를 쓰지 않는다
  try { facts = typeof cxFacts_ === 'function' ? cxFacts_(c) : []; } catch (e) { out.factsError = String(e && e.message || e); }
  const old = ledgerKbLoad_(c.id) || {};
  const r = ledgerKbSave_(c, facts, { links: old.links || [], what: opt.what, why: opt.why });
  out.sum = r && r.sum; out.초 = Math.round((Date.now() - t0) / 100) / 10;
  out.message = '서류 사실 ' + ((r && r.sum && r.sum.사실) || 0) + '건을 다시 모았습니다(' + out.초 + '초)';
  return out;
}
// 화면에 줄 모양 — 파일마다 그 파일에서 모은 사실 수를 붙인다
function ledgerKbView_(caseId, c) {
  const kb = ledgerKbLoad_(caseId); if (!kb || (!kb.facts && !kb.files)) return null;
  try { kb.links = ledgerKbLiveLinks_(caseId, kb, c); const s0 = kb.sum || ledgerKbSum_(kb); Object.keys(s0).forEach(function (k) { if (/^칸:/.test(k)) delete s0[k]; }); s0.칸 = kb.links.length; kb.links.forEach(function (l) { s0['칸:' + l.res] = (s0['칸:' + l.res] || 0) + 1; }); kb.sum = s0; } catch (e) {}
  const byFile = {}; (kb.facts || []).forEach(function (f) { byFile[f.f] = (byFile[f.f] || 0) + 1; });
  const files = (kb.files || []).map(function (f) { return Object.assign({}, f, { facts: byFile[f.n] || 0 }); });
  // 파일 장부에 없는 이름(묶음 안 구간·엑셀 통장 등)도 사실이 있으면 보이게
  Object.keys(byFile).forEach(function (n) { if (!files.some(function (f) { return f.n === n; })) files.push({ n: n, dir: '', st: '읽음', kind: '', why: '', use: '', facts: byFile[n] }); });
  return { at: kb.at || '', filesAt: kb.filesAt || '', sum: kb.sum || ledgerKbSum_(kb), prev: kb.prev || null, prevAt: kb.prevAt || '', files: files, facts: kb.facts || [], groups: kb.groups || [], links: kb.links || [], factsAll: kb.factsAll || 0 };
}

// ============================================================
// [2026.10.29 계획서 1단계] 사건 흐름 층 — 가설 · 사건개요 · 확보할 증빙 · 처리방향
// ------------------------------------------------------------
// 세무사님 원문(10-29): "사건접수후 의뢰서 등의 정보로 부터 사건개요를 파악하여 처리방향과 확보대상 증빙을 확보해 나가게 되고, 증빙을 확보해 나가면서
//   사건장부에 정보를 모으는 과정이 일방통행이 아니라 수시로 피드백이 되면서 이루어져야 하는데" / "칸장부와 바탕장부가 분리되어 있으면 … 중복관리의 문제만"
// 계획서: 총괄관리자\사건장부_구조_계획서_20261029.md (세무사님 10-29 "권장안대로 시작")
//   L.hyp  { at, claims:[{f, v, srcs:[출처], by}] } — 의뢰서·메모·대화·작업관리·폴더 이름이 말한 것. 서류가 아니라 가설(공통원칙 4 "증빙 후보로는 쓰지 마라")
//   L.ov   { 'ov.<칸>': 줄 } 사건개요 — 세목·업무유형·납세자·처리개요 칸. 증여 칸·사건분류·기준일은 칸 장부 줄(rows)이 주인이라 여기 두지 않는다(같은 값 두 곳 금지)
//          상태 '가설'(의뢰서 등에서 — 서류 확인 전)이 더해진다. 가설은 세액계산에 들어가지 않는다(칸 장부만 계산기로 감)
//   L.ev   { 'ev.<slotKey>': 줄 } 확보할 증빙 — v: {label, note, source, id, slotKey, 요청일, 확보일}, state: 증빙받을것(미확보)·확정(확보)·보류·무시, why: 왜 필요한지
//   L.dir  { 'dir.처리방향': 세무사님 글, 'dir.갈래': GAS가 정한 갈래(따로 표시 — 세무사님 글은 GAS가 고치지 않음) }
// 줄 모양·값 주인 우열은 칸 장부와 같다(사건개요·처리방향은 ledgerSetInner_를 그 층에 그대로 씀). 작업관리 시트의 사건개요·증빙목록·처리방향·세목·업무유형·납세자 칸은
//   이 층의 거울 — 시트에 쓰는 입구(work_updateCase) 하나에서 장부에도 적는다(ledgerFromCaseWrite_). 누가 썼는지는 바깥 입구 두 곳(세무사님 화면·넥스 카드)만 정하고 나머지는 GAS
// ============================================================
var LEDGER_FLOW_LAYERS_ = { ov: '사건개요', ev: '확보할 증빙', dir: '처리방향' };
var LEDGER_OV_SHEET_KEYS_ = ['세목', '업무유형', '납세자']; // 작업관리 사건 줄의 칸(사건개요 JSON 밖) — 사건개요 층에 함께
// 층에 줄 쓰기 — 칸 장부와 같은 함수(우열·이력·기록)를 층 묶음에 적용한다
function ledgerLayerSetInner_(L, layer, input) {
  const pre = ledgerSetPrep_(input);
  if (pre.error) return { ok: false, error: pre.error };
  const P = { rows: (L[layer] = L[layer] || {}), log: L.log };
  const r = ledgerSetInner_(P, pre);
  L.log = P.log;
  return r;
}
function ledgerFlowKind_(by) { return by === '세무사님' ? '세무사님' : by === '넥스' ? '넥스' : '규칙'; }
function ledgerOvOwned_(k) { return (typeof LEDGER_FILLED_KEYS_ !== 'undefined' ? LEDGER_FILLED_KEYS_ : []).indexOf(k) !== -1; }
function ledgerOvLabel_(k) {
  if (LEDGER_OV_SHEET_KEYS_.indexOf(k) !== -1) return k;
  if (LEDGER_GKO_[k]) return LEDGER_GKO_[k];
  let l = ''; try { l = (typeof CXG_OV_KO_ !== 'undefined' && CXG_OV_KO_[k]) || (typeof CASEPROC_FIELD_KO_ !== 'undefined' && CASEPROC_FIELD_KO_[k]) || ''; } catch (e) { l = ''; }
  return String(l || (/^[가-힣]/.test(k) ? k : '사건개요 ' + k)).slice(0, 40);
}
function ledgerSame_(a, b) { return JSON.stringify(a == null ? '' : a) === JSON.stringify(b == null ? '' : b); }
// 증빙 한 항목 — 주인은 그 항목을 만든 이(틀·사건처리가 만든 항목 = 규칙, 화면에서 더한 항목 = 세무사님), 확보 여부는 누구든(서류가 들어온 사실이라) 바꾼다
function ledgerEvKey_(it) { return 'ev.' + String((it && (it.slotKey || it.id || it.label)) || '').slice(0, 120); }
function ledgerEvVal_(it) { return { label: String(it.label || '').slice(0, 160), note: String(it.note || '').slice(0, 200), source: String(it.source || ''), id: String(it.id || ''), slotKey: it.slotKey == null ? '' : String(it.slotKey), 요청일: String(it.요청일 || ''), 확보일: String(it.확보일 || ''), 분류: it.fromClassification == null ? '' : String(it.fromClassification) }; }
function ledgerEvOwner_(it, by) { return it && Object.prototype.hasOwnProperty.call(it, 'fromClassification') ? '규칙' : ledgerFlowKind_(by === '규칙' || by === 'GAS' ? '세무사님' : by); }
function ledgerEvPutInner_(L, it, by, why) {
  const k = ledgerEvKey_(it); if (k === 'ev.') return false;
  L.ev = L.ev || {};
  const prev = L.ev[k] || null, v = ledgerEvVal_(it), state = it.status === '확보됨' ? '확정' : (prev && /^(보류|무시)$/.test(prev.state) ? prev.state : '증빙받을것');
  if (prev && ledgerSame_(prev.v, v) && prev.state === state) return false;
  const kind = prev && prev.src ? prev.src.kind : ledgerEvOwner_(it, by);
  const row = Object.assign({}, prev || {}, { v: v, label: String(v.label || k).slice(0, 40), src: Object.assign({}, (prev && prev.src) || { kind: kind, file: '', page: '', quote: '' }, { who: String(by || 'GAS').slice(0, 6), why: String(why || (prev && prev.src && prev.src.why) || v.note || '').slice(0, 160) }), sure: '확실', state: state, at: caseProcNow_() });
  row.hist = (prev && Array.isArray(prev.hist) ? prev.hist : []).concat([{ at: row.at, by: by || 'GAS', kind: kind, prev: prev ? { v: prev.v, state: prev.state } : null, next: { v: v, state: state }, why: row.src.why }]).slice(-20);
  L.ev[k] = row;
  ledgerLogTo_(L, { by: by || 'GAS', what: !prev ? '확보할 증빙 더함' : prev.state !== state ? (state === '확정' ? '증빙 확보' : '증빙 ' + state) : '확보할 증빙 고침', path: k, detail: v.label + (state === '확정' ? ' — 확보' + (v.확보일 ? '(' + v.확보일 + ')' : '') : '') + (row.src.why ? ' · ' + row.src.why.slice(0, 80) : '') });
  return true;
}
// 시트에 쓰는 입구(work_updateCase)가 저장한 뒤 부른다 — 시트에 쓴 사건개요·증빙목록·처리방향·세목·업무유형·납세자를 장부 층에 그 사람 값으로.
//  c: 저장 뒤 사건 줄(템플릿이 증빙목록을 더했을 수 있어 저장 뒤 것), by: 세무사님·넥스·GAS(·장부 — 장부가 시트를 비춰 쓴 것이라 되돌려 적지 않음)
function ledgerFromCaseWrite_(c, params, by) {
  if (!c || !c.id || !params || by === '장부') return null;
  const touchOv = params.사건개요 !== undefined, touchEv = params.증빙목록 !== undefined || touchOv || params.세목 !== undefined || params.업무유형 !== undefined;
  const touchSheet = LEDGER_OV_SHEET_KEYS_.some(function (k) { return params[k] !== undefined; }), touchDir = params.처리방향 !== undefined;
  if (!touchOv && !touchEv && !touchSheet && !touchDir) return null;
  const kind = ledgerFlowKind_(by), who = by === '세무사님' || by === '넥스' ? by : 'GAS';
  let ovIn = touchOv ? params.사건개요 : null; if (typeof ovIn === 'string') { try { ovIn = JSON.parse(ovIn); } catch (e) { ovIn = null; } }
  const explicitEv = {}; (Array.isArray(params.증빙목록) ? params.증빙목록 : []).forEach(function (it) { explicitEv[ledgerEvKey_(it)] = 1; });
  return ledgerMutate_(c.id, function (L) {
    const skip = {}; if (who === 'GAS') { if (ovIn && typeof ovIn === 'object') Object.keys(ovIn).forEach(function (k) { skip[k] = 1; }); LEDGER_OV_SHEET_KEYS_.forEach(function (k) { if (params[k] !== undefined) skip[k] = 1; }); }
    ledgerFlowAdoptInner_(L, c, skip); // 처음이면 옮겨 오기 — 이번에 GAS가 쓴 칸은 아래에서 GAS 값으로
    const out = { ov: 0, ev: 0, dir: 0, refused: 0 };
    const setOv = function (k, v) {
      const p = 'ov.' + k, cur = (L.ov || {})[p];
      if (v === undefined || (cur && ledgerSame_(cur.v, v) && cur.state !== '가설')) return;
      if (v === null || v === '' || (Array.isArray(v) && !v.length)) return; // 비운 칸은 그대로(값을 지어내지 않음 — 비운 사실은 시트에 남음)
      const r = ledgerLayerSetInner_(L, 'ov', { path: p, value: v, kind: kind, by: who, label: ledgerOvLabel_(k), quote: who === 'GAS' ? '' : (who === '넥스' ? '🤖 넥스 고침(작업관리)' : '세무사님 입력(작업관리)') });
      if (r && r.ok && !r.same) out.ov++; else if (r && r.refused && !r.quiet) out.refused++;
    };
    if (ovIn && typeof ovIn === 'object') Object.keys(ovIn).forEach(function (k) { if (!ledgerOvOwned_(k)) setOv(k, ovIn[k]); });
    LEDGER_OV_SHEET_KEYS_.forEach(function (k) { if (params[k] !== undefined) setOv(k, String(params[k]).trim()); });
    if (touchDir) { const t = String(params.처리방향 || '').trim(), cur = (L.dir || {})['dir.처리방향']; if (t && !(cur && cur.v === t)) { const r = ledgerLayerSetInner_(L, 'dir', { path: 'dir.처리방향', value: t, kind: kind, by: who, label: '처리방향' }); if (r && r.ok && !r.same) out.dir++; } }
    if (touchEv && Array.isArray(c.증빙목록)) {
      const seen = {};
      c.증빙목록.forEach(function (it) { if (!it) return; const k = ledgerEvKey_(it); seen[k] = 1; if (ledgerEvPutInner_(L, it, explicitEv[k] ? who : 'GAS', '')) out.ev++; });
      // 시트 목록에서 빠진 항목 — 그 항목을 만든 이와 같은 급 이상이 뺐을 때만 장부에서도 뺀다(확보된 항목은 남김)
      Object.keys(L.ev || {}).forEach(function (k) {
        if (seen[k]) return; const r = L.ev[k], ok = (LEDGER_RANK_[kind] || 0) >= (LEDGER_RANK_[r.src && r.src.kind] || 0);
        if (!ok || r.state === '확정') return;
        delete L.ev[k]; out.ev++; ledgerLogTo_(L, { by: who, what: '확보할 증빙 뺌', path: k, detail: (r.v && r.v.label || k) + ' — 작업관리 증빙목록에서 빠짐' });
      });
    }
    return out;
  });
}
// 처음 한 번 — 사건 줄(시트)·사건처리 기록 파일에 있던 사건개요·증빙목록·처리방향·가설을 장부 층으로 옮긴다(누가 넣었는지 기록이 없으면 세무사님 값으로 — 값을 지키는 쪽)
function ledgerFlowAdoptInner_(L, c, skip) {
  skip = skip || {};
  if (!L || L.flowFrom || !c) return false;
  let sv = {}; try { sv = (typeof caseProcLoad_ === 'function' ? caseProcLoad_(c.id) : {}) || {}; } catch (e) { sv = {}; }
  const filled = sv.filled || {}, ov = c.사건개요 || {};
  L.ov = L.ov || {}; L.ev = L.ev || {}; L.dir = L.dir || {};
  const put = function (k, v, kind, quote) {
    if (skip[k] || v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || L.ov['ov.' + k]) return;
    ledgerLayerSetInner_(L, 'ov', { path: 'ov.' + k, value: v, kind: kind, by: kind === '세무사님' || kind === '넥스' ? kind : 'GAS', label: ledgerOvLabel_(k), quote: quote });
  };
  Object.keys(ov).forEach(function (k) {
    if (ledgerOvOwned_(k)) return;
    const f = filled[k], kd = f && f.src ? (typeof ledgerGiftKind_ === 'function' ? ledgerGiftKind_(f.src) : '서류') : '세무사님';
    put(k, ov[k], kd === '서류' ? '서류' : kd, f && f.src ? String(f.src).slice(0, 120) : '옮겨 옴(작업관리 사건개요 — 넣은 이 기록 없음)');
  });
  LEDGER_OV_SHEET_KEYS_.forEach(function (k) { put(k, String(c[k] || '').trim(), '세무사님', '옮겨 옴(작업관리)'); });
  if (String(c.처리방향 || '').trim() && !L.dir['dir.처리방향']) ledgerLayerSetInner_(L, 'dir', { path: 'dir.처리방향', value: String(c.처리방향).trim(), kind: '세무사님', by: '세무사님', label: '처리방향', quote: '옮겨 옴(작업관리)' });
  (Array.isArray(c.증빙목록) ? c.증빙목록 : []).forEach(function (it) { if (it) ledgerEvPutInner_(L, it, ledgerEvOwner_(it, '세무사님') === '규칙' ? 'GAS' : '세무사님', '옮겨 옴(작업관리 증빙목록)'); });
  if (!L.hyp && sv.grasp && sv.grasp.hyp) L.hyp = { at: sv.grasp.at || '', claims: ledgerHypClaims_(sv.grasp.hyp, 'GAS') };
  L.flowFrom = '작업관리·사건처리 기록에서 옮김 ' + caseProcNow_();
  ledgerLogTo_(L, { by: 'GAS', what: '사건 흐름 층 옮김', detail: '사건개요 ' + Object.keys(L.ov).length + '칸 · 확보할 증빙 ' + Object.keys(L.ev).length + '건 · 처리방향 ' + (L.dir['dir.처리방향'] ? '있음' : '없음') + ' · 가설 ' + ((L.hyp && L.hyp.claims) || []).length + '건' });
  return true;
}
function ledgerHypClaims_(hyp, by) {
  const out = [];
  Object.keys(hyp || {}).forEach(function (f) { (hyp[f] || []).forEach(function (e) { if (e && e.v) out.push({ f: f, v: String(e.v).slice(0, 120), srcs: (e.srcs || []).slice(0, 6), by: e.by || by || 'GAS' }); }); });
  return out.slice(0, 200);
}
// 가설 다시 세우기(사건파악 caseProcGrasp_가 부른다) — 넥스가 보탠 가설(by 넥스)은 GAS가 지우지 않는다
function ledgerHypPut_(caseId, hyp, c) {
  return ledgerMutate_(caseId, function (L) {
    if (c) ledgerFlowAdoptInner_(L, c);
    const old = (L.hyp && L.hyp.claims) || [], keepNex = old.filter(function (x) { return x.by === '넥스'; });
    const claims = ledgerHypClaims_(hyp, 'GAS').concat(keepNex.filter(function (x) { return !ledgerHypClaims_(hyp).some(function (y) { return y.f === x.f && y.v === x.v; }); }));
    const sig = function (l) { return JSON.stringify(l.map(function (x) { return x.f + '=' + x.v + '[' + x.srcs.join('·') + ']'; }).sort()); };
    const changed = sig(old) !== sig(claims);
    L.hyp = { at: changed ? caseProcNow_() : ((L.hyp && L.hyp.at) || caseProcNow_()), claims: claims };
    if (changed) ledgerLogTo_(L, { by: 'GAS', what: '가설 다시 세움', detail: claims.length + '건 — ' + claims.slice(0, 6).map(function (x) { return x.f + ' ' + x.v; }).join(' · ').slice(0, 200) });
    return { ok: true, changed: changed, n: claims.length };
  });
}
// 넥스가 보태는 가설 한 건(넥스 판단 표시) — 서류 값이 아니라 사건개요의 출발점. 보탠 뒤 한 바퀴를 줄에 넣는다
function ledgerHypAdd_(c, input, who) {
  const f = String(input.field || '').trim(), v = String(input.value == null ? '' : input.value).trim().slice(0, 120);
  if (!LEDGER_HYP_OV_[f] || /^(세목|업무유형|납세자)$/.test(f)) return { ok: false, error: 'field는 상대방·관계·물건·거래·쟁점·요청 중 하나' };
  if (!v) return { ok: false, error: 'value가 비어 있습니다' };
  const r = ledgerMutate_(c.id, function (L) {
    ledgerFlowAdoptInner_(L, c);
    L.hyp = L.hyp || { at: '', claims: [] };
    if (L.hyp.claims.some(function (x) { return x.f === f && x.v === v; })) return { ok: true, same: true, message: '이미 있는 가설' };
    L.hyp.claims.push({ f: f, v: v, srcs: [String(input.file || '넥스가 읽은 글').slice(0, 80)], by: '넥스' }); L.hyp.at = caseProcNow_();
    ledgerOvFromHypInner_(L);
    ledgerLogTo_(L, { by: String(who || '넥스').slice(0, 6), what: '가설 보탬(넥스 판단)', path: LEDGER_HYP_OV_[f], detail: f + ' ' + v + (input.file ? ' — ' + input.file : '') + (input.why ? ' · ' + String(input.why).slice(0, 80) : '') });
    return { ok: true, message: '가설 「' + f + ' ' + v + '」을 보탰습니다(넥스 판단 — 서류 확인 전)' };
  });
  if (r && r.ok && !r.same && typeof cpFlowQueueAdd_ === 'function') cpFlowQueueAdd_(c.id, '넥스 가설 보탬 — ' + f);
  return r;
}
// 가설을 필드별 묶음으로(사건파악 확인 caseProcGraspCheck_가 읽는 모양) — 장부가 없으면 예전 기록 파일
function ledgerHypMap_(caseId) {
  const L = ledgerLoad_(caseId), out = {};
  let claims = (L.hyp && L.hyp.claims) || null;
  if (!claims) { try { const g = ((caseProcLoad_(caseId) || {}).grasp || {}).hyp; if (g) return g; } catch (e) {} claims = []; }
  claims.forEach(function (x) { (out[x.f] = out[x.f] || []).push({ v: x.v, srcs: (x.srcs || []).slice(), by: x.by }); });
  return out;
}
// ============================================================
// [2026.10.29 계획서 2단계] 한 바퀴 — 무엇이 바뀌든 같은 바퀴(되먹임 고리)
//  "이 사건 처리하자"(caseProcAll_ ①사건파악·②서류 읽기·③칸 채우기·질문)가 끝날 때마다 이어서 돈다 — 화면 ⚡·넥스·직결 서비스·폴더 감시가 모두 같은 바퀴:
//   ⓐ 가설 → 사건개요 층: 서류·세무사님 값으로 정해지지 않은 사건개요 칸은 의뢰서 등의 가설로 채워 '가설' 상태로(계산에는 안 들어감),
//      정해진 칸과 가설이 다르면 그 사실을 줄에 남긴다(서류가 이김 — 세무사님 결정 10-29 권장안 3)
//   ⓑ 확보할 증빙 다시: 지금 빈 칸이 요구하는 서류 종류 + 가설 쟁점(사건분류 후보)이 요구하는 서류 → 없는 것만 더하고, 근거가 사라진 GAS 항목(미확보)은 뺀다
//   ⓒ 무엇이 바뀌었는지 기록 한 줄(장부·작업 기록부) — 바뀐 것이 사건개요의 정해진 칸(세목·사건분류·기준일)이면 ③을 한 번 더(caseProcAll_)
// ============================================================
var LEDGER_HYP_OV_ = { 세목: 'ov.세목', 업무유형: 'ov.업무유형', 납세자: 'ov.납세자', 상대방: 'ov.상대방', 관계: 'ov.관계', 물건: 'ov.물건', 거래: 'ov.거래', 쟁점: 'ov.쟁점', 요청: 'ov.요청사항' };
function ledgerFlowSnap_(L) {
  const s = { ov: {}, ev: {}, hyp: ((L.hyp && L.hyp.claims) || []).length, facts: ((L.kb && L.kb.facts) || []).length, q: 0, off: ((L.chain && L.chain.off) || []).length, pub: Object.keys(L.pub || {}).length };
  s.ovL = {}; Object.keys(L.ov || {}).forEach(function (p) { const r = L.ov[p]; s.ov[p] = r.state + ':' + JSON.stringify(r.v).slice(0, 60); s.ovL[p] = r.label && !/^[a-zA-Z]/.test(r.label) ? r.label : ledgerLabel_(p); });
  Object.keys(L.ev || {}).forEach(function (p) { s.ev[p] = L.ev[p].state; });
  s.calc = {}; // 계산기 칸 값(정함·추정) — 서류가 들어와 칸이 채워지거나 바뀐 것도 바퀴 기록에
  Object.keys(L.rows || {}).forEach(function (p) { const r = L.rows[p]; if (/^(물어볼것|증빙받을것)$/.test(r.state)) s.q++; if (!/^(q:|doc:|chk:)/.test(p) && /^(확정|추정)$/.test(r.state) && r.v !== '' && r.v != null) s.calc[p] = JSON.stringify(r.v).slice(0, 60); });
  return s;
}
function ledgerFlowDiff_(a, b) {
  const out = [];
  const ovKeys = {}; Object.keys(a.ov).concat(Object.keys(b.ov)).forEach(function (k) { ovKeys[k] = 1; });
  const ovCh = Object.keys(ovKeys).filter(function (k) { return a.ov[k] !== b.ov[k]; });
  if (ovCh.length) out.push('사건개요 ' + ovCh.map(function (k) { const lb = (b.ovL && b.ovL[k]) || (a.ovL && a.ovL[k]) || ledgerLabel_(k); return lb + (b.ov[k] ? '(' + b.ov[k].split(':')[0] + ')' : '(빠짐)'); }).slice(0, 6).join('·'));
  const evAdd = Object.keys(b.ev).filter(function (k) { return !a.ev[k]; }).length, evDel = Object.keys(a.ev).filter(function (k) { return !b.ev[k]; }).length;
  const evGot = Object.keys(b.ev).filter(function (k) { return a.ev[k] && a.ev[k] !== '확정' && b.ev[k] === '확정'; }).length;
  if (evAdd || evDel || evGot) out.push('확보할 증빙 ' + [evAdd ? '+' + evAdd : '', evDel ? '−' + evDel : '', evGot ? '확보 ' + evGot : ''].filter(Boolean).join(' '));
  if (a.hyp !== b.hyp) out.push('가설 ' + a.hyp + '→' + b.hyp);
  if (a.facts !== b.facts) out.push('서류 사실 ' + a.facts + '→' + b.facts);
  if (a.calc && b.calc) { const add = Object.keys(b.calc).filter(function (k) { return !(k in a.calc); }), chg = Object.keys(b.calc).filter(function (k) { return (k in a.calc) && a.calc[k] !== b.calc[k]; }), gone = Object.keys(a.calc).filter(function (k) { return !(k in b.calc); }); if (add.length || chg.length || gone.length) out.push('칸 ' + [add.length ? '채움 ' + add.slice(0, 4).map(ledgerLabel_).join('·') + (add.length > 4 ? ' 외 ' + (add.length - 4) : '') : '', chg.length ? '바뀜 ' + chg.slice(0, 4).map(ledgerLabel_).join('·') : '', gone.length ? '비움 ' + gone.slice(0, 3).map(ledgerLabel_).join('·') : ''].filter(Boolean).join(' · ')); }
  if (a.q !== b.q) out.push('질문 ' + a.q + '→' + b.q);
  if ((a.off || 0) !== (b.off || 0)) out.push('사슬 밖 계약서 ' + (a.off || 0) + '→' + (b.off || 0));
  if ((a.pub || 0) !== (b.pub || 0)) out.push('공부 조회 필지 ' + (a.pub || 0) + '→' + (b.pub || 0)); // [2026.10.29 계획서 3판]
  return out;
}
function ledgerNormCmp_(v) { return String(v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v)).replace(/[\s()·,]/g, ''); }
// ⓐ 가설 → 사건개요 층
function ledgerOvFromHypInner_(L) {
  // 시스템 안의 값(작업관리·처리개요·사건명·폴더 이름)만이 출처인 주장은 사건개요 가설로 세우지 않는다 — 이미 정해진 값을 "가설"로 되비추는 것이라(의뢰서·메모·대화가 말한 것만)
  const SYS = /^(작업관리|처리개요|사건명|폴더 이름)/;
  const claims = ((L.hyp && L.hyp.claims) || []).filter(function (x) { return x.by === '넥스' || (x.srcs || []).some(function (s) { return !SYS.test(String(s)); }); });
  L.ov = L.ov || {};
  const by = {}; claims.forEach(function (x) { (by[x.f] = by[x.f] || []).push(x); });
  let n = 0;
  Object.keys(LEDGER_HYP_OV_).forEach(function (f) {
    const p = LEDGER_HYP_OV_[f], cl = by[f] || [], row = L.ov[p];
    const vals = cl.map(function (x) { return x.v; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    const srcTxt = cl.map(function (x) { return x.srcs.join('·') + (x.by === '넥스' ? '(넥스 판단)' : ''); }).filter(Boolean).join(' / ').slice(0, 160);
    if (row && row.state !== '가설') { // 서류·세무사님으로 정해진 칸 — 가설과 다르면 그 사실만 남긴다(값은 바꾸지 않음)
      const differ = vals.length && !vals.some(function (v) { return ledgerNormCmp_(v) === ledgerNormCmp_(row.v) || ledgerNormCmp_(row.v).indexOf(ledgerNormCmp_(v)) !== -1; });
      const note = differ ? '가설과 다름 — ' + vals.join(' / ').slice(0, 80) + ' [' + srcTxt + ']' : '';
      if ((row.hypNote || '') !== note) { row.hypNote = note; n++; if (note) ledgerLogTo_(L, { by: 'GAS', what: '가설과 다름', path: p, detail: (row.label || p) + ' ' + ledgerValueText_(p, row.v) + '(' + (row.src && row.src.kind || '') + ') ↔ ' + note }); }
      return;
    }
    if (!vals.length) { if (row) { delete L.ov[p]; n++; } return; }
    const v = vals.length === 1 ? vals[0] : vals;
    if (row && ledgerSame_(row.v, v) && row.src && row.src.file === srcTxt) return;
    L.ov[p] = { v: v, label: f === '요청' ? '요청 사항' : f, src: { kind: '가설', who: 'GAS', file: srcTxt, page: '', quote: '', why: '의뢰서·메모·대화가 말한 것 — 서류 확인 전' }, sure: '모름', state: '가설', at: caseProcNow_(), hist: ((row && row.hist) || []).concat([{ at: caseProcNow_(), by: 'GAS', kind: '가설', prev: row ? { v: row.v, state: row.state } : null, next: { v: v, state: '가설' }, why: srcTxt }]).slice(-20) };
    n++;
  });
  return n;
}
// 의뢰서 등이 말한 거래(날짜·금액)를 계산기 칸의 서류 값과 맞댄다 — 다르면 서류 값으로 계산하되(세무사님 결정 10-29 권장안 3 "서류가 이기되, 다르다는 사실을 질문으로")
//  'chk:가설.<칸>' 줄을 보류로 세운다: 사이드바 질문 목록에 보이고(계산은 막지 않음), 검토서 "추가로 확인할 사항"에 들어간다. 같아지거나 가설이 사라지면 GAS가 세운 줄은 내린다
var LEDGER_HYP_CALC_ = [[/^(양도|매도|매각|잔금)/, 'c0.totalPrice', 'c0.date'], [/^(취득|매수)/, 'a0.acquisitionPrice', 'a0.acquisitionDate'], [/^증여/, 'g.giftAmount', '기준일'], [/^(사망|상속개시)/, '', '기준일'], [/^(대출|채무)/, 'i.debtAmount', '']];
function ledgerKrw_(s) {
  s = String(s || '').replace(/\s+/g, '');
  const m = /^([\d,]+)원$/.exec(s); if (m) return Number(m[1].replace(/,/g, ''));
  let n = 0, hit = false; const eok = /([\d,]+)억/.exec(s), cm = /억?([\d,]+)천만/.exec(s), man = /(?:억|천)?([\d,]+)만/.exec(s);
  if (eok) { n += Number(eok[1].replace(/,/g, '')) * 100000000; hit = true; }
  if (cm) { n += Number(cm[1].replace(/,/g, '')) * 10000000; hit = true; } else if (man && !/천만/.test(s)) { n += Number(man[1].replace(/,/g, '')) * 10000; hit = true; }
  return hit ? n : NaN;
}
function ledgerHypVsCalcInner_(L) {
  const claims = ((L.hyp && L.hyp.claims) || []).filter(function (x) { return x.f === '거래'; });
  const want = {};
  claims.forEach(function (x) {
    const sp = String(x.v).split(' '), role = sp[0], val = sp.slice(1).join(' ');
    const map = LEDGER_HYP_CALC_.filter(function (m) { return m[0].test(role); })[0]; if (!map) return;
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(val), path = isDate ? map[2] : map[1]; if (!path) return;
    const r = L.rows[path]; if (!r || !/^(확정|추정)$/.test(r.state) || r.v === '' || r.v == null) return;
    const hv = isDate ? val : ledgerKrw_(val); if (!isDate && !Number.isFinite(hv)) return;
    const same = isDate ? String(r.v) === hv : Number(r.v) === hv;
    if (same) return;
    const shown = isDate ? hv : Number(hv).toLocaleString('ko-KR') + '원';
    (want[path] = want[path] || []).push(shown + '(' + x.srcs.join('·') + (x.by === '넥스' ? ', 넥스 판단' : '') + ')');
  });
  let n = 0;
  Object.keys(want).forEach(function (path) {
    const p = 'chk:가설.' + path, r = L.rows[path], prev = L.rows[p];
    const ask = '「' + (r.label || ledgerLabel_(path)) + '」 — ' + (r.state === '추정' ? '추정 값 ' : (r.src && /^(세무사님|넥스)$/.test(r.src.kind) ? r.src.kind + ' 값 ' : '서류 값 ')) + ledgerValueText_(path, r.v) + (r.src && r.src.file ? '(' + r.src.file + ')' : '') + ', 의뢰서 등에는 ' + want[path].join(' / ') + '. ' + (r.state === '추정' ? '추정 값' : '지금 값') + '으로 계산했습니다 — 사실관계가 다르면 그 칸을 고쳐 주세요';
    if (prev && (prev.ask === ask || (prev.src && /^(세무사님|넥스)$/.test(prev.src.kind)) || /^(확정|무시)$/.test(prev.state))) return;
    L.rows[p] = { v: '', label: '가설과 서류가 다름 — ' + (r.label || ledgerLabel_(path)), src: { kind: '질문', who: 'GAS', file: '', page: '', quote: '', why: '' }, sure: '모름', state: '보류', ask: ask.slice(0, 300),
      cands: [{ v: '서류 값이 맞음', src: '지금 계산에 쓴 값' }, { v: '의뢰서 값이 맞음 — 그 칸을 고침', src: '의뢰서 등' }], at: caseProcNow_(), hist: ((prev && prev.hist) || []).concat([{ at: caseProcNow_(), by: 'GAS', kind: '질문', prev: null, next: { state: '보류' }, why: ask.slice(0, 160) }]).slice(-10) };
    ledgerLogTo_(L, { by: 'GAS', what: '가설과 서류가 다름', path: p, detail: ask.slice(0, 220) }); n++;
  });
  Object.keys(L.rows).forEach(function (p) { const m = /^chk:가설\.(.+)$/.exec(p); if (!m || want[m[1]]) return; const r = L.rows[p]; if (r.state === '보류' && r.src && r.src.who === 'GAS' && !(r.qd && Object.keys(r.qd).length)) { delete L.rows[p]; n++; } });
  return n;
}
// ⓑ 확보할 증빙 — 빈 칸·가설 쟁점이 요구하는 서류(작업관리 증빙목록 = 쓰는 문 하나로 써서 장부 층에도 들어감)
function caseFlowEvidence_(c, L, lines) {
  const list = Array.isArray(c.증빙목록) ? c.증빙목록.map(function (x) { return Object.assign({}, x); }) : [];
  // 같은 서류가 이미 목록에 있는가 — 한 바퀴가 지난번에 더한 그 항목 자신(같은 자리 열쇠)은 빼고 본다(자기를 보고 "이미 있음"이라 빼 버리면 바퀴마다 뺐다 더했다 함)
  const has = function (label, selfKey) { return list.some(function (e) { return e && e.label === label && e.slotKey !== selfKey; }); };
  const fileKinds = ((L.kb && L.kb.files) || []).map(function (f) { return String(f.kind || '') + ' ' + String(f.n || ''); }).join('\n');
  const want = {}; // slotKey → {label, note}
  // 빈 칸 → 그 칸 값이 적히는 서식 종류(TRC_NEED_DOC_TYPES_ — 서식·기관 기재 방식). 폴더에 그 종류 서류가 이미 있으면 받을 것이 아니라 읽기 문제라 더하지 않는다
  // 서류를 아직 다 읽지 못했으면(못읽음·파일 장부 없음) 빈 칸 → 받을 서류는 더하지 않는다 — 폴더에 있는데 안 읽힌 서류를 또 받으라고 하지 않게
  const kbFiles = (L.kb && L.kb.files) || [], readDone = kbFiles.length && !kbFiles.some(function (f) { return f.st === '못읽음'; });
  let needs = [];
  if (readDone) try { needs = c.세목 === 'transfer' ? (((caseProcLoad_(c.id) || {}).needs || {}).list || []) : (typeof giNeeds_ === 'function' ? giNeeds_(c) : []); } catch (e) { needs = []; }
  needs.filter(function (n) { return n && !n.ok && !n.later && !n.prov; }).forEach(function (n) {
    const types = (typeof TRC_NEED_DOC_TYPES_ !== 'undefined' && TRC_NEED_DOC_TYPES_[String(n.p).split('.').pop()]) || [];
    const names = types.map(function (t) { return (typeof CASEPROC_SCAN_TYPE_NAME_ !== 'undefined' && CASEPROC_SCAN_TYPE_NAME_[t]) || ''; }).filter(Boolean);
    if (!names.length) return;
    if (names.some(function (nm) { return fileKinds.indexOf(nm.replace(/\s/g, '').slice(0, 4)) !== -1 || fileKinds.indexOf(nm) !== -1; })) return;
    if (list.some(function (e) { return e && e.status !== '확보됨' && e.slotKey !== 'flow:칸:' + n.p && names.some(function (nm) { return String(e.label || '').indexOf(nm.slice(0, 4)) !== -1; }); })) return; // 이미 받을 목록에 같은 종류(이 칸 때문에 더한 항목 자신은 빼고)
    want['flow:칸:' + n.p] = { label: names.join(' 또는 ') + ' — ' + String(n.l).replace(/\(.*$/, '').trim() + ' 근거', note: '사건처리 한 바퀴: 세액계산기 「' + n.l + '」 칸이 비어 있고 폴더에 그 값이 적히는 서류가 없음' };
  });
  // 가설 쟁점(사건분류 후보) → 그 분류에서 늘 필요한 서류(필요증빙 틀) — 사건분류가 정해지기 전에만
  const clsRow = (L.rows || {})['사건분류'], clsSettled = clsRow && /^(확정|추정)$/.test(clsRow.state) && clsRow.v;
  const issue = (L.ov || {})['ov.쟁점'];
  const tpl = typeof WORK_EVIDENCE_TEMPLATES_ !== 'undefined' ? WORK_EVIDENCE_TEMPLATES_[c.세목] : null;
  if (!clsSettled && issue && issue.state === '가설' && tpl && tpl.사건분류) {
    [].concat(issue.v).forEach(function (cls) {
      (tpl.사건분류[cls] || []).forEach(function (label) { const k = 'flow:쟁점:' + cls + ':' + label; if (!has(label, k)) want[k] = { label: label, note: '사건처리 한 바퀴: 의뢰서 등이 말한 쟁점 「' + cls + '」를 확인할 서류(가설 — 사건분류가 정해지면 다시 봄)' }; });
    });
  }
  let add = 0, del = 0;
  const today = caseProcToday_();
  Object.keys(want).forEach(function (k, i) {
    if (list.some(function (e) { return e && e.slotKey === k; }) || has(want[k].label, k)) return;
    list.push({ id: 'ev_' + Date.now() + '_f' + i, source: 'requested', label: want[k].label, slotKey: k, fromClassification: null, note: want[k].note, status: '미확보', 요청일: today }); add++;
  });
  const kept = list.filter(function (e) { const gone = e && /^flow:/.test(String(e.slotKey || '')) && e.status !== '확보됨' && !want[e.slotKey]; if (gone) del++; return !gone; });
  if (!add && !del) return { add: 0, del: 0 };
  const up = work_updateCase({ id: c.id, 증빙목록: kept, 기대수정일: c.수정일 });
  if (up && up.success !== false) { c.증빙목록 = kept; if (up.case && up.case.수정일) c.수정일 = up.case.수정일; if (lines) lines.push('✏ 확보할 증빙 다시 짬(한 바퀴): ' + (add ? '+' + add + ' ' : '') + (del ? '−' + del + '(근거가 사라진 항목)' : '')); return { add: add, del: del }; }
  return { add: 0, del: 0, error: (up && up.message) || '증빙목록을 쓰지 못함' };
}
// 한 바퀴의 ⓐⓑⓒ — caseProcAll_ 끝에서 부른다(c: 새로 읽은 사건 줄). 돌려주는 것: { changed, diff:[…], settledChanged }
function caseFlowRound_(c, why, lines) {
  if (!c || !c.id) return null;
  const L0 = ledgerLoad_(c.id, true), before = (L0.flow && L0.flow.snap) || ledgerFlowSnap_(L0); // 지난 바퀴 끝과 견준다(그 사이 서류 읽기·칸 채우기·답으로 바뀐 것까지)
  const mom0 = (L0.flow && L0.flow.mom) || ledgerMomentKeys_(L0); // [2026.10.29 넥스 4] 지난 바퀴 끝의 "중요한 순간" 열쇠
  const settled0 = [c.세목, c.업무유형, ((L0.rows || {})['사건분류'] || {}).v, c.기준일].join('|');
  ledgerMutate_(c.id, function (L) { ledgerFlowAdoptInner_(L, c); ledgerOvFromHypInner_(L); ledgerHypVsCalcInner_(L); });
  let ev = { add: 0, del: 0 };
  try { ev = caseFlowEvidence_(c, ledgerLoad_(c.id, true), lines); } catch (e) { if (lines) lines.push('⚠ 확보할 증빙을 다시 짜지 못함: ' + String(e && e.message || e).slice(0, 100)); }
  // [2026.10.29 계획서 3판 6단계 — GAS 규칙(상수)] 장부에 새 필지(장부 소재지·처리개요 물건·의뢰서 가설 물건)가 생겼는데 아직 공부 조회를 안 했으면 있는 조회 도구로 —
  //  세무사님 원문 "확인된 필지에 대해서 도구를 이용하여 확보할 수 있는 바깥정보는 당연히 확보해야". 서류가 없어도(의뢰 메모만) 돈다. 한 바퀴에 2필지까지, GAS 서버에서만(직결 서비스는 바깥 호출 못 함)
  try {
    if (typeof cpOutsideCan_ === 'function' && cpOutsideCan_() && !(typeof AK_IN_SANDBOX_ !== 'undefined' && AK_IN_SANDBOX_)) {
      const lk = ledgerLookup_(c, { onlyNew: true, max: 2, why: '한 바퀴 — 새 필지' }, 'GAS');
      if (lk && lk.ok && lk.n && lines) lines.push('🔎 새 필지 공부 조회(GAS 규칙): ' + lk.message);
    }
  } catch (e) { if (lines) lines.push('⚠ 새 필지 공부 조회를 하지 못함: ' + String(e && e.message || e).slice(0, 100)); }
  const L1 = ledgerLoad_(c.id, true), after = ledgerFlowSnap_(L1);
  const diff = ledgerFlowDiff_(before, after);
  let c2 = c; try { c2 = (typeof akReadCase_ === 'function' ? akReadCase_(c.id) : null) || c; } catch (e) { c2 = c; }
  const settledChanged = settled0 !== [c2.세목, c2.업무유형, ((L1.rows || {})['사건분류'] || {}).v, c2.기준일].join('|');
  const rec = { at: caseProcNow_(), why: String(why || '').slice(0, 80), diff: diff, ev: ev };
  let moment = [];
  ledgerMutate_(c.id, function (L) {
    const mom1 = ledgerMomentKeys_(L);
    moment = Object.keys(mom1).filter(function (k) { return !(k in mom0) && (L0.flow || !/^증빙:/.test(k)); }).map(function (k) { return mom1[k]; }); // 사건 첫 바퀴의 틀 증빙 목록은 "새로 받을 서류" 순간이 아니다
    L.flow = { at: rec.at, why: rec.why, diff: diff, snap: ledgerFlowSnap_(L), mom: mom1, rounds: ((L.flow && L.flow.rounds) || []).concat([rec]).slice(-20) };
    if (diff.length) ledgerLogTo_(L, { by: 'GAS', what: '한 바퀴', detail: (rec.why ? rec.why + ' → ' : '') + diff.join(' · ') });
    if (moment.length) ledgerLogTo_(L, { by: 'GAS', what: '중요한 순간', detail: moment.slice(0, 6).join(' · ') + ' → 넥스에게 알림' });
  });
  // [2026.10.29 넥스 4] 중요한 순간이면 넥스를 깨울 줄에 넣는다(깨우기는 1분 틱이 — 이 바퀴를 돌린 화면 단추를 붙잡지 않게. 밤이면 아침에)
  if (moment.length && typeof cpNexMomentAdd_ === 'function') { try { cpNexMomentAdd_(c.id, moment); } catch (e) {} }
  if (lines) lines.push('🔁 한 바퀴' + (rec.why ? '(' + rec.why + ')' : '') + ': ' + (diff.length ? diff.join(' · ') : '바뀐 것 없음') + (moment.length ? ' · 🤖 중요한 순간 ' + moment.length + '건 → 넥스에게 알림' : ''));
  return { changed: diff.length > 0, diff: diff, settledChanged: settledChanged, moment: moment };
}
// 층 묶음을 화면·넥스용 줄로
function ledgerFlowRows_(L, layer) { const m = (L && L[layer]) || {}; return Object.keys(m).map(function (p) { return ledgerRowOut_(p, m[p]); }); }

// ============================================================
// [2026.10.29 계획서 3판] 사건 장부를 "도구 하나하나"가 함께 쓰게 — 세무사님 원문(10-29):
//  "gas는 전체가 하나의 틀에 박힌 도구가 아니라 하나하나가 별도의 도구일 뿐이라고!"
//  / "확인된 필지에 대해서 도구를 이용하여 확보할 수 있는 바깥정보는 당연히 확보해야 하는 것이고"
//  / "세액계산 한번만 하면 모든 사건처리가 끝나는 종점이 아니라고" / (10-28) "확인되지 않은 정보중에 추정치나 가정치를 넣어서 진행할 수도 있고"
//  / "바깥정보를 제외하라는 것이 아니라, 현재 구현된 상태를 충분히 활용하라는 것이지" (새 출처는 붙이지 않고 있는 조회만)
//  세무사님 화면(📒 장부 ⑤ 도구)과 넥스의 두 입구(대화창·사건 처리 — case_ledger do=lookup·estimate·calc·compare)가 같은 함수를 부른다:
//   ledgerLookup_   — 있는 조회(cpOutsideOne_: 주소·토지대장·토지이용계획·토지이음·건축물대장·공시가격·조정대상지역, cpRealCases_: 매매사례)를
//                     필지 하나·여럿·고른 항목만. 소재지는 장부 칸·처리개요 물건·의뢰서 가설 물건 어디서든. 결과는 장부 공부 사실(L.pub)과 확보자료 PDF
//   ledgerEstimate_ — 의뢰서 등 가설(거래 날짜·금액·물건)·세무사님 가정값을 계산 칸에 "추정"으로(정해진 칸은 건드리지 않음 — 다른 가정은 경우 계산으로)
//   ledgerCalcRun_  — 장부(정함+추정)로 언제든 시험 계산, 경우 이름·가정(over)을 붙여 저장(장부 값은 바뀌지 않음)
//   ledgerCompare_  — 같은 사실로 양도·증여·상속을 각각 계산해 나란히
//  받을 증빙은 받는 곳(도구·세무사님·고객)으로 나눠 보이기만 한다 — 고객에게 보내는 일은 하지 않는다(세무사님 10-29 "고객에게 직접 요청하는 것은 아니다")
// ============================================================
var LEDGER_LOOKUP_WHAT_ = { 토지대장: 'ledger', 토지이용계획: 'landuse', 토지이음: 'eum', 건축물대장: 'building', 공시가격: 'price', 조정대상지역: 'adj', 매매사례: 'real' };
function ledgerPubKey_(loc) { return 'pub.' + String(loc || '').replace(/\s+/g, '').slice(0, 100); }
function ledgerPubSlim_(r) {
  r = r || {};
  const b = r.building || null, lu = r.landuse || null;
  return { loc: String(r.loc || ''), jibun: String(r.jibun || ''), pnu: String(r.pnu || ''), region: r.region ? String(r.region.text || r.region || '') : '', from: String(r.from || '').slice(0, 120),
    items: (r.items || []).slice(0, 40).map(function (it) { return { k: it.k || '', label: String(it.label || '').slice(0, 60), ok: !!it.ok, v: String(it.v == null ? '' : it.v).slice(0, 300), err: String(it.err || '').slice(0, 200), src: String(it.src || '').slice(0, 160) }; }),
    ledger: r.ledger || null, landuse: lu ? { names: (lu.names || []).slice(0, 20), urban: lu.urban || '', jsg: lu.jsg || [], green: lu.green || [], permit: lu.permit || [], src: lu.src || '' } : null,
    building: b ? { purpose: b.purpose || '', structure: b.structure || '', approval: b.approval || '', area: b.area || 0, totArea: b.totArea || 0, floorsUp: b.floorsUp || 0, floorsDown: b.floorsDown || 0, stdStructure: b.stdStructure || '', stdUseNo: b.stdUseNo || '', builtYear: b.builtYear || 0, src: b.src || '' } : null,
    prices: r.prices || {}, adj: r.adj || null, permitAt: r.permitAt || null, real: r.real || null, links: r.links || null };
}
// 조회 결과를 장부 공부 사실에 — 같은 소재지면 고친다(고른 항목만 조회했으면 지난 결과의 다른 항목은 남긴다)
function ledgerPubPut_(caseId, rows, by, why) {
  rows = (rows || []).filter(function (r) { return r && String(r.loc || '').trim(); });
  if (!caseId || !rows.length) return 0;
  return ledgerMutate_(caseId, function (L) {
    L.pub = L.pub || {};
    let n = 0;
    rows.forEach(function (r) {
      const k = ledgerPubKey_(r.loc), prev = L.pub[k], v = ledgerPubSlim_(r);
      if (prev && prev.v && r.only) {
        const keep = (prev.v.items || []).filter(function (it) { return !v.items.some(function (x) { return x.k === it.k && x.label === it.label; }); });
        v.items = keep.concat(v.items);
        ['ledger', 'landuse', 'building', 'adj', 'permitAt', 'real', 'region', 'pnu', 'jibun', 'links'].forEach(function (f) { if (v[f] == null || v[f] === '') v[f] = prev.v[f]; });
        v.prices = Object.assign({}, prev.v.prices || {}, v.prices || {});
        if (!v.from) v.from = prev.v.from;
      }
      const okList = v.items.filter(function (it) { return it.ok && it.k !== 'geo' && it.k !== 'region'; }), bad = v.items.filter(function (it) { return !it.ok; });
      L.pub[k] = { v: v, label: v.loc, src: { kind: '조회', who: String(by || 'GAS').slice(0, 6), file: '', page: '', quote: '', why: String(why || '').slice(0, 160) }, sure: '확실', state: '확정', at: caseProcNow_(),
        hist: ((prev && prev.hist) || []).concat([{ at: caseProcNow_(), by: String(by || 'GAS').slice(0, 6), kind: '조회', why: String(why || '').slice(0, 80), ok: okList.length, bad: bad.length }]).slice(-10) };
      ledgerLogTo_(L, { by: by || 'GAS', what: '공부 조회', path: k, detail: v.loc + ' — 받음 ' + okList.length + '건' + (okList.length ? '(' + okList.map(function (it) { return it.label.replace(/\(.*$/, ''); }).slice(0, 6).join('·') + ')' : '') + (bad.length ? ', 못 받음 ' + bad.map(function (it) { return it.label.replace(/\(.*$/, ''); }).slice(0, 4).join('·') : '') + (why ? ' · ' + String(why).slice(0, 60) : '') });
      n++;
    });
    return n;
  });
}
// 조회할 필지 — 장부 자산 칸(a*.assetLocation 정함·추정) → 처리개요 물건목록 → 의뢰서 등 가설 물건. 날짜는 장부 칸 → 가설 거래 → 기준일
function ledgerLookupTargets_(c, L) {
  const out = [], seen = {}, rows = (L && L.rows) || {};
  const val = function (p) { const r = rows[p]; return r && /^(확정|추정)$/.test(r.state) && r.v !== '' && r.v != null ? r.v : ''; };
  const add = function (loc, o) { loc = String(loc || '').trim(); const k = loc.replace(/\s+/g, ''); if (!loc || k.length < 5 || seen[k]) return; seen[k] = 1; out.push(Object.assign({ loc: loc }, o)); };
  const hd = {};
  (((L && L.hyp && L.hyp.claims) || [])).filter(function (x) { return x.f === '거래'; }).forEach(function (x) {
    const sp = String(x.v).split(' '), d = sp[1] || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (/^(취득|매수)/.test(sp[0]) && !hd.acq) hd.acq = d;
    if (/^(양도|매도|매각|잔금)/.test(sp[0]) && !hd.tr) hd.tr = d;
  });
  const dl = function (acq, tr) { const a = []; if (acq) a.push({ label: '취득일', date: acq }); if (tr) a.push({ label: c.세목 === 'transfer' ? '양도일' : (CASEPROC_BASE_LABEL_[c.세목] || '기준일'), date: tr }); return a; };
  Object.keys(rows).filter(function (p) { return /^a\d+\.assetLocation$/.test(p); }).sort().forEach(function (p) {
    const i = /^a(\d+)\./.exec(p)[1], loc = val(p); if (!loc) return;
    const cRef = String(val('a' + i + '.contract') || 'c0').replace(/\D/g, '') || '0';
    const kind = String(val('a' + i + '.assetKind') || '');
    add(loc, { p: 'a' + i, from: '장부 자산' + (Number(i) + 1) + ' 소재지(' + (rows[p].state === '추정' ? '추정' : (rows[p].src && rows[p].src.kind) || '') + ')', kind: kind === 'land' ? 'land' : /building/.test(kind) ? 'building' : '', area: Number(val('a' + i + '.assetArea')) || 0, jimok: String(val('a' + i + '.assetSubType') || ''),
      dates: dl(val('a' + i + '.acquisitionDate') || hd.acq, val('c' + cRef + '.date') || val('기준일') || hd.tr || c.기준일) });
  });
  try { if (typeof cpOutsidePropsFromOv_ === 'function') cpOutsidePropsFromOv_(c).forEach(function (q) { add(q.loc, { p: q.p, from: '처리개요 물건', kind: q.kind, area: q.area, jimok: q.jimok, dates: (q.dates || []).length ? q.dates : dl(hd.acq, hd.tr || c.기준일) }); }); } catch (e) {}
  (((L && L.hyp && L.hyp.claims) || [])).filter(function (x) { return x.f === '물건'; }).forEach(function (x) { add(x.v, { from: '의뢰서 등 가설 물건(' + (x.srcs || []).join('·').slice(0, 60) + (x.by === '넥스' ? ', 넥스 판단' : '') + ')', dates: dl(hd.acq, hd.tr || c.기준일) }); });
  return out;
}
// 공부 조회 — input: { loc(소재지 — 없으면 장부·처리개요·가설의 모든 필지), what:[토지대장·토지이용계획·토지이음·건축물대장·공시가격·조정대상지역·매매사례](비우면 매매사례 뺀 전부),
//   dates:[{label,date}](공시가격·조정대상지역 기준일), onlyNew(아직 조회 안 한 필지만), max, why }
function ledgerLookup_(c, input, by) {
  input = input || {};
  if (typeof cpOutsideOne_ !== 'function') return { ok: false, error: '조회 도구가 이 판에 없습니다' };
  if (typeof cpOutsideCan_ === 'function' && !cpOutsideCan_()) return { ok: false, error: '이 서버(직결 서비스)에서는 바깥 조회를 못 합니다 — GAS 서버에서 돌려 주세요' };
  const who = String(by || '넥스').slice(0, 6);
  const L = ledgerLoad_(c.id, true), all = ledgerLookupTargets_(c, L);
  let targets = all;
  if (String(input.loc || '').trim()) {
    const want = String(input.loc).replace(/\s+/g, '');
    targets = all.filter(function (t) { const k = t.loc.replace(/\s+/g, ''); return k === want || k.indexOf(want) !== -1 || want.indexOf(k) !== -1; }).slice(0, 1);
    if (!targets.length) targets = [{ loc: String(input.loc).trim(), from: who + ' 지정', dates: [] }];
  }
  if (input.onlyNew) targets = targets.filter(function (t) { return !(L.pub || {})[ledgerPubKey_(t.loc)]; });
  if (Array.isArray(input.dates) && input.dates.length) targets.forEach(function (t) { t.dates = input.dates.map(function (d) { return typeof d === 'string' ? { label: '기준일', date: d } : d; }); });
  if (!targets.length) return { ok: true, n: 0, 대상: [], message: all.length ? '새로 조회할 필지가 없습니다 — 모두 조회한 적이 있습니다(다시 하려면 소재지를 지정하세요)' : '조회할 필지가 없습니다 — 장부 소재지·처리개요 물건·의뢰서 가설 물건이 모두 비어 있습니다. 소재지(loc)를 주세요' };
  const whatIn = (Array.isArray(input.what) ? input.what : String(input.what || '').split(/[,·\s]+/)).map(function (w) { return String(w || '').trim(); }).filter(Boolean);
  const keys = whatIn.map(function (w) { return LEDGER_LOOKUP_WHAT_[w] || (Object.keys(LEDGER_LOOKUP_WHAT_).filter(function (k) { return k.indexOf(w) !== -1 || w.indexOf(k) !== -1; }).map(function (k) { return LEDGER_LOOKUP_WHAT_[k]; })[0]) || ''; }).filter(Boolean);
  const bad = whatIn.filter(function (w, i) { return !LEDGER_LOOKUP_WHAT_[w] && !Object.keys(LEDGER_LOOKUP_WHAT_).some(function (k) { return k.indexOf(w) !== -1 || w.indexOf(k) !== -1; }); });
  if (bad.length) return { ok: false, error: '조회 항목은 ' + Object.keys(LEDGER_LOOKUP_WHAT_).join('·') + ' 중에서 고릅니다 — 모르는 항목: ' + bad.join(', ') };
  const wantReal = keys.indexOf('real') !== -1, only = keys.filter(function (k) { return k !== 'real'; });
  const max = Math.max(1, Math.min(Number(input.max) || 8, 8));
  CP_SECURED_LOG_ = [];
  const t0 = Date.now(), rows = [], skipped = [];
  targets.forEach(function (t, i) {
    if (i >= max || Date.now() - t0 > 150000) { skipped.push(t.loc); return; }
    const dates = (t.dates || []).filter(function (d) { return d && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')); });
    let r;
    if (keys.length && !only.length) r = { loc: t.loc, items: [], prices: {} }; // 매매사례만
    else { try { r = cpOutsideOne_({ p: t.p || ('lk' + i), loc: t.loc, kind: t.kind || '', area: t.area || 0, jimok: t.jimok || '', dates: dates, only: only.length ? only : null }); } catch (e) { r = { loc: t.loc, items: [{ k: 'run', label: '조회', ok: false, err: String(e && e.message || e).slice(0, 160) }], prices: {} }; } }
    if (wantReal) {
      const base = ((dates.filter(function (d) { return d.label !== '취득일'; })[0]) || dates[dates.length - 1] || {}).date || c.기준일 || '';
      let rc; try { rc = cpRealCases_(t.loc, Number(t.area) || Number(r.building && r.building.area) || 0, base, 6, 3); } catch (e) { rc = { error: String(e && e.message || e).slice(0, 160) }; }
      if (rc && rc.cases) { r.real = { base: base, cases: rc.cases, src: rc.src }; r.items.push({ k: 'real', label: '매매사례(' + base + ' 기준 6개월 전~3개월 후)', ok: true, v: rc.cases.map(function (x) { return x.date + ' ' + Number(x.v).toLocaleString('ko-KR') + '원(' + x.area + '㎡' + (x.floor ? ' ' + x.floor + '층' : '') + ')'; }).join(' / '), src: rc.src }); }
      else r.items.push({ k: 'real', label: '매매사례', ok: false, err: (rc && rc.error) || '조회 결과 없음' });
    }
    r.from = t.from || ''; r.only = !!keys.length; r.p = t.p || r.p;
    rows.push(r);
  });
  ledgerPubPut_(c.id, rows, who, String(input.why || '').slice(0, 80) || (keys.length ? whatIn.join('·') + ' 조회' : '공부 조회'));
  // 장부 자산 칸이 비어 있으면 토지대장 면적·지목을 채운다(그 소재지가 장부 자산일 때, 토지만 — 서류 값·사람 값은 덮지 않음, 다르면 화면·넥스가 공부 사실과 견줌)
  const ops = [];
  rows.forEach(function (r) {
    const m = /^a(\d+)$/.exec(String(r.p || '')); if (!m || !r.ledger || r.building) return;
    const i = m[1], cur = L.rows || {};
    const empty = function (p) { const x = cur[p]; return !x || x.v === '' || x.v == null || /^(물어볼것|증빙받을것)$/.test(x.state) && !(x.src && /^(세무사님|넥스)$/.test(x.src.kind)); };
    const kind = cur['a' + i + '.assetKind'] && cur['a' + i + '.assetKind'].v;
    if (kind && kind !== 'land') return;
    if (r.ledger.area && empty('a' + i + '.assetArea')) ops.push({ path: 'a' + i + '.assetArea', value: String(r.ledger.area), kind: '규칙', by: 'GAS', file: '토지대장(공부 조회)', quote: String(r.ledger.src || '').slice(0, 120), why: '공부 조회 — ' + r.loc });
    if (r.ledger.jimok && empty('a' + i + '.assetSubType')) ops.push({ path: 'a' + i + '.assetSubType', value: String(r.ledger.jimok), kind: '규칙', by: 'GAS', file: '토지대장(공부 조회)', quote: String(r.ledger.src || '').slice(0, 120), why: '공부 조회 — ' + r.loc });
  });
  let filled = 0; if (ops.length) { try { const br = ledgerBatch_(c.id, ops); filled = (br && br.set) || 0; } catch (e) {} }
  let saved = 0; try { saved = cpSecuredFlush_(c.id); } catch (e) {}
  const brief = rows.map(function (r) {
    const ok = (r.items || []).filter(function (it) { return it.ok && it.k !== 'geo' && it.k !== 'region'; }), no = (r.items || []).filter(function (it) { return !it.ok; });
    return { 소재지: r.loc, 어디서: r.from || '', 받음: ok.map(function (it) { return it.label + ': ' + String(it.v || '').slice(0, 120); }), 못받음: no.map(function (it) { return it.label + ': ' + String(it.err || '').slice(0, 100); }) };
  });
  return { ok: true, n: rows.length, 대상: brief, 칸채움: filled, 확보자료PDF: saved, 다음에: skipped,
    message: '공부 조회 ' + rows.length + '필지' + (keys.length ? '(' + whatIn.join('·') + ')' : '') + ' — ' + brief.map(function (b) { return b.소재지 + ' 받음 ' + b.받음.length + (b.못받음.length ? '·못 받음 ' + b.못받음.length : ''); }).join(' / ') + (filled ? ' · 빈 칸 ' + filled + '개 채움(토지대장)' : '') + (saved ? ' · 확보자료 PDF ' + saved + '개' : '') + (skipped.length ? ' · 다음에: ' + skipped.join(', ') : '') };
}
// 의뢰서 등 가설·가정값 → 계산 칸 "추정". input: { values:[{path,value,why}](가정값 — 비우면 가설에서), why }
function ledgerEstimate_(c, input, by) {
  input = input || {};
  const who = String(by || '넥스').slice(0, 6);
  const L = ledgerLoad_(c.id, true), rows = L.rows || {};
  const settled = function (p) { const r = rows[p]; return r && /^(확정|추정)$/.test(r.state) && r.v !== '' && r.v != null; };
  const ops = [], skipped = [];
  if (Array.isArray(input.values) && input.values.length) {
    input.values.slice(0, 30).forEach(function (x) {
      if (!x || !x.path) return;
      const p = String(x.path).trim();
      if (settled(p) && rows[p].state === '확정') { skipped.push(ledgerLabel_(p) + '(정해진 값 ' + ledgerValueText_(p, rows[p].v) + ' — 다른 값을 넣어 보려면 경우 계산의 가정으로)'); return; }
      ops.push({ path: p, value: x.value, kind: '추정', estimate: true, by: who, file: String(x.file || '').slice(0, 80), why: String(x.why || input.why || (who === '세무사님' ? '세무사님 가정값' : '넥스 가정값')).slice(0, 160) });
    });
  } else {
    const claims = (L.hyp && L.hyp.claims) || [];
    const want = {};
    const put = function (p, v, src) { if (!want[p]) want[p] = { v: v, src: src, alt: [] }; else if (String(want[p].v) !== String(v) && want[p].alt.map(String).indexOf(String(v)) === -1) want[p].alt.push(v); };
    claims.filter(function (x) { return x.f === '거래'; }).forEach(function (x) {
      const sp = String(x.v).split(' '), role = sp[0], raw = sp.slice(1).join(' ');
      const map = LEDGER_HYP_CALC_.filter(function (m) { return m[0].test(role); })[0]; if (!map) return;
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(raw), path = isDate ? map[2] : map[1]; if (!path) return;
      if (c.세목 === 'transfer' && /^(g|i)\./.test(path)) return;
      if (c.세목 === 'gift' && /^(c|a|i)\d*\./.test(path)) return;
      if (c.세목 === 'inheritance' && /^(c|a|g)\d*\./.test(path)) return;
      const v = isDate ? raw : ledgerKrw_(raw); if (!isDate && !Number.isFinite(v)) return;
      put(path, v, (x.srcs || []).join('·') + (x.by === '넥스' ? '(넥스 판단)' : ''));
    });
    if (c.세목 === 'transfer') {
      claims.filter(function (x) { return x.f === '물건'; }).slice(0, 4).forEach(function (x, i) { put('a' + i + '.assetLocation', x.v, (x.srcs || []).join('·')); });
      if (want['c0.date'] && !want['기준일']) put('기준일', want['c0.date'].v, want['c0.date'].src);
    }
    Object.keys(want).forEach(function (p) {
      if (settled(p)) { skipped.push(ledgerLabel_(p) + '(이미 ' + ledgerValueText_(p, rows[p].v) + ' — ' + (rows[p].state === '추정' ? '추정' : ((rows[p].src && rows[p].src.kind) || '') + ' 값') + ')'); return; }
      const w = want[p];
      if (w.alt.length) { ops.push({ ask: true, path: p, label: ledgerLabel_(p), question: '의뢰서 등에 값이 여럿입니다 — ' + [w.v].concat(w.alt).map(function (v) { return ledgerValueText_(p, v); }).join(' / ') + '. 어느 값으로 추정할까요?', cands: [w.v].concat(w.alt).map(function (v) { return { v: v, src: w.src }; }), by: who }); return; }
      ops.push({ path: p, value: w.v, kind: '추정', estimate: true, by: who, file: String(w.src || '의뢰서 등').slice(0, 80), why: '의뢰서 등 가설 — 서류 확인 전 추정(서류가 들어오면 서류 값으로 바뀌고, 다르면 여쭘)' });
    });
  }
  if (!ops.length) return { ok: true, n: 0, skipped: skipped, message: '추정으로 옮길 값이 없습니다' + (skipped.length ? ' — 이미 정해진 칸: ' + skipped.join(', ') : ' — 의뢰서 등 가설에 거래 날짜·금액·물건이 없습니다(가설은 📒 ⓪ 사건 흐름에서 봅니다)') };
  const r = ledgerBatch_(c.id, ops) || {};
  const out = { ok: true, n: r.set || 0, asked: r.asked || 0, refused: r.refused || 0, errors: r.errors || [], skipped: skipped,
    넣은칸: ops.filter(function (o) { return !o.ask; }).map(function (o) { return ledgerLabel_(o.path) + ' ' + ledgerValueText_(o.path, o.value); }) };
  out.message = '추정으로 넣음 ' + out.n + '칸' + (out.n ? '(' + out.넣은칸.join(', ').slice(0, 200) + ')' : '') + (out.asked ? ' · 값이 여럿이라 물어볼 것 ' + out.asked + '칸' : '') + (skipped.length ? ' · 이미 정해져 둠 ' + skipped.length + '칸' : '') + ((r.errors || []).length ? ' · 못 넣음: ' + r.errors.join(' / ').slice(0, 160) : '') + ' — 시험 계산(🧮)을 돌릴 수 있습니다';
  return out;
}
// 세목 비교 — input: { gift:{엔진 입력 — relation 필수, giftAmount 없으면 장부 양도가액}, inheritance:{엔진 입력}, transfer:{over}, name, why }
function ledgerCompare_(c, input, by) {
  input = input || {};
  const who = String(by || '넥스').slice(0, 6), tag = String(input.name || '세목 비교').slice(0, 30);
  const out = [], errs = [];
  const won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
  const cs = ledgerCalcState_(c.id), c0 = cs.state.transferContracts[0] || {};
  if (c.세목 === 'transfer' || input.transfer) {
    const r = ledgerCalcRun_(c, { by: who, name: tag + ' — 양도', over: input.transfer && input.transfer.over, why: input.why });
    if (r && r.ok) out.push({ 세목: '양도소득세', 납부세액: r.최종세액, 저장본: r.id, 전제: '장부 값(정함+추정)' + ((r.gaps || []).length ? ' · 빈 칸 ' + r.gaps.length + '개' : '') + ((r.추가확인 || []).length ? ' · 추정·보류 ' + r.추가확인.length + '건' : '') });
    else errs.push('양도: ' + ((r && r.error) || '계산 못 함'));
  }
  if (input.gift) {
    const g = Object.assign({}, input.gift);
    const pre = [];
    if (!Number(g.giftAmount) && Number(c0.totalPrice)) { g.giftAmount = Number(c0.totalPrice); pre.push('증여재산가액 = 장부 양도가액 ' + won(g.giftAmount) + '(시가 가정)'); }
    if (!g.giftDate) { g.giftDate = c0.date || cs.기준일 || c.기준일 || undefined; if (g.giftDate) pre.push('증여일 = ' + g.giftDate + '(가정)'); }
    if (!g.relation) errs.push('증여: 증여자와의 관계(relation — 배우자·직계존속·직계비속·기타친족·기타)를 정해 주세요');
    else if (!Number(g.giftAmount)) errs.push('증여: 증여재산가액(giftAmount)이 없습니다');
    else {
      let r; try { r = caseProcScenario_(c, { tax: 'gift', name: tag + ' — 증여', input: g, by: who, why: (input.why || '세목 비교') + (pre.length ? ' · ' + pre.join(' · ') : '') }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      if (r && r.ok) out.push({ 세목: '증여세', 납부세액: r.최종세액, 저장본: r.id, 전제: ['관계 ' + g.relation].concat(pre).join(' · ') });
      else errs.push('증여: ' + ((r && r.error) || '계산 못 함'));
    }
  }
  if (input.inheritance) {
    let r; try { r = caseProcScenario_(c, { tax: 'inheritance', name: tag + ' — 상속', input: input.inheritance, by: who, why: input.why || '세목 비교' }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (r && r.ok) out.push({ 세목: '상속세', 납부세액: r.최종세액, 저장본: r.id, 전제: '주신 상속 입력' });
    else errs.push('상속: ' + ((r && r.error) || '계산 못 함'));
  }
  if (!out.length && !errs.length) return { ok: false, error: '비교할 세목이 없습니다 — gift{relation…}·inheritance{…}를 주세요(양도 사건이면 양도는 장부로 자동)' };
  try { ledgerMutate_(c.id, function (L) { ledgerLogTo_(L, { by: who, what: '세목 비교', detail: out.map(function (x) { return x.세목 + ' ' + won(x.납부세액); }).join(' · ') + (errs.length ? ' · 못 함 ' + errs.length : '') }); }); } catch (e) {}
  return { ok: out.length > 0, 비교: out, 못함: errs, error: out.length ? undefined : errs.join(' / '),
    message: (out.length ? '세목 비교 — ' + out.map(function (x) { return x.세목 + ' ' + won(x.납부세액) + '(' + x.저장본 + ')'; }).join(' / ') : '세목 비교를 하지 못했습니다') + (errs.length ? ' · 못 함: ' + errs.join(' / ') : '') + ' — 저장본은 경우(안)로 남아 검토서가 인용합니다' };
}
// 받을 증빙의 받는 곳 — 도구(이미 있는 조회로 가져옴) · 세무사님(등기부 열람·홈택스 등) · 고객. 보이기만 한다(고객에게 보내지 않음)
var LEDGER_EV_TOOL_RE_ = /토지대장|임야대장|토지이용계획|건축물대장|공시지가|개별주택가격|공동주택가격|공시가격|기준시가|매매사례|실거래|조정대상/;
var LEDGER_EV_TAXPRO_RE_ = /등기사항|등기부|홈택스|수임|세목별\s*과세|과세\s*증명|납세\s*증명/;
function ledgerEvWhere_(label) { const s = String(label || ''); return LEDGER_EV_TOOL_RE_.test(s) ? '도구' : LEDGER_EV_TAXPRO_RE_.test(s) ? '세무사님' : '고객'; }
// 도구로 받는 서류가 이미 공부 조회로 있는가 — 서류 이름 → 조회 항목
function ledgerEvToolHas_(L, label) {
  const s = String(label || ''), pub = (L && L.pub) || {};
  const k = /토지대장|임야대장/.test(s) ? 'ledger' : /토지이용계획/.test(s) ? 'landuse' : /건축물대장/.test(s) ? 'building' : /공시|기준시가/.test(s) ? 'price' : /매매사례|실거래/.test(s) ? 'real' : /조정대상/.test(s) ? 'adj' : '';
  if (!k) return '';
  const hit = Object.keys(pub).map(function (p) { return pub[p].v || {}; }).filter(function (v) { return (v.items || []).some(function (it) { return it.ok && (it.k === k || (k === 'landuse' && it.k === 'eum')); }); });
  return hit.length ? hit.map(function (v) { return v.loc; }).join(', ') : '';
}
function ledgerPubRows_(L) {
  const pub = (L && L.pub) || {};
  return Object.keys(pub).map(function (p) { const r = pub[p], v = r.v || {}; return { path: p, 소재지: v.loc, 어디서: v.from || '', 때: r.at || '', 누가: (r.src && r.src.who) || '', 지역: v.region || '', 받음: (v.items || []).filter(function (it) { return it.ok && it.k !== 'geo'; }), 못받음: (v.items || []).filter(function (it) { return !it.ok; }), 링크: v.links || null }; });
}

// ============================================================
// [2026.10.30 2단계] 자문 장부 — 쟁점·대안·근거·위험·권고·보고서 (전체 설계도 3층 "더할 것")
// 세무사님 원문(10-29): "도구는 충분한데 왜 도구를 활용하여 고급 자문을 할 수 없냐고?" / "신고사건은 극히 일부분이다" / (10-30) "기존 보고서 모음을 참고하라"
//  자문의 뼈대(무엇이 쟁점이고, 어떤 대안을 어떤 계산 저장본으로 견주었고, 근거·위험은 무엇이며, 무엇을 권했고, 어느 보고서로 냈는지)를 사실과 같은 장부 한 곳(L.adv)에 둔다.
//  넥스(case_ledger do=advice)·세무사님 화면(📒 ⑥ 자문)이 같은 함수로 읽고 쓴다. 세무사님이 적은 항목은 넥스가 바꾸지 못한다(칸 장부와 같은 주인 순서).
//  숫자는 여기 적지 않고 계산 저장본 id(calc)로만 잇는다 — 보고서는 저장본에서 인용(암산 금지).
// ============================================================
var LEDGER_ADV_KINDS_ = { 쟁점: 'issues', 대안: 'alts', 근거: 'basis', 위험: 'risks', 권고: 'recs', 보고서: 'reports' };
function ledgerAdvList_(L) {
  const A = (L && L.adv) || {}, out = {};
  Object.keys(LEDGER_ADV_KINDS_).forEach(function (k) { out[k] = (A[LEDGER_ADV_KINDS_[k]] || []).filter(function (x) { return x && !x.removed; }); });
  return out;
}
function ledgerAdvPut_(c, input, who) {
  input = input || {};
  const kind = String(input.item || (LEDGER_ADV_KINDS_[input.kind] ? input.kind : '') || '').trim(), key = LEDGER_ADV_KINDS_[kind];
  if (!key) return { ok: false, error: 'item은 ' + Object.keys(LEDGER_ADV_KINDS_).join('·') + ' 중 하나' };
  const title = String(input.title || '').trim().slice(0, 120);
  if (!title && !input.id) return { ok: false, error: 'title(한 줄 제목)이 필요합니다' };
  const by = String(who || '넥스').slice(0, 6), rank = function (w) { return w === '세무사님' ? 3 : w === '넥스' ? 2 : 1; };
  const arr = function (x) { return (Array.isArray(x) ? x : (x == null || x === '' ? [] : [x])).map(function (s) { return String(s).slice(0, 200); }).slice(0, 20); };
  return ledgerMutate_(c.id, function (L) {
    L.adv = L.adv || {}; const list = L.adv[key] = L.adv[key] || [];
    let it = list.filter(function (x) { return x && ((input.id && x.id === String(input.id)) || (!input.id && title && x.title === title)); })[0];
    if (it && rank(it.by) > rank(by)) return { ok: false, error: '세무사님이 적으신 항목은 바꾸지 않습니다 — 다르면 말씀으로 여쭌다', 지금: { id: it.id, title: it.title, text: it.text } };
    if (input.remove) {
      if (!it) return { ok: false, error: '지울 항목을 찾지 못함' };
      it.removed = true; it.hist = (it.hist || []).concat([{ at: caseProcNow_(), by: by, what: '지움', why: String(input.why || '').slice(0, 120) }]).slice(-10);
      ledgerLogTo_(L, { by: by, what: '자문 ' + kind + ' 지움', path: 'adv:' + it.id, detail: it.title });
      return { ok: true, 지움: it.id, message: '자문 ' + kind + ' 지움 — ' + it.title };
    }
    const now = caseProcNow_(), isNew = !it;
    if (!it) { it = { id: kind.slice(0, 1) + (list.length + 1) + '_' + Date.now().toString(36).slice(-4), at: now }; list.push(it); }
    if (title) it.title = title;
    if (input.text != null) it.text = String(input.text).slice(0, 2000);
    if (input.calc != null) it.calc = arr(input.calc);          // 계산 저장본 id(tc_…) — 대안·권고·보고서가 인용한 숫자의 원천
    if (input.refs != null) it.refs = arr(input.refs);          // 근거: 조문·판례·예규·절세 아이템·지침 이름(실재 확인한 것만)
    if (input.links != null) it.links = arr(input.links);       // 이어진 항목 id(대안 → 쟁점, 위험 → 대안, 권고 → 대안 등)
    if (input.status != null) it.status = String(input.status).slice(0, 10); // 잠정·확정·보류
    if (input.file != null) it.file = String(input.file).slice(0, 160);     // 보고서 파일 이름·id
    it.by = by; it.when = now;
    it.hist = (it.hist || []).concat([{ at: now, by: by, what: isNew ? '적음' : '고침', why: String(input.why || '').slice(0, 120) }]).slice(-10);
    ledgerLogTo_(L, { by: by, what: '자문 ' + kind + (isNew ? ' 적음' : ' 고침'), path: 'adv:' + it.id, detail: it.title + (it.calc && it.calc.length ? ' · 저장본 ' + it.calc.join(',') : '') });
    return { ok: true, id: it.id, kind: kind, title: it.title, 새로: isNew, message: '자문 ' + kind + ' ' + (isNew ? '적음' : '고침') + ' — ' + it.title + (it.calc && it.calc.length ? ' (저장본 ' + it.calc.length + '개)' : '') };
  });
}
// 넥스·화면이 보는 자문 장부 요약 — 항목마다 제목·상태·누가·잇는 저장본(그 저장본의 이름·세액은 사건 계산 결과에서 바로 붙임)
function ledgerAdvBrief_(c, L) {
  const lists = ledgerAdvList_(L || ledgerLoad_(c.id)), calcs = Array.isArray(c.세액계산결과) ? c.세액계산결과 : [];
  const cite = function (id) { const e = calcs.filter(function (x) { return x && String(x.id) === String(id); })[0]; return e ? { id: e.id, 이름: e.안 ? e.안.이름 : '기본 저장본', 세목: e.세목, 최종세액: e.최종세액 } : { id: id, 없음: '사건에 이 저장본이 없음' }; };
  const out = {};
  Object.keys(lists).forEach(function (k) { out[k] = lists[k].map(function (x) { const o = { id: x.id, 제목: x.title, 상태: x.status || '', 누가: x.by || '' }; if (x.text) o.내용 = String(x.text).slice(0, 300); if (x.calc && x.calc.length) o.저장본 = x.calc.map(cite); if (x.refs && x.refs.length) o.근거 = x.refs; if (x.links && x.links.length) o.이음 = x.links; if (x.file) o.파일 = x.file; return o; }); });
  return out;
}
