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
  // [2026.10.20 서식 감사(양도)] 소득세법 §104⑤1호(비교과세)가 채택된 해는 엔진이 감면을 그 해 전체 A·D로 다시 계산해
  //  '비교과세 1호 감면' 줄에 두고 84호 ⑪ 감면세액·납부세액도 그 값으로 낸다. 감면신청서 감면세액은 신고서에 실제 반영된 감면세액과
  //  같아야 하므로(13호 작성방법 1 "감면종합한도를 적용한 후의 순수 감면액") 그 줄이 있으면 그것을, 없으면 '합산(장기)'(2호) 줄을 읽는다.
  var RED_1HO_ = '비교과세 1호 감면(§90① A·D = 그 해 전체)';
  function redNotes(notes, re) {
    var pick_ = function (g) { return (notes || []).filter(function (x) { return x.구분 === g && typeof x.감면액 === 'number' && x.감면액 >= 0 && re.test(String(x.특례 || '')); }); };
    var one = pick_(RED_1HO_);
    return one.length ? one : pick_('합산(장기)');
  }
  // 엔진 감면산식 글 'A 70,310,000 × (B 240,000,000 − C 2,500,000) ÷ D 237,500,000 × E 15%' 읽기
  function formulaOf(note) {
    var m = String(note && note.감면산식 || '').match(/A ([\d,]+) × \(B ([\d,]+) − C ([\d,]+)\) ÷ D ([\d,]+)(?:\([^)]*\))? × E ([\d.]+)%/); // [2026.10.20] 세율 묶음이 둘 이상인 해(§104⑤2호 단서)는 엔진이 D 뒤에 "(그 세율 묶음 — §104⑤2호)"를 붙임
    var g = function (s) { return Number(String(s).replace(/,/g, '')); };
    var f = m ? { A: g(m[1]), B: g(m[2]), C: g(m[3]), D: g(m[4]), E: Number(m[5]) / 100 } : null;
    // [2026.10.20 서식 연결] 엔진 감면 줄의 표시 필드(감면대상소득금액·감면율 숫자)가 있으면 B·E는 그 숫자를 씀(글 읽기는 예전 저장 결과용)
    if (note && typeof note.감면대상소득금액 === 'number' && typeof note.감면율 === 'number') { f = f || {}; f.B = note.감면대상소득금액; f.E = note.감면율; }
    return f;
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
  // 면적 → '3,300m²'(서식에 단위가 인쇄되지 않은 칸)
  function areaText(v) { var x = n(v); var t = String(Math.round(x * 1000) / 1000).split('.'); return t[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (t[1] ? '.' + t[1] : '') + 'm²'; } // 글꼴(나눔고딕)에 ㎡ 글자가 없어 m²로
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
    if (n(a.assetArea)) o.set('⑫', areaText(a.assetArea)); else o.miss('⑫ 면적', '화면 입력 없음(자산 카드 면적)');
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
  //                   §97 단서 100%·§97의2 100%도 세액감면(2026.10.20 엔진 고침 — 법은 "면제", 소득세법 §90①). 아래 excl 갈래는 옛 엔진 결과용
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
    // [2026.10.20 서식 감사(양도)] ⑭는 엔진 pensionCreditBase_와 같은 취득가액(엔진이 정한 값 — 환산·감정·매매사례면 그 값, 84호 부표1 ⑫와 같은
    //  엔진 입력값)으로. 예전엔 화면 취득가액을 그대로 빼 환산 사건이면 ⑭·⑮가 엔진과 달랐다(시행령 §40의2②1호 라목 "양도가액 − 취득가액")
    var diff = Math.max(0, n(a.transferPrice) - acqOf(p.it, a));
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

  // ───────── 조특 별지 제13호서식(현물출자 등에 대한 세액감면(면제)신청서) — 자경농지·축사·어업·자경산지·농지대토·수용·대토보상·국가양도산지·공공매입임대 공용 ─────────
  //  예전 인쇄(trSect13ReductionPrintPageHtml_ SECT13_MAP_)의 조건 + 공공매입임대주택 건설용 토지(§97의10 — 엔진이 계산하는데 예전 인쇄엔 빠졌던 것, 서식 구분·근거조항에 있음).
  //  ⑧ = 작성방법 1 "감면종합한도(§133)를 적용한 후의 순수 감면액" = 엔진 자산별 감면액(한도로 깎인 뒤).
  //  kind: [구분 보기, 근거조항 보기, 엔진 감면 줄 이름]
  var S13 = [
    { test: function (a) { return a.compensationType === 'land_replacement'; }, 구분: '대토보상', 조항: '제73조제6항', re: /^수용감면/ },
    { test: function (a) { return COMP_CASH.indexOf(a.compensationType) >= 0 && a.compensationTransferMode === 'expropriation'; }, 구분: '공익사업용 토지', 조항: '제72조제8항', re: /^수용감면/ },
    { test: function (a) { return !!a.isEightYearFarmland; }, 구분: '8년 자경농지', 조항: '제66조제9항', re: /^8년자경농지감면/ },
    { test: function (a) { return !!a.isLivestockLandExempt; }, 구분: '8년 축사용지', 조항: '제66조의2제12항', re: /^축사용지감면/ },
    { test: function (a) { return !!a.isFisheryLandExempt; }, 구분: '8년 자영어업용지', 조항: '제66조의3제9항', re: /^어업용토지감면/ },
    { test: function (a) { return !!a.isForestManagementExempt; }, 구분: '10년이상 자경산지', 조항: '제66조의4제9항', re: /^자경산지감면/ },
    { test: function (a) { return !!a.isFarmlandSubstitutionExempt; }, 구분: '농지대토', 조항: '제67조제9항', re: /^농지대토감면/ },
    { test: function (a) { return !!a.isNationalForestLandReduction; }, 구분: '국가에 양도하는 산지', 조항: '제79조의11', re: /^국가양도산지 감면/ },
    { test: function (a) { return !!a.isPublicRentalHousingLand; }, 구분: '공공매입임대주택 건설사업자에게 양도하는 토지', 조항: '제97조의10제3항', re: /^공공매입임대주택/ }
  ];
  function s13Of(a) { return S13.filter(function (k) { return k.test(a); }); }
  mappers['조특13호'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, p = pick(ctx), a = p.a, kinds = s13Of(a);
    var k = kinds[0];
    if (kinds.length > 1) o.note('한 자산에 감면이 ' + kinds.length + '가지(' + kinds.map(function (x) { return x.구분; }).join('·') + ') — 조특법 §127⑦은 하나만 적용, 첫 번째(' + k.구분 + ')로 찍음');
    if (k) o.set('구분', k.구분).set('근거조항', k.조항); else o.miss('구분·근거조항', '자산 카드에 이 서식의 감면 표시가 없음');
    o.miss('① 상호 또는 법인명·② 사업자등록번호', '계산기에 없음 — 개인 양도인(양도인 카드에 상호·사업자등록번호 칸 없음)');
    o.need('③', s.name, '③ 대표자 성명');
    var b = birthOf(s.regNo); if (b) o.set('④', b); else o.miss('④ 생년월일', '주민등록번호가 13자리가 아니라 못 셈');
    o.need('⑤@주소', H.fullAddr(s), '⑤ 주소').need('⑤@전화번호', s.phone, '⑤ 전화번호');
    var y = String(a.transferDate || '').slice(0, 4);
    if (/^\d{4}$/.test(y)) { o.set('⑥@부터.연', y).set('⑥@부터.월', '1').set('⑥@부터.일', '1').set('⑥@까지.연', y).set('⑥@까지.월', '12').set('⑥@까지.일', '31'); o.note('⑥ 과세연도 = 양도일이 속하는 해 1.1.~12.31.(소득세법 §5 과세기간)'); }
    else o.miss('⑥ 과세연도', '양도일 없음');
    o.miss('⑦ 법인세', '개인 양도소득세 신청 — 법인세 없음');
    var notes = notesOf(ctx, p.i), red = k ? redNotes(notes, k.re)[0] : null;
    if (!k) o.miss('⑧ 양도소득세', '감면 종류 없음');
    else if (!notes) o.miss('⑧ 양도소득세', '자산 목록과 엔진 거래 수가 달라(환지 증가분 등) 자산별 감면세액을 고를 수 없음');
    else if (!red) o.miss('⑧ 양도소득세', '엔진에 이 자산의 ' + k.구분 + ' 감면 줄 없음(요건 미충족·단기양도·적용기한 등)');
    else { o.set('⑧', n(red.감면액)); checkRed(o, '⑧', red); if (/자경산지/.test(red.특례)) o.note('자경산지 감면율: ' + red.특례); }
    signs(o, ctx, { sign: '신청인서명', office: '세무서' });
    o.miss('양수인 서명란', '현물출자 등 양수인이 함께 신청하는 감면이 아니면 비움 — 계산기에 양수인 서명 필요 여부 없음');
    return o.result();
  };

  // ───────── 조특 별지 제14호서식(개발제한구역 지정에 따른 매수대상 토지 등 세액감면신청서) — 조특법 §77의3, 시행령 §74③ ─────────
  //  예전 인쇄(trRestrictedZonePrintPageHtml_)와 같게 자산 카드 보상 방식이 개발제한구역(restricted_zone_40·25)인 자산마다 한 장.
  //  ⑧ = 엔진 자산별 감면액(감면율 ①1호 40%·①2호 25%, §90①, §133② 한도 뒤). 엔진 감면 줄 이름은 '수용감면(안분)'(§77·§77의2·§77의3 같은 묶음).
  var RZ = ['restricted_zone_40', 'restricted_zone_25'];
  mappers['조특14호'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, p = pick(ctx), a = p.a;
    o.need('①', s.name, '① 성명');
    var b = birthOf(s.regNo); if (b) o.set('②', b); else o.miss('② 생년월일', '주민등록번호가 13자리가 아니라 못 셈');
    o.need('③', H.fullAddr(s), '③ 주소').need('④', a.assetLocation, '④ 소재지');
    if (n(a.assetArea)) o.set('⑤', areaText(a.assetArea)); else o.miss('⑤ 면적', '화면 입력 없음(자산 카드 면적)');
    o.miss('⑥ 매수청구일 또는 협의매수일', '계산기에 없음 — 매수청구일·협의매수일 입력 칸 없음(양도일 ' + (a.transferDate || '') + '과 다른 날일 수 있어 안 찍음, 예전 인쇄는 양도일을 찍었음)');
    o.miss('⑦ 거주기간', '계산기에 없음 — 거주 요건(시행령 §74①·④) 입력 없음');
    var notes = notesOf(ctx, p.i), red = redNotes(notes, /^수용감면/)[0];
    if (RZ.indexOf(a.compensationType) < 0) o.miss('⑧ 감면받을 세액', '자산 카드 보상 방식이 개발제한구역이 아님');
    else if (!notes) o.miss('⑧ 감면받을 세액', '자산 목록과 엔진 거래 수가 달라(환지 증가분 등) 자산별 감면세액을 고를 수 없음');
    else if (!red) o.miss('⑧ 감면받을 세액', '엔진에 이 자산의 감면 줄 없음(적용기한 2028.12.31. 지남·단기양도 등)');
    else {
      o.set('⑧', n(red.감면액)); var f = checkRed(o, '⑧', red);
      if (f) o.note('감면율 ' + Math.round(f.E * 100) + '% — ' + (a.compensationType === 'restricted_zone_40' ? '§77의3①1호(지정일 전 취득·매수청구일까지 해당 토지 소재지 거주)' : '§77의3①2호(매수청구일부터 20년 이전 취득·거주)'));
    }
    signs(o, ctx, { sign: '신청인서명', office: '세무서' });
    return o.result();
  };

  // ───────── 조특 별지 제37호서식(구조조정대상부동산등세액감면신청서) — 구조조정대상부동산(법 §43, 영 §40②)·신축주택(법 §99, 영 §99④ / §99의3, 영 §99의3⑥ 준용) ─────────
  //  예전 인쇄(trRestructuringPropertyPrintPageHtml_)와 같은 조건. 작성요령: ⑦ = 소득세법 §95① 양도소득금액, ⑧~⑩은 취득 5년 뒤 양도만,
  //  ⑪ = 5년 이내 양도면 ⑦, 5년 뒤면 ⑦ × (⑩ − ⑨) ÷ (⑧ − ⑨), ⑫ = 구조조정 50%·신축주택 100%, ⑬ = ⑪ × ⑫, ⑭ = ⑬ × 세율(2000년판 서식).
  //  엔진: 5년 뒤(신축은 5년 이내도) — 장기보유특별공제 전 양도차익에서 "양도차익 × 기준시가 비율 × 감면율"(제외소득금액)을 빼고 장특공을 적용.
  //   장특공이 양도차익에 비례하므로 소득에서 빠지는 몫 = 제외소득금액 × (1 − 장특공율) = 서식 ⑬ — 이것으로 검산한다. 감면세액(⑭)은 엔진에 없다.
  //  구조조정 5년 이내(1999년까지 취득이라 지금은 거의 없음)는 세액감면(§90①) — 엔진 자산별 감면액이 ⑭.
  function rpKind(a) {
    if (a.isRestructuringPropertyReduction) return { 구조조정: true, 조항: '제40조제2항', rate: 0.5, std: ['rpTransferStandardPrice', 'rpAcquisitionStandardPrice', 'rpFiveYearStandardPrice'], note: '구조조정대상부동산감면(조특법§43)', law: '조특법 §43' };
    if (a.newHouseReductionProvision === 'sect99' || a.newHouseReductionProvision === 'sect99_3')
      return { 구조조정: false, 조항: '제99조제4항', rate: 1, std: ['nhTransferStandardPrice', 'nhAcquisitionStandardPrice', 'nhFiveYearStandardPrice'], note: '신축주택등감면(조특법§99계열)', law: a.newHouseReductionProvision === 'sect99' ? '조특법 §99' : '조특법 §99의3(영 §99의3⑥이 §99④ 준용)' };
    return null;
  }
  mappers['조특37호'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, p = pick(ctx), a = p.a, k = rpKind(a);
    o.miss('① 상호 또는 법인명·② 사업자등록번호', '계산기에 없음 — 개인 양도인(상호·사업자등록번호 칸 없음)');
    o.need('③', s.name, '③ 대표자 성명').need('④', s.regNo, '④ 주민등록번호').need('⑤', H.fullAddr(s), '⑤ 주소');
    var y = String(a.transferDate || '').slice(0, 4);
    if (/^\d{4}$/.test(y)) o.set('⑥@부터.연', y).set('⑥@부터.월', '1').set('⑥@부터.일', '1').set('⑥@까지.연', y).set('⑥@까지.월', '12').set('⑥@까지.일', '31');
    else o.miss('⑥ 과세연도', '양도일 없음');
    if (!k) { o.miss('⑦~⑭·근거조항', '자산 카드에 구조조정대상부동산·신축주택(§99·§99의3) 감면 표시 없음'); signs(o, ctx, { sign: '신청인서명', office: '세무서' }); return o.result(); }
    o.set('근거조항', k.조항).note('적용 조문: ' + k.law);
    var ev = p.it.ev || H.evFromSingle(a, p.it.single);
    var five = (function () { var d = H.ymd(a.acquisitionDate); if (!d) return null; return (Number(d.y) + 5) + '-' + ('0' + d.m).slice(-2) + '-' + ('0' + d.d).slice(-2); })();
    var after5 = five && String(a.transferDate || '') > five;
    o.set('⑫', k.rate * 100);
    var notes = notesOf(ctx, p.i);
    if (!ev || !ev.ok) { o.miss('⑦⑪⑬⑭', '엔진 자산 값 없음(' + ((ev && ev.why) || '') + ')'); signs(o, ctx, { sign: '신청인서명', office: '세무서' }); return o.result(); }
    // ⑦ = 그 자산 §95① 양도소득금액(감면으로 빼기 전 — 84호 부표1 ⑱과 같은 엔진 단건 값)
    o.set('⑦', ev.income);
    o.check('⑦ = 양도차익 − 장기보유특별공제', ev.income, ev.taxable - ev.ltDeduction);
    var red = k.구조조정 ? redNotes(notes, /^구조조정대상 부동산 감면/)[0] : null;
    var excl = (notes || []).filter(function (x) { return x.구분 === k.note; })[0];
    if (red) { // 구조조정 5년 이내 — 세액감면
      o.set('⑪', ev.income).set('⑬', Math.round(ev.income * k.rate)).set('⑭', n(red.감면액));
      o.miss('⑧⑨⑩ 기준시가', '취득일부터 5년 이내 양도 — 작성요령 3에 따라 적지 않음');
      checkRed(o, '⑭', red);
      o.note('⑭: 법 §43①("양도소득세의 100분의 50에 상당하는 세액")·소득세법 §90①대로 엔진 감면액 — 서식(2000년판) 산식 "⑬ × 세율"과 다름(판단 대기)');
    } else if (excl && excl.적용여부 === true) {
      var sv = k.std.map(function (f) { return n(a[f]); }); // ⑧ 양도 당시, ⑨ 취득 당시, ⑩ 5년 되는 날
      var 제외 = n(excl.제외소득금액), 빠짐 = Math.round(제외 * (1 - n(ev.ltRate)));
      if (after5) {
        if (sv[0] && sv[1] && sv[2] && sv[0] !== sv[1]) {
          o.set('⑧', sv[0]).set('⑨', sv[1]).set('⑩', sv[2]);
          var v11 = Math.round(ev.income * (sv[2] - sv[1]) / (sv[0] - sv[1]));
          o.set('⑪', v11).set('⑬', Math.round(v11 * k.rate));
          o.check('⑬ = ⑪ × ⑫ = 엔진 제외소득금액 ' + 제외 + ' × (1 − 장기보유특별공제율 ' + n(ev.ltRate) + ')', Math.round(v11 * k.rate), 빠짐);
        } else {
          o.miss('⑧⑨⑩ 기준시가·⑪', '자산 카드에 기준시가 3개(양도·취득·5년 되는 날)가 다 있지 않음 — 엔진은 법령에 없는 근사(5년 시점 평가액·보유기간 비율)로 계산(시행령 §40①·§99① 산식 아님)');
          o.set('⑬', 빠짐).note('⑬: 엔진 제외소득금액 × (1 − 장기보유특별공제율) — 근사 계산 값');
        }
      } else {
        o.miss('⑧⑨⑩ 기준시가', '취득일부터 5년 이내 양도 — 작성요령 3에 따라 적지 않음');
        o.set('⑪', ev.income).set('⑬', Math.round(ev.income * k.rate));
        o.check('⑬ = ⑪ × ⑫ = 엔진 제외소득금액 × (1 − 장기보유특별공제율)', Math.round(ev.income * k.rate), 빠짐);
      }
      o.miss('⑭ 감면받을 세액', '엔진은 ⑬을 과세대상 소득에서 빼는 방식(법 §43①·§99① "과세대상 소득금액에서 뺀다")이라 감면세액 값이 없음 — 서식(2000년판)은 ⑬ × 세율(판단 대기)');
    } else if (!notes) o.miss('⑦~⑭', '자산 목록과 엔진 거래 수가 달라(환지 증가분 등) 자산별 감면 값을 고를 수 없음');
    else o.miss('⑪⑬⑭', '엔진에서 감면이 적용되지 않음' + (excl && excl.사유 ? '(' + String(excl.사유).slice(0, 80) + ')' : ''));
    signs(o, ctx, { sign: '신청인서명', office: '세무서' });
    return o.result();
  };

  // ───────── 조특 별지 제51호의3서식(경영회생 지원 농지 매매 양도소득세 환급신청서) — 조특법 §70의2, 시행령 §67의2① ─────────
  //  예전 인쇄(frPrintFormPageHtml_)와 같게 "경영회생 농지 환매 환급" 도구 결과(lastFarmlandRepurchaseResult_)가 환급 가능일 때 한 장.
  //  도구 입력은 둘뿐(임차기간 내 환매 체크·한국농어촌공사 양도 당시 납부한 양도소득세) — 줄별 소재지·면적·날짜는 계산기에 없다.
  //  ctx.frResult = 도구 결과 {환급가능여부, 환급대상세액}, 신청인은 양도 ctx의 양도인(seller — 양도인 카드 첫 사람).
  // 사건에 한 장 — 양도인이 여럿이면 첫 양도인(ctxFromApp.양도(0))의 묶음에만
  function firstSeller(ctx) {
    var items = (typeof lastTransferResults_ !== 'undefined' && lastTransferResults_ ? lastTransferResults_ : []).filter(function (it) { return it.result && !it.result.error; }); // eslint-disable-line no-undef
    return !items.length || !ctx.seller || items[0].seller === ctx.seller;
  }
  function frGlobal() { return typeof lastFarmlandRepurchaseResult_ !== 'undefined' ? lastFarmlandRepurchaseResult_ : null; } // eslint-disable-line no-undef
  mappers['조특51호의3'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {}, fr = ctx.frResult || {};
    o.need('①', s.name, '① 성명').need('②', s.regNo, '② 주민등록번호').need('③@주소', H.fullAddr(s), '③ 주소').need('③@전화번호', s.phone, '③ 전화번호');
    if (has(s.name)) o.note('신청인은 양도인 카드 값 — 한국농어촌공사에 양도한 농업인 본인인지 확인(법 §70의2⑤ 상속인 환매면 상속인이 신청, 서식엔 상속인 칸 없음)');
    o.miss('④⑤⑥⑦⑧ 신고내용 줄(소재지·면적·양도일·납부연월일·납부세액)·⑨⑩ 소계', '계산기에 없음 — 환급 도구는 납부세액 합계 하나만 받음(농지·농업시설물 구분 없음)');
    o.miss('⑫⑬⑭⑮ 환매 내용 줄(소재지·임차기간·환매면적·환급신청액)', '계산기에 없음 — 임차기간 내 환매 여부만 체크로 받음');
    if (fr.환급가능여부 && has(fr.환급대상세액)) {
      var t = n(fr.환급대상세액);
      o.set('⑪', t).set('⑯', t);
      o.note('⑪·⑯: 도구 입력 "한국농어촌공사 양도 당시 납부한 양도소득세"(환급대상액) — 일부만 환매했으면 ⑯은 환매한 농지등에 대해 납부한 세액(시행령 §67의2④), 그때 ⑪은 전체 납부세액으로 고칠 것');
    } else o.miss('⑪ 납부세액 합계·⑯ 환급신청액 합계', fr.환급가능여부 === false ? '환급 대상 아님(임차기간 내 환매 안 함)' : '환급 도구 결과 없음');
    signs(o, ctx, { sign: '신청인서명', agent: '세무대리인서명', mgmt: '세무대리인@관리번호', office: '세무서' });
    return o.result();
  };
  ctxFor['조특51호의3'] = function (extra) {
    var fr = frGlobal(); if (!fr || !fr.환급가능여부) return [];
    var base = sellerCtxs(extra)[0];
    if (!base) base = Object.assign({ seller: (typeof transferSellers !== 'undefined' && transferSellers && transferSellers[0]) || {}, taxAgent: H.agent() }, extra || {}); // eslint-disable-line no-undef
    return [Object.assign({}, base, { frResult: fr })];
  };
  ready['조특51호의3'] = function () { var fr = frGlobal(); return !!(fr && fr.환급가능여부); };

  // ───────── 어떤 자산에 어떤 신청서 — 예전 인쇄(trAttach1PrintPageHtml_ 뒤에 붙는 함수들)가 그 서식을 그리는 조건과 같게 ─────────
  //  조특54호는 넣지 않음 — 사업시행자 제출(시행령 §72④·⑦)
  var TESTS = {};
  function register(k, test) { TESTS[k] = test; ctxFor[k] = perAsset(test); ready[k] = readyOf(ctxFor[k]); }
  register('조특62호', function (a) { return !!a.longTermRentalHouseProvision; });
  register('조특63호의32', function (a) { return n(a.pensionAccountContribution) > 0; });
  register('조특13호', function (a) { return s13Of(a).length > 0; });
  register('조특14호', function (a) { return RZ.indexOf(a.compensationType) >= 0; });
  register('조특37호', function (a) { return !!rpKind(a); });

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만) — 감면 대상 자산마다 한 장 + 농지 환매 환급(도구 결과가 환급 가능이면)
  function plan(tax, ctx) {
    var L = [];
    if (tax !== '양도' || !ctx) return L;
    if (ctx.r) Object.keys(TESTS).forEach(function (k) {
      (ctx.assets || []).forEach(function (it, j) { if (TESTS[k](it.asset || {}, ctx, j)) L.push({ formKey: k, ctx: Object.assign({}, ctx, { 감면자산: j }) }); });
    });
    var fr = ctx.frResult || frGlobal();
    if (fr && fr.환급가능여부 && firstSeller(ctx)) L.push({ formKey: '조특51호의3', ctx: Object.assign({}, ctx, { frResult: fr }) });
    return L;
  }

  return { 묶음: '양도감면A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
