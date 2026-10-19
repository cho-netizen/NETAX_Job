// 원본 모양 인쇄 시험 사례 — 상속부속A (node tools/formprint-check-ext.js 상속부속A)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
module.exports = function (E, H) {
  var X = require('./mappers-상속부속A.js');
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  var HEIRS = [
    { name: '견본장남', regNo: '700101-1000000', relation: '자', address: '서울특별시 ○○구 견본로 2', addressDong: '101', addressHo: '1001', statutoryShareRatio: '1/2', isReporter: true },
    { name: '견본차남', regNo: '730505-1000000', relation: '자', address: '경기도 ○○시 견본로 7', statutoryShareRatio: '1/2', isReporter: false }
  ];
  // 상속 사건 ctx — 앱에서는 NxFormPrint.ctxFromApp.상속()이 만드는 모양 + 이 묶음의 ihx(화면 값 — 엔진 입력에서 같은 모양으로)
  function ihCtx(p, extra, cohabitHeirs) {
    var r = E.calculateInheritanceTaxJS(clone(p));
    if (!r || r.error) throw new Error('엔진 오류: ' + (r && r.error));
    return Object.assign({
      r: r, 신고일: '2026-09-30', 신고구분: '기한 내 신고',
      reporter: HEIRS[0], phone: '010-0000-0000', email: 'sample@example.com',
      deceased: { name: '견본피상속인', regNo: '400101-1000000', address: '서울특별시 ○○구 견본로 2', deathDate: p.dateOfDeath, resident: 'resident', taxOffice: '강남세무서' },
      heirs: HEIRS, taxAgent: AGENT, ihx: X.ihxFromInput(p, cohabitHeirs)
    }, extra || {});
  }
  var BASE = { dateOfDeath: '2026-03-15', isDecedentResident: true, childCount: 2, hasSpouse: false, funeralCostAmount: 10000000, filingStatus: 'ontime', reportedInTime: true };
  var L = [];

  // ① 상속1호·부표1 — 가업상속공제: 개인 가업 사업용 자산 순액 5억 + 법인 주식 80억(총자산 120억, 사업무관자산 15억), 가업영위 25년, 요건 모두 충족
  //   손계산: ⑥ = (120억 − 15억) ÷ 120억 = 87.5% → ⑦ = 80억 × 87.5% = 70억 → ⑨ = ① + ⑦ = 75억, ⑩ = 400억(20년 이상 30년 미만) → ⑪ = 75억
  var pBiz = Object.assign({}, BASE, {
    taxableEstateAmount: 15000000000,
    businessOwnershipYears: 25, businessInheritanceIndividualNetAssetValue: 500000000, businessInheritanceStockValue: 8000000000, businessInheritanceTotalAssetValue: 12000000000,
    businessInheritanceNonBizAsset55: 300000000, businessInheritanceNonBizAsset49: 500000000, businessInheritanceNonBizAsset61: 100000000, businessInheritanceExcessCash: 200000000, businessInheritanceNonBizStock: 400000000,
    decedentOwnershipRequirementMet: true, decedentCeoTenureRequirementMet: true, heirAge18OrOlder: true, heirEngagedInBusiness2YearsOrExempt: true, heirBecameOfficerByFilingDeadline: true, heirBecameCeoWithin2Years: true,
    isMediumSizedBusiness: false
  });
  var cBiz = ihCtx(pBiz);
  L.push({ name: '상속1호_가업상속공제', forms: [{ formKey: '상속1호', ctx: cBiz }], ctx: cBiz });
  L.push({ name: '상속1호부표1_가업상속재산명세', forms: [{ formKey: '상속1호부표1', ctx: cBiz }], ctx: cBiz });
  // 부표1 — 법인 가업만, 중견기업, 가업영위 32년: 가업상속인의 다른 재산 50억 > 납부세액 20억 × 200% = 40억 → 공제 배제(법 §18의2②)
  var pMid = Object.assign({}, pBiz, { businessOwnershipYears: 32, businessInheritanceIndividualNetAssetValue: 0, isMediumSizedBusiness: true,
    businessHeirNonBusinessAssetValue: 5000000000, businessHeirTaxWithoutDeduction: 2000000000 });
  var cMid = ihCtx(pMid);
  L.push({ name: '상속1호부표1_중견기업배제', forms: X.plan('상속', cMid).filter(function (it) { return /^상속1호/.test(it.formKey); }), ctx: cMid });

  return L;
};
