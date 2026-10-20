#!/usr/bin/env node
// [2026.10.20] 시스템 자기점검 서버 흐름 가짜 드라이브 시험 — 실제 서버 코드(Code.js·SysAdmin.js·Federation.js·AiLead.js·SysAudit.js)를 node에 올리고
// DriveApp·PropertiesService·CacheService·UrlFetchApp만 가짜로 만든다. 드라이브는 로컬 J:의 0 NETAX를 읽기만 하고, 쓰기(_점검리포트)는 메모리에.
// 보는 것: 새벽 2시 규칙 점검 → 대시보드 줄 → 새벽 3시 무료 AI(성공·무료 한도 초과·이상한 답·키 없음) → 🧾 판단 필요만 → 개선 후보 문구.
// 사용: node tools/sys-audit-mock.js [--root "J:/내 드라이브/0 NETAX"]
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib'), crypto = require('crypto');
const args = process.argv.slice(2);
const ROOT = (args.indexOf('--root') >= 0 ? args[args.indexOf('--root') + 1] : 'J:/내 드라이브/0 NETAX').replace(/\\/g, '/');
const SRC = path.join(__dirname, '..', 'gs-backend');

// ---- 가짜 드라이브(읽기 = 로컬, 쓰기 = 메모리) ----
const mem = {}; // path → { content, updated }
// 드라이브 ID는 경로를 16진수로(서버 sanitizeDriveId_가 / 를 자르므로 경로를 그대로 쓰면 안 됨)
const ID = p => 'x' + Buffer.from(p, 'utf8').toString('hex'), PATH = id => Buffer.from(String(id).slice(1), 'hex').toString('utf8');
const MASTER_ID = '1rL0-EhNYzeacN_oGpDGjAGXWcikI2cYP';
const memDirs = new Set();
function fileObj(p) {
  return {
    getId: () => ID(p), getName: () => path.basename(p), getUrl: () => 'file://' + p, isTrashed: () => false,
    getLastUpdated: () => mem[p] ? mem[p].updated : fs.statSync(p).mtime,
    getBlob: () => ({
      getDataAsString: () => mem[p] ? mem[p].content : fs.readFileSync(p, 'utf8'),
      getBytes: () => fs.readFileSync(p),
      setContentType: function () { return this; }, _path: p
    }),
    setContent: c => { mem[p] = { content: c, updated: new Date() }; },
    getParents: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return folderObj(path.dirname(p)); } }; }
  };
}
function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
function listDir(p) {
  let ents = [];
  try { ents = fs.readdirSync(p, { withFileTypes: true }).map(e => ({ name: e.name, dir: e.isDirectory() })); } catch (e) { }
  for (const k of Object.keys(mem)) if (path.dirname(k) === p && !ents.some(e => e.name === path.basename(k))) ents.push({ name: path.basename(k), dir: false });
  for (const d of memDirs) if (path.dirname(d) === p && !ents.some(e => e.name === path.basename(d))) ents.push({ name: path.basename(d), dir: true });
  return ents;
}
function folderObj(p) {
  return {
    getId: () => ID(p), getName: () => path.basename(p),
    getFolders: () => iter(listDir(p).filter(e => e.dir).map(e => folderObj(p + '/' + e.name))),
    getFiles: () => iter(listDir(p).filter(e => !e.dir).map(e => fileObj(p + '/' + e.name))),
    getFoldersByName: n => iter(listDir(p).filter(e => e.dir && e.name === n).map(e => folderObj(p + '/' + e.name))),
    getFilesByName: n => iter(listDir(p).filter(e => !e.dir && e.name === n).map(e => fileObj(p + '/' + e.name))),
    createFolder: n => { memDirs.add(p + '/' + n); return folderObj(p + '/' + n); },
    createFile: b => { const fp = p + '/' + b.name; mem[fp] = { content: b.content, updated: new Date() }; return fileObj(fp); },
    getParents: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return folderObj(path.dirname(p)); } }; }
  };
}
const props = { BUSINESS_MANAGER_FOLDER_ID: ID(ROOT), CHIEF_MANAGER_FOLDER_ID: ID(ROOT + '/총괄관리자'), GEMINI_API_KEY: 'test-key' };
const cache = {};
let fetchMode = 'ok', fetchCalls = 0, lastPrompt = '';
const ctx = {
  console: { log: () => { }, error: m => console.log('  (서버 console.error) ' + m) },
  DriveApp: {
    getFolderById: id => { const p = PATH(id); if (!fs.existsSync(p) && !memDirs.has(p)) throw new Error('없는 폴더 ' + p); return folderObj(p); },
    getFileById: id => fileObj(id === MASTER_ID ? ROOT + '/총괄관리자/_NX_마스터프로필.md' : PATH(id))
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] == null ? null : props[k], setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getKeys: () => Object.keys(props) }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] == null ? null : cache[k], put: (k, v) => { cache[k] = v; }, getAll: ks => { const o = {}; ks.forEach(k => { if (cache[k] != null) o[k] = cache[k]; }); return o; }, putAll: o => Object.assign(cache, o), remove: k => { delete cache[k]; } }) },
  Utilities: {
    formatDate: (d, tz, f) => { const k = new Date(d.getTime() + 9 * 3600000).toISOString(); return f.replace('yyyy', k.slice(0, 4)).replace('MM', k.slice(5, 7)).replace('dd', k.slice(8, 10)).replace('HH', k.slice(11, 13)).replace('mm', k.slice(14, 16)).replace("'T'", 'T').replace('ss', k.slice(17, 19)); },
    computeDigest: (alg, s) => [...crypto.createHash('md5').update(String(s), 'utf8').digest()],
    base64Encode: b => Buffer.from(b.map(x => x & 255)).toString('base64'),
    ungzip: blob => ({ getDataAsString: () => zlib.gunzipSync(fs.readFileSync(blob._path)).toString('utf8') }),
    newBlob: (content, type, name) => ({ content, type, name }),
    sleep: () => { }, DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' }
  },
  UrlFetchApp: {
    fetchAll: reqs => reqs.map(r => { fetchCalls++; lastPrompt = JSON.parse(r.payload).contents[0].parts[0].text; return fakeGemini(); }),
    fetch: () => ({ getResponseCode: () => 500, getContentText: () => '{}' })
  },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => { } }) }) }) }) },
  LockService: { getScriptLock: () => ({ waitLock: () => { }, tryLock: () => true, releaseLock: () => { } }) },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' }
};
function fakeGemini() {
  const body = fetchMode === 'ok' ? { candidates: [{ content: { parts: [{ text: '```json\n[{"종류":"지침끼리","파일":["양도_일시적2주택.md","양도_1세대1주택_비과세.md"],"내용":"시험용 — 처분기한을 서로 다르게 적음","근거":["양도_일시적2주택.md: 3년","양도_1세대1주택_비과세.md: 2년"],"세법판단필요":true}]\n```' }] } }] }
    : fetchMode === 'quota' ? { error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).' } }
      : { candidates: [{ content: { parts: [{ text: '어긋나는 곳은 없어 보입니다.' }] } }] };
  return { getResponseCode: () => fetchMode === 'quota' ? 429 : 200, getContentText: () => JSON.stringify(body) };
}
vm.createContext(ctx);
for (const f of ['Code.js', 'SysAdmin.js', 'Federation.js', 'AiLead.js', 'SysAudit.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });

const RF = ROOT + '/총괄관리자/_점검리포트';
const readJson = n => JSON.parse(mem[RF + '/' + n].content);
let fails = 0;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const dash = () => ctx.handleGetNightlyStatus({}).items.find(i => /시스템 자기점검/.test(i.label));

console.log('① 새벽 2시 runNightlySystemAudit() — 규칙 점검');
let t0 = Date.now(), r = ctx.runNightlySystemAudit(); if (!mem[RF + '/점검결과_최신.json']) { console.log(r, Object.keys(mem)); process.exit(1); }
const res = readJson('점검결과_최신.json');
check(r && r.success === true, '규칙 점검 성공 (' + ((Date.now() - t0) / 1000).toFixed(1) + '초)');
check(res.rules && res.rules.totals.files > 3, '본 파일 ' + res.rules.totals.files + '개, 문제 ' + res.rules.totals.problems + ' · 주의 ' + res.rules.totals.warnings + ' · 조문 ' + res.rules.totals.citations + '(확인 ' + res.rules.totals.citationsChecked + ') · 도구 ' + res.rules.toolCount + '개 대조');
check(res.rules.totals.citationsChecked > 0, '법령 정비본으로 조문을 실제로 확인함');
check(!(res.warn || []).length, '경고 없음' + ((res.warn || []).length ? ': ' + res.warn.join(' / ') : ''));
check(Object.keys(mem).some(k => /점검리포트_\d{4}-\d{2}-\d{2}\.md$/.test(k)), '점검리포트_날짜.md 저장');
check(!res.rules.files.some(f => f.name.charAt(0) === '_'), '"_" 파일은 점검 대상에서 빠짐');
check(!res.rules.files.some(f => f.name === '개선요구사항.md'), '개선요구사항.md는 빠짐');
let d = dash();
console.log('  대시보드: ok=' + d.ok + ' / ' + (d.failLabel || '') + '\n    ' + d.message.split('\n').join('\n    '));
check(d.ok === (res.rules.totals.problems === 0), '대시보드 ✅는 문제 0일 때만');

console.log('\n② 새벽 3시 runSysAuditAiNightly() — 제미니 무료 한도 초과');
fetchMode = 'quota'; fetchCalls = 0;
ctx.runSysAuditAiNightly();
let ai = readJson('점검결과_최신.json').ai;
check(!ai.ran && /무료 한도 초과/.test(ai.status), '상태: ' + ai.status);
check(fetchCalls === 1, '한도 초과 뒤 더 묻지 않음(요청 ' + fetchCalls + '번), 유료로 안 바꿈');
check(ai.waiting > 0, '다음 밤으로 넘긴 파일 ' + ai.waiting + '개');
check(!/claude|anthropic/i.test(JSON.stringify(ai)), '유료 AI 호출 흔적 없음');

console.log('\n③ 다시 3시 — 제미니가 형식이 틀린 답');
fetchMode = 'bad'; fetchCalls = 0;
ctx.runSysAuditAiNightly();
ai = readJson('점검결과_최신.json').ai;
check(ai.errors.length > 0 && /형식/.test(ai.errors[0]), '형식 오류를 결과에 적음(빈 결과로 성공 처리 안 함): ' + (ai.errors[0] || '').slice(0, 60));
check(!ai.ran, 'ran=false (질문 ' + fetchCalls + '번)');

console.log('\n④ 다시 3시 — 정상 답');
fetchMode = 'ok'; fetchCalls = 0;
ctx.runSysAuditAiNightly();
ai = readJson('점검결과_최신.json').ai;
check(ai.ran && ai.items.length > 0, '상태: ' + ai.status + ' / 항목 ' + ai.items.length);
check(fetchCalls <= 6, '하룻밤 요청 상한 지킴(' + fetchCalls + '번)');
check(!ctx.aiLooksClientData_(lastPrompt), '마지막으로 보낸 글이 고객 자료 차단 장치를 통과(걸리는 곳은 [가림])');
check(ai.masked >= 0 && !(ai.blocked || []).length, '가린 곳 ' + ai.masked + '군데, 막혀 빠진 파일 ' + (ai.blocked || []).length + '개');
const st = readJson('_점검상태.json');
check(Object.keys(st.aiHashes).length === ai.done.length || Object.keys(st.aiHashes).length >= ai.done.length, 'AI 기준 지문은 실제로 본 파일만 갱신(' + Object.keys(st.aiHashes).length + '개)');
d = dash();
check(!d.ok && /AI 어긋남/.test(d.failLabel), '대시보드: ' + d.failLabel);

// --dump <파일>: 이 시점의 화면용 결과(sysaudit_result 응답 모양)를 저장 — 🧭 화면 모양 확인용
if (args.indexOf('--dump') >= 0) fs.writeFileSync(args[args.indexOf('--dump') + 1], JSON.stringify({ success: true, result: readJson('점검결과_최신.json'), stale: '' }));
console.log('\n⑤ 하룻밤 더 — 남은 파일 이어서');
fetchCalls = 0; ctx.runSysAuditAiNightly();
ai = readJson('점검결과_최신.json').ai;
console.log('  ' + ai.status + ' (질문 ' + fetchCalls + '번, 남은 ' + ai.waiting + ')');
for (let i = 0; i < 4 && ai.waiting; i++) { ctx.runSysAuditAiNightly(); ai = readJson('점검결과_최신.json').ai; }
fetchCalls = 0; ctx.runSysAuditAiNightly(); ai = readJson('점검결과_최신.json').ai;
check(fetchCalls === 0 && /바뀐 지침 없음/.test(ai.status), '다 본 뒤엔 0번 질문: ' + ai.status);
check(ai.items.length > 0, '옛 AI 항목은 유지(' + ai.items.length + '개)');

console.log('\n⑥ 키 없음');
delete props.GEMINI_API_KEY; props.SYS_AUDIT_FAKE = '1';
// 지문 하나를 바꿔 "바뀐 파일"이 있게
const st2 = readJson('_점검상태.json'); const k1 = Object.keys(st2.aiHashes)[0]; st2.aiHashes[k1] = 'x'; mem[RF + '/_점검상태.json'].content = JSON.stringify(st2);
fetchCalls = 0; ctx.runSysAuditAiNightly(); ai = readJson('점검결과_최신.json').ai;
check(fetchCalls === 0 && /키/.test(ai.status), ai.status.slice(0, 60));
props.GEMINI_API_KEY = 'test-key';

console.log('\n⑦ 🧾 판단 필요만(유료) — 보낼 자료만 확인(실제 호출 안 함)');
const fl = ctx.sysAuditFlaggedForPaid_();
check(fl && fl.items.length && fl.files.length, '판단 필요 ' + (fl ? fl.items.length : 0) + '건, 파일 ' + (fl ? fl.files.join(', ') : ''));
const ad = ctx.sysAuditFlaggedAuditData_(fl);
check(ad.파일개수 <= fl.files.length + 2, '유료 AI에 보낼 파일 ' + ad.파일개수 + '개(전체 대신 해당 파일 + 장기계획·체크리스트), ' + ad.전체내용.length.toLocaleString() + '자');

console.log('\n⑧ 점검이 안 돈 경우 — 결과가 오래됨');
const rr = readJson('점검결과_최신.json'); rr.at = '2026-10-01 02:00'; mem[RF + '/점검결과_최신.json'].content = JSON.stringify(rr);
d = dash();
check(!d.ok && /점검 안 됨/.test(d.failLabel), '대시보드: ⚠ ' + d.failLabel);

console.log('\n⑨ 개선 후보 문구');
const sl = JSON.parse(props.SYS_AUDIT_LAST);
check(sl.ran && typeof sl.problems === 'number', 'SYS_AUDIT_LAST 요약: 문제 ' + sl.problems + ' · AI ' + sl.aiItems);

console.log('\n⑩ 화면용 결과 크기: ' + (mem[RF + '/점검결과_최신.json'].content.length / 1024).toFixed(0) + 'KB, 리포트 md ' + (Object.entries(mem).find(([k]) => /점검리포트_.*\.md$/.test(k))[1].content.length / 1024).toFixed(0) + 'KB');
console.log(fails ? '\n✗ 실패 ' + fails + '개' : '\n✓ 모두 통과');
process.exitCode = fails ? 1 : 0;
