/*
 * NxFormPrint.mappers — 계산 결과·화면 입력 → 법정서식 칸 값({키: 값}) 대응표 (작업자 파, 2026-10-19)
 *
 * 칸 번호는 칸 해설(reftables/서식_*.json)의 칸 그대로, 값 출처는 칸 해설의 "계산기칸"과
 * 지금 세액인쇄 함수(taxcalc.html trPrintFormPageHtml_·trAttach1PrintPageHtml_·gfPrintFormPageHtml_·
 * ihPrintFormBodyHtml_·ihAttachPrintPagesHtml_)와 전자신고 레코드 함수가 쓰는 값과 같게 했다.
 * 대응이 확실치 않은 칸은 비워 두고 missing에 이유를 남긴다(추측으로 채우지 않음).
 *
 * 함수 모양: NxFormPrint.mappers['양도84호'](ctx) → { values, missing:[{칸, 이유}], notes:[…], checks:[{식, 서식값, 계산값, 맞음}] }
 *   checks = 서식에 적힌 산식(예: ⑱ = ⑩ − ⑪ …)대로 다시 더해 본 결과. 맞음=false면 서식 칸끼리 안 맞는 것(인쇄 전 확인).
 *
 * ── ctx(넘길 자료) ── 앱에서는 NxFormPrint.ctxFromApp.양도(i)/증여(i)/상속() 이 지금 화면에서 모아 줌.
 * 양도(양도84호·양도84부표1) — 같은 ctx 하나
 *   r          : calculateTransferTaxMultiJS 결과(lastTransferResults_[i].result) — 필수
 *   seller     : 양도인 {name, regNo, phone, address, taxOffice, isTransferorResident}
 *   buyers     : [{name, regNo, shareRatio('1/2'), relation, relationLabel}] (trCollectBuyers_ + trBuyerRelationLabel_)
 *   assets     : [{ asset: 자산 입력, single: calculateTransferTaxSingleJS 결과, ev: trAttach1EngineValues_(asset),
 *                   an: trAttach1AcqNec_(asset, ev), rateCode: trRateClassCode1_(asset), typeCode: trAssetTypeCode1_(asset),
 *                   transferCause: 계약의 양도원인(sale…) }]   — ev·an이 없으면 single로 같은 식을 다시 계산
 *   귀속연도   : '2025' (trLatestTransferDate_의 연도)
 *   splitAmt   : 분납신청금액(국세, 대표 양도인만 — 전자신고 trSplitAmt와 같은 식). 숫자가 아니면 ⑲⑳ 비움
 *   taxAgent   : {name, bizNo, mgmtNo, phone} (taxAgentField_)
 *   신고일     : 'YYYY-MM-DD'(선택) / 신고구분 : '예정신고'|'확정신고'|'수정신고'|'기한 후 신고'(선택 — 계산기에 없음)
 * 증여(증여10호)
 *   r, item:{amount, priorGiftAmount}, donee:{name, regNo, resident, email, phone, address, taxOffice},
 *   donor:{name, regNo, address, filingStatus}, relation('배우자'|'직계존속'|'직계비속'|'기타친족' — giftPairRelation_),
 *   giftDate, marriageBirth:{marriage, birth}(gfMarriageBirthSplit_), rate(ihRateForBase_ 0.2 또는 20),
 *   installment(연부연납대상금액), split(분납신청금액), taxAgent, 신고일, 신고구분(선택 — 없으면 filingStatus로)
 * 상속(상속9호·상속9호부표1·상속9호부표3) — 같은 ctx 하나
 *   r(lastInheritanceResult), fv(ihFormValues_(r)), reporter:{name, regNo, relation, address}, phone, email,
 *   deceased:{name, regNo, address, deathDate, resident('resident'|'nonresident'), taxOffice}, taxAgent, rate,
 *   forProfitBequest, forProfitExempted, bizDeferred, installment, split, 신고일, 신고구분(선택),
 *   부표1: assets:[{typeCode, basisCode, location, area, value}], valuationTotal, grossEstate, publicOrg, publicTrust, duesTotal, debtTotal
 *   부표3: debts:[{debtType, startDate, endDate, creditorName, creditorRegNo, creditorAddress, amount}],
 *          dues:[{duesType, year, quarter, amount}], funerals:[{category, payee, bizNo, detail, amount}],
 *          childCount, minorYears, elderlyCount, disabledYears, isNonResident
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    var NF = root.NxFormPrint = root.NxFormPrint || {};
    NF.mappers = Object.assign(NF.mappers || {}, api.mappers);
    NF.ctxFromApp = Object.assign(NF.ctxFromApp || {}, api.ctxFromApp);
    NF.FORMS_BY_TAX = api.FORMS_BY_TAX;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var FORMS_BY_TAX = { '양도': ['양도84호', '양도84부표1'], '증여': ['증여10호'], '상속': ['상속9호', '상속9호부표1', '상속9호부표3'] };

  // ───────── 공용 ─────────
  function n(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var x = Number(String(v == null ? '' : v).replace(/[,\s원]/g, ''));
    return isFinite(x) ? x : 0;
  }
  function has(v) { return v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !isFinite(v)); }
  function Out() { this.values = {}; this.missing = []; this.notes = []; this.checks = []; }
  Out.prototype.set = function (k, v) { if (has(v)) this.values[k] = v; return this; };
  // 화면 입력 칸(이름·주소 등): 비어 있으면 missing에 "입력 없음"
  Out.prototype.need = function (k, v, 칸) { if (has(v)) this.values[k] = v; else this.miss(칸 || k, '화면 입력 없음'); return this; };
  Out.prototype.miss = function (칸, 이유) { this.missing.push({ 칸: 칸, 이유: 이유 }); return this; };
  Out.prototype.note = function (t) { this.notes.push(t); return this; };
  Out.prototype.check = function (식, 서식값, 계산값) {
    this.checks.push({ 식: 식, 서식값: Math.round(서식값), 계산값: Math.round(계산값), 맞음: Math.round(서식값) === Math.round(계산값) });
    return this;
  };
  Out.prototype.result = function () { return { values: this.values, missing: this.missing, notes: this.notes, checks: this.checks }; };

  function ymd(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) } : null;
  }
  // 세무서 칸은 서식에 "세무서장 귀하"가 인쇄돼 있으므로 이름만(예: '서초세무서' → '서초')
  function officeName(t) { t = String(t || '').trim(); return t.replace(/\s*세무서(장)?(\s*귀하)?$/, ''); }
  function isMobile(p) { return /^\s*01[016789]/.test(String(p || '')); }
  function pct(rate) { var x = n(rate); if (!x) return null; return x <= 1 ? Math.round(x * 1000) / 10 : x; } // 0.2 → 20
  // 상속·증여 세율(5구간) — taxcalc.html IH_EFILE_RATE_BRACKETS_·ihRateForBase_와 같은 경계(이하)
  function giftInheritRate(base) {
    var b = Math.max(0, n(base));
    return b <= 1e8 ? 10 : b <= 5e8 ? 20 : b <= 1e9 ? 30 : b <= 3e9 ? 40 : 50;
  }

  // ───────── 양도: 엔진 값 다시 계산(앱에서는 ctx.assets[i].ev·an을 그대로 씀) ─────────
  // taxcalc.html trAttach1EngineValues_ 와 같은 식
  function evFromSingle(asset, r) {
    var tp = n(asset.transferPrice), ap = n(asset.acquisitionPrice), ne = n(asset.necessaryExpenses);
    var grossFallback = tp - ap - ne;
    if (r && r.비과세여부 && r.과세대상양도차익 === undefined)
      return { ok: true, gross: Math.round(grossFallback), nonTaxable: Math.round(Math.max(0, grossFallback)), taxable: 0, ltRate: 0, ltDeduction: 0, income: 0 };
    if (!r || r.error || r.과세대상양도차익 === undefined) return { ok: false, why: r && r.error ? r.error : '엔진 값 없음' };
    var gross = Math.round(n(r.양도차익)), taxable = Math.round(n(r.과세대상양도차익));
    return { ok: true, gross: gross, nonTaxable: Math.max(0, gross - taxable), taxable: taxable, ltRate: n(r.장기보유특별공제율),
      ltDeduction: Math.round(n(r.장기보유특별공제액)), income: Math.round(n(r.양도소득금액)),
      acq: n(r.입력값 && r.입력값.취득가액), nec: n(r.입력값 && r.입력값.필요경비), kind: acqKindCode(r.취득가액_산정방법) };
  }
  // taxcalc.html trAcqKindCode_
  function acqKindCode(note) { var s = String(note || ''); return /환산취득가액/.test(s) ? '04' : /매매사례가액/.test(s) ? '02' : /감정가액/.test(s) ? '03' : /기준시가로/.test(s) ? '05' : '01'; }
  var ACQ_KIND_LABEL = { '01': '실지거래가액', '02': '매매사례가액', '03': '감정가액', '04': '환산취득가액', '05': '기준시가' };
  // taxcalc.html trAttach1AcqNec_ + trExpenseSplit_(취득비용 코드 1xx = 취득 부대비용, 코드 없으면 116)
  function acqNec(asset, ev) {
    var acq0 = n(asset.acquisitionPrice), nec0 = n(asset.necessaryExpenses);
    if (!ev || !ev.ok) return { acq: acq0, nec: nec0, kind: '01' };
    if (ev.kind !== '01') return { acq: ev.acq, nec: ev.nec, kind: ev.kind };
    var incidental = 0;
    (Array.isArray(asset.acquisitionExpenseItems) ? asset.acquisitionExpenseItems : []).forEach(function (it) {
      var v = n(it.amount); if (!v) return;
      if (/^1/.test(String(it.expenseCode || '116'))) incidental += v;
    });
    var inc = Math.min(incidental, ev.nec);
    return { acq: ev.acq + inc, nec: ev.nec - inc, kind: '01' };
  }
  // 부표1 ④ 원인(작성방법 4: 매매·수용·협의매수·교환·공매·경매·부담부증여…) — 화면 양도원인 중 서식 낱말과 1:1인 것만
  var CAUSE_LABEL = { '': '매매', sale: '매매', exchange: '교환', burdened_gift: '부담부증여' };
  function ratioText(s) {
    var m = String(s == null ? '' : s).trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    return (m && Number(m[2])) ? m[1] + '/' + m[2] : '1/1'; // taxcalc.html trParseShareRatioParts_ 기본값 1/1(지금 인쇄와 같음)
  }

  var M = {};

  // ───────── 양도 별지 제84호서식 본표 ─────────
  M['양도84호'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, s = ctx.seller || {}, ta = ctx.taxAgent || {};
    var assets = ctx.assets || [];
    if (has(ctx.귀속연도)) o.set('귀속연도', String(ctx.귀속연도)); else o.miss('귀속연도', '양도일 없음');
    if (has(ctx.신고구분)) o.set('신고구분', ctx.신고구분);
    else o.miss('신고구분', '계산기에 신고구분 칸 없음(전자신고는 확정신고 01 고정) — ctx.신고구분으로 넘기면 찍음');
    // ① 신고인(양도인)
    o.need('①@성명', s.name, '① 성명').need('①@주민등록번호', s.regNo, '① 주민등록번호')
      .need('①@전화번호', s.phone, '① 전화번호').need('①@주소', s.address, '① 주소');
    o.set('①@거주구분', s.isTransferorResident === false ? '비거주자' : '거주자'); // 화면 기본값 = 거주자(vals.isTransferorResident !== false)
    o.miss('① 내ㆍ외국인·전자우편·거주지국(코드)·국적(코드)', '계산기에 입력 칸 없음(전자신고는 내국인 Y·KR 고정)');
    // ② 양수인 — 서식 칸은 한 줄
    var b = (ctx.buyers || [])[0];
    if (b) {
      o.need('②@성명', b.name, '② 양수인 성명').need('②@주민등록번호', b.regNo, '② 양수인 주민등록번호');
      o.set('②@지분', ratioText(b.shareRatio));
      o.need('②@관계', b.relationLabel || b.relation, '② 양도인과의 관계');
      if ((ctx.buyers || []).length > 1) o.note('양수인이 ' + ctx.buyers.length + '명 — 서식 ② 칸이 한 줄이라 첫 사람만 찍음(나머지는 별지 필요)');
    } else o.miss('② 양수인', '등록된 양수인 없음');
    var loc0 = assets[0] && assets[0].asset && assets[0].asset.assetLocation;
    o.need('②@양도자산소재지', loc0, '② 양도자산 소재지');
    if (assets.length > 1) o.note('자산이 ' + assets.length + '개 — ② 양도자산 소재지에는 첫 자산만 찍음');

    // ③ 세율구분 — 자산들의 세율 코드가 하나뿐일 때만 세율1 열을 씀(엔진이 세율별로 나눠 주지 않음)
    var codes = [];
    assets.forEach(function (a) { if (a.rateCode && codes.indexOf(a.rateCode) < 0) codes.push(a.rateCode); });
    var overseas = assets.some(function (a) { return a.asset && a.asset.isOverseasAsset; });
    var single = codes.length === 1 && !overseas;
    var cols = ['합계', '국내분소계'].concat(single ? ['세율1'] : []);
    if (single) { o.set('③@세율1.앞', '1').set('③@세율1.뒤', codes[0]); }
    else o.miss('③ 세율구분·세율별 열', codes.length ? '세율 코드가 ' + codes.length + '가지(' + codes.join('·') + ') — 엔진이 세율별 소득금액·세액을 나눠 주지 않아 합계·국내분소계만 찍음' : '세율 코드 없음');
    function put(no, v) { cols.forEach(function (c) { o.set(no + '@' + c, v); }); }

    var reduction = n(r.합산자경감면액) + n(r.합산수용감면액) + n(r.합산조특법세액감면액);
    var 가산신고 = n(r.무신고가산세) + n(r.과소신고가산세), 가산납부 = n(r.납부지연가산세), 가산기장 = n(r.환산취득가액가산세_합계);
    var payable = Math.max(0, n(r.납부세액_합계) - n(r.지방소득세)); // trPrintFormPageHtml_ nationalPayable
    var active = n(r.거래건수) - n(r.비과세건수);
    var poolAll = has(r.합산대상_장기거래건수) && n(r.합산대상_장기거래건수) === active;
    if (poolAll) { put('④', n(r.합산소득금액)); put('⑧', n(r.합산과세표준)); }
    else {
      o.miss('④ 양도소득금액', '단기·미등기 거래가 섞임 — 엔진 합산소득금액은 장기보유(합산그룹)만 담음');
      o.miss('⑧ 과세표준', '단기·미등기 거래가 섞임 — 엔진 합산과세표준은 장기보유(합산그룹)만 담음');
    }
    o.miss('⑤ 기신고ㆍ결정ㆍ경정된 양도소득금액', '계산기에 없음');
    o.miss('⑥ 소득감면대상 소득금액', '본표 합산 계산에 없음');
    put('⑦', n(r.기본공제));
    o.miss('⑨ 세율', '계산기에 숫자 세율 없음(적용세율_설명 글만)');
    put('⑩', n(r.산출세액_합계) + reduction); // 감면 전 금액(trRateDetailRecord_ 10번과 같은 식)
    put('⑪', reduction);
    o.miss('⑫ 외국납부세액공제', '부동산 본표 계산기에 없음(국외자산은 별도 계산)');
    o.miss('⑬ 원천징수세액공제', '계산기에 없음');
    put('⑭', n(r.연금계좌세액공제_합계));
    put('⑮', n(r.전자신고세액공제));
    put('⑯-무(과소)신고', 가산신고); put('⑯-납부지연', 가산납부); put('⑯-기장불성실 등', 가산기장);
    put('⑯-계', 가산신고 + 가산납부 + 가산기장);
    o.miss('⑰ 기신고ㆍ결정ㆍ경정세액, 조정공제', '부동산은 계산기에 없음');
    put('⑱', payable);
    if (typeof ctx.splitAmt === 'number' && isFinite(ctx.splitAmt)) { put('⑲', ctx.splitAmt); put('⑳', Math.max(0, payable - ctx.splitAmt)); }
    else o.miss('⑲ 분납할 세액·⑳ 납부세액', '분납 계산 자료(ctx.splitAmt) 없음');
    o.miss('㉑ 환급세액', '계산기에 없음');
    o.miss('㉒~㉚ 농어촌특별세', '계산기에 없음(엔진의 농어촌특별세는 취득세용)' + (reduction ? ' — 감면세액 ' + reduction + '원이 있어 농특세 대상일 수 있음' : ''));
    o.miss('㉛㉜ 환급금 계좌', '계산기에 없음');
    var d = ymd(ctx.신고일);
    if (d) o.set('신고일.연', d.y).set('신고일.월', d.m).set('신고일.일', d.d); else o.miss('신고일', 'ctx.신고일 없음');
    o.set('신고인서명', s.name);
    o.set('세무서', officeName(s.taxOffice));
    if (has(ta.name)) {
      o.set('세무대리인서명', ta.name).set('세무대리인@성명', ta.name).set('세무대리인@사업자등록번호', ta.bizNo)
        .set('세무대리인@관리번호', ta.mgmtNo).set('세무대리인@전화번호', ta.phone);
      o.miss('세무대리인 생년월일', '계산기에 없음');
    }
    // 검산: ⑱ = ⑩ − ⑪ − ⑫ − ⑬ − ⑭ − ⑮ + ⑯ − ⑰ (⑫⑬⑰은 0으로)
    o.check('⑱ = ⑩ − ⑪ − ⑭ − ⑮ + ⑯계 (⑫⑬⑰ 0)', payable,
      Math.max(0, n(r.산출세액_합계) + reduction - reduction - n(r.연금계좌세액공제_합계) - n(r.전자신고세액공제) + 가산신고 + 가산납부 + 가산기장));
    if (poolAll) o.check('⑧ = ④ − ⑦', n(r.합산과세표준), n(r.합산소득금액) - n(r.기본공제));
    return o.result();
  };

  // ───────── 양도 별지 제84호서식 부표1(양도소득금액 계산명세서) ─────────
  M['양도84부표1'] = function (ctx) {
    var o = new Out(), list = ctx.assets || [];
    var COLS = 3;
    if (list.length > COLS) o.note('자산이 ' + list.length + '개 — 부표1 한 장에 3개 열뿐이라 앞 3개만 찍음(나머지는 다음 장 필요, 아직 안 됨)');
    var sum = {};
    function add(k, v) { sum[k] = (sum[k] || 0) + v; }
    list.slice(0, COLS).forEach(function (it, i) {
      var a = it.asset || {}, col = '자산' + (i + 1), tag = '자산' + (i + 1) + ' ';
      var ev = it.ev || evFromSingle(a, it.single);
      var an = it.an || acqNec(a, ev);
      o.set('①@' + col + '.앞', a.isOverseasAsset ? '2' : '1');
      if (has(it.rateCode)) o.set('①@' + col + '.뒤', it.rateCode); else o.miss(tag + '① 세율구분 코드', 'ctx.assets[].rateCode 없음(trRateClassCode1_)');
      o.miss(tag + '② 소재지국·부동산고유번호', '계산기에 없음(고유번호 미수집)');
      o.need('②@' + col + '.소재지', a.assetLocation, tag + '② 소재지');
      if (has(it.typeCode)) o.set('③@' + col, it.typeCode); else o.miss(tag + '③ 자산종류 코드', 'ctx.assets[].typeCode 없음(trAssetTypeCode1_)');
      o.need('④@' + col + '.날짜', a.transferDate, tag + '④ 양도일');
      var cause = it.transferCause == null ? '' : it.transferCause;
      if (CAUSE_LABEL[cause]) o.set('④@' + col + '.원인', CAUSE_LABEL[cause]);
      else o.miss(tag + '④ 양도원인', '화면 양도원인 "' + cause + '"은 서식 낱말과 1:1이 아님(수용·협의매수, 공매·경매 구분 없음 등)');
      o.need('⑤@' + col + '.날짜', a.acquisitionDate, tag + '⑤ 취득일');
      o.miss(tag + '⑤ 취득원인', '계산기에 없음');
      o.miss(tag + '⑥⑦⑧ 면적·지분', '계산기에 없음(미수집)');
      o.miss(tag + '⑨⑩⑰ 보유·거주기간(1세대1주택)', '"○년 이상 ○년 미만" 칸 쓰는 법 확정 전 — 비워 둠');
      var tp = n(a.transferPrice);
      o.set('⑪@' + col, tp); add('⑪', tp);
      o.set('⑫@' + col, an.acq); add('⑫', an.acq);
      o.set('⑫@' + col + '.종류', ACQ_KIND_LABEL[an.kind] || '실지거래가액');
      o.miss(tag + '⑬ 기납부 토지초과이득세', '계산기에 없음');
      o.set('⑭@' + col, an.nec); add('⑭', an.nec);
      if (ev.ok) {
        o.set('(양도차익) 전체 양도차익@' + col, ev.gross); add('전체', ev.gross);
        o.set('(양도차익) 비과세 양도차익@' + col, ev.nonTaxable); add('비과세', ev.nonTaxable);
        o.set('⑮@' + col, ev.taxable); add('⑮', ev.taxable);
        o.set('⑯@' + col + '.금액', ev.ltDeduction); add('⑯', ev.ltDeduction);
        o.set('⑱@' + col, ev.income); add('⑱', ev.income);
        o.check(tag + '전체 양도차익 = ⑪ − ⑫ − ⑭ (⑬ 0)', ev.gross, tp - an.acq - an.nec);
        o.check(tag + '⑮ = 전체 − 비과세', ev.taxable, ev.gross - ev.nonTaxable);
        o.check(tag + '⑱ = ⑮ − ⑯', ev.income, ev.taxable - ev.ltDeduction);
      } else o.miss(tag + '양도차익·⑮·⑯·⑱', '엔진 값 없음(' + (ev.why || '') + ') — 참고치는 찍지 않음');
      o.miss(tag + '⑯ 장기보유특별공제 코드', '엔진에 공제 종류 코드(01~06) 없음 — 판정 규칙 확정 후 채움');
      o.miss(tag + '⑲⑳㉑ 감면소득금액·감면종류·감면율', '자산별 감면소득금액 키가 엔진에 없음');
      if (an.kind === '04' && n(a.transferStandardPriceForConversion) && n(a.acquisitionStandardPriceForConversion)) {
        o.set('양도시 기준시가 합계@' + col, n(a.transferStandardPriceForConversion)); add('양도기준', n(a.transferStandardPriceForConversion));
        o.set('취득시 기준시가 합계@' + col, n(a.acquisitionStandardPriceForConversion)); add('취득기준', n(a.acquisitionStandardPriceForConversion));
        o.miss(tag + '㉒~㉕ 건물·토지 기준시가', '화면은 건물·토지 합계 한 값만 받음 — 합계 줄에만 찍음');
      }
    });
    if (list.length) {
      o.set('⑪@합계', sum['⑪']).set('⑫@합계', sum['⑫']).set('⑭@합계', sum['⑭']);
      if (has(sum['전체'])) o.set('(양도차익) 전체 양도차익@합계', sum['전체']).set('(양도차익) 비과세 양도차익@합계', sum['비과세'])
        .set('⑮@합계', sum['⑮']).set('⑯@합계', sum['⑯']).set('⑱@합계', sum['⑱']);
      if (has(sum['양도기준'])) o.set('양도시 기준시가 합계@합계', sum['양도기준']).set('취득시 기준시가 합계@합계', sum['취득기준']);
    } else o.miss('부표1 전체', '자산 없음');
    return o.result();
  };

  // ───────── 증여 별지 제10호서식 본표 ─────────
  var FILING_LABEL = { ontime: '기한 내 신고', underreported: '수정신고', unreported: '기한 후 신고' };
  M['증여10호'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, dn = ctx.donee || {}, dr = ctx.donor || {}, ta = ctx.taxAgent || {}, it = ctx.item || {};
    var fs = has(ctx.신고구분) ? ctx.신고구분 : FILING_LABEL[dr.filingStatus || 'ontime'];
    if (fs) o.set('신고구분', fs); else o.miss('신고구분', '신고 상태 값 없음');
    if (!has(ctx.신고구분)) o.note('신고구분은 증여자 카드 신고 상태(ontime→기한 내, underreported→수정, unreported→기한 후)에서 옮김');
    o.need('①', dn.name, '① 수증자 성명').need('②', dn.regNo, '② 수증자 주민등록번호');
    o.set('③', dn.resident === 'nonresident' ? '비거주자' : '거주자');
    o.need('④', dn.address, '④ 수증자 주소');
    o.set('⑤', dn.email);
    if (has(dn.phone)) o.set(isMobile(dn.phone) ? '⑥~전화번호(휴대전화) (수증자)' : '⑥~전화번호(자택) (수증자)', dn.phone);
    else o.miss('⑥ 수증자 전화번호', '화면 입력 없음');
    o.miss('⑦ 증여자와의 관계', '계산기 값은 공제 구분(직계존속 등)이라 "증여자의 (  )"에 맞는 낱말(자·손자 등)이 아님');
    o.need('⑧', dr.name, '⑧ 증여자 성명').need('⑨', dr.regNo, '⑨ 증여자 주민등록번호');
    o.need('⑩', ctx.giftDate, '⑩ 증여일자').need('⑪', dr.address, '⑪ 증여자 주소');
    o.miss('⑫ 증여자 전화번호', '증여자 카드에 전화 입력 칸 없음');
    if (has(ta.name)) {
      o.set('⑬', ta.name).set('⑭', ta.bizNo).set('⑮', ta.mgmtNo);
      if (has(ta.phone)) o.set(isMobile(ta.phone) ? '⑯~전화번호(휴대전화) (세무대리인)' : '⑯~전화번호(사무실) (세무대리인)', ta.phone);
    }
    var giftAmount = has(it.amount) ? n(it.amount) : n(r.증여재산가액);
    var prior = n(it.priorGiftAmount);
    var taxable = n(r.순수증여재산가액) + prior;
    o.set('⑰', giftAmount).set('⑱', n(r.비과세재산가액)).set('⑲', n(r.공익법인출연재산가액)).set('⑳', n(r.공익신탁재산가액))
      .set('㉑', n(r.장애인신탁재산가액)).set('㉒', n(r.인수채무액)).set('㉓', prior).set('㉔', taxable);
    var REL = { '배우자': '㉕', '직계존속': '㉖', '직계비속': '㉗', '기타친족': '㉘' };
    var relCell = REL[ctx.relation];
    ['㉕', '㉖', '㉗', '㉘'].forEach(function (k) { o.set(k, k === relCell ? n(r.증여재산공제) : 0); });
    if (!relCell) { o.miss('㉕~㉘ 증여재산공제', '관계 값(ctx.relation)이 배우자·직계존속·직계비속·기타친족이 아님: ' + ctx.relation); ['㉕', '㉖', '㉗', '㉘'].forEach(function (k) { delete o.values[k]; }); }
    var mb = ctx.marriageBirth || { marriage: 0, birth: 0 };
    if (n(r.혼인출산증여재산공제) && !n(mb.marriage) && !n(mb.birth)) o.miss('㉙㉚ 혼인·출산 공제', '혼인·출산 나누기 자료(ctx.marriageBirth) 없음');
    else o.set('㉙', n(mb.marriage)).set('㉚', n(mb.birth));
    o.set('㉛', n(r.재해손실공제)).set('㉜', n(r.합산배제증여재산공제)).set('㉝', n(r.감정평가수수료공제)).set('㉞', n(r.과세표준));
    o.set('㉟', pct(ctx.rate) || giftInheritRate(r.과세표준));
    var pre = n(r.산출세액_할증전), gen = n(r.세대생략할증액);
    var etc = n(r.그밖의공제감면세액) + n(r.영농자녀증여농지세액감면);
    var credit = n(r.기납부세액공제) + n(r.외국납부세액공제) + n(r.신고세액공제) + etc;
    o.set('㊱', pre).set('㊲', gen).set('㊳', pre + gen).set('㊴', n(r.이자상당액)).set('㊵', n(r.박물관자료등징수유예세액))
      .set('㊶', credit).set('㊷', n(r.기납부세액공제)).set('㊸', n(r.외국납부세액공제)).set('㊹', n(r.신고세액공제)).set('㊺', etc)
      .set('㊻', n(r.가업승계납부유예세액)).set('㊼', n(r.무신고가산세) + n(r.과소신고가산세)).set('㊽', n(r.납부지연가산세))
      .set('㊾', n(r.공익법인등관련가산세)).set('㊿', n(r.납부세액));
    var inst = n(ctx.installment), split = n(ctx.split);
    if (inst) o.set('51~납부방법 — 연부연납 금액', inst);
    if (split) o.set('52~납부방법 — 분납 금액', split);
    o.set('53~납부방법 — 신고납부 금액', Math.max(0, n(r.납부세액) - inst - split)); // 전자신고 gfCashPaid
    o.miss('51·52·53 납부(신청)일', '계산기에 없음');
    var d = ymd(ctx.신고일);
    if (d) o.set('서명~신고일 — 년', d.y).set('서명~신고일 — 월', d.m).set('서명~신고일 — 일', d.d); else o.miss('신고일', 'ctx.신고일 없음');
    o.set('서명~신고인 성명(서명란)', dn.name);
    if (has(ta.name)) o.set('서명~세무대리인 성명(서명란)', ta.name);
    o.set('서명~관할 세무서 이름("세무서장" 앞)', officeName(dn.taxOffice));
    // 검산(서식 산식)
    o.check('㉔ = ⑰ − ⑱ − ⑲ − ⑳ − ㉑ − ㉒ + ㉓', taxable, giftAmount - n(r.비과세재산가액) - n(r.공익법인출연재산가액) - n(r.공익신탁재산가액) - n(r.장애인신탁재산가액) - n(r.인수채무액) + prior);
    o.check('㉞ = ㉔ − ㉕ … ㉝', n(r.과세표준), Math.max(0, taxable - n(r.증여재산공제) - n(mb.marriage) - n(mb.birth) - n(r.재해손실공제) - n(r.합산배제증여재산공제) - n(r.감정평가수수료공제)));
    if (has(r.산출세액_할증후)) o.check('㊳ = ㊱ + ㊲', n(r.산출세액_할증후), pre + gen);
    o.check('㊿ = ㊳ + ㊴ − ㊵ − ㊶ − ㊻ + ㊼ + ㊽ + ㊾', n(r.납부세액),
      Math.max(0, pre + gen + n(r.이자상당액) - n(r.박물관자료등징수유예세액) - credit - n(r.가업승계납부유예세액) + n(r.무신고가산세) + n(r.과소신고가산세) + n(r.납부지연가산세) + n(r.공익법인등관련가산세)));
    return o.result();
  };

  // ───────── 상속 별지 제9호서식 본표 ─────────
  function fvOf(ctx) {
    var r = ctx.r || {}, fv = ctx.fv || {};
    function pick(a, b) { return has(a) ? n(a) : n(b); }
    return {
      taxableEstate: has(fv.taxableEstate) ? n(fv.taxableEstate) : pick(r.상속세과세가액_서식, r.상속세과세가액_적용값),
      deductionTotal: has(fv.deductionTotal) ? n(fv.deductionTotal) : pick(r.상속공제_서식합계, r.상속공제_합계),
      appraisalFee: has(fv.appraisalFee) ? n(fv.appraisalFee) : n(r.감정평가수수료공제),
      limit: has(fv.limit) ? n(fv.limit) : (has(r.공제적용한도액) ? n(r.공제적용한도액) : null),
      basic: has(fv.basic) ? n(fv.basic) : 200000000,
      lumpSum: has(fv.lumpSum) ? n(fv.lumpSum) : null,
      priorGiftAdded: has(fv.priorGiftAdded) ? n(fv.priorGiftAdded) : null
    };
  }
  M['상속9호'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, rp = ctx.reporter || {}, dc = ctx.deceased || {}, ta = ctx.taxAgent || {};
    var fv = fvOf(ctx);
    if (has(ctx.신고구분)) o.set('신고구분', ctx.신고구분); else o.miss('신고구분', '계산기에 신고구분 칸 없음 — ctx.신고구분으로 넘기면 찍음');
    o.need('①', rp.name, '① 신고인 성명').need('②', rp.regNo, '② 신고인 주민등록번호').set('③', ctx.email)
      .need('④', rp.address, '④ 신고인 주소').need('⑤', rp.relation, '⑤ 피상속인과의 관계');
    if (has(ctx.phone)) o.set(isMobile(ctx.phone) ? '⑥~전화번호(휴대전화)' : '⑥~전화번호(자택)', ctx.phone); else o.miss('⑥ 전화번호', '화면 입력 없음');
    o.miss('⑦ 외국에 주소를 둔 상속인 여부', '계산기에 없음');
    o.need('⑧', dc.name, '⑧ 피상속인 성명').need('⑨', dc.regNo, '⑨ 피상속인 주민등록번호');
    o.set('⑩', dc.resident === 'nonresident' ? '비거주자' : '거주자');
    o.need('⑪', dc.address, '⑪ 피상속인 주소');
    o.miss('⑫ 상속원인', '계산기에 없음');
    o.need('⑬', dc.deathDate, '⑬ 상속개시일');
    if (has(ta.name)) {
      o.set('⑭~⑰~세무대리인 성명(⑭)', ta.name).set('⑭~⑰~세무대리인 사업자등록번호(⑮)', ta.bizNo).set('⑭~⑰~세무대리인 관리번호(⑯)', ta.mgmtNo);
      if (has(ta.phone)) o.set(isMobile(ta.phone) ? '⑭~⑰~세무대리인 전화번호(⑰ 휴대전화)' : '⑭~⑰~세무대리인 전화번호(⑰ 사무실)', ta.phone);
    }
    var base = n(r.과세표준), gen = n(r.세대생략가산액), calc = n(r.산출세액);
    var g28 = r.증여세액공제_5억이하배제 ? 0 : n(r.기납부증여세액공제), g305 = n(r.특례증여세액공제);
    var credit = g28 + g305 + n(r.외국납부세액공제) + n(r.단기재상속세액공제) + n(r.신고세액공제) + n(r.그밖의공제);
    o.set('⑱', fv.taxableEstate).set('⑲', fv.deductionTotal).set('⑳', fv.appraisalFee).set('㉑', base)
      .set('㉒', pct(ctx.rate) || giftInheritRate(base)).set('㉓', Math.max(0, calc - gen)).set('㉔', gen).set('㉕', calc)
      .set('㉖', n(r.이자상당액)).set('㉗', n(r.문화재등징수유예세액)).set('㉘', credit).set('㉙', g28 + g305).set('㉚', g28).set('㉛', g305)
      .set('㉜', n(r.외국납부세액공제)).set('㉝', n(r.단기재상속세액공제)).set('㉞', n(r.신고세액공제)).set('㉟', n(r.그밖의공제));
    o.set('(영리법인 면제) 유증 등 재산가액', n(ctx.forProfitBequest)).set('(영리법인 면제) 면제세액', n(ctx.forProfitExempted));
    var fp = n(r.영리법인면제분납부세액);
    var v37 = Math.max(0, calc + n(r.이자상당액) - n(r.문화재등징수유예세액) - credit + fp); // ㊲ = MAX(㉕+㉖−㉗−㉘+㊱, 0)
    var defer = has(r.가업상속납부유예세액) ? n(r.가업상속납부유예세액) : n(ctx.bizDeferred);
    var p1 = n(r.무신고가산세) + n(r.과소신고가산세), p2 = n(r.납부지연가산세);
    o.set('㊱', fp).set('㊲', v37).set('㊳', defer).set('㊴', p1).set('㊵', p2).set('㊶', n(r.납부세액));
    var inst = n(ctx.installment), split = n(ctx.split);
    if (inst) o.set('㊷~연부연납 (납부·신청 일자)', inst);
    if (split) o.set('㊹~분납 (현금)', split);
    o.set('㊺~신고납부 (현금)', Math.max(0, n(r.납부세액) - inst - split)); // 전자신고 ihCashPaid
    o.miss('㊸ 물납', '계산기에 없음');
    o.miss('㊷~㊺ 납부·신청 일자', '계산기에 없음');
    var d = ymd(ctx.신고일);
    if (d) o.set('신고일~신고일 — 연(년 앞)', d.y).set('신고일~신고일 — 월', d.m).set('신고일~신고일 — 일', d.d); else o.miss('신고일', 'ctx.신고일 없음');
    o.set('신고인(서명)', rp.name);
    if (has(ta.name)) o.set('세무대리인(서명)', ta.name);
    o.set('세무서장', officeName(dc.taxOffice));
    o.check('㉑ = ⑱ − ⑲ − ⑳', base, Math.max(0, fv.taxableEstate - fv.deductionTotal - fv.appraisalFee));
    o.check('㉕ = ㉓ + ㉔', calc, Math.max(0, calc - gen) + gen);
    o.check('㊶ = ㊲ − ㊳ + ㊴ + ㊵', n(r.납부세액), Math.max(0, v37 - defer + p1 + p2));
    return o.result();
  };

  // ───────── 상속 부표1(상속세과세가액계산명세서) ─────────
  M['상속9호부표1'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, fv = fvOf(ctx);
    var assets = ctx.assets || [], ROWS = 5;
    if (assets.length > ROWS) o.note('재산이 ' + assets.length + '건 — 부표1 "가" 표가 5줄이라 앞 5건만 찍음(나머지는 다음 장 필요, 아직 안 됨)');
    var rows = assets.slice(0, ROWS);
    o.miss('① 재산구분 코드', '계산기에 재산구분 칸 없음(전자신고는 A11 고정)');
    o.set('②', rows.map(function (a) { return a.typeCode || ''; }));
    if (rows.some(function (a) { return !has(a.typeCode); })) o.miss('② 재산종류 코드', '일부 재산의 코드 없음(ihAssetTypeCode_)');
    o.miss('③ 국외자산 여부·국가명', '계산기에 없음(전자신고는 N 고정)');
    o.set('③~소재지·법인명 등', rows.map(function (a) { return a.location || ''; }));
    o.miss('④ 사업자등록번호(계좌번호, 지분)', '계산기에 없음');
    o.set('⑤', rows.map(function (a) { return n(a.area) || ''; }));
    o.miss('⑥ 단가', '계산기에 없음');
    o.set('⑦', rows.map(function (a) { return Math.round(n(a.value)); }));
    o.set('⑧', rows.map(function (a) { return a.basisCode || ''; }));
    var valTotal = has(ctx.valuationTotal) ? n(ctx.valuationTotal) : assets.reduce(function (s, a) { return s + Math.round(n(a.value)); }, 0);
    o.set('⑨', Math.round(valTotal));
    var gross = has(ctx.grossEstate) ? n(ctx.grossEstate) : valTotal;
    var disp = n(r.상속개시전처분재산_추정합계), nonTax = n(r.비과세재산가액);
    var po = n(ctx.publicOrg), pt = n(ctx.publicTrust), dues = n(ctx.duesTotal), debt = n(ctx.debtTotal), fun = n(r.장례비용공제);
    o.set('⑩', gross).set('⑪', disp).set('⑫', gross + disp).set('⑬', nonTax).set('⑯', nonTax);
    o.miss('⑭⑮ 금양임야·공공단체 유증', '비과세는 한 칸으로만 받음 — 전액 ⑯ 기타로(전자신고와 같음)');
    o.set('⑰', po + pt).set('⑱', po).set('⑲', pt);
    o.miss('⑳ 과세가액 불산입 기타', '계산기에 없음');
    o.set('㉑', dues + fun + debt).set('㉒', dues).set('㉓', fun).set('㉔', debt);
    if (fv.priorGiftAdded !== null) o.set('㉕', fv.priorGiftAdded).set('㉖', fv.priorGiftAdded);
    else o.miss('㉕㉖ 가산하는 증여재산가액', '화면 "과세가액에 가산된 사전증여재산 원본액" 값(fv.priorGiftAdded) 없음');
    o.miss('㉗㉘ 조특법 §30의5·§30의6 가산액', '나눠 받는 칸 없음 — 전액 ㉖(§13)으로(전자신고와 같음)');
    o.set('㉙', fv.taxableEstate);
    o.check('⑨ = ⑦ 합', valTotal, rows.reduce(function (s, a) { return s + Math.round(n(a.value)); }, 0) + (assets.length > ROWS ? assets.slice(ROWS).reduce(function (s, a) { return s + Math.round(n(a.value)); }, 0) : 0));
    if (fv.priorGiftAdded !== null) o.check('㉙ = ⑫ − ⑬ − ⑰ − ㉑ + ㉕', fv.taxableEstate, gross + disp - nonTax - po - pt - (dues + fun + debt) + fv.priorGiftAdded);
    return o.result();
  };

  // ───────── 상속 부표3(채무·공과금·장례비용 및 상속공제명세서) ─────────
  M['상속9호부표3'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, fv = fvOf(ctx);
    var debts = (ctx.debts || []).filter(function (it) { return n(it.amount) > 0; });
    var dues = (ctx.dues || []).filter(function (it) { return n(it.amount) > 0; });
    var funs = (ctx.funerals || []).filter(function (it) { return n(it.amount) > 0; });
    if (debts.length > 4) o.note('채무 ' + debts.length + '건 — 4줄만 찍음(나머지는 다음 장 필요)');
    if (dues.length > 4) o.note('공과금 ' + dues.length + '건 — 4줄만 찍음');
    if (funs.length > 5) o.note('장례비용 ' + funs.length + '건 — 5줄만 찍음');
    var D = debts.slice(0, 4), U = dues.slice(0, 4), F = funs.slice(0, 5);
    o.set('①', D.map(function (it) { return it.debtType === 'other' ? '그 밖의 채무' : '금융기관 등 차입금'; })); // 지금 인쇄와 같은 글
    o.set('②~차입기간 — 발생 연월일', D.map(function (it) { return it.startDate || ''; }));
    o.set('②~차입기간 — 종료(예정) 연월일', D.map(function (it) { return it.endDate || ''; }));
    o.set('③', D.map(function (it) { return it.creditorName || ''; })).set('④', D.map(function (it) { return it.creditorRegNo || ''; }))
      .set('⑤', D.map(function (it) { return it.creditorAddress || ''; })).set('⑥', D.map(function (it) { return n(it.amount); }));
    var debtTotal = has(ctx.debtTotal) ? n(ctx.debtTotal) : debts.reduce(function (s, it) { return s + n(it.amount); }, 0);
    o.set('⑦', debtTotal);
    o.set('⑧', U.map(function (it) { return it.duesType === 'local' ? '02' : '01'; })); // 전자신고 공과금종류코드(01 국세, 02 지방세)
    o.set('⑨', U.map(function (it) { return it.year ? String(it.year) : ''; })).set('⑩', U.map(function (it) { return it.quarter ? String(it.quarter) : ''; }))
      .set('⑪', U.map(function (it) { return n(it.amount); }));
    var duesTotal = has(ctx.duesTotal) ? n(ctx.duesTotal) : dues.reduce(function (s, it) { return s + n(it.amount); }, 0);
    o.set('⑫', duesTotal);
    o.set('⑬', F.map(function (it) { return it.bizNo || ''; })).set('⑭', F.map(function (it) { return it.payee || ''; }))
      .set('⑮', F.map(function (it) { return (it.category === 'niche' ? '봉안시설·자연장지' : '일반장례') + (it.detail ? ' ' + it.detail : ''); }))
      .set('⑯', F.map(function (it) { return n(it.amount); }));
    o.set('⑰', n(r.장례비용공제)); // 공제 인정액(지금 인쇄·전자신고와 같음 — 실제 지출 합계와 다를 수 있음)
    var nr = !!ctx.isNonResident;
    var lump = fv.lumpSum !== null ? fv.lumpSum : null;
    o.set('⑱', fv.basic)
      .set('⑲', nr ? 0 : n(ctx.childCount) * 50000000).set('⑳', nr ? 0 : n(ctx.minorYears) * 10000000)
      .set('㉑', nr ? 0 : n(ctx.elderlyCount) * 50000000).set('㉒', nr ? 0 : n(ctx.disabledYears) * 10000000);
    if (lump !== null) o.set('㉓', lump); else o.miss('㉓ 일괄공제', 'fv.lumpSum 없음(ihFormValues_)');
    o.note('⑱~㉒(기초·인적공제)와 ㉓ 일괄공제를 함께 적음 — 지금 인쇄·전자신고와 같음(㉛은 엔진 한도 적용 합계)');
    var biz = n(r.가업상속공제), farm = n(r.영농상속공제), sp = n(r.배우자공제), fin = n(r.금융재산상속공제), dis = n(r.재해손실공제), co = n(r.동거주택상속공제);
    o.set('㉔', biz).set('㉕', farm).set('㉖', sp).set('㉗', fin).set('㉘', dis).set('㉙', co);
    var limit = fv.limit !== null ? fv.limit : Math.max(0, n(r.상속세과세가액_적용값) - biz - farm - sp - fin - dis - co);
    o.set('㉚', limit).set('㉛', fv.deductionTotal);
    if (fv.limit === null) o.note('㉚은 엔진 공제적용한도액이 없어 지금 인쇄의 옛 식(과세가액 − 다른 공제들)으로 찍음');
    return o.result();
  };

  // ───────── 앱 화면에서 ctx 모으기(브라우저, taxcalc 화면이 열린 같은 페이지에서만) ─────────
  // 지금 세액인쇄 함수들이 읽는 같은 전역값·화면 칸을 읽기만 한다(아무것도 바꾸지 않음).
  /* global lastTransferResults_, trCollectBuyers_, trLatestTransferDate_, trBuyerRelationLabel_, trAttach1EngineValues_, trAttach1AcqNec_,
     trRateClassCode1_, trAssetTypeCode1_, transferContracts, lastTrSplitPaymentInput_, lastTrSplitPaymentResult_, taxAgentField_, numVal,
     lastGiftResults_, giftDonees, giftDonors, giftPairRelation_, gfMarriageBirthSplit_, ihRateForBase_, lastInstallmentInput_, lastInstallmentResult_,
     lastSplitPaymentInput_, lastSplitPaymentResult_, lastInheritanceResult, inheritanceHeirs, ihFormValues_, inheritanceValuationAssets_,
     ihAssetTypeCode_, ihAssetValuationBasisCode_, computeValuationAssetValue, ihGrossEstateTotal_, ihValuationAssetsGrossTotal_,
     computeDuesTotal_, computeDebtTotal_, inheritanceDuesItems, inheritanceDebtItems, inheritanceFuneralItems */
  function el(id) { var e = typeof document !== 'undefined' && document.getElementById(id); return e ? e.value : ''; }
  function agent() {
    var f = typeof taxAgentField_ === 'function' ? taxAgentField_ : function () { return ''; };
    return { name: f('taxAgentName'), bizNo: f('taxAgentBizNo'), mgmtNo: f('taxAgentMgmtNo'), phone: f('taxAgentPhone') };
  }
  var ctxFromApp = {
    // i = 양도인 번호(lastTransferResults_ 중 계산 성공한 것의 순서)
    '양도': function (i, extra) {
      i = i || 0;
      var items = (typeof lastTransferResults_ !== 'undefined' && lastTransferResults_ ? lastTransferResults_ : []).filter(function (it) { return it.result && !it.result.error; });
      var item = items[i];
      if (!item) throw new Error('양도세 계산 결과가 없습니다 — 먼저 계산하세요.');
      var buyers = (typeof trCollectBuyers_ === 'function' ? trCollectBuyers_() : []).map(function (b) {
        return { name: b.name, regNo: b.regNo, shareRatio: b.shareRatio, relation: b.relation, relationLabel: typeof trBuyerRelationLabel_ === 'function' ? trBuyerRelationLabel_(b.relation) : '' };
      });
      var assets = (item.assets || []).map(function (a) {
        var ev = trAttach1EngineValues_(a);
        var contract = a.transferContractId && typeof transferContracts !== 'undefined' ? transferContracts.find(function (c) { return c.id === a.transferContractId; }) : null;
        return { asset: a, ev: ev, an: trAttach1AcqNec_(a, ev), rateCode: trRateClassCode1_(a), typeCode: trAssetTypeCode1_(a),
          transferCause: contract ? (contract.transferCause || '') : null };
      });
      var latest = typeof trLatestTransferDate_ === 'function' ? trLatestTransferDate_() : '';
      // 전자신고 trBuildEfileBytes_ 의 trSplitAmt와 같은 식(대표 양도인만)
      var splitAmt = 0;
      if (i === 0 && typeof lastTrSplitPaymentInput_ !== 'undefined' && lastTrSplitPaymentInput_ && lastTrSplitPaymentInput_.taxType === 'transfer' &&
        typeof lastTrSplitPaymentResult_ !== 'undefined' && lastTrSplitPaymentResult_ && lastTrSplitPaymentResult_.분납가능여부)
        splitAmt = numVal(lastTrSplitPaymentResult_.분납신청금액 != null ? lastTrSplitPaymentResult_.분납신청금액 : lastTrSplitPaymentResult_.분납가능_최대금액) || 0;
      return Object.assign({ r: item.result, seller: item.seller || {}, buyers: buyers, assets: assets, 귀속연도: latest ? latest.slice(0, 4) : '',
        splitAmt: splitAmt, taxAgent: agent() }, extra || {});
    },
    // i = 증여 계산 결과(수증자·증여자 조합) 번호
    '증여': function (i, extra) {
      i = i || 0;
      var items = (typeof lastGiftResults_ !== 'undefined' && lastGiftResults_ ? lastGiftResults_ : []).filter(function (it) { return it.result && !it.result.error; });
      var item = items[i];
      if (!item) throw new Error('증여세 계산 결과가 없습니다 — 먼저 계산하세요.');
      var r = item.result || {};
      var donor = giftDonors[item.donorIdxs[0]] || {};
      var inst = (typeof lastInstallmentInput_ !== 'undefined' && lastInstallmentInput_ && lastInstallmentInput_.taxType === 'gift' && lastInstallmentResult_) ? (numVal(lastInstallmentResult_.연부연납대상금액) || 0) : 0;
      var split = (typeof lastSplitPaymentInput_ !== 'undefined' && lastSplitPaymentInput_ && lastSplitPaymentInput_.taxType === 'gift' && lastSplitPaymentResult_ && lastSplitPaymentResult_.분납가능여부) ? (numVal(lastSplitPaymentResult_.분납신청금액 != null ? lastSplitPaymentResult_.분납신청금액 : lastSplitPaymentResult_.분납가능_최대금액) || 0) : 0;
      return Object.assign({ r: r, item: { amount: item.amount, priorGiftAmount: item.priorGiftAmount }, donee: giftDonees[item.doneeIdx] || {}, donor: donor,
        relation: giftPairRelation_(donor, item.doneeIdx).relation, giftDate: el('giftDate'),
        marriageBirth: numVal(r.혼인출산증여재산공제) ? gfMarriageBirthSplit_(numVal(r.혼인출산증여재산공제) || 0) : { marriage: 0, birth: 0 },
        rate: ihRateForBase_(r.과세표준), installment: inst, split: split, taxAgent: agent() }, extra || {});
    },
    '상속': function (extra) {
      if (typeof lastInheritanceResult === 'undefined' || !lastInheritanceResult) throw new Error('상속세 계산 결과가 없습니다 — 먼저 계산하세요.');
      var r = lastInheritanceResult;
      var reporter = inheritanceHeirs.find(function (h) { return h.isReporter; }) || {};
      var gn = function (id) { return numVal(el(id)) || 0; };
      var assets = inheritanceValuationAssets_().map(function (a) {
        return { typeCode: ihAssetTypeCode_(a.method), basisCode: ihAssetValuationBasisCode_(a), location: a.assetLocation || '', area: numVal(a.assetArea) || 0, value: Math.round(computeValuationAssetValue(a)) };
      });
      var inst = (typeof lastInstallmentInput_ !== 'undefined' && lastInstallmentInput_ && lastInstallmentInput_.taxType === 'inheritance' && lastInstallmentResult_) ? (numVal(lastInstallmentResult_.연부연납대상금액) || 0) : 0;
      var split = (typeof lastSplitPaymentInput_ !== 'undefined' && lastSplitPaymentInput_ && lastSplitPaymentInput_.taxType === 'inheritance' && lastSplitPaymentResult_ && lastSplitPaymentResult_.분납가능여부) ? (numVal(lastSplitPaymentResult_.분납신청금액 != null ? lastSplitPaymentResult_.분납신청금액 : lastSplitPaymentResult_.분납가능_최대금액) || 0) : 0;
      var nonRes = el('ihDecedentResident') === 'nonresident';
      return Object.assign({ r: r, fv: ihFormValues_(r), reporter: reporter, phone: el('ihReporterPhone'), email: el('ihReporterEmail'),
        deceased: { name: el('ihDeceasedName'), regNo: el('ihDeceasedRegNo'), address: el('ihDeceasedAddress'), deathDate: el('ihDeathDate'), resident: nonRes ? 'nonresident' : 'resident', taxOffice: el('ihDeceasedTaxOffice') },
        taxAgent: agent(), rate: ihRateForBase_(r.과세표준), forProfitBequest: gn('ihForProfitBequest'), forProfitExempted: gn('ihForProfitExempted'), bizDeferred: gn('ihBizInheritDeferred'),
        installment: inst, split: split,
        assets: assets, valuationTotal: Math.round(ihValuationAssetsGrossTotal_()), grossEstate: ihGrossEstateTotal_(), publicOrg: gn('ihPublicOrg'), publicTrust: gn('ihPublicTrust'),
        duesTotal: computeDuesTotal_(inheritanceDuesItems), debtTotal: computeDebtTotal_(inheritanceDebtItems),
        debts: inheritanceDebtItems, dues: inheritanceDuesItems, funerals: inheritanceFuneralItems,
        childCount: gn('ihChildCount'), minorYears: gn('ihMinorYears'), elderlyCount: gn('ihElderlyCount'), disabledYears: gn('ihDisabledYears'), isNonResident: nonRes }, extra || {});
    }
  };

  return { mappers: M, ctxFromApp: ctxFromApp, FORMS_BY_TAX: FORMS_BY_TAX, _helpers: { evFromSingle: evFromSingle, acqNec: acqNec, giftInheritRate: giftInheritRate } };
});
