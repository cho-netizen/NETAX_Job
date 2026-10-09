// [2026.10.09] 개선 후보 보고서 읽기 — Claude Code(웹 루틴 "job 개선 후보 처리"·수동 "개선 후보 처리해줘")가 쓰는 도구.
// job이 매일 밤 토큰 0으로 만든 보고서(_개선후보.json)를 가져온다. 비밀키는 화면에 찍지 않는다.
//   node tools/improve-report.js         → 저장된 최신 보고서
//   node tools/improve-report.js --run   → 지금 새로 만들어서 가져오기
// 열쇠: 세무사님 PC는 NETAX_Work/config.js, 웹 Claude Code(클라우드)는 작업환경 변수 NX_GAS_URL·NX_API_SECRET.
const fs = require('fs');
// 웹 Claude Code(클라우드): 보고서 전용 출입증만 쓴다 — node tools/improve-report.js --token=<출입증> [--run 은 안 됨, 저장된 최신 보고서만]
const tokArg = (process.argv.find(a => a.indexOf('--token=') === 0) || '').slice(8) || process.env.NX_REPORT_TOKEN;
if (tokArg) {
  const PUBLIC_URL = 'https://script.google.com/macros/s/AKfycbyFbvXiV6rSzCvhtc_T2WrzNF5ZxhOFWtSSsgzSavzPbjv4LBGhjXhu_Q2_8m-PDj8s/exec';
  fetch(PUBLIC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'improve_report_public', token: tokArg }) })
    .then(r => r.text()).then(t => {
      let j; try { j = JSON.parse(t); } catch (e) { console.log('응답이 JSON이 아님:', t.slice(0, 200)); process.exit(1); }
      if (j.error) { console.log('job 응답: ' + j.error); process.exit(1); }
      console.log(JSON.stringify(j.report, null, 1));
    }).catch(e => { console.log('job 서버에 연결하지 못했습니다: ' + e.message + ' — 웹 Claude Code 작업환경의 네트워크 접근에 script.google.com, script.googleusercontent.com 허용 필요'); process.exit(1); });
  return;
}
let KEY = process.env.NX_API_SECRET, GAS = process.env.NX_GAS_URL;
if (!KEY || !GAS) {
  let cfg = '';
  try { cfg = fs.readFileSync('C:/GitHub/NETAX_Work/config.js', 'utf8'); } catch (e) {}
  KEY = KEY || (cfg.match(/API_SECRET:\s*'([^']+)'/) || [])[1];
  GAS = GAS || (cfg.match(/GAS_URL:\s*'([^']+)'/) || [])[1];
}
if (!KEY || !GAS) { console.log('job 서버 열쇠가 없습니다 — 웹 Claude Code 작업환경에 NX_GAS_URL, NX_API_SECRET 를 넣어 주세요.'); process.exit(1); }
const action = process.argv.includes('--run') ? 'improve_report_run' : 'improve_report_get';
fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, _key: KEY }) })
  .then(r => r.text()).then(t => {
    let j; try { j = JSON.parse(t); } catch (e) { console.log('응답이 JSON이 아님:', t.slice(0, 200)); process.exit(1); }
    if (!j.report) { console.log('아직 보고서가 없습니다. --run 으로 만드세요.'); return; }
    // 오류 상세에 섞일 수 있는 주민번호·전화번호는 가려서 출력
    const mask = s => String(s).replace(/\d{6}-?\d{7}/g, '######-#######').replace(/01\d[-\s]?\d{3,4}[-\s]?\d{4}/g, '010-****-****');
    console.log(mask(JSON.stringify(j.report, null, 1)));
  }).catch(e => { console.log('job 서버에 연결하지 못했습니다: ' + e.message + ' (웹 Claude Code라면 작업환경의 네트워크 접근을 확인)'); process.exit(1); });
