// 원본 모양 인쇄 시험 사례 — 상속부속B (node tools/formprint-check-ext.js 상속부속B)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
module.exports = function (E, H) {
  var X = require('./mappers-상속부속B.js');
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  var HEIRS = [
    { name: '견본장남', regNo: '700101-1000000', relation: '자', address: '서울특별시 ○○구 견본로 2', addressDong: '101', addressHo: '1001', statutoryShareRatio: '1/2', isReporter: true },
    { name: '견본차남', regNo: '730505-1000000', relation: '자', address: '경기도 ○○시 견본로 7', statutoryShareRatio: '1/2', isReporter: false }
  ];
  var DECEASED = { name: '견본피상속인', regNo: '400101-1000000', address: '서울특별시 ○○구 견본로 2', resident: 'resident', taxOffice: '강남세무서' };
  // 상속 사건 ctx — 앱에서는 NxFormPrint.ctxFromApp.상속()이 만드는 모양 + 이 묶음의 ihb(화면 값 — 엔진 입력에서 같은 모양으로)
  function ihCtx(p, extra) {
    var r = E.calculateInheritanceTaxJS(clone(p));
    if (!r || r.error) throw new Error('엔진 오류: ' + (r && r.error));
    return Object.assign({
      r: r, 신고일: '2026-09-30', 신고구분: '기한 내 신고',
      reporter: HEIRS[0], phone: '010-0000-0000', email: 'sample@example.com',
      deceased: Object.assign({ deathDate: p.dateOfDeath }, DECEASED),
      heirs: HEIRS, taxAgent: AGENT, ihb: X.ihbFromInput(p)
    }, extra || {});
  }
  var BASE = { dateOfDeath: '2026-03-15', isDecedentResident: true, childCount: 2, hasSpouse: false, funeralCostAmount: 10000000, filingStatus: 'ontime', reportedInTime: true };
  var L = [];

  // ① 상속12호의2·부표1 — 가업상속 납부유예(공제 대신 납부유예 선택, 법 §72의2): 법인 주식 60억(총자산 100억, 사업무관자산 계 10억), 가업영위 15년
  //   과세가액 80억, 총 상속재산가액 90억(화면 칸), 자녀 2(일괄공제 5억), 장례비 1천만
  //   손계산: ⑥ = (100억 − 10억) ÷ 100억 = 90% → ⑦ = 60억 × 90% = 54억
  //     과세표준 = 80억 − 5억(일괄공제) = 75억(과세가액은 장례비 차감 후 엔진 값) → 산출세액은 엔진(아래 시험에서 엔진 값 그대로)
  //     ⑩ = ⑧ × 54억 ÷ 90억 = ⑧ × 0.6
  var pBiz = Object.assign({}, BASE, {
    taxableEstateAmount: 8000000000, totalGrossEstateValue: 9000000000,
    businessOwnershipYears: 15, businessInheritanceStockValue: 6000000000, businessInheritanceTotalAssetValue: 10000000000,
    businessInheritanceNonBizAsset55: 200000000, businessInheritanceNonBizAsset49: 300000000, businessInheritanceNonBizAsset61: 100000000,
    businessInheritanceExcessCash: 250000000, businessInheritanceNonBizStock: 150000000,
    decedentOwnershipRequirementMet: true, decedentCeoTenureRequirementMet: true, heirAge18OrOlder: true, heirEngagedInBusiness2YearsOrExempt: true,
    heirBecameOfficerByFilingDeadline: true, heirBecameCeoWithin2Years: true,
    businessInheritanceDeferralElected: true
  });
  var cBiz = ihCtx(pBiz);
  L.push({ name: '상속12호의2_가업상속납부유예', forms: X.plan('상속', cBiz).filter(function (it) { return it.formKey === '상속12호의2'; }), ctx: cBiz });
  L.push({ name: '상속12호의2부표1_가업상속재산명세', forms: X.plan('상속', cBiz).filter(function (it) { return it.formKey === '상속12호의2부표1'; }), ctx: cBiz });

  return L;
};
