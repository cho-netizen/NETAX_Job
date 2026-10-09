// [2026.10.09] PC에서 clasp push/deploy 후 git push까지 마쳤을 때 실행 — job의 📥 수정 반영 버튼이
// "지금 운영 = 깃허브 main 최신"으로 알게 한다(안 하면 이미 반영된 커밋이 "반영 대기 N건"으로 보임).
//   node tools/mark-deployed.js
// 주의: 반드시 clasp deploy와 git push가 둘 다 끝난 뒤에만 실행할 것(운영과 main이 실제로 같을 때).
const fs = require('fs');
const { execSync } = require('child_process');
const cfg = fs.readFileSync('C:/GitHub/NETAX_Work/config.js', 'utf8');
const KEY = (cfg.match(/API_SECRET:\s*'([^']+)'/) || [])[1];
const GAS = (cfg.match(/GAS_URL:\s*'([^']+)'/) || [])[1];
const sha = execSync('git rev-parse origin/main', { cwd: __dirname + '/..' }).toString().trim();
const local = execSync('git rev-parse HEAD', { cwd: __dirname + '/..' }).toString().trim();
if (sha !== local) { console.log('아직 푸시 안 된 커밋이 있습니다 — git push 후 다시 실행하세요.'); process.exit(1); }
fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'gh_mark_deployed', sha, _key: KEY }) })
  .then(r => r.text()).then(t => console.log(t.slice(0, 200), sha.slice(0, 7)));
