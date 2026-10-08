// ============================================================
// [2026.10.08] job 구조 전환 — 화면 조립 스크립트
// ------------------------------------------------------------
// gs-backend/manage/index.html의 include_ 템플릿(<?!= include_('manage/x') ?>)을 펼쳐서 정적 HTML
// 한 장(app/index.html)으로 만든다. 이 파일을 깃허브 페이지(job.netax.kr/app/)가 그대로 서빙하고,
// 서버 호출은 gasbridge.html이 구글 서버(doPost __manage 입구)로 보낸다.
//
// 화면(manage/*.html)을 고친 뒤에는 반드시:
//   1) clasp push + clasp deploy  (예전 구글 주소용 — 서버 Code.js 변경도 이걸로 반영)
//   2) node tools/build-app.js     (job.netax.kr용 정적 파일 다시 만들기)
//   3) git commit + push           (깃허브 페이지에 올라가야 job.netax.kr에 반영됨)
// 실행: NETAX_Job 폴더에서 `node tools/build-app.js`
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'gs-backend');
const OUT_DIR = path.join(ROOT, 'app');

function assemble(name, depth, seen) {
  if (depth > 6) throw new Error('include가 너무 깊습니다: ' + name);
  const file = path.join(SRC, name + '.html');
  if (!fs.existsSync(file)) throw new Error('include 대상 파일이 없습니다: ' + file);
  seen.push(name);
  const src = fs.readFileSync(file, 'utf8');
  return src.replace(/<\?!=\s*include_\('([^']+)'\)\s*\?>/g, (_, f) => assemble(f, depth + 1, seen));
}

const seen = [];
let html = assemble('manage/index', 0, seen);

// 남은 앱스스크립트 템플릿 태그가 있으면 정적 서빙에서 그대로 노출되므로 실패로 처리한다.
const leftover = html.match(/<\?[\s\S]{0,80}?\?>/);
if (leftover) throw new Error('처리되지 않은 템플릿 태그가 남아 있습니다: ' + leftover[0]);

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
html = html.replace('<head>', '<head>\n  <!-- 자동 생성 파일 — 직접 고치지 말 것. 원본: gs-backend/manage/*.html, 생성: tools/build-app.js (' + stamp + ' UTC) -->');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
console.log('app/index.html 생성 — ' + (html.length / 1024 / 1024).toFixed(2) + 'MB, 포함 파일 ' + seen.length + '개');
