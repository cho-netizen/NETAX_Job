#!/usr/bin/env node
// [2026.11.01 종합판정 ①] 1세대1주택 판정 셈 시험 — 엔진(judgeTaxReliefJS)을 직접 불러 조건을 하나씩 바꾸고,
//  판정 결론을 세액계산(calculateTransferTaxSingleJS)의 isOneHouseOneFamily에 넣어 실제 세액 숫자까지 견준다. 합성 자료만, 서버·토큰 0.
//  사용: node tools/judge-regress.js   (✗가 하나라도 있으면 종료 코드 1)
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gs-backend/manage/taxcalc-engine.html'), 'utf8').replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
const W = {}; new Function('window', src)(W);
const base = () => ({
  묶음: '1세대1주택', 양도일: '2026-11-20',
  대상: { 취득일: '2022-03-02', 취득원인: '매매', 양도가액: 900000000, 취득당시조정: true, 거주개월: 30 },
  물건: [{ 이름: '판정 주택', 종류: '주택', 주택수: '든다', 대상: true }],
  세대: { 거주자: true, 배우자: true }
});
const tax = (oneHouse, price) => W.calculateTransferTaxSingleJS({ assetType: 'house', transferDate: '2026-11-20', acquisitionDate: '2022-03-02', transferPrice: price || 900000000, acquisitionPrice: 600000000, necessaryExpenses: 0, isOneHouseOneFamily: oneHouse, isTransferorResident: true, residenceYears: 2, isAdjustedAreaAtAcquisition: true });
const cases = [
  ['기본(1주택·4년 보유·30개월 거주)', (p) => p, '충족', false],
  ['보유 1년 8개월', (p) => { p.대상.취득일 = '2025-03-02'; }, '안 됨', false],
  ['보유 정확히 2년(같은 날)', (p) => { p.대상.취득일 = '2024-11-20'; }, '충족', false],
  ['조정 취득·거주 20개월', (p) => { p.대상.거주개월 = 20; }, '안 됨', false],
  ['비조정 취득·거주 0', (p) => { p.대상.취득당시조정 = false; p.대상.거주개월 = 0; }, '충족', false],
  ['조정 여부 모름·거주 모름', (p) => { p.대상.취득당시조정 = null; delete p.대상.거주개월; }, '충족', true],
  ['거주 전입·전출로(2023-01-01~2025-02-01)', (p) => { delete p.대상.거주개월; p.대상.거주 = [{ 전입: '2023-01-01', 전출: '2025-02-01' }]; }, '충족', false],
  ['비거주자', (p) => { p.세대.거주자 = false; }, '안 됨', false],
  ['배우자 없음·28세·소득 모름', (p) => { p.세대 = { 거주자: true, 배우자: false, 나이: 28 }; }, '충족', true],
  ['배우자 없음·28세·소득 못 갖춤', (p) => { p.세대 = { 거주자: true, 배우자: false, 나이: 28, 소득요건: false }; }, '안 됨', false],
  ['다른 주택 1채·특례 없음', (p) => { p.물건.push({ 이름: '아파트B', 종류: '주택', 주택수: '든다', 취득일: '2025-05-01' }); }, '안 됨', true],
  ['다른 주택 1채·일시적 2주택(신규 2025-05-01)', (p) => { p.물건.push({ 이름: '아파트B', 종류: '주택', 주택수: '든다', 취득일: '2025-05-01' }); p.특례 = [{ 종류: '일시적2주택', 입력: { newHouseAcquisitionDate: '2025-05-01' } }]; }, '충족', false],
  ['일시적 2주택 3년 넘김(신규 2023-06-01)', (p) => { p.물건.push({ 이름: '아파트B', 종류: '주택', 주택수: '든다', 취득일: '2023-06-01' }); p.특례 = [{ 종류: '일시적2주택', 입력: { newHouseAcquisitionDate: '2023-06-01' } }]; }, '안 됨', false],
  ['오피스텔 주택 수 모름', (p) => { p.물건.push({ 이름: '오피스텔C', 종류: '주택', 주택수: '모름' }); }, '충족', true],
  ['오피스텔 주택 수 안 든다', (p) => { p.물건.push({ 이름: '오피스텔C', 종류: '주택', 주택수: '안 든다' }); }, '충족', false],
  ['먼저 판 주택은 빠짐', (p) => { p.물건.push({ 이름: '판 집', 종류: '주택', 주택수: '든다', 양도일: '2026-01-10' }); }, '충족', false],
  ['조합원입주권 보유·특례 없음', (p) => { p.물건.push({ 이름: '입주권D', 종류: '조합원입주권', 주택수: '든다' }); }, '안 됨', true],
  ['상생임대로 거주 면제(거주 0)', (p) => { p.대상.거주개월 = 0; p.상생임대 = { mutualLeaseContractDate: '2023-03-01', priorLeaseStartDate: '2021-03-01', priorLeaseEndDate: '2023-02-28', mutualLeaseStartDate: '2023-03-01', mutualLeaseEndDate: '2025-02-28', priorLeaseDeposit: 300000000, mutualLeaseDeposit: 310000000, transferDate: '2026-11-20' }; }, '충족', false],
  ['고가(15억) — 충족, 초과분 과세 알림', (p) => { p.대상.양도가액 = 1500000000; }, '충족', false],
  ['양도일 없음', (p) => { delete p.양도일; }, '충족', true]
];
let bad = 0;
cases.forEach(([name, mod, want, wantEst]) => {
  const p = base(); mod(p); const r = W.judgeTaxReliefJS(p);
  const ok = r.결론 === want && r.잠정 === wantEst;
  if (!ok) bad++;
  const price = p.대상.양도가액;
  const t = tax(r.결론 === '충족', price);
  console.log((ok ? '✓ ' : '✗ ') + name + ' → ' + r.결론 + (r.잠정 ? '(잠정)' : '') + ' · 세액 ' + (t.납부세액 != null ? t.납부세액 : t.산출세액 != null ? t.산출세액 : JSON.stringify(t).slice(0, 80)) + (r.남은것.length ? ' · 남은 것: ' + r.남은것.join(' / ') : '') + (r.사후관리.length ? ' · ' + r.사후관리.join(' / ') : ''));
  if (!ok) console.log('   기대 ' + want + (wantEst ? '(잠정)' : '') + ' · 표시 ' + r.표시 + '\n   ' + r.셈표.map((x) => x.요건 + '=' + x.결과).join(', '));
});

console.log(bad ? '✗ ' + bad + '건 어긋남' : '모두 맞음 ' + cases.length + '건');
process.exit(bad ? 1 : 0);
