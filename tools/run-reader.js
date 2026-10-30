#!/usr/bin/env node
// ============================================================
// [2026.10.23 T6 1단계] 조립 모듈(dist/reader.js)을 PC node에서 돌려 사건 한 건의 ①사건파악·②증빙 정리·③칸 채우기를 실행하고,
// 운영(GAS)이 같은 사건에 남긴 결정 파일(총괄관리자\_사건처리점검\<caseId>.json)의 timing·채운 칸·질문과 대조한다.
// ------------------------------------------------------------
// - 드라이브 API 없이 J:\내 드라이브 파일을 그대로 읽는다(사건 폴더 + 업무관리자\_글자인식기억). 글자인식은 새로 하지 않는다(기억에 없으면 "못 읽음").
// - GAS 흉내 층은 재현기 C:\GitHub\netax-replay\lib(gas.js·vfs.js·setup.js)을 그대로 쓴다(새로 짓지 않음).
// - 쓰기(드라이브 파일 만들기·내용 바꾸기·휴지통·시트 쓰기)와 UrlFetchApp·ScriptApp·LockService는 불리면 "읽기 전용 시험" 오류로 멈춘다 — 불린 목록이 보고 거리.
//   --mem 을 주면 쓰기를 메모리에만 하고 계속 돈다(칸 값 대조용 2차 실행). 어느 모드든 실제 드라이브·시트는 바뀌지 않는다.
// - J: 드라이브는 파일 하나씩 읽는다(동시 대량 읽기 금지) — 재현기 VFS가 원래 그렇게 읽는다.
// 사용: node tools/run-reader.js "<사건 폴더 이름>" --case <caseId> [--mem] [--out <결과 json>]
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPLAY = process.env.NETAX_REPLAY || 'C:/GitHub/netax-replay';
const { VFS, VFolder, VFile } = require(path.join(REPLAY, 'lib/vfs.js'));
const { loadBackend, formatDate } = require(path.join(REPLAY, 'lib/gas.js'));
const setup = require(path.join(REPLAY, 'lib/setup.js'));

const args = process.argv.slice(2);
const folder = args.filter((a) => !/^--/.test(a) && args[args.indexOf(a) - 1] !== '--case' && args[args.indexOf(a) - 1] !== '--out')[0];
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const MEM = args.indexOf('--mem') >= 0;
const caseId = argOf('--case', '');
if (!folder) { console.log('사용: node tools/run-reader.js "<사건 폴더 이름>" --case <caseId> [--mem] [--out <결과 json>]'); process.exit(2); }

const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(path.join(DIST, 'reader.js'))) { console.log('dist/reader.js 없음 — 먼저 node tools/build-reader.js'); process.exit(2); }

// ---------- 읽기 전용 울타리 — 쓰기·바깥 호출이 불리면 기록하고(strict면 멈춤) ----------
const blocked = [];
function guard(obj, name, label) {
  const orig = obj[name];
  obj[name] = function () {
    const where = label + '.' + name;
    // 어느 서버 함수가 불렀는지(조립 모듈 안의 함수 이름 두 개) — 보고 거리
    const callers = String(new Error().stack || '').split('\n').slice(2).map((l) => (/at ([A-Za-z_$][\w$]*) \(/.exec(l) || [])[1]).filter((n) => n && !/^(guard|obj|<anonymous>|Object|Array|forEach|map|filter)/.test(n)).slice(0, 2).join('←');
    blocked.push(where + (this && this.name ? '(' + this.name + ')' : '') + (callers ? ' ← ' + callers : ''));
    if (!MEM) throw new Error('읽기 전용 시험: ' + where + ' 호출 금지');
    return orig.apply(this, arguments);
  };
}
['createFile', 'createFolder'].forEach((n) => guard(VFolder.prototype, n, 'Folder'));
['setContent', 'setTrashed', 'setName', 'moveTo', 'makeCopy', 'setDescription'].forEach((n) => guard(VFile.prototype, n, 'File'));

// ---------- 사건 싣기(재현기 prepare와 같되, 조립 모듈 하나만 싣는다) ----------
const caseDir = path.join(setup.CFG.casesRoot, folder);
if (!fs.existsSync(caseDir)) { console.log('사건 폴더 없음: ' + caseDir); process.exit(2); }
// 파일 ID는 재현기 매니페스트(netax-replay/manifests/<폴더>.tsv — 드라이브 연결로 받은 ID·수정시각 목록)에서 — 글자인식 기억은 ID로 찾기 때문
// (재현기 setup.js의 manifestFor는 내보내지 않아 같은 형식을 여기서 읽는다 — 첫 줄 "# folderId=…", 이후 "ID<탭>이름<탭>mimeType<탭>수정시각<탭>부모ID")
function readManifest(folderName) {
  const p = path.join(REPLAY, 'manifests', folderName + '.tsv');
  if (!fs.existsSync(p)) return { files: {} };
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  const head = /folderId=([\w-]+)/.exec(lines[0] || ''); const rootId = head ? head[1] : null;
  const ents = lines.filter((l) => l.trim() && !/^#/.test(l)).map((l) => { const [id, name, mimeType, mod, parent] = l.split('\t'); return { id, name, mimeType, modified: Date.parse(mod), parent }; });
  const byId = {}; ents.forEach((e) => { byId[e.id] = e; });
  const files = {};
  ents.forEach((e) => { const parts = [e.name]; let cur = e; for (let guard = 0; cur.parent !== rootId; guard++) { cur = byId[cur.parent]; if (!cur || guard > 20) return; parts.unshift(cur.name); } files[parts.join('/') + (e.mimeType === 'application/vnd.google-apps.folder' ? '/' : '')] = e; });
  return { folderId: rootId, files };
}
const man = readManifest(folder);
const vfs = new VFS({ manifest: man.files || {}, nameToId: {}, storeIndex: setup.storeIndex });
const bm = vfs.mem('업무관리자');
const store = vfs.mount(setup.STORE_DIR, { parent: bm, eager: true, noStats: true, id: 'LOCALSTOREFOLDER0000000000000' });
bm._folders.push(store);
const chief = vfs.mem('총괄관리자');
const root = vfs.mem('고객사건');
const caseFolder = vfs.mount(caseDir, { parent: root, id: man.folderId || undefined });
root._folders.push(caseFolder);

// 파일 ID — 운영 결정 파일(readFiles.list)·글자인식기억 파일 이름에서 이름→ID를 맞춘다(기억은 ID로 찾기 때문)
const decisionPath = caseId ? path.join(path.dirname(setup.CFG.bmDir), '총괄관리자', '_사건처리점검', caseId + '.json') : '';
let gas = null; try { if (decisionPath && fs.existsSync(decisionPath)) gas = JSON.parse(fs.readFileSync(decisionPath, 'utf8')); } catch (e) { gas = null; }
const idMapped = [], idUnmapped = [];
(function mapIds() {
  const list = (gas && gas.readFiles && gas.readFiles.list) || [];
  const byName = {}; list.forEach((x) => { if (x && x.name && x.id) byName[x.name] = x; });
  // 결정 파일에 목록이 없으면 글자인식기억 파일 안의 첫 줄(파일 이름 메모)로는 못 맞춘다 — 이름이 같은 기억 파일을 글 머리에서 찾는 건 하지 않는다(추정 금지)
  vfs.allFiles().filter((f) => f.local && f.local.indexOf(caseDir) === 0).forEach((f) => {
    if (!/^LOCAL/.test(String(f.id))) { idMapped.push(f.name); return; } // 매니페스트로 이미 맞음
    const hit = byName[f.name] || byName[f.name.replace(/\.[A-Za-z0-9]{2,5}$/, '')];
    if (hit) { delete vfs.byId[f.id]; f.id = hit.id; if (hit.modified) f.modified = Number(hit.modified) || f.modified; else { const ms = setup.storeIndex[hit.id]; if (ms && ms.length) f.modified = Math.max.apply(null, ms); } vfs.byId[f.id] = f; idMapped.push(f.name); }
    else idUnmapped.push(f.name);
  });
})();

const m = /^(.+?)\((.+?)\)_([^_]+)(?:_([^_\d]+)\d*)?/.exec(folder) || [];
const SEMOK = { 양도: 'transfer', 증여: 'gift', 상속: 'inheritance' };
const row = {
  id: caseId || ('LOCAL-' + folder), 고객명: m[1] || folder, 납세자: m[2] || '', 사건명: folder, 세목: SEMOK[m[3]] || m[3] || '', 업무유형: m[4] || '신고', 상태: '진행', 폴더ID: caseFolder.getId(),
  의뢰일: '', 기준일: '', 법정일: '', 사건개요: {}, 증빙목록: [], 작업일지: [], 세액계산결과: [], 하위업무: [], 법령예규판례: []
};
const t0 = Date.now();
const g0 = loadBackend({ vfs, backendDir: DIST, files: ['reader.js'], headers: [], rows: [] });
const HEADERS = Array.from(g0.run('WORK_HEADERS'));
const g = loadBackend({
  vfs, backendDir: DIST, files: ['reader.js'], headers: HEADERS, rows: [row],
  props: { BUSINESS_MANAGER_FOLDER_ID: bm.getId(), OCR_STORE_FOLDER_ID: store.getId(), CHIEF_MANAGER_FOLDER_ID: chief.getId(), NX_DEFAULT_FOLDER_ID: root.getId() }
});
const tLoad = Date.now() - t0;
// 시트 쓰기 울타리(가짜 시트의 setValues·appendRow·setValue)
(function guardSheet() {
  const sh = g.ctx.SpreadsheetApp.openById('x').getSheetByName('사건');
  const r0 = sh.getRange(1, 1, 1, 1);
  const proto = Object.getPrototypeOf(r0) === Object.prototype ? null : Object.getPrototypeOf(r0);
  const origRange = sh.getRange;
  sh.getRange = function () { const r = origRange.apply(this, arguments); ['setValues', 'setValue'].forEach((n) => { const o = r[n]; r[n] = function () { blocked.push('Sheet.' + n); if (!MEM) throw new Error('읽기 전용 시험: Sheet.' + n + ' 호출 금지'); return o.apply(this, arguments); }; }); return r; };
  const oa = sh.appendRow; sh.appendRow = function () { blocked.push('Sheet.appendRow'); if (!MEM) throw new Error('읽기 전용 시험: Sheet.appendRow 호출 금지'); return oa.apply(this, arguments); };
  void proto;
})();
// 글자인식(구글 OCR)은 PC에서 하지 않는다 — 어느 서류가 기억에 없어 못 읽는지 기록
const ocrMiss = [];
g.ctx.__rr = { ocrMiss };
g.run(`
  ocrFileText_ = function (id) { var f = null; try { f = DriveApp.getFileById(id); } catch (e) {} __rr.ocrMiss.push(f ? f.getName() : String(id)); return ''; };
  tcOcrStorePut_ = function () {}; // 글자인식기억에 쓰지 않는다
`);

// ---------- 실행 ----------
let out, err = null;
const t1 = Date.now();
try { out = g.ctx.caseProcTool_(row, { step: 'read', budgetMs: 300000 }); } catch (e) { err = e; } // [2026.10.31] 묶음(all) → 📖 서류 읽기
let tRun = Date.now() - t1;
// --twice: 같은 과정에서 한 번 더(운영은 사건 등록 때 처리개요·증빙목록이 먼저 생기므로, 두 번째 호출이 운영 첫 호출의 입력 상태에 더 가깝다)
let first = null;
if (args.indexOf('--twice') >= 0 && out) { first = { ms: out._ms, tm: out._tm, open: out.open, itemIds: (out.items || []).map((it) => it.id) }; const t2 = Date.now(); try { out = g.ctx.caseProcTool_(g.ctx.akReadCase_(row.id) || row, { step: 'read', budgetMs: 300000 }); } catch (e) { err = e; } tRun = Date.now() - t2; }
let after = null; try { after = g.ctx.akReadCase_(row.id); } catch (e) {}
const ov = (after && after.사건개요) || {};
const sv = (function () { try { return g.ctx.caseProcLoad_(row.id) || {}; } catch (e) { return {}; } })();

// ---------- 대조 ----------
const cmp = { timing: null, fields: [], questions: null, files: null };
if (gas) {
  const gt = (gas.timing || [])[0] || null;
  cmp.timing = { gas: gt ? { ms: gt.ms, tm: gt.tm, at: gt.at } : null, pc: out ? { ms: out._ms, tm: out._tm } : null };
  const gf = gas.filled || {};
  const keys = Array.from(new Set(Object.keys(gf).concat(Object.keys(sv.filled || {})))).sort();
  keys.forEach((k) => {
    const gv = gf[k] ? String(gf[k].v) : '';
    const pv = sv.filled && sv.filled[k] ? String(sv.filled[k].v) : (ov[k] != null && typeof ov[k] !== 'object' ? String(ov[k]) : '');
    cmp.fields.push({ key: k, gas: gv, pc: pv, same: gv === pv, gasSrc: gf[k] ? gf[k].src : '', pcSrc: sv.filled && sv.filled[k] ? sv.filled[k].src : '' });
  });
  const gq = Object.keys(gas.decisions || {}).concat((gas.remaining || []).map((x) => x.id)).filter((x) => !/^file:/.test(x)).sort();
  const pq = out ? (out.items || []).map((it) => it.id).filter((x) => !/^file:/.test(x)).sort() : [];
  cmp.questions = { gas: gq, pc: pq, onlyGas: gq.filter((x) => pq.indexOf(x) === -1), onlyPc: pq.filter((x) => gq.indexOf(x) === -1) };
  cmp.files = { gasReadFiles: (gas.readFiles && gas.readFiles.list || []).length || null, pcEvidence: (after && after.증빙목록 || []).length, pcCaseFiles: idMapped.length + idUnmapped.length };
}

const result = {
  at: formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'), folder, caseId, mode: MEM ? '메모리 쓰기' : '읽기 전용(쓰기 금지)',
  loadMs: tLoad, runMs: tRun, error: err ? String(err && err.message || err) : null,
  tm: out ? out._tm : null, ms: out ? out._ms : null, ok: out ? out.ok : false, partial: out ? !!out.partial : null, more: out ? !!out.more : null,
  open: out ? out.open : null, calcReady: out ? out.calcReady : null, itemIds: out ? (out.items || []).map((it) => it.id) : null,
  overview: ov, filled: sv.filled || null, evidenceCount: (after && after.증빙목록 || []).length,
  blocked: Array.from(new Set(blocked)), blockedCount: blocked.length, gasMissing: g.missing, ocrMiss: Array.from(new Set(ocrMiss)),
  idMapped: idMapped.length, idUnmapped, basicT: (function () { try { return g.run('CP_BASIC_T_ && CP_BASIC_T_.m'); } catch (e) { return null; } })(), overviewT: (function () { try { return g.run('CP_OV_T_'); } catch (e) { return null; } })(),
  first: first, lines: out ? (out.lines || []).slice(-40) : null, consoleTail: g.consoleLog.slice(-20), compare: cmp
};
const outPath = argOf('--out', '');
if (outPath) { fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true }); fs.writeFileSync(outPath, JSON.stringify(result, null, 1), 'utf8'); }
console.log('[' + result.mode + '] ' + folder + ' — 싣기 ' + tLoad + 'ms, 실행 ' + tRun + 'ms' + (out ? ' (안쪽 ' + out._ms + 'ms, 단계 ' + JSON.stringify(out._tm) + ')' : '') + (err ? ' 오류: ' + err.message : ''));
console.log('막은 호출 ' + blocked.length + '건: ' + result.blocked.join(', '));
console.log('없는 GAS 기능: ' + JSON.stringify(g.missing));
console.log('ID 맞춘 파일 ' + idMapped.length + ' / 못 맞춘 ' + idUnmapped.length + (idUnmapped.length ? ' (' + idUnmapped.join(', ') + ')' : '') + ' · 기억 없어 못 읽음 ' + result.ocrMiss.length);
if (out) console.log('질문 ' + (out.open || []).length + '개: ' + (out.open || []).join(' · ') + ' · 증빙 ' + result.evidenceCount + '건 · calcReady ' + out.calcReady);
if (cmp.timing) console.log('GAS timing ' + JSON.stringify(cmp.timing.gas) + '\nPC  timing ' + JSON.stringify(cmp.timing.pc));
if (cmp.fields.length) { console.log('칸 대조 ' + cmp.fields.filter((f) => f.same).length + '/' + cmp.fields.length + ' 일치'); cmp.fields.filter((f) => !f.same).forEach((f) => console.log('  ≠ ' + f.key + ': GAS ' + JSON.stringify(f.gas) + ' ↔ PC ' + JSON.stringify(f.pc))); }
if (cmp.questions) console.log('질문 대조 — GAS만 ' + JSON.stringify(cmp.questions.onlyGas) + ' · PC만 ' + JSON.stringify(cmp.questions.onlyPc));
