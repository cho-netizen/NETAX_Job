#!/usr/bin/env node
// [2026.10.22] 변경 점검표 ② — 올리기 전 검사(PC Claude는 clasp push 전, 웹 Claude는 PR 전에 돌린다).
//  세무사님 "혹시 시스템변경시 보안점검을 기본적으로 하지 않고 있나? 그리고 보안점검처럼 점검해야 할 항목이 꽤 많을 텐데?" → "1.2.번 만들고 일괄배포하라".
//  ①은 서버가 배포마다 스스로 보는 것(Code.js changeCheckRecord_ — 로그인 없는 입구·바깥 AI·서버 용량, 직전 배포와 비교).
//  이 도구는 깃허브(공개 저장소)에 올라가기 전에만 볼 수 있는 것을 본다 — 기준(origin/main)과 지금 작업 폴더의 차이(새로 더한 줄)만:
//   🚫 막음: 비밀번호·열쇠(API 키, 깃허브 토큰, 개인 열쇠, PC 비밀값 파일의 값) / 주민등록번호
//   ⚠ 알림: 전화번호 / 64자리 열쇠 모양 글자 / 화면이 로그인 확인 없이 타이머·불러오기에서 서버를 부름(10-14 장애)
//          / 로그인 없이 열리는 입구 증가 / 바깥 AI로 보내는 곳 증가 / 서버 용량 10MB 근처
//  돌리기: node tools/change-check.js [--base=origin/main]   — 🚫가 있으면 종료코드 1(올리지 말 것), ⚠만 있으면 0(내용을 보고 판단)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const base = (process.argv.find((a) => a.indexOf('--base=') === 0) || '--base=origin/main').slice(7);

// 새로 더한 줄: 기준 대비 작업 폴더(커밋 + 안 한 수정) + 새 파일
const added = []; // { file, line, text }
const diff = git(['diff', '-U0', '--no-color', base, '--', '.']);
let file = null, ln = 0;
diff.split('\n').forEach((l) => {
  if (l.startsWith('+++ ')) { file = l.slice(4).replace(/^b\//, ''); return; }
  const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
  if (h) { ln = +h[1]; return; }
  if (file && l.startsWith('+')) { added.push({ file, line: ln, text: l.slice(1) }); ln++; }
});
git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean).forEach((f) => {
  let t = ''; try { t = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return; }
  t.split(/\r?\n/).forEach((s, i) => added.push({ file: f, line: i + 1, text: s }));
});
// 자동 생성 묶음(app/index.html)은 원본(manage/*.html)에서 보므로 뺀다
const rows = added.filter((a) => !/^app\/index\.html$/.test(a.file) && !/\.(png|jpe?g|gif|pdf|ico|woff2?)$/i.test(a.file));

const block = [], warn = [];
const at = (a) => a.file + ':' + a.line;
const SAMPLE = /예시|견본|시험|테스트|test|mock|sample|dummy|가짜|######|\*\*\*\*/i;

// 🚫 비밀번호·열쇠
let secretVals = [];
try { const s = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.netax', 'secret.json'), 'utf8')); secretVals = Object.values(s).filter((v) => typeof v === 'string' && v.length >= 12); } catch (e) { }
const SECRET_RE = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'Claude API 키'],
  [/AIza[0-9A-Za-z_-]{35}/, '구글 API 키'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/, '깃허브 토큰'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '개인 열쇠'],
  [/\bsk-[A-Za-z0-9]{32,}/, 'OpenAI 키']
];
rows.forEach((a) => {
  SECRET_RE.forEach(([re, name]) => { if (re.test(a.text)) block.push(name + ' — ' + at(a)); });
  secretVals.forEach((v) => { if (a.text.indexOf(v) !== -1) block.push('PC 비밀값 파일(.netax/secret.json)의 값 — ' + at(a)); });
});
// 🚫 주민등록번호 / ⚠ 전화번호 — 견본·가림 표시가 있는 줄은 제외, 정규식 글자(\d)는 숫자가 아니라 패턴이라 걸리지 않음
rows.forEach((a) => {
  if (SAMPLE.test(a.text)) return;
  if (/(?<!\d)\d{6}\s*-\s*[1-8]\d{6}(?!\d)/.test(a.text)) block.push('주민등록번호 모양 — ' + at(a));
  if (/(?<!\d)01[016789]-?\d{3,4}-?\d{4}(?!\d)/.test(a.text)) warn.push('전화번호 모양 — ' + at(a) + ' (고객 번호면 지울 것)');
  if (/(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/i.test(a.text)) warn.push('64자리 열쇠 모양 글자 — ' + at(a) + ' (출입증·비밀값이면 지울 것)');
});
// ⚠ 화면: 로그인 확인 없이 타이머·불러오기·변화 감시에서 서버 호출(L2_screen_ui — 10-14 로그인 창 안 뜬 장애)
const html = rows.filter((a) => /^gs-backend\/manage\/[^/]+\.html$/.test(a.file));
const byFile = {};
html.forEach((a) => { (byFile[a.file] = byFile[a.file] || []).push(a); });
Object.keys(byFile).forEach((f) => {
  let src = []; try { src = fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/); } catch (e) { return; }
  byFile[f].forEach((a) => {
    if (!/callGas\(/.test(a.text)) return;
    const win = src.slice(Math.max(0, a.line - 16), a.line + 2).join('\n');
    if (/setInterval|setTimeout|DOMContentLoaded|addEventListener\(\s*['"](load|visibilitychange|focus)['"]|MutationObserver|onload\s*=/.test(win) && !/nxManageSessionToken|SessionToken|nxHasSession|isLoggedIn|loggedIn/.test(win)) {
      warn.push('로그인 확인 없이 자동으로 서버를 부르는 듯 — ' + at(a) + ' (세션 토큰 확인 뒤에만 부를 것)');
    }
  });
});
// ⚠ 로그인 없이 열리는 입구(PUBLIC_ACTIONS_) 증가
const pubOf = (src) => { const m = String(src || '').match(/const PUBLIC_ACTIONS_ = \[([\s\S]*?)\];/); return m ? (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)) : []; };
let baseCode = ''; try { baseCode = git(['show', base + ':gs-backend/Code.js']); } catch (e) { }
const curCode = fs.readFileSync(path.join(ROOT, 'gs-backend', 'Code.js'), 'utf8');
const pubAdded = pubOf(curCode).filter((x) => pubOf(baseCode).indexOf(x) === -1);
if (pubAdded.length) warn.push('로그인 없이 열리는 입구가 늘어남: ' + pubAdded.join(', ') + ' — 고객 비밀번호 등 따로 검사하는지 확인');
// ⚠ 바깥 AI로 보내는 곳 증가 / 서버 용량
const GS = path.join(ROOT, 'gs-backend');
const ignore = fs.readFileSync(path.join(GS, '.claspignore'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const serverFiles = fs.readdirSync(GS).filter((f) => /\.(js|json)$/.test(f) && !ignore.includes(f) && f !== '.clasp.json')
  .concat(fs.readdirSync(path.join(GS, 'manage')).filter((f) => /\.html$/.test(f) && !ignore.includes('manage/' + f)).map((f) => 'manage/' + f));
const HOSTS = { 'api.anthropic.com': 'Claude(유료)', 'generativelanguage.googleapis.com': 'Gemini', 'api.openai.com': 'OpenAI(유료)' };
let bytes = 0;
serverFiles.forEach((f) => {
  const cur = fs.readFileSync(path.join(GS, f), 'utf8');
  bytes += Buffer.byteLength(cur.replace(/\r\n/g, '\n'), 'utf8');
  let old = ''; try { old = git(['show', base + ':gs-backend/' + f]); } catch (e) { }
  Object.keys(HOSTS).forEach((h) => {
    const n = cur.split('https://' + h).length - 1, o = old.split('https://' + h).length - 1;
    if (n > o) warn.push('바깥 AI로 보내는 곳이 늘어남: ' + f + ' · ' + HOSTS[h] + ' ' + o + '→' + n + ' — 고객 정보 가림·비용(토큰 0 원칙) 확인');
  });
});
if (bytes > 9800000) warn.push('서버 용량 ' + (bytes / 1e6).toFixed(2) + 'MB — 10MB 한도 근처(큰 자료는 화면 쪽으로)');

const out = ['변경 점검(올리기 전) — 기준 ' + base + ', 새로 더한 줄 ' + rows.length + '개, 서버 용량 ' + (bytes / 1e6).toFixed(2) + 'MB'];
if (block.length) out.push('🚫 막음 ' + block.length + '건 — 지우기 전엔 올리지 말 것\n- ' + Array.from(new Set(block)).join('\n- '));
if (warn.length) out.push('⚠ 알림 ' + warn.length + '건 — 의도한 것인지 확인\n- ' + Array.from(new Set(warn)).join('\n- '));
if (!block.length && !warn.length) out.push('✓ 비밀번호·고객 정보·로그인 전 서버 호출·입구·바깥 AI·용량 모두 이상 없음');
console.log(out.join('\n'));
process.exit(block.length ? 1 : 0);
