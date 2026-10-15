// =========================================================
// [2026.10.14] 🧪 정답지 점검(토큰 0) — "이 사건 처리하자"를 고치고 브라우저로 하나씩 확인하던 핑퐁을 없애려고 만든 회귀시험.
// 사건 폴더의 _정답지.json(세무사님이 확인한 정답 — 저장소에는 절대 넣지 않음, 고객 자료)과, 사이드바가 도는 것과 같은 서버 단계
// (기본 → 증빙 → 처리개요)와 세액계산 화면 엔진(taxcalc-engine.html을 서버에서 그대로 실행)의 결과를 칸별로 대조한다.
// AI 호출 없음. 결과는 업무관리자 폴더 _정답지점검결과.json에 저장하고, 실패는 개선 후보 보고서(buildImprovementReport_)에 올라간다.
//
// 정답지 형식(일부 칸만 있어도 됨 — 있는 칸만 대조):
// { "상태": "초안"|"확정", "출처": "…", "세목": "inheritance",
//   "기준일": "YYYY-MM-DD", "법정일": "YYYY-MM-DD",
//   "피상속인": "…", "상속인수": 4, "상속인": ["이름(관계)", …],
//   "재산": [{ "소재지": "…(일부 낱말)", "가액": 123 }], "금융재산": 0, "장례비": 0, "봉안시설": 0,
//   "과세가액": 0, "과세표준": 0, "산출세액": 0, "신고세액공제": 0, "납부세액": 0,
//   "남은항목": [{ "포함": "봉안시설", "종류": "missing" }],   ← 도구가 물어야 하는 것 전부(이 밖의 질문은 결함)
//   "근거": { "칸": "어느 서류로 확인했는지" } }
// 증여·양도는 기준일·법정일·처리개요 칸·저장된 계산의 최종세액(납부세액)을 대조한다.
// =========================================================
const AK_KEY_NAME_ = '_정답지.json';
const AK_RESULT_NAME_ = '_정답지점검결과.json';
const AK_STATE_PROP_ = 'AK_RUN_STATE';
const AK_CODE_VER_ = '2026-10-16b'; // 점검 규칙을 바꿔 배포할 때마다 올린다 — 멈췄던 점검의 옛 결과를 새 실행에 이어 붙이지 않게

function akReadCase_(caseId) {
  const sheet = work_getSheet_(), col = work_colMap_(sheet.getDataRange().getValues()[0]);
  const found = work_findCaseRow_(sheet, col, caseId);
  return found ? work_readRow_(col, found.row) : null;
}
// [2026.10.15] 한 폴더에 수증자가 여럿이면 정답지도 수증자마다: _정답지.json(사건 납세자) + _정답지(이름).json(다른 수증자 — 안에 "납세자" 칸)
const AK_KEY_RE_ = /^_정답지(?:\(([^)]+)\))?\.json$/;
function akKeyFile_(folderId, name) {
  try {
    const it = DriveApp.getFolderById(folderId).getFilesByName(name || AK_KEY_NAME_);
    return it.hasNext() ? it.next() : null;
  } catch (e) { return null; }
}
function akLoadKey_(c, name) {
  const f = akKeyFile_(String(c.폴더ID || '').trim(), name);
  if (!f) return null;
  try {
    const key = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}');
    const m = AK_KEY_RE_.exec(name || '');
    if (m && m[1] && !key.납세자) key.납세자 = m[1];
    return { key: key, fileId: f.getId() };
  } catch (e) { return { key: null, error: '정답지 JSON을 읽지 못함: ' + e.message, fileId: f.getId() }; }
}
// 정답지가 있는 사건 — Drive 검색 한 번으로(사건 폴더를 하나씩 열지 않음)
function akCasesWithKey_() {
  const sheet = work_getSheet_(), data = sheet.getDataRange().getValues(), col = work_colMap_(data[0]);
  const byFolder = {};
  for (let i = 1; i < data.length; i++) { const fid = String(data[i][col.폴더ID] || '').trim(); if (fid) byFolder[fid] = String(data[i][col.id]); }
  const out = [];
  const it = DriveApp.searchFiles("title contains '_정답지' and trashed = false");
  while (it.hasNext()) {
    const f = it.next(), nm = f.getName();
    if (!AK_KEY_RE_.test(nm)) continue; // "_정답지 (1).json" 같은 동기화 사본·결과 파일은 제외
    const ps = f.getParents();
    while (ps.hasNext()) { const p = ps.next(); const id = byFolder[p.getId()]; if (!id) continue; const q = nm === AK_KEY_NAME_ ? id : id + '|' + nm; if (out.indexOf(q) === -1) out.push(q); }
  }
  return out.sort();
}
const akNorm_ = function (x) { return String(x == null ? '' : x).replace(/\([^)]*\)/g, '').replace(/[\s,·]/g, ''); };
const akDigits_ = function (v) { return String(v == null ? '' : v).replace(/[^\d-]/g, ''); };
function akSame_(exp, got, kind) {
  if (got === null || got === undefined || got === '') return false;
  if (kind === 'money' || kind === 'number') return Number(akDigits_(exp)) === Number(akDigits_(got));
  if (kind === 'list') {
    const a = (exp || []).map(akNorm_).sort(), b = (got || []).map(akNorm_).sort();
    return a.length === b.length && a.every(function (x, i) { return x === b[i]; });
  }
  return akNorm_(exp) === akNorm_(got);
}
// 사건의 지금 값(도구가 낸 값) — 상속은 서류 규칙 정리(caseProcInhFacts_) + 화면 엔진 계산, 증여·양도는 처리개요·저장된 계산
function akToolValues_(c) {
  const v = {}, saved = caseProcLoad_(c.id), filled = saved.filled || {}, ov = c.사건개요 || {};
  const put = function (k, val, src, kind) { v[k] = { v: val, src: src || '', kind: kind || 'text' }; };
  put('기준일', c.기준일 || '', (filled.기준일 && filled.기준일.src) || '사건 기준일', 'date');
  put('법정일', c.법정일 || '', '사건 법정일(기준일로 계산)', 'date');
  if (c.세목 === 'inheritance') {
    const f = caseProcInhFacts_(c);
    put('피상속인', f.deceased.name || '', f.deceased.src);
    put('상속인수', f.heirs.length, f.heirs[0] ? f.heirs[0].src : '서류 없음', 'number');
    put('처리개요 상속인수', ov.상속인수 || '', (filled.상속인수 && filled.상속인수.src) || '처리개요', 'number');
    put('상속인', f.heirs.map(function (h) { return h.name + '(' + (h.relation || '?') + ')'; }), f.heirs[0] ? f.heirs[0].src : '', 'list');
    put('상속인 주민번호', f.heirs.filter(function (h) { return /^\d{6}-\d{7}$/.test(h.regNo || ''); }).length + '/' + f.heirs.length, '전체 번호가 확인된 상속인 수', 'text');
    v._assets = f.assets.map(function (a) { return { loc: a.loc, v: a.value, src: a.valueSrc || (a.cands.length ? '후보 ' + a.cands.length + '개(선택 필요)' : '평가 자료 없음') }; });
    put('금융재산', f.financialValue, f.financialSrc, 'money');
    put('장례비', f.funeral.value, f.funeral.src, 'money');
    put('봉안시설', f.niche && f.niche.value !== null ? f.niche.value : 0, f.niche ? (f.niche.src || (f.niche.receipt ? '영수증 ' + f.niche.receipt.amount.toLocaleString('ko-KR') + '원(공제액 선택 전)' : '공제 0 — 계약서만 있고 납부 증빙 없음')) : '봉안 서류 없음(공제 0)', 'money'); // 계산에 들어가는 공제 대상 금액
    put('총상속재산', f.grossEstate, f.grossEstate ? '부동산 평가 + 금융재산' : '평가 안 끝남', 'money');
    if (f.grossEstate) {
      // [2026.10.16] 과세가액 = 총상속재산 − 공과금 − 채무(§14) — 예전엔 총상속재산을 그대로 넣어 채무·공과금 있는 사건(김창호·박종헌 등)을 과다 계산했다.
      //  채무는 세무사님이 확정한 목록, 없으면 서류로 확실한 것만. 감정평가수수료(§25①)도 화면과 같이 넣는다.
      const debtList = Array.isArray(f.debtsConfirmed) ? f.debtsConfirmed : (f.debts || []).filter(function (d) { return d.sure; });
      const debtSum = debtList.reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0);
      const duesSum = (f.dues || []).reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0);
      v._deductions = { debts: debtSum, dues: duesSum, appraisalFee: f.appraisalFee ? f.appraisalFee.value : 0 };
      const input = { taxableEstateAmount: Math.max(0, f.grossEstate - debtSum - duesSum), appraisalFeeAmount: f.appraisalFee ? f.appraisalFee.value : 0, hasSpouse: f.heirs.some(function (h) { return h.relation === '배우자'; }), childCount: f.heirs.filter(function (h) { return h.relation === '자녀'; }).length,
        netFinancialAssets: f.financialValue || 0, funeralCostAmount: f.funeral.value || 0, funeralNicheCostAmount: (f.niche && f.niche.value) || 0 };
      const r = runUiEngineCalcTool_('calculate_inheritance_tax', input) || { error: '엔진 없음' };
      v._engineInput = input;
      if (r.error) put('계산', '', '엔진 오류: ' + r.error);
      else {
        put('과세가액', (r.상속세과세가액_적용값 || 0) - (r.장례비용공제 || 0), '화면 엔진(상속세과세가액 − 장례비용공제)', 'money');
        put('상속공제', (r.상속공제_합계 || 0) - (r.장례비용공제 || 0), '화면 엔진(일괄·금융재산 등, 장례비 제외)', 'money');
        ['과세표준', '산출세액', '신고세액공제', '납부세액'].forEach(function (k) { put(k, r[k], '화면 엔진', 'money'); });
      }
    } else {
      // [2026.10.15] 계산 못 한 이유 — 평가 안 끝난 재산(후보만·자료 없음)과 원시서류 유무
      const open = f.assets.filter(function (a) { return !a.value; });
      v._why = (f.assets.length ? '상속재산 평가 안 끝남 ' + open.length + '/' + f.assets.length + '건(' + open.slice(0, 3).map(function (a) { return String(a.loc || '').slice(0, 30) + ' — ' + (a.cands.length ? '후보 ' + a.cands.length + '개' : '평가 자료 없음'); }).join(' / ') + ')' : '서류에서 상속재산(등기부·분할협의서)을 찾지 못함')
        + (f.heirs.length ? '' : ' · 상속인(가족관계증명서) 못 찾음') + (akNoSourceDocs_(c) ? ' — 폴더에 원시서류가 없음' : '');
      ['과세가액', '과세표준', '산출세액', '신고세액공제', '납부세액'].forEach(function (k) { put(k, '', v._why, 'money'); });
    }
  } else {
    Object.keys(ov).forEach(function (k) { if (typeof ov[k] !== 'object') put('처리개요 ' + k, ov[k], (filled[k] && filled[k].src) || '처리개요'); });
    // [2026.10.14] 증여 — 사건처리가 서류로 채운 처리개요 값(증여재산가액·관계·인수채무·10년 합산)으로 화면 엔진을 직접 돌린다(저장된 계산이 없는 신고 끝난 사건도 비교되게)
    const digits = function (x) { return Number(String(x == null ? '' : x).replace(/[^\d]/g, '')) || 0; };
    if (c.세목 === 'gift' && !digits(ov.giftAmount)) v._why = '처리개요 증여재산가액이 서류로 채워지지 않음' + (akNoSourceDocs_(c) ? ' — 폴더에 원시서류(계약서·등기부·이체내역 등)가 없음, 신고서만 있음' : '');
    if (c.세목 === 'gift' && digits(ov.giftAmount) && !String(ov.giftRelation || '').trim()) v._why = '증여재산가액은 서류로 채웠으나 관계(증여재산공제)가 서류로 안 정해짐 — 가족관계증명서에 증여자·수증자가 함께 없음';
    if (c.세목 === 'gift' && digits(ov.giftAmount) && String(ov.giftRelation || '').trim()) {
      const rel = String(ov.giftRelation || '');
      const input = { giftAmount: digits(ov.giftAmount), relation: /^배우자/.test(rel) ? '배우자' : /^직계존속/.test(rel) ? '직계존속' : /^직계비속/.test(rel) ? '직계비속' : /기타친족/.test(rel) ? '기타친족' : '기타',
        isGenerationSkip: /2촌 이상/.test(rel), giftDate: c.기준일 || undefined };
      if (digits(ov.giftDebtAssumed)) { input.debtAssumedAmount = digits(ov.giftDebtAssumed); input.isDebtObjectivelyProven = true; }
      if (digits(ov.giftPriorAmount)) input.priorGiftAmount = digits(ov.giftPriorAmount);
      if (digits(ov.giftAppraisalFee)) input.appraisalFeeAmount = digits(ov.giftAppraisalFee); // [2026.10.16] 감정평가수수료(§55①)
      const r = runUiEngineCalcTool_('calculate_gift_tax', input) || { error: '엔진 없음' };
      v._engineInput = input;
      if (r.error) put('계산', '', '엔진 오류: ' + r.error);
      else {
        const src = '화면 엔진(처리개요: 증여재산가액 ' + input.giftAmount.toLocaleString('ko-KR') + '원 · ' + input.relation + (input.debtAssumedAmount ? ' · 인수채무' : '') + (input.priorGiftAmount ? ' · 10년 합산' : (String(ov.giftPriorAmount || '').trim() ? '' : ' · 10년 합산 없음 가정(서류 없음, 질문 남음)')) + ')';
        put('과세표준', r.과세표준, src, 'money'); put('산출세액', r.산출세액_할증후 != null ? r.산출세액_할증후 : r.산출세액, src, 'money');
        put('신고세액공제', r.신고세액공제, src, 'money'); put('납부세액', r.납부세액, src, 'money');
        // 증여세 과세가액 = 과세표준 + 공제(증여재산공제·혼인출산·감정평가수수료·재해손실) — 신고서 과세가액 칸과 같은 정의
        put('과세가액', akGiftTaxable_(input, r), src, 'money');
      }
    }
    // [2026.10.15] 양도 — 사건처리가 서류로 채운 처리개요 물건(양도가액·취득가액·취득일)과 서류 규칙 정리의 취득 부대비용으로 화면 엔진을 직접 돌린다.
    // 1세대1주택·중과·감면처럼 서류로 안 정해지는 사실은 "일반 과세"로 두고 출처에 적는다(그 차이가 정답지와 다르면 그 사실을 물어야 한다는 뜻).
    if (c.세목 === 'transfer') {
      const tr = akTransferEngine_(c, digits);
      if (tr.input) v._engineInput = tr.input;
      // [2026.10.15] 1세대1주택·중과·감면·비사업용토지 여부(사건분류)가 서류로 안 정해졌으면 "일반 과세 가정" 계산값을 도구 값으로 내지 않는다 — 판단 필요(질문)로 분류
      if (tr.result && !tr.result.error && !String(ov.사건분류 || '').trim()) {
        const base0 = tr.result.과세표준 != null ? tr.result.과세표준 : tr.result.합산과세표준, tax0 = tr.result.산출세액 != null ? tr.result.산출세액 : tr.result.산출세액_합계;
        v._judge = true;
        v._why = '판단 필요 — 1세대1주택 비과세·다주택 중과·감면·비사업용토지 여부(사건분류)가 서류로 안 정해짐. 참고: 서류 값으로 일반 과세 계산하면 과세표준 ' + Number(base0 || 0).toLocaleString('ko-KR') + '원 · 산출세액 ' + Number(tax0 || 0).toLocaleString('ko-KR') + '원';
        v._ref = { 과세표준: base0, 산출세액: tax0 };
      } else if (tr.result && !tr.result.error) {
        put('과세표준', tr.result.과세표준 != null ? tr.result.과세표준 : tr.result.합산과세표준, tr.src, 'money');
        put('산출세액', tr.result.산출세액 != null ? tr.result.산출세액 : tr.result.산출세액_합계, tr.src, 'money');
        // 엔진의 납부세액_합계에는 지방소득세(10%)가 들어 있다 — 신고서 "납부할 세액"(국세)과 맞추려고 뺀다
        const tot = tr.result.납부세액_합계 != null ? tr.result.납부세액_합계 : tr.result.납부세액;
        put('납부세액', tot != null ? tot - (tr.result.지방소득세 || tr.result.지방소득세_합계 || 0) : '', tr.src, 'money');
      } else if (tr.why) v._why = tr.why;
    }
    // [2026.10.15] 블라인드 — 저장된 세액계산 결과는 도구 값으로 쓰지 않는다(이전 세션이 그 사건만 따로 계산해 둔 값이 "통과"로 잡혔다)
    if (!v.납부세액) put('납부세액', '', v._why || (c.세목 === 'transfer' ? '양도 거래 값이 처리개요에 없음' : '처리개요에 증여재산가액이 없어 계산 못 함'), 'money');
    if (v._why) ['과세표준', '산출세액'].forEach(function (k) { if (!v[k]) put(k, '', v._why, 'money'); });
  }
  return v;
}
var AK_LAST_EV_ = null; // 이 실행의 증빙 단계 결과(원시서류 수 등) — 값이 비는 이유를 "서류 없음"과 "규칙이 못 읽음"으로 나누려고
function akNoSourceDocs_(c) { return !!(AK_LAST_EV_ && AK_LAST_EV_.caseId === c.id && !AK_LAST_EV_.srcDocs); }
// [2026.10.15] 양도 — 처리개요 물건 + 서류 규칙 정리(취득 부대비용)로 화면 엔진 계산. 값이 비면 계산하지 않고 이유(어느 칸이 비었는지·서류가 없는지)를 돌려준다.
function akTransferEngine_(c, digits) {
  const ov = c.사건개요 || {};
  const rf = CASEPROC_LAST_RF_ && CASEPROC_LAST_RF_.caseId === c.id ? CASEPROC_LAST_RF_.rf : null;
  const txs = (rf && rf.transactions) || [];
  const rfWhy = rf && rf.ok ? ' — 서류 규칙 정리: 계약서 ' + rf.counts.계약서 + '·신고필증 ' + rf.counts.신고필증 + '·등기부 ' + rf.counts.등기부 + ((rf.evidence || []).filter(function (e) { return /비움|못|⚠/.test(e); }).length ? ' / ' + rf.evidence.filter(function (e) { return /비움|못|⚠/.test(e); }).slice(0, 3).join(' / ') : '') : (rf && rf.error ? ' — 서류 규칙 정리 실패: ' + rf.error : '');
  const noSrc = akNoSourceDocs_(c) ? ' — 폴더에 원시서류(계약서·등기부 등)가 없음, 신고서만 있음' : '';
  const assets = (Array.isArray(ov.물건목록) && ov.물건목록.length ? ov.물건목록 : [ov]).filter(function (a) { return digits(a.양도가액) || digits(a.취득가액) || a.취득일 || a.assetLocation; });
  if (!assets.length) return { why: '처리개요에 양도 물건(양도가액·취득가액·취득일)이 없음' + (noSrc || rfWhy) };
  const missing = [], inputs = [];
  let expAll = 0;
  assets.forEach(function (a, i) {
    const tp = digits(a.양도가액), ap = digits(a.취득가액), ad = String(a.취득일 || '').trim(), td = String(a.양도일 || c.기준일 || '').trim();
    const n = assets.length > 1 ? '물건' + (i + 1) + ' ' : '';
    if (!tp) missing.push(n + '양도가액'); if (!ap) missing.push(n + '취득가액'); if (!ad) missing.push(n + '취득일'); if (!td) missing.push(n + '양도일');
    const t = txs.filter(function (x) { return x.assetLocation && a.assetLocation && tcLocSame_(x.assetLocation, a.assetLocation); })[0] || (txs.length === 1 && assets.length === 1 ? txs[0] : null);
    const exp = ((t && t.acquisitionExpenses) || 0) + ((t && t.transferExpensesOnly) || 0); // 취득 부대비용 + 자본적지출·양도비
    expAll += exp;
    inputs.push({ transferPrice: tp, acquisitionPrice: ap, acquisitionDate: ad, transferDate: td, necessaryExpenses: exp, assetType: /house|presale_right/.test(String(a.assetType || '')) ? a.assetType : 'other' });
  });
  if (missing.length) return { why: '서류로 못 채운 값: ' + missing.join(', ') + (noSrc || rfWhy) };
  const multi = inputs.length > 1;
  const input = multi ? { transactions: inputs } : inputs[0];
  const r = runUiEngineCalcTool_(multi ? 'calculate_transfer_tax_multi' : 'calculate_transfer_tax', input) || { error: '엔진 없음' };
  const src = '화면 엔진(처리개요 물건 ' + inputs.length + '건' + (expAll ? ' · 취득 부대비용 ' + expAll.toLocaleString('ko-KR') + '원' : ' · 필요경비 0') + ' · 일반 과세 가정 — 1세대1주택·중과·감면·양도비용은 서류 규칙으로 안 정해짐)';
  return { input: input, result: r, src: src, why: r.error ? '엔진 오류: ' + r.error : '' };
}
// [2026.10.15] 질문 종류 — 신고 끝난 사건의 질문을 "진짜 모르는 것"과 "도구 결함"으로 나눠 센다
function akQuestionKind_(it) {
  const id = String(it.id || ''), t = String(it.text || '');
  if (/^ev:/.test(id)) return it.kind === 'missing' ? '서류 없음' : '서류 대조(비슷한 파일 있음)';
  if (/^file:/.test(id)) return '판독 ⚠';
  if (/^ov:사건분류/.test(id)) return '사건분류 판단';
  if (/^ov:giftPriorAmount$/.test(id)) return '10년 합산';
  if (/^ov:.*:(diff|est|cashdiff)/.test(id) || /^cf:/.test(id)) return '처리개요↔서류 다름';
  if (/^ov:/.test(id)) return it.kind === 'missing' ? '처리개요 빈 칸' : '처리개요 후보 선택';
  if (/^base:/.test(id)) return '기준일';
  if (/^basic:업무유형/.test(id)) return '사건 관리'; // 세액과 무관한 사건 관리 칸 — 질문이 아니라 할 일로 센다
  if (/^basic:/.test(id)) return '사건 기본정보';
  if (/^(rf|tx):/.test(id)) return '양도 서류 정리';
  if (/^ih:/.test(id)) return '상속재산 평가';
  return t ? '기타' : '기타';
}
const AK_FIELD_KIND_ = { 기준일: 'date', 법정일: 'date', 상속인수: 'number', 상속인: 'list', 금융재산: 'money', 장례비: 'money', 봉안시설: 'money', 총상속재산: 'money', 과세가액: 'money', 상속공제: 'money', 과세표준: 'money', 산출세액: 'money', 신고세액공제: 'money', 납부세액: 'money' };
// [2026.10.14] 점검은 읽기 전용 — 사이드바와 같은 단계를 돌리되 사건 시트(work_updateCase)·결정 파일(caseProcPatch_/Store_) 쓰기는
// 이 실행 안의 메모리에만 한다. 실사건 자료(증빙목록·처리개요·기준일·작업일지)는 바뀌지 않는다. 끝나면 원래 함수로 되돌린다.
function akSandbox_(caseId, fn, override) {
  const real = { work_updateCase: work_updateCase, work_findCaseRow_: work_findCaseRow_, work_readRow_: work_readRow_, caseProcLoad_: caseProcLoad_, caseProcPatch_: caseProcPatch_, caseProcStore_: caseProcStore_, akReadCase_: akReadCase_ };
  const mem = { c: real.akReadCase_(caseId), saved: real.caseProcLoad_(caseId) };
  if (!mem.c) return fn();
  // [2026.10.15] 블라인드 점검 — 사람·세션이 이전에 넣은 값(처리개요·기준일·법정일·증빙목록 표시·작업일지·세액계산결과·사건처리 결정/채움)을 전부 지우고
  // 사건 폴더 원시서류만으로 처음부터 돌린다. 남기는 것은 사건의 정체(세목·업무유형·고객명·납세자·폴더)뿐. 세무사님 지적: 통과 2건은 그 사건만 따로
  // 처리해 저장해 둔 값 덕분이었고 서류만으로 낸 결과가 아니었다.
  mem.c.사건개요 = {}; mem.c.기준일 = ''; mem.c.법정일 = ''; mem.c.작업일지 = []; mem.c.세액계산결과 = [];
  try { mem.c.증빙목록 = mem.c.업무유형 === '신고' && WORK_EVIDENCE_TEMPLATES_[mem.c.세목] ? work_buildEvidenceFromTemplate_(mem.c.세목, '신고', '', null, '', '') : []; } catch (e) { mem.c.증빙목록 = []; }
  mem.saved = { filled: {}, decisions: {} };
  // [2026.10.15] 한 폴더에 수증자가 여럿(정답지가 수증자별로 하나씩) — 이 실행만 납세자를 그 수증자로 바꾸고, 다른 수증자 몫일 수 있는 처리개요 값은 비운 채 서류로 다시 채운다(메모리에서만)
  if (override && override.납세자) {
    mem.c.납세자 = override.납세자;
    const ov0 = mem.c.사건개요 || {};
    ['giftDoneeName', 'giftAmount', 'giftDebtAssumed', 'giftPriorAmount', 'giftRelation', '사건분류'].forEach(function (k) { delete ov0[k]; });
    mem.c.사건개요 = ov0; mem.c.기준일 = ''; mem.c.법정일 = '';
    mem.saved = { filled: {}, decisions: {} };
  }
  const MARK = { __akMem: true };
  const copy = function (x) { return JSON.parse(JSON.stringify(x)); };
  try {
    akReadCase_ = function (id) { return String(id) === String(caseId) ? copy(mem.c) : real.akReadCase_(id); };
    work_findCaseRow_ = function (sheet, col, id) { return String(id) === String(caseId) ? { rowIndex: -1, row: MARK } : real.work_findCaseRow_(sheet, col, id); };
    work_readRow_ = function (col, row) { return row === MARK ? copy(mem.c) : real.work_readRow_(col, row); };
    work_updateCase = function (p) {
      if (String(p && p.id) !== String(caseId)) return { success: false, message: '점검 중에는 다른 사건을 고치지 않습니다.' };
      Object.keys(p).forEach(function (k) { if (k !== 'id' && k !== '기대수정일') mem.c[k] = copy(p[k]); });
      if (p.기준일 && !p.법정일) { try { mem.c.법정일 = work_calcDeadline_(mem.c.세목, mem.c.업무유형, p.기준일) || mem.c.법정일; } catch (e) {} }
      return { success: true, case: copy(mem.c) };
    };
    caseProcLoad_ = function (id) { return String(id) === String(caseId) ? copy(mem.saved) : real.caseProcLoad_(id); };
    caseProcPatch_ = function (id, mutate) { if (String(id) !== String(caseId)) return null; const s = copy(mem.saved); const o = mutate(s); mem.saved = s; return o === undefined ? s : o; };
    caseProcStore_ = function (id, s) { if (String(id) === String(caseId)) mem.saved = copy(s); };
    return fn();
  } finally {
    akReadCase_ = real.akReadCase_; work_findCaseRow_ = real.work_findCaseRow_; work_readRow_ = real.work_readRow_; work_updateCase = real.work_updateCase;
    caseProcLoad_ = real.caseProcLoad_; caseProcPatch_ = real.caseProcPatch_; caseProcStore_ = real.caseProcStore_;
  }
}
// 한 사건 점검 — 사이드바와 같은 서버 단계를 그대로(확인창·대화 전환 없이) 돌린 뒤 대조. 증빙 단계가 서류를 다 못 읽으면 more
function akRunCase_(caseId, key) { return akSandbox_(caseId, function () { return akRunCase0_(caseId, key); }, key && key.납세자 ? { 납세자: key.납세자 } : null); }
function akRunCase0_(caseId, key) {
  let c = akReadCase_(caseId);
  if (!c) return { caseId: caseId, error: '사건을 찾지 못했습니다.' };
  const out = { caseId: caseId, 사건명: c.사건명 || c.고객명 || '', 상태: key.상태 || '초안', rows: [], extra: [], missing: [], steps: {} };
  const t0 = Date.now();
  TC_NO_NEW_OCR_ = false; // 사건마다 처음엔 켜 둔다(한 실행에서 여러 사건을 처리)
  let ev = caseProcEvidence_(c);
  if (ev.more) return { caseId: caseId, more: true, progress: ev.progress };
  TC_NO_NEW_OCR_ = true; // 이후 단계는 새 글자인식 없이(한도 넘친 서류는 다음 점검에서 증빙 단계가 이어 읽음)
  // [2026.10.16] 서류가 많은 사건(노영환 299개)은 서류 정리만으로 몇 분이 걸려, 이어서 처리개요·두 번째 증빙까지 하면 서버 6분 한도에 걸려
  //  같은 사건을 3번 끊고 건너뛰었다. 서류 정리에 2분 넘게 걸렸으면 여기서 끊고 다음 호출에서 이어 간다(글자·정리 결과는 캐시에 남아 빨라짐).
  if (Date.now() - t0 > 120000) {
    const sc = CacheService.getScriptCache(), sk = 'ak_split_' + caseId; // 사건마다 한 번만 끊는다(10분) — 계속 끊기만 하는 반복 방지
    if (!sc.get(sk)) { sc.put(sk, '1', 600); return { caseId: caseId, more: true, progress: '서류 정리 끝(' + Math.round((Date.now() - t0) / 1000) + '초) — 다음 호출에서 처리개요' }; }
  }
  AK_LAST_EV_ = { caseId: c.id, srcDocs: ev.srcDocs, outDocs: ev.outDocs };
  c = akReadCase_(caseId);
  const ovr = caseProcOverview_(c);
  c = akReadCase_(caseId);
  // [2026.10.15] 블라인드에선 처음 증빙 단계 때 기준일이 비어 있다(처리개요 단계가 서류로 정함) — 사이드바에서 "처리하자"를 한 번 더 한 것처럼 증빙 단계를 다시 돌려 그 기준일로 평가·대조
  const ev2 = caseProcEvidence_(c);
  if (!ev2.more) { ev = Object.assign({}, ev2, { lines: (ev.lines || []).concat(ev2.lines && ev2.lines.length ? ['— 기준일 확정 뒤 다시 대조 —'].concat(ev2.lines) : []) }); c = akReadCase_(caseId); }
  const basic = caseProcBasic_(c, {});
  const calc = caseProcCalc_(c);
  const decisions = (caseProcLoad_(caseId).decisions) || {};
  const live = [].concat(basic.items || [], ev.items || [], ovr.items || [], calc.items || []).filter(function (it) { const d = decisions[it.id]; return !(d && (d.d === '무시' || d.d === 'done')); })
    .filter(function (it) { return !/^calc:/.test(it.id); }); // 세액 재계산 안내는 화면이 하는 일 — 정답 대조는 아래 엔진 계산으로
  out.steps = { evidence: ev.lines || [], overview: ovr.lines || [] };
  out.docTypes = ev.docTypes || [];
  out.srcDocs = ev.srcDocs; out.outDocs = ev.outDocs;
  if (key.납세자) out.수증자 = key.납세자;
  const tool = akToolValues_(c);
  const row = function (field, exp, got, kind) {
    const t = got || { v: '', src: '값 없음' };
    out.rows.push({ field: field, expected: exp, tool: t.v === undefined || t.v === null ? '' : t.v, src: t.src, ok: akSame_(exp, t.v, kind || t.kind || AK_FIELD_KIND_[field]) });
  };
  Object.keys(key).forEach(function (k) {
    if (/^(상태|출처|세목|남은항목|근거|메모|재산|초안판|오류|납세자)$/.test(k) || /^답_/.test(k)) return; // 답_ = 질문의 답으로만 쓰는 신고서 입력값(대조 칸 아님)
    if (k === '상속인수') { row('상속인수', key[k], tool.상속인수, 'number'); row('처리개요 상속인수', key[k], tool['처리개요 상속인수'], 'number'); return; }
    row(k, key[k], tool[k] || tool['처리개요 ' + k], AK_FIELD_KIND_[k]);
  });
  (key.재산 || []).forEach(function (a) {
    const n = akNorm_(a.소재지);
    const hit = (tool._assets || []).filter(function (x) { return akNorm_(x.loc).indexOf(n) !== -1 || n.indexOf(akNorm_(x.loc)) !== -1 || tcLocSame_(x.loc, a.소재지); })[0];
    row('재산 ' + a.소재지, a.가액, hit ? { v: hit.v, src: hit.loc + ' — ' + hit.src, kind: 'money' } : { v: '', src: '도구가 이 재산을 찾지 못함(등기부·분할협의서 정리 확인)' }, 'money');
  });
  if (key.재산) (tool._assets || []).forEach(function (x) {
    if (!(key.재산 || []).some(function (a) { const n = akNorm_(a.소재지); return akNorm_(x.loc).indexOf(n) !== -1 || n.indexOf(akNorm_(x.loc)) !== -1 || tcLocSame_(x.loc, a.소재지); }))
      out.rows.push({ field: '재산(정답지에 없음) ' + x.loc, expected: '(없음)', tool: x.v, src: x.src, ok: false });
  });
  // 남은 항목 — 정답지에 없는 질문은 결함, 정답지에 있는데 도구가 안 물은 것도 결함
  const exp = (key.남은항목 || []).map(function (e) { return typeof e === 'string' ? { 포함: e } : e; });
  const used = {};
  exp.forEach(function (e) {
    const words = String(e.포함 || '').split(/\s+/).filter(String);
    const hit = live.filter(function (it) { return !used[it.id] && words.every(function (w) { return it.text.indexOf(w) !== -1; }) && (!e.종류 || it.kind === e.종류); })[0];
    if (hit) used[hit.id] = true; else out.missing.push(e.포함 + (e.종류 ? ' (' + e.종류 + ')' : ''));
  });
  // [2026.10.15] 서류로는 원래 알 수 없는 사실(10년 안 동일인 증여 — 국세청 자료로만 확인)을 묻는 질문은 결함이 아니라 필요한 질문 —
  // out.needed로 따로 두고 불합격으로 세지 않는다(정답지가 신고서라 남은항목이 비어 이 질문이 늘 "정답지에 없는 질문"으로 잡혔다)
  out.needed = [];
  live.forEach(function (it) { if (used[it.id]) return; const q = { id: it.id, kind: it.kind, cat: akQuestionKind_(it), text: it.text, detail: it.detail || '' }; (q.cat === '10년 합산' ? out.needed : out.extra).push(q); });
  out.qcats = {}; out.extra.forEach(function (x) { out.qcats[x.cat] = (out.qcats[x.cat] || 0) + 1; });
  // ⚠ 서류 질문이 정답지에 없는 것이면 그 서류의 서버 글자인식 원문(앞 4천 자)을 남긴다 — 규칙을 실제 원문으로 고치려고(결과 파일은 업무관리자 폴더, 저장소에는 안 들어감)
  out.ocr = {};
  out.extra.forEach(function (x) {
    const m = /^file:([^:]+):(\d+)$/.exec(x.id);
    if (!m) return;
    try { const f = DriveApp.getFileById(m[1]); out.ocr[f.getName()] = String(tc_docText_({ id: m[1], name: f.getName(), mimeType: f.getMimeType(), modified: Number(m[2]) }) || '').slice(0, 4000); } catch (e) {}
  });
  // [2026.10.15] 종류를 못 정한(미분류) 서류도 원문 앞부분을 남긴다 — 다음 묶음에서 새 서류 규칙을 실제 원문으로 만들려고(사건당 6개·1천5백 자)
  (out.docTypes || []).filter(function (d) { return !d.t && d.id && !caseProcIsOutputDoc_(d.name); }).slice(0, 6).forEach(function (d) {
    if (out.ocr[d.name]) return;
    try { const f = DriveApp.getFileById(d.id); out.ocr['미분류:' + d.name] = String(tc_docText_({ id: d.id, name: d.name, mimeType: f.getMimeType(), modified: f.getLastUpdated().getTime() }) || '').slice(0, 1500); } catch (e) {}
  });
  out.engineInput = tool._engineInput || null;
  out.why = tool._why || '';
  out.judge = !!tool._judge; if (tool._ref) out.ref = tool._ref;
  out.noSourceDocs = !ev.srcDocs;
  out.fails = out.rows.filter(function (r) { return !r.ok; }).length + out.extra.length + out.missing.length;
  out.pass = out.fails === 0;
  try { out.usable = akUsable_(c, key, out, tool); } catch (e) { out.usable = { ok: false, defects: ['판정 오류: ' + (e && e.message || e)] }; }
  out.taxOk = out.rows.length > 0 && out.rows.every(function (r) { return r.ok; }); // 세액 칸은 모두 맞음(질문은 따로 셈)
  try { out.process = akProcessAudit_(c, ev, ovr, live); } catch (e) { out.process = { error: String(e && e.message || e) }; }
  return out;
}
// [2026.10.15 일괄점검] 과정 점검(세무사님 공통 약점 3가지) — 정답과 무관하게 처리 과정만 본다.
//  ① 수집: 폴더 파일마다 정리됨/종류 미정/글자 못 읽음/못 읽음/결과물 제외 — 어디에도 이름이 안 나온 파일 = "말없이 건너뜀"
//  ③ 묻는 방식: 질문마다 객관식(후보·선택지)/주관식(직접 입력)/확인 — 계산 입력 칸을 묻는 질문 수
function akProcessAudit_(c, ev, ovr, live) {
  const all = caseProcFiles_(c);
  const files = all.filter(function (f) { return !/^_|^~\$/.test(f.name) && !/\.json$/i.test(f.name); });
  const memo = caseProcMemoTexts_(c);
  const said = {};
  (ev.docTypes || []).forEach(function (d) { said[d.name] = true; });
  memo.read.forEach(function (m) { said[m.file] = true; });
  const listed = memo.unread.concat(memo.skipped); // "이름(사유)"
  files.forEach(function (f) { if (listed.some(function (x) { return String(x).indexOf(f.name + '(') === 0; })) said[f.name] = true; });
  const hay = [].concat(ev.lines || [], ovr.lines || [], (live || []).map(function (it) { return it.text + ' ' + (it.detail || ''); })).join('\n');
  const silent = files.filter(function (f) { return !said[f.name] && hay.indexOf(f.name) === -1; }).map(function (f) { return f.name; });
  const dt = ev.docTypes || [];
  const q = { 객관식: 0, 주관식: 0, 확인: 0, 입력칸: 0 };
  (live || []).forEach(function (it) {
    const a = it.ask || {};
    const choice = /^(choose|options|giftdeal|expenses|base)$/.test(a.mode) || (a.cands && a.cands.length) || (a.mode === 'evidence' && (a.suggest || []).length);
    if (a.mode === 'input' && !(a.cands || []).length) q.주관식++; else if (choice) q.객관식++; else q.확인++;
    if (a.mode === 'base' || /^(ov:|ovAsset:)/.test(String(a.target || ''))) q.입력칸++;
  });
  return { 파일: files.length, 정리됨: dt.filter(function (d) { return d.t; }).length, 종류미정: dt.filter(function (d) { return !d.t; }).length, 메모읽음: memo.read.length,
    못읽음: memo.unread, 제외: memo.skipped.length + (ev.outDocs || 0), 말없이건너뜀: silent, 질문: q, truncated: !!all.truncated };
}
// [2026.10.16] 점검 진행 저장 — 같은 점검(startedAt)을 다른 실행이 더 많이 진행해 두었으면 덮어쓰지 않는다(진행 수가 25→20으로 되돌아간 일).
//  저장할 때마다 touchedAt(마지막 진행 시각)을 남긴다. 덮어쓰지 않았으면 false.
function akSaveSt_(props, st) {
  try {
    const cur = JSON.parse(props.getProperty(AK_STATE_PROP_) || 'null');
    if (cur && cur.startedAt === st.startedAt && (cur.results || []).length > (st.results || []).length) return false;
  } catch (e) {}
  st.touchedAt = new Date().toISOString();
  props.setProperty(AK_STATE_PROP_, JSON.stringify(st));
  return true;
}
// 🧪 정답지 점검 실행 — {caseId?, reset?}. 사건이 많거나 처음 읽는 서류가 많으면 more:true(화면이 이어서 다시 부름)
function answerKeyRun_(body) {
  body = body || {};
  const props = PropertiesService.getScriptProperties();
  let st = null;
  if (!body.reset) { try { st = JSON.parse(props.getProperty(AK_STATE_PROP_) || 'null'); } catch (e) { st = null; } }
  // [2026.10.15] 이어서 하기는 같은 코드·3시간 안에서만 — 배포 뒤 다시 누르면 옛 코드로 낸 결과 목록을 이어 붙여 새 규칙이 1건에만 적용됐다
  // [2026.10.16] 3시간은 '시작'이 아니라 '마지막 진행'부터 — 서류 많은 사건으로 3시간 넘게 걸린 전체 점검이 25/27에서 처음부터 다시 시작될 뻔했다
  if (st && (st.ver !== AK_CODE_VER_ || st.touchedAt && Date.now() - new Date(st.touchedAt).getTime() > 3 * 3600000)) st = null; // touchedAt 없는 진행(이 규칙 전 옛 실행이 저장)은 이어 감 — 같은 코드 버전 안에서만
  // [2026.10.16] 화면의 이어 부르기(cont)는 진행 중인 점검이 없으면 새로 시작하지 않고 마지막 결과를 돌려준다(끝난 점검을 처음부터 다시 돌리던 것)
  if (!st && body.cont) return { ok: true, result: (answerKeyLast_() || {}).result || null, already: true };
  if (!st || (body.caseId && st.only !== body.caseId)) {
    const ids = body.caseId ? [String(body.caseId)] : akCasesWithKey_();
    st = { only: body.caseId || '', queue: ids, results: [], startedAt: new Date().toISOString(), ver: AK_CODE_VER_ };
  }
  // [2026.10.16] 한 번에 하나만 — 화면이 연결 끊김으로 다시 부를 때 앞선 실행이 아직 돌고 있으면 겹쳐 같은 사건을 처리했다
  // [2026.10.16] 공용 스크립트 잠금(LockService)은 쓰지 않는다 — 점검이 사건 하나를 몇 분씩 처리하는 동안 잠금을 쥐어,
  //  세무사님의 일반 저장(withLock_)과 📥 수정 반영까지 "다른 저장 작업이 진행 중"으로 25분간 막혔다(2026-10-16 새벽).
  //  점검끼리만 겹치지 않게 캐시 표시(7분 뒤 자동 해제 — 서버 실행 한도 6분보다 길게)로 대신한다.
  const akCache = CacheService.getScriptCache(), AK_RUN_FLAG = 'ak_running';
  const akFlag = akCache.get(AK_RUN_FLAG);
  if (akFlag) return { ok: true, more: true, busy: true, busyAge: Math.round((Date.now() - Number(akFlag)) / 1000), tries: st.tries && st.queue[0] ? st.tries[String(st.queue[0])] || 0 : 0, done: st.results.length, total: st.results.length + st.queue.length }; // busyAge: 지금 점검이 몇 초 전에 시작됐는지(진단용)
  akCache.put(AK_RUN_FLAG, String(Date.now()), 380); // 서버 한도 6분 + 20초 — 끊긴 실행이 남긴 표시가 오래 막지 않게
  const lock = { releaseLock: function () { try { akCache.remove(AK_RUN_FLAG); } catch (e) {} } };
  try {
  const started = Date.now();
  while (st.queue.length && Date.now() - started < 60000) {
    const q = String(st.queue[0]), id = q.split('|')[0], keyName = q.split('|')[1] || AK_KEY_NAME_;
    // [2026.10.16] 서버 실행 한도(6분)에 걸려 강제 종료되면 진행이 저장되지 않아 같은 사건을 밤새 반복했다 —
    //  시작 전에 시도 횟수를 저장하고, 진행 없이 3번 끊기면 그 사건은 이유를 밝히고 건너뛴다
    st.tries = st.tries || {}; st.tries[q] = (st.tries[q] || 0) + 1;
    if (!akSaveSt_(props, st)) return { ok: true, more: true, busy: true, stale: true, done: st.results.length, total: st.results.length + st.queue.length }; // 다른 실행이 더 앞서 있음 — 그 진행을 덮어쓰지 않음
    const c = akReadCase_(id);
    const k = c ? akLoadKey_(c, keyName) : null;
    let r;
    if (st.tries[q] > 3) r = { caseId: id, 사건명: c && c.사건명 || '', error: '서버 실행 시간 한도(6분)를 3번 넘겨 이 사건은 건너뜀 — 서류가 너무 많거나 한 서류 읽기가 오래 걸림(사건처리 화면에서 따로 처리하세요)' };
    else if (!c) r = { caseId: id, error: '사건 없음' };
    else if (!k || !k.key) r = { caseId: id, 사건명: c.사건명 || '', error: (k && k.error) || '이 사건 폴더에 ' + keyName + '이 없습니다.' };
    else if (!Object.keys(k.key).some(function (f) { return !/^(상태|출처|세목|근거|메모|초안판|오류|납세자)$/.test(f); })) r = { caseId: id, 사건명: c.사건명 || '', skipped: true, error: '정답지에 대조할 숫자가 없음' + (k.key.오류 ? ' — ' + k.key.오류 : '') };
    else { try { r = akRunCase_(id, k.key); } catch (e) { r = { caseId: id, 사건명: c.사건명 || '', error: '점검 중 오류: ' + (e && e.message || e) }; } }
    if (r && keyName !== AK_KEY_NAME_) { r.keyName = keyName; r.수증자 = r.수증자 || k && k.key && k.key.납세자; }
    if (r.more) { st.tries[q] = 0; akSaveSt_(props, st); return { ok: true, more: true, caseId: id, progress: r.progress, done: st.results.length, total: st.results.length + st.queue.length }; } // 진행이 있었으니 시도 횟수는 처음부터
    st.results.push(r); st.queue.shift();
  }
  if (st.queue.length) { akSaveSt_(props, st); return { ok: true, more: true, done: st.results.length, total: st.results.length + st.queue.length }; }
  } finally { lock.releaseLock(); }
  props.deleteProperty(AK_STATE_PROP_);
  const result = { at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), ver: AK_CODE_VER_, cases: st.results, pass: st.results.filter(function (r) { return r.pass; }).length, total: st.results.filter(function (r) { return !r.skipped; }).length, skipped: st.results.filter(function (r) { return r.skipped; }).length };
  // [2026.10.15] 실사용 가능 n/m — 개발용(규칙을 맞춰 본) 사건과 처음 보는 사건을 나눠 센다
  const usableOf = function (dev) { const xs = st.results.filter(function (r) { return !r.skipped && (r.rows || []).length && (AK_DEV_CASES_.indexOf(r.caseId) !== -1) === dev; }); return { ok: xs.filter(function (r) { return r.usable && r.usable.ok; }).length, n: xs.length }; };
  result.usableDev = usableOf(true); result.usableNew = usableOf(false);
  const dc = {}; st.results.forEach(function (r) { ((r.usable && r.usable.defects) || []).forEach(function (d) { const k = d.replace(/[(—].*$/, '').replace(/\s*\d+건/, '').trim(); dc[k] = (dc[k] || 0) + 1; }); });
  result.defectTop = Object.keys(dc).sort(function (a, b) { return dc[b] - dc[a]; }).slice(0, 5).map(function (k) { return k + ' ' + dc[k] + '건'; });
  try {
    const folder = getBusinessManagerFolder_();
    // [2026.10.15] 세무사님 지시: 점검 내용을 없애지 말고 한 파일에 통합 보관 — 새 결과를 _정답지점검_보관.md 끝에 회차로 이어 붙인다(akArchiveMd_)
    if (folder) {
      try { akArchiveMd_(folder, result); } catch (e) { result.archiveError = String(e && e.message || e); }
      const it = folder.getFilesByName(AK_RESULT_NAME_);
      // [2026.10.16] 사건 하나만 점검(caseId)한 결과로 전체 결과 파일을 덮어쓰지 않는다 — 그 사건 줄만 바꿔 끼운다
      //  (2026-10-16 새벽: 노영환 1건 점검이 27건 결과를 덮어써 설정 🐞 카드와 오프라인 재현기의 파일 대응표가 1건만 남았다)
      if (st.only && it.hasNext()) {
        const file = it.next();
        let prev = null; try { prev = JSON.parse(file.getBlob().getDataAsString('UTF-8')); } catch (e) {}
        if (prev && Array.isArray(prev.cases)) {
          const mine = st.results.map(function (r) { return r.caseId + '|' + (r.keyName || ''); });
          prev.cases = prev.cases.filter(function (r) { return mine.indexOf(r.caseId + '|' + (r.keyName || '')) === -1; }).concat(st.results);
          prev.pass = prev.cases.filter(function (r) { return r.pass; }).length;
          prev.updatedOne = { caseId: st.only, at: result.at, ver: result.ver };
          file.setContent(JSON.stringify(prev));
        } else file.setContent(JSON.stringify(result));
      } else if (it.hasNext()) it.next().setContent(JSON.stringify(result));
      else folder.createFile(AK_RESULT_NAME_, JSON.stringify(result), 'application/json');
    }
  } catch (e) { result.saveError = String(e && e.message || e); }
  return { ok: true, result: result };
}
function answerKeyLast_() {
  try {
    const folder = getBusinessManagerFolder_(), it = folder ? folder.getFilesByName(AK_RESULT_NAME_) : null;
    return it && it.hasNext() ? { ok: true, result: JSON.parse(it.next().getBlob().getDataAsString('UTF-8') || 'null') } : { ok: true, result: null };
  } catch (e) { return { error: String(e && e.message || e) }; }
}
// 개선 후보 보고서용 요약 — 고객 이름 없이 사건 id·칸 이름·종류만(보고서는 공개 저장소 루틴이 읽음)
function answerKeyForReport_() {
  const last = answerKeyLast_().result;
  if (!last) return null;
  const fails = (last.cases || []).filter(function (r) { return !r.pass; }).map(function (r) {
    return { caseId: r.caseId, error: r.error || '', fields: (r.rows || []).filter(function (x) { return !x.ok; }).map(function (x) { return x.field.replace(/^재산 .*/, '재산가액'); }),
      extra: (r.extra || []).map(function (x) { return x.kind + ':' + String(x.id).replace(/:[^:]*$/, ''); }), missing: (r.missing || []).length };
  });
  return { at: last.at, pass: last.pass, total: last.total, fails: fails };
}
// 정답지 저장 — 화면에서 고친 정답지(JSON)를 사건 폴더에 쓴다. 세무사님이 [확정]하면 상태가 확정이 된다.
function answerKeySave_(body) {
  const c = akReadCase_(String(body.caseId || ''));
  if (!c || !String(c.폴더ID || '').trim()) return { error: '사건 또는 사건 폴더가 없습니다.' };
  let key = body.key;
  if (typeof key === 'string') { try { key = JSON.parse(key); } catch (e) { return { error: 'JSON 형식이 아닙니다: ' + e.message }; } }
  if (!key || typeof key !== 'object') return { error: '정답지 내용이 없습니다.' };
  const name = AK_KEY_RE_.test(String(body.name || '')) ? String(body.name) : AK_KEY_NAME_;
  const f = akKeyFile_(c.폴더ID, name), txt = JSON.stringify(key, null, 1);
  if (f) f.setContent(txt); else DriveApp.getFolderById(c.폴더ID).createFile(name, txt, 'application/json');
  return { ok: true, message: '정답지를 저장했습니다(' + (key.상태 || '초안') + ').' };
}
function answerKeyGet_(body) {
  const c = akReadCase_(String(body.caseId || ''));
  if (!c) return { error: '사건이 없습니다.' };
  const k = akLoadKey_(c);
  return { ok: true, key: k ? k.key : null, error: k && k.error };
}
// 양도코리아 결과 PDF → 정답지 초안(토큰 0: 무료 글자인식 + 규칙). 이미 있는 정답지의 "확정" 칸은 건드리지 않는다.
// 서식 이름표(상속세·증여세·양도소득세 과세표준신고 및 자진납부계산서)의 숫자 칸을 이름표 바로 뒤 숫자로 읽는다.
const AK_FORM_LABELS_ = {
  inheritance: [['과세가액', /상\s*속\s*세\s*과\s*세\s*가\s*액/], ['상속공제', /상\s*속\s*공\s*제\s*(?:합\s*계|액)?/], ['과세표준', /과\s*세\s*표\s*준/], ['산출세액', /산\s*출\s*세\s*액/], ['신고세액공제', /신\s*고\s*세\s*액\s*공\s*제/], ['납부세액', /(?:자\s*진\s*)?납\s*부\s*할\s*세\s*액(?:\s*합\s*계)?/]],
  gift: [['과세표준', /과\s*세\s*표\s*준/], ['산출세액', /산\s*출\s*세\s*액/], ['신고세액공제', /신\s*고\s*세\s*액\s*공\s*제/], ['납부세액', /(?:자\s*진\s*)?납\s*부\s*할\s*세\s*액(?:\s*합\s*계)?/]],
  transfer: [['과세표준', /과\s*세\s*표\s*준/], ['산출세액', /산\s*출\s*세\s*액/], ['납부세액', /(?:자\s*진\s*)?납\s*부\s*할\s*세\s*액(?:\s*합\s*계)?/]]
};
// [2026.10.14] 서식 칸 배치는 글자인식마다 달라(숫자가 이름표 뒤가 아니라 다른 열에 몰림) "이름표 바로 뒤 숫자"는 연도(2026)·다른 칸 금액을 잘못 읽었다.
// 이제 세법 계산이 서로 맞는 숫자 묶음만 쓴다: 과세표준 B와 산출세액 T = 누진세율(B)가 문서에 둘 다 있어야 하고,
// 신고세액공제 = 3%(상속·증여), 납부할 세액 = 산출 − 세액공제(문서에 그 금액이 있을 때)까지 맞춰 본다. 맞는 묶음이 없으면 초안을 만들지 않는다(지어내지 않음).
const AK_BR_GI_ = [[1e8, 0.1, 0], [5e8, 0.2, 1e7], [1e9, 0.3, 6e7], [3e9, 0.4, 1.6e8], [Infinity, 0.5, 4.6e8]];
const AK_BR_TR_ = [[1.4e7, 0.06, 0], [5e7, 0.15, 1.26e6], [8.8e7, 0.24, 5.76e6], [1.5e8, 0.35, 1.544e7], [3e8, 0.38, 1.994e7], [5e8, 0.4, 2.594e7], [1e9, 0.42, 3.594e7], [Infinity, 0.45, 6.594e7]];
function akProg_(b, br) { for (let i = 0; i < br.length; i++) if (b <= br[i][0]) return Math.floor(b * br[i][1] - br[i][2]); return 0; }
const AK_FORM_TITLE_ = { inheritance: /상\s*속\s*세\s*과\s*세\s*표\s*준/, gift: /증\s*여\s*세\s*과\s*세\s*표\s*준/, transfer: /양\s*도\s*소\s*득[^\n]{0,20}?과\s*세\s*표\s*준|양\s*도\s*소\s*득\s*세\s*(?:간\s*편\s*)?신\s*고/ };
function akParseFormResult_(text, seMok) {
  const t = String(text || '').replace(/(\d)\.(\d{3})(?=[^\d]|$)/g, '$1,$2');
  if (!AK_FORM_TITLE_[seMok] || !AK_FORM_TITLE_[seMok].test(t)) return {}; // 다른 세목 서식(예: 양도 사건 폴더의 증여세 신고서)은 쓰지 않음
  const nums = [], seen = {};
  (t.match(/\d{1,3}(?:,\d{3})+/g) || []).forEach(function (x) { const v = Number(x.replace(/,/g, '')); if (v >= 1000 && !seen[v]) { seen[v] = true; nums.push(v); } });
  const has = function (v) { return !!seen[v]; };
  const br = seMok === 'transfer' ? AK_BR_TR_ : AK_BR_GI_;
  const pairs = [];
  const taxes = function (b) {
    const out = [akProg_(b, br)];
    if (seMok === 'transfer') { [0.4, 0.5, 0.6, 0.7].forEach(function (r) { out.push(Math.floor(b * r)); }); [0.1, 0.2, 0.3].forEach(function (p) { out.push(akProg_(b, br.map(function (x) { return [x[0], x[1] + p, x[2]]; }))); }); }
    return out;
  };
  nums.forEach(function (b) { if (b < 1000000) return; taxes(b).forEach(function (tx) { if (tx >= 1000 && has(tx) && !pairs.some(function (p) { return p.b === b && p.t === tx; })) pairs.push({ b: b, t: tx }); }); });
  if (!pairs.length) return {};
  // 세액공제 3%·납부세액까지 맞는 짝을 먼저(우연히 맞는 짝 — 예: 증여재산가액 1억 ↔ 공제액 1천만 — 을 거름), 같으면 큰 과세표준(합계 칸)
  const score = function (p) { if (seMok === 'transfer') return 0; const cr = Math.floor(p.t * 0.03); return (has(cr) ? 1 : 0) + (has(p.t - cr) ? 1 : 0); };
  pairs.forEach(function (p) { p.s = score(p); });
  pairs.sort(function (p, q) { return (q.s - p.s) || (q.b - p.b); });
  const out = { 과세표준: pairs[0].b, 산출세액: pairs[0].t };
  if (seMok !== 'transfer') {
    const cr = Math.floor(out.산출세액 * 0.03);
    // 신고세액공제는 (산출 − 다른 공제)×3% — 다른 공제가 없으면 산출×3%, 있으면 문서의 3% 근처 값 중 납부세액과 맞는 것
    const credit = has(cr) ? cr : nums.filter(function (v) { return v < cr && v > cr * 0.5 && has(out.산출세액 - v); })[0];
    if (credit) { out.신고세액공제 = credit; if (has(out.산출세액 - credit)) out.납부세액 = out.산출세액 - credit; }
    const lab = seMok === 'inheritance' ? /상\s*속\s*세\s*과\s*세\s*가\s*액/ : /증\s*여\s*세\s*과\s*세\s*가\s*액/;
    const lm = lab.exec(t);
    if (lm) { const g = (t.slice(lm.index, lm.index + 400).match(/\d{1,3}(?:,\d{3})+/g) || []).map(function (x) { return Number(x.replace(/,/g, '')); }).filter(function (v) { return v >= out.과세표준; })[0]; if (g) out.과세가액 = g; }
    if (out.과세가액 && seMok === 'inheritance' && has(out.과세가액 - out.과세표준)) out.상속공제 = out.과세가액 - out.과세표준; // 감정평가수수료가 있으면 맞지 않아 안 씀
    // [2026.10.15 1:1] 증여 — 질문의 답 전용(답_) 입력값: ⑰ 증여재산가액, ㉓ 증여재산가산액(10년 합산), ⑩ 증여일자. 신고서에 적힌 값만 —
    //  예전엔 10년 합산 질문에 "정답지 과세가액 − 이번 증여"를 답으로 지어냈다(꿰맞추기, 세무사님 지적). ⑰ + ㉓ − 채무 = 과세가액이 맞을 때만 넣는다.
    if (seMok === 'gift' && out.과세가액) {
      const after = function (re, span) { const m = re.exec(t); if (!m) return null; const n = (t.slice(m.index + m[0].length, m.index + m[0].length + (span || 80)).match(/\d{1,3}(?:,\d{3})+|(?:^|\s)0(?=\s|$)/) || [])[0]; return n == null ? null : Number(String(n).replace(/[^\d]/g, '')); };
      const g17 = after(/증\s*여\s*재\s*산\s*가\s*액(?!\s*\()/), g23 = after(/증\s*여\s*재\s*산\s*가\s*산\s*액/, 120), debt = after(/(?:㉒|22)\s*채\s*무/, 60) || 0;
      if (g17 && g23 != null && g17 + g23 - debt === out.과세가액) { out.답_증여재산가액 = g17; out.답_가산액 = g23; }
      else if (g17 && g17 - debt === out.과세가액) { out.답_증여재산가액 = g17; out.답_가산액 = 0; }
      const dm = /증\s*여\s*일\s*자?[^\d]{0,30}(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(t);
      if (dm) out.답_증여일 = dm[1] + '-' + ('0' + dm[2]).slice(-2) + '-' + ('0' + dm[3]).slice(-2);
    }
  } else {
    // [2026.10.15] 초안 6판 — 신고서의 입력값(양도가액·취득가액·필요경비)도 "질문의 답" 전용으로(답_ 칸) 읽는다. 세법 관계가 맞는 숫자 묶음만:
    //  양도소득금액 = 과세표준 + 기본공제 250만, 양도차익 = 소득금액 + 장기보유특별공제(0일 수 있음), 양도가액 − 취득가액 − 필요경비 = 양도차익.
    //  여러 묶음이 맞으면 양도가액이 가장 큰 것, 같으면 취득가액이 큰 것(취득가액과 필요경비가 서로 바뀌어 맞는 경우). 안 맞으면 넣지 않음(지어내지 않음). 대조 칸이 아니라 실사용 판정 ③에서 질문에 답할 때만 쓴다.
    Object.assign(out, akTransferInputs_(nums, out.과세표준));
    const pm = /(?:자\s*진\s*)?납\s*부\s*할\s*세\s*액/.exec(t);
    if (pm) { const p = (t.slice(pm.index, pm.index + 300).match(/\d{1,3}(?:,\d{3})+/g) || []).map(function (x) { return Number(x.replace(/,/g, '')); }).filter(function (v) { return v <= out.산출세액 * 1.5 && v >= 1000; })[0]; if (p) out.납부세액 = p; }
  }
  return out;
}
// [2026.10.15] 초안 4판 — (1) 한 폴더에 수증자별 신고서가 여럿(예: "호-신고서"·"현-신고서")이면 같은 머리글자의 납부서 성명으로 수증자를 정해 정답지를 따로,
// (2) 세율 짝이 없어도 서식 제목이 맞고 금액 칸이 비었거나 과세가액 하나뿐이면 "세액 0원 신고"(비과세·공제 이내) 초안, (3) 신고서가 없고 국세 납부서만 있으면 납부세액만.
function akReturnOwner_(f, all) {
  // 파일 이름 머리(첫 '-'·'_'·공백 앞)가 같은 납부서·접수증의 성명 — 홈택스 신고서 PDF는 성명이 *로 가려져 있다
  const head = function (n) { const m = /^([^-_\s.]{1,6})[-_\s]/.exec(n); return m ? m[1] : ''; };
  const h = head(f.name);
  if (!h) return '';
  const pay = all.filter(function (x) { return x !== f && head(x.name) === h && /납부서|접수증/.test(x.name) && !/지방/.test(x.name); })[0];
  if (!pay) return '';
  const t = String(tc_docText_(pay) || '');
  const m0 = /\(\s*성\s*명\s*\)\s*(?:상\s*호)?\s*\n?\s*([가-힣]{2,4})/.exec(t) || /성\s*명\s*[:：]?\s*([가-힣]{2,4})/.exec(t);
  const bad = /^(사업|상호|주민|등록|주소|성명|납세|세목)/; // 이름 칸 대신 다음 이름표를 읽은 경우
  const m = m0 && !bad.test(m0[1]) ? m0 : (/([가-힣]{2,4})\s*사\s*업\s*자\s*등\s*록\s*번\s*호/.exec(t) || null);
  if (m && !bad.test(m[1])) return m[1];
  // 납부서에서 이름을 못 읽으면 — 폴더의 이름 파일(예: "홍길순.pdf", "주민등본_홍길순.pdf") 중 머리글자("순")가 이름 끝 글자와 맞는 사람이 한 명이면 그 사람
  const people = all.map(function (x) { const s = x.name.replace(/\.[^.]+$/, '').split(/[_\-\s]/).pop(); return /^[가-힣]{3,4}$/.test(s) ? s : ''; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  const hit = people.filter(function (p) { return p.slice(-h.length) === h; });
  return hit.length === 1 ? hit[0] : '';
}
function akZeroReturn_(text, seMok) {
  const t = String(text || '');
  if (!AK_FORM_TITLE_[seMok] || !AK_FORM_TITLE_[seMok].test(t)) return null;
  const nums = (t.match(/\d{1,3}(?:,\d{3})+/g) || []).map(function (x) { return Number(x.replace(/,/g, '')); }).filter(function (v) { return v >= 1000; });
  const uniq = nums.filter(function (v, i, a) { return a.indexOf(v) === i; });
  if (!uniq.length) return { 과세표준: 0, 산출세액: 0, 납부세액: 0, _why: '서식 제목은 맞고 금액 칸이 모두 비어 있음(세액 0원 신고 — 비과세 등으로 추정)' };
  if (uniq.length === 1 && seMok !== 'transfer') return { 과세가액: uniq[0], 과세표준: 0, 산출세액: 0, 납부세액: 0, _why: '금액이 ' + uniq[0].toLocaleString('ko-KR') + '원 하나뿐(과세가액 = 공제액 → 과세표준 0 — 배우자공제 등 공제 이내로 추정)' };
  return null;
}
function akPaySlipAmount_(text, seMok) {
  const t = String(text || '').replace(/(\d),\s+(\d{3})/g, '$1,$2');
  const lab = { transfer: '양\\s*도\\s*소\\s*득\\s*세', gift: '증\\s*여\\s*세', inheritance: '상\\s*속\\s*세' }[seMok];
  if (!lab || !/납\s*부\s*서|영\s*수\s*증\s*서/.test(t)) return null;
  const m = new RegExp('세\\s*목\\s*명[\\s\\S]{0,30}?' + lab + '\\s*(\\d{1,3}(?:,\\d{3})+)').exec(t);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}
function answerKeyDraft_(body) {
  const ids = body && body.caseId ? [String(body.caseId)] : null;
  const sheet = work_getSheet_(), data = sheet.getDataRange().getValues(), col = work_colMap_(data[0]);
  const made = [], started = Date.now();
  let more = false;
  for (let i = 1; i < data.length; i++) {
    const c = work_readRow_(col, data[i]);
    if (ids && ids.indexOf(String(c.id)) === -1) continue;
    if (!ids && !CASEPROC_TAX_LABEL_[c.세목]) continue; // 신고가 끝난(완료) 사건이 정답지 원천이라 완료도 포함
    if (!String(c.폴더ID || '').trim()) continue;
    const ek = akLoadKey_(c);
    if (!ids && ek && ek.key && (ek.key.상태 === '확정' || ek.key.초안판 >= 7)) continue; // 확정·5판 초안은 건너뜀(여러 번 눌러 이어서 진행)
    if (Date.now() - started > 200000) { more = true; break; } // 처음 읽는 서류가 많으면 한 번에 다 못 함 — 화면이 이어서 다시 부름
    const all = caseProcFiles_(c, { includeFiled: true }).filter(function (f) { return /pdf|^image\//.test(String(f.mimeType || '')); });
    const files = all.filter(function (f) { return /양도\s*코리아|yangdo|^양코|신고서|계산서|계산명세/i.test(f.name) && !/지방|종합소득|접수증|납부서/.test(f.name); });
    // 3판 초안에 숫자가 있고 신고서가 하나뿐이면 다시 읽지 않는다(세율 검산 규칙은 그대로) — 4판 표시만
    if (!ids && ek && ek.key && ek.key.초안판 >= 3 && !ek.key.오류 && files.length <= 1 && c.세목 !== 'transfer' && !(c.세목 === 'gift' && all.some(function (f) { return /납부서/.test(f.name); }) && files.length > 1)) { ek.key.초안판 = 7; answerKeySave_({ caseId: c.id, key: ek.key }); continue; }
    const found = []; // {owner, res, src, why}
    files.slice(0, 8).forEach(function (f) {
      const txt = tc_docText_(f) || '';
      let r = akParseFormResult_(txt, c.세목), why = '';
      if (!(r.과세표준 && r.산출세액)) { const z = akZeroReturn_(txt, c.세목); if (!z) return; why = z._why; delete z._why; r = z; }
      const owner = c.세목 === 'gift' && files.length > 1 ? akReturnOwner_(f, all) : '';
      if (found.some(function (x) { return x.owner === owner && x.res.과세표준 === r.과세표준 && x.res.산출세액 === r.산출세액; })) return;
      if (why && found.some(function (x) { return x.owner === owner && !x.why; })) return; // 같은 사람의 숫자 있는 신고서가 이미 있으면 0원 추정은 버림
      found.push({ owner: owner, res: r, src: f.name, why: why });
    });
    if (!found.length && !files.length) {
      const pays = all.filter(function (f) { return /납부서/.test(f.name) && !/지방/.test(f.name); }).slice(0, 2);
      pays.forEach(function (f) { if (found.length) return; const v = akPaySlipAmount_(tc_docText_(f) || '', c.세목); if (v) found.push({ owner: '', res: { 납부세액: v }, src: f.name, why: '신고서가 폴더에 없어 국세 납부서의 ' + CASEPROC_TAX_LABEL_[c.세목] + ' 납부금액만(분납이면 1회차만일 수 있음)' }); });
    }
    if (!found.length) {
      if (ek && ek.key && ek.key.상태 !== '확정') answerKeySave_({ caseId: c.id, key: { 세목: c.세목, 상태: '초안', 초안판: 7, 오류: files.length ? '신고서에서 세율 계산이 맞는 숫자를 찾지 못함' : '신고서·국세 납부서가 폴더에 없음 — 신고서 PDF를 사건 폴더에 저장해 주세요' } });
      if (ids || files.length) made.push({ caseId: c.id, 사건명: c.사건명, error: files.length ? '신고서 PDF ' + files.length + '개(' + files.slice(0, 3).map(function (f) { return f.name; }).join(', ') + ')에서 세율 계산이 맞는 과세표준·산출세액 짝을 찾지 못함(다른 세목 서식이거나 글자인식 불량)' : '신고서 PDF(홈택스·양도코리아)가 사건 폴더에 없음' });
      continue;
    }
    // [2026.10.15] 양도 입력값(답_)이 신고서 한 장에서 안 나오면 신고서·계산명세서 숫자를 합쳐 다시 찾는다(입력값은 명세서 쪽에 있는 경우가 많다)
    if (c.세목 === 'transfer' && found[0] && found[0].res.과세표준 && !found[0].res.답_양도가액) {
      const pool = [], pseen = {};
      files.slice(0, 8).forEach(function (f) { (String(tc_docText_(f) || '').replace(/(\d)\.(\d{3})(?=[^\d]|$)/g, '$1,$2').match(/\d{1,3}(?:,\d{3})+/g) || []).forEach(function (x) { const v = Number(x.replace(/,/g, '')); if (v >= 1000 && !pseen[v]) { pseen[v] = true; pool.push(v); } }); });
      Object.assign(found[0].res, akTransferInputs_(pool.slice(0, 400), found[0].res.과세표준));
    }
    const me = String(c.납세자 || '').replace(/\s+/g, '');
    let mainDone = false;
    found.forEach(function (x) {
      const own = found.length > 1 && x.owner && x.owner !== me ? x.owner : '';
      if (!own) { if (mainDone) return; mainDone = true; } // 사건 납세자 몫은 하나만
      const name = own ? '_정답지(' + own + ').json' : AK_KEY_NAME_;
      const cur = (akLoadKey_(c, name) || {}).key || {};
      const confirmed = cur.상태 === '확정';
      const key = confirmed ? Object.assign({}, cur) : { 세목: c.세목, 상태: '초안', 초안판: 7, 출처: x.src };
      if (own) key.납세자 = own;
      Object.keys(x.res).forEach(function (f) { if (!(confirmed && key[f] !== undefined)) key[f] = x.res[f]; });
      key.근거 = Object.assign({}, confirmed ? (key.근거 || {}) : {}, Object.keys(x.res).reduce(function (o, f) { o[f] = (x.why ? x.why + ' — ' : '') + '신고서(' + x.src + ')' + (x.why ? '' : ' — 글자인식 + 세율 검산(과세표준↔산출세액' + (f === '신고세액공제' || f === '납부세액' ? '↔세액공제↔납부' : '') + ')으로 맞는 숫자') + ', 세무사님 확인 전'; return o; }, {}));
      answerKeySave_({ caseId: c.id, key: key, name: name });
      made.push({ caseId: c.id, 사건명: c.사건명, 수증자: own || undefined, from: x.src, fields: x.res });
    });
  }
  return { ok: true, made: made, more: more };
}

// [2026.10.15] 🧪 결과를 업무관리자/_정답지점검_보관.md 한 파일에 회차로 이어 붙인다(세무사님 지시: 사건별·회차별 파일 말고 통합 보관).
// 형식: "## 회차: 규칙판 (일시, 통과 n/m)" + 목차 + 사건별 상세(칸 대조표·계산 입력값·서류 분류·증빙 메모·질문). 앞 회차는 건드리지 않는다.
const AK_ARCHIVE_NAME_ = '_정답지점검_보관.md';
function akArchiveMd_(folder, result) {
  const won = function (v) { return typeof v === 'number' ? v.toLocaleString('ko-KR') : (v === '' || v == null ? '' : String(v)); };
  const cell = function (v) { return String(v == null ? '' : v).replace(/\|/g, '/').replace(/\n/g, ' '); };
  const cs = result.cases || [];
  const out = ['', '## 회차: 규칙판 ' + (result.ver || '') + ' (' + result.at + ', 통과 ' + result.pass + '/' + result.total + (result.usableNew ? ', 실사용 가능 개발 ' + result.usableDev.ok + '/' + result.usableDev.n + ' · 처음 ' + result.usableNew.ok + '/' + result.usableNew.n : '') + ')', '', (result.defectTop || []).length ? '남은 결함 유형: ' + result.defectTop.join(', ') : '', '',
    '보관본: `' + AK_RESULT_NAME_ + '`의 이 회차 내용 (블라인드 점검 — 사건에 저장된 값 무시, 폴더 원시서류만으로 계산)', '', '### 목차'];
  cs.forEach(function (c, i) { out.push((i + 1) + '. ' + (c.usable && c.usable.ok ? '✅' : '❌') + ' ' + (c.사건명 || c.caseId) + (AK_DEV_CASES_.indexOf(c.caseId) !== -1 ? ' (개발용)' : '')); });
  cs.forEach(function (c, i) {
    out.push('', '---', '', '### ' + (i + 1) + '. ' + (c.pass ? '✅ 통과' : '❌ 불통과') + ' — ' + (c.사건명 || c.caseId), '');
    if (c.skipped || c.error) { out.push('건너뜀: ' + cell(c.error || c.why || '')); return; }
    const u = c.usable || {};
    if (c.usable) out.push('**실사용 ' + (u.ok ? '가능 ✅' : '불가 ❌') + '** — ① 서류값 ' + (u.s1 ? '✅' : '❌') + ' · ② 질문 ' + (u.s2 ? '✅' : '❌') + '(필요 ' + u.need + ' · 불필요 ' + u.noise + ' · 증빙 할 일 ' + u.todo + ') · ③ 답하고 재계산 ' + (u.s3 === 'ok' ? '✅' : u.s3) + (u.s3why ? ' — ' + cell(u.s3why) : '') + ((u.defects || []).length ? ' · 결함: ' + u.defects.map(cell).join(' / ') : ''), '');
    out.push('원시서류 ' + (c.srcDocs || 0) + '개 · 발생문서(신고서 등, 정답지 전용) ' + (c.outDocs || 0) + '개' + (c.judge ? ' · 판단 필요' : '') + (c.noSourceDocs ? ' · 원시서류 없음' : ''), '');
    if ((c.rows || []).length) {
      out.push('| 항목 | 정답(신고서) | 도구 값 | 일치 | 도구 값 출처·사유 |', '|---|---|---|---|---|');
      c.rows.forEach(function (r) { out.push('| ' + [cell(r.field), cell(won(r.expected)), cell(won(r.tool)), r.ok ? '✅' : '❌', cell(r.src || '')].join(' | ') + ' |'); });
    }
    const pr = c.process;
    if (pr && !pr.error) out.push('', '**과정 점검:** 파일 ' + pr.파일 + '개 · 서류 정리 ' + pr.정리됨 + ' · 종류 미정 ' + pr.종류미정 + ' · 메모·문서 읽음 ' + pr.메모읽음 + ' · 못 읽음 ' + (pr.못읽음 || []).length + ' · 결과물 제외 ' + pr.제외
      + ' · ' + ((pr.말없이건너뜀 || []).length ? '⚠ 말없이 건너뜀 ' + pr.말없이건너뜀.length + '개(' + cell(pr.말없이건너뜀.slice(0, 8).join(', ')) + ')' : '말없이 건너뛴 파일 없음 ✅')
      + ' · 질문 객관식 ' + pr.질문.객관식 + ' / 주관식 ' + pr.질문.주관식 + ' / 확인 ' + pr.질문.확인 + ' (계산 입력 칸 질문 ' + pr.질문.입력칸 + ')' + ((pr.못읽음 || []).length ? ' · 못 읽은 파일: ' + cell(pr.못읽음.slice(0, 6).join(', ')) : ''));
    if (c.why) out.push('', '**값이 빈 이유:** ' + cell(c.why));
    if (c.engineInput) out.push('', '**계산에 넣은 값(서류에서 읽음):** `' + JSON.stringify(c.engineInput) + '`');
    if ((c.docTypes || []).length) { out.push('', '**서류 자동 분류(' + c.docTypes.length + '건):**'); c.docTypes.forEach(function (d) { out.push('- ' + d.name + ' → ' + (d.l || '미분류') + (d.wn ? ' (⚠' + d.wn + ')' : '')); }); }
    const st = c.steps || {};
    if ((st.evidence || []).length) { out.push('', '**증빙 점검 단계 메모:**'); st.evidence.forEach(function (x) { out.push('- ' + cell(String(x).slice(0, 160))); }); }
    if ((st.overview || []).length) { out.push('', '**처리개요 단계 메모:**'); st.overview.forEach(function (x) { out.push('- ' + cell(String(x).slice(0, 300))); }); }
    if ((c.extra || []).length) { out.push('', '**도구가 낸 질문(정답지에 없는 것 ' + c.extra.length + '건):**'); c.extra.forEach(function (q) { out.push('- [' + q.cat + '] ' + cell(q.text)); }); }
    if ((c.missing || []).length) { out.push('', '**정답지에 있는데 도구가 안 물은 것:**'); c.missing.forEach(function (q) { out.push('- ' + cell(q)); }); }
    if ((c.needed || []).length) { out.push('', '**서류로 정할 수 없어 묻는 게 맞는 질문:**'); c.needed.forEach(function (q) { out.push('- ' + cell(q.text)); }); }
  });
  const it = folder.getFilesByName(AK_ARCHIVE_NAME_);
  if (it.hasNext()) { const f = it.next(); f.setContent(f.getBlob().getDataAsString('UTF-8') + '\n' + out.join('\n') + '\n'); }
  else folder.createFile(AK_ARCHIVE_NAME_, '# 정답지 점검 보관 — 회차별 통합 기록\n' + out.join('\n') + '\n', 'text/markdown');
}

// =========================================================
// [2026.10.15] '실사용 가능' 판정(세무사님 기준) — 사건 통과 = ①②③ 모두:
//  ① 폴더 원시서류로 채운 값이 맞다(도구가 값을 냈는데 정답과 다르면 결함 "서류값 잘못 읽음/계산 틀림")
//  ② 서류로 못 정한 값마다 질문이 떠 있고(없으면 "물어야 할 걸 안 물음"), 쓸데없는 질문이 없다(판독 ⚠·사건 기본정보·기타 = "불필요 질문")
//     — 미확보 서류 목록(서류 없음·비슷한 파일)은 질문이 아니라 증빙 할 일로 따로 센다
//  ③ 떠 있는 질문에 정답지(신고서) 값으로 답했다고 치고 다시 계산하면 세액이 일치한다. 정답지 값은 "그 질문의 답"으로만 쓴다 —
//     질문이 없던 칸에는 넣지 않는다. 정답지에 그 답이 없어 확인할 수 없으면 '확인불가'(실사용 가능으로 세지 않음).
// =========================================================
const AK_NEED_CATS_ = { '처리개요 빈 칸': 1, '처리개요 후보 선택': 1, '처리개요↔서류 다름': 1, '사건분류 판단': 1, '10년 합산': 1, '기준일': 1, '양도 서류 정리': 1, '상속재산 평가': 1 };
const AK_NOISE_CATS_ = { '판독 ⚠': 1, '사건 기본정보': 1, '기타': 1 };
function akUsable_(c, key, out, tool) {
  const qs = [].concat(out.extra || [], out.needed || []);
  const need = qs.filter(function (q) { return AK_NEED_CATS_[q.cat]; }), noise = qs.filter(function (q) { return AK_NOISE_CATS_[q.cat]; });
  const todo = qs.filter(function (q) { return !AK_NEED_CATS_[q.cat] && !AK_NOISE_CATS_[q.cat]; });
  const tax = (out.rows || []).filter(function (r) { return /^(과세가액|과세표준|산출세액|신고세액공제|납부세액|상속공제)$/.test(r.field); });
  const filled = tax.filter(function (r) { return r.tool !== '' && r.tool !== null && r.tool !== undefined; });
  const defects = [];
  // ①
  const wrong = filled.filter(function (r) { return !r.ok; });
  const s1 = !wrong.length && !out.judge || (!!out.judge && !wrong.length);
  if (wrong.length) defects.push('서류값 잘못 읽음/계산 틀림(' + wrong.map(function (r) { return r.field; }).join('·') + ')');
  // ②
  const blank = tax.length && filled.length < tax.length;
  const s2cover = !blank || need.length > 0 || !!out.judge;
  if (!s2cover) defects.push('물어야 할 걸 안 물음(값이 비었는데 질문 없음)');
  if (noise.length) defects.push('불필요 질문 ' + noise.length + '건(' + noise.map(function (q) { return q.cat; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join('·') + ')');
  const s2 = s2cover && !noise.length;
  // ③
  let s3 = 'ok', s3why = '';
  const exp = {}; tax.forEach(function (r) { exp[r.field] = r.expected; });
  const cmp = function (got) { const bad = tax.filter(function (r) { return got[r.field] !== undefined && !akSame_(r.expected, got[r.field], 'money'); }); return bad.length ? bad.map(function (r) { return r.field + ' ' + r.expected + '≠' + got[r.field]; }).join(', ') : ''; };
  if (!tax.length) { s3 = '확인불가'; s3why = '정답지에 세액 칸 없음'; }
  else if (filled.length === tax.length && !wrong.length) { s3 = 'ok'; }
  else if (out.judge && tool._ref) {
    // 판단 질문(사건분류)에 정답지대로 "일반 과세"로 답한 경우 — 도구의 일반 과세 계산값과 비교
    const d = cmp({ 과세표준: tool._ref.과세표준, 산출세액: tool._ref.산출세액 });
    s3 = d ? '불일치' : 'ok'; s3why = d ? '사건분류를 정답지대로(일반) 답해도 다름: ' + d : '사건분류 질문에 "일반"으로 답하면 일치';
  } else if (c.세목 === 'gift') {
    const ov = c.사건개요 || {}, dg = function (x) { return Number(String(x == null ? '' : x).replace(/[^\d]/g, '')) || 0; };
    const has = function (re) { return need.some(function (q) { return re.test(q.id || ''); }); };
    let amt = dg(ov.giftAmount), rel = String(ov.giftRelation || ''), prior = dg(ov.giftPriorAmount);
    const tv = dg(exp.과세가액), tb = dg(exp.과세표준);
    // [2026.10.15 1:1] 증여 내용 확인 질문(gift:deal) → 신고서의 증여재산가액·증여일로 답한다(신고서에 그 칸이 읽혀 있을 때만)
    if (has(/^gift:deal/)) { amt = dg(key.답_증여재산가액); if (key.답_증여일) c.기준일 = key.답_증여일; }
    if ((!amt || has(/^ov:giftAmount/)) && has(/^ov:giftAmount/)) amt = dg(key.답_증여재산가액) || tv;     // 증여재산가액 질문 → 신고서 증여재산가액(없으면 과세가액)
    if (!rel && (has(/^ov:giftRelation/) || has(/^gift:deal/)) && tv && exp.과세표준 !== undefined) {               // 관계 질문 → 정답지 (과세가액 − 과세표준) = 증여재산공제
      const ded = tv - tb; rel = ded >= 600000000 ? '배우자' : ded >= 50000000 ? '직계존속' : ded >= 20000000 ? '직계존속' : ded >= 10000000 ? '기타친족' : ded === 0 ? '기타' : '';
    }
    // 10년 합산 질문 → 신고서 ㉓ 증여재산가산액(읽혀 있을 때만). 예전의 "과세가액 − 이번 증여" 역산은 꿰맞추기라 없앰(2026.10.15 1:1).
    let priorUnknown = false;
    if (has(/^ov:giftPriorAmount/) && !prior) { if (key.답_가산액 != null) prior = dg(key.답_가산액); else priorUnknown = true; }
    if (!amt || !rel || priorUnknown) { s3 = '확인불가'; s3why = '정답지로 답할 수 없는 질문이 남음(' + (!amt ? '증여재산가액(신고서에서 못 읽음)' : !rel ? '관계' : '10년 합산(신고서 증여재산가산액을 못 읽음)') + ')'; }
    else {
      const input = { giftAmount: amt, relation: /배우자/.test(rel) ? '배우자' : /직계존속/.test(rel) ? '직계존속' : /직계비속/.test(rel) ? '직계비속' : /기타친족/.test(rel) ? '기타친족' : '기타', giftDate: c.기준일 || undefined };
      if (prior) input.priorGiftAmount = prior;
      if (dg(ov.giftDebtAssumed)) { input.debtAssumedAmount = dg(ov.giftDebtAssumed); input.isDebtObjectivelyProven = true; }
      if (dg(ov.giftAppraisalFee)) input.appraisalFeeAmount = dg(ov.giftAppraisalFee);
      const r = runUiEngineCalcTool_('calculate_gift_tax', input) || { error: '엔진 없음' };
      if (r.error) { s3 = '확인불가'; s3why = '엔진 오류: ' + r.error; }
      else {
        const got = { 과세표준: r.과세표준, 산출세액: r.산출세액_할증후 != null ? r.산출세액_할증후 : r.산출세액, 신고세액공제: r.신고세액공제, 납부세액: r.납부세액,
          과세가액: akGiftTaxable_(input, r) };
        const d = cmp(got); s3 = d ? '불일치' : 'ok'; s3why = (d ? '질문에 정답지 값으로 답해도 다름: ' + d : '질문에 정답지 값으로 답하면 일치') + ' (답한 값: ' + JSON.stringify(input) + ')';
      }
    }
  } else if (c.세목 === 'transfer' && (key.답_양도가액 || key.답_취득가액)) {
    // 양도 — 처리개요 물건이 하나이고 도구가 비워 둔(=질문한) 칸만 정답지 신고서 입력값으로 채워 다시 계산. 사건분류는 정답지 세율(일반)대로 답한 것으로 본다.
    const dg = function (x) { return Number(String(x == null ? '' : x).replace(/[^\d]/g, '')) || 0; };
    const c2 = JSON.parse(JSON.stringify(c)), ov2 = c2.사건개요 = c2.사건개요 || {};
    let list = Array.isArray(ov2.물건목록) && ov2.물건목록.length ? ov2.물건목록 : null;
    if (!list && !(ov2.양도가액 || ov2.취득가액 || ov2.취득일 || ov2.assetLocation)) { ov2.물건목록 = [{}]; list = ov2.물건목록; }
    const a = list ? list[0] : ov2;
    const asked = need.length > 0, answered = [];
    if (list && list.length > 1) { s3 = '확인불가'; s3why = '물건이 여럿 — 신고서 입력값을 물건별로 나눌 수 없음'; }
    else if (!asked) { s3 = '확인불가'; s3why = '값이 비었는데 질문이 없음'; }
    else {
      if (!dg(a.양도가액) && key.답_양도가액) { a.양도가액 = String(key.답_양도가액); answered.push('양도가액'); }
      if (!dg(a.취득가액) && key.답_취득가액) { a.취득가액 = String(key.답_취득가액); answered.push('취득가액'); }
      if (!a.취득일 || !(a.양도일 || c2.기준일)) { s3 = '확인불가'; s3why = '취득일·양도일이 비어 신고서 금액만으로 다시 계산할 수 없음'; }
      else {
        const tr = akTransferEngine_(c2, dg);
        if (!tr.result || tr.result.error) { s3 = '확인불가'; s3why = '다시 계산 못 함: ' + ((tr.result && tr.result.error) || tr.why || ''); }
        else {
          const got = { 과세표준: tr.result.과세표준 != null ? tr.result.과세표준 : tr.result.합산과세표준, 산출세액: tr.result.산출세액 != null ? tr.result.산출세액 : tr.result.산출세액_합계 };
          const d = cmp(got); s3 = d ? '불일치' : 'ok';
          s3why = (d ? '질문에 정답지 값으로 답해도 다름: ' + d : '질문에 정답지 값으로 답하면 일치') + (answered.length ? ' (답한 칸: ' + answered.join('·') + ')' : ' (사건분류만 "일반"으로 답함)');
        }
      }
    }
  } else { s3 = '확인불가'; s3why = '정답지(신고서)에 질문의 답(양도·취득가액, 재산 평가액 등 입력값)이 없음'; }
  if (s3 === '불일치') defects.push('다 채웠는데 계산 틀림(' + s3why + ')');
  if (s3 === '확인불가' && !defects.length) defects.push('③ 확인불가 — ' + s3why);
  return { ok: !!(s1 && s2 && s3 === 'ok'), s1: !!s1, s2: !!s2, s3: s3, s3why: s3why, need: need.length, noise: noise.length, todo: todo.length, defects: defects };
}
// 규칙을 맞춰 보며 고친(개발용) 사건 — 실사용 가능 비율은 이 사건들과 처음 보는 사건을 나눠 센다(사건 ID만, 이름 없음)
const AK_DEV_CASES_ = ['17483541-9f88-4c08-8e44-16f78024dbab', '382b2d21-98cc-43e8-8a80-d97cda98704c', '51604c63-cde5-4713-833b-2853c1b5e21f', '8464652a-014a-4085-9091-5332d96ee2c1', '9a41c4cf-8f88-4a6f-b5a4-7b4def36fdaa', 'f945ea9d-e6ff-4f2c-a6fd-7481a34f4c5c'];
// [2026.10.15] 신고서 숫자 목록에서 양도 입력값(답 전용) 찾기 — 세법 관계가 맞는 묶음만:
//  양도소득금액 = 과세표준 + 기본공제 250만(그 해 이미 썼으면 0), 양도차익 − 장기보유특별공제(0일 수 있음) = 소득금액, 양도가액 − 취득가액 − 필요경비 = 양도차익.
//  여러 묶음이 맞으면 양도가액이 가장 큰 것, 같으면 취득가액이 큰 것. 숫자는 신고서·계산명세서를 합친 목록(입력값은 명세서에 있는 경우가 많다).
function akTransferInputs_(nums, base) {
  const seen = {}; nums.forEach(function (v) { seen[v] = true; });
  const has = function (v) { return !!seen[v]; };
  let best = null;
  [base + 2500000, base].forEach(function (inc) {
    if (best || !has(inc)) return;
    nums.filter(function (g) { return g >= inc && (g === inc || has(g - inc)); }).forEach(function (g) {
      nums.forEach(function (tp) {
        if (tp <= g) return;
        nums.forEach(function (ap) {
          if (ap >= tp) return;
          // [2026.10.16] "양도소득금액 − 기본공제 250만 = 과세표준"을 "양도가액 − 취득가액 = 양도차익"으로 짝짓던 것(김운래·김금옥·노오섭 정답지의 취득가액 250만원)
          if (ap === 2500000 && tp === base + 2500000) return;
          const ex = tp - ap - g;
          if (ex < 0 || (ex > 0 && !has(ex))) return;
          if (!best || tp > best.tp || (tp === best.tp && ap > best.ap)) best = { tp: tp, ap: ap, ex: ex, g: g };
        });
      });
    });
  });
  return best ? { 답_양도가액: best.tp, 답_취득가액: best.ap, 답_필요경비: best.ex, 답_양도차익: best.g } : {};
}

// [2026.10.15] 증여세 과세가액(상증법 §47) = 증여재산가액 + 10년 합산 − 인수채무. 예전 식(과세표준 + 공제)은 공제가 증여액보다 크면(배우자 6억 등) 과세가액을 부풀렸다.
function akGiftTaxable_(input, r) { const v = (input.giftAmount || 0) + (input.priorGiftAmount || 0) - (input.debtAssumedAmount || 0); return v > 0 ? v : (r.과세표준 || 0); }
