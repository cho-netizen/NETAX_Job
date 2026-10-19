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

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  //  조특54호는 넣지 않음 — 사업시행자 제출(시행령 §72④·⑦)
  function plan(tax, ctx) {
    var L = [];
    if (tax !== '양도' || !ctx || !ctx.r) return L;
    return L;
  }

  return { 묶음: '양도감면A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
