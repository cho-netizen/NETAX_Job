/*
 * NxFormPrint 묶음 파일 — 증여특례B (원본 모양 인쇄 55장 확장, 2026-10-20 작업자 증여특례B)
 * 이 묶음의 서식: 증여10호의3 · 증여10호의3부표1 · 증여10호의3부표2 · 증여10호의3부표3 · 증여10호의3부표4 · 증여10호의3부표5 · 증여10호의4 · 증여10호의4부표1 · 증여10호의4부표2 · 증여10호의4부표3 · 증여10호의4부표4
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/증여)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-증여특례B.js → node tools/formprint-check-ext.js 증여특례B
 *
 * ── 값 출처(지금 세액인쇄 taxcalc.html 함수와 같은 전역값·화면 칸) ──
 *   일감몰아주기(10호의3·부표1~5) : lastRelatedPartyGiftResult_ (calculateRelatedPartyTransactionGiftTaxJS) + 증여세 탭 "일감몰아주기" 입력칸(jm…)
 *        + 🧮 주주별 직접·간접보유 내역 shareholdingRows_.jm, 🧮 특수관계법인 매출 합산 relatedPartyRatioRows_·jmRelatedPartyTotalSales_·jmRelatedPartyExcludedSales_
 *        — jmPrintFormPageHtml_·jmAttach1~4PrintPageHtml_ 과 같은 값
 *   일감떼어주기(10호의4·부표1~4) : lastBusinessOpportunityGiftResult_ (calculateBusinessOpportunityGiftTaxJS) + "일감떼어주기" 입력칸(jt…)
 *        + shareholdingRows_.jt, 🧮 부문별 매출·비용 내역 jtSegmentYears_ — jtPrintFormPageHtml_·jtAttach1~4PrintPageHtml_ 과 같은 값
 *   수증자는 이 탭들에 입력칸이 없어 지금 인쇄처럼 일반 탭 giftDonees[0]을 쓴다.
 *
 * ── 어디서 찍나 ──
 *   두 신고서는 일반 증여(10호)와 따로 내는 신고서라 세목 "원본 모양 출력" 묶음(plan)에는 넣지 않고,
 *   세액인쇄 서식표의 그 서식 줄(📄 원본 모양)로 찍는다(ctxFor·ready — 준비 조건은 지금 인쇄 함수와 같음).
 *   ※ 지금 세액인쇄 서식표(PRINT_REGISTRY_ jm·jt)에는 subForms가 없어 본표 줄 하나만 있다 — 부표 줄은 서식표에 subForms가
 *     생기면 이 forms의 서식번호로 바로 이어진다(보고서 _보고_증여특례B.md "남은 일").
 *
 * ── 직접·간접 나누기 ── 엔진은 직접+간접 합친 주식보유비율 하나로 계산한다(법 §45의3② "각각 계산한 금액을 합산"과 배당공제 전 합계는 같음).
 *   서식(10호의3 본표 ⑱~㉒ 직접·간접 줄, 부표5 ⑰~㉓)은 나눠 적으므로, 🧮 주주별 보유 내역에 수증자 줄이 있고
 *   (직접 + 셈하는 간접) = 화면 주식보유비율일 때만 부표5 작성방법(한계보유비율을 간접에서 먼저 뺌)대로 나눈다. 아니면 계 칸만 찍는다.
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
    '증여10호의3': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식]", // 증여세과세표준신고 및 자진납부계산서(특수관계법인과의 거래를 통한 증여의제이익 신고용)
    '증여10호의3부표1': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표1]", // 수증자 등 및 과세가액 계산명세서(Ⅰ)
    '증여10호의3부표2': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표2]", // 나-1. 수혜법인 지배주주 판정을 위한 간접보유비율 산정
    '증여10호의3부표3': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표3]", // 다-1. 수증자 간접보유비율(간접출자법인 해당여부 및 간접보유비율)
    '증여10호의3부표4': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표4]", // 라-1. 지배주주 등과 특수관계법인(증여자 등)
    '증여10호의3부표5': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표5]", // 수증자 등 및 과세가액 계산명세서(Ⅱ)
    '증여10호의4': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식]", // 증여세과세표준신고 및 자진납부계산서(특수관계법인으로부터 제공받은 사업기회로 발생한 증여의제이익 신고용)
    '증여10호의4부표1': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식 부표1]", // 수증자 등 및 과세가액 계산명세서(A)
    '증여10호의4부표2': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식 부표2]", // 수증자 등 및 과세가액 계산명세서(A-1)(수증자 간접보유비율)
    '증여10호의4부표3': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식 부표3]", // 수증자 등 및 과세가액 계산명세서(B)
    '증여10호의4부표4': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식 부표4]", // 수증자 및 과세가액 계산명세서(B-1)(수혜법인의 부문별 영업이익 명세서)
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // ───────── 공용 ─────────
  // 신고구분: 서식 보기 글자([ ]확정신고 [ ]수정신고 [ ]기한후신고). 화면에서 고른 ctx.신고구분, 없으면 그 탭의 신고 상태
  var FILING = { ontime: '확정신고', underreported: '수정신고', unreported: '기한후신고' };
  function filing(o, ctx) {
    var k = ctx.신고구분, v = null;
    if (has(k)) v = /수정/.test(k) ? '수정신고' : /기한\s*후/.test(k) ? '기한후신고' : /기한\s*내|확정/.test(k) ? '확정신고' : null;
    if (!v) v = FILING[(ctx.in || {}).filingStatus || 'ontime'];
    o.set('신고구분', v);
    if (!has(k)) o.note('신고구분은 그 탭의 신고 상태(정상→확정신고, 과소신고→수정신고, 무신고→기한후신고)에서 옮김');
  }
  var SIZE = { general: '일반', medium: '중견', small: '중소' };
  // 본표 머리 ②~⑯
  function head(o, ctx) {
    var dn = ctx.donee || {}, ta = ctx.taxAgent || {}, I = ctx.in || {};
    o.need('②', dn.name, '② 수증자 성명').need('③', dn.regNo, '③ 수증자 주민등록번호');
    if (has(dn.email)) o.set('④', dn.email); else o.miss('④ 전자우편주소', '화면 입력 없음');
    o.need('⑤@주소', H.fullAddr(dn), '⑤ 수증자 주소');
    if (has(dn.phone)) o.set('⑤@전화번호', dn.phone); else o.miss('⑤ 수증자 전화번호', '화면 입력 없음');
    var rp = ctx.relatedParties || [];
    if (rp.length) {
      var top = rp.slice().sort(function (a, b) { return n(b.sales) - n(a.sales); })[0];
      o.set('⑥', (top.label || '(이름 없음)') + (rp.length > 1 ? ' 외 ' + (rp.length - 1) : ''));
      o.note('⑥ = 🧮 특수관계법인 매출 합산 표에서 매출액이 가장 큰 법인을 대표법인으로 "대표법인 외 ○"(작성방법 2)');
    } else o.miss('⑥ 증여자(특수관계법인) 법인명', ctx.kind === 'jt' ? '계산기에 없음 — 일감떼어주기 탭에 사업기회 제공 법인 칸이 없음' : '계산기에 없음 — 🧮 특수관계법인 매출 합산 표가 비어 있음');
    o.miss('⑦ 증여자 사업자등록번호', '계산기에 없음').miss('⑧ 증여자 소재지·전화번호', '계산기에 없음');
    o.miss('⑨ 수혜법인 법인명', '계산기에 없음').miss('⑩ 수혜법인 사업자등록번호', '계산기에 없음');
    if (SIZE[I.companySize]) {
      o.set('⑪', SIZE[I.companySize]);
      if (I.companySize === 'general') o.note('⑪ 법인구분: 화면 기업규모 "일반" — 상호출자제한기업집단이면 "상호"에 표시해야 함(계산기에 그 구분 없음, 계산은 일반과 같음)');
    } else o.miss('⑪ 법인구분', ctx.kind === 'jt' ? '계산기에 없음 — 일감떼어주기 탭에 기업규모 칸이 없음' : '화면 입력 없음(기업규모)');
    if (has(ta.name)) {
      o.set('⑫', ta.name);
      if (has(ta.bizNo)) o.set('⑬', ta.bizNo); else o.miss('⑬ 세무대리인 사업자등록번호', '화면 입력 없음');
      if (has(ta.mgmtNo)) { o.set('⑭', ta.mgmtNo); o.miss('⑮ 세무대리인 생년월일', '관리번호가 있어 적지 않음(작성방법 7)'); }
      else { o.miss('⑭ 세무대리인 관리번호', '화면 입력 없음'); o.miss('⑮ 세무대리인 생년월일', '계산기에 없음'); }
      if (has(ta.phone)) o.set('⑯', ta.phone); else o.miss('⑯ 세무대리인 전화번호', '화면 입력 없음');
    } else o.miss('⑫⑬⑭⑮⑯ 세무대리인', '세무대리인 입력 없음(본인 신고)');
  }
  function sign(o, ctx) {
    var dn = ctx.donee || {}, ta = ctx.taxAgent || {};
    var d = H.ymd(ctx.신고일);
    if (d) o.set('신고일.연', d.y).set('신고일.월', d.m).set('신고일.일', d.d); else o.miss('신고일', 'ctx.신고일 없음(계산기에 없음)');
    o.need('신고인서명', dn.name, '신고인(서명)');
    if (has(ta.name)) { o.set('세무대리인서명', ta.name); if (has(ta.phone)) o.set('세무대리인전화', ta.phone); else o.miss('세무대리인 전화번호', '화면 입력 없음'); }
    else o.miss('세무대리인(서명)·세무대리인 전화번호', '세무대리인 입력 없음(본인 신고)');
    if (has(dn.taxOffice)) o.set('세무서', H.officeName(dn.taxOffice)); else o.miss('세무서', '수증자 관할 세무서 입력 없음');
  }
  // 증여세 누진공제(서식 작성방법 세율표) — ㉖ 산출세액 검산
  function progressive(base) {
    var b = Math.max(0, n(base));
    return b <= 1e8 ? b * 0.1 : b <= 5e8 ? b * 0.2 - 1e7 : b <= 1e9 ? b * 0.3 - 6e7 : b <= 3e9 ? b * 0.4 - 1.6e8 : b * 0.5 - 4.6e8;
  }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function gtxt(x) { return has(x) ? String(x) : ''; }

  // 일감몰아주기 계산식의 차감률(엔진 calculateRelatedPartyTransactionGiftTaxJS와 같은 값 — 법 §45의3①2호)
  var JM_SUB = { general: { trade: 5, share: 0 }, medium: { trade: 20, share: 5 }, small: { trade: 50, share: 10 } };
  // 수증자의 직접·간접 나누기(부표5 ⑰~㉑ 작성방법: 한계보유비율 차감은 간접보유비율에서 먼저)
  //   → { row, direct, indirect, d20, i21 } 또는 { why }
  function jmSplit(ctx) {
    var I = ctx.in || {}, dn = ctx.donee || {}, sub = (JM_SUB[I.companySize] || {}).share;
    if (sub === undefined) return { why: '기업규모 입력 없음' };
    var rows = (ctx.shareholders || []).filter(function (s) { return has(s.name) && s.name === dn.name; }), row = rows[0];
    if (!row) return { why: '🧮 주주별 직접·간접보유 내역에 수증자(' + (dn.name || '이름 없음') + ') 줄이 없음' };
    // [2026.10.20 서식 감사] 같은 성명 줄은 합산 — 간접출자관계가 둘 이상이면 수증자 줄이 여럿(화면 J29가 같은 성명 행을 합해 주식보유비율을 만듦,
    //  부표5 작성방법 12 "간접출자관계가 둘 이상이면 따로"). 예전엔 첫 줄만 봐서 비율이 화면과 달라 직접·간접 줄을 통째로 비웠음
    var direct = rows.reduce(function (a, s) { return a + n(s.directRatio); }, 0), indirect = rows.reduce(function (a, s) { return a + n(s.indirect); }, 0);
    if (Math.abs(r4(direct + indirect) - r4(n(I.shareRatio))) > 0.0001) return { why: '주주별 보유 내역의 수증자 비율 합(' + r4(direct + indirect) + '%)이 화면 주식보유비율(' + n(I.shareRatio) + '%)과 다름' };
    var i21 = Math.max(0, indirect - sub), d20 = direct - Math.max(0, sub - indirect);
    return { row: row, direct: direct, indirect: indirect, d20: Math.max(0, d20), i21: i21, sub: sub };
  }

  // 엔진 출자관계별(calculateRelatedPartyTransactionGiftTaxJS — 화면 출자관계별 표 jmRelations_가 있을 때만, 시행령 §34의3⑬·⑮)
  //   → { all, d:[직접], i:[간접…] } 또는 null
  function relRowsOf(r) {
    var L = (r && Array.isArray(r.출자관계별)) ? r.출자관계별 : [];
    if (!L.length) return null;
    return { all: L, d: L.filter(function (x) { return x.출자관계 === '직접'; }), i: L.filter(function (x) { return x.출자관계 !== '직접'; }) };
  }

  // ───────── 상증 별지 제10호의3서식 본표 — 특수관계법인과의 거래를 통한 증여의제이익(법 §45의3) ─────────
  //  값 출처: lastRelatedPartyGiftResult_ + jm 입력칸(지금 인쇄 jmPrintFormPageHtml_와 같은 값)
  //  ⑰ 증여일 = 화면 "수혜법인 사업연도 종료일"(작성방법 8, 법 §45의3③ — 사업연도 종료일을 증여시기로 봄)
  mappers['증여10호의3'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, I = ctx.in || {};
    filing(o, ctx);
    head(o, ctx);
    if (has(I.fiscalYearEnd)) o.set('⑰', I.fiscalYearEnd); else o.miss('⑰ 증여일', '화면 입력 없음(수혜법인 사업연도 종료일)');
    if (!r.과세대상여부) {
      o.miss('⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝ 증여재산가액·세액', '엔진: 과세대상 아님 — ' + (r.안내 || '계산 결과 없음'));
      sign(o, ctx);
      return o.result();
    }
    var sub = JM_SUB[I.companySize] || { trade: 0, share: 0 };
    var income = n(r.적용소득금액), trade = Math.max(0, n(I.tradeRatio) - sub.trade), div = n(r.배당소득공제), gift = n(r.증여의제이익);
    var sp = jmSplit(ctx), RR = relRowsOf(r);
    if (RR) {
      // [2026.10.20 서식 감사] 화면 출자관계별 표가 있으면 엔진이 관계마다 한계보유비율 차감·배당소득 공제·0 바닥을 계산(결과 출자관계별) — 그 값을 그대로.
      //  작성방법 9: ㉑ = 부표5 ㉘(직접)·㉟(간접), ㉒ = 부표5 ㊲·㊳ · 시행령 §34의3⑬·⑮
      [['직접', RR.d], ['간접', RR.i]].forEach(function (w) {
        var L = w[1], s = function (k) { return L.reduce(function (a, x) { return a + n(x[k]); }, 0); };
        if (!L.length) { o.miss('⑱⑲⑳㉑㉒ ' + w[0] + ' 줄', '해당 없음 — 엔진 출자관계별에 ' + w[0] + '보유 관계 없음'); return; }
        o.set('⑱@' + w[0], income).set('⑲@' + w[0], r4(trade)).set('⑳@' + w[0], r4(s('한계보유비율_차감후')))
          .set('㉑@' + w[0], s('배당소득공제')).set('㉒@' + w[0], s('과세가액'));
      });
      if (RR.i.length > 1) o.note('⚠ 간접출자관계 ' + RR.i.length + '개 — 간접 줄은 관계 합계. 관계별 금액은 부표5(작성방법 12)');
      o.check('㉒ 계 = ㉒ 직접 + ㉒ 간접(엔진 출자관계별 과세가액 합)', gift, RR.all.reduce(function (a, x) { return a + n(x.과세가액); }, 0));
    } else if (sp.why) {
      o.miss('⑱⑲⑳㉑㉒ 직접·간접 줄', '직접·간접 나눈 값이 계산기에 없음 — ' + sp.why + '. 엔진은 합친 비율로 계산: ⑱ ' + income + '원, ⑲ ' + r4(trade) + '%, ⑳ ' + r4(Math.max(0, n(I.shareRatio) - sub.share)) + '%, ㉑ ' + div + '원');
      o.note('⚠ 직접·간접 줄은 비우고 ㉒ 계만 찍음 — 서식은 수증자의 직접보유분·간접보유분을 나눠 적음(작성방법 9)');
    } else {
      [['직접', sp.d20, sp.direct], ['간접', sp.i21, sp.indirect]].forEach(function (w) {
        if (!w[2]) { o.miss('⑱⑲⑳㉑㉒ ' + w[0] + ' 줄', '해당 없음 — 수증자의 ' + w[0] + '보유비율 0%'); return; }
        o.set('⑱@' + w[0], income).set('⑲@' + w[0], r4(trade)).set('⑳@' + w[0], r4(w[1]));
      });
      var gD = Math.round(income * trade / 100 * sp.d20 / 100), gI = Math.round(income * trade / 100 * sp.i21 / 100);
      if (!div || !sp.indirect) {
        if (sp.direct) o.set('㉑@직접', div).set('㉒@직접', Math.max(0, gD - div));
        if (sp.indirect) o.set('㉑@간접', 0).set('㉒@간접', gI);
        o.check('㉒ 계 = ㉒ 직접 + ㉒ 간접', gift, Math.max(0, gD - (sp.direct ? div : 0)) + gI);
      } else o.miss('㉑㉒ 직접·간접 줄', '배당소득공제(' + div + '원)를 직접보유분·간접보유분으로 나눈 값이 계산기에 없음(부표5 ㉘·㉟) — ㉒ 계만 찍음');
      o.note('⑳ 직접 ' + r4(sp.d20) + '% · 간접 ' + r4(sp.i21) + '% = 수증자 직접 ' + r4(sp.direct) + '% · 간접 ' + r4(sp.indirect) + '%에서 한계보유비율 차감 ' + sp.sub + '%p를 간접부터 뺌(부표5 ⑲ 작성방법)');
    }
    o.set('㉒@계', gift);
    // 출자관계별 계산이면 관계마다 원 단위로 반올림·0 바닥이라 합친 비율 식과 1원씩 다를 수 있어 위 관계별 검산만 씀
    if (!RR) o.check('㉒ 계 = ⑱ × ⑲ × ⑳(합친 비율) − ㉑', gift, Math.max(0, Math.round(income * trade / 100 * Math.max(0, n(I.shareRatio) - sub.share) / 100) - div));
    var base = n(r.과세표준), calc = n(r.산출세액), credit = n(r.신고세액공제), pen = n(r.무신고가산세) + n(r.과소신고가산세), late = n(r.납부지연가산세), pay = n(r.납부세액);
    o.set('㉓', gift).set('㉔', base).set('㉕', H.giftInheritRate(base)).set('㉖', calc).set('㉗', credit).set('㉘', pen).set('㉙', late).set('㉚', pay);
    o.check('㉖ = ㉔ × ㉕ − 누진공제', calc, Math.floor(progressive(base)));
    o.check('㉚ = ㉖ − ㉗ + ㉘ + ㉙', pay, Math.max(0, calc - credit + pen + late));
    o.miss('㉛ 연부연납·㉜ 분납(금액·납부 및 신청일자)', '계산기에 없음(일감몰아주기 탭에 연부연납·분납 계산 없음)');
    o.set('㉝@금액', pay);
    o.note('㉝ 신고납부 = ㉚(연부연납·분납 없음으로 봄 — 신청하면 ㉝ = ㉚ − ㉛ − ㉜로 고칠 것)');
    o.miss('㉝ 납부 및 신청일자', '계산기에 없음');
    if (I.companySize === 'general' && n(I.tradeRatio) <= 30) o.note('과세요건: 일반기업 거래비율 30% 이하인데 과세됨 — 특수관계법인 매출액 1천억원 초과 대체요건(법 §45의3①1호나목2)으로 판정');
    sign(o, ctx);
    return o.result();
  };

  // 한계보유비율(수증자 요건 — 부표1 ㉓, 엔진 gateShareThreshold) · 정상거래비율(과세요건 — 부표1 ㉛, 엔진 gateTradeThreshold)
  function jmShareLimit(size) { return size === 'general' ? 3 : 10; }
  function jmTradeGate(size) { return size === 'general' ? 30 : size === 'medium' ? 40 : 50; }
  // 지배주주를 첫 줄로(관계 칸에 "지배주주"·"본인"이 있는 주주) — 없으면 입력 순서 그대로
  function ownerFirst(list) {
    var i = -1;
    list.some(function (s, k) { if (/지배주주/.test(s.relation || '')) { i = k; return true; } return false; });
    if (i < 0) list.some(function (s, k) { if (/^\s*본인/.test(s.relation || '')) { i = k; return true; } return false; });
    if (i <= 0) return { list: list, found: i === 0 };
    return { list: [list[i]].concat(list.slice(0, i), list.slice(i + 1)), found: true };
  }
  function fyText(d) { var x = H.ymd(d); return x ? '~ ' + x.y + '.' + ('0' + x.m).slice(-2) + '.' + ('0' + x.d).slice(-2) : ''; }

  // [2026.10.20 서식 감사] 부표1 가. ㉠ 최대주주등(⑥~⑩)·㉡ 간접보유비율(⑪~⑯)·㉢ 지배주주 — 10호의3·10호의4 부표1 공용
  //  ㉠: 🧮 주주별 보유 내역의 개인(직접보유비율 있는 줄 — 같은 성명은 합산) + 출자 고리의 수혜법인 법인주주(지분율 = "수혜법인 출자비율")
  //  ⑩: 그 가운데 ⑨가 가장 큰 주주(작성방법 3) — 예전엔 개인만 봐서 법인주주가 더 커도 개인에 ○
  //  ㉡: ⑩이 법인이고 그 법인을 거치는 고리가 1단계뿐이면 여기, 아니면 부표2(작성방법 4~7, ⑯ = ⑫ × ⑮)
  //  ㉢: 시행령 §34의3①(§34의4가 준용) — 1호: 최대주주등 중 직접보유비율이 가장 큰 자가 개인이면 그 개인,
  //      2호: 가장 큰 자가 법인이면 직접보유비율 + 간접보유비율이 가장 큰 개인(작성방법 8)
  function topHolderCells(o, sh, k22) {
    var per = {}, order = [];
    sh.forEach(function (s) { if (!has(s.name)) return; if (!per[s.name]) { per[s.name] = { name: s.name, relation: s.relation, d: 0, i: 0 }; order.push(s.name); } per[s.name].d += n(s.directRatio); per[s.name].i += n(s.indirectRaw); });
    var G0 = chainGroups(sh), corps = G0.a.filter(function (g) { return g.ratio > 0; }).map(function (g) { return { name: g.name, relation: '법인주주(🧮 출자 고리)', d: g.ratio, corp: g }; });
    var dir = order.map(function (k) { return per[k]; }).filter(function (s) { return s.d > 0; }).concat(corps);
    var mx = dir.length ? Math.max.apply(null, dir.map(function (s) { return s.d; })) : 0;
    var topCorp = corps.filter(function (c) { return c.d === mx; })[0];
    if (dir.length) {
      o.set('⑥', dir.map(function (s) { return s.name; })).set('⑧', dir.map(function (s) { return s.relation; })).set('⑨', dir.map(function (s) { return r4(s.d); }))
        .set('⑩', dir.map(function (s) { return s.d === mx ? '○' : ''; })).set('⑨@계', r4(dir.reduce(function (a, s) { return a + s.d; }, 0)));
      o.note('㉠ ⑥~⑩은 🧮 주주별 직접·간접보유 내역에 넣은 주주(같은 성명 합산)' + (corps.length ? '와 출자 고리의 수혜법인 법인주주(지분율 = 🧮 "수혜법인 출자비율") — 법인주주가 최대주주와 특수관계(시행령 §2의2①)인지 확인' : '만') +
        ' — 최대주주등의 다른 주주는 계산기에 없음. ⑩은 그 가운데 ⑨가 가장 큰 주주(작성방법 3)');
    } else o.miss('⑥⑧⑨⑩ ㉠ 최대주주등', '계산기에 없음 — 🧮 주주별 직접·간접보유 내역에 직접보유비율이 있는 주주가 없음');
    o.miss('⑦ 주민등록번호(사업자등록번호)', '계산기에 없음').miss('㉠비고', '계산기에 없음');
    if (topCorp && !G0.b.some(function (b) { return topCorp.corp.holders.some(function (h) { return h.name === b.name; }); })) {
      var hs = topCorp.corp.holders;
      o.set('⑪@법인명', topCorp.name).set('⑫', r4(topCorp.d)).set('⑬', hs.map(function (h) { return h.name; }))
        .set('⑮', hs.map(function (h) { return r4(h.ratio); })).set('⑯', hs.map(function (h) { return h.ind === null ? '' : h.ind; }));
      o.miss('⑪ 사업자등록번호·⑭ 주민등록번호', '계산기에 없음');
    } else o.miss('⑪⑫⑬⑭⑮⑯ ㉡ 간접보유비율', topCorp ? '⑩ 법인을 거치는 고리가 2단계 이상 — 부표2에 적음(작성방법 4)' : '해당 없음 — 최대주주가 개인(🧮 입력 기준)');
    var cand = order.map(function (k) { return per[k]; }), key = function (s) { return s.d + (topCorp ? s.i : 0); };
    if (cand.length) {
      o.set(k22, cand.slice().sort(function (a, b) { return key(b) - key(a); })[0].name);
      o.note('㉢ 지배주주 = 🧮 주주별 보유 내역 가운데 ' + (topCorp ? '직접 + 간접(고리 지분율을 곱한 값, 요건 거르기 전)' : '직접') + '보유비율이 가장 큰 개인(시행령 §34의3①' + (topCorp ? '2호' : '1호') + ') — 넣지 않은 주주가 있거나 같은 비율이면 확인');
    } else o.miss('㉢ 지배주주', '계산기에 없음 — 🧮 주주별 보유 내역이 비어 있음');
  }

  // ───────── 10호의3 부표1 — 수증자 등 및 과세가액 계산명세서(Ⅰ) ─────────
  //  값 출처: 🧮 주주별 직접·간접보유 내역(shareholdingRows_.jm — jmAttach1PrintPageHtml_와 같은 표), 🧮 특수관계법인 매출 합산, jm 입력칸
  //  ㉡·㉢(최대주주가 법인일 때의 지배주주 판정)은 계산기가 하지 않음(엔진 안내 "지배주주 판정 … 별도로 확인").
  mappers['증여10호의3부표1'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, I = ctx.in || {};
    o.miss('① 수혜법인 법인명', '계산기에 없음').miss('② 수혜법인 사업자등록번호', '계산기에 없음').miss('③ 수혜법인 소재지', '계산기에 없음');
    if (has(I.fiscalYearEnd)) { o.set('④', fyText(I.fiscalYearEnd)); o.note('④ 사업연도는 종료일만(화면 "수혜법인 사업연도 종료일") — 시작일은 계산기에 없어 비움'); }
    else o.miss('④ 사업연도', '화면 입력 없음(수혜법인 사업연도 종료일)');
    if (SIZE[I.companySize]) o.set('⑤', SIZE[I.companySize]); else o.miss('⑤ 법인구분', '화면 입력 없음(기업규모)');
    var sh = ctx.shareholders || [];
    topHolderCells(o, sh, '㉢');
    // 다. 지배주주와 그 친족(수증자 요건)
    var lim = jmShareLimit(I.companySize);
    if (sh.length) {
      var of = ownerFirst(sh.slice()), L2 = of.list;
      if (!of.found) o.note('⚠ 다. 첫 줄은 지배주주 자리 — 🧮 주주별 보유 내역의 관계 칸에 "지배주주"·"본인"이 없어 입력 순서대로 적음(첫 주주가 지배주주가 아니면 고칠 것)');
      o.set('⑰', L2.map(function (s) { return s.name; }));
      o.set('⑲', L2.map(function (s, k) { return k === 0 ? '' : s.relation; }));
      o.set('⑳', L2.map(function (s) { return r4(n(s.directRatio)); })).set('㉑', L2.map(function (s) { return r4(n(s.indirect)); }))
        .set('㉒', L2.map(function (s) { return r4(n(s.directRatio) + n(s.indirect)); }))
        .set('㉓', L2.map(function (s) { return n(s.directRatio) + n(s.indirect) > lim ? '○' : ''; }));
      o.note('다. ㉑ 간접 지분율 = 🧮 도구가 셈하는 간접보유비율(간접출자법인 요건·0.1% 미만 제외 반영 — 부표3 ㉕와 같음), ㉓ = ㉒가 한계보유비율 ' + lim + '% 초과');
      // 수증자 줄이 여럿(간접출자관계가 둘 이상)이면 합산 — 화면 J29가 같은 성명 행을 합해 주식보유비율을 만듦
      var dn = (ctx.donee || {}).name, me = L2.filter(function (s) { return s.name === dn; });
      if (me.length) o.check('수증자 ㉒ 지분율 합계 = 화면 주식보유비율(엔진 입력)', Math.round(me.reduce(function (a, s) { return a + n(s.directRatio) + n(s.indirect); }, 0) * 10000), Math.round(n(I.shareRatio) * 10000));
    } else o.miss('⑰⑲⑳㉑㉒㉓ 다. 지배주주와 친족', '계산기에 없음 — 🧮 주주별 직접·간접보유 내역이 비어 있음');
    o.miss('⑱ 주민등록번호', '계산기에 없음');
    // 라. 특수관계법인
    var rp = ctx.relatedParties || [];
    if (rp.length) o.set('㉔', rp.slice().sort(function (a, b) { return n(b.sales) - n(a.sales); })[0].label);
    else o.miss('㉔ 대표 증여자 법인명', '계산기에 없음 — 🧮 특수관계법인 매출 합산 표가 비어 있음');
    o.miss('㉕ 대표 증여자 사업자등록번호', '계산기에 없음').miss('㉖ 유형', '계산기에 없음')
      .miss('㉗ 수혜법인의 매출액(라-1 ④ 소계)', '계산기에 없음 — 매출 합산 도구는 과세제외를 뺀 뒤 매출액만 받음(④ 아님)')
      .miss('㉘ 제외매출액', '계산기에 없음');
    if (n(ctx.totalSales) > 0) o.set('㉙', n(ctx.excludedSales)); else o.miss('㉙ 과세제외매출액', '계산기에 없음 — 🧮 특수관계법인 매출 합산을 쓰지 않음');
    if (has(I.tradeRatio)) o.set('㉚', r4(n(I.tradeRatio))); else o.miss('㉚ 특수관계법인거래비율', '화면 입력 없음');
    var gate = jmTradeGate(I.companySize);
    var alt = I.companySize === 'general' && n(I.tradeRatio) > gate * 2 / 3 && n(I.relatedPartySales) > 1e11;
    if (n(I.tradeRatio) > gate || alt) o.set('㉛', '○');
    else o.miss('㉛ 과세요건 해당 여부', '해당 안 됨 — 거래비율 ' + n(I.tradeRatio) + '% ≤ ' + gate + '%');
    if (alt && n(I.tradeRatio) <= gate) o.note('㉛: 일반기업 대체요건(거래비율 > 20%이고 특수관계법인 매출액 1천억원 초과 — 법 §45의3①1호나목2)으로 해당');
    if (r && has(r.과세대상여부) && !!r.과세대상여부 !== (n(I.tradeRatio) > gate || alt) && r.과세대상여부) o.note('⚠ 엔진 과세대상 판정과 ㉛이 다름 — 확인할 것');
    return o.result();
  };

  // ───────── 출자 고리 → 서식 단계(ⓐ 수혜법인에 출자한 법인 → ⓑ 그 법인에 출자한 2차법인) ─────────
  //  🧮 도구의 한 줄 = 주주 → 1차 출자법인(chain1Ratio) → [2차 출자법인(chain2Ratio)] → 수혜법인(chain3Ratio, "수혜법인 직전 출자법인")
  //  간접보유비율 = 입력한 단계 지분율을 모두 곱함(taxcalc.html shareholdingIndirectRatio_와 같은 식)
  //  1단계(2차 없음): ⓐ = 직전 출자법인(없으면 1차), ⓐ의 주주 = 그 사람(지분율 chain1Ratio)
  //  2단계: ⓐ = 직전 출자법인(없으면 2차), ⓐ의 주주 = 1차 출자법인(지분율 chain2Ratio) / ⓑ = 1차 출자법인, ⓑ의 주주 = 그 사람(chain1Ratio)
  function chainGroups(list) {
    var A = [], Bk = [], idx = {};
    function grp(arr, tag, name, ratio) {
      var key = tag + '|' + name;
      if (!idx[key]) { idx[key] = { name: name, ratio: ratio, holders: [] }; arr.push(idx[key]); }
      return idx[key];
    }
    list.forEach(function (s) {
      if (!(n(s.chain1Ratio) > 0 || has(s.chain1Company))) return;
      var two = n(s.chain2Ratio) > 0 || has(s.chain2Company);
      var r3 = n(s.chain3Ratio);
      if (!two) {
        var a = grp(A, 'a', s.chain3Company || s.chain1Company || '(법인명 없음)', r3);
        a.holders.push({ name: s.name, ratio: n(s.chain1Ratio), ind: r3 ? r4(r3 * n(s.chain1Ratio) / 100) : null });
      } else {
        var a2 = grp(A, 'a', s.chain3Company || s.chain2Company || '(법인명 없음)', r3);
        var c1 = s.chain1Company || '(법인명 없음)';
        if (!a2.holders.some(function (h) { return h.name === c1; })) a2.holders.push({ name: c1, ratio: n(s.chain2Ratio), ind: r3 ? r4(r3 * n(s.chain2Ratio) / 100) : null });
        var b = grp(Bk, 'b|' + a2.name, c1, n(s.chain2Ratio));
        b.parentRatio = r3;
        b.holders.push({ name: s.name, ratio: n(s.chain1Ratio), ind: r3 ? r4(r3 * n(s.chain2Ratio) / 100 * n(s.chain1Ratio) / 100) : null });
      }
    });
    return { a: A, b: Bk };
  }
  // 단계 표에 찍기: k = [법인칸, 지분율칸, 주주명칸, 주민칸, 지분율칸, 간접칸], cap = 법인마다 줄 수
  function chainCells(o, k, groups, cap, 단계) {
    for (var j = groups.length; j < cap.length; j++) o.miss(k.join('') + ' ' + 단계 + ' ' + (j + 1) + '번째 법인', '해당 없음(출자 고리의 법인 ' + groups.length + '개)');
    groups.forEach(function (g, i) {
      var c = '@법인' + (i + 1);
      o.set(k[0] + c + '.법인명', g.name);
      if (g.ratio) o.set(k[1] + c, r4(g.ratio)); else o.miss(k[1] + ' ' + 단계 + ' 지분율', '화면 입력 없음(🧮 도구 "수혜법인 출자비율")');
      if (g.holders.length > cap[i % cap.length]) o.note('⚠ ' + 단계 + ' ' + g.name + '의 주주가 ' + g.holders.length + '명 — 서식 줄(' + cap[i % cap.length] + ')을 넘는 주주는 이어 찍은 쪽에 나옴');
      o.set(k[2] + c, g.holders.map(function (h) { return h.name; })).set(k[4] + c, g.holders.map(function (h) { return r4(h.ratio); }));
      o.set(k[5] + c, g.holders.map(function (h) { return h.ind === null ? '' : h.ind; }));
    });
  }

  // ───────── 10호의3 부표2 — 나-1. 수혜법인 지배주주 판정을 위한 간접보유비율 산정 ─────────
  //  값 출처: 🧮 주주별 직접·간접보유 내역의 출자 고리(jmAttach2PrintPageHtml_와 같은 표 — 지금 인쇄는 한 줄에 단계를 이어 적음)
  //  이 부표는 지배주주 판정(최대주주가 법인일 때)용이라 간접출자법인의 다른 주주(작성방법 1·3)는 계산기에 없음
  mappers['증여10호의3부표2'] = function (ctx) {
    var o = new Out();
    var G = chainGroups(ctx.shareholders || []);
    if (!G.a.length) { o.miss('⑪~⑯ ㉠~㉫ 부표2 전체', '계산기에 없음 — 🧮 주주별 보유 내역에 출자 고리(1차 출자법인·지분율)가 없음'); return o.result(); }
    chainCells(o, ['⑪', '⑫', '⑬', '⑭', '⑮', '⑯'], G.a, [7, 7], 'ⓐ');
    if (G.b.length) {
      chainCells(o, ['㉠', '㉡', '㉢', '㉣', '㉤', '㉥'], G.b, [6, 6], 'ⓑ');
      o.note('ⓑ ㉡ = 2차법인(ⓑ)이 ⓐ에 가진 지분율(🧮 도구 "2차 지분율"), ㉥ = ⑫ × ㉡ × ㉤');
    } else o.miss('㉠㉡㉢㉣㉤㉥ ⓑ 2차법인', '해당 없음 — 출자 고리가 1단계뿐');
    o.miss('⑪ 사업자등록번호·⑭ 주민등록번호(ⓐ)', '계산기에 없음').miss('㉣ 주민등록번호(ⓑ)·㉠ 사업자등록번호', '계산기에 없음')
      .miss('㉦㉧㉨㉩㉪㉫ ⓒ 3차법인', '계산기에 없음 — 🧮 도구는 출자법인 2단계까지만 받음');
    if (G.a.length > 2 || G.b.length > 2) o.note('⚠ 법인이 2개를 넘음 — 셋째 법인부터는 이어 찍은 쪽에 나옴');
    o.note('⚠ 지배주주 판정용 부표(최대주주가 법인일 때 — 작성방법 ※) — 계산기는 지배주주를 판정하지 않아 🧮 주주별 보유 내역에 넣은 지배주주·친족의 출자 고리만 옮김. 간접출자법인의 다른 주주는 직접 적을 것');
    o.check('ⓐ ⑯ 합 + ⓑ ㉥ 합 = 🧮 도구 간접보유비율 합(요건 반영 전)', Math.round(G.a.reduce(function (s, g) { return s + g.holders.reduce(function (t, h) { return t + (G.b.some(function (b) { return b.name === h.name; }) ? 0 : n(h.ind)); }, 0); }, 0) * 1e4 +
      G.b.reduce(function (s, g) { return s + g.holders.reduce(function (t, h) { return t + n(h.ind); }, 0); }, 0) * 1e4),
      Math.round((ctx.shareholders || []).reduce(function (s, x) { return s + n(x.indirectRaw); }, 0) * 1e4));
    return o.result();
  };

  // ───────── 10호의3 부표3 — 다-1. 수증자 간접보유비율(간접출자법인 해당여부 및 간접보유비율) ─────────
  //  수혜법인의 법인주주(ⓐ)별로 한 장(작성방법 ※) — ctx.부표3법인 = 몇 번째 ⓐ 법인(0부터, ctxFor가 법인마다 장을 만듦)
  //  값 출처: 🧮 주주별 직접·간접보유 내역(jmAttach3PrintPageHtml_는 수증자 한 줄만 찍었음 — 서식 1.·2.는 지배주주·친족 모두)
  //  3. 판단은 🧮 도구의 "간접출자법인 요건 충족" 체크 하나뿐이라 ㉒(① 열)만, ⑲·⑳·㉑ 어느 요건인지는 계산기에 없음
  mappers['증여10호의3부표3'] = function (ctx) {
    var o = new Out(), sh = ctx.shareholders || [];
    var G = chainGroups(sh), k = n(ctx.부표3법인), a = G.a[k];
    if (!a) { o.miss('①~㉕ 부표3 전체', '계산기에 없음 — 🧮 주주별 보유 내역에 출자 고리가 없음'); return o.result(); }
    o.set('①@법인명', a.name).miss('① 사업자등록번호', '계산기에 없음');
    if (a.ratio) o.set('②', r4(a.ratio)); else o.miss('② 수혜법인 지분율', '화면 입력 없음(🧮 도구 "수혜법인 출자비율")');
    o.set('③', a.holders.map(function (h) { return h.name; })).set('⑤', a.holders.map(function (h) { return r4(h.ratio); }))
      .set('⑥', a.holders.map(function (h) { return h.ind === null ? '' : h.ind; })).miss('④ 주민등록번호(사업자등록번호)', '계산기에 없음');
    var b = G.b.filter(function (x) { return a.holders.some(function (h) { return h.name === x.name; }); });
    if (b.length) {
      o.set('⑦@법인명', b[0].name).set('⑧', r4(b[0].ratio)).miss('⑦ 사업자등록번호', '계산기에 없음')
        .set('⑨', b[0].holders.map(function (h) { return h.name; })).set('⑪', b[0].holders.map(function (h) { return r4(h.ratio); }))
        .set('⑫', b[0].holders.map(function (h) { return h.ind === null ? '' : h.ind; })).miss('⑩ 주민등록번호(사업자등록번호)', '계산기에 없음');
      if (b.length > 1) o.note('⚠ ①의 법인주주 가운데 2차 법인주주가 ' + b.length + '개 — 첫째(' + b[0].name + ')만 찍음, 나머지는 별지로 적을 것');
    } else o.miss('⑦⑧⑨⑩⑪⑫ 2차 법인주주', '해당 없음 — 출자 고리가 1단계뿐');
    o.miss('⑬⑭⑮⑯⑰⑱ 3차 법인주주', '계산기에 없음 — 🧮 도구는 출자법인 2단계까지만 받음');
    // 3. 간접출자법인 해당 여부
    var thru = sh.filter(function (s) { var g = chainGroups([s]); return g.a.length && g.a[0].name === a.name; });
    var q = thru.map(function (s) { return s.chainQualified !== false; });
    if (q.length && q.every(Boolean)) o.set('㉒@①', '○');
    else if (q.length && !q.some(Boolean)) o.set('㉒@①', '×');
    else o.miss('㉒ ① 열 판단', '🧮 도구의 "간접출자법인 요건 충족" 체크가 이 법인을 지나는 고리마다 다름');
    // [2026.10.20 서식 감사] ⑲(1호: 지배주주등 30% 이상 출자)·⑳(2호: 지배주주등 + 1호 법인 50% 이상) 근거 = 화면 자동 판정(shareholdingChainAutoQ_).
    //  자동 판정은 1차 출자법인 기준이라 고리가 1단계(1차 출자법인 = 이 ①법인)이고 사람이 체크칸을 건드리지 않았을 때만 ① 열에 찍음
    var one = thru.length && thru.every(function (s) { return !(n(s.chain2Ratio) > 0 || has(s.chain2Company)); });
    var aq = thru.map(function (s) { return s.chainAuto; });
    if (one && aq.length && aq.every(function (x) { return x && x.ok === true; }) && q.every(Boolean)) {
      o.set((/^1호/.test(aq[0].why) ? '⑲' : '⑳') + '@①', '○');
      o.note('⑲·⑳ ① 열 = 화면 자동 판정: ' + aq[0].why + ' — 입력한 주주 기준, 넣지 않은 친족 지분이 있으면 확인');
    } else o.miss('⑲⑳㉑ 판단 근거(○·×)', one ? '화면 자동 판정이 없음(사람이 요건 체크칸을 직접 고름) 또는 미충족' : '계산기에 없음 — 자동 판정은 1차 출자법인 기준이라 2단계 고리의 ①·⑦ 열 근거는 직접 적을 것');
    o.miss('㉒ ⑦·⑬·4차 열 판단', '계산기에 없음 — 요건 체크는 고리 하나에 하나');
    // 4. 지배주주 및 친족의 간접보유비율 합계(이 법인을 지나는 셈하는 간접보유비율)
    var per = {};
    thru.forEach(function (s) { per[s.name] = (per[s.name] || 0) + n(s.indirect); });
    var of = ownerFirst(sh.slice());
    var list = of.list.filter(function (s, i) { return (i === 0 && of.found) || per[s.name] !== undefined; });
    var seen = {}; list = list.filter(function (s) { if (seen[s.name]) return false; seen[s.name] = 1; return true; });
    if (!of.found) o.note('⚠ 4. 첫 줄은 지배주주 자리 — 🧮 주주별 보유 내역의 관계 칸에 "지배주주"·"본인"이 없어 고리가 있는 주주만 적음(지배주주를 첫 줄에 직접 적을 것)');
    o.set('㉓', list.map(function (s) { return s.name; })).set('㉔', list.map(function (s, i) { return i === 0 && of.found ? '' : s.relation; }))
      .set('㉕', list.map(function (s) { return r4(per[s.name] || 0); }));
    o.miss('㉓비고', '계산기에 없음');
    o.note('㉕ = 이 법인(' + a.name + ')을 지나는 셈하는 간접보유비율(🧮 도구 — 요건 미충족 고리·0.1% 미만은 0, 시행령 §34의3). 부표1 ㉑과 같음(법인주주가 하나일 때)');
    if (G.a.length > 1) o.note('수혜법인의 법인주주가 ' + G.a.length + '개 — 법인마다 한 장(이 장은 ' + (k + 1) + '번째: ' + a.name + ')');
    return o.result();
  };

  // ───────── 10호의3 부표4 — 라-1. 지배주주 등과 특수관계법인(증여자 등) ─────────
  //  값 출처: 🧮 특수관계법인 매출 합산(relatedPartyRatioRows_·jmRelatedPartyTotalSales_·jmRelatedPartyExcludedSales_ — jmAttach4PrintPageHtml_와 같은 값)
  //  도구는 법인마다 "과세제외를 뺀 매출액" 하나와 과세제외 합계만 받는다 → ⑨(조정후)·⑨ 소계·⑥ 소계·⑫·⑬만, ④~⑦ 법인별 금액은 계산기에 없음
  mappers['증여10호의3부표4'] = function (ctx) {
    var o = new Out(), I = ctx.in || {}, rp = ctx.relatedParties || [];
    if (!rp.length) { o.miss('①~⑯ 부표4 전체', '계산기에 없음 — 🧮 특수관계법인 매출 합산 표가 비어 있음'); return o.result(); }
    var sum = rp.reduce(function (s, x) { return s + n(x.sales); }, 0), tot = n(ctx.totalSales), ex = n(ctx.excludedSales);
    o.set('①', rp.map(function (x) { return x.label; })).set('⑨', rp.map(function (x) { return n(x.sales); }));
    o.miss('② 사업자등록번호', '계산기에 없음').miss('③ 특수관계 유형', '계산기에 없음').miss('⑧ 사유', '계산기에 없음')
      .miss('④ 매출액·⑤ (부칙)제외·⑥ 과세제외·⑦ 추가 과세제외(법인별)', '계산기에 없음 — 🧮 도구는 법인마다 과세제외를 뺀 매출액(⑨)만 받음');
    o.note('⑨ 조정후 매출액 = 🧮 도구의 "매출액(과세제외매출액 차감 후)" — ⑤·⑦을 뺐는지는 입력한 값에 따름');
    o.set('⑩@⑨', sum);
    if (tot > 0) o.set('⑩@⑥', ex); else o.miss('⑩ ⑥ 소계', '화면 입력 없음(🧮 도구 수혜법인 총매출액·과세제외 합계)');
    o.miss('⑩ ④·⑤·⑦ 소계', '계산기에 없음');
    o.set('⑪', rp.slice().sort(function (a, b) { return n(b.sales) - n(a.sales); })[0].label).miss('⑭ 대표증여자 사업자등록번호', '계산기에 없음');
    if (tot > 0) {
      o.set('⑫', tot);
      var ratio = (tot - ex) > 0 ? sum / (tot - ex) * 100 : 0;
      o.set('⑬', r4(ratio));
      o.note('⑬ = ⑨ 소계 ÷ (⑫ − ⑥ 소계) — 🧮 도구 식(jmRelatedPartyTradeRatioPct_)과 같음. 서식 식 (④ 소계 − ⑥ 소계) ÷ (⑫ − ⑥ 소계)와는 ⑤·⑦이 없을 때 같음');
      o.check('⑬ = 화면 특수관계법인거래비율(엔진 입력)', Math.round(ratio * 100), Math.round(n(I.tradeRatio) * 100));
    } else o.miss('⑫ 수혜법인의 총매출액·⑬ 거래비율(과세요건)', '화면 입력 없음(🧮 도구 수혜법인 총매출액)');
    o.miss('⑮ 과세매출비율', '계산기에 없음 — ⑦ 추가 과세제외 소계가 없음(세후영업이익은 화면에 직접 넣음)');
    // [2026.10.20 서식 감사] ⑯ = 엔진이 증여의제이익에 실제로 쓴 거래비율(화면 특수관계법인거래비율 — 부표5 ⑭와 같은 값, 부표4 작성방법 9·부표5 작성방법 9)
    if (has(I.tradeRatio)) { o.set('⑯', r4(n(I.tradeRatio))); o.note('⑯ = 엔진이 증여의제이익에 쓴 거래비율(화면 특수관계법인거래비율, 부표5 ⑭와 같음). 서식 식 (④−⑤−⑥−⑦ 소계) ÷ (⑫−⑥−⑦ 소계)는 ⑤·⑦이 있으면 ⑬과 달라짐 — 계산기는 비율 하나만 받으니 그때는 확인'); }
    else o.miss('⑯ 거래비율(증여의제이익)', '화면 입력 없음(특수관계법인거래비율)');
    return o.result();
  };

  // ───────── 10호의3 부표5 — 수증자 등 및 과세가액 계산명세서(Ⅱ) ─────────
  //  지금 인쇄에는 없던 부표(본표 "산출근거" 표가 대신했음). 값 출처: lastRelatedPartyGiftResult_ + jm 입력칸 + 🧮 주주별 보유 내역
  //  계산기는 ⑨ 세후영업이익·⑭ 거래비율·주식보유비율 합·배당소득공제 합을 결과값으로 받으므로 ①~⑧, ⑪~⑬, ㉕·㉖·㉚~㉞는 계산기에 없음
  mappers['증여10호의3부표5'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, I = ctx.in || {}, dn = ctx.donee || {};
    o.miss('①②③④⑤⑥⑦⑧ 세후 영업이익 계산', '계산기에 없음 — 화면에 ⑨ 세후영업이익을 바로 넣음');
    if (!r.과세대상여부) { o.miss('⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑳㉑㉒㉓㉕㉖㉗㉘㉚㉛㉜㉝㉞㉟㊲㊳㊴ 전부', '엔진: 과세대상 아님 — ' + (r.안내 || '계산 결과 없음')); return o.result(); }
    var sub = JM_SUB[I.companySize] || { trade: 0, share: 0 };
    var income = n(r.적용소득금액), trade = Math.max(0, n(I.tradeRatio) - sub.trade), div = n(r.배당소득공제), gift = n(r.증여의제이익);
    o.set('⑨', income);
    if (n(ctx.totalSales) > 0) o.set('⑩', n(ctx.totalSales)); else o.miss('⑩ 수혜법인 매출액', '화면 입력 없음(🧮 특수관계법인 매출 합산 — 수혜법인 총매출액)');
    o.miss('⑪ 특수관계법인 매출액·⑫ 제외매출액', '계산기에 없음 — 매출 합산 도구는 과세제외 차감 후 매출액과 과세제외(⑥) 합계만 받음(부표4)');
    // [2026.10.20 서식 감사] ⑬ = 부표4 ⑥ + ⑦의 ⑩ 소계 — ⑥ 소계(🧮 과세제외 합계)는 있음, ⑦ 추가 과세제외는 계산기에 없어 0(⑭ 거래비율도 같은 전제 — jmRelatedPartyTradeRatioPct_)
    if (n(ctx.totalSales) > 0) { o.set('⑬', n(ctx.excludedSales)); o.note('⑬ = 부표4 ⑥ 소계(🧮 과세제외 합계) — ⑦ 추가 과세제외는 계산기에 없어 0으로 봄(⑭도 같은 전제)'); }
    else o.miss('⑬ 과세제외매출액', '화면 입력 없음(🧮 특수관계법인 매출 합산)');
    o.set('⑭', r4(n(I.tradeRatio))).set('⑮', r4(trade));
    o.note('⑭ = 화면 특수관계법인거래비율(엔진 입력, 과세요건 판정에도 같은 값을 씀), ⑮ = ⑭ − ' + sub.trade + '%(' + (SIZE[I.companySize] || '') + ', 법 §45의3①2호)');
    o.check('⑮ = ⑭ − 정상거래비율 차감(엔진 증여의제이익_계산식차감비율_거래)', Math.round(trade * 1e4), Math.round(Math.max(0, n(I.tradeRatio) - n(r.증여의제이익_계산식차감비율_거래)) * 1e4));
    o.need('⑯', dn.name, '⑯ 주주명(수증자)');
    var sp = jmSplit(ctx), RR = relRowsOf(r);
    var pre = Math.round(income * trade / 100 * Math.max(0, n(I.shareRatio) - sub.share) / 100);
    if (RR) {
      // [2026.10.20 서식 감사] 화면 출자관계별 표가 있으면 엔진이 관계마다 계산(시행령 §34의3⑬·⑮) — ⑰⑳㉒㉕~㉘㊲(직접)·⑱㉑㉓㉚~㉟㊳(간접)을 그 값으로.
      //  산식: ㉘ = ㉕ × ㉒ ÷ (㉖ × ㉗), ㉟ = ㉚ × ㉓ ÷ {(㉛ + ㉜ × ㉝) × ㉞}, ㊲ = ㉒ − ㉘, ㊳ = ㉓ − ㉟(작성방법 15, 0 바닥)
      //  ㉖·㉛·㉜·㉝·㉞(배당가능이익·보유비율)은 엔진 결과에 없어 화면 표(ctx.relations)에서
      var REL = ctx.relations || [];
      var relOf = function (x) { return REL.filter(function (y) { return x.출자관계 === (y.kind === 'indirect' ? '간접(' + (y.corp || '간접출자법인') + ')' : '직접'); })[0] || {}; };
      var rD = RR.d[0], rI = RR.i, sI = function (k) { return rI.reduce(function (a, x) { return a + n(x[k]); }, 0); };
      if (rD) {
        o.set('⑰', r4(n(rD.보유비율))).set('⑳', r4(n(rD.한계보유비율_차감후))).set('㉒', n(rD.증여의제이익)).set('㊲', n(rD.과세가액));
        if (n(rD.배당소득)) o.set('㉕', n(rD.배당소득)).set('㉖', n(relOf(rD).distributable)).set('㉗', r4(n(rD.보유비율))).set('㉘', n(rD.배당소득공제));
        else o.miss('㉕㉖㉗㉘ 수혜법인의 배당 시', '해당 없음 — 직접 관계 배당소득 0');
      } else o.miss('⑰⑳㉒㉕~㉘㊲ 직접보유분', '해당 없음 — 엔진 출자관계별에 직접보유 관계 없음');
      if (rI.length) {
        var i0 = rI[0], y0 = relOf(i0);
        o.set('⑱', r4(sI('보유비율'))).set('⑱@계', r4(sI('보유비율'))).set('㉑', r4(sI('한계보유비율_차감후'))).set('㉑@계', r4(sI('한계보유비율_차감후')))
          .set('㉓', sI('증여의제이익')).set('㊳', sI('과세가액'));
        if (n(i0.배당소득)) o.set('㉚', n(i0.배당소득)).set('㉛', n(y0.distributable)).set('㉜', n(y0.beneficiaryDistributable)).set('㉝', r4(n(y0.corpShareInBeneficiary))).set('㉞', r4(n(y0.ownRatioInCorp))).set('㉟', n(i0.배당소득공제));
        else o.miss('㉚~㉟ 간접출자법인의 배당 시', '해당 없음 — 간접 관계 배당소득 0');
        if (rI.length > 1) o.note('⚠ 간접출자관계 ' + rI.length + '개 — ⑱·㉑·㉓·㊳은 합계, ㉚~㉟은 첫 관계(' + i0.출자관계 + ')만. 관계마다 따로 적을 것(작성방법 12)');
      } else o.miss('⑱㉑㉓㉚~㉟㊳ 간접보유분', '해당 없음 — 엔진 출자관계별에 간접보유 관계 없음');
      RR.all.forEach(function (x) { if (x.안내) o.note('⚠ ' + x.출자관계 + ': ' + x.안내); });
      o.check('㊴ = ㊲ + ㊳(엔진 출자관계별 과세가액 합)', gift, RR.all.reduce(function (a, x) { return a + n(x.과세가액); }, 0));
    } else if (sp.why) {
      o.miss('⑰⑱⑳㉑ 직접·간접 보유비율·㉒㉓·㊲㊳', '직접·간접 나눈 값이 계산기에 없음 — ' + sp.why + ' (화면 주식보유비율 ' + n(I.shareRatio) + '%는 직접+간접 합)');
    } else {
      o.set('⑰', r4(sp.direct)).set('⑱', r4(sp.indirect)).set('⑱@계', r4(sp.indirect)).set('⑳', r4(sp.d20)).set('㉑', r4(sp.i21)).set('㉑@계', r4(sp.i21));
      var gD = Math.round(income * trade / 100 * sp.d20 / 100), gI = Math.round(income * trade / 100 * sp.i21 / 100);
      o.set('㉒', gD).set('㉓', gI);
      o.check('㉒ + ㉓ = ⑨ × ⑮ × (주식보유비율 − 한계보유비율 차감) — 엔진 배당공제 전 증여의제이익', gD + gI, pre);
      o.note('⑳·㉑: 한계보유비율 차감 ' + sp.sub + '%p를 ⑱ 간접보유비율에서 먼저 빼고 남으면 ⑰에서(⑲ 작성방법)');
      if (!div) {
        o.miss('㉕㉖㉗㉘ ㉚㉛㉜㉝㉞㉟ 배당소득의 공제', '해당 없음 — 배당소득공제 0(화면 입력 없음)');
        o.set('㊲', gD).set('㊳', gI);
      } else if (!sp.indirect) {
        o.set('㉗', r4(sp.direct)).set('㉘', div).miss('㉕ 배당소득·㉖ 배당가능이익', '계산기에 없음 — 화면에 공제대상금액(배당소득공제)을 바로 넣음')
          .miss('㉚㉛㉜㉝㉞㉟ 간접출자법인의 배당 시', '해당 없음 — 간접보유비율 0');
        o.set('㊲', Math.max(0, gD - div)).set('㊳', 0);
      } else o.miss('㉕~㉟ 배당소득의 공제·㊲㊳', '배당소득공제(' + div + '원)를 직접·간접보유분으로 나눈 값이 계산기에 없음');
    }
    o.set('㊴', gift);
    if (!RR) o.check('㊴ = ⑨ × ⑮ × 보유비율 − 배당소득공제(엔진 증여의제이익)', gift, Math.max(0, pre - div)); // 출자관계별이면 위 관계별 검산(관계마다 0 바닥)
    return o.result();
  };

  // ───────── 일감떼어주기(법 §45의4) 공용 ─────────
  // 지배주주등(🧮 도구에 넣은 지배주주·친족 전부)의 직접·간접 합 — 도구 합계(직접 + 간접, 일감떼어주기는 고리를 모두 곱해 더함)가 화면 주식보유비율과 같을 때만
  function jtSplit(ctx) {
    var I = ctx.in || {}, sh = ctx.shareholders || [];
    if (!sh.length) return { why: '🧮 주주별 직접·간접보유 내역이 비어 있음' };
    var d = sh.reduce(function (a, s) { return a + n(s.directRatio); }, 0), i = sh.reduce(function (a, s) { return a + n(s.indirectRaw); }, 0);
    if (Math.abs(r4(d + i) - r4(n(I.shareRatio))) > 0.0001) return { why: '주주별 보유 내역의 합(' + r4(d + i) + '%)이 화면 주식보유비율(' + n(I.shareRatio) + '%)과 다름' };
    return { direct: d, indirect: i };
  }
  var JT_GROUP_NOTE = '⚠ 계산기는 화면 주식보유비율(🧮 도구 "지배주주+친족 합계")로 지배주주등 전체의 증여의제이익을 한 번에 계산함 — 서식은 수증자별로 작성(작성방법 ※·13: "신고하는 수증자 1인에 대한 비율과 금액"). 수증자가 여럿이면 금액을 나눠야 하는지 확인할 것(보고서 판단 대기)';

  // ───────── 상증 별지 제10호의4서식 본표 — 사업기회 제공 증여의제이익(법 §45의4) ─────────
  //  값 출처: lastBusinessOpportunityGiftResult_ + jt 입력칸(지금 인쇄 jtPrintFormPageHtml_와 같은 값)
  //  ⑰ 증여일 = 개시사업연도 종료일(작성방법 8, 법 §45의4①) — 화면 "해당 사업연도 종료일"은 개시 신고일 때만 개시사업연도 종료일
  mappers['증여10호의4'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, I = ctx.in || {};
    filing(o, ctx);
    head(o, ctx);
    var initial = I.phase === 'initial';
    if (initial && has(I.fiscalYearEnd)) o.set('⑰', I.fiscalYearEnd);
    else if (initial) o.miss('⑰ 증여일', '화면 입력 없음(해당 사업연도 종료일)');
    else o.miss('⑰ 증여일(개시사업연도 종료일)', '계산기에 없음 — 정산 신고 화면의 "해당 사업연도 종료일"은 정산사업연도 종료일');
    if (I.phase === 'initial' || I.phase === 'settlement') o.set('⑱', initial ? '개시사업연도' : '2년경과연도'); else o.miss('⑱ 사업연도 구분', '화면 입력 없음(신고 단계)');
    if (!r.과세대상여부) {
      o.miss('⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞ 증여재산가액·세액', '엔진: 과세대상 아님 — ' + (r.안내 || '계산 결과 없음'));
      sign(o, ctx);
      return o.result();
    }
    o.set('⑲', n(I.profit));
    var sp = jtSplit(ctx), gift = n(r.증여의제이익);
    if (sp.why) {
      o.miss('⑳ 주식보유비율 직접·간접 줄', '직접·간접 나눈 값이 계산기에 없음 — ' + sp.why + ' (화면 주식보유비율 ' + n(I.shareRatio) + '%는 합)');
      o.miss('㉒ 증여재산가액 직접·간접 줄', '직접·간접 나눈 값이 계산기에 없음 — 엔진 증여의제이익 ' + gift + '원은 ㉓에');
    } else {
      o.set('⑳@직접', r4(sp.direct));
      if (sp.indirect) o.set('⑳@간접', r4(sp.indirect)); else o.miss('⑳ 간접 줄', '해당 없음 — 간접보유비율 0%');
      if (!sp.indirect) { o.set('㉒@직접', gift).miss('㉒ 간접 줄', '해당 없음 — 간접보유비율 0%'); }
      else o.miss('㉒ 증여재산가액 직접·간접 줄', '계산기에 없음 — 엔진은 직접+간접 합친 비율로 법인세 상당액·배당공제까지 한 번에 계산(나눌 식 없음). 합계 ' + gift + '원은 ㉓에');
    }
    o.set('㉑', n(I.dividendDeduction));
    if (n(I.dividendDeduction)) o.note('㉑ 배당소득공제 = 화면 입력 금액(시행령 §34의4⑤·⑥ 식은 계산기 밖에서 계산)');
    o.note(JT_GROUP_NOTE);
    var base = n(r.과세표준), calc = n(r.산출세액), prior = n(r.개시사업연도_산출세액), credit = n(r.신고세액공제),
      pen = n(r.무신고가산세) + n(r.과소신고가산세), late = n(r.납부지연가산세), pay = n(r.납부세액), refund = n(r.환급세액);
    o.set('㉓', gift).set('㉔', base).set('㉕', H.giftInheritRate(base)).set('㉖', calc).set('㉗', prior).set('㉘', credit).set('㉙', pen).set('㉚', late).set('㉛', pay);
    o.check('㉖ = ㉔ × ㉕ − 누진공제', calc, Math.floor(progressive(base)));
    if (calc >= prior) o.check('㉛ = ㉖ − ㉗ − ㉘ + ㉙ + ㉚', pay, calc - prior - credit + pen + late);
    else o.note('㉖ < ㉗ — 환급받을 세액 ' + refund + '원(법 §45의4③ 단서, 개시 때 낸 세액 한도). 서식에 환급 칸이 없어 ㉛은 0');
    if (initial) o.note('개시사업연도 신고 — ⑲ = 개시사업연도 이익, ㉒ = [{(⑲ × ⑳) − 법인세 상당액(' + n(I.corporateTax || 0) + '원 또는 자동계산)} ÷ 월수(' + (n(I.months) || 12) + ') × 12] × 3 − ㉑ (법 §45의4①)');
    o.miss('㉜ 연부연납·㉝ 분납(금액·납부 및 신청일자)', '계산기에 없음(일감떼어주기 탭에 연부연납·분납 계산 없음)');
    o.set('㉞@금액', pay).miss('㉞ 납부 및 신청일자', '계산기에 없음');
    o.note('㉞ 신고납부 = ㉛(연부연납·분납 없음으로 봄 — 신청하면 ㉞ = ㉛ − ㉜ − ㉝로 고칠 것)');
    sign(o, ctx);
    return o.result();
  };

  // 부문별 영업이익 도구(jtSegmentYears_)에서 서식 한 칸에 넣을 사업연도: 값이 있는 해가 하나면 그 해, 개시 신고면 1년차
  function segYear(ctx) {
    var ys = (ctx.segmentYears || []).map(function (y, i) { return { y: y, i: i }; }).filter(function (x) { return n(x.y.segmentSales) || n(x.y.totalSales); });
    if (!ys.length) return { why: '🧮 부문별 매출·비용 내역이 비어 있음' };
    if (ys.length === 1) return ys[0];
    if ((ctx.in || {}).phase === 'initial' && ys[0].i === 0) return ys[0];
    return { why: '부문별 내역이 ' + ys.length + '개 사업연도에 있어 어느 해 값인지 서식에 없음(부표4는 해마다 한 장)' };
  }
  function sumSeg(L) { return (L || []).reduce(function (s, x) { return s + n(x.segment); }, 0); }

  // ───────── 10호의4 부표1 — 수증자 등 및 과세가액 계산명세서(A) ─────────
  //  값 출처: 🧮 주주별 직접·간접보유 내역(shareholdingRows_.jt — jtAttach1PrintPageHtml_와 같은 표), 🧮 부문별 매출·비용 내역(jtSegmentYears_)
  mappers['증여10호의4부표1'] = function (ctx) {
    var o = new Out(), I = ctx.in || {}, sh = ctx.shareholders || [];
    o.miss('① 수혜법인 법인명', '계산기에 없음').miss('② 사업자등록번호', '계산기에 없음').miss('③ 소재지', '계산기에 없음')
      .miss('⑤ 법인구분', '계산기에 없음 — 일감떼어주기 탭에 기업규모 칸이 없음');
    if (I.phase === 'initial' && has(I.fiscalYearEnd)) { o.set('④', fyText(I.fiscalYearEnd)); o.note('④ 사업연도는 종료일만(화면 "해당 사업연도 종료일") — 시작일은 계산기에 없음'); }
    else o.miss('④ 사업연도', I.phase === 'initial' ? '화면 입력 없음(해당 사업연도 종료일)' : '계산기에 없음 — 정산 신고 화면의 종료일은 정산사업연도 것');
    topHolderCells(o, sh, '㉢@성명'); // 10호의3 부표1과 같은 칸 구조(시행령 §34의4가 §34의3① 지배주주 판정을 준용)
    o.miss('㉢ 주민등록번호', '계산기에 없음');
    if (sh.length) {
      var of = ownerFirst(sh.slice()), L2 = of.list;
      if (!of.found) o.note('⚠ 다. 첫 줄은 지배주주 자리 — 🧮 주주별 보유 내역의 관계 칸에 "지배주주"·"본인"이 없어 입력 순서대로 적음');
      var d = 0, ind = 0;
      L2.forEach(function (s) { d += n(s.directRatio); ind += n(s.indirectRaw); });
      o.set('⑰', L2.map(function (s) { return s.name; })).set('⑲', L2.map(function (s, k) { return k === 0 ? '' : s.relation; }))
        .set('⑳', L2.map(function (s) { return r4(n(s.directRatio)); })).set('㉑', L2.map(function (s) { return r4(n(s.indirectRaw)); }))
        .set('㉒', L2.map(function (s) { return r4(n(s.directRatio) + n(s.indirectRaw)); }))
        .set('⑳@계', r4(d)).set('㉑@계', r4(ind)).set('㉒@계', r4(d + ind));
      if (d + ind >= 30) o.set('㉓', '○'); else o.miss('㉓ 수증자 해당여부', '해당 안 됨 — ㉒ 계 ' + r4(d + ind) + '% < 30%');
      o.check('㉒ 계 = 화면 주식보유비율(엔진 입력, 지배주주+친족 합계)', Math.round((d + ind) * 1e4), Math.round(n(I.shareRatio) * 1e4));
      o.note('다. ㉑ 간접 보유비율 = 🧮 도구의 고리 지분율을 모두 곱한 값(일감떼어주기는 간접출자법인 요건 거르기 없이 — 지금 계산기와 같음)');
    } else o.miss('⑰⑲⑳㉑㉒㉓ 다. 지배주주와 친족', '계산기에 없음 — 🧮 주주별 직접·간접보유 내역이 비어 있음');
    o.miss('⑱ 주민등록번호', '계산기에 없음');
    o.miss('㉔ 사업기회 제공 법인명·㉕ 사업자등록번호·㉖ 중소기업 또는 50% 출자 법인 여부', '계산기에 없음 — 일감떼어주기 탭에 제공 법인 칸이 없음(법 §45의4① 괄호: 중소기업 등은 제외)');
    var sy = segYear(ctx);
    if (sy.why) o.miss('㉗ 부문별 총매출액·㉘ 부문별 총매출원가', sy.why);
    else {
      o.set('㉗', n(sy.y.segmentSales)).set('㉘', sumSeg(sy.y.costs));
      o.note('㉗·㉘ = 🧮 부문별 매출·비용 내역 ' + (sy.i + 1) + '년차의 부문 매출액·부문 매출원가 합(부표4 1.·2. ⑤ — 작성방법 13)');
    }
    return o.result();
  };

  // ───────── 10호의4 부표2 — 수증자 등 및 과세가액 계산명세서(A-1)(수증자 간접보유비율) ─────────
  //  10호의3 부표2와 같은 모양·같은 작성방법(최대주주가 법인일 때 별지로) — 🧮 주주별 보유 내역(shareholdingRows_.jt, jtAttach2PrintPageHtml_와 같은 표)의 출자 고리를 같은 방법으로 옮김
  mappers['증여10호의4부표2'] = function (ctx) { return mappers['증여10호의3부표2'](ctx); };

  // 법인세 납부세액 중 상당액 — 엔진 calculateBusinessOpportunityGiftTaxJS와 같은 식(직접 입력이 있으면 그 값, 없으면 시행령 §34의4④)
  function jtCorpTax(I) {
    if (n(I.corporateTax) > 0) return { v: n(I.corporateTax), how: '화면 직접 입력' };
    var inc = n(I.corpTaxableIncome);
    return { v: Math.round(n(I.corpTaxAfterCredit) * (inc > 0 ? Math.min(1, n(I.profit) / inc) : 0)), how: '⑲ × (이익 ÷ 각 사업연도소득) 자동계산(시행령 §34의4④)' };
  }
  var JT_DONEE_RATIO_NOTE = '⚠ ㉕·㉙ "수증자의 주식보유비율" 자리에 화면 주식보유비율을 적음 — 🧮 도구로 넣었으면 지배주주+친족 합계라 수증자 한 사람 비율과 다를 수 있음(엔진도 이 값으로 계산 — 보고서 계산 오류 의심)';
  // ───────── 10호의4 부표3 — 수증자 등 및 과세가액 계산명세서(B) ─────────
  //  값 출처: jt 입력칸 + lastBusinessOpportunityGiftResult_ + 🧮 부문별 매출·비용 내역(jtSegmentYears_)
  //  지금 인쇄 jtAttach3PrintPageHtml_는 이 서식 칸이 아니라 연도별 부문 손익 요약을 찍었음(그 표는 부표4 B-1 성격)
  //  개시 신고: 1년차 줄 + ㉑·㉗ / 정산 신고: 마.(㉘~㉜). 🧮 부문별 내역(부문 매출·원가·판관비를 직접 나눈 표)이 있으면 계산방법 "나-1"
  mappers['증여10호의4부표3'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, I = ctx.in || {}, initial = I.phase === 'initial';
    o.miss('① 상호·② 사업자번호·③ 법인구분', '계산기에 없음');
    var months = n(I.months) || 12;
    if (initial) o.set('④', (has(I.fiscalYearEnd) ? fyText(I.fiscalYearEnd) + ' ' : '') + '(' + months + ')');
    else o.miss('④ 사업연도(월수)', '계산기에 없음 — 정산 신고에는 개시사업연도 월수 입력이 없음');
    var segs = (ctx.segmentYears || []), YR = ['1년차', '2년차', '3년차'];
    var anySeg = segs.some(function (y) { return n(y.segmentSales) || n(y.totalSales); });
    // [2026.10.20 서식 감사] 부문 원가·판관비를 하나도 나누지 않았으면(부문 열이 모두 0) 부문 손익을 직접 계산할 수 없으므로 "나"(전체 영업이익을 매출액 비율로 안분,
    //  시행령 §34의4③ · ⑪ = ⑧ × (⑨ ÷ ⑩)). 예전엔 이때도 "나-1"로 보고 ⑬ = 부문 매출액(원가 0)으로 찍었음
    var split = segs.some(function (y) { return (y.costs || []).concat(y.expenses || []).some(function (x) { return n(x.segment); }); });
    var hasSeg = anySeg && split;
    if (anySeg && !split) {
      o.set('⑤', '나');
      YR.forEach(function (yy, i) {
        var s = segs[i]; if (!s || !(n(s.segmentSales) || n(s.totalSales))) return;
        var whole = n(s.totalSales) - (s.costs || []).reduce(function (a, x) { return a + n(x.total); }, 0) - (s.expenses || []).reduce(function (a, x) { return a + n(x.total); }, 0);
        o.set('⑥@' + yy, whole).set('⑨@' + yy, n(s.segmentSales)).set('⑩@' + yy, n(s.totalSales));
      });
      if (initial && n(I.corpTaxableIncome)) o.set('⑫@1년차', n(I.corpTaxableIncome));
      o.miss('⑦⑧⑪ 세무조정·세무조정 후 이익', '계산기에 없음 — 세무조정 금액이 없음(⑪ = ⑧ × (⑨ ÷ ⑩)은 직접)');
      o.note('⚠ 🧮 부문별 내역에 부문 원가·판관비가 없어 "나"(전체 영업이익을 매출액 비율로 안분)로 봄 — ⑥ = 전체 매출액 − 전체 매출원가 − 전체 판관비');
    } else o.miss('⑥⑦⑧⑨⑩⑪⑫ 나. 실제이익을 계산할 수 없는 경우', hasSeg ? '해당 없음 — 🧮 부문별 매출·비용 내역(부문 손익을 직접 나눔)이 있어 나-1 방법' : '계산기에 없음');
    if (hasSeg) {
      o.set('⑤', '나-1');
      YR.forEach(function (y, i) {
        var s = segs[i];
        if (s && (n(s.segmentSales) || n(s.totalSales))) o.set('⑬@' + y, n(s.segmentSales) - sumSeg(s.costs) - sumSeg(s.expenses));
        else o.miss('⑬ ' + y, '🧮 부문별 매출·비용 내역에 ' + y + ' 값 없음');
      });
      o.note('⑬ = 🧮 부문별 매출·비용 내역의 부문 매출액 − 부문 매출원가 − 부문 판관비(taxcalc.html jtSegmentYearOperatingProfit_와 같은 식)');
    } else if (!anySeg) o.miss('⑤ 계산방법·⑬ 부문별영업이익', '계산기에 없음 — 🧮 부문별 매출·비용 내역이 비어 있어 나·나-1 어느 방법인지 알 수 없음');
    // [2026.10.20 서식 감사] ⑭ 세무조정 = ⑮(화면 이익 — 세무조정 후) − ⑬(🧮 부문 영업이익) — 서식 ⑮ = ⑬ ± ⑭(개시 신고 1년차, 나-1일 때)
    var s0 = segs[0], p13 = (hasSeg && s0 && (n(s0.segmentSales) || n(s0.totalSales))) ? n(s0.segmentSales) - sumSeg(s0.costs) - sumSeg(s0.expenses) : null;
    if (initial && p13 !== null && r.과세대상여부) {
      var adj = n(I.profit) - p13;
      if (adj) { o.set('⑭@1년차.' + (adj > 0 ? '더하기' : '빼기'), Math.abs(adj)).miss('⑭ ' + (adj > 0 ? '(−)' : '(+)') + ' 칸·2년차·3년차', '해당 없음 — 1년차 세무조정 ' + (adj > 0 ? '더하기' : '빼기') + '만'); o.note('⑭ = ⑮(화면 이익 ' + n(I.profit) + '원) − ⑬(🧮 부문 영업이익 ' + p13 + '원) — 세무조정 금액(⑮ = ⑬ ± ⑭)'); }
      else o.miss('⑭ 세무조정(+)(−)', '해당 없음 — ⑮(화면 이익)와 ⑬(🧮 부문 영업이익)이 같음');
    } else o.miss('⑭ 세무조정(+)(−)', initial ? '계산기에 없음 — 🧮 부문별 내역(나-1)이 없어 ⑬과 비교 못 함' : '계산기에 없음 — 정산 신고 화면은 이익 누계만 받아 연도별로 나눌 수 없음');
    var ct = jtCorpTax(I);
    if (!r.과세대상여부) { o.miss('⑮⑯⑰⑱⑲⑳㉑㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜', '엔진: 과세대상 아님 — ' + (r.안내 || '계산 결과 없음')); return o.result(); }
    o.miss('⑰ 법인세 산출세액·⑱ 공제·감면세액', '계산기에 없음 — 화면은 ⑲ 차감후세액만 받음');
    var div = n(I.dividendDeduction), gift = n(r.증여의제이익), share = n(I.shareRatio);
    if (initial) {
      if (hasSeg) o.set('⑮@1년차', n(I.profit)); else o.miss('⑮ 세무조정 후 수혜법인의 이익', '나·나-1 어느 방법인지 알 수 없음 — 화면 이익 ' + n(I.profit) + '원은 본표 ⑲에');
      if (n(I.corpTaxableIncome)) o.set('⑯@1년차', n(I.corpTaxableIncome)); else o.miss('⑯ 각 사업연도소득', '화면 입력 없음(수혜법인의 해당 사업연도 소득금액)');
      if (n(I.corpTaxAfterCredit)) o.set('⑲@1년차', n(I.corpTaxAfterCredit)); else o.miss('⑲ 차감후세액', '화면 입력 없음(법인세 납부세액 중 상당액을 직접 넣음)');
      o.set('⑳@1년차', ct.v);
      o.note('⑳ = ' + ct.how);
      if (!(n(I.corporateTax) > 0) && n(I.corpTaxableIncome)) o.check('⑳ = ⑲ × (⑮ ÷ ⑯) (1 넘으면 1)', ct.v, Math.round(n(I.corpTaxAfterCredit) * Math.min(1, n(I.profit) / n(I.corpTaxableIncome))));
      o.miss('⑮⑯⑲⑳ 2년차·3년차 줄', '해당 없음 — 개시사업연도 신고(1년차만)');
      var e21 = Math.round(Math.max(0, (n(I.profit) * share / 100 - ct.v) / months * 12) * 3);
      o.set('㉑', e21);
      o.check('㉗ = ㉑ − ㉖(엔진 증여의제이익)', gift, Math.max(0, e21 - div));
      o.set('㉗', gift);
      o.miss('㉘㉙㉚㉛㉜ 마. 실제정산 증여의제이익', '해당 없음 — 개시사업연도 신고');
    } else {
      o.miss('⑮⑯⑲⑳ 연도별 줄', '계산기에 없음 — 정산 신고 화면은 개시~정산 누적 합계(이익·법인세 상당액)만 받음');
      o.miss('㉑ 3년(추정) 정산 증여의제이익·㉗ 차감 증여의제이익', '해당 없음 — 정산 신고(개시 신고 때 적은 값)');
      o.set('㉘', n(I.profit)).set('㉙', r4(share)).set('㉚', ct.v);
      var e31 = Math.round(n(I.profit) * share / 100 - ct.v);
      o.set('㉛', e31).set('㉜', gift);
      o.check('㉜ = ㉛ − ㉖(엔진 증여의제이익)', gift, Math.max(0, e31 - div));
      o.note('㉚ = ' + ct.how + ' — 개시~정산 누계');
    }
    if (div) { o.set('㉖', div).set('㉕', r4(share)).miss('㉓ 배당소득·㉔ 배당가능이익', '계산기에 없음 — 화면에 공제대상금액을 바로 넣음'); }
    else o.miss('㉓㉔㉕㉖ 라. 배당소득의 공제', '해당 없음 — 배당소득공제 0(화면 입력 없음)');
    o.note(JT_DONEE_RATIO_NOTE);
    // [2026.10.20 서식 감사] ㉕·㉙ "수증자의 주식보유비율"(법 §45의4①) — 🧮 수증자 본인 줄(같은 성명 합, 직접 + 간접)과 화면 비율이 다르면 드러냄(엔진도 화면 비율로 계산 — 세액 의심으로 보고)
    var meRows = (ctx.shareholders || []).filter(function (s) { return has(s.name) && s.name === (ctx.donee || {}).name; });
    var meR = meRows.reduce(function (a, s) { return a + n(s.directRatio) + n(s.indirectRaw); }, 0);
    if (meRows.length && Math.round(meR * 1e4) !== Math.round(share * 1e4)) o.note('⚠ 수증자 본인 주식보유비율(🧮 ' + r4(meR) + '%) ≠ ㉕·㉙에 적은 화면 비율(' + r4(share) + '%) — 수증자가 여럿이면 수증자별로 다시 계산해야 하는지 확인');
    return o.result();
  };

  // ───────── 10호의4 부표4 — 수증자 및 과세가액 계산명세서(B-1)(수혜법인의 부문별 영업이익 명세서) ─────────
  //  사업연도 한 해에 한 장 — ctx.부표4년차 = 몇 번째 해(0부터, ctxFor가 값이 있는 해마다 장을 만듦)
  //  값 출처: 🧮 부문별 매출·비용 내역(jtSegmentYears_ — jtAttach4PrintPageHtml_와 같은 항목명·금액). ③·⑥ 비율과 총매출액 세부는 계산기에 없음
  mappers['증여10호의4부표4'] = function (ctx) {
    var o = new Out(), k = n(ctx.부표4년차), y = (ctx.segmentYears || [])[k];
    if (!y || !(n(y.segmentSales) || n(y.totalSales) || (y.costs || []).length || (y.expenses || []).length)) {
      o.miss('①②③④⑤⑥ 부표4 전체', '계산기에 없음 — 🧮 부문별 매출·비용 내역에 ' + (k + 1) + '년차 값이 없음'); return o.result();
    }
    var cT = (y.costs || []).reduce(function (s, x) { return s + n(x.total); }, 0), cS = sumSeg(y.costs);
    var eT = (y.expenses || []).reduce(function (s, x) { return s + n(x.total); }, 0), eS = sumSeg(y.expenses);
    o.set('②@총매출액', n(y.totalSales)).set('⑤@총매출액', n(y.segmentSales))
      .set('②@총매출원가', cT).set('⑤@총매출원가', cS)
      .set('②@매출총이익', n(y.totalSales) - cT).set('⑤@매출총이익', n(y.segmentSales) - cS)
      .set('②@판매관리비', eT).set('⑤@판매관리비', eS)
      .set('②@총영업이익', n(y.totalSales) - cT - eT).set('⑤@총영업이익', n(y.segmentSales) - cS - eS);
    var put = function (grp, L) {
      if (!L.length) { o.miss('①②④⑤ ' + grp + ' 세부 줄', '해당 없음 — 🧮 부문별 내역에 항목 없음'); return; }
      o.set('①@' + grp, L.map(function (x) { return x.label; })).set('④@' + grp, L.map(function (x) { return x.label; }))
        .set('②@' + grp, L.map(function (x) { return n(x.total); })).set('⑤@' + grp, L.map(function (x) { return n(x.segment); }));
    };
    put('원가항목', y.costs || []);
    put('판관비항목', y.expenses || []);
    o.miss('①②④⑤ 매출항목(총매출액 세부 1)~4))', '계산기에 없음 — 🧮 도구는 총매출액·부문 매출액 합계만 받음');
    o.miss('③⑥ 비율(점유비)', '계산기에 없음 — 작성방법 1의 "점유비"를 계산기가 내지 않음');
    o.check('⑤ 5. 부문별 영업이익 = 부문 매출 − 부문 원가 − 부문 판관비(🧮 도구 부문 영업이익)', n(y.segmentSales) - cS - eS, n(y.segmentSales) - sumSeg(y.costs) - sumSeg(y.expenses));
    o.check('⑤ 3. 부문별 매출총이익 = 1. − 2.', n(y.segmentSales) - cS, n(y.segmentSales) - (y.costs || []).reduce(function (s, x) { return s + n(x.segment); }, 0));
    o.note('이 장은 ' + (k + 1) + '년차(🧮 부문별 매출·비용 내역의 순서) — 사업연도는 서식에 적는 칸이 없어 표시하지 않음');
    return o.result();
  };

  // ───────── 세액인쇄 화면용 ctx — 화면 전역값에서 모음(브라우저) ─────────
  /* global lastRelatedPartyGiftResult_, lastBusinessOpportunityGiftResult_, giftDonees, shareholdingRows_, relatedPartyRatioRows_,
     jmRelatedPartyTotalSales_, jmRelatedPartyExcludedSales_, jtSegmentYears_, shareholdingIndirectRatio_, shareholdingCountedIndirectRatio_,
     shareholdingChainQualified_, shareholdingChainAutoQ_, jmRelations_ */
  function jmR() { return typeof lastRelatedPartyGiftResult_ !== 'undefined' ? lastRelatedPartyGiftResult_ : null; }
  function jtR() { return typeof lastBusinessOpportunityGiftResult_ !== 'undefined' ? lastBusinessOpportunityGiftResult_ : null; }
  function shRows(target) {
    var rows = (typeof shareholdingRows_ !== 'undefined' && shareholdingRows_ && shareholdingRows_[target]) || [];
    return rows.filter(function (row) { return has(row.name) || n(row.directRatio) || n(row.chain1Ratio); }).map(function (row) {
      var raw = typeof shareholdingIndirectRatio_ === 'function' ? shareholdingIndirectRatio_(row) : 0;
      var cnt = typeof shareholdingCountedIndirectRatio_ === 'function' ? shareholdingCountedIndirectRatio_(row, target) : raw;
      return { name: row.name || '', relation: row.relation || '', directRatio: n(row.directRatio), chain1Company: row.chain1Company || '', chain1Ratio: n(row.chain1Ratio),
        chain2Company: row.chain2Company || '', chain2Ratio: n(row.chain2Ratio), chain3Company: row.chain3Company || '', chain3Ratio: n(row.chain3Ratio),
        // [2026.10.20 서식 감사] 간접출자법인 요건 = 화면과 같은 판정(사람이 체크칸을 건드렸으면 그 값, 아니면 자동 판정 — shareholdingChainQualified_).
        //  예전엔 체크칸을 안 건드리면 늘 충족(○)으로 봐서, 화면이 미충족으로 간접보유비율을 0으로 셀 때 부표3 ㉒ ○·㉕ 0이 함께 나올 수 있었음(시행령 §34의3)
        chainQualified: target === 'jm' && typeof shareholdingChainQualified_ === 'function' ? shareholdingChainQualified_(row, rows) : row.chainQualified !== false,
        chainAuto: target === 'jm' && typeof shareholdingChainAutoQ_ === 'function' && row.chainQualified !== true && row.chainQualified !== false ? shareholdingChainAutoQ_(row, rows) : null,
        indirectRaw: raw, indirect: cnt };
    });
  }
  function donee0() { return (typeof giftDonees !== 'undefined' && giftDonees && giftDonees[0]) || {}; }
  function jmCtx(extra) {
    var el = H.el;
    var rp = (typeof relatedPartyRatioRows_ !== 'undefined' && relatedPartyRatioRows_ ? relatedPartyRatioRows_ : []).filter(function (x) { return has(x.label) || n(x.sales) > 0; })
      .map(function (x) { return { label: x.label || '', sales: n(x.sales) }; });
    return Object.assign({ kind: 'jm', r: jmR(), donee: donee0(), taxAgent: H.agent(),
      in: { companySize: el('jmCompanySize'), operatingIncome: n(el('jmOperatingIncome')), netIncome: n(el('jmNetIncome')), tradeRatio: n(el('jmTradeRatio')),
        relatedPartySales: n(el('jmRelatedPartySales')), shareRatio: n(el('jmShareRatio')), dividendDeduction: n(el('jmDividendDeduction')),
        fiscalYearEnd: el('jmFiscalYearEnd'), filingStatus: el('jmFilingStatus') },
      shareholders: shRows('jm'), relatedParties: rp,
      // [2026.10.20 서식 감사] 화면 출자관계별 표(부표5 ㉖·㉛·㉜·㉝·㉞ 입력 — 엔진 결과 출자관계별에는 공제액만 있음)
      relations: (typeof jmRelations_ !== 'undefined' && Array.isArray(jmRelations_)) ? JSON.parse(JSON.stringify(jmRelations_)) : [],
      totalSales: n(typeof jmRelatedPartyTotalSales_ !== 'undefined' ? jmRelatedPartyTotalSales_ : 0), excludedSales: n(typeof jmRelatedPartyExcludedSales_ !== 'undefined' ? jmRelatedPartyExcludedSales_ : 0) }, extra || {});
  }
  function jtCtx(extra) {
    var el = H.el;
    var years = (typeof jtSegmentYears_ !== 'undefined' && jtSegmentYears_ ? jtSegmentYears_ : []).map(function (y) {
      var m = function (L) { return (L || []).filter(function (x) { return has(x.label) || n(x.total) || n(x.segment); }).map(function (x) { return { label: x.label || '', total: n(x.total), segment: n(x.segment) }; }); };
      return { totalSales: n(y.totalSales), segmentSales: n(y.segmentSales), costs: m(y.costs), expenses: m(y.expenses) };
    });
    return Object.assign({ kind: 'jt', r: jtR(), donee: donee0(), taxAgent: H.agent(),
      in: { phase: el('jtPhase'), profit: n(el('jtProfit')), shareRatio: n(el('jtShareRatio')), corporateTax: n(el('jtCorporateTax')), corpTaxAfterCredit: n(el('jtCorpTaxAfterCredit')),
        corpTaxableIncome: n(el('jtCorpTaxableIncome')), months: n(el('jtMonths')), dividendDeduction: n(el('jtDividendDeduction')), initialTax: n(el('jtInitialTax')),
        initialPaidTax: n(el('jtInitialPaidTax')), fiscalYearEnd: el('jtFiscalYearEnd'), filingStatus: el('jtFilingStatus') },
      shareholders: shRows('jt'), segmentYears: years }, extra || {});
  }
  // 준비 조건 — 지금 인쇄와 같음: 본표는 결과가 있으면(isReady), 부표는 과세대상일 때 그 부표의 입력 표가 있으면
  var READY = {
    '증여10호의3': function () { return !!jmR(); },
    '증여10호의3부표1': function () { var r = jmR(); return !!(r && r.과세대상여부); },
    '증여10호의3부표2': function () { var r = jmR(); return !!(r && r.과세대상여부 && shRows('jm').some(function (x) { return has(x.chain1Company) || n(x.chain1Ratio) > 0; })); },
    '증여10호의3부표3': function () { var r = jmR(); return !!(r && r.과세대상여부 && chainGroups(shRows('jm')).a.length); },
    '증여10호의4': function () { return !!jtR(); },
    '증여10호의4부표1': function () { var r = jtR(); return !!(r && r.과세대상여부); },
    '증여10호의4부표3': function () { var r = jtR(); return !!(r && r.과세대상여부); },
    '증여10호의4부표4': function () { var r = jtR(); return !!(r && r.과세대상여부 && segYearsWith(jtCtx({})).length); },
    '증여10호의4부표2': function () { var r = jtR(); return !!(r && r.과세대상여부 && shRows('jt').some(function (x) { return has(x.chain1Company) || n(x.chain1Ratio) > 0; })); },
    '증여10호의3부표5': function () { var r = jmR(); return !!(r && r.과세대상여부); },
    '증여10호의3부표4': function () { var r = jmR(); return !!(r && r.과세대상여부 && (typeof relatedPartyRatioRows_ !== 'undefined' ? relatedPartyRatioRows_ : []).some(function (x) { return has(x.label) || n(x.sales) > 0; })); }
  };
  // 한 사건에 여러 장인 서식 — 수혜법인의 법인주주(ⓐ)마다 한 장
  function segYearsWith(c) { var out = []; (c.segmentYears || []).forEach(function (y, i) { if ((y.costs || []).some(function (x) { return has(x.label); }) || (y.expenses || []).some(function (x) { return has(x.label); }) || n(y.segmentSales) || n(y.totalSales)) out.push(i); }); return out; }
  var SPLIT = {
    '증여10호의4부표4': function (c) { return segYearsWith(c).map(function (i) { return Object.assign({}, c, { 부표4년차: i }); }); },
    '증여10호의3부표3': function (c) { return chainGroups(c.shareholders || []).a.map(function (x, i) { return Object.assign({}, c, { 부표3법인: i }); }); }
  };
  Object.keys(READY).forEach(function (k) {
    var isJm = /^증여10호의3/.test(k);
    ready[k] = function () { try { return !!READY[k](); } catch (e) { return false; } };
    ctxFor[k] = function (extra) {
      if (!ready[k]()) return [];
      var c = isJm ? jmCtx(extra) : jtCtx(extra);
      return SPLIT[k] ? SPLIT[k](c) : [c];
    };
  });

  // 세목 원본 모양 출력 묶음에는 넣지 않음 — 일반 증여(10호)와 따로 내는 신고서(위 "어디서 찍나")
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '증여특례B', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready, _jmSplit: jmSplit };
});
