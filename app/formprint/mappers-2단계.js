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
 *   조특11호의8  : 특례세율 결과(lastSpecialRateGiftResult_)가 가업승계주식등 — srBusinessSuccessionApplicationPrintPageHtml_ (서식표 sr 줄에 이 서식 쪽이 붙음)
 *   소득103호·104호 : 국외전출자 결과(lastExitTaxInput_·lastExitTaxResult_)가 있음, 소득105호 : 거기에 "납부유예를 신청함" — exitTaxPrintFormPageHtml_
 *   증여10호의5·10호의6 부표1 : 초과배당·특정법인 결과가 있음(예전 인쇄엔 없던 장), 부표2 : 거기에 일반 증여 탭 재산평가의 서화·골동품이 있음 — gfArtworkPrintPageHtml_
 *   상속1호부표2 : 가업상속공제 계산 내역이 있고 납부유예를 고르지 않음, 상속12호의2부표2 : 가업상속 납부유예세액 > 0 — ihBizAssetListPrintPageHtml_ (상속 묶음 plan에도 붙임)
 *   ⚠ 세액인쇄 서식표(taxcalc.html PRINT_REGISTRY_)에서 사후관리 추징(clawback)·국외전출자(exittax)·초과배당(ed)·특정법인(sc) 줄은 서식번호가 하나뿐이라
 *     52호의2·11호의10·11호의13·103~105호·10호의5/6 부표 줄이 따로 없다 — 그 줄(subForms)이 생겨야 📄 원본 모양 단추가 뜸(이 파일은 taxcalc.html을 고치지 않음).
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
    '조특52호의2': '조세특례제한법 시행규칙 [별지 제52호의2서식]', // 영농자녀 증여세 감면 위반사유 신고 및 자진납부 계산서
    '조특11호의10': '조세특례제한법 시행규칙 [별지 제11호의10서식]', // 가업승계 증여세 과세특례 추징사유 신고 및 자진납부 계산서
    '조특11호의13': '조세특례제한법 시행규칙 [별지 제11호의13서식]', // 납부유예 사후관리추징사유 신고 및 자진납부 계산서
    '조특11호의8': '조세특례제한법 시행규칙 [별지 제11호의8서식]', // 가업승계 주식 등 증여세 과세특례 적용신청서
    '소득103호': '소득세법 시행규칙 [별지 제103호서식]', // 국외전출자 양도소득세 세액공제신청서, 국외전출자 국내주식등 양도내역서
    '소득104호': '소득세법 시행규칙 [별지 제104호서식]', // 국외전출자국내주식등 보유현황 신고서
    '소득105호': '소득세법 시행규칙 [별지 제105호서식]', // 국외전출자 납부유예신청서
    '증여10호의5부표1': '상속세 및 증여세법 시행규칙 [별지 제10호의5서식 부표1]', // 증여재산 및 평가명세서(초과배당)
    '증여10호의5부표2': '상속세 및 증여세법 시행규칙 [별지 제10호의5서식 부표2]', // 서화·골동품 등 증여재산 명세서(초과배당)
    '증여10호의6부표1': '상속세 및 증여세법 시행규칙 [별지 제10호의6서식 부표1]', // 증여재산 및 평가명세서(특정법인)
    '증여10호의6부표2': '상속세 및 증여세법 시행규칙 [별지 제10호의6서식 부표2]', // 서화·골동품 등 증여재산 명세서(특정법인)
    '상속1호부표2': '상속세 및 증여세법 시행규칙 [별지 제1호서식 부표2]', // 가업용 자산 명세
    '상속12호의2부표2': '상속세 및 증여세법 시행규칙 [별지 제12호의2서식 부표2]' // 가업용 자산 명세(납부유예)
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
  function comma(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
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
    if (ic) { o.set(k.days, ic.single ? comma(ic.days) : ic.days).set(k.rate, ic.rate); if (!ic.single) o.note(k.days + '·' + k.rate + ' 이자율이 바뀐 기간이 있어 구간별로 적음(일수 합 ' + ic.total + '일)'); }
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
    var pr0_ = (typeof g('giftPairRelation_') === 'function') ? g('giftPairRelation_')(dr, 0) : { relation: dr.relation, genSkip: dr.genSkip };
    var rw_ = H.relWord ? H.relWord(pr0_.relation, pr0_.genSkip, dn.regNo) : ''; // [2026.10.20 감사 A] 수증자 기준 낱말(10호 ⑦과 같음)
    if (rw_) o.set('④', rw_); else o.miss('④ 증여자와의 관계', '관계가 기타친족 등이라 낱말을 정할 수 없음 — 직접 적을 것');
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

  // ═════════ 조특 별지 제11호의10서식(가업승계 증여세 과세특례 추징, 법 §30의6③⑧·시행령 §27의6⑤⑬)
  //          ·제11호의13서식(가업승계 증여세 납부유예 사후관리 추징, 법 §30의7③④·시행령 §27의7⑭) ═════════
  //  ctx: { clawback: {formType:'sr_succession'|'sr_succession_deferred', result, reason: ckSuccessionReason, reDeferral}, donee, donor, taxAgent, 신고일 }
  //  예전 인쇄(srSuccessionClawbackPrintPageHtml_)는 순번으로 수증자·증여자 성명·주민번호, 위반코드, 증여세액, 기산일·사유발생일, 구간별 이자, 합계를 찍었음.
  var SR_REASON = { '01': '가업을 승계하지 않은 경우', '02': '가업을 승계한 후 가업에 종사하지 않은 경우', '03': '가업을 승계한 후 가업을 휴업하거나 폐업한 경우',
    '04': '가업을 승계한 후 증여받은 주식등의 지분이 줄어드는 경우', '05': '가업을 승계한 후 고용유지 요건을 위반한 경우' };
  function srClawMapper(is13) {
    var type = is13 ? 'sr_succession_deferred' : 'sr_succession';
    return function (ctx) {
      var o = new Out(), cw = ctx.clawback || {}, cr = cw.result, dn = ctx.donee || {}, dr = ctx.donor || {};
      if (!cr || cw.formType !== type) { o.miss((is13 ? '조특11호의13' : '조특11호의10') + ' 전체', '사후관리 추징이자 계산(서식 구분: ' + (is13 ? '가업승계 납부유예 사후관리추징' : '가업승계 주식등 과세특례 추징') + ') 결과 없음'); return o.result(); }
      o.note('⚠ 수증자·증여자 = 일반 증여 탭의 첫 번째 사람(지금 인쇄와 같음 — 추징이자 도구에는 사람 칸이 없음). 가업승계 주식등을 받은 사람과 다르면 고치세요');
      personCells(o, dn, { name: '①', nameL: '① 수증자 성명', reg: '②', regL: '② 수증자 주민등록번호', addr: '④', addrL: '④ 수증자 주소', email: '⑤', emailL: '⑤ 전자우편주소' });
      o.set('③', dn.resident === 'nonresident' ? '비거주자' : '거주자');
      if (has(dn.phone)) { var mob = H.isMobile(dn.phone); o.set(mob ? '⑥@휴대전화' : '⑥@자택', dn.phone).miss('⑥ 수증자 전화번호(' + (mob ? '자택' : '휴대전화') + ')', '화면에 수증자 전화번호 칸이 하나뿐(01x로 시작하면 휴대전화 칸, 아니면 자택 칸 — 기본값 2)'); }
      else o.miss('⑥ 수증자 전화번호', '화면 입력 없음');
      o.miss('⑦ 증여자와의 관계', '계산기에 없음 — 계산기 관계 값은 공제 구분(직계존속 등)이라 작성방법 3의 낱말(자 등)이 아님');
      personCells(o, dr, { name: '⑧', nameL: '⑧ 증여자 성명', reg: '⑨', regL: '⑨ 증여자 주민등록번호', addr: '⑪', addrL: '⑪ 증여자 주소' });
      o.miss('⑩ 증여일자', '계산기에 없음 — 추징이자 도구는 당초 ' + (is13 ? '납부유예' : '특례') + ' 증여의 날을 받지 않음(화면 증여일은 이번 증여 계산의 날)');
      o.miss('⑫ 증여자 전화번호', '계산기에 없음(증여자 카드에 전화 칸 없음)');
      o.miss('⑬⑭⑮⑯⑰⑱⑲·계 1. 증여재산', '계산기에 없음 — 추징이자 도구는 당초 증여받은 주식등(재산)을 받지 않음');
      var code = String(cw.reason || '');
      if (SR_REASON[code] && (is13 || code !== '05')) o.set('⑳', code + ' (' + SR_REASON[code] + ')');
      else o.miss('⑳ 사후관리 위반코드', '화면 입력 없음(위반유형 ckSuccessionReason)');
      if (is13) o.note('⑳ 코드표에는 법 §30의7③4호(거주자 사망으로 상속 개시) 사유가 없고, 계산기 위반유형에는 05(고용유지 요건 위반, ③3호)가 없음 — 그 사유면 코드를 직접 확인(판단 대기)');
      else o.note('⑳ 코드표에는 법 §30의6④2호(가업 경영 관련 조세포탈·회계부정 형 확정, 2024.1.1. 시행) 사유가 없음 — 그 사유면 코드를 직접 확인(판단 대기)');
      clawTaxCells(o, cr, { tax: '㉑', days: '㉒', rate: '㉓', int: '㉔', due: '㉕' }, is13 ? 'perDay' : 'daily', is13 ? 'split' : 'daily');
      if (is13 && cr.이자율방식 === 'split') {
        o.note('㉓ 이자율 = 국세환급가산금 이율(국세기본법 시행령 §43의3②) ÷ 365 — 서식 작성방법 11은 "취소·변경 당시 율"만 적었으나 시행령 §27의7⑭3호 단서대로 율이 바뀐 날마다 나눠 찍음');
        if ((cr.이자율방식_설명 || '').indexOf('50%') >= 0) o.note('㉓ 재차 납부유예(법 §30의7⑥) — 율 × 50%');
      }
      signCells(o, ctx, dn.name, dn.taxOffice);
      return o.result();
    };
  }
  mappers['조특11호의10'] = srClawMapper(false);
  mappers['조특11호의13'] = srClawMapper(true);
  [['조특11호의10', 'sr_succession'], ['조특11호의13', 'sr_succession_deferred']].forEach(function (p) {
    ctxFor[p[0]] = function (extra) {
      var cr = clawFromApp(p[1]); if (!cr) return null;
      return Object.assign(giftPeople(), { clawback: { formType: p[1], result: cr, reason: H.el('ckSuccessionReason') }, taxAgent: H.agent() }, extra || {});
    };
    ready[p[0]] = function () { return !!clawFromApp(p[1]); };
  });

  // ═════════ 조특 별지 제11호의8서식 — 가업승계 주식 등 증여세 과세특례 적용신청서(법 §30의6⑤ → §30의5⑫ 준용) ═════════
  //  ctx: { r: lastSpecialRateGiftResult_(특례종류 가업승계), sr: {giftDate: srGiftDate, businessYears: srBusinessYears}, donee, donor, taxAgent, 신고일 }
  //  예전 인쇄(srBusinessSuccessionApplicationPrintPageHtml_)는 "과세특례 적용대상 증여세 과세가액"·"가업자산상당액" 두 줄과 "직접 보완" 안내만 찍었음.
  var SUCCESSION = '가업승계주식등(조특법 §30의6)';
  mappers['조특11호의8'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, sr = ctx.sr || {}, dn = ctx.donee || {}, dr = ctx.donor || {};
    if (r.특례종류 !== SUCCESSION) { o.miss('조특11호의8 전체', '특례세율 계산 결과가 가업승계주식등(조특법 §30의6)이 아님'); return o.result(); }
    o.miss('가.상호(법인명)·사업자등록번호·성명(대표이사)·생년월일·개업연월일·업종', '계산기에 없음 — 특례세율 탭에 가업 법인 인적사항 칸 없음');
    o.miss('나.중소기업 여부·상장여부(상장일)·중견기업 여부·직전 3개 사업연도 평균 매출액', '계산기에 없음 — 특례세율 탭은 중소·중견기업 요건을 묻지 않음(법 §30의6①)');
    o.note('⚠ 증여자·수증자 = 일반 증여 탭의 첫 번째 사람(특례세율 탭에 사람 칸이 없음 — 10호의2 본표와 같은 방법)');
    o.need('다@성명', dr.name, '다.증여자 성명').need('다@주민등록번호', dr.regNo, '다.증여자 주민등록번호');
    if (n(sr.businessYears) > 0) o.set('다@가업영위기간', n(sr.businessYears) + '년'); else o.miss('다.가업영위기간', '화면 입력 없음(특례세율 탭 가업영위기간)');
    o.miss('다.대표이사 재직기간·최대주주등 여부·특수관계인포함 보유 주식 등 지분율', '계산기에 없음 — 요건 칸 없음(시행령 §27의6①1호)');
    o.need('라@성명', dn.name, '라.수증자 성명').need('라@주민등록번호', dn.regNo, '라.수증자 주민등록번호').need('라@주소', H.fullAddr(dn), '라.주소');
    if (has(dn.phone)) o.set('라@전화번호', dn.phone); else o.miss('라.전화번호(☎)', '화면 입력 없음');
    o.miss('라.증여자와의 관계·임원/대표이사 취임일', '계산기에 없음 — 관계 값은 공제 구분(직계존속 등)이라 관계 낱말이 아니고, 취임일 칸 없음(시행령 §27의6①2호)');
    // 마. — 한 줄(특례세율 탭은 이번 증여 한 건)
    var gd = sr.giftDate;
    if (has(gd)) o.set('마@수증일', [gd]); else o.miss('마.수증일', '화면 입력 없음(특례세율 탭 증여일자)');
    o.miss('㉮ 수량·마.지분율·㉯ 단가', '계산기에 없음 — 특례세율 탭은 주식 가액 합계(증여재산가액)만 받음');
    var g1 = n(r.증여재산가액), cur = n(r.과세특례적용대상_증여세과세가액);
    o.set('①', [g1]).set('②', [cur]);
    o.note('① 주식 등 가액 = 엔진 증여재산가액(특례세율 탭 입력) — 작성방법 4: 2인 이상이 증여받았으면 1인이 모두 받은 것으로 본 전체 가액(법 §30의6②)');
    o.note('② = 별지 제10호의2서식 부표2 ⑫(작성방법 6) — 엔진 과세특례적용대상_증여세과세가액');
    var lim = n(r.총한도액), prior = n(r.가산_과세특례증여재산), s8 = n(r.과세특례적용전_증여세과세가액_계);
    o.check('② = 부표2 ⑫(⑧ < ⑨이면 ⑧ − ⑦, 아니면 min(⑧, ⑪))', cur, s8 < lim ? s8 - prior : Math.min(s8, Math.max(0, lim - prior)));
    // [2026.10.22 검토대상 증여-14] 2023년 전 증여는 그때 한도(2008~2014 30억, 2015~2022 100억)
    var gd8_ = String(sr.giftDate || ctx.giftDate || '').slice(0, 10), old8_ = gd8_ && gd8_ < '2023-01-01' ? (gd8_ < '2015-01-01' ? 3000000000 : 10000000000) : 0;
    if (n(sr.businessYears) > 0) o.check('총한도액 = ' + (old8_ ? '그때 한도(' + gd8_ + ' 증여, ' + (old8_ / 1e8) + '억)' : '가업영위기간 표(10~20년 300억·20~30년 400억·30년 이상 600억, 법 §30의6①)'), lim,
      old8_ ? old8_ : (n(sr.businessYears) >= 30 ? 60000000000 : n(sr.businessYears) >= 20 ? 40000000000 : n(sr.businessYears) >= 10 ? 30000000000 : 0));
    ymdSet(o, '신청일', ctx.신고일, '신청일', 'ctx.신고일 없음(계산기에 없음 — 세액인쇄 화면에서 고른 날)');
    o.need('신청인서명', dn.name, '신청인(서명)');
    if (has(dn.taxOffice)) o.set('세무서', H.officeName(dn.taxOffice)); else o.miss('세무서', '수증자 관할 세무서 입력 없음');
    return o.result();
  };
  ctxFor['조특11호의8'] = function (extra) {
    var r = g('lastSpecialRateGiftResult_'); if (!r || r.특례종류 !== SUCCESSION) return null;
    return Object.assign(giftPeople(), { r: r, sr: { giftDate: H.el('srGiftDate'), businessYears: n(H.el('srBusinessYears')) }, taxAgent: H.agent() }, extra || {});
  };
  // 지금 인쇄(srPrintFormPageHtml_ → srBusinessSuccessionApplicationPrintPageHtml_)와 같은 조건 — 특례세율 결과가 가업승계주식등
  ready['조특11호의8'] = function () { var r = g('lastSpecialRateGiftResult_'); return !!(r && r.특례종류 === SUCCESSION); };

  // ═════════ 소득 별지 제103호·제104호·제105호서식 — 국외전출자(소득세법 §118의9~§118의16, 시행령 §178의9~§178의12) ═════════
  //  ctx: { et: { input: lastExitTaxInput_, result: lastExitTaxResult_ (calculateExitTaxJS) }, 신고일 }
  //  국외전출자 계산 카드(양도 탭 "국외전출자")에는 사람 칸이 없다 — 인적사항 ①~⑦은 비우고 이유를 남김(지금 인쇄도 "직접 보완" 안내).
  //  예전 인쇄(exitTaxPrintFormPageHtml_)는 84호 쪽 뒤에 103호(실제 양도가액·외국납부세액·원천세액·공제구분 4줄), 104호(출국일·납세관리인·시가 4줄),
  //  105호(납부유예 신청 때만 — 납세관리인·담보·신청세액·기간 4줄)를 붙였음.
  var NOPERSON = '계산기에 없음 — 국외전출자 계산 카드에 사람 칸이 없음(지금 인쇄도 "인적사항은 직접 보완" 안내)';
  function etOf(ctx) { var et = ctx.et || {}; return { inp: et.input || {}, r: et.result || null }; }
  function exitPersonMiss(o, signKey, signLabel) {
    o.miss('①②③④⑤⑥⑦ 국외전출자 인적사항(성명·주민등록번호·국내 주소·거주할 국가명·코드·외국 주소·전화·전자우편)', NOPERSON);
    o.miss(signLabel, NOPERSON);
    o.miss('세무서', '계산기에 없음 — 국외전출자 관할 세무서 칸 없음');
  }
  mappers['소득103호'] = function (ctx) {
    var o = new Out(), e = etOf(ctx), inp = e.inp, r = e.r;
    if (!r) { o.miss('소득103호 전체', '국외전출자 계산 결과 없음'); return o.result(); }
    exitPersonMiss(o, '신청인서명', '신청인(서명)');
    if (has(inp.departureDate)) o.set('⑧', inp.departureDate); else o.miss('⑧ 국외전출일', '화면 입력 없음(출국일)');
    o.miss('⑨ 양도세 신고일', '계산기에 없음(출국 때 국외전출세를 신고한 날)');
    var tax = n(r.산출세액);
    o.set('⑩', tax).set('⑭', tax);
    o.note('⑩ 신고 납부세액 = 엔진 산출세액(출국일 시가로 계산한 국외전출세) — 실제로 신고한 세액과 다르면 고칠 것');
    o.miss('⑪⑫⑬ 세액공제 기 공제분 누계액', '계산기에 없음 — 앞서 받은 조정공제·외국납부·원천납부 공제를 받지 않음(엔진은 0으로 보고 ⑭ = ⑩)');
    // [2026.10.20 서식 감사(양도)] ⑰ "출국시 양도소득금액(⑮−⑯)" — ⑮·⑯은 엔진 출국일시가·필요경비(국내주식등만)라 ⑰도 서식 식대로 ⑮ − ⑯.
    //  엔진 양도소득금액은 2027.1.1. 이후 출국이면 국외주식등 소득까지 합친 값이라 그대로 쓰면 ⑰ ≠ ⑮ − ⑯ (2026년 이전 출국은 같은 값)
    var dv = n(r.출국일시가), ne = n(r.필요경비), inc = Math.max(0, dv - ne);
    o.set('⑮', dv).set('⑯', ne).set('⑰', inc);
    if (r.국외주식등_과세여부) o.note('2027.1.1. 이후 출국 — 엔진 양도소득금액 ' + n(r.양도소득금액) + '원은 국외주식등까지 합친 값, ⑰은 국내주식등(⑮ − ⑯)만. 국외주식등 조정공제·세액은 이 서식(2024.12.31. 판) 칸에 없음 — 서식 개정 확인 필요');
    else o.check('⑰ = ⑮ − ⑯ = 엔진 양도소득금액', inc, n(r.양도소득금액));
    o.set('부표합계@출국양도가액', dv).set('부표합계@출국필요경비', ne);
    o.miss('부표 종목별 줄(양도일·사업자번호·법인명·금액)', '계산기에 없음 — 국외전출자 카드는 종목별 명세를 받지 않음(합계 줄만 찍음)');
    var hasActual = has(inp.actualTransferPrice);
    if (!hasActual) {
      o.note('⚠ 실제 양도가액이 없음 — 세액공제신청서는 출국 뒤 실제 양도했을 때 내는 서식(시행령 §178의10: 실제 양도한 날부터 2년 이내)');
      o.miss('⑱⑲⑳㉑㉒ 실제 양도내용·㉓ 세율 ㉔㉕㉖ 조정공제·㉗㉘㉙ 외국납부·㉚㉛㉜ 원천납부·㉝㉞㉟㊱ 합계·부표 합계 실제 양도 칸', '해당 없음 — 실제 양도가액 입력 없음(아직 양도 전)');
      ymdSet(o, '신청일', ctx.신고일, '신청일', 'ctx.신고일 없음(계산기에 없음)');
      return o.result();
    }
    var ap = n(inp.actualTransferPrice), ai = ap - ne;
    o.set('⑱', ap).set('⑲', ne).set('⑳', ai).set('부표합계@실제양도가액', ap).set('부표합계@실제필요경비', ne);
    o.note('⑲ 실제 필요경비 = 출국시 필요경비와 같은 값(법 §118의13①은 양쪽 모두 §118의10② 필요경비 — 엔진도 같은 값)');
    var ft = n(inp.foreignTaxPaid), ns = n(inp.nonresidentSourceTaxEquivalent);
    if (ft > 0) o.set('㉑', ft).set('부표합계@외국납부세액', ft); else o.miss('㉑ 외국납부세액·부표 합계 외국납부세액', '해당 없음 — 입력 없음');
    if (ns > 0) o.set('㉒', ns).set('부표합계@원천납부세액', ns); else o.miss('㉒ 원천납부세액·부표 합계 원천납부세액', '해당 없음 — 입력 없음');
    // 4. 조정공제(법 §118의12①) — 실제 양도가액이 출국시 양도가액보다 낮을 때
    var adj = n(r.조정공제액);
    if (ap < dv) {
      // [2026.10.20 서식 감사(양도)] 세율은 엔진 조정공제와 같게 국내주식등 과세표준으로(법 §118의12①·§118의11 1호) — 2027~ 국외주식등이 합쳐진 전체 과세표준이 아님
      var dec = dv - ap, rate = n(has(r.국내주식등_과세표준) ? r.국내주식등_과세표준 : r.과세표준) > 300000000 ? 25 : 20, t24 = Math.round(dec * rate / 100), t25 = Math.min(tax, t24);
      o.set('㉓', dec).set('세율', rate + '%').set('㉔', t24).set('㉕', t25).set('㉖', adj);
      o.check('㉓ = ⑮ − ⑱', dec, dv - ap);
      o.check('㉕ = Min(⑭, ㉔)', t25, Math.min(tax, t24));
      o.check('㉖ = ㉕(엔진 조정공제액)', adj, t25);
      o.note('세율 = 출국 때 과세표준이 3억원을 넘으면 25%, 아니면 20%(엔진이 쓴 한계세율 — 법 §118의12①은 "제118조의11에 따른 세율"이라고만 함, 확인 필요)');
    } else o.miss('㉓ 세율 ㉔ ㉕ ㉖ 조정공제', '해당 없음 — 실제 양도가액이 출국시 양도가액보다 낮지 않음(법 §118의12①)');
    var after = Math.max(0, tax - adj), fc = n(r.외국납부세액공제), nc = n(r.비거주자국내원천세액공제);
    // 5. 외국납부세액공제(법 §118의13①) — 엔진(법문) 식으로 ㉘, 서식 식(㉑×⑰/⑳)과 다르면 알림
    if (fc > 0) {
      var basis = adj > 0 ? ap : dv, t28 = ai > 0 ? Math.round(ft * (basis - ne) / ai) : 0, form28 = ai > 0 ? Math.round(ft * inc / ai) : 0;
      o.set('㉗', after).set('㉘', t28).set('㉙', fc);
      o.check('㉗ = ⑭ − ㉖', after, Math.max(0, tax - adj));
      o.check('㉙ = Min(㉗, ㉘)', fc, Math.min(after, t28));
      if (form28 !== t28) o.note('⚠ 판단 대기: ㉘ 서식 식(㉑ × ⑰ ÷ ⑳) = ' + form28 + '원 ↔ 법 §118의13①(조정공제에 해당하면 분자에 실제 양도가액) = ' + t28 + '원 — 법(엔진)대로 찍음');
    } else o.miss('㉗㉘㉙ 외국납부세액공제', ft > 0 ? '엔진이 적용하지 않음(실제 양도소득금액이 0 이하이거나 비거주자 공제를 적용)' : '해당 없음 — 외국납부세액 입력 없음');
    // 6. 비거주자의 국내원천소득 세액공제(법 §118의14①) — §156①7호 금액 그대로(엔진), 서식 식(㉒×⑰/⑳)과 다르면 알림
    if (nc > 0) {
      var form31 = ai > 0 ? Math.round(ns * inc / ai) : 0;
      o.set('㉚', after).set('㉛', ns).set('㉜', nc);
      o.check('㉚ = ⑭ − ㉖', after, Math.max(0, tax - adj));
      o.check('㉜ = Min(㉚, ㉛)', nc, Math.min(after, ns));
      if (form31 !== ns) o.note('⚠ 판단 대기: ㉛ 서식 식(㉒ × ⑰ ÷ ⑳) = ' + form31 + '원 ↔ 법 §118의14①(§156①7호 금액을 그대로) = ' + ns + '원 — 법(엔진)대로 찍음');
    } else o.miss('㉚㉛㉜ 원천납부세액공제', ns > 0 ? '엔진이 적용하지 않음(외국납부세액공제를 먼저 적용)' : '해당 없음 — 원천납부세액 입력 없음');
    if (ft > 0 && ns > 0) o.note('⚠ 계산 오류 의심: 외국납부세액과 원천납부세액이 둘 다 있음 — 법 §118의14②는 비거주자 국내원천소득 세액공제를 하면 외국납부세액공제를 적용하지 않는다고 정함. 엔진은 외국납부세액공제를 먼저 적용함');
    // 7. 합계
    o.set('㉝', adj);
    if (fc > 0) o.set('㉞', fc); else o.miss('㉞ 외국납부세액 공제액', '해당 없음');
    if (nc > 0) o.set('㉟', nc); else o.miss('㉟ 원천납부세액 공제액', '해당 없음');
    o.set('㊱', adj + fc + nc);
    o.check('㊱ = ㉝ + ㉞ 또는 ㉝ + ㉟', adj + fc + nc, adj + (fc > 0 ? fc : nc));
    ymdSet(o, '신청일', ctx.신고일, '신청일', 'ctx.신고일 없음(계산기에 없음)');
    return o.result();
  };
  mappers['소득104호'] = function (ctx) {
    var o = new Out(), e = etOf(ctx), inp = e.inp, r = e.r;
    if (!r) { o.miss('소득104호 전체', '국외전출자 계산 결과 없음'); return o.result(); }
    exitPersonMiss(o, '신고인서명', '신고인(서명)');
    if (has(inp.departureDate)) o.set('⑧', inp.departureDate); else o.miss('⑧ 국외전출(예정)일', '화면 입력 없음(출국일)');
    o.miss('⑨⑩⑪⑫⑬ 국내주식 등 보유 현황(법인명·사업자등록번호·주식수·액면총액·지분율)', '계산기에 없음 — 국외전출자 카드는 출국일 시가 합계(' + n(r.출국일시가) + '원)만 받음(종목별 명세 칸 없음)');
    if (inp.holdingReportNotFiled) o.note('보유현황 미신고·누락 가산세(법 §118의15④) ' + n(r.보유현황미신고가산세) + '원 = 화면 액면금액 ' + n(inp.faceValueForPenalty) + '원 × 2% — 이 신고서를 늦게 내는 경우');
    if (has(inp.taxManagerName)) o.note('납세관리인(' + inp.taxManagerName + ')은 이 서식 칸이 아님 — 국세기본법 시행규칙 별지 제43호서식 납세관리인 신고서로 함께 냄(시행령 §178의11①)');
    ymdSet(o, '신고일', ctx.신고일, '신고일', 'ctx.신고일 없음(계산기에 없음)');
    var d0 = H.ymd(inp.departureDate), d1 = H.ymd(ctx.신고일);
    if (d0 && d1 && String(ctx.신고일).slice(0, 10) >= String(inp.departureDate).slice(0, 10)) o.note('⚠ 신고일이 출국일과 같거나 뒤 — 보유현황은 출국일 전날까지 신고(법 §118의15①)');
    return o.result();
  };
  mappers['소득105호'] = function (ctx) {
    var o = new Out(), e = etOf(ctx), inp = e.inp, r = e.r;
    if (!r) { o.miss('소득105호 전체', '국외전출자 계산 결과 없음'); return o.result(); }
    exitPersonMiss(o, '신청인서명', '신청인(서명)');
    if (!inp.deferralRequested) o.note('⚠ 화면 "납부유예를 신청함"이 꺼져 있음 — 지금 인쇄는 이때 이 서식을 만들지 않음');
    if (has(inp.departureDate)) o.set('⑧', inp.departureDate); else o.miss('⑧ 국외전출(예정)일', '화면 입력 없음(출국일)');
    o.miss('⑨ 신고일', '계산기에 없음(국외전출세 신고일 — 이 신청서는 신고서와 함께 냄, 시행령 §178의12④)');
    var due = Math.max(0, n(r.납부세액_합계) - n(r.지방소득세));
    o.set('⑩', n(r.출국일시가)).set('⑪', n(inp.acquisitionPrice)).set('⑫', due).set('⑬', due);
    o.note('⑫ 납부할 세액 = 엔진 납부세액 합계 − 지방소득세(국세분, 보유현황 미신고가산세 포함 — 법 §118의15④는 산출세액에 더함). ⑬ = ⑫ 전액(법 §118의16① "양도소득세 납부의 유예", 지금 인쇄와 같음 — 일부만 신청하면 고칠 것)');
    if (n(inp.otherNecessaryExpenses) > 0) o.note('⑪ 취득가액 = 화면 취득가액만(기타 필요경비 ' + n(inp.otherNecessaryExpenses) + '원은 넣지 않음)');
    if (has(inp.actualTransferPrice)) o.note('⚠ 실제 양도가액이 입력돼 있어 ⑫에 조정공제·외국납부 공제가 반영됨 — 납부유예신청서는 출국 때(실제 양도 전) 신고와 함께 내는 서식');
    o.miss('가 국외전출세를 신고할 것(충족·미충족)', '계산기에 없음(신고 여부 칸 없음)');
    if (inp.collateralProvided) o.set('나@요건', '충족'); else o.miss('나 납세담보를 제공할 것(충족·미충족)', '화면 "납세담보를 제공함"이 꺼져 있어 알 수 없음(지금 인쇄는 "미확인")');
    o.miss('다 납세관리인을 신고할 것(충족·미충족)', '계산기에 없음 — 납세관리인 성명' + (has(inp.taxManagerName) ? '(' + inp.taxManagerName + ')' : '') + '은 있으나 신고했는지는 받지 않음');
    o.miss('사유 납부유예를 받으려는 사유([ ]유학·[ ]그 밖의 사유)', '계산기에 없음(유학 여부 칸 없음 — 유학이면 10년, 법 §118의16②)');
    var d0 = H.ymd(inp.departureDate);
    if (d0) o.set('기간@시작.연', d0.y).set('기간@시작.월', d0.m).set('기간@시작.일', d0.d); else o.miss('기간 시작', '화면 입력 없음(출국일)');
    o.miss('기간 끝(년 월 일까지)', '계산기에 없음 — 실제 양도할 때까지, 출국일부터 5년(유학 10년) 안(법 §118의16①②)');
    o.miss('⑭⑮⑯⑰ 유학 명세(교육기관·시작일·예상 종료일·비고)', '계산기에 없음');
    ymdSet(o, '신청일', ctx.신고일, '신청일', 'ctx.신고일 없음(계산기에 없음)');
    return o.result();
  };
  function etFromApp() {
    var inp = g('lastExitTaxInput_'), r = g('lastExitTaxResult_');
    return (inp && r) ? { input: inp, result: r } : null;
  }
  ['소득103호', '소득104호', '소득105호'].forEach(function (k) {
    ctxFor[k] = function (extra) { var et = etFromApp(); if (!et || (k === '소득105호' && !et.input.deferralRequested)) return null; return Object.assign({ et: et }, extra || {}); };
    // 지금 인쇄(exitTaxPrintFormPageHtml_)와 같은 조건 — 103·104호는 국외전출자 결과가 있으면, 105호는 "납부유예를 신청함"일 때만
    ready[k] = function () { var et = etFromApp(); return !!(et && (k !== '소득105호' || et.input.deferralRequested)); };
  });

  // ═════════ 상증 별지 제10호의5서식·제10호의6서식 부표1(증여재산 및 평가명세서)·부표2(서화·골동품 등 증여재산 명세서) ═════════
  //  부표1 ctx: { r: lastExcessDividendGiftResult_ | lastSpecificCorpGiftResult_, input: {priorGiftAmount} } — 계 ⑨ = 본표 ⑲(10호의5)·⑳(10호의6), ⑭ = 본표 ⑳·㉖ 가산액
  //    (예전 인쇄는 부표1을 만들지 않았음. 초과배당·특정법인 탭은 재산 명세를 받지 않아 ①~⑧ 줄은 비움)
  //  부표2 ctx: { arts: [{code, artist, title, year, material, size, value}], donee } — 지금 인쇄 gfArtworkPrintPageHtml_와 같은 값
  //    (일반 증여 탭 재산평가의 서화·골동품 전부, 배분 전 전액, 수증자 = giftDonees[0]) — 10호의5·10호의6 본표 뒤에 붙던 "[별지 제10호의5·10호의6서식 부표]" 한 장
  //  세 신고서(10호의5·10호의6)는 일반 증여(10호)와 따로 내는 신고서라 세목 묶음(plan)에 넣지 않음(증여특례A 본표와 같은 판단).
  var G10 = {
    '10호의5': { res: 'lastExcessDividendGiftResult_', prior: 'edPriorAmount', tab: '초과배당', gift: '⑲', agg: '⑳' },
    '10호의6': { res: 'lastSpecificCorpGiftResult_', prior: 'scPriorAmount', tab: '특정법인', gift: '⑳', agg: '㉖' }
  };
  // 증여재산가산액 — 증여특례A aggOf와 같은 식(엔진 giftAggregationAmount: 1천만원 미만이면 0, 입력이 없으면 과세표준에서 되살림)
  function aggOf(r, inp, giftAmt) {
    if (has(inp.priorGiftAmount)) { var v = n(inp.priorGiftAmount); return v >= 10000000 ? v : 0; }
    if (n(r.과세표준) > 0) return Math.max(0, n(r.과세표준) + n(r.증여재산공제) + n(r.감정평가수수료공제) + n(r.재해손실공제) - giftAmt);
    return 0;
  }
  function g10Bupyo1(h) {
    var D = G10[h];
    return function (ctx) {
      var o = new Out(), r = ctx.r;
      if (!r) { o.miss('부표1 전체', D.tab + ' 증여세 계산 결과 없음'); return o.result(); }
      o.miss('①②③④⑤⑥⑦⑧·국외자산여부·국외재산국가명 재산 명세(9줄)', '계산기에 없음 — ' + D.tab + ' 탭은 증여재산 명세(재산구분·재산종류·소재지·법인명·수량·평가기준)를 받지 않음(계 ⑨만 본표 값으로)');
      var gv = n(r.증여의제이익);
      if (r.과세대상여부 === false) o.note('⚠ 엔진: 과세대상 아님 — ' + (r.안내 || '') + ' (⑨에 0을 찍음)');
      o.set('⑨', gv);
      o.miss('⑩⑪⑫⑬ 비과세·과세가액불산입', h === '10호의5' ? '해당 없음 — 초과배당 신고서(본표)에 비과세·과세가액불산입 칸이 없음(엔진 0)' : '계산기에 없음 — 특정법인 탭에 입력 칸 없음(엔진 0, 본표 ㉑~㉔도 비움)');
      o.set('⑭', aggOf(r, ctx.input || {}, gv));
      o.miss('⑮ 합계', '⑨~⑭를 더하고 빼는 식이 서식·작성방법에 없음(별지 제10호서식 부표1과 같은 판단)');
      if (h === '10호의5') o.check('⑨ = 본표 ⑲ = ⑰ 초과배당금액 − ⑱ 소득세상당액', gv, Math.max(0, n(r.초과배당금액) - n(r.소득세상당액)));
      o.note('⑨ = 본표 ' + D.gift + ' 증여재산가액, ⑭ = 본표 ' + D.agg + ' 증여재산가산액(같은 증여자 10년 안 증여 — 1천만원 미만이면 0, 상증법 §47②)');
      return o.result();
    };
  }
  function g10Bupyo2(h) {
    return function (ctx) {
      var o = new Out(), arts = ctx.arts || [], dn = ctx.donee || {};
      if (!arts.length) { o.miss('부표2 전체', '서화·골동품 재산 없음'); return o.result(); }
      o.set('①', arts.map(function (x, i) { return String(i + 1); }))
        .set('②', arts.map(function () { return dn.name || ''; })).set('③', arts.map(function () { return dn.regNo || ''; }))
        .set('④', arts.map(function (x) { return x.code || ''; })).set('⑤', arts.map(function (x) { return x.artist || ''; }))
        .set('⑥', arts.map(function (x) { return x.title || ''; })).set('⑦', arts.map(function (x) { return x.year ? String(x.year) : ''; }))
        .set('⑧', arts.map(function (x) { return x.material || ''; })).set('⑨', arts.map(function (x) { return x.size || ''; }))
        .set('⑩', arts.map(function (x) { return Math.round(n(x.value)); }));
      if (!has(dn.name) || !has(dn.regNo)) o.miss('②③ 수증자 성명·주민등록번호', '화면 입력 없음(일반 증여 탭 수증자 첫 번째)');
      if (arts.some(function (x) { return !x.code; })) o.miss('④ 작품코드(일부 줄)', '화면 입력 없음(재산평가 작품코드)');
      o.note('⚠ 지금 인쇄와 같이 일반 증여 탭 재산평가의 서화·골동품을 모두(배분 전 전액) 찍음 — ' + G10[h].tab + ' 신고의 증여재산과 같은 재산인지 확인(' + G10[h].tab + ' 탭은 재산 명세를 받지 않음)');
      if (arts.length > 20) o.note('작품 ' + arts.length + '점 — 20줄을 넘는 만큼 모듈이 다음 장에 이어 찍음');
      return o.result();
    };
  }
  // 지금 인쇄 gfArtworkPrintPageHtml_와 같은 목록(일반 증여 탭 재산평가 중 method = artwork)
  function artsFromApp() {
    var f = g('giftValuationAssets_'), cv = g('computeValuationAssetValue');
    var list = typeof f === 'function' ? (f() || []) : [];
    return list.filter(function (a) { return a.method === 'artwork'; }).map(function (a) {
      return { code: a.artworkCode || '', artist: a.artworkArtist || '', title: a.artworkTitle || '', year: a.artworkYear || '', material: a.artworkMaterial || '', size: a.artworkSize || '',
        value: typeof cv === 'function' ? Math.round(cv(a)) : 0 };
    });
  }
  Object.keys(G10).forEach(function (h) {
    var D = G10[h], k1 = '증여' + h + '부표1', k2 = '증여' + h + '부표2';
    mappers[k1] = g10Bupyo1(h);
    mappers[k2] = g10Bupyo2(h);
    ctxFor[k1] = function (extra) {
      var r = g(D.res); if (!r) return null;
      var pv = H.el(D.prior);
      return Object.assign({ r: r, input: { priorGiftAmount: pv === '' ? undefined : n(pv) } }, extra || {});
    };
    // 예전 인쇄는 부표1을 만들지 않았음 — 본표(증여특례A)와 같은 조건(그 탭 계산 결과가 있을 때)
    ready[k1] = function () { return !!g(D.res); };
    ctxFor[k2] = function (extra) {
      if (!g(D.res)) return null;
      var arts = artsFromApp(); if (!arts.length) return null;
      return Object.assign({ arts: arts, donee: giftPeople().donee }, extra || {});
    };
    // 지금 인쇄(edPrintFormPageHtml_·scPrintFormPageHtml_ 뒤 gfArtworkPrintPageHtml_)와 같은 조건 — 그 탭 결과가 있고 서화·골동품 재산이 있을 때
    ready[k2] = function () { try { return !!(g(D.res) && artsFromApp().length); } catch (e) { return false; } };
  });

  // ═════════ 상증 별지 제1호서식 부표2·제12호의2서식 부표2 — 가업용 자산 명세(시행령 §15⑨, 법 §18의2⑤⑥·§72의2③) ═════════
  //  ctx = mappers.js ctxFromApp.상속()이 만든 것 + bizAssets: [{method, location, value}] (재산평가 탭에서 "사업용자산" 체크한 자산 — 지금 인쇄 ihBizAssetListPrintPageHtml_와 같은 목록)
  //  언제: 1호부표2 = 가업상속공제 계산 내역이 있고 납부유예를 고르지 않음(1호 본표와 같은 조건), 12호의2부표2 = 가업상속 납부유예세액 > 0(12호의2 본표와 같은 조건)
  //  구분코드: land → 1(①토지), building(일반건물) → 2(②건축물), otherTangible(선박·차량·기계장비 등) → 3(③기계장치 등). 주택·오피스텔(토지·건물 일괄 고시가격)·직접입력 등은 비움
  //    (예전 인쇄는 토지·일반건물 밖을 모두 ③으로 찍었음). 글꼴에 동그라미 숫자가 없어 1·2·3으로 찍음.
  var BIZ_CODE = { land: '1', building: '2', otherTangible: '3' };
  function bizAssetMapper(is12) {
    return function (ctx) {
      var o = new Out(), r = ctx.r || {}, d = r.가업상속공제_계산내역 || null, list = ctx.bizAssets || [];
      if (!list.length) {
        o.miss('일련번호·구분코드·소재지, 지목, 명칭 등·평가액 가업용 자산 명세', '재산평가 탭에 "사업용자산"으로 체크한 자산이 없음(지금 인쇄도 같은 안내 — 체크하거나 직접 적을 것)');
        return o.result();
      }
      o.set('일련번호', list.map(function (x, i) { return String(i + 1); }));
      var codes = list.map(function (x) { return BIZ_CODE[x.method] || ''; });
      o.set('구분코드', codes);
      if (codes.some(function (c) { return !c; })) o.miss('구분코드(일부 줄)', '평가 방법이 토지·일반건물·기계장비 등이 아닌 자산(주택·오피스텔은 토지·건물 일괄 고시가격, 직접입력 등은 종류 불명)이라 ①토지·②건축물·③기계장치 등 중 하나로 정할 수 없음 — 직접 적을 것');
      o.set('소재지', list.map(function (x) { return x.location || ''; }));
      if (list.some(function (x) { return !x.location; })) o.miss('소재지(일부 줄)', '화면 입력 없음(재산평가 자산 소재지)');
      o.note('소재지, 지목, 명칭 등 — 계산기에 지목·명칭 칸이 없어 소재지만 찍음');
      var vals = list.map(function (x) { return Math.round(n(x.value)); }), sum = vals.reduce(function (s, v) { return s + v; }, 0);
      o.set('평가액', vals);
      if (d && n(d.소득세법적용분) > 0) o.note('평가액 합 ' + sum + '원(담보채무 빼기 전) — 부표1 ① 사업용 자산 순액 ' + n(d.소득세법적용분) + '원(화면 따로 입력, 담보채무 뺀 값)과 다를 수 있음');
      if (d && n(d.법인세법적용분) > 0) o.note('법인세법 적용 가업 — 작성방법 1의 "법인의 사업에 직접 사용되는 사업용 고정자산(사업무관자산 제외)" 명세는 계산기에 없음(재산평가 탭은 피상속인 재산만 받음)');
      if (list.length > (is12 ? 15 : 18)) o.note('자산 ' + list.length + '건 — ' + (is12 ? 15 : 18) + '줄을 넘는 만큼 모듈이 다음 장에 이어 찍음(작성방법 2: 별지 작성 가능)');
      return o.result();
    };
  }
  mappers['상속1호부표2'] = bizAssetMapper(false);
  mappers['상속12호의2부표2'] = bizAssetMapper(true);
  var IH_WHEN = {
    '상속1호부표2': function (c) { var r = c.r || {}; return !!(c.r && r.가업상속공제_계산내역 && !r.가업상속납부유예_선택); },
    '상속12호의2부표2': function (c) { var r = c.r || {}; return !!(c.r && n(r.가업상속납부유예세액) > 0 && r.가업상속공제_계산내역); }
  };
  function bizAssetsFromApp() {
    var f = g('inheritanceValuationAssets_'), cv = g('computeValuationAssetValue');
    var list = typeof f === 'function' ? (f() || []) : [];
    return list.filter(function (a) { return a.isBusinessAsset; }).map(function (a) {
      return { method: a.method || '', location: a.assetLocation || '', value: typeof cv === 'function' ? Math.round(cv(a)) : 0 };
    });
  }
  function withBiz(c) { return (!c || c.bizAssets || typeof document === 'undefined') ? c : Object.assign({}, c, { bizAssets: bizAssetsFromApp() }); }
  Object.keys(IH_WHEN).forEach(function (k) {
    ctxFor[k] = function (extra) { var c = withBiz(H.ctxFromApp.상속(extra)); return IH_WHEN[k](c) ? c : null; };
    // 지금 인쇄(ihAttachPrintPagesHtml_ — 1호·12호의2 본표 뒤 ihBizAssetListPrintPageHtml_)와 같은 조건
    ready[k] = function () { try { return typeof lastInheritanceResult !== 'undefined' && !!lastInheritanceResult && !!ctxFor[k](); } catch (e) { return false; } };
  });

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  //  상속: 1호부표2·12호의2부표2(가업상속공제·납부유예 신고서에 붙는 명세 — 지금 인쇄처럼 본표와 같은 조건)
  //  추징 신고서(52호의2·11호의10·11호의13)·국외전출자(103~105호)·초과배당/특정법인 부표·가업승계 특례신청(11호의8)은 따로 내는 신고서라 넣지 않음(세액인쇄 서식표 줄로 찍음)
  function plan(tax, ctx) {
    var L = [];
    if (tax === '상속') {
      var c = withBiz(ctx || {});
      ['상속1호부표2', '상속12호의2부표2'].forEach(function (k) { if (IH_WHEN[k](c)) L.push({ formKey: k, ctx: c }); });
    }
    return L;
  }
  return { 묶음: '2단계', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
