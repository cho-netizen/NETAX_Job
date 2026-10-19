// 법정서식 원본 모양 출력 — "다음 장 이어 찍기" node 확인 스크립트 (작업자 거, 2026-10-19)
// app/formprint/formprint.js 를 node에서 돌려
//   1) 합성 값(자산 5개·세율 5개·재산 15줄·채무 7줄 등)을 넣어 이어 찍은 견본 PDF를 만들고(서식별 한 장 용량·장 수 확인),
//   2) 뒷면 포함(backPages 기본)으로 증여10호·상속9호가 오류 없이 찍히는지(뒷면쪽이 숫자인 위치판),
//   3) 한 장에 다 들어가는 사건은 고치기 전 모듈(git HEAD)과 그림이 똑같은지 확인한다.
// 사용: node tools/formprint-continue-check.js [로컬 법정서식 폴더] [결과 폴더]
//   pdf-lib·fontkit: 환경변수 NX_NPM(node_modules 폴더) — 기본은 스크래치의 cha_npm/node_modules
//   그림: 환경변수 NX_POPPLER(pdftoppm 있는 폴더)
// 값은 모두 합성 값(신고용 아님).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCR = 'C:/Users/assa/AppData/Local/Temp/claude/C--GitHub/b8c13b8c-196b-4b52-8035-40a2435d0505/scratchpad';
const NPM = process.env.NX_NPM || SCR + '/cha_npm/node_modules/';
const POP = process.env.NX_POPPLER || 'C:/Users/assa/AppData/Local/Microsoft/WinGet/Packages/oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe/poppler-25.07.0/Library/bin/';
const LOCAL = process.argv[2] || SCR + '/formpdf';
const OUT = process.argv[3] || 'C:/GitHub/netax-inventory/maps/조견표/위치판/출력시험/이어찍기';
const PDFLib = require(path.join(NPM, 'pdf-lib'));
const fontkit = require(path.join(NPM, '@pdf-lib/fontkit'));
const FP = require(path.join(ROOT, 'app/formprint/formprint.js'));
const MAPDIR = path.join(ROOT, 'app/formprint/위치판');
const fontBytes = new Uint8Array(fs.readFileSync(path.join(ROOT, 'app/formprint/fonts/NanumGothic-Regular.ttf')));

function md5(b) { return crypto.createHash('md5').update(b).digest('hex'); }
const FOLDER_DIR = {}; for (const [k, v] of Object.entries(FP.FOLDERS)) FOLDER_DIR[v] = k;
const driveNameByMd5 = {};
for (const f of fs.readdirSync(MAPDIR).filter((x) => /^서식위치_/.test(x))) {
  const j = JSON.parse(fs.readFileSync(path.join(MAPDIR, f), 'utf8'));
  driveNameByMd5[j.원본.md5] = path.basename(j.원본.파일);
}
async function fakeCallGas(action, payload) {
  if (action === 'listFolder') {
    const dir = path.join(LOCAL, FOLDER_DIR[payload.folderId] || '');
    const files = fs.readdirSync(dir).filter((x) => /\.pdf$/i.test(x)).map((x) => {
      const p = path.join(dir, x), b = fs.readFileSync(p);
      return { id: p, name: driveNameByMd5[md5(b)] || x, type: 'file', mimeType: 'application/pdf', sizeBytes: b.length };
    });
    return { files };
  }
  if (action === 'readFileBinary') return { base64: fs.readFileSync(payload.fileId).toString('base64') };
  return { error: '모르는 요청' };
}
const loadMap = (k) => JSON.parse(fs.readFileSync(path.join(MAPDIR, '서식위치_' + k + '.json'), 'utf8'));
const baseOpts = { PDFLib, fontkit, fontBytes, callGas: fakeCallGas, loadMap, watermark: '견본 — 이어 찍기 시험(합성 값, 신고용 아님)' };

// ───── 합성 값 ─────
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));
const won = (i) => i * 1000000 + 12345;
function assetCols(n) { // 양도 부표1: 자산 n개(키 숫자를 키움)
  const v = {};
  for (let i = 1; i <= n; i++) {
    v['①@자산' + i + '.앞'] = '1'; v['①@자산' + i + '.뒤'] = '10';
    v['②@자산' + i + '.소재지'] = '경기도 ○○시 견본동 ' + i + '번지 (자산' + i + ')';
    v['③@자산' + i] = '01';
    v['④@자산' + i + '.날짜'] = '2025-06-' + String(i).padStart(2, '0');
    v['⑤@자산' + i + '.날짜'] = '2014-03-' + String(i).padStart(2, '0');
    v['⑪@자산' + i] = won(100 + i); v['⑫@자산' + i] = won(50 + i); v['⑭@자산' + i] = won(i);
    v['⑮@자산' + i] = won(49); v['⑱@자산' + i] = won(40 + i);
  }
  v['⑪@합계'] = won(999); v['⑫@합계'] = won(888); v['⑭@합계'] = won(77); v['⑮@합계'] = won(666); v['⑱@합계'] = won(555);
  return v;
}
function rateCols(n) { // 양도 84호 본표: 세율 n개
  const v = { 귀속연도: '2025', '신고구분': '확정신고', '①@성명': '홍길동', '①@주민등록번호': '000000-0000000', '①@주소': '서울특별시 ○○구 견본로 1',
    '②@성명': '김○○', '④@합계': won(900), '④@국내분소계': won(900), '⑦@합계': won(700), '⑩@합계': won(300), '⑱@합계': won(280), '신고인서명': '홍길동', '세무서': '서초' };
  for (let i = 1; i <= n; i++) {
    v['③@세율' + i + '.앞'] = String(i); v['③@세율' + i + '.뒤'] = String(10 + i);
    v['④@세율' + i] = won(100 + i); v['⑦@세율' + i] = won(80 + i); v['⑩@세율' + i] = won(10 + i); v['⑱@세율' + i] = won(9 + i);
  }
  return v;
}
// 상속 부표1: 재산 15줄(배열) + 국외 여부 체크(배열) + 합계
function estateRows(n) {
  return { '②': range(n, (i) => String(i).padStart(2, '0')), '③~소재지·법인명 등': range(n, (i) => '서울특별시 ○○구 견본로 ' + i + ' (재산' + i + ')'),
    '⑤': range(n, (i) => i * 10.5), '⑦': range(n, (i) => won(i)), '⑧': range(n, () => '08'), '③': range(n, (i) => (i % 2 ? '여' : '부')),
    '⑨': won(120), '⑩': won(120), '⑫': won(120), '㉙': won(100) };
}
// 상속 부표3: 채무 7줄(앞 5는 배열, 6·7은 '#줄' 지정), 공과금 4줄(한 장), 장례비 6줄
function debtRows() {
  const v = { '①': range(5, (i) => '금융기관 채무' + i), '③': range(5, (i) => '○○은행' + i), '⑥': range(5, (i) => won(i)),
    '①#6': '사인간 채무6', '③#6': '채권자6', '⑥#6': won(6), '①#7': '사인간 채무7', '③#7': '채권자7', '⑥#7': won(7), '⑦': won(28),
    '⑧': range(4, () => '01'), '⑨': range(4, () => '2026'), '⑪': range(4, (i) => won(i)), '⑫': won(10),
    '⑭': range(6, (i) => '장례식장' + i), '⑮': range(6, (i) => '지급내역' + i), '⑯': range(6, (i) => won(i)), '⑰': won(21), '㉛': won(500) };
  return v;
}
// 증여 부표1: 재산 20줄(9줄 서식 → 3장)
function giftRows(n) {
  return { '②': range(n, () => '05'), '③': range(n, (i) => '견본 재산 ' + i), '⑦': range(n, (i) => won(i)), '⑧': range(n, () => '08'),
    '국외자산여부': range(n, (i) => (i % 3 ? '부' : '여')), '⑨': won(210), '⑮': won(210) };
}
// 증여 부표5: 서화 45줄(20줄 → 3장)
function artRows(n) { return { '①': range(n, (i) => String(i)), '②': range(n, () => '홍길동'), '⑥': range(n, (i) => '작품' + i), '⑩': range(n, (i) => won(i)) }; }
// 증여 부표3: 혼인 증여 7건(열번호 5칸 → 2장)
function marriageCols(n) { const v = { '④': won(70), '⑭': won(50) }; for (let i = 1; i <= n; i++) { v['②@' + i] = '2026-0' + Math.min(9, i) + '-01'; v['③@' + i] = won(10 + i); } return v; }
// 양도 부표2: 주식 8종목(6열 → 2장) + 열 체크
function stockCols(n) { const v = { '⑩@합계': won(800) }; for (let i = 1; i <= n; i++) { v['①@종목' + i] = '견본주식' + i; v['⑩@종목' + i] = won(100 + i); v['⑱@종목' + i] = i % 2 ? '1.여' : '2.부'; } return v; }

const CASES = [
  { name: '양도84부표1_자산5', jobs: [{ formKey: '양도84부표1', values: assetCols(5) }], want: { 양도84부표1: 2 } },
  { name: '양도84호_세율5', jobs: [{ formKey: '양도84호', values: rateCols(5) }], want: { 양도84호: 2 } },
  { name: '상속9호부표1_재산15', jobs: [{ formKey: '상속9호부표1', values: estateRows(15) }], want: { 상속9호부표1: 3 } },
  { name: '상속9호부표3_채무7', jobs: [{ formKey: '상속9호부표3', values: debtRows() }], want: { 상속9호부표3: 2 } },
  { name: '상속9호부표3_채무7_합계첫장', jobs: [{ formKey: '상속9호부표3', values: debtRows() }], want: { 상속9호부표3: 2 }, opts: { continueTotals: 'first' } },
  { name: '증여10부표1_재산20', jobs: [{ formKey: '증여10부표1', values: giftRows(20) }], want: { 증여10부표1: 3 } },
  { name: '증여10부표5_서화45', jobs: [{ formKey: '증여10부표5', values: artRows(45) }], want: { 증여10부표5: 3 } },
  { name: '증여10부표3_혼인7', jobs: [{ formKey: '증여10부표3', values: marriageCols(7) }], want: { 증여10부표3: 2 } },
  { name: '양도84부표2_종목8', jobs: [{ formKey: '양도84부표2', values: stockCols(8) }], want: { 양도84부표2: 2 } },
  // 한 장에 들어가는 값은 이어 찍지 않아야 함
  { name: '상속9호부표1_재산5_한장', jobs: [{ formKey: '상속9호부표1', values: estateRows(5) }], want: { 상속9호부표1: 1 } }
];

function pageCount(bytes) { return PDFLib.PDFDocument.load(bytes).then((d) => d.getPageCount()); }
function toPng(pdf, prefix, dpi) {
  execFileSync(path.join(POP, 'pdftoppm.exe'), ['-r', String(dpi || 60), '-png', pdf, prefix]);
}
function pageHashes(pdf, tmp) {
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f));
  execFileSync(path.join(POP, 'pdftoppm.exe'), ['-r', '40', pdf, path.join(tmp, 'p')]);
  return fs.readdirSync(tmp).sort().map((f) => md5(fs.readFileSync(path.join(tmp, f))));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const res = { 만든시각: new Date().toString(), 이어찍기: [], 뒷면포함: [], 같은그림: [] };
  let bad = 0;
  // 1) 이어 찍기
  for (const cs of CASES) {
    const r = await FP.renderBytes(cs.jobs, Object.assign({}, baseOpts, cs.opts || {}));
    const file = path.join(OUT, '견본_' + cs.name + '.pdf');
    fs.writeFileSync(file, r.bytes);
    const r2 = await FP.renderBytes(cs.jobs, Object.assign({}, baseOpts, cs.opts || {}, { backPages: false, debugBoxes: true }));
    const dbg = path.join(OUT, '확인_' + cs.name + '_칸테두리.pdf');
    fs.writeFileSync(dbg, r2.bytes);
    toPng(dbg, path.join(OUT, '그림_' + cs.name), 70);
    const got = {};
    for (const f of r.report.forms) got[f.formKey] = f.장수;
    const ok = Object.keys(cs.want).every((k) => got[k] === cs.want[k]) && !r.report.unknownKeys.length;
    if (!ok) bad++;
    const row = { 사건: cs.name, 맞음: ok, 장수: got, 기대: cs.want, 쪽수: await pageCount(r.bytes), 찍은칸: r.report.placed, 모르는키: r.report.unknownKeys, 넘친칸: r.report.overflow, 이어찍기: r.report.continued, 경고: r.report.warnings };
    res.이어찍기.push(row);
    console.log((ok ? '○ ' : '✕ ') + cs.name + ': 장수 ' + JSON.stringify(got) + ' (기대 ' + JSON.stringify(cs.want) + '), PDF ' + row.쪽수 + '쪽, 찍은 칸 ' + row.찍은칸 + ', 모르는 키 ' + row.모르는키.length + (row.모르는키.length ? ' ' + row.모르는키.join(' / ') : '') + ', 넘친 칸 ' + row.넘친칸.length);
    for (const c of r.report.continued) console.log('     한 장 용량 ' + JSON.stringify(c.한장용량));
  }
  // 2) 뒷면 포함(뒷면쪽이 숫자 하나인 위치판) — 고치기 전에는 "(e.뒷면쪽 || []).forEach is not a function"
  for (const k of ['증여10호', '상속9호', '양도84호', '상속9호부표1', '상속9호부표3', '증여10부표1']) {
    try {
      const r = await FP.renderBytes([{ formKey: k, values: {} }], baseOpts);
      const n = await pageCount(r.bytes);
      res.뒷면포함.push({ 서식: k, 쪽: r.report.forms[0].쪽, PDF쪽수: n });
      console.log('○ 뒷면 포함 ' + k + ': 쪽 ' + JSON.stringify(r.report.forms[0].쪽));
    } catch (e) { bad++; res.뒷면포함.push({ 서식: k, 오류: e.message }); console.log('✕ 뒷면 포함 ' + k + ': ' + e.message); }
  }
  // 3) 한 장에 들어가는 사건 — 고치기 전 모듈(git HEAD)과 그림 비교
  const oldSrc = execFileSync('git', ['-C', ROOT, 'show', 'HEAD:app/formprint/formprint.js']).toString('utf8');
  const oldFile = path.join(SCR, 'geo_old_formprint.js');
  fs.writeFileSync(oldFile, oldSrc);
  const OLD = require(oldFile);
  const CASE3 = require(path.join(ROOT, 'app/formprint/test-cases.js'));
  const E = (function () { const src = fs.readFileSync(path.join(ROOT, 'gs-backend/manage/taxcalc-engine.html'), 'utf8').replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, ''); const win = {}; new Function('window', src)(win); return win; })();
  const MP = require(path.join(ROOT, 'app/formprint/mappers.js'));
  for (const cs of CASE3(E)) {
    const jobs = cs.forms.map((k) => ({ formKey: k, values: MP.mappers[k](cs.ctx).values }));
    const o = { PDFLib, fontkit, fontBytes, callGas: fakeCallGas, loadMap, backPages: false };
    const a = await OLD.renderBytes(jobs, o), b = await FP.renderBytes(jobs, o);
    const fa = path.join(SCR, 'geo_old.pdf'), fb = path.join(SCR, 'geo_new.pdf');
    fs.writeFileSync(fa, a.bytes); fs.writeFileSync(fb, b.bytes);
    const ha = pageHashes(fa, path.join(SCR, 'geo_ppm_a')), hb = pageHashes(fb, path.join(SCR, 'geo_ppm_b'));
    const same = ha.length === hb.length && ha.every((h, i) => h === hb[i]) && a.report.placed === b.report.placed;
    if (!same) bad++;
    res.같은그림.push({ 사건: cs.name, 같음: same, 쪽수: [ha.length, hb.length], 찍은칸: [a.report.placed, b.report.placed] });
    console.log((same ? '○ ' : '✕ ') + '고치기 전과 같은 그림 ' + cs.name + ': 쪽 ' + ha.length + '/' + hb.length + ', 찍은 칸 ' + a.report.placed + '/' + b.report.placed);
  }
  fs.writeFileSync(path.join(OUT, '_확인결과.json'), JSON.stringify(res, null, 1));
  console.log(bad ? '틀린 것 ' + bad + '건' : '모두 맞음');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
