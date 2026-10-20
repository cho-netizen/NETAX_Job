// [2026.10.19 보안] PC 도구(mark-deployed·improve-report 등)가 job 서버 열쇠(API_SECRET)를 읽는 곳.
// 예전엔 C:/GitHub/NETAX_Work/config.js(공개 저장소에 올라가는 파일)에서 읽었다 — 그 값이 공개돼 있었다.
// 이제는 저장소 밖 개인 파일 %USERPROFILE%\.netax\secret.json 에서만 읽는다(git에 안 올라감).
//   파일 모양: { "API_SECRET": "세무사님이 붙여 넣은 값" }
// 웹 Claude Code(클라우드)는 작업환경 변수 NX_API_SECRET(·NX_GAS_URL)이 먼저다.
// 비밀값은 화면에 찍지 않는다.
const fs = require('fs'), os = require('os'), path = require('path');
const SECRET_FILE = path.join(os.homedir(), '.netax', 'secret.json');
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyFbvXiV6rSzCvhtc_T2WrzNF5ZxhOFWtSSsgzSavzPbjv4LBGhjXhu_Q2_8m-PDj8s/exec';
function loadNxSecret() {
  let key = process.env.NX_API_SECRET || '', gas = process.env.NX_GAS_URL || '';
  if (!key) {
    try {
      const j = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8').replace(/^\uFEFF/, '')); // 메모장 저장 시 붙는 BOM 무시
      key = String(j.API_SECRET || '').trim();
      gas = gas || String(j.GAS_URL || '').trim();
    } catch (e) { /* 파일 없음·형식 오류 — 아래에서 안내 */ }
  }
  if (!key) {
    console.log('job 서버 열쇠가 없습니다 — ' + SECRET_FILE + ' 파일에 { "API_SECRET": "값" } 을 넣어 주세요(웹 Claude Code는 작업환경 변수 NX_API_SECRET).');
    process.exit(1);
  }
  return { key: key, gas: gas || DEFAULT_GAS_URL };
}
module.exports = { loadNxSecret, SECRET_FILE };
