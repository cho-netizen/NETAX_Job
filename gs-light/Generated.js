// 자동 생성 파일 — 직접 고치지 말 것. 원본: gs-backend/*.js, 생성: tools/build-light.js
// 조회 시작점: work_getCases, client_getClients, client_getConsultLogs, booking_getBookings, jsonResponse, todoList_, ledgerView_, ledgerFlowBrief_, work_findCaseRow_, work_values_, caseProcRouteTax_, CP_SHEET_MEMO_ON_
// 포함한 최상위 선언 266개 (시트 쓰기가 들어 있는 것: getOrCreateSubfolder_, client_ensureSheet_, work_getSheet_, ocrFileText_, tcOcrStoreFolder_, tcOcrBlob_, tcBlobText_, tcPptxText_, tc_docText_)

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

// [2026.11.13 5차 다] 넥스가 고를 수 있는 역할이 열둘뿐이라 수용재결서·보상금 내역·건축물대장 같은 흔한 서류를 「기타」로 확정했다(실사건 9건) — 실사건에서 나온 종류를 더함
var LEDGER_DOC_ROLES_ = ['양도계약서', '취득계약서', '증여계약서', '등기부', '등기신청서·등기필증', '건축물대장', '토지대장', '전소유자 분양계약서', '분양권 매매계약서', '중개대상물 확인설명서', '수용재결서', '손실보상 협의서', '보상금 내역·영수증', '수용사실 확인서', '입금·통장 내역', '취득세 영수증', '영수증', '장례비 영수증', '간편계산서', '감정평가서', '매매사례·공시가격', '신고서', '사망 서류', '상속재산분할협의서', '재산조회 회보서', '등초본', '가족관계', '공부 자료(조회)', '기타'];

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

var LEDGER_GKO_ = { isMarriageGift: '혼인증여(혼인일 전후 2년)', isBirthGift: '출산증여(출생·입양일부터 2년)', giftPriorMarriageDeductionUsed: '이미 쓴 혼인·출산공제', giftDoneeName: '수증자 성명', giftDonorName: '증여자 성명', giftRelation: '증여자와의 관계', giftAmount: '증여재산가액', giftDebtAssumed: '인수채무액', giftDebtProven: '입증된 채무', giftPriorAmount: '10년 내 기증여액', giftPriorPaidTax: '기납부세액', giftPriorDeductionUsed: '이미 쓴 증여공제', giftAppraisalFee: '감정평가수수료', giftDoneeRegNo: '수증자 주민등록번호', giftDonorRegNo: '증여자 주민등록번호', giftDoneeAddress: '수증자 주소', giftDonorAddress: '증여자 주소', trTransferorName: '양도인 성명', ihDeceasedName: '피상속인 성명', ihDeathDate: '상속개시일', 물건목록: '물건 목록' };

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
  if ((m = /^i\.heir(\d+)\.(\w+)$/.exec(p))) return '상속인' + (Number(m[1]) + 1) + ' ' + ({ name: '성명', relation: '관계', inherited: '받는 재산가액', priorGift: '사전증여 가액', priorGiftBase: '사전증여 과세표준' }[m[2]] || m[2]); // [2026-11-10] 공동상속
  if ((m = /^g(\d+)\.(\w+)$/.exec(p)) && Number(m[1]) > 0 && LEDGER_GKO_[m[2]]) return '증여' + (Number(m[1]) + 1) + ' ' + LEDGER_GKO_[m[2]]; // [2026-11-10] 둘째 증여부터
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
  if (/\.buyer\d*\.relation$/.test(p)) return 'buyer.relation';
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
  if (p === 'costs' || /^a\d+\.costs$/.test(p)) { // [2026-11-10] a#.costs도 같은 모양
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
  if ((path === 'costs' || /^a\d+\.costs$/.test(path)) && typeof v === 'object') { const s = function (l) { return (l || []).reduce(function (t, x) { return t + (Number(x.amount) || 0); }, 0); }; return '취득비용 ' + s(v.acq).toLocaleString('ko-KR') + '원(' + (v.acq || []).length + '건) · 양도비용 ' + s(v.tr).toLocaleString('ko-KR') + '원(' + (v.tr || []).length + '건)'; }
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
    if (prevSettled && (kind === '서류' || kind === '규칙') && (prevKind === '서류' || prevKind === '규칙') && prev.sure === '확실' && sure !== '확실' && !(input.estimate && ledgerJudgeLabel_(prev.src) && /^종합판정 /.test(String(input.why || '')))) {
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
  // [2026-11-13 4차 37·38] 장부가 모르는 칸 이름(seller.acquisition·basic.taxpayer 등)으로 물으면 이름이 영어로 화면·넥스 답에 그대로 나왔다 — 그럴 땐 질문 앞머리를 이름으로
  let lab0 = String(o.label || prev.label || ledgerLabel_(path)); if (/[A-Za-z]{3,}/.test(lab0) && !/^(q|doc):/.test(path) && o.question) lab0 = String(o.question).replace(/\s+/g, ' ').replace(/\([^)]*\)/g, '').replace(/[—–?？].*$/, '').trim() || lab0;
  const row = Object.assign({}, prev, { label: lab0.slice(0, 40), state: o.needDoc ? '증빙받을것' : '물어볼것', ask: String(o.question || '').slice(0, 300), cands: (o.cands || []).slice(0, 8).map(function (x) { return { v: x.v, src: String(x.src || '').slice(0, 120) }; }), at: caseProcNow_() });
  if (!row.src) row.src = { kind: '질문', who: String(o.by || '').slice(0, 6), file: '', page: '', quote: '', why: '' };
  if (!o.keep) { row.v = prev.v; }
  row.turn = o.turn || (String(o.by || '') === 'GAS' ? '넥스' : '세무사님'); row.group = o.group || prev.group || ledgerQGroup_(path); // [2026.11.12 질문 정리 ①] 차례·묶음
  row.hist = (Array.isArray(prev.hist) ? prev.hist : []).concat([{ at: row.at, by: o.by || '', kind: '질문', prev: prev.state ? { v: prev.v, state: prev.state } : null, next: { state: row.state }, why: row.ask }]).slice(-30);
  L.rows[path] = row;
  ledgerLogTo_(L, { by: o.by || '', what: row.state, path: path, detail: row.label + ' — ' + row.ask.slice(0, 120) + (row.cands.length ? ' · 후보 ' + row.cands.length + '개' : '') });
  return { ok: true, asked: true, row: ledgerRowOut_(path, row), message: '「' + row.label + '」 ' + row.state + '으로 둠' + (row.cands.length ? ' — 후보 ' + row.cands.map(function (x) { return ledgerValueText_(path, x.v); }).join(' / ') : '') };
}

function ledgerRowOut_(path, r) {
  r = r || {};
  return { path: path, label: r.label && !/^[a-zA-Z]/.test(String(r.label)) ? r.label : ledgerLabel_(path), v: r.v === undefined ? '' : r.v, 값: ledgerValueText_(path, r.v), state: r.state || '', kind: r.src ? r.src.kind : '', who: r.src ? r.src.who : '', file: r.src ? r.src.file : '', quote: r.src ? r.src.quote : '', why: r.src ? r.src.why : '', sure: r.sure || '', ask: r.ask || '', cands: (r.cands || []).map(function (x) { return { v: x.v, 값: ledgerValueText_(path, x.v), src: x.src }; }), at: r.at || '', note: r.note || '', histN: (r.hist || []).length, fx: r.fx || [], fk: r.fk || [], turn: ledgerQOpenState_(r.state) ? ledgerQTurnOf_(r, false) : '', group: r.group || ledgerQGroup_(path) };
}

// ── 읽기 ──
function ledgerRows_(caseId, filter) {
  const L = ledgerLoad_(caseId);
  const st = filter && filter.state ? (Array.isArray(filter.state) ? filter.state : [filter.state]) : null;
  return Object.keys(L.rows).filter(function (p) { return !st || st.indexOf(L.rows[p].state) !== -1; }).sort(ledgerPathSort_).map(function (p) { return ledgerRowOut_(p, L.rows[p]); });
}

function ledgerPathSort_(a, b) {
  const g = function (p) { return /^doc:/.test(p) ? 0 : /^기준일$/.test(p) ? 1 : /^seller\d*\./.test(p) ? 2 : /^c\d+\./.test(p) ? 3 : /^a\d+\./.test(p) ? 4 : /^(costs|taxfee)$/.test(p) ? 5 : 6; };
  return g(a) - g(b) || (a < b ? -1 : a > b ? 1 : 0);
}

function ledgerSummary_(caseId) {
  const L = ledgerLoad_(caseId), n = {};
  LEDGER_STATES_.forEach(function (s) { n[s] = 0; });
  Object.keys(L.rows).forEach(function (p) { n[L.rows[p].state] = (n[L.rows[p].state] || 0) + 1; });
  n.전체 = Object.keys(L.rows).length; n.at = L.at || '';
  return n;
}

// ── 증여·상속 — 계산기 칸을 장부 줄로(처리개요 단계 끝에서 부름) ──
// 증여: 처리개요 칸 = 계산기 칸(GI_CALC_KEYS_ + 기납부세액·이미 쓴 공제) → g.<칸>. 값 주인은 그 칸 근거 기록(filled.src)으로 가른다.
// 상속: 상속 사실(caseProcInhFacts_ — 서류 + 세무사님 세부 답 ihChoices)을 계산기 입력 단위로 → i.<칸>. 세무사님이 장부에서 이 칸을 직접 고치면 그 값이 이긴다(규칙 ①).
var LEDGER_GIFT_KEYS_ = ['giftDoneeName', 'giftDonorName', 'giftRelation', 'giftAmount', 'giftDebtAssumed', 'giftDebtProven', 'giftPriorAmount', 'giftPriorPaidTax', 'giftPriorDeductionUsed', 'giftAppraisalFee', 'isMarriageGift', 'isBirthGift', 'giftPriorMarriageDeductionUsed']; // [2026.10.31 I] 혼인·출산공제 칸(_기능부족신고 10-30 — 장부 계산이 혼인·출산공제를 못 넣던 것)

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
  if (/^(g\d*|i)\./.test(t)) return t;
  if ((m = /^ovAsset:(\d+):(.+)$/.exec(t))) { const k = { 양도가액: 'c0.totalPrice', 취득가액: 'a' + m[1] + '.acquisitionPrice', 취득일: 'a' + m[1] + '.acquisitionDate', assetLocation: 'a' + m[1] + '.assetLocation', 주택판단: 'a' + m[1] + '.assetType' }[m[2]]; return k || ''; }
  if (/^(seller\d*\.|c\d+\.|a\d+\.|costs$|taxfee$|사건분류$|기준일$|doc:)/.test(t)) return t;
  return '';
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

// [2026.11.12 넥스 질문 정리 계획서 ①] 열린 칸의 「차례」와 「묶음」 — 세무사님 "GAS가 못 푼 것은 넥스에게 돌려보내고, 넥스가 판단하거나 세무사님께 묻는다"(공통원칙 10-22)
//  · 차례: GAS가 세운 물음은 「넥스」 차례(넥스 미리 읽기 스위치를 끈 사건은 「세무사님」 — "AI 없이"), 넥스가 세우거나 넘긴 물음은 「세무사님」 차례
//  · 묶음: 계산기 카드 순서(10-16 "세액계산기 자체가 정보 순서") — 세무사님께는 묶음 단위로 보인다(10-22 "항목별로 그루핑해서 질문")
function ledgerQGroup_(path) {
  const p = String(path || '');
  if (/^doc:/.test(p)) return '서류';
  if (/^q:(rf|cxt|evidence|basic)/.test(p)) return '서류 대조';
  if (/^advice\./.test(p)) return '자문 쟁점';
  if (/^(seller|household|owner)\d*\./.test(p) || /^양도인/.test(p)) return '양도인';
  if (/^c\d+\./.test(p) || /^(기준일|사건분류)$/.test(p)) return '양도계약';
  if (/^a\d+\.(acquisition|acq)/.test(p) || /^a\d+\.contract$/.test(p)) return '취득';
  if (/^a\d+\.(share|apportion|ratio)/.test(p) || /안분/.test(p)) return '안분';
  if (/^a\d+\.(oneHouse|longTerm|exempt|reduction|special|farm|resid|residence|nonBiz)/i.test(p) || /^(costs|taxfee)$/.test(p)) return '특례·비용';
  if (/^a\d+\./.test(p)) return '자산';
  if (/^(g|gift)\./.test(p) || /^증여/.test(p)) return '증여';
  if (/^(ih|inh|inherit)\./.test(p) || /^상속/.test(p)) return '상속';
  if (/^q:(nex|ov|ai)/.test(p)) return '사건 파악';
  return '그 밖';
}

function ledgerQTurnOf_(r, nexOff) { // 저장된 차례가 없으면(옛 줄) 세운 주체로: GAS·규칙·서류 → 넥스 차례, 그 밖(넥스·세무사님) → 세무사님 차례
  const t = r && r.turn ? String(r.turn) : (r && r.src && /^(GAS|규칙|서류)$/.test(String(r.src.who || '')) ? '넥스' : (r && r.src && r.src.kind === '질문' && !r.src.who ? '넥스' : '세무사님'));
  return t === '넥스' && nexOff ? '세무사님' : t;
}

function ledgerNexOff_(caseId) { // 이 사건의 넥스 미리 읽기 스위치가 꺼져 있나(사건처리 결정 파일 nexPreread.off) — 장부 쪽에서 가볍게
  try {
    const k = String(caseId || '');
    if (typeof CASEPROC_SV_MEMO_ !== 'undefined' && CASEPROC_SV_MEMO_[k]) { const o = JSON.parse(CASEPROC_SV_MEMO_[k]); return !!(o && o.nexPreread && o.nexPreread.off); }
    if (typeof caseProcFile_ !== 'function') return false;
    const f = caseProcFile_(k, false); if (!f) return false;
    const o = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}') || {};
    return !!(o.nexPreread && o.nexPreread.off);
  } catch (e) { return false; }
}

// 이 질문이 세운 물음을 거둘 때 돌아갈 상태 — 질문 전에 값이 정해져 있었으면 그 값·상태로
function ledgerQBack_(r) {
  const h = Array.isArray(r.hist) ? r.hist : [];
  for (let i = h.length - 1; i >= 0; i--) { if (h[i] && h[i].kind === '질문') { const pv = h[i].prev; return pv && (pv.state === '확정' || pv.state === '추정') && r.v !== '' && r.v !== undefined && r.v !== null ? pv : null; } }
  return null;
}

// ── 답 = 장부 줄 [2026.10.28 시정 2단계 — 답 저장소 단일화] ──
// 예전: 양도 답은 사건 처리 저장 파일의 답 저장소(trAns: 칸 경로 → {v, src, at})에 적고 장부에는 베껴 적었다(ledgerMirrorApply_). 장부(📒·넥스 도구)에서
//  세무사님이 넣은 값은 답 저장소에 없어 GAS 계산에 안 들어갔다. 이제 답 저장소는 장부에서 뽑은 모양일 뿐 — 세무사님·넥스가 정한 양도 칸 줄이 곧 답이다.
var LEDGER_ANS_RE_ = /^(seller\d*\.|c\d+\.|a\d+\.|costs$|taxfee$|사건분류$|split$|relFmv$|compSplit$)/;

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
  if (/^(seller\d*\.|c\d+\.|a\d+\.)/.test(p)) return 'calc:' + p;
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

// 쓰기 — rem: 질문 목록(순서대로; undefined면 질문은 그대로), dec: 질문 결정 지도 {질문id:{d,at,text,note}}(undefined면 결정은 그대로)
//  o.partial: 이번 목록이 질문 전부가 아님(가벼운 다시 맞추기 — 사건파악·메모 질문을 다시 만들지 않음) → 목록에 없다고 떼지 않는다
function ledgerQWrite_(caseId, rem, dec, o) {
  const res = ledgerQWrite0_(caseId, rem, dec, o);
  // [2026.11.12 질문 정리 ②] GAS가 새 물음을 세웠으면(넥스 차례) 미리 읽기 틱이 넥스를 깨우게 줄을 선다(진행 사건만 — 깨우기 쪽에서 가림)
  try { if (res && res.asked && typeof cpNexQEnqueue_ === 'function') cpNexQEnqueue_(caseId); } catch (e) {}
  return res;
}

function ledgerQWrite0_(caseId, rem, dec, o) {
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
        const row = L.rows[path] || (L.rows[path] = { label: ledgerLabel_(path), v: '', state: '물어볼것', src: { kind: '질문', who: 'GAS' }, at: caseProcNow_(), turn: '넥스', group: ledgerQGroup_(path) });
        if (!row.group) row.group = ledgerQGroup_(path); // [2026.11.12 질문 정리 ①]
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
  const nexOff = ledgerNexOff_(caseId); // [2026.11.12 질문 정리 ①] 스위치 끈 사건은 모두 세무사님 차례
  Object.keys(L.rows).forEach(function (p) {
    const r = L.rows[p];
    Object.keys(r.qd || {}).forEach(function (id) { dec[id] = r.qd[id]; });
    Object.keys(r.qs || {}).forEach(function (id) {
      const it = r.qs[id], qd = r.qd && r.qd[id];
      if (qd && (qd.d === 'done' || qd.d === '무시')) return;
      if (!ledgerQOpenState_(r.state) && !(qd && /^(보류|예정)$/.test(qd.d))) { dec[id] = { d: r.state === '무시' ? '무시' : 'done', at: String(r.at || '').slice(0, 10), text: String(it.text || '').slice(0, 200), note: '장부 ' + (r.label || p) + ' ' + r.state }; return; }
      items.push(Object.assign({}, it, { turn: ledgerQTurnOf_(r, nexOff), group: r.group || ledgerQGroup_(p), path: p }));
    });
    // GAS 질문이 붙지 않은 물음(서류 역할·서류 모순·넥스가 세운 물음)도 질문 목록에 — 세무사님이 AI 없이 GAS 화면만 쓰셔도 같은 물음을 보고 답한다(답은 장부 그 칸으로)
    if (!/^q:/.test(p) && ledgerQOpenState_(r.state) && !(r.qs && Object.keys(r.qs).some(function (id) { return !(r.qd && r.qd[id] && /^(done|무시)$/.test(r.qd[id].d)); }))) {
      const id = 'ledger:' + p;
      const opts = /\.role$/.test(p) && /^doc:/.test(p) ? LEDGER_DOC_ROLES_.map(function (x) { return { label: x, value: x }; }) : null;
      const en = ledgerEnumOf_(p);
      const it = { id: id, step: 'ledger', kind: r.state === '증빙받을것' ? 'missing' : 'judge', text: String((r.label || p) + ' — ' + (r.ask || '값을 정해 주세요')).slice(0, 300),
        ask: { mode: opts || en ? 'options' : 'choose', target: id, label: r.label || p, cands: (r.cands || []).map(function (x) { return { v: String(x.v), label: '', src: String(x.src || '') }; }), options: opts || (en ? LEDGER_ENUMS_[en].codes.map(function (k) { return { label: LEDGER_ENUMS_[en].ko[k], value: k }; }) : undefined), withInput: !opts && !en } };
      it._n = /^doc:/.test(p) ? -1000 : -1;
      it.turn = ledgerQTurnOf_(r, nexOff); it.group = r.group || ledgerQGroup_(p); it.path = p; // [2026.11.12 질문 정리 ①]
      if (r.qd && r.qd[id] && /^(보류|예정)$/.test(r.qd[id].d)) dec[id] = r.qd[id];
      items.push(it);
    }
  });
  items.sort(function (a, b) { return (a._n || 0) - (b._n || 0); });
  return { remaining: items.map(function (it) { const x = Object.assign({}, it); delete x._n; return x; }), decisions: dec };
}

// ── 화면·넥스용 한 묶음 ──
function ledgerView_(c) {
  const rows = ledgerRows_(c.id), L = ledgerLoad_(c.id);
  if (ledgerNexOff_(c.id)) rows.forEach(function (r) { if (r.turn) r.turn = '세무사님'; }); // [2026.11.12 질문 정리 ①]
  const by = {}; LEDGER_STATES_.forEach(function (s) { by[s] = []; });
  rows.forEach(function (r) { (by[r.state] || (by[r.state] = [])).push(r); });
  const calcs = (Array.isArray(c.세액계산결과) ? c.세액계산결과 : []).slice(-12).map(function (e) { return { id: e.id, 구분: e.구분, 세목: e.세목 || '', 이름: e.안 ? e.안.이름 : '기본 저장본', 최종세액: e.최종세액, 계산일: e.계산일 }; }); // [2026.10.30] 안 이름·id도(⑥ 자문과 맞대어 보게)
  return { ok: true, 사건: (c.사건명 || c.고객명 || '') + ' · ' + (c.세목 || ''), 요약: ledgerSummary_(c.id), 줄: rows, 상태별: by, 기록: (L.log || []).slice(-40), 계산저장본: calcs, 자문: ledgerAdvBrief_(c, L, true), 칸코드: LEDGER_ENUMS_, 서류역할: LEDGER_DOC_ROLES_, 바탕: ledgerKbView_(c.id, c), 흐름: ledgerFlowView_(c, L, rows), 도구카드: ledgerToolCard_(L), 물건: (function () { try { return ledgerObjList_(c, L); } catch (e) { return { ok: false, error: String(e && e.message || e) }; } })() }; // [2026.11.01 물건 장부] 📒 물건 탭
}

// [2026.10.31 J — 할 일 장부 4번 "도구 카드·성적표" / 세무사님 "한번에 몽땅 완전자동모드로 끝내라"]
//  넥스가 이 사건에서 부른 도구를 장부에 남긴다 — 도구 이름·성공/실패·실패 까닭·도구 부족 신고. 사건마다 "어느 도구를 썼고 어디서 막혔나"가 남아
//  다음 고칠 거리(빠진 도구·자주 실패하는 도구)를 찾는 바탕이 된다(토큰 0, 고객 값은 적지 않음 — 실패 까닭 앞부분만).
//  [2026.10.31 운영 확인] 장부 파일·전체 잠금(ledgerMutate_)에 쓰면 잠금이 바쁠 때 기록이 말없이 빠지고(가상 상속 자문 25번 중 3번만 남음),
//  도구를 부를 때마다 장부 전체를 다시 써 다른 저장과 잠금을 다퉜다 → 사건마다 따로 둔 도구 기록 파일(<사건ID>.도구.json)에 잠금 없이 쓴다(한 사건 대화는 한 줄로 차례차례 부르므로 겹쳐 쓰지 않음)
var LEDGER_TOOL_MEMO_ = {};

function ledgerToolFile_(caseId, create) {
  const folder = ledgerFolder_(), name = String(caseId).replace(/[^\w-]/g, '_') + '.도구.json', it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(name, '[]', 'application/json') : null;
}

function ledgerToolLogRead_(caseId) {
  const k = String(caseId || '');
  if (!k) return [];
  if (LEDGER_TOOL_MEMO_[k]) return LEDGER_TOOL_MEMO_[k];
  let log = [];
  try { const f = ledgerToolFile_(k, false); if (f) log = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '[]') || []; } catch (e) { log = []; }
  return (LEDGER_TOOL_MEMO_[k] = Array.isArray(log) ? log : []);
}

// 성적표 — 도구마다 부른 수·성공·실패·실패 까닭(셋까지)·마지막으로 부른 때, 그리고 도구 부족 신고. 많이 부른 도구부터
//  기록은 도구 기록 파일 + 예전에 장부 안(L.toolLog)에 남은 것(10-31 처음 배포분)
function ledgerToolCard_(L) {
  const old = (L && Array.isArray(L.toolLog)) ? L.toolLog : [];
  const log = old.concat(L && L.caseId ? ledgerToolLogRead_(L.caseId) : []), by = {};
  log.forEach(function (x) {
    const t = by[x.tool] || (by[x.tool] = { 도구: x.tool, 부름: 0, 성공: 0, 실패: 0, 실패까닭: [], 마지막: '' });
    t.부름++; t.마지막 = x.at || t.마지막;
    if (x.ok) t.성공++; else { t.실패++; if (x.why && t.실패까닭.indexOf(x.why) === -1 && t.실패까닭.length < 3) t.실패까닭.push(x.why); }
  });
  const tools = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.부름 - a.부름; });
  const fail = tools.reduce(function (s, t) { return s + t.실패; }, 0);
  const gaps = log.filter(function (x) { return x.gap; }).map(function (x) { return { 때: x.at, 모자람: x.gap }; }).slice(-20);
  return {
    부름: log.length, 도구수: tools.length, 실패: fail, 도구: tools.slice(0, 40), 모자람: gaps,
    줄: log.length ? '🧰 넥스 도구 ' + tools.length + '가지 ' + log.length + '번 부름 · 실패 ' + fail + '번' + (gaps.length ? ' · 도구 부족 신고 ' + gaps.length + '건' : '') : ''
  };
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
  return { ok: true, 사건: (c.사건명 || c.고객명 || ''), 흐름: fl, 물음: open, 칸: calc.slice(0, 80), AI비용: cost, 도구카드: (function () { const k = ledgerToolCard_(L); return { 줄: k.줄, 부름: k.부름, 실패: k.실패, 모자람: k.모자람.length }; })() };
}

// [2026.10.29 계획서 5단계] 사건 흐름 — 가설 → 사건개요 → 처리방향 → 확보할 증빙 → 서류 사실 → 칸 → 질문, 그리고 마지막 한 바퀴
function ledgerFlowView_(c, L, rows) {
  const ovRows = ledgerFlowRows_(L, 'ov').map(function (r) { const raw = (L.ov || {})[r.path] || {}; return Object.assign(r, { hypNote: raw.hypNote || '' }); });
  // 사건개요 중 칸 장부가 주인인 칸(사건분류·기준일·증여 칸)도 같은 표에 — 같은 값을 두 곳에 두지 않고 보여만 준다
  (rows || []).forEach(function (r) { if (/^(사건분류|기준일)$/.test(r.path) || /^g\./.test(r.path)) ovRows.push(Object.assign({}, r, { fromRows: true })); });
  // [2026.10.29 계획서 3판 4단계] 받는 곳(도구·세무사님·고객)과 도구로 이미 받았는지 — 보이기만(고객에게 보내지 않음)
  const ev = ledgerFlowRows_(L, 'ev').map(function (r) { const raw = (L.ev || {})[r.path] || {}, lb = (raw.v && raw.v.label) || r.label, where = ledgerEvWhere_(lb); return Object.assign(r, { 서류: raw.v || {}, owner: raw.src && raw.src.kind || '', 받는곳: where, 도구확보: where === '도구' ? ledgerEvToolHas_(L, lb) : '', 고객받음: raw.고객 && raw.고객.받음 ? raw.고객 : null }); });
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

// 계산기 칸 ↔ 같은 뜻의 서류 사실 종류(칸의 서식상 뜻과 사실 종류 이름으로만 — 사건 맞춤 아님). ③ 보기와 후보 붙이기(ledgerKbOffer_)가 같이 쓴다
var LEDGER_KB_KIND_OF_ = [[/^i\.debtAmount$/, /대출 잔액|채무|부채|대출 원금/], [/^i\.financialAmount$/, /^(예금 잔액|금융재산|잔고|예금)$/], [/^i\.funeralAmount$/, /장례/], [/^i\.nicheAmount$/, /봉안|자연장/], [/^i\.realEstateAmount$/, /공시가격|감정가액|매매사례/],
  [/(^|\.)totalPrice$/, /매매대금|거래 금액|등기 거래가액|양도가액/], [/acquisitionPrice$/, /매매대금|거래 금액|등기 거래가액|취득가액/], [/^g\.giftAmount$/, /공시가격|감정가액|매매사례|예금 잔액|이체 금액|금액/]];

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

// 사실 번호 — 같은 서류·같은 자리·같은 종류·같은 값이면 다시 모아도 같은 번호(칸이 가리키는 번호가 다시 모을 때마다 바뀌지 않게)
function ledgerKbFactId_(x) {
  const s = [x.f, x.w, x.k, x.v].join('|');
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return 's' + h.toString(36);
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

function ledgerKbSum_(kb) {
  const s = { 사실: (kb.facts || []).length, 파일: (kb.files || []).length, 서류종류: 0, 묶음: (kb.groups || []).length, 칸: (kb.links || []).length };
  const dts = {}; (kb.facts || []).forEach(function (f) { if (f.t) dts[f.t] = 1; }); s.서류종류 = Object.keys(dts).length;
  (kb.groups || []).forEach(function (g) { s['맞대기:' + g.st] = (s['맞대기:' + g.st] || 0) + 1; });
  (kb.links || []).forEach(function (l) { s['칸:' + l.res] = (s['칸:' + l.res] || 0) + 1; });
  (kb.files || []).forEach(function (f) { s['파일:' + (f.st || '?')] = (s['파일:' + (f.st || '?')] || 0) + 1; });
  return s;
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

// 층 묶음을 화면·넥스용 줄로
function ledgerFlowRows_(L, layer) { const m = (L && L[layer]) || {}; return Object.keys(m).map(function (p) { return ledgerRowOut_(p, m[p]); }); }

function ledgerPubKey_(loc) { return 'pub.' + String(loc || '').replace(/\s+/g, '').slice(0, 100); }

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
    add(loc, { p: 'a' + i, from: '장부 자산' + (Number(i) + 1) + ' 소재지(' + (rows[p].state === '추정' ? '추정' : (rows[p].src && rows[p].src.kind) || '') + ')', kind: kind === 'land' ? 'land' : (/building/.test(kind) || val('a' + i + '.assetType') === 'house') ? 'building' : '', /* [2026-11-13 4차 15] 주택이면 건축물대장도 */ area: Number(val('a' + i + '.assetArea')) || 0, jimok: String(val('a' + i + '.assetSubType') || ''),
      dates: dl(val('a' + i + '.acquisitionDate') || hd.acq, val('c' + cRef + '.date') || val('기준일') || hd.tr || c.기준일) });
  });
  try { if (typeof cpOutsidePropsFromOv_ === 'function') cpOutsidePropsFromOv_(c).forEach(function (q) { add(q.loc, { p: q.p, from: '처리개요 물건', kind: q.kind, area: q.area, jimok: q.jimok, dates: (q.dates || []).length ? q.dates : dl(hd.acq, hd.tr || c.기준일) }); }); } catch (e) {}
  (((L && L.hyp && L.hyp.claims) || [])).filter(function (x) { return x.f === '물건'; }).forEach(function (x) { add(x.v, { from: '의뢰서 등 가설 물건(' + (x.srcs || []).join('·').slice(0, 60) + (x.by === '넥스' ? ', 넥스 판단' : '') + ')', dates: dl(hd.acq, hd.tr || c.기준일) }); });
  return out;
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
// ============================================================
// [2026.10.30 복합 자문 — 세무사님 "권하는 안대로"(총괄관리자\복합자문사건_개선_계획서_20261030.md)]
// 세무사님 원문(10-30): "자문사건으로서 문의사항이 양도 상속 증여 모든 세목에 걸쳐서 질문이 10개이상 되는 복합 사건은 어떻게 처리되는지 점검하라" → "돌리지 말고 개선안을 마련하라" → "권하는 안대로"
//  사건 하나 = 주 세목(폴더 이름·신고용, 그대로) + 함께 보는 세목(L.taxes). 장부 칸 이름은 세목별로 이미 갈려 있다(c·a = 양도, g = 증여, i = 상속).
//  함께 보는 세목은 세무사님(📒 ⑥ 자문)과 넥스(case_ledger do=taxes)가 같은 함수로 정한다 — 세무사님이 정하신 목록은 넥스가 바꾸지 못한다.
// ============================================================
var LEDGER_TAX_CODES_ = ['transfer', 'gift', 'inheritance'];

function ledgerTaxCode_(x) { const s = String(x || '').trim(); const m = { 양도: 'transfer', 양도소득세: 'transfer', 증여: 'gift', 증여세: 'gift', 상속: 'inheritance', 상속세: 'inheritance' }; return LEDGER_TAX_CODES_.indexOf(s) !== -1 ? s : (m[s] || ''); }

// 주 세목 + 함께 보는 세목(양도·증여·상속만, 겹침 없이)
function ledgerTaxes_(c, L) {
  let more = []; try { more = (((L || ledgerLoad_(c.id)) || {}).taxes || {}).list || []; } catch (e) { more = []; }
  const out = []; [c && c.세목].concat(more).forEach(function (t) { t = ledgerTaxCode_(t) || String(t || ''); if (t && out.indexOf(t) === -1) out.push(t); });
  return out;
}

var LEDGER_ADV_KINDS_ = { 문의: 'inqs', 쟁점: 'issues', 대안: 'alts', 근거: 'basis', 위험: 'risks', 권고: 'recs', 보고서: 'reports' };

// 문의 답 현황 — 넥스가 보고서를 저장할 때 넥스에게만 돌려준다(GAS는 넥스 글에 아무것도 붙이지 않는다)
function ledgerInqStatus_(L) {
  const inq = ledgerAdvList_(L).문의 || [];
  const open = inq.filter(function (x) { return (x.status || '답 안 함') === '답 안 함'; });
  return { 수: inq.length, 답함: inq.filter(function (x) { return x.status === '답함'; }).length, 보류: inq.filter(function (x) { return x.status === '보류'; }).length, 자료기다림: inq.filter(function (x) { return x.status === '자료 기다림'; }).map(function (x) { return (x.no ? x.no + '. ' : '') + x.title; }), 답안함: open.map(function (x) { return (x.no ? x.no + '. ' : '') + x.title; }) };
}

function ledgerAdvList_(L) {
  const A = (L && L.adv) || {}, out = {};
  Object.keys(LEDGER_ADV_KINDS_).forEach(function (k) { out[k] = (A[LEDGER_ADV_KINDS_[k]] || []).filter(function (x) { return x && !x.removed; }); });
  return out;
}

// 넥스·화면이 보는 자문 장부 요약 — 항목마다 제목·상태·누가·잇는 저장본(그 저장본의 이름·세액은 사건 계산 결과에서 바로 붙임)
function ledgerAdvBrief_(c, L, full) {
  const lists = ledgerAdvList_(L || ledgerLoad_(c.id)), calcs = Array.isArray(c.세액계산결과) ? c.세액계산결과 : [];
  // [2026.11.02 쪼개 처리 ①] 계산 저장본뿐 아니라 계획(pl…)·판정(judge.…)·조회(pub.…) 결과도 인용할 수 있게 — 같은 풀이를 이음(links)에도 쓴다
  const L0 = L || ledgerLoad_(c.id), rz = ledgerRefResolver_(c, L0);
  const cite = function (id) { const e = calcs.filter(function (x) { return x && String(x.id) === String(id); })[0]; if (e) return { id: e.id, 이름: e.안 ? e.안.이름 : '기본 저장본', 세목: e.세목, 최종세액: e.최종세액 }; const g = rz(id); return g.종류 !== '모름' ? g : { id: id, 없음: '사건에 이 저장본·계획·판정·조회 결과가 없음' }; };
  const out = {};
  Object.keys(lists).forEach(function (k) { out[k] = lists[k].map(function (x) { const o = { id: x.id, 제목: x.title, 상태: x.status || '', 누가: x.by || '' }; if (x.no) o.번호 = x.no; if (x.tax && x.tax.length) o.세목 = x.tax.map(function (t) { return (typeof CASEPROC_TAX_LABEL_ !== 'undefined' && CASEPROC_TAX_LABEL_[t]) || t; }); if (x.answer) o.답 = String(x.answer).slice(0, 300); if (x.text) o.내용 = String(x.text).slice(0, 300); if (x.calc && x.calc.length) o.저장본 = x.calc.map(cite); if (x.refs && x.refs.length) o.근거 = x.refs; if (x.links && x.links.length) { o.이음 = x.links; o.이음풀이 = x.links.map(function (id) { const e = calcs.filter(function (y) { return y && String(y.id) === String(id); })[0]; return e ? { id: id, 종류: '계산', 이름: e.안 ? e.안.이름 : '기본 저장본' } : rz(id); }); } if (x.file) o.파일 = x.file; if (x.cite) o.근거확인 = { 때: x.cite.at, 수: x.cite.수, 없음: x.cite.bad || [], 목록: citeBriefList_(x.cite.items, full) }; return o; }); });
  // [2026.10.30] 근거 칸 전체 대조 결과(🔎 근거 확인) — 화면·넥스가 같은 것을 본다
  try { const bc = ((L || ledgerLoad_(c.id)).adv || {}).basisCite; if (bc) out.근거칸확인 = { 때: bc.at, 수: bc.수, 목록: citeBriefList_(bc.items, full) }; } catch (e) { }
  // [2026.10.30 복합 자문] 주 세목·함께 보는 세목과 문의 답 현황 — 화면(📒 ⑥)·넥스가 같은 것을 본다
  try { const L1 = L || ledgerLoad_(c.id), lb = function (t) { return (typeof CASEPROC_TAX_LABEL_ !== 'undefined' && CASEPROC_TAX_LABEL_[t]) || t; }, tx = L1.taxes || {};
    out.세목 = { 주: lb(c.세목), 함께: (tx.list || []).map(lb), 코드: ledgerTaxes_(c, L1), 누가: tx.by || '', 때: tx.at || '' };
    out.문의현황 = ledgerInqStatus_(L1); } catch (e) { }
  // [2026.11.02 쪼개 처리 ②·⑤·⑦] 물건별 모아 보기 · 쟁점별 처리 점검(쟁점·대안 상태 셈 포함) — 화면(📒 ⑥)·넥스가 같은 것을 본다
  try { out.물건별 = ledgerAdvByObject_(L0, lists); } catch (e) { out.물건별 = { 오류: e.message }; }
  try { out.처리점검 = ledgerAdvGaps_(lists); } catch (e) { out.처리점검 = { 오류: e.message }; }
  return out;
}

// [2026.11.02 쪼개 처리 ①·②] 이음·인용에 적힌 id를 풀어 무엇인지 알려 준다 — 자문 항목·물건·사람·지난 이전·계획·판정·조회·장부 칸
function ledgerRefResolver_(c, L) {
  L = L || {};
  let F = null; const fam = function () { if (F === null) { try { F = (typeof famLoad_ === 'function' && typeof famKeyOf_ === 'function') ? (famLoad_(famKeyOf_(c)) || {}) : {}; } catch (e) { F = {}; } } return F; };
  const advAll = []; try { const A = L.adv || {}; Object.keys(LEDGER_ADV_KINDS_).forEach(function (k) { (A[LEDGER_ADV_KINDS_[k]] || []).forEach(function (x) { if (x && !x.removed) advAll.push({ k: k, x: x }); }); }); } catch (e) { }
  return function (id0) {
    const id = String(id0 == null ? '' : id0).trim();
    const a = advAll.filter(function (y) { return y.x.id === id; })[0];
    if (a) return { id: id, 종류: '자문 ' + a.k, 이름: a.x.title, 상태: a.x.status || '' };
    const o = ((L.obj && L.obj.list) || []).filter(function (y) { return y && y.id === id; })[0];
    if (o) { const f = o.f || {}; return { id: id, 종류: '물건', 이름: [f.종류, f.소재지, f.동 ? f.동 + '동' : '', f.호 ? f.호 + '호' : ''].filter(Boolean).join(' ') || id, 판정: o.판정 ? (o.판정.묶음들 || [o.판정]).map(function (j) { return j.표시; }) : [] }; }
    const jk = id.replace(/^judge\./, '');
    if (L.judge && L.judge[jk]) { const j = L.judge[jk]; return { id: id, 종류: '판정', 이름: j.표시 || jk, 결론: j.결론, 잠정: !!j.잠정, 때: j.때 || '' }; }
    if (L.pub && L.pub[id]) { const p = L.pub[id]; return { id: id, 종류: '조회', 이름: p.label || id, 때: p.at || '' }; }
    if (L.rows && L.rows[id]) { const r = L.rows[id]; return { id: id, 종류: '장부 칸', 이름: (r.src && r.src.label) || id, 값: typeof ledgerValueText_ === 'function' ? ledgerValueText_(id, r.v) : String(r.v), 상태: r.state || '' }; }
    {
      const G = fam();
      const pl = (G.계획 || []).filter(function (y) { return y && y.id === id; })[0];
      if (pl) return { id: id, 종류: '계획', 이름: pl.이름 || id, 때: pl.때 || '' };
      const ps = (G.사람 || []).filter(function (y) { return y && y.id === id; })[0];
      if (ps) return { id: id, 종류: '사람', 이름: ps.이름 + (ps.관계 ? '(' + ps.관계 + ')' : '') };
      const tr = (G.이전 || []).filter(function (y) { return y && y.id === id; })[0];
      if (tr) return { id: id, 종류: '지난 이전', 이름: [tr.날짜, tr.종류, tr.물건].filter(Boolean).join(' ') };
    }
    return { id: id, 종류: '모름', 이름: id };
  };
}

// [2026.11.02 쪼개 처리 ②] 물건마다 — 그 물건에 이어진 자문 항목과 판정을 한자리에(이음에 물건 id를 적으면 모인다)
function ledgerAdvByObject_(L, lists) {
  const objs = ((L && L.obj && L.obj.list) || []).filter(function (o) { return o && o.state !== '지움'; });
  return objs.map(function (o) {
    const f = o.f || {}, items = [];
    Object.keys(lists).forEach(function (k) { lists[k].forEach(function (x) { if ((x.links || []).indexOf(o.id) !== -1) items.push(k + ' ' + x.id + ' ' + x.title + (x.status ? '(' + x.status + ')' : '')); }); });
    const jd = Object.keys((L && L.judge) || {}).filter(function (k) { return k.indexOf('@' + o.id) !== -1; }).map(function (k) { return L.judge[k].표시; });
    const oj = o.판정 ? (o.판정.묶음들 || [o.판정]).map(function (j) { return j.표시; }) : [];
    return { id: o.id, 이름: [f.종류, f.소재지, f.동 ? f.동 + '동' : '', f.호 ? f.호 + '호' : ''].filter(Boolean).join(' ') || o.id, 판정: oj.concat(jd.filter(function (t) { return oj.indexOf(t) === -1; })), 자문: items, 빈곳: items.length ? '' : '이 물건에 이어진 쟁점·대안이 없음 — 물건마다 쟁점을 적고 links에 물건 id를 넣는다' };
  });
}

// [2026.11.02 쪼개 처리 ⑤·⑦] 쟁점 하나씩 끝까지 갔나 — 쟁점마다 대안·계산 저장본·권고가 이어졌나, 문의가 쟁점에 이어졌나, 상태 셈
function ledgerAdvGaps_(lists) {
  const iss = lists.쟁점 || [], alts = lists.대안 || [], recs = lists.권고 || [], inqs = lists.문의 || [];
  const linked = function (arr, id) { return arr.filter(function (x) { return (x.links || []).indexOf(id) !== -1; }); };
  const rows = iss.map(function (s) {
    const al = linked(alts, s.id), alIds = al.map(function (a) { return a.id; });
    const calcN = (s.calc || []).length + al.reduce(function (n, a) { return n + (a.calc || []).length; }, 0);
    const rc = recs.filter(function (r) { return (r.links || []).some(function (l) { return l === s.id || alIds.indexOf(l) !== -1; }); });
    const gap = [];
    if (!al.length) gap.push('대안 없음');
    if (!calcN) gap.push('계산 저장본 없음');
    if (!rc.length) gap.push('권고 없음');
    if (rc.length && !rc.some(function (r) { return (r.calc || []).length; }) && calcN) gap.push('권고가 저장본을 잇지 않음');
    return { id: s.id, 쟁점: s.title, 상태: s.status || '(없음)', 대안: al.length, 저장본: calcN, 권고: rc.length, 빈곳: gap };
  });
  const issIds = iss.map(function (s) { return s.id; });
  const inqLoose = inqs.filter(function (q) { return !(q.links || []).some(function (l) { return issIds.indexOf(l) !== -1; }); }).map(function (q) { return (q.no ? q.no + '. ' : '') + q.title; });
  const cnt = function (arr) { const m = {}; arr.forEach(function (x) { const st = x.status || '(없음)'; m[st] = (m[st] || 0) + 1; }); return m; };
  return { 쟁점별: rows, 덜된쟁점: rows.filter(function (r) { return r.빈곳.length; }).length, 쟁점에안이은문의: inqLoose, 상태셈: { 쟁점: cnt(iss), 대안: cnt(alts) } };
}

// ============================================================
// [2026.11.01 물건 장부] 세무사님 원문(11-01): "물건별로 구분하여 관리가 가능하도록 당연히 수정되어야 한다" — 계획서 물건장부_1주택판정 1절
//  사건 장부에 세목과 상관없는 「물건 목록」(L.obj)을 둔다 — 한 줄 = 물건 하나(같은 건물 다른 호수는 다른 줄). 이 세대가 가진 물건 전부를 적는 바탕이고,
//  양도 계산에 들어갈 물건은 여기서 골라 자산 칸(a0.…)으로 보낸다(ledgerObjSell_). 1세대1주택 판정 도구는 이 목록으로 주택 수를 세고 줄마다 판정(판정 칸)을 남긴다.
//  예전엔 의뢰 글에서 같은 종류·같은 글을 하나로 합쳐(출처만 덧붙임) 같은 넓이 오피스텔 세 칸이 한 줄로 남았고, 주소 없이 개수만 적힌 말(「오피스텔 다섯 칸」)은 물건이 되지 않았다.
//  규칙: ① 같은 물건은 소재지·동·호수가 같을 때만 — 같은 글이 되풀이된 것은 출처만 합친다(개수를 줄이지 않음)
//        ② 개수만 있는 말은 「소재지 모름」 줄을 그 개수만큼(같은 종류의 주소 있는 줄은 그 개수에서 뺀다), 받을 서류에 줄마다 등기부·건축물대장
//        ③ 칸마다 주인(세무사님 > 넥스 > 규칙) — 낮은 급은 높은 급이 적은 칸을 덮지 못한다(사건 장부 칸과 같은 규칙)
//        ④ 의뢰 글에서 규칙이 세운 줄은 그 글이 사라지면 빠진다(사람·넥스가 손댄 줄은 남음) — 다시 돌려도 같은 줄
// ============================================================
var LEDGER_OBJ_FIELDS_ = ['소유자', '지분', '종류', '쓰임', '소재지', '동', '호', '취득일', '취득원인', '면적', '주택수', '주택수근거', '쓸곳', '자산', '메모'];

var LEDGER_OBJ_ENUM_ = { 쓰임: ['주거', '업무', '모름'], 주택수: ['든다', '안 든다', '모름'], 쓸곳: ['', '양도', '증여', '상속', '보유'] };

function ledgerObjState_(row) {
  const f = row.f || {}, own = row.own || {};
  if (!f.소재지) return '모름';
  const hard = function (k) { return /^(세무사님|서류)$/.test(own[k] || ''); };
  return hard('소재지') && hard('종류') ? '정함' : '추정';
}

function ledgerObjOut_(row, i) {
  const o = { id: row.id, 번호: i + 1, 상태: row.state || ledgerObjState_(row), 출처: (row.srcs || []).map(function (s) { return (s.file || s.kind) + (s.quote ? ' "' + s.quote + '"' : ''); }).slice(0, 6), 칸주인: row.own || {} };
  LEDGER_OBJ_FIELDS_.forEach(function (k) { if (row.f && row.f[k] !== undefined && row.f[k] !== '') o[k] = row.f[k]; });
  if (row.판정) o.판정 = row.판정;
  return o;
}

// 보기 — 화면(📒 물건 탭)·넥스(case_ledger do=objects)가 같은 것을 본다
function ledgerObjList_(c, L) {
  L = L || ledgerLoad_(c.id);
  const list = ((L.obj && L.obj.list) || []).map(ledgerObjOut_);
  const cnt = function (v) { return list.filter(function (o) { return o.주택수 === v; }).length; };
  return { ok: true, 물건: list, 요약: { 줄: list.length, 소재지모름: list.filter(function (o) { return !o.소재지; }).length, 주택수: { 든다: cnt('든다'), 모름: cnt('모름'), 안든다: cnt('안 든다') } }, 칸: LEDGER_OBJ_FIELDS_, 고르기: LEDGER_OBJ_ENUM_ };
}

// ============================================================
// [2026.11.01 종합판정 ①] 비과세·공제·감면 종합판정 — 「1세대1주택」 묶음을 사건 장부에 잇는 길(화면 세액계산 「판정」·넥스 judge_tax_relief·case_ledger do=judge가 같은 함수)
// ------------------------------------------------------------
// 세무사님 원문(11-01): "판정내용이 당연히 연결 … 잠정이면 종합검토결과에 1세대1주택-잠정" / "비과세공제감면 종합판정도구 라고 해야하는 거 같다"
// 계획서: 총괄관리자\_기록\종합판정도구_1_1세대1주택_계획서_20261101.html(5절 잇기). 셈은 엔진 judgeTaxReliefJS 하나 — 여기서는 장부에서 사실을 모아 넘기고 결과를 칸에 적을 뿐.
//  ① 사실: 장부 칸(a?·c?·seller) + 물건 장부(L.obj, 있으면) + 이번에 받은 사실(input — 넥스·화면이 알려 준 세대·특례·다른 물건). 물건 장부가 없고 다른 물건도 안 받았으면
//     "다른 보유 주택 — 모름" 한 줄을 넣어 잠정으로 둔다(이 주택 하나만 보고 비과세라 하지 않음).
//  ② 취득 당시 조정대상지역: 받은 값이 없으면 조정대상지역 도구(caseProcAdjAreaAt_ '거주' — 시행령 §154② 표 포함)로 소재지·취득일을 본다.
//  ③ 결과는 a?.isOneHouseOneFamily 칸에 규칙(GAS) 값으로 — 잠정이면 추정. 세무사님·넥스가 정한 값은 덮지 않고(장부 규칙 ①②) 다르면 알림만.
//     칸의 근거(why)는 "종합판정 1세대1주택 — … 잠정(남은 것: …)" — 검토서 "추가로 확인할 사항"·처리개요가 이 글을 그대로 보인다(ledgerReviewNotes_).
//  ④ 물건 장부가 있으면 그 물건 줄의 판정(row.판정 — 대표 결과 + 묶음들)도 적는다. 사건 단위 판정 저장소는 새로 만들지 않는다(읽고 쓰는 길 전부에 넣어야 하므로).
// ============================================================
var LEDGER_JUDGE_TAG_ = '종합판정 ';

// 검토서·처리개요가 판정 줄을 보일 때 — 판정 줄은 근거 글(why)이 곧 "1세대1주택 — 비과세 — 잠정(남은 것: …)"
function ledgerJudgeLabel_(r) { return r && String(r.why || '').indexOf(LEDGER_JUDGE_TAG_) === 0 ? String(r.why).slice(LEDGER_JUDGE_TAG_.length) : ''; }

// 장부 요약에 싣는 목록 — 화면(full)은 전부, 넥스 요약은 ✅가 아니거나 결론이 붙은 것만(토큰 절약)
function citeBriefList_(items, full) {
  const a = Array.isArray(items) ? items : [];
  return full ? a : a.filter(function (x) { return x && (x.표시 !== '✅' || x.결론); }).slice(0, 20);
}

/**
 * 스크립트 속성에 폴더/파일 ID를 넣을 때, 구글드라이브 "링크 복사"로 얻은 전체 주소를
 * 그대로 붙여넣어서 끝에 "?usp=drive_link" 같은 꼬리표가 같이 들어가는 실수가 흔하다
 * (실제로 이 문제 때문에 업무관리자 폴더 연결이 계속 조용히 실패하고 있었다 — DriveApp.
 * getFolderById()는 순수 ID만 받아들이고, 꼬리표가 붙어 있으면 그냥 오류를 내며 null로
 * 처리돼버려서 겉으로는 "설정 안 한 것"과 똑같아 보였다). 전체 링크가 들어와도, 순수 ID만
 * 들어와도 항상 깨끗한 ID 하나만 뽑아내서 이런 실수를 자동으로 허용한다.
 */
function sanitizeDriveId_(raw) {
  if (!raw) return raw;
  let s = String(raw).trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) || s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return s.split('?')[0].split('#')[0].split('/')[0].trim();
}

/**
 * 같은 파일(fileId)을 여러 기기·탭에서 거의 동시에 저장할 때 뒤에 쓰는 쪽이
 * 앞선 내용을 통째로 덮어써버리는 문제(레이스컨디션)를 막기 위한 잠금 헬퍼.
 * 최대 waitMs만큼 대기하다가 잠금을 못 얻으면 { error: ... } 를 돌려주고,
 * 잠그는 데 성공하면 fn()을 실행한 뒤 반드시 잠금을 해제한다.
 */
function withLock_(waitMs, fn) {
  const lock = LockService.getScriptLock();
  // [2026.10.16] 잠금을 쥔 작업 이름·시각을 남겨, 막혔을 때 "무엇이 쥐고 있는지" 알린다(📥 수정 반영이 이유 없이 거듭 막혔음)
  let holder = '';
  try { holder = (String(new Error().stack || '').split('\n').map(function (l) { const m = /at\s+([A-Za-z_$][\w$]*)/.exec(l); return m ? m[1] : ''; }).filter(function (n) { return n && n !== 'withLock_' && n !== 'Error'; })[0]) || ''; } catch (e) {}
  try {
    lock.waitLock(waitMs || 8000);
  } catch (err) {
    let who = '';
    try { const h = JSON.parse(CacheService.getScriptCache().get('nx_lock_holder') || 'null'); if (h) who = ' (지금 잠금을 쥔 작업: ' + h.who + ', ' + Math.round((Date.now() - h.at) / 1000) + '초째)'; } catch (e) {}
    return { error: '다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도해주세요.' + who };
  }
  try { CacheService.getScriptCache().put('nx_lock_holder', JSON.stringify({ who: holder || '알 수 없음', at: Date.now() }), 600); } catch (e) {}
  try {
    return fn();
  } finally {
    try { CacheService.getScriptCache().remove('nx_lock_holder'); } catch (e) {}
    lock.releaseLock();
  }
}

const BUSINESS_MANAGER_FOLDER_ID_PROPERTY = 'BUSINESS_MANAGER_FOLDER_ID';

function getBusinessManagerFolder_() {
  const id = sanitizeDriveId_(lightProps_().getProperty(BUSINESS_MANAGER_FOLDER_ID_PROPERTY));
  if (!id) return null;
  try {
    const folder = DriveApp.getFolderById(id);
    // [2026-08-01 정비] BUSINESS_MANAGER_FOLDER_ID는 "업무관리자" 폴더 자체가 아니라 그
    // 한 단계 위("0 NETAX")를 가리키도록 설정돼 있다(세무사님 확인, 2026.07 — 아래
    // getNetaxRootFolder_ 주석 참고). 그런데 이 사실을 반영한 보정 로직이 getCaseTemplateFolder_
    // 에만 있고, 정작 이 함수를 직접 쓰는 toolListBusinessManagers/toolLoadBusinessManager/
    // toolAuditBusinessManagers(야간점검)/toolProposeNewBusinessManager 4곳은 "0 NETAX"
    // 바로 밑에서 .md 파일을 찾고 있었다 — 실제 파일은 그 안의 "업무관리자" 하위폴더에 있어서
    // 에러 없이 그냥 항상 "없음"으로만 나오는 상태였다. 여기서 한 번에 보정해서 4곳 모두 고친다.
    const nested = folder.getFoldersByName('업무관리자');
    return nested.hasNext() ? nested.next() : folder;
  } catch (err) {
    return null;
  }
}

// ===== 총괄관리자 폴더 (체크리스트·개선요구사항·점검리포트·생성파일을 여기서 다 주고받는다) =====
const CHIEF_MANAGER_FOLDER_ID_PROPERTY = 'CHIEF_MANAGER_FOLDER_ID';

function getChiefManagerFolder_() {
  const id = sanitizeDriveId_(lightProps_().getProperty(CHIEF_MANAGER_FOLDER_ID_PROPERTY));
  if (!id) return null;
  try {
    return DriveApp.getFolderById(id);
  } catch (err) {
    return null;
  }
}

function getOrCreateSubfolder_(parent, name) {
  const iter = parent.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parent.createFolder(name);
}

// 파일이 있으면 내용을 그대로, 없으면 null을 돌려준다(오류로 취급하지 않음 — 아직 안 만든 파일일 수 있어서).
function readFileIfExists_(folder, name) {
  const iter = folder.getFilesByName(name);
  if (!iter.hasNext()) return null;
  return iter.next().getBlob().getDataAsString('UTF-8');
}

// 같은 이름 파일 있으면 덮어쓰고, 없으면 새로 만든다.
function writeFileOverwrite_(folder, name, content, mimeType) {
  const iter = folder.getFilesByName(name);
  if (iter.hasNext()) {
    const f = iter.next();
    f.setContent(content);
    return f;
  }
  return folder.createFile(Utilities.newBlob(content, mimeType || 'text/plain', name));
}

const AI_COST_SHEET_PROP_ = 'AI_COST_SHEET_ID';

const AI_COST_HEAD_ = ['시각', '사건ID', '사건명', '대화ID', '종류', '모델', '새로 읽은 글(토큰)', '캐시 쓰기(토큰)', '캐시 읽기(토큰)', '쓴 글(토큰)', '새로 읽기(원)', '캐시 쓰기(원)', '캐시 읽기(원)', '쓴 글(원)', '그 밖(원)', '합계(원)', '단계', '말씀 앞부분'];

// 한 사건의 비용 합계·호출 목록 — 처리개요 사건 장부(case_proc step 'aiCost')·넥스 case_status가 같은 것을 본다(토큰 0, 시트 읽기만)
function aiCostCaseSummary_(caseId, opt) {
  const id = String(caseId || '').trim();
  const out = { ok: true, caseId: id, n: 0, won: 0, byKind: {}, parts: { 새로읽기: 0, 캐시쓰기: 0, 캐시읽기: 0, 쓴글: 0, 그밖: 0 }, rows: [] };
  if (!id) return out;
  let ss = null;
  try { const sid = lightProps_().getProperty(AI_COST_SHEET_PROP_); if (sid) ss = SpreadsheetApp.openById(sid); } catch (e) { ss = null; }
  if (!ss) return Object.assign(out, { note: '아직 기록이 없습니다(비용 기록 시트가 없음).' });
  ss.getSheets().forEach(function (sh) {
    if (!/^\d{4}-\d{2}$/.test(sh.getName()) || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, AI_COST_HEAD_.length).getValues().forEach(function (r) {
      if (String(r[1]) !== id) return;
      const w = +r[15] || 0;
      out.n++; out.won += w;
      out.byKind[r[4]] = Math.round(((out.byKind[r[4]] || 0) + w) * 10) / 10;
      out.parts.새로읽기 += +r[10] || 0; out.parts.캐시쓰기 += +r[11] || 0; out.parts.캐시읽기 += +r[12] || 0; out.parts.쓴글 += +r[13] || 0; out.parts.그밖 += +r[14] || 0;
      if (opt && opt.rows) out.rows.push({ 시각: r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(r[0]), 종류: r[4], 모델: r[5], 새로읽은글: r[6], 캐시쓰기: r[7], 캐시읽기: r[8], 쓴글: r[9], 원: w, 단계: r[16], 말씀: r[17] });
    });
  });
  out.won = Math.round(out.won * 10) / 10;
  Object.keys(out.parts).forEach(function (k) { out.parts[k] = Math.round(out.parts[k] * 10) / 10; });
  out.line = out.n ? '🤖 이 사건 AI 비용 누적 ' + aiCostWon_(out.won) + '(' + Object.keys(out.byKind).map(function (k) { return k + ' ' + aiCostWon_(out.byKind[k]); }).join(' · ') + ') — 그중 다시 읽기 ' + aiCostWon_(out.parts.캐시읽기) + ' · 새로 읽기·저장 ' + aiCostWon_(out.parts.새로읽기 + out.parts.캐시쓰기) + ' · 쓴 글 ' + aiCostWon_(out.parts.쓴글) + (out.parts.그밖 >= 1 ? ' · 그 밖 ' + aiCostWon_(out.parts.그밖) : '') + ' (' + out.n + '번 호출)' : '🤖 이 사건 AI 비용 기록 없음(10-30 기록을 시작한 뒤 아직 AI를 부르지 않음)';
  if (opt && opt.rows) out.rows = out.rows.slice(-300);
  return out;
}

function aiCostWon_(w) { return Math.round(+w || 0).toLocaleString('ko-KR') + '원'; }

// ④ 오늘 할 일 — 대시보드 맨 위·휴대폰 창구·현황판이 같은 목록을 본다
function todoList_() {
  // [2026-11-13 느림 ②(나)] 세무사님 "권장대로" — 할 일 조회가 12~16초(서버 바닥 약 6.6초 제외 약 6초). 부분마다 걸린 시간을 _ms에 남겨 어디서 드는지 잰다(화면은 _ms를 안 씀)
  nxPropsMirrorEnsure_(); // [2026-11-13] 관리 서버가 거울을 못 찾아 넘겨 왔을 수 있음 — 6시간에 한 번 적어 둠
  const _t0 = Date.now(), _ms = {}; let _tp = _t0; const _lap = function (k) { const n = Date.now(); _ms[k] = n - _tp; _tp = n; };
  const tz = 'Asia/Seoul', today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), in3 = Utilities.formatDate(new Date(Date.now() + 3 * 86400000), tz, 'yyyy-MM-dd');
  let cases = []; try { const r = work_getCases({}); const o = r && r.getContent ? JSON.parse(r.getContent()) : r; cases = (o && o.cases) || []; } catch (e) { cases = []; } _lap('사건목록');
  const open = cases.filter(function (c) { return c.상태 !== '완료'; });
  const pick = function (c) { return { caseId: c.id, 사건: String(c.사건명 || c.고객명 || ''), 법정일: String(c.법정일 || '') }; };
  const out = { at: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'), 마감: [], 지남: [], 오늘예약: [], 넥스질문: [], 고객서류: [], 확인요청: 0, 긴급요청: 0, 카카오오류: 0, 알림대기: [] };
  open.filter(function (c) { return c.상태 !== '보류' && c.법정일 && !/상담|자문/.test(String(c.업무유형 || '')); }).sort(function (a, b) { return String(a.법정일).localeCompare(String(b.법정일)); }).forEach(function (c) { // [2026.10.31] 세무사님 "권장안대로" — 상담·자문은 법정 신고기한이 없어 '기한 지남·마감'에서 뺀다(그 날짜는 약속일)
    if (c.법정일 < today) out.지남.push(pick(c)); else if (c.법정일 <= in3) out.마감.push(pick(c));
  });
  try {
    const r = booking_getBookings(); const o = r && r.getContent ? JSON.parse(r.getContent()) : r;
    // [2026.11.12 밤] 세무사님 "오늘예약 1이라고 되어있어 클릭하니까 처리할 예약이 없다고 하네. 처리할 예약도 없는데 거기에 왜 띄우나?" —
    //  예전엔 오늘 날짜 예약을 거절·취소만 빼고 다 셌다(이미 상담완료·노쇼·사건접수한 예약까지). 이제 예약·상담 「처리할 것」과 같은 잣대(booking.html bookingKindRaw_):
    //  신청 상태이거나, 확정인데 결과(상담완료·노쇼)도 사건 잇기도 안 한 것만.
    ((o && o.bookings) || []).filter(function (b) { return b.reservedDate === today && (b.status === '신청' || (b.status === '확정' && !b.caseId && !b.result)); }).forEach(function (b) {
      const c = b.caseId ? open.filter(function (x) { return x.id === b.caseId; })[0] : null;
      out.오늘예약.push({ 시각: b.reservedTime, 이름: String(b.name || ''), caseId: b.caseId || '', 사건: c ? String(c.사건명 || '') : '' });
    });
    out.오늘예약.sort(function (a, b) { return String(a.시각).localeCompare(String(b.시각)); });
    // [2026.10.30 예약 결과 관리] 날짜가 지났는데 결과를 안 적은 확정 예약 + 밤 점검이 찾은 연결 후보가 있는 예약(사건에 안 이은 것)
    // [2026.11.12 밤] 예약·상담 화면처럼 2주 넘게 지난 것은 「지난 기록」(BOOKING_STALE_DAYS_ 14) — 대시보드도 세지 않는다(누르면 「처리할 것」에 없다고 나오던 어긋남)
    const bkStale = Utilities.formatDate(new Date(Date.now() - 14 * 86400000), tz, 'yyyy-MM-dd');
    out.예약결과 = ((o && o.bookings) || []).filter(function (b) { return b.status === '확정' && !b.caseId && !(b.reservedDate && b.reservedDate < bkStale) && ((!b.result && b.reservedDate && b.reservedDate < today) || (b.linkCandidates && b.linkCandidates.length)); }).length;
  } catch (e) {}
  // [2026.11.12 넥스 질문 정리 계획서 ④ — 세무사님 "날짜제한을 둔 자체가 바보짓이고, 이게 급한 일로 분류해야 하는지도 의문"] 넥스 질문은 급한 일이 아니다 —
  //  장부 열린 칸은 GAS가 못 푼 것을 넥스가 먼저 보고(cpNexQuestionWake_), 남은 것만 그 사건 안(사실 장부 ④ 물어볼 것)에서 묶음으로 여쭙는다. 여기(대시보드·휴대폰 창구·현황판)에는 싣지 않는다.
  //  (예전엔 수정일 날짜 값을 글자로 비교해 14일 거름이 죽어 시트 앞 12건만 보였다 — 실상 점검서 20261112)
  _lap('예약');
  try { out.고객서류 = custUploadsRecent_(3).slice(0, 10); } catch (e) {} _lap('고객서류');
  try { const ra = commRequestsAll_(); out.확인요청 = ra.open.filter(function (r) { return r.status === '반영됨'; }).length; out.긴급요청 = ra.open.filter(function (r) { return r.urgent && /접수|재오픈/.test(r.status); }).length; } catch (e) {}
  _lap('개선요구');
  try { out.카카오오류 = kakaoErrorsRecent_(3).length; } catch (e) {} _lap('카카오');
  try { out.알림대기 = notifyLog_().filter(function (x) { return x.status === '대기' && !/^넥스 긴급 신고/.test(String(x.text || '')); }).slice(0, 10); } catch (e) {} // [2026.10.31] 넥스 기능 부족 신고는 개선요구 🚨(긴급 요청 칩)과 겹쳐 뺌
  _lap('알림'); _ms.합계 = Date.now() - _t0; out._ms = _ms;
  return out;
}

// ⑤ 알림에서 바로 답하기 — 급한 알림 문자 끝에 job.netax.kr/m/?a=번호, 누르면 확인/보류/나중에
const NOTIFY_LOG_PROP_ = 'NX_NOTIFY_LOG';

// [2026-11-13 job 서버 나누기] 세무사님 "권장대로"(docs/_기록/job서버_나누기_계획서_20261113.html) — 관리 서버(gs-light)가 오늘 할 일·장부를 대신 읽을 때
//  job 서버의 스크립트 속성을 볼 수 없어서, 그 길이 읽는 넷(알림 기록·총괄관리자 폴더·업무관리자 폴더·AI 비용 시트 — 비밀 열쇠 없음)을 총괄관리자 폴더의 _속성거울.json에 적어 둔다.
//  알림 기록이 바뀔 때마다(notifyLogAdd_·notifyAnswer_) 다시 적고, 오늘 할 일을 job 서버가 답할 때 6시간에 한 번 확인한다(관리 서버가 거울을 못 찾으면 job 서버로 넘기므로 저절로 채워짐).
function nxPropsMirrorWrite_() {
  try {
    const p = lightProps_(), props = {};
    ['NX_NOTIFY_LOG', 'CHIEF_MANAGER_FOLDER_ID', 'BUSINESS_MANAGER_FOLDER_ID', 'AI_COST_SHEET_ID'].forEach(function (k) { const v = p.getProperty(k); if (v != null) props[k] = v; });
    const root = getChiefManagerFolder_(); if (!root) return;
    writeFileOverwrite_(root, '_속성거울.json', JSON.stringify({ at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'), props: props }), 'application/json');
    CacheService.getScriptCache().put('nx_props_mirror_ok', '1', 21600);
  } catch (e) { console.log('속성 거울 적기 실패: ' + (e && e.message || e)); }
}

function nxPropsMirrorEnsure_() { try { if (CacheService.getScriptCache().get('nx_props_mirror_ok')) return; } catch (e) {} nxPropsMirrorWrite_(); }

function notifyLog_() { try { return JSON.parse(lightProps_().getProperty(NOTIFY_LOG_PROP_) || '[]'); } catch (e) { return []; } }

/**
 * "개선요구사항.md"에 조종호님이 새로 적어둔 내용을 읽어서, 각 항목별로 어느 파일을 건드려야
 * 하는지 · 무엇을 어떻게 고치면 되는지 실행 지침을 정리해 총괄관리자/"_생성파일"에 저장한다.
 * 실제 코드 수정은 하지 않는다 — 방향을 잡아주는 메모만 만든다. 진짜 수정은 이 메모를 들고
 * 대화 세션에서(예: 오늘 report-writer 법령링크 사고를 고친 방식) 하는 게 원칙이다.
 *
 * [2026-08-01 정비 — 두 번째] 처음엔 파일 전체를 통째로 다시 써서 내놓게 시켰는데(주석 아래
 * CURRENT_SOURCE_FILES 잔재 참고), 실제로 돌려보니 대상 파일이 190~410KB나 되는데
 * max_tokens 한도(32000) 안에서는 절대 끝까지 못 써서 결과물이 원본의 14%만 나오고 잘리는
 * 사고가 실사용으로 확인됐다(2026-08-01, 세무사님 직접 실행해서 발견). max_tokens를 더
 * 올린다고 해결될 문제가 아니라(이 정도 크기의 파일을 매번 통째로 재출력하는 것 자체가 API
 * 응답 한도에 안 맞는 설계), "파일을 다시 쓰게 하는" 접근 자체를 버리고 "무엇을 어떻게
 * 고치면 되는지 사람이 읽고 판단할 지침만 만드는" 훨씬 가벼운 방식으로 바꿨다. 이러면
 * 큰 파일을 프롬프트에 넣어 매번 다시 읽힐 필요도 없어서 속도도 훨씬 빠르다.
 */
const IMPROVEMENT_TRACKING_FILE = '_개선요구사항_처리기록.json';

const BOOKING_SHEET_ID = '1HMMKMd0bp7kjK7Z8oSMJy2TSXFKB0EUC1XCIjSsfrmQ';

// ===== 신청 목록 조회 =====
function booking_getBookings() {
  const ss = SpreadsheetApp.openById(BOOKING_SHEET_ID);
  const sheet = ss.getSheetByName('Applications');
  if (!sheet) return jsonResponse({ bookings: [] });

  const data = sheet.getDataRange().getValues();
  const bookings = [];

  for (let i = 1; i < data.length; i++) {
    // [2026.08 버그수정] 예약일·예약시간 칸이 날짜/시간처럼 생긴 값이라 구글시트가 자동으로
    // Date로 인식해버려서(전화번호가 숫자로 오인되던 것과 같은 종류의 문제), 그냥 그대로
    // 돌려주면 "2026-07-19T15:00:00.000Z" 같은 원시 문자열이 그대로 나갔다 — 다른 곳에서
    // 이 값을 그대로 표시하면 못 알아보므로, date 필드와 같은 방식으로 여기서 포맷해서 낸다.
    bookings.push({
      date: data[i][0] ? Utilities.formatDate(new Date(data[i][0]), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '',
      name: data[i][1],
      phone: data[i][2],
      type: data[i][3],
      statuses: data[i][4],
      situation: data[i][5],
      reservedDate: data[i][6] ? Utilities.formatDate(new Date(data[i][6]), 'Asia/Seoul', 'yyyy-MM-dd') : '',
      reservedTime: data[i][7] ? Utilities.formatDate(new Date(data[i][7]), 'Asia/Seoul', 'HH:mm') : '',
      source: data[i][8],
      status: data[i][9],
      approvedDate: data[i][10],
      eventId: data[i][11] || '',
      caseId: data[i][12] || '',
      field: data[i][13] || '',
      // [2026.10.30 예약 결과 관리] 확정 뒤 결과(상담완료·사건접수·노쇼·고객취소·사무소취소)·결과일·메모·밤 점검이 적은 연결 후보
      result: data[i][14] || '',
      resultDate: data[i][15] ? (typeof data[i][15] === 'object' ? Utilities.formatDate(new Date(data[i][15]), 'Asia/Seoul', 'yyyy-MM-dd') : String(data[i][15]).slice(0, 10)) : '',
      resultMemo: data[i][16] || '',
      linkCandidates: (function (t) { if (!t) return []; try { const a = JSON.parse(String(t)); return Array.isArray(a) ? a : []; } catch (e) { return []; } })(data[i][18])
    });
  }

  return jsonResponse({ bookings });
}

// =========================================================
// my 모듈 — my.netax.kr(고객 통합 페이지) 백엔드 이관 (2026.08)
// admin_code 스크립트 속성은 report 모듈이 RPT_ADMIN_CODE로 옮겨가서 비게 된 원래
// 이름(ADMIN_CODE)을 그대로 재사용.
// =========================================================
let MY_SHEET_ID = '1-rHNUuds5QxmH9OoLpfIejnlPmNnlyuHGWTLZCM3XU4';

const MY_SHEET_SUB_LOG = 'SubmissionLog';

// 고객이 보낸 서류 목록 — 고객창구(my.netax.kr)와 카카오 봇(NETAX_Kakao)이 함께 쓰는 제출 기록표(SubmissionLog: 접속코드·파일·항목·시각)를 읽는다.
//  rid(접속코드)를 주면 그 사건 것만. 사건 연결은 사건 목록의 my_report_id로.
function custUploadsRecent_(days, rid) {
  const since = Date.now() - (days || 7) * 86400000, want = String(rid || '').trim().toUpperCase();
  const sh = SpreadsheetApp.openById(MY_SHEET_ID).getSheetByName(MY_SHEET_SUB_LOG);
  if (!sh || sh.getLastRow() < 2) return [];
  const n = Math.min(400, sh.getLastRow() - 1), rows = sh.getRange(sh.getLastRow() - n + 1, 1, n, 4).getValues();
  const cases = {};
  try { const d = work_getSheet_().getDataRange().getValues(), ci = d[0].indexOf('my_report_id'), ii = d[0].indexOf('id'), ni = d[0].indexOf('사건명'), gi = d[0].indexOf('고객명'); for (let i = 1; i < d.length && ci >= 0; i++) { const k = String(d[i][ci]).trim().toUpperCase(); if (k) cases[k] = { id: d[i][ii], 사건: String(d[i][ni] || d[i][gi] || '') }; } } catch (e) {}
  const out = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i], t = r[3] instanceof Date ? r[3].getTime() : Date.parse(r[3]), k = String(r[0] || '').trim().toUpperCase();
    if (!t || t < since) continue;
    if (want && k !== want) continue;
    const c = cases[k] || null, kakao = String(r[2]) === '(카카오채널 제출)';
    out.push({ at: Utilities.formatDate(new Date(t), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 경로: kakao ? '카카오' : '고객창구', caseId: c ? c.id : '', 사건: c ? c.사건 : '', 파일: String(r[1] || '').slice(0, 80), 항목: kakao ? '' : String(r[2] || '').slice(0, 40), rid: k });
    if (out.length >= 40) break;
  }
  return out;
}

// =========================================================
// client 모듈 — 고객관리(고객 명단 + 자문내역·수임료 기록) (2026.08 신규)
// 기존 고객관리.xlsx(자문일지 성격)에 없던 "고객 1명당 1행" 명단(Clients)을 새로 만들고,
// 실제 상담·자문 이력은 예전처럼 이벤트 하나당 1행(ConsultLog)으로 남기되 고객ID로 연결한다.
// work_ 모듈(작업관리)의 사건도 고객명을 적으면 자동으로 여기 명단과 연결/신규등록된다.
// =========================================================
const CLIENT_SHEET_ID = '1nHf4PK1F1-Ao5jZ-s43PB1A3eF85YVRcI7T1kK_ooBI';

const CLIENT_SHEET_CLIENTS = 'Clients';

const CLIENT_SHEET_LOG = 'ConsultLog';

const CLIENT_HEADERS = ['id', '성명', '전화번호', '구분', '사업자번호', '메모', '등록일', '수정일', '추가연락처', '주소', '주민등록번호암호화'];

const CONSULT_HEADERS = ['id', '고객ID', '고객명', '날짜', '담당자', '유형', '내용', '관계', '금액', '수취증빙', '리뷰', '생성일', '승인번호', '사건ID', '중복정리'];

function client_getSheets_() {
  const ss = SpreadsheetApp.openById(CLIENT_SHEET_ID);
  return { ss: ss, clients: client_ensureSheet_(ss, CLIENT_SHEET_CLIENTS, CLIENT_HEADERS), log: client_ensureSheet_(ss, CLIENT_SHEET_LOG, CONSULT_HEADERS) };
}

// work_getSheet_와 같은 자가치유 방식 — 시트가 없으면 헤더까지 만들고, 있는데 헤더가 모자라면
// (스키마가 나중에 늘어난 경우) 빠진 헤더만 뒤에 이어붙인다.
function client_ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = headers.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length > 0) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function client_colMap_(headers, headerList) {
  const map = {};
  headerList.forEach(function (name) { map[name] = headers.indexOf(name); });
  return map;
}

function client_dateStr_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

function client_parseExtraContacts_(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(function (p) { return p && p.전화번호; }).map(function (p) { return { 이름: String(p.이름 || ''), 전화번호: String(p.전화번호 || '') }; });
  } catch (e) { /* 아래 옛 형식(콤마구분 전화번호) 처리로 진행 */ }
  return client_splitPhoneNumbers_(raw).map(function (phone) { return { 이름: '', 전화번호: phone }; });
}

function client_readClient_(col, row) {
  // [2026.09.16 버그수정] 구글 시트는 "3733"처럼 숫자로만 된 값을 실제 숫자 타입으로 저장해버린다
  // — 이미 work_readRow_(WORK_CASES의 고객명/납세자)에서 같은 문제를 겪고 고쳤는데, 고객관리의
  // 성명에서도 똑같이 터졌다(화면에서 .localeCompare is not a function으로 확인). 문자열로
  // 강제하지 않으면 이 값을 문자열 메서드로 다루는 곳(정렬 등)에서 예외가 나서 고객관리 탭
  // 전체가 조용히 멈춘다.
  return {
    id: row[col.id], 성명: String(row[col.성명] || ''), 전화번호: String(row[col.전화번호] || ''), 구분: row[col.구분],
    사업자번호: String(row[col.사업자번호] || ''), 메모: row[col.메모],
    등록일: client_dateStr_(row[col.등록일]), 수정일: client_dateStr_(row[col.수정일]),
    추가연락처: client_parseExtraContacts_(row[col.추가연락처]),
    주소: String(row[col.주소] || ''),
    // [2026.09.19 신규] 주민등록번호는 암호문조차 목록 조회에 안 실어보낸다 — 등록 여부만
    // 알려주고, 실제 값은 client_getRRN을 따로 호출했을 때만(화면의 "보기" 버튼) 내려준다.
    주민번호등록됨: !!String(row[col.주민등록번호암호화] || '').trim()
  };
}

// "010-1234-5678, 010-9999-8888" 같은 자유 입력에서 번호별로 숫자만 남긴 목록을 뽑는다.
// 쉼표/줄바꿈으로만 번호를 나누고, 그 안의 하이픈·공백은 한 번호에 속한 것으로 보고 전부
// 붙여서 숫자만 남긴다 — 하이픈 기준으로 통째로 쪼개면 "010-1111-2222"의 가운데 토막
// "1111"이 마치 별도 번호의 뒷4자리인 것처럼 잘못 매칭될 수 있다.
function client_splitPhoneNumbers_(raw) {
  return String(raw || '').split(/[,\n]+/)
    .map(function (s) { return s.replace(/[^0-9]/g, ''); })
    .filter(function (s) { return s.length >= 4; });
}

function client_readLog_(col, row) {
  return {
    id: row[col.id], 고객ID: row[col.고객ID], 고객명: row[col.고객명],
    날짜: client_dateStr_(row[col.날짜]), 담당자: row[col.담당자], 유형: row[col.유형],
    내용: row[col.내용], 관계: row[col.관계], 금액: row[col.금액], 수취증빙: row[col.수취증빙], 리뷰: row[col.리뷰],
    생성일: row[col.생성일], 승인번호: row[col.승인번호], 사건ID: row[col.사건ID],
    중복정리: row[col.중복정리] || ''
  };
}

function client_getClients(params) {
  const sheets = client_getSheets_();
  const data = sheets.clients.getDataRange().getValues();
  const col = client_colMap_(data[0], CLIENT_HEADERS);
  const q = String((params && params.search) || '').trim();
  const clients = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][col.id]) continue;
    if (q && String(data[i][col.성명] || '').indexOf(q) === -1) continue;
    clients.push(client_readClient_(col, data[i]));
  }
  return { success: true, clients: clients };
}

function client_getConsultLogs(params) {
  const sheets = client_getSheets_();
  const data = sheets.log.getDataRange().getValues();
  const col = client_colMap_(data[0], CONSULT_HEADERS);
  const clientId = String((params && params.고객ID) || '').trim();
  const caseId = String((params && params.사건ID) || '').trim();
  const q = String((params && params.search) || '').trim();
  // [2026.09.19 신규] 중복으로 자동 정리된 기록은 대시보드·고객관리·처리개요 등 이 함수를
  // 그대로 쓰는 다른 화면에서는 항상 안 보이는 게 맞다(집계에 안 잡혀야 함) — 수금관리
  // 화면만 "흐리게 표시"를 위해 명시적으로 includeMerged:true를 넘겨 같이 받아간다.
  const includeMerged = !!(params && params.includeMerged);
  const logs = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][col.id]) continue;
    if (!includeMerged && String(data[i][col.중복정리] || '').trim()) continue;
    if (clientId && String(data[i][col.고객ID] || '').trim() !== clientId) continue;
    if (caseId && String(data[i][col.사건ID] || '').trim() !== caseId) continue;
    if (q && String(data[i][col.고객명] || '').indexOf(q) === -1) continue;
    logs.push(client_readLog_(col, data[i]));
  }
  logs.sort(function (a, b) { return String(b.날짜 || '').localeCompare(String(a.날짜 || '')); });
  return { success: true, logs: logs };
}

// [2026.10.09] 고객사건 폴더 바로 밑의 특수폴더(사건이 아님) — 사건 흡수·미연결/미등록 폴더 점검이 사건으로 잘못 잡지 않게 한곳에서 관리.
// 예전엔 0_NX_0만 이름으로 빼고 있어 '1 상담사건'이 정비 버튼에 사건으로 잡힐 수 있었다. 새 특수폴더를 고객사건 밑에 만들면 여기에 추가할 것.
// (후속확인 과제 목록은 고객사건이 아니라 상위 '0 NETAX/_확인조치사항.md'에 둔다 — 세무사님 지정 2026-10-10)
const WORK_SPECIAL_ROOT_FOLDERS_ = ['0_NX_0', '1 상담사건'];

// [2026.10.20] "개별 사건" 판정은 이 함수 하나로 — 세무사님 "최근기록에 개별사건이 아닌 사건들이 나타나는데, 이것은 채팅목록이나
// 사건목록에서도 공통된 사안". 예전엔 위 이름 2개만 빼서 '1 양도코리아'·'1 자문 예정, 보류, 취소'·'_AI대화기록'이 미등록 사건 점검에
// 잡히고, work 대화기록·사건 경과(전체일지)에는 0_NX_0이 사건처럼 떴다. 사건 목록(work_getCases)·미등록/미연결 점검·흡수·
// AI 대화 목록(work 대화기록)·AI 사건 경과가 모두 이 기준을 쓴다. 이름만 보고 판정한다(시트만 읽는 gs-light에서도 그대로 돌게).
//  · 이름 앞 "_" — 시스템 전용(_AI대화기록 등, 세무사님 규칙 2026-10-19)
//  · 숫자 + 공백/밑줄로 시작 — 사건 위로 정렬되게 붙인 보관함(0_NX_0·1 상담사건·1 양도코리아·1 자문 예정…·0 NETAX 맨위).
//    "1520(1520)_"·"3733(3733)_양도"처럼 숫자 바로 뒤가 괄호인 사건명은 사건이다.
//  · 고객사건 폴더 자체 이름(고객명·납세자 자리에 "고객사건"이 잘못 들어간 사건 모양 폴더 포함)
// 사건이면 '', 아니면 그 이유를 돌려준다.
function work_nonCaseReason_(name) {
  const n = String(name || '').trim();
  if (!n) return '이름 없음';
  if (WORK_SPECIAL_ROOT_FOLDERS_.indexOf(n) !== -1) return '특수폴더';
  if (n.charAt(0) === '_') return '시스템 폴더';
  if (/^\d+[ _]/.test(n)) return '보관함 폴더';
  if (/^고객사건(?:$|[(_ ])/.test(n)) return '고객사건 폴더 이름'; // 고객사건 자체, 또는 고객명 자리에 "고객사건"이 들어간 폴더
  return '';
}

// =========================================================
// work 모듈 — 작업관리(사건별 세부업무 트리 + 법정기한 자동계산 + 캘린더 연동) (2026.08 신규)
// 사건 1행 = Cases 시트 한 줄. 하위업무는 my_ 모듈의 체크리스트/제출상태와 같은 방식으로
// 한 셀에 JSON 트리(children 배열, 깊이 제한 없음)로 저장한다.
// =========================================================
const WORK_SHEET_ID = '1JtgBpcrlThAiYHU0m74wSxZmyZPxUtmSTspZzHycZX4';

const WORK_SHEET_CASES = 'Cases';

const WORK_HEADERS = ['id', '고객ID', '고객명', '사건명', '세목', '업무유형', '담당자', '의뢰일', '기준일', '법정일', '완료전법정일', '납세자', '상태', '개요', '하위업무', '생성일', '수정일', '처리방향', '처리대상', '작업일지', '법령예규판례', '증빙목록', 'my_report_id', '폴더ID', '세액계산결과', '사건개요'];

// [2026.09.16 신규] casehandling.html의 TAXPAYER_NAME_FIELD_BY_SEMOK_(클라이언트 쪽 상수)와
// 반드시 같은 값을 유지해야 하는 서버쪽 짝 — work_createCase가 새 사건을 만들 때도 납세자를
// 사건개요의 납세의무자 이름 필드에 미리 채워 넣기 위해 서버(Code.js)에서도 이 매핑이
// 필요하다(클라이언트 JS 상수는 서버 코드에서 참조할 수 없음). 한쪽만 고치고 잊어버리기
// 쉬우니 casehandling.html의 원본을 고칠 때 여기도 같이 고칠 것.
// [2026.09.23 버그수정] '사업' 세목의 사건개요(CH_CASE_OVERVIEW_FIELDS_.business)가 나중에
// (2026.09.19) 새로 생기면서 이 매핑에 business를 추가하는 걸 놓쳤다 — 그래서 사업 사건은
// 작업관리 납세자를 아무리 입력해도 처리개요의 "납세자(대표) 성명"(bizTaxpayerName)에
// 전혀 반영되지 않았다. casehandling.html의 TAXPAYER_NAME_FIELD_BY_SEMOK_도 같이 고칠 것.
// [2026.10.30] 불복 사건개요서(casehandling.html CH_CASE_OVERVIEW_FIELDS_.objection) — 청구인(납세자) 성명도 작업관리 납세자와 맞춘다
const WORK_TAXPAYER_FIELD_BY_SEMOK_ = { transfer: 'trTransferorName', gift: 'giftDoneeName', inheritance: 'ihDeceasedName', business: 'bizTaxpayerName', objection: 'objTaxpayerName' };

const WORK_EVIDENCE_TEMPLATES_ = {
  transfer: {
    공통: [
      '양도 매매계약서(양도가액·양도일)',
      '취득 당시 매매계약서 또는 취득가액 증빙',
      '등기부등본(취득일·소유권 이전 이력)',
      '취득세 영수증',
      '중개보수 등 필요경비 영수증',
      '주민등록초본(전입·전출 이력, 거주기간 확인용)',
      '가족관계증명서(세대원 구성 확인)',
      '다른 주택 보유현황(1세대1주택 비과세 판정용)'
    ],
    사건분류: {
      '1세대1주택 비과세': ['전입세대열람내역(전체 거주이력)', '무주택확인서(다른 주택 미보유 확인)'],
      '1세대1주택 고가주택(과세)': ['전입세대열람내역(전체 거주이력)', '무주택확인서(다른 주택 미보유 확인)'],
      '일시적2주택 비과세': ['신규주택 취득 등기부등본', '종전주택 처분계약서(또는 처분계획)'],
      '2주택 중과': ['보유주택 전체 등기부등본', '조정대상지역 지정 여부 확인자료'],
      '3주택이상 중과': ['보유주택 전체 등기부등본', '조정대상지역 지정 여부 확인자료'],
      '비사업용 토지(중과)': ['토지이용계획확인서', '농지원부 또는 실제 경작(사업) 여부 확인자료'],
      '농지 등 감면(8년자경 등)': ['농지원부', '자경사실확인서', '농업경영체등록확인서'],
      '수용 등 공익사업 비과세·감면': ['협의계약서 또는 수용재결서', '보상금 수령내역'],
      '이월과세(배우자·직계존비속 증여 후 양도)': ['이전 증여계약서', '증여세 신고서'],
      '특수관계자간 거래(부당행위계산부인·저가양도 증여의제)': ['거래상대방 가족관계증명서', '시가 산정자료(감정평가서 등)'],
      '재건축·재개발(조합원입주권→신축주택 전환)': ['관리처분계획인가서', '종전자산(구건물) 취득 당시 매매계약서·등기부등본', '조합원 자격 확인서(조합원입주권 취득 경위)', '청산금 납부·환급 내역', '준공 후 신축건물 등기부등본(소유권보존등기)'],
      '미등기양도': ['미등기 사유 확인자료(있는 경우)'],
      '경매·공매': ['낙찰허가결정문(매각결정통지서)', '배당표'],
      '부담부증여(전액)': ['증여계약서', '채무인수·대출승계 서류'],
      '교환': ['교환계약서', '쌍방 자산 평가자료']
    }
  },
  gift: {
    공통: [
      '증여계약서',
      '가족관계증명서(증여자·수증자 관계 확인, 공제·세율 판정용)',
      '증여재산(부동산) 등기부등본·평가자료(감정가액 등)',
      '증여재산 중 그 외 자산 평가자료(비상장주식 평가자료 등, 해당 시)',
      '수증자 계좌 이체내역(현금증여 입증)',
      '채무인수 관련 자료(부담부증여인 경우 — 임대차계약서·대출계약서 등)',
      '10년 이내 동일인 증여 내역(증여재산 합산과세 확인용)',
      '수증자 신분증 사본'
    ],
    사건분류: {
      '부담부증여(부분, 순수증여분만)': ['채무인수·대출승계 서류', '임대차계약서(전세보증금 승계 시)'],
      '재차증여(10년내 합산)': ['과거 증여세 신고서'],
      '세대생략증여(할증)': ['가족관계증명서(조부모-손자녀 관계 확인)'],
      '명의신탁 증여의제': ['실제소유자 확인자료', '주식등변동상황명세서'],
      '저가양수·고가양도 증여의제': ['매매계약서', '시가 산정자료(감정평가서 등)'],
      '특정법인과의 거래 증여의제': ['법인 재무제표', '주주명부', '거래약정서'],
      '창업자금·가업승계 특례증여': ['사업계획서', '법인 정관·주주명부']
    }
  },
  inheritance: {
    공통: [
      '가족관계증명서·기본증명서(피상속인·상속인 확인)',
      '제적등본(피상속인)',
      '사망진단서 또는 사망사실이 기재된 가족관계증명서(사망일 확인)',
      '상속재산(부동산) 등기부등본·평가자료',
      '상속재산 중 그 외 재산 평가자료(예금잔액증명서, 주식평가자료 등)',
      '피상속인 금융거래내역(사망 전 1~2년, 사전증여·인출 확인용)',
      '채무증빙(대출잔액증명서, 임대보증금 반환채무 등)',
      '장례비용 영수증',
      '봉안시설·자연장지 사용료 영수증(장례비 1천만원과 별도 5백만원 한도, 상증령 §9②)',
      '사전증여재산 내역(상속인 10년·비상속인 5년 이내 증여분)'
    ],
    사건분류: {
      '배우자상속공제 해당': ['상속재산 분할협의서', '배우자 상속분 등기 관련 자료'],
      '가업상속공제 해당': ['사업자등록증', '법인 정관·주주명부', '가업영위기간 증빙'],
      '영농상속공제 해당': ['농지원부', '자경사실확인서'],
      '동거주택상속공제 해당': ['동거 사실 확인 주민등록초본(10년 이상)'],
      '사전증여재산 합산(10년내 상속인·5년내 비상속인)': ['과거 증여세 신고서'],
      '상속포기·한정승인': ['상속포기·한정승인 심판문'],
      '유증·사인증여': ['유언장 또는 사인증여계약서']
    }
  }
};

// 시트를 열고, 처음 만드는 거면 헤더까지 써준다. 이미 있는 시트인데 WORK_HEADERS에 새 컬럼이
// 추가된 상태(예: 고객ID 신규 도입)면, 기존 데이터는 그대로 두고 빠진 헤더만 뒤에 이어붙인다
// — work_colMap_이 이름으로 컬럼을 찾으므로 위치가 중간이 아니어도 문제없다.
function work_getSheet_() {
  const ss = SpreadsheetApp.openById(WORK_SHEET_ID);
  let sheet = ss.getSheetByName(WORK_SHEET_CASES);
  if (!sheet) {
    sheet = ss.insertSheet(WORK_SHEET_CASES);
    sheet.appendRow(WORK_HEADERS);
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = WORK_HEADERS.filter(function (h) { return existingHeaders.indexOf(h) === -1; });
  if (missing.length > 0) {
    sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function work_colMap_(headers) {
  const map = {};
  WORK_HEADERS.forEach(function (name) { map[name] = headers.indexOf(name); });
  return map;
}

function work_dateStr_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// [2026.09.23 신규] work_readRow_와 work_computeCanonicalCaseFolderNames_(폴더명 점검 도구)가
// 똑같이 필요로 하던 "납세자↔사건개요 중 비어있는 쪽을 채운다" 로직을 한 곳으로 뽑았다 —
// 두 곳에 따로 복사해두면 한쪽만 고치고 잊어버리는 사고가 재발하기 쉽다(이번에 실제로 그런
// 사고가 날 뻔해서 여기로 합침). caseOverview는 그 자리에서 직접 고쳐 쓰고(mutate), 반환값은
// 화면에 보여줄 최종 납세자 문자열이다.
function work_resolveTaxpayer_(seMok, rawTaxpayer, caseOverview) {
  const taxpayerField = WORK_TAXPAYER_FIELD_BY_SEMOK_[seMok];
  let taxpayer = String(rawTaxpayer || '').trim();
  if (taxpayerField && caseOverview && typeof caseOverview === 'object') {
    const overviewVal = String(caseOverview[taxpayerField] || '').trim();
    if (!overviewVal && taxpayer) caseOverview[taxpayerField] = taxpayer;
    else if (overviewVal && !taxpayer) taxpayer = overviewVal;
  }
  return taxpayer;
}

var WORK_CALC_BODY_MEMO_ = {};

function work_calcBodyFile_(caseId, create) {
  const folder = ledgerFolder_();
  const name = String(caseId).replace(/[^\w-]/g, '_') + '.계산저장본.json';
  const it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(name, '{}', 'application/json') : null;
}

function work_calcBodyRead_(caseId, fresh) {
  const k = String(caseId || '');
  if (!fresh && WORK_CALC_BODY_MEMO_[k]) return WORK_CALC_BODY_MEMO_[k];
  const f = work_calcBodyFile_(caseId, false);
  const m = f ? (JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}') || {}) : {};
  WORK_CALC_BODY_MEMO_[k] = m;
  return m;
}

// 칸에서 읽은 목록에 파일의 본문을 다시 붙인다 — 파일을 못 읽으면 목록만(세액·이름은 칸에 있음)
function work_calcHydrate_(caseId, list) {
  if (!caseId || !list.some(function (e) { return e && e.본문 === '파일'; })) return list;
  let m;
  try { m = work_calcBodyRead_(caseId, false); } catch (e) { console.error('계산 저장본 본문 파일을 못 읽음(목록만): ' + (e && e.message || e)); return list; }
  return list.map(function (e) {
    if (!e || e.본문 !== '파일' || !m[e.id]) return e;
    const o = Object.assign({}, e, m[e.id]); delete o.본문; return o;
  });
}

function work_readRow_(col, rowValues) {
  let subtasks = [];
  try { subtasks = JSON.parse(rowValues[col.하위업무] || '[]'); } catch (e) { subtasks = []; }
  if (!Array.isArray(subtasks)) subtasks = [];
  let workLog = [];
  try { workLog = JSON.parse(rowValues[col.작업일지] || '[]'); } catch (e) { workLog = []; }
  if (!Array.isArray(workLog)) workLog = [];
  let precedents = [];
  try { precedents = JSON.parse(rowValues[col.법령예규판례] || '[]'); } catch (e) { precedents = []; }
  if (!Array.isArray(precedents)) precedents = [];
  let evidenceList = [];
  try { evidenceList = JSON.parse(rowValues[col.증빙목록] || '[]'); } catch (e) { evidenceList = []; }
  if (!Array.isArray(evidenceList)) evidenceList = [];
  let taxCalcResults = [];
  try { taxCalcResults = JSON.parse(rowValues[col.세액계산결과] || '[]'); } catch (e) { taxCalcResults = []; }
  if (!Array.isArray(taxCalcResults)) taxCalcResults = [];
  taxCalcResults = work_calcHydrate_(rowValues[col.id], taxCalcResults);
  let caseOverview = {};
  try { caseOverview = JSON.parse(rowValues[col.사건개요] || '{}'); } catch (e) { caseOverview = {}; }
  if (!caseOverview || typeof caseOverview !== 'object' || Array.isArray(caseOverview)) caseOverview = {};
  // [2026.09.23 버그수정] 세무사님 지적 — 작업관리에 이미 입력된 납세자가 처리개요(사건개요)의
  // 납세의무자 이름 필드에 반영 안 되는 사건들이 있었다. 기존 동기화(work_updateCase 저장
  // 시점에 클라이언트가 양쪽을 맞춤)는 "그 이후에 다시 저장"해야만 걸리는 저장-트리거 방식이라,
  // 이미 등록된 사건은 재저장 전까지 계속 빈칸으로 남는다(게다가 '사업' 세목은 매핑 자체가
  // 최근까지 빠져 있어 저장해도 안 걸렸다 — 위 WORK_TAXPAYER_FIELD_BY_SEMOK_ 수정 참고).
  // 이 함수는 모든 화면(작업관리·처리개요·메모·세액계산·AI도구)이 사건을 읽을 때 항상 거치므로,
  // 여기서 한 번만 "둘 중 비어있는 쪽을 채워서 돌려준다"를 적용하면 과거 사건도 재저장 없이
  // 즉시 반영된다(시트 자체를 고쳐쓰지는 않음 — 다음 실제 저장 때 정식 반영).
  // [2026.09.23 추가] "전수조사" 지시로 재점검 — 처음엔 사건개요→납세자 방향만 채웠는데,
  // 반대(사건개요는 비어있고 납세자에만 값이 있는 경우)도 똑같이 안 채워지는 건 대칭이 아니다.
  // 상속처럼 "의뢰인=상속인, 납세자=피상속인"이 원래 다른 게 정상인 세목도 있으므로(workmanage.html
  // 주석 참고), 둘 다 값이 있는데 서로 다르면 절대 손대지 않는다 — 오직 한쪽이 완전히 빈 경우만 채운다.
  // [2026.09.23 재수정] 이 자기치유 로직을 work_computeCanonicalCaseFolderNames_(폴더명 점검
  // 도구)가 그대로 베껴 쓰지 않고 시트 원본만 읽고 있어서, 그 도구가 제안하는 사건명이 다른
  // 화면들이 보여주는 납세자와 어긋날 뻔했다 — work_resolveTaxpayer_로 뽑아내 두 곳이 항상
  // 같은 로직을 쓰게 한다(따로 복사해두면 또 갈라질 위험이 있으므로).
  const taxpayerForRead_ = work_resolveTaxpayer_(rowValues[col.세목], rowValues[col.납세자], caseOverview);
  return {
    id: rowValues[col.id],
    고객ID: rowValues[col.고객ID],
    // [2026.09 버그수정] "3733"처럼 숫자로만 된 고객명/납세자는 구글시트가 진짜 숫자로 저장
    // 해버릴 수 있다 — 문자열로 강제하지 않으면 화면 쪽에서 .replace() 등 문자열 메서드를
    // 호출할 때 예외가 나서, 그 사건이 목록에 섞여있는 것만으로 화면 전체(목록 재렌더링→
    // 상세보기)가 조용히 멈추는 심각한 문제로 이어졌다.
    고객명: String(rowValues[col.고객명] || ''),
    사건명: rowValues[col.사건명],
    세목: rowValues[col.세목],
    업무유형: rowValues[col.업무유형],
    담당자: rowValues[col.담당자],
    의뢰일: work_dateStr_(rowValues[col.의뢰일]),
    기준일: work_dateStr_(rowValues[col.기준일]),
    법정일: work_dateStr_(rowValues[col.법정일]),
    납세자: taxpayerForRead_,
    상태: rowValues[col.상태],
    완료전법정일: work_dateStr_(rowValues[col.완료전법정일]),
    개요: rowValues[col.개요],
    처리방향: rowValues[col.처리방향],
    처리대상: rowValues[col.처리대상],
    하위업무: subtasks,
    작업일지: workLog,
    법령예규판례: precedents,
    증빙목록: evidenceList,
    세액계산결과: taxCalcResults,
    사건개요: caseOverview,
    my_report_id: rowValues[col.my_report_id],
    폴더ID: rowValues[col.폴더ID],
    생성일: rowValues[col.생성일],
    수정일: rowValues[col.수정일]
  };
}

// [2026.10.23 속도 ㅅ6차] 작업관리 시트 통째 읽기 — 사건처리 한 실행 안에서 한 번만. ③ 한 번에 머리글 읽기·행 찾기·갱신으로 시트 전체(수백 행 × 긴 JSON 칸)를 5~8번 읽어
//  (한 번에 2~4초) 칸 조립 26초의 큰 몫이었다. 사건처리 실행(caseProcTimed_)·양도 사실 정리 안에서만 켜고(CP_SHEET_MEMO_ON_), 갱신(work_updateCase)은 같은 행 배열을 제자리에서 고치므로 메모가 따라온다.
//  사건을 새로 만들거나 행을 지우면 메모를 버린다. 다른 화면 호출(사건 목록·고객 등)은 예전처럼 매번 읽는다.
var CP_SHEET_MEMO_ON_ = false, WORK_DATA_MEMO_ = null;

function work_values_(sheet) {
  if (!CP_SHEET_MEMO_ON_) return sheet.getDataRange().getValues();
  const sid = sheet.getSheetId();
  if (WORK_DATA_MEMO_ && WORK_DATA_MEMO_.sid === sid) return WORK_DATA_MEMO_.values;
  const v = sheet.getDataRange().getValues();
  WORK_DATA_MEMO_ = { sid: sid, values: v };
  return v;
}

function work_findCaseRow_(sheet, col, caseId) {
  const data = work_values_(sheet);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.id]).trim() === String(caseId).trim()) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

// [2026.09] "사건분류 목록이 casehandling.html과 Code.js(WORK_EVIDENCE_TEMPLATES_) 두 곳에
// 따로 하드코딩돼 있어 한쪽만 고치면 조용히 어긋날 수 있다"는 지적 — 실제로 지금까지 어긋난
// 적은 없었지만(직접 대조 확인됨), 근본적으로 없애려면 한 곳(여기, 필요증빙 템플릿이 있는
// Code.js)만 진짜 목록을 갖고 화면은 그걸 그대로 받아쓰게 해야 한다. casehandling.html은
// 이제 이 목록 앞에 빈 선택지와 "일반OO"만 붙여서 그대로 렌더링한다.
function work_getEvidenceClassificationOptions_() {
  const options = {};
  Object.keys(WORK_EVIDENCE_TEMPLATES_).forEach(function (semok) {
    options[semok] = Object.keys(WORK_EVIDENCE_TEMPLATES_[semok].사건분류 || {});
  });
  return options;
}

function work_getCases(params) {
  const sheet = work_getSheet_();
  const data = sheet.getDataRange().getValues();
  const col = work_colMap_(data[0]);
  const cases = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][col.id]) continue;
    if (String(data[i][col.사건명] || '').trim() && work_nonCaseReason_(data[i][col.사건명])) continue; // 개별 사건이 아닌 행(0_NX_0 등 보관함을 잘못 등록한 것) — 판정은 work_nonCaseReason_ 하나
    cases.push(work_readRow_(col, data[i]));
  }
  return { success: true, cases: cases, evidenceClassificationOptions: work_getEvidenceClassificationOptions_() };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// [2026.10.09] 구글 드라이브 무료 글자인식(OCR) — 이미지·PDF를 구글 문서로 복사하면 드라이브가 글자를 읽어준다.
// AI 비용 0원. 임시 문서는 읽자마자 휴지통으로 보낸다.
// [2026.10.16] 변환용 임시 사본을 둘 곳 — 업무관리자 "_글자인식기억" 폴더(실행이 끊겨 못 지워도 고객 사건 폴더에 남지 않게). 못 찾으면 빈 값(예전처럼 원본 옆).
function tcTmpMeta_(meta) { try { const fo = tcOcrStoreFolder_(); if (fo) meta.parents = [fo.getId()]; } catch (e) {} return meta; }

function ocrFileText_(fileId, tblKey) {
  // [2026.10.16] 임시 문서는 고객 사건 폴더가 아니라 업무관리자 "_글자인식기억" 폴더에 만든다 — 실행 시간 초과로 지우기 전에 끊기면
  //  고객 폴더에 "_ocr_tmp_….gdoc"가 남았다(고객X 사건). 기억 폴더를 못 찾으면 예전처럼 원본 옆에.
  let copy = null;
  try { copy = Drive.Files.copy(tcTmpMeta_({ name: '_ocr_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.document' }), fileId, { ocrLanguage: 'ko', fields: 'id' }); }
  catch (e0) {
    // [2026.10.19 3번 읽기 — 확보율 재측정 "읽기 실패"] 드라이브 글자인식이 거절한 파일:
    //  ① 너무 큰 사진(13MB 휴대폰 사진 "Request Too Large" — 고객Q 고객Q 관계인1.jpg)·변환 안 되는 그림 형식(webp) → 드라이브가 만든 축소본(2400px)으로 읽음(일괄 안에서만)
    //  ② 암호 걸린 PDF("Bad Request" — 고객AG 사망보험금 지급증명서는 비밀번호 없이는 안 열림) → 이유를 알아볼 수 있게 바꿔 던짐(비밀번호를 풀어 다시 받아야 함)
    const em = String(e0 && e0.message || e0);
    let mt0 = ''; try { mt0 = String(DriveApp.getFileById(fileId).getMimeType() || ''); } catch (e1) {}
    if (TC_BATCH_READ_ && /^image\//.test(mt0) && /Too Large|not supported|conversion/i.test(em)) {
      const th = tcThumbBytes_(fileId, 2400), tb2 = [];
      for (let k = 0; k < th.length; k++) tb2.push(th[k] > 127 ? th[k] - 256 : th[k]);
      return String(tcOcrBlob_(Utilities.newBlob(tb2, th[0] === 0x89 ? 'image/png' : 'image/jpeg', 'img')) || '');
    }
    if (/pdf/.test(mt0) && /Bad Request/i.test(em)) {
      let enc = false; try { const s0 = DriveApp.getFileById(fileId).getBlob().getDataAsString('ISO-8859-1'); enc = /\/Encrypt\s/.test(s0.slice(-4000)) || /\/Encrypt\s/.test(s0.slice(0, 4000)); } catch (e2) {}
      if (enc) throw new Error('암호 걸린 PDF — 비밀번호를 풀어 다시 올려 주셔야 읽을 수 있음(' + em.slice(0, 60) + ')');
    }
    throw e0;
  }
  try {
    const body = DocumentApp.openById(copy.id).getBody();
    // [2026.10.18 3번 세션 실험③] 드라이브는 글자층 PDF·워드를 바꿀 때 표(TABLE)를 만든다 — getText()는 칸마다 줄을 바꿔 줄·칸 연결이 사라진다
    //  (고객A 임대명세서: 층·호·면적·상호·사업자번호·보증금·월세가 한 줄씩 흩어짐). 같은 변환에서 칸 자리 지킨 표 글도 기억(ocrtbl1_)에 남긴다.
    //  메모 글(getText)은 그대로라 기존 정리 규칙 영향 없음. 칸 자리가 필요한 쪽은 tcDocTableText_로 받는다
    if (tblKey) { try { const tb = tcDocTableAware_(body); tcOcrStorePut_(tblKey, tb.tables ? tb.text : ''); } catch (e) {} }
    const got = body.getText();
    // [2026.10.19 3번 읽기 — 확보율 재측정] 글자가 모양(그림)으로만 찍힌 PDF — "Microsoft Print to PDF"로 저장한 웹 화면(국세법령정보 예규 등)은 글꼴은 있는데
    //  글자 표가 깨져 드라이브가 그 깨진 글자층을 그대로 써서 0자가 된다(개발용 22개 — 고객BD 관련예규 9·고객I 5·고객AF 4). 서버는 PDF를 그림으로 못 그리므로
    //  드라이브가 만든 첫 쪽 그림(축소본 2400px)을 글자인식(0원)한다 — 첫 쪽만이라 표시를 붙임. 일괄 안에서만(사이드바는 느려지지 않게)
    //  쪽당 글자로 본다 — 깨진 글자층에서 몇십 자만 건지는 것(고객AD 질의회신 20여 개, 2~5쪽에 46~120자)도 같은 경우라 쪽당 30자 미만이면
    const gotN = String(got || '').replace(/[^가-힣0-9]/g, '').length;
    let lowPdf = false;
    if (TC_BATCH_READ_ && gotN < 150) {
      try {
        const df0 = DriveApp.getFileById(fileId);
        if (/pdf/.test(String(df0.getMimeType() || ''))) { const np = (df0.getBlob().getDataAsString('ISO-8859-1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length || 1; lowPdf = gotN < 30 || gotN / np < 30; }
      } catch (e) {}
    }
    if (lowPdf) {
      try {
        {
          const th = tcThumbBytes_(fileId, 2400), tb2 = [];
          for (let k = 0; k < th.length; k++) tb2.push(th[k] > 127 ? th[k] - 256 : th[k]);
          const tt = String(tcOcrBlob_(Utilities.newBlob(tb2, th[0] === 0x89 ? 'image/png' : 'image/jpeg', 'p1')) || '').trim();
          if (tt.replace(/[^가-힣0-9]/g, '').length >= 30) return String(got || '') + '\n[1쪽 — 글자가 그림 모양으로만 찍힌 PDF라 드라이브가 그린 첫 쪽 그림으로 읽음, 뒷쪽은 못 읽음]\n' + tt;
        }
      } catch (e) {}
    }
    return got;
  } finally {
    try { DriveApp.getFileById(copy.id).setTrashed(true); } catch (e) { /* 정리 실패는 무시 */ }
  }
}

// [2026.10.15 일괄점검 ①] 글자인식 결과 영구 기억 — 6시간 캐시만으로는 서류 200개짜리 사건을 매번 처음부터 다시 읽어야 해서(한 건 10~40초)
//  폴더 서류를 다 읽지 못하고 잘랐다. 업무관리자 폴더의 "_글자인식기억"에 파일ID+수정시각 이름으로 글자를 남겨 두고 다음부터 그대로 쓴다(토큰 0).
function tcOcrStoreFolder_() {
  const props = lightProps_();
  const id = props.getProperty('OCR_STORE_FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const bm = getBusinessManagerFolder_();
  if (!bm) return null;
  const it = bm.getFoldersByName('_글자인식기억');
  const f = it.hasNext() ? it.next() : bm.createFolder('_글자인식기억');
  props.setProperty('OCR_STORE_FOLDER_ID', f.getId());
  return f;
}

function tcOcrStoreGet_(key) {
  try { const fo = tcOcrStoreFolder_(); if (!fo) return null; const it = fo.getFilesByName(key + '.txt'); return it.hasNext() ? it.next().getBlob().getDataAsString('UTF-8') : null; } catch (e) { return null; }
}

function tcOcrStorePut_(key, text) {
  try { const fo = tcOcrStoreFolder_(); if (fo && !fo.getFilesByName(key + '.txt').hasNext()) fo.createFile(key + '.txt', String(text || ''), 'text/plain'); } catch (e) {}
}

// [2026.10.18 3번 세션 — 읽기] 이미 있는 기억 글을 고쳐 쓴다(그림 쪽 글자인식 보충) — 없으면 새로 만든다. 6시간 캐시도 지운다
function tcOcrStoreSet_(key, text) {
  try {
    const fo = tcOcrStoreFolder_(); if (!fo) return;
    const it = fo.getFilesByName(key + '.txt'); let any = false;
    while (it.hasNext()) { it.next().setContent(String(text || '')); any = true; } // 같은 이름이 둘 이상이면(동시 쓰기) 모두 — 어느 것을 읽어도 같게
    if (!any) fo.createFile(key + '.txt', String(text || ''), 'text/plain');
    try { CacheService.getScriptCache().remove(key); } catch (e) {}
  } catch (e) {}
}

var OCRB_TRANSIENT_RE_ = /rate limit|too many|Rate Limit|Backend Error|Internal Error|서버 오류|Service invoked too many|timed out|시간 초과|Bad Gateway|Service Unavailable|503|500 /;

var CP_NEXQ_PENDING_ = 'cp_nexq_pending', CP_NEXQ_SUPPRESS_ = false;

function cpNexQEnqueue_(caseId) {
  const id = String(caseId || ''); if (!id || CP_NEXQ_SUPPRESS_) return;
  const props = lightProps_();
  let q = []; try { q = JSON.parse(props.getProperty(CP_NEXQ_PENDING_) || '[]'); } catch (e) { q = []; }
  if (q.indexOf(id) === -1) { q.push(id); props.setProperty(CP_NEXQ_PENDING_, JSON.stringify(q.slice(-60))); }
}

// =========================================================
// [2026.10.18 3번 세션 — 읽기] 글자층 PDF 속 스캔 그림 쪽 글자인식 보충.
//  드라이브는 글자가 든 PDF를 문서로 바꿀 때 글자층만 쓰고 그림 쪽은 글자인식을 하지 않는다 — 인터넷 발급 등기부 뒤에 신탁원부 스캔 20쪽을 붙인
//  고객U 「등기부등본_인덕원센트럴푸르지오.pdf」(30쪽)가 1~9쪽만 읽히고 10~29쪽은 쪽 번호("10/30")만 남았다.
//  PDF를 직접 풀어(순수 JavaScript, 압축 풀기는 hwp 읽개의 tcInflateRaw_) 쪽마다 글자 그리기 명령 수와 큰 그림을 세고,
//  글자가 거의 없고(쪽 번호 정도) 큰 그림(JPEG·팩스·압축 그림)이 있는 쪽만 그 그림을 꺼내 따로 글자인식해 글 끝에 "[N쪽 그림 쪽 글자인식]" 머리와 함께 붙인다(이미 기억된 글의 자리는 그대로).
//  모든 쪽이 그림뿐인 스캔 PDF는 드라이브가 이미 글자인식하므로 건드리지 않는다. 토큰 0.
// =========================================================
var TC_PDF_IMG_MARK_ = '[그림 쪽 글자인식]', TC_PDF_IMG_LEFT_ = '[⚠ 그림 쪽 글자인식 남음';

// PDF 값 읽개 — 사전 {D:{}}, 배열 [], 이름 {N:''}, 참조 {R:번호}, 글자 {S:''}, 숫자·참거짓·null
function tcPdfTok_(s, p) {
  const n = s.length;
  const ws = function () {
    for (;;) {
      while (p < n && /[\s\0]/.test(s[p])) p++;
      if (s[p] === '%') { while (p < n && s[p] !== '\n' && s[p] !== '\r') p++; } else return;
    }
  };
  const delim = /[\s\0\/\[\]<>(){}%]/;
  const val = function () {
    ws();
    const c = s[p];
    if (c === '<' && s[p + 1] === '<') {
      p += 2; const d = {};
      for (;;) { ws(); if (s[p] === '>' && s[p + 1] === '>') { p += 2; return { D: d }; } if (p >= n) return { D: d }; const k = val(); const v = val(); if (k && k.N !== undefined) d[k.N] = v; }
    }
    if (c === '[') { p++; const a = []; for (;;) { ws(); if (s[p] === ']') { p++; return a; } if (p >= n) return a; a.push(val()); } }
    if (c === '<') { const e = s.indexOf('>', p); const h = s.slice(p + 1, e).replace(/\s/g, ''); p = e + 1; let t = ''; for (let i = 0; i < h.length; i += 2) t += String.fromCharCode(parseInt((h.substr(i, 2) + '0').slice(0, 2), 16)); return { S: t }; }
    if (c === '(') { let dep = 0, t = ''; p++; while (p < n) { const ch = s[p++]; if (ch === '\\') { t += s[p++] || ''; continue; } if (ch === '(') dep++; else if (ch === ')') { if (!dep) break; dep--; } t += ch; } return { S: t }; }
    if (c === '/') { let e = p + 1; while (e < n && !delim.test(s[e])) e++; const nm = s.slice(p + 1, e); p = e; return { N: nm }; }
    if (c === ']' || c === '>' || c === ')' || c === '}') { p++; return null; }
    let e = p; while (e < n && !delim.test(s[e])) e++;
    const w = s.slice(p, e); p = e;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      if (/^\d+$/.test(w)) { const m = /^\s+(\d+)\s+R(?=[\s\0\/\[\]<>()%]|$)/.exec(s.slice(p, p + 24)); if (m) { p += m[0].length; return { R: Number(w) }; } }
      return Number(w);
    }
    if (w === 'true') return true; if (w === 'false') return false;
    if (!w) p++;
    return null;
  };
  const v = val();
  return { v: v, p: p };
}

// Uint8Array → 한 글자 = 한 바이트인 글(정규식으로 PDF 구조를 찾기 위해)
function tcBytesLatin1_(u) { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, Math.min(u.length, i + 8192))); return s; }

// PDF를 열어 쪽마다 {p, textOps, imgs:[{w,h,filter,start,len}]} — 못 열면 null(암호 PDF는 내용 흐름이 암호화돼 글자 명령을 못 셈 → null)
function tcPdfPages_(u, s0) {
  const s = s0 || tcBytesLatin1_(u);
  if (/\/Encrypt\s/.test(s.slice(-4096)) || /trailer[\s\S]{0,400}\/Encrypt/.test(s)) return null;
  const objs = {}, re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const r = tcPdfTok_(s, m.index + m[0].length), o = { v: r.v };
    let q = r.p; while (q < s.length && /[\s\0]/.test(s[q])) q++;
    if (s.substr(q, 6) === 'stream') {
      q += 6; if (s[q] === '\r') q++; if (s[q] === '\n') q++;
      const L = r.v && r.v.D && r.v.D.Length;
      let end = typeof L === 'number' && s.substr(q + L, 40).indexOf('endstream') !== -1 ? q + L : s.indexOf('endstream', q);
      if (end < 0) end = s.length;
      o.start = q; o.len = end - q;
      if (typeof L !== 'number') { while (o.len > 0 && /[\r\n]/.test(s[q + o.len - 1])) o.len--; }
      re.lastIndex = end;
    } else re.lastIndex = Math.max(re.lastIndex, r.p);
    objs[m[1]] = o;
  }
  const get = function (v) { let k = 0; while (v && v.R !== undefined && k++ < 20) { const o = objs[v.R]; v = o ? o.v : null; } return v; };
  const nm = function (v) { v = get(v); return v && v.N !== undefined ? v.N : (Array.isArray(v) ? v.map(nm).join(',') : ''); };
  const decode = function (o) {
    const f = nm(o.v.D.Filter), raw = u.subarray(o.start, o.start + o.len);
    if (!f) return raw;
    if (f === 'FlateDecode') return tcInflateRaw_(raw.subarray(2));
    return null;
  };
  // 압축된 객체 묶음(ObjStm) — 바로 적힌 객체가 없는 번호만 채운다
  Object.keys(objs).forEach(function (k) {
    const o = objs[k]; if (!o.v || !o.v.D || nm(o.v.D.Type) !== 'ObjStm' || o.start === undefined) return;
    let d; try { d = decode(o); } catch (e) { d = null; } if (!d) return;
    const t = tcBytesLatin1_(d), N = get(o.v.D.N), first = get(o.v.D.First);
    const hd = t.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < N; i++) { const num = hd[2 * i], off = hd[2 * i + 1]; if (objs[num]) continue; try { objs[num] = { v: tcPdfTok_(t, first + off).v }; } catch (e) {} }
  });
  let root = null; { const rs = s.match(/\/Root\s+(\d+)\s+\d+\s+R/g) || []; for (let i = rs.length - 1; i >= 0 && !root; i--) { const rv = get({ R: Number(/(\d+)/.exec(rs[i])[1]) }); if (rv && rv.D && rv.D.Pages) root = rv; } }
  if (!root) return null;
  const pages = [];
  const content = function (c) {
    const cv = get(c), parts = Array.isArray(cv) ? cv : [c]; let out = ''; // 참조 하나(흐름 객체)는 참조 그대로, 참조가 배열을 가리키면 그 배열
    parts.forEach(function (x) { const o = x && x.R !== undefined ? objs[x.R] : null; if (!o || o.start === undefined) return; let d = null; try { d = decode(o); } catch (e) {} if (d) out += tcBytesLatin1_(d) + '\n'; });
    return out;
  };
  // 좌표 변환(cm) 곱 — 그림이 쪽에 그려질 때의 방향·크기(스캔 그림은 옆으로 누운 채 저장되고 cm으로 돌려 그리는 일이 흔함)
  const mul = function (m, n) { return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]]; };
  const scan = function (cs, res, pg, depth, ctm0) {
    pg.textOps += (cs.match(/(?:\)|>|\])\s*(?:T[Jj]|'|")/g) || []).length;
    const rr = get(res), xo = rr && rr.D ? get(rr.D.XObject) : null;
    const re2 = /\/([^\s\/\[\]<>()]+)\s+Do\b|(?<![\w.#])([-+]?(?:\d+\.?\d*|\.\d+))(?=[\s\[\]\/<>()]|$)|\b(q|Q|cm|BT|ET)\b/g; let mm, nums = [], ctm = ctm0, stack = [], inText = false;
    while ((mm = re2.exec(cs))) {
      if (mm[2] !== undefined) { if (!inText) { nums.push(Number(mm[2])); if (nums.length > 6) nums.shift(); } continue; }
      if (mm[3]) {
        if (mm[3] === 'BT') inText = true; else if (mm[3] === 'ET') inText = false;
        else if (mm[3] === 'q') stack.push(ctm); else if (mm[3] === 'Q') ctm = stack.pop() || ctm0;
        else if (mm[3] === 'cm' && nums.length === 6) ctm = mul(nums, ctm);
        nums = []; continue;
      }
      nums = [];
      const ref = xo && xo.D ? xo.D[mm[1]] : null, o = ref && ref.R !== undefined ? objs[ref.R] : null;
      if (!o || !o.v || !o.v.D) continue;
      const st = nm(o.v.D.Subtype);
      if (st === 'Image') pg.imgs.push({ w: get(o.v.D.Width) || 0, h: get(o.v.D.Height) || 0, filter: nm(o.v.D.Filter), start: o.start, len: o.len, ctm: ctm, d: o.v.D });
      else if (st === 'Form' && depth < 3) { let d = null; try { d = decode(o); } catch (e) {} const fm = get(o.v.D.Matrix); if (d) scan(tcBytesLatin1_(d), o.v.D.Resources || res, pg, depth + 1, Array.isArray(fm) && fm.length === 6 ? mul(fm.map(get), ctm) : ctm); }
    }
  };
  const walk = function (node, res, depth, box) {
    node = get(node); if (!node || !node.D || depth > 30 || pages.length > 3000) return;
    const r = node.D.Resources || res, mb = get(node.D.MediaBox), b = Array.isArray(mb) && mb.length === 4 ? mb.map(get) : box;
    if (node.D.Kids) { (get(node.D.Kids) || []).forEach(function (k) { walk(k, r, depth + 1, b); }); return; }
    const pg = { p: pages.length + 1, textOps: 0, imgs: [], box: b || [0, 0, 595, 842], rot: get(node.D.Rotate) || 0 };
    pages.push(pg);
    try { scan(content(node.D.Contents), r, pg, 0, [1, 0, 0, 1, 0, 0]); } catch (e) { pg.err = String(e && e.message || e); }
  };
  walk(root.D.Pages, null, 0, null);
  pages.get = get; pages.nm = nm;
  return pages;
}

// 글자층 PDF의 그림 쪽 — 글자 그리기 명령이 3개 이하(쪽 번호 정도)이고 큰 그림(60만 점 이상)이 있는 쪽. 글자층이 아예 없는 PDF는 [](드라이브가 이미 글자인식)
function tcPdfImgPageList_(pages) {
  if (!pages || !pages.some(function (p) { return p.textOps > 3; })) return [];
  // 스캔 한 쪽을 가로띠 여러 장으로 잘라 넣은 PDF도 있다(고객BD 세무자문자료 1쪽 — 2573×360 띠 여러 장) → 넓이 합으로 보고 그림 전부를 한 쪽에 옮긴다
  return pages.filter(function (p) { return p.textOps <= 3 && !p.err && p.imgs.reduce(function (sm, im) { return sm + im.w * im.h; }, 0) >= 600000; }).map(function (p) {
    const big = p.imgs.slice().sort(function (a, b) { return b.w * b.h - a.w * a.h; })[0];
    return { p: p.p, img: big, imgs: p.imgs.slice(0, 60) };
  });
}

// 그림만 든 한 쪽짜리 PDF를 만든다(원래 쪽의 크기·방향·그림 위치 그대로) — 드라이브는 글자층 없는 PDF는 쪽을 그려서 글자인식하므로
//  옆으로 누운 채 저장된 스캔 그림도 바로 선 모양으로 읽힌다. JPEG·팩스(CCITT)·압축 그림 모두 원래 바이트를 그대로 옮긴다. 못 만들면 null
function tcPdfOnePage_(u, pages, pg, imgs) {
  const get = pages.get;
  const ser = function (v, dep) {
    if (dep > 6) throw new Error('깊음');
    if (v && v.R !== undefined) return ser(get(v), dep + 1);
    if (typeof v === 'number') return String(Math.round(v * 10000) / 10000);
    if (typeof v === 'boolean') return String(v);
    if (v === null || v === undefined) return 'null';
    if (v.N !== undefined) return '/' + v.N;
    if (Array.isArray(v)) return '[' + v.map(function (x) { return ser(x, dep + 1); }).join(' ') + ']';
    if (v.D) { if (v.D.JBIG2Globals) throw new Error('JBIG2'); return '<<' + Object.keys(v.D).map(function (k) { return '/' + k + ' ' + ser(v.D[k], dep + 1); }).join(' ') + '>>'; }
    throw new Error('글자 값');
  };
  const xdict = function (img) {
  const d = img.d;
  let cs = get(d.ColorSpace), csTxt = '';
  if (cs && cs.N !== undefined) csTxt = '/' + cs.N;
  else if (Array.isArray(cs) && get(cs[0]) && get(cs[0]).N === 'ICCBased') { const st = get(cs[1]), n = st && st.D ? get(st.D.N) : 3; csTxt = n === 1 ? '/DeviceGray' : n === 4 ? '/DeviceCMYK' : '/DeviceRGB'; }
  else if (!get(d.ImageMask)) {
    if (img.filter !== 'DCTDecode') return null; // 색 목록(Indexed) 등 — 옮기기 어려움
    let nc = 3; for (let i = img.start + 2; i < img.start + Math.min(img.len, 65536) - 9; i++) { if (u[i] === 0xFF && (u[i + 1] === 0xC0 || u[i + 1] === 0xC1 || u[i + 1] === 0xC2)) { nc = u[i + 9]; break; } }
    csTxt = nc === 1 ? '/DeviceGray' : nc === 4 ? '/DeviceCMYK' : '/DeviceRGB';
  }
  try {
    return '<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h + ' /BitsPerComponent ' + (get(d.BitsPerComponent) || (get(d.ImageMask) ? 1 : 8)) +
      (csTxt ? ' /ColorSpace ' + csTxt : '') + (d.Filter ? ' /Filter ' + ser(d.Filter, 0) : '') + (d.DecodeParms ? ' /DecodeParms ' + ser(d.DecodeParms, 0) : '') +
      (d.Decode ? ' /Decode ' + ser(d.Decode, 0) : '') + (get(d.ImageMask) ? ' /ImageMask true' : '') + ' /Length ' + img.len + ' >>';
  } catch (e) { return null; }
  };
  const dicts = imgs.map(xdict);
  if (!dicts.length || dicts.some(function (x) { return !x; })) return null;
  const body = imgs.map(function (img, i) { return 'q ' + img.ctm.map(function (x) { return Math.round(x * 10000) / 10000; }).join(' ') + ' cm /Im' + i + ' Do Q'; }).join('\n');
  const bx = pg.box.map(function (x) { return Math.round(x * 100) / 100; }).join(' ');
  // 객체: 1 목록 · 2 쪽 묶음 · 3 쪽 · 4 내용 · 5… 그림. 조각 [글 또는 그림, 객체 시작이면 1]
  const xo = imgs.map(function (img, i) { return '/Im' + i + ' ' + (5 + i) + ' 0 R'; }).join(' ');
  const parts = [['%PDF-1.4\n'], ['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 1], ['2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', 1],
    ['3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [' + bx + ']' + (pg.rot ? ' /Rotate ' + pg.rot : '') + ' /Resources << /XObject << ' + xo + ' >> >> /Contents 4 0 R >>\nendobj\n', 1],
    ['4 0 obj\n<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream\nendobj\n', 1]];
  imgs.forEach(function (img, i) { parts.push([(5 + i) + ' 0 obj\n' + dicts[i] + '\nstream\n', 1]); parts.push([img]); parts.push(['\nendstream\nendobj\n']); });
  const offs = [], out = []; let pos = 0;
  parts.forEach(function (pt) {
    if (pt[1]) offs.push(pos);
    const p = pt[0];
    if (typeof p !== 'string') { const src = p.bytes || u, st0 = p.bytes ? 0 : p.start; for (let k = 0; k < p.len; k++) out.push(src[st0 + k]); pos += p.len; return; } // p.bytes: 따로 만든 그림 바이트(PNG 조각 이음 등)
    for (let k = 0; k < p.length; k++) out.push(p.charCodeAt(k) & 255); pos += p.length;
  });
  const pad = function (n) { return ('0000000000' + n).slice(-10); };
  const tail = 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(function (o) { return pad(o) + ' 00000 n \n'; }).join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + pos + '\n%%EOF\n';
  for (let k = 0; k < tail.length; k++) out.push(tail.charCodeAt(k));
  for (let k = 0; k < out.length; k++) if (out[k] > 127) out[k] -= 256; // GAS 바이트는 -128~127
  return out;
}

// [2026.10.19 3번 세션] 빼는 것은 job이 만드는 "_신고제출"뿐 — 밑줄 없는 지난 사건의 "신고제출" 폴더(고객BE: 서류별 PDF 15개)는 그 서류의 유일한 사본일 수 있어
//  입력이다(세무사님: "현재는 신고제출용 파일만 남기고 원본이나 임시파일을 삭제하였을 가능성도 많다")
function tcIsSubmitDir_(name) { return /^\s*_\s*신고제출/.test(String(name || '')); }

// 드라이브 축소본(JPEG) 바이트 — 긴 변 px
function tcThumbBytes_(fileId, px) {
  const meta = Drive.Files.get(fileId, { fields: 'thumbnailLink' });
  const link = meta && meta.thumbnailLink; if (!link) throw new Error('축소본 없음');
  const res = UrlFetchApp.fetch(String(link).replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s' + px, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('축소본 받기 실패 ' + res.getResponseCode());
  const b = res.getBlob().getBytes(), u = new Uint8Array(b.length); for (let k = 0; k < b.length; k++) u[k] = b[k] & 255; return u;
}

// 큰 사진 → 드라이브가 만든 축소본(thumbnailLink, =s3000)을 받아 글자인식. 축소본이 없으면 원래 오류를 낸다
function tcOcrBigImage_(fileId) {
  const meta = Drive.Files.get(fileId, { fields: 'thumbnailLink' });
  const link = meta && meta.thumbnailLink; if (!link) throw new Error('큰 사진 — 축소본 없음');
  const url = String(link).replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s3000';
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('큰 사진 — 축소본 받기 실패 ' + res.getResponseCode());
  const b = res.getBlob(); b.setName('big.jpg');
  return tcOcrBlob_(b);
}

// 구글 문서 본문 → 글. 표(TABLE)는 한 줄 = 표 한 줄, 칸은 " | "로(getText()는 칸마다 줄을 바꿔 줄·칸 연결이 사라진다). {text, tables}
function tcDocTableAware_(bodyEl) {
  const lines = []; let tables = 0;
  const n = bodyEl.getNumChildren();
  for (let i = 0; i < n; i++) {
    const ch = bodyEl.getChild(i), ty = String(ch.getType());
    if (ty === 'TABLE') {
      tables++;
      const tb = ch.asTable(), rows = tb.getNumRows();
      lines.push('[표 ' + tables + ']');
      for (let r = 0; r < rows; r++) { const row = tb.getRow(r), cells = []; for (let c = 0; c < row.getNumCells(); c++) cells.push(row.getCell(c).getText().replace(/\s*\n\s*/g, ' ').trim()); lines.push('| ' + cells.join(' | ') + ' |'); }
    } else if (ty === 'PARAGRAPH') lines.push(ch.asParagraph().getText());
    else if (ty === 'LIST_ITEM') lines.push(ch.asListItem().getText());
  }
  return { text: lines.join('\n'), tables: tables };
}

// 그림 한 장(blob) → 드라이브 무료 글자인식 글
function tcOcrBlob_(blob) {
  const doc = Drive.Files.create(tcTmpMeta_({ name: '_ocr_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.document' }), blob, { ocrLanguage: 'ko', fields: 'id' });
  try { return DocumentApp.openById(doc.id).getBody().getText(); }
  finally { try { DriveApp.getFileById(doc.id).setTrashed(true); } catch (e) {} }
}

// 드라이브가 읽은 글(text)에 그림 쪽 글자를 끼운다. deadline(ms 시각)을 넘으면 남은 쪽을 ⚠ 줄로 남긴다(다음 보충 때 이어서).
//  이미 끼운 쪽("[N쪽 그림 쪽 글자인식]")은 건너뛴다. 끼울 쪽이 없으면 text 그대로
function tcPdfImgFill_(fileId, text, deadline, blob) {
  text = String(text || '');
  // 바이트는 한 글자 = 한 바이트 글로 받는다 — getBytes()는 숫자 배열이라 30MB PDF(고객S 붙임서류 411쪽)면 메모리가 수백 MB가 된다
  const s = (blob || DriveApp.getFileById(fileId).getBlob()).getDataAsString('ISO-8859-1'); // blob: 압축 파일 안 PDF
  const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255;
  const pages = tcPdfPages_(u, s);
  const list = tcPdfImgPageList_(pages);
  text = text.replace(/\n?\[⚠ 그림 쪽 글자인식 남음[^\]\n]*\]\s*$/, '');
  if (!list.length) return text;
  const left = [];
  list.forEach(function (it) {
    const tag = '[' + it.p + '쪽 ' + TC_PDF_IMG_MARK_.slice(1);
    if (text.indexOf(tag) !== -1) return;
    if (Date.now() > deadline) { left.push(it.p); return; }
    let t = '';
    const one = tcPdfOnePage_(u, pages, pages[it.p - 1], it.imgs);
    if (one) {
      try { t = String(tcOcrBlob_(Utilities.newBlob(one, 'application/pdf', 'p' + it.p + '.pdf')) || '').trim(); } catch (e) { left.push(it.p); return; }
      if (!t) t = '(글자 없음)';
    } else t = '(그림 형식 ' + (it.img.filter || '알 수 없음') + ' — 꺼내 읽지 못함)';
    // 끝에만 붙인다 — 중간에 끼우면 이미 기억된 글의 자리(묶음 서류 구간 "#s시작-끝", 서류 정리 기억)가 말없이 어긋난다(재점검 9)
    text += '\n' + tag + '\n' + t;
  });
  if (left.length) text += '\n' + TC_PDF_IMG_LEFT_ + ': ' + left.join(',') + '쪽 — 서버 글자인식 일괄이 이어서 읽음]';
  return text;
}

// =========================================================
// [2026.10.18 3번 세션 — 읽기] 압축 파일(zip) 안 서류 — 서버 안에서 풀어(사건 폴더엔 아무것도 안 만듦) 하나씩 글자로 읽는다.
//  사건 폴더 30개 zip(고객S 은행 거래내역 2018.zip·20212024.zip, 고객A attachments.zip의 사망진단서·가족관계증명서·신한은행 엑셀 등)을 아무도 못 읽었다.
//  같은 이름·같은 크기 파일이 사건 폴더에 이미 풀려 있으면(고객S "2018/" 폴더 등) 다시 읽지 않고 그 자리만 적는다(같은 서류를 두 번 세지 않게).
//  안쪽 파일 글은 하나씩 영구 기억(ocrzip1_<zipID>_<수정시각>_<번호>)에 남겨 시간이 모자라 끊겨도 다음에 이어 읽는다. 7z·rar·암호 zip은 못 읽음 표시. 토큰 0.
// =========================================================
var TC_ZIP_LEFT_ = '[⚠ 압축 안 서류 남음';

var TC_ZIP_FAIL_RE_ = /^\[⚠ 압축 파일을 풀지 못함/; // [2026.10.19 3번 세션] 풀기 실패 기억(비밀번호 걸림 "[⚠ 비밀번호가 걸린 압축"은 아님)

// 이름으로 형식을 보고 blob 하나를 글로 — 압축 안 압축은 depth 2까지
function tcBlobText_(blob, name, depth, deadline) {
  const n = String(name || '').toLowerCase(), ext = (/\.([a-z0-9]+)$/.exec(n) || [0, ''])[1];
  const mtOf = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword' };
  if (mtOf[ext]) {
    blob.setContentType(mtOf[ext]);
    let t = String(tcOcrBlob_(blob) || '');
    if (ext === 'pdf') { try { t = tcPdfImgFill_('', t, Math.min(deadline, Date.now() + 25000), blob); } catch (e) {} }
    return t;
  }
  if (ext === 'xlsx' || ext === 'xls') {
    blob.setContentType(ext === 'xls' ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const cp = Drive.Files.create(tcTmpMeta_({ name: '_xls_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' }), blob, { fields: 'id' });
    try { return tcSheetText_(SpreadsheetApp.openById(cp.id)); } finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
  }
  // [2026.10.19 3번 세션] 압축 안 rtf·pptx(고객S 「files.zip」 심판청구서 RTF판, 고객N 「files.zip」 발표자료 4개) — 사건 폴더의 같은 형식처럼 구글 문서·프레젠테이션으로 바꿔 읽고 바로 지움
  if (ext === 'rtf' || ext === 'pptx') {
    blob.setContentType(ext === 'rtf' ? 'application/rtf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    const cp = Drive.Files.create(tcTmpMeta_({ name: '_' + ext + '_tmp_' + Date.now(), mimeType: ext === 'rtf' ? 'application/vnd.google-apps.document' : 'application/vnd.google-apps.presentation' }), blob, { fields: 'id' });
    try {
      if (ext === 'rtf') return DocumentApp.openById(cp.id).getBody().getText();
      return SlidesApp.openById(cp.id).getSlides().map(function (sl, i) { return '[' + (i + 1) + '쪽] ' + sl.getShapes().map(function (sh) { try { return sh.getText().asString().trim(); } catch (e) { return ''; } }).filter(String).join('\n'); }).join('\n');
    } finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
  }
  if (ext === 'hwp') return tcHwpBytesText_(blob.getBytes());
  if (ext === 'hwpx') return tcHwpxText_('', blob);
  if (/^(txt|csv|md|json|xml|html?|mmd)$/.test(ext)) {
    const t = blob.getDataAsString('UTF-8');
    return t.indexOf('�') !== -1 ? blob.getDataAsString('MS949') : t; // 옛 한국어 인코딩(EUC-KR/CP949) 글
  }
  if (ext === 'zip' && depth < 2) return tcZipBlobsText_(tcUnzip_(blob), '', depth + 1, deadline, null, {}).text; // 안의 zip도 같은 풀기(이름 CP949·비밀번호 알림)
  return null;
}

// 압축 안 blob 목록 → {text, left}. keyBase가 있으면 안쪽 파일마다 영구 기억, sib는 {이름|크기: 사건 폴더 안 경로}
function tcZipBlobsText_(blobs, keyBase, depth, deadline, out0, sib) {
  const out = [], left = [];
  blobs.forEach(function (b, i) {
    const nm = String(b.getName() || ''); if (!nm || /\/$/.test(nm) || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i.test(nm)) return;
    const base = nm.split('/').pop(), head = '=== [압축 안] ' + nm + ' ===';
    let size = 0; try { size = b.getBytes().length; } catch (e) {}
    if (sib[base + '|' + size]) { out.push(head + '\n(같은 이름·같은 크기 파일이 사건 폴더에 이미 있음: ' + sib[base + '|' + size] + ' — 그 파일로 읽음)'); return; }
    const key = keyBase ? keyBase + '_' + i : '';
    let t = key ? tcOcrStoreGet_(key) : null;
    if (t === null) {
      if (Date.now() > deadline) { left.push(nm); return; }
      try { t = tcBlobText_(b, base, depth, deadline); } catch (e) { const m = String(e && e.message || e); if (OCRB_TRANSIENT_RE_.test(m)) { left.push(nm); return; } t = '(읽기 실패: ' + m.slice(0, 80) + ')'; }
      if (t === null) t = '(글자로 못 바꾸는 형식)';
      t = String(t);
      if (key) tcOcrStorePut_(key, t);
    }
    out.push(head + '\n' + t);
  });
  return { text: out.join('\n\n'), left: left };
}

// 사건 폴더 안 이름|크기 → 경로(zip이 있는 폴더부터 위로 한 단계, 아래로 3단계)
function tcZipSibs_(folder, rel, depth, sib) {
  if (depth > 3) return;
  const it = folder.getFiles(); while (it.hasNext()) { const f = it.next(); if (!/\.zip$/i.test(f.getName())) sib[f.getName() + '|' + f.getSize()] = (rel ? rel + '/' : '') + f.getName(); }
  const sub = folder.getFolders(); while (sub.hasNext()) { const sf = sub.next(); tcZipSibs_(sf, (rel ? rel + '/' : '') + sf.getName(), depth + 1, sib); }
}

// [2026.10.19 3번 세션 — 못 읽던 형식] 압축 풀기: Utilities.unzip이 먼저, 실패하거나 안 파일 이름이 깨지면(�) zip 목록을 직접 읽어 푼다.
//  은행·관공서·윈도 압축은 안 파일 이름이 옛 한국어 인코딩(CP949, "UTF-8" 표시 없음)이다 — 고객 폴더 zip 30개의 안 파일 214개 중 101개.
//  직접 풀기: 끝 목록(central directory) → 이름(UTF-8 표시가 있거나 UTF-8로 맞으면 UTF-8, 아니면 MS949) → 저장(0)·deflate(8)는 tcInflateRaw_(hwp와 같은 것).
//  비밀번호 걸린 안 파일(국민은행 거래내역 zip 7개)은 풀 수 없으므로 그 사실을 이유로 알린다(비밀번호를 짐작해 넣지 않음).
function tcUnzip_(blob) {
  let bs = null, err = null;
  try { bs = Utilities.unzip(blob.setContentType('application/zip')); } catch (e) { err = e; }
  // 이름 깨짐: �가 있거나, 한글은 하나도 없이 라틴 확장 글자(Ã·±·¿ 등 — CP949 바이트를 라틴 글자로 읽은 모양)가 있으면
  if (bs && !bs.some(function (b) { const nm = String(b.getName() || ''); return /�/.test(nm) || (/[\u0080-ÿ]/.test(nm) && !/[가-힣]/.test(nm)); })) return bs;
  let own = null;
  try { own = tcZipOwn_(blob.getBytes()); } catch (e) { if (!bs) throw err || e; return bs; }
  if (own.enc && !own.files.length) throw new Error('비밀번호가 걸린 압축(안 파일 ' + own.enc + '개) — 비밀번호를 풀어 다시 저장해 주세요');
  const out = own.files.map(function (x) { return Utilities.newBlob(x.bytes, '', x.name); });
  if (own.enc) out.push(Utilities.newBlob([], 'text/plain', '(비밀번호 걸린 안 파일 ' + own.enc + '개 — 못 읽음).txt'));
  return out;
}

// zip 바이트 → {files:[{name, bytes(0~255 수 배열이 아니라 -128~127, GAS blob용)}], enc, total}. 이름 디코딩은 tcZipName_
function tcZipOwn_(bytes) {
  const u = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) u[i] = bytes[i] & 255;
  const r16 = function (p) { return u[p] | (u[p + 1] << 8); }, r32 = function (p) { return (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0; };
  let e = -1; for (let p = u.length - 22; p >= Math.max(0, u.length - 22 - 65557); p--) { if (u[p] === 0x50 && u[p + 1] === 0x4b && u[p + 2] === 5 && u[p + 3] === 6) { e = p; break; } }
  if (e < 0) throw new Error('zip 끝 목록 없음');
  const cnt = r16(e + 10), files = []; let off = r32(e + 16), enc = 0;
  for (let j = 0; j < cnt; j++) {
    if (r32(off) !== 0x02014b50) break;
    const fl = r16(off + 8), meth = r16(off + 10), csz = r32(off + 20), nl = r16(off + 28), el = r16(off + 30), cl = r16(off + 32), lo = r32(off + 42);
    const name = tcZipName_(u.subarray(off + 46, off + 46 + nl), !!(fl & 0x800));
    off += 46 + nl + el + cl;
    if (/\/$/.test(name)) continue;
    if (fl & 1) { enc++; continue; }
    const ds = lo + 30 + r16(lo + 26) + r16(lo + 28), raw = u.subarray(ds, ds + csz);
    let data; if (meth === 0) data = raw; else if (meth === 8) data = tcInflateRaw_(raw); else continue; // 그 밖의 압축 방식(bzip2·lzma 등)은 건너뜀
    const b = new Array(data.length); for (let i = 0; i < data.length; i++) b[i] = data[i] > 127 ? data[i] - 256 : data[i];
    files.push({ name: name, bytes: b });
  }
  return { files: files, enc: enc, total: cnt };
}

function tcZipName_(raw, utf8Flag) {
  const ascii = !Array.prototype.some.call(raw, function (c) { return c > 127; });
  const b = Array.prototype.map.call(raw, function (c) { return c > 127 ? c - 256 : c; });
  if (ascii) return String.fromCharCode.apply(null, Array.prototype.slice.call(raw));
  const blob = Utilities.newBlob(b);
  const t = blob.getDataAsString('UTF-8');
  if (utf8Flag || t.indexOf('�') === -1) return t;
  return blob.getDataAsString('MS949');
}

function tcZipText_(f, deadline) {
  const file = DriveApp.getFileById(f.id);
  if (file.getSize() > 45 * 1024 * 1024) return '[⚠ 압축 파일이 너무 큼(45MB 넘음) — 풀어서 넣어 주세요]';
  let blobs;
  try { blobs = tcUnzip_(file.getBlob()); }
  catch (e) { const m = String(e && e.message || e); return /비밀번호/.test(m) ? '[⚠ ' + m + ']' : '[⚠ 압축 파일을 풀지 못함(암호가 걸렸거나 zip이 아님): ' + m.slice(0, 80) + ']'; }
  const sib = {};
  try { const ps = file.getParents(); if (ps.hasNext()) { const p = ps.next(); tcZipSibs_(p, '', 0, sib); } } catch (e) {}
  const r = tcZipBlobsText_(blobs, 'ocrzip1_' + f.id + '_' + (f.modified || ''), 0, deadline, null, sib);
  return r.text + (r.left.length ? '\n' + TC_ZIP_LEFT_ + ': ' + r.left.length + '개 — 서버 글자인식 일괄이 이어서 읽음]' : '');
}

// 한글 hwpx(압축된 XML) — 본문 section*.xml의 글자만 꺼낸다(무료, 변환 없음). 옛 hwp(이진 파일)는 tcHwpText_가 읽는다.
function tcHwpxText_(fileId, blob0) {
  const blob = (blob0 || DriveApp.getFileById(fileId).getBlob()).setContentType('application/zip'); // blob0: 압축 파일 안 hwpx
  const num = function (b) { return Number((/(\d+)\.xml$/i.exec(b.getName()) || [0, 0])[1]); };
  const parts = Utilities.unzip(blob).filter(function (b) { return /Contents\/section\d+\.xml$/i.test(b.getName()); }).sort(function (a, b) { return num(a) - num(b); });
  return parts.map(function (b) {
    return b.getDataAsString('UTF-8').replace(/<\/hp:p>/g, '\n').replace(/<hp:tab[^>]*\/>/g, '\t').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }).join('\n').replace(/\n{3,}/g, '\n\n');
}

// [2026.10.18 1번 세션] 옛 한글(hwp, HWP 5.0 이진 형식) — 본문 글자를 직접 꺼낸다(무료·토큰 0, 외부 변환 없음). 고객 사건 폴더의 옛 hwp 73개를
//  아무도 못 읽고 "hwpx나 PDF로 저장해 주세요"로만 남겼다. 순서: OLE 복합 문서(CFB) 풀기 → FileHeader(압축·암호) → BodyText/Section0..N
//  (압축이면 raw deflate 풀기) → 레코드 중 문단 글자(HWPTAG_PARA_TEXT)만 모은다. 암호 걸린 문서는 '' (글자 없음으로 처리됨).
function tcHwpText_(fileId) {
  return tcHwpBytesText_(DriveApp.getFileById(fileId).getBlob().getBytes());
}

// 바이트 배열(GAS는 -128~127, 0~255로 바꿔 씀) → 본문 글자
function tcHwpBytesText_(bytes) {
  const u = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) u[i] = bytes[i] & 255;
  const cfb = tcCfbOpen_(u);
  if (!cfb) return ''; // OLE 복합 문서가 아님(HWP 3.0 등 더 옛 형식) — 못 읽음
  const fh = cfb.read('FileHeader');
  if (!fh || fh.length < 40) return '';
  const prop = (fh[36] | (fh[37] << 8) | (fh[38] << 16) | (fh[39] << 24)) >>> 0;
  if (prop & 2) return ''; // 암호 걸린 문서
  const zipped = !!(prop & 1);
  // [2026.10.18 1번 세션] 배포용 문서(bit2)는 본문이 ViewText에 암호화돼 있다 — 미리보기 글(PrvText, 앞부분 1천 자 남짓)이라도 읽는다
  if (prop & 4) { const pv = cfb.read('PrvText'); return pv ? tcHwpCleanText_(tcUtf16le_(pv, 0, pv.length)) : ''; }
  const out = [];
  for (let s = 0; ; s++) {
    let sec = cfb.read('BodyText/Section' + s);
    if (!sec) break;
    if (zipped) sec = tcInflateRaw_(sec);
    out.push(tcHwpSectionText_(sec));
  }
  return tcHwpCleanText_(out.join('\n'));
}

function tcHwpCleanText_(t) { return tcHwpPuaFix_(String(t)).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }

// 한컴 전용 글자(U+F0000~, 한컴 글꼴에만 있는 기호)는 다른 곳에서 □로 깨진다. 서식의 번호 기호를 보통 글자로 바꾼다 —
//  종합소득세 신고서의 칸 번호(⑯대리구분·⑰관리번호·⑲소득금액·⑳소득공제·㉑과세표준…)·신고유형 [11]자기조정 [12]외부조정 [14]성실신고확인 [20]간편장부
//  [31]추계-기준율 [35]분리과세 [40]비사업자·첨부 ⓫소득공제명세서~⓲추계소득금액계산서로 맞춰 본 두 자리 번호(십의 자리 글자+일의 자리 글자):
//  동그라미 십 F0288+십·일 F0292+일, 검은 동그라미 십 F029C+십·일 F02A6+일, 네모 한 자리 F02B0+수·십 F02B9+십·일 F02C3+일. 우편 기호 F0095=〒.
//  그 밖의 한컴 전용 글자는 뜻을 모르므로 지운다(깨진 글자를 남기지 않음)
function tcHwpPuaFix_(t) {
  const cp = function (ch) { return ch.codePointAt(0) - 0xF0000; };
  const circ = function (n) { return n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : n >= 21 && n <= 35 ? String.fromCharCode(0x3251 + n - 21) : n >= 36 && n <= 50 ? String.fromCharCode(0x32B1 + n - 36) : '(' + n + ')'; };
  const neg = function (n) { return n >= 1 && n <= 10 ? String.fromCharCode(0x2776 + n - 1) : n >= 11 && n <= 20 ? String.fromCharCode(0x24EB + n - 11) : '(' + n + ')'; };
  return t
    .replace(/([\u{F0289}-\u{F0291}])([\u{F0292}-\u{F029B}])/gu, function (m, a, b) { return circ((cp(a) - 0x288) * 10 + cp(b) - 0x292); })
    .replace(/([\u{F029D}-\u{F02A5}])([\u{F02A6}-\u{F02AF}])/gu, function (m, a, b) { return neg((cp(a) - 0x29C) * 10 + cp(b) - 0x2A6); })
    .replace(/([\u{F02BA}-\u{F02C2}])([\u{F02C3}-\u{F02CC}])/gu, function (m, a, b) { return '[' + ((cp(a) - 0x2B9) * 10 + cp(b) - 0x2C3) + ']'; })
    .replace(/[\u{F02B1}-\u{F02B9}]/gu, function (m) { return '[' + (cp(m) - 0x2B0) + ']'; })
    .replace(/\u{F0095}/gu, '〒')
    .replace(/[\u{F0000}-\u{FFFFD}]/gu, '');
}

function tcUtf16le_(u, from, to) {
  const cs = [];
  for (let i = from; i + 1 < to; i += 2) cs.push(u[i] | (u[i + 1] << 8));
  let s = '';
  for (let i = 0; i < cs.length; i += 4096) s += String.fromCharCode.apply(null, cs.slice(i, i + 4096));
  return s.replace(/\u0000+$/, '');
}

// 한 구역(Section)의 레코드 → 글자. 머리 32비트 = 태그 10비트·레벨 10비트·크기 12비트(0xFFF면 다음 32비트가 크기)
function tcHwpSectionText_(u) {
  const paras = [], lastAt = {};
  let p = 0;
  while (p + 4 <= u.length) {
    const h = (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0;
    p += 4;
    const tag = h & 0x3FF, lv = (h >>> 10) & 0x3FF;
    let size = (h >>> 20) & 0xFFF;
    if (size === 0xFFF) { if (p + 4 > u.length) break; size = (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0; p += 4; }
    const end = Math.min(u.length, p + size);
    if (tag === 67) { const q = { s: tcHwpParaText_(u, p, end), fill: [] }; paras.push(q); lastAt[lv] = q; } // HWPTAG_PARA_TEXT(0x10+51) — 표 칸 글자도 이 레코드로 나온다
    // 글자 겹침(제어 23, 'tcps') — 겹친 글자(①·⑥ 등)는 문단 글자가 아니라 뒤따르는 컨트롤 머리(HWPTAG_CTRL_HEADER, 71)에 있다.
    //  빼면 "시행령 제154조 제⑥항"이 "제항"이 된다(고객AF 의뢰인확인서). 같은 레벨의 바로 앞 문단 글자 자리에 차례로 채운다
    else if (tag === 71 && end - p >= 6 && u[p] === 0x73 && u[p + 1] === 0x70 && u[p + 2] === 0x63 && u[p + 3] === 0x74 && lastAt[lv]) {
      const n = u[p + 4] | (u[p + 5] << 8);
      lastAt[lv].fill.push(tcUtf16le_(u, p + 6, Math.min(end, p + 6 + n * 2)).replace(/[\u0000-\u001f]/g, ''));
    }
    p = end;
  }
  return paras.map(function (q) { let k = 0; return q.s.replace(/\u0017/g, function () { return q.fill[k++] || ''; }); }).join('\n');
}

// 문단 글자(UTF-16LE). 0~31은 제어 문자: 확장·인라인 제어는 8글자(16바이트) 차지, 문자 제어는 1글자. 9=탭, 10·13=줄끝
function tcHwpParaText_(u, from, to) {
  const cs = [];
  let i = from;
  while (i + 1 < to) {
    const c = u[i] | (u[i + 1] << 8);
    if (c >= 32) { cs.push(c); i += 2; continue; }
    if (c === 9) { cs.push(9); i += 16; continue; }                                   // 탭(인라인 제어)
    if (c === 10 || c === 13) { cs.push(10); i += 2; continue; }                      // 줄바꿈·문단 끝
    if (c === 0 || (c >= 24 && c <= 29)) { if (c === 24) cs.push(45); i += 2; continue; } // 쓸 수 없음·하이픈·예약
    if (c === 30 || c === 31) { cs.push(32); i += 2; continue; }                      // 묶음 빈칸·고정폭 빈칸
    if (c === 23) { cs.push(23); i += 16; continue; }                                 // 글자 겹침 자리 — 겹친 글자는 tcHwpSectionText_가 채움
    i += 16;                                                                          // 확장 제어(표·그림·각주 등)·인라인 제어
  }
  let s = '';
  for (let k = 0; k < cs.length; k += 4096) s += String.fromCharCode.apply(null, cs.slice(k, k + 4096));
  return s.replace(/\n+$/, '');
}

// OLE 복합 문서(CFB) — 머리(512바이트)·FAT·DIFAT·미니 FAT·디렉터리 항목을 읽어 경로("BodyText/Section0")로 스트림을 꺼낸다
function tcCfbOpen_(u) {
  const SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  if (u.length < 512) return null;
  for (let i = 0; i < 8; i++) if (u[i] !== SIG[i]) return null;
  const u16 = function (o) { return u[o] | (u[o + 1] << 8); };
  const u32 = function (o) { return (u[o] | (u[o + 1] << 8) | (u[o + 2] << 16) | (u[o + 3] << 24)) >>> 0; };
  const secSize = 1 << u16(0x1E), miniSize = 1 << u16(0x20);
  const nFat = u32(0x2C), dirStart = u32(0x30), cutoff = u32(0x38), miniFatStart = u32(0x3C), nMiniFat = u32(0x40);
  let difatSec = u32(0x44), nDifat = u32(0x48);
  const END = 0xFFFFFFFE, FREE = 0xFFFFFFFF;
  const off = function (sid) { return (sid + 1) * secSize; };
  // FAT 섹터 번호 목록(머리 109개 + DIFAT 섹터 사슬)
  const fatSecs = [];
  for (let i = 0; i < 109 && fatSecs.length < nFat; i++) { const v = u32(0x4C + i * 4); if (v !== FREE) fatSecs.push(v); }
  for (let g = 0; nDifat > 0 && difatSec < END && g < 100000; g++, nDifat--) {
    const o = off(difatSec); if (o + secSize > u.length) break;
    for (let i = 0; i < secSize / 4 - 1 && fatSecs.length < nFat; i++) { const v = u32(o + i * 4); if (v !== FREE) fatSecs.push(v); }
    difatSec = u32(o + secSize - 4);
  }
  const fat = [];
  fatSecs.forEach(function (s) { const o = off(s); for (let i = 0; i < secSize / 4; i++) fat.push(o + i * 4 + 4 <= u.length ? u32(o + i * 4) : FREE); });
  const chain = function (start, tbl) {
    const r = [];
    for (let s = start; s < END && s < tbl.length && r.length <= tbl.length; s = tbl[s]) r.push(s);
    return r;
  };
  const readChain = function (start, size, src, unit, tbl, base) {
    const out = new Uint8Array(size);
    let w = 0;
    const sids = chain(start, tbl);
    for (let k = 0; k < sids.length && w < size; k++) {
      const o = base(sids[k]), n = Math.min(unit, size - w, Math.max(0, src.length - o));
      if (n <= 0) break;
      out.set(src.subarray(o, o + n), w); w += n;
    }
    return w < size ? out.subarray(0, w) : out;
  };
  const readBig = function (start, size) { return readChain(start, size, u, secSize, fat, off); };
  // 디렉터리 항목(128바이트씩)
  const dirSids = chain(dirStart, fat), ents = [];
  dirSids.forEach(function (s) {
    const o0 = off(s);
    for (let k = 0; k < secSize / 128; k++) {
      const o = o0 + k * 128; if (o + 128 > u.length) return;
      const nl = u16(o + 0x40);
      ents.push({ name: tcUtf16le_(u, o, o + Math.min(64, Math.max(0, nl - 2))), type: u[o + 0x42],
        left: u32(o + 0x44), right: u32(o + 0x48), child: u32(o + 0x4C), start: u32(o + 0x74), size: u32(o + 0x78) });
    }
  });
  if (!ents.length || ents[0].type !== 5) return null;
  // 경로 붙이기 — 형제는 좌우 나무, 하위는 child
  const paths = {}, seen = {};
  const walk = function (id, prefix) {
    const st = [id];
    while (st.length) {
      const e = st.pop();
      if (e >= ents.length || seen[e]) continue;
      seen[e] = 1;
      const d = ents[e], p = prefix + d.name;
      paths[p] = d;
      st.push(d.left, d.right);
      if (d.type === 1) walk(d.child, p + '/');
    }
  };
  walk(ents[0].child, '');
  const root = ents[0];
  let mini = null, miniFat = null;
  return {
    paths: paths,
    read: function (path) {
      const d = paths[path];
      if (!d || d.type !== 2) return null;
      if (d.size < cutoff) { // 작은 스트림은 미니 스트림(루트 항목의 스트림) 안에 64바이트 단위로
        if (!mini) {
          mini = readBig(root.start, root.size);
          miniFat = [];
          const mb = readBig(miniFatStart, nMiniFat * secSize);
          for (let i = 0; i + 4 <= mb.length; i += 4) miniFat.push((mb[i] | (mb[i + 1] << 8) | (mb[i + 2] << 16) | (mb[i + 3] << 24)) >>> 0);
        }
        return readChain(d.start, d.size, mini, miniSize, miniFat, function (s) { return s * miniSize; });
      }
      return readBig(d.start, d.size);
    }
  };
}

// raw deflate 풀기(zlib 머리 없음 — GAS Utilities에는 없음). 저장·고정 허프만·동적 허프만 블록
function tcInflateRaw_(src) {
  let out = new Uint8Array(Math.max(4096, src.length * 4)), op = 0;
  let pos = 0, buf = 0, cnt = 0, over = 0;
  const need = function (n) {
    while (cnt < n) {
      if (pos < src.length) buf |= src[pos++] << cnt;
      else if (++over > 8) throw new Error('hwp 압축 자료가 끝에서 잘림');
      cnt += 8;
    }
  };
  const bits = function (n) { need(n); const v = buf & ((1 << n) - 1); buf >>>= n; cnt -= n; return v; };
  const room = function (n) { if (op + n > out.length) { const b = new Uint8Array(Math.max(out.length * 2, op + n)); b.set(out.subarray(0, op)); out = b; } };
  // 부호 길이 → 빠른 찾기표(낮은 비트부터 읽은 값 → 기호<<4 | 길이)
  const build = function (lens) {
    let max = 0; lens.forEach(function (l) { if (l > max) max = l; });
    if (!max) return { tbl: new Int32Array(2), max: 1 };
    const blc = new Array(16).fill(0); lens.forEach(function (l) { if (l) blc[l]++; });
    const next = new Array(16).fill(0); let code = 0;
    for (let b = 1; b <= 15; b++) { code = (code + blc[b - 1]) << 1; next[b] = code; }
    const tbl = new Int32Array(1 << max).fill(-1);
    lens.forEach(function (l, sym) {
      if (!l) return;
      let c = next[l]++, r = 0;
      for (let k = 0; k < l; k++) { r = (r << 1) | (c & 1); c >>= 1; }
      for (let j = r; j < (1 << max); j += (1 << l)) tbl[j] = (sym << 4) | l;
    });
    return { tbl: tbl, max: max };
  };
  const sym = function (h) {
    need(h.max);
    const v = h.tbl[buf & ((1 << h.max) - 1)];
    if (v < 0) throw new Error('hwp 압축 부호가 잘못됨');
    const l = v & 15; buf >>>= l; cnt -= l;
    return v >> 4;
  };
  const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  let fixL = null, fixD = null, last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) { // 저장 블록 — 바이트 경계로 맞춘 뒤 길이만큼 그대로
      bits(cnt & 7);
      const len = bits(16); bits(16);
      room(len);
      let k = 0;
      while (cnt >= 8 && k < len) { out[op++] = bits(8); k++; }
      if (pos + (len - k) > src.length) throw new Error('hwp 압축 저장 블록이 잘림');
      out.set(src.subarray(pos, pos + len - k), op); op += len - k; pos += len - k;
      continue;
    }
    let hl, hd;
    if (type === 1) {
      if (!fixL) {
        const l = []; for (let i = 0; i < 288; i++) l.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8);
        fixL = build(l); fixD = build(new Array(30).fill(5));
      }
      hl = fixL; hd = fixD;
    } else if (type === 2) {
      const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4;
      const cl = new Array(19).fill(0);
      for (let i = 0; i < nc; i++) cl[ORD[i]] = bits(3);
      const ch = build(cl), lens = [];
      while (lens.length < nl + nd) {
        const s = sym(ch);
        if (s < 16) lens.push(s);
        else if (s === 16) { if (!lens.length) throw new Error('hwp 압축 부호 길이 잘못됨'); const pv = lens[lens.length - 1]; for (let r = bits(2) + 3; r > 0; r--) lens.push(pv); }
        else if (s === 17) { for (let r = bits(3) + 3; r > 0; r--) lens.push(0); }
        else { for (let r = bits(7) + 11; r > 0; r--) lens.push(0); }
      }
      hl = build(lens.slice(0, nl)); hd = build(lens.slice(nl, nl + nd));
    } else throw new Error('hwp 압축 블록 형식이 잘못됨');
    for (;;) {
      const s = sym(hl);
      if (s < 256) { room(1); out[op++] = s; continue; }
      if (s === 256) break;
      const li = s - 257; if (li >= 29) throw new Error('hwp 압축 길이 부호가 잘못됨');
      const len = LB[li] + bits(LE[li]);
      const di = sym(hd); if (di >= 30) throw new Error('hwp 압축 거리 부호가 잘못됨');
      const dist = DB[di] + bits(DE[di]);
      if (dist > op) throw new Error('hwp 압축 거리가 앞을 넘음');
      room(len);
      for (let k = 0; k < len; k++, op++) out[op] = out[op - dist];
    }
  }
  return out.subarray(0, op);
}

// 파워포인트(pptx) — 구글 프레젠테이션으로 바꿔 상자 글자를 읽는다
function tcPptxText_(fileId) {
  const cp = Drive.Files.copy(tcTmpMeta_({ name: '_ppt_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.presentation' }), fileId, { fields: 'id' });
  try {
    return SlidesApp.openById(cp.id).getSlides().map(function (sl, i) {
      return '[' + (i + 1) + '쪽] ' + sl.getShapes().map(function (sh) { try { return sh.getText().asString().trim(); } catch (e) { return ''; } }).filter(String).join('\n');
    }).join('\n');
  } finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
}

// [2026.10.15 1단계 ①] 표 계산기는 모든 시트·모든 줄을 읽는다(예전: 앞 3시트·200줄에서 말없이 잘림). 빈 칸·빈 줄은 뺀다.
function tcSheetText_(ss, keepCols) {
  return ss.getSheets().map(function (sh) {
    // [2026.10.18 정밀분석 원인2] keepCols — 빈 칸도 자리를 지킨다(끝쪽 빈 칸만 뗌). 통장 엑셀은 "찾으신금액/맡기신금액" 중 한 칸이 비어 있어
    //  빈 칸을 지우면 출금·입금·잔액 칸이 한 칸씩 당겨졌다(고객E 피상속인·고객BF·고객C·고객O 엑셀 통장). 메모로 읽는 글(기본)은 예전대로 빈 칸을 뺀다
    return sh.getName() + '\n' + sh.getDataRange().getDisplayValues().map(function (r) {
      if (!keepCols) return r.filter(String).join('\t');
      var e = r.length; while (e > 0 && !String(r[e - 1]).trim()) e--;
      return e ? r.slice(0, e).map(function (v) { return String(v).replace(/[\t\r\n]+/g, ' '); }).join('\t') : '';
    }).filter(String).join('\n');
  }).join('\n\n');
}

// [2026.10.18 정밀분석 원인2] 표 계산기(엑셀·구글 시트)를 칸 자리를 지킨 글로 — 통장 표 정리(caseProcTableBankDocs_)용. 메모 글(tc_docText_)과 기억을 따로 둔다.
//  비싼 변환(엑셀 → 구글 시트)은 통장으로 보이는 파일에서만 한 번 하고 영구 기억에 남긴다
// [2026.10.18 1번 세션 — 최대 수집] 엑셀을 글로 바꾸는 김에(같은 변환, 추가 비용 없음) 칸 자리를 지킨 표 글도 기억에 남긴다 — 사실 목록(cpfSheetRows_)이
//  통장이 아닌 표(임대 현황·지분표·분배표 등)도 한 줄 = 사실 한 건으로 읽게. 이미 있으면 그대로 둔다
function tcSheetGridKeep_(f, ss) {
  try {
    if (!f || !f.modified) return;
    const key = 'ocrgrid1_' + f.id + '_' + f.modified;
    if (tcOcrStoreGet_(key) !== null) return;
    const g = String(tcSheetText_(ss, true) || '').slice(0, 400000);
    tcOcrStorePut_(key, g);
    if (g.length <= 30000) { try { CacheService.getScriptCache().put(key, g, 21600); } catch (e) {} }
  } catch (e) {}
}

// [2026.10.16] 정답지 점검이 증빙 단계(글자인식 한도 있음)를 마친 뒤에는 새 글자인식을 하지 않게 하는 스위치 — 서류가 한도보다 많은 사건(고객A 299개)은
//  그 뒤 상속 사실 정리·메모 읽기가 넘친 서류를 하나씩 새로 글자인식해 서버 6분 한도를 넘겼다. 기억에 있는 글자는 그대로 쓴다.
var TC_NO_NEW_OCR_ = false;

// [2026.10.18 3번 세션] 서버 글자인식 일괄(cpOcrBatch_) 안에서만 켜는 스위치 — 오래 걸리는 새 읽기(PDF 그림 쪽 보충·zip 풀어 읽기)는 일괄에서만 한다.
//  사이드바(사건처리)에서 기억 없는 PDF마다 그림 쪽 보충으로 최대 25초가 늘던 것을 막는다(세무사님 실사용). 사이드바는 일괄이 남긴 기억을 그대로 쓴다
var TC_BATCH_READ_ = false;

// [2026.10.18 정밀분석 14] 글자 상한에서 잘린 표시 · 통장 거래내역으로 보이는 글(머리의 거래내역·입출금·계좌번호 낱말 + 날짜 줄 50개 이상)
var TC_TEXT_CUT_MARK_ = '[⚠ 글자 상한';

function tcLooksBankText_(t) {
  t = String(t || '');
  if (t.length <= 60000 || !/거\s*래\s*내\s*역|입\s*출\s*금|계\s*좌\s*번\s*호|예\s*금\s*주|거\s*래\s*일\s*시|찾\s*으\s*신\s*금\s*액|맡\s*기\s*신\s*금\s*액|출\s*금\s*액|입\s*금\s*액/.test(t.slice(0, 5000))) return false;
  return (t.slice(0, 60000).match(/(?:19|20)\d{2}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/g) || []).length >= 50;
}

function tc_docText_(f) {
  // [2026.10.17] 묶음 파일을 서류별로 나눈 구간(caseProcBundleParts_ — id "원본ID#s시작-끝")은 원본 글자의 그 부분
  //  (거래 서류는 떨어진 구간 여럿을 "시작-끝_시작-끝"으로 — 이어서 붙인다)
  const vm = /^(.+)#s(\d+-\d+(?:_\d+-\d+)*)$/.exec(String((f && f.id) || ''));
  if (vm) {
    const pt = tc_docText_({ id: vm[1], name: f.bundleOf || f.name, mimeType: f.mimeType, modified: f.modified });
    return pt ? vm[2].split('_').map(function (rg) { const q = rg.split('-'); return String(pt).slice(Number(q[0]), Number(q[1])); }).join('\n') : pt;
  }
  // 쪽마다 나뉜 파일을 이어 붙인 한 서류(caseProcJoinPages_ — id "m#ID1+ID2+…") — 쪽 순서대로 글자를 잇는다(한 쪽이라도 아직 글자가 없으면 빈 글자)
  if (/^m#/.test(String((f && f.id) || ''))) {
    const ts = String(f.id).slice(2).split('+').map(function (s) { const q = s.split('~'); return tc_docText_({ id: q[0], name: f.name, mimeType: 'application/pdf', modified: Number(q[1]) || '' }); });
    return ts.every(function (x) { return x; }) ? ts.join('\n') : '';
  }
  const cache = CacheService.getScriptCache();
  // 표 계산기만 기억 이름을 바꿔 새 규칙(모든 시트)으로 다시 읽게 한다 — 다른 서류의 글자인식 기억은 그대로 쓴다
  const sheetLike = /spreadsheet|ms-excel/.test(String(f.mimeType || ''));
  const key = (sheetLike ? 'ocrtxt3_' : 'ocrtxt_') + f.id + '_' + (f.modified || '');
  const hit = cache.get(key);
  if (hit !== null && !(TC_BATCH_READ_ && TC_ZIP_FAIL_RE_.test(hit))) return hit; // [2026.10.19 3번 세션] 압축 풀기 실패 글은 일괄에서 캐시도 건너뜀
  let text = '';
  const mt = String(f.mimeType || '');
  const fname = String(f.name || '');
  // 비싼 변환(글자인식·엑셀·한글·파워포인트)은 영구 기억에서 먼저 찾는다(수정시각이 같을 때만)
  const isZip = /\.zip$/i.test(fname) || /^application\/(x-)?zip(-compressed)?$/.test(mt); // [2026.10.18 3번 세션] 압축 파일 안 서류도 읽는다(tcZipText_)
  const costly = !!f.modified && (/pdf|^image\/|officedocument|msword|spreadsheetml|ms-excel/.test(mt) || /\.(hwpx|hwp|pptx)$/i.test(fname) || isZip); // [2026.10.18 1번 세션] 옛 한글 hwp도 영구 기억
  // [2026.10.19 3번 세션] 압축 파일의 "풀지 못함" 기억(이름이 CP949라 풀기에 실패하던 때 남은 것)은 일괄 안에서 다시 읽는다 — 비밀번호 걸림 기억은 그대로 씀
  let zipRetry = false;
  if (costly) { const st = tcOcrStoreGet_(key); if (st !== null && isZip && TC_BATCH_READ_ && TC_ZIP_FAIL_RE_.test(st)) zipRetry = true; else if (st !== null) { try { cache.put(key, st, 21600); } catch (e) {} return st; } }
  if (costly && TC_NO_NEW_OCR_) return '';
  if (/\.hwpx$/i.test(fname)) text = tcHwpxText_(f.id);
  else if (isZip) { if (!TC_BATCH_READ_) return null; text = tcZipText_(f, Date.now() + 60000); } // 일괄에서만 풀어 읽음(1분까지, 남은 안쪽 파일은 다음 번에 — 안쪽 글은 하나씩 기억). 사이드바는 예전처럼 "글자로 못 바꿈"
  else if (/\.hwp$/i.test(fname)) text = tcHwpText_(f.id); // [2026.10.18 1번 세션] 옛 한글 hwp — 이진 파일을 직접 풀어 읽는다(토큰 0)
  else if (/presentationml/.test(mt) || /\.pptx$/i.test(fname)) text = tcPptxText_(f.id);
  else if (mt === 'application/vnd.google-apps.document') text = DocumentApp.openById(f.id).getBody().getText();
  else if (mt === 'application/vnd.google-apps.spreadsheet') {
    const ss = SpreadsheetApp.openById(f.id);
    text = tcSheetText_(ss);
    tcSheetGridKeep_(f, ss);
  }
  // [2026.10.18 3번 세션 재점검 6] 구글 프레젠테이션(.gslides 자문보고서 등)·rtf(심판청구서)·html(태그째 읽히던 것)·mmd·url — 예전엔 못 읽거나 태그째
  else if (mt === 'application/vnd.google-apps.presentation') text = SlidesApp.openById(f.id).getSlides().map(function (sl, i) { return '[' + (i + 1) + '쪽] ' + sl.getShapes().map(function (sh) { try { return sh.getText().asString().trim(); } catch (e) { return ''; } }).filter(String).join('\n'); }).join('\n');
  else if (/\.rtf$/i.test(fname) || /rtf/.test(mt)) {
    const cp = Drive.Files.copy(tcTmpMeta_({ name: '_rtf_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.document' }), f.id, { fields: 'id' });
    try { text = DocumentApp.openById(cp.id).getBody().getText(); } finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
  }
  else if (/html/.test(mt) || /\.html?$/i.test(fname)) {
    text = DriveApp.getFileById(f.id).getBlob().getDataAsString('UTF-8').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }
  else if (/^text\/|json|csv|markdown/.test(mt) || /\.(mmd|url|txt|csv|md)$/i.test(fname)) { const b = DriveApp.getFileById(f.id).getBlob(); text = b.getDataAsString('UTF-8'); if (text.indexOf('�') !== -1) text = b.getDataAsString('MS949'); } // 옛 한국어 인코딩 글도
  else if (/pdf|^image\/|officedocument\.wordprocessingml|msword/.test(mt)) {
    Utilities.sleep(800);
    try { text = ocrFileText_(f.id, f.modified ? 'ocrtbl1_' + f.id + '_' + f.modified : ''); }
    catch (e) {
      // [2026.10.18 3번 세션] 너무 큰 사진(고객Q 「고객Q 관계인1.jpg」 13MB — "Request Too Large")은 드라이브 축소본(긴 변 3,000점)으로 읽는다. 글자 크기는 충분
      if (!/^image\//.test(mt) || !/Too Large|too large|크기/.test(String(e && e.message || e))) throw e;
      text = tcOcrBigImage_(f.id);
    }
    // [2026.10.18 3번 세션] 글자층 PDF 속 스캔 그림 쪽 보충 — 일괄 안에서만(1분까지, 남은 쪽은 ⚠ 줄로 남기고 일괄 뒷단계가 이어서). 사이드바에서는 하지 않는다
    if (/pdf/.test(mt) && TC_BATCH_READ_) { try { text = tcPdfImgFill_(f.id, text, Date.now() + 60000); } catch (e) {} }
  }
  // [2026.10.15 1:1] 엑셀(.xlsx·.xls) — 구글 시트로 바꿔 읽는다(세무사님: "폴더 안 파일은 스펀지처럼 다 흡수" — 상담 메모 엑셀을 말없이 건너뛰던 문제)
  else if (/spreadsheetml|ms-excel/.test(mt)) {
    const cp = Drive.Files.copy(tcTmpMeta_({ name: '_xls_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' }), f.id, { fields: 'id' });
    try {
      const ss = SpreadsheetApp.openById(cp.id); text = tcSheetText_(ss);
      // [2026.10.18 3번 세션] 같은 변환에서 칸 자리 지킨 표 글(tcSheetGridText_와 같은 기억)도 남긴다 — 통장 말고도 임대 현황·지분표 등
      //  빈 칸을 지우면 칸이 한 칸씩 당겨진다. 변환을 한 번 더 하지 않게 여기서 함께
      if (f.modified) { const gk = 'ocrgrid1_' + f.id + '_' + f.modified; if (tcOcrStoreGet_(gk) === null) tcOcrStorePut_(gk, String(tcSheetText_(ss, true) || '').slice(0, 400000)); }
    }
    finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
  }
  else return null; // 압축파일 등은 글자로 못 바꿈
  // [2026.10.11] 글자는 잘라 쓰기 전 전체(최대 6만 자)를 기억 — 서류 자동정리 규칙은 여러 장짜리 등기부·초본 전체가 필요하다
  // [2026.10.18 정밀분석 14] 통장 거래내역(거래 줄 서류)은 끝까지 읽는다(상한 40만 자) — 6만 자에서 잘려 고객S 국민은행 127쪽 중 앞 20쪽·기업은행 앞 23쪽만 읽혀
  //  불복 대사표 50줄 중 2020~2024년 약 40줄이 "통장에 없음"이 됐다. 그 밖의 서류도 잘렸으면 끝에 표시를 남겨 정리 결과에 ⚠로 밝힌다(말없이 자르지 않음)
  // [2026.10.18 3번 세션 재점검 6] 그 밖의 서류도 6만 자 → 20만 자(긴 감정평가서·심판청구 붙임서류가 뒤쪽을 잃었다). 잘리면 여전히 표시를 남김
  { const full = String(text || ''), cap = tcLooksBankText_(full) || isZip ? 400000 : 200000; text = full.length > cap ? full.slice(0, cap) + '\n' + TC_TEXT_CUT_MARK_ + ' ' + cap + '자에서 잘림 — 뒤쪽 ' + (full.length - cap) + '자는 못 읽음(서류를 기간·쪽으로 나눠 넣어 주세요)]' : full; }
  if (isZip && text.indexOf(TC_ZIP_LEFT_) !== -1) return text; // 덜 읽은 압축 파일은 기억에 굳히지 않는다 — 다음 번에 남은 안쪽 파일부터 이어서
  if (isZip && TC_ZIP_FAIL_RE_.test(text)) return text; // [2026.10.19 3번 세션] 풀기 실패도 굳히지 않는다(고친 뒤 다시 읽게) — 비밀번호 걸림은 굳힘
  try { cache.put(key, text, 21600); } catch (e) {}
  if (costly) { if (zipRetry) tcOcrStoreSet_(key, text); else tcOcrStorePut_(key, text); }
  return text;
}

// =========================================================
// [2026.10.14] "이 사건 처리하자" — 처리탭 도구로 사건을 실제로 처리(토큰 0, 판단 근거 설명만 AI)
// 세무사님 지적: AI가 처리탭(처리개요·증빙관리·세액계산·세액인쇄·문서작성)을 쓰지 않고 머릿속으로만 일한다.
// 사이드바에서 "이 사건 처리하자"라고 하면 화면(aichat.html nxAiCaseProc_)이 아래 단계를 차례로 부르고 실제로 채우고 계산한다:
//  basic(사건 기본·날짜 대조) → evidence(폴더 서류를 무료 OCR+규칙으로 정리해 증빙목록과 대조, 오래 걸리면 이어서)
//  → overview(처리개요: 확정된 값만 빈 칸에 채움, 기준일은 증빙으로 확정 — 비었으면 반영·법정일 재계산)
//  → calc(세액계산: 화면이 계산엔진을 실제로 돌려 사건에 저장) → output(세액인쇄 준비, 이미 낸 신고서는 "참고자료"로 대조,
//    쟁점 문단) → save(결정·남은 일 저장, 작업일지 한 줄) → draft(종합검토서 초안: 쟁점 문단 + 보류 항목 = 추가로 확인할 사항)
// 걸린 항목의 버튼(2026-10-14 세무사님 정의):
//  [확인] = 그 항목의 후보 값을 출처와 함께 보여주고 세무사님이 고르거나 직접 입력 → 사건에 반영(apply) → 파생값 재계산
//  [보류] = 넘어가고 처리는 계속, 장부에 보류로 남고 종합검토서를 쓸 때 "확인 필요 사항"으로(2026.10.31 초안 없앰)
//  [무시] = 완전 제외(다시 묻지 않고 남은 일·검토서 어디에도 안 나옴)
// 값은 지어내지 않는다 — 서류·사건 기록에 있는 것만, 모르면 확인필요. 이미 낸 신고서 값은 입력으로 쓰지 않는다(대조·후보 표시만).
// =========================================================
const CASEPROC_FOLDER_ = '_사건처리점검';

const CASEPROC_TAX_LABEL_ = { transfer: '양도소득세', gift: '증여세', inheritance: '상속세' };

const CASEPROC_BASE_LABEL_ = { transfer: '양도일', gift: '증여일', inheritance: '상속개시일' };

function caseProcFile_(caseId, create) {
  const root = getChiefManagerFolder_();
  if (!root) return null;
  const folder = getOrCreateSubfolder_(root, CASEPROC_FOLDER_);
  const name = String(caseId).replace(/[^\w-]/g, '_') + '.json';
  const it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(name, '{}', 'application/json') : null;
}

// [2026.10.22 속도 S1] 결정 파일(사건별 JSON)을 한 실행 안에서 한 번만 드라이브에서 읽는다 — 한 단계가 이 파일을 수십 번(부르는 곳 48개) 읽어 단계마다 10~30초가 드라이브 왕복이었다(가상양도8 실측).
//  쓸 때(caseProcPatch_·caseProcStore_)는 메모를 새 내용으로 갱신한다. 구글 서버는 실행마다 메모리가 새로 시작하므로 다른 실행과 섞이지 않는다
var CASEPROC_SV_MEMO_ = {};

// [2026.10.28 시정 2단계 — 질문 목록 단일화] 이 파일은 질문 목록(remaining)·질문 결정(decisions)을 더는 갖지 않는다 — 둘 다 사건 장부(CaseLedger.js) 줄이다.
//  불러오기는 장부에서 붙여 돌려주고(부르는 곳 그대로), 쓰기는 그 둘을 떼어 장부로 보낸다. 옛 파일에 남아 있던 둘은 처음 불러올 때 한 번 장부로 옮긴다.
//  [2026.10.28 2차 — 답 저장소 단일화] 양도 답 저장소(trAns)도 같은 길 — 장부에서 세무사님·넥스가 정한 양도 칸 줄을 뽑아 붙이고, 바뀐 답만 장부로(CaseLedger.js ledgerAnsRead_·ledgerAnsWrite_).
//  [2026.10.28 3차] 상속 세부 답(ihChoices — 장례비·채무 확정·분할 귀속·보험금 넣을지 등)도 같은 길(장부 i.q.<열쇠>·i.qdiv.<열쇠>, 질문 줄과 같은 칸).
//  [2026.10.28 5차] 값 고치기 이력(valueHist)은 장부 줄 이력에서 세무사님·넥스 고침을 뽑은 모양(ledgerFixHist_), 되돌리기는 장부 되돌리기 하나.
var CASEPROC_LEDGER_KEYS_ = ['remaining', 'decisions', 'trAns', 'ihChoices', 'valueHist'];

function caseProcQHasLegacy_(o) { return CASEPROC_LEDGER_KEYS_.some(function (k) { return k in o; }) || !!(o.filled && Object.keys(o.filled).some(function (k) { return LEDGER_FILLED_KEYS_.indexOf(k) !== -1; })); }

function caseProcQHydrate_(caseId, o) {
  if (caseProcQHasLegacy_(o)) return o; // 장부로 못 옮긴 옛 파일(장부 쓰기 실패) — 잃지 않게 그대로
  try { const q = ledgerQRead_(caseId); o.remaining = q.remaining; o.decisions = q.decisions; } catch (e) { console.error('장부 질문 읽기 실패: ' + (e && e.message || e)); o.remaining = []; o.decisions = {}; }
  try { o.trAns = ledgerAnsRead_(caseId); } catch (e) { console.error('장부 답 읽기 실패: ' + (e && e.message || e)); o.trAns = {}; }
  try { o.ihChoices = ledgerMapRead_(caseId, 'ih'); } catch (e) { console.error('장부 상속 답 읽기 실패: ' + (e && e.message || e)); o.ihChoices = {}; }
  try { o.valueHist = ledgerFixHist_(caseId); } catch (e) { console.error('장부 값 이력 읽기 실패: ' + (e && e.message || e)); o.valueHist = []; }
  // [2026.10.28 4차 — 증여] 근거 기록(filled)의 증여 계산 칸은 장부 g.<칸> 줄에서 붙인다(나머지 칸 — 기준일·양도·상속 — 은 파일 그대로)
  try { o.filled = Object.assign({}, caseProcGiftFilledSplit_(o.filled || {}).rest, ledgerGiftFilledRead_(caseId)); } catch (e) { console.error('장부 증여 근거 읽기 실패: ' + (e && e.message || e)); }
  return o;
}

function caseProcGiftFilledSplit_(filled) { const gift = {}, rest = {}; Object.keys(filled || {}).forEach(function (k) { (LEDGER_FILLED_KEYS_.indexOf(k) !== -1 ? gift : rest)[k] = filled[k]; }); return { gift: gift, rest: rest }; }

function caseProcQSplit_(saved) {
  const s = Object.assign({}, saved), q = { rem: s.remaining, dec: s.decisions, ans: s.trAns, ih: s.ihChoices, vh: s.valueHist };
  CASEPROC_LEDGER_KEYS_.forEach(function (k) { delete s[k]; });
  let gf; if (s.filled && typeof s.filled === 'object') { const fs = caseProcGiftFilledSplit_(s.filled); s.filled = fs.rest; gf = fs.gift; }
  return { file: s, rem: q.rem, dec: q.dec, ans: q.ans, ih: q.ih, gf: gf, vh: q.vh }; // 값 이력(vh)은 장부 이력에서 뽑은 모양이라 쓸 때 버린다(옛 파일만 옮김)
}

function caseProcQMigrate_(caseId, o, f) {
  if (!caseProcQHasLegacy_(o)) return o;
  const sp = caseProcQSplit_(o);
  try {
    if (sp.ans && typeof sp.ans === 'object') ledgerAnsWrite_(caseId, Object.assign({}, ledgerAnsRead_(caseId), sp.ans)); // 옛 답 — 장부에 이미 있는 세무사님 답은 그대로 두고 더한다
    if (sp.ih && typeof sp.ih === 'object') ledgerMapWrite_(caseId, 'ih', Object.assign({}, ledgerMapRead_(caseId, 'ih'), sp.ih));
    if (sp.gf && Object.keys(sp.gf).length) ledgerGiftFilledWrite_(caseId, Object.assign({}, ledgerGiftFilledRead_(caseId), sp.gf)); // 옛 근거 기록의 증여 칸
    if (Array.isArray(sp.vh) && sp.vh.length) ledgerFixHistMigrate_(caseId, sp.vh); // 옛 값 고치기 기록 — 장부에 보관(보이기만)
    if (sp.rem !== undefined || sp.dec !== undefined) ledgerQWrite_(caseId, Array.isArray(sp.rem) ? sp.rem : undefined, sp.dec && typeof sp.dec === 'object' ? sp.dec : undefined);
    if (f) f.setContent(JSON.stringify(sp.file)); return sp.file;
  } catch (e) { console.error('옛 질문·결정·답 장부 옮기기 실패: ' + (e && e.message || e)); return o; }
}

// 질문 하나를 다시 보일 수 있는 모양으로(선택지·후보·근거 글) — 저장(caseProcSave_)과 장부 질문 줄이 같은 모양을 쓴다
function caseProcQSan_(it) {
  it = it || {};
  const o = { id: String(it.id || '').slice(0, 200), step: String(it.step || '').slice(0, 20), kind: String(it.kind || '').slice(0, 10), text: String(it.text || '').slice(0, 300) };
  const a = it.ask;
  if (a && typeof a === 'object' && (a.target || a.mode)) {
    const sa = {};
    Object.keys(a).forEach(function (k) { const v = a[k]; if (k === 'cands' || k === 'options' || k === 'aiJudge') return; if (v == null) return; if (typeof v === 'object') { try { const s = JSON.stringify(v); if (s.length <= 2000) sa[k] = JSON.parse(s); } catch (e) {} } else sa[k] = typeof v === 'string' ? v.slice(0, 600) : v; });
    sa.cands = (Array.isArray(a.cands) ? a.cands : []).slice(0, 12).map(function (q) { return { v: String(q && q.v != null ? q.v : '').slice(0, 300), label: String((q && q.label) || '').slice(0, 160), src: String((q && q.src) || '').slice(0, 160) }; });
    if (Array.isArray(a.options)) sa.options = a.options.slice(0, 20).map(function (q) { return { label: String((q && q.label) || '').slice(0, 200), value: q && q.value != null ? q.value : '', decide: q && q.decide, note: q && q.note ? String(q.note).slice(0, 120) : undefined }; });
    if (a.aiJudge && typeof a.aiJudge === 'object') sa.aiJudge = { by: a.aiJudge.by, model: a.aiJudge.model, value: a.aiJudge.value, sure: a.aiJudge.sure, why: String(a.aiJudge.why || '').slice(0, 300) };
    o.ask = sa;
  }
  if (it.detail) o.detail = String(it.detail).slice(0, 1500);
  return o;
}

function caseProcLoad_(caseId) {
  const k = String(caseId || '');
  if (CASEPROC_SV_MEMO_[k]) return caseProcQHydrate_(caseId, JSON.parse(CASEPROC_SV_MEMO_[k])); // 복사본 — 부른 곳이 고쳐도 메모가 오염되지 않게
  try { const f = caseProcFile_(caseId, false); const s = f ? (f.getBlob().getDataAsString('UTF-8') || '{}') : '{}'; let o = JSON.parse(s) || {}; o = caseProcQMigrate_(caseId, o, f); CASEPROC_SV_MEMO_[k] = JSON.stringify(o); return caseProcQHydrate_(caseId, o); } catch (e) { return caseProcQHydrate_(caseId, {}); }
}

// =========================================================
// [2026.10.22 사건 작업 기록부] 세무사님 원문: "AI는 내 비서로서 내가 일을 시키든 시키지않든 간에 항상 내옆에서 내가 하는 일을 지켜봐야 하겠지"
//  / "직접 처리하다가 남은 작업을 AI에게 시킬 수 있으니 이것을 어떻게 할지나 고민하라" / "내가 GAS도구를 직접 사용한다고!"
//  세무사님이 GAS 도구로 하신 일·넥스가 한 일을 사건별 파일(sv.workLog)에 한 줄씩(누가·언제·무엇) 남긴다(0원).
//  넥스는 부를 때 이 기록부와 반영 현황표를 먼저 보고 남은 일만 이어 받는다(job_lookup caseproc · 넥스 도구 case_status — caseProcNexView_).
// =========================================================
function caseProcNow_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }

// =========================================================
// [2026.10.27 2026-10-27 양도 실사건 결함 A·C·경우별 저장] 세무사님 원문: "즉, 종합하면 ai는 내가 직접 작업하는 것을 완전히 대행할 수 있어야 한다는 것이다."
//  · 칸 값 고치기(valueFix) — 이미 확정돼 남은 질문에서 빠진 칸(과세대상 구분·필요경비·사건분류 등)도 어느 칸이든 값을 넣고(같은 반영 경로 caseProcApply_),
//    전 값·전 출처를 기록부에 남기고, 그 칸이 걸린 남은 질문은 닫는다. 넥스가 세무사님이 정하신 값을 고치려 하면 바꾸지 않고 needConfirm으로 돌려준다
//    (채팅 넥스는 [실행] 카드 = 세무사님 확인(confirmed), 지휘 넥스는 ask_user로 여쭘). 되돌리기(valueUndo)는 마지막 고침의 전 값으로.
//    2026-10-27 15:04 오류기록 "넣을 칸이 다릅니다(넣을칸 undefined)" — caseproc_answer가 남은 질문의 qid·target 짝만 받아 확정 칸을 못 고쳐 세액 0원이 그대로 남았다.
//  · 질문 닫기(decide) — 넥스가 서류로 푼 질문(서류 ⚠ 확인 7건이 네 바퀴 그대로 다시 물어짐)·세무사님이 답한 질문을 결정으로 닫아 다음 바퀴에 다시 묻지 않게.
//  · 경우(안)별 계산 저장(scenario) — 세무사님 원문: "모든 경우를 세액계산기를 돌려서 각각 저장하기로 저장되어야 하고 저장된 세액계산 내용을 인용하여 검토서에 반영할 수 있어야 한다".
//    기본 저장본(세무사님 값·확정 입력)은 덮지 않고, 바꾼 칸만 적용한 입력으로 서버 엔진(정답지 점검기와 같은 조립)을 돌려 세액계산결과 배열에 `안` 항목으로 따로 저장한다.
//  모두 세무사님도 화면(사건처리 GAS 칸·세액계산 화면)에서 같은 입구로 누른다(공통원칙 "넥스가 부르는 도구는 세무사님도 직접").
// =========================================================
var CASEPROC_FIX_LABELS_ = { 'calc:a0.assetType': '과세대상 구분', expenses: '필요경비', trTaxFee: '신고 세무비용', 'ov:사건분류': '사건분류', base: '기준일', 'calc:c0.totalPrice': '양도가액', 'calc:a0.acquisitionPrice': '취득가액', 'calc:a0.acquisitionDate': '취득일', 'calc:a0.assetLocation': '소재지', 'calc:seller.name': '양도인 성명', 'calc:c0.buyer.relation': '양수인 관계' };

// [2026.10.27 I] 화면에 보이는 칸 이름은 한국어(코드 이름은 title로만) — 세무사님 "코드 이름 대신 하는 일을 말한다"
var CASEPROC_FIELD_KO_ = {
  assetType: '과세대상 구분', assetKind: '자산 종류', assetLocation: '소재지', assetDong: '동', assetHo: '호', assetArea: '면적', acquisitionDate: '취득일', acquisitionPrice: '취득가액', transferPrice: '양도가액', transferDate: '양도일', isOneHouseOneFamily: '1세대1주택', isNonBusinessLand: '비사업용 토지', isUnregisteredTransfer: '미등기양도', isOverseasAsset: '국외자산',
  standardPriceAcquisition: '취득 기준시가', standardPriceTransfer: '양도 기준시가', acquisitionStandardPriceForExpense: '취득당시 기준시가', transferStandardPriceForConversion: '양도당시 기준시가', donorRelation: '증여자 관계', giftReceivedDate: '증여받은 날', doneeOwnAcquisitionPrice: '수증자 취득가액', holdingYears: '보유기간(년)', residenceYears: '거주기간(년)',
  totalPrice: '양도가액', date: '양도일', name: '성명', regNo: '주민등록번호', address: '주소', relation: '관계', multiHouseCount: '보유 주택 수', isTransferorResident: '거주자 여부',
  costs: '필요경비', taxfee: '신고 세무비용', 사건분류: '사건분류', split: '필지별 자산', compSplit: '보상 필지', relFmv: '시가(특수관계)',
  trTransferorName: '양도인 성명', trTransferorRegNo: '양도인 주민등록번호', trTransferorAddress: '양도인 주소', trBuyerName: '양수인 성명', trBuyerRegNo: '양수인 주민등록번호', trBuyerRelation: '양수인 관계', 기준일: '기준일', 양도가액: '양도가액', 취득가액: '취득가액', 취득일: '취득일', 주택판단: '주택 여부', 면적: '면적',
  giftDoneeName: '수증자 성명', giftDonorName: '증여자 성명', giftRelation: '관계', giftAmount: '증여재산가액', giftPriorAmount: '10년 내 합산 증여액', giftPriorPaidTax: '기납부 증여세', giftPriorDeductionUsed: '기사용 공제액', giftDebtAssumed: '인수채무', giftDebtProven: '채무 입증', giftAppraisalFee: '감정평가수수료', 증여재산종류: '증여재산 종류',
  ihDeceasedName: '피상속인 성명', 상속인성명: '대표 상속인 성명', 상속인수: '상속인 수',
  transferExpenseItems: '양도비용', totalExpenseItems: '양도비용', acquisitionExpenseItems: '취득비용', isOneHouseOneFamily: '1세대1주택 비과세 전제', buyerRelation: '양수인 관계', relatedPartyActualPrice: '실제 거래가액(특수관계)',
  giftDate: '증여일', taxableEstateAmount: '상속세 과세가액', hasSpouse: '배우자 있음', childCount: '자녀 수', netFinancialAssets: '순금융재산', funeralCostAmount: '장례비', debtAssumedAmount: '인수채무', priorGiftAmount: '10년 내 합산 증여액', appraisalFeeAmount: '감정평가수수료', isGenerationSkip: '세대생략'
};

function caseProcFieldLabel_(key) {
  const k = String(key || ''); let m;
  if (CASEPROC_FIX_LABELS_[k]) return CASEPROC_FIX_LABELS_[k];
  if (k === 'expenses' || k === 'calc:costs') return '필요경비';
  if ((m = /^calc:(.+)$/.exec(k))) {
    const p = m[1]; let mm;
    // [2026-11-10] 한 사건 안 여러 사람 — seller1.*·c0.buyer1.*(숫자 없으면 0번, 옛 꼴 그대로)
    if ((mm = /^seller(\d*)\.(\w+)$/.exec(p))) return '양도인' + (Number(mm[1] || 0) ? String(Number(mm[1]) + 1) : '') + ' ' + (CASEPROC_FIELD_KO_[mm[2]] || mm[2]);
    if ((mm = /^c(\d+)\.buyer(\d*)\.(\w+)$/.exec(p))) return (Number(mm[1]) ? '계약' + (Number(mm[1]) + 1) + ' ' : '') + '양수인' + (Number(mm[2] || 0) ? String(Number(mm[2]) + 1) : '') + ' ' + (CASEPROC_FIELD_KO_[mm[3]] || mm[3]);
    if ((mm = /^c(\d+)\.(\w+)$/.exec(p))) return (Number(mm[1]) ? '계약' + (Number(mm[1]) + 1) + ' ' : '') + (CASEPROC_FIELD_KO_[mm[2]] || mm[2]);
    if ((mm = /^a(\d+)\.(\w+)$/.exec(p))) return (Number(mm[1]) ? '자산' + (Number(mm[1]) + 1) + ' ' : '') + (CASEPROC_FIELD_KO_[mm[2]] || mm[2]);
    return CASEPROC_FIELD_KO_[p] || p;
  }
  if ((m = /^ovAsset:(\d+):(.+)$/.exec(k))) return '물건' + (Number(m[1]) + 1) + ' ' + (CASEPROC_FIELD_KO_[m[2]] || m[2]);
  if ((m = /^ov:(.+)$/.exec(k))) return CASEPROC_FIELD_KO_[m[1]] || m[1];
  if ((m = /^case:(.+)$/.exec(k))) return m[1];
  return CASEPROC_FIELD_KO_[k] || k;
}

function caseIsFiledReturnFolder_(name) { return /^\s*양도\s*코리아\s*$/.test(String(name || '')); }

// [2026.10.17 별건·참고 하위폴더] 판례·예규·불복사례·참고자료 폴더 이름
function caseProcRefDirName_(n) { return /불\s*복\s*사\s*례|판\s*례|예\s*규|에\s*규|질\s*의\s*회\s*신|참\s*고\s*자\s*료|관\s*련\s*법\s*령|관\s*련\s*법\s*규|관\s*련\s*법\s*률|관\s*련\s*조\s*문|해\s*석\s*사\s*례|^\s*법\s*규\s*$/.test(String(n || '')); } // [2026.10.18 정밀분석 12] 「관련법규」 폴더(고객BD 질의회신 12건)·「에규」 오타도

// [2026.10.15 일괄점검] 이전 작업(옛 채팅·검토)이 만든 보고서 — 결론·세액이 들어 있어 입력으로 읽으면 답을 베끼게 된다. 원시자료(의뢰서·상담 메모·번역본)는 읽는다.
// [2026.10.22 꿰맞추기 점검 묶음1] 일반 규칙: 우리 사무소가 만든 보고서인지는 내용(사무소 상호·사업자번호 + 계산·검토 내용 — caseProcOfficeAuthoredWhy_) 먼저 보고,
//  내용에 기관(세무서·지자체·사업시행자)·다른 전문가(감정평가·법무·회계·세무법인)가 쓴 표시가 있으면 이름이 "검토서·계산근거"여도 살린다.
//  파일 이름은 글자를 못 읽었을 때(text 없음)의 보조 — 그때도 이름에 기관·다른 전문가 낱말이 있으면 살린다(예: LH 「보상금 계산근거」, 감정평가 「검토서」).
//  text: 이미 읽은 글자(없으면 이름만 봄 — 예전 부르는 곳은 그대로)
function caseProcIsPriorReport_(name, text) {
  const n = String(name || '').replace(/\s+/g, '');
  const nameHit = /(종합검토서|신고보고서|검토서|검토내용|검토\s*자료|검토\s*보고서|자문보고서|경과지|작업진행|체크리스트|계산근거|추징\s*예상|예상\s*세액|해명\s*자료|(상속|증여|양도)세\s*계산|구비\s*서류)/.test(n) && !/의뢰서/.test(n);
  const tx = caseProcReadableText_(text);
  if (tx) {
    if (caseProcOfficeAuthoredWhy_(name, tx)) return true; // 내용으로 사무소 작성물
    if (!nameHit) return false;
    return !caseProcOtherAuthorText_(tx); // 이름은 보고서인데 기관·다른 전문가 글이면 살림, 아니면 이름으로 짐작
  }
  if (!nameHit) return false;
  return !CASEPROC_OTHER_AUTHOR_NAME_RE_.test(n);
}

// [2026.10.22 꿰맞추기 점검 묶음1] 판정에 쓸 만큼 읽힌 글자인지 — 한글 40자 이상(흐린 사진·빈 글자는 이름 보조로)
function caseProcReadableText_(text) {
  if (text === null || text === undefined) return '';
  const t = String(text);
  return (t.slice(0, 20000).match(/[가-힣]/g) || []).length >= 40 ? t : '';
}

// [2026.10.22 꿰맞추기 점검 묶음1] 사무소가 만든 보고서·초안인지(내용) — 이 사무소 표시(상호 「이음 세무컨설팅」·사업자번호)와 계산·검토 내용(세액 계산 칸·
//  ㅇ 머리표 검토 항목·검토의견·결론)이 함께 있을 때. 사무소 발행 영수증(상호만 있음)은 따로(사무소발행 영수증 규칙).
//  사무소 계산표의 의뢰·사실 구획을 살리는 판정(caseProcOfficeCalcWhy_)·마크다운 메모·바탕 템플릿으로 만든 의뢰서는 여기서 통째로 빼지 않는다(그쪽 규칙이 따로 봄)
var CASEPROC_OFFICE_MARK_RE_ = /이\s*음\s*세\s*무\s*컨\s*설\s*팅|112\s*-\s*36\s*-\s*31504/;

var CASEPROC_OTHER_AUTHOR_NAME_RE_ = /LH|한국토지주택공사|토지주택공사|공사|감정평가|법무법인|법무사|회계법인|세무법인|세무회계|세무서|국세청|시청|구청|군청|은행|증권|보상/;

function caseProcOfficeAuthoredWhy_(name, text) {
  const t = String(text || '').slice(0, 20000);
  if (!CASEPROC_OFFICE_MARK_RE_.test(t)) return '';
  // 신고 서식·접수증·납부서는 보고서가 아니다 — 우리가 대리해 낸 신고서에도 세무대리인 상호가 찍힌다(경정·수정 사건의 당초 신고서는 입력, 결과물 규칙이 따로 봄)
  const ok = caseProcOutputKind_(t);
  if (ok === 'own' || ok === 'gi' || caseProcFilingSlipKind_(t)) return '';
  const calc = [/과\s*세\s*표\s*준/, /산\s*출\s*세\s*액/, /총\s*부\s*담\s*세\s*액|결\s*정\s*세\s*액|추\s*징\s*(?:예\s*상\s*)?세\s*액|예\s*상\s*세\s*액|납\s*부\s*할\s*세\s*액/].filter(function (re) { return re.test(t); }).length;
  const review = (t.match(/(?:^|\n|\t)\s*ㅇ\s*[가-힣]/g) || []).length >= 2 || /검\s*토\s*의\s*견|검\s*토\s*결\s*과|결\s*론|처\s*리\s*방\s*향|자\s*본\s*적\s*지\s*출\s*검\s*토/.test(t);
  return calc >= 1 || review ? '사무소 작성 표시(상호·사업자번호)와 계산·검토 내용' : '';
}

// [2026.10.22 꿰맞추기 점검 묶음1] 기관·다른 전문가가 쓴 글 표시(직인·기관장·법인 이름) — 우리 사무소 작성물이 아니다
//  본문 속 "세무서장에게 청구" 같은 설명 문장에 걸리지 않게 글 머리·끝(각 800자 — 발신 기관·직인·작성자 자리)만 본다
function caseProcOtherAuthorText_(text) {
  const s = String(text || ''), t = s.length > 1600 ? s.slice(0, 800) + '\n' + s.slice(-800) : s;
  if (CASEPROC_OFFICE_MARK_RE_.test(s.slice(0, 20000))) return false;
  return /세\s*무\s*서\s*장|지\s*방\s*국\s*세\s*청\s*장|국\s*세\s*청\s*장|감\s*정\s*평\s*가\s*(?:법\s*인|사\s*사\s*무\s*소)|법\s*무\s*법\s*인|법\s*무\s*사\s*사\s*무\s*소|회\s*계\s*법\s*인|세\s*무\s*법\s*인|세\s*무\s*회\s*계|세\s*무\s*사\s*사\s*무\s*소|회\s*계\s*사\s*무\s*소|한\s*국\s*토\s*지\s*주\s*택\s*공\s*사|사\s*업\s*시\s*행\s*자|(?:시|구|군)\s*청\s*장|(?:특\s*별|광\s*역)\s*시\s*장|도\s*지\s*사/.test(t);
}

// [2026.10.17 묶음11] 마크다운으로 쓴 우리 메모 — 글자인식 원문에 마크다운 표시가 그대로 남는다. 고객 서류(관공서·은행·법무사 출력물)에는 이런 줄이 없다.
function caseProcLooksOurMemo_(t) {
  t = String(t || '').slice(0, 3000);
  const marks = [/(?:^|\n)\s*#{1,4}\s+\S/, /\|\s*:?-{3,}:?\s*\|/, /(?:^|\n)\s*```/, /(?:^|\n)\s*>\s+\S[^\n]*\*\*/].filter(function (re) { return re.test(t); }).length;
  return marks >= 2;
}

// '' = 결과물 아님 · 'own' = 양도세 신고서·간편계산 등(어느 세목이든 결과물) · 'gi' = 증여세·상속세 신고 서식(양도 사건에선 입력)
function caseProcOutputKind_(text) {
  const t = String(text || '').slice(0, 3000);
  // [2026.10.16] 홈택스 "양도소득세 간편계산 결과 조회" — 이전에 해 본 계산 결과(고객W: 양도가액 3억4,500만원이 영수증처럼 경비 후보가 됐다)
  //  [2026.10.16 1:1 고객W] 신고서가 아니라 참고자료(calc) — 양도코리아 폴더로 옮길 대상이 아니다. 결과 화면 머리("간편계산 결과 조회", "간편 계산 (부동산)")가 있을 때만
  //  (고객 손글씨 자료 목록의 "7. 양도소득세 간편계산(부동산중개사 작성)" 한 줄로 목록 전체를 신고서로 보고 뺐다)
  if (/간\s*편\s*계\s*산\s*결\s*과\s*조\s*회|간\s*편\s*계\s*산\s*\(\s*부\s*동\s*산\s*\)/.test(t)) return 'calc';
  // [2026.10.17 묶음11] 우리 사무소(세무사님·Claude)가 쓴 마크다운 메모·계산을 PDF로 뽑은 것 — 고객 증빙이 아니다(고객G: 계산 메모 PDF "법무견적서.pdf"가
  //  법무사 견적 5,077,968원으로 읽혀 진짜 견적서 옆에 하나 더 잡혔다). 마크다운 표시(# 제목 줄·|---| 표 구분줄·``` 코드줄) 중 둘 이상이면 우리 메모
  if (caseProcLooksOurMemo_(t)) return 'memo';
  // [2026.10.18 정밀분석 원인12] 양도코리아 출력물("◆ 양도소득계산명세 계산근거 ◆ … 양도코리아 www.ydkorea.net" — 고객X) — 이름이 잘려 이름 규칙을 빠져나갔다. 양도세 결과물(own)
  if (/ydkorea|양\s*도\s*코\s*리\s*아/i.test(t) && /계\s*산\s*근\s*거|계\s*산\s*명\s*세|과\s*세\s*표\s*준|산\s*출\s*세\s*액/.test(t)) return 'own';
  if (/양도\s*소득\s*과세\s*표준\s*(예정\s*|확정\s*)?신고\s*및\s*(자진\s*)?납부\s*계산서|양도\s*소득\s*금액\s*계산\s*명세서|취득\s*가액\s*및\s*필요\s*경비\s*계산\s*상세\s*명세서|개인\s*지방\s*소득세\s*과세\s*표준\s*(예정\s*|확정\s*)?신고|별지\s*제\s*84\s*호\s*서식|양도\s*소득\s*세?\s*결정\s*(결의서|통지)/.test(t)) return 'own';
  if (/(상속|증여)세\s*과세\s*표준\s*신고\s*및\s*자진\s*납부\s*계산서|공과금\s*[·ㆍ.]?\s*장례\s*비용\s*및\s*상속\s*공제\s*명세서|증여\s*재산\s*(및\s*)?평가\s*명세서|재\s*산\s*평\s*가\s*명\s*세\s*서|연부\s*연납\s*(허가\s*)?신청서|납세\s*담보\s*제공서|납세\s*보증서|상속인별\s*납부할\s*세액|(상속|증여)세?\s*결정\s*(결의서|통지)/.test(t)) return 'gi'; // [2026.10.16] 연부연납·납세담보·결정통지 등 신고 뒤 절차 서류도
  return '';
}

// [2026.10.18 정밀분석 원인3] 사건 종류를 작업관리 칸(업무유형·사건명)만이 아니라 폴더 안 서류로도 판정한다.
//  고객AJ(세목 칸 "불복"인 양도 경정청구 → 불복 경로로 빠져 세액계산기가 꺼짐) · 고객Z(하위폴더 "추가분/당초신고내역" — 이의재결 증액분 수정신고를 새 신고로 처리)
//  · 고객F(세무조사 사전통지·소명요구·결과통지가 있는 양도 "상담"을 새 신고로 처리).
//  파일·하위폴더 이름과, 이름이 안내·통지·결정·신고서인 파일 중 이미 읽어 둔 글자(새 글자인식 없음)만 본다 — caseProcFiles_는 부르지 않는다(그 안에서 caseProcIsAppeal_를 부름).
//  블라인드: 우리 사무소 작업물(보고서_내부·검토서·종합검토서·해명자료 등 이전 작업 보고서·_로 시작)과 "양도코리아"(정답지)·판례 폴더는 신호로 쓰지 않는다.
//  돌려주는 것: { amend: [근거], audit: [근거], notice: [근거], appealDoc: [근거], tax: { transfer|gift|inheritance: [근거] } }
var CASEPROC_SIG_MEMO_ = {};

function caseProcDocSignals_(c) {
  const fid = String((c && c.폴더ID) || '').trim();
  if (!fid) return { amend: [], audit: [], notice: [], appealDoc: [], tax: {}, weak: {} };
  const hit = CASEPROC_SIG_MEMO_[fid];
  if (hit && Date.now() - hit.at < 120000) return hit.sig;
  const entries = [];
  let cnt = 0;
  const walk = function (folder, depth, rel) {
    if (depth > 5 || cnt > 400) return;
    const it = folder.getFiles();
    while (it.hasNext() && cnt <= 400) { const f = it.next(); cnt++; entries.push({ name: f.getName(), rel: rel, isDir: false, f: f, mime: String(f.getMimeType ? f.getMimeType() : '') }); }
    const subs = folder.getFolders();
    while (subs.hasNext()) {
      const sf = subs.next(), sn = sf.getName();
      if (caseIsFiledReturnFolder_(sn) || tcIsSubmitDir_(sn) || caseProcRefDirName_(sn) || /보\s*고\s*서\s*_?\s*내\s*부/.test(sn)) continue; // [2026.10.19] _신고제출 사본의 신고서를 "이미 신고함" 신호로 보지 않게(3번 판정)
      entries.push({ name: sn, rel: rel, isDir: true, f: null });
      walk(sf, depth + 1, rel ? rel + '/' + sn : sn);
    }
  };
  try { walk(DriveApp.getFolderById(fid), 0, ''); } catch (e) {}
  // 이미 읽어 둔 글자만(새 글자인식 없음)
  const read = function (x) {
    const prevNo = TC_NO_NEW_OCR_; TC_NO_NEW_OCR_ = true;
    try { return String(tc_docText_({ id: x.f.getId(), name: x.f.getName(), mimeType: x.f.getMimeType(), modified: x.f.getLastUpdated().getTime() }) || '').slice(0, 3000); } catch (e) { return ''; } finally { TC_NO_NEW_OCR_ = prevNo; }
  };
  const sig = caseProcDocSignalsFrom_(c, entries, read);
  CASEPROC_SIG_MEMO_[fid] = { at: Date.now(), sig: sig };
  return sig;
}

// [2026.10.22 꿰맞추기 점검 묶음4·5] 사건 성격(경정·수정·조사·불복) 판정 — 내용 먼저, 파일·폴더 이름은 보조.
//  예전엔 이름만으로 정했다: 폴더 이름에 "당초"·"경정"이 있거나 「수정신고 안내.pdf」 한 장이 있으면 경정 사건, 「세무조사 사전통지」 이름이면 조사 사건 —
//  참고로 받아 둔 안내문 하나, 이름만 그럴듯한 폴더 하나로 사건 경로(당초 신고서를 입력으로·불복 항목표·세액계산기 끄기)가 바뀌었다.
//  일반 규칙: ① 작업관리 업무유형·사건명이 먼저(caseProcIsAmend_·caseProcIsAppeal_가 이미 먼저 봄) ② 서류 본문의 서식 제목(경정청구서·수정신고서·세무조사 통지·결정결의서·
//   납세고지서·불복 청구서, "당초" 폴더 안의 이미 낸 신고서 본문)이 "내용 신호" — 그대로 판정 근거 ③ 이름만 맞고 본문을 아직 못 읽은 것, 본문이 안내문(수정신고를 "하셔야" 등 권유)인 것은
//   "약한 신호" — 업무유형이 이미 그 성격을 말하거나, 업무유형이 성격을 말하지 않을 때(빈칸·상담·자문) 서로 다른 서류·폴더 둘 이상이 같은 쪽을 가리킬 때만 판정에 넣고
//   "(파일 이름으로 짐작)"·"(글: 안내문)"을 붙인다. 업무유형이 새 신고·신청이면 약한 신호만으로는 바꾸지 않는다 ④ 본문을 읽었는데 이름과 다른 서류면 그 이름 신호는 버린다.
//  국세기본법 §45(수정신고)·§45의2(경정청구)·§81의7(세무조사 사전통지)·§81의12(결과통지)·§81의15(과세전적부심사)·§55~(불복) — 판정 기준(세법)은 그대로, 근거를 고르는 순서만 바꿈.
//  entries: [{ name, rel, isDir, f, mime }] — read(x): 이미 읽어 둔 글자('' = 못 읽음). 돌려주는 것: { amend, audit, notice, appealDoc, tax, weak: { 종류: [근거] } }
function caseProcDocSignalsFrom_(c, entries, read) {
  const sig = { amend: [], audit: [], notice: [], appealDoc: [], tax: {}, weak: {} };
  const KINDS = ['amend', 'audit', 'notice', 'appealDoc'];
  const strong = {}, weak = {};
  KINDS.forEach(function (k) { strong[k] = []; weak[k] = []; });
  const push = function (l, why) { if (l.length < 4 && l.indexOf(why) === -1) l.push(why); };
  const addTax = function (t, why) { const l = sig.tax[t] = sig.tax[t] || []; if (l.length < 3 && l.indexOf(why) === -1) l.push(why); };
  const nameKinds = function (n, isDir) {
    const o = [];
    if (/경\s*정\s*청\s*구|수\s*정\s*신\s*고|당\s*초\s*신\s*고/.test(n) || (isDir && /당\s*초|경\s*정/.test(n))) o.push('amend');
    if (/세\s*무\s*조\s*사|소\s*명\s*(요\s*구|자\s*료|서)|과\s*세\s*예\s*고|결\s*정\s*결\s*의\s*서|조\s*사\s*결\s*과\s*통\s*지/.test(n)) o.push('audit');
    if (/고\s*지\s*(서|내\s*역)/.test(n) && !/취\s*득\s*세|등\s*록|재\s*산\s*세|자\s*동\s*차|주\s*민\s*세/.test(n)) o.push('notice');
    if (/이\s*의\s*신\s*청|심\s*판\s*청\s*구|심\s*사\s*청\s*구|불\s*복|과\s*세\s*전\s*적\s*부|적\s*부\s*심/.test(n)) o.push('appealDoc');
    return o;
  };
  const isOurs = function (n) { return /^_|^~\$/.test(n) || caseProcIsPriorReport_(n) || /종합검토|신고서식\.pdf$|^양코_/.test(n); }; // 우리 작업물·정답지는 신호로 안 씀
  const docLike = function (x) { return !x.isDir && x.f && /pdf|^image\//.test(String(x.mime || '')); };
  const label = function (x) { return (x.isDir ? '하위폴더 「' : '「') + (x.rel && !x.isDir ? x.rel + '/' : '') + x.name + '」'; };
  // ① 이름 신호(보조)와 세목 신호 — 세목(당초 신고 세목)은 예전과 같이 이름·본문 둘 다(사건 성격과 따로)
  const nameHits = []; // { x, kinds }
  const dirHits = []; // { x, path, kinds }
  entries.forEach(function (x) {
    const n = String(x.name || '');
    if (!x.isDir && isOurs(n)) return;
    const ks = nameKinds(n, x.isDir);
    if (x.isDir) { if (ks.length) dirHits.push({ x: x, path: x.rel ? x.rel + '/' + n : n, kinds: ks }); return; }
    if (ks.length) nameHits.push({ x: x, kinds: ks });
    if (/신\s*고\s*서|접\s*수\s*증|납\s*부\s*서|신\s*고\s*내\s*역|경\s*정\s*청\s*구|특\s*례\s*적\s*용/.test(n)) {
      const nt = caseProcNameTax_(n);
      if (CASEPROC_TAX_LABEL_[nt]) addTax(nt, label(x));
      else if (/상\s*생\s*임\s*대|1\s*세\s*대\s*1\s*주\s*택/.test(n)) addTax('transfer', label(x)); // 상생임대주택 특례(소득세법 시행령 §155의3)·1세대1주택은 양도소득세 서식
    }
  });
  // ② 본문 읽기 — 이름 신호가 걸린 서류 먼저, 이름 신호 폴더 안 서류(폴더당 2건), 이름이 아무 말 없는 안내·통지·결정·신고서·접수증(이름이 비어 있는 결과통지·안내문)
  const looked = [], seen = {};
  const want = function (x, why) { if (looked.length >= 12 || !docLike(x) || seen[x.f.getId ? x.f.getId() : x.name]) return; seen[x.f.getId ? x.f.getId() : x.name] = 1; looked.push({ x: x, why: why }); };
  nameHits.forEach(function (h) { want(h.x, 'name'); });
  dirHits.forEach(function (d) { entries.filter(function (x) { return !x.isDir && !isOurs(String(x.name || '')) && (x.rel === d.path || String(x.rel || '').indexOf(d.path + '/') === 0); }).slice(0, 2).forEach(function (x) { want(x, 'dir'); }); });
  const taxKnown = Object.keys(sig.tax).length;
  entries.forEach(function (x) { const n = String(x.name || ''); if (x.isDir || isOurs(n)) return; if (/안\s*내|통\s*지|결\s*정|결\s*과|재\s*결|회\s*신|요\s*구/.test(n) || (!taxKnown && /신\s*고\s*서|접\s*수\s*증/.test(n))) want(x, 'peek'); });
  const contentOf = {}; // 파일 → 본문이 가리킨 성격(읽었으면 배열, 못 읽었으면 없음)
  looked.forEach(function (o) {
    const x = o.x, w = label(x);
    let t = '';
    try { t = String(read(x) || ''); } catch (e) { t = ''; }
    if (!t.trim()) return;
    const ks = [];
    const head = t.slice(0, 500);
    if (/세\s*무\s*조\s*사\s*(사\s*전\s*)?(결\s*과\s*)?통\s*지|소\s*명\s*(자\s*료\s*)?(제\s*출\s*)?요\s*구|과\s*세\s*예\s*고\s*통\s*지|결\s*정\s*결\s*의\s*서/.test(t)) { ks.push('audit'); push(strong.audit, w + '(글: 세무조사·결정 서식)'); }
    // 경정청구서·수정신고서는 서식 제목(머리) — 본문 속 "수정신고 하셔야/대상/안내"는 안내문(약한 신호)
    const fk = docFiledReturnKind_(t), ok = caseProcOutputKind_(t);
    if (/경\s*정\s*청\s*구\s*서|과\s*세\s*표\s*준\s*수\s*정\s*신\s*고\s*서|수\s*정\s*신\s*고\s*서/.test(head)) { ks.push('amend'); push(strong.amend, w + '(글: 경정청구서·수정신고서)'); }
    else if (o.why === 'dir' && (fk || ok === 'own' || ok === 'gi')) { ks.push('amend'); push(strong.amend, w + '(글: 당초 신고서 — 하위폴더 「' + x.rel + '」 안)'); }
    else if (/경\s*정\s*청\s*구|수\s*정\s*신\s*고\s*(대\s*상|안\s*내|를|하\s*셔|하\s*여\s*야)/.test(t)) { ks.push('amend'); push(weak.amend, w + '(글: 수정신고·경정청구 안내문)'); }
    if (/납\s*세\s*고\s*지\s*서/.test(t) && !/취\s*득\s*세|등\s*록\s*면\s*허\s*세|재\s*산\s*세/.test(t.slice(0, 600))) { ks.push('notice'); push(strong.notice, w + '(글: 납세고지서)'); }
    if (/(이\s*의\s*신\s*청|심\s*판\s*청\s*구|심\s*사\s*청\s*구)\s*서/.test(t.slice(0, 400))) { ks.push('appealDoc'); push(strong.appealDoc, w + '(글: 불복 청구서)'); }
    if (fk && fk.doc !== '결정 통지') addTax(fk.kind, w + '(글: ' + fk.doc + ')');
    else if (/양\s*도\s*소\s*득\s*세/.test(t.slice(0, 300)) && /접\s*수\s*증|신\s*고\s*서/.test(t.slice(0, 300))) addTax('transfer', w + '(글: 양도소득세 접수증·신고서)');
    contentOf[x.f.getId ? x.f.getId() : x.name] = ks;
    if (o.why === 'dir') dirHits.forEach(function (d) { if (x.rel === d.path || String(x.rel || '').indexOf(d.path + '/') === 0) d.read = (d.read || 0) + 1; });
  });
  // ③ 이름 신호 — 본문을 못 읽은 서류만 약한 신호로(읽었는데 이름과 다른 서류면 버림). 폴더 이름은 안 서류를 하나도 못 읽었을 때만
  nameHits.forEach(function (h) {
    const ks = contentOf[h.x.f.getId ? h.x.f.getId() : h.x.name];
    if (ks) return; // 본문으로 이미 정함(같은 성격이면 위에서 내용 신호로 넣었고, 다르면 이름 신호는 버림)
    h.kinds.forEach(function (k) { push(weak[k], label(h.x) + '(파일 이름으로 짐작)'); });
  });
  dirHits.forEach(function (d) { if (d.read) return; d.kinds.forEach(function (k) { push(weak[k], label(d.x) + '(폴더 이름으로 짐작)'); }); });
  // ④ 판정 — 내용 신호는 그대로, 약한 신호는 업무유형이 같은 성격을 말하거나(비어 있으면) 서로 다른 서류 둘 이상일 때만
  const wk = String((c && c.업무유형) || '') + ' ' + String((c && c.사건명) || '');
  const AGREE = { amend: /경\s*정|수\s*정\s*신\s*고/, audit: /조\s*사|소\s*명|해\s*명/, notice: /불\s*복|이\s*의|심\s*판|심\s*사|고\s*지|부\s*과/, appealDoc: /불\s*복|이\s*의|심\s*판|심\s*사|적\s*부/ };
  const typed = /신\s*고|신\s*청/.test(String((c && c.업무유형) || '')); // 업무유형이 새 신고·신청이라고 적혀 있음(상담·자문·빈칸은 성격을 말하지 않은 것)
  KINDS.forEach(function (k) {
    strong[k].forEach(function (w) { push(sig[k], w); });
    if (!weak[k].length) return;
    sig.weak[k] = weak[k].slice();
    const agree = AGREE[k].test(wk), many = weak[k].length >= 2;
    if (strong[k].length || agree || (!typed && many)) weak[k].forEach(function (w) { push(sig[k], w); });
  });
  return sig;
}

// 이름이 가리키는 세목 — '' = 모름, 'gi' = 상속·증여 공통 서식(재산평가명세서·연부연납·납세담보)
function caseProcNameTax_(name) {
  const n = String(name || '').replace(/\s+/g, '');
  if (/부가가?치세|부가세/.test(n)) return 'vat';
  if (/증여세|증여재산/.test(n)) return 'gift';
  if (/상속세/.test(n)) return 'inheritance';
  if (/양도(소득)?세|양도소득|지방소득세/.test(n)) return 'transfer';
  if (/종합소득세|종소세|소득세(수정)?신고/.test(n)) return 'income';
  if (/재산평가명세|평가명세서|연부연납|납세담보/.test(n)) return 'gi';
  return '';
}

// 폴더 서류가 말하는 당초 신고 세목 — 하나로 정해질 때만(양도·증여·상속)
function caseProcDocTax_(c) {
  const t = Object.keys(caseProcDocSignals_(c).tax).filter(function (k) { return CASEPROC_TAX_LABEL_[k]; });
  return t.length === 1 ? t[0] : '';
}

// 경정청구·수정신고·불복·세무조사 사건 — 이미 낸 신고서가 작업 재료(입력)다
//  [2026.10.18] 작업관리 칸에 그런 말이 없어도 폴더 서류(경정청구서·수정신고 안내·당초신고 하위폴더·세무조사 통지·소명요구)가 있으면 같다
function caseProcIsAmend_(c) {
  if (/경정|수정\s*신고|불복|심판|이의\s*신청|심사\s*청구/.test(String((c && c.업무유형) || '') + ' ' + String((c && c.사건명) || ''))) return true;
  const s = caseProcDocSignals_(c);
  return !!(s.amend.length || s.audit.length);
}

// [2026.10.17 불복 경로] 불복·세무조사 사건 — 세목이 양도·증여·상속이 아닌(부가세·종소세 등 부과처분) 불복·조사·해명 사건.
//  양도·증여·상속 세목의 경정·불복은 당초 신고서 경로(caseProcIsAmend_ — 계산기 입력)로 간다.
// [2026.10.18 정밀분석 원인3] ① 세무조사 대응(사전통지·소명요구·결과통지·과세예고·결정결의서)은 세목과 관계없이 처분청 서류 항목표를 띄운다(고객F — 양도 "상담")
//  ② 세목 칸이 "불복"이어도 경정청구·수정신고 서류만 있고 납세고지서·불복 서면이 없으면 불복이 아니다 — 경정청구(국세기본법 §45의2)는 처분 불복이 아니라
//   당초 신고 세목의 재계산이다(고객AJ: 양도소득세 경정청구가 불복 경로로 빠져 계산기가 꺼짐). 그 세목은 caseProcRouteTax_가 정한다.
function caseProcIsAppeal_(c) {
  if (!c) return false;
  const s = caseProcDocSignals_(c);
  if (s.audit.length) return true;
  if (CASEPROC_TAX_LABEL_[c.세목]) return false;
  const word = c.세목 === 'objection' || /불\s*복|이\s*의\s*신\s*청|심\s*판\s*청\s*구|심\s*사\s*청\s*구|세\s*무\s*조\s*사|해\s*명\s*자\s*료|과\s*세\s*전\s*적\s*부|과\s*세\s*자\s*료/.test([c.세목, c.업무유형, c.사건명].join(' '));
  if (!word && !s.notice.length && !s.appealDoc.length) return false;
  if (!s.notice.length && !s.appealDoc.length && caseProcDocTax_(c) && (s.amend.length || /경\s*정|수\s*정\s*신\s*고/.test(String(c.업무유형 || '') + ' ' + String(c.사건명 || '')))) return false;
  return true;
}

// [2026.10.18 정밀분석 원인3] 세목 칸이 양도·증여·상속이 아닌 경정·수정신고 사건 — 폴더 서류(당초 신고서·접수증·납부서의 세목)가 가리키는 세목.
//  caseProc_가 이 실행 동안만 c.세목을 그 세목으로 두고(작업관리 칸은 그대로) 그 세목의 세액계산기 경로로 처리한다. '' = 바꾸지 않음
function caseProcRouteTax_(c) {
  if (!c || CASEPROC_TAX_LABEL_[c.세목] || !caseProcIsAmend_(c) || caseProcIsAppeal_(c)) return '';
  return caseProcDocTax_(c);
}

// 내용으로 본 국세 신고 접수증·납부서(서식 제목에 안 잡히는 홈택스 접수증·국세 납부서) — 'own'(양도소득세) · 'gi'(증여·상속세) · ''
//  지방세(취득세·등록면허세·재산세·지방교육세) 납부서·영수증은 고객 증빙(필요경비)이라 결과물이 아니다
//  서식 제목 판정(caseProcOutputKind_)이 못 잡는 짧은 제목 — 글 머리 400자에 "증여세 과세표준신고서"·"양도소득세 신고서"처럼 국세 신고서 제목이 있고
//  본문에 과세표준·산출세액·납부세액 칸이 있는 것도 신고서로 본다(사본·요약 출력물)
function caseProcFilingSlipKind_(text) {
  const t = String(text || '').slice(0, 3000);
  const receipt = /접\s*수\s*증/.test(t) && /접\s*수\s*(?:번\s*호|일\s*시)/.test(t);
  const slip = /납\s*부\s*서/.test(t) && /전\s*자\s*납\s*부\s*번\s*호|납\s*부\s*번\s*호/.test(t) && !/취\s*득\s*세|등\s*록\s*면\s*허\s*세|재\s*산\s*세|지\s*방\s*교\s*육\s*세|주\s*민\s*세|자\s*동\s*차\s*세/.test(t);
  const title = /(양\s*도\s*소\s*득\s*세?|증\s*여\s*세|상\s*속\s*세)\s*(?:과\s*세\s*표\s*준\s*)?(?:예\s*정\s*|확\s*정\s*|기\s*한\s*후\s*|수\s*정\s*)?신\s*고\s*서/.test(t.slice(0, 400)) && [/과\s*세\s*표\s*준/, /산\s*출\s*세\s*액/, /납\s*부\s*(?:할\s*)?세\s*액/].filter(function (re) { return re.test(t); }).length >= 2;
  if (!receipt && !slip && !title) return '';
  if (/양\s*도\s*소\s*득\s*세/.test(t)) return 'own';
  if (/증\s*여\s*세|상\s*속\s*세/.test(t)) return 'gi';
  return '';
}

function improve_parseAt_(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':00+09:00').getTime() : 0;
}

function docFiledReturnKind_(text) {
  var t = String(text || '').slice(0, 4000);
  // [2026.10.18 정밀분석 3차 고객L] 개인지방소득세(양도소득분) 신고서를 국세 서식보다 먼저 — 첨부서류 줄 "1. 양도소득금액 계산명세서(…) 1부"에 걸려
  //  계산명세서로 판정되고 지방세 산출세액 713,961이 국세 산출세액 자리로 갔다(지방세법 §103의5·§103의7 서식, 세율은 국세의 10분의 1 — §103의3)
  if (/양\s*도\s*소\s*득\s*에\s*대\s*한\s*개\s*인\s*지\s*방\s*소\s*득\s*세\s*과\s*세\s*표\s*준\s*(예\s*정\s*|확\s*정\s*)?신\s*고|개\s*인\s*지\s*방\s*소\s*득\s*세\s*\(\s*양\s*도\s*소\s*득\s*분?\s*\)\s*과\s*세\s*표\s*준\s*(예\s*정\s*|확\s*정\s*)?신\s*고/.test(t.slice(0, 600))) return { kind: 'transfer', doc: '개인지방소득세 신고서', local: true };
  if (/양\s*도\s*소\s*득\s*(\(\s*국\s*외\s*전\s*출\s*자\s*\)\s*)?과\s*세\s*표\s*준\s*(예\s*정\s*|확\s*정\s*)?신\s*고\s*및\s*(자\s*진\s*)?납\s*부\s*계\s*산\s*서|별\s*지\s*제?\s*84\s*호\s*서\s*식\s*\]/.test(t)) return { kind: 'transfer', doc: '신고서' };
  if (/양\s*도\s*소\s*득\s*금\s*액\s*계\s*산\s*명\s*세\s*서|별\s*지\s*제?\s*84\s*호\s*서\s*식\s*부\s*표\s*1\s*\]/.test(t)) return { kind: 'transfer', doc: '양도소득금액 계산명세서' };
  if (/증\s*여\s*세\s*과\s*세\s*표\s*준\s*신\s*고\s*및\s*자\s*진\s*납\s*부\s*계\s*산\s*서/.test(t)) return { kind: 'gift', doc: '신고서' };
  if (/상\s*속\s*세\s*과\s*세\s*표\s*준\s*신\s*고\s*및\s*자\s*진\s*납\s*부\s*계\s*산\s*서/.test(t)) return { kind: 'inheritance', doc: '신고서' };
  // [2026.10.22 가상사건 발견] 줄인 제목 "증여세 과세표준신고서(사본)" — 서류 머리(앞 300자)에 있을 때만(본문의 "…신고서 1부" 첨부 목록 줄에 걸리지 않게)
  var hd0 = t.slice(0, 300), sm = /(증\s*여|상\s*속)\s*세\s*과\s*세\s*표\s*준\s*신\s*고\s*서/.exec(hd0);
  if (sm) return { kind: /상/.test(sm[1]) ? 'inheritance' : 'gift', doc: '신고서' };
  // 세무서 결정 통지(불복 사건의 출발점) — 신고서와 같은 계산 칸이 있다
  var m = /(상\s*속|증\s*여)\s*세\s*과\s*세\s*표\s*준\s*및\s*세\s*액\s*(계\s*산\s*내\s*용\s*)?(통\s*지|결\s*정)/.exec(t);
  if (m) return { kind: /상/.test(m[1]) ? 'inheritance' : 'gift', doc: '결정 통지' };
  return null;
}

// 처리개요 물건목록(양도·증여) → 조회 묶음 입력. 상속은 상속재산 목록에서 따로 만든다
function cpOutsidePropsFromOv_(c) {
  const ov = c.사건개요 || {}, list = Array.isArray(ov.물건목록) && ov.물건목록.length ? ov.물건목록 : (ov.assetLocation ? [ov] : []);
  return list.map(function (q, i) {
    if (!q || !q.assetLocation) return null;
    const dates = [];
    if (q.취득일) dates.push({ label: '취득일', date: q.취득일 });
    if (q.양도일) dates.push({ label: '양도일', date: q.양도일 });
    if (c.기준일) dates.push({ label: CASEPROC_BASE_LABEL_[c.세목] || '기준일', date: c.기준일 });
    const loc = String(q.assetLocation) + (q.assetDong && !/동\s*\d/.test(String(q.assetLocation)) ? ' ' + String(q.assetDong).replace(/동$/, '') + '동' : '') + (q.assetHo && !/\d\s*호/.test(String(q.assetLocation)) ? ' ' + String(q.assetHo).replace(/호$/, '') + '호' : '');
    return { p: 'ovAsset:' + i, loc: loc, kind: q.assetKind === 'land' ? 'land' : (q.assetKind === 'building' || q.assetType === 'house') ? 'building' : '', /* [2026-11-13 4차 15] 주택이면 건축물대장·주택가격도 — 아파트 단지 번지는 토지대장이 안 잡혀 건축물 조회를 건너뛰었다 */ area: Number(q.면적) || 0, jimok: q.assetKind === 'land' ? (q.assetSubType || '') : '', dates: dates };
  }).filter(Boolean);
}

// [2026.10.23 ㅌ7] 처리개요 칸의 한국어 이름 — 질문 카드에 코드 이름(giftAmount)이 그대로 보였다(가상증여9, 모든 노출 글은 한국어)
const CXG_OV_KO_ = { giftAmount: '증여재산가액', giftDebtAssumed: '인수채무액(부담부증여)', giftDebtProven: '인수채무 객관적 입증 서류(§47③ 단서)', giftPriorAmount: '10년 내 같은 증여자 증여 합산액', giftPriorPaidTax: '기증여분 증여 당시 산출세액', giftPriorDeductionUsed: '기증여분 증여재산공제 사용액', giftAppraisalFee: '감정평가수수료', giftDate: '증여일', 기준일: '기준일' };

// [2026.11.01 복잡사건 ①②③④⑥] 고객(가족) 지도 — 세무사님 "고쳐라"(점검서 넥스_복잡사건_능력점검_20261101 4절 방향 1~4·6)
//  원인: 사건 장부 뼈대 = 계산기 칸(한 사건 = 거래 한 건)이라 가족 전체·지난 이전·시간줄을 둘 곳이 없었다.
//  그래서 한 고객(가족)에 파일 하나: 사람·지난 이전(증여·양도·상속·부담부증여·빌린 돈 …, 건별)·미래 계획 — 그 고객의 여러 사건이 함께 본다.
//  저장: 총괄관리자\_사건장부\_가족_<고객ID>.json (사건 장부와 같은 폴더, 같은 잠금). 값 주인(누가)·근거(출처)를 줄마다 남긴다.
//  쓰는 곳: ① 넥스 case_ledger do=family·person·transfer·family_drop·chain·plan ② 장부 증여·상속 계산(지난 증여 자동 합산 — ledgerCalcGiftInh_)
//  ③ 화면 📒 장부 › 가족 탭(같은 함수). GAS 도구라 토큰 0.
var FAM_PREFIX_ = '_가족_';

function famKeyOf_(c) { return String((c && (c.고객ID || c.고객명 || c.id)) || '').trim(); }

function famFile_(key, create) {
  const folder = ledgerFolder_();
  const name = FAM_PREFIX_ + String(key).replace(/[\\/:*?"<>|\s]/g, '_') + '.json';
  const it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(name, '{}', 'application/json') : null;
}

function famEmpty_(key) { return { key: String(key || ''), 사람: [], 이전: [], 계획: [], 법인: [], 지분: [], log: [], at: '' }; }

function famNorm_(o, key) { o = o || {}; o.key = String(key || o.key || ''); ['사람', '이전', '계획', '법인', '지분', 'log'].forEach(function (k) { if (!Array.isArray(o[k])) o[k] = []; }); return o; }

var FAM_MEMO_ = {};

function famLoad_(key, fresh) {
  const k = String(key || '');
  if (!fresh && FAM_MEMO_[k]) return JSON.parse(FAM_MEMO_[k]);
  try { const f = famFile_(k, false); if (!f) return famEmpty_(k); const o = famNorm_(JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}'), k); FAM_MEMO_[k] = JSON.stringify(o); return o; }
  catch (e) { return famEmpty_(k); }
}

// ② 요청 상태 수명주기: 접수 → (PR) → 반영됨 → 확인완료 / 재오픈
function commRequestsLoad_() {
  var chief = getChiefManagerFolder_();
  if (!chief) return { folder: null, tracking: { entries: [] } };
  var tr = {};
  try { tr = JSON.parse(readFileIfExists_(chief, IMPROVEMENT_TRACKING_FILE) || '{}'); } catch (e) { tr = {}; }
  tr.entries = tr.entries || [];
  tr.entries.forEach(function (x) {
    if (!x.id) x.id = 'R' + String(x.at || '').replace(/\D/g, '').slice(2, 12);
    if (!x.status) x.status = '접수';
    if (x.urgent === undefined) x.urgent = /긴급|급함|급해|빨리|당장/.test(x.text || '');
  });
  return { folder: chief, tracking: tr };
}

var COMM_REQ_RESTORE_SINCE_ = '2026-10-09'; // 원장 대조로 되살리는 범위 — 이날부터 루틴이 요청을 직접 처리(그 전은 옛 AI 메모 방식)

// [2026-11-12] 비교 열쇠에서 머리말("🚨 긴급 — "·"(오늘)"·"(개요 · 사건: …)")을 뗀다 — 머리말이 앞 40자를 다 먹어 같은 글을 다른 요청으로 봄(11-01·11-03 요청 중복 사건)
function commReqNorm_(s) { return String(s || '').replace(/^\s*-\s*\[\d{4}-\d{2}-\d{2}[^\]]*\]\s*/gm, '').replace(/^\s*(?:🚨\s*긴급\s*[—-]+\s*)?(?:\((?:[^()]|\([^()]*\)){0,160}\)\s*)?/, '').replace(/\s+/g, ''); }

// 원장의 "- [yyyy-MM-dd HH:mm] 내용" 항목들
function commLedgerItems_(md) {
  return String(md || '').replace(/\r\n/g, '\n').split(/\n(?=-\s*\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\])/).map(function (b) {
    var m = b.match(/^-\s*\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]\s*([\s\S]*)$/);
    return m ? { at: m[1], text: m[2].replace(/\n  /g, '\n').trim() } : null;
  }).filter(function (x) { return x && x.text; });
}

// 상태 기록에서 빠진 원장 요청을 "접수"로 되살린다(30건 자르기로 잃은 것). 되살린 개수를 돌려준다.
// [2026-11-12] 같은 글인지 보는 잣대 셋: ① 원장 시각(at)이 같은 요청이 이미 있음 ② 머리말 뗀 글 앞 40자가 이미 있음 ③ 원장 시각으로 만든 번호(R…)가 이미 있음.
//  예전엔 ②만 봤고 머리말을 안 떼어 11-01·11-03 요청이 "-2" 번호로 다시 생겼다. 등록 길(Code.js processImprovementRequests)도 이제 이 함수로 더한다(isNew=true → restored 표시 없음).
function commReconcile_(st, ledgerMd, isNew) {
  if (!st.folder) return 0;
  var md = ledgerMd != null ? ledgerMd : (readFileIfExists_(st.folder, '개선요구사항.md') || '');
  var all = st.tracking.entries.map(function (x) { return commReqNorm_(x.text); }).join('|');
  var ids = {}, ats = {}; st.tracking.entries.forEach(function (x) { ids[x.id] = 1; ats[String(x.firstAt || x.at || '')] = 1; });
  var added = 0;
  commLedgerItems_(md).forEach(function (it) {
    if (it.at.slice(0, 10) < COMM_REQ_RESTORE_SINCE_) return;
    if (ats[it.at]) return;
    var key = commReqNorm_(it.text).slice(0, 40);
    if (!key || all.indexOf(key) >= 0) return;
    var id = 'R' + it.at.replace(/\D/g, '').slice(2, 12);
    if (ids[id]) return;
    ids[id] = 1; ats[it.at] = 1; all += '|' + key;
    var e = { id: id, at: it.at, text: it.text.slice(0, 4000), status: '접수', urgent: /긴급|급함|급해|빨리|당장/.test(it.text) };
    if (!isNew) e.restored = true;
    st.tracking.entries.push(e);
    added++;
  });
  return added;
}

function commReqDays_(x) { var t = improve_parseAt_(x.firstAt || x.at); return t ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0; }

// 끝나지 않은 요청 전부(오래된 순) + 최근 확인완료 15건. 되살린 것이 있으면 저장까지.
function commRequestsAll_() {
  var st = commRequestsLoad_();
  if (st.folder && commReconcile_(st)) { try { commRequestsSave_(st); } catch (e) {} }
  var pick = function (x) { return { id: x.id, at: x.firstAt || x.at, text: String(x.text || '').slice(0, 400), status: x.status, statusAt: x.statusAt || '', urgent: !!x.urgent, commit: x.commit || '', ver: x.ver || '', days: commReqDays_(x), reopenNote: x.reopenNote || '', restored: !!x.restored, history: (x.history || []).slice(-12) }; };
  var open = st.tracking.entries.filter(function (x) { return x.status !== '확인완료'; }).map(pick)
    .sort(function (a, b) { return improve_parseAt_(a.at) - improve_parseAt_(b.at); });
  var done = st.tracking.entries.filter(function (x) { return x.status === '확인완료'; }).slice(-15).reverse().map(pick);
  return { open: open, done: done };
}

function commRequestsSave_(st) { writeFileOverwrite_(st.folder, IMPROVEMENT_TRACKING_FILE, JSON.stringify(st.tracking), 'application/json'); }

// ⑦ [2026.10.22] 카카오 봇 오류 기록 — 세무사님 "진행하고 일괄배포": 카카오 봇(NETAX_Kakao, 별도 서버)이 실패하면 사건 시트 "카카오오류" 탭에
//  한 줄씩(시각·종류·접속코드·내용) 남긴다. job은 그것을 읽어 대시보드·주간 개선 보고서에 띄운다(파일 저장 실패는 봇이 세무사님께 바로 문자도).
function kakaoErrorsRecent_(days) {
  const sh = SpreadsheetApp.openById(WORK_SHEET_ID).getSheetByName('카카오오류');
  if (!sh || sh.getLastRow() < 2) return [];
  const since = Date.now() - (days || 7) * 86400000, n = Math.min(200, sh.getLastRow() - 1);
  // 시각: 봇이 한국 시각 글자(yyyy-MM-dd HH:mm:ss)로 남긴다(시트 시간대 어긋남 방지). 예전 날짜 값 줄도 읽는다.
  const tsOf = function (v) { if (v instanceof Date) return v.getTime(); const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?/); return m ? Date.parse(m[1] + 'T' + m[2] + (m[3] || ':00') + '+09:00') : 0; };
  return sh.getRange(sh.getLastRow() - n + 1, 1, n, 4).getValues().filter(function (r) { const t = tsOf(r[0]); return t && t >= since; })
    .reverse().slice(0, 30).map(function (r) { return { at: Utilities.formatDate(new Date(tsOf(r[0])), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 종류: String(r[1] || ''), rid: String(r[2] || ''), 내용: String(r[3] || '').slice(0, 200) }; });
}

// ===== [2026-11-13 job 서버 나누기] 관리 서버는 읽기만 — tools/build-light.js가 Generated.js 맨 뒤에 붙인다(같은 이름은 뒤의 것이 이김) =====
// 읽는 길 안에서 쓰기가 필요해지면(옛 기록 옮기기·장부 고치기·잠금·폴더 만들기) 여기서는 하지 않고 NX_LIGHT_WRITE 오류를 낸다.
// Light.js가 이 오류를 「job 서버로 넘김」으로 돌려주고, 화면(gasbridge)은 같은 요청을 job 서버로 다시 보낸다 — 쓰기는 언제나 job 서버 한 곳(잠금도 한 곳).
function nxLightWrite_(what) { throw new Error('NX_LIGHT_WRITE ' + what); }
function withLock_() { nxLightWrite_('잠금'); }
function withLockStrict_() { nxLightWrite_('잠금'); }
function ledgerMutate_() { nxLightWrite_('장부 고치기'); }
function writeFileOverwrite_() { nxLightWrite_('파일 덮어쓰기'); }
function commRequestsSave_() { nxLightWrite_('개선요구 저장'); }
function cpNexQEnqueue_() { nxLightWrite_('넥스 질문 줄'); }
function getOrCreateSubfolder_(parent, name) { const it = parent.getFoldersByName(name); if (it.hasNext()) return it.next(); nxLightWrite_('폴더 만들기'); }
function caseProcQMigrate_(caseId, o, f) { if (!caseProcQHasLegacy_(o)) return o; nxLightWrite_('옛 기록 옮기기'); }
function nxPropsMirrorEnsure_() {} // 거울은 job 서버만 적는다
function nxPropsMirrorWrite_() {}
