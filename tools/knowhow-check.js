#!/usr/bin/env node
// [2026.10.20] 지침·템플릿 정비 순환(gs-backend/KnowHow.js) 가짜 서버 시험 — 서버와 같은 코드를 node에서 돌린다.
// 드라이브 대신 로컬 구글 드라이브(J:)의 실제 파일을 **읽기만** 해서 메모리 안 가짜 드라이브를 만든다(쓰기·이동은 메모리에서만 — 실제 드라이브는 안 바뀜).
//  - 지침: 0 NETAX/업무관리자 맨 위 .md / 템플릿: 보고서템플릿·문단·의뢰서템플릿
//  - 사건: 고객사건 폴더 이름("고객(납세자)_세목_업무유형")으로 세목·업무유형만 뽑는다(이름은 출력하지 않음)
//  - 법령 개정: 고객사건/_AI대화기록/_환경감시결과.json, 템플릿 통계: _개선후보.json, 유료 질문: _유료질문기록.json
//  - 자기점검: --sysaudit <SysAudit.js 경로>가 있으면 그 sysAuditRules_로(서버와 같은 함수) 지침·템플릿을 점검
// 사용: node tools/knowhow-check.js [--sysaudit ../wt-sys-audit/gs-backend/SysAudit.js] [--json]
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), zlib = require('zlib');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const DRIVE = opt('drive') || 'J:/내 드라이브';
const NETAX = path.join(DRIVE, '0 NETAX'), BM = path.join(NETAX, '업무관리자'), CASES = path.join(DRIVE, '고객사건'), AIDIR = path.join(CASES, '_AI대화기록');
const SRC = path.join(__dirname, '..', 'gs-backend');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };

// ---------- 메모리 드라이브 ----------
let idSeq = 0;
const byId = {};
class MFile {
  constructor(name, text, parent, mtime) { this.id = 'f' + (++idSeq); this.name = name; this.text = text; this.parent = parent; this.mtime = mtime || new Date(); this.trashed = false; byId[this.id] = this; parent.files.push(this); }
  getId() { return this.id; } getName() { return this.name; } setName(n) { this.name = n; return this; }
  getBlob() { const t = this.text; return { getDataAsString: () => t }; }
  setContent(t) { this.text = t; this.mtime = new Date(); return this; }
  getLastUpdated() { return this.mtime; } isTrashed() { return this.trashed; } getMimeType() { return 'text/markdown'; } getUrl() { return 'https://drive/' + this.id; }
  getParents() { return iter([this.parent]); }
  moveTo(f) { this.parent.files = this.parent.files.filter(x => x !== this); this.parent = f; f.files.push(this); return this; }
}
class MFolder {
  constructor(name, parent) { this.id = 'd' + (++idSeq); this.name = name; this.parent = parent; this.files = []; this.folders = []; byId[this.id] = this; if (parent) parent.folders.push(this); }
  getId() { return this.id; } getName() { return this.name; }
  getFiles() { return iter(this.files.slice()); }
  getFilesByName(n) { return iter(this.files.filter(f => f.name === n)); }
  getFoldersByName(n) { return iter(this.folders.filter(f => f.name === n)); }
  createFolder(n) { return new MFolder(n, this); }
  createFile(a, b) { if (typeof a === 'object') return new MFile(a.name, a.text, this); return new MFile(a, b, this); }
  getParents() { return iter(this.parent ? [this.parent] : []); }
}
function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
function loadDir(dir, folder, deep) {
  if (!fs.existsSync(dir)) return;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n), st = fs.statSync(p);
    if (st.isDirectory()) { if (deep && deep(n)) loadDir(p, new MFolder(n, folder), deep); }
    else if (/\.(md|txt)$/i.test(n)) new MFile(n, fs.readFileSync(p, 'utf8'), folder, st.mtime);
  }
}
const root = new MFolder('0 NETAX', null);
const bm = new MFolder('업무관리자', root);
loadDir(BM, bm, n => ['보고서템플릿', '의뢰서템플릿', '문단', '_제안함'].includes(n));
const chief = new MFolder('총괄관리자', root);
const repF = bm.folders.find(f => f.name === '보고서템플릿'), casF = bm.folders.find(f => f.name === '의뢰서템플릿');

// 사건(폴더 이름에서 세목·업무유형만) — 상태는 모두 진행, 시험용으로 3건만 완료
const SEMOK = { 양도: 'transfer', 증여: 'gift', 상속: 'inheritance', 불복: 'objection', 사업: 'business' };
const UPS = ['신고', '자문', '상담', '이의신청', '심사청구', '심판청구', '행정소송', '경정청구', '과세적부', '해명자료', '세무조사', '자금출처소명'];
const caseRows = [], caseNames = [];
for (const n of fs.existsSync(CASES) ? fs.readdirSync(CASES) : []) {
  const p = path.join(CASES, n);
  if (!fs.statSync(p).isDirectory()) continue;
  const m = n.match(/^(.+?)\((.+?)\)_([가-힣]+)(?:_([가-힣]+))?/);
  if (!m) continue;
  let semok = m[3], up = m[4] || '';
  if (UPS.includes(semok)) { up = semok; semok = '불복'; }
  if (!SEMOK[semok]) continue;
  if (semok !== '불복' && !up) up = '자문';
  if (semok === '불복' && !up) up = '이의신청';
  const ft = new MFolder(n, null);
  const rd = path.join(p, '보고서_내부');
  if (fs.existsSync(rd)) loadDir(rd, new MFolder('보고서_내부', ft));
  caseRows.push({ id: 'c' + caseRows.length, 세목: SEMOK[semok], 업무유형: up, 상태: '진행', 수정일: fs.statSync(p).mtime.toISOString().slice(0, 10), 폴더ID: ft.id, 고객명: m[1], 납세자: m[2] });
  caseNames.push(m[1], m[2]);
}
// 완료 사건 3건(보고서_내부에 .md가 있는 것) — 재료 모으기 시험
const withReports = caseRows.filter(r => { const f = byId[r.폴더ID]; const s = f.folders.find(x => x.name === '보고서_내부'); return s && s.files.length; });
withReports.slice(0, 3).forEach(r => { r.상태 = '완료'; r.수정일 = new Date().toISOString().slice(0, 10); });

// ---------- GAS 흉내 ----------
const props = {};
const readJ = f => { try { return JSON.parse(fs.readFileSync(path.join(AIDIR, f), 'utf8')); } catch (e) { return null; } };
const fetchMap = {};
const ctx = {
  console: { log() { }, error() { } },
  Utilities: {
    formatDate: (d, tz, f) => { const k = new Date(d.getTime() + 9 * 3600000).toISOString(); return f.replace('yyyy', k.slice(0, 4)).replace('MM', k.slice(5, 7)).replace('dd', k.slice(8, 10)).replace('HH', k.slice(11, 13)).replace('mm', k.slice(14, 16)); },
    computeDigest: (a, s) => [...crypto.createHash('md5').update(s, 'utf8').digest()], base64Encode: b => Buffer.from(b.map(x => x & 255)).toString('base64'),
    DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' }, newBlob: (text, mime, name) => ({ text, name })
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] == null ? null : props[k], setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
  DriveApp: { getFileById: id => { if (!byId[id] || !(byId[id] instanceof MFile)) throw new Error('없는 파일 ' + id); return byId[id]; }, getFolderById: id => { if (!byId[id]) throw new Error('없는 폴더'); return byId[id]; } },
  UrlFetchApp: { fetch: u => resp(u), fetchAll: rs => rs.map(r => resp(r.url)) },
  GH_REPO_: 'test/repo', WORK_SUBFOLDER_INTERNAL_REPORT: '보고서_내부',
  getChiefManagerFolder_: () => chief, getBusinessManagerFolder_: () => bm, getReportTemplateFolder_: () => repF, getCaseTemplateFolder_: () => casF,
  getNetaxRootFolder_: () => root,
  getOrCreateSubfolder_: (p, n) => p.folders.find(f => f.name === n) || p.createFolder(n),
  writeFileOverwrite_: (fo, n, c) => { const f = fo.files.find(x => x.name === n); if (f) f.setContent(c); else fo.createFile(n, c); },
  withLock_: (ms, fn) => fn(),
  aiSaveBackupPrev_: (fo, file) => { const bk = fo.folders.find(f => f.name === '_이전판') || fo.createFolder('_이전판'); const e = bk.files.find(x => x.name === file.name); if (e) e.setContent(file.text); else bk.createFile(file.name, file.text); return true; },
  work_getSheet_: () => ({ getDataRange: () => ({ getValues: () => [['id', '고객명', '세목', '업무유형', '상태', '수정일', '폴더ID', '납세자']].concat(caseRows.map(r => [r.id, r.고객명, r.세목, r.업무유형, r.상태, r.수정일, r.폴더ID, r.납세자])) }) }),
  work_colMap_: h => { const m = {}; h.forEach((x, i) => { m[x] = i; }); return m; },
  envWatchLast_: () => readJ('_환경감시결과.json'),
  getImprovementReport_: () => ({ report: readJ('_개선후보.json') }),
  corrSummary_: () => [],
  ai_paidLogFile_: () => ({ getBlob: () => ({ getDataAsString: () => fs.existsSync(path.join(AIDIR, '_유료질문기록.json')) ? fs.readFileSync(path.join(AIDIR, '_유료질문기록.json'), 'utf8') : '[]' }) }),
  improve_parseAt_: s => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); return m ? new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':00+09:00').getTime() : 0; },
  improve_isTestNoise_: s => /\[점검 중|zz_|\[시험\]|harness/.test(String(s || ''))
};
function resp(u) { const t = fetchMap[u]; return { getResponseCode: () => t == null ? 404 : 200, getContentText: () => t }; }
vm.createContext(ctx);
const sysAuditPath = opt('sysaudit');
if (sysAuditPath) {
  vm.runInContext(fs.readFileSync(sysAuditPath, 'utf8'), ctx, { filename: 'SysAudit.js' });
  // 서버의 sysAuditToolNames_·sysAuditLaw_·sysAuditPathResolver_ 대신 node용(tools/sys-audit-check.js와 같은 방식)
  const code = fs.readFileSync(path.join(SRC, 'Code.js'), 'utf8'), names = new Set();
  const block = (src, start) => { const i = src.indexOf(start); if (i < 0) return ''; let d = 0, j = src.indexOf('[', i); for (let k = j; k < src.length; k++) { if (src[k] === '[') d++; else if (src[k] === ']' && --d === 0) return src.slice(j, k + 1); } return ''; };
  for (const [f, s] of [['Code.js', 'const DRIVE_TOOLS = ['], ['Code.js', 'const JOB_AI_TOOLS_ = ['], ['AiLead.js', 'var CASEPROC_AI_TOOLS_ = [']]) for (const m of block(f === 'Code.js' ? code : fs.readFileSync(path.join(SRC, f), 'utf8'), s).matchAll(/\bname:\s*'([a-z][a-z0-9_]*)'/g)) names.add(m[1]);
  ctx.sysAuditToolNames_ = () => [...names];
  const LAWDIR = path.join(BM, '법령', '_본문'); let idx = null; try { idx = JSON.parse(fs.readFileSync(path.join(LAWDIR, '색인.json'), 'utf8')); } catch (e) { }
  ctx.sysAuditLaw_ = key => { const ent = idx && idx.법령[key]; if (!ent) return null; const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(LAWDIR, key, ent.현행 + '.json.gz'))).toString('utf8')); const jo = {}; for (const a of d.조 || []) jo[a.조] = [(a.항 || []).length, /^제\S+\s*삭제/.test(String(a.내용 || '')) ? 1 : 0]; return { 판: ent.현행, 시행일: ent.현행.slice(0, 8), 조: jo }; };
  ctx.sysAuditPathResolver_ = () => null;
  // 지침 자기점검 결과(밤에 SysAudit가 남기는 것)를 같은 함수로 만들어 둔다
  ctx.sysAuditResult_ = () => ({ result: { at: '시험', rules: ctx.sysAuditRules_({ files: bm.files.filter(f => /\.(md|txt)$/i.test(f.name)).map(f => ({ name: f.name, role: 'bm', text: f.text, modified: '' })), toolNames: ctx.sysAuditToolNames_(), bmNames: bm.files.map(f => f.name.replace(/\.(md|txt)$/i, '')), law: ctx.sysAuditLaw_, resolvePath: null }) } });
}
vm.runInContext(fs.readFileSync(path.join(SRC, 'KnowHow.js'), 'utf8'), ctx, { filename: 'KnowHow.js' });
const C = (s) => vm.runInContext(s, ctx);

// ---------- 1) 밤 판정 ----------
console.log('\n[1] 밤 판정(knhNightly_) — 실제 드라이브 목록');
const nBm = bm.files.filter(f => /\.md$/i.test(f.name)).length, nRep = repF.files.length, nCas = casF.files.length;
const paraF = repF.folders.find(f => f.name === '문단'), nPara = paraF ? paraF.files.filter(f => f.name[0] !== '_').length : 0;
console.log(`  드라이브: 지침 ${nBm} · 보고서 ${nRep} · 의뢰서 ${nCas} · 문단 ${nPara} · 사건 폴더 ${caseRows.length}(완료로 둔 것 ${withReports.slice(0, 3).length})`);
const t0 = Date.now();
const r = C('knhNightly_({})');
console.log(`  실행 ${Date.now() - t0}ms, ran=${r.ran}${r.reason ? ' 이유=' + r.reason : ''}`);
(r.warn || []).forEach(w => console.log('  ⚠ ' + w));
ok(r.ran, '판정이 돌았음');
ok(r.files.length === nBm + nRep + nCas + nPara, `판정 파일 수 ${r.files.length} = 드라이브 파일 수 ${nBm + nRep + nCas + nPara}`);
console.log('  합계:', JSON.stringify(r.totals));
const by = s => r.files.filter(f => f.status === s);
for (const s of ['수정 필요', '폐기 후보']) {
  console.log(`  — ${s} ${by(s).length}개` + (s === '수정 필요' ? `(먼저 고칠 것 ${r.totals.급함}, [확인 필요]만 ${r.totals.보완만} — [확인 필요]만인 것은 생략)` : ''));
  by(s).filter(f => f.priority !== 1).forEach(f => console.log(`     ${f.kind}/${f.name}: ` + f.reasons.filter(x => x.type !== '참고').map(x => x.why).join(' | ').slice(0, 220)));
}
// 법령 개정 — 시행 예정 조문을 인용한 지침이 실제로 잡히는지
const lawHits = r.files.filter(f => f.reasons.some(x => /법령 개정/.test(x.why)));
console.log(`  법령 개정 누적 ${r.lawChanges.length}개 조문 → 인용한 파일 ${lawHits.length}개: ` + lawHits.map(f => f.name).slice(0, 8).join(', '));
const cites89 = bm.files.filter(f => /소득세법\s*§\s*89(?![의\d])|소득세법\s*제\s*89\s*조(?!의)/.test(f.text) && !/2027\s*[.\-년]\s*0?9\s*[.\-월]\s*0?9(?!\d)/.test(f.text)).map(f => f.name);
ok(r.lawChanges.some(c => c.key === '소득세법' && c.jo === '89') && cites89.length > 0 && cites89.every(n => lawHits.some(h => h.name === n)), `소득세법 §89(2027-09-09 시행 예정)를 인용하고 그 시행일을 아직 안 적은 지침 ${cites89.length}개가 모두 "개정 반영 필요"로 잡힘`);
// 의뢰서 — 실제로 안 쓰이는 것
const unreach = r.files.filter(f => f.kind === '의뢰서' && f.reasons.some(x => /자동으로 들어가는 업무가 없음/.test(x.why))).map(f => f.name);
console.log('  새 사건에 자동으로 안 들어가는 의뢰서: ' + unreach.join(', '));
ok(unreach.includes('의뢰서_불복.md') && unreach.includes('의뢰서_양도상담.md'), '의뢰서_불복(세부유형 템플릿이 모두 있음)·의뢰서_양도상담(상담은 폴더 없음)이 폐기 후보');
const hasYJ = casF.files.some(f => f.name === '의뢰서_양도자문.md');
ok(hasYJ ? unreach.includes('의뢰서_양도.md') : !unreach.includes('의뢰서_양도.md'), hasYJ ? '의뢰서_양도자문이 생겨 의뢰서_양도는 어느 업무에도 안 쓰임 → 폐기 후보' : '의뢰서_양도는 양도 자문에 쓰여 폐기 후보 아님');

// ---------- 2) 현황판 ----------
console.log('\n[2] 업무별 보유 현황');
r.coverage.forEach(c => console.log(`  ${c.업무.padEnd(8)} 사건 ${String(c.사건수).padStart(3)} | 지침 ${String(c.지침.length).padStart(2)}(핵심 ${c.핵심지침.length}) | 의뢰서 ${c.의뢰서 || '-'} | 보고서 ${c.보고서.join(',') || '-'} | 정비 ${c.마지막정비 || '-'} | ${c.상태 || ''} | 빈칸: ${c.빈칸.join(' · ') || '없음'}`));
const sumCases = r.coverage.reduce((s, c) => s + c.사건수, 0);
ok(sumCases === caseRows.length, `현황판 사건 수 합 ${sumCases} = 사건 폴더 ${caseRows.length}`);
const yd = r.coverage.find(c => c.업무 === '양도 신고');
ok(yd && yd.지침.length === bm.files.filter(f => /^양도_/.test(f.name)).length, `양도 신고 관련 지침 ${yd && yd.지침.length}개 = 업무관리자 "양도_" 파일 수`);
ok(r.coverage.find(c => c.업무 === '사업 신고').빈칸.includes('지침'), '사업 신고: 지침 없음 → 빈칸');
console.log('  다음 작성 대상: ' + r.newNeeded.slice(0, 8).map(n => n.업무 + '(' + n.빈칸.join('/') + ')').join(' · '));

// ---------- 3) 재료 ----------
console.log('\n[3] 재료');
const mat = r.material;
console.log(`  완료 사건 재료 ${mat.cases.length}건, 문서 ${mat.cases.reduce((s, c) => s + c.문서.length, 0)}개, 템플릿 대비 크게 고친 문서 ${mat.cases.reduce((s, c) => s + c.문서.filter(d => d.크게고침).length, 0)}개`);
const leak = JSON.stringify(mat.cases);
const leaked = [...new Set(caseNames.filter(n => n && n.length >= 2 && !/^[ㅇ○]+$/.test(n)))].filter(n => leak.includes(n));
ok(leaked.length === 0, `재료에 고객 이름이 남지 않음(남은 이름 ${leaked.length}개)`);
ok(!/\d{5,}|\d{1,3}(,\d{3})+/.test(leak), '재료에 금액·긴 숫자가 남지 않음');
console.log(`  반복 유료 질문 중 맞는 지침 없는 것 ${mat.paidGaps.length}건`);
const fakeRrn = ['800101', '1234567'].join('-'); // 실명 검사(check-names)에 걸리지 않게 이어 붙임
ok(C(`knhMask_('홍길동 씨 강남구 테헤란로 123-4 아파트 1,230,000,000원 ${fakeRrn}', ['홍길동'])`) === '○○ 씨 강남구 (주소) 아파트 #원 ######-#######', '가리기 규칙(이름·주소·금액·주민번호)');

// ---------- 4) 제안 흐름(📥 동기화 → 대기 → 채택·반려·폐기) ----------
console.log('\n[4] 제안 흐름');
const tgt = bm.files.find(f => f.name === '부과제척기간.md') || bm.files[0];
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('base64');
const sha = 'abc1234def';
const base = `https://raw.githubusercontent.com/test/repo/${sha}/gs-backend/knowhow/`;
fetchMap[base + '_index.txt'] = ['# 시험',
  ['K-20261020-1', '지침', '신규', '사업_계산구조_기본흐름', '지침/사업_계산구조_기본흐름.md', '-', '사업 신고 업무에 이끄는 지침이 없음'].join('\t'),
  ['K-20261020-2', '지침', '수정', tgt.name, '지침/' + tgt.name, md5(tgt.text), '시험 수정'].join('\t'),
  ['K-20261020-3', '의뢰서', '폐기', '의뢰서_불복.md', '-', md5(casF.files.find(f => f.name === '의뢰서_불복.md').text), '세부유형 템플릿이 모두 있어 쓰이지 않음'].join('\t'),
  ['K-20261020-4', '보고서', '신규', '_잘못된이름', 'x.md', '-', '형식 오류 시험'].join('\t')].join('\n');
fetchMap[base + encodeURIComponent('지침') + '/' + encodeURIComponent('사업_계산구조_기본흐름.md')] = '# 사업소득 신고 — 계산 구조와 순서\n\n> 상태: 초안(세무사님 검토 전)\n\n## 1. 언제 쓰는가\n- 시험 초안 본문입니다. 시험 초안 본문입니다. 시험 초안 본문입니다.\n';
fetchMap[base + encodeURIComponent('지침') + '/' + encodeURIComponent(tgt.name)] = tgt.text + '\n\n## 시험으로 더한 절\n- 한 줄\n';
// 사이드바 AI가 직접 넣은 제안(원장에 없음)
const inbox = bm.folders.find(f => f.name === '_제안함') || bm.createFolder('_제안함');
inbox.createFile('양도_시험제안.md', '<!-- AI가 2026-10-20에 제안한 업무관리자 초안입니다. 검토 후 … -->\n\n# 양도 시험 — 사이드바 제안\n\n본문 본문 본문 본문 본문 본문 본문 본문 본문 본문 본문 본문 본문 본문 본문 본문 본문 본문.\n');
const sync = C(`knhSyncFromGithub_('${sha}')`);
console.log('  📥 동기화:', JSON.stringify(sync));
ok(sync.넣음.length === 3 && sync.오류.length === 1, '제안 3건 넣음, 형식 오류 1건 걸러냄');
const st = C("knhDispatch_({ action: 'knh_status' })");
ok(st.pending.length === 4, `제안 대기 ${st.pending.length}건(루틴 3 + 사이드바 1)`);
const sum = C("knhDispatch_({ action: 'knh_summary' })");
ok(sum.pending === 4, '대시보드 한 줄: 대기 4건');
const d2 = C("knhDispatch_({ action: 'knh_proposal', id: 'K-20261020-2' })").proposal;
ok(d2.curExists && !d2.baseChanged && d2.propText.length > d2.curText.length, '수정 제안: 지금 파일·초안 둘 다 받음, 기준본과 같음');
ok(C("knhDispatch_({ action: 'knh_decide', id: 'K-20261020-2', decision: 'reject' })").error, '반려는 사유 없으면 막힘');
const before = tgt.text;
const a2 = C("knhDispatch_({ action: 'knh_decide', id: 'K-20261020-2', decision: 'adopt' })");
ok(a2.success && /시험으로 더한 절/.test(tgt.text), '수정 채택 → 지침 내용이 초안으로 바뀜');
const prev = bm.folders.find(f => f.name === '_이전판');
ok(prev && prev.files.find(f => f.name === tgt.name).text === before, '이전 판이 「_이전판」에 보관됨');
const a1 = C("knhDispatch_({ action: 'knh_decide', id: 'K-20261020-1', decision: 'adopt' })");
ok(a1.success && bm.files.some(f => f.name === '사업_계산구조_기본흐름.md'), '신규 채택 → 업무관리자 맨 위에 새 지침');
const a3 = C("knhDispatch_({ action: 'knh_decide', id: 'K-20261020-3', decision: 'retire' })");
const bin = casF.folders.find(f => f.name === '_폐기');
ok(a3.success && !casF.files.some(f => f.name === '의뢰서_불복.md') && bin && bin.files.some(f => f.name === '의뢰서_불복.md'), '폐기 → 지우지 않고 의뢰서템플릿/_폐기로 옮김');
const dId = st.pending.find(p => p.출처 === '드라이브').id;
const a4 = C(`knhDispatch_({ action: 'knh_decide', id: '${dId}', decision: 'reject', reason: '시험 반려 — 이미 있는 지침과 겹침' })`);
ok(a4.success && inbox.folders.find(f => f.name === '_처리됨').files.some(f => f.name === '양도_시험제안.md'), '사이드바 제안 반려 → _제안함/_처리됨으로 옮김');
ok(C("knhDispatch_({ action: 'knh_status' })").pending.length === 0, '대기 0건');
const again = C(`knhSyncFromGithub_('${sha}')`);
ok(again.넣음.length === 0 && again.건너뜀 === 3, '같은 PR을 다시 반영해도 이미 처리한 제안은 다시 안 들어옴');

// ---------- 5) 주간 루틴이 읽는 보고서 ----------
console.log('\n[5] 개선 후보 보고서(knhForReport_)');
const rep = C('knhForReport_()');
const size = JSON.stringify(rep.data).length;
console.log('  머리줄: ' + rep.head.join(' / '));
console.log(`  크기 ${Math.round(size / 1024)}KB, 지금원문 ${Object.keys(rep.data.지금원문).length}개, 최근결정 ${rep.data.최근결정.length}건(반려 사유 포함)`);
ok(rep.data.최근결정.some(d => d.결정 === '반려' && d.사유), '반려 사유가 다음 루틴 보고서에 실림');
ok(size < 600000, '보고서 크기 600KB 미만');

// ---------- 6) 다시 판정 — 채택한 지침이 현황판에 반영 ----------
const r2 = C('knhNightly_({})');
ok(r2.coverage.find(c => c.업무 === '사업 신고').핵심지침.includes('사업_계산구조_기본흐름'), '새 지침 채택 뒤 사업 신고 "이끄는 지침" 빈칸이 채워짐');
// 쓰인 횟수
C("knhCountUse_('지침', '부과제척기간'); knhCountUse_('지침', '부과제척기간.md')");
ok(C('knhUses_()').uses['지침/부과제척기간'].n === 2, '읽힌 횟수 셈(확장자 있어도 같은 칸)');

// Code.js 갈고리
const code = fs.readFileSync(path.join(SRC, 'Code.js'), 'utf8');
ok(['knhNightly_()', 'knhForReport_()', 'knhSyncFromGithub_(head.sha)', "knhCountUse_('지침'", "knhCountUse_('보고서'", "knhCountUse_('의뢰서'", 'knhDispatch_(body)'].every(s => code.includes(s)), 'Code.js 갈고리 7곳');
console.log(`\n${fails ? '✗ 실패 ' + fails + '개' : '✓ 모두 통과'}`);
if (args.includes('--json')) fs.writeFileSync(path.join(require('os').tmpdir(), 'knowhow-check.json'), JSON.stringify(r, null, 1));
process.exit(fails ? 1 : 0);
