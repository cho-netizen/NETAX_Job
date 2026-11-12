// ============================================================
// [2026.11.11 판정 사실 잇기] 판정 → 여쭐 것·받을 서류 → 장부 답 → 다시 판정 고리가 도는지(돈 0원·서버 호출 0)
//  처음 보는 가상 사건 장부를 node 안에 만들고, job 서버 판정 입구(judgeMoreRun_, 판정 서버 대리 길)를 그대로 부른다.
//  ① 다가구: 장부에 「주택 층수」만 있고 면적·세대수는 없음 → 넥스가 사실을 안 넘겨도 층수는 장부에서 채움(다), 모자란 요건은 물음 줄로(가)
//  ② 계약해제: 장부 칸 이름이 「대금청산일」·「해제일자」(판정 칸은 잔금일·해제일) → 이름 무리로 채움(나)
//  ③ 답을 넣고 다시 판정 → 풀린 물음은 거둠, 받을 서류 목록(ledgerJudgeEvWant_)에 서류 요건만
// 실행: node tools/judge-ledger-loop-check.js
// ============================================================
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), GS = path.join(ROOT, 'gs-backend'), GJ = path.join(ROOT, 'gs-judge');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const textOut = { createTextOutput: (s) => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } };
// 판정 서버
const J = vm.createContext({ console, HtmlService: { createHtmlOutputFromFile: (n) => ({ getContent: () => read(path.join(GJ, n + '.html')) }) }, ContentService: textOut }); J.globalThis = J;
['Generated.js', 'Seams.js', 'Judge.js'].forEach((f) => vm.runInContext(read(path.join(GJ, f)), J));
// job 서버 일부 — 장부 줄 함수는 CaseLedger.js 원본에서 그대로 떼어 온다
const DECL = /^(?:function\s+([\w$]+)|(?:var|const|let)\s+([\w$]+)\s*=)/;
const chunk = (src, name) => { const L = src.split('\n'); const i = L.findIndex((l) => { const m = DECL.exec(l); return m && (m[1] || m[2]) === name; }); if (i < 0) throw new Error('없음 ' + name); let j = i + 1; while (j < L.length && !DECL.test(L[j]) && !/^\/\//.test(L[j])) j++; return L.slice(i, j).join('\n'); };
const cl = read(path.join(GS, 'CaseLedger.js'));
const M = vm.createContext({ console, UrlFetchApp: { fetch: (u, o) => { const r = vm.runInContext('doPost', J)({ postData: { contents: o.payload } }); return { getContentText: () => r.s, getResponseCode: () => 200 }; } } }); M.globalThis = M;
vm.runInContext(read(path.join(GS, 'judge-remote', 'JudgeRemote.js')), M);
vm.runInContext(read(path.join(GS, 'JudgeForm.js')), M);
['ledgerAskInner_', 'ledgerJudgeEvWant_', 'ledgerLabel_', 'ledgerQGroup_'] /* [2026-11-13 4차] 11-12 질문 정리로 ledgerAskInner_가 ledgerQGroup_(묶음)을 부르는데 이 점검이 안 실어 「여쭐 것을 세우지 못함」으로 0줄이 됐다 — 운영 결함이 아니라 점검 틀 결함 */.forEach((n) => vm.runInContext(chunk(cl, n), M));
vm.runInContext(chunk(read(path.join(GS, 'Code.js')), 'CASEPROC_FIELD_KO_'), M);
try { vm.runInContext(chunk(cl, 'LEDGER_GKO_'), M); } catch (e) { M.LEDGER_GKO_ = {}; }
const LEDGER = { rows: {}, log: [], judge: {} };
Object.assign(M, {
  caseProcNow_: () => '2026-11-11 01:00', ledgerLoad_: () => LEDGER, ledgerMutate_: (id, f) => f(LEDGER), ledgerLogTo_: (L, x) => L.log.push(x),
  ledgerRowOut_: (p, r) => ({ path: p, state: r.state }), ledgerValueText_: (p, v) => String(v),
  awDeadlinesFromResult_: () => []
});
const run = (kind, facts) => vm.runInContext('judgeMoreRun_', M)({ id: 'V-테스트' }, { 묶음: kind, facts: facts || {} }, '넥스');
const asks = (pre) => Object.keys(LEDGER.rows).filter((p) => p.indexOf('q:판정:' + pre) === 0).map((p) => ({ p, st: LEDGER.rows[p].state }));
let bad = [];
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) bad.push(msg); };

// ① 다가구
// ① 비거주자 양도 — 서류 읽기가 장부 양도 칸(진짜 칸 경로)을 채워 둔 사건. 넥스는 사실을 하나도 안 넘김
LEDGER.rows['a0.transferDate'] = { v: '2026-09-30', state: '확정', src: { kind: '서류', file: '매매계약서.pdf' } };
LEDGER.rows['a0.transferPrice'] = { v: 900000000, state: '확정', src: { kind: '서류', file: '매매계약서.pdf' } };
LEDGER.rows['a0.acquisitionPrice'] = { v: 400000000, state: '추정', src: { kind: '넥스' } };
let a = run('비거주자양도');
const fa = a.장부에서채운칸 || {};
ok(a.ok, '비거주자 양도 판정 돌아감 — 결론 ' + (a.결과 && a.결과.결론) + (a.결과 && a.결과.잠정 ? '(잠정)' : ''));
ok(fa.양도일 && fa.양도가액 && fa.취득가액, '넥스가 사실을 안 넘겨도 장부 칸으로 채움: ' + (Object.keys(fa).map((k) => k + '←' + fa[k]).join(' · ') || '없음'));
ok(a.결과 && a.결과.잠정 === true, '추정 값(취득가액)으로 채웠으니 결론 잠정');
const aN = asks('비거주자');
ok(aN.length > 0, '모자란 요건이 물음 줄로 섬: ' + aN.length + '줄 — ' + aN.map((x) => x.p.split(':').pop() + '[' + x.st + ']').join(' / ').slice(0, 300));
// ② 이름 맞춤 — 같은 사실 다른 이름(장부엔 이런 이름 칸이 아직 적어 함수로 직접 확인)
const G = (x) => vm.runInContext('judgeFieldGroup_', M)(vm.runInContext('judgeFieldNorm_', M)(x));
ok(G('잔금일') && G('잔금일') === G('대금청산일') && G('양도일') === G('양도일자') && G('양도일') !== G('취득일') && G('잔금일') !== G('양도일'), '이름 무리: 잔금일=대금청산일 · 양도일=양도일자 · 양도일≠취득일 · 잔금일≠양도일(법상 다른 사실)');

// 다가구 — 장부에 없는 사실은 모두 물음으로
LEDGER.rows = {};
let ad = run('다가구');
const aD = asks('다가구');
ok(aD.length > 0, '다가구: 모자란 요건 ' + aD.length + '줄 물음 — ' + aD.map((x) => x.p.split(':').pop() + '[' + x.st + ']').join(' / ').slice(0, 300));

// ③ 답 넣고 다시 — 다가구 모든 요건 사실을 넘김
const before = aD.length;
let c2 = run('다가구', { 층수: 3, 주택바닥면적합계: 500, 세대수: 10, 주택바닥면적: 500, 바닥면적합계: 500, 세대: 10 });
const left = asks('다가구');
ok(left.length < before, '다시 판정하면 풀린 물음을 거둠: ' + before + '줄 → ' + left.length + '줄' + (left.length ? ' (남은 것: ' + left.map((x) => x.p.split(':').pop()).join(' / ') + ')' : ''));
// 받을 서류
LEDGER.rows = {}; run('8년자경');
const want = vm.runInContext('ledgerJudgeEvWant_', M)(LEDGER);
const a8 = asks('8년'), docs = a8.filter((x) => x.st === '증빙받을것'), qs = a8.filter((x) => x.st === '물어볼것');
ok(a8.length > 0 && docs.length > 0, '8년자경: 물음 ' + a8.length + '줄 중 받을 서류 ' + docs.length + '·여쭐 것 ' + qs.length);
ok(Object.keys(want).length === docs.length, '받을 서류 목록에 서류 요건만 ' + Object.keys(want).length + '건 — ' + Object.values(want).map((w) => w.label).join(' / ').slice(0, 300));
// 답이 들어온 물음은 다시 돌려도 그대로
const one = docs[0] && docs[0].p; if (one) { LEDGER.rows[one].state = '확정'; LEDGER.rows[one].v = '초본 받음'; const again = run('8년자경'); ok(LEDGER.rows[one] && LEDGER.rows[one].state === '확정', '답이 들어온 물음 줄은 다시 판정해도 그대로');
  const note = (again.알림 || []).filter((x) => /장부에 들어온 답/.test(x))[0];
  ok(!!note, '다시 판정하면 그 답을 넥스에게 알려 사실 칸에 옮기게 함: ' + String(note || '없음').slice(0, 160)); }
console.log(bad.length ? '✗ ' + bad.length + '건' : '✔ 모두 통과');
process.exit(bad.length ? 1 : 0);
