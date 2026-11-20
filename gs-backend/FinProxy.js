// ============================================================
// [2026.11.20] 금융거래 합치기 서버(gs-fin) 잇기 — 1단계는 GAS가 저절로, 넥스·화면은 결과를 읽는다
// ------------------------------------------------------------
// 세무사님 11-20 「권장대로 하자」(docs/_기록/금융거래_10년검토_계획서_20261120.html — 1단계 한 파일로 합치기, ㉦ 작은 서버 따로).
// 세무사님 11-20 "1단계 금융거래내역을 분석할 수 있는 준비상태로 만드는 것은 그냥 자동으로 gas가 하는 것이지 따로 명령하는 것이 아니다" → "맞다 고쳐라"
//  · 자동: 1분 미리 읽기 틱(cpWatchTick_)이 진행 중 상속 사건 폴더 변동을 알아채면 줄을 세우고, 30분마다 진행 중 상속 사건 전부도 줄을 세운다
//    (서식표·사건 암호가 바뀐 것도 거기서 잡힘). 틱마다 한 사건만 금융거래 서버 fin_merge_auto로(한 번 25초, 다 못 하면 다음 틱에 이어서).
//    바뀐 것이 없으면 금융거래 서버가 바로 「그대로」로 답한다. 시트를 새로 썼으면 사건 기록부에 한 줄.
//  · 넥스 도구 bank_merge: 합치라는 명령이 아니라 자동으로 합친 결과(시트·계좌·확인할 것·파일마다 다룬 것)를 읽는다.
// 합치기 본체는 job 서버에 두지 않는다(크기 지킴이). 구글 바깥 호출은 한 번 60초 한도.
// ============================================================
var FIN_SERVER_URL_ = 'https://script.google.com/macros/s/AKfycbwut0DS0v2KwV7VZZkeZ_Xz73VfHELrlxbolYY0Q2QIsU57RmZokDcGQ8SMxJxp7psIoQ/exec'; // 금융거래 서버 배포 주소(gs-fin/README.md)
var FIN_AUTO_Q_ = 'fin_auto_queue', FIN_AUTO_SWEEP_ = 'fin_auto_sweep_at', FIN_AUTO_SWEEP_MS_ = 30 * 60000;

function finProxyCall_(action, payload) {
  if (!FIN_SERVER_URL_) return { error: '금융거래 서버가 아직 올라가지 않았습니다(배포 주소 없음).' };
  var token = manageApp_issueSessionToken_();
  if (!token) return { error: '로그인 표를 만들지 못했습니다.' };
  var res = UrlFetchApp.fetch(FIN_SERVER_URL_, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
    payload: JSON.stringify({ __manageBatch: [{ fn: 'manageApp_call', args: [action, payload || {}, token] }] }) });
  var data = null; try { data = JSON.parse(res.getContentText()); } catch (e) { return { error: '금융거래 서버 응답을 읽지 못함(HTTP ' + res.getResponseCode() + ')' }; }
  var r = data && Array.isArray(data.__results) ? data.__results[0] : null;
  if (!r) return { error: (data && data.error) || '금융거래 서버 응답 이상' };
  return r.error ? { error: r.error } : r.__result;
}

// ---------- 자동 ----------
function finAutoIsCase_(c) {
  return !!c && String(c.상태 || '') === '진행' && !!String(c.폴더ID || '').trim()
    && (String(c.세목 || '') === 'inheritance' || /_상속_/.test(String(c.사건명 || '')));
}
function finAutoQueue_(add) {
  var P = PropertiesService.getScriptProperties(), q = [];
  try { q = JSON.parse(P.getProperty(FIN_AUTO_Q_) || '[]'); } catch (e) { q = []; }
  if (add) { add.forEach(function (id) { id = String(id || ''); if (id && q.indexOf(id) === -1) q.push(id); }); P.setProperty(FIN_AUTO_Q_, JSON.stringify(q.slice(0, 200))); }
  return q;
}
// 사건 폴더 감시가 변동을 알아챈 사건(cpWatchTick_) — 진행 중 상속 사건이면 줄에
function finAutoNote_(c) { if (finAutoIsCase_(c)) finAutoQueue_([c.id]); }
// 1분 틱 안에서 — 30분마다 진행 중 상속 사건 전부를 줄에 세우고, 한 사건만 금융거래 서버로. 줄 한 줄(기록용) 또는 ''
function finAutoRun_(started, DEADLINE) {
  if (!FIN_SERVER_URL_) return '';
  var P = PropertiesService.getScriptProperties();
  if (Date.now() - Number(P.getProperty(FIN_AUTO_SWEEP_) || 0) > FIN_AUTO_SWEEP_MS_) {
    var cases = []; try { cases = (work_getCases({}) || {}).cases || []; } catch (e) { cases = []; }
    finAutoQueue_(cases.filter(finAutoIsCase_).map(function (c) { return c.id; }));
    P.setProperty(FIN_AUTO_SWEEP_, String(Date.now()));
  }
  if (Date.now() - started > DEADLINE - 70000) return ''; // 한 번 부르기(최대 약 60초)가 들어갈 시간이 없으면 다음 틱
  var q = finAutoQueue_(); if (!q.length) return '';
  var id = q[0], r = null;
  try { r = finProxyCall_('fin_merge_auto', { caseId: id, budgetMs: 25000 }); } catch (e) { r = { error: String(e && e.message || e).slice(0, 120) }; }
  var q2 = finAutoQueue_().filter(function (x) { return x !== id; });
  if (r && r.more) q2.push(id); // 다 못 읽음 — 줄 끝에 다시(다른 사건도 차례가 오게)
  P.setProperty(FIN_AUTO_Q_, JSON.stringify(q2));
  if (!r || r.error) return '금융거래 합치기 ' + id + ' 실패: ' + String(r && r.error || '응답 없음').slice(0, 80);
  if (r.nochange || r.empty) return '';
  if (r.more) return '금융거래 합치기 ' + id + ' 읽는 중 ' + r.읽음 + '/' + r.전체;
  var line = '자동으로 합침 — ' + (r.시트 && r.시트.name || '시트') + ' · 계좌 ' + r.계좌수 + ' · 거래 ' + r.거래줄 + '줄' + (r.확인수 ? ' · 확인할 것 ' + r.확인수 : '');
  try { caseProcPatch_(id, function (sv) { caseProcLogTo_(sv, { by: 'GAS', what: '금융거래 합치기', detail: line + (r.시트 && r.시트.url ? ' ' + r.시트.url : '') }); }); } catch (e) {}
  return '금융거래 ' + id + ': ' + line;
}

// ---------- 넥스 도구 bank_merge — 자동으로 합친 결과 읽기(명령 없음) ----------
function finProxyNex_(caseId, input) {
  var L = finProxyCall_('fin_merge_list', { caseId: caseId });
  if (!L || L.error) return L || { error: '금융거래 서버 응답 없음' };
  var last = L.지난결과;
  var used = L.파일.filter(function (f) { return f.다룸 === '합침'; }).map(function (f) { return f.path; });
  var off = L.파일.filter(function (f) { return f.다룸 !== '합침' && !/^읽지 않음|^이 도구가 만든/.test(f.다룸); }).slice(0, 40).map(function (f) { return f.path + ' — ' + f.다룸; });
  if (!last) return { ok: true, 결과없음: true, 안내: L.최신 ? '이 사건 폴더에는 은행 거래내역 원시파일이 없습니다.' : '금융거래 합치기가 아직 돌지 않았습니다 — 1분 틱이 곧 저절로 합칩니다(명령 없음).', 파일: off };
  return { ok: true, 시트: { name: last.name, url: last.url }, 합친때: last.at, 최신: L.최신, 거래줄: last.rows, 겹친줄: last.겹친줄, 계좌: last.계좌, 확인수: last.확인수,
    확인: (last.확인 || []).slice(0, 30), 새서식: last.새서식, 합친파일: used.slice(0, 60), 안넣은파일: off,
    안내: (L.최신 ? '' : '폴더·서식표·암호가 바뀌어 곧 저절로 다시 합칩니다. ') + '거래를 볼 때는 시트(file_read)를 읽는다. 처음 보는 서식·암호는 세무사님이 💰 창에서 정한다.' };
}
