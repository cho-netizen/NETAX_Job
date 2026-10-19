#!/usr/bin/env node
// [2026.10.19 5번 — AI 지휘 검수(재기만, AI 호출 0)] 운영판(main)과 AI 지휘 가지의 "GAS 입구 상수 한 바퀴" 결과를 같은 사건으로 나란히.
//  사건마다: 사건파악 → 증빙 읽기·대조 → 칸 채우기 반복(최대 4) → 계산 단계 — 그 뒤 처리개요·계산기 상태·질문 id를 뽑고,
//  AI 지휘 가지면 AI 자리 세기(case_proc_ai step 'spots')도 부른다. 결과(고객 정보 포함)는 netax-replay/results/ailead-live/ 에만.
//  사용: node C:/GitHub/netax-inventory/runlocked.js C:/GitHub/netax-replay-wt node --max-old-space-size=450 tools/ailead-live-check.js
//        --replay C:/GitHub/netax-replay-wt --backend <gs-backend 폴더> --tag <main|live> --list <사건 목록 파일>
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const setup = require((opt('--replay') || 'C:/GitHub/netax-replay-wt') + '/lib/setup');
setup.CFG.backendDir = opt('--backend') || path.join(__dirname, '..', 'gs-backend');
const tag = opt('--tag') || 'live';
const OUT = 'C:/GitHub/netax-replay/results/ailead-live';
fs.mkdirSync(OUT, { recursive: true });
const list = fs.readFileSync(opt('--list'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const RUN = `
function __lc(caseId) {
  var res = {};
  akSandbox_(caseId, function () {
    var st = function (k, x) { return caseProc_(Object.assign({ caseId: caseId, step: k }, x || {})) || {}; };
    var b = st('basic');
    if (b.blocked) { res.blocked = true; return; }
    var ev = st('evidence', { phase: 'read' }), n = 0; while (ev.more && n++ < 8) ev = st('evidence', { phase: 'read' });
    ev = st('evidence');
    var ov = {};
    for (var r = 0; r < 4; r++) { ov = st('overview'); if (r < 3 && ov.loop && ov.loop.again) { ev = st('evidence'); continue; } break; }
    var calc = st('calc');
    var c = akReadCase_(caseId), o = c.사건개요 || {}, snap = {};
    Object.keys(o).sort().forEach(function (k) { var v = o[k]; if (v !== '' && v != null && !(Array.isArray(v) && !v.length)) snap['개요.' + k] = JSON.stringify(v).slice(0, 300); });
    snap['기준일'] = c.기준일 || ''; snap['법정일'] = c.법정일 || '';
    var sv = caseProcLoad_(caseId) || {};
    var flat = function (pre, v, d) { if (d > 4 || v == null) return; if (typeof v !== 'object') { if (v !== '' && v !== false && v !== 0) snap[pre] = String(v).slice(0, 120); return; } if (Array.isArray(v)) { v.slice(0, 12).forEach(function (x, i) { flat(pre + '[' + i + ']', x, d + 1); }); return; } Object.keys(v).forEach(function (k) { if (/^(src|srcs|at|updated|log|_)/.test(k)) return; flat(pre + '.' + k, v[k], d + 1); }); };
    if (sv.trCalc && sv.trCalc.state) flat('계산기', { assets: sv.trCalc.state.transferAssets, contracts: sv.trCalc.state.transferContracts, sellers: sv.trCalc.state.transferSellers }, 0);
    if (sv.ihChoices) flat('상속결정', sv.ihChoices, 0);
    res.snap = snap;
    res.items = (ov.items || []).concat(calc.items || []).map(function (it) { return it.id; });
    res.missing = (ov.needs && ov.needs.missing) || [];
    if (typeof caseProcAiSpots_ === 'function') {
      var sp = caseProcAiSpots_({ caseId: caseId, ov: { items: ov.items || [], needs: ov.needs || null }, ev: { docTypes: ev.docTypes || [] } });
      res.spots = { ai: sp.ai, ask: sp.ask, gas: sp.gas, level: sp.level, cap: sp.cap, need: sp.need, byWhy: sp.byWhy, tiers: sp.tiers, plan: sp.plan, inGap: sp.inGap, list: (sp.spots || []).map(function (s) { return s.자리 + '|' + s.이유 + '|' + s.수준 + '|' + (s.주제 || '') + '|' + String(s.설명 || '').slice(0, 80); }), entryLen: (sp.entry || '').length };
    }
  }, null);
  return JSON.stringify(res);
}`;
const out = [];
list.forEach((folder) => {
  const t0 = Date.now();
  try {
    const P = setup.prepare(folder, {});
    P.g.run(RUN);
    const r = JSON.parse(P.g.ctx.__lc(P.row.id));
    out.push(Object.assign({ folder, ms: Date.now() - t0 }, r));
    console.log(tag + ' ' + folder + ' 끝 ' + Math.round((Date.now() - t0) / 1000) + '초');
  } catch (e) { out.push({ folder, err: String(e && e.message || e).slice(0, 300) }); console.log(tag + ' ' + folder + ' 오류 ' + String(e && e.message || e).slice(0, 120)); }
  fs.writeFileSync(path.join(OUT, tag + '_' + path.basename(opt('--list')).replace(/\.txt$/, '') + '.json'), JSON.stringify(out, null, 1));
});
console.log('끝 ' + out.length + '건');
