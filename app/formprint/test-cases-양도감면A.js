// 원본 모양 인쇄 시험 사례 — 양도감면A (node tools/formprint-check-ext.js 양도감면A)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
module.exports = function (E, H) {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var SELLER = { name: '홍길동', regNo: '600101-1000000', phone: '010-0000-0000', address: '서울특별시 ○○구 견본로 1, 101동 1001호 (견본동)', taxOffice: '서초세무서', isTransferorResident: true };
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  // 양도 ctx 하나 — 자산 목록으로 엔진 합산(calculateTransferTaxMultiJS)·단건 계산, 화면 코드값(rateCode·typeCode)은 손으로
  function trCtx(list, extra) {
    var r = E.calculateTransferTaxMultiJS(list.map(clone), {});
    return Object.assign({ r: r, 귀속연도: String(list[0].transferDate).slice(0, 4), 신고구분: '확정신고', 신고일: '2026-05-20', splitAmt: 0,
      seller: SELLER, buyers: [{ name: '○○공사', regNo: '000-00-00000', shareRatio: '1/1', relationLabel: '타인' }],
      assets: list.map(function (a) { return { asset: a, single: E.calculateTransferTaxSingleJS(clone(a)), rateCode: '10', typeCode: '01', transferCause: 'sale' }; }),
      taxAgent: AGENT }, extra || {});
  }
  var L = [];
  // 이 묶음의 plan(세목 원본 모양 출력 묶음에 더할 서식)이 고른 것만 — 84호·부표1은 기존 확인 도구(formprint-check.js)에서
  function plan(ctx) { return require('./mappers-양도감면A.js').plan('양도', ctx); }

  // 1. 조특54호 — 공익사업 협의매수(§77①1호) 현금보상 토지, 2015 취득 2억 → 2025.8.20. 5억(사업인정고시 2024.3.15.)
  var comp = { assetType: 'other', assetKind: 'land', transferPrice: 500000000, acquisitionPrice: 200000000, necessaryExpenses: 0,
    transferDate: '2025-08-20', acquisitionDate: '2015-04-01', assetLocation: '경기도 ○○시 ○○동 100 (견본)', assetArea: 1200,
    compensationType: 'cash', compensationTransferMode: 'consult', publicNoticeDate: '2024-03-15' };
  L.push({ name: '54호_공익사업_협의매수_현금', forms: ['조특54호'], ctx: trCtx([comp], { 감면자산: 0 }) });

  // 2. 조특62호 — 장기임대주택(§97 본문 50%) 국민주택, 1998 취득 1억 → 2025.9.10. 4억
  var lr97 = { assetType: 'house', assetKind: 'building', transferPrice: 400000000, acquisitionPrice: 100000000, necessaryExpenses: 3000000,
    transferDate: '2025-09-10', acquisitionDate: '1998-05-02', assetLocation: '서울특별시 ○○구 ○○동 1-1, 101호 (견본)', assetArea: 84.5,
    longTermRentalHouseProvision: 'sect97', lrSubType: '' };
  L.push({ name: '62호_장기임대_97조_50', forms: plan(trCtx([lr97])) });
  // 2-2. §97의5(임대기간 중 소득 100%) — 기준시가 취득 1.5억·임대 끝 2.7억·양도 3억 → 감면소득 80%, 같은 해 토지 하나 더(합산)
  var lr975 = Object.assign({}, lr97, { longTermRentalHouseProvision: 'sect97_5', acquisitionDate: '2015-03-02', assetLocation: '서울특별시 ○○구 ○○동 2-2 (견본)',
    lrAcquisitionStandardPrice: 150000000, lrTransferStandardPrice: 300000000, lrRentalEndStandardPrice: 270000000 });
  var land2 = { assetType: 'other', assetKind: 'land', transferPrice: 150000000, acquisitionPrice: 100000000, necessaryExpenses: 0,
    transferDate: '2025-03-10', acquisitionDate: '2016-01-05', assetLocation: '경기도 ○○군 ○○면 200 (견본)' };
  L.push({ name: '62호_장기일반민간임대_97조의5', forms: [{ formKey: '조특62호', ctx: trCtx([land2, lr975], { 감면자산: 1 }) }] });
  // 2-3. §97 단서 10년 이상 임대(100%) — 엔진이 소득에서 빼는 방식이라 감면세액 칸은 비움
  L.push({ name: '62호_장기임대_97조_10년_100', forms: ['조특62호'], ctx: trCtx([Object.assign({}, lr97, { lrSubType: 'rental_10yr' })], { 감면자산: 0 }) });

  // 3. 조특63호의32 — 기초연금 수급자 1주택 세대, 2010 취득 토지 2억 → 2025.7.15. 6억 양도, 9.1. 연금계좌 5천만 납입(기납입 3천만)
  var pen = { assetType: 'other', assetKind: 'land', transferPrice: 600000000, acquisitionPrice: 200000000, necessaryExpenses: 10000000,
    transferDate: '2025-07-15', acquisitionDate: '2010-02-01', assetLocation: '경기도 ○○시 ○○동 300 (견본)',
    pensionAccountContribution: 50000000, pensionPriorContribution: 30000000, pensionContributionDate: '2025-09-01', isBasicPensionRecipient: true, isOneHouseOrNoHouseHousehold: true };
  L.push({ name: '63호의32_연금계좌_납입', forms: plan(trCtx([pen])) });
  // 3-2. 납입 4억(⑫ 남은 한도 7천만이 가장 적음)
  L.push({ name: '63호의32_연금계좌_한도', forms: ['조특63호의32'], ctx: trCtx([Object.assign({}, pen, { pensionAccountContribution: 400000000 })], { 감면자산: 0 }) });

  // 4. 조특13호 — 같은 해 8년 자경농지(2005 취득 1.5억 → 2025.6.10. 8억)와 수용(§77①3호, 일반채권, 2025.11.20.) 토지 — §133① 1억 한도로 자경 감면이 깎임
  var farm = { assetType: 'other', assetKind: 'land', transferPrice: 800000000, acquisitionPrice: 150000000, necessaryExpenses: 5000000,
    transferDate: '2025-06-10', acquisitionDate: '2005-03-01', assetLocation: '충청남도 ○○군 ○○면 ○○리 123 (견본)', assetArea: 3300, isEightYearFarmland: true };
  var expro = { assetType: 'other', assetKind: 'land', transferPrice: 300000000, acquisitionPrice: 100000000, necessaryExpenses: 0,
    transferDate: '2025-11-20', acquisitionDate: '2012-03-01', assetLocation: '경기도 ○○시 ○○동 200 (견본)', assetArea: 500,
    compensationType: 'bond', compensationTransferMode: 'expropriation', publicNoticeDate: '2024-05-01' };
  L.push({ name: '13호_자경농지_수용_합산', forms: plan(trCtx([farm, expro])) });

  // 5. 조특14호 — 개발제한구역 지정 전(1990) 취득 토지를 2025.10.2. 매수청구로 양도(§77의3①1호 40%)
  var rz = { assetType: 'other', assetKind: 'land', transferPrice: 350000000, acquisitionPrice: 80000000, necessaryExpenses: 2000000,
    transferDate: '2025-10-02', acquisitionDate: '1990-06-01', assetLocation: '경기도 ○○시 ○○동 산 5 (견본)', assetArea: 2000, compensationType: 'restricted_zone_40' };
  L.push({ name: '14호_개발제한구역_매수청구', forms: plan(trCtx([rz])) });

  return L;
};
