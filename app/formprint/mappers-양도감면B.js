/*
 * NxFormPrint 묶음 파일 — 양도감면B (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 조특52호의3 · 조특62호의2 · 조특62호의3 · 조특63호 · 조특63호의2 · 조특63호의4
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-양도감면B.js → node tools/formprint-check-ext.js 양도감면B
 *
 * ── 한 장 = 자산 하나 ── 여섯 서식 모두 양도 자산(주택) 한 건에 대한 신청서·신고서라, ctx는 mappers.js ctxFromApp.양도(i)가 만든 것에
 *   ctx.특례자산 = ctx.assets 안의 자산 번호(0부터)를 더해 넘긴다. plan()·ctxFor가 해당 자산마다 장을 따로 만든다.
 *   엔진 값(장기보유특별공제율·특례 적용 여부)은 ctx.assets[k].single(calculateTransferTaxSingleJS 결과)에서 읽고,
 *   없으면 화면의 calculateTransferTaxSingleJS로 그 자산을 다시 계산한다(지금 인쇄 trAttach1EngineValues_와 같은 방법).
 *
 * ── 언제 찍나(지금 인쇄 taxcalc.html trAttach1PrintPageHtml_ 뒤에 붙는 서식 함수와 같은 조건) ──
 *   조특62호의2 : asset.rentalSpecialType === 'rental_general' (trRentalGeneralPrintPageHtml_, 조특법 §97의3)
 *   조특62호의3 : asset.rentalSpecialType === 'rental_long'    (trRentalLongPrintPageHtml_, 조특법 §97의4)
 *   조특52호의3 : asset.oneHouseSpecialCase.formNo 가 [별지 제52호의3서식] ("특정주택 제외 판정" pd·u9 — 조특법 §71의2·§98의9)
 *   조특63호의4 : asset.oneHouseSpecialCase.formNo 가 [별지 제63호의4서식] ("특정주택 제외 판정" rh — 조특법 §99의4)
 *   조특63호의2 : 찍지 않음 — 옛 조특법 §99의2(2000.9.1.~2001.12.31. 기존주택 양도·신축주택 취득, 특례세율 10%) 전용 서식인데
 *                 계산기에 그 제도가 없음. 현행 §99의2(2013년 신축주택 감면)는 날인 매매계약서 사본만 냄(지금 인쇄 trNewHouseSect992PrintPageHtml_).
 *   조특63호    : 찍지 않음 — 법 §98(1995.11.1.~1997.12.31. 취득 미분양주택, 20% 세율·종합소득 선택) 전용 서식인데 계산기에 §98 갈래가 없음.
 *                 §98의3~§98의8 감면은 날인 매매계약서 사본만 냄(지금 인쇄 trUnsoldHouseSect63PrintPageHtml_ — 세액인쇄 서식표에서도 뺌).
 *   두 서식의 연결표·위치판은 만들어 둠(세무사님이 직접 고른 자산으로 찍을 때 쓰도록 — 계산기에 없는 칸은 비움).
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
    '조특52호의3': "조세특례제한법 시행규칙 [별지 제52호의3서식]", // 1세대 1주택 과세특례(인구감소지역주택, 준공후미분양주택 취득자) 신고서
    '조특62호의2': "조세특례제한법 시행규칙 [별지 제62호의2서식]", // 장기일반민간임대주택등에 대한 과세특례적용신청서
    '조특62호의3': "조세특례제한법 시행규칙 [별지 제62호의3서식]", // 장기임대주택에 대한 과세특례적용신청서
    '조특63호': "조세특례제한법 시행규칙 [별지 제63호서식]", // 미분양주택과세특례적용신고서
    '조특63호의2': "조세특례제한법 시행규칙 [별지 제63호의2서식]", // 양도소득세특례세율적용신청서
    '조특63호의4': "조세특례제한법 시행규칙 [별지 제63호의4서식]", // 농어촌주택 등 취득자에 대한 과세특례신고서
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // ───────── 공용 ─────────
  // 서식에 해당하는 자산인지(지금 인쇄 함수의 조건 그대로)
  var WHEN = {
    '조특62호의2': function (a) { return a.rentalSpecialType === 'rental_general'; },
    '조특62호의3': function (a) { return a.rentalSpecialType === 'rental_long'; },
    '조특52호의3': function (a) { return !!(a.oneHouseSpecialCase && /제52호의3서식/.test(a.oneHouseSpecialCase.formNo || '')); },
    '조특63호의4': function (a) { return !!(a.oneHouseSpecialCase && /제63호의4서식/.test(a.oneHouseSpecialCase.formNo || '')); },
    '조특63호의2': function () { return false; },
    '조특63호': function () { return false; }
  };
  function itemOf(ctx) { var k = n(ctx.특례자산); return (ctx.assets || [])[k] || {}; }
  // 그 자산의 calculateTransferTaxSingleJS 결과(ctx에 있으면 그것, 없으면 화면 엔진으로 다시 계산 — trAttach1EngineValues_와 같은 방법)
  function singleOf(it) {
    if (it.single) return it.single;
    var f = root.calculateTransferTaxSingleJS;
    if (typeof f !== 'function' || !it.asset) return null;
    try { return f(JSON.parse(JSON.stringify(it.asset))); } catch (e) { return null; }
  }
  // 주민등록번호 → 생년월일(뒤 첫 자리 1·2·5·6 = 1900년대, 3·4·7·8 = 2000년대, 9·0 = 1800년대). 13자리가 아니면 ''
  function birthOf(regNo) {
    var d = String(regNo || '').replace(/\D/g, '');
    if (d.length !== 13) return '';
    var c = d[6], cen = /[1256]/.test(c) ? '19' : /[3478]/.test(c) ? '20' : '18';
    return cen + d.slice(0, 2) + '.' + d.slice(2, 4) + '.' + d.slice(4, 6);
  }
  // 신청인(양도자) 칸: k = {name, birth|regNo, addr, phone} 위치판 키, 칸 = 칸 이름
  function applicant(o, s, k, 칸) {
    o.need(k.name, s.name, 칸 + ' 성명');
    if (k.birth) {
      var b = birthOf(s.regNo);
      if (b) o.set(k.birth, b); else o.miss(칸 + ' 생년월일', has(s.regNo) ? '주민등록번호가 13자리가 아니라 생년월일을 못 읽음' : '화면 입력 없음(주민등록번호)');
    }
    if (k.regNo) o.need(k.regNo, s.regNo, 칸 + ' 주민등록번호');
    if (k.addr) o.need(k.addr, H.fullAddr(s), 칸 + ' 주소');
    if (k.phone) o.need(k.phone, s.phone, 칸 + ' 전화번호');
  }
  // "년 월 일"이 인쇄된 칸
  function ymdSet(o, key, d, 칸, why) {
    var x = H.ymd(d);
    if (x) o.set(key + '.연', x.y).set(key + '.월', x.m).set(key + '.일', x.d);
    else o.miss(칸, why || '화면 입력 없음');
  }
  // 신청일·신청인 서명·(세무대리인)·세무서
  function signBlock(o, ctx, s, opt) {
    opt = opt || {};
    var dk = opt.dateKey || '신청일';
    var d = H.ymd(ctx.신고일);
    if (d) o.set(dk + '.연', d.y).set(dk + '.월', d.m).set(dk + '.일', d.d); else o.miss(opt.dateLabel || dk, 'ctx.신고일 없음(계산기에 없음)');
    o.need(opt.signKey || '신청인서명', s.name, opt.signLabel || '신청인(서명)');
    if (opt.agent) {
      var ta = ctx.taxAgent || {};
      if (has(ta.name)) {
        o.set('세무대리인서명', ta.name);
        if (has(ta.mgmtNo)) o.set('세무대리인관리번호', ta.mgmtNo); else o.miss('세무대리인(관리번호)', '세무대리인 관리번호 입력 없음');
      } else o.miss('세무대리인(서명)·세무대리인(관리번호)', '세무대리인 입력 없음(본인 신청)');
    }
    if (has(s.taxOffice)) o.set('세무서', H.officeName(s.taxOffice)); else o.miss('세무서', '양도인 관할 세무서 입력 없음');
  }
  function pct1(x) { return Math.round(n(x) * 1000) / 10; } // 0.7 → 70

  // ───────── 조특 별지 제62호의2서식 — 장기일반민간임대주택등에 대한 과세특례적용신청서(조특법 §97의3, 시행령 §97의3⑥) ─────────
  //  값 출처: 지금 인쇄 trRentalGeneralPrintPageHtml_(소재지·취득일·양도일·임대기간·공제율·기준시가) + 칸 해설 계산기칸.
  //  ② 공제율은 엔진(calculateTransferTaxSingleJS)의 장기보유특별공제율 — 특례가 적용됐을 때만(장기임대주택특례_적용여부).
  //  예전 인쇄는 rentalYears만 보고 8~10년이면 50%를 찍었는데(등록일 조건 없음), 여기선 엔진이 실제로 쓴 율을 찍는다.
  mappers['조특62호의2'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, it = itemOf(ctx), a = it.asset || {};
    applicant(o, s, { name: '신청인@성명', birth: '신청인@생년월일', addr: '신청인@주소', phone: '신청인@전화번호' }, '1. 신청인');
    o.need('소재지', a.assetLocation, '2. 소재지');
    o.miss('주택면적', '계산기에 없음');
    var startStd = n(a.rentalStartStandardPrice), regStd = n(a.registrationStandardPrice);
    if (startStd || regStd) {
      o.set('임대개시당시기준시가', startStd || regStd);
      if (!startStd) o.note('임대개시당시 기준시가 = 화면 "등록일 당시 기준시가"(실제 임대 개시일 기준시가 칸이 비어 있음 — 엔진도 이 값을 임대 개시일 기준시가로 씀, 시행령 §97의3④·⑤). 등록일과 임대 개시일이 다르면 고칠 것');
    } else o.miss('임대개시당시 기준시가', '화면 입력 없음(실제 임대 개시일·등록일 당시 기준시가 둘 다 비어 있음)');
    ymdSet(o, '취득일자', a.acquisitionDate, '취득일자');
    ymdSet(o, '양도일자', a.transferDate, '양도일자');
    o.miss('세법상 사업자등록일', '계산기에 없음');
    if (has(a.rentalRegistrationDate)) o.set('민간임대주택법상사업자등록일', a.rentalRegistrationDate);
    else o.miss('민간임대주택법상 사업자등록일', '화면 입력 없음(임대주택 등록일 — 2022.12.31. 이전 등록이면 8년 이상 50% 판정에 씀)');
    o.miss('3. 임대내역', '계산기에 없음 — 회차별 임차인 성명·생년월일, 보증금·월세, 임대기간 개시일·종료일');
    o.miss('① 기간(회차별 줄)', '계산기에 없음 — 임대 연수 한 값(rentalYears)만 있어 계 칸에만 찍음');
    var ry = n(a.rentalYears);
    if (has(a.rentalYears) && ry > 0) o.set('①@계', ry + '년'); else o.miss('① 기간 계', '화면 입력 없음(임대기간 연수)');
    var r = singleOf(it);
    if (!r || r.error) o.miss('②', '엔진 결과 없음' + (r && r.error ? '(' + r.error + ')' : ''));
    else if (!r.장기임대주택특례_적용여부) o.miss('②', '엔진: 특례 요건 미충족으로 일반 공제율 적용(10년 미만이고 2022.12.31. 이후 등록이거나 등록일 없음 — 법률 제19199호 부칙 제38조)');
    else {
      var rate = pct1(r.장기보유특별공제율);
      o.set('②', rate);
      // 서식 작성방법 2 표: 8년 이상 10년 미만 50%, 10년 이상 70%
      o.check('② = 작성방법 2 표(① 계 ' + ry + '년 → ' + (ry >= 10 ? '70' : '50') + '%)', rate, ry >= 10 ? 70 : (ry >= 8 ? 50 : 0));
      var sp = r.장기임대주택특례_임대기간중분리상세;
      if (sp) o.note('② 공제율은 임대기간 중 양도차익 ' + sp.임대기간중양도차익 + '원에만 적용, 임대 전 양도차익 ' + sp.임대전양도차익 + '원은 일반 공제율 ' + pct1(sp.임대전적용공제율) + '%(엔진 ' + sp.산식 + ')');
    }
    signBlock(o, ctx, s, { agent: true });
    return o.result();
  };

  // ───────── 조특 별지 제62호의3서식 — 장기임대주택에 대한 과세특례적용신청서(조특법 §97의4, 시행령 §97의4③) ─────────
  //  값 출처: 지금 인쇄 trRentalLongPrintPageHtml_(소재지·취득일·양도일·임대기간·등록일 당시 기준시가) + 칸 해설 계산기칸.
  //  ⑰ 추가공제율 = 서식 작성방법 3 표(= 법 §97의4① 표)로 ⑮ 기간 계에서 — 예전 인쇄엔 이 줄이 없었음.
  //  엔진(rentalLongTermRate 'rental_long')은 장기보유특별공제율 = 소득세법 §95② 표1 공제율 + 추가공제율로 계산 → 그 합을 검산.
  function addRate97_4(ry) { return ry >= 10 ? 10 : ry >= 9 ? 8 : ry >= 8 ? 6 : ry >= 7 ? 4 : ry >= 6 ? 2 : 0; }
  function table1(h) { return h >= 3 ? Math.min(30, 2 * Math.floor(h)) : 0; } // 소득세법 §95② 표1(3년 6% … 15년 이상 30%)
  mappers['조특62호의3'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, it = itemOf(ctx), a = it.asset || {};
    applicant(o, s, { name: '①', birth: '②', addr: '③@주소', phone: '③@전화번호' }, '①~③ 신청인');
    o.need('④', a.assetLocation, '④ 소재지');
    o.miss('⑤ 주택면적', '계산기에 없음').miss('⑥ 토지면적', '계산기에 없음');
    ymdSet(o, '⑦', a.acquisitionDate, '⑦ 취득일자');
    ymdSet(o, '⑧', a.transferDate, '⑧ 양도일자');
    o.miss('⑨ 세법상 사업자등록일', '계산기에 없음');
    if (has(a.rentalRegistrationDate)) o.set('⑩', a.rentalRegistrationDate); else o.miss('⑩ 민간임대주택법상 사업자등록일', '화면 입력 없음(임대주택 등록일)');
    o.miss('⑪·⑫·⑬·⑭ 임대내역(임차인 성명·생년월일, 임대기간 개시일·종료일)', '계산기에 없음');
    o.miss('⑮ 기간(회차별 줄)', '계산기에 없음 — 임대 연수 한 값(rentalYears)만 있어 계 칸에만 찍음');
    var ry = n(a.rentalYears);
    if (has(a.rentalYears) && ry > 0) o.set('⑮@계', ry + '년'); else o.miss('⑮ 기간 계', '화면 입력 없음(임대기간 연수)');
    var startStd = n(a.rentalStartStandardPrice), regStd = n(a.registrationStandardPrice);
    if (startStd || regStd) {
      o.set('⑯', startStd || regStd);
      if (!startStd) o.note('⑯ 임대개시일 당시 기준시가 = 화면 "등록일 당시 기준시가"(작성방법 2는 임대를 개시한 날 당시 주택+부수토지 기준시가 합계) — 등록일과 임대 개시일이 다르면 고칠 것');
    } else o.miss('⑯ 임대개시일 당시 기준시가 합계액', '화면 입력 없음(등록일 당시 기준시가)');
    var r = singleOf(it);
    if (ry < 6) o.miss('⑰', has(a.rentalYears) ? '임대기간 ' + ry + '년 — 6년 미만이라 추가공제 대상 아님(조특법 §97의4①)' : '화면 입력 없음(임대기간 연수)');
    else {
      var add = addRate97_4(ry);
      o.set('⑰', add);
      if (r && !r.error && r.장기임대주택특례_적용여부) {
        var h = n(r.입력값 && r.입력값.보유기간_년);
        o.check('엔진 장기보유특별공제율 = 소득세법 §95② 표1(보유 ' + h + '년) + ⑰ 추가공제율', pct1(r.장기보유특별공제율), table1(h) + add);
      } else o.note('엔진 결과에 장기임대주택 특례가 적용되지 않음' + (r && r.error ? '(' + r.error + ')' : '') + ' — ⑰은 작성방법 3 표로만 찍음');
    }
    if (a.isOneHouseOneFamily) o.note('⚠ 1세대 1주택(소득세법 §95② 단서 표2) 자산 — 조특법 §97의4① 단서는 이 경우 추가공제를 적용하지 않는다고 함. 엔진은 표1+추가공제율로 바꿔 계산하므로 확인 필요');
    signBlock(o, ctx, s, { agent: true });
    return o.result();
  };

  // ───────── 조특 별지 제52호의3서식 — 1세대 1주택 과세특례(인구감소지역주택·준공후미분양주택 취득자) 신고서 ─────────
  //  (조특법 §71의2·시행령 §68의2 / 조특법 §98의9·시행령 §98의8)
  //  값 출처: "특정주택 제외 판정"(pd·u9)이 양도 주택 카드에 남긴 asset.oneHouseSpecialCase{provisionLabel, formNo, acquisitionDate, 안내}
  //   (지금 인쇄 oneHouseSpecialCasePrintPageHtml_와 같은 값) + 양도 주택 카드(소재지·취득일·양도일·거주연수).
  //  판정 도구는 특례 주택의 소재지·면적·소유자·가격을 체크로만 받아 ⑨·⑪·⑫·⑬은 계산기에 없음.
  function specialKind52(c) { var t = String((c && c.provisionLabel) || ''); return /인구감소/.test(t) ? '인구감소' : /미분양/.test(t) ? '미분양' : null; }
  mappers['조특52호의3'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, it = itemOf(ctx), a = it.asset || {}, c = a.oneHouseSpecialCase || {};
    applicant(o, s, { name: '①', regNo: '②', addr: '③@주소', phone: '③@전화번호' }, '①~③ 신청인');
    o.need('④', a.assetLocation, '④ 소재지');
    if (has(a.acquisitionDate)) o.set('⑤', a.acquisitionDate); else o.miss('⑤ 취득일', '화면 입력 없음');
    if (has(a.transferDate)) o.set('⑥', a.transferDate); else o.miss('⑥ 양도일', '화면 입력 없음');
    var ly = n(a.residenceYears);
    if (a.isOneHouseOneFamily && has(a.residenceYears)) {
      o.set('⑦.이상', String(Math.floor(ly))).set('⑦.미만', String(Math.floor(ly) + 1));
      o.note('⑦ 거주기간 = 양도 주택 카드의 거주연수 ' + ly + '년(만 연수)을 "' + Math.floor(ly) + '년 이상 ' + (Math.floor(ly) + 1) + '년 미만"으로');
    } else o.miss('⑦ 거주기간', '화면 입력 없음(1세대1주택 거주연수)');
    var kind = specialKind52(c);
    if (kind === '인구감소') o.set('⑧', '인구감소지역 주택').set('시행령', '제68조의2');
    else if (kind === '미분양') o.set('⑧', '비수도권 준공 후 미분양주택').set('시행령', '제98조의8');
    else o.miss('⑧ 구분·시행령 조문', '특정주택 제외 판정 결과(pd·u9)가 없음');
    var col = kind || '인구감소';
    if (has(c.acquisitionDate)) o.set(kind === '미분양' ? '⑩@미분양' : '⑩@인구감소', kind === '미분양' ? [c.acquisitionDate] : c.acquisitionDate);
    else o.miss('⑩ 취득일(특례 주택)', '판정 도구에 특례 주택 취득일 입력 없음');
    if (kind) o.miss('⑩ 취득일(' + (kind === '미분양' ? '인구감소지역 주택' : '비수도권 준공 후 미분양주택') + ' 줄)', '해당 없음 — ⑧에서 고른 구분 줄에만 적음');
    o.miss('⑨ 소재지(특례 주택)', '계산기에 없음 — 판정 도구는 인구감소지역·수도권 밖 여부를 체크로만 받음');
    o.miss('⑪ 면적(전용면적)', '계산기에 없음 — 판정 도구는 면적·가격 요건 충족 여부를 체크로만 받음');
    o.miss('⑫ 소유자(성명·주민등록번호·양도자와 관계)', '계산기에 없음');
    o.miss('⑬ 주택가격 구분', '계산기에 없음 — ' + (col === '미분양' ? '취득가액' : '취득일 기준시가') + '(작성방법 6)이 판정 도구에 체크로만 있음');
    if (c.안내) o.note('판정 도구 안내: ' + c.안내);
    signBlock(o, ctx, s, { dateKey: '신고일', dateLabel: '신고일' });
    return o.result();
  };

  // ───────── 조특 별지 제63호의4서식 — 농어촌주택 등 취득자에 대한 과세특례신고서(조특법 §99의4, 시행령 §99의4⑩) ─────────
  //  값 출처: "특정주택 제외 판정"(rh)이 양도(일반)주택 카드에 남긴 asset.oneHouseSpecialCase{houseType 농어촌주택/고향주택, acquisitionDate, 안내}
  //   (지금 인쇄 oneHouseSpecialCasePrintPageHtml_와 같은 값) + 양도(일반)주택 카드(소재지·취득일·양도일).
  //  ④ 보유주택 열은 옛 법 §99의4⑤(수도권 조정대상지역 2주택 중 하나 양도 뒤 농어촌주택 취득) 때만 쓰는데 ⑤항이 삭제됨
  //   (법률 제21223호 2025.12.23. 공포·2026.1.1. 시행) — 비움.
  mappers['조특63호의4'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, it = itemOf(ctx), a = it.asset || {}, c = a.oneHouseSpecialCase || {};
    applicant(o, s, { name: '①', birth: '②', addr: '③@주소', phone: '③@전화번호' }, '①~③ 신청인');
    o.miss('④ 보유주택(⑦~⑩ 보유주택 열)', '해당 없음 — 조특법 §99의4⑤ 적용 때만 쓰는 열인데 ⑤항 삭제(법률 제21223호, 2026.1.1. 시행)');
    // ⑤ 양도(일반)주택
    o.need('⑦@양도일반주택', a.assetLocation, '⑦ 소재지(⑤ 양도(일반)주택)');
    o.miss('⑦ 소재지(⑥ 농어촌주택 등)', '계산기에 없음 — 판정 도구는 소재지 요건을 체크로만 받음');
    o.miss('⑧ 주택의 종류(단독주택·공동주택, ⑤·⑥ 열)', '계산기에 없음');
    o.miss('⑨ 면적(토지·건물, ⑤·⑥ 열)', '계산기에 없음');
    o.miss('⑩ 기준시가(토지·건물·합계, ⑤·⑥ 열)', '계산기에 없음 — 농어촌주택 등 가액 요건(취득 당시 3억원, 한옥 4억원 — 조특법 §99의4①1호나목)은 판정 도구에 체크로만 있음');
    ymdSet(o, '⑪@일반주택', a.acquisitionDate, '⑪ 취득일(일반주택)');
    ymdSet(o, '⑪@농어촌주택등', c.acquisitionDate, '⑪ 취득일(농어촌주택 등)', '판정 도구에 농어촌주택 등 취득일 입력 없음');
    o.miss('⑫ 계약금 납부일(일반주택·농어촌주택 등)', '계산기에 없음');
    if (has(a.transferDate)) o.set('⑬@일반주택', a.transferDate); else o.miss('⑬ 양도일(일반주택)', '화면 입력 없음');
    o.miss('⑬ 양도일(농어촌주택 등)', '계산기에 없음(농어촌주택 등은 보통 계속 보유 — 양도했으면 직접 적음)');
    var x = H.ymd(c.acquisitionDate);
    if (x) o.set('⑭@농어촌주택등.시작.연', x.y).set('⑭@농어촌주택등.시작.월', x.m).set('⑭@농어촌주택등.시작.일', x.d);
    o.miss('⑭ 보유기간 끝(농어촌주택 등)·④⑤ 합친 칸', '확인 필요 — 작성방법 5 "취득일부터 양도일까지"의 양도일이 일반주택 양도일인지 농어촌주택 등 양도일인지 서식에 없음(시작은 ⑪ 농어촌주택 등 취득일). ④·⑤ 합친 칸의 쓰임도 서식에 설명 없음');
    if (c.houseType) o.note('판정 도구 구분: ' + c.houseType + ' — 서식에는 이 구분 칸이 없음(⑧은 단독·공동주택 구분)');
    if (c.안내) o.note('판정 도구 안내: ' + c.안내);
    signBlock(o, ctx, s, { dateKey: '신고일', dateLabel: '신고일', signKey: '제출인서명', signLabel: '제출인(서명)' });
    return o.result();
  };

  // ───────── 조특 별지 제63호의2서식 — 양도소득세특례세율적용신청서(옛 조특법 §99의2, 옛 시행령 §99의2④) ─────────
  //  옛 §99의2(2000.9.1.~2001.12.31. 1년 이상 보유 기존주택 양도 + 신축주택 취득 → 특례세율 10%)는 2005.12.31. 삭제됐고 계산기에 없다.
  //  지금 인쇄는 이 서식을 만들지 않는다(현행 §99의2 감면은 날인 매매계약서 사본 — trNewHouseSect992PrintPageHtml_).
  //  세무사님이 그 시절 사건에 직접 고른 자산으로 찍을 때를 위해 양도인·양도주택 칸만 채우고, 특례세율 계산·신축주택 칸은 비운다.
  mappers['조특63호의2'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, it = itemOf(ctx), a = it.asset || {};
    applicant(o, s, { name: '①', regNo: '②', addr: '③@주소', phone: '③@전화번호' }, '①~③ 신청인');
    o.need('④', a.assetLocation, '④ 소재지(양도주택)');
    o.miss('⑤ 토지면적·⑥ 건물면적', '계산기에 없음');
    if (has(a.acquisitionDate)) o.set('⑦', a.acquisitionDate); else o.miss('⑦ 취득일자', '화면 입력 없음');
    if (has(a.transferDate)) o.set('⑧', a.transferDate); else o.miss('⑧ 양도일자', '화면 입력 없음');
    o.miss('⑨ 과세표준·⑪ 산출세액', '계산기에 없음 — 옛 조특법 §99의2 특례세율(10%) 계산이 계산기에 없음(일반 계산의 과세표준과 같은 값이 아님)');
    o.miss('⑫·⑬·⑭·⑮·⑯ 신축주택 취득명세', '계산기에 없음');
    o.note('⚠ 옛 조특법 §99의2(2000.9.1.~2001.12.31. 기존주택 양도·신축주택 취득, 2005.12.31. 삭제) 전용 서식 — 현행 §99의2(2013년 신축주택 감면)에는 쓰지 않음(시행령 §99의2⑧ 날인 매매계약서 사본)');
    signBlock(o, ctx, s, {});
    return o.result();
  };

  // ───────── 조특 별지 제63호서식 — 미분양주택과세특례적용신고서(조특법 §98, 시행령 §98④) ─────────
  //  법 §98(1995.11.1.~1997.12.31. 취득 미분양 국민주택을 5년 이상 보유·임대 후 양도 — 양도소득세 20% 또는 종합소득세 선택) 전용.
  //  계산기에 §98 갈래가 없고, §98의3~§98의8 감면에는 이 서식을 쓰지 않는다(날인 매매계약서 사본 — trUnsoldHouseSect63PrintPageHtml_).
  //  세무사님이 직접 고른 자산으로 찍을 때를 위해 신고인·양도명세 칸만 채우고, 과세특례 계산 칸(⑨~⑭)은 비운다.
  mappers['조특63호'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, it = itemOf(ctx), a = it.asset || {};
    applicant(o, s, { name: '①', regNo: '②', addr: '③' }, '①~③ 신고인');
    if (has(a.assetLocation)) o.set('④', [a.assetLocation]); else o.miss('④ 소재지', '화면 입력 없음');
    o.miss('⑤ 토지면적·⑥ 건물면적', '계산기에 없음');
    if (has(a.acquisitionDate)) o.set('⑦', [a.acquisitionDate]); else o.miss('⑦ 취득(계약)일자', '화면 입력 없음');
    if (has(a.transferDate)) o.set('⑧', [a.transferDate]); else o.miss('⑧ 양도일자', '화면 입력 없음');
    o.miss('⑨ 과세표준·⑪ 산출세액(양도소득세)', '계산기에 없음 — 조특법 §98① 20% 특례세율 계산이 계산기에 없음');
    o.miss('⑫ 총수입금액·⑬ 필요경비·⑭ 차감소득금액(종합소득세)', '계산기에 없음 — 종합소득세 선택 계산 없음');
    var ad = String(a.acquisitionDate || '');
    if (ad && (ad < '1995-11-01' || ad > '1997-12-31')) o.note('⚠ 취득일 ' + ad + ' — 법 §98①의 취득기간(1995.11.1.~1997.12.31.) 밖');
    o.note('⚠ 법 §98(1995~1997 취득 미분양주택) 전용 서식 — §98의3~§98의8 감면에는 쓰지 않음(각 시행령의 날인 매매계약서 사본 제출)');
    signBlock(o, ctx, s, { dateKey: '신고일', dateLabel: '신고일', signKey: '신고인서명', signLabel: '신고인(서명)' });
    return o.result();
  };

  // ───────── 세액인쇄 화면용: 서식 한 장씩 ctx(양도인마다·자산마다) ─────────
  /* global lastTransferResults_ */
  function trItems() { return (typeof lastTransferResults_ !== 'undefined' && lastTransferResults_ ? lastTransferResults_ : []).filter(function (it) { return it.result && !it.result.error; }); }
  Object.keys(WHEN).forEach(function (k) {
    ctxFor[k] = function (extra) {
      var out = [];
      trItems().forEach(function (item, i) {
        if (!(item.assets || []).some(WHEN[k])) return;
        var c = H.ctxFromApp.양도(i, extra);
        (c.assets || []).forEach(function (x, j) { if (WHEN[k](x.asset || {})) out.push(Object.assign({}, c, { 특례자산: j })); });
      });
      return out;
    };
    ready[k] = function () { return trItems().some(function (item) { return (item.assets || []).some(WHEN[k]); }); };
  });

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만) — 양도: 해당 자산마다 한 장
  function plan(tax, ctx) {
    var L = [];
    if (tax !== '양도' || !ctx) return L;
    ['조특62호의2', '조특62호의3', '조특52호의3', '조특63호의4', '조특63호의2', '조특63호'].forEach(function (k) {
      if (typeof mappers[k] !== 'function') return;
      (ctx.assets || []).forEach(function (x, j) { if (WHEN[k](x.asset || {})) L.push({ formKey: k, ctx: Object.assign({}, ctx, { 특례자산: j }) }); });
    });
    return L;
  }

  return { 묶음: '양도감면B', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
