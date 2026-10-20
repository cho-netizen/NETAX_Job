// [2026.10.20] 📋 확인조치사항 — 세무사님 "9번 시스템이 띄워줘야지 내가 일일이 어떻게 파일을 찾아서 확인수정을 하겠나? … 대시보드에 할일에 포함하든
// 새로운 항목을 만들든 어쨌든 띄워라". 원본은 드라이브 '0 NETAX/_확인조치사항.md' 하나뿐이다(Claude 세션들이 미결 과제를 "- [ ]" 줄로 적어 옴).
// 화면(dashboard.html 📋 카드)은 이 파일을 읽고 쓰기만 한다 — 구글 할일 등으로 복사하지 않는다(출처가 둘이 되면 어긋남).
//  - 파일은 ID로 찾는다(스크립트 속성 FOLLOWUP_MD_FILE_ID). 없거나 휴지통이면 '0 NETAX'에서 이름으로 찾아 ID를 다시 기억한다 —
//    폴더 정리로 이름 앞 "_"를 떼거나 다른 폴더로 옮겨도 ID가 그대로라 깨지지 않는다.
//  - 다른 세션이 PC(드라이브 동기화)에서 같은 파일에 줄을 덧붙일 수 있다. 그래서 저장은 매번 최신 내용을 다시 읽어,
//    화면이 본 그 줄(글자가 똑같은 줄)만 바꾸거나 한 줄을 끼워 넣고 저장한다 — 화면이 가진 옛 내용으로 통째로 덮어쓰지 않는다.
//    그 줄이 그 사이 바뀌었으면 저장하지 않고 "다시 불러오기"를 알린다.
//  - 구문: "## 제목"/"### 제목" = 절, 맨 앞 "- [ ] " / "- [x] " 줄 = 항목, 그 아래 빈 줄 전까지의 줄(들여쓴 "  - …" 등) = 그 항목의 자세한 내용.
var FOLLOWUP_FILE_ID_PROP_ = 'FOLLOWUP_MD_FILE_ID';
var FOLLOWUP_FILE_NAMES_ = ['_확인조치사항.md', '확인조치사항.md'];
var FOLLOWUP_ITEM_RE_ = /^- \[( |x|X)\] ?(.*)$/;
var FOLLOWUP_HEAD_RE_ = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
var FOLLOWUP_DONE_TAIL_RE_ = /\s*\(\d{4}-\d{2}-\d{2} 완료\)$/;

// ----- 글자만 다루는 부분(드라이브 없이 시험 가능 — tools 시험에서 그대로 불러 씀) -----
function followupParse_(text) {
  var lines = String(text || '').split(/\r?\n/);
  var sections = [], cur = null, items = [], title = '';
  function ensureSec(name) {
    cur = { title: name, items: [] };
    sections.push(cur);
  }
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    var h = FOLLOWUP_HEAD_RE_.exec(ln);
    if (h) {
      if (h[1].length === 1) { if (!title) title = h[2]; continue; } // 문서 제목(#)은 절이 아님
      ensureSec(h[2]);
      continue;
    }
    var m = FOLLOWUP_ITEM_RE_.exec(ln);
    if (!m) continue;
    if (!cur) ensureSec('(제목 없는 절)');
    var detail = [];
    for (var j = i + 1; j < lines.length; j++) {
      var nx = lines[j];
      if (!nx.trim() || FOLLOWUP_HEAD_RE_.test(nx) || FOLLOWUP_ITEM_RE_.test(nx)) break;
      detail.push(nx);
    }
    var it = { line: i, raw: ln, done: m[1] !== ' ', text: m[2], detail: detail.join('\n'), sec: cur.title };
    cur.items.push(it);
    items.push(it);
  }
  return { title: title, sections: sections.filter(function (s) { return s.items.length; }), headings: sections.map(function (s) { return s.title; }), items: items };
}

// 화면이 본 줄(raw)을 최신 내용에서 다시 찾는다 — 같은 글자 줄이 여럿이면 화면이 본 줄 번호(hint)에 가장 가까운 것.
function followupFindLine_(lines, raw, hint) {
  var want = String(raw || '').replace(/\s+$/, '');
  if (!want || !FOLLOWUP_ITEM_RE_.test(want)) return -1;
  var best = -1;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].replace(/\s+$/, '') !== want) continue;
    if (best < 0 || Math.abs(i - hint) < Math.abs(best - hint)) best = i;
  }
  return best;
}

function followupOneLine_(s) { return String(s || '').replace(/\r?\n+/g, ' ').replace(/\s+$/, '').replace(/^\s+/, '').slice(0, 2000); }

// op = { kind: 'toggle'|'edit'|'add', raw, line, done, text, section } → { text } 또는 { error }
function followupApply_(text, op, today) {
  var src = String(text || '');
  var eol = /\r\n/.test(src) ? '\r\n' : '\n';
  var lines = src.split(/\r?\n/);
  op = op || {};
  if (op.kind === 'toggle' || op.kind === 'edit') {
    var idx = followupFindLine_(lines, op.raw, Number(op.line) || 0);
    if (idx < 0) return { error: '그 항목이 그 사이 파일에서 바뀌었거나 지워졌습니다 — 목록을 다시 불러왔으니 확인 후 다시 해 주세요.', stale: true };
    var m = FOLLOWUP_ITEM_RE_.exec(lines[idx].replace(/\s+$/, ''));
    var body = m[2];
    var done = m[1] !== ' ';
    if (op.kind === 'toggle') {
      done = !!op.done;
      body = body.replace(FOLLOWUP_DONE_TAIL_RE_, '');
      if (done) body += ' (' + today + ' 완료)';
    } else {
      body = followupOneLine_(op.text);
      if (!body) return { error: '고칠 글을 입력해 주세요.' };
    }
    lines[idx] = '- [' + (done ? 'x' : ' ') + '] ' + body;
    return { text: lines.join(eol) };
  }
  if (op.kind === 'add') {
    var t = followupOneLine_(op.text);
    if (!t) return { error: '추가할 글을 입력해 주세요.' };
    var newLine = '- [ ] ' + t + ' (' + today + ' 추가)';
    var sec = String(op.section || '기타').trim() || '기타';
    var head = -1;
    for (var i = 0; i < lines.length; i++) {
      var h = FOLLOWUP_HEAD_RE_.exec(lines[i]);
      if (h && h[1].length > 1 && h[2] === sec) { head = i; break; }
    }
    if (head < 0) {
      // 그 절이 없으면 맨 끝에 새 절로 — 끝의 빈 줄은 정리하고 한 줄 띄운다
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      lines.push('', '## ' + sec, newLine, '');
      return { text: lines.join(eol) };
    }
    var end = lines.length;
    for (var k = head + 1; k < lines.length; k++) { if (FOLLOWUP_HEAD_RE_.test(lines[k])) { end = k; break; } }
    var at = head + 1;
    for (var q = end - 1; q > head; q--) { if (lines[q].trim()) { at = q + 1; break; } }
    lines.splice(at, 0, newLine);
    return { text: lines.join(eol) };
  }
  return { error: '알 수 없는 작업입니다.' };
}

// ----- 드라이브 -----
function followupFile_() {
  var props = PropertiesService.getScriptProperties();
  var id = sanitizeDriveId_(props.getProperty(FOLLOWUP_FILE_ID_PROP_));
  if (id) {
    try { var f = DriveApp.getFileById(id); if (!f.isTrashed()) return f; } catch (err) { }
  }
  var found = null;
  var root = getNetaxRootFolder_();
  if (root) {
    for (var i = 0; i < FOLLOWUP_FILE_NAMES_.length && !found; i++) {
      var it = root.getFilesByName(FOLLOWUP_FILE_NAMES_[i]);
      while (it.hasNext()) { var c = it.next(); if (!c.isTrashed()) { found = c; break; } }
    }
  }
  if (!found) return null;
  props.setProperty(FOLLOWUP_FILE_ID_PROP_, found.getId());
  return found;
}

function followupReadText_(file) {
  return file.getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
}

function followupResult_(file, text, extra) {
  var p = followupParse_(text);
  var out = {
    success: true,
    file: { id: file.getId(), name: file.getName(), url: 'https://drive.google.com/file/d/' + file.getId() + '/view', modified: Utilities.formatDate(file.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') },
    title: p.title,
    headings: p.headings,
    sections: p.sections.map(function (s) {
      return { title: s.title, items: s.items.map(function (x) { return { line: x.line, raw: x.raw, done: x.done, text: x.text, detail: x.detail }; }) };
    }),
    open: p.items.filter(function (x) { return !x.done; }).length,
    closed: p.items.filter(function (x) { return x.done; }).length
  };
  return extra ? Object.assign(out, extra) : out;
}

function followupNotFound_() {
  return { error: "'0 NETAX' 폴더에서 확인조치사항 파일(_확인조치사항.md)을 찾지 못했습니다. 파일을 지웠거나 다른 폴더로 옮겼다면 '0 NETAX'에 다시 두어 주세요(한 번 찾으면 그 뒤로는 옮기거나 이름을 바꿔도 따라갑니다)." };
}

function followupGet_() {
  var f = followupFile_();
  if (!f) return followupNotFound_();
  return followupResult_(f, followupReadText_(f));
}

function followupChange_(body, kind) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { error: '다른 저장이 진행 중입니다 — 잠시 후 다시 해 주세요.' };
  try {
    var f = followupFile_();
    if (!f) return followupNotFound_();
    var latest = followupReadText_(f); // 저장 직전 최신 내용 — 다른 세션이 덧붙인 줄을 살린다
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var r = followupApply_(latest, { kind: kind, raw: body.raw, line: body.line, done: body.done, text: body.text, section: body.section }, today);
    if (r.error) return followupResult_(f, latest, { success: false, error: r.error, stale: !!r.stale });
    f.setContent(r.text);
    return followupResult_(f, r.text);
  } finally {
    lock.releaseLock();
  }
}
