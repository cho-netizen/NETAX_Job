// ============================================================
// [2026.10.17] job 부가서비스 서버 — 메모·보고서 모음·서식(템플릿)·폴더 보기의 조회만 받는 작은 GAS 프로젝트
// ------------------------------------------------------------
// 세무사님 그림(관리 / 처리 / 부가서비스 3분할)의 세 번째. 관리 서버(gs-light)와 같은 방식이다.
// - 비밀값(블로그 연결·AI 키·관리자 코드)이 필요하거나 job 서버와 같은 자료에 저장하는 일은 전부 job 서버 그대로.
//   블로그 연결(네이버·구글)은 구글·네이버에 job 서버 주소로 등록돼 있어 옮길 수 없다.
// - 화면(gs-backend/manage/gasbridge.html)이 이 조회들을 먼저 여기로 보내고, 실패하면 job 서버로 다시 보낸다.
// - 조회 함수 본체는 Generated.js(tools/build-light.js gs-extra가 gs-backend/*.js에서 자동 복사) — 여기서 고치지 말 것.
//
// 폴더 위치 설정(기본 폴더·업무관리자·총괄관리자 폴더 ID — 비밀값 아님)은 job 서버에서 받아 이 프로젝트 스크립트 속성에
// 넣는다(manageApp_extraConfig). 받기 전에는 아무 조회도 하지 않는다 — 값이 없으면 기본 폴더 대신 드라이브 맨 위를 보거나
// 거기에 새 폴더를 만들 수 있기 때문.
// ============================================================
var EXTRA_MAIN_URL_ = 'https://script.google.com/macros/s/AKfycbyFbvXiV6rSzCvhtc_T2WrzNF5ZxhOFWtSSsgzSavzPbjv4LBGhjXhu_Q2_8m-PDj8s/exec';
var EXTRA_ACTIONS_ = {
  listFolder: function (body) { return handleListFolder(body); },
  getNetaxRootPath: function (body) { return handleGetNetaxRootPath(body); },
  listCaseTemplates: function (body) { return handleListCaseTemplates(body); },
  getCaseTemplateContent: function (body) { return handleGetCaseTemplateContent(body); },
  listGeneralMemos: function (body) { return handleListGeneralMemos(body); },
  // 다시 만들기(forceRebuild)는 보고서 목록 파일을 고쳐 쓰므로 job 서버에서만(화면도 그 경우엔 여기로 안 보냄)
  list_all_reports: function (body) { if (body.forceRebuild) throw new Error('다시 만들기는 job 서버에서'); return handleListAllReports(body); },
  get_latest_template_review: function (body) { return handleGetLatestTemplateReview(body); }
};
// 파일 읽는 순서(Extra.js가 Generated.js보다 먼저일 수 있음) 때문에 상수는 함수 안에서 부를 때 읽는다
function extra_propKeys_() { return [DEFAULT_FOLDER_ID_PROPERTY, BUSINESS_MANAGER_FOLDER_ID_PROPERTY, NETAX_ROOT_FOLDER_ID_PROPERTY, CHIEF_MANAGER_FOLDER_ID_PROPERTY]; }

function doGet(e) {
  // 편집기에서 이 파일을 열고 doGet을 한 번 실행하면(e 없음) 구글 권한 승인 창이 뜬다 — 처음 설치할 때 한 번만.
  if (!e) { DriveApp.getRootFolder().getName(); SpreadsheetApp.openById(WORK_SHEET_ID).getName(); UrlFetchApp.fetch(EXTRA_MAIN_URL_ + '?ping=1', { muteHttpExceptions: true }); return; }
  return jsonResponse({ status: 'ok', server: 'job-extra' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return jsonResponse({ error: '요청 형식 오류' }); }
  const items = Array.isArray(body.__manageBatch) ? body.__manageBatch.slice(0, 30) : null;
  if (!items) return jsonResponse({ error: '허용되지 않은 요청입니다.' });
  return jsonResponse({ __results: items.map(extra_dispatch_) });
}

// 화면이 보내는 모양: { fn: 'manageApp_call', args: [action, payload, sessionToken] } — job 서버 manageApp_call과 같은 답을 낸다.
function extra_dispatch_(req) {
  if (!req || req.fn !== 'manageApp_call' || !Array.isArray(req.args)) return { error: '허용되지 않은 요청입니다.' };
  const action = req.args[0], payload = req.args[1], token = req.args[2];
  const run = EXTRA_ACTIONS_[action];
  if (!run) return { error: '부가서비스 서버가 받지 않는 요청입니다: ' + action };
  // 토큰·폴더 설정을 확인하지 못하면 오류로만 답한다 — 화면이 같은 요청을 job 서버로 다시 보내므로 로그인 만료 판단은 job 서버가 한다.
  if (!extra_ready_(token)) return { error: 'EXTRA_NOT_READY' };
  const body = Object.assign({}, payload || {}, { action: action });
  try {
    return { __result: JSON.parse(JSON.stringify(run(body))) };
  } catch (err) {
    return { error: '부가서비스 서버 처리 중 오류: ' + (err && err.message ? err.message : err) };
  }
}

function extra_ready_(token) {
  if (!token || typeof token !== 'string' || token.length > 200) return false;
  const expiresAt = Number(token.split('.')[0]);
  if (!expiresAt || Date.now() > expiresAt) return false;
  const cache = CacheService.getScriptCache();
  const key = 'xtok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  const props = PropertiesService.getScriptProperties();
  if (cache.get(key) === '1' && props.getProperty('__extra_synced_at')) return true;
  let data = null;
  try {
    const res = UrlFetchApp.fetch(EXTRA_MAIN_URL_, {
      method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
      payload: JSON.stringify({ __manage: { fn: 'manageApp_extraConfig', args: [token] } })
    });
    data = JSON.parse(res.getContentText());
  } catch (err) { data = null; }
  const r = data && data.__result;
  if (!r || r.ok !== true || !r.props) return false;
  // 기본 폴더 설정이 비어 오면(설정 전) 아무것도 하지 않는다
  if (!r.props[DEFAULT_FOLDER_ID_PROPERTY]) return false;
  const next = {};
  extra_propKeys_().forEach(function (k) { next[k] = String(r.props[k] || ''); });
  next.__extra_synced_at = String(Date.now());
  props.setProperties(next, false);
  const sec = Math.floor(Math.min(21600, (expiresAt - Date.now()) / 1000));
  if (sec > 60) cache.put(key, '1', sec);
  return true;
}
