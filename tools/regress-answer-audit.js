// 회귀 고정 정답 독립 검산 — 엔진(taxcalc-engine.html)을 쓰지 않고 조견표(reftables/*.json) 행만으로 셈해 정답과 맞댄다.
//  [2026.10.20 조정 지시] "고정 정답이 틀리면 회귀 검사가 틀린 엔진을 지켜 준다" — 그 사례 양도일·증여일의 세율표·공제율로 다시 셈.
//  사용: node tools/regress-answer-audit.js [사례파일…] (기본: special·history)
//  보는 것: ① 정답 과세표준 → 산출세액(양도 2부-01 기본세율·2부-02 단기·중과, 상증 §26 세율) ② 단순 양도는 입력 → 과세표준(2부-03 장특공, 기본공제)
//          ③ 증여·상속 신고세액공제율(2부-10). 감면·가산세 등은 사례 이름의 손계산 식을 사람이 본다(이 도구는 "검산 못 함"으로 표시).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const T = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'reftables', n + '.json'), 'utf8'));
const t201 = T('2부-01'), t202 = T('2부-02'), t203 = T('2부-03'), t210 = T('2부-10');
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
    if (isGift && a.신고세액공제 != null && d) {
      const rr = reportRate(d);
      notes.push('신고세액공제율 ' + (rr != null ? Math.round(rr * 100) + '%(2부-10)' : '표 없음'));
    }
    out.push({ f: path.basename(f), i, 이름: c.이름.slice(0, 70), 날짜: d, verdict, notes: notes.join(' · ') });
  });
});
out.forEach((o) => console.log('[' + o.i + '] ' + o.verdict + ' | ' + o.날짜 + ' | ' + o.이름 + (o.notes ? '\n      ' + o.notes : '')));
const bad = out.filter((o) => /^[⚠✗]/.test(o.verdict) || /✗/.test(o.notes));
console.log('\n모두 ' + out.length + '건 · 조견표로 검산 ' + out.filter((o) => /맞음|⚠|✗/.test(o.verdict)).length + '건 · 다름 ' + bad.length + '건');
