#!/usr/bin/env node
// [2026.10.19 조견표 체계] 조견표·서식 칸 지도 자료(reftables/*.json)를 법령정보 화면(gs-backend/manage/lawsearch.html)에 끼워 넣는다.
//  - reftables/<1부-NN|2부-NN>.json  → LSI_REF_TABLES_ (번호 순)
//  - reftables/서식_*.json            → LSI_FORM_MAPS_ (키 = "서식번호" 글자 그대로 — 세액인쇄 PRINT_REGISTRY_의 formNo와 같아야 서식 탭에 붙는다)
//  자료 형식: reftables/README.md. 출처는 공식 원문만, 세무사님 확인 전 "상태"는 "초안"(계산·판정에 쓰지 않음).
//  사용: node tools/build-reftables.js  → 그다음 node tools/build-app.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'reftables');
const PAGE = path.join(ROOT, 'gs-backend', 'manage', 'lawsearch.html');
const B = '/*@@REF_DATA_BEGIN@@*/', E = '/*@@REF_DATA_END@@*/';
const tables = [], forms = {};
fs.readdirSync(DIR).filter((f) => /\.json$/.test(f)).sort().forEach((f) => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (/^서식_/.test(f)) {
    if (!j.서식번호 || !Array.isArray(j.칸)) throw new Error(f + ': 서식번호·칸이 없습니다');
    forms[j.서식번호] = j;
  } else {
    if (!/^[12]부-\d+$/.test(j.번호 || '') || !Array.isArray(j.행)) throw new Error(f + ': 번호(1부-NN)·행이 없습니다');
    (j.행 || []).forEach((r, i) => { if (!r.출처 && !/확인 필요/.test(r.확인 || '')) throw new Error(f + ' 행 ' + (i + 1) + ': 출처 없는 행은 "확인 필요"여야 합니다'); });
    tables.push(j);
  }
});
tables.sort((a, b) => a.번호.localeCompare(b.번호, 'ko', { numeric: true }));
let s = fs.readFileSync(PAGE, 'utf8');
const i = s.indexOf(B), k = s.indexOf(E);
if (i < 0 || k < i) throw new Error('lawsearch.html에 자리 표시가 없습니다');
const block = B + '\n  var LSI_FORM_MAPS_ = ' + JSON.stringify(forms) + ';\n  var LSI_REF_TABLES_ = ' + JSON.stringify(tables) + ';\n  ';
s = s.slice(0, i) + block + s.slice(k);
fs.writeFileSync(PAGE, s);
console.log('조견표 ' + tables.length + '장(' + tables.map((t) => t.번호).join(', ') + '), 서식 칸 지도 ' + Object.keys(forms).length + '장 → lawsearch.html');
