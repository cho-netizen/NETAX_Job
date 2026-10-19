// 원본 모양 인쇄 시험 사례 — 증여특례B (node tools/formprint-check-ext.js 증여특례B)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
module.exports = function (E, H) {
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  var DONEE = { name: '김수증', regNo: '900101-1000000', email: 'sample@example.com', phone: '010-0000-0000', address: '서울특별시 ○○구 견본로 1', addressDong: '101', addressHo: '1001', taxOffice: '서초세무서' };
  var L = [];

  // ───── 일감몰아주기(법 §45의3) — 중견기업, 수증자 직접 30% + 간접 10%(한 고리), 배당 없음 ─────
  //  엔진 입력 = 화면 jm 칸: 세후영업이익 20억, 거래비율 60%, 주식보유비율 40%(직접 30 + 간접 10)
  //  손계산: (60 − 20)% × (40 − 5)% × 20억 = 2억8천만 → 과세표준 2억8천만 → 20% − 1천만 = 4,600만, 신고세액공제 3% 138만, 납부 4,462만
  //  직접·간접 나누기(부표5 ⑲): 한계보유비율 차감 5%p를 간접에서 먼저 → 직접 30%, 간접 5% → 직접분 2억4천만, 간접분 4천만
  var jmIn = { companySize: 'medium', operatingIncome: 2000000000, netIncome: 0, tradeRatio: 60, relatedPartySales: 0, shareRatio: 40, dividendDeduction: 0,
    fiscalYearEnd: '2025-12-31', filingStatus: 'ontime' };
  var jm1 = E.calculateRelatedPartyTransactionGiftTaxJS({ companySize: jmIn.companySize, afterTaxOperatingIncome: jmIn.operatingIncome, afterTaxNetIncome: 0,
    relatedPartyTransactionRatio: jmIn.tradeRatio, relatedPartySalesAmount: 0, shareholderOwnershipRatio: jmIn.shareRatio, dividendDeduction: 0, filingStatus: 'ontime', reportedInTime: true });
  if (jm1.증여의제이익 !== 280000000 || jm1.산출세액 !== 46000000 || jm1.납부세액 !== 44620000) throw new Error('일감몰아주기 엔진 값이 손계산과 다름: ' + JSON.stringify(jm1));
  // 주주별 보유 내역(🧮 도구) — 간접: 수증자 → ○○홀딩스 50% → 수혜법인 20% = 10%
  var SH = [
    { name: '김지배', relation: '본인(지배주주)', directRatio: 45, chain1Company: '', chain1Ratio: 0, chain2Company: '', chain2Ratio: 0, chain3Company: '', chain3Ratio: 0, chainQualified: true, indirectRaw: 0, indirect: 0 },
    { name: '김수증', relation: '자녀', directRatio: 30, chain1Company: '○○홀딩스(견본)', chain1Ratio: 50, chain2Company: '', chain2Ratio: 0, chain3Company: '○○홀딩스(견본)', chain3Ratio: 20, chainQualified: true, indirectRaw: 10, indirect: 10 },
    // 2단계 고리: 김친족 → △△투자 60% → ○○홀딩스 50% → 수혜법인 20% = 6%
    { name: '김친족', relation: '배우자', directRatio: 5, chain1Company: '△△투자(견본)', chain1Ratio: 60, chain2Company: '○○홀딩스(견본)', chain2Ratio: 50, chain3Company: '○○홀딩스(견본)', chain3Ratio: 20, chainQualified: true, indirectRaw: 6, indirect: 6 }
  ];
  var RP = [{ label: '가나물산(견본)', sales: 4000000000 }, { label: '다라상사(견본)', sales: 2000000000 }];
  var jmCtx = { kind: 'jm', r: jm1, donee: DONEE, taxAgent: AGENT, in: jmIn, shareholders: SH, relatedParties: RP, totalSales: 10000000000, excludedSales: 0, 신고일: '2026-03-31' };
  L.push({ name: '증여10호의3_중견_직접간접', forms: [{ formKey: '증여10호의3', ctx: jmCtx }], ctx: jmCtx });

  L.push({ name: '증여10호의3부표1_주주표', forms: [{ formKey: '증여10호의3부표1', ctx: jmCtx }], ctx: jmCtx });
  L.push({ name: '증여10호의3부표2_출자고리', forms: [{ formKey: '증여10호의3부표2', ctx: jmCtx }], ctx: jmCtx });
  L.push({ name: '증여10호의3부표3_수증자간접', forms: [{ formKey: '증여10호의3부표3', ctx: Object.assign({}, jmCtx, { 부표3법인: 0 }) }], ctx: jmCtx });
  L.push({ name: '증여10호의3부표4_특수관계법인', forms: [{ formKey: '증여10호의3부표4', ctx: jmCtx }], ctx: jmCtx });
  L.push({ name: '증여10호의3부표5_계산명세2', forms: [{ formKey: '증여10호의3부표5', ctx: jmCtx }], ctx: jmCtx });

  // ───── 일감몰아주기 둘째 — 일반기업, 수증자 직접 20%만, 배당소득공제 3천만, 무신고 ─────
  //  손계산: (45 − 5)% × 20% × 50억 = 4억 − 3천만 = 3억7천만 → 20% − 1천만 = 6,400만, 무신고(기한후) 신고세액공제 없음
  var jmIn2 = { companySize: 'general', operatingIncome: 5000000000, netIncome: 0, tradeRatio: 45, relatedPartySales: 0, shareRatio: 20, dividendDeduction: 30000000,
    fiscalYearEnd: '2025-06-30', filingStatus: 'unreported' };
  var jm2 = E.calculateRelatedPartyTransactionGiftTaxJS({ companySize: 'general', afterTaxOperatingIncome: 5000000000, relatedPartyTransactionRatio: 45, shareholderOwnershipRatio: 20,
    dividendDeduction: 30000000, filingStatus: 'unreported', unpaidDays: 30 });
  if (jm2.증여의제이익 !== 370000000 || jm2.산출세액 !== 64000000) throw new Error('일감몰아주기 둘째 엔진 값이 손계산과 다름: ' + JSON.stringify(jm2));
  var jmCtx2 = { kind: 'jm', r: jm2, donee: DONEE, taxAgent: AGENT, in: jmIn2, relatedParties: [],
    shareholders: [{ name: '김수증', relation: '본인(지배주주)', directRatio: 20, chain1Company: '', chain1Ratio: 0, chain2Company: '', chain2Ratio: 0, chain3Company: '', chain3Ratio: 0, chainQualified: true, indirectRaw: 0, indirect: 0 }],
    totalSales: 0, excludedSales: 0, 신고일: '2026-11-15' };
  L.push({ name: '증여10호의3_일반_배당공제_무신고', forms: [{ formKey: '증여10호의3', ctx: jmCtx2 }, { formKey: '증여10호의3부표5', ctx: jmCtx2 }], ctx: jmCtx2 });
  // ───── 일감몰아주기 셋째 — 중소기업 거래비율 40%(정상거래비율 50% 이하) → 과세대상 아님: 머리만 찍힘 ─────
  var jm3 = E.calculateRelatedPartyTransactionGiftTaxJS({ companySize: 'small', afterTaxOperatingIncome: 800000000, relatedPartyTransactionRatio: 40, shareholderOwnershipRatio: 60, filingStatus: 'ontime' });
  if (jm3.과세대상여부 !== false) throw new Error('일감몰아주기 셋째는 과세대상이 아니어야 함');
  var jmCtx3 = { kind: 'jm', r: jm3, donee: DONEE, taxAgent: {}, in: { companySize: 'small', operatingIncome: 800000000, tradeRatio: 40, shareRatio: 60, fiscalYearEnd: '2025-12-31', filingStatus: 'ontime' },
    shareholders: [], relatedParties: [], 신고일: '2026-03-31' };
  L.push({ name: '증여10호의3_과세대상아님', forms: [{ formKey: '증여10호의3', ctx: jmCtx3 }], ctx: jmCtx3 });

  // ───── 일감떼어주기(법 §45의4) — 개시사업연도 신고 ─────
  //  이익 10억, 지배주주등 주식보유비율 50%(김지배 직접 40 + 김수증 간접 10), 법인세 산출세액(공제후) 1.5억·각사업연도소득 20억 → 상당액 = 1.5억 × 10억/20억 = 7,500만
  //  손계산: [(10억 × 50% − 7,500만) ÷ 12 × 12] × 3 = 12억7,500만 → 40% − 1억6천만 = 3억5천만, 신고세액공제 1,050만, 납부 3억3,950만
  var jtSH = [
    { name: '김지배', relation: '본인(지배주주)', directRatio: 40, chain1Company: '', chain1Ratio: 0, chain2Company: '', chain2Ratio: 0, chain3Company: '', chain3Ratio: 0, chainQualified: true, indirectRaw: 0, indirect: 0 },
    { name: '김수증', relation: '자녀', directRatio: 0, chain1Company: '□□지주(견본)', chain1Ratio: 40, chain2Company: '', chain2Ratio: 0, chain3Company: '□□지주(견본)', chain3Ratio: 25, chainQualified: true, indirectRaw: 10, indirect: 10 }
  ];
  var jtIn1 = { phase: 'initial', profit: 1000000000, shareRatio: 50, corporateTax: 0, corpTaxAfterCredit: 150000000, corpTaxableIncome: 2000000000, months: 12, dividendDeduction: 0,
    initialTax: 0, initialPaidTax: 0, fiscalYearEnd: '2024-12-31', filingStatus: 'ontime' };
  var jt1 = E.calculateBusinessOpportunityGiftTaxJS({ phase: 'initial', profitFromOpportunity: 1000000000, shareholderOwnershipRatio: 50, corporateTaxAfterCredit: 150000000,
    corporateTaxableIncome: 2000000000, monthsInInitialYear: 12, filingStatus: 'ontime', reportedInTime: true });
  if (jt1.증여의제이익 !== 1275000000 || jt1.산출세액 !== 350000000 || jt1.납부세액 !== 339500000) throw new Error('일감떼어주기 개시 엔진 값이 손계산과 다름: ' + JSON.stringify(jt1));
  // 🧮 부문별 매출·비용 내역(1년차만) — 부문 매출 50억, 매출원가 2항목, 판관비 2항목 → 부문 영업이익 = 50억 − 30억 − 9억 = 11억(세무조정 −1억 뒤 ⑲ 10억은 화면에 직접 넣은 값)
  var SEG = [{ totalSales: 20000000000, segmentSales: 5000000000, costs: [{ label: '상품매출원가', total: 9000000000, segment: 2500000000 }, { label: '물류비', total: 1500000000, segment: 500000000 }],
    expenses: [{ label: '급여', total: 2000000000, segment: 600000000 }, { label: '임차료', total: 800000000, segment: 300000000 }] }, { totalSales: 0, segmentSales: 0, costs: [], expenses: [] }, { totalSales: 0, segmentSales: 0, costs: [], expenses: [] }];
  var jtCtx1 = { kind: 'jt', r: jt1, donee: DONEE, taxAgent: AGENT, in: jtIn1, shareholders: jtSH, segmentYears: SEG, 신고일: '2025-06-30' };
  L.push({ name: '증여10호의4_개시사업연도', forms: [{ formKey: '증여10호의4', ctx: jtCtx1 }], ctx: jtCtx1 });
  L.push({ name: '증여10호의4부표1_주주표', forms: [{ formKey: '증여10호의4부표1', ctx: jtCtx1 }], ctx: jtCtx1 });
  L.push({ name: '증여10호의4부표2_출자고리', forms: [{ formKey: '증여10호의4부표2', ctx: jtCtx1 }], ctx: jtCtx1 });
  // ───── 일감떼어주기 — 정산사업연도(2년 경과) 신고: 직접만 50%, 누적 이익 36억, 법인세 상당액 누계 2억, 개시 산출세액 3억5천만 ─────
  //  손계산: 36억 × 50% − 2억 = 16억 → 40% − 1억6천만 = 4억8천만, ㉗ 3억5천만 빼면 1억3천만, 신고세액공제 3% 390만 → 납부 1억2,610만
  var jtIn2 = { phase: 'settlement', profit: 3600000000, shareRatio: 50, corporateTax: 200000000, corpTaxAfterCredit: 0, corpTaxableIncome: 0, months: 0, dividendDeduction: 0,
    initialTax: 350000000, initialPaidTax: 339500000, fiscalYearEnd: '2026-12-31', filingStatus: 'ontime' };
  var jt2 = E.calculateBusinessOpportunityGiftTaxJS({ phase: 'settlement', profitFromOpportunity: 3600000000, shareholderOwnershipRatio: 50, corporateTaxPortion: 200000000,
    initialPhaseCalculatedTax: 350000000, initialPhasePaidTax: 339500000, filingStatus: 'ontime', reportedInTime: true });
  if (jt2.증여의제이익 !== 1600000000 || jt2.산출세액 !== 480000000 || jt2.납부세액 !== 126100000) throw new Error('일감떼어주기 정산 엔진 값이 손계산과 다름: ' + JSON.stringify(jt2));
  var jtCtx2 = { kind: 'jt', r: jt2, donee: DONEE, taxAgent: AGENT, in: jtIn2, segmentYears: [], 신고일: '2027-06-30',
    shareholders: [{ name: '김수증', relation: '본인(지배주주)', directRatio: 50, chain1Company: '', chain1Ratio: 0, chain2Company: '', chain2Ratio: 0, chain3Company: '', chain3Ratio: 0, chainQualified: true, indirectRaw: 0, indirect: 0 }] };
  L.push({ name: '증여10호의4_정산사업연도', forms: [{ formKey: '증여10호의4', ctx: jtCtx2 }], ctx: jtCtx2 });

  return L;
};
