// ============================================================
// [2026.11.20] 금융거래 합치기 서버 — 은행 원시파일을 한 구글 시트로 합치는 작은 GAS 프로젝트
// ------------------------------------------------------------
// 세무사님 11-20 「권장대로 하자」(docs/_기록/금융거래_10년검토_계획서_20261120.html ㉦ "작은 서버 따로") — job 서버는 크기 지킴이
// (8.80MB) 때문에 큰 코드를 더하면 모든 호출이 느려진다. 판정 서버(gs-judge)·관리 서버(gs-light)와 같은 방식.
//
// 화면(manage/finmerge.html)이 로그인 표를 실어 여기를 바로 부른다(한 번에 4분 30초까지 읽고, 다 될 때까지 다시 부름).
// 넥스 도구 bank_merge는 job 서버(FinProxy.js)가 job 서버 로그인 표를 새로 받아 여기를 부른다(한 번 45초).
// 로그인 확인은 관리 서버와 같다 — 표가 맞는지 job 서버(manageApp_checkToken)에 한 번 묻고, 맞으면 표가 끝날 때까지 기억.
// 이 프로젝트에 비밀값은 없다. 사건 암호(암호 걸린 은행 엑셀·압축)만 이 서버 스크립트 속성에 둔다(FinRun.js finPwSet_).
//
// 파일: Fin.js(입구) · FinMerge.js(서식표·읽기) · FinRun.js(나눠 돌리기·합치기·시트) · FinCrypt.js(암호 풀기) — 손으로 고침
//       Generated.js — 자동 생성(node tools/build-light.js gs-fin): 엑셀 정리·글자 읽기·사건 찾기 함수를 gs-backend에서 복사
// ============================================================
var FIN_MAIN_URL_ = 'https://script.google.com/macros/s/AKfycbyFbvXiV6rSzCvhtc_T2WrzNF5ZxhOFWtSSsgzSavzPbjv4LBGhjXhu_Q2_8m-PDj8s/exec';
var FIN_VERSION_ = '2026-11-20a';
var FIN_ACTIONS_ = {
  fin_merge_list: function (b) { return finMergeList_(b); },
  // [2026.11.20] 합치기는 명령이 아니라 자동(세무사님 "따로 명령하는 것이 아니다") — job 서버 1분 틱이 부른다. 암호·서식표가 바뀌면 그 사건을 바로 다시 합친다
  fin_merge_auto: function (b) { return finMergeAuto_(b); },
  fin_pw_set: function (b) { var r = finPwSet_(b); if (r && r.ok && b.caseId) { try { r.합침 = finMergeAuto_({ caseId: b.caseId, budgetMs: 240000 }); } catch (e) { r.합침 = { error: String(e.message || e) }; } } return r; },
  fin_formats_get: function (b) { return finFormatsGet_(); },
  // [2026.11.25] 넥스가 쓰는 길 — 세무사님이 넥스를 부르실 때만(job 서버 넥스 도구 bank_note). 통장 글자 뜻·대상자 짐작·넥스 의견 → 다시 셈(FinDocs.js)
  fin_nex_note: function (b) { return finNexNote_(b); },
  // [2026.11.21] 서식 점검용 — 서버가 PDF·사진(압축 안 포함)에서 읽어 낸 글자를 그대로 돌려준다(읽기만, 고치지 않음). 개발자가 처음 보는 서식을 맞추는 데 쓴다
  fin_text: function (b) { return finTextOf_(b); },
  fin_formats_save: function (b) { var r = finFormatsSave_(b); if (r && !r.error && b.caseId) { try { r.합침 = finMergeAuto_({ caseId: b.caseId, budgetMs: 240000 }); } catch (e) { r.합침 = { error: String(e.message || e) }; } } return r; }
};

function doGet(e) {
  // 편집기에서 doGet을 한 번 실행하면(e 없음) 구글 권한 승인 창이 뜬다 — 처음 설치할 때 한 번만.
  // [2026.11.20] 구글 문서 권한 더함 — 글자인식 결과를 구글 문서로 열어 읽는 글자 읽기(tc_docText_)가 쓴다(압축 안 PDF·글자인식 기억이 없는 새 PDF)
  if (!e) { SpreadsheetApp.openById(WORK_SHEET_ID).getName(); DriveApp.getRootFolder().getName(); Drive.Files.list({ pageSize: 1 }); DocumentApp.getActiveDocument(); UrlFetchApp.fetch(FIN_MAIN_URL_ + '?ping=1', { muteHttpExceptions: true }); return; }
  return jsonResponse({ status: 'ok', server: 'job-fin', version: FIN_VERSION_ });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return jsonResponse({ error: '요청 형식 오류' }); }
  var items = Array.isArray(body.__manageBatch) ? body.__manageBatch.slice(0, 5) : null;
  if (!items) return jsonResponse({ error: '허용되지 않은 요청입니다.' });
  return jsonResponse({ __results: items.map(fin_dispatch_), server: 'job-fin', version: FIN_VERSION_ });
}

// 화면이 보내는 모양: { fn: 'manageApp_call', args: [action, payload, sessionToken] } — job 서버 manageApp_call과 같은 모양
function fin_dispatch_(req) {
  if (!req || req.fn !== 'manageApp_call' || !Array.isArray(req.args)) return { error: '허용되지 않은 요청입니다.' };
  var action = req.args[0], payload = req.args[1] || {}, token = req.args[2];
  var run = FIN_ACTIONS_[action];
  if (!run) return { error: '금융거래 서버가 받지 않는 요청입니다: ' + action };
  if (!fin_tokenOk_(token)) return { error: '로그인이 확인되지 않았습니다(다시 로그인해 주세요).' };
  try { fin_ensureProps_(); } catch (e) {}
  try { return { __result: JSON.parse(JSON.stringify(run(Object.assign({}, payload, { action: action })))) }; }
  catch (err) { return { error: '금융거래 서버 처리 중 오류: ' + String(err && err.message ? err.message : err).slice(0, 300) }; }
}

// 업무관리자 폴더 번호는 job 서버 스크립트 속성에 있다 — 이 서버에선 안 보이므로 job 서버가 적어 두는 거울 파일(_속성거울.json)에서
// 그 한 값만 처음 한 번 옮겨 둔다(서식표 파일·글자인식 기억 폴더를 찾는 데). 비밀값은 옮기지 않는다.
function fin_ensureProps_() {
  var P = PropertiesService.getScriptProperties(), k = 'BUSINESS_MANAGER_FOLDER_ID';
  if (P.getProperty(k)) return;
  var it = DriveApp.getFilesByName('_속성거울.json'); if (!it.hasNext()) return;
  var o = JSON.parse(it.next().getBlob().getDataAsString()) || {}, v = (o.props || {})[k];
  if (v) P.setProperty(k, String(v));
}

function fin_tokenOk_(token) {
  if (!token || typeof token !== 'string' || token.length > 200) return false;
  var expiresAt = Number(token.split('.')[0]);
  if (!expiresAt || Date.now() > expiresAt) return false;
  var cache = CacheService.getScriptCache();
  var key = 'ftok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  if (cache.get(key) === '1') return true;
  var ok = false;
  try {
    var res = UrlFetchApp.fetch(FIN_MAIN_URL_, {
      method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
      payload: JSON.stringify({ __manage: { fn: 'manageApp_checkToken', args: [token] } })
    });
    var data = JSON.parse(res.getContentText());
    ok = !!(data && data.__result && data.__result.ok === true);
  } catch (err) { ok = false; }
  if (ok) { var sec = Math.floor(Math.min(21600, (expiresAt - Date.now()) / 1000)); if (sec > 60) cache.put(key, '1', sec); }
  return ok;
}
