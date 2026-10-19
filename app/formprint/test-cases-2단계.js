// 원본 모양 인쇄 시험 사례 — 2단계 (node tools/formprint-check-ext.js 2단계)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣음), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
module.exports = function (E, H) {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  var DONEE = { name: '견본영농자녀', regNo: '900101-1000000', address: '전라남도 ○○군 견본면 들길 3', phone: '010-0000-0000', email: 'donee@example.com', taxOffice: '목포세무서', resident: 'resident' };
  var DONOR = { name: '견본자경농민', regNo: '600101-1000000', address: '전라남도 ○○군 견본면 들길 1' };
  function claw(p) { var r = E.calculateClawbackInterestJS(clone(p)); if (!r || r.error) throw new Error('추징이자 엔진 오류: ' + (r && r.error)); return r; }
  var L = [];

  // ① 조특52호의2 — 영농자녀 증여세 감면 위반(코드 01, 5년 이내 양도, 조특법 §71②)
  //   감면세액 50,000,000원, 당초 증여 2021.12.15. → 신고기한 2022.3.31. → 이자 기산일 2022.4.1., 양도일(추징사유 발생일) 2025.6.30.
  //   손계산: 일수 = 2022.4.1.~2025.6.30. 양끝 포함 = 1,187일(2022.4.1.~2023.3.31. 365 + ~2024.3.31. 366 + ~2025.3.31. 365 + 91)
  //           이자상당액 = 50,000,000 × 1,187 × 22/100,000 = 13,057,000원 → 납부할 세액 63,057,000원
  var cr52 = claw({ clawedBackTaxAmount: 50000000, startDate: '2022-04-01', endDate: '2025-06-30', method: 'daily' });
  var c52 = { clawback: { formType: 'farmland_gift', result: cr52, reason: '01' }, donee: DONEE, donor: DONOR, taxAgent: AGENT, 신고일: '2025-09-30' };
  L.push({ name: '조특52호의2_영농자녀_양도', forms: [{ formKey: '조특52호의2', ctx: c52 }], ctx: c52 });
  // ①-2 같은 서식 — 이자율이 바뀐 기간이 섞인 경우(코드 02): 2021.4.1.~2023.6.30. → 2022.2.14.까지 10만분의 25, 그 뒤 10만분의 22
  //   손계산: 320일(2021.4.1.~2022.2.14.) × 25/100,000 + 501일(2022.2.15.~2023.6.30.) × 22/100,000 → 30,000,000 × (0.08 + 0.11022) = 5,706,600원
  var cr52b = claw({ clawedBackTaxAmount: 30000000, startDate: '2021-04-01', endDate: '2023-06-30', method: 'daily' });
  var c52b = { clawback: { formType: 'farmland_gift', result: cr52b, reason: '02' }, donee: DONEE, donor: DONOR, taxAgent: AGENT, 신고일: '2023-09-30' };
  L.push({ name: '조특52호의2_영농자녀_영농중단_구간', forms: [{ formKey: '조특52호의2', ctx: c52b }], ctx: c52b });

  // ② 조특11호의10 — 가업승계 증여세 과세특례 추징(코드 03 휴업·폐업, 조특법 §30의6③1호): 일반 세율로 다시 낸 증여세 200,000,000원
  //   당초 증여 2023.3.15. → 신고기한 2023.6.30. → 기산일 2023.7.1., 휴업일(추징사유 발생일) 2026.5.31.
  //   손계산: 일수 = 366(2023.7.1.~2024.6.30.) + 365 + 335(2025.7.1.~2026.5.31.) = 1,066일, 이자 = 200,000,000 × 1,066 × 22/100,000 = 46,904,000원
  var GP = { donee: Object.assign({}, DONEE, { name: '견본승계자녀', address: '서울특별시 ○○구 견본로 5', taxOffice: '역삼세무서' }), donor: Object.assign({}, DONOR, { name: '견본창업주', address: '서울특별시 ○○구 견본로 1' }) };
  var cr1110 = claw({ clawedBackTaxAmount: 200000000, startDate: '2023-07-01', endDate: '2026-05-31', method: 'daily' });
  var c1110 = Object.assign({ clawback: { formType: 'sr_succession', result: cr1110, reason: '03' }, taxAgent: AGENT, 신고일: '2026-08-31' }, GP);
  L.push({ name: '조특11호의10_가업승계_휴업', forms: [{ formKey: '조특11호의10', ctx: c1110 }], ctx: c1110 });

  // ③ 조특11호의13 — 가업승계 증여세 납부유예 사후관리 추징(코드 04 지분 감소, 조특법 §30의7③2호가목): 납부유예 세액 300,000,000원
  //   당초 증여 2023.9.10. → 신고기한 2023.12.31. → 기산일 2024.1.1., 지분 감소일 2026.3.31. — 이율이 바뀐 날마다 나눔(시행령 §27의7⑭3호 단서)
  //   손계산: 81일 × 2.9%(~2024.3.21.) + 364일 × 3.5%(~2025.3.20.) + 287일 × 3.1%(~2026.1.1.) + 89일 × 3.1%(~2026.3.31.)
  //           = 300,000,000 × 26.745 ÷ 365 = 21,982,191원(원 미만 버림) → 납부할 세액 321,982,191원
  var cr1113 = claw({ clawedBackTaxAmount: 300000000, startDate: '2024-01-01', endDate: '2026-03-31', method: 'split' });
  var c1113 = Object.assign({ clawback: { formType: 'sr_succession_deferred', result: cr1113, reason: '04' }, taxAgent: AGENT, 신고일: '2026-06-30' }, GP);
  L.push({ name: '조특11호의13_납부유예_지분감소', forms: [{ formKey: '조특11호의13', ctx: c1113 }], ctx: c1113 });
  // ③-2 같은 서식 — 재차 납부유예(법 §30의7⑥)를 받은 경우: 율 × 50% → 21,982,191의 절반 근처(구간별 원 미만 버림 전 합계를 버림) = 10,991,095원
  var cr1113b = claw({ clawedBackTaxAmount: 300000000, startDate: '2024-01-01', endDate: '2026-03-31', method: 'split', isReDeferral: true });
  var c1113b = Object.assign({ clawback: { formType: 'sr_succession_deferred', result: cr1113b, reason: '02' }, taxAgent: {}, 신고일: '2026-06-30' }, GP);
  L.push({ name: '조특11호의13_재차납부유예_본인신고', forms: [{ formKey: '조특11호의13', ctx: c1113b }], ctx: c1113b });

  // ④ 조특11호의8 — 가업승계 주식 등 증여세 과세특례 적용신청(조특법 §30의6): 주식 가액 50억, 총자산 100억 중 사업무관자산 계 10억(→ 비율 90%), 가업영위 25년(총한도 400억)
  //   손계산: 가업자산상당액 = 50억 × 90% = 45억 → 과세특례 적용대상 과세가액(부표2 ⑫) = 45억(한도 안)
  var pSr = { specialType: 'business_succession', giftAmount: 5000000000, doneeAge: 35, donorAge: 65, businessOwnershipYearsOfParent: 25,
    totalAssetValue: 10000000000, nonBizAsset55: 400000000, nonBizAsset49: 300000000, nonBizAsset61: 100000000, excessCash: 150000000, nonBizStock: 50000000, filingStatus: 'ontime' };
  var rSr = E.calculateSpecialRateGiftTaxJS(clone(pSr));
  if (!rSr || rSr.error) throw new Error('특례세율 엔진 오류: ' + (rSr && rSr.error));
  var c118 = Object.assign({ r: rSr, sr: { giftDate: '2026-05-20', businessYears: 25 }, taxAgent: AGENT, 신고일: '2026-08-31' }, GP);
  L.push({ name: '조특11호의8_가업승계특례신청', forms: [{ formKey: '조특11호의8', ctx: c118 }], ctx: c118 });

  // ⑤ 소득103호 — 국외전출자 세액공제신청(조정공제 + 외국납부세액공제): 출국일 2026.3.10. 시가 20억, 취득가액 5억 + 기타 1천만, 출국 뒤 16억에 실제 양도, 외국 납부세액 5천만
  //   손계산: 양도소득금액 14.9억 − 기본공제 250만 = 과세표준 14억8,750만 → 산출세액 = 6천만 + (14억8,750만 − 3억) × 25% = 356,875,000
  //           조정공제 = (20억 − 16억) × 25% = 1억(⑭ 한도 안) → ㉗ = 256,875,000
  //           외국납부 = 5천만 × (16억 − 5.1억) ÷ (16억 − 5.1억) = 5천만(법 §118의13① 괄호 — 조정공제 해당이라 실제 양도가액) → 공제 합계 1억5천만
  //           (서식 식 ㉑×⑰/⑳ = 5천만 × 14.9억 ÷ 10.9억 = 68,348,624 — 판단 대기 알림)
  function exitCase(p) { var r = E.calculateExitTaxJS(clone(p)); if (!r || r.error) throw new Error('국외전출자 엔진 오류: ' + (r && r.error)); return { input: p, result: r }; }
  var ET0 = { departureDate: '2026-03-10', residenceYearsIn10: 8, isMajorShareholder: true, acquisitionPrice: 500000000, otherNecessaryExpenses: 10000000, taxManagerName: '견본납세관리인', taxManagerAddress: '서울특별시 ○○구 견본로 7' };
  var et1 = exitCase(Object.assign({}, ET0, { departureMarketValue: 2000000000, actualTransferPrice: '1600000000', foreignTaxPaid: 50000000 }));
  var c103 = { et: et1, 신고일: '2027-05-31' };
  L.push({ name: '소득103호_조정공제_외국납부', forms: [{ formKey: '소득103호', ctx: c103 }], ctx: c103 });
  // ⑤-2 소득103호 — 비거주자 국내원천소득 세액공제(실제 양도가액 22억 > 출국 시가라 조정공제 없음, 원천징수세액 3천만)
  //   손계산: ㉜ = min(356,875,000, 30,000,000) = 30,000,000(법 §118의14① — §156①7호 금액 그대로). 서식 식 ㉒×⑰/⑳ = 3천만 × 14.9억 ÷ 16.9억 = 26,449,704(알림)
  var et2 = exitCase(Object.assign({}, ET0, { departureMarketValue: 2000000000, actualTransferPrice: '2200000000', nonresidentSourceTaxEquivalent: 30000000 }));
  var c103b = { et: et2, 신고일: '2027-05-31' };
  L.push({ name: '소득103호_비거주자원천공제', forms: [{ formKey: '소득103호', ctx: c103b }], ctx: c103b });
  // ⑥ 소득104호·105호 — 출국 전 보유현황 신고 + 납부유예 신청(담보 제공): 출국 시가 8억, 취득가액 3억(기타 0)
  //   손계산: 과세표준 = 5억 − 250만 = 4억9,750만 → 산출세액 = 6천만 + 1억9,750만 × 25% = 109,375,000 → ⑫ = ⑬ = 109,375,000
  var et3 = exitCase(Object.assign({}, ET0, { departureMarketValue: 800000000, acquisitionPrice: 300000000, otherNecessaryExpenses: 0, actualTransferPrice: '', deferralRequested: true, collateralProvided: true }));
  var c104 = { et: et3, 신고일: '2026-03-05' };
  L.push({ name: '소득104호_출국전보유현황', forms: [{ formKey: '소득104호', ctx: c104 }], ctx: c104 });
  L.push({ name: '소득105호_납부유예_담보제공', forms: [{ formKey: '소득105호', ctx: c104 }], ctx: c104 });

  // ⑦ 증여10호의5부표1 — 초과배당(상증법 §41의2): 실제 받은 배당 5억 × 과소배당 비율 60% = 초과배당 3억, 10년 안 같은 증여자 증여 2천만(증여특례A 시험과 같은 입력)
  //   ⑨ = 엔진 증여의제이익(초과배당 3억 − 추정 소득세상당액), ⑭ = 2천만(1천만원 이상이라 가산)
  var edIn = { excessDividendBaseAmount: 500000000, disproportionateShortfallRatio: 0.6, relationDeductionLimit: 50000000, priorGiftAmount: 20000000, priorPaidTax: 0, filingStatus: 'ontime', giftDate: '2026-04-30' };
  var rEd = E.calculateExcessDividendGiftTaxJS(clone(edIn));
  if (!rEd || rEd.error) throw new Error('초과배당 엔진 오류: ' + (rEd && rEd.error));
  var cEd1 = { r: rEd, input: { priorGiftAmount: 20000000 } };
  L.push({ name: '증여10호의5부표1_초과배당', forms: [{ formKey: '증여10호의5부표1', ctx: cEd1 }], ctx: cEd1 });
  // ⑦-2 증여10호의6부표1 — 특정법인 거래이익(상증법 §45의5): 증여특례A 시험과 같은 입력(⑨ = 4.95억), 가산액 입력 없음 → 과세표준에서 되살림(0)
  var scIn = { benefitToCorpAmount: 1000000000, corporateTaxAfterCredit: 350000000, corporateTaxableIncome: 2000000000, shareholderOwnershipRatio: 0.6,
    relationDeductionLimit: 0, priorGiftAmount: 0, priorPaidTax: 0, filingStatus: 'ontime', giftDate: '2026-03-15', transactionDate: '2026-03-15' };
  var rSc = E.calculateSpecificCorporationGiftTaxJS(clone(scIn));
  if (!rSc || rSc.error) throw new Error('특정법인 엔진 오류: ' + (rSc && rSc.error));
  var cSc1 = { r: rSc, input: {} };
  L.push({ name: '증여10호의6부표1_특정법인', forms: [{ formKey: '증여10호의6부표1', ctx: cSc1 }], ctx: cSc1 });
  // ⑧ 증여10호의5부표2·10호의6부표2 — 서화·골동품(값은 화면에 넣는 감정가액 평균 — 엔진 계산값이 아니라 입력값, 시행령 §52②2호)
  var ARTS = [{ code: '02', artist: '견본작가', title: '견본 산수도', year: '1975', material: '한지에 수묵', size: '60×90', value: 150000000 },
    { code: '13', artist: '미상', title: '견본 백자 항아리', year: '', material: '백자', size: '높이 40', value: 80000000 }];
  var cArt = { arts: ARTS, donee: DONEE };
  L.push({ name: '증여10호의5부표2_서화골동품', forms: [{ formKey: '증여10호의5부표2', ctx: cArt }], ctx: cArt });
  L.push({ name: '증여10호의6부표2_서화골동품', forms: [{ formKey: '증여10호의6부표2', ctx: cArt }], ctx: cArt });

  return L;
};
