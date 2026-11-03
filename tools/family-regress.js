// [2026.11.01 복잡사건 ⑧] 가족 지도·판정 묶음 시험 — 처음 보는 가상 「한씨 3대」 사건으로 숫자를 본다(드라이브·넥스 없이, 토큰 0)
//  돌리기: node tools/family-regress.js  (저장소 맨 위에서)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'gs-backend');
const src = fs.readFileSync(path.join(root, 'manage/taxcalc-engine.html'), 'utf8').replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
const W = {}; new Function('window', src)(W);
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
console.log(bad ? '\n✘ ' + bad + '건 어긋남' : '\n✔ 모두 통과');
process.exit(bad ? 1 : 0);
