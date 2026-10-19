// 회귀 고정 정답 독립 검산 — 엔진(taxcalc-engine.html)을 쓰지 않고 조견표(reftables/*.json) 행만으로 셈해 정답과 맞댄다.
//  [2026.10.20 조정 지시] "고정 정답이 틀리면 회귀 검사가 틀린 엔진을 지켜 준다" — 그 사례 양도일·증여일의 세율표·공제율로 다시 셈.
//  사용: node tools/regress-answer-audit.js [사례파일…] (기본: special·history)
//  보는 것: ① 정답 과세표준 → 산출세액(양도 2부-01 기본세율·2부-02 단기·중과, 상증 §26 세율) ② 단순 양도는 입력 → 과세표준(2부-03 장특공, 기본공제)
//          ③ 증여·상속 신고세액공제율(2부-10). 감면·가산세 등은 사례 이름의 손계산 식을 사람이 본다(이 도구는 "검산 못 함"으로 표시).
//          ④ [2026.10.20] 단순 증여(관계·금액·날짜·미성년·세대생략) — 2부-11 증여재산공제 → 과세표준, §26 + 2부-15 할증, 2부-10 신고세액공제, 납부세액
//          ⑤ [2026.10.20] 단순 상속(자녀 수·동거주택·가업·영농·금융재산·장례비 기본) — 2부-12 인적·동거주택·가업(공제율·최소 2억 포함)·영농 한도,
//             일괄공제 5억·기초 2억·금융재산(§22, 2005~ 같음)·장례비(§14, 증빙 없으면 500만) → 과세표준, §26, 신고세액공제, 납부세액
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const T = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'reftables', n + '.json'), 'utf8'));
const t201 = T('2부-01'), t202 = T('2부-02'), t203 = T('2부-03'), t210 = T('2부-10'), t211 = T('2부-11'), t212 = T('2부-12'), t215 = T('2부-15');
const rowAt = (rows, d) => rows.find((r) => r.시작 <= d && (!r.끝 || d <= r.끝));
const bracketTax = (d, base) => {
  const r = rowAt(t201.행, d); if (!r) return null;
  const g = r.값.구간.find((x) => x.이하 == null || base <= x.이하);
  return Math.floor(base * g.세율 - g.누진공제 + 1e-6);
};
// 상속세 및 증여세법 §26(2000.1.1. 이후 같음): 1억 10%, 5억 20%(누진 1천만), 10억 30%(6천만), 30억 40%(1.6억), 초과 50%(4.6억)
const giftTax = (base) => { const B = [[1e8, .1, 0], [5e8, .2, 1e7], [1e9, .3, 6e7], [3e9, .4, 1.6e8], [Infinity, .5, 4.6e8]]; const g = B.find((x) => base <= x[0]); return Math.floor(base * g[1] - g[2] + 1e-6); };
const years = (a, b) => { const A = new Date(a + 'T00:00:00Z'), B = new Date(b + 'T00:00:00Z'); let y = B.getUTCFullYear() - A.getUTCFullYear(); const m = B.getUTCMonth() - A.getUTCMonth(), dd = B.getUTCDate() - A.getUTCDate(); if (m < 0 || (m === 0 && dd < 0)) y--; return y; };
const lt1 = (d, y) => { const r = t203.행.filter((x) => /^표1/.test(x.구분)).find((x) => x.시작 <= d && (!x.끝 || d <= x.끝)); if (!r) return null; let best = -1; Object.keys(r.값).forEach((k) => { if (y >= +k && +k > best) best = +k; }); return best < 0 ? 0 : r.값[best] / 100; };
const shortRate = (d, kind, y) => { const name = kind === 'house' ? /^단기세율 주택/ : /^단기세율 그 밖/; const r = t202.행.filter((x) => name.test(x.구분)).find((x) => x.시작 <= d && (!x.끝 || d <= x.끝)); if (!r) return null; const v = y < 1 ? r.값['1년미만'] : (y < 2 ? r.값['1년이상2년미만'] : r.값['2년이상']); return typeof v === 'number' ? v / 100 : null; };
const reportRate = (d) => { const r = rowAt(t210.행, d); return r ? r.값 / 100 : null; };
const rowOf = (t, gu, d) => rowAt(t.행.filter((r) => r.구분 === gu), d);
// ④ 단순 증여 — 조견표만으로 과세표준·할증 뒤 산출세액·신고세액공제·납부세액
const GIFT_KEYS = ['filingStatus', 'relation', 'giftAmount', 'giftDate', 'isMinor', 'isGenerationSkip', 'generationSkipOver2Billion', 'unpaidDays', 'unpaidTaxForLatePenalty'];
const giftCalc = (inp, d) => {
  if (!Object.keys(inp).every((k) => GIFT_KEYS.includes(k))) return null;
  const r = rowOf(t211, '증여재산공제', d); if (!r) return { err: '그 날짜 증여재산공제 표 없음(2부-11)' };
  const v = r.값, rel = inp.relation;
  const ded = rel === '배우자' ? v.배우자 : rel === '직계존속' ? (inp.isMinor ? v.직계존속_미성년 : v.직계존속) : rel === '직계비속' ? v.직계비속 : rel === '기타친족' ? v.기타친족 : 0;
  const base = Math.max(0, inp.giftAmount - Math.min(ded, inp.giftAmount));
  const t0 = giftTax(base);
  let prem = 0;
  if (inp.isGenerationSkip) { const g = rowOf(t215, '세대생략 할증률', d); if (!g) return { err: '그 날짜 할증률 표 없음(2부-15)' }; prem = Math.floor(t0 * ((inp.isMinor && inp.generationSkipOver2Billion) ? g.값.미성년_20억초과 : g.값.기본) / 100 + 1e-6); }
  const after = t0 + prem, rr = reportRate(d);
  const credit = inp.filingStatus === 'reported' && rr != null ? Math.floor(after * rr + 1e-6) : 0;
  return { 과세표준: base, 산출세액_할증후: after, 신고세액공제: credit, 납부세액: inp.unpaidDays ? undefined : after - credit, how: '증여재산공제 ' + ded.toLocaleString('ko-KR') + '(2부-11)' + (prem ? ' · 할증 ' + prem.toLocaleString('ko-KR') + '(2부-15)' : '') + ' · 신고세액공제 ' + Math.round((rr || 0) * 100) + '%(2부-10)' };
};
// ⑤ 단순 상속 — 거주자, 배우자 없음, 사전증여·유증 없음
const INH_KEYS = ['hasSpouse', 'funeralCostAmount', 'netFinancialAssets', 'filingStatus', 'taxableEstateAmount', 'childCount', 'dateOfDeath', 'hasCohabitingHouseDeduction', 'cohabitingHouseValue', 'businessOwnershipYears', 'businessInheritanceIndividualNetAssetValue', 'farmingIndividualAssetValue', 'unpaidDays', 'unpaidTaxForLatePenalty'];
const inhCalc = (inp, d) => {
  if (inp.hasSpouse || !Object.keys(inp).every((k) => INH_KEYS.includes(k))) return null;
  const pr = rowOf(t212, '그 밖의 인적공제', d); if (!pr) return { err: '그 날짜 인적공제 표 없음(2부-12)' };
  const est = inp.taxableEstateAmount, how = [];
  const lump = inp.filingStatus === 'unreported' ? 5e8 : Math.max(2e8 + (inp.childCount || 0) * pr.값.자녀, 5e8);
  let cohabit = 0;
  if (inp.hasCohabitingHouseDeduction && inp.cohabitingHouseValue > 0) { const c = rowOf(t212, '동거주택 상속공제', d); if (!c) return { err: '그 날짜 동거주택 표 없음(2부-12)' }; cohabit = Math.min(Math.floor(inp.cohabitingHouseValue * c.값.율 / 100 + 1e-6), c.값.한도); how.push('동거주택 ' + c.값.율 + '%·한도 ' + c.값.한도.toLocaleString('ko-KR')); }
  let biz = 0;
  if (inp.businessInheritanceIndividualNetAssetValue > 0 && inp.businessOwnershipYears > 0) {
    const b = rowOf(t212, '가업상속공제 한도', d); if (!b) return { err: '그 날짜 가업 표 없음(2부-12)' };
    const v = inp.businessInheritanceIndividualNetAssetValue, y = inp.businessOwnershipYears;
    const cap = Object.keys(b.값).filter((k) => /[0-9]+년/.test(k)).reduce((m, k) => (y >= +k.match(/([0-9]+)년/)[1] ? Math.max(m, b.값[k]) : m), 0);
    biz = Math.min(Math.floor(v * (b.값.공제율 != null ? b.값.공제율 : 100) / 100 + 1e-6), cap);
    if (b.값.최소 && cap > 0) biz = Math.max(biz, Math.min(v, b.값.최소));
    how.push('가업 ' + biz.toLocaleString('ko-KR'));
  }
  let farm = 0;
  if (inp.farmingIndividualAssetValue > 0) { const f = rowOf(t212, '영농상속공제 한도', d); if (!f) return { err: '그 날짜 영농 표 없음(2부-12)' }; farm = Math.min(inp.farmingIndividualAssetValue, f.값.한도); how.push('영농 한도 ' + f.값.한도.toLocaleString('ko-KR')); }
  const n = inp.netFinancialAssets || 0, fin = n <= 0 ? 0 : n <= 2e7 ? n : Math.floor(Math.min(2e8, Math.max(n * 0.2, 2e7)));
  const fc = inp.funeralCostAmount || 0, funeral = fc > 0 ? Math.min(Math.max(fc, 5e6), 1e7) : 5e6;
  const funeralApplied = Math.min(funeral, Math.max(0, est));
  const ded = Math.min(lump + cohabit + biz + farm + fin, Math.max(0, est - funeralApplied));
  const base = Math.max(0, Math.floor(est - ded - funeralApplied));
  const t0 = giftTax(base), rr = reportRate(d);
  const credit = inp.filingStatus === 'reported' && rr != null ? Math.floor(t0 * rr + 1e-6) : 0;
  return { 과세표준: base, 산출세액: t0, 신고세액공제: credit, 납부세액: inp.unpaidDays ? undefined : t0 - credit, how: '일괄·기초+인적 ' + lump.toLocaleString('ko-KR') + (how.length ? ' · ' + how.join(' · ') : '') + ' · 신고세액공제 ' + Math.round((rr || 0) * 100) + '%' };
};
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['tools/engine-regress-cases-special.json', 'tools/engine-regress-cases-history.json'];
const out = [];
files.forEach((f) => {
  const L = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  L.forEach((c, i) => {
    const a = c.정답 || {}; if (!Object.keys(a).length) return;
    const inp = c.입력 || (Array.isArray(c.인자) ? (Array.isArray(c.인자[0]) ? c.인자[0][0] : c.인자[0]) : {}) || {};
    const fp = Array.isArray(c.인자) && c.인자[1] && typeof c.인자[1] === 'object' && !Array.isArray(c.인자[1]) ? c.인자[1] : {};
    const notes = []; let verdict = '검산 못 함(사람이 이름의 손계산 식 확인)';
    const isGift = /gift|Gift|inheritance|Inheritance|SpecialRate|RelatedParty/.test(c.도구);
    const d = String(inp.transferDate || inp.giftDate || inp.dateOfDeath || inp.inheritanceDate || '').slice(0, 10);
    const base = a.과세표준, tax = a.산출세액 != null ? a.산출세액 : a.산출세액_합계;
    if (!isGift && base != null && tax != null && d) {
      const y = inp.acquisitionDate ? years(inp.acquisitionDate, d) : null;
      const kind = inp.assetType === 'house' ? 'house' : 'other';
      const sr = y != null ? shortRate(d, kind, y) : null;
      const bt = bracketTax(d, base);
      const cands = [['기본세율(2부-01)', bt]];
      if (sr != null) cands.push(['단기 ' + Math.round(sr * 100) + '%(2부-02)', Math.floor(base * sr + 1e-6)]);
      [0.1, 0.2, 0.3].forEach((p) => { const r = rowAt(t201.행, d); if (r) { const g = r.값.구간.find((x) => x.이하 == null || base <= x.이하); cands.push(['기본+' + Math.round(p * 100) + '%p', Math.floor(base * (g.세율 + p) - g.누진공제 + 1e-6)]); } });
      cands.push(['조정지역 분양권 50%(2부-02)', Math.floor(base * 0.5 + 1e-6)]);
      // 2005~2013 옛 단일세율(2부-02 '…(옛 단일세율)' 행 — 숫자 값만)
      t202.행.filter((x) => /옛 단일세율/.test(x.구분) && typeof x.값 === 'number' && x.시작 <= d && (!x.끝 || d <= x.끝)).forEach((x) => cands.push([x.구분 + ' ' + x.값 + '%(2부-02)', Math.floor(base * x.값 / 100 + 1e-6)]));
      const red = (a.수용감면액 || 0) + (a.자경농지감면액 || 0);
      if (red) cands.slice().forEach((x) => cands.push([x[0] + ' − 감면 ' + red.toLocaleString('ko-KR'), x[1] - red]));
      const hit = cands.find((x) => x[1] === tax);
      if (hit) verdict = '산출세액 맞음 — ' + hit[0];
      else if (bt == null) verdict = '✗ 그 날짜 세율표 없음(2부-01)';
      else { verdict = '⚠ 산출세액이 조견표로 센 값과 다름'; notes.push(cands.map((x) => x[0] + ' ' + x[1].toLocaleString('ko-KR')).join(' / ')); }
      // 단순 양도(감면·특례 입력 없음)면 과세표준도 입력에서
      const simple = inp.transferPrice && inp.acquisitionPrice != null && !Object.keys(inp).some((k) => /Exempt|compensation|Farmland|rental|Reduction|Provision|isOneHouse|isAdjustedArea|multiHouse|NonBusiness|conversion|carryover|spouse|gift/i.test(k));
      if (simple && y != null) {
        const gain = inp.transferPrice - inp.acquisitionPrice - (inp.necessaryExpenses || 0);
        const rate = y >= 3 ? lt1(d, y) : 0;
        const inc = gain - Math.floor(gain * (rate || 0) + 1e-6);
        const tb = inc - Math.min(2500000, Math.max(0, inc));
        if (rate == null) notes.push('✗ 그 날짜 장특공 표 없음(2부-03)');
        else if (tb !== base) { verdict = '⚠ 과세표준이 조견표로 센 값과 다름'; notes.push('양도차익 ' + gain.toLocaleString('ko-KR') + ' − 장특공 ' + Math.round(rate * 100) + '%(' + y + '년) − 250만 = ' + tb.toLocaleString('ko-KR')); }
        else notes.push('과세표준도 맞음(장특공 ' + Math.round(rate * 100) + '%, ' + y + '년)');
      }
    }
    if (/SpecialRate/.test(c.도구) && base != null && a.산출세액 != null) { const st = Math.floor(Math.min(base, 12e9) * 0.1 + Math.max(0, base - 12e9) * (/business|가업/.test(JSON.stringify(inp) + c.이름) ? 0.2 : 0.1) + 1e-6); verdict = st === a.산출세액 ? '산출세액 맞음 — 조특법 §30의5·§30의6 특례세율' : '⚠ 특례세율로 ' + st.toLocaleString('ko-KR'); }
    else if (isGift && base != null && (a.산출세액 != null) && !/할증/.test(c.이름)) {
      const gt = giftTax(base);
      verdict = gt === a.산출세액 ? '산출세액 맞음 — 상증법 §26 세율' : '⚠ 산출세액 다름 — §26 세율로 ' + gt.toLocaleString('ko-KR');
    }
    // ④·⑤ 단순 증여·상속 — 입력에서 조견표로 끝까지 셈(정답 칸이 있는 것만 맞댐)
    const sc = d && /^calculate_gift_tax$/.test(c.도구) ? giftCalc(inp, d) : d && /^calculate_inheritance_tax$/.test(c.도구) ? inhCalc(inp, d) : null;
    if (sc && sc.err) { verdict = '✗ ' + sc.err; }
    else if (sc) {
      const diff = Object.keys(sc).filter((k) => k !== 'how' && sc[k] !== undefined && a[k] != null && a[k] !== sc[k]);
      const seen = Object.keys(sc).filter((k) => k !== 'how' && sc[k] !== undefined && a[k] != null);
      if (diff.length) { verdict = '⚠ 입력부터 조견표로 센 값과 다름'; notes.push(diff.map((k) => k + ' 정답 ' + a[k].toLocaleString('ko-KR') + ' ↔ 조견표 ' + sc[k].toLocaleString('ko-KR')).join(' / ') + ' (' + sc.how + ')'); }
      else if (seen.length) { verdict = '입력부터 맞음 — ' + seen.join('·'); notes.push(sc.how); }
    }
    if (isGift && a.신고세액공제 != null && d) {
      const rr = reportRate(d);
      notes.push('신고세액공제율 ' + (rr != null ? Math.round(rr * 100) + '%(2부-10)' : '표 없음'));
    }
    out.push({ f: path.basename(f), i, 이름: c.이름.slice(0, 70), 날짜: d, verdict, notes: notes.join(' · ') });
  });
});
out.forEach((o) => console.log('[' + o.i + '] ' + o.verdict + ' | ' + o.날짜 + ' | ' + o.이름 + (o.notes ? '\n      ' + o.notes : '')));
const bad = out.filter((o) => /^[⚠✗]/.test(o.verdict) || /✗/.test(o.notes));
console.log('\n모두 ' + out.length + '건 · 조견표로 검산 ' + out.filter((o) => /맞음|⚠|✗/.test(o.verdict)).length + '건(그중 상속·증여 입력부터 끝까지 ' + out.filter((o) => /^입력부터 맞음|^⚠ 입력부터/.test(o.verdict)).length + '건) · 다름 ' + bad.length + '건');
