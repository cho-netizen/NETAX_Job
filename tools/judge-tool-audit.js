// ============================================================
// [2026.11.11] 판정 도구 전수 점검 — 세무사님 11-11 "판정과 관련하여 세액계산도구처럼 판정도구가 제대로 작동하고
//  넥스가 도구로 제대로 활용할 수 있는지 다시한번 점검하여 문제가 있으면 수정하라"
//  돈 0원·서버 호출 0. 판정 서버와 같은 코드(gs-judge/Generated.js)·job 서버 대리 파일(판정 창 목록·판정 찾기)로 본다.
//  A 빈 사실로 돌려도 안 깨지고 모양(묶음·결론·요건·표시)이 맞나
//  B 판정 창 칸 목록대로 값을 넣어 돌려도 안 깨지나(칸 종류별 그럴듯한 값)
//  C 판정이 계산기로 넘기는 엔진칸 이름이 세액 엔진이 아는 칸인가
//  D 넥스 「판정 찾기」가 판정 이름·별칭으로 그 판정을 찾아 주나
//  E 판정 창에서 넣을 칸이 하나도 없는 판정(창에서 못 씀)
// 실행: node tools/judge-tool-audit.js [--json 결과파일]
// ============================================================
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), GS = path.join(ROOT, 'gs-backend'), GJ = path.join(ROOT, 'gs-judge');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const J = vm.createContext({ console: { log() {}, warn() {}, error() {} }, HtmlService: { createHtmlOutputFromFile: (n) => ({ getContent: () => read(path.join(GJ, n + '.html')) }) } }); J.globalThis = J;
vm.runInContext(read(path.join(GJ, 'Generated.js')), J);
const M = vm.createContext({ console }); M.globalThis = M;
vm.runInContext(read(path.join(GS, 'judge-remote', 'JudgeRemote.js')) + '\n' + read(path.join(GS, 'JudgeForm.js')), M);
const JM = vm.runInContext('JUDGE_MORE_', J), cat = vm.runInContext('JUDGE_CATALOG_STATIC_', M);
const fns = [...new Set(Object.values(JM))];
const keyOf = (f) => Object.keys(JM).find((k) => JM[k] === f);
const probs = { A: [], B: [], C: [], D: [], E: [] };
const shape = (r) => r && typeof r === 'object' && r.묶음 && typeof r.결론 === 'string' && Array.isArray(r.요건) && typeof r.표시 === 'string';
// A
fns.forEach((f) => { const k = keyOf(f); try { const r = f({}); if (!shape(r)) probs.A.push(k + ': 모양 틀림 ' + JSON.stringify(r).slice(0, 120)); } catch (e) { probs.A.push(k + ': 깨짐 ' + e.message); } });
// B
const val = (f) => ({ 날짜: '2025-06-30', 숫자: 100000000, 예아니오: '예', 목록: [], 묶음: {}, 글: '예' }[f.종류] ?? '예');
// 엔진 글 어디에든 그 칸 이름이 나오면 아는 칸으로 본다(엔진은 칸을 여러 이름의 변수로 받음)
const engineSrc = read(path.join(GS, 'manage', 'taxcalc-engine.html'));
const engineKeys = { has: (k) => new RegExp('\\b' + k + '\\b').test(engineSrc), size: '엔진 글 전체에서 찾음' };
cat.forEach((c) => {
  const f = JM[c.묶음]; if (!f || !(c.칸 || []).length) return;
  const facts = {}; c.칸.forEach((x) => { facts[x.이름] = val(x); });
  let r; try { r = f(facts); } catch (e) { probs.B.push(c.묶음 + ': 칸을 다 채우면 깨짐 — ' + e.message); return; }
  if (!shape(r)) { probs.B.push(c.묶음 + ': 칸을 다 채우면 모양 틀림'); return; }
  // C 엔진칸
  const ek = r.엔진칸 && typeof r.엔진칸 === 'object' ? r.엔진칸 : {};
  const walk = (o, pre) => Object.keys(o || {}).forEach((k) => {
    const v = o[k];
    if (/^\d+$/.test(k) || /^[가-힣①-⑳]/.test(k)) { if (v && typeof v === 'object') walk(v, pre + k + '.'); return; } // 경우 이름·배열 칸은 그 안을 본다
    if (!engineKeys.has(k)) probs.C.push(c.묶음 + ': 엔진칸 「' + pre + k + '」 — 세액 엔진에서 못 찾음');
  });
  walk(ek, '');
});
// D 판정 찾기
const find = vm.runInContext('nxFindJudgment_', M);
cat.forEach((c) => {
  const qs = [c.이름, c.묶음].concat((c.별칭 || []).slice(1, 2));
  qs.forEach((q) => {
    let res; try { res = find({ query: q }); } catch (e) { probs.D.push(c.묶음 + ': 판정 찾기 깨짐 ' + e.message); return; }
    const top = ((res && res.판정) || []).slice(0, 3).map((x) => x.묶음);
    if (top.indexOf(c.묶음) === -1) probs.D.push(c.묶음 + ': 「' + q + '」로 찾으면 앞 3개에 없음 → ' + top.join(', '));
  });
});
// E
cat.forEach((c) => { if (!c.따로창 && !(c.칸 || []).length) probs.E.push(c.묶음 + ' (' + c.이름 + ')'); });
const total = Object.values(probs).reduce((s, a) => s + a.length, 0);
console.log('판정 함수 ' + fns.length + ' · 판정 창 목록 ' + cat.length + ' · 엔진이 아는 칸 이름 ' + engineKeys.size);
Object.keys(probs).forEach((k) => { console.log(k + ' ' + probs[k].length + '건'); probs[k].slice(0, 12).forEach((x) => console.log('   ' + x)); });
const j = process.argv.indexOf('--json'); if (j !== -1) fs.writeFileSync(process.argv[j + 1], JSON.stringify(probs, null, 1));
process.exit(total ? 1 : 0);
