#!/usr/bin/env node
// [2026.10.21] 주간 개발자 실행 기록 — 웹 Claude 루틴("job 개선 후보 처리")이 끝날 때 한 줄을 남긴다.
//  세무사님 결정(2026-10-21 "진행하고 다음항목으로 넘어가자"): 루틴이 실패하거나 후보를 넘긴 사실이 job에 남지 않던 문제 —
//  10-12 실행은 주간 한도에 걸려 1초 만에 멈췄는데 "성공"으로 남았고, 10-19 실행이 넘긴 38건의 사유는 수정안 글에만 있었다.
//  기록은 깃허브 전용 가지 routine-log 의 docs/routine-log.json(배열, 최근 60건)에 덧붙인다. 작업 중인 파일·가지는 건드리지 않는다
//  (git 내부 명령으로 새 커밋을 만들어 그 가지에만 올린다). job이 그 파일을 읽어 대시보드에 보여 준다(Federation.js commRoutineLog_).
//
//  사용(루틴 마지막 단계):
//    node tools/routine-log.js --json '{"status":"ok","summary":"…","fixed":["…"],"skipped":[{"item":"…","reason":"…","pc":true}],"pr":"https://…"}'
//    node tools/routine-log.js --json '…' --dry      ← 올리지 않고 만들 기록만 보여 줌
//  status: ok(정상) | error(멈춤·실패) | none(이번 주 후보 없음). pc=true는 "여기(클라우드)서는 못 하고 PC에서 해야 하는 일"(드라이브 자료 필요 등).
//  공개 저장소다 — 고객 이름·사건명·전화·주민번호·질문 원문을 쓰지 않는다(일반화해서).
'use strict';
const cp = require('child_process');
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const dry = argv.indexOf('--dry') >= 0;
const BR = 'routine-log', FILE = 'docs/routine-log.json';
const git = (args, input) => cp.execFileSync('git', args, { encoding: 'utf8', input: input, stdio: ['pipe', 'pipe', 'pipe'] }).trim();

let entry;
try { entry = JSON.parse(opt('--json') || ''); } catch (e) { console.error('--json 이 올바른 JSON이 아닙니다: ' + e.message); process.exit(2); }
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // 한국 날짜
const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
const clean = {
  date: cut(entry.date || today, 10),
  status: /^(ok|error|none)$/.test(entry.status) ? entry.status : 'ok',
  summary: cut(entry.summary, 600),
  fixed: (Array.isArray(entry.fixed) ? entry.fixed : []).slice(0, 30).map((x) => cut(x, 200)),
  skipped: (Array.isArray(entry.skipped) ? entry.skipped : []).slice(0, 80).map((x) => ({ item: cut(x && x.item, 200), reason: cut(x && x.reason, 300), pc: !!(x && x.pc) })),
  pr: cut(entry.pr, 200),
  by: cut(entry.by || 'web-routine', 40)
};

let base = '';
try { git(['fetch', '-q', 'origin', BR]); base = git(['rev-parse', 'FETCH_HEAD']); } catch (e) { base = ''; } // 가지가 아직 없으면 새로 시작
let arr = [];
if (base) { try { arr = JSON.parse(git(['show', base + ':' + FILE])); } catch (e) { arr = []; } }
if (!Array.isArray(arr)) arr = [];
arr.push(clean);
arr = arr.slice(-60);
const body = JSON.stringify(arr, null, 1) + '\n';
if (dry) { console.log(JSON.stringify(clean, null, 1)); console.log('(올리지 않음 — 기존 ' + (arr.length - 1) + '건 + 1)'); process.exit(0); }

// 작업 트리를 건드리지 않고 커밋 만들기: blob → docs 트리 → 루트 트리 → 커밋 → 가지로 올리기
const blob = git(['hash-object', '-w', '--stdin'], body);
const docsTree = git(['mktree'], '100644 blob ' + blob + '\troutine-log.json\n');
const rootTree = git(['mktree'], '040000 tree ' + docsTree + '\tdocs\n');
const msg = '주간 개발자 실행 기록 ' + clean.date + ' (' + clean.status + ')';
const commit = git(base ? ['commit-tree', rootTree, '-p', base, '-m', msg] : ['commit-tree', rootTree, '-m', msg]);
git(['push', '-q', 'origin', commit + ':refs/heads/' + BR]);
console.log('기록함: ' + BR + ' ' + commit.slice(0, 7) + ' — ' + msg);
