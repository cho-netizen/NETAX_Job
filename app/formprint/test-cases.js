/*
 * 법정서식 원본 모양 출력 — 시험용 합성 사건 3건(신고용 아님). test.html(브라우저)과 tools/formprint-check.js(node)가 같이 씀.
 * NxFormPrintTestCases(E) → [{name, forms, ctx}]   E = 세액계산 엔진(taxcalc-engine.html을 불러온 객체)
 * rateCode·typeCode 등 화면 함수가 주는 값은 같은 규칙으로 손으로 넣었다(앱에서는 NxFormPrint.ctxFromApp이 화면 함수로 채움).
 */
(function (root, factory) {
  var f = factory();
  if (typeof module === 'object' && module.exports) module.exports = f;
  else root.NxFormPrintTestCases = f;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  return function (E) {
    // 양도: 토지 2014.3.1. 취득 1.5억 → 2025.6.30. 양도 3억, 필요경비 500만
    var tAsset = { assetType: 'other', assetKind: 'land', transferPrice: 300000000, acquisitionPrice: 150000000, necessaryExpenses: 5000000,
      transferDate: '2025-06-30', acquisitionDate: '2014-03-01', assetLocation: '경기도 ○○시 ○○동 123-4 (견본)' };
    var ctx양도 = {
      r: E.calculateTransferTaxMultiJS([clone(tAsset)], {}), 귀속연도: '2025', 신고구분: '확정신고', 신고일: '2026-05-20', splitAmt: 0,
      seller: { name: '홍길동', regNo: '000000-0000000', phone: '010-0000-0000', address: '서울특별시 ○○구 견본로 1, 101동 1001호 (견본동, 견본아파트)', taxOffice: '서초세무서', isTransferorResident: true },
      buyers: [{ name: '김○○', regNo: '000000-0000000', shareRatio: '1/1', relationLabel: '타인' }],
      // 토지 일반(2년 이상) 세율구분 10, 자산종류 토지 01 — trRateClassCode1_·trAssetTypeCode1_와 같은 규칙
      assets: [{ asset: tAsset, single: E.calculateTransferTaxSingleJS(clone(tAsset)), rateCode: '10', typeCode: '01', transferCause: 'sale' }],
      taxAgent: AGENT
    };
    // 증여: 직계존속에게서 3억, 기한 내
    var ctx증여 = {
      r: E.calculateGiftTaxJS({ giftAmount: 300000000, relation: '직계존속', giftDate: '2026-09-01', filingStatus: 'ontime' }),
      item: { amount: 300000000, priorGiftAmount: 0 }, relation: '직계존속', giftDate: '2026-09-01', 신고일: '2026-10-19',
      donee: { name: '홍길동', regNo: '000000-0000000', resident: 'resident', email: 'sample@example.com', phone: '010-0000-0000', address: '세종특별자치시 국세청로 8-14 (견본)', taxOffice: '세종세무서' },
      donor: { name: '홍부모', regNo: '000000-0000000', address: '세종특별자치시 국세청로 8-14 (견본)', filingStatus: 'ontime' },
      marriageBirth: { marriage: 0, birth: 0 }, installment: 0, split: 0, taxAgent: AGENT
    };
    // 상속: 화면 상속세과세가액 12억(= 재산 12.6억 − 공과금 300만 − 채무 5,700만, 장례비 빼기 전), 자녀 2, 거주자, 장례비 1천만, 감정평가수수료 700만
    var ctx상속 = {
      r: E.calculateInheritanceTaxJS({ taxableEstateAmount: 1200000000, childCount: 2, hasSpouse: false, isDecedentResident: true, funeralCostAmount: 10000000, funeralNicheCostAmount: 0, appraisalFeeAmount: 7000000, netFinancialAssets: 0 }),
      신고구분: '기한 내 신고', 신고일: '2026-12-20',
      fv: { priorGiftAdded: 0, lumpSum: 500000000, basic: 200000000 },
      reporter: { name: '견본신고인', regNo: '000000-0000000', relation: '자', address: '서울특별시 ○○구 견본로 2' }, phone: '010-0000-0000', email: 'sample@example.com',
      deceased: { name: '견본피상속인', regNo: '000000-0000000', address: '서울특별시 ○○구 견본로 2', deathDate: '2026-06-30', resident: 'resident', taxOffice: '강남세무서' },
      taxAgent: AGENT, forProfitBequest: 0, forProfitExempted: 0, bizDeferred: 0, installment: 0, split: 0,
      assets: [
        { typeCode: '05', basisCode: '08', location: '서울특별시 ○○구 견본로 2, 101동 1001호', area: 84.97, value: 900000000 },
        { typeCode: '02', basisCode: '08', location: '경기도 ○○군 ○○면 산 12', area: 3300, value: 250000000 },
        { typeCode: '12', basisCode: '01', location: '○○은행 예금', area: 0, value: 110000000 }
      ],
      publicOrg: 0, publicTrust: 0, duesTotal: 3000000, debtTotal: 57000000,
      debts: [{ debtType: 'bank', startDate: '2020-03-02', endDate: '2030-03-02', creditorName: '○○은행', creditorRegNo: '000-00-00000', creditorAddress: '서울특별시 중구 ○○로 1', amount: 57000000 }],
      dues: [{ duesType: 'national', year: '2026', quarter: '2', amount: 3000000 }],
      funerals: [{ category: 'general', payee: '○○장례식장', bizNo: '000-00-00000', detail: '장례비', amount: 10000000 }],
      childCount: 2, minorYears: 0, elderlyCount: 0, disabledYears: 0, isNonResident: false
    };
    return [
      { name: '양도84호', forms: ['양도84호', '양도84부표1'], ctx: ctx양도 },
      { name: '증여10호', forms: ['증여10호'], ctx: ctx증여 },
      { name: '상속9호', forms: ['상속9호', '상속9호부표1', '상속9호부표3'], ctx: ctx상속 }
    ];
  };
});
