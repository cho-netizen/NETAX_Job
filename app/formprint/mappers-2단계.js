/*
 * NxFormPrint 묶음 파일 — 2단계 (계산기·옛 인쇄가 실제로 쓰는데 원본 모양이 없던 서식, 2026-10-20 작업자 2단계)
 * 이 묶음의 서식: 소득103호 · 소득104호 · 소득105호 · 조특52호의2 · 조특11호의8 · 조특11호의10 · 조특11호의13 · 증여10호의5부표1 · 증여10호의5부표2 · 증여10호의6부표1 · 증여10호의6부표2 · 상속1호부표2 · 상속12호의2부표2
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF로 잰 칸 자리(node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음…') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-2단계.js → node tools/formprint-check-ext.js 2단계
 *
 * ── 언제 찍나(지금 인쇄 taxcalc.html의 조건과 같게) ──
 *   조특52호의2  : 사후관리 추징이자 도구 결과(lastClawbackResult_)가 있고 서식 구분(ckFormType)이 'farmland_gift' — farmlandGiftClawbackPrintPageHtml_
 *   조특11호의10 : 같은 도구, 서식 구분 'sr_succession'          — srSuccessionClawbackPrintPageHtml_(…, false)
 *   조특11호의13 : 같은 도구, 서식 구분 'sr_succession_deferred' — srSuccessionClawbackPrintPageHtml_(…, true)
 *     세 장 모두 증여세 신고 뒤 사후관리 위반 때 따로 내는 신고서라 세목 묶음(plan)에는 넣지 않는다(세액인쇄 서식표 줄로 찍음).
 *     수증자·증여자는 지금 인쇄처럼 일반 증여 탭의 첫 번째 사람(giftDonees[0]·giftDonors[0]) — 추징이자 도구에는 사람 칸이 없음.
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
    '조특52호의2': '조세특례제한법 시행규칙 [별지 제52호의2서식]' // 영농자녀 증여세 감면 위반사유 신고 및 자진납부 계산서
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // ───────── 공용 ─────────
  // 세액계산 화면의 결과 변수(let …)는 window 속성이 아니라 전역 이름 — 전역 범위에서 이름으로 읽음(증여특례A와 같은 방법)
  function g(name) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return undefined;
    if (typeof root[name] !== 'undefined') return root[name];
    try { return (new Function('return typeof ' + name + " !== 'undefined' ? " + name + ' : undefined;'))(); } catch (e) { return undefined; }
  }
  function ymdSet(o, key, d, 칸, why) {
    var x = H.ymd(d);
    if (x) o.set(key + '.연', x.y).set(key + '.월', x.m).set(key + '.일', x.d);
    else o.miss(칸, why || '화면 입력 없음');
  }
  // 일반 증여 탭 첫 번째 수증자·증여자(지금 인쇄 farmlandGiftClawbackPrintPageHtml_·srSuccessionClawbackPrintPageHtml_와 같음)
  function giftPeople() {
    var dns = g('giftDonees') || [], drs = g('giftDonors') || [];
    return { donee: dns[0] || {}, donor: drs[0] || {} };
  }
  // 사람 칸(성명·주민등록번호·주소·전화·전자우편) — 키 이름을 받아 채움
  function personCells(o, p, k) {
    if (k.name) o.need(k.name, p.name, k.nameL);
    if (k.reg) o.need(k.reg, p.regNo, k.regL);
    if (k.addr) o.need(k.addr, H.fullAddr(p), k.addrL);
    if (k.phone) { if (has(p.phone)) o.set(k.phone, p.phone); else o.miss(k.phoneL, k.phoneWhy || '화면 입력 없음'); }
    if (k.email) { if (has(p.email)) o.set(k.email, p.email); else o.miss(k.emailL, '화면 입력 없음'); }
  }
  // 사후관리 이자 — calculateClawbackInterestJS 결과(구간별_이자상당액)를 서식 칸 글자로(mappers.js interestCells와 같은 모양)
  function rateText(seg, style) {
    if (seg.일이율 != null) return seg.일이율 >= 0.0003 ? '3/10,000' : Math.round(seg.일이율 * 100000) + '/100,000';
    var p = Math.round(seg.연이율 * 10000) / 100;
    return style === 'perDay' ? p + '%/365' : p + '%';
  }
  function interestCells(cr, style) {
    var segs = (cr && cr.구간별_이자상당액) || [];
    if (!segs.length) return null;
    var total = segs.reduce(function (s, x) { return s + n(x.일수); }, 0);
    if (segs.length === 1) return { single: true, days: n(segs[0].일수), rate: rateText(segs[0], style), seg: segs[0], total: total };
    return { single: false, days: segs.map(function (x) { return n(x.일수); }).join('+') + '=' + total, rate: segs.map(function (x) { return rateText(x, style); }).join(' · '), total: total };
  }
  function interestRecalc(tax, seg) {
    if (seg.일이율 != null) return Math.floor(tax * n(seg.일수) * seg.일이율 + 1e-6);
    return Math.floor(tax * n(seg.일수) * seg.연이율 / 365 + 1e-6);
  }
  // 신고일·신고인·세무대리인·세무서(조특 추징 신고서 세 장이 같은 서명 자리)
  function signCells(o, ctx, who, office) {
    var ta = ctx.taxAgent || {};
    ymdSet(o, '신고일', ctx.신고일, '신고일', 'ctx.신고일 없음(계산기에 없음 — 세액인쇄 화면에서 고른 날)');
    o.need('신고인서명', who, '신고인(서명)');
    if (has(ta.name)) {
      o.set('세무대리인서명', ta.name);
      if (has(ta.mgmtNo)) o.set('세무대리인관리번호', ta.mgmtNo); else o.miss('세무대리인(관리번호)', '세무대리인 관리번호 입력 없음');
      if (has(ta.phone)) o.set('세무대리인전화', ta.phone); else o.miss('세무대리인(☎)', '세무대리인 전화번호 입력 없음');
    } else o.miss('세무대리인(서명)·세무대리인(관리번호)·세무대리인(☎)', '세무대리인 입력 없음(본인 신고)');
    if (has(office)) o.set('세무서', H.officeName(office)); else o.miss('세무서', '수증자 관할 세무서 입력 없음');
  }
  // 추징이자 도구 결과의 세액 칸(증여세액·일수·이자율·이자상당액·납부할 세액) + 서식 식 검산
  function clawTaxCells(o, cr, k, style, want) {
    var tax = n(cr.추징세액), ic = interestCells(cr, style);
    o.set(k.tax, tax);
    if (ic) { o.set(k.days, ic.single ? ic.days : ic.days).set(k.rate, ic.rate); if (!ic.single) o.note(k.days + '·' + k.rate + ' 이자율이 바뀐 기간이 있어 구간별로 적음(일수 합 ' + ic.total + '일)'); }
    else o.miss(k.days + k.rate + ' 일수·이자율', '이자 구간 없음');
    o.set(k.int, n(cr.이자상당액_합계)).set(k.due, n(cr.납부할세액));
    if (ic && ic.single) o.check(k.int + ' = ' + k.tax + ' × ' + k.days + ' × ' + k.rate, n(cr.이자상당액_합계), interestRecalc(tax, ic.seg));
    else if (ic) o.check(k.int + ' = 구간별(' + k.tax + ' × 일수 × 율) 합(원 미만 버림)', n(cr.이자상당액_합계),
      Math.floor((cr.구간별_이자상당액 || []).reduce(function (s, x) { return s + (x.일이율 != null ? tax * n(x.일수) * x.일이율 : tax * n(x.일수) * x.연이율 / 365); }, 0) + 1e-6));
    o.check(k.due + ' = ' + k.tax + ' + ' + k.int, n(cr.납부할세액), tax + n(cr.이자상당액_합계));
    if (want && cr.이자율방식 && cr.이자율방식 !== want) o.note('⚠ 이자율 방식이 서식과 다름(' + (cr.이자율방식_설명 || cr.이자율방식) + ') — 이 서식은 ' + (want === 'daily' ? '1일 고정율(10만분의 22)' : '이율이 바뀐 날마다 나눈 국세환급가산금 이율 ÷ 365'));
  }
  // 사후관리 추징이자 도구(공통 탭 "사후관리 추징이자") — 서식 구분이 그 서식일 때만
  function clawFromApp(type) {
    var cr = g('lastClawbackResult_');
    return (cr && H.el('ckFormType') === type) ? cr : null;
  }

  // ═════════ 조특 별지 제52호의2서식 — 영농자녀 증여세 감면 위반사유 신고 및 자진납부 계산서(조특법 §71②④, 시행령 §68⑦⑮) ═════════
  //  ctx: { clawback: {formType:'farmland_gift', result: lastClawbackResult_, reason: ckFarmlandReason}, donee, donor, taxAgent, 신고일 }
  //  예전 인쇄(farmlandGiftClawbackPrintPageHtml_)는 순번으로 수증자·증여자 성명·주민번호, 위반코드, 증여세액, 기산일·사유발생일, 구간별 이자, 합계를 찍었음.
  var FARM_REASON = { '01': '5년 이내 정당한 사유 없이 양도', '02': '5년 이내 정당한 사유 없이 직접 영농에 종사하지 않게 된 경우' };
  mappers['조특52호의2'] = function (ctx) {
    var o = new Out(), cw = ctx.clawback || {}, cr = cw.result, dn = ctx.donee || {}, dr = ctx.donor || {};
    if (!cr || cw.formType !== 'farmland_gift') { o.miss('조특52호의2 전체', '사후관리 추징이자 계산(서식 구분: 영농자녀 증여세 감면 위반사유 신고) 결과 없음'); return o.result(); }
    o.note('⚠ 수증자·증여자 = 일반 증여 탭의 첫 번째 사람(지금 인쇄와 같음 — 추징이자 도구에는 사람 칸이 없음). 감면받은 영농자녀·자경농민과 다르면 고치세요');
    personCells(o, dn, { name: '①', nameL: '① 수증자 성명', reg: '②', regL: '② 수증자 주민등록번호', addr: '③', addrL: '③ 수증자 주소',
      phone: '③@전화번호', phoneL: '③ 수증자 전화번호', email: '⑤', emailL: '⑤ 전자우편주소' });
    o.miss('④ 증여자와의 관계', '계산기에 없음 — 계산기 관계 값은 공제 구분(직계존속 등)이라 "증여자와의 관계"에 맞는 낱말(자·손자 등)이 아님');
    personCells(o, dr, { name: '⑥', nameL: '⑥ 증여자 성명', reg: '⑦', regL: '⑦ 증여자 주민등록번호', addr: '⑧', addrL: '⑧ 증여자 주소',
      phone: '⑧@전화번호', phoneL: '⑧ 증여자 전화번호', phoneWhy: '계산기에 없음(증여자 카드에 전화 칸 없음)' });
    o.miss('⑨⑩⑪⑫ 신고내용(수증일·재산종류·증여재산가액·비고)', '계산기에 없음 — 추징이자 도구는 감면받은 증여(재산)를 따로 받지 않음(지금 화면의 증여일은 이번 증여 계산의 날이라 당초 감면 증여와 같다고 볼 수 없음)');
    var code = String(cw.reason || '');
    if (FARM_REASON[code]) o.set('⑬', code + ' (' + FARM_REASON[code] + ')');
    else o.miss('⑬ 과세특례 위반코드', '화면 입력 없음(위반유형 ckFarmlandReason)');
    o.note('⑬ 코드표(작성방법 1)에는 법 §71③2호(영농 관련 조세포탈·회계부정 형 확정, 2024.1.1. 시행) 사유가 없음 — 그 사유면 코드를 직접 확인(판단 대기)');
    clawTaxCells(o, cr, { tax: '⑭', days: '⑮', rate: '⑯', int: '⑰', due: '⑱' }, 'daily', 'daily');
    signCells(o, ctx, dn.name, dn.taxOffice);
    return o.result();
  };
  ctxFor['조특52호의2'] = function (extra) {
    var cr = clawFromApp('farmland_gift'); if (!cr) return null;
    return Object.assign(giftPeople(), { clawback: { formType: 'farmland_gift', result: cr, reason: H.el('ckFarmlandReason') }, taxAgent: H.agent() }, extra || {});
  };
  ready['조특52호의2'] = function () { return !!clawFromApp('farmland_gift'); };

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만) — 추징 신고서는 신고 뒤 따로 내는 서류라 넣지 않음
  function plan(tax, ctx) { var L = []; return L; }
  return { 묶음: '2단계', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
