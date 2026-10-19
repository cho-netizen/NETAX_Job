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
    } else o.miss('⑥ 증여자(특수관계법인) 법인명', '계산기에 없음 — 🧮 특수관계법인 매출 합산 표가 비어 있음');
    o.miss('⑦ 증여자 사업자등록번호', '계산기에 없음').miss('⑧ 증여자 소재지·전화번호', '계산기에 없음');
    o.miss('⑨ 수혜법인 법인명', '계산기에 없음').miss('⑩ 수혜법인 사업자등록번호', '계산기에 없음');
    if (SIZE[I.companySize]) {
      o.set('⑪', SIZE[I.companySize]);
      if (I.companySize === 'general') o.note('⑪ 법인구분: 화면 기업규모 "일반" — 상호출자제한기업집단이면 "상호"에 표시해야 함(계산기에 그 구분 없음, 계산은 일반과 같음)');
    } else o.miss('⑪ 법인구분', '화면 입력 없음(기업규모)');
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
    var row = (ctx.shareholders || []).filter(function (s) { return has(s.name) && s.name === dn.name; })[0];
    if (!row) return { why: '🧮 주주별 직접·간접보유 내역에 수증자(' + (dn.name || '이름 없음') + ') 줄이 없음' };
    var direct = n(row.directRatio), indirect = n(row.indirect);
    if (Math.abs(r4(direct + indirect) - r4(n(I.shareRatio))) > 0.0001) return { why: '주주별 보유 내역의 수증자 비율 합(' + r4(direct + indirect) + '%)이 화면 주식보유비율(' + n(I.shareRatio) + '%)과 다름' };
    var i21 = Math.max(0, indirect - sub), d20 = direct - Math.max(0, sub - indirect);
    return { row: row, direct: direct, indirect: indirect, d20: Math.max(0, d20), i21: i21, sub: sub };
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
      o.miss('⑱~㉝ 증여재산가액·세액', '엔진: 과세대상 아님 — ' + (r.안내 || '계산 결과 없음'));
      sign(o, ctx);
      return o.result();
    }
    var sub = JM_SUB[I.companySize] || { trade: 0, share: 0 };
    var income = n(r.적용소득금액), trade = Math.max(0, n(I.tradeRatio) - sub.trade), div = n(r.배당소득공제), gift = n(r.증여의제이익);
    var sp = jmSplit(ctx);
    if (sp.why) {
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
    o.check('㉒ 계 = ⑱ × ⑲ × ⑳(합친 비율) − ㉑', gift, Math.max(0, Math.round(income * trade / 100 * Math.max(0, n(I.shareRatio) - sub.share) / 100) - div));
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
    var dir = sh.filter(function (s) { return n(s.directRatio) > 0; });
    if (dir.length) {
      o.set('⑥', dir.map(function (s) { return s.name; })).set('⑧', dir.map(function (s) { return s.relation; })).set('⑨', dir.map(function (s) { return r4(n(s.directRatio)); }));
      var mx = Math.max.apply(null, dir.map(function (s) { return n(s.directRatio); }));
      o.set('⑩', dir.map(function (s) { return n(s.directRatio) === mx ? '○' : ''; }));
      o.set('⑨@계', r4(dir.reduce(function (a, s) { return a + n(s.directRatio); }, 0)));
      o.note('㉠ ⑥~⑩은 🧮 주주별 직접·간접보유 내역에 넣은 주주만(직접보유비율이 있는 줄) — 최대주주등의 다른 주주는 계산기에 없음. ⑩은 그 가운데 ⑨가 가장 큰 주주(작성방법 3)');
    } else o.miss('⑥⑧⑨⑩ ㉠ 최대주주등', '계산기에 없음 — 🧮 주주별 직접·간접보유 내역에 직접보유비율이 있는 주주가 없음');
    o.miss('⑦ 주민등록번호(사업자등록번호)', '계산기에 없음').miss('㉠비고', '계산기에 없음');
    o.miss('⑪⑫⑬⑭⑮⑯ ㉡ 간접보유비율(최대주주가 법인일 때)', '계산기에 없음 — 지배주주 판정(작성방법 4·8)을 계산기가 하지 않음')
      .miss('㉢ 지배주주', '계산기에 없음 — 지배주주 판정을 계산기가 하지 않음(엔진 안내)');
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
      var dn = (ctx.donee || {}).name, me = L2.filter(function (s) { return s.name === dn; })[0];
      if (me) o.check('수증자 ㉒ 지분율 합계 = 화면 주식보유비율(엔진 입력)', Math.round((n(me.directRatio) + n(me.indirect)) * 10000), Math.round(n(I.shareRatio) * 10000));
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

  // ───────── 세액인쇄 화면용 ctx — 화면 전역값에서 모음(브라우저) ─────────
  /* global lastRelatedPartyGiftResult_, lastBusinessOpportunityGiftResult_, giftDonees, shareholdingRows_, relatedPartyRatioRows_,
     jmRelatedPartyTotalSales_, jmRelatedPartyExcludedSales_, jtSegmentYears_, shareholdingIndirectRatio_, shareholdingCountedIndirectRatio_ */
  function jmR() { return typeof lastRelatedPartyGiftResult_ !== 'undefined' ? lastRelatedPartyGiftResult_ : null; }
  function jtR() { return typeof lastBusinessOpportunityGiftResult_ !== 'undefined' ? lastBusinessOpportunityGiftResult_ : null; }
  function shRows(target) {
    var rows = (typeof shareholdingRows_ !== 'undefined' && shareholdingRows_ && shareholdingRows_[target]) || [];
    return rows.filter(function (row) { return has(row.name) || n(row.directRatio) || n(row.chain1Ratio); }).map(function (row) {
      var raw = typeof shareholdingIndirectRatio_ === 'function' ? shareholdingIndirectRatio_(row) : 0;
      var cnt = typeof shareholdingCountedIndirectRatio_ === 'function' ? shareholdingCountedIndirectRatio_(row, target) : raw;
      return { name: row.name || '', relation: row.relation || '', directRatio: n(row.directRatio), chain1Company: row.chain1Company || '', chain1Ratio: n(row.chain1Ratio),
        chain2Company: row.chain2Company || '', chain2Ratio: n(row.chain2Ratio), chain3Company: row.chain3Company || '', chain3Ratio: n(row.chain3Ratio),
        chainQualified: row.chainQualified !== false, indirectRaw: raw, indirect: cnt };
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
    '증여10호의3부표2': function () { var r = jmR(); return !!(r && r.과세대상여부 && shRows('jm').some(function (x) { return has(x.chain1Company) || n(x.chain1Ratio) > 0; })); }
  };
  Object.keys(READY).forEach(function (k) {
    var isJm = /^증여10호의3/.test(k);
    ready[k] = function () { try { return !!READY[k](); } catch (e) { return false; } };
    ctxFor[k] = function (extra) { return ready[k]() ? [isJm ? jmCtx(extra) : jtCtx(extra)] : []; };
  });

  // 세목 원본 모양 출력 묶음에는 넣지 않음 — 일반 증여(10호)와 따로 내는 신고서(위 "어디서 찍나")
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '증여특례B', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready, _jmSplit: jmSplit };
});
