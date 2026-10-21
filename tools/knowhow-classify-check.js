#!/usr/bin/env node
// [2026.10.22] 표시 분류 오류 검사(KnowHow.js knhClsCheck_) 시험 — 서버와 같은 함수를 node에서 돌린다.
// 로컬 구글 드라이브(J:)의 확인조치사항·절세 아이템·(이름이 적힌) 지침을 **읽기만** 한다(하나씩, 쓰기 없음).
//  ① 글자 시험(드라이브 없이): 번호 찾기·낱말·문턱
//  ② 실제 드라이브 모의: 후보 수·예
// 사용: node tools/knowhow-classify-check.js [--drive "J:/내 드라이브"] [--json]
const fs = require('fs'), path = require('path'), vm = require('vm');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const DRIVE = opt('drive') || 'J:/내 드라이브';
const NETAX = path.join(DRIVE, '0 NETAX'), BM = path.join(NETAX, '업무관리자'), TAX = path.join(BM, '절세');
const SRC = path.join(__dirname, '..', 'gs-backend');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(SRC, 'Followup.js'), 'utf8'), ctx, { filename: 'Followup.js' });
vm.runInContext(fs.readFileSync(path.join(SRC, 'KnowHow.js'), 'utf8'), ctx, { filename: 'KnowHow.js' });
const C = s => vm.runInContext(s, ctx);
const check = input => { ctx.__in = input; return C('knhClsCheck_(__in)'); };

console.log('① 글자 시험');
const ptr = C('knhClsPointers_("양도 20·22에 나란히, 증여 33 사해행위 취소, 양도 84호: 누진세율, 상속 5억 공제, 공통 22 상속과 법인전환", [])').map(p => p.key);
ok(JSON.stringify(ptr) === JSON.stringify(['양도 20', '양도 22', '증여 33', '공통 22']), '번호 찾기 — "양도 20·22"는 둘, "양도 84호"·"상속 5억"은 번호 아님: ' + ptr.join(', '));
const seg = C('knhClsPointers_("증여 33 사해행위 취소, 양도 65 경매 체납관리비", [])');
ok(seg.length === 2 && /사해행위/.test(seg[0].seg) && !/체납관리비/.test(seg[0].seg) && /체납관리비/.test(seg[1].seg), '한 항목이 둘을 가리키면 글토막을 나눔');
const fake = (key, title, lines) => ({ key, kind: '절세', name: key.split(' ')[1] + ' ' + title + '.md', id: key, text: lines.join('\n') });
const filler = [];
for (let i = 1; i <= 30; i++) filler.push(fake('양도 ' + (40 + i), '아무 아이템 ' + i, ['일반 내용 세율 공제 [확인 필요] 비과세 양도']));
const t1 = check({ followText: '## 💡 판단 대기\n- [ ] **쥐라기 공원 감면율 갈림** — 양도 15 쥐라기 공원 감면율이 엇갈림\n- [x] **끝난 것** — 양도 16 쥐라기\n',
  files: filler.concat([fake('양도 15', '쥐라기 아이템', ['쥐라기 공원 감면율은 [확인 필요]', '쥐라기만 [확인 필요]', '쥐라기 공원 감면율 [판단 대기 — 확인조치사항 💡 절]']),
    fake('양도 16', '다른 아이템', ['쥐라기 공원 감면율 [확인 필요]'])]) });
ok(t1.후보.length === 1 && t1.후보[0].파일키 === '양도 15' && t1.후보[0].줄들.length === 1 && t1.후보[0].줄들[0].줄 === 1,
  '가리킨 파일의 [확인 필요] 줄 중 드문 낱말 둘 이상만(판단 대기로 바꾼 줄·낱말 하나·끝난 항목은 빠짐)');
ok(!t1.후보.some(c => c.줄들.some(r => /비과세 양도/.test(r.글))), '흔한 낱말(세율·공제·비과세)만 맞는 줄은 안 잡음');
const t2 = check({ followText: '## 💡 판단 대기\n- [ ] **쥐라기 공원 감면율 갈림 표석** — 엔진과 다름\n', files: filler.concat([fake('양도 15', '쥐라기 공원 이야기', ['쥐라기 공원 [확인 필요]', '감면율 표석 [확인 필요]']), fake('양도 17', '엉뚱한 제목', ['쥐라기 공원 [확인 필요]', '쥐라기 공원 감면율 [확인 필요]'])]) });
const k2 = t2.후보.map(c => c.파일키 + ':' + c.줄들.map(r => r.줄).join('/')).sort().join(' ');
ok(k2 === '양도 15:2 양도 17:2', '파일 안 적힌 항목 — 제목이 그 쟁점인 파일은 낱말 둘(제목 낱말만 맞는 줄은 뺌), 그 밖은 셋: ' + k2);

console.log('② 실제 드라이브 모의(읽기만)');
if (!fs.existsSync(TAX)) { console.log('  (드라이브 없음 — 건너뜀: ' + TAX + ')'); process.exit(fails ? 1 : 0); }
const ffName = ['_확인조치사항.md', '확인조치사항.md'].find(n => fs.existsSync(path.join(NETAX, n)));
const followText = fs.readFileSync(path.join(NETAX, ffName), 'utf8').replace(/^\uFEFF/, '');
const files = [];
const addDir = (dir, semok) => {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (!C('knhIdxIsItem_(' + JSON.stringify(n) + ')') || fs.statSync(p).isDirectory()) continue;
    const num = (n.match(/^(\d{1,3})[\s._-]/) || [])[1];
    files.push({ key: num ? semok + ' ' + ('0' + (+num)).slice(-2) : semok + '/' + n, kind: '절세', name: n, id: path.relative(TAX, p), text: fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '') });
  }
};
addDir(TAX, '공통');
for (const d of fs.readdirSync(TAX)) { const p = path.join(TAX, d); if (d.charAt(0) !== '_' && fs.statSync(p).isDirectory()) addDir(p, d); }
for (const n of fs.readdirSync(BM)) {
  const p = path.join(BM, n);
  if (!/\.(md|txt)$/i.test(n) || n.charAt(0) === '_' || fs.statSync(p).isDirectory() || followText.indexOf(n.replace(/\.(md|txt)$/i, '')) === -1) continue;
  files.push({ key: '지침/' + n, kind: '지침', name: n, id: n, text: fs.readFileSync(p, 'utf8') });
}
const r = check({ followText, files });
console.log('  확인조치사항 ' + ffName + ' · 미결 ' + r.미결 + ' · 읽은 파일 ' + r.파일 + ' · 파일 안 적은 항목 ' + r.파일안적은항목 + ' → 후보 ' + r.후보.length + '곳(줄 ' + r.후보줄 + ')');
r.후보.forEach(c => {
  console.log('  ■ ' + c.항목 + '  ↔  ' + c.파일키 + ' (' + c.찾은방법 + ')');
  console.log('     쟁점 낱말: ' + c.쟁점낱말.join(', '));
  c.줄들.forEach(x => console.log('     ' + x.줄 + '줄 ' + x.표시 + ' [' + x.낱말.join(',') + '] ' + x.글.slice(0, 110)));
});
const has = (k, re) => r.후보.some(c => c.파일키 === k && c.줄들.some(x => re.test(x.글)));
ok(has('양도 15', /비거주자|출국|표2/), '실제 사례: 양도 15 해외 이주 [확인 필요] ↔ 비거주자 출국 2년 예외 장특공');
ok(has('공통 25', /출국/), '실제 사례: 공통 25 지도의 출국 2년 예외 줄');
ok(has('증여 33', /사해행위/), '실제 사례: 증여 33 사해행위 ↔ 해석이 엇갈리는 두 건');
console.log('③ 밤 흐름(knhClsNightly_) — 메모리 가짜 드라이브(같은 실제 파일, 쓰기는 메모리에만)');
{
  const it = a => { let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; };
  const mf = (name, text) => ({ getName: () => name, getId: () => 'id:' + name, isTrashed: () => false, getBlob: () => ({ getDataAsString: () => text }) });
  const mdir = (name, fs_, ds) => ({ getName: () => name, getId: () => 'd:' + name, isTrashed: () => false, getFiles: () => it(fs_), getFolders: () => it(ds || []) });
  const subs = {};
  files.filter(f => f.kind === '절세').forEach(f => { const s = f.key.split(/[ /]/)[0]; (subs[s] = subs[s] || []).push(mf(f.name, f.text)); });
  const taxRoot = mdir('절세', [], Object.keys(subs).map(s => mdir(s, subs[s])));
  const guides = files.filter(f => f.kind === '지침').map(f => mf(f.name, f.text));
  const written = {};
  ctx.__mock = { followupFile_: () => mf(ffName, followText), knhIdxRoots_: () => [{ key: '절세', folder: taxRoot, subs: true }], knhFolder_: k => k === '지침' ? mdir('업무관리자', guides) : null,
    knhWriteJson_: (n, o) => { written[n] = o; }, knhNow_: () => '2026-10-22 00:00' };
  C('followupFile_ = __mock.followupFile_; knhIdxRoots_ = __mock.knhIdxRoots_; knhFolder_ = __mock.knhFolder_; knhWriteJson_ = __mock.knhWriteJson_; knhNow_ = __mock.knhNow_;');
  const n = C('knhClsNightly_({ budgetMs: 20000 })');
  ok(n.ran && n.후보.length === r.후보.length && written['분류점검_최신.json'] === n, '밤 흐름 결과 = 순수 함수 결과, 결과 파일 하나만 씀(후보 ' + n.후보.length + ', 경고 ' + n.warn.length + ')');
  const n0 = C('knhClsNightly_({ budgetMs: -1 })');
  ok(n0.ran && n0.warn.length === 1 && /못 읽음/.test(n0.warn[0]), '시간이 모자라 못 읽은 파일은 말없이 빠지지 않고 경고로 남김');
  ctx.__mock.followupFile_ = () => null; C('followupFile_ = __mock.followupFile_;');
  const n1 = C('knhClsNightly_({})');
  ok(!n1.ran && /확인조치사항/.test(n1.reason), '확인조치사항이 없으면 "검사 안 됨"과 이유를 남김');
}
if (args.includes('--json')) fs.writeFileSync(path.join(require('os').tmpdir(), 'knowhow-classify-check.json'), JSON.stringify(r, null, 1));
console.log(fails ? '✗ 실패 ' + fails : '✓ 모두 통과');
process.exit(fails ? 1 : 0);
