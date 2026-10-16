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
  list_bookings: function (body) { return JSON.parse(booking_getBookings().getContent()); }
};

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
    return { error: '관리 서버 처리 중 오류: ' + (err && err.message ? err.message : err) };
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
