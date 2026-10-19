// 원본 모양 인쇄 시험 사례 — 양도소득특례 (node tools/formprint-check-ext.js 양도소득특례)
// module.exports = function (E, H) → [{ name, forms: [formKey | {formKey, ctx}], ctx }]
//   E = 계산 엔진(taxcalc-engine.html을 불러온 것 — 값은 엔진으로 계산해 넣을 것), H = mappers.js helpers
//   값은 모두 합성 값(신고용 아님).
//   1세대1주택 특례 신고서는 앱과 같게 "특정주택 제외 판정" 엔진 함수로 판정한 뒤, 판정 창이 자산에 남기는 oneHouseSpecialCase를
//   taxcalc.html provisionForms 표와 같은 글자로 만들어 넣는다(판정이 적용 안 됨이면 시험이 실패하게 throw).
module.exports = function (E, H) {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  var SELLER = { name: '홍길동', regNo: '800101-1000000', phone: '010-0000-0000', address: '서울특별시 ○○구 견본로 1', addressDong: '101', addressHo: '1001',
    taxOffice: '서초세무서', isTransferorResident: true };
  function need(r, what) { if (!r || r.error || !r.적용여부) throw new Error(what + ' 판정이 적용 안 됨: ' + JSON.stringify(r)); return r; }
  // 양도 사건 하나(자산 목록) → ctxFromApp.양도와 같은 모양
  function caseOf(assets, extra) {
    return Object.assign({
      r: E.calculateTransferTaxMultiJS(clone(assets), {}), 귀속연도: assets[0].transferDate.slice(0, 4), 신고구분: '확정신고', 신고일: '2026-05-20', splitAmt: 0,
      seller: clone(SELLER), buyers: [{ name: '김○○', regNo: '000000-0000000', shareRatio: '1/1', relationLabel: '타인' }],
      assets: assets.map(function (a) { return { asset: a, single: E.calculateTransferTaxSingleJS(clone(a)), rateCode: '20', typeCode: '04', transferCause: 'sale' }; }),
      taxAgent: AGENT
    }, extra || {});
  }

  // ① 상생임대주택(영 §155의3) — 아파트 2020.3.2. 취득 9억 → 2026.4.30. 양도 14억(1세대1주택, 12억 초과분 과세)
  var mgIn = { priorLeaseStartDate: '2020-04-01', priorLeaseEndDate: '2022-03-31', priorLeaseDeposit: 500000000, priorLeaseRent: 0,
    mutualLeaseContractDate: '2022-02-15', mutualLeaseStartDate: '2022-04-01', mutualLeaseEndDate: '2024-04-01', mutualLeaseDeposit: 520000000, mutualLeaseRent: 0, transferDate: '2026-04-30' };
  // ※ 상생 임대 2022.4.1.~2024.3.31.(만 2년)은 엔진이 23개월로 세어 미적용 — 영 §155의3③(1개월 미만은 1개월)과 다름(보고서 계산 오류 의심). 시험은 4.1. 종료로
  var mg = need(E.calculateMutualGrowthLeaseExclusionJS(mgIn), '상생임대주택');
  var mgAsset = { assetType: 'house', transferPrice: 1400000000, acquisitionPrice: 900000000, necessaryExpenses: 12000000, transferDate: '2026-04-30', acquisitionDate: '2020-03-02',
    assetLocation: '서울특별시 ○○구 ○○로 10, 101동 1001호 (견본아파트)', isOneHouseOneFamily: true,
    oneHouseSpecialCase: { provisionLabel: '상생임대주택(소득세법시행령§155의3)', formNo: '소득세법 시행규칙 [별지 제83호의4서식]', formTitle: '상생임대주택에 대한 특례적용신고서',
      acquisitionDate: '', houseType: '', newHousingCompletionDate: '', mgContractDate: mgIn.mutualLeaseContractDate,
      mgLeasePeriod: mgIn.mutualLeaseStartDate + ' ~ ' + mgIn.mutualLeaseEndDate, 안내: mg.안내 } };
  var ctxMg = caseOf([mgAsset]);

  // ② 거주주택 특례(영 §155⑳) — 장기임대주택 보유자가 거주주택(2015.3.2. 취득 6억, 5년 거주) → 2026.3.31. 양도 11억(12억 이하 비과세)
  var lr = need(E.calculateRentalHousingResidenceExclusionJS({ residencePeriodMonths: 60, meetsLongTermRentalRequirements: true, hasPriorQualifyingResidence: false }), '거주주택 특례');
  var lrAsset = { assetType: 'house', transferPrice: 1100000000, acquisitionPrice: 600000000, necessaryExpenses: 8000000, transferDate: '2026-03-31', acquisitionDate: '2015-03-02',
    assetLocation: '경기도 ○○시 ○○로 20, 203동 502호 (견본마을)', isOneHouseOneFamily: true,
    oneHouseSpecialCase: { provisionLabel: '장기임대주택·장기어린이집 보유자의 거주주택(소득세법시행령§155⑳)', formNo: '소득세법 시행규칙 [별지 제83호의2서식]',
      formTitle: '주택임대사업자의 거주주택 1세대1주택 특례적용신고서', acquisitionDate: '', houseType: '', newHousingCompletionDate: '', mgContractDate: '', mgLeasePeriod: '', 안내: lr.안내 } };
  var ctxLr = caseOf([lrAsset]);

  // ③ 1주택+1조합원입주권(영 §156의2③) — 종전주택 2018.5.1. 취득 5억 → 2025.11.20. 양도 9억, 조합원입주권 2023.3.10. 취득(3년 이내 양도)
  var ciIn = { formerHouseAcquisitionDate: '2018-05-01', unionMembershipRightAcquisitionDate: '2023-03-10', formerHouseTransferDate: '2025-11-20' };
  var ci = need(E.calculateReconstructionRightsOneHouseExclusionJS(ciIn), '1주택+1조합원입주권');
  var ciAsset = { assetType: 'house', transferPrice: 900000000, acquisitionPrice: 500000000, necessaryExpenses: 6000000, transferDate: ciIn.formerHouseTransferDate, acquisitionDate: ciIn.formerHouseAcquisitionDate,
    assetLocation: '부산광역시 ○○구 ○○로 30, 5동 301호 (견본)', isOneHouseOneFamily: true,
    oneHouseSpecialCase: { provisionLabel: '1주택+1조합원입주권 보유(소득세법시행령§156의2③④)', formNo: '소득세법 시행규칙 [별지 제83호의5서식]', formTitle: '조합원입주권 또는 분양권 소유자 1세대1주택 특례적용신고서',
      acquisitionDate: ciIn.unionMembershipRightAcquisitionDate, houseType: '', newHousingCompletionDate: '', mgContractDate: '', mgLeasePeriod: '', 안내: ci.안내 } };
  // ④ 1주택+1분양권(영 §156의3②) — 종전주택 2019.6.1. 취득 → 2026.2.15. 양도, 분양권 2023.8.1. 취득, 완성 예정 2026.9.30.
  var prIn = { formerHouseAcquisitionDate: '2019-06-01', presaleRightAcquisitionDate: '2023-08-01', formerHouseTransferDate: '2026-02-15' };
  var pr = need(E.calculatePresaleRightOneHouseExclusionJS(prIn), '1주택+1분양권');
  var prAsset = { assetType: 'house', transferPrice: 700000000, acquisitionPrice: 420000000, necessaryExpenses: 5000000, transferDate: prIn.formerHouseTransferDate, acquisitionDate: prIn.formerHouseAcquisitionDate,
    assetLocation: '대구광역시 ○○구 ○○로 40 (견본빌라 2층)', isOneHouseOneFamily: true,
    oneHouseSpecialCase: { provisionLabel: '1주택+1분양권 보유(소득세법시행령§156의3)', formNo: '소득세법 시행규칙 [별지 제83호의5서식]', formTitle: '조합원입주권 또는 분양권 소유자 1세대1주택 특례적용신고서',
      acquisitionDate: prIn.presaleRightAcquisitionDate, houseType: '', newHousingCompletionDate: '2026-09-30', mgContractDate: '', mgLeasePeriod: '', 안내: pr.안내 } };
  // ⑤ 조합원입주권 자체 양도(준공 전) — 예전 인쇄 reconstructionRightsPrintPageHtml_ 조건(asset.isReconstructionRights)
  var urAsset = { assetType: 'house', isReconstructionRights: true, isCompletedNewHousing: false, transferPrice: 800000000, acquisitionPrice: 300000000, necessaryExpenses: 4000000,
    transferDate: '2026-01-15', acquisitionDate: '2012-07-01', assetLocation: '서울특별시 ○○구 ○○동 50 (○○재건축정비사업조합, 견본)',
    formerResidencePeriod: '2012.07.01 ~ 2021.06.30', businessApprovalDate: '2019-04-12', managementDispositionDate: '2021-06-30', newHousingCompletionDate: '' };

  // ⑥ 귀농주택(영 §155⑦3호·⑩) — 일반주택 2010.9.1. 취득 → 2026.6.30. 양도, 귀농주택 2023.4.1. 취득(5년 이내 일반주택 양도)
  var rfIn = { isOutsideMetroEupMyeon: true, isHighValueHouseAtAcquisition: false, landAreaSqm: 600, meetsFarmingPurposeRequirement: true, wholeFamilyMovedIn: true,
    acquisitionDate: '2023-04-01', generalHouseTransferDate: '2026-06-30', isNotFirstGeneralHouseSinceReturn: false };
  var rf = need(E.calculateReturnFarmHouseExclusionJS(rfIn), '귀농주택');
  var rfAsset = { assetType: 'house', transferPrice: 650000000, acquisitionPrice: 280000000, necessaryExpenses: 3000000, transferDate: rfIn.generalHouseTransferDate, acquisitionDate: '2010-09-01',
    assetLocation: '대전광역시 ○○구 ○○로 60, 7동 702호 (견본)', isOneHouseOneFamily: true,
    oneHouseSpecialCase: { provisionLabel: '귀농주택(소득세법시행령§155⑦3호)', formNo: '소득세법 시행규칙 [별지 제83호서식]', formTitle: '농어촌주택 소유자 1세대1주택 특례적용신고서',
      acquisitionDate: rfIn.acquisitionDate, houseType: '귀농주택', newHousingCompletionDate: '', mgContractDate: '', mgLeasePeriod: '', 안내: rf.안내 } };

  // ⑦ 장기저당담보주택 동거봉양 합가(영 §155의2②) — 먼저 양도하는 일반주택 2016.10.4. 취득 → 2026.7.15. 양도
  var mp = need(E.calculateLongTermMortgageHouseExclusionJS({ mortgagorAge60OrOlderAtContract: true, contractTermTenYearsOrMore: true, repayAtMaturityByDisposal: true,
    transferredBeforeContractMaturity: false, isCohabitationMerger: true }), '장기저당담보주택');
  var mpAsset = { assetType: 'house', transferPrice: 550000000, acquisitionPrice: 330000000, necessaryExpenses: 2500000, transferDate: '2026-07-15', acquisitionDate: '2016-10-04',
    assetLocation: '광주광역시 ○○구 ○○로 70, 3동 1203호 (견본)', isOneHouseOneFamily: true,
    oneHouseSpecialCase: { provisionLabel: '장기저당담보주택(동거봉양 합가, 소득세법시행령§155의2②)', formNo: '소득세법 시행규칙 [별지 제83호의3서식]', formTitle: '장기저당담보주택에 대한 특례적용신고서',
      acquisitionDate: '', houseType: '', newHousingCompletionDate: '', mgContractDate: '', mgLeasePeriod: '', 안내: mp.안내 } };

  // ⑧ 1세대 3주택 이상 — 장기임대주택을 뺀 일반주택 양도(영 §167의3①2호·④, 중과 배제) — 양도인 카드 체크 + 장기임대주택 등록정보
  var mhAsset = { assetType: 'house', transferPrice: 800000000, acquisitionPrice: 450000000, necessaryExpenses: 7000000, transferDate: '2026-08-20', acquisitionDate: '2017-02-10',
    assetLocation: '서울특별시 ○○구 ○○로 80, 8동 801호 (견본, 조정대상지역)', multiHouseCount: '3', isAdjustedArea: true, isMultiHouseRentalExemption: true };
  var ctxMh = caseOf([mhAsset], { seller: Object.assign(clone(SELLER), { multiHouseCount: '3', isMultiHouseRentalExemption: true,
    mhRentalLocation: '○○시 ○○로 81, 2동 201호', mhRentalRegistrationDate: '2018-03-05', mhRentalStartDate: '2018-03-10' }) });
  // 엔진이 중과를 빼고 기본세율(누진)로 계산했는지 — 체크를 뺀 계산과 비교(체크가 있으면 세액이 작아야 함)
  var mhNo = E.calculateTransferTaxMultiJS([Object.assign(clone(mhAsset), { isMultiHouseRentalExemption: false })], {});
  if (!(ctxMh.r.산출세액_합계 < mhNo.산출세액_합계)) throw new Error('83호의6 시험: 일반세율 적용 체크가 중과를 빼지 않음 ' + ctxMh.r.산출세액_합계 + ' / ' + mhNo.산출세액_합계);

  // ⑨ 국외자산 양도 외국납부세액공제(법 §118의6) — 국외자산 3건(가운데 1건은 필요경비 산입 방식이라 신청서에서 빠짐), 2025년 양도
  var ovCards = [
    { isOverseasAsset: true, oaResident5yr: true, assetLocation: '미국 캘리포니아주 ○○시 견본로 100', transferDate: '2025-04-10', acquisitionDate: '2015-06-01',
      transferPrice: 900000000, acquisitionPrice: 500000000, oaCapitalExpenditure: 20000000, oaTransferExpenses: 30000000, oaForeignTaxMethod: 'credit', oaForeignTaxPaid: 60000000 },
    { isOverseasAsset: true, oaResident5yr: true, assetLocation: '베트남 호찌민시 ○○구 견본 아파트', transferDate: '2025-07-01', acquisitionDate: '2019-03-01',
      transferPrice: 300000000, acquisitionPrice: 250000000, oaCapitalExpenditure: 0, oaTransferExpenses: 5000000, oaForeignTaxMethod: 'expense', oaForeignTaxPaid: 3000000 },
    { isOverseasAsset: true, oaResident5yr: true, assetLocation: '일본 도쿄도 ○○구 견본 1-2-3', transferDate: '2025-09-20', acquisitionDate: '2012-11-11',
      transferPrice: 400000000, acquisitionPrice: 300000000, oaCapitalExpenditure: 0, oaTransferExpenses: 10000000, oaForeignTaxMethod: 'credit', oaForeignTaxPaid: 9000000 }
  ];
  // 앱 run-overseas-transfer와 같은 거래 목록
  var ovR = E.calculateOverseasAssetTransferTaxMultiJS(ovCards.map(function (a) {
    return { wasResidentFiveYearsContinuously: !!a.oaResident5yr, transferDate: a.transferDate, transferPrice: a.transferPrice, acquisitionPrice: a.acquisitionPrice,
      capitalExpenditure: a.oaCapitalExpenditure, transferExpenses: a.oaTransferExpenses, foreignTaxCreditMethod: a.oaForeignTaxMethod, foreignTaxPaidAmount: a.oaForeignTaxPaid };
  }), { filingStatus: 'ontime' });
  if (!ovR || ovR.error) throw new Error('국외자산 계산 오류: ' + JSON.stringify(ovR));
  var ctxOv = { seller: clone(SELLER), 귀속연도: '2025', 신고일: '2026-05-20', taxAgent: AGENT, overseas: ovR, overseasAssets: ovCards, assets: [] };

  return [
    { name: '83호의4_상생임대주택', tax: '양도', ctx: ctxMg },
    { name: '83호의2_거주주택특례', tax: '양도', ctx: ctxLr },
    { name: '83호의5_조합원입주권_분양권_입주권양도', tax: '양도', ctx: caseOf([ciAsset, prAsset, urAsset]) },
    { name: '83호_귀농주택', tax: '양도', ctx: caseOf([rfAsset]) },
    { name: '83호의3_장기저당담보주택', tax: '양도', ctx: caseOf([mpAsset]) },
    { name: '83호의6_장기임대주택_일반세율', tax: '양도', ctx: ctxMh },
    { name: '11호_국외자산_외국납부세액공제', tax: '양도', ctx: ctxOv }
  ].map(function (cs) {
    // tax만 준 사례는 plan으로 이 묶음 서식만 고름(84호 본표는 기존 23장 시험에서 봄)
    if (!cs.forms) cs.forms = H.ctxFromApp && cs.tax ? require('./mappers.js').plan(cs.tax, cs.ctx).filter(function (it) { return typeof it !== 'string' && /^소득/.test(it.formKey); }) : [];
    return cs;
  });
};
