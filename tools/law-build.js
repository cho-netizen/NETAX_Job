#!/usr/bin/env node
// [2026.10.19 법령 정비본] 법제처(law.go.kr) 현행본으로 "법령 정비본"을 만들고 세무사님 산식 보정을 뽑는다.
// 세무사님 말씀: "법령을 기존 드라이브를 1차로 둔다는 것이 불안하다. 유지보수가 되지 않은 폴더라서 말야. 네가 정비한다면 그렇게 하는 것이 좋겠지"
// 설계: netax-inventory/maps/설계_법령원본.md
//
// 만드는 것(드라이브 0 NETAX/업무관리자/법령/ — 이름 앞 _는 시스템 전용 폴더):
//   _본문/<법령>/<시행일>_<공포번호>.json.gz  판 하나(조문 단위, 항·호·목 번호 그대로, 산식 그림 번호·글자상자)
//   _본문/색인.json                          법령마다 판 목록(현행·시행예정·옛판) — 판은 더하기만 하고 지우지 않는다
//   _산식보정/산식보정.json                  세무사님 원본(2026.8)(참고용, 손대지 않음)에서 뽑은 산식 보정 + 나중의 Vision 판독
//   _감시/감시목록_법령.json, 읽기용(md)/<법령>/<법령>_<판>.md
// 서버(Code.js toolLookupStatuteArticle)가 이 파일들을 읽는다. 서버 코드에는 본문을 넣지 않는다(용량 10MB 한도).
//
//   _본문/<법령>/_부칙.json.gz              [2026.10.20] 그 법령의 부칙 전부(적용례·경과조치 — 법제처 판마다 모든 부칙이 들어 있어 법령마다 하나로)
// 사용: node tools/law-build.js [--out <정비본 폴더>] [--ref <세무사님 법령 폴더>] [--only 소득세법,…] [--history 20140101] [--dry]
//   --history: 그 날 이후 시행된 옛 판(연혁)도 모두 받는다 — 연혁 계산(양도일·증여일 당시 법) 근거. 옛 판은 .md를 만들지 않는다(원문 보기는 .json.gz로)
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const OUT = opt('out') || 'J:/내 드라이브/0 NETAX/업무관리자/법령'; // [2026.10.19] 폴더 정리(옛 이름 법령정비본)
const REF = opt('ref') || 'J:/내 드라이브/0 NETAX/업무관리자/법령/세무사님 원본(2026.8)'; // 세무사님 원본 — 참고용, 내용은 손대지 않음
const ONLY = opt('only') ? opt('only').split(',').map(s => s.replace(/\s/g, '')) : null;
const DRY = args.includes('--dry');
const HIST = opt('history'); // 예: 20140101
const REFETCH_BYUL = args.includes('--refetch-byul');
const REFETCH_BOX = args.includes('--refetch-box') ? (opt('refetch-box') === 'all' ? 'all' : 'cur') : null;
const OC = process.env.LAW_OC || 'netax';

// 정비 대상(계산·신고서·감사에 씀) / 조회만(지방세 — 세무사님이 범위 밖으로 정하심, 계산·신고서에 안 씀)
const LAWS = [
  ['국세기본법', '정비'], ['국세기본법 시행령', '정비'], ['국세기본법 시행규칙', '정비'],
  ['국세징수법', '정비'], ['국세징수법 시행령', '정비'], ['국세징수법 시행규칙', '정비'],
  ['소득세법', '정비'], ['소득세법 시행령', '정비'], ['소득세법 시행규칙', '정비'],
  ['상속세 및 증여세법', '정비'], ['상속세 및 증여세법 시행령', '정비'], ['상속세 및 증여세법 시행규칙', '정비'],
  ['조세특례제한법', '정비'], ['조세특례제한법 시행령', '정비'], ['조세특례제한법 시행규칙', '정비'],
  ['농어촌특별세법', '정비'], ['농어촌특별세법 시행령', '정비'],
  ['지방세법', '조회만'], ['지방세법 시행령', '조회만'], ['지방세법 시행규칙', '조회만'],
  ['지방세특례제한법', '조회만'], ['지방세특례제한법 시행령', '조회만'], ['지방세특례제한법 시행규칙', '조회만']
];
const LIST_ONLY = ['종합부동산세법', '종합부동산세법 시행령', '종합부동산세법 시행규칙']; // 감시만(정비본 안 만듦)
// 세무사님 법령 폴더 파일(참고용) — 산식 보정을 뽑는 곳
const REF_FILES = { '국세기본법': '국세기본법.md', '국세기본법시행령': '국세기본법시행령.md', '국세기본법시행규칙': '국세기본법시행규칙.md',
  '소득세법': '소득세법.md', '소득세법시행령': '소득세법시행령.md', '소득세법시행규칙': '소득세법시행규칙.md',
  '상속세및증여세법': '상속세및증여세법.md', '상속세및증여세법시행령': '상속세및증여세법시행령.md', '상속세및증여세법시행규칙': '상속세및증여세법시행규칙.md',
  '조세특례제한법': '조세특례제한법.md', '조세특례제한법시행령': '조세특례제한법시행령.md', '조세특례제한법시행규칙': '조세특례제한법시행규칙.md' };

const key = n => n.replace(/\s/g, '');
const today = (() => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10).replace(/-/g, ''); })();
const cdata = s => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '');
const tag = (s, t) => { const m = s.match(new RegExp('<' + t + '(?:\\s[^>]*)?>([^]*?)</' + t + '>')); return m ? cdata(m[1]).trim() : ''; };
const tagsAll = (s, t) => [...s.matchAll(new RegExp('<' + t + '(?:\\s[^>]*)?>([^]*?)</' + t + '>', 'g'))].map(m => m[1]);

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.text(); } catch (e) { }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error('받기 실패: ' + url.replace(/OC=[^&]+/, 'OC=…'));
}

// 법령의 판 목록(현행 1 + 시행예정) — 시행예정은 시행일마다 가장 늦게 공포된 판 하나
async function versions(name) {
  // [2026.10.20] 검색은 법·시행령·시행규칙이 섞여 100건을 넘으므로 쪽을 넘겨 모은다(1쪽만 보면 시행령 시행예정이 빠짐)
  let x = '';
  for (let page = 1; page <= 6; page++) { const y = await get('https://www.law.go.kr/DRF/lawSearch.do?OC=' + OC + '&target=eflaw&type=XML&display=100&page=' + page + '&query=' + encodeURIComponent(name)); if (!tagsAll(y, 'law').length) break; x += y; }
  const all = tagsAll(x, 'law').map(s => ({ 이름: tag(s, '법령명한글'), 법령ID: tag(s, '법령ID'), MST: tag(s, '법령일련번호'), 시행일: tag(s, '시행일자'), 공포일: tag(s, '공포일자'), 공포번호: tag(s, '공포번호'), 구분: tag(s, '제개정구분명'), 법종: tag(s, '법령구분명'), 코드: tag(s, '현행연혁코드') }))
    .filter(v => key(v.이름) === key(name));
  const cur = all.find(v => v.코드 === '현행');
  if (!cur) return { error: '법제처 검색에 현행판 없음' };
  const byEf = {};
  // [2026.10.20] 현행보다 먼저 공포된 시행예정(예: 국기법 2028.1.1. 시행분, 법률 21212)도 넣는다 — 법제처는 그 판 원문에 뒤 개정까지 반영해 준다(2026.9.29. 개정 표시 확인)
  all.filter(v => v.코드 === '시행예정' && v.시행일 > today).forEach(v => { const b = byEf[v.시행일]; if (!b || v.공포일 > b.공포일) byEf[v.시행일] = v; });
  return { 법령ID: cur.법령ID, 현행: cur, 예정: Object.keys(byEf).sort().map(k => byEf[k]) };
}

// [2026.10.20] 연혁 판 목록 — 같은 이름 법령의 판 전부(여러 쪽), 시행일마다 가장 늦게 공포된 판 하나
async function history(name, from) {
  const rows = [];
  for (let page = 1; page <= 15; page++) {
    const x = await get('https://www.law.go.kr/DRF/lawSearch.do?OC=' + OC + '&target=eflaw&type=XML&display=100&page=' + page + '&query=' + encodeURIComponent(name));
    const laws = tagsAll(x, 'law'); if (!laws.length) break;
    laws.map(s => ({ 이름: tag(s, '법령명한글'), MST: tag(s, '법령일련번호'), 시행일: tag(s, '시행일자'), 공포일: tag(s, '공포일자'), 공포번호: tag(s, '공포번호'), 구분: tag(s, '제개정구분명'), 법종: tag(s, '법령구분명'), 코드: tag(s, '현행연혁코드') }))
      .filter(v => key(v.이름) === key(name) && v.시행일 >= from).forEach(v => rows.push(v));
  }
  const byEf = {}; rows.forEach(v => { const b = byEf[v.시행일]; if (!b || v.공포일 > b.공포일) byEf[v.시행일] = v; });
  return Object.keys(byEf).sort().map(k => byEf[k]);
}
// [2026.10.20] 낡은 연혁 글 표시 — 시행일 순으로 앞 판들보다 먼저 공포된 판(주로 타법개정)은 법제처가 그 법률 하나로 고친 글만 주어
// 그 사이 공포된 개정을 반영하지 않는 일이 있다(조특법 20050423_07240 조 11개 빠짐, 20250401_20617 = 20778호로 바뀐 14개 조가 그 전 글).
// 앞 최신 공포 판(M)이 그 직전 판(M0)에서 바꾼 조가 이 판(P)에서 M0 글로 되돌아갔거나 M의 조가 빠졌으면 p.낡은글 = { 앞최신, 되돌림, 빠진조 }.
// 서버(Code.js toolLookupStatuteArticle)는 이런 판 대신 같은 날까지 시행된 판 중 가장 늦게 공포된 판을 쓴다.
function markStale(k, ent) {
  const load = v => { const f = path.join(OUT, '_본문', k, v + '.json.gz'); return fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')) : null; };
  const body = a => JSON.stringify([a.내용, a.항]).replace(/<(개정|신설|본조신설|전문개정)[^>]*>/g, '').replace(/\s+/g, '');
  const ps = ent.판; let maxP = null, prevOfMax = null;
  ps.forEach(p => delete p.낡은글);
  for (const p of ps) {
    if (maxP && p.공포일 < maxP.공포일) {
      const M = load(maxP.판), P = load(p.판), M0 = prevOfMax && load(prevOfMax.판);
      if (M && P) {
        const pm = new Map(P.조.map(a => [a.조, body(a)])), m0 = M0 ? new Map(M0.조.map(a => [a.조, body(a)])) : new Map();
        let back = 0, gone = 0;
        M.조.forEach(a => { const t = body(a), tp = pm.get(a.조); if (tp === undefined) gone++; else if (M0 && m0.get(a.조) !== t && tp === m0.get(a.조)) back++; });
        if (back || gone) p.낡은글 = { 앞최신: maxP.판, 되돌림: back, 빠진조: gone };
      }
    }
    // M0 = M보다 먼저 공포된 마지막 판(같은 법률로 시행일만 다른 판이 이어지면 M0는 그대로 둔다)
    if (!maxP || p.공포일 > maxP.공포일) { prevOfMax = maxP; maxP = p; } else if (p.공포일 === maxP.공포일) maxP = p;
  }
  // [2026.10.20 위원회 N14] "이 날 그 판 법률로 바뀐 조" — 같은 법률의 앞 판(같은 공포번호, 이른 시행일)이 있으면 그 판과 글이 다른 조,
  //  없으면(타법개정 등) 그 판 XML 개정문에서 이 법령을 고친 부분의 조 번호. 서버가 판주의에 목록을 넣고, 조회한 조가 들면 맨 앞에 경고.
  for (const p of ps.filter(x => x.낡은글)) {
    const same = ps.filter(q => +q.공포번호 === +p.공포번호 && q.공포일 === p.공포일 && q.시행일 < p.시행일).pop();
    if (same) {
      const A = load(same.판), P = load(p.판);
      if (A && P) { const am = new Map(A.조.map(a => [a.조, body(a)])); p.낡은글.바뀐조 = P.조.filter(a => am.get(a.조) !== body(a)).map(a => a.조); p.낡은글.바뀐조근거 = '같은 법률 앞 판(' + same.판 + ') 대비'; }
    } else {
      p.낡은글.바뀐조 = null; p.낡은글.바뀐조근거 = '개정문'; // 개정문은 XML을 받아야 해서 아래 fillStaleChanges가 채움
    }
  }
}
// 개정문에서 이 법령을 고친 조 번호 — "○○법 일부를 다음과 같이 개정한다." 다음부터, 다른 법률 개정(⑬부터 …·다음 번호 ⑭ ○○법 일부를) 앞까지
async function fillStaleChanges(name, ent) {
  for (const p of ent.판.filter(x => x.낡은글 && x.낡은글.바뀐조 === null)) {
    try {
      const x = await get('https://www.law.go.kr/DRF/lawService.do?OC=' + OC + '&target=eflaw&type=XML&MST=' + p.MST + '&efYd=' + p.시행일);
      const g = ((x.match(/<개정문>([\s\S]*?)<\/개정문>/) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>|<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const nm = name.replace(/\s/g, '\\s*'), i = g.search(new RegExp(nm + '\\s*일부를\\s*다음과\\s*같이\\s*개정한다'));
      let seg = i >= 0 ? g.slice(i) : g;
      const end = seg.slice(10).search(/[⑪-⑳]부터|[①-⑳]\s*[가-힣·ㆍ\s]+(?:법|령|규칙)\s*일부를\s*다음과|<\d+>\s*[가-힣·ㆍ\s]+(?:법|령|규칙)\s*일부를|생략|부칙\s*제\d+조/);
      if (end > 0) seg = seg.slice(0, end + 10);
      // 그 판에 실제로 있는 조만(개정문 둘레의 다른 법률 조 번호 걸러냄)
      const f = path.join(OUT, '_본문', key(name), p.판 + '.json.gz'), have = fs.existsSync(f) ? new Set(JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')).조.map(a => a.조)) : null;
      p.낡은글.바뀐조 = [...new Set([...seg.matchAll(/제(\d+)조(?:의(\d+))?/g)].map(m => m[1] + (m[2] ? '의' + m[2] : '')))].filter(j => !have || have.has(j));
    } catch (e) { p.낡은글.바뀐조 = []; p.낡은글.바뀐조근거 = '개정문 받기 실패'; }
    await new Promise(r => setTimeout(r, 300));
  }
}
// [2026.10.20] 부칙 — <부칙단위>마다 공포일·공포번호·글(CDATA 줄을 이어 붙임)
function parseBuchik(x) {
  const i = x.indexOf('<부칙>'); if (i < 0) return [];
  return tagsAll(x.slice(i), '부칙단위').map(u => ({ 공포일: tag(u, '부칙공포일자'), 공포번호: tag(u, '부칙공포번호'),
    내용: [...String((u.match(/<부칙내용>([^]*?)<\/부칙내용>/) || [])[1] || '').matchAll(/<!\[CDATA\[([^]*?)\]\]>/g)].map(m => m[1]).join('\n').replace(/\n{3,}/g, '\n\n').trim() }))
    .filter(b => b.공포일);
}
// 조문 글 정리 — 산식 그림은 〔산식 그림 imgN〕 표시 + (있으면) 법제처 글자상자. 서버(Code.js lawUnit_)와 같은 규칙.
function cleanText(s) {
  const imgs = [];
  const t = cdata(s).replace(/<img[^>]*?flSeq=(\d+)[^>]*>(?:([^<]*)<\/img>)?/g, (m, id, box) => {
    imgs.push(id);
    const b = String(box || '').replace(/^\s*\n|\s+$/g, '');
    return '〔산식 그림 img' + id + '〕' + (/[│┌]/.test(b) || /[가-힣]/.test(b) ? '\n' + b : ''); // [2026.10.20] │┌ 없이 띄어쓰기로만 그린 글자상자도 둠(조특칙 §45의10⑦ — 원문 표본 대조로 발견)
  }).replace(/<\/?[a-z][^>]*>/gi, '').trim();
  return { t, imgs };
}
function parseLaw(x) {
  const a0 = x.indexOf('<조문>'), a1 = x.indexOf('<부칙>');
  const body = x.slice(a0, a1 > 0 ? a1 : x.length);
  const arts = [], 머리 = []; let wait = [];
  for (const m of body.matchAll(/<조문단위[^>]*>([^]*?)<\/조문단위>/g)) {
    const u = m[1];
    // 편·장·절·관 제목(조문여부=전문) — 바로 다음 조문 앞에 붙인다(법령정보 모양 .md·화면 차례용)
    if (tag(u, '조문여부') === '전문') { const t = cleanText(tag(u, '조문내용')).t; if (t) wait.push(t); continue; }
    if (tag(u, '조문여부') !== '조문') continue;
    if (wait.length) { const g0 = tag(u, '조문가지번호'); 머리.push({ 앞: tag(u, '조문번호') + (g0 && g0 !== '0' ? '의' + g0 : ''), 글: wait }); wait = []; }
    const n = tag(u, '조문번호'), g = tag(u, '조문가지번호');
    const imgs = [];
    const T = s => { const c = cleanText(s); imgs.push(...c.imgs); return c.t; };
    const 항 = tagsAll(u, '항').map(h => ({
      내용: T(tag(h, '항내용')),
      호: tagsAll(h, '호').map(o => ({ 내용: T(tag(o, '호내용')), 목: tagsAll(o, '목').map(mk => T(tag(mk, '목내용'))).filter(Boolean) }))
    }));
    arts.push({ 조: n + (g && g !== '0' ? '의' + g : ''), 제목: tag(u, '조문제목'), 시행: tag(u, '조문시행일자'), 내용: T(tag(u, '조문내용')), 항, 참고: tag(u, '조문참고자료'), 그림: [...new Set(imgs)] });
  }
  // [2026.10.20] 별표 — 번호(가지)·구분(별표/서식)·제목·시행일·본문 글(법제처가 글로 준 것)·PDF/HWP 파일 번호
  const bi = x.indexOf('<별표>');
  const 별표 = bi < 0 ? [] : tagsAll(x.slice(bi), '별표단위').map(u => {
    const n = String(+tag(u, '별표번호') || ''), g = +tag(u, '별표가지번호') || 0, fl = t => (tag(u, t).match(/flSeq=(\d+)/) || [])[1] || '';
    return { 번호: n + (g ? '의' + g : ''), 구분: tag(u, '별표구분'), 제목: tag(u, '별표제목'), 시행: tag(u, '별표시행일자'),
      내용: [...String((u.match(/<별표내용>([^]*?)<\/별표내용>/) || [])[1] || '').matchAll(/<!\[CDATA\[([^]*?)\]\]>/g)].map(m => m[1].replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim(),
      pdf: fl('별표서식PDF파일링크'), hwp: fl('별표서식파일링크') };
  });
  return { arts, 머리, 별표 };
}

// ---------- 법령정보 모양 .md (세무사님 "법령파일을 md파일로 만들어서 문서작성할때 처럼 법령정보시스템 모양으로 보여주는 것이었다") ----------
// .json.gz(시스템용)와 같은 원자료에서 만든다. 들여쓰기는 전각 공백(　) — 복사해 붙여도 모양이 남는다. 산식 그림: 산식 보정(덧입힐 수 있는 것) →
// 법제처 글자상자 → 둘 다 없으면 "[그림 산식 — 판독 대기]". 검증 필요(코드에서 옮김)·다시 확인 필요 보정은 본문에 넣지 않고 조문 끝에 알림만.
const ymd = s => String(s || '').replace(/^(\d{4})(\d{2})(\d{2})$/, (m, y, mo, d) => y + '. ' + (+mo) + '. ' + (+d) + '.');
function mdText(t, ind, corrOf) {
  const out = [], lines = String(t || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], mm = l.match(/^\s*〔산식 그림 img(\d+)〕\s*$/);
    if (!mm) { if (l.trim()) out.push(ind + l.trim() + '  '); continue; }
    const id = mm[1], box = [];
    const isBox = s => s !== undefined && ((/^[│┌└├┬┴┼─┐┘┤\s]/.test(s) && /[│┌└─]/.test(s)) || /^\s{2,}\S/.test(s)); // 띄어쓰기로만 그린 상자(앞 공백 2칸 이상)도
    // 상자 앞의 짧은 제목 줄("표 1")도 상자에 넣는다
    while (i + 1 < lines.length && (isBox(lines[i + 1]) || (lines[i + 1].trim().length <= 20 && isBox(lines[i + 2])))) box.push(lines[++i]);
    const c = corrOf(id);
    if (c) out.push(ind + '〔산식 — ' + c.출처 + ' · ' + c.상태 + '〕  ', ...c.산식.split('\n').map(s => ind + s.trim() + '  '));
    if (box.length) out.push('', '```', '[법제처 글자상자 img' + id + ']', ...box, '```', '');
    else if (!c) out.push(ind + '[그림 산식 — 판독 대기] (원본 그림: https://www.law.go.kr/LSW/flDownload.do?flSeq=' + id + ')  ');
  }
  return out;
}
function lawToMd(doc, corr, 법종, buchik) {
  const L = ['# ' + doc.법령, '', '[시행 ' + ymd(doc.시행일) + '] [' + (법종 ? 법종 + ' ' : '') + '제' + String(doc.공포번호).replace(/^0+/, '') + '호, ' + ymd(doc.공포일) + ', ' + doc.구분 + ']', '',
    '> 법령 정비본 — 법제처(law.go.kr) 이 시행일 판 원문 그대로(' + doc.받은날 + ' 받음). 시스템용 같은 내용: ' + doc.법령.replace(/\s/g, '') + '/' + doc.시행일 + '_' + doc.공포번호 + '.json.gz', ''];
  const 머리 = {}; (doc.머리 || []).forEach(h => { 머리[h.앞] = h.글; });
  for (const a of doc.조) {
    (머리[a.조] || []).forEach(h => L.push('## ' + h, ''));
    const cs = corr.filter(x => x.조 === a.조);
    const use = id => cs.find(x => x.그림[0] === id && x.그림.every(g => a.그림.includes(g)) && !/^(검증|다시)/.test(x.상태));
    const head = String(a.내용 || '').split('\n')[0], m = head.match(/^(제\d+조(?:의\d+)?\([^)]*\))\s*(.*)$/);
    L.push('### ' + (m ? m[1] : head));
    const first = m ? [m[2]].concat(String(a.내용).split('\n').slice(1)).join('\n') : String(a.내용).split('\n').slice(1).join('\n');
    L.push(...mdText(first, '', use));
    for (const h of a.항) {
      L.push(...mdText(h.내용, '', use));
      for (const o of h.호) { L.push(...mdText(o.내용, '　', use)); for (const mk of o.목) L.push(...mdText(mk, '　　', use)); }
    }
    if (a.참고) L.push(...a.참고.split('\n').map(s => s.trim() + '  '));
    const warn = cs.filter(x => /^(검증|다시)/.test(x.상태) || !x.그림.every(g => a.그림.includes(g)));
    if (warn.length) L.push('', '> ※ 이 조문 산식 보정 중 근거로 쓰지 않는 것: ' + warn.map(x => 'img' + x.그림[0] + ' ' + (x.그림.every(g => a.그림.includes(g)) ? x.상태 : '다시 확인 필요(이 판에는 그 그림이 없음)')).join(' / '));
    L.push('');
  }
  // [2026.10.20] 별표 — 제목·시행일·원본(PDF) 주소, 본문 글
  if ((doc.별표 || []).length) { L.push('## 별표', ''); doc.별표.forEach(b => { L.push('### [' + (b.구분 || '별표') + ' ' + b.번호 + '] ' + b.제목 + (b.시행 ? ' (' + ymd(b.시행) + ' 시행)' : ''), ''); if (b.pdf) L.push('원본 PDF: https://www.law.go.kr/LSW/flDownload.do?flSeq=' + b.pdf + '  ', ''); if (b.내용) L.push('```', b.내용, '```', ''); }); }
  // [2026.10.20] 부칙 — 이 판 공포일까지의 부칙을 최근 것부터(법제처 화면 순서)
  const bs = (buchik || []).filter(b => b.공포일 <= doc.공포일).sort((a, b) => b.공포일.localeCompare(a.공포일));
  if (bs.length) { L.push('## 부칙', ''); bs.forEach(b => { L.push('### 부칙 <제' + String(b.공포번호).replace(/^0+/, '') + '호, ' + ymd(b.공포일) + '>', ''); String(b.내용).split('\n').forEach(l => { if (l.trim() && !/^부칙\s*</.test(l.trim())) L.push(l.replace(/^\s+/, m => '　'.repeat(Math.min(3, Math.floor(m.length / 2)))) + '  '); }); L.push(''); }); }
  return L.join('\n');
}

// ---------- 산식 보정(세무사님 폴더에서) ----------
// 주석 글로 누가 적었는지 가린다 — "사용자 타이핑/스크린샷 제공", "사용자가 … 직접 타이핑"만 세무사님(조특령 §40 주석의 "사용자가 입력한"은 계산기 화면 이야기라 아님)
const NOTE_SRC = n => /사용자\s*(타이핑|스크린샷)|사용자가[^.]{0,20}직접\s*타이핑/.test(n) ? ['세무사님 타이핑', '확인됨(세무사님 타이핑)']
  : /alt|LaTeX/.test(n) ? ['8월 Claude 작성(원문 그림 설명글로 확인)', '참고(8월 Claude 작성·원문 대조됨)']
  : /대체 불가/.test(n) ? null
  : (/원문 (대조|확인)/.test(n) && !/대조 필요|확인 필요/.test(n)) ? ['8월 Claude 작성(원문 대조 확인)', '참고(8월 Claude 작성·원문 대조됨)']
  : /(tax-calc|Code\.js|구현)/.test(n) ? ['8월 Claude 작성(계산기 코드에서 옮김)', '검증 필요(코드에서 옮김 — 법령 근거 아님)']
  : ['8월 Claude 작성(출처 불명)', '검증 필요'];
const NORM = s => String(s).replace(/<[^>]+>/g, '').replace(/[\s=＝×÷\-－−+()（）\[\]{}\/／:·ㆍ,.「」"'“”〔〕]/g, '');
// 보정 산식을 법제처 글자상자(있으면)와 맞대 본다 — 영문 기호(A·B·C…) 집합이 같고 한글 낱말이 대부분(80%) 상자에 있으면 "낱말 일치".
// 연산 기호(×÷−)까지의 확인은 Vision 검산 단계에서 한다. 예: 국세기본법 §24 세무사님 타이핑 "(A - B) × (C / D)" ↔ 현행 상자 "A × B / C"(2025.3.14 개정) → 다름.
function boxOf(art, id) {
  // 상자 앞에 공백·"표 1" 같은 제목 줄이 올 수 있다
  const m = JSON.stringify(art).match(new RegExp('〔산식 그림 img' + id + '〕\\\\n([^〔"]*?┌[^〔"]*?┘)'));
  return m ? JSON.parse('"' + m[1] + '"') : '';
}
function agree(formula, box) {
  const letters = s => [...new Set((s.replace(/[가-힣]+/g, ' ').match(/\b[A-Z]\b/g) || []))].sort().join('');
  const words = (formula.match(/[가-힣]{2,}/g) || []);
  const bn = NORM(box);
  const cover = words.length ? words.filter(w => bn.includes(w)).length / words.length : 1;
  return letters(formula) === letters(box) && cover >= 0.8;
}
function judge(formula, art, ids, base) {
  const boxes = ids.map(id => boxOf(art, id)).filter(Boolean);
  if (!boxes.length) return base + ' — 맞대 볼 법제처 글자상자 없음';
  return agree(formula, boxes.join('\n')) ? base + ' — 법제처 글자상자와 낱말 일치' : '다시 확인 필요(법제처 글자상자와 다름)';
}
function refArticles(file) {
  const L = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let stop = L.findIndex((l, i) => i > 50 && /^\s*(#+\s*)?부\s*칙\s*($|<|\()/.test(l)); if (stop < 0) stop = L.length;
  const re = /^\s*제(\d+)조(?:의(\d+))?\s*(?:【([^】]*)】|\(([^)]*)\))/;
  const arts = {}; let cur = null;
  for (let i = 0; i < stop; i++) {
    const m = L[i].match(re);
    if (m && !/버튼접기/.test(L[i])) { const k = m[1] + (m[2] ? '의' + m[2] : ''); cur = arts[k] || (arts[k] = { lines: [] }); continue; }
    if (cur) cur.lines.push({ t: L[i], n: i + 1 });
  }
  return arts;
}
function extractCorrections(lawKey, refFile, arts, verKey) {
  const out = [], ra = refArticles(refFile);
  const byK = {}; arts.forEach(a => { byK[a.조] = a; });
  for (const [k, a] of Object.entries(ra)) {
    const cur = byK[k];
    const curNorm = cur ? NORM(JSON.stringify(cur)) : '';
    // (가) ※ imgN 대체 주석 — 그 위로 이어진 산식 덩어리(| 표 |, "… = …" 줄, "A: …" 뜻풀이)가 산식. 조문 문장(…다.)·항·호 머리에서 멈춘다
    const inNote = new Set();
    a.lines.forEach((ln, i) => {
      const mm = ln.t.match(/^※\s*img(\d+)/); if (!mm) return;
      const blk = [];
      for (let j = i - 1; j >= 0 && blk.length < 15; j--) {
        const t = a.lines[j].t;
        if (!t.trim()) continue;
        // 산식 모양 줄(| 표 |, = × ÷ 가 든 줄, "A: 뜻풀이")만 모은다 — 상증법 파일은 호 번호가 빠져 있어 번호로는 멈출 수 없다
        if (/^※/.test(t) || !(/^\|/.test(t) || /[=＝×÷]/.test(t) || /^\s*[A-Z]\s*[:：]/.test(t))) break;
        blk.unshift(j);
      }
      blk.forEach(j => inNote.add(j));
      const src = NOTE_SRC(ln.t); if (!src) return;
      const rows = blk.map(j => a.lines[j].t).filter(t => !/^\|\s*-/.test(t) && !/^\|\s*(항목|구분)\s*\|\s*(산식|내용)\s*\|\s*$/.test(t));
      const 산식 = rows.map(t => /^\|/.test(t) ? t.replace(/^\|\s*|\s*\|\s*$/g, '').split(/\s*\|\s*/).filter(Boolean).join(': ') : t.trim()).join('\n');
      const id = mm[1], live = !!(cur && cur.그림.includes(id));
      const 상태 = !live ? '다시 확인 필요(그 뒤 개정으로 산식 그림이 바뀜)' : /^검증 필요/.test(src[1]) ? src[1] : judge(산식, cur, [id], src[1]);
      out.push({ 법령: lawKey, 조: k, 그림: [id], 산식, 출처: src[0], 상태, 주석: ln.t.slice(0, 300), 원본: { 파일: path.basename(refFile), 줄: ln.n }, 기준판: verKey, 구분: 'ref' });
    });
    // (나) 주석 없이 본문에 타이핑한 산식 — 법제처 원문에 글로 없는 "… = …" 줄만(원문에 원래 글로 있는 산식은 보정 아님)
    if (!cur || !cur.그림.length) continue;
    const typed = a.lines.filter((l, i) => !inNote.has(i) && /[=＝]/.test(l.t) && !/^※|^\||img\d{5,}|<em/.test(l.t) && !curNorm.includes(NORM(l.t).slice(0, 40)));
    if (!typed.length) continue;
    const 산식 = typed.map(l => l.t.trim()).join('\n');
    // 주석 없는 본문 타이핑 — 누가 쳤는지 기록이 없다(세무사님 또는 8월 작업). 그림 번호도 안 남아 그 조문 그림 전부에 묶고, 글자상자 대조가 중요하다.
    out.push({ 법령: lawKey, 조: k, 그림: cur.그림.slice(), 산식, 출처: '주석 없는 타이핑(세무사님 또는 8월 작업 — 누가 쳤는지 기록 없음)', 상태: judge(산식, cur, cur.그림, '참고(주석 없는 타이핑)'), 원본: { 파일: path.basename(refFile), 줄: typed[0].n }, 기준판: verKey, 구분: 'ref' });
  }
  return out;
}

(async () => {
  const idxPath = path.join(OUT, '_본문', '색인.json');
  const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : { 법령: {} };
  const corr = [];
  const report = [];
  for (const [name, scope] of LAWS) {
    const k = key(name);
    if (ONLY && !ONLY.includes(k)) continue;
    let v;
    try { v = await versions(name); } catch (e) { report.push(name + ': ' + e.message); continue; }
    if (v.error) { report.push(name + ': ' + v.error); continue; }
    const ent = idx.법령[k] || (idx.법령[k] = { 이름: name, 범위: scope, 법령ID: v.법령ID, 판: [] });
    ent.범위 = scope; ent.법령ID = v.법령ID;
    let curArts = null, curKey = null;
    let hist = [];
    if (HIST && scope === '정비') { try { hist = (await history(name, HIST)).filter(h => h.시행일 < v.현행.시행일 && !v.예정.some(e => e.시행일 === h.시행일)); } catch (e) { report.push(name + ' 연혁 목록 실패: ' + e.message); } }
    let curXml = null;
    for (const [ver, 상태] of [[v.현행, '현행']].concat(v.예정.map(x => [x, '시행예정'])).concat(hist.map(x => [x, '옛판']))) {
      const vk = ver.시행일 + '_' + ver.공포번호;
      const file = path.join(OUT, '_본문', k, vk + '.json.gz');
      let arts;
      // 이미 받은 판은 다시 받지 않는다 — 다만 편·장·절 제목(머리)이 없는 옛 형식이면 다시 받는다
      const have = fs.existsSync(file) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) : null;
      // [2026.10.20] --refetch-box: 글자상자 빈 그림이 있는 판은 다시 받는다(│┌ 없이 그린 상자를 예전 규칙이 버렸음). 값 all이면 옛 판까지
      const emptyBox = h => /〔산식 그림 img\d+〕(?!\\n)/.test(JSON.stringify(h.조));
      const refBox = REFETCH_BOX && (REFETCH_BOX === 'all' || 상태 !== '옛판') && have && emptyBox(have);
      const refByul = REFETCH_BYUL && 상태 === '옛판' && have && !have.별표; // [2026.10.20] --refetch-byul: 별표 없이 받은 옛 판을 다시 받아 별표까지(가업상속 업종 등 그 시점 별표)
      if (have && have.머리 && (상태 === '옛판' || have.별표) && !refBox && !refByul) arts = have.조;
      else {
        const x = await get('https://www.law.go.kr/DRF/lawService.do?OC=' + OC + '&target=eflaw&type=XML&MST=' + ver.MST + '&efYd=' + ver.시행일);
        if (상태 === '현행') curXml = x;
        const pl = parseLaw(x); arts = pl.arts;
        if (!arts.length) { report.push(name + ' ' + vk + ': 조문 0개(받기 이상)'); continue; }
        const doc = { 법령: name, 법령ID: v.법령ID, MST: ver.MST, 시행일: ver.시행일, 공포일: ver.공포일, 공포번호: ver.공포번호, 구분: ver.구분, 받은날: today, 출처: 'law.go.kr eflaw', 머리: pl.머리, 조: arts, 별표: pl.별표 };
        if (!DRY) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, zlib.gzipSync(Buffer.from(JSON.stringify(doc), 'utf8'), { level: 9 })); }
        report.push(name + ' ' + vk + ' 새 판 저장(' + 상태 + ', 조문 ' + arts.length + ', 그림 ' + arts.reduce((s, a) => s + a.그림.length, 0) + ')');
      }
      let p = ent.판.find(x => x.판 === vk);
      if (!p) ent.판.push(p = { 판: vk });
      Object.assign(p, { 시행일: ver.시행일, 공포일: ver.공포일, 공포번호: ver.공포번호, 구분: ver.구분, 법종: ver.법종, MST: ver.MST, 조문수: arts.length });
      if (상태 === '현행') { curArts = arts; curKey = vk; }
      if (상태 === '옛판') await new Promise(r => setTimeout(r, 300)); // 법제처에 몰아서 묻지 않게
    }
    // 부칙 — 현행판 XML에 그 법령의 부칙이 모두 들어 있다(없으면 한 번 받음)
    try {
      if (!curXml) curXml = await get('https://www.law.go.kr/DRF/lawService.do?OC=' + OC + '&target=eflaw&type=XML&MST=' + v.현행.MST + '&efYd=' + v.현행.시행일);
      const bu = parseBuchik(curXml);
      // 시행예정 판의 부칙(현행 XML에 아직 없을 수 있음)은 그 판 XML에서 더한다 — 공포번호로 겹침 제거
      for (const e of v.예정) { if (bu.some(b => +b.공포번호 === +e.공포번호)) continue; try { parseBuchik(await get('https://www.law.go.kr/DRF/lawService.do?OC=' + OC + '&target=eflaw&type=XML&MST=' + e.MST + '&efYd=' + e.시행일)).forEach(b => { if (!bu.some(c => +c.공포번호 === +b.공포번호)) bu.push(b); }); } catch (x) {} }
      // [2026.10.20] 전부개정(예: 국세징수법 2020.12.29.) 전 옛 판의 부칙은 현행 XML에 없다 — 부칙이 빠진 판은 그 판 XML에서(최근 판부터, 한 번 받으면 그 전 부칙이 함께 들어옴)
      for (const p of ent.판.slice().sort((a, b) => b.판.localeCompare(a.판))) {
        if (!p.MST || bu.some(b => +b.공포번호 === +p.공포번호 && b.공포일 === p.공포일)) continue;
        try { parseBuchik(await get('https://www.law.go.kr/DRF/lawService.do?OC=' + OC + '&target=eflaw&type=XML&MST=' + p.MST + '&efYd=' + p.시행일)).forEach(b => { if (!bu.some(c => +c.공포번호 === +b.공포번호 && c.공포일 === b.공포일)) bu.push(b); }); } catch (x) { }
        await new Promise(r => setTimeout(r, 300));
      }
      if (!DRY) fs.writeFileSync(path.join(OUT, '_본문', k, '_부칙.json.gz'), zlib.gzipSync(Buffer.from(JSON.stringify({ 법령: name, 받은날: today, 기준판: v.현행.시행일 + '_' + v.현행.공포번호, 부칙: bu }), 'utf8'), { level: 9 }));
      ent.부칙수 = bu.length;
      report.push(name + ' 부칙 ' + bu.length + '개');
    } catch (e) { report.push(name + ' 부칙 실패: ' + e.message); }
    curXml = null;
    // 판 상태 다시 매김: 현행 1개, 그보다 늦은 시행일 = 시행예정, 이른 = 옛판(지우지 않음)
    ent.판.sort((a, b) => a.시행일.localeCompare(b.시행일) || a.공포일.localeCompare(b.공포일));
    ent.판.forEach(p => { p.상태 = p.판 === curKey ? '현행' : (p.시행일 > (v.현행.시행일) ? '시행예정' : '옛판'); });
    ent.현행 = curKey; ent.확인한날 = today;
    if (!DRY) { markStale(k, ent); await fillStaleChanges(name, ent); }
    if (curArts && REF_FILES[k] && fs.existsSync(path.join(REF, REF_FILES[k]))) corr.push(...extractCorrections(k, path.join(REF, REF_FILES[k]), curArts, curKey));
  }
  idx.만든때 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  idx.설명 = '법령 정비본 색인 — tools/law-build.js가 만든다. 판은 더하기만(옛판 보존). 범위 "조회만"(지방세)은 계산·신고서에 쓰지 않는다.';
  // 산식 보정: 세무사님 폴더에서 뽑은 것(구분 ref)은 새로 갈고, Vision 판독·세무사님 확인 등 나머지는 그대로 둔다
  const corrPath = path.join(OUT, '_산식보정', '산식보정.json');
  const old = fs.existsSync(corrPath) ? JSON.parse(fs.readFileSync(corrPath, 'utf8')) : { 항목: [] };
  const doneLaws = new Set(corr.map(c => c.법령).concat(ONLY || []));
  const keep = (old.항목 || []).filter(c => c.구분 !== 'ref' || (ONLY && !doneLaws.has(c.법령)));
  const items = keep.concat(corr);
  // [2026.10.20] 원본 그림을 직접 읽은 판독(구분 claude판독 — maps/법령도구/그림판독_합치기.js)이 있는 그림은 다른 보정을 '다시 확인 필요(대체)'로(서버·.md가 덧입히지 않음)
  items.forEach(x => { if (x.구분 !== 'claude판독' && x.그림.length === 1 && items.some(v => v.구분 === 'claude판독' && v.그림[0] === x.그림[0]) && !/^다시 확인 필요\(원본 그림 판독으로 대체/.test(x.상태)) x.상태 = '다시 확인 필요(원본 그림 판독으로 대체 — 전: ' + x.상태 + ')'; });
  const cnt = {}; items.forEach(c => { cnt[c.상태] = (cnt[c.상태] || 0) + 1; });
  const corrDoc = { 설명: '산식 보정 — 법제처 원문에서 그림뿐인 산식을 글로. 세무사님 법령 폴더(참고용)에서 뽑은 것(구분 ref) + Vision 판독(구분 vision). 그림 번호가 그 판 조문에 없으면 덧입히지 않고 "다시 확인 필요".', 만든때: idx.만든때, 상태별: cnt, 항목: items };
  // 판마다 법령정보 모양 .md 사본 — 법령/읽기용(md)/<법령>/<법령>_<시행일>_<공포번호>.md (같은 원자료라 .json.gz와 내용이 같다)
  let mdN = 0;
  for (const [n] of LAWS) {
    const k = key(n), e = idx.법령[k]; if (!e || (ONLY && !ONLY.includes(k))) continue;
    const bf = path.join(OUT, '_본문', k, '_부칙.json.gz'), buchik = fs.existsSync(bf) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(bf)).toString('utf8')).부칙 : [];
    for (const p of e.판) {
      if (p.상태 === '옛판') continue; // 옛 판은 .md 없이 .json.gz만(드라이브 용량·동기화 — 원문 보기는 판을 골라 .json.gz로)
      const f = path.join(OUT, '_본문', k, p.판 + '.json.gz'); if (!fs.existsSync(f)) continue;
      const md = lawToMd(JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')), items.filter(x => x.법령 === k), p.법종, buchik);
      if (!DRY) { fs.mkdirSync(path.join(OUT, '읽기용(md)', k), { recursive: true }); fs.writeFileSync(path.join(OUT, '읽기용(md)', k, k + '_' + p.판 + '.md'), md); }
      mdN++;
    }
  }
  console.log('.md 사본', mdN);
  // 감시목록_법령.json(법령 세션 몫) — EnvWatch가 읽는다. 정비·조회만 + 목록만(종합부동산세법 — 계산기에 없음, 개정 날짜만)
  const watch = LAWS.concat(LIST_ONLY.map(n => [n, '목록만'])).map(([n, scope]) => ({ id: '법령:' + key(n), 종류: '법령', 이름: n, 범위: scope,
    확인: { 방법: '법제처법령', 관련법령: n }, 주기: '매일', 기준값: (idx.법령[key(n)] || {}).현행 || '', 기준일: today.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3'),
    영향: scope === '목록만' ? ['개정 날짜만 알림'] : ['법령 정비본 새 판(node tools/law-build.js)', '산식 보정·Vision 판독 다시 확인(바뀐 조문)'], 담당: '법령 세션' }));
  // 그림목록.json — Vision 판독 대상(정비 대상 현행판 조문 속 산식 그림). 법제처 글자상자도 없는 그림을 먼저.
  const pics = [];
  for (const [n, scope] of LAWS) {
    const e = idx.법령[key(n)]; if (scope !== '정비' || !e || !e.현행) continue;
    const f = path.join(OUT, '_본문', key(n), e.현행 + '.json.gz'); if (!fs.existsSync(f)) continue;
    for (const a of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')).조) for (const id of a.그림) {
      const c = items.filter(x => x.법령 === key(n) && x.조 === a.조 && x.그림.includes(id));
      pics.push({ id, 법령: key(n), 판: e.현행, 조: a.조, url: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=' + id, 글자상자: !!boxOf(a, id), 보정: c.map(x => x.상태) });
    }
  }
  pics.sort((p, q) => (p.글자상자 - q.글자상자) || p.법령.localeCompare(q.법령));
  if (!DRY) {
    fs.mkdirSync(path.join(OUT, '_감시'), { recursive: true }); fs.mkdirSync(path.join(OUT, '_산식보정'), { recursive: true });
    fs.writeFileSync(path.join(OUT, '_감시', '감시목록_법령.json'), JSON.stringify({ 설명: '법령 개정 감시 목록 — 주인 법령 세션(tools/law-build.js가 만듦). EnvWatch가 밤마다 읽는다.', 항목: watch }, null, 1));
    fs.writeFileSync(path.join(OUT, '_산식보정', '그림목록.json'), JSON.stringify({ 설명: 'Vision 판독 대상 법령 그림 산식(글자상자 없는 것 먼저). 판독 결과는 같은 폴더 Vision판독.json', 만든때: idx.만든때, 항목: pics }, null, 1));
  }
  console.log('감시목록_법령', watch.length, '· 그림목록', pics.length, '(글자상자 없음 ' + pics.filter(p => !p.글자상자).length + ')');
  if (!DRY) {
    fs.mkdirSync(path.dirname(idxPath), { recursive: true }); fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
    fs.mkdirSync(path.dirname(corrPath), { recursive: true }); fs.writeFileSync(corrPath, JSON.stringify(corrDoc, null, 1));
  }
  report.forEach(r => console.log(r));
  console.log('산식 보정', items.length, JSON.stringify(cnt));
  console.log(DRY ? '(시험 — 저장 안 함)' : '저장: ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
