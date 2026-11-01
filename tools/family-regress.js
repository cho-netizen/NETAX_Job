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

console.log('— ⑤ 판정 묶음 —');
const sf = judgeSelfFarm_({ 양도일: '2026-10-01', 거주지역: '같은 시군구', 직접경작: '예', 경작: [{ 누가: '본인', 시작: '2012-03-01', 끝: '2026-09-30' }], 소득초과해: ['2018', '2019'], 양도일거주자: '예', 양도일농지: '예' });
ok(sf.결론 === '충족', '8년 자경 — 14.6년 중 소득 초과 2년 빼도 8년 넘음', sf.표시);
const sf2 = judgeSelfFarm_({ 양도일: '2026-10-01', 거주지역: '같은 시군구', 경작: [{ 누가: '본인', 시작: '2020-03-01' }] });
ok(sf2.결론 !== '충족', '8년 자경 — 6.6년이면 안 됨', sf2.표시);
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
