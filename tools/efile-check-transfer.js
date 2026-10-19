#!/usr/bin/env node
// 양도소득세 전자신고 파일 길이·칸 점검 — 서버·드라이브 호출 없음, 고객 정보 없음(합성 값만), 토큰 0.
//  기준: 국세청 "양도소득세 전자신고 파일설명서 V5.17(2026.4.28.)" 테이블별 길이(01 HEADER 350 · 02 기본사항 400 · 03 세율별내역 450 ·
//  04 양수인 150 · 05 양도소득금액 계산명세 700 · 06 주식 계산명세 300 · 07 필요경비 상세 200).
//  ※ 설명서 앞쪽 "테이블별 길이" 표는 HEADER를 300으로 적었지만, 2023.4.27 개정 항목표(26 세무대리인성명 60·27 생년월일 8·28 공란 47, 누적 350)를 따른다.
//  화면 함수(gs-backend/manage/taxcalc.html의 tr*·ih* 함수)를 소스에서 잘라 내 엔진(taxcalc-engine.html) 결과로 레코드를 만들고
//  ① 레코드마다 바이트 길이 ② 몇몇 칸 값(국적코드·62~65·30=19·지방소득세 0·세율구분별 합 = 소계)을 확인한다.
// 쓰는 법: node tools/efile-check-transfer.js   (실패하면 종료 코드 1)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
// EFILE_UI=다른 taxcalc.html 경로 — 예전 판과 비교할 때(예: git show HEAD~1:gs-backend/manage/taxcalc.html > 옛판.html)
const UI = fs.readFileSync(process.env.EFILE_UI || path.join(ROOT, 'gs-backend/manage/taxcalc.html'), 'utf8');
const ENG = fs.readFileSync(path.join(ROOT, 'gs-backend/manage/taxcalc-engine.html'), 'utf8');

const win = {};
new Function('window', ENG.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, ''))(win);

// 소스에서 맨 앞 칸에 선언된 function NAME(…){…} / const NAME = … ; 를 잘라 낸다(문자열·주석 속 괄호는 건너뜀)
function cut(name) {
  const re = new RegExp('^(function ' + name.replace(/\$/g, '\\$') + '\\(|const ' + name.replace(/\$/g, '\\$') + ' =)', 'm');
  const m = re.exec(UI); if (!m) throw new Error('소스에 없음: ' + name);
  let i = m.index, depth = 0, started = false;
  for (; i < UI.length; i++) {
    const c = UI[i];
    if (c === '/' && UI[i + 1] === '/') { while (i < UI.length && UI[i] !== '\n') i++; continue; }
    if (c === "'" || c === '"' || c === '`') { const q = c; i++; while (i < UI.length && UI[i] !== q) { if (UI[i] === '\\') i++; i++; } continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; started = true; }
    else if (c === '}' || c === ')' || c === ']') { depth--; if (started && depth === 0 && m[1].startsWith('function') && c === '}') { i++; break; } }
    else if (c === ';' && depth === 0 && m[1].startsWith('const')) { i++; break; }
  }
  return UI.slice(m.index, i);
}
const NAMES = ['numVal', 'ihGetEucKrEncodeTable_', 'ihEncodeEucKrBytes_', 'ihPadChar_', 'ihPadNum_', 'ihPadDec_', 'ihDateField_', 'ihOnlyDigits_', 'ihGenderFromRegNo_',
  'TR_EFILE_FORM_CODE_', 'TR_EXPENSE_CODE_NEEDS_DETAIL_', 'TR_EXPENSE_CODE5_', 'TR_STOCK_FILING_TYPE_', 'TR_BUYER_RELATION_LABELS_'];
const TR_FUNCS = (UI.match(/^function (tr[A-Za-z0-9]*_)\(/gm) || []).map((s) => s.slice(9, -1));
let src = 'let _ihEucKrEncodeTable_ = null; const TC_TAX_AGENT_CACHE_ = { taxAgentName: "시험세무사", taxAgentPhone: "0200000000", taxAgentBizNo: "0000000000", taxAgentMgmtNo: "T00000", taxAgentBirth: "19700101", hometaxUserId: "testuser" }; let TR_EF_REP_REGNO_ = "";\n' +
  'function taxAgentField_(id){ return TC_TAX_AGENT_CACHE_[id] || ""; }\n';
NAMES.concat(TR_FUNCS).forEach((n) => { try { src += cut(n) + '\n'; } catch (e) { if (/^TR_/.test(n)) src += 'const ' + n + ' = {};\n'; else throw e; } }); // 옛 판에 없는 표는 빈 표로
src += 'return { ' + TR_FUNCS.concat(['ihPadChar_']).map((n) => n + ': ' + n).join(', ') + ', set: function(k, v){ eval(k + " = v"); } };';
const G = { transferAssets: [], transferContracts: [], transferSellers: [], lastTransferResults_: [], lastStockTransferResult_: null, lastOverseasTransferResult_: null,
  lastTrSplitPaymentInput_: null, lastTrSplitPaymentResult_: null };
const body = 'let ' + Object.keys(G).map((k) => k + ' = G.' + k).join(', ') + ';\n' + src;
const T = new Function('window', 'G', 'TextDecoder', body)(win, G, TextDecoder);

const LEN = { '01': 350, '02': 400, '03': 450, '04': 150, '05': 700, '06': 300, '07': 200 };
let fail = 0, okCount = 0;
const bad = (msg) => { fail++; console.log('  ✗ ' + msg); };
const ok = (msg) => { okCount++; if (process.argv.includes('-v')) console.log('  ✓ ' + msg); };
const txt = (bytes, from, len) => Buffer.from(bytes.slice(from - 1, from - 1 + len)).toString('latin1'); // 숫자·영문 칸 확인용(1부터 센 위치)
const num = (bytes, from, len) => Number(txt(bytes, from, len));

function splitRecords(u8) {
  const out = []; let s = 0;
  for (let i = 0; i < u8.length - 1; i++) if (u8[i] === 0x0D && u8[i + 1] === 0x0A) { out.push(Array.from(u8.slice(s, i))); s = i + 2; i++; }
  if (s !== u8.length) bad('끝 줄에 CR/LF 없음');
  return out;
}
// 03 줄의 칸 위치(1부터): 3 국내외분, 4 세율구분, 5~8 각 13, 9 세율 5, 10~22 각 13, 23 5, 24~30 각 13, 31 5, 32~37 각 13
const POS03 = (() => { const p = {}; let at = 13; [5, 6, 7, 8].forEach((k) => { p[k] = [at, 13]; at += 13; }); p[9] = [at, 5]; at += 5;
  for (let k = 10; k <= 22; k++) { p[k] = [at, 13]; at += 13; } p[23] = [at, 5]; at += 5; for (let k = 24; k <= 30; k++) { p[k] = [at, 13]; at += 13; }
  p[31] = [at, 5]; at += 5; for (let k = 32; k <= 37; k++) { p[k] = [at, 13]; at += 13; } return p; })();
const f03 = (rec, k) => num(rec, POS03[k][0], POS03[k][1]);

function checkFile(label, setup) {
  console.log('■ ' + label);
  Object.keys(G).forEach((k) => T.set(k, Array.isArray(G[k]) ? [] : null));
  setup();
  const recs = splitRecords(T.trBuildEfileBytes_());
  const kinds = {};
  recs.forEach((r, i) => {
    const k = txt(r, 1, 2); kinds[k] = (kinds[k] || 0) + 1;
    if (!LEN[k]) return bad('알 수 없는 자료구분 ' + k + ' (' + (i + 1) + '째 줄)');
    if (r.length !== LEN[k]) bad('자료구분 ' + k + ' ' + (i + 1) + '째 줄 길이 ' + r.length + ' ≠ 규격 ' + LEN[k]); else ok(k + ' 길이 ' + r.length);
    // [2026.10.20] 설정 고정값 — 12 사용자ID(46~65), 27 세무대리인생년월일(296~303)
    if (k === '01') {
      if (txt(r, 46, 20).trim() !== 'testuser') bad('01 12 사용자ID(46~65)에 설정 홈택스 ID 없음: "' + txt(r, 46, 20) + '"'); else ok('01 사용자ID');
      if (txt(r, 296, 8) !== '19700101') bad('01 27 생년월일(296~303) 다름: "' + txt(r, 296, 8) + '"'); else ok('01 생년월일');
    }
    if (k === '01' && (!/^\d{6}$/.test(txt(r, 30, 6)) || !/^\d{8}$/.test(txt(r, 228, 8)))) bad('01 과세기간(30~35)·양도일자(228~235) 비어 있음: "' + txt(r, 30, 6) + '" "' + txt(r, 228, 8) + '"'); else if (k === '01') ok('01 과세기간 ' + txt(r, 30, 6) + ' 양도일자 ' + txt(r, 228, 8));
    if (k === '02' && txt(r, 347, 3) !== 'KR ') bad('02 국적코드(347~349) = "' + txt(r, 347, 3) + '"');
    if (k === '05') { const c62 = txt(r, 653, 2), c64 = txt(r, 659, 2), c65 = txt(r, 661, 2); if (!/^(ZZ|\d\d)$/.test(c62) || !/^(ZZ|\d\d)$/.test(c64) || !/^(ZZ|Z1|Z2|\d\d)$/.test(c65)) bad('05 62·64·65 코드 = ' + c62 + '·' + c64 + '·' + c65); else ok('05 62~65 ' + c62 + '·' + txt(r, 655, 4) + '·' + c64 + '·' + c65); }
    if (k === '07' && !/^\d{5}$/.test(txt(r, 16, 5))) bad('07 구분코드 5자리 아님: "' + txt(r, 16, 5) + '"');
  });
  // 03 묶음: 세율구분 줄 합 = 소계, 소계 합 = 합계, 합계 30 = 19, 지방소득세 줄 0
  const r03 = recs.filter((r) => txt(r, 1, 2) === '03');
  const heads = recs.map((r, i) => (txt(r, 1, 2) === '01' ? i : -1)).filter((i) => i >= 0);
  heads.forEach((h, n) => {
    const end = n + 1 < heads.length ? heads[n + 1] : recs.length;
    const set = recs.slice(h, end).filter((r) => txt(r, 1, 2) === '03');
    const kindsInSet = recs.slice(h, end).map((r) => txt(r, 1, 2));
    if (kindsInSet.some((k, i) => i > 0 && k < kindsInSet[i - 1])) bad('신고서 ' + (n + 1) + ': 자료구분 순서가 거꾸로 — ' + kindsInSet.join(' ')); else ok('자료구분 순서 ' + kindsInSet.join(' '));
    const Z = set.find((r) => txt(r, 10, 3) === 'Z00'), L = set.find((r) => txt(r, 10, 3) === 'Z98');
    if (!Z || !L) return bad('신고서 ' + (n + 1) + ': 합계(Z00)·지방소득세(Z98) 줄 없음');
    if (f03(Z, 30) !== f03(Z, 19)) bad('합계 30(' + f03(Z, 30) + ') ≠ 19(' + f03(Z, 19) + ')'); else ok('합계 30 = 19 = ' + f03(Z, 19));
    if (f03(Z, 21) !== f03(Z, 19) - f03(Z, 20)) bad('합계 21 ≠ 19 − 20');
    if (f03(Z, 17) !== f03(Z, 15) + f03(Z, 16) + f03(Z, 35)) bad('합계 17 ≠ 15 + 16 + 35');
    for (let k = 5; k <= 37; k++) if (f03(L, k) !== 0) { bad('지방소득세 줄 ' + k + '번이 0이 아님: ' + f03(L, k)); break; }
    ['1', '9'].forEach((d) => {
      const sub = set.find((r) => txt(r, 10, 3) === d + '00'); if (!sub) return;
      const det = set.filter((r) => txt(r, 10, 1) === d && txt(r, 11, 2) !== '00');
      if (!det.length) return console.log('  · ' + d + ' 세율구분별 줄 없음(자산 목록과 엔진 거래 수가 다르거나 계산기 범위 밖)');
      [5, 7, 8].forEach((k) => { const s = det.reduce((t, r) => t + f03(r, k), 0); if (s !== f03(sub, k)) bad(d + ' 세율구분별 ' + k + '번 합 ' + s + ' ≠ 소계 ' + f03(sub, k)); else ok(d + ' ' + k + '번 합 = 소계 ' + s); });
      const s10 = det.reduce((t, r) => t + f03(r, 10), 0); if (s10 !== f03(sub, 10)) console.log('  · ' + d + ' 세율구분별 10번 합 ' + s10 + ' ≠ 소계 ' + f03(sub, 10) + ' (감면·§104⑤1호 등 — 확인필요)');
    });
    const subs = set.filter((r) => /^[19]00$/.test(txt(r, 10, 3)));
    [5, 7, 8, 10, 19].forEach((k) => { const s = subs.reduce((t, r) => t + f03(r, k), 0); if (subs.length && s !== f03(Z, k)) bad('소계 ' + k + '번 합 ' + s + ' ≠ 합계 ' + f03(Z, k)); });
    console.log('  03 줄: ' + set.map((r) => txt(r, 10, 3)).join(' '));
  });
  console.log('  자료구분별 줄 수: ' + Object.keys(kinds).sort().map((k) => k + '×' + kinds[k]).join(' ') + (r03.length ? '' : ''));
}

// ---- 합성 사건(고객 정보 아님) ----
const seller = { name: '시험양도인', regNo: '8001011000000', admCd: '1111010100', mtYn: '0', lnbrMnnm: '1', lnbrSlno: '', phone: '0200000000' };
const land = { assetType: 'other', assetKind: 'land', acquisitionDate: '2012-03-01', transferDate: '2025-05-10', transferPrice: 500000000, acquisitionPrice: 200000000, necessaryExpenses: 8000000,
  acquisitionExpenseItems: [{ amount: 5000000, expenseCode: '112', payee: '시험구청' }, { amount: 3000000, expenseCode: '114', payee: '시험법무사', payeeBizRegNo: '0000000000', payDate: '2012-03-01', receiptType: 'taxinvoice' }] };
const shortBldg = { assetType: 'other', assetKind: 'building', acquisitionDate: '2024-01-10', transferDate: '2025-06-10', transferPrice: 300000000, acquisitionPrice: 250000000, necessaryExpenses: 0 };
const house1 = { assetType: 'house', isOneHouseOneFamily: true, residenceYears: 5, isAdjustedArea: true, acquisitionDate: '2018-01-01', transferDate: '2025-07-01', transferPrice: 1500000000, acquisitionPrice: 600000000, necessaryExpenses: 0 };
function realty(assets, sel) {
  const r = win.calculateTransferTaxMultiJS(JSON.parse(JSON.stringify(assets)), {});
  if (!r || r.error) throw new Error('엔진 오류: ' + (r && r.error));
  return { seller: sel || seller, assets: assets, result: r };
}
const ovAssets = [{ wasResidentFiveYearsContinuously: true, transferDate: '2025-07-01', transferPrice: 800000000, acquisitionPrice: 500000000, foreignTaxCreditMethod: 'credit', foreignTaxPaidAmount: 30000000 }];

checkFile('부동산 3건(장기 토지·단기 건물·1세대1주택 고가)', () => {
  T.set('transferSellers', [seller]); T.set('transferAssets', [land, shortBldg, house1]); T.set('transferContracts', []);
  T.set('lastTransferResults_', [realty([land, shortBldg, house1])]);
});
checkFile('부동산 1건 + 국외자산 1건(대표 양도인)', () => {
  T.set('transferSellers', [seller]); T.set('transferAssets', [land, { isOverseasAsset: true, transferDate: '2025-07-01' }]); T.set('transferContracts', []);
  T.set('lastTransferResults_', [realty([land])]);
  T.set('lastOverseasTransferResult_', win.calculateOverseasAssetTransferTaxMultiJS(JSON.parse(JSON.stringify(ovAssets)), {}));
});
checkFile('국외자산만', () => {
  T.set('transferSellers', [seller]); T.set('transferAssets', [{ isOverseasAsset: true, transferDate: '2025-07-01' }]);
  T.set('lastOverseasTransferResult_', win.calculateOverseasAssetTransferTaxMultiJS(JSON.parse(JSON.stringify(ovAssets)), {}));
});
checkFile('주식등(국내 비상장 중소기업, 1건)', () => {
  T.set('transferSellers', [seller]);
  const input = { assetCategory: 'domestic_stock', transferDate: '2025-05-01', acquisitionDate: '2020-01-01', transferPrice: 200000000, acquisitionPrice: 100000000, transferExpenses: 1000000, companyName: '시험주식회사', bizRegNo: '0000000000' };
  T.set('lastStockTransferResult_', { assetCategory: 'domestic_stock', input: input, result: win.calculateStockTransferTaxJS(JSON.parse(JSON.stringify(input))) });
});
// [2026.10.20] 1회째 예정신고(양도인 카드 '전자신고 신고 종류' = 예정) — HEADER 6 '03'(27~28)·7 신고유형 '1'(29)·10 'D03'(38~40), 확정은 01·5·D01
{
  T.set('transferAssets', []);
  const hp = T.trHeadRecord_(Object.assign({}, seller, { filingKind: 'prelim' }), '5', '2026-03-10');
  const hf = T.trHeadRecord_(Object.assign({}, seller, { filingKind: '' }), '5', '2026-03-10');
  if (txt(hp, 27, 2) + txt(hp, 29, 1) + txt(hp, 38, 3) !== '031D03') bad('예정신고 HEADER 6·7·10 다름: ' + txt(hp, 27, 2) + '/' + txt(hp, 29, 1) + '/' + txt(hp, 38, 3)); else ok('예정신고 HEADER 03·1·D03');
  if (txt(hf, 27, 2) + txt(hf, 29, 1) + txt(hf, 38, 3) !== '015D01') bad('확정신고 HEADER 6·7·10 다름: ' + txt(hf, 27, 2) + '/' + txt(hf, 29, 1) + '/' + txt(hf, 38, 3)); else ok('확정신고 HEADER 01·5·D01');
  const hs = T.trHeadRecord_(Object.assign({}, seller, { filingKind: 'prelim' }), '6', '2026-03-10');
  if (txt(hs, 29, 1) !== '2') bad('예정신고 국내주식 신고유형 2 아님: ' + txt(hs, 29, 1)); else ok('예정신고 국내주식 신고유형 2');
}
console.log(fail ? '\n결과: 문제 ' + fail + '건' : '\n결과: 통과(확인 ' + okCount + '건)');
process.exit(fail ? 1 : 0);
