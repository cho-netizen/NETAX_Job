#!/usr/bin/env node
// [2026.10.20 밤샘 5번] 서버 시험 모드(case_proc_ai dry)의 쓰기가 0인지 재현기에서 센다(모델 응답은 가짜 — AI 호출 0).
//  앞뒤로 비교: 가짜 드라이브 파일 수·쓰기 기록(setContent·이름 바꾸기·휴지통)·스크립트 속성·사건 행·사건처리 저장, 그리고 쓰기 함수 호출 수.
//  사용: node runlocked.js C:/GitHub/netax-replay-wt node --max-old-space-size=450 <이 파일> --replay C:/GitHub/netax-replay-wt "<사건폴더>"
'use strict';
const path = require('path');
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const setup = require((opt('--replay') || 'C:/GitHub/netax-replay-wt') + '/lib/setup');
setup.CFG.backendDir = path.join(__dirname, '..', 'gs-backend');
const folder = argv.filter((a, i) => !/^--/.test(a) && argv[i - 1] !== '--replay')[0];
const P = setup.prepare(folder, {});
const vfs = P.g.ctx.__rp.vfs, props = P.g.propStore;
props.ANTHROPIC_API_KEY = 'test-key';
const countFiles = () => Object.keys(vfs.byId || {}).length;
P.g.ctx.UrlFetchApp = { fetch: (url, o) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: '{"답":"후보 1","확실":"불확실","근거":"가짜"}' }], stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 100 } }) }) };
P.g.run(`var __wc = { work_updateCase: 0, caseProcPatch_: 0, caseProcStore_: 0, ai_logPaid_: 0, ai_recordUsage_: 0, cxLogUserAnswer_: 0, cpSecuredFlush_: 0 };
  Object.keys(__wc).forEach(function (k) { if (typeof this[k] !== 'function') return; var f = this[k]; this[k] = function () { __wc[k]++; return f.apply(null, arguments); }; }, this);`);
// 앞 상태를 읽는 것 자체가 가짜 드라이브에 빈 점검 폴더를 만들 수 있어(caseProcLoad_ → 폴더 찾기·만들기) 한 번 먼저 읽고 센다
P.g.run('caseProcLoad_(' + JSON.stringify(P.row.id) + ')');
const before = { files: countFiles(), writes: (vfs.writes || []).length, log: (vfs.log || []).length, props: JSON.stringify(props), case: P.g.run('JSON.stringify(akReadCase_(' + JSON.stringify(P.row.id) + '))'), saved: P.g.run('JSON.stringify(caseProcLoad_(' + JSON.stringify(P.row.id) + '))') };
const calls = [
  { step: 'model', kind: 'lead', messages: [{ role: 'user', content: '시험' }] },
  { step: 'model', kind: 'sub', input: { question: '시험', material: '재료' } },
  { step: 'turn', round: 0, messages: [] },
  { step: 'spots', ov: { items: [] }, ev: { docTypes: [] } },
  { step: 'finish' }
];
const res = calls.map((c) => { const r = JSON.parse(P.g.run('JSON.stringify(caseProcAi_(' + JSON.stringify(Object.assign({ caseId: 'dry', dry: true }, c)) + '))')); return c.step + (c.kind ? '/' + c.kind : '') + ' → ' + (r.ok ? 'ok' + (r.won != null ? ' ' + r.won + '원' : '') : '거절: ' + String(r.error).slice(0, 60)); });
const after = { files: countFiles(), writes: (vfs.writes || []).length, log: (vfs.log || []).length, props: JSON.stringify(props), case: P.g.run('JSON.stringify(akReadCase_(' + JSON.stringify(P.row.id) + '))'), saved: P.g.run('JSON.stringify(caseProcLoad_(' + JSON.stringify(P.row.id) + '))') };
const wc = JSON.parse(P.g.run('JSON.stringify(__wc)'));
console.log(res.join('\n'));
console.log('드라이브 파일 수 ' + before.files + '→' + after.files + ' · 쓰기 기록 ' + before.writes + '→' + after.writes + ' · 이름·휴지통 기록 ' + before.log + '→' + after.log + ' · 속성 ' + (before.props === after.props ? '그대로' : '바뀜') + ' · 사건 행 ' + (before.case === after.case ? '그대로' : '바뀜') + ' · 사건처리 저장 ' + (before.saved === after.saved ? '그대로' : '바뀜'));
console.log('쓰기 함수 호출 ' + JSON.stringify(wc) + ' → 합 ' + Object.keys(wc).reduce((t, k) => t + wc[k], 0));
