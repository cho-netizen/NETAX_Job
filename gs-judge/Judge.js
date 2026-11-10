// ============================================================
// [2026.11.10] 판정 서버 — 판정 묶음 계산만 받는 작은 GAS 프로젝트
// ------------------------------------------------------------
// 왜: job 서버(gs-backend)가 구글 크기 한도(약 10MB)에 닿았다(모의사건 판정 묶음이 9일 만에 1.7MB). 세무사님 11-10
// "가안으로 하자"(총괄관리자\_기록\판정서버_분리_계획서_20261110.html) — 판정 계산만 여기로 옮긴다.
//
// 하는 일: job 서버가 보내는 { fn 또는 key, p(사실) } 로 판정 함수를 돌려 결과만 돌려준다. 시트·드라이브·장부에
// 쓰지도 읽지도 않는다(권한도 없음). 장부 적기·가족 지도 읽기는 job 서버의 judgeMoreRun_ 이 그대로 한다.
// 판정 함수 본체는 Generated.js(tools/build-light.js가 gs-backend/JudgeMore.js 등에서 자동 복사), 엔진은
// manage/taxcalc-engine.html 사본, 이음매 점검 줄은 Seams.js(tools/build-judge.js가 Federation.js에서 골라 복사) —
// 여기서 고치지 말고 gs-backend 원본을 고친 뒤 node tools/build-judge.js 를 다시 돌린다.
// ============================================================
function doGet(e) {
  if (!e) return; // 편집기에서 한 번 실행해 권한 승인(이 프로젝트는 바깥 권한이 없어 보통 창이 뜨지 않음)
  return jsonResponse({ status: 'ok', server: 'job-judge', 묶음수: Object.keys(JUDGE_MORE_).length });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return jsonResponse({ error: '요청 형식 오류' }); }
  if (body && body.seams === true) return jsonResponse({ r: judgeSeamsRun_() });
  if (body && body.ver === true) return jsonResponse({ r: typeof JUDGE_BUILD_ === 'string' ? JUDGE_BUILD_ : '' }); // 판 확인(job 서버 이음매 점검)
  return jsonResponse(judgeServe_(body));
}

// { fn: 'judgeXxx_', p } — 이름 있는 판정 함수 / { key: '계약해제', p } — 이름 없는(감싼) 묶음
function judgeServe_(body) {
  if (!body || typeof body !== 'object') return { error: '요청 형식 오류' };
  var fn = null;
  if (body.fn) {
    var named = Object.keys(JUDGE_MORE_).map(function (k) { return JUDGE_MORE_[k]; }).filter(function (f) { return f && f.name === body.fn; })[0];
    if (!named) return { error: '판정 서버가 받지 않는 함수: ' + body.fn };
    fn = named;
  } else if (body.key) {
    fn = JUDGE_MORE_[body.key];
    if (!fn) return { error: '판정 서버에 없는 묶음: ' + body.key };
  } else return { error: '판정 이름이 없음' };
  try { return { r: JSON.parse(JSON.stringify(fn(body.p || {}))) }; }
  catch (err) { return { error: String(err && err.message || err) }; }
}

// 판정만 쓰는 이음매 점검 줄(배포 직후 점검) — job 서버가 한 번 불러 줄마다 결과를 나눠 적는다
function judgeSeamsRun_() {
  return JUDGE_SEAMS_.map(function (s) {
    var msg = '';
    try { msg = s.fn(); if (msg === true) msg = ''; else if (msg === false) msg = '판정 결과가 기대와 다름'; else msg = msg || ''; }
    catch (e) { msg = '오류: ' + String(e && e.message || e).slice(0, 120); }
    return { 길: s.길, msg: String(msg) };
  });
}
