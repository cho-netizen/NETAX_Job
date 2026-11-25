// 자동 생성 파일 — 직접 고치지 말 것. 원본: gs-backend/*.js, 생성: tools/build-light.js
// 조회 시작점: bankParseRows_, bankReadFile_, bankFindHeader_, bankCell_, bankHdrKey_, bankDecodeBlob_, bankHtmlRows_, BANK_COL_, tc_docText_, docBankStmtParse_, docPassbookParse_, tcZipName_, tcInflateRaw_, tcTmpMeta_, work_getSheet_, work_colMap_, work_values_, work_findCaseRow_, work_readRow_, getBusinessManagerFolder_, jsonResponse, WORK_SHEET_ID
// 포함한 최상위 선언 96개 (시트 쓰기가 들어 있는 것: getOrCreateSubfolder_, work_getSheet_, ocrFileText_, tcOcrStoreFolder_, tcOcrBlob_, tcBlobText_, tcPptxText_, tc_docText_, bankReadFile_)

// ============================================================
// CaseLedger.js — 사건 장부: 사건의 모든 사실을 적는 단일 저장소 [2026.10.28 신설]
// ------------------------------------------------------------
// 세무사님 원문(10-28): "확보할 수 있는 정보를 최대한 확보하고, 확보된 정보를 최대한 활용해서 사건처리를 하자는 것이고,
//   부족한 정보는 물어보거나 확보할 증빙으로 분류하자는 거 아닌가? 확인되지 않은 정보중에 추정치나 가정치를 넣어서 진행할 수도 있고 말야."
// 세무사님 원문(10-19): "변수담당은 ai이고 상수담당은 gas라고 생각하자."
// 세무사님 원문(10-15): 수집·반영·소통 3대 약점 → "사실 장부·칸 연결·한곳에서 묻기" 구조 — 그동안 만들지 않고 저장소 7곳(trCalc·trAns·filled·remaining·decisions·valueHist·사건개요)에
//   땜질만 하다 10-28 김향숙 사건(물건 1건·서류 7장)이 실패("그걸 알면서도 안 만들었다고?"). 이 파일이 그 장부다.
//
// 구조 — 계산기 칸 하나 = 장부 한 줄. 칸 경로는 세액계산기 입력 경로 그대로(서식이 기준):
//   seller.name · seller.regNo · seller.address · seller.multiHouseCount · seller.isTransferorResident
//   c0.date · c0.totalPrice · c0.transferCause · c0.buyer.name · c0.buyer.regNo · c0.buyer.relation   (c1·c2… 계약이 여럿일 때)
//   a0.assetLocation · a0.assetKind · a0.assetType · a0.assetDong · a0.assetHo · a0.assetArea · a0.acquisitionDate · a0.acquisitionPrice · a0.contract(이 자산이 걸린 계약 c0…)
//   a0.isOneHouseOneFamily · a0.isNonBusinessLand · a0.isUnregisteredTransfer · a0.acquisitionStandardPriceForExpense · a0.transferStandardPriceForConversion …(계산기 자산 카드 칸 전부)
//   costs({acq:[{label,amount,file,date}], tr:[…]}) · taxfee · 사건분류 · 기준일
//   doc:<파일 이름>.role — 서류의 역할(양도계약서·취득계약서·등기부·전소유자 분양계약서·영수증·간편계산서·기타): 사건 뼈대. 넥스가 읽어 정하고, 애매하면 물어볼 것으로.
// 줄: { v, label, src:{kind, who, file, page, quote}, sure, state, ask, cands, at, hist[] }
//   src.kind: 세무사님 | 넥스 | 서류 | 규칙 | 추정 | 계산      sure: 확실 | 애매 | 모름
//   state: 확정 | 추정 | 물어볼것 | 증빙받을것 | 보류 | 무시
// 쓰는 길 하나(ledgerSet_) — 규칙:
//   ① 세무사님이 정한 값은 아무도 덮지 않는다(넥스는 "지금 값·서류 값"만 말씀드린다). 세무사님만 바꾼다.
//   ② 넥스가 정한 값은 세무사님·넥스만 바꾼다(서류·규칙 결과가 뒤에 와도 덮지 않는다).
//   ③ 서류·규칙 값은 더 확실한 서류·규칙, 넥스, 세무사님이 덮는다.
//   ④ 서류·규칙이 "애매·모름"이면 값을 정하지 않고 후보와 함께 "물어볼것"으로 선다 — 혼자 정하지 않는다(10-18 "불확실하면 소통으로 보완").
//   ⑤ 고르기 칸(과세대상 구분·양수인 관계·자산 종류·양도 원인·주택 수·예/아니오)은 코드값만 받는다. 글은 코드로 바꾸고, 못 바꾸면 거절(10-27 긴급 "주택(주거용 오피스텔)" 글이 들어가 세액 0원).
//   ⑥ 값이 들어오면 그 칸의 "물어볼것·증빙받을것"은 그 자리에서 풀린다(질문 목록이 따로 없으니 어긋날 수 없다).
//   ⑦ 추정은 상태 "추정"으로 넣고 계산을 돌린다. 검토서 "추가로 확인할 사항"에 추정·증빙받을것·보류 줄이 그대로 들어간다.
// 읽는 길 하나 — 계산기 상태(ledgerCalcState_)·질문 목록(ledgerQuestions_)·검토서 메모(ledgerReviewNotes_)·화면 표(ledgerView_)는 전부 장부에서 뽑는다.
// 저장: 총괄관리자\_사건장부\<사건ID>.json (잠금 안에서 읽고-고치고-쓴다). 옛 저장소는 ledgerImportLegacy_로 한 번 옮겨 오고 그 뒤엔 보지 않는다.
// ============================================================

var LEDGER_FOLDER_ = '_사건장부';

function ledgerFolder_() {
  const root = getChiefManagerFolder_();
  if (!root) throw new Error('총괄관리자 폴더가 설정되어 있지 않습니다');
  return getOrCreateSubfolder_(root, LEDGER_FOLDER_);
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

// =========================================================
// work 모듈 — 작업관리(사건별 세부업무 트리 + 법정기한 자동계산 + 캘린더 연동) (2026.08 신규)
// 사건 1행 = Cases 시트 한 줄. 하위업무는 my_ 모듈의 체크리스트/제출상태와 같은 방식으로
// 한 셀에 JSON 트리(children 배열, 깊이 제한 없음)로 저장한다.
// =========================================================
const WORK_SHEET_ID = '1JtgBpcrlThAiYHU0m74wSxZmyZPxUtmSTspZzHycZX4';

const WORK_SHEET_CASES = 'Cases';

const WORK_HEADERS = ['id', '고객ID', '고객명', '사건명', '세목', '업무유형', '담당자', '의뢰일', '기준일', '법정일', '완료전법정일', '납세자', '상태', '개요', '하위업무', '생성일', '수정일', '처리방향', '처리대상', '작업일지', '법령예규판례', '증빙목록', 'my_report_id', '폴더ID', '세액계산결과', '사건개요'];

// [2026.09.16 신규] casehandling.html의 TAXPAYER_NAME_FIELD_BY_SEMOK_(클라이언트 쪽 상수)와
// 반드시 같은 값을 유지해야 하는 서버쪽 짝 — work_createCase가 새 사건을 만들 때도 납세자를
// 사건개요의 납세의무자 이름 필드에 미리 채워 넣기 위해 서버(Code.js)에서도 이 매핑이
// 필요하다(클라이언트 JS 상수는 서버 코드에서 참조할 수 없음). 한쪽만 고치고 잊어버리기
// 쉬우니 casehandling.html의 원본을 고칠 때 여기도 같이 고칠 것.
// [2026.09.23 버그수정] '사업' 세목의 사건개요(CH_CASE_OVERVIEW_FIELDS_.business)가 나중에
// (2026.09.19) 새로 생기면서 이 매핑에 business를 추가하는 걸 놓쳤다 — 그래서 사업 사건은
// 작업관리 납세자를 아무리 입력해도 처리개요의 "납세자(대표) 성명"(bizTaxpayerName)에
// 전혀 반영되지 않았다. casehandling.html의 TAXPAYER_NAME_FIELD_BY_SEMOK_도 같이 고칠 것.
// [2026.10.30] 불복 사건개요서(casehandling.html CH_CASE_OVERVIEW_FIELDS_.objection) — 청구인(납세자) 성명도 작업관리 납세자와 맞춘다
const WORK_TAXPAYER_FIELD_BY_SEMOK_ = { transfer: 'trTransferorName', gift: 'giftDoneeName', inheritance: 'ihDeceasedName', business: 'bizTaxpayerName', objection: 'objTaxpayerName' };

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

function work_dateStr_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

// [2026.09.23 신규] work_readRow_와 work_computeCanonicalCaseFolderNames_(폴더명 점검 도구)가
// 똑같이 필요로 하던 "납세자↔사건개요 중 비어있는 쪽을 채운다" 로직을 한 곳으로 뽑았다 —
// 두 곳에 따로 복사해두면 한쪽만 고치고 잊어버리는 사고가 재발하기 쉽다(이번에 실제로 그런
// 사고가 날 뻔해서 여기로 합침). caseOverview는 그 자리에서 직접 고쳐 쓰고(mutate), 반환값은
// 화면에 보여줄 최종 납세자 문자열이다.
function work_resolveTaxpayer_(seMok, rawTaxpayer, caseOverview) {
  const taxpayerField = WORK_TAXPAYER_FIELD_BY_SEMOK_[seMok];
  let taxpayer = String(rawTaxpayer || '').trim();
  if (taxpayerField && caseOverview && typeof caseOverview === 'object') {
    const overviewVal = String(caseOverview[taxpayerField] || '').trim();
    if (!overviewVal && taxpayer) caseOverview[taxpayerField] = taxpayer;
    else if (overviewVal && !taxpayer) taxpayer = overviewVal;
  }
  return taxpayer;
}

var WORK_CALC_BODY_MEMO_ = {};

function work_calcBodyFile_(caseId, create) {
  const folder = ledgerFolder_();
  const name = String(caseId).replace(/[^\w-]/g, '_') + '.계산저장본.json';
  const it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(name, '{}', 'application/json') : null;
}

function work_calcBodyRead_(caseId, fresh) {
  const k = String(caseId || '');
  if (!fresh && WORK_CALC_BODY_MEMO_[k]) return WORK_CALC_BODY_MEMO_[k];
  const f = work_calcBodyFile_(caseId, false);
  const m = f ? (JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}') || {}) : {};
  WORK_CALC_BODY_MEMO_[k] = m;
  return m;
}

// 칸에서 읽은 목록에 파일의 본문을 다시 붙인다 — 파일을 못 읽으면 목록만(세액·이름은 칸에 있음)
function work_calcHydrate_(caseId, list) {
  if (!caseId || !list.some(function (e) { return e && e.본문 === '파일'; })) return list;
  let m;
  try { m = work_calcBodyRead_(caseId, false); } catch (e) { console.error('계산 저장본 본문 파일을 못 읽음(목록만): ' + (e && e.message || e)); return list; }
  return list.map(function (e) {
    if (!e || e.본문 !== '파일' || !m[e.id]) return e;
    const o = Object.assign({}, e, m[e.id]); delete o.본문; return o;
  });
}

function work_readRow_(col, rowValues) {
  let subtasks = [];
  try { subtasks = JSON.parse(rowValues[col.하위업무] || '[]'); } catch (e) { subtasks = []; }
  if (!Array.isArray(subtasks)) subtasks = [];
  let workLog = [];
  try { workLog = JSON.parse(rowValues[col.작업일지] || '[]'); } catch (e) { workLog = []; }
  if (!Array.isArray(workLog)) workLog = [];
  let precedents = [];
  try { precedents = JSON.parse(rowValues[col.법령예규판례] || '[]'); } catch (e) { precedents = []; }
  if (!Array.isArray(precedents)) precedents = [];
  let evidenceList = [];
  try { evidenceList = JSON.parse(rowValues[col.증빙목록] || '[]'); } catch (e) { evidenceList = []; }
  if (!Array.isArray(evidenceList)) evidenceList = [];
  let taxCalcResults = [];
  try { taxCalcResults = JSON.parse(rowValues[col.세액계산결과] || '[]'); } catch (e) { taxCalcResults = []; }
  if (!Array.isArray(taxCalcResults)) taxCalcResults = [];
  taxCalcResults = work_calcHydrate_(rowValues[col.id], taxCalcResults);
  let caseOverview = {};
  try { caseOverview = JSON.parse(rowValues[col.사건개요] || '{}'); } catch (e) { caseOverview = {}; }
  if (!caseOverview || typeof caseOverview !== 'object' || Array.isArray(caseOverview)) caseOverview = {};
  // [2026.09.23 버그수정] 세무사님 지적 — 작업관리에 이미 입력된 납세자가 처리개요(사건개요)의
  // 납세의무자 이름 필드에 반영 안 되는 사건들이 있었다. 기존 동기화(work_updateCase 저장
  // 시점에 클라이언트가 양쪽을 맞춤)는 "그 이후에 다시 저장"해야만 걸리는 저장-트리거 방식이라,
  // 이미 등록된 사건은 재저장 전까지 계속 빈칸으로 남는다(게다가 '사업' 세목은 매핑 자체가
  // 최근까지 빠져 있어 저장해도 안 걸렸다 — 위 WORK_TAXPAYER_FIELD_BY_SEMOK_ 수정 참고).
  // 이 함수는 모든 화면(작업관리·처리개요·메모·세액계산·AI도구)이 사건을 읽을 때 항상 거치므로,
  // 여기서 한 번만 "둘 중 비어있는 쪽을 채워서 돌려준다"를 적용하면 과거 사건도 재저장 없이
  // 즉시 반영된다(시트 자체를 고쳐쓰지는 않음 — 다음 실제 저장 때 정식 반영).
  // [2026.09.23 추가] "전수조사" 지시로 재점검 — 처음엔 사건개요→납세자 방향만 채웠는데,
  // 반대(사건개요는 비어있고 납세자에만 값이 있는 경우)도 똑같이 안 채워지는 건 대칭이 아니다.
  // 상속처럼 "의뢰인=상속인, 납세자=피상속인"이 원래 다른 게 정상인 세목도 있으므로(workmanage.html
  // 주석 참고), 둘 다 값이 있는데 서로 다르면 절대 손대지 않는다 — 오직 한쪽이 완전히 빈 경우만 채운다.
  // [2026.09.23 재수정] 이 자기치유 로직을 work_computeCanonicalCaseFolderNames_(폴더명 점검
  // 도구)가 그대로 베껴 쓰지 않고 시트 원본만 읽고 있어서, 그 도구가 제안하는 사건명이 다른
  // 화면들이 보여주는 납세자와 어긋날 뻔했다 — work_resolveTaxpayer_로 뽑아내 두 곳이 항상
  // 같은 로직을 쓰게 한다(따로 복사해두면 또 갈라질 위험이 있으므로).
  const taxpayerForRead_ = work_resolveTaxpayer_(rowValues[col.세목], rowValues[col.납세자], caseOverview);
  return {
    id: rowValues[col.id],
    고객ID: rowValues[col.고객ID],
    // [2026.09 버그수정] "3733"처럼 숫자로만 된 고객명/납세자는 구글시트가 진짜 숫자로 저장
    // 해버릴 수 있다 — 문자열로 강제하지 않으면 화면 쪽에서 .replace() 등 문자열 메서드를
    // 호출할 때 예외가 나서, 그 사건이 목록에 섞여있는 것만으로 화면 전체(목록 재렌더링→
    // 상세보기)가 조용히 멈추는 심각한 문제로 이어졌다.
    고객명: String(rowValues[col.고객명] || ''),
    사건명: rowValues[col.사건명],
    세목: rowValues[col.세목],
    업무유형: rowValues[col.업무유형],
    담당자: rowValues[col.담당자],
    의뢰일: work_dateStr_(rowValues[col.의뢰일]),
    기준일: work_dateStr_(rowValues[col.기준일]),
    법정일: work_dateStr_(rowValues[col.법정일]),
    납세자: taxpayerForRead_,
    상태: rowValues[col.상태],
    완료전법정일: work_dateStr_(rowValues[col.완료전법정일]),
    개요: rowValues[col.개요],
    처리방향: rowValues[col.처리방향],
    처리대상: rowValues[col.처리대상],
    하위업무: subtasks,
    작업일지: workLog,
    법령예규판례: precedents,
    증빙목록: evidenceList,
    세액계산결과: taxCalcResults,
    사건개요: caseOverview,
    my_report_id: rowValues[col.my_report_id],
    폴더ID: rowValues[col.폴더ID],
    생성일: rowValues[col.생성일],
    수정일: rowValues[col.수정일]
  };
}

// [2026.10.23 속도 ㅅ6차] 작업관리 시트 통째 읽기 — 사건처리 한 실행 안에서 한 번만. ③ 한 번에 머리글 읽기·행 찾기·갱신으로 시트 전체(수백 행 × 긴 JSON 칸)를 5~8번 읽어
//  (한 번에 2~4초) 칸 조립 26초의 큰 몫이었다. 사건처리 실행(caseProcTimed_)·양도 사실 정리 안에서만 켜고(CP_SHEET_MEMO_ON_), 갱신(work_updateCase)은 같은 행 배열을 제자리에서 고치므로 메모가 따라온다.
//  사건을 새로 만들거나 행을 지우면 메모를 버린다. 다른 화면 호출(사건 목록·고객 등)은 예전처럼 매번 읽는다.
var CP_SHEET_MEMO_ON_ = false, WORK_DATA_MEMO_ = null;

function work_values_(sheet) {
  if (!CP_SHEET_MEMO_ON_) return sheet.getDataRange().getValues();
  const sid = sheet.getSheetId();
  if (WORK_DATA_MEMO_ && WORK_DATA_MEMO_.sid === sid) return WORK_DATA_MEMO_.values;
  const v = sheet.getDataRange().getValues();
  WORK_DATA_MEMO_ = { sid: sid, values: v };
  return v;
}

function work_findCaseRow_(sheet, col, caseId) {
  const data = work_values_(sheet);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.id]).trim() === String(caseId).trim()) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// [2026.10.09] 구글 드라이브 무료 글자인식(OCR) — 이미지·PDF를 구글 문서로 복사하면 드라이브가 글자를 읽어준다.
// AI 비용 0원. 임시 문서는 읽자마자 휴지통으로 보낸다.
// [2026.10.16] 변환용 임시 사본을 둘 곳 — 업무관리자 "_글자인식기억" 폴더(실행이 끊겨 못 지워도 고객 사건 폴더에 남지 않게). 못 찾으면 빈 값(예전처럼 원본 옆).
function tcTmpMeta_(meta) { try { const fo = tcOcrStoreFolder_(); if (fo) meta.parents = [fo.getId()]; } catch (e) {} return meta; }

function ocrFileText_(fileId, tblKey) {
  // [2026.10.16] 임시 문서는 고객 사건 폴더가 아니라 업무관리자 "_글자인식기억" 폴더에 만든다 — 실행 시간 초과로 지우기 전에 끊기면
  //  고객 폴더에 "_ocr_tmp_….gdoc"가 남았다(고객X 사건). 기억 폴더를 못 찾으면 예전처럼 원본 옆에.
  let copy = null;
  try { copy = Drive.Files.copy(tcTmpMeta_({ name: '_ocr_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.document' }), fileId, { ocrLanguage: 'ko', fields: 'id' }); }
  catch (e0) {
    // [2026.10.19 3번 읽기 — 확보율 재측정 "읽기 실패"] 드라이브 글자인식이 거절한 파일:
    //  ① 너무 큰 사진(13MB 휴대폰 사진 "Request Too Large" — 고객Q 고객Q 관계인1.jpg)·변환 안 되는 그림 형식(webp) → 드라이브가 만든 축소본(2400px)으로 읽음(일괄 안에서만)
    //  ② 암호 걸린 PDF("Bad Request" — 고객AG 사망보험금 지급증명서는 비밀번호 없이는 안 열림) → 이유를 알아볼 수 있게 바꿔 던짐(비밀번호를 풀어 다시 받아야 함)
    const em = String(e0 && e0.message || e0);
    let mt0 = ''; try { mt0 = String(DriveApp.getFileById(fileId).getMimeType() || ''); } catch (e1) {}
    if (TC_BATCH_READ_ && /^image\//.test(mt0) && /Too Large|not supported|conversion/i.test(em)) {
      const th = tcThumbBytes_(fileId, 2400), tb2 = [];
      for (let k = 0; k < th.length; k++) tb2.push(th[k] > 127 ? th[k] - 256 : th[k]);
      return String(tcOcrBlob_(Utilities.newBlob(tb2, th[0] === 0x89 ? 'image/png' : 'image/jpeg', 'img')) || '');
    }
    if (/pdf/.test(mt0) && /Bad Request/i.test(em)) {
      let enc = false; try { const s0 = DriveApp.getFileById(fileId).getBlob().getDataAsString('ISO-8859-1'); enc = /\/Encrypt\s/.test(s0.slice(-4000)) || /\/Encrypt\s/.test(s0.slice(0, 4000)); } catch (e2) {}
      if (enc) throw new Error('암호 걸린 PDF — 비밀번호를 풀어 다시 올려 주셔야 읽을 수 있음(' + em.slice(0, 60) + ')');
    }
    throw e0;
  }
  try {
    const body = DocumentApp.openById(copy.id).getBody();
    // [2026.10.18 3번 세션 실험③] 드라이브는 글자층 PDF·워드를 바꿀 때 표(TABLE)를 만든다 — getText()는 칸마다 줄을 바꿔 줄·칸 연결이 사라진다
    //  (고객A 임대명세서: 층·호·면적·상호·사업자번호·보증금·월세가 한 줄씩 흩어짐). 같은 변환에서 칸 자리 지킨 표 글도 기억(ocrtbl1_)에 남긴다.
    //  메모 글(getText)은 그대로라 기존 정리 규칙 영향 없음. 칸 자리가 필요한 쪽은 tcDocTableText_로 받는다
    if (tblKey) { try { const tb = tcDocTableAware_(body); tcOcrStorePut_(tblKey, tb.tables ? tb.text : ''); } catch (e) {} }
    const got = body.getText();
    // [2026.10.19 3번 읽기 — 확보율 재측정] 글자가 모양(그림)으로만 찍힌 PDF — "Microsoft Print to PDF"로 저장한 웹 화면(국세법령정보 예규 등)은 글꼴은 있는데
    //  글자 표가 깨져 드라이브가 그 깨진 글자층을 그대로 써서 0자가 된다(개발용 22개 — 고객BD 관련예규 9·고객I 5·고객AF 4). 서버는 PDF를 그림으로 못 그리므로
    //  드라이브가 만든 첫 쪽 그림(축소본 2400px)을 글자인식(0원)한다 — 첫 쪽만이라 표시를 붙임. 일괄 안에서만(사이드바는 느려지지 않게)
    //  쪽당 글자로 본다 — 깨진 글자층에서 몇십 자만 건지는 것(고객AD 질의회신 20여 개, 2~5쪽에 46~120자)도 같은 경우라 쪽당 30자 미만이면
    const gotN = String(got || '').replace(/[^가-힣0-9]/g, '').length;
    let lowPdf = false;
    if (TC_BATCH_READ_ && gotN < 150) {
      try {
        const df0 = DriveApp.getFileById(fileId);
        if (/pdf/.test(String(df0.getMimeType() || ''))) { const np = (df0.getBlob().getDataAsString('ISO-8859-1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length || 1; lowPdf = gotN < 30 || gotN / np < 30; }
      } catch (e) {}
    }
    if (lowPdf) {
      try {
        {
          const th = tcThumbBytes_(fileId, 2400), tb2 = [];
          for (let k = 0; k < th.length; k++) tb2.push(th[k] > 127 ? th[k] - 256 : th[k]);
          const tt = String(tcOcrBlob_(Utilities.newBlob(tb2, th[0] === 0x89 ? 'image/png' : 'image/jpeg', 'p1')) || '').trim();
          if (tt.replace(/[^가-힣0-9]/g, '').length >= 30) return String(got || '') + '\n[1쪽 — 글자가 그림 모양으로만 찍힌 PDF라 드라이브가 그린 첫 쪽 그림으로 읽음, 뒷쪽은 못 읽음]\n' + tt;
        }
      } catch (e) {}
    }
    return got;
  } finally {
    try { DriveApp.getFileById(copy.id).setTrashed(true); } catch (e) { /* 정리 실패는 무시 */ }
  }
}

// [2026.10.15 일괄점검 ①] 글자인식 결과 영구 기억 — 6시간 캐시만으로는 서류 200개짜리 사건을 매번 처음부터 다시 읽어야 해서(한 건 10~40초)
//  폴더 서류를 다 읽지 못하고 잘랐다. 업무관리자 폴더의 "_글자인식기억"에 파일ID+수정시각 이름으로 글자를 남겨 두고 다음부터 그대로 쓴다(토큰 0).
function tcOcrStoreFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('OCR_STORE_FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const bm = getBusinessManagerFolder_();
  if (!bm) return null;
  const it = bm.getFoldersByName('_글자인식기억');
  const f = it.hasNext() ? it.next() : bm.createFolder('_글자인식기억');
  props.setProperty('OCR_STORE_FOLDER_ID', f.getId());
  return f;
}

function tcOcrStoreGet_(key) {
  try { const fo = tcOcrStoreFolder_(); if (!fo) return null; const it = fo.getFilesByName(key + '.txt'); return it.hasNext() ? it.next().getBlob().getDataAsString('UTF-8') : null; } catch (e) { return null; }
}

function tcOcrStorePut_(key, text) {
  try { const fo = tcOcrStoreFolder_(); if (fo && !fo.getFilesByName(key + '.txt').hasNext()) fo.createFile(key + '.txt', String(text || ''), 'text/plain'); } catch (e) {}
}

// [2026.10.18 3번 세션 — 읽기] 이미 있는 기억 글을 고쳐 쓴다(그림 쪽 글자인식 보충) — 없으면 새로 만든다. 6시간 캐시도 지운다
function tcOcrStoreSet_(key, text) {
  try {
    const fo = tcOcrStoreFolder_(); if (!fo) return;
    const it = fo.getFilesByName(key + '.txt'); let any = false;
    while (it.hasNext()) { it.next().setContent(String(text || '')); any = true; } // 같은 이름이 둘 이상이면(동시 쓰기) 모두 — 어느 것을 읽어도 같게
    if (!any) fo.createFile(key + '.txt', String(text || ''), 'text/plain');
    try { CacheService.getScriptCache().remove(key); } catch (e) {}
  } catch (e) {}
}

var OCRB_TRANSIENT_RE_ = /rate limit|too many|Rate Limit|Backend Error|Internal Error|서버 오류|Service invoked too many|timed out|시간 초과|Bad Gateway|Service Unavailable|503|500 /;

// =========================================================
// [2026.10.18 3번 세션 — 읽기] 글자층 PDF 속 스캔 그림 쪽 글자인식 보충.
//  드라이브는 글자가 든 PDF를 문서로 바꿀 때 글자층만 쓰고 그림 쪽은 글자인식을 하지 않는다 — 인터넷 발급 등기부 뒤에 신탁원부 스캔 20쪽을 붙인
//  고객U 「등기부등본_인덕원센트럴푸르지오.pdf」(30쪽)가 1~9쪽만 읽히고 10~29쪽은 쪽 번호("10/30")만 남았다.
//  PDF를 직접 풀어(순수 JavaScript, 압축 풀기는 hwp 읽개의 tcInflateRaw_) 쪽마다 글자 그리기 명령 수와 큰 그림을 세고,
//  글자가 거의 없고(쪽 번호 정도) 큰 그림(JPEG·팩스·압축 그림)이 있는 쪽만 그 그림을 꺼내 따로 글자인식해 글 끝에 "[N쪽 그림 쪽 글자인식]" 머리와 함께 붙인다(이미 기억된 글의 자리는 그대로).
//  모든 쪽이 그림뿐인 스캔 PDF는 드라이브가 이미 글자인식하므로 건드리지 않는다. 토큰 0.
// =========================================================
var TC_PDF_IMG_MARK_ = '[그림 쪽 글자인식]', TC_PDF_IMG_LEFT_ = '[⚠ 그림 쪽 글자인식 남음';

// PDF 값 읽개 — 사전 {D:{}}, 배열 [], 이름 {N:''}, 참조 {R:번호}, 글자 {S:''}, 숫자·참거짓·null
function tcPdfTok_(s, p) {
  const n = s.length;
  const ws = function () {
    for (;;) {
      while (p < n && /[\s\0]/.test(s[p])) p++;
      if (s[p] === '%') { while (p < n && s[p] !== '\n' && s[p] !== '\r') p++; } else return;
    }
  };
  const delim = /[\s\0\/\[\]<>(){}%]/;
  const val = function () {
    ws();
    const c = s[p];
    if (c === '<' && s[p + 1] === '<') {
      p += 2; const d = {};
      for (;;) { ws(); if (s[p] === '>' && s[p + 1] === '>') { p += 2; return { D: d }; } if (p >= n) return { D: d }; const k = val(); const v = val(); if (k && k.N !== undefined) d[k.N] = v; }
    }
    if (c === '[') { p++; const a = []; for (;;) { ws(); if (s[p] === ']') { p++; return a; } if (p >= n) return a; a.push(val()); } }
    if (c === '<') { const e = s.indexOf('>', p); const h = s.slice(p + 1, e).replace(/\s/g, ''); p = e + 1; let t = ''; for (let i = 0; i < h.length; i += 2) t += String.fromCharCode(parseInt((h.substr(i, 2) + '0').slice(0, 2), 16)); return { S: t }; }
    if (c === '(') { let dep = 0, t = ''; p++; while (p < n) { const ch = s[p++]; if (ch === '\\') { t += s[p++] || ''; continue; } if (ch === '(') dep++; else if (ch === ')') { if (!dep) break; dep--; } t += ch; } return { S: t }; }
    if (c === '/') { let e = p + 1; while (e < n && !delim.test(s[e])) e++; const nm = s.slice(p + 1, e); p = e; return { N: nm }; }
    if (c === ']' || c === '>' || c === ')' || c === '}') { p++; return null; }
    let e = p; while (e < n && !delim.test(s[e])) e++;
    const w = s.slice(p, e); p = e;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      if (/^\d+$/.test(w)) { const m = /^\s+(\d+)\s+R(?=[\s\0\/\[\]<>()%]|$)/.exec(s.slice(p, p + 24)); if (m) { p += m[0].length; return { R: Number(w) }; } }
      return Number(w);
    }
    if (w === 'true') return true; if (w === 'false') return false;
    if (!w) p++;
    return null;
  };
  const v = val();
  return { v: v, p: p };
}

// Uint8Array → 한 글자 = 한 바이트인 글(정규식으로 PDF 구조를 찾기 위해)
function tcBytesLatin1_(u) { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, Math.min(u.length, i + 8192))); return s; }

// PDF를 열어 쪽마다 {p, textOps, imgs:[{w,h,filter,start,len}]} — 못 열면 null(암호 PDF는 내용 흐름이 암호화돼 글자 명령을 못 셈 → null)
function tcPdfPages_(u, s0) {
  const s = s0 || tcBytesLatin1_(u);
  if (/\/Encrypt\s/.test(s.slice(-4096)) || /trailer[\s\S]{0,400}\/Encrypt/.test(s)) return null;
  const objs = {}, re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const r = tcPdfTok_(s, m.index + m[0].length), o = { v: r.v };
    let q = r.p; while (q < s.length && /[\s\0]/.test(s[q])) q++;
    if (s.substr(q, 6) === 'stream') {
      q += 6; if (s[q] === '\r') q++; if (s[q] === '\n') q++;
      const L = r.v && r.v.D && r.v.D.Length;
      let end = typeof L === 'number' && s.substr(q + L, 40).indexOf('endstream') !== -1 ? q + L : s.indexOf('endstream', q);
      if (end < 0) end = s.length;
      o.start = q; o.len = end - q;
      if (typeof L !== 'number') { while (o.len > 0 && /[\r\n]/.test(s[q + o.len - 1])) o.len--; }
      re.lastIndex = end;
    } else re.lastIndex = Math.max(re.lastIndex, r.p);
    objs[m[1]] = o;
  }
  const get = function (v) { let k = 0; while (v && v.R !== undefined && k++ < 20) { const o = objs[v.R]; v = o ? o.v : null; } return v; };
  const nm = function (v) { v = get(v); return v && v.N !== undefined ? v.N : (Array.isArray(v) ? v.map(nm).join(',') : ''); };
  const decode = function (o) {
    const f = nm(o.v.D.Filter), raw = u.subarray(o.start, o.start + o.len);
    if (!f) return raw;
    if (f === 'FlateDecode') return tcInflateRaw_(raw.subarray(2));
    return null;
  };
  // 압축된 객체 묶음(ObjStm) — 바로 적힌 객체가 없는 번호만 채운다
  Object.keys(objs).forEach(function (k) {
    const o = objs[k]; if (!o.v || !o.v.D || nm(o.v.D.Type) !== 'ObjStm' || o.start === undefined) return;
    let d; try { d = decode(o); } catch (e) { d = null; } if (!d) return;
    const t = tcBytesLatin1_(d), N = get(o.v.D.N), first = get(o.v.D.First);
    const hd = t.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < N; i++) { const num = hd[2 * i], off = hd[2 * i + 1]; if (objs[num]) continue; try { objs[num] = { v: tcPdfTok_(t, first + off).v }; } catch (e) {} }
  });
  let root = null; { const rs = s.match(/\/Root\s+(\d+)\s+\d+\s+R/g) || []; for (let i = rs.length - 1; i >= 0 && !root; i--) { const rv = get({ R: Number(/(\d+)/.exec(rs[i])[1]) }); if (rv && rv.D && rv.D.Pages) root = rv; } }
  if (!root) return null;
  const pages = [];
  const content = function (c) {
    const cv = get(c), parts = Array.isArray(cv) ? cv : [c]; let out = ''; // 참조 하나(흐름 객체)는 참조 그대로, 참조가 배열을 가리키면 그 배열
    parts.forEach(function (x) { const o = x && x.R !== undefined ? objs[x.R] : null; if (!o || o.start === undefined) return; let d = null; try { d = decode(o); } catch (e) {} if (d) out += tcBytesLatin1_(d) + '\n'; });
    return out;
  };
  // 좌표 변환(cm) 곱 — 그림이 쪽에 그려질 때의 방향·크기(스캔 그림은 옆으로 누운 채 저장되고 cm으로 돌려 그리는 일이 흔함)
  const mul = function (m, n) { return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]]; };
  const scan = function (cs, res, pg, depth, ctm0) {
    pg.textOps += (cs.match(/(?:\)|>|\])\s*(?:T[Jj]|'|")/g) || []).length;
    const rr = get(res), xo = rr && rr.D ? get(rr.D.XObject) : null;
    const re2 = /\/([^\s\/\[\]<>()]+)\s+Do\b|(?<![\w.#])([-+]?(?:\d+\.?\d*|\.\d+))(?=[\s\[\]\/<>()]|$)|\b(q|Q|cm|BT|ET)\b/g; let mm, nums = [], ctm = ctm0, stack = [], inText = false;
    while ((mm = re2.exec(cs))) {
      if (mm[2] !== undefined) { if (!inText) { nums.push(Number(mm[2])); if (nums.length > 6) nums.shift(); } continue; }
      if (mm[3]) {
        if (mm[3] === 'BT') inText = true; else if (mm[3] === 'ET') inText = false;
        else if (mm[3] === 'q') stack.push(ctm); else if (mm[3] === 'Q') ctm = stack.pop() || ctm0;
        else if (mm[3] === 'cm' && nums.length === 6) ctm = mul(nums, ctm);
        nums = []; continue;
      }
      nums = [];
      const ref = xo && xo.D ? xo.D[mm[1]] : null, o = ref && ref.R !== undefined ? objs[ref.R] : null;
      if (!o || !o.v || !o.v.D) continue;
      const st = nm(o.v.D.Subtype);
      if (st === 'Image') pg.imgs.push({ w: get(o.v.D.Width) || 0, h: get(o.v.D.Height) || 0, filter: nm(o.v.D.Filter), start: o.start, len: o.len, ctm: ctm, d: o.v.D });
      else if (st === 'Form' && depth < 3) { let d = null; try { d = decode(o); } catch (e) {} const fm = get(o.v.D.Matrix); if (d) scan(tcBytesLatin1_(d), o.v.D.Resources || res, pg, depth + 1, Array.isArray(fm) && fm.length === 6 ? mul(fm.map(get), ctm) : ctm); }
    }
  };
  const walk = function (node, res, depth, box) {
    node = get(node); if (!node || !node.D || depth > 30 || pages.length > 3000) return;
    const r = node.D.Resources || res, mb = get(node.D.MediaBox), b = Array.isArray(mb) && mb.length === 4 ? mb.map(get) : box;
    if (node.D.Kids) { (get(node.D.Kids) || []).forEach(function (k) { walk(k, r, depth + 1, b); }); return; }
    const pg = { p: pages.length + 1, textOps: 0, imgs: [], box: b || [0, 0, 595, 842], rot: get(node.D.Rotate) || 0 };
    pages.push(pg);
    try { scan(content(node.D.Contents), r, pg, 0, [1, 0, 0, 1, 0, 0]); } catch (e) { pg.err = String(e && e.message || e); }
  };
  walk(root.D.Pages, null, 0, null);
  pages.get = get; pages.nm = nm;
  return pages;
}

// 글자층 PDF의 그림 쪽 — 글자 그리기 명령이 3개 이하(쪽 번호 정도)이고 큰 그림(60만 점 이상)이 있는 쪽. 글자층이 아예 없는 PDF는 [](드라이브가 이미 글자인식)
function tcPdfImgPageList_(pages) {
  if (!pages || !pages.some(function (p) { return p.textOps > 3; })) return [];
  // 스캔 한 쪽을 가로띠 여러 장으로 잘라 넣은 PDF도 있다(고객BD 세무자문자료 1쪽 — 2573×360 띠 여러 장) → 넓이 합으로 보고 그림 전부를 한 쪽에 옮긴다
  return pages.filter(function (p) { return p.textOps <= 3 && !p.err && p.imgs.reduce(function (sm, im) { return sm + im.w * im.h; }, 0) >= 600000; }).map(function (p) {
    const big = p.imgs.slice().sort(function (a, b) { return b.w * b.h - a.w * a.h; })[0];
    return { p: p.p, img: big, imgs: p.imgs.slice(0, 60) };
  });
}

// 그림만 든 한 쪽짜리 PDF를 만든다(원래 쪽의 크기·방향·그림 위치 그대로) — 드라이브는 글자층 없는 PDF는 쪽을 그려서 글자인식하므로
//  옆으로 누운 채 저장된 스캔 그림도 바로 선 모양으로 읽힌다. JPEG·팩스(CCITT)·압축 그림 모두 원래 바이트를 그대로 옮긴다. 못 만들면 null
function tcPdfOnePage_(u, pages, pg, imgs) {
  const get = pages.get;
  const ser = function (v, dep) {
    if (dep > 6) throw new Error('깊음');
    if (v && v.R !== undefined) return ser(get(v), dep + 1);
    if (typeof v === 'number') return String(Math.round(v * 10000) / 10000);
    if (typeof v === 'boolean') return String(v);
    if (v === null || v === undefined) return 'null';
    if (v.N !== undefined) return '/' + v.N;
    if (Array.isArray(v)) return '[' + v.map(function (x) { return ser(x, dep + 1); }).join(' ') + ']';
    if (v.D) { if (v.D.JBIG2Globals) throw new Error('JBIG2'); return '<<' + Object.keys(v.D).map(function (k) { return '/' + k + ' ' + ser(v.D[k], dep + 1); }).join(' ') + '>>'; }
    throw new Error('글자 값');
  };
  const xdict = function (img) {
  const d = img.d;
  let cs = get(d.ColorSpace), csTxt = '';
  if (cs && cs.N !== undefined) csTxt = '/' + cs.N;
  else if (Array.isArray(cs) && get(cs[0]) && get(cs[0]).N === 'ICCBased') { const st = get(cs[1]), n = st && st.D ? get(st.D.N) : 3; csTxt = n === 1 ? '/DeviceGray' : n === 4 ? '/DeviceCMYK' : '/DeviceRGB'; }
  else if (!get(d.ImageMask)) {
    if (img.filter !== 'DCTDecode') return null; // 색 목록(Indexed) 등 — 옮기기 어려움
    let nc = 3; for (let i = img.start + 2; i < img.start + Math.min(img.len, 65536) - 9; i++) { if (u[i] === 0xFF && (u[i + 1] === 0xC0 || u[i + 1] === 0xC1 || u[i + 1] === 0xC2)) { nc = u[i + 9]; break; } }
    csTxt = nc === 1 ? '/DeviceGray' : nc === 4 ? '/DeviceCMYK' : '/DeviceRGB';
  }
  try {
    return '<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h + ' /BitsPerComponent ' + (get(d.BitsPerComponent) || (get(d.ImageMask) ? 1 : 8)) +
      (csTxt ? ' /ColorSpace ' + csTxt : '') + (d.Filter ? ' /Filter ' + ser(d.Filter, 0) : '') + (d.DecodeParms ? ' /DecodeParms ' + ser(d.DecodeParms, 0) : '') +
      (d.Decode ? ' /Decode ' + ser(d.Decode, 0) : '') + (get(d.ImageMask) ? ' /ImageMask true' : '') + ' /Length ' + img.len + ' >>';
  } catch (e) { return null; }
  };
  const dicts = imgs.map(xdict);
  if (!dicts.length || dicts.some(function (x) { return !x; })) return null;
  const body = imgs.map(function (img, i) { return 'q ' + img.ctm.map(function (x) { return Math.round(x * 10000) / 10000; }).join(' ') + ' cm /Im' + i + ' Do Q'; }).join('\n');
  const bx = pg.box.map(function (x) { return Math.round(x * 100) / 100; }).join(' ');
  // 객체: 1 목록 · 2 쪽 묶음 · 3 쪽 · 4 내용 · 5… 그림. 조각 [글 또는 그림, 객체 시작이면 1]
  const xo = imgs.map(function (img, i) { return '/Im' + i + ' ' + (5 + i) + ' 0 R'; }).join(' ');
  const parts = [['%PDF-1.4\n'], ['1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 1], ['2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', 1],
    ['3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [' + bx + ']' + (pg.rot ? ' /Rotate ' + pg.rot : '') + ' /Resources << /XObject << ' + xo + ' >> >> /Contents 4 0 R >>\nendobj\n', 1],
    ['4 0 obj\n<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream\nendobj\n', 1]];
  imgs.forEach(function (img, i) { parts.push([(5 + i) + ' 0 obj\n' + dicts[i] + '\nstream\n', 1]); parts.push([img]); parts.push(['\nendstream\nendobj\n']); });
  const offs = [], out = []; let pos = 0;
  parts.forEach(function (pt) {
    if (pt[1]) offs.push(pos);
    const p = pt[0];
    if (typeof p !== 'string') { const src = p.bytes || u, st0 = p.bytes ? 0 : p.start; for (let k = 0; k < p.len; k++) out.push(src[st0 + k]); pos += p.len; return; } // p.bytes: 따로 만든 그림 바이트(PNG 조각 이음 등)
    for (let k = 0; k < p.length; k++) out.push(p.charCodeAt(k) & 255); pos += p.length;
  });
  const pad = function (n) { return ('0000000000' + n).slice(-10); };
  const tail = 'xref\n0 ' + (offs.length + 1) + '\n0000000000 65535 f \n' + offs.map(function (o) { return pad(o) + ' 00000 n \n'; }).join('') + 'trailer\n<< /Size ' + (offs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + pos + '\n%%EOF\n';
  for (let k = 0; k < tail.length; k++) out.push(tail.charCodeAt(k));
  for (let k = 0; k < out.length; k++) if (out[k] > 127) out[k] -= 256; // GAS 바이트는 -128~127
  return out;
}

// 드라이브 축소본(JPEG) 바이트 — 긴 변 px
function tcThumbBytes_(fileId, px) {
  const meta = Drive.Files.get(fileId, { fields: 'thumbnailLink' });
  const link = meta && meta.thumbnailLink; if (!link) throw new Error('축소본 없음');
  const res = UrlFetchApp.fetch(String(link).replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s' + px, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('축소본 받기 실패 ' + res.getResponseCode());
  const b = res.getBlob().getBytes(), u = new Uint8Array(b.length); for (let k = 0; k < b.length; k++) u[k] = b[k] & 255; return u;
}

// 큰 사진 → 드라이브가 만든 축소본(thumbnailLink, =s3000)을 받아 글자인식. 축소본이 없으면 원래 오류를 낸다
function tcOcrBigImage_(fileId) {
  const meta = Drive.Files.get(fileId, { fields: 'thumbnailLink' });
  const link = meta && meta.thumbnailLink; if (!link) throw new Error('큰 사진 — 축소본 없음');
  const url = String(link).replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s3000';
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('큰 사진 — 축소본 받기 실패 ' + res.getResponseCode());
  const b = res.getBlob(); b.setName('big.jpg');
  return tcOcrBlob_(b);
}

// 구글 문서 본문 → 글. 표(TABLE)는 한 줄 = 표 한 줄, 칸은 " | "로(getText()는 칸마다 줄을 바꿔 줄·칸 연결이 사라진다). {text, tables}
function tcDocTableAware_(bodyEl) {
  const lines = []; let tables = 0;
  const n = bodyEl.getNumChildren();
  for (let i = 0; i < n; i++) {
    const ch = bodyEl.getChild(i), ty = String(ch.getType());
    if (ty === 'TABLE') {
      tables++;
      const tb = ch.asTable(), rows = tb.getNumRows();
      lines.push('[표 ' + tables + ']');
      for (let r = 0; r < rows; r++) { const row = tb.getRow(r), cells = []; for (let c = 0; c < row.getNumCells(); c++) cells.push(row.getCell(c).getText().replace(/\s*\n\s*/g, ' ').trim()); lines.push('| ' + cells.join(' | ') + ' |'); }
    } else if (ty === 'PARAGRAPH') lines.push(ch.asParagraph().getText());
    else if (ty === 'LIST_ITEM') lines.push(ch.asListItem().getText());
  }
  return { text: lines.join('\n'), tables: tables };
}

// 그림 한 장(blob) → 드라이브 무료 글자인식 글
function tcOcrBlob_(blob) {
  const doc = Drive.Files.create(tcTmpMeta_({ name: '_ocr_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.document' }), blob, { ocrLanguage: 'ko', fields: 'id' });
  try { return DocumentApp.openById(doc.id).getBody().getText(); }
  finally { try { DriveApp.getFileById(doc.id).setTrashed(true); } catch (e) {} }
}

// 드라이브가 읽은 글(text)에 그림 쪽 글자를 끼운다. deadline(ms 시각)을 넘으면 남은 쪽을 ⚠ 줄로 남긴다(다음 보충 때 이어서).
//  이미 끼운 쪽("[N쪽 그림 쪽 글자인식]")은 건너뛴다. 끼울 쪽이 없으면 text 그대로
function tcPdfImgFill_(fileId, text, deadline, blob) {
  text = String(text || '');
  // 바이트는 한 글자 = 한 바이트 글로 받는다 — getBytes()는 숫자 배열이라 30MB PDF(고객S 붙임서류 411쪽)면 메모리가 수백 MB가 된다
  const s = (blob || DriveApp.getFileById(fileId).getBlob()).getDataAsString('ISO-8859-1'); // blob: 압축 파일 안 PDF
  const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255;
  const pages = tcPdfPages_(u, s);
  const list = tcPdfImgPageList_(pages);
  text = text.replace(/\n?\[⚠ 그림 쪽 글자인식 남음[^\]\n]*\]\s*$/, '');
  if (!list.length) return text;
  const left = [];
  list.forEach(function (it) {
    const tag = '[' + it.p + '쪽 ' + TC_PDF_IMG_MARK_.slice(1);
    if (text.indexOf(tag) !== -1) return;
    if (Date.now() > deadline) { left.push(it.p); return; }
    let t = '';
    const one = tcPdfOnePage_(u, pages, pages[it.p - 1], it.imgs);
    if (one) {
      try { t = String(tcOcrBlob_(Utilities.newBlob(one, 'application/pdf', 'p' + it.p + '.pdf')) || '').trim(); } catch (e) { left.push(it.p); return; }
      if (!t) t = '(글자 없음)';
    } else t = '(그림 형식 ' + (it.img.filter || '알 수 없음') + ' — 꺼내 읽지 못함)';
    // 끝에만 붙인다 — 중간에 끼우면 이미 기억된 글의 자리(묶음 서류 구간 "#s시작-끝", 서류 정리 기억)가 말없이 어긋난다(재점검 9)
    text += '\n' + tag + '\n' + t;
  });
  if (left.length) text += '\n' + TC_PDF_IMG_LEFT_ + ': ' + left.join(',') + '쪽 — 서버 글자인식 일괄이 이어서 읽음]';
  return text;
}

// =========================================================
// [2026.10.18 3번 세션 — 읽기] 압축 파일(zip) 안 서류 — 서버 안에서 풀어(사건 폴더엔 아무것도 안 만듦) 하나씩 글자로 읽는다.
//  사건 폴더 30개 zip(고객S 은행 거래내역 2018.zip·20212024.zip, 고객A attachments.zip의 사망진단서·가족관계증명서·신한은행 엑셀 등)을 아무도 못 읽었다.
//  같은 이름·같은 크기 파일이 사건 폴더에 이미 풀려 있으면(고객S "2018/" 폴더 등) 다시 읽지 않고 그 자리만 적는다(같은 서류를 두 번 세지 않게).
//  안쪽 파일 글은 하나씩 영구 기억(ocrzip1_<zipID>_<수정시각>_<번호>)에 남겨 시간이 모자라 끊겨도 다음에 이어 읽는다. 7z·rar·암호 zip은 못 읽음 표시. 토큰 0.
// =========================================================
var TC_ZIP_LEFT_ = '[⚠ 압축 안 서류 남음';

var TC_ZIP_FAIL_RE_ = /^\[⚠ 압축 파일을 풀지 못함/; // [2026.10.19 3번 세션] 풀기 실패 기억(비밀번호 걸림 "[⚠ 비밀번호가 걸린 압축"은 아님)

// 이름으로 형식을 보고 blob 하나를 글로 — 압축 안 압축은 depth 2까지
function tcBlobText_(blob, name, depth, deadline) {
  const n = String(name || '').toLowerCase(), ext = (/\.([a-z0-9]+)$/.exec(n) || [0, ''])[1];
  const mtOf = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword' };
  if (mtOf[ext]) {
    blob.setContentType(mtOf[ext]);
    let t = String(tcOcrBlob_(blob) || '');
    if (ext === 'pdf') { try { t = tcPdfImgFill_('', t, Math.min(deadline, Date.now() + 25000), blob); } catch (e) {} }
    return t;
  }
  if (ext === 'xlsx' || ext === 'xls') {
    blob.setContentType(ext === 'xls' ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const cp = Drive.Files.create(tcTmpMeta_({ name: '_xls_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' }), blob, { fields: 'id' });
    try { return tcSheetText_(SpreadsheetApp.openById(cp.id)); } finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
  }
  // [2026.10.19 3번 세션] 압축 안 rtf·pptx(고객S 「files.zip」 심판청구서 RTF판, 고객N 「files.zip」 발표자료 4개) — 사건 폴더의 같은 형식처럼 구글 문서·프레젠테이션으로 바꿔 읽고 바로 지움
  if (ext === 'rtf' || ext === 'pptx') {
    blob.setContentType(ext === 'rtf' ? 'application/rtf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    const cp = Drive.Files.create(tcTmpMeta_({ name: '_' + ext + '_tmp_' + Date.now(), mimeType: ext === 'rtf' ? 'application/vnd.google-apps.document' : 'application/vnd.google-apps.presentation' }), blob, { fields: 'id' });
    try {
      if (ext === 'rtf') return DocumentApp.openById(cp.id).getBody().getText();
      return SlidesApp.openById(cp.id).getSlides().map(function (sl, i) { return '[' + (i + 1) + '쪽] ' + sl.getShapes().map(function (sh) { try { return sh.getText().asString().trim(); } catch (e) { return ''; } }).filter(String).join('\n'); }).join('\n');
    } finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
  }
  if (ext === 'hwp') return tcHwpBytesText_(blob.getBytes());
  if (ext === 'hwpx') return tcHwpxText_('', blob);
  if (/^(txt|csv|md|json|xml|html?|mmd)$/.test(ext)) {
    const t = blob.getDataAsString('UTF-8');
    return t.indexOf('�') !== -1 ? blob.getDataAsString('MS949') : t; // 옛 한국어 인코딩(EUC-KR/CP949) 글
  }
  if (ext === 'zip' && depth < 2) return tcZipBlobsText_(tcUnzip_(blob), '', depth + 1, deadline, null, {}).text; // 안의 zip도 같은 풀기(이름 CP949·비밀번호 알림)
  return null;
}

// 압축 안 blob 목록 → {text, left}. keyBase가 있으면 안쪽 파일마다 영구 기억, sib는 {이름|크기: 사건 폴더 안 경로}
function tcZipBlobsText_(blobs, keyBase, depth, deadline, out0, sib) {
  const out = [], left = [];
  blobs.forEach(function (b, i) {
    const nm = String(b.getName() || ''); if (!nm || /\/$/.test(nm) || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i.test(nm)) return;
    const base = nm.split('/').pop(), head = '=== [압축 안] ' + nm + ' ===';
    let size = 0; try { size = b.getBytes().length; } catch (e) {}
    if (sib[base + '|' + size]) { out.push(head + '\n(같은 이름·같은 크기 파일이 사건 폴더에 이미 있음: ' + sib[base + '|' + size] + ' — 그 파일로 읽음)'); return; }
    const key = keyBase ? keyBase + '_' + i : '';
    let t = key ? tcOcrStoreGet_(key) : null;
    if (t === null) {
      if (Date.now() > deadline) { left.push(nm); return; }
      try { t = tcBlobText_(b, base, depth, deadline); } catch (e) { const m = String(e && e.message || e); if (OCRB_TRANSIENT_RE_.test(m)) { left.push(nm); return; } t = '(읽기 실패: ' + m.slice(0, 80) + ')'; }
      if (t === null) t = '(글자로 못 바꾸는 형식)';
      t = String(t);
      if (key) tcOcrStorePut_(key, t);
    }
    out.push(head + '\n' + t);
  });
  return { text: out.join('\n\n'), left: left };
}

// 사건 폴더 안 이름|크기 → 경로(zip이 있는 폴더부터 위로 한 단계, 아래로 3단계)
function tcZipSibs_(folder, rel, depth, sib) {
  if (depth > 3) return;
  const it = folder.getFiles(); while (it.hasNext()) { const f = it.next(); if (!/\.zip$/i.test(f.getName())) sib[f.getName() + '|' + f.getSize()] = (rel ? rel + '/' : '') + f.getName(); }
  const sub = folder.getFolders(); while (sub.hasNext()) { const sf = sub.next(); tcZipSibs_(sf, (rel ? rel + '/' : '') + sf.getName(), depth + 1, sib); }
}

// [2026.10.19 3번 세션 — 못 읽던 형식] 압축 풀기: Utilities.unzip이 먼저, 실패하거나 안 파일 이름이 깨지면(�) zip 목록을 직접 읽어 푼다.
//  은행·관공서·윈도 압축은 안 파일 이름이 옛 한국어 인코딩(CP949, "UTF-8" 표시 없음)이다 — 고객 폴더 zip 30개의 안 파일 214개 중 101개.
//  직접 풀기: 끝 목록(central directory) → 이름(UTF-8 표시가 있거나 UTF-8로 맞으면 UTF-8, 아니면 MS949) → 저장(0)·deflate(8)는 tcInflateRaw_(hwp와 같은 것).
//  비밀번호 걸린 안 파일(국민은행 거래내역 zip 7개)은 풀 수 없으므로 그 사실을 이유로 알린다(비밀번호를 짐작해 넣지 않음).
function tcUnzip_(blob) {
  let bs = null, err = null;
  try { bs = Utilities.unzip(blob.setContentType('application/zip')); } catch (e) { err = e; }
  // 이름 깨짐: �가 있거나, 한글은 하나도 없이 라틴 확장 글자(Ã·±·¿ 등 — CP949 바이트를 라틴 글자로 읽은 모양)가 있으면
  if (bs && !bs.some(function (b) { const nm = String(b.getName() || ''); return /�/.test(nm) || (/[\u0080-ÿ]/.test(nm) && !/[가-힣]/.test(nm)); })) return bs;
  let own = null;
  try { own = tcZipOwn_(blob.getBytes()); } catch (e) { if (!bs) throw err || e; return bs; }
  if (own.enc && !own.files.length) throw new Error('비밀번호가 걸린 압축(안 파일 ' + own.enc + '개) — 비밀번호를 풀어 다시 저장해 주세요');
  const out = own.files.map(function (x) { return Utilities.newBlob(x.bytes, '', x.name); });
  if (own.enc) out.push(Utilities.newBlob([], 'text/plain', '(비밀번호 걸린 안 파일 ' + own.enc + '개 — 못 읽음).txt'));
  return out;
}

// zip 바이트 → {files:[{name, bytes(0~255 수 배열이 아니라 -128~127, GAS blob용)}], enc, total}. 이름 디코딩은 tcZipName_
function tcZipOwn_(bytes) {
  const u = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) u[i] = bytes[i] & 255;
  const r16 = function (p) { return u[p] | (u[p + 1] << 8); }, r32 = function (p) { return (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0; };
  let e = -1; for (let p = u.length - 22; p >= Math.max(0, u.length - 22 - 65557); p--) { if (u[p] === 0x50 && u[p + 1] === 0x4b && u[p + 2] === 5 && u[p + 3] === 6) { e = p; break; } }
  if (e < 0) throw new Error('zip 끝 목록 없음');
  const cnt = r16(e + 10), files = []; let off = r32(e + 16), enc = 0;
  for (let j = 0; j < cnt; j++) {
    if (r32(off) !== 0x02014b50) break;
    const fl = r16(off + 8), meth = r16(off + 10), csz = r32(off + 20), nl = r16(off + 28), el = r16(off + 30), cl = r16(off + 32), lo = r32(off + 42);
    const name = tcZipName_(u.subarray(off + 46, off + 46 + nl), !!(fl & 0x800));
    off += 46 + nl + el + cl;
    if (/\/$/.test(name)) continue;
    if (fl & 1) { enc++; continue; }
    const ds = lo + 30 + r16(lo + 26) + r16(lo + 28), raw = u.subarray(ds, ds + csz);
    let data; if (meth === 0) data = raw; else if (meth === 8) data = tcInflateRaw_(raw); else continue; // 그 밖의 압축 방식(bzip2·lzma 등)은 건너뜀
    const b = new Array(data.length); for (let i = 0; i < data.length; i++) b[i] = data[i] > 127 ? data[i] - 256 : data[i];
    files.push({ name: name, bytes: b });
  }
  return { files: files, enc: enc, total: cnt };
}

function tcZipName_(raw, utf8Flag) {
  const ascii = !Array.prototype.some.call(raw, function (c) { return c > 127; });
  const b = Array.prototype.map.call(raw, function (c) { return c > 127 ? c - 256 : c; });
  if (ascii) return String.fromCharCode.apply(null, Array.prototype.slice.call(raw));
  const blob = Utilities.newBlob(b);
  const t = blob.getDataAsString('UTF-8');
  if (utf8Flag || t.indexOf('�') === -1) return t;
  return blob.getDataAsString('MS949');
}

function tcZipText_(f, deadline) {
  const file = DriveApp.getFileById(f.id);
  if (file.getSize() > 45 * 1024 * 1024) return '[⚠ 압축 파일이 너무 큼(45MB 넘음) — 풀어서 넣어 주세요]';
  let blobs;
  try { blobs = tcUnzip_(file.getBlob()); }
  catch (e) { const m = String(e && e.message || e); return /비밀번호/.test(m) ? '[⚠ ' + m + ']' : '[⚠ 압축 파일을 풀지 못함(암호가 걸렸거나 zip이 아님): ' + m.slice(0, 80) + ']'; }
  const sib = {};
  try { const ps = file.getParents(); if (ps.hasNext()) { const p = ps.next(); tcZipSibs_(p, '', 0, sib); } } catch (e) {}
  const r = tcZipBlobsText_(blobs, 'ocrzip1_' + f.id + '_' + (f.modified || ''), 0, deadline, null, sib);
  return r.text + (r.left.length ? '\n' + TC_ZIP_LEFT_ + ': ' + r.left.length + '개 — 서버 글자인식 일괄이 이어서 읽음]' : '');
}

// 한글 hwpx(압축된 XML) — 본문 section*.xml의 글자만 꺼낸다(무료, 변환 없음). 옛 hwp(이진 파일)는 tcHwpText_가 읽는다.
function tcHwpxText_(fileId, blob0) {
  const blob = (blob0 || DriveApp.getFileById(fileId).getBlob()).setContentType('application/zip'); // blob0: 압축 파일 안 hwpx
  const num = function (b) { return Number((/(\d+)\.xml$/i.exec(b.getName()) || [0, 0])[1]); };
  const parts = Utilities.unzip(blob).filter(function (b) { return /Contents\/section\d+\.xml$/i.test(b.getName()); }).sort(function (a, b) { return num(a) - num(b); });
  return parts.map(function (b) {
    return b.getDataAsString('UTF-8').replace(/<\/hp:p>/g, '\n').replace(/<hp:tab[^>]*\/>/g, '\t').replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }).join('\n').replace(/\n{3,}/g, '\n\n');
}

// [2026.10.18 1번 세션] 옛 한글(hwp, HWP 5.0 이진 형식) — 본문 글자를 직접 꺼낸다(무료·토큰 0, 외부 변환 없음). 고객 사건 폴더의 옛 hwp 73개를
//  아무도 못 읽고 "hwpx나 PDF로 저장해 주세요"로만 남겼다. 순서: OLE 복합 문서(CFB) 풀기 → FileHeader(압축·암호) → BodyText/Section0..N
//  (압축이면 raw deflate 풀기) → 레코드 중 문단 글자(HWPTAG_PARA_TEXT)만 모은다. 암호 걸린 문서는 '' (글자 없음으로 처리됨).
function tcHwpText_(fileId) {
  return tcHwpBytesText_(DriveApp.getFileById(fileId).getBlob().getBytes());
}

// 바이트 배열(GAS는 -128~127, 0~255로 바꿔 씀) → 본문 글자
function tcHwpBytesText_(bytes) {
  const u = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) u[i] = bytes[i] & 255;
  const cfb = tcCfbOpen_(u);
  if (!cfb) return ''; // OLE 복합 문서가 아님(HWP 3.0 등 더 옛 형식) — 못 읽음
  const fh = cfb.read('FileHeader');
  if (!fh || fh.length < 40) return '';
  const prop = (fh[36] | (fh[37] << 8) | (fh[38] << 16) | (fh[39] << 24)) >>> 0;
  if (prop & 2) return ''; // 암호 걸린 문서
  const zipped = !!(prop & 1);
  // [2026.10.18 1번 세션] 배포용 문서(bit2)는 본문이 ViewText에 암호화돼 있다 — 미리보기 글(PrvText, 앞부분 1천 자 남짓)이라도 읽는다
  if (prop & 4) { const pv = cfb.read('PrvText'); return pv ? tcHwpCleanText_(tcUtf16le_(pv, 0, pv.length)) : ''; }
  const out = [];
  for (let s = 0; ; s++) {
    let sec = cfb.read('BodyText/Section' + s);
    if (!sec) break;
    if (zipped) sec = tcInflateRaw_(sec);
    out.push(tcHwpSectionText_(sec));
  }
  return tcHwpCleanText_(out.join('\n'));
}

function tcHwpCleanText_(t) { return tcHwpPuaFix_(String(t)).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }

// 한컴 전용 글자(U+F0000~, 한컴 글꼴에만 있는 기호)는 다른 곳에서 □로 깨진다. 서식의 번호 기호를 보통 글자로 바꾼다 —
//  종합소득세 신고서의 칸 번호(⑯대리구분·⑰관리번호·⑲소득금액·⑳소득공제·㉑과세표준…)·신고유형 [11]자기조정 [12]외부조정 [14]성실신고확인 [20]간편장부
//  [31]추계-기준율 [35]분리과세 [40]비사업자·첨부 ⓫소득공제명세서~⓲추계소득금액계산서로 맞춰 본 두 자리 번호(십의 자리 글자+일의 자리 글자):
//  동그라미 십 F0288+십·일 F0292+일, 검은 동그라미 십 F029C+십·일 F02A6+일, 네모 한 자리 F02B0+수·십 F02B9+십·일 F02C3+일. 우편 기호 F0095=〒.
//  그 밖의 한컴 전용 글자는 뜻을 모르므로 지운다(깨진 글자를 남기지 않음)
function tcHwpPuaFix_(t) {
  const cp = function (ch) { return ch.codePointAt(0) - 0xF0000; };
  const circ = function (n) { return n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : n >= 21 && n <= 35 ? String.fromCharCode(0x3251 + n - 21) : n >= 36 && n <= 50 ? String.fromCharCode(0x32B1 + n - 36) : '(' + n + ')'; };
  const neg = function (n) { return n >= 1 && n <= 10 ? String.fromCharCode(0x2776 + n - 1) : n >= 11 && n <= 20 ? String.fromCharCode(0x24EB + n - 11) : '(' + n + ')'; };
  return t
    .replace(/([\u{F0289}-\u{F0291}])([\u{F0292}-\u{F029B}])/gu, function (m, a, b) { return circ((cp(a) - 0x288) * 10 + cp(b) - 0x292); })
    .replace(/([\u{F029D}-\u{F02A5}])([\u{F02A6}-\u{F02AF}])/gu, function (m, a, b) { return neg((cp(a) - 0x29C) * 10 + cp(b) - 0x2A6); })
    .replace(/([\u{F02BA}-\u{F02C2}])([\u{F02C3}-\u{F02CC}])/gu, function (m, a, b) { return '[' + ((cp(a) - 0x2B9) * 10 + cp(b) - 0x2C3) + ']'; })
    .replace(/[\u{F02B1}-\u{F02B9}]/gu, function (m) { return '[' + (cp(m) - 0x2B0) + ']'; })
    .replace(/\u{F0095}/gu, '〒')
    .replace(/[\u{F0000}-\u{FFFFD}]/gu, '');
}

function tcUtf16le_(u, from, to) {
  const cs = [];
  for (let i = from; i + 1 < to; i += 2) cs.push(u[i] | (u[i + 1] << 8));
  let s = '';
  for (let i = 0; i < cs.length; i += 4096) s += String.fromCharCode.apply(null, cs.slice(i, i + 4096));
  return s.replace(/\u0000+$/, '');
}

// 한 구역(Section)의 레코드 → 글자. 머리 32비트 = 태그 10비트·레벨 10비트·크기 12비트(0xFFF면 다음 32비트가 크기)
function tcHwpSectionText_(u) {
  const paras = [], lastAt = {};
  let p = 0;
  while (p + 4 <= u.length) {
    const h = (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0;
    p += 4;
    const tag = h & 0x3FF, lv = (h >>> 10) & 0x3FF;
    let size = (h >>> 20) & 0xFFF;
    if (size === 0xFFF) { if (p + 4 > u.length) break; size = (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0; p += 4; }
    const end = Math.min(u.length, p + size);
    if (tag === 67) { const q = { s: tcHwpParaText_(u, p, end), fill: [] }; paras.push(q); lastAt[lv] = q; } // HWPTAG_PARA_TEXT(0x10+51) — 표 칸 글자도 이 레코드로 나온다
    // 글자 겹침(제어 23, 'tcps') — 겹친 글자(①·⑥ 등)는 문단 글자가 아니라 뒤따르는 컨트롤 머리(HWPTAG_CTRL_HEADER, 71)에 있다.
    //  빼면 "시행령 제154조 제⑥항"이 "제항"이 된다(고객AF 의뢰인확인서). 같은 레벨의 바로 앞 문단 글자 자리에 차례로 채운다
    else if (tag === 71 && end - p >= 6 && u[p] === 0x73 && u[p + 1] === 0x70 && u[p + 2] === 0x63 && u[p + 3] === 0x74 && lastAt[lv]) {
      const n = u[p + 4] | (u[p + 5] << 8);
      lastAt[lv].fill.push(tcUtf16le_(u, p + 6, Math.min(end, p + 6 + n * 2)).replace(/[\u0000-\u001f]/g, ''));
    }
    p = end;
  }
  return paras.map(function (q) { let k = 0; return q.s.replace(/\u0017/g, function () { return q.fill[k++] || ''; }); }).join('\n');
}

// 문단 글자(UTF-16LE). 0~31은 제어 문자: 확장·인라인 제어는 8글자(16바이트) 차지, 문자 제어는 1글자. 9=탭, 10·13=줄끝
function tcHwpParaText_(u, from, to) {
  const cs = [];
  let i = from;
  while (i + 1 < to) {
    const c = u[i] | (u[i + 1] << 8);
    if (c >= 32) { cs.push(c); i += 2; continue; }
    if (c === 9) { cs.push(9); i += 16; continue; }                                   // 탭(인라인 제어)
    if (c === 10 || c === 13) { cs.push(10); i += 2; continue; }                      // 줄바꿈·문단 끝
    if (c === 0 || (c >= 24 && c <= 29)) { if (c === 24) cs.push(45); i += 2; continue; } // 쓸 수 없음·하이픈·예약
    if (c === 30 || c === 31) { cs.push(32); i += 2; continue; }                      // 묶음 빈칸·고정폭 빈칸
    if (c === 23) { cs.push(23); i += 16; continue; }                                 // 글자 겹침 자리 — 겹친 글자는 tcHwpSectionText_가 채움
    i += 16;                                                                          // 확장 제어(표·그림·각주 등)·인라인 제어
  }
  let s = '';
  for (let k = 0; k < cs.length; k += 4096) s += String.fromCharCode.apply(null, cs.slice(k, k + 4096));
  return s.replace(/\n+$/, '');
}

// OLE 복합 문서(CFB) — 머리(512바이트)·FAT·DIFAT·미니 FAT·디렉터리 항목을 읽어 경로("BodyText/Section0")로 스트림을 꺼낸다
function tcCfbOpen_(u) {
  const SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  if (u.length < 512) return null;
  for (let i = 0; i < 8; i++) if (u[i] !== SIG[i]) return null;
  const u16 = function (o) { return u[o] | (u[o + 1] << 8); };
  const u32 = function (o) { return (u[o] | (u[o + 1] << 8) | (u[o + 2] << 16) | (u[o + 3] << 24)) >>> 0; };
  const secSize = 1 << u16(0x1E), miniSize = 1 << u16(0x20);
  const nFat = u32(0x2C), dirStart = u32(0x30), cutoff = u32(0x38), miniFatStart = u32(0x3C), nMiniFat = u32(0x40);
  let difatSec = u32(0x44), nDifat = u32(0x48);
  const END = 0xFFFFFFFE, FREE = 0xFFFFFFFF;
  const off = function (sid) { return (sid + 1) * secSize; };
  // FAT 섹터 번호 목록(머리 109개 + DIFAT 섹터 사슬)
  const fatSecs = [];
  for (let i = 0; i < 109 && fatSecs.length < nFat; i++) { const v = u32(0x4C + i * 4); if (v !== FREE) fatSecs.push(v); }
  for (let g = 0; nDifat > 0 && difatSec < END && g < 100000; g++, nDifat--) {
    const o = off(difatSec); if (o + secSize > u.length) break;
    for (let i = 0; i < secSize / 4 - 1 && fatSecs.length < nFat; i++) { const v = u32(o + i * 4); if (v !== FREE) fatSecs.push(v); }
    difatSec = u32(o + secSize - 4);
  }
  const fat = [];
  fatSecs.forEach(function (s) { const o = off(s); for (let i = 0; i < secSize / 4; i++) fat.push(o + i * 4 + 4 <= u.length ? u32(o + i * 4) : FREE); });
  const chain = function (start, tbl) {
    const r = [];
    for (let s = start; s < END && s < tbl.length && r.length <= tbl.length; s = tbl[s]) r.push(s);
    return r;
  };
  const readChain = function (start, size, src, unit, tbl, base) {
    const out = new Uint8Array(size);
    let w = 0;
    const sids = chain(start, tbl);
    for (let k = 0; k < sids.length && w < size; k++) {
      const o = base(sids[k]), n = Math.min(unit, size - w, Math.max(0, src.length - o));
      if (n <= 0) break;
      out.set(src.subarray(o, o + n), w); w += n;
    }
    return w < size ? out.subarray(0, w) : out;
  };
  const readBig = function (start, size) { return readChain(start, size, u, secSize, fat, off); };
  // 디렉터리 항목(128바이트씩)
  const dirSids = chain(dirStart, fat), ents = [];
  dirSids.forEach(function (s) {
    const o0 = off(s);
    for (let k = 0; k < secSize / 128; k++) {
      const o = o0 + k * 128; if (o + 128 > u.length) return;
      const nl = u16(o + 0x40);
      ents.push({ name: tcUtf16le_(u, o, o + Math.min(64, Math.max(0, nl - 2))), type: u[o + 0x42],
        left: u32(o + 0x44), right: u32(o + 0x48), child: u32(o + 0x4C), start: u32(o + 0x74), size: u32(o + 0x78) });
    }
  });
  if (!ents.length || ents[0].type !== 5) return null;
  // 경로 붙이기 — 형제는 좌우 나무, 하위는 child
  const paths = {}, seen = {};
  const walk = function (id, prefix) {
    const st = [id];
    while (st.length) {
      const e = st.pop();
      if (e >= ents.length || seen[e]) continue;
      seen[e] = 1;
      const d = ents[e], p = prefix + d.name;
      paths[p] = d;
      st.push(d.left, d.right);
      if (d.type === 1) walk(d.child, p + '/');
    }
  };
  walk(ents[0].child, '');
  const root = ents[0];
  let mini = null, miniFat = null;
  return {
    paths: paths,
    read: function (path) {
      const d = paths[path];
      if (!d || d.type !== 2) return null;
      if (d.size < cutoff) { // 작은 스트림은 미니 스트림(루트 항목의 스트림) 안에 64바이트 단위로
        if (!mini) {
          mini = readBig(root.start, root.size);
          miniFat = [];
          const mb = readBig(miniFatStart, nMiniFat * secSize);
          for (let i = 0; i + 4 <= mb.length; i += 4) miniFat.push((mb[i] | (mb[i + 1] << 8) | (mb[i + 2] << 16) | (mb[i + 3] << 24)) >>> 0);
        }
        return readChain(d.start, d.size, mini, miniSize, miniFat, function (s) { return s * miniSize; });
      }
      return readBig(d.start, d.size);
    }
  };
}

// raw deflate 풀기(zlib 머리 없음 — GAS Utilities에는 없음). 저장·고정 허프만·동적 허프만 블록
function tcInflateRaw_(src) {
  let out = new Uint8Array(Math.max(4096, src.length * 4)), op = 0;
  let pos = 0, buf = 0, cnt = 0, over = 0;
  const need = function (n) {
    while (cnt < n) {
      if (pos < src.length) buf |= src[pos++] << cnt;
      else if (++over > 8) throw new Error('hwp 압축 자료가 끝에서 잘림');
      cnt += 8;
    }
  };
  const bits = function (n) { need(n); const v = buf & ((1 << n) - 1); buf >>>= n; cnt -= n; return v; };
  const room = function (n) { if (op + n > out.length) { const b = new Uint8Array(Math.max(out.length * 2, op + n)); b.set(out.subarray(0, op)); out = b; } };
  // 부호 길이 → 빠른 찾기표(낮은 비트부터 읽은 값 → 기호<<4 | 길이)
  const build = function (lens) {
    let max = 0; lens.forEach(function (l) { if (l > max) max = l; });
    if (!max) return { tbl: new Int32Array(2), max: 1 };
    const blc = new Array(16).fill(0); lens.forEach(function (l) { if (l) blc[l]++; });
    const next = new Array(16).fill(0); let code = 0;
    for (let b = 1; b <= 15; b++) { code = (code + blc[b - 1]) << 1; next[b] = code; }
    const tbl = new Int32Array(1 << max).fill(-1);
    lens.forEach(function (l, sym) {
      if (!l) return;
      let c = next[l]++, r = 0;
      for (let k = 0; k < l; k++) { r = (r << 1) | (c & 1); c >>= 1; }
      for (let j = r; j < (1 << max); j += (1 << l)) tbl[j] = (sym << 4) | l;
    });
    return { tbl: tbl, max: max };
  };
  const sym = function (h) {
    need(h.max);
    const v = h.tbl[buf & ((1 << h.max) - 1)];
    if (v < 0) throw new Error('hwp 압축 부호가 잘못됨');
    const l = v & 15; buf >>>= l; cnt -= l;
    return v >> 4;
  };
  const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  let fixL = null, fixD = null, last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) { // 저장 블록 — 바이트 경계로 맞춘 뒤 길이만큼 그대로
      bits(cnt & 7);
      const len = bits(16); bits(16);
      room(len);
      let k = 0;
      while (cnt >= 8 && k < len) { out[op++] = bits(8); k++; }
      if (pos + (len - k) > src.length) throw new Error('hwp 압축 저장 블록이 잘림');
      out.set(src.subarray(pos, pos + len - k), op); op += len - k; pos += len - k;
      continue;
    }
    let hl, hd;
    if (type === 1) {
      if (!fixL) {
        const l = []; for (let i = 0; i < 288; i++) l.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8);
        fixL = build(l); fixD = build(new Array(30).fill(5));
      }
      hl = fixL; hd = fixD;
    } else if (type === 2) {
      const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4;
      const cl = new Array(19).fill(0);
      for (let i = 0; i < nc; i++) cl[ORD[i]] = bits(3);
      const ch = build(cl), lens = [];
      while (lens.length < nl + nd) {
        const s = sym(ch);
        if (s < 16) lens.push(s);
        else if (s === 16) { if (!lens.length) throw new Error('hwp 압축 부호 길이 잘못됨'); const pv = lens[lens.length - 1]; for (let r = bits(2) + 3; r > 0; r--) lens.push(pv); }
        else if (s === 17) { for (let r = bits(3) + 3; r > 0; r--) lens.push(0); }
        else { for (let r = bits(7) + 11; r > 0; r--) lens.push(0); }
      }
      hl = build(lens.slice(0, nl)); hd = build(lens.slice(nl, nl + nd));
    } else throw new Error('hwp 압축 블록 형식이 잘못됨');
    for (;;) {
      const s = sym(hl);
      if (s < 256) { room(1); out[op++] = s; continue; }
      if (s === 256) break;
      const li = s - 257; if (li >= 29) throw new Error('hwp 압축 길이 부호가 잘못됨');
      const len = LB[li] + bits(LE[li]);
      const di = sym(hd); if (di >= 30) throw new Error('hwp 압축 거리 부호가 잘못됨');
      const dist = DB[di] + bits(DE[di]);
      if (dist > op) throw new Error('hwp 압축 거리가 앞을 넘음');
      room(len);
      for (let k = 0; k < len; k++, op++) out[op] = out[op - dist];
    }
  }
  return out.subarray(0, op);
}

// 파워포인트(pptx) — 구글 프레젠테이션으로 바꿔 상자 글자를 읽는다
function tcPptxText_(fileId) {
  const cp = Drive.Files.copy(tcTmpMeta_({ name: '_ppt_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.presentation' }), fileId, { fields: 'id' });
  try {
    return SlidesApp.openById(cp.id).getSlides().map(function (sl, i) {
      return '[' + (i + 1) + '쪽] ' + sl.getShapes().map(function (sh) { try { return sh.getText().asString().trim(); } catch (e) { return ''; } }).filter(String).join('\n');
    }).join('\n');
  } finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
}

// [2026.10.15 1단계 ①] 표 계산기는 모든 시트·모든 줄을 읽는다(예전: 앞 3시트·200줄에서 말없이 잘림). 빈 칸·빈 줄은 뺀다.
function tcSheetText_(ss, keepCols) {
  return ss.getSheets().map(function (sh) {
    // [2026.10.18 정밀분석 원인2] keepCols — 빈 칸도 자리를 지킨다(끝쪽 빈 칸만 뗌). 통장 엑셀은 "찾으신금액/맡기신금액" 중 한 칸이 비어 있어
    //  빈 칸을 지우면 출금·입금·잔액 칸이 한 칸씩 당겨졌다(고객E 피상속인·고객BF·고객C·고객O 엑셀 통장). 메모로 읽는 글(기본)은 예전대로 빈 칸을 뺀다
    return sh.getName() + '\n' + sh.getDataRange().getDisplayValues().map(function (r) {
      if (!keepCols) return r.filter(String).join('\t');
      var e = r.length; while (e > 0 && !String(r[e - 1]).trim()) e--;
      return e ? r.slice(0, e).map(function (v) { return String(v).replace(/[\t\r\n]+/g, ' '); }).join('\t') : '';
    }).filter(String).join('\n');
  }).join('\n\n');
}

// [2026.10.18 정밀분석 원인2] 표 계산기(엑셀·구글 시트)를 칸 자리를 지킨 글로 — 통장 표 정리(caseProcTableBankDocs_)용. 메모 글(tc_docText_)과 기억을 따로 둔다.
//  비싼 변환(엑셀 → 구글 시트)은 통장으로 보이는 파일에서만 한 번 하고 영구 기억에 남긴다
// [2026.10.18 1번 세션 — 최대 수집] 엑셀을 글로 바꾸는 김에(같은 변환, 추가 비용 없음) 칸 자리를 지킨 표 글도 기억에 남긴다 — 사실 목록(cpfSheetRows_)이
//  통장이 아닌 표(임대 현황·지분표·분배표 등)도 한 줄 = 사실 한 건으로 읽게. 이미 있으면 그대로 둔다
function tcSheetGridKeep_(f, ss) {
  try {
    if (!f || !f.modified) return;
    const key = 'ocrgrid1_' + f.id + '_' + f.modified;
    if (tcOcrStoreGet_(key) !== null) return;
    const g = String(tcSheetText_(ss, true) || '').slice(0, 400000);
    tcOcrStorePut_(key, g);
    if (g.length <= 30000) { try { CacheService.getScriptCache().put(key, g, 21600); } catch (e) {} }
  } catch (e) {}
}

// [2026.10.16] 정답지 점검이 증빙 단계(글자인식 한도 있음)를 마친 뒤에는 새 글자인식을 하지 않게 하는 스위치 — 서류가 한도보다 많은 사건(고객A 299개)은
//  그 뒤 상속 사실 정리·메모 읽기가 넘친 서류를 하나씩 새로 글자인식해 서버 6분 한도를 넘겼다. 기억에 있는 글자는 그대로 쓴다.
var TC_NO_NEW_OCR_ = false;

// [2026.10.18 3번 세션] 서버 글자인식 일괄(cpOcrBatch_) 안에서만 켜는 스위치 — 오래 걸리는 새 읽기(PDF 그림 쪽 보충·zip 풀어 읽기)는 일괄에서만 한다.
//  사이드바(사건처리)에서 기억 없는 PDF마다 그림 쪽 보충으로 최대 25초가 늘던 것을 막는다(세무사님 실사용). 사이드바는 일괄이 남긴 기억을 그대로 쓴다
var TC_BATCH_READ_ = false;

// [2026.10.18 정밀분석 14] 글자 상한에서 잘린 표시 · 통장 거래내역으로 보이는 글(머리의 거래내역·입출금·계좌번호 낱말 + 날짜 줄 50개 이상)
var TC_TEXT_CUT_MARK_ = '[⚠ 글자 상한';

function tcLooksBankText_(t) {
  t = String(t || '');
  if (t.length <= 60000 || !/거\s*래\s*내\s*역|입\s*출\s*금|계\s*좌\s*번\s*호|예\s*금\s*주|거\s*래\s*일\s*시|찾\s*으\s*신\s*금\s*액|맡\s*기\s*신\s*금\s*액|출\s*금\s*액|입\s*금\s*액/.test(t.slice(0, 5000))) return false;
  return (t.slice(0, 60000).match(/(?:19|20)\d{2}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}/g) || []).length >= 50;
}

function tc_docText_(f) {
  // [2026.10.17] 묶음 파일을 서류별로 나눈 구간(caseProcBundleParts_ — id "원본ID#s시작-끝")은 원본 글자의 그 부분
  //  (거래 서류는 떨어진 구간 여럿을 "시작-끝_시작-끝"으로 — 이어서 붙인다)
  const vm = /^(.+)#s(\d+-\d+(?:_\d+-\d+)*)$/.exec(String((f && f.id) || ''));
  if (vm) {
    const pt = tc_docText_({ id: vm[1], name: f.bundleOf || f.name, mimeType: f.mimeType, modified: f.modified });
    return pt ? vm[2].split('_').map(function (rg) { const q = rg.split('-'); return String(pt).slice(Number(q[0]), Number(q[1])); }).join('\n') : pt;
  }
  // 쪽마다 나뉜 파일을 이어 붙인 한 서류(caseProcJoinPages_ — id "m#ID1+ID2+…") — 쪽 순서대로 글자를 잇는다(한 쪽이라도 아직 글자가 없으면 빈 글자)
  if (/^m#/.test(String((f && f.id) || ''))) {
    const ts = String(f.id).slice(2).split('+').map(function (s) { const q = s.split('~'); return tc_docText_({ id: q[0], name: f.name, mimeType: 'application/pdf', modified: Number(q[1]) || '' }); });
    return ts.every(function (x) { return x; }) ? ts.join('\n') : '';
  }
  const cache = CacheService.getScriptCache();
  // 표 계산기만 기억 이름을 바꿔 새 규칙(모든 시트)으로 다시 읽게 한다 — 다른 서류의 글자인식 기억은 그대로 쓴다
  const sheetLike = /spreadsheet|ms-excel/.test(String(f.mimeType || ''));
  const key = (sheetLike ? 'ocrtxt3_' : 'ocrtxt_') + f.id + '_' + (f.modified || '');
  const hit = cache.get(key);
  if (hit !== null && !(TC_BATCH_READ_ && TC_ZIP_FAIL_RE_.test(hit))) return hit; // [2026.10.19 3번 세션] 압축 풀기 실패 글은 일괄에서 캐시도 건너뜀
  let text = '';
  const mt = String(f.mimeType || '');
  const fname = String(f.name || '');
  // 비싼 변환(글자인식·엑셀·한글·파워포인트)은 영구 기억에서 먼저 찾는다(수정시각이 같을 때만)
  const isZip = /\.zip$/i.test(fname) || /^application\/(x-)?zip(-compressed)?$/.test(mt); // [2026.10.18 3번 세션] 압축 파일 안 서류도 읽는다(tcZipText_)
  const costly = !!f.modified && (/pdf|^image\/|officedocument|msword|spreadsheetml|ms-excel/.test(mt) || /\.(hwpx|hwp|pptx)$/i.test(fname) || isZip); // [2026.10.18 1번 세션] 옛 한글 hwp도 영구 기억
  // [2026.10.19 3번 세션] 압축 파일의 "풀지 못함" 기억(이름이 CP949라 풀기에 실패하던 때 남은 것)은 일괄 안에서 다시 읽는다 — 비밀번호 걸림 기억은 그대로 씀
  let zipRetry = false;
  if (costly) { const st = tcOcrStoreGet_(key); if (st !== null && isZip && TC_BATCH_READ_ && TC_ZIP_FAIL_RE_.test(st)) zipRetry = true; else if (st !== null) { try { cache.put(key, st, 21600); } catch (e) {} return st; } }
  if (costly && TC_NO_NEW_OCR_) return '';
  if (/\.hwpx$/i.test(fname)) text = tcHwpxText_(f.id);
  else if (isZip) { if (!TC_BATCH_READ_) return null; text = tcZipText_(f, Date.now() + 60000); } // 일괄에서만 풀어 읽음(1분까지, 남은 안쪽 파일은 다음 번에 — 안쪽 글은 하나씩 기억). 사이드바는 예전처럼 "글자로 못 바꿈"
  else if (/\.hwp$/i.test(fname)) text = tcHwpText_(f.id); // [2026.10.18 1번 세션] 옛 한글 hwp — 이진 파일을 직접 풀어 읽는다(토큰 0)
  else if (/presentationml/.test(mt) || /\.pptx$/i.test(fname)) text = tcPptxText_(f.id);
  else if (mt === 'application/vnd.google-apps.document') text = DocumentApp.openById(f.id).getBody().getText();
  else if (mt === 'application/vnd.google-apps.spreadsheet') {
    const ss = SpreadsheetApp.openById(f.id);
    text = tcSheetText_(ss);
    tcSheetGridKeep_(f, ss);
  }
  // [2026.10.18 3번 세션 재점검 6] 구글 프레젠테이션(.gslides 자문보고서 등)·rtf(심판청구서)·html(태그째 읽히던 것)·mmd·url — 예전엔 못 읽거나 태그째
  else if (mt === 'application/vnd.google-apps.presentation') text = SlidesApp.openById(f.id).getSlides().map(function (sl, i) { return '[' + (i + 1) + '쪽] ' + sl.getShapes().map(function (sh) { try { return sh.getText().asString().trim(); } catch (e) { return ''; } }).filter(String).join('\n'); }).join('\n');
  else if (/\.rtf$/i.test(fname) || /rtf/.test(mt)) {
    const cp = Drive.Files.copy(tcTmpMeta_({ name: '_rtf_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.document' }), f.id, { fields: 'id' });
    try { text = DocumentApp.openById(cp.id).getBody().getText(); } finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
  }
  else if (/html/.test(mt) || /\.html?$/i.test(fname)) {
    text = DriveApp.getFileById(f.id).getBlob().getDataAsString('UTF-8').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }
  else if (/^text\/|json|csv|markdown/.test(mt) || /\.(mmd|url|txt|csv|md)$/i.test(fname)) { const b = DriveApp.getFileById(f.id).getBlob(); text = b.getDataAsString('UTF-8'); if (text.indexOf('�') !== -1) text = b.getDataAsString('MS949'); } // 옛 한국어 인코딩 글도
  else if (/pdf|^image\/|officedocument\.wordprocessingml|msword/.test(mt)) {
    Utilities.sleep(800);
    try { text = ocrFileText_(f.id, f.modified ? 'ocrtbl1_' + f.id + '_' + f.modified : ''); }
    catch (e) {
      // [2026.10.18 3번 세션] 너무 큰 사진(고객Q 「고객Q 관계인1.jpg」 13MB — "Request Too Large")은 드라이브 축소본(긴 변 3,000점)으로 읽는다. 글자 크기는 충분
      if (!/^image\//.test(mt) || !/Too Large|too large|크기/.test(String(e && e.message || e))) throw e;
      text = tcOcrBigImage_(f.id);
    }
    // [2026.10.18 3번 세션] 글자층 PDF 속 스캔 그림 쪽 보충 — 일괄 안에서만(1분까지, 남은 쪽은 ⚠ 줄로 남기고 일괄 뒷단계가 이어서). 사이드바에서는 하지 않는다
    if (/pdf/.test(mt) && TC_BATCH_READ_) { try { text = tcPdfImgFill_(f.id, text, Date.now() + 60000); } catch (e) {} }
  }
  // [2026.10.15 1:1] 엑셀(.xlsx·.xls) — 구글 시트로 바꿔 읽는다(세무사님: "폴더 안 파일은 스펀지처럼 다 흡수" — 상담 메모 엑셀을 말없이 건너뛰던 문제)
  else if (/spreadsheetml|ms-excel/.test(mt)) {
    const cp = Drive.Files.copy(tcTmpMeta_({ name: '_xls_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' }), f.id, { fields: 'id' });
    try {
      const ss = SpreadsheetApp.openById(cp.id); text = tcSheetText_(ss);
      // [2026.10.18 3번 세션] 같은 변환에서 칸 자리 지킨 표 글(tcSheetGridText_와 같은 기억)도 남긴다 — 통장 말고도 임대 현황·지분표 등
      //  빈 칸을 지우면 칸이 한 칸씩 당겨진다. 변환을 한 번 더 하지 않게 여기서 함께
      if (f.modified) { const gk = 'ocrgrid1_' + f.id + '_' + f.modified; if (tcOcrStoreGet_(gk) === null) tcOcrStorePut_(gk, String(tcSheetText_(ss, true) || '').slice(0, 400000)); }
    }
    finally { try { DriveApp.getFileById(cp.id).setTrashed(true); } catch (e) {} }
  }
  else return null; // 압축파일 등은 글자로 못 바꿈
  // [2026.10.11] 글자는 잘라 쓰기 전 전체(최대 6만 자)를 기억 — 서류 자동정리 규칙은 여러 장짜리 등기부·초본 전체가 필요하다
  // [2026.10.18 정밀분석 14] 통장 거래내역(거래 줄 서류)은 끝까지 읽는다(상한 40만 자) — 6만 자에서 잘려 고객S 국민은행 127쪽 중 앞 20쪽·기업은행 앞 23쪽만 읽혀
  //  불복 대사표 50줄 중 2020~2024년 약 40줄이 "통장에 없음"이 됐다. 그 밖의 서류도 잘렸으면 끝에 표시를 남겨 정리 결과에 ⚠로 밝힌다(말없이 자르지 않음)
  // [2026.10.18 3번 세션 재점검 6] 그 밖의 서류도 6만 자 → 20만 자(긴 감정평가서·심판청구 붙임서류가 뒤쪽을 잃었다). 잘리면 여전히 표시를 남김
  { const full = String(text || ''), cap = tcLooksBankText_(full) || isZip ? 400000 : 200000; text = full.length > cap ? full.slice(0, cap) + '\n' + TC_TEXT_CUT_MARK_ + ' ' + cap + '자에서 잘림 — 뒤쪽 ' + (full.length - cap) + '자는 못 읽음(서류를 기간·쪽으로 나눠 넣어 주세요)]' : full; }
  if (isZip && text.indexOf(TC_ZIP_LEFT_) !== -1) return text; // 덜 읽은 압축 파일은 기억에 굳히지 않는다 — 다음 번에 남은 안쪽 파일부터 이어서
  if (isZip && TC_ZIP_FAIL_RE_.test(text)) return text; // [2026.10.19 3번 세션] 풀기 실패도 굳히지 않는다(고친 뒤 다시 읽게) — 비밀번호 걸림은 굳힘
  try { cache.put(key, text, 21600); } catch (e) {}
  if (costly) { if (zipRetry) tcOcrStoreSet_(key, text); else tcOcrStorePut_(key, text); }
  return text;
}

// [2026.10.17 조사 묶음06·08 — 통장 사진·은행 앱 캡처] 글자인식이 표 칸·줄 순서를 섞은 사진에서도 잔액 칸은 위에서 아래 순서대로 읽힌다 →
//  금액 글자(₩·#·W·*·± 붙은 것, 쉼표 금액)를 적힌 순서대로 모아 "앞 잔액 ± 어떤 금액 = 다음 잔액"으로 이어지는 가장 긴 잔액 사슬을 찾고,
//  사슬의 한 걸음 = 거래 한 줄(금액·출금/입금·거래 뒤 잔액)로 본다. 사슬로 검산된 줄만 금액을 확정한다(지어내지 않음).
//  날짜: 통장 사본은 줄 앞 순번이 날짜에 붙어 읽힌다("1820260630" = 18번째 줄 2026-06-30) — 사슬 걸음 수와 순번 범위가 맞으면 순번으로,
//  아니면 금액 글자 앞에 마지막으로 나온 날짜. 상대방(적요): 통장 사본은 금액 뒤 글자(없으면 앞), 앱 화면은 금액 앞 글자. 구분: 잔액 뒤 글자(NH체크·급여 등).
//  맞춘 서류: 고객Z 농협 통장 사진(2026-06-30 경기주택도시 217,221,280 입금), 고객J "거래내역조회" 휴대폰 화면, 고객Q "고객Q 관계인2 지출2" 앱 목록
//  돌려주는 것: { rows: [docBankStmtParse_와 같은 거래 줄], bals: 잔액 사슬, steps } | null
function docBankChainRows_(t, opt) {
  opt = opt || {};
  t = String(t || '');
  var book = !!opt.book;
  // 금액 글자 — 기호 없는 수는 쉼표 금액만(지점번호·계좌번호·수표번호는 뺀다). "45,842.363"처럼 쉼표가 점으로 읽힌 것도 금액
  var toks = [], re = /(^|[^\d,.\-#₩￦W*＊])([+\-－]\s?)?([₩￦W#*＊]\s?)?(\d{1,3}(?:[,.]\d{3})+|\d{1,6})(?![,.]\d|-\d)(\s*원)?/g, m;
  while ((m = re.exec(t))) {
    var raw = m[4], pre = !!m[3], won = !!m[5];
    // 뒤에 숫자가 붙었으면 금액이 아님 — 다만 기호 붙은 쉼표 금액 뒤에 지점번호가 붙어 읽힌 것("*100.849.52970795")은 금액
    if (/\d/.test(t.charAt(m.index + m[0].length - (m[5] || '').length)) && !(pre && /[,.]/.test(raw))) continue;
    if (!/[,.]/.test(raw) && !pre) continue; // 기호 없는 맨 숫자(지점번호·연도·순번)는 금액 아님
    if (/\./.test(raw) && !/,/.test(raw) && !pre && !won) continue; // "26.10.10" 같은 날짜 조각
    if (!/^\d{1,3}(?:[,.]\d{3})+$/.test(raw) && !pre) continue;
    var v = Number(raw.replace(/[,.]/g, '')); if (!v) continue;
    var sg = m[2] ? (/[+]/.test(m[2]) ? 1 : -1) : 0;
    toks.push({ v: v, s: sg, at: m.index + m[1].length, end: re.lastIndex, won: won });
  }
  if (toks.length < 4) return null;
  var n = toks.length, W = 14, sv = function (k) { return toks[k].s < 0 ? -toks[k].v : toks[k].v; };
  // 걸음 i → j에 쓸 금액 글자 k(가까운 것부터, 부호가 적혔으면 방향과 맞아야)
  var amtFor = function (i, j) {
    var d = sv(j) - sv(i); if (!d) return -1;
    var best = -1, bd = 1e9;
    // [2026.10.20 2번 밤샘 6바퀴 — 속도] 같은 금액 글자의 자리 목록(posByV, 오름차순)만 본다 — 예전엔 창 안 모든 글자를 훑고, 못 찾으면 글 전체를 다시 훑어
    //  (토큰 수)² 걸렸다(큰 통장 사건 처리 시간의 13%). 고르는 규칙(가장 가까운 것, 같으면 앞 자리)과 결과는 그대로
    var ps = posByV[Math.abs(d)] || [], lo = Math.max(0, i - W), hi = Math.min(n - 1, j + W);
    for (var pi = 0; pi < ps.length; pi++) {
      var k = ps[pi]; if (k < lo) continue; if (k > hi) break;
      if (k === i || k === j) continue;
      if (toks[k].s && (toks[k].s > 0) !== (d > 0)) continue;
      var dist = k > i && k < j ? 0 : Math.min(Math.abs(k - i), Math.abs(k - j));
      if (dist < bd) { bd = dist; best = k; }
    }
    // [2026.10.18] 창 밖의 금액 — 사진은 금액 칸과 잔액 칸이 멀리 떨어져 읽히기도 한다(고객A 신한: 819,160원). 10만원 넘는 금액이 글 전체에 딱 한 번 있으면 그 글자
    if (best < 0 && Math.abs(d) >= 100000 && vCnt[Math.abs(d)] === 1) for (var p2 = 0; p2 < ps.length; p2++) { var k2 = ps[p2]; if (k2 !== i && k2 !== j && !(toks[k2].s && (toks[k2].s > 0) !== (d > 0))) { best = k2; break; } }
    return best;
  };
  var L = toks.map(function () { return 0; }), from = toks.map(function () { return -1; }), via = toks.map(function () { return -1; });
  // [2026.10.18 정밀분석 원인2] 세 번 넘게 되풀이된 금액(CD출금 1,000,000원 ×9 등)은 거래 금액이지 잔액이 아니다 — 잔액 마디로 쓰면 엉뚱한 긴 사슬이 이겨
  //  앞 거래 14줄이 통째로 버려졌다(고객A 신한 통장 사진: 19줄 중 5줄만). 잔액은 줄마다 바뀌므로 같은 값이 세 번 이상 나오지 않는다
  var vCnt = {}; toks.forEach(function (tk) { vCnt[tk.v] = (vCnt[tk.v] || 0) + 1; });
  var posByV = {}; toks.forEach(function (tk, ix) { (posByV[tk.v] = posByV[tk.v] || []).push(ix); }); // 금액 → 글자 자리(오름차순)
  var balOk = function (k) { return vCnt[toks[k].v] < 3; };
  for (var j = 1; j < n; j++) for (var i = Math.max(0, j - W); i < j; i++) {
    if (L[i] + 1 <= L[j] || !balOk(i) || !balOk(j)) continue;
    var k = amtFor(i, j); if (k < 0) continue;
    L[j] = L[i] + 1; from[j] = i; via[j] = k;
  }
  var top = 0; L.forEach(function (v, i2) { if (v > L[top] || (v === L[top] && v && i2 > top)) top = i2; });
  if (L[top] < (opt.min || 3)) return null;
  var chain = []; for (var q = top; q !== -1; q = from[q]) chain.unshift(q);
  // 걸음에 쓴 금액 글자가 사슬의 다른 잔액이면 그 앞은 잘못 이어진 것(칸이 섞인 첫 줄) — 그 걸음까지 잘라낸다
  //  [2026.10.18] 그 금액 글자가 사슬의 앞쪽 잔액이면 잘못된 쪽은 이 걸음(뒤 꼬리) — 앞 토막을 남긴다(고객A 신한: 4,366,600을 금액으로 쓴 마지막 걸음 때문에 사슬이 통째로 버려졌다)
  for (var c2 = 1; c2 < chain.length; c2++) { var vi = chain.indexOf(via[chain[c2]]); if (vi === -1) continue; if (vi < c2) { chain = chain.slice(0, c2); break; } chain = chain.slice(c2); c2 = 0; }
  if (chain.length - 1 < (opt.min || 3)) return null;
  // 날짜·시각 표지
  var dates = [], dre = /(^|[^\d:])(?:(\d{1,2}) ?)?((?:19|20)\d{2})[.\-\/]?(0[1-9]|1[0-2])[.\-\/]?(0[1-9]|[12]\d|3[01])(?!\d{4})/g, dm;
  while ((dm = dre.exec(t))) {
    var at = dm.index + dm[1].length, aft = t.slice(dre.lastIndex, dre.lastIndex + 3), bef = t.slice(Math.max(0, at - 3), at);
    if (/^\s*[~∼\-–]\s*\d/.test(aft) || /[~∼\-–]\s*$/.test(bef)) continue; // 조회기간
    if (/^[.\-\/]\d/.test(aft)) continue;
    var sep = /[.\-\/]/.test(t.slice(at, dre.lastIndex));
    if (!sep && !dm[2] && !book) continue; // 붙은 8자리는 통장 순번 줄에서만
    dates.push({ at: at, end: dre.lastIndex, d: dm[3] + '-' + dm[4] + '-' + dm[5], seq: dm[2] ? Number(dm[2]) : null });
  }
  // 신한은행 등 통장은 날짜가 6자리(YYMMDD — "4260629 모바일" = 4번째 줄 2026-06-29). 8자리 날짜 줄이 거의 없는 통장 사본에서만
  if (book && dates.filter(function (d) { return d.seq !== null; }).length < 3) {
    var d6 = /(^|[^\d\-.,*＊₩#])(?:(\d{1,2}) ?)?(2\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d{2})/g, y6;
    while ((y6 = d6.exec(t))) {
      var at6 = y6.index + y6[1].length;
      if (!y6[2] && !/^\d?\s*[가-힣A-Z]/.test(t.slice(d6.lastIndex, d6.lastIndex + 4))) continue; // 순번도 없고 뒤에 적요도 없으면 날짜가 아님
      dates.push({ at: at6, end: d6.lastIndex, d: '20' + y6[3] + '-' + y6[4] + '-' + y6[5], seq: y6[2] ? Number(y6[2]) : null });
    }
    dates.sort(function (a, b) { return a.at - b.at; });
  }
  var times = [], tre = /(?:^|[^\d:])(\d{1,2}:\d{2})(?::\d{2})?(?![\d:])/g, tm;
  while ((tm = tre.exec(t))) times.push({ at: tm.index, v: tm[1] });
  var lastBefore = function (arr, at) { var x = null; arr.forEach(function (a) { if (a.at < at) x = a; }); return x; };
  // 순번 → 날짜(처음 나온 것) — 걸음 수와 순번 범위가 맞을 때만 순번으로 짝짓는다
  var seqD = {}, seqs = [];
  dates.forEach(function (d) { if (d.seq !== null && d.seq >= 1 && seqD[d.seq] === undefined) { seqD[d.seq] = d.d; seqs.push(d.seq); } });
  var maxSeq = seqs.length ? Math.max.apply(null, seqs) : 0, steps = chain.length - 1, s0 = maxSeq - steps + 1;
  var bySeq = book && seqs.length >= Math.ceil(steps * 0.6) && s0 >= 1 && seqs.filter(function (s) { return s >= s0; }).length >= Math.ceil(steps * 0.6);
  var seqDate = function (s) {
    if (seqD[s]) return seqD[s];
    var a = null, b = null, x;
    for (x = s - 1; x >= s0 && !a; x--) a = seqD[x] || null;
    for (x = s + 1; x <= maxSeq && !b; x++) b = seqD[x] || null;
    return a && a === b ? a : '';
  };
  // 글자 조각 — 금액 글자 사이의 한글 낱말(잡글자 걸러냄)
  var words = function (a, b) {
    var s = t.slice(a, b).split(/\n|\d{1,2} ?(?:19|20)\d{6}|\d{1,2} ?2\d(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?!\d{2})|[₩￦#*＊]\s?\d|\d{1,3}[,.]\d{3}/)[0]; // 다음 줄 순번·날짜·금액 앞까지
    return (s.replace(/(?:19|20)\d{6}|\d{1,2}:\d{2}(?::\d{2})?/g, ' ').match(/[가-힣A-Za-z()][가-힣A-Za-z()·\s]{0,24}/g) || []).map(function (w) { return w.replace(/\s+/g, ' ').trim(); })
      .filter(function (w) { return w && /[가-힣]{2}|[A-Z]{2}/.test(w) && !/^(원|잔액|직접입력|전체|과거순|MEMO)$/.test(w); }).join(' ').slice(0, 30);
  };
  var wordsBack = function (k) {
    var a = Math.max(k > 0 ? toks[k - 1].end : 0, (lastBefore(dates, toks[k].at) || { at: 0 }).at), s = t.slice(a, toks[k].at);
    s = s.replace(/(?:19|20)\d{2}[.\-\/]?\d{2}[.\-\/]?\d{2}(?:\s*\([^)]*\))?|\d{1,2}:\d{2}(?::\d{2})?|#\s?\d[\d\-]*/g, ' ');
    return (s.match(/[가-힣A-Za-z()][가-힣A-Za-z()·]{1,24}/g) || []).filter(function (w) { return /[가-힣]{2}/.test(w) && !/^(잔액|직접입력|전체|과거순|대체|원)$/.test(w); }).join(' ').slice(0, 30);
  };
  var rows = [];
  chain.forEach(function (j2, x) {
    if (!x) return;
    var i2 = chain[x - 1], k2 = via[j2], d = sv(j2) - sv(i2), tk = toks[k2];
    var dt = '';
    if (bySeq) dt = seqDate(s0 + x - 1);
    if (!dt) { var ld = lastBefore(dates, tk.at); dt = ld ? ld.d : ''; }
    var ltm = lastBefore(times, tk.at), ldd = lastBefore(dates, tk.at);
    var nextAt = k2 + 1 < n ? toks[k2 + 1].at : t.length;
    var who = book ? (words(tk.end, nextAt) || wordsBack(k2)) : (wordsBack(k2) || words(tk.end, nextAt));
    // 통장 사본은 거래 내용(상대방)이 날짜 줄에 바로 이어 찍힌다("7260714 타행환 고객D 관계인3") — 그 줄 글자를 먼저, 채널 낱말(모바일·폰뱅킹)뿐이면 금액 뒤 글자를 붙인다
    if (book && bySeq) {
      var dEnt = dates.filter(function (d) { return d.seq === s0 + x - 1; })[0];
      var dl = dEnt ? words(dEnt.end, Math.min(t.length, dEnt.end + 50)) : '';
      dl = dl.replace(/^(?:[A-Z]{1,3}\s+)+/, '').trim();
      if (dl) who = /^(모바일|폰뱅킹|인터넷|이체|PC|CMS|ATM|타행|대체|[A-Z]{1,3})(\s|$)/.test(dl) && dl.split(' ').length === 1 ? dl + ' ' + who : dl;
    }
    var kind = book ? words(toks[j2].end, j2 + 1 < n ? toks[j2 + 1].at : t.length) : '';
    rows.push({ 날짜: dt, 시각: ltm && (!ldd || ltm.at > ldd.at) ? ltm.v : '', 구분: kind, 내용: who, 적요: '', 출금액: d < 0 ? -d : 0, 입금액: d > 0 ? d : 0, 금액: Math.abs(d), 잔액: sv(j2), 입금: d > 0, 잔액검산: true, 짝확인필요: false, 순번: bySeq ? s0 + x - 1 : undefined });
  });
  // [2026.10.18 3차 수정 K] 사슬이 끊긴 사진 첫·끝 줄을 버리지 않는다 — 앱·화면 사진(통장 사본 말고)에서 사슬 앞뒤에 남은 금액 글자(부호 ±가 적힌 것)는
  //  거래 한 줄의 후보로 남긴다. 금액·부호는 사진 글자 그대로, 잔액은 사슬 첫 마디(그 줄 바로 뒤에 적힌 잔액)일 때만 — 앞 잔액이 사진 밖이라 검산은 못 함(잔액검산 false·사슬밖 표시).
  //  고객J 「거래내역조회」 휴대폰 화면: 사슬은 14:05~14:30 4줄뿐이라 14:01 +370,510(장기수선충당금)과 15:22 −2,000,000(10만원권 — 취득 중개보수 지급) 줄이 버려졌다.
  //  사슬의 잔액·금액과 같은 값(겹쳐 읽힌 글자)과 1천원 미만·날짜를 못 정한 글자는 넣지 않는다(지어내지 않음). 통장 사본(book)은 순번 날짜 짝짓기가 따로 있어 그대로 둔다
  if (!book && rows.length) {
    var usedV = {}; chain.forEach(function (q) { usedV[toks[q].v] = 1; if (via[q] >= 0) usedV[toks[via[q]].v] = 1; });
    var looseOk = function (k) { var tk = toks[k]; return tk && tk.s !== 0 && tk.v >= 1000 && !usedV[tk.v]; }; // 부호(±)가 적힌 금액만 — 부호 없는 글자는 금액인지 잔액인지 모름
    var looseRow = function (k, balV, shownV) {
      var tk = toks[k], ld = lastBefore(dates, tk.at), ltm = lastBefore(times, tk.at);
      if (!ld) return null;
      return { 날짜: ld.d, 시각: ltm && ltm.at > ld.at ? ltm.v : '', 구분: '', 내용: wordsBack(k) || words(tk.end, k + 1 < n ? toks[k + 1].at : t.length), 적요: '',
        출금액: tk.s < 0 ? tk.v : 0, 입금액: tk.s > 0 ? tk.v : 0, 금액: tk.v, 잔액: balV, 잔액표시: shownV, 입금: tk.s > 0 ? true : tk.s < 0 ? false : null, 잔액검산: false, 짝확인필요: false, 사슬밖: true };
    };
    var lead = chain[0] - 1, lr = looseOk(lead) ? looseRow(lead, sv(chain[0])) : null;
    if (lr) rows.unshift(lr);
    var tail = [], last = chain[chain.length - 1];
    for (var k3 = last + 1; k3 < n && tail.length < 3; k3++) {
      if (!looseOk(k3)) continue;
      var nb = looseOk(k3 + 1) ? sv(k3 + 1) : undefined; // 바로 뒤 금액 글자는 그 줄의 잔액(표시만 — 검산 안 됨)
      var tr = looseRow(k3, null, nb); if (tr && tr.날짜 >= rows[rows.length - 1].날짜) tail.push(tr);
      if (nb !== undefined) k3++;
    }
    rows = rows.concat(tail);
  }
  return { rows: rows, bals: chain.map(sv), steps: steps, bySeq: bySeq };
}

// [2026.10.15] 통장 사본(거래하신 내용 — 맡기신 금액·찾으신 금액). 글자인식이 표를 섞어 거래 줄과 금액 칸을 짝짓지 못한다 →
// 거래 줄은 날짜(YYMMDD, 앞에 줄번호가 붙음)·내용만, 금액은 문서에 나온 금액 목록으로 둔다. 쓰는 쪽은 "증여자 이름이 적힌 거래 줄"의 날짜와
// "계약서 금액이 통장에 있음"을 함께 볼 때만 이체로 인정한다(금액을 지어내지 않음).
function docPassbookParse_(t) {
  if (!/거\s*래\s*하\s*신\s*내\s*용|맡\s*기\s*신\s*금\s*액/.test(t) || !/찾\s*으\s*신/.test(t)) return null;
  var r = { 종류: '통장 사본', 은행: '', 예금주: '', 계좌번호: '', 거래: [], 금액목록: [], 경고: [], 통장: true };
  var m = /(신한|국민|우리|하나|농협|기업|SC제일|씨티|카카오|토스|케이|수협|부산|대구|경남|광주|전북|제주|새마을|신협|우체국)\s*(은행|뱅크)?/.exec(t); if (m) r.은행 = m[1] + (m[2] || '');
  m = /(\d{3,6}-\d{2,6}-\d{3,8})(?:\([\d-]+\))?\s*([가-힣]{2,5})/.exec(t); if (m) { r.계좌번호 = m[1]; r.예금주 = m[2]; }
  var re = /(?:^|\s)(\d{0,2}?)(2\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?=[A-Z0-9]{0,3}\s|[A-Z]{1,3}|\s|$)\s*([^\s\d*\\]{0,6})?\s*([가-힣][가-힣()]{1,14})?/g, x;
  while ((x = re.exec(t))) r.거래.push({ 날짜: '20' + x[2] + '-' + x[3] + '-' + x[4], 내용: [x[5] || '', x[6] || ''].join(' ').trim(), 금액: null, 잔액: null, 적요: '' });
  (t.match(/\d{1,3}(?:[.,]\d{3})+/g) || []).forEach(function (a) { var v = Number(a.replace(/[.,]/g, '')); if (v >= 1000 && r.금액목록.indexOf(v) === -1) r.금액목록.push(v); });
  if (!r.거래.length) return null;
  // [2026.10.17 조사 보고] 통장 금액은 "*1,000,000"처럼 별표가 앞에 붙는다(금액 위변조 방지 표시) — 별표 금액을 적힌 순서대로 모으고,
  //  "앞 잔액 ± 이 금액 = 다음 잔액"으로 이어지는 별표 금액을 잔액으로 본다(고객A 신한 통장: *13,366,600 → *12,366,600 → … 찾으신 *1,000,000씩).
  //  거래 줄과 짝은 여전히 못 지으므로 잔액은 참고(마지막 잔액이 어느 날짜 것인지는 통장 마지막 거래일로만 안다)
  var stars = (t.replace(/(\d)\.(\d{3})(?!\d)/g, '$1,$2').match(/[*＊]\s*\d{1,3}(?:,\d{3})+/g) || []).map(function (a) { return Number(a.replace(/[^\d]/g, '')); });
  if (stars.length) {
    r.별표금액 = stars;
    var sset = {}; stars.forEach(function (v) { sset[v] = 1; });
    var best = stars.map(function () { return 1; }), from = stars.map(function () { return -1; });
    for (var j = 1; j < stars.length; j++) for (var i = Math.max(0, j - 12); i < j; i++) { var dv = Math.abs(stars[j] - stars[i]); if (dv && sset[dv] && dv !== stars[j] && best[i] + 1 > best[j]) { best[j] = best[i] + 1; from[j] = i; } }
    var top = 0; best.forEach(function (v, i2) { if (v >= best[top]) top = i2; });
    if (best[top] >= 3) { var ch = []; for (var q = top; q !== -1; q = from[q]) ch.unshift(stars[q]); r.잔액사슬 = ch; r.마지막잔액 = ch[ch.length - 1]; }
    r.마지막거래일 = r.거래.map(function (g) { return g.날짜; }).sort().slice(-1)[0] || '';
  }
  // [2026.10.17 통장 사진] 잔액 사슬로 거래 줄을 짝지을 수 있으면 거래 한 줄씩(날짜·상대방·출금·입금·잔액) — 통장목록으로 넘겨 비용·대금·보상금과 대조
  var ch = null; try { ch = docBankChainRows_(t, { book: true }); } catch (e) { ch = null; }
  if (ch && ch.rows.length >= 3) {
    r.거래 = ch.rows; r.통장목록 = true; r.서식 = '통장 사진(잔액 사슬)';
    r.검산 = { 맞음: ch.rows.length, 전체: ch.rows.length, 순서: '오래된순' };
    r.잔액사슬 = ch.bals; r.마지막잔액 = ch.bals[ch.bals.length - 1];
    r.마지막거래일 = ch.rows.map(function (g) { return g.날짜; }).filter(Boolean).sort().slice(-1)[0] || r.마지막거래일 || '';
    var noD = ch.rows.filter(function (g) { return !g.날짜; }).length; // 날짜 없는 줄은 대조에 쓰지 않을 뿐(값을 지어내지 않음) — 참고로만
    if (noD) r.참고 = ['날짜를 정하지 못한 거래 줄 ' + noD + '개 — 대금·비용 대조에는 쓰지 않음(원문 확인)'];
    var wonB = function (n) { return n ? Number(n).toLocaleString('ko-KR') + '원' : ''; };
    var mdB = '### 통장 사본' + (r.은행 ? '(' + r.은행 + ')' : '') + ' — 거래 ' + ch.rows.length + '줄(앞 잔액 ± 금액 = 잔액으로 짝지음' + (ch.bySeq ? ', 날짜는 줄 순번으로' : '') + ')\n\n' + docMdTable_([['예금주', r.예금주], ['계좌번호', r.계좌번호]])
      + '\n\n| 날짜 | 상대방·내용 | 구분 | 출금 | 입금 | 잔액 |\n|---|---|---|---|---|---|\n'
      + ch.rows.map(function (g) { return '| ' + [g.날짜, g.내용, g.구분, wonB(g.출금액), wonB(g.입금액), Number(g.잔액).toLocaleString('ko-KR')].map(function (v) { return String(v).replace(/\|/g, '/'); }).join(' | ') + ' |'; }).join('\n')
      + '\n\n- 참고: 사슬로 이어지지 않은 줄(사진 첫·끝 줄, 흐린 줄)은 넣지 않음' + (r.참고 || []).map(function (w) { return '\n- 참고: ' + w; }).join('') + (r.경고.length ? '\n' + r.경고.map(function (w) { return '- ⚠ ' + w; }).join('\n') : '');
    return { type: 'banktx', label: '통장 사본', result: r, md: mdB };
  }
  r.경고.push('통장 사본은 거래 줄과 금액 칸을 글자인식으로 짝짓지 못함 — 계약서 금액·증여자 이름이 함께 있을 때만 이체로 봄');
  var md = '### 통장 사본' + (r.은행 ? '(' + r.은행 + ')' : '') + '\n\n| 항목 | 내용 |\n|---|---|\n| 예금주 | ' + (r.예금주 || '') + ' |\n| 계좌번호 | ' + (r.계좌번호 || '') + ' |\n\n| 날짜 | 내용 |\n|---|---|\n'
    + r.거래.map(function (g) { return '| ' + g.날짜 + ' | ' + String(g.내용).replace(/\|/g, '/') + ' |'; }).join('\n') + '\n\n- 참고: ' + r.경고[0]
    + (r.잔액사슬 ? '\n- 잔액(별표 금액끼리 앞 잔액 ± 금액 = 다음 잔액으로 이어진 것): ' + r.잔액사슬.map(function (v) { return v.toLocaleString('ko-KR'); }).join(' → ') + '원 — 마지막 거래일 ' + r.마지막거래일 : '');
  return { type: 'banktx', label: '통장 사본', result: r, md: md };
}

// =========================================================
// [2026.10.17 세무사님 원칙 — 모든 서류는 내용 항목별로] 통장 거래내역을 거래 한 줄씩(날짜·시각·구분·적요/상대방·출금·입금·잔액)
//  서식: ① 구분자 표 — 국민은행 계좌거래내역 .txt("No|거래일시|보낸분/받는분|출금액(원)|입금액(원)|잔액(원)|…")·CSV: 머리줄의 칸 이름으로 칸을 정함
//        ② 은행 출력물·앱 목록 화면 — 머리글 "거래일시 구분 적요 입금액 출금액 잔액": 날짜마다 한 줄, 금액 순서 = 머리글 순서
//        ③ 앱 거래내역조회 화면 — "2025.01.04(토)" 날짜 줄 아래 시각 줄마다 한 거래(적요 → ±금액원 → 잔액원)
//  줄마다 잔액 검산(앞 거래 잔액 − 출금 + 입금 = 이 줄 잔액 — 최신순·오래된순 중 더 많이 맞는 쪽)으로 출금·입금을 확인한다.
//  글자인식이 줄·칸 순서를 섞어 금액 짝이 불확실하면 그 줄은 짝확인필요로 남긴다(금액을 지어내지 않음).
//  맞춘 서류: 고객Q "취득 중개수수료 계좌거래"·"물막이공사 계좌입금" PDF와 지출 사진, 고객S 국민은행 계좌거래내역 .txt
//  돌려주는 것: banktx { 거래: [{ 날짜, 시각, 구분, 내용, 적요, 출금액, 입금액, 금액, 잔액, 입금(true/false/null), 잔액검산, 짝확인필요 }], 통장목록: true }
// =========================================================
var BANK_STMT_NAME_RE_ = /(신한|국민|KB|우리|하나|농협|NH|기업|IBK|SC제일|씨티|카카오|토스|케이|수협|부산|대구|경남|광주|전북|제주|새마을|신협|우체국)\s*(은행|뱅크)/;

function docBankStmtNum_(s) {
  var m = /^\s*([+-])?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*원?\s*$/.exec(String(s == null ? '' : s).replace(/"/g, ''));
  return m ? (m[1] === '-' ? -1 : 1) * Number(m[2].replace(/,/g, '')) : null;
}

function docBankStmtDate_(s) { var m = /((?:19|20)\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/.exec(String(s || '')); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : ''; }

function docBankStmtSplit_(line, sep) {
  if (sep !== ',') return line.split(sep);
  var out = [], cur = '', q = false;
  for (var i = 0; i < line.length; i++) { var ch = line.charAt(i); if (ch === '"') { q = !q; continue; } if (ch === ',' && !q) { out.push(cur); cur = ''; continue; } cur += ch; }
  out.push(cur);
  return out;
}

function docBankStmtRow_(r, d, tm, kind, who, memo, outA, inA, bal, unsure) {
  var a = outA > 0 ? outA : inA > 0 ? inA : 0;
  if (!d || !a) return;
  r.거래.push({ 날짜: d, 시각: tm || '', 구분: kind || '', 내용: String(who || '').trim(), 적요: String(memo || '').trim(), 출금액: outA > 0 ? outA : 0, 입금액: inA > 0 ? inA : 0, 금액: a, 잔액: bal, 입금: outA > 0 && !(inA > 0) ? false : inA > 0 && !(outA > 0) ? true : null, 잔액검산: null, 짝확인필요: !!unsure });
}

// ① 구분자 표(| · 탭 · 쉼표) — 머리줄의 칸 이름으로 칸 위치를 정한다. 머리줄이 없는 CSV는 "날짜 칸 + 지급/입금 칸 + 금액·잔액" 모양으로
function docBankStmtDelimRows_(t, r) {
  var lines = t.split(/\r?\n/), cols = null, sep = '', hi = -1;
  for (var i = 0; i < Math.min(lines.length, 60) && !cols; i++) {
    var L = lines[i], s = L.split('|').length >= 5 ? '|' : L.split('\t').length >= 5 ? '\t' : L.split(',').length >= 5 ? ',' : '';
    if (!s) continue;
    var c = { d: -1, tm: -1, out: -1, inn: -1, amt: -1, kind: -1, bal: -1, memo: [] };
    docBankStmtSplit_(L, s).forEach(function (x, k) {
      x = x.replace(/[\s"]+/g, '');
      if (c.d < 0 && /^(거래)?(일시|일자|날짜)$|^거래일$/.test(x)) c.d = k;
      else if (/^(거래)?(시간|시각)$/.test(x)) c.tm = k;
      else if (/^(출금|찾으신|지급)(액|금액)?(\(원\))?$/.test(x)) c.out = k;
      else if (/^(입금|맡기신)(액|금액)?(\(원\))?$/.test(x)) c.inn = k;
      else if (/^거래금액(\(원\))?$/.test(x)) c.amt = k;
      else if (/^(입출금|입출금구분|거래구분|입출구분)$/.test(x)) c.kind = k;
      else if (/잔액|잔고/.test(x)) c.bal = k;
      else if (/보낸분|받는분|적요|내용|메모|통장표시|기재|상대|거래처|의뢰인|수취인/.test(x)) c.memo.push(k);
    });
    if (c.d >= 0 && (c.out >= 0 && c.inn >= 0 || c.amt >= 0)) { cols = c; sep = s; hi = i; }
  }
  var n0 = r.거래.length;
  if (cols) {
    for (var j = hi + 1; j < lines.length; j++) {
      var cs = docBankStmtSplit_(lines[j], sep); if (cs.length <= cols.d) continue;
      var d = docBankStmtDate_(cs[cols.d]); if (!d) continue;
      var tmm = /(\d{1,2}:\d{2}(?::\d{2})?)/.exec(cols.tm >= 0 ? cs[cols.tm] : cs[cols.d]);
      var outA = cols.out >= 0 ? docBankStmtNum_(cs[cols.out]) : null, inA = cols.inn >= 0 ? docBankStmtNum_(cs[cols.inn]) : null;
      if (cols.amt >= 0) { var av = docBankStmtNum_(cs[cols.amt]), kd = cols.kind >= 0 ? String(cs[cols.kind] || '') : ''; if (av) { if (/지급|출금|찾/.test(kd) || av < 0) outA = Math.abs(av); else if (/입금|맡/.test(kd)) inA = av; else outA = null; } }
      var memos = cols.memo.map(function (k) { return String(cs[k] || '').replace(/"/g, '').replace(/[\s　]+/g, ' ').trim(); }).filter(Boolean);
      var bal = cols.bal >= 0 ? docBankStmtNum_(cs[cols.bal]) : null;
      // 거래금액 칸만 있고 지급/입금 구분이 없으면 방향은 비워 두고 잔액 검산으로 정한다
      if (outA === null && inA === null && cols.amt >= 0) { var av2 = docBankStmtNum_(cs[cols.amt]); if (av2) r.거래.push({ 날짜: d, 시각: tmm ? tmm[1] : '', 구분: '', 내용: memos[0] || '', 적요: memos.slice(1).join(' '), 출금액: 0, 입금액: 0, 금액: Math.abs(av2), 잔액: bal, 입금: null, 잔액검산: null, 짝확인필요: false }); continue; }
      docBankStmtRow_(r, d, tmm ? tmm[1] : '', '', memos[0], memos.slice(1).join(' '), outA || 0, inA || 0, bal);
    }
  } else {
    // 머리줄 없는 CSV(신한은행 내려받기: "은행,계좌,순번,2016-05-27,지급,,329,970,4,136,971,신한카드") — 날짜 칸 뒤 지급/입금 칸이 있는 줄이 셋 이상일 때만
    var hits = lines.filter(function (L) { return L.split(',').length >= 5 && /(?:^|,)\s*(지급|입금|출금)\s*(?:,|$)/.test(L) && docBankStmtDate_(L); });
    if (hits.length < 3) return false;
    hits.forEach(function (L) {
      var cs = docBankStmtSplit_(L, ','), di = -1, ki = -1;
      cs.forEach(function (x, k) { if (di < 0 && docBankStmtDate_(x) && /^\s*(?:19|20)\d{2}[.\-\/]\d{1,2}[.\-\/]\d{1,2}/.test(x)) di = k; else if (ki < 0 && di >= 0 && /^\s*(지급|입금|출금)\s*$/.test(x)) ki = k; });
      if (di < 0 || ki < 0) return;
      var nums = [], txt = [];
      cs.slice(ki + 1).forEach(function (x) { var v = docBankStmtNum_(x); if (v !== null && String(x).trim()) nums.push(v); else if (String(x).trim()) txt.push(String(x).trim()); });
      if (!nums.length) return;
      var outF = /지급|출금/.test(cs[ki]);
      docBankStmtRow_(r, docBankStmtDate_(cs[di]), '', cs[ki].trim(), txt[txt.length - 1] || '', '', outF ? Math.abs(nums[0]) : 0, outF ? 0 : Math.abs(nums[0]), nums.length > 1 ? nums[1] : null);
    });
  }
  if (r.거래.length > n0) { r.서식 = '구분자 표'; return true; }
  return false;
}

// ② 출력물·앱 목록 — 머리글의 출금액·입금액·잔액 순서대로 금액을 짝짓는다
function docBankStmtTableRows_(t, r) {
  var flat = t.replace(/\s+/g, ' ');
  var hm = /거\s*래\s*일\s*[시자]/.exec(flat); if (!hm) return false;
  var hseg = flat.slice(hm.index, hm.index + 160);
  // [2026.10.18 정밀분석 원인13] 머리글 낱말 — "출금액·입금액·찾으신·맡기신"만 받아 "출금 | 입금 | 잔액"(기업)·"지급(원) | 입금(원)"(우리) 출력물이 칸 위치 규칙을 못 탔다
  //  (예금거래실적증명서의 "지급금액·입금금액"은 받지 않는다 — 스캔이 칸을 흩어 표 줄을 못 만든다: 고객A 우리은행 스캔에서 틀린 줄 2개가 생김)
  var IN_H = /입\s*금\s*액|맡\s*기\s*신|입\s*금\s*\(\s*원\s*\)|입\s*금(?=\s*\||\s*$|\s+(?:출\s*금|지\s*급|잔\s*액))/, OUT_H = /출\s*금\s*액|찾\s*으\s*신|(?:출\s*금|지\s*급)\s*\(\s*원\s*\)|출\s*금(?=\s*\||\s*$|\s+(?:입\s*금|잔\s*액))/;
  if (!/적\s*요|구\s*분|내\s*용|받\s*는/.test(hseg) || !(OUT_H.test(hseg) || IN_H.test(hseg))) return false;
  var cut = hseg.search(/(?:19|20)\d{2}[.\-]\d{2}[.\-]\d{2}/); if (cut > 0) hseg = hseg.slice(0, cut);
  if (!/잔\s*액/.test(hseg) && !/출\s*금\s*액|입\s*금\s*액|찾\s*으\s*신|맡\s*기\s*신/.test(hseg)) return false; // 새로 받은 짧은 낱말은 잔액 칸이 함께 있을 때만(본문 "입금" 낱말 오걸림 방지)
  var order = [['in', hseg.search(IN_H)], ['out', hseg.search(OUT_H)], ['bal', hseg.search(/잔\s*액/)]].filter(function (x) { return x[1] >= 0; }).sort(function (a, b) { return a[1] - b[1]; }).map(function (x) { return x[0]; });
  // 화면이 "출금" 거래만 보여 주면(입금 칸 없음) 금액은 모두 출금
  var outOnly = order.indexOf('in') === -1;
  var body = flat.slice(hm.index + 20).replace(/(^|\s)[QO](?=\s+\d)/g, '$1 0');
  var re = /((?:19|20)\d{2})[.\-](\d{2})[.\-](\d{2})(?![\d])/g, x, starts = [];
  while ((x = re.exec(body))) { if (/^\s*[~∼]/.test(body.slice(re.lastIndex, re.lastIndex + 3)) || /[~∼]\s*$/.test(body.slice(Math.max(0, x.index - 3), x.index))) continue; starts.push({ at: x.index, end: re.lastIndex, d: x[1] + '-' + x[2] + '-' + x[3] }); }
  if (starts.length < 1) return false;
  var n0 = r.거래.length, empty = 0, over = 0;
  starts.forEach(function (st, i) {
    var seg = body.slice(st.end, i + 1 < starts.length ? starts[i + 1].at : Math.min(body.length, st.end + 300));
    var tmm = /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$)/.exec(seg);
    seg = seg.replace(/(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?(?=\s|$)/g, ' ');
    var nums = [], nre = /(?:^|\s)(-\s?)?(\d{1,3}(?:,\d{3})+|0)(?=\s|원|\(|$)/g, y, firstAt = -1;
    while ((y = nre.exec(seg))) { if (firstAt < 0) firstAt = y.index; nums.push({ v: Number(y[2].replace(/,/g, '')), neg: !!y[1] }); }
    if (!nums.length) { empty++; return; }
    var words = seg.slice(0, firstAt).replace(/[|•·]/g, ' ').split(/\s+/).filter(function (w) { return w && /[가-힣A-Za-z]/.test(w); });
    var kind = words.length > 1 ? words[0] : '', who = words.length > 1 ? words.slice(1).join(' ') : words.join(' ');
    var outA = 0, inA = 0, bal = null, unsure = false;
    if (nums.length >= order.length && order.length >= 2) {
      if (nums.length > order.length) { over++; unsure = true; }
      var pick = nums.slice(0, order.length);
      order.forEach(function (k, j) { var v = pick[j].v * (pick[j].neg ? -1 : 1); if (k === 'in') inA = Math.abs(v); else if (k === 'out') outA = Math.abs(v); else bal = v; });
      if (outA && inA) unsure = true;
    } else if (nums.length === 2 && order.indexOf('bal') !== -1) {
      // 금액 칸 하나만 읽힘(앱 목록 — 출금은 "- 1,100,000") + 잔액
      bal = nums[1].v * (nums[1].neg ? -1 : 1);
      if (nums[0].neg || outOnly) outA = nums[0].v; else { r.거래.push({ 날짜: st.d, 시각: tmm ? tmm[1] : '', 구분: kind, 내용: who, 적요: '', 출금액: 0, 입금액: 0, 금액: nums[0].v, 잔액: bal, 입금: null, 잔액검산: null, 짝확인필요: false }); return; }
    } else if (nums.length === 1 && outOnly) outA = nums[0].v;
    else { empty++; return; } // 금액 칸 수가 머리글과 안 맞음 — 어느 금액인지 몰라 뺀다
    docBankStmtRow_(r, st.d, tmm ? tmm[1] : '', kind, who, '', outA, inA, bal, unsure);
  });
  if (r.거래.length === n0) return false;
  // 금액 없는 날짜 줄과 금액이 넘치는 줄이 함께 있으면 글자인식이 줄 순서를 섞은 것 — 그 문서의 짝은 모두 확인 필요
  if (empty && over) { r.거래.forEach(function (g) { g.짝확인필요 = true; }); r.경고.push('글자인식이 거래 줄 순서를 섞어(금액 없는 줄 ' + empty + '개·금액이 넘치는 줄 ' + over + '개) 금액 짝이 불확실 — 원문 확인'); }
  else if (empty) r.경고.push('금액을 읽지 못한 거래 줄 ' + empty + '개 — 그 줄은 빼고 정리함(원문 확인)');
  r.서식 = '출력물·목록 화면';
  return true;
}

// ②-2 [2026.11.20] 「구분 + 거래금액 한 칸 + 잔액」 명세표 — 입금·출금이 금액 한 칸이고 줄마다 「입금/출금(지급)」 낱말로 가른다
//  기업은행 계좌별거래명세표: "거래일 시간 구분 거래금액 잔액 거래점 …" → 줄 "2017-05-24 10:01:43 입금 100,000,000 100,001,774 불광역 …"
//  우체국 금융거래명세조회: "거래일자 거래시간 거래금액(원) 거래후잔액(원) 구분 …" → 줄 "2016-08-08 07:55:56 180,890 553,570 입금 999300 …"
//  ② 출력물 규칙은 입금·출금 칸 이름을 찾아 이 모양을 못 탔고, 사진용 잔액 사슬로 넘어가 날짜·금액·잔액을 엉뚱하게 짝지었다
//  (11-20 상속 사건 은행 PDF 금융거래 합치기 운영 시험 — 기업은행 441줄이 날짜가 뒤섞인 채 검산 맞음으로 나옴).
//  줄마다 날짜 → 시각 → [낱말 숫자 숫자] 또는 [숫자 숫자 낱말]만 받는다(머리 「출력 일시」·「조회기간」 날짜는 낱말이 없어 빠짐).
//  한 파일에 계좌가 여럿이면(우체국은 계좌마다 머리글) 줄마다 그 앞 「계좌번호」를 g.계좌로 붙이고, 검산은 같은 계좌끼리만 잇는다.
function docBankStmtKindAmtRows_(t, r) {
  // 「지급취 소」처럼 글자가 갈린 취소 줄(우체국 체크카드 승인 취소 — 돈이 되돌아옴)도 한 낱말로
  var flat = t.replace(/\s+/g, ' ').replace(/(입금|출금|지급)\s*취\s*소/g, '$1취소');
  var am = /거\s*래\s*금\s*액/.exec(flat); if (!am) return false;
  var hseg = flat.slice(Math.max(0, am.index - 80), am.index + 120);
  if (!/구\s*분/.test(hseg) || !/잔\s*액/.test(hseg) || !/거\s*래\s*일/.test(hseg)) return false;
  var accts = [], ar = /계\s*좌\s*번\s*호\s*[:：]?\s*\[?\s*(\d[\d-]{7,20}\d)/g, a;
  while ((a = ar.exec(flat))) accts.push({ at: a.index, no: a[1] });
  // 글자인식이 「계좌번호」 낱말을 번호 뒤로 밀어낸 머리글("계좌별거래명세표 285-039996-02-011 구계좌번호 …")도 계좌 경계로
  var ar2 = /명\s*세\s*(?:표|조\s*회)\s+(\d{2,6}-\d{2,8}-\d{2,8}(?:-\d{1,6})?)/g;
  while ((a = ar2.exec(flat))) if (!accts.some(function (q) { return Math.abs(q.at - a.index) < 200 && q.no === a[1]; })) accts.push({ at: a.index, no: a[1] });
  accts.sort(function (p, q) { return p.at - q.at; });
  var NUM = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)$/, KIND = /^(입금|출금|지급)(취소)?$/, TIME = /^\d{1,2}:\d{2}(?::\d{2})?$/;
  // 낱말 차례로 훑는다 — 줄 앞에 날짜가 붙은 모양(날짜 시각 …)과, 글자인식이 쪽마다 날짜를 줄에서 떼어 그 쪽 끝에 한 덩어리로 모은 모양
  //  (기업은행 PDF를 서버 글자인식으로 읽으면 "10:11:42 입금 0 0 …" 줄들 뒤에 "2017-04-19 0 2017-04-20 0 …"이 온다) 둘 다.
  //  뒤 모양은 쪽마다 날짜 수가 날짜 없는 줄 수와 같을 때만 차례로 짝짓고, 다르면 그 쪽 줄은 넣지 않는다(잔액 검산이 짝을 다시 확인).
  var DATE = /((?:19|20)\d{2})[.\-\/](\d{2})[.\-\/](\d{2})/, from = Math.max(0, am.index - 80), tks = [], tr = /\S+/g, y;
  while ((y = tr.exec(flat))) if (y.index >= from) tks.push({ s: y[0], at: y.index });
  var sOf = function (j) { return (tks[j] || {}).s || ''; };
  var rowAt = function (j) {
    var k = j, tm = '';
    if (TIME.test(sOf(k))) { tm = sOf(k); k++; }
    var w0 = sOf(k), w1 = sOf(k + 1), w2 = sOf(k + 2);
    if (KIND.test(w0) && NUM.test(w1) && NUM.test(w2)) return { tm: tm, kind: w0, amt: w1, bal: w2, next: k + 3 };
    if (NUM.test(w0) && NUM.test(w1) && KIND.test(w2)) return { tm: tm, kind: w2, amt: w0, bal: w1, next: k + 3 };
    return null;
  };
  var rows = [], pend = [], run = [], badPage = 0, lost = 0;
  var flushRun = function () {
    if (run.length && pend.length) { if (run.length === pend.length) pend.forEach(function (p, j) { p.d = run[j]; }); else { badPage++; lost += pend.length; } pend = []; }
    run = [];
  };
  for (var i = 0; i < tks.length; i++) {
    var s = tks[i].s, dm = DATE.exec(s);
    if (/^거래일/.test(s)) { flushRun(); continue; }
    if (dm && TIME.test(sOf(i + 1))) {
      var rw = rowAt(i + 1);
      if (rw) { flushRun(); rw.d = dm[1] + '-' + dm[2] + '-' + dm[3]; rw.start = i; rw.at = tks[i].at; rows.push(rw); i = rw.next - 1; continue; }
    }
    // 머리글 날짜(조회기간 "가 ~ 나", 출력 일시 "날짜 시각")는 쪽 날짜 덩어리에 넣지 않는다 — 다음 계좌 머리글이 앞 쪽 날짜 뒤에 붙어 온다
    if (dm) { if (pend.length && sOf(i - 1) !== '~' && sOf(i + 1) !== '~' && !TIME.test(sOf(i + 1))) run.push(dm[1] + '-' + dm[2] + '-' + dm[3]); continue; }
    if (TIME.test(s)) {
      var rt = rowAt(i);
      if (rt) { if (run.length) flushRun(); rt.d = ''; rt.start = i; rt.at = tks[i].at; rows.push(rt); pend.push(rt); i = rt.next - 1; continue; }
    }
  }
  flushRun();
  if (pend.length) lost += pend.length;
  var n0 = r.거래.length, used = {}, zeroOnly = {};
  rows.forEach(function (rw, idx) {
    if (!rw.d) return;
    var end = idx + 1 < rows.length ? rows[idx + 1].start : Math.min(tks.length, rw.next + 30);
    for (var e2 = rw.next; e2 < end; e2++) if (/^(거래일|계좌별|금융거래|조회기간)/.test(tks[e2].s)) { end = e2; break; } // 쪽 머리글·다음 계좌 머리글 앞에서 끊음
    var rest = tks.slice(rw.next, end).map(function (q) { return q.s; })
      .filter(function (q) { return /[가-힣A-Za-z]/.test(q) && !/^[*\\]+$/.test(q) && !DATE.test(q) && !/^거래일/.test(q); }).join(' ').slice(0, 80);
    var v = Number(rw.amt.replace(/,/g, '')), b = Number(rw.bal.replace(/,/g, ''));
    // 잔액이 느는 쪽: 입금, 지급·출금 취소 / 주는 쪽: 출금·지급, 입금 취소
    var up = (rw.kind === '입금') !== /취소$/.test(rw.kind);
    var len = r.거래.length, ac = '';
    if (accts.length) { accts.forEach(function (q) { if (q.at < rw.at) ac = q.no; }); ac = ac || accts[0].no; }
    docBankStmtRow_(r, rw.d, rw.tm, rw.kind, rest, '', up ? 0 : v, up ? v : 0, b);
    if (r.거래.length > len && ac) { r.거래[r.거래.length - 1].계좌 = ac; used[ac] = 1; }
    else if (ac) zeroOnly[ac] = { 잔액: b, 날짜: rw.d }; // 금액 0원 줄(이자 0원 결산 등)만 — 줄은 넣지 않지만 잔액은 남긴다
  });
  // 금액 있는 거래가 하나도 없는 계좌(0원 이자결산만) — 계좌가 있고 잔액이 얼마인지는 남긴다(상속재산 잔액)
  r.무거래계좌 = Object.keys(zeroOnly).filter(function (k) { return !used[k]; }).map(function (k) { return { 계좌: k, 잔액: zeroOnly[k].잔액, 날짜: zeroOnly[k].날짜 }; });
  if (r.거래.length - n0 < 3) { r.거래.length = n0; return false; }
  if (lost) r.경고.push('날짜와 짝짓지 못한 거래 줄 ' + lost + '개(쪽 ' + badPage + '곳 날짜 수가 줄 수와 다름) — 그 줄은 빼고 정리함(원문 확인)');
  var nAc = Object.keys(used).length;
  if (nAc > 1) r.경고.push('한 파일에 계좌 ' + nAc + '개 — 줄마다 그 앞 계좌번호로 나눔');
  else if (nAc === 1 && !r.계좌번호) r.계좌번호 = Object.keys(used)[0];
  r.서식 = '구분·거래금액 명세표';
  return true;
}

// ③ 앱 거래내역조회 화면 — 날짜 줄 → 시각 줄(거래 시작) → 적요 → ±금액원 → 잔액원
function docBankStmtAppRows_(t, r) {
  if (!/거\s*래\s*내\s*역/.test(t)) return false;
  var lines = t.split(/\r?\n/), d = '', cur = null, n0 = r.거래.length;
  var outOnly = /출\s*금/.test(t.slice(0, 400)) && !/입\s*금/.test(t);
  var flush = function () {
    if (!cur || !cur.nums.length) return;
    var a = cur.nums[0], bal = cur.nums.length > 1 ? cur.nums[1].v * (cur.nums[1].neg ? -1 : 1) : null;
    var dir = a.neg ? 'out' : a.pos ? 'in' : outOnly ? 'out' : '';
    var who = cur.words[0] || '', memo = cur.words.slice(1).join(' ');
    if (dir) docBankStmtRow_(r, cur.d, cur.tm, '', who, memo, dir === 'out' ? a.v : 0, dir === 'in' ? a.v : 0, bal);
    else r.거래.push({ 날짜: cur.d, 시각: cur.tm, 구분: '', 내용: who, 적요: memo, 출금액: 0, 입금액: 0, 금액: a.v, 잔액: bal, 입금: null, 잔액검산: null, 짝확인필요: false });
  };
  lines.forEach(function (L) {
    var dm = /^\s*(20\d{2})\.(\d{2})\.(\d{2})\s*\(/.exec(L); if (dm) { flush(); cur = null; d = dm[1] + '-' + dm[2] + '-' + dm[3]; return; }
    var tm = /^\s*(\d{1,2}:\d{2}:\d{2})\s*$/.exec(L); if (tm && d) { flush(); cur = { d: d, tm: tm[1], words: [], nums: [] }; return; }
    if (!cur) return;
    var am = /^\s*([+-])?\s*(\d{1,3}(?:,\d{3})+)\s*원?\s*$/.exec(L); if (am) { cur.nums.push({ v: Number(am[2].replace(/,/g, '')), neg: am[1] === '-', pos: am[1] === '+' }); return; }
    var w = L.replace(/[|•·]/g, ' ').trim();
    if (w && /[가-힣]{2}/.test(w) && !/^(잔액|직접입력|큰글씨|거래내역조회|대체)$|과거|^\(.*펌뱅킹\)$/.test(w) && cur.nums.length === 0) cur.words.push(w);
  });
  flush();
  if (r.거래.length === n0) return false;
  r.서식 = '앱 거래내역 화면';
  return true;
}

// 잔액 검산 — 이웃 거래와 잔액 차이가 그 줄 금액과 맞는지(최신순·오래된순 중 많이 맞는 쪽). 맞으면 출금·입금도 그것으로 확정
function docBankStmtCheck_(r) {
  var g = r.거래, n = g.length;
  var fit = function (prev, cur) {
    if (!prev || !cur || prev.잔액 == null || cur.잔액 == null || cur.짝확인필요) return null;
    if (prev.계좌 !== cur.계좌) return null; // [2026.11.20] 한 파일 여러 계좌(②-2) — 다른 계좌 줄끼리는 잇지 않는다
    var dlt = cur.잔액 - prev.잔액;
    if (cur.입금 === true) return dlt === cur.금액 ? 'in' : false;
    if (cur.입금 === false) return dlt === -cur.금액 ? 'out' : false;
    return dlt === cur.금액 ? 'in' : dlt === -cur.금액 ? 'out' : false;
  };
  var asc = 0, desc = 0, i;
  for (i = 1; i < n; i++) { if (fit(g[i - 1], g[i])) asc++; if (fit(g[i], g[i - 1])) desc++; }
  var ok = 0, tried = 0;
  for (i = 0; i < n; i++) {
    var prev = asc >= desc ? g[i - 1] : g[i + 1], res = fit(prev, g[i]);
    if (res === null) continue;
    tried++;
    if (res) { ok++; g[i].잔액검산 = true; if (g[i].입금 === null) { g[i].입금 = res === 'in'; if (res === 'in') g[i].입금액 = g[i].금액; else g[i].출금액 = g[i].금액; } }
    else g[i].잔액검산 = false;
  }
  r.검산 = { 맞음: ok, 전체: tried, 순서: asc >= desc ? '오래된순' : '최신순' };
  if (tried >= 3 && ok / tried < 0.5) r.경고.push('잔액 검산이 ' + tried + '줄 중 ' + ok + '줄만 맞음 — 글자인식이 줄·칸 순서를 섞었을 수 있음(금액은 원문 확인)');
  var unk = g.filter(function (x) { return x.입금 === null; }).length;
  if (unk) r.경고.push('출금·입금을 정하지 못한 줄 ' + unk + '개(잔액 검산 안 됨)');
}

function docBankStmtParse_(text) {
  var t = String(text || '');
  if (/잔\s*(액|고)\s*증\s*명|이\s*체\s*확\s*인\s*증/.test(t.slice(0, 600))) return null;
  var r = { 종류: '통장 거래내역', 은행: '', 예금주: '', 계좌번호: '', 거래: [], 경고: [], 통장목록: true, 서식: '' };
  var m = BANK_STMT_NAME_RE_.exec(t.slice(0, 2000)); if (m) r.은행 = m[1] + m[2];
  m = /계\s*좌\s*번\s*호\s*[:：]?\s*\[?\s*(\d[\d-]{7,20}\d)/.exec(t); if (m) r.계좌번호 = m[1];
  // [2026.11.20] "예금주 명 ○○"(기업은행 명세표) — 「명」을 건너뛰지 못해 표 머리 "상대 예금주 비고"의 「비고」를 예금주로 읽었다
  m = /(?:고\s*객\s*명|예\s*금\s*주(?:\s*(?:성\s*)?명)?)\s*[:：]?\s*(?!비고|구분|명\s)([가-힣]{2,5})/.exec(t); if (m) r.예금주 = m[1];
  // [2026.10.17 통장 사진·앱 캡처] ④ 잔액 사슬 — 머리글·시각 줄 모양이 없는 화면(시각이 "14:05"뿐인 거래내역조회, 칸이 섞인 사진)
  // [2026.10.18 3차 수정 K] 잔액 사슬만으로 통장이라 보는 문턱을 좁힌다 — 숫자 칸이 많은 다른 서식에서도 "앞 숫자 ± 숫자 = 뒤 숫자"가 우연히 3번 이어진다.
  //  고객A 「부동산임대공급가액명세서」(머리 "수 입 금 액"의 '입금'에 걸려 보증금·월임대료·이자 칸이 가짜 거래 3줄·가짜 국민은행 계좌로),
  //  고객C 「대출 원리금 납입 증명서」("대출잔액" 칸의 '잔액'에 걸려 이자 납입액이 가짜 계좌 061-…·사망 뒤 인출 2,238,948원으로)가 통장으로 잘못 정리됐다.
  //  ① 다른 서식 제목(임대공급가액명세서·원리금/이자 납입 증명서·상환 내역)이 머리에 있으면 사슬로 통장이라 하지 않는다
  //  ② 통장 신호는 거래 칸 낱말로만 — 입금·출금(수입금액·납입금 말고)·찾으신·맡기신, 잔액(대출잔액·잔액증명 말고), 거래내역·입출금내역 화면 제목, 타행이체·송금 적요
  var chainFlat = t.replace(/\s+/g, ''), chainHead = chainFlat.slice(0, 300);
  var chainSig = /(?:^|[^수납])입금(?!계좌)|출금|찾으신|맡기신|(?:^|[^출])잔액(?!증명)|거래내역|입출금내역|타행이체|모바일뱅킹|인터넷뱅킹/;
  var chainOf = function () {
    if (/임대공급가액명세서|(?:원리금|이자)납입(?:증명|확인|내역)|납입증명서|상환(?:내역|증명)서/.test(chainHead) || !chainSig.test(chainFlat)) return null;
    var ch = null; try { ch = docBankChainRows_(t, { book: false }); } catch (e) { ch = null; }
    return ch && ch.rows.length >= 3 && ch.rows.every(function (g) { return g.날짜; }) ? ch : null;
  };
  if (!docBankStmtDelimRows_(t, r) && !docBankStmtTableRows_(t, r) && !docBankStmtKindAmtRows_(t, r) && !docBankStmtAppRows_(t, r)) {
    var ch4 = chainOf(); if (!ch4) return null;
    r.거래 = ch4.rows; r.서식 = '사진·화면(잔액 사슬)';
  }
  docBankStmtCheck_(r);
  // 화면 규칙(②·③)으로 읽었지만 잔액 검산이 절반도 안 맞으면 — 잔액 사슬이 더 많은 줄을 검산하면 그것으로 바꾼다(사슬 밖 후보 줄은 세지 않음)
  if (r.서식 !== '구분자 표' && r.서식 !== '사진·화면(잔액 사슬)' && r.검산 && r.검산.맞음 < r.거래.length * 0.5) {
    var ch5 = chainOf();
    if (ch5 && ch5.rows.filter(function (g) { return !g.사슬밖; }).length > r.검산.맞음) { r.거래 = ch5.rows; r.서식 = '사진·화면(잔액 사슬)'; r.경고 = []; docBankStmtCheck_(r); }
  }
  var looseN = r.거래.filter(function (g) { return g.사슬밖; }).length; // [2026.10.18 3차 수정 K] 사슬 밖 후보 줄 — 출처(사진 글자 그대로·검산 안 됨)를 표에 남긴다
  if (looseN) r.참고 = ['잔액 사슬 밖 줄 ' + looseN + '개(사진 첫·끝 줄) — 금액·부호는 사진 글자 그대로, 앞 잔액이 사진 밖이라 검산 안 됨(원문 확인)'];
  var won = function (n) { return n ? Number(n).toLocaleString('ko-KR') + '원' : ''; };
  var outS = r.거래.reduce(function (s, x) { return s + (x.출금액 || 0); }, 0), inS = r.거래.reduce(function (s, x) { return s + (x.입금액 || 0); }, 0);
  var md = '### 통장 거래내역' + (r.은행 ? '(' + r.은행 + ')' : '') + ' — ' + r.서식 + '\n\n' + docMdTable_([['예금주', r.예금주], ['계좌번호', r.계좌번호], ['거래', r.거래.length + '줄 · 출금 ' + won(outS) + ' · 입금 ' + won(inS)], ['잔액 검산', r.검산 && r.검산.전체 ? r.검산.전체 + '줄 중 ' + r.검산.맞음 + '줄 맞음(' + r.검산.순서 + ')' : '']])
    + '\n\n| 날짜 | 시각 | 구분 | 내용 | 출금 | 입금 | 잔액 | 검산 |\n|---|---|---|---|---|---|---|---|\n'
    + r.거래.slice(0, 80).map(function (g) { return '| ' + [g.날짜, g.시각, g.구분, (g.내용 + (g.적요 ? ' ' + g.적요 : '')).slice(0, 30), g.입금 === null ? '?' + won(g.금액) : won(g.출금액), won(g.입금액), g.잔액 == null ? '' : Number(g.잔액).toLocaleString('ko-KR'), g.짝확인필요 ? '⚠짝' : g.잔액검산 ? '✓' : g.사슬밖 ? '사슬 밖(사진 글자 그대로·검산 안 됨)' : ''].map(function (v) { return String(v).replace(/\|/g, '/'); }).join(' | ') + ' |'; }).join('\n')
    + (r.거래.length > 80 ? '\n\n… 외 ' + (r.거래.length - 80) + '줄' : '') + (r.참고 && r.참고.length ? '\n\n' + r.참고.map(function (w) { return '- 참고: ' + w; }).join('\n') : '') + (r.경고.length ? '\n\n' + r.경고.map(function (w) { return '- ⚠ ' + w; }).join('\n') : '');
  return { type: 'banktx', label: '통장 거래내역', result: r, md: md };
}

function docMdTable_(rows) { rows = rows.filter(function (x) { return x[1] !== undefined && x[1] !== null && x[1] !== ''; }); return rows.length ? '| 항목 | 내용 |\n|---|---|\n' + rows.map(function (x) { return '| ' + x[0] + ' | ' + String(x[1]).replace(/\|/g, '/').replace(/\n/g, ' ') + ' |'; }).join('\n') : ''; }

// =========================================================
// [2026.10.10] 은행·증권 거래내역(엑셀·CSV) 자동 정리 — 토큰 0, 글자인식 안 씀
// 세무사님: 통장 스캔본은 오류 위험이 커서 엑셀로 검토하는 게 낫다 → 은행에서 받은 엑셀·CSV만 다루고, 모든 줄을 잔액으로 검산해 오류를 숨기지 않는다.
// 표본 114개 파일(계좌 218개·거래 44,561줄)로 맞춤: 197개 계좌 전 줄 일치, 불일치 49줄은 사무소 편집본·은행 원본의 실제 이상 줄.
// =========================================================
// ---- 은행·증권 거래내역(엑셀·CSV) 정리 — 토큰 0, 글자인식(OCR) 안 씀, ES5 ----
// 오류 0 원칙: 모든 줄을 "앞 줄 잔액 - 출금 + 입금 = 이번 줄 잔액"으로 검산하고, 안 맞는 줄은 숨기지 않고 ⚠로 드러낸다.
// 판단(증여·상속 해당 여부)은 하지 않고 거르기·합계만 한다.
var BANK_COL_ = {
  date: /^(거래일시|거래일자|거래일|일자|거래날짜|날짜|일시|기산일자|거래일자시간)$/,
  time: /^(시간|거래시간|처리시각|처리시간)$/,
  out: /^(출금|출금액|출금금액|찾으신금액|찾은금액|지급|지급액|지급금액|지급\(원\)|출금\(원\)|인출금액|찾으신금액\(원\))$/,
  inn: /^(입금|입금액|입금금액|맡기신금액|맡긴금액|입금\(원\)|맡기신금액\(원\))$/,
  amt: /^(거래금액|금액|거래금액\(원\))$/,
  type: /^(구분|거래구분|입출금구분|입지구분|입출구분)$/,
  bal: /^(잔액|거래후잔액|남은금액|표면잔액|잔고|거래후잔액\(원\)|잔액\(원\)|거래후\s*잔액)$/,
  cp: /^(상대계좌예금주명|의뢰인\/수취인|의뢰인|수취인|받는분|보낸분|보낸분\/받는분|받는분\/보낸분|기재내용|상대방|상대예금주)$/,
  desc: /^(적요|거래내용|내용|기록사항|거래기록사항|거래메모|메모|적요\(의뢰인등\)|비고)$/,
  acct: /^(계좌|계좌번호)$/,
  // "은행명"은 대개 이체 상대 은행(국민 상속조회 서식) — 계좌 은행으로 쓰면 한 계좌가 여러 조각으로 갈린다
  bank: /^(은행|금융기관|기관)$/,
  branch: /^(거래점|취급점|거래점명|처리점|점)$/
};

// 머리글 비교용 — 띄어쓰기와 단위 꼬리("(원)", "(₩)")를 떼고 본다(국민은행 "출금액(원)" 등)
function bankHdrKey_(v) { return bankCell_(v).replace(/\s+/g, '').replace(/\((?:원|₩|KRW|천원)\)$/, ''); }

function bankCell_(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

function bankNum_(v) {
  var s = bankCell_(v).replace(/[,원₩\s]/g, '');
  if (s === '' || s === '-') return null;
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
  // 엑셀이 큰 금액을 "2.1136431E7"처럼 지수로 저장하기도 한다
  return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s) ? Number(s) : NaN;
}

// 날짜 → "yyyy-MM-dd HH:mm:ss"(정렬 가능한 글자). 엑셀 일련번호(45123.5)도 받는다.
function bankDate_(v, t) {
  var s = bankCell_(v), m;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    var n = Number(s), d = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000));
    s = d.toISOString().replace('T', ' ').slice(0, 19);
  }
  m = /(\d{4})[.\-\/년\s]*(\d{1,2})[.\-\/월\s]*(\d{1,2})일?(?:\D+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s) || /^(\d{4})(\d{2})(\d{2})(?:\s*(\d{2}):?(\d{2}):?(\d{2})?)?$/.exec(s);
  // 두 자리 연도("16-05-27") — 칸 전체가 날짜 모양일 때만
  if (!m) { var y2 = /^(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s); if (y2) { var yy = Number(y2[1]); m = [y2[0], (yy <= (new Date().getFullYear() % 100) ? '20' : '19') + y2[1], y2[2], y2[3], y2[4], y2[5], y2[6]]; } }
  if (!m) return '';
  var pad = function (x) { return ('0' + (x || 0)).slice(-2); };
  var hh = m[4], mi = m[5], ss = m[6];
  if (!hh && t) { var tm = /(\d{1,2}):?(\d{2}):?(\d{2})?/.exec(bankCell_(t)); if (tm) { hh = tm[1]; mi = tm[2]; ss = tm[3]; } }
  return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) + (hh ? ' ' + pad(hh) + ':' + pad(mi) + ':' + pad(ss) : '');
}

function bankFindHeader_(rows) {
  var best = -1, bestScore = 0;
  for (var i = 0; i < Math.min(rows.length, 40); i++) {
    var sc = 0, hasBal = false, hasDate = false;
    (rows[i] || []).forEach(function (c) {
      var k = bankHdrKey_(c);
      Object.keys(BANK_COL_).forEach(function (f) { if (BANK_COL_[f].test(k)) { sc++; if (f === 'bal') hasBal = true; if (f === 'date') hasDate = true; } });
    });
    if (hasBal && hasDate && sc > bestScore) { bestScore = sc; best = i; }
  }
  return best;
}

// 머리글 위 계좌정보(은행·계좌·예금주·조회기간)
function bankMeta_(rows, upto) {
  var meta = {}, txt = rows.slice(0, Math.max(upto, 0)).map(function (r) { return (r || []).map(bankCell_).filter(function (x) { return x; }).join(' '); }).join('\n');
  var m = /(?:계좌번호|계좌)\s*[:：]?\s*([\d-]{8,20})/.exec(txt); if (m) meta.계좌 = '…' + m[1].replace(/\D/g, '').slice(-4);
  m = /(?:예금주|성명|고객명)\s*[:：]?\s*([가-힣()]{2,20})/.exec(txt); if (m) meta.예금주 = m[1];
  m = /((?:19|20)\d{2}[.\-\/]\d{1,2}[.\-\/]\d{1,2})\s*~\s*((?:19|20)\d{2}[.\-\/]\d{1,2}[.\-\/]\d{1,2})/.exec(txt); if (m) meta.조회기간 = bankDate_(m[1]) + ' ~ ' + bankDate_(m[2]);
  m = /([가-힣]{2,8}(?:은행|증권|금고|투자증권|농협|수협|신협|우체국))/.exec(txt); if (m) meta.은행 = m[1];
  return meta;
}

// 머리글이 없는 시트 — 날짜 칸 + 세 숫자 칸(출금·입금·잔액)을 잔액 검산이 가장 많이 맞는 조합으로 찾는다
function bankGuessCols_(rows) {
  var sample = rows.filter(function (r) { return r && r.some(function (c) { return /^(19|20)\d{2}[.\-\/]\d{2}[.\-\/]\d{2}/.test(bankCell_(c)); }); }).slice(0, 400);
  if (sample.length < 3) return null;
  var w = Math.max.apply(null, sample.map(function (r) { return r.length; })), dateCol = -1;
  for (var c = 0; c < w && dateCol < 0; c++) if (sample.every(function (r) { return /^(19|20)\d{2}/.test(bankCell_(r[c])); })) dateCol = c;
  if (dateCol < 0) return null;
  var numCols = [];
  for (c = 0; c < w; c++) if (c !== dateCol && sample.every(function (r) { var n = bankNum_(r[c]); return n === null || !isNaN(n); }) && sample.some(function (r) { return bankNum_(r[c]); })) numCols.push(c);
  // 여러 은행 계좌를 날짜순으로 섞어 둔 시트 — 은행 이름 칸이 있으면 은행별로 나눠 검산
  var bankCol;
  for (c = 0; c < w && bankCol === undefined; c++) if (c !== dateCol && sample.filter(function (r) { return /(은행|증권|농협|수협|금고|신협|우체국)/.test(bankCell_(r[c])); }).length >= sample.length * 0.8) bankCol = c;
  var best = null, rev = sample.slice().reverse();
  // 은행 칸이 상대은행일 수도 있으므로 "나눠서"와 "한 계좌로" 둘 다, 정순·역순(최신순) 둘 다 시험해 가장 잘 맞는 것을 고른다
  [undefined, bankCol].forEach(function (bc, bi) { if (bi === 1 && bankCol === undefined) return; [sample, rev].forEach(function (S) {
  numCols.forEach(function (o) { numCols.forEach(function (i) { numCols.forEach(function (b) {
    if (o === i || i === b || o === b) return;
    var ok = 0, last = {}, tot = 0;
    for (var k = 0; k < S.length; k++) {
      var key = bc !== undefined ? bankCell_(S[k][bc]) : '_', p = last[key], cur = bankNum_(S[k][b]), oo = bankNum_(S[k][o]) || 0, ii = bankNum_(S[k][i]) || 0;
      if (p !== undefined) { tot++; if (p !== null && cur !== null && Math.abs(p - oo + ii - cur) < 0.5) ok++; }
      last[key] = cur;
    }
    if (tot && (!best || ok / tot > best.ok / best.tot)) best = { ok: ok, tot: tot, date: dateCol, out: o, inn: i, bal: b, bank: bc };
  }); }); }); }); });
  return best && best.tot && best.ok >= best.tot * 0.9 ? best : null;
}

function bankParseRows_(rows) {
  rows = (rows || []).map(function (r) { return (r || []).map(bankCell_); });
  var r = { 종류: '거래내역(엑셀)', 계좌들: [], 경고: [] };
  var hi = bankFindHeader_(rows), col = {}, guessed = false;
  if (hi >= 0) {
    rows[hi].forEach(function (c, idx) {
      var k = bankHdrKey_(c);
      Object.keys(BANK_COL_).forEach(function (f) { if (col[f] === undefined && BANK_COL_[f].test(k)) col[f] = idx; else if (f === 'desc' && col.desc !== undefined && col.desc !== idx && col.desc2 === undefined && BANK_COL_.desc.test(k)) col.desc2 = idx; }); // [2026.10.18] 적요 칸이 둘이면(농협 "거래내용"+"기록사항" — 받는 사람 이름은 기록사항) 둘째도 남긴다
    });
  } else {
    var g = bankGuessCols_(rows);
    if (!g) { r.경고.push('거래내역 표(거래일·입출금·잔액 칸)를 찾지 못함 — 은행에서 받은 원본 엑셀인지 확인'); r.거래내역아님 = true; return r; }
    col = { date: g.date, out: g.out, inn: g.inn, bal: g.bal }; if (g.bank !== undefined) col.bank = g.bank; guessed = true; hi = -1;
    r.경고.push('머리글이 없는 시트 — 잔액 검산이 맞는 칸 조합(출금·입금·잔액)으로 칸을 정함');
  }
  if (col.bal === undefined || (col.out === undefined && col.inn === undefined && col.amt === undefined)) { r.경고.push('입출금·잔액 칸을 찾지 못함'); r.거래내역아님 = true; return r; }
  // [2026.10.18 정밀분석 원인2] "상대은행 | 계좌번호"처럼 상대 은행 칸 바로 뒤의 계좌번호는 상대방 계좌 — 내 계좌 칸으로 쓰면 거래가 상대 계좌마다 다른 통장으로 쪼개졌다(고객B 우체국.xlsx)
  if (hi >= 0 && col.acct !== undefined && col.acct > 0 && /상대|받는|보낸|입금은행|출금은행|연동/.test(bankHdrKey_(rows[hi][col.acct - 1]))) { col.cpAcct = col.acct; delete col.acct; }
  var meta = bankMeta_(rows, hi);
  // 거래 줄 모으기
  var tx = [], curAcct = meta.계좌 || '';
  for (var i = hi + 1; i < rows.length; i++) {
    var row = rows[i], d = bankDate_(row[col.date], col.time !== undefined ? row[col.time] : '');
    if (!d) {
      // 여러 계좌를 위아래로 이어 붙인 시트 — 날짜 없는 줄에 계좌번호가 나오면 거기서 새 계좌가 시작된다
      var am = /(\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,3})?)/.exec(row.join(' '));
      if (am && col.acct === undefined) curAcct = am[1];
      continue; // 합계·빈 줄·소계
    }
    var o = col.out !== undefined ? bankNum_(row[col.out]) : null, n = col.inn !== undefined ? bankNum_(row[col.inn]) : null;
    if (col.out === undefined && col.inn === undefined && col.amt !== undefined) {
      var a = bankNum_(row[col.amt]), ty = col.type !== undefined ? row[col.type] : '';
      // 구분 칸이 비어 있으면 같은 줄의 다른 칸에서 "입금/출금/지급" 낱말을 찾는다(사무소가 칸을 옮긴 정리본)
      if (!/입금|맡|출금|지급|찾|인출|^입$|^출$/.test(ty)) { for (var q = 0; q < row.length; q++) if (q !== col.desc && /^(입금|출금|지급|입|출|맡김|찾음)$/.test(row[q])) { ty = row[q]; break; } }
      if (/입금|맡|^입$/.test(ty)) n = a; else if (/출금|지급|찾|^출$|인출/.test(ty)) o = a;
      else {
        // 구분 낱말이 없는 줄("결산이자"·"해지" 등) — 금액·잔액은 남겨 두고, 뒤 검산에서 잔액 차이가 금액과 정확히 같을 때만 방향을 정한다
        tx.push({ 줄: i + 1, 일시: d, 출금: 0, 입금: 0, 금액미정: isNaN(a) ? null : a, 잔액: bankNum_(row[col.bal]), 상대: col.cp !== undefined ? row[col.cp] : '', 적요: (col.desc !== undefined ? row[col.desc] : '') || ty,
          계좌: col.acct !== undefined ? row[col.acct] : curAcct, 은행: col.bank !== undefined ? row[col.bank] : (meta.은행 || ''), bad: a === null || isNaN(a) ? '입출금 구분을 읽지 못함: ' + ty : '' });
        continue;
      }
    }
    var b = bankNum_(row[col.bal]);
    tx.push({
      줄: i + 1, 일시: d, 출금: o || 0, 입금: n || 0, 잔액: b,
      상대: col.cp !== undefined ? row[col.cp] : '', 적요: col.desc !== undefined ? row[col.desc] : '', 적요2: col.desc2 !== undefined ? row[col.desc2] : '',
      계좌: col.acct !== undefined ? row[col.acct] : curAcct, 은행: col.bank !== undefined ? row[col.bank] : (meta.은행 || ''),
      bad: (isNaN(o) || isNaN(n) || (b !== null && isNaN(b))) ? '숫자가 아닌 금액 칸' : ''
    });
  }
  if (!tx.length) { r.경고.push('거래 줄이 없음'); r.거래내역아님 = true; return r; }
  // 계좌별로 나눠 검산(사무소가 여러 계좌를 한 시트에 모은 경우)
  var groups = {}, order = [];
  tx.forEach(function (t) { var k = (t.은행 || '') + '|' + (t.계좌 || ''); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(t); });
  order.forEach(function (k) {
    var g = groups[k];
    // 원래 순서(최신순일 수도)로 검산해 보고, 뒤집어서도 해 본 뒤 더 많이 맞는 쪽 — 같은 날 여러 건은 시각 정렬이 불완전하므로 날짜 정렬 대신 원래 줄 순서를 쓴다
    function check(list) {
      var bad = [], ok = 0;
      for (var j = 1; j < list.length; j++) {
        var p = list[j - 1], c = list[j];
        if (c.bad || p.bad || p.잔액 === null || c.잔액 === null || (c.금액미정 != null && !c.구분추정)) { bad.push(c); continue; }
        if (Math.abs(p.잔액 - c.출금 + c.입금 - c.잔액) < 0.5) ok++; else bad.push(c);
      }
      return { ok: ok, bad: bad };
    }
    // 같은 날 거래는 정리본에서 순서가 섞이기도 한다 — 숫자는 그대로 두고, 같은 날짜 안에서만 잔액이 이어지는 줄을 앞으로 당겨 순서를 바로잡는다
    function reorder(list) {
      // 정순·역순 두 번 시험하므로 줄 객체를 복사해 서로 영향이 없게
      list = list.map(function (t) { var o = {}; for (var kk in t) o[kk] = t[kk]; return o; });
      for (var j = 1; j < list.length; j++) {
        var p = list[j - 1], c = list[j];
        // 방향 미정 줄: 앞 잔액 ± 금액이 이번 잔액과 정확히 같으면 그 방향(금액과 잔액 차이가 같다는 것 자체가 검산)
        if (c.금액미정 != null && p.잔액 !== null && c.잔액 !== null) {
          if (Math.abs(p.잔액 + c.금액미정 - c.잔액) < 0.5) { c.입금 = c.금액미정; c.구분추정 = true; }
          else if (Math.abs(p.잔액 - c.금액미정 - c.잔액) < 0.5) { c.출금 = c.금액미정; c.구분추정 = true; }
        }
        // 잔액 칸이 빈 줄인데 앞 잔액을 전부 빼 가면 해지(잔액 0) — 계산으로 정확히 0일 때만 0으로 본다
        if (c.잔액 === null && !c.bad && p.잔액 !== null && Math.abs(p.잔액 - c.출금 + c.입금) < 0.5 && (c.출금 || c.입금)) { c.잔액 = 0; c.해지추정 = true; continue; }
        if (p.잔액 === null || c.잔액 === null || c.bad || p.bad) continue;
        if (Math.abs(p.잔액 - c.출금 + c.입금 - c.잔액) < 0.5) continue;
        var day = c.일시.slice(0, 10);
        for (var q = j + 1; q < list.length && list[q].일시.slice(0, 10) === day; q++) {
          var x = list[q];
          if (!x.bad && x.잔액 !== null && Math.abs(p.잔액 - x.출금 + x.입금 - x.잔액) < 0.5) { list.splice(q, 1); list.splice(j, 0, x); break; }
        }
      }
      return list;
    }
    var gF = reorder(g), gR = reorder(g.slice().reverse());
    var fw = check(gF), rv = check(gR), useRev = rv.ok > fw.ok, res = useRev ? rv : fw, list = useRev ? gR : gF;
    var badSet = {}; res.bad.forEach(function (x) { badSet[x.줄] = 1; });
    list.forEach(function (t) { if (badSet[t.줄] || t.bad) t.검산불일치 = true; });
    var acct = {
      은행: list[0].은행, 계좌: list[0].계좌 ? '…' + String(list[0].계좌).replace(/\D/g, '').slice(-4) : (meta.계좌 || ''),
      예금주: meta.예금주 || '', 조회기간: meta.조회기간 || (list[0].일시.slice(0, 10) + ' ~ ' + list[list.length - 1].일시.slice(0, 10)),
      거래: list, 검산줄수: list.length - 1, 불일치: res.bad.length + list.filter(function (t) { return t.bad && !badSet[t.줄]; }).length,
      최신순: useRev, 칸추정: guessed
    };
    acct.시작잔액 = list[0].잔액 - list[0].입금 + list[0].출금; acct.끝잔액 = list[list.length - 1].잔액;
    acct.입금합계 = list.reduce(function (s, t) { return s + t.입금; }, 0);
    acct.출금합계 = list.reduce(function (s, t) { return s + t.출금; }, 0);
    // 전체 검산: 시작잔액 + 입금합계 - 출금합계 = 끝잔액
    acct.총괄검산 = Math.abs(acct.시작잔액 + acct.입금합계 - acct.출금합계 - acct.끝잔액) < 0.5;
    r.계좌들.push(acct);
  });
  r.거래수 = tx.length;
  r.불일치수 = r.계좌들.reduce(function (s, a) { return s + a.불일치; }, 0);
  if (r.불일치수) r.경고.push('잔액 검산이 맞지 않는 줄 ' + r.불일치수 + '개 — 칸 인식 오류이거나 원본이 편집됨(해당 줄 ⚠)');
  var est = r.계좌들.reduce(function (s, a) { return s + a.거래.filter(function (t) { return t.구분추정; }).length; }, 0);
  if (est) r.경고.push('입출금 구분 낱말이 없는 ' + est + '줄은 잔액 변화(금액과 정확히 같은 경우만)로 입금·출금을 정함');
  return r;
}

// 거래내역 파일 읽기(서버) — 글자인식 없이 숫자를 그대로 읽는다.
// xlsx·xls(진짜 엑셀)는 드라이브가 구글 시트로 바꿔 읽고 임시 시트는 바로 휴지통으로. 은행이 "xls"라며 내려주는 HTML 표·CSV는 글자 그대로 읽는다.
function bankDecodeBlob_(blob) {
  var s = blob.getDataAsString('UTF-8');
  if (/�/.test(s)) { try { s = blob.getDataAsString('EUC-KR'); } catch (e) { /* 그대로 */ } }
  return s.replace(/^﻿/, '');
}

function bankHtmlRows_(s) {
  var dec = function (x) { return x.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); };
  return (s.match(/<tr[\s\S]*?<\/tr>/gi) || []).map(function (tr) { return (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(dec); });
}

function bankReadFile_(fileId) {
  var f = DriveApp.getFileById(fileId), name = f.getName(), mime = f.getMimeType(), sheets = [];
  var readSs = function (ss) {
    var tz = ss.getSpreadsheetTimeZone();
    ss.getSheets().forEach(function (sh) {
      var rng = sh.getDataRange(); if (rng.getNumRows() < 2) return;
      var vals = rng.getValues().map(function (r) { return r.map(function (v) {
        if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss');
        return v === null || v === undefined ? '' : String(v);
      }); });
      sheets.push({ sheet: sh.getName(), rows: vals });
    });
  };
  if (mime === MimeType.GOOGLE_SHEETS) { readSs(SpreadsheetApp.openById(fileId)); return { name: name, sheets: sheets }; }
  var blob = f.getBlob(), bytes = blob.getBytes();
  var isZip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4B, isBiff = bytes.length > 3 && (bytes[0] & 0xFF) === 0xD0 && (bytes[1] & 0xFF) === 0xCF;
  if (isZip || isBiff) {
    var copy = Drive.Files.copy(tcTmpMeta_({ name: '_bank_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' }), fileId, { fields: 'id' });
    try { readSs(SpreadsheetApp.openById(copy.id)); } finally { try { DriveApp.getFileById(copy.id).setTrashed(true); } catch (e) { /* 정리 실패 무시 */ } }
    return { name: name, sheets: sheets };
  }
  var text = bankDecodeBlob_(blob);
  if (/<table|<tr/i.test(text.slice(0, 5000))) sheets.push({ sheet: 'html', rows: bankHtmlRows_(text) });
  else sheets.push({ sheet: 'csv', rows: Utilities.parseCsv(text) });
  return { name: name, sheets: sheets };
}
