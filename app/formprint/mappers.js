/*
 * NxFormPrint.mappers — 계산 결과·화면 입력 → 법정서식 칸 값({키: 값}) 대응표 (작업자 파, 2026-10-19)
 *
 * 칸 번호는 칸 해설(reftables/서식_*.json)의 칸 그대로, 값 출처는 칸 해설의 "계산기칸"과
 * 지금 세액인쇄 함수(taxcalc.html trPrintFormPageHtml_·trAttach1PrintPageHtml_·gfPrintFormPageHtml_·
 * ihPrintFormBodyHtml_·ihAttachPrintPagesHtml_)와 전자신고 레코드 함수가 쓰는 값과 같게 했다.
 * 대응이 확실치 않은 칸은 비워 두고 missing에 이유를 남긴다(추측으로 채우지 않음).
 *
 * ── 기본값 6가지 — 세무사님 확인(2026-10-19, 원문 "6가지는 그대로 하라") ── 23장 모두 같은 기본값
 *   1. 금액 0도 "0"으로 찍음(비우려면 렌더 opts.zeroBlank)
 *   2. 전화번호 한 칸 → 01x로 시작하면 휴대전화 칸, 아니면 자택(세무대리인은 사무실) 칸
 *   3. 양수인 지분이 비면 "1/1"
 *   4. 증여 신고구분은 증여자 카드 신고 상태에서(양도·상속은 화면에서 고른 ctx.신고구분 —
 *      양도 '예정신고'/'확정신고'/'수정신고'/'기한 후 신고', 상속 '기한 내 신고'/'수정신고'/'기한 후 신고')
 *   5. 상속 부표3은 ⑱~㉒ 기초·인적공제와 ㉓ 일괄공제를 둘 다 적음
 *   6. 뒷면(작성방법) 쪽도 출력(렌더 opts.backPages 기본 true)
 *
 * ── 이어 찍기(작업자 거, formprint.js) ── 값을 자르지 않고 전부 넘긴다: 줄 칸은 배열을 길게, 열 칸은 키 숫자를 키움
 *   ('①@자산5.앞'). 넘는 만큼 모듈이 원래 쪽을 복사해 이어 찍고 합계·신고일·서명은 마지막 장에만 넣는다.
 *   (상속인별 부표2·자산별 양도 부표3처럼 "한 장 = 한 사람/한 자산"인 서식은 plan()이 장을 따로 만든다.)
 *
 * ── 어떤 서식을 찍을지 ── NxFormPrint.applicable(세목, ctx) → ['양도84호', …] (그 사건에 해당하는 서식만)
 *                        NxFormPrint.plan(세목, ctx) → renderWithMappers에 바로 넘길 목록(같은 서식 여러 장은 {formKey, ctx})
 *   FORMS_BY_TAX는 예전 기본 묶음(남겨 둠).
 *
 * 함수 모양: NxFormPrint.mappers['양도84호'](ctx) → { values, missing:[{칸, 이유}], notes:[…], checks:[{식, 서식값, 계산값, 맞음}] }
 *   checks = 서식에 적힌 산식(예: ⑱ = ⑩ − ⑪ …)대로 다시 더해 본 결과. 맞음=false면 서식 칸끼리 안 맞는 것(인쇄 전 확인).
 *
 * ── ctx(넘길 자료) ── 앱에서는 NxFormPrint.ctxFromApp.양도(i)/증여(i)/상속() 이 지금 화면에서 모아 줌.
 * 양도(양도84호·양도84부표1) — 같은 ctx 하나
 *   r          : calculateTransferTaxMultiJS 결과(lastTransferResults_[i].result) — 부동산 등이 있을 때(국외자산·주식등만 있으면 null)
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
 *
 * ── 부표 17장이 더 쓰는 ctx(작업자 하, 2026-10-19) ── ctxFromApp이 화면에서 읽어 채움
 * 양도  stock: lastStockTransferResult_ {input, result} (84호 주식등 한 장 — 갈래 '주식등', 부표2·부표1(신탁수익권)·부표2의2(파생상품)) / derivative: lastDerivativeResult_ (부표2의2)
 *       overseas: lastOverseasTransferResult_(calculateOverseasAssetTransferTaxMultiJS 결과) / overseasAssets: 국외자산 카드(transferAssets 중 isOverseasAsset —
 *                 transferDate·acquisitionDate·transferPrice·acquisitionPrice·oaCapitalExpenditure·oaTransferExpenses, 거래별_내역 idx와 같은 순서)
 *                 (84호 2-10 열·국외분 소계, 부표1 국외자산 열 — 대표 양도인만. 묶음 파일 소득11호도 같은 이름)
 *       assets[].asset.acquisitionExpenseItems·transferExpenseItems·depreciationDeductedAsBusinessExpense (부표3, ctx.부표3자산 = 자산 번호)
 *       seller.addressDong·addressHo(주소에 붙임), asset.isInheritedAsset·isGiftedAsset(부표1 ⑤ 취득원인)
 * 증여  giftAssets: [{method, typeCode, basisCode, location, area, unitPrice, value(배분 후), artwork:{code,artist,title,year,material,size}}] (부표1·5)
 *       bd: {totalAsset, nonBiz55, nonBiz49, nonBiz61, excessCash, nonBizStock, totalValue, businessValue, taxPayable, result} (부표2)
 *       mbDetail: {thisTime, cur:{marriage,birth}, prior, priorParts:{w9,w10,w11,w12,sameMarriage,sameBirth,otherWithin10}, marriageDate, birthDate, giftDate, giftAmount} (부표3)
 *       clawback: {formType('gf_marriage'), reason, result(lastClawbackResult_)} (부표4) / publicOrgPenaltyItems: [{penaltyType, violationSubType, base, amount}] (부표6)
 * 상속  heirs: [{name, regNo, relation, address, addressDong, addressHo, statutoryShareRatio, actualValue}] (부표2, ctx.부표2상속인 = 상속인 번호)
 *       valAssets: [{…giftAssets와 같은 줄, alloc:[{heirIdx, ratio}]}] (부표1·2·8) / nonHeirBequest
 *       spouse: {estateValue, assumedDebt, nonTaxable, actual, nonHeirBequest, giftToHeirs, ratio, giftBase, priorGiftedIncluded, divided} (부표3의2)
 *       disposalItems: inheritanceDisposalItems (부표4갑) / forProfitRatio · forProfitPayers: [{kind, name, regNo, ratio}] (부표5)
 *       clawback: {formType('ih6'|'ih7'), result} (부표6·7) / bc: {provision, deferredTax, triggerEvent, disposalRatio, equityDecreaseRatio, equityRatioAtBase, currentEquityRatio} (부표7)
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    var NF = root.NxFormPrint = root.NxFormPrint || {};
    NF.mappers = Object.assign(NF.mappers || {}, api.mappers);
    NF.ctxFromApp = Object.assign(NF.ctxFromApp || {}, api.ctxFromApp);
    NF.FORMS_BY_TAX = api.FORMS_BY_TAX;
    NF.applicable = api.applicable;
    NF.plan = api.plan;
    NF.registerExt = api.registerExt;
    NF.EXT_FILES = api.EXT_FILES;
    NF.exts = api.exts;
    NF.helpers = api.helpers;
    NF.officialFor = api.officialFor;
    NF.officialReady = api.officialReady;
    NF.officialJobs = api.officialJobs;
    NF.ctxsFor = api.ctxsFor;
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
  function isMobile(p) { return /^\s*01[016789]/.test(String(p || '')); } // 기본값 2 — 세무사님 확인(2026-10-19)
  // 주소 + 화면의 동·호 칸(양도인·수증자·증여자·상속인 카드는 주소 검색 뒤 동·호를 따로 받음). 숫자만이면 '동'·'호'를 붙임
  function fullAddr(o) {
    o = o || {};
    var a = String(o.address || '').trim();
    [['addressDong', '동'], ['addressHo', '호']].forEach(function (p) {
      var v = String(o[p[0]] == null ? '' : o[p[0]]).trim();
      if (!v) return;
      if (/^\d+$/.test(v)) v += p[1];
      if (a.indexOf(v) < 0) a = (a ? a + ' ' : '') + v;
    });
    return a;
  }
  // 주민등록번호 뒤 첫 자리: 1·2·3·4·9·0 내국인, 5·6·7·8 외국인등록번호 — 13자리일 때만 판단
  function nativeOf(regNo) {
    var d = String(regNo || '').replace(/\D/g, '');
    if (d.length !== 13) return null;
    return /[5678]/.test(d[6]) ? '외국인' : '내국인';
  }
  function receiptCode(t) { return { cashreceipt: '01', card: '02', taxinvoice: '03', invoice: '04' }[t] || '10'; } // taxcalc.html trReceiptTypeCode_
  // '2/7'·'0.5'·0.5 → 0.2857…  (못 읽으면 null)
  function fracNum(s) {
    if (typeof s === 'number') return isFinite(s) ? s : null;
    var t = String(s == null ? '' : s).trim();
    var m = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
    if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
    return null;
  }
  // 재산 명세 표의 단가 칸 — 화면에 단가가 있는 평가 방법(토지 공시지가 landPrice, 상장주식 평균종가 listedPrice)이고
  //   단가 × 수량 = 평가가액일 때만 찍음(할증·배분 비율이 붙어 맞지 않으면 비움)
  function unitOf(a) { var u = n(a.unitPrice), q = n(a.area); return (u && q && Math.round(u * q) === Math.round(n(a.value))) ? u : ''; }
  function unitCells(o, key, rows) {
    var u = rows.map(unitOf);
    if (u.some(function (x) { return x !== ''; })) o.set(key, u);
    if (u.some(function (x) { return x === ''; })) o.miss(key + ' 단가', '단가가 화면에 있는 건 토지(공시지가)·상장주식(평균종가)뿐이고 단가×수량=평가가액일 때만 찍음 — 나머지 줄은 비움');
  }
  function pct2(x) { return Math.round(x * 10000) / 100; } // 0.28571 → 28.57
  // 사후관리 이자 — calculateClawbackInterestJS 결과(구간별_이자상당액)를 서식 칸 글자로
  //   style 'daily'  : 1일 고정율 → '22/100,000'(1일 10만분의 22), '3/10,000'
  //   style 'annual' : 연이율 → '3.1%'   /  'perDay': '3.1%/365' (서식 식에 ÷365가 없는 칸)
  function rateText(seg, style) {
    if (seg.일이율 != null) return seg.일이율 >= 0.0003 ? '3/10,000' : Math.round(seg.일이율 * 100000) + '/100,000';
    var p = Math.round(seg.연이율 * 10000) / 100;
    return style === 'perDay' ? p + '%/365' : p + '%';
  }
  function interestCells(cr, style) {
    var segs = (cr && cr.구간별_이자상당액) || [];
    if (!segs.length) return null;
    var total = segs.reduce(function (s, g) { return s + n(g.일수); }, 0);
    if (segs.length === 1) return { single: true, days: n(segs[0].일수), rate: rateText(segs[0], style), seg: segs[0] };
    return { single: false, days: segs.map(function (g) { return n(g.일수); }).join('+') + '=' + total, rate: segs.map(function (g) { return rateText(g, style); }).join(' · '), total: total };
  }
  // 한 구간일 때 서식 식(세액 × 일수 × 율)으로 다시 계산 — 엔진과 같은 원 미만 버림
  function interestRecalc(tax, seg) {
    if (seg.일이율 != null) return Math.floor(tax * n(seg.일수) * seg.일이율 + 1e-6);
    return Math.floor(tax * n(seg.일수) * seg.연이율 / 365 + 1e-6);
  }
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
    // [2026.10.19 서식 감사 B4] 비과세 자산도 ⑫ 취득가액·⑭ 기타 필요경비를 찍도록 엔진 입력값·산정방법을 넘긴다(예전엔 빠져 빈칸)
    var inAcq = r && r.입력값 && has(r.입력값.취득가액) ? n(r.입력값.취득가액) : ap, inNec = r && r.입력값 && has(r.입력값.필요경비) ? n(r.입력값.필요경비) : ne;
    if (r && r.비과세여부 && r.과세대상양도차익 === undefined)
      return { ok: true, gross: Math.round(grossFallback), nonTaxable: Math.round(Math.max(0, grossFallback)), taxable: 0, ltRate: 0, ltDeduction: 0, income: 0, acq: inAcq, nec: inNec, kind: acqKindCode(r.취득가액_산정방법) };
    // [2026.10.19 서식 감사 B5] 미등기양도자산 — 엔진은 짧은 결과(양도차익·과세표준·산출세액)만 준다. 장기보유특별공제·기본공제 배제(§95②·§103①)라
    //  과세대상 양도차익 = 양도소득금액 = 양도차익, 장기보유특별공제 0
    if (r && !r.error && r.입력값 && r.입력값.미등기양도 && r.과세대상양도차익 === undefined) {
      var gU = Math.round(n(r.양도차익));
      return { ok: true, gross: gU, nonTaxable: 0, taxable: gU, ltRate: 0, ltDeduction: 0, income: gU, acq: inAcq, nec: inNec, kind: acqKindCode(r.취득가액_산정방법) };
    }
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
    return (m && Number(m[2])) ? m[1] + '/' + m[2] : '1/1'; // 기본값 3 — 비면 1/1, 세무사님 확인(2026-10-19)
  }

  var M = {};

  // ───────── 양도 별지 제84호서식 본표 ─────────
  // [2026.10.20 84호 주식등·국외자산] 본표 ④~㉑은 열이 6개 — 양도소득세 합계·국내분 소계·세율 열 3개(③ 세율구분 코드 "□-□")·국외분 소계.
  //  ③ 코드 앞자리는 서식 3~4쪽 세율표대로 국내자산 1·국외자산 2(§118의2 국외자산은 토지·건물·부동산 권리·기타자산 모두 2-10).
  //  · 부동산 등(calculateTransferTaxMultiJS 결과 ctx.r) — 세율 열은 자산 세율구분 코드(1-xx)별, 국내분 소계
  //  · 국외자산(calculateOverseasAssetTransferTaxMultiJS 결과 ctx.overseas, 카드 ctx.overseasAssets) — 2-10 열, 국외분 소계. 대표 양도인의 부동산 등과 같은 장에
  //    열을 나눠 적고 합계 열 = 국내분 소계 + 국외분 소계(전자신고도 같은 신고서에 국외분('9') 줄을 더함 — trBuildEfileBytes_)
  //  · 주식등(calculateStockTransferTaxJS 결과 ctx.stock, plan이 ctx.갈래 '주식등'으로 따로 한 장) — 전자신고에서 주식등은 신고유형(6·7·8)이 다른
  //    별도 신고서라 부동산 등 신고서와 섞지 않는다. 국외주식(§94①3호다목)도 세율표 "국내자산" 칸의 코드(1-61·1-62)라 국내분 소계
  //  값은 전자신고 레코드(trRateDetailRecord_·trOverseasRateDetailRecord_·trStockRateDetailRecord_)와 같은 엔진 결과 이름을 쓴다.
  function head84(o, ctx, year) {
    var s = ctx.seller || {};
    if (has(year)) o.set('귀속연도', String(year)); else o.miss('귀속연도', '양도일 없음');
    if (has(ctx.신고구분)) o.set('신고구분', ctx.신고구분);
    else o.miss('신고구분', '계산기에 신고구분 칸 없음(전자신고는 확정신고 01 고정) — ctx.신고구분으로 넘기면 찍음');
    // ① 신고인(양도인)
    o.need('①@성명', s.name, '① 성명').need('①@주민등록번호', s.regNo, '① 주민등록번호')
      .need('①@전화번호', s.phone, '① 전화번호').need('①@주소', fullAddr(s), '① 주소');
    var resident = s.isTransferorResident !== false;
    o.set('①@거주구분', resident ? '거주자' : '비거주자'); // 화면 기본값 = 거주자(vals.isTransferorResident !== false)
    var native = nativeOf(s.regNo);
    if (native) o.set('①@내외국인', native); else o.miss('① 내ㆍ외국인', '주민등록번호가 13자리가 아니라 판단 못 함(뒤 첫 자리 5~8이면 외국인)');
    if (native === '내국인') o.set('①@국적', '대한민국').set('①@국적코드', 'KR');
    else o.miss('① 국적(코드)', native === '외국인' ? '외국인 — 국적이 계산기에 없음' : '내ㆍ외국인 판단 못 함');
    if (resident) o.set('①@거주지국', '대한민국').set('①@거주지국코드', 'KR');
    else o.miss('① 거주지국(코드)', '비거주자 — 거주지국이 계산기에 없음(전자신고는 KR 근사)');
    o.miss('① 전자우편주소', '양도인 카드에 전자우편 칸 없음');
  }
  function tail84(o, ctx) {
    var s = ctx.seller || {}, ta = ctx.taxAgent || {};
    var d = ymd(ctx.신고일);
    if (d) o.set('신고일.연', d.y).set('신고일.월', d.m).set('신고일.일', d.d); else o.miss('신고일', 'ctx.신고일 없음');
    o.set('신고인서명', s.name);
    o.set('세무서', officeName(s.taxOffice));
    if (has(ta.name)) {
      o.set('세무대리인서명', ta.name).set('세무대리인@성명', ta.name).set('세무대리인@사업자등록번호', ta.bizNo)
        .set('세무대리인@관리번호', ta.mgmtNo).set('세무대리인@전화번호', ta.phone);
      o.miss('세무대리인 생년월일', '계산기에 없음');
    }
  }
  // 열 하나(국내분 소계·국외분 소계·합계)에 ④~⑳ 값 묶음을 찍음 — 값이 undefined인 칸은 비움
  var ROWS84 = ['④', '⑦', '⑧', '⑩', '⑪', '⑫', '⑭', '⑮', '⑯-무(과소)신고', '⑯-납부지연', '⑯-기장불성실 등', '⑯-계', '⑱', '⑲', '⑳'];
  function putCol84(o, col, V) { ROWS84.forEach(function (k) { if (V[k] !== undefined) o.set(k + '@' + col, V[k]); }); }

  M['양도84호'] = function (ctx) { return ctx && ctx.갈래 === '주식등' ? stock84(ctx) : realty84(ctx || {}); };

  // 부동산 등 + 국외자산(대표 양도인) 한 장
  function realty84(ctx) {
    var o = new Out(), r = ctx.r || {};
    var assets = ctx.assets || [], hasDom = !!(ctx.r && assets.length);
    var ov = ctx.overseas && !ctx.overseas.error ? ctx.overseas : null;
    var ovAssets = (ov && ctx.overseasAssets) || [];
    head84(o, ctx, ctx.귀속연도);
    // ② 양수인 — 서식 칸은 한 줄(부동산 등 계약의 양수인)
    if (hasDom) {
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
      if (ov) o.note('국외자산 ' + n(ov.거래건수) + '건은 ② 칸에 적지 않음(한 줄 칸) — 국외자산 양수인·소재지는 계산기에 없어 별지에 직접');
    } else {
      o.miss('② 양수인', '국외자산 계산기에 양수인 칸 없음');
      o.miss('② 양도자산 소재지', '국외자산 카드에 소재지 칸 없음');
    }

    // [2026.10.20 B6] ③~⑩ 세율 열 — 엔진 합산 결과의 자산별 세율 묶음 값(r.세율별_자산: idx·소득금액·기본공제·과세표준·산출세액(감면 전))을
    //  자산의 세율구분 코드(trRateClassCode1_)별로 모아 세율1~3 열에 찍는다. ⑧ = ④ − ⑦(⑤⑥ 없음). ⑩: 단기·미등기 열은 그 세액,
    //  누진세율 열이 하나면 그 묶음 산출세액, 누진세율 열이 둘 이상이면 열별 배분이 작성방법 8(§104⑤ 비교과세)이라 합계 열에만 적는다.
    var rows = r.세율별_자산 || [], rowsOk = hasDom && rows.length > 0 && assets.length === n(r.거래건수);
    var byCode = {}, codeOrder = [];
    if (rowsOk) rows.forEach(function (row) {
      var a = assets[row.idx]; var code = a && a.rateCode; if (!code) return;
      if (!byCode[code]) { byCode[code] = { 소득금액: 0, 기본공제: 0, 과세표준: 0, 산출세액: 0, 누진: false, 세율: {} }; codeOrder.push(code); }
      var g = byCode[code]; g.소득금액 += n(row.소득금액); g.기본공제 += n(row.기본공제); g.과세표준 += n(row.과세표준); g.산출세액 += n(row.산출세액);
      if (row.묶음 === '누진') g.누진 = true; else g.세율[String(row.세율)] = true;
    });
    codeOrder.sort(function (x, y) { return Number(x) - Number(y); });
    var use1_ = !!(r.비교과세_104조5항 && r.비교과세_104조5항.적용 === '1호');
    var sumBy = function (k) { return codeOrder.reduce(function (t, c) { return t + byCode[c][k]; }, 0); };
    var poolAll = hasDom && has(r.합산대상_장기거래건수) && n(r.합산대상_장기거래건수) === n(r.거래건수) - n(r.비과세건수);
    var colUsed = 0;
    if (rowsOk) {
      codeOrder.slice(0, 3).forEach(function (code, k) {
        var col = '세율' + (k + 1), g = byCode[code];
        o.set('③@' + col + '.앞', '1').set('③@' + col + '.뒤', code);
        o.set('④@' + col, g.소득금액).set('⑦@' + col, g.기본공제).set('⑧@' + col, g.과세표준);
        var rates = Object.keys(g.세율);
        if (!g.누진 && rates.length === 1) o.set('⑨@' + col, Math.round(Number(rates[0]) * 100) + '%');
        if (!use1_) o.set('⑩@' + col, g.산출세액); // [2026.10.20 J15] 엔진이 §104⑤2호대로 세율 묶음마다 누진세액을 매김 — 열별 ⑩이 정해짐
      });
      colUsed = Math.min(3, codeOrder.length);
      if (codeOrder.length > 3) o.note('세율구분이 ' + codeOrder.length + '가지 — 서식 세율 열이 3개라 앞 3개(' + codeOrder.slice(0, 3).join('·') + ')만 찍음, 나머지(' + codeOrder.slice(3).join('·') + ')는 별지 필요');
      if (use1_) o.miss('⑩ 세율 열별 산출세액', '§104⑤1호(과세표준 합계 × 기본세율) 적용 해 — 산출세액이 하나라 합계 열에만 적음(작성방법 8)');
      o.check('⑧ 국내분 = 세율 열 ⑧ 합', sumBy('과세표준'), n(r.합산과세표준) + rows.filter(function (x) { return x.묶음 !== '누진'; }).reduce(function (t, x) { return t + n(x.과세표준); }, 0));
      o.check('⑦ 국내분 = 세율 열 ⑦ 합', n(r.기본공제), sumBy('기본공제'));
    } else if (hasDom) {
      o.miss('③④⑧ 세율 열', '엔진 자산별 세율 값(세율별_자산)과 자산 목록이 맞지 않음(환지 증가분 등) — 소계·합계 열만');
    }

    // 국내분(부동산 등) 값 — 지금까지와 같은 식
    var D = null;
    if (hasDom) {
      var reduction = n(r.합산자경감면액) + n(r.합산수용감면액) + n(r.합산조특법세액감면액);
      var 가산신고 = n(r.무신고가산세) + n(r.과소신고가산세), 가산납부 = n(r.납부지연가산세), 가산기장 = n(r.환산취득가액가산세_합계);
      var payable = Math.max(0, n(r.납부세액_합계) - n(r.지방소득세)); // trPrintFormPageHtml_ nationalPayable
      D = { '④': rowsOk ? sumBy('소득금액') : (poolAll ? n(r.합산소득금액) : undefined), '⑦': n(r.기본공제),
        '⑧': rowsOk ? sumBy('과세표준') : (poolAll ? n(r.합산과세표준) : undefined),
        '⑩': n(r.산출세액_합계) + reduction, // 감면 전 금액(trRateDetailRecord_ 10번과 같은 식)
        '⑪': reduction, '⑭': n(r.연금계좌세액공제_합계), '⑮': n(r.전자신고세액공제),
        '⑯-무(과소)신고': 가산신고, '⑯-납부지연': 가산납부, '⑯-기장불성실 등': 가산기장, '⑯-계': 가산신고 + 가산납부 + 가산기장, '⑱': payable };
      if (typeof ctx.splitAmt === 'number' && isFinite(ctx.splitAmt)) { D['⑲'] = ctx.splitAmt; D['⑳'] = Math.max(0, payable - ctx.splitAmt); }
      // 검산: ⑱ = ⑩ − ⑪ − ⑫ − ⑬ − ⑭ − ⑮ + ⑯ − ⑰ (⑫⑬⑰은 0으로)
      o.check('⑱ 국내분 = ⑩ − ⑪ − ⑭ − ⑮ + ⑯계 (⑫⑬⑰ 0)', payable,
        Math.max(0, n(r.산출세액_합계) + reduction - reduction - n(r.연금계좌세액공제_합계) - n(r.전자신고세액공제) + 가산신고 + 가산납부 + 가산기장));
      if (poolAll) o.check('⑧ 국내분 = ④ − ⑦', n(r.합산과세표준), n(r.합산소득금액) - n(r.기본공제));
    }

    // 국외분(국외자산) 값 — 전자신고 trOverseasRateDetailRecord_와 같은 값(감면·연금계좌·전자신고세액공제·기장불성실은 국외자산 계산에 없어 0)
    var F = null;
    if (ov) {
      var fInc = Math.round(n(ov.합산양도차익)), fDed = n(ov.기본공제), fBase = n(ov.과세표준), fTax = n(ov.산출세액), fFtc = n(ov.외국납부세액공제);
      var f신고 = n(ov.무신고가산세) + n(ov.과소신고가산세), f납부 = n(ov.납부지연가산세);
      var fPay = Math.max(0, n(ov.납부세액_합계) - n(ov.지방소득세));
      F = { '④': fInc, '⑦': fDed, '⑧': fBase, '⑩': fTax, '⑪': 0, '⑫': fFtc, '⑭': 0, '⑮': 0,
        '⑯-무(과소)신고': f신고, '⑯-납부지연': f납부, '⑯-기장불성실 등': 0, '⑯-계': f신고 + f납부, '⑱': fPay };
      if (typeof ctx.splitAmt === 'number' && isFinite(ctx.splitAmt)) { F['⑲'] = 0; F['⑳'] = fPay; }
      // 세율 열 — 국외자산 2-10(기본세율 6~45%, §118의5①) 하나
      if (colUsed < 3) {
        var fc = '세율' + (colUsed + 1);
        o.set('③@' + fc + '.앞', '2').set('③@' + fc + '.뒤', '10');
        o.set('④@' + fc, fInc).set('⑦@' + fc, fDed).set('⑧@' + fc, fBase).set('⑩@' + fc, fTax);
      } else o.note('세율 열 3개가 국내분으로 다 차서 국외자산 2-10 열은 별지 필요 — 국외분 소계 열에는 찍음');
      o.check('⑧ 국외분 = ④ − ⑦ (0 아래면 0)', fBase, Math.max(0, fInc - fDed));
      o.check('⑱ 국외분 = ⑩ − ⑫ + ⑯계', fPay, Math.max(0, fTax - fFtc + f신고 + f납부));
      if (ov.외국납부세액공제_안내) o.note('국외분 ⑫ 외국납부세액공제: ' + ov.외국납부세액공제_안내);
      if (ovAssets.length !== n(ov.거래건수)) o.note('국외자산 카드 수(' + ovAssets.length + ')가 국외자산 계산 결과 거래 수(' + n(ov.거래건수) + ')와 다름 — 계산 뒤 카드를 고쳤으면 다시 계산하세요');
    }

    // 소계·합계 열
    if (D) putCol84(o, '국내분소계', D);
    if (F) putCol84(o, '국외분소계', F);
    if (D && F) {
      var T = {};
      ROWS84.forEach(function (k) {
        var dv = k === '⑫' ? 0 : D[k]; // 국내분 ⑫ 외국납부세액공제는 계산기에 없음(국내자산이라 0 — 전자신고 12번도 0)
        if (dv !== undefined && F[k] !== undefined) T[k] = dv + F[k];
      });
      putCol84(o, '합계', T);
      if (D['④'] === undefined) o.miss('④⑧ 합계', '국내분 ④⑧을 정하지 못해 합계 열도 비움');
      if (n(ctx.splitAmt) > 0) o.note('⑲ 분납 — 분납 계산기는 국내분(부동산 등) 세액 기준이라 국내분 열에만 적음. 분납 한도(§112)는 신고서 전체 납부할 세액 기준이므로 국외분까지 합쳐 다시 확인(확인 필요)');
    } else if (D) putCol84(o, '합계', D);
    else if (F) putCol84(o, '합계', F);
    if (D || F) {
      if ((D && D['⑲'] === undefined) || (!D && F && F['⑲'] === undefined)) o.miss('⑲ 분납할 세액·⑳ 납부세액', '분납 계산 자료(ctx.splitAmt) 없음');
    }
    o.miss('⑤ 기신고ㆍ결정ㆍ경정된 양도소득금액', '계산기에 없음');
    o.miss('⑥ 소득감면대상 소득금액', '본표 합산 계산에 없음');
    o.miss('⑨ 누진세율 열의 세율', '누진세율(6~45%, 가산 포함)은 열 하나에 숫자 하나로 적기 어려워 비움 — 합계·소계 열은 서식대로 비움');
    if (hasDom) o.miss('⑫ 외국납부세액공제(국내분)', '부동산 본표 계산기에 없음(국외자산은 국외분 열)');
    o.miss('⑬ 원천징수세액공제', '계산기에 없음');
    o.miss('⑰ 기신고ㆍ결정ㆍ경정세액, 조정공제', '계산기에 없음');
    o.miss('㉑ 환급세액', '계산기에 없음');
    // [2026.10.20 J21] 양도세 감면분 농어촌특별세 — 엔진 농어촌특별세_과세표준(과세 감면세액)·농어촌특별세(× 20%, 농특세법 §5①1호). 비과세 감면(§66~§70·직접 경작 수용·§98의3·§98의5)은 빠짐
    //  국외자산 계산에는 감면이 없어 농특세가 생기지 않음
    if (hasDom) {
      if (has(r.농어촌특별세_과세표준)) {
        var ntB = n(r.농어촌특별세_과세표준), ntT = n(r.농어촌특별세);
        // [2026.10.20] ㉕ 농특세 가산세(국세기본법 §47의2~§47의4 — 엔진 농어촌특별세_가산세), ㉗ = ㉔ + ㉕ − ㉖
        var ntP = has(r.농어촌특별세_가산세) ? n(r.농어촌특별세_가산세) : 0, ntDue = has(r.농어촌특별세_자진납부할세액) ? n(r.농어촌특별세_자진납부할세액) : ntT + ntP;
        if (ntB > 0) { o.set('㉒', ntB).set('㉓', '20%').set('㉔', ntT).set('㉕', ntP).set('㉗', ntDue).set('㉙', ntDue); o.miss('㉖ 기신고세액·㉘ 분납', '계산기에 없음(농특세 분납은 따로 계산 안 함)'); }
        else if (D['⑪']) o.note('감면세액 ' + D['⑪'] + '원은 모두 농특세 비과세 감면(농특세법 시행령 §4)이라 ㉒~㉙ 비움');
      } else o.miss('㉒~㉚ 농어촌특별세', '엔진 결과에 농어촌특별세 없음(옛 결과)');
    }
    o.miss('㉛㉜ 환급금 계좌', '계산기에 없음');
    tail84(o, ctx);
    return o.result();
  }

  // ───────── 주식등(주식등 계산기 lastStockTransferResult_) 84호 — 따로 한 장 ─────────
  // 세율구분 코드 뒷자리 — 서식 3~4쪽 세율표 2항(주식: 1-70·1-62·1-61·1-63)·3항(기타자산 1-10, 비사업용토지 과다보유법인 주식 1-11(1항 ⑨))·
  //  4항(파생상품 1-80·1-81)·5항(신탁수익권 1-95). 고르는 조건은 calculateStockTransferTaxJS가 세율을 고르는 조건과 같게
  function stockRateCode(inp) {
    var cat = inp.assetCategory, hm = (inp.holdingMonths === null || inp.holdingMonths === undefined || inp.holdingMonths === '') ? NaN : Number(inp.holdingMonths);
    if (cat === 'domestic_stock') {
      if (inp.isDaejuju && !inp.isSmallMediumCompany && isFinite(hm) && hm < 12) return '70'; // ① 중소기업 외 법인 대주주 1년 미만 30%
      if (inp.isDaejuju) return '63';                                                      // ④ 대주주 20~25%
      return inp.isSmallMediumCompany ? '62' : '61';                                         // ② 중소기업 소액주주 10% / ③ 그 밖 소액주주 20%
    }
    if (cat === 'foreign_stock') return inp.isSmallMediumCompany ? '62' : '61';           // 국외주식 — 중소기업 10% / 그 밖 20%
    if (cat === 'derivative') return String(inp.transferDate || '') && String(inp.transferDate) < '2018-04-01' ? '80' : '81'; // [2026.10.20] 엔진도 양도일로 5%(80)·10%(81) — 시행령 §167의9 연혁
    if (cat === 'other_asset') return inp.isMajorityNonBusinessLandCorp ? '11' : '10';
    if (cat === 'trust_beneficiary') return '95';
    return '';
  }
  var STOCK_FLAT_RATE = { '61': '20%', '62': '10%', '70': '30%', '80': '5%', '81': '10%' };
  // 이월과세(§97의2①)가 적용된 결과는 엔진이 취득가액을 증여자 취득가액으로, 필요경비에 증여세 상당액을 더해 계산 — 서식 칸도 그 값으로
  //  (화면 입력값 input.acquisitionPrice는 수증자 자기 취득가액이라 그대로 찍으면 양도소득금액과 안 맞음)
  function stockAcqExp(inp, r) {
    var tp = n(inp.transferPrice), ap = n(inp.acquisitionPrice), te = n(inp.transferExpenses);
    if (r && r.이월과세_적용여부 === true && r.이월과세_비교 && has(r.양도차익)) {
      var te2 = te + n(r.이월과세_비교.증여세상당액_필요경비산입);
      return { tp: tp, ap: tp - te2 - Math.round(n(r.양도차익)), te: te2, carry: true };
    }
    return { tp: tp, ap: ap, te: te, carry: false };
  }
  function stock84(ctx) {
    var o = new Out(), st = ctx.stock || {}, inp = st.input || {}, r = st.result || {};
    if (!st.input || !st.result) { o.miss('84호(주식등) 전체', '주식등 계산 결과 없음'); return o.result(); }
    var m = String(inp.transferDate || '').match(/^(\d{4})-/);
    head84(o, ctx, m ? m[1] : '');
    o.miss('② 양수인', '주식등 계산기에 양수인 칸 없음 — 장외 양도면 직접 적음');
    o.miss('② 양도자산 소재지', '주식등 계산기에 소재지 칸 없음(종목은 부표 ①②)');
    var code = stockRateCode(inp);
    if (code) o.set('③@세율1.앞', '1').set('③@세율1.뒤', code); else o.miss('③ 세율구분', '자산구분을 알 수 없음');
    var inc = Math.round(n(r.손익통산_적용후_소득금액)), ded = n(r.기본공제), base = n(r.과세표준), tax = n(r.산출세액), ftc = n(r.외국납부세액공제);
    var s신고 = n(r.무신고가산세) + n(r.과소신고가산세), s납부 = n(r.납부지연가산세), s기장 = n(r.기장불성실가산세);
    var bt = r.법인전환이월과세_사후관리 && has(r.법인전환이월과세_사후관리.납부세액) ? n(r.법인전환이월과세_사후관리.납부세액) : 0;
    var pay = Math.max(0, n(r.납부세액_합계) - n(r.지방소득세) - bt);
    o.set('④@세율1', inc).set('⑦@세율1', ded).set('⑧@세율1', base).set('⑩@세율1', tax);
    if (STOCK_FLAT_RATE[code]) o.set('⑨@세율1', STOCK_FLAT_RATE[code]);
    else o.miss('⑨ 세율', '누진세율(' + (r.적용세율_설명 || '') + ')은 열 하나에 숫자 하나로 적기 어려워 비움');
    var V = { '④': inc, '⑦': ded, '⑧': base, '⑩': tax, '⑪': 0, '⑫': ftc, '⑭': 0, '⑮': 0,
      '⑯-무(과소)신고': s신고, '⑯-납부지연': s납부, '⑯-기장불성실 등': s기장, '⑯-계': s신고 + s납부 + s기장, '⑱': pay, '⑲': 0, '⑳': pay };
    putCol84(o, '국내분소계', V);
    putCol84(o, '합계', V);
    if (inp.assetCategory === 'foreign_stock') o.note('국외주식(§94①3호다목)은 세율표 "국내자산" 칸 코드(1-61·1-62)라 국내분 소계 열에 적음 — 국외분 소계는 §118의2 국외자산(2-10)용');
    if (n(inp.priorNetGainOrLoss)) o.note('④에 "같은 기간 다른 국내외주식 순손익" ' + n(inp.priorNetGainOrLoss) + '원(손익통산)이 들어 있음 — 부표에는 이번 종목만 찍히므로 다른 종목 줄을 부표에 직접 적어야 ④ = 부표 합계(작성방법 5)');
    if (n(inp.basicDeductionAlreadyUsed)) o.note('⑦은 연 250만원 중 이미 쓴 ' + n(inp.basicDeductionAlreadyUsed) + '원을 뺀 값');
    if (bt) o.note('법인전환 이월과세 사후관리 납부세액 ' + bt + '원은 화면 합계에는 더해졌지만 84호 칸 산식(⑱ = ⑩ − … + ⑯ − ⑰)에 들어갈 자리가 없어 ⑱에 넣지 않음(확인 필요)');
    o.note('⑲ 분납 — 분납 계산기는 부동산 등 세액 기준이라 주식등은 분납 0으로 찍음(분납하면 ⑲⑳을 직접 고침)');
    o.check('⑧ = ④ − ⑦ (0 아래면 0)', base, Math.max(0, inc - ded));
    o.check('⑱ = ⑩ − ⑫ + ⑯계', pay, Math.max(0, tax - ftc + s신고 + s납부 + s기장));
    o.miss('⑤ 기신고ㆍ결정ㆍ경정된 양도소득금액', '계산기에 없음');
    o.miss('⑥ 소득감면대상 소득금액', '주식등 계산에 감면 없음');
    o.miss('⑬ 원천징수세액공제', '계산기에 없음');
    o.miss('⑰ 기신고ㆍ결정ㆍ경정세액, 조정공제', '계산기에 없음');
    o.miss('㉑ 환급세액', '계산기에 없음');
    o.miss('㉛㉜ 환급금 계좌', '계산기에 없음');
    tail84(o, ctx);
    return o.result();
  }

  // ───────── 양도 별지 제84호서식 부표1(양도소득금액 계산명세서) ─────────
  // [2026.10.20 84호 주식등·국외자산] 부동산 등 자산 다음 열에 국외자산(ctx.overseas)도 적는다 — ① 세율구분 앞자리 2(국외)·뒷자리 10,
  //  ⑯ 장기보유특별공제 0(§118의8 단서). 본표 ④ = 부표1 ⑱ 합계(작성방법 5)가 국외분까지 맞게.
  //  주식등 계산기의 신탁수익권(§94①6호)은 부표2(주식) 종류코드에 없고 부표1 자산종류 26·세율구분 95라 ctx.갈래 '주식등'으로 한 장 따로(stockB1).
  var STOCK_ACQ_CAUSE = { '01': '매매', '07': '증여', '08': '상속', '09': '기타' }; // 주식 취득유형 중 부표1 ⑤ 원인 낱말과 1:1인 것만
  M['양도84부표1'] = function (ctx) {
    if (ctx && ctx.갈래 === '주식등') return stockB1(ctx);
    var o = new Out(), list = ctx.assets || [];
    var ov = ctx.overseas && !ctx.overseas.error ? ctx.overseas : null;
    var ovList = (ov && ctx.overseasAssets) || [];
    var total = list.length + ovList.length;
    if (total > 3) o.note('자산이 ' + total + '개 — 한 장 3열이라 모듈이 다음 장에 이어 찍음(합계는 마지막 장)');
    var sum = {};
    function add(k, v) { sum[k] = (sum[k] || 0) + v; }
    list.forEach(function (it, i) {
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
      if (a.isInheritedAsset) o.set('⑤@' + col + '.원인', '상속');
      else if (a.isGiftedAsset) {
        // [2026.10.20 위원회 J10] 이월과세(§97의2)가 실제로 적용된 자산은 그 뜻을 알림으로(원인 칸이 좁음)(엔진 자산별 내역 — 자산 수가 엔진 거래 수와 같을 때만)
        var r_ = ctx.r || {}, co_ = (list.length === n(r_.거래건수)) ? (r_.자산별_내역 || []).filter(function (x) { return x.idx === i && x.구분 === '이월과세(§97의2)'; })[0] : null;
        o.set('⑤@' + col + '.원인', '증여'); // 칸 너비 21pt라 '증여(§97의2 이월과세)'는 안 들어감(두 줄로도 넘침) — 이월과세 적용은 알림으로
        if (co_ && co_.적용여부 === true) o.note(tag + '⑤ 원인은 증여 — 이월과세(§97의2) 적용 자산(취득가액은 증여자 취득가액). 칸이 좁아 원인 칸에는 "증여"만 적음(위원회 J10 권고: 괄호에 이월과세 표기)');
        if (co_ && co_.적용여부 === false && /사망/.test(String(co_.사유 || ''))) o.note(tag + '증여자 사망으로 이월과세를 하지 않음 — 사망 사실 증빙(기본증명서 등)을 첨부(위원회 J10)');
      }
      else o.miss(tag + '⑤ 취득원인', '계산기에 취득원인 칸 없음(상속·증여받은 자산 표시만 있음 — 둘 다 아니면 매매인지 알 수 없음)');
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
    // 국외자산 — calculateOverseasAssetTransferTaxMultiJS 거래별_내역(idx = 국외자산 카드 순서)의 양도차익
    var perTxn = (ov && ov.거래별_내역) || [], ovOk = ov && ovList.length === n(ov.거래건수);
    if (ov && !ovOk) o.miss('국외자산 열', '국외자산 카드 수(' + ovList.length + ')와 계산 결과 거래 수(' + n(ov.거래건수) + ')가 다름 — 다시 계산하세요');
    if (ovOk) ovList.forEach(function (a, j) {
      var i = list.length + j, col = '자산' + (i + 1), tag = '자산' + (i + 1) + '(국외) ';
      var px = perTxn.filter(function (x) { return x.idx === j; })[0];
      o.set('①@' + col + '.앞', '2').set('①@' + col + '.뒤', '10');
      o.miss(tag + '② 소재지국·소재지', '국외자산 카드에 소재지국·소재지 칸 없음');
      o.miss(tag + '③ 자산종류 코드', '국외자산 카드에 자산 종류(토지·건물·권리·기타자산) 칸 없음');
      o.need('④@' + col + '.날짜', a.transferDate, tag + '④ 양도일');
      o.miss(tag + '④⑤ 양도·취득 원인', '국외자산 카드에 원인 칸 없음');
      o.need('⑤@' + col + '.날짜', a.acquisitionDate, tag + '⑤ 취득일');
      var tp = n(a.transferPrice), ap = n(a.acquisitionPrice), ex = n(a.oaCapitalExpenditure) + n(a.oaTransferExpenses);
      o.set('⑪@' + col, tp); add('⑪', tp);
      o.set('⑫@' + col, ap); add('⑫', ap);
      o.miss(tag + '⑫ 취득가액 종류', '국외자산 카드에 취득가액 산정 방법 칸 없음');
      o.set('⑭@' + col, ex); add('⑭', ex);
      if (px) {
        var g = Math.round(n(px.양도차익));
        o.set('(양도차익) 전체 양도차익@' + col, g); add('전체', g);
        o.set('(양도차익) 비과세 양도차익@' + col, 0); add('비과세', 0);
        o.set('⑮@' + col, g); add('⑮', g);
        o.set('⑯@' + col + '.금액', 0); add('⑯', 0); // §118의8 단서 — 국외자산은 장기보유특별공제 없음
        o.set('⑱@' + col, g); add('⑱', g);
        o.check(tag + '전체 양도차익 = ⑪ − ⑫ − ⑭ (자본적지출+양도비)', g, tp - ap - ex);
      } else o.miss(tag + '양도차익·⑮·⑱', '엔진 거래별_내역에 이 자산 없음');
    });
    if (ovOk && ovList.length) o.check('국외자산 ⑱ 합 = 본표 ④ 국외분(합산양도차익)', ovList.reduce(function (t, a, j) { var px = perTxn.filter(function (x) { return x.idx === j; })[0]; return t + (px ? Math.round(n(px.양도차익)) : 0); }, 0), Math.round(n(ov.합산양도차익)));
    if (total) {
      o.set('⑪@합계', sum['⑪']).set('⑫@합계', sum['⑫']).set('⑭@합계', sum['⑭']);
      if (has(sum['전체'])) o.set('(양도차익) 전체 양도차익@합계', sum['전체']).set('(양도차익) 비과세 양도차익@합계', sum['비과세'])
        .set('⑮@합계', sum['⑮']).set('⑯@합계', sum['⑯']).set('⑱@합계', sum['⑱']);
      if (has(sum['양도기준'])) o.set('양도시 기준시가 합계@합계', sum['양도기준']).set('취득시 기준시가 합계@합계', sum['취득기준']);
    } else o.miss('부표1 전체', '자산 없음');
    return o.result();
  };
  // 주식등 계산기의 신탁수익권(§94①6호) 한 열 — 세율구분 1-95, 자산종류 26(부표1 작성방법 1·3), 장기보유특별공제 없음(§95②은 토지·건물·조합원입주권만)
  function stockB1(ctx) {
    var o = new Out(), st = ctx.stock || {}, inp = st.input || {}, r = st.result || {}, col = '자산1';
    if (!st.input || !st.result) { o.miss('부표1 전체', '주식등 계산 결과 없음'); return o.result(); }
    var code = stockRateCode(inp), x = stockAcqExp(inp, r), g = Math.round(n(r.양도차익));
    o.set('①@' + col + '.앞', '1').set('①@' + col + '.뒤', code);
    o.set('③@' + col, '26');
    o.need('②@' + col + '.소재지', inp.companyName, '② 소재지(신탁 이름)');
    o.note('② 소재지 칸에 화면 "종목명(발행법인명)"을 적음 — 신탁수익권은 신탁 이름·수탁자를 적는 것이 맞는지 확인 필요');
    o.need('④@' + col + '.날짜', inp.transferDate, '④ 양도일');
    o.miss('④ 양도원인', '주식등 계산기에 양도원인 칸 없음');
    o.need('⑤@' + col + '.날짜', inp.acquisitionDate, '⑤ 취득일');
    if (STOCK_ACQ_CAUSE[inp.acquisitionType || '01']) o.set('⑤@' + col + '.원인', STOCK_ACQ_CAUSE[inp.acquisitionType || '01']);
    else o.miss('⑤ 취득원인', '화면 취득유형 "' + inp.acquisitionType + '"은 부표1 원인 낱말과 1:1이 아님');
    o.set('⑪@' + col, x.tp).set('⑫@' + col, x.ap).set('⑭@' + col, x.te);
    o.set('(양도차익) 전체 양도차익@' + col, g).set('(양도차익) 비과세 양도차익@' + col, 0).set('⑮@' + col, g).set('⑯@' + col + '.금액', 0).set('⑱@' + col, g);
    o.set('⑪@합계', x.tp).set('⑫@합계', x.ap).set('⑭@합계', x.te).set('(양도차익) 전체 양도차익@합계', g).set('(양도차익) 비과세 양도차익@합계', 0)
      .set('⑮@합계', g).set('⑯@합계', 0).set('⑱@합계', g);
    o.check('전체 양도차익 = ⑪ − ⑫ − ⑭', g, x.tp - x.ap - x.te);
    if (x.carry) o.note('이월과세(§97의2) 적용 — ⑫는 증여자 취득가액, ⑭에 증여세 상당액 ' + n(r.이월과세_비교.증여세상당액_필요경비산입) + '원 포함(엔진 값에서 되짚음)');
    o.miss('② 소재지국·고유번호, ⑥~⑩ 면적·지분·보유기간', '주식등 계산기에 없음');
    return o.result();
  }

  // ───────── 증여 별지 제10호서식 본표 ─────────
  var FILING_LABEL = { ontime: '기한 내 신고', underreported: '수정신고', unreported: '기한 후 신고' };
  M['증여10호'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, dn = ctx.donee || {}, dr = ctx.donor || {}, ta = ctx.taxAgent || {}, it = ctx.item || {};
    var fs = has(ctx.신고구분) ? ctx.신고구분 : FILING_LABEL[dr.filingStatus || 'ontime'];
    if (fs) o.set('신고구분', fs); else o.miss('신고구분', '신고 상태 값 없음');
    if (!has(ctx.신고구분)) o.note('신고구분은 증여자 카드 신고 상태(ontime→기한 내, underreported→수정, unreported→기한 후)에서 옮김 — 기본값 4, 세무사님 확인(2026-10-19)');
    o.need('①', dn.name, '① 수증자 성명').need('②', dn.regNo, '② 수증자 주민등록번호');
    o.set('③', dn.resident === 'nonresident' ? '비거주자' : '거주자');
    o.need('④', fullAddr(dn), '④ 수증자 주소');
    o.set('⑤', dn.email);
    if (has(dn.phone)) o.set(isMobile(dn.phone) ? '⑥~전화번호(휴대전화) (수증자)' : '⑥~전화번호(자택) (수증자)', dn.phone);
    else o.miss('⑥ 수증자 전화번호', '화면 입력 없음');
    var rw7_ = relWord(ctx.relation, ctx.genSkip, dn.regNo);
    if (rw7_) o.set('⑦', rw7_); else o.miss('⑦ 증여자와의 관계', '관계가 기타친족·그 밖의 자이거나 수증자 주민번호로 성별을 알 수 없음 — 직접 적을 것(작성방법 3: 수증자 기준)');
    o.need('⑧', dr.name, '⑧ 증여자 성명').need('⑨', dr.regNo, '⑨ 증여자 주민등록번호');
    o.need('⑩', ctx.giftDate, '⑩ 증여일자').need('⑪', fullAddr(dr), '⑪ 증여자 주소');
    o.miss('⑫ 증여자 전화번호', '증여자 카드에 전화 입력 칸 없음');
    if (has(ta.name)) {
      o.set('⑬', ta.name).set('⑭', ta.bizNo).set('⑮', ta.mgmtNo);
      if (has(ta.phone)) o.set(isMobile(ta.phone) ? '⑯~전화번호(휴대전화) (세무대리인)' : '⑯~전화번호(사무실) (세무대리인)', ta.phone);
    }
    var giftAmount = has(it.amount) ? n(it.amount) : n(r.증여재산가액);
    // [2026.10.19 서식 감사 B1 → 2026.10.20 AI 회의 회장 결론 J09(가) 확정] ㉓ = 엔진이 실제 가산한 금액(증여세과세가액 − 순수증여재산가액).
    //  §47② 1천만원 판정은 앞선 증여만으로(이번 증여 제외) — 1천만 미만·합산배제면 0. 입력값(priorGiftAmount)은 엔진 결과가 없을 때만
    var prior = (has(r.증여세과세가액) && has(r.순수증여재산가액)) ? Math.max(0, n(r.증여세과세가액) - n(r.순수증여재산가액)) : n(it.priorGiftAmount);
    var taxable = n(r.순수증여재산가액) + prior;
    o.set('⑰', giftAmount).set('⑱', n(r.비과세재산가액)).set('⑲', n(r.공익법인출연재산가액)).set('⑳', n(r.공익신탁재산가액))
      .set('㉑', n(r.장애인신탁재산가액)).set('㉒', n(r.인수채무액)).set('㉓', prior).set('㉔', taxable);
    var REL = { '배우자': '㉕', '직계존속': '㉖', '직계비속': '㉗', '기타친족': '㉘' };
    var relCell = REL[ctx.relation];
    ['㉕', '㉖', '㉗', '㉘'].forEach(function (k) { o.set(k, k === relCell ? n(r.증여재산공제) : 0); });
    if (!relCell && ctx.relation !== '기타') { o.miss('㉕~㉘ 증여재산공제', '관계 값(ctx.relation)이 배우자·직계존속·직계비속·기타친족이 아님: ' + ctx.relation); ['㉕', '㉖', '㉗', '㉘'].forEach(function (k) { delete o.values[k]; }); }
    // [2026.10.20 서식↔엔진 감사 A] 작성방법 8·9: ㉙ = 부표3 ⑯(같은 증여자 기존 혼인공제 + 이번 혼인공제), ㉚ = 부표3 ⑰ — 부표3과 같은 나누기
    //  (예전엔 기존+이번 합계를 이번 증여의 혼인/출산 여부로만 나눠, 같은 증여자의 기존 출산공제가 혼인 칸으로 몰렸음)
    var mbd_ = ctx.mbDetail, pp0_ = mbd_ && mbd_.priorParts, cur0_ = (mbd_ && mbd_.cur) || { marriage: 0, birth: 0 };
    var mb = pp0_ ? { marriage: n(pp0_.sameMarriage) + n(cur0_.marriage), birth: n(pp0_.sameBirth) + n(cur0_.birth) } : (ctx.marriageBirth || { marriage: 0, birth: 0 });
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
      .need('④', fullAddr(rp), '④ 신고인 주소').need('⑤', rp.relation, '⑤ 피상속인과의 관계');
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
    var assets = ctx.assets || [];
    if (assets.length > 5) o.note('재산이 ' + assets.length + '건 — "가" 표가 5줄이라 모듈이 다음 장에 이어 찍음(합계는 마지막 장)');
    var rows = assets;
    o.miss('① 재산구분 코드', '계산기에 재산구분 칸 없음(전자신고는 A11 고정)');
    o.set('②', rows.map(function (a) { return a.typeCode || ''; }));
    if (rows.some(function (a) { return !has(a.typeCode); })) o.miss('② 재산종류 코드', '일부 재산의 코드 없음(ihAssetTypeCode_)');
    o.miss('③ 국외자산 여부·국가명', '계산기에 없음(전자신고는 N 고정)');
    o.set('③~소재지·법인명 등', rows.map(function (a) { return a.location || ''; }));
    o.miss('④ 사업자등록번호(계좌번호, 지분)', '계산기에 없음');
    o.set('⑤', rows.map(function (a) { return n(a.area) || ''; }));
    unitCells(o, '⑥', rows);
    o.set('⑦', rows.map(function (a) { return Math.round(n(a.value)); }));
    o.set('⑧', rows.map(function (a) { return a.basisCode || ''; }));
    var valTotal = has(ctx.valuationTotal) ? n(ctx.valuationTotal) : assets.reduce(function (s, a) { return s + Math.round(n(a.value)); }, 0);
    // [2026.10.19] 재산평가 목록도 총상속재산가액도 없으면(과세가액만 넣은 계산) ⑨⑩⑫를 0으로 찍지 않고 비운다 — 0으로 찍으면 ㉙ 검산이 거짓으로 틀림
    var grossKnown = n(ctx.grossEstate) > 0 || assets.length > 0 || n(ctx.valuationTotal) > 0;
    if (grossKnown) o.set('⑨', Math.round(valTotal)); else o.miss('⑨⑩⑫ 재산가액 합계', '재산평가 목록이 없음(계산기에 과세가액만 입력) — 출력물에 직접 적으세요');
    var gross = has(ctx.grossEstate) ? n(ctx.grossEstate) : valTotal;
    var disp = presumedAll(r), nonTax = n(r.비과세재산가액); // [2026.10.20 J05] ⑪ = 부표4(갑) 다 — §15①(처분·인출·채무부담) + §15②(변제의무 미입증 채무)
    var po = n(ctx.publicOrg), pt = n(ctx.publicTrust), dues = n(ctx.duesTotal), debt = n(ctx.debtTotal), fun = n(r.장례비용공제);
    if (grossKnown) o.set('⑩', gross).set('⑫', gross + disp);
    o.set('⑪', disp).set('⑬', nonTax).set('⑯', nonTax);
    o.miss('⑭⑮ 금양임야·공공단체 유증', '비과세는 한 칸으로만 받음 — 전액 ⑯ 기타로(전자신고와 같음)');
    o.set('⑰', po + pt).set('⑱', po).set('⑲', pt);
    o.miss('⑳ 과세가액 불산입 기타', '계산기에 없음');
    o.set('㉑', dues + fun + debt).set('㉒', dues).set('㉓', fun).set('㉔', debt);
    if (fv.priorGiftAdded !== null) o.set('㉕', fv.priorGiftAdded).set('㉖', fv.priorGiftAdded);
    else o.miss('㉕㉖ 가산하는 증여재산가액', '화면 "과세가액에 가산된 사전증여재산 원본액" 값(fv.priorGiftAdded) 없음');
    o.miss('㉗㉘ 조특법 §30의5·§30의6 가산액', '나눠 받는 칸 없음 — 전액 ㉖(§13)으로(전자신고와 같음)');
    o.set('㉙', fv.taxableEstate);
    o.check('⑨ = ⑦ 합', valTotal, rows.reduce(function (s, a) { return s + Math.round(n(a.value)); }, 0));
    if (grossKnown && fv.priorGiftAdded !== null) o.check('㉙ = max(0, ⑫ − ⑬ − ⑰ − ㉑) + ㉕', fv.taxableEstate, Math.max(0, gross + disp - nonTax - po - pt - (dues + fun + debt)) + fv.priorGiftAdded); // [2026.10.19] §13① 후단 — 사전증여 가산 전 0 바닥
    return o.result();
  };

  // ───────── 상속 부표3(채무·공과금·장례비용 및 상속공제명세서) ─────────
  M['상속9호부표3'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, fv = fvOf(ctx);
    var debts = (ctx.debts || []).filter(function (it) { return n(it.amount) > 0; });
    var dues = (ctx.dues || []).filter(function (it) { return n(it.amount) > 0; });
    var funs = (ctx.funerals || []).filter(function (it) { return n(it.amount) > 0; });
    if (debts.length > 4 || dues.length > 4 || funs.length > 5) o.note('채무 ' + debts.length + '건·공과금 ' + dues.length + '건·장례비용 ' + funs.length + '건 — 한 장(4·4·5줄)을 넘는 만큼 모듈이 다음 장에 이어 찍음');
    var D = debts, U = dues, F = funs;
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
    o.note('⑱~㉒(기초·인적공제)와 ㉓ 일괄공제를 함께 적음 — 기본값 5, 세무사님 확인(2026-10-19)(㉛은 엔진 한도 적용 합계)');
    var biz = n(r.가업상속공제), farm = n(r.영농상속공제), sp = n(r.배우자공제), fin = n(r.금융재산상속공제), dis = n(r.재해손실공제), co = n(r.동거주택상속공제);
    o.set('㉔', biz).set('㉕', farm).set('㉖', sp).set('㉗', fin).set('㉘', dis).set('㉙', co);
    var limit = fv.limit !== null ? fv.limit : Math.max(0, n(r.상속세과세가액_적용값) - biz - farm - sp - fin - dis - co);
    o.set('㉚', limit).set('㉛', fv.deductionTotal);
    if (fv.limit === null) o.note('㉚은 엔진 공제적용한도액이 없어 지금 인쇄의 옛 식(과세가액 − 다른 공제들)으로 찍음');
    return o.result();
  };

  // ═════════ 새 대응표 17장 (작업자 하, 2026-10-19) ═════════
  // 값 출처: 칸 해설(reftables/서식_*.json)의 "계산기칸" + 지금 인쇄 함수(trAttach2PrintPageHtml_·derivativePrintFormPageHtml_·
  //   trAttach3ExpenseRecords_·gfAttach1PrintPageHtml_·bdDeferralPrintPageHtml_·gfMarriageBirthPrintPageHtml_·gfMarriageClawbackPrintPageHtml_·
  //   gfArtworkPrintPageHtml_·ihAttachPrintPagesHtml_·ihClawbackPrintPageHtml_)·전자신고 레코드 함수와 같은 값.
  function dateParts(o, d, ky, km, kd, label) {
    var x = ymd(d);
    if (x) o.set(ky, x.y).set(km, x.m).set(kd, x.d); else o.miss(label || '신고(제출)일', 'ctx.신고일 없음(계산기에 없음)');
  }

  // ───── 양도 부표2(주식등 양도소득금액 계산명세서) — lastStockTransferResult_ 1건 ─────
  //  [2026.10.20 84호 주식등·국외자산] ④ 종류코드: 국외주식 62(중소기업 10%)·61(그 밖 20%), 기타자산 주식 51(누진)·52(비사업용토지 과다보유법인 누진)
  //  — 부표2 작성방법 4 표. 국내주식은 상장(코스피·코스닥·코넥스)·비상장 구분이 계산기에 없어 비움. 이월과세가 적용된 결과면 ⑬⑭를 엔진 값으로(stockAcqExp)
  M['양도84부표2'] = function (ctx) {
    var o = new Out(), st = ctx.stock;
    if (!st || !st.input) { o.miss('부표2 전체', '주식등 계산 결과 없음'); return o.result(); }
    var inp = st.input, r = st.result || {}, c = '종목1', foreign = inp.assetCategory === 'foreign_stock';
    o.need('①@' + c, inp.companyName, '① 주식등 종목명');
    if (foreign) o.miss('② ISIN코드·국가명', '국외주식 ISIN코드·국가명이 계산기에 없음(전자신고는 미국 임시값)');
    else {
      o.need('②@' + c, inp.bizRegNo, '② 종목코드 또는 사업자등록번호');
      o.note('② 화면의 사업자등록번호를 찍음 — 상장주식이면 한국거래소 종목코드를 써야 함(계산기에 종목코드 칸 없음)');
    }
    o.set('③@' + c, foreign ? '2' : '1');
    if (foreign) o.set('④@' + c, inp.isSmallMediumCompany ? '62' : '61');
    else if (inp.assetCategory === 'other_asset') o.set('④@' + c, inp.isMajorityNonBusinessLandCorp ? '52' : '51');
    else o.miss('④ 주식등 종류코드', '국내주식 코드(31~35·21~25·41~45·71·74)를 정할 시장 구분(코스피·코스닥·코넥스·비상장)이 계산기에 없음(전자신고는 62 근사)');
    o.set('⑤@' + c, '1');
    o.note('⑤ 양도유형 1(매매) — 국외전출(2)은 따로 있는 국외전출자 계산기라 이 계산 결과는 매매');
    o.set('⑥@' + c, String(Number(inp.acquisitionType || '01') || 1)); // 화면 01~10 = 서식 코드 1~10
    o.miss('⑦⑨⑫ 주식 수·주당 양도가액·주당 취득가액', '계산기는 총액만 받음(전자신고도 0)');
    var x = stockAcqExp(inp, r), tp = x.tp, ap = x.ap, te = x.te;
    o.need('⑧@' + c, inp.transferDate, '⑧ 양도일자').set('⑩@' + c, tp).need('⑪@' + c, inp.acquisitionDate, '⑪ 취득일자').set('⑬@' + c, ap).set('⑭@' + c, te);
    var gain = has(r.양도차익) ? Math.round(n(r.양도차익)) : tp - ap - te;
    o.set('(양도소득금액) 전체 양도소득금액@' + c, gain).set('⑮@' + c, gain);
    o.miss('비과세 양도소득금액·⑯⑰⑱ 감면·과세이연', '계산기에 없음(전자신고 0·ZZZ)');
    o.set('⑩@합계', tp).set('⑬@합계', ap).set('⑭@합계', te).set('(양도소득금액) 전체 양도소득금액@합계', gain).set('⑮@합계', gain);
    o.check('전체 양도소득금액 = ⑩ − ⑬ − ⑭', gain, tp - ap - te);
    if (x.carry) o.note('이월과세(§97의2) 적용 — ⑬은 증여자 취득가액, ⑭에 증여세 상당액 ' + n(r.이월과세_비교.증여세상당액_필요경비산입) + '원 포함(엔진 값에서 되짚음)');
    return o.result();
  };

  // ───── 양도 부표2의2(파생상품등) — lastDerivativeResult_ / 주식등 계산기의 "파생상품등"(ctx.갈래 '주식등') ─────
  M['양도84부표2의2'] = function (ctx) {
    var o = new Out();
    if (ctx && ctx.갈래 === '주식등') {
      var st = ctx.stock || {}, inp = st.input || {}, sr = st.result || {};
      if (!st.input || !st.result) { o.miss('부표2의2 전체', '주식등 계산 결과 없음'); return o.result(); }
      var m = String(inp.transferDate || '').match(/^(\d{4})-/), g = Math.round(n(sr.양도차익)), tp = n(inp.transferPrice), ap = n(inp.acquisitionPrice);
      if (m) o.set('①', m[1]); else o.miss('① 과세대상연도', '양도일 없음');
      o.set('②', String(inp.transferDate || '') && String(inp.transferDate) < '2018-04-01' ? '80' : '81'); // 작성방법 3 — 2018.3.31. 이전 5%(80)·4.1. 이후 10%(81), 엔진 세율과 같음
      o.miss('④ 파생상품 유형', '선물·옵션 등 유형 칸이 계산기에 없음');
      o.set('⑧', tp).set('⑪', ap).set('⑮', g).set('⑧@합계', tp).set('⑪@합계', ap).set('⑮@합계', g);
      o.miss('③⑤⑥⑦⑩ 국내/외·증권사·계좌·수량', '주식등 계산기에 없음');
      o.miss('⑨⑫ 수수료', '화면 양도비용 ' + n(inp.transferExpenses) + '원이 매도·매수 수수료 중 어느 쪽인지 계산기에 없음 — 직접 나눠 적음');
      o.check('⑮ = ⑧ − ⑪ − 양도비용(⑨+⑫)', g, tp - ap - n(inp.transferExpenses));
      return o.result();
    }
    var r = ctx.derivative;
    if (!r) { o.miss('부표2의2 전체', '파생상품 계산 결과 없음'); return o.result(); }
    o.set('⑮@합계', Math.round(n(r.통산손익)));
    o.miss('①~⑮ 종목별 줄', '계산기는 국내·국외 손익 합계 두 값만 받음 — 과세대상연도·세율구분·종목·증권사·계좌·수량·가액은 직접 적어야 함');
    o.note('⑮ 합계 = 국내 ' + Math.round(n(r.국내파생상품손익)) + ' + 국외 ' + Math.round(n(r.국외파생상품손익)) + ' (엔진 통산손익)');
    return o.result();
  };

  // ───── 양도 부표3(취득가액 및 필요경비계산 상세명세서) — 자산마다 한 장(부표1 일련번호와 짝, 전자신고 trAttach3ExpenseRecords_) ─────
  var EXP_ROW = {
    '112': '① 취득세(112)', '113': '① 등록세(113)', '114': '① 법무사비용(114)', '115': '① 취득중개수수료(115)', '116': '① 기타(116)',
    '120': '② 자기가 제조ㆍ생산ㆍ건설한 자산(120)',
    '131': '③ 취득시 쟁송비 — 변호사비용(131)', '132': '③ 취득시 쟁송비 — 기타비용(132)', '133': '③ 매수자부담 양도소득세(133)', '134': '③ 기타(134)',
    '261': '⑥ 개발부담금ㆍ재건축부담금(261)', '271': '⑦ 변호사비용(271)', '272': '⑦ 기타소송ㆍ화해비용(272)', '281': '⑧ 수익자부담금(281)',
    '290': '⑩', '291': '⑪'
  };
  // 명세서(1)에 상호·사업자등록번호·지급일·증빙종류 칸이 있는 줄
  var EXP_HAS_DETAIL = { '114': 1, '115': 1, '116': 1, '120': 1, '131': 1, '134': 1, '271': 1, '290': 1 };
  function expenseItemsOf(asset) {
    var out = [];
    [['acquisitionExpenseItems', 'acquisition'], ['transferExpenseItems', 'transfer']].forEach(function (p) {
      (Array.isArray(asset[p[0]]) ? asset[p[0]] : []).forEach(function (it) {
        var v = n(it.amount); if (!v) return;
        // 코드가 빈 옛 자료는 취득비용 116·양도비용 290(taxcalc.html trExpenseCategoryCode_)
        out.push({ code: String(it.expenseCode || (p[1] === 'transfer' ? '290' : '116')), amount: v, label: it.label || '', payee: it.payee || '',
          bizNo: it.payeeBizRegNo || '', payDate: it.payDate || '', receipt: it.receiptType || '' });
      });
    });
    return out;
  }
  M['양도84부표3'] = function (ctx) {
    var o = new Out(), list = ctx.assets || [];
    var idx = typeof ctx.부표3자산 === 'number' ? ctx.부표3자산 : -1;
    if (idx < 0) list.some(function (it, i) { if (expenseItemsOf(it.asset || {}).length) { idx = i; return true; } return false; });
    var it0 = list[idx];
    if (!it0) { o.miss('부표3 전체', '필요경비 상세 항목이 있는 자산 없음'); return o.result(); }
    var a = it0.asset || {}, items = expenseItemsOf(a);
    if (!items.length) { o.miss('부표3 전체', '이 자산에 필요경비 상세 항목 없음'); return o.result(); }
    o.note('자산 ' + (idx + 1) + (a.assetLocation ? ' (' + a.assetLocation + ')' : '') + ' — 부표1 자산' + (idx + 1) + '과 짝(전자신고 필요경비신고자료일련번호 ' + (idx + 1) + ')');
    var by = {};
    items.forEach(function (x) { (by[x.code] = by[x.code] || []).push(x); });
    function sum(code) { return (by[code] || []).reduce(function (s, x) { return s + x.amount; }, 0); }
    function sumOf(codes) { return codes.reduce(function (s, c) { return s + sum(c); }, 0); }
    Object.keys(EXP_ROW).forEach(function (code) {
      var g = by[code]; if (!g) return;
      var row = EXP_ROW[code];
      o.set(row + '@지급금액', sum(code));
      if (!EXP_HAS_DETAIL[code]) return;
      if (g.length === 1) {
        var x = g[0];
        o.set(row + '@상호', x.payee).set(row + '@사업자등록번호', x.bizNo).set(row + '@지급일', x.payDate).set(row + '@증빙종류', receiptCode(x.receipt));
      } else o.note(row + ' — ' + g.length + '건이라 (1)에는 금액 합계만, 상호·지급일 등은 명세서(2)에');
    });
    if (sum('260')) o.miss('⑥ 자본적지출(260) 세부 줄', '화면은 260 한 가지로 받아 용도변경·엘리베이터·피난시설·원상복구·수선비·기타 중 어느 줄인지 정할 수 없음 — ⑥ 소계와 명세서(2)에만 찍음');
    if (sum('280')) o.miss('⑧ 기타비용(280) 세부 줄', '화면은 280 한 가지로 받아 토지장애철거비·도로시설비·사방사업비·기타 중 어느 줄인지 정할 수 없음 — ⑧ 소계와 명세서(2)에만 찍음');
    var known = Object.keys(EXP_ROW).concat(['260', '280']);
    Object.keys(by).forEach(function (c) { if (known.indexOf(c) < 0) o.miss('구분코드 ' + c, '서식 (1)에 없는 코드 — 명세서(2)에만 찍음'); });
    var ev = it0.ev || evFromSingle(a, it0.single), an = it0.an || acqNec(a, ev);
    var dep = n(a.depreciationDeductedAsBusinessExpense);
    var s1x = sumOf(['112', '113', '114', '115', '116']), s3 = sumOf(['131', '132', '133', '134']);
    var v5 = null;
    if (!ev.ok || an.kind !== '01') o.miss('① 매입가액(111)·① 소계·④·⑤ 계', '취득가액이 실지거래가액이 아님(' + (ev.ok ? ACQ_KIND_LABEL[an.kind] : '엔진 값 없음') + ') — (1) 취득가액 줄은 실지거래가액일 때 씀');
    else if (sum('120')) o.miss('① 매입가액(111)·⑤ 계', '자기가 제조·생산·건설한 자산(120) 항목이 있어 매입(①)·건설(②) 중 어느 쪽 계로 볼지 화면만으로 정할 수 없음');
    else {
      var v111 = Math.round(ev.acq + dep); // 엔진 취득가액은 감가상각비(§97③)를 뺀 값 — ①에는 뺀기 전, ④에 감가상각비
      o.set('① 매입가액(111)@지급금액', v111).set('① 소계@지급금액', v111 + s1x);
      if (dep) o.set('④ 감가상각비(141)@지급금액', dep);
      v5 = v111 + s1x + s3 - dep;
      o.set('⑤ 계@지급금액', v5);
    }
    var s6 = sumOf(['260', '261']), s7 = sumOf(['271', '272']), s8 = sumOf(['280', '281']), s12 = sumOf(['290', '291']);
    o.set('③ 소계@지급금액', s3).set('⑥ 소계@지급금액', s6).set('⑧ 소계@지급금액', s8).set('⑨@지급금액', s6 + s7 + s8)
      .set('⑫@지급금액', s12).set('⑬@지급금액', s6 + s7 + s8 + s12);
    // 명세서(2) — 구분코드 순(전자신고와 같음), 30줄 넘으면 모듈이 다음 장에 이어 찍음
    var rows = items.slice().sort(function (x, y) { return Number(x.code) - Number(y.code); });
    o.set('(2) 구분코드', rows.map(function (x) { return x.code; })).set('(2) 구분', rows.map(function (x) { return x.label; }))
      .set('(2) 상호', rows.map(function (x) { return x.payee; })).set('(2) 사업자등록번호', rows.map(function (x) { return x.bizNo; }))
      .set('(2) 지급일', rows.map(function (x) { return x.payDate; })).set('(2) 지급금액', rows.map(function (x) { return x.amount; }))
      .set('(2) 증빙종류(코드)', rows.map(function (x) { return receiptCode(x.receipt); }));
    if (v5 !== null) o.check('⑤ 계 = 부표1 ⑫ 취득가액', v5, an.acq);
    if (ev.ok && an.kind === '01') o.check('⑬ = 부표1 ⑭ 기타 필요경비', s6 + s7 + s8 + s12, an.nec);
    return o.result();
  };

  // ───── 증여 부표1(증여재산 및 평가명세서) — 이 수증자·증여자에게 배분된 재산(gfAttach1PrintPageHtml_와 같은 배분) ─────
  function artOf(a) { return a.artwork || {}; }
  M['증여10부표1'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, it = ctx.item || {}, rows = ctx.giftAssets || [];
    if (rows.length > 9) o.note('재산 ' + rows.length + '건 — 9줄을 넘는 만큼 모듈이 다음 장에 이어 찍음');
    // [2026.10.20 서식↔엔진 감사 A] 작성방법 1: 이 표의 줄 = 이번 증여재산 → A11(전자신고 gfAttach1AssetRecord_와 같음), 영농 감면 농지는 A14
    if (rows.length) o.set('①', rows.map(function () { return 'A11'; }));
    if (n(r.영농자녀증여농지세액감면) > 0) o.note('① 영농자녀 감면 농지 줄은 A14로 고칠 것(부표1 작성방법 1)');
    o.miss('국외자산 여부·국가명', '계산기에 없음(전자신고 N·ZZ 고정)');
    o.miss('④ 사업자등록번호(지분율)', '사업자등록번호 칸 없음 — 지분율은 배분 비율로 볼지 확인 전(지금 인쇄·전자신고는 100% 고정)');
    if (rows.length) {
      o.set('②', rows.map(function (a) { return a.typeCode || ''; })).set('③', rows.map(function (a) { return a.location || ''; }))
        .set('⑤', rows.map(function (a) { return n(a.area) || ''; })).set('⑦', rows.map(function (a) { return Math.round(n(a.value)); }))
        .set('⑧', rows.map(function (a) { return a.basisCode || ''; }));
      unitCells(o, '⑥', rows);
    } else o.note('재산평가 목록에 이 수증자·증여자에게 배분된 재산이 없음 — 표는 비움(⑨는 증여재산가액)');
    var giftAmount = has(it.amount) ? n(it.amount) : n(r.증여재산가액);
    o.set('⑨', giftAmount).set('⑩', n(r.비과세재산가액)).set('⑪', n(r.공익법인출연재산가액)).set('⑫', n(r.공익신탁재산가액))
      .set('⑬', n(r.장애인신탁재산가액)).set('⑭', (has(r.증여세과세가액) && has(r.순수증여재산가액)) ? Math.max(0, n(r.증여세과세가액) - n(r.순수증여재산가액)) : n(it.priorGiftAmount)); // [2026.10.19 B1]
    o.miss('⑮ 합계', '⑨~⑭를 더하고 빼는 식이 서식·작성방법에 없음');
    if (rows.length) o.check('⑨ 증여재산가액 = ⑦ 평가가액 합', giftAmount, rows.reduce(function (s, a) { return s + Math.round(n(a.value)); }, 0));
    return o.result();
  };

  // ───── 증여 부표2(가업승계 증여세 납부유예 평가·세액 계산명세서) — lastBdDeferralResult_ + bd* 입력칸 ─────
  M['증여10부표2'] = function (ctx) {
    var o = new Out(), b = ctx.bd;
    if (!b) { o.miss('부표2 전체', '가업승계 납부유예(증여, 조특법 §30의7) 계산 결과 없음'); return o.result(); }
    var nb = n(b.nonBiz55) + n(b.nonBiz49) + n(b.nonBiz61) + n(b.excessCash) + n(b.nonBizStock);
    var tot = n(b.totalAsset), rel = Math.max(0, tot - nb), defer = n(b.result && b.result.납부유예금액);
    if (n(b.stockValue)) o.set('①', n(b.stockValue)); else o.miss('① 증여일 현재 주식 등의 가액', '화면 "가업 주식등의 가액" 칸이 비어 있음');
    o.set('②', tot).set('㉮', n(b.nonBiz55)).set('㉯', n(b.nonBiz49)).set('㉰', n(b.nonBiz61)).set('㉱', n(b.excessCash)).set('㉲', n(b.nonBizStock))
      .set('③', nb).set('④', rel);
    if (tot) o.set('⑤', pct2(rel / tot)); else o.miss('⑤ 사업관련 자산가액 비율', '② 총자산가액 0');
    o.set('⑥', n(b.businessValue)).set('⑦', n(b.totalValue)).set('⑧', n(b.taxPayable)).set('⑨', defer);
    o.note('⑧은 화면 칸(bdTaxPayable, 이름 "산출세액") 값 — 엔진이 ⑨ 계산에 쓴 값과 같음(서식 이름은 "증여세 납부세액")');
    o.check('④ = ② − ③', rel, tot - nb);
    if (n(b.stockValue) && tot) o.check('⑥ = ① × ⑤', n(b.businessValue), Math.round(n(b.stockValue) * rel / tot)); // [2026.10.19 A2]
    if (n(b.totalValue)) o.check('⑨ = ⑧ × ⑥ ÷ ⑦', defer, Math.round(n(b.taxPayable) * n(b.businessValue) / n(b.totalValue)));
    return o.result();
  };

  // ───── 증여 부표3(혼인 및 출산 증여재산 공제 명세서) — gfMarriageBirthPrintPageHtml_와 같은 값 ─────
  M['증여10부표3'] = function (ctx) {
    var o = new Out(), mb = ctx.mbDetail, r = ctx.r || {};
    if (!mb || !(n(mb.thisTime) || n(r.혼인출산증여재산공제))) { o.miss('부표3 전체', '혼인·출산 증여재산공제 없음'); return o.result(); }
    var cur = mb.cur || { marriage: 0, birth: 0 }, prior = n(mb.prior), gift = n(mb.giftAmount);
    var m = n(cur.marriage), b = n(cur.birth);
    if (m) o.need('①@1', mb.marriageDate, '① 혼인신고(예정)일').need('②@1', mb.giftDate, '② 증여일자');
    if (b) o.need('⑤@1', mb.birthDate, '⑤ 출생일·입양신고일').need('⑥@1', mb.giftDate, '⑥ 증여일자');
    if (m && !b) { o.set('③@1', gift); if (!prior) o.set('④', gift); }
    else if (b && !m) { o.set('⑦@1', gift); if (!prior) o.set('⑧', gift); }
    else if (!m && !b) o.miss('③④⑦⑧ 이번 증여', '이번 증여는 혼인·출산 공제 없음 — 같은 증여자 기존 공제만 다시 공제(⑯⑰, §47② 합산)');
    else o.miss('③④⑦⑧ 증여재산가액', '혼인·출산 둘 다 해당 — 이번 증여재산가액을 혼인분·출산분으로 나눈 값이 계산기에 없음(공제액만 나눔)');
    if (prior) o.miss('④⑧ 합계·2~5번째 증여 칸', '기존에 혼인·출산 공제를 받은 증여(' + prior + '원)가 있음 — 그 증여 건별 날짜·가액이 계산기에 없음');
    // [2026.10.20 AI 회의 회장 결론 J08(다)] ⑨⑩ = 10년 안 기존 공제(모든 증여자 — ⑬ 1억 한도용, §53의2), ⑪⑫ = 10년 넘은 것,
    //  ⑬ = 1억 − (⑨+⑩+⑪+⑫), ⑯⑰ = 같은 증여자분(§47② 합산 대상, 엔진 혼인출산증여재산공제_같은증여자기공제) + ⑭⑮ — 본표 ㉙와 같게.
    var pp = mb.priorParts || { w9: 0, w10: 0, w11: 0, w12: 0, total: prior, sameMarriage: 0, sameBirth: 0, otherWithin10: 0, room: Math.max(0, 100000000 - prior) };
    o.set('⑨', n(pp.w9)).set('⑩', n(pp.w10)).set('⑪', n(pp.w11)).set('⑫', n(pp.w12));
    var room = Math.max(0, 100000000 - (n(pp.w9) + n(pp.w10) + n(pp.w11) + n(pp.w12)));
    o.set('⑬', room).set('⑭', m).set('⑮', b);
    o.set('⑯', n(pp.sameMarriage) + m).set('⑰', n(pp.sameBirth) + b);
    if (n(pp.otherWithin10) > 0) o.note('비고에 적을 것: ⑨⑩ 중 다른 증여자분 ' + n(pp.otherWithin10).toLocaleString('ko-KR') + '원은 §47② 합산 대상이 아님(⑯⑰에 더하지 않음)');
    if (n(r.혼인출산증여재산공제)) o.check('⑯ + ⑰ = 본표 ㉙ 혼인·출산 공제(엔진)', n(pp.sameMarriage) + m + n(pp.sameBirth) + b, n(r.혼인출산증여재산공제));
    o.note('③·⑦ 증여재산가액은 이번 증여의 증여재산가액(지금 인쇄는 공제액을 찍었음 — 서식 칸 이름대로 고침)');
    o.check('⑭ + ⑮ ≤ ⑬', Math.min(m + b, room), m + b);
    o.check('⑭ + ⑮ = 이번 혼인·출산 공제액(엔진)', m + b, n(mb.thisTime));
    return o.result();
  };

  // ───── 증여 부표4(혼인 증여재산 공제 추징사유 신고 및 자진납부 계산서) — ckFormType 'gf_marriage' + lastClawbackResult_ ─────
  M['증여10부표4'] = function (ctx) {
    var o = new Out(), cw = ctx.clawback || {}, cr = cw.result, dn = ctx.donee || {}, dr = ctx.donor || {}, ta = ctx.taxAgent || {};
    if (!cr || cw.formType !== 'gf_marriage') { o.miss('부표4 전체', '사후관리 추징이자 계산(서식 구분: 혼인출산 증여재산공제 추징) 결과 없음'); return o.result(); }
    o.need('①', dn.name, '① 수증자 성명').need('②', dn.regNo, '② 수증자 주민등록번호').set('③', dn.resident === 'nonresident' ? '비거주자' : '거주자')
      .need('④', fullAddr(dn), '④ 수증자 주소').set('⑤', dn.email);
    if (has(dn.phone)) o.set(isMobile(dn.phone) ? '⑥~전화번호(휴대전화) (수증자)' : '⑥~전화번호(자택) (수증자)', dn.phone);
    else o.miss('⑥ 수증자 전화번호', '화면 입력 없음');
    var rw4_ = relWord(ctx.relation, ctx.genSkip, dn.regNo);
    if (rw4_) o.set('⑦', rw4_); else o.miss('⑦ 증여자와의 관계', '관계가 기타친족·그 밖의 자이거나 증여 계산 결과 없음 — 직접 적을 것(부표4 작성방법 3: 수증자 기준)');
    o.need('⑧', dr.name, '⑧ 증여자 성명').need('⑨', dr.regNo, '⑨ 증여자 주민등록번호').need('⑩', ctx.giftDate, '⑩ 증여일자').need('⑪', fullAddr(dr), '⑪ 증여자 주소');
    o.miss('⑫ 증여자 전화번호', '증여자 카드에 전화 칸 없음');
    o.miss('⑬~⑲ 추징 대상 증여재산 명세', '계산기에 부표4용 재산 입력 없음(추징 대상은 혼인·출산 공제를 받은 지난 증여분)');
    o.need('⑳', cw.reason, '⑳ 수정신고·기한 후 신고 코드(ckMarriageReason)');
    var tax = n(cr.추징세액), ic = interestCells(cr, 'daily');
    o.set('㉑', tax);
    if (ic) { o.set('㉒', ic.days).set('㉓', ic.rate); if (!ic.single) o.note('㉒·㉓ 이자율이 바뀐 기간이 있어 구간별로 적음(일수 ' + ic.days + ')'); }
    else o.miss('㉒㉓ 일수·이자율', '이자 구간 없음');
    if (cr.이자율방식 && cr.이자율방식 !== 'daily') o.note('이자율 방식이 1일 고정율이 아님(' + (cr.이자율방식_설명 || cr.이자율방식) + ') — 혼인·출산 공제 추징(상증법 §53의2)은 1일 10만분의 22');
    o.set('㉔', n(cr.이자상당액_합계)).set('㉕', n(cr.납부할세액));
    if (ic && ic.single) o.check('㉔ = ㉑ × ㉒ × ㉓', n(cr.이자상당액_합계), interestRecalc(tax, ic.seg));
    o.check('㉕ = ㉑ + ㉔', n(cr.납부할세액), tax + n(cr.이자상당액_합계));
    dateParts(o, ctx.신고일 || cr.신고일, '서명~신고일 — 년', '서명~신고일 — 월', '서명~신고일 — 일');
    if (!ctx.신고일 && cr.신고일) o.note('신고일 = 추징이자 계산의 끝나는 날(수정신고·기한 후 신고를 한 날, 시행령 §46④)');
    o.set('서명~신고인 성명(서명란)', dn.name);
    if (has(ta.name)) o.set('서명~세무대리인 성명(서명란)', ta.name).set('서명~세무대리인 관리번호', ta.mgmtNo).set('서명~세무대리인 전화번호', ta.phone);
    o.set('서명~관할 세무서 이름("세무서장" 앞)', officeName(dn.taxOffice));
    return o.result();
  };

  // ───── 증여 부표5(서화·골동품 등 증여재산 명세서) — 이 수증자에게 배분된 서화·골동품 ─────
  function artRows(o, rows, who) {
    o.set('①', rows.map(function (x, i) { return String(i + 1); })).set('②', rows.map(function (x) { return (who(x) || {}).name || ''; }))
      .set('③', rows.map(function (x) { return (who(x) || {}).regNo || ''; }))
      .set('④', rows.map(function (x) { return artOf(x.a).code || ''; })).set('⑤', rows.map(function (x) { return artOf(x.a).artist || ''; }))
      .set('⑥', rows.map(function (x) { return artOf(x.a).title || ''; })).set('⑦', rows.map(function (x) { return artOf(x.a).year ? String(artOf(x.a).year) : ''; }))
      .set('⑧', rows.map(function (x) { return artOf(x.a).material || ''; })).set('⑨', rows.map(function (x) { return artOf(x.a).size || ''; }))
      .set('⑩', rows.map(function (x) { return Math.round(n(x.value)); }));
  }
  M['증여10부표5'] = function (ctx) {
    var o = new Out(), dn = ctx.donee || {};
    var arts = (ctx.giftAssets || []).filter(function (a) { return a.method === 'artwork'; }).map(function (a) { return { a: a, value: a.value }; });
    if (!arts.length) { o.miss('부표5 전체', '서화·골동품 재산 없음'); return o.result(); }
    artRows(o, arts, function () { return dn; });
    if (arts.length > 20) o.note('작품 ' + arts.length + '점 — 20줄을 넘는 만큼 모듈이 다음 장에 이어 찍음');
    o.note('⑩ 평가가액은 이 수증자·증여자 배분 비율을 곱한 값(부표1 ⑦과 같음 — 지금 인쇄는 배분 전 전액)');
    return o.result();
  };

  // ───── 증여 부표6(공익법인 등 관련 가산세 명세서) ─────
  var PO_ROWS = {
    '①': '출연재산보고서 등 제출의무 불성실 가산세', '②': '주식 등 초과보유 가산세', '③': '외부전문가 세무확인 보고의무 불성실 가산세',
    '④': '장부 작성·비치 의무 미이행 가산세', '⑤': '회계감사 등 의무 미이행 가산세', '⑥': '이사·임직원 취임제한 가산세',
    '⑦': '계열기업의 주식보유 한도 초과 가산세', '⑧': '특정기업의 광고 등 행위 금지 가산세', '⑨': '출연재산 운용소득 미달 사용 가산세',
    '⑩': '출연재산 매각대금 미달 사용 가산세', '⑪a': '출연재산 의무사용 기준금액 미달 가산세 — 일반(10/100)',
    '⑪b': '출연재산 의무사용 기준금액 미달 가산세 — 동일 내국법인 의결권 주식 5% 초과 보유 주식보유의무이행신고 대상 공익법인 등(200/100)',
    '⑫': '전용계좌 미사용 가산세', '⑬': '전용계좌 미신고 가산세', '⑭': '공시의무 불이행 가산세', '⑮': '주식보유 의무이행 미신고 가산세'
  };
  // 공익법인 가산세 계산기(calculatePublicInterestOrgPenaltyJS) penaltyType → 서식 줄
  var PO_TYPE_ROW = { report_not_filed: '①', stock_holding_exceeded_5pct: '②', tax_confirmation: '③', bookkeeping: '④', audit: '⑤', director_excess: '⑥',
    stock_holding_exceeded_related: '⑦', advertising: '⑧', dedicated_account_unused: '⑫', dedicated_account_not_opened: '⑬', disclosure_violation: '⑭', report_not_filed_5pct: '⑮' };
  function poRowOf(it) {
    if (it.row) return it.row;
    if (it.penaltyType === 'management_violation') return PO_TYPE_ROW[it.violationSubType] || null;
    if (it.penaltyType === 'income_underused') return it.incomeKind === 1 ? '⑨' : it.incomeKind === 2 ? '⑩' : it.incomeKind === 3 ? (it.highHolding ? '⑪b' : '⑪a') : null;
    return PO_TYPE_ROW[it.penaltyType] || null;
  }
  M['증여10부표6'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, total = n(r.공익법인등관련가산세), items = ctx.publicOrgPenaltyItems || [];
    if (!items.length) {
      o.miss('①~⑮ 항목별 기준금액·가산세액', '계산기는 항목별 결과를 남기지 않고 합계(' + total + '원, 본표 ㊾ giftPublicOrgPenalty)에 더해 두기만 함 — 항목을 직접 적어야 함(ctx.publicOrgPenaltyItems로 넘기면 찍음)');
      return o.result();
    }
    var acc = {}, sum = 0;
    items.forEach(function (it) {
      var row = poRowOf(it);
      if (!row || !PO_ROWS[row]) { o.miss('가산세 항목', '서식 줄을 정할 수 없는 항목: ' + (it.penaltyType || '') + (it.violationSubType ? '/' + it.violationSubType : '')); return; }
      var a = acc[row] = acc[row] || { base: 0, amt: 0, hasBase: false };
      if (has(it.base)) { a.base += n(it.base); a.hasBase = true; }
      a.amt += n(it.amount); sum += n(it.amount);
    });
    Object.keys(acc).forEach(function (row) {
      var lab = row.replace(/[ab]$/, '') + '~' + PO_ROWS[row];
      if (acc[row].hasBase) o.set(lab + ' — 기준금액', acc[row].base);
      o.set(lab + ' — 가산세액', acc[row].amt);
    });
    o.check('가산세액 합 = 본표 ㊾ 공익법인 등 관련 가산세', total, sum);
    return o.result();
  };

  // ───── 상속 부표2(상속인별 상속재산 및 평가명세서) — 상속인마다 한 장(ctx.부표2상속인) ─────
  function allocOf(a, hi) { return (a.alloc || []).reduce(function (s, al) { return s + (String(al.heirIdx) === String(hi) ? n(al.ratio) : 0); }, 0); }
  M['상속9호부표2'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, fv = fvOf(ctx), heirs = ctx.heirs || [];
    var hi = typeof ctx.부표2상속인 === 'number' ? ctx.부표2상속인 : 0, h = heirs[hi];
    if (!h) { o.miss('부표2 전체', '상속인 명부 없음'); return o.result(); }
    o.need('①', h.relation, '① 피상속인과의 관계').need('②', h.name, '② 성명').need('③', h.regNo, '③ 주민등록번호').need('④', fullAddr(h), '④ 주소');
    var legal = fracNum(h.statutoryShareRatio);
    // 작성방법 3: ⑥ = (부표1 ⑫ + ㉕ − 상속인 아닌 수유자 유증 등 − ⑬ − ㉒ − ㉔) × ⑤
    var gross = has(ctx.grossEstate) ? n(ctx.grossEstate) : n(ctx.valuationTotal);
    var b12 = gross + presumedAll(r), b25 = fv.priorGiftAdded !== null ? fv.priorGiftAdded : null;
    if (legal !== null) {
      o.set('⑤', pct2(legal));
      if (b25 !== null) {
        o.set('⑥', Math.round((b12 + b25 - n(ctx.nonHeirBequest) - n(r.비과세재산가액) - n(ctx.duesTotal) - n(ctx.debtTotal)) * legal));
        // [2026.10.19 B2] 예전 인쇄·전자신고도 같은 식으로 고침(ihLegalShareBase_)
      } else o.miss('⑥ 법정상속재산가액', '가산하는 증여재산가액(fv.priorGiftAdded) 없음');
    } else o.miss('⑤⑥ 법정상속지분율·재산가액', '상속인 명부 법정지분 없음');
    var actual = Math.round(n(h.actualValue));
    if (n(ctx.valuationTotal)) o.set('⑦', pct2(actual / n(ctx.valuationTotal)));
    else o.miss('⑦ 실제상속지분율', '재산평가 합계 0');
    o.set('⑧', actual);
    var rows = [];
    (ctx.valAssets || []).forEach(function (a) { var q = allocOf(a, hi); if (q > 0) rows.push({ a: a, q: q, value: Math.round(n(a.value) * q) }); });
    o.miss('⑨ 재산구분 코드', '계산기에 재산구분 칸 없음(전자신고는 A11 고정)');
    o.miss('⑪ 국외자산 여부·국가명', '계산기에 없음(전자신고 N·ZZ 고정)');
    o.miss('⑫ 사업자등록번호(계좌번호, 지분)', '계산기에 없음');
    if (rows.length) {
      o.set('⑩', rows.map(function (x) { return x.a.typeCode || ''; })).set('⑪~소재지·법인명 등', rows.map(function (x) { return x.a.location || ''; }))
        .set('⑬', rows.map(function (x) { return n(x.a.area) || ''; })).set('⑮', rows.map(function (x) { return x.value; }))
        .set('⑯', rows.map(function (x) { return x.a.basisCode || ''; }));
      unitCells(o, '⑭', rows.map(function (x) { return x.q === 1 ? x.a : { value: -1 }; }));
      var s15 = rows.reduce(function (s, x) { return s + x.value; }, 0);
      o.check('⑧ = ⑮ 합(원 미만 반올림 차이는 맞음으로 봄)', actual, Math.abs(s15 - actual) <= rows.length ? actual : s15);
    } else o.note('재산평가 목록에서 이 상속인에게 배분된 재산이 없음 — "나" 표는 비움');
    o.set('⑰', actual);
    // ⑱~㉗ 상속인별 나눔은 계산기에 없음(전자신고 0) — 전체 금액이 0이면 누구 몫이든 0이 확실하므로 0, 아니면 비움
    var zero = true;
    function zeroIf(keys, total, why) { if (!total) keys.forEach(function (k) { o.set(k, 0); }); else { zero = false; o.miss(keys.join(''), why + '(전체 ' + total + '원) — 상속인별 나눔이 계산기에 없음'); } }
    zeroIf(['⑱'], presumedAll(r), '상속개시전 처분재산 산입액');
    zeroIf(['⑲', '⑳', '㉑'], n(r.비과세재산가액), '비과세 재산가액');
    zeroIf(['㉒'], n(ctx.publicOrg), '공익법인 출연재산');
    zeroIf(['㉓'], n(ctx.publicTrust), '공익신탁 재산');
    o.set('㉔', 0);
    if (b25 === null) { zero = false; o.miss('㉕㉖㉗', '가산하는 증여재산가액(fv.priorGiftAdded) 없음'); }
    else zeroIf(['㉕', '㉖', '㉗'], b25, '가산하는 증여재산가액');
    o.note('㉔ 기타 불산입은 계산기 과세가액 계산에 없는 항목이라 0(있으면 세액부터 다시 계산해야 함)');
    if (zero) o.set('㉘', actual); else o.miss('㉘ 합계', '⑱~㉗ 중 비운 칸이 있고 합계 식이 서식에 없음');
    return o.result();
  };

  // ───── 상속 부표3의2(배우자 상속공제 명세서) ─────
  M['상속9호부표3의2'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, sp = ctx.spouse;
    if (!sp) { o.miss('부표3의2 전체', '상속인 명부에 배우자 없음'); return o.result(); }
    var v1 = Math.round(n(sp.estateValue)), v2 = Math.round(n(sp.assumedDebt)), v3 = Math.round(n(sp.nonTaxable)), v4 = Math.round(n(sp.actual));
    o.set('①', v1).set('②', v2).set('③', v3).set('④', v4);
    o.check('④ = ① − ② − ③', v4, Math.max(0, v1 - v2 - v3));
    var grossKnown = n(ctx.grossEstate) > 0 || n(ctx.valuationTotal) > 0 || (ctx.assets || []).length > 0; // [2026.10.19] 재산 목록 없으면 ⑤⑨ 비움
    var gross = has(ctx.grossEstate) ? n(ctx.grossEstate) : n(ctx.valuationTotal);
    var v5 = gross + presumedAll(r), v6 = n(r.비과세재산가액);
    // [2026.10.19 법령 우선 → 2026.10.20 AI 회의 회장 결론 J06(가)로 확정, 판단 대기 J1 내림] 서식 작성방법 3은 ⑦에 부표1 ㉑(공과금+장례비용+채무)을
    //  옮기라 하지만, 시행령 §17①2호는 "법 제14조의 규정에 의한 공과금 및 채무"만 뺀다(§14①이 공과금·장례비용·채무를 따로 열거, 집행기준 19-17-2
    //  "장례비는 차감하지 않음") — 엔진(배우자공제 한도)도 장례비를 빼지 않으므로 ⑦은 공과금+채무로 찍어 ⑨·⑭가 엔진과 맞게 한다.
    var funeral = n(r.장례비용공제);
    var v7 = n(ctx.duesTotal) + n(ctx.debtTotal), v8 = n(ctx.publicOrg) + n(ctx.publicTrust);
    var v9 = v5 - v6 - v7 - v8, v10 = n(sp.nonHeirBequest), v11 = n(sp.giftToHeirs), ratio = n(sp.ratio), v13 = n(sp.giftBase);
    if (grossKnown) o.set('⑤', v5).set('⑨', v9); else o.miss('⑤⑨ 상속재산 가액', '재산평가 목록이 없음(계산기에 과세가액만 입력) — 출력물에 직접 적으세요');
    o.set('⑥', v6).set('⑦', v7).set('⑧', v8).set('⑩', v10).set('⑪', v11).set('⑫', pct2(ratio)).set('⑬', v13);
    if (funeral > 0) o.note('부표3의2 ⑦: 공과금·채무만 적고 장례비용(' + funeral.toLocaleString('ko-KR') + '원)은 넣지 않았습니다 — 비고에 "상증법 시행령 §17①2호·집행기준 19-17-2"를 적으세요(서식 작성방법 3의 부표1 ㉑ 전체보다 법령 우선)');
    var limitCalc = Math.max(0, Math.floor((v9 - v10 + v11) * ratio - v13));
    var lim = (has(r.배우자공제한도액) ? n(r.배우자공제한도액) : limitCalc);
    o.set('⑭', Math.min(lim, 3000000000)).set('⑮', n(r.배우자공제));
    if (grossKnown) o.check('⑨(서식 식) = 엔진 한도 계산의 상속재산 가액(과세가액 − 가산한 사전증여)', v9, n(r.상속세과세가액_적용값) - n(sp.priorGiftedIncluded));
    if (grossKnown) o.check('⑭ = min((⑨ − ⑩ + ⑪) × ⑫ − ⑬, 30억)', Math.min(lim, 3000000000), Math.min(limitCalc, 3000000000));
    if (sp.divided === false) o.note('배우자상속재산 미분할 — §19②③ 최소 5억원만 인정');
    return o.result();
  };

  // ───── 상속 부표4(갑)(상속개시전 1(2)년 이내 처분재산·채무부담내역) — inheritanceDisposalItems + 결과 상속개시전처분재산_추정내역 ─────
  var DISP_ROW = { '현금·예금·유가증권': ['재산', 0], '부동산': ['재산', 1], '기타재산': ['재산', 2], '부담채무Ⅰ(국가·지자체·금융기관)': ['채무', 0], '부담채무Ⅱ(그 외)': ['채무', 1] };
  function dispCalc(d, period) {
    var amt = period === 1 ? d.oneYearAmount : d.twoYearAmount, dep = period === 1 ? d.oneYearSelfDeposit : d.twoYearSelfDeposit, ex = period === 1 ? d.oneYearExplained : d.twoYearExplained;
    var net = Math.max(0, n(amt) - n(dep)), th = period === 1 ? 200000000 : 500000000;
    var un = Math.max(0, net - n(ex)), cut = Math.min(net * 0.2, 200000000);
    return { net: net, ex: n(ex), un: un, cut: Math.round(cut), met: net >= th, pres: net >= th && un >= cut ? Math.round(un - cut) : 0 };
  }
  // [2026.10.20 AI 회의 회장 결론 J05] 상증법 §15 추정상속재산 전체 = ①(처분·인출·채무부담, 엔진 상속개시전처분재산_추정합계) + ②(변제의무 미입증 채무, 가공채무추정_재산입액)
  function presumedAll(r) { return n(r.상속개시전처분재산_추정합계) + n(r.가공채무추정_재산입액); }
  M['상속9호부표4갑'] = function (ctx) {
    var o = new Out(), r = ctx.r || {};
    var items = (ctx.disposalItems || []).filter(function (d) { return n(d.oneYearAmount) > 0 || n(d.twoYearAmount) > 0; });
    var fict = Math.round(n(r.가공채무추정_재산입액)); // §15② — 기준·차감 없이 전액
    if (!items.length && !fict) { o.miss('부표4(갑) 전체', '상속개시전 처분재산·채무부담 입력 없음'); return o.result(); }
    var detail = r.상속개시전처분재산_추정내역 || [];
    var T = { 재산: { k: ['②', '③', '④', '⑤', '⑥', '⑦', '⑧'], rows: 3 }, 채무: { k: ['⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰'], rows: 2 } };
    var V = {}, used = {};
    ['재산', '채무'].forEach(function (t) { T[t].k.forEach(function (k) { V[k] = []; for (var i = 0; i < T[t].rows; i++) V[k].push(''); }); });
    var sumP = { 재산: 0, 채무: 0 };
    items.forEach(function (d, i) {
      var pos = DISP_ROW[d.category];
      if (!pos) { o.miss('처분재산 ' + (i + 1) + '번 줄', '재산종류를 고르지 않음 — 서식 줄을 정할 수 없음'); return; }
      var key = pos[0] + pos[1];
      if (used[key]) { o.miss(d.category + ' 줄', '같은 재산종류가 여러 줄 — 서식은 종류마다 한 줄(합치는 법 확인 전 첫 줄만)'); return; }
      used[key] = 1;
      var c1 = dispCalc(d, 1), c2 = dispCalc(d, 2);
      // 1(2)년 — 엔진 추정액(1년·2년 중 큰 값)이 나온 기간, 둘 다 0이면 금액 기준을 넘은 기간, 그것도 없으면 1년
      var p = c2.pres > c1.pres ? 2 : c1.pres > 0 ? 1 : c1.met ? 1 : c2.met ? 2 : (n(d.oneYearAmount) > 0 ? 1 : 2), c = p === 1 ? c1 : c2;
      var est = detail[i] && has(detail[i].추정상속재산가액) ? Math.round(n(detail[i].추정상속재산가액)) : Math.max(c1.pres, c2.pres);
      var k = T[pos[0]].k, ri = pos[1], isII = d.category === '부담채무Ⅱ(그 외)';
      V[k[0]][ri] = c.net; V[k[2]][ri] = c.ex; V[k[3]][ri] = c.un;
      if (!isII) { V[k[1]][ri] = c.met ? '여' : '부'; V[k[4]][ri] = c.cut; }
      V[k[5]][ri] = isII ? (est > 0 ? '여' : '부') : (c.met && c.un > c.cut ? '여' : '부');
      V[k[6]][ri] = est; sumP[pos[0]] += est;
      o.note(d.category + ' — ' + p + '년 이내 기준으로 적음(1년 ' + c1.net + '원·2년 ' + c2.net + '원, 내돈입금 뺀 금액)');
      if (!isII) {
        if (c.met && c.un === c.cut) o.note(d.category + ' — 미소명금액 = 차감가액: 서식 "⑤ > ⑥"이면 부, 시행령 §11④ "이상"이면 여(추정액 0) — 서식대로 부로 적음');
        o.check(d.category + ' 추정상속재산가액 = 미소명 − 차감가액(추정일 때)', est, Math.max(c1.pres, c2.pres));
      } else {
        // [2026.10.20 회장 결론 J05] Ⅱ 줄 ⑰ = 법 기준 추정액(§15①2호분 + 아래 §15②분). 회색 칸 ⑫·⑮는 비우고 §15①2호 산식은 별지(명세)에 적는다.
        o.note('부담채무Ⅱ ⑰ 별지(명세)에 적을 산식 — 상증법 §15①2호·시행령 §11④: ' + p + '년 이내 채무부담액 ' + c.net.toLocaleString('ko-KR') + '원(기준 ' + (p === 1 ? '2억' : '5억') + '원 ' + (c.met ? '이상' : '미만') + ') − 용도 소명 ' + c.ex.toLocaleString('ko-KR') + '원 = 미소명 ' + c.un.toLocaleString('ko-KR') + '원' + (c.met ? ' − MIN(채무부담액 × 20%, 2억원) ' + c.cut.toLocaleString('ko-KR') + '원' : '') + ' = 추정 ' + est.toLocaleString('ko-KR') + '원');
        o.check(d.category + ' 추정상속재산가액 = 미소명 − 차감가액(추정일 때)', est, Math.max(c1.pres, c2.pres));
      }
    });
    if (fict > 0) {
      V['⑰'][1] = (V['⑰'][1] === '' ? 0 : n(V['⑰'][1])) + fict; V['⑯'][1] = '여'; sumP.채무 += fict;
      o.note('부담채무Ⅱ ⑰에 상속인이 갚을 의무가 입증되지 않은 채무(상증법 §15②·시행령 §11③, 기준·차감 없이 전액) ' + fict.toLocaleString('ko-KR') + '원을 더해 적음 — §15①2호분과 나눠 별지(명세)에 적으세요');
    }
    // 부담채무Ⅱ 줄은 ⑫·⑮가 서식에서 막혀 있음 → ⑫는 1줄, ⑮는 한 칸
    V['⑫'] = V['⑫'].slice(0, 1); V['⑮'] = V['⑮'][0];
    Object.keys(V).forEach(function (k) { var v = V[k]; if (Array.isArray(v) ? v.some(function (x) { return x !== ''; }) : v !== '') o.set(k, v); });
    o.set('⑨', sumP.재산).set('⑱', sumP.채무).set('다', sumP.재산 + sumP.채무);
    o.check('다 = ⑨ + ⑱ = 부표1 ⑪(엔진 상속개시전처분재산_추정합계 + 가공채무추정_재산입액)', sumP.재산 + sumP.채무, presumedAll(r));
    return o.result();
  };

  // ───── 상속 부표4(을)(사용처 소명명세서) — 건별 처분·사용처 내역 ─────
  M['상속9호부표4을'] = function (ctx) {
    var o = new Out();
    o.miss('①~㉒ 건별 처분·차입·사용처 내역', '계산기는 재산종류별 합계(부표4(갑))만 받음 — 처분일·사용처·거래상대방 등 건별 내역은 직접 적어야 함');
    o.note('부표4(갑)과 함께 내는 서식이라 빈 원본으로 붙임');
    return o.result();
  };

  // ───── 상속 부표5(영리법인 상속세 면제 및 납부 명세서) ─────
  M['상속9호부표5'] = function (ctx) {
    var o = new Out(), r = ctx.r || {}, beq = n(ctx.forProfitBequest), ex = n(ctx.forProfitExempted), ratio = n(ctx.forProfitRatio);
    if (!beq) { o.miss('부표5 전체', '영리법인 유증 등 재산가액 없음'); return o.result(); }
    o.miss('①②③ 영리법인 법인명·사업자등록번호·사업장 소재지', '계산기에 없음');
    o.set('④', beq).set('⑤', ex).set('⑥', Math.round(beq * 0.1));
    o.note('⑤ 면제세액은 화면에 직접 입력한 값(계산기가 계산하지 않음)');
    // [2026.10.20 AI 회의 회장 결론 J07] 상증법 §3의2②(2025.12.23. 개정, 2026.1.1. 시행)·시행령 §3② — 상속인·상속인의 배우자·직계비속·
    //  직계비속의 배우자가 "각자의" 지분상당액을 낸다. 서식(2020.3.13.판) ⑦ 구분엔 상속인·직계비속만 있지만, 같은 줄 형식을 사람마다 써서 ⑦에
    //  "상속인의 배우자"처럼 적고 ⑩·⑪을 따로 적는다(합쳐 적기는 남의 납부의무를 상속인 몫으로 적는 셈이라 안 씀). 5줄이 넘으면 이어지는 장.
    var payers = (ctx.forProfitPayers || []).filter(function (p) { return p && (has(p.name) || n(p.ratio) > 0); });
    var total = n(r.영리법인면제분납부세액), base = ex - beq * 0.1;
    if (payers.length) {
      var amts = payers.map(function (p) { return Math.max(0, Math.round(base * n(p.ratio))); });
      var sumR = payers.reduce(function (s, p) { return s + n(p.ratio); }, 0);
      // 사람별 원 미만 반올림 합이 본표 ㊱(엔진 합계)과 1~2원 다르면 마지막 줄에서 맞춘다
      var diff = total - amts.reduce(function (s, a) { return s + a; }, 0);
      if (diff && Math.abs(diff) <= payers.length && Math.abs(sumR - ratio) < 1e-6) { amts[amts.length - 1] += diff; o.note('⑪ 사람별 원 미만 반올림 차이 ' + diff + '원을 마지막 줄에서 맞춤(계 = 본표 ㊱)'); }
      o.set('⑦', payers.map(function (p) { return p.kind || '상속인'; })).set('⑧', payers.map(function (p) { return p.name || ''; }))
        .set('⑨', payers.map(function (p) { return p.regNo || ''; })).set('⑩', payers.map(function (p) { return pct2(n(p.ratio)); })).set('⑪', amts);
      o.check('계 ⑩ = 사람별 ⑩ 합(화면 지분 상당 비율과 같음)', pct2(ratio), pct2(sumR));
      if (payers.some(function (p) { return /배우자/.test(p.kind || ''); })) o.note('⑦ 구분에 "상속인의 배우자"·"직계비속의 배우자"를 적은 줄은 상증법 §3의2②(2025.12.23. 개정)로 더해진 납부의무자 — 서식(2020.3.13.판)에 그 구분이 아직 없어 같은 줄 형식으로 적음');
    } else o.miss('⑦~⑪ 사람별 줄', '화면 "영리법인 면제분 납부의무자"에 사람을 넣지 않음 — 계 줄에만 찍음');
    o.set('계~계 — ⑩ 지분율 합', pct2(ratio)).set('계~계 — ⑪ 면제분 납부세액 합(= 본표 ㊱)', total);
    o.check('계 ⑪ = (⑤ − ⑥) × 계 ⑩', n(r.영리법인면제분납부세액), Math.max(0, Math.round((ex - beq * 0.1) * ratio)));
    return o.result();
  };

  // ───── 상속 부표6·7 공통(신고인·피상속인·서명) ─────
  function ihClawHead(o, ctx, deathKey) {
    var rp = ctx.reporter || {}, dc = ctx.deceased || {};
    o.need('①', rp.name, '① 신고인 성명').need('②', rp.regNo, '② 신고인 주민등록번호').set('피상속인과의 관계', rp.relation)
      .need('③', fullAddr(rp), '③ 신고인 주소').set('전자우편주소', ctx.email)
      .need('④', dc.name, '④ 피상속인 성명').need('⑤', dc.regNo, '⑤ 피상속인 주민등록번호').need('⑥', dc.address, '⑥ 피상속인 주소')
      .need(deathKey, dc.deathDate, deathKey + ' 상속개시일');
  }
  function ihClawSign(o, ctx) {
    var rp = ctx.reporter || {}, dc = ctx.deceased || {}, ta = ctx.taxAgent || {};
    dateParts(o, ctx.신고일, '제출일~제출 연도("년" 앞)', '제출일~제출 월', '제출일~제출 일', '제출일');
    o.set('신고인(서명)', rp.name);
    if (has(ta.name)) o.set('세무대리인(서명)', ta.name).set('관리번호·전화~세무대리인 관리번호', ta.mgmtNo).set('관리번호·전화~세무대리인 전화번호', ta.phone);
    o.set('세무서장', officeName(dc.taxOffice));
  }
  // ───── 상속 부표6(가업(영농)상속공제 사후관리추징사유 신고) — ckFormType 'ih6' ─────
  M['상속9호부표6'] = function (ctx) {
    var o = new Out(), cw = ctx.clawback || {}, cr = cw.result, r = ctx.r || {};
    if (!cr || cw.formType !== 'ih6') { o.miss('부표6 전체', '사후관리 추징이자 계산(서식 구분: 가업·영농상속공제 사후관리추징) 결과 없음'); return o.result(); }
    ihClawHead(o, ctx, '⑧');
    var biz = n(r.가업상속공제), farm = n(r.영농상속공제), kind = biz && !farm ? '가업' : farm && !biz ? '영농' : null;
    if (kind) o.set('⑦', kind === '가업' ? '가업상속공제' : '영농상속공제');
    else o.miss('⑦ 상속공제의 종류·㉗~㊱ 가업/영농 칸', biz && farm ? '가업·영농상속공제가 둘 다 있어 추징 대상이 어느 쪽인지 화면만으로 정할 수 없음' : '상속세 결과에 가업·영농상속공제가 없음(당초 신고 계산을 불러와야 함)');
    o.miss('⑨~⑱ 가업·영농상속 재산명세', '계산기에 재산명세 칸 없음(공제 계산은 합계만)');
    o.miss('⑲ 사후관리 위반유형코드', '계산기에 없음');
    if (biz) o.set('⑳', biz);
    if (farm) o.set('㉓', farm);
    if (biz) o.miss('㉑㉒ 추징율·금액', '기간별 추징율이 계산기에 없음');
    if (farm) o.miss('㉔㉕㉖', '영농상속재산 중 처분재산가액·영농상속재산가액이 계산기에 없음');
    if (kind) {
      var K = kind === '가업' ? { tax: '㉗', days: '㉙', rate: '㉚', int: '㉛', pay: '㉟' } : { tax: '㉘', days: '㉜', rate: '㉝', int: '㉞', pay: '㊱' };
      var tax = n(cr.추징세액), ic = interestCells(cr, 'annual');
      o.set(K.tax, tax);
      if (ic) o.set(K.days, ic.days).set(K.rate, ic.rate);
      o.set(K.int, n(cr.이자상당액_합계)).set(K.pay, n(cr.납부할세액));
      if (ic && ic.single) o.check(K.int + ' = ' + K.tax + ' × ' + K.days + ' × ' + K.rate + '/365', n(cr.이자상당액_합계), interestRecalc(tax, ic.seg));
      if (ic && !ic.single) o.note(K.days + '·' + K.rate + ' 이자율이 바뀐 기간이 있어 구간별로 적음');
      o.check(K.pay + ' = ' + K.tax + ' + ' + K.int, n(cr.납부할세액), tax + n(cr.이자상당액_합계));
      o.note(K.rate + ' 이자율은 연이율로 적음 — 서식 식이 "× 이자율/365"(작성방법 6의 "365로 나눈 율"과 겹침, 칸 해설 확인필요)');
    }
    if (cr.이자율방식 && cr.이자율방식 !== 'assessment') o.note('이자율 방식이 "부과 당시 율 하나"가 아님(' + (cr.이자율방식_설명 || cr.이자율방식) + ') — 상증법 §18의2·§18의3(부표6)은 시행령 §15·§16대로 부과 당시 율');
    ihClawSign(o, ctx);
    return o.result();
  };
  // ───── 상속 부표7(가업상속 납부유예 사후관리추징사유 신고) — ckFormType 'ih7' + 가업상속 납부유예 사후관리 도구(bc*) ─────
  M['상속9호부표7'] = function (ctx) {
    var o = new Out(), cw = ctx.clawback || {}, cr = cw.result, bc = ctx.bc || {};
    if (!cr || cw.formType !== 'ih7') { o.miss('부표7 전체', '사후관리 추징이자 계산(서식 구분: 가업상속 납부유예 사후관리추징) 결과 없음'); return o.result(); }
    ihClawHead(o, ctx, '⑦');
    o.miss('⑧~⑰ 가업상속 재산명세', '계산기에 재산명세 칸 없음');
    o.miss('⑱ 추징사유 유형 코드', '도구의 사유 값(' + (bc.triggerEvent || '') + ')과 서식 코드 01~05의 짝이 확인 전');
    var tax = n(cr.추징세액), ratio = null;
    if (bc.provision === 'inheritance' && n(bc.deferredTax)) {
      o.set('⑲', n(bc.deferredTax));
      if (bc.triggerEvent === 'asset_disposed_40pct' && n(bc.disposalRatio)) ratio = n(bc.disposalRatio);
      else if (bc.triggerEvent === 'equity_decreased') {
        ratio = n(bc.equityDecreaseRatio) || (n(bc.equityRatioAtBase) ? (n(bc.equityRatioAtBase) - n(bc.currentEquityRatio)) / n(bc.equityRatioAtBase) : null);
      }
      if (ratio !== null && ratio > 0) { o.set('⑳', pct2(ratio)); o.check('㉑ = ⑲ × ⑳', tax, Math.round(n(bc.deferredTax) * ratio)); }
      else { o.miss('⑳ 처분비율', '전부 추징 사유이거나 비율 입력 없음'); o.check('㉑ = ⑲(전부 추징)', tax, n(bc.deferredTax)); }
    } else o.miss('⑲⑳ 납부유예 받은 세액·처분비율', '"가업상속 납부유예 사후관리" 도구(§72의2) 값 없음');
    var ic = interestCells(cr, 'perDay');
    o.set('㉑', tax);
    if (ic) { o.set('㉒', ic.days).set('㉓', ic.rate); if (!ic.single) o.note('㉒·㉓ 이자율이 바뀐 날마다 나눠 구간별로 적음(시행령 §69의3)'); }
    o.set('㉔', n(cr.이자상당액_합계)).set('㉕', n(cr.납부할세액));
    if (ic && ic.single) o.check('㉔ = ㉑ × ㉒ × ㉓', n(cr.이자상당액_합계), interestRecalc(tax, ic.seg));
    o.check('㉕ = ㉑ + ㉔', n(cr.납부할세액), tax + n(cr.이자상당액_합계));
    if (cr.이자율방식 && cr.이자율방식 !== 'split') o.note('이자율 방식이 "기간별 율"이 아님(' + (cr.이자율방식_설명 || cr.이자율방식) + ') — 상증법 §72의2(부표7)는 이율이 바뀐 날마다 나눔');
    o.miss('6. 재차 납부유예 신청', '계산기에 없음 — 신청하면 직접 적음');
    ihClawSign(o, ctx);
    return o.result();
  };

  // ───── 상속 부표8(서화·골동품 등 상속재산 명세서) — 받는 상속인별 한 줄 ─────
  M['상속9호부표8'] = function (ctx) {
    var o = new Out(), heirs = ctx.heirs || [], rows = [];
    (ctx.valAssets || []).filter(function (a) { return a.method === 'artwork'; }).forEach(function (a) {
      var al = (a.alloc || []).filter(function (x) { return n(x.ratio) > 0; });
      if (!al.length) { rows.push({ a: a, value: a.value, heir: null }); o.miss('② ③ 상속인(' + (artOf(a).title || a.location || '') + ')', '받는 상속인 배분 없음'); }
      else al.forEach(function (x) { rows.push({ a: a, value: Math.round(n(a.value) * n(x.ratio)), heir: heirs[Number(x.heirIdx)] || null }); });
    });
    if (!rows.length) { o.miss('부표8 전체', '서화·골동품 재산 없음'); return o.result(); }
    artRows(o, rows, function (x) { return x.heir; });
    if (rows.length > 20) o.note('작품 ' + rows.length + '줄 — 20줄을 넘는 만큼 모듈이 다음 장에 이어 찍음');
    return o.result();
  };

  // ═════════ 어떤 서식을 찍을지 — 그 사건에 해당하는 서식만 ═════════
  //  양도: 84호·부표1 = 부동산 등 계산 결과 / 부표2 = 주식등 결과 / 부표2의2 = 파생상품 결과 / 부표3 = 필요경비 상세 항목이 있는 자산마다
  //  증여: 10호·부표1 = 계산 결과 / 부표2 = 가업승계 납부유예(증여) 결과 / 부표3 = 혼인·출산 공제 / 부표4 = 추징이자 서식 구분 "혼인출산"
  //        부표5 = 배분된 서화·골동품 / 부표6 = 공익법인 등 관련 가산세 > 0
  //  상속: 9호·부표1·부표3 = 계산 결과 / 부표2 = 상속인마다 / 부표3의2 = 배우자 있음 / 부표4(갑)(을) = 처분재산 입력 /
  //        부표5 = 영리법인 유증 > 0 / 부표6·7 = 추징이자 서식 구분 ih6·ih7 / 부표8 = 서화·골동품 재산
  function plan(tax, ctx) {
    ctx = ctx || {};
    var L = [];
    if (tax === '양도') {
      var assets = ctx.assets || [];
      // [2026.10.20 84호 주식등·국외자산] 국외자산(대표 양도인)은 부동산 등과 같은 84호·부표1에 열을 나눠, 주식등은 84호 한 장 따로(ctx.갈래 '주식등') +
      //  자산구분에 맞는 부표(국내·국외주식·기타자산 주식 → 부표2, 신탁수익권 → 부표1, 파생상품 → 부표2의2)
      var ovR = !!(ctx.overseas && !ctx.overseas.error);
      if ((ctx.r && assets.length) || ovR) L.push('양도84호', '양도84부표1');
      if (ctx.stock && ctx.stock.input && ctx.stock.result) {
        var sc = Object.assign({}, ctx, { 갈래: '주식등' }), cat = ctx.stock.input.assetCategory || ctx.stock.assetCategory;
        L.push({ formKey: '양도84호', ctx: sc });
        if (cat === 'trust_beneficiary') L.push({ formKey: '양도84부표1', ctx: sc });
        else if (cat === 'derivative') L.push({ formKey: '양도84부표2의2', ctx: sc });
        else L.push('양도84부표2');
      }
      if (ctx.derivative) L.push('양도84부표2의2');
      assets.forEach(function (it, i) { if (expenseItemsOf(it.asset || {}).length) L.push({ formKey: '양도84부표3', ctx: Object.assign({}, ctx, { 부표3자산: i }) }); });
    } else if (tax === '증여') {
      var r = ctx.r;
      if (r) L.push('증여10호', '증여10부표1');
      if (ctx.bd) L.push('증여10부표2');
      if (ctx.mbDetail && (n(ctx.mbDetail.thisTime) || (ctx.r && n(ctx.r.혼인출산증여재산공제)))) L.push('증여10부표3');
      if (ctx.clawback && ctx.clawback.result && ctx.clawback.formType === 'gf_marriage') L.push('증여10부표4');
      if ((ctx.giftAssets || []).some(function (a) { return a.method === 'artwork'; })) L.push('증여10부표5');
      if ((r && n(r.공익법인등관련가산세) > 0) || (ctx.publicOrgPenaltyItems || []).length) L.push('증여10부표6');
    } else if (tax === '상속') {
      if (ctx.r) {
        L.push('상속9호', '상속9호부표1');
        (ctx.heirs || []).forEach(function (h, i) { L.push({ formKey: '상속9호부표2', ctx: Object.assign({}, ctx, { 부표2상속인: i }) }); });
        L.push('상속9호부표3');
        if (ctx.spouse) L.push('상속9호부표3의2');
        if ((ctx.disposalItems || []).some(function (d) { return n(d.oneYearAmount) > 0 || n(d.twoYearAmount) > 0; })) L.push('상속9호부표4갑', '상속9호부표4을');
        if (n(ctx.forProfitBequest) > 0) L.push('상속9호부표5');
      }
      var cw = ctx.clawback || {};
      if (cw.result && cw.formType === 'ih6') L.push('상속9호부표6');
      if (cw.result && cw.formType === 'ih7') L.push('상속9호부표7');
      if ((ctx.valAssets || []).some(function (a) { return a.method === 'artwork'; })) L.push('상속9호부표8');
    }
    // [2026.10.20] 묶음 파일(mappers-*.js)의 서식 — 같은 ctx로 그 사건에 해당하는 것만 더함(감면신청서·특례신고서 등)
    EXTS.forEach(function (x) { if (typeof x.plan === 'function') { try { L = L.concat(x.plan(tax, ctx) || []); } catch (e) { /* 묶음 하나의 오류가 본표 인쇄를 막지 않게 */ } } });
    return L;
  }
  function applicable(tax, ctx) {
    var out = [];
    plan(tax, ctx).forEach(function (it) { var k = typeof it === 'string' ? it : it.formKey; if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }

  // ───────── 앱 화면에서 ctx 모으기(브라우저, taxcalc 화면이 열린 같은 페이지에서만) ─────────
  // 지금 세액인쇄 함수들이 읽는 같은 전역값·화면 칸을 읽기만 한다(아무것도 바꾸지 않음).
  /* global lastTransferResults_, trCollectBuyers_, trLatestTransferDate_, trBuyerRelationLabel_, trAttach1EngineValues_, trAttach1AcqNec_,
     trRateClassCode1_, trAssetTypeCode1_, transferContracts, transferSellers, lastTrSplitPaymentInput_, lastTrSplitPaymentResult_, taxAgentField_, numVal,
     lastStockTransferResult_, lastDerivativeResult_, lastOverseasTransferResult_, transferAssets,
     lastGiftResults_, giftDonees, giftDonors, giftPairRelation_, gfMarriageBirthSplit_, ihRateForBase_, lastInstallmentInput_, lastInstallmentResult_,
     lastSplitPaymentInput_, lastSplitPaymentResult_, giftValuationAssets_, parseShareFraction_, lastBdDeferralResult_, lastClawbackResult_,
     lastInheritanceResult, inheritanceHeirs, ihFormValues_, inheritanceValuationAssets_, computeHeirActualValue_, heirAssumedDebt_, taxCalcHeirRegistryHasSpouse,
     ihAssetTypeCode_, ihAssetValuationBasisCode_, computeValuationAssetValue, ihGrossEstateTotal_, ihValuationAssetsGrossTotal_,
     computeDuesTotal_, computeDebtTotal_, inheritanceDuesItems, inheritanceDebtItems, inheritanceFuneralItems, inheritanceDisposalItems */
  function el(id) { var e = typeof document !== 'undefined' && document.getElementById(id); return e ? e.value : ''; }
  function checked(id) { var e = typeof document !== 'undefined' && document.getElementById(id); return e ? !!e.checked : null; }
  function agent() {
    var f = typeof taxAgentField_ === 'function' ? taxAgentField_ : function () { return ''; };
    return { name: f('taxAgentName'), bizNo: f('taxAgentBizNo'), mgmtNo: f('taxAgentMgmtNo'), phone: f('taxAgentPhone') };
  }
  // 재산평가 자산 한 줄(증여 부표1·5, 상속 부표1·2·8) — 전자신고 gfAttach1AssetRecord_·ihAttach1AssetRecord_와 같은 코드
  //   수량: 화면 assetArea, 없으면 토지 landArea·상장주식 listedShares / 단가: 토지 landPrice·상장주식 listedPrice(배분 전 전액 줄에서만)
  function assetRow(a, value, ratio) {
    var nv = function (x) { return numVal(x) || 0; };
    var qty = nv(a.assetArea) || (a.method === 'land' ? nv(a.landArea) : a.method === 'listedStock' ? nv(a.listedShares) : 0);
    var unit = ratio === 1 ? (a.method === 'land' ? nv(a.landPrice) : a.method === 'listedStock' ? nv(a.listedPrice) : 0) : 0;
    return { method: a.method, typeCode: ihAssetTypeCode_(a.method), basisCode: ihAssetValuationBasisCode_(a), location: a.assetLocation || '', area: qty, unitPrice: unit, value: value,
      artwork: a.method === 'artwork' ? { code: a.artworkCode || '', artist: a.artworkArtist || '', title: a.artworkTitle || '', year: a.artworkYear || '', material: a.artworkMaterial || '', size: a.artworkSize || '' } : null };
  }
  function clawbackCtx() {
    var cr = (typeof lastClawbackResult_ !== 'undefined' ? lastClawbackResult_ : null);
    return cr ? { formType: el('ckFormType'), result: cr, reason: el('ckMarriageReason') } : null;
  }
  var ctxFromApp = {
    // i = 양도인 번호(lastTransferResults_ 중 계산 성공한 것의 순서). 주식등·파생상품 결과는 대표 양도인(i=0)에만 붙임(지금 인쇄와 같음)
    '양도': function (i, extra) {
      i = i || 0;
      var items = (typeof lastTransferResults_ !== 'undefined' && lastTransferResults_ ? lastTransferResults_ : []).filter(function (it) { return it.result && !it.result.error; });
      var item = items[i];
      var stock = i === 0 ? (typeof lastStockTransferResult_ !== 'undefined' ? lastStockTransferResult_ : null) : null;
      var dv = i === 0 ? (typeof lastDerivativeResult_ !== 'undefined' ? lastDerivativeResult_ : null) : null;
      if (dv && dv.error) dv = null;
      // [2026.10.20 84호 주식등·국외자산] 국외자산 계산 결과(calculateOverseasAssetTransferTaxMultiJS)도 대표 양도인(i=0)에 — 전자신고 trBuildEfileBytes_와 같음.
      //  자산은 계산 때와 같은 순서(transferAssets 중 isOverseasAsset, run-overseas-transfer)라 엔진 거래별_내역 idx와 짝
      var ovR = i === 0 && typeof lastOverseasTransferResult_ !== 'undefined' && lastOverseasTransferResult_ && !lastOverseasTransferResult_.error ? lastOverseasTransferResult_ : null;
      //  (이름은 묶음 파일 mappers-양도소득특례.js 소득11호와 같게 — ctx.overseas = 결과, ctx.overseasAssets = 국외자산 카드)
      var ovCards = ovR ? (typeof transferAssets !== 'undefined' && transferAssets ? transferAssets : []).filter(function (a) { return a && a.isOverseasAsset; }) : [];
      if (!item && !stock && !dv && !ovR) throw new Error('양도세 계산 결과가 없습니다 — 먼저 계산하세요.');
      var buyers = (typeof trCollectBuyers_ === 'function' ? trCollectBuyers_() : []).map(function (b) {
        return { name: b.name, regNo: b.regNo, shareRatio: b.shareRatio, relation: b.relation, relationLabel: typeof trBuyerRelationLabel_ === 'function' ? trBuyerRelationLabel_(b.relation) : '' };
      });
      var assets = ((item && item.assets) || []).map(function (a) {
        var ev = trAttach1EngineValues_(a);
        var contract = a.transferContractId && typeof transferContracts !== 'undefined' ? transferContracts.find(function (c) { return c.id === a.transferContractId; }) : null;
        return { asset: a, ev: ev, an: trAttach1AcqNec_(a, ev), rateCode: trRateClassCode1_(a), typeCode: trAssetTypeCode1_(a),
          transferCause: contract ? (contract.transferCause || '') : null };
      });
      var latest = typeof trLatestTransferDate_ === 'function' ? trLatestTransferDate_() : '';
      // trLatestTransferDate_는 국내 자산만 봄 — 국외자산만 있으면 국외자산 양도일 중 마지막
      if (!latest && ovR) latest = ovCards.map(function (a) { return a.transferDate; }).filter(Boolean).sort().pop() || '';
      // 전자신고 trBuildEfileBytes_ 의 trSplitAmt와 같은 식(대표 양도인만)
      var splitAmt = 0;
      if (i === 0 && typeof lastTrSplitPaymentInput_ !== 'undefined' && lastTrSplitPaymentInput_ && lastTrSplitPaymentInput_.taxType === 'transfer' &&
        typeof lastTrSplitPaymentResult_ !== 'undefined' && lastTrSplitPaymentResult_ && lastTrSplitPaymentResult_.분납가능여부)
        splitAmt = numVal(lastTrSplitPaymentResult_.분납신청금액 != null ? lastTrSplitPaymentResult_.분납신청금액 : lastTrSplitPaymentResult_.분납가능_최대금액) || 0;
      var seller = item ? (item.seller || {}) : ((typeof transferSellers !== 'undefined' && transferSellers && transferSellers[0]) || {});
      return Object.assign({ r: item ? item.result : null, seller: seller, buyers: buyers, assets: assets, 귀속연도: latest ? latest.slice(0, 4) : '',
        splitAmt: splitAmt, taxAgent: agent(), stock: stock || null, derivative: dv || null, overseas: ovR, overseasAssets: ovCards }, extra || {});
    },
    // i = 증여 계산 결과(수증자·증여자 조합) 번호. 사건 전체에 하나뿐인 자료(가업승계 납부유예·추징이자)는 첫 결과(i=0)에만 붙임
    '증여': function (i, extra) {
      i = i || 0;
      var items = (typeof lastGiftResults_ !== 'undefined' && lastGiftResults_ ? lastGiftResults_ : []).filter(function (it) { return it.result && !it.result.error; });
      var item = items[i];
      var claw = i === 0 ? clawbackCtx() : null;
      if (!item && !(claw && claw.formType === 'gf_marriage')) throw new Error('증여세 계산 결과가 없습니다 — 먼저 계산하세요.');
      var r = item ? (item.result || {}) : null;
      var doneeIdx = item ? item.doneeIdx : 0, donorIdx = item ? item.donorIdxs[0] : 0;
      var donor = giftDonors[donorIdx] || {};
      // [2026.10.20 서식↔엔진 감사 A] 연부연납·분납 계산은 사건에 하나 — 증여 쌍이 여럿이면 그 계산의 총 납부세액이 이 쌍 납부세액과 같은 쌍에만(예전엔 모든 쌍 51·52에 같은 금액)
      var mine_ = function (inp) { return items.length <= 1 || !!(r && inp && Math.round(numVal(inp.totalTaxAmount) || 0) === Math.round(numVal(r.납부세액) || 0)); };
      var inst = (typeof lastInstallmentInput_ !== 'undefined' && lastInstallmentInput_ && lastInstallmentInput_.taxType === 'gift' && lastInstallmentResult_ && mine_(lastInstallmentInput_)) ? (numVal(lastInstallmentResult_.연부연납대상금액) || 0) : 0;
      var split = (typeof lastSplitPaymentInput_ !== 'undefined' && lastSplitPaymentInput_ && lastSplitPaymentInput_.taxType === 'gift' && lastSplitPaymentResult_ && lastSplitPaymentResult_.분납가능여부 && mine_(lastSplitPaymentInput_)) ? (numVal(lastSplitPaymentResult_.분납신청금액 != null ? lastSplitPaymentResult_.분납신청금액 : lastSplitPaymentResult_.분납가능_최대금액) || 0) : 0;
      // 부표1·5 — gfAttach1PrintPageHtml_와 같은 배분(이 증여자·수증자 몫 비율 × 평가액)
      var giftAssets = (typeof giftValuationAssets_ === 'function' ? giftValuationAssets_() : []).map(function (a) {
        var ratio = (Array.isArray(a.donorAllocations) ? a.donorAllocations : []).reduce(function (s, al) {
          if (String(al.donorIdx) !== String(donorIdx)) return s;
          var di = (al.doneeIdx === undefined || al.doneeIdx === null || al.doneeIdx === '') ? '0' : String(al.doneeIdx);
          if (di !== String(doneeIdx)) return s;
          var q = parseShareFraction_(al.ratio);
          return s + (q === null ? 0 : q);
        }, 0);
        return ratio > 0 ? assetRow(a, Math.round(computeValuationAssetValue(a) * ratio), ratio) : null;
      }).filter(Boolean);
      var mbThis = r ? (numVal(r.혼인출산증여재산공제_이번분 != null ? r.혼인출산증여재산공제_이번분 : r.혼인출산증여재산공제) || 0) : 0;
      var bdRes = i === 0 ? (typeof lastBdDeferralResult_ !== 'undefined' ? lastBdDeferralResult_ : null) : null;
      var bd = (bdRes && el('bdProvision') === 'gift') ? { totalAsset: numVal(el('bdTotalAsset')) || 0, nonBiz55: numVal(el('bdNonBiz55')) || 0, nonBiz49: numVal(el('bdNonBiz49')) || 0,
        nonBiz61: numVal(el('bdNonBiz61')) || 0, excessCash: numVal(el('bdExcessCash')) || 0, nonBizStock: numVal(el('bdNonBizStock')) || 0,
        totalValue: numVal(el('bdTotalValue')) || 0, stockValue: numVal(el('bdStockValue')) || 0, businessValue: numVal(el('bdBusinessValue')) || 0, taxPayable: numVal(el('bdTaxPayable')) || 0, result: bdRes } : null;
      return Object.assign({ r: r, item: item ? { amount: item.amount, priorGiftAmount: item.priorGiftAmount } : {}, donee: giftDonees[doneeIdx] || {}, donor: donor,
        relation: item ? giftPairRelation_(donor, doneeIdx).relation : '', genSkip: item ? giftPairRelation_(donor, doneeIdx).genSkip : '', giftDate: el('giftDate'),
        marriageBirth: r && numVal(r.혼인출산증여재산공제) ? gfMarriageBirthSplit_(numVal(r.혼인출산증여재산공제) || 0) : { marriage: 0, birth: 0 },
        mbDetail: (mbThis || (r && numVal(r.혼인출산증여재산공제))) ? { thisTime: mbThis, cur: gfMarriageBirthSplit_(mbThis), prior: (typeof gfPriorMarriageBirthParts_ === 'function' ? gfPriorMarriageBirthParts_(r).total : 0), priorParts: (typeof gfPriorMarriageBirthParts_ === 'function' ? gfPriorMarriageBirthParts_(r) : null), marriageDate: el('giftMarriageDate'),
          birthDate: el('giftBirthDate'), giftDate: el('giftDate'), giftAmount: has(item.amount) ? numVal(item.amount) : numVal(r.증여재산가액) } : null,
        giftAssets: giftAssets, bd: bd, clawback: claw, publicOrgPenaltyItems: [],
        rate: r ? ihRateForBase_(r.과세표준) : null, installment: inst, split: split, taxAgent: agent() }, extra || {});
    },
    '상속': function (extra) {
      var claw = clawbackCtx();
      var hasR = typeof lastInheritanceResult !== 'undefined' && !!lastInheritanceResult;
      if (!hasR && !(claw && (claw.formType === 'ih6' || claw.formType === 'ih7'))) throw new Error('상속세 계산 결과가 없습니다 — 먼저 계산하세요.');
      var r = hasR ? lastInheritanceResult : null;
      var reporter = inheritanceHeirs.find(function (h) { return h.isReporter; }) || {};
      var gn = function (id) { return numVal(el(id)) || 0; };
      // 재산평가 자산(부표1·2·8) — 받는 상속인 배분(heirAllocations)까지
      var valAssets = inheritanceValuationAssets_().map(function (a) {
        var row = assetRow(a, Math.round(computeValuationAssetValue(a)), 1);
        row.alloc = (Array.isArray(a.heirAllocations) ? a.heirAllocations : []).filter(function (al) { return al.heirIdx !== undefined && al.heirIdx !== null && al.heirIdx !== ''; })
          .map(function (al) { var q = parseShareFraction_(al.ratio); return { heirIdx: Number(al.heirIdx), ratio: q === null ? 0 : q }; });
        return row;
      });
      var heirs = inheritanceHeirs.map(function (h, hi) {
        return { name: h.name || '', regNo: h.regNo || '', relation: h.relation || '', address: h.address || '', addressDong: h.addressDong || '', addressHo: h.addressHo || '',
          statutoryShareRatio: h.statutoryShareRatio, actualValue: computeHeirActualValue_(hi), isReporter: !!h.isReporter };
      });
      var spIdx = -1;
      inheritanceHeirs.some(function (h, hi) { if (h.relation === '배우자') { spIdx = hi; return true; } return false; });
      var hasSpouse = typeof taxCalcHeirRegistryHasSpouse !== 'undefined' ? !!taxCalcHeirRegistryHasSpouse : spIdx >= 0;
      var spouse = (hasR && hasSpouse && spIdx >= 0) ? { estateValue: computeHeirActualValue_(spIdx), assumedDebt: typeof heirAssumedDebt_ === 'function' ? heirAssumedDebt_(spIdx) : 0,
        nonTaxable: Math.min(gn('ihSpouseNonTaxable'), gn('ihNonTaxable')), actual: gn('ihSpouseActual'), nonHeirBequest: gn('ihNonHeirBequest'), giftToHeirs: gn('ihGiftToHeirs'),
        ratio: numVal(el('ihSpouseRatio')) || 0, giftBase: gn('ihSpouseGiftBase'), priorGiftedIncluded: gn('ihPriorGiftedIncluded'),
        divided: checked('ihSpouseDivided') === null ? true : checked('ihSpouseDivided') } : null;
      var inst = (typeof lastInstallmentInput_ !== 'undefined' && lastInstallmentInput_ && lastInstallmentInput_.taxType === 'inheritance' && lastInstallmentResult_) ? (numVal(lastInstallmentResult_.연부연납대상금액) || 0) : 0;
      var split = (typeof lastSplitPaymentInput_ !== 'undefined' && lastSplitPaymentInput_ && lastSplitPaymentInput_.taxType === 'inheritance' && lastSplitPaymentResult_ && lastSplitPaymentResult_.분납가능여부) ? (numVal(lastSplitPaymentResult_.분납신청금액 != null ? lastSplitPaymentResult_.분납신청금액 : lastSplitPaymentResult_.분납가능_최대금액) || 0) : 0;
      var nonRes = el('ihDecedentResident') === 'nonresident';
      var disposal = (typeof inheritanceDisposalItems !== 'undefined' ? inheritanceDisposalItems : []).map(function (d) {
        return { category: d.category || '', oneYearAmount: numVal(d.oneYearAmount) || 0, oneYearSelfDeposit: numVal(d.oneYearSelfDeposit) || 0, oneYearExplained: numVal(d.oneYearExplained) || 0,
          twoYearAmount: numVal(d.twoYearAmount) || 0, twoYearSelfDeposit: numVal(d.twoYearSelfDeposit) || 0, twoYearExplained: numVal(d.twoYearExplained) || 0 };
      });
      return Object.assign({ r: r, fv: r ? ihFormValues_(r) : {}, reporter: reporter, phone: el('ihReporterPhone'), email: el('ihReporterEmail'),
        deceased: { name: el('ihDeceasedName'), regNo: el('ihDeceasedRegNo'), address: el('ihDeceasedAddress'), deathDate: el('ihDeathDate'), resident: nonRes ? 'nonresident' : 'resident', taxOffice: el('ihDeceasedTaxOffice') },
        taxAgent: agent(), rate: r ? ihRateForBase_(r.과세표준) : null, forProfitBequest: gn('ihForProfitBequest'), forProfitExempted: gn('ihForProfitExempted'), forProfitRatio: numVal(el('ihForProfitRatio')) || 0, forProfitPayers: (typeof inheritanceForProfitPayers !== 'undefined' ? inheritanceForProfitPayers : []), // [2026.10.20 J07] 부표5 사람별 줄
        bizDeferred: gn('ihBizInheritDeferred'), installment: inst, split: split,
        assets: valAssets, valAssets: valAssets, heirs: heirs, spouse: spouse, nonHeirBequest: gn('ihNonHeirBequest'), disposalItems: disposal,
        valuationTotal: Math.round(ihValuationAssetsGrossTotal_()), grossEstate: ihGrossEstateTotal_(), publicOrg: gn('ihPublicOrg'), publicTrust: gn('ihPublicTrust'),
        duesTotal: computeDuesTotal_(inheritanceDuesItems), debtTotal: computeDebtTotal_(inheritanceDebtItems),
        debts: inheritanceDebtItems, dues: inheritanceDuesItems, funerals: inheritanceFuneralItems,
        childCount: gn('ihChildCount'), minorYears: gn('ihMinorYears'), elderlyCount: gn('ihElderlyCount'), disabledYears: gn('ihDisabledYears'), isNonResident: nonRes,
        clawback: claw, bc: { provision: el('bcProvision'), deferredTax: gn('bcDeferredTax'), triggerEvent: el('bcTriggerEvent'), disposalRatio: numVal(el('bcDisposalRatio')) || 0,
          equityDecreaseRatio: numVal(el('bcEquityDecreaseRatio')) || 0, equityRatioAtBase: numVal(el('bcEquityRatioAtBase')) || 0, currentEquityRatio: numVal(el('bcCurrentEquityRatio')) || 0 } }, extra || {});
    }
  };

  // ═════════ 서식 묶음 파일(2026-10-20) — 84호·9호·10호 계열 밖의 서식(칸 해설 78장 중 55장)은 묶음마다 따로 둔 파일에 ═════════
  //  묶음 파일 app/formprint/mappers-<묶음>.js 는 NxFormPrint.registerExt(api)로 등록한다(node: require('./mappers.js').registerExt).
  //  api = { 묶음: '양도감면A',
  //          forms:   { formKey: 서식번호(칸 해설·세액인쇄 서식표와 같은 글자, 예 '조세특례제한법 시행규칙 [별지 제54호서식]') },
  //          mappers: { formKey: function (ctx) → { values, missing, notes, checks } }  (모양은 위 M과 같음 — helpers.Out 사용),
  //          plan:    function (세목, ctx) → [formKey | {formKey, ctx}]   (세목 원본 모양 출력 묶음에 더할 것 — 해당 사건만),
  //          ctxFor:  { formKey: function (extra) → ctx 또는 [ctx…] }       (세액인쇄 화면의 서식 한 줄 출력용 — 화면 전역값에서 모음),
  //          ready:   { formKey: function () → true/false }               (그 서식에 찍을 계산 결과가 화면에 있는지) }
  //  파일 이름은 EXT_FILES에 미리 적어 둔다(세액인쇄 화면이 이 순서로 불러옴). 없는 묶음 파일은 빈 등록만 한다.
  var EXT_FILES = ['mappers-양도감면A.js', 'mappers-양도감면B.js', 'mappers-양도소득특례.js', 'mappers-증여특례A.js', 'mappers-증여특례B.js', 'mappers-상속부속A.js', 'mappers-상속부속B.js', 'mappers-2단계.js'];
  var EXTS = [];
  function registerExt(x) {
    if (!x || EXTS.indexOf(x) >= 0) return x;
    EXTS.push(x);
    Object.keys(x.mappers || {}).forEach(function (k) {
      M[k] = x.mappers[k];
      if (root.NxFormPrint && root.NxFormPrint.mappers && root.NxFormPrint.mappers !== M) root.NxFormPrint.mappers[k] = x.mappers[k];
    });
    return x;
  }
  // ═════════ 세액인쇄 화면의 서식 한 줄 → 원본 모양(2026-10-20) ═════════
  //  화면 서식표(PRINT_REGISTRY_ subForms)의 서식번호로 찾는다. 띄어쓰기는 무시('부표 1' = '부표1').
  var BUILTIN_FORMNO = {
    '양도84호': '소득세법 시행규칙 [별지 제84호서식]', '양도84부표1': '소득세법 시행규칙 [별지 제84호서식 부표1]', '양도84부표2': '소득세법 시행규칙 [별지 제84호서식 부표2]',
    '양도84부표2의2': '소득세법 시행규칙 [별지 제84호서식 부표2의2]', '양도84부표3': '소득세법 시행규칙 [별지 제84호서식 부표3]',
    '증여10호': '상속세 및 증여세법 시행규칙 [별지 제10호서식]', '증여10부표1': '상속세 및 증여세법 시행규칙 [별지 제10호서식 부표1]', '증여10부표2': '상속세 및 증여세법 시행규칙 [별지 제10호서식 부표2]',
    '증여10부표3': '상속세 및 증여세법 시행규칙 [별지 제10호서식 부표3]', '증여10부표4': '상속세 및 증여세법 시행규칙 [별지 제10호서식 부표4]', '증여10부표5': '상속세 및 증여세법 시행규칙 [별지 제10호서식 부표5]',
    '증여10부표6': '상속세 및 증여세법 시행규칙 [별지 제10호서식 부표6]',
    '상속9호': '상속세 및 증여세법 시행규칙 [별지 제9호서식]', '상속9호부표1': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표1]', '상속9호부표2': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표2]',
    '상속9호부표3': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표3]', '상속9호부표3의2': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표3의2]',
    '상속9호부표4갑': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표4(갑)]', '상속9호부표4을': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표4(을)]',
    '상속9호부표5': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표5]', '상속9호부표6': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표6]',
    '상속9호부표7': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표7]', '상속9호부표8': '상속세 및 증여세법 시행규칙 [별지 제9호서식 부표8]'
  };
  function fno(s) { return String(s || '').replace(/\s+/g, ''); }
  function taxOfKey(k) { return /^양도/.test(k) ? '양도' : /^증여/.test(k) ? '증여' : /^상속/.test(k) ? '상속' : ''; }
  // → { formKey, tax } (84·10·9호 계열) 또는 { formKey, ext } (묶음 파일) 또는 null
  function officialFor(formNo) {
    var f = fno(formNo); if (!f) return null;
    var k;
    for (k in BUILTIN_FORMNO) if (fno(BUILTIN_FORMNO[k]) === f && typeof M[k] === 'function') return { formKey: k, tax: taxOfKey(k) };
    for (var i = 0; i < EXTS.length; i++) for (k in (EXTS[i].forms || {})) if (fno(EXTS[i].forms[k]) === f && typeof EXTS[i].mappers[k] === 'function') return { formKey: k, ext: EXTS[i] };
    return null;
  }
  // 세목 원본 모양 출력의 사람별 ctx — 양도·증여는 계산된 사람(양도인·증여 쌍)마다, 상속은 하나
  function ctxsFor(tax, extra) {
    var out = [];
    if (tax === '상속') { out.push({ label: '상속', ctx: ctxFromApp.상속(extra) }); return out; }
    var list = tax === '양도' ? (typeof lastTransferResults_ !== 'undefined' && lastTransferResults_ ? lastTransferResults_ : []) : (typeof lastGiftResults_ !== 'undefined' && lastGiftResults_ ? lastGiftResults_ : []);
    var cnt = list.filter(function (it) { return it && it.result && !it.result.error; }).length;
    for (var i = 0; i < Math.max(1, cnt); i++) out.push({ label: tax + (cnt > 1 ? ' ' + (i + 1) : ''), ctx: ctxFromApp[tax](i, extra) });
    return out;
  }
  // 서식 한 줄을 찍을 묶음 목록 → [{ label, list: [{formKey, ctx}] }] (찍을 것이 없으면 [])
  function officialJobs(formNo, extra) {
    var o = officialFor(formNo); if (!o) return [];
    var short = String(formNo).replace(/^[^\[]*\[|\]\s*$/g, ''); // '별지 제84호서식 부표1'
    if (o.ext) {
      var fn = o.ext.ctxFor && o.ext.ctxFor[o.formKey]; if (typeof fn !== 'function') return [];
      var c = fn(extra); if (!c) return [];
      var arr = Array.isArray(c) ? c : [c];
      return arr.map(function (cx, i) { return { label: short + (arr.length > 1 ? ' ' + (i + 1) : ''), list: [{ formKey: o.formKey, ctx: Object.assign({}, cx, extra || {}) }] }; });
    }
    return ctxsFor(o.tax, extra).map(function (c) {
      var list = plan(o.tax, c.ctx).filter(function (it) { return (typeof it === 'string' ? it : it.formKey) === o.formKey; })
        .map(function (it) { return typeof it === 'string' ? { formKey: it, ctx: c.ctx } : it; });
      return { label: c.label + ' ' + short, list: list };
    }).filter(function (j) { return j.list.length; });
  }
  // 그 서식에 찍을 계산 결과가 화면에 있는지
  function officialReady(formNo) {
    var o = officialFor(formNo); if (!o) return false;
    try {
      if (o.ext) return !!(o.ext.ready && typeof o.ext.ready[o.formKey] === 'function' && o.ext.ready[o.formKey]());
      return officialJobs(formNo).length > 0;
    } catch (e) { return false; }
  }
  // [2026.10.20 서식↔엔진 감사 A] 서식 "증여자의 (   )" — 수증자를 기준으로 적음(증여10호 작성방법 3: 부모가 자녀에게 증여하면 "자").
  //  rel = 화면 관계(증여자가 수증자의 직계존속·직계비속·배우자…), genSkip '1' = 세대를 건넘. 기타친족·그 밖의 자는 낱말을 정할 수 없어 ''.
  function relWord(rel, genSkip, doneeRegNo) {
    var d = String(doneeRegNo || '').replace(/\D/g, ''), g = d.length === 13 ? (/[13579]/.test(d[6]) ? 'M' : 'F') : '';
    if (rel === '직계존속') return genSkip === '1' ? '손' : '자';
    if (rel === '직계비속') return g ? (genSkip === '1' ? (g === 'M' ? '조부' : '조모') : (g === 'M' ? '부' : '모')) : '';
    if (rel === '배우자') return g === 'M' ? '남편' : g === 'F' ? '처' : '';
    return '';
  }
  var helpers = { relWord: relWord, n: n, has: has, Out: Out, ymd: ymd, dateParts: dateParts, officeName: officeName, isMobile: isMobile, fullAddr: fullAddr, nativeOf: nativeOf,
    fracNum: fracNum, pct: pct, pct2: pct2, ratioText: ratioText, el: el, checked: checked, agent: agent,
    evFromSingle: evFromSingle, acqNec: acqNec, giftInheritRate: giftInheritRate, expenseItemsOf: expenseItemsOf, ctxFromApp: ctxFromApp };

  return { mappers: M, ctxFromApp: ctxFromApp, FORMS_BY_TAX: FORMS_BY_TAX, applicable: applicable, plan: plan,
    registerExt: registerExt, EXT_FILES: EXT_FILES, exts: EXTS, helpers: helpers,
    officialFor: officialFor, officialReady: officialReady, officialJobs: officialJobs, ctxsFor: ctxsFor,
    _helpers: { evFromSingle: evFromSingle, acqNec: acqNec, giftInheritRate: giftInheritRate, expenseItemsOf: expenseItemsOf, fullAddr: fullAddr } };
});
