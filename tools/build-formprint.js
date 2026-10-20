// 법정서식 원본 모양 출력 — 위치판을 앱 자료로 복사 (작업자 파, 2026-10-19)
// reftables/위치판/서식위치_*.json → app/formprint/위치판/ (깃허브 페이지 job.netax.kr/app/formprint/ 에서 서빙)
// 서버(gs-backend)에는 넣지 않는다 — 구글 서버 10MB 한도.
// 사용: node tools/build-formprint.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'reftables', '위치판');
const OUT = path.join(ROOT, 'app', 'formprint', '위치판');

fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => /^서식위치_.+\.json$/.test(f)).sort();
const list = [];
let bytes = 0;
for (const f of files) {
  const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
  let j;
  try { j = JSON.parse(raw); } catch (e) { console.error('JSON 오류: ' + f + ' — ' + e.message); process.exit(1); }
  if (!j.원본 || !j.원본.파일 || !j.원본.md5 || !Array.isArray(j.서식)) { console.error('위치판 형식 아님(원본.파일·원본.md5·서식 필요): ' + f); process.exit(1); }
  const out = JSON.stringify(j); // 줄바꿈·들여쓰기만 뺀 같은 내용
  fs.writeFileSync(path.join(OUT, f), out);
  bytes += Buffer.byteLength(out);
  list.push({
    formKey: f.replace(/^서식위치_/, '').replace(/\.json$/, ''),
    서식: j.서식.map((s) => s.서식번호 || s.서식).join(', '),
    원본: path.basename(j.원본.파일), md5: j.원본.md5, 개정: j.원본.개정일 || '',
    칸수: j.서식.reduce((n, s) => n + s.칸.length, 0), 상태: j.상태 || ''
  });
}
// 원본에서 빠진 위치판은 앱 쪽에서도 지움
for (const f of fs.readdirSync(OUT)) {
  if (/^서식위치_.+\.json$/.test(f) && !files.includes(f)) fs.unlinkSync(path.join(OUT, f));
}
fs.writeFileSync(path.join(OUT, '_목록.json'), JSON.stringify({ 만든시각: new Date().toISOString(), 위치판: list }, null, 1));
console.log('위치판 ' + files.length + '장 복사 → app/formprint/위치판/ (' + (bytes / 1024).toFixed(0) + 'KB)');
