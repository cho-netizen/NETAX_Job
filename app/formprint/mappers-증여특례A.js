/*
 * NxFormPrint 묶음 파일 — 증여특례A (원본 모양 인쇄 55장 확장, 2026-10-20 작업자 증여특례A)
 * 이 묶음의 서식: 증여10호의2 · 증여10호의2부표1 · 증여10호의2부표2 · 증여10호의5 · 증여10호의6 · 조특52호
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/증여)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-증여특례A.js → node tools/formprint-check-ext.js 증여특례A
 *
 * ── 값 출처(지금 세액인쇄 taxcalc.html 함수와 같은 전역값) ──
 *   증여10호의2·부표1·부표2 : lastSpecialRateGiftResult_ (calculateSpecialRateGiftTaxJS 결과) + 특례세율 탭 입력칸(sr…)
 *                             + 부표1 재산 목록 srAssetRows_ — srPrintFormPageHtml_·srAttach1PrintPageHtml_·srAttach2PrintPageHtml_
 *   증여10호의5             : lastExcessDividendGiftResult_ (calculateExcessDividendGiftTaxJS) — edPrintFormPageHtml_
 *   증여10호의6             : lastSpecificCorpGiftResult_ (calculateSpecificCorporationGiftTaxJS) — scPrintFormPageHtml_
 *   조특52호                : 일반 증여 계산 결과의 영농자녀증여농지세액감면 — farmlandExemptionPrintPageHtml_
 *   수증자·증여자는 이 특례 탭들에 입력칸이 없어 지금 인쇄처럼 일반 탭 giftDonees[0]·giftDonors[0]을 쓴다(같은 사건의 같은 당사자).
 *
 * ── 어디서 찍나 ──
 *   10호의2·10호의5·10호의6은 일반 증여(10호)와 따로 내는 신고서라 세목 "원본 모양 출력" 묶음(plan)에는 넣지 않고,
 *   세액인쇄 서식표의 그 서식 줄(📄 원본 모양)로 찍는다(ctxFor·ready). 조특52호는 지금 인쇄처럼 일반 증여 묶음에 붙는다(plan).
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
    '증여10호의2': "상속세 및 증여세법 시행규칙 [별지 제10호의2서식]", // 증여세과세표준신고 및 자진납부계산서(창업자금 및 가업승계주식 등 특례세율 적용 증여재산 신고용)
    '증여10호의2부표1': "상속세 및 증여세법 시행규칙 [별지 제10호의2서식 부표1]", // 창업자금 증여재산평가 및 과세가액 계산명세서
    '증여10호의2부표2': "상속세 및 증여세법 시행규칙 [별지 제10호의2서식 부표2]", // 가업승계 주식 등 증여재산평가 및 과세가액 계산명세서
    '증여10호의5': "상속세 및 증여세법 시행규칙 [별지 제10호의5서식]", // 증여세과세표준신고 및 자진납부계산서(초과배당에 따른 이익의 증여재산 신고용)
    '증여10호의6': "상속세 및 증여세법 시행규칙 [별지 제10호의6서식]", // 증여세과세표준신고 및 자진납부계산서(특정법인과의 거래를 통한 증여의제이익 신고용)
    '조특52호': "조세특례제한법 시행규칙 [별지 제52호서식]", // 영농자녀 증여농지등의 세액감면신청서(부표: 증여받은 농지등의 명세서)
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // ───────── 공용 ─────────
  var FILING_LABEL = { ontime: '기한 내 신고', underreported: '수정신고', unreported: '기한 후 신고' }; // mappers.js 증여10호와 같은 기본값 4
  var STARTUP = '창업자금(조특법 §30의5)', SUCCESSION = '가업승계주식등(조특법 §30의6)';
  function g(name) { return typeof root[name] !== 'undefined' ? root[name] : undefined; }
  function numv(x) { var f = g('numVal'); return typeof f === 'function' ? (f(x) || 0) : n(x); }
  // 신고구분 체크: 화면에서 고른 ctx.신고구분, 없으면 그 탭의 신고 상태(filingStatus)
  function filing(o, ctx, fsKey) {
    var fs = has(ctx.신고구분) ? ctx.신고구분 : FILING_LABEL[ctx.filingStatus || 'ontime'];
    if (fs) o.set(fsKey || '신고구분', fs); else o.miss('신고구분', '신고 상태 값 없음');
    if (!has(ctx.신고구분)) o.note('신고구분은 그 탭의 신고 상태(ontime→기한 내, underreported→수정, unreported→기한 후)에서 옮김 — 기본값 4(2026-10-19)와 같은 방법');
  }
  // 수증자 ①~⑦ · 증여자 ⑧~⑫ · 세무대리인 ⑬~⑯ (10호의2·10호의5·10호의6 본표 머리 — 칸 번호가 같음)
  function people(o, ctx) {
    var dn = ctx.donee || {}, dr = ctx.donor || {}, ta = ctx.taxAgent || {};
    o.need('①', dn.name, '① 수증자 성명').need('②', dn.regNo, '② 수증자 주민등록번호');
    o.set('③', dn.resident === 'nonresident' ? '비거주자' : '거주자');
    o.need('④', H.fullAddr(dn), '④ 수증자 주소');
    if (has(dn.email)) o.set('⑤', dn.email); else o.miss('⑤ 전자우편주소', '화면 입력 없음');
    if (has(dn.phone)) { o.set(H.isMobile(dn.phone) ? '⑥@휴대전화' : '⑥@자택', dn.phone); o.miss(H.isMobile(dn.phone) ? '⑥ (자택)' : '⑥ (휴대전화)', '전화번호 입력이 한 칸뿐 — 01x면 휴대전화, 아니면 자택 칸에 찍음(기본값 2)'); } else o.miss('⑥ 수증자 전화번호', '화면 입력 없음');
    o.miss('⑦ 증여자와의 관계', '계산기 값은 공제 구분(직계존속 등)이라 "증여자의 (  )"에 맞는 낱말(자·손자 등)이 아님');
    o.need('⑧', dr.name, '⑧ 증여자 성명').need('⑨', dr.regNo, '⑨ 증여자 주민등록번호');
    if (has(ctx.giftDate)) o.set('⑩', ctx.giftDate); else o.miss('⑩ 증여일자', '화면 입력 없음(일반 증여 탭 증여일자)');
    o.need('⑪', H.fullAddr(dr), '⑪ 증여자 주소');
    o.miss('⑫ 증여자 전화번호', '계산기에 없음(증여자 카드에 전화 입력 칸 없음)');
    if (has(ta.name)) {
      o.set('⑬', ta.name);
      if (has(ta.bizNo)) o.set('⑭', ta.bizNo); else o.miss('⑭ 세무대리인 사업자등록번호', '설정 탭 입력 없음');
      if (has(ta.mgmtNo)) o.set('⑮', ta.mgmtNo); else o.miss('⑮ 세무대리인 관리번호', '설정 탭 입력 없음');
      if (has(ta.phone)) { o.set(H.isMobile(ta.phone) ? '⑯@휴대전화' : '⑯@사무실', ta.phone); o.miss(H.isMobile(ta.phone) ? '⑯ (사무실)' : '⑯ (휴대전화)', '세무대리인 전화번호 입력이 한 칸뿐 — 01x면 휴대전화, 아니면 사무실 칸에 찍음(기본값 2)'); } else o.miss('⑯ 세무대리인 전화번호', '설정 탭 입력 없음');
    } else o.miss('⑬⑭⑮⑯ 세무대리인', '세무대리인 입력 없음(본인 신고)');
  }
  // 신고일·신고인(수증자)·세무대리인 서명란·세무서
  function signBlock(o, ctx) {
    var dn = ctx.donee || {}, ta = ctx.taxAgent || {};
    var d = H.ymd(ctx.신고일);
    if (d) o.set('신고일.연', d.y).set('신고일.월', d.m).set('신고일.일', d.d); else o.miss('신고일', 'ctx.신고일 없음(계산기에 없음)');
    o.need('신고인서명', dn.name, '신고인(서명)');
    if (has(ta.name)) o.set('세무대리인서명', ta.name); else o.miss('세무대리인(서명)', '세무대리인 입력 없음(본인 신고)');
    if (has(dn.taxOffice)) o.set('세무서', H.officeName(dn.taxOffice)); else o.miss('세무서', '수증자 관할 세무서 입력 없음');
  }
  // 화면 공통(일반 증여 탭의 첫 수증자·증여자 — 지금 인쇄 gfPrintIdentityRows_와 같음)
  function peopleFromApp() {
    var dns = g('giftDonees') || [], drs = g('giftDonors') || [];
    return { donee: dns[0] || {}, donor: drs[0] || {}, giftDate: H.el('giftDate'), taxAgent: H.agent() };
  }

  // ═════════ 상증 별지 제10호의2서식 — 창업자금·가업승계주식등 특례세율 증여세 신고서(조특법 §30의5·§30의6) ═════════
  //  ctx: { r: lastSpecialRateGiftResult_, filingStatus(srFilingStatus), donee, donor, giftDate, taxAgent, 신고일,
  //         srInput: {totalAsset, nonBiz55, nonBiz49, nonBiz61, excessCash, nonBizStock}(부표2), srRows: [{method, typeCode, basisCode, location, value}](부표1) }
  //  ⑰⑱(창업자금)·⑲⑳(가업승계)은 엔진 특례종류에 맞는 줄만 채운다. ⑱·⑳ = 앞서 같은 특례를 받은 증여분(엔진 가산_과세특례증여재산).
  mappers['증여10호의2'] = function (ctx) {
    var o = new Out(), r = ctx.r || {};
    filing(o, ctx);
    people(o, ctx);
    var st = r.특례종류 === STARTUP, bs = r.특례종류 === SUCCESSION;
    if (!st && !bs) { o.miss('⑰~㊱', '특례세율 계산 결과 없음(특례종류: ' + r.특례종류 + ')'); signBlock(o, ctx); return o.result(); }
    var cur = n(r.과세특례적용대상_증여세과세가액), prior = n(r.가산_과세특례증여재산);
    var sum = has(r.과세특례_과세가액_합계) ? n(r.과세특례_과세가액_합계) : cur + prior;
    if (st) { o.set('⑰', cur).set('⑱', prior); o.miss('⑲⑳ 가업승계주식등', '해당 없음 — 창업자금 신고'); }
    else { o.set('⑲', cur).set('⑳', prior); o.miss('⑰⑱ 창업자금', '해당 없음 — 가업승계주식등 신고'); }
    o.set('㉑', sum).set('㉒', n(r.증여재산공제)).set('㉓', n(r.재해손실공제)).set('㉔', n(r.감정평가수수료공제)).set('㉕', n(r.과세표준));
    // ㉖ 세율 — 창업자금 10%, 가업승계 10%(과세표준 120억원 초과분 20%) — 작성방법 9
    var base = n(r.과세표준), over = bs && base > 12000000000;
    o.set('㉖', over ? '10%·20%' : '10%');
    var calc = n(r.산출세액), paid = n(r.납부세액공제), fx = n(r.외국납부세액공제);
    var pen = n(r.무신고가산세) + n(r.과소신고가산세), late = n(r.납부지연가산세), usage = n(r.창업자금사용명세미제출가산세);
    o.set('㉗', calc).set('㉘', paid + fx).set('㉙', paid).set('㉚', fx).set('㉛', pen).set('㉜', late);
    var due = Math.max(0, n(r.납부세액) - usage); // 서식 ㉝ = ㉗ − ㉘ + ㉛ + ㉜ (사용명세 미제출가산세 칸 없음)
    o.set('㉝', due);
    if (usage) o.note('⚠ 엔진 납부세액 ' + n(r.납부세액) + '원에는 창업자금 사용명세서 미제출 가산세 ' + usage + '원(조특법 §30의5⑤)이 들어 있으나 서식 ㉝(㉗−㉘+㉛+㉜)에는 그 칸이 없어 뺀 ' + due + '원을 찍음 — 사용명세는 창업한 뒤 내는 것이라 이 신고서에 넣을지 세무사님 확인');
    // 납부방법 — 특례세율 탭엔 연부연납·분납 계산이 없음 → 전액 신고납부로(mappers.js 증여10호 53과 같은 식: ㉝ − ㉞ − ㉟)
    o.miss('㉞ 연부연납 ㉟ 분납', '계산기에 없음 — 특례세율 탭에 연부연납·분납 칸이 없음(나눠 내면 직접 적고 ㊱을 고칠 것)');
    o.set('㊱@금액', due);
    o.miss('㉞㉟㊱ 납부 및 신청일', '계산기에 없음');
    signBlock(o, ctx);
    // 검산(서식 산식·작성방법)
    o.check('㉑ = ' + (st ? '⑰ + ⑱' : '⑲ + ⑳'), sum, cur + prior);
    o.check('㉒ = min(' + (st ? '5억' : '10억') + ', ㉑) — 작성방법 7', n(r.증여재산공제), Math.min(st ? 500000000 : 1000000000, sum));
    o.check('㉕ = ㉑ − ㉒ − ㉓ − ㉔', base, Math.max(0, sum - n(r.증여재산공제) - n(r.재해손실공제) - n(r.감정평가수수료공제)));
    o.check('㉗ = ㉕ × ㉖', calc, st ? Math.round(base * 0.1) : Math.round(Math.min(base, 12000000000) * 0.1 + Math.max(0, base - 12000000000) * 0.2));
    o.check('㉝ = ㉗ − ㉘ + ㉛ + ㉜', due, Math.max(0, calc - paid - fx + pen + late));
    var baseRate = st ? (n(r.과세특례적용전_증여세과세가액_계) > n(r.총한도액) ? n(r.기본세율적용대상_증여재산가액) : 0) : n(r.기본세율적용대상_증여재산가액); // 창업자금은 ⑫ > ⑬일 때만(부표1 ⑰)
    if (baseRate > 0) o.note('⚠ ' + baseRate + '원은 기본세율 적용 대상 — 일반 증여세 신고서(별지 제10호서식)에 따로 적어 신고(부표' + (st ? '1 ⑰·⑱' : '2 ⑬') + ')');
    return o.result();
  };

  // 세액인쇄 화면에서 특례세율(sr) 서식 세 장의 ctx — 지금 인쇄 srPrintFormPageHtml_·srAttach1·srAttach2와 같은 값
  function srCtx(extra) {
    var r = g('lastSpecialRateGiftResult_');
    if (!r) return null;
    var tc = g('ihAssetTypeCode_');
    var rows = (g('srAssetRows_') || []).filter(function (row) { return row.method || numv(row.value) > 0; }).map(function (row) {
      return { method: row.method || '', typeCode: row.method && typeof tc === 'function' ? tc(row.method) : '', location: row.assetLocation || '', value: numv(row.value) };
    });
    var iv = function (id) { return numv(H.el(id)); };
    return Object.assign(peopleFromApp(), { r: r, filingStatus: H.el('srFilingStatus') || 'ontime', srRows: rows,
      srInput: { totalAsset: iv('srTotalAsset'), nonBiz55: iv('srNonBiz55'), nonBiz49: iv('srNonBiz49'), nonBiz61: iv('srNonBiz61'), excessCash: iv('srExcessCash'), nonBizStock: iv('srNonBizStock') } }, extra || {});
  }
  ctxFor['증여10호의2'] = srCtx;
  ready['증여10호의2'] = function () { return !!g('lastSpecialRateGiftResult_'); };

  // ═════════ 상증 별지 제10호의2서식 부표1 — 창업자금 증여재산평가 및 과세가액 계산명세서 ═════════
  //  가. 재산 명세 = 특례세율 탭 "재산 목록 합산" 도구(srAssetRows_)의 줄(재산종류·소재지·평가가액만 있음)
  //  나. 과세가액 = 엔진 결과(지금 인쇄 srAttach1PrintPageHtml_의 값과 같음)
  mappers['증여10호의2부표1'] = function (ctx) {
    var o = new Out(), r = ctx.r || {};
    if (r.특례종류 !== STARTUP) { o.miss('①~⑱', '창업자금 특례 결과가 아님(특례종류: ' + r.특례종류 + ')'); return o.result(); }
    var rows = (ctx.srRows || []).filter(function (x) { return x.method || n(x.value) > 0; });
    if (rows.length) {
      o.set('①', rows.map(function () { return 'A12'; })); // 작성방법 1: 증여재산(창업자금) — 목록 줄은 모두 이번 증여분
      o.set('②', rows.map(function (x) { return x.typeCode || ''; }));
      if (rows.some(function (x) { return !x.typeCode; })) o.miss('② 재산종류코드(일부 줄)', '재산종류를 고르지 않은 줄');
      if (rows.some(function (x) { return x.method === 'direct'; })) o.note('② 직접입력 재산은 지금 시스템 분류대로 12(기타재산)로 찍음 — 현금이면 01, 금융재산이면 11로 고칠 것');
      o.set('③@소재지', rows.map(function (x) { return x.location || ''; }));
      o.set('⑦', rows.map(function (x) { return Math.round(n(x.value)); }));
      var bc = rows.map(function (x) { return x.method && x.method !== 'direct' ? '08' : ''; });
      if (bc.some(function (x) { return x; })) o.set('⑧', bc);
      if (bc.some(function (x) { return !x; })) o.miss('⑧ 평가기준코드(직접입력 줄)', '계산기에 없음 — 목록 도구에 평가 근거(매매가·감정가 등)를 고르는 칸이 없음(고시가격 재산만 08)');
      o.check('⑨ = ⑦ 합(재산 목록)', n(r.증여재산가액), rows.reduce(function (s, x) { return s + Math.round(n(x.value)); }, 0));
      if (rows.length > 8) o.note('재산 ' + rows.length + '줄 — 8줄을 넘는 만큼 모듈이 다음 장에 이어 찍음');
    } else o.miss('①②③⑦⑧ 재산 명세', '특례세율 탭 "재산 목록 합산" 도구에 입력한 재산 없음');
    o.miss('③ 국외자산 여부·국가명', '계산기에 없음');
    o.miss('④ 사업자등록번호(지분) ⑤ 수량(면적) ⑥ 단가', '계산기에 없음 — 목록 도구는 재산종류·소재지·평가가액만 받음');
    var g9 = n(r.증여재산가액), d10 = n(r.인수채무액), p11 = n(r.가산_과세특례증여재산), s12 = n(r.과세특례적용전_증여세과세가액_계), lim = n(r.총한도액), cur = n(r.과세특례적용대상_증여세과세가액);
    o.set('⑨', g9).set('⑩', d10).set('⑪', p11).set('⑫', s12).set('⑬', lim).set('⑭', p11).set('⑮', Math.max(0, lim - p11)).set('⑯', cur);
    if (s12 > lim) o.set('⑰', g9 - cur).set('⑱', d10);
    else o.miss('⑰⑱ 기본세율 적용대상', '해당 없음 — ⑫가 ⑬(총한도액) 이하(서식: ⑫ > ⑬일 때만 적음)');
    o.check('⑫ = ⑨ − ⑩ + ⑪', s12, g9 - d10 + p11);
    o.check('⑯ = ⑫ < ⑬이면 ⑫ − ⑪, 아니면 min(⑫, ⑮)', cur, s12 < lim ? s12 - p11 : Math.min(s12, Math.max(0, lim - p11)));
    if (s12 > lim) o.check('⑰ = ⑨ − ⑯', g9 - cur, g9 - cur);
    return o.result();
  };
  ctxFor['증여10호의2부표1'] = function (extra) { var c = srCtx(extra); return c && c.r.특례종류 === STARTUP ? c : null; };
  // 지금 인쇄(srAttach1PrintPageHtml_)와 같은 조건 — 창업자금 결과이고 재산 목록 줄이 있을 때
  ready['증여10호의2부표1'] = function () {
    var r = g('lastSpecialRateGiftResult_');
    return !!(r && r.특례종류 === STARTUP && (g('srAssetRows_') || []).some(function (row) { return row.method || numv(row.value) > 0; }));
  };

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '증여특례A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
