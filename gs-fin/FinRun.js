// ============================================================
// [2026.11.20] 금융거래 합치기 — 파일 목록·나눠 돌리기·합치기·구글 시트 쓰기(FinMerge.js가 읽은 덩어리를 모은다)
//  계획서: docs/_기록/금융거래_10년검토_계획서_20261120.html 4절(1단계만)
//  · 한 번 부를 때 정한 시간(기본 4분 30초 — 구글 한 번 실행 한도 6분)까지만 읽고 진행을 사건 폴더 「_금융거래_합치기_진행.json」에 적는다.
//    화면·넥스는 「다 됨」이 올 때까지 다시 부른다. 읽은 파일은 기억해 다시 돌릴 때 다시 읽지 않는다(파일이 바뀌거나 서식표·암호가 바뀌면 다시 읽음).
//  · 암호: 사건마다 이 서버의 스크립트 속성에만 둔다(FIN_PW_<사건ID>). 시트·진행 파일·기록엔 남기지 않는다.
// ============================================================
var FIN_SKIP_DIR_RE_ = /^(보고서|보고서_내부|보고서_외부|_.*|이전버전|도구|양도코리아)$/;
var FIN_SUGGEST_RE_ = /거래|통장|계좌|은행|농협|축협|국민|신한|우리|하나|기업|우체국|새마을|신협|수협|증권|예금|적금|입출|KB|NH|IBK|SC/i;
var FIN_NOT_TX_RE_ = /잔액\s*증명|잔고\s*증명|재산\s*조회|회보서|조회서|상속인\s*(금융|내역)|보험\s*증권|영수증|비밀번호|공제\s*신고서|실거래가|협회|분할\s*협의서|금융재산\s*목록|위임장|신분증/;

function finCase_(caseId) {
  var sheet = work_getSheet_(), col = work_colMap_(work_values_(sheet)[0]), found = work_findCaseRow_(sheet, col, String(caseId || '').trim());
  if (!found) throw new Error('사건을 찾지 못했습니다.');
  var c = work_readRow_(col, found.row);
  if (!String(c.폴더ID || '').trim()) throw new Error('이 사건에 연결된 폴더가 없습니다.');
  return c;
}
function finTaxpayer_(folderName, c) { var m = /\(([^)]+)\)/.exec(String(folderName || '')); return (m && m[1]) || String(c.고객명 || c.사건명 || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 20); }

// 사건 폴더의 파일 — 하위 폴더까지(보고서·「_」 시스템 폴더는 빼고). 기본 체크: 이름에 금융 낱말 + 엑셀·PDF·사진·압축, 맨 위 엑셀(합본)·CSV는 끔
function finFolderFiles_(folder) {
  var out = [], walk = function (fo, path, depth) {
    if (depth > 6 || out.length > 800) return;
    var it = fo.getFiles();
    while (it.hasNext()) {
      var f = it.next(), n = f.getName();
      if (/^~\$/.test(n) || n === FIN_STATE_FILE_) continue;
      out.push({ id: f.getId(), name: n, path: path ? path + '/' + n : n, dir: path, mimeType: f.getMimeType(), size: f.getSize(), modified: f.getLastUpdated().getTime() });
    }
    var di = fo.getFolders();
    while (di.hasNext()) { var d = di.next(), dn = d.getName(); if (FIN_SKIP_DIR_RE_.test(dn)) continue; walk(d, path ? path + '/' + dn : dn, depth + 1); }
  };
  walk(folder, '', 0);
  return out;
}
function finSuggest_(f) {
  var n = f.name, ext = FIN_SHEET_EXT_RE_.test(n) || FIN_PDF_RE_.test(n) || FIN_IMG_RE_.test(n) || FIN_ZIP_RE_.test(n);
  if (/\.csv$/i.test(n)) return { on: false, why: 'CSV — 세무사님 변환본(읽지 않음)' };
  if (f.mimeType === MimeType.GOOGLE_SHEETS && n.indexOf(FIN_OUT_PREFIX_) === 0) return { on: false, why: '이 도구가 만든 시트' };
  if (!ext) return { on: false, why: '' };
  if (!f.dir && FIN_SHEET_EXT_RE_.test(n)) return { on: false, why: '사건 맨 위 엑셀 — 세무사님 합본으로 보여 기본 끔(원시파일이면 켜 주세요)' };
  if (FIN_NOT_TX_RE_.test(n)) return { on: false, why: '거래내역이 아닌 서류로 보임' };
  if (FIN_SUGGEST_RE_.test(n) || FIN_SUGGEST_RE_.test(f.dir)) return { on: true, why: '' };
  return { on: false, why: '' };
}
function finPwKey_(caseId) { return 'FIN_PW_' + finHash32_(String(caseId)); }
function finPwGet_(caseId) { return PropertiesService.getScriptProperties().getProperty(finPwKey_(caseId)) || ''; }
function finPwSet_(body) {
  var id = String(body && body.caseId || '').trim(); if (!id) return { error: '사건이 필요합니다.' };
  var pw = String(body.pw || ''), P = PropertiesService.getScriptProperties();
  if (pw) P.setProperty(finPwKey_(id), pw.slice(0, 100)); else P.deleteProperty(finPwKey_(id));
  return { ok: true, 암호있음: !!pw };
}
// 💰 창(결과 보기)·넥스 도구 — 자동으로 합친 결과와 파일마다 어떻게 다뤘는지(읽음·읽어 보고 거래내역이면 넣음·안 읽음 까닭). 합치라는 명령은 없다
function finMergeList_(body) {
  var c = finCase_(body.caseId), folder = DriveApp.getFolderById(c.폴더ID), files = finFolderFiles_(folder), st = finStateLoad_(folder);
  var pw = finPwGet_(body.caseId), sig = finSig_(pw), picks = {}; finAutoPick_(files).forEach(function (p) { picks[p.f.id] = p; });
  var fp = finHash32_(Object.keys(picks).map(function (id) { var p = picks[id]; return p.f.id + '_' + p.f.modified + (p.quiet ? 'q' : ''); }).sort().join('|') + '|' + sig + '|' + FIN_MERGE_VER_);
  var last = st.s.last || null;
  return { ok: true, 사건: { id: c.id || body.caseId, 폴더: folder.getName() }, 암호있음: !!pw,
    지난결과: last ? Object.assign({}, last, { at: last.at ? Utilities.formatDate(new Date(last.at), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '' }) : null,
    최신: st.s.autoFp === fp, // 폴더·서식표·암호가 지난 결과 뒤로 그대로인가(아니면 틱이 곧 다시 합침)
    파일: files.map(function (f) {
      var p = picks[f.id], s = finSuggest_(f), r = p ? st.s.parsed[f.id + '_' + f.modified + '_' + sig] : null;
      var 다룸 = !p ? (s.why || '읽지 않음(거래내역 파일 모양 아님)') : !r ? '읽을 차례' : r.status === 'ok' ? (p.quiet && !finQuietKeep_(r) ? '읽어 봄 — 거래내역 아님' : '합침') : (p.quiet ? '읽어 봄 — 거래내역 아님' : ({ skip: '건너뜀', locked: '암호', fail: '못 읽음', notbank: '거래내역 아님' }[r.status] || r.status) + (r.why ? ' — ' + r.why : ''));
      return { id: f.id, name: f.name, path: f.path, size: f.size, 다룸: 다룸 };
    }) };
}

// ---------- 진행 파일 ----------
function finStateLoad_(folder) {
  var it = folder.getFilesByName(FIN_STATE_FILE_);
  if (!it.hasNext()) return { file: null, s: { v: 1, parsed: {} } };
  var f = it.next(), s;
  try { s = JSON.parse(f.getBlob().getDataAsString('UTF-8')) || {}; } catch (e) { s = {}; }
  if (!s.parsed) s.parsed = {};
  return { file: f, s: s };
}
function finStateSave_(folder, st) {
  var txt = JSON.stringify(st.s);
  if (st.file) st.file.setContent(txt); else st.file = folder.createFile(FIN_STATE_FILE_, txt, 'application/json');
}

// ---------- 자동 합치기 — 세무사님 11-20 "1단계 금융거래내역을 분석할 수 있는 준비상태로 만드는 것은 그냥 자동으로 gas가 하는 것이지 따로 명령하는 것이 아니다" ----------
//  job 서버 1분 미리 읽기 틱이 진행 중 상속 사건(폴더 변동을 알아챈 사건 + 30분마다 전부)을 하나씩 여기로 보낸다(FinProxy.js finAutoRun_).
//  고를 파일: 이름으로 끈 것(CSV·이 도구 시트·사건 맨 위 엑셀·거래내역 아닌 이름)만 빼고 엑셀·PDF·사진·압축 모두.
//  이름에 금융 낱말이 없는 파일(신수호 사건 「신재억님.xls」처럼)은 읽어 보고 잔액이 이어지는 거래(3줄 이상·8할 검산 맞음, 사진용 잔액 사슬 아님)일 때만 넣고,
//  아니면 조용히 뺀다(사망진단서·영수증 PDF를 「거래내역 아님」으로 늘어놓지 않음). 고를 파일·수정 시각·서식표·암호가 그대로면 다시 읽지 않는다(지문).
function finSig_(pw) { return finHash32_(JSON.stringify(finFormats_().map(function (x) { return [x.id, x.머리글, x.짝]; })) + '|' + (pw ? finHash32_(pw) : '')); }
function finAutoPick_(files) {
  var out = [];
  files.forEach(function (f) {
    var s = finSuggest_(f);
    if (s.on) out.push({ f: f, quiet: false });
    else if (!s.why && (FIN_SHEET_EXT_RE_.test(f.name) || FIN_PDF_RE_.test(f.name) || FIN_IMG_RE_.test(f.name) || FIN_ZIP_RE_.test(f.name))) out.push({ f: f, quiet: true });
  });
  // 읽는 차례: 이름에 은행 낱말이 있는 것 → 엑셀·압축 → 작은 PDF·사진(글자인식이 빠른 것)부터 — 거래내역이 먼저 합쳐지게(11-20 운영: 박연경 사건 41개를 폴더 차례로 읽느라 은행 엑셀이 10번째)
  var rank = function (p) { return p.quiet ? (FIN_SHEET_EXT_RE_.test(p.f.name) || FIN_ZIP_RE_.test(p.f.name) ? 1 : 2) : 0; };
  out.sort(function (a, b) { return rank(a) - rank(b) || (rank(a) === 2 ? (a.f.size || 0) - (b.f.size || 0) : 0); });
  return out;
}
function finQuietKeep_(r) {
  if (!r) return null;
  if (r.inner) { var inn = r.inner.map(finQuietKeep_).filter(Boolean); return inn.length ? Object.assign({}, r, { inner: inn, notes: [] }) : null; }
  if (r.status !== 'ok') return null;
  var strong = function (b) { return !/잔액 사슬/.test(String(b.서식 || '')) && b.rows.length >= 3 && b.rows.filter(function (x) { return x.검산 === true; }).length >= b.rows.length * 0.8; };
  if (!(r.blocks || []).some(strong)) return null;
  return Object.assign({}, r, { blocks: r.blocks.filter(function (b) { return strong(b) || !b.rows.length; }) });
}
function finHasBank_(r) { return !!r && ((r.blocks || []).length > 0 || (r.inner || []).some(finHasBank_) || r.status === 'locked' || r.status === 'fail'); }
function finMergeAuto_(body) {
  // 같은 사건을 두 번이 겹쳐 읽지 않게(부르는 쪽이 60초에 끊겨도 이쪽은 끝까지 돈다 — 그사이 다음 틱이 다시 부를 수 있음)
  var C = CacheService.getScriptCache(), lk = 'fin_auto_' + finHash32_(String(body.caseId || ''));
  if (C.get(lk)) return { ok: true, done: false, more: true, busy: true };
  C.put(lk, '1', 420);
  try { return finMergeAutoRun_(body); } finally { C.remove(lk); }
}
function finMergeAutoRun_(body) {
  var t0 = Date.now(), budget = Math.max(15000, Math.min(Number(body.budgetMs) || 25000, 280000));
  var c = finCase_(body.caseId), folder = DriveApp.getFolderById(c.폴더ID), pw = finPwGet_(body.caseId);
  var picks = finAutoPick_(finFolderFiles_(folder)), sig = finSig_(pw);
  var fp = finHash32_(picks.map(function (p) { return p.f.id + '_' + p.f.modified + (p.quiet ? 'q' : ''); }).sort().join('|') + '|' + sig + '|' + FIN_MERGE_VER_);
  var st = finStateLoad_(folder);
  if (st.s.autoFp === fp && !body.force) return { ok: true, done: true, nochange: true };
  var keyOf = function (f) { return f.id + '_' + f.modified + '_' + sig; };
  var keep = {}; picks.forEach(function (p) { keep[keyOf(p.f)] = 1; });
  Object.keys(st.s.parsed).forEach(function (k) { if (!keep[k]) delete st.s.parsed[k]; });
  // 앞 번에 읽다가 끊긴 파일(구글 한 번 실행 6분 한도 — 큰 스캔 PDF·사진 많은 압축) — 같은 파일에서 매번 걸리지 않게 「못 읽음」으로 적고 넘어간다
  if (st.s.trying && !st.s.parsed[st.s.trying.k] && keep[st.s.trying.k] && Date.now() - Number(st.s.trying.at || 0) > 6.5 * 60000) {
    st.s.parsed[st.s.trying.k] = { file: { id: st.s.trying.id, name: st.s.trying.name }, path: st.s.trying.path, status: 'fail', why: '읽는 데 너무 오래 걸려 건너뜀(구글 한 번 실행 6분 넘음) — 파일을 나눠 넣어 주세요', blocks: [], newFormats: [], notes: [] };
  }
  // 권한이 없어 못 읽은 파일(구글 문서 권한 — 세무사님이 편집기에서 승인하시면 풀림)은 한 시간마다 다시 읽어 본다
  var permFail = function (r) { return !!r && ((/permission|권한/i.test(String(r.why || '')) && r.status === 'fail') || (r.inner || []).some(permFail)); };
  Object.keys(st.s.parsed).forEach(function (k) { var r = st.s.parsed[k]; if (permFail(r) && Date.now() - Number(r.at || 0) > 3600000) delete st.s.parsed[k]; });
  var done = 0, readNow = 0;
  for (var i = 0; i < picks.length; i++) {
    var f = picks[i].f, k = keyOf(f);
    if (st.s.parsed[k]) { done++; continue; }
    if (Date.now() - t0 > budget) break;
    st.s.trying = { k: k, id: f.id, name: f.name, path: f.path, at: Date.now() }; finStateSave_(folder, st);
    st.s.parsed[k] = finReadOne_({ id: f.id, name: f.name, mimeType: f.mimeType, modified: f.modified, path: f.path }, pw, 0); done++; readNow++;
    if (permFail(st.s.parsed[k])) st.s.parsed[k].at = Date.now();
    delete st.s.trying;
    finStateSave_(folder, st);
  }
  if (done < picks.length) return { ok: true, done: false, more: true, 읽음: done, 전체: picks.length };
  var results = picks.map(function (p) { var r = st.s.parsed[keyOf(p.f)]; return p.quiet ? finQuietKeep_(r) : r; }).filter(Boolean);
  if (!results.some(finHasBank_)) { st.s.autoFp = fp; finStateSave_(folder, st); return { ok: true, done: true, empty: true, 전체: picks.length }; }
  // 이번에 새로 읽은 파일이 있고 시간이 많이 갔으면 시트 쓰기는 다음 번에(부르는 쪽 1분 한도). 새로 읽은 것이 없으면 미루지 않는다 —
  //  진행 기록이 커서 불러오기만 35초를 넘는 사건(11-20 운영: 이애정 압축 3개)이 「시트 쓰기는 다음 번에」를 끝없이 되풀이했다. 부르는 쪽이 60초에 끊겨도 이쪽은 끝까지 쓴다
  if (readNow && Date.now() - t0 > Math.max(35000, budget - 30000)) { finStateSave_(folder, st); return { ok: true, done: false, more: true, 읽음: done, 전체: picks.length, 남은일: '시트 쓰기' }; }
  var merged = finMergeAll_(results);
  var sheet = finWriteSheet_(folder, finTaxpayer_(folder.getName(), c), merged);
  st.s.last = finLastOf_(sheet, merged, '자동');
  st.s.autoFp = fp;
  finStateSave_(folder, st);
  return { ok: true, done: true, 시트: sheet, 계좌수: merged.accts.length, 거래줄: merged.rows.length, 확인수: merged.checks.length, 새서식: merged.newFormats.length };
}
// 지난 결과 — 💰 창(결과 보기)·넥스 도구가 진행 파일에서 그대로 읽는다
function finLastOf_(sheet, merged, by) {
  return { at: new Date().toISOString(), by: by, url: sheet.url, name: sheet.name, rows: merged.rows.length, accounts: merged.accts.length, 겹친줄: merged.dups.length,
    계좌: merged.accts.map(finAcctSummary_), 확인: merged.checks.slice(0, 200), 확인수: merged.checks.length, 새서식: merged.newFormats };
}

// ---------- 합치기 ----------
var FIN_REL_ = { '엑셀': 3, 'PDF': 2, '사진(글자인식)': 1 };
// 합치기 규칙 판 — 바꾸면 진행 중 사건이 파일을 다시 읽지 않고 저절로 다시 합쳐진다(자동 지문에 들어감)
var FIN_MERGE_VER_ = '2026-11-20b';
// [2026.11.20] 예금·적금 계좌는 이자를 잔액에 넣지 않고 바로 내준다(신협 「141:이자지급」·「150:제세금」 출금, 잔액 그대로) — 은행 자료가 원래
//  「앞 잔액 − 출금 = 잔액」으로 맞지 않는 줄이라 잔액 검산 ⚠(틀림)로 세지 않는다(11-20 운영: 이애정 사건 신협 정기예금 24계좌가 ⚠로 「확인할 것」 50개)
function finPassThrough_(b) {
  (b.rows || []).forEach(function (r, i) {
    if (r.검산 !== false || r.dir !== 'o' || !/이자|세금|제세|원천/.test((r.raw || []).join(' ') + ' ' + JSON.stringify(r.std || {}))) return;
    var p = b.rows[i - 1], n = b.rows[i + 1];
    if ((p && p.잔액 === r.잔액) || (n && n.잔액 === r.잔액)) { r.검산 = null; r.왜 = '이자·세금을 잔액에 넣지 않고 바로 내줌(예금·적금) — 잔액 그대로'; }
  });
}
function finMergeAll_(results) {
  var blocks = [], files = [], checks = [], newFormats = {}, order = 0;
  var flat = function (r) {
    if (!r) return;
    if (r.inner) { if (r.notes && r.notes.length) checks.push({ 종류: r.status === 'locked' ? '암호' : '확인', 파일: r.path, 내용: r.notes.join(' / '), url: finFileUrl_(r.file) }); r.inner.forEach(flat); return; }
    var n = 0;
    (r.blocks || []).forEach(function (b) { finPassThrough_(b); b.src = { id: r.file && r.file.id, name: r.path, url: finFileUrl_(r.file), o: order++ }; n += b.rows.length; blocks.push(b); });
    files.push({ path: r.path, kind: r.kind, status: r.status, why: r.why, rows: n });
    if (r.status === 'locked') checks.push({ 종류: '암호', 파일: r.path, 내용: r.why, url: finFileUrl_(r.file) });
    else if (r.status === 'fail') checks.push({ 종류: '못 읽음', 파일: r.path, 내용: r.why, url: finFileUrl_(r.file) });
    else if (r.status === 'skip') checks.push({ 종류: '건너뜀', 파일: r.path, 내용: r.why, url: finFileUrl_(r.file) });
    else if (r.status === 'notbank') checks.push({ 종류: '거래내역 아님', 파일: r.path, 내용: r.why, url: finFileUrl_(r.file) });
    (r.notes || []).forEach(function (w) { if (r.status === 'ok') checks.push({ 종류: '확인', 파일: r.path, 내용: w, url: finFileUrl_(r.file) }); });
    (r.newFormats || []).forEach(function (nf) { if (!newFormats[nf.key]) newFormats[nf.key] = nf; });
  };
  results.forEach(flat);
  Object.keys(newFormats).forEach(function (k) { checks.push({ 종류: '새 서식', 파일: newFormats[k].예파일, 내용: '처음 보는 서식 — 칸 짝을 짐작해 합쳤습니다. 서식표에 등록해 주세요: ' + newFormats[k].머리글.join(' / ') }); });
  // 믿을 만한 출처(엑셀 > PDF > 사진)·줄 많은 것부터 — 같은 거래가 여럿이면 앞의 것을 남긴다
  blocks.sort(function (a, b) { return (FIN_REL_[b.읽은방법] || 1) - (FIN_REL_[a.읽은방법] || 1) || (b.계좌 ? 1 : 0) - (a.계좌 ? 1 : 0) || b.rows.length - a.rows.length || a.src.o - b.src.o; });
  var accts = [], rows = [], dups = [];
  var kOf = function (g) { return g.d + '|' + g.금액 + '|' + g.dir; };
  blocks.forEach(function (b) {
    var dg = finAcctDigits_(b.계좌), a = null;
    var orgOk = function (z) { return !z.기관 || !b.기관 || z.기관 === b.기관; };
    if (dg.length >= 8) a = accts.filter(function (z) { return z.dg === dg && orgOk(z); })[0] || accts.filter(function (z) { return !z.dg.length && z.끝4 === dg.slice(-4) && orgOk(z); })[0] || null;
    else if (b.끝4) a = accts.filter(function (z) { return z.끝4 === b.끝4 && orgOk(z); })[0] || null;
    if (!a) { // 계좌번호가 없는 서류 — 거래가 6할 넘게 겹치는 계좌의 사본
      a = accts.filter(function (z) { if (!orgOk(z)) return false; var hit = b.rows.filter(function (g) { return z.kept[kOf(g)]; }).length; return hit >= Math.max(2, b.rows.length * 0.6); })[0] || null;
    }
    if (!a) { a = { 기관: b.기관, 계좌: b.계좌, dg: dg, 끝4: b.끝4 || dg.slice(-4), 예금주: b.예금주, kept: {}, rows: [], files: [], 서식: [], 원본: [] }; accts.push(a); }
    if (!a.dg && dg.length >= 8) { a.dg = dg; a.계좌 = b.계좌; }
    if (!a.기관 && b.기관) a.기관 = b.기관; if (!a.예금주 && b.예금주) a.예금주 = b.예금주;
    if (a.files.indexOf(b.src.name) === -1) a.files.push(b.src.name);
    if (a.서식.indexOf(b.서식) === -1) a.서식.push(b.서식);
    if (b.머리글.length) a.원본.push({ src: b.src, 시트: b.시트, 머리글: b.머리글, rows: b.rows.map(function (g) { return [g.줄].concat(g.raw); }) });
    var mine = {};
    b.rows.forEach(function (g) {
      var k = kOf(g), list = a.kept[k] || (a.kept[k] = []);
      mine[k] = (mine[k] || 0) + 1;
      if (mine[k] <= list.length) {
        var kept = list[mine[k] - 1];
        if (kept.also.indexOf(b.src.name) === -1 && kept.src.name !== b.src.name) kept.also.push(b.src.name);
        if (kept.g.잔액 != null && g.잔액 != null && Math.abs(kept.g.잔액 - g.잔액) > 0.5) kept.diff = (kept.diff ? kept.diff + ' / ' : '') + b.src.name + ' 잔액 ' + g.잔액;
        dups.push({ src: b.src, 줄: g.줄, 시트: b.시트, g: g, a: a, keptSrc: kept.src });
        return;
      }
      var row = { a: a, g: g, src: b.src, 시트: b.시트, 서식: b.서식, how: b.읽은방법, also: [], diff: '' };
      list.push(row); a.rows.push(row); rows.push(row);
    });
  });
  accts.forEach(function (a, i) { a.n = i; a.label = (a.기관 || '기관 모름') + ' ' + (a.계좌 || (a.끝4 ? '…' + a.끝4 : '계좌번호 모름')); });
  var byTime = function (p, q) { return p.g.d < q.g.d ? -1 : p.g.d > q.g.d ? 1 : (p.g.t || '') < (q.g.t || '') ? -1 : (p.g.t || '') > (q.g.t || '') ? 1 : 0; };
  accts.forEach(function (a) { a.rows.sort(function (p, q) { return byTime(p, q) || p.src.o - q.src.o || (p.g.줄 || 0) - (q.g.줄 || 0); }); });
  rows.sort(function (p, q) { return byTime(p, q) || p.a.n - q.a.n || p.src.o - q.src.o || (p.g.줄 || 0) - (q.g.줄 || 0); });
  accts.forEach(function (a) {
    var bad = a.rows.filter(function (r) { return r.g.검산 === false; }).length, unk = a.rows.filter(function (r) { return r.g.dir === '?'; }).length, diff = a.rows.filter(function (r) { return r.diff; }).length;
    if (bad) checks.push({ 종류: '잔액 검산 ⚠', 파일: a.label, 내용: bad + '줄 — 거래 탭 「검산」 칸 ⚠ 줄을 원본과 맞대 주세요' });
    if (unk) checks.push({ 종류: '입출 모름', 파일: a.label, 내용: unk + '줄 — 입금·출금을 정하지 못함(금액은 「입금」·「출금」 칸이 아니라 원본 칸에 남김)' });
    if (diff) checks.push({ 종류: '출처끼리 다름', 파일: a.label, 내용: diff + '줄 — 같은 거래인데 다른 파일의 잔액이 다름(거래 탭 「같은 거래 다른 파일」 칸)' });
    if (!a.dg && !a.끝4) checks.push({ 종류: '계좌번호 모름', 파일: a.label, 내용: '계좌번호를 찾지 못한 파일 — ' + a.files.join(', ') });
  });
  return { accts: accts, rows: rows, dups: dups, checks: checks, files: files, newFormats: Object.keys(newFormats).map(function (k) { return newFormats[k]; }) };
}
function finFileUrl_(file) { return file && file.id ? 'https://drive.google.com/file/d/' + file.id + '/view' : ''; }
function finAcctSummary_(a) {
  var r = a.rows, first = r[0], last = r[r.length - 1], sum = function (k) { return r.reduce(function (s, x) { return s + (Number(x.g[k]) || 0); }, 0); };
  return { 기관: a.기관 || '', 계좌: a.계좌 || (a.끝4 ? '…' + a.끝4 : ''), 예금주: a.예금주 || '', 기간: first ? first.g.d + ' ~ ' + last.g.d : '조회 기간 거래 없음', 줄: r.length,
    처음잔액: first && first.g.잔액 != null ? first.g.잔액 - (first.g.입금 || 0) + (first.g.출금 || 0) : null, 끝잔액: last && last.g.잔액 != null ? last.g.잔액 : null,
    입금합계: sum('입금'), 출금합계: sum('출금'), 검산틀림: r.filter(function (x) { return x.g.검산 === false; }).length, 파일: a.files, 서식: a.서식 };
}

// ---------- 구글 시트 쓰기 ----------
var FIN_LEDGER_HDR_ = ['거래일자', '거래시간', '기관', '계좌', '예금주', '입금', '출금', '잔액', '내용', '상대', '상대은행', '상대계좌', '거래구분', '거래점', '메모', '원본 칸', '읽은 방법', '검산', '원본 파일', '원본 줄', '같은 거래 다른 파일', '서식'];
function finLink_(url, label) { label = String(label || '').replace(/"/g, '\'').slice(0, 200); return url ? '=HYPERLINK("' + url + '","' + label + '")' : label; }
function finWriteSheet_(folder, taxpayer, m) {
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd'), name = FIN_OUT_PREFIX_ + taxpayer + '_' + today, ss = null;
  var it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf(FIN_OUT_PREFIX_ + taxpayer + '_') === 0) { ss = SpreadsheetApp.openById(f.getId()); if (f.getName() !== name) f.setName(name); break; } }
  if (!ss) { ss = SpreadsheetApp.create(name); DriveApp.getFileById(ss.getId()).moveTo(folder); }
  var keepSh = ss.getSheets()[0]; keepSh.setName('_' + Date.now());
  ss.getSheets().slice(1).forEach(function (sh) { ss.deleteSheet(sh); });
  var tab = function (title, hdr, data, opts) {
    var sh = ss.insertSheet(title.slice(0, 95));
    var vals = [hdr].concat(data.length ? data : [hdr.map(function () { return ''; })]);
    var w = hdr.length; vals = vals.map(function (r) { r = r.slice(0, w); while (r.length < w) r.push(''); return r; });
    (opts && opts.text || []).forEach(function (ci) { sh.getRange(1, ci + 1, vals.length, 1).setNumberFormat('@'); });
    for (var s = 0; s < vals.length; s += 4000) sh.getRange(s + 1, 1, Math.min(4000, vals.length - s), w).setValues(vals.slice(s, s + 4000));
    (opts && opts.money || []).forEach(function (ci) { sh.getRange(2, ci + 1, Math.max(1, vals.length - 1), 1).setNumberFormat('#,##0'); });
    sh.getRange(1, 1, 1, w).setFontWeight('bold').setBackground('#eef2f7');
    sh.setFrozenRows(1);
    return sh;
  };
  var A = m.accts.map(finAcctSummary_);
  tab('계좌 목록', ['기관', '계좌', '예금주', '자료 기간', '거래 줄', '처음 잔액', '끝 잔액', '입금 합계', '출금 합계', '잔액 검산 ⚠', '원본 파일', '서식'],
    A.map(function (a) { return [a.기관, a.계좌, a.예금주, a.기간, a.줄, a.처음잔액, a.끝잔액, a.입금합계, a.출금합계, a.검산틀림 || '', a.파일.join(' · '), a.서식.join(' · ')]; }), { text: [1], money: [5, 6, 7, 8] });
  tab('거래', FIN_LEDGER_HDR_, m.rows.map(function (r) {
    var g = r.g, s = g.std || {};
    return [g.d, g.t || '', r.a.기관 || '', r.a.계좌 || (r.a.끝4 ? '…' + r.a.끝4 : ''), r.a.예금주 || '', g.dir === 'i' ? g.금액 : '', g.dir === 'o' ? g.금액 : '', g.잔액 == null ? '' : g.잔액,
      s.내용 || '', s.상대 || '', s.상대은행 || '', s.상대계좌 || '', s.거래구분 || '', s.거래점 || '', s.메모 || '',
      (g.dir === '?' ? '방향 모름 금액: ' + g.금액 + (s.원본 ? ' · ' : '') : '') + (s.원본 || ''), r.how, g.검산 === true ? '✅' : g.검산 === false ? '⚠ ' + (g.왜 || '') : '—',
      finLink_(r.src.url, r.src.name), (r.시트 ? r.시트 + ' ' : '') + (g.줄 ? g.줄 + '줄' : ''), r.also.join(' · ') + (r.diff ? ' ⚠ ' + r.diff : ''), r.서식];
  }), { text: [0, 1, 3, 11], money: [5, 6, 7] });
  tab('겹쳐서 한 번만 센 줄', ['원본 파일', '원본 줄', '거래일자', '기관·계좌', '금액', '방향', '남긴 줄의 파일'], m.dups.map(function (d) {
    return [finLink_(d.src.url, d.src.name), (d.시트 ? d.시트 + ' ' : '') + (d.줄 ? d.줄 + '줄' : ''), d.g.d, d.a.label, d.g.금액, d.g.dir === 'i' ? '입금' : d.g.dir === 'o' ? '출금' : '모름', d.keptSrc.name];
  }), { text: [2], money: [4] });
  tab('확인할 것', ['종류', '파일·계좌', '내용'], m.checks.map(function (c) { return [c.종류, c.url ? finLink_(c.url, c.파일) : c.파일, c.내용]; }));
  var mapRows = [], seen = {};
  finFormats_().forEach(function (fm) {
    if (!m.accts.some(function (a) { return a.서식.indexOf(fm.id) !== -1; })) return;
    fm.머리글.forEach(function (h) { var k = fm.id + '|' + h; if (seen[k]) return; seen[k] = 1; mapRows.push([fm.id + ' (' + fm.출처 + ')', h, fm.짝[h] || '원본 칸']); });
  });
  m.newFormats.forEach(function (nf) { nf.머리글.forEach(function (h) { mapRows.push(['새 서식(짐작) — ' + nf.예파일, h, nf.짝[h] || '원본 칸']); }); });
  tab('칸 대응표', ['서식', '원본 칸', '장부 칸'], mapRows);
  var used = {};
  m.accts.forEach(function (a) {
    if (!a.원본.length) return;
    var t = ('원본_' + (a.기관 || '') + '_' + (a.끝4 || a.n)).replace(/[\[\]*?:\/\\]/g, ''), t0 = t, k = 2; while (used[t]) t = t0 + '_' + (k++); used[t] = 1;
    var w = Math.max.apply(null, a.원본.map(function (o) { return o.머리글.length; })) + 2, data = [];
    a.원본.forEach(function (o, i) {
      if (i) data.push([]);
      data.push([finLink_(o.src.url, o.src.name), o.시트 || ''].concat([]));
      data.push(['원본 줄'].concat(o.머리글));
      o.rows.forEach(function (r) { data.push(r); });
    });
    var hdr = ['원본 파일·줄'].concat(new Array(w - 1).join('.').split('.').map(function () { return ''; }));
    tab(t, hdr, data.map(function (r) { return r.map(function (v) { return v == null ? '' : v; }); }), { text: (function () { var o = []; for (var c = 0; c < w; c++) o.push(c); return o; })() });
  });
  ss.deleteSheet(keepSh);
  ss.setActiveSheet(ss.getSheetByName('계좌 목록'));
  return { name: name, url: ss.getUrl(), id: ss.getId() };
}
