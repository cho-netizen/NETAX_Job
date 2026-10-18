// ============================================================
// [2026.10.15] 상담 음성메모 — 접는 폰 커버화면에서 아래로 밀어 여는 녹음 화면(manage/aichat.html nxCm*)의 서버 쪽.
// 세무사님 요청: 시작·일시정지·다시 시작·종료로 납세자 상담을 녹음하고, 종료하면 글로 요약해 사건 폴더에
// 상담내용 .md로 저장. 사건 연결은 화면에서 후보 버튼을 골라 확정한다(말로 들은 대로 자동 연결하지 않음).
//
// 흐름
//  1) consult_chunk  — 녹음 파일을 2MB 조각으로 받는다(휴대폰 통신이 잠깐 끊겨도 그 조각만 다시 보냄). 임시 폴더에 보관.
//  2) consult_finish — 조각을 합쳐 사건 폴더/상담녹음/에 원본 음성으로 저장하고, 처리 작업을 줄에 세운 뒤 1초 뒤 트리거를 건다.
//  3) consult_runQueue_(트리거) — 제미니에 음성을 한 번 올리고, 10분 구간씩 받아쓴 뒤(긴 상담을 한 번에 받아쓰면 응답이
//     너무 길어 서버 제한 시간에 걸린다), 모은 녹취록으로 요약을 만들어 사건 폴더에 상담내용_날짜_시각.md(요약+녹취록) 저장.
//     한 번 실행은 4분 30초까지만 하고 남으면 다음 트리거로 이어간다(Apps Script 실행 6분 제한).
//  4) consult_status — 화면이 진행 상황을 묻는다. 휴대폰이 꺼져 있어도 서버 처리는 계속된다.
// 비용은 유료질문 기록(kind 'consult')에 남는다. 받아쓰기는 들린 것만 — 안 들리면 [불명확]으로 적고 추측하지 않는다.
// ============================================================
const CONSULT_MODEL_ = 'gemini-3.6-flash';
const CONSULT_SEG_SEC_ = 600;          // 받아쓰기 구간 10분
const CONSULT_RUN_BUDGET_MS_ = 270000; // 한 번 실행 4분 30초
const CONSULT_TMP_FOLDER_ = '_상담녹음임시';
const CONSULT_INBOX_FOLDER_ = '_상담녹음보관함'; // 사건 없이 녹음한 것
const CONSULT_JOB_PREFIX_ = 'CONSULT_JOB_';

function consult_tmpFolder_() { return my_getOrCreateSubfolder_(getDefaultFolder(), CONSULT_TMP_FOLDER_); }
function consult_saveJob_(job) { PropertiesService.getScriptProperties().setProperty(CONSULT_JOB_PREFIX_ + job.id, JSON.stringify(job)); }
function consult_loadJob_(id) {
  const raw = PropertiesService.getScriptProperties().getProperty(CONSULT_JOB_PREFIX_ + String(id || ''));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
// 녹취록은 드라이브 임시 파일에 쌓는다 — 서버 설정 저장소(속성)는 한 칸 9KB 한도라 10분 녹취록도 못 담는다
function consult_trFile_(job) {
  if (job.trId) { try { return DriveApp.getFileById(job.trId); } catch (e) { } }
  const f = consult_tmpFolder_().createFile(job.id + '_녹취록.txt', '', 'text/plain');
  job.trId = f.getId();
  return f;
}
function consult_readTr_(job) { return job.trId ? DriveApp.getFileById(job.trId).getBlob().getDataAsString('UTF-8') : ''; }
function consult_appendTr_(job, text) {
  const f = consult_trFile_(job);
  const cur = f.getBlob().getDataAsString('UTF-8');
  f.setContent((cur ? cur + '\n' : '') + text);
}
// 제미니에 알릴 형식 — 크롬 녹음(webm)은 제미니 음성 형식 목록에 없어 영상 형식(video/webm, 지원)으로 넘긴다(소리만 있어도 받아씀)
function consult_geminiMime_(mime) {
  if (/webm/.test(mime)) return 'video/webm';
  if (/mp4|m4a/.test(mime)) return 'video/mp4';
  return mime;
}
function consult_safeId_(id) { return String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40); }

// 1) 조각 받기 — 같은 조각이 두 번 와도(다시 보내기) 덮어쓴다.
function consult_chunk_(body) {
  const id = consult_safeId_(body.id);
  const idx = Number(body.index);
  if (!id || !(idx >= 0) || !body.base64) return { error: '녹음 조각 정보가 없습니다.' };
  const folder = consult_tmpFolder_();
  const name = id + '_' + ('0000' + idx).slice(-4) + '.part';
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(Utilities.newBlob(Utilities.base64Decode(body.base64), 'application/octet-stream', name));
  return { success: true, index: idx };
}

// 2) 조각이 다 왔는지 확인하고 작업 등록 — 무거운 일(합쳐 저장·제미니 올리기)은 트리거가 한다.
//    (1시간 녹음이면 15MB — 서버에서 한 덩어리로 합치면 메모리가 모자랄 수 있어, 조각을 하나씩 이어 올린다)
function consult_finish_(body) {
  const id = consult_safeId_(body.id);
  const total = Number(body.total);
  if (!id || !(total > 0)) return { error: '녹음 정보가 없습니다.' };
  const already = consult_loadJob_(id);
  if (already) return { success: true, job: consult_publicJob_(already) }; // 다시 보낸 요청 — 이미 등록됨
  const tmp = consult_tmpFolder_();
  const partIds = [];
  let totalBytes = 0;
  for (let i = 0; i < total; i++) {
    const it = tmp.getFilesByName(id + '_' + ('0000' + i).slice(-4) + '.part');
    if (!it.hasNext()) return { error: '녹음 조각 ' + (i + 1) + '/' + total + '이 서버에 없습니다. 다시 올려 주세요.', missing: i };
    const f = it.next();
    partIds.push(f.getId());
    totalBytes += f.getSize();
  }
  const mime = String(body.mimeType || 'audio/webm').split(';')[0];
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  let folderId = '', caseName = '';
  if (body.caseId) {
    try {
      const sheet = work_getSheet_();
      const data = sheet.getDataRange().getValues();
      const col = work_colMap_(data[0]);
      const found = work_findCaseRow_(sheet, col, body.caseId);
      // [2026.10.18 탭연결 2번] 폴더 없는 상담 사건이어도 사건명은 남긴다 — 보관함에 저장돼도 상담내용 제목·작업일지로 어느 사건 것인지 알 수 있게
      if (found) caseName = String(found.row[col.사건명] || '');
      if (found && found.row[col.폴더ID]) folderId = String(found.row[col.폴더ID]);
    } catch (e) { folderId = ''; }
  }
  const inInbox = !folderId;
  if (!folderId) folderId = my_getOrCreateSubfolder_(getDefaultFolder(), CONSULT_INBOX_FOLDER_).getId();
  const job = {
    id: id, status: 'queued', step: '녹음 저장 대기', caseId: body.caseId || '', caseName: caseName,
    folderId: folderId, inInbox: inInbox, partIds: partIds, totalBytes: totalBytes, audioId: '', mime: mime,
    stamp: Utilities.formatDate(startedAt, 'Asia/Seoul', 'yyyyMMdd_HHmm'),
    startedAt: startedAt.getTime(), durationSec: Math.max(1, Math.round(Number(body.durationSec) || 0)),
    segDone: 0, trId: '', geminiFile: '', usd: 0, createdAt: Date.now()
  };
  consult_saveJob_(job);
  consult_scheduleRun_();
  return { success: true, job: consult_publicJob_(job) };
}

// 조각들을 드라이브에 한 파일로 이어 올린다(드라이브 재개 업로드 — 조각은 256KB의 배수여야 해서 화면이 2MB로 자른다)
function consult_saveAudio_(job) {
  const folder = DriveApp.getFolderById(job.folderId);
  const audioFolder = my_getOrCreateSubfolder_(folder, '상담녹음');
  const ext = /mp4|m4a|aac/.test(job.mime) ? 'm4a' : (/ogg/.test(job.mime) ? 'ogg' : 'webm');
  const token = ScriptApp.getOAuthToken();
  const start = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, 'X-Upload-Content-Type': job.mime, 'X-Upload-Content-Length': String(job.totalBytes) },
    payload: JSON.stringify({ name: '상담녹음_' + job.stamp + '.' + ext, parents: [audioFolder.getId()], mimeType: job.mime })
  });
  const loc = consult_header_(start, 'location');
  if (!loc) throw new Error('녹음 저장 시작 실패(' + start.getResponseCode() + '): ' + start.getContentText().slice(0, 200));
  let offset = 0, last = null;
  job.partIds.forEach(function (pid) {
    const blob = DriveApp.getFileById(pid).getBlob();
    const end = offset + DriveApp.getFileById(pid).getSize() - 1;
    last = UrlFetchApp.fetch(loc, {
      method: 'put', muteHttpExceptions: true, contentType: job.mime,
      headers: { Authorization: 'Bearer ' + token, 'Content-Range': 'bytes ' + offset + '-' + end + '/' + job.totalBytes },
      payload: blob
    });
    const code = last.getResponseCode();
    if (code !== 308 && code !== 200 && code !== 201) throw new Error('녹음 저장 실패(' + code + '): ' + last.getContentText().slice(0, 200));
    offset = end + 1;
  });
  const res = JSON.parse(last.getContentText() || '{}');
  if (!res.id) throw new Error('녹음 저장 결과를 받지 못했습니다.');
  return res.id;
}

function consult_header_(resp, name) {
  const h = resp.getAllHeaders();
  let v = '';
  Object.keys(h).forEach(function (k) { if (k.toLowerCase() === name) v = String(h[k]); });
  return v;
}

function consult_scheduleRun_() {
  const has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'consult_runQueue_'; });
  if (!has) ScriptApp.newTrigger('consult_runQueue_').timeBased().after(1000).create();
}

function consult_publicJob_(job) {
  return {
    id: job.id, status: job.status, step: job.step, caseName: job.caseName, durationSec: job.durationSec,
    segDone: job.segDone, segTotal: Math.max(1, Math.ceil(job.durationSec / CONSULT_SEG_SEC_)),
    mdId: job.mdId || '', mdUrl: job.mdUrl || '', brief: job.brief || '', error: job.error || '', usd: job.usd || 0
  };
}

// 4) 진행 상황 — 대기 중인데 트리거가 없으면(실패 등) 다시 건다
function consult_status_(body) {
  const job = consult_loadJob_(consult_safeId_(body.id));
  if (!job) return { error: '녹음 작업을 찾을 수 없습니다.' };
  if ((job.status === 'queued' || job.status === 'working') && !CacheService.getScriptCache().get('consult_running')) { try { consult_scheduleRun_(); } catch (e) { } }
  return { success: true, job: consult_publicJob_(job) };
}

// 3) 트리거 — 줄 선 작업을 차례로 처리
function consult_runQueue_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'consult_runQueue_') ScriptApp.deleteTrigger(t); });
  // 서버 전체 잠금(LockService)은 쓰지 않는다 — 받아쓰기는 몇 분 걸려서, 그동안 job의 다른 저장(withLock_)이 모두 막힌다.
  // 같은 처리가 두 번 겹치지 않게만 녹음 처리 전용 표시(6분 뒤 자동 해제)를 둔다.
  const cache = CacheService.getScriptCache();
  if (cache.get('consult_running')) return;
  cache.put('consult_running', '1', 360);
  const lock = { releaseLock: function () { cache.remove('consult_running'); } };
  const t0 = Date.now();
  let more = false;
  try {
    const props = PropertiesService.getScriptProperties().getProperties();
    const jobs = Object.keys(props).filter(function (k) { return k.indexOf(CONSULT_JOB_PREFIX_) === 0; })
      .map(function (k) { try { return JSON.parse(props[k]); } catch (e) { return null; } })
      .filter(function (j) { return j && (j.status === 'queued' || j.status === 'working'); })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
    for (let i = 0; i < jobs.length; i++) {
      const left = consult_work_(jobs[i], t0);
      if (left) { more = true; break; }
    }
    consult_cleanupOld_(props);
  } finally {
    lock.releaseLock();
  }
  if (more) consult_scheduleRun_();
}

// 한 작업을 시간 예산 안에서 진행 — 남으면 true
function consult_work_(job, t0) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  try {
    if (!key) throw new Error('GEMINI_API_KEY가 스크립트 속성에 없습니다.');
    job.status = 'working';
    if (!job.audioId) {
      job.step = '녹음 저장 중';
      consult_saveJob_(job);
      job.audioId = consult_saveAudio_(job);
      consult_saveJob_(job);
    }
    if (!job.geminiFile) {
      job.step = '음성 올리는 중';
      consult_saveJob_(job);
      job.geminiFile = consult_geminiUpload_(job, key);
      (job.partIds || []).forEach(function (pid) { try { DriveApp.getFileById(pid).setTrashed(true); } catch (e) { } });
      job.partIds = [];
      consult_saveJob_(job);
    }
    const segTotal = Math.max(1, Math.ceil(job.durationSec / CONSULT_SEG_SEC_));
    while (job.segDone < segTotal) {
      if (Date.now() - t0 > CONSULT_RUN_BUDGET_MS_) { consult_saveJob_(job); return true; }
      job.step = '받아쓰는 중 (' + (job.segDone + 1) + '/' + segTotal + ')';
      consult_saveJob_(job);
      const from = job.segDone * CONSULT_SEG_SEC_, to = Math.min(job.durationSec, from + CONSULT_SEG_SEC_);
      const part = consult_transcribeSeg_(job, from, to, segTotal, key);
      consult_appendTr_(job, part.text);
      job.usd += part.usd;
      job.segDone++;
      consult_saveJob_(job);
    }
    if (Date.now() - t0 > CONSULT_RUN_BUDGET_MS_) { consult_saveJob_(job); return true; }
    job.step = '요약하는 중';
    consult_saveJob_(job);
    const transcript = consult_readTr_(job);
    const sum = consult_summarize_(job, transcript, key);
    job.usd += sum.usd;
    const folder = DriveApp.getFolderById(job.folderId);
    const md = consult_buildMd_(job, sum.text, transcript);
    const file = folder.createFile(Utilities.newBlob(md, 'text/markdown', '상담내용_' + job.stamp + '.md'));
    job.mdId = file.getId(); job.mdUrl = file.getUrl();
    job.brief = consult_brief_(sum.text);
    job.status = 'done'; job.step = '완료';
    try { DriveApp.getFileById(job.trId).setTrashed(true); } catch (e) { } // 녹취록은 상담내용 파일에 들어갔다
    consult_saveJob_(job);
    // [2026.10.18 탭연결 2번] 사건을 골라 녹음했으면 그 사건 작업일지에 한 줄 남긴다 — 예전엔 사건 화면 어디에도 상담 요약이 안 보였다
    if (job.caseId) {
      try {
        consult_logToCase_(job.caseId, '[상담녹음] ' + Math.round(job.durationSec / 60) + '분 상담 정리됨 — ' + String(job.brief || '').slice(0, 200) +
          (job.inInbox ? ' (사건 폴더가 없어 보관함 「' + CONSULT_INBOX_FOLDER_ + '」에 저장 — 처리개요 📝 메모의 「🎙 보관함 녹음 가져오기」로 이 사건에 옮길 수 있음)' : '') +
          (job.mdUrl ? ' ' + job.mdUrl : ''));
      } catch (e) { console.log('상담녹음 작업일지 기록 실패: ' + e.message); }
    }
    try { ai_logPaid_({ entry: { kind: 'consult', model: CONSULT_MODEL_, usd: job.usd, q: '상담 음성메모 — ' + (job.caseName || '사건 없음') + ' ' + Math.round(job.durationSec / 60) + '분' } }); } catch (e) { }
    return false;
  } catch (err) {
    job.status = 'error'; job.step = '오류'; job.error = String(err && err.message || err).slice(0, 300);
    consult_saveJob_(job);
    return false;
  }
}

// 제미니 파일 올리기(재개 가능 업로드) — 48시간 보관, 여러 구간 받아쓰기에 같은 파일을 쓴다.
function consult_geminiUpload_(job, key) {
  const start = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: {
      'x-goog-api-key': key, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(job.totalBytes), 'X-Goog-Upload-Header-Content-Type': consult_geminiMime_(job.mime)
    },
    payload: JSON.stringify({ file: { display_name: 'consult_' + job.id } })
  });
  const uploadUrl = consult_header_(start, 'x-goog-upload-url');
  if (!uploadUrl) throw new Error('제미니 업로드 시작 실패(' + start.getResponseCode() + '): ' + start.getContentText().slice(0, 200));
  // 드라이브에 합쳐 저장한 원본을 한 번에 보낸다 — Blob을 그대로 넘겨 큰 배열을 만들지 않는다(메모리 보호)
  const resp = UrlFetchApp.fetch(uploadUrl, {
    method: 'post', muteHttpExceptions: true, contentType: consult_geminiMime_(job.mime),
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    payload: DriveApp.getFileById(job.audioId).getBlob()
  });
  if (resp.getResponseCode() !== 200) throw new Error('제미니 업로드 실패(' + resp.getResponseCode() + '): ' + resp.getContentText().slice(0, 200));
  const res = JSON.parse(resp.getContentText() || '{}');
  if (!res.file || !res.file.uri) throw new Error('제미니 업로드 결과 없음: ' + resp.getContentText().slice(0, 200));
  let file = res.file;
  for (let i = 0; i < 30 && file.state && file.state !== 'ACTIVE'; i++) {
    if (file.state === 'FAILED') throw new Error('제미니가 음성 파일을 처리하지 못했습니다.');
    Utilities.sleep(2000);
    const g = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/' + file.name, { headers: { 'x-goog-api-key': key }, muteHttpExceptions: true });
    file = JSON.parse(g.getContentText() || '{}');
  }
  return file.uri;
}

function consult_gemini_(parts, key, maxTokens) {
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + CONSULT_MODEL_ + ':generateContent', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  const json = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) throw new Error('제미니 오류: ' + ((json.error && json.error.message) || res.getResponseCode()));
  const cand = (json.candidates || [])[0] || {};
  const text = ((cand.content && cand.content.parts) || []).map(function (p) { return p.text || ''; }).join('');
  const u = json.usageMetadata || {};
  const cfg = MODEL_CONFIG[CONSULT_MODEL_] || { input: 0, output: 0 };
  const usd = ((u.promptTokenCount || 0) / 1e6) * cfg.input + (((u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0)) / 1e6) * cfg.output;
  return { text: text.trim(), usd: usd };
}

function consult_mmss_(s) { s = Math.max(0, Math.round(s)); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }

function consult_transcribeSeg_(job, from, to, segTotal, key) {
  const range = segTotal > 1 ? ('이 음성의 ' + consult_mmss_(from) + '부터 ' + consult_mmss_(to) + '까지 구간만 받아써라(앞뒤 구간은 다른 요청에서 처리한다). ') : '';
  const prompt = '세무사 사무실의 납세자 상담 녹음이다. ' + range +
    '한국어로 들린 그대로 받아써라. 규칙:\n' +
    '- 말하는 사람이 바뀔 때마다 줄을 바꾸고 앞에 [세무사] 또는 [고객](다른 사람이면 [동석자])을 붙인다. 누군지 모르면 [화자?].\n' +
    '- 각 줄 맨 앞에 시작 시각을 (분:초)로 붙인다. 시각은 녹음 전체 기준이다.\n' +
    '- 금액·날짜·지번·이름은 들린 그대로 정확히. 잘 안 들리면 [불명확]이라고 쓰고 추측해서 채우지 마라.\n' +
    '- 요약하거나 고치지 말고, 받아쓴 내용만 출력하라. 머리말·설명 금지.';
  return consult_gemini_([{ file_data: { mime_type: consult_geminiMime_(job.mime), file_uri: job.geminiFile } }, { text: prompt }], key, 16000);
}

function consult_summarize_(job, transcript, key) {
  const when = Utilities.formatDate(new Date(job.startedAt), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  const prompt = '아래는 세무사 사무실의 납세자 상담 녹취록이다(' + when + ', 약 ' + Math.round(job.durationSec / 60) + '분' +
    (job.caseName ? ', 사건: ' + job.caseName : '') + '). 세무사가 나중에 사건 처리에 바로 쓸 수 있게 마크다운으로 정리하라.\n' +
    '형식(제목은 그대로):\n' +
    '## 핵심 요약\n(3~5줄)\n' +
    '## 사실관계\n(인적사항·재산·거래의 날짜·금액·지번 등 — 녹취록에 나온 것만, 시각 (분:초) 근거 표시)\n' +
    '## 쟁점과 세무사 안내 내용\n' +
    '## 고객 요청·약속한 것\n(세무사가 할 일 / 고객이 할 일을 나눠서)\n' +
    '## 추가로 받을 자료\n' +
    '## 확인 필요\n([불명확]으로 받아쓴 부분, 서로 다르게 말한 숫자 등 — 추측으로 채우지 말 것)\n' +
    '녹취록에 없는 내용은 절대 만들지 마라.\n\n[녹취록]\n' + transcript;
  return consult_gemini_([{ text: prompt }], key, 6000);
}

function consult_buildMd_(job, summary, transcript) {
  const when = Utilities.formatDate(new Date(job.startedAt), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  return '# 상담내용 — ' + (job.caseName || '사건 미지정') + '\n\n' +
    '- 상담 일시: ' + when + '\n- 녹음 길이: 약 ' + Math.round(job.durationSec / 60) + '분\n' +
    '- 원본 음성: 상담녹음/상담녹음_' + job.stamp + '\n- 정리: 자동 받아쓰기·요약(제미니) — 숫자·이름은 원본 음성으로 확인 후 사용\n\n' +
    summary + '\n\n---\n\n## 녹취록 전문\n\n' + transcript + '\n';
}

function consult_brief_(summary) {
  const m = String(summary || '').match(/## 핵심 요약\s*([\s\S]*?)(\n## |$)/);
  return (m ? m[1] : String(summary || '')).replace(/[#*`>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

// 끝난 지 3일 지난 작업 기록은 지운다(속성 저장소 용량 보호)
function consult_cleanupOld_(props) {
  const sp = PropertiesService.getScriptProperties();
  Object.keys(props).forEach(function (k) {
    if (k.indexOf(CONSULT_JOB_PREFIX_) !== 0) return;
    try {
      const j = JSON.parse(props[k]);
      if ((j.status === 'done' || j.status === 'error') && Date.now() - (j.createdAt || 0) > 3 * 86400000) sp.deleteProperty(k);
    } catch (e) { sp.deleteProperty(k); }
  });
}

// ============================================================
// [2026.10.18 탭연결 2번] 상담 녹음 ↔ 사건 연결
//  - 사건을 골라 녹음하면 끝날 때 그 사건 작업일지에 한 줄(요약·파일 링크)을 남긴다(consult_logToCase_)
//  - 사건 없이(또는 폴더 없는 상담 사건으로) 녹음해 「_상담녹음보관함」에 쌓인 것을 처리개요 📝 메모 카드에서 골라
//    그 사건 폴더로 옮긴다(consult_inbox_list → consult_inbox_move). 고른 것만 옮기고 지우는 것은 없다.
// ============================================================
function consult_logToCase_(caseId, text) {
  const sheet = work_getSheet_();
  const col = work_colMap_(sheet.getDataRange().getValues()[0]);
  const found = work_findCaseRow_(sheet, col, caseId);
  if (!found) return;
  const c = work_readRow_(col, found.row);
  const log = (Array.isArray(c.작업일지) ? c.작업일지 : []).concat([{ id: 'log_' + Date.now(), date: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), text: String(text || '').slice(0, 900), dueDate: '' }]);
  // 기대수정일을 같이 보내 그 사이 다른 저장이 있었으면 덮어쓰지 않는다 — 한 번만 다시 읽어 재시도
  let up = work_updateCase({ id: caseId, 작업일지: log, 기대수정일: c.수정일 });
  if (up && up.conflict && up.case) {
    const log2 = (Array.isArray(up.case.작업일지) ? up.case.작업일지 : []).concat([log[log.length - 1]]);
    up = work_updateCase({ id: caseId, 작업일지: log2, 기대수정일: up.case.수정일 });
  }
  return up;
}

function consult_inboxFolder_() { return my_getOrCreateSubfolder_(getDefaultFolder(), CONSULT_INBOX_FOLDER_); }

// 보관함 목록 — 상담내용_날짜_시각.md와 같은 시각의 원본 음성(상담녹음/상담녹음_날짜_시각.*)을 한 묶음으로
function consult_inboxList_() {
  const inbox = consult_inboxFolder_();
  const items = {};
  const it = inbox.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const m = /^상담내용_(\d{8}_\d{4})\.md$/.exec(f.getName());
    if (!m) continue;
    const head = String(f.getBlob().getDataAsString('UTF-8') || '').slice(0, 400);
    const t = /^# 상담내용 — (.*)$/m.exec(head);
    const when = /상담 일시:\s*([^\n]+)/.exec(head);
    items[m[1]] = { stamp: m[1], mdId: f.getId(), mdUrl: f.getUrl(), caseName: t ? t[1].trim() : '', when: when ? when[1].trim() : m[1], audio: [] };
  }
  const af = inbox.getFoldersByName('상담녹음');
  if (af.hasNext()) {
    const ai = af.next().getFiles();
    while (ai.hasNext()) {
      const f = ai.next();
      const m = /^상담녹음_(\d{8}_\d{4})\./.exec(f.getName());
      if (!m) continue;
      if (!items[m[1]]) items[m[1]] = { stamp: m[1], mdId: '', mdUrl: '', caseName: '', when: m[1], audio: [] };
      items[m[1]].audio.push({ id: f.getId(), name: f.getName() });
    }
  }
  const list = Object.keys(items).map(function (k) { return items[k]; }).sort(function (a, b) { return a.stamp < b.stamp ? 1 : -1; });
  return { success: true, items: list.slice(0, 40), total: list.length };
}

// 고른 묶음(stamps)을 사건 폴더로 옮긴다 — 상담내용은 사건 폴더 바로 안(처리개요 📝 메모가 세는 곳), 음성은 사건 폴더/상담녹음/
function consult_inboxMove_(body) {
  const stamps = Array.isArray(body.stamps) ? body.stamps.map(String) : [];
  if (!stamps.length) return { error: '옮길 녹음을 고르세요.' };
  const sheet = work_getSheet_();
  const col = work_colMap_(sheet.getDataRange().getValues()[0]);
  const found = work_findCaseRow_(sheet, col, body.caseId);
  if (!found) return { error: '사건을 찾을 수 없습니다.' };
  const folderId = String(found.row[col.폴더ID] || '');
  if (!folderId) return { error: '이 사건은 아직 사건 폴더가 없습니다 — 업무유형을 정해 폴더를 먼저 만들어 주세요.', noFolder: true };
  const caseFolder = DriveApp.getFolderById(folderId);
  const inbox = consult_inboxFolder_();
  let moved = 0, audioFolder = null;
  const names = [];
  stamps.forEach(function (st) {
    if (!/^\d{8}_\d{4}$/.test(st)) return;
    const md = inbox.getFilesByName('상담내용_' + st + '.md');
    while (md.hasNext()) { md.next().moveTo(caseFolder); moved++; names.push('상담내용_' + st + '.md'); }
    const af = inbox.getFoldersByName('상담녹음');
    if (af.hasNext()) {
      const ai = af.next().getFiles();
      while (ai.hasNext()) {
        const f = ai.next();
        if (f.getName().indexOf('상담녹음_' + st + '.') !== 0) continue;
        if (!audioFolder) audioFolder = my_getOrCreateSubfolder_(caseFolder, '상담녹음');
        f.moveTo(audioFolder); moved++;
      }
    }
  });
  if (!moved) return { error: '고른 녹음을 보관함에서 찾지 못했습니다(이미 옮겼을 수 있습니다).' };
  try { consult_logToCase_(body.caseId, '[상담녹음] 보관함에서 이 사건으로 옮김: ' + names.join(', ')); } catch (e) { }
  return { success: true, moved: moved };
}
