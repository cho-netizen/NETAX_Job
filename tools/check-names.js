#!/usr/bin/env node
// ============================================================
// [2026.10.20 보안] 공개 저장소 실명·개인정보 검사기
// ------------------------------------------------------------
// 이 저장소는 공개라 코드 주석·예시 글에 고객 실명·주민번호·계좌번호가 들어가면 그대로 새어 나간다.
// 2026-10-20 주석의 고객 실명을 사건 가명(고객A, 고객A 피상속인 …)으로 바꿨고, 다시 들어오지 않게 이 검사기를 둔다.
//
// 찾는 것
//  1) 대응표의 실명 — 저장소 밖 %USERPROFILE%\.netax\names-map.json(실명→가명)이 있으면 그 실명이 다시 들어왔는지.
//     (대응표는 git에 올리지 않는다. 없으면 이 항목은 건너뛴다. 다른 위치: 환경 변수 NETAX_NAMES_MAP)
//  2) 사건 폴더명 꼴 "홍길동(홍길순)_" — 이름(이름)_ (고객명(납세자)_ 같은 규칙 설명·견본 이름은 뺀다)
//  3) 주민등록번호 꼴(앞 6자리가 날짜 모양 + 뒤 7자리) — 000000-0000000처럼 가린 것은 뺀다
//  4) 계좌번호 꼴(숫자 묶음 3~4개, 10자리 이상, 4자리 이상 묶음 포함) — 날짜·전화·사업자번호·모두 0은 뺀다
// 출력은 파일:줄 + 앞 1글자○○만(실명·번호 원문은 찍지 않는다). 하나라도 있으면 종료 코드 1.
//
// 사용: node tools/check-names.js            (발견 시 종료 코드 1)
//       node tools/check-names.js --warn     (발견해도 종료 코드 0 — build-app.js가 이렇게 부른다)
//       require('./check-names.js').scan()   → { hits: [{file, line, kind, mask}], mapLoaded }
// 고칠 때: 실명은 대응표의 가명으로, 번호는 0으로 가린다(예: 000000-0000000). 견본 이름은 아래 ALLOW에.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const MAP_FILE = process.env.NETAX_NAMES_MAP || path.join(os.homedir(), '.netax', 'names-map.json');

// 검사 대상(자동 생성 app/index.html은 원본 manage/*.html을 보므로 뺀다)
const TARGETS = [
  { dir: 'gs-backend', re: /\.js$/ },
  { dir: 'gs-backend/manage', re: /\.html$/ },
  { dir: 'app-only', re: /\.(html|js|json|md)$/ },
  { dir: 'm', re: /\.(html|js|json)$/ },
  { dir: 'docs', re: /\.md$/ },
  { dir: 'tools', re: /\.(js|json)$/ },
  { dir: 'reftables', re: /\.(json|md)$/ },
  { dir: '.', re: /^index\.html$/ },
];
const SELF = path.join('tools', 'check-names.js');

// 견본·규칙 설명 낱말 — 폴더명 꼴에서 뺀다
const ALLOW = new Set(['고객명', '납세자', '피상속인', '증여자', '수증자', '양도인', '사건명', '의뢰인', '고객', '이름', '성명',
  '홍길동', '홍길순', '홍철수', '이순신', '김철수', '김영희', '조종호']);

const mask = (s) => (s ? s[0] + '○○' : '');

function listFiles() {
  const out = [];
  for (const t of TARGETS) {
    const d = path.join(ROOT, t.dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      const rel = path.join(t.dir, f);
      if (rel === SELF || path.normalize(rel) === path.normalize(SELF)) continue;
      const full = path.join(d, f);
      try { if (!fs.statSync(full).isFile()) continue; } catch (e) { continue; }
      if (t.re.test(f)) out.push(path.normalize(rel));
    }
  }
  return out;
}

function loadMap() {
  try {
    const j = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
    const names = Object.keys(j.people || {}).filter((n) => n && n.length >= 2);
    const orgs = Object.keys(j.orgs || {}).filter(Boolean);
    return { names, orgs };
  } catch (e) { return null; }
}

const isHangul = (c) => !!c && /[가-힣]/.test(c);
const PARTICLE = /^(은|는|이|가|을|를|의|와|과|도|에|께|로|만|님|씨)/;

function scan() {
  const map = loadMap();
  const hits = [];
  const lineOf = (s, i) => { let n = 1; for (let k = s.indexOf('\n'); k !== -1 && k < i; k = s.indexOf('\n', k + 1)) n++; return n; };
  for (const rel of listFiles()) {
    let s;
    try { s = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { continue; }
    const add = (i, kind, text) => hits.push({ file: rel.replace(/\\/g, '/'), line: lineOf(s, i), kind, mask: mask(text) });
    // 1) 대응표 실명·회사명
    if (map) {
      for (const n of map.names) {
        for (let i = s.indexOf(n); i !== -1; i = s.indexOf(n, i + 1)) {
          if (n.length === 2) { // 두 글자 이름은 낱말 경계일 때만
            if (isHangul(s[i - 1])) continue;
            const after = s.slice(i + 2, i + 3);
            if (isHangul(after) && !PARTICLE.test(after)) continue;
          }
          add(i, '실명', n);
        }
      }
      for (const o of map.orgs) for (let i = s.indexOf(o); i !== -1; i = s.indexOf(o, i + 1)) add(i, '회사명', o);
    }
    let m;
    // 2) 사건 폴더명 꼴
    const reFolder = /([가-힣]{2,4})\(([가-힣]{2,4})\)_/g;
    while ((m = reFolder.exec(s))) {
      if (ALLOW.has(m[1]) && ALLOW.has(m[2])) continue;
      if (ALLOW.has(m[1]) || ALLOW.has(m[2])) { if (/^(고객명|사건명)$/.test(m[1])) continue; }
      add(m.index, '폴더명 꼴', m[1]);
    }
    // 3) 주민등록번호 꼴
    const reRrn = /(?<![\d-])(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\s?-\s?([1-8])(\d{6})(?![\d])/g;
    while ((m = reRrn.exec(s))) {
      if (/^0+$/.test(m[5]) || /^(\d)\1{5}$/.test(m[5])) continue; // 뒷자리 가림·같은 숫자 반복(견본)
      add(m.index, '주민번호 꼴', m[0]);
    }
    // 4) 계좌번호 꼴
    const reAcct = /(?<![\d.\-:/])(\d{2,6})-(\d{2,6})-(\d{2,8})(?:-(\d{1,6}))?(?![\d.\-:/])/g;
    while ((m = reAcct.exec(s))) {
      const g = [m[1], m[2], m[3], m[4]].filter(Boolean);
      const digits = g.join('');
      if (digits.length < 10) continue;
      if (!g.some((x) => x.length >= 4)) continue;
      if (/^0+$/.test(digits) || /^(\d)\1+$/.test(digits)) continue;
      if (/^(19|20)\d{2}$/.test(g[0]) && g.length >= 3 && +g[1] <= 12) continue; // 날짜
      if (/^0\d{1,2}$/.test(g[0]) && g.length === 3 && g[1].length >= 3 && g[2].length === 4) continue; // 전화
      if (g.length === 3 && g[0].length === 3 && g[1].length === 2 && g[2].length === 5) continue; // 사업자등록번호(서류 맞대기 열쇠, 개인 식별 아님)
      if (g.length === 3 && g[0].length === 6 && g[1].length === 7) continue;
      if (/^(1234|0000|9999)/.test(digits) || /123456|987654/.test(digits)) continue; // 견본 꼴
      add(m.index, '계좌번호 꼴', m[0]);
    }
  }
  return { hits, mapLoaded: !!map, mapFile: MAP_FILE };
}

module.exports = { scan };

if (require.main === module) {
  const warn = process.argv.includes('--warn');
  const r = scan();
  if (!r.mapLoaded) console.log('(대응표 없음 — 실명 대조는 건너뜀: ' + r.mapFile + ')');
  for (const h of r.hits) console.log('  ' + h.file + ':' + h.line + '  [' + h.kind + '] ' + h.mask);
  console.log(r.hits.length ? '⚠ 실명 의심 ' + r.hits.length + '곳' : '✓ 실명 의심 0곳');
  process.exit(r.hits.length && !warn ? 1 : 0);
}
