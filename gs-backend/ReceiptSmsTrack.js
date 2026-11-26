// [2026-11-26] 영수증 사진 문자 도착 확인 — 세무사님 "보낸 이후에 정상발송 내역을 확인할 수 있나?" → "도착 결과를 확인할 수 있게 하자"
//  계획서 docs/_기록/현금영수증_도착확인_계획서_20261126.html(세무사님 "권장대로 하자" — ㉠ 1분마다 묻기 ㉡ 영수증 사진 문자만 ㉢ 대시보드 알림+아침 묶음).
//
//  차례: 보낼 때 솔라피 답의 메시지 번호를 「따라가는 목록」(스크립트 속성 한 칸)에 넣고 영수증 파일에 「확인 중」 표시
//   → 1분 틱(cpPrereadTick)이 목록에 「확인 중」이 있을 때만 솔라피 「메시지 목록 조회」(GET messages/v4/list?messageId=)로 결과를 묻는다
//   → 결과 코드 4000 = 도착 / 처리 완료인데 4000이 아님 = 실패(까닭) / 하루가 지나도 확정 안 됨 = 결과 모름
//   → 파일 표시를 바꾸고 상담 기록 한 줄, 실패면 대시보드 「답하실 것」+아침 알림 묶음(awNoticeAdd_). 수금은 건드리지 않는다.
//  시험 보내기는 목록에만 두고 파일·기록·알림을 남기지 않는다(보낸 창에만 결과).
//  결과 코드: solapi.com/developers/api/msgstatus(2026-11-25 확인) — 2000 접수 · 3000 이통사 접수 · 4000 수신 완료, 그 밖은 실패.

var RSMS_TRACK_PROP_ = 'netax_rsms_track';         // 따라가는 목록 [{id,mid,gid,at,fileId,name,clientId,caseId,test,state,code,reason,doneAt}]
var RSMS_RES_PROP_ = 'netax_receipt_sms_res';       // 영수증 파일 표시: wait | ok|MM-dd HH:mm | fail|코드 | unknown
var RSMS_TRACK_MAX_MS_ = 24 * 3600 * 1000;          // 하루 지나도 확정 안 되면 「결과 모름」
var RSMS_TICK_LAST_PROP_ = 'netax_rsms_tick_last';    // 1분 틱이 마지막으로 결과를 물은 때(이음매 점검이 봄)
var RSMS_TRACK_KEEP_MS_ = 24 * 3600 * 1000;         // 확정된 줄은 하루 뒤 목록에서 지움(파일 표시는 남음)

var RSMS_CODE_LABEL_ = {
  '4000': '도착', '3043': '휴대폰 전원 꺼짐', '3042': '신호 없는 곳(음영지역)', '3061': '받는 사람이 수신 거부',
  '3054': '스팸으로 막힘', '3055': '스팸으로 막힘', '2254': '스팸 의심으로 막힘', '3032': '가입하지 않은 번호',
  '3010': '번호 형식 오류', '3041': '통화 중', '3040': '보내는 시간 초과', '1062': '보내는 번호 미등록', '2062': '보내는 번호 미등록',
  '3108': '보낼 수 있는 시간이 아님'
};
function receiptSms_codeLabel_(code, reason) {
  code = String(code || '');
  if (RSMS_CODE_LABEL_[code]) return RSMS_CODE_LABEL_[code];
  const r = String(reason || '').replace(/\s+/g, ' ').trim();
  return r ? r.slice(0, 40) : ('실패(코드 ' + (code || '없음') + ')');
}

// 솔라피 보내기 답에서 메시지 번호·묶음 번호 — 한 통 보내기(messages/v4/send) 답은 맨 위에 messageId·groupId,
//  여러 통 보내기 답은 groupInfo·messageList에 들어 있어 두 모양을 다 본다.
function receiptSms_parseIds_(txt) {
  let j = {}; try { j = JSON.parse(txt) || {}; } catch (e) { j = {}; }
  const g = j.groupInfo || {};
  let mid = j.messageId || '';
  if (!mid && j.messageList) {
    const ml = j.messageList;
    if (Array.isArray(ml)) mid = (ml[0] || {}).messageId || '';
    else { const k = Object.keys(ml)[0]; mid = k ? ((ml[k] || {}).messageId || k) : ''; }
  }
  return { mid: String(mid || ''), gid: String(j.groupId || g.groupId || g._id || '') };
}

function receiptSms_trackRead_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(RSMS_TRACK_PROP_) || '[]') || []; } catch (e) { return []; } }
function receiptSms_trackWrite_(list) {
  const p = PropertiesService.getScriptProperties();
  if (!list.length) p.deleteProperty(RSMS_TRACK_PROP_); else p.setProperty(RSMS_TRACK_PROP_, JSON.stringify(list.slice(-80)));
}

// 보낸 직후 — 따라가는 목록에 한 줄. 돌려주는 값: 줄 번호(화면이 결과를 물을 때 씀)
function receiptSms_trackAdd_(ids, info) {
  const t = {
    id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), mid: ids.mid || '', gid: ids.gid || '', at: Date.now(),
    fileId: info.fileId || '', name: String(info.name || '').slice(0, 60), clientId: info.clientId || '', caseId: info.caseId || '',
    test: !!info.test, state: 'wait', code: '', reason: '', doneAt: 0
  };
  if (!t.mid && !t.gid) { t.state = 'unknown'; t.reason = '솔라피 답에 메시지 번호가 없어 도착을 확인할 수 없음'; t.doneAt = Date.now(); }
  withLockStrict_(5000, function () { const list = receiptSms_trackRead_(); list.push(t); receiptSms_trackWrite_(list); });
  if (!t.test && t.fileId) receiptSms_markFile_(t.fileId, t.state === 'unknown' ? 'unknown' : 'wait');
  return t;
}

function receiptSms_markFile_(fileId, val) {
  try { const props = {}; props[RSMS_RES_PROP_] = val; Drive.Files.update({ appProperties: props }, fileId); } catch (e) { console.error('영수증 문자: 도착 표시 실패 ' + e.message); }
}

// 솔라피에 한 줄 묻기 → 메시지 한 통(없으면 null). 통신 실패면 예외.
function receiptSms_query_(t) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('SOLAPI_API_KEY'), apiSecret = props.getProperty('SOLAPI_API_SECRET');
  if (!apiKey || !apiSecret) throw new Error('솔라피 열쇠가 없습니다.');
  const url = 'https://api.solapi.com/messages/v4/list?' + (t.mid ? 'messageId=' + encodeURIComponent(t.mid) : 'groupId=' + encodeURIComponent(t.gid)) + '&limit=5';
  const res = UrlFetchApp.fetch(url, { method: 'get', headers: { Authorization: receiptSms_auth_(apiKey, apiSecret) }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error('결과 조회 실패(' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200));
  let j = {}; try { j = JSON.parse(res.getContentText()) || {}; } catch (e) { j = {}; }
  const ml = j.messageList || {};
  const arr = Array.isArray(ml) ? ml : Object.keys(ml).map(function (k) { const m = ml[k] || {}; if (!m.messageId) m.messageId = k; return m; });
  if (!arr.length) return null;
  if (t.mid) { const hit = arr.filter(function (m) { return m && m.messageId === t.mid; })[0]; if (hit) return hit; }
  return arr[0];
}

// 메시지 한 통 → 확정이면 {state,code,reason,when}, 아직이면 null
function receiptSms_judge_(m) {
  if (!m) return null;
  const code = String(m.statusCode || ''), st = String(m.status || '').toUpperCase();
  const when = function () { const d = new Date(m.dateReceived || m.dateReported || m.dateUpdated || Date.now()); return Utilities.formatDate(isNaN(d.getTime()) ? new Date() : d, 'Asia/Seoul', 'MM-dd HH:mm'); };
  if (code === '4000') return { state: 'ok', code: code, reason: '', when: when() };
  if (st === 'COMPLETE' || (code && !/^(2000|3000)$/.test(code) && st !== 'PENDING' && st !== 'SENDING')) return { state: 'fail', code: code, reason: String(m.reason || m.statusMessage || ''), when: when() };
  return null;
}

// 확정 — 목록 줄을 바꾸고(이미 확정이면 아무것도 안 함), 처음 확정한 쪽만 파일 표시·상담 기록·실패 알림
function receiptSms_finish_(id, r) {
  const t = withLockStrict_(5000, function () {
    const list = receiptSms_trackRead_();
    const x = list.filter(function (y) { return y.id === id; })[0];
    if (!x || x.state !== 'wait') return null;
    x.state = r.state; x.code = r.code || ''; x.reason = String(r.reason || '').slice(0, 80); x.doneAt = Date.now(); x.when = r.when || '';
    receiptSms_trackWrite_(list);
    return JSON.parse(JSON.stringify(x));
  });
  if (!t || t.test) return t;
  const label = r.state === 'ok' ? '도착' : r.state === 'unknown' ? '결과 모름(하루 지나도 솔라피가 확정하지 않음)' : '도착 실패 — ' + receiptSms_codeLabel_(t.code, t.reason);
  if (t.fileId) receiptSms_markFile_(t.fileId, r.state === 'ok' ? 'ok|' + t.when : r.state === 'fail' ? 'fail|' + (t.code || '') : 'unknown');
  try { client_addConsultLog({ 고객ID: t.clientId || '', 고객명: (String(t.name).match(RSMS_NAME_RE_) || [])[1] || '', 사건ID: t.caseId || '', 유형: '문자 발송', 내용: '현금영수증 사진 문자 결과: ' + label + (t.when ? ' (' + t.when + ')' : '') + ' — ' + t.name }); } catch (e) { console.error('영수증 문자: 결과 상담 기록 실패 ' + e.message); }
  if (r.state !== 'ok') {
    const who = (String(t.name).match(RSMS_NAME_RE_) || [])[1] || t.name;
    try { awNoticeAdd_('문자 실패', '영수증 문자 ' + (r.state === 'fail' ? '도착 실패' : '결과 모름') + ': ' + who + ' — ' + (r.state === 'fail' ? receiptSms_codeLabel_(t.code, t.reason) : '하루 지나도 솔라피가 결과를 확정하지 않음') + ' · 📱 영수증 문자 창에서 다시 보낼 수 있습니다', t.caseId || '', 'rsms:' + (t.mid || t.id), true); } catch (e) { console.error('영수증 문자: 실패 알림 실패 ' + e.message); }
  }
  return t;
}

// 한 줄 확인 — 아직이면 그대로, 하루 넘으면 「결과 모름」
function receiptSms_checkOne_(t) {
  if (!t || t.state !== 'wait') return t;
  let r = null;
  try { r = receiptSms_judge_(receiptSms_query_(t)); } catch (e) { console.error('영수증 문자: ' + e.message); }
  if (!r && Date.now() - t.at > RSMS_TRACK_MAX_MS_) r = { state: 'unknown', code: '', reason: '' };
  return r ? (receiptSms_finish_(t.id, r) || t) : t;
}

// 1분 틱 — 「확인 중」이 없으면 속성 한 번 읽고 끝(솔라피를 부르지 않는다)
function receiptSms_trackTick_(budgetMs) {
  const list = receiptSms_trackRead_();
  if (!list.length) return { checked: 0 };
  const started = Date.now();
  let checked = 0, done = 0;
  try { PropertiesService.getScriptProperties().setProperty(RSMS_TICK_LAST_PROP_, String(started)); } catch (e) {}
  list.forEach(function (t) {
    if (t.state !== 'wait' || Date.now() - started > (budgetMs || 20000)) return;
    if (Date.now() - t.at < 10000) return; // 보낸 지 10초 안은 다음 틱에
    checked++;
    const u = receiptSms_checkOne_(t);
    if (u && u.state !== 'wait') done++;
  });
  // 확정된 지 하루 지난 줄 지우기
  try {
    withLockStrict_(5000, function () {
      const now = Date.now(), cur = receiptSms_trackRead_();
      const keep = cur.filter(function (t) { return t.state === 'wait' || now - (t.doneAt || 0) < RSMS_TRACK_KEEP_MS_; });
      if (keep.length !== cur.length) receiptSms_trackWrite_(keep);
    });
  } catch (e) {}
  return { checked: checked, done: done };
}

// 화면 — 보낸 창이 결과를 묻는다(줄 번호들). 보낸 지 15초 지난 「확인 중」은 그 자리에서 한 번 물어 본다(5줄까지).
function receiptSms_status_(body) {
  const ids = (body.ids || []).map(String).slice(0, 20);
  let asked = 0;
  const out = {};
  receiptSms_trackRead_().forEach(function (t) {
    if (ids.indexOf(t.id) === -1) return;
    if (t.state === 'wait' && Date.now() - t.at > 15000 && asked < 5) { asked++; t = receiptSms_checkOne_(t); }
    out[t.id] = receiptSms_view_(t);
  });
  return { success: true, items: out };
}
function receiptSms_view_(t) {
  if (t.state === 'ok') return { state: 'ok', label: '도착' + (t.when ? ' ' + t.when : '') };
  if (t.state === 'fail') return { state: 'fail', label: '도착 실패 — ' + receiptSms_codeLabel_(t.code, t.reason) + (t.when ? ' (' + t.when + ')' : '') };
  if (t.state === 'unknown') return { state: 'unknown', label: '결과 모름' + (t.reason ? ' — ' + t.reason : '') };
  return { state: 'wait', label: '도착 확인 중' };
}
// 목록 — 파일 표시 한 칸을 화면 글로
function receiptSms_resView_(v) {
  v = String(v || '');
  if (!v) return null;
  const p = v.split('|');
  if (p[0] === 'ok') return { state: 'ok', label: '도착' + (p[1] ? ' ' + p[1] : '') };
  if (p[0] === 'fail') return { state: 'fail', label: '도착 실패 — ' + receiptSms_codeLabel_(p[1], '') };
  if (p[0] === 'unknown') return { state: 'unknown', label: '결과 모름' };
  return { state: 'wait', label: '도착 확인 중' };
}
