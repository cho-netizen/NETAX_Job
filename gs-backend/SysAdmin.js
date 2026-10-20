// [2026.10.20] 설정 🧭 시스템 관리 — 세무사님 "장기계획이나 마스터파일 등 시스템이 참고해야 할 파일을 내가 직접 보고서작성처럼
// 만들고 수정하고 조회할 수 있어야 하는 거 아닌가?". 예전엔 이 파일들이 드라이브 여기저기에 있어 직접 찾아 열어야만 볼 수 있었다.
// 화면은 manage/sysadmin.html(설정 카드). 여기서는 ① 목록(어디 있고, 시스템이 어디에 쓰고, 언제 고쳤나) ② 새 업무관리자 지침 만들기
// ③ 작성관리에서 이 파일을 저장할 때 직전 판을 같은 폴더 "_이전판"에 보관(aiSaveBackupPrev_ 재사용 — Code.js handleUploadFile이 부름)만 한다.
// 고치기는 작성관리(reportwriter.html) 편집창 그대로 — 따로 편집기를 만들지 않는다.
// "쓰임" 설명은 코드에서 확인한 사실만 적는다(아래 함수 이름이 근거). 읽는 곳이 바뀌면 여기 설명도 같이 고칠 것.

var SYSADMIN_PLAN_NAME_ = 'NX_장기개발계획.md';
var SYSADMIN_CHECKLIST_NAME_ = '체크리스트.md';
var SYSADMIN_IMPROVE_NAME_ = '개선요구사항.md';

var SYSADMIN_USES_ = {
  // getMasterProfileText_ — 대화 요청(DEFAULT_SYSTEM_PROMPT 뒤에 붙임), toolRememberFact(끝에 덧붙임), toolAuditBusinessManagers(야간점검)
  master: 'AI가 모든 질문마다 맨 앞에 읽는 기본 지침입니다(세무사님 소개·일하는 방식). AI 화면 ⚙에 "시스템 지시문"을 따로 적어 두면 그때는 이 파일 대신 그 글을 씁니다. '
    + 'AI에게 "기억해 둬"라고 하면 맨 끝 「AI가 추가한 사실」 절에 한 줄씩 덧붙습니다. 새벽 자기점검도 함께 읽습니다.',
  // toolAuditBusinessManagers ← runNightlySystemAudit(새벽), AI 도구 audit_business_managers
  plan: '새벽 자기점검이 "지금 하는 일이 이 방향과 맞는지" 따지는 기준으로 읽습니다. AI가 자기점검 도구를 쓸 때도 읽습니다. 평소 질문에는 읽지 않습니다.',
  checklist: '새벽 자기점검이 "체크리스트에 있는데 아직 반영 안 된 항목"을 찾는 기준으로 읽습니다. AI가 자기점검 도구를 쓸 때도 읽습니다. 평소 질문에는 읽지 않습니다.',
  // toolListBusinessManagers(이름 + 첫 줄) → toolLoadBusinessManager(전체), 야간점검 toolAuditBusinessManagers
  bm: 'AI가 질문을 받으면 업무관리자 목록(파일 이름 + 첫 줄)을 보고, 관련 있는 지침을 골라 전체를 불러 읽습니다. 그래서 첫 줄은 "이 파일이 다루는 것 한 줄"이어야 합니다. '
    + '새벽 자기점검이 관리자들끼리 모순·중복이 없는지 봅니다.',
  // Followup.js followupGet_/followupChange_ — 대시보드 📋 카드
  followup: '대시보드 📋 확인조치사항 카드의 원본입니다. 작업하던 Claude 세션들이 세무사님이 확인·결정하실 일을 "- [ ]" 줄로 적어 둡니다. 체크·고치기·추가는 대시보드 카드에서 하세요.',
  // processImprovementRequests(새벽) — 지난번 처리한 글자 수 뒤에 늘어난 부분만 새 요청으로 기록, 개선 후보 보고서가 읽음
  improve: '설정 🐞 카드의 ✍ 개선요구사항 적기가 끝에 덧붙이는 파일입니다. 서버가 "지난번에 처리한 글자 수" 뒤에 늘어난 부분만 새 요청으로 가려내 개선 후보 보고서(웹 Claude Code 주간 점검)에 올립니다. '
    + '중간을 고치면 새 요청 구분이 틀어지므로 여기서는 보기만 합니다 — 새 요청은 ✍ 버튼으로 적으세요.'
};

function sysAdminFileInfo_(file, extra) {
  var text = '';
  try { text = file.getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''); } catch (e) { }
  var first = '';
  var lines = text.split('\n');
  for (var i = 0; i < lines.length && !first; i++) first = lines[i].replace(/^#+\s*/, '').trim();
  return Object.assign({
    fileId: file.getId(), name: file.getName(), url: file.getUrl(),
    modified: Utilities.formatDate(file.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
    chars: text.length, firstLine: first.slice(0, 120), exists: true
  }, extra || {});
}

function sysAdminFolderLabel_(folder) {
  if (!folder) return '';
  var names = [];
  var root = getNetaxRootFolder_();
  var rootId = root ? root.getId() : '';
  var cur = folder;
  for (var i = 0; i < 4 && cur; i++) {
    names.unshift(cur.getName());
    if (cur.getId() === rootId) break;
    var ps = cur.getParents();
    cur = ps.hasNext() ? ps.next() : null;
  }
  return names.join(' › ');
}

function sysAdminList_() {
  var items = [];
  var warn = [];
  // 1) 마스터 프로필(Code.js MASTER_PROFILE_FILE_ID — 코드에 파일 ID 고정)
  try {
    var mf = DriveApp.getFileById(MASTER_PROFILE_FILE_ID);
    var mp = mf.getParents();
    items.push(sysAdminFileInfo_(mf, { key: 'master', group: '기본 지침', title: '마스터 프로필', where: sysAdminFolderLabel_(mp.hasNext() ? mp.next() : null), use: SYSADMIN_USES_.master, editable: true }));
  } catch (e) { warn.push('마스터 프로필 파일(코드에 고정된 ID)을 열지 못했습니다: ' + e.message); }

  // 2) 총괄관리자 폴더 — 장기개발계획·체크리스트·개선요구사항
  var chief = getChiefManagerFolder_();
  var chiefLabel = chief ? sysAdminFolderLabel_(chief) : '';
  [['plan', SYSADMIN_PLAN_NAME_, '장기개발계획', true], ['checklist', SYSADMIN_CHECKLIST_NAME_, '점검 체크리스트', true], ['improve', SYSADMIN_IMPROVE_NAME_, '개선요구사항', false]].forEach(function (d) {
    var base = { key: d[0], group: '총괄관리자', title: d[2], where: chiefLabel, use: SYSADMIN_USES_[d[0]], editable: d[3] };
    if (!chief) { items.push(Object.assign(base, { name: d[1], exists: false })); return; }
    var it = chief.getFilesByName(d[1]);
    var f = null;
    while (it.hasNext()) { var c = it.next(); if (!c.isTrashed()) { f = c; break; } }
    items.push(f ? sysAdminFileInfo_(f, base) : Object.assign(base, { name: d[1], exists: false }));
  });
  if (!chief) warn.push('총괄관리자 폴더가 설정되어 있지 않습니다(스크립트 속성 CHIEF_MANAGER_FOLDER_ID).');

  // 3) 업무관리자 폴더 맨 위의 .md/.txt 전부(toolListBusinessManagers와 같은 범위 — 하위폴더 _제안함·_이전판 등은 안 봄)
  var bmFolder = getBusinessManagerFolder_();
  if (bmFolder) {
    var bmLabel = sysAdminFolderLabel_(bmFolder);
    var bms = [];
    var bi = bmFolder.getFiles();
    while (bi.hasNext()) {
      var bf = bi.next();
      if (!/\.(md|txt)$/i.test(bf.getName()) || bf.isTrashed()) continue;
      bms.push(sysAdminFileInfo_(bf, { key: 'bm', group: '업무관리자 지침', title: bf.getName().replace(/\.(md|txt)$/i, ''), where: bmLabel, use: SYSADMIN_USES_.bm, editable: true }));
    }
    bms.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    items = items.concat(bms);
  } else warn.push('업무관리자 폴더가 설정되어 있지 않습니다(스크립트 속성 BUSINESS_MANAGER_FOLDER_ID).');

  // 4) 0 NETAX/_확인조치사항.md(Followup.js followupFile_ — 대시보드 카드와 같은 파일)
  try {
    var ff = typeof followupFile_ === 'function' ? followupFile_() : null;
    var root = getNetaxRootFolder_();
    if (ff) items.push(sysAdminFileInfo_(ff, { key: 'followup', group: '0 NETAX', title: '확인조치사항', where: root ? root.getName() : '', use: SYSADMIN_USES_.followup, editable: false }));
    else items.push({ key: 'followup', group: '0 NETAX', title: '확인조치사항', name: '_확인조치사항.md', where: root ? root.getName() : '', use: SYSADMIN_USES_.followup, editable: false, exists: false });
  } catch (e) { warn.push('확인조치사항 파일 확인 중 오류: ' + e.message); }

  return { success: true, items: items, warn: warn, canCreateBm: !!bmFolder };
}

// 새 업무관리자 지침 — 업무관리자 폴더에 .md를 만든다. 첫 줄 = "이 파일이 다루는 것 한 줄"(체크리스트 1번 규칙, toolListBusinessManagers가 그 줄을 AI에게 보여줌).
function sysAdminNewBm_(body) {
  var name = String(body && body.name || '').trim().replace(/\.(md|txt)$/i, '').replace(/[\\\/:*?"<>|]/g, '').trim();
  var firstLine = String(body && body.firstLine || '').replace(/\s+/g, ' ').trim();
  if (!name) return { error: '파일 이름을 적어 주세요.' };
  if (name.charAt(0) === '_') return { error: '"_"로 시작하는 이름은 시스템 보관용이라 쓸 수 없습니다.' };
  if (!firstLine) return { error: '이 지침이 다루는 것을 한 줄로 적어 주세요(AI가 지침을 고를 때 보는 줄입니다).' };
  var folder = getBusinessManagerFolder_();
  if (!folder) return { error: '업무관리자 폴더가 설정되어 있지 않습니다(BUSINESS_MANAGER_FOLDER_ID).' };
  return withLock_(8000, function () {
    var fileName = name + '.md';
    if (folder.getFilesByName(fileName).hasNext() || folder.getFilesByName(name + '.txt').hasNext()) return { error: '「' + name + '」 지침이 이미 있습니다 — 목록에서 열어 고치세요.' };
    var content = '# ' + firstLine + '\n\n'
      + '## 언제 쓰나\n- \n\n'
      + '## 처리 순서\n1. \n\n'
      + '## 확인할 것·판단 기준\n- \n';
    var f = folder.createFile(Utilities.newBlob(content, 'text/markdown', fileName));
    return { success: true, fileId: f.getId(), name: f.getName() };
  });
}

// 이 파일이 시스템 관리 목록의 파일인가 — 'master'|'plan'|'checklist'|'improve'|'bm'|'followup'|''
function sysAdminKindOf_(file) {
  var id = file.getId();
  if (id === MASTER_PROFILE_FILE_ID) return 'master';
  var name = String(file.getName() || '');
  if (!/\.(md|txt)$/i.test(name)) return '';
  var ps = file.getParents();
  if (!ps.hasNext()) return '';
  var parent = ps.next();
  var pid = parent.getId();
  var props = PropertiesService.getScriptProperties();
  var chiefId = sanitizeDriveId_(props.getProperty(CHIEF_MANAGER_FOLDER_ID_PROPERTY));
  if (chiefId && pid === chiefId) {
    if (name === SYSADMIN_PLAN_NAME_) return 'plan';
    if (name === SYSADMIN_CHECKLIST_NAME_) return 'checklist';
    if (name === SYSADMIN_IMPROVE_NAME_) return 'improve';
    return '';
  }
  var bmRaw = sanitizeDriveId_(props.getProperty(BUSINESS_MANAGER_FOLDER_ID_PROPERTY));
  if (bmRaw && (pid === bmRaw || parent.getName() === '업무관리자')) {
    var bm = getBusinessManagerFolder_();
    if (bm && bm.getId() === pid) return 'bm';
  }
  if (typeof FOLLOWUP_FILE_NAMES_ !== 'undefined' && FOLLOWUP_FILE_NAMES_.indexOf(name) !== -1) {
    var root = getNetaxRootFolder_();
    if (root && root.getId() === pid) return 'followup';
  }
  return '';
}

// Code.js handleUploadFile(기존 파일 덮어쓰기)가 setContent 직전에 부른다 — 작성관리·증빙관리 등 어디서 저장하든 같다.
// 시스템 파일이면: 개선요구사항은 막고(글자 수로 새 요청을 가려내므로), 나머지는 직전 판을 같은 폴더 "_이전판"에 한 개 보관하고,
// 사건 보고서 목록에 잘못 올라가지 않게 reportMeta를 지운다. 마스터 프로필은 저장 뒤 Code.js가 5분 캐시를 지워 다음 질문부터 새 내용이 쓰이게 한다.
// 확인이 실패해도 저장은 막지 않는다(그때는 예전처럼 그냥 저장).
function sysAdminBeforeSave_(file, body) {
  var kind = '';
  try { kind = sysAdminKindOf_(file); } catch (e) { return null; }
  if (!kind) return null;
  if (kind === 'improve') return { error: '개선요구사항.md는 서버가 글자 수로 새 요청을 가려내는 파일이라 고쳐 저장하지 않습니다 — 새 요청은 설정 🐞 카드의 ✍ 개선요구사항 적기로 적어 주세요.' };
  if (body) delete body.reportMeta;
  var backedUp = false;
  try {
    var ps = file.getParents();
    if (ps.hasNext()) backedUp = aiSaveBackupPrev_(ps.next(), file);
  } catch (e) { console.log('시스템 파일 이전판 보관 실패: ' + e.message); }
  return { kind: kind, backedUp: backedUp };
}
