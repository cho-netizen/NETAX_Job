// [2026-11-27] 넥스 독립 업무처리 — 넥스시스템 밖(탐색기·드라이브·지메일·구글 달력)으로 나가지 않게 하는 서버 도구.
//  근거: 세무사님 11-27 「넥스시스템만으로도 완전한 독립적인 업무처리가 가능하도록 시스템을 개선하고 …」 → 계획서
//  총괄관리자/_기록/넥스_독립업무처리_기기별_전수검사_계획서_20261127.html → 「권장대로 하자」.
//  화면(manage/fileview.html·docs.html·dashboard.html)과 넥스 도구(job_propose_action·job_lookup)가 같은 입구를 쓴다(10-22 원칙: 넥스 도구 = 화면 도구).
//  입구: dispatchClientAction0_의 sf_ 묶음(로그인 표가 있어야 닿는 manageApp_call 길) — 로그인 없는 입구는 늘리지 않는다.

function sf_dispatch_(body) {
  switch (body.action) {
    case 'sf_copy_item': return sfCopyItem_(body);
    case 'sf_unzip_to_folder': return sfUnzipToFolder_(body);
    case 'sf_mail_get': return sfMailGet_(body);
    case 'sf_mail_save': return sfMailSave_(body);
    case 'sf_cal_add': return sfCalAdd_(body);
    case 'sf_cal_update': return sfCalUpdate_(body);
    case 'sf_cal_delete': return sfCalDelete_(body);
    case 'sf_ext_log': return sfExtLog_(body);
    case 'sf_ext_stats': return sfExtStats_(body);
  }
  return { error: '알 수 없는 작업: ' + body.action };
}
var SF_ACTIONS_ = ['sf_copy_item', 'sf_unzip_to_folder', 'sf_mail_get', 'sf_mail_save', 'sf_cal_add', 'sf_cal_update', 'sf_cal_delete', 'sf_ext_log', 'sf_ext_stats'];

// ---------- 사본 만들기(같은 폴더에 「이름 - 사본.확장자」) ----------
function sfCopyItem_(body) {
  if (!body.id) return { error: 'id가 없습니다.' };
  try {
    var f = DriveApp.getFileById(body.id);
    var ps = f.getParents();
    var parent = body.folderId ? DriveApp.getFolderById(body.folderId) : (ps.hasNext() ? ps.next() : null);
    if (!parent) return { error: '파일이 든 폴더를 찾지 못했습니다.' };
    var name = String(body.name || '').trim();
    if (!name) {
      var n = f.getName(), m = /^(.*?)(\.[^.]{1,6})?$/.exec(n);
      name = (m[1] || n) + ' - 사본' + (m[2] || '');
      var k = 2; while (parent.getFilesByName(name).hasNext() && k < 50) { name = (m[1] || n) + ' - 사본 ' + k + (m[2] || ''); k++; }
    }
    var c = f.makeCopy(name, parent);
    return { ok: true, id: c.getId(), name: c.getName(), url: c.getUrl() };
  } catch (e) { return { error: '사본을 만들지 못했습니다: ' + (e && e.message || e) }; }
}

// ---------- 압축 전부 풀기(서버) — 화면이 못 받는 큰 압축(15MB 넘음)이나 넥스가 부를 때 ----------
//  같은 폴더의 「압축풀기_이름」에 푼다(서류 읽기 caseProcUnzipAll_과 같은 폴더 이름 — 그래서 서류 읽기가 다시 풀지 않는다).
//  이름이 깨진 옛 윈도 압축·비밀번호 걸린 안 파일 안내는 tcUnzip_(서류 읽기와 같은 함수)이 맡는다. 이미 같은 이름·크기 파일이 있으면 건너뜀.
function sfUnzipToFolder_(body) {
  if (!body.fileId) return { error: 'fileId가 없습니다.' };
  try {
    var file = DriveApp.getFileById(body.fileId);
    var name = file.getName();
    if (!/\.zip$/i.test(name) && !/zip/i.test(file.getMimeType())) return { error: 'zip 압축이 아닙니다 — 7z·rar·알집은 아직 못 엽니다.' };
    if (file.getSize() > 48 * 1024 * 1024) return { error: '압축이 너무 큽니다(' + Math.round(file.getSize() / 1048576) + 'MB, 서버 한도 48MB) — 나눠 받아 주세요.' };
    var ps = file.getParents(); if (!ps.hasNext()) return { error: '압축이 든 폴더를 찾지 못했습니다.' };
    var parent = ps.next();
    // onlyFolder: 비밀번호 압축 — 화면이 풀어 한 파일씩 올리므로 넣을 폴더만 같은 이름 규칙으로 만들어 준다
    if (body.onlyFolder) {
      var b0 = name.replace(/\.zip$/i, ''), it0 = parent.getFoldersByName('압축풀기_' + b0);
      var d0 = it0.hasNext() ? it0.next() : parent.createFolder('압축풀기_' + b0);
      return { ok: true, folderId: d0.getId(), folderName: d0.getName(), done: [], skipped: [], fail: [] };
    }
    var blobs;
    try { blobs = tcUnzip_(file.getBlob()); } catch (e) { return { error: '압축을 풀지 못했습니다: ' + (e && e.message || e) }; }
    var want = Array.isArray(body.names) && body.names.length ? body.names.map(String) : null;
    var base = name.replace(/\.zip$/i, '');
    var it = parent.getFoldersByName('압축풀기_' + base);
    var dest = it.hasNext() ? it.next() : parent.createFolder('압축풀기_' + base);
    var done = [], skipped = [], fail = [], encNote = '';
    blobs.slice(0, 200).forEach(function (b) {
      var raw = String(b.getName() || ''), leaf = raw.split('/').pop();
      if (!leaf || /^__MACOSX/.test(raw) || /\/$/.test(raw) || /^\./.test(leaf)) return;
      if (/^\(비밀번호 걸린 안 파일/.test(leaf)) { encNote = leaf.replace(/\.txt$/, ''); return; }
      if (want && want.indexOf(leaf) === -1 && want.indexOf(raw) === -1) return;
      var bytes = b.getBytes();
      if (!bytes.length) return;
      if (bytes.length > 45 * 1024 * 1024) { fail.push(leaf + '(너무 큼)'); return; }
      var ex = dest.getFilesByName(leaf), same = false;
      while (ex.hasNext()) { if (ex.next().getSize() === bytes.length) { same = true; break; } }
      if (same) { skipped.push(leaf); return; }
      try {
        var nb = Utilities.newBlob(bytes, sfMimeOf_(leaf), leaf);
        var nf = dest.createFile(nb);
        done.push({ id: nf.getId(), name: leaf, size: bytes.length });
      } catch (e2) { fail.push(leaf + '(' + (e2 && e2.message || e2) + ')'); }
    });
    if (done.length) { try { done.forEach(function (d) { if (typeof cpPrereadQueue_ === 'function') cpPrereadQueue_(d.id); }); if (typeof cpPrereadEnsureTrigger_ === 'function') cpPrereadEnsureTrigger_(); } catch (e3) {} }
    return { ok: true, folderId: dest.getId(), folderName: dest.getName(), done: done, skipped: skipped, fail: fail, encNote: encNote };
  } catch (e) { return { error: '압축 풀기 중 오류: ' + (e && e.message || e) }; }
}
function sfMimeOf_(n) {
  var x = (String(n).split('.').pop() || '').toLowerCase();
  return ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', txt: 'text/plain',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', hwp: 'application/x-hwp', hwpx: 'application/hwp+zip',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4' })[x] || 'application/octet-stream';
}

// ---------- 메일 — 본문·첨부를 시스템 안에서 보고 사건 폴더에 넣기 ----------
//  대시보드는 제목 목록(toolSearchEmails)만 보여 주고 누르면 지메일로 나갔다(D1). 이제 그 줄을 누르면 이것으로 본문·첨부를 받는다.
function sfMailGet_(body) {
  if (!body.threadId) return { error: 'threadId가 없습니다.' };
  try {
    var th = GmailApp.getThreadById(body.threadId);
    if (!th) return { error: '메일을 찾지 못했습니다.' };
    var msgs = th.getMessages().slice(-10).map(function (m) {
      var atts = [];
      try { m.getAttachments({ includeInlineImages: false, includeAttachments: true }).forEach(function (a, i) { atts.push({ i: i, name: a.getName(), size: a.getSize(), type: a.getContentType() }); }); } catch (e) {}
      var text = '';
      try { text = String(m.getPlainBody() || ''); } catch (e) {}
      if (!text.trim()) { try { text = String(m.getBody() || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); } catch (e) {} }
      return { id: m.getId(), from: m.getFrom(), to: m.getTo(), date: Utilities.formatDate(m.getDate(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), subject: m.getSubject(), body: text.slice(0, 20000), cut: text.length > 20000, attachments: atts };
    });
    var last = msgs[msgs.length - 1] || {};
    return { ok: true, threadId: body.threadId, subject: th.getFirstMessageSubject(), messages: msgs, suggest: sfMailSuggestCases_(last.from || '') };
  } catch (e) { return { error: '메일을 읽지 못했습니다: ' + (e && e.message || e) }; }
}
// 보낸 사람 → 고객 → 사건(권장안 ㉢: 맞으면 그 사건을 먼저 띄우고, 넣기는 세무사님이 누름). 이름(보낸 사람 표시 이름)·메일 주소(고객 메모·추가연락처)로 찾는다.
function sfMailSuggestCases_(from) {
  var out = [];
  try {
    var addr = (/<([^>]+)>/.exec(from) || [null, from])[1].trim().toLowerCase();
    var disp = String(from).replace(/<[^>]*>/, '').replace(/["']/g, '').trim();
    var cl = (client_getClients({}) || {}).clients || [];
    var hits = cl.filter(function (c) {
      var nm = String(c.성명 || '').trim();
      var blob = (String(c.메모 || '') + ' ' + String(c.추가연락처 || '') + ' ' + String(c.전화번호 || '')).toLowerCase();
      return (addr && addr.indexOf('@') > 0 && blob.indexOf(addr) !== -1) || (nm.length >= 2 && disp && disp.indexOf(nm) !== -1);
    }).slice(0, 5);
    if (!hits.length) return out;
    var cases = (work_getCases({}) || {}).cases || [];
    hits.forEach(function (c) {
      cases.filter(function (k) { return (k.고객ID && k.고객ID === c.id) || String(k.사건명 || '').indexOf(String(c.성명 || '').trim()) === 0; })
        .slice(0, 6).forEach(function (k) { if (k.폴더ID) out.push({ caseId: k.id, 사건명: k.사건명, 상태: k.상태 || '', folderId: k.폴더ID, 고객: c.성명, why: (addr && (String(c.메모 || '') + String(c.추가연락처 || '')).toLowerCase().indexOf(addr) !== -1) ? '메일 주소가 고객관리에 있음' : '보낸 사람 이름이 고객 이름과 같음' }); });
    });
  } catch (e) {}
  return out.slice(0, 8);
}
// 첨부 → 폴더(folderId 또는 caseId의 사건 폴더). indexes가 없으면 그 메일 첨부 전부.
function sfMailSave_(body) {
  if (!body.messageId) return { error: 'messageId가 없습니다.' };
  try {
    var folderId = body.folderId;
    if (!folderId && body.caseId) {
      var k = ((work_getCases({}) || {}).cases || []).filter(function (x) { return x.id === body.caseId; })[0];
      folderId = k && k.폴더ID;
    }
    if (!folderId) return { error: '넣을 폴더(사건)를 고르세요.' };
    var folder = DriveApp.getFolderById(folderId);
    var m = GmailApp.getMessageById(body.messageId);
    var atts = m.getAttachments({ includeInlineImages: false, includeAttachments: true });
    var idx = Array.isArray(body.indexes) && body.indexes.length ? body.indexes.map(Number) : atts.map(function (_, i) { return i; });
    var saved = [], skipped = [];
    idx.forEach(function (i) {
      var a = atts[i]; if (!a) return;
      var nm = a.getName() || ('첨부' + (i + 1));
      var ex = folder.getFilesByName(nm), same = false;
      while (ex.hasNext()) { if (ex.next().getSize() === a.getSize()) { same = true; break; } }
      if (same) { skipped.push(nm); return; }
      var f = folder.createFile(a.copyBlob().setName(nm));
      saved.push({ id: f.getId(), name: nm });
      try { if (typeof cpPrereadQueue_ === 'function') cpPrereadQueue_(f.getId()); } catch (e) {}
    });
    try { if (saved.length && typeof cpPrereadEnsureTrigger_ === 'function') cpPrereadEnsureTrigger_(); } catch (e) {}
    return { ok: true, folderId: folderId, saved: saved, skipped: skipped };
  } catch (e) { return { error: '첨부를 넣지 못했습니다: ' + (e && e.message || e) }; }
}

// ---------- 달력 — 대시보드에서 바로 넣기·고치기·지우기(E1) ----------
function sfCalTimes_(b) {
  var d = String(b.date || '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('날짜(yyyy-mm-dd)가 없습니다.');
  if (b.allDay || !b.start) return { allDay: true, start: new Date(d + 'T00:00:00') };
  var s = new Date(d + 'T' + b.start + ':00'), e = b.end ? new Date(d + 'T' + b.end + ':00') : new Date(s.getTime() + 60 * 60000);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) throw new Error('시각 모양이 이상합니다(00:00).');
  if (e <= s) e = new Date(s.getTime() + 30 * 60000);
  return { allDay: false, start: s, end: e };
}
function sfCalAdd_(body) {
  try {
    var t = String(body.title || '').trim(); if (!t) return { error: '내용을 적어 주세요.' };
    var tm = sfCalTimes_(body), cal = CalendarApp.getDefaultCalendar();
    var ev = tm.allDay ? cal.createAllDayEvent(t, tm.start, { description: String(body.desc || '') }) : cal.createEvent(t, tm.start, tm.end, { description: String(body.desc || '') });
    return { ok: true, id: ev.getId() };
  } catch (e) { return { error: '일정을 넣지 못했습니다: ' + (e && e.message || e) }; }
}
function sfCalUpdate_(body) {
  try {
    var ev = CalendarApp.getDefaultCalendar().getEventById(String(body.id || ''));
    if (!ev) return { error: '일정을 찾지 못했습니다(지워졌을 수 있음).' };
    if (body.title != null && String(body.title).trim()) ev.setTitle(String(body.title).trim());
    if (body.date) { var tm = sfCalTimes_(body); if (tm.allDay) ev.setAllDayDate(tm.start); else ev.setTime(tm.start, tm.end); }
    if (body.desc != null) ev.setDescription(String(body.desc));
    return { ok: true, id: ev.getId() };
  } catch (e) { return { error: '일정을 고치지 못했습니다: ' + (e && e.message || e) }; }
}
function sfCalDelete_(body) {
  try {
    var ev = CalendarApp.getDefaultCalendar().getEventById(String(body.id || ''));
    if (!ev) return { error: '일정을 찾지 못했습니다(이미 지워졌을 수 있음).' };
    ev.deleteEvent();
    return { ok: true };
  } catch (e) { return { error: '일정을 지우지 못했습니다: ' + (e && e.message || e) }; }
}

// ---------- 밖으로 나간 횟수 세기(6단계, 비용 0) ----------
//  화면이 바깥 주소로 나갈 때마다 {cat(무엇을 하려고), dev(PC·태블릿·폰), host}를 보낸다. 날짜별·종류별 횟수만 남긴다(주소·파일 이름은 안 남김).
//  60일만 남기고, sf_ext_stats가 최근 n일 순위를 돌려준다(대시보드·설정 시스템 관리 카드).
var SF_EXT_PROP_ = 'sf_ext_counts_v1';
function sfExtLog_(body) {
  var cat = String(body.cat || '기타').slice(0, 40), dev = /^(PC|태블릿|폰)$/.test(String(body.dev)) ? String(body.dev) : 'PC';
  var host = String(body.host || '').replace(/[^a-z0-9.\-]/gi, '').slice(0, 60);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return { ok: false };
  try {
    var p = PropertiesService.getScriptProperties(), all = {};
    try { all = JSON.parse(p.getProperty(SF_EXT_PROP_) || '{}'); } catch (e) { all = {}; }
    var day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var d = all[day] = all[day] || {};
    var k = cat + '|' + dev + '|' + host;
    d[k] = (d[k] || 0) + 1;
    var days = Object.keys(all).sort(); while (days.length > 60) delete all[days.shift()];
    var s = JSON.stringify(all); if (s.length > 8500) { delete all[Object.keys(all).sort()[0]]; s = JSON.stringify(all); }
    p.setProperty(SF_EXT_PROP_, s);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function sfExtStats_(body) {
  var n = Math.min(Math.max(Number(body.days) || 7, 1), 60);
  var all = {}; try { all = JSON.parse(PropertiesService.getScriptProperties().getProperty(SF_EXT_PROP_) || '{}'); } catch (e) {}
  var since = Utilities.formatDate(new Date(Date.now() - (n - 1) * 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
  var by = {}, total = 0, first = Object.keys(all).sort()[0] || '';
  Object.keys(all).forEach(function (day) {
    if (day < since) return;
    Object.keys(all[day]).forEach(function (k) {
      var parts = k.split('|'), c = all[day][k]; total += c;
      var row = by[parts[0]] = by[parts[0]] || { cat: parts[0], n: 0, dev: {}, hosts: {} };
      row.n += c; row.dev[parts[1]] = (row.dev[parts[1]] || 0) + c; if (parts[2]) row.hosts[parts[2]] = (row.hosts[parts[2]] || 0) + c;
    });
  });
  var rows = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.n - a.n; });
  return { ok: true, days: n, since: since, firstDay: first, total: total, rows: rows };
}
