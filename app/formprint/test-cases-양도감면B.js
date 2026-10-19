// 원본 모양 인쇄 시험 사례 — 양도감면B (node tools/formprint-check-ext.js 양도감면B)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
module.exports = function (E, H) {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  var SELLER = { name: '홍길동', regNo: '650302-1000000', phone: '010-0000-0000', address: '서울특별시 ○○구 견본로 1', addressDong: '101', addressHo: '1001',
    taxOffice: '서초세무서', isTransferorResident: true };
  // 양도 사건 ctx — 앱에서는 NxFormPrint.ctxFromApp.양도(i)가 만드는 모양(r·seller·assets[{asset, single}]·taxAgent) + 신고일
  function trCtx(assets, extra) {
    return Object.assign({
      r: E.calculateTransferTaxMultiJS(clone(assets), {}), seller: SELLER, buyers: [], 귀속연도: String(assets[0].transferDate).slice(0, 4), 신고일: '2026-08-31', splitAmt: 0,
      assets: assets.map(function (a) { return { asset: a, single: E.calculateTransferTaxSingleJS(clone(a)), rateCode: '10', typeCode: '05', transferCause: 'sale' }; }),
      taxAgent: AGENT
    }, extra || {});
  }
  var L = [];

  // ① 조특62호의2 — 장기일반민간임대주택(§97의3): 2012.4.10. 취득 4억, 2015.5.1. 등록, 10년 임대, 2026.6.30. 양도 9억, 필요경비 1천만
  //   기준시가: 취득일 2.5억, 임대 개시(등록)일 3억, 양도일 6억 → 시행령 §97의3⑤(2026.2.27.~) 임대기간 중 양도차익 = 4.9억 × (6억 − 3억) ÷ (6억 − 2.5억) = 4.2억
  //   손계산: 장기보유특별공제 = 4.2억 × 70% + 0.7억 × 28%(14년, 표1) = 2억9,400만 + 1,960만 = 3억1,360만(엔진과 같음)
  var g1 = { assetType: 'house', assetKind: 'building', transferPrice: 900000000, acquisitionPrice: 400000000, necessaryExpenses: 10000000,
    acquisitionDate: '2012-04-10', transferDate: '2026-06-30', assetLocation: '서울특별시 ○○구 견본로 22, 3동 304호 (견본)',
    rentalSpecialType: 'rental_general', rentalYears: 10, rentalRegistrationDate: '2015-05-01',
    acquisitionStandardPrice: 250000000, registrationStandardPrice: 300000000, transferStandardPrice: 600000000 };
  var c1 = trCtx([g1]);
  L.push({ name: '조특62호의2_장기일반민간임대10년', forms: [{ formKey: '조특62호의2', ctx: Object.assign({}, c1, { 특례자산: 0 }) }], ctx: c1 });
  // plan으로 고르는지(자산 2개 중 임대주택만)
  var other = { assetType: 'other', assetKind: 'land', transferPrice: 200000000, acquisitionPrice: 100000000, necessaryExpenses: 0,
    acquisitionDate: '2015-01-05', transferDate: '2026-06-30', assetLocation: '경기도 ○○군 ○○면 12 (견본)' };
  var c1b = trCtx([other, g1]);
  L.push({ name: '조특62호의2_plan_두자산', forms: require('./mappers-양도감면B.js').plan('양도', c1b), ctx: c1b });

  // ② 조특62호의3 — 장기임대주택(§97의4): 2012.4.10. 취득 5억, 2016.3.2. 등록, 8년 임대, 2026.6.30. 양도 15억(1세대1주택 아님)
  //   손계산: 보유 14년 → 표1 28% + 추가공제율 6%(8년 이상 9년 미만) = 34% → 장기보유특별공제 = 10억 × 34% = 3억4천만
  var g2 = { assetType: 'house', assetKind: 'building', transferPrice: 1500000000, acquisitionPrice: 500000000, necessaryExpenses: 0,
    acquisitionDate: '2012-04-10', transferDate: '2026-06-30', assetLocation: '부산광역시 ○○구 견본로 7, 2동 201호 (견본)',
    rentalSpecialType: 'rental_long', rentalYears: 8, rentalRegistrationDate: '2016-03-02',
    acquisitionStandardPrice: 300000000, registrationStandardPrice: 350000000, transferStandardPrice: 900000000 };
  var c2 = trCtx([g2]);
  L.push({ name: '조특62호의3_장기임대8년', forms: [{ formKey: '조특62호의3', ctx: Object.assign({}, c2, { 특례자산: 0 }) }], ctx: c2 });

  // ③ 조특52호의3 — 일반주택(2018.5.1. 취득 6억, 거주 4년) 2026.7.15. 10억 양도, 그 전 2025.3.10. 인구감소지역 주택 취득("특정주택 제외 판정" pd 적용)
  //   손계산: 1세대1주택 양도가액 12억 이하 → 전액 비과세(소득세법 §89①3호·시행령 §154), 산출세액 0
  var h3 = { assetType: 'house', assetKind: 'building', transferPrice: 1000000000, acquisitionPrice: 600000000, necessaryExpenses: 0,
    acquisitionDate: '2018-05-01', transferDate: '2026-07-15', assetLocation: '서울특별시 ○○구 견본로 9, 5동 502호 (견본)', isOneHouseOneFamily: true, residenceYears: 4,
    oneHouseSpecialCase: { provisionLabel: '인구감소지역 주택(조특법§71의2)', formNo: '조세특례제한법 시행규칙 [별지 제52호의3서식]', formTitle: '1세대1주택 과세특례(인구감소지역주택, 준공후미분양주택 취득자) 신고서',
      acquisitionDate: '2025-03-10', houseType: '', pdStdPrice: 350000000, 안내: '(견본) 인구감소지역 주택은 1세대1주택 판정 때 주택 수에서 뺌' } };
  var c3 = trCtx([h3]);
  L.push({ name: '조특52호의3_인구감소지역', forms: [{ formKey: '조특52호의3', ctx: Object.assign({}, c3, { 특례자산: 0 }) }], ctx: c3 });
  // 같은 서식, 비수도권 준공 후 미분양주택(u9) — 미분양 줄에 찍히는지
  var h3b = Object.assign({}, h3, { oneHouseSpecialCase: Object.assign({}, h3.oneHouseSpecialCase, { provisionLabel: '수도권 밖 준공후미분양주택(조특법§98의9)', acquisitionDate: '2024-11-20', pdStdPrice: '', u9Area: 84.97, u9Price: 650000000, 안내: '(견본) 수도권 밖 준공 후 미분양주택은 1세대1주택 판정 때 주택 수에서 뺌' }) });
  var c3b = trCtx([h3b]);
  L.push({ name: '조특52호의3_준공후미분양', forms: require('./mappers-양도감면B.js').plan('양도', c3b), ctx: c3b });

  // ④ 조특63호의4 — 일반주택(2016.9.1. 취득 7억, 거주 8년) 2026.9.30. 11억 양도, 2024.4.15. 농어촌주택 취득("특정주택 제외 판정" rh 적용)
  //   손계산: 1세대1주택 양도가액 12억 이하 → 전액 비과세, 산출세액 0
  var h4 = { assetType: 'house', assetKind: 'building', transferPrice: 1100000000, acquisitionPrice: 700000000, necessaryExpenses: 0,
    acquisitionDate: '2016-09-01', transferDate: '2026-09-30', assetLocation: '대전광역시 ○○구 견본로 4, 7동 705호 (견본)', isOneHouseOneFamily: true, residenceYears: 8,
    oneHouseSpecialCase: { provisionLabel: '농어촌주택등(조특법§99의4)', formNo: '조세특례제한법 시행규칙 [별지 제63호의4서식]', formTitle: '농어촌주택 등 취득자에 대한 과세특례신고서',
      acquisitionDate: '2024-04-15', houseType: '농어촌주택', rhLandArea: 330, rhHousePrice: 180000000, 안내: '(견본) 농어촌주택은 3년 이상 보유하면 일반주택 1세대1주택 판정 때 주택 수에서 뺌' } };
  var c4 = trCtx([h4]);
  L.push({ name: '조특63호의4_농어촌주택', forms: require('./mappers-양도감면B.js').plan('양도', c4), ctx: c4 });

  // ⑤ 조특63호의2 — 옛 §99의2 시절 사건(1999.3.2. 취득 기존주택 2001.6.29. 양도) — plan엔 안 들어가므로 직접 고른 자산으로
  var h5 = { assetType: 'house', assetKind: 'building', transferPrice: 180000000, acquisitionPrice: 120000000, necessaryExpenses: 0,
    acquisitionDate: '1999-03-02', transferDate: '2001-06-29', assetLocation: '경기도 ○○시 견본로 3, 101동 202호 (견본)' };
  var c5 = trCtx([h5], { 신고일: '2001-08-31' });
  L.push({ name: '조특63호의2_옛99조의2', forms: [{ formKey: '조특63호의2', ctx: Object.assign({}, c5, { 특례자산: 0 }) }], ctx: c5 });
  // ⑥ 조특63호 — 법 §98 미분양 국민주택(1996.5.10. 취득) 2026.3.31. 양도 — plan엔 안 들어가므로 직접 고른 자산으로
  var h6 = { assetType: 'house', assetKind: 'building', transferPrice: 450000000, acquisitionPrice: 90000000, necessaryExpenses: 0,
    acquisitionDate: '1996-05-10', transferDate: '2026-03-31', assetLocation: '인천광역시 ○○구 견본로 6, 3동 105호 (견본)' };
  var c6 = trCtx([h6], { 신고일: '2026-05-31' });
  L.push({ name: '조특63호_법98조', forms: [{ formKey: '조특63호', ctx: Object.assign({}, c6, { 특례자산: 0 }) }], ctx: c6 });
  // plan이 63호의2·63호를 고르지 않는지(계산기에 제도 없음) — 위 두 사건의 plan 결과는 비어 있어야 함
  var pl = require('./mappers-양도감면B.js').plan('양도', c5).concat(require('./mappers-양도감면B.js').plan('양도', c6));
  if (pl.length) throw new Error('63호의2·63호가 plan에 들어감: ' + JSON.stringify(pl.map(function (x) { return x.formKey; })));

  return L;
};
