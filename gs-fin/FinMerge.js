// ============================================================
// [2026.11.20] 금융거래 원시파일 한 파일로 합치기(1단계) — 토큰 0
// ------------------------------------------------------------
// 세무사님 11-20: "1단계로 의뢰인으로 부터 받은 다양한 금융기관의 거래내역을 하나의 파일로 합치는 것"
//  / "현재 고객사건 폴더에 있는 금융계좌 원시파일을 대상으로 파일합치는 구조를 연구해야 할 것이다"
//  / "은행별로 필드가 일정하게 정해져 있으면 좋을텐데, 이게 아니면 매번 필드를 고민해야 하겠지"
//  / "CSV파일은 … 검토대상이 아니라" · "내가 합쳐서 작업한 파일은 지금 검토대상이 아니잖아" → 「권장대로 하자」
//  계획서: docs/_기록/금융거래_10년검토_계획서_20261120.html(1단계만 — 2단계 조건 뽑기는 여기 없음)
//
// 하는 일
//  ① 은행 서식표(FIN_FORMATS_BUILTIN_ + 업무관리자/금융거래_은행서식표.json)로 파일 머리글을 알아보고 칸 짝을 정한다 — 묻지 않음.
//     처음 보는 서식은 짐작한 짝으로 합치고 「새 서식」으로 돌려준다(화면이 한 번 여쭙고 서식표에 더함).
//  ② 칸 세 층: 공통(거래일자·거래시간·입금·출금·잔액) · 표준(내용·상대·상대은행·상대계좌·거래구분·거래점·메모) · 원본 칸(나머지, 한 칸에 모음)
//  ③ 같은 계좌의 같은 거래(날짜·금액·방향)는 한 번만 — 여러 파일에 있으면 「같은 거래 다른 파일」에 적음. 출처끼리 잔액이 다르면 ⚠
//  ④ 숫자는 지금 쓰는 엑셀 정리 규칙(bankParseRows_ — 잔액 검산)·PDF/사진 정리 규칙(docBankStmtParse_)으로. 금액을 짐작해 채우지 않음
//  ⑤ 결과는 사건 폴더의 구글 시트 「금융거래_통합_(납세자)_날짜」 — 탭: 계좌 목록·거래·겹쳐서 한 번만 센 줄·확인할 것·칸 대응표·계좌별 원본
//  읽지 않는 것: CSV(세무사님 변환본), 사무소 합본·손본 파일, 이 도구가 만든 시트. 고객 원본 파일은 고치지 않는다.
// ============================================================

// ---------- 장부 칸 ----------
var FIN_CORE_ = ['거래일자', '거래시간', '거래일시', '입금', '출금', '금액', '입출구분', '잔액'];
var FIN_STD_ = ['내용', '상대', '상대은행', '상대계좌', '거래구분', '거래점', '메모'];
var FIN_TARGETS_ = FIN_CORE_.concat(FIN_STD_).concat(['원본']);
// 핵심 칸을 엑셀 정리 규칙(bankParseRows_ BANK_COL_)이 알아보는 이름으로 바꿔 넣는다 — 숫자 읽기·잔액 검산은 그 규칙 그대로
var FIN_PARSE_NAME_ = { 거래일자: '거래일자', 거래시간: '시간', 거래일시: '거래일시', 입금: '입금', 출금: '출금', 금액: '거래금액', 입출구분: '구분', 잔액: '잔액' };

// ---------- 은행 서식표 첫 판(11-20 고객사건 폴더 원시파일 조사 — 계획서 3절) ----------
//  머리글: 원본 순서 그대로. 짝: 원본 칸 → 장부 칸(없는 칸은 「원본 칸」으로). 제목: 머리 위 줄에서 서식을 알아보는 낱말(없어도 머리글로 알아봄)
var FIN_FORMATS_BUILTIN_ = [
  { id: '우체국_금융거래명세조회', 기관: '우체국', 제목: '금융거래명세조회',
    머리글: ['거래일자', '거래시간', '거래금액(원)', '거래후잔액(원)', '구분', '거래점', '거래점명', '거래내용', '적요', '상대은행', '계좌번호', '이체금액(원)', '수표금액(원)'],
    짝: { '거래일자': '거래일자', '거래시간': '거래시간', '거래금액(원)': '금액', '거래후잔액(원)': '잔액', '구분': '입출구분', '거래점명': '거래점', '거래내용': '거래구분', '적요': '내용', '상대은행': '상대은행', '계좌번호': '상대계좌' } },
  { id: '농협_요구불계좌거래내역조회', 기관: '농협', 제목: '요구불계좌거래내역조회',
    머리글: ['순번', '거래일자', '시간', '찾으신금액', '맡기신금액', '남은금액', '거래내용', '기록사항', '연동은행', '연동입금계좌번호', '거래점', '은행구분'],
    짝: { '거래일자': '거래일자', '시간': '거래시간', '찾으신금액': '출금', '맡기신금액': '입금', '남은금액': '잔액', '거래내용': '거래구분', '기록사항': '내용', '연동은행': '상대은행', '연동입금계좌번호': '상대계좌', '거래점': '거래점' } },
  { id: '국민_인터넷_거래내역조회', 기관: '국민', 제목: '',
    머리글: ['거래일시', '적요', '보낸분/받는분', '송금메모', '출금액', '입금액', '잔액', '거래점', '구분'],
    짝: { '거래일시': '거래일시', '적요': '거래구분', '보낸분/받는분': '상대', '송금메모': '메모', '출금액': '출금', '입금액': '입금', '잔액': '잔액', '거래점': '거래점' } },
  { id: '국민_창구_본인금융거래', 기관: '국민', 제목: '본인금융거래',
    머리글: ['거래일자', '상태', '거래구분', '거래금액', '표면잔액', '적요(의뢰인등)', '취급점', '기산일자', '처리시각', '이체상대계좌번호', '은행명'],
    짝: { '거래일자': '거래일자', '상태': '입출구분', '거래구분': '거래구분', '거래금액': '금액', '표면잔액': '잔액', '적요(의뢰인등)': '내용', '취급점': '거래점', '처리시각': '거래시간', '이체상대계좌번호': '상대계좌', '은행명': '상대은행' } },
  // [2026.11.21] 신협 「입출금거래내역」(최근 거래부터) — 11-21 이애정 사건 26계좌에서 처음 봄. 짐작한 짝을 원본과 맞대 고쳐 등록(거래종류 「141:이자지급」을 거래구분으로)
  { id: '신협_입출금거래내역', 기관: '신협', 제목: '입출금거래내역',
    머리글: ['순번', '거래일자', '거래시각', '입출구분', '현금대체구분', '거래종류', '입금금액', '출금금액', '거래후잔액', '수표번호', '상대은행', '상대계좌관리점', '상대계좌관리점명', '상대계좌번호', '상대계좌예금주', '취급은행', '취급은행지점', '취급조합', '적요'],
    짝: { '거래일자': '거래일자', '거래시각': '거래시간', '입출구분': '입출구분', '현금대체구분': '메모', '거래종류': '거래구분', '입금금액': '입금', '출금금액': '출금', '거래후잔액': '잔액', '상대은행': '상대은행', '상대계좌번호': '상대계좌', '상대계좌예금주': '상대', '취급은행지점': '거래점', '적요': '내용' } },
  { id: '신한_거래내역', 기관: '신한', 제목: '',
    머리글: ['거래일', '구분', '거래금액', '거래후잔액', '거래메모', '키', '기번', '점', '비고', '연동은행', '연동계좌번호', 'cms번호'],
    짝: { '거래일': '거래일자', '구분': '입출구분', '거래금액': '금액', '거래후잔액': '잔액', '거래메모': '내용', '점': '거래점', '비고': '메모', '연동은행': '상대은행', '연동계좌번호': '상대계좌' } }
];
var FIN_FORMAT_FILE_ = '금융거래_은행서식표.json';
var FIN_OUT_PREFIX_ = '금융거래_통합_';
var FIN_STATE_FILE_ = '_금융거래_합치기_진행.json';
var FIN_BANK_RE_ = /(우체국|새마을금고|신협|수협|농협|축협|국민|KB|신한|우리|하나|기업|IBK|SC제일|SC|씨티|카카오뱅크|카카오|토스뱅크|토스|케이뱅크|산업|부산|대구|경남|광주|전북|제주|저축은행|증권|미래에셋|삼성|NH투자|한국투자|키움)/;

function finKey_(s) { return bankHdrKey_(s).replace(/\s+/g, ''); }
function finHash32_(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }

// ---------- 서식표 읽기·쓰기 ----------
function finFormatFile_(create) {
  var dir = getBusinessManagerFolder_();
  var it = dir.getFilesByName(FIN_FORMAT_FILE_);
  if (it.hasNext()) return it.next();
  if (!create) return null;
  return dir.createFile(FIN_FORMAT_FILE_, JSON.stringify({ 안내: '금융거래 합치기 은행 서식표 — 세무사님이 설정 화면에서 보고 고치십니다. 첫 판 서식(코드 안)은 같은 id로 덮어쓸 수 있습니다.', 서식: [] }, null, 1), 'application/json');
}
var FIN_FORMATS_MEMO_ = null;
function finFormats_() {
  if (FIN_FORMATS_MEMO_) return FIN_FORMATS_MEMO_;
  var saved = [];
  try { var f = finFormatFile_(false); if (f) saved = (JSON.parse(f.getBlob().getDataAsString('UTF-8')) || {}).서식 || []; } catch (e) { saved = []; }
  var list = FIN_FORMATS_BUILTIN_.map(function (x) { return Object.assign({ 출처: '첫 판' }, x); });
  saved.forEach(function (s) {
    if (!s || !s.id || !Array.isArray(s.머리글)) return;
    var i = list.map(function (x) { return x.id; }).indexOf(s.id), v = Object.assign({}, s, { 출처: '서식표 파일' });
    if (i === -1) list.push(v); else list[i] = v;
  });
  FIN_FORMATS_MEMO_ = list;
  return list;
}
function finFormatsSave_(body) {
  var list = (body && body.formats) || [];
  if (!Array.isArray(list)) return { error: '서식 목록이 아님' };
  var clean = [];
  for (var i = 0; i < list.length; i++) {
    var s = list[i] || {};
    var id = String(s.id || '').trim().slice(0, 60), hdr = (s.머리글 || []).map(function (h) { return String(h || '').trim(); }).filter(String), map = {};
    if (!id || hdr.length < 3) return { error: '서식 ' + (i + 1) + ': 이름과 머리글(3칸 이상)이 필요함' };
    Object.keys(s.짝 || {}).forEach(function (k) { var t = String(s.짝[k] || ''); if (hdr.indexOf(k) !== -1 && FIN_TARGETS_.indexOf(t) !== -1 && t !== '원본') map[k] = t; });
    var tv = Object.keys(map).map(function (k) { return map[k]; });
    var hasDate = tv.indexOf('거래일자') !== -1 || tv.indexOf('거래일시') !== -1, hasMoney = tv.indexOf('입금') !== -1 || tv.indexOf('출금') !== -1 || tv.indexOf('금액') !== -1;
    if (!hasDate || !hasMoney || tv.indexOf('잔액') === -1) return { error: '서식 「' + id + '」: 거래일자(또는 거래일시)·입금/출금(또는 금액)·잔액 칸 짝이 있어야 함' };
    if (tv.indexOf('금액') !== -1 && tv.indexOf('입출구분') === -1 && tv.indexOf('입금') === -1 && tv.indexOf('출금') === -1) return { error: '서식 「' + id + '」: 금액이 한 칸이면 입출구분 칸 짝이 있어야 함' };
    clean.push({ id: id, 기관: String(s.기관 || '').slice(0, 20), 제목: String(s.제목 || '').slice(0, 40), 머리글: hdr, 짝: map, 고친날: String(s.고친날 || new Date().toISOString().slice(0, 10)) });
  }
  var f = finFormatFile_(true), old = {};
  try { old = JSON.parse(f.getBlob().getDataAsString('UTF-8')) || {}; } catch (e) { old = {}; }
  old.서식 = clean;
  f.setContent(JSON.stringify(old, null, 1));
  FIN_FORMATS_MEMO_ = null;
  return { ok: true, 서식수: clean.length };
}
function finFormatsGet_() { return { ok: true, 서식: finFormats_(), 장부칸: FIN_TARGETS_ }; }

// 머리글 줄 → 맞는 서식(원본 칸 열쇠가 서식 머리글의 9할 이상 같고, 핵심 칸이 모두 있음)
function finMatchFormat_(hdrCells, above) {
  var keys = hdrCells.map(finKey_), have = keys.filter(String), best = null;
  finFormats_().forEach(function (fm) {
    var fk = fm.머리글.map(finKey_), hit = fk.filter(function (k) { return keys.indexOf(k) !== -1; }).length;
    var core = Object.keys(fm.짝).filter(function (k) { return FIN_CORE_.indexOf(fm.짝[k]) !== -1; }).every(function (k) { return keys.indexOf(finKey_(k)) !== -1; });
    // 원본 서식은 칸이 빠진 판(순번 없음·끝 두 칸 없음)은 있어도 칸이 더 붙지는 않는다 — 서식에 없는 칸이 둘 넘으면 다른 서식(손본 파일 포함)
    if (!core || hit < fk.length * 0.8 || have.length - hit > 2) return;
    var sc = hit / Math.max(fk.length, have.length) + (fm.제목 && above.replace(/\s+/g, '').indexOf(fm.제목) !== -1 ? 0.5 : 0);
    if (!best || sc > best.sc) best = { fm: fm, sc: sc };
  });
  return best ? best.fm : null;
}
// 처음 보는 서식 — 엑셀 정리 규칙의 낱말표(BANK_COL_)로 칸 짝을 짐작한다(세무사님께 한 번 여쭙고 서식표에 더할 안)
//  (11-20 시험: 신협 「입출금거래내역」 — 거래시각·상대계좌번호·상대계좌예금주를 놓쳐 낱말 규칙을 칸마다 차례로 둠. 한 장부 칸엔 처음 맞는 원본 칸 하나만)
var FIN_GUESS_RULES_ = [
  [/^(거래일시|일시|거래일자시간)$/, '거래일시'],
  [/^(거래일자|거래일|일자|거래날짜|날짜)$/, '거래일자'],
  [/^(거래)?(시간|시각)$|^처리(시각|시간)$/, '거래시간'],
  [/^(출금|출금액|출금금액|찾으신금액|찾은금액|지급|지급액|지급금액|인출금액)$/, '출금'],
  [/^(입금|입금액|입금금액|맡기신금액|맡긴금액)$/, '입금'],
  [/^(거래금액|금액)$/, '금액'],
  [/^(입출구분|입출금구분|입지구분|구분|상태)$/, '입출구분'],
  [/^(잔액|거래후잔액|남은금액|표면잔액|잔고)$/, '잔액'],
  [/^(상대계좌번호|이체상대계좌번호|연동입금계좌번호|연동계좌번호|상대계좌)$/, '상대계좌'],
  [/^(상대은행|연동은행|은행명|상대은행명)$/, '상대은행'],
  [/상대.*예금주|보낸분|받는분|의뢰인|수취인|^상대방$/, '상대'],
  [/^(거래종류|거래구분|거래내용|현금대체구분)$/, '거래구분'],
  [/^(적요|내용|기록사항|거래기록사항|통장적요|적요\(의뢰인등\))$/, '내용'],
  [/메모|^비고$/, '메모'],
  [/^(거래점|취급점|거래점명|처리점|취급은행지점|점)$/, '거래점']
];
function finGuessMap_(hdrCells) {
  var map = {}, used = {};
  hdrCells.forEach(function (h) {
    var k = bankHdrKey_(h); if (!k) return;
    for (var i = 0; i < FIN_GUESS_RULES_.length; i++) {
      var t = FIN_GUESS_RULES_[i][1];
      if (!used[t] && FIN_GUESS_RULES_[i][0].test(k)) { map[String(h).trim()] = t; used[t] = 1; return; }
    }
  });
  return map;
}

// ---------- 머리 위 줄에서 계좌·예금주·기관 ----------
var FIN_ACCT_RE_ = /(\d{2,6}-\d{2,8}-\d{2,8}(?:-\d{1,4})?|\d{11,16})/;
function finMeta_(text, fileName) {
  var t = String(text || ''), o = { 계좌: '', 예금주: '', 기관: '' }, m;
  m = /계\s*좌\s*(?:번\s*호)?\s*[:：]?\s*\[?\s*(\d[\d\-*]{7,24}\d)/.exec(t);
  if (!m) m = /^\s*(\d{2,6}-\d{2,8}-\d{2,8}(?:-\d{1,4})?)\s*$/m.exec(t);
  if (m) o.계좌 = m[1];
  if (!o.계좌) { var all = t.match(/\d{2,6}-\d{2,8}-\d{2,8}(?:-\d{1,4})?/g) || []; for (var i = 0; i < all.length; i++) if (finAcctDigits_(all[i]).length >= 10) { o.계좌 = all[i]; break; } }
  if (!o.계좌) { m = FIN_ACCT_RE_.exec(String(fileName || '').replace(/_\d{14}\)/, ')')); if (m && /-/.test(m[1]) && finAcctDigits_(m[1]).length >= 10) o.계좌 = m[1]; }
  m = /(?:고\s*객\s*명|예\s*금\s*주(?:\s*명)?|성\s*명)\s*[:：]?\s*\[?\s*([가-힣]{2,5})/.exec(t);
  if (!m) m = /계\s*좌\s*(?:번\s*호)?\s*[:：]?\s*\[\s*\d[\d\-*]{7,24}\d\s*\]\s*\[\s*([가-힣]{2,5})\s*\]/.exec(t);
  if (m) o.예금주 = m[1];
  m = FIN_BANK_RE_.exec(t) || FIN_BANK_RE_.exec(String(fileName || '')); if (m) o.기관 = finOrgNorm_(m[1]);
  return o;
}
function finOrgNorm_(s) {
  var t = String(s || '');
  if (/KB|국민/.test(t)) return '국민'; if (/농협|축협|NH/.test(t) && !/투자/.test(t)) return '농협'; if (/IBK|기업/.test(t)) return '기업';
  if (/카카오/.test(t)) return '카카오뱅크'; if (/토스/.test(t)) return '토스뱅크'; if (/SC/.test(t)) return 'SC제일';
  var m = FIN_BANK_RE_.exec(t); return m ? m[1] : t.slice(0, 12);
}
function finAcctDigits_(s) { return String(s || '').replace(/[^\d]/g, ''); }

// ---------- 표(엑셀) 한 시트 → 계좌 덩어리 ----------
//  돌려줌 { blocks:[...], skip:'사무소 파일…'|'' , newFormat:{…}|null, notBank:true|undefined }
function finParseSheet_(rows, ctx) {
  rows = (rows || []).map(function (r) { return (r || []).map(bankCell_); });
  var hi = bankFindHeader_(rows);
  if (hi < 0) return { notBank: true };
  var hdr = rows[hi], above = rows.slice(0, hi).map(function (r) { return r.filter(String).join(' '); }).join('\n');
  // 사무소가 합치거나 손본 파일 — 맨 앞 칸이 은행·기관이거나 머리 위에 합계(숫자만 있는 줄)가 있으면 읽지 않는다(세무사님 11-20 "내가 합쳐서 작업한 파일은 지금 검토대상이 아니잖아").
  //  서식표보다 먼저 본다 — 합본은 원본 칸을 그대로 이어 붙여 서식표 머리글과 거의 같아 보인다(11-20 시험: 김○ 사건 맨 위 합본이 농협 서식으로 알아봐져 네 계좌가 한 계좌로 섞임)
  var first = finKey_(hdr.filter(String)[0] || ''), sumRow = rows.slice(0, hi).some(function (r) { var c = r.filter(String); return c.length >= 1 && c.every(function (x) { return /^-?[\d,.]+$/.test(x); }); });
  if (/^(은행|기관|금융기관|은행명)$/.test(first) || sumRow) return { skip: '사무소가 합치거나 손본 파일로 보임(맨 앞 칸 「' + (hdr.filter(String)[0] || '') + '」' + (sumRow ? '·머리 위 합계 줄' : '') + ') — 원시파일만 합침' };
  var fm = finMatchFormat_(hdr, above), map, fmtName, guessed = false;
  if (fm) { map = {}; Object.keys(fm.짝).forEach(function (k) { map[finKey_(k)] = fm.짝[k]; }); fmtName = fm.id; }
  else {
    var g = finGuessMap_(hdr); map = {}; Object.keys(g).forEach(function (k) { map[finKey_(k)] = g[k]; });
    guessed = true; fmtName = '새 서식(짐작)';
  }
  // 핵심 칸 이름을 정리 규칙이 알아보는 이름으로, 나머지 칸은 아무 낱말에도 안 걸리는 이름으로 바꾼 머리글
  var colOf = {}, canon = hdr.map(function (h, i) {
    var t = map[finKey_(h)];
    if (t && !colOf[t]) colOf[t] = i;
    return t && FIN_PARSE_NAME_[t] ? FIN_PARSE_NAME_[t] : '§' + i;
  });
  var rows2 = rows.slice(); rows2[hi] = canon;
  var pr = bankParseRows_(rows2);
  var newFormat = guessed ? { key: finHash32_(hdr.map(finKey_).join('|')), 머리글: hdr.filter(String), 짝: (function () { var o = {}; hdr.forEach(function (h) { var t = map[finKey_(h)]; if (t && h) o[h] = t; }); return o; })(), 기관: '', 예파일: ctx.fileName } : null;
  var meta = finMeta_(above, ctx.fileName);
  // 머리 위에 은행 이름이 없으면 「취급은행」 칸의 첫 값(예: 048:신협)으로 — 상대은행 칸은 보지 않는다(남의 은행)
  if (!meta.기관 && !(fm && fm.기관)) {
    var bi = hdr.map(finKey_).findIndex(function (k) { return /^(취급은행|취급기관|은행구분)$/.test(k); });
    if (bi >= 0) for (var q = hi + 1; q < Math.min(rows.length, hi + 6); q++) { var bm = FIN_BANK_RE_.exec(String(rows[q][bi] || '')); if (bm) { meta.기관 = finOrgNorm_(bm[1]); break; } }
  }
  if (pr.거래내역아님) {
    // 서식은 맞는데 거래 줄이 하나도 없는 계좌(조회 기간에 거래 없음 — 11-20 시험: 농협 거래내역서 3개) — 계좌가 있다는 사실은 계좌 목록에 남긴다
    if (fm && (meta.계좌 || meta.예금주) && /거래 줄이 없음/.test((pr.경고 || []).join(' ')))
      return { blocks: [{ 기관: fm.기관 || meta.기관 || '', 계좌: meta.계좌 || '', 끝4: finAcctDigits_(meta.계좌).slice(-4), 예금주: meta.예금주 || '', 서식: fmtName, 읽은방법: '엑셀', 시트: ctx.sheet, 머리글: hdr, 머리줄: hi + 1, rows: [], 거래없음: true }] };
    return { notBank: true, why: (pr.경고 || []).join(' / '), newFormat: newFormat };
  }
  if (newFormat) newFormat.기관 = meta.기관 || '';
  var stdOf = function (raw) {
    var o = {}, rest = [];
    hdr.forEach(function (h, i) {
      var t = map[finKey_(h)], v = raw[i] == null ? '' : String(raw[i]).trim();
      if (t && FIN_STD_.indexOf(t) !== -1) { o[t] = o[t] ? o[t] + ' ' + v : v; return; }
      if (t && FIN_CORE_.indexOf(t) !== -1) return;
      if (h && v) rest.push(h + ': ' + v);
    });
    o.원본 = rest.join(' · ');
    return o;
  };
  var blocks = pr.계좌들.map(function (a) {
    return {
      기관: (fm && fm.기관) || meta.기관 || '', 계좌: meta.계좌 || '', 끝4: finAcctDigits_(meta.계좌 || a.계좌).slice(-4), 예금주: meta.예금주 || a.예금주 || '',
      서식: fmtName, 읽은방법: '엑셀', 시트: ctx.sheet, 머리글: hdr, 머리줄: hi + 1,
      rows: a.거래.map(function (t) {
        var raw = rows[t.줄 - 1] || [], s = stdOf(raw), dt = String(t.일시 || ''), dir = t.입금 ? 'i' : t.출금 ? 'o' : '?';
        var tm = dt.slice(11, 19);
        // 날짜 칸이 엑셀 날짜(시각 00:00:00)이고 시각이 따로 있는 서식(국민 창구 「처리시각」) — 따로 있는 시각을 쓴다
        if (colOf.거래시간 !== undefined && (!tm || tm === '00:00:00')) { var tq = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(raw[colOf.거래시간] || '')); if (tq) tm = ('0' + tq[1]).slice(-2) + ':' + tq[2] + ':' + (tq[3] || '00'); }
        // 시각 칸이 따로 없고 날짜만 있는 서식(신한 등) — 엑셀 날짜가 붙여 온 00:00:00은 시각이 아니다
        if (tm === '00:00:00' && colOf.거래시간 === undefined) tm = '';
        return { d: dt.slice(0, 10), t: tm, 입금: t.입금 || 0, 출금: t.출금 || 0, 금액: t.입금 || t.출금 || (t.금액미정 || 0), dir: dir, 잔액: t.잔액, std: s,
          검산: t.검산불일치 ? false : true, 왜: t.bad || (t.검산불일치 ? '앞 줄 잔액과 맞지 않음' : ''), 줄: t.줄, raw: raw };
      })
    };
  });
  return { blocks: blocks, newFormat: newFormat };
}

// ---------- 글자(PDF·사진) → 계좌 덩어리 ----------
function finParseText_(text, ctx) {
  var t = String(text || '');
  if (!t.trim()) return { fail: '글자를 읽지 못함(흐린 사진·그림만)' };
  // [2026.11.21] 사무소가 여러 계좌를 모아 만든 표를 찍은 것(맨 앞 칸이 「금융기관·계좌번호」 — 엑셀 합본과 같은 잣대, 세무사님 11-20 "내가 합쳐서 작업한 파일은 지금 검토대상이 아니잖아")
  if (/^\s*(?:금\s*융\s*기\S{0,2}|은\s*행\s*명?|기\s*관\s*명?)\s+계\s*좌\s*번\s*호[\s\S]{0,60}거\s*래\s*일/m.test(t.slice(0, 600))) return { skip: '사무소가 모아 만든 표로 보임(맨 앞 칸 「금융기관·계좌번호」) — 원시파일만 합침' };
  // [2026.11.20] docBankStmtParse_는 { type, label, result: { 은행·계좌번호·거래… }, md }로 돌려준다 — 거래는 result 안에 있다
  var r = null; try { r = docBankStmtParse_(t); } catch (e) { r = null; }
  if (r && r.result) r = r.result;
  // [2026.11.21] 은행이 만든 PDF는 글자 줄이 원본 차례 그대로 — 머리글 차례대로 줄을 읽는 규칙(FinText.js)이 더 많은 줄을 검산까지 맞게 읽으면 그것으로
  //  (11-21 운영: 국민 「본인금융거래」 종합통장 PDF — 잔액 사슬이 510줄만 원본 확인으로 짝지었던 것을 2,484줄·검산 맞음으로)
  var tr = null; try { tr = finTextRows_(t, ctx); } catch (e) { tr = null; }
  if (tr && tr.버림) tr = null;
  var rN = r && r.거래 ? r.거래.length : 0, rOkN = rN && r.검산 ? Number(r.검산.맞음) || 0 : 0, rChain = rN && /잔액 사슬/.test(String(r.서식 || ''));
  if (tr && (tr.거래.length || tr.거래없음)) {
    // 바꾸는 조건 — 옛 규칙이 못 읽었거나 사진용 잔액 사슬이었거나, 새 규칙이 줄·맞은 줄이 같거나 많고 틀림·입출 모름 줄이 같거나 적을 때만
    var tOkN = tr.검산 ? tr.검산.맞음 : 0, tBad = tr.나쁨 || 0;
    var rBad = rN ? r.거래.filter(function (g) { return g.잔액검산 === false || g.입금 == null; }).length : 0;
    var rAcc = rN ? Object.keys(r.거래.reduce(function (o, g) { o[g.계좌 || r.계좌번호 || ''] = 1; return o; }, {})).length : 0;
    if (!rN || rChain || (tr.거래.length >= rN && tOkN >= rOkN && tBad <= rBad && (tr.계좌수 || 1) >= rAcc)) r = tr;
  }
  // 칸이 따로 읽힌 스캔(날짜 덩어리·금액 덩어리) — 위 두 규칙이 못 읽었거나 사진용 잔액 사슬뿐일 때만
  if (!r || !r.거래 || !r.거래.length || /잔액 사슬/.test(String(r.서식 || ''))) { var cr = null; try { cr = finColRows_(t); } catch (e) { cr = null; } if (cr) r = cr; }
  if (r && r.거래없음 && !r.거래.length) {
    var per = /조회\s*기간\s*[:：]?\s*([\d.\/\-년월일\s]+?)\s*[~∼]\s*([\d.\/\-년월일]+)/.exec(t);
    return { blocks: (r.무거래계좌 || []).map(function (z) {
      return { 기관: finOrgNorm_(r.은행 || ''), 계좌: z.계좌, 끝4: finAcctDigits_(z.계좌).slice(-4), 예금주: r.예금주 || '', 서식: 'PDF·사진 거래 없음', 읽은방법: ctx.how, 시트: '', 머리글: [], 머리줄: 0, rows: [], 거래없음: true, 기간: per ? per[1].trim() + ' ~ ' + per[2].trim() : '' };
    }) };
  }
  if (!r || !r.거래 || !r.거래.length) {
    var pb = null; try { pb = docPassbookParse_(t); } catch (e) { pb = null; }
    if (pb) return { fail: '통장 사본 — 글자인식이 표를 섞어 거래 줄과 금액을 짝짓지 못함(원본 확인)' };
    return { notBank: true, why: '거래내역 모양을 찾지 못함' };
  }
  var accts = {}; (t.match(/계\s*좌\s*번\s*호\s*[:：]?\s*\[?\s*\d[\d-]{7,20}\d/g) || []).forEach(function (x) { accts[finAcctDigits_(x)] = 1; });
  var meta = finMeta_(t.slice(0, 3000), ctx.fileName);
  // [2026.11.20] 사진용 「잔액 사슬」로 짝지은 줄은 글자 순서로 금액·잔액을 맞춘 것이라 줄마다 맞음 표시가 원본과 같다는 보증이 아니다
  //  (11-20 운영 시험: 기업은행 PDF가 이 길로 날짜가 뒤섞인 채 줄마다 맞음으로 나옴) — 검산을 비워 두고 원본 확인으로 올린다
  var chain = /잔액 사슬/.test(String(r.서식 || ''));
  var mk = function (list) {
    return list.map(function (g, i) {
      var dir = g.입금 === true ? 'i' : g.입금 === false ? 'o' : '?';
      return { d: String(g.날짜 || ''), t: String(g.시각 || ''), 입금: dir === 'i' ? g.금액 : 0, 출금: dir === 'o' ? g.금액 : 0, 금액: g.금액, dir: dir, 잔액: g.잔액 == null ? null : g.잔액,
        std: { 내용: String(g.내용 || '').trim(), 거래구분: String(g.구분 || '').trim(), 메모: (String(g.적요 || '').trim() + (g.통화 ? ' 통화 ' + g.통화 : '')).trim(), 상대계좌: String(g.상대계좌 || ''), 상대은행: String(g.상대은행 || ''), 원본: String(g.원본 || '') },
        검산: chain ? null : g.잔액검산 === true ? true : g.잔액검산 === false ? false : null, 통화: g.통화 || '',
        왜: dir === '?' ? '입금·출금을 정하지 못함' : chain ? '사진 글자로 짝지음 — 원본 확인' : g.왜 ? g.왜 : g.잔액검산 === false ? '앞 줄 잔액과 맞지 않음' : '', 줄: g.줄 || i + 1, raw: [] };
    });
  };
  // 한 파일 여러 계좌(통장 정리가 줄마다 g.계좌를 붙인 경우) — 계좌마다 덩어리를 나눈다
  var groups = {}, order = [];
  r.거래.forEach(function (g, i) { g.줄 = i + 1; var k = g.계좌 || r.계좌번호 || meta.계좌 || ''; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(g); });
  var blocks = order.map(function (k) {
    return { 기관: finOrgNorm_(r.은행 || meta.기관 || ''), 계좌: k, 끝4: finAcctDigits_(k).slice(-4), 예금주: r.예금주 || meta.예금주 || '',
      서식: 'PDF·사진 ' + (r.서식 || '거래내역'), 읽은방법: ctx.how, 시트: '', 머리글: [], 머리줄: 0, rows: mk(groups[k]) };
  });
  // 금액 있는 거래가 없는 계좌(0원 이자결산만 — 통장 정리 r.무거래계좌) — 엑셀의 「조회 기간 거래 없음」 계좌처럼 목록에 남기고 잔액을 알린다
  // [2026.11.21] 계좌 목록 「참고」 칸에만 적는다(확인할 것이 아님 — 은행 자료 그대로)
  (r.무거래계좌 || []).forEach(function (z) {
    blocks.push({ 기관: finOrgNorm_(r.은행 || meta.기관 || ''), 계좌: z.계좌, 끝4: finAcctDigits_(z.계좌).slice(-4), 예금주: r.예금주 || meta.예금주 || '',
      서식: 'PDF·사진 ' + (r.서식 || '거래내역'), 읽은방법: ctx.how, 시트: '', 머리글: [], 머리줄: 0, rows: [], 거래없음: true,
      참고: z.잔액 == null ? '조회 기간 거래 없음' : '금액 있는 거래 없음(0원 줄만) · 끝 잔액 ' + Number(z.잔액).toLocaleString('ko-KR') + '원(' + z.날짜 + ')' });
  });
  blocks.forEach(function (b) {
    var cur = (b.rows || []).map(function (x) { return x.통화; }).filter(String)[0];
    if (cur) b.참고 = '외화 계좌 — 금액·잔액 단위 ' + cur;
    if (r.상품 && /신탁|펀드|연금저축|ELS|DLS|ISA|수익증권/.test(r.상품)) b.참고 = (b.참고 ? b.참고 + ' · ' : '') + r.상품 + ' — 잔액은 원금(평가액)';
  });
  var out = { blocks: blocks };
  if (!r.거래.some(function (g) { return g.계좌; }) && Object.keys(accts).length > blocks.length) out.note = (out.note ? out.note + ' / ' : '') + '한 파일에 계좌번호가 ' + Object.keys(accts).length + '개 보임 — ' + blocks.length + '개 계좌로만 나눴으니 원본 확인';
  if (chain) out.note = (out.note ? out.note + ' / ' : '') + '사진·화면 글자로 금액·잔액을 짝지음 — 줄마다 원본 확인';
  // 알림 글(한 파일 여러 계좌를 앞 계좌번호로 나눔 등)은 계좌 목록 「참고」로, 원본을 봐야 하는 것만 「확인할 것」으로
  (r.경고 || []).forEach(function (w) { if (/한 파일에 계좌 \d+개 — 줄마다/.test(w)) { blocks.forEach(function (b) { b.참고 = (b.참고 ? b.참고 + ' · ' : '') + '한 파일 여러 계좌 — 줄마다 그 앞 계좌번호로 나눔'; }); return; } out.note = (out.note ? out.note + ' / ' : '') + w; });
  return out;
}

// ---------- 파일 하나 읽기 ----------
function finTmpSheet_(name, u8) {
  var blob = Utilities.newBlob(finSigned_(u8), 'application/octet-stream', name);
  var f = Drive.Files.create(tcTmpMeta_({ name: '_fin_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' }), blob, { fields: 'id' });
  try { return finReadSs_(f.id); } finally { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} }
}
function finReadSs_(id) {
  var ss = SpreadsheetApp.openById(id), tz = ss.getSpreadsheetTimeZone(), sheets = [];
  ss.getSheets().forEach(function (sh) {
    var rng = sh.getDataRange(); if (rng.getNumRows() < 2) return;
    sheets.push({ sheet: sh.getName(), rows: rng.getValues().map(function (r) { return r.map(function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss') : v === null || v === undefined ? '' : String(v); }); }) });
  });
  return sheets;
}
function finTmpText_(name, u8, mime) {
  var blob = Utilities.newBlob(finSigned_(u8), mime, name);
  var f = Drive.Files.create(tcTmpMeta_({ name: '_fin_tmp_' + Date.now() + '_' + name.slice(-40), mimeType: mime }), blob, { fields: 'id,modifiedTime' });
  try { return tc_docText_({ id: f.id, name: name, mimeType: mime, modified: Date.parse(f.modifiedTime) || Date.now() }) || ''; }
  finally { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} }
}
// [2026.11.21] 압축 안 PDF·사진 글자 — 파일 내용(MD5)으로 영구 글자 기억(tcOcrStore)에 둔다. 같은 파일이 두 압축에 있거나 읽기 규칙 판이 바뀌어 다시 읽을 때
//  글자인식을 되풀이하지 않는다(11-21 운영: 이애정 사건 압축 둘에 같은 국민 PDF 12개 — 1.5MB PDF 하나에 1분 남짓)
function finInnerText_(name, u8, mime) {
  var key = '';
  try { key = 'ocrfin_' + Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, finSigned_(u8)).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('') + '_' + u8.length; } catch (e) { key = ''; }
  if (key) { var hit = tcOcrStoreGet_(key); if (hit !== null && hit !== '') return hit; }
  var t = finTmpText_(name, u8, mime);
  if (key && t && String(t).trim()) tcOcrStorePut_(key, t);
  return t;
}
var FIN_SHEET_EXT_RE_ =/\.(xlsx|xlsm|xls|htm|html)$/i, FIN_PDF_RE_ = /\.pdf$/i, FIN_IMG_RE_ = /\.(jpe?g|png|heic|heif|bmp|gif|tiff?|webp)$/i, FIN_ZIP_RE_ = /\.zip$/i;
// 보안메일 html인가 — 비밀번호(확인번호) 입력칸이 있고 표가 없음
function finSecureHtml_(u8) {
  var n = Math.min(u8.length, 400000), s = '';
  for (var i = 0; i < n; i++) s += String.fromCharCode(u8[i]);
  if (!/type\s*=\s*["']?password/i.test(s) || /<table[\s>]/i.test(s.replace(/<script[\s\S]*?<\/script>/gi, '')) && /<td[\s>]/i.test(s.replace(/<script[\s\S]*?<\/script>/gi, ''))) return null;
  var txt = ''; try { txt = bankDecodeBlob_(Utilities.newBlob(finSigned_(u8))); } catch (e) { txt = ''; }
  return { card: /카드/.test(txt) };
}
// 파일(드라이브 파일 또는 압축 안 파일) → 결과 { file, path, kind, status:'ok'|'skip'|'locked'|'fail'|'notbank', why, blocks, newFormats, notes }
function finReadOne_(src, pw, depth) {
  var name = src.name, res = { file: src.file || { id: src.id, name: name }, path: src.path || name, status: 'ok', why: '', blocks: [], newFormats: [], notes: [] };
  var take = function (r, sheet) {
    if (r.skip) { res.skipSheets = (res.skipSheets || 0) + 1; res.skipWhy = r.skip; return; }
    if (r.newFormat) res.newFormats.push(r.newFormat);
    if (r.notBank) return;
    if (r.fail) { res.notes.push(r.fail); return; }
    if (r.note) res.notes.push(r.note);
    (r.blocks || []).forEach(function (b) { if (sheet) b.시트 = sheet; res.blocks.push(b); });
  };
  try {
    if (/\.csv$/i.test(name)) { res.status = 'skip'; res.why = 'CSV — 세무사님이 엑셀을 바꿔 두신 것이라 읽지 않음'; return res; }
    var bytes = src.bytes ? finU8_(src.bytes) : finU8_(DriveApp.getFileById(src.id).getBlob().getBytes());
    if (FIN_ZIP_RE_.test(name) || (bytes[0] === 0x50 && bytes[1] === 0x4B && !FIN_SHEET_EXT_RE_.test(name))) {
      if (depth >= 2) { res.status = 'fail'; res.why = '압축 안의 압축이 너무 깊음'; return res; }
      var z = finUnzip_(bytes, pw);
      res.kind = '압축';
      res.inner = z.files.filter(function (x) { return !/(^|\/)(__MACOSX|\.DS_Store)/.test(x.name); }).map(function (x) {
        return finReadOne_({ name: x.name.split('/').pop(), bytes: x.bytes, file: res.file, path: res.path + ' › ' + x.name }, pw, depth + 1);
      });
      if (z.enc) res.notes.push('암호 걸린 파일 ' + z.enc + '개 — 사건 암호를 적어 주시면 엶');
      if (z.bad) res.notes.push('암호가 맞지 않는 파일 ' + z.bad + '개');
      if (z.aes) res.notes.push('AES 방식 암호 압축 ' + z.aes + '개 — 못 엶(풀어서 넣어 주세요)');
      if (z.enc || z.bad) res.status = 'locked';
      return res;
    }
    if (finCfbIs_(bytes) && finIsEncryptedOffice_(bytes)) {
      if (!pw) { res.status = 'locked'; res.why = '암호 걸린 엑셀 — 사건 암호를 적어 주시면 엶'; return res; }
      var plain;
      try { plain = finOfficeDecrypt_(bytes, pw); } catch (e) { res.status = 'locked'; res.why = String(e.message || e); return res; }
      res.kind = '엑셀(암호 풀어 읽음)';
      finTmpSheet_(name.replace(/\.\w+$/, '') + '.xlsx', plain).forEach(function (s) { take(finParseSheet_(s.rows, { fileName: name, sheet: s.sheet }), s.sheet); });
    } else if (/\.html?$/i.test(name) && finSecureHtml_(bytes)) {
      // [2026.11.21] 보안메일(확인번호를 넣어야 내용이 보이는 html — 카드사·은행 안내 메일). 내용이 암호로 감춰져 있어 읽을 수 없다(11-21 운영: 김희연 사건 신한카드 메일)
      var sh = finSecureHtml_(bytes);
      res.status = 'locked'; res.kind = '보안메일';
      res.why = '보안메일(확인번호를 넣어야 열리는 html' + (sh.card ? ' — 카드 이용대금 안내로 보임, 통장 거래내역 아님' : '') + ') — 브라우저에서 열어 확인번호(보통 생년월일)를 넣은 뒤 PDF로 저장해 넣어 주세요';
      return res;
    } else if (FIN_SHEET_EXT_RE_.test(name) || src.mimeType === MimeType.GOOGLE_SHEETS || (finCfbIs_(bytes))) {
      if (src.mimeType === MimeType.GOOGLE_SHEETS && name.indexOf(FIN_OUT_PREFIX_) === 0) { res.status = 'skip'; res.why = '이 도구가 만든 시트'; return res; }
      res.kind = '엑셀';
      var sheets;
      if (src.id && !src.bytes) sheets = bankReadFile_(src.id).sheets;
      else {
        var head = ''; for (var i = 0; i < Math.min(bytes.length, 4000); i++) head += String.fromCharCode(bytes[i]);
        if (/<table|<tr/i.test(head)) { var tx = bankDecodeBlob_(Utilities.newBlob(finSigned_(bytes))); sheets = [{ sheet: 'html', rows: bankHtmlRows_(tx) }]; }
        else sheets = finTmpSheet_(name, bytes);
      }
      sheets.forEach(function (s) { take(finParseSheet_(s.rows, { fileName: name, sheet: s.sheet }), s.sheet); });
    } else if (FIN_PDF_RE_.test(name) || FIN_IMG_RE_.test(name)) {
      var pdf = FIN_PDF_RE_.test(name);
      res.kind = pdf ? 'PDF' : '사진';
      var mime = pdf ? 'application/pdf' : (/png$/i.test(name) ? 'image/png' : 'image/jpeg');
      var text = src.id && !src.bytes ? tc_docText_({ id: src.id, name: name, mimeType: src.mimeType || mime, modified: src.modified }) : finInnerText_(name, bytes, mime);
      take(finParseText_(text, { fileName: name, how: pdf ? 'PDF' : '사진(글자인식)' }));
    } else { res.status = 'notbank'; res.why = '거래내역 파일 모양이 아님'; return res; }
    if (!res.blocks.length) {
      if (res.skipSheets) { res.status = 'skip'; res.why = res.skipWhy; }
      else if (res.status === 'ok') { res.status = res.notes.length ? 'fail' : 'notbank'; res.why = res.notes.join(' / ') || '거래 줄을 찾지 못함'; }
    }
  } catch (e) { res.status = 'fail'; res.why = String(e && e.message || e).slice(0, 200); }
  return res;
}
