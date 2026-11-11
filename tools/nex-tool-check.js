#!/usr/bin/env node
// [2026.11.04] 넥스 도구 검문 — 재발 방지 장치(글이 아니라 기계가 막는다).
//  세무사님(11-04): "당장 고치고, 나아가 재발방지대책도 강구하라" — 원인은 지적받을 때마다 넥스 도구·지시문을 덧붙이고 옛것을 안 걷어 낸 것
//  (넥스_일하는방식_전면재검토_20261104: 같은 일에 도구 2~5개, 지시문 2만 자 모순, 없는 도구를 가리키는 줄).
//  이 검문은 올리기 전(change-check.js가 부름)마다 돈다. 🚫면 올라가지 않는다:
//   ① 사건 대화에서 넥스가 쥐는 도구 수가 기준(tools/nex-tool-baseline.json)보다 늘면 🚫 — 하나 더하려면 하나 걷어 내거나,
//      기준 파일에 「이유」를 적고 숫자를 올린다(그 줄이 차이로 보이게).
//   ② 넥스 지시문(사건 대화 지시문 nxCaseChatGuide_ + 대화창 고정 지시문) 글자 수가 기준보다 늘면 🚫 — 같은 규칙.
//   ③ 지시문·도구 설명이 이미 없앤 도구(ask_user·value_set·tax_calc·caseproc_answer…)를 가리키면 🚫.
//   ④ 같은 일을 하는 길이 둘이면 🚫 — 값 넣기는 case_ledger 하나(value_set·tax_calc가 사건 대화에 다시 들어오면 막음).
//  돌리기: node tools/nex-tool-check.js   (종료코드 1 = 🚫)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), GS = path.join(ROOT, 'gs-backend');
const rd = (f) => fs.readFileSync(path.join(GS, f), 'utf8').replace(/\r\n/g, '\n');
const code = rd('Code.js'), live = rd('AiLeadLive.js'), lead = rd('AiLead.js');
const names = (src, re) => { const out = []; let m; while ((m = re.exec(src))) out.push(m[1]); return out; };
const list = (src, head) => { const i = src.indexOf(head); if (i < 0) return null; const j = Math.min.apply(null, ['];', ']);'].map((e) => { const k = src.indexOf(e, i); return k < 0 ? 1e12 : k; })); return names(src.slice(i, j), /'([a-z_0-9]+)'/g); };

// ① 사건 대화 도구 수(정적으로 셈 — Code.js의 조립과 같은 식)
const basic = list(code, 'const BASIC_TOOL_NAMES_ = new Set([');
const caseproc = names(lead.slice(lead.indexOf('var CASEPROC_AI_TOOLS_'), lead.indexOf('\n];', lead.indexOf('var CASEPROC_AI_TOOLS_'))), /\{ name: '([a-z_0-9]+)'/g);
const noTools = []; // [2026.11.11] 걸러 낼 옛 도구(CASEPROC_AI_NO_TOOLS_)는 정의 자체를 지워 없어짐
const skip = list(live, 'var NX_CASE_CHAT_SKIP_ = [') || [];
const liveFn = live.slice(live.indexOf('function caseProcAiLiveTools_()'), live.indexOf('\n}\n', live.indexOf('function caseProcAiLiveTools_()')));
const pushed = names(liveFn, /tools\.push\(\{ name: '([a-z_0-9]+)'/g);
const inChat = new Set(basic);
caseproc.filter((n) => noTools.indexOf(n) === -1 && skip.indexOf(n) === -1).forEach((n) => inChat.add(n));
pushed.filter((n) => skip.indexOf(n) === -1).forEach((n) => inChat.add(n));
inChat.add('report_parts');
const toolCount = inChat.size;

// ② 지시문 글자 수
const gStart = live.indexOf('function nxCaseChatGuide_('), gEnd = live.indexOf('\n}\n', gStart);
const guide = gStart >= 0 ? live.slice(gStart, gEnd) : '';
const sStart = code.indexOf("let staticExtra = '';"), sEnd = code.indexOf('const staticText =', sStart);
const stat = sStart >= 0 && sEnd > sStart ? code.slice(sStart, sEnd) : '';
const strOnly = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'); // 주석 줄은 빼고
const promptChars = strOnly(guide).length + strOnly(stat).length;

// ③ 없앤 도구 이름이 지시문·도구 설명에 남아 있나
const RETIRED = ['ask_user', 'report_tool_gap', 'gas_run', 'gas_finish', 'save_draft', 'doc_view', 'docs_read', 'doc_text', 'value_set', 'tax_calc', 'caseproc_answer', 'caseproc_fix', 'caseproc_undo', 'caseproc_decide', 'caseproc_scope'];
const propStart = code.indexOf("name: 'job_propose_action'"), propEnd = code.indexOf('input_schema:', propStart);
// [2026.11.11 전면 재검토 ①] 도구 설명문도 본다 — 11-04 검문은 지시문만 봐서 case_read·doc_find·law_attach·close_question·form_needs 설명 속
//  옛 이름(value_set·ask_user·tax_calc·gas_run)과 옛 「GAS 한 바퀴」 표현을 못 잡았다. 설명문(description 글)만 뽑아 본다(코드 주석은 역사라 안 봄).
const descs = (src) => { const out = []; const re = /description: '((?:[^'\\]|\\.)*)'/g; let m; while ((m = re.exec(src))) out.push(m[1]); return out.join('\n'); };
const toolDefs = lead.slice(lead.indexOf('var CASEPROC_AI_TOOLS_'), lead.indexOf('\n];', lead.indexOf('var CASEPROC_AI_TOOLS_'))) + '\n' + liveFn + '\n' + live.slice(live.indexOf('var NX_CASE_REPORT_TOOL_'), live.indexOf('\n', live.indexOf('input_schema', live.indexOf('var NX_CASE_REPORT_TOOL_'))));
const RETIRED_PHRASES = ['GAS 한 바퀴', 'GAS로 처리']; // 10-31 걷어 낸 "한 바퀴" 묶음 길(공통원칙 1절)
const texts = [['사건 대화 지시문(nxCaseChatGuide_)', strOnly(guide)], ['대화창 고정 지시문(staticExtra)', strOnly(stat)], ['job_propose_action 설명', strOnly(code.slice(propStart, propEnd))], ['넥스 사건 도구 설명문', descs(toolDefs)]];
const stale = [];
texts.forEach(([label, t]) => RETIRED_PHRASES.forEach((p) => { let i = t.indexOf(p); while (i !== -1) { stale.push(label + ': 「' + p + '」 — …' + t.slice(Math.max(0, i - 30), i + p.length + 30).replace(/\s+/g, ' ') + '…'); i = t.indexOf(p, i + 1); } }));
texts.forEach(([label, t]) => RETIRED.forEach((n) => {
  const re = new RegExp('(^|[^_a-zA-Z0-9])' + n + '([^_a-zA-Z0-9]|$)', 'g'); let m;
  while ((m = re.exec(t))) { const ctx = t.slice(Math.max(0, m.index - 30), m.index + n.length + 30).replace(/\s+/g, ' '); if (!/없다|없어졌다|뺌|않는다|제안 길이 없다/.test(t.slice(m.index - 60, m.index + n.length + 60))) stale.push(label + ': ' + n + ' — …' + ctx + '…'); }
}));

// ④ 같은 일 두 길
const dup = [];
['value_set', 'tax_calc', 'ask_user', 'report_tool_gap', 'save_draft', 'doc_view'].forEach((n) => { if (inChat.has(n)) dup.push(n + '이(가) 사건 대화 도구에 다시 들어옴(case_ledger·calc·report_capability_gap 한 길 원칙)'); });

// 기준과 비교
const basePath = path.join(ROOT, 'tools', 'nex-tool-baseline.json');
let base = null; try { base = JSON.parse(fs.readFileSync(basePath, 'utf8')); } catch (e) { base = null; }
const block = [], warn = [];
if (!base) warn.push('기준 파일 tools/nex-tool-baseline.json 없음 — 지금 값으로 만들 것');
else {
  if (toolCount > base.caseChatTools) block.push('넥스 사건 대화 도구 ' + base.caseChatTools + ' → ' + toolCount + '개로 늘어남 — 하나 더하면 하나 걷어 내거나, 기준 파일에 이유를 적고 숫자를 올릴 것');
  if (promptChars > base.promptChars) block.push('넥스 지시문 ' + base.promptChars + ' → ' + promptChars + '자로 늘어남 — 줄을 더하면 그만큼 줄이거나, 기준 파일에 이유를 적고 숫자를 올릴 것');
  if (!base.reason || !/\d{4}-\d{2}-\d{2}/.test(String(base.reason))) block.push('기준 파일에 「reason」(날짜 + 왜 이 숫자인지)이 없음');
}
stale.forEach((s) => block.push('없앤 도구를 가리키는 글 — ' + s));
dup.forEach((s) => block.push(s));

const summary = '넥스 도구 검문 — 사건 대화 도구 ' + toolCount + '개(기준 ' + (base ? base.caseChatTools : '-') + ') · 지시문 ' + promptChars + '자(기준 ' + (base ? base.promptChars : '-') + ')';
module.exports = { block, warn, summary, toolCount, promptChars, tools: Array.from(inChat).sort() };
if (require.main === module) {
  console.log(summary);
  if (process.argv.indexOf('--list') !== -1) console.log(Array.from(inChat).sort().join(' '));
  if (block.length) console.log('🚫 ' + block.join('\n🚫 '));
  if (warn.length) console.log('⚠ ' + warn.join('\n⚠ '));
  if (!block.length && !warn.length) console.log('✓ 도구 수·지시문 길이 기준 안, 없앤 도구 이름 없음, 값 넣기 한 길');
  process.exit(block.length ? 1 : 0);
}
