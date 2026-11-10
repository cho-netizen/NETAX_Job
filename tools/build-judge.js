// ============================================================
// [2026.11.10] 판정 서버 짓기 — 세무사님 11-10 "가안으로 하자"(총괄관리자\_기록\판정서버_분리_계획서_20261110.html)
// ------------------------------------------------------------
// job 서버(gs-backend)가 구글 크기 한도(약 10MB)에 닿아, 모의사건마다 커지는 판정 묶음 계산을 새 GAS 프로젝트
// (gs-judge)로 옮긴다. 원본은 그대로 gs-backend/JudgeMore.js 하나 — 손으로 두 벌 고치지 않도록 이 도구가 만든다:
//  1) gs-judge/Generated.js  — 판정 함수와 그것이 쓰는 함수(엔진 부르기·날짜 셈 등)만 복사(tools/build-light.js gs-judge)
//  2) gs-judge/manage/taxcalc-engine.html — 세액 엔진 사본(원본 gs-backend/manage/taxcalc-engine.html)
//  3) gs-judge/Seams.js — 배포 직후 이음매 점검 줄 중 판정만 쓰는 줄(Federation.js commSeamList_에서 골라 복사)
//  4) gs-backend/judge-remote/JudgeRemote.js — job 서버 쪽: 판정 서버를 부르는 대리 함수(이름·묶음 이름 그대로),
//     판정 입구 judgeMoreRun_·judgeOutOfScope_ 사본(장부 적기는 job 서버에서), 판정 창 목록(미리 계산),
//     이음매 줄 거르기. 이 파일은 하위 폴더라 직결(Cloud Run)·시험 도구(맨 위 .js만 읽음)에는 들어가지 않는다 —
//     그쪽은 원본 JudgeMore.js를 그대로 쓴다. job 서버 올리기에서는 .claspignore가 JudgeMore.js를 뺀다.
// 실행: node tools/build-judge.js  (JudgeMore.js·JudgeForm.js·Federation.js·엔진을 고쳤으면 매번)
// ============================================================
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), GS = path.join(ROOT, 'gs-backend'), GJ = path.join(ROOT, 'gs-judge');
const read = (p) => fs.readFileSync(p, 'utf8');

// 1) 판정 함수 복사
cp.execFileSync(process.execPath, [path.join(__dirname, 'build-light.js'), 'gs-judge'], { stdio: 'inherit' });
// 2) 엔진 사본
fs.mkdirSync(path.join(GJ, 'manage'), { recursive: true });
fs.copyFileSync(path.join(GS, 'manage', 'taxcalc-engine.html'), path.join(GJ, 'manage', 'taxcalc-engine.html'));

// 판정 서버와 같은 코드를 node에서 띄워 묶음 이름·함수 이름·판정 창 목록을 뽑는다
const ctx = vm.createContext({ console, Date, Math, JSON });
ctx.globalThis = ctx;
ctx.HtmlService = { createHtmlOutputFromFile: (n) => ({ getContent: () => read(path.join(GJ, n + '.html')) }) };
ctx.ContentService = { createTextOutput: () => ({ setMimeType: function () { return this; } }), MimeType: { JSON: 'json' } };
vm.runInContext(read(path.join(GJ, 'Generated.js')), ctx, { filename: 'Generated.js' });
vm.runInContext(read(path.join(GS, 'JudgeForm.js')), ctx, { filename: 'JudgeForm.js' });
const JM = vm.runInContext('JUDGE_MORE_', ctx);
const keys = Object.keys(JM);
const fns = [], fnInfo = [];
keys.forEach((k) => {
  const f = JM[k]; let i = fns.indexOf(f);
  if (i === -1) {
    fns.push(f); const nm = (/^function\s+([\w$]+)/.exec(String(f)) || [])[1] || '';
    const named = !!nm && vm.runInContext('typeof ' + nm + ' === "function" ? ' + nm + ' : null', ctx) === f;
    fnInfo.push({ name: named ? nm : '', firstKey: k });
  }
});
const catalog = vm.runInContext('judgeCatalog_()', ctx);

// job 서버 맨 위 선언 이름 모두 / 판정 서버 선언 이름
const DECL_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/;
const declsOf = (src) => src.split(/\r?\n/).map((l) => DECL_RE.exec(l)).filter(Boolean).map((m) => m[1] || m[2]);
const mainDecls = new Set();
fs.readdirSync(GS).filter((f) => /\.js$/.test(f)).forEach((f) => declsOf(read(path.join(GS, f))).forEach((n) => mainDecls.add(n)));
const judgeDecls = new Set(declsOf(read(path.join(GJ, 'Generated.js'))));
const jmDecls = new Set(declsOf(read(path.join(GS, 'JudgeMore.js'))));

// 3) 이음매 점검 줄 가르기 — 줄이 쓰는 맨 위 이름이 모두 판정 서버에 있으면 판정 서버에서 돈다
const fed = read(path.join(GS, 'Federation.js'));
const a = fed.indexOf('function commSeamList_()'), b = fed.indexOf('\nfunction ', a + 10);
if (a < 0 || b < 0) throw new Error('commSeamList_를 찾지 못함');
const listSrc = fed.slice(a, b);
const locals = (listSrc.match(/^  var ([A-Za-z_$][\w$]*) =/mg) || []).map((s) => s.replace(/^  var | =$/g, ''));
// 목록을 만들 때 길 이름 글자 안에서 job 서버 함수를 부르는 줄이 있다 — 모르는 이름은 무엇이든 받아 주는 빈 대역으로
const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : stub), apply: () => stub });
const fctx = vm.createContext({ __P: new Proxy({}, { has: (t, k) => typeof k === 'string' && k !== 'commSeamList_' && k !== '__R' && k !== 'jmSeamFilter_' && !(k in globalThis), get: (t, k) => (k === Symbol.unscopables ? undefined : stub) }) });
vm.runInContext('with (__P) { ' + listSrc + '\n; __R = commSeamList_(); }', fctx);
const seamList = fctx.__R;
const strip = (s) => s.replace(/\/\/[^\n]*/g, ' ').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, '""');
const remoteSeams = [];
seamList.forEach((s) => {
  const src = String(s.fn), ids = new Set(strip(src).match(/[A-Za-z_$][\w$]*/g) || []);
  let usesJudge = false, mainOnly = false;
  ids.forEach((id) => {
    if (locals.indexOf(id) !== -1) mainOnly = true;
    if (mainDecls.has(id) && !judgeDecls.has(id)) mainOnly = true;
    if (jmDecls.has(id) && id !== 'judgeMoreRun_' && id !== 'judgeOutOfScope_') usesJudge = true;
    if (id === 'judgeMoreRun_') mainOnly = true; // 장부 적기 길 — job 서버에서
  });
  if (usesJudge && !mainOnly) remoteSeams.push({ 길: s.길, src });
});
fs.writeFileSync(path.join(GJ, 'Seams.js'), '// 자동 생성 — 직접 고치지 말 것. 원본: gs-backend/Federation.js commSeamList_, 생성: tools/build-judge.js\n' +
  '// 판정만 쓰는 이음매 점검 줄 ' + remoteSeams.length + '개 — job 서버가 배포 직후 점검 때 한 번에 불러 줄마다 나눠 적는다\n' +
  'var JUDGE_SEAMS_ = [\n' + remoteSeams.map((s) => '  { 길: ' + JSON.stringify(s.길) + ', fn: ' + s.src + ' }').join(',\n') + '\n];\n');
// 판 표시 — 판정 서버에 올린 코드와 job 서버 대리 파일이 같은 원본에서 지어졌는지(배포 직후 이음매 점검이 견줌)
const BUILD = require('crypto').createHash('sha256').update(read(path.join(GJ, 'Generated.js')) + read(path.join(GJ, 'Seams.js')) + read(path.join(GJ, 'manage', 'taxcalc-engine.html')).replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
fs.appendFileSync(path.join(GJ, 'Seams.js'), 'var JUDGE_BUILD_ = ' + JSON.stringify(BUILD) + ';\n');

// 4) job 서버 쪽 대리 파일
const chunkOf = (src, name) => { // 맨 위 선언 하나(다음 맨 위 선언·주석 전까지)
  const lines = src.split(/\r?\n/), i = lines.findIndex((l) => { const m = DECL_RE.exec(l); return m && (m[1] || m[2]) === name; });
  if (i < 0) throw new Error('선언을 찾지 못함: ' + name);
  let j = i + 1; while (j < lines.length && !DECL_RE.test(lines[j]) && !/^\/\//.test(lines[j])) j++;
  return lines.slice(i, j).join('\n').replace(/\s+$/, '');
};
const jmSrc = read(path.join(GS, 'JudgeMore.js'));
const urlFile = path.join(GJ, 'server-url.txt');
const url = fs.existsSync(urlFile) ? read(urlFile).trim() : '';
const proxyName = (i) => fnInfo[i].name || ('jmAnon' + i + '_');
let out = '// 자동 생성 — 직접 고치지 말 것. 원본: gs-backend/JudgeMore.js·JudgeForm.js·Federation.js, 생성: tools/build-judge.js\n' +
  '// [2026.11.10] 판정 계산은 판정 서버(gs-judge)에서 — job 서버엔 이 대리 파일만 올라가고 JudgeMore.js는 .claspignore로 빠진다.\n' +
  '// 이름·묶음 이름·돌려주는 모양은 원본과 같다. 판정 서버에 닿지 못하면 오류로 드러낸다(빈 결과로 삼키지 않음).\n' +
  'var JUDGE_SERVER_URL_ = ' + JSON.stringify(url) + ';\n' +
  'function jmRemote_(body) {\n' +
  '  if (!JUDGE_SERVER_URL_) throw new Error(\'판정 서버 주소가 없음(tools/build-judge.js — gs-judge/server-url.txt)\');\n' +
  '  var res, d;\n' +
  '  try { res = UrlFetchApp.fetch(JUDGE_SERVER_URL_, { method: \'post\', contentType: \'text/plain;charset=utf-8\', payload: JSON.stringify(body), muteHttpExceptions: true }); }\n' +
  '  catch (e) { throw new Error(\'판정 서버에 닿지 못함: \' + String(e && e.message || e).slice(0, 120)); }\n' +
  '  try { d = JSON.parse(res.getContentText()); } catch (e) { throw new Error(\'판정 서버에 닿지 못함: 답 모양이 틀림(\' + res.getResponseCode() + \')\'); }\n' +
  '  if (d && d.error) throw new Error(\'판정 서버: \' + d.error);\n' +
  '  return d ? d.r : null;\n' +
  '}\n';
fnInfo.forEach((f, i) => {
  out += f.name ? 'function ' + f.name + '(p) { return jmRemote_({ fn: ' + JSON.stringify(f.name) + ', p: p }); }\n'
    : 'var ' + proxyName(i) + ' = function (p) { return jmRemote_({ key: ' + JSON.stringify(f.firstKey) + ', p: p }); };\n';
});
out += 'var JUDGE_MORE_ = {\n' + keys.map((k) => '  ' + JSON.stringify(k) + ': ' + proxyName(fns.indexOf(JM[k]))).join(',\n') + '\n};\n';
out += chunkOf(jmSrc, 'judgeOutOfScope_') + '\n' + chunkOf(jmSrc, 'judgeMoreRun_') + '\n';
out += 'var JUDGE_CATALOG_STATIC_ = ' + JSON.stringify(catalog) + ';\n';
out += 'var JUDGE_SEAM_NAMES_ = ' + JSON.stringify(remoteSeams.map((s) => s.길)) + ';\n' +
  '// 이음매 점검: 판정만 쓰는 줄은 판정 서버에 한 번 물어 줄마다 그 답을 돌려준다(줄마다 따로 부르면 수 분 걸림)\n' +
  'function jmSeamFilter_(list) {\n' +
  '  var memo = null;\n' +
  '  var get = function () { if (!memo) { try { memo = { r: jmRemote_({ seams: true }) || [] }; } catch (e) { memo = { err: e.message }; } } return memo; };\n' +
  '  var ver = { 길: \'job 서버 → 판정 서버(닿는지·같은 판인지)\', fn: function () { var v; try { v = jmRemote_({ ver: true }); } catch (e) { return e.message; } return v === ' + JSON.stringify(BUILD) + ' ? \'\' : \'판정 서버 판이 다름(\' + v + \' ≠ ' + BUILD + ') — node tools/build-judge.js 뒤 gs-judge 를 clasp push·deploy -i 로 다시 올릴 것\'; } };\n' +
  '  return [ver].concat(list.map(function (s) {\n' +
  '    if (JUDGE_SEAM_NAMES_.indexOf(s.길) === -1) return s;\n' +
  '    return { 길: s.길 + \' (판정 서버)\', fn: function () { var m = get(); if (m.err) return m.err; var x = m.r.filter(function (y) { return y.길 === s.길; })[0]; return x ? x.msg : \'판정 서버에 이 줄이 없음(판정 서버를 다시 올릴 것)\'; } };\n' +
  '  }));\n' +
  '}\n';
// job 서버에서 쓰는 JudgeMore 이름이 대리 파일에 모두 있는지
const outDecls = new Set(declsOf(out));
const missing = [];
fs.readdirSync(GS).filter((f) => /\.js$/.test(f) && f !== 'JudgeMore.js').forEach((f) => {
  const ids = new Set(strip(read(path.join(GS, f))).match(/[A-Za-z_$][\w$]*/g) || []);
  ids.forEach((id) => { if (jmDecls.has(id) && !outDecls.has(id) && missing.indexOf(id) === -1) missing.push(id + '(' + f + ')'); });
});
if (missing.length) throw new Error('job 서버가 쓰는데 대리 파일에 없는 판정 이름: ' + missing.join(', '));
fs.mkdirSync(path.join(GS, 'judge-remote'), { recursive: true });
fs.writeFileSync(path.join(GS, 'judge-remote', 'JudgeRemote.js'), out);
new vm.Script(out); new vm.Script(read(path.join(GJ, 'Seams.js')));
console.log('판정 서버: 묶음 이름 ' + keys.length + '개 · 판정 함수 ' + fns.length + '개(이름 없는 것 ' + fnInfo.filter((f) => !f.name).length + ') · 판정 창 목록 ' + catalog.length + '줄');
console.log('이음매 점검 줄: 판정 서버로 ' + remoteSeams.length + '개 / job 서버에 남음 ' + (seamList.length - remoteSeams.length) + '개');
console.log('job 서버 대리 파일 ' + Math.round(Buffer.byteLength(out) / 1024) + 'KB · 판정 서버 주소 ' + (url ? '있음' : '없음 — gs-judge/server-url.txt'));
