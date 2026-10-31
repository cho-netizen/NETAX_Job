#!/usr/bin/env node
// [2026.10.20] 시스템 자기점검 ① 규칙 점검(gs-backend/SysAudit.js sysAuditRules_)을 node에서 실제 지침 파일로 돌린다 — 서버와 같은 함수.
// 드라이브 대신 로컬(구글 드라이브 J:)의 0 NETAX 폴더를 읽는다. 도구 이름은 Code.js·AiLead.js에서, 법령은 업무관리자/법령/_본문 정비본에서.
// 사용: node tools/sys-audit-check.js [--root "J:/내 드라이브/0 NETAX"] [--files <지침 복사본 폴더(bm/·chief/)>] [--inject] [--json]
//   --inject: 지침 복사본 끝에 일부러 틀린 줄(옛 주소·없는 도구·없는 조문·없는 경로·없는 지침)을 넣고 잡히는지 숫자로 확인
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const ROOT = opt('root') || 'J:/내 드라이브/0 NETAX';
const FILES = opt('files');
const INJECT = args.includes('--inject');
const SRC = path.join(__dirname, '..', 'gs-backend');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(SRC, 'SysAudit.js'), 'utf8'), ctx, { filename: 'SysAudit.js' });

// 도구 이름 — DRIVE_TOOLS·JOB_AI_TOOLS_(Code.js)·CASEPROC_AI_TOOLS_(AiLead.js)의 name
function toolNames() {
  const code = fs.readFileSync(path.join(SRC, 'Code.js'), 'utf8'), names = new Set();
  const block = (src, start) => { const i = src.indexOf(start); if (i < 0) throw new Error(start + ' 못 찾음'); let d = 0, j = src.indexOf('[', i); for (let k = j; k < src.length; k++) { if (src[k] === '[') d++; else if (src[k] === ']' && --d === 0) return src.slice(j, k + 1); } throw new Error(start + ' 끝 못 찾음'); };
  const parts = [];
  for (const [file, start] of [['Code.js', 'const DRIVE_TOOLS = ['], ['Code.js', 'const JOB_AI_TOOLS_ = ['], ['AiLead.js', 'var CASEPROC_AI_TOOLS_ = [']]) {
    const src = file === 'Code.js' ? code : fs.readFileSync(path.join(SRC, file), 'utf8');
    parts.push(block(src, start));
  }
  const ca = code.indexOf('function getClientActionTools_('); parts.push(code.slice(ca, code.indexOf('\n}\n', ca)));
  let tools = 0;
  for (const p of parts) {
    for (const m of p.matchAll(/\bname:\s*'([a-z][a-z0-9_]*)'/g)) { names.add(m[1]); tools++; }
    for (const m of p.matchAll(/enum:\s*\[([^\]]*)\]/g)) for (const v of m[1].matchAll(/'([^']+)'/g)) names.add(v[1]);
  }
  const cat = code.slice(code.indexOf('const TAX_TOOL_CATEGORIES_ = {'), code.indexOf('const TAX_TOOL_TO_CATEGORY_'));
  for (const m of cat.matchAll(/^\s{2}(\w+): \{ label:/gm)) names.add(m[1]);
  // [2026.10.31] 사건이 연결된 대화창 넥스에 붙는 사건 도구(report_parts) — 서버 sysAuditToolNames_와 같게
  const live = fs.readFileSync(path.join(SRC, 'AiLeadLive.js'), 'utf8').match(/var NX_CASE_REPORT_TOOL_ = \{ name: '([a-z_]+)'/);
  if (live) { names.add(live[1]); tools++; }
  // [2026.10.31] AI 회사 쪽에서 도는 도구 — 서버 sysAuditToolNames_와 같게
  for (const n of ['web_search', 'web_fetch', 'code_execution']) { names.add(n); tools++; }
  const pa = code.slice(code.indexOf('const JOB_PROPOSE_ACTIONS_ = {')); for (const m of pa.slice(0, pa.indexOf('\n};')).matchAll(/^\s{2}(\w+): \{/gm)) names.add(m[1]);
  return { names: [...names], toolCount: tools };
}

// 법령 정비본 현행판 조 목록
const LAWDIR = path.join(ROOT, '업무관리자', '법령', '_본문');
const lawIdx = JSON.parse(fs.readFileSync(path.join(LAWDIR, '색인.json'), 'utf8'));
function law(key) {
  const ent = lawIdx.법령[key];
  if (!ent) return null;
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(LAWDIR, key, ent.현행 + '.json.gz'))).toString('utf8'));
  const jo = {};
  for (const a of d.조 || []) jo[a.조] = [(a.항 || []).length, /^제\S+\s*삭제/.test(String(a.내용 || '')) ? 1 : 0];
  return { 판: ent.현행, 시행일: ent.현행.slice(0, 8), 조: jo };
}

// 경로 — 서버와 같은 sysAuditWalk_를 로컬 폴더로
const kidCache = {};
function children(dir) {
  if (kidCache[dir]) return kidCache[dir];
  let arr = [];
  try { arr = fs.readdirSync(dir, { withFileTypes: true }).map(e => ({ name: e.name, folder: e.isDirectory() ? path.join(dir, e.name) : null })); } catch (e) { arr = []; }
  arr.sort((a, b) => b.name.length - a.name.length);
  return (kidCache[dir] = arr);
}
const resolvePath = p => ctx.sysAuditWalk_(ROOT, p, children);

// 대상 파일 — 서버 sysAuditCollectFiles_와 같은 범위
function collect() {
  const bmDir = FILES ? path.join(FILES, 'bm') : path.join(ROOT, '업무관리자');
  const chDir = FILES ? path.join(FILES, 'chief') : path.join(ROOT, '총괄관리자');
  const rd = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  const mod = p => fs.statSync(p).mtime.toISOString().slice(0, 16).replace('T', ' ');
  const files = [];
  files.push({ name: '마스터 프로필(_NX_마스터프로필.md)', role: 'master', text: rd(path.join(chDir, '_NX_마스터프로필.md')), modified: mod(path.join(chDir, '_NX_마스터프로필.md')) });
  for (const [n, role] of [['NX_장기개발계획.md', 'plan'], ['체크리스트.md', 'checklist']]) files.push({ name: n, role, text: rd(path.join(chDir, n)), modified: mod(path.join(chDir, n)) });
  const bmNames = [];
  for (const n of fs.readdirSync(bmDir).filter(n => /\.(md|txt)$/i.test(n)).sort()) {
    bmNames.push(n.replace(/\.(md|txt)$/i, ''));
    if (n[0] === '_') continue;
    files.push({ name: n, role: 'bm', text: rd(path.join(bmDir, n)), modified: mod(path.join(bmDir, n)) });
  }
  files.forEach(f => { f.hash = require('crypto').createHash('md5').update(f.text).digest('base64').slice(0, 16); });
  return { files, bmNames };
}

function run(col, tools) {
  return ctx.sysAuditRules_({ files: col.files, toolNames: tools, bmNames: col.bmNames, prevHashes: null, law, resolvePath });
}
function countKinds(r) {
  const c = {};
  for (const f of r.files) for (const p of f.problems) { const k = p.kind + '·' + p.level; c[k] = (c[k] || 0) + 1; }
  return c;
}

const tn = toolNames(), tools = tn.names;
const col = collect();
const r = run(col, tools);
if (args.includes('--json')) { console.log(JSON.stringify(r, null, 1)); process.exit(0); }
console.log('도구 ' + tn.toolCount + '개(이름·분야·선택지 ' + tools.length + ') · 점검 파일 ' + r.totals.files + '개(업무관리자 지침 ' + col.files.filter(f => f.role === 'bm').length + ')');
console.log('합계:', JSON.stringify(r.totals));
console.log('종류별:', JSON.stringify(countKinds(r)));
for (const f of r.files) {
  if (!f.problems.length && !f.confirm.count) continue;
  console.log('\n■ ' + f.name + ' — 문제 ' + (f.counts.문제 || 0) + ' 주의 ' + (f.counts.주의 || 0) + ' 참고 ' + (f.counts.참고 || 0) + (f.confirm.count ? ' [확인 필요] ' + f.confirm.count + '(' + f.confirm.since + ')' : ''));
  for (const p of f.problems) console.log('  ' + String(p.line).padStart(4) + '줄 [' + p.kind + '·' + p.level + '] ' + p.text + (p.snippet ? '  «' + p.snippet.slice(0, 70) + '»' : ''));
}
console.log('\n파일 사이 중복 문장 ' + r.dupes.length + '개');

// ② 무료 AI 점검에 보낼 묶음(실제로 보내지는 않음) — 고객 자료 차단 장치(Federation.js)를 그대로 통과시키는지, 몇 번 요청으로 나뉘는지
vm.runInContext(fs.readFileSync(path.join(SRC, 'Federation.js'), 'utf8'), ctx, { filename: 'Federation.js' });
{
  let masked = 0; const blocked = [], hit = {}, usable = [];
  for (const f of col.files) {
    const before = ctx.aiLooksClientData_(f.text), m = ctx.sysAuditMaskClient_(f.text);
    masked += m.masked;
    if (before) hit[f.name] = m.masked;
    if (m.blocked) blocked.push(f.name); else usable.push(Object.assign({}, f, { text: m.text }));
  }
  const chunks = ctx.sysAuditAiChunks_(usable, usable.map(f => f.name), 90000);
  console.log('\n=== ② 무료 AI 묶음(보내지 않고 계획만) ===');
  console.log('  차단 장치에 걸린 파일 ' + Object.keys(hit).length + '개 → 걸린 곳 ' + masked + '군데 [가림] 처리, 가린 뒤에도 걸려 빠지는 파일 ' + blocked.length + '개' + (blocked.length ? ': ' + blocked.join(', ') : ''));
  for (const n of Object.keys(hit)) console.log('    ' + n + ': ' + hit[n] + '군데');
  console.log('  모든 파일이 바뀐 첫날 기준 요청 ' + chunks.length + '번(하룻밤 상한 6번, 나머지는 다음 밤):');
  chunks.forEach((c, i) => console.log('    #' + (i + 1) + ' 바뀐 ' + c.changed.length + '개 + 관련 ' + (c.files.length - c.changed.length) + '개 + 기준(' + c.base.join('·') + ') ≈ ' + c.len.toLocaleString() + '자' + (c.baseOnly ? ' (기준 문서 바뀜 — 첫 줄 목록과 대조)' : '')));
}

if (INJECT) {
  // 오늘 고친 옛 주소 같은 것이 다시 들어가면 잡히는지 — 지침 하나 끝에 틀린 줄을 붙여 다시 돌린다(복사본만, 드라이브는 그대로)
  const bad = [
    '', '## 시험용(일부러 틀린 줄)',
    '- 예약은 admin.netax.kr에서 확인한다.',
    '- 고칠 때는 `update_case_summary_txt`로 바꾸고 present_files로 보여 준다. 편집창 문서는 `apply_document_edit`(있는 도구 — 잡히면 안 됨).',
    '- report-writer 편집창에서 김OO사건.txt를 정리한다.',
    '- 근거: 소득세법 §999, 상속세 및 증여세법 시행령 §2의2⑨, 국세기본법 §26의2·§9999',
    '- 원문은 업무관리자\\법령\\없는폴더\\ 에 있다.',
    '> 관련 지침: 있지도않은_지침',
    '- 법인세는 법인세법 §55 참고.'
  ].join('\n');
  const target = col.files.find(f => f.role === 'bm');
  const col2 = { files: col.files.map(f => f === target ? Object.assign({}, f, { text: f.text + '\n' + bad }) : f), bmNames: col.bmNames };
  const r2 = run(col2, tools);
  const before = countKinds(r), after = countKinds(r2);
  console.log('\n=== --inject: ' + target.name + ' 끝에 틀린 줄 8개를 붙여 다시 점검 ===');
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const k of keys) if ((after[k] || 0) !== (before[k] || 0)) console.log('  ' + k + ': ' + (before[k] || 0) + ' → ' + (after[k] || 0) + ' (+' + ((after[k] || 0) - (before[k] || 0)) + ')');
  const f2 = r2.files.find(f => f.name === target.name);
  const startLine = target.text.split('\n').length + 1;
  console.log('  붙인 줄에서 잡힌 것:');
  for (const p of f2.problems.filter(p => p.line > startLine)) console.log('   ' + p.line + '줄 [' + p.kind + '·' + p.level + '] ' + p.text);
  const expect = { '옛 주소·방식·문제': 3, '없는 도구·문제': 2, '조문·문제': 3, '없는 경로·문제': 1, '없는 지침·문제': 1, '조문·참고': 1 };
  let ok = true;
  for (const k of Object.keys(expect)) { const got = (after[k] || 0) - (before[k] || 0); if (got !== expect[k]) { ok = false; console.log('  ✗ ' + k + ' 기대 +' + expect[k] + ', 실제 +' + got); } }
  console.log(ok ? '  ✓ 기대한 만큼 모두 잡힘' : '  ✗ 기대와 다름');
  if (!ok) process.exitCode = 1;
}
