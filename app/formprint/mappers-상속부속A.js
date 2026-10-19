/*
 * NxFormPrint 묶음 파일 — 상속부속A (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 상속1호 · 상속1호부표1 · 상속2호 · 상속3호 · 상속5호 · 상속6호 · 상속6호의2 · 상속7호
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-상속부속A.js → node tools/formprint-check-ext.js 상속부속A
 *
 * ── ctx ── mappers.js ctxFromApp.상속()이 만든 것(r·deceased·reporter·phone·heirs·valAssets·spouse·taxAgent…)에
 *   ctx.ihx(이 묶음이 더 읽는 화면 값 — 지금 인쇄 ihAttachPrintPagesHtml_가 ihDomNum_·document.getElementById로 읽는 칸과 같음)를 더한다.
 *   ihx는 화면이 있으면 ihxFromDom()으로 채우고(plan·ctxFor), 시험에서는 엔진 입력에서 ihxFromInput(p)로 만든다(같은 모양).
 *     ihx = { biz:{years, individualNet, stockValue, totalAsset, nonBiz55, nonBiz49, nonBiz61, excessCash, nonBizStock, mediumSized, heirNonBizAsset, heirTaxWithoutDeduction},
 *             farm:{individualAsset, individualDebt, stockValue, totalAsset, nonBiz55, nonBiz49, nonBiz61, excessCash, nonBizStock},
 *             netFinancial, disasterLoss, cohabit:{value, req1, req2, req3, heirs:[{heirIdx, value, debt}]}, foreign:{base, paid}, spouseDivided }
 *   상속7호(외국납부세액공제신청서)는 상속세·증여세 공용 — ctx.세목 = '상속'|'증여'. 증여면 ctx는 ctxFromApp.증여(i)(r·donee·donor·giftDate)에
 *   ctx.ihx.foreign = {base: 화면 giftForeignBase, paid: giftForeignTax}를 더한 것.
 *
 * ── 언제 찍나(지금 인쇄 taxcalc.html ihAttachPrintPagesHtml_·foreignTaxCreditPrintPageHtml_의 조건) ──
 *   상속1호·부표1 : r.가업상속공제_계산내역이 있고 납부유예를 고르지 않음(!r.가업상속납부유예_선택)
 *   상속2호       : r.영농상속공제_계산내역이 있음
 *   상속3호       : 상속인 명부에 배우자가 있고 "배우자상속재산분할기한까지 분할·신고" 체크가 꺼짐(ctx.spouse.divided === false)
 *                   — 예전 인쇄는 배우자가 없어도 체크만 꺼져 있으면 찍었음(배우자 없으면 낼 서식이 아님)
 *   상속5호       : 화면 순금융재산가액(ihNetFinancial) > 0
 *   상속6호       : 화면 재해손실공제(ihDisasterLoss) > 0
 *   상속6호의2    : 결과 동거주택상속공제 > 0 또는 화면 동거주택가액(ihCohabitValue) > 0
 *   상속7호       : 결과 외국납부세액공제 > 0 (상속: lastInheritanceResult / 증여: 첫 증여 계산 결과 — 지금 인쇄와 같음)
 */
(function (root, factory) {
  var NF = root.NxFormPrint;
  var MP = (NF && NF.registerExt) ? NF : (typeof require === 'function' ? require('./mappers.js') : null);
  var api = factory(root, MP.helpers);
  if (typeof module === 'object' && module.exports) module.exports = api;
  MP.registerExt(api);
})(typeof window !== 'undefined' ? window : globalThis, function (root, H) {
  'use strict';
  var n = H.n, has = H.has, Out = H.Out;

  var forms = {
    '상속1호': "상속세 및 증여세법 시행규칙 [별지 제1호서식]", // 가업상속공제신고서
    '상속1호부표1': "상속세 및 증여세법 시행규칙 [별지 제1호서식 부표1]", // 가업상속재산명세서
    '상속2호': "상속세 및 증여세법 시행규칙 [별지 제2호서식]", // 영농상속공제신고서
    '상속3호': "상속세 및 증여세법 시행규칙 [별지 제3호서식]", // 배우자 상속재산 미분할 신고서
    '상속5호': "상속세 및 증여세법 시행규칙 [별지 제5호서식]", // 금융재산 상속공제 신고서
    '상속6호': "상속세 및 증여세법 시행규칙 [별지 제6호서식]", // 재해손실 공제신고서(상속세, 증여세)
    '상속6호의2': "상속세 및 증여세법 시행규칙 [별지 제6호의2서식]", // 동거주택상속공제신고서
    '상속7호': "상속세 및 증여세법 시행규칙 [별지 제7호서식]", // 외국납부세액공제신청서(상속세, 증여세)
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // ───────── 공용: 화면 값(ihx) ─────────
  function dom(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }
  function dnum(id) { var e = dom(id); return e ? n(e.value) : 0; }
  function dchk(id) { var e = dom(id); return e ? !!e.checked : null; }
  // 지금 인쇄 ihAttachPrintPagesHtml_가 읽는 화면 칸과 같은 칸(ihDomNum_·getElementById)
  function ihxFromDom() {
    var heirs = (typeof inheritanceHeirs !== 'undefined' && inheritanceHeirs) ? inheritanceHeirs : []; // eslint-disable-line no-undef
    var co = [];
    heirs.forEach(function (h, i) { if (h && h.isCohabitHouse) co.push({ heirIdx: i, value: n(h.cohabitHouseValue), debt: n(h.cohabitHouseDebt) }); });
    return {
      biz: { years: dnum('ihBusinessYears'), individualNet: dnum('ihBusinessIndividualNet'), stockValue: dnum('ihBusinessStockValue'), totalAsset: dnum('ihBusinessTotalAsset'),
        nonBiz55: dnum('ihBusinessNonBiz55'), nonBiz49: dnum('ihBusinessNonBiz49'), nonBiz61: dnum('ihBusinessNonBiz61'), excessCash: dnum('ihBusinessExcessCash'), nonBizStock: dnum('ihBusinessNonBizStock'),
        mediumSized: dchk('ihBusinessMediumSized'), heirNonBizAsset: dnum('ihBusinessHeirNonBizAsset'), heirTaxWithoutDeduction: dnum('ihBusinessHeirTaxWithoutDeduction'),
        reqOwnership: dchk('ihBizReqOwnership'), reqCeoTenure: dchk('ihBizReqCeoTenure') },
      farm: { individualAsset: dnum('ihFarmingIndividualAsset'), individualDebt: dnum('ihFarmingIndividualDebt'), stockValue: dnum('ihFarmingStockValue'), totalAsset: dnum('ihFarmingTotalAsset'),
        nonBiz55: dnum('ihFarmingNonBiz55'), nonBiz49: dnum('ihFarmingNonBiz49'), nonBiz61: dnum('ihFarmingNonBiz61'), excessCash: dnum('ihFarmingExcessCash'), nonBizStock: dnum('ihFarmingNonBizStock') },
      netFinancial: dnum('ihNetFinancial'), disasterLoss: dnum('ihDisasterLoss'),
      cohabit: { value: dnum('ihCohabitValue'), req1: dchk('ihCohabitReq1'), req2: dchk('ihCohabitReq2'), req3: dchk('ihCohabitReq3'), heirs: co },
      foreign: { base: dnum('ihForeignBase'), paid: dnum('ihForeignTax') },
      spouseDivided: dchk('ihSpouseDivided')
    };
  }
  // 엔진 입력(calculateInheritanceTaxJS의 p — 화면 계산 단추가 모으는 것과 같은 이름)에서 같은 모양으로(시험용)
  function ihxFromInput(p, cohabitHeirs) {
    p = p || {};
    return {
      biz: { years: n(p.businessOwnershipYears), individualNet: n(p.businessInheritanceIndividualNetAssetValue), stockValue: n(p.businessInheritanceStockValue), totalAsset: n(p.businessInheritanceTotalAssetValue),
        nonBiz55: n(p.businessInheritanceNonBizAsset55), nonBiz49: n(p.businessInheritanceNonBizAsset49), nonBiz61: n(p.businessInheritanceNonBizAsset61), excessCash: n(p.businessInheritanceExcessCash),
        nonBizStock: n(p.businessInheritanceNonBizStock), mediumSized: !!p.isMediumSizedBusiness, heirNonBizAsset: n(p.businessHeirNonBusinessAssetValue), heirTaxWithoutDeduction: n(p.businessHeirTaxWithoutDeduction),
        reqOwnership: p.decedentOwnershipRequirementMet, reqCeoTenure: p.decedentCeoTenureRequirementMet },
      farm: { individualAsset: n(p.farmingIndividualAssetValue), individualDebt: n(p.farmingIndividualSecuredDebt), stockValue: n(p.farmingStockValue), totalAsset: n(p.farmingTotalAssetValue),
        nonBiz55: n(p.farmingNonBizAsset55), nonBiz49: n(p.farmingNonBizAsset49), nonBiz61: n(p.farmingNonBizAsset61), excessCash: n(p.farmingExcessCash), nonBizStock: n(p.farmingNonBizStock) },
      netFinancial: n(p.netFinancialAssets), disasterLoss: n(p.disasterLossAmount),
      cohabit: { value: n(p.cohabitingHouseValue), req1: p.tenYearCohabitationRequirementMet, req2: p.tenYearOneHouseholdRequirementMet, req3: p.noHouseOrJointHeirRequirementMet, heirs: cohabitHeirs || [] },
      foreign: { base: n(p.foreignEstateTaxBase != null ? p.foreignEstateTaxBase : p.foreignGiftTaxBase), paid: n(p.foreignTaxPaidAmount) },
      spouseDivided: p.isSpousePropertyDivided !== false
    };
  }
  function withIhx(ctx) {
    if (!ctx || ctx.ihx) return ctx;
    if (typeof document === 'undefined') return ctx;
    return Object.assign({}, ctx, { ihx: ihxFromDom() });
  }
  function ihxOf(ctx) { return ctx.ihx || { biz: {}, farm: {}, cohabit: { heirs: [] }, foreign: {} }; }
  // 상속인 명부 첫 행(지금 인쇄가 가업·영농·금융·재해·동거주택 신고서의 상속인으로 찍는 사람 — 따로 고르는 칸이 없음)
  function firstHeir(ctx) { return (ctx.heirs || [])[0] || {}; }
  function heirPhone(ctx, h) { return h && h.isReporter && has(ctx.phone) ? ctx.phone : ''; }
  function ymdSet(o, key, d, 칸, why) {
    var x = H.ymd(d);
    if (x) o.set(key + '.연', x.y).set(key + '.월', x.m).set(key + '.일', x.d);
    else o.miss(칸, why || '화면 입력 없음');
  }
  // 신고일·신고인 서명·세무서(상속세 관할 = 피상속인 주소지 세무서 — 상속9호와 같음)
  function signBlock(o, ctx, signName, opt) {
    opt = opt || {};
    var dk = opt.dateKey || '신고일';
    ymdSet(o, dk, ctx.신고일, opt.dateLabel || dk, 'ctx.신고일 없음(계산기에 없음)');
    o.need(opt.signKey || '신고인서명', signName, opt.signLabel || '신고인(서명)');
    var off = opt.office !== undefined ? opt.office : (ctx.deceased || {}).taxOffice;
    if (has(off)) o.set('세무서', H.officeName(off)); else o.miss('세무서', '피상속인 관할 세무서 입력 없음');
  }
  function pct2(x) { return Math.round(n(x) * 10000) / 100; } // 0.82345 → 82.35

  // ───────── 상속 별지 제1호서식 — 가업상속공제신고서(법 §18의2, 시행령 §15㉒) ─────────
  //  값 출처: 지금 인쇄 ihAttachPrintPagesHtml_ [별지 제1호서식] 쪽(피상속인 성명·주민번호·가업영위기간, 가업상속인 = 명부 첫 행) +
  //   결과 가업상속공제·가업상속공제_계산내역(부표1 ①·⑦) + 화면 중견기업 체크(ihBusinessMediumSized)·요건 체크(ihBizReqOwnership).
  function bizDetailOf(ctx) { return (ctx.r || {}).가업상속공제_계산내역 || null; }
  mappers['상속1호'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, dc = ctx.deceased || {}, x = ihxOf(ctx), b = x.biz || {}, d = bizDetailOf(ctx);
    o.miss('가.상호·사업자등록번호·대표자·주민등록번호·개업연월일·업종·기준총급여액·기준고용인원', '계산기에 없음(가업 인적사항·급여·고용 칸 없음)');
    o.miss('나.중소기업 여부·상장여부·상장일', '계산기에 없음(중소기업·상장 여부 칸 없음)');
    if (b.mediumSized === true) o.set('나@중견기업', '해당');
    else if (b.mediumSized === false) { o.set('나@중견기업', '해당안됨'); o.note('나. 중견기업 여부 "해당안됨" = 화면 "중견기업" 체크가 꺼져 있음 — 중소기업이면 중소기업 여부 칸에 직접 체크하세요'); }
    else o.miss('나.중견기업 여부', '화면 입력 없음(중견기업 체크)');
    o.miss('나.직전3개 사업연도 평균매출액', '계산기에 없음');
    o.need('다@성명', dc.name, '다.성명').need('다@주민등록번호', dc.regNo, '다.주민등록번호');
    if (n(b.years) > 0) o.set('다@가업영위기간', n(b.years) + '년'); else o.miss('다.가업영위기간', '화면 입력 없음(가업영위기간)');
    o.miss('다.대표이사(대표자) 재직기간', '계산기에 없음(요건 체크 ' + (b.reqCeoTenure === true ? '충족' : b.reqCeoTenure === false ? '미충족' : '미확인') + '만 있음 — 시행령 §15③1호나목)');
    if (b.reqOwnership === true) {
      o.set('다@최대주주등여부', '여');
      o.note('다. 최대주주등 여부 "여" = 화면 요건 체크 "피상속인 지분 40%(상장 20%) 이상 10년 보유"(시행령 §15③1호가목 — 최대주주등인 경우로서의 요건) 충족');
    } else o.miss('다.최대주주등 여부', '화면 요건 체크(지분 보유 요건)가 꺼져 있어 알 수 없음');
    o.miss('다.특수관계인 포함 보유 주식 등 지분율', '계산기에 없음(지분율 값 칸 없음 — 요건 체크만)');
    var h = firstHeir(ctx);
    o.need('라@성명', h.name, '라.성명').need('라@주민등록번호', h.regNo, '라.주민등록번호').need('라@주소', H.fullAddr(h), '라.주소');
    var ph = heirPhone(ctx, h);
    if (ph) o.set('라@전화번호', ph); else o.miss('라.전화번호', '상속인 명부에 전화번호 칸 없음(신고인 전화번호는 명부 첫 행이 신고인일 때만 씀)');
    o.note('⚠ 라. 가업상속인 = 상속인 명부 첫 행(지금 인쇄와 같음 — 가업상속인을 따로 고르는 칸이 없음). 실제 가업상속인이 다르면 고치세요');
    o.miss('라.가업 종사 기간·임원/대표이사 취임일', '계산기에 없음(요건 체크만)');
    if (!d) { o.miss('마.가업상속 재산가액·바.가업상속공제 신고액', '가업상속공제 계산 내역 없음'); signBlock(o, ctx, (ctx.reporter || {}).name); return o.result(); }
    // 마. 가업상속 재산가액 — 부표1 작성방법 6: ① 또는 ⑦을 옮김(소득세법 가업·법인세법 가업 줄)
    var kinds = [], vals = [], notes = [];
    if (n(d.소득세법적용분) > 0) { kinds.push('사업용 자산(개인 가업)'); vals.push(n(d.소득세법적용분)); notes.push('부표1 (1)'); }
    if (n(d.법인세법적용분) > 0 || n(b.stockValue) > 0) { kinds.push('주식 등(법인 가업)'); vals.push(n(d.법인세법적용분)); notes.push('부표1 (7)'); }
    if (kinds.length) { o.set('마@종류', kinds).set('마@가액', vals).set('마@비고', notes); }
    else o.miss('마.가업상속 재산가액', '부표1 ①·⑦이 모두 0');
    o.miss('마.수량(면적)·단가', '계산기에 없음(가업상속재산을 합계로만 받음 — 부표2 가업용 자산 명세 참고)');
    var ded = n(r.가업상속공제);
    o.set('바', ded);
    if (d.요건미충족으로_공제배제 || d.중견기업게이트_적용여부) o.note('⚠ 바. 가업상속공제 신고액 0 — ' + (d.요건미충족으로_공제배제 ? '요건 미충족(' + (d.미충족요건목록 || []).join(', ') + ')' : '중견기업 적용 요건(가업상속인의 가업상속재산 외 재산이 납부세액 × 200% 초과, 법 §18의2②)'));
    else o.check('바 = 부표1 ⑪ = MIN(⑨ 대상금액, ⑩ 한도액)', ded, Math.min(n(d.대상금액), n(d.한도액)));
    o.check('마 가액 합 = 부표1 ⑨(엔진 대상금액 = ① + ⑦)', vals.reduce(function (s, v) { return s + v; }, 0), n(d.대상금액));
    if (d.요건미확인) o.note('⚠ 가업상속공제 요건 체크 중 확인하지 않은 것이 있음(엔진 요건미확인)');
    signBlock(o, ctx, (ctx.reporter || {}).name);
    o.note('신고인 = 상속세 신고인(상속9호와 같음)');
    return o.result();
  };

  // ───────── 상속 별지 제1호서식 부표1 — 가업상속재산명세서(시행령 §15⑤~⑦) ─────────
  //  값 출처: 지금 인쇄 ihBizAssetDetailTableHtml_·"다. 한도액계산"·"라. 중견기업 적용요건"(화면 ihBusiness* 칸 + 결과 가업상속공제_계산내역).
  //  예전 인쇄 번호와 다름: 예전 "⑧ 한도액·⑨ 대상금액·⑩ 공제액" → 서식 ⑩ 한도액·⑨ 대상금액·⑪ 공제액(⑧은 가업영위기간 줄).
  mappers['상속1호부표1'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, x = ihxOf(ctx), b = x.biz || {}, d = bizDetailOf(ctx);
    if (!d) { o.miss('부표1 전체', '가업상속공제 계산 내역 없음'); return o.result(); }
    // 가. 소득세법 적용 가업 — 계산기는 사업용 자산 순액 합계(①) 하나만 받음
    o.miss('가.㉮ 금액·㉯ 담보채무액·대상금액(토지·건축물·기계장치·기타 줄)', '계산기에 없음(자산 종류별 금액·담보채무를 따로 받지 않고 순액 합계 ①만 받음)');
    o.miss('①@㉮·①@㉯ ① 계의 ㉮ 금액 계·㉯ 담보채무액 계', '계산기에 없음(순액 ①만 받음)');
    var v1 = n(d.소득세법적용분);
    if (v1 > 0) o.set('①', v1); else o.miss('① 계', '해당 없음 — 소득세법 적용 가업 금액 0(화면 사업용 자산 순액 비어 있음)');
    // 나. 법인세법 적용 가업
    var stock = n(b.stockValue);
    if (stock > 0) {
      var tot = n(b.totalAsset), nb = [n(b.nonBiz55), n(b.nonBiz49), n(b.nonBiz61), n(b.excessCash), n(b.nonBizStock)];
      var v4 = nb.reduce(function (s, v) { return s + v; }, 0), v5 = Math.max(0, tot - v4), v6 = n(d.사업관련자산가액비율), v7 = n(d.법인세법적용분);
      o.set('②', stock).set('③', tot).set('㉮', nb[0]).set('㉯', nb[1]).set('㉰', nb[2]).set('㉱', nb[3]).set('㉲', nb[4]).set('④', v4).set('⑤', v5).set('⑥', pct2(v6)).set('⑦', v7);
      o.check('④ = ㉮ + ㉯ + ㉰ + ㉱ + ㉲', v4, nb[0] + nb[1] + nb[2] + nb[3] + nb[4]);
      o.check('⑤ = ③ − ④', v5, tot - v4);
      o.check('⑥ = ⑤ ÷ ③(엔진 비율, 만분율)', Math.round(v6 * 10000), tot > 0 ? Math.round(v5 / tot * 10000) : 0);
      o.check('⑦ = ② × ⑥(엔진 반올림)', v7, Math.round(stock * v6));
      if (n(b.nonBiz49) > 0 || n(b.nonBiz61) > 0) o.note('㉯·㉰ 사업무관자산 — 시행령 §15⑤2호나목·다목 단서(2025.2.28. 개정: 임직원 무상임대 주택·학자금·전세금 대여 제외)는 입력자가 빼서 넣어야 함');
    } else o.miss('②~⑦ 나. 법인세법 적용 가업(②③㉮㉯㉰㉱㉲④⑤⑥⑦)', '해당 없음 — 상속개시일 현재 주식 등의 가액 0(법인 가업 아님)');
    // 다. 한도액 계산 — 가업영위기간 줄에 ⑨·⑪
    var yrs = n(b.years), row = yrs >= 30 ? 2 : yrs >= 20 ? 1 : yrs >= 10 ? 0 : -1;
    var target = n(d.대상금액), lim = n(d.한도액), ded = n(r.가업상속공제);
    if (row >= 0) {
      var a9 = ['', '', ''], a11 = ['', '', ''];
      a9[row] = target; a11[row] = ded;
      o.set('⑨', a9).set('⑪', a11);
      o.check('⑩ 한도액(가업영위기간 ' + yrs + '년 줄) = 엔진 한도액', lim, [30000000000, 40000000000, 60000000000][row]);
      if (d.요건미충족으로_공제배제 || d.중견기업게이트_적용여부) o.note('⚠ ⑪ 가업상속공제액 0 — ' + (d.요건미충족으로_공제배제 ? '요건 미충족(' + (d.미충족요건목록 || []).join(', ') + ')' : '라. ㉮ − ㉯가 양수(중견기업 적용 배제, 법 §18의2②)'));
      else o.check('⑪ = MIN(⑨, ⑩)', ded, Math.min(target, lim));
    } else o.miss('⑨ ⑪ 다. 한도액 계산', '가업영위기간 ' + yrs + '년 — 10년 미만이라 들어갈 줄이 없음(엔진 한도 ' + lim + '원)');
    o.check('⑨ = ① + ⑦(엔진 대상금액)', target, v1 + n(d.법인세법적용분));
    if (v1 > 0 && n(d.법인세법적용분) > 0) o.note('⚠ ⑨ — 서식은 "① 또는 ⑦"인데 개인 가업과 법인 가업이 둘 다 있어 엔진은 ① + ⑦을 더해 한도 하나로 계산함(둘 이상 독립 가업의 한도·공제순서는 시행령 §15④ → 시행규칙 — 확인 필요)');
    // 라. 중견기업 적용 요건 — 중견기업일 때만(법 §18의2②)
    if (b.mediumSized === true) {
      var la = n(b.heirNonBizAsset), lb = n(b.heirTaxWithoutDeduction) * 2;
      o.set('라㉮', la).set('라㉯', lb).set('라㉮-㉯', la - lb);
      o.check('라. ㉮ − ㉯ 양수 ↔ 엔진 중견기업 적용 배제(1 = 배제)', la - lb > 0 ? 1 : 0, d.중견기업게이트_적용여부 ? 1 : 0);
    } else o.miss('라.㉮·㉯·㉮-㉯ 중견기업 적용 요건', '해당 없음 — 중견기업 아님(화면 중견기업 체크 꺼짐). 예전 인쇄는 이때도 0으로 찍었음');
    return o.result();
  };

  // ───────── 상속 별지 제2호서식 — 영농상속공제신고서(법 §18의3, 시행령 §16) ─────────
  //  값 출처: 지금 인쇄 ihAttachPrintPagesHtml_ [별지 제2호서식] 쪽(피상속인·상속인 = 명부 첫 행, 화면 ihFarming* 칸, 결과 영농상속공제_계산내역).
  //  예전 인쇄 번호와 다름: 예전 "③ 총자산가액·④ 사업무관 계·⑤ 사업관련·⑥ 비율"(가업상속 서식 번호를 옮겨 와 하나씩 밀림) → 서식 ④·⑤·⑥·⑦, 서식 ③(= ②) 줄 추가.
  mappers['상속2호'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, dc = ctx.deceased || {}, x = ihxOf(ctx), f = x.farm || {}, d = (ctx.r || {}).영농상속공제_계산내역;
    o.need('1@피상속인성명', dc.name, '1.피상속인 성명').need('1@피상속인주민등록번호', dc.regNo, '1.피상속인 주민등록번호');
    var h = firstHeir(ctx);
    o.need('1@상속인성명', h.name, '1.상속인 성명').need('1@상속인주민등록번호', h.regNo, '1.상속인 주민등록번호');
    o.note('⚠ 1. 상속인 = 상속인 명부 첫 행(지금 인쇄와 같음 — 영농상속인을 따로 고르는 칸이 없음). 실제 영농상속인이 다르면 고치세요');
    o.miss('2.가-1 명세(종류·소재지·수량·단가·가액 줄)', '계산기에 없음(영농 재산을 합계로만 받음)');
    o.miss('2.가-2 명세(상호·사업자등록번호·주식수·1주당 가액·가액 줄)', '계산기에 없음(법인별 명세 없음)');
    if (!d) { o.miss('①② 3.영농상속공제액 전체', '영농상속공제 계산 내역 없음'); signBlock(o, ctx, (ctx.reporter || {}).name); return o.result(); }
    var v1 = n(d.소득세법적용분), debt = n(d.소득세법적용분_담보채무차감);
    if (v1 > 0 || n(f.individualAsset) > 0) {
      o.set('①', v1).set('3가1', v1);
      if (debt > 0) o.note('① = 영농 재산 ' + n(f.individualAsset) + '원 − 담보채무 ' + debt + '원 = ' + v1 + '원(시행령 §16⑤1호, 2026.2.27. 이후 상속개시분 — 서식(2025.3.21.)에는 담보채무 칸이 없어 순액을 적음)');
    } else o.miss('① 3.가-1', '해당 없음 — 「소득세법」 적용 영농 재산 0');
    var stock = n(f.stockValue);
    if (stock > 0) {
      var tot = n(f.totalAsset), nb = [n(f.nonBiz55), n(f.nonBiz49), n(f.nonBiz61), n(f.excessCash), n(f.nonBizStock)];
      var v5 = nb.reduce(function (s, v) { return s + v; }, 0), v6 = Math.max(0, tot - v5), v7 = n(d.사업관련자산가액비율), corp = n(d.법인세법적용분);
      o.set('②', stock).set('③', stock).set('④', tot).set('㉮', nb[0]).set('㉯', nb[1]).set('㉰', nb[2]).set('㉱', nb[3]).set('㉲', nb[4])
        .set('⑤', v5).set('⑥', v6).set('⑦', pct2(v7)).set('3가2', corp);
      o.check('⑤ = ㉮ + ㉯ + ㉰ + ㉱ + ㉲', v5, nb[0] + nb[1] + nb[2] + nb[3] + nb[4]);
      o.check('⑥ = ④ − ⑤', v6, tot - v5);
      o.check('⑦ = ⑥ ÷ ④(엔진 비율, 만분율)', Math.round(v7 * 10000), tot > 0 ? Math.round(v6 / tot * 10000) : 0);
      o.check('가-2 = ③ × ⑦(엔진 반올림)', corp, Math.round(stock * v7));
      if (nb[3] > 0) o.note('⚠ ㉱ 과다보유현금 — 서식 작성방법 6은 직전 5개 사업연도 말 평균의 150% 초과분이나 현행 시행령 §15⑤2호라목은 200% 초과분(2025.2.28. 개정). 계산기는 결과값만 받으므로 200% 기준으로 넣었는지 확인');
    } else o.miss('②③④⑤⑥⑦ ㉮㉯㉰㉱㉲ 3.가-2', '해당 없음 — 「법인세법」 적용 영농 주식 등 가액 0');
    var target = n(d.대상금액), lim = n(d.한도액), ded = n(r.영농상속공제);
    o.set('⑧', target).set('⑩', ded);
    o.check('⑧ = ① + (③ × ⑦)', target, v1 + n(d.법인세법적용분));
    if (lim !== 3000000000) o.note('⚠ ⑨ 한도액 — 서식에 30억원이 인쇄돼 있으나 엔진 한도는 ' + lim + '원(상속개시일 기준 옛 한도)');
    if (d.요건미충족으로_공제배제) o.note('⚠ ⑩ 영농상속공제액 0 — 요건 미충족(' + (d.미충족요건목록 || []).join(', ') + ')');
    else o.check('⑩ = MIN(⑧, ⑨ ' + lim + ')', ded, Math.min(target, lim));
    if (d.요건미확인) o.note('⚠ 영농상속공제 요건 체크 중 확인하지 않은 것이 있음(엔진 요건미확인)');
    signBlock(o, ctx, (ctx.reporter || {}).name);
    return o.result();
  };

  // ───────── 상속 별지 제5호서식 — 금융재산 상속공제 신고서(법 §22, 시행령 §19) ─────────
  //  값 출처: 지금 인쇄 ihAttachPrintPagesHtml_ [별지 제5호서식] 쪽(피상속인·상속인 = 명부 첫 행, 화면 ihNetFinancial, 결과 금융재산상속공제).
  //  ④ 한도액 = 뒷면 작성방법 표(법 §22①): ③ 2천만원 이하 ③ / 1억원 이하 2천만원 / 10억원 이하 ③ × 20% / 10억원 초과 2억원.
  //   예전 인쇄는 ③ × 20%를 반올림했는데, 엔진(⑤)과 같게 원 미만 버림.
  function finLimit(net) { return net <= 20000000 ? net : net <= 100000000 ? 20000000 : net <= 1000000000 ? Math.floor(net * 0.2) : 200000000; }
  mappers['상속5호'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, dc = ctx.deceased || {}, x = ihxOf(ctx), h = firstHeir(ctx);
    o.need('1@피상속인성명', dc.name, '1.피상속인 성명').need('1@피상속인주민등록번호', dc.regNo, '1.피상속인 주민등록번호');
    o.need('1@상속인성명', h.name, '1.상속인 성명').need('1@상속인주민등록번호', h.regNo, '1.상속인 주민등록번호');
    o.note('1. 상속인 = 상속인 명부 첫 행(지금 인쇄와 같음 — 신고하는 상속인이 다르면 고치세요)');
    o.miss('가-1.금융재산 명세(종류·계좌번호 등·상호·사업자등록번호·단가·가액 줄)', '계산기에 없음(순금융재산가액 ③ 하나만 받음)');
    o.miss('가-2.금융채무 명세(종류·계좌번호 등·상호·사업자등록번호·단가·가액 줄)', '계산기에 없음');
    o.miss('①② 금융재산 합계·금융채무 합계', '계산기에 없음(①·②를 따로 받지 않고 ③ = ① − ②를 직접 받음)');
    var net = n(x.netFinancial);
    if (net > 0) {
      var lim = finLimit(net), ded = n(r.금융재산상속공제);
      o.set('③', net).set('④', lim).set('⑤', ded);
      if (dc.resident === 'nonresident' || r.피상속인_거주구분 === '비거주자') o.note('⚠ ⑤ 0 — 피상속인이 비거주자라 금융재산 상속공제 없음(법 §22① "거주자의 사망")');
      else o.check('⑤ = MIN(③, ④) = 엔진 금융재산상속공제', ded, Math.min(net, lim));
    } else o.miss('③④⑤', '화면 순금융재산가액 입력 없음');
    o.note('법 §22② — 최대주주등 보유 주식과 신고기한까지 신고하지 않은 타인 명의 금융재산은 ③에서 빼고 넣어야 함');
    signBlock(o, ctx, (ctx.reporter || {}).name);
    return o.result();
  };

  // ───────── 상속 별지 제6호의2서식 — 동거주택상속공제신고서(법 §23의2, 시행령 §20의2) ─────────
  //  값 출처: 지금 인쇄 ihAttachPrintPagesHtml_ [별지 제6호의2서식] 쪽(피상속인·상속개시일·신청인, 화면 ihCohabitValue·ihCohabitReq1~3, 결과 동거주택상속공제)
  //   + 상속인 명부의 "동거주택 상속" 체크(isCohabitHouse)·그 사람 몫 가액(cohabitHouseValue − cohabitHouseDebt — 화면 ihCohabitValue는 이 합).
  //  예전 인쇄와 다른 점: ① 신청인 = 명부에서 "동거주택 상속" 체크한 첫 사람(없으면 첫 행 — 예전은 늘 첫 행)
  //   ② 화면 동거주택가액은 "요건 갖춘 상속인 몫의 합"이라 서식 ⑩(② × ⑨)에만 찍고 ② 주택 전체 가액은 비움(예전은 ②·⑩에 같은 값)
  //   ③ 1세대 1주택 여부는 요건 체크 ihCohabitReq2 하나로(예전은 체크 셋이 모두 켜졌는지로)
  mappers['상속6호의2'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, dc = ctx.deceased || {}, x = ihxOf(ctx), co = x.cohabit || {}, heirs = ctx.heirs || [];
    var coH = (co.heirs || []).filter(function (c) { return heirs[c.heirIdx]; });
    o.need('1@피상속인성명', dc.name, '1.피상속인 성명').need('1@피상속인주민등록번호', dc.regNo, '1.피상속인 주민등록번호').need('1@상속개시일', dc.deathDate, '1.상속개시일');
    var ap = coH.length ? heirs[coH[0].heirIdx] : firstHeir(ctx);
    o.need('1@신청인성명', ap.name, '1.신청인(상속인) 성명').need('1@신청인주민등록번호', ap.regNo, '1.신청인(상속인) 주민등록번호').need('1@신청인주소', H.fullAddr(ap), '1.신청인(상속인) 주소');
    if (!coH.length) o.note('⚠ 1. 신청인 = 상속인 명부 첫 행 — 명부에 "동거주택 상속" 체크한 사람이 없음');
    o.miss('2.소재지·취득일 동거주택', '계산기에 없음');
    o.miss('① 동거기간', '계산기에 없음(요건 체크 "10년 이상 동거" ' + (co.req1 === true ? '충족' : co.req1 === false ? '미충족' : '미확인') + '만 있음)');
    o.miss('② 평가가액(주택가액 − 담보채무액)', '계산기에 없음 — 화면 동거주택가액은 요건 갖춘 상속인 몫의 합(⑩)이라 주택 전체 가액이 아님');
    if (co.req2 === true) o.set('③', '해당'); else if (co.req2 === false) o.set('③', '해당안됨'); else o.miss('③ 10년 이상 계속 1세대 1주택 여부', '화면 요건 체크 없음');
    o.miss('④ 예외유형', '계산기에 없음(시행령 §20의2① 각 호 — 일시적 2주택 등 선택 칸 없음)');
    // 상속인 표 — 명부에서 "동거주택 상속" 체크한 사람
    if (coH.length) {
      o.set('상속인@성명', coH.map(function (c) { return heirs[c.heirIdx].name || ''; })).set('상속인@주민등록번호', coH.map(function (c) { return heirs[c.heirIdx].regNo || ''; }));
      if (co.req1 === true) o.set('⑥', coH.map(function () { return '해당'; })); else o.miss('⑥ 10년 이상 동거(상속인별)', '화면 요건 체크 "10년 이상 동거"가 꺼져 있음');
      if (co.req3 === true) o.set('⑦', coH.map(function () { return '해당'; })); else o.miss('⑦ 무주택자(상속인별)', '화면 요건 체크 "무주택자 등"이 꺼져 있음');
      o.note('⑥·⑦ "해당" = 화면 요건 체크(전체 하나)가 켜져 있고 명부에서 "동거주택 상속"을 체크한 상속인 — 상속인별 판정 칸은 계산기에 없음');
      o.note('상속인별 몫 가액(명부): ' + coH.map(function (c) { return (heirs[c.heirIdx].name || '') + ' ' + (n(c.value) - n(c.debt)) + '원'; }).join(', '));
    } else o.miss('상속인 표 성명·주민등록번호·⑥⑦', '상속인 명부에 "동거주택 상속" 체크한 사람 없음');
    o.miss('⑤⑧⑨ 동거주택지분·요건충족 지분·계', '계산기에 없음(지분 칸 없음 — 상속인별 몫 가액만 받음)');
    var v = n(co.value), ded = n(r.동거주택상속공제);
    if (v > 0) {
      o.set('⑩', v).set('⑫', ded);
      var sum = coH.reduce(function (s, c) { return s + Math.max(0, n(c.value) - n(c.debt)); }, 0);
      if (coH.length) o.check('⑩ = 명부 "동거주택 상속" 상속인 몫(가액 − 담보채무) 합 = 화면 동거주택가액', v, sum);
      var failed = (r.동거주택상속공제_미충족요건목록 || []).length > 0;
      if (failed || ded === 0) o.note('⚠ ⑫ 0 — ' + (failed ? '요건 미충족(' + r.동거주택상속공제_미충족요건목록.join(', ') + ', 법 §23의2①)' : dc.resident === 'nonresident' ? '피상속인 비거주자(법 §23의2① "거주자의 사망")' : '엔진 공제 0'));
      else if (String(dc.deathDate || '') >= '2020-01-01') o.check('⑫ = MIN(⑩, ⑪ 6억원)', ded, Math.min(v, 600000000));
      else o.note('⚠ 상속개시일 ' + dc.deathDate + ' — 2020년 전 상속은 공제율·한도가 다름(엔진 ' + ded + '원, 서식 ⑪은 6억원 인쇄)');
    } else o.miss('⑩⑫', '화면 동거주택가액 입력 없음');
    signBlock(o, ctx, (ctx.reporter || {}).name);
    return o.result();
  };

  // ───────── 상속 별지 제3호서식 — 배우자 상속재산 미분할 신고서(법 §19③, 시행령 §17②③) ─────────
  //  값 출처: 지금 인쇄 ihAttachPrintPagesHtml_ [별지 제3호서식] 쪽(피상속인, 신고인 = 명부의 "배우자", 재산평가 목록).
  //  예전 인쇄와 다른 점: 2. 상속재산 — 서식은 "배우자 상속재산분할기한까지 분할하지 못한 배우자의 상속재산"(작성방법 1)만 적는데
  //   예전 인쇄는 재산평가 목록 전부를 찍었음. 여기서는 받는 상속인 배분(heirAllocations)이 없는 재산 = 아직 나누지 못한 재산만 찍는다.
  var METHOD_SHORT = { direct: '직접입력 재산', land: '토지', house: '단독주택', apartment: '공동주택', officetel: '오피스텔·상업용건물', building: '일반건물',
    listedStock: '상장주식', unlistedStock: '비상장주식', goodwill: '영업권', trustBenefit: '신탁수익권', periodicPayment: '정기금 수급권', conditionalRight: '조건부권리 등',
    otherTangible: '선박·차량 등', groundRight: '지상권', patentRight: '특허권 등', miningRight: '광업권 등', memberRight: '조합원입주권', artwork: '서화·골동품' };
  function methodLabel(m) {
    if (METHOD_SHORT[m]) return METHOD_SHORT[m];
    var g = (typeof VALUATION_METHOD_LABELS !== 'undefined' && VALUATION_METHOD_LABELS) ? VALUATION_METHOD_LABELS[m] : ''; // eslint-disable-line no-undef
    return g ? String(g).split('(')[0] : (m || '');
  }
  function spouseHeir(ctx) { var hs = ctx.heirs || []; for (var i = 0; i < hs.length; i++) if (hs[i].relation === '배우자') return hs[i]; return null; }
  mappers['상속3호'] = function (ctx) {
    var o = new Out(), dc = ctx.deceased || {}, sp = spouseHeir(ctx);
    o.need('1@피상속인성명', dc.name, '1.피상속인 성명').need('1@피상속인주민등록번호', dc.regNo, '1.피상속인 주민등록번호');
    if (sp) {
      o.need('1@신고인성명', sp.name, '1.신고인(상속인) 성명').need('1@신고인주민등록번호', sp.regNo, '1.신고인(상속인) 주민등록번호').need('1@신고인주소', H.fullAddr(sp), '1.신고인(상속인) 주소');
      var ph = heirPhone(ctx, sp);
      if (ph) o.set('1@신고인전화번호', ph); else o.miss('1.신고인(상속인) 전화번호', '상속인 명부에 전화번호 칸 없음(배우자가 상속세 신고인일 때만 신고인 전화번호를 씀)');
      o.note('1. 신고인 = 상속인 명부의 "배우자"(지금 인쇄와 같음)');
    } else o.miss('1.신고인(상속인) 성명·주민등록번호·주소·전화번호', '상속인 명부에 배우자 없음');
    var all = ctx.valAssets || ctx.assets || [];
    var und = all.filter(function (a) { return !(a.alloc && a.alloc.length); });
    if (!all.length) o.miss('2.상속재산(재산종류·소재지·수량·평가액)', '재산평가 목록 없음 — 분할하지 못한 재산을 직접 적으세요');
    else if (!und.length) o.miss('2.상속재산(재산종류·소재지·수량·평가액)', '재산평가 목록의 모든 재산에 받는 상속인 배분이 있음 — 분할하지 못한 재산을 알 수 없어 비움(직접 적으세요)');
    else {
      o.set('2@재산종류', und.map(function (a) { return methodLabel(a.method); })).set('2@소재지', und.map(function (a) { return a.location || ''; }))
        .set('2@수량', und.map(function (a) { return n(a.area) || ''; })).set('2@평가액', und.map(function (a) { return Math.round(n(a.value)); }));
      if (und.some(function (a) { return !n(a.area); })) o.miss('2.상속재산 수량(면적) 일부 줄', '재산평가 목록에 수량(면적)이 없는 재산');
      o.note('⚠ 2. 상속재산 = 재산평가 목록 중 받는 상속인 배분이 없는 재산 ' + und.length + '건(전체 ' + all.length + '건) — 배우자 상속재산분할기한까지 분할하지 못한 재산만 적는 칸(작성방법 1)이니 확인하세요');
      if (und.length > 10) o.note('분할하지 못한 재산이 ' + und.length + '건 — 표가 10줄이라 다음 장에 이어 찍음');
    }
    o.miss('3.미분할 사유(상속회복청구의 소·상속재산 분할 심판·상속인 미확정) 체크·세부내용', '계산기에 없음(사유 선택 칸 없음 — 시행령 §17② 사유에 직접 √하고 입증서류 첨부)');
    o.note('법 §19③: 배우자상속재산분할기한(신고기한 다음날부터 9개월, §19②)까지 이 신고를 하고, 기한(소·심판이면 그 종료일) 다음날부터 6개월 안에 분할·신고하면 기한 안에 분할한 것으로 봄 — 계산기는 "분할·신고" 체크가 꺼져 있으면 배우자공제를 5억원(§19④)만 인정함');
    signBlock(o, ctx, sp ? sp.name : '', { signLabel: '신고인(서명) — 배우자' });
    return o.result();
  };

  // ───────── 언제 찍나 ─────────
  var WHEN = {
    '상속1호': function (c) { var r = c.r || {}; return !!(r.가업상속공제_계산내역 && !r.가업상속납부유예_선택); },
    '상속1호부표1': function (c) { var r = c.r || {}; return !!(r.가업상속공제_계산내역 && !r.가업상속납부유예_선택); },
    '상속2호': function (c) { return !!(c.r || {}).영농상속공제_계산내역; },
    '상속3호': function (c) { return !!(c.r && c.spouse && c.spouse.divided === false); },
    '상속5호': function (c) { return !!(c.r && n(ihxOf(c).netFinancial) > 0); },
    '상속6호': function (c) { return !!(c.r && n(ihxOf(c).disasterLoss) > 0); },
    '상속6호의2': function (c) { var r = c.r || {}; return !!(c.r && (n(r.동거주택상속공제) > 0 || n((ihxOf(c).cohabit || {}).value) > 0)); },
    '상속7호': function (c) { return !!(c.r && n(c.r.외국납부세액공제) > 0); }
  };
  var ORDER = ['상속1호', '상속1호부표1', '상속2호', '상속3호', '상속5호', '상속6호', '상속6호의2', '상속7호'];

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    if (tax === '상속') {
      var c = withIhx(ctx || {});
      ORDER.forEach(function (k) { if (typeof mappers[k] === 'function' && WHEN[k](c)) L.push({ formKey: k, ctx: Object.assign({}, c, { 세목: '상속' }) }); });
    }
    return L;
  }
  // 세액인쇄 화면의 서식 한 줄 — 상속 계산 결과 하나
  function ihCtx(extra) { return withIhx(H.ctxFromApp.상속(extra)); }
  ORDER.forEach(function (k) {
    if (k === '상속7호') return;
    ctxFor[k] = function (extra) { var c = ihCtx(extra); return WHEN[k](c) ? Object.assign(c, { 세목: '상속' }) : null; };
    ready[k] = function () { try { return typeof lastInheritanceResult !== 'undefined' && !!lastInheritanceResult && !!ctxFor[k](); } catch (e) { return false; } }; // eslint-disable-line no-undef
  });

  return { 묶음: '상속부속A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready,
    ihxFromInput: ihxFromInput, ihxFromDom: ihxFromDom };
});
