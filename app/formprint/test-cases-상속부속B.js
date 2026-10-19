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

  // ② 공통11호·부표 — 상속세 연부연납(중소기업 상속, 법 §71②1호가목·시행령 §68③): 위 ①과 같은 법인 기업(주식 60억 × 90% = 54억)이지만 납부유예를 고르지 않음.
  //   가업영위 8년 → 가업상속공제 한도 0(10년 미만, 법 §18의2①) → 가업상속공제 0. 과세표준 = 79.9억 − 5억 = 74.9억 → 산출세액 32.85억, 신고세액공제 3% 9,855만 → 납부세액 3,186,450,000
  //   연부연납: 총 납부세액 3,186,450,000, 최초 납부 0, 15년, 이율 연 3.1%(화면 입력) → 16회, 회당 원금 199,153,125(나누어떨어짐),
  //     2회 가산금 = (3,186,450,000 − 199,153,125) × 3.1% = 92,606,203(원 미만 버림)
  //   부표 ⑪(계산기에 없음 — 참고 알림만) = 3,186,450,000 × (54억 − 0) ÷ (90억 − 0) = 1,911,870,000
  var pIn = Object.assign({}, pBiz, { businessInheritanceDeferralElected: false, businessOwnershipYears: 8 });
  var rIn = E.calculateInheritanceTaxJS(clone(pIn));
  var instIn = { taxType: 'inheritance', totalTaxAmount: rIn.납부세액, initialPaymentAmount: 0, installmentPeriodYears: 15, annualInterestRatePercent: 3.1, referenceDate: '2026-09-30' };
  var cIn = ihCtx(pIn, { inst: { input: instIn, result: E.calculateInstallmentPaymentScheduleJS(clone(instIn)) } });
  L.push({ name: '공통11호_상속연부연납15년', forms: X.plan('상속', cIn).filter(function (it) { return it.formKey === '공통11호'; }), ctx: cIn });
  L.push({ name: '공통11호부표_가업상속재산', forms: X.plan('상속', cIn).filter(function (it) { return it.formKey === '공통11호부표'; }), ctx: cIn });
  // 증여세 연부연납 — 총 납부세액 1억2천만, 최초 납부 2천만, 5년, 이율 칸 비움(엔진이 기준일 고시 이자율을 씀)
  //   손계산: ⑪ = 1억, 회당 원금 = 1억 ÷ 6 = 16,666,666원(끝수 4원은 1회에 — 16,666,670), 2회 가산금 = 83,333,330 × 3.1%(2026.9.30. 고시 이자율) = 2,583,333
  var instG = { taxType: 'gift', totalTaxAmount: 120000000, initialPaymentAmount: 20000000, installmentPeriodYears: 5, referenceDate: '2026-09-30' };
  var cG = { 세목: '증여', 신고일: '2026-09-30', taxAgent: AGENT, inst: { input: instG, result: E.calculateInstallmentPaymentScheduleJS(clone(instG)) },
    person: { name: '견본수증자', regNo: '900101-1000000', address: '서울특별시 ○○구 견본로 9', phone: '010-0000-0000', email: 'donee@example.com' },
    other: { name: '견본증여자', regNo: '600101-1000000' }, office: '서초세무서' };
  L.push({ name: '공통11호_증여연부연납5년', forms: [{ formKey: '공통11호', ctx: cG }], ctx: cG });

  // ③ 공통16호 — 상속세 결정(경정)청구: 당초 신고 = ②의 상속(과세가액 80억) 납부세액, 상속개시 후 1년 안 수용으로 재산 가액이 5억 하락(법 §79①2호) → 과세가액 75억으로 다시 계산
  //   손계산: 과세표준 74.9억 → 69.9억, 산출세액 = 69.9억 × 50% − 4.6억 = 30.35억, 신고세액공제 3% 9,105만 → 29.4395억 → 환급할 세액 = 31.8645억 − 29.4395억 = 2억4,250만
  var rCor = E.calculateInheritanceTaxJS(clone(Object.assign({}, pIn, { taxableEstateAmount: 7500000000, totalGrossEstateValue: 8500000000 })));
  var cCr = { 세목: '상속', 신고일: '2026-12-15', taxAgent: AGENT,
    cr: { taxType: 'inheritance', originalTax: rIn.납부세액, correctedTax: rCor.납부세액, reasonType: 'subsequent', reasonDetail: '상속개시 후 1년 안에 상속재산(토지)이 수용되어 보상가액이 평가액보다 5억원 낮음(상증법 §79①2호)' },
    claimant: Object.assign({ phone: '010-0000-0000', email: 'sample@example.com' }, HEIRS[0]), other: { name: DECEASED.name, regNo: DECEASED.regNo, deathDate: pIn.dateOfDeath }, office: DECEASED.taxOffice };
  L.push({ name: '공통16호_상속경정청구', forms: [{ formKey: '공통16호', ctx: cCr }], ctx: cCr });

  // ④ 국기8호 — 상속인대표자신고서: 상속인 3명(배우자·자녀 2), 신고인(대표자) = 견본장남. 상속개시 2026.3.15. → 신고기한 2026.4.14.(30일 이내)
  //   세액과는 관계없는 서식이라 엔진은 상속 결과가 있는지(plan 조건)만 씀
  var HEIRS3 = [
    { name: '견본배우자', regNo: '450303-2000000', relation: '배우자', address: '서울특별시 ○○구 견본로 2', addressDong: '101', addressHo: '1001', isReporter: false },
    HEIRS[0], HEIRS[1]
  ];
  var c8 = ihCtx(Object.assign({}, BASE, { taxableEstateAmount: 2000000000, hasSpouse: true }), { heirs: HEIRS3, 신고일: '2026-04-10' });
  L.push({ name: '국기8호_상속인3명', forms: X.plan('상속', c8).filter(function (it) { return it.formKey === '국기8호'; }), ctx: c8 });

  // ⑤ 상속13호 — 일반 물납(법 §73): ②의 상속(납부세액 3,186,450,000), 부동산·유가증권 70억 ÷ 상속재산가액 90억 = 77.8%(1/2 초과), 금융재산 5억 < 납부세액 → 엔진 "적용 가능"
  var pkIn = { provision: 'general', inheritanceTaxPayable: rIn.납부세액, financialAssetValue: 500000000, realEstateSecuritiesValue: 7000000000, totalInheritanceValue: 9000000000 };
  var pkRes = E.calculatePropertyInKindPaymentEligibilityJS(clone(pkIn));
  if (!pkRes.적용가능여부) throw new Error('물납 시험 사례가 적용 불가로 나옴');
  var c13 = ihCtx(pIn, { pk: { input: pkIn, result: pkRes } });
  L.push({ name: '상속13호_일반물납', forms: [{ formKey: '상속13호', ctx: c13 }], ctx: c13 });

  return L;
};
