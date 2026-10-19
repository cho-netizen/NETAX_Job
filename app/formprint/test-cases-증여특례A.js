// 원본 모양 인쇄 시험 사례 — 증여특례A (node tools/formprint-check-ext.js 증여특례A)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
module.exports = function (E, H) {
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  var DONEE = { name: '홍길동', regNo: '900101-1000000', resident: 'resident', email: 'sample@example.com', phone: '010-0000-0000',
    address: '서울특별시 ○○구 견본로 1', addressDong: '101', addressHo: '1001', taxOffice: '서초세무서' };
  var DONOR = { name: '홍판서', regNo: '600202-1000000', address: '서울특별시 ○○구 견본로 2' };
  function base(extra) {
    return Object.assign({ donee: DONEE, donor: DONOR, giftDate: '2026-05-15', taxAgent: AGENT, 신고일: '2026-08-31' }, extra || {});
  }
  var L = [];

  // ① 증여10호의2 — 창업자금(조특법 §30의5): 이번 30억, 앞서 같은 특례로 받은 10억(그때 낸 세액 5천만)
  //   손계산: ㉑ = 30억 + 10억 = 40억(50억 한도 안) → ㉒ 5억 → ㉕ 35억 → ㉗ 3억5천만 → ㉙ 5천만 → ㉝ 3억
  var srIn1 = { specialType: 'startup', giftAmount: 3000000000, doneeAge: 36, donorAge: 66, priorSpecialGiftAmount: 1000000000, priorPaidTax: 50000000, filingStatus: 'ontime' };
  var c1 = base({ r: E.calculateSpecialRateGiftTaxJS(srIn1), filingStatus: 'ontime',
    srRows: [{ method: 'direct', typeCode: '12', location: '현금(견본 은행 계좌)', value: 2000000000 }, { method: 'listedStock', typeCode: '09', location: '(주)견본전자', value: 1000000000 }],
    srInput: {} });
  L.push({ name: '증여10호의2_창업자금_두번째', forms: [{ formKey: '증여10호의2', ctx: c1 }, { formKey: '증여10호의2부표1', ctx: c1 }], ctx: c1 });

  // ② 증여10호의2부표1 — 창업자금 한도 초과: 이번 45억(채무 2억 인수), 앞선 특례분 10억(낸 세액 5천만)
  //   손계산: ⑫ = 45억 − 2억 + 10억 = 53억 > ⑬ 50억 → ⑮ = 50억 − 10억 = 40억, ⑯ = min(53억, 40억) = 40억
  //           ⑰ = 45억 − 40억 = 5억, ⑱ = 2억(일반 증여세 신고서로) / 본표 ㉑ = 40억 + 10억 = 50억 → ㉕ 45억 → ㉗ 4억5천만 → ㉝ 4억
  var srIn2 = { specialType: 'startup', giftAmount: 4500000000, debtAssumedAmount: 200000000, doneeAge: 41, donorAge: 70, priorSpecialGiftAmount: 1000000000, priorPaidTax: 50000000, filingStatus: 'ontime' };
  var c2 = base({ r: E.calculateSpecialRateGiftTaxJS(srIn2), filingStatus: 'ontime',
    srRows: [{ method: 'direct', typeCode: '12', location: '현금(견본 은행 예금)', value: 2500000000 }, { method: 'land', typeCode: '02', location: '경기도 ○○시 ○○동 123 (견본)', value: 1200000000 },
      { method: 'apartment', typeCode: '05', location: '서울특별시 ○○구 견본로 5, 3동 301호 (견본)', value: 800000000 }], srInput: {} });
  L.push({ name: '증여10호의2부표1_창업자금_한도초과', forms: [{ formKey: '증여10호의2', ctx: c2 }, { formKey: '증여10호의2부표1', ctx: c2 }], ctx: c2 });

  // ③ 증여10호의2부표2 — 가업승계주식등(조특법 §30의6): 주식 200억, 부모 가업 25년(한도 400억), 앞선 특례분 20억(낸 세액 1억)
  //   총자산 200억, 사업무관자산 ㉮10억 ㉯5억 ㉰3억 ㉱7억 ㉲5억 = 30억 → ④ 170억 → ⑤ 85% → ⑥ 170억
  //   손계산: ⑧ = 170억 + 20억 = 190억 < ⑨ 400억 → ⑫ = 190억 − 20억 = 170억, ⑬ = 200억 − 170억 = 30억(기본세율)
  //           본표 ㉑ 190억 − ㉒ 10억 = ㉕ 180억 → ㉗ = 120억 × 10% + 60억 × 20% = 24억 → ㉙ 1억 → ㉝ 23억
  var bsIn = { totalAsset: 20000000000, nonBiz55: 1000000000, nonBiz49: 500000000, nonBiz61: 300000000, excessCash: 700000000, nonBizStock: 500000000 };
  var srIn3 = { specialType: 'business_succession', giftAmount: 20000000000, doneeAge: 38, donorAge: 68, businessOwnershipYearsOfParent: 25,
    priorSpecialGiftAmount: 2000000000, priorPaidTax: 100000000, filingStatus: 'ontime',
    totalAssetValue: bsIn.totalAsset, nonBizAsset55: bsIn.nonBiz55, nonBizAsset49: bsIn.nonBiz49, nonBizAsset61: bsIn.nonBiz61, excessCash: bsIn.excessCash, nonBizStock: bsIn.nonBizStock };
  var c3 = base({ r: E.calculateSpecialRateGiftTaxJS(srIn3), filingStatus: 'ontime', srRows: [], srInput: bsIn });
  L.push({ name: '증여10호의2부표2_가업승계_120억초과', forms: [{ formKey: '증여10호의2', ctx: c3 }, { formKey: '증여10호의2부표2', ctx: c3 }], ctx: c3 });

  // ④ 조특52호 — 영농자녀 증여농지 감면(조특법 §71): 자경농민 부모에게서 5억(그중 농지 3억, 2만m²) 증여, 직계존속
  //   손계산: 과세가액 5억 − 공제 5천만 = 과세표준 4.5억 → 산출세액 1천만 + 3.5억 × 20% = 8천만
  //           감면세액 = 8천만 × 3억 ÷ 5억 = 4,800만(면적 한도 4만m² 안, 5년 1억 한도 안) → 증여세 계산기에 넣어 다시 계산
  var gIn = { giftAmount: 500000000, relation: '직계존속', giftDate: '2026-04-20', filingStatus: 'ontime' };
  var g0 = E.calculateGiftTaxJS(gIn);
  var farm = E.calculateFarmlandGiftTaxReductionJS({ assetType: 'farmland', giftValue: 300000000, areaSqm: 20000, totalGiftCalculatedTax: g0.산출세액_할증전, totalGiftPropertyValue: 500000000 });
  var g1 = E.calculateGiftTaxJS(Object.assign({}, gIn, { farmlandGiftTaxExemptionAmount: farm.최종_감면세액 }));
  var c4 = { r: g1, item: { amount: 500000000, priorGiftAmount: 0 }, relation: '직계존속', giftDate: '2026-04-20', 신고일: '2026-07-31',
    donee: Object.assign({}, DONEE, { name: '김영농', taxOffice: '공주세무서' }), donor: { name: '김자경', regNo: '550303-1000000', address: '충청남도 ○○군 ○○면 견본길 3', filingStatus: 'ontime' },
    marriageBirth: { marriage: 0, birth: 0 }, installment: 0, split: 0, taxAgent: AGENT };
  L.push({ name: '조특52호_영농자녀_plan', forms: require('./mappers-증여특례A.js').plan('증여', c4), ctx: c4 });

  // ⑤ 증여10호의5 — 초과배당(상증법 §41의2): 실제 받은 배당 5억 × 과소배당 비율 60% = 초과배당 3억, 최초 신고(추정율표)
  //   10년 안 같은 증여자 증여 2천만 합산, 증여재산공제 남은 한도 5천만(직계존속)
  var edIn1 = { excessDividendBaseAmount: 500000000, disproportionateShortfallRatio: 0.6, relationDeductionLimit: 50000000, priorGiftAmount: 20000000, priorPaidTax: 0,
    filingStatus: 'ontime', giftDate: '2026-04-30' };
  var e1 = E.calculateExcessDividendGiftTaxJS(edIn1);
  var c5 = base({ r: e1, filingStatus: 'ontime', finalSettlement: false, edInput: { priorGiftAmount: 20000000, priorPaidTax: 0 }, relation: '직계존속', giftDate: '2026-04-30' });
  L.push({ name: '증여10호의5_초과배당_최초', forms: [{ formKey: '증여10호의5', ctx: c5 }], ctx: c5 });
  // 같은 건 정산 신고 — 실제 소득세액이 추정보다 커서 증여재산가액이 줄고 최초 신고 세액(㊱)을 빼면 환급
  var edIn2 = Object.assign({}, edIn1, { isFinalSettlement: true, actualIncomeTax: 110000000, initialGiftTaxAmount: e1.납부세액 });
  var c5b = base({ r: E.calculateExcessDividendGiftTaxJS(edIn2), filingStatus: 'ontime', finalSettlement: true, edInput: { priorGiftAmount: 20000000, priorPaidTax: 0 }, relation: '직계존속', giftDate: '2026-04-30' });
  L.push({ name: '증여10호의5_초과배당_정산환급', forms: [{ formKey: '증여10호의5', ctx: c5b }], ctx: c5b });

  // ⑥ 증여10호의6 — 특정법인 거래이익(상증법 §45의5): 지배주주 부모가 법인에 10억 무상 제공, 법인 소득 20억·법인세(감면 뒤) 3.5억, 지배주주등 지분 60%
  //   손계산: 법인세상당액 = 3.5억 × 10억/20억 = 1.75억 → 특정법인의 이익 8.25억 → ⑳ = 8.25억 × 60% = 4.95억(1억 이상 과세)
  //           ㉞ 4.95억 → 세율 적용 세액 4.95억 × 20% − 1천만 = 8,900만 / ㊲ 한도 = 직접 증여 6억의 세액 1.2억 − 1.75억 × 60%(1.05억) = 1,500만
  //           → ㊱ 1,500만(한도 적용, §45의5②) → 신고세액공제 3% 45만 → ㊿ 1,455만
  var scIn = { benefitToCorpAmount: 1000000000, corporateTaxAfterCredit: 350000000, corporateTaxableIncome: 2000000000, shareholderOwnershipRatio: 0.6,
    relationDeductionLimit: 0, priorGiftAmount: 0, priorPaidTax: 0, filingStatus: 'ontime', giftDate: '2026-03-15', transactionDate: '2026-03-15' };
  var c6 = base({ r: E.calculateSpecificCorporationGiftTaxJS(scIn), filingStatus: 'ontime', fiscalYearEnd: '2026-12-31',
    scInput: { benefitToCorpAmount: 1000000000, shareholderOwnershipRatio: 0.6, directGiftTaxEquivalent: 0, priorGiftAmount: 0, priorPaidTax: 0 },
    relation: '직계존속', giftDate: '2026-03-15', 신고일: '2027-06-30' });
  L.push({ name: '증여10호의6_특정법인_한도적용', forms: [{ formKey: '증여10호의6', ctx: c6 }], ctx: c6 });

  return L;
};
