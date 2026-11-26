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
  // 남은 시간에 한 번 부르기(최대 약 60초)가 들어가면 부른다 — 한 틱에 세 번까지(처음 합칠 때 사건마다 파일이 수십 개라 한 번씩이면 한 시간 걸림)
  var lines = [];
  for (var n = 0; n < 3 && Date.now() - started < DEADLINE - 70000; n++) {
    var q = finAutoQueue_(); if (!q.length) break;
    var id = q[0], r = null;
    try { r = finProxyCall_('fin_merge_auto', { caseId: id, budgetMs: 25000 }); } catch (e) { r = { error: String(e && e.message || e).slice(0, 120), more: /timeout|시간|Timeout/i.test(String(e && e.message || e)) }; }
    var q2 = finAutoQueue_().filter(function (x) { return x !== id; });
    if (r && r.more) q2.push(id); // 다 못 읽음 — 줄 끝에 다시(다른 사건도 차례가 오게)
    P.setProperty(FIN_AUTO_Q_, JSON.stringify(q2));
    if (!r || r.error) { lines.push('금융거래 합치기 ' + id + ' 실패: ' + String(r && r.error || '응답 없음').slice(0, 80)); continue; }
    if (r.검토 && r.검토.요약) finAskSave_(id, r.검토.요약, r.시트); // [2026.11.27] 개요 「지금 할 일」에 금융거래 정하실 것 수
    var rvl = finReviewLine_(r.검토); // [2026.11.24] 2단계(사전증여·추정상속 선제 검토)가 바뀌었으면 사건 기록부에 한 줄 — 밤 내부검토서 갱신이 이 줄·시트 변동을 보고 검토서를 고친다
    if (rvl) { if (!(r.검토 && r.검토.error)) try { caseProcPatch_(id, function (sv) { caseProcLogTo_(sv, { by: 'GAS', what: '금융거래 2단계 검토', detail: rvl }); }); } catch (e) {} lines.push('금융거래 ' + id + ': ' + rvl); } // 실패는 틱 줄에만(사건 기록부에 매분 쌓이지 않게)
    if (r.nochange || r.empty) continue;
    if (r.more) { lines.push('금융거래 합치기 ' + id + ' 읽는 중 ' + r.읽음 + '/' + r.전체); continue; }
    var line = '자동으로 합침 — ' + (r.시트 && r.시트.name || '시트') + ' · 계좌 ' + r.계좌수 + ' · 거래 ' + r.거래줄 + '줄' + (r.확인수 ? ' · 확인할 것 ' + r.확인수 : '');
    try { caseProcPatch_(id, function (sv) { caseProcLogTo_(sv, { by: 'GAS', what: '금융거래 합치기', detail: line + (r.시트 && r.시트.url ? ' ' + r.시트.url : '') }); }); } catch (e) {}
    lines.push('금융거래 ' + id + ': ' + line);
  }
  return lines.join(' / ');
}

// [2026.11.27] 금융거래 「정하실 것」 수를 사건마다 적어 둠 — 사건 개요 「지금 할 일」에서 금융거래 창을 열지 않아도 보이게
//  (세무사님 11-27 「어디에 어떻게 노란필드가 있고, 우선순위는 어떻게 되는지에 대한 설명도 없고 … 이것을 대체 어떻게 사용하라는 것인가?」 — 사건을 열면 할 일이 먼저 보여야 함)
function finAskSave_(id, sum, sheet) {
  try {
    var L = (sum && sum.여쭐것목록) || [], o = { n: L.length, nex: 0, gas: 0, 빈칸: 0, at: new Date().toISOString() };
    L.forEach(function (q) { if (q.누가 === 'nex') o.nex++; else if (q.누가 === 'gas') o.gas++; else o.빈칸++; });
    if (sheet && sheet.url) o.url = sheet.url;
    PropertiesService.getScriptProperties().setProperty('fin_ask_' + id, JSON.stringify(o));
  } catch (e) {}
}
function finAskSummaryFor_(id) { try { var v = PropertiesService.getScriptProperties().getProperty('fin_ask_' + id); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

// 2단계 결과(금융거래 서버 finRvRun_) → 기록 한 줄. 바뀐 것이 없거나 실패면 ''(실패는 줄로 남김)
function finReviewLine_(rv) {
  if (!rv) return '';
  if (rv.error) return String(rv.error).slice(0, 160);
  if (!rv.changed || !rv.요약) return '';
  var v = rv.요약, z = v.짚을곳 || {}, won = function (n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR'); };
  return '2단계 검토 바뀜 — 짚을 곳 ' + (z.F || z.E ? 'F' + (z.F || 0) + '·E' + (z.E || 0) + '·' : '') + 'A' + (z.A || 0) + '·B' + (z.B || 0) + '·C' + (z.C || 0) + '·D' + (z.D || 0) + '(남은 ' + (z.남은것 || 0) + ')'
    + (v.상속개시일 ? ' · ' + (v.추정상속 || []).map(function (s) { return '추정상속 ' + s.기간 + ' 순인출 ' + won(s.순인출) + (s.기준넘음 ? '(기준 넘음, 추정액 ' + won(s.추정액) + ')' : ''); }).join(' · ') : ' · 상속개시일 없음');
}

// ---------- [2026.11.25] 넥스 도구 bank_note — 넥스가 쓰는 길(세무사님이 넥스를 부르실 때만 — 밤·자동 넥스 도구 목록 NR_READ_TOOLS_에 없음) ----------
//  세무사님 11-25 "내가 부를 때만 읽게 하라" · 계획서 총괄관리자_기록금융거래_답안먼저_계획서_20261125.html D절
function finProxyNexNote_(caseId, input) {
  input = input || {};
  var arr = function (v, n) { return Array.isArray(v) ? v.slice(0, n) : []; }; // 도구 입력 칸 이름은 영문(Claude 도구 규격) → 금융거래 서버는 우리말 칸
  var body = { caseId: caseId, 성격: arr(input.natures, 500).map(function (x) { return { 글자: x && x.text, 성격: x && x.nature }; }), 대상자: arr(input.people, 200).map(function (x) { return { 이름: x && x.name, 갈래: x && x.lane, 관계: x && x.relation, 근거: x && x.basis }; }), 의견: arr(input.notes, 500).map(function (x) { return { 열쇠: x && x.key, 의견: x && x.note }; }),
    답: arr(input.answers, 500).map(function (x) { return { 열쇠: x && x.key, 값: x && x.value, 근거: x && x.basis }; }) }; // [2026.11.26] 여쭐 것 차례대로(열쇠 = 검토.여쭐것목록[].열쇠)
  if (!body.성격.length && !body.대상자.length && !body.의견.length && !body.답.length) return { error: 'answers·natures·people·notes 중 하나는 있어야 한다' };
  return finProxyCall_('fin_nex_note', body);
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
    검토: L.검토 || null, // [2026.11.24] 2단계 요약 — 짚을 곳(A 자료 빈틈·B 추정상속·C 사전증여·D 큰돈) 수·큰 것부터·§15 1년/2년·§13 관련인별. 줄마다는 시트 탭 「짚을 곳」·「추정상속(§15)」·「사전증여(§13)」
    확인: (last.확인 || []).slice(0, 30), 새서식: last.새서식, 합친파일: used.slice(0, 60), 안넣은파일: off,
    안내: (L.최신 ? '' : '폴더·서식표·암호가 바뀌어 곧 저절로 다시 합칩니다. ') + '거래를 볼 때는 시트(file_read)를 읽는다. 처음 보는 서식·암호는 세무사님이 💰 창에서 정한다. 2단계(검토)는 GAS가 서류(사망진단서·가족관계증명서·등기부·차용증·의뢰 메모·지난 보고서)와 통장으로 낸 답안 — 증여·대여·소명·특수관계 판단은 세무사님 칸(✎)의 값만 사실로 쓰고, 비어 있으면 GAS 답안은 짐작으로만 쓴다. 넥스가 채울 때(세무사님이 부르신 때만 — 「금융거래 여쭐 것 채워라」·/금융답): 먼저 사건 폴더의 지난 보고서(보고서 폴더 전부)와 서류를 읽고, 검토.여쭐것목록을 차례대로 따라가 항목마다 답을 bank_note answers[{key: 열쇠, value, basis: 근거 서류·글}]로 적는다(모르면 비워 두고 세무사님께 묶어 여쭘). 시트 그 칸에 보라 「넥스 · 」로 보이고 잠정 — 세무사님이 「여쭐 것」 탭에서 확정하신다. 세무사님 값(검정)은 바꾸지 않는다.' };
}
