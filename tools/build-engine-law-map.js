#!/usr/bin/env node
// [2026.10.13] 엔진 의존 조문 지도 만들기 — Code.js의 함수마다 주석·문구에 적힌 "§조문" 표기를 모아
// "법령 → 조문 → 그 조문을 쓰는 함수들" 지도를 gs-backend/EngineLawMap.js(ENGINE_LAW_MAP_)로 만든다.
// 야간 법령 감시(runEnvWatch_)가 개정 조문을 찾으면 이 지도로 "영향받는 계산 함수"를 표시한다.
// 사용: node tools/build-engine-law-map.js   (Code.js를 고친 뒤 clasp push 전에 — CLAUDE.md 절차에 포함)
// 법령 이름이 바로 앞에 없으면 함수 이름·본문 낱말로 세목을 추정한다(지도는 "후보" 표시용이라 추정이 섞여도 됨).
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'gs-backend', 'Code.js');
const OUT = path.join(__dirname, '..', 'gs-backend', 'EngineLawMap.js');

const LAW_TOKENS = [
  [/조특령|조세특례제한법\s*시행령|조특법\s*시행령/, '조세특례제한법 시행령'],
  [/조특칙|조세특례제한법\s*시행규칙|조특법\s*시행규칙/, '조세특례제한법 시행규칙'],
  [/조특법|조세특례제한법/, '조세특례제한법'],
  [/상증령|상속세\s*및\s*증여세법\s*시행령|상증(?:세)?법\s*시행령/, '상속세 및 증여세법 시행령'],
  [/상증칙|상속세\s*및\s*증여세법\s*시행규칙|상증(?:세)?법\s*시행규칙/, '상속세 및 증여세법 시행규칙'],
  [/상증(?:세)?법|상속세\s*및\s*증여세법/, '상속세 및 증여세법'],
  [/국기령|국세기본법\s*시행령/, '국세기본법 시행령'],
  [/국기법|국세기본법/, '국세기본법'],
  [/소득령|소령|소득세법\s*시행령/, '소득세법 시행령'],
  [/소득칙|소칙|소득세법\s*시행규칙/, '소득세법 시행규칙'],
  [/소득세법|소법/, '소득세법']
];
function familyOf(fnName, body) {
  const gi = (body.match(/상속|증여|상증|gift|inherit/gi) || []).length;
  const tr = (body.match(/양도|소득세|transfer|capital/gi) || []).length;
  const sp = (body.match(/조특|자경|감면/g) || []).length;
  if (/gift|inherit|estate|증여|상속/i.test(fnName) || gi > tr * 1.5) return '상속세 및 증여세법';
  if (sp > tr && sp > gi) return '조세특례제한법';
  return '소득세법';
}
function lawFor(prefix, fam) {
  for (const [re, name] of LAW_TOKENS) if (re.test(prefix)) return name;
  if (/시행령|\b령\b/.test(prefix)) return fam + ' 시행령';
  if (/시행규칙/.test(prefix)) return fam + ' 시행규칙';
  return fam;
}

// 서버(Code.js)와 화면 계산엔진(manage/taxcalc*.html — 1세대1주택·장특공제 등 세액 계산 본체가 여기 있다)
const MANAGE = path.join(__dirname, '..', 'gs-backend', 'manage');
const files = [{ file: SRC, label: '' }].concat(fs.readdirSync(MANAGE).filter((n) => /^taxcalc.*\.html$/.test(n)).map((n) => ({ file: path.join(MANAGE, n), label: n.replace(/\.html$/, '') + ':' })));
const fns = [];
let lines = [];
files.forEach((fi) => {
  const ls = fs.readFileSync(fi.file, 'utf8').split('\n');
  const base = lines.length;
  ls.forEach((l, i) => { const m = /^\s{0,4}function\s+([A-Za-z0-9_$]+)\s*\(/.exec(l); if (m) fns.push({ name: fi.label + m[1], start: base + i, fileEnd: base + ls.length }); });
  lines = lines.concat(ls);
});
fns.forEach((f, i) => { f.end = i + 1 < fns.length && fns[i + 1].start < f.fileEnd ? fns[i + 1].start : f.fileEnd; });

const map = {};
let refs = 0;
fns.forEach((f) => {
  // 도구 목록·안내문처럼 조문을 수십 개 나열만 하는 함수는 "의존"이 아니므로 뺀다
  const distinct = new Set((lines.slice(f.start, f.end).join('\n').match(/§\s*\d{1,3}/g) || []).map((x) => x.replace(/\s/g, '')));
  if (distinct.size > 40) return;
  // 함수 바로 위 주석 10줄도 그 함수 설명으로 본다
  const from = Math.max(0, f.start - 10);
  const body = lines.slice(from, f.end).join('\n');
  const fam = familyOf(f.name, body);
  const re = /([가-힣A-Za-z\s]{0,16})§\s*(\d{1,3})(?:\s*조)?(?:\s*의\s*(\d{1,2}))?/g;
  let m;
  while ((m = re.exec(body))) {
    const law = lawFor(m[1], fam);
    const key = m[2] + (m[3] ? '의' + m[3] : '');
    map[law] = map[law] || {};
    const arr = map[law][key] = map[law][key] || [];
    if (arr.indexOf(f.name) === -1) arr.push(f.name);
    refs++;
  }
});
Object.keys(map).forEach((law) => Object.keys(map[law]).forEach((k) => { map[law][k] = map[law][k].slice(0, 25); }));
const stamp = new Date().toISOString().slice(0, 10);
const out = '// 자동 생성 파일 — node tools/build-engine-law-map.js 로 다시 만든다(직접 고치지 말 것). 생성일 ' + stamp + '\n'
  + '// 법령 → 조문(예: "89", "97의2") → 그 조문을 주석·문구에서 인용하는 Code.js 함수들. 야간 법령 감시의 "영향 계산함수" 표시용(추정 포함).\n'
  + 'var ENGINE_LAW_MAP_ = ' + JSON.stringify(map) + ';\n';
fs.writeFileSync(OUT, out);
const nLaw = Object.keys(map).length, nArt = Object.keys(map).reduce((s, l) => s + Object.keys(map[l]).length, 0);
console.log('EngineLawMap.js 생성 — 법령 ' + nLaw + '개, 조문 ' + nArt + '개, 인용 ' + refs + '건, 함수 ' + fns.length + '개 검사');
