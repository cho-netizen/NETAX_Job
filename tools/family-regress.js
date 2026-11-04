// [2026.11.01 복잡사건 ⑧] 가족 지도·판정 묶음 시험 — 처음 보는 가상 「한씨 3대」 사건으로 숫자를 본다(드라이브·넥스 없이, 토큰 0)
//  돌리기: node tools/family-regress.js  (저장소 맨 위에서)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'gs-backend');
const src = fs.readFileSync(path.join(root, 'manage/taxcalc-engine.html'), 'utf8').replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
// [2026.11.04 계산 엔진 하나 ③] 서버와 똑같이 — 공휴일 날짜(HolidayDates.js)를 엔진에 넘기고, 판정은 getUiCalcEngine_으로 엔진 이율 표를 읽음
(0, eval)(fs.readFileSync(path.join(root, 'HolidayDates.js'), 'utf8'));
const W = { NX_HOLIDAY_DATES_: NX_HOLIDAY_DATES_ }; new Function('window', src)(W);
global.getUiCalcEngine_ = () => W;
global.caseProcNow_ = () => '2026-11-01 12:00'; global.caseProcToday_ = () => '2026-11-01';
(0, eval)(fs.readFileSync(path.join(root, 'FamilyMap.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(root, 'JudgeMore.js'), 'utf8'));
const calc = (name, input) => {
  if (name === 'calculate_transfer_tax_multi') return W.calculateTransferTaxMultiJS(input.transactions, {});
  const fn = W[name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) + 'JS'];
  return fn ? fn(JSON.parse(JSON.stringify(input))) : null;
};
let bad = 0;
const ok = (cond, what, got) => { console.log((cond ? '✔ ' : '✘ ') + what + (got !== undefined ? ' → ' + got : '')); if (!cond) bad++; };
const won = (n) => Number(n || 0).toLocaleString('ko-KR');

// 가상 가족: 할아버지 한도식(1940)·할머니 박순자, 아들 한민수·며느리 이정아, 손자 한지훈(2000), 사위 쪽 친척 김철(기타친족)
const F = {
  사람: [
    { id: 'p1', 이름: '한도식', 관계: '본인', 생년월일: '1940-02-01', 배우자: 'p2' },
    { id: 'p2', 이름: '박순자', 관계: '배우자', 생년월일: '1943-05-01', 배우자: 'p1' },
    { id: 'p3', 이름: '한민수', 관계: '직계비속', 생년월일: '1968-09-01', 배우자: 'p4' },
    { id: 'p4', 이름: '이정아', 관계: '기타' },
    { id: 'p5', 이름: '한지훈', 관계: '직계비속', 생년월일: '2000-03-01' },
    { id: 'p6', 이름: '김철', 관계: '기타친족' }
  ],
  이전: [
    { id: 't1', 종류: '증여', 날짜: '2017-04-01', 주는: 'p1', 받는: 'p3', 관계: '직계존속', 물건: '현금', 금액: 200000000, 산출세액: 27000000, 신고: '예' },
    { id: 't2', 종류: '증여', 날짜: '2020-06-01', 주는: 'p2', 받는: 'p3', 관계: '직계존속', 물건: '현금', 금액: 100000000, 산출세액: 15000000, 신고: '예' },
    { id: 't3', 종류: '증여', 날짜: '2014-01-10', 주는: 'p1', 받는: 'p3', 관계: '직계존속', 금액: 50000000, 산출세액: 0, 신고: '예' },
    { id: 't4', 종류: '증여', 날짜: '2023-03-01', 주는: 'p1', 받는: 'p5', 관계: '직계존속', 물건: '토지 A', 물건종류: '토지', 금액: 300000000, 산출세액: 51000000, 주는이취득가액: 80000000, 주는이취득일: '1995-05-01', 신고: '예' },
    { id: 't5', 종류: '증여', 날짜: '2022-08-01', 주는: 'p1', 받는: 'p6', 관계: '기타친족', 물건: '상가 B', 금액: 400000000, 산출세액: 70000000, 납부세액: 67900000, 주는이취득가액: 150000000, 주는이취득일: '2005-01-01', 신고: '아니오' },
    { id: 't6', 종류: '상속', 날짜: '2019-11-01', 주는: 'p9', 받는: 'p3', 관계: '직계존속', 물건: '외가 농지', 금액: 120000000 }
  ],
  계획: []
};

const numCases = [['3억 5천만', 350000000], ['1억2,500만원', 125000000], ['5천만', 50000000], ['2천5백만', 25000000], ['200,000,000', 200000000], ['3.5억', 350000000]];
ok(numCases.every(([s, n]) => famNum_(s) === n), '금액 읽기(억·천만·만 섞어 써도)', numCases.map(([s]) => s + '=' + famNum_(s)).join(' · '));
console.log('— ① 지난 증여 합산(상증법 §47②: 10년·같은 증여자+직계존속이면 그 배우자) —');
const pg = famPriorGifts_(F, { date: '2026-12-01', donee: 'p3', donor: 'p1', relation: '직계존속', amount: 300000000 });
ok(pg.합계 === 300000000, '한민수가 2026-12 아버지에게 3억 받을 때 합산(2017 2억 + 2020 어머니 1억, 2014는 10년 밖)', won(pg.합계));
ok(pg.기납부 === 42000000, '기납부세액공제 재료(그때 산출세액 합)', won(pg.기납부));
const g = calc('calculate_gift_tax', { giftAmount: 300000000, relation: '직계존속', priorGiftAmount: pg.합계, priorPaidTax: pg.기납부, giftDate: '2026-12-01' });
ok(g && !g.error, '증여세 계산(합산 반영)', g && (g.error || ('과세표준 ' + won(g.과세표준) + ' · 납부 ' + won(g.납부세액))));

console.log('— ② 상속 가산(§13①: 상속인 10년·그 밖 5년) —');
const pe = famPriorForEstate_(F, { date: '2027-06-01', deceased: 'p1', heirs: ['p2', 'p3'] });
ok(pe && pe.상속인 !== undefined || pe, '한도식 2027-06 사망 가정 — 가산 대상', JSON.stringify({ 상속인: pe.상속인합계 || pe.상속인, 그밖: pe.그밖합계 || pe.그밖, 알림: (pe.알림 || []).length }));

console.log('— ③ 잇기 계산 —');
const c1 = famChainInputs_(F, F.이전[3], { 양도가액: 500000000, 양도일: '2027-03-01' });
ok(c1.tool === 'calculate_transfer_tax_with_carryover', '손자 토지(2023 증여·2027 양도) → 이월과세(§97의2, 10년)', c1.tool);
const r1 = calc(c1.tool, c1.input);
ok(r1 && !r1.error, '이월과세 계산', r1 && (r1.error || JSON.stringify(r1).slice(0, 220)));
const t3n = Object.assign({}, F.이전[3]); delete t3n.주는이취득가액; delete t3n.주는이취득일;
const c1n = famChainInputs_(F, t3n, { 양도가액: 500000000, 양도일: '2027-03-01' });
ok((c1n.gaps || []).length === 2, '주는 사람 취득가액·취득일이 비면 빈 칸 두 개로 알림(엔진 오류 대신 — famChainRun_이 계산 전에 멈춤)', (c1n.gaps || []).join('·'));
const c2 = famChainInputs_(F, F.이전[4], { 양도가액: 450000000, 양도일: '2025-05-01' });
ok(c2.tool === 'bypass', '기타친족 상가(2022 증여·2025 양도) → 우회양도 부인(§101②, 5년)', c2.tool);
const c3 = famChainInputs_(F, F.이전[5], { 양도가액: 200000000, 양도일: '2026-09-01' });
ok(c3.tool === 'calculate_transfer_tax_multi' && c3.input.transactions[0].acquisitionPrice === 120000000, '상속 농지 → 취득가액 = 상속 평가액(시행령 §163⑨)', c3.input && won(c3.input.transactions[0].acquisitionPrice));
const r3 = calc(c3.tool, c3.input);
ok(r3 && !r3.error, '상속 농지 양도 계산', r3 && (r3.error || JSON.stringify(r3).slice(0, 160)));

console.log('— ④ 미래 계획(이전 계획 × 사망 시점 × 증가율) —');
const plan = { 피상속인: 'p1', 배우자: 'p2', 지금: '2026-11-01', 증가율: 3, 재산: { 한도식: 4000000000, 박순자: 600000000 }, 상속인수: { 자녀수: 1 },
  이전계획: [{ 해: 2027, 주는: 'p1', 받는: 'p3', 금액: 500000000, 관계: '직계존속' }, { 해: 2029, 주는: 'p1', 받는: 'p5', 금액: 300000000, 관계: '직계존속' }],
  사망후년: [3, 10, 15], 배우자사망후년: 5 };
const pr = famPlanCompute_(F, plan, calc);
ok(pr.ok, '계획 계산', pr.ok ? '' : pr.error);
if (pr.ok) famPlanLines_(pr).forEach((l) => console.log('   ' + l));
ok(pr.ok && pr.경우.length === 3, '사망 시점 세 경우 견줌');
const pr2 = famPlanCompute_(F, plan, calc);
ok(JSON.stringify(pr2.경우) === JSON.stringify(pr.경우), '다시 돌려도 같은 숫자');

{
  // 사건 35 — 계획의 가업승계 특례 증여 중 사업무관자산 몫(10%)은 일반 증여세·상속 때 보통 사전증여로
  const plan35 = { 피상속인: 'p1', 배우자: 'p2', 지금: '2026-11-01', 증가율: 0, 재산: { 한도식: 20000000000, 박순자: 600000000 }, 상속인수: { 자녀수: 1 },
    이전계획: [{ 해: 2027, 주는: 'p1', 받는: 'p3', 금액: 10000000000, 관계: '직계존속', 특례: '가업승계', 특례입력: { businessOwnershipYearsOfParent: 31, totalAssetValue: 10000000000, nonBizAsset55: 1000000000, doneeAge: 45, donorAge: 70 } }], 사망후년: [5] };
  const q = famPlanCompute_(F, plan35, calc);
  const z = q.ok && q.경우[0], gz = z && (z.계획 || z.한것 || z.withPlan || z);
  const gl = JSON.stringify(q).match(/"특례밖":(\d+)/), gt = JSON.stringify(q).match(/"특례밖증여세":(\d+)/);
  ok(q.ok && gl && Number(gl[1]) === 1000000000 && gt && Number(gt[1]) > 0, '계획 특례 증여의 특례 밖 몫 10억 → 일반 증여세 따로', gl && (gl[1] + ' / ' + (gt && gt[1])));
}
{
  // 사건 35 — 지도에 적힌 지난 특례 증여의 특례 밖 몫: 상속 가산은 10년 안만, 보통 사전증여(priorGiftHeirs)로
  const F35 = { 사람: [{ id: 'k1', 이름: '계아버지', 사망일: '2040-01-01' }, { id: 'k2', 이름: '계아들', 상속인: '예' }], 이전: [{ id: 't1', 종류: '증여', 특례: '가업승계', 날짜: '2025-03-10', 주는: 'k1', 받는: 'k2', 관계: '직계존속', 금액: 12000000000, 산출세액: 980000000, 과세표준: 9800000000, 특례밖금액: 1200000000, 특례밖과세표준: 1150000000, 특례밖산출세액: 285000000 }] };
  const pA = famPriorForEstate_(F35, { date: '2030-08-20', deceased: 'k1' }), iA = {}; famApplyEstatePriors_(iA, pA);
  ok(iA.specialGiftTaxCredit === 980000000 && iA.priorGiftHeirs && iA.priorGiftHeirs[0].priorGiftAmount === 1200000000 && iA.taxableEstateAmount === 12000000000, '10년 안 사망 — 특례 몫 108억은 특례 공제, 밖 몫 12억은 보통 사전증여', JSON.stringify(iA).slice(0, 160));
  const pB = famPriorForEstate_(F35, { date: '2040-01-01', deceased: 'k1' }), iB = {}; famApplyEstatePriors_(iB, pB);
  ok(iB.taxableEstateAmount === 10800000000 && !iB.priorGiftHeirs, '10년 넘어 사망 — 특례 몫만 기간 없이 가산, 밖 몫은 빠짐', JSON.stringify(iB).slice(0, 160));
}
console.log('— ⑤ 판정 묶음 —');
const sf = judgeSelfFarm_({ 양도일: '2026-10-01', 거주지역: '같은 시군구', 직접경작: '예', 경작: [{ 누가: '본인', 시작: '2012-03-01', 끝: '2026-09-30' }], 소득초과해: ['2018', '2019'], 양도일거주자: '예', 양도일농지: '예' });
ok(sf.결론 === '충족', '8년 자경 — 14.6년 중 소득 초과 2년 빼도 8년 넘음', sf.표시);
const sf2 = judgeSelfFarm_({ 양도일: '2026-10-01', 거주지역: '같은 시군구', 경작: [{ 누가: '본인', 시작: '2020-03-01' }] });
ok(sf2.결론 !== '충족', '8년 자경 — 6.6년이면 안 됨', sf2.표시);
const fsw0 = { 양도일: '2025-03-10', 종전경작: [{ 시작: '2019-02-01', 끝: '2025-03-10' }], 종전거주지역: '같은 시군구', 종전거주년수: 6, 직접경작: '예', 종전면적: 3000, 종전가액: 600000000, 새취득일: '2025-11-20', 새취득원인: '매매', 새면적: 2200, 새경작시작일: '2026-03-01', 새거주지역: '연접' };
const fsw = judgeFarmSwap_(Object.assign({}, fsw0, { 기준일: '2026-11-02' }));
ok(fsw.결론 === '충족' && fsw.잠정 === true && fsw.합산8년되는날 === '2028-01-21', '농지대토 — 진행 중이면 잠정·8년 채우는 날', fsw.표시);
const fsw2 = judgeFarmSwap_(Object.assign({}, fsw0, { 새경작끝: '2027-02-28', 기준일: '2028-06-01' }));
ok(fsw2.결론 === '안 됨' && fsw2.추징.length === 1 && fsw2.추징[0].납부기한 === '2027-04-30', '농지대토 — 8년 전 그만두면 추징(달 말일부터 2개월)', fsw2.표시);
const fsw3 = judgeFarmSwap_(Object.assign({}, fsw0, { 새면적: 1500, 새가액: 310000000, 기준일: '2028-06-01' }));
ok(fsw3.결론 === '충족' && !fsw3.잠정, '농지대토 — 면적 미달이어도 가액 1/2 이상이면 됨', fsw3.표시);
const xs1 = judgeTransferScope_({ 유형: '공유물분할', 날짜: '2026-05-10', 지분: 0.5, 받은몫비율: 0.4, 정산금받음: 100000000, 전체시가: 1000000000, 내취득가액: 150000000, 내취득일: '2010-03-01' });
ok(xs1.결론 === '안 됨' && xs1.양도부분.양도가액 === 100000000 && xs1.양도부분.취득가액 === 30000000, '양도여부 — 공유물 분할 정산금 받은 몫은 양도(취득가액 지분 비율)', xs1.표시);
const xs2 = judgeTransferScope_({ 유형: '토지교환', 경계조정목적: '예', 법에따른분할: '예', 분할면적합: 120, 분할전면적합: 1000, 입증자료제출: '예' });
ok(xs2.결론 === '충족' && !xs2.잠정, '양도여부 — 경계 조정 교환 20% 이하면 양도 아님', xs2.표시);
const xs3 = judgeTransferScope_({ 유형: '환지', 환지처분: '예', 공고일: '2026-06-30', 청산금받음: 80000000, 권리가액: 800000000, 내취득가액: 200000000 });
ok(xs3.양도부분 && xs3.양도부분.양도일 === '2026-07-01' && xs3.양도부분.취득가액 === 20000000, '양도여부 — 환지 청산금 부분 양도일 = 공고일 다음 날', xs3.표시);
// [2026.11.02 복잡사건 29] 불복기한 — 주말·공휴일 미룸, 이의 결정기간 지남, 심사·심판 겹침, 경정청구 3개월이 5년 끝으로 잘림
{ const a = judgeAppealDeadline_({ 기준일: '2026-11-02', 조사결과통지받은날: '2026-10-22' }); ok(a.기한[0].마감 === '2026-11-23', '불복기한: 적부심 30일이 토요일 → 월요일', a.기한[0].마감);
  const e = judgeAppealDeadline_({ 기준일: '2027-02-10', 고지서받은날: '2026-12-10', 이의신청일: '2027-01-05' }); const er = e.기한.filter(x => /결정을 못 받음/.test(x.무엇))[0]; ok(er && er.마감 === '2027-05-06', '불복기한: 이의 결정 못 받음 → 결정기간 지난 날부터 90일(어린이날 미룸)', er && er.마감);
  const g = judgeAppealDeadline_({ 기준일: '2027-02-10', 고지서받은날: '2026-12-10', 심사청구일: '2027-01-05', 심판청구일: '2027-01-06' }); ok(g.결론 === '안 됨', '불복기한: 심사·심판 함께 → 안 됨', g.결론);
  const k = judgeAppealDeadline_({ 기준일: '2027-04-25', 법정신고기한: '2022-05-31', 고지서받은날: '2027-04-20' }); const kr = k.기한.filter(x => /늘어난/.test(x.무엇))[0]; ok(kr && kr.마감 === '2027-05-31', '불복기한: 경정청구 3개월이 5년 끝으로 잘림', kr && kr.마감);
  const m = judgeAppealDeadline_({ 기준일: '2026-11-02', 고지서받은날: '2026-10-03' }); ok(m.기한[0].마감 === '2027-01-04', '불복기한: 1월 1일·주말 넘김', m.기한[0].마감); }
// [2026.11.02 복잡사건 30 「서씨 해외양도」] 외화차입 환차익 빼기(소득세법 §118의2 단서)·국외주식 외화 환산
{
  const condo = { wasResidentFiveYearsContinuously: true, transferDate: '2026-06-15', transferPriceForeign: 900000, transferExchangeRate: 1380, acquisitionPriceForeign: 500000, acquisitionExchangeRate: 1100, capitalExpenditureForeign: 50000, capitalExchangeRate: 1200, transferExpensesForeign: 30000, transferExpensesExchangeRate: 1380, foreignTaxPaidAmount: 60000 * 1380 };
  const A = W.calculateOverseasAssetTransferTaxJS(JSON.parse(JSON.stringify(condo)));
  ok(A.양도차익 === 590600000, '국외 콘도 외화 환산 양도차익', won(A.양도차익));
  const D = W.calculateOverseasAssetTransferTaxJS(Object.assign({}, condo, { foreignLoanAmountForeign: 300000, loanExchangeRate: 1100, loanRepayExchangeRate: 1380 }));
  ok(D.양도차익 === 506600000 && D.외화차입환차익_뺌 === 84000000, '외화차입 환차익 8,400만 뺌', won(D.양도차익));
  const D3 = W.calculateOverseasAssetTransferTaxJS(Object.assign({}, condo, { foreignLoanAmountForeign: 300000, loanExchangeRate: 1400, loanRepayExchangeRate: 1380 }));
  ok(D3.양도차익 === 590600000, '환차손이면 뺄 것 없음', won(D3.양도차익));
  const Fx = W.calculateStockTransferTaxJS({ assetCategory: 'foreign_stock', transferDate: '2026-04-01', transferPriceForeign: 100000, transferExchangeRate: 1450, acquisitionPriceForeign: 60000, acquisitionExchangeRate: 1200 });
  ok(Fx.산출세액 === 14100000, '국외주식 외화만 넣어도 환산 계산', won(Fx.산출세액));
}
// [2026.11.02 복잡사건 31 「전씨 상장」] 상장이익 — 실질 증가(시행령 §31의3⑤)·정산기준일(§41의3③)·5년·당초 가산 정산 경우
{
  const b = { originalValuePerShare: 10000, shares: 100000, originalGiftDate: '2022-04-10', listingDate: '2026-07-15', fiscalYearStartDate: '2022-01-01', netIncomePerShareSum: 7600, settlementValuePerShare: 60000 };
  const N1 = W.calculateStockListingGiftTaxJS(b);
  ok(N1.정산기준일 === '2026-10-15' && N1.실질증가이익_1주 === 7600 && N1.증여의제이익 === 4240000000, '상장이익(실질 증가 55개월÷55개월)', won(N1.증여의제이익));
  const N3 = W.calculateStockListingGiftTaxJS(Object.assign({}, b, { earlyEventDate: '2026-09-01' }));
  ok(N3.정산기준일 === '2026-09-01' && N3.실질증가이익_1주 === 7324, '3개월 안 양도면 그 날이 정산기준일', N3.실질증가이익_1주);
  const N4 = W.calculateStockListingGiftTaxJS(Object.assign({}, b, { listingDate: '2027-06-01' }));
  ok(N4.과세대상여부 === false, '5년 지나 상장은 대상 아님');
  const N2 = W.calculateStockListingGiftTaxJS(Object.assign({}, b, { originalGiftTaxableValue: 1000000000, originalDeductions: 50000000 }));
  ok(N2.당초가산_정산계산 && N2.당초가산_정산계산.더낼산출세액 === 1910000000 && N2.산출세액 === 1645000000, '당초 가산 정산 경우 따로(본계산 그대로)', won(N2.당초가산_정산계산.더낼산출세액));
}
// [2026.11.02 복잡사건 32 「하씨 상속 포기·대습」] 법정상속분·배우자공제 비율(상증법 §19① D)
{
  const fam = { 사망일: '2026-05-10', 배우자: { 이름: '박영자' }, 자녀: [{ 이름: '하큰', 포기: '예' }, { 이름: '하둘', 사망일: '2024-02-01', 대습: [{ 이름: '김며늘', 관계: '배우자' }, { 이름: '하손', 관계: '직계비속' }] }, { 이름: '하딸' }] };
  const A = judgeHeirShares_(fam), sh = (r) => r.상속인.map(x => x.이름 + x.지분.표시).join(' ');
  ok(sh(A) === '박영자3/7 김며늘6/35 하손4/35 하딸2/7' && A.배우자비율_공제용.표시 === '1/3', '포기·대습 법정상속분, 배우자공제 비율은 포기 없던 것으로 1/3', sh(A));
  const C = judgeHeirShares_({ 사망일: '2026-05-10', 배우자: { 이름: '박영자' }, 자녀: [{ 이름: '하큰', 포기: '예', 자녀: [{ 이름: '손1' }] }, { 이름: '하딸', 포기: '예' }] });
  ok(sh(C) === '박영자1/1' && !C.다음순위상속, '자녀 모두 포기·배우자 있음 → 배우자 단독', sh(C));
  const D = judgeHeirShares_({ 사망일: '2026-05-10', 자녀: [{ 이름: '하큰', 포기: '예', 자녀: [{ 이름: '손1' }, { 이름: '손2' }] }, { 이름: '하딸', 포기: '예', 자녀: [{ 이름: '손3' }] }] });
  ok(sh(D) === '손11/3 손21/3 손31/3' && D.다음순위상속 && D.세대생략할증.length === 3, '자녀 모두 포기·배우자 없음 → 손자녀 본위(§24·§27)', sh(D));
  const R1 = W.calculateInheritanceTaxJS({ dateOfDeath: '2026-05-10', taxableEstateAmount: 3585000000, priorGiftedAmountIncludedInEstate: 200000000, giftToHeirsWithin10Years: 200000000, hasSpouse: true, spouseActualInheritedAmount: 1500000000, childCount: 3, netFinancialAssets: 800000000, spouseLegalShareRatio: A.엔진칸.spouseLegalShareRatio });
  ok(R1.배우자공제 === 1195000000, '배우자공제 한도 (33.85억+2억)×1/3', won(R1.배우자공제));
}
// [2026.11.02 복잡사건 33 「왕씨 거주자 판정」] 거주자·비거주자(소득령 §2·§2의2·§3·§4, 상증령 §2)
{
  const A = judgeResidency_({ 기준일: '2026-05-01', 목적: '상속세', 외국국적또는영주권: '예', 국내가족: '아니오', 재입국거주예상: '아니오', 국내체류: [{ 입국: '2025-03-01', 출국: '2025-06-10' }, { 입국: '2026-03-01', 출국: '2026-05-01' }] });
  ok(!A.거주자 && A.엔진칸.isDecedentResident === false && A.엔진칸늘, '외국 국적·국내 가족 없음·연 100일 → 비거주 피상속인', A.표시);
  const B = judgeResidency_({ 기준일: '2026-12-31', 목적: '소득세', 국내체류: [{ 입국: '2026-01-10', 출국: '2026-04-30' }, { 입국: '2026-06-01', 출국: '2026-09-15' }] });
  const B2 = judgeResidency_({ 기준일: '2026-12-31', 목적: '상속세', 국내체류: [{ 입국: '2026-01-10', 출국: '2026-04-30' }, { 입국: '2026-06-01', 출국: '2026-09-15' }] });
  ok(B.거주자 && B.거소_해별['2026'] === 216 && !B2.거주자, '한 해 합산 216일 — 소득세 거주자, 상속세는 연속 110일이라 비거주([확인 필요])', B.표시);
  const D = judgeResidency_({ 기준일: '2026-12-31', 목적: '상속세', 국내체류: [{ 입국: '2026-01-01', 출국: '2026-04-01' }, { 입국: '2026-04-20', 출국: '2026-08-01' }], 일시출국: [{ 출국: '2026-04-01', 입국: '2026-04-20' }] });
  ok(D.거주자 && D.거소_최장연속 === 212, '일시 출국은 국내 거소로(§4②)', D.거소_최장연속);
  const E = judgeResidency_({ 기준일: '2026-05-01', 목적: '상속세', 외국국적또는영주권: '예', 국내가족: '아니오', 재입국거주예상: '아니오', 영주귀국사망: '예', 국내체류: [{ 입국: '2026-03-01' }] });
  const G = judgeResidency_({ 기준일: '2026-08-01', 목적: '증여세', 국외이전출국일: '2026-03-01', 국내체류: [{ 입국: '2025-01-01', 출국: '2026-03-01' }] });
  ok(E.거주자 && !G.거주자 && G.엔진칸.isDoneeResident === false && G.알림.some(a => /2026-03-02/.test(a)), '영주귀국 사망 거주자 · 국외 이주 다음 날부터 비거주 수증자', G.알림[0]);
  const H = judgeResidency_({ 기준일: '2026-05-01', 목적: '상속세' });
  ok(!Object.keys(H.엔진칸).length && H.할일.length, '모르면 계산 칸 비우고 확인할 것', H.표시);
  const com = { dateOfDeath: '2026-05-01', hasSpouse: true, spouseActualInheritedAmount: 1000000000, childCount: 2, funeralCostAmount: 10000000, priorGiftedAmountIncludedInEstate: 300000000, giftToHeirsWithin10Years: 300000000, netFinancialAssets: 500000000 };
  const RA = W.calculateInheritanceTaxJS(Object.assign({}, com, { taxableEstateAmount: 3800000000 })), RB = W.calculateInheritanceTaxJS(Object.assign({}, com, { isDecedentResident: false, taxableEstateAmount: 2000000000 }));
  ok(RA.납부세액 === 694520000 && RB.납부세액 === 543200000 && RB.배우자공제 === 0 && RB.장례비용공제 === 0, '비거주 피상속인: 국내 재산·기초공제 2억만', won(RA.납부세액) + ' / ' + won(RB.납부세액));
}
// [2026.11.02 복잡사건 34 「봉씨 상속세 나눠 내기·물건으로 내기」] 연부연납 가산금 날수 셈(상증법 §72·시행령 §69②)·물납 한도(시행령 §73)
{
  const M = W.calculatePropertyInKindPaymentEligibilityJS({ provision: 'general', inheritanceTaxPayable: 1013650000, financialAssetValue: 300000000, listedSecuritiesValue: 100000000, realEstateSecuritiesValue: 4700000000, totalInheritanceValue: 5000000000, unlistedStockValue: 1500000000, inheritanceTaxableValue: 4400000000, heirResidenceHouseNetValue: 500000000 });
  ok(M.물납신청가능세액_한도 === 613650000 && M.비상장주식_물납한도 === 0, '물납 한도 2호(금융·상장 뺌) · 비상장주식 물납 0(§73④)', won(M.물납신청가능세액_한도));
  const A = W.calculateInstallmentPaymentScheduleJS({ taxType: 'inheritance', totalTaxAmount: 413650000, installmentPeriodYears: 10, referenceDate: '2026-09-30' });
  const B = W.calculateInstallmentPaymentScheduleJS({ taxType: 'inheritance', totalTaxAmount: 413650000, installmentPeriodYears: 10, referenceDate: '2026-09-30', filingDeadline: '2026-09-30' });
  ok(A.가산금_합계 === 64115744 && B.가산금_합계 === 64163651 && B.회차별_납부예정세액[2].일수 === 366, '신고기한 주면 날수 셈(윤년 366일), 안 주면 예전대로', won(A.가산금_합계) + ' / ' + won(B.가산금_합계));
  const D = W.calculateInstallmentPaymentScheduleJS({ taxType: 'inheritance', totalTaxAmount: 600000000, installmentPeriodYears: 5, referenceDate: '2023-03-31', filingDeadline: '2023-03-31' });
  ok(D.가산금_합계 === 47182190 && D.회차별_납부예정세액[1].이율구간.length === 2, '지난 기간 이율 바뀜(2.9→3.5→3.1%)은 나눠 셈(§69②)', won(D.가산금_합계));
}
// [2026.11.02 복잡사건 35 「계씨 가업승계 증여 뒤 사망」] 특례 증여 주식의 가업상속(조특령 §27의6⑨)·특례 증여세 공제(조특법 §30의5⑩)
{
  const b35 = { 상속개시일: '2030-08-20', 기업규모: '중소', 업종해당: '예', 경영시작일: '1994-05-01', 상장: '아니오', 지분10년보유: '예', 상속인생년월일: '1980-02-01', 상속인종사년수: 12, 임원취임: '예', 지분율: 0, 대표재직: { 절반이상: '아니오', 십년승계: '아니오', 최근10년중5년: '아니오' } };
  const A = judgeFamilyBiz_(Object.assign({}, b35, { 특례증여: { 증여일: '2025-03-10', 가업자산상당액: 10800000000, 전부증여: '예', 증여전지분율: 70, 처분지분감소: '아니오', 종사또는대표: '예' } }));
  ok(A.결론 === '충족' && A.엔진칸.businessInheritanceDeduction === 10800000000, '특례 증여 주식 전부 → 증여 전 지분으로 보고 대표 재직 요건 안 봄, 공제 대상 108억', A.표시);
  const B = judgeFamilyBiz_(Object.assign({}, b35, { 특례증여: { 증여일: '2025-03-10', 가업자산상당액: 10800000000, 전부증여: '예', 증여전지분율: 70, 처분지분감소: '예', 종사또는대표: '예' } }));
  ok(B.결론 === '안 됨', '받은 주식을 처분하면 특례 증여 주식 가업상속 안 됨(§27의6⑨3호)', B.표시);
  const C = judgeFamilyBiz_(b35);
  ok(C.결론 === '안 됨', '특례 증여가 없으면 대표 재직·지분 요건 그대로', C.표시);
  const I = W.calculateInheritanceTaxJS({ inheritanceDate: '2030-08-20', isDecedentResident: true, hasSpouse: true, childCount: 2, spouseActualInheritedAmount: 1500000000, financialAssetNetAmount: 1000000000, funeralExpenseAmount: 15000000, taxableEstateAmount: 17000000000, priorGiftedAmountIncludedInEstate: 12000000000, giftToHeirsWithin10Years: 12000000000, specialGiftTaxCredit: 980000000, businessInheritanceDeduction: 12600000000 });
  ok(I.특례증여세액공제 === I.산출세액 && I.산출세액 < 980000000, '특례 증여세가 상속세 산출세액보다 크면 산출세액까지만(남는 것 안 돌려줌, §30의5⑩)', won(I.산출세액));
}
{ // [2026.11.02 복잡사건 36 「진씨 미국 콘도」] 국외 증여(국조법 §35) — 누가 어느 법으로
  const fb = { 증여일: '2026-05-15', 증여자거주자: '예' };
  const A = judgeForeignGift_(Object.assign({}, fb, { 수증자거주자: '아니오', 재산소재: '국외', 특수관계: '예', 외국증여세: '부과', 외국납부세액: 120000000, 외국과세표준: 1600000000, 시가근거: { 종류: '감정', 날짜: '2026-09-30' } }));
  ok(A.결론 === '충족' && !A.잠정 && A.납세의무자 === '증여자' && A.엔진칸.isDoneeResident === false && A.엔진칸.foreignTaxPaidAmount === 120000000, '거주자 → 비거주 딸 국외 콘도 → 국조법 §35 증여자 납부', A.표시);
  ok(A.할일.some(x => x.때 === '2026-08-31까지'), '신고기한 = 증여일 달 말일부터 3개월(2026-08-31)');
  const D = judgeForeignGift_(Object.assign({}, fb, { 수증자거주자: '아니오', 재산소재: '국외', 특수관계: '아니오', 외국증여세: '면제' }));
  ok(D.결론 === '안 됨', '비특수관계 + 외국 증여세 면제 → 납부의무 면제(§35③)', D.표시);
  const E = judgeForeignGift_(Object.assign({}, fb, { 수증자거주자: '아니오', 재산소재: '국외', 외국증여세: '부과' }));
  ok(E.잠정 && !E.엔진칸늘, '특수관계 모름 → 잠정, 엔진칸 안 넣음', E.표시);
  const B = judgeForeignGift_(Object.assign({}, fb, { 수증자거주자: '아니오', 재산소재: '국내' }));
  ok(B.적용법 === '상증법' && /수증자/.test(B.납세의무자), '비거주 딸 국내 아파트 → 상증법 §4의2①2호 수증자', B.표시);
  const F = judgeForeignGift_(Object.assign({}, fb, { 수증자거주자: '아니오', 재산소재: '국외', 사인증여: '예' }));
  ok(F.결론 === '안 됨' && F.적용법 === '상속세', '사인증여 → 증여세 아니고 상속세', F.표시);
  const G = judgeForeignGift_(Object.assign({}, fb, { 수증자거주자: '아니오', 재산소재: '국외', 특수관계: '예', 시가근거: { 종류: '감정', 날짜: '2026-12-20' } }));
  ok(G.알림.some(n => /6개월 밖/.test(n)), '감정 7개월 뒤 → 시가로 못 씀(국조령 §71①)');
  const T0 = W.calculateGiftTaxJS(Object.assign({ giftAmount: 1800000000, relation: '직계존속', giftDate: '2026-05-15' }, A.엔진칸));
  const T1 = W.calculateGiftTaxJS(Object.assign({ giftAmount: 1800000000, relation: '직계존속', giftDate: '2026-05-15' }, A.엔진칸, { isDoneeResident: true }));
  ok(T0.외국납부세액공제 === 120000000 && T0.납부세액 === 426800000 && T1.납부세액 === 407400000, '콘도 18억 증여세: 공제 없음 4억2,680만 · 공제 있음(안) 4억740만', T0.납부세액 + ' / ' + T1.납부세액);
}
{ // [2026.11.02 복잡사건 37 「한빛정밀 실권주」] 불균등 증자 — 실권한 주주별로 나눠 공제(§39①1호가·§53·§47②)
  const cb = { caseType: 'low_allocated', preValuePerShare: 50000, preShares: 100000, issuePricePerShare: 10000, increasedShares: 100000, giftDate: '2026-07-01' };
  const L = W.calculateCapitalIncreaseGiftTaxJS(Object.assign({}, cb, { allocatedShares: 90000, relationDeductionLimit: 50000000 }));
  const P = W.calculateCapitalIncreaseGiftTaxJS(Object.assign({}, cb, { allocatedShares: 80000, relationDeductionLimit: 50000000 }));
  const U = W.calculateCapitalIncreaseGiftTaxJS(Object.assign({}, cb, { allocatedShares: 10000, relationDeductionLimit: 10000000 }));
  ok(L.증여의제이익 === 1800000000 && L.납부세액 === 523800000, '실권주 9만주 한 덩어리: 이익 18억 · 납부 5억2,380만', won(L.증여의제이익) + ' · ' + won(L.납부세액));
  ok(P.납부세액 === 446200000 && U.납부세액 === 27160000, '부모 몫(8만주, 공제 5천만) 4억4,620만 + 삼촌 몫(1만주, 공제 1천만) 2,716만', won(P.납부세액) + ' + ' + won(U.납부세액));
}
{ // [2026.11.02 복잡사건 38 「대명산업 초과배당」] 초과배당 바탕 = 받은 배당 − 지분대로 몫(시행령 §31의2②1호)
  const eb = { giftDate: '2027-04-30', excessDividendYear: 2027, disproportionateShortfallRatio: 1 };
  const A = W.calculateExcessDividendGiftTaxJS(Object.assign({}, eb, { receivedDividendAmount: 600000000, proportionalDividendAmount: 150000000, relationDeductionLimit: 50000000 }));
  ok(A.초과배당금액 === 450000000 && A.납부세액 === 38012360, '아들 받은 6억 − 지분대로 1.5억 = 초과 4.5억 · 납부 3,801만', won(A.초과배당금액) + ' · ' + won(A.납부세액));
  const G = W.calculateExcessDividendGiftTaxJS(Object.assign({}, eb, { receivedDividendAmount: 200000000, proportionalDividendAmount: 50000000, relationDeductionLimit: 20000000, isGenerationSkip: true, isMinor: true }));
  ok(G.세대생략할증액 === 2788200 && G.납부세액 === 11719734, '미성년 손자 초과 1.5억 — 세대생략 할증 30%', won(G.납부세액));
  const S2 = W.calculateExcessDividendGiftTaxJS(Object.assign({}, eb, { isFinalSettlement: true, excessDividendBaseAmount: 450000000, relationDeductionLimit: 50000000, comprehensiveIncomeTaxBase: 700000000, initialGiftTaxAmount: 39188000 }));
  ok(S2.소득세상당액 === 183000000 && S2.환급세액 === 6790000, '다음 해 5월 정산(종합과세표준 7억) — 실제 소득세 1.83억, 증여세 679만 돌려받음', won(S2.환급세액));
}
{ // [2026.11.02 복잡사건 39 「석류빌딩 무상사용」] 무상사용자마다·대표사용자(시행령 §27②·시행규칙 §10①)·담보(§27⑤)
  const fu = { giftDate: '2027-03-02', relationDeductionLimit: 50000000 }, F = W.calculateFreePropertyUseGiftTaxJS;
  const S = F(Object.assign({}, fu, { useType: 'occupancy', propertyValue: 1500000000 })), D = F(Object.assign({}, fu, { useType: 'occupancy', propertyValue: 750000000 }));
  ok(S.과세대상여부 && S.오년간현재가치합계 === 113723700 && S.납부세액 === 6181199 && D.과세대상여부 === false, '면적 분명 — 아들 15억 몫 과세(5년 1억1,372만) · 딸 7.5억 몫 1억 미만 제외', won(S.납부세액));
  const R = F(Object.assign({}, fu, { useType: 'occupancy', propertyValue: 2250000000 }));
  ok(R.오년간현재가치합계 === 170585550 && R.납부세액 === 13693597, '면적 불분명 — 대표사용자 아들이 22.5억 전부(1,369만)', won(R.납부세액));
  const C = F(Object.assign({}, fu, { useType: 'collateral', loanAmount: 1000000000, actualInterestPaid: 30000000 }));
  ok(C.담보이용이익 === 16000000 && C.납부세액 === 0, '담보 10억 이익 1,600만(1천만 넘어 과세대상) — 공제 안이라 세액 0', won(C.담보이용이익));
}
{ // [2026.11.02 복잡사건 40 「염씨 만기보험금」] 보험료 낸 사람마다·같은 날 공제 안분(§34①·시행령 §46①)
  const ib = { insuranceProceeds: 300000000, totalPremiumPaid: 200000000, giftDate: '2027-09-01' }, F = W.calculateInsuranceProceedsGiftTaxJS;
  // 2024년 현금 3천만이 먼저 공제 3천만을 씀(§46①1호) → 남은 2천만을 아버지 몫 1.65억 : 할아버지 몫 0.75억으로 안분(§46①2호)
  const Fa = F(Object.assign({}, ib, { premiumPaidByOthers: 100000000, premiumPaidFromGiftedAssets: 30000000, priorGiftAmount: 30000000, relationDeductionLimit: 30000000 + 13750000 }));
  const Gr = F(Object.assign({}, ib, { premiumPaidByOthers: 50000000, relationDeductionLimit: 6250000, isGenerationSkip: true }));
  ok(Fa.증여재산가액 === 165000000 && Fa.산출세액 === 20250000 && Gr.증여재산가액 === 75000000 && Gr.산출세액 === 8937500, '아버지 몫 1.65억(산출 2,025만) · 할아버지 몫 0.75억(할증 넣어 893만) — 공제 안분', won(Fa.산출세액) + ' · ' + won(Gr.산출세액));
  const L = F(Object.assign({}, ib, { premiumPaidByOthers: 150000000, premiumPaidFromGiftedAssets: 30000000, relationDeductionLimit: 50000000 }));
  ok(L.증여재산가액 === 240000000 && !L.세대생략가산액, '한 덩어리로 부르면 할아버지 몫 할증이 빠짐(잘못 부른 경우)', won(L.산출세액));
}
{ // [2026.11.02 복잡사건 41 「방씨 상가 신탁」] 수익권 10년 — 첫 지급일 한 번(시행령 §25①3호) vs 받을 때마다(3호 나목)
  const V = W.calculateTrustBenefitValueJS({ trustPropertyValue: 2500000000, sameBeneficiary: false, beneficiaryType: 'income', annualBenefits: Array.from({ length: 10 }, (_, i) => ({ yearsFromValuation: i + 1, annualBenefit: 100000000, withholdingTaxEquivalent: 0 })) });
  const A = W.calculateTrustIncomeGiftTaxJS({ giftAmount: V.평가액, relationDeductionLimit: 50000000, giftDate: '2027-12-31' });
  ok(V.평가액 === 853020284 && A.납부세액 === 175478902, '위탁자 권리 없음 — 수익권 8억5,302만 한 번 · 납부 1억7,548만', won(A.납부세액));
  let pr = 0, pd = 0, tot = 0;
  for (let y = 1; y <= 10; y++) { const r = W.calculateTrustIncomeGiftTaxJS({ giftAmount: 100000000, priorGiftAmount: pr, priorPaidTax: pd, relationDeductionLimit: 50000000, giftDate: (2026 + y) + '-12-31' }); tot += r.납부세액; pd = r.산출세액; pr += 100000000; }
  ok(tot === 218250000, '위탁자가 수익자 변경권 보유 — 해마다 1억씩 10년 합산 · 합계 2억1,825만', won(tot));
}
{ // [2026.11.02 복잡사건 42 「봉씨 계열사 합병」] 합병후 1주 평가 §28⑤2호 셈 · 증여자별 몫(기준금액은 이익 전체로, §28④)
  const b = { overvaluedPreMergerValuePerShare: 20000, overvaluedPreMergerShareCount: 100000, sharesReceivedByOvervaluedShareholders: 75000, undervaluedPreMergerValuePerShare: 50000, undervaluedPreMergerShareCount: 200000, postMergerShareCount: 275000, giftDate: '2026-08-01' };
  const F = W.calculateMergerBenefitGiftTaxJS(Object.assign({}, b, { largeShareholderSharesReceived: 45000, donorPortionRatio: 0.7, relationDeductionLimit: 50000000, priorGiftAmount: 300000000, priorPaidTax: 40000000 }));
  ok(F.합병후1주당평가액 === 43636 && F.합병이익 === 534545455 && F.납부세액 === 131302727, '합병 — 가중평균 1주 43,636 · 아버지 몫 70% + 10년 합산 · 납부 1억3,130만', won(F.납부세액));
  const b3 = { postMergerValuePerShare: 43636, overvaluedPreMergerValuePerShare: 25227, overvaluedPreMergerShareCount: 100000, sharesReceivedByOvervaluedShareholders: 75000, giftDate: '2026-08-01' };
  const T = W.calculateMergerBenefitGiftTaxJS(Object.assign({}, b3, { largeShareholderSharesReceived: 45000, donorPortionRatio: 0.6, relationDeductionLimit: 50000000 }));
  ok(T.과세대상여부 === true && T.합병이익 === 270000000 && T.납부세액 === 32980000, '합병 — 이익 전체 4.5억 ≥ 3억이면 60% 몫 2.7억도 과세(몫으로 기준을 다시 재지 않음)', won(T.납부세액));
  const Lst = W.calculateMergerBenefitGiftTaxJS(Object.assign({}, b, { largeShareholderSharesReceived: 45000, listedMarketValuePerShare: 38000, relationDeductionLimit: 50000000 }));
  ok(Lst.합병후1주당평가액 === 38000, '합병 — 상장이면 시가와 가중평균 중 적은 값(§28⑤1호)', won(Lst.합병후1주당평가액));
}
{ // [2026.11.02 복잡사건 43 「염씨 주식 소각」] 저가 소각 — 특수관계 대주주만 · 차이 30% 넘으면 기준 0 / 고가 소각 — 평가액이 액면 밑일 때만
  const A = W.calculateCapitalReductionGiftTaxJS({ caseType: 'low_price', valuePerShare: 60000, paymentPerShare: 30000, totalReducedShares: 20000, postReductionOwnershipRatio: 30000 / 80000, relatedReducedShares: 20000, relationDeductionLimit: 50000000, giftDate: '2026-09-01' });
  ok(A.증여의제이익 === 225000000 && A.납부세액 === 24250000, '감자 저가 — 아버지 주식 반값 소각 · 아들 이익 2억2,500만(기준 0) · 납부 2,425만', won(A.납부세액));
  const A2 = W.calculateCapitalReductionGiftTaxJS({ caseType: 'low_price', valuePerShare: 60000, paymentPerShare: 48000, totalReducedShares: 20000, postReductionOwnershipRatio: 0.375, relatedReducedShares: 20000, relationDeductionLimit: 50000000 });
  ok(A2.과세대상여부 === false, '감자 저가 — 차이 20%·이익 9천만 < 3억 → 과세 안 함', won(A2.증여의제이익));
  const B = W.calculateCapitalReductionGiftTaxJS({ caseType: 'high_price', valuePerShare: 60000, paymentPerShare: 90000, ownReducedShares: 20000, faceValuePerShare: 5000, relationDeductionLimit: 50000000 });
  const C = W.calculateCapitalReductionGiftTaxJS({ caseType: 'high_price', valuePerShare: 3000, paymentPerShare: 8000, ownReducedShares: 20000, faceValuePerShare: 5000, relationDeductionLimit: 50000000 });
  ok(B.과세대상여부 === false && C.증여의제이익 === 100000000 && C.납부세액 === 4850000, '감자 고가 — 평가≥액면이면 증여 아님(의제배당) · 결손 법인은 과세 485만', won(C.납부세액));
}
{ // [2026.11.02 복잡사건 44 「구씨 전환사채」] 전환 이익(합산배제 3천만 공제) · 상장이면 전환 후 시가와 적은 값(시행령 §30⑤1호 단서)
  const b = { caseType: 'conversion', preConversionValuePerShare: 40000, preConversionShares: 200000, conversionPricePerShare: 10000, increasedShares: 300000, bondFaceValueAtMaturity: 3090903000, bondIssueRate: 0.01, yearsToMaturityAtAcquisition: 3, giftDate: '2026-10-01', relationDeductionLimit: 50000000, priorGiftAmount: 300000000 };
  const C = W.calculateConvertibleBondGiftTaxJS(b);
  ok(C.교부받은주식1주당가액 === 22000 && C.이자손실분 === 546341545 && C.과세표준 === 3023658455 && C.납부세액 === 1020274350, '전환사채 — 1주 22,000 · 이자손실 5억4,634만 · 합산배제(10년 합산·공제 없음) · 납부 10억2,027만', won(C.납부세액));
  const L = W.calculateConvertibleBondGiftTaxJS(Object.assign({}, b, { listedPostConversionValuePerShare: 18000 }));
  ok(L.교부받은주식1주당가액 === 18000 && L.납부세액 === 552379481, '전환사채 — 상장 전환 후 시가 18,000이 적으면 그 값 · 납부 5억5,238만', won(L.납부세액));
  const R = W.calculateConvertibleBondGiftTaxJS({ caseType: 'conversion_reverse', preConversionValuePerShare: 20000, preConversionShares: 200000, conversionPricePerShare: 50000, increasedShares: 60000, relatedPriorOwnershipRatio: 0.8, listedPostConversionValuePerShare: 30000 });
  ok(R.교부받은주식1주당가액 === 30000 && R.증여의제이익 === 960000000, '전환사채 라목 — 상장 시가가 높으면 그 값', won(R.증여의제이익));
}
{ // [2026.11.02 복잡사건 45 「표씨 농지 형질변경」] 재산가치증가 이익(§42의3) — 취득 후 5년 안 사유만 · 부정이면 기간 없음
  const b = { propertyValueAtIncreaseEvent: 1800000000, acquisitionCost: 300000000, normalAppreciationAmount: 36000000, valueIncreaseContributionAmount: 0, giftDate: '2025-09-15', acquisitionDate: '2022-05-10' };
  const A = W.calculatePropertyValueIncreaseGiftTaxJS(Object.assign({}, b, { increaseEventDate: '2025-09-15' }));
  ok(A.과세대상여부 === true && A.재산가치증가이익 === 1464000000 && A.납부세액 === 401192000, '재산가치증가 — 이익 14억6,400만 · 합산배제 3천만 공제 · 납부 4억119만', won(A.납부세액));
  const B = W.calculatePropertyValueIncreaseGiftTaxJS(Object.assign({}, b, { increaseEventDate: '2027-05-11' }));
  const B2 = W.calculatePropertyValueIncreaseGiftTaxJS(Object.assign({}, b, { increaseEventDate: '2027-05-10' }));
  ok(B.과세대상여부 === false && B2.과세대상여부 === true, '재산가치증가 — 취득 후 5년 넘은 사유는 과세 안 함 · 딱 5년은 과세', String(B.과세대상여부) + '/' + String(B2.과세대상여부));
  const F = W.calculatePropertyValueIncreaseGiftTaxJS(Object.assign({}, b, { increaseEventDate: '2028-01-10', isFraudulentAvoidance: true }));
  ok(F.과세대상여부 === true && F.납부세액 === 401192000, '재산가치증가 — 거짓·부정이면 5년 기간 없음', won(F.납부세액));
}
{ // [2026.11.02 복잡사건 46 「오씨 사업빚 대신 갚음」] 채무 대신 변제(§36) · 10년 합산 공제 · 수증자 무자력 면제(§4의2⑤)
  const F = W.calculateDebtForgivenessGiftTaxJS;
  const A = F({ debtAmount: 400000000, giftDate: '2026-03-10', priorGiftAmount: 50000000, relationDeductionLimit: 50000000 });
  ok(A.과세표준 === 400000000 && A.납부세액 === 67900000, '채무 대신 변제 — 아버지 4억 + 앞선 현금 5천만 합산 · 공제 5천만 · 납부 6,790만', won(A.납부세액));
  const C = F({ debtAmount: 30000000, giftDate: '2026-03-10', priorGiftAmount: 40000000, relationDeductionLimit: 50000000 });
  ok(C.증여재산공제 === 50000000 && C.납부세액 === 1940000, '채무 대신 변제 — 이번 3천만이 공제 한도보다 작아도 합산 7천만과 견줘 공제 5천만', won(C.납부세액));
  const E = F({ debtAmount: 400000000, giftDate: '2026-03-10', priorGiftAmount: 50000000, relationDeductionLimit: 50000000, doneeInsolvent: true, doneeCollectibleAmount: 10000000 });
  ok(E.납부세액 === 10000000 && E.무자력면제세액 === 57900000, '수증자 무자력 — 받을 수 있는 1천만만 내고 5,790만 면제(§4의2⑤)', won(E.납부세액));
}
{ // [2026.11.02 복잡사건 47 「하씨 발달장애 아들 신탁」] 장애인 신탁 불산입(§52의2) — 생애 5억 한도·사후관리 과세 가액(시행령 §45의2⑪)
  const G = W.calculateGiftTaxJS({ giftAmount: 700000000, disabledTrustAmount: 700000000, disabledTrustPriorCumulative: 200000000, relation: '직계비속', giftDate: '2026-04-01', isDoneeResident: true });
  ok(G.장애인신탁재산가액 === 300000000 && G.증여세과세가액 === 400000000 && G.납부세액 === 58200000, '장애인 신탁 — 일반 증여에 7억을 다 넣어도 5억 − 앞선 2억 = 3억만 뺌 · 납부 5,820만', won(G.납부세액));
  const T = W.calculateDisabledPersonTrustExclusionJS, base = { meetsRequirements: true, amount: 700000000, priorCumulativeAmount: 200000000, isSevereDisabled: true };
  const L = T(Object.assign({}, base, { triggerEvent: 'principal_decreased', withdrawalUse: 'living', monthlyLivingAmount: 2000000, livingMonths: 12 }));
  const M = T(Object.assign({}, base, { triggerEvent: 'principal_decreased', withdrawalUse: 'medical', decreasedAmount: 10000000 }));
  ok(L.과세대상가액 === 6000000 && M.즉시과세대상 === false, '장애인 신탁 — 생활비 월 200만 × 12개월은 150만 넘는 600만만 과세 · 중증장애인 의료비 인출은 과세 안 함', won(L.과세대상가액));
  const D = T(Object.assign({}, base, { triggerEvent: 'benefit_diverted', trustValueAtEvent: 760000000, divertedBenefit: 12000000, totalBenefit: 48000000 }));
  ok(D.과세대상가액 === 190000000, '장애인 신탁 — 이익 1/4이 형에게 가면 평가액 7.6억 × 1/4', won(D.과세대상가액));
}
{ // [2026.11.02 복잡사건 48 「모씨 가족회사 땅 현물출자」] 현물출자 이익의 증여(§39의3) — 상장 시가 견줌(시행령 §29의3①·§29② 단서 준용)·모두 영 이하
  const F = W.calculateInKindContributionGiftTaxJS;
  const lo = { caseType: 'low_price', preValuePerShare: 50000, preShares: 200000, issuePricePerShare: 10000, increasedShares: 200000, allocatedShares: 200000, giftDate: '2026-07-01', relationDeductionLimit: 50000000, priorGiftAmount: 200000000 };
  const A = F(lo), B = F(Object.assign({}, lo, { listedPostValuePerShare: 25000 }));
  ok(A.증여의제이익 === 4000000000 && B.현물출자후1주당평가액 === 25000 && B.증여의제이익 === 3000000000, '현물출자 저가 — 산식 3만, 상장 시가 2.5만이면 적은 값 2.5만 → 이익 40억→30억', won(B.증여의제이익));
  const hi = { caseType: 'high_price', preValuePerShare: 50000, preShares: 200000, issuePricePerShare: 100000, increasedShares: 20000, acquiredShares: 20000, relatedShareholderRatio: 0.4, giftDate: '2026-07-01', relationDeductionLimit: 50000000 };
  const H = F(Object.assign({}, hi, { listedPostValuePerShare: 70000 }));
  ok(H.증여의제이익 === 240000000 && H.납부세액 === 27160000, '현물출자 고가 — 상장 시가 7만이 산식보다 크면 큰 값 → (10만−7만)×2만×40% = 2.4억', won(H.증여의제이익));
  const Z = F({ caseType: 'low_price', preValuePerShare: -5000, preShares: 200000, issuePricePerShare: 0, increasedShares: 100000, allocatedShares: 100000 });
  ok(Z.증여의제이익 === 0, '현물출자 — 전·후 1주당 가액 모두 영 이하면 이익 없음', won(Z.증여의제이익));
}
{ // [2026.11.02 복잡사건 49 「임씨 가족법인 유증」] 영리법인 유증(§3의2②·시행령 §3·별지 9호 부표5) — 면제세액 스스로 셈·사람별 면제분·공제 한도 차감
  const F = W.calculateInheritanceTaxJS;
  const b = { dateOfDeath: '2026-05-01', taxableEstateAmount: 6000000000, hasSpouse: true, spouseActualInheritedAmount: 1500000000, childCount: 1, spouseLegalShareRatio: 0.6, forProfitBequestAmount: 1000000000,
    forProfitShareholders: [{ name: '아들', relation: 'heir', ratio: 0.5 }, { name: '며느리', relation: 'heir_spouse', ratio: 0.3 }, { name: '손자', relation: 'descendant', ratio: 0.1 }, { name: '친구', relation: 'other', ratio: 0.1 }] };
  const A = F(b);
  ok(A.영리법인유증.면제세액 === 256250000 && A.영리법인면제분납부세액 === 140625000 && A.영리법인유증.주주별[3].면제분납부세액 === 0, '영리법인 유증 — 면제세액 = 산출세액 × 1/6, (2억5,625만 − 1억) × (아들 50%+며느리 30%+손자 10%) = 1억4,062만5천, 친구 0', won(A.영리법인면제분납부세액));
  const B = F(Object.assign({}, b, { dateOfDeath: '2025-11-01' }));
  ok(B.영리법인면제분납부세액 === 93750000, '영리법인 유증 — 2026-01-02 전 상속개시면 며느리(상속인의 배우자) 몫 빼고 60%', won(B.영리법인면제분납부세액));
  const C = F(Object.assign({}, b, { taxableEstateAmount: 4000000000, forProfitBequestAmount: 3000000000, spouseActualInheritedAmount: 600000000 }));
  ok(C.과세표준 === 3000000000 && C.영리법인면제분납부세액 === 432000000, '영리법인 유증 30억 — 공제 한도 40억 − 30억 = 10억으로 줄어 과세표준 30억', won(C.과세표준));
}
{ // [2026.11.02 복잡사건 50 「노씨 부품회사 일감」] 일감몰아주기(§45의3·시행령 §34의3⑫⑬⑭⑮) — 결산서 숫자로 세후영업이익·두 거래비율, 출자관계별, 신고기한
  const F = W.calculateRelatedPartyTransactionGiftTaxJS;
  const rels = [{ kind: 'direct', ratio: 25, dividend: 100000000, distributable: 10000000000 }, { kind: 'indirect', ratio: 12, corp: '노씨홀딩스' }];
  const b = { companySize: 'medium', operatingProfit: 6000000000, taxAdjustment: 500000000, corporateTaxAfterCredit: 1200000000, corporateTaxableIncome: 8000000000,
    totalSales: 50000000000, relatedSales: 30000000000, excludedSales: 4000000000, excludedSalesForProfit: 2000000000, businessYearEnd: '2025-12-31', shareRelations: rels };
  const A = F(b);
  ok(A.세후영업이익_산정.세후영업이익 === 5083000000 && A.증여의제이익 === 544343091 && A.배당소득공제 === 17559455, '일감몰아주기 — (65억 − 12억 × 65/80) × 0.92 = 50억8,300만, 직접 25%·간접 12−5=7% × (54.55−20)%, 배당 공제 후 5억4,434만', won(A.증여의제이익));
  ok(A.증여시기_신고기한.증여세_신고기한 === '2026-06-30' && F(Object.assign({}, b, { businessYearEnd: '2025-06-30', sincereFilingConfirmation: true })).증여시기_신고기한.증여세_신고기한 === '2026-01-31', '일감몰아주기 — 신고기한 = 법인세 신고기한(3개월, 성실신고 4개월)이 속하는 달 말일부터 3개월', A.증여시기_신고기한.증여세_신고기한);
  const C = F(Object.assign({}, b, { relatedSales: 20000000000 }));
  ok(C.과세대상여부 === false && C.거래비율_산정.과세요건_거래비율 === 34.7826, '일감몰아주기 — 특수관계법인 매출 200억이면 (200−40)÷(500−40) = 34.8% ≤ 중견 40% → 과세 안 됨', String(C.거래비율_산정.과세요건_거래비율));
}
{ // [2026.11.02 복잡사건 51 「석씨 코인 상속」] 가상자산 평가(§65②·시행령 §60②·§58의4) — 날짜로 기간 고르기·잠정 알림·여러 종목·외화
  const F = W.calculateVirtualAssetValueJS;
  const day = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const btc = []; for (let i = -35; i <= 33; i++) btc.push({ date: day('2026-08-15', i), value: 150000000 + i * 200000 });
  const A = F({ isDesignatedExchange: true, valuationDate: '2026-08-15', dailyValues: btc });
  ok(A.평가액 === 150000000 && A.기간.날수 === 63 && A.기간.기간밖_뺀_값 === 6, '가상자산 — 평가기준일 2026-08-15 전·이후 1개월(7-15~9-15, 63일) 값만 평균, 기간 밖 6일 뺌', won(A.평가액));
  const B = F({ isDesignatedExchange: true, valuationDate: '2026-08-15', dailyValues: btc.slice(0, 50) });
  ok(B.평가액 === 148300000 && /잠정/.test(B.주의), '가상자산 — 9-15까지 값이 없으면 잠정 알림(상속개시 직후)', B.주의);
  const C = F({ valuationDate: '2026-08-15', holdings: [{ name: '비트코인', isDesignatedExchange: true, dailyValues: btc, quantity: 2 }, { name: 'USDT', isDesignatedExchange: false, otherReasonableValue: 1.0003, currency: 'USD', exchangeRate: 1385.2, quantity: 50000 }] });
  ok(C.합계 === 369280778 && C.종목별[1].평가액 === 69280778, '가상자산 — 여러 종목 합계, 외화 시세 1.0003달러 × 기준환율 1,385.2원 × 5만 개 = 6,928만', won(C.합계));
}
{ // [2026.11.02 복잡사건 52 「변씨 연금 상속」] 정기금(§65①·시행령 §62) — 월 연금액·종료일로 잔존기간·체증형·보증기간, 사망보험금·연금보험 증여를 정기금으로
  const P = W.calculatePeriodicPaymentRightValueJS;
  const A = P({ annuityType: 'fixed_term', monthlyAmount: 2500000, valuationDate: '2026-03-10', endDate: '2036-04-25', cancellationValue: 240000000 });
  ok(A.평가액 === 257712138 && A.잔존기간.남은_달 === 121 && A.명목합계_할인전 === 302500000 && !A.해지일시금_적용, '정기금 — 월 250만 보증 잔여 121개월: 10년 + 마지막 1개월 몫 연 3% 할인 2억 5,771만(명목 3억 250만 아님, 해지 일시금 2억 4천만보다 큼)', won(A.평가액));
  const B = P({ annuityType: 'lifetime', annualAmount: 12000000, annualGrowthRate: 2, lifeExpectancyYears: 15, guaranteeRemainingYears: 3, cancellationValue: 130000000 });
  ok(B.평가액 === 163365993 && B.연도별_현재가치_내역[1].정기금액 === 12240000, '정기금 — 부부형 종신연금 연 1,200만 해마다 2% 체증, 기대여명 15년', won(B.평가액));
  const D = W.calculateDeemedInheritancePropertyJS({ itemType: 'insurance', wasPolicyholderDecedent: true, periodic: { annuityType: 'fixed_term', monthlyAmount: 2500000, valuationDate: '2026-03-10', endDate: '2036-04-25', cancellationValue: 260000000 } });
  const G = W.calculateInsuranceProceedsGiftTaxJS({ periodic: { annuityType: 'fixed_term', annualAmount: 24000000, remainingYears: 10 }, totalPremiumPaid: 200000000, premiumPaidByOthers: 140000000, relationDeductionLimit: 50000000 });
  ok(D.간주상속재산포함액 === 260000000 && G.증여재산가액 === 143307408 && G.산출세액 === 9330740, '정기금 — 사망 뒤 연금으로 받는 보험금은 해지 일시금(더 큼) 2억 6천만 · 연금 개시로 증여된 아들 연금 10년 × 연 2,400만 평가 2억 472만 × 아버지 보험료 70% = 1억 4,331만', won(G.증여재산가액));
}
{ // [2026.11.02 복잡사건 53 「피씨 주식 포괄적 교환」] 조직변경 등 이익(§42의2·시행령 §32의2·§28⑤ 준용) — 교환비율이 틀어진 포괄적 주식교환
  const O = W.calculateOrgChangeGiftTaxJS;
  const ex = { parentBeforeValue: 500000000, parentSharesBefore: 100000, subsidiaryValue: 5000000000, subsidiarySharesTotal: 100000, newShares: 400000, holders: [{ name: '아들', parentShares: 100000, subsidiaryShares: 20000 }, { name: '아버지', parentShares: 0, subsidiaryShares: 80000 }] };
  const R = O({ subType: 'exchange', exchange: ex, relationDeductionLimit: 50000000 });
  ok(R.이익 === 480000000 && R.교환_계산.교환후_1주당 === 11000 && R.과세표준 === 430000000 && R.교환_계산.증여자별_나눔[0].몫 === 480000000, '포괄적 교환 — 교환 후 1주당 (5억+50억)÷50만 주 = 1만1천, 아들 교환 전 15억 → 교환 후 19.8억 이익 4.8억(모회사 주식 수 변동만 보면 8.8억)', won(R.이익));
  ok(O({ subType: 'exchange', exchange: Object.assign({}, ex, { newShares: 1000000 }), relationDeductionLimit: 50000000 }).이익 === 0, '포괄적 교환 — 공정 비율(1:10)이면 이익 0');
  const L = O({ subType: 'exchange', exchange: Object.assign({}, ex, { parentListed: true, parentListedMarketPrice: 9000 }), relationDeductionLimit: 50000000 });
  ok(L.과세대상여부 === false && L.이익 === 120000000, '포괄적 교환 — 상장 모회사는 시가 9천과 평균 1만1천 중 적은 값(§28⑤1호) → 이익 1.2억 < 기준 3억 과세 안 함', won(L.이익));
}
{ // [2026.11.02 복잡사건 54 「도씨 형제 재분할」] 상속재산 재분할의 증여(§4③·시행령 §3의2·§67①④)
  const R = W.calculateInheritanceRedivisionGiftJS;
  const it = [{ name: '아파트', valueAtRedivision: 1000000000, before: { 장남: 1 }, after: { 장남: 0.6, 차남: 0.4 } }];
  const a = R({ inheritanceDate: '2025-08-20', redivisionDate: '2026-05-15', items: it });
  ok(a.증여여부 === true && a.상속세_신고기한 === '2026-02-28' && a.증여자별[0].증여자 === '장남' && a.증여자별[0].증여재산가액 === 400000000, '재분할 — 신고기한(2026-02-28) 뒤 등기된 상속분을 다시 나눠 차남이 더 받은 4억은 장남에게서 받은 증여');
  ok(R({ inheritanceDate: '2025-08-20', redivisionDate: '2026-02-27', items: it }).증여여부 === false && R({ inheritanceDate: '2025-08-20', redivisionDate: '2026-05-15', items: it, foreignAddress: true }).상속세_신고기한 === '2026-05-31' && R({ inheritanceDate: '2025-08-20', redivisionDate: '2026-05-15', items: it, registeredBeforeRedivision: false }).증여여부 === false, '재분할 — 기한 안·외국 주소 9개월(§67④)·등기 전은 증여 아님');
  const t = R({ inheritanceDate: '2025-08-20', redivisionDate: '2026-05-15', items: [{ name: '토지', valueAtRedivision: 900000000, before: { 장남: '50', 딸: '50' }, after: { 장남: '30', 딸: '30', 차남: '40' } }] });
  ok(t.증여자별.length === 2 && t.증여자별[0].증여재산가액 === 180000000 && t.증여자별[1].증여재산가액 === 180000000 && R({ inheritanceDate: '2025-08-20', redivisionDate: '2026-05-15', items: it, reason: 'recovery_judgment' }).증여여부 === false, '재분할 — 줄어든 사람 둘이면 줄어든 몫 비율로 나눔(1.8억씩), 상속회복 확정판결은 증여 아님');
}
{ // [2026.11.02 복잡사건 55 「남씨 유류분 반환」] 유류분 부족액·반환 차례(민법 §1112~§1116)와 세금 효과
  const F = W.calculateForcedShareReturnJS;
  const hs = [{ name: '어머니', relation: 'spouse', legalShare: 1.5 / 3.5, inherited: 600000000 }, { name: '장남', relation: 'child', legalShare: 1 / 3.5, bequest: 1500000000, gifts: 2000000000, giftValueAtGiftTime: 800000000, giftDate: '2014-05-20' }, { name: '차녀', relation: 'child', legalShare: 1 / 3.5, inherited: 300000000, gifts: 100000000, giftDate: '2020-01-15' }];
  const a = F({ deathDate: '2026-03-10', estateAtDeath: 2500000000, debts: 100000000, heirs: hs });
  ok(a.기초재산 === 4500000000 && a.상속인별[0].부족액 === 364285714 && a.상속인별[2].부족액 === 242857143 && a.반환.every(function (x) { return x.증여에서 === 0; }) && a.상속세_과세가액_조정.순증감 === 0, '유류분 — 기초재산 45억, 어머니 3.64억·차녀 2.43억 부족, 유증에서 먼저 돌려줘(§1116) 장남 증여세 경정 없음·상속세 과세가액 그대로');
  const hs2 = hs.map(function (h) { return h.name === '장남' ? Object.assign({}, h, { bequest: 0 }) : h; });
  const b = F({ deathDate: '2026-03-10', estateAtDeath: 1000000000, debts: 100000000, heirs: hs2 });
  ok(b.반환.length === 2 && b.반환[0].증여에서 === 42857143 && b.반환[0].증여세_경정_줄어드는_증여가액 === 17142857 && b.상속세_과세가액_조정.상속재산에_더하기 === 71428572, '유류분 — 유증 없으면 증여에서 돌려줌: 줄어드는 증여가액은 증여 당시 가액 비율(8억 × 반환비율), 10년 지난 증여라 상속재산에만 더함');
  const c = F({ deathDate: '2026-03-10', estateAtDeath: 0, heirs: [{ name: '형', relation: 'sibling', legalShare: 0.5 }, { name: '동생', relation: 'sibling', legalShare: 0.5, gifts: 0 }], thirdPartyGifts: [{ name: '재단', amount: 300000000 }] });
  ok(c.기초재산 === 0 && c.상속인별[0].유류분액 === 0 && F({ deathDate: '2026-03-10', estateAtDeath: 0, heirs: hs2, thirdPartyGifts: [{ name: '재단', amount: 300000000, bothKnewHarm: true }] }).기초재산 === 2400000000, '유류분 — 형제자매 0(2024 헌재), 제3자 증여는 1년 넘으면 빼고 손해 알고 한 것은 넣음(§1114)');
}
{ // [2026.11.02 복잡사건 56 「노씨 아파트 되돌리기」] 증여재산 반환·재증여(§4④·§68①)
  const R = W.calculateGiftReturnJS, b = { giftDate: '2026-03-12', giftValue: 1200000000 };
  const a = R(Object.assign({}, b, { returnDate: '2026-06-20' })), m = R(Object.assign({}, b, { returnDate: '2026-09-15' })), l = R(Object.assign({}, b, { returnDate: '2026-11-10' }));
  ok(a.증여세_신고기한 === '2026-06-30' && a.당초증여_과세 === false && a.반환_과세 === false && m.기한뒤_3개월 === '2026-09-30' && m.당초증여_과세가액 === 1200000000 && m.반환_과세 === false && l.반환_과세가액 === 1200000000, '증여 반환 — 신고기한 안이면 둘 다 없음, 그 뒤 3개월 안이면 당초만, 더 늦으면 둘 다 과세');
  ok(R({ giftDate: '2026-03-12', returnDate: '2026-04-01', assetType: 'cash', giftValue: 300000000 }).반환_과세 === true && R(Object.assign({}, b, { returnDate: '2026-06-20', decidedBeforeReturn: true })).당초증여_과세 === true, '증여 반환 — 금전은 기한 안이라도 과세, 반환 전 결정받았으면 처음부터 없던 것으로 안 봄');
  ok(R(Object.assign({}, b, { returnDate: '2026-06-20', returnValue: 600000000 })).당초증여_과세가액 === 600000000 && R(Object.assign({}, b, { returnDate: '2026-01-01' })).error, '증여 반환 — 반만 돌려주면 남은 몫 6억만 과세, 반환일이 증여일보다 앞서면 오류');
}
{ // [2026.11.02 복잡사건 57 「권씨 사업기회」] 사업기회 제공 증여의제(§45의4) — 배당 공제 산식(시행령 §34의4⑤)·제외 법인(⑦⑧)·신고기한(②)
  const B = W.calculateBusinessOpportunityGiftTaxJS;
  const ini = { phase: 'initial', profitFromOpportunity: 600000000, shareholderOwnershipRatio: 90, doneeOwnershipRatio: 70, corporateTaxAfterCredit: 120000000, corporateTaxableIncome: 800000000, monthsInInitialYear: 9, fiscalYearEnd: '2026-12-31' };
  const a = B(Object.assign({}, ini, { dividendIncome: 100000000, distributableProfit: 1000000000 }));
  ok(a.배당공제전_증여의제이익 === 1400000000 && a.배당공제 === 200000000 && a.증여의제이익 === 1200000000 && a.신고기한.증여세_신고기한 === '2027-06-30', '사업기회 — 9개월 개시분 14억, 배당 1억 × 14억 ÷ (배당가능이익 10억 × 70%) = 2억 공제, 신고기한 2027-06-30');
  ok(B(Object.assign({}, ini, { providerIsSME: true })).과세대상여부 === false && B(Object.assign({}, ini, { beneficiaryOwnsProviderPct: 50 })).과세대상여부 === false, '사업기회 — 준 법인이 중소기업이거나 수혜법인이 50% 이상 가진 법인이면 과세 안 함');
  const st = B({ phase: 'settlement', shareholderOwnershipRatio: 90, doneeOwnershipRatio: 70, yearlyCorporateTax: [{ profit: 600000000, corporateTaxAfterCredit: 120000000, corporateTaxableIncome: 800000000 }, { profit: 800000000, corporateTaxAfterCredit: 170000000, corporateTaxableIncome: 1000000000 }, { profit: 500000000, corporateTaxAfterCredit: 110000000, corporateTaxableIncome: 700000000 }], initialPhaseCalculatedTax: a.산출세액, initialPhasePaidTax: a.납부세액 });
  ok(st.증여의제이익 === 1093111111 && st.환급세액 === 42755556, '사업기회 — 3년 실제 이익 19억으로 정산 10.93억, 개시 때 낸 세액에서 4,276만 환급');
}
// [2026.11.02 복잡사건 58] 제사용 재산 필지별
{ const N = W.calculateNontaxableInheritancePropertyJS;
  const a = N({ itemType: 'ancestral_property', ritualHosts: ['장남'], items: [{ kind: 'forest', area: 12000, value: 300000000, inheritor: '장남' }, { kind: 'forest', area: 2000, value: 40000000, inheritor: '차남' }, { kind: 'paddy', area: 2500, value: 150000000, inheritor: '장남' }, { kind: 'tools', value: 15000000, inheritor: '장남' }, { kind: 'clan_trust', value: 200000000, inheritor: '장남' }] });
  ok(a.비과세금액 === 210000000 && a.물건별[1].비과세 === 0 && a.상속재산에서_뺄_종중재산 === 200000000, '제사용 재산 — 장남이 받은 금양임야 12,000㎡·묘토 2,500㎡는 면적 비율 뒤 2억, 족보 1천만, 차남 몫 0, 종중 명의신탁 2억은 상속재산에서 뺄 후보', a.비과세금액);
  const s = N({ itemType: 'ancestral_property', ritualHosts: ['장녀', '차녀'], items: [{ kind: 'forest', area: 15000, value: 120000000, inheritor: '장녀' }, { kind: 'paddy', area: 1500, value: 30000000, inheritor: '차녀' }, { kind: 'paddy', area: 1000, value: 20000000, inheritor: '아들' }] });
  ok(s.비과세금액 === 109200000, '제사용 재산 — 공동 주재(장녀·차녀) 임야 15,000㎡는 9,900/15,000 → 7,920만, 논 3천만, 아들 몫 0', s.비과세금액);
  ok(N({ itemType: 'ancestral_property', ritualHosts: ['손자'], ritualHostIsHeir: false, items: [{ kind: 'tools', value: 1, inheritor: '손자' }] }).비과세여부 === false, '제사용 재산 — 주재자가 상속인이 아니면 비과세 아님');
}
// [2026.11.02 복잡사건 59 「진씨 매매 깨짐」] 매매계약 해제 — 잔금 뒤 법정해제는 양도 아님·경정청구 3개월(주말 미룸)·몰취 계약금은 기타소득 / 신고기한 뒤 합의해제는 양도 남음 / 대금 감액은 양도가액만 고침
{ const a = JUDGE_MORE_['계약해제']({ 잔금일: '2026-03-31', 해제일: '2026-07-10', 해제종류: '법정', 신고함: '예', 입장: '매도인', 받은계약금: 100000000, 돌려준금액: 50000000 });
  ok(a.결론 === '충족' && a.기타소득_위약금 === 50000000 && a.할일[0].때 === '2026-10-12까지', '계약해제 — 잔금 뒤 법정해제·경정청구 기한·위약금', a.표시);
  const c = JUDGE_MORE_['계약해제']({ 잔금일: '2025-06-30', 해제일: '2026-08-01', 해제종류: '합의', 법정신고기한: '2026-06-01', 신고함: '예', 부득이사유: '아니오' });
  ok(c.결론 === '안 됨' && !c.할일.length, '계약해제 — 신고기한 뒤 합의해제는 양도 남음', c.표시);
  const d = judgeTransferScope_({ 유형: '대금감액', 잔금일: '2025-11-30', 감액: 150000000, 원래양도가액: 1200000000, 판결일: '2026-09-04' });
  ok(d.결론 === '안 됨' && d.양도부분.양도가액 === 1050000000 && d.할일[0].때 === '2026-12-04까지', '계약해제 — 대금 감액 판결은 양도가액만 고침', d.표시); }
// [2026.11.02 복잡사건 60 「현씨 일가 사고」] 같은 날 사망한 배우자는 상속인 아님·태아 미성년자공제 19년·실종선고일이 세법상 상속개시일
{ const a = judgeHeirShares_({ 사망일: '2026-03-14', 배우자: { 이름: '어머니', 사망일: '2026-03-14' }, 자녀: [{ 이름: '큰아들', 사망일: '2026-03-14', 대습: [{ 이름: '며느리', 관계: '배우자' }, { 이름: '손자', 관계: '직계비속', 생년월일: '2015-08-20' }, { 이름: '태아', 관계: '직계비속', 태아: '예' }] }, { 이름: '작은아들', 생년월일: '2010-05-01' }, { 이름: '딸', 생년월일: '1998-01-10' }] });
  ok(a.엔진칸.hasSpouse === false && !a.상속인.some(x => x.관계 === '배우자') && a.엔진칸.childCount === 2 && a.엔진칸.minorHeirRemainingYears === 32, '상속인 — 동시사망 배우자 빼기·자녀 2·미성년 32년', JSON.stringify(a.엔진칸));
  const b = judgeHeirShares_({ 실종기간만료일: '2020-06-01', 실종선고일: '2026-02-20', 배우자: { 이름: '숙모' }, 자녀: [{ 이름: '사촌', 생년월일: '2012-03-03' }] });
  ok(b.엔진칸.dateOfDeath === '2026-02-20' && b.세법상_상속개시.신고기한 === '2026-08-31' && b.엔진칸.minorHeirRemainingYears === 6, '상속인 — 실종선고일 상속개시·신고기한', JSON.stringify(b.세법상_상속개시));
  const c = judgeHeirShares_({ 사망일: '2026-03-14', 배우자: { 이름: '처', 사망일: '2025-01-01' }, 직계존속: [{ 이름: '부', 사망일: '2020-01-01' }], 형제자매: [{ 이름: '형' }, { 이름: '동생' }] });
  ok(c.상속인.length === 2 && c.상속인[0].관계 === '형제자매', '상속인 — 먼저 사망한 배우자·부모 빼고 형제', c.표시); }
// [2026.11.02 복잡사건 61 「민씨 빚 상속」] 한정승인 — 특별한정승인 기한·채무 초과분 0·사전증여 가산(상속인 10년·사위 5년)·평가기간 안 경락가 = 시가·상속인별 칸
{ const L = judgeLimitedAccept_({ 사망일: '2026-04-20', 한정승인신고일: '2026-08-01', 채무초과안날: '2026-06-15', 중대과실없음: '예', 재산: [{ 이름: '아파트', 평가액: 400000000, 평가방법: '기준시가', 경매일: '2026-09-05', 경락가: 520000000 }, { 이름: '상가', 평가액: 600000000, 평가방법: '기준시가', 경매일: '2026-12-10', 경락가: 700000000 }, { 이름: '예금', 평가액: 50000000 }], 채무: 1300000000, 공과금: 20000000, 장례비: 10000000, 사전증여: [{ 받은사람: '아들', 금액: 300000000, 증여일: '2019-05-01', 과세표준: 250000000, 낸증여세: 40000000 }, { 받은사람: '딸', 금액: 200000000, 증여일: '2017-03-01', 과세표준: 150000000, 낸증여세: 20000000 }, { 받은사람: '사위', 상속인: '아니오', 금액: 100000000, 증여일: '2022-01-01', 과세표준: 90000000, 낸증여세: 9000000 }, { 받은사람: '아들', 금액: 50000000, 증여일: '2015-02-01' }] });
  ok(L.결론 === '충족' && L.특별한정승인 === true && L.상속세과세가액 === 600000000 && L.채무초과액 === 150000000 && L.엔진칸.nonHeirPriorGiftAmountTotal === 100000000 && L.엔진칸.priorGiftHeirs.length === 2 && L.엔진칸.priorGiftHeirs[0].heirTaxableAmount === 300000000, '한정승인 — 특별한정승인·과세가액 6억·사위 5년', L.표시 + ' ' + JSON.stringify(L.엔진칸));
  ok(L.경매양도[0].취득가액 === 520000000 && L.경매양도[0].양도차익 === 0 && L.경매양도[1].양도차익 === 100000000, '한정승인 — 평가기간 안 경락가 = 시가·밖은 차익', JSON.stringify(L.경매양도.map(x => x.양도차익)));
  const L2 = judgeLimitedAccept_({ 사망일: '2026-04-20', 한정승인신고일: '2026-08-01' });
  ok(L2.결론 === '안 됨' && L2.한정승인마감 === '2026-07-20', '한정승인 — 3개월 넘김(특별 사유 없음)', L2.표시); }
// [2026.11.02 복잡사건 62 「곽씨 식당 넘김」] 기타자산 — 영업권(부동산과 함께)·회원권·주주회원권은 양도 기타자산, 영업권 따로·점포 임차권은 기타소득 60%, 설비는 복식부기면 사업소득
{ const G = judgeOtherAsset_({ 양도일: '2026-06-30', 복식부기의무자: '예', 품목: [{ 이름: '식당 영업권', 종류: '영업권', 함께양도부동산: '예', 양도가액: 150000000 }, { 이름: '골프 회원권', 종류: '회원권', 양도가액: 260000000, 취득가액: 220000000, 취득일: '2025-09-10' }, { 이름: '콘도 주주회원권', 종류: '주주회원권', 양도가액: 50000000, 취득가액: 30000000, 취득일: '2010-04-01' }, { 이름: '주방 설비', 종류: '설비', 양도가액: 30000000 }] });
  ok(G.결론 === '충족' && G.품목판정[0].엔진칸.rightOrOtherKind === 'misc_other' && G.품목판정[2].소득 === '양도소득(기타자산)' && G.품목판정[3].소득 === '사업소득' && G.양도소득_합계 === 460000000 && G.할일.length === 1, '기타자산 — 영업권·회원권·주주회원권 양도·설비 사업소득·자가 영업권 취득가액 여쭘', G.표시 + ' ' + JSON.stringify(G.품목판정.map(x => x.소득)));
  const H = judgeOtherAsset_({ 양도일: '2026-06-30', 복식부기의무자: '아니오', 품목: [{ 이름: '권리금', 종류: '점포임차권', 양도가액: 80000000, 실제경비: 10000000 }, { 이름: '면허', 종류: '인허가', 함께양도부동산: '아니오', 양도가액: 5000000 }, { 이름: '집기', 종류: '비품', 양도가액: 2000000 }] });
  ok(H.품목판정[0].기타소득.기타소득금액 === 32000000 && H.품목판정[0].기타소득.원천징수_소득세 === 6400000 && H.품목판정[1].기타소득.분리과세_선택 === true && H.품목판정[2].소득 === '과세 대상 아님', '기타자산 — 점포 임차권 60%·작은 기타소득 분리과세·간편장부 비품', JSON.stringify(H.품목판정.map(x => x.기타소득 || x.소득)));
  const U = judgeOtherAsset_({ 양도일: '2026-06-30', 품목: [{ 이름: '영업권', 종류: '영업권', 양도가액: 100000000, 취득가액: 10000000 }] });
  ok(U.잠정 === true && U.품목판정[0].엔진칸 && U.품목판정[0].기타소득.기타소득금액 === 40000000, '기타자산 — 함께 넘겼는지 모르면 두 경우', U.표시); }
// [2026.11.02 복잡사건 63 「표씨 홀로 사망」] 특별연고자 분여 — 청구 기한·관리인 선임일부터 신고기한·확정이 기한 뒤면 기한 후 신고 할일·경우 셋
{ const R = judgeSpecialRelation_({ 사망일: '2025-03-10', 관리인선임일: '2025-06-02', 수색공고만료일: '2026-07-31', 분여청구일: '2026-09-15', 분여확정일: '2027-03-20', 재산합계: 1150000000, 공과금: 0, 장례비: 15000000, 분여: [{ 이름: '사실혼 배우자', 관계: '사실혼', 금액: 800000000 }, { 이름: '이웃', 관계: '요양간호', 금액: 100000000 }] });
  ok(R.결론 === '충족' && R.청구마감 === '2026-09-30' && R.상속세신고기한 === '2025-12-02' && R.국가귀속 === 235000000 && R.분여합계 === 900000000, '특별연고자 — 기한·국가 귀속', R.표시 + ' ' + R.청구마감 + ' ' + R.상속세신고기한 + ' ' + R.국가귀속);
  ok(R.경우[0].엔진칸.hasSpouse === false && R.경우[1].엔진칸.nonHeirBequestAmount === 900000000 && R.경우[2].엔진칸.taxableEstateAmount === 915000000 && /기한 후 신고/.test(R.할일[0].무엇), '특별연고자 — 경우 셋·기한 후 신고', JSON.stringify(R.경우.map(x => x.엔진칸.taxableEstateAmount)) + R.할일[0].무엇);
  const R2 = judgeSpecialRelation_({ 사망일: '2025-03-10', 수색공고만료일: '2026-07-31', 분여청구일: '2026-10-05', 분여: [{ 이름: '갑', 관계: '사실혼', 금액: 1 }] });
  ok(R2.결론 === '안 됨' && R2.상속세신고기한 === '2025-09-30', '특별연고자 — 청구 늦음·기본 신고기한', R2.표시 + ' ' + R2.상속세신고기한); }
// [2026.11.02 복잡사건 64 「길씨 부도 법인」] 과점주주 제2차 납세의무 — 세목마다 성립일 지분·성립일 뒤 판 지분은 책임 남음·명의주주는 실질소유자 몫·사람별 한도
{ const G = judgeSecondaryLiability_({ 발행주식: 10000, 법인재산충당: 50000000, 통지일: '2026-10-20', 체납: [{ 세목: '부가가치세 2025년 1기', 과세기간끝: '2025-06-30', 금액: 120000000 }, { 세목: '법인세 2025', 과세기간끝: '2025-12-31', 금액: 80000000 }],
  주주: [{ 이름: '길씨', 관계: '본인', 이력: [{ 날짜: '2015-01-01', 주식수: 4000 }, { 날짜: '2025-09-01', 주식수: 2500 }] }, { 이름: '처', 관계: '배우자', 주식수: 1500 }, { 이름: '처남', 관계: '인척', 주식수: 500, 명의만: '예', 실질소유자: '길씨' }, { 이름: '거래처 사장', 관계: '타인', 이력: [{ 날짜: '2015-01-01', 주식수: 4000 }, { 날짜: '2025-09-01', 주식수: 5500 }] }] });
  const v = G.세목별[0], c = G.세목별[1];
  ok(G.결론 === '충족' && G.부족액 === 150000000 && v.과점 === true && v.묶음지분 === 60 && c.과점 === true && c.묶음지분 === 55 && c.기준주주 === '거래처 사장' && c.가족묶음지분 === 45, '제2차 — 부가세 때 가족 과점 60%·법인세 때 가족 45%·남 혼자 55% 과점', JSON.stringify(G.세목별.map(x => [x.묶음지분, x.과점])));
  ok(G.사람별한도['길씨'] === 40500000 && G.사람별한도['처'] === 13500000 && G.사람별한도['거래처 사장'] === 33000000 && !G.사람별한도['처남'] && /2027-01-19|2027-01-18/.test(G.할일[0].때), '제2차 — 한도(부족 9천만 × 45%·15%)·명의주주 실질소유자·불복 90일', JSON.stringify(G.사람별한도) + G.할일[0].때);
  const G2 = judgeSecondaryLiability_({ 상장: '예' }); ok(G2.결론 === '안 됨', '제2차 — 상장 법인 제외', G2.표시); }
// [2026.11.02 복잡사건 65 「봉씨 아들 이름 땅」] 부동산 명의신탁 — 명의신탁이면 신탁자가 양도·명의자 신고분 경정, 명의자가 처분·대금이면 취득 때 증여, 주식은 이 도구 아님
{ const B = judgeNomineeRealty_({ 신탁자: '봉씨', 명의자: '아들', 관계: '자녀', 유형: '등기명의신탁', 자산: '토지', 자금: '신탁자', 처분권: '신탁자', 대금귀속: '신탁자', 취득일: '2015-03-10', 취득가액: 300000000, 양도일: '2026-04-20', 양도가액: 900000000, 명의자신고: '예', 신탁자사망일: '' });
  ok(B.명의신탁 === true && B.결론 === '충족' && B.경우.length === 1 && B.엔진칸.acquisitionPrice === 300000000 && B.할일.some(h => /경정청구/.test(h.무엇)), '명의신탁 — 신탁자 양도·명의자 신고 경정', B.표시 + JSON.stringify(B.할일));
  const B2 = judgeNomineeRealty_({ 신탁자: '봉씨', 명의자: '아들', 관계: '자녀', 자산: '토지', 자금: '신탁자', 처분권: '명의자', 대금귀속: '명의자', 취득일: '2015-03-10', 취득가액: 300000000, 양도일: '2026-04-20', 양도가액: 900000000 });
  ok(B2.명의신탁 === false && B2.경우.length === 2 && B2.경우[1].취득때증여.증여가액 === 300000000 && B2.알림.some(x => /취득 때 자금/.test(x)), '명의신탁 — 명의자 처분·대금이면 취득 때 증여 경우', B2.표시);
  const B3 = judgeNomineeRealty_({ 자산: '비상장주식' }); ok(B3.결론 === '안 됨', '명의신탁 — 주식은 §45의2 도구로', B3.표시); }
// [2026.11.02 복잡사건 66 「염씨 차명계좌」] 차명계좌 — 계좌별 증여추정(배제기준 20%·2억)·출연자 사망 상속재산·신고 누락 수정신고·50억 넘으면 안 날부터 1년
{ const Y = judgeBorrowedAccount_({ 명의자: '아들', 출연자: '염씨', 관계: '부모', 실소유입증: '모름', 출연자사망일: '2026-02-14', 상속세신고: '예', 신고에넣음: '아니오', 부정행위: '예', 안날: '2026-10-01',
  계좌: [{ 이름: '정기예금', 종류: '예금', 금액: 1200000000, 잔액: 1300000000, 입금일: '2017-04-03', 명의자입증: 150000000 }, { 이름: '증권계좌', 종류: '증권', 금액: 4000000000, 잔액: 4500000000, 입금일: '2019-11-20', 명의자입증: 0, 명의자사용: '예' }, { 이름: '적금', 금액: 100000000, 명의자입증: 85000000, 입금일: '2020-03-01' }] });
  ok(Y.증여추정합계 === 5050000000 && Y.계좌판정[2].증여추정 === false && Y.차명 === false && Y.경우.length === 3, '차명계좌 — 계좌별 증여추정·적금 배제기준 미만·명의자 사용', JSON.stringify(Y.계좌판정.map(a => [a.미입증, a.증여추정])));
  ok(Y.제척기간.length === 3 && Y.제척기간[0].기산일 === '2017-08-01' && Y.제척기간[0].만료_15년 === '2032-07-31' && Y.제척기간[2].기산일 === '2026-09-01' && Y.제척기간[0].특례_만료 === '2027-10-01' && Y.할일.some(h => /수정신고/.test(h.무엇)), '차명계좌 — 제척 15년·1년 특례·수정신고', JSON.stringify(Y.제척기간.map(x => [x.기산일, x.만료_15년, x.특례_만료])));
  const Y2 = judgeBorrowedAccount_({ 관계: '배우자', 실소유입증: '예', 계좌: [{ 이름: '예금', 금액: 300000000, 입금일: '2021-06-01' }], 출연자사망일: '2025-12-03' });
  ok(Y2.차명 === true && Y2.경우[0].상속재산가산 === 300000000 && Y2.할일.some(h => /2026-06-30/.test(h.때)), '차명계좌 — 출연자 재산이면 상속재산·신고기한', Y2.표시 + JSON.stringify(Y2.할일)); }
// [2026.11.03 복잡사건 67 「위씨 상속세 대납」] 세금대납 — 장남이 상속세 전부를 내 연대납부 한도를 넘은 금액은 덜 낸 상속인에게 증여, 증여자가 낸 증여세는 연대납부 사유 없으면 다시 증여
{ const Y = judgeTaxProxyPay_({ 종류: '상속세', 상속세: { 납부일: '2026-08-20', 상속인: [{ 이름: '어머니', 받은자산: 3000000000, 부채: 200000000, 몫세액: 1000000000, 낸세액: 0, 대납자와관계: '자녀' }, { 이름: '장남', 받은자산: 1000000000, 몫세액: 400000000, 낸세액: 2000000000 }, { 이름: '차남', 받은자산: 500000000, 가산증여세: 20000000, 몫세액: 300000000, 낸세액: 0, 대납자와관계: '형제' }, { 이름: '딸', 받은자산: 500000000, 몫세액: 300000000, 낸세액: 0, 대납자와관계: '형제' }] } });
  ok(Y.상속인판정[1].한도 === 600000000 && Y.상속인판정[1].한도넘음 === 1000000000 && Y.경우.length === 3 && Y.경우[0].엔진칸.giftAmount === 625000000 && Y.경우[1].엔진칸.relation === '기타친족' && Y.할일[0].때.indexOf('2026-11-30') === 0, '세금대납 — 한도 넘은 상속세 대납은 덜 낸 비율로 증여', JSON.stringify(Y.경우.map(c => c.엔진칸)));
  const Z = judgeTaxProxyPay_({ 종류: '증여세', 증여세: { 관계: '아버지', 원증여가액: 1000000000, 원증여과세표준: 950000000, 증여세: 225000000, 대신낸금액: 225000000, 납부일: '2026-06-30', 수증자상황: '없음' } });
  ok(Z.연대납부 === false && Z.경우[0].엔진칸.priorGiftAmount === 1000000000 && Z.경우[0].엔진칸.priorPaidTax === 225000000 && Z.경우[0].엔진칸.relation === '직계존속', '세금대납 — 증여자가 낸 증여세는 합산 증여', JSON.stringify(Z.경우));
  const Z2 = judgeTaxProxyPay_({ 종류: '증여세', 증여세: { 대신낸금액: 50000000, 수증자상황: '비거주', 증여조문: '§45의3' } });
  ok(Z2.연대납부 === false && Z2.경우.length === 1, '세금대납 — 비거주라도 단서 조문(§45의3)이면 연대납부 아님', JSON.stringify(Z2.요건)); }
// [2026.11.03 복잡사건 68 「선씨 세무조사 통지」] 세무조사절차 — 사전통지 20일 모자람·2회 연장을 세무서장이 승인·결과통지 20일 넘김, 상속세 조사는 기간 한도 없음·불복 재조사 결정은 7일·재조사 허용
{ const A = judgeTaxAudit_({ 수입금액: 3000000000, 통지받은날: '2026-09-01', 조사시작일: '2026-09-14', 실제종료일: '2026-11-06', 연장: [{ 일수: 20, 승인: '세무서장' }, { 일수: 20, 승인: '세무서장' }], 중지: [{ 시작: '2026-10-01', 끝: '2026-10-05' }], 결과통지받은날: '2026-12-01', 수정신고일: '2026-09-20' });
  ok(A.요건[0].결과 === '✘' && A.요건[1].결과 === '✘' && A.중지일수 === 5 && A.요건[2].결과 === '✘' && A.할일[0].때.indexOf('2026-12-31') === 0 && A.알림.some(x => /시행령 §29/.test(x)), '세무조사절차 — 사전통지·연장 승인·결과통지 위반', JSON.stringify(A.요건));
  const B = judgeTaxAudit_({ 세목: '상속세', 통지받은날: '2026-10-01', 조사시작일: '2026-10-09', 재조사결정: '예', 실제종료일: '2026-12-20', 같은세목기간조사: '예', 재조사사유: '친구 제보' });
  ok(B.사전통지기한일수 === 7 && B.요건[0].결과 === '✔' && /5호/.test(B.기간예외) && B.요건[2].결과 === '✔', '세무조사절차 — 상속세 조사 한도 없음·불복 재조사 결정 7일·재조사 허용', JSON.stringify(B.요건));
  const C = judgeTaxAudit_({ 통지받은날: '2026-03-02', 조사시작일: '2026-03-30', 같은세목기간조사: '예', 재조사사유: '친구 제보' });
  ok(C.요건[0].결과 === '✔' && C.요건[1].결과 === '✘', '세무조사절차 — 사유 없는 중복조사', JSON.stringify(C.요건)); }
// [2026.11.03 복잡사건 69 「경씨 손녀 결혼」] 생활비교육비 — 학자금 직접 납부 비과세·결혼자금 전세·예물·예금으로 남은 생활비·혼주 몫 축의금 과세, 부모/조부모 묶음·공제 날짜순, 혼인 예정 수정신고 기한
{ const A = judgeFamilySupportGift_({ 수증자: '경지수', 혼인신고일: '2026-06-01', 피부양: '아니오', 지출: [{ 증여자: '할아버지 경만수', 관계: '할아버지', 항목: '학자금', 금액: 20000000, 날짜: '2026-02-20', 직접지출: '예' }, { 증여자: '할아버지 경만수', 관계: '할아버지', 항목: '결혼자금', 금액: 300000000, 날짜: '2026-04-10', 남은재산: '전세' }, { 증여자: '아버지 경도현', 관계: '아버지', 항목: '혼수', 금액: 15000000, 날짜: '2026-05-02', 직접지출: '예' }, { 증여자: '아버지 경도현', 관계: '아버지', 항목: '예물', 금액: 30000000, 날짜: '2026-05-02' }, { 증여자: '아버지 경도현', 관계: '아버지', 항목: '생활비', 금액: 24000000, 날짜: '2026-05-30', 남은재산: '예금' }], 축의금: { 총액: 120000000, 혼주몫: 80000000, 받은사람: '신부', 쓴곳: '전세보증금' } });
  ok(A.비과세합계 === 20000000 && A.과세합계 === 434000000 && A.모름합계 === 15000000 && A.경우.length === 2 && A.경우[0].엔진칸.isGenerationSkip && A.경우[0].엔진칸.isMarriageGift && A.경우[1].엔진칸.priorRelationDeductionUsedOther === 50000000 && A.경우[1].엔진칸.priorMarriageOrBirthDeductionUsed === 100000000, '생활비교육비 — 경씨 비과세·과세·공제 날짜순', JSON.stringify(A.경우.map(c => c.엔진칸)));
  const B = judgeFamilySupportGift_({ 수증자: '우민재', 피부양: '예', 자녀출생일: ['2026-01-15'], 지출: [{ 증여자: '어머니', 관계: '어머니', 항목: '교육비', 금액: 9000000, 날짜: '2026-03-01', 직접지출: '예' }, { 증여자: '어머니', 관계: '어머니', 항목: '생활비', 금액: 12000000, 날짜: '2026-06-30' }, { 증여자: '아버지', 관계: '아버지', 항목: '현금', 금액: 100000000, 날짜: '2026-09-01', 남은재산: '예금' }] });
  ok(B.비과세합계 === 21000000 && B.과세합계 === 100000000 && B.경우[0].엔진칸.isBirthGift, '생활비교육비 — 피부양 교육비·생활비 비과세, 출산 공제', JSON.stringify(B.경우.map(c => c.엔진칸)));
  const C = judgeFamilySupportGift_({ 수증자: '남', 혼인예정: '예', 지출: [{ 증여자: '아버지', 관계: '아버지', 항목: '결혼자금', 금액: 150000000, 날짜: '2026-08-01', 남은재산: '예금' }] });
  ok(C.경우[0].엔진칸.isMarriageGift && C.할일.some(h => /2028-11-30/.test(h.때)), '생활비교육비 — 혼인 전 공제·2년 안 혼인 못 하면 수정신고 기한', JSON.stringify(C.할일)); }
// [2026.11.03 복잡사건 70 「모씨 증여 날짜 고르기」] 증여시기 — 성년일·10년 합산 빠지는 날·새 기준시가 고시일·유사매매 평가기간, 기준시가가 내리면 고시 뒤로
{ const A = judgeGiftTiming_({ 수증자: '모준혁', 수증자생년월일: '2008-02-10', 증여자관계: '아버지', 재산: [{ 이름: '나대지', 종류: '토지', 지분: 50, 지금기준시가: 400000000, 다음기준시가: 460000000 }, { 이름: '아파트', 종류: '공동주택', 지금기준시가: 600000000, 다음기준시가: 630000000, 시가: [{ 가액: 900000000, 날짜: '2026-10-01', 종류: '유사매매' }] }], 사전증여: [{ 날짜: '2017-03-15', 금액: 50000000, 과세표준: 30000000, 낸세액: 2910000 }], 후보일: ['2026-12-20', '2027-02-15', '2027-03-20', '2027-06-15'], 기준일: '2026-11-03' });
  const a = A.후보판정;
  ok(a[0].미성년 && a[0].합산 === 50000000 && !a[1].미성년 && a[1].합산 === 50000000 && a[2].합산 === 0 && a[2].증여재산가액 === 1100000000 && a[3].증여재산가액 === 860000000 && A.요건[0].결과 === '✔', '증여시기 — 모씨 성년·합산·유사매매·새 기준시가', JSON.stringify(a.map(x => [x.증여일, x.증여재산가액, x.합산, x.미성년])));
  const B = judgeGiftTiming_({ 증여자관계: '어머니', 재산: [{ 이름: '상가', 종류: '상업용건물', 지금기준시가: 500000000, 다음기준시가: 450000000 }], 후보일: ['2026-12-01', '2027-01-10'], 기준일: '2026-11-03' });
  ok(B.후보판정[1].증여재산가액 === 450000000 && B.할일.some(h => /이후/.test(h.때)), '증여시기 — 기준시가 내리면 고시일 뒤로', JSON.stringify(B.할일));
  const C = judgeGiftTiming_({ 증여자관계: '아버지', 재산: [{ 이름: '땅', 종류: '토지', 지금기준시가: 100000000 }], 사전증여: [{ 날짜: '2017-03-15', 금액: 50000000 }], 후보일: ['2027-03-15', '2027-03-16'] });
  ok(C.후보판정[0].합산 === 50000000 && C.후보판정[1].합산 === 0, '증여시기 — 10년 합산 끝날', JSON.stringify(C.후보판정.map(x => x.합산))); }
// [2026.11.03 복잡사건 71 「육씨 상속 평가 고르기」] 상속평가 — 기준시가 vs 감정(시가), 시가 둘 이상이면 가장 가까운 날, 감정 곳수, 양도 취득가액
{ const A = judgeInheritValuation_({ 상속개시일: '2026-07-15', 기준일: '2026-11-03', 자녀수: 2, 다른재산과세가액: 300000000, 대상: [{ 이름: '성남 단독주택', 종류: '단독주택', 기준시가: 900000000, 감정: [{ 가액: 1500000000, 날짜: '2026-10-20' }], 감정수수료: 3500000, 예상양도가: 1650000000, 예상양도일: '2028-05-01', 피상속인취득일: '1998-04-01' }, { 이름: '임야', 종류: '임야', 기준시가: 200000000, 예상양도가: 500000000, 예상양도일: '2029-03-01' }] });
  ok(A.경우.length === 2 && A.경우[1].엔진칸.appraisalFeeAmount === 3500000 && A.경우[1].양도[0].엔진칸.acquisitionPrice === 1500000000 && A.경우[1].양도[1].엔진칸.acquisitionPrice === 200000000 && A.요건[0].결과 === '✘' && A.상속세신고기한 === '2027-01-31', '상속평가 — 육씨 기준시가·감정·신고기한', JSON.stringify(A.경우.map(c => c.상속재산평가)));
  const B = judgeInheritValuation_({ 상속개시일: '2026-03-02', 배우자: '예', 자녀수: 1, 다른재산과세가액: 2500000000, 대상: [{ 이름: '아파트', 종류: '아파트', 기준시가: 1800000000, 유사시가: 2600000000, 감정: [{ 가액: 2500000000, 날짜: '2026-05-10' }, { 가액: 2550000000, 날짜: '2026-05-12' }], 매매: { 가액: 2700000000, 날짜: '2026-08-20' }, 예상양도가: 2700000000 }] });
  ok(B.재산판정[0].시가 === 2525000000 && B.재산판정[0].시가가감정, '상속평가 — 매매보다 가까운 감정이 시가', JSON.stringify(B.재산판정[0]));
  const C = judgeInheritValuation_({ 상속개시일: '2026-01-10', 배우자: '예', 자녀수: 2, 다른재산과세가액: 100000000, 대상: [{ 이름: '상가', 종류: '상가', 기준시가: 1200000000, 감정: [{ 가액: 1800000000, 날짜: '2026-03-01' }], 예상감정가: 1700000000, 예상양도가: 2000000000 }] });
  ok(C.재산판정[0].시가 === 0 && C.경우.length === 2 && C.경우[1].상속재산평가 === 1700000000 && C.알림.some(x => /둘 이상의 평균/.test(x)), '상속평가 — 10억 넘으면 감정 2곳', JSON.stringify(C.경우.map(c => c.이름))); }
// [2026.11.03 복잡사건 72 「봉씨 상가 토지·건물 나눠 적기」] 토지건물구분 — 30% 넘으면 안분, 나눠 적지 않으면 안분, 철거 예외는 취득 쪽만
{ const A = judgeLandBuildingSplit_({ 양도: { 합계: 3000000000, 토지: 1200000000, 건물: 1800000000, 날짜: '2026-12-20', 토지기준시가: 1200000000, 건물기준시가: 600000000, 비용: 30000000 }, 취득: { 합계: 1500000000, 토지: 1000000000, 건물: 500000000, 날짜: '2014-05-10', 토지기준시가: 700000000, 건물기준시가: 500000000, 비용: 60000000 }, 토지비사업용: '예' });
  ok(A.요건[0].결과 === '✘' && A.요건[1].결과 === '✔' && A.경우.length === 2 && A.경우[1].엔진칸.transactions[0].transferPrice === 2000000000 && A.경우[1].엔진칸.transactions[0].isNonBusinessLand === true && A.경우[1].엔진칸.transactions[1].acquisitionPrice === 500000000, '토지건물구분 — 봉씨 양도 30% 넘어 안분', JSON.stringify(A.요건.map(x => x.결과)));
  const B = judgeLandBuildingSplit_({ 양도: { 합계: 2000000000, 토지: 1300000000, 건물: 700000000, 날짜: '2026-12-20', 토지기준시가: 900000000, 건물기준시가: 450000000 }, 취득: { 합계: 800000000, 날짜: '2015-03-01', 토지기준시가: 500000000, 건물기준시가: 300000000 } });
  ok(B.경우.length === 1 && B.경우[0].엔진칸.transactions[0].acquisitionPrice === 500000000 && B.경우[0].엔진칸.transactions[1].acquisitionPrice === 300000000, '토지건물구분 — 나눠 적지 않은 취득 안분', JSON.stringify(B.경우[0].엔진칸));
  const C = judgeLandBuildingSplit_({ 양도: { 합계: 1000000000, 날짜: '2026-12-20', 토지기준시가: 600000000 }, 취득: { 합계: 900000000, 토지: 880000000, 건물: 20000000, 날짜: '2025-06-01', 토지기준시가: 550000000, 건물기준시가: 250000000 }, 예외: '건물 철거' });
  ok(C.요건.length === 1 && C.요건[0].결과 === '✔' && C.경우[0].엔진칸.transactions.length === 1 && C.경우[0].엔진칸.transactions[0].acquisitionPrice === 900000000, '토지건물구분 — 철거 예외는 취득 쪽만·토지만 양도', JSON.stringify(C.경우[0].엔진칸)); }
// [2026.11.03 복잡사건 73 「반씨 빚 많은 상속」] 상속채무 — 빚마다 증빙으로 빠지나, 증여채무·보증채무, 빚이 재산보다 클 때
{ const A = judgeInheritDebt_({ 상속개시일: '2026-08-14', 배우자: '예', 자녀수: 2, 상속재산: 3200000000, 사전증여: 200000000, 장례비: 14000000, 봉안비: 6000000, 채무: [{ 이름: '농협', 종류: '금융', 금액: 600000000, 증빙: ['부채증명'] }, { 이름: '보증금', 종류: '임대보증금', 금액: 300000000, 증빙: ['임대차계약', '통장'] }, { 이름: '친구', 종류: '개인', 금액: 200000000, 증빙: ['차용증'], 발생일: '2026-02-01' }, { 이름: '장남', 종류: '개인', 금액: 150000000, 증빙: ['차용증', '이자지급'], 채권자상속인: '예', 발생일: '2025-11-01' }, { 이름: '동생 보증', 종류: '보증', 금액: 400000000, 주채무자변제불능: '아니오' }, { 이름: '손자 약정', 종류: '증여', 금액: 50000000, 발생일: '2024-03-01', 받는사람상속인: '아니오' }, { 이름: '소득세', 종류: '세금', 금액: 32000000, 증빙: ['고지서'] }] });
  ok(A.빼는빚.확실 === 1082000000 && A.빼는빚.잠정 === 200000000 && A.경우.length === 3 && A.경우[2].엔진칸.taxableEstateAmount === 2318000000 && A.경우[2].엔진칸.funeralCostAmount === 0 && A.상속개시전1년빚 === 350000000, '상속채무 — 반씨 확실·잠정·제외', JSON.stringify(A.빼는빚));
  const B = judgeInheritDebt_({ 상속개시일: '2026-05-03', 자녀수: 1, 상속재산: 800000000, 장례비: 9000000, 장례비증빙: '예', 채무: [{ 이름: '저축은행', 종류: '금융', 금액: 700000000 }, { 이름: '연대', 종류: '연대', 금액: 400000000, 부담비율: 50 }] });
  ok(B.경우[0].과세가액0 && B.경우[1].엔진칸.taxableEstateAmount === 600000000 && B.알림.some(x => /§13① 후단/.test(x)), '상속채무 — 빚이 재산보다 큼·연대 몫', JSON.stringify(B.경우.map(c => c.이름)));
  const C = judgeInheritDebt_({ 상속개시일: '2026-01-20', 배우자: '예', 자녀수: 3, 상속재산: 1500000000, 채무: [{ 이름: '형 보증', 종류: '보증', 금액: 100000000, 주채무자변제불능: '예' }, { 이름: '오래된 약정', 종류: '증여', 금액: 30000000, 발생일: '2019-01-01', 받는사람상속인: '아니오' }] });
  ok(C.요건.every(x => x.결과 === '✔') && C.빼는빚.확실 === 130000000, '상속채무 — 변제불능 보증·5년 지난 증여채무', JSON.stringify(C.요건.map(x => x.결과))); }
// [2026.11.03 복잡사건 74 「길씨 다가구 옥탑」] 다가구 — 층수·면적·세대수, 통째 양도, 호별 양도
{ const b = { 양도가액: 1650000000, 양도일: '2026-10-20', 취득가액: 420000000, 취득일: '2009-05-10', 필요경비: 35000000, 거주연수: 12, 다른주택수: 0 };
  const A = judgeMultiHousehold_(Object.assign({ 대장주택층수: 3, 실제주택층수: 4, 주택바닥면적: 590, 세대수: 9, 실제세대수: 10 }, b));
  ok(A.다가구 === false && A.경우.length === 2 && !A.경우[0].엔진칸.isOneHouseOneFamily && A.경우[1].엔진칸.isOneHouseOneFamily && A.할일.length === 1, '다가구 — 옥탑 4개 층은 한 채 아님·원상복구', JSON.stringify(A.경우.map(c => c.이름)));
  const B = judgeMultiHousehold_(Object.assign({ 대장주택층수: 3, 주택바닥면적: 590, 세대수: 9 }, b));
  ok(B.다가구 === true && B.주택수로봄 === 1 && B.엔진칸.isOneHouseOneFamily && B.엔진칸.residenceYears === 12, '다가구 — 요건 맞고 통째 양도면 한 채', JSON.stringify(B.요건.map(x => x.결과)));
  const C = judgeMultiHousehold_(Object.assign({ 대장주택층수: 3, 주택바닥면적: 480, 세대수: 8, 양도방식: '호별' }, b));
  ok(C.다가구 === true && C.주택수로봄 === 8 && C.경우.length === 1 && !C.엔진칸.isOneHouseOneFamily, '다가구 — 호별 양도는 구획마다 한 채', JSON.stringify(C.경우.map(c => c.이름))); }
// [2026.11.03 복잡사건 75 「위씨 4남매 공동상속」] 공동상속 — 상속주택 1채 순위, 최대지분·거주·최연장, 소수지분자 일반주택 비과세
{ const b = { 상속개시일: '2019-03-15', 양도가액: 980000000, 양도일: '2026-09-30', 취득가액: 510000000, 일반주택취득일: '2015-06-01', 필요경비: 12000000, 거주연수: 6, 다른주택수: 0 };
  const A = judgeCoInheritedHouse_(Object.assign({ 납세자: '첫째', 상속인: [{ 이름: '어머니', 지분: '2/10', 거주: '예', 생년월일: '1945-02-01' }, { 이름: '첫째', 지분: '2/10', 생년월일: '1968-04-01' }, { 이름: '둘째', 지분: '3/10', 생년월일: '1970-01-01' }, { 이름: '셋째', 지분: '3/10', 거주: '예', 생년월일: '1973-01-01' }], 피상속인주택: [{ 이름: '반포', 소유시작일: '1998-05-01', 거주년수: 10, 기준시가: 900000000 }, { 이름: '일산', 소유시작일: '1998-05-01', 거주년수: 15, 개시당시거주: '예', 기준시가: 500000000 }] }, b));
  ok(A.공동상속주택 === '일산' && A.소유로보는사람 === '셋째' && A.일세대일주택 === true && A.엔진칸.isOneHouseOneFamily && A.상속주택엔진칸.isLargestShareHolder === false, '공동상속 — 거주기간 순위·지분 같으면 거주자·소수지분 비과세', JSON.stringify([A.공동상속주택, A.소유로보는사람]));
  const B = judgeCoInheritedHouse_(Object.assign({ 납세자: '둘째', 상속인: [{ 이름: '둘째', 지분: '50%', 생년월일: '1970-01-01' }, { 이름: '셋째', 지분: '50%', 생년월일: '1973-01-01' }] }, b));
  ok(B.소유로보는사람 === '둘째' && B.세대주택수에듦 === true && B.일세대일주택 === true, '공동상속 — 거주자 없으면 최연장자·§155② 특례', JSON.stringify(B.요건.map(x => x.결과)));
  const C = judgeCoInheritedHouse_(Object.assign({ 납세자: '셋째', 상속인: [{ 이름: '셋째', 지분: 60 }, { 이름: '둘째', 지분: 40 }] }, b, { 일반주택취득일: '2021-02-01' }));
  ok(C.일세대일주택 === false && !C.엔진칸.isOneHouseOneFamily && C.경우.length === 2, '공동상속 — 최대지분자가 상속 뒤 산 일반주택은 2주택', JSON.stringify(C.경우.map(c => c.이름))); }
// [2026.11.03 복잡사건 76 「추씨 빌라 단타」] 부동산매매업 — 반년 과세기간 사업성·과세연도별·신축판매·비교과세
{ const T = (n, a, ap, b, bp, e, x) => Object.assign({ 이름: n, 종류: '주택', 취득일: a, 취득가액: ap, 양도일: b, 양도가액: bp, 필요경비: e }, x || {});
  const A = judgeRealEstateDealer_({ 판매목적: '예', 사업경비: 12000000, 거래: [T('A', '2025-01-10', 210e6, '2025-06-20', 265e6, 15e6), T('B', '2025-02-05', 180e6, '2025-08-30', 228e6, 12e6), T('C', '2025-04-01', 230e6, '2025-11-15', 290e6, 14e6), T('D', '2025-09-01', 200e6, '2026-03-10', 245e6, 10e6)] });
  ok(A.사업성 === true && A.과세연도 === '2025' && A.경우[1].종합과세표준 === 108500000 && A.경우[1].종합소득산출세액 === 22535000 && A.경우[0].엔진칸.transactions.length === 3 && A.할일.length === 5, '매매업 — 2025년 2기 1취득·2판매·2025년분만 기본세율', JSON.stringify([A.걸린해, A.경우[1].종합과세표준]));
  const B = judgeRealEstateDealer_({ 거래: [T('신축', '2024-01-01', 800e6, '2025-12-01', 1100e6, 0, { 신축: '예' })] });
  ok(B.사업성 === false && B.요건.some(x => /신축판매/.test(x.이름) && x.결과 === '✔') && !B.예정신고, '매매업 — 한 번 판 신축주택은 사업성 약함·건설업', JSON.stringify(B.요건.map(x => x.결과)));
  const C = judgeRealEstateDealer_({ 사업경비: 8e6, 다른종합소득금액: 30e6, 거래: [T('아', '2023-03-01', 500e6, '2025-05-01', 700e6, 20e6, { 중과: '예', 주택수: 3 }), Object.assign(T('임', '2022-01-01', 100e6, '2025-07-01', 260e6, 5e6), { 종류: '토지', 비사업용토지: '예' })] });
  ok(C.경우[1].비교과세 && C.경우[1].비교과세.가목엔진칸.transactions.length === 2 && C.경우[1].비교과세.나목 === 2190000, '매매업 — 중과 주택·비사업용토지는 §64 비교과세', JSON.stringify(C.경우[1].비교과세 && C.경우[1].비교과세.나목)); }
// [2026.11.03 복잡사건 77 「봉씨 대토보상」] 대토보상 — 과세이연금액·요건 2년·추징 사유별 기한·이자
{ const b = { 사업인정고시일: '2023-05-10', 취득일: '2005-03-01', 양도일: '2025-08-20', 취득가액: 240e6, 필요경비: 10e6, 총보상액: 1000e6, 대토보상액: 600e6, 대토등기일: '2027-06-30', 대토양도가액: 900e6, 대토양도일: '2032-07-01' };
  const A = judgeLandReplacement_(b);
  ok(A.요건충족 === true && A.과세이연금액 === 315000000 && A.경우.length === 5 && A.경우[1].엔진칸.transactions.length === 1 && A.경우[4].엔진칸.transactions[0].acquisitionPrice === 285000000, '대토보상 — 과세이연금액·대토 양도 취득가액', JSON.stringify([A.과세이연금액, A.경우.length]));
  const B = judgeLandReplacement_(Object.assign({}, b, { 사유: '3년내양도', 사유일: '2029-03-15', 납부일: '2029-05-31' })); const bc = B.경우.filter(x => x.추징)[0];
  ok(bc && bc.추징.근거 === '§73④2호' && bc.추징.이자 === true && bc.추징.이자기간.시작 === '2025-11-01' && bc.추징.신고납부기한 === '2029-05-31', '대토보상 — 3년 안 양도는 전액 + 이자', JSON.stringify(bc && bc.추징));
  const C = judgeLandReplacement_(Object.assign({}, b, { 취득일: '2022-01-01' }));
  ok(C.요건충족 === false && C.경우.length === 1 && !C.경우[0].엔진칸.transactions[0].compensationType, '대토보상 — 고시일 2년 안 취득은 감면·이연 없음', JSON.stringify(C.요건.map(x => x.결과))); }
// [2026.11.03 복잡사건 78 「봉씨 수용 보상금」] 보상금 가르기 — 양도 갈래만 양도가액·지역권 기타소득·소송 증액 기한
{ const b = { 항목: [{ 종류: '토지', 금액: 820e6 }, { 종류: '건물', 금액: 180e6 }, { 종류: '구축물(담장)', 금액: 12e6 }, { 종류: '수목', 금액: 25e6 }, { 종류: '영업손실(휴업)', 금액: 96e6 }, { 종류: '주거이전비', 금액: 18e6 }, { 종류: '영농손실', 금액: 14e6 }, { 종류: '지역권설정', 금액: 6e6 }, { 종류: '소송 증액', 금액: 110e6 }], 양도일: '2025-06-10', 취득일: '2008-04-01', 취득가액: 310e6, 필요경비: 9e6, 사업인정고시일: '2024-02-01', 판결확정일: '2026-09-17' };
  const A = judgeCompensationSplit_(b);
  ok(A.합계.양도소득 === 1122000000 && A.합계.과세안함 === 32000000 && A.합계.확인필요 === 25000000 && A.경우.length === 3 && A.경우[0].엔진칸.transactions[0].transferPrice === 1122000000 && A.경우[0].엔진칸.transactions[0].compensationType === 'cash', '보상금구분 — 양도 갈래·경우 셋', JSON.stringify(A.합계));
  ok(A.기타소득.원천징수20 === 480000 && A.기타소득.분리과세선택 === true && A.추가신고기한 === '2026-11-30', '보상금구분 — 지역권 기타소득·소송 증액 기한', JSON.stringify([A.기타소득, A.추가신고기한]));
  const C = judgeCompensationSplit_(Object.assign({}, b, { 취득일: '2023-03-01' }));
  ok(C.감면대상 === false && !C.경우[0].엔진칸.transactions[0].compensationType, '보상금구분 — 고시일 2년 안 취득은 §77 감면 없음', String(C.감면대상)); }
// [2026.11.03 복잡사건 79 「하씨 시기 얽힘」] 양도·취득 시기 — 잔금 전 등기·2년 경계·장기할부·자가건설·1985 의제·허가 기한
{ const A = judgeTransferTiming_({ 양도: { 원인: '매매', 잔금일: '2026-01-15', 등기접수일: '2025-12-28' }, 취득: { 원인: '매매', 잔금일: '2023-12-30', 등기접수일: '2024-01-05' }, 자산종류: 'house', 양도가액: 9e8, 취득가액: 7e8 });
  ok(A.양도시기.날짜 === '2025-12-28' && A.양도시기.호 === '2호' && A.경우.length === 2 && A.경우[1].엔진칸.transferDate === '2026-01-15' && A.할일.some(x => /2025-12-30/.test(x.무엇)), '양도시기 — 잔금 전 등기·2년 경계', JSON.stringify([A.양도시기, A.경우.length]));
  const B = judgeTransferTiming_({ 양도: { 원인: '장기할부', 등기접수일: '2025-09-10', 인도일: '2025-07-01', 할부횟수: 6, 최종할부일: '2027-06-30' }, 취득: { 원인: '자가건설', 사용승인일: '2019-05-10', 임시사용승인일: '2018-11-01' } });
  ok(B.양도시기.날짜 === '2025-07-01' && B.양도시기.호 === '3호' && B.취득시기.날짜 === '2018-11-01' && B.예정신고기한 === '2025-09-30', '양도시기 — 장기할부·자가건설', JSON.stringify([B.양도시기, B.취득시기]));
  const C = judgeTransferTiming_({ 양도: { 원인: '매매', 잔금일: '2025-04-20', 등기접수일: '2025-08-01', 허가일: '2025-07-25' }, 취득: { 원인: '상속', 상속개시일: '1980-03-02' } });
  ok(C.취득일로봄 === '1985-01-01' && C.예정신고기한 === '2025-09-30', '양도시기 — 1985 의제·토지거래허가 기한', JSON.stringify([C.취득일로봄, C.예정신고기한])); }
// [2026.11.03 복잡사건 80 「석씨 넓은 마당」] 주택부수토지 배율 — 넘는 땅 가르기·2021 종전 배율·멸실 뒤 양도
{ const A = judgeHouseLandExcess_({ 양도일: '2025-10-20', 취득일: '2014-04-10', 양도가액: 1450000000, 취득가액: 520000000, 필요경비: 30000000, 토지비율: 0.8, 토지면적: 990, 정착면적: 150, 용도지역: '수도권 주거', '1세대1주택': '예', 거주연수: 11 });
  ok(A.배율 === 3 && A.넘는면적 === 540 && A.나눔.넘는땅.양도가액 === 632727273 && A.경우.length === 3 && A.경우[0].엔진칸늘[1].isNonBusinessLand === true && A.경우[0].엔진칸늘[0].isOneHouseOneFamily === true, '부수토지 — 수도권 주거 3배 넘는 땅 가르기', JSON.stringify([A.배율, A.넘는면적, A.나눔]));
  const E = judgeHouseLandExcess_({ 양도일: '2021-10-20', 취득일: '2012-04-10', 양도가액: 1450000000, 취득가액: 520000000, 토지비율: 0.8, 토지면적: 700, 정착면적: 150, 용도지역: '수도권 주거', '1세대1주택': '예' });
  ok(E.배율 === 5 && E.넘는면적 === 0 && E.결론 === '충족', '부수토지 — 2021년 양도 종전 5배', JSON.stringify([E.배율, E.넘는면적]));
  const C = judgeHouseLandExcess_({ 양도일: '2025-08-01', 취득일: '2015-03-01', 양도가액: 800000000, 취득가액: 400000000, 토지면적: 300, 정착면적: 100, 용도지역: '수도권 주거', '1세대1주택': '예', 주택상태: '멸실', 멸실일: '2025-06-10' });
  ok(C.주택임 === false && C.결론 === '안 됨' && C.경우[0].엔진칸늘[0].assetType === 'general', '부수토지 — 멸실 뒤 땅 양도는 주택 아님', JSON.stringify([C.주택임, C.결론])); }
// [2026.11.03 복잡사건 81 「표씨 오피스텔·근생 빌라」] 사실상 주거용이면 주택 — 공부상 용도와 다를 때
{ const bs = { 양도할: 'A', 양도일: '2025-11-20', 취득일: '2018-03-15', 양도가액: 1000000000, 취득가액: 420000000, 필요경비: 15000000, 거주연수: 7 };
  const H = judgeIsHouse_(Object.assign({}, bs, { 건물: [{ 이름: 'A', 공부상: '아파트', 실제: '주거' }, { 이름: 'B', 공부상: '오피스텔', 실제: '주거', 전입: '예' }, { 이름: 'C', 공부상: '근린생활', 실제: '모름', 재산세주택분: '예' }] }));
  ok(H.주택수 === 3 && H.공부상주택수 === 1 && H.경우.length === 2 && !H.경우[0].엔진칸.isOneHouseOneFamily && H.경우[1].엔진칸.isOneHouseOneFamily === true, '주택여부 — 주거용 오피스텔·근생을 주택으로 셈', JSON.stringify([H.주택수, H.공부상주택수]));
  const O = judgeIsHouse_(Object.assign({}, bs, { 건물: [{ 이름: 'A', 공부상: '아파트', 실제: '주거' }, { 이름: 'B', 공부상: '오피스텔', 실제: '업무', 임차인사업자: '예' }, { 이름: 'C', 공부상: '근린생활', 실제: '주거', 취사: '아니오' }] }));
  ok(O.주택수 === 1 && O.결론 === '충족' && O.경우[0].엔진칸.isOneHouseOneFamily === true, '주택여부 — 업무용·주택 구조 아님은 빼고 1주택', JSON.stringify([O.주택수, O.결론]));
  const E = judgeIsHouse_(Object.assign({}, bs, { 건물: [{ 이름: 'A', 공부상: '아파트', 실제: '주거' }, { 이름: 'B', 공부상: '오피스텔', 실제: '모름', 전입: '예', 임차인사업자: '예' }] }));
  ok(E.주택수 === 1 && E.건물판정[1].잠정 === true && E.할일.length === 1, '주택여부 — 증거 엇갈리면 공부상 용도·잠정', JSON.stringify(E.건물판정[1])); }
// [2026.11.03 복잡사건 82 「모씨 상가 리모델링」] 필요경비 — 칸 가르기·증빙 요건·감가상각 차감
{ const P = judgeExpenses_({ 양도가액: 1100000000, 양도일: '2025-11-28', 취득가액: 600000000, 취득일: '2015-04-10', 감가상각누계: 30000000, 항목: [{ 이름: '취득세', 금액: 27600000, 언제: '취득' }, { 이름: '대출이자', 금액: 48000000, 증빙: '계좌이체' }, { 이름: '엘리베이터 설치', 금액: 35000000, 증빙: '세금계산서' }, { 이름: '도배·장판', 금액: 12000000, 증빙: '카드' }, { 이름: '양도 중개수수료', 금액: 9900000, 증빙: '현금영수증' }] });
  ok(P.취득가액 === 597600000 && P.필요경비 === 44900000 && P.합계.안됨 === 60000000 && P.경우.length === 2, '필요경비 — 취득세는 취득가액·이자·수선비 빼고 감가상각 차감', JSON.stringify([P.취득가액, P.필요경비, P.합계.안됨]));
  const Q = judgeExpenses_({ 양도가액: 500000000, 양도일: '2025-11-28', 취득가액: 300000000, 취득일: '2016-01-10', 항목: [{ 이름: '사무실 개조 공사', 금액: 20000000, 증빙: '없음' }, { 이름: '명도 이사비', 금액: 3000000, 증빙: '계좌이체', 매매계약따라: '예' }] });
  ok(Q.필요경비 === 3000000 && Q.합계.증빙없음 === 20000000, '필요경비 — 증빙 없는 자본적지출은 뺌·명도비는 양도비', JSON.stringify([Q.필요경비, Q.합계]));
  const B = judgeExpenses_({ 양도가액: 500000000, 양도일: '2025-11-28', 취득가액: 300000000, 취득일: '2016-01-10', 보상금증액: 12000000, 항목: [{ 이름: '보일러 교체', 금액: 4000000, 증빙: '카드' }, { 이름: '수용 보상금 증액 소송', 금액: 20000000, 증빙: '계좌이체' }] });
  ok(B.필요경비 === 12000000 && B.합계.갈림 === 4000000 && B.경우.length === 3, '필요경비 — 보상금 소송비 증액분 한도·보일러 갈림', JSON.stringify([B.필요경비, B.합계.갈림])); }
// [2026.11.03 복잡사건 83 「길씨 집 넷」] 다주택 중과 — 지방 저가 주택 수 제외·상속 5년·장기임대·일반주택
{ const bs = { 양도할: 'A', 양도일: '2026-10-15', 취득일: '2016-06-01', 양도가액: 1500000000, 취득가액: 700000000, 필요경비: 20000000, 조정대상지역: '예', 계약일: '2026-08-20' };
  const H = [{ 이름: 'A', 지역: '수도권' }, { 이름: 'B', 지역: '광역시', 군읍면: '예', 기준시가: 180000000 }, { 이름: 'C', 지역: '광역시', 기준시가: 350000000, 사유: '상속', 상속일: '2023-02-10' }, { 이름: 'D', 지역: '수도권', 사유: '장기임대', 요건확인: '예' }];
  const G1 = judgeSurcharge_(Object.assign({}, bs, { 주택: H }));
  ok(G1.중과주택수 === 3 && G1.전체주택수 === 4 && G1.중과 === false && /10호/.test(G1.왜) && G1.경우.length === 2 && G1.경우[0].엔진칸.isMultiHouseRentalExemption === true && G1.경우[1].엔진칸.multiHouseCount === 4, '중과판정 — 광역시 군 저가 주택 빼고, 상속·장기임대 빼면 일반주택', JSON.stringify([G1.중과주택수, G1.중과, G1.왜]));
  const G2 = judgeSurcharge_(Object.assign({}, bs, { 주택: H.map(function (h) { return h.이름 === 'C' ? Object.assign({}, h, { 상속일: '2020-03-01' }) : h; }) }));
  ok(G2.중과 === true && G2.알림.some(function (x) { return /5년 지남/.test(x); }), '중과판정 — 상속 5년 지나면 중과', JSON.stringify([G2.중과, G2.왜]));
  const G3 = judgeSurcharge_(Object.assign({}, bs, { 주택: H.map(function (h) { return h.이름 === 'B' ? { 이름: 'B', 지역: '지방' } : h; }) }));
  ok(/잠정/.test(G3.표시) && G3.할일.length === 1 && G3.중과주택수 === 4, '중과판정 — 지방 주택 기준시가 모르면 잠정·할 일', JSON.stringify([G3.결론, G3.할일.length])); }
// [2026.11.03 복잡사건 84 「반씨 세대」] 1세대 범위 — 주소 다른 배우자·따로 세대 못 되는 자녀·생계 따로·가족 범위 밖
{ const B = { 양도할: 'A', 양도일: '2026-09-30', 취득일: '2014-05-20', 양도가액: 1300000000, 취득가액: 600000000, 필요경비: 15000000, 거주연수: 8 };
  const F = [{ 이름: '장남', 관계: '자녀', 나이: 32, 같은주소: '예', 생계: '모름', 주택: ['C'] }, { 이름: '차녀', 관계: '자녀', 나이: 26, 같은주소: '아니오', 소득요건: '아니오', 주택: ['D'] }, { 이름: '모친', 관계: '부모', 나이: 78, 같은주소: '아니오', 주택: ['E'] }];
  const H1 = judgeHousehold_(Object.assign({}, B, { 배우자: { 있음: '예', 같은주소: '아니오', 주택: ['B'] }, 가족: F }));
  ok(H1.세대주택수 === 4 && H1.주민주택수 === 2 && H1.본인주택수 === 1 && !H1.경우[0].엔진칸.isOneHouseOneFamily && H1.경우.some(function (c) { return c.잘못 && c.엔진칸.isOneHouseOneFamily; }), '세대판정 — 주소 다른 배우자·소득 없는 26세 자녀 주택까지 4채', JSON.stringify([H1.세대주택수, H1.주민주택수]));
  const H2 = judgeHousehold_(Object.assign({}, B, { 배우자: { 있음: '예', 같은주소: '아니오', 주택: ['B'] }, 가족: [Object.assign({}, F[0], { 생계: '따로' }), Object.assign({}, F[1], { 소득요건: '예' }), F[2]] }));
  ok(H2.세대주택수 === 2 && H2.할일.length >= 1, '세대판정 — 32세 생계 따로·26세 소득 있으면 빠짐(생계 독립 서류 할 일)', JSON.stringify([H2.세대주택, H2.할일.length]));
  const H3 = judgeHousehold_(Object.assign({}, B, { 배우자: { 있음: '예', 같은주소: '예' }, 가족: [{ 이름: '차녀', 관계: '자녀', 나이: 26, 같은주소: '아니오', 주택: ['D'] }, { 이름: '조카', 관계: '조카', 같은주소: '예', 주택: ['F'] }] }));
  ok(H3.세대주택수 === 1 && /잠정/.test(H3.표시) && H3.경우.length >= 2 && H3.경우[1].엔진칸.isOneHouseOneFamily === true, '세대판정 — 조카는 세대원 아님·소득 모르는 자녀는 잠정 두 경우', JSON.stringify([H3.세대주택수, H3.표시, H3.경우.length])); }
// [2026.11.03 복잡사건 85 「고씨 비싸게 판 집」] 가족 간 고가 매매 — 판 사람 양도가액 − 증여재산가액(§96③2호가), 산 사람 나중 취득가액 시가(시행령 §167④), 싸게 판 사람 시가(§101①)
{ const H = W.calculateLowPriceTransferGiftAmountJS({ fairMarketValue: 500000000, transferPrice: 800000000 });
  ok(H.증여재산가액 === 150000000 && H.매도인_양도가액 === 650000000 && H.매수인_나중양도_취득가액 === 500000000 && H.부당행위계산 === true, '고가 매매 — 판 사람 6.5억·산 사람 나중 취득가액 시가 5억', JSON.stringify([H.매도인_양도가액, H.매수인_나중양도_취득가액]));
  const Lw = W.calculateLowPriceTransferGiftAmountJS({ fairMarketValue: 1000000000, transferPrice: 800000000 });
  ok(Lw.증여재산가액 === 0 && Lw.매도인_양도가액 === 1000000000 && Lw.부당행위계산 === true, '저가 매매 — 증여세 0이어도 판 사람 양도가액 시가(차액 시가 5% 이상)', JSON.stringify([Lw.증여재산가액, Lw.매도인_양도가액]));
  global.toolCalculateLowPriceTransferGiftAmount = W.calculateLowPriceTransferGiftAmountJS;
  const FH = { key: 't85', 사람: [], 이전: [{ 종류: '매매', 날짜: '2026-09-20', 물건: '아파트', 금액: 800000000, 시가: 500000000 }], 계획: [], log: [] };
  const ch85 = famChainInputs_(FH, FH.이전[0], { 양도가액: 900000000, 양도일: '2029-10-01', assetType: 'house' });
  delete global.toolCalculateLowPriceTransferGiftAmount;
  ok(ch85.input && ch85.input.transactions[0].acquisitionPrice === 500000000, '가족 지도 매매 줄 — 비싸게 산 집은 나중 취득가액 시가', ch85.error || ch85.input.transactions[0].acquisitionPrice); }
// [2026.11.03 복잡사건 86 「염씨 1975년 땅」] 의제취득일 전 취득 — 시행령 §176의2④ 1호·2호 중 많은 것
{ const B = { 자산: '토지', 취득일: '1975-03-10', 취득원인: '매매', 양도일: '2026-10-20', 양도가액: 1200000000, 양도기준시가: 400000000, 의제기준시가: 12000000 };
  const D1 = judgeDeemedAcq_(Object.assign({}, B, { 실지취득가액: 15000000, 물가상승률: '210%' }));
  ok(D1.일호 === 36000000 && D1.이호 === 46500000 && D1.고른 === '2호' && D1.경우.length === 3 && D1.경우[0].엔진칸.comparableTransactionPrice === 46500000 && D1.경우[1].엔진칸.acquisitionPrice === 15000000, '의제취득 — 실가 + 물가상승분이 환산보다 크면 그것', JSON.stringify([D1.일호, D1.이호, D1.고른]));
  const D2 = judgeDeemedAcq_(Object.assign({}, B, { 실지취득가액: 15000000 }));
  ok(D2.잠정 === true && D2.취득가액 === 36000000 && D2.할일.length === 1, '의제취득 — 물가상승률 모르면 1호로 잠정·할 일', JSON.stringify([D2.표시, D2.할일.length]));
  const D3 = judgeDeemedAcq_({ 자산: '비상장주식', 취득일: '1985-06-01', 양도일: '2026-10-20', 양도가액: 500000000, 양도기준시가: 100000000, 의제기준시가: 10000000 });
  const D4 = judgeDeemedAcq_(Object.assign({}, B, { 취득일: '1987-05-01' }));
  ok(D3.의제취득일 === '1986-01-01' && D3.취득가액 === 50000000 && !D3.경우.length && D4.적용 === false, '의제취득 — 주식 1986.1.1.·의제일 뒤 취득은 해당 없음', JSON.stringify([D3.의제취득일, D4.결론])); }
// [2026.11.03 복잡사건 87 「육씨 재개발 현금청산」] 정비사업 현금청산 — 감면 호·헐린 뒤 토지·청산금만 양도가액
{ const B = { 사업: '재개발', 정비기반시설: '예', 상대: '조합', 방식: '협의', 고시일: '2023-05-10', 분양신청: '안함', 취득일: '2012-04-01', 잔금일: '2026-08-20', 등기접수일: '2026-08-25', 주택: '예', 일주택: '예', 거주연수: 5, 청산금: 1650000000, 지연이자: 42000000, 이주비: 300000000, 취득가액: 420000000, 필요경비: 15000000 };
  const R1 = judgeRedevCash_(B);
  ok(R1.양도일 === '2026-08-20' && R1.감면호 === '2호' && R1.비과세 === true && R1.경우[0].엔진칸.compensationType === 'cash' && R1.경우[0].엔진칸.transferPrice === 1650000000 && R1.경우.length === 2, '정비청산 — 기반시설 있는 재개발 협의 = 2호·청산금만', JSON.stringify([R1.양도일, R1.감면호, R1.경우.length]));
  const R2 = judgeRedevCash_(Object.assign({}, B, { 멸실일: '2026-03-02' }));
  ok(R2.주택 === false && R2.경우[0].엔진칸.assetType === 'other' && R2.경우.some(function (x) { return /헐린/.test(x.이름); }), '정비청산 — 헐린 뒤 넘기면 토지', JSON.stringify([R2.주택, R2.경우.length]));
  const R3 = judgeRedevCash_(Object.assign({}, B, { 정비기반시설: '아니오' })), R4 = judgeRedevCash_(Object.assign({}, B, { 정비기반시설: '아니오', 방식: '수용재결', 수용개시일: '2026-08-01' })), R5 = judgeRedevCash_(Object.assign({}, B, { 분양신청: '함' }));
  ok(R3.감면 === false && R4.감면호 === '3호' && R4.양도일 === '2026-08-01' && R5.적용 === false, '정비청산 — 기반시설 없으면 협의는 감면 없음·수용재결은 3호·분양신청은 해당 없음', JSON.stringify([R3.감면, R4.감면호, R4.양도일, R5.적용])); }
// [2026.11.03 복잡사건 88 「주씨 한 해 세 번 양도」] 예정신고 뒤 확정신고 의무 — 소득세법 §110④ 단서·시행령 §173⑤
{ const T = (d, a, e, x) => Object.assign({ 자산: '토지', 양도일: d, 취득일: a, 예정신고: '예', 예정산출세액: e, 엔진칸: { transferPrice: 1, transferDate: d, assetType: 'land', acquisitionDate: a } }, x || {});
  const F1 = judgeFinalReturn_({ 연도: 2026, 거래: [T('2026-03-15', '2015-05-01', 97860000), T('2026-07-20', '2018-02-01', 57314000), T('2026-10-05', '2010-01-10', 44812000)], 합산산출세액: 253104000, 확정신고: '안함', 납부일: '2028-03-31' });
  ok(F1.확정신고의무 === true && F1.일호 === true && F1.추가산출세액 === 53118000 && F1.경우.length === 2 && F1.경우[1].엔진칸.underreportedTaxAmount === 53118000 && F1.경우[1].엔진칸.unpaidStartDate === '2027-06-01', '확정신고 — 따로 한 예정신고 셋은 합산해 확정신고', JSON.stringify([F1.표시, F1.추가산출세액]));
  const F2 = judgeFinalReturn_({ 연도: 2026, 거래: [T('2026-03-15', '2015-05-01', 97860000), T('2026-07-20', '2018-02-01', 82626000, { 합산신고: '예' }), T('2026-10-05', '2010-01-10', 72618000, { 합산신고: '예' })], 합산산출세액: 253104000 });
  ok(F2.확정신고의무 === false && F2.일호 === false && F2.다름 === false && !F2.잠정, '확정신고 — §107②로 합산해 예정신고하고 세액이 같으면 안 해도 됨', F2.표시);
  const F3 = judgeFinalReturn_({ 연도: 2026, 거래: [T('2026-03-15', '2015-05-01', 97860000), T('2026-07-20', '2025-06-01', 97000000)], 합산산출세액: 196950000 });
  const F4 = judgeFinalReturn_({ 연도: 2026, 거래: [T('2026-03-15', '2015-05-01', 97860000), T('2026-10-05', '2010-01-10', null, { 예정신고: '아니오' })] });
  ok(F3.일호 === false && F3.다름 === true && F3.확정신고의무 === true && F4.확정신고의무 === true && !F4.잠정, '확정신고 — 단기 섞여도 세액 다르면(2·4호)·예정신고 안 한 양도가 있으면 의무', JSON.stringify([F3.표시, F4.표시])); }
// [2026.11.03 복잡사건 89 「노씨 미등기 넷」] 미등기양도자산 — 소득세법 §104③·시행령 §168①
{ const U1 = judgeUnregistered_({ 자산: '토지', 취득원인: '매매', 등기: '아니오', 사유: '도시개발' });
  const U2 = judgeUnregistered_({ 자산: '주택', 등기: '아니오', 사유: '무허가', 일세대일주택: '예' });
  const U3 = judgeUnregistered_({ 자산: '토지', 취득원인: '매매', 등기: '아니오', 사유: '없음', 엔진칸: { assetType: 'land', transferPrice: 1 } });
  ok(U1.미등기 === false && U1.빠진호[0] === '6호' && U2.미등기 === false && U2.빠진호[0] === '4호' && U3.미등기 === true && U3.경우.length === 2 && U3.경우[1].엔진칸.isUnregisteredTransfer === false, '미등기 — 도시개발 미종료(6호)·무허가 1주택(4호)은 빼고 그냥 안 한 등기는 70%', JSON.stringify([U1.표시, U2.표시, U3.표시]));
  const U4 = judgeUnregistered_({ 자산: '분양권', 등기: '아니오' }), U5 = judgeUnregistered_({ 자산: '토지' }), U6 = judgeUnregistered_({ 자산: '주택', 등기: '아니오', 사유: '무허가' });
  ok(U4.미등기 === false && U5.미등기 === null && U5.할일.length === 1 && U6.미등기 === null, '미등기 — 분양권은 대상 아님·등기 모름·무허가 주택 1주택 모름은 잠정', JSON.stringify([U4.표시, U5.표시, U6.표시]));
  const fe = { assetType: 'land', transferPrice: 2000000000, acquisitionStandardPriceForConversion: 300000000, transferStandardPriceForConversion: 1200000000, acquisitionDate: '2005-03-01', transferDate: '2026-04-01', isEightYearFarmland: true, useEstimatedNecessaryExpense: true };
  const r1 = W.calculateTransferTaxSingleJS(fe), r2 = W.calculateTransferTaxSingleJS(Object.assign({}, fe, { isUnregisteredTransfer: true }));
  ok(r1.산출세액 === r2.산출세액, '미등기 — 8년 자경 감면 토지는 미등기에서 빠져 개산공제도 3%(시행령 §168①3호·§163⑥)', JSON.stringify([r1.산출세액, r2.산출세액])); }
// [2026.11.03 복잡사건 90 「차씨 신축 상가」] 신축·증축 감정·환산 가산세 — 소득세법 §114의2
{ const C1 = judgeNewBuildConversion_({ 건물취득원인: '신축', 사용승인일: '2022-06-20', 사실상사용일: '2022-05-01', 양도일: '2027-05-10', 취득가액방법: '환산', 건물분가액: 500000000 });
  const C2 = judgeNewBuildConversion_({ 건물취득원인: '증축', 증축면적: 120, 증축일: '2023-03-01', 양도일: '2026-05-01', 취득가액방법: '환산', 증축분가액: 120000000 });
  const C3 = judgeNewBuildConversion_({ 건물취득원인: '상속', 양도일: '2026-05-01', 취득가액방법: '환산' });
  ok(C1.가산세대상 === false && C1.기산일 === '2022-05-01' && C2.가산세 === 6000000 && C3.가산세대상 === false, '환산가산세 — 사실상 사용일부터 5년 지남·증축 85㎡ 넘으면 증축분만·상속 건물 없음', JSON.stringify([C1.표시, C2.표시, C3.표시]));
  const C4 = judgeNewBuildConversion_({ 건물취득원인: '신축', 사용승인일: '2019-03-01', 양도일: '2019-10-01', 취득가액방법: '감정', 건물분가액: 1 }), C5 = judgeNewBuildConversion_({ 건물취득원인: '신축', 사용승인일: '2023-01-01', 양도일: '2026-01-01', 취득가액방법: '환산' });
  ok(C4.가산세대상 === false && C5.가산세대상 === null && C5.할일.length === 1, '환산가산세 — 2019년 감정가액은 없음·건물분 가액 모르면 잠정', JSON.stringify([C4.표시, C5.표시]));
  const he = { assetType: 'house', transferPrice: 450000000, acquisitionStandardPriceForConversion: 200000000, transferStandardPriceForConversion: 300000000, acquisitionDate: '2023-04-10', transferDate: '2026-05-20', isOneHouseOneFamily: true, residenceYears: 3, isNewBuildingWithin5Years: true, convertedBuildingAcquisitionValueForPenalty: 300000000 };
  const h1 = W.calculateTransferTaxSingleJS(he);
  ok(h1.비과세여부 === true && h1.환산취득가액가산세 === 15000000 && h1.납부세액_합계 === 15000000, '환산가산세 — 1세대1주택 비과세여도 가산세는 붙음(§114의2②)', JSON.stringify([h1.비과세여부, h1.환산취득가액가산세, h1.납부세액_합계])); }
// [2026.11.03 복잡사건 91 「양씨 전세 낀 아파트」] 부담부증여 — 상증법 §47③·소득령 §159
{ const B1 = judgeBurdenedGift_({ 관계: '직계존속', 증여일: '2026-09-15', 채무종류: '담보대출', 채무담보관련: '예', 채무액: 300000000, 인수: '예', 입증: '없음', 평가액: 1000000000 });
  const B2 = judgeBurdenedGift_({ 관계: '직계존속', 증여일: '2026-09-15', 채무종류: '임대보증금', 채무담보관련: '예', 채무액: 500000000, 인수: '예', 입증: '임대차계약서', 평가액: 1000000000, 취득가액: 400000000, 다른재산가액: 200000000 });
  const B3 = judgeBurdenedGift_({ 관계: '직계존속', 채무종류: '개인채무', 채무액: 100000000, 인수: '예', 입증: '계약서', 평가액: 1000000000 });
  ok(B1.채무인정 === false && B1.인정채무 === 0 && B1.신고기한 === '2026-12-31' && B2.양도분.안분채무 === 416666667 && B2.양도분.취득가액 === 166666667 && B3.채무인정 === false, '부담부증여 — 직계 증빙 없음은 안 빠짐·다른 재산과 함께면 채무 안분·관련 없는 개인채무는 안 빠짐', JSON.stringify([B1.표시, B2.표시, B3.표시]));
  const B4 = judgeBurdenedGift_({ 관계: '직계존속', 채무종류: '담보대출', 채무담보관련: '예', 채무액: 300000000, 인수: '예', 입증: '모름', 평가액: 1000000000, 취득가액: 400000000, 상환능력: '없음' });
  ok(B4.채무인정 === null && B4.경우.some(function (c) { return /증빙을 못 내면/.test(c.이름); }) && B4.할일.length >= 2, '부담부증여 — 증빙 모르면 잠정·못 낼 때 경우·상환 확인 할 일', JSON.stringify([B4.표시, B4.할일.length]));
  const e1 = W.calculateBurdenedGiftTransferJS({ assetAcquisitionPrice: 450000000, giftValuedByStandardPrice: true, acquisitionStandardPrice: 200000000, assetGiftValue: 600000000, totalDebtAmount: 300000000 });
  const e2 = W.calculateBurdenedGiftTransferJS({ assetAcquisitionPrice: 450000000, giftValuedByStandardPrice: true, assetGiftValue: 600000000, totalDebtAmount: 300000000 });
  ok(e1.양도로보는부분_취득가액 === 100000000 && /기준시가/.test(e1.취득가액기준) && !!e2.error, '부담부증여 — 기준시가 평가면 취득가액도 기준시가(§159①1호 괄호)·없으면 오류', JSON.stringify([e1.양도로보는부분_취득가액, e2.error])); }
// [2026.11.03 복잡사건 92 「강씨 재외동포 아파트」] 비거주자 양도 — 소득세법 §121②·§156①5호
{ const N1 = judgeNonResidentTransfer_({ 거주자: '비거주자', 자산: '주택', '1세대1주택': '예', 출국사유: '그밖', 양도일: '2026-08-20', 양도가액: 900000000, 취득가액: 500000000, 양도비용: 10000000, 취득가액확인: '예', 매수인: '법인' });
  const N2 = judgeNonResidentTransfer_({ 거주자: '비거주자', 자산: '주택', '1세대1주택': '예', 출국사유: '해외이주', 출국일1주택: '예', 출국일: '2025-03-01', 양도일: '2026-08-20', 양도가액: 1500000000, 취득가액: 500000000, 취득가액확인: '아니오', 매수인: '법인', 먼저낸세액: 30000000 });
  const N4 = judgeNonResidentTransfer_({ 거주자: '비거주자', 자산: '토지', 양도일: '2026-08-20', 양도가액: 800000000, 취득가액: 300000000, 취득가액확인: '예', 매수인: '법인', 먼저낸세액: 120000000, 확인서제출: '예' });
  const N3 = judgeNonResidentTransfer_({ 거주자: '비거주자', 자산: '주택', 출국사유: '해외이주', 출국일1주택: '예', 출국일: '2023-03-01', 양도일: '2026-08-20', 매수인: '개인' });
  ok(N1.비과세예외 === false && N1.원천징수 === 78000000 && N1.예정신고기한 === '2026-10-31' && N2.비과세예외 === true && N2.원천징수 === 150000000 && N2.경우.length === 2 && N3.비과세예외 === false && N3.원천징수 == null && N4.원천징수 === 0, '비거주자 양도 — 출국 2년 예외만 비과세·법인 매수 원천징수 적은 금액·확인서 없으면 미리 냈어도 그대로·확인서 내면 0·개인 매수 없음', JSON.stringify([N1.표시, N2.표시, N3.표시]));
  const base = { assetType: 'house', transferPrice: 1500000000, acquisitionPrice: 500000000, acquisitionDate: '2012-05-01', transferDate: '2026-08-20', isOneHouseOneFamily: true, residenceYears: 10, isTransferorResident: false, isNonResidentTwoYearException: true, departureDate: '2025-03-01' };
  const e1 = W.calculateTransferTaxSingleJS(base), e2 = W.calculateTransferTaxSingleJS(Object.assign({}, base, { nonResidentTable2Excluded: true }));
  ok(e1.산출세액 > 0 && e2.산출세액 > e1.산출세액, '비거주자 출국 2년 예외 — 표2 배제(문언) 하면 장특이 표1이라 세액이 큼', JSON.stringify([e1.산출세액, e2.산출세액])); }
// [2026.11.03 복잡사건 93 「백씨 가족법인 거래」] 법인·개인 거래 — 소득세법 §96③·§101①, 소득령 §163⑩2호, 상증법 §4의2③·§35②
{ const C1 = judgeCorpIndividualDeal_({ 방향: '개인→법인', 특수관계: '예', 대가: 1500000000, 시가: 1000000000, 처분: '예' });
  const C2 = judgeCorpIndividualDeal_({ 방향: '개인→법인', 특수관계: '아니오', 대가: 1500000000, 시가: 1000000000, 정당사유: '아니오' });
  const C3 = judgeCorpIndividualDeal_({ 방향: '법인→개인', 특수관계: '예', 대가: 600000000, 시가: 1000000000, 처분: '예' });
  const C4 = judgeCorpIndividualDeal_({ 방향: '개인→법인', 특수관계: '예', 대가: 700000000, 시가: 1000000000, 주주가족지분: 100 });
  ok(C1.양도가액 === 1000000000 && C1.증여재산가액 === 0 && C2.양도가액 === 1300000000 && C2.증여재산가액 === 200000000 && C3.나중취득가액 === 1000000000 && C4.양도가액 === 1000000000 && C4.처분 === false, '법인·개인 거래 — 상여 처분이면 시가·남의 법인 고가는 §35 빼고·법인에서 싸게 산 처분 금액 더함·법인에 싸게 팔면 §101 시가', JSON.stringify([C1.표시, C2.표시, C3.표시, C4.표시]));
  const C5 = judgeCorpIndividualDeal_({ 방향: '개인→법인', 특수관계: '예', 대가: 1500000000, 시가: 1000000000 });
  ok(C5.양도가액 == null && C5.경우.length === 2 && C5.할일.some(function (x) { return /소득처분/.test(x.무엇); }), '법인·개인 거래 — 처분 모르면 경우 둘·확인 할 일', JSON.stringify([C5.표시])); }
// [2026.11.03 복잡사건 94 「노씨 영농상속」] 영농상속공제 — 상증법 §18의3·시행령 §16
{ const F1 = judgeFarmInheritance_({ 상속개시일: '2026-06-30', 피상속인: { 영농: [{ 시작: '2010-03-01' }], 거주: '같은시군구', 직접영농: '예', 사망나이: 62 }, 상속인: { 생년월일: '1995-01-01', 거주: '연접', 직접영농: '예' }, 재산: [{ 종류: '농지', 가액: 2000000000, 담보채무: 300000000, 영농사용시작일: '2012-01-01' }, { 종류: '농지', 가액: 500000000, 영농사용시작일: '2025-09-01' }] });
  const F2 = judgeFarmInheritance_({ 상속개시일: '2026-06-30', 피상속인: { 영농: [{ 시작: '2010-03-01' }], 거주: '같은시군구', 직접영농: '예', 사망나이: 78, 소득초과해: [2021] }, 상속인: { 생년월일: '1990-01-01', 영농: [{ 시작: '2025-01-01' }], 거주: '같은시군구', 직접영농: '예' }, 재산: [{ 종류: '농지', 가액: 1000000000, 영농사용시작일: '2012-01-01' }] });
  const F3 = judgeFarmInheritance_({ 상속개시일: '2026-06-30', 피상속인: { 영농: [{ 시작: '2010-03-01' }], 거주: '같은시군구', 직접영농: '예', 사망나이: 62 }, 상속인: { 생년월일: '1995-01-01', 거주: '연접', 직접영농: '예' }, 재산: [{ 종류: '농지', 가액: 1000000000, 영농사용시작일: '2012-01-01' }], 사후: { 처분일: '2028-04-10', 처분가액: 400000000, 정당사유: '아니오' } });
  ok(F1.결론 === '공제 1,700,000,000원' && F1.제외재산 === 500000000 && F2.결론 === '공제 안 됨' && F3.추징 && F3.추징.산입액 === 400000000 && F3.추징.신고기한 === '2028-10-31', '영농상속공제 — 65세 전 사망 면제·2년 안 쓴 농지 뺌·담보채무 뺌·소득 넘은 해·2년 미달·5년 안 처분 비율 추징', JSON.stringify([F1.표시, F2.표시, F3.표시]));
  const R = W.calculateSuccessionDeductionClawbackJS(F3.경우[F3.경우.length - 1].엔진칸 && Object.assign({}, F3.경우[F3.경우.length - 1].엔진칸, { original: Object.assign({}, F3.경우[F3.경우.length - 1].엔진칸.original, { taxableEstateAmount: 3000000000, childCount: 2 }) }));
  ok(R && !R.error && R.산입액 === 400000000 && R.결정상속세액 > 0, '영농상속 추징 — 처분 비율 40% 산입해 다시 계산', JSON.stringify(R && (R.error || [R.산입액, R.결정상속세액, R.이자상당액]))); }
// [2026.11.03 복잡사건 95 「심씨 그린벨트 땅」] 개발제한구역 매수 감면 — 조특법 §77의3·시행령 §74·시행규칙 §30
{ const G1 = judgeGbPurchase_({ 방식: '매수청구', 지정일: '1971-07-30', 매수청구일: '2026-03-02', 양도일: '2026-09-15', 취득일: '1998-04-01', 취득원인: '상속', 피상속인취득일: '1965-05-10', 거주: [{ 시작: '1960-01-01', 지역: '같은시군구' }] });
  const G2 = judgeGbPurchase_({ 방식: '매수청구', 지정일: '1971-07-30', 매수청구일: '2026-03-02', 양도일: '2026-09-15', 취득일: '2000-05-01', 거주: [{ 시작: '2000-05-01', 끝: '2009-12-31', 지역: '같은시군구' }, { 시작: '2013-01-01', 지역: '같은시군구' }], 부득이: [{ 시작: '2010-01-01', 끝: '2012-12-31', 사유: '병역 징집' }] });
  const G3 = judgeGbPurchase_({ 방식: '해제후수용', 지정일: '1971-07-30', 해제일: '2022-12-01', 사업인정고시일: '2024-03-10', 양도일: '2026-05-20', 취득일: '1985-06-01', 거주: [{ 시작: '1985-06-01', 지역: '연접' }] });
  ok(G1.감면 && G1.감면율 === 40 && G2.감면 && G2.감면율 === 25 && !G3.감면, '개발제한구역 감면 — 상속 피상속인 취득일 40%·징집 기간 거주로 봄 25%·해제 뒤 1년 넘은 고시 없음', JSON.stringify([G1.결론, G2.결론, G3.결론])); }
// [2026.11.03 복잡사건 96 「엄씨 땅 쪼개 팔기」] 조특법 §133③ 나눠 팔기 감면 한도 합산
{ const 앞 = { 양도일: '2025-11-20', 산사람: '최씨', 분할일: '2025-06-01', 감면세액: 100000000, 감면: '자경' };
  const P1 = judgeSplitSale_({ 이번: { 양도일: '2026-03-10', 산사람: '최씨' }, 앞선: [앞] });
  const P2 = judgeSplitSale_({ 이번: { 양도일: '2026-03-10', 산사람: '남씨' }, 앞선: [앞] });
  const P3 = judgeSplitSale_({ 이번: { 양도일: '2026-03-10', 산사람: '최씨' }, 앞선: [Object.assign({}, 앞, { 분할일: '2024-09-01' })] });
  const P4 = judgeSplitSale_({ 이번: { 양도일: '2026-05-20', 산사람: '시행자' }, 앞선: [{ 양도일: '2025-08-01', 산사람: '시행자', 지분: '예', 감면세액: 80000000, 감면: '수용' }] });
  ok(P1.합산 && P1.엔진칸.sect133SameBuyerPriorReduction === 100000000 && !P2.합산 && !P3.합산 && P4.합산 && P4.엔진칸.sect133SameBuyerPriorComp === 80000000 && !P4.엔진칸.sect133SameBuyerPriorReduction, '나눠 팔기 — 같은 사람 합산·남은 따로·분할 1년 넘음 따로·지분 수용은 수용 묶음', JSON.stringify([P1.결론, P2.결론, P3.결론, P4.결론])); }
// [2026.11.03 복잡사건 97 「도씨 임대 빌라」] 조특법 §97의3 장기일반민간임대 장특 특례 요건
{ const 계 = [{ 시작: '2014-03-01', 끝: '2016-02-29', 보증금: 200000000 }, { 시작: '2016-03-01', 끝: '2018-02-28', 보증금: 210000000 }, { 시작: '2018-03-01', 끝: '2020-02-29', 보증금: 220000000 }, { 시작: '2020-03-01', 끝: '2022-02-28', 보증금: 231000000 }, { 시작: '2022-03-01', 끝: '2026-09-30', 보증금: 242550000 }];
  const 기 = { 양도일: '2026-10-15', 거주자: '예', 등록일: '2014-03-01', 종류: '매입', 계약: 계, 전용면적: 59, 취득일: '2014-01-10' };
  const R1 = judgeRental9703_(기);
  const R2 = judgeRental9703_(Object.assign({}, 기, { 계약: 계.map(function (c, i) { return i === 4 ? { 시작: c.시작, 끝: c.끝, 보증금: 245000000 } : c; }) }));
  const R3 = judgeRental9703_(Object.assign({}, 기, { 전용면적: 86 }));
  const R4 = judgeRental9703_(Object.assign({}, 기, { 아파트: '예', 말소일: '2021-03-01', 말소사유: '자동' }));
  ok(R1.특례율 === 70 && R2.특례율 === 0 && R3.특례율 === 0 && R4.특례율 === 50 && R4.간주8년, '장기임대 특례 — 법대로 70%·임대료 5% 넘음·86㎡ 안 됨·자동말소 아파트 8년 50%', JSON.stringify([R1.결론, R2.결론, R3.결론, R4.결론]));
}
// [2026.11.03 복잡사건 98 「표씨 지난 일들」] 부과제척기간 — 기산일·기간·특례
{ const E = judgeExclusionPeriod_({ 기준일: '2026-11-03', 건: [
    { 이름: 'A', 세목: '양도', 거래일: '2018-05-10', 신고: '예' },
    { 이름: 'B', 세목: '양도', 거래일: '2019-03-20', 신고: '아니오' },
    { 이름: 'D', 세목: '상속', 거래일: '2014-02-07', 신고: '예', 누락유형: '금융자산' },
    { 이름: 'E', 세목: '증여', 거래일: '2009-04-10', 신고: '아니오', 부정행위: '예', 특례: { 유형: 7, 재산가액: 6000000000, 안날: '2026-09-10' } },
    { 이름: 'H', 세목: '부담부증여양도', 거래일: '2015-06-10', 신고: '예' }] }).건별;
  ok(!E[0].오늘부과 && E[1].오늘부과 && E[1].만료일 === '2027-06-01' && E[2].부분[0].끝 === '2029-09-01' && E[3].오늘부과 && E[3].특례[0].끝 === '2027-09-10' && E[4].기간_년 === 10, '제척기간 — 신고 양도 끝남·무신고 7년(쉬는 날 미룸)·상속 누락 부분 15년·명의신탁 안 날 1년·부담부증여 양도세 10년', JSON.stringify(E.map(function (x) { return x.결론; })));
}
// [2026.11.03 복잡사건 99 「석씨 다운계약서」] 부정행위인지·부정 부분만 40%
{ const 기 = { 세목: '양도', 법정신고기한: '2026-05-31', 신고: '예', 신고할세액: 100000000, 신고한세액: 40000000, 기준일: '2026-05-31', 항목: [{ 이름: '양도가액 줄임', 과세표준: 150000000, 행위: '다운계약서' }, { 이름: '필요경비 착오', 과세표준: 50000000, 행위: '단순 착오' }] };
  const F1 = judgeFraud_(기);
  const F2 = judgeFraud_(Object.assign({}, 기, { 신고: '아니오' }));
  const F3 = judgeFraud_(Object.assign({}, 기, { 항목: [{ 이름: '누락', 과세표준: 200000000, 행위: '신고 때 빠뜨림' }] }));
  ok(F1.가산세.법대로.가산세 === 19500000 && F2.가산세.법대로.가산세 === 40000000 && F3.가산세.법대로.가산세 === 6000000, '부정행위 — 다운계약 40%+착오 10% 나눔·무신고 부정 40%·단순 누락 10%', JSON.stringify([F1.결론, F2.결론, F3.결론]));
}
// [2026.11.03 복잡사건 100 「정씨 돌려받을 세금」] 환급가산금 기산일·이율·1.5배·고충민원
{ const 기 = { 세목: '양도', 원인: '경정', 환급세액: 10000000, 납부: [{ 일: '2025-05-31', 금액: 10000000 }], 경정청구일: '2025-12-01', 결정일: '2026-01-30', 기준일: '2026-11-03' };
  const G1 = judgeRefund_(기);
  const G2 = judgeRefund_(Object.assign({}, 기, { 원인: '감면', 감면결정일: '2025-11-30' }));
  const G3 = judgeRefund_(Object.assign({}, 기, { 원인: '고충민원', 고충민원: '예', 경정청구일: '' }));
  ok(G1.환급가산금 === 207232 && G2.환급가산금 === Math.floor(10000000 * 61 * 0.031 / 365) && G3.환급가산금 === 0, '환급가산금 — 납부일 다음 날부터·감면은 결정일부터·고충민원만이면 0', JSON.stringify([G1.결론, G2.결론, G3.결론]));
}
// [2026.11.03 복잡사건 101 「강씨 공장 물려받기」] 납부유예 — 유예 금액·5년 안 지분 감소 전부·5년 뒤 비율·공제 받았으면 안 됨
{ const 기 = { 상속개시일: '2024-03-10', 중소기업: '예', 가업상속공제: '아니', 담보: '예', 상속세납부세액: 1000000000, 가업상속재산가액: 6000000000, 총상속재산가액: 10000000000, 기준일: '2026-11-03' };
  const H1 = judgeDefer_(Object.assign({}, 기, { 사유: [{ 일: '2026-05-20', 종류: '지분' }] }));
  const H2 = judgeDefer_(Object.assign({}, 기, { 사유: [{ 일: '2030-05-20', 종류: '지분', 감소지분율: 20, 개시지분율: 80 }] }));
  const H3 = judgeDefer_(Object.assign({}, 기, { 가업상속공제: '예' }));
  ok(H1.유예세액 === 600000000 && H1.징수[0].징수세액 === 600000000 && H1.징수[0].이자상당액 === 31546849 && H2.징수[0].징수세액 === 150000000 && H3.적용 === false, '납부유예 — 유예 금액·5년 안 전부·5년 뒤 비율·공제 받으면 안 됨', JSON.stringify([H1.결론, H2.결론, H3.결론]));
}
// [2026.11.03 복잡사건 102 「한씨 아버지가 집을 팔고 돌아가심」] 납세의무승계 — 사망 전 잔금은 피상속인 양도·사망 뒤 잔금은 상속인 양도·받은 재산 한도·포기자 보험금
{ const 사람 = [{ 이름: '배우자', 상속분: '3/7', 자산: 600000000 }, { 이름: '장남', 상속분: '2/7', 자산: 20000000 }, { 이름: '차남', 상속분: '2/7', 자산: 400000000 }];
  const G1 = judgeSuccession_({ 상속개시일: '2025-04-15', 거래: [{ 이름: '아파트', 잔금일: '2025-03-20', 양도가액: 900000000, 받은대금: 900000000, 양도세: 120000000 }], 상속인: 사람, 기준일: '2026-11-03' });
  const G2 = judgeSuccession_({ 상속개시일: '2025-04-15', 거래: [{ 이름: '상가', 잔금일: '2025-05-30', 양도가액: 500000000, 받은대금: 50000000 }], 상속인: 사람, 기준일: '2026-11-03' });
  const G3 = judgeSuccession_({ 상속개시일: '2025-04-15', 거래: [{ 이름: '아파트', 잔금일: '2025-03-20', 양도세: 120000000 }], 상속인: [{ 이름: '배우자', 상속분: '3/5', 자산: 600000000 }, { 이름: '장남', 상속분: '2/5', 포기: '예', 보험금: 30000000 }], 기준일: '2026-11-03' });
  ok(G1.승계세금 === 120000000 && G1.상속인별[1].낼세금 === 20000000 && G1.상속인별[0].낼세금 === 51428571 && /^상속인/.test(G2.거래[0].누구) && G2.승계세금 === 0 && G3.상속인별[1].받은재산 === 30000000 && G3.상속인별[1].낼세금 === 5714285, '납세의무승계 — 사망 전 양도 승계·한도·사망 뒤 상속인 양도·포기자 보험금', JSON.stringify([G1.결론, G2.결론, G3.결론]));
}
// [2026.11.03 복잡사건 103 「서씨 딱지와 조합원 지위」] 부동산권리 — 택지 공급권은 그 밖의 취득 권리·주택 공급 지위는 분양권·도시정비법 조합원은 입주권·지역주택조합은 두 경우
{ const H = judgeAcquireRight_({ 권리: [{ 이름: '딱지', 공급대상: '택지', 근거법: '택지개발촉진법', 지위: '협의양도인택지', 취득일: '2025-12-01', 양도일: '2026-06-30' }, { 이름: '분양권', 공급대상: '아파트', 근거법: '주택법', 지위: '당첨', 취득일: '2024-01-01', 양도일: '2026-06-30' }, { 이름: '입주권', 근거법: '도시 및 주거환경정비법', 지위: '원조합원', 취득일: '2015-01-01', 양도일: '2026-06-30' }, { 이름: '지주택', 근거법: '주택법 지역주택조합', 지위: '조합원', 사업계획승인: '예' }], 기준일: '2026-11-03' });
  ok(H.권리별[0].엔진칸.rightOrOtherKind === 'acquire_right' && /50%/.test(H.권리별[0].세율) && H.권리별[1].엔진칸.assetType === 'presale_right' && /60%/.test(H.권리별[1].세율) && H.권리별[2].엔진칸.assetType === 'house' && H.권리별[3].엔진칸.assetType === 'presale_right' && H.경우.filter(x => /^지주택 /.test(x.이름)).length === 2, '부동산권리 — 딱지·분양권·입주권·지역주택조합 가르기', JSON.stringify(H.결론));
}
// [2026.11.03 복잡사건 104 「설씨 경매로 잃은 집·경매로 산 상가」] 경매 — 양도시기 완납일·물상보증 잠정·낙찰 취득가액 넣고 빼기
{ const A = judgeAuction_({ 양도: [{ 이름: '집', 자산: '아파트', 최초경매기일: '2025-11-20', 매각허가일: '2026-01-08', 대금완납일: '2026-02-10', 매각대금: 460000000, 취득일: '2018-03-15', 취득가액: 300000000 }, { 이름: '땅', 자산: '토지', 소유자지위: '물상보증인', 최초경매기일: '2025-09-01', 대금완납일: '2026-01-20', 매각대금: 250000000 }], 취득: [{ 이름: '상가', 대금완납일: '2023-04-14', 낙찰가: 500000000, 취득세등: 23000000, 인수보증금: 80000000, 보증금구상: '불가', 유치권변제: 30000000, 유치권합의금: 20000000, 명도비: 15000000, 이자: 30000000, 양도일: '2026-09-30', 양도가액: 900000000 }], 기준일: '2026-11-03' });
  ok(A.넘어간것[0].양도시기 === '2026-02-10' && A.넘어간것[1].잠정 === true && A.넘어간것[1].비사업용기간_양도일 === '2025-09-01' && A.낙찰받은것[0].인정취득가액 === 633000000 && A.낙찰받은것[0].다넣으면 === 698000000 && A.경우.length === 4, '경매 — 완납일·물상보증·낙찰 취득가액', JSON.stringify(A.결론));
}
// [2026.11.03 복잡사건 105 「소씨 시골집과 서울 집」] 농어촌주택 — 일반주택이 먼저인지·3년 못 채움 추징·증축 가액
{ const L = { 읍면동: '면', 수도권: '아니오', 도시지역: '아니오', 조정대상지역: '아니오', 토지거래허가구역: '아니오', 관광단지: '아니오' }, G = { 취득일: '2015-03-10', 양도일: '2026-08-20', 양도가액: 1000000000, 취득가액: 500000000 };
  const A = judgeRuralHouse_({ 일반주택: G, 농어촌주택: { 취득일: '2022-06-01', 기준시가: 180000000 }, 소재지: L, 같은연접: '아니오', 기준일: '2026-11-03' });
  const B = judgeRuralHouse_({ 일반주택: Object.assign({}, G, { 취득일: '2023-02-01' }), 농어촌주택: { 취득일: '2021-04-01', 기준시가: 150000000 }, 소재지: L, 같은연접: '아니오' });
  const C = judgeRuralHouse_({ 일반주택: G, 농어촌주택: { 취득일: '2025-03-01', 기준시가: 200000000, 처분일: '2026-12-15', 처분사유: '매매' }, 소재지: L, 같은연접: '아니오' });
  const D = judgeRuralHouse_({ 종류: '고향', 일반주택: G, 농어촌주택: { 취득일: '2020-05-01', 기준시가: 250000000, 추가취득가액: 70000000 }, 고향: { 등재10년: '예', 별표12시: '예' }, 소재지: { 수도권: '아니오', 조정대상지역: '아니오', 관광단지: '아니오' }, 같은연접: '아니오' });
  ok(A.적용 === true && A.경우[0].엔진칸.isOneHouseOneFamily === true && B.적용 === false && C.추징 === true && C.할일.some(x => x.indexOf('2027-02-28') >= 0) && D.적용 === false, '농어촌주택 — 먼저 보유·추징 기한·증축 가액', JSON.stringify([A.결론, B.결론, C.결론, D.결론]));
}
// [2026.11.03 복잡사건 106 「선씨 재건축 동안 산 집」] 대체주택 — 인가 뒤 취득·1년 거주·출국 단서·다른 주택
{ const B = { 종류: '재건축', 사업시행인가일: '2021-06-15', 완성일: '2024-12-20' }, R = { 취득일: '2021-09-01', 전입일: '2021-09-10', 전출일: '2025-02-01', 양도일: '2026-09-30', 양도가액: 900000000, 취득가액: 500000000 }, M = { 전입일: '2025-02-01', 세대전원: '예' };
  const A = judgeReplacementHouse_({ 사업: B, 취득때주택수: 1, 대체주택: R, 이사: M, 기준일: '2026-11-03' });
  const Bx = judgeReplacementHouse_({ 사업: B, 취득때주택수: 1, 대체주택: Object.assign({}, R, { 취득일: '2021-03-01', 전입일: '2021-03-05' }), 이사: M, 기준일: '2026-11-03' });
  const D = judgeReplacementHouse_({ 사업: { 종류: '재개발', 사업시행인가일: '2019-04-01', 완성일: '2023-06-30' }, 취득때주택수: 1, 대체주택: { 취득일: '2019-08-01', 전입일: '2019-08-10', 전출일: '2023-12-31', 양도일: '2026-05-31' }, 이사: { 출국일: '2024-03-01', 출국사유: '근무', 입국일: '2026-02-01' }, 기준일: '2026-11-03' });
  const E = judgeReplacementHouse_({ 사업: B, 취득때주택수: 2, 대체주택: R, 이사: M, 기준일: '2026-11-03' });
  ok(A.적용 === true && A.경우[0].엔진칸.isOneHouseOneFamily === true && Bx.적용 === false && D.적용 === true && /잠정/.test(D.결론) && E.적용 === false, '대체주택 — 인가 뒤 취득·출국 단서 잠정·다른 주택', JSON.stringify([A.결론, Bx.결론, D.결론, E.결론]));
}
// [2026.11.03 복잡사건 107 「염씨 빚 갚으려 판 논」] 경영회생 — 임차기간 안 환매·일부 환매·상속인
{ const P = { 양도인: { 농업인: '예', 직접경작: '예' }, 공사양도: { 양도일: '2019-05-10', 면적: 10000, 납부세액: 30000000, 가산세: 2000000 }, 임차: { 시작일: '2019-05-10', 끝일: '2026-05-09', 직접경작: '예' }, 환매: { 환매일: '2025-11-20', 면적: 6000 }, 기준일: '2026-11-03' };
  const A = judgeFarmRevival_(P);
  const B = judgeFarmRevival_(Object.assign({}, P, { 환매: { 환매일: '2026-06-01', 면적: 6000 } }));
  const C = judgeFarmRevival_(Object.assign({}, P, { 사망: { 사망일: '2024-03-15', 상속인농업인: '아니오', 상속인직접경작: '예' }, 환매: { 환매일: '2025-11-20', 누가: '상속인' } }));
  ok(A.적용 === true && A.환급액 === 16800000 && B.적용 === false && C.적용 === false, '경영회생 — 일부 환매 환급·기간 뒤 환매·상속인 농업인 아님', JSON.stringify([A.결론, B.결론, C.결론]));
}
// [2026.11.03 복잡사건 108 「하씨 산불 난 과수원」] 재해손실 — 보험금 빼기·기한 뒤·도난·개시 전·증여 3개월
{ const R = [{ 이름: '과수원', 평가액: 300000000, 재난일: '2026-04-12', 재난종류: '산불', 손실비율: 60, 보험금: 50000000 }, { 이름: '아파트', 평가액: 900000000, 재난일: '2026-10-02', 재난종류: '화재', 손실가액: 200000000 }, { 이름: '농기계', 평가액: 40000000, 재난일: '2026-05-03', 재난종류: '도난', 손실가액: 40000000 }, { 이름: '임야', 평가액: 100000000, 재난일: '2026-01-20', 재난종류: '산사태', 손실가액: 30000000 }];
  const A = judgeDisasterLoss_({ 종류: '상속', 상속개시일: '2026-02-10', 피상속인거주자: '예', 재산: R, 기준일: '2026-11-03' });
  const B = judgeDisasterLoss_({ 종류: '상속', 상속개시일: '2026-02-10', 피상속인거주자: '예', 외국주소: '예', 재산: R, 기준일: '2026-11-03' });
  const C = judgeDisasterLoss_({ 종류: '증여', 증여일: '2026-06-15', 재산: [{ 이름: '하우스', 평가액: 500000000, 재난일: '2026-10-05', 재난종류: '태풍', 손실가액: 30000000 }], 기준일: '2026-11-03' });
  ok(A.재해손실공제 === 130000000 && B.재해손실공제 === 330000000 && C.재해손실공제 === 0 && C.신고기한 === '2026-09-30', '재해손실 — 보험금 빼기·기한 6/9개월·도난·개시 전·증여 3개월', JSON.stringify([A.결론, B.결론, C.결론]));
}
// [2026.11.03 복잡사건 122 「연씨 농지·축사 농업회사법인 출자」] 농업법인 현물출자 — 새 이월과세·옛 감면(채무 몫·§133 한도)·일반 회사·농업인 아님·2년 차 60% 추징+이자·상속 예외·8년 통산·편입 3년 제외 농지
{ const 기 = { 출자일: '2026-05-15', 법인종류: '농업회사법인', 농업법인: '예', 농업인: { 거주: '같은시군구', 경작연수: 12, 소득기준넘은해수: 1 }, 신청: '예정',
    자산: [{ 이름: '논', 종류: '농지', 실제경작: '예', 시가: 900000000, 취득가액: 400000000, 취득일: '2019-03-01', 지역: '군', 용도지역: '농림' },
      { 이름: '축사', 종류: '축사등', 시가: 300000000, 취득가액: 150000000, 취득일: '2020-06-01' },
      { 이름: '창고 옆 대지', 종류: '대지', 시가: 150000000, 취득가액: 60000000, 취득일: '2015-01-01' }],
    처분: [{ 날짜: '2027-09-01', 비율: 30, 방법: '양도' }, { 날짜: '2028-03-01', 비율: 30, 방법: '양도' }], 납부일: '2028-05-31' };
  const 산 = function (cs) { if (!cs || !cs.length) return 0; const r = calc('calculate_transfer_tax_multi', { transactions: cs }); return r ? r.산출세액_합계 : 0; };
  const A0 = judgeFarmCorpContribution_(기), 이월 = 산(A0.경우[0].이월칸들), A = judgeFarmCorpContribution_(Object.assign({}, 기, { 세액: 이월 }));
  const 옛 = Object.assign({}, 기, { 출자일: '2025-11-20', 처분: [], 자산: [Object.assign({}, 기.자산[0], { 담보채무: 180000000 }), 기.자산[1], 기.자산[2]] });
  const B0 = judgeFarmCorpContribution_(옛), B = judgeFarmCorpContribution_(Object.assign({}, 옛, { 세액: 산(B0.경우[0].엔진칸들.filter(function (c) { return c._이름 === '논'; })) }));
  const C = judgeFarmCorpContribution_(Object.assign({}, 기, { 법인종류: '주식회사' }));
  const D = judgeFarmCorpContribution_(Object.assign({}, 기, { 농업인: { 거주: '아님', 경작연수: 12 } }));
  const E = judgeFarmCorpContribution_(Object.assign({}, 기, { 세액: 이월, 처분: [{ 날짜: '2027-09-01', 비율: 60, 방법: '사망 상속' }] }));
  const F = judgeFarmCorpContribution_(Object.assign({}, 기, { 세액: 이월, 처분: [{ 날짜: '2028-07-01', 비율: 60, 방법: '양도' }] }));
  const G = judgeFarmCorpContribution_(Object.assign({}, 기, { 자산: [Object.assign({}, 기.자산[0], { 지역: '시동', 용도지역: '주거', 편입일: '2021-01-01' }), 기.자산[1]] }));
  const 지금 = 산(A.경우[0].엔진칸들), 못 = 산(A.경우[1].엔진칸들);
  console.log('122', 이월, 지금, 못, JSON.stringify([A.추징, B.감면세액, B.감면비율]));
  ok(A.결론 === '충족' && A.갈래 === '새 법(이월과세)' && A.대상자산.length === 2 && A.제외자산.length === 1 && 이월 > 0 && 지금 > 0 && 못 > 지금 + 이월 - 1
    && A.추징 && A.추징.사유일 === '2028-03-01' && A.추징.기한 === '2028-05-31' && A.추징.세액 === 이월 && A.추징.이자 === Math.floor(이월 * 670 * 22 / 100000)
    && B.갈래 === '옛 법(감면)' && B.감면세액 === 100000000 && Math.abs(B.감면비율[0] - 0.8) < 1e-9 && B.감면비율[1] === 0
    && C.결론 === '안 됨' && D.결론 === '안 됨' && !E.추징 && !F.추징 && F.알림.some(function (n) { return /8년/.test(n); })
    && G.제외자산.some(function (x) { return x.이름 === '논'; }) && G.대상자산.length === 1,
    '농업법인출자 — 새 이월과세·옛 감면 채무 몫·§133 1억 한도·일반 회사·농업인 아님·60% 추징+이자·상속 예외·8년 통산·편입 제외', JSON.stringify([A.표시, B.표시, C.표시, D.표시, G.표시]));
}
// [2026.11.03 복잡사건 121 「석씨 공장 둘 통합」] 중소기업 간 통합 이월과세(조특법 §31) — 요건 통과·설립 1년 안 법인+과점주주·주식가액 < 순자산·소비성서비스업·업무무관 부동산 제외·4년째 60% 양도 추징·가업승계 증여 예외·§32 길 그대로
{ const 기 = { 특례: '통합', 통합일: '2026-06-30', 통합법인설립일: '2019-03-02', 중소기업: '예', 소비성서비스업: '아니오', 업종: '금속가공 제조업', 주된자산모두승계: '예', 통합법인주주: '예', 과점주주: '예',
    자산: [{ 이름: '공장 토지', 종류: '토지', 시가: 1800000000, 사업사용: '예' }, { 이름: '공장 건물', 종류: '건물', 시가: 600000000, 사업사용: '예' }, { 이름: '기계장치', 종류: '기계', 시가: 200000000, 사업사용: '예' }, { 이름: '창고 옆 나대지', 종류: '토지', 시가: 300000000, 사업사용: '아니오', 업무무관: '예' }],
    부채: 900000000, 받은주식가액: 2000000000, 적용신청: '예정' };
  const A = judgeIncorp32_(기);
  const B = judgeIncorp32_(Object.assign({}, 기, { 통합법인설립일: '2025-12-01' }));
  const C = judgeIncorp32_(Object.assign({}, 기, { 받은주식가액: 1500000000 }));
  const D = judgeIncorp32_(Object.assign({}, 기, { 소비성서비스업: '예' }));
  const E = judgeIncorp32_(Object.assign({}, 기, { 처분: [{ 날짜: '2030-03-15', 비율: 60, 방법: '양도' }] }));
  const F = judgeIncorp32_(Object.assign({}, 기, { 처분: [{ 날짜: '2029-01-10', 비율: 60, 방법: '증여', 가업승계특례: '예' }] }));
  const G = judgeIncorp32_({ 전환방법: '현물출자', 소비성서비스업: '아니오', 자산: [{ 이름: '상가', 종류: '건물', 시가: 500000000, 사업사용: '예' }], 자본금: 500000000, 설립등기일: '2026-06-30' });
  const 순 = 1800000000 + 600000000 + 200000000 + 300000000 - 900000000;
  console.log('121', JSON.stringify([A.결론, A.표시, A.순자산가액, A.엔진칸, A.사후관리기산일, A.제외자산.map(function (x) { return x.이름; }), B.결론, C.결론, D.결론, E.알림.filter(function (n) { return /⚠/.test(n); }), F.알림.filter(function (n) { return /⚠/.test(n); }).length, G.특례, G.엔진칸]));
  ok(A.결론 === '충족' && A.특례 === '조특법 §31' && A.엔진칸.provision === 'sect31' && A.순자산가액 === 순 && A.제외자산.length === 1 && A.대상자산.length === 3 && A.사후관리기산일 === '2026-06-30'
    && A.할일.some(function (h) { return h.때 === '2026-08-31'; }) && A.할일.some(function (h) { return h.때 === '2031-06-30'; })
    && B.결론 === '안 됨' && C.결론 === '안 됨' && D.결론 === '안 됨'
    && E.알림.some(function (n) { return /⚠/.test(n) && /2030-05-31/.test(n) && /§31⑦/.test(n); }) && E.할일.some(function (h) { return h.때 === '2030-05-31'; })
    && !F.알림.some(function (n) { return /⚠/.test(n); }) && G.특례 === '조특법 §32' && G.엔진칸.provision === 'sect32',
    '중소기업통합 — §31 요건·설립 1년 안 과점주주·주식가액 부족·소비성·업무무관 제외·5년 안 60% 양도·가업승계 예외·§32 길 그대로', JSON.stringify([A.표시, B.표시, C.표시, D.표시]));
}
// [2026.11.03 복잡사건 120 「방씨 철공소 이전」] 공장 이전 분할납부 — 지방 산단 이전 60%·대전 산단 밖 ✘·대전 산단 ✔·1.5년 가동 토지만·예정가 18억→실제 15억 정산·2년 뒤 폐업 추징·3년 넘김 ✘·중소기업 경로
{ const 거래 = { assetType: 'land', transferPrice: 3000000000, acquisitionPrice: 1200000000, necessaryExpenses: 50000000, acquisitionDate: '2010-05-01', transferDate: '2026-03-20', acquisitionCause: 'purchase' };
  const 전 = calc('calculate_transfer_tax_multi', { transactions: [거래] }); const 세 = 전 ? 전.산출세액_합계 : 0;
  const 기 = { 양도일: '2026-03-20', 사업인정고시일: '2025-09-01', 양수자: '사업시행자', 기존공장: { 소재: '과밀억제', 가동시작: '2012-03-01', 토지취득일: '2010-05-01', 양도가액: 3000000000, 양도차익: 1750000000 },
    신규공장: { 소재: '충북 음성', 산업단지: '예', 예정가액: 1800000000 }, 세액: 세, 거래: 거래, 오늘: '2026-11-03' };
  const 신 = function (x) { return Object.assign({}, 기, { 신규공장: Object.assign({}, 기.신규공장, x) }); };
  const A = judgeFactoryRelocation_(기);
  const B = judgeFactoryRelocation_(신({ 소재: '대전광역시', 산업단지: '아니오' }));
  const C = judgeFactoryRelocation_(신({ 소재: '대전광역시', 산업단지: '예' }));
  const D = judgeFactoryRelocation_(Object.assign({}, 기, { 기존공장: Object.assign({}, 기.기존공장, { 가동시작: '2024-03-01', 토지취득일: '2019-01-01' }) }));
  const E = judgeFactoryRelocation_(신({ 취득가액: 1500000000, 사업개시일: '2027-06-01' }));
  const F = judgeFactoryRelocation_(신({ 사업개시일: '2027-06-01' }).폐업일 ? 기 : Object.assign(신({ 취득가액: 1800000000, 사업개시일: '2027-06-01' }), { 폐업일: '2028-04-15' }));
  const G = judgeFactoryRelocation_(신({ 취득가액: 1800000000, 사업개시일: '2029-06-01' }));
  const H = judgeFactoryRelocation_(Object.assign({}, 기, { 특례: '중소기업이전', 사업인정고시일: '', 양수자: '', 중소기업: '예', 신규공장: { 소재: '충남 천안', 예정가액: 3500000000 } }));
  const ea = calc('calculate_transfer_tax_multi', { transactions: [A.엔진칸] });
  console.log('120', 세, JSON.stringify([A.비율, A.분할세액, A.지금낼세액, A.납부일정, A.예정신고기한, A.이전마감]), JSON.stringify([D.토지만, D.결론, E.정산, F.추징, G.결론, H.조문, H.분할세액, B.표시, C.결론]));
  ok(세 > 0 && ea && ea.산출세액_합계 === 세 && A.분할 === true && A.비율 === 60 && A.분할세액 === Math.floor(세 * 0.6) && A.지금낼세액 === 세 - A.분할세액 && A.납부일정.length === 5 && A.납부일정[0].때 === '2032-05-31' && A.예정신고기한 === '2026-05-31'
    && B.분할 === false && C.분할 === true && D.분할 === true && D.토지만 === true && E.정산 && E.정산.넘게받은세액 === Math.floor(세 * 0.1) && E.비율 === 50
    && F.추징 && F.추징.세액 === Math.floor(세 * 0.6) && F.추징.납부기한 === '2028-06-30' && F.추징.이자 > 0 && G.분할 === false && H.조문 === '조특법 §85의8' && H.분할 === true && H.비율 === 100,
    '공장이전 — 지방 60%·광역시 산단 밖/안·토지만·예정가 정산·폐업 추징·3년 넘김·중소기업 100%', JSON.stringify([A.표시, B.표시, C.표시, D.표시, E.표시, F.표시, G.표시, H.표시]));
}
// [2026.11.03 복잡사건 119 「엄씨 논 바꾸기」] 농지 교환 — 도시 주거지역 편입 3년 지나 제외 농지·군 지역 3호 잠정·3년 안 수용·사망 통산·차액 1/4 초과·단서 가·환지예정지·농지소재지 밖
{ const 기 = { 교환일: '2026-05-10', 사유: '경작상필요',
    넘긴농지: { 시가: 400000000, 취득가액: 150000000, 취득일: '2010-04-01', 농지: '예', 지역: '시동', 용도지역: '주거', 편입일: '2021-03-01', 단서가: '아니오', 단서나: '아니오' },
    받은농지: { 시가: 340000000, 농지: '예' }, 정산금: { 받음: 60000000 }, 경작: { 시작: '2026-05-10', 거주지역: '같은시군구' } };
  const 군 = function (x) { return Object.assign({}, 기, x, { 넘긴농지: Object.assign({}, 기.넘긴농지, { 지역: '군', 용도지역: '그밖', 편입일: '' }, (x && x.넘긴농지) || {}) }); };
  const A = judgeFarmlandExchange_(기);
  const G = judgeFarmlandExchange_(군({}));
  const H = judgeFarmlandExchange_(군({ 경작: Object.assign({}, 기.경작, { 수용일: '2028-05-01' }) }));
  const I = judgeFarmlandExchange_(군({ 경작: Object.assign({}, 기.경작, { 사망일: '2027-05-10', 상속인계속경작: '예' }), 오늘: '2029-06-01' }));
  const J = judgeFarmlandExchange_(군({ 받은농지: { 시가: 280000000, 농지: '예' }, 정산금: { 받음: 120000000 } }));
  const K = judgeFarmlandExchange_(Object.assign({}, 기, { 넘긴농지: Object.assign({}, 기.넘긴농지, { 단서가: '예' }), 경작: Object.assign({}, 기.경작, { 끝: '2030-01-01' }) }));
  const L = judgeFarmlandExchange_(군({ 넘긴농지: { 환지예정지지정일: '2022-01-01' } }));
  const M = judgeFarmlandExchange_(군({ 경작: { 시작: '2026-05-10', 거주지역: '아님' } }));
  const t = function (k) { const r = calc('calculate_transfer_tax_multi', { transactions: [k.엔진칸] }); return r ? r.납부세액_합계 : 0; };
  const ea = A.경우.map(t), eg = G.경우.map(t), ek = t(K.경우[0]);
  console.log('119', JSON.stringify(A.경우.map(function (k, i) { return [k.이름.slice(0, 40), ea[i]]; })), JSON.stringify(G.경우.map(function (k, i) { return [k.이름.slice(0, 40), eg[i]]; })), ek, JSON.stringify([G.할일, A.차액비율, A.양도가액]));
  ok(A.결론 === '안 됨' && A.제외농지 === true && A.양도가액 === 400000000 && !A.엔진칸.isFarmlandExchange && ea[0] > 0 && A.경우.some(function (k) { return k.견주기; }) && ea[1] === 0
    && G.비과세 === true && G.잠정 === true && G.삼년되는날 === '2029-05-10' && G.할일.some(function (h) { return h.때 === '2029-05-10까지'; }) && eg[0] === 0 && eg[1] > 0
    && H.삼년경작 === true && H.잠정 !== true && I.삼년경작 === true && J.결론 === '안 됨' && J.차액비율 === 30
    && K.제외농지 === false && K.비과세 === true && ek === 0 && L.제외농지 === true && L.결론 === '안 됨' && M.결론 === '안 됨' && M.삼년경작 === false,
    '농지교환 — §153④1호 제외·3호 잠정·⑤수용·⑥상속 통산·1/4 초과·단서 가·④2호·농지소재지 밖·엔진 비과세/과세', JSON.stringify([A.표시, G.표시, H.표시, I.표시, J.표시, K.표시, L.표시, M.표시, ea, eg, ek]));
}
// [2026.11.03 복잡사건 118 「설씨 가족회사 주식 증여」] 비상장주식 평가 방법 — 부동산과다 2:3·추정이익 네 요건(신고기한 넘긴 평가서 ✘)·사업개시 3년 미만·부동산 80%·처분이익으로 일시 사건 셈·할증 배제·심의 기한
{ const 기 = { 원인: '증여', 평가기준일: '2026-06-30',
    회사: { 사업개시일: '2019-03-01', 발행주식수: 100000, 순손익: [3000000000, 300000000, 200000000], 처분손익: [2800000000, 0, 0], 세전손익: [3000000000, 300000000, 200000000],
      자산총액: 10000000000, 부동산등가액: 5500000000, 주식등가액: 0, 순자산가액: 8000000000, 중소기업: '아니오', 중견매출5천억미만: '아니오', 청산중: '아니오', 휴업폐업: '아니오' },
    주주: { 최대주주: '예', 평가할주식수: 20000 },
    추정이익: { '1주당': 3500, 평가기관수: 2, 신고: '예', 산정기준일: '2026-06-30', 작성일: '2026-08-20' } };
  const m = function (o) { return Object.assign({}, 기, o); }, mc = function (o) { return m({ 회사: Object.assign({}, 기.회사, o) }); };
  const A = judgeUnlistedValuation_(기);
  const B = judgeUnlistedValuation_(m({ 추정이익: {} }));
  const C = judgeUnlistedValuation_(mc({ 사업개시일: '2024-01-01' }));
  const D = judgeUnlistedValuation_(mc({ 부동산등가액: 8200000000 }));
  const E = judgeUnlistedValuation_(m({ 추정이익: Object.assign({}, 기.추정이익, { 작성일: '2026-10-10' }) }));
  const F = judgeUnlistedValuation_(m({ 추정이익: Object.assign({}, 기.추정이익, { 신고: null }) }));
  const G = judgeUnlistedValuation_(mc({ 결손3년: '예' }));
  const v = function (k) { const r = calc('calculate_unlisted_stock_value', k.엔진칸); return r ? r.평가총액 : 0; };
  const gt = function (amt) { const r = calc('calculate_gift_tax', { giftAmount: amt, relation: '직계존속', giftDate: '2026-06-30' }); return r ? (r.납부할세액 != null ? r.납부할세액 : r.납부세액) : 0; };
  const va = A.경우.map(v), vb = B.경우.map(v);
  console.log('118', JSON.stringify(A.경우.map(function (k, i) { return [k.이름.slice(0, 40), va[i], gt(va[i])]; })), JSON.stringify(B.경우.map(function (k, i) { return [k.이름.slice(0, 40), vb[i], gt(vb[i])]; })),
    JSON.stringify([v(C.경우[0]), v(D.경우[0]), v(E.경우[0]), F.잠정, F.경우.map(function (k) { return k.이름.slice(0, 20); }), v(G.경우[0]), G.할증배제]), JSON.stringify(A.할일.map(function (h) { return h.때; })));
  ok(A.가중치 === '2:3' && A.부동산비율 === 55 && A.추정이익사용 && A.할증 && A.신고기한 === '2026-09-30' && va[0] === 1536000000 && A.할일[0].때 === '2026-07-22까지'
    && vb[0] === 2719992000 && B.경우.some(function (k) { return /3:2/.test(k.이름); }) && vb[B.경우.findIndex(function (k) { return /3:2/.test(k.이름); })] === 3120000000
    && B.경우.some(function (k) { return /추정이익 없이/.test(k.이름); })
    && A.결론 === '충족' && !A.잠정 && C.순자산가치만 && v(C.경우[0]) === 1920000000 && v(D.경우[0]) === 1920000000 && !E.추정이익사용 && E.추정요건.some(function (r) { return r.결과 === '✘'; }) && !E.잠정 && v(E.경우[0]) === 2719992000
    && F.잠정 && !F.추정이익사용 && F.경우.some(function (k) { return /\[모름\]/.test(k.이름); }) && !G.할증 && v(G.경우[0]) === 1280000000,
    '비상장평가 — 2:3·추정이익·신고기한 넘긴 평가서·개시 3년·부동산 80%·모름·할증 배제', JSON.stringify([A.표시, B.표시, C.표시, D.표시, E.표시, F.표시, G.표시, va, vb]));
}
// [2026.11.03 복잡사건 117 「맹씨 회사 주식 교환」] 주식의 포괄적 교환 과세이연 — 2년 안 취득분 금전 간주로 80% 못 넘음·이연 뒤 2년 안 처분 추징·소액주주·기간 뒤 처분·지배주주 모름·모회사 보유 안 함
{ const 기 = { 교환: { 종류: '교환', 교환일: '2026-03-31', 사업연도말: '12-31', 양법인1년사업: '예', 자회사사업계속: '예', 지분대로배정: '예' },
    주주: { 취득가액: 300000000, 취득일: '2015-06-01', 지분율: 30, 지분시가: 2800000000, 지배주주: '예', 대주주: '예', 중소기업: '아니오' },
    대가: { 모회사주식가액: 2400000000, 모회사주식수: 40000, 금전등: 400000000 }, 보유: { 모회사: '예', 주주: '예' },
    모회사사전취득: { 지배주주: '아니오', '2년안취득지분율': 30, '2년안취득가액': 750000000 } };
  const 없이 = Object.assign({}, 기, { 모회사사전취득: {}, 처분: [{ 날짜: '2027-05-20', 주식수: 10000, 양도가액: 700000000 }] });
  const A = judgeShareSwap_(기);
  const B = judgeShareSwap_(없이);
  const C = judgeShareSwap_(Object.assign({}, 없이, { 주주: Object.assign({}, 기.주주, { 지분율: 0.5, 지분시가: 500000000, 지배주주: null }) }));
  const D = judgeShareSwap_(Object.assign({}, 없이, { 처분: [{ 날짜: '2029-03-01', 주식수: 10000, 양도가액: 700000000 }] }));
  const E = judgeShareSwap_(Object.assign({}, 기, { 모회사사전취득: { '2년안취득지분율': 30, '2년안취득가액': 750000000 } }));
  const F = judgeShareSwap_(Object.assign({}, 없이, { 보유: { 모회사: '아니오' }, 처분: [] }));
  const t = function (k) { const r = calc('calculate_stock_transfer_tax', k.엔진칸); return r ? r.납부세액_합계 : 0; };
  const ea = A.경우.map(t), eb = B.경우.map(t);
  const 추 = B.경우.filter(function (k) { return k.추징; })[0], 처B = B.경우.filter(function (k) { return /^처분/.test(k.이름); })[0];
  const 처C = C.경우.filter(function (k) { return /^처분/.test(k.이름); })[0], 처D = D.경우.filter(function (k) { return /^처분/.test(k.이름); })[0];
  const g1 = calc('calculate_share_swap_gain_recognition', { acquisitionPrice: 300000000, stockConsiderationValue: 2400000000, otherConsiderationValue: 400000000, deemedCashPriorAcquisition: 250000000 });
  const g2 = calc('calculate_share_swap_gain_recognition', { acquisitionPrice: 300000000, stockConsiderationValue: 2400000000, otherConsiderationValue: 400000000, swappedShares: 40000, soldShares: 10000 });
  console.log('117', JSON.stringify(A.경우.map(function (k, i) { return [k.이름.slice(0, 34), ea[i]]; })), JSON.stringify(B.경우.map(function (k, i) { return [k.이름.slice(0, 34), eb[i]]; })), '추징세액', t(추) - eb[0], JSON.stringify(B.할일), JSON.stringify([g1.이연적용여부, g2.나중_취득가액_합계, g2.나중_취득가액_처분분]));
  ok(A.결론 === '안 됨' && A.금전간주 === 250000000 && A.판정비율 < 80 && /전부 양도/.test(A.경우[0].이름) && A.경우.some(function (k) { return k.견주기 && /2년 안/.test(k.이름); }) && ea[0] > ea[1] && ea[1] > 0
    && B.이연 === true && B.지금과세 === 400000000 && B.나중취득가액합계 === 300000000 && JSON.stringify(B.사후관리기간) === '["2027-01-01","2028-12-31"]' && !!추 && t(추) > eb[0]
    && 처B.엔진칸.acquisitionPrice === 600000000 && B.할일.some(function (h) { return h.때 === '2027-08-31까지'; })
    && C.대상주주 === false && !C.추징 && 처C.엔진칸.acquisitionPrice === 75000000 && !D.추징 && 처D.엔진칸.acquisitionPrice === 75000000
    && E.잠정 === true && E.이연 === true && E.경우.some(function (k) { return /\[모름\] 이연이 안 되면/.test(k.이름); }) && F.결론 === '안 됨'
    && g1.이연적용여부 === false && g2.나중_취득가액_합계 === 300000000 && g2.나중_취득가액_처분분 === 75000000,
    '주식교환 — 2년 안 취득분 금전 간주·추징·소액주주·기간 뒤·지배주주 모름·모회사 보유 안 함·엔진 나중 취득가액', JSON.stringify([A.표시, B.표시, C.표시, D.표시, E.표시, F.표시, ea, eb]));
}
// [2026.11.03 복잡사건 116 「염씨 산 소나무 숲」] 자경산지 감면 — 경영 기간은 인가일부터(취득일부터 세면 30%로 부풂)·상속 승계·거주 안 함·준보전산지·상속 뒤 6개월·편입 3년 지남
{ const 기 = { 산지: { 취득일: '1990-04-01', 인가일: '2008-05-01', 양도일: '2026-06-15', 보전산지: '예', 양도가액: 600000000, 취득가액: 30000000, 필요경비: 10000000 },
    사람: { 임업인: '예', 양도일거주자: '예', 거주지역: '같은 시군구', 거주연수: 36, 경영방법: '상시 종사' } };
  const A = judgeSelfForest_(기);
  const B = judgeSelfForest_({ 산지: { 취득일: '2019-03-01', 인가일: '2000-01-01', 양도일: '2026-06-15', 보전산지: '예', 양도가액: 600000000, 취득가액: 200000000 }, 사람: { 임업인: '예', 거주지역: '연접', 경영방법: '절반 이상 자기 노동' },
    경영: [{ 시작: '2000-01-01', 끝: '2019-02-28', 누가: '피상속인' }, { 시작: '2019-03-01', 끝: '2026-06-15', 누가: '본인' }], 상속: { 상속받은날: '2019-03-01', 상속후경영개월: 87 } });
  const C = judgeSelfForest_(Object.assign({}, 기, { 사람: Object.assign({}, 기.사람, { 거주지역: '아님' }) }));
  const D = judgeSelfForest_(Object.assign({}, 기, { 산지: Object.assign({}, 기.산지, { 보전산지: '아니오' }) }));
  const E = judgeSelfForest_({ 산지: { 취득일: '2025-01-10', 인가일: '2000-01-01', 양도일: '2026-06-15', 보전산지: '예' }, 사람: { 임업인: '예', 거주지역: '30km 이내', 경영방법: '상시 종사' },
    경영: [{ 시작: '2000-01-01', 끝: '2025-01-09', 누가: '피상속인' }, { 시작: '2025-01-10', 끝: '2025-07-10', 누가: '본인' }], 상속: { 상속받은날: '2025-01-10', 상속후경영개월: 6 } });
  const F = judgeSelfForest_(Object.assign({}, 기, { 산지: Object.assign({}, 기.산지, { 도시지역: '예', 주거지역편입일: '2020-01-01', 기준시가: { 취득: 20000000, 편입: 200000000, 양도: 400000000 } }) }));
  const t = function (k) { const r = calc('calculate_transfer_tax_multi', { transactions: [k.엔진칸] }); return r ? r.납부세액_합계 : 0; };
  const ea = A.경우.map(t), eb = B.경우.map(t);
  console.log('116', JSON.stringify(A.경우.map(function (k, i) { return [k.이름.slice(0, 30), ea[i]]; })), JSON.stringify(B.경우.map(function (k, i) { return [k.이름.slice(0, 30), eb[i]]; })), t(F.경우[0]));
  ok(A.감면율 === 10 && A.직접경영연수 === 18 && A.경우[0].엔진칸.forestManagedYears === 18 && A.경우.some(function (k) { return k.견주기 && /취득일부터/.test(k.이름); })
    && ea[0] > 0 && ea[0] > ea[1] && ea[2] > ea[0]
    && B.감면율 === 20 && B.피상속인기간더함 === true && C.결론 === '안 됨' && /감면 없음/.test(C.경우[0].이름) && D.결론 === '안 됨'
    && E.피상속인기간더함 === null && E.감면율 === 0 && E.잠정 === true && E.경우.some(function (k) { return /\[모름\]/.test(k.이름); })
    && F.잠정 === true && F.경우[0].엔진칸.zoneIncorporated === true && A.할일[0].때 === '2026-08-31까지',
    '자경산지 — 인가일부터·상속 승계·거주 안 함·준보전·상속 뒤 6개월·편입 3년 지남', JSON.stringify([A.결론, A.표시, B.표시, C.표시, D.표시, E.표시, F.표시, ea, eb]));
}
// [2026.11.03 복잡사건 115 「곽씨 종중 땅」] 법인 아닌 단체 양도 — 분배 안 하면 1거주자·나누면 구성원별·일부만 확인·법인 승인·2005년 전 종중 농지 비사업용 아님·종원 명의
{ const 기 = { 단체: { 이름: '곽씨 종중', 법인승인: '아니오' }, 분배: { 비율정함: '아니오', 사실상분배: '아니오', 구성원: [{ 이름: '갑', 비율: 25 }, { 이름: '을', 비율: 25 }, { 이름: '병', 비율: 25 }, { 이름: '정', 비율: 25 }] },
    토지: { 종류: '농지', 취득일: '1990-05-01', 취득가액: 50000000, 양도일: '2026-06-10', 양도가액: 1200000000, 필요경비: 20000000, 등기명의: '곽갑수' } };
  const A = judgeClanLand_(기);
  const B = judgeClanLand_(Object.assign({}, 기, { 분배: Object.assign({}, 기.분배, { 사실상분배: '예' }) }));
  const C = judgeClanLand_(Object.assign({}, 기, { 단체: { 이름: '곽씨 종중', 법인승인: '예' } }));
  const D = judgeClanLand_(Object.assign({}, 기, { 분배: { 비율정함: '예', 구성원: [{ 이름: '갑', 비율: 25 }, { 이름: '을', 비율: 25 }] } }));
  const E = judgeClanLand_(Object.assign({}, 기, { 토지: Object.assign({}, 기.토지, { 취득일: '2010-03-01' }) }));
  const F = judgeClanLand_(Object.assign({}, 기, { 분배: { 구성원: 기.분배.구성원 } }));
  const t = function (k) { const r = calc('calculate_transfer_tax_multi', { transactions: [k.엔진칸] }); return r ? r.납부세액_합계 : 0; };
  const ea = A.경우.map(t), eb = B.경우.map(t);
  console.log('115', JSON.stringify(A.경우.map(function (k, i) { return [k.이름.slice(0, 26), ea[i]]; })), JSON.stringify(eb));
  ok(A.과세방식 === '1거주자' && A.비사업용 === false && A.경우[0].엔진칸.isNonBusinessLand === undefined && A.경우.some(function (k) { return k.견주기 && /구성원/.test(k.이름); }) && A.경우.some(function (k) { return /비사업용/.test(k.이름) && k.엔진칸.isNonBusinessLand; })
    && A.알림.some(function (x) { return /§14①/.test(x); }) && A.할일.some(function (x) { return x.때 === '2026-08-31까지'; })
    && B.과세방식 === '구성원별' && B.경우.filter(function (k) { return !k.견주기 && /구성원/.test(k.이름); }).length === 4 && B.경우[0].엔진칸.transferPrice === 300000000
    && C.법인으로봄 === true && /법인세/.test(C.결론) && D.과세방식 === '섞임' && D.경우.some(function (k) { return /나머지/.test(k.이름) && k.엔진칸.transferPrice === 600000000; })
    && E.비사업용 === null && E.경우.some(function (k) { return /비사업용 토지면/.test(k.이름); }) && F.과세방식 === null && F.경우.length >= 5
    && ea[0] > 0 && eb[0] > 0 && ea[0] > eb.slice(0, 4).reduce(function (s, x) { return s + x; }, 0),
    '법인아닌단체 — 1거주자·구성원별·섞임·법인 승인·2005년 전 종중 농지·2010년 취득·분배 모름', JSON.stringify([A.결론, B.결론, C.결론, D.결론, E.결론, F.결론, ea, eb]));
}
// [2026.11.03 복잡사건 114 「노씨 부부 연이은 상속」] 단기재상속 — 1년 6개월 뒤 배우자 사망(2년 이내 90%)·처분 재산 뺌·미납 전의 상속세 공과금·경과연수 꽉 찬 해 잘못·10년 지남
{ const 기 = { 전상속개시일: '2025-03-10', 상속개시일: '2026-09-20', 이번피상속인지위: '배우자', 전상속세산출세액: 600000000, 전상속재산가액: 3000000000, 전상속세과세가액: 2800000000,
    재상속재산: [{ 이름: '서초 아파트', 전가액: 800000000, 지금가액: 950000000, 남음: '예' }, { 이름: '예금', 전가액: 200000000, 지금가액: 0, 남음: '아니오' }],
    이번피상속인몫전상속세: 100000000, 사망전납부액: 40000000, 전배우자분할: '예',
    엔진칸: { taxableEstateAmount: 1500000000, hasSpouse: false, childCount: 2, filingStatus: 'ontime' } };
  const A = judgeReinheritance_(기);
  const B = judgeReinheritance_(Object.assign({}, 기, { 상속개시일: '2035-04-01' }));
  const C = judgeReinheritance_(Object.assign({}, 기, { 이번피상속인지위: '그밖(남)' }));
  const D = judgeReinheritance_(Object.assign({}, 기, { 상속개시일: '2025-08-01', 전배우자분할: '아니오' }));
  const e = A.경우.map(function (k) { return calc('calculate_inheritance_tax', k.엔진칸); });
  console.log('114', JSON.stringify(A.경우.map(function (k, i) { return [k.이름.slice(0, 18), e[i].산출세액, e[i].단기재상속세액공제, e[i].납부세액]; })));
  ok(A.공제율 === 90 && A.이내 === 2 && A.재상속분 === 800000000 && A.처분재산 === 200000000 && A.미납전상속세 === 60000000 && A.경우[0].엔진칸.taxableEstateAmount === 1440000000
    && A.경우.some(function (k) { return /공과금/.test(k.이름); }) && A.경우.some(function (k) { return /꽉 찬 해/.test(k.이름); }) && A.경우.some(function (k) { return /시가/.test(k.이름); })
    && e[0].단기재상속세액공제 > 0 && B.경우[0].엔진칸.priorInheritanceTax === undefined && /없음/.test(B.결론) && /없음/.test(C.결론)
    && D.할일.some(function (x) { return /분할/.test(x.무엇); }) && D.알림.some(function (x) { return /§24①/.test(x); }) && D.공제율 === 100,
    '재상속 — 2년 이내 90%·처분 재산 뺌·미납 전의 상속세 공과금·꽉 찬 해 잘못·10년 지남·지위 아님·분할기한 전 사망', JSON.stringify([A.결론, B.결론, C.결론, D.결론, e.map(function (x) { return x.납부세액; })]));
}
// [2026.11.03 복잡사건 113 「소씨 상가 신탁 수익권」] 신탁 수익권 양도 — 수익권 일부 양도·위탁자 지위까지 넘김(신탁재산 양도)·수익증권 제외·담보 우선수익권·지배권 모름 두 경우
{ const 일 = { 수익권: { 종류: '부동산 관리신탁 수익권(수익 40%)' }, 양도인지위: '수익자', 지배이전: { 수익권전부: '아니오' }, 양도일: '2026-05-15', 양도가액: 460000000, 취득일: '2021-03-10', 취득가액: 300000000, 양도비용: 4000000 };
  const A = judgeTrustBeneficiary_(일);
  const 자 = { 수익권: { 종류: '부동산 관리신탁 수익권(자익신탁 전부)' }, 양도인지위: '위탁자겸수익자', 지배이전: { 위탁자지위이전: '예', 수익권전부: '예' }, 양도일: '2026-05-15', 양도가액: 1200000000, 취득가액: 700000000, 양도비용: 10000000, 신탁재산: { 자산: '상가', 취득일: '2015-03-01', 취득가액: 700000000 } };
  const B = judgeTrustBeneficiary_(자);
  const C = judgeTrustBeneficiary_({ 수익권: { 종류: '금전신탁 수익증권', 자본시장법수익증권: '예' }, 양도일: '2026-05-15', 양도가액: 100000000, 취득가액: 90000000 });
  const D = judgeTrustBeneficiary_({ 수익권: { 종류: '담보신탁 1순위 우선수익권', 담보채권자: '예', 채권원리금범위: '예' }, 양도일: '2026-05-15', 양도가액: 500000000, 취득가액: 500000000 });
  const D2 = judgeTrustBeneficiary_({ 수익권: { 종류: '담보신탁 1순위 우선수익권', 담보채권자: '예', 채권원리금범위: '아니오' }, 양도일: '2026-05-15', 양도가액: 520000000, 취득가액: 500000000 });
  const E = judgeTrustBeneficiary_(Object.assign({}, 자, { 지배이전: {} }));
  const F = judgeTrustBeneficiary_(Object.assign({}, 일, { 양수인관계: '아들', 위탁자통제: { 해지권: '예' } }));
  const ea = calc('calculate_stock_transfer_tax', A.경우[0].엔진칸);
  const eb = calc('calculate_transfer_tax_multi', { transactions: [B.경우[0].엔진칸] });
  const ebw = calc('calculate_stock_transfer_tax', B.경우[1].엔진칸);
  console.log('113', JSON.stringify([ea.과세표준, ea.산출세액, ea.납부세액_합계, ea.예정신고기한, ebw.산출세액, ebw.납부세액_합계]), JSON.stringify([eb.합산과세표준, eb.산출세액_합계, eb.납부세액_합계]));
  ok(A.결론 === '신탁 수익권 양도(§94①6호)' && A.경우.length === 1 && B.지배권이전 === true && B.경우[0].엔진 === 'calculate_transfer_tax' && B.경우.length === 2 && C.제외수익권 === true && C.경우.length === 0 && D.제외수익권 === true && D2.제외수익권 === false && E.지배권이전 === null && E.경우.length === 2
    && F.알림.some(function (x) { return /§2의3②/.test(x); }) && F.알림.some(function (x) { return /§101①/.test(x); }) && ea.산출세액 === 30700000 && /2026-07-31/.test(ea.예정신고기한),
    '신탁수익권 — 수익권 일부 양도·위탁자 지위 이전(신탁재산 양도)·수익증권 제외·담보 우선수익권 범위 안/밖·지배권 모름 두 경우·특수관계·위탁자 귀속', JSON.stringify([A.결론, B.결론, C.결론, D.결론, D2.결론, E.결론, ea.산출세액, ea.예정신고기한]));
}
// [2026.11.03 복잡사건 112 「여씨 배우자 양도」] §44 — 대가 일부 입증·전부 입증·경매 배제·우회 3년·②단서
{ const 상 = { 관계: '아내', 처분방식: '매매', 자산: '상가', 시가: 900000000, 대가: 600000000, 양도일: '2026-03-10', 취득일: '2012-05-01', 취득가액: 350000000, 양도비용: 10000000,
    대가출처: [{ 금액: 200000000, 출처: '신고소득(근로)', 증빙: '예' }, { 금액: 100000000, 출처: '예금 해지(재산처분)', 증빙: '예' }, { 금액: 300000000, 출처: '은행 대출', 증빙: '예' }] };
  const A = judgeSpouseTransfer44_(상);
  const B = judgeSpouseTransfer44_(Object.assign({}, 상, { 대가출처: [{ 금액: 400000000, 출처: '신고소득', 증빙: '예' }, { 금액: 200000000, 출처: '아파트 처분', 증빙: '예' }] }));
  const C = judgeSpouseTransfer44_(Object.assign({}, 상, { 처분방식: '경매', 대가: 880000000, 대가출처: [] }));
  const 땅 = { 관계: '아들', 자산: '토지', 취득일: '2010-04-01', 취득가액: 150000000, 우회: { 당초양도일: '2023-03-01', 당초양도가액: 300000000, 재양도일: '2025-02-01', 재양도시가: 500000000, 재양도대가: 400000000, 최종양수인관계: '아들', 중간특수관계: '예', 중간관계: '동생', 당초양도자결정세액: 20000000, 양수자결정세액: 10000000, 비교증여세: 80000000 } };
  const E = judgeSpouseTransfer44_(땅);
  const F = judgeSpouseTransfer44_(Object.assign({}, 땅, { 우회: Object.assign({}, 땅.우회, { 재양도일: '2026-04-01' }) }));
  const G = judgeSpouseTransfer44_(Object.assign({}, 땅, { 우회: Object.assign({}, 땅.우회, { 당초양도자결정세액: 80000000, 양수자결정세액: 40000000 }) }));
  const g = calc('calculate_gift_tax', Object.assign({ filingStatus: 'ontime' }, A.경우[0].엔진칸));
  ok(A.추정 === true && A.경우.length >= 3 && B.추정 === false && C.추정 === false && C.배제 === true && E.추정 === true && F.추정 === false && G.추정 === false && g.납부세액 === 48500000,
    '배우자양도추정 — 일부 입증 세 경우·전부 입증·경매 배제·우회 3년·②단서', JSON.stringify([A.결론, B.결론, C.결론, E.결론, F.결론, G.결론, g.납부세액]));
}
// [2026.11.03 복잡사건 111 「연씨 장기일반 매입임대」] §97의5 감면 — 3개월 안 등록·10년 계속 임대(6개월 공실)·자동말소 아파트·엔진 §97의3과 겹쳐 받기 막음
{ const 계 = [{ 시작: '2018-07-01', 끝: '2020-06-30', 보증금: 200000000 }, { 시작: '2020-07-15', 끝: '2022-07-14', 보증금: 210000000 }, { 시작: '2022-08-01', 끝: '2024-07-31', 보증금: 220000000 }, { 시작: '2024-08-01', 끝: '2026-07-31', 보증금: 230000000 }, { 시작: '2026-08-01', 끝: '2028-07-31', 보증금: 240000000 }];
  const 바 = { transferDate: '2028-08-20', transferPrice: 500000000, assetType: 'house', acquisitionDate: '2018-05-10', acquisitionPrice: 220000000, acquisitionCause: 'purchase', houseCount: 3, necessaryExpenses: 5000000 };
  const 기 = { 양도일: '2028-08-20', 거주자: '예', 취득일: '2018-05-10', 등록일: '2018-07-01', 종류: '매입', 계약: 계, 전용면적: 59, 수도권: '예', 임대개시기준시가: 250000000, 기준시가: { 취득: 150000000, 임대끝: 340000000, 양도: 340000000 }, 바탕: 바 };
  const A = judgeRental9705_(기);
  const B = judgeRental9705_(Object.assign({}, 기, { 등록일: '2018-09-20' }));
  const C = judgeRental9705_(Object.assign({}, 기, { 계약: 계.map(function (c, i) { return i === 2 ? { 시작: '2023-02-20', 끝: c.끝, 보증금: c.보증금 } : c; }) }));
  const D = judgeRental9705_(Object.assign({}, 기, { 아파트: '예', 말소일: '2026-07-02', 말소사유: '자동' }));
  const e1 = calc('calculate_transfer_tax_multi', { transactions: [A.경우[0].엔진칸] });
  const e2 = calc('calculate_transfer_tax_multi', { transactions: [Object.assign({}, A.경우[0].엔진칸, A.경우[1].엔진칸, { longTermRentalHouseProvision: 'sect97_5' })] });
  ok(A.적용 === true && B.적용 === false && C.적용 === false && D.적용 === false && D.장기임대특례율 === 50 && A.경우.length === 4 && e1.합산조특법세액감면액 === 62710000 && e2.합산조특법세액감면액 === 62710000 && e2.농어촌특별세 === 12542000,
    '장기일반감면 — 법대로 100%·등록 4개월 뒤·7개월 공실·자동말소 아파트(§97의3 50%)·§97의3과 함께 넣어도 한 번만', JSON.stringify([A.결론, B.결론, C.결론, D.결론, e1.합산조특법세액감면액, e2.합산조특법세액감면액, e2.농어촌특별세]));
}
// [2026.11.03 복잡사건 110 「피씨 2013 미분양 아파트」] 신축주택감면 — 6억·85㎡ 둘 다 넘음·해제 재계약·날인·5년 안/뒤
{ const B = { 주택: { 종류: '미분양', 공급자: '사업주체', 계약일: '2013-06-01', 취득일: '2013-08-01', 실거래가액: 400000000, 면적: 84, 날인: '예' }, 해제: { 없음: '예' }, 양도: { 양도일: '2018-06-01', 양도가액: 550000000 }, 기준일: '2026-11-03' };
  const A = judgeNewHouse99_2_(B);
  const Bg = judgeNewHouse99_2_(Object.assign({}, B, { 주택: Object.assign({}, B.주택, { 실거래가액: 700000000, 면적: 110 }) }));
  const C = judgeNewHouse99_2_(Object.assign({}, B, { 해제: { 전계약해제: '예', 해제자본인또는가족: '예' } }));
  const N = judgeNewHouse99_2_(Object.assign({}, B, { 주택: Object.assign({}, B.주택, { 날인: '아니오' }) }));
  const L = judgeNewHouse99_2_(Object.assign({}, B, { 양도: { 양도일: '2026-09-01' } }));
  ok(A.적용 === true && A.오년안 === true && Bg.적용 === false && C.적용 === false && N.적용 === false && L.적용 === true && L.오년안 === false, '신축주택감면 — 6억·85㎡·해제 재계약·날인·5년 안/뒤', JSON.stringify([A.결론, Bg.결론, C.결론, N.결론, L.결론]));
}
// [2026.11.03 복잡사건 109 「맹씨 한우 축사」] 축사용지 — 편입 3년·상속 3년 안 통산·폐업 확인서
{ const B = { 양도인: { 거주자: '예', 거주지역: '같은 군', 거주년수: 20, 직접축산: '예', 축산년수: 20 }, 토지: { 취득일: '2000-01-01', 지역: '군', 축사용지면적: 3000, 총양도면적: 4000 }, 폐업: { 확인서: '예' }, 양도: { 양도일: '2026-09-15' }, 기준일: '2026-11-03' };
  const A = judgeLivestockLand_(B);
  const D = judgeLivestockLand_(Object.assign({}, B, { 토지: { 취득일: '2000-01-01', 지역: '동', 편입일: '2020-03-01' } }));
  const E = judgeLivestockLand_(Object.assign({}, B, { 양도인: Object.assign({}, B.양도인, { 축산년수: 0.5 }), 토지: { 취득일: '2024-05-01', 취득원인: '상속', 지역: '군' }, 상속: { 상속일: '2024-05-01', 피상속인축산년수: 15, 상속뒤축산년수: 0.5 } }));
  const G = judgeLivestockLand_(Object.assign({}, B, { 폐업: { 확인서: '아니오' } }));
  ok(A.적용 === true && A.면적비율 === 0.75 && D.적용 === false && E.적용 === true && E.축산년수_통산 === 15.5 && G.적용 === false, '축사용지 — 면적 비율·시 동 편입 3년·상속 3년 안 통산·폐업 확인서', JSON.stringify([A.결론, D.결론, E.결론, G.결론]));
}
const ch = judgeCohabit_({ 상속개시일: '2027-06-01', 상속인관계: '직계비속', 상속인생년월일: '1968-09-01', 동거시작일: '2010-01-01', 일세대일주택10년: '예', 무주택또는공동: '예', 주택가액: 900000000, 담보채무: 100000000, 상속지분: 1 });
ok(ch.결론 === '충족' && ch.엔진칸 && ch.엔진칸.cohabitingHouseValue !== undefined, '동거주택 — 17년 동거·무주택', ch.표시 + ' · 공제 ' + won(ch.공제 || ch.공제추정 || Math.min(600000000, 800000000)));
const ch2 = judgeCohabit_({ 상속개시일: '2027-06-01', 상속인관계: '직계비속', 동거시작일: '2010-01-01' });
ok(ch2.잠정 === true, '동거주택 — 모르는 사실이 있으면 잠정', ch2.표시);
const fb = judgeFamilyBiz_({ 상속개시일: '2027-06-01', 기업규모: '중소', 업종해당: '예', 상장: '아니오', 경영시작일: '1995-01-01', 지분율: 60, 지분10년보유: '예', 대표재직: { 절반이상: '예' }, 상속인생년월일: '1968-09-01', 상속인종사년수: 5, 임원취임: '예', 가업상속재산가액: 25000000000 });
ok(fb.결론 === '충족' && fb.공제한도 === 60000000000, '가업상속 — 경영 32년 → 한도 600억(§18의2①3호)', fb.표시 + ' · 한도 ' + won(fb.공제한도) + ' · 공제 ' + won(fb.공제추정));
ok((fb.할일 || []).length === 2, '가업상속 사후관리 할일 두 줄', (fb.할일 || []).map((x) => x.때).join(', '));

console.log('— ⑥ 시간줄(그때 법 기준일·앞으로 기한) —');
const tl = famTimeline_(F, '2026-11-01');
const fut = [].concat(...tl.map((x) => x.앞으로 || [])).filter((x) => x.날짜 > '2026-11-01'); ok(tl.length > 6 && fut.length > 0, '시간줄 ' + tl.length + '줄 · 앞으로 ' + fut.length + '줄', fut.slice(0, 4).map((x) => x.날짜 + ' ' + String(x.무엇 || x.일 || JSON.stringify(x)).slice(0, 40)).join(' | '));
const allDue = [].concat(...tl.map((x) => x.앞으로 || [])).filter((x) => x.날짜);
ok(allDue.every((x) => !!x.지남 === (x.날짜 < '2026-11-01')), '지난 기한엔 지남 표시(앞으로 기한과 섞이지 않음)', '지남 ' + allDue.filter((x) => x.지남).length + ' · 앞으로 ' + allDue.filter((x) => !x.지남).length);
console.log('— ⑦ 장부 계산이 지도를 보는 길(드라이브 대신 가짜 지도) —');
global.famLoad_ = () => F;
const L = { rows: { 'g.giftDoneeName': { v: '한민수', state: '확정' }, 'g.giftDonorName': { v: '한도식', state: '확정' }, 'i.deceasedName': { v: '한도식', state: '확정' } } };
const gi = { giftAmount: 300000000, relation: '직계존속', giftDate: '2026-12-01' };
const fa = famAutoPriorGift_({ id: 'cX', 고객명: '한민수' }, gi, L);
ok(gi.priorGiftAmount === 300000000 && gi.priorPaidTax === 42000000, '증여 장부 계산 — 사전증여 칸이 비면 지도 합산이 들어감', fa && fa.줄[0]);
const ii = { inheritanceDate: '2027-06-01', taxableEstateAmount: 4000000000, hasSpouse: true, childCount: 1 };
const fe = famAutoEstatePrior_({ id: 'cY', 고객명: '한도식' }, ii, L);
ok(fe && fe.줄 && /그 밖 2건/.test(fe.줄[0]), '상속 장부 계산 — 지도 사전증여 가산', fe && fe.줄[0]);
const ri = calc('calculate_inheritance_tax', ii);
ok(ri && !ri.error, '가산 넣은 상속세 계산', ri && (ri.error || ('과세표준 ' + won(ri.과세표준) + ' · 납부 ' + won(ri.납부세액 || ri.납부할세액))));
console.log('— 큰일 ⑦ 법인·지분 — 판정 셋이 지도 지분을 같은 값으로 —');
const F2 = JSON.parse(JSON.stringify(F));
F2.법인 = [{ id: 'k1', 이름: '한빛산업', 상장: false }, { id: 'k2', 이름: '도식물산' }];
F2.지분 = [
  { id: 's1', 사람: 'p1', 법인: '한빛산업', 비율: 60, 기준일: '2020-01-01' },
  { id: 's2', 사람: 'p3', 법인: '한빛산업', 비율: 20, 기준일: '2020-01-01' },
  { id: 's3', 사람: '남갑수', 법인: '한빛산업', 비율: 20, 기준일: '2020-01-01' },
  { id: 's4', 사람: 'p3', 법인: '도식물산', 비율: 100, 기준일: '2021-01-01' }
];
F2.사람.forEach(function () {}); 
F2.이전.push({ id: 't9', 종류: '증여', 날짜: '2025-01-01', 주는: 'p1', 받는: 'p3', 관계: '직계존속', 물건: '한빛산업 주식', 물건종류: '주식', 법인: '한빛산업', 지분: 20, 금액: 500000000 });
const H0 = famHoldings_(F2, '한빛산업', '2024-12-31'), H1 = famHoldings_(F2, '한빛산업', '2026-01-01');
const pick = (H, n) => (H.주주.filter((x) => x.이름 === n)[0] || {}).비율;
ok(pick(H0, '한도식') === 60 && pick(H0, '한민수') === 20, '이전 전날 지분 그대로(60·20)', JSON.stringify(H0.주주));
ok(pick(H1, '한도식') === 40 && pick(H1, '한민수') === 40 && H1.합계 === 100, '주식 증여 뒤 지분 바뀜(40·40, 합계 100)', JSON.stringify(H1.주주));
const saveLoad = global.famLoad_; global.famLoad_ = () => F2;
const cc = { id: 'cK', 고객명: '한민수' };
const f1 = famCorpFill_(cc, '제2차', { 법인: '한빛산업', 성립일: '2026-03-31', 기준주주: '한민수' });
const f2 = famCorpFill_(cc, '가족지분', { 법인: '한빛산업', 양도일: '2026-03-31', 기준주주: '한민수' });
const f3 = famCorpFill_(cc, '특정법인', { 법인: '한빛산업', 기준일: '2026-03-31', 기준주주: '한민수' });
const fam2 = (f1.facts.주주 || []).filter((s) => s.관계 !== '남').reduce((a, s) => a + s.주식수, 0) / 100;
ok(fam2 === 80 && f2.facts.주주가족지분 === 80 && f3.facts.groupOwnershipRatio === 80 && f3.facts.shareholderOwnershipRatio === 40, '세 판정이 같은 가족 지분 80%(본인 40%)', [fam2, f2.facts.주주가족지분, f3.facts.groupOwnershipRatio, f3.facts.shareholderOwnershipRatio].join('·'));
const f4 = famCorpFill_(cc, '특정법인', { 법인: '한빛산업', 기준일: '2026-03-31', groupOwnershipRatio: 55 });
ok(f4.facts.groupOwnershipRatio === 55 && f4.채움.indexOf('groupOwnershipRatio') === -1, '칸에 넣은 값이 있으면 그 값 우선', f4.facts.groupOwnershipRatio);
const f5 = famCorpFill_(cc, '가족지분', { 법인: '없는법인', 양도일: '2026-03-31' });
ok(!f5.채움.length, '지도에 없는 법인은 채우지 않음', f5.채움.join(','));
const j1 = judgeSecondaryLiability_(Object.assign({}, f1.facts, { 체납: [{ 세목: '법인세', 성립일: '2026-03-31', 부족액: 100000000 }] }));
ok(j1 && j1.묶음, '제2차 납세의무 판정이 지도 주주로 돎', j1 && (j1.결론 || j1.판정 || JSON.stringify(j1).slice(0, 160)));
const j2 = judgeCorpIndividualDeal_(Object.assign({}, f2.facts, { 방향: '개인→법인', 특수관계: '예', 대가: 500000000, 시가: 800000000 }));
ok(j2 && JSON.stringify(j2).indexOf('80') !== -1, '법인거래 판정이 지도 가족 지분 80%를 씀', j2 && (j2.결론 || JSON.stringify(j2).slice(0, 160)));
global.famLoad_ = saveLoad;
console.log(bad ? '\n✘ ' + bad + '건 어긋남' : '\n✔ 모두 통과');
process.exit(bad ? 1 : 0);
