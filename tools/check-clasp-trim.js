#!/usr/bin/env node
// [2026.10.20 서버 용량] 화면 원본(gs-backend/manage/*.html)은 서버에 올리지 않는다(gs-backend/.claspignore) — 화면은 job.netax.kr/app/에서만 연다.
// 서버가 쓰는 화면 파일(SERVER_HTML)만 서버에 남긴다. 이 도구는 두 가지를 확인한다(돌리기: node tools/check-clasp-trim.js).
//  ① manage/*.html 중 서버용이 아닌데 .claspignore에 없는 것(새 화면 파일을 만들고 빼먹으면 서버 크기가 다시 커짐)
//  ② 서버 코드(gs-backend/*.js)가 .claspignore로 뺀 파일을 HtmlService로 부르는지(부르면 서버에서 "파일 없음" 오류)
// 문제가 있으면 종료코드 1. 고칠 곳: .claspignore에 한 줄 더하거나, 서버가 꼭 써야 하면 SERVER_HTML에 넣고 .claspignore에서 뺀다.
'use strict';
const fs = require('fs'), path = require('path');
const GS = path.join(__dirname, '..', 'gs-backend');
const SERVER_HTML = ['manage/taxcalc-engine.html']; // Code.js getUiCalcEngine_ — 서버 세액 엔진
const ignore = fs.readFileSync(path.join(GS, '.claspignore'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const problems = [];
fs.readdirSync(path.join(GS, 'manage')).filter((f) => /\.html$/.test(f)).forEach((f) => {
  const rel = 'manage/' + f;
  const ignored = ignore.includes(rel);
  if (SERVER_HTML.includes(rel) && ignored) problems.push('서버가 쓰는 ' + rel + '이(가) .claspignore에 있음 — 빼야 서버 세액 엔진이 돎');
  if (!SERVER_HTML.includes(rel) && !ignored) problems.push(rel + '이(가) .claspignore에 없음 — 서버에 올라가 용량을 차지함(화면 전용이면 한 줄 더할 것)');
});
fs.readdirSync(GS).filter((f) => /\.js$/.test(f) && !ignore.includes(f)).forEach((f) => {
  const src = fs.readFileSync(path.join(GS, f), 'utf8');
  const re = /HtmlService\.create(?:HtmlOutputFromFile|TemplateFromFile)\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const rel = m[1] + '.html';
    if (ignore.includes(rel)) problems.push(f + '이(가) 서버에 없는 ' + rel + '을(를) 부름(줄 ' + (src.slice(0, m.index).split('\n').length) + ')');
  }
});
if (problems.length) { console.log('⚠ 서버 화면 파일 점검 ' + problems.length + '건\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('✓ 서버 화면 파일 점검 통과 — 서버에 올라가는 화면 파일: ' + SERVER_HTML.join(', '));
