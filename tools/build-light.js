// ============================================================
// [2026.10.17] 관리 서버(가벼운 조회 전용 GAS 프로젝트) 코드 자동 생성
// ------------------------------------------------------------
// job 서버(gs-backend, 3MB)는 호출마다 코드 전체를 읽느라 빈 호출도 3~5초 걸리고, 사건처리·AI 같은 무거운 일과
// 한 줄에 서서 10~30초씩 튄다(2026-10-17 시험용 서버 비교: 작은 코드 1.5초, 3MB 3.4초). 관리 메뉴가 화면을 열 때마다
// 기다리는 조회(사건 목록·고객 목록·자문내역·예약 목록)만 작은 프로젝트(gs-light)로 따로 돌린다.
//
// 코드를 두 벌 손으로 관리하지 않도록, gs-backend/*.js에서 조회 함수와 그 함수가 쓰는 함수·상수만 골라
// gs-light/Generated.js로 그대로 복사한다(직접 고치지 말 것 — Code.js를 고치고 이 스크립트를 다시 돌린다).
// 저장·수정은 옮기지 않는다 — 잠금(LockService)이 프로젝트마다 따로라, 두 서버가 같은 시트에 쓰면 꼬일 수 있다.
// 실행: NETAX_Job 폴더에서 `node tools/build-light.js`
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'gs-backend');
// 대상 서버별 시작 함수(각 폴더 Light.js의 LIGHT_ACTIONS_가 부르는 함수와 같아야 함)
const TARGETS = {
  // 관리 서버 — 관리 메뉴가 화면을 열 때마다 기다리는 조회
  'gs-light': ['work_getCases', 'client_getClients', 'client_getConsultLogs', 'booking_getBookings', 'jsonResponse'],
  // 부가서비스 서버 — 폴더 보기·메모·보고서 모음·서식(템플릿) 화면의 조회(비밀값·저장이 필요 없는 것만, gs-extra/README.md)
  'gs-extra': ['handleListFolder', 'handleGetNetaxRootPath', 'handleListCaseTemplates', 'handleGetCaseTemplateContent', 'handleListGeneralMemos', 'handleListAllReports', 'handleGetLatestTemplateReview', 'jsonResponse']
};

// 최상위 선언 하나 = 한 덩어리. 이 저장소 코드는 최상위 선언이 항상 줄 맨 앞에서 시작한다.
const DECL_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/;
function splitTopLevel(src, file) {
  const lines = src.split(/\r?\n/);
  const chunks = [];
  let cur = null, pendingComments = [];
  lines.forEach(function (line) {
    const m = DECL_RE.exec(line);
    if (m) {
      if (cur) chunks.push(cur);
      cur = { name: m[1] || m[2], file: file, lines: pendingComments.concat([line]) };
      pendingComments = [];
    } else if (/^(\/\/|\/\*| \*)/.test(line) || /^\s*$/.test(line)) {
      if (cur && /^\s*$/.test(line) === false && /^(\/\/|\/\*| \*)/.test(line)) { chunks.push(cur); cur = null; }
      if (cur) cur.lines.push(line); else pendingComments.push(line);
    } else if (/^\S/.test(line) && !/^[}\])]/.test(line)) {
      // 최상위에서 바로 실행되는 코드(즉시실행 함수 등) — 선언이 아니므로 따로 모아 두고, 쓰이지 않으면 버린다
      if (cur) chunks.push(cur);
      cur = { name: null, file: file, lines: pendingComments.concat([line]) };
      pendingComments = [];
    } else {
      if (cur) cur.lines.push(line); else pendingComments.push(line);
    }
  });
  if (cur) chunks.push(cur);
  return chunks;
}

function build(target, ENTRIES, opts) {
  const OUT = path.join(ROOT, target, 'Generated.js');
  const files = fs.readdirSync(SRC).filter(function (f) { return /\.js$/.test(f); }).sort();
  let chunks = [];
  files.forEach(function (f) { chunks = chunks.concat(splitTopLevel(fs.readFileSync(path.join(SRC, f), 'utf8'), f)); });
  
  const byName = Object.create(null);
  chunks.forEach(function (c) {
    if (!c.name) return;
    if (byName[c.name]) throw new Error('같은 이름이 두 번 선언됨(자동 생성 불가): ' + c.name + ' — ' + byName[c.name].file + ', ' + c.file);
    byName[c.name] = c;
  });
  
  // 주석과 문자열 내용을 지운다(템플릿 문자열의 ${...} 안은 코드라 남긴다). 정규식 리터럴은 구분하지 않고 그대로
  // 두는데, 그 안의 단어가 함수 이름과 같으면 함수가 조금 더 들어갈 뿐 빠지지는 않는다(안전한 쪽).
  function stripCommentsAndStrings(src) {
    let out = '', i = 0;
    const n = src.length;
    const tplDepth = []; // 템플릿 ${ 안에 들어가 있을 때 중괄호 깊이
    while (i < n) {
      const ch = src[i], nx = src[i + 1];
      if (ch === '/' && nx === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (ch === '/' && nx === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
      if (ch === '\'' || ch === '"') {
        i++; while (i < n && src[i] !== ch && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
        i++; out += '""'; continue;
      }
      if (ch === '`' || (ch === '}' && tplDepth.length && tplDepth[tplDepth.length - 1] === 0)) {
        if (ch === '}') tplDepth.pop();
        i++;
        while (i < n && src[i] !== '`') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '$' && src[i + 1] === '{') { i += 2; tplDepth.push(0); break; }
          i++;
        }
        if (src[i] === '`') i++;
        out += ' ';
        continue;
      }
      if (tplDepth.length) {
        if (ch === '{') tplDepth[tplDepth.length - 1]++;
        else if (ch === '}') tplDepth[tplDepth.length - 1]--;
      }
      out += ch; i++;
    }
    return out;
  }
  function idsIn(text) {
    const out = new Set();
    const re = /[A-Za-z_$][\w$]*/g;
    const code = stripCommentsAndStrings(text);
    let m;
    while ((m = re.exec(code))) {
      // obj.name 처럼 점 뒤에 오는 이름은 속성이라 최상위 선언이 아니다
      if (m.index > 0 && code[m.index - 1] === '.') continue;
      out.add(m[0]);
    }
    return out;
  }
  
  const need = new Set();
  const queue = ENTRIES.slice();
  while (queue.length) {
    const n = queue.shift();
    if (need.has(n)) continue;
    const c = byName[n];
    if (!c) throw new Error('함수를 찾지 못함: ' + n);
    need.add(n);
    idsIn(c.lines.join('\n')).forEach(function (id) { if (byName[id] && !need.has(id)) queue.push(id); });
  }
  
  // 옮겨 간 함수가 저장(쓰기)을 하는지 표시만 한다 — 조회 함수 안의 "머리줄 보충" 같은 것은 원래 동작 그대로 둔다.
  const picked = chunks.filter(function (c) { return c.name && need.has(c.name); });
  // 덩어리 경계를 잘못 잘랐으면(예: 줄 맨 앞에서 시작하는 여러 줄 문자열) 그 덩어리만으로는 문법이 맞지 않는다 — 그때는 만들지 않고 멈춘다.
  const vm = require('vm');
  picked.forEach(function (c) {
    try { new vm.Script(c.lines.join('\n'), { filename: c.file + ':' + c.name }); }
    catch (err) { throw new Error('덩어리 경계 오류 — ' + c.file + ' ' + c.name + ': ' + err.message); }
  });
  const body = picked.map(function (c) { return c.lines.join('\n').replace(/\s+$/, ''); }).join('\n\n');
  const writes = picked.filter(function (c) { return /\.(setValue|setValues|appendRow|deleteRow|insertSheet|createFolder|setTrashed)\(/.test(c.lines.join('\n')); }).map(function (c) { return c.name; });
  
  const header = '// 자동 생성 파일 — 직접 고치지 말 것. 원본: gs-backend/*.js, 생성: tools/build-light.js\n' +
    '// 조회 시작점: ' + ENTRIES.join(', ') + '\n' +
    '// 포함한 최상위 선언 ' + picked.length + '개' + (writes.length ? ' (시트 쓰기가 들어 있는 것: ' + writes.join(', ') + ')' : '') + '\n\n';
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, header + body + '\n');
  console.log(target + '/Generated.js 생성 — 선언 ' + picked.length + '개, ' + Math.round((header + body).length / 1024) + 'KB');
  if (writes.length) console.log('시트 쓰기가 들어 있는 함수: ' + writes.join(', '));
  // 프로젝트마다 따로인 것들 — 쓰고 있으면 job 서버와 값이 다를 수 있으니 사람이 확인해야 한다(--점검 으로 보기)
  if (process.argv.indexOf('--점검') !== -1) {
    const flags = { 'PropertiesService(비밀값·설정)': /PropertiesService\./, 'CacheService(기억)': /CacheService\./, 'LockService(잠금)': /LockService\.|withLock_\(/,
      '고급 서비스(Drive./Tasks./Slides.)': /(^|[^\w.$])(Drive|Tasks|Slides)\.[A-Z]?[a-z]/m, 'Drive 쓰기': /\.(createFile|createFolder|setTrashed|setContent|moveTo|setName|addFile|removeFile|makeCopy|setSharing)\(/, 'UrlFetchApp(외부 호출)': /UrlFetchApp\./ };
    Object.keys(flags).forEach(function (k) {
      const hit = picked.filter(function (c) { return flags[k].test(stripCommentsAndStrings(c.lines.join('\n'))); }).map(function (c) { return c.name; });
      if (hit.length) console.log('  ' + k + ': ' + hit.join(', '));
    });
  }
}
const only = process.argv[2];
Object.keys(TARGETS).forEach(function (t) {
  if (only && only !== t) return;
  if (!TARGETS[t]) { console.log(t + ': 시작 함수 목록 없음 — 건너뜀'); return; }
  build(t, TARGETS[t]);
});
