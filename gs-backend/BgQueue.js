// =========================================================
// [2026.11.03] 뒤에서 할 일 대기열 — 세무사님 "권장안대로 하자"(저장 기다림 전수조사, 총괄관리자\_기록\저장기다림_사용자편의_전수조사_20261103.html 5절)
//  저장 하나가 달력 지우고 다시 만들기·문자 보내기·보고서 다시 만들기까지 다 끝낸 뒤에야 답을 돌려줘, 화면이 몇 초~몇 분 멈췄다.
//  이제 저장은 시트(원장)에만 쓰고 바로 답하고, 기다릴 필요 없는 뒷일은 여기 적어 두면 1분 안에 일꾼이 처리한다.
//   · 적기: bgEnqueue_(종류, 값, 같은 일 묶음 열쇠) — 스크립트 속성 한 칸에 한 일(잠금 없이, 몇 ms)
//   · 일꾼: 1분 뒤 한 번 도는 트리거(bgqRunSoon) + 서류 미리 읽기 1분 틱(cpPrereadTick 맨 앞)에서도 처리 — 트리거를 못 걸어도 1분 안
//   · 실패: 1분·2분 뒤 다시, 세 번 실패하면 실패 목록 → 대시보드 「답하실 것」에 [다시 하기]·[지우기](commStatus_ bgFailed)
//  사람이 결과를 보고 판단해야 하는 일(세액계산 확정·신고서·달력 빈 시간 확인 등)은 여기 넣지 않는다 — 그런 일은 지금처럼 답을 기다린다.
// =========================================================
var BGQ_PREFIX_ = 'BGQ_', BGQ_FAILED_PROP_ = 'BGQ_FAILED_LIST', BGQ_MAX_TRIES_ = 3;

// 종류별 일 — 값(a)만 받아 처리한다. 실패면 예외를 던진다(다시 시도). 다시 해도 소용없는 실패는 { permanent: '이유' }를 돌려준다.
var BGQ_HANDLERS_ = {
  // 문자 한 통 — booking_sendSMS가 실패를 { success:false }로 돌려주므로 예외로 바꾼다(설정 없음은 다시 해도 같으니 바로 실패 목록)
  sms: function (a) {
    const r = booking_sendSMS(a.to, a.msg);
    if (r && r.success === false) {
      if (/설정|연락처가 없/.test(String(r.message || ''))) return { permanent: '문자 발송 설정이 없거나 연락처가 없습니다' };
      throw new Error(r.message || '문자 발송 실패');
    }
  },
  // 예약 상담 일정 지우기(거절·취소·사건 잇기) — 이미 없으면 끝
  cal_delete: function (a) {
    if (!a.eventId) return;
    const cal = CalendarApp.getCalendarById(BOOKING_CALENDAR_ID);
    let ev = null; try { ev = cal.getEventById(a.eventId); } catch (e) { ev = null; }
    if (ev) ev.deleteEvent();
  },
  // 예약 승인 — 신청 색(붉은 계통)이면 확정 색으로
  cal_confirm: function (a) {
    if (!a.eventId) return;
    const cal = CalendarApp.getCalendarById(BOOKING_CALENDAR_ID);
    const ev = cal.getEventById(a.eventId);
    if (ev && ev.getColor() === BOOKING_COLOR_PENDING) ev.setColor(BOOKING_COLOR_CONFIRMED);
  },
  // 사건 달력(법정기한·하위업무 마감·다음 할 일) — 처리하는 그때의 사건 줄을 다시 읽어 맞춘다(그 사이 또 고쳤어도 마지막 값으로 한 번)
  case_calendar: function (a) {
    const sheet = work_getSheet_();
    const data = sheet.getDataRange().getValues();
    const col = work_colMap_(data[0]);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][col.id]) !== String(a.caseId)) continue;
      if (!work_syncCaseCalendar_(work_readRow_(col, data[i]))) throw new Error('캘린더 동기화 실패');
      return;
    }
    work_deleteCaseCalendarEvents_(a.caseId); // 그 사이 사건이 지워졌으면 일정도 지운다
  },
  // 주간 개선 후보 보고서 다시 만들기(11-03 개선요구 저장 지연을 풀며 1분 트리거로 미루던 것을 이 장치로 옮김)
  improve_report: function () { buildImprovementReport_(); },
  // [2026.11.03 전수조사 다시] 사건 폴더·의뢰서 원문·고객창구 연결 — 작업관리 새 사건(폴더뒤로)·상담→자문/신고 저장에서 뒤로 미룬 드라이브 일.
  //  드라이브 일은 잠금 밖에서, 시트에는 짧은 잠금 안에서 폴더ID·my_report_id 두 칸만 쓴다(수정일은 건드리지 않음 — 화면이 들고 있는 기대수정일과 어긋나지 않게)
  case_folder: function (a) {
    const r = bgqCaseRow_(a.caseId);
    if (!r) return; // 그 사이 지운 사건
    if (String(r.row[r.col.업무유형] || '') === '상담') return; // 다시 상담으로 바꿨으면 폴더가 필요 없다
    let folderId = String(r.row[r.col.폴더ID] || '');
    if (!folderId) { folderId = work_getOrCreateCaseFolder_(r.row[r.col.사건명], r.row[r.col.업무유형]); if (!folderId) throw new Error('드라이브 폴더를 만들지 못함'); }
    if (a.seed) {
      try {
        const folder = DriveApp.getFolderById(folderId);
        let has = false; const it = folder.getFiles();
        while (it.hasNext()) { if (String(it.next().getName()).indexOf(CASE_TEMPLATE_NAME_PREFIX_) === 0) { has = true; break; } } // 다시 해도 두 장 생기지 않게
        if (!has) {
          const seMok = r.row[r.col.세목], upType = r.row[r.col.업무유형];
          const semokLabel = WORK_SEMOK_LABELS_[seMok] || seMok;
          const multi = /자문|상담/.test(upType) && work_intakeTaxCount_(r.row[r.col.개요]) >= 2;
          work_seedCaseTemplateIfAny_(folder, (multi ? ['복합자문'] : []).concat([semokLabel + upType, upType, semokLabel]).map(function (n) { return CASE_TEMPLATE_NAME_PREFIX_ + n; }), r.row[r.col.개요]);
        }
      } catch (e) { console.log('뒤에서 의뢰서 원문 넣기 실패(폴더는 계속): ' + e.message); }
    }
    if (a.req && a.req.fileName) { // 의뢰 메모에서 고친 의뢰서 글 — 같은 이름 파일이 이미 있으면 다시 넣지 않음
      const fd = DriveApp.getFolderById(folderId);
      if (!fd.getFilesByName(a.req.fileName).hasNext()) { const sv = handleSaveCaseFromTemplate(Object.assign({}, a.req, { folderId: folderId })); if (sv && sv.error) throw new Error('의뢰서 저장 실패: ' + sv.error); }
    }
    let reportId = String(r.row[r.col.my_report_id] || '');
    if (!reportId) {
      const my = my_handleAdminCreateCase({ admin_code: PropertiesService.getScriptProperties().getProperty('ADMIN_CODE'), name: r.row[r.col.고객명], case_name: r.row[r.col.사건명], checklist: [], permission: '허용', folder_id: folderId });
      if (my && my.success !== false && my.report_id) reportId = my.report_id;
    }
    // [2026.11.12 박영랑 사건] 잠금을 못 얻으면 예외 → 다시 시도(세 번 실패면 실패 목록). 예전 withLock_는 { error }만 돌려줘 폴더ID·접속코드가 조용히 빠졌다.
    withLockStrict_(8000, function () {
      const sheet = work_getSheet_();
      const col = work_colMap_(sheet.getDataRange().getValues()[0]);
      const found = work_findCaseRow_(sheet, col, a.caseId);
      if (!found) return;
      if (!found.row[col.폴더ID]) sheet.getRange(found.rowIndex, col.폴더ID + 1).setValue(folderId);
      if (reportId && !found.row[col.my_report_id]) sheet.getRange(found.rowIndex, col.my_report_id + 1).setValue(reportId);
      SpreadsheetApp.flush();
      try { work_valuesDirty_(); } catch (e) {}
    });
    if (!reportId) throw new Error('고객창구 연결 실패(폴더는 만듦)');
  },
  // 사건명·고객명이 바뀐 저장 — 폴더 이름·고객창구 사건명·보고서 목록을 그때의 사건 줄로 맞춘다(같은 값이면 쓰지 않음)
  case_names: function (a) {
    const r = bgqCaseRow_(a.caseId);
    if (!r) return;
    const name = String(r.row[r.col.사건명] || ''), cust = r.row[r.col.고객명];
    if (r.row[r.col.폴더ID]) { const fd = DriveApp.getFolderById(r.row[r.col.폴더ID]); if (fd.getName() !== name) fd.setName(name); }
    if (r.row[r.col.my_report_id]) my_setCaseNamesByReportId_(r.row[r.col.my_report_id], name, cust);
    const idx = rh_loadReportIndex_();
    if (idx) {
      let changed = false;
      idx.forEach(function (x) { if (x.caseId === a.caseId && (x.사건명 !== name || x.고객명 !== cust)) { x.사건명 = name; x.고객명 = cust; changed = true; } });
      if (changed) rh_saveReportIndex_(idx);
    }
  },
  // 업무유형이 신고로 바뀐 저장 — 신고제출·확보자료 폴더
  case_std_subfolders: function (a) {
    const r = bgqCaseRow_(a.caseId);
    if (!r || !r.row[r.col.폴더ID]) return;
    work_ensureCaseStdSubfolders_(DriveApp.getFolderById(r.row[r.col.폴더ID]), r.row[r.col.업무유형]);
  },
  // 지운 사건 — 달력 일정·보고서 목록 줄 걷기
  case_deleted: function (a) {
    if (bgqCaseRow_(a.caseId)) return; // 같은 번호가 다시 살아 있으면 건드리지 않는다
    work_deleteCaseCalendarEvents_(a.caseId);
    const idx = rh_loadReportIndex_();
    if (idx) { const kept = idx.filter(function (x) { return x.caseId !== a.caseId; }); if (kept.length !== idx.length) rh_saveReportIndex_(kept); }
  },
  // [2026.11.04 큰일 다섯 ⑩-2] 장부 「받을 서류」 ↔ 고객창구 점검표 맞추기
  portal_sync: function (a) { portalSyncCase_(a.caseId); },
  // [2026.11.04 화면정비 ⑦] 세무사님 "권장안대로 하자"(판단거리_정리_2차) — 보고서를 발행(고객창구가 보는 「보고서」 폴더에 외부보고서 .html로 올림 — 11-14 한 폴더로 합침)하면 고객에게 문자 한 통.
  //  고객창구가 없거나 전화번호가 없으면 조용히 끝(실패 목록에 안 남김). 같은 문서를 6시간 안에 다시 발행해도 한 번만.
  report_notice: function (a) {
    const c = job_findCase_(String(a.caseId || ''));
    if (!c || !c.my_report_id) return;
    const cache = CacheService.getScriptCache(), mark = 'rn_sent_' + String(a.fileId || '').slice(0, 60);
    try { if (a.fileId && cache.get(mark)) return; } catch (e) {}
    const 고객ID = String(c.고객ID || '').trim();
    if (!고객ID) return;
    let phone = '';
    const data = client_getSheets_().clients.getDataRange().getValues();
    const ccol = client_colMap_(data[0], CLIENT_HEADERS);
    for (let i = 1; i < data.length; i++) { if (String(data[i][ccol.id]).trim() === 고객ID) { phone = String(data[i][ccol.전화번호] || '').trim(); break; } }
    if (!phone) return;
    const r = booking_sendSMS(phone, '이음세무컨설팅입니다. 고객창구에 새 문서가 올라왔습니다.\nhttps://netax.kr/my/?report_id=' + c.my_report_id);
    if (r && r.success === false) {
      if (/설정|연락처가 없/.test(String(r.message || ''))) return { permanent: '문자 발송 설정이 없거나 연락처가 없습니다' };
      throw new Error(r.message || '문자 발송 실패');
    }
    try { if (a.fileId) cache.put(mark, '1', 21600); } catch (e) {}
  },
  // [2026.11.04 ⑩-4] 사건 만들기 — 장부 첫 칸(세목·업무유형·납세자·받을 서류). 같은 값은 다시 안 씀(ledgerFromCaseWrite_가 같은 값 건너뜀)
  case_ledger: function (a) {
    const c = job_findCase_(String(a.caseId || ''));
    if (!c) return; // 그 사이 지운 사건
    const by = a.by === '넥스' ? '넥스' : '세무사님';
    ledgerFromCaseWrite_(c, { 세목: c.세목 || '', 업무유형: c.업무유형 || '', 납세자: c.납세자 || '' }, by);
    // [2026-11-12 3차 ① 세무사님 "모두 권장안대로"] 의뢰 메모가 있으면 GAS가 가설로 읽고(값을 정하지 않음), 메모가 말한 거래·물건을 비어 있는 계산 칸에 「추정」으로 넣는다 — 정해진 칸은 안 건드리고, 서류가 오면 서류 값이 이기며 다르면 여쭘(ledgerEstimate_ 규칙 그대로). 메모만 적고도 시험 계산이 돌게
    if (String(c.개요 || '').trim()) {
      try { if (typeof caseProcGrasp_ === 'function') caseProcGrasp_(c); } catch (e) { console.error('의뢰 메모 가설 실패 ' + c.id + ': ' + (e && e.message || e)); }
      try { if (typeof ledgerEstimate_ === 'function') ledgerEstimate_(c, {}, 'GAS'); } catch (e) { console.error('의뢰 메모 추정 실패 ' + c.id + ': ' + (e && e.message || e)); }
      // [2026-11-13 4차 49] 사건 기준일이 비었는데 메모로 기준일(양도일·증여일·사망일)이 추정으로 섰으면 사건 기준일로도 — 비어 있으면 법정일이 「임시」로만 떠 상속세 신고기한 같은 큰 기한이 안 잡혔다.
      //  장부엔 「추정」으로 남아 있어 서류·세무사님 값이 오면 바뀌고, 사건 기준일은 세무사님이 고치신 값이 늘 먼저(비어 있을 때만 넣음)
      try {
        if (!String(c.기준일 || '').trim() && typeof ledgerLoad_ === 'function') {
          const r0 = (ledgerLoad_(c.id, true).rows || {})['기준일'];
          if (r0 && r0.state === '추정' && /^\d{4}-\d{2}-\d{2}$/.test(String(r0.v || ''))) { const wb = WORK_WRITE_BY_; WORK_WRITE_BY_ = 'GAS'; try { work_updateCase({ id: c.id, 기준일: String(r0.v) }); } finally { WORK_WRITE_BY_ = wb; } }
        }
      } catch (e) { console.error('메모 기준일을 사건에 넣지 못함 ' + c.id + ': ' + (e && e.message || e)); }
    }
  }
};

// [2026.11.04 큰일 다섯 ⑩-2] 세무사님 "권장안대로 하자"(큰일다섯_계획서_20261104.html ⑩-2)
//  화면(증빙확보)에서 직접 더한 서류만 고객창구(my.netax.kr) 점검표에 올라가고, 장부·넥스·틀이 정한 「받을 서류」는 고객이 몰랐다.
//  ① 장부 받을 서류 중 받는 곳이 고객인 것(도구·세무사님 몫은 빼고)을 점검표에 더한다
//  ② 이 장치가 더한 줄이 장부에서 빠졌고 고객이 아직 안 낸 것이면 점검표에서도 뺀다(화면에서 더한 줄·이미 낸 줄은 건드리지 않음)
//  ③ 고객이 낸 줄은 장부 그 서류에 「고객 받음」(파일 이름·시각)으로 적는다 — 확보(확정)는 세무사님이 서류를 보고 정한다
//  고객창구가 없는 사건(my_report_id 빈칸)은 아무것도 안 한다.
function portalSyncCase_(caseId) {
  const r = bgqCaseRow_(caseId);
  if (!r) return;
  const rid = String(r.row[r.col.my_report_id] || '').trim();
  if (!rid) return;
  const L0 = ledgerLoad_(caseId, true), want = {};
  Object.keys(L0.ev || {}).forEach(function (p) {
    const e = L0.ev[p], lb = String((e.v && e.v.label) || e.label || '').trim();
    if (e.state === '증빙받을것' && lb && ledgerEvWhere_(lb) === '고객') want[lb.slice(0, 120)] = p;
  });
  const before = ((L0.portal && L0.portal.added) || []).slice();
  let got = {}, added = [];
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(MY_SHEET_ID).getSheetByName(MY_SHEET_CASES);
    const data = sheet.getDataRange().getValues(), col = my_colMap_(data[0]);
    let ri = -1;
    for (let i = 1; i < data.length; i++) if (String(data[i][col.report_id]).trim() === rid) { ri = i; break; }
    if (ri < 0) return;
    let list = [], st = {};
    try { list = JSON.parse(data[ri][col.체크리스트] || '[]'); } catch (e) { list = []; }
    try { st = JSON.parse(data[ri][col.제출상태] || '{}'); } catch (e) { st = {}; }
    const sent = function (x) { return !!(st[x] && st[x].submitted); };
    const keep = list.filter(function (x) { return !(before.indexOf(x) >= 0 && !want[x] && !sent(x)); });
    added = before.filter(function (x) { return keep.indexOf(x) >= 0; });
    Object.keys(want).forEach(function (lb) { if (keep.indexOf(lb) < 0) { keep.push(lb); added.push(lb); } });
    if (JSON.stringify(keep) !== JSON.stringify(list)) { sheet.getRange(ri + 1, col.체크리스트 + 1).setValue(JSON.stringify(keep)); SpreadsheetApp.flush(); }
    keep.forEach(function (x) { if (sent(x)) got[x] = st[x]; });
  } finally { lock.releaseLock(); }
  // 장부에 적기 — 바뀐 것이 있을 때만
  const L1 = L0;
  const needMark = Object.keys(L1.ev || {}).some(function (p) { const e = L1.ev[p], lb = String((e.v && e.v.label) || e.label || '').trim().slice(0, 120); return got[lb] && !(e.고객 && e.고객.받음 && e.고객.파일 === String(got[lb].fileName || '')); });
  if (!needMark && JSON.stringify(added.slice().sort()) === JSON.stringify(before.slice().sort())) return;
  ledgerMutate_(caseId, function (L) {
    L.portal = { added: added, at: caseProcNow_() };
    Object.keys(L.ev || {}).forEach(function (p) {
      const e = L.ev[p], lb = String((e.v && e.v.label) || e.label || '').trim().slice(0, 120), g = got[lb];
      if (!g || (e.고객 && e.고객.받음 && e.고객.파일 === String(g.fileName || ''))) return;
      e.고객 = { 받음: true, 파일: String(g.fileName || '').slice(0, 120), 때: String(g.uploadedAt || '').slice(0, 19) };
      ledgerLogTo_(L, { by: '고객', what: '고객창구로 서류 받음', path: p, detail: lb.slice(0, 80) + ' — ' + e.고객.파일 + ' (확보는 세무사님이 서류를 보고 정함)' });
    });
  });
}
function bgqCaseRow_(caseId) {
  const sheet = work_getSheet_();
  const data = sheet.getDataRange().getValues();
  const col = work_colMap_(data[0]);
  for (let i = 1; i < data.length; i++) if (String(data[i][col.id]) === String(caseId)) return { col: col, row: data[i] };
  return null;
}
var BGQ_LABELS_ = { sms: '문자 보내기', cal_delete: '예약 일정 지우기', cal_confirm: '예약 일정 확정 색', case_calendar: '사건 달력 맞추기', improve_report: '개선 후보 보고서 다시 만들기', case_folder: '사건 폴더·고객창구 만들기', case_names: '사건 이름 맞추기(폴더·고객창구·보고서 목록)', case_std_subfolders: '신고제출 폴더 만들기', case_deleted: '지운 사건 달력·보고서 목록 정리', portal_sync: '고객창구 점검표 맞추기', case_ledger: '새 사건 장부 첫 칸', report_notice: '발행 문서 고객 알림 문자' };

// 적기 — key를 주면 같은 열쇠의 일은 하나만 남는다(같은 사건을 연달아 고쳐도 달력은 마지막 값으로 한 번). why는 실패 목록에 보일 짧은 설명.
function bgEnqueue_(kind, args, key, why) {
  try {
    if (!BGQ_HANDLERS_[kind]) throw new Error('모르는 뒷일 종류: ' + kind);
    const id = BGQ_PREFIX_ + (key ? String(key).replace(/[^\w가-힣-]/g, '_').slice(0, 80) : Date.now() + '_' + Math.floor(Math.random() * 1e6));
    PropertiesService.getScriptProperties().setProperty(id, JSON.stringify({ k: kind, a: args || {}, t: 0, at: Date.now(), next: 0, why: String(why || '').slice(0, 120) }));
    bgqKick_();
    return true;
  } catch (e) {
    // 적지도 못했으면 그 자리에서 바로 한다(예전 방식) — 뒷일이 소리 없이 빠지지 않게
    console.error('뒷일 적기 실패 → 바로 처리: ' + (e && e.message));
    try { const r = BGQ_HANDLERS_[kind] && BGQ_HANDLERS_[kind](args || {}); return !(r && r.permanent); } catch (e2) { console.error('뒷일 바로 처리도 실패(' + kind + '): ' + (e2 && e2.message)); return false; }
  }
}

// 1분 뒤 일꾼 깨우기 — 트리거 목록 읽기(수백 ms)를 저장마다 하지 않게 캐시 표시로 90초에 한 번만
function bgqKick_() {
  const cache = CacheService.getScriptCache();
  try { if (cache.get('bgq_kick')) return; cache.put('bgq_kick', '1', 90); } catch (e) {}
  try {
    const has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'bgqRunSoon'; });
    if (!has) ScriptApp.newTrigger('bgqRunSoon').timeBased().after(60 * 1000).create();
  } catch (e) { console.error('뒷일 일꾼 트리거 못 걸음(서류 미리 읽기 1분 틱이 대신 처리): ' + (e && e.message)); }
}

// 트리거가 부르는 이름(끝에 _ 없음)
function bgqRunSoon() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bgqRunSoon') { try { ScriptApp.deleteTrigger(t); } catch (e) {} } });
  try { CacheService.getScriptCache().remove('bgq_kick'); } catch (e) {}
  const left = bgqDrain_(240000);
  if (left > 0) bgqKick_(); // 시간이 모자랐거나 다시 할 일이 남음
}

// 처리 — 오래된 것부터, budgetMs 안에서. 남은 일 수를 돌려준다.
//  같은 일을 두 일꾼이 동시에 하지 않게, 꺼내는 순간(속성 지우기)만 짧은 잠금(사용자 잠금 — 저장 잠금과 따로)을 쥔다.
function bgqDrain_(budgetMs) {
  const started = Date.now(), props = PropertiesService.getScriptProperties();
  let left = 0;
  const all = props.getProperties();
  const ids = Object.keys(all).filter(function (k) { return k.indexOf(BGQ_PREFIX_) === 0 && k !== BGQ_FAILED_PROP_; })
    .map(function (k) { let j = null; try { j = JSON.parse(all[k]); } catch (e) {} return { id: k, j: j }; })
    .filter(function (x) { return x.j; })
    .sort(function (x, y) { return (x.j.at || 0) - (y.j.at || 0); });
  for (let i = 0; i < ids.length; i++) {
    if (Date.now() - started > budgetMs) { left += ids.length - i; break; }
    const it = ids[i];
    if (it.j.next && it.j.next > Date.now()) { left++; continue; }
    // 꺼내기 — 그 사이 다른 일꾼이 가져갔거나 같은 열쇠로 새로 적혔으면(값이 다름) 그 값으로
    let job = null;
    const ul = LockService.getUserLock();
    if (!ul.tryLock(3000)) { left++; continue; }
    try { const cur = props.getProperty(it.id); if (cur) { job = JSON.parse(cur); props.deleteProperty(it.id); } } catch (e) { job = null; } finally { ul.releaseLock(); }
    if (!job) continue;
    let res, err = '';
    try { res = BGQ_HANDLERS_[job.k] ? BGQ_HANDLERS_[job.k](job.a || {}) : { permanent: '모르는 종류' }; } catch (e) { err = String(e && e.message || e).slice(0, 200); }
    if (!err && /^cal_|case_calendar|case_deleted/.test(job.k)) { try { CacheService.getScriptCache().remove('dsc_ver_get_calendar_events'); } catch (e) {} } // 대시보드 달력 기억 지움
    if (!err && !(res && res.permanent)) continue; // 끝
    job.t = (job.t || 0) + 1;
    const why = res && res.permanent ? res.permanent : err;
    if (res && res.permanent || job.t >= BGQ_MAX_TRIES_) { bgqFail_(it.id, job, why); continue; }
    job.next = Date.now() + 60000 * job.t; job.err = why;
    // 다시 적기 — 그 사이 같은 열쇠로 새 일이 적혔으면 새 일이 이긴다(새 값으로 다시 하므로)
    try { if (!props.getProperty(it.id)) props.setProperty(it.id, JSON.stringify(job)); } catch (e) {}
    left++;
  }
  return left;
}

function bgqFail_(id, job, why) {
  try {
    const props = PropertiesService.getScriptProperties();
    let list = []; try { list = JSON.parse(props.getProperty(BGQ_FAILED_PROP_) || '[]'); } catch (e) { list = []; }
    list.push({ id: id + '_' + Date.now(), k: job.k, a: job.a, why: job.why || '', err: String(why || '').slice(0, 200), at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), tries: job.t || 0 });
    props.setProperty(BGQ_FAILED_PROP_, JSON.stringify(list.slice(-30)));
  } catch (e) {}
  try { ai_logBug({ entry: { kind: 'server', where: '뒤에서 할 일 실패 · ' + (BGQ_LABELS_[job.k] || job.k), message: String(why || '').replace(/01[016789]-?\d{3,4}-?\d{4}/g, '[전화]').slice(0, 300) } }); } catch (e) {}
}

// 대시보드 「답하실 것」이 보는 실패 목록(문자 받는 번호는 가운데를 가림)
function bgqFailedList_() {
  let list = []; try { list = JSON.parse(PropertiesService.getScriptProperties().getProperty(BGQ_FAILED_PROP_) || '[]'); } catch (e) { list = []; }
  return list.map(function (x) {
    const to = x.a && x.a.to ? String(x.a.to).replace(/^(\d{3})-?\d{3,4}-?(\d{4})$/, '$1-****-$2') : '';
    return { id: x.id, 종류: BGQ_LABELS_[x.k] || x.k, 무엇: x.why || '', 받는번호: to, 오류: x.err, at: x.at, tries: x.tries };
  });
}
// 화면 단추 — 다시 하기(대기열에 처음부터 다시 적음) / 지우기(실패 목록에서 뺌)
function bgqFailedAct_(body) {
  const id = String(body && body.id || ''), act = String(body && body.act || '');
  if (!id || ['retry', 'dismiss'].indexOf(act) === -1) return { success: false, message: '무엇을 할지 알 수 없습니다.' };
  const props = PropertiesService.getScriptProperties();
  let list = []; try { list = JSON.parse(props.getProperty(BGQ_FAILED_PROP_) || '[]'); } catch (e) { list = []; }
  const it = list.filter(function (x) { return x.id === id; })[0];
  if (!it) return { success: true, already: true, message: '이미 처리된 항목입니다.' }; // [2026.11.03] 화면 보낼 함이 다시 보내도 두 번 넣지 않고 성공으로
  props.setProperty(BGQ_FAILED_PROP_, JSON.stringify(list.filter(function (x) { return x.id !== id; })));
  if (act === 'retry') { bgEnqueue_(it.k, it.a, null, it.why); return { success: true, message: '다시 하도록 적었습니다(1분 안).' }; }
  return { success: true, message: '목록에서 지웠습니다.' };
}
// 남은 일 수(확인용)
function bgqPending_() {
  const all = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(all).filter(function (k) { return k.indexOf(BGQ_PREFIX_) === 0 && k !== BGQ_FAILED_PROP_; }).length;
}
