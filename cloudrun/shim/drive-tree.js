// [2026.10.23 T6 2단계] 구글 드라이브(v3, 서비스 계정 기본 자격증명)에서 사건 폴더를 **읽기만** 해서 재현기 가짜 드라이브(vfs.js)의 메모리 항목으로 채운다.
//  - 폴더 목록은 재귀로(깊이 6, 400개 한도 — Code.js caseProcFiles0_와 같은 한도), 파일 내용은 글 파일(markdown·text·json·csv, 2MB 이하)만 미리 내려받는다.
//    PDF·사진은 내용을 내려받지 않는다 — 글자는 요청의 ocrMemory(글자인식 기억)에서만 읽기 때문(기억에 없으면 "못 읽음").
//  - GAS 코드는 동기(synchronous)로 DriveApp을 부르므로, 실행 전에 여기서 전부 받아 둔다(비동기 → 동기 변환은 불가).
//  - 쓰기(createFile·setContent·휴지통 등)는 vfs가 메모리에만 한다 — 실제 드라이브는 바뀌지 않는다. 서비스 계정은 뷰어라 쓰려 해도 거절된다.
'use strict';
const { VFS, VFolder, VFile, mimeOf } = require('./vfs');

const FOLDER = 'application/vnd.google-apps.folder';
const TEXT_RE = /^(text\/|application\/json|application\/x-?markdown)/;
const MAX_FILES = 400, MAX_DEPTH = 6, MAX_TEXT_BYTES = 2 * 1024 * 1024;
const OCRMEM_FILE = "_글자기억.json"; // Code.js T6_OCRMEM_FILE_와 같은 이름
const SKIP_DIR_RE = /^(보고서_내부|보고서_외부|_이전판|이전버전|_원본사진|_글자인식기억|_사건처리점검|_도구|도구|_휴대폰받은파일)$/; // [2026.10.28] Code.js CASEPROC_SKIP_DIR_RE_와 같게 유지(tools/check-skipdir-sync — 아래 module.exports로 내보내 시험이 대조)

let driveClient = null;
async function drive() {
  if (driveClient) return driveClient;
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

async function listChildren(d, parentId) {
  const out = []; let pageToken;
  do {
    const r = await d.files.list({ q: "'" + parentId + "' in parents and trashed = false", fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)', pageSize: 200, pageToken, supportsAllDrives: true, includeItemsFromAllDrives: true });
    (r.data.files || []).forEach((f) => out.push(f));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return out;
}

async function download(d, id) {
  // [2026.10.27 16:4x] 드라이브 API 매개변수 이름은 fileId — 'id'로 넘기면 "Missing required parameters: fileId"로 조용히 실패해 글 파일·_글자기억.json이 빈 채로 돌아 memSource가 'none'이 됨(가상양도21 직결 복귀 원인)
  const r = await d.files.get({ fileId: id, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
  return Buffer.from(r.data);
}

// 사건 폴더 하나를 읽어 { vfs, caseFolder, bm, store, chief, root, stats } — stats는 개수만(서류 이름·내용은 로그에 안 남긴다)
async function buildCaseTree(folderId, opt) {
  opt = opt || {};
  const d = await drive();
  const vfs = new VFS({ manifest: {}, nameToId: {}, storeIndex: {} });
  const bm = vfs.mem('업무관리자');
  const store = vfs.mem('_글자인식기억', bm); bm._folders.push(store); // 비어 있음 — 기억은 ocrMemory로만
  const chief = vfs.mem('총괄관리자');
  const root = vfs.mem('고객사건');
  const stats = { folders: 0, files: 0, textDownloaded: 0, textBytes: 0, truncated: false, listMs: 0, downloadMs: 0 };
  const t0 = Date.now();
  let meta = null;
  try { meta = (await d.files.get({ fileId: folderId, fields: 'id, name, mimeType', supportsAllDrives: true })).data; } catch (e) { throw new Error('사건 폴더를 읽지 못함(공유 안 됨?): ' + (e && e.message || e)); }
  const caseFolder = new VFolder(vfs, { id: folderId, name: meta.name || folderId, parent: root });
  vfs.byId[folderId] = caseFolder; root._folders.push(caseFolder);
  const pendingText = [];
  const walk = async (folder, depth) => {
    if (depth > MAX_DEPTH || stats.files >= MAX_FILES) { stats.truncated = true; return; }
    const kids = await listChildren(d, folder.id);
    for (const k of kids) {
      if (k.mimeType === FOLDER) {
        // [2026.10.28 읽을 대상 ①] 산출물·보관 폴더는 걷지도 않는다 — gs-backend/Code.js CASEPROC_SKIP_DIR_RE_(caseProcFolderRule_ 'skip')와 같은 이름 목록(거기를 고치면 여기도). 양도코리아·_신고제출·참고 폴더는 사건 종류에 따라 다르므로 reader 안의 Code.js 판정에 맡긴다
        if (SKIP_DIR_RE.test(String(k.name || '').trim())) { stats.skippedFolders = (stats.skippedFolders || 0) + 1; continue; }
        const sub = new VFolder(vfs, { id: k.id, name: k.name, parent: folder });
        vfs.byId[k.id] = sub; folder._folders.push(sub); stats.folders++;
        await walk(sub, depth + 1);
        continue;
      }
      if (stats.files >= MAX_FILES) { stats.truncated = true; break; }
      const mod = Date.parse(k.modifiedTime) || Date.now();
      const f = new VFile(vfs, { id: k.id, name: k.name, mimeType: k.mimeType || mimeOf(k.name), modified: mod, mem: '', parent: folder, driveSize: Number(k.size || 0) });
      // 크기는 드라이브 값으로(메모리 내용이 비어 있어도)
      f.getSize = function () { return this.driveSize || Buffer.byteLength(this.mem || ''); };
      vfs.byId[k.id] = f; folder._files.push(f); stats.files++;
      // [2026.10.27 T6 3단계] 사건 폴더 안 글자 기억 사본(_글자기억.json, GAS 미리 읽기가 둠)은 크기와 무관하게(20MB까지) 받아 둔다 — 서비스가 글자를 읽는 유일한 길
      if (k.name === OCRMEM_FILE) { if ((f.driveSize || 0) <= 20 * 1024 * 1024) { pendingText.push(f); stats.ocrMemFile = f; } else stats.ocrMemTooBig = true; }
      else if (TEXT_RE.test(String(f.mimeType)) && (f.driveSize || 0) <= MAX_TEXT_BYTES) pendingText.push(f);
    }
  };
  await walk(caseFolder, 0);
  stats.listMs = Date.now() - t0;
  const t1 = Date.now();
  for (const f of pendingText) { // 하나씩(동시 대량 읽기 금지)
    try { const buf = await download(d, f.id); f.mem = buf.toString('utf8'); stats.textDownloaded++; stats.textBytes += buf.length; }
    catch (e) { f.mem = ''; stats.textErrors = (stats.textErrors || 0) + 1; stats.lastTextError = String(e && e.message || e).slice(0, 120); } // 조용히 삼키지 않고 개수·마지막 오류를 남긴다(L2_job_server: catch가 빈 결과로 삼키면 거짓 성과)
  }
  stats.downloadMs = Date.now() - t1;
  return { vfs, caseFolder, bm, store, chief, root, stats };
}

module.exports = { buildCaseTree, OCRMEM_FILE, SKIP_DIR_RE };
