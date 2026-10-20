#!/usr/bin/env node
// [2026.10.20 밤샘 5번] AI 지휘 실제 호출 시험 — 운영 사건을 하나도 바꾸지 않는 길.
//  사건 처리(사건파악·증빙·칸 채우기·AI 자리 세기·도구 실행)는 전부 이 PC 재현기(사건 자료 복사본·메모리, akSandbox_)에서 하고,
//  운영 서버에는 "모델 한 번 부르기"(case_proc_ai step 'model', dry)만 맡긴다 — 서버는 사건을 읽지도 쓰지도 않고 비용·사용량 기록도 안 남긴다.
//  재현기 쪽 쓰기(가짜 드라이브·시트·속성)도 세어서 보인다(메모리에만 일어나지만, 서버였다면 일어났을 쓰기를 확인).
//  사용: node runlocked.js C:/GitHub/netax-replay-wt node --max-old-space-size=450 <이 파일> --replay C:/GitHub/netax-replay-wt --list <목록> [--max-won 300]
//  결과(고객 정보 포함)는 C:/GitHub/netax-replay/results/ailead-live/real_<시각>.json 에만(커밋 안 함).
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const setup = require((opt('--replay') || 'C:/GitHub/netax-replay-wt') + '/lib/setup');
setup.CFG.backendDir = path.join(__dirname, '..', 'gs-backend');
const maxWon = Number(opt('--max-won') || 300);
const list = fs.readFileSync(opt('--list'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const OUT = 'C:/GitHub/netax-replay/results/ailead-live';
// 동기 HTTP — 재현기 함수는 동기라, 작은 node 프로세스로 서버를 부르고 답을 받는다(열쇠는 tools/nx-secret.js)
const HTTP = `const {loadNxSecret}=require(${JSON.stringify(path.join(__dirname, 'nx-secret.js'))});const {key,gas}=loadNxSecret();let b='';process.stdin.on('data',d=>b+=d).on('end',async()=>{const o=JSON.parse(b);o._key=key;for(let i=0;i<3;i++){try{const r=await fetch(gas,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(o)});const t=await r.text();JSON.parse(t);process.stdout.write(t);return;}catch(e){await new Promise(r=>setTimeout(r,3000));}}process.stdout.write(JSON.stringify({ok:false,error:'서버 응답 없음'}));});`;
let serverCalls = 0;
function post(o) {
  serverCalls++;
  const r = cp.spawnSync(process.execPath, ['-e', HTTP], { input: JSON.stringify(Object.assign({ action: 'case_proc_ai', caseId: 'dry', dry: true }, o)), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 280000 });
  try { return JSON.parse(r.stdout); } catch (e) { return { ok: false, error: '응답을 읽지 못함: ' + String(r.stdout || r.stderr).slice(0, 200) }; }
}
const RUN = `
var __won = 0, __writes = { 사건시트: 0, 사건처리저장: 0 };
caseProcAiCall_ = function (model, system, tools, messages) {
  var r = JSON.parse(__post(JSON.stringify({ step: 'model', kind: 'lead', cap: 1000, messages: messages })));
  if (!r || r.ok === false) return { error: (r && r.error) || '서버 응답 없음' };
  __won += r.won || 0; return { json: r.json, won: r.won || 0 };
};
caseProcAiSubJudge_ = function (model, input) {
  var r = JSON.parse(__post(JSON.stringify({ step: 'model', kind: 'sub', model: model, input: input })));
  if (!r || r.ok === false) return { text: JSON.stringify({ 오류: (r && r.error) || '서버 응답 없음' }), won: 0 };
  return { text: r.text, won: r.won || 0 };
};
function __realDry(caseId, maxWon) {
  var out = { turns: [] };
  akSandbox_(caseId, function () {
    // 재현기 안에서도 사건 쓰기 함수가 불리면 센다(akSandbox_가 메모리로 돌림)
    var wu = work_updateCase, cpp = caseProcPatch_;
    work_updateCase = function (p) { __writes.사건시트++; return wu(p); };
    caseProcPatch_ = function (id, f) { __writes.사건처리저장++; return cpp(id, f); };
    var st = function (k, x) { return caseProc_(Object.assign({ caseId: caseId, step: k }, x || {})) || {}; };
    if (st('basic').blocked) { out.blocked = true; return; }
    var ev = st('evidence', { phase: 'read' }), n = 0; while (ev.more && n++ < 8) ev = st('evidence', { phase: 'read' });
    ev = st('evidence');
    var ov = {}; for (var r0 = 0; r0 < 4; r0++) { ov = st('overview'); if (r0 < 3 && ov.loop && ov.loop.again) { ev = st('evidence'); continue; } break; }
    CASEPROC_AI_DRY_ = true;
    var sp = caseProcAiSpots_({ caseId: caseId, ov: { items: ov.items || [], needs: ov.needs || null }, ev: { docTypes: ev.docTypes || [] } });
    out.spots = { ai: sp.ai, ask: sp.ask, gas: sp.gas, need: sp.need, tiers: sp.tiers, plan: sp.plan, inGap: sp.inGap, list: (sp.spots || []).map(function (s) { return s.자리 + '|' + s.주제 + '|' + s.겹; }) };
    var msgs = [], round = 0, r = null;
    while (sp.need && round < 14 && __won < maxWon) {
      r = caseProcAiTurn_({ caseId: caseId, round: round, spent: __won, messages: msgs, entry: sp.entry, items: round === 0 ? ov.items : undefined });
      if (!r || r.ok === false) { out.turns.push({ round: round, error: (r && r.error) || '응답 없음' }); break; }
      out.turns.push({ round: round, calls: r.calls, won: r.won, stop: r.stop, note: r.note });
      msgs.push({ role: 'assistant', content: r.assistant });
      round++;
      if (r.done) break;
      msgs.push({ role: 'user', content: r.toolResults });
    }
    if (r) { out.report = r.report; out.decisions = r.decisions; out.opinions = r.opinions; out.asks = r.asks; out.gaps = r.gaps; out.attaches = r.attaches; }
    CASEPROC_AI_DRY_ = false;
  }, null);
  out.won = Math.round(__won * 10) / 10; out.writes = __writes;
  return JSON.stringify(out);
}`;
const all = [];
list.forEach((folder) => {
  const t0 = Date.now(); serverCalls = 0;
  try {
    const P = setup.prepare(folder, {});
    P.g.ctx.__post = (s) => JSON.stringify(post(JSON.parse(s)));
    P.g.run(RUN);
    const vfs = P.g.ctx.__vfs || null, w0 = vfs ? (vfs.writes || []).length : null;
    const r = JSON.parse(P.g.ctx.__realDry(P.row.id, maxWon));
    r.folder = folder; r.sec = Math.round((Date.now() - t0) / 1000); r.serverCalls = serverCalls;
    all.push(r);
    const tools = {}; (r.turns || []).forEach((t) => (t.calls || []).forEach((c) => { tools[c] = (tools[c] || 0) + 1; }));
    console.log(folder.replace(/\(.*$/, '').slice(0, 2) + '* ' + r.sec + '초 · 자리 ' + (r.spots && r.spots.ai) + ' · 바퀴 ' + (r.turns || []).length + ' · ' + r.won + '원 · 서버 부르기 ' + serverCalls + '(모델만) · 도구 ' + JSON.stringify(tools) + ' · 판단 ' + (r.decisions || []).length + ' · 첨부 ' + (r.attaches || []).length + ' · 재현기 안 사건 쓰기(메모리) ' + JSON.stringify(r.writes) + ((r.turns || []).some((t) => t.error) ? ' · 오류 ' + r.turns.filter((t) => t.error).map((t) => t.error).join('/').slice(0, 160) : ''));
  } catch (e) { all.push({ folder, err: String(e && e.stack || e).slice(0, 500) }); console.log(folder.slice(0, 3) + '* 오류 ' + String(e && e.message || e).slice(0, 200)); }
});
const f = path.join(OUT, 'real_' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 15) + '.json');
fs.writeFileSync(f, JSON.stringify(all, null, 1));
console.log('기록 → ' + f + ' · 합계 ' + Math.round(all.reduce((t, r) => t + (r.won || 0), 0) * 10) / 10 + '원');
