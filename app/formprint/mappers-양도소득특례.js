/*
 * NxFormPrint 묶음 파일 — 양도소득특례 (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 소득83호 · 소득83호의2 · 소득83호의3 · 소득83호의4 · 소득83호의5 · 소득83호의6 · 소득11호
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-양도소득특례.js → node tools/formprint-check-ext.js 양도소득특례
 *
 * ── 어떤 서식을 찍는지(예전 모양 인쇄와 같은 조건) ──
 *   1세대1주택 특례 신고서(83호·83호의2·83호의3·83호의4·83호의5):
 *     양도 자산의 asset.oneHouseSpecialCase.formNo — taxcalc.html "특정주택 제외 판정" 창의 provisionForms 표가 정함
 *       mg → 83호의4 / lr → 83호의2 / pr·ci·rp·iu·ip → 83호의5 / ef·rf → 83호 / mp(동거봉양 합가) → 83호의3
 *       (u9·pd → 조특 52호의3, rh → 조특 63호의4 는 다른 묶음; ch·tw·hr·ih·cb·mc 는 법정 신고서 없음)
 *     예전 인쇄 oneHouseSpecialCasePrintPageHtml_(asset). 83호의5는 조합원입주권 자체를 양도하는 자산(asset.isReconstructionRights,
 *     예전 인쇄 reconstructionRightsPrintPageHtml_)도 찍는다.
 *   83호의6: 양도인 카드 seller.isMultiHouseRentalExemption (예전 인쇄 trMultiHouseRentalExemptionPrintPageHtml_)
 *   11호   : 국외자산 카드 중 oaForeignTaxMethod === 'credit' 이고 oaForeignTaxPaid > 0 인 것(예전 인쇄 trOverseasForeignTaxCreditPrintPageHtml_)
 *            + 국외자산 계산 결과 lastOverseasTransferResult_
 *
 * ── ctx(ctxFromApp.양도(i)가 만든 것 + 이 묶음이 더하는 것) ──
 *   특례자산 : 1세대1주택 특례 신고서를 찍을 자산 번호(ctx.assets[특례자산]) — plan·ctxFor가 넣음. 없으면 그 서식에 맞는 첫 자산
 *   overseas : 국외자산 계산 결과(lastOverseasTransferResult_) / overseasAssets : 국외자산 카드 목록(transferAssets 중 isOverseasAsset)
 *   신고일 'YYYY-MM-DD'(선택)
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
  /* global lastTransferResults_, lastOverseasTransferResult_, transferAssets, transferSellers */

  var forms = {
    '소득83호': "소득세법 시행규칙 [별지 제83호서식]", // 농어촌주택 소유자 1세대 1주택 특례적용신고서
    '소득83호의2': "소득세법 시행규칙 [별지 제83호의2서식]", // 주택임대사업자의 거주주택 1세대 1주택 특례적용신고서
    '소득83호의3': "소득세법 시행규칙 [별지 제83호의3서식]", // 장기저당담보주택에 대한 특례적용신고서
    '소득83호의4': "소득세법 시행규칙 [별지 제83호의4서식]", // 상생임대주택에 대한 특례적용신고서
    '소득83호의5': "소득세법 시행규칙 [별지 제83호의5서식]", // 조합원입주권 또는 분양권 소유자 1세대 1주택 특례적용신고서
    '소득83호의6': "소득세법 시행규칙 [별지 제83호의6서식]", // 1세대 3주택 이상자의 장기임대주택 등 일반세율 적용신청서
    '소득11호': "소득세법 시행규칙 [별지 제11호서식]", // 외국납부세액공제 신청서(묶음: 부표1 국가별 외국납부세액공제 명세서·부표2 소득종류별 명세서·부표3 하이브리
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // ───────── 공용 ─────────
  // 1세대1주택 특례 신고서 — oneHouseSpecialCase.formNo 끝의 "[별지 제83호의4서식]"으로 서식을 고름
  var SPECIAL_KEYS = ['소득83호의4', '소득83호의2', '소득83호의5', '소득83호'];
  var SPECIAL_FORM = { '소득83호': '[별지 제83호서식]', '소득83호의2': '[별지 제83호의2서식]', '소득83호의3': '[별지 제83호의3서식]', '소득83호의4': '[별지 제83호의4서식]', '소득83호의5': '[별지 제83호의5서식]' };
  function specialOf(asset, formKey) {
    var c = asset && asset.oneHouseSpecialCase;
    return (c && String(c.formNo || '').indexOf(SPECIAL_FORM[formKey]) >= 0) ? c : null;
  }
  // 이 서식을 찍을 자산인가(83호의5는 조합원입주권 자체 양도도)
  function assetWants(asset, formKey) {
    if (!asset) return false;
    if (specialOf(asset, formKey)) return true;
    return formKey === '소득83호의5' && !!asset.isReconstructionRights;
  }
  function pickAsset(ctx, formKey) {
    var list = ctx.assets || [];
    if (has(ctx.특례자산) && list[ctx.특례자산]) return list[ctx.특례자산];
    for (var i = 0; i < list.length; i++) if (assetWants(list[i].asset, formKey)) return list[i];
    return null;
  }
  // 신고인(양도자) 인적사항 ①②③ — 양도인 카드(84호 ①과 같은 값)
  function person(o, s, k성명, k주민, k주소, k전화) {
    o.need(k성명, s.name, k성명 + ' 성명').need(k주민, s.regNo, k주민 + ' 주민등록번호').need(k주소, H.fullAddr(s), k주소 + ' 주소');
    if (k전화) o.need(k전화, s.phone, k전화.split('@')[0] + ' 전화번호');
  }
  // 신고일·서명·세무서·세무대리인(서식 아래쪽)
  function footer(o, ctx, s, opt) {
    opt = opt || {};
    var d = H.ymd(ctx.신고일);
    if (d) o.set('신고일.연', d.y).set('신고일.월', d.m).set('신고일.일', d.d); else o.miss('신고일', 'ctx.신고일 없음(계산기에 없음)');
    o.set(opt.signKey || '신고인서명', s.name);
    if (opt.office !== false) { if (has(s.taxOffice)) o.set('세무서', H.officeName(s.taxOffice)); else o.miss('세무서', '양도인 카드에 관할 세무서 없음'); }
    var ta = ctx.taxAgent || {};
    if (opt.agent !== false) {
      if (has(ta.name)) { o.set('세무대리인서명', ta.name); if (has(ta.mgmtNo)) o.set('세무대리인@관리번호', ta.mgmtNo); else o.miss('서명 세무대리인 관리번호', '화면 입력 없음'); }
      else o.miss('서명 세무대리인', '세무대리인 정보 없음(화면 세무대리인 칸이 비어 있음)');
    }
  }
  function dateKeys(o, base, v, label) {
    var d = H.ymd(v);
    if (d) o.set(base + '.연', d.y).set(base + '.월', d.m).set(base + '.일', d.d); else o.miss(label || base, '계산기에 없음');
  }

  // ═════════ 소득83호의4 — 상생임대주택에 대한 특례적용신고서(영 §155의3⑤) ═════════
  //  값 출처: 양도 자산(소재지·취득일·양도일) + 판정 창이 남긴 asset.oneHouseSpecialCase(mgContractDate, mgLeasePeriod '시작 ~ 끝')
  //  예전 인쇄(oneHouseSpecialCasePrintPageHtml_)도 이 두 값만 찍음. 직전임대차 시작·종료일·보증금·월세는 판정 창에서만 쓰고 저장되지 않는다.
  mappers['소득83호의4'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {};
    var it = pickAsset(ctx, '소득83호의4'), a = (it && it.asset) || {}, c = specialOf(a, '소득83호의4');
    if (!c) { o.miss('①~⑪ 전체', '상생임대주택 판정(특정주택 제외 판정 mg)을 적용한 양도 자산 없음'); return o.result(); }
    person(o, s, '①', '②', '③', '③@전화번호');
    o.need('④', a.assetLocation, '④ 소재지');
    o.need('⑤', a.acquisitionDate, '⑤ 취득일').need('⑥', a.transferDate, '⑥ 양도일');
    o.miss('⑦ 직전임대차계약체결일', '계산기에 없음(판정 창은 직전임대차 시작일·종료일만 받음, 체결일·취득 후 체결 여부 판정 없음)');
    dateKeys(o, '⑧', c.mgContractDate, '⑧ 상생임대차계약 체결일');
    o.miss('⑩ 직전 임대차계약(임차인·보증금·월세·임대기간)', '계산기에 없음(직전임대차 시작·종료일·보증금·월세는 판정 창에서만 쓰고 저장되지 않음, 임차인 성명·생년월일 입력 없음)');
    var per = String(c.mgLeasePeriod || '').split('~').map(function (x) { return x.trim(); });
    if (H.ymd(per[0])) o.set('⑪@개시일', [per[0]]); else o.miss('⑪ 개시일', '판정 창 상생임대차 시작일 없음');
    if (H.ymd(per[1])) o.set('⑪@종료일', [per[1]]); else o.miss('⑪ 종료일', '판정 창 상생임대차 종료일 없음');
    o.miss('⑪ 임차인 성명·생년월일·보증금·월세·기간', '계산기에 없음(상생임대차 보증금·월세는 판정 창에서만 쓰고 저장되지 않음, 임차인 입력 없음, 기간(개월 수)은 판정 안에서만 계산)');
    if (c.mgContractDate && (c.mgContractDate < '2021-12-20' || c.mgContractDate > '2026-12-31')) o.note('⑧ 체결일이 2021.12.20.~2026.12.31. 밖 — 영 §155의3①1호 체결기한 확인');
    if (c.안내) o.note('판정 안내: ' + c.안내);
    footer(o, ctx, s);
    return o.result();
  };


  // ═════════ 소득83호의2 — 주택임대사업자의 거주주택 1세대 1주택 특례적용신고서(영 §155⑳·㉔) ═════════
  //  값 출처: 양도 자산(거주주택 = 양도주택: 소재지·취득일·양도일·양도가액) + 판정 창(lr)이 남긴 oneHouseSpecialCase(특례 이름·안내뿐)
  //  거주기간 개월 수·장기임대주택 요건(마목 계산값)은 판정 창에서만 쓰고 저장되지 않는다. 장기임대주택 명세(⑬~㉗)·임대내역(㉘) 입력은 계산기에 없음.
  mappers['소득83호의2'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {};
    var it = pickAsset(ctx, '소득83호의2'), a = (it && it.asset) || {}, c = specialOf(a, '소득83호의2');
    if (!c) { o.miss('①~㉙ 전체', '거주주택 특례 판정(특정주택 제외 판정 lr)을 적용한 양도 자산 없음'); return o.result(); }
    person(o, s, '①', '②', '③', '③@전화번호');
    o.need('④', a.assetLocation, '④ 소재지');
    o.miss('⑤⑥ 주택·토지 면적', '계산기에 없음');
    o.need('⑦', a.acquisitionDate, '⑦ 취득일').need('⑧', a.transferDate, '⑧ 양도일');
    o.miss('⑨ 거주기간', '계산기에 없음(판정 창은 거주 개월 수만 받고 저장하지 않음 — 시작·끝 날짜 입력 없음)');
    var tp = n(a.transferPrice);
    if (tp) {
      o.set('⑩', tp);
      var sg = it && it.single;
      if (sg && sg.입력값 && has(sg.입력값.양도가액)) o.check('⑩ 양도가액 = 엔진 입력 양도가액(84호 부표1 ⑪)', tp, n(sg.입력값.양도가액));
    } else o.miss('⑩ 양도가액', '양도 자산에 양도가액 없음');
    // 판정 엔진(calculateRentalHousingResidenceExclusionJS)은 장기임대주택(또는 장기어린이집) 요건을 "충족"했을 때만 적용여부 true를 주고,
    //  그때만 판정 창이 이 자산에 oneHouseSpecialCase를 남긴다 → 이 신고서가 나오는 경우는 늘 ⑪(충족한 경우)
    o.set('⑪|충족', true);
    o.miss('⑫ 미충족한 경우', '계산기에 없음(임대기간요건 충족 전 양도 — 영 §155㉑ — 갈래가 판정 엔진에 없음)');
    o.miss('⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕ 장기임대주택(㉖)·장기어린이집(㉗) 명세', '계산기에 없음(소유자·소재지·취득일·면적·임대개시일·기준시가·등록일·호수 입력 없음 — 판정 창의 기준시가·임대 연수는 저장되지 않음)');
    o.miss('㉘ 임대내역', '계산기에 없음(임차인·보증금·월세·임대기간 입력 없음 — 판정 창의 임대료 증가율은 저장되지 않음)');
    o.miss('㉙ 직전거주주택보유명세', '계산기에 없음(판정 창은 "직전거주주택 양도 이력 있음" 체크만 받고 저장하지 않음, 소재지·양도일 입력 없음)');
    if (c.안내) o.note('판정 안내: ' + c.안내);
    footer(o, ctx, s);
    return o.result();
  };


  // ═════════ 소득83호의5 — 조합원입주권 또는 분양권 소유자 1세대 1주택 특례적용신고서(영 §156의2⑫·§156의3⑨) ═════════
  //  두 갈래(예전 인쇄와 같은 조건):
  //   가) 판정 창(ci·rp·iu·pr·ip)이 양도 주택에 남긴 oneHouseSpecialCase — ④ 양도주택 열 = 양도 자산, ⑤ 조합원입주권 / ⑥ 분양권 열 = 판정 창이 남긴 취득일·완성일
  //       판정 창이 남기는 값: acquisitionDate(ci 조합원입주권 취득일, pr 분양권 취득일, rp 대체주택 취득일), newHousingCompletionDate(pr만)
  //   나) 조합원입주권 자체(asset.isReconstructionRights)를 양도 — 예전 인쇄 reconstructionRightsPrintPageHtml_.
  //       준공 전이면 ⑤ 조합원입주권 열, 준공 후 신축주택(isCompletedNewHousing)이면 ④ 양도주택 열 + ⑬⑭⑮(서식상 ⑤ 열에만 있는 칸)는 ⑤ 열에
  var PROV_5 = [['1주택+1분양권 보유', 'pr', '분양권'], ['1주택+1조합원입주권 보유', 'ci', '조합원입주권'], ['재건축 등 사업기간 중 대체주택', 'rp', '조합원입주권'],
    ['상속받은 조합원입주권', 'iu', '조합원입주권'], ['상속받은 분양권', 'ip', '분양권']];
  function prov5(c) {
    var t = String((c && c.provisionLabel) || '');
    for (var i = 0; i < PROV_5.length; i++) if (t.indexOf(PROV_5[i][0]) === 0) return { code: PROV_5[i][1], col: PROV_5[i][2] };
    return null;
  }
  mappers['소득83호의5'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {};
    var it = pickAsset(ctx, '소득83호의5'), a = (it && it.asset) || {}, c = specialOf(a, '소득83호의5');
    if (!c && !a.isReconstructionRights) { o.miss('①~⑯ 전체', '조합원입주권·분양권 특례 판정(ci·rp·iu·pr·ip)을 적용했거나 조합원입주권을 양도하는 자산 없음'); return o.result(); }
    o.need('①', s.name, '① 성명').need('②', s.regNo, '② 주민등록번호').need('③', H.fullAddr(s), '③ 주소');
    var filled = {}; // 열마다 채운 칸
    function put(no, col, v, label) { if (has(v)) { o.set(no + '@' + col, v); filled[no + '@' + col] = 1; } else if (label) o.miss(no + ' ' + col + ' ' + label, '화면 입력 없음'); }
    var tp = n(a.transferPrice), sg = it && it.single;
    var houseCol = !c && a.isReconstructionRights && !a.isCompletedNewHousing ? '조합원입주권' : '양도주택';
    // 양도 자산 열
    put('⑦', houseCol, a.assetLocation, '소재지');
    put('⑩', houseCol, a.acquisitionDate, '취득일');
    put('⑪', houseCol, a.transferDate, '양도일');
    if (houseCol === '양도주택') {
      if (tp) { o.set('⑯@양도주택', tp); filled['⑯@양도주택'] = 1; if (sg && sg.입력값 && has(sg.입력값.양도가액)) o.check('⑯ 양도가액 = 엔진 입력 양도가액(84호 부표1 ⑪)', tp, n(sg.입력값.양도가액)); }
      else o.miss('⑯ 양도가액', '양도 자산에 양도가액 없음');
    } else o.miss('⑯ 양도가액', '조합원입주권 자체를 양도 — 서식 ⑯은 ④ 양도주택 열에만 적는 칸(⑤ 열은 음영)이라 비움(양도가액 ' + tp + '원은 84호 부표1에)');
    var pv = c ? prov5(c) : null;
    if (c) {
      if (!pv) o.note('판정 이름 "' + (c.provisionLabel || '') + '"을 알 수 없어 ⑤·⑥ 열을 정하지 못함');
      else {
        o.note('적용 특례: ' + c.provisionLabel);
        if (pv.code === 'ci' || pv.code === 'pr') put('⑩', pv.col, c.acquisitionDate, '취득일(판정 창)');
        if (pv.code === 'pr') put('⑮', '분양권', c.newHousingCompletionDate, '완성(예정)일(판정 창)');
        if (pv.code === 'rp' && c.acquisitionDate && c.acquisitionDate !== a.acquisitionDate) o.note('판정 창의 대체주택 취득일(' + c.acquisitionDate + ')과 양도 자산 취득일(' + a.acquisitionDate + ')이 다름 — 확인');
      }
      if (c.안내) o.note('판정 안내: ' + c.안내);
    } else {
      // 나) 조합원입주권(또는 준공 후 신축주택) 자체 양도 — 예전 인쇄가 찍던 값
      o.note(a.isCompletedNewHousing ? '주택구분: 신축주택(준공 후 양도) — ④ 양도주택 열' : '주택구분: 조합원입주권(준공 전 양도) — ⑤ 조합원입주권 열');
      put('⑫', houseCol, a.formerResidencePeriod, '');
      put('⑬', '조합원입주권', a.businessApprovalDate, '');
      put('⑭', '조합원입주권', a.managementDispositionDate, '');
      put('⑮', '조합원입주권', a.newHousingCompletionDate, '');
      if (a.isCompletedNewHousing) o.note('⑬⑭⑮(사업시행인가일·관리처분계획인가일·완성일)는 서식상 ⑤ 조합원입주권 열에만 있는 칸이라 그 열에 적음');
      o.note('판단 대기: 조합원입주권 자체 양도(법 §89①4호)는 영 §156의2⑫(③~⑪항 적용자)의 신고서 대상이 아닐 수 있음 — 예전 인쇄와 같게 찍음');
    }
    // 채우지 못한 칸 설명
    var rest = [];
    ['양도주택', '조합원입주권', '분양권'].forEach(function (col) {
      ['⑦', '⑩', '⑪', '⑫'].forEach(function (no) { if (!filled[no + '@' + col]) rest.push(no + ' ' + col); });
    });
    if (!filled['⑬@조합원입주권']) rest.push('⑬'); if (!filled['⑭@조합원입주권']) rest.push('⑭');
    if (!filled['⑮@조합원입주권']) rest.push('⑮ 조합원입주권'); if (!filled['⑮@분양권']) rest.push('⑮ 분양권');
    if (rest.length) o.miss(rest.join('·'), '계산기에 없음(판정 창·자산 카드에 그 열의 값 입력 없음 또는 저장 안 됨)');
    o.miss('⑧ 면적(토지·건물)', '계산기에 없음');
    o.miss('⑨ 소유자(성명·주민등록번호·소득자와 관계)', '계산기에 없음(열마다 소유자 입력 없음)');
    footer(o, ctx, s);
    return o.result();
  };


  // ═════════ 소득83호 — 농어촌주택 소유자 1세대 1주택 특례적용신고서(영 §155⑦·⑬) ═════════
  //  판정 창(ef 이농주택·rf 귀농주택)이 양도하는 일반주택에 남긴 oneHouseSpecialCase — ④ 일반주택 열 = 양도 자산, ⑤ 농어촌주택 열 = 판정 창 값
  //  판정 창이 남기는 값: houseType('이농주택'·'귀농주택' → ⑤ 체크), acquisitionDate(rf 귀농주택 취득일). 상속 농어촌주택(⑦1호) 판정 갈래는 계산기에 없음.
  mappers['소득83호'] = function (ctx) {
    var o = new Out(), s = ctx.seller || {};
    var it = pickAsset(ctx, '소득83호'), a = (it && it.asset) || {}, c = specialOf(a, '소득83호');
    if (!c) { o.miss('①~⑪ 전체', '이농주택·귀농주택 판정(특정주택 제외 판정 ef·rf)을 적용한 양도 자산 없음'); return o.result(); }
    o.need('①', s.name, '① 성명').need('②', s.regNo, '② 주민등록번호').need('③', H.fullAddr(s), '③ 주소');
    if (c.houseType === '이농주택' || c.houseType === '귀농주택' || c.houseType === '상속주택') o.set('⑤', c.houseType);
    else o.miss('⑤ 주택구분(상속·이농·귀농)', '판정 창이 주택구분을 남기지 않음("' + (c.provisionLabel || '') + '")');
    o.need('⑥@일반주택', a.assetLocation, '⑥ 일반주택 소재지');
    o.need('⑨@일반주택', a.acquisitionDate, '⑨ 일반주택 취득일');
    o.need('⑩@일반주택', a.transferDate, '⑩ 일반주택 양도일');
    if (c.houseType === '귀농주택' && has(c.acquisitionDate)) o.set('⑨@농어촌주택', c.acquisitionDate);
    else o.miss('⑨ 농어촌주택 취득일', c.houseType === '귀농주택' ? '판정 창에 귀농주택 취득일 없음' : '계산기에 없음(이농주택 판정 창은 취득일을 받지 않음)');
    o.miss('⑥ 농어촌주택 소재지', '계산기에 없음(판정 창은 "수도권 밖 읍·면 소재" 체크만 받음)');
    o.miss('⑦ 면적(토지·건물)', '계산기에 없음(귀농주택 대지 면적은 판정 창에서만 쓰고 저장되지 않음)');
    o.miss('⑧ 소유자(성명·주민등록번호·소득자와 관계)', '계산기에 없음');
    o.miss('⑩ 농어촌주택 양도일', '계산기에 없음(농어촌주택은 양도하지 않는 주택 — 양도했으면 그 자산 카드에)');
    o.miss('⑪ 거주기간', '계산기에 없음(이농주택 판정 창은 "취득 후 5년 이상 거주" 체크만 받고 날짜 입력 없음)');
    if (c.안내) o.note('판정 안내: ' + c.안내);
    footer(o, ctx, s);
    return o.result();
  };

  // ───────── 세액인쇄 화면용 ─────────
  function transferItems() {
    return (typeof lastTransferResults_ !== 'undefined' && lastTransferResults_ ? lastTransferResults_ : []).filter(function (it) { return it.result && !it.result.error; });
  }
  // 양도인마다·자산마다 그 서식에 해당하는 ctx 목록
  function specialCtxs(formKey, extra) {
    var out = [];
    transferItems().forEach(function (item, i) {
      if (!(item.assets || []).some(function (a) { return assetWants(a, formKey); })) return;
      var ctx = H.ctxFromApp.양도(i, extra);
      (ctx.assets || []).forEach(function (it, ai) { if (assetWants(it.asset, formKey)) out.push(Object.assign({}, ctx, { 특례자산: ai })); });
    });
    return out;
  }
  function specialReady(formKey) {
    return transferItems().some(function (item) { return (item.assets || []).some(function (a) { return assetWants(a, formKey); }); });
  }
  SPECIAL_KEYS.forEach(function (k) {
    ctxFor[k] = function (extra) { return specialCtxs(k, extra); };
    ready[k] = function () { return specialReady(k); };
  });

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    if (tax !== '양도' || !ctx) return L;
    SPECIAL_KEYS.forEach(function (k) {
      (ctx.assets || []).forEach(function (it, ai) { if (assetWants(it.asset, k)) L.push({ formKey: k, ctx: Object.assign({}, ctx, { 특례자산: ai }) }); });
    });
    return L;
  }

  return { 묶음: '양도소득특례', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
