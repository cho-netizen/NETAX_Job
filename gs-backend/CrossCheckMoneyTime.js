// =========================================================
// [2026.10.18 교차검증 2번] 돈 맞대기(cxMoneyLinks_)·시간 순서 모순(cxTimeOrder_)
//  세무사님 원칙: "상호 물리고 물리는 데이터를, 입수한 파일이나 시간에 우선순위를 두지 말고 정확성에 우선을 두고 교차검증."
//  재료는 cpFacts_(c)가 내는 사실 배열(모양: netax-inventory/maps/사실종류_낱말표.md). 두 함수 모두 순수 함수 — Drive·시트·AI를 쓰지 않는다.
//  공통 원칙
//   - read.conf "불확실"(공통 뽑기)은 판정에 쓰지 않는다(뜻이 애매한 값으로 연결·모순을 만들지 않게).
//   - 같은 서류의 사본(같은 서류 종류·같은 값)은 근거 하나로 센다(파일만 다른 같은 서류가 연결·모순을 부풀리지 않게).
//   - 특정 사건·서류에 맞춘 규칙은 두지 않는다. 금액·날짜·열쇠(자산·계좌·사람)·서류 종류 이름만 본다.
// =========================================================

// [2026.10.18 교차검증 2번] 기준값 — 연결 날짜 폭, 어긋남 판정 폭, 보고 하한(작은 돈은 우연히 같은 경우가 많아 잡음만 늘어남)
var CXMT_LINK_DAYS_ = 10;        // 금액이 같고 날짜가 이 안이면 "연결"
var CXMT_FAR_DAYS_ = 60;         // 금액이 같고 날짜가 10일 넘게 ~ 이 안이면 "어긋남"(그보다 멀면 다른 돈으로 봄)
var CXMT_NEAR_DAYS_ = 3;         // 금액이 1% 안으로 조금 다를 때 "날짜가 같다"고 볼 폭
var CXMT_NEAR_RATE_ = 0.01;      // 금액 차이 1% 안
var CXMT_MIN_LINK_ = 50000;      // 이보다 작은 돈은 맞대지 않음
var CXMT_MIN_MISMATCH_ = 1000000;// 어긋남은 100만 원 이상만
var CXMT_MIN_UNLINKED_ = 10000000; // 짝 없음은 1천만 원 이상만

// ---------- 작은 도구 ----------
// [2026.10.18 교차검증 2번] 확실한 사실만(공통 뽑기 "불확실"은 판정 재료에서 뺀다)
function cxmtSure_(f) { return !!f && !(f.read && f.read.conf === '불확실') && !f._copy; } // [2026.10.19] 사본(_copy, 3번 사본 표시)은 돈·시간 맞대기에서 뺌 — 같은 돈·같은 날을 두 번 세지 않게
function cxmtDate_(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v == null ? '' : v).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return m[0];
}
function cxmtDays_(a, b) { // b − a (일)
  const pa = a.split('-'), pb = b.split('-');
  return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
}
function cxmtNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v == null ? '' : v).replace(/[\s,원]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}
function cxmtWon_(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'; }
// 사실 요약(보고용) — {kind, value, file, docType, where}
function cxmtSum_(f) {
  if (!f) return null;
  const s = f.src || {};
  return { kind: f.kind, value: f.value, file: s.file || '', docType: s.docType || '', where: (s.part ? s.part + ' · ' : '') + (s.where || '') };
}
// 같은 서류 묶음(파일 + 묶음 구간 + rec 첫 마디) — "같은 계약"·"같은 등기부"
function cxmtRecHead_(rec) { return String(rec || '').split('.')[0]; }
function cxmtFileKey_(f) { const s = f.src || {}; return (s.fileId || s.file || '') + '#' + (s.part || ''); }
function cxmtGroupKey_(f) { return cxmtFileKey_(f) + '#' + cxmtRecHead_((f.src || {}).rec); }
// 자산 열쇠 맞대기 — 같거나, 한쪽에 동호가 없으면 앞부분(지번)만 같아도 같은 자산으로 본다(낱말표 2절)
function cxmtSameAsset_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b) return false;
  if (a === b) return true;
  const pa = a.split('|'), pb = b.split('|');
  if (pa[0] !== pb[0]) return false;
  return !pa[1] || !pb[1];
}
// 이름은 공백만 빼고 그대로 맞댄다 — 한 글자 차이를 같다고 보면 돌림자 형제(박종헌·박종한)를 같은 사람으로 묶게 된다
function cxmtName_(s) { return String(s || '').replace(/\s+/g, ''); }
function cxmtPersonName_(f) { return cxmtName_(String((f.keys && f.keys.person) || '').split('|')[0]); }
// 금융기관 이름 맞대기용 — 조합·은행 표기 차이를 줄인다
function cxmtBank_(s) {
  return String(s || '').replace(/\s+/g, '').replace(/주식회사|\(주\)|㈜/g, '')
    .replace(/농업협동조합/g, '농협').replace(/축산업협동조합/g, '축협').replace(/수산업협동조합/g, '수협')
    .replace(/신용협동조합/g, '신협').replace(/새마을금고/g, '새마을').replace(/^NH/i, '').replace(/은행$/, '');
}
function cxmtSameBank_(a, b) {
  a = cxmtBank_(a); b = cxmtBank_(b);
  if (!a || !b || a === '은행?' || b === '은행?') return false;
  return a === b || (a.length >= 2 && b.indexOf(a) !== -1) || (b.length >= 2 && a.indexOf(b) !== -1);
}

// ---------- 1. 돈 맞대기 ----------
// [2026.10.18 교차검증 2번] 통장 쪽 한 줄 — 통장 거래 줄 + 송금·이체 확인증의 금액. 금액은 절대값(대금은 납세자가 낸 쪽인지 받은 쪽인지 사실만으로 정할 수 없어 방향은 설명에만)
function cxmtBankLines_(facts) {
  const out = [], seen = {};
  facts.forEach(function (f) {
    if (!cxmtSure_(f)) return;
    const s = f.src || {};
    let amt = null, date = null, dir = '', bal = '', tm = '';
    if (f.kind === '통장 거래' && f.value && typeof f.value === 'object') {
      const v = f.value, o = cxmtNum_(v.출금액), i = cxmtNum_(v.입금액), g = cxmtNum_(v.금액);
      if (o) { amt = Math.abs(o); dir = '출금'; }
      else if (i) { amt = Math.abs(i); dir = '입금'; }
      else if (g) { amt = Math.abs(g); dir = v.입금 === true ? '입금' : (g < 0 ? '출금' : ''); }
      date = cxmtDate_(v.날짜) || cxmtDate_(f.keys && f.keys.date);
      bal = v.잔액 == null ? '' : String(v.잔액); tm = String(v.시각 || '').slice(0, 5);
    } else if (/^(금액|합계|지급액)$/.test(f.kind) && /송금|이체|입금\s*확인|출금\s*확인/.test(s.docType || '')) {
      amt = cxmtNum_(f.value); amt = amt == null ? null : Math.abs(amt);
      date = cxmtDate_(f.keys && f.keys.date); dir = '송금';
    } else return;
    if (!amt || amt < CXMT_MIN_LINK_ || !date) return;
    // 같은 거래가 여러 사본(같은 통장 내역 두 파일, 같은 이체확인증 여러 장)에 나오면 한 줄로 — 날짜·금액·잔액·시각이 같으면 사본
    const key = date + '|' + amt + '|' + bal + '|' + tm + '|' + dir;
    if (seen[key]) { seen[key].files[cxmtFileKey_(f)] = 1; return; }
    const line = { f: f, amt: amt, date: date, dir: dir, files: {}, used: false };
    line.files[cxmtFileKey_(f)] = 1;
    seen[key] = line; out.push(line);
  });
  return out;
}
// [2026.10.18 교차검증 2번] 계약서 대금(계약금·중도금·잔금·대금 회차, 일시 지급이면 매매대금·보증금) — 같은 계약(파일+rec 첫 마디) 안의 날짜 칸으로 회차 날짜를 정한다
function cxmtContractPays_(facts) {
  const groups = {};
  facts.forEach(function (f) {
    if (!cxmtSure_(f)) return;
    const dt = String((f.src && f.src.docType) || '');
    if (!/계약서/.test(dt) || /증여계약|위임/.test(dt)) return;
    const k = cxmtGroupKey_(f);
    (groups[k] = groups[k] || []).push(f);
  });
  const out = [];
  Object.keys(groups).forEach(function (k) {
    const G = groups[k];
    const first = function (kind) { const f = G.filter(function (x) { return x.kind === kind && cxmtDate_(x.value); })[0]; return f ? cxmtDate_(f.value) : null; };
    const cDate = first('계약일'), bDate = first('잔금일') || first('시작일');
    const midDates = G.filter(function (x) { return x.kind === '중도금일' && cxmtDate_(x.value); }).map(function (x) { return cxmtDate_(x.value); });
    const midNums = G.filter(function (x) { return x.kind === '중도금' && cxmtNum_(x.value) != null; });
    const hasPart = G.some(function (x) { return /^(계약금|중도금|잔금|대금 회차)$/.test(x.kind); });
    G.forEach(function (f) {
      let amt = null, date = null, how = '';
      if (f.kind === '계약금') { amt = cxmtNum_(f.value); date = cDate || cxmtDate_(f.keys && f.keys.date); how = '계약금(계약일)'; }
      else if (f.kind === '잔금') { amt = cxmtNum_(f.value); date = bDate; how = '잔금(잔금일)'; }
      else if (f.kind === '중도금' && f.value && typeof f.value === 'object') { amt = cxmtNum_(f.value.금액); date = cxmtDate_(f.value.날짜) || cxmtDate_(f.value.약정일); how = '중도금 줄'; }
      else if (f.kind === '중도금') {
        amt = cxmtNum_(f.value); how = '중도금';
        // 중도금이 하나고 중도금일도 하나면 짝, 여럿이면 순서대로 짝(수가 다르면 날짜 모름 — 계약일~잔금일 사이로 찾음)
        if (midDates.length === midNums.length) date = midDates[midNums.indexOf(f)] || null;
      }
      else if (f.kind === '대금 회차' && f.value && typeof f.value === 'object') { amt = cxmtNum_(f.value.금액); date = cxmtDate_(f.value.납부일) || cxmtDate_(f.value.약정일); how = '대금 ' + (f.value.차수 || '') + '회차'; }
      // 날짜 칸이 하나도 없는 덩어리(현황표의 보증금 합계 등)는 지급 한 건으로 보지 않음
      else if ((f.kind === '매매대금' || f.kind === '임대 보증금') && !hasPart && bDate) { amt = cxmtNum_(f.value); date = bDate; how = f.kind + '(일시 지급 — 잔금일)'; }
      else return;
      if (!amt || amt < CXMT_MIN_LINK_) return;
      out.push({ f: f, amt: Math.abs(amt), date: date, win: (!date && cDate && bDate) ? [cDate, bDate] : null, how: how, type: '대금' });
    });
  });
  return out;
}
// [2026.10.18 교차검증 2번] 영수증·정산서·세금 영수증·납부서의 합계·지급액·금액. 견적서(지급 증빙 아님)·잔액증명·부채증명·통장·계약서·등기·대장 등은 뺀다
var CXMT_RECEIPT_NOT_ = /견적|잔액|잔고|증명원|부채|대출|통장|거래내역|이체|송금|입금\s*확인|계약서|등기|대장|공시|감정|평가|신고서|증권|조회|현황/;
function cxmtReceipts_(facts) {
  const out = [];
  facts.forEach(function (f) {
    if (!cxmtSure_(f) || !/^(합계|지급액|금액|청구금액|정산금액)$/.test(f.kind)) return;
    const dt = String((f.src && f.src.docType) || '');
    if (!dt || CXMT_RECEIPT_NOT_.test(dt)) return;
    const amt = cxmtNum_(f.value);
    if (!amt || Math.abs(amt) < CXMT_MIN_LINK_) return;
    out.push({ f: f, amt: Math.abs(amt), date: cxmtDate_(f.keys && f.keys.date), win: null, how: dt + ' ' + f.kind, type: '영수증' });
  });
  return out;
}
// 사본 묶기 — 같은 서류 종류·같은 금액·같은 날짜는 근거 하나(대금은 회차 이름까지 같아야)
function cxmtDedupPays_(items) {
  const seen = {}, out = [];
  items.forEach(function (p) {
    const key = p.type + '|' + ((p.f.src && p.f.src.docType) || '') + '|' + (p.type === '대금' ? p.f.kind : '') + '|' + p.amt + '|' + (p.date || (p.win ? p.win.join('~') : ''));
    if (seen[key]) { seen[key].files[cxmtFileKey_(p.f)] = 1; seen[key].copies++; return; }
    p.files = {}; p.files[cxmtFileKey_(p.f)] = 1; p.copies = 1;
    seen[key] = p; out.push(p);
  });
  return out;
}
function cxmtOtherDoc_(p, b) { return !Object.keys(p.files).some(function (k) { return b.files[k]; }); }
function cxmtChk_(f) { return f.read && f.read.check === '불일치' ? ' (서류 안 검산 불일치: ' + (f.read.checkNote || '') + ')' : ''; }

function cxMoneyLinks_(facts, ctx) {
  facts = Array.isArray(facts) ? facts : [];
  ctx = ctx || {};
  const res = { groups: 0, linked: [], mismatch: [], unlinked: [], info: [] };
  const bank = cxmtBankLines_(facts);
  const pays = cxmtDedupPays_(cxmtContractPays_(facts).concat(cxmtReceipts_(facts)));
  res.groups = pays.length;
  res.noBank = !bank.length; // [밤 24바퀴] 통장 자료가 없으면 회차마다 '짝 없는 돈'이 아니라 '통장 없음' 한 줄(5번 AI 자리 줄이기 ①)

  // (1) 날짜가 있는 돈 — 모든 (돈, 통장 줄) 짝 중 날짜 차이가 작은 것부터 하나씩 묶는다(같은 날 같은 금액 여러 줄이면 한 줄만 쓰임)
  const pairs = [];
  pays.forEach(function (p, pi) {
    bank.forEach(function (b, bi) {
      if (b.amt !== p.amt || !cxmtOtherDoc_(p, b)) return;
      let d = null;
      if (p.date) d = Math.abs(cxmtDays_(p.date, b.date));
      else if (p.win && b.date >= p.win[0] && b.date <= p.win[1]) d = 0;
      if (d != null && d <= CXMT_LINK_DAYS_) pairs.push({ pi: pi, bi: bi, d: d });
    });
  });
  pairs.sort(function (x, y) { return x.d - y.d || y.pi - x.pi; });
  pairs.forEach(function (x) {
    const p = pays[x.pi], b = bank[x.bi];
    if (p.done || b.used) return;
    p.done = true; b.used = true;
    const why = p.win ? '금액 ' + cxmtWon_(p.amt) + ' 같음, 날짜 칸이 없어 계약일~잔금일(' + p.win.join('~') + ') 사이 통장 ' + (b.dir || '') + ' ' + b.date
      : '금액 ' + cxmtWon_(p.amt) + ' 같음, 날짜 ' + (x.d === 0 ? '같은 날' : x.d + '일 차이') + '(' + p.date + ' ↔ 통장 ' + (b.dir || '') + ' ' + b.date + ')';
    res.linked.push({ a: cxmtSum_(p.f), b: cxmtSum_(b.f), why: p.how + ' ↔ 통장 — ' + why + (p.copies > 1 ? ' · 사본 ' + p.copies + '건' : '') + cxmtChk_(p.f) });
  });
  // (2) 날짜 없는 영수증 — 그 금액의 통장 줄이 딱 하나이고 끝자리가 둥글지 않을 때만(둥근 금액은 우연히 같기 쉬움)
  pays.forEach(function (p) {
    if (p.done || p.date || p.win) return;
    const c = bank.filter(function (b) { return !b.used && b.amt === p.amt && cxmtOtherDoc_(p, b); });
    if (c.length === 1 && p.amt % 100000 !== 0) {
      p.done = true; c[0].used = true;
      res.linked.push({ a: cxmtSum_(p.f), b: cxmtSum_(c[0].f), why: p.how + ' ↔ 통장 — 서류에 날짜가 없어 금액(' + cxmtWon_(p.amt) + ')만으로 맞댐, 그 금액 통장 줄이 하나뿐(' + c[0].date + ')' });
    }
  });
  // (2-b) [2026.10.19 밤 2바퀴 돈 축] 나눠 낸 돈 — 대금 한 회차를 통장 여러 줄로 나눠 보낸 경우(이체 한도·여러 계좌). 아직 안 묶인 큰 돈(1천만 원 이상)마다
  //  날짜 범위(날짜 ±10일, 날짜 칸 없으면 계약일~잔금일) 안의 남은 통장 줄 2~4개의 합이 정확히 같으면 "나눠 냄"으로 묶는다.
  //  같은 방향(입금·출금 중 한쪽)만, 후보 줄이 많으면(12줄 초과) 우연한 합이 생기기 쉬워 하지 않는다
  pays.forEach(function (p) {
    if (p.done || p.amt < CXMT_MIN_UNLINKED_) return;
    const inWin = function (b) { return p.date ? Math.abs(cxmtDays_(p.date, b.date)) <= CXMT_LINK_DAYS_ : p.win ? (b.date >= p.win[0] && b.date <= p.win[1]) : false; };
    const cand = bank.filter(function (b) { return !b.used && b.amt < p.amt && inWin(b) && cxmtOtherDoc_(p, b); });
    if (cand.length < 2 || cand.length > 12) return;
    let found = null;
    const pick = function (start, left, chosen) {
      if (found) return;
      if (left === 0 && chosen.length >= 2) { const dirs = {}; chosen.forEach(function (b) { dirs[b.dir || ''] = 1; }); if (Object.keys(dirs).length === 1) found = chosen.slice(); return; }
      if (chosen.length >= 4 || left <= 0) return;
      for (let i = start; i < cand.length; i++) { if (cand[i].amt <= left) { chosen.push(cand[i]); pick(i + 1, left - cand[i].amt, chosen); chosen.pop(); if (found) return; } }
    };
    pick(0, p.amt, []);
    if (!found) return;
    p.done = true; found.forEach(function (b) { b.used = true; });
    res.linked.push({ a: cxmtSum_(p.f), b: cxmtSum_(found[0].f), split: found.map(function (b) { return cxmtSum_(b.f); }), why: p.how + ' ↔ 통장 ' + found.length + '줄 나눠 냄 — ' + found.map(function (b) { return b.date + ' ' + cxmtWon_(b.amt); }).join(' + ') + ' = ' + cxmtWon_(p.amt) + cxmtChk_(p.f) });
  });
  // (3) 못 묶인 돈 — 어긋남(금액 같고 날짜 멂 / 날짜 같고 금액 1% 안 차이) 또는 짝 없음
  pays.forEach(function (p) {
    if (p.done) return;
    let mm = null;
    if (p.amt >= CXMT_MIN_MISMATCH_ && p.date) {
      bank.forEach(function (b) {
        if (b.used || !cxmtOtherDoc_(p, b)) return;
        const d = Math.abs(cxmtDays_(p.date, b.date));
        if (b.amt === p.amt && d > CXMT_LINK_DAYS_ && d <= CXMT_FAR_DAYS_) {
          if (!mm || mm.score > d) mm = { b: b, score: d, why: '금액 ' + cxmtWon_(p.amt) + '은 같은데 날짜가 ' + d + '일 차이(' + p.date + ' ↔ 통장 ' + b.date + ')' };
        } else if (b.amt !== p.amt && d <= CXMT_NEAR_DAYS_ && Math.abs(b.amt - p.amt) <= p.amt * CXMT_NEAR_RATE_) {
          const sc = Math.abs(b.amt - p.amt) / p.amt * 100 + d; // 같은 날·작은 차이 우선
          if (!mm || mm.score > sc) mm = { b: b, score: sc, why: '날짜는 ' + (d === 0 ? '같은 날' : d + '일 차이') + '인데 금액이 ' + cxmtWon_(Math.abs(b.amt - p.amt)) + ' 다름(' + cxmtWon_(p.amt) + ' ↔ 통장 ' + cxmtWon_(b.amt) + ')' };
        }
      });
    }
    if (mm) { mm.b.used = true; res.mismatch.push({ a: cxmtSum_(p.f), b: cxmtSum_(mm.b.f), why: p.how + ' ↔ 통장 — ' + mm.why + cxmtChk_(p.f) }); return; }
    if (p.amt >= CXMT_MIN_UNLINKED_) {
      res.unlinked.push({ f: cxmtSum_(p.f), why: p.how + ' ' + cxmtWon_(p.amt) + (p.date ? '(' + p.date + ')' : p.win ? '(날짜 칸 없음, ' + p.win.join('~') + ')' : '(날짜 없음)') + ' — ' + (bank.length ? '통장 자료에 같은 금액이 ±' + CXMT_LINK_DAYS_ + '일 안에 없음' : '사건에 통장 거래 자료가 없음') + cxmtChk_(p.f) });
    }
  });

  // (4) 등기 전세금 ↔ 임대차 보증금 — 같은 자산일 때만. 금액 같으면 연결, 1% 안 차이면 어긋남
  const jeonse = facts.filter(function (f) { return cxmtSure_(f) && f.kind === '전세금' && cxmtNum_(f.value) && f.keys && f.keys.asset; });
  const deposits = facts.filter(function (f) { return cxmtSure_(f) && f.kind === '임대 보증금' && cxmtNum_(f.value) && f.keys && f.keys.asset; });
  const seenJ = {};
  jeonse.forEach(function (j) {
    const ja = cxmtNum_(j.value);
    deposits.forEach(function (d) {
      if (!cxmtSameAsset_(j.keys.asset, d.keys.asset)) return;
      const da = cxmtNum_(d.value), k = ja + '|' + da + '|' + j.keys.asset + '|' + ((d.src && d.src.docType) || '');
      if (seenJ[k]) return;
      if (da === ja) { seenJ[k] = 1; res.linked.push({ a: cxmtSum_(d), b: cxmtSum_(j), why: '임대차 보증금 = 등기 전세금 ' + cxmtWon_(ja) + '(같은 자산 ' + j.keys.asset + ')' }); }
      else if (Math.abs(da - ja) <= ja * CXMT_NEAR_RATE_) { seenJ[k] = 1; res.mismatch.push({ a: cxmtSum_(d), b: cxmtSum_(j), why: '같은 자산의 임대차 보증금 ' + cxmtWon_(da) + '과 등기 전세금 ' + cxmtWon_(ja) + '이 조금 다름' }); }
    });
  });

  // (5) 근저당 채권최고액 ↔ 대출 원금·잔액·부채증명 잔액 — 같은 금융기관(근저당권자 ↔ 대출 서류 기관·계좌 열쇠)일 때만, 정보로만
  //  채권최고액은 원금의 120~130%로 잡는 것이 보통이라 금액이 다르다고 어긋남으로 세지 않는다
  const mort = facts.filter(function (f) { return cxmtSure_(f) && f.kind === '근저당 채권최고액' && cxmtNum_(f.value); });
  const loanDocs = {};
  facts.forEach(function (f) {
    if (!cxmtSure_(f)) return;
    const dt = String((f.src && f.src.docType) || '');
    const isLoanAmt = /^(대출 원금|대출 잔액)$/.test(f.kind) || (f.kind === '잔액' && /부채|대출/.test(dt));
    const fk = cxmtFileKey_(f);
    if (isLoanAmt && cxmtNum_(f.value)) { (loanDocs[fk] = loanDocs[fk] || { amts: [], banks: [] }).amts.push(f); if (f.keys && f.keys.account) loanDocs[fk].banks.push(String(f.keys.account).split('|')[0]); }
    if (/부채|대출/.test(dt) && (f.kind === '은행' || /^기타:(기관|금융기관|대출기관|채권자)$/.test(f.kind) || (f.kind === '성명' && /채권자|대표자|기관/.test(f.role || ''))) && typeof f.value === 'string') {
      (loanDocs[fk] = loanDocs[fk] || { amts: [], banks: [] }).banks.push(f.value);
    }
  });
  const seenL = {};
  mort.forEach(function (m) {
    const head = cxmtGroupKey_(m) + '|' + (m.src.rec || '');
    const creditors = facts.filter(function (f) { return cxmtSure_(f) && f.kind === '성명' && f.role === '권리자' && cxmtFileKey_(f) === cxmtFileKey_(m) && String((f.src && f.src.rec) || '') === String(m.src.rec || ''); }).map(function (f) { return f.value; });
    if (!creditors.length) return;
    Object.keys(loanDocs).forEach(function (fk) {
      const L = loanDocs[fk];
      if (!L.amts.length || !L.banks.some(function (b) { return creditors.some(function (c) { return cxmtSameBank_(b, c); }); })) return;
      L.amts.forEach(function (a) {
        const mv = cxmtNum_(m.value), av = cxmtNum_(a.value), k = head + '|' + av;
        if (seenL[k]) return; seenL[k] = 1;
        const r = av ? mv / av : 0;
        res.info.push({ a: cxmtSum_(m), b: cxmtSum_(a), why: '같은 금융기관(' + creditors[0] + ') — 채권최고액 ' + cxmtWon_(mv) + ' / ' + a.kind + ' ' + cxmtWon_(av) + ' = ' + r.toFixed(2) + '배' + (r >= 1.1 && r <= 1.4 ? '(채권최고액은 보통 원금의 120~130%)' : r < 1 ? '(잔액이 채권최고액보다 큼 — 다른 대출이 섞였을 수 있음)' : '(상환으로 잔액이 줄었거나 다른 대출일 수 있음)') });
      });
    });
  });
  return res;
}

// ---------- 2. 시간 순서 모순 ----------
// [2026.10.18 교차검증 2번] 등기부 소유권 줄 묶기 — 파일+rec 첫 마디(docsN) 안의 "소유권이력M" 줄마다 순위·목적·원인·접수일·원인일·권리자
function cxmtOwnerLines_(facts) {
  const regs = {};
  facts.forEach(function (f) {
    if (!cxmtSure_(f) || (f.src && f.src.docType) !== '등기부') return;
    const rec = String((f.src && f.src.rec) || ''), m = /^([^.]*)\.소유권이력(\d+)(\.|$)/.exec(rec);
    if (!m) return;
    const rk = cxmtFileKey_(f) + '#' + m[1], lk = m[2];
    const R = regs[rk] = regs[rk] || { lines: {}, docType: f.src.docType };
    const L = R.lines[lk] = R.lines[lk] || { owners: [], facts: {}, asset: '' };
    if (f.keys && f.keys.asset && !L.asset) L.asset = f.keys.asset;
    if (f.kind === '성명' && f.role === '권리자') L.owners.push(cxmtName_(f.value));
    else if (!L.facts[f.kind]) L.facts[f.kind] = f;
  });
  return Object.keys(regs).map(function (rk) {
    const R = regs[rk];
    const lines = Object.keys(R.lines).map(function (lk) {
      const L = R.lines[lk], F = L.facts;
      const rank = F['등기 순위'] ? cxmtNum_(F['등기 순위'].value) : null;
      return { no: +lk, rank: rank, recv: F['접수일'] ? cxmtDate_(F['접수일'].value) : null, cause: F['원인일'] ? cxmtDate_(F['원인일'].value) : null,
        why: F['등기 원인'] ? String(F['등기 원인'].value) : '', aim: F['등기 목적'] ? String(F['등기 목적'].value) : '',
        owners: L.owners, asset: L.asset, F: F };
    }).filter(function (l) { return l.rank != null && Math.floor(l.rank) === l.rank; }) // "1-1" 같은 부기 줄은 순서 비교에서 뺌
      .sort(function (a, b) { return a.rank - b.rank || a.no - b.no; });
    const asset = (lines.filter(function (l) { return l.asset; })[0] || {}).asset || '';
    return { key: rk, lines: lines, asset: asset };
  });
}

// [2026.10.18 교차검증 2번] 소유권 줄의 넘겨준 사람 — 목적 "1번박준영지분전부이전"이면 박준영, 아니면 앞 줄 권리자가 한 사람일 때 그 사람
function cxmtTransferor_(l, prevL) {
  const m = /\d+번\s*([가-힣A-Za-z()]{2,20}?)\s*지분/.exec(l.aim || '');
  if (m) return cxmtName_(m[1]);
  return prevL && prevL.owners.length === 1 ? prevL.owners[0] : '';
}

function cxTimeOrder_(facts, ctx) {
  facts = Array.isArray(facts) ? facts : [];
  ctx = ctx || {};
  const tax = String(ctx.세목 || '');
  const isInh = /inherit|상속/.test(tax), isGift = /gift|증여/.test(tax), isTr = /transfer|양도/.test(tax);
  const payer = cxmtName_(ctx.납세자);
  const base = cxmtDate_(ctx.기준일);
  const res = { checks: 0, ok: 0, contradictions: [] };
  const seenCheck = {}, seenBad = {};
  const sure = facts.filter(cxmtSure_);
  // 비교 한 번 — 사본(같은 서류 종류·같은 값)은 한 번만 센다
  function check(what, fa, fb, okCond, why) {
    if (!fa || !fb) return;
    const key = what + '|' + ((fa.src && fa.src.docType) || '') + '|' + JSON.stringify(fa.value) + '|' + ((fb.src && fb.src.docType) || '') + '|' + JSON.stringify(fb.value);
    if (seenCheck[key]) return; seenCheck[key] = 1;
    res.checks++;
    if (ctx.자세히) (res.checked = res.checked || []).push({ what: what, a: fa.value, b: fb.value, ok: !!okCond }); // 점검용 — 무엇을 맞대 봤는지
    if (okCond) { res.ok++; return; }
    if (seenBad[key]) return; seenBad[key] = 1;
    res.contradictions.push({ what: what, a: cxmtSum_(fa), b: cxmtSum_(fb), why: why });
  }
  function dv(f) { if (!f) return null; return cxmtDate_(f.value && typeof f.value === 'object' ? (f.value.날짜 || f.value.납부일 || f.value.약정일) : f.value); }

  // (1) 같은 계약: 계약일 ≤ 중도금일 ≤ 잔금일, 대금 회차 날짜 순서, 임대 시작일 ≤ 종료일
  const cg = {};
  sure.forEach(function (f) {
    const dt = String((f.src && f.src.docType) || '');
    if (!/계약서/.test(dt)) return;
    if (!/^(계약일|중도금일|중도금|잔금일|대금 회차|시작일|종료일)$/.test(f.kind)) return;
    (cg[cxmtGroupKey_(f)] = cg[cxmtGroupKey_(f)] || []).push(f);
  });
  Object.keys(cg).forEach(function (k) {
    const G = cg[k], pick = function (kind) { return G.filter(function (f) { return f.kind === kind && dv(f); }); };
    const c = pick('계약일')[0], b = pick('잔금일')[0];
    const mids = pick('중도금일').concat(G.filter(function (f) { return f.kind === '중도금' && f.value && typeof f.value === 'object' && dv(f); }));
    const rounds = G.filter(function (f) { return f.kind === '대금 회차' && f.value && typeof f.value === 'object' && dv(f); })
      .sort(function (x, y) { return (cxmtNum_(x.value.차수) || 0) - (cxmtNum_(y.value.차수) || 0); });
    if (c && b) check('계약일 > 잔금일', c, b, dv(c) <= dv(b), '같은 계약의 계약일 ' + dv(c) + '이 잔금일 ' + dv(b) + '보다 뒤');
    mids.forEach(function (m) {
      if (c) check('계약일 > 중도금 날짜', c, m, dv(c) <= dv(m), '같은 계약의 계약일 ' + dv(c) + '이 중도금 날짜 ' + dv(m) + '보다 뒤');
      if (b) check('중도금 날짜 > 잔금일', m, b, dv(m) <= dv(b), '같은 계약의 중도금 날짜 ' + dv(m) + '이 잔금일 ' + dv(b) + '보다 뒤');
    });
    for (let i = 1; i < rounds.length; i++) check('대금 회차 순서 뒤집힘', rounds[i - 1], rounds[i], dv(rounds[i - 1]) <= dv(rounds[i]), (rounds[i - 1].value.차수 || '앞') + '회차 ' + dv(rounds[i - 1]) + '이 ' + (rounds[i].value.차수 || '뒤') + '회차 ' + dv(rounds[i]) + '보다 뒤');
    if (c && rounds.length) check('계약일 > 첫 회차', c, rounds[0], dv(c) <= dv(rounds[0]), '계약일 ' + dv(c) + '이 첫 회차 ' + dv(rounds[0]) + '보다 뒤');
    const s = pick('시작일')[0], e = pick('종료일')[0];
    if (s && e) check('임대 시작일 > 종료일', s, e, dv(s) <= dv(e), '임대 시작일 ' + dv(s) + '이 종료일 ' + dv(e) + '보다 뒤');
  });

  // (2) 같은 등기부 소유권 줄: 순위가 커지는데 접수일이 거꾸로 / 한 줄 안에서 원인일 > 접수일
  const regs = cxmtOwnerLines_(facts);
  regs.forEach(function (R) {
    let prev = null;
    R.lines.forEach(function (l) {
      if (l.cause && l.recv) check('등기 원인일 > 접수일', l.F['원인일'], l.F['접수일'], l.cause <= l.recv, '등기 ' + l.rank + '번 줄(' + (l.why || l.aim) + ')의 원인일 ' + l.cause + '이 접수일 ' + l.recv + '보다 뒤');
      if (!l.recv) return;
      if (prev) check('등기 순위·접수일 뒤집힘', prev.F['접수일'], l.F['접수일'], prev.recv <= l.recv, '소유권 ' + prev.rank + '번(' + prev.recv + ') 다음 ' + l.rank + '번 접수일이 ' + l.recv + '로 앞섬');
      prev = l;
    });
  });

  // (3) 같은 자산: 납세자의 취득(등기 접수일·취득일·취득 계약 잔금일)이 양도(다음 소유자 등기 접수일·양도일·양도 계약 잔금일)보다 뒤
  if (payer) {
    const acq = [], sale = []; // {asset, date, f, what}
    regs.forEach(function (R) {
      R.lines.forEach(function (l, i) {
        if (!l.recv || l.owners.indexOf(payer) === -1) return;
        acq.push({ asset: l.asset || R.asset, date: l.recv, f: l.F['접수일'], what: '취득 등기 접수일' });
        // 납세자가 넘긴 줄 찾기 — 목적에 넘긴 사람 이름("N번<이름>지분…")이 있으면 그 이름이 납세자일 때만,
        //  이름이 없으면 납세자 단독 소유 줄 바로 다음의 이전 줄만(공유 지분이면 누구 지분이 넘어갔는지 모름 — 박준영 지분 상속을 납세자 양도로 잘못 보던 것 막음)
        let nx = null;
        for (let j = i + 1; j < R.lines.length && !nx; j++) {
          const n = R.lines[j];
          if (!n.recv || !/이전/.test(n.aim + n.why)) continue;
          const t = /\d+번\s*([가-힣A-Za-z()]{2,20}?)\s*지분/.exec(n.aim || '');
          if (t) { if (cxmtName_(t[1]) === payer) nx = n; continue; }
          if (l.owners.length === 1 && n.owners.indexOf(payer) === -1) nx = n;
          break;
        }
        if (nx) sale.push({ asset: nx.asset || R.asset, date: nx.recv, f: nx.F['접수일'], what: '양도 등기 접수일(다음 소유자)' });
      });
    });
    sure.forEach(function (f) {
      if (!f.keys || !f.keys.asset || !cxmtDate_(f.value)) return;
      if (f.kind === '취득일') acq.push({ asset: f.keys.asset, date: cxmtDate_(f.value), f: f, what: '취득일' });
      if (f.kind === '양도일') sale.push({ asset: f.keys.asset, date: cxmtDate_(f.value), f: f, what: '양도일' });
    });
    // 매매·분양 계약서: 확실한 역할(매도인·매수인)이 납세자면 그 쪽으로. 역할을 모르는 양도 사건에서는 같은 자산 계약이 둘 이상일 때 계약일이 가장 늦은 것을 양도, 나머지를 취득으로 본다
    const ctr = {};
    sure.forEach(function (f) {
      if (!/매매계약|분양|공급계약/.test(String((f.src && f.src.docType) || ''))) return;
      const g = cxmtGroupKey_(f);
      const C = ctr[g] = ctr[g] || { c: null, b: null, asset: '', role: '' };
      if (f.kind === '계약일' && cxmtDate_(f.value)) C.c = f;
      if (f.kind === '잔금일' && cxmtDate_(f.value)) C.b = f;
      if (f.keys && f.keys.asset && !C.asset) C.asset = f.keys.asset;
      if (f.kind === '성명' && cxmtName_(f.value) === payer) { if (/매도|양도인/.test(f.role || '')) C.role = '매도'; else if (/매수|양수|수분양/.test(f.role || '')) C.role = '매수'; }
    });
    const byAsset = {};
    Object.keys(ctr).forEach(function (g) {
      const C = ctr[g];
      if (!C.b || !C.asset) return;
      if (C.role === '매도') sale.push({ asset: C.asset, date: cxmtDate_(C.b.value), f: C.b, what: '양도 계약 잔금일' });
      else if (C.role === '매수') acq.push({ asset: C.asset, date: cxmtDate_(C.b.value), f: C.b, what: '취득 계약 잔금일' });
      else if (isTr && C.c) (byAsset[C.asset.split('|')[0]] = byAsset[C.asset.split('|')[0]] || []).push(C);
    });
    Object.keys(byAsset).forEach(function (a) {
      // 사본(계약일·잔금일이 같은 계약)은 하나로
      const uniq = {}, L = [];
      byAsset[a].forEach(function (C) { const k = dv(C.c) + '|' + dv(C.b); if (!uniq[k]) { uniq[k] = 1; L.push(C); } });
      if (L.length < 2) return;
      L.sort(function (x, y) { return dv(x.c) < dv(y.c) ? -1 : 1; });
      const last = L[L.length - 1];
      sale.push({ asset: last.asset, date: dv(last.b), f: last.b, what: '양도 계약 잔금일(계약일이 가장 늦은 계약)' });
      L.slice(0, -1).forEach(function (C) { acq.push({ asset: C.asset, date: dv(C.b), f: C.b, what: '취득 계약 잔금일(앞선 계약)' }); });
    });
    acq.forEach(function (x) {
      sale.forEach(function (y) {
        if (!cxmtSameAsset_(x.asset, y.asset)) return;
        check('취득이 양도보다 뒤', x.f, y.f, x.date <= y.date, '같은 자산(' + x.asset + ')에서 납세자의 ' + x.what + ' ' + x.date + '이 ' + y.what + ' ' + y.date + '보다 뒤');
      });
    });
  }

  // (4) 상속: 피상속인 사망일 — 서류마다 같은지, 사망신고일·분할협의서 작성일·그 사람 재산의 상속 등기와 순서
  const heirNames = {};
  sure.forEach(function (f) { if (f.kind === '성명' && f.role === '피상속인') heirNames[cxmtName_(f.value)] = 1; });
  if (isInh && payer) heirNames[payer] = 1;
  const deaths = sure.filter(function (f) {
    if (!/^(사망일|상속개시일)$/.test(f.kind) || !cxmtDate_(f.value)) return false;
    const n = cxmtPersonName_(f);
    return !n || heirNames[n] || !Object.keys(heirNames).length;
  });
  let D = null, Df = null;
  if (deaths.length) {
    const cnt = {};
    deaths.forEach(function (f) { const v = cxmtDate_(f.value); cnt[v] = (cnt[v] || 0) + 1; });
    D = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); })[0];
    Df = deaths.filter(function (f) { return cxmtDate_(f.value) === D; })[0];
    deaths.forEach(function (f) { if (cxmtDate_(f.value) !== D) check('사망일이 서류마다 다름', Df, f, false, '피상속인 사망일(상속개시일)이 ' + D + '와 ' + cxmtDate_(f.value) + '로 다름'); else check('사망일이 서류마다 다름', Df, f, true, ''); });
  } else if (isInh && base) { D = base; Df = { kind: '기준일(사건)', value: base, src: { docType: '사건 기준일', file: '', where: '사건 기준일' } }; }
  if (D) {
    sure.forEach(function (f) {
      const n = cxmtPersonName_(f);
      if (f.kind === '사망신고일' && cxmtDate_(f.value) && (!n || heirNames[n])) check('사망신고일 < 사망일', Df, f, D <= cxmtDate_(f.value), '사망신고일 ' + cxmtDate_(f.value) + '이 사망일 ' + D + '보다 앞섬');
      if (/분할협의/.test(String((f.src && f.src.docType) || '')) && /^(작성일|날짜|합의일)$/.test(f.kind) && cxmtDate_(f.value)) check('분할협의서 작성일 < 사망일', Df, f, D <= cxmtDate_(f.value), '상속재산분할협의서 ' + f.kind + ' ' + cxmtDate_(f.value) + '이 사망일 ' + D + '보다 앞섬');
    });
    regs.forEach(function (R) {
      R.lines.forEach(function (l, i) {
        if (!/상속/.test(l.why + l.aim) || !l.recv) return;
        // 이 사건 피상속인의 재산인지: 넘겨준 사람이 피상속인이거나, 원인일이 사망일과 같을 때만(다른 사람의 옛 상속 등기와 섞지 않게)
        //  넘겨준 사람 = 목적에 적힌 "N번<이름>지분"의 이름, 없으면 바로 앞 소유권 줄의 권리자(한 사람일 때만 — 공유면 누구 지분인지 모름)
        const from = cxmtTransferor_(l, i > 0 ? R.lines[i - 1] : null);
        const byName = !!(from && heirNames[from]);
        if (!byName && l.cause !== D) return;
        check('상속 등기 접수일 < 사망일', Df, l.F['접수일'], D <= l.recv, '상속 등기(' + l.rank + '번, ' + (l.why || l.aim) + ') 접수일 ' + l.recv + '이 피상속인 사망일 ' + D + '보다 앞섬');
        if (byName && l.cause) check('상속 등기 원인일 ≠ 사망일', Df, l.F['원인일'], l.cause === D, '피상속인 재산의 상속 등기 원인일 ' + l.cause + '이 사망일 ' + D + '과 다름');
      });
    });
  }

  // (5) 증여: 증여 등기 접수일이 증여계약일(·증여일)보다 앞섬 — 같은 자산이고, 권리자가 수증자(납세자)이거나 원인일이 계약일과 같을 때만
  const donees = {};
  sure.forEach(function (f) { if (f.kind === '성명' && f.role === '수증자') donees[cxmtName_(f.value)] = 1; });
  if (isGift && payer) donees[payer] = 1;
  const giftDates = sure.filter(function (f) {
    if (!cxmtDate_(f.value)) return false;
    return f.kind === '증여일' || (f.kind === '계약일' && /증여계약/.test(String((f.src && f.src.docType) || '')));
  });
  if (!giftDates.length && isGift && base) giftDates.push({ kind: '기준일(사건)', value: base, keys: {}, src: { docType: '사건 기준일', file: '', where: '사건 기준일' } });
  giftDates.forEach(function (g) {
    const G = cxmtDate_(g.value), ga = g.keys && g.keys.asset;
    regs.forEach(function (R) {
      R.lines.forEach(function (l) {
        if (!/증여/.test(l.why + l.aim) || !l.recv) return;
        const la = l.asset || R.asset;
        if (ga && la && !cxmtSameAsset_(ga, la)) return;
        if (!ga && !isGift) return;
        const tie = l.owners.some(function (o) { return donees[o]; }) || l.cause === G;
        if (!tie) return;
        check('증여 등기 접수일 < 증여계약일', g, l.F['접수일'], G <= l.recv, '증여 등기(' + l.rank + '번) 접수일 ' + l.recv + '이 ' + g.kind + ' ' + G + '보다 앞섬');
      });
    });
  });

  // (6) 주소이력: 한 사람 초본(파일+묶음 구간+rec 앞마디) 안에서 번호 순서대로 전입 발생일이 거꾸로 / 한 줄의 신고일이 발생일보다 앞섬 / 거주기간 시작 > 끝
  const ag = {};
  sure.forEach(function (f) {
    if (f.kind !== '주소이력' && f.kind !== '거주기간') return;
    if (!f.value || typeof f.value !== 'object') return;
    const rec = String((f.src && f.src.rec) || ''), head = rec.replace(/(^|\.)(주소이력|거주기간)\d+$/, '');
    (ag[cxmtFileKey_(f) + '#' + head] = ag[cxmtFileKey_(f) + '#' + head] || []).push(f);
  });
  Object.keys(ag).forEach(function (k) {
    const L = ag[k];
    const moves = L.filter(function (f) { return f.kind === '주소이력'; });
    // [밤 8바퀴 보완 — 3번 원본 대조] 주소이력 한 줄의 신고일이 발생일보다 앞서는 것은 원본 초본에도 있는 서류상 정상(김창호·방영교 하루, 원본 그대로) — 모순으로 세지 않는다.
    //  거주기간은 법령 기준(소득세법 시행령 §154⑥ 주민등록표상 전입일 ~ 전출일)으로 발생일(전입일)을 쓴다. 신고일은 거주기간 계산에 쓰지 않는다.
    const ins = moves.map(function (f, i) { return { f: f, i: i, n: cxmtNum_(f.value.번호), d: cxmtDate_(f.value.발생일) || cxmtDate_(f.value.신고일) }; })
      .filter(function (x) { return x.d && /전입|전출|재등록|최초/.test(String(x.f.value.사유 || '')); })
      .sort(function (x, y) { return (x.n != null && y.n != null) ? x.n - y.n : x.i - y.i; });
    for (let i = 1; i < ins.length; i++) {
      const a = ins[i - 1], b = ins[i];
      check('주소이력 순서 뒤집힘', a.f, b.f, a.d <= b.d, '주소이력 ' + (a.f.value.번호 || '앞') + '번(' + a.f.value.사유 + ' ' + a.d + ') 다음 ' + (b.f.value.번호 || '뒤') + '번(' + b.f.value.사유 + ')이 ' + b.d + '로 앞섬');
    }
    L.filter(function (f) { return f.kind === '거주기간'; }).forEach(function (f) {
      const s = cxmtDate_(f.value.시작), e = cxmtDate_(f.value.끝);
      if (s && e) check('거주기간 시작 > 끝', f, f, s <= e, '거주기간 시작 ' + s + '이 끝 ' + e + '보다 뒤(' + (f.value.주소 || '') + ')');
    });
  });
  return res;
}
