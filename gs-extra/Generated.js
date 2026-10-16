// 자동 생성 파일 — 직접 고치지 말 것. 원본: gs-backend/*.js, 생성: tools/build-light.js
// 조회 시작점: handleListFolder, handleGetNetaxRootPath, handleListCaseTemplates, handleGetCaseTemplateContent, handleListGeneralMemos, handleListAllReports, handleGetLatestTemplateReview, jsonResponse
// 포함한 최상위 선언 52개 (시트 쓰기가 들어 있는 것: ai_convFolder_, getOrCreateSubfolder_, work_getSheet_)

// [2026.08] 예전엔 여기(서버)에 도구 왕복 루프 상한(MAX_TOOL_LOOPS)과 Apps Script 실행시간
// 상한(약 6분)에 대비한 시간 예산(TOOL_LOOP_TIME_BUDGET_MS)이 있었다. 이제 루프 자체를 클라이언트
// (chat.js의 CLIENT_MAX_TOOL_ROUNDS)로 옮겨서 이 함수는 매 요청마다 API를 딱 1번만 부르므로
// 더 이상 필요 없다 — 자세한 배경은 callClaude() 함수 위 주석 참고.

const DEFAULT_FOLDER_ID_PROPERTY = 'NX_DEFAULT_FOLDER_ID';

// ============================================================
// [2026.10.08] job AI탭 — 대화 저장소
// ------------------------------------------------------------
// work.netax.kr은 사건 폴더마다 _대화기록.json 하나만 두는 방식이라 사건당 대화가 1개뿐이었고,
// 사건이 아닌 일반 대화는 저장되지 않았다. job AI탭은 대화마다 파일 1개를 기본폴더(사건 폴더들이
// 있는 곳) 아래 "_AI대화기록" 폴더에 두고, 목록은 같은 폴더의 _목록.json 하나로 관리한다.
// 대화마다 사건(caseId·폴더ID)을 연결할 수 있고 한 사건에 여러 대화도 가능하다. "_"로 시작하는
// 폴더라 AI의 자동참조 대상에서도 빠진다.
// ============================================================
const AI_CONV_FOLDER_NAME_ = '_AI대화기록';

function ai_convFolder_() {
  const root = getDefaultFolder();
  const it = root.getFoldersByName(AI_CONV_FOLDER_NAME_);
  return it.hasNext() ? it.next() : root.createFolder(AI_CONV_FOLDER_NAME_);
}

/**
 * 스크립트 속성에 폴더/파일 ID를 넣을 때, 구글드라이브 "링크 복사"로 얻은 전체 주소를
 * 그대로 붙여넣어서 끝에 "?usp=drive_link" 같은 꼬리표가 같이 들어가는 실수가 흔하다
 * (실제로 이 문제 때문에 업무관리자 폴더 연결이 계속 조용히 실패하고 있었다 — DriveApp.
 * getFolderById()는 순수 ID만 받아들이고, 꼬리표가 붙어 있으면 그냥 오류를 내며 null로
 * 처리돼버려서 겉으로는 "설정 안 한 것"과 똑같아 보였다). 전체 링크가 들어와도, 순수 ID만
 * 들어와도 항상 깨끗한 ID 하나만 뽑아내서 이런 실수를 자동으로 허용한다.
 */
function sanitizeDriveId_(raw) {
  if (!raw) return raw;
  let s = String(raw).trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) || s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return s.split('?')[0].split('#')[0].split('/')[0].trim();
}

function getDefaultFolder() {
  const defId = sanitizeDriveId_(PropertiesService.getScriptProperties().getProperty(DEFAULT_FOLDER_ID_PROPERTY));
  if (defId) {
    try {
      return DriveApp.getFolderById(defId);
    } catch (err) {
    }
  }
  return DriveApp.getRootFolder();
}

function getPathFromRoot(folder) {
  const rootId = DriveApp.getRootFolder().getId();
  const names = [];
  let current = folder;
  let guard = 0;
  while (current.getId() !== rootId && guard < 50) {
    names.unshift(current.getName());
    const parents = current.getParents();
    if (!parents.hasNext()) break;
    current = parents.next();
    guard++;
  }
  return names;
}

function handleListFolder(body) {
  let folder;
  let pathArr;

  // [2026.09] folderId(실제 Drive 폴더ID)가 오면 이름 기반 경로탐색 없이 그대로 연다 — 사건
  // 폴더의 서브폴더처럼 이름이 나중에 바뀔 수 있는 곳을 안정적으로 찾을 때 쓴다(work_getCaseSubfolders 참고).
  if (body.folderId) {
    try {
      folder = DriveApp.getFolderById(body.folderId);
    } catch (err) {
      return { error: '폴더를 찾을 수 없습니다: ' + err.message };
    }
    pathArr = getPathFromRoot(folder);
  } else if (body.path === undefined || body.path === null) {
    folder = getDefaultFolder();
    pathArr = getPathFromRoot(folder);
  } else {
    folder = DriveApp.getRootFolder();
    pathArr = Array.isArray(body.path) ? body.path.map(String) : [];
    for (let i = 0; i < pathArr.length; i++) {
      const name = pathArr[i];
      const subIter = folder.getFoldersByName(name);
      if (!subIter.hasNext()) {
        return { error: '폴더를 찾을 수 없습니다: ' + pathArr.slice(0, i + 1).join(' / ') };
      }
      folder = subIter.next();
    }
  }

  const folders = [];
  const folderIter = folder.getFolders();
  while (folderIter.hasNext()) {
    const f = folderIter.next();
    folders.push({ id: f.getId(), name: f.getName(), type: 'folder' });
  }
  folders.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });

  const files = [];
  const fileIter = folder.getFiles();
  while (fileIter.hasNext()) {
    const f = fileIter.next();
    files.push({
      id: f.getId(),
      name: f.getName(),
      type: 'file',
      mimeType: f.getMimeType(),
      modifiedDate: Utilities.formatDate(f.getLastUpdated(), 'Asia/Seoul', 'yyyy.MM.dd HH:mm:ss'),
      sizeBytes: f.getSize(),
      url: f.getUrl()
    });
  }
  files.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });

  return { path: pathArr, folderId: folder.getId(), folders: folders, files: files };
}

// [2026.09 신규] 일반메모 본문검색+노트북(하위폴더) — 파일명·내용 검색과 태그 필터를 노트북이
// 늘어나도 전체를 한꺼번에 훑을 수 있어야 해서, "일반메모" 폴더 전체를 하위폴더까지 재귀적으로
// 한 번에 읽어 반환한다(개인용 메모함이라 파일 수가 많지 않다는 전제 — 수백 건 이상으로 늘면
// 별도 색인 방식으로 바꿔야 함). notebooks는 조플린 노트북처럼 쓸 수 있는 하위폴더 목록(경로
// 배열), files 각각의 notebookPath로 어느 노트북 소속인지 알 수 있다.
function handleListGeneralMemos(body) {
  let rootFolder;
  try {
    rootFolder = resolveFolderByPath(body.path);
  } catch (err) {
    return { files: [], notebooks: [] }; // 폴더가 아직 없으면 빈 목록(첫 메모 저장 전 정상 상태)
  }
  const files = [];
  const notebooks = [];
  function walk(folder, relPath) {
    const fileIter = folder.getFiles();
    while (fileIter.hasNext()) {
      const f = fileIter.next();
      let content = '';
      try { content = f.getBlob().getDataAsString('UTF-8'); } catch (err) { content = ''; }
      files.push({
        id: f.getId(),
        name: f.getName(),
        modifiedDate: f.getLastUpdated().getTime(),
        content: content,
        notebookPath: relPath.slice()
      });
    }
    const subIter = folder.getFolders();
    while (subIter.hasNext()) {
      const sub = subIter.next();
      const subPath = relPath.concat([sub.getName()]);
      notebooks.push(subPath);
      walk(sub, subPath);
    }
  }
  walk(rootFolder, []);
  files.sort(function (a, b) { return b.modifiedDate - a.modifiedDate; });
  return { files: files, notebooks: notebooks };
}

function resolveFolderByPath(pathArr) {
  let folder = DriveApp.getRootFolder();
  const arr = Array.isArray(pathArr) ? pathArr.map(String) : [];
  for (let i = 0; i < arr.length; i++) {
    const subIter = folder.getFoldersByName(arr[i]);
    if (!subIter.hasNext()) {
      throw new Error('폴더를 찾을 수 없습니다: ' + arr.slice(0, i + 1).join(' / '));
    }
    folder = subIter.next();
  }
  return folder;
}

const BUSINESS_MANAGER_FOLDER_ID_PROPERTY = 'BUSINESS_MANAGER_FOLDER_ID';

function getBusinessManagerFolder_() {
  const id = sanitizeDriveId_(PropertiesService.getScriptProperties().getProperty(BUSINESS_MANAGER_FOLDER_ID_PROPERTY));
  if (!id) return null;
  try {
    const folder = DriveApp.getFolderById(id);
    // [2026-08-01 정비] BUSINESS_MANAGER_FOLDER_ID는 "업무관리자" 폴더 자체가 아니라 그
    // 한 단계 위("0 NETAX")를 가리키도록 설정돼 있다(세무사님 확인, 2026.07 — 아래
    // getNetaxRootFolder_ 주석 참고). 그런데 이 사실을 반영한 보정 로직이 getCaseTemplateFolder_
    // 에만 있고, 정작 이 함수를 직접 쓰는 toolListBusinessManagers/toolLoadBusinessManager/
    // toolAuditBusinessManagers(야간점검)/toolProposeNewBusinessManager 4곳은 "0 NETAX"
    // 바로 밑에서 .md 파일을 찾고 있었다 — 실제 파일은 그 안의 "업무관리자" 하위폴더에 있어서
    // 에러 없이 그냥 항상 "없음"으로만 나오는 상태였다. 여기서 한 번에 보정해서 4곳 모두 고친다.
    const nested = folder.getFoldersByName('업무관리자');
    return nested.hasNext() ? nested.next() : folder;
  } catch (err) {
    return null;
  }
}

// "0 NETAX" — 넥스 시스템 운영을 위한 환경설정값들이 들어있는 폴더로, <고객사건>(기본 작업
// 폴더, NX_DEFAULT_FOLDER_ID가 가리키는 곳 — 사건만 다루는 폴더)과는 완전히 별개의 최상위
// 폴더다. [패치 2026.07] 예전엔 프론트엔드가 이 둘을 같은 것으로 잘못 취급해서(일반메모가
// <고객사건>/일반메모에 저장되던 버그), "0 NETAX"의 진짜 경로를 알려주는 전용 액션을 추가했다.
const NETAX_ROOT_FOLDER_ID_PROPERTY = 'NETAX_ROOT_FOLDER_ID';

function getNetaxRootFolder_() {
  // 확인된 사실: <0 NETAX> = BUSINESS_MANAGER_FOLDER_ID가 가리키는 바로 그 폴더(세무사님 확인,
  // 2026.07). 별도 속성을 새로 만들 필요 없이 이미 있는 값을 그대로 쓴다. NETAX_ROOT_FOLDER_ID를
  // 굳이 따로 설정해두셨다면 그쪽을 우선한다(예: 나중에 폴더 구조가 바뀌는 경우 대비).
  //
  // [2026-08-01 주의] getBusinessManagerFolder_()를 그대로 재활용하지 않는다 — 그 함수는
  // 이제 "업무관리자" 하위폴더까지 한 단계 더 들어간 값을 돌려주도록 고쳤기 때문에(바로 위
  // 함수 참고), 여기서는 BUSINESS_MANAGER_FOLDER_ID 원본 값을 직접 다시 읽어서 "0 NETAX"
  // 자체를 돌려준다.
  const explicitId = sanitizeDriveId_(PropertiesService.getScriptProperties().getProperty(NETAX_ROOT_FOLDER_ID_PROPERTY));
  if (explicitId) {
    try { return DriveApp.getFolderById(explicitId); } catch (err) { }
  }
  const businessManagerRawId = sanitizeDriveId_(PropertiesService.getScriptProperties().getProperty(BUSINESS_MANAGER_FOLDER_ID_PROPERTY));
  if (businessManagerRawId) {
    try { return DriveApp.getFolderById(businessManagerRawId); } catch (err) { }
  }
  return null;
}

function handleGetNetaxRootPath(body) {
  const folder = getNetaxRootFolder_();
  if (!folder) {
    return { error: '"0 NETAX" 폴더를 찾을 수 없습니다. BUSINESS_MANAGER_FOLDER_ID(또는 NETAX_ROOT_FOLDER_ID)가 스크립트 속성에 올바르게 설정되어 있는지 확인해주세요.' };
  }
  try {
    return { path: getPathFromRoot(folder), folderId: folder.getId() };
  } catch (err) {
    return { error: '"0 NETAX" 폴더 경로 확인 중 오류: ' + err.message };
  }
}

// ===== 총괄관리자 폴더 (체크리스트·개선요구사항·점검리포트·생성파일을 여기서 다 주고받는다) =====
const CHIEF_MANAGER_FOLDER_ID_PROPERTY = 'CHIEF_MANAGER_FOLDER_ID';

function getChiefManagerFolder_() {
  const id = sanitizeDriveId_(PropertiesService.getScriptProperties().getProperty(CHIEF_MANAGER_FOLDER_ID_PROPERTY));
  if (!id) return null;
  try {
    return DriveApp.getFolderById(id);
  } catch (err) {
    return null;
  }
}

function getOrCreateSubfolder_(parent, name) {
  const iter = parent.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parent.createFolder(name);
}

// ===== 의뢰서 템플릿(2026.07 추가, 2026.09 "사건개시템플릿"에서 이름 변경) =====
// 업무관리자 폴더 안의 "의뢰서템플릿" 하위폴더에 세목·업무유형별(양도·증여·상속·불복·
// 세무조사·해명자료·자금출처소명·경정청구 등) 상담 의뢰서 템플릿 파일(엑셀 또는
// 텍스트/마크다운)을 미리 넣어두면, 새 사건을 만들 때 이름이 맞는 파일을 자동으로 그 사건
// 폴더에 복사해 넣는다(work_seedCaseTemplateIfAny_). 텍스트/마크다운 템플릿은 내용 그대로
// 복사되어 증빙관리 파일뷰어에서 바로 채워 쓸 수 있고, 엑셀처럼 미리보기·편집이 안 되는
// 형식은 파일째로 복사된다.
const CASE_TEMPLATE_SUBFOLDER_NAME = '의뢰서템플릿';

const TEXT_TEMPLATE_EXT_REGEX_ = /\.(md|txt)$/i;

// [2026.09.17] 의뢰서템플릿 폴더의 파일은 전부 "의뢰서_" 접두어를 붙이는 이름규칙으로 통일함
// (예: "증여신고.md" → "의뢰서_증여신고.md").
const CASE_TEMPLATE_NAME_PREFIX_ = '의뢰서_';

/**
 * 의뢰서템플릿 폴더 = 업무관리자 폴더(getBusinessManagerFolder_) 안의 "의뢰서템플릿"
 * 하위폴더(2026.09 이전 이름: "사건개시템플릿"). getBusinessManagerFolder_ 자체가 이제
 * "0 NETAX vs 업무관리자" 한 단계 보정을 전담하므로, 여기서는 그 결과를 그대로 믿고
 * 하위폴더만 하나 더 내려가면 된다.
 * (2026-08-01: 예전에 이 함수 안에서 같은 보정을 중복으로 하다가 여러 번 고치면서 서로
 * 모순되는 주석 세 겹이 쌓였던 걸 정리 — 보정 로직은 getBusinessManagerFolder_ 한 곳에만
 * 있고, 이 함수는 그걸 그대로 쓰기만 한다.)
 */
function getCaseTemplateFolder_() {
  // [2026-08-01 정비] "업무관리자" 하위폴더 보정 로직을 getBusinessManagerFolder_ 쪽으로
  // 옮겼으므로(그 함수를 쓰는 다른 도구들도 다 같은 문제였음), 여기서는 더 이상 따로
  // getFoldersByName('업무관리자')를 반복할 필요가 없다. 이미 보정된 폴더를 그대로 쓴다.
  const folder = getBusinessManagerFolder_();
  if (!folder) return null;
  return getOrCreateSubfolder_(folder, CASE_TEMPLATE_SUBFOLDER_NAME);
}

/** 의뢰서템플릿 폴더 안의 파일 목록을, 화면에서 바로 고를 수 있게 정리해서 돌려준다. */
function handleListCaseTemplates(body) {
  const folder = getCaseTemplateFolder_();
  if (!folder) {
    return { error: '"0 NETAX" 폴더를 찾을 수 없습니다. BUSINESS_MANAGER_FOLDER_ID가 스크립트 속성에 올바르게 설정되어 있는지 확인해주세요.' };
  }
  try {
    const templates = [];
    const iter = folder.getFiles();
    while (iter.hasNext()) {
      const f = iter.next();
      const rawName = f.getName();
      const extMatch = rawName.match(/\.[a-zA-Z0-9]+$/);
      const ext = extMatch ? extMatch[0] : '';
      const nameWithoutExt = ext ? rawName.slice(0, -ext.length) : rawName;
      templates.push({
        id: f.getId(),
        name: nameWithoutExt, // 사건분류로 그대로 쓰임 (예: "양도")
        ext: ext,
        mimeType: f.getMimeType(),
        isText: TEXT_TEMPLATE_EXT_REGEX_.test(rawName)
      });
    }
    templates.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
    // 문제가 생겼을 때 "지금 실제로 어느 폴더를 보고 있는지" 바로 확인할 수 있도록,
    // 목록이 비어 있을 때는 특히 실제 조회 경로를 함께 돌려준다.
    let folderPathText = '';
    try { folderPathText = getPathFromRoot(folder).join(' / '); } catch (e2) {}
    // 배포가 제대로 갱신됐는지 바로 확인할 수 있도록 코드 버전 표시를 함께 돌려준다
    // (이 값이 바뀌지 않으면 Apps Script 배포가 아직 최신 코드로 갱신되지 않은 것).
    return { templates: templates, folderPath: folderPathText, codeVersion: 'caseTemplate-v5-2026-08-01-nested-confirmed' };
  } catch (err) {
    return { error: '의뢰서템플릿 목록 조회 중 오류: ' + err.message };
  }
}

/** 텍스트/마크다운 템플릿 하나의 원문 내용을 가져온다(화면에서 채워 넣을 수 있도록). */
function handleGetCaseTemplateContent(body) {
  if (!body.fileId) return { error: 'fileId가 없습니다.' };
  try {
    const file = DriveApp.getFileById(body.fileId);
    if (!TEXT_TEMPLATE_EXT_REGEX_.test(file.getName())) {
      return { error: '텍스트로 미리보기할 수 없는 파일 형식입니다(엑셀 등은 그대로 복사됩니다).' };
    }
    return { content: file.getBlob().getDataAsString('UTF-8') };
  } catch (err) {
    return { error: '템플릿 내용을 읽는 중 오류: ' + err.message };
  }
}

// 파일이 있으면 내용을 그대로, 없으면 null을 돌려준다(오류로 취급하지 않음 — 아직 안 만든 파일일 수 있어서).
function readFileIfExists_(folder, name) {
  const iter = folder.getFilesByName(name);
  if (!iter.hasNext()) return null;
  return iter.next().getBlob().getDataAsString('UTF-8');
}

// 같은 이름 파일 있으면 덮어쓰고, 없으면 새로 만든다.
function writeFileOverwrite_(folder, name, content, mimeType) {
  const iter = folder.getFilesByName(name);
  if (iter.hasNext()) {
    const f = iter.next();
    f.setContent(content);
    return f;
  }
  return folder.createFile(Utilities.newBlob(content, mimeType || 'text/plain', name));
}

const MY_SUBFOLDER_REPORT = '보고서_외부'; // [2026.09.16 변경] 예전 이름 '보고서' → 개명(WORK_SUBFOLDER_INTERNAL_REPORT 주석 참고)

// ============================================================
// [2026.09 신규] "보고서 모음" 화면 — 모아보기 / 템플릿다듬기 / 글감만들기
// ============================================================

// [2026.09.16 재설계] 실사용 지적 — "왜 일부 문서만 보이나, PDF는 왜 보이나, 사건폴더 내
// 모든 파일이 다 조회돼야 하는 거 아닌가." 원래는 딱 두 하위폴더 이름("내부보고서"/"보고서")
// 바로 안만 보고, 그 안에 있는 파일이면 확장자 상관없이 다 보여줬다 — 그래서 그 두 폴더 밖에
// 저장된 진짜 보고서는 안 보이고, 반대로 그 폴더 안에 실수로 들어간 PDF 등은 보였다. 이제는
// 위치가 아니라 "파일 형식"으로 판단한다 — 사건 폴더 전체(하위폴더 전부 재귀 탐색)에서
// 실제로 보고서 형식인 파일(.md/.html·구글문서, .ppt·구글슬라이드)만 골라낸다.
const RH_REPORT_EXT_RE_ = /\.(md|markdown|html?|pptx?)$/i;

const RH_REPORT_MIME_ALLOW_ = {
  'application/vnd.google-apps.presentation': true // 구글 슬라이드(확장자 없음) = PPT 취급
};

// [2026.09.17 신규] "의뢰내용류 파일은 보고서 모음에 띄우지 말라" — 사건 생성 시 의뢰서템플릿
// 폴더에서 그대로 복사돼 들어오는 "OOO_의뢰내용.md" 같은 파일은 실제 보고서가 아니라 상담
// 접수 당시 원문(사건의뢰서)이라, 확장자만으로는 걸러지던 기존 규칙에서 명시적으로 제외한다.
const RW_INTAKE_FILENAME_PATTERN_ = /의뢰내용/;

const RW_INTAKE_CANONICAL_NAME_ = '사건의뢰서';

// [2026.09.18 버그수정] 세무사님 지적 — "의뢰서정비를 했는데도 왜 파일명에 증여신고·상속신고
// 같은 이름이 계속 보이나?" 실제 원인: work_seedCaseTemplateIfAny_(새 사건 생성 시 의뢰서템플릿
// 자동복사)는 위의 "OOO_의뢰내용.md" 패턴이 아니라 템플릿 파일명을 그대로("증여신고.md" 등)
// 복사해 넣는다 — 이건 이 관리 앱 전용의 더 최근 메커니즘이라 위 정규식이 애초에 이 경우를
// 고려하지 못했다. "의뢰서템플릿" 폴더에 실제로 있는(또는 접두어 도입 전 있었던) 파일명과
// 정확히 같은 이름의 사건 폴더 파일은 전부 의뢰서 원문으로 간주해 같은 방식으로 제외한다.
let rh_intakeTemplateBaseNamesCache_ = null;

function rh_getIntakeTemplateBaseNames_() {
  if (rh_intakeTemplateBaseNamesCache_) return rh_intakeTemplateBaseNamesCache_;
  const names = {};
  try {
    const folder = getCaseTemplateFolder_();
    if (folder) {
      const iter = folder.getFiles();
      while (iter.hasNext()) {
        const raw = iter.next().getName();
        const base = raw.replace(/\.[a-zA-Z0-9]+$/, '');
        names[base] = true;
        // "의뢰서_증여신고" 템플릿이 있으면, 접두어 도입 전에 이미 사건 폴더에 복사돼 있던
        // 옛 이름("증여신고") 사본도 같은 것으로 인식해야 한다.
        if (base.indexOf(CASE_TEMPLATE_NAME_PREFIX_) === 0) names[base.slice(CASE_TEMPLATE_NAME_PREFIX_.length)] = true;
      }
    }
  } catch (err) {
    // 템플릿 폴더 조회가 실패해도 나머지 판정(의뢰내용 패턴 등)은 그대로 동작해야 한다.
  }
  rh_intakeTemplateBaseNamesCache_ = names;
  return names;
}

function rh_isIntakeLikeFile_(name) {
  const n = String(name || '');
  if (RW_INTAKE_FILENAME_PATTERN_.test(n)) return true;
  const base = n.replace(/\.[a-zA-Z0-9]+$/, '');
  if (base === RW_INTAKE_CANONICAL_NAME_) return true;
  return !!rh_getIntakeTemplateBaseNames_()[base];
}

function rh_isReportFile_(name, mimeType) {
  if (rh_isIntakeLikeFile_(name)) return false;
  if (RH_REPORT_MIME_ALLOW_[mimeType]) return true;
  return RH_REPORT_EXT_RE_.test(name);
}

// 사건 폴더 하나를 하위폴더까지 전부 재귀적으로 훑어 보고서 형식 파일만 모은다. 폴더 깊이가
// 무한정 깊어질 일은 없는 구조(사건 폴더 안엔 몇 단계 하위폴더뿐)라 별도 깊이제한은 안 둔다.
// [2026.09.16 버그수정] kind에 folder.getName()을 그대로 넣고 화면(reporthub.html)에서
// "kind === '보고서'"로 발행 여부를 판단했는데, 그 사이 실제 폴더명이 '보고서'→'보고서_외부'로
// 바뀌면서(MY_SUBFOLDER_REPORT) 문자열이 어긋나 발행된 보고서도 전부 "초안"으로 잘못 표시되고
// 있었다 — 지금 시점의 실제 상수와 직접 비교한 published를 별도로 내려준다.
function rh_collectReportFilesInFolder_(folder, out, caseId, 고객명, 사건명) {
  const fIter = folder.getFiles();
  const folderName = folder.getName();
  while (fIter.hasNext()) {
    const f = fIter.next();
    if (!rh_isReportFile_(f.getName(), f.getMimeType())) continue;
    out.push({
      id: f.getId(), name: f.getName(), mimeType: f.getMimeType(),
      modifiedDate: f.getLastUpdated().getTime(), caseId: caseId, 고객명: 고객명, 사건명: 사건명,
      kind: folderName, published: (folderName === MY_SUBFOLDER_REPORT)
    });
  }
  const subIter = folder.getFolders();
  while (subIter.hasNext()) {
    const sf = subIter.next();
    if (caseIsFiledReturnFolder_(sf.getName())) continue; // 이미 낸 신고서 보관 폴더(보고서 아님)
    rh_collectReportFilesInFolder_(sf, out, caseId, 고객명, 사건명);
  }
}

// [2026.09.16 재설계] 모아보기를 열 때마다 사건 전체를 실시간으로 재스캔해(사건마다 드라이브
// 폴더를 하위폴더까지 재귀 탐색) 사건이 쌓일수록 매번 점점 느려지던 문제 — "_보고서인덱스"
// 폴더(총괄관리자 폴더 하위)에 미리 만들어둔 index.json을 읽기만 하는 방식으로 바꾼다.
// 인덱스 자체는 (1) 문서를 저장/발행할 때 그 건만 즉시 갱신되고(handleUploadFile의
// reportMeta 처리 참고), (2) 혹시 놓친 변경(수동 삭제 등)이 있어도 매일 밤(runNightlyChiefManager)
// 전체 재구성으로 스스로 바로잡는다. 총괄관리자 폴더가 아예 설정 안 돼 있거나 인덱스 파일이
// 아직 한 번도 안 만들어졌으면(최초 1회) 예전처럼 전체 스캔으로 채운다 — 그 결과가 그대로
// 인덱스로도 저장되므로 다음 호출부터는 빨라진다.
function rh_indexFolder_() {
  const chief = getChiefManagerFolder_();
  if (!chief) return null;
  return getOrCreateSubfolder_(chief, '_보고서인덱스');
}

function rh_loadReportIndex_() {
  const folder = rh_indexFolder_();
  if (!folder) return null;
  const raw = readFileIfExists_(folder, 'index.json');
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function rh_saveReportIndex_(list) {
  const folder = rh_indexFolder_();
  if (!folder) return;
  writeFileOverwrite_(folder, 'index.json', JSON.stringify(list), 'application/json');
}

function rh_rebuildReportIndexFull_() {
  const sheet = work_getSheet_();
  const data = sheet.getDataRange().getValues();
  const col = work_colMap_(data[0]);
  const files = [];
  for (let i = 1; i < data.length; i++) {
    const caseId = data[i][col.id];
    const folderId = data[i][col.폴더ID];
    if (!caseId || !folderId) continue;
    let caseFolder;
    try { caseFolder = DriveApp.getFolderById(folderId); } catch (err) { continue; }
    rh_collectReportFilesInFolder_(caseFolder, files, caseId, data[i][col.고객명], data[i][col.사건명]);
  }
  rh_saveReportIndex_(files);
  return files;
}

function handleListAllReports(body) {
  // [2026.09.18] body.forceRebuild가 true면 캐시를 그냥 읽지 않고 사건 폴더 전체를 다시 훑는다 —
  // rh_isReportFile_/rh_isIntakeLikeFile_ 판정 로직 자체가 바뀐 직후처럼, 기존에 이미 캐시에
  // 잘못 들어간 항목(예: 의뢰서 원문인데 보고서로 잘못 분류된 옛 항목)을 다음 야간 재구성까지
  // 기다리지 않고 바로 걷어내야 할 때 쓴다.
  let files = (body && body.forceRebuild) ? null : rh_loadReportIndex_();
  if (files === null) files = rh_rebuildReportIndexFull_();
  files.sort(function (a, b) { return b.modifiedDate - a.modifiedDate; });
  return { files: files };
}

// 템플릿다듬기: 이미 매일 밤 도는 runTemplateReview_()의 결과 파일을 그대로 읽어 보여준다
// (새 점검 로직을 또 만들지 않고 기존 야간작업을 재사용) + "지금 다시 점검" 버튼용 즉시실행.
// [2026.10.13] 템플릿다듬기 화면 — 먼저 야간 규칙 통계(토큰 0, 개선후보 보고서 templates)를 보여 주고, 예전 AI 점검 결과가 있으면 그 아래에.
function tplStatsMarkdown_(tp) {
  if (!tp || tp.error) return '## 📚 템플릿 사용 통계(야간·토큰 0)\n\n아직 통계가 없습니다' + (tp && tp.error ? ' — ' + tp.error : '') + '.\n';
  var L = ['## 📚 템플릿 사용 통계(야간 자동·AI 미사용) — ' + tp.기간 + ' 사본 ' + tp.사본수 + '건', ''];
  (tp.템플릿별 || []).forEach(function (x) {
    if (!(x.공통추가제목 || []).length && !(x.늘빈칸 || []).length) return;
    L.push('### ' + x.종류 + ' · ' + x.템플릿 + ' (사본 ' + x.사본수 + '건)');
    if ((x.공통추가제목 || []).length) L.push('- 여러 사본에 공통으로 새로 생긴 제목(템플릿에 넣을 후보): ' + x.공통추가제목.join(', '));
    if ((x.늘빈칸 || []).length) L.push('- 거의 늘 비어 있는 칸(뺄 후보): ' + x.늘빈칸.join(', '));
    L.push('');
  });
  if ((tp.새문단후보 || []).length) L.push('### 새 쟁점 문단 후보(자주 나오는데 문단 라이브러리에 없음)', tp.새문단후보.map(function (x) { return x.낱말 + '(' + x.사본 + '건)'; }).join(', '), '');
  if ((tp.문단사용 || []).length) L.push('### 쟁점 문단 사용 횟수', tp.문단사용.map(function (x) { return x.문단.replace(/\.md$/, '') + ' ' + x.사용 + '회'; }).join(', '), '');
  L.push('_매주 웹 Claude Code 루틴이 이 통계로 템플릿 수정안(PR)을 올립니다 → 깃허브에서 승인(Merge) → 설정 🐞 카드 📥 반영 시 드라이브 템플릿 갱신(드라이브에서 직접 고친 파일은 덮지 않음)._');
  return L.join('\n');
}

function handleGetLatestTemplateReview(body) {
  var statsMd = '';
  try { var rep = getImprovementReport_().report; statsMd = tplStatsMarkdown_(rep && rep.templates) + (rep && rep.generatedAt ? '\n\n_통계 생성: ' + rep.generatedAt + '_' : ''); } catch (e) {}
  const chiefFolder = getChiefManagerFolder_();
  if (!chiefFolder) return { date: null, content: statsMd || '총괄관리자 폴더가 설정되어 있지 않습니다.' };
  const folder = getOrCreateSubfolder_(chiefFolder, '_템플릿점검');
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  for (let back = 0; back < 35; back++) {
    const d = new Date(Date.now() - back * 86400000);
    const dateStr = Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
    const content = readFileIfExists_(folder, '템플릿점검_' + dateStr + '.md');
    if (content) return { date: dateStr, content: (statsMd ? statsMd + '\n\n---\n\n## 예전 AI 점검 결과(유료, 버튼으로만 실행)\n\n' : '') + content };
  }
  return { date: null, content: statsMd || '아직 점검 결과가 없습니다 — "지금 다시 점검하기"를 눌러 새로 만들 수 있습니다.' };
}

// =========================================================
// work 모듈 — 작업관리(사건별 세부업무 트리 + 법정기한 자동계산 + 캘린더 연동) (2026.08 신규)
// 사건 1행 = Cases 시트 한 줄. 하위업무는 my_ 모듈의 체크리스트/제출상태와 같은 방식으로
// 한 셀에 JSON 트리(children 배열, 깊이 제한 없음)로 저장한다.
// =========================================================
const WORK_SHEET_ID = '1JtgBpcrlThAiYHU0m74wSxZmyZPxUtmSTspZzHycZX4';

const WORK_SHEET_CASES = 'Cases';

const WORK_HEADERS = ['id', '고객ID', '고객명', '사건명', '세목', '업무유형', '담당자', '의뢰일', '기준일', '법정일', '완료전법정일', '납세자', '상태', '개요', '하위업무', '생성일', '수정일', '처리방향', '처리대상', '작업일지', '법령예규판례', '증빙목록', 'my_report_id', '폴더ID', '세액계산결과', '사건개요'];

// 시트를 열고, 처음 만드는 거면 헤더까지 써준다. 이미 있는 시트인데 WORK_HEADERS에 새 컬럼이
// 추가된 상태(예: 고객ID 신규 도입)면, 기존 데이터는 그대로 두고 빠진 헤더만 뒤에 이어붙인다
// — work_colMap_이 이름으로 컬럼을 찾으므로 위치가 중간이 아니어도 문제없다.
function work_getSheet_() {
  const ss = SpreadsheetApp.openById(WORK_SHEET_ID);
  let sheet = ss.getSheetByName(WORK_SHEET_CASES);
  if (!sheet) {
    sheet = ss.insertSheet(WORK_SHEET_CASES);
    sheet.appendRow(WORK_HEADERS);
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = WORK_HEADERS.filter(function (h) { return existingHeaders.indexOf(h) === -1; });
  if (missing.length > 0) {
    sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function work_colMap_(headers) {
  const map = {};
  WORK_HEADERS.forEach(function (name) { map[name] = headers.indexOf(name); });
  return map;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function caseIsFiledReturnFolder_(name) { return /^\s*양도\s*코리아\s*$/.test(String(name || '')); }

// ============================================================
// [2026.10.09] 개선 후보 보고서 — 세무사님 지시: "사용하면서 고치는 작업"을 자동(주1회)·수동 모두로.
// ① 수집·정리는 job이 매일 밤(토큰 0): 오류기록·유료AI 질문기록·자가점검·화면 속도를 7일치 모아 같은 것끼리 묶고 횟수를 센다.
// ② 대시보드 "야간 자동작업"·설정 🐞 카드에 "개선 후보 N건"으로 보인다.
// ③④ 분석·수정은 Claude Code(세무사님 PC, 구독요금): 매주 월요일 예약작업이 이 보고서를 읽어 수정안을 준비하고,
//    세무사님이 "진행"하면 고쳐서 실제 확인 후 반영한다(운영 반영 전 사람 확인 — 자동 수정은 하지 않음).
//    수동은 언제든 Claude Code에게 "개선 후보 처리해줘". 읽는 도구: NETAX_Job/tools/improve-report.js
//    [갱신] 실제 운영 흐름은 웹 Claude Code 루틴(trig_01K6EHE36YV1H7sAUsNzguY3, 매주 월 08시·AI탭 🛠) → 깃허브 PR → 승인 → 📥(gh_deployApply_).
// 시험 중 생긴 기록("[점검 중", "zz_", "[시험]")은 빼고 센다.
// ============================================================
const IMPROVE_REPORT_NAME_ = '_개선후보.json';

function improve_reportFile_() {
  const folder = ai_convFolder_();
  const it = folder.getFilesByName(IMPROVE_REPORT_NAME_);
  return it.hasNext() ? it.next() : folder.createFile(IMPROVE_REPORT_NAME_, '{}', 'application/json');
}

function getImprovementReport_() {
  let report = null;
  try { report = JSON.parse(improve_reportFile_().getBlob().getDataAsString('UTF-8') || 'null'); } catch (e) { report = null; }
  if (report && !report.generatedAt) report = null;
  return { success: true, report: report };
}
