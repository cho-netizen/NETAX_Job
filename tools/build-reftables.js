#!/usr/bin/env node
// [2026.10.19 조견표 체계] 조견표·서식 칸 지도 자료(reftables/*.json)를 법령정보 화면(gs-backend/manage/lawsearch.html)에 끼워 넣는다.
//  - reftables/<1부-NN|2부-NN>.json  → LSI_REF_TABLES_ (번호 순)
//  - reftables/서식_*.json            → LSI_FORM_MAPS_ (키 = "서식번호" 글자 그대로 — 세액인쇄 PRINT_REGISTRY_의 formNo와 같아야 서식 탭에 붙는다)
//  자료 형식: reftables/README.md. 출처는 공식 원문만, 세무사님 확인 전 "상태"는 "초안"(계산·판정에 쓰지 않음).
//  사용: node tools/build-reftables.js  → 그다음 node tools/build-app.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'reftables');
const PAGE = path.join(ROOT, 'gs-backend', 'manage', 'lawsearch.html');
const B = '/*@@REF_DATA_BEGIN@@*/', E = '/*@@REF_DATA_END@@*/';
// [2026.10.19 서버 용량] 서버(GAS)는 10MB 한도라 화면 자료(약 1MB)를 gs-backend/manage/lawsearch.html에 넣지 않는다.
//  lawsearch.html 자리 표시엔 빈 값만 두고, build-app.js가 app/index.html(job.netax.kr/app)을 만들 때 refBlock(collect())로 끼운다.
function collect() {
const tables = [], forms = {};
// [2026.10.19] '_'로 시작하는 파일은 조견표·칸 해설이 아님 — _서식목록.json = 서식 사전 전체 목록(LSI_FORM_CATALOG_)
const catFile = path.join(DIR, '_서식목록.json');
const catalog = fs.existsSync(catFile) ? JSON.parse(fs.readFileSync(catFile, 'utf8')) : { 서식: [] };
fs.readdirSync(DIR).filter((f) => /\.json$/.test(f) && !/^_/.test(f)).sort().forEach((f) => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (/^서식_/.test(f)) {
    if (!j.서식번호 || !Array.isArray(j.칸)) throw new Error(f + ': 서식번호·칸이 없습니다');
    forms[j.서식번호] = j;
  } else {
    if (!/^[12]부-\d+$/.test(j.번호 || '') || !Array.isArray(j.행)) throw new Error(f + ': 번호(1부-NN)·행이 없습니다');
    (j.행 || []).forEach((r, i) => { if (!r.출처 && !/확인 필요/.test(r.확인 || '')) throw new Error(f + ' 행 ' + (i + 1) + ': 출처 없는 행은 "확인 필요"여야 합니다'); });
    tables.push(j);
  }
});
tables.sort((a, b) => a.번호.localeCompare(b.번호, 'ko', { numeric: true }));
return { tables, forms, catalog };
}
// 화면 자료 묶음(BEGIN 자리 표시부터 END 바로 앞까지)
function refBlock(data) { return B + '\n  var LSI_FORM_MAPS_ = ' + JSON.stringify(data.forms) + ';\n  var LSI_REF_TABLES_ = ' + JSON.stringify(data.tables) + ';\n  var LSI_FORM_CATALOG_ = ' + JSON.stringify(data.catalog || { 서식: [] }) + ';\n  '; }
module.exports = { collect, refBlock, B, E };
if (require.main === module) {
const { tables, forms, catalog } = collect();
let s = fs.readFileSync(PAGE, 'utf8');
const i = s.indexOf(B), k = s.indexOf(E);
if (i < 0 || k < i) throw new Error('lawsearch.html에 자리 표시가 없습니다');
const block = refBlock({ tables: [], forms: {}, catalog: { 서식: [] } }); // 서버 사본은 빈 값(위 [서버 용량])
s = s.slice(0, i) + block + s.slice(k);
fs.writeFileSync(PAGE, s);

// [2026.10.19] 엔진(taxcalc-engine.html)에도 양도일별 기본세율(2부-01)·장특공 표1·표2(2부-03, 2020년 이전 표2)를 옮겨 적는다.
//  엔진은 window.__NX_REF_HISTORY_ON === true일 때만 쓴다(세무사님 확인 전 꺼짐). 2023 표는 엔진의 지금 표와 같아야 한다(다르면 멈춤).
const ENGINE = path.join(ROOT, 'gs-backend', 'manage', 'taxcalc-engine.html');
const EB = '/*@@REF_ENGINE_BEGIN@@*/', EE = '/*@@REF_ENGINE_END@@*/';
const t201 = tables.filter((t) => t.번호 === '2부-01')[0], t203 = tables.filter((t) => t.번호 === '2부-03')[0];
if (t201 && t203) {
  const br = t201.행.map((r) => ({ from: r.시작, to: r.끝 || null, brackets: r.값.구간.map((g) => ({ max: g.이하 == null ? 'INF' : g.이하, rate: g.세율, deduction: g.누진공제 })) }));
  const lt1 = t203.행.filter((r) => /^표1/.test(r.구분)).map((r) => ({ from: r.시작, to: r.끝 || null, rates: r.값 }));
  const lt2 = t203.행.filter((r) => /^표2 1세대1주택\(보유기간별\)$/.test(r.구분)).map((r) => ({ from: r.시작, to: r.끝 || null, rates: r.값 }));
  if (!br.length || !lt1.length || !lt2.length) throw new Error('2부-01·2부-03에서 엔진용 행을 못 읽었습니다');
  const last = br.filter((b) => b.from === '2023-01-01')[0];
  const cur = [[14000000, 0.06, 0], [50000000, 0.15, 1260000], [88000000, 0.24, 5760000], [150000000, 0.35, 15440000], [300000000, 0.38, 19940000], [500000000, 0.40, 25940000], [1000000000, 0.42, 35940000], ['INF', 0.45, 65940000]];
  if (!last || JSON.stringify(last.brackets.map((b) => [b.max, b.rate, b.deduction])) !== JSON.stringify(cur)) throw new Error('2부-01의 2023 표가 엔진 TRANSFER_TAX_BRACKETS와 다릅니다 — 확인 필요');
  const js = (o) => JSON.stringify(o).replace(/"INF"/g, 'Infinity');
  let e = fs.readFileSync(ENGINE, 'utf8');
  const i2 = e.indexOf(EB), k2 = e.indexOf(EE);
  if (i2 < 0 || k2 < i2) throw new Error('taxcalc-engine.html에 엔진 자리 표시가 없습니다');
  const nl = e.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  // 2부-04 고가주택 기준(행 값 "6억원 초과" 같은 글에서 금액) — 주택·조합원입주권
  const t204 = tables.filter((t) => t.번호 === '2부-04')[0];
  const hvRow = (r) => { const m = String(r.값).match(/(\d+)억원/); if (!m) throw new Error('2부-04 금액을 못 읽음: ' + r.값); return { from: r.시작, to: r.끝 || null, amount: Number(m[1]) * 100000000 }; };
  const hv = { house: t204 ? t204.행.filter((r) => /^주택/.test(r.구분)).map(hvRow) : [], right: t204 ? t204.행.filter((r) => /^조합원입주권/.test(r.구분)).map(hvRow) : [] };
  if (t204 && (hv.house.filter((x) => x.from === '2021-12-08' && x.amount === 1200000000).length !== 1)) throw new Error('2부-04의 2021-12-08 이후 12억 행이 엔진 지금 값과 다릅니다');
  // [2026.10.19 조견표 2부-02] 단기·분양권 세율, 다주택 중과 가산율, 비사업용토지 가산 — 행 값의 %는 소수로, "기본세율"은 null(누진)
  const t202 = tables.filter((t) => t.번호 === '2부-02')[0];
  const pct = (v) => (v === '기본세율' ? null : (typeof v === 'number' ? Math.round(v * 100) / 10000 : (() => { throw new Error('2부-02 세율 값을 못 읽음: ' + v); })()));
  const srRows = (gu) => (t202 ? t202.행.filter((r) => r.구분 === gu) : []);
  const sr = {
    house: srRows('단기세율 주택·조합원입주권').map((r) => ({ from: r.시작, to: r.끝 || null, lt1: pct(r.값['1년미만']), lt2: pct(r.값['1년이상2년미만']), ge2: pct(r.값['2년이상']) })),
    other: srRows('단기세율 그 밖의 토지·건물·부동산권리').map((r) => ({ from: r.시작, to: r.끝 || null, lt1: pct(r.값['1년미만']), lt2: pct(r.값['1년이상2년미만']), ge2: pct(r.값['2년이상']) })),
    presale: srRows('분양권').map((r) => ({ from: r.시작, to: r.끝 || null, lt1: pct(r.값['1년미만']), lt2: pct(r.값['1년이상2년미만']), ge2: pct(r.값['2년이상']), adj: r.값.조정대상지역 == null ? null : pct(r.값.조정대상지역) })),
    multi: srRows('다주택 중과 가산율').map((r) => ({ from: r.시작, to: r.끝 || null, two: pct(r.값['2주택']), three: pct(r.값['3주택이상']) })),
    nonbiz: srRows('비사업용토지 가산').map((r) => ({ from: r.시작, to: r.끝 || null, add: /가산 없음/.test(String(r.값)) ? 0 : 0.1 }))
  };
  if (t202) {
    // 지금 값(2021-06-01 이후)이 엔진의 지금 세율과 같아야 한다 — 다르면 멈춤
    const cur = (rows) => rows.filter((x) => !x.to)[0] || {};
    const h = cur(sr.house), o = cur(sr.other), p = cur(sr.presale), m = cur(sr.multi), nb = cur(sr.nonbiz);
    if (!(h.lt1 === 0.7 && h.lt2 === 0.6 && h.ge2 === null && o.lt1 === 0.5 && o.lt2 === 0.4 && o.ge2 === null && p.lt1 === 0.7 && p.lt2 === 0.6 && p.ge2 === 0.6 && m.two === 0.2 && m.three === 0.3 && nb.add === 0.1))
      throw new Error('2부-02의 지금 세율 행이 엔진 지금 세율(주택 70/60, 기타 50/40, 분양권 70/60/60, 중과 +20/+30, 비사업용 +10)과 다릅니다 — 확인 필요');
  }
  // [2026.10.19 조견표 2부-10·11·12·15] 상속·증여 연혁 — 신고세액공제율, 증여재산공제, 혼인·출산 시작일, 인적공제, 동거주택, 가업·영농 한도, 세대생략 40%
  const tb = (no) => tables.filter((t) => t.번호 === no)[0];
  const rowsOf = (no, gu) => (tb(no) ? tb(no).행.filter((r) => r.구분 === gu) : []);
  const P = (r) => ({ from: r.시작, to: r.끝 || null });
  const gi = {
    credit: rowsOf('2부-10', '신고세액공제율').map((r) => Object.assign(P(r), { rate: Math.round(r.값 * 100) / 10000 })),
    giftDed: rowsOf('2부-11', '증여재산공제').map((r) => Object.assign(P(r), { spouse: r.값.배우자, asc: r.값.직계존속, ascMinor: r.값.직계존속_미성년, desc: r.값.직계비속, other: r.값.기타친족 })),
    marriageFrom: (rowsOf('2부-11', '혼인·출산 증여재산공제')[0] || {}).시작 || null,
    personal: rowsOf('2부-12', '그 밖의 인적공제').map((r) => Object.assign(P(r), { child: r.값.자녀, minorPerYear: r.값.미성년_1년당, elderly: r.값.연로자, disabledPerYear: r.값.장애인_1년당 })),
    cohabit: rowsOf('2부-12', '동거주택 상속공제').map((r) => Object.assign(P(r), { rate: r.값.율 / 100, cap: r.값.한도 })),
    business: rowsOf('2부-12', '가업상속공제 한도').map((r) => Object.assign(P(r), { tiers: Object.keys(r.값).map((k) => [Number((k.match(/(\d+)년/) || [])[1]), r.값[k]]).sort((a, b) => a[0] - b[0]) })),
    farming: rowsOf('2부-12', '영농상속공제 한도').map((r) => Object.assign(P(r), { cap: r.값.한도 })),
    genSkip: rowsOf('2부-15', '세대생략 할증률').map((r) => Object.assign(P(r), { minor: r.값.미성년_20억초과 / 100 }))
  };
  if (tb('2부-10')) {
    const now = (a) => a.filter((x) => !x.to)[0] || {};
    const g = now(gi.giftDed), pr = now(gi.personal), co = now(gi.cohabit), bz = now(gi.business), fm = now(gi.farming), gs = now(gi.genSkip);
    const ok = now(gi.credit).rate === 0.03 && g.spouse === 600000000 && g.asc === 50000000 && g.ascMinor === 20000000 && g.desc === 50000000 && g.other === 10000000 && gi.marriageFrom === '2024-01-01'
      && pr.child === 50000000 && pr.minorPerYear === 10000000 && pr.elderly === 50000000 && pr.disabledPerYear === 10000000 && co.rate === 1 && co.cap === 600000000
      && JSON.stringify(bz.tiers) === JSON.stringify([[10, 30000000000], [20, 40000000000], [30, 60000000000]]) && fm.cap === 3000000000 && gs.minor === 0.4;
    if (!ok) throw new Error('2부-10·11·12·15의 지금 값 행이 엔진 지금 값(신고세액공제 3%, 증여재산공제 6억·5천·2천·5천·1천, 인적공제, 동거주택 100%·6억, 가업 300·400·600억, 영농 30억, 할증 40%)과 다릅니다 — 확인 필요');
  }
  e = e.slice(0, i2) + EB + nl + '  const REF_TR_BRACKETS_ = ' + js(br) + ';' + nl + '  const REF_LT_ = { 표1: ' + js(lt1) + ', 표2: ' + js(lt2) + ' };' + nl + '  const REF_HV_ = ' + js(hv) + ';' + nl + '  const REF_SR_ = ' + js(sr) + ';' + nl + '  const REF_GI_ = ' + js(gi) + ';' + nl + '  ' + e.slice(k2);
  fs.writeFileSync(ENGINE, e);
  console.log('엔진: 기본세율 ' + br.length + '개 시기, 장특공 표1 ' + lt1.length + '·표2(2020 이전) ' + lt2.length + '개 시기, 고가주택 기준 주택 ' + hv.house.length + '·입주권 ' + hv.right.length + '개 시기, 특례세율(2부-02) ' + (sr.house.length + sr.other.length + sr.presale.length + sr.multi.length + sr.nonbiz.length) + '행 → taxcalc-engine.html');
}
// [2026.10.19 B-5] AI 지휘 form_needs 도구용 서식 색인 — 서버 코드에 넣지 않고(10MB 한도) 드라이브 자료 파일로 둔다.
//  J:\내 드라이브\0 NETAX\업무관리자\세금계산\법정서식원본(법제처)\_서식색인.json (구글 드라이브 동기화로 올라감 → 서버 formNeeds_가 DriveApp으로 읽고 6시간 캐시).
//  칸마다 종류: input(계산기 입력 칸 — 필드 이름을 읽을 수 있으면 목표 calc:a0.필드/calc:c0.필드), result(엔진 결과), screen(화면에서만 넣는 칸), none(계산기에 없음)
{
  const SEMOK = { 양도: 'transfer', 상속: 'inheritance', 증여: 'gift', 공통: 'common' };
  const semokOf = (no) => { const r = (catalog.서식 || []).find((x) => x.서식번호 === no); return r ? (SEMOK[r.세목] || r.세목) : (/소득세법/.test(no) ? 'transfer' : /제9호/.test(no) ? 'inheritance' : 'gift'); };
  const CONTRACT_FIELDS = ['totalPrice', 'contractDate', 'balanceDate', 'transferDate', 'downPayment', 'middlePayment'];
  const kindOf = (k) => {
    const t = (k.계산기칸 || []).join(' ');
    const first = String((k.계산기칸 || [])[0] || '').trim();
    // 첫 설명이 '계산기에 없음'이면 뒤에 입력 이름이 나와도 없음(예: 신고구분 — 전자신고만 만들고 계산기 입력 칸은 없음)
    if (!first || /^(계산기에 (따로 )?없음|엔진 키 없음|없음)/.test(first) || (/계산기에 (따로 )?없음|엔진 키 없음/.test(t) && !/결과|입력 [a-zA-Z]/.test(t))) return { 종류: 'none' };
    if (/^(결과|엔진)/.test(first)) return { 종류: 'result' }; // 첫 설명이 엔진 결과면 결과 칸(입력 이름은 그 결과의 재료)
    const m = /입력 ([a-zA-Z][a-zA-Z0-9]*)(?:\.([a-zA-Z][a-zA-Z0-9]*))?/.exec(t);
    if (m) return { 종류: 'input', 필드: (m[2] && /^(asset|contract|seller|t)$/.test(m[1])) ? m[2] : m[1] };
    if (/결과|엔진/.test(t)) return { 종류: 'result' };
    return { 종류: 'screen' };
  };
  const idx = { 만든때: new Date().toISOString(), 설명: '서식 사전(reftables) → AI 지휘 form_needs 색인. 칸: [칸, 이름, 종류(input/result/screen/none), 목표(calc:a0.필드 등 또는 빈 값), 채울 입력 안내]', 서식: {}, 목록: (catalog.서식 || []).map((x) => [x.서식번호, x.이름, SEMOK[x.세목] || x.세목]) };
  Object.keys(forms).forEach((no) => {
    const f = forms[no], sm = semokOf(no);
    idx.서식[no] = { 이름: f.이름, 세목: sm, 칸: (f.칸 || []).map((k) => {
      const kk = kindOf(k);
      const target = kk.종류 === 'input' && sm === 'transfer' ? 'calc:' + (CONTRACT_FIELDS.indexOf(kk.필드) !== -1 ? 'c0.' : 'a0.') + kk.필드 : '';
      return [k.칸, String(k.이름 || '').slice(0, 40), kk.종류, target, String((k.계산기칸 || [])[0] || '').slice(0, 60)];
    }) };
  });
  const txt = JSON.stringify(idx);
  const DRIVE = 'J:/내 드라이브/0 NETAX/업무관리자/세금계산/법정서식원본(법제처)';
  // [2026.10.19] --no-drive: 드라이브 색인은 건드리지 않음(다른 세션 가지의 새 서식 색인을 옛 것으로 덮지 않게 — 조견표만 고칠 때)
  if (process.argv.indexOf('--no-drive') !== -1) console.log('서식 색인: --no-drive라 드라이브에 안 씀(' + Buffer.byteLength(txt) + '바이트)');
  else if (fs.existsSync(DRIVE)) { fs.writeFileSync(path.join(DRIVE, '_서식색인.json'), txt); console.log('서식 색인 → 드라이브 _서식색인.json ' + Buffer.byteLength(txt) + '바이트(서식 ' + Object.keys(idx.서식).length + '장)'); }
  else console.log('서식 색인: 드라이브 폴더가 없어 건너뜀(' + Buffer.byteLength(txt) + '바이트)');
}
console.log('조견표 ' + tables.length + '장(' + tables.map((t) => t.번호).join(', ') + '), 서식 칸 지도 ' + Object.keys(forms).length + '장 → app 만들 때 화면에 끼움(서버 lawsearch.html은 빈 값)');
}
