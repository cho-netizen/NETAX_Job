#!/usr/bin/env node
// [2026.10.19 engine-fix] 세액 엔진 회귀 시험 — 같은 입력을 "기준 판(기본 main)"과 "지금 판" 엔진에 넣어 나란히 보여 준다.
//  엔진 = gs-backend/manage/taxcalc-engine.html(화면·AI 도구·사건처리가 모두 쓰는 계산). 서버·드라이브 호출 없음, 토큰 0.
//  사용:
//    node tools/engine-regress.js                       기본 경우(tools/engine-regress-cases.json — 합성, 고객 정보 없음)
//    node tools/engine-regress.js --base <git ref>      기준 판을 main 말고 다른 가지·커밋으로
//    node tools/engine-regress.js --no-history          지금 판에서 양도일별 세율·장특공·고가주택 연혁(조견표, 기본 켬)을 끄고 비교
//    node tools/engine-regress.js --cases <파일.json>   경우를 더함(정답지 사건 입력은 저장소 밖 파일로만 — 이 저장소는 공개 서빙됨)
//  경우 파일 모양: [{ "이름": "...", "도구": "calculate_inheritance_tax", "입력": {...}, "고정": true, "정답": { "과세표준": 123, ... } }]
//   - 고정: 고쳐도 숫자가 바뀌면 안 되는 경우(바뀌면 끝에 ✗로 알리고 종료 코드 1)
//   - 정답: 신고서·검산표처럼 맞아야 하는 값(지금 판이 다르면 ✗)
//   - 참고: 보여 주기만 하는 값(실사건 정답지 — 입력이 사건처리가 낸 값이라 엔진 탓이 아닌 차이가 있을 수 있어 판정하지 않음)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const ENGINE = 'gs-backend/manage/taxcalc-engine.html';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const baseRef = opt('--base') || 'main';
const caseFiles = [path.join(__dirname, 'engine-regress-cases.json')];
argv.forEach((a, i) => { if (a === '--cases') caseFiles.push(argv[i + 1]); });

// Code.js getUiCalcEngine_과 같은 방식으로 엔진을 불러온다
function load(src) { src = src.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, ''); const win = {}; new Function('window', src)(win); return win; }
const FN = { calculate_inheritance_tax: 'calculateInheritanceTaxJS', calculate_gift_tax: 'calculateGiftTaxJS', calculate_transfer_tax: 'calculateTransferTaxSingleJS' };
const KEYS = {
  calculate_inheritance_tax: ['상속공제_합계', '상속공제종합한도_적용여부', '과세표준', '산출세액', '기납부증여세액공제', '증여세액공제_상속분입력필요', '신고세액공제', '납부세액'],
  calculate_gift_tax: ['과세표준', '산출세액_할증후', '신고세액공제', '납부세액'],
  calculate_transfer_tax: ['과세표준', '산출세액', '납부세액']
};
let cur, base;
try { cur = load(fs.readFileSync(path.join(ROOT, ENGINE), 'utf8')); } catch (e) { console.error('지금 판 엔진을 못 불러옴: ' + e.message); process.exit(2); }
// [2026.10.19 조견표] --history: 지금 판만 양도일별 세율·장특공 연혁(조견표 2부-01·2부-03)을 켜고 비교한다(운영은 세무사님 확인 전 꺼짐)
const HISTORY_ON = argv.indexOf('--no-history') === -1; // 2026-10-19부터 엔진 기본이 켬 — --no-history로 지금 판만 끄고 비교
cur.__NX_REF_HISTORY_ON = HISTORY_ON;
try { base = load(cp.execSync('git show ' + baseRef + ':' + ENGINE, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString('utf8')); } catch (e) { console.error('기준 판(' + baseRef + ') 엔진을 못 불러옴: ' + e.message); process.exit(2); }

const run = (eng, c) => { const fn = eng[FN[c.도구] || c.도구]; if (typeof fn !== 'function') return { 오류: '엔진에 함수 없음: ' + c.도구 }; try { return (Array.isArray(c.인자) ? fn.apply(null, JSON.parse(JSON.stringify(c.인자))) : fn(JSON.parse(JSON.stringify(c.입력)))) || {}; } /* [2026.10.20] 인자: 여러 인자(합산 계산의 거래 목록·신고 입력) */ catch (e) { return { 오류: e.message }; } };
const won = (v) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : v === undefined ? '—' : String(v));
let bad = 0, changed = 0, total = 0;
const L = ['# 엔진 회귀 시험 — 기준 ' + baseRef + ' ↔ 지금 판' + (HISTORY_ON ? '' : '(지금 판 연혁 끔)'), ''];
caseFiles.forEach((f) => {
  if (!fs.existsSync(f)) { L.push('(경우 파일 없음: ' + f + ')'); return; }
  const cases = JSON.parse(fs.readFileSync(f, 'utf8'));
  L.push('## ' + path.basename(f) + ' (' + cases.length + '건)', '', '| 경우 | 칸 | 기준 판 | 지금 판 | 정답 | 판정 |', '|---|---|---|---|---|---|');
  cases.forEach((c) => {
    total++;
    let b = run(base, c); const n = run(cur, c);
    if (b.오류 && /^엔진에 함수 없음/.test(b.오류) && !n.오류) b = {}; /* [2026.10.20] 기준 판에 아직 없는 새 함수 — 지금 판만 정답과 대조 */
    const keys = (KEYS[c.도구] || ['과세표준', '산출세액', '납부세액']).concat(Object.keys(Object.assign({}, c.참고 || {}, c.정답 || {})).filter((k) => (KEYS[c.도구] || []).indexOf(k) === -1));
    let caseChanged = false, caseBad = false;
    if (b.오류 || n.오류) { L.push('| ' + c.이름 + ' | 오류 | ' + (b.오류 || '') + ' | ' + (n.오류 || '') + ' | | ✗ |'); bad++; return; }
    keys.forEach((k, i) => {
      const isNew = b[k] === undefined && n[k] !== undefined; // 기준 판에 없던 새 칸(표시용 등)은 바뀐 것으로 세지 않는다
      const diff = !isNew && JSON.stringify(b[k]) !== JSON.stringify(n[k]);
      const exp = c.정답 && c.정답[k] !== undefined ? c.정답[k] : undefined;
      const ref = exp === undefined && c.참고 && c.참고[k] !== undefined ? c.참고[k] : undefined;
      const expBad = exp !== undefined && Number(exp) !== Number(n[k]);
      if (diff) caseChanged = true;
      if (expBad || (diff && c.고정)) caseBad = true;
      const mark = expBad ? '✗ 정답과 다름' : (diff && c.고정) ? '✗ 고정인데 바뀜' : diff ? '바뀜' : isNew ? '새 칸' : (exp !== undefined ? '✓ 정답' : '같음');
      L.push('| ' + (i === 0 ? c.이름 + (c.고정 ? ' (고정)' : '') : '') + ' | ' + k + ' | ' + won(b[k]) + ' | ' + won(n[k]) + ' | ' + (exp !== undefined ? won(exp) : ref !== undefined ? won(ref) + ' (참고)' : '') + ' | ' + mark + (ref !== undefined && Number(ref) !== Number(n[k]) ? ' · 참고와 다름' : '') + ' |');
    });
    if (caseChanged) changed++;
    if (caseBad) bad++;
  });
  L.push('');
});
L.push('**모두 ' + total + '건 · 숫자가 바뀐 경우 ' + changed + '건 · ✗ ' + bad + '건**');
console.log(L.join('\n'));
process.exit(bad ? 1 : 0);
