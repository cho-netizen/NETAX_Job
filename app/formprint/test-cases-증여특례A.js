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
    srRows: [{ method: 'direct', typeCode: '01', location: '현금(견본 은행 계좌)', value: 2000000000 }, { method: 'listedStock', typeCode: '09', location: '(주)견본전자', value: 1000000000 }],
    srInput: {} });
  L.push({ name: '증여10호의2_창업자금_두번째', forms: [{ formKey: '증여10호의2', ctx: c1 }], ctx: c1 });

  return L;
};
