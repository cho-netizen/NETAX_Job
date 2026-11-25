// [2026-11-25] 현금영수증 사진 문자 — 세무사님 "단순 상담고객에게 현금영수증을 보내주어야 하는데, 문자메시지로 보내주어야 한다 …
//  단순상담고객은 카카오채널로 보내줄 수가 없어서 일일이 화면을 캡쳐하여 그림파일로 저장한다음 카카오로 나에게 보내기 한 다음
//  스마트폰에서 다운로드한 다음에 문자메시지로 보내주고 있다. 이 것을 넥스시스템에서 직접 보내주는 것을 구현해 달라"
//  / "단순고객의 현금영수증은 고객사건폴더아래 <1 상담사건>폴더에 현금영수증 pdf파일을 저장하고 있다"
//  / "현금영수증을 발급하여 폴더에 저장하고 나서 문자메시지를 보내주어야 하는데, 수금관리에는 바로 보이지 않잖아?" → "그렇게 하자"
//  계획서 docs/_기록/현금영수증_사진문자_계획서_20261125.html(둘째 판, 세무사님 "권장대로 하자").
//
//  차례: ① 목록 — 「1 상담사건」(하위 폴더 포함)의 현금영수증 PDF를 최근 것부터(수금 기록 전이라도 폴더에 저장한 바로 그때 보인다)
//        ② 준비 — 고른 파일 하나를 판독(금액·날짜·발행처, 비용 0원)하고 받는 번호를 찾고 PDF를 화면에 넘김(화면이 첫 쪽을 JPG로 만든다)
//        ③ 보내기 — 솔라피 사진 문자(사진 올리기 storage/v1/files → messages/v4/send의 imageId). 성공하면 그 영수증을 수금에 바로 적고
//          (receipt_logGroup_ — 밤 2시·「확인」 훑기와 같은 판정·같은 「기록함」 표시라 두 번 세지 않는다) 상담 기록에 한 줄.
//  솔라피 사진 문자: 사진 200KB까지·JPG, 한 통 110원(2026-11-25 솔라피 요금표·공식 SDK 원본으로 확인).
//  예전(2026.09.18) "SOLAPI 문자는 텍스트만 지원"이라 적고 공유 링크로 대신한 것은 틀린 판단이었다(Code.js client_sendSms 주석).

var RSMS_SENT_PROP_ = 'netax_receipt_sms';      // 파일에 붙이는 「보냄」 표시(보낸 시각 yyyy-MM-dd HH:mm)
var RSMS_MAX_IMAGE_BYTES_ = 200 * 1024;          // 솔라피 사진 문자 한도
var RSMS_NAME_RE_ = /^(.+?)_현금영수증/;

function receiptSms_doPost_(body) {
  switch (body.action) {
    case 'receipt_sms_list': return receiptSms_list_();
    case 'receipt_sms_prepare': return receiptSms_prepare_(body);
    case 'receipt_sms_send': return receiptSms_send_(body);
  }
  return { success: false, message: '알 수 없는 작업' };
}

// 「1 상담사건」과 그 아래 폴더들의 ID(깊이 4까지)
function receiptSms_folderIds_() {
  const root = getConsultSharedFolder_();
  if (!root) return [];
  const ids = [root.getId()];
  (function walk(folder, depth) {
    if (depth >= 4) return;
    const it = folder.getFolders();
    while (it.hasNext()) { const f = it.next(); ids.push(f.getId()); walk(f, depth + 1); }
  })(root, 0);
  return ids;
}

// 파일이 「1 상담사건」 안에 있는지 — 이 기능은 그 폴더의 영수증만 보낸다(계획서 ㉣)
function receiptSms_checkFile_(fileId, folderIds) {
  const f = Drive.Files.get(fileId, { fields: 'id,name,mimeType,parents,modifiedTime,appProperties,trashed' });
  if (!f || f.trashed) throw new Error('파일을 찾을 수 없습니다(휴지통으로 갔을 수 있습니다).');
  const inside = (f.parents || []).some(function (p) { return folderIds.indexOf(p) !== -1; });
  if (!inside) throw new Error('「1 상담사건」 폴더의 영수증만 보낼 수 있습니다.');
  if (!RSMS_NAME_RE_.test(f.name)) throw new Error('파일 이름이 「고객명_현금영수증」 모양이 아닙니다: ' + f.name);
  return f;
}

function receiptSms_when_(iso) {
  try { return Utilities.formatDate(new Date(iso), 'Asia/Seoul', 'MM-dd HH:mm'); } catch (e) { return ''; }
}

// ① 목록 — 최근 저장한 것부터 50개
function receiptSms_list_() {
  const ids = receiptSms_folderIds_();
  if (!ids.length) return { success: false, message: '「1 상담사건」 폴더를 찾지 못했습니다.' };
  const q = '(' + ids.map(function (id) { return "'" + id + "' in parents"; }).join(' or ') + ") and name contains '현금영수증' and mimeType = 'application/pdf' and trashed = false";
  const res = Drive.Files.list({ q: q, orderBy: 'createdTime desc', pageSize: 50, fields: 'files(id,name,createdTime,modifiedTime,appProperties)' });
  const files = (res.files || []).map(function (f) {
    const ap = f.appProperties || {};
    const m = String(f.name).match(RSMS_NAME_RE_);
    return {
      id: f.id, name: f.name, 고객명: m ? m[1].trim() : '',
      저장: receiptSms_when_(f.createdTime || f.modifiedTime),
      보냄: ap[RSMS_SENT_PROP_] || '',
      수금: ap.netax_receipt_logged === 'true' ? '기록함' : (ap.netax_receipt_logged ? '이 사무소 발행 아님' : '')
    };
  });
  return { success: true, files: files };
}

// 받는 번호 후보 — 고객관리(같은 고객ID, 없으면 같은 성명) → 상담 예약 기록(같은 이름, 최근 것부터)
function receiptSms_findPhones_(name, clientId) {
  const out = [];
  const add = function (num, from) {
    const d = String(num || '').replace(/[^0-9]/g, '');
    if (!/^01[016789]\d{7,8}$/.test(d)) return;
    if (out.some(function (o) { return o.phone === d; })) return;
    out.push({ phone: d, from: from });
  };
  const nm = String(name || '').replace(/\s+/g, '');
  try {
    const sheets = client_getSheets_();
    const data = sheets.clients.getDataRange().getValues();
    const col = client_colMap_(data[0], CLIENT_HEADERS);
    for (let i = 1; i < data.length; i++) {
      const same = clientId ? String(data[i][col.id]) === String(clientId) : String(data[i][col.성명] || '').replace(/\s+/g, '') === nm;
      if (!same) continue;
      client_splitPhoneNumbers_(data[i][col.전화번호]).forEach(function (p) { add(p, '고객관리'); });
      if (col.추가연락처 !== undefined) client_parseExtraContacts_(data[i][col.추가연락처]).forEach(function (c) { add(c.전화번호, '고객관리 추가연락처' + (c.이름 ? '·' + c.이름 : '')); });
    }
  } catch (e) { console.error('영수증 문자: 고객 전화번호 읽기 실패 ' + e.message); }
  try {
    const bs = SpreadsheetApp.openById(BOOKING_SHEET_ID).getSheetByName('Applications');
    const bdata = bs ? bs.getDataRange().getValues() : [];
    for (let i = bdata.length - 1; i >= 1; i--) {
      if (String(bdata[i][1] || '').replace(/\s+/g, '') === nm) add(bdata[i][2], '상담 예약 기록');
    }
  } catch (e) { console.error('영수증 문자: 예약 기록 읽기 실패 ' + e.message); }
  return out;
}

function receiptSms_caseInfo_(file, folderIds) {
  const info = findCaseForFile_(file.id) || findConsultNoCaseInfo_(file.id, file.name, folderIds[0]);
  if (info) return info;
  const m = String(file.name).match(RSMS_NAME_RE_);
  return { 고객명: m ? m[1].trim() : '', 고객ID: '', caseId: '', noCase: true };
}

// ② 준비 — 판독·번호·PDF
function receiptSms_prepare_(body) {
  const fileId = String(body.fileId || '').trim();
  if (!fileId) return { success: false, message: '파일이 필요합니다.' };
  try {
    const ids = receiptSms_folderIds_();
    const f = receiptSms_checkFile_(fileId, ids);
    const ci = receiptSms_caseInfo_(f, ids);
    let ex = {};
    try { ex = extractReceiptAmountViaOCR_(f.id) || {}; } catch (e) { ex = { error: e.message }; }
    const bytes = DriveApp.getFileById(f.id).getBlob().getBytes();
    const ap = f.appProperties || {};
    return {
      success: true,
      file: { id: f.id, name: f.name },
      고객명: ci.고객명, 고객ID: ci.고객ID || '', caseId: ci.caseId || '',
      phones: receiptSms_findPhones_(ci.고객명, ci.고객ID),
      금액: ex.confident ? ex.amount : '', 날짜: ex.date || '', 판독확실: !!ex.confident,
      발행처: ex.issuer === 'office' ? '이음 세무컨설팅' : ex.issuer === 'other' ? ('다른 사업자' + (ex.issuerName ? '(' + ex.issuerName + ')' : '')) : '못 읽음',
      이사무소: ex.issuer === 'office',
      보냄: ap[RSMS_SENT_PROP_] || '',
      수금: ap.netax_receipt_logged === 'true' ? '기록함' : (ap.netax_receipt_logged ? '이 사무소 발행 아님' : ''),
      pdfBase64: Utilities.base64Encode(bytes)
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function receiptSms_auth_(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = Utilities.getUuid();
  const sig = Utilities.computeHmacSha256Signature(date + salt, apiSecret).map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  return 'HMAC-SHA256 apiKey=' + apiKey + ', date=' + date + ', salt=' + salt + ', signature=' + sig;
}

// 솔라피 사진 문자 한 통 — 사진 올리기 → imageId를 붙여 보내기. 실패면 예외.
function receiptSms_sendMms_(to, text, jpgBase64) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('SOLAPI_API_KEY'), apiSecret = props.getProperty('SOLAPI_API_SECRET'), from = props.getProperty('SOLAPI_SENDER_PHONE');
  if (!apiKey || !apiSecret || !from) throw new Error('문자 서비스 설정(솔라피 열쇠·발신번호)이 없습니다.');
  const up = UrlFetchApp.fetch('https://api.solapi.com/storage/v1/files', {
    method: 'post', contentType: 'application/json', headers: { Authorization: receiptSms_auth_(apiKey, apiSecret) },
    payload: JSON.stringify({ file: jpgBase64, type: 'MMS', name: 'receipt.jpg' }), muteHttpExceptions: true
  });
  if (up.getResponseCode() >= 300) throw new Error('사진 올리기 실패(' + up.getResponseCode() + '): ' + up.getContentText().slice(0, 300));
  const imageId = (JSON.parse(up.getContentText()) || {}).fileId;
  if (!imageId) throw new Error('사진 올리기 답에 번호가 없습니다: ' + up.getContentText().slice(0, 200));
  const res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', {
    method: 'post', contentType: 'application/json', headers: { Authorization: receiptSms_auth_(apiKey, apiSecret) },
    payload: JSON.stringify({ message: { to: to, from: String(from).replace(/-/g, ''), text: text, subject: '현금영수증', imageId: imageId } }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error('보내기 실패(' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 300));
}

// 보낸 번호를 고객관리에 남긴다 — 이미 있으면 그대로, 전화번호 칸이 비었으면 거기, 다른 번호가 있으면 「추가연락처」에 더한다.
//  같은 이름 고객이 없으면 그 번호로 새로 등록. client_findOrCreateByName_를 바로 쓰면 다른 번호가 있는 같은 이름을
//  "다른 사람"으로 보고 고객을 하나 더 만들어 버려서(동명이인 규칙) 여기서 먼저 가린다. 같은 이름이 여럿이면 짐작하지 않는다.
//  돌려주는 값: 화면 알림에 붙일 한 줄('' = 이미 있음)
function receiptSms_fmtPhone_(d) { return d.length === 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6); }
function receiptSms_savePhone_(name, clientId, phone) {
  const pretty = receiptSms_fmtPhone_(phone);
  const nm = String(name || '').replace(/\s+/g, '');
  const r = withLock_(8000, function () {
    const sheets = client_getSheets_();
    const data = sheets.clients.getDataRange().getValues();
    const col = client_colMap_(data[0], CLIENT_HEADERS);
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const same = clientId ? String(data[i][col.id]) === String(clientId) : String(data[i][col.성명] || '').replace(/\s+/g, '') === nm;
      if (same) rows.push(i);
    }
    const hasPhone = function (i) {
      const extra = col.추가연락처 !== undefined ? client_parseExtraContacts_(data[i][col.추가연락처]).map(function (c) { return String(c.전화번호).replace(/[^0-9]/g, ''); }) : [];
      return client_splitPhoneNumbers_(data[i][col.전화번호]).concat(extra).indexOf(phone) !== -1;
    };
    if (rows.some(hasPhone)) return { msg: '' };
    if (!rows.length) return { create: true };
    if (rows.length > 1) return { msg: '같은 이름 고객이 ' + rows.length + '명이라 번호를 고객관리에 남기지 않았습니다(고객관리에서 직접)' };
    const i = rows[0], rowIndex = i + 1;
    if (!String(data[i][col.전화번호] || '').trim()) {
      sheets.clients.getRange(rowIndex, col.전화번호 + 1).setNumberFormat('@').setValue(pretty);
      return { msg: '번호를 고객관리 전화번호 칸에 넣었습니다' };
    }
    if (col.추가연락처 === undefined) return { msg: '고객관리에 추가연락처 칸이 없어 번호를 남기지 못했습니다' };
    const extra = client_parseExtraContacts_(data[i][col.추가연락처]);
    extra.push({ 이름: '영수증 문자', 전화번호: pretty });
    sheets.clients.getRange(rowIndex, col.추가연락처 + 1).setNumberFormat('@').setValue(client_serializeExtraContacts_(extra));
    return { msg: '전화번호 칸에 다른 번호가 있어 고객관리 추가연락처에 더했습니다' };
  });
  if (r && r.create) { client_findOrCreateByName_(name, pretty); return '고객관리에 새 고객으로 번호와 함께 등록했습니다'; }
  return r ? r.msg : '';
}

// 시험 보내기 — 세무사님 "내 휴대폰으로 시험 한통 보내라"(11-25). 받는 번호는 서버가 정한다(세무사님 알림 번호 NX_REMINDER_PHONE,
//  없으면 예약 알림 번호) — 고객에게는 갈 수 없다. 글 앞에 [시험]을 붙이고, 수금·고객관리·상담 기록·보냄 표시는 하나도 남기지 않는다
//  (실제 고객 영수증으로 시험해도 그 고객 기록에 세무사님 번호가 들어가지 않게).
function receiptSms_sendTest_(body) {
  const to = String(PropertiesService.getScriptProperties().getProperty('NX_REMINDER_PHONE') || BOOKING_OWNER_PHONE || '').replace(/[^0-9]/g, '');
  const text = '[시험] ' + String(body.text || '').trim();
  const jpg = String(body.jpgBase64 || '').replace(/^data:image\/jpeg;base64,/, '');
  if (!/^01[016789]\d{7,8}$/.test(to)) return { success: false, message: '세무사님 알림 번호가 없습니다.' };
  if (!jpg) return { success: false, message: '영수증 그림이 없습니다.' };
  if (Math.floor(jpg.length * 3 / 4) > RSMS_MAX_IMAGE_BYTES_) return { success: false, message: '영수증 그림이 200KB를 넘습니다.' };
  try { receiptSms_checkFile_(String(body.fileId || ''), receiptSms_folderIds_()); } catch (err) { return { success: false, message: err.message }; }
  try { receiptSms_sendMms_(to, text.slice(0, 1000), jpg); }
  catch (err) { smsFailLog_('현금영수증 사진 문자(시험)', err.message); return { success: false, message: '문자를 보내지 못했습니다: ' + err.message }; }
  return { success: true, test: true, to: to.slice(0, 3) + '-****-' + to.slice(-4) };
}

// ③ 보내기 — 사진 문자 → (성공하면) 수금 기록·보냄 표시·상담 기록
function receiptSms_send_(body) {
  if (body.test) return receiptSms_sendTest_(body);
  const fileId = String(body.fileId || '').trim();
  const phone = String(body.phone || '').replace(/[^0-9]/g, '');
  const text = String(body.text || '').trim();
  const jpg = String(body.jpgBase64 || '').replace(/^data:image\/jpeg;base64,/, '');
  if (!fileId) return { success: false, message: '파일이 필요합니다.' };
  if (!/^01[016789]\d{7,8}$/.test(phone)) return { success: false, message: '받는 번호가 휴대폰 번호 모양이 아닙니다.' };
  if (!text) return { success: false, message: '보낼 글이 비어 있습니다.' };
  if (!jpg) return { success: false, message: '영수증 그림이 없습니다.' };
  if (Math.floor(jpg.length * 3 / 4) > RSMS_MAX_IMAGE_BYTES_) return { success: false, message: '영수증 그림이 200KB를 넘습니다(솔라피 사진 문자 한도).' };

  let f, ids;
  try { ids = receiptSms_folderIds_(); f = receiptSms_checkFile_(fileId, ids); } catch (err) { return { success: false, message: err.message }; }
  const ci = receiptSms_caseInfo_(f, ids);

  try {
    receiptSms_sendMms_(phone, text.slice(0, 1000), jpg);
  } catch (err) {
    smsFailLog_('현금영수증 사진 문자', err.message);
    return { success: false, message: '문자를 보내지 못했습니다: ' + err.message };
  }

  const out = { success: true, 수금: '', 금액: '', notes: [] };
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  try {
    const props = {}; props[RSMS_SENT_PROP_] = now;
    Drive.Files.update({ appProperties: props }, f.id);
  } catch (e) { out.notes.push('보냄 표시를 붙이지 못함'); }

  // 수금 — 이미 적은 영수증(밤 훑기·전에 보냄)이면 다시 적지 않는다. 같은 폴더의 같은 이름 그림도 한 묶음으로 표시.
  try {
    const fresh = Drive.Files.get(f.id, { fields: 'id,name,modifiedTime,appProperties' });
    const logged = (fresh.appProperties || {}).netax_receipt_logged;
    if (logged) {
      out.수금 = logged === 'true' ? 'already' : 'not_office';
    } else {
      const base = String(f.name).replace(/\.[^.]+$/, '');
      const sib = Drive.Files.list({ q: "'" + f.parents[0] + "' in parents and name contains '" + base.replace(/'/g, "\\'") + "' and trashed = false", fields: 'files(id,name,modifiedTime,appProperties)', pageSize: 20 });
      const group = [{ file: fresh, caseInfo: ci }];
      (sib.files || []).forEach(function (s) {
        if (s.id === f.id || (s.appProperties || {}).netax_receipt_logged) return;
        if (String(s.name).replace(/\.[^.]+$/, '') === base) group.push({ file: s, caseInfo: ci });
      });
      const ex = extractReceiptAmountViaOCR_(f.id);
      const r = { added: 0, needCheck: 0, noCase: 0, noCaseNames: [], notOffice: [] };
      out.수금 = receipt_logGroup_(group, ex, r);
      if (out.수금 === 'added') out.금액 = ex.confident ? ex.amount : '';
      if (out.수금 === 'added' && !ex.confident) out.notes.push('금액을 읽지 못해 수금관리에 「금액 확인 필요」로 적음');
    }
  } catch (err) {
    out.수금 = 'error';
    out.notes.push('수금 기록 실패: ' + err.message + ' — 밤 2시·「확인」 훑기 때 다시 적힙니다');
  }

  // 받는 번호를 고객관리에 — 세무사님 "보내주는 전화번호를 고객관리에 자동으로 반영되면 좋겠다"(11-25)
  if (ci.고객명) {
    try { const w = receiptSms_savePhone_(ci.고객명, ci.고객ID, phone); if (w) out.notes.push(w); } catch (e) { out.notes.push('번호를 고객관리에 남기지 못함: ' + e.message); }
  }
  // 상담 기록 한 줄
  try {
    client_addConsultLog({ 고객ID: ci.고객ID || '', 고객명: ci.고객명, 사건ID: ci.caseId || '', 유형: '문자 발송', 내용: '현금영수증 사진 문자(' + f.name + ') — ' + text.slice(0, 300) });
  } catch (e) { out.notes.push('상담 기록을 남기지 못함'); }
  return out;
}
