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

// [2026.10.19] 엔진(taxcalc-engine.html)에도 양도일별 기본세율(2부-01)·장특공 표1·표2(2부-03, 2020년 이전 표2)를 옮겨 적는다.
//  엔진은 window.__NX_REF_HISTORY_ON === true일 때만 쓴다(세무사님 확인 전 꺼짐). 2023 표는 엔진의 지금 표와 같아야 한다(다르면 멈춤).
const ENGINE = path.join(ROOT, 'gs-backend', 'manage', 'taxcalc-engine.html');
const EB = '/*@@REF_ENGINE_BEGIN@@*/', EE = '/*@@REF_ENGINE_END@@*/';
const t201 = tables.filter((t) => t.번호 === '2부-01')[0], t203 = tables.filter((t) => t.번호 === '2부-03')[0];
if (t201 && t203) {
  const br = t201.행.map((r) => ({ from: r.시작, to: r.끝 || null, brackets: r.값.구간.map((g) => ({ max: g.이하 == null ? 'INF' : g.이하, rate: g.세율, deduction: g.누진공제 })) }));
  const lt1 = t203.행.filter((r) => /^표1/.test(r.구분)).map((r) => ({ from: r.시작, to: r.끝 || null, rates: r.값 }));
  const lt2 = t203.행.filter((r) => /^표2 1세대1주택\(보유기간별\)$/.test(r.구분)).map((r) => ({ from: r.시작, to: r.끝 || null, rates: r.값 }));
  if (!br.length || !lt1.length || !lt2.length) throw new Error('2부-01·2부-03에서 엔진용 행을 못 읽었습니다');
  const last = br.filter((b) => b.from === '2023-01-01')[0];
  const cur = [[14000000, 0.06, 0], [50000000, 0.15, 1260000], [88000000, 0.24, 5760000], [150000000, 0.35, 15440000], [300000000, 0.38, 19940000], [500000000, 0.40, 25940000], [1000000000, 0.42, 35940000], ['INF', 0.45, 65940000]];
  if (!last || JSON.stringify(last.brackets.map((b) => [b.max, b.rate, b.deduction])) !== JSON.stringify(cur)) throw new Error('2부-01의 2023 표가 엔진 TRANSFER_TAX_BRACKETS와 다릅니다 — 확인 필요');
  const js = (o) => JSON.stringify(o).replace(/"INF"/g, 'Infinity');
  let e = fs.readFileSync(ENGINE, 'utf8');
  const i2 = e.indexOf(EB), k2 = e.indexOf(EE);
  if (i2 < 0 || k2 < i2) throw new Error('taxcalc-engine.html에 엔진 자리 표시가 없습니다');
  const nl = e.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  e = e.slice(0, i2) + EB + nl + '  const REF_TR_BRACKETS_ = ' + js(br) + ';' + nl + '  const REF_LT_ = { 표1: ' + js(lt1) + ', 표2: ' + js(lt2) + ' };' + nl + '  ' + e.slice(k2);
  fs.writeFileSync(ENGINE, e);
  console.log('엔진: 기본세율 ' + br.length + '개 시기, 장특공 표1 ' + lt1.length + '·표2(2020 이전) ' + lt2.length + '개 시기 → taxcalc-engine.html');
}
console.log('조견표 ' + tables.length + '장(' + tables.map((t) => t.번호).join(', ') + '), 서식 칸 지도 ' + Object.keys(forms).length + '장 → lawsearch.html');
