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
  // [2026.10.20] 세액계산 화면의 결과 변수(let lastSpecialRateGiftResult_ 등)는 window 속성이 아니라 전역 이름이라 root[name]으로는 안 보인다 — 전역 범위에서 이름으로 읽음
  function g(name) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return undefined;
    if (typeof root[name] !== 'undefined') return root[name];
    try { return (new Function('return typeof ' + name + " !== 'undefined' ? " + name + ' : undefined;'))(); } catch (e) { return undefined; }
  }
  function numv(x) { var f = g('numVal'); return typeof f === 'function' ? (f(x) || 0) : n(x); }
  // 신고구분 체크: 화면에서 고른 ctx.신고구분, 없으면 그 탭의 신고 상태(filingStatus)
  function filing(o, ctx, fsKey) {
    var fs = has(ctx.신고구분) ? ctx.신고구분 : FILING_LABEL[ctx.filingStatus || 'ontime'];
    if (fs) o.set(fsKey || '신고구분', fs); else o.miss('신고구분', '신고 상태 값 없음');
    if (!has(ctx.신고구분)) o.note('신고구분은 그 탭의 신고 상태(ontime→기한 내, underreported→수정, unreported→기한 후)에서 옮김 — 기본값 4(2026-10-19)와 같은 방법');
  }
  // 수증자 ①~⑦ · 증여자 ⑧~⑫ · 세무대리인 ⑬~⑯ (10호의2·10호의5·10호의6 본표 머리 — 칸 번호가 같음)
  //  ak = 세무대리인 칸 번호 [성명, 사업자등록번호, 관리번호, 전화번호] — 10호의6은 ⑯~⑲(⑬~⑮가 특정법인)
  function people(o, ctx, ak) {
    var dn = ctx.donee || {}, dr = ctx.donor || {}, ta = ctx.taxAgent || {};
    ak = ak || ['⑬', '⑭', '⑮', '⑯'];
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
      o.set(ak[0], ta.name);
      if (has(ta.bizNo)) o.set(ak[1], ta.bizNo); else o.miss(ak[1] + ' 세무대리인 사업자등록번호', '설정 탭 입력 없음');
      if (has(ta.mgmtNo)) o.set(ak[2], ta.mgmtNo); else o.miss(ak[2] + ' 세무대리인 관리번호', '설정 탭 입력 없음');
      if (has(ta.phone)) { o.set(ak[3] + (H.isMobile(ta.phone) ? '@휴대전화' : '@사무실'), ta.phone); o.miss(ak[3] + (H.isMobile(ta.phone) ? ' (사무실)' : ' (휴대전화)'), '세무대리인 전화번호 입력이 한 칸뿐 — 01x면 휴대전화, 아니면 사무실 칸에 찍음(기본값 2)'); } else o.miss(ak[3] + ' 세무대리인 전화번호', '설정 탭 입력 없음');
    } else o.miss(ak.join('') + ' 세무대리인', '세무대리인 입력 없음(본인 신고)');
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
    var due = Math.max(0, n(r.납부세액) - (r.창업자금사용명세미제출가산세_별도부과 ? 0 : usage)); // 서식 ㉝ = ㉗ − ㉘ + ㉛ + ㉜ (사용명세 미제출가산세 칸 없음 — 2026.10.20부터 엔진도 납부세액에 안 넣음)
    o.set('㉝', due);
    if (usage && !r.창업자금사용명세미제출가산세_별도부과) o.note('⚠ 엔진 납부세액 ' + n(r.납부세액) + '원에는 창업자금 사용명세서 미제출 가산세 ' + usage + '원(조특법 §30의5⑤)이 들어 있으나 서식 ㉝(㉗−㉘+㉛+㉜)에는 그 칸이 없어 뺀 ' + due + '원을 찍음 — 사용명세는 창업한 뒤 내는 것이라 이 신고서에 넣을지 세무사님 확인');
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
  // ═════════ 상증 별지 제10호의2서식 부표2 — 가업승계 주식 등 증여재산평가 및 과세가액 계산명세서 ═════════
  //  ②·㉮~㉲ = 특례세율 탭 입력칸(srTotalAsset·srNonBiz55·srNonBiz49·srNonBiz61·srExcessCash·srNonBizStock — 엔진에 넘긴 값과 같음)
  //  나머지 = 엔진 결과. 예전 인쇄는 ⑪에 ⑨(총한도액)를 그대로 찍었는데 여기선 서식대로 ⑨ − ⑩.
  mappers['증여10호의2부표2'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, si = ctx.srInput || {};
    if (r.특례종류 !== SUCCESSION) { o.miss('①~⑬', '가업승계주식등 특례 결과가 아님(특례종류: ' + r.특례종류 + ')'); return o.result(); }
    var g1 = n(r.증여재산가액), tot = n(si.totalAsset);
    o.set('①', g1);
    var nb = [['㉮', si.nonBiz55], ['㉯', si.nonBiz49], ['㉰', si.nonBiz61], ['㉱', si.excessCash], ['㉲', si.nonBizStock]];
    var nbSum = nb.reduce(function (s, x) { return s + n(x[1]); }, 0);
    if (tot > 0) {
      o.set('②', tot);
      nb.forEach(function (x) { o.set(x[0], n(x[1])); });
      o.set('③', nbSum).set('④', Math.max(0, tot - nbSum));
    } else {
      o.miss('② 총자산가액 ㉮~㉲ ③ ④', '화면 입력 없음(총자산가액) — 엔진은 사업관련 자산가액 비율을 1(100%)로 보고 계산함');
    }
    var ratio = has(r.사업관련자산가액비율) && r.사업관련자산가액비율 !== null ? Number(r.사업관련자산가액비율) : (tot > 0 ? Math.max(0, tot - nbSum) / tot : null);
    if (ratio !== null) o.set('⑤', H.pct2(ratio)); else o.miss('⑤ 사업관련 자산가액 비율', '총자산가액 입력 없음(엔진은 100%로 계산)');
    var b6 = n(r.가업자산상당액), p7 = n(r.가산_과세특례증여재산), s8 = n(r.과세특례적용전_증여세과세가액_계), lim = n(r.총한도액), cur = n(r.과세특례적용대상_증여세과세가액);
    o.set('⑥', b6).set('⑦', p7).set('⑧', s8).set('⑨', lim).set('⑩', p7).set('⑪', Math.max(0, lim - p7)).set('⑫', cur).set('⑬', n(r.기본세율적용대상_증여재산가액));
    if (tot > 0) {
      o.check('③ = ㉮ + ㉯ + ㉰ + ㉱ + ㉲', nbSum, nbSum);
      o.check('④ = ② − ③', Math.max(0, tot - nbSum), tot - nbSum);
    }
    o.check('⑥ = ① × ⑤', b6, Math.round(g1 * (ratio === null ? 1 : ratio)));
    o.check('⑧ = ⑥ + ⑦', s8, b6 + p7);
    o.check('⑨ = 가업영위기간 표(300억·400억·600억)', lim, [30000000000, 40000000000, 60000000000].indexOf(lim) >= 0 ? lim : -1);
    o.check('⑫ = ⑧ < ⑨이면 ⑧ − ⑦, 아니면 min(⑧, ⑪)', cur, s8 < lim ? s8 - p7 : Math.min(s8, Math.max(0, lim - p7)));
    o.check('⑬ = ① − ⑫', n(r.기본세율적용대상_증여재산가액), Math.max(0, g1 - cur));
    return o.result();
  };
  ctxFor['증여10호의2부표2'] = function (extra) { var c = srCtx(extra); return c && c.r.특례종류 === SUCCESSION ? c : null; };
  // 지금 인쇄(srAttach2PrintPageHtml_)와 같은 조건 — 가업승계주식등 결과
  ready['증여10호의2부표2'] = function () { var r = g('lastSpecialRateGiftResult_'); return !!(r && r.특례종류 === SUCCESSION); };


  // ═════════ 조특 별지 제52호서식(+부표) — 영농자녀 증여농지등의 세액감면신청서(조특법 §71, 시행령 §68⑫) ═════════
  //  ctx = mappers.js ctxFromApp.증여(i)가 만든 것(r·donee·donor·relation·giftDate·taxAgent) + 신고일.
  //  계산기는 감면세액(증여세 탭 "영농자녀 증여농지 세액감면" 칸 → 엔진 영농자녀증여농지세액감면)만 받는다.
  //  농지 소재지·면적·영농 종사기간·부표 명세(④~⑫)는 계산기에 없어 비운다(지금 인쇄도 같은 안내 — 있지도 않은 농지 내역을 지어내지 않음).
  function farmAmount(ctx) { return has(ctx.farmlandExemption) ? n(ctx.farmlandExemption) : n((ctx.r || {}).영농자녀증여농지세액감면); }
  mappers['조특52호'] = function (ctx) {
    var o = new Out(), dn = ctx.donee || {}, dr = ctx.donor || {};
    var addr = H.fullAddr(dn);
    // 신청인 = 영농자녀(수증자)
    o.need('신청인@성명', dn.name, '신청인 성명').need('신청인@주민등록번호', dn.regNo, '신청인 주민등록번호').need('신청인@주소', addr, '신청인 주소');
    if (has(dn.phone)) o.set('신청인@전화번호', dn.phone); else o.miss('신청인 전화번호', '화면 입력 없음');
    o.need('증여자@성명', dr.name, '증여자 성명').need('증여자@주민등록번호', dr.regNo, '증여자 주민등록번호').need('증여자@주소', H.fullAddr(dr), '증여자 주소');
    o.miss('증여자 영농 종사기간', '계산기에 없음(자경농민 요건 — 시행령 §68①)');
    o.need('영농자녀@성명', dn.name, '영농자녀 성명').need('영농자녀@주민등록번호', dn.regNo, '영농자녀 주민등록번호').need('영농자녀@주소', addr, '영농자녀 주소');
    o.miss('영농자녀 증여자와의 관계', '계산기 값은 공제 구분(' + (ctx.relation || '없음') + ')이라 관계 낱말(자·손자 등)이 아님');
    o.miss('영농자녀 영농 종사기간', '계산기에 없음');
    o.miss('증여물건 소재지', '계산기에 없음 — 증여세 탭은 감면세액만 받음(농지별 소재지·면적은 수집 안 함)');
    if (has(ctx.giftDate)) o.set('증여물건@증여일자', ctx.giftDate); else o.miss('증여물건 증여일자', '화면 입력 없음(증여일자)');
    // [2026.10.20 회장 결론 N3] 증여세 탭 감면 도우미 값 — 서식(2024.3.22.판) 면적 칸은 농지·초지·산림지뿐, 나머지 5종(조특법 §71①1호 라~아목)은 부표 ⑥⑦에
    var fh_ = g('__gfFarmHelper') || null, FARM_SLOT_ = { farmland: '농지', pasture: '초지', forest_land: '산림지' };
    if (fh_ && fh_.적용여부 && FARM_SLOT_[fh_.농지등유형] && has(fh_.면적)) o.set('면적@' + FARM_SLOT_[fh_.농지등유형], fh_.면적);
    else if (fh_ && fh_.적용여부 && !FARM_SLOT_[fh_.농지등유형]) o.note('서식(2024.3.22.판) 면적 칸에 없는 종류 — ' + fh_.종류 + '(조특법 §71①1호 라~아목): 본표 면적 칸은 비우고 부표 ⑥ 지목에 종류, ⑦ 면적에 ' + (fh_.농지등유형 === 'fishing_boat' ? '총톤수' : '면적') + '을 적음');
    else o.miss('면적(농지·초지·산림지)', '계산기에 없음(증여세 탭 감면 도우미를 쓰면 채움)');
    if (g('__gfFarmHelper') && has(g('__gfFarmHelper').가액)) o.set('증여재산가액', g('__gfFarmHelper').가액); // [2026.10.20 N3] 감면 도우미의 농지등 가액
    else o.miss('증여재산가액(농지등)', '계산기에 없음 — 감면 대상 농지등의 가액을 따로 받지 않음(증여재산 전체 가액과 다름, 증여세 탭 감면 도우미를 쓰면 채움)');
    var amt = farmAmount(ctx);
    if (amt > 0) o.set('감면세액', amt); else o.miss('감면세액', '감면세액 없음(증여세 탭 "영농자녀 증여농지 세액감면" 칸)');
    var d = H.ymd(ctx.신고일);
    if (d) o.set('신청일.연', d.y).set('신청일.월', d.m).set('신청일.일', d.d); else o.miss('신청일', 'ctx.신고일 없음(계산기에 없음)');
    o.need('신청인서명', dn.name, '신청인(서명)');
    if (has(dn.taxOffice)) o.set('세무서', H.officeName(dn.taxOffice)); else o.miss('세무서', '수증자 관할 세무서 입력 없음');
    // 부표 — 증여받은 농지등의 명세서
    o.need('①', dn.name, '① 성명').need('②', dn.regNo, '② 주민등록번호').need('③@주소', addr, '③ 주소');
    if (has(dn.phone)) o.set('③@전화번호', dn.phone); else o.miss('③ 전화번호', '화면 입력 없음');
    if (fh_ && fh_.적용여부) {
      o.set('⑥', [fh_.종류]);
      if (fh_.농지등유형 === 'fishing_boat' && has(fh_.총톤수)) o.set('⑦', ['총톤수 ' + fh_.총톤수 + '톤']); else if (has(fh_.면적)) o.set('⑦', [fh_.면적]);
      o.miss('④⑤⑧⑨⑩⑪⑫ 농지등 명세(필지별)', '계산기에 없음 — 소재지·취득일·취득원인·증여자 취득가액은 직접 적을 것(⑥ 종류·⑦ 면적은 감면 도우미 값, 한 필지만)');
    } else o.miss('④⑤⑥⑦⑧⑨⑩⑪⑫ 농지등 명세(필지별)', '계산기에 없음 — 필지별 소재지·지목·면적·취득일·취득원인·증여자 취득가액을 받는 칸이 없음(직접 적을 것)');
    var r = ctx.r || {};
    if (amt > 0 && has(r.산출세액_할증전)) o.check('감면세액 ≤ 산출세액(할증 포함)', Math.min(amt, n(r.산출세액_할증전) + n(r.세대생략할증액)), amt);
    if (fh_ && fh_.적용여부) o.note('감면세액은 증여세 탭 감면 도우미(엔진: 종류별 증여일·면적 한도·5년 1억 한도)가 계산한 값 — 자경농민·영농자녀 요건과 소재지는 따로 확인');
    else o.note('감면 요건(자경농민·영농자녀 요건, 농지 소재지·면적 한도)과 감면세액 계산은 계산기 밖에서 확인해 넣은 값 — 이 서식은 그 값을 옮겨 적을 뿐');
    return o.result();
  };
  // 세액인쇄 서식 줄 — 감면세액이 있는 증여 쌍마다 한 장(예전 인쇄는 첫 쌍에만 붙였음)
  function giftItems() { return (g('lastGiftResults_') || []).filter(function (it) { return it && it.result && !it.result.error; }); }
  function farmField() { return numv(H.el('giftFarmlandExemption')); }
  ctxFor['조특52호'] = function (extra) {
    var items = giftItems(), out = [];
    items.forEach(function (it, i) { if (n(it.result.영농자녀증여농지세액감면) > 0) out.push(H.ctxFromApp.증여(i, extra)); });
    if (!out.length && items.length && farmField() > 0) out.push(H.ctxFromApp.증여(0, Object.assign({ farmlandExemption: farmField() }, extra || {}))); // 지금 인쇄의 화면 칸 대체값
    return out.length ? out : null;
  };
  // 지금 인쇄(gfPrintFormBodyHtml_ → farmlandExemptionPrintPageHtml_)와 같은 조건 — 첫 결과의 감면세액 또는 화면 칸 값이 있을 때
  ready['조특52호'] = function () {
    var items = giftItems();
    return !!(items.length && (items.some(function (it) { return n(it.result.영농자녀증여농지세액감면) > 0; }) || farmField() > 0));
  };

  // ───────── 증여의제 신고서(10호의5·10호의6) 공용 ─────────
  // 엔진 결과에 따로 없는 값을 결과·입력에서 엔진과 같은 식으로 되살린다(엔진은 고치지 않음)
  //  가산액: 엔진 giftAggregationAmount(1천만원 미만이면 0) — 입력이 없으면 과세표준에서 거꾸로
  function aggOf(r, inp, giftAmt) {
    if (has(inp.priorGiftAmount)) { var v = n(inp.priorGiftAmount); return v >= 10000000 ? v : 0; }
    if (n(r.과세표준) > 0) return Math.max(0, n(r.과세표준) + n(r.증여재산공제) + n(r.감정평가수수료공제) + n(r.재해손실공제) - giftAmt);
    return 0;
  }
  //  기납부세액·외국납부세액공제: 엔진 taxAfterCredit = 산출세액 계 − min(기납부, 산출세액) − 외국납부 → 결과 납부세액·신고세액공제·가산세에서 되살림
  function creditsOf(r, inp) {
    var pen = n(r.무신고가산세) + n(r.과소신고가산세) + n(r.납부지연가산세);
    var after = n(r.환급세액) > 0 ? n(r.최초신고_증여세액) + n(r.신고세액공제) - n(r.환급세액) : n(r.납부세액) - pen + n(r.신고세액공제) + n(r.최초신고_증여세액);
    var both = Math.max(0, n(r.산출세액_할증후) - after); // 기납부 + 외국납부
    var paid = Math.min(has(inp.priorPaidTax) ? n(inp.priorPaidTax) : both, n(r.산출세액), both);
    return { paid: paid, foreign: both - paid, after: after, pen: pen };
  }
  // 증여재산공제 합계를 관계 칸 하나에(특례 탭엔 관계 칸이 없어 일반 탭 첫 증여자 카드의 관계 — 지금 인쇄처럼 같은 사건의 같은 증여자)
  function deductCells(o, r, ctx, cells) {
    var REL = { '배우자': cells[0], '직계존속': cells[1], '직계비속': cells[2], '기타친족': cells[3] };
    var d = n(r.증여재산공제), c = REL[ctx.relation];
    if (c) { cells.forEach(function (k) { o.set(k, k === c ? d : 0); }); if (d) o.note(c + ' 증여재산공제 = 화면 "증여재산공제 남은 한도액"으로 엔진이 뺀 금액. 관계(' + ctx.relation + ')는 일반 탭 첫 증여자 카드에서 옮김 — 다르면 고칠 것'); }
    else if (!d) cells.forEach(function (k) { o.set(k, 0); });
    else o.miss(cells.join('') + ' 증여재산공제', '관계 값이 배우자·직계존속·직계비속·기타친족이 아님(' + ctx.relation + ') — 공제 ' + d + '원을 어느 칸에 적을지 정할 수 없음');
  }
  function relationOfFirstDonor() {
    var drs = g('giftDonors') || [], f = g('giftPairRelation_');
    return drs[0] && typeof f === 'function' ? f(drs[0], 0).relation : (drs[0] && drs[0].relation) || '';
  }
  // 특례 탭 공통 입력(10년 합산·기납부·외국납부 — taxCalcGiftAggregationInput_와 같은 칸)
  function aggInputOf(prefix) {
    var v = function (id) { var s = H.el(prefix + id); return s === '' ? undefined : numv(s); };
    return { priorGiftAmount: v('PriorAmount'), priorPaidTax: v('PriorPaidTax') };
  }

  // ═════════ 상증 별지 제10호의5서식 — 초과배당에 따른 이익의 증여재산 신고(상증법 §41의2) ═════════
  //  ctx: { r: lastExcessDividendGiftResult_, filingStatus(edFilingStatus), finalSettlement(edFinalSettlement 체크), edInput: {priorGiftAmount, priorPaidTax},
  //         donee, donor, relation, giftDate(edGiftDate 배당지급일), taxAgent, 신고일 }
  //  예전 인쇄(edPrintFormPageHtml_ → gfDeemedGiftPrintRows_)는 순번으로 초과배당금액·소득세상당액·증여의제이익과 세액 줄만 찍었음.
  mappers['증여10호의5'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, inp = ctx.edInput || {};
    filing(o, ctx);
    people(o, ctx);
    o.set('최초정산', ctx.finalSettlement ? '정산 신고' : '최초 신고');
    o.miss('성실신고확인대상사업자 여·부', '계산기에 없음 — 화면에 이 값을 고르는 칸이 없음(엔진의 7월 1일 기준 분기에 쓰는 값)');
    var ex = n(r.초과배당금액), it = n(r.소득세상당액), gv = n(r.증여의제이익);
    var agg = aggOf(r, inp, gv), sum = gv + agg;
    o.set('⑰', ex).set('⑱', it).set('⑲', gv).set('⑳', agg).set('㉑', sum);
    deductCells(o, r, ctx, ['㉒', '㉓', '㉔', '㉕']);
    var base = n(r.과세표준), extra = n(r.감정평가수수료공제) + n(r.재해손실공제);
    o.set('㉖', base).set('㉗', H.giftInheritRate(base));
    if (extra) o.note('⚠ 엔진 과세표준은 감정평가수수료 ' + n(r.감정평가수수료공제) + '원·재해손실공제 ' + n(r.재해손실공제) + '원도 뺀 값 — 서식 ㉖ 산식(㉑−㉒~㉕)에는 그 칸이 없음(상증법 §55①은 감정평가수수료를 뺌)');
    var calc = n(r.산출세액), gen = n(r.세대생략할증액), tot = has(r.산출세액_할증후) ? n(r.산출세액_할증후) : calc + gen;
    o.set('㉘', calc).set('㉙', gen).set('㉚', tot);
    var cr = creditsOf(r, inp), rep = n(r.신고세액공제);
    o.set('㉜', cr.paid).set('㉝', cr.foreign).set('㉞', rep).set('㉛', cr.paid + cr.foreign + rep);
    o.miss('㉟ 그 밖의 공제ㆍ감면세액', '계산기에 없음 — 초과배당 탭에 입력 칸이 없음(엔진은 0으로 계산)');
    var init = n(r.최초신고_증여세액);
    if (ctx.finalSettlement) o.set('㊱', init); else o.miss('㊱ 증여재산가액 기준 증여세액', '해당 없음 — 최초 신고(정산 신고 때만 최초 신고 세액을 적음)');
    var pen = n(r.무신고가산세) + n(r.과소신고가산세), late = n(r.납부지연가산세);
    o.set('㊲', pen).set('㊳', late);
    var due = n(r.환급세액) > 0 ? -n(r.환급세액) : n(r.납부세액);
    o.set('㊴', due);
    if (due < 0) o.note('㊴ 환급받을 세액 ' + n(r.환급세액) + '원(음수로 찍음) — 정산 신고에서 최초 신고 세액이 더 많음');
    o.miss('㊵ 연부연납 ㊶ 분납', '계산기에 없음 — 초과배당 탭에 연부연납·분납 칸이 없음(나눠 내면 직접 적고 ㊷를 고칠 것)');
    o.set('㊷@금액', Math.max(0, due));
    o.miss('㊵㊶㊷ 납부 및 신청일', '계산기에 없음');
    signBlock(o, ctx);
    o.check('⑲ = ⑰ − ⑱', gv, Math.max(0, ex - it));
    o.check('㉑ = ⑲ + ⑳', sum, gv + agg);
    o.check('㉖ = ㉑ − ㉒ − ㉓ − ㉔ − ㉕' + (extra ? ' − 감정평가수수료·재해손실공제(서식 칸 없음)' : ''), base, Math.max(0, sum - n(r.증여재산공제) - extra));
    o.check('㉘ = ㉖ × ㉗(누진)', calc, progressive(base));
    o.check('㉚ = ㉘ + ㉙', tot, calc + gen);
    o.check('㊴ = ㉚ − ㉛ − ㊱ + ㊲ + ㊳', due, tot - (cr.paid + cr.foreign + rep) - (ctx.finalSettlement ? init : 0) + pen + late);
    return o.result();
  };
  // 상증법 §26 세율(증여세 §56 준용) — 검산용(엔진 GIFT_INHERIT_TAX_BRACKETS와 같은 표)
  function progressive(b) {
    var T = [[1e8, 0.1, 0], [5e8, 0.2, 1e7], [1e9, 0.3, 6e7], [3e9, 0.4, 1.6e8], [Infinity, 0.5, 4.6e8]];
    for (var i = 0; i < T.length; i++) if (b <= T[i][0]) return Math.round(b * T[i][1] - T[i][2]);
    return 0;
  }
  ctxFor['증여10호의5'] = function (extra) {
    var r = g('lastExcessDividendGiftResult_'); if (!r) return null;
    var fin = H.checked('edFinalSettlement');
    return Object.assign(peopleFromApp(), { r: r, filingStatus: H.el('edFilingStatus') || 'ontime', finalSettlement: !!fin, edInput: aggInputOf('ed'),
      relation: relationOfFirstDonor(), giftDate: H.el('edGiftDate') || H.el('giftDate') }, extra || {});
  };
  ready['증여10호의5'] = function () { return !!g('lastExcessDividendGiftResult_'); };

  // ═════════ 상증 별지 제10호의6서식 — 특정법인과의 거래를 통한 이익의 증여의제(상증법 §45의5) ═════════
  //  ctx: { r: lastSpecificCorpGiftResult_, filingStatus(scFilingStatus), scInput: {benefitToCorpAmount, shareholderOwnershipRatio, directGiftTaxEquivalent,
  //         priorGiftAmount, priorPaidTax}, fiscalYearEnd(scFiscalYearEnd), donee, donor, relation, giftDate(scTransactionDate 거래한 날 — §45의5①), taxAgent, 신고일 }
  //  ㊲ 산출세액 한도 = 엔진 안의 capLimit(결과에 없음)을 같은 식으로: 직접 증여 시 증여세 상당액 − round(법인세상당액 전체 × 주식보유비율)
  mappers['증여10호의6'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, inp = ctx.scInput || {};
    filing(o, ctx);
    people(o, ctx, ['⑯', '⑰', '⑱', '⑲']);
    o.miss('⑬ 법인명 ⑭ 사업자등록번호', '계산기에 없음 — 특정법인 탭에 법인 정보 칸이 없음');
    var fy = String(ctx.fiscalYearEnd || '');
    if (/^\d{4}-\d{2}/.test(fy)) o.set('⑮', fy.slice(0, 4) + '.' + fy.slice(5, 7)); else o.miss('⑮ 사업연도 종료월', '화면 입력 없음(특정법인 사업연도 종료일)');
    var gv = n(r.증여의제이익);
    o.set('⑳', gv);
    if (r.과세대상여부 === false) {
      o.note('⚠ 엔진: 과세대상 아님 — ' + (r.안내 || ''));
      o.miss('㉑~53 세액 계산', '과세대상 아님(엔진 판정) — ' + (r.안내 || ''));
      signBlock(o, ctx); return o.result();
    }
    o.miss('㉑ 비과세 ㉒㉓㉔ 과세가액 불산입 ㉕ 채무액', '계산기에 없음 — 특정법인 탭에 입력 칸이 없음(엔진은 0으로 계산)');
    var agg = aggOf(r, inp, gv), sum = gv + agg;
    o.set('㉖', agg).set('㉗', sum);
    deductCells(o, r, ctx, ['㉘', '㉙', '㉚', '㉛']);
    if (n(r.증여재산공제)) o.note('⚠ 엔진 안내: 증여자가 지배주주의 친족이 아닌 특정법인 자체이므로 증여재산공제(§53)는 통상 적용되지 않음 — 공제 ' + n(r.증여재산공제) + '원이 들어가 있음');
    var base = n(r.과세표준), dis = n(r.재해손실공제), fee = n(r.감정평가수수료공제);
    o.set('㉜', dis).set('㉝', fee).set('㉞', base).set('㉟', H.giftInheritRate(base));
    var calc = n(r.산출세액), raw = progressive(base);
    o.set('㊱', calc);
    var cap = null;
    if (n(inp.benefitToCorpAmount) > 0 && n(inp.shareholderOwnershipRatio) > 0) {
      var ratio = Math.min(1, Math.max(0, n(inp.shareholderOwnershipRatio)));
      var direct = n(inp.directGiftTaxEquivalent) > 0 ? n(inp.directGiftTaxEquivalent) : progressive(Math.round(n(inp.benefitToCorpAmount) * ratio));
      cap = Math.max(0, direct - Math.round(n(r.법인세상당액_전체) * ratio));
      o.set('㊲', cap);
      if (calc < raw) o.note('㊱ 산출세액은 ㊲ 한도(상증법 §45의5②)로 낮춘 값 — 세율 적용 세액 ' + raw + '원');
    } else o.miss('㊲ 산출세액 한도', '화면 입력 없음(특정법인 이익·주식보유비율) — 엔진 안의 한도 값을 되살릴 수 없음');
    var gen = n(r.세대생략할증액), tot = has(r.산출세액_할증후) ? n(r.산출세액_할증후) : calc + gen;
    o.set('㊳', gen).set('㊴', tot);
    o.miss('㊵ 이자상당액 ㊶ 박물관자료 등 징수유예세액', '계산기에 없음 — 특정법인 탭에 입력 칸이 없음(엔진은 0으로 계산)');
    var cr = creditsOf(r, inp), rep = n(r.신고세액공제);
    o.set('㊸', cr.paid).set('㊹', cr.foreign).set('㊺', rep).set('㊷', cr.paid + cr.foreign + rep);
    o.miss('㊻ 그 밖의 공제ㆍ감면세액', '계산기에 없음 — 특정법인 탭에 입력 칸이 없음(엔진은 0으로 계산)');
    var pen = n(r.무신고가산세) + n(r.과소신고가산세), late = n(r.납부지연가산세), due = n(r.납부세액);
    o.set('㊼', pen).set('㊽', late).set('㊿', due);
    o.miss('㊾ 공익법인 등 관련 가산세', '계산기에 없음 — 특정법인 탭에 입력 칸이 없음');
    o.miss('51 연부연납 52 분납', '계산기에 없음 — 특정법인 탭에 연부연납·분납 칸이 없음(나눠 내면 직접 적고 53을 고칠 것)');
    o.set('53@금액', due);
    o.miss('51·52·53 납부 및 신청일', '계산기에 없음');
    signBlock(o, ctx);
    o.check('㉗ = ⑳ − ㉑ − ㉒ − ㉓ − ㉔ − ㉕ + ㉖', sum, gv + agg);
    o.check('㉞ = ㉗ − ㉘ − ㉙ − ㉚ − ㉛ − ㉜ − ㉝', base, Math.max(0, sum - n(r.증여재산공제) - dis - fee));
    o.check('㊱ = min(㉞ × ㉟(누진), ㊲)', calc, cap === null ? raw : Math.min(raw, cap));
    o.check('㊴ = ㊱ + ㊳', tot, calc + gen);
    o.check('㊿ = ㊴ + ㊵ − ㊶ − ㊷ + ㊼ + ㊽ + ㊾', due, Math.max(0, tot - (cr.paid + cr.foreign + rep) + pen + late));
    return o.result();
  };
  ctxFor['증여10호의6'] = function (extra) {
    var r = g('lastSpecificCorpGiftResult_'); if (!r) return null;
    var a = aggInputOf('sc');
    return Object.assign(peopleFromApp(), { r: r, filingStatus: H.el('scFilingStatus') || 'ontime', fiscalYearEnd: H.el('scFiscalYearEnd'),
      scInput: { benefitToCorpAmount: numv(H.el('scBenefitToCorp')), shareholderOwnershipRatio: numv(H.el('scShareRatio')), directGiftTaxEquivalent: numv(H.el('scDirectGiftTax')),
        priorGiftAmount: a.priorGiftAmount, priorPaidTax: a.priorPaidTax },
      relation: relationOfFirstDonor(), giftDate: H.el('scTransactionDate') }, extra || {});
  };
  ready['증여10호의6'] = function () { return !!g('lastSpecificCorpGiftResult_'); };

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  //  증여: 조특52호 = 그 증여 쌍의 계산 결과에 영농자녀 증여농지 세액감면이 있을 때(지금 인쇄가 일반 증여 신고서 뒤에 붙이는 것과 같음)
  //  10호의2·10호의5·10호의6은 일반 증여(10호)와 따로 내는 신고서라 이 묶음에 넣지 않음(서식 줄에서 찍음)
  function plan(tax, ctx) {
    var L = [];
    if (tax === '증여' && ctx && ctx.r && farmAmount(ctx) > 0) L.push('조특52호');
    return L;
  }

  return { 묶음: '증여특례A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
