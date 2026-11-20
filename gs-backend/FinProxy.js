// ============================================================
// [2026.11.20] 넥스 → 금융거래 합치기 서버(gs-fin) — 넥스 도구 bank_merge가 부르는 job 서버 쪽 길
// ------------------------------------------------------------
// 세무사님 11-20 「권장대로 하자」(docs/_기록/금융거래_10년검토_계획서_20261120.html — 1단계 한 파일로 합치기, ㉦ 작은 서버 따로).
// 합치기 본체는 job 서버에 두지 않는다(크기 지킴이). 세무사님 화면(manage/finmerge.html)은 그 서버를 바로 부르고,
// 넥스는 여기서 job 서버 로그인 표를 새로 받아 같은 서버·같은 함수를 부른다(넥스 전용 길 없음 — 공통원칙 1절).
// 구글 바깥 호출은 한 번 60초 한도라 45초씩 나눠 부르고, 이 도구 한 번에 약 2분 30초까지 이어 부른다(다 못 하면 more — 다시 부르면 이어 감).
// ============================================================
var FIN_SERVER_URL_ = ''; // 금융거래 서버 배포 주소(gs-fin/README.md) — 첫 배포 뒤 적는다

function finProxyCall_(action, payload) {
  if (!FIN_SERVER_URL_) return { error: '금융거래 서버가 아직 올라가지 않았습니다(배포 주소 없음) — 화면 💰 금융거래 합치기도 같은 서버를 씁니다.' };
  var token = manageApp_issueSessionToken_();
  if (!token) return { error: '로그인 표를 만들지 못했습니다.' };
  var res = UrlFetchApp.fetch(FIN_SERVER_URL_, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
    payload: JSON.stringify({ __manageBatch: [{ fn: 'manageApp_call', args: [action, payload || {}, token] }] }) });
  var data = null; try { data = JSON.parse(res.getContentText()); } catch (e) { return { error: '금융거래 서버 응답을 읽지 못함(HTTP ' + res.getResponseCode() + ')' }; }
  var r = data && Array.isArray(data.__results) ? data.__results[0] : null;
  if (!r) return { error: (data && data.error) || '금융거래 서버 응답 이상' };
  return r.error ? { error: r.error } : r.__result;
}

// 넥스 도구 bank_merge — do=list | run
function finProxyNex_(caseId, input) {
  var d = String(input && input.do || 'run');
  if (d === 'list') {
    var L = finProxyCall_('fin_merge_list', { caseId: caseId });
    if (!L || L.error) return L;
    var on = L.파일.filter(function (f) { return f.on; });
    return { ok: true, 암호있음: L.암호있음, 지난결과: L.지난결과, 기본체크: on.map(function (f) { return { id: f.id, path: f.path }; }),
      꺼둔것: L.파일.filter(function (f) { return !f.on && f.why; }).slice(0, 40).map(function (f) { return f.path + ' — ' + f.why; }),
      안내: '기본 체크는 이름에 금융 낱말이 있는 엑셀·PDF·사진·압축. 빠진 원시파일이 있으면 do=run fileIds로 직접 건넨다. CSV·사건 맨 위 합본은 읽지 않는다.' };
  }
  if (d !== 'run') return { error: 'do는 list·run 중 하나' };
  var t0 = Date.now(), last = null;
  while (Date.now() - t0 < 150000) {
    last = finProxyCall_('fin_merge_run', { caseId: caseId, fileIds: Array.isArray(input.fileIds) ? input.fileIds.slice(0, 400) : undefined, budgetMs: 40000, writeNow: Date.now() - t0 > 100000 });
    if (!last || last.error || last.done) break;
  }
  if (!last || last.error) return last || { error: '금융거래 서버 응답 없음' };
  if (!last.done) return { ok: true, more: true, 읽음: last.읽음, 전체: last.전체, 안내: '아직 다 못 읽음 — bank_merge do=run을 한 번 더 부르면 이어 감(읽은 파일은 기억됨)' };
  return { ok: true, 시트: last.시트, 거래줄: last.거래줄, 겹친줄: last.겹친줄, 계좌: last.계좌, 확인수: last.확인수, 확인: (last.확인 || []).slice(0, 30), 새서식: last.새서식,
    파일: (last.파일 || []).filter(function (f) { return f.status !== 'ok'; }).slice(0, 30) };
}
