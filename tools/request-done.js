// [2026.10.28] 개선요구사항(요청 번호 R…)을 PC Claude가 대화에서 고쳤을 때 처리 내역을 남긴다 — 세무사님 "각각 어떻게 처리되었는지 확인할 수도 없다".
//   node tools/request-done.js R2610271435 "어느 칸이든 값 고치기·되돌리기 도구를 넣음"            ← 고침(배포 대기): 다음 배포(mark-deployed·📥) 때 "반영됨"으로 바뀜
//   node tools/request-done.js R… "내용" --commit ddbe944 --deployed --ver 1271                  ← 이미 운영에 있는 것 소급 기록(바로 "반영됨")
//   --commit 없으면 지금 HEAD 짧은 sha. 결과는 대시보드 🛠 개선요구 카드·설정 📝 요청 상태에서 요청을 펼치면 보인다.
const { execSync } = require('child_process');
const { key: KEY, gas: GAS } = require('./nx-secret.js').loadNxSecret();
const args = process.argv.slice(2);
const id = args[0], what = args[1];
if (!id || !what || !/^R[\dA-Za-z-]+$/.test(id)) { console.log('사용법: node tools/request-done.js R번호 "고친 내용" [--commit sha] [--deployed] [--ver 1234]'); process.exit(1); }
const argOf = (n) => { const i = args.indexOf(n); return i > -1 ? String(args[i + 1] || '') : ''; };
let commit = argOf('--commit');
if (!commit) { try { commit = execSync('git rev-parse --short HEAD', { cwd: __dirname + '/..' }).toString().trim(); } catch (e) { commit = ''; } }
const body = { _key: KEY, action: 'comm_request_done', id, what, commit, deployed: args.includes('--deployed'), ver: argOf('--ver'), who: 'PC Claude' };
fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(r => r.text()).then(t => {
  let o = null; try { o = JSON.parse(t); } catch (e) {}
  console.log(o ? (o.success ? '기록함 ' + id + ' → ' + o.status : '실패: ' + (o.error || t.slice(0, 200))) : t.slice(0, 300));
});
