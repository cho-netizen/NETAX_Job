// [2026.10.09] PC에서 clasp push/deploy 후 git push까지 마쳤을 때 실행 — job의 📥 수정 반영 버튼이
// "지금 운영 = 깃허브 main 최신"으로 알게 한다(안 하면 이미 반영된 커밋이 "반영 대기 N건"으로 보임).
//   node tools/mark-deployed.js                 ← 끝: 기준 맞춤 + 배포 직후 점검 + 반영 기록(버전·커밋·요약)
//   node tools/mark-deployed.js --msg "요약"     ← 반영 기록에 남길 한 줄(없으면 main 최신 커밋 제목)
//   node tools/mark-deployed.js --start "요약"   ← [2026.10.20] clasp push 전에: job 화면에 "PC에서 올리는 중"을 띄운다
// [2026.10.20] 세무사님 "잘난 너만 알면 되냐? 나도 알 수 있어야지" — PC 배포도 대시보드·설정 🐞 카드의 반영 기록·진행 중 표시에 나오게.
// 주의: 반드시 clasp deploy와 git push가 둘 다 끝난 뒤에만 실행할 것(운영과 main이 실제로 같을 때). --start는 그 전에.
const { execSync } = require('child_process');
// [2026.10.19 보안] 열쇠는 저장소 밖 개인 파일(tools/nx-secret.js 설명)에서 — 공개 저장소의 NETAX_Work/config.js는 더 이상 안 읽는다
const { key: KEY, gas: GAS } = require('./nx-secret.js').loadNxSecret();
const argOf = (name) => { const i = process.argv.indexOf(name); return i > -1 ? String(process.argv[i + 1] || '') : null; };
const post = (body) => fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ _key: KEY }, body)) }).then(r => r.text());

const start = argOf('--start');
if (start !== null) {
  post({ action: 'deploy_job_pc_start', msg: start }).then(t => console.log('PC 배포 시작 알림:', t.slice(0, 200)));
} else {
  const cwd = __dirname + '/..';
  const sha = execSync('git rev-parse origin/main', { cwd }).toString().trim();
  const local = execSync('git rev-parse HEAD', { cwd }).toString().trim();
  if (sha !== local) { console.log('아직 푸시 안 된 커밋이 있습니다 — git push 후 다시 실행하세요.'); process.exit(1); }
  const msg = argOf('--msg') || execSync('git log -1 --format=%s origin/main', { cwd }).toString().trim();
  post({ action: 'gh_mark_deployed', sha, msg }).then(t => {
    let o = null; try { o = JSON.parse(t); } catch (e) {}
    if (!o) { console.log(t.slice(0, 300), sha.slice(0, 7)); return; }
    const bad = ((o.check && o.check.items) || []).filter(x => !x.ok);
    console.log((o.success ? '기준 맞춤 ' : '실패 ') + sha.slice(0, 7) + (o.recorded && o.recorded.ver ? ' · 운영 @' + o.recorded.ver + ' 반영 기록' : ' · 반영 기록 못 남김')
      + ' · 배포 직후 점검 ' + (o.check ? (o.check.ok ? '정상' : '이상 ' + bad.length + '건') : '결과 없음') + (o.error ? ' · ' + o.error : ''));
    bad.forEach(x => console.log('  ⚠ ' + x.name + ' — ' + x.msg));
  });
}
