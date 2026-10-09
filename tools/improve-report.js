// [2026.10.09] 개선 후보 보고서 읽기 — Claude Code(주1회 예약작업·수동 "개선 후보 처리해줘")가 쓰는 도구.
// job이 매일 밤 토큰 0으로 만든 보고서(_개선후보.json)를 가져온다. 비밀키는 화면에 찍지 않는다.
//   node tools/improve-report.js         → 저장된 최신 보고서
//   node tools/improve-report.js --run   → 지금 새로 만들어서 가져오기
const fs = require('fs');
const cfg = fs.readFileSync('C:/GitHub/NETAX_Work/config.js', 'utf8');
const KEY = cfg.match(/API_SECRET:\s*'([^']+)'/)[1];
const GAS = cfg.match(/GAS_URL:\s*'([^']+)'/)[1];
const action = process.argv.includes('--run') ? 'improve_report_run' : 'improve_report_get';
fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, _key: KEY }) })
  .then(r => r.text()).then(t => {
    let j; try { j = JSON.parse(t); } catch (e) { console.log('응답이 JSON이 아님:', t.slice(0, 200)); process.exit(1); }
    if (!j.report) { console.log('아직 보고서가 없습니다. --run 으로 만드세요.'); return; }
    // 오류 상세에 섞일 수 있는 주민번호·전화번호는 가려서 출력
    const mask = s => String(s).replace(/\d{6}-?\d{7}/g, '######-#######').replace(/01\d[-\s]?\d{3,4}[-\s]?\d{4}/g, '010-****-****');
    console.log(mask(JSON.stringify(j.report, null, 1)));
  });
