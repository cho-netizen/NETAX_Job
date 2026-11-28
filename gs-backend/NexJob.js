// ============================================================
// [2026.11.27] 넥스 일감 — 넥스가 단계를 밟는 일을 화면이 아니라 서버가 붙잡고 끝까지 한다.
//  세무사님 11-27 「어제 스마트폰에서 상당히 오랜시간 큰 작업을 하다가 토큰만 잔뜩 잡아먹고 나서 결국 허망하게 네트워크 오류라는 결과를 받았거든」
//  → 「잘난 네가 더이상 이런 일이 재발하지 하지 않도록 당장 수정하고 커푸배하라」 / 「스마트폰에서 넥스에게 일 시키고 계속 화면만 지켜보는 사람이 어디 있겠나?」
//  / 「이것은 휴대폰과 태블릿 만의 문제가 아니다. 노트북이나 pc에서도 마찬가지 아닌가?」
//  예전(2026.08~11-26): 화면이 단계마다 서버를 불렀다(Code.js callClaude 주석 — 서버 한 요청 6분 한도 때문에 옮김). 화면이 꺼지거나
//  통신이 끊기면 그때까지 한 일·질문·비용 기록이 모두 버려졌다(11-26 18:21~18:33 휴대폰 「추가자료가 들어왔다」).
//  지금: 화면은 일감(질문·화면 상태·설정)을 맡기고 진행을 묻기만 한다. 서버는 한 번에 약 2분 반까지 새 단계를 시작하며 돌리고
//  단계마다 일감 파일(_AI대화기록/_넥스일감/번호.json)에 저장한다. 화면이 다음 묶음을 부르지 못하면(꺼짐·창 닫음·통신 끊김) 1분 틱이 이어 간다.
//  끝난 답을 화면이 1분 안에 받아 가지 않으면 서버가 대화에 직접 넣는다 — 어느 기기에서 열어도 보인다. 모든 기기 한 길.
//  계획서: 총괄관리자/_기록/넥스_끊겨도_이어가기_계획서_20261127.html(정할 것은 권장안)
// ============================================================
const NXJOB_FOLDER_ = '_넥스일감';
const NXJOB_OPEN_PROP_ = 'NXJOB_OPEN';       // 끝나지 않았거나 아직 대화에 안 들어간 일감 번호 목록
const NXJOB_CHUNK_MS_ = 150000;             // 한 묶음 안에서 새 단계를 시작하는 한도(한 단계가 길어도 서버 6분 안)
const NXJOB_LEASE_MS_ = 380000;             // 쥔 실행이 이만큼 지나면 죽은 것으로 본다(구글 서버 한 실행 최대 6분)
const NXJOB_APPEND_AFTER_MS_ = 60000;       // 끝난 뒤 화면이 이만큼 안 받아 가면 서버가 대화에 넣는다
const NXJOB_MAX_ROUNDS_ = 80;

function nxJob_folder_() { return my_getOrCreateSubfolder_(ai_convFolder_(), NXJOB_FOLDER_); }
function nxJob_cleanId_(id) { return String(id || '').replace(/[^\w-]/g, '').slice(0, 40); }
function nxJob_now_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'); }

function nxJob_file_(id) {
  const cache = CacheService.getScriptCache(), ck = 'nxjob_fid_' + id;
  const fid = cache.get(ck);
  if (fid) { try { return DriveApp.getFileById(fid); } catch (e) {} }
  const it = nxJob_folder_().getFilesByName(id + '.json');
  if (!it.hasNext()) return null;
  const f = it.next();
  try { cache.put(ck, f.getId(), 21600); } catch (e) {}
  return f;
}
function nxJob_load_(id) {
  const f = nxJob_file_(id);
  if (!f) return null;
  try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; }
}
// 화면이 자주 묻는 진행 — 대화 내용 없이 작게(캐시 먼저)
function nxJob_snap_(job, extra) {
  const s = { id: job.id, status: job.status, round: job.round || 0, toolN: job.toolN || 0, usage: job.usage || null, error: job.error || '', updated: job.updated || '',
    sec: job.createdMs ? Math.round((Date.now() - job.createdMs) / 1000) : 0, running: !!(job.lease && job.lease.until > Date.now()) };
  if (job.status === 'done') { s.reply = job.reply || ''; s.actions = job.actions || []; s.appended = !!job.appended; }
  return Object.assign(s, extra || {});
}
function nxJob_save_(job) {
  job.updated = nxJob_now_();
  const text = JSON.stringify(job);
  let f = nxJob_file_(job.id);
  if (f) f.setContent(text);
  else { f = nxJob_folder_().createFile(job.id + '.json', text, 'application/json'); try { CacheService.getScriptCache().put('nxjob_fid_' + job.id, f.getId(), 21600); } catch (e) {} }
  try { const t = JSON.stringify(nxJob_snap_(job)); if (t.length < 90000) CacheService.getScriptCache().put('nxjob_st_' + job.id, t, 21600); } catch (e) {}
}
function nxJob_openList_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(NXJOB_OPEN_PROP_) || '[]'); } catch (e) { return []; } }
function nxJob_openSet_(id, on) {
  withLock_(8000, function () {
    const p = PropertiesService.getScriptProperties();
    let a = []; try { a = JSON.parse(p.getProperty(NXJOB_OPEN_PROP_) || '[]'); } catch (e) { a = []; }
    a = a.filter(function (x) { return x !== id; });
    if (on) a.push(id);
    p.setProperty(NXJOB_OPEN_PROP_, JSON.stringify(a.slice(-40)));
  });
}

// 맡기기 — 같은 번호로 다시 오면(통신이 끊겨 화면이 다시 보냄) 새로 만들지 않고 이어 돌린다
function nxJob_start_(body) {
  const id = nxJob_cleanId_(body.jobId);
  if (!id) return { error: '일감 번호가 없습니다.' };
  if (!Array.isArray(body.messages) || !body.messages.length) return { error: '메시지가 비어 있습니다.' };
  const made = withLock_(10000, function () {
    if (nxJob_file_(id)) return { exists: true };
    const base = {};
    Object.keys(body).forEach(function (k) { if (!/^(_token|_key|action|jobId|messages|q|kind|convId|maxRounds|forceWrapUp|costMeta)$/.test(k)) base[k] = body[k]; });
    const job = { id: id, convId: String(body.convId || ''), caseId: String((body.context && body.context.linkedCase && body.context.linkedCase.id) || ''),
      q: String(body.q || '').slice(0, 2000), kind: String(body.kind || 'chat').slice(0, 20), status: 'run', created: nxJob_now_(), createdMs: Date.now(),
      round: 0, toolN: 0, usage: { usd: 0, model: '', rounds: 0 }, messages: body.messages, base: base, actions: [], reply: '', error: '',
      maxRounds: Math.max(1, Math.min(NXJOB_MAX_ROUNDS_, Number(body.maxRounds) || 14)), lease: null, acked: false, appended: false, paidUsd: 0 };
    nxJob_save_(job);
    return { made: true };
  });
  if (made && made.error) return made;
  nxJob_openSet_(id, true);
  return nxJob_run_(id, 'screen', NXJOB_CHUNK_MS_);
}

// 이어 돌리기 — 다른 실행이 쥐고 있으면 기다리지 않고 진행만 돌려준다(busy)
function nxJob_run_(id, who, budgetMs) {
  id = nxJob_cleanId_(id);
  const got = withLock_(10000, function () {
    const job = nxJob_load_(id);
    if (!job) return { missing: true, id: id, status: '' };
    if (job.status !== 'run') return { snap: nxJob_snap_(job) };
    if (job.lease && job.lease.until > Date.now()) return { snap: nxJob_snap_(job, { busy: true }) };
    job.lease = { by: who, at: nxJob_now_(), until: Date.now() + NXJOB_LEASE_MS_ };
    nxJob_save_(job);
    return { job: job };
  });
  if (!got || got.error) return { error: (got && got.error) || '일감을 열지 못했습니다.', id: id };
  if (got.missing) return got;
  if (!got.job) return got.snap;
  let job = got.job;
  const t0 = Date.now(), cache = CacheService.getScriptCache();
  let did = 0;
  try {
    while (job.status === 'run') {
      if (cache.get('nxjob_stop_' + id)) { job.status = 'stopped'; job.error = '세무사님이 멈추셨습니다'; break; }
      if (did > 0 && Date.now() - t0 > budgetMs) break; // 이 묶음은 여기까지 — 다음 묶음(화면 또는 1분 틱)이 이어 간다
      const forceWrapUp = job.round >= job.maxRounds;
      const body = Object.assign({}, job.base, { messages: job.messages, forceWrapUp: forceWrapUp, costMeta: { round: job.round + 1, convId: job.convId } });
      let res;
      try { res = nxChatRound_(body); } catch (e) { res = { error: '서버 처리 중 오류: ' + (e && e.message || e) }; }
      did++;
      if (!res || res.error) { job.status = 'error'; job.error = String((res && res.error) || '응답 없음').slice(0, 500); break; }
      if (res.usage) {
        const u = job.usage || (job.usage = { usd: 0, model: '', rounds: 0 });
        u.usd = Math.round(((+u.usd || 0) + (+res.usage.costUsd || 0)) * 1e6) / 1e6; u.model = res.usage.model || u.model; u.rounds = (u.rounds || 0) + 1;
        const up = res.usage.parts || null;
        if (up) { u.parts = u.parts || { in: 0, cw: 0, cr: 0, out: 0, etc: 0 }; ['in', 'cw', 'cr', 'out', 'etc'].forEach(function (k) { u.parts[k] += (+up[k] || 0); }); }
        u.tIn = (u.tIn || 0) + (+res.usage.inputTokens || 0); u.tCw = (u.tCw || 0) + (+res.usage.cacheWriteTokens || 0);
        u.tCr = (u.tCr || 0) + (+res.usage.cacheReadTokens || 0); u.tOut = (u.tOut || 0) + (+res.usage.outputTokens || 0);
      }
      job.actions = (job.actions || []).concat(res.clientActions || []);
      if (res.done === false) {
        job.toolN = (job.toolN || 0) + (Array.isArray(res.assistantContent) ? res.assistantContent.filter(function (b) { return b && b.type === 'tool_use'; }).length : 0);
        job.messages = job.messages.concat([{ role: 'assistant', content: res.assistantContent }, { role: 'user', content: res.toolResults }]);
        job.round++;
        job.lease.until = Math.max(job.lease.until, Date.now() + 60000);
        nxJob_save_(job); // 단계마다 저장 — 어디서 끊겨도 이 단계까지는 남는다
        continue;
      }
      job.round++;
      job.reply = res.reply || '이번 요청에 답변을 받지 못했습니다. 다시 한 번 보내주세요.';
      job.status = 'done';
    }
  } catch (e) {
    job.status = 'error'; job.error = '서버 처리 중 오류: ' + String(e && e.message || e).slice(0, 300);
  } finally {
    job.lease = null;
    if (job.status !== 'run') { job.endedMs = Date.now(); nxJob_logPaid_(job); }
    try { nxJob_save_(job); } catch (e2) { console.error('넥스 일감 저장 실패: ' + e2.message); }
  }
  return nxJob_snap_(job);
}

// 유료 질문 기록 — 끝났든 멈췄든 쓴 만큼 한 번(예전엔 화면이 답을 받아야만 적어 실패한 차례가 안 보였다)
//  이어서 하기로 다시 돌면 그 뒤에 더 쓴 만큼만 한 줄 더(같은 돈을 두 번 적지 않음). 잠금 밖에서 부른다(기록 함수가 따로 잠금)
function nxJob_logPaid_(job) {
  const usd = +(job.usage && job.usage.usd) || 0, delta = Math.round((usd - (+job.paidUsd || 0)) * 1e6) / 1e6;
  if (delta <= 0) return;
  job.paidUsd = usd;
  try { ai_logPaid_({ entry: { kind: job.kind || 'chat', model: (job.usage && job.usage.model) || '', usd: delta, q: (job.status === 'done' ? '' : '[멈춤] ') + job.q } }); } catch (e) {}
}

function nxJob_poll_(id) {
  id = nxJob_cleanId_(id);
  try { const t = CacheService.getScriptCache().get('nxjob_st_' + id); if (t) return JSON.parse(t); } catch (e) {}
  const job = nxJob_load_(id);
  return job ? nxJob_snap_(job) : { missing: true, id: id, status: '' };
}
function nxJob_stop_(id) {
  id = nxJob_cleanId_(id);
  try { CacheService.getScriptCache().put('nxjob_stop_' + id, '1', 21600); } catch (e) {}
  let stoppedNow = null;
  const r = withLock_(10000, function () {
    const job = nxJob_load_(id);
    if (!job) return { missing: true };
    if (job.status === 'run' && !(job.lease && job.lease.until > Date.now())) { job.status = 'stopped'; job.error = '세무사님이 멈추셨습니다'; job.endedMs = Date.now(); nxJob_save_(job); stoppedNow = job; }
    return nxJob_snap_(job);
  });
  if (stoppedNow) { nxJob_logPaid_(stoppedNow); try { nxJob_save_(stoppedNow); } catch (e) {} } // 도는 실행이 있으면 그 실행이 다음 단계 앞에서 멈추고 적는다
  return r;
}
// 이어서 하기 — 멈춘(오류·중단) 일감을 그 단계부터 다시. 이미 끝난 단계는 다시 돌지 않는다
function nxJob_resume_(id) {
  id = nxJob_cleanId_(id);
  try { CacheService.getScriptCache().remove('nxjob_stop_' + id); } catch (e) {}
  const r = withLock_(10000, function () {
    const job = nxJob_load_(id);
    if (!job) return { missing: true };
    if (job.status === 'error' || job.status === 'stopped') { job.status = 'run'; job.error = ''; job.endedMs = 0; job.acked = false; job.appended = false; nxJob_save_(job); }
    return { ok: true };
  });
  if (r && (r.missing || r.error)) return r;
  nxJob_openSet_(id, true);
  return nxJob_run_(id, 'screen', NXJOB_CHUNK_MS_);
}
// 화면이 답을 받아 갔음 — 서버가 대화에 따로 넣지 않는다(이미 넣었으면 appended로 알려 화면이 중복으로 넣지 않게)
function nxJob_ack_(id) {
  id = nxJob_cleanId_(id);
  const r = withLock_(10000, function () {
    const job = nxJob_load_(id);
    if (!job) return { missing: true };
    job.acked = true; nxJob_save_(job);
    return { ok: true, appended: !!job.appended };
  });
  nxJob_openSet_(id, false);
  return r;
}
// 이 대화에서 아직 도는(또는 끝났는데 대화에 안 들어간) 일감 — 화면이 대화를 열 때 이어 보기
function nxJob_listForConv_(convId) {
  convId = String(convId || '');
  if (!convId) return { jobs: [] };
  const out = [];
  nxJob_openList_().forEach(function (id) {
    const j = nxJob_load_(id);
    if (j && j.convId === convId && !j.acked && !j.appended) out.push(nxJob_snap_(j, { q: j.q }));
  });
  return { jobs: out };
}

// 화면이 받아 가지 않은 결과를 대화에 넣기(질문이 대화에 없으면 질문도) — 저장은 뒤 일 저장(bg)으로, 화면 쪽 저장은 합쳐짐(ai_convSave)
function nxJob_appendToConv_(job) {
  if (!job.convId) { job.appended = true; return; }
  const ld = ai_convLoad({ id: job.convId });
  const conv = ld && ld.conversation;
  if (!conv) { job.appended = true; return; }
  const msgs = (conv.messages || []).slice();
  const tail = msgs.slice(-12);
  if (job.q && !tail.some(function (m) { return m && m.role === 'user' && m.content === job.q; })) msgs.push({ role: 'user', content: job.q, nxJob: job.id });
  let text;
  if (job.status === 'done') {
    text = job.reply || '';
    const screenOnly = (job.actions || []).filter(function (a) { return a && /^(edit_document|diagram_mermaid|navigate_to|open_view|confirm_action|preview_reload)$/.test(a.type); });
    if (screenOnly.length) text += '\n\n(화면에서 할 일 ' + screenOnly.length + '건은 그 화면이 닫혀 있어 넣지 못했습니다 — 필요하면 다시 시켜 주세요.)';
  } else {
    text = '⚠ 넥스가 일하다 멈췄습니다: ' + (job.error || job.status) + ' — 지금까지 ' + (job.round || 0) + '단계·도구 ' + (job.toolN || 0) + '번. 질문과 한 일은 서버에 남아 있습니다(일감 ' + job.id + ').';
  }
  msgs.push({ role: 'assistant', content: text, nxJob: job.id, nxJobState: job.status, stat: job.status === 'done' ? nxReplyStat_(text) : undefined }); // [2026.11.28 채팅 기조] 답 성적
  const saved = ai_convSave({ bg: true, conversation: Object.assign({}, conv, { messages: msgs, baseUpdatedAt: '' }) });
  if (saved && saved.error) throw new Error(saved.error);
  job.appended = true;
}

// 1분 틱 — 주인 없는 일감을 이어 돌리고, 끝났는데 화면이 안 받아 간 결과를 대화에 넣는다
function nxJob_tick_(budgetMs) {
  const t0 = Date.now(), ids = nxJob_openList_();
  if (!ids.length) return { n: 0 };
  let ran = 0;
  ids.forEach(function (id) {
    if (Date.now() - t0 > budgetMs) return;
    let job = nxJob_load_(id);
    if (!job) { nxJob_openSet_(id, false); return; }
    if (job.createdMs && Date.now() - job.createdMs > 2 * 86400000) { nxJob_openSet_(id, false); return; } // 이틀 지난 것은 목록에서만 뺌(파일은 남김)
    if (job.status === 'run') {
      if (job.lease && job.lease.until > Date.now()) return; // 다른 실행(화면 묶음)이 돌리는 중
      try { nxJob_run_(id, 'tick', Math.max(30000, budgetMs - (Date.now() - t0) - 60000)); ran++; } catch (e) { console.error('넥스 일감 이어 돌리기 실패: ' + e.message); }
      job = nxJob_load_(id);
      if (!job || job.status === 'run') return;
    }
    if (job.acked) { nxJob_openSet_(id, false); return; }
    if (!job.appended && job.endedMs && Date.now() - job.endedMs > NXJOB_APPEND_AFTER_MS_) {
      try {
        nxJob_appendToConv_(job); // 대화 저장이 안에서 잠근다(잠금을 겹쳐 쥐지 않음)
        withLock_(10000, function () { const j2 = nxJob_load_(id); if (j2) { j2.appended = true; nxJob_save_(j2); } });
        nxJob_openSet_(id, false);
      } catch (e) { console.error('넥스 일감 대화 넣기 실패: ' + e.message); }
    }
  });
  return { n: ids.length, ran: ran };
}
