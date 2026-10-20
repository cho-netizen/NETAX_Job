// 자동 생성 파일 — 직접 고치지 말 것. 원본: gs-backend/*.js, 생성: tools/build-light.js
// 조회 시작점: work_getCases, client_getClients, client_getConsultLogs, booking_getBookings, jsonResponse
// 포함한 최상위 선언 32개 (시트 쓰기가 들어 있는 것: client_ensureSheet_, work_getSheet_)

const BOOKING_SHEET_ID = '1HMMKMd0bp7kjK7Z8oSMJy2TSXFKB0EUC1XCIjSsfrmQ';

// ===== 신청 목록 조회 =====
function booking_getBookings() {
  const ss = SpreadsheetApp.openById(BOOKING_SHEET_ID);
  const sheet = ss.getSheetByName('Applications');
  if (!sheet) return jsonResponse({ bookings: [] });

  const data = sheet.getDataRange().getValues();
  const bookings = [];

  for (let i = 1; i < data.length; i++) {
    // [2026.08 버그수정] 예약일·예약시간 칸이 날짜/시간처럼 생긴 값이라 구글시트가 자동으로
    // Date로 인식해버려서(전화번호가 숫자로 오인되던 것과 같은 종류의 문제), 그냥 그대로
    // 돌려주면 "2026-07-19T15:00:00.000Z" 같은 원시 문자열이 그대로 나갔다 — 다른 곳에서
    // 이 값을 그대로 표시하면 못 알아보므로, date 필드와 같은 방식으로 여기서 포맷해서 낸다.
    bookings.push({
      date: data[i][0] ? Utilities.formatDate(new Date(data[i][0]), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '',
      name: data[i][1],
      phone: data[i][2],
      type: data[i][3],
      statuses: data[i][4],
      situation: data[i][5],
      reservedDate: data[i][6] ? Utilities.formatDate(new Date(data[i][6]), 'Asia/Seoul', 'yyyy-MM-dd') : '',
      reservedTime: data[i][7] ? Utilities.formatDate(new Date(data[i][7]), 'Asia/Seoul', 'HH:mm') : '',
      source: data[i][8],
      status: data[i][9],
      approvedDate: data[i][10],
      eventId: data[i][11] || '',
      caseId: data[i][12] || '',
      field: data[i][13] || ''
    });
  }

  return jsonResponse({ bookings });
}

// =========================================================
// client 모듈 — 고객관리(고객 명단 + 자문내역·수임료 기록) (2026.08 신규)
// 기존 고객관리.xlsx(자문일지 성격)에 없던 "고객 1명당 1행" 명단(Clients)을 새로 만들고,
// 실제 상담·자문 이력은 예전처럼 이벤트 하나당 1행(ConsultLog)으로 남기되 고객ID로 연결한다.
// work_ 모듈(작업관리)의 사건도 고객명을 적으면 자동으로 여기 명단과 연결/신규등록된다.
// =========================================================
const CLIENT_SHEET_ID = '1nHf4PK1F1-Ao5jZ-s43PB1A3eF85YVRcI7T1kK_ooBI';

const CLIENT_SHEET_CLIENTS = 'Clients';

const CLIENT_SHEET_LOG = 'ConsultLog';

const CLIENT_HEADERS = ['id', '성명', '전화번호', '구분', '사업자번호', '메모', '등록일', '수정일', '추가연락처', '주소', '주민등록번호암호화'];

const CONSULT_HEADERS = ['id', '고객ID', '고객명', '날짜', '담당자', '유형', '내용', '관계', '금액', '수취증빙', '리뷰', '생성일', '승인번호', '사건ID', '중복정리'];

function client_getSheets_() {
  const ss = SpreadsheetApp.openById(CLIENT_SHEET_ID);
  return { ss: ss, clients: client_ensureSheet_(ss, CLIENT_SHEET_CLIENTS, CLIENT_HEADERS), log: client_ensureSheet_(ss, CLIENT_SHEET_LOG, CONSULT_HEADERS) };
}

// work_getSheet_와 같은 자가치유 방식 — 시트가 없으면 헤더까지 만들고, 있는데 헤더가 모자라면
// (스키마가 나중에 늘어난 경우) 빠진 헤더만 뒤에 이어붙인다.
function client_ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = headers.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length > 0) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function client_colMap_(headers, headerList) {
  const map = {};
  headerList.forEach(function (name) { map[name] = headers.indexOf(name); });
  return map;
}

function client_dateStr_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

function client_parseExtraContacts_(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(function (p) { return p && p.전화번호; }).map(function (p) { return { 이름: String(p.이름 || ''), 전화번호: String(p.전화번호 || '') }; });
  } catch (e) { /* 아래 옛 형식(콤마구분 전화번호) 처리로 진행 */ }
  return client_splitPhoneNumbers_(raw).map(function (phone) { return { 이름: '', 전화번호: phone }; });
}

function client_readClient_(col, row) {
  // [2026.09.16 버그수정] 구글 시트는 "3733"처럼 숫자로만 된 값을 실제 숫자 타입으로 저장해버린다
  // — 이미 work_readRow_(WORK_CASES의 고객명/납세자)에서 같은 문제를 겪고 고쳤는데, 고객관리의
  // 성명에서도 똑같이 터졌다(화면에서 .localeCompare is not a function으로 확인). 문자열로
  // 강제하지 않으면 이 값을 문자열 메서드로 다루는 곳(정렬 등)에서 예외가 나서 고객관리 탭
  // 전체가 조용히 멈춘다.
  return {
    id: row[col.id], 성명: String(row[col.성명] || ''), 전화번호: String(row[col.전화번호] || ''), 구분: row[col.구분],
    사업자번호: String(row[col.사업자번호] || ''), 메모: row[col.메모],
    등록일: client_dateStr_(row[col.등록일]), 수정일: client_dateStr_(row[col.수정일]),
    추가연락처: client_parseExtraContacts_(row[col.추가연락처]),
    주소: String(row[col.주소] || ''),
    // [2026.09.19 신규] 주민등록번호는 암호문조차 목록 조회에 안 실어보낸다 — 등록 여부만
    // 알려주고, 실제 값은 client_getRRN을 따로 호출했을 때만(화면의 "보기" 버튼) 내려준다.
    주민번호등록됨: !!String(row[col.주민등록번호암호화] || '').trim()
  };
}

// "010-1234-5678, 010-9999-8888" 같은 자유 입력에서 번호별로 숫자만 남긴 목록을 뽑는다.
// 쉼표/줄바꿈으로만 번호를 나누고, 그 안의 하이픈·공백은 한 번호에 속한 것으로 보고 전부
// 붙여서 숫자만 남긴다 — 하이픈 기준으로 통째로 쪼개면 "010-1111-2222"의 가운데 토막
// "1111"이 마치 별도 번호의 뒷4자리인 것처럼 잘못 매칭될 수 있다.
function client_splitPhoneNumbers_(raw) {
  return String(raw || '').split(/[,\n]+/)
    .map(function (s) { return s.replace(/[^0-9]/g, ''); })
    .filter(function (s) { return s.length >= 4; });
}

function client_readLog_(col, row) {
  return {
    id: row[col.id], 고객ID: row[col.고객ID], 고객명: row[col.고객명],
    날짜: client_dateStr_(row[col.날짜]), 담당자: row[col.담당자], 유형: row[col.유형],
    내용: row[col.내용], 관계: row[col.관계], 금액: row[col.금액], 수취증빙: row[col.수취증빙], 리뷰: row[col.리뷰],
    생성일: row[col.생성일], 승인번호: row[col.승인번호], 사건ID: row[col.사건ID],
    중복정리: row[col.중복정리] || ''
  };
}

function client_getClients(params) {
  const sheets = client_getSheets_();
  const data = sheets.clients.getDataRange().getValues();
  const col = client_colMap_(data[0], CLIENT_HEADERS);
  const q = String((params && params.search) || '').trim();
  const clients = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][col.id]) continue;
    if (q && String(data[i][col.성명] || '').indexOf(q) === -1) continue;
    clients.push(client_readClient_(col, data[i]));
  }
  return { success: true, clients: clients };
}

function client_getConsultLogs(params) {
  const sheets = client_getSheets_();
  const data = sheets.log.getDataRange().getValues();
  const col = client_colMap_(data[0], CONSULT_HEADERS);
  const clientId = String((params && params.고객ID) || '').trim();
  const caseId = String((params && params.사건ID) || '').trim();
  const q = String((params && params.search) || '').trim();
  // [2026.09.19 신규] 중복으로 자동 정리된 기록은 대시보드·고객관리·처리개요 등 이 함수를
  // 그대로 쓰는 다른 화면에서는 항상 안 보이는 게 맞다(집계에 안 잡혀야 함) — 수금관리
  // 화면만 "흐리게 표시"를 위해 명시적으로 includeMerged:true를 넘겨 같이 받아간다.
  const includeMerged = !!(params && params.includeMerged);
  const logs = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][col.id]) continue;
    if (!includeMerged && String(data[i][col.중복정리] || '').trim()) continue;
    if (clientId && String(data[i][col.고객ID] || '').trim() !== clientId) continue;
    if (caseId && String(data[i][col.사건ID] || '').trim() !== caseId) continue;
    if (q && String(data[i][col.고객명] || '').indexOf(q) === -1) continue;
    logs.push(client_readLog_(col, data[i]));
  }
  logs.sort(function (a, b) { return String(b.날짜 || '').localeCompare(String(a.날짜 || '')); });
  return { success: true, logs: logs };
}

// [2026.10.09] 고객사건 폴더 바로 밑의 특수폴더(사건이 아님) — 사건 흡수·미연결/미등록 폴더 점검이 사건으로 잘못 잡지 않게 한곳에서 관리.
// 예전엔 0_NX_0만 이름으로 빼고 있어 '1 상담사건'이 정비 버튼에 사건으로 잡힐 수 있었다. 새 특수폴더를 고객사건 밑에 만들면 여기에 추가할 것.
// (후속확인 과제 목록은 고객사건이 아니라 상위 '0 NETAX/_확인조치사항.md'에 둔다 — 세무사님 지정 2026-10-10)
const WORK_SPECIAL_ROOT_FOLDERS_ = ['0_NX_0', '1 상담사건'];

// [2026.10.20] "개별 사건" 판정은 이 함수 하나로 — 세무사님 "최근기록에 개별사건이 아닌 사건들이 나타나는데, 이것은 채팅목록이나
// 사건목록에서도 공통된 사안". 예전엔 위 이름 2개만 빼서 '1 양도코리아'·'1 자문 예정, 보류, 취소'·'_AI대화기록'이 미등록 사건 점검에
// 잡히고, work 대화기록·사건 경과(전체일지)에는 0_NX_0이 사건처럼 떴다. 사건 목록(work_getCases)·미등록/미연결 점검·흡수·
// AI 대화 목록(work 대화기록)·AI 사건 경과가 모두 이 기준을 쓴다. 이름만 보고 판정한다(시트만 읽는 gs-light에서도 그대로 돌게).
//  · 이름 앞 "_" — 시스템 전용(_AI대화기록 등, 세무사님 규칙 2026-10-19)
//  · 숫자 + 공백/밑줄로 시작 — 사건 위로 정렬되게 붙인 보관함(0_NX_0·1 상담사건·1 양도코리아·1 자문 예정…·0 NETAX 맨위).
//    "1520(1520)_"·"3733(3733)_양도"처럼 숫자 바로 뒤가 괄호인 사건명은 사건이다.
//  · 고객사건 폴더 자체 이름(고객명·납세자 자리에 "고객사건"이 잘못 들어간 사건 모양 폴더 포함)
// 사건이면 '', 아니면 그 이유를 돌려준다.
function work_nonCaseReason_(name) {
  const n = String(name || '').trim();
  if (!n) return '이름 없음';
  if (WORK_SPECIAL_ROOT_FOLDERS_.indexOf(n) !== -1) return '특수폴더';
  if (n.charAt(0) === '_') return '시스템 폴더';
  if (/^\d+[ _]/.test(n)) return '보관함 폴더';
  if (/^고객사건(?:$|[(_ ])/.test(n)) return '고객사건 폴더 이름'; // 고객사건 자체, 또는 고객명 자리에 "고객사건"이 들어간 폴더
  return '';
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
const WORK_TAXPAYER_FIELD_BY_SEMOK_ = { transfer: 'trTransferorName', gift: 'giftDoneeName', inheritance: 'ihDeceasedName', business: 'bizTaxpayerName' };

const WORK_EVIDENCE_TEMPLATES_ = {
  transfer: {
    공통: [
      '양도 매매계약서(양도가액·양도일)',
      '취득 당시 매매계약서 또는 취득가액 증빙',
      '등기부등본(취득일·소유권 이전 이력)',
      '취득세 영수증',
      '중개보수 등 필요경비 영수증',
      '주민등록초본(전입·전출 이력, 거주기간 확인용)',
      '가족관계증명서(세대원 구성 확인)',
      '다른 주택 보유현황(1세대1주택 비과세 판정용)'
    ],
    사건분류: {
      '1세대1주택 비과세': ['전입세대열람내역(전체 거주이력)', '무주택확인서(다른 주택 미보유 확인)'],
      '1세대1주택 고가주택(과세)': ['전입세대열람내역(전체 거주이력)', '무주택확인서(다른 주택 미보유 확인)'],
      '일시적2주택 비과세': ['신규주택 취득 등기부등본', '종전주택 처분계약서(또는 처분계획)'],
      '2주택 중과': ['보유주택 전체 등기부등본', '조정대상지역 지정 여부 확인자료'],
      '3주택이상 중과': ['보유주택 전체 등기부등본', '조정대상지역 지정 여부 확인자료'],
      '비사업용 토지(중과)': ['토지이용계획확인서', '농지원부 또는 실제 경작(사업) 여부 확인자료'],
      '농지 등 감면(8년자경 등)': ['농지원부', '자경사실확인서', '농업경영체등록확인서'],
      '수용 등 공익사업 비과세·감면': ['협의계약서 또는 수용재결서', '보상금 수령내역'],
      '이월과세(배우자·직계존비속 증여 후 양도)': ['이전 증여계약서', '증여세 신고서'],
      '특수관계자간 거래(부당행위계산부인·저가양도 증여의제)': ['거래상대방 가족관계증명서', '시가 산정자료(감정평가서 등)'],
      '재건축·재개발(조합원입주권→신축주택 전환)': ['관리처분계획인가서', '종전자산(구건물) 취득 당시 매매계약서·등기부등본', '조합원 자격 확인서(조합원입주권 취득 경위)', '청산금 납부·환급 내역', '준공 후 신축건물 등기부등본(소유권보존등기)'],
      '미등기양도': ['미등기 사유 확인자료(있는 경우)'],
      '경매·공매': ['낙찰허가결정문(매각결정통지서)', '배당표'],
      '부담부증여(전액)': ['증여계약서', '채무인수·대출승계 서류'],
      '교환': ['교환계약서', '쌍방 자산 평가자료']
    }
  },
  gift: {
    공통: [
      '증여계약서',
      '가족관계증명서(증여자·수증자 관계 확인, 공제·세율 판정용)',
      '증여재산(부동산) 등기부등본·평가자료(감정가액 등)',
      '증여재산 중 그 외 자산 평가자료(비상장주식 평가자료 등, 해당 시)',
      '수증자 계좌 이체내역(현금증여 입증)',
      '채무인수 관련 자료(부담부증여인 경우 — 임대차계약서·대출계약서 등)',
      '10년 이내 동일인 증여 내역(증여재산 합산과세 확인용)',
      '수증자 신분증 사본'
    ],
    사건분류: {
      '부담부증여(부분, 순수증여분만)': ['채무인수·대출승계 서류', '임대차계약서(전세보증금 승계 시)'],
      '재차증여(10년내 합산)': ['과거 증여세 신고서'],
      '세대생략증여(할증)': ['가족관계증명서(조부모-손자녀 관계 확인)'],
      '명의신탁 증여의제': ['실제소유자 확인자료', '주식등변동상황명세서'],
      '저가양수·고가양도 증여의제': ['매매계약서', '시가 산정자료(감정평가서 등)'],
      '특정법인과의 거래 증여의제': ['법인 재무제표', '주주명부', '거래약정서'],
      '창업자금·가업승계 특례증여': ['사업계획서', '법인 정관·주주명부']
    }
  },
  inheritance: {
    공통: [
      '가족관계증명서·기본증명서(피상속인·상속인 확인)',
      '제적등본(피상속인)',
      '사망진단서 또는 사망사실이 기재된 가족관계증명서(사망일 확인)',
      '상속재산(부동산) 등기부등본·평가자료',
      '상속재산 중 그 외 재산 평가자료(예금잔액증명서, 주식평가자료 등)',
      '피상속인 금융거래내역(사망 전 1~2년, 사전증여·인출 확인용)',
      '채무증빙(대출잔액증명서, 임대보증금 반환채무 등)',
      '장례비용 영수증',
      '봉안시설·자연장지 사용료 영수증(장례비 1천만원과 별도 5백만원 한도, 상증령 §9②)',
      '사전증여재산 내역(상속인 10년·비상속인 5년 이내 증여분)'
    ],
    사건분류: {
      '배우자상속공제 해당': ['상속재산 분할협의서', '배우자 상속분 등기 관련 자료'],
      '가업상속공제 해당': ['사업자등록증', '법인 정관·주주명부', '가업영위기간 증빙'],
      '영농상속공제 해당': ['농지원부', '자경사실확인서'],
      '동거주택상속공제 해당': ['동거 사실 확인 주민등록초본(10년 이상)'],
      '사전증여재산 합산(10년내 상속인·5년내 비상속인)': ['과거 증여세 신고서'],
      '상속포기·한정승인': ['상속포기·한정승인 심판문'],
      '유증·사인증여': ['유언장 또는 사인증여계약서']
    }
  }
};

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

// [2026.09] "사건분류 목록이 casehandling.html과 Code.js(WORK_EVIDENCE_TEMPLATES_) 두 곳에
// 따로 하드코딩돼 있어 한쪽만 고치면 조용히 어긋날 수 있다"는 지적 — 실제로 지금까지 어긋난
// 적은 없었지만(직접 대조 확인됨), 근본적으로 없애려면 한 곳(여기, 필요증빙 템플릿이 있는
// Code.js)만 진짜 목록을 갖고 화면은 그걸 그대로 받아쓰게 해야 한다. casehandling.html은
// 이제 이 목록 앞에 빈 선택지와 "일반OO"만 붙여서 그대로 렌더링한다.
function work_getEvidenceClassificationOptions_() {
  const options = {};
  Object.keys(WORK_EVIDENCE_TEMPLATES_).forEach(function (semok) {
    options[semok] = Object.keys(WORK_EVIDENCE_TEMPLATES_[semok].사건분류 || {});
  });
  return options;
}

function work_getCases(params) {
  const sheet = work_getSheet_();
  const data = sheet.getDataRange().getValues();
  const col = work_colMap_(data[0]);
  const cases = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][col.id]) continue;
    if (String(data[i][col.사건명] || '').trim() && work_nonCaseReason_(data[i][col.사건명])) continue; // 개별 사건이 아닌 행(0_NX_0 등 보관함을 잘못 등록한 것) — 판정은 work_nonCaseReason_ 하나
    cases.push(work_readRow_(col, data[i]));
  }
  return { success: true, cases: cases, evidenceClassificationOptions: work_getEvidenceClassificationOptions_() };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
