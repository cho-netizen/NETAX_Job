#!/usr/bin/env node
// [2026.10.19 5번 — AI 지휘 흐름 대본 시험(재기만, AI 호출 0)] 모델 부르기(caseProcAiCall_)를 대본으로 바꿔
//  화면이 하는 차례 잇기(spots → turn… → finish)를 그대로 흉내 낸다. 확인하는 것:
//   ① 값 넣기(확실+GAS 후보) → 실제 반영(출처 '🤖 AI 판단') → 칸 채우기를 다시 돌리면 그 질문이 사라지거나 바뀜
//   ② 지어낸 값(987654321)은 거절 ③ 불확실은 AI 의견으로만 ④ 좁은 판단(Haiku)·질문 고르기 기록 ⑤ 비용·바퀴 합계 ⑥ 끝 기록(작업일지·판단 기록)
//  사용: node runlocked.js C:/GitHub/netax-replay-wt node --max-old-space-size=450 <이 파일> --replay C:/GitHub/netax-replay-wt --list <목록>
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const setup = require((opt('--replay') || 'C:/GitHub/netax-replay-wt') + '/lib/setup');
setup.CFG.backendDir = path.join(__dirname, '..', 'gs-backend');
const OUT = 'C:/GitHub/netax-replay/results/ailead-live';
fs.mkdirSync(OUT, { recursive: true });
const list = fs.readFileSync(opt('--list'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const RUN = `
var __calls = [];
caseProcAiCall_ = function (model, system, tools, messages, maxTokens, effort) {
  __calls.push({ model: model, sys: system.length, tools: (tools || []).length, msgs: messages.length, lastHasCache: JSON.stringify(messages[messages.length - 1] || {}).indexOf('cache_control') !== -1 });
  if (model === CASEPROC_AI_LIGHT_MODEL_ || model === CASEPROC_AI_HIGH_MODEL_) return { json: { content: [{ type: 'text', text: '{"답":"후보 1","확실":"불확실","근거":"대본"}' }], stop_reason: 'end_turn' }, won: 0.2 };
  var n = __calls.filter(function (c) { return c.model === CASEPROC_AI_DIRECTOR_MODEL_; }).length;
  var id = function (k) { return 'tu_' + n + '_' + k; };
  if (n === 1) return { json: { content: [{ type: 'text', text: '칸부터 본다' }, { type: 'tool_use', id: id(1), name: 'calc_fill', input: { caseId: 'x' } }], stop_reason: 'tool_use' }, won: 3 };
  if (n === 2) {
    var ctx = caseProcAiCtxLoad_(__caseId), its = ctx.lastItems || [];
    var pick = its.filter(function (it) { return it.ask && it.ask.target && (it.ask.cands || []).length >= 1 && !CASEPROC_AI_USER_ONLY_RE_.test(it.id + ' ' + it.text) && it.ask.cands[0].v != null && it.ask.cands[0].v !== ''; })[0];
    var other = its.filter(function (it) { return it !== pick && it.ask && (it.ask.cands || []).length >= 1; })[0];
    __pick = pick ? { id: pick.id, v: pick.ask.cands[0].v, text: pick.text } : null;
    var c = [{ type: 'text', text: '판단한다' }];
    if (pick) c.push({ type: 'tool_use', id: id(1), name: 'value_set', input: { itemId: pick.id, value: String(pick.ask.cands[0].v), basis: { kind: 'cand' }, why: '대본 시험 — GAS 후보 첫째', sure: '확실' } });
    if (pick) c.push({ type: 'tool_use', id: id(2), name: 'value_set', input: { itemId: pick.id, value: '987654321', basis: { kind: 'doc', file: '없는서류.pdf' }, why: '지어낸 값 시험', sure: '확실' } });
    if (other) c.push({ type: 'tool_use', id: id(3), name: 'value_set', input: { itemId: other.id, value: String(other.ask.cands[0].v), basis: { kind: 'cand' }, why: '대본 시험 — 불확실', sure: '불확실' } });
    if (its[0]) c.push({ type: 'tool_use', id: id(4), name: 'ask_user', input: { itemIds: [its[its.length - 1].id], urgent: true, note: '대본 시험' } });
    c.push({ type: 'tool_use', id: id(5), name: 'quick_judge', input: { question: '대본 시험', material: '재료 줄 하나' } });
    c.push({ type: 'tool_use', id: id(6), name: 'report_tool_gap', input: { want: '대본 시험 — 도구 부족 기록', kind: '없음' } });
    c.push({ type: 'tool_use', id: id(7), name: 'doc_text', input: { file: '아무 서류', find: '잔금' } });
    if (pick) c.push({ type: 'tool_use', id: id(8), name: 'issue_bundle', input: { itemId: pick.id } });
    return { json: { content: c, stop_reason: 'tool_use' }, won: 4 };
  }
  return { json: { content: [{ type: 'text', text: '처리 결과: 대본 시험 보고. 넣은 판단 1개, 여쭐 것 1개.' }], stop_reason: 'end_turn' }, won: 2 };
};
var __caseId = '', __pick = null;
function __mockRun(caseId) {
  __caseId = caseId; __calls = []; __pick = null;
  var res = {};
  akSandbox_(caseId, function () {
    var st = function (k, x) { return caseProc_(Object.assign({ caseId: caseId, step: k }, x || {})) || {}; };
    if (st('basic').blocked) { res.blocked = true; return; }
    var ev = st('evidence', { phase: 'read' }), n = 0; while (ev.more && n++ < 8) ev = st('evidence', { phase: 'read' });
    ev = st('evidence');
    var ov = st('overview');
    var sp = caseProcAi_({ caseId: caseId, step: 'spots', ov: { items: ov.items || [], needs: ov.needs || null }, ev: { docTypes: ev.docTypes || [] } });
    res.spots = { ai: sp.ai, ask: sp.ask, need: sp.need, cap: sp.cap, level: sp.level, tiers: sp.tiers, lightOff: sp.lightOff, list: (sp.spots || []).map(function (s) { return s.자리 + '|' + s.주제 + '|' + s.겹; }) };
    if (!sp.need) { res.finish = caseProcAi_({ caseId: caseId, step: 'finish', mode: 'gas0' }); return; }
    var msgs = [], won = 0, round = 0, r = null;
    while (round < 6) {
      r = caseProcAi_({ caseId: caseId, step: 'turn', round: round, spent: won, messages: msgs, entry: sp.entry, items: round === 0 ? ov.items : undefined });
      if (!r || r.ok === false) { res.err = r && r.error; break; }
      won += r.won || 0; msgs.push({ role: 'assistant', content: r.assistant });
      round++;
      if (r.done) break;
      msgs.push({ role: 'user', content: r.toolResults });
    }
    res.turns = round; res.won = Math.round(won * 10) / 10; res.report = r && r.report;
    res.decisions = (r && r.decisions || []).map(function (d) { return d.itemId + ' = ' + d.value + ' → ' + d.결과; });
    res.opinions = (r && r.opinions || []).length; res.asks = (r && r.asks || []).length; res.gaps = (r && r.gaps || []).length;
    res.toolResultSample = msgs.filter(function (m) { return m.role === 'user' && Array.isArray(m.content); }).map(function (m) { return m.content.map(function (b) { return String(b.content).slice(0, 160); }); });
    res.pick = __pick;
    var ov2 = st('overview');
    res.pickStill = __pick ? (ov2.items || []).some(function (it) { return it.id === __pick.id; }) : null;
    res.itemsBefore = (ov.items || []).length; res.itemsAfter = (ov2.items || []).length;
    // 반영된 출처에 🤖가 남았는지(계산기 상태·처리개요 어디든)
    var sv = caseProcLoad_(caseId) || {}, c2 = akReadCase_(caseId);
    res.aiSrcSeen = (JSON.stringify(sv) + JSON.stringify(c2.사건개요 || {}) + JSON.stringify(c2.작업일지 || [])).indexOf('🤖 AI 판단') !== -1;
    res.finish = caseProcAi_({ caseId: caseId, step: 'finish', mode: 'ai', won: res.won, rounds: round, stop: r && r.stop, spots: sp.spots, tiers: sp.tiers });
    var c3 = akReadCase_(caseId); res.logLine = ((c3.작업일지 || []).slice(-1)[0] || {}).text || '';
    res.aiLeadSaved = ((caseProcLoad_(caseId) || {}).aiLead || []).length;
    // ① 판단 기록 — 유료질문 기록 kind 'cx'(총괄 = id cxl_) · 2번 판정 기록(sv.cxAi.applied by ai)
    var paid = []; try { paid = JSON.parse(ai_paidLogFile_().getBlob().getDataAsString('UTF-8') || '[]'); } catch (e) { res.paidErr = String(e.message || e); }
    res.cxLead = paid.filter(function (r) { return r && r.kind === 'cx' && r.cx && /^cxl_/.test(r.cx.id || ''); }).map(function (r) { return r.cx.items.map(function (it) { return it.kind + '|' + it.shape + '|' + it.answer + '|' + it.sure + '|' + it.facts.slice(0, 60); }); });
    var app = ((caseProcLoad_(caseId) || {}).cxAi || {}).applied || {};
    res.appliedLead = Object.keys(app).filter(function (k) { return app[k] && app[k].tier; }).map(function (k) { return k + '=' + app[k].v + '(' + app[k].tier + ')'; });
    // 세무사님이 AI가 넣은 값을 다른 값으로 고침 → 다음 칸 채우기에서 2번 0) 단계가 cxLogUserFix_로 기록에 '수정'을 붙이는지
    if (__pick) {
      var a0 = app[__pick.id];
      if (a0) { var alt = String(a0.v).replace(/[0-9]$/, function (d) { return String((+d + 1) % 10); }); st('apply', { target: a0.target, value: alt, src: '세무사님 직접 입력', label: a0.label }); st('overview'); }
      var paid2 = []; try { paid2 = JSON.parse(ai_paidLogFile_().getBlob().getDataAsString('UTF-8') || '[]'); } catch (e) {}
      res.userFix = paid2.filter(function (r) { return r && r.kind === 'cx' && r.cx && /^cxl_/.test(r.cx.id || ''); }).map(function (r) { return r.cx.items.filter(function (it) { return it.user; }).map(function (it) { return it.iid + ' ' + it.user.act; }); });
    }
    // ③ 빠진 도구 · ②⑤ 주간 점검표
    res.gapsLog = caseProcAiReadJson_(CASEPROC_AI_GAP_LOG_).length;
    res.runLog = caseProcAiReadJson_(CASEPROC_AI_LOG_NAME_).map(function (r) { return r.mode + ' ' + JSON.stringify(r.tiers || {}); });
    var wk = caseProcAiWeekly_({}); res.weekly = wk.lines; res.weeklyTopics = (wk.topics || []).map(function (t) { return t.topic + ' 고침' + t.fixRate + '% 같음' + t.leadSame + '%'; });
  }, null);
  res.calls = __calls;
  return JSON.stringify(res);
}`;
const out = [];
list.forEach((folder) => {
  try {
    const P = setup.prepare(folder, {});
    P.g.run(RUN);
    const r = JSON.parse(P.g.ctx.__mockRun(P.row.id));
    const logFile = (P.g.ctx.DriveApp && null);
    out.push(Object.assign({ folder }, r));
    console.log(folder + ' 끝 — 바퀴 ' + r.turns + ' · 판단 ' + (r.decisions || []).length + ' · 🤖출처 ' + r.aiSrcSeen + ' · 질문 ' + r.itemsBefore + '→' + r.itemsAfter + (r.err ? ' · 오류 ' + r.err : ''));
  } catch (e) { out.push({ folder, err: String(e && e.stack || e).slice(0, 600) }); console.log(folder + ' 오류 ' + String(e && e.message || e).slice(0, 200)); }
  fs.writeFileSync(path.join(OUT, 'mock_' + path.basename(opt('--list')).replace(/\.txt$/, '') + '.json'), JSON.stringify(out, null, 1));
});
console.log('끝');
