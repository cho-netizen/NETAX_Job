// SysAudit.js — [2026.10.20] 시스템 자기점검 정상화. 세무사님 "이 점검에 고가ai가 필요한가?" → 조정 세션 제안 "ㅇㅋ":
//   ① 매일 밤 규칙 점검(AI 없이 0원) ② 지침이 바뀐 날만 무료 AI(제미니) 뜻 점검 ③ 세법 해석이 필요한 모순은 지금처럼 🧾 버튼으로만 고가 AI.
//   결과는 🧭 시스템 관리 "점검 결과"(manage/sysadmin.html), 안 돌았으면 "⚠ 점검 안 됨(이유)".
// 왜: 예전 야간 "시스템 자기점검"은 지침이 바뀌면 "바뀜"만 적고 실제 점검은 한 번도 안 돌았는데, 대시보드는 리포트 파일만 있으면 ✅였다.
// 그래서 여기서는 "실제로 몇 개를 봤고 무엇을 찾았는지"를 숫자로 남기고, 못 본 것(법령 정비본 없음·AI 한도 초과 등)은 못 봤다고 적는다.
//
// 대상: 마스터 프로필(MASTER_PROFILE_FILE_ID) · 총괄관리자 NX_장기개발계획.md·체크리스트.md · 업무관리자 맨 위 .md/.txt 전부
//       ("_"로 시작하는 파일 제외). 개선요구사항.md는 입력 파일이라 제외. 드라이브 지침 내용은 고치지 않는다(읽기만).
// 저장: 총괄관리자/_점검리포트/점검리포트_날짜.md(사람이 읽는 글), 점검결과_최신.json(화면·대시보드용), _점검상태.json(파일별 지문 — 바뀐 파일 판단)
// 규칙 점검 핵심(sysAuditRules_)은 드라이브를 모르는 순수 함수 — tools/sys-audit-check.js가 node에서 실제 지침 복사본으로 같은 함수를 돌린다.

var SYS_AUDIT_STATE_FILE_ = '_점검상태.json';
var SYS_AUDIT_RESULT_FILE_ = '점검결과_최신.json';
var SYS_AUDIT_AI_MAX_CHUNKS_ = 6;        // 하룻밤 무료 AI 요청 상한(나머지는 다음 밤으로 넘김 — 기준 지문을 안 바꿔 다시 대상이 됨)
var SYS_AUDIT_AI_CHUNK_CHARS_ = 90000;   // 요청 하나에 보내는 지침 글자 수 상한(기준 문서 포함)

// 지금 없는 주소·화면·옛 방식 — 코드로 대조할 수 없는 것만 여기 적는다(도구 이름은 아래 sysAuditRules_가 실제 도구 목록과 대조).
var SYS_AUDIT_RETIRED_ = [
  { re: /admin\.netax\.kr/g, why: '은퇴한 주소(admin.netax.kr) — 예약·사건은 job.netax.kr에서' },
  { re: /report-writer\s*편집창|리포트\s*라이터/g, why: '옛 work 편집창 이름 — 지금은 작성관리 화면' },
  { re: /(?:OO|○○|[가-힣A-Za-z0-9]+)사건\.txt/g, why: '옛 work 방식(OO사건.txt 정리) — 지금은 처리개요·세액계산기 칸' }
];
// 살아 있는 netax.kr 주소(코드 안에 실제로 쓰이는 것). 여기 없는 *.netax.kr은 "모르는 주소"로 표시한다.
var SYS_AUDIT_HISTORY_RE_ = /예전|옛\s|옛날|은퇴|폐기|퇴역|시절|대신|더 이상|쓰지 말|쓰지 않|금지|없어졌|바뀌었|현행화/;
var SYS_AUDIT_LIVE_HOSTS_ = ['job.netax.kr', 'work.netax.kr', 'my.netax.kr', 'rpt.netax.kr', 'desk.netax.kr', 'card.netax.kr', 'www.netax.kr', 'netax.kr'];
// 도구로 보이는 snake_case 이름의 앞말(백틱 밖에서도 도구 이름으로 본다)
var SYS_AUDIT_TOOL_VERBS_ = /^(calculate|lookup|list|read|save|get|search|check|apply|create|update|delete|load|present|browse|add|send|export|register|manage|verify|explain|allocate|report|propose|audit|remember|job|case|docs|doc|find|set|write|run|edit|open|upload|move)_/;
// 법령 이름 → 정비본 색인 키(공백 없는 이름). 시행령·시행규칙은 뒤에 붙인다.
var SYS_AUDIT_LAW_ALIAS_ = [
  ['상속세 및 증여세법', '상속세및증여세법'], ['상속세및증여세법', '상속세및증여세법'], ['상증세법', '상속세및증여세법'], ['상증법', '상속세및증여세법'],
  ['조세특례제한법', '조세특례제한법'], ['조특법', '조세특례제한법'], ['국세기본법', '국세기본법'], ['국기법', '국세기본법'],
  ['국세징수법', '국세징수법'], ['국징법', '국세징수법'], ['농어촌특별세법', '농어촌특별세법'], ['농특세법', '농어촌특별세법'], ['농특법', '농어촌특별세법'],
  ['지방세특례제한법', '지방세특례제한법'], ['지방세법', '지방세법'], ['소득세법', '소득세법'],
  // 정비본에 없는 법(확인 불가로 표시)
  ['종합부동산세법', '종합부동산세법'], ['부가가치세법', '부가가치세법'], ['법인세법', '법인세법'], ['민법', '민법'], ['부동산 거래신고 등에 관한 법률', '부동산거래신고등에관한법률']
];
var SYS_AUDIT_ABBR_ = { '소득령': '소득세법시행령', '소득칙': '소득세법시행규칙', '상증령': '상속세및증여세법시행령', '상증칙': '상속세및증여세법시행규칙', '조특령': '조세특례제한법시행령', '국기령': '국세기본법시행령' };
var SYS_AUDIT_CIRCLED_ = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

// ---------------------------------------------------------------------------------------------
// ① 규칙 점검 — 순수 함수. input:
//   files: [{ name, role:'master'|'plan'|'checklist'|'bm', text, modified:'yyyy-MM-dd HH:mm', hash, fileId? }]
//   toolNames: [AI가 실제로 부를 수 있는 도구 이름]
//   law: function(key) → null(정비본에 없는 법) | { 판, 시행일, 조: { '97의2': [항수, 삭제여부(0/1)] } }
//   resolvePath: function(segmentsText) → { ok:true } | { ok:false, missing:'없는 부분', at:'찾은 데까지' } | null(대상 아님)
//   bmNames: [업무관리자 지침 이름(확장자 없이)]  prevHashes: { name: hash }(없으면 첫 점검)
// 돌려줌: { files:[{ name, role, problems:[{line, kind, level, text, snippet}], confirm:{count, oldest}, changed }], dupes:[], totals }
// ---------------------------------------------------------------------------------------------
function sysAuditRules_(input) {
  var tools = {}; (input.toolNames || []).forEach(function (n) { tools[n] = 1; });
  var bmSet = {}; (input.bmNames || []).forEach(function (n) { bmSet[String(n).replace(/\.(md|txt)$/i, '')] = 1; });
  var prev = input.prevHashes || null;
  var lawCache = {};
  var getLaw = function (k) { if (!(k in lawCache)) { try { lawCache[k] = input.law ? input.law(k) : null; } catch (e) { lawCache[k] = { error: String(e && e.message || e) }; } } return lawCache[k]; };
  var out = { files: [], dupes: [], totals: { files: 0, problems: 0, warnings: 0, infos: 0, citations: 0, citationsChecked: 0, toolRefs: 0, pathRefs: 0, guideRefs: 0, confirm: 0 } };
  var sentenceMap = {};

  (input.files || []).forEach(function (f) {
    var text = String(f.text || '').replace(/^﻿/, '').replace(/\r\n/g, '\n');
    var lines = text.split('\n');
    var probs = [];
    var add = function (line, kind, level, msg, snippet) { probs.push({ line: line, kind: kind, level: level, text: msg, snippet: String(snippet || lines[line - 1] || '').trim().slice(0, 160) }); };
    var inCode = false;

    // 형식 — 업무관리자 지침은 첫 줄이 "# 이 파일이 다루는 것 한 줄"(list_business_managers가 첫 줄 80자만 AI에게 보여 줌)
    if (f.role === 'bm') {
      var fi = 0; while (fi < lines.length && !lines[fi].trim()) fi++;
      var first = fi < lines.length ? lines[fi].trim() : '';
      if (!first) add(1, '형식', '문제', '파일이 비어 있음 — AI가 이 지침을 고를 수 없음', '');
      else {
        if (!/^#\s/.test(first)) add(fi + 1, '형식', '주의', '첫 줄이 제목("# …")이 아님 — 첫 줄은 이 지침이 다루는 것 한 줄', first);
        var fl = first.replace(/^#+\s*/, '');
        if (fl.length > 80) add(fi + 1, '형식', '주의', '첫 줄이 ' + fl.length + '자 — AI 목록엔 80자까지만 보임', first);
        if (fl.length < 8) add(fi + 1, '형식', '주의', '첫 줄이 너무 짧아 무엇을 다루는지 알기 어려움', first);
      }
    }

    // [확인 필요] 개수·날짜(머리의 "작성 YYYY-MM-DD", 없으면 파일 수정일)
    var confirmCount = (text.match(/\[확인 필요/g) || []).length;
    var wroteAt = (text.match(/작성\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || String(f.modified || '').slice(0, 10);

    lines.forEach(function (raw, i) {
      var ln = i + 1;
      if (/^\s*```/.test(raw)) { inCode = !inCode; }
      var line = raw;

      // 지금 없는 주소·화면·옛 방식
      // 같은 줄에 "예전·은퇴·대신·쓰지 말 것" 같은 말이 있으면 옛것을 설명하는 줄로 보고 '참고'로만 남긴다
      var hist = SYS_AUDIT_HISTORY_RE_.test(line);
      SYS_AUDIT_RETIRED_.forEach(function (r) { r.re.lastIndex = 0; var m; while ((m = r.re.exec(line))) add(ln, '옛 주소·방식', hist ? '참고' : '문제', r.why + ' — "' + m[0] + '"' + (hist ? ' (옛것을 설명하는 줄로 보임)' : '')); });
      var hm, hostRe = /\b([a-z0-9-]+\.)*netax\.kr\b/gi;
      while ((hm = hostRe.exec(line))) {
        var host = hm[0].toLowerCase();
        if (host === 'admin.netax.kr') continue; // 위에서 이미
        if (SYS_AUDIT_LIVE_HOSTS_.indexOf(host) === -1) add(ln, '옛 주소·방식', hist ? '참고' : '주의', '모르는 주소 "' + host + '" — 지금 쓰는 주소인지 확인', '');
      }

      // 도구 이름 — 백틱 안의 snake_case, 또는 도구 앞말(calculate_ 등)로 시작하는 snake_case
      var seen = {};
      var tm, toolRe = /(`?)\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b(`?)/g;
      while ((tm = toolRe.exec(line))) {
        var nm = tm[2], ticked = tm[1] === '`' && tm[3] === '`';
        if (seen[nm]) continue; seen[nm] = 1;
        if (!ticked && !SYS_AUDIT_TOOL_VERBS_.test(nm)) continue;
        if (/\.(md|txt|json|js|html|gz|pdf)$/i.test(line.slice(tm.index + tm[0].length - (tm[3] ? 1 : 0), tm.index + tm[0].length + 6))) continue; // 파일 이름의 일부
        out.totals.toolRefs++;
        if (!tools[nm]) add(ln, '없는 도구', SYS_AUDIT_TOOL_VERBS_.test(nm) ? '문제' : '주의', '도구 목록에 없는 이름 "' + nm + '" — AI가 부를 수 없음(옛 도구거나 오타)', '');
      }

      // 다른 지침 가리킴 — "> 관련 지침: a · b", "`이름` 지침", "이름_이름 지침 참고"
      var refs = [];
      var rel = line.match(/^\s*>?\s*관련\s*지침\s*[:：]\s*(.+)$/);
      // 괄호 속 설명(예: "부동산세무(6절 요약)", "(조특법 §97의3·§97의4)")을 먼저 떼고 나눈다. 띄어쓰기가 있는 항목은 이름이 아니라 설명 글로 보고 건너뜀
      if (rel) rel[1].replace(/\([^)]*\)|（[^）]*）/g, '').split(/[·,、]|\s\/\s/).forEach(function (s) { s = s.replace(/[`*]/g, '').trim(); if (s && /^[가-힣A-Za-z0-9_]+$/.test(s) && /[가-힣]/.test(s) && !/^(없음|-)$/.test(s)) refs.push(s); });
      var gm, gRe = /`([^`\s]*[가-힣][^`\s]*)`\s*(?:지침|참고|참조)/g;
      while ((gm = gRe.exec(line))) refs.push(gm[1]);
      var g2, g2Re = /(?:^|[\s(「『"'])([가-힣A-Za-z0-9]+_[가-힣A-Za-z0-9_]+)\s*지침/g;
      while ((g2 = g2Re.exec(line))) refs.push(g2[1]);
      var rseen = {};
      refs.forEach(function (r) {
        r = r.replace(/\.(md|txt)$/i, '');
        if (rseen[r] || !/[가-힣]/.test(r) || /[○<>{}]|OO/.test(r)) return; rseen[r] = 1;
        out.totals.guideRefs++;
        if (!bmSet[r]) add(ln, '없는 지침', '문제', '가리키는 지침 "' + r + '"이 업무관리자 폴더에 없음 — AI가 불러올 수 없음', '');
      });

      // 드라이브 폴더·파일 경로 — "업무관리자\법령\…", "총괄관리자/_점검리포트" 처럼 0 NETAX 아래 경로
      if (input.resolvePath) {
        var pm, pRe = /(?:[A-Z]:[\\/])?(?:내 드라이브[\\/])?(?:0 NETAX[\\/])?((?:업무관리자|총괄관리자)(?:\s*[\\/›]\s*[^\s`'"|,;)\]]+(?:\s[^\s`'"|,;)\]\\/›]+)*)+)/g;
        while ((pm = pRe.exec(line))) {
          var res = null;
          // 정규식이 잡은 조각이 아니라 줄의 나머지를 넘긴다 — "법제처 원본(PDF)"처럼 이름에 괄호·띄어쓰기가 있어도 실제 이름과 가장 길게 맞춰 본다
          var startAt = pm.index + pm[0].length - pm[1].length;
          try { res = input.resolvePath(line.slice(startAt)); } catch (e) { res = { ok: false, missing: '(확인 중 오류: ' + (e && e.message || e) + ')', at: '' }; }
          if (!res) continue;
          out.totals.pathRefs++;
          if (!res.ok) add(ln, '없는 경로', '문제', '드라이브에 없음: ' + (res.at ? res.at + ' 안의 ' : '') + '"' + res.missing + '"', pm[0]);
        }
      }

      // 조문 인용 — "법률명 (시행령|시행규칙) §조번호(의N)(항)" + 이어지는 "·§N"
      if (!inCode) sysAuditCitations_(line).forEach(function (c) {
        out.totals.citations++;
        var law = getLaw(c.key);
        if (law === null || law === undefined) { add(ln, '조문', '참고', '"' + c.label + '" — 법령 정비본에 없는 법이라 확인 못 함', c.raw); return; }
        if (law.error) { add(ln, '조문', '참고', '"' + c.label + '" — 정비본을 읽지 못해 확인 못 함(' + law.error + ')', c.raw); return; }
        out.totals.citationsChecked++;
        var a = law.조[c.jo];
        if (!a) add(ln, '조문', '문제', '"' + c.label + '" — 현행판(' + law.시행일 + ' 시행)에 없는 조', c.raw);
        else if (a[1]) add(ln, '조문', '주의', '"' + c.label + '" — 현행판에서 삭제된 조(옛 시기 사건이면 시점을 밝혀 쓸 것)', c.raw);
        else if (c.hang && a[0] && c.hang > a[0]) add(ln, '조문', '문제', '"' + c.label + '" — 이 조는 ' + a[0] + '항까지만 있음', c.raw);
      });

      // 조문 표기 형식 — "제N조"보다 "법률명 §N"(작성관리 자동 링크·체크리스트 표기)
      if (!inCode && f.role === 'bm') {
        var km = line.match(/제\s*\d+\s*조(?:\s*의\s*\d+)?/);
        if (km && !/§/.test(line) && !/부칙|대통령령\s*제|법률\s*제|시행령\s*제|규칙\s*제/.test(line.slice(0, line.indexOf(km[0])))) add(ln, '형식', '주의', '조문 표기 "' + km[0] + '" — "법률명 §조번호" 형식으로', '');
      }

      // 같은 문장 중복(파일 사이) — 표·제목·목록 기호를 떼고 30자 이상 문장만
      if (!inCode && !/^\s*[|#>]/.test(raw)) {
        String(raw).replace(/^\s*(?:[-*>]|\d+[.)])\s*/, '').split(/(?<=[다요음함]\.)\s+|(?<=\.)\s+(?=[가-힣])/).forEach(function (s) {
          var k = s.replace(/[*`~]/g, '').replace(/\s+/g, ' ').trim();
          if (k.replace(/\s/g, '').length < 30) return;
          var e = sentenceMap[k] || (sentenceMap[k] = []);
          if (!e.some(function (x) { return x.file === f.name; })) e.push({ file: f.name, line: ln });
        });
      }
    });

    var changed = !prev ? null : (prev[f.name] === undefined ? '새 파일' : prev[f.name] !== f.hash ? '바뀜' : '');
    out.files.push({ name: f.name, role: f.role, fileId: f.fileId || '', modified: f.modified || '', chars: text.length, problems: probs, confirm: { count: confirmCount, since: confirmCount ? wroteAt : '' }, changed: changed });
    out.totals.confirm += confirmCount;
  });

  Object.keys(sentenceMap).forEach(function (k) {
    var e = sentenceMap[k];
    if (e.length < 2) return;
    out.dupes.push({ text: k.slice(0, 160), where: e });
  });
  out.dupes.sort(function (a, b) { return b.where.length - a.where.length || b.text.length - a.text.length; });
  // 중복은 파일마다 "주의" 한 줄씩 남긴다(누르면 그 줄로)
  var byName = {}; out.files.forEach(function (x) { byName[x.name] = x; });
  out.dupes.slice(0, 60).forEach(function (d) {
    d.where.forEach(function (w) {
      var others = d.where.filter(function (o) { return o.file !== w.file; }).map(function (o) { return o.file + ':' + o.line; });
      byName[w.file].problems.push({ line: w.line, kind: '중복', level: '주의', text: '같은 문장이 다른 파일에도 있음(' + others.join(', ') + ') — 한 곳에 두고 가리키기', snippet: d.text });
    });
  });

  if (prev) Object.keys(prev).forEach(function (n) { if (!byName[n]) out.files.push({ name: n, role: '', removed: true, problems: [], confirm: { count: 0, since: '' }, changed: '없어짐' }); });

  var oldest = '';
  out.files.forEach(function (x) {
    x.problems.sort(function (a, b) { return a.line - b.line; });
    x.counts = { 문제: 0, 주의: 0, 참고: 0 };
    x.problems.forEach(function (p) { x.counts[p.level] = (x.counts[p.level] || 0) + 1; });
    out.totals.problems += x.counts.문제; out.totals.warnings += x.counts.주의; out.totals.infos += x.counts.참고;
    if (x.confirm.count && x.confirm.since && (!oldest || x.confirm.since < oldest)) oldest = x.confirm.since;
  });
  out.totals.files = out.files.filter(function (x) { return !x.removed; }).length;
  out.totals.confirmOldest = oldest;
  out.changedFiles = out.files.filter(function (x) { return x.changed; }).map(function (x) { return { name: x.name, changed: x.changed }; });
  return out;
}

// 한 줄에서 조문 인용을 뽑는다 → [{ key(색인 키), jo('97의2'), hang(1~20|0), label, raw }]
function sysAuditCitations_(line) {
  var res = [];
  var names = SYS_AUDIT_LAW_ALIAS_.map(function (a) { return a[0]; }).concat(Object.keys(SYS_AUDIT_ABBR_))
    .sort(function (a, b) { return b.length - a.length; }).map(function (s) { return s.replace(/\s/g, '\\s*'); });
  // "§13의 10년"처럼 "의" 뒤 숫자가 기간·금액이면 가지번호가 아니다
  var ui = '(?:\\s*의\\s*(\\d+)(?!\\s*[0-9년개월일세억만원배%명호]|\\.\\d))?';
  var re = new RegExp('(' + names.join('|') + ')(\\s*시행령|\\s*시행규칙)?\\s*(?:§\\s*(\\d+)(?:\\s*조)?' + ui + '|제\\s*(\\d+)\\s*조' + ui + ')\\s*([' + SYS_AUDIT_CIRCLED_ + '])?', 'g');
  var m;
  while ((m = re.exec(line))) {
    var nm = m[1].replace(/\s/g, ''), base = SYS_AUDIT_ABBR_[nm] || null;
    if (!base) SYS_AUDIT_LAW_ALIAS_.some(function (a) { if (a[0].replace(/\s/g, '') === nm) { base = a[1]; return true; } return false; });
    var key = base + (m[2] ? m[2].replace(/\s/g, '') : '');
    var push = function (no, ui, hc, raw) {
      var jo = no + (ui ? '의' + ui : '');
      var hang = hc ? SYS_AUDIT_CIRCLED_.indexOf(hc) + 1 : 0;
      res.push({ key: key, jo: jo, hang: hang, label: m[1] + (m[2] || '') + ' §' + jo + (hc || ''), raw: raw });
    };
    push(m[3] || m[5], m[4] || m[6], m[7], m[0]);
    // 이어지는 "·§167③", ", §98", "/§44"(같은 법)
    var rest = line.slice(re.lastIndex), cm, cRe = new RegExp('^\\s*[·,/및와과]\\s*§\\s*(\\d+)' + ui + '\\s*([' + SYS_AUDIT_CIRCLED_ + '])?(?:\\s*[~∼]\\s*[' + SYS_AUDIT_CIRCLED_ + '])?');
    var used = 0;
    while ((cm = cRe.exec(rest))) { push(cm[1], cm[2], cm[3], cm[0].trim()); used += cm[0].length; rest = rest.slice(cm[0].length); }
    re.lastIndex += used;
  }
  return res;
}

// ---------------------------------------------------------------------------------------------
// GAS 쪽 — 자료 모으기
// ---------------------------------------------------------------------------------------------
function sysAuditHash_(s) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s || ''), Utilities.Charset.UTF_8)).slice(0, 16);
}

// 점검 대상 파일 — 읽지 못한 것은 warn에 남긴다(조용히 빼지 않음)
function sysAuditCollectFiles_() {
  var files = [], warn = [];
  var info = function (f, role) {
    var text = f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
    return { name: f.getName(), role: role, text: text, fileId: f.getId(), hash: sysAuditHash_(text), modified: Utilities.formatDate(f.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') };
  };
  try { files.push(Object.assign(info(DriveApp.getFileById(MASTER_PROFILE_FILE_ID), 'master'), { name: '마스터 프로필(' + DriveApp.getFileById(MASTER_PROFILE_FILE_ID).getName() + ')' })); }
  catch (e) { warn.push('마스터 프로필을 읽지 못함: ' + e.message); }
  var chief = getChiefManagerFolder_();
  if (!chief) warn.push('총괄관리자 폴더가 설정되지 않음(CHIEF_MANAGER_FOLDER_ID) — 장기계획·체크리스트를 못 봄');
  else [[SYSADMIN_PLAN_NAME_, 'plan'], [SYSADMIN_CHECKLIST_NAME_, 'checklist']].forEach(function (d) {
    var it = chief.getFilesByName(d[0]), f = null;
    while (it.hasNext()) { var c = it.next(); if (!c.isTrashed()) { f = c; break; } }
    if (f) { try { files.push(info(f, d[1])); } catch (e) { warn.push(d[0] + '을 읽지 못함: ' + e.message); } }
    else warn.push('총괄관리자 폴더에 ' + d[0] + '이 없음');
  });
  var bm = getBusinessManagerFolder_(), bmNames = [];
  if (!bm) warn.push('업무관리자 폴더가 설정되지 않음(BUSINESS_MANAGER_FOLDER_ID) — 업무관리자 지침을 못 봄');
  else {
    var bi = bm.getFiles(), list = [];
    while (bi.hasNext()) {
      var bf = bi.next(), n = bf.getName();
      if (!/\.(md|txt)$/i.test(n) || bf.isTrashed()) continue;
      bmNames.push(n.replace(/\.(md|txt)$/i, '')); // "_" 파일도 "있는 지침"으로는 센다(가리켜도 없다고 하지 않게) — 점검 대상에서만 뺀다
      if (n.charAt(0) === '_') continue;
      list.push(bf);
    }
    list.sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; }).forEach(function (f) { try { files.push(info(f, 'bm')); } catch (e) { warn.push(f.getName() + '을 읽지 못함: ' + e.message); } });
  }
  return { files: files, bmNames: bmNames, warn: warn };
}

// AI가 실제로 부를 수 있는 도구 이름(코드에서 그대로) — DRIVE_TOOLS(AI 탭·사이드바), getClientActionTools_(편집창이 열렸을 때의
// apply_document_edit 등), JOB_AI_TOOLS_(AI 탭 job 기능), CASEPROC_AI_TOOLS_(사건 지휘 AI). 지침이 함께 적는 이름도 "있는 이름"으로 센다:
// browse_tax_calculators의 분야 키(gift_basic 등)와 도구 입력의 고정 선택지(job_lookup의 case_log 등 enum 값).
function sysAuditToolNames_() {
  var tools = [], names = [];
  var add = function (arr) { (arr || []).forEach(function (t) { if (t && t.name) tools.push(t); }); };
  if (typeof DRIVE_TOOLS !== 'undefined') add(DRIVE_TOOLS);
  try { if (typeof getClientActionTools_ === 'function') add(getClientActionTools_({ aiPanel: true, openFile: { liveContent: '' }, openDiagram: true })); } catch (e) { }
  try { if (typeof getClientActionTools_ === 'function') add(getClientActionTools_({ openFile: { liveContent: '' } })); } catch (e) { }
  if (typeof JOB_AI_TOOLS_ !== 'undefined') add(JOB_AI_TOOLS_);
  if (typeof CASEPROC_AI_TOOLS_ !== 'undefined') add(CASEPROC_AI_TOOLS_);
  var walk = function (o, d) {
    if (!o || typeof o !== 'object' || d > 8) return;
    if (Array.isArray(o.enum)) o.enum.forEach(function (v) { if (typeof v === 'string') names.push(v); });
    Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1); });
  };
  tools.forEach(function (t) { names.push(t.name); walk(t.input_schema, 0); });
  if (typeof TAX_TOOL_CATEGORIES_ !== 'undefined') names = names.concat(Object.keys(TAX_TOOL_CATEGORIES_));
  if (typeof JOB_PROPOSE_ACTIONS_ !== 'undefined') names = names.concat(Object.keys(JOB_PROPOSE_ACTIONS_)); // job_propose_action의 action(case_update 등)
  return { names: names, toolCount: tools.length };
}

// 법령 정비본 현행판의 조 목록(조 → [항수, 삭제]) — Code.js lawDbIdx_·lawDbIds_ 재사용, 6시간 기억
function sysAuditLaw_(key) {
  var idx = lawDbIdx_();
  if (!idx) throw new Error('법령 정비본 색인(업무관리자/법령/_본문/색인.json)을 찾지 못함');
  var ent = idx.법령[key];
  if (!ent) return null;
  var c = CacheService.getScriptCache(), ck = 'sysaud_law|' + key + '|' + ent.현행, s = c.get(ck);
  if (s) return JSON.parse(s);
  var fid = lawDbIds_(idx, key)[ent.현행];
  if (!fid) throw new Error(key + ' 현행판(' + ent.현행 + ') 파일이 없음');
  var d = JSON.parse(Utilities.ungzip(DriveApp.getFileById(fid).getBlob().setContentType('application/x-gzip')).getDataAsString('UTF-8'));
  var jo = {};
  (d.조 || []).forEach(function (a) { jo[a.조] = [(a.항 || []).length, /^제\S+\s*삭제/.test(String(a.내용 || '')) ? 1 : 0]; });
  var v = { 판: ent.현행, 시행일: String(ent.현행).slice(0, 8), 조: jo };
  try { c.put(ck, JSON.stringify(v), 21600); } catch (e) { }
  return v;
}

// "업무관리자\법령\읽기용(md)" → 0 NETAX 아래에서 한 단계씩 찾는다. 이름에 띄어쓰기가 있어도 되게 "가장 긴 같은 이름"으로 맞춘다.
function sysAuditPathResolver_() {
  var root = getNetaxRootFolder_();
  if (!root) return null;
  var kids = {};
  var children = function (folder) {
    var id = folder.getId();
    if (kids[id]) return kids[id];
    var arr = [], it = folder.getFolders();
    while (it.hasNext()) { var x = it.next(); arr.push({ name: x.getName(), folder: x }); }
    var fi = folder.getFiles();
    while (fi.hasNext()) { var y = fi.next(); arr.push({ name: y.getName(), folder: null }); }
    arr.sort(function (a, b) { return b.name.length - a.name.length; });
    return (kids[id] = arr);
  };
  return function (p) { return sysAuditWalk_(root, p, children); };
}

// 경로 따라가기(드라이브·로컬 공용) — children(handle) → [{ name, folder(handle|null) }]
function sysAuditWalk_(root, p, children) {
  // "\"·"›" 앞뒤 띄어쓰기는 붙인다. " / "(띄어 쓴 빗금)은 경로가 아니라 여러 개를 나열한 것이라 그대로 둔다.
  var s = String(p).replace(/\s*([\\›])\s*/g, '$1'), cur = root, at = [];
  while (s) {
    if (!cur) break;                         // 파일까지 왔는데 뒤에 더 있으면 설명 글
    if (/^[(（]/.test(s)) break;              // "법제처 원본(PDF)\(_목록.md, …)"처럼 괄호 속 설명
    var kids = children(cur), hit = null;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i].name;
      if (s.indexOf(n) !== 0) continue;
      var after = s.slice(n.length); // 이름 뒤가 구분자·문장부호·조사("보고서템플릿의 …")이면 같은 이름
      if (!after || /^[\\/›·|(]/.test(after) || /^\.(?![가-힣A-Za-z0-9_])/.test(after) || !/^[가-힣A-Za-z0-9_.]/.test(after) || /^(의|에서|에|을|를|은|는|이|가|으로|로|와|과|도|만|까지|부터)(?![가-힣A-Za-z0-9_])/.test(after)) { hit = kids[i]; break; }
    }
    var seg = s.split(/[\\/›]/)[0].split(/[\s`'"|,;]/)[0].replace(/[.。:：)\]]+$/, '').slice(0, 60);
    if (!hit) {
      if (cur !== root && children(root).some(function (k) { return k.name === seg; })) return { ok: true }; // "업무관리자/총괄관리자"처럼 나란히 적은 것
      if (/[<>{}*○…]|OO|날짜|이름|법령명|파일명|사건명|고객명|YYYY|yyyy|\.\.\./.test(seg)) return { ok: true, partial: true }; // 자리표시(예: 점검리포트_날짜.md)
      return { ok: false, missing: seg, at: at.join('\\') };
    }
    at.push(hit.name);
    s = s.slice(hit.name.length);
    if (!/^[\\/›]/.test(s)) break;          // 경로 끝(뒤는 설명 글)
    s = s.slice(1);
    cur = hit.folder;
    if (!s) break;
  }
  return { ok: true };
}

function sysAuditReportFolder_() {
  var chief = getChiefManagerFolder_();
  return chief ? getOrCreateSubfolder_(chief, '_점검리포트') : null;
}
function sysAuditReadJson_(folder, name) {
  var t = folder ? readFileIfExists_(folder, name) : null;
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { return null; }
}

// ---------------------------------------------------------------------------------------------
// ② 무료 AI(제미니) 뜻 점검 — 지침이 바뀐 날만. 유료로 자동 전환하지 않는다(메모리 feedback_job_token_principle).
//    보내는 것은 지침 글뿐이고, 그래도 고객 자료 차단 장치(Federation.js aiLooksClientData_)를 그대로 통과시킨다:
//    걸리는 부분은 [가림]으로 바꾸고, 바꾼 뒤에도 걸리면 그 파일은 보내지 않는다.
// ---------------------------------------------------------------------------------------------
function sysAuditMaskClient_(text) {
  var n = 0, t = String(text || '');
  if (typeof AI_CLIENT_DATA_RE_ !== 'undefined') t = t.replace(new RegExp(AI_CLIENT_DATA_RE_.source, 'g'), function () { n++; return '[가림]'; });
  var still = typeof aiLooksClientData_ === 'function' ? aiLooksClientData_(t) : true; // 차단 장치를 못 찾으면 보내지 않는다
  return { text: t, masked: n, blocked: still };
}

// 바뀐 파일 + 관련 파일을 묶어 요청을 나눈다(순수 함수 — node 시험용). base: 기준 문서(장기계획·체크리스트) 이름들
function sysAuditAiChunks_(files, changedNames, maxChars) {
  var byName = {}; files.forEach(function (f) { byName[f.name] = f; });
  var baseNames = files.filter(function (f) { return f.role === 'plan' || f.role === 'checklist'; }).map(function (f) { return f.name; });
  var baseLen = baseNames.reduce(function (s, n) { return s + byName[n].text.length; }, 0);
  var related = function (f) {
    var out = [], m = String(f.text).match(/^\s*>?\s*관련\s*지침\s*[:：]\s*(.+)$/m);
    if (m) m[1].split(/[·,、]/).forEach(function (s) { s = s.replace(/[`*]/g, '').trim().split(/\s+/)[0]; ['.md', '.txt', ''].some(function (ext) { if (byName[s + ext] && s + ext !== f.name) { out.push(s + ext); return true; } return false; }); });
    var stem = f.name.replace(/\.(md|txt)$/i, '');
    files.forEach(function (o) { if (o.role === 'bm' && o.name !== f.name && o.text.indexOf(stem) !== -1 && out.indexOf(o.name) === -1) out.push(o.name); });
    return out;
  };
  var chunks = [], cur = null, isChanged = {};
  changedNames.forEach(function (n) { isChanged[n] = 1; });
  // 바뀐 파일은 이름순(같은 주제가 붙어 있음)으로 차곡차곡 담고, 관련 파일은 "안 바뀐 것"만 곁들인다(바뀐 것은 어차피 어느 묶음엔가 들어감)
  changedNames.filter(function (n) { return byName[n] && byName[n].role !== 'plan' && byName[n].role !== 'checklist'; }).forEach(function (n) {
    var want = [n].concat(related(byName[n]).filter(function (x) { return !isChanged[x]; }));
    if (!cur) cur = { changed: [], files: [], len: baseLen };
    var extra = want.filter(function (x) { return cur.files.indexOf(x) === -1; }).reduce(function (s, x) { return s + byName[x].text.length; }, 0);
    if (cur.changed.length && cur.len + extra > maxChars) { chunks.push(cur); cur = { changed: [], files: [], len: baseLen }; }
    cur.changed.push(n);
    want.forEach(function (x) { if (cur.files.indexOf(x) === -1 && (x === n || cur.len + byName[x].text.length <= maxChars)) { cur.files.push(x); cur.len += byName[x].text.length; } });
  });
  if (cur && cur.changed.length) chunks.push(cur);
  // 장기계획·체크리스트 자체가 바뀌었으면: 모든 지침의 첫 줄 목록과 함께 한 번 본다(방향과 어긋나는 지침 찾기)
  var baseChanged = changedNames.filter(function (n) { return baseNames.indexOf(n) !== -1; });
  if (baseChanged.length) chunks.push({ changed: baseChanged, files: [], len: baseLen, baseOnly: true });
  chunks.forEach(function (c) { c.base = baseNames; });
  return chunks;
}

function sysAuditAiPrompt_(chunk, byName, sendText) {
  var p = '너는 세무사무소(조종호 세무사, 부동산·상속·증여) 업무 AI 시스템의 "지침 점검 위원"이다. 아래 지침 문서들을 비교해 딱 두 가지만 찾아라.\n'
    + '(1) 지침끼리: 서로 다른 지침이 같은 상황에 다른 결론·다른 절차·다른 숫자를 말하는 곳\n'
    + '(2) 계획·체크리스트와: 지침이 "NX_장기개발계획"의 방향이나 "체크리스트" 항목과 어긋나는 곳\n'
    + '규칙: 세법 해석이 옳은지 스스로 판정하지 마라 — 세법 판단이 걸리면 "세법판단필요": true 로만 표시. 오탈자·문체·형식은 보지 마라(다른 점검이 한다). 확실한 근거 문장이 없으면 쓰지 마라.\n'
    + '답은 JSON 배열 하나만(설명 글 없이). 문제가 없으면 [] .\n'
    + '[{"종류":"지침끼리"|"계획·체크리스트와","파일":["파일명1","파일명2"],"내용":"무엇이 어떻게 다른지 한두 문장","근거":["파일명1: 그 문장 짧게 인용","파일명2: 그 문장 짧게 인용"],"세법판단필요":true|false}]\n\n'
    + (chunk.baseOnly ? '이번에 바뀐 것은 기준 문서(' + chunk.changed.join(', ') + ')다. 아래 "지침 첫 줄 목록"의 지침들 중 기준 문서와 어긋나 보이는 것을 찾아라.\n\n' : '이번에 바뀐 지침: ' + chunk.changed.join(', ') + ' — 이 파일들이 관련된 다른 문서와 어긋나는지를 중심으로 보라.\n\n');
  chunk.base.concat(chunk.files).forEach(function (n) { p += '=== ' + n + ' ===\n' + sendText[n] + '\n\n'; });
  if (chunk.baseOnly) p += '=== 지침 첫 줄 목록 ===\n' + Object.keys(byName).filter(function (n) { return byName[n].role === 'bm'; }).map(function (n) { return '- ' + n + ': ' + String(byName[n].text).split('\n')[0].replace(/^#+\s*/, '').slice(0, 120); }).join('\n') + '\n';
  return p;
}

// AI 답에서 JSON 배열을 꺼낸다. 형식이 틀리면 ok:false + 원문(조용히 빈 결과로 만들지 않음)
function sysAuditParseAi_(text) {
  var t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (/^NO_ISSUES$/i.test(t)) return { ok: true, items: [] };
  var s = t.indexOf('['), e = t.lastIndexOf(']');
  if (s === -1 || e < s) return { ok: false, raw: t.slice(0, 2000) };
  try {
    var arr = JSON.parse(t.slice(s, e + 1));
    if (!Array.isArray(arr)) return { ok: false, raw: t.slice(0, 2000) };
    return { ok: true, items: arr.filter(function (x) { return x && x.내용; }).map(function (x) { return { 종류: String(x.종류 || ''), 파일: [].concat(x.파일 || []).map(String), 내용: String(x.내용).slice(0, 600), 근거: [].concat(x.근거 || []).map(function (g) { return String(g).slice(0, 300); }), 세법판단필요: !!x.세법판단필요 }; }) };
  } catch (err) { return { ok: false, raw: t.slice(0, 2000) }; }
}

// opts: { maxChunks, deadline(ms 시각) } — 새벽 묶음과 따로 도는 3시 트리거라도 6분 한도 안에서 멈춘다(못 본 파일은 다음 밤으로)
function sysAuditRunAi_(files, changedNames, opts) {
  opts = opts || {};
  var r = { status: '', ran: false, chunks: 0, sent: [], masked: 0, blocked: [], items: [], errors: [], deferred: [], done: [] };
  if (!changedNames.length) { r.status = '안 함 — 지난 AI 점검 이후 바뀐 지침 없음(0원)'; return r; }
  var gem = (typeof AI_REGISTRY_ !== 'undefined' ? AI_REGISTRY_ : []).filter(function (e) { return e.provider === 'gemini' && e.clientData === false; })[0];
  if (!gem) { r.status = '못 함 — 무료 AI(제미니) 연결을 코드에서 찾지 못함'; r.deferred = changedNames.slice(); return r; }
  if (!aiHasKey_(gem)) { r.status = '못 함 — 제미니 무료 키(GEMINI_API_KEY)가 없음. 설정 🤝 카드 🔑에서 넣으면 다음 밤부터 점검(유료로 바꾸지 않음)'; r.deferred = changedNames.slice(); return r; }
  var byName = {}, sendText = {};
  files.forEach(function (f) {
    byName[f.name] = f;
    var m = sysAuditMaskClient_(f.text);
    r.masked += m.masked;
    if (m.blocked) r.blocked.push(f.name); else sendText[f.name] = m.text;
  });
  var usable = files.filter(function (f) { return sendText[f.name] !== undefined; });
  var chunks = sysAuditAiChunks_(usable, changedNames.filter(function (n) { return sendText[n] !== undefined; }), SYS_AUDIT_AI_CHUNK_CHARS_);
  var maxChunks = opts.maxChunks || SYS_AUDIT_AI_MAX_CHUNKS_, done = {};
  for (var i = 0; i < chunks.length; i++) {
    if (i >= maxChunks || (opts.deadline && Date.now() > opts.deadline)) { chunks.slice(i).forEach(function (c) { r.deferred = r.deferred.concat(c.changed); }); break; }
    var c = chunks[i], ans = aiAskMany_([gem], sysAuditAiPrompt_(c, byName, sendText), 4000)[0] || { ok: false, error: '응답 없음' };
    r.chunks++;
    if (!ans.ok) {
      var limit = /quota|exhaust|429|rate|limit|한도/i.test(ans.error || '');
      r.errors.push((limit ? '무료 한도 초과' : '오류') + ': ' + String(ans.error || '').slice(0, 160));
      chunks.slice(i).forEach(function (cc) { r.deferred = r.deferred.concat(cc.changed); });
      break; // 유료로 바꾸지 않고 다음 밤에 다시
    }
    var p = sysAuditParseAi_(ans.text);
    if (!p.ok) { r.errors.push('AI 답 형식이 달라 읽지 못함(원문 일부): ' + p.raw.slice(0, 300)); r.deferred = r.deferred.concat(c.changed); continue; }
    r.items = r.items.concat(p.items);
    c.changed.forEach(function (n) { done[n] = 1; r.sent.push(n); });
  }
  r.deferred = r.deferred.concat(r.blocked.filter(function (n) { return changedNames.indexOf(n) !== -1; }));
  r.done = Object.keys(done);
  r.ran = r.sent.length > 0;
  r.status = r.ran ? ('점검함 — 바뀐 지침 ' + r.sent.length + '개를 무료 AI에 ' + r.chunks + '번 물음' + (r.deferred.length ? ', ' + r.deferred.length + '개는 다음 밤으로' : ''))
    : (r.errors.length ? '못 함 — ' + r.errors[0] : '못 함 — 보낼 수 있는 지침이 없음' + (r.blocked.length ? '(고객 자료처럼 보여 막힘 ' + r.blocked.length + '개)' : ''));
  return r;
}

// ---------------------------------------------------------------------------------------------
// 실행 — ① 규칙 점검: 새벽 2시 묶음(runNightlySystemAudit, force 아님)·🧭 화면 "지금 규칙 점검". 1분 안팎.
//        ② 무료 AI 점검: 새벽 3시 별도 트리거(runSysAuditAiNightly) — 새벽 2시 묶음의 6분 한도를 잡아먹지 않게 따로 돈다. 🧭 화면 버튼으로도.
// ---------------------------------------------------------------------------------------------
function sysAuditNow_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
function sysAuditSave_(folder, result) {
  writeFileOverwrite_(folder, SYS_AUDIT_RESULT_FILE_, JSON.stringify(result), 'application/json'); // 화면용 — 지침 본문은 넣지 않음(파일 이름·줄·짧은 인용만)
  writeFileOverwrite_(folder, '점검리포트_' + String(result.at || sysAuditNow_()).slice(0, 10) + '.md', sysAuditReportMd_(result), 'text/markdown');
  try { PropertiesService.getScriptProperties().setProperty('SYS_AUDIT_LAST', JSON.stringify(sysAuditSummary_(result))); } catch (e) { }
}

function sysAuditNightly_(opts) {
  opts = opts || {};
  var t0 = Date.now(), now = sysAuditNow_();
  var folder = sysAuditReportFolder_();
  if (!folder) return { success: false, error: '총괄관리자 폴더가 설정되지 않아 점검 결과를 남길 곳이 없습니다(CHIEF_MANAGER_FOLDER_ID).' };
  var prevResult = sysAuditReadJson_(folder, SYS_AUDIT_RESULT_FILE_);
  var result = { at: now, ran: false, reason: '', trigger: opts.trigger || '새벽 2시', warn: [], rules: null, ai: prevResult && prevResult.ai || null };
  try {
    var col = sysAuditCollectFiles_();
    result.warn = col.warn;
    if (!col.files.length) throw new Error('점검할 파일을 하나도 읽지 못했습니다' + (col.warn.length ? ' — ' + col.warn.join(' / ') : ''));
    var tn = sysAuditToolNames_();
    if (tn.toolCount < 20) throw new Error('도구 목록을 코드에서 읽지 못했습니다(' + tn.toolCount + '개) — 도구 이름 대조를 할 수 없어 점검을 멈춤');
    var state = sysAuditReadJson_(folder, SYS_AUDIT_STATE_FILE_) || {};
    var lawErr = null, resolver = sysAuditPathResolver_();
    if (!resolver) result.warn.push('0 NETAX 폴더를 못 찾아 드라이브 경로는 확인 못 함');
    var rules = sysAuditRules_({
      files: col.files, toolNames: tn.names, bmNames: col.bmNames, prevHashes: state.hashes || null,
      law: function (k) { try { return sysAuditLaw_(k); } catch (e) { lawErr = e.message; throw e; } },
      resolvePath: resolver
    });
    if (lawErr) result.warn.push('법령 정비본을 읽지 못해 조문 일부를 확인 못 함: ' + lawErr);
    rules.toolCount = tn.toolCount;
    // [2026.10.20] 지시문↔도구 일치 — 경로별 실제 켜진 도구 목록과 대조(못 하면 조용히 넘기지 않고 경고)
    try { rules.pathCheck = sysAuditPathCheck_(sysAuditPathData_(), col.files); }
    catch (e) { rules.pathCheck = null; result.warn.push('경로별 도구 대조를 못 함: ' + e.message); }
    rules.totals.pathProblems = rules.pathCheck ? rules.pathCheck.problems.length : 0;
    result.rules = rules;
    result.ran = true;
    var aiPrev = state.aiHashes || {};
    var waiting = col.files.filter(function (f) { return aiPrev[f.name] !== f.hash; }).length;
    if (result.ai) result.ai.waiting = waiting; else result.ai = { status: '아직 한 번도 안 돎 — 새벽 3시 무료 AI 점검 대기', ran: false, items: [], errors: [], deferred: [], waiting: waiting };
    var hashes = {}; col.files.forEach(function (f) { hashes[f.name] = f.hash; });
    writeFileOverwrite_(folder, SYS_AUDIT_STATE_FILE_, JSON.stringify({ at: now, hashes: hashes, aiHashes: aiPrev }), 'application/json');
  } catch (err) {
    result.ran = false;
    result.reason = String(err && err.message || err);
  }
  result.secs = Math.round((Date.now() - t0) / 1000);
  sysAuditSave_(folder, result);
  return { success: result.ran, error: result.ran ? undefined : result.reason, summary: sysAuditSummary_(result) };
}

// ② 무료 AI 점검 — AI 기준 지문과 다른 파일만. 결과는 점검결과_최신.json의 ai에 합친다(새로 본 파일의 옛 항목만 바꾸고 나머지는 유지).
function sysAuditAiNightly_(opts) {
  opts = opts || {};
  var t0 = Date.now(), now = sysAuditNow_();
  var folder = sysAuditReportFolder_();
  if (!folder) return { success: false, error: '총괄관리자 폴더가 설정되지 않았습니다(CHIEF_MANAGER_FOLDER_ID).' };
  var result = sysAuditReadJson_(folder, SYS_AUDIT_RESULT_FILE_) || { at: now, ran: false, reason: '규칙 점검이 아직 한 번도 돌지 않음', trigger: '', warn: [], rules: null };
  var prevAi = result.ai || {};
  var ai;
  try {
    var col = sysAuditCollectFiles_();
    var state = sysAuditReadJson_(folder, SYS_AUDIT_STATE_FILE_) || {};
    var aiPrev = state.aiHashes || {};
    var hashes = {}; col.files.forEach(function (f) { hashes[f.name] = f.hash; });
    var changed = col.files.filter(function (f) { return aiPrev[f.name] !== f.hash; }).map(function (f) { return f.name; });
    ai = sysAuditRunAi_(col.files, changed, { maxChunks: opts.maxChunks, deadline: t0 + (opts.budgetMs || 270000) });
    var newAi = {}; Object.keys(aiPrev).forEach(function (n) { if (hashes[n] && aiPrev[n] === hashes[n]) newAi[n] = aiPrev[n]; });
    ai.done.forEach(function (n) { newAi[n] = hashes[n]; });
    state.aiHashes = newAi;
    if (!state.hashes) state.hashes = hashes;
    writeFileOverwrite_(folder, SYS_AUDIT_STATE_FILE_, JSON.stringify(state), 'application/json');
    // 이번에 다시 본 파일이 낀 옛 항목은 버리고, 나머지(안 바뀐 파일끼리의 옛 항목)는 유지
    var reviewed = {}; ai.done.forEach(function (n) { reviewed[n] = 1; });
    var kept = (prevAi.items || []).filter(function (x) { return !(x.파일 || []).some(function (n) { return reviewed[n] || !hashes[n]; }); });
    var seenItem = {};
    ai.items = kept.concat(ai.items).filter(function (x) { var k = (x.파일 || []).slice().sort().join('|') + '|' + x.내용; if (seenItem[k]) return false; seenItem[k] = 1; return true; });
    ai.lastRunAt = ai.ran ? now : (prevAi.lastRunAt || '');
    if (!ai.ran && !changed.length) ai.status += prevAi.lastRunAt ? ' — 마지막 AI 점검 ' + prevAi.lastRunAt + ' 결과 유지' : '';
  } catch (err) {
    ai = { status: '못 함 — 오류: ' + String(err && err.message || err), ran: false, items: prevAi.items || [], errors: [String(err && err.message || err)], deferred: [], lastRunAt: prevAi.lastRunAt || '' };
  }
  ai.at = now;
  ai.trigger = opts.trigger || '새벽 3시';
  ai.secs = Math.round((Date.now() - t0) / 1000);
  ai.waiting = (ai.deferred || []).length;
  result.ai = ai;
  sysAuditSave_(folder, result);
  return { success: ai.ran || !ai.errors.length, ai: { status: ai.status, items: ai.items.length }, summary: sysAuditSummary_(result) };
}

// 새벽 3시 트리거 진입점(트리거는 함수 이름으로 부르므로 이름 끝에 _ 없음)
function runSysAuditAiNightly() {
  try { sysAuditAiNightly_({ trigger: '새벽 3시' }); } catch (err) { console.error('무료 AI 지침 점검 실패: ' + err.message); }
}
function sysAuditEnsureTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'runSysAuditAiNightly'; });
  if (!has) ScriptApp.newTrigger('runSysAuditAiNightly').timeBased().everyDays(1).atHour(3).create();
  return { ok: true, existed: has };
}

// 대시보드·개선 후보 보고서용 한 줄 요약
function sysAuditSummary_(r) {
  if (!r) return null;
  var t = (r.rules && r.rules.totals) || {};
  var ai = r.ai || {};
  return { at: r.at, ran: !!r.ran, reason: r.reason || '', files: t.files || 0, problems: (t.problems || 0) + (t.pathProblems || 0), pathProblems: t.pathProblems || 0, warnings: t.warnings || 0, confirm: t.confirm || 0,
    changed: (r.rules && r.rules.changedFiles || []).length, aiRan: !!ai.ran, aiStatus: ai.status || '', aiItems: (ai.items || []).length,
    aiLaw: (ai.items || []).filter(function (x) { return x.세법판단필요; }).length };
}

function sysAuditReportMd_(r) {
  var md = '# 점검리포트 ' + r.at.slice(0, 10) + '\n\n';
  if (!r.ran) return md + '## ⚠ 점검 안 됨\n\n' + r.reason + '\n\n(' + r.at + ' ' + r.trigger + ' 실행)\n';
  var t = r.rules.totals;
  md += '> ' + r.at + ' ' + r.trigger + ' 실행 · ' + r.secs + '초 · ① 규칙 점검(0원) + ② 무료 AI 점검(바뀐 날만)\n\n';
  md += '## ① 규칙 점검(AI 없이)\n'
    + '- 본 파일 ' + t.files + '개 · 문제 ' + t.problems + ' · 주의 ' + t.warnings + ' · 참고 ' + t.infos + '\n'
    + '- 대조한 것: 조문 인용 ' + t.citations + '개(정비본으로 확인 ' + t.citationsChecked + ') · 도구 이름 ' + t.toolRefs + '개(서버 도구 ' + r.rules.toolCount + '개와 대조) · 드라이브 경로 ' + t.pathRefs + '개 · 다른 지침 가리킴 ' + t.guideRefs + '개\n'
    + '- [확인 필요] ' + t.confirm + '개' + (t.confirmOldest ? ' (가장 오래된 것 ' + t.confirmOldest + ')' : '') + '\n';
  var pc = r.rules.pathCheck;
  if (pc) {
    md += '- 지시문↔도구: ' + pc.paths.map(function (p) { return p.label + ' 도구 ' + p.toolCount + '개'; }).join(' · ') + ' — 어긋남 ' + pc.problems.length + '건\n';
    pc.problems.forEach(function (x) { md += '  - ⚠ ' + x.text + '\n'; });
  }
  if (r.rules.changedFiles.length) md += '- 바뀐 파일: ' + r.rules.changedFiles.map(function (c) { return c.name + '(' + c.changed + ')'; }).join(', ') + '\n';
  (r.warn || []).forEach(function (w) { md += '- ⚠ ' + w + '\n'; });
  md += '\n';
  r.rules.files.forEach(function (f) {
    if (!f.problems.length && !f.confirm.count) return;
    md += '### ' + f.name + ' — 문제 ' + (f.counts.문제 || 0) + ' · 주의 ' + (f.counts.주의 || 0) + (f.confirm.count ? ' · [확인 필요] ' + f.confirm.count + '(' + f.confirm.since + ')' : '') + '\n';
    f.problems.filter(function (p) { return p.level !== '참고'; }).slice(0, 40).forEach(function (p) { md += '- ' + p.line + '줄 [' + p.kind + '·' + p.level + '] ' + p.text + (p.snippet ? ' — `' + p.snippet.replace(/`/g, "'").slice(0, 90) + '`' : '') + '\n'; });
    md += '\n';
  });
  var ai = r.ai || {};
  md += '## ② 무료 AI 점검(제미니)\n- ' + (ai.at ? ai.at + ' ' + (ai.trigger || '') + ' — ' : '') + (ai.status || '기록 없음') + '\n';
  if (ai.lastRunAt) md += '- 마지막으로 실제 AI 점검이 돈 때: ' + ai.lastRunAt + '\n';
  if (ai.waiting) md += '- AI 점검을 기다리는 파일(바뀌었는데 아직 AI가 못 본 것): ' + ai.waiting + '개\n';
  if (ai.masked) md += '- 고객 자료 차단 장치에 걸린 글 ' + ai.masked + '곳은 [가림]으로 바꿔 보냄\n';
  if (ai.blocked && ai.blocked.length) md += '- 가린 뒤에도 고객 자료처럼 보여 보내지 않은 파일: ' + ai.blocked.join(', ') + '\n';
  (ai.errors || []).forEach(function (e) { md += '- ⚠ ' + e + '\n'; });
  if (ai.deferred && ai.deferred.length) md += '- 다음에 다시 볼 파일: ' + ai.deferred.join(', ') + '\n';
  (ai.items || []).forEach(function (x) { md += '- [' + x.종류 + (x.세법판단필요 ? '·세법 판단 필요(🧾 유료 점검 대상)' : '') + '] ' + x.파일.join(' vs ') + ': ' + x.내용 + (x.근거.length ? '\n  - 근거: ' + x.근거.join(' / ') : '') + '\n'; });
  if (ai.ran && !(ai.items || []).length) md += '- AI가 찾은 어긋남 없음\n';
  return md;
}

// 🧭 시스템 관리 화면 — 마지막 점검 결과
function sysAuditResult_() {
  var folder = sysAuditReportFolder_();
  if (!folder) return { error: '총괄관리자 폴더가 설정되지 않았습니다(CHIEF_MANAGER_FOLDER_ID).' };
  var r = sysAuditReadJson_(folder, SYS_AUDIT_RESULT_FILE_);
  return { success: true, result: r, stale: sysAuditStale_(r) };
}
// 마지막 점검이 오래됐으면 이유 글(어제·오늘이면 '')
function sysAuditStale_(r) {
  if (!r || !r.at) return '점검 기록이 아직 없습니다 — 새 점검(규칙+무료 AI)이 아직 한 번도 돌지 않았습니다.';
  var y = Utilities.formatDate(new Date(Date.now() - 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
  return r.at.slice(0, 10) >= y ? '' : '마지막 점검이 ' + r.at + ' — 새벽 작업이 그 뒤로 돌지 않았습니다.';
}
// 🧭 화면 버튼 — 스크립트 잠금(withLock_)은 쓰지 않는다: 1분 넘게 잡고 있으면 그동안 다른 저장이 막힌다. 대신 "점검 중" 표시로 겹쳐 돌지 않게만.
function sysAuditGuard_(kind, fn) {
  var p = PropertiesService.getScriptProperties(), k = 'SYS_AUDIT_BUSY_' + kind, v = +(p.getProperty(k) || 0);
  if (v && Date.now() - v < 6 * 60000) return { success: false, error: '이미 점검 중입니다(' + Math.round((Date.now() - v) / 1000) + '초째) — 끝난 뒤 🔄으로 결과를 보세요.' };
  p.setProperty(k, String(Date.now()));
  try { return fn(); } finally { p.deleteProperty(k); }
}
function sysAuditRunNow_() {
  return sysAuditGuard_('RULES', function () { return sysAuditNightly_({ trigger: '화면에서' }); });
}
function sysAuditAiRunNow_() {
  return sysAuditGuard_('AI', function () { return sysAuditAiNightly_({ trigger: '화면에서', maxChunks: 2, budgetMs: 200000 }); });
}

// 🧾 유료 점검(Sonnet)에 "판단 필요" 항목만 보낼 때 쓰는 자료 — ②가 찾은 세법 판단 필요 항목과 그 파일들
function sysAuditFlaggedForPaid_() {
  var folder = sysAuditReportFolder_(), r = folder && sysAuditReadJson_(folder, SYS_AUDIT_RESULT_FILE_);
  var items = r && r.ai && r.ai.items ? r.ai.items.filter(function (x) { return x.세법판단필요; }) : [];
  if (!items.length) return null;
  var names = {}; items.forEach(function (x) { x.파일.forEach(function (n) { names[n] = 1; }); });
  return { items: items, files: Object.keys(names), at: r.at };
}
// 위 항목의 파일 + 장기계획·체크리스트만 모아 toolAuditBusinessManagers와 같은 모양으로 돌려준다(Code.js runNightlySystemAudit flaggedOnly)
function sysAuditFlaggedAuditData_(flagged) {
  var col = sysAuditCollectFiles_(), want = {};
  flagged.files.forEach(function (n) { want[n] = 1; });
  var sections = col.files.filter(function (f) { return want[f.name] || f.role === 'plan' || f.role === 'checklist'; })
    .map(function (f) { return '=== ' + f.name + ' ===\n' + f.text; });
  return { 파일개수: sections.length, 전체내용: sections.join('\n\n') };
}

// =============================================================================================
// [2026.10.20 추가] 세무사님 "아니 이런 말도 안되는 일이 있나? 내가 모르는 사이에 소리없이 시스템이 망가졌구나"
//   work → job으로 옮길 때 업무관리자 지침 도구 4종이 job AI탭에서 빠졌는데, job 지시문에는 "그 도구를 쓰라"는 문장이 남아 있었고 아무 경고도 없었다.
//   ① 지시문↔도구 일치(규칙 점검, 0원): 경로(job AI·work AI·AI 지휘)마다 실제로 켜진 도구 목록을 코드에서 그대로 받아,
//      그 경로의 지시문·켜진 도구의 설명·업무관리자 지침(job)에 나오는 도구 이름이 그 목록에 있는지 본다. 마스터 프로필은 지시문에 들어 있어 함께 본다.
//   ② 기능이 빠지는 것 감시: 배포 직후 점검(deploySmoke_)마다 경로별 도구 + 화면이 부르는 서버 동작(callGas) + 서버가 받는 동작을 기록하고,
//      직전 배포보다 줄어든 것을 "⚠ 이번 반영으로 빠진 기능"으로 띄운다(의도된 제거라도 세무사님이 볼 수 있게).
// =============================================================================================
var SYS_AUDIT_PROBE_ = { probe: 'sys-audit' }; // callClaude가 이 객체와 같을 때만 도구 목록을 돌려준다(Code.js) — JSON 요청으로는 만들 수 없음
var SYS_AUDIT_FEATURE_FILE_ = '_기능목록.json';
var SYS_AUDIT_PATH_LABEL_ = { job: 'job AI', work: 'work AI', lead: 'AI 지휘' };

// 경로별 켜진 도구(이름·설명)와 지시문 — 실제 코드 함수 그대로(callClaude·buildContextSystemPrompt·caseProcAiLiveTools_·caseProcAiLiveSystem_)
function sysAuditPathData_() {
  var cats = typeof TAX_TOOL_CATEGORIES_ !== 'undefined' ? Object.keys(TAX_TOOL_CATEGORIES_) : [];
  // 계산기는 browse_tax_calculators로 분야를 연 뒤에 켜진다 — 모든 분야를 연 것으로 쳐서 "켤 수 있는 도구"를 받는다
  var msgs = [{ role: 'assistant', content: cats.map(function (c, i) { return { type: 'tool_use', id: 'probe' + i, name: 'browse_tax_calculators', input: { category: c } }; }) }];
  var probe = function (ctx) {
    var r = callClaude({ __probe: SYS_AUDIT_PROBE_, context: ctx, messages: msgs, enableCodeExecution: true, enableAdvisor: true }, DEFAULT_MODEL, { codeExec: true }, {}, 1000, { static: '', dynamic: '' }, '');
    if (!r || !r.probeTools) throw new Error('callClaude에서 도구 목록을 받지 못함(Code.js 입구가 없거나 바뀜)');
    return r.probeTools;
  };
  var master = '';
  try { master = getMasterProfileText_() || ''; } catch (e) { }
  var prompt = function (ctx) { return buildContextSystemPrompt(DEFAULT_SYSTEM_PROMPT + '\n\n' + master, { context: ctx, messages: [] }).full; };
  var paths = [
    { key: 'job', label: 'job AI(AI탭·사이드바)', tools: probe({ aiPanel: 'tab', openFile: { liveContent: '' }, openDiagram: true }), prompt: prompt({ aiPanel: 'tab' }) },
    { key: 'work', label: 'work AI', tools: probe({ openFile: { liveContent: '' }, openDiagram: true }), prompt: prompt({}) }
  ];
  if (typeof caseProcAiLiveTools_ === 'function') {
    var lt = caseProcAiLiveTools_().map(function (t) { return { name: t.name, description: String(t.description || '') }; });
    var ls = '';
    try { ls = typeof caseProcAiLiveModeText_ === 'function' ? caseProcAiLiveModeText_(1000) : caseProcAiLiveSystem_(1000); } catch (e) { ls = ''; } // [2026.10.21] 마스터 프로필은 job 경로에서 보므로 지휘 고유 부분만
    paths.push({ key: 'lead', label: 'AI 지휘(이 사건 처리하자)', tools: lt, prompt: ls });
  }
  return paths;
}

// 순수 함수 — paths:[{key,label,tools:[{name,description}],prompt}], files(규칙 점검과 같은 모양) → 어긋남 목록
//   이름 후보는 어느 경로엔가 실제로 있는 도구 이름(전체 합집합)만 — 아예 없는 이름은 규칙 점검의 "없는 도구"가 따로 잡는다.
function sysAuditPathCheck_(paths, files) {
  var all = {};
  paths.forEach(function (p) { p.tools.forEach(function (t) { all[t.name] = 1; }); });
  var names = function (text) {
    var out = {}, m, re = /\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g;
    while ((m = re.exec(String(text || '')))) if (all[m[1]]) out[m[1]] = 1;
    return Object.keys(out);
  };
  var probs = [], byKey = {};
  var add = function (p, name, source) {
    var k = p.key + '|' + name;
    if (!byKey[k]) {
      byKey[k] = { path: p.key, label: p.label, name: name, sources: [], level: '문제',
        have: paths.filter(function (q) { return q.tools.some(function (t) { return t.name === name; }); }).map(function (q) { return q.label; }) };
      probs.push(byKey[k]);
    }
    if (byKey[k].sources.indexOf(source) === -1) byKey[k].sources.push(source);
  };
  paths.forEach(function (p) {
    var on = {};
    p.tools.forEach(function (t) { on[t.name] = 1; });
    names(p.prompt).forEach(function (n) { if (!on[n]) add(p, n, '지시문'); });
    p.tools.forEach(function (t) { names(t.description).forEach(function (n) { if (!on[n]) add(p, n, '도구 설명(' + t.name + ')'); }); });
    if (p.key === 'job') (files || []).forEach(function (f) { if (f.role === 'bm') names(f.text).forEach(function (n) { if (!on[n]) add(p, n, '지침 ' + f.name); }); });
  });
  probs.forEach(function (x) {
    x.text = x.label + '에는 ' + x.name + ' 도구가 없는데 ' + x.sources.slice(0, 4).join('·') + (x.sources.length > 4 ? ' 외 ' + (x.sources.length - 4) + '곳' : '')
      + '이(가) 그 도구를 씀' + (x.have.length ? ' (있는 곳: ' + x.have.join(', ') + ')' : '');
  });
  return { paths: paths.map(function (p) { return { key: p.key, label: p.label, toolCount: p.tools.length, promptChars: String(p.prompt || '').length }; }), problems: probs };
}

// ② 기능 목록 — 화면·서버 목록은 깃허브 main(job.netax.kr/app이 서빙하는 원본이자 📥의 원본)에서 읽는다.
function sysAuditFeatureList_() {
  var snap = { at: sysAuditNow_(), tools: {}, screen: null, server: null, warn: [] };
  sysAuditPathData_().forEach(function (p) { snap.tools[p.key] = p.tools.map(function (t) { return t.name; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(); });
  var raw = function (p) {
    var r = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + GH_REPO_ + '/main/' + p, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error(p + ' 응답 ' + r.getResponseCode());
    return r.getContentText();
  };
  try { snap.screen = sysAuditScreenActions_(raw('app/index.html')); } catch (e) { snap.warn.push('화면 목록을 못 읽음: ' + e.message); }
  // [2026.10.21] Code.js가 접두어로 다른 서버 파일에 넘기는 입구(예: knh_ → KnowHow.js knhDispatch_)도 센다.
  //   전엔 Code.js 글자만 세서 KnowHow.js의 knh_index를 "화면은 부르는데 서버에 없음"으로 잘못 잡았다(10-21 @1196 헛경고).
  try {
    var code = raw('gs-backend/Code.js'), others = {};
    if (sysAuditPrefixRoutes_(code).length) {
      var list = UrlFetchApp.fetch('https://api.github.com/repos/' + GH_REPO_ + '/contents/gs-backend?ref=main', { muteHttpExceptions: true });
      if (list.getResponseCode() !== 200) throw new Error('서버 파일 목록 응답 ' + list.getResponseCode());
      JSON.parse(list.getContentText()).forEach(function (f) {
        if (f.type === 'file' && /\.js$/.test(f.name) && f.name !== 'Code.js') others[f.name] = raw('gs-backend/' + f.name);
      });
    }
    snap.server = sysAuditServerActions_(code, others);
  } catch (e) { snap.warn.push('서버 동작 목록을 못 읽음: ' + e.message); }
  return snap;
}
// 순수 함수 — Code.js에서 「/^접두어/.test(String(body.action)) && typeof 넘길함수 === 'function'」 줄을 찾아 [{prefix, fn}]
function sysAuditPrefixRoutes_(code) {
  var out = [], m, re = /\/\^([A-Za-z0-9_]+)\/\.test\(\s*String\(\s*body\.action\s*\)\s*\)\s*&&\s*typeof\s+([A-Za-z0-9_$]+)\s*===\s*['"]function['"]/g;
  while ((m = re.exec(String(code)))) out.push({ prefix: m[1], fn: m[2] });
  return out;
}
function sysAuditScreenActions_(html) {
  var o = {}, m, re = /callGas(?:Raw_)?\(\s*['"]([A-Za-z0-9_]+)['"]/g;
  while ((m = re.exec(String(html)))) o[m[1]] = 1;
  return Object.keys(o).sort();
}
// others = { 파일이름: 글 } — 접두어 입구가 넘기는 함수가 정의된 파일에서 「=== '접두어…'」로 받는 이름을 더한다(그 함수가 없는 파일은 안 봄)
function sysAuditServerActions_(code, others) {
  var o = {}, m, re = /\baction\s*===\s*['"]([A-Za-z0-9_]+)['"]/g;
  while ((m = re.exec(String(code)))) o[m[1]] = 1;
  // [2026.10.21] 이름 목록 배열로 받는 입구(예: WORK_ACTIONS.indexOf(body.action) !== -1 → 작업관리 처리)도 센다 — 전엔 빠져 고객관리·작업관리 등 48개를 "서버에 없음"으로 셌다
  var arrRe = /\b(?:const|var|let)\s+([A-Z][A-Z0-9_]*ACTIONS_?)\s*=\s*\[([^\]]*)\]/g, am;
  while ((am = arrRe.exec(String(code)))) {
    if (!new RegExp('\\b' + am[1] + '\\.indexOf\\(\\s*(?:body\\.)?action\\s*\\)').test(String(code))) continue;
    var nm, nre = /['"]([A-Za-z0-9_]+)['"]/g;
    while ((nm = nre.exec(am[2]))) o[nm[1]] = 1;
  }
  sysAuditPrefixRoutes_(code).forEach(function (r) {
    Object.keys(others || {}).forEach(function (name) {
      var t = String(others[name]);
      if (t.indexOf('function ' + r.fn + '(') === -1) return;
      var re2 = new RegExp('===\\s*[\'"](' + r.prefix + '[A-Za-z0-9_]*)[\'"]', 'g'), m2;
      while ((m2 = re2.exec(t))) o[m2[1]] = 1;
    });
  });
  return Object.keys(o).sort();
}
// 순수 함수 — 직전 기록과 비교: 경로별 빠진 도구, 화면이 더는 부르지 않는 동작, 서버가 더는 받지 않는 동작, 새로 끊긴 연결(화면은 부르는데 서버에 없음)
function sysAuditFeatureDiff_(prev, cur) {
  var minus = function (a, b) { var s = {}; (b || []).forEach(function (x) { s[x] = 1; }); return (a || []).filter(function (x) { return !s[x]; }); };
  var broken = function (s) { return s && s.screen && s.server ? minus(s.screen, s.server) : null; };
  var d = { at: cur.at, prevAt: prev ? prev.at : '', removedTools: {}, removedScreen: [], removedServer: [], newBroken: [], count: 0 };
  if (!prev) return d;
  Object.keys(prev.tools || {}).forEach(function (k) { var r = minus(prev.tools[k], (cur.tools || {})[k]); if (r.length) { d.removedTools[k] = r; d.count += r.length; } });
  if (prev.screen && cur.screen) { d.removedScreen = minus(prev.screen, cur.screen); d.count += d.removedScreen.length; }
  if (prev.server && cur.server) { d.removedServer = minus(prev.server, cur.server); d.count += d.removedServer.length; }
  var pb = broken(prev), cb = broken(cur);
  if (pb && cb) { d.newBroken = minus(cb, pb); d.count += d.newBroken.length; }
  return d;
}
function sysAuditFeatureDiffText_(d) {
  if (!d || !d.count) return '';
  var cut = function (a) { return a.slice(0, 12).join('·') + (a.length > 12 ? ' 외 ' + (a.length - 12) + '개' : ''); };
  var parts = [];
  Object.keys(d.removedTools).forEach(function (k) { parts.push((SYS_AUDIT_PATH_LABEL_[k] || k) + ' 도구 ' + cut(d.removedTools[k])); });
  if (d.removedScreen.length) parts.push('화면이 더는 부르지 않는 서버 동작 ' + cut(d.removedScreen));
  if (d.removedServer.length) parts.push('서버가 더는 받지 않는 동작 ' + cut(d.removedServer));
  if (d.newBroken.length) parts.push('새로 끊긴 화면 연결(화면은 부르는데 서버에 없음) ' + cut(d.newBroken));
  return '이번 반영으로 빠진 기능 ' + d.count + '개 — ' + parts.join(' / ');
}
// deploySmoke_가 부른다: 지금 목록을 기록하고 직전 배포와 비교. text가 비어 있지 않으면 점검 항목에 ⚠로 보이고 대시보드에도 뜬다.
function sysAuditFeatureRecord_() {
  var folder = sysAuditReportFolder_();
  if (!folder) return { text: '', warn: ['총괄관리자 폴더가 없어 기능 목록을 기록하지 못함'] };
  var store = sysAuditReadJson_(folder, SYS_AUDIT_FEATURE_FILE_) || {};
  var cur = sysAuditFeatureList_();
  var prev = store.last || null;
  // 이번에 화면·서버 목록을 못 읽었으면 직전 것을 이어 쓴다(못 읽은 것을 "다 빠졌다"로 보지 않게) — 대신 warn에 남긴다
  if (!cur.screen && prev && prev.screen) { cur.screen = prev.screen; cur.screenCarried = true; }
  if (!cur.server && prev && prev.server) { cur.server = prev.server; cur.serverCarried = true; }
  var d = sysAuditFeatureDiff_(prev, cur), text = sysAuditFeatureDiffText_(d);
  store.prev = prev ? { at: prev.at } : null;
  store.last = cur;
  store.lastCheck = { at: cur.at, count: d.count, text: text, warn: cur.warn, first: !prev };
  if (d.count) store.lastDiff = d;
  writeFileOverwrite_(folder, SYS_AUDIT_FEATURE_FILE_, JSON.stringify(store), 'application/json');
  try { PropertiesService.getScriptProperties().setProperty('SYS_FEATURE_DIFF', JSON.stringify(store.lastCheck)); } catch (e) { }
  return store.lastCheck;
}
