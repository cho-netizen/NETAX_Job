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

  return L;
};
