// ============================================================
// [2026.11.10 판정 서버] 판정 서버로 나눈 뒤에도 같은 답이 나오는지 — 돈 0원·서버 호출 0(node 안에서 두 서버를 흉내)
//  ① 원본: gs-backend/JudgeMore.js(+엔진)를 그대로 돌린 judgeMoreRun_
//  ② 나눈 길: job 서버 대리 파일(judge-remote/JudgeRemote.js) → (가짜 UrlFetchApp) → 판정 서버(gs-judge doPost)
//  묶음 이름 전부를 빈 사실·기본 사실로 돌려 결과 JSON이 같은지, 판정 서버 이음매 줄이 모두 정상인지, 판정 창 목록이 같은지 본다.
// 실행: node tools/judge-remote-check.js
// ============================================================
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), GS = path.join(ROOT, 'gs-backend'), GJ = path.join(ROOT, 'gs-judge');
const read = (p) => fs.readFileSync(p, 'utf8');
const html = (dir) => ({ createHtmlOutputFromFile: (n) => ({ getContent: () => read(path.join(dir, n + '.html')) }) });
const textOut = { createTextOutput: (s) => ({ s, setMimeType() { return this; }, getContent() { return s; } }), MimeType: { JSON: 'json' } };
const hol = fs.existsSync(path.join(GS, 'HolidayDates.js')) ? read(path.join(GS, 'HolidayDates.js')) : '';

// 판정 서버
const J = vm.createContext({ console, HtmlService: html(GJ), ContentService: textOut }); J.globalThis = J;
['Generated.js', 'Seams.js', 'Judge.js'].forEach((f) => vm.runInContext(read(path.join(GJ, f)), J, { filename: f }));
// 원본(나누기 전)
const O = vm.createContext({ console, HtmlService: html(GS), ContentService: textOut }); O.globalThis = O;
if (hol) vm.runInContext(hol, O);
vm.runInContext(read(path.join(GJ, 'Generated.js')), O); // 엔진 부르기 등 job 서버 함수(판정 서버에 복사된 것과 같은 원본)
['FamilyMap.js', 'JudgeMore.js', 'JudgeForm.js'].forEach((f) => { if (fs.existsSync(path.join(GS, f))) vm.runInContext(read(path.join(GS, f)).replace(/\r\n/g, '\n'), O, { filename: f }); });
// ↑ 줄끝을 판정 서버 사본(LF)과 같게 — 판정 창 칸 뽑기가 함수 글을 글자 수로 잘라서, CRLF면 뒤 칸이 잘림
// job 서버(나눈 뒤) — 대리 파일 + 판정 창 + 가족 지도
let calls = 0;
const M = vm.createContext({ console, UrlFetchApp: { fetch: (url, opt) => { calls++; const r = vm.runInContext('doPost', J)({ postData: { contents: opt.payload } }); return { getContentText: () => r.s, getResponseCode: () => 200 }; } } }); M.globalThis = M;
if (hol) vm.runInContext(hol, M);
['FamilyMap.js', 'JudgeForm.js'].forEach((f) => { if (fs.existsSync(path.join(GS, f))) vm.runInContext(read(path.join(GS, f)), M, { filename: f }); });
vm.runInContext(read(path.join(GS, 'judge-remote', 'JudgeRemote.js')).replace(/^var JUDGE_SERVER_URL_ = "";/m, 'var JUDGE_SERVER_URL_ = "test";'), M, { filename: 'JudgeRemote.js' });

const keys = vm.runInContext('Object.keys(JUDGE_MORE_)', O);
const keysM = vm.runInContext('Object.keys(JUDGE_MORE_)', M);
let bad = [];
if (JSON.stringify(keys) !== JSON.stringify(keysM)) bad.push('묶음 이름 목록이 다름 ' + keys.length + ' vs ' + keysM.length);
const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === '때' ? undefined : v)));
const run = (ctx, k) => { try { return strip(vm.runInContext('judgeMoreRun_', ctx)(null, { 묶음: k, facts: {}, write: false }, '시험')); } catch (e) { return { 던짐: String(e.message) }; } };
keys.forEach((k) => { const a = JSON.stringify(run(O, k)), b = JSON.stringify(run(M, k)); if (a !== b) bad.push('다름: ' + k + '\n   원본 ' + a.slice(0, 160) + '\n   나눔 ' + b.slice(0, 160)); });
// 판정 창 목록
const ca = JSON.stringify(vm.runInContext('judgeCatalog_()', O)), cb = JSON.stringify(vm.runInContext('judgeCatalog_()', M));
if (ca !== cb) { const A = JSON.parse(ca), B = JSON.parse(cb); const d = A.map((x, i) => JSON.stringify(x) === JSON.stringify(B[i]) ? '' : (x.묶음 + ': ' + JSON.stringify(x).slice(0, 200) + ' ⇢ ' + JSON.stringify(B[i]).slice(0, 200))).filter(Boolean); bad.push('판정 창 목록이 다름 ' + d.length + '줄 — ' + d.slice(0, 2).join(' || ')); }
// 판정 서버 이음매 줄
const seams = vm.runInContext('judgeSeamsRun_()', J), seamBad = seams.filter((s) => s.msg);
// 판 확인 줄(job 서버 이음매 점검 맨 앞)
const verMsg = vm.runInContext('jmSeamFilter_([])', M)[0].fn();
if (verMsg) bad.push('판 확인 줄: ' + verMsg);
// 닿지 못할 때 드러나는지
const M2 = vm.createContext({ console, UrlFetchApp: { fetch: () => { throw new Error('Address unavailable'); } } }); M2.globalThis = M2;
vm.runInContext(read(path.join(GS, 'judge-remote', 'JudgeRemote.js')).replace(/^var JUDGE_SERVER_URL_ = "";/m, 'var JUDGE_SERVER_URL_ = "test";'), M2);
const down = vm.runInContext('judgeMoreRun_', M2)(null, { 묶음: keys[0], facts: {}, write: false }, '시험');
const downOk = down && down.ok === false && /판정 서버에 닿지 못함/.test(down.error || '');

console.log('묶음 이름 ' + keys.length + '개 원본·나눔 비교: ' + (bad.length ? '✗ ' + bad.length + '건' : '✓ 모두 같음') + ' (판정 서버 부름 ' + calls + '번)');
console.log('판정 창 목록: ' + (ca === cb ? '✓ 같음' : '✗ 다름'));
console.log('판정 서버 이음매 줄 ' + seams.length + '개: ' + (seamBad.length ? '✗ ' + seamBad.length + '개 — ' + seamBad.slice(0, 5).map((s) => s.길 + ' → ' + s.msg).join(' / ') : '✓ 모두 정상'));
console.log('판정 서버에 닿지 못할 때: ' + (downOk ? '✓ 「' + down.error + '」로 드러남' : '✗ ' + JSON.stringify(down)));
bad.slice(0, 8).forEach((x) => console.log('  ' + x));
process.exit(bad.length || seamBad.length || !downOk ? 1 : 0);
