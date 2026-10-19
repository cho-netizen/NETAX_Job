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
 *   공통11호          : 증여·상속 공통 탭 "연부연납" 도구 결과(lastInstallmentResult_)가 있음(PRINT_REGISTRY_ installment.isReady와 같음).
 *                       상속 묶음(plan)에는 그 도구가 상속세로 계산돼 있을 때만. 증여 묶음엔 붙이지 않음(지금 인쇄처럼 수증자 첫 번째 기준 — 서식표 줄로 찍음)
 *   공통11호부표      : 연부연납 도구가 상속세이고 상속 결과에 가업 재산 계산 내역(가업상속공제_계산내역)이 있음(지금 인쇄엔 없는 부표)
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
  // 글꼴(나눔고딕)에 없는 동그라미 숫자(①~⑳)를 (1)~(20)으로 — 화면에 손으로 적은 글을 찍을 때
  function plainNum(t) { return String(t).replace(/[①-⑳]/g, function (ch) { return '(' + (ch.charCodeAt(0) - 0x245F) + ')'; }); }
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

  // ───────── 연부연납(증여·상속 공통 탭 "연부연납" 도구) ─────────
  //  ctx = { 세목: '상속'|'증여', inst: {input, result}(lastInstallmentInput_·lastInstallmentResult_), person(신청인), other(피상속인·증여자), office(세무서), taxAgent,
  //          (상속이면 부표용) r: 상속 계산 결과, ihb }
  //  신청인은 지금 인쇄 installmentPrintFormPageHtml_와 같이 상속 = 상속인 명부 첫 행, 증여 = 수증자 첫 번째.
  /* global lastInstallmentInput_, lastInstallmentResult_, giftDonees, giftDonors, inheritanceHeirs, lastInheritanceResult */
  function instFromApp() {
    var inp = typeof lastInstallmentInput_ !== 'undefined' ? lastInstallmentInput_ : null;
    var res = typeof lastInstallmentResult_ !== 'undefined' ? lastInstallmentResult_ : null;
    return (inp && res && !res.error) ? { input: inp, result: res } : null;
  }
  // 상속 ctx(ctxFromApp.상속 모양)에서 연부연납 ctx로
  function instCtxFromIh(c, inst) {
    var h = firstHeir(c), dc = c.deceased || {};
    return Object.assign({}, c, { 세목: '상속', inst: inst,
      person: Object.assign({}, h, { phone: heirPhone(c, h), email: h.isReporter ? c.email : '' }),
      other: { name: dc.name, regNo: dc.regNo }, office: dc.taxOffice });
  }
  function instCtx(extra) {
    var inst = instFromApp(); if (!inst) return null;
    if (inst.input.taxType === 'gift') {
      var dn = (typeof giftDonees !== 'undefined' && giftDonees && giftDonees[0]) || {}, dr = (typeof giftDonors !== 'undefined' && giftDonors && giftDonors[0]) || {};
      return Object.assign({ 세목: '증여', inst: inst, taxAgent: H.agent(),
        person: { name: dn.name, regNo: dn.regNo, address: dn.address, addressDong: dn.addressDong, addressHo: dn.addressHo, phone: dn.phone, email: dn.email },
        other: { name: dr.name, regNo: dr.regNo }, office: dn.taxOffice }, extra || {});
    }
    var base;
    try { base = withIhb(H.ctxFromApp.상속(extra)); } catch (e) {
      var hs = (typeof inheritanceHeirs !== 'undefined' && inheritanceHeirs) ? inheritanceHeirs : [];
      base = Object.assign({ r: null, heirs: hs.map(function (h) { return { name: h.name || '', regNo: h.regNo || '', address: h.address || '', addressDong: h.addressDong || '', addressHo: h.addressHo || '', isReporter: !!h.isReporter }; }),
        phone: H.el('ihReporterPhone'), email: H.el('ihReporterEmail'), taxAgent: H.agent(),
        deceased: { name: H.el('ihDeceasedName'), regNo: H.el('ihDeceasedRegNo'), taxOffice: H.el('ihDeceasedTaxOffice') } }, extra || {});
    }
    return instCtxFromIh(base, inst);
  }

  // ───────── 상증 별지 제11호서식 — 상속세(증여세) 연부연납허가(변경, 철회) 신청서(법 §71, 시행령 §67·§68) ─────────
  //  값 출처: 지금 인쇄 installmentPrintFormPageHtml_(신청인 성명·주민번호, 총 납부세액·최초 납부세액·연부연납대상금액, 회차표) +
  //   엔진 calculateInstallmentPaymentScheduleJS 결과(회차별_납부예정세액). 피상속인(증여자)·주소·전화는 상속(증여) 탭의 같은 사람 칸.
  //  예전 인쇄 번호와 다름: 예전 ③ 총 납부세액·④ 최초 납부세액·⑤ 연부연납대상금액·⑥ 연부연납기간 → 서식 ⑨·⑩·⑪(기간은 서식에 칸 없음).
  mappers['공통11호'] = function (ctx) {
    var o = new Out(), inst = ctx.inst || {}, inp = inst.input || {}, res = inst.result || {}, p = ctx.person || {}, ot = ctx.other || {}, ta = ctx.taxAgent || {};
    var gift = ctx.세목 === '증여';
    o.need('①', p.name, '① 신청인 성명').need('②', p.regNo, '② 주민등록번호').need('③', H.fullAddr(p), '③ 주소');
    if (has(p.phone)) o.set('③@전화번호', p.phone);
    else o.miss('③ 전화번호(☎)', gift ? '수증자 전화번호 입력 없음' : '상속인 명부에 전화번호 칸 없음(신고인 전화번호는 명부 첫 행이 신고인일 때만 씀)');
    if (has(p.email)) o.set('④', p.email);
    else o.miss('④ 전자우편주소', gift ? '수증자 전자우편 입력 없음' : '상속인 명부에 전자우편 칸 없음(신고인 전자우편은 명부 첫 행이 신고인일 때만 씀)');
    o.note('⚠ 신청인 = ' + (gift ? '수증자 목록 첫 번째' : '상속인 명부 첫 행') + '(지금 인쇄와 같음). 공동 신청이면 다른 신청인을 서명란 2~4번째 줄에 적으세요');
    o.miss('⑤ 재산별 구분', '계산기에 없음(연부연납 도구는 상속·증여만 고름 — 가업상속재산(법 §71②1호가목)·조특법 §30의6 증여재산 여부 칸 없음)');
    o.need('⑥', ot.name, gift ? '⑥ 증여자 성명' : '⑥ 피상속인 성명').need('⑦', ot.regNo, gift ? '⑦ 증여자 주민등록번호' : '⑦ 피상속인 주민등록번호');
    if (has(ta.name)) {
      o.set('세무대리인@성명', ta.name);
      if (has(ta.bizNo)) o.set('세무대리인@사업자등록번호', ta.bizNo); else o.miss('세무대리인 사업자등록번호', '세무대리인 사업자등록번호 입력 없음');
      if (has(ta.phone)) o.set('세무대리인@연락처', ta.phone); else o.miss('세무대리인 연락처', '세무대리인 전화번호 입력 없음');
      o.miss('세무대리인 생년월일', '계산기에 없음');
    } else o.miss('세무대리인(성명·사업자등록번호·생년월일·연락처)', '세무대리인 입력 없음(본인 신청)');
    o.miss('⑧ 신고(고지납부)기한', '계산기에 없음(연부연납 도구에 신고기한·고지 납부기한 칸 없음)');
    var v9 = n(inp.totalTaxAmount), v10 = n(res.최초납부세액), v11 = n(res.연부연납대상금액);
    o.set('⑨', v9).set('⑩', v10).set('⑪', v11);
    o.check('⑪ = ⑨ − ⑩', v11, v9 - v10);
    var rows = res.회차별_납부예정세액 || [];
    rows.forEach(function (row) { o.set('납부예정세액@회' + row.회차, n(row.납부예정세액)); });
    o.check('회차 원금 합 = ⑪', rows.reduce(function (s, row) { return s + n(row.원금); }, 0), v11);
    o.miss('(회차) 납부예정일', '계산기에 없음(연부연납 도구는 회차만 셈 — 신고기한·허가일 칸 없음)');
    if (rows.length > 20) o.note('회차가 ' + rows.length + '회 — 서식 표는 20회까지라 21회부터는 다음 장에 이어 찍음');
    var yrs = n(inp.installmentPeriodYears), rate = inp.annualInterestRatePercent;
    o.note('연부연납기간 ' + yrs + '년(서식엔 칸이 없음 — 작성방법 2). 1회 = 신고기한까지 내는 몫(시행령 §68①3호: 연부연납 대상금액 ÷ (기간 + 1)), 2회부터 가산금(법 §72)을 더한 납부예정 세액');
    if (has(rate) && n(rate) === 0 && n(res.가산금_합계) === 0) o.note('⚠ 가산금 0원 — 화면 "연부연납 가산금 연이자율" 칸이 비어 0%로 계산됐을 수 있음(시행령 §69①: 각 회분 납부일 현재 국세기본법 시행령 §43의3② 이자율)');
    else o.note('가산금 이율: ' + (has(rate) && rate !== '' ? '연 ' + rate + '%(화면 입력)' : '기준일 고시 이자율') + ' 하나로 전 회차를 계산함 — 시행령 §69①②는 각 회분 납부일 현재 이자율(바뀌면 기간별)');
    if (res.각회분_1천만원미만_경고) o.note('⚠ 각 회 원금이 1천만원 미만 — 법 §71② 단서: 각 회분 분할납부 세액이 1천만원을 초과하도록 기간을 정해야 함');
    if (gift ? yrs > 5 : yrs > 10) o.note('⚠ 연부연납기간 ' + yrs + '년 — ' + (gift ? '조특법 §30의6 증여재산만 15년까지(법 §71②2호), 그 밖의 증여재산은 5년' : '가업상속재산(법 §71②1호가목)만 20년까지, 그 밖의 상속재산은 10년') + ' — ⑤ 재산별 구분에 직접 √하세요');
    o.miss('(변경·철회) 신청 구분([ ]최초 [ ]변경 [ ]철회)', '계산기에 없음(최초·변경·철회 선택 칸 없음)');
    ymdSet(o, '신청일', ctx.신고일, '신청일', 'ctx.신고일 없음(계산기에 없음)');
    o.need('신청인서명', p.name, '신청인(서명)');
    o.miss('신청인(서명) 2~4번째 줄', '공동 신청인 — 계산기에 없음');
    if (has(ta.name)) o.set('세무대리인서명', ta.name); else o.miss('세무대리인(서명)', '세무대리인 입력 없음(본인 신청)');
    if (has(ctx.office)) o.set('세무서', H.officeName(ctx.office)); else o.miss('세무서', gift ? '수증자 관할 세무서 입력 없음' : '피상속인 관할 세무서 입력 없음');
    o.miss('등기승낙서(납세담보제공서 일자·승낙일·신청인)', '계산기에 없음(납세담보 칸 없음 — 부동산을 납세담보로 낼 때만 직접 적음, 법 §71① 후단)');
    return o.result();
  };

  // ───────── 상증 별지 제11호서식 부표 — 연부연납세액 계산명세(시행령 §68②~④: 가업상속재산 몫 연부연납 세액) ─────────
  //  지금 인쇄에는 이 부표가 없음(installmentPrintFormPageHtml_의 "연부연납세액 계산명세" 표는 회차표). 상속 탭 가업 칸(ihBusiness*)·결과(가업상속공제_계산내역·가업상속공제)로 ①~⑩.
  //  ⑪(가업상속재산 몫 연부연납세액)은 계산기에 없음 — 연부연납 도구는 총 납부세액 전체를 한 기간으로 나눔. 서식 산식 값은 알림으로만 보여 줌.
  mappers['공통11호부표'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, x = ihbOf(ctx), b = x.biz || {}, d = bizDetailOf(ctx);
    if (ctx.세목 === '증여') { o.miss('부표 전체(①~⑪)', '해당 없음 — 상속 가업(법 §71②1호가목) 전용 부표'); return o.result(); }
    if (!d) { o.miss('부표 전체(①~⑪)', '상속 계산 결과에 가업 재산 계산 내역 없음(상속 탭 가업 칸이 비어 있음)'); return o.result(); }
    o.miss('가.㉮ 금액·㉯ 담보채무액·순익(토지·건축물·기계장치·기타 줄)', '계산기에 없음(자산 종류별 금액·담보채무를 따로 받지 않고 순액 합계 ①만 받음)');
    o.miss('①@㉮·①@㉯ ① 계의 ㉮ 금액 계·㉯ 담보채무액 계', '계산기에 없음(순액 ①만 받음)');
    var v1 = n(d.소득세법적용분);
    if (v1 > 0) {
      o.set('①', v1);
      o.note('⚠ ① = 상속 탭 "사업용 자산 순액"(가업상속공제 기준, 시행령 §15⑤1호) — 연부연납 기업상속재산(시행령 §68④1호)은 타인에게 임대하고 있는 부동산을 뺌. 임대 부동산이 있으면 고치세요');
    } else o.miss('① 계', '해당 없음 — 소득세법 적용 기업 금액 0(화면 사업용 자산 순액 비어 있음)');
    var stock = n(b.stockValue), v7 = n(d.법인세법적용분);
    if (stock > 0) {
      var tot = n(b.totalAsset), nb = [n(b.nonBiz55), n(b.nonBiz49), n(b.nonBiz61), n(b.excessCash), n(b.nonBizStock)];
      var v4 = nb.reduce(function (s, v) { return s + v; }, 0), v5 = Math.max(0, tot - v4), v6 = n(d.사업관련자산가액비율);
      o.set('②', stock).set('③', tot).set('㉮', nb[0]).set('㉯', nb[1]).set('㉰', nb[2]).set('㉱', nb[3]).set('㉲', nb[4]).set('④', v4).set('⑤', v5).set('⑥', pct2(v6)).set('⑦', v7);
      o.check('④ = ㉮ + ㉯ + ㉰ + ㉱ + ㉲', v4, nb[0] + nb[1] + nb[2] + nb[3] + nb[4]);
      o.check('⑤ = ③ − ④', v5, tot - v4);
      o.check('⑥ = ⑤ ÷ ③(엔진 비율, 만분율)', Math.round(v6 * 10000), tot > 0 ? Math.round(v5 / tot * 10000) : 0);
      o.check('⑦ = ② × ⑥(엔진 반올림)', v7, Math.round(stock * v6));
    } else o.miss('②~⑦ 나. 법인세법 적용 기업(②③㉮㉯㉰㉱㉲④⑤⑥⑦)', '해당 없음 — 상속개시일 현재 주식 등의 가액 0(법인 기업 아님)');
    var v8 = ih9Line37(r), v9 = n(x.totalGross), v10 = n(r.가업상속공제);
    o.set('⑧', v8);
    if (v9 > 0) o.set('⑨', v9); else o.miss('⑨', '화면 입력 없음(상속 탭 "총 상속재산가액" 칸 — 가업상속납부유예 참고계산용과 같은 칸)');
    o.set('⑩', v10);
    if (v10 === 0 && !r.가업상속납부유예_선택) o.note('⑩ 가업상속공제 0원 — ' + (d.요건미충족으로_공제배제 ? '요건 미충족' : d.중견기업게이트_적용여부 ? '중견기업 적용 배제' : '공제 없음'));
    if (v9 > 0 && v9 > v10) {
      var ref = Math.floor(v8 * ((v1 + v7) - v10) / (v9 - v10));
      o.miss('⑪ 연부연납세액', '계산기에 없음(연부연납 도구는 가업상속재산 몫을 따로 나누지 않음)');
      o.note('(참고) 서식 산식대로면 ⑪ = ⑧ × {(① + ⑦) − ⑩} ÷ (⑨ − ⑩) = ' + ref + '원(원 미만 버림, 시행령 §68② 계산식) — 계산기 값이 아니라 비워 둠');
    } else o.miss('⑪ 연부연납세액', '계산기에 없음(⑨ 총 상속재산가액 입력이 없어 서식 산식도 셀 수 없음)');
    if (v1 > 0 && v7 > 0) o.note('⚠ 서식은 "(① 또는 ⑦)" — 개인 기업과 법인 기업이 둘 다 있음');
    return o.result();
  };

  // ───────── 결정(경정)청구(증여·상속 공통 탭 "경정청구" 도구) ─────────
  //  ctx = { 세목, cr(lastCorrectionClaimInput_ = {taxType, originalTax, correctedTax, reasonType, reasonDetail}), claimant(청구인), other(피상속인·증여자), office, taxAgent }
  //  청구인: 경정청구 도구엔 청구인 칸이 없어 상속 = 상속세 신고인(명부의 신고인 표시, 없으면 첫 행), 증여 = 수증자 첫 번째.
  /* global lastCorrectionClaimInput_ */
  function crCtx(extra) {
    var cr = typeof lastCorrectionClaimInput_ !== 'undefined' ? lastCorrectionClaimInput_ : null;
    if (!cr) return null;
    var ta = H.agent();
    if (cr.taxType === 'gift') {
      var dn = (typeof giftDonees !== 'undefined' && giftDonees && giftDonees[0]) || {}, dr = (typeof giftDonors !== 'undefined' && giftDonors && giftDonors[0]) || {};
      return Object.assign({ 세목: '증여', cr: cr, taxAgent: ta,
        claimant: { name: dn.name, regNo: dn.regNo, address: dn.address, addressDong: dn.addressDong, addressHo: dn.addressHo, phone: dn.phone, email: dn.email },
        other: { name: dr.name, regNo: dr.regNo, giftDate: H.el('giftDate') }, office: dn.taxOffice }, extra || {});
    }
    var hs = (typeof inheritanceHeirs !== 'undefined' && inheritanceHeirs) ? inheritanceHeirs : [];
    var rp = hs.filter(function (h) { return h && h.isReporter; })[0] || hs[0] || {};
    return Object.assign({ 세목: '상속', cr: cr, taxAgent: ta,
      claimant: { name: rp.name, regNo: rp.regNo, address: rp.address, addressDong: rp.addressDong, addressHo: rp.addressHo,
        phone: rp.isReporter ? H.el('ihReporterPhone') : '', email: rp.isReporter ? H.el('ihReporterEmail') : '', isReporter: !!rp.isReporter },
      other: { name: H.el('ihDeceasedName'), regNo: H.el('ihDeceasedRegNo'), deathDate: H.el('ihDeathDate') }, office: H.el('ihDeceasedTaxOffice') }, extra || {});
  }

  // ───────── 상증 별지 제16호서식 — 상속세(증여세) 과세표준 및 세액의 결정(경정)청구서(법 §79, 시행령 §81) ─────────
  //  값 출처: 지금 인쇄 crPrintFormPageHtml_(세목·당초 신고(결정)세액·청구 후 세액·환급세액·청구 구분·사유) — 화면 crTaxType·crOriginalTax·crCorrectedTax·crReason·crReasonDetail.
  //  예전 인쇄 번호와 다름: 예전 ① 세목·② 당초세액·③ 청구 후 세액·④ 환급세액·⑤ 청구 구분·⑥ 사유 → 서식 ⑨(신고(결정)·결정(경정)청구 두 열)·③ 청구이유.
  mappers['공통16호'] = function (ctx) {
    var o = new Out(), cr = ctx.cr || {}, c = ctx.claimant || {}, ot = ctx.other || {}, ta = ctx.taxAgent || {};
    var gift = ctx.세목 === '증여';
    o.need('청구인@성명', c.name, '1.청구인 성명').need('청구인@주민등록번호', c.regNo, '1.청구인 주민등록번호').need('청구인@주소', H.fullAddr(c), '1.청구인 주소');
    if (has(c.phone)) o.set('청구인@전화번호', c.phone); else o.miss('1.청구인 전화번호(☎)', gift ? '수증자 전화번호 입력 없음' : '상속인 명부에 전화번호 칸 없음(신고인 전화번호는 청구인이 신고인일 때만 씀)');
    if (has(c.email)) o.set('청구인@전자우편주소', c.email); else o.miss('1.청구인 전자우편주소', gift ? '수증자 전자우편 입력 없음' : '상속인 명부에 전자우편 칸 없음(신고인 전자우편은 청구인이 신고인일 때만 씀)');
    o.note('⚠ 1. 청구인 = ' + (gift ? '수증자 목록 첫 번째' : '상속세 신고인(상속인 명부의 신고인 표시)') + ' — 경정청구 도구엔 청구인 칸이 없음(예전 인쇄는 청구인을 비워 둠). 다르면 고치세요');
    o.need('피상속인@성명', ot.name, gift ? '1.증여인 성명' : '1.피상속인 성명').need('피상속인@주민등록번호', ot.regNo, gift ? '1.증여인 주민등록번호' : '1.피상속인 주민등록번호');
    if (gift) {
      o.need('피상속인@증여일', ot.giftDate, '1.증여일');
      o.miss('1.상속개시일', '해당 없음 — 증여세 청구');
    } else {
      o.need('피상속인@상속개시일', ot.deathDate, '1.상속개시일');
      o.miss('1.증여일', '해당 없음 — 상속세 청구');
    }
    if (has(ta.name)) {
      o.set('세무대리인@성명', ta.name);
      if (has(ta.bizNo)) o.set('세무대리인@사업자등록번호', ta.bizNo); else o.miss('1.세무대리인 사업자등록번호', '세무대리인 사업자등록번호 입력 없음');
      if (has(ta.phone)) o.set('세무대리인@연락처', ta.phone); else o.miss('1.세무대리인 연락처', '세무대리인 전화번호 입력 없음');
      o.miss('1.세무대리인 생년월일', '계산기에 없음');
    } else o.miss('1.세무대리인(성명·사업자등록번호·생년월일·연락처)', '세무대리인 입력 없음(본인 청구)');
    o.note('제목 "상속세(증여세)" — 이 청구는 ' + (gift ? '증여세' : '상속세') + '(서식에 세목 칸은 따로 없음 — 해당 없는 글자를 지우세요)');
    o.miss('① 과세표준 신고일', '계산기에 없음(경정청구 도구에 당초 신고일 칸 없음)');
    o.miss('② 결정통지일', '계산기에 없음');
    if (has(cr.reasonDetail)) o.set('③', plainNum(cr.reasonDetail)); else o.miss('③ 결정(경정) 청구이유', '화면 입력 없음(경정청구 사유 글)');
    o.note('⚠ 이 서식은 상증법 §79(경정 등의 청구 특례 — ①상속회복청구소송 등·상속개시 후 1년 안 수용 등으로 가액 하락: 사유 발생일부터 6개월, ②부동산무상사용·금전무상대출·담보제공 증여 뒤 상속·증여 등: 3개월) 청구서. ' +
      '계산기는 국세기본법 §45의2 ' + (cr.reasonType === 'subsequent' ? '후발적 경정청구(②)' : '통상적 경정청구(①)') + '로 구분함 — §45의2 일반 경정청구면 국세기본법 시행규칙 별지 제16호의2서식을 쓰는지 확인하세요');
    o.miss('④ 결정(경정)청구 대상 재산(종류·소재지)', '계산기에 없음');
    o.miss('⑤⑥⑦⑧ 과세표준 금액·산출세액·가산세·공제세액 및 징수유예액(신고(결정)·결정(경정)청구)', '계산기에 없음(경정청구 도구는 납부할 세액만 받음)');
    var orig = n(cr.originalTax), corr = n(cr.correctedTax), diff = orig - corr;
    o.set('⑨@신고', orig).set('⑨@청구', corr);
    if (diff > 0) o.note('환급할 세액(⑨ 신고(결정) − ⑨ 결정(경정)청구) = ' + diff + '원');
    else if (diff < 0) o.note('⚠ 청구 후 세액이 당초 세액보다 많음 — 경정청구가 아니라 수정신고 대상(국세기본법 §45)');
    else o.note('⚠ 차액 없음 — 경정청구 실익이 없음');
    ymdSet(o, '청구일', ctx.신고일, '청구일', 'ctx.신고일 없음(계산기에 없음)');
    o.need('청구인서명', c.name, '청구인(서명)');
    if (has(ta.name)) o.set('세무대리인서명', ta.name); else o.miss('세무대리인(서명)', '세무대리인 입력 없음(본인 청구)');
    if (has(ctx.office)) o.set('세무서', H.officeName(ctx.office)); else o.miss('세무서', gift ? '수증자 관할 세무서 입력 없음' : '피상속인 관할 세무서 입력 없음');
    return o.result();
  };

  // ───────── 국기 별지 제8호서식 — 상속인대표자신고서(국세기본법 §24③ 후단, 시행령 §12①) ─────────
  //  지금 인쇄엔 이 서식이 없음(세액인쇄 "필요할 수 있음" 목록 PRINT_MAYBE_RULES_에 상속인 2명 이상일 때 이름만). 값은 상속 탭 상속인 명부.
  function namedHeirs(ctx) { return (ctx.heirs || []).filter(function (h) { return h && (has(h.name) || has(h.relation)); }); }
  mappers['국기8호'] = function (ctx) {
    var o = new Out(), hs = namedHeirs(ctx), dc = ctx.deceased || {};
    if (!hs.length) o.miss('①②③④ 상속인(성명·주민등록번호·주소·전화번호)', '상속인 명부 비어 있음');
    else {
      o.set('①', hs.map(function (h) { return h.name || ''; })).set('②', hs.map(function (h) { return h.regNo || ''; })).set('③', hs.map(function (h) { return H.fullAddr(h); }));
      var ph = hs.map(function (h) { return heirPhone(ctx, h); });
      if (ph.some(function (x) { return has(x); })) o.set('④', ph);
      o.miss('④ 상속인 전화번호', '계산기에 없음(상속인 명부에 전화번호 칸 없음 — 상속세 신고인 줄에만 신고인 전화번호를 찍음)');
      if (hs.some(function (h) { return !has(h.name); })) o.miss('① 성명 일부 줄', '상속인 명부에 이름이 없는 줄(관계만 있음)');
      if (hs.some(function (h) { return !has(h.regNo); })) o.miss('② 주민등록번호 일부 줄', '화면 입력 없음');
      if (hs.some(function (h) { return !has(H.fullAddr(h)); })) o.miss('③ 주소 일부 줄', '화면 입력 없음');
      if (hs.length > 5) o.note('상속인이 ' + hs.length + '명 — 서식 표는 5줄이라 6번째부터 다음 장에 이어 찍음');
      if (hs.length < 2) o.note('⚠ 상속인이 1명 — 대표자 신고는 상속인이 2명 이상일 때 함(국세기본법 §24③ 후단)');
    }
    var rp = hs.filter(function (h) { return h.isReporter; })[0];
    if (rp) {
      o.set('⑤', rp.name);
      o.note('⚠ ⑤ 대표자 = 상속인 명부에서 "신고인"으로 표시한 사람(계산기에 납세 대표자 칸이 따로 없음) — 다르면 고치세요');
    } else o.miss('⑤ 대표자 성명', '상속인 명부에 신고인 표시가 없음(계산기에 대표자 칸 없음)');
    o.miss('⑥ 대표자로 정한 사유', '계산기에 없음');
    ymdSet(o, '신고일', ctx.신고일, '신고일', 'ctx.신고일 없음(계산기에 없음)');
    var dd = H.ymd(dc.deathDate);
    if (dd) {
      var due = new Date(Date.UTC(Number(dd.y), Number(dd.m) - 1, Number(dd.d) + 30));
      o.note('신고기한: 상속개시일(' + dc.deathDate + ')부터 30일 이내(국세기본법 시행령 §12①) — ' + due.toISOString().slice(0, 10) + '까지(첫날 빼고 셈, 기한이 공휴일·토요일이면 다음 날)');
    }
    if (rp) o.set('신고인서명', rp.name); else o.miss('신고인(서명)', '상속인 명부에 신고인 표시가 없음');
    if (has(dc.taxOffice)) o.set('세무서', H.officeName(dc.taxOffice)); else o.miss('세무서', '피상속인 관할 세무서 입력 없음');
    return o.result();
  };

  // ───────── 물납(증여·상속 공통 탭 "물납 적격판정" 도구) ─────────
  //  ctx = { pk: {input, result}(lastPropertyInKindInput_·lastPropertyInKindResult_ — 적용 가능일 때만 결과가 남음), person(신청인 = 상속인 명부 첫 행 — 지금 인쇄와 같음),
  //          phone·email(신고인 칸 — 명부 첫 행이 신고인일 때만), office(피상속인 관할 세무서), taxAgent }
  /* global lastPropertyInKindInput_, lastPropertyInKindResult_ */
  function pkFromApp() {
    var inp = typeof lastPropertyInKindInput_ !== 'undefined' ? lastPropertyInKindInput_ : null;
    var res = typeof lastPropertyInKindResult_ !== 'undefined' ? lastPropertyInKindResult_ : null;
    return (inp && res) ? { input: inp, result: res } : null;
  }
  function heirsCtx(extra) {
    try { return withIhb(H.ctxFromApp.상속(extra)); } catch (e) {
      var hs = (typeof inheritanceHeirs !== 'undefined' && inheritanceHeirs) ? inheritanceHeirs : [];
      return Object.assign({ r: null, heirs: hs.map(function (h) { return { name: h.name || '', regNo: h.regNo || '', relation: h.relation || '', address: h.address || '', addressDong: h.addressDong || '', addressHo: h.addressHo || '', isReporter: !!h.isReporter }; }),
        phone: H.el('ihReporterPhone'), email: H.el('ihReporterEmail'), taxAgent: H.agent(),
        deceased: { name: H.el('ihDeceasedName'), regNo: H.el('ihDeceasedRegNo'), deathDate: H.el('ihDeathDate'), taxOffice: H.el('ihDeceasedTaxOffice') } }, extra || {});
    }
  }
  function pkCtx(extra) {
    var pk = pkFromApp(); if (!pk) return null;
    return Object.assign(heirsCtx(extra), { pk: pk });
  }
  // 물납 신청서 공통 머리(①~⑤, ⑦⑧, 신청인 서명·세무서) — 13호·14호의2
  function pkHead(o, ctx, cultural) {
    var inp = (ctx.pk || {}).input || {}, h = firstHeir(ctx), dc = ctx.deceased || {};
    o.need('①', h.name, '① 신청인 성명').need('②', h.regNo, '② 주민등록번호').need('③', H.fullAddr(h), '③ 주소');
    var ph = heirPhone(ctx, h);
    if (ph) o.set('③@전화번호', ph); else o.miss('③ 전화번호(☎)', '상속인 명부에 전화번호 칸 없음(신고인 전화번호는 명부 첫 행이 신고인일 때만 씀)');
    if (h.isReporter && has(ctx.email)) o.set('④', ctx.email); else o.miss('④ 전자우편주소', '상속인 명부에 전자우편 칸 없음(신고인 전자우편은 명부 첫 행이 신고인일 때만 씀)');
    o.note('⚠ 신청인 = 상속인 명부 첫 행(지금 인쇄와 같음). 다른 상속인도 신청하면 직접 적으세요');
    if (n(inp.inheritanceTaxPayable) > 0) o.set('⑤', n(inp.inheritanceTaxPayable)); else o.miss('⑤ 납부세액', '물납 도구 입력 없음(상속세 납부세액)');
    o.miss('⑦ 유형([ ]신고분 [ ]고지분' + (cultural ? '' : ' [ ]연부연납분') + ')', '계산기에 없음');
    o.miss('⑧ 납부기한', '계산기에 없음');
    ymdSet(o, '신청일', ctx.신고일, '신청일', 'ctx.신고일 없음(계산기에 없음)');
    o.need('신청인서명', h.name, '신청인(서명)');
    if (has(dc.taxOffice)) o.set('세무서', H.officeName(dc.taxOffice)); else o.miss('세무서', '피상속인 관할 세무서 입력 없음');
  }

  // ───────── 상증 별지 제13호서식 — 상속세 물납(변경, 철회)신청서(법 §73, 시행령 §70·§72~§75) ─────────
  //  값 출처: 지금 인쇄 propertyInKindPaymentPrintFormPageHtml_(provision = general) — 신청인 성명·주민번호(명부 첫 행), 상속세 납부세액(화면 ikTaxPayable).
  //  예전 인쇄 번호와 다름: 예전 ③ 상속세 납부세액 → 서식 ⑤, 예전 ④ "물납신청가능세액 한도"(일반 물납은 엔진이 한도를 안 세어 늘 0원) → 서식 ⑥은 비움(계산기에 없음).
  mappers['상속13호'] = function (ctx) {
    var o = new Out(), pk = ctx.pk || {}, inp = pk.input || {}, res = pk.result || {};
    pkHead(o, ctx, false);
    o.miss('⑥ 물납신청세액', '계산기에 없음(일반 물납 한도 — 시행령 §73①: 물납 충당 부동산·유가증권 가액에 대한 납부세액과 납부세액 − (금융재산 − 금융채무 + 상장유가증권) 중 적은 금액 — 를 엔진이 세지 않음)');
    o.miss('⑨⑩⑪⑫⑬⑭⑮⑯⑰ 물납대상 재산명세(종류·소재지·평가기준일·평가기준·단위당가액·수량·총액·비고·계)', '계산기에 없음(물납 도구는 요건 판정용 합계만 받음 — 작성방법 3의 순서대로 직접 적음)');
    o.miss('(변경·철회) 신청 구분([ ]최초 [ ]변경 [ ]철회)', '계산기에 없음');
    if (has(res.부동산유가증권비율)) o.note('물납 요건(법 §73①, 엔진 판정 "적용 가능"): 부동산·유가증권 ' + n(inp.realEstateSecuritiesValue) + '원 ÷ 상속재산가액 ' + n(inp.totalInheritanceValue) + '원 = ' + pct2(res.부동산유가증권비율) + '%(1/2 초과), 납부세액 2천만원 초과, 납부세액 > 금융재산 ' + n(inp.financialAssetValue) + '원');
    o.note('⚠ 법 §73①1호의 상속재산가액에 더하는 증여재산은 "상속인·수유자가 받은 것"만, 3호 금융재산엔 가산 증여재산을 넣지 않음 — 물납 도구는 입력한 값 그대로 비교함');
    return o.result();
  };

  // ───────── 언제 찍나 ─────────
  function instIh(c) { var i = c.inst || instFromApp(); return i && i.input && i.input.taxType === 'inheritance' ? i : null; }
  var WHEN = {
    '상속12호의2': function (c) { var r = c.r || {}; return !!(c.r && n(r.가업상속납부유예세액) > 0 && r.가업상속공제_계산내역); },
    '상속12호의2부표1': function (c) { var r = c.r || {}; return !!(c.r && n(r.가업상속납부유예세액) > 0 && r.가업상속공제_계산내역); },
    // 연부연납: 상속 묶음엔 연부연납 도구가 상속세로 계산돼 있을 때만(증여는 세액인쇄 서식표의 그 줄로 — 첫 수증자 기준이라 사람별 묶음에 붙이지 않음)
    '공통11호': function (c) { return !!(c.r && instIh(c)); },
    '공통11호부표': function (c) { return !!(c.r && instIh(c) && bizDetailOf(c)); },
    // 상속인대표자신고서: 상속인이 2명 이상(국세기본법 §24③ 후단 — 지금 세액인쇄 '필요할 수 있음' 규칙과 같은 조건)
    '국기8호': function (c) { return !!(c.r && namedHeirs(c).length >= 2); }
  };
  var IH_ORDER = ['상속12호의2', '상속12호의2부표1', '공통11호', '공통11호부표', '국기8호'];
  function forIh(k, c) { return /^공통11호/.test(k) ? instCtxFromIh(c, instIh(c)) : c; }

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    if (tax === '상속') {
      var c = withIhb(ctx || {});
      IH_ORDER.forEach(function (k) { if (typeof mappers[k] === 'function' && WHEN[k](c)) L.push({ formKey: k, ctx: forIh(k, c) }); });
    }
    return L;
  }
  // 세액인쇄 화면의 서식 한 줄 — 상속 계산 결과 하나
  function ihCtx(extra) { return withIhb(H.ctxFromApp.상속(extra)); }
  ['상속12호의2', '상속12호의2부표1', '국기8호'].forEach(function (k) {
    ctxFor[k] = function (extra) { var c = ihCtx(extra); return WHEN[k](c) ? c : null; };
    ready[k] = function () { try { return typeof lastInheritanceResult !== 'undefined' && !!lastInheritanceResult && !!ctxFor[k](); } catch (e) { return false; } };
  });
  // 연부연납 — 지금 인쇄처럼 연부연납 도구 결과만 있으면(상속·증여 계산과 따로)
  ctxFor['공통11호'] = function (extra) { return instCtx(extra); };
  ready['공통11호'] = function () { return !!instFromApp(); };
  ctxFor['공통11호부표'] = function (extra) { var c = instCtx(extra); return (c && c.세목 === '상속' && bizDetailOf(c)) ? c : null; };
  ready['공통11호부표'] = function () { try { return !!ctxFor['공통11호부표'](); } catch (e) { return false; } };
  // 결정(경정)청구 — 지금 인쇄처럼 경정청구 도구 계산이 있으면(PRINT_REGISTRY_ cr.isReady). 신고 묶음(plan)엔 넣지 않음(신고 뒤 따로 내는 청구서)
  ctxFor['공통16호'] = function (extra) { return crCtx(extra); };
  ready['공통16호'] = function () { return typeof lastCorrectionClaimInput_ !== 'undefined' && !!lastCorrectionClaimInput_; };
  // 물납 — 지금 인쇄처럼 물납 도구가 "적용 가능"으로 판정했을 때(PRINT_REGISTRY_ propertyinkind.isReady). 일반 = 13호, 문화유산 등 = 14호의2
  ctxFor['상속13호'] = function (extra) { var c = pkCtx(extra); return (c && c.pk.input.provision !== 'cultural_heritage') ? c : null; };
  ready['상속13호'] = function () { var pk = pkFromApp(); return !!(pk && pk.input.provision !== 'cultural_heritage'); };

  return { 묶음: '상속부속B', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready,
    ihbFromInput: ihbFromInput, ihbFromDom: ihbFromDom };
});
