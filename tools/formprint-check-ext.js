// 법정서식 원본 모양 출력 — 묶음 파일(app/formprint/mappers-<묶음>.js) 확인 (2026-10-20)
// 사용: node tools/formprint-check-ext.js <묶음|all> [결과 폴더]
//   <묶음>: 양도감면A·양도감면B·양도소득특례·증여특례A·증여특례B·상속부속A·상속부속B (mappers.js EXT_FILES)
//   all    : 일곱 묶음 진행 막대만(장마다 위치판·연결표·시험 사례가 있는지)
// 하는 일: 시험 사례(app/formprint/test-cases-<묶음>.js)를 대응표로 값을 만들어 법제처 원본 PDF(로컬 사본) 위에 찍고
//   ① 위치판에 없는 키(오타) ② 설명 없는 빈칸(값도 없고 missing에도 없는 칸) ③ 검산 틀림 ④ 넘친 칸을 보여 준다.
//   견본 PDF·칸테두리 PDF는 결과 폴더/<묶음>/ 에. pdf-lib·fontkit은 formprint-check.js와 같은 곳(NX_NPM).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCR = 'C:/Users/assa/AppData/Local/Temp/claude/C--GitHub/b8c13b8c-196b-4b52-8035-40a2435d0505/scratchpad';
const NPM = process.env.NX_NPM || SCR + '/cha_npm/node_modules/';
const LOCAL = process.env.NX_FORMPDF || SCR + '/formpdf';
const WHICH = process.argv[2] || 'all';
const OUT0 = process.argv[3] || 'C:/GitHub/netax-inventory/maps/조견표/위치판/출력시험';
const FP = require(path.join(ROOT, 'app/formprint/formprint.js'));
const MP = require(path.join(ROOT, 'app/formprint/mappers.js'));
const MAPDIR = path.join(ROOT, 'app/formprint/위치판');
const SRCDIR = path.join(ROOT, 'reftables/위치판');
MP.EXT_FILES.forEach((f) => { const p = path.join(ROOT, 'app/formprint', f); if (fs.existsSync(p)) require(p); });
const nameOf = (f) => f.replace(/^mappers-/, '').replace(/\.js$/, '');
const extByName = {}; MP.exts.forEach((x) => { extByName[x.묶음] = x; });

function load(src) { src = src.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, ''); const win = {}; new Function('window', src)(win); return win; }
const E = load(fs.readFileSync(path.join(ROOT, 'gs-backend/manage/taxcalc-engine.html'), 'utf8'));
function casesOf(name) {
  const p = path.join(ROOT, 'app/formprint/test-cases-' + name + '.js');
  if (!fs.existsSync(p)) return [];
  delete require.cache[require.resolve(p)];
  return require(p)(E, MP.helpers) || [];
}
const mapPath = (k) => [path.join(MAPDIR, '서식위치_' + k + '.json'), path.join(SRCDIR, '서식위치_' + k + '.json')].find((p) => fs.existsSync(p));
const loadMap = (k) => { const p = mapPath(k); if (!p) throw new Error('위치판 없음: ' + k); return JSON.parse(fs.readFileSync(p, 'utf8')); };

// ── 진행 막대 ──
function bar(done, all) { const w = 20, k = all ? Math.round(w * done / all) : 0; return '█'.repeat(k) + '░'.repeat(w - k) + ' ' + done + '/' + all + '장'; }
function progress() {
  let D = 0, A = 0;
  const lines = [];
  for (const f of MP.EXT_FILES) {
    const nm = nameOf(f), x = extByName[nm]; if (!x) continue;
    const tested = new Set();
    try { casesOf(nm).forEach((cs) => (cs.forms || []).forEach((it) => tested.add(typeof it === 'string' ? it : it.formKey))); } catch (e) { /* 사례 오류는 아래 개별 확인에서 */ }
    const keys = Object.keys(x.forms);
    const st = keys.map((k) => ({ k, 위치판: !!mapPath(k), 연결표: typeof x.mappers[k] === 'function', 시험: tested.has(k) }));
    const done = st.filter((s) => s.위치판 && s.연결표 && s.시험).length;
    D += done; A += keys.length;
    lines.push(nm.padEnd(8, ' ') + ' ' + bar(done, keys.length) + '  (위치판 ' + st.filter((s) => s.위치판).length + ' · 연결표 ' + st.filter((s) => s.연결표).length + ' · 시험 ' + st.filter((s) => s.시험).length + ')');
  }
  console.log('원본 모양 인쇄 55장 확장 — 전체 ' + bar(D, A));
  lines.forEach((l) => console.log('  ' + l));
}
if (WHICH === 'all') { progress(); process.exit(0); }

const ext = extByName[WHICH];
if (!ext) { console.error('모르는 묶음: ' + WHICH + ' (가능: ' + Object.keys(extByName).join(', ') + ')'); process.exit(1); }
const PDFLib = require(path.join(NPM, 'pdf-lib'));
const fontkit = require(path.join(NPM, '@pdf-lib/fontkit'));
const fontBytes = new Uint8Array(fs.readFileSync(path.join(ROOT, 'app/formprint/fonts/NanumGothic-Regular.ttf')));
const OUT = path.join(OUT0, WHICH);

// 가짜 callGas — formprint-check.js와 같은 방식(폴더ID → 로컬 하위폴더, 이름은 위치판 원본 이름으로)
const FOLDER_DIR = {}; for (const [k, v] of Object.entries(FP.FOLDERS)) FOLDER_DIR[v] = k;
const crypto = require('crypto');
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const driveNameByMd5 = {};
for (const d of [MAPDIR, SRCDIR]) for (const f of fs.readdirSync(d).filter((x) => /^서식위치_/.test(x))) {
  try { const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); if (j.원본 && j.원본.md5) driveNameByMd5[j.원본.md5] = path.basename(j.원본.파일); } catch (e) { /* 아래에서 */ }
}
async function fakeCallGas(action, payload) {
  if (action === 'listFolder') {
    const dir = path.join(LOCAL, FOLDER_DIR[payload.folderId] || '');
    if (!fs.existsSync(dir)) return { error: '폴더 없음(시험): ' + dir };
    const files = fs.readdirSync(dir).filter((x) => /\.pdf$/i.test(x)).map((x) => {
      const p = path.join(dir, x), b = fs.readFileSync(p);
      return { id: p, name: driveNameByMd5[md5(b)] || x, type: 'file', mimeType: 'application/pdf', sizeBytes: b.length };
    });
    return { path: [], folderId: payload.folderId, folders: [], files };
  }
  if (action === 'readFileBinary') { const b = fs.readFileSync(payload.fileId); return { name: path.basename(payload.fileId), mimeType: 'application/pdf', base64: b.toString('base64') }; }
  return { error: '시험용 callGas가 모르는 요청: ' + action };
}
const baseOpts = { PDFLib, fontkit, fontBytes, callGas: fakeCallGas, loadMap, watermark: '견본 — NETAX 원본 서식 출력 시험(합성 값, 신고용 아님)' };

const circ = (s) => { const m = String(s || '').match(/^[\u2460-\u24FF\u3251-\u325F\u32B1-\u32BF]+/); return m ? m[0] : String(s || '').split(/[\s(@|.~]/)[0]; };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cases = casesOf(WHICH);
  if (!cases.length) console.log('시험 사례 없음: app/formprint/test-cases-' + WHICH + '.js');
  const summary = [];
  let bad = 0;
  for (const cs of cases) {
    let list = cs.forms || (cs.tax ? MP.plan(cs.tax, cs.ctx) : []);
    const jobs = [], mapped = [];
    for (const it of list) {
      const k = typeof it === 'string' ? it : it.formKey, cx = typeof it === 'string' ? cs.ctx : (it.ctx || cs.ctx);
      if (typeof MP.mappers[k] !== 'function') { console.log('✗ 연결표 없음: ' + k); bad++; continue; }
      const m = MP.mappers[k](cx);
      const gen = (x) => x.replace(/#\d+$/, '').replace(/(@[^@.|~]*?)(\d+)(?=[.|]|$)/, '$11');
      const slots = FP.keysOfMap(loadMap(k));
      const all = slots.map((x) => x.키);
      const keys = new Set(all.concat(all.map((x) => x.split('|')[0])));
      const vk = Object.keys(m.values);
      const unknown = vk.filter((x) => !keys.has(x) && !keys.has(gen(x)) && !keys.has(gen(x).split('|')[0]));
      const filledBase = new Set(vk.map((x) => gen(x).split('|')[0]));
      const missTxt = m.missing.map((x) => String(x.칸)).join(' ');
      const silent = [...new Set(slots.filter((s) => !filledBase.has(s.키.split('|')[0]) && missTxt.indexOf(circ(s.칸 || s.키)) < 0).map((s) => s.칸 || s.키))];
      const wrong = m.checks.filter((c) => !c.맞음);
      bad += unknown.length + wrong.length;
      mapped.push({ form: k, 채운키: vk.length, 비운칸: m.missing.length, 위치판에없는키: unknown, 설명없는빈칸: silent, 검산틀림: wrong, notes: m.notes, missing: m.missing, checks: m.checks });
      jobs.push({ formKey: k, values: m.values });
    }
    if (!jobs.length) continue;
    const r1 = await FP.renderBytes(jobs, Object.assign({}, baseOpts, { backPages: false }));
    const file = path.join(OUT, '견본_' + cs.name + '.pdf');
    fs.writeFileSync(file, r1.bytes);
    const r2 = await FP.renderBytes(jobs, Object.assign({}, baseOpts, { backPages: false, debugBoxes: true }));
    fs.writeFileSync(path.join(OUT, '확인_' + cs.name + '_칸테두리.pdf'), r2.bytes);
    bad += r1.report.overflow.length + r1.report.unknownKeys.length;
    summary.push({ 견본: path.basename(file), 찍은칸: r1.report.placed, 줄인칸: r1.report.shrunk, 넘친칸: r1.report.overflow, 모르는키: r1.report.unknownKeys, 경고: r1.report.warnings, 대응: mapped });
  }
  fs.writeFileSync(path.join(OUT, '_확인결과.json'), JSON.stringify({ 만든시각: new Date().toString(), 묶음: WHICH, 견본: summary }, null, 1));
  for (const s of summary) {
    console.log('■ ' + s.견본 + ' — 찍은 칸 ' + s.찍은칸 + ', 줄인 칸 ' + s.줄인칸.length + ', 넘친 칸 ' + s.넘친칸.length + ', 모르는 키 ' + s.모르는키.length);
    for (const m of s.대응) {
      console.log('   ' + m.form + ': 채운 키 ' + m.채운키 + ', 비운 칸 ' + m.비운칸 + ', 위치판에 없는 키 ' + m.위치판에없는키.length + (m.위치판에없는키.length ? ' ' + m.위치판에없는키.join(' / ') : '') +
        ', 검산 틀림 ' + m.검산틀림.length + (m.검산틀림.length ? ' ' + JSON.stringify(m.검산틀림) : '') + ', 설명 없는 빈칸 ' + m.설명없는빈칸.length + (m.설명없는빈칸.length ? ' ' + m.설명없는빈칸.join(' / ') : ''));
    }
    if (s.넘친칸.length) console.log('   넘침: ' + s.넘친칸.join(' / '));
  }
  progress();
  console.log(bad ? '✗ 고칠 것 ' + bad + '건' : '✓ 오타·검산·넘침 없음');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
