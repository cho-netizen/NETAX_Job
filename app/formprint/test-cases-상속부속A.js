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

  // ② 상속2호 — 영농상속공제: 개인 영농 재산 15억(담보채무 2억 — 2026.2.27. 이후 상속이라 뺌) + 영농법인 주식 10억(총자산 20억, 사업무관 2억)
  //   손계산: ① = 15억 − 2억 = 13억, ⑦ = (20억 − 2억) ÷ 20억 = 90% → 가-2 = 10억 × 90% = 9억 → ⑧ = 22억, ⑨ 30억 → ⑩ = 22억
  var pFarm = Object.assign({}, BASE, {
    taxableEstateAmount: 6000000000,
    farmingIndividualAssetValue: 1500000000, farmingIndividualSecuredDebt: 200000000, farmingStockValue: 1000000000, farmingTotalAssetValue: 2000000000,
    farmingNonBizAsset55: 100000000, farmingExcessCash: 100000000,
    decedentFarmingRequirementMet: true, heirFarmingRequirementMet: true, heirAge18OrOlder: true
  });
  var cFarm = ihCtx(pFarm);
  L.push({ name: '상속2호_영농상속공제', forms: X.plan('상속', cFarm), ctx: cFarm });

  // ③ 상속5호 — 금융재산 상속공제: 순금융재산 3억4,567만8,901원 → ④ = ③ × 20% = 69,135,780.2 → 원 미만 버림 69,135,780(엔진과 같음, 예전 인쇄는 반올림)
  var pFin = Object.assign({}, BASE, { taxableEstateAmount: 2000000000, netFinancialAssets: 345678901 });
  var cFin = ihCtx(pFin);
  L.push({ name: '상속5호_금융재산상속공제', forms: X.plan('상속', cFin), ctx: cFin });
  // 2천만원 초과 1억원 이하 → 한도 2천만원
  var cFin2 = ihCtx(Object.assign({}, pFin, { netFinancialAssets: 64000000 }));
  L.push({ name: '상속5호_한도2천만', forms: [{ formKey: '상속5호', ctx: cFin2 }], ctx: cFin2 });

  // ④ 상속6호의2 — 동거주택상속공제: 명부 둘째 상속인(견본차남)이 "동거주택 상속", 몫 가액 7억5천만 − 담보채무 5천만 = 7억(화면 동거주택가액)
  //   손계산: ⑫ = MIN(7억 × 100%, 6억) = 6억(법 §23의2①)
  var coHeirs = [{ heirIdx: 1, value: 750000000, debt: 50000000 }];
  var pCo = Object.assign({}, BASE, { taxableEstateAmount: 1500000000, cohabitingHouseValue: 700000000, hasCohabitingHouseDeduction: true,
    tenYearCohabitationRequirementMet: true, tenYearOneHouseholdRequirementMet: true, noHouseOrJointHeirRequirementMet: true });
  var cCo = ihCtx(pCo, null, coHeirs);
  L.push({ name: '상속6호의2_동거주택상속공제', forms: X.plan('상속', cCo), ctx: cCo });

  // ⑤ 상속3호 — 배우자 상속재산 미분할: 배우자·자녀 2, 분할기한까지 분할 못 함(체크 꺼짐) → 엔진 배우자공제 5억(법 §19④)
  //   재산평가 목록 3건 중 예금 1건만 받는 상속인 배분이 있음 → 나머지 2건(아파트·토지)이 "분할하지 못한 재산"
  var HEIRS3 = [
    { name: '견본배우자', regNo: '450303-2000000', relation: '배우자', address: '서울특별시 ○○구 견본로 2', addressDong: '101', addressHo: '1001', statutoryShareRatio: '3/7', isReporter: false },
    HEIRS[0], HEIRS[1]
  ];
  var vA3 = [
    { method: 'apartment', typeCode: '05', basisCode: '08', location: '서울특별시 ○○구 견본로 2, 101동 1001호', area: 84.97, value: 1200000000, alloc: [] },
    { method: 'land', typeCode: '02', basisCode: '08', location: '경기도 ○○군 ○○면 ○○리 123', area: 1650, value: 300000000, alloc: [] },
    { method: 'direct', typeCode: '12', basisCode: '06', location: '○○은행 예금', area: 0, value: 200000000, alloc: [{ heirIdx: 1, ratio: 1 }] }
  ];
  var pSp = Object.assign({}, BASE, { taxableEstateAmount: 1700000000, hasSpouse: true, spouseActualInheritedAmount: 0, spouseLegalShareRatio: 3 / 7, isSpousePropertyDivided: false });
  var cSp = ihCtx(pSp, { heirs: HEIRS3, valAssets: vA3, assets: vA3,
    spouse: { estateValue: 0, assumedDebt: 0, nonTaxable: 0, actual: 0, nonHeirBequest: 0, giftToHeirs: 0, ratio: 3 / 7, giftBase: 0, priorGiftedIncluded: 0, divided: false } });
  if (cSp.r.배우자공제 !== 500000000) throw new Error('시험 전제: 미분할이면 배우자공제 5억 — 엔진 ' + cSp.r.배우자공제);
  L.push({ name: '상속3호_배우자미분할', forms: X.plan('상속', cSp), ctx: cSp });

  return L;
};
