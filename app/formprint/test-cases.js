/*
 * 법정서식 원본 모양 출력 — 시험용 합성 사건 3건(신고용 아님). test.html(브라우저)과 tools/formprint-check.js(node)가 같이 씀.
 * NxFormPrintTestCases(E) → [{name, forms, ctx}]   E = 세액계산 엔진(taxcalc-engine.html을 불러온 객체)
 * rateCode·typeCode 등 화면 함수가 주는 값은 같은 규칙으로 손으로 넣었다(앱에서는 NxFormPrint.ctxFromApp이 화면 함수로 채움).
 */
(function (root, factory) {
  var f = factory();
  if (typeof module === 'object' && module.exports) module.exports = f;
  else root.NxFormPrintTestCases = f;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var AGENT = { name: '조종호(견본)', bizNo: '000-00-00000', mgmtNo: 'A00000', phone: '02-000-0000' };
  return function (E) {
    // 양도: 토지 2014.3.1. 취득 1.5억 → 2025.6.30. 양도 3억, 필요경비 500만
    var tAsset = { assetType: 'other', assetKind: 'land', transferPrice: 300000000, acquisitionPrice: 150000000, necessaryExpenses: 5000000,
      transferDate: '2025-06-30', acquisitionDate: '2014-03-01', assetLocation: '경기도 ○○시 ○○동 123-4 (견본)' };
    var ctx양도 = {
      r: E.calculateTransferTaxMultiJS([clone(tAsset)], {}), 귀속연도: '2025', 신고구분: '확정신고', 신고일: '2026-05-20', splitAmt: 0,
      seller: { name: '홍길동', regNo: '000000-0000000', phone: '010-0000-0000', address: '서울특별시 ○○구 견본로 1, 101동 1001호 (견본동, 견본아파트)', taxOffice: '서초세무서', isTransferorResident: true },
      buyers: [{ name: '김○○', regNo: '000000-0000000', shareRatio: '1/1', relationLabel: '타인' }],
      // 토지 일반(2년 이상) 세율구분 10, 자산종류 토지 01 — trRateClassCode1_·trAssetTypeCode1_와 같은 규칙
      assets: [{ asset: tAsset, single: E.calculateTransferTaxSingleJS(clone(tAsset)), rateCode: '10', typeCode: '01', transferCause: 'sale' }],
      taxAgent: AGENT
    };
    // 증여: 직계존속에게서 3억, 기한 내
    var ctx증여 = {
      r: E.calculateGiftTaxJS({ giftAmount: 300000000, relation: '직계존속', giftDate: '2026-09-01', filingStatus: 'ontime' }),
      item: { amount: 300000000, priorGiftAmount: 0 }, relation: '직계존속', giftDate: '2026-09-01', 신고일: '2026-10-19',
      donee: { name: '홍길동', regNo: '000000-0000000', resident: 'resident', email: 'sample@example.com', phone: '010-0000-0000', address: '세종특별자치시 국세청로 8-14 (견본)', taxOffice: '세종세무서' },
      donor: { name: '홍부모', regNo: '000000-0000000', address: '세종특별자치시 국세청로 8-14 (견본)', filingStatus: 'ontime' },
      marriageBirth: { marriage: 0, birth: 0 }, installment: 0, split: 0, taxAgent: AGENT
    };
    // 상속: 화면 상속세과세가액 12억(= 재산 12.6억 − 공과금 300만 − 채무 5,700만, 장례비 빼기 전), 자녀 2, 거주자, 장례비 1천만, 감정평가수수료 700만
    var ctx상속 = {
      r: E.calculateInheritanceTaxJS({ taxableEstateAmount: 1200000000, childCount: 2, hasSpouse: false, isDecedentResident: true, funeralCostAmount: 10000000, funeralNicheCostAmount: 0, appraisalFeeAmount: 7000000, netFinancialAssets: 0 }),
      신고구분: '기한 내 신고', 신고일: '2026-12-20',
      fv: { priorGiftAdded: 0, lumpSum: 500000000, basic: 200000000 },
      reporter: { name: '견본신고인', regNo: '000000-0000000', relation: '자', address: '서울특별시 ○○구 견본로 2' }, phone: '010-0000-0000', email: 'sample@example.com',
      deceased: { name: '견본피상속인', regNo: '000000-0000000', address: '서울특별시 ○○구 견본로 2', deathDate: '2026-06-30', resident: 'resident', taxOffice: '강남세무서' },
      taxAgent: AGENT, forProfitBequest: 0, forProfitExempted: 0, bizDeferred: 0, installment: 0, split: 0,
      assets: [
        { typeCode: '05', basisCode: '08', location: '서울특별시 ○○구 견본로 2, 101동 1001호', area: 84.97, value: 900000000 },
        { typeCode: '02', basisCode: '08', location: '경기도 ○○군 ○○면 산 12', area: 3300, value: 250000000 },
        { typeCode: '12', basisCode: '01', location: '○○은행 예금', area: 0, value: 110000000 }
      ],
      publicOrg: 0, publicTrust: 0, duesTotal: 3000000, debtTotal: 57000000,
      debts: [{ debtType: 'bank', startDate: '2020-03-02', endDate: '2030-03-02', creditorName: '○○은행', creditorRegNo: '000-00-00000', creditorAddress: '서울특별시 중구 ○○로 1', amount: 57000000 }],
      dues: [{ duesType: 'national', year: '2026', quarter: '2', amount: 3000000 }],
      funerals: [{ category: 'general', payee: '○○장례식장', bizNo: '000-00-00000', detail: '장례비', amount: 10000000 }],
      childCount: 2, minorYears: 0, elderlyCount: 0, disabledYears: 0, isNonResident: false
    };
    // ───── 부표 시험 사건(작업자 하, 2026-10-19) — NxFormPrint.plan(세목, ctx)으로 찍을 서식을 정함 ─────
    // 양도: 토지 4필지(부표1 이어 찍기) — 1번 필지에 필요경비 상세(부표3), 2번은 상속받은 자산 + 주식등(부표2)·파생상품(부표2의2)
    var exp1 = {
      acquisitionExpenseItems: [
        { expenseCode: '112', label: '취득세', payee: '○○구청', amount: 9200000, receiptType: 'other' },
        { expenseCode: '114', label: '법무사 수수료', payee: '○○법무사사무소', payeeBizRegNo: '000-00-00000', payDate: '2014-03-01', amount: 800000, receiptType: 'taxinvoice' },
        { expenseCode: '260', label: '베란다 확장 공사', payee: '○○건설', payeeBizRegNo: '000-00-00000', payDate: '2016-05-02', amount: 15000000, receiptType: 'taxinvoice' }
      ],
      transferExpenseItems: [{ expenseCode: '290', label: '양도 중개수수료', payee: '○○공인중개사', payeeBizRegNo: '000-00-00000', payDate: '2025-06-30', amount: 4000000, receiptType: 'cashreceipt' }]
    };
    function land(i, extra) {
      return Object.assign({ assetType: 'other', assetKind: 'land', transferPrice: 300000000 + i * 10000000, acquisitionPrice: 150000000, necessaryExpenses: 5000000,
        transferDate: '2025-06-30', acquisitionDate: '2014-03-0' + i, assetLocation: '경기도 ○○시 ○○동 12' + i + ' (견본)' }, extra || {});
    }
    var tAssets = [land(1, Object.assign({ necessaryExpenses: 29000000 }, exp1)), land(2, { isInheritedAsset: true, inheritedDecedentAcquisitionDate: '2005-01-01' }), land(3), land(4)];
    var stInput = { assetCategory: 'domestic_stock', companyName: '○○전자(견본)', bizRegNo: '000-00-00000', transferDate: '2025-08-01', acquisitionDate: '2020-01-02',
      acquisitionType: '01', transferPrice: 120000000, acquisitionPrice: 80000000, transferExpenses: 300000, isDaejuju: true, isSmallMediumCompany: false, holdingMonths: 60 };
    var ctx양도부표 = Object.assign({}, ctx양도, {
      r: E.calculateTransferTaxMultiJS(clone(tAssets), {}),
      seller: Object.assign({}, ctx양도.seller, { regNo: '800101-1000000', address: '서울특별시 ○○구 견본로 1', addressDong: '101', addressHo: '1001' }),
      assets: tAssets.map(function (a) { return { asset: a, single: E.calculateTransferTaxSingleJS(clone(a)), rateCode: '10', typeCode: '01', transferCause: 'sale' }; }),
      stock: { assetCategory: 'domestic_stock', input: stInput, result: E.calculateStockTransferTaxJS(clone(stInput)) },
      derivative: E.calculateDerivativeTransferTaxJS({ domesticGainLoss: 30000000, overseasGainLoss: -5000000, filingStatus: 'ontime' })
    });
    // 증여: 직계존속에게서 1.5억(혼인 공제), 아파트·토지·서화 배분, 가업승계 납부유예, 혼인공제 추징, 공익법인 가산세
    var gr = E.calculateGiftTaxJS({ giftAmount: 150000000, relation: '직계존속', giftDate: '2026-09-01', filingStatus: 'ontime', isMarriageGift: true, marriageDate: '2026-10-01', publicInterestOrgPenalty: 3000000 });
    var mbThis = gr.혼인출산증여재산공제_이번분 != null ? gr.혼인출산증여재산공제_이번분 : gr.혼인출산증여재산공제;
    var bdIn = { taxPayable: 500000000, businessSuccessionPropertyValue: 2700000000, totalPropertyValue: 3000000000 };
    var ctx증여부표 = Object.assign({}, ctx증여, {
      r: gr, item: { amount: 150000000, priorGiftAmount: 0 }, marriageBirth: { marriage: mbThis, birth: 0 },
      donee: Object.assign({}, ctx증여.donee, { addressDong: '101', addressHo: '202' }),
      mbDetail: { thisTime: mbThis, cur: { marriage: mbThis, birth: 0 }, prior: 0, marriageDate: '2026-10-01', birthDate: '', giftDate: '2026-09-01', giftAmount: 150000000 },
      giftAssets: [
        { method: 'apartment', typeCode: '05', basisCode: '08', location: '세종특별자치시 ○○로 1, 101동 202호', area: 84.97, value: 100000000 },
        { method: 'land', typeCode: '02', basisCode: '08', location: '충청남도 ○○군 ○○면 산 1', area: 100, unitPrice: 300000, value: 30000000 },
        { method: 'artwork', typeCode: '12', basisCode: '03', location: '서양화 1점', area: 1, value: 20000000,
          artwork: { code: '01', artist: '홍작가(견본)', title: '풍경', year: '1990', material: '캔버스에 유채', size: '90.9×72.7' } }
      ],
      bd: { totalAsset: 10000000000, nonBiz55: 500000000, nonBiz49: 300000000, nonBiz61: 0, excessCash: 200000000, nonBizStock: 0,
        totalValue: 3000000000, businessValue: 2700000000, taxPayable: 500000000, result: E.calculateBusinessSuccessionDeferralAmountJS(bdIn) },
      clawback: { formType: 'gf_marriage', reason: '01', result: E.calculateClawbackInterestJS({ clawedBackTaxAmount: 10000000, startDate: '2024-05-01', endDate: '2026-09-30', provision: 'gift_marriage' }) },
      publicOrgPenaltyItems: [{ penaltyType: 'report_not_filed', base: 100000000, amount: 1000000 }, { penaltyType: 'management_violation', violationSubType: 'audit', base: 200000000, amount: 2000000 }]
    });
    // 상속: 배우자·자녀, 재산 6건(부표1 이어 찍기), 처분재산, 영리법인 유증, 가업상속공제 사후관리 추징(부표6)
    var vA = [
      { method: 'apartment', typeCode: '05', basisCode: '08', location: '서울특별시 ○○구 견본로 2, 101동 1001호', area: 84.97, value: 900000000, alloc: [{ heirIdx: 0, ratio: 1 }] },
      { method: 'land', typeCode: '02', basisCode: '08', location: '경기도 ○○군 ○○면 산 12', area: 3300, value: 250000000, alloc: [{ heirIdx: 1, ratio: 1 }] },
      { method: 'deposit', typeCode: '12', basisCode: '01', location: '○○은행 예금', area: 0, value: 110000000, alloc: [{ heirIdx: 0, ratio: 0.5 }, { heirIdx: 1, ratio: 0.5 }] },
      { method: 'artwork', typeCode: '12', basisCode: '03', location: '동양화 1점', area: 1, value: 20000000, alloc: [{ heirIdx: 1, ratio: 1 }],
        artwork: { code: '02', artist: '김화백(견본)', title: '산수', year: '1975', material: '한지에 수묵', size: '60×120' } },
      { method: 'listedStock', typeCode: '08', basisCode: '01', location: '○○전자 보통주', area: 1000, unitPrice: 50000, value: 50000000, alloc: [{ heirIdx: 1, ratio: 1 }] },
      { method: 'other', typeCode: '12', basisCode: '01', location: '승용차 1대', area: 1, value: 10000000, alloc: [{ heirIdx: 0, ratio: 1 }] }
    ];
    var gross = vA.reduce(function (s, a) { return s + a.value; }, 0);
    var disposal = [
      { category: '현금·예금·유가증권', oneYearAmount: 300000000, oneYearSelfDeposit: 0, oneYearExplained: 100000000, twoYearAmount: 300000000, twoYearSelfDeposit: 0, twoYearExplained: 100000000 },
      { category: '부동산', oneYearAmount: 0, oneYearSelfDeposit: 0, oneYearExplained: 0, twoYearAmount: 600000000, twoYearSelfDeposit: 0, twoYearExplained: 500000000 },
      { category: '부담채무Ⅰ(국가·지자체·금융기관)', oneYearAmount: 250000000, oneYearSelfDeposit: 0, oneYearExplained: 0, twoYearAmount: 0, twoYearSelfDeposit: 0, twoYearExplained: 0 }
    ];
    var ihIn = { taxableEstateAmount: gross - 3000000 - 57000000, childCount: 1, hasSpouse: true, spouseActualInheritedAmount: 965000000, spouseLegalShareRatio: 0.6,
      isSpousePropertyDivided: true, isDecedentResident: true, funeralCostAmount: 10000000, funeralNicheCostAmount: 0, appraisalFeeAmount: 0, netFinancialAssets: 0,
      disposalPresumptionItems: disposal, forProfitBequestAmount: 100000000, forProfitExemptedTaxAmount: 30000000, forProfitHeirShareRatio: 0.5, businessInheritanceDeduction: 200000000 };
    var ihR = E.calculateInheritanceTaxJS(clone(ihIn));
    var ctx상속부표 = Object.assign({}, ctx상속, {
      r: ihR, fv: { priorGiftAdded: 0, lumpSum: 500000000, basic: 200000000 },
      childCount: ihIn.childCount, // [2026.10.20 서식 감사] 엔진 입력과 같은 자녀 수(예전엔 ctx상속의 2명이 그대로 남아 부표3 ⑲가 엔진 인적공제와 달랐음 — 새 검산이 잡음)
      reporter: Object.assign({}, ctx상속.reporter, { addressDong: '101', addressHo: '1001' }),
      assets: vA, valAssets: vA, valuationTotal: gross, grossEstate: gross,
      heirs: [
        { name: '견본배우자', regNo: '000000-0000000', relation: '배우자', address: '서울특별시 ○○구 견본로 2', addressDong: '101', addressHo: '1001', statutoryShareRatio: '3/5', actualValue: 965000000, isReporter: false },
        { name: '견본신고인', regNo: '000000-0000000', relation: '자', address: '서울특별시 ○○구 견본로 2', statutoryShareRatio: '2/5', actualValue: 375000000, isReporter: true }
      ],
      spouse: { estateValue: 965000000, assumedDebt: 0, nonTaxable: 0, actual: 965000000, nonHeirBequest: 0, giftToHeirs: 0, ratio: 0.6, giftBase: 0, priorGiftedIncluded: 0, divided: true },
      nonHeirBequest: 0, disposalItems: disposal, forProfitBequest: 100000000, forProfitExempted: 30000000, forProfitRatio: 0.5,
      clawback: { formType: 'ih6', result: E.calculateClawbackInterestJS({ clawedBackTaxAmount: 50000000, startDate: '2024-04-01', endDate: '2026-06-30', method: 'assessment', assessmentDate: '2023-12-31' }) },
      신고일: '2026-12-20'
    });
    // 상속 부표7: 가업상속 납부유예 사후관리(지분 감소) — 이율이 바뀐 기간이 있어 구간이 둘 이상
    var ctx상속부표7 = Object.assign({}, ctx상속부표, {
      clawback: { formType: 'ih7', result: E.calculateClawbackInterestJS({ clawedBackTaxAmount: 40000000, startDate: '2023-01-01', endDate: '2026-06-30', method: 'split' }) },
      bc: { provision: 'inheritance', deferredTax: 80000000, triggerEvent: 'equity_decreased', equityDecreaseRatio: 0.5 }
    });
    // ───── 84호 주식등·국외자산(2026-10-20) — 국외자산은 부동산 등과 같은 84호·부표1에 열을 나눠, 주식등은 84호 한 장 따로 ─────
    // 국외자산 2건(미국 토지·건물 — 금액은 원화 환산 견본), 화면 run-overseas-transfer와 같은 입력
    var oaAssets = [
      { isOverseasAsset: true, oaResident5yr: true, transferDate: '2025-07-15', acquisitionDate: '2015-02-01', transferPrice: '850000000', acquisitionPrice: '500000000', oaCapitalExpenditure: '20000000', oaTransferExpenses: '12000000', oaForeignTaxMethod: 'credit', oaForeignTaxPaid: '40000000' },
      { isOverseasAsset: true, oaResident5yr: true, transferDate: '2025-09-30', acquisitionDate: '2019-05-20', transferPrice: '230000000', acquisitionPrice: '260000000', oaCapitalExpenditure: '', oaTransferExpenses: '3000000', oaForeignTaxMethod: 'credit', oaForeignTaxPaid: '' }
    ];
    // 화면 국외자산 카드(transferAssets 중 isOverseasAsset — 금액은 글자) → 엔진 거래(taxcalc.html run-overseas-transfer와 같은 식)
    var oaTx = oaAssets.map(function (a) { return { wasResidentFiveYearsContinuously: !!a.oaResident5yr, transferDate: a.transferDate, transferPrice: Number(a.transferPrice) || 0, acquisitionPrice: Number(a.acquisitionPrice) || 0,
      capitalExpenditure: Number(a.oaCapitalExpenditure) || 0, transferExpenses: Number(a.oaTransferExpenses) || 0, foreignTaxCreditMethod: a.oaForeignTaxMethod || 'credit', foreignTaxPaidAmount: Number(a.oaForeignTaxPaid) || 0 }; });
    var oaR = E.calculateOverseasAssetTransferTaxMultiJS(clone(oaTx), { filingStatus: 'ontime' });
    var stForeign = { assetCategory: 'foreign_stock', companyName: 'ABC Corp(견본)', bizRegNo: '', transferDate: '2025-11-03', acquisitionDate: '2021-04-01',
      acquisitionType: '01', transferPrice: 95000000, acquisitionPrice: 61000000, transferExpenses: 250000, isSmallMediumCompany: false, foreignTaxPaidAmount: 500000 };
    var ctx양도혼합 = Object.assign({}, ctx양도, {
      overseas: oaR, overseasAssets: oaAssets,
      stock: { assetCategory: 'foreign_stock', input: stForeign, result: E.calculateStockTransferTaxJS(clone(stForeign)) }
    });
    var ctx양도국외만 = Object.assign({}, ctx양도, { r: null, assets: [], buyers: [], 귀속연도: '2025', overseas: oaR, overseasAssets: oaAssets });
    // 주식등만 — 기타자산(비사업용토지 과다보유법인 주식, 1-11·부표2 52)
    var stOther = { assetCategory: 'other_asset', companyName: '○○개발(견본)', bizRegNo: '000-00-00000', transferDate: '2025-04-10', acquisitionDate: '2012-06-01',
      acquisitionType: '01', transferPrice: 700000000, acquisitionPrice: 300000000, transferExpenses: 5000000, isMajorityNonBusinessLandCorp: true };
    var ctx양도기타주식 = Object.assign({}, ctx양도, { r: null, assets: [], buyers: [], stock: { assetCategory: 'other_asset', input: stOther, result: E.calculateStockTransferTaxJS(clone(stOther)) } });
    // 주식등만 — 국내주식 이월과세(배우자에게 2025.3. 증여받아 1년 안 양도, §97의2①) — 부표2 ⑬⑭는 엔진 값(증여자 취득가액·증여세 상당액)으로
    var stCarry = { assetCategory: 'domestic_stock', companyName: '○○바이오(견본)', bizRegNo: '000-00-00000', transferDate: '2025-12-01', acquisitionDate: '2025-03-02',
      acquisitionType: '07', transferPrice: 500000000, acquisitionPrice: 450000000, transferExpenses: 1000000, isDaejuju: true, isSmallMediumCompany: false, holdingMonths: 9,
      giftReceivedDate: '2025-03-02', donorRelation: 'spouse', donorAcquisitionPrice: 100000000, doneeOwnAcquisitionPrice: 450000000, giftTaxPaid: 0, giftTaxableValue: 450000000 };
    var crR = E.calculateStockTransferTaxWithCarryoverJS(clone(stCarry));
    var ctx양도이월주식 = Object.assign({}, ctx양도, { r: null, assets: [], buyers: [], stock: { assetCategory: 'domestic_stock', input: stCarry, result: crR } });
    // 주식등 계산기의 신탁수익권(1-95, 부표1 26)·파생상품(1-81, 부표2의2)
    var stTrust = { assetCategory: 'trust_beneficiary', companyName: '○○부동산신탁 수익권(견본)', transferDate: '2025-05-20', acquisitionDate: '2020-01-10', acquisitionType: '01',
      transferPrice: 400000000, acquisitionPrice: 250000000, transferExpenses: 2000000 };
    var stDeriv = { assetCategory: 'derivative', companyName: 'KOSPI200 선물(견본)', transferDate: '2025-08-29', acquisitionDate: '2025-08-01', acquisitionType: '01',
      transferPrice: 180000000, acquisitionPrice: 150000000, transferExpenses: 300000 };
    var ctx양도신탁 = Object.assign({}, ctx양도, { r: null, assets: [], buyers: [], stock: { assetCategory: 'trust_beneficiary', input: stTrust, result: E.calculateStockTransferTaxJS(clone(stTrust)) } });
    var ctx양도파생 = Object.assign({}, ctx양도, { r: null, assets: [], buyers: [], stock: { assetCategory: 'derivative', input: stDeriv, result: E.calculateStockTransferTaxJS(clone(stDeriv)) } });
    // 처음 3건은 한 장짜리 사건(tools/formprint-continue-check.js가 고치기 전 모듈과 그림을 비교) — 부표 사건은 .부표에 따로 둠
    var base = [
      { name: '양도84호', forms: ['양도84호', '양도84부표1'], ctx: ctx양도 },
      { name: '증여10호', forms: ['증여10호'], ctx: ctx증여 },
      { name: '상속9호', forms: ['상속9호', '상속9호부표1', '상속9호부표3'], ctx: ctx상속 }
    ];
    base.부표 = [
      { name: '양도_부표', tax: '양도', ctx: ctx양도부표 },
      { name: '증여_부표', tax: '증여', ctx: ctx증여부표 },
      { name: '상속_부표', tax: '상속', ctx: ctx상속부표 },
      { name: '상속_부표7', tax: '상속', only: ['상속9호부표7'], ctx: ctx상속부표7 },
      { name: '양도_국외주식혼합', tax: '양도', ctx: ctx양도혼합 },
      { name: '양도_국외자산만', tax: '양도', ctx: ctx양도국외만 },
      { name: '양도_기타자산주식', tax: '양도', ctx: ctx양도기타주식 },
      { name: '양도_이월과세주식', tax: '양도', ctx: ctx양도이월주식 },
      { name: '양도_신탁수익권', tax: '양도', ctx: ctx양도신탁 },
      { name: '양도_파생주식계산기', tax: '양도', ctx: ctx양도파생 }
    ];
    return base;
  };
});
