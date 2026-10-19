// 원본 모양 인쇄 시험 사례 — 양도감면A (node tools/formprint-check-ext.js 양도감면A)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
module.exports = function (E, H) {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var SELLER = { name: '홍길동', regNo: '600101-1000000', phone: '010-0000-0000', address: '서울특별시 ○○구 견본로 1, 101동 1001호 (견본동)', taxOffice: '서초세무서', isTransferorResident: true };
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  // 양도 ctx 하나 — 자산 목록으로 엔진 합산(calculateTransferTaxMultiJS)·단건 계산, 화면 코드값(rateCode·typeCode)은 손으로
  function trCtx(list, extra) {
    var r = E.calculateTransferTaxMultiJS(list.map(clone), {});
    return Object.assign({ r: r, 귀속연도: String(list[0].transferDate).slice(0, 4), 신고구분: '확정신고', 신고일: '2026-05-20', splitAmt: 0,
      seller: SELLER, buyers: [{ name: '○○공사', regNo: '000-00-00000', shareRatio: '1/1', relationLabel: '타인' }],
      assets: list.map(function (a) { return { asset: a, single: E.calculateTransferTaxSingleJS(clone(a)), rateCode: '10', typeCode: '01', transferCause: 'sale' }; }),
      taxAgent: AGENT }, extra || {});
  }
  var L = [];

  // 1. 조특54호 — 공익사업 협의매수(§77①1호) 현금보상 토지, 2015 취득 2억 → 2025.8.20. 5억(사업인정고시 2024.3.15.)
  var comp = { assetType: 'other', assetKind: 'land', transferPrice: 500000000, acquisitionPrice: 200000000, necessaryExpenses: 0,
    transferDate: '2025-08-20', acquisitionDate: '2015-04-01', assetLocation: '경기도 ○○시 ○○동 100 (견본)', assetArea: 1200,
    compensationType: 'cash', compensationTransferMode: 'consult', publicNoticeDate: '2024-03-15' };
  L.push({ name: '54호_공익사업_협의매수_현금', forms: ['조특54호'], ctx: trCtx([comp], { 감면자산: 0 }) });

  return L;
};
