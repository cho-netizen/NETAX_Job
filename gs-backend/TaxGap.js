// [2026.11.12] 건전세정 — 세무행정 사각지대(과세가 이루어지지 않는 부분) 사례·자료 모음 (요청 R2611040743)
//  세무사님 원문(11-04): "건전세정 이라는 탭을 만들어 보자 / 현재 세무행정시스템의 사각지대에 놓여 있어서 세금부과가 이루어지지 않은 부분에 대하여 자료를 수집하는 것을 추진하자"
//  계획서(총괄관리자\건전세정_탭_계획서_20261112.md) "모두 권장대로": 사례 한 건 = 드라이브 md 한 장(총괄관리자/건전세정/), 화면 탭(목록·보기·고치기·새 사례),
//  사건 작업공간 머리줄 「건전세정 사례로」(사건 요약이 들어가되 고객 실명은 뺌), 넥스 도구 tax_gap_case(목록·읽기·적기). 바깥 자료 자동 수집은 넣지 않음(10-29 보류).
//  md 모양:
//    # <제목>
//    - 분야: <양도|상속|증여|법인|소득|부가|기타>
//    - 적은 날: yyyy-MM-dd HH:mm
//    - 적은 이: 세무사님|넥스|사건에서
//    - 관련 사건: <사건명(고객 실명 뺀 것)>
//    ## 거래 모양 / ## 왜 과세 안 되나 / ## 근거 조문 / ## 세무사님 의견
var TAX_GAP_FOLDER_ = '건전세정';
var TAX_GAP_FIELDS_ = ['양도', '상속', '증여', '법인', '소득', '부가', '기타'];
var TAX_GAP_SECTIONS_ = ['거래 모양', '왜 과세 안 되나', '근거 조문', '세무사님 의견'];

function taxGapFolder_() {
  var chief = getChiefManagerFolder_();
  if (!chief) return null;
  return getOrCreateSubfolder_(chief, TAX_GAP_FOLDER_);
}
function taxGapNow_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
function taxGapStamp_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmm'); }

// 글자만 다루는 부분(드라이브 없이 시험 가능) — md ↔ 칸
function taxGapParse_(text) {
  var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  var out = { 제목: '', 분야: '', 적은날: '', 적은이: '', 관련사건: '', 절: {} };
  var cur = null;
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    var h1 = /^#\s+(.*)$/.exec(ln);
    if (h1 && !out.제목) { out.제목 = h1[1].trim(); continue; }
    var h2 = /^##\s+(.*)$/.exec(ln);
    if (h2) { cur = h2[1].trim(); out.절[cur] = []; continue; }
    var meta = /^-\s*(분야|적은 날|적은 이|관련 사건)\s*:\s*(.*)$/.exec(ln);
    if (meta && !cur) { var k = meta[1].replace(/\s/g, ''); out[k === '적은날' ? '적은날' : k === '적은이' ? '적은이' : k === '관련사건' ? '관련사건' : k] = meta[2].trim(); continue; }
    if (cur) out.절[cur].push(ln);
  }
  Object.keys(out.절).forEach(function (k) { out.절[k] = out.절[k].join('\n').replace(/^\n+|\n+$/g, ''); });
  return out;
}
function taxGapBuild_(f) {
  f = f || {};
  var lines = ['# ' + String(f.제목 || '(제목 없음)').replace(/\s+/g, ' ').trim(),
    '- 분야: ' + (TAX_GAP_FIELDS_.indexOf(f.분야) >= 0 ? f.분야 : '기타'),
    '- 적은 날: ' + (f.적은날 || taxGapNow_()),
    '- 적은 이: ' + (f.적은이 || '세무사님'),
    '- 관련 사건: ' + (f.관련사건 || ''), ''];
  TAX_GAP_SECTIONS_.forEach(function (s) { lines.push('## ' + s); lines.push(String((f.절 && f.절[s]) || '').replace(/^\n+|\n+$/g, '')); lines.push(''); });
  return lines.join('\n');
}

// 목록 — 파일 머리만 읽어 제목·분야·날짜(최근 것이 위)
function taxGapList_() {
  var folder = taxGapFolder_();
  if (!folder) return { success: false, error: '총괄관리자 폴더가 설정되어 있지 않습니다' };
  var out = [], it = folder.getFilesByType(MimeType.PLAIN_TEXT);
  var all = folder.getFiles();
  while (all.hasNext()) {
    var f = all.next(), name = f.getName();
    if (!/\.md$/i.test(name)) continue;
    var head = taxGapParse_(String(f.getBlob().getDataAsString('UTF-8') || '').slice(0, 1200));
    out.push({ id: f.getId(), 파일: name, 제목: head.제목 || name.replace(/\.md$/i, ''), 분야: head.분야 || '', 적은날: head.적은날 || Utilities.formatDate(f.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 적은이: head.적은이 || '', 관련사건: head.관련사건 || '', 고친날: Utilities.formatDate(f.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') });
  }
  out.sort(function (a, b) { return a.적은날 < b.적은날 ? 1 : a.적은날 > b.적은날 ? -1 : 0; });
  return { success: true, items: out, 분야들: TAX_GAP_FIELDS_, 절들: TAX_GAP_SECTIONS_, 폴더: folder.getUrl() };
}
function taxGapRead_(body) {
  var id = String(body && body.id || '').trim();
  if (!id) return { success: false, error: '사례 번호(id)가 필요합니다' };
  var f;
  try { f = DriveApp.getFileById(sanitizeDriveId_(id)); } catch (e) { return { success: false, error: '사례 파일을 찾지 못했습니다' }; }
  var text = String(f.getBlob().getDataAsString('UTF-8') || '');
  var p = taxGapParse_(text);
  return { success: true, id: f.getId(), 파일: f.getName(), url: f.getUrl(), 제목: p.제목, 분야: p.분야, 적은날: p.적은날, 적은이: p.적은이, 관련사건: p.관련사건, 절: p.절, 원문: text };
}
// 새로 적기(id 없음) 또는 고치기(id 있음). 고칠 땐 적은 날·적은 이는 그대로, 글 끝에 「고침」 기록 없이 파일 수정일만 바뀐다.
function taxGapSave_(body, who) {
  body = body || {};
  var folder = taxGapFolder_();
  if (!folder) return { success: false, error: '총괄관리자 폴더가 설정되어 있지 않습니다' };
  var title = String(body.제목 || body.title || '').replace(/\s+/g, ' ').trim();
  if (!title) return { success: false, error: '제목을 적어 주세요' };
  var sec = {};
  TAX_GAP_SECTIONS_.forEach(function (s) { sec[s] = String((body.절 && body.절[s]) || body[s] || '').slice(0, 20000); });
  var id = String(body.id || '').trim(), f = null, old = null;
  if (id) { try { f = DriveApp.getFileById(sanitizeDriveId_(id)); old = taxGapParse_(String(f.getBlob().getDataAsString('UTF-8') || '')); } catch (e) { return { success: false, error: '고칠 사례 파일을 찾지 못했습니다' }; } }
  var md = taxGapBuild_({ 제목: title, 분야: body.분야 || body.field || (old && old.분야) || '기타', 적은날: old ? old.적은날 : '', 적은이: old ? old.적은이 : (who || '세무사님'), 관련사건: String(body.관련사건 || body.caseName || (old && old.관련사건) || '').slice(0, 200), 절: sec });
  if (f) { f.setContent(md); }
  else { f = folder.createFile('건전세정_' + taxGapStamp_() + '.md', md, MimeType.PLAIN_TEXT); }
  return { success: true, id: f.getId(), 파일: f.getName(), url: f.getUrl(), 제목: title };
}
// 사건에서 보내기 — 사건 요약(세목·업무·개요·처리방향)으로 사례 초안을 만든다. 고객·납세자 실명은 ○○으로 바꾸고, 주민번호·전화 등은 가림(cxMask_).
function taxGapFromCase_(body) {
  var cid = String(body && body.caseId || '').trim();
  if (!cid) return { success: false, error: '사건 ID가 필요합니다' };
  var c = job_findCase_(cid);
  if (!c) return { success: false, error: '사건을 찾을 수 없습니다: ' + cid };
  var names = [c.고객명, c.납세자].map(function (s) { return String(s || '').trim(); }).filter(function (s) { return s.length >= 2; });
  var hide = function (s) { s = String(s || ''); names.forEach(function (n) { s = s.split(n).join('○○'); }); return typeof cxMask_ === 'function' ? cxMask_(s) : s; };
  var caseName = hide(String(c.사건명 || '').replace(/^[^_]*_/, '')); // "고객명(납세자)_세목_업무유형" → 세목_업무유형
  var ov = c.사건개요 && typeof c.사건개요 === 'object' ? c.사건개요 : {};
  var ovTxt = Object.keys(ov).filter(function (k) { return ov[k] && typeof ov[k] !== 'object'; }).map(function (k) { return k + ': ' + String(ov[k]).slice(0, 300); }).join('\n');
  var shape = ['세목: ' + (c.세목 || ''), '업무: ' + (c.업무유형 || ''), c.개요 ? '개요: ' + String(c.개요).slice(0, 1500) : '', ovTxt].filter(Boolean).join('\n');
  var note = String(body.note || '').trim();
  var r = taxGapSave_({ 제목: String(body.title || '').trim() || ('사건에서 — ' + (caseName || '사건')), 분야: TAX_GAP_FIELDS_.indexOf(c.세목) >= 0 ? c.세목 : '기타', 관련사건: caseName,
    절: { '거래 모양': hide(shape), '왜 과세 안 되나': note, '근거 조문': '', '세무사님 의견': c.처리방향 ? hide('처리방향: ' + String(c.처리방향).slice(0, 1000)) : '' } }, '사건에서');
  return r;
}
// 넥스 도구 tax_gap_case — do=list|read|add. 넥스가 적은 사례는 적은 이 「넥스」
function taxGapTool_(input) {
  input = input || {};
  var d = String(input.do || 'list');
  if (d === 'list') { var l = taxGapList_(); if (!l.success) return l; return { 전체: l.items.length, 사례: l.items.slice(0, 60).map(function (x) { return { id: x.id, 제목: x.제목, 분야: x.분야, 적은날: x.적은날, 적은이: x.적은이, 관련사건: x.관련사건 }; }), 안내: '한 건을 읽으려면 do=read id=…, 새로 적으려면 do=add title·field·sections{거래 모양, 왜 과세 안 되나, 근거 조문, 세무사님 의견}. 고객 실명·주민번호는 적지 않는다.' }; }
  if (d === 'read') return taxGapRead_({ id: input.id });
  if (d === 'add') return taxGapSave_({ id: input.id || '', 제목: input.title || input.제목, 분야: input.field || input.분야, 관련사건: input.caseName || input.관련사건 || '', 절: input.sections || input.절 || {} }, '넥스');
  return { success: false, error: '모르는 do: ' + d + ' (list|read|add)' };
}
