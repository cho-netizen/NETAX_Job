#!/usr/bin/env node
// ============================================================
// [2026.10.23 T6 2단계] 읽기 전용 시험 서비스 — Cloud Run(netax-case-reader, node 20)
// ------------------------------------------------------------
// 하는 일: POST /read 로 사건 하나(caseId·folderId·sheetRow·ocrMemory)를 받아, 조립 모듈 dist/reader.js(tools/build-reader.js가 gs-backend에서 추린
//  사건처리 한 번 호출 caseProcAll_)를 그대로 돌려 ①사건파악·②증빙 정리·③칸 채우기 결과를 JSON으로 돌려준다. GET /health 는 살아 있는지만.
// 지키는 것(설계서 2·6절):
//  - 드라이브는 서비스 계정으로 **읽기만**(shim/drive-tree.js). 결정 파일·작업관리 시트·채팅 폴더 쓰기는 **메모리로 받아 응답 JSON(written)에 실어 돌려준다** — 아무것도 저장하지 않음.
//  - 글자인식 기억은 요청의 ocrMemory에서만 읽는다(_글자인식기억 폴더는 공유 안 됨). 없으면 unreadFiles에 적는다. 구글 글자인식은 부르지 않는다.
//  - 달력 동기화는 빈 함수. UrlFetchApp·ScriptApp·LockService·Drive(고급)은 불리면 오류(불린 목록이 보고 거리 — gasMissing).
//  - 바깥 AI 호출 코드 없음. 로그는 사건 ID·단계별 초·파일 수만(서류 내용·이름·금액은 찍지 않는다).
//  - [2026.10.27 T6 3단계 — 화면 직결] 문은 "인증 없이 받기"(브라우저 사전 요청 OPTIONS가 IAM 문을 못 넘기 때문, 설계서 3-1 권장안)이고, 대신 **서비스 안에서** 구글 ID 토큰을 검증한다:
//    발급자 accounts.google.com · 받는 이(audience) = Apps Script 클라이언트(T6_AUDIENCE) · 만료 · 이메일 허용 목록(T6_ALLOWED_EMAILS, 기본 cho@netax.kr). 틀리면 401. /health만 토큰 없이 ok(깨우기용, 내용 없음).
//    CORS는 https://job.netax.kr·http://localhost만. 로그에 호출자 이메일을 더한다(사건 ID·초·파일 수와 함께; 서류 내용·이름·금액은 여전히 안 찍음).
//  - 글자 기억: 요청 ocrMemory가 있으면 그것, 없으면 사건 폴더의 _글자기억.json(GAS 미리 읽기가 둔 사본, 열쇠 → 글)을 드라이브에서 읽어 쓴다.
// 원본 코드는 gs-backend 하나(두 벌 금지) — 이 파일은 흉내 층과 입구만. 코드 판은 dist/reader.js 머리글(원본 git SHA)에서 읽어 codeVersion으로 돌려준다.
// ============================================================
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadBackend, formatDate } = require('./shim/gas');
const { VFolder, VFile } = require('./shim/vfs');
const { buildCaseTree, OCRMEM_FILE } = require('./shim/drive-tree');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const READER = path.join(DIST, 'reader.js');
const PORT = Number(process.env.PORT || 8080);
const MAX_BODY = 64 * 1024 * 1024; // 글자 기억을 함께 받으므로 넉넉히
const ENGINE = 'cloudrun';
const STARTED = Date.now();
// ---------- 문(CORS·토큰) ----------
const ALLOWED_ORIGINS = ['https://job.netax.kr', 'http://localhost'];
const AUDIENCE = process.env.T6_AUDIENCE || '638504746086-826uq73k9hj7ikingvmuub8o240ddfjt.apps.googleusercontent.com'; // Apps Script 프로젝트의 클라이언트(ID 토큰의 받는 이)
const ALLOWED_EMAILS = String(process.env.T6_ALLOWED_EMAILS || 'cho@netax.kr').split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
function originOk(o) { if (!o) return false; return ALLOWED_ORIGINS.some((a) => o === a || o.indexOf(a + ':') === 0); } // localhost:포트도
function corsHeaders(req) {
  const o = String(req.headers.origin || '');
  const h = { 'Vary': 'Origin' };
  if (originOk(o)) { h['Access-Control-Allow-Origin'] = o; h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'; h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'; h['Access-Control-Max-Age'] = '600'; }
  return h;
}
let verifier = null;
async function verifyCaller(req) { // → { ok, email } | { ok:false, error }
  const m = /^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization || ''));
  if (!m) return { ok: false, error: '토큰 없음' };
  try {
    if (!verifier) { const { OAuth2Client } = require('google-auth-library'); verifier = new OAuth2Client(); }
    const ticket = await verifier.verifyIdToken({ idToken: m[1], audience: AUDIENCE }); // 서명·만료·받는 이를 본다
    const p = ticket.getPayload() || {};
    if (!/^(https:\/\/)?accounts\.google\.com$/.test(String(p.iss || ''))) return { ok: false, error: '발급자 아님' };
    const email = String(p.email || '').toLowerCase();
    if (!email || p.email_verified === false) return { ok: false, error: '이메일 없음' };
    if (ALLOWED_EMAILS.indexOf(email) === -1) return { ok: false, error: '허용 목록에 없는 계정' };
    return { ok: true, email };
  } catch (e) { return { ok: false, error: '토큰 검증 실패: ' + String(e && e.message || e).slice(0, 120) }; }
}

function codeVersion() {
  try { const head = fs.readFileSync(READER, 'utf8').slice(0, 600); const m = /원본 ([0-9a-f]{7,40})/.exec(head); return (m && m[1]) || process.env.CODE_VERSION || '?'; } catch (e) { return process.env.CODE_VERSION || '?'; }
}
let HEADERS = null;
function headers() {
  if (HEADERS) return HEADERS;
  const g0 = loadBackend({ vfs: { getFileById() { throw new Error('x'); }, getFolderById() { throw new Error('x'); }, allFiles: () => [], root: null }, backendDir: DIST, files: ['reader.js'], headers: [], rows: [] });
  HEADERS = Array.from(g0.run('WORK_HEADERS'));
  return HEADERS;
}

function missingProxy(name, report) {
  return new Proxy(function () {}, {
    get(t, k) { if (k === Symbol.toPrimitive || k === 'toString') return () => '[없음 ' + name + ']'; if (k === 'then') return undefined; return missingProxy(name + '.' + String(k), report); },
    apply() { report(name); throw new Error('읽기 전용 시험 서비스에 없는 GAS 기능: ' + name); }
  });
}

// 메모리 쓰기 기록 — 실제 드라이브는 바뀌지 않지만 "코드가 어디에 쓰려 했는지"를 응답에 실어 돌려준다
function recordWrites(list) {
  const wrap = (proto, name, label) => { const orig = proto[name]; proto[name] = function () { list.push(label + '.' + name); return orig.apply(this, arguments); }; return () => { proto[name] = orig; }; };
  const undo = [];
  ['createFile', 'createFolder'].forEach((n) => undo.push(wrap(VFolder.prototype, n, 'Folder')));
  ['setContent', 'setTrashed', 'setName', 'moveTo', 'makeCopy'].forEach((n) => undo.push(wrap(VFile.prototype, n, 'File')));
  return () => undo.forEach((u) => u());
}

async function readCase(body) {
  const t0 = Date.now();
  const caseId = String(body.caseId || '').trim(), folderId = String(body.folderId || '').trim();
  if (!caseId || !folderId) return { ok: false, error: 'caseId·folderId가 필요합니다', engine: ENGINE, codeVersion: codeVersion() };
  let ocrMemory = body.ocrMemory && typeof body.ocrMemory === 'object' && Object.keys(body.ocrMemory).length ? body.ocrMemory : null;
  const tree = await buildCaseTree(folderId, {});
  const tDrive = Date.now() - t0;
  // [2026.10.27 T6 3단계] 요청에 기억이 없으면 사건 폴더의 _글자기억.json(열쇠 → 글)
  let memSource = ocrMemory ? 'request' : 'none';
  if (!ocrMemory) {
    ocrMemory = {};
    const mf = tree.stats.ocrMemFile;
    if (mf && mf.mem) { try { const j = JSON.parse(mf.mem); if (j && j.mem && typeof j.mem === 'object') { ocrMemory = j.mem; memSource = 'folder'; } } catch (e) { memSource = 'folder-broken'; } }
    else if (tree.stats.ocrMemTooBig) memSource = 'folder-too-big';
  }
  // 사건 행 — GAS가 보낸 작업관리 1행(사건개요·증빙목록 포함). 폴더 ID는 이 요청의 것으로.
  const row = Object.assign({ id: caseId, 사건개요: {}, 증빙목록: [], 작업일지: [], 세액계산결과: [], 하위업무: [], 법령예규판례: [] }, body.sheetRow || {}, { id: caseId, 폴더ID: folderId });
  const writes = [];
  const unwrap = recordWrites(writes);
  let g, out, err = null, sv = {}, after = null, unread = [], seeded = null, ledgerOut = null; // [2026.10.27 H 보정] seeded는 try 밖(응답)에서도 쓰므로 여기서 선언 — try 안 const였을 때 "seeded is not defined"로 직결이 실패해 GAS 길로 복귀(가상양도24 운영 확인)
  try {
    g = loadBackend({
      vfs: tree.vfs, backendDir: DIST, files: ['reader.js'], headers: headers(), rows: [row],
      props: { BUSINESS_MANAGER_FOLDER_ID: tree.bm.getId(), OCR_STORE_FOLDER_ID: tree.store.getId(), CHIEF_MANAGER_FOLDER_ID: tree.chief.getId(), NX_DEFAULT_FOLDER_ID: tree.root.getId() }
    });
    const report = (n) => { g.missing[n] = (g.missing[n] || 0) + 1; };
    // 바깥 호출·잠금은 불리면 오류(재현기 흉내 층은 LockService를 조용히 통과시키지만 여기서는 막는다 — 불리는지 자체가 측정 결과)
    // 잠금은 결정 파일 쓰기(caseProcPatch_)·사건 행 저장 안에서 불린다 — 막으면 ③이 서지 않아(모의 확인), 통과시키되 횟수를 센다(lockCalls). 요청 하나가 사건 하나를 메모리에서만 다루므로 잠금은 뜻이 없다
    const lockCalls = { getUserLock: 0, getScriptLock: 0, getDocumentLock: 0 };
    const fakeLock = { waitLock() {}, tryLock() { return true; }, releaseLock() {}, hasLock() { return true; } };
    g.ctx.LockService = { getUserLock() { lockCalls.getUserLock++; return fakeLock; }, getScriptLock() { lockCalls.getScriptLock++; return fakeLock; }, getDocumentLock() { lockCalls.getDocumentLock++; return fakeLock; } };
    g.ctx.__lockCalls = lockCalls;
    g.ctx.UrlFetchApp = missingProxy('UrlFetchApp', report);
    g.ctx.ScriptApp = missingProxy('ScriptApp', report);
    g.ctx.__cr = { ocrMemory, unread, calendarCalls: 0 };
    g.run(`
      // 글자인식 기억 — 요청에 담긴 것만. 쓰기는 하지 않는다
      tcOcrStoreGet_ = function (k) { var v = __cr.ocrMemory[k]; return (v === undefined || v === null) ? null : String(v); };
      tcOcrStorePut_ = function () {}; tcOcrStoreSet_ = function () {};
      // 구글 글자인식은 부르지 않는다 — 기억에 없는 서류는 "못 읽음"으로
      ocrFileText_ = function (id) { __cr.unread.push(String(id)); return ''; };
      // 달력 동기화는 하지 않는다(사건 행 저장 때 불림)
      work_syncCaseCalendar_ = function () { __cr.calendarCalls++; };
      work_deleteCaseCalendarEvents_ = function () { __cr.calendarCalls++; };
    `);
    // 결정 파일(기록부)을 GAS가 보낸 상태로 미리 둔다 — [2026.10.27 H] 예전엔 body.decisions(화면이 보낸 qid→결정 지도)를 기록부 맨 위에 붙여(s.decisions가 아님) 결정이 전혀 안 먹었고,
    //  읽을 범위·답 저장소·고침 기록은 아예 오지 않아 답한 질문을 다시 묻고 범위 밖 서류를 읽었다(가상양도23). 이제 body.record(기록부 바탕: decisions·readScope·trAns·valueHist·closed·docFix·filled…)를 제자리에,
    //  body.decisions는 qid→결정 지도로 s.decisions에 합친다. 옛 화면이 기록부 통째(remaining·decisions 키가 든 것)를 decisions로 보내면 그것도 바탕으로 본다
    const RECORD_KEYS = ['decisions', 'readScope', 'trAns', 'valueHist', 'closed', 'docFix', 'filled', 'giftDeal', 'ihChoices', 'cxAi', 'readFiles', 'scanOffered', 'holdNotes'];
    const isMap = (o) => o && typeof o === 'object' && !Array.isArray(o);
    const looksLikeRecord = (o) => isMap(o) && (('remaining' in o) || ('decisions' in o) || ('trAns' in o) || ('readScope' in o));
    let record = isMap(body.record) ? body.record : (looksLikeRecord(body.decisions) ? body.decisions : null);
    const decMap = isMap(body.decisions) && !looksLikeRecord(body.decisions) ? body.decisions : null;
    if (record || decMap) {
      try {
        g.ctx.caseProcPatch_(caseId, function (s) {
          if (record) RECORD_KEYS.forEach((k) => { if (record[k] !== undefined && record[k] !== null) s[k] = record[k]; });
          if (decMap) s.decisions = Object.assign({}, s.decisions || {}, decMap);
        });
      } catch (e) {}
      // [2026.10.28 시정 2단계] 사건 장부 바탕도 미리 둔다 — 세무사님·넥스가 정한 값·결정을 서비스가 알고 돈다(장부 없이 돌면 답한 칸을 다시 묻는다)
      if (record && record.ledger && typeof record.ledger === 'object' && record.ledger.rows) { try { g.ctx.ledgerMutate_(caseId, function (L) { L.rows = record.ledger.rows; L.log = Array.isArray(record.ledger.log) ? record.ledger.log : []; }); } catch (e) {} }
      writes.length = 0; // 미리 두기는 쓰기 기록에서 뺀다
    }
    seeded = { record: !!record, decisions: decMap ? Object.keys(decMap).length : (record && record.decisions ? Object.keys(record.decisions).length : 0), readScope: !!(record && record.readScope) };
    const opt = Object.assign({ step: 'all', budgetMs: 280000 }, body.options && typeof body.options === 'object' ? { skipEvidence: !!body.options.skipEvidence, budgetMs: Number(body.options.budgetMs) || 280000 } : {});
    try { out = g.ctx.caseProcAll_(g.ctx.akReadCase_(caseId) || row, opt); } catch (e) { err = e; }
    try { sv = g.ctx.caseProcLoad_(caseId) || {}; } catch (e) { sv = {}; }
    // [2026.10.28 시정 2단계] 사건 장부 — 서비스가 서류를 읽어 장부에 쓴 줄(값·서류 역할·물음)을 GAS가 진짜 장부에 합치도록 돌려준다(예전엔 메모리에서 사라짐)
    try { ledgerOut = g.ctx.ledgerLoad_(caseId, true); } catch (e) { ledgerOut = null; }
    try { after = g.ctx.akReadCase_(caseId); } catch (e) { after = null; }
  } finally { unwrap(); }
  const tm = (out && out._tm) || {};
  const total = Date.now() - t0;
  // 못 읽은 서류 — 이름 대신 ID(로그·응답에 서류 이름을 남기지 않는다). GAS 쪽이 ID로 이름을 맞춘다
  const unreadFiles = Array.from(new Set(unread));
  const questions = out ? (out.items || []).filter((it) => it && !it.error).map((it) => ({ id: it.id, kind: it.kind, step: it.step, label: it.label || '', text: String(it.text || '').slice(0, 400), target: it.ask && it.ask.target || '' })) : [];
  const res = {
    ok: !!(out && out.ok !== false) && !err, engine: ENGINE, codeVersion: codeVersion(), caseId,
    error: err ? String(err && err.message || err) : (out && out.error) || null,
    stages: out ? { basic: out.stages && out.stages.basic || null, evidence: out.stages && out.stages.evidence || null, overview: out.stages && out.stages.overview || null } : null,
    questions, open: out ? out.open || [] : [], hard: out ? out.hard || [] : [], calcReady: out ? !!out.calcReady : false, partial: out ? !!out.partial : null, more: out ? !!out.more : null, next: out ? out.next || null : null,
    lines: out ? out.lines || [] : [],
    timing: { drive: Math.round(tDrive / 100) / 10, basic: tm.basic || 0, ocr: tm.evidence_read || 0, evidence: tm.evidence || 0, overview: tm.overview || 0, calc: tm.calc || 0, inner: out ? Math.round((out._ms || 0) / 100) / 10 : 0, total: Math.round(total / 100) / 10 },
    unreadFiles, memKeysGiven: Object.keys(ocrMemory).length, memSource,
    seeded, // [2026.10.27 H] 요청에 실려 온 기록부 바탕(결정 수·읽을 범위)이 제자리에 들어갔는지 — 화면·재현기가 확인
    readScope: sv.readScope || null, // 기록부 바탕의 읽을 범위가 제자리에 있었는지(있으면 서류 목록 입구 caseProcFiles0_가 그 범위만 썼다)
    files: { folders: tree.stats.folders, count: tree.stats.files, textDownloaded: tree.stats.textDownloaded, textErrors: tree.stats.textErrors || 0, lastTextError: tree.stats.lastTextError || '', truncated: tree.stats.truncated, listMs: tree.stats.listMs, downloadMs: tree.stats.downloadMs },
    evidenceCount: (after && after.증빙목록 || []).length,
    filled: sv.filled || {},
    // 쓰려 했던 것(메모리에만) — GAS 쪽이 대조하거나 저장하려면 이것을 쓴다
    written: { decisionFile: sv, ledger: ledgerOut, caseRow: after ? { 사건개요: after.사건개요 || {}, 증빙목록: after.증빙목록 || [], 기준일: after.기준일 || '', 법정일: after.법정일 || '' } : null, writes: Array.from(new Set(writes)), writeCount: writes.length, calendarCalls: g ? g.ctx.__cr.calendarCalls : 0 },
    gasMissing: g ? g.missing : {}, lockCalls: g ? g.ctx.__lockCalls : null
  };
  // 로그: 사건 ID·초·파일 수만
  console.log(JSON.stringify({ at: formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'), caller: body.__caller || '', caseId, ok: res.ok, memSource, timing: res.timing, files: res.files.count, textDl: res.files.textDownloaded, textErr: res.files.textErrors, lastTextError: res.files.lastTextError, unread: unreadFiles.length, questions: questions.length, writes: res.written.writeCount, missing: Object.keys(res.gasMissing) }));
  return res;
}

function send(resp, code, obj) { const s = JSON.stringify(obj); resp.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s) }); resp.end(s); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(new Error('요청이 너무 큼')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, resp) => {
  const cors = corsHeaders(req);
  const sendC = (code, obj) => { const s = JSON.stringify(obj); resp.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s) }, cors)); resp.end(s); };
  try {
    if (req.method === 'OPTIONS') { resp.writeHead(originOk(String(req.headers.origin || '')) ? 204 : 403, cors); return resp.end(); } // 브라우저 사전 요청 — 허용 출처만
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) return sendC(200, { ok: true, engine: ENGINE, codeVersion: codeVersion(), readerLoaded: fs.existsSync(READER), uptimeSec: Math.round((Date.now() - STARTED) / 1000) });
    if (req.method === 'POST' && req.url === '/read') {
      const who = await verifyCaller(req);
      if (!who.ok) { console.log(JSON.stringify({ at: formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'), deny: who.error })); return sendC(401, { ok: false, error: '인증 실패: ' + who.error, engine: ENGINE }); }
      const raw = await readBody(req);
      let body; try { body = JSON.parse(raw || '{}'); } catch (e) { return sendC(400, { ok: false, error: 'JSON 아님' }); }
      body.__caller = who.email;
      const r = await readCase(body);
      return sendC(r.ok || r.stages ? 200 : 400, r);
    }
    sendC(404, { ok: false, error: '없는 입구' });
  } catch (e) {
    console.log(JSON.stringify({ error: String(e && e.message || e).slice(0, 200) }));
    sendC(500, { ok: false, error: String(e && e.message || e).slice(0, 300), engine: ENGINE });
  }
});
if (require.main === module) server.listen(PORT, () => console.log(JSON.stringify({ listening: PORT, engine: ENGINE, codeVersion: codeVersion(), readerLoaded: fs.existsSync(READER) })));
module.exports = { readCase, server, verifyCaller, corsHeaders, ALLOWED_ORIGINS, ALLOWED_EMAILS, AUDIENCE };
