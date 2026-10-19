/*
 * NxFormPrint 묶음 파일 — 양도감면A (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 조특54호 · 조특62호 · 조특63호의32 · 조특13호 · 조특14호 · 조특37호 · 조특51호의3
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-양도감면A.js → node tools/formprint-check-ext.js 양도감면A
 *
 * ── 감면신청서 ctx ── 양도 ctx(ctxFromApp.양도(i) — r·seller·assets…)에 감면자산(자산 번호)을 더한 것.
 *   감면세액은 합산 계산 결과 r.자산별_내역에서 그 자산(idx)의 '합산(장기)' 감면 줄(특례·감면액·감면산식)을 읽는다
 *   (엔진 reductions90_ — 소득세법 §90① A × (B − C) ÷ D × E, 조특법 §133 한도). 자산 목록과 엔진 거래 수가 다르면
 *   (환지 증가분 등) 자산 번호가 어긋날 수 있어 감면세액은 비운다.
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
    '조특54호': "조세특례제한법 시행규칙 [별지 제54호서식]", // 공익사업용토지 등에 대한 세액감면신청서(부표: 토지 등 수용사실 확인서)
    '조특62호': "조세특례제한법 시행규칙 [별지 제62호서식]", // 장기임대주택에 대한 양도소득 세액감면신청서
    '조특63호의32': "조세특례제한법 시행규칙 [별지 제63호의32서식]", // 연금계좌 납입에 대한 양도소득세 세액공제신청서
    '조특13호': "조세특례제한법 시행규칙 [별지 제13호서식]", // 현물출자 등에 대한 세액감면(면제)신청서
    '조특14호': "조세특례제한법 시행규칙 [별지 제14호서식]", // 개발제한구역 지정에 따른 매수대상 토지 등에 대한 세액감면신청서
    '조특37호': "조세특례제한법 시행규칙 [별지 제37호서식]", // 구조조정대상부동산등세액감면신청서
    '조특51호의3': "조세특례제한법 시행규칙 [별지 제51호의3서식]", // 경영회생 지원을 위한 농지 매매 등에 대한 양도소득세 환급신청서
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // ───────── 공용 ─────────
  // 이 감면신청서의 자산(ctx.감면자산 번호, 없으면 0번)
  function pick(ctx) {
    var list = ctx.assets || [], i = has(ctx.감면자산) ? Number(ctx.감면자산) : 0, it = list[i] || {};
    return { i: i, it: it, a: it.asset || {} };
  }
  // 그 자산의 엔진 자산별 내역(자산 목록과 엔진 거래 수가 같을 때만 — 환지 증가분이 붙으면 번호가 어긋남)
  function notesOf(ctx, i) {
    var r = ctx.r || {};
    if (!Array.isArray(r.자산별_내역) || (ctx.assets || []).length !== n(r.거래건수)) return null;
    return r.자산별_내역.filter(function (x) { return x.idx === i; });
  }
  // 합산(장기) 감면 줄 — 특례 이름(label)이 re에 맞는 것(추징 줄은 감면액이 음수라 뺌)
  function redNotes(notes, re) {
    return (notes || []).filter(function (x) { return x.구분 === '합산(장기)' && typeof x.감면액 === 'number' && x.감면액 >= 0 && re.test(String(x.특례 || '')); });
  }
  // 엔진 감면산식 글 'A 70,310,000 × (B 240,000,000 − C 2,500,000) ÷ D 237,500,000 × E 15%' 읽기
  function formulaOf(note) {
    var m = String(note && note.감면산식 || '').match(/A ([\d,]+) × \(B ([\d,]+) − C ([\d,]+)\) ÷ D ([\d,]+) × E ([\d.]+)%/);
    if (!m) return null;
    var g = function (s) { return Number(String(s).replace(/,/g, '')); };
    return { A: g(m[1]), B: g(m[2]), C: g(m[3]), D: g(m[4]), E: Number(m[5]) / 100 };
  }
  // 감면세액 검산: 소득세법 §90① 감면세액 = A × (B − C) ÷ D × E (원 미만 버림), §133 한도로 깎인 몫은 더해서 비교
  function checkRed(o, 칸, note) {
    var f = formulaOf(note); if (!f || !f.D) return f;
    var cut = n(note.조특법133_한도로_감면안함);
    o.check(칸 + ' = A × (B − C) ÷ D × E (소득세법 §90①' + (cut ? ', §133 한도 ' + cut + '원 더함' : '') + ')', n(note.감면액) + cut, Math.floor(f.A * Math.max(0, f.B - f.C) / f.D * f.E + 1e-6));
    if (cut) o.note(칸 + ' — 조특법 §133 한도로 ' + cut + '원은 감면하지 않음(엔진 감면한도_조특법133)');
    return f;
  }
  // 날짜 연·월·일 세 칸
  function setYmd(o, key, s) { var d = H.ymd(s); if (d) o.set(key + '.연', d.y).set(key + '.월', d.m).set(key + '.일', d.d); return !!d; }
  // 주민등록번호 → 생년월일(뒤 첫 자리 1·2·5·6 → 1900년대, 3·4·7·8 → 2000년대, 9·0 → 1800년대). 13자리일 때만
  function birthOf(regNo) {
    var d = String(regNo || '').replace(/\D/g, '');
    if (d.length !== 13) return '';
    var c = { '1': '19', '2': '19', '5': '19', '6': '19', '3': '20', '4': '20', '7': '20', '8': '20', '9': '18', '0': '18' }[d[6]];
    return c + d.slice(0, 2) + '.' + d.slice(2, 4) + '.' + d.slice(4, 6);
  }
  // 엔진 취득가액(환산·감정 등이면 그 값) — 84호 부표1 ⑫와 같은 엔진 입력값(취득 부대비용을 더하기 전)
  function acqOf(it, a) {
    var ev = it.ev || H.evFromSingle(a, it.single);
    return (ev && ev.ok && has(ev.acq)) ? ev.acq : n(a.acquisitionPrice);
  }
  // 앱 화면: 양도인마다 ctx(ctxFromApp.양도) → 감면 대상 자산마다 ctx 하나
  function sellerCtxs(extra) {
    var out = [];
    var items = (typeof lastTransferResults_ !== 'undefined' && lastTransferResults_ ? lastTransferResults_ : []).filter(function (it) { return it.result && !it.result.error; }); // eslint-disable-line no-undef
    for (var i = 0; i < items.length; i++) { try { out.push(H.ctxFromApp.양도(i, extra)); } catch (e) { /* 그 양도인은 건너뜀 */ } }
    return out;
  }
  function perAsset(test) {
    return function (extra) {
      var L = [];
      sellerCtxs(extra).forEach(function (c) { (c.assets || []).forEach(function (it, j) { if (test(it.asset || {}, c, j)) L.push(Object.assign({}, c, { 감면자산: j })); }); });
      return L;
    };
  }
  function readyOf(f) { return function () { try { return f().length > 0; } catch (e) { return false; } }; }

  var COMP_CASH = ['cash', 'bond', 'bond_3y', 'bond_5y'];

  // ───────── 조특 별지 제54호서식(공익사업용토지 등 세액감면신청서) + 부표(토지 등 수용사실 확인서) ─────────
  //  신청인은 사업시행자(매입자) — 조특법 시행령 §72④(법 §77② 지정 전 양도)·§72⑦(법 §77⑥) "사업시행자가 … 세액감면신청서 …를
  //  양도자의 납세지 관할세무서장에게 제출". 부표도 사업시행자가 작성·직인. 그래서 plan·ready에 넣지 않는다(양도자가 수용(§77①3호)으로
  //  직접 신청하면 시행령 §72⑧ — 별지 13호 '공익사업용 토지' 칸). 연결표는 계산기에 있는 양도인·토지·감면세액만 채운다.
  mappers['조특54호'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, p = pick(ctx), a = p.a;
    o.note('이 서식은 사업시행자(매입자)가 내는 신청서입니다(조특법 시행령 §72④·⑦) — 양도자 신고 묶음에는 넣지 않음');
    o.miss('①②③④⑤ 신청인(사업시행자) 상호·사업자등록번호·대표자·주민등록번호·주소·전화번호', '계산기에 없음 — 사업시행자 정보 입력 칸 없음');
    o.miss('⑥⑦ 양도인 상호·사업자등록번호', '계산기에 없음 — 양도인 카드에 상호·사업자등록번호 칸 없음');
    o.need('⑧', s.name, '⑧ 양도인 성명').need('⑨', s.regNo, '⑨ 양도인 주민등록번호').need('⑩', H.fullAddr(s), '⑩ 양도인 주소');
    o.need('⑪', a.assetLocation, '⑪ 소재지');
    if (n(a.assetArea)) o.set('⑫', n(a.assetArea)); else o.miss('⑫ 면적', '화면 입력 없음(자산 카드 면적)');
    o.set('⑬', acqOf(p.it, a));
    o.note('⑬ 취득가격·⑭ 취득일은 양도인이 그 토지를 취득한 값 — §77① "사업인정고시일부터 소급하여 2년 이전에 취득" 확인용(서식 ⑭에 상속·이월과세 증여 줄이 있음)');
    var carry = (notesOf(ctx, p.i) || []).some(function (x) { return x.구분 === '이월과세(§97의2)' && x.적용여부 === true; });
    if (a.isInheritedAsset) {
      if (!setYmd(o, '⑭@상속', a.inheritedDecedentAcquisitionDate)) o.miss('⑭ 피상속인 취득일', '화면 입력 없음(자산 카드 상속 — 피상속인 취득일)');
    } else if (carry && has(a.donorAcquisitionDate)) setYmd(o, '⑭@증여', a.donorAcquisitionDate);
    else if (!setYmd(o, '⑭@매입', a.acquisitionDate)) o.miss('⑭ 매입취득일', '화면 입력 없음(취득일)');
    o.miss('⑭ 계약일(매입·상속·증여 줄)', '계산기에 없음 — 취득 계약일 입력 칸 없음');
    o.miss('⑮ 사업시행자 지정일', '계산기에 없음 — 화면의 사업인정고시일(publicNoticeDate)과 다른 날');
    var notes = notesOf(ctx, p.i), red = redNotes(notes, /^수용감면/)[0];
    if (COMP_CASH.indexOf(a.compensationType) < 0) o.miss('⑯ 감면받을 세액', '자산 카드 보상 방식이 현금·채권이 아님(' + (a.compensationType || '없음') + ')');
    else if (!notes) o.miss('⑯ 감면받을 세액', '자산 목록과 엔진 거래 수가 달라(환지 증가분 등) 자산별 감면세액을 고를 수 없음');
    else if (!red) o.miss('⑯ 감면받을 세액', '엔진에 이 자산의 수용감면 줄 없음(2년 이전 취득 요건·적용기한·단기양도 등으로 감면 안 됨)');
    else { o.set('⑯', n(red.감면액)); checkRed(o, '⑯', red); }
    o.miss('근거조항 [ ]제72조제4항 [ ]제72조제7항', '계산기에 없음 — 지정 전 양도(법 §77②)인지 공익사업 시행자 양도(§77⑥)인지 구분 입력 없음');
    o.miss('신청일·신청인서명', '사업시행자가 적음');
    // 부표(토지 등 수용사실 확인서) — 사업시행자가 작성·직인. 양도자·토지·고시일·보상액만 계산기 값으로
    o.miss('부표 사업시행자(법인명·사업자번호·담당부서·전화번호)', '계산기에 없음');
    o.need('부표@양도자.성명', s.name, '부표 양도자 성명');
    var b = birthOf(s.regNo); if (b) o.set('부표@양도자.생년월일', b); else o.miss('부표 양도자 생년월일', '주민등록번호가 13자리가 아니라 못 셈');
    o.need('부표@양도자.주소지', H.fullAddr(s), '부표 양도자 주소지').need('부표@양도자.전화번호', s.phone, '부표 양도자 전화번호');
    o.miss('부표 수용근거 사업명·근거법령·고시번호', '계산기에 없음');
    if (has(a.publicNoticeDate)) o.set('부표@수용근거.사업인정고시일', a.publicNoticeDate); else o.miss('부표 사업인정고시일', '화면 입력 없음(자산 카드 사업인정고시일)');
    var COL = { cash: '부표②', bond: '부표④', bond_3y: '부표③', bond_5y: '부표③', land_replacement: '부표⑤' }[a.compensationType];
    var tp = n(a.transferPrice);
    if (COL && tp) {
      o.set('부표①', tp);
      ['부표②', '부표③', '부표④', '부표⑤'].forEach(function (k) { o.set(k, k === COL ? tp : 0); });
      o.note('부표 보상금: 계산기는 자산 하나에 보상 방식 하나(' + a.compensationType + ')만 받아 양도가액 전부를 그 열에 적음 — 현금·채권이 섞이면 고칠 것');
      o.check('부표 ① = ② + ③ + ④ + ⑤', o.values['부표①'], ['부표②', '부표③', '부표④', '부표⑤'].reduce(function (t, k) { return t + n(o.values[k]); }, 0));
    } else o.miss('부표 ①~⑤ 보상금', '보상 방식 또는 양도가액 없음');
    o.need('부표@물건.소재지', a.assetLocation, '부표 물건별 소재지');
    if (n(a.assetArea)) o.set('부표@물건.면적', n(a.assetArea)); else o.miss('부표 물건별 면적', '화면 입력 없음');
    if (tp) o.set('부표@물건.보상금액', tp);
    o.miss('부표 물건별 공부상·실제 지목·보상금 수령일·등기접수일·보상가액 산정기준일', '계산기에 없음');
    o.miss('부표 보상채권 만기보유 특약(체결일·만기일·예탁일)', '계산기에 없음(만기특약 여부·위반만 받음)');
    o.miss('부표 대토보상 내용(소재지·지목·면적·계약일)', '계산기에 없음');
    o.miss('부표 확인일', '사업시행자가 적음');
    return o.result();
  };

  // 신청일(= 신고일, 감면신청서는 과세표준신고와 함께 냄)·서명란·세무대리인·관할 세무서
  function signs(o, ctx, keys) {
    var s = ctx.seller || {}, ta = ctx.taxAgent || {};
    if (!setYmd(o, keys.date || '신청일', ctx.신고일)) o.miss('신청일', 'ctx.신고일 없음(감면신청서는 과세표준신고와 함께 냄)');
    if (keys.sign) o.need(keys.sign, s.name, '신청인 서명란 성명');
    if (keys.agent) { if (has(ta.name)) o.set(keys.agent, ta.name); else o.miss('세무대리인 서명란', '세무대리인 없음'); }
    if (keys.mgmt) { if (has(ta.mgmtNo)) o.set(keys.mgmt, ta.mgmtNo); else o.miss('세무대리인 관리번호', '세무대리인 관리번호 없음'); }
    if (keys.office) { if (has(s.taxOffice)) o.set(keys.office, H.officeName(s.taxOffice)); else o.miss('세무서', '양도인 관할 세무서 입력 없음'); }
  }

  // ───────── 조특 별지 제62호서식(장기임대주택에 대한 양도소득 세액감면신청서) — 조특법 §97·§97의2·§97의5 ─────────
  //  시행령 §97④·§97의2②·§97의5④ — 양도자가 과세표준신고와 함께 냄. 예전 인쇄(trLongTermRentalHousePrintPageHtml_)와 같게
  //  자산 카드 "장기임대주택 감면 적용 조문"(longTermRentalHouseProvision)이 있는 자산마다 한 장.
  //  감면 방식(엔진): §97 50%·§97의5(임대기간 중 소득 100%) = 세액감면(§90① — 자산별 내역 '합산(장기)' 줄),
  //                   §97 단서 100%·§97의2 100% = 그 자산 양도차익을 소득에서 빼는 방식(자산별 내역 '장기임대주택등감면' 줄, 감면세액 없음)
  var LR_LAW = { sect97: '조특법 §97', sect97_2: '조특법 §97의2', sect97_5: '조특법 §97의5' };
  mappers['조특62호'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, p = pick(ctx), a = p.a;
    o.need('신청인@성명', s.name, '신청인 성명');
    o.miss('신청인 사업자등록번호', '계산기에 없음 — 양도인 카드에 임대사업자 등록번호 칸 없음');
    var b = birthOf(s.regNo); if (b) o.set('신청인@생년월일', b); else o.miss('신청인 생년월일', '주민등록번호가 13자리가 아니라 못 셈');
    o.need('신청인@주소', H.fullAddr(s), '신청인 주소').need('신청인@전화번호', s.phone, '신청인 전화번호');
    o.need('소재지', a.assetLocation, '소재지');
    if (n(a.assetArea)) o.set('주택면적', n(a.assetArea)); else o.miss('주택면적', '화면 입력 없음(자산 카드 면적)');
    o.miss('임대개시당시 기준시가', '계산기에 없음 — 자산 카드에는 "등록일 당시 기준시가"만 있음(임대개시일과 같은 날인지 모름)');
    if (!setYmd(o, '취득일자', a.acquisitionDate)) o.miss('취득일자', '화면 입력 없음');
    if (!setYmd(o, '양도일자', a.transferDate)) o.miss('양도일자', '화면 입력 없음');
    o.miss('세법상 사업자등록일·민간임대주택법상 사업자등록일', '계산기에 없음 — 등록일 입력 칸 없음');
    o.miss('세액감면 대상기간', '계산기에 없음 — 임대기간(년) 입력 없이 세부 유형(lrSubType)만 고름');
    o.miss('임대내역(임차인·보증금·월세·임대기간)·① 기간', '계산기에 없음');
    var law = LR_LAW[a.longTermRentalHouseProvision];
    if (!law) o.miss('세액감면비율·감면대상소득·감면받고자 하는 세액', '자산 카드 장기임대주택 감면 조문 없음');
    else {
      o.note('적용 조문: ' + law + (a.longTermRentalHouseProvision === 'sect97' && a.lrSubType ? '(세부 유형 ' + a.lrSubType + ')' : ''));
      var notes = notesOf(ctx, p.i);
      var red = redNotes(notes, /^장기(임대주택 등|일반민간임대주택등) 감면/)[0];
      var excl = (notes || []).filter(function (x) { return x.구분 === '장기임대주택등감면(조특법§97계열)'; })[0];
      if (!notes) o.miss('세액감면비율·감면대상소득·감면받고자 하는 세액', '자산 목록과 엔진 거래 수가 달라(환지 증가분 등) 자산별 감면 값을 고를 수 없음');
      else if (red) {
        var f = checkRed(o, '감면받고자 하는 세액', red);
        o.set('감면받고자 하는 세액', n(red.감면액));
        if (f) o.set('세액감면비율', Math.round(f.E * 1000) / 10).set('감면대상소득', f.B);
        else o.miss('세액감면비율·감면대상소득', '엔진 감면산식 글을 읽지 못함');
        if (a.longTermRentalHouseProvision === 'sect97_5') o.note('감면대상소득 = 양도소득금액 × (임대기간 마지막 날 − 취득 당시 기준시가) ÷ (양도 당시 − 취득 당시 기준시가)(시행령 §97의5②) — 엔진 감면산식의 B');
      } else if (excl && excl.적용여부 === true) {
        o.set('세액감면비율', 100).set('감면대상소득', n(excl.제외소득금액));
        o.note('엔진은 100% 감면(§97①단서·§97의2)을 그 자산 양도차익(장기보유특별공제 전 ' + n(excl.제외소득금액) + '원)을 소득에서 빼는 방식으로 계산 — 감면세액을 따로 내지 않음');
        o.miss('감면받고자 하는 세액', '엔진이 100% 감면을 소득에서 빼는 방식으로 계산해 감면세액 값이 없음(계산 오류 의심 — 보고서)');
      } else o.miss('세액감면비율·감면대상소득·감면받고자 하는 세액', '엔진에서 감면이 적용되지 않음' + (excl && excl.사유 ? '(' + String(excl.사유).slice(0, 80) + ')' : ''));
    }
    signs(o, ctx, { sign: '신청인서명', agent: '세무대리인서명', mgmt: '세무대리인@관리번호', office: '세무서' });
    return o.result();
  };

  // ───────── 조특 별지 제63호의32서식(연금계좌 납입에 대한 양도소득세 세액공제신청서) — 조특법 §99의14, 시행령 §99의13② ─────────
  //  예전 인쇄(trPensionAccountCreditPrintPageHtml_)와 같게 연금계좌 납입액이 있는 자산마다 한 장.
  //  엔진(pensionCreditBase_): ⑮ = min(⑫ 1억 − 기납입 누적, ⑬ 납입액, ⑭ 양도가액 − 취득가액(소득세법 시행령 §40의2②1호 라목)), 공제 = ⑮ × 10%,
  //  합산이면 자산별 공제 합을 전체 산출세액으로 한 번 캡(연금계좌세액공제_합계). 같은 해 연금 납입 부동산이 둘 이상이면 자산별 값이 엔진에 없다.
  mappers['조특63호의32'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, r = ctx.r || {}, p = pick(ctx), a = p.a;
    o.need('①', s.name, '① 성명').need('②', s.regNo, '② 주민등록번호').need('③@주소', H.fullAddr(s), '③ 주소').need('③@전화번호', s.phone, '③ 전화번호');
    o.need('④', a.assetLocation, '④ 소재지').need('⑤', a.acquisitionDate, '⑤ 취득일').need('⑥', a.transferDate, '⑥ 양도일').need('⑦', a.pensionContributionDate, '⑦ 납입일');
    o.miss('⑧ 계좌주(성명·주민등록번호)·⑨ 연금계좌(은행 등·계좌번호 등)', '계산기에 없음');
    var paid = Math.max(0, n(a.pensionAccountContribution));
    var pensionAssets = (ctx.assets || []).filter(function (x) { return n((x.asset || {}).pensionAccountContribution) > 0; });
    var prior = Math.max.apply(null, [0].concat((ctx.assets || []).map(function (x) { return Math.max(0, n((x.asset || {}).pensionPriorContribution)); })));
    var diff = Math.max(0, n(a.transferPrice) - n(a.acquisitionPrice));
    o.set('⑬', paid).set('⑭', diff);
    o.note('⑭ 양도차익: 엔진은 소득세법 시행령 §40의2②1호 라목 문언대로 "양도가액 − 취득가액"(' + diff + '원) — 서식 작성방법 6은 필요경비까지 뺀 금액(판단 대기, 법령 우선)');
    o.miss('⑪ 기납입액 — 주택차액 납입액·부동산 양도대금 납입액 칸 나눔', '계산기는 기납입 누적액 합계 하나만 받음(' + prior + '원 — 다목·라목 구분 없음)');
    if (pensionAssets.length > 1) {
      o.miss('⑫⑮⑰ 잔여 한도·공제대상 금액·세액공제', '같은 해 연금계좌 납입 부동산이 ' + pensionAssets.length + '개 — 엔진은 앞 자산이 쓴 한도를 빼며 합계(연금계좌세액공제_합계 ' + n(r.연금계좌세액공제_합계) + '원)만 냄, 자산별 값 없음');
      return finish();
    }
    var remain = Math.max(0, 100000000 - prior), base = Math.min(remain, paid, diff);
    o.set('⑫', remain).set('⑮', base);
    o.check('⑫ = ⑩(1억원) − ⑪', remain, 100000000 - prior);
    o.check('⑮ = ⑫·⑬·⑭ 중 적은 금액', base, Math.min(remain, paid, diff));
    if (!has(r.연금계좌세액공제_합계)) { o.miss('⑰ 세액공제', '엔진 결과 없음'); return finish(); }
    var credit = n(r.연금계좌세액공제_합계), raw = Math.round(base * 0.1);
    o.set('⑰', credit);
    if (credit === raw) o.check('⑰ = ⑮ × ⑯(10%)', credit, raw);
    else if (credit > 0 && credit === Math.max(0, n(r.산출세액_합계))) { o.check('⑰ = 산출세액 한도(조특법 §99의14①)', credit, n(r.산출세액_합계)); o.note('⑰: ⑮ × 10%(' + raw + '원)가 산출세액보다 커서 산출세액까지만 공제'); }
    else o.note('⑰: 엔진 공제액 ' + credit + '원 ≠ ⑮ × 10%(' + raw + '원) — 요건(기초연금 수급자·1주택 이하 세대·10년 이상 보유·2027.12.31.까지 양도·양도일부터 6개월 안 납입) 미충족이면 0');
    if (n(r.연금계좌세액공제_추징액)) o.note('5년 안 연금 수령(인출)으로 추징 ' + n(r.연금계좌세액공제_추징액) + '원(84호 본표에서)');
    return finish();
    function finish() { signs(o, ctx, { sign: '신청인서명', office: '세무서' }); return o.result(); }
  };

  // ───────── 어떤 자산에 어떤 신청서 — 예전 인쇄(trAttach1PrintPageHtml_ 뒤에 붙는 함수들)가 그 서식을 그리는 조건과 같게 ─────────
  //  조특54호는 넣지 않음 — 사업시행자 제출(시행령 §72④·⑦)
  var TESTS = {};
  function register(k, test) { TESTS[k] = test; ctxFor[k] = perAsset(test); ready[k] = readyOf(ctxFor[k]); }
  register('조특62호', function (a) { return !!a.longTermRentalHouseProvision; });
  register('조특63호의32', function (a) { return n(a.pensionAccountContribution) > 0; });

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만) — 감면 대상 자산마다 한 장
  function plan(tax, ctx) {
    var L = [];
    if (tax !== '양도' || !ctx || !ctx.r) return L;
    Object.keys(TESTS).forEach(function (k) {
      (ctx.assets || []).forEach(function (it, j) { if (TESTS[k](it.asset || {}, ctx, j)) L.push({ formKey: k, ctx: Object.assign({}, ctx, { 감면자산: j }) }); });
    });
    return L;
  }

  return { 묶음: '양도감면A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
