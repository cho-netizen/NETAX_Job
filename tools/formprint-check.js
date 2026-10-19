// 법정서식 원본 모양 출력 — node 확인 스크립트 (작업자 파, 2026-10-19)
// 앱과 같은 코드(app/formprint/formprint.js + mappers.js)를 node에서 돌려 견본 PDF 3장(양도·증여·상속)을 만든다.
// 바탕 PDF는 가짜 callGas(listFolder·readFileBinary 흉내)로 로컬 법정서식 PDF를 넘긴다 — 앱의 서버 경로·md5 확인까지 같이 시험.
// 사용: node tools/formprint-check.js [로컬 법정서식 폴더] [결과 폴더]
//   로컬 법정서식 폴더: 상속·증여·양도·공통 하위 폴더에 법제처 PDF(이름에 _개정… 없음)가 있는 곳(기본: 스크래치 formpdf)
//   pdf-lib·fontkit: 환경변수 NX_NPM(node_modules 폴더) — 기본은 스크래치의 cha_npm/node_modules
// 값은 모두 합성 값(신고용 아님). 엔진은 tools/engine-regress.js 와 같은 방법으로 불러 계산한다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCR = 'C:/Users/assa/AppData/Local/Temp/claude/C--GitHub/b8c13b8c-196b-4b52-8035-40a2435d0505/scratchpad';
const NPM = process.env.NX_NPM || SCR + '/cha_npm/node_modules/';
const LOCAL = process.argv[2] || SCR + '/formpdf';
const OUT = process.argv[3] || 'C:/GitHub/netax-inventory/maps/조견표/위치판/출력시험';
const PDFLib = require(path.join(NPM, 'pdf-lib'));
const fontkit = require(path.join(NPM, '@pdf-lib/fontkit'));
const FP = require(path.join(ROOT, 'app/formprint/formprint.js'));
const MP = require(path.join(ROOT, 'app/formprint/mappers.js'));
const MAPDIR = path.join(ROOT, 'app/formprint/위치판');
const fontBytes = new Uint8Array(fs.readFileSync(path.join(ROOT, 'app/formprint/fonts/NanumGothic-Regular.ttf')));

// 엔진 — engine-regress.js 의 load와 같은 방식
function load(src) { src = src.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, ''); const win = {}; new Function('window', src)(win); return win; }
const E = load(fs.readFileSync(path.join(ROOT, 'gs-backend/manage/taxcalc-engine.html'), 'utf8'));

// 가짜 callGas — 폴더ID → 로컬 하위폴더, 파일 이름은 드라이브 이름(_개정… 붙은 것)으로 돌려줌
const FOLDER_DIR = {}; for (const [k, v] of Object.entries(FP.FOLDERS)) FOLDER_DIR[v] = k;
const crypto = require('crypto');
function md5(b) { return crypto.createHash('md5').update(b).digest('hex'); }
const driveNameByMd5 = {};
for (const f of fs.readdirSync(MAPDIR).filter((x) => /^서식위치_/.test(x))) {
  const j = JSON.parse(fs.readFileSync(path.join(MAPDIR, f), 'utf8'));
  driveNameByMd5[j.원본.md5] = path.basename(j.원본.파일);
}
const calls = [];
async function fakeCallGas(action, payload) {
  calls.push(action);
  if (action === 'listFolder') {
    const dir = path.join(LOCAL, FOLDER_DIR[payload.folderId] || '');
    if (!fs.existsSync(dir)) return { error: '폴더를 찾을 수 없습니다(시험): ' + dir };
    const files = fs.readdirSync(dir).filter((x) => /\.pdf$/i.test(x)).map((x) => {
      const p = path.join(dir, x), b = fs.readFileSync(p);
      return { id: p, name: driveNameByMd5[md5(b)] || x, type: 'file', mimeType: 'application/pdf', sizeBytes: b.length };
    });
    return { path: [], folderId: payload.folderId, folders: [], files };
  }
  if (action === 'readFileBinary') {
    const b = fs.readFileSync(payload.fileId);
    return { name: path.basename(payload.fileId), mimeType: 'application/pdf', base64: b.toString('base64') };
  }
  return { error: '시험용 callGas가 모르는 요청: ' + action };
}
const baseOpts = {
  PDFLib, fontkit, fontBytes, callGas: fakeCallGas,
  loadMap: (k) => JSON.parse(fs.readFileSync(path.join(MAPDIR, '서식위치_' + k + '.json'), 'utf8')),
  watermark: '견본 — NETAX 원본 서식 출력 시험(합성 값, 신고용 아님)'
};

// ───── 합성 사건 3건(app/formprint/test-cases.js — test.html과 같은 자료) ─────
const CASES = require(path.join(ROOT, 'app/formprint/test-cases.js'))(E);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const summary = [];
  for (const cs of CASES) {
    // 대응표가 쓰는 키가 위치판에 다 있는지(오타 잡기)
    const jobs = [], mapped = [];
    for (const k of cs.forms) {
      const m = MP.mappers[k](cs.ctx);
      const keys = new Set(FP.keysOfMap(baseOpts.loadMap(k)).map((x) => x.키));
      const bases = new Set(FP.keysOfMap(baseOpts.loadMap(k)).map((x) => x.키.split('|')[0]));
      const bad = Object.keys(m.values).filter((x) => !keys.has(x) && !bases.has(x));
      mapped.push({ form: k, 채운키: Object.keys(m.values).length, 비운칸: m.missing.length, 위치판에없는키: bad, 검산틀림: m.checks.filter((c) => !c.맞음), notes: m.notes, missing: m.missing, checks: m.checks });
      jobs.push({ formKey: k, values: m.values });
    }
    const r1 = await FP.renderBytes(jobs, Object.assign({}, baseOpts, { backPages: false }));
    const file = path.join(OUT, '견본_' + cs.name + '_원본출력.pdf');
    fs.writeFileSync(file, r1.bytes);
    const r2 = await FP.renderBytes(jobs, Object.assign({}, baseOpts, { backPages: false, debugBoxes: true }));
    fs.writeFileSync(path.join(OUT, '확인_' + cs.name + '_칸테두리.pdf'), r2.bytes);
    summary.push({ 견본: path.basename(file), 크기: r1.bytes.length, 찍은칸: r1.report.placed, 줄인칸: r1.report.shrunk, 넘친칸: r1.report.overflow, 모르는키: r1.report.unknownKeys, 경고: r1.report.warnings, 서식: r1.report.forms, 대응: mapped });
  }
  // 오류 경로 시험: md5가 다른 원본, 폴더에 없는 파일
  const errs = [];
  FP.clearCache();
  try { await FP.renderBytes([{ formKey: '증여10호', values: {} }], Object.assign({}, baseOpts, { getSourceBytes: () => new Uint8Array([37, 80, 68, 70]) })); errs.push('md5 틀림: 막지 못함(문제)'); }
  catch (e) { errs.push('md5 틀림 → ' + e.message); }
  FP.clearCache();
  try { await FP.renderBytes([{ formKey: '증여10호', values: {} }], Object.assign({}, baseOpts, { callGas: async (a) => (a === 'listFolder' ? { files: [] } : {}) })); errs.push('파일 없음: 막지 못함(문제)'); }
  catch (e) { errs.push('파일 없음 → ' + e.message); }
  const rep = { 만든시각: new Date().toString(), 결과폴더: OUT, 서버호출: calls.join(','), 견본: summary, 오류시험: errs };
  fs.writeFileSync(path.join(OUT, '_확인결과.json'), JSON.stringify(rep, null, 1));
  for (const s of summary) {
    console.log('■ ' + s.견본 + ' ' + (s.크기 / 1024).toFixed(0) + 'KB, 찍은 칸 ' + s.찍은칸 + ', 줄인 칸 ' + s.줄인칸.length + ', 넘친 칸 ' + s.넘친칸.length + ', 모르는 키 ' + s.모르는키.length);
    for (const m of s.대응) console.log('   ' + m.form + ': 채운 키 ' + m.채운키 + ', 비운 칸 ' + m.비운칸 + ', 위치판에 없는 키 ' + m.위치판에없는키.length + (m.위치판에없는키.length ? ' ' + m.위치판에없는키.join(' / ') : '') + ', 검산 틀림 ' + m.검산틀림.length + (m.검산틀림.length ? ' ' + JSON.stringify(m.검산틀림) : ''));
    if (s.넘친칸.length) console.log('   넘침: ' + s.넘친칸.join(' / '));
    if (s.모르는키.length) console.log('   모르는 키: ' + s.모르는키.join(' / '));
  }
  console.log('서버 호출: ' + calls.length + '번 (' + [...new Set(calls)].join(',') + ')');
  errs.forEach((e) => console.log('오류 시험: ' + e));
})().catch((e) => { console.error(e); process.exit(1); });
