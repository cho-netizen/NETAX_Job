// [2026-11-27] 세무조사 위임장·위임해지(gs-backend/Poa.js) 단독 시험 — 네트워크·구글 없이 순수 함수만.
//  쓰는 법: node tools/poa-check.js [사전통지서 글자 파일 …]
//   · 글자 파일을 주면 사전통지서 읽기(poaNoticeParse_) 결과를 보인다(실제 사건 글자로 확인할 때).
//   · 늘 도는 시험: 견본 글(별지 제54호 모양) 읽기 · 주민번호 가리기 · md 만들기(⚠ 칸·해지 모양).
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'gs-backend', 'Poa.js'), 'utf8');
const ctx = { Utilities: { formatDate: function (d) { return '2026-11-27'; } } };
vm.createContext(ctx); vm.runInContext(src, ctx);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('✗ ' + m); } else console.log('✓ ' + m); };

const sample = [
  '■ 국세기본법 시행규칙 [별지 제54호 서식]', '가나세무서', '수신자 홍길동', '제목 세무조사 사전 통지',
  '조사대상 세목 증여세', '조사 기간 2026 년 03 월 02 일 ~ 2026 년 03 월 20 일',
  '이 통지에 대한 문의 사항은 재산법인세과 담당자 김철수(전화: 02-123-4567)에게 연락하시기 바라며',
  '가나세무서장'
].join('\n');
let p = ctx.poaNoticeParse_(sample);
ok(p.office === '가나세무서', '관서 ' + p.office);
ok(p.start === '2026-03-02' && p.end === '2026-03-20', '조사기간(통지서 칸) ' + p.start + '~' + p.end);
ok(p.tax === '증여세', '세목(통지서 앞부분) ' + p.tax);
ok(p.dept === '재산법인세과', '담당 과 ' + p.dept);
ok(p.tel === '02-123-4567', '전화 ' + p.tel);
ok(p.taxpayer === '홍길동', '수신자 ' + p.taxpayer);

const withPoa = sample + '\n상기 세무대리인에게 가나세무서에서 2026.04.01. 부터 2026.04.30.까지 실시하는 양도소득세조사와 관련하여\n※ … 이 위임장을 가나세무서 조사과 조사2팀 이몽룡에게';
p = ctx.poaNoticeParse_(withPoa);
ok(p.start === '2026-04-01' && p.end === '2026-04-30', '조사기간(같이 온 위임장 문장 우선) ' + p.start + '~' + p.end);
ok(p.tax === '양도소득세', '세목(위임장 문장 우선) ' + p.tax);
ok(p.dept === '조사과 조사2팀', '과·반(위임장 안내 우선) ' + p.dept);

ok(ctx.poaMaskRrn_('5902072123456') === '590207-2******', '주민번호 가림');
ok(ctx.poaMaskRrn_('') === '', '주민번호 없음 → 빈칸');

const d = { ag: { name: '', phone: '', birth: '', bizNo: '112-36-31504', addr: '', firm: '', qual: '세무사' }, pr: { addr: '주소', firm: '', no: '590207-2******', name: '홍길동' }, office: '가나세무서', tax: '증여세', start: '2026-03-02', end: '2026-03-20', dept: '재산법인세과', tel: '02-123-4567', date: '2026-11-27', src: '세무조사 사전통지.pdf' };
let md = ctx.poaBuildMd_(false, d);
ok(/^<!-- 서식: 조사사무처리규정 별지 제13호 위임장 -->/.test(md), 'md 머리(위임장)');
ok(/- 조사기간: 2026\. 3\. 2\. ~ 2026\. 3\. 20\./.test(md), 'md 조사기간');
ok(/- 성명: ⚠\[확인필요: 세무대리인 성명/.test(md), '빈 설정 칸은 ⚠');
ok(/## 제출처/.test(md), '위임장은 제출처 칸 있음');
md = ctx.poaBuildMd_(true, d);
ok(/별지 제13-1호 위임해지/.test(md) && /# 위임해지/.test(md) && /- 해지일: 2026\. 11\. 27\./.test(md), 'md 위임해지 모양');
ok(!/## 제출처/.test(md), '위임해지는 제출처 칸 없음(서식에 없음)');

// ── 끝까지 시험: 진짜 장부 코드(CaseLedger.js) + Poa.js, 드라이브·시트·설정만 흉내 ──
//  만들기 → 상태 「위임 중」·할 일 → 같은 이름 다시 만들기(덮어쓰지 않음) → 세부명칭으로 따로 → 제출했음 → 해지(같은 조사 이어 씀) → 해지 제출 → 새 위임(앞 해지 기록 거둠)
(function () {
  const files = {}; let fid = 0; // 「보고서」 폴더 흉내
  const mkIter = function (arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const folder = {
    getId: () => 'FOLDER-보고서',
    getFilesByName: (n) => mkIter(Object.values(files).filter(f => f.name === n)),
    createFile: (blob) => { const f = { id: 'F' + (++fid), name: blob.name, content: blob.content, getId() { return this.id; }, setContent(c) { this.content = c; } }; files[f.id] = f; return f; }
  };
  const ledgerStore = {};
  const noticeText = ['■ 국세기본법 시행규칙 [별지 제54호 서식]', '다라세무서', '수신자 갑순이', '조사대상 세목 상속세', '조사 기간 2026 년 05 월 04 일 ~ 2026 년 05 월 29 일',
    '재산법인세과 담당자 박담당(전화: 031-000-1111)에게', '다라세무서장'].join('\n');
  const S = {
    console: console, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp,
    Utilities: { formatDate: () => '2026-11-27', newBlob: (content, mime, name) => ({ content, mime, name }) },
    withLock_: (ms, fn) => fn(), caseProcNow_: () => '2026-11-27 15:00',
    akReadCase_: (id) => id === 'C1' ? { id: 'C1', 고객명: '갑순이', 납세자: '갑순이', 고객ID: 'K1', 폴더ID: 'X', 사건명: '갑순이_상속_조사', 업무유형: '조사' } : null,
    caseProcNexAllFiles_: () => [{ id: 'N1', name: '세무조사 사전통지_갑순이.pdf', dir: '받은서류' }, { id: 'N2', name: '결과통지.pdf', dir: '' }],
    tc_docText_: (f) => f.id === 'N1' ? noticeText : '',
    CLIENT_HEADERS: ['id', '성명', '전화번호', '구분', '사업자번호', '메모', '등록일', '수정일', '추가연락처', '주소', '주민등록번호암호화'],
    client_getSheets_: () => ({ clients: { getDataRange: () => ({ getValues: () => [S.CLIENT_HEADERS, ['K1', '갑순이', '', '개인', '', '', '', '', '', '경기도 어딘가 1', 'ENC']] }) } }),
    client_colMap_: (h, want) => { const o = {}; want.forEach(k => { o[k] = h.indexOf(k); }); return o; },
    client_decryptRRN_: (e) => e === 'ENC' ? '6001012345678' : '',
    getTaxAgentSettings_: () => ({ taxAgentName: '홍길동', taxAgentPhone: '02-000-0000', taxAgentBirth: '19600101', taxAgentBizNo: '112-36-31504', taxAgentAddr: '서울 어딘가 2', taxAgentFirm: '이음세무컨설팅', taxAgentQual: '세무사' }),
    reportSaveTarget_: (c, spec) => { const k = { '위임장': '위임장', '위임해지': '위임해지' }[spec.kind]; return { ok: true, folder: folder, name: k + (spec.detail ? '_' + spec.detail : '') + '.md' }; }
  };
  vm.createContext(S);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gs-backend', 'CaseLedger.js'), 'utf8'), S);
  vm.runInContext(src, S);
  // 장부 파일·옛 짝 파일 흉내(진짜 함수를 덮음)
  S.ledgerFile_ = (caseId, create) => { if (!ledgerStore[caseId] && !create) return null; ledgerStore[caseId] = ledgerStore[caseId] || '{}'; return { getBlob: () => ({ getDataAsString: () => ledgerStore[caseId] }), setContent: (s) => { ledgerStore[caseId] = s; } }; };
  S.ledgerKbOldFile_ = () => null;

  let r = S.poaStatus_('C1', true);
  ok(r.ok && r.상태 === '없음', '처음 상태 없음');
  r = S.poaMake_('C1', { by: '세무사님' });
  ok(r.ok && r.name === '위임장.md', '위임장 만듦 ' + (r.name || r.error));
  const md1 = files[r.fileId] && files[r.fileId].content || '';
  ok(/- 조사관서: 다라세무서/.test(md1) && /- 조사기간: 2026\. 5\. 4\. ~ 2026\. 5\. 29\./.test(md1) && /- 조사세목: 상속세/.test(md1), '사전통지서에서 관서·기간·세목');
  ok(/- 조사과: 재산법인세과/.test(md1) && /- 전화: 031-000-1111/.test(md1), '제출처(과·전화)');
  ok(/- 사업자\(주민\)등록번호: 600101-2?\d?\*{6}|- 사업자\(주민\)등록번호: 600101-1\*{6}/.test(md1), '위임자 주민번호 가림 ' + (md1.match(/등록번호: .*/) || [''])[0]);
  ok(/\| 1 \| 이음세무컨설팅 \| 대표 \| 홍길동 \| 1960\.01\.01 \| 세무사 \|/.test(md1), '명단 한 줄(설정 값)');
  ok(r.확인할칸.length === 0, '⚠ 칸 없음(값이 다 있음) ' + r.확인할칸.join('/'));
  r = S.poaStatus_('C1', true);
  ok(r.상태 === '위임 중' && r.할일 === '위임장 서명·제출' && r.조사시작일 === '2026-05-04', '상태 위임 중·할 일 서명·제출');
  r = S.poaMake_('C1', {});
  ok(!r.ok && r.exists, '같은 이름 다시 만들면 덮어쓰지 않음');
  r = S.poaMake_('C1', { detail: '상속세' });
  ok(r.ok && r.name === '위임장_상속세.md', '세부명칭으로 따로 ' + r.name);
  r = S.poaSubmitted_('C1', {});
  ok(r.ok && r.상태.위임장제출일 === '2026-11-27' && !r.상태.할일, '제출했음 → 할 일 닫힘');
  S.tc_docText_ = () => ''; // 해지는 사전통지서 없이도 장부로
  r = S.poaMake_('C1', { revoke: true });
  const md2 = r.ok ? files[r.fileId].content : '';
  ok(r.ok && r.name === '위임해지.md' && /- 조사관서: 다라세무서/.test(md2) && /- 해지일: 2026\. 11\. 27\./.test(md2) && !/## 제출처/.test(md2), '위임해지 — 장부의 같은 조사 이어 씀');
  r = S.poaStatus_('C1', true);
  ok(r.상태 === '해지됨' && r.할일 === '위임해지 서명·제출', '상태 해지됨·할 일');
  r = S.poaSubmitted_('C1', { revoke: true });
  ok(r.ok && !r.상태.할일, '위임해지 제출했음');
  r = S.poaNexTool_('C1', { do: 'status' });
  ok(r.상태 === '해지됨', '넥스 도구 status');
  delete files['F1'];
  r = S.poaMake_('C1', { by: '넥스' }); // 새 위임 — 사전통지서 글자 없음 → ⚠
  ok(r.ok && r.확인할칸.length >= 3, '새 위임(서류 없음) → ⚠ 칸 ' + r.확인할칸.length + '곳');
  r = S.poaStatus_('C1', true);
  ok(r.상태 === '위임 중' && !r.해지일 && !r.위임장제출일, '새 위임이면 앞 해지·제출 기록 거둠');
  const L = JSON.parse(ledgerStore.C1);
  ok(L.rows['poa.submitDate'] === undefined && L.rows['poa.grantDate'] && L.rows['poa.grantDate'].src.kind === '규칙', '장부 줄 모양(GAS 규칙)');
})();

process.argv.slice(2).forEach(function (f) {
  const r = ctx.poaNoticeParse_(fs.readFileSync(f, 'utf8'));
  console.log('— ' + path.basename(f) + ': ' + JSON.stringify(r));
});
console.log(fail ? '\n실패 ' + fail : '\n모두 통과');
process.exit(fail ? 1 : 0);
