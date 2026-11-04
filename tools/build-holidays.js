#!/usr/bin/env node
// [2026.11.04 계산 엔진 하나 ③] 공휴일 표 하나 — 원본은 조견표 1부-02(reftables/1부-02.json) 하나뿐.
//  화면은 조견표를 통째로 읽지만 서버엔 조견표(약 1MB)를 올리지 않으므로, 날짜만 뽑아 gs-backend/HolidayDates.js로 만든다.
//  서버 엔진(getUiCalcEngine_)과 판정 묶음(JudgeMore apShift_)이 이 날짜를 같이 읽는다. 직접 고치지 말고 조견표를 고친 뒤 이 도구를 돌릴 것.
//  돌리기: node tools/build-holidays.js  (build-app.js가 같이 부름)
'use strict';
const fs = require('fs'), path = require('path');
const t = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'reftables', '1부-02.json'), 'utf8'));
const set = {};
(t.행 || []).forEach(function (r) {
  if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.시작 || ''))) return;
  let d = new Date(r.시작 + 'T00:00:00Z'); const end = new Date((r.끝 || r.시작) + 'T00:00:00Z');
  for (let i = 0; i < 10 && d <= end; i++) { set[d.toISOString().slice(0, 10)] = true; d = new Date(d.getTime() + 86400000); }
});
const dates = Object.keys(set).sort();
const out = '// 자동 생성 — tools/build-holidays.js가 조견표 1부-02(reftables/1부-02.json)에서 뽑음. 직접 고치지 말 것.\n' +
  '// ' + (t.이름 || '') + ' · 날짜 ' + dates.length + '개(' + dates[0] + '~' + dates[dates.length - 1] + ')\n' +
  'var NX_HOLIDAY_DATES_ = ' + JSON.stringify(dates) + ';\n';
const f = path.join(__dirname, '..', 'gs-backend', 'HolidayDates.js');
if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out) fs.writeFileSync(f, out);
console.log('공휴일 날짜 ' + dates.length + '개 → gs-backend/HolidayDates.js');
