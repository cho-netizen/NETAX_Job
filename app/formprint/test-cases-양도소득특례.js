// 원본 모양 인쇄 시험 사례 — 양도소득특례 (node tools/formprint-check-ext.js 양도소득특례)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
//   1세대1주택 특례 신고서는 앱과 같게 "특정주택 제외 판정" 엔진 함수로 판정한 뒤, 판정 창이 자산에 남기는 oneHouseSpecialCase를
//   taxcalc.html provisionForms 표와 같은 글자로 만들어 넣는다(판정이 적용 안 됨이면 시험이 실패하게 throw).
module.exports = function (E, H) {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  var SELLER = { name: '홍길동', regNo: '800101-1000000', phone: '010-0000-0000', address: '서울특별시 ○○구 견본로 1', addressDong: '101', addressHo: '1001',
    taxOffice: '서초세무서', isTransferorResident: true };
  function need(r, what) { if (!r || r.error || !r.적용여부) throw new Error(what + ' 판정이 적용 안 됨: ' + JSON.stringify(r)); return r; }
  // 양도 사건 하나(자산 목록) → ctxFromApp.양도와 같은 모양
  function caseOf(assets, extra) {
    return Object.assign({
      r: E.calculateTransferTaxMultiJS(clone(assets), {}), 귀속연도: assets[0].transferDate.slice(0, 4), 신고구분: '확정신고', 신고일: '2026-05-20', splitAmt: 0,
      seller: clone(SELLER), buyers: [{ name: '김○○', regNo: '000000-0000000', shareRatio: '1/1', relationLabel: '타인' }],
      assets: assets.map(function (a) { return { asset: a, single: E.calculateTransferTaxSingleJS(clone(a)), rateCode: '20', typeCode: '04', transferCause: 'sale' }; }),
      taxAgent: AGENT
    }, extra || {});
  }

  // ① 상생임대주택(영 §155의3) — 아파트 2020.3.2. 취득 9억 → 2026.4.30. 양도 14억(1세대1주택, 12억 초과분 과세)
  var mgIn = { priorLeaseStartDate: '2020-04-01', priorLeaseEndDate: '2022-03-31', priorLeaseDeposit: 500000000, priorLeaseRent: 0,
    mutualLeaseContractDate: '2022-02-15', mutualLeaseStartDate: '2022-04-01', mutualLeaseEndDate: '2024-04-01', mutualLeaseDeposit: 520000000, mutualLeaseRent: 0, transferDate: '2026-04-30' };
  // ※ 상생 임대 2022.4.1.~2024.3.31.(만 2년)은 엔진이 23개월로 세어 미적용 — 영 §155의3③(1개월 미만은 1개월)과 다름(보고서 계산 오류 의심). 시험은 4.1. 종료로
  var mg = need(E.calculateMutualGrowthLeaseExclusionJS(mgIn), '상생임대주택');
  var mgAsset = { assetType: 'house', transferPrice: 1400000000, acquisitionPrice: 900000000, necessaryExpenses: 12000000, transferDate: '2026-04-30', acquisitionDate: '2020-03-02',
    assetLocation: '서울특별시 ○○구 ○○로 10, 101동 1001호 (견본아파트)', isOneHouseOneFamily: true,
    oneHouseSpecialCase: { provisionLabel: '상생임대주택(소득세법시행령§155의3)', formNo: '소득세법 시행규칙 [별지 제83호의4서식]', formTitle: '상생임대주택에 대한 특례적용신고서',
      acquisitionDate: '', houseType: '', newHousingCompletionDate: '', mgContractDate: mgIn.mutualLeaseContractDate,
      mgLeasePeriod: mgIn.mutualLeaseStartDate + ' ~ ' + mgIn.mutualLeaseEndDate, 안내: mg.안내 } };
  var ctxMg = caseOf([mgAsset]);

  return [
    { name: '83호의4_상생임대주택', tax: '양도', ctx: ctxMg }
  ].map(function (cs) {
    // tax만 준 사례는 plan으로 이 묶음 서식만 고름(84호 본표는 기존 23장 시험에서 봄)
    if (!cs.forms) cs.forms = H.ctxFromApp && cs.tax ? require('./mappers.js').plan(cs.tax, cs.ctx).filter(function (it) { return typeof it !== 'string' && /^소득/.test(it.formKey); }) : [];
    return cs;
  });
};
