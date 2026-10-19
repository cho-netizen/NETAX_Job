#!/usr/bin/env node
// [2026.10.20 밤샘 5번] AI 지휘 실제 호출 시험(시험 모드 — 사건에 값·첨부·작업일지를 쓰지 않음, 비용 기록은 [시험]).
//  운영 서버에 열쇠(tools/nx-secret.js)로 "이 사건 처리하자"의 서버 단계만 차례로 부른다:
//   case_proc basic → evidence(read …) → evidence → overview → case_proc_ai spots(dry) → turn(dry)… (화면의 사진 나누기·보정·계산·PDF는 안 함)
//  사용: node tools/ailead-real-dry.js <사건id> [<사건id> …] [--max-won 300]
//  결과(고객 정보 포함)는 C:/GitHub/netax-replay/results/ailead-live/real_<시각>.json 에만(커밋 안 함), 화면에는 숫자만.
'use strict';
const fs = require('fs'), path = require('path');
const { loadNxSecret } = require('./nx-secret');
const { key: KEY, gas: GAS } = loadNxSecret();
const argv = process.argv.slice(2);
const maxWon = argv.indexOf('--max-won') >= 0 ? Number(argv[argv.indexOf('--max-won') + 1]) : 300;
const ids = argv.filter((a, i) => !/^--/.test(a) && argv[i - 1] !== '--max-won');
const OUT = 'C:/GitHub/netax-replay/results/ailead-live';
const call = async (action, body, tries) => {
  for (let i = 0; i < (tries || 3); i++) {
    try {
      const r = await fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, _key: KEY }, body)) });
      const t = await r.text();
      try { return JSON.parse(t); } catch (e) { if (i === (tries || 3) - 1) return { error: '응답이 JSON이 아님: ' + t.slice(0, 120) }; }
    } catch (e) { if (i === (tries || 3) - 1) return { error: String(e.message || e) }; }
    await new Promise((r) => setTimeout(r, 3000));
  }
};
(async () => {
  const all = [];
  for (const caseId of ids) {
    const t0 = Date.now(), rec = { caseId, steps: [], turns: [], won: 0 };
    const st = (step, x) => call('case_proc', Object.assign({ caseId, step }, x || {}));
    const b = await st('basic'); rec.steps.push('basic ' + (b.error || 'ok'));
    if (b.blocked || b.error) { all.push(rec); continue; }
    let ev = await st('evidence', { phase: 'read' }), n = 0;
    while (ev && ev.more && n++ < 8) ev = await st('evidence', { phase: 'read' });
    ev = await st('evidence'); rec.steps.push('evidence ' + (ev.error || 'ok'));
    const ov = await st('overview'); rec.steps.push('overview ' + (ov.error || ('질문 ' + (ov.items || []).length)));
    const sp = await call('case_proc_ai', { caseId, step: 'spots', dry: true, ov: { items: ov.items || [], needs: ov.needs || null }, ev: { docTypes: (ev.docTypes || []).slice(0, 80) } });
    rec.spots = sp && { ai: sp.ai, ask: sp.ask, gas: sp.gas, need: sp.need, tiers: sp.tiers, plan: sp.plan, lightOff: sp.lightOff, lightUsd: sp.lightUsd, error: sp.error };
    rec.won += Math.round(((sp && sp.lightUsd) || 0) * 1400 * 10) / 10;
    if (sp && sp.need) {
      const msgs = [];
      for (let round = 0; round < 14 && rec.won < maxWon; round++) {
        const r = await call('case_proc_ai', { caseId, step: 'turn', dry: true, round, spent: rec.won, messages: msgs, entry: sp.entry, items: round === 0 ? ov.items : undefined }, 2);
        if (!r || r.ok === false || r.error) { rec.turns.push({ round, error: (r && r.error) || '응답 없음' }); break; }
        rec.won = Math.round((rec.won + (r.won || 0)) * 10) / 10;
        rec.turns.push({ round, calls: r.calls, won: r.won, ms: r._ms, stop: r.stop });
        if (r.assistant) msgs.push({ role: 'assistant', content: r.assistant });
        if (r.done) { rec.report = r.report; rec.decisions = r.decisions; rec.opinions = r.opinions; rec.asks = r.asks; rec.gaps = r.gaps; rec.attaches = r.attaches; break; }
        msgs.push({ role: 'user', content: r.toolResults || [] });
      }
    }
    rec.sec = Math.round((Date.now() - t0) / 1000);
    all.push(rec);
    const tools = {}; rec.turns.forEach((t) => (t.calls || []).forEach((c) => { tools[c] = (tools[c] || 0) + 1; }));
    console.log(caseId.slice(0, 6) + '… ' + rec.sec + '초 · 자리 ' + (rec.spots && rec.spots.ai) + ' · 바퀴 ' + rec.turns.length + ' · ' + rec.won + '원 · 도구 ' + JSON.stringify(tools) + ' · 판단 ' + ((rec.decisions || []).length) + ' · 첨부 ' + ((rec.attaches || []).length) + (rec.turns.some((t) => t.error) ? ' · 오류 ' + rec.turns.filter((t) => t.error).map((t) => t.error).join('/').slice(0, 120) : ''));
  }
  const f = path.join(OUT, 'real_' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 15) + '.json');
  fs.writeFileSync(f, JSON.stringify(all, null, 1));
  console.log('기록 → ' + f + ' · 합계 ' + Math.round(all.reduce((t, r) => t + r.won, 0) * 10) / 10 + '원');
})();
