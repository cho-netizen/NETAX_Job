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

  return L;
};
