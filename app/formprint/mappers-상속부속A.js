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
