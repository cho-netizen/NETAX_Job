#!/usr/bin/env node
// ============================================================
// [2026.10.23 T6 1단계] 읽기 전용 시험 서비스용 조립기 — 사건처리 한 번 호출(caseProcAll_)이 닿는 함수만 추려 node 모듈 하나로 만든다.
// ------------------------------------------------------------
// 원본은 gs-backend/*.js 하나(두 벌 금지). 이 조립기는 손으로 고친 사본을 만들지 않고, 매번 원본에서 다시 추린다.
//  1) 각 .js를 "0열에서 시작하는 선언(function·const·let·var·class)" 단위로 덩어리로 나눈다(이 저장소 코드는 본문이 모두 들여써 있다).
//     0열의 실행 문(Object.assign(X, …) 등)은 바로 앞 덩어리에 붙인다(그 선언의 덧붙임).
//  2) caseProcAll_·caseProcLoad_·caseProcPatch_·WORK_HEADERS에서 출발해, 덩어리 글에 나오는 이름 중 다른 덩어리가 선언한 이름을 따라가며 닿는 덩어리를 모두 모은다.
//  3) dist/reader.js = 머리글 + 모은 덩어리(원본 파일 순서 그대로). GAS 흉내 층(DriveApp 등)은 여기 넣지 않는다 — 돌리는 쪽(tools/run-reader.js)이
//     재현기 C:\GitHub\netax-replay\lib(gas.js·vfs.js)을 그대로 쓴다(설계서 4절 "재현기 shim을 출발점으로, 새로 짓지 않음").
//  4) 보고: 파일별 덩어리 수, 추린 함수 수, 못 찾은 이름(어느 파일에도 선언이 없는 것 — GAS 전역·JS 내장은 빼고) 목록 → dist/reader-report.json
// 사용: node tools/build-reader.js [--out dist/reader.js] [--seeds caseProcAll_,…]
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'gs-backend');
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, argOf('--out', 'dist/reader.js'));
const SEEDS = argOf('--seeds', 'caseProcAll_,caseProcLoad_,caseProcPatch_,caseProcOpenInputs_,WORK_HEADERS,akReadCase_').split(',').map((s) => s.trim()).filter(Boolean);
// 설계서 4절의 네 파일을 먼저 보되, 닿는 선언이 다른 서버 파일(CrossCheckBind 등)에 있으면 그 파일도 쓴다(어느 파일에서 왔는지 보고에 적음)
const FILES = fs.readdirSync(SRC_DIR).filter((f) => /\.js$/.test(f)).sort((a, b) => (a === 'Code.js' ? -1 : b === 'Code.js' ? 1 : a.localeCompare(b)));

// GAS 전역·JS 내장 — "못 찾은 이름"에서 뺀다
const KNOWN = new Set(('DriveApp Drive SpreadsheetApp UrlFetchApp ScriptApp CacheService PropertiesService LockService Session Utilities HtmlService ContentService ' +
  'Logger console MailApp GmailApp CalendarApp DocumentApp SlidesApp Maps Charts FormApp XmlService Jdbc LanguageApp ' +
  'Object Array String Number Boolean Date Math JSON RegExp Error TypeError RangeError Promise Symbol Map Set WeakMap Infinity NaN undefined null true false ' +
  'parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI escape unescape arguments this new typeof instanceof void delete in of ' +
  'function return if else for while do switch case break continue default try catch finally throw var let const class extends super import export yield async await with debugger ' +
  'globalThis eval Function Intl ArrayBuffer Uint8Array Int8Array DataView BigInt Reflect Proxy').split(/\s+/));

// ---------- 1) 덩어리 나누기 ----------
const DECL_RE = /^(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*|\{[^}]*\}|\[[^\]]*\])|class\s+([A-Za-z_$][\w$]*))/;
function splitChunks(src, file) {
  const lines = src.split(/\r?\n/);
  const chunks = [];
  let cur = null;
  const push = () => { if (cur) { cur.text = cur.lines.join('\n'); chunks.push(cur); } };
  lines.forEach((ln, i) => {
    const m = DECL_RE.exec(ln);
    if (m && /^[A-Za-z_$]/.test(ln)) {
      push();
      const names = [];
      if (m[1]) names.push(m[1]);
      else if (m[3]) names.push(m[3]);
      else if (m[2]) { if (/^[{[]/.test(m[2])) m[2].replace(/[A-Za-z_$][\w$]*(?=\s*[,}\]:])/g, (x) => names.push(x)); else names.push(m[2]); }
      cur = { file, start: i + 1, names, lines: [ln], exec: false };
      // 한 줄에 여러 선언(const a = 1, b = 2;) — 뒤의 것도 이름에 넣는다(값 안의 쉼표에 걸릴 수 있어 0단계 괄호에서만)
      if (m[2] && !/^[{[]/.test(m[2])) { let depth = 0, inS = null; for (let k = 0; k < ln.length; k++) { const ch = ln[k]; if (inS) { if (ch === '\\') k++; else if (ch === inS) inS = null; continue; } if (ch === '"' || ch === "'" || ch === '`') inS = ch; else if (/[([{]/.test(ch)) depth++; else if (/[)\]}]/.test(ch)) depth--; else if (ch === ',' && depth === 0) { const mm = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(ln.slice(k + 1)); if (mm) names.push(mm[1]); } } }
      return;
    }
    if (!cur) { cur = { file, start: i + 1, names: [], lines: [], exec: true }; }
    else if (/^[A-Za-z_$]/.test(ln) && !/^\}/.test(ln)) cur.exec = true; // 0열 실행 문 — 앞 덩어리의 덧붙임
    cur.lines.push(ln);
  });
  push();
  return chunks;
}

// 덩어리 글에서 이름 후보(문자열·주석을 거칠게 뺀 뒤) — 넉넉히 잡아도 해가 없다(모듈이 조금 커질 뿐). 정규식 글자는 못 가려 이름이 더 잡힐 수 있다.
function identsOf(text) {
  const t = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ').replace(/`(?:\\[\s\S]|[^`\\])*`/g, ' ').replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, ' ');
  const out = new Set(); let m; const re = /(?<![.\w$])([A-Za-z_$][\w$]*)/g;
  while ((m = re.exec(t))) out.add(m[1]);
  return out;
}

const all = [];
const perFile = {};
FILES.forEach((f) => {
  const src = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
  const ch = splitChunks(src, f);
  perFile[f] = ch.length;
  ch.forEach((c) => all.push(c));
});
const byName = {};
const dup = {};
all.forEach((c, i) => { c.idx = i; c.names.forEach((n) => { if (byName[n] !== undefined) (dup[n] = dup[n] || [all[byName[n]].file]).push(c.file); else byName[n] = i; }); });

// ---------- 2) 닿는 덩어리 모으기 ----------
const need = new Set(), missing = new Set(), queue = [];
SEEDS.forEach((s) => { if (byName[s] === undefined) missing.add(s); else queue.push(byName[s]); });
while (queue.length) {
  const i = queue.shift();
  if (need.has(i)) continue;
  need.add(i);
  const c = all[i];
  if (!c.ids) c.ids = identsOf(c.text);
  c.ids.forEach((n) => {
    if (byName[n] !== undefined) { if (!need.has(byName[n])) queue.push(byName[n]); }
    else if (!KNOWN.has(n) && /_$/.test(n)) missing.add(n); // 끝에 _가 붙은 이름은 이 저장소의 서버 함수 규칙 — 선언이 없으면 진짜 빠진 것
  });
}
// 지역 변수 이름이 우연히 전역 선언과 같아 끌려온 덩어리도 있을 수 있다 — 해롭지 않아 그대로 둔다(보고에 수만 적음)
const picked = Array.from(need).sort((a, b) => a - b).map((i) => all[i]);

// ---------- 3) 쓰기 ----------
const stamp = new Date();
const pad = (n) => String(n).padStart(2, '0');
const at = stamp.getFullYear() + '-' + pad(stamp.getMonth() + 1) + '-' + pad(stamp.getDate()) + ' ' + pad(stamp.getHours()) + ':' + pad(stamp.getMinutes());
let gitSha = ''; try { gitSha = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) {}
const head = [
  '// 자동 생성 — 손으로 고치지 말 것. tools/build-reader.js가 gs-backend/*.js에서 사건처리 한 번 호출(caseProcAll_)에 닿는 선언만 추려 만든 읽기 전용 시험용 모듈.',
  '// 만든 때 ' + at + ' · 원본 ' + (gitSha || '?') + ' · 출발점 ' + SEEDS.join(', ') + ' · 덩어리 ' + picked.length + '/' + all.length,
  '// GAS 전역(DriveApp 등)은 여기 없다 — 돌리는 쪽이 재현기 흉내 층(netax-replay/lib)으로 넣는다.',
  ''
].join('\n');
const body = picked.map((c) => '// ── ' + c.file + ':' + c.start + (c.names.length ? ' ' + c.names.join(', ') : '') + '\n' + c.text).join('\n\n');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, head + body + '\n', 'utf8');

const fromFiles = {};
picked.forEach((c) => { fromFiles[c.file] = (fromFiles[c.file] || 0) + 1; });
const report = {
  at, gitSha, out: path.relative(ROOT, OUT), seeds: SEEDS, chunksPerFile: perFile, pickedPerFile: fromFiles,
  picked: picked.length, total: all.length, bytes: Buffer.byteLength(head + body),
  missing: Array.from(missing).sort(), duplicateNames: dup,
  pickedNames: picked.map((c) => c.names.join(',') || ('(실행 문 ' + c.file + ':' + c.start + ')'))
};
fs.writeFileSync(OUT.replace(/\.js$/, '-report.json'), JSON.stringify(report, null, 1), 'utf8');
console.log('조립 ' + path.relative(ROOT, OUT) + ' — 덩어리 ' + picked.length + '/' + all.length + ' (' + Object.keys(fromFiles).map((f) => f + ' ' + fromFiles[f]).join(', ') + '), ' + Math.round(report.bytes / 1024) + 'KB');
if (missing.size) console.log('선언을 못 찾은 이름(끝 _ 규칙) ' + missing.size + '개: ' + Array.from(missing).sort().join(', '));
if (Object.keys(dup).length) console.log('같은 이름이 두 파일에: ' + Object.keys(dup).map((k) => k + '(' + dup[k].join('·') + ')').join(', '));
