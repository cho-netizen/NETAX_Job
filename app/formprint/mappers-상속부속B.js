/*
 * NxFormPrint 묶음 파일 — 상속부속B (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 상속12호의2 · 상속12호의2부표1 · 상속13호 · 상속13호의2 · 상속14호의2 · 상속14호의3 · 공통11호 · 공통11호부표 · 공통16호 · 국기8호
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-상속부속B.js → node tools/formprint-check-ext.js 상속부속B
 *
 * ── ctx ── 상속 서식은 mappers.js ctxFromApp.상속()이 만든 것(r·deceased·reporter·phone·heirs·taxAgent…)에
 *   ctx.ihb(이 묶음이 더 읽는 화면 값 — 지금 인쇄 ihAttachPrintPagesHtml_가 ihDomNum_로 읽는 칸과 같음)를 더한다.
 *   ihb는 화면이 있으면 ihbFromDom()으로 채우고(plan·ctxFor), 시험에서는 엔진 입력에서 ihbFromInput(p)로 만든다(같은 모양).
 *     ihb = { biz:{years, individualNet, stockValue, totalAsset, nonBiz55, nonBiz49, nonBiz61, excessCash, nonBizStock, reqOwnership}, totalGross }
 *
 * ── 언제 찍나(지금 인쇄 taxcalc.html의 조건) ──
 *   상속12호의2·부표1 : 결과 가업상속납부유예세액 > 0 이고 가업상속공제_계산내역이 있음(ihAttachPrintPagesHtml_ [별지 제12호의2서식] 쪽)
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
    '상속12호의2': "상속세 및 증여세법 시행규칙 [별지 제12호의2서식]", // 가업상속 납부유예 신청서
    '상속12호의2부표1': "상속세 및 증여세법 시행규칙 [별지 제12호의2서식 부표1]", // 가업상속재산명세서(납부유예)
    '상속13호': "상속세 및 증여세법 시행규칙 [별지 제13호서식]", // 상속세 물납(변경, 철회)신청서
    '상속13호의2': "상속세 및 증여세법 시행규칙 [별지 제13호의2서식]", // 물납 재산 재평가 신청서
    '상속14호의2': "상속세 및 증여세법 시행규칙 [별지 제14호의2서식]", // 문화재 등 상속세 물납 (철회)신청서
    '상속14호의3': "상속세 및 증여세법 시행규칙 [별지 제14호의3서식]", // 징수유예 국가지정문화재등 ([ ]보유현황명세서, [ ]양도거래신고서)
    '공통11호': "상속세 및 증여세법 시행규칙 [별지 제11호서식]", // 상속세(증여세) 연부연납허가(변경, 철회) 신청서
    '공통11호부표': "상속세 및 증여세법 시행규칙 [별지 제11호서식 부표]", // 연부연납세액 계산명세
    '공통16호': "상속세 및 증여세법 시행규칙 [별지 제16호서식]", // 상속세(증여세) 과세표준 및 세액의 결정(경정)청구서
    '국기8호': "국세기본법 시행규칙 [별지 제8호서식]", // 상속인대표자신고서
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // ───────── 공용 ─────────
  function dom(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }
  function dnum(id) { var e = dom(id); return e ? n(e.value) : 0; }
  function dchk(id) { var e = dom(id); return e ? !!e.checked : null; }
  // 상속: 지금 인쇄가 읽는 화면 칸(ihDomNum_)과 같은 칸
  function ihbFromDom() {
    return {
      biz: { years: dnum('ihBusinessYears'), individualNet: dnum('ihBusinessIndividualNet'), stockValue: dnum('ihBusinessStockValue'), totalAsset: dnum('ihBusinessTotalAsset'),
        nonBiz55: dnum('ihBusinessNonBiz55'), nonBiz49: dnum('ihBusinessNonBiz49'), nonBiz61: dnum('ihBusinessNonBiz61'), excessCash: dnum('ihBusinessExcessCash'), nonBizStock: dnum('ihBusinessNonBizStock'),
        reqOwnership: dchk('ihBizReqOwnership') },
      totalGross: dnum('ihTotalGrossEstate')
    };
  }
  // 엔진 입력(calculateInheritanceTaxJS의 p — 화면 계산 단추가 모으는 것과 같은 이름)에서 같은 모양으로(시험용)
  function ihbFromInput(p) {
    p = p || {};
    return {
      biz: { years: n(p.businessOwnershipYears), individualNet: n(p.businessInheritanceIndividualNetAssetValue), stockValue: n(p.businessInheritanceStockValue), totalAsset: n(p.businessInheritanceTotalAssetValue),
        nonBiz55: n(p.businessInheritanceNonBizAsset55), nonBiz49: n(p.businessInheritanceNonBizAsset49), nonBiz61: n(p.businessInheritanceNonBizAsset61), excessCash: n(p.businessInheritanceExcessCash),
        nonBizStock: n(p.businessInheritanceNonBizStock), reqOwnership: p.decedentOwnershipRequirementMet },
      totalGross: n(p.totalGrossEstateValue)
    };
  }
  function withIhb(ctx) {
    if (!ctx || ctx.ihb) return ctx;
    if (typeof document === 'undefined') return ctx;
    return Object.assign({}, ctx, { ihb: ihbFromDom() });
  }
  function ihbOf(ctx) { return ctx.ihb || { biz: {} }; }
  // 상속인 명부 첫 행(지금 인쇄가 가업상속인으로 찍는 사람 — 따로 고르는 칸이 없음)
  function firstHeir(ctx) { return (ctx.heirs || [])[0] || {}; }
  function heirPhone(ctx, h) { return h && h.isReporter && has(ctx.phone) ? ctx.phone : ''; }
  function ymdSet(o, key, d, 칸, why) {
    var x = H.ymd(d);
    if (x) o.set(key + '.연', x.y).set(key + '.월', x.m).set(key + '.일', x.d);
    else o.miss(칸, why || '화면 입력 없음');
  }
  function pct2(x) { return Math.round(n(x) * 10000) / 100; } // 0.82345 → 82.35
  function bizDetailOf(ctx) { return (ctx.r || {}).가업상속공제_계산내역 || null; }
  // 별지 제9호서식 ㊲ 공제·면제 후 납부할 세액(= ㉕ + ㉖ − ㉗ − ㉘ + ㊱) — mappers.js 상속9호와 같은 식
  function ih9Line37(r) {
    var g28 = r.증여세액공제_5억이하배제 ? 0 : n(r.기납부증여세액공제);
    var credit = g28 + n(r.특례증여세액공제) + n(r.외국납부세액공제) + n(r.단기재상속세액공제) + n(r.신고세액공제) + n(r.그밖의공제);
    return Math.max(0, n(r.산출세액) + n(r.이자상당액) - n(r.문화재등징수유예세액) - credit + n(r.영리법인면제분납부세액));
  }
  // 엔진이 납부유예 가능세액을 셀 때 쓴 상속세 납부세액(taxAfterReportCredit) — 지금 인쇄 ihAttachPrintPagesHtml_와 같은 되살림
  function engineTaxAfterReportCredit(r) {
    return Math.max(0, n(r.산출세액) - n(r.기납부증여세액공제) - n(r.특례증여세액공제) - n(r.외국납부세액공제) - n(r.단기재상속세액공제) - n(r.그밖의공제) - n(r.문화재등징수유예세액) - n(r.신고세액공제));
  }

  // ───────── 상속 별지 제12호의2서식 — 가업상속 납부유예 신청서(법 §72의2①, 시행령 §69의2①) ─────────
  //  값 출처: 지금 인쇄 ihAttachPrintPagesHtml_ [별지 제12호의2서식] 쪽(가업상속인 = 명부 첫 행 성명·주민번호·주소, 피상속인 성명·주민번호·가업영위기간,
  //   바. 신청세액 = 결과 가업상속납부유예세액) + 부표1 ①·⑦(마. 가액 — 부표1 작성방법 6).
  mappers['상속12호의2'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, dc = ctx.deceased || {}, b = ihbOf(ctx).biz || {}, d = bizDetailOf(ctx), ta = ctx.taxAgent || {};
    // 가. 가업상속인(신청인)
    var h = firstHeir(ctx);
    o.need('가@성명', h.name, '가.성명').need('가@주민등록번호', h.regNo, '가.주민등록번호').need('가@주소', H.fullAddr(h), '가.주소');
    var ph = heirPhone(ctx, h);
    if (ph) o.set('가@연락처', ph); else o.miss('가.연락처', '상속인 명부에 전화번호 칸 없음(신고인 전화번호는 명부 첫 행이 신고인일 때만 씀)');
    o.note('⚠ 가. 가업상속인 = 상속인 명부 첫 행(지금 인쇄와 같음 — 가업상속인을 따로 고르는 칸이 없음). 실제 가업상속인이 다르면 고치세요');
    o.miss('가.가업 종사 기간·임원/대표이사 취임일', '계산기에 없음(가업상속인 요건 체크만 있음)');
    if (has(ta.name)) {
      o.set('가@세무대리인성명', ta.name);
      if (has(ta.bizNo)) o.set('가@세무대리인사업자등록번호', ta.bizNo); else o.miss('가.세무대리인 사업자등록번호', '세무대리인 사업자등록번호 입력 없음');
      if (has(ta.phone)) o.set('가@세무대리인연락처', ta.phone); else o.miss('가.세무대리인 연락처', '세무대리인 전화번호 입력 없음');
      o.miss('가.세무대리인 생년월일', '계산기에 없음');
    } else o.miss('가.세무대리인(성명·사업자등록번호·생년월일·연락처)', '세무대리인 입력 없음(본인 신청)');
    // 나·다
    o.miss('나.가업현황(상호·사업자등록번호·대표자·생년월일·개업연월일·업종·기준총급여액·기준고용인원)', '계산기에 없음(가업 인적사항·급여·고용 칸 없음)');
    o.miss('다.중소기업 여부·상장여부(상장일)', '계산기에 없음(중소기업·상장 여부 칸 없음 — 납부유예는 중소기업만, 법 §72의2①1호)');
    // 라. 피상속인
    o.need('라@성명', dc.name, '라.성명').need('라@주민등록번호', dc.regNo, '라.주민등록번호');
    if (n(b.years) > 0) o.set('라@가업영위기간', n(b.years) + '년'); else o.miss('라.가업영위기간', '화면 입력 없음(가업영위기간)');
    o.miss('라.대표이사(대표자) 재직기간', '계산기에 없음(요건 체크만 있음)');
    if (b.reqOwnership === true) {
      o.set('라@최대주주등여부', '여');
      o.note('라. 최대주주등 여부 "여" = 화면 요건 체크 "피상속인 지분 40%(상장 20%) 이상 10년 보유"(시행령 §15③1호가목) 충족');
    } else o.miss('라.최대주주등 여부', '화면 요건 체크(지분 보유 요건)가 꺼져 있어 알 수 없음');
    o.miss('라.특수관계인포함 보유 주식 등 지분율', '계산기에 없음(지분율 값 칸 없음 — 요건 체크만)');
    // 마. 가업상속 재산가액 — 부표1 작성방법 6: ⑦(법인 가업)을 "가액"란에. 개인 가업은 ①(부표1 가. 계)
    if (d) {
      var kinds = [], vals = [], notes = [];
      if (n(d.소득세법적용분) > 0) { kinds.push('사업용 자산(개인 가업)'); vals.push(n(d.소득세법적용분)); notes.push('부표1 (1)'); }
      if (n(d.법인세법적용분) > 0 || n(b.stockValue) > 0) { kinds.push('주식 등(법인 가업)'); vals.push(n(d.법인세법적용분)); notes.push('부표1 (7)'); }
      if (kinds.length) o.set('마@종류', kinds).set('마@가액', vals).set('마@비고', notes);
      else o.miss('마.가업상속 재산가액', '부표1 ①·⑦이 모두 0');
      o.miss('마.수량(면적)·단가', '계산기에 없음(가업상속재산을 합계로만 받음)');
      o.check('마 가액 합 = 부표1 ① + ⑦(엔진 대상금액)', vals.reduce(function (s, v) { return s + v; }, 0), n(d.대상금액));
    } else o.miss('마.가업상속 재산가액', '가업상속 재산 계산 내역 없음(가업 화면 칸 비어 있음)');
    // 바. 신청 상속세 — 엔진이 실제로 뺀 납부유예세액
    var defer = n(r.가업상속납부유예세액), cap = r.가업상속납부유예_가능세액;
    if (defer > 0) o.set('바', defer); else o.miss('바', '결과 가업상속납부유예세액 0(납부유예를 빼지 않음)');
    if (has(cap) && defer > 0 && defer !== n(cap)) {
      o.note('⚠ 바. 신청세액 ' + defer + '원 ≠ 부표1 ⑩ 납부유예 가능 세액 ' + n(cap) + '원 — 부표1 작성방법 9는 ⑩(⑪로 인쇄됨) 금액을 바.에 적게 함' +
        (defer > n(cap) ? '. 가능 세액(시행령 §69의3①)을 넘음 — 계산기는 막지 않음' : ''));
    }
    if (r.가업상속납부유예_불가안내) o.note('⚠ ' + r.가업상속납부유예_불가안내);
    // 신청일·서명·세무서
    ymdSet(o, '신청일', ctx.신고일, '신청일', 'ctx.신고일 없음(계산기에 없음)');
    o.need('신청인서명', h.name, '신청인(서명)');
    if (has(ta.name)) o.set('세무대리인서명', ta.name); else o.miss('세무대리인(서명)', '세무대리인 입력 없음(본인 신청)');
    if (has(dc.taxOffice)) o.set('세무서', H.officeName(dc.taxOffice)); else o.miss('세무서', '피상속인 관할 세무서 입력 없음');
    o.miss('등기승낙서(납세담보제공서 일자·승낙일·신청인·세무서)', '계산기에 없음(납세담보 제공 칸 없음 — 부동산을 납세담보로 낼 때만 직접 적음, 법 §72의2①·국세기본법 §29)');
    return o.result();
  };

  // ───────── 상속 별지 제12호의2서식 부표1 — 가업상속재산명세서(납부유예)(시행령 §15⑤, §69의3①) ─────────
  //  값 출처: 지금 인쇄 ihBizAssetDetailTableHtml_(화면 ihBusiness* 칸 + 결과 가업상속공제_계산내역) + "다." ⑧⑨⑩.
  //  ⑧은 서식 작성방법 7대로 별지 제9호서식의 "공제·면제 후 납부할 세액"(지금 9호 ㊲)을 찍는다 — 지금 인쇄는 엔진 식(신고세액공제 뒤, 이자상당액·영리법인 면제분 전)을 찍음.
  mappers['상속12호의2부표1'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, x = ihbOf(ctx), b = x.biz || {}, d = bizDetailOf(ctx);
    if (!d) { o.miss('부표1 전체(①~⑩)', '가업상속 재산 계산 내역 없음'); return o.result(); }
    // 가. 소득세법 적용 가업 — 계산기는 사업용 자산 순액 합계(①) 하나만 받음
    o.miss('가.㉮ 금액·㉯ 담보채무액·대상금액(토지·건축물·기계장치·기타 줄)', '계산기에 없음(자산 종류별 금액·담보채무를 따로 받지 않고 순액 합계 ①만 받음)');
    o.miss('①@㉮·①@㉯ ① 계의 ㉮ 금액 계·㉯ 담보채무액 계', '계산기에 없음(순액 ①만 받음)');
    var v1 = n(d.소득세법적용분);
    if (v1 > 0) o.set('①', v1); else o.miss('① 계', '해당 없음 — 소득세법 적용 가업 금액 0(화면 사업용 자산 순액 비어 있음)');
    // 나. 법인세법 적용 가업
    var stock = n(b.stockValue), v7 = n(d.법인세법적용분);
    if (stock > 0) {
      var tot = n(b.totalAsset), nb = [n(b.nonBiz55), n(b.nonBiz49), n(b.nonBiz61), n(b.excessCash), n(b.nonBizStock)];
      var v4 = nb.reduce(function (s, v) { return s + v; }, 0), v5 = Math.max(0, tot - v4), v6 = n(d.사업관련자산가액비율);
      o.set('②', stock).set('③', tot).set('㉮', nb[0]).set('㉯', nb[1]).set('㉰', nb[2]).set('㉱', nb[3]).set('㉲', nb[4]).set('④', v4).set('⑤', v5).set('⑥', pct2(v6)).set('⑦', v7);
      o.check('④ = ㉮ + ㉯ + ㉰ + ㉱ + ㉲', v4, nb[0] + nb[1] + nb[2] + nb[3] + nb[4]);
      o.check('⑤ = ③ − ④', v5, tot - v4);
      o.check('⑥ = ⑤ ÷ ③(엔진 비율, 만분율)', Math.round(v6 * 10000), tot > 0 ? Math.round(v5 / tot * 10000) : 0);
      o.check('⑦ = ② × ⑥(엔진 반올림)', v7, Math.round(stock * v6));
      if (n(b.nonBiz49) > 0 || n(b.nonBiz61) > 0) o.note('㉯·㉰ 사업무관자산 — 시행령 §15⑤2호나목·다목 단서(2025.2.28. 개정: 임직원 무상임대 주택·학자금·전세금 대여 제외)는 입력자가 빼서 넣어야 함');
    } else o.miss('②~⑦ 나. 법인세법 적용 가업(②③㉮㉯㉰㉱㉲④⑤⑥⑦)', '해당 없음 — 상속개시일 현재 주식 등의 가액 0(법인 가업 아님)');
    // 다. 가업상속 납부유예 가능 상속세 납부세액
    var v8 = ih9Line37(r), e8 = engineTaxAfterReportCredit(r), v9 = n(x.totalGross), v10 = r.가업상속납부유예_가능세액;
    o.set('⑧', v8);
    if (v8 !== e8) o.note('⚠ ⑧ 상속세 납부세액 ' + v8 + '원(별지 제9호서식 ㊲ 공제·면제 후 납부할 세액 — 작성방법 7) ≠ 엔진이 ⑩을 셀 때 쓴 세액 ' + e8 + '원(이자상당액·영리법인 면제분을 넣지 않음) — ⑩ 검산이 틀리게 나옴(판단 대기: 시행령 §69의3① "상속세 납부세액")');
    if (v9 > 0) o.set('⑨', v9); else o.miss('⑨', '화면 입력 없음(총 상속재산가액 — 가업상속납부유예 참고계산용 칸)');
    if (has(v10)) {
      o.set('⑩', n(v10));
      if (v9 > 0) o.check('⑩ = ⑧ × (① + ⑦) ÷ ⑨(엔진 반올림)', n(v10), Math.round(v8 * (v1 + v7) / v9));
      if (v1 > 0 && v7 > 0) o.note('⚠ ⑩ — 서식은 "(① 또는 ⑦)"인데 개인 가업과 법인 가업이 둘 다 있어 엔진은 ① + ⑦(가업상속 재산가액 합)으로 계산함(시행령 §69의3①은 "제15조제5항에 따른 가업상속 재산가액")');
    } else o.miss('⑩', '엔진 납부유예 가능세액 없음(⑨ 총 상속재산가액이 0이면 계산하지 않음)');
    o.note('⑩ 금액을 신청서 바.에 적음(작성방법 9 — 서식엔 "⑪"로 인쇄돼 있으나 앞쪽 칸은 ⑩)');
    return o.result();
  };

  // ───────── 언제 찍나 ─────────
  var WHEN = {
    '상속12호의2': function (c) { var r = c.r || {}; return !!(c.r && n(r.가업상속납부유예세액) > 0 && r.가업상속공제_계산내역); },
    '상속12호의2부표1': function (c) { var r = c.r || {}; return !!(c.r && n(r.가업상속납부유예세액) > 0 && r.가업상속공제_계산내역); }
  };
  var IH_ORDER = ['상속12호의2', '상속12호의2부표1'];

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    if (tax === '상속') {
      var c = withIhb(ctx || {});
      IH_ORDER.forEach(function (k) { if (typeof mappers[k] === 'function' && WHEN[k](c)) L.push({ formKey: k, ctx: c }); });
    }
    return L;
  }
  // 세액인쇄 화면의 서식 한 줄 — 상속 계산 결과 하나
  function ihCtx(extra) { return withIhb(H.ctxFromApp.상속(extra)); }
  IH_ORDER.forEach(function (k) {
    ctxFor[k] = function (extra) { var c = ihCtx(extra); return WHEN[k](c) ? c : null; };
    ready[k] = function () { try { return typeof lastInheritanceResult !== 'undefined' && !!lastInheritanceResult && !!ctxFor[k](); } catch (e) { return false; } }; // eslint-disable-line no-undef
  });

  return { 묶음: '상속부속B', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready,
    ihbFromInput: ihbFromInput, ihbFromDom: ihbFromDom };
});
