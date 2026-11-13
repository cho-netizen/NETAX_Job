// ============================================================
// [2026.10.17] job 관리 서버 — 가벼운 조회만 받는 작은 GAS 프로젝트
// ------------------------------------------------------------
// 왜: job 서버(gs-backend)는 코드가 3MB라 빈 호출도 3~5초, 사건처리·AI 같은 무거운 일과 한 줄에 서서 10~30초씩
// 튀었다(2026-10-17 측정). 관리 메뉴(대시보드·작업관리·고객관리·수금관리·예약관리)와 사이드바가 화면을 열 때마다
// 기다리는 조회 4가지만 여기서 한다. 저장·수정은 전부 job 서버 그대로다(잠금이 프로젝트마다 따로라 둘이 같은
// 시트에 쓰면 꼬일 수 있음). 조회는 시트를 그때그때 새로 읽으므로 job 서버에서 저장한 내용이 바로 보인다.
//
// 화면(gs-backend/manage/gasbridge.html)이 이 조회들을 먼저 여기로 보내고, 여기서 실패하면 job 서버로 다시 보낸다.
// 조회 함수 본체는 Generated.js(tools/build-light.js가 gs-backend/*.js에서 자동으로 복사)에 있다 — 여기서 고치지 말 것.
//
// 로그인: 화면이 실어 보내는 세션 토큰을 job 서버에 한 번 물어 확인하고(manageApp_checkToken), 맞으면 토큰이 끝날
// 때까지(최대 6시간) 기억한다. 그래서 이 프로젝트에는 비밀값(API_SECRET 등)을 따로 넣을 필요가 없다.
// ============================================================
var LIGHT_MAIN_URL_ = 'https://script.google.com/macros/s/AKfycbyFbvXiV6rSzCvhtc_T2WrzNF5ZxhOFWtSSsgzSavzPbjv4LBGhjXhu_Q2_8m-PDj8s/exec';
var LIGHT_ACTIONS_ = {
  work_get_cases: function (body) { return work_getCases(body); },
  client_get_clients: function (body) { return client_getClients(body); },
  client_get_consult_logs: function (body) { return client_getConsultLogs(body); },
  list_bookings: function (body) { return JSON.parse(booking_getBookings().getContent()); },
  // [2026-11-13 job 서버 나누기] 세무사님 "권장대로"(docs/_기록/job서버_나누기_계획서_20261113.html) — job 서버를 여는 데만 7.5~8.4초라,
  //  자주 부르는 읽기 셋을 여기서도 답한다. 쓰기는 하지 않는다(readonly-overrides.txt) — 쓸 일이 생기면 「job 서버로 넘김」.
  todo_list: function (body) { return todoList_(); },
  case_proc: function (body) { return light_caseProcLedgerRead_(body); }
};
var LIGHT_FALLBACK_ACTIONS_ = { todo_list: 1, case_proc: 1 };
// job 서버 caseProc0_ → ledgerApi_와 같은 순서(사건 줄 찾기 → 처리 세목 바꾸기 → 장부 보기/띠)로 같은 답을 낸다. 다른 단계는 받지 않는다.
function light_caseProcLedgerRead_(body) {
  const t0 = Date.now();
  if (!body || (body.step !== 'ledger' && body.step !== 'ledgerFlow')) throw new Error('NX_LIGHT_WRITE 장부 보기·띠만 받음');
  const caseId = String(body.caseId || '').trim();
  if (!caseId) return { error: '사건이 필요합니다.' };
  CP_SHEET_MEMO_ON_ = true; WORK_DATA_MEMO_ = null;
  const sheet = work_getSheet_();
  const col = work_colMap_(work_values_(sheet)[0]);
  const found = work_findCaseRow_(sheet, col, caseId);
  if (!found) return { error: '사건을 찾지 못했습니다.' };
  const c = work_readRow_(col, found.row);
  try { const rt = caseProcRouteTax_(c); if (rt) { c._세목작업관리 = c.세목; c.세목 = rt; } } catch (e) {}
  const r = body.step === 'ledgerFlow' ? ledgerFlowBrief_(c) : ledgerView_(c);
  if (r && typeof r === 'object' && !Array.isArray(r)) r._ms = Date.now() - t0;
  return r;
}
// job 서버의 스크립트 속성은 이 프로젝트에서 보이지 않는다 — job 서버가 바꿀 때마다 적어 두는 거울 파일(_속성거울.json, Code.js nxPropsMirrorWrite_)을 읽는다.
// 거울에 없는 이름은 빈 값. 쓰기는 하지 않는다. 거울 파일을 못 찾으면 「job 서버로 넘김」(job 서버가 그때 거울을 새로 적음).
var LIGHT_PROPS_MEMO_ = null;
function lightProps_() {
  if (!LIGHT_PROPS_MEMO_) {
    const cache = CacheService.getScriptCache();
    let id = cache.get('nx_props_mirror_id');
    let f = null;
    if (id) { try { f = DriveApp.getFileById(id); } catch (e) { f = null; } }
    if (!f) { const it = DriveApp.getFilesByName('_속성거울.json'); if (!it.hasNext()) throw new Error('NX_LIGHT_WRITE 거울 파일 없음'); f = it.next(); cache.put('nx_props_mirror_id', f.getId(), 21600); }
    let o = {}; try { o = JSON.parse(f.getBlob().getDataAsString()) || {}; } catch (e) { throw new Error('NX_LIGHT_WRITE 거울 파일 읽기 실패'); }
    LIGHT_PROPS_MEMO_ = o.props || {};
  }
  const P = LIGHT_PROPS_MEMO_;
  return {
    getProperty: function (k) { return Object.prototype.hasOwnProperty.call(P, k) ? P[k] : null; },
    getProperties: function () { return Object.assign({}, P); },
    getKeys: function () { return Object.keys(P); },
    setProperty: function () { nxLightWrite_('속성 쓰기'); },
    setProperties: function () { nxLightWrite_('속성 쓰기'); },
    deleteProperty: function () { nxLightWrite_('속성 지우기'); }
  };
}

function doGet(e) {
  // 편집기에서 doGet을 한 번 실행하면(e 없음) 구글 권한 승인 창이 뜬다 — 처음 설치할 때 한 번만.
  if (!e) { SpreadsheetApp.openById(WORK_SHEET_ID).getName(); UrlFetchApp.fetch(LIGHT_MAIN_URL_ + '?ping=1', { muteHttpExceptions: true }); return; }
  return jsonResponse({ status: 'ok', server: 'job-light' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return jsonResponse({ error: '요청 형식 오류' }); }
  const items = Array.isArray(body.__manageBatch) ? body.__manageBatch.slice(0, 30) : null;
  if (!items) return jsonResponse({ error: '허용되지 않은 요청입니다.' });
  return jsonResponse({ __results: items.map(light_dispatch_) });
}

// 화면이 보내는 모양: { fn: 'manageApp_call', args: [action, payload, sessionToken] } — job 서버 manageApp_call과 같은 답을 낸다.
function light_dispatch_(req) {
  if (!req || req.fn !== 'manageApp_call' || !Array.isArray(req.args)) return { error: '허용되지 않은 요청입니다.' };
  const action = req.args[0], payload = req.args[1], token = req.args[2];
  const run = LIGHT_ACTIONS_[action];
  if (!run) return { error: '관리 서버가 받지 않는 요청입니다: ' + action };
  // 토큰을 확인하지 못하면(틀렸든 job 서버에 못 물어봤든) 오류로 답한다 — 화면은 오류를 받으면 같은 요청을 job 서버로
  // 다시 보내므로, 로그인 만료 여부는 언제나 job 서버가 판단한다(여기서 잘못 "만료"라고 해 로그아웃되는 일이 없게).
  if (!light_tokenOk_(token)) return { error: 'LIGHT_TOKEN_UNCHECKED' };
  const body = Object.assign({}, payload || {}, { action: action });
  try {
    // job 서버는 결과를 JSON 글자로 바꿨다가 다시 읽어 돌려준다(날짜가 글자가 됨) — 똑같이 맞춘다.
    return { __result: JSON.parse(JSON.stringify(run(body))) };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    // [2026-11-13] 읽기만 하는 이 서버가 쓸 일을 만났거나(옛 기록 옮기기 등) 드라이브 읽기 전용 권한에 막힘 — 고장이 아니라 「job 서버로 넘김」.
    //  화면(gasbridge)은 __fallback으로 시작하는 오류를 실패로 세지 않고(두 번 실패 시 끄기에 안 셈) 같은 요청을 job 서버로 보낸다.
    //  11-13에 더한 읽기(오늘 할 일·장부)는 어떤 오류든 넘김 — 여기서 못 쓰는 고급 서비스(서류 읽기 등)를 드물게 건드려도 job 서버가 답한다.
    if (LIGHT_FALLBACK_ACTIONS_[action] || /NX_LIGHT_WRITE|읽기 전용|permission|권한|Access denied|insufficient/i.test(msg)) return { error: '__fallback ' + msg.slice(0, 200) };
    return { error: '관리 서버 처리 중 오류: ' + msg };
  }
}

function light_tokenOk_(token) {
  if (!token || typeof token !== 'string' || token.length > 200) return false;
  const expiresAt = Number(token.split('.')[0]);
  if (!expiresAt || Date.now() > expiresAt) return false;
  const cache = CacheService.getScriptCache();
  const key = 'ltok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  if (cache.get(key) === '1') return true;
  let ok = false;
  try {
    const res = UrlFetchApp.fetch(LIGHT_MAIN_URL_, {
      method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
      payload: JSON.stringify({ __manage: { fn: 'manageApp_checkToken', args: [token] } })
    });
    const data = JSON.parse(res.getContentText());
    ok = !!(data && data.__result && data.__result.ok === true);
  } catch (err) { ok = false; }
  if (ok) {
    const sec = Math.floor(Math.min(21600, (expiresAt - Date.now()) / 1000));
    if (sec > 60) cache.put(key, '1', sec);
  }
  return ok;
}
