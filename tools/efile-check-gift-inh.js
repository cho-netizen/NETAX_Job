// 증여세·상속세 전자신고 파일 레코드 점검 — node 확인 스크립트 (2026-10-20 전자신고 대조 작업)
// 화면 원본(gs-backend/manage/taxcalc.html)의 gf*·ih* 레코드 함수를 그대로 떼어 와, 엔진(taxcalc-engine.html) 계산 결과로
// 합성 사건(가짜 이름·번호, 신고용 아님)의 전자신고 파일을 만든 뒤 국세청 설명서(증여 2025.10 V1·상속 2026.2)와 맞대 본다.
//  1) 자료구분별 레코드 바이트 길이 = 설명서 '서식별 레코드 길이'
//  2) 코드 칸 값이 별첨 코드표 안에 있는지(관계·재산구분·재산분류·평가기준·특수지·유가증권·채무종류·상속원인·상속대상자 등)
//  3) 설명서의 레코드 사이 일치 조건(예: 03레코드 3번 = 04레코드 22번, 06레코드 32~34번 합계 = 04레코드 17·15·16번, 16레코드 10·11번 = 03레코드 42·43번)
//  4) 금액이 0보다 크면 일자가 필수인 칸(납부방법 일자)
// 사용: node tools/efile-check-gift-inh.js   (실패가 있으면 종료코드 1)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// NX_TAXCALC=다른 경로 — 고치기 전 판(git show HEAD:…)과 비교할 때
const SRC = fs.readFileSync(process.env.NX_TAXCALC || path.join(ROOT, 'gs-backend/manage/taxcalc.html'), 'utf8').replace(/\r\n/g, '\n');
const ENGINE = fs.readFileSync(path.join(ROOT, 'gs-backend/manage/taxcalc-engine.html'), 'utf8').replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

// ───── 원본에서 최상위 function·const 문 떼어 내기(문자열·주석·정규식 안의 괄호는 건너뜀) ─────
function scanEnd(src, start, stopAtSemicolon) {
  let depth = 0, i = start, seenBrace = false;
  let prevSig = '';
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) return src.length; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; prevSig = 'x'; continue;
    }
    if (c === '/' && /[(,=:\[!&|?{};+\-*%<>~^]|^$/.test(prevSig)) { // 정규식 리터럴
      i++; let inClass = false;
      while (i < src.length) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') inClass = true; else if (d === ']') inClass = false; else if (d === '/' && !inClass) break; i++; }
      i++; while (/[a-z]/i.test(src[i])) i++; prevSig = 'x'; continue;
    }
    if (c === '{' || c === '(' || c === '[') { depth++; if (c === '{') seenBrace = true; }
    else if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0 && c === '}' && seenBrace && !stopAtSemicolon) return i + 1; }
    else if (c === ';' && depth === 0 && stopAtSemicolon) return i + 1;
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return src.length;
}
function extractFunction(name) {
  const m = new RegExp('^function ' + name.replace(/\$/g, '\\$') + '\\s*\\(', 'm').exec(SRC);
  if (!m) throw new Error('함수 없음: ' + name);
  return SRC.slice(m.index, scanEnd(SRC, m.index, false));
}
function extractDecl(name) {
  const m = new RegExp('^(?:const|let) ' + name + '\\s*=', 'm').exec(SRC);
  if (!m) throw new Error('선언 없음: ' + name);
  return SRC.slice(m.index, scanEnd(SRC, m.index, true)).replace(/^(const|let) /, 'var ');
}
const efileFns = Array.from(SRC.matchAll(/^function ((?:ih|gf|buildIh)[A-Za-z0-9_]*)\s*\(/gm)).map((m) => m[1]);
const helperFns = ['numVal', 'parseShareFraction_', 'formatDateYmd_', 'taxCalcDeadlineFromMonthEnd_', 'taxCalcShiftDeadline_', 'taxCalcAddYears_',
  'taxCalcDateInRange_', 'taxCalcIsMarriageGiftEligible_', 'taxCalcIsBirthGiftEligible_', 'giftDonorEffectiveRelation_', 'giftPairRelation_',
  'giftValuationAssets_', 'inheritanceValuationAssets_', 'computeValuationAssetValue', 'computeRentalLeaseTotals_', 'computeHeirActualValue_',
  'computeDebtTotal_', 'computeDuesTotal_', 'computeFuneralTotals_', 'taxAgentField_'];
const decls = ['IH_EFILE_RATE_BRACKETS_', 'IH_EFILE_FORM_CODE_', 'IH_ATTACH1_FORM_CODE_', 'IH_ATTACH2_FORM_CODE_', 'IH_ATTACH3_FORM_CODE_',
  'IH_ASSET_TYPE_CODE_MAP_', 'GF_EFILE_FORM_CODE_', 'VALUATION_RATIO_EXEMPT_METHODS', 'TC_TAX_AGENT_CACHE_'];
const code = decls.map(extractDecl).join('\n') + '\nvar _ihEucKrEncodeTable_ = null;\n' +
  helperFns.concat(efileFns.filter((f) => helperFns.indexOf(f) === -1)).map(extractFunction).join('\n');

// ───── 합성 화면 상태(가짜 DOM) ─────
function makeContext(dom) {
  const ctx = { console, TextDecoder, Math, Date, String, Number, Array, Object, JSON, isNaN, parseFloat, parseInt, Uint8Array };
  ctx.window = ctx;
  new Function('window', ENGINE)(ctx);
  ctx.document = { getElementById: (id) => (id in dom ? { value: dom[id], checked: dom[id] === true } : null), querySelector: () => null };
  ctx.taxCalcGiftDoneeIsMinor = () => false;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

// ───── 설명서 레코드 길이·코드표 ─────
const LEN = {
  gift: { '01': 200, '02': 600, '03': 550, '05': 600, '16': 200, '17': 100 }, // 05: 표 누적 600(앞쪽 '서식별 레코드 길이' 표의 550은 설명서 내부 불일치 — 항목표 기준)
  inh: { '01': 200, '02': 700, '03': 700, '04': 500, '05': 900, '06': 600, '07': 300, '08': 300, '09': 300, '10': 800, '11': 500 }
};
const REL = new Set([].concat(
  Array.from({ length: 64 }, (_, i) => String(i).padStart(2, '0')), Array.from({ length: 27 }, (_, i) => String(73 + i)),
  'A0 A1 A2 A3 A4 A5 A6 A7 A8 A9 AA AB AC AD AE AF AG AH AI AJ AK AL AM AN AO AP AQ AR AS AT AU AV AW AX AY'.split(' '),
  'BA BB BC BD BE BF BG BH BI BJ BK BL BM BN BO BP BQ BR BS BT BU BV BW BX BY BZ C1'.split(' '),
  'CA CB CC CD CE CF CG CH CI CJ CK CL CM CN CO CP CQ CR CS CT CU CV CW CX CY CZ DA YA YB YC ZA ZB ZZ'.split(' ')));
const CODES = {
  giftPropClass: new Set(['A11', 'A14', 'A24', 'A25', 'A26', 'B14', 'B21', 'B22', 'B23']),
  inhPropClass: new Set(['A11', 'A12', 'A13', 'A21', 'A22', 'A23', 'A24', 'B11', 'B12', 'B13', 'B21', 'B22']),
  assetType: new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14']),
  basis: new Set(['01', '02', '03', '04', '05', '06', '07', '08']),
  special: new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Z']),
  security: new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09', '99', 'ZZ']),
  debt: new Set(['01', '02', '03', '04', '05', '06', '07', '08', '09']),
  dues: new Set(['01', '02', '03', '04', '05', '06']),
  cause: new Set(['01', '02', '03']),
  heirClass: new Set(['10', '20', '30', '40', '90']),
  deemed: new Set(['10', '20', '30', 'ZZ']),
  yn: new Set(['Y', 'N'])
};

// ───── 레코드 나누기·칸 읽기(바이트 위치, 1부터 세는 누적 길이 기준) ─────
function splitRecords(bytes) {
  const recs = []; let start = 0;
  for (let i = 0; i < bytes.length - 1; i++) if (bytes[i] === 0x0D && bytes[i + 1] === 0x0A) { recs.push(bytes.slice(start, i)); start = i + 2; i++; }
  return recs;
}
const dec = new TextDecoder('euc-kr');
function fld(rec, end, len) { return dec.decode(Uint8Array.from(rec.slice(end - len, end))); } // end = 누적 길이
function num(rec, end, len) { return Number(fld(rec, end, len)); }

let fails = 0, oks = 0;
function check(cond, label) { if (cond) oks++; else { fails++; console.log('  ✗ ' + label); } }

// ═════════ 증여 ═════════
function runGift() {
  console.log('■ 증여세 (설명서 2025.10 V1)');
  const dom = { giftDate: '2026-05-10', giftMarriageDate: '2026-03-01', giftBirthDate: '', giftMarriageBirthSplit: '',
    giftPriorMbMarriageSame: '', giftPriorMbMarriageOther: '', giftPriorMbMarriageOver10: '', giftPriorMbBirthSame: '20000000', giftPriorMbBirthOther: '', giftPriorMbBirthOver10: '' };
  const ctx = makeContext(dom);
  vm.runInContext(`
    valuationAssets = [
      { method: 'apartment', housePrice: 600000000, assetAdmCd: '1168010100', assetMtYn: '0', assetLnbrMnnm: '123', assetLnbrSlno: '4', assetDong: '101동', assetHo: '1502호', assetArea: '84.97', ownershipRatio: '1/2', assetLocation: '합성 아파트',
        donorAllocations: [{ donorIdx: 0, doneeIdx: 0, ratio: '1/1' }] },
      { method: 'listedStock', listedPrice: 50000, listedShares: 1000, donorAllocations: [{ donorIdx: 0, doneeIdx: 0, ratio: '1/2' }, { donorIdx: 1, doneeIdx: 1, ratio: '1/2' }] },
      { method: 'land', landPrice: 100000, landArea: 300, assetAdmCd: '4113510300', assetMtYn: '1', assetLnbrMnnm: '5', donorAllocations: [{ donorIdx: 2, doneeIdx: 2, ratio: '1' }] }
    ];
    giftDonors = [{ name: '합성부', regNo: '6001011000001', relation: '직계존속', genSkip: '0', phone: '0101112222', address: '서울 합성구' },
                  { name: '합성조부', regNo: '4001011000002', relation: '직계존속', genSkip: '1', phone: '0101112223', address: '서울 합성구' },
                  { name: '합성처', regNo: '7001012000003', relation: '배우자', genSkip: '0', phone: '0101112224', address: '서울 합성구' }];
    giftDonees = [{ name: '합성자', regNo: '9501011000004', admCd: '1168010100', mtYn: '0', lnbrMnnm: '1', lnbrSlno: '0', phone: '0102223333', email: 'a@example.com' },
                  { name: '합성손', regNo: '1501013000005', admCd: '1168010100', mtYn: '1', lnbrMnnm: '2', lnbrSlno: '0', phone: '0102223334' },
                  { name: '합성남편', regNo: '6801011000006', admCd: '1168010100', mtYn: '0', lnbrMnnm: '3', lnbrSlno: '0', phone: '0102223335' }];
  `, ctx);
  const E = ctx;
  const v0 = vm.runInContext('Math.round(computeValuationAssetValue(valuationAssets[0])) + Math.round(computeValuationAssetValue(valuationAssets[1]) * 0.5)', ctx);
  const v1 = vm.runInContext('Math.round(computeValuationAssetValue(valuationAssets[1]) * 0.5)', ctx);
  const v2 = vm.runInContext('Math.round(computeValuationAssetValue(valuationAssets[2]))', ctx);
  const r0 = E.calculateGiftTaxJS({ giftAmount: v0, relation: '직계존속', giftDate: dom.giftDate, isMarriageGift: true, priorMarriageOrBirthDeductionUsed: 20000000,
    priorMarriageOrBirthDeductionSameDonor10y: 20000000, priorGiftAmount: 50000000, priorPaidTax: 0, relationDeductionLimit: 50000000 });
  const r1 = E.calculateGiftTaxJS({ giftAmount: v1, relation: '직계존속', giftDate: dom.giftDate, isGenerationSkip: true });
  const r2 = E.calculateGiftTaxJS({ giftAmount: v2, relation: '배우자', giftDate: dom.giftDate });
  ctx.__r = [r0, r1, r2]; ctx.__amt = [v0, v1, v2];
  vm.runInContext(`
    lastGiftResults_ = [{ donorIdxs: [0], doneeIdx: 0, amount: __amt[0], result: __r[0] }, { donorIdxs: [1], doneeIdx: 1, amount: __amt[1], result: __r[1] }, { donorIdxs: [2], doneeIdx: 2, amount: __amt[2], result: __r[2] }];
    lastInstallmentInput_ = null; lastInstallmentResult_ = null;
    lastSplitPaymentInput_ = { taxType: 'gift', totalTaxAmount: __r[0].납부세액 }; lastSplitPaymentResult_ = { 분납가능여부: true, 분납신청금액: 5000000 };
  `, ctx);
  const bytes = Array.from(vm.runInContext('gfBuildEfileBytes_()', ctx));
  const recs = splitRecords(bytes);
  check(recs.length > 0, '레코드가 하나도 안 만들어짐');
  let lastCalc = null, pairNo = -1;
  const relWant = ['05', '40', '07'];
  recs.forEach((rec, k) => {
    const kind = fld(rec, 2, 2);
    check(LEN.gift[kind] === rec.length, `증여 ${k + 1}번째 레코드(자료구분 ${kind}) 길이 ${rec.length} ≠ 설명서 ${LEN.gift[kind]}`);
    check(!rec.some((b) => b === 0x3F), `증여 자료구분 ${kind}: 인코딩 못 한 글자('?')`);
    if (kind === '01') { pairNo++; check(fld(rec, 9, 7) === 'G101500' && fld(rec, 24, 2) === '33' && fld(rec, 31, 3) === 'D21' && fld(rec, 139, 5) === 'FD021', '증여 01 고정값'); }
    if (kind === '02') {
      check(REL.has(fld(rec, 391, 2)), '증여 02-22 관계코드 코드표 밖: ' + fld(rec, 391, 2));
      check(fld(rec, 391, 2) === relWant[pairNo], `증여 02-22 관계코드(사건 ${pairNo + 1}) 기대 ${relWant[pairNo]} ↔ ${fld(rec, 391, 2)}`);
      check(CODES.special.has(fld(rec, 126, 4).trim()), '증여 02-7 산번지 특수지코드: [' + fld(rec, 126, 4) + ']');
      ['392', '393', '394'].forEach((e) => check(CODES.yn.has(fld(rec, Number(e), 1)), '증여 02 Y/N 칸 ' + e));
      check(fld(rec, 393, 1) === (pairNo === 1 ? 'Y' : 'N'), '증여 02-24 세대생략 구분');
      check(fld(rec, 62, 10).trim().length === 10 && fld(rec, 254, 14).trim() !== '', '증여 02 Not Null(법정동코드·전화)');
    }
    if (kind === '03') {
      lastCalc = rec;
      const f = (end) => num(rec, end, 13);
      check(f(261) === f(274) + f(287) + f(300) + f(313), '증여 03-22 세액공제합계 = 23+24+25+26');
      check(f(313) === f(475) + f(488), '증여 03-26 그밖의공제감면 = 40+41(설명서 검증조건)');
      check(f(235) === f(209) + f(222), '증여 03-20 산출세액계 = 18+19');
      const dates = [[386, 399], [428, 441], [449, 462]];
      dates.forEach(([de, ae]) => { if (f(ae) > 0) check(/^\d{8}$/.test(fld(rec, de, 8)), `증여 03 금액(누적 ${ae}) > 0인데 일자(누적 ${de}) 빈칸`); });
      check(f(399) + f(441) + f(462) === f(378), '증여 03 납부방법 합계 = 31 자진납부할세액');
      if (pairNo === 0) check(f(441) === 5000000 && /^\d{8}$/.test(fld(rec, 428, 8)), '증여 03 분납(첫 쌍) 금액·일자');
      if (pairNo > 0) check(f(441) === 0, '증여 03 분납은 계산기 세액과 같은 쌍에만');
    }
    if (kind === '05') {
      check(CODES.giftPropClass.has(fld(rec, 18, 3)), '증여 05-4 재산구분');
      check(fld(rec, 20, 2) === 'ZZ', '증여 05-5 재산종류 ZZ');
      check(CODES.basis.has(fld(rec, 22, 2)), '증여 05-6 평가기준 ' + fld(rec, 22, 2));
      const t = fld(rec, 503, 2);
      check(CODES.assetType.has(t), '증여 05-35 재산분류 ' + t);
      const re = ['02', '03', '04', '05', '06', '07', '08'].includes(t);
      check(re ? /^\d{10}$/.test(fld(rec, 94, 10)) : fld(rec, 94, 10) === 'ZZZZZZZZZZ', '증여 05-11 법정동코드(부동산=10자리, 그 밖=ZZZZZZZZZZ): ' + fld(rec, 94, 10));
      check(CODES.special.has(fld(rec, 155, 1)), '증여 05-13 산번지');
      check(CODES.security.has(fld(rec, 322, 2)), '증여 05-25 유가증권구분');
      if (t === '09' || t === '10') check(fld(rec, 322, 2) === '01' && Number(fld(rec, 71, 18)) > 0, '증여 05 주식: 유가증권 01·수량');
      if (re) check(Number(fld(rec, 513, 10)) > 0, '증여 05-36 부동산 지분율');
    }
    if (kind === '16' && lastCalc) {
      const f = (end) => num(rec, end, 13);
      check(f(113) === num(lastCalc, 501, 13) && f(126) === num(lastCalc, 514, 13), `증여 16-10·11(${f(113)}/${f(126)}) = 03-42·43(${num(lastCalc, 501, 13)}/${num(lastCalc, 514, 13)})`);
      check(f(74) === 100000000 - (f(22) + f(35) + f(48) + f(61)), '증여 16-7 = 1억 − (3+4+5+6)');
    }
    if (kind === '17') {
      check(['01', '02'].includes(fld(rec, 17, 2)) && /^\d{8}$/.test(fld(rec, 25, 8)) && /^\d{8}$/.test(fld(rec, 33, 8)), '증여 17 구분코드·일자');
      check(num(rec, 46, 13) === v0, '증여 17-7 증여재산가액 = 이번 증여재산가액(공제액 아님)');
    }
  });
}

// ═════════ 상속 ═════════
function runInh() {
  console.log('■ 상속세 (설명서 2026.2)');
  const dom = { ihReporterRegNo: '6501011000011', ihDeathDate: '2026-03-15', ihReporterEmail: '', ihReporterPhone: '0103334444', ihDeceasedName: '합성피상속인',
    ihDeceasedRegNo: '3501011000012', ihDeceasedAdmCd: '1168010100', ihDeceasedMtYn: '1', ihDeceasedLnbrMnnm: '10', ihDeceasedLnbrSlno: '2', ihDeceasedDong: '', ihDeceasedHo: '',
    ihDecedentResident: 'resident', ihHeirForeignAddress: true, ihGrossEstateGeneral: '', ihPublicOrg: '', ihPublicTrust: '', ihPriorGiftedIncluded: '',
    ihNonHeirBequest: '', ihNonTaxable: '', ihChildCount: '2', ihMinorYears: '0', ihElderlyCount: '0', ihDisabledYears: '15', ihForProfitBequest: '', ihForProfitExempted: '', ihAppraisalFee: '' };
  const ctx = makeContext(dom);
  vm.runInContext(`
    valuationAssets = [
      { method: 'apartment', housePrice: 900000000, assetAdmCd: '1168010100', assetMtYn: '0', assetLnbrMnnm: '123', assetLnbrSlno: '4', assetDong: '101동', assetHo: '1502호', assetArea: '84.97', assetLocation: '합성 아파트',
        heirAllocations: [{ heirIdx: 0, ratio: '1/2' }, { heirIdx: 1, ratio: '0.5' }] },
      { method: 'land', landPrice: 200000, landArea: 500, ownershipRatio: '1/3', assetAdmCd: '4113510300', assetMtYn: '1', assetLnbrMnnm: '7', heirAllocations: [{ heirIdx: 2, ratio: '1/1' }] },
      { method: 'listedStock', listedPrice: 30000, listedShares: 2000, heirAllocations: [{ heirIdx: 1, ratio: '1/1' }] },
      { method: 'deemedInheritanceItem', diItemType: 'insurance', diAmount: 100000000, diPolicyholderDecedent: true, heirAllocations: [{ heirIdx: 0, ratio: '1/1' }] },
      { method: 'artwork', directValue: 30000000, directBasisCode: '02', heirAllocations: [{ heirIdx: 2, ratio: '1/1' }] }
    ];
    inheritanceHeirs = [
      { name: '합성처', regNo: '6501012000013', relation: '배우자', isReporter: false, statutoryShareRatio: '3/7', phone: '0105556666' },
      { name: '합성자', regNo: '9001011000011', relation: '자녀', isReporter: true, statutoryShareRatio: '2/7', isCohabitHouse: true, address: '서울 합성구' },
      { name: '합성녀', regNo: '9201012000014', relation: '자녀', statutoryShareRatio: '2/7', isDisabled: true, hasPriorGift: true, priorGiftAmount: 50000000 }
    ];
    inheritanceDebtItems = [{ debtType: 'loan', creditorName: '합성은행', creditorRegNo: '1234567890', startDate: '2020-01-01', amount: 100000000, heirIdx: 1 },
                            { debtType: 'other', creditorName: '합성채권자', startDate: '2024-02-01', amount: 30000000 }];
    inheritanceDuesItems = [{ duesType: 'national', year: '2025', amount: 2000000 }, { duesType: 'local', year: '2025', amount: 1000000, heirIdx: 0 }];
    inheritanceFuneralItems = [{ category: 'general', payee: '합성장례식장', amount: 3000000 }, { category: 'niche', payee: '합성추모공원', amount: 2000000, heirIdx: 2 }];
    taxCalcHeirRegistryIsSpouseOnly = false;
  `, ctx);
  const gross = vm.runInContext('valuationAssets.reduce(function(s,a){ return s + computeValuationAssetValue(a); }, 0)', ctx);
  const r = ctx.calculateInheritanceTaxJS({ taxableEstateAmount: gross - 130000000 - 3000000, deathDate: dom.ihDeathDate, funeralCostAmount: 3000000, funeralNicheCostAmount: 2000000,
    isDecedentResident: true, hasSpouse: true, childCount: 2, spouseActualInheritedAmount: 400000000, priorGiftedAmountIncludedInEstate: 50000000 });
  ctx.__r = r;
  vm.runInContext(`lastInheritanceResult = __r;
    lastInstallmentInput_ = { taxType: 'inheritance' }; lastInstallmentResult_ = { 연부연납대상금액: 30000000 };
    lastSplitPaymentInput_ = null; lastSplitPaymentResult_ = null;`, ctx);
  const errs = vm.runInContext('ihValidateEfileInputs_()', ctx);
  check(Array.isArray(errs) && errs.length === 0, '상속 입력 검증 오류: ' + JSON.stringify(errs));
  const bytes = Array.from(vm.runInContext('ihBuildEfileBytes_()', ctx));
  const recs = splitRecords(bytes);
  const by = {}; recs.forEach((rec) => { const k = fld(rec, 2, 2); (by[k] = by[k] || []).push(rec); });
  recs.forEach((rec, k) => {
    const kind = fld(rec, 2, 2);
    check(LEN.inh[kind] === rec.length, `상속 ${k + 1}번째 레코드(자료구분 ${kind}) 길이 ${rec.length} ≠ 설명서 ${LEN.inh[kind]}`);
    check(!rec.some((b) => b === 0x3F), `상속 자료구분 ${kind}: 인코딩 못 한 글자('?')`);
  });
  ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].forEach((k) => check(by[k] && by[k].length, '상속 자료구분 ' + k + ' 레코드 없음'));
  const h = by['01'][0], bs = by['02'][0], tc = by['03'][0], a1 = by['04'][0], ded = by['11'][0];
  check(fld(h, 128, 6) === '202603', '상속 01-16 제출년월 = 상속개시 년월(설명서)');
  check(fld(h, 140, 1) === 'N' && fld(h, 141, 1) === 'Y', '상속 01-19·20 비거주자·상속인 외국주소');
  check(REL.has(fld(bs, 194, 2)) && fld(bs, 194, 2) === '05', '상속 02-7 피상속인과의관계(신고인 자녀 → 05): ' + fld(bs, 194, 2));
  check(fld(bs, 323, 1) === '1', '상속 02-14 산번지 특수지코드(산 → 1)');
  check(CODES.cause.has(fld(bs, 369, 2)), '상속 02-22 상속원인코드: ' + fld(bs, 369, 2));
  check(CODES.yn.has(fld(bs, 209, 1)), '상속 02-9 사후관리위반 Y/N');
  const T = (end) => num(tc, end, 14);
  check(T(23) === num(a1, 289, 14), '상속 03-3 과세가액 = 04-22');
  check(T(37) === num(ded, 205, 14), '상속 03-4 상속공제 = 11-16');
  check(T(154) === T(168) + T(210) + T(224) + T(238) + T(252), '상속 03-13 세액공제계 = 14+17+18+19+20');
  check(T(168) === T(182) + T(196), '상속 03-14 = 15+16');
  [[344, 358], [366, 380], [388, 402], [410, 424]].forEach(([de, ae]) => { if (T(ae) > 0) check(/^\d{8}$/.test(fld(tc, de, 8)), `상속 03 금액(누적 ${ae}) > 0인데 일자 빈칸`); });
  check(T(358) + T(380) + T(402) + T(424) === T(336), '상속 03 납부방법 합계 = 26 납부할세액');
  if (fld(bs, 209, 1) === 'N') check(T(126) === 0, '상속 03-11 이자상당액은 02-9가 Y일 때만');
  const A = (end) => num(a1, end, 14);
  check(A(51) === A(23) + A(37) && A(65) === A(79) + A(93) + A(107) && A(121) === A(135) + A(149) + A(163) && A(177) === A(191) + A(205) + A(219), '상속 04 합계 칸 산식(5·6·10·14)');
  // 08·09·10 '_계' = 04 공제금액, 06 상속인별 합계 = 04
  (by['08'] || []).forEach((rec) => { check(CODES.debt.has(fld(rec, 17, 2)), '상속 08-4 채무종류 ' + fld(rec, 17, 2)); check(num(rec, 104, 14) === A(219), '상속 08-10 채무_계 = 04-17'); check(fld(rec, 76, 13).trim() !== '', '상속 08-8 채권자번호 Not Null'); });
  (by['09'] || []).forEach((rec) => { check(CODES.dues.has(fld(rec, 17, 2)), '상속 09-4 공과금종류'); check(num(rec, 50, 14) === A(191), '상속 09-8 공과금_계 = 04-15'); });
  const fr = by['10'] || [];
  fr.forEach((rec) => { check(['1', '2'].includes(fld(rec, 16, 1)), '상속 10-4 장례비용구분'); check(num(rec, 587, 14) === A(205), '상속 10-9 장례비용_계 = 04-16'); });
  const gen = fr.filter((rec) => fld(rec, 16, 1) === '1').reduce((s, rec) => s + num(rec, 573, 14), 0);
  check(gen >= 5000000, '상속 10 일반장례비 500만원 미만이면 500만원으로(설명서)');
  const H = by['06'];
  const sum = (end) => H.reduce((s, rec) => s + num(rec, end, 14), 0);
  check(sum(316) === A(219) && sum(330) === A(191) && sum(344) === A(205), `상속 06-32·33·34 합계(${sum(316)}/${sum(330)}/${sum(344)}) = 04-17·15·16(${A(219)}/${A(191)}/${A(205)})`);
  H.forEach((rec) => {
    check(REL.has(fld(rec, 17, 2)), '상속 06-4 관계코드');
    check(CODES.heirClass.has(fld(rec, 297, 2)), '상속 06-28 상속대상자구분');
    ['295', '298', '299'].forEach((e) => check(CODES.yn.has(fld(rec, Number(e), 1)), '상속 06 Y/N ' + e));
    const R = (end) => num(rec, end, 14);
    check(R(294) === R(140) + R(154) - R(168) - R(182) - R(196) - R(210) - R(224) - R(238) + R(252) + R(266) + R(280), '상속 06-26 상속인별 합계 산식');
    if (fld(rec, 298, 1) === 'Y') check(num(rec, 302, 3) > 0, '상속 06-31 장애인 기대여명');
  });
  const pct = H.reduce((s, rec) => s + Number(fld(rec, 126, 8)) / 1e5, 0);
  check(Math.abs(pct - 100) < 0.01, '상속 06-14 상속지분율 합계 100: ' + pct);
  (by['05'] || []).forEach((rec) => {
    const t = fld(rec, 20, 2);
    check(CODES.inhPropClass.has(fld(rec, 18, 3)) && CODES.assetType.has(t) && CODES.basis.has(fld(rec, 22, 2)), '상속 05-4·5·6 코드');
    const re = ['02', '03', '04', '05', '06', '07', '08'].includes(t);
    check(re ? /^\d{10}$/.test(fld(rec, 96, 10)) : fld(rec, 96, 10) === 'ZZZZZZZZZZ', '상속 05-11 법정동코드: ' + fld(rec, 96, 10));
    check(CODES.special.has(fld(rec, 157, 1)) && CODES.security.has(fld(rec, 332, 2)) && CODES.deemed.has(fld(rec, 670, 2)), '상속 05 특수지·유가증권·간주상속 코드');
    if (t === '09' || t === '10') check(Number(fld(rec, 54, 18)) > 0 && num(rec, 86, 14) > 0 && fld(rec, 332, 2) === '01', '상속 05 주식 8 수량·10 단가·25 유가증권(01)');
    if (re) check(Number(fld(rec, 72, 18)) > 0 && Number(fld(rec, 217, 10)) > 0, '상속 05 부동산 9 면적·20 지분율');
    if (t === '14') check(fld(rec, 22, 2) === '02', '상속 05 서화 평가기준 = 직접 고른 근거(02)');
  });
  check((by['05'] || []).some((rec) => fld(rec, 670, 2) === '20'), '상속 05-30 간주상속(보험금 20)');
  (by['07'] || []).forEach((rec) => check(num(rec, 89, 14) > 0, '상속 07-8 상속인 몫 평가가액'));
  const D = (end) => num(ded, end, 14);
  check(D(205) === Math.min(Math.max(D(93), D(23) + D(37) + D(51) + D(65) + D(79)) + D(107) + D(121) + D(135) + D(149) + D(163) + D(177), D(191)), '상속 11-16 상속공제합계 산식(설명서)');
}

runGift();
runInh();
console.log(`\n점검 ${oks + fails}건 — 통과 ${oks}, 실패 ${fails}`);
process.exit(fails ? 1 : 0);
