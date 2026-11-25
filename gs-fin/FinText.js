// ============================================================
// [2026.11.21] 글자(PDF·화면 글자인식) 거래내역 — 머리글 차례대로 줄을 읽는 규칙(토큰 0)
// ------------------------------------------------------------
// 세무사님 11-21 "시간에 구애받지 않고, 모든 경우의 수를 예상하여 어떤 상황에서도 오류없이 합쳐서 분석가능한 파일로 확보하는 것을 완수하라"
// 왜: 은행이 만든 PDF(국민 「본인금융거래」 종합통장·연금신탁·외화예금 등)는 글자 줄이 원본 차례 그대로 나오는데, 기존 통장 정리 규칙이
//  이 모양을 몰라 사진용 「잔액 사슬」로 넘어가 줄마다 「원본 확인」이 붙고 줄이 많이 빠졌다(11-21 운영: ○○ 사건 국민 PDF — 2,484줄 중 510줄).
// 하는 일
//  ① 쪽 머리(조회기간·출력일자·계좌번호·쪽 번호)·되풀이 머리글은 걷고, 쪽 머리의 계좌번호로 줄마다 계좌를 붙인다(한 파일 여러 계좌)
//  ② 줄 = 거래일자로 시작해 다음 거래일자 앞까지(금액이 없는 조각은 앞 줄의 뒤 칸 — 기산일·처리시각). 칸이 한 줄씩 떨어진 글자도 같게
//  ③ 줄마다 숫자 칸 중 「금액·잔액」 짝을, 앞 줄 잔액 ± 금액 = 잔액 이 가장 많이 이어지게 고른다(모든 줄을 한꺼번에 — 동적 계획, 거꾸로 차례도)
//  ④ 입금·출금은 잔액 변화로(앞 줄이 없으면 「입금/출금」 낱말로) · 잔액이 그대로인 금액 줄(예금 이자 바로 내줌)·신탁 지급은 「은행 자료 그대로」
//  ⑤ 날짜가 앞뒤로 뒤섞였거나(글자인식이 칸을 섞음) 이어지는 줄이 8할5푼 밑이면 이 규칙은 쓰지 않는다(지어내지 않음)
//  ⑥ 「조회기간에 거래내역이 없습니다」 — 계좌는 목록에 남긴다(거래 없음) · 외화(USD 등)는 통화를 줄에 적는다
// ============================================================
var FIN_T_DATE_RE_ = /^((?:19|20)\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\.?$/;
var FIN_T_TIME_RE_ = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?::\d{1,3})?$/;
var FIN_T_CUR_RE_ = /^(USD|JPY|EUR|CNY|CNH|GBP|AUD|CAD|CHF|HKD|SGD|NZD|THB|VND)$/;
var FIN_T_NUM_RE_ = /^[-+△▲]?(?:\d{1,3}(?:,\d{3})+|[1-9]\d{0,2}|0)(?:\.\d{1,4})?(?:원)?$/;
var FIN_T_ACCT_RE_ = /계\s*좌\s*(?:번\s*호)?\s*[:：]?\s*\[?\s*(\d[\d\-]{7,24}\d)/;
var FIN_T_HDR_DATE_RE_ = /거래\s*일\s*자?|^일\s*자$|거래\s*일시|^날\s*짜$/;
var FIN_T_HDR_BAL_RE_ = /잔\s*액|잔\s*고|남은\s*금액/;
var FIN_T_HDR_AMT_RE_ = /금\s*액|입\s*금|출\s*금|찾으신|맡기신|지\s*급/;
var FIN_T_META_RE_ = /조회\s*기간|출력\s*일[자시]|작성\s*일[자시]|조회\s*일[자시]|인쇄\s*일[자시]|기준\s*일|실명\s*번호|발급\s*일|발행\s*(?:시간|일)|신규\s*일자|거래\s*시간\s*[:：]|고\s*객\s*명\s*[:：]|예\s*금\s*주\s*[:：]/;
var FIN_T_FOOT_RE_ = /^(※|발급|발행|취급자|지점|전화|KB|페이지|\(인\)|증명|위와|은행장|본\s*증명)/;
var FIN_T_END_RE_ = /이하\s*여백|출력이\s*끝났|위와\s*같이|본\s*문서|확인합니다|증명합니다/;
var FIN_T_LEAD_COL_RE_ = /^(거래\s*구분|구분|순번|번호|No\.?|종류|거래\s*종류)$/;
var FIN_T_HDR_ANY_RE_ = /(일자|일시|시각|시간|금액|잔액|구분|적요|내용|번호|점|은행|성명|이자|합계|사무소|업무|메모|비고)$/;
var FIN_T_NONE_RE_ = /거래\s*내역이?\s*(?:없습니다|없음|존재하지)|조회\s*(?:된|한)?\s*(?:거래|내역|결과)가?이?\s*없|해당\s*기간(?:에|의)?\s*거래(?:내역)?(?:이|가)?\s*없/;
var FIN_T_IN_WORD_RE_ = /^(?:\d:)?(입금|입|입금취소|맡기신)$/;
var FIN_T_OUT_WORD_RE_ = /^(?:\d:)?(출금|출|지급|출금취소|지급취소|찾으신)$/;

function finTNum_(s) {
  var t = String(s).replace(/원$/, ''), neg = /^[-△▲]/.test(t);
  var v = Number(t.replace(/^[-+△▲]/, '').replace(/,/g, ''));
  return isFinite(v) ? (neg ? -v : v) : null;
}
function finTDate_(tok) { var m = FIN_T_DATE_RE_.exec(tok); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : ''; }
function finTTime_(tok) { var m = FIN_T_TIME_RE_.exec(tok); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] + ':' + (m[3] || '00') : ''; }
// 날짜 낱말이 거래 줄의 날짜인가 — 「~」·「-」 옆(조회 기간)은 아님
function finTRowDate_(toks, i) {
  if (!finTDate_(toks[i])) return false;
  var a = toks[i - 1] || '', b = toks[i + 1] || '';
  return !/^[~∼\-–]$/.test(a) && !/^[~∼\-–]$/.test(b) && !/[~∼]$/.test(a) && !/^[~∼]/.test(b);
}
// 한 줄 → 낱말. 글자인식이 붙여 버린 낱말을 나눈다: 「2026-07-15」+「18:54:50」, 「18:54:5024,7501,453,950」 → 시각·금액·잔액
function finTToks_(line) {
  var out = [];
  String(line || '').replace(/[ 　]/g, ' ').trim().split(/\s+/).forEach(function (x) {
    if (!x) return;
    var m = /^((?:19|20)\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2})(\d{1,2}:\d{2}(?::\d{2})?)(.*)$/.exec(x);
    if (m) { out.push(m[1]); x = m[2] + m[3]; }
    m = /^(\d{1,2}:\d{2}:\d{2})(\d[\d,.]*)$/.exec(x);
    if (m) { out.push(m[1]); x = m[2]; }
    // 「03,980」 — 0원 금액과 잔액 3,980이 붙은 것(세 자리 묶음 앞에 0이 오는 숫자는 없음)
    m = /^0(\d{1,3}(?:,\d{3})+)$/.exec(x);
    if (m) { out.push('0'); x = m[1]; }
    if (/^\d[\d,]*$/.test(x) && x.indexOf(',') !== -1 && !FIN_T_NUM_RE_.test(x)) {
      var parts = x.match(/\d{1,3}(?:,\d{3})+|\d+/g) || [];
      if (parts.length > 1 && parts.join('') === x) { parts.forEach(function (p) { out.push(p); }); return; }
    }
    out.push(x);
  });
  return out;
}
// 머리글 낱말 줄인가 — 날짜·잔액·금액 낱말이 다 있고, 숫자 칸이 없음
function finTHeaderToks_(h) {
  if (h.length < 3 || h.length > 30) return null;
  var s = h.join(' ');
  if (!h.some(function (x) { return FIN_T_HDR_DATE_RE_.test(x); }) || !FIN_T_HDR_BAL_RE_.test(s) || !h.some(function (x) { return FIN_T_HDR_AMT_RE_.test(x) && !FIN_T_HDR_BAL_RE_.test(x); })) return null;
  if (h.some(function (x) { return FIN_T_NUM_RE_.test(x) && x !== '0'; })) return null;
  return h;
}
// 은행 이름 — 거래 줄(남의 은행 이름이 적요에 들어감)이 아니라 쪽 머리·꼬리(상품명·발급 은행·취급자) 줄에서 먼저
function finTBank_(metaLines, all) {
  var pri = metaLines.filter(function (l) { return /취급자|발급|은행장|지점장|증명|상품명|과\s*목\s*명|조회은행|금융기관/.test(l); }).concat(metaLines);
  for (var i = 0; i < pri.length; i++) { var m = FIN_BANK_RE_.exec(pri[i]); if (m) return finOrgNorm_(m[1]); }
  var m2 = FIN_BANK_RE_.exec(String(all || '').slice(0, 600)); return m2 ? finOrgNorm_(m2[1]) : '';
}

function finTextRows_(text, ctx) {
  var t = String(text || '').replace(/\r/g, '');
  var lines = t.split('\n'), metaLines = [], hdr = null, stream = [], curAcct = '', firstAcct = '', noneAccts = [], seenRow = false, preRow = {}, tailMode = false, lead = 0, firstLead = [];
  var holder = (/(?:고\s*객\s*명|예\s*금\s*주(?:\s*(?:성\s*)?명)?|성\s*명)\s*[:：]?\s*(?!비고|구분|명\s)([가-힣]{2,5})/.exec(t) || [])[1] || '';
  lines.forEach(function (line) {
    var toks = finTToks_(line);
    if (!toks.length) return;
    var hasRow = toks.some(function (x, i) { return finTRowDate_(toks, i); });
    var am = FIN_T_ACCT_RE_.exec(line);
    // 쪽 머리 줄 — 조회기간·출력일자·실명번호 등이 있는 줄(날짜가 있어도 거래 줄이 아님)
    var isMeta = FIN_T_META_RE_.test(line) || (am && !hasRow);
    if (am && (isMeta || line.indexOf(am[0]) < line.search(/(?:19|20)\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}/))) { curAcct = am[1]; if (!firstAcct) firstAcct = curAcct; }
    if (FIN_T_NONE_RE_.test(line)) noneAccts.push(curAcct || firstAcct);
    if (isMeta) { metaLines.push(line); return; }
    // 표 끝 — 「이하 여백」·「출력이 끝났습니다」·「위와 같이 … 확인합니다」 뒤는 다음 쪽 거래 줄(금액 있는 날짜 줄)이 나올 때까지 꼬리
    if (FIN_T_END_RE_.test(line)) { tailMode = true; metaLines.push(line); return; }
    if (tailMode) { if (hasRow && (toks.length <= 2 || toks.filter(function (x) { return FIN_T_NUM_RE_.test(x); }).length >= 2)) tailMode = false; else { metaLines.push(line); return; } }
    if (!hasRow) {
      // 날짜 없는 줄 — 첫 거래 줄 앞이면 머리글 조각일 수 있어 그대로 두고, 뒤에서는 숫자 없는 쪽 꼬리(발급·취급자)·쪽 번호만 걷는다
      var nums = toks.filter(function (x) { return FIN_T_NUM_RE_.test(x); }).length;
      if (!seenRow) { metaLines.push(line); preRow[line.replace(/\s+/g, '')] = 1; }
      // 쪽 꼬리·쪽 번호, 그리고 첫 쪽 머리에 있던 줄이 쪽마다 되풀이된 것(제목 「금 융 거 래 명 세 조 회」 등)
      else if ((!nums && (FIN_T_FOOT_RE_.test(toks[0]) || preRow[line.replace(/\s+/g, '')])) || /^\d+\s*\/\s*\d+$/.test(line.trim())) { metaLines.push(line); return; }
    } else seenRow = true;
    toks.forEach(function (x) { stream.push({ s: x, a: curAcct || firstAcct }); });
  });
  var bank = finTBank_(metaLines, t);
  var pm = /상\s*품\s*명\s*[:：]?\s*(.+?)(?:\s+신규일자|\s+계좌상태|\s+출력|$)|과\s*목\s*명\s*[:：]?\s*(\S+)/m.exec(metaLines.join('\n'));
  var product = pm ? String(pm[1] || pm[2] || '').trim() : '';
  var trust = /신탁|펀드|연금저축|ELS|DLS|ISA|수익증권/.test(product);
  var none = function () { return { 서식: '거래 없음', 은행: bank, 예금주: holder, 계좌번호: firstAcct, 거래: [], 경고: [], 무거래계좌: noneAccts.filter(Boolean).map(function (a) { return { 계좌: a, 잔액: null, 날짜: '' }; }), 거래없음: true }; };
  // 머리글 — 첫 거래 날짜 바로 앞, 숫자 없는 낱말들 가운데 날짜 머리글 낱말부터
  var toks0 = stream.map(function (x) { return x.s; }), i0 = -1;
  for (var q0 = 0; q0 < toks0.length; q0++) if (finTRowDate_(toks0, q0)) { i0 = q0; break; }
  if (i0 > 0) {
    var st0 = i0; while (st0 > 0 && !FIN_T_NUM_RE_.test(toks0[st0 - 1]) && i0 - st0 < 40) st0--;
    var run = toks0.slice(st0, i0), hd = -1;
    for (var q1 = 0; q1 < run.length; q1++) if (FIN_T_HDR_DATE_RE_.test(run[q1])) { hd = q1; break; }
    // 날짜 칸보다 앞에 오는 칸(거래구분·순번 등 — 농협 「예금거래내역서」) — 줄마다 날짜 앞 낱말이 그 줄 것
    var hs0 = hd; while (hs0 > 0 && FIN_T_LEAD_COL_RE_.test(run[hs0 - 1])) hs0--;
    if (hd >= 0) { hdr = finTHeaderToks_(run.slice(hs0)); lead = hdr ? hd - hs0 : 0; }
    // 첫 줄의 앞 칸 낱말은 머리글 끝에 붙어 있다(머리글 다음, 첫 날짜 앞)
    if (hdr && lead) { var tailW = []; for (var q2 = run.length - 1; q2 >= hd + 1 && tailW.length < lead && !FIN_T_HDR_ANY_RE_.test(run[q2]); q2--) tailW.unshift(run[q2]); firstLead = tailW; if (tailW.length) hdr = hdr.slice(0, hdr.length - tailW.length); }
  }
  if (!hdr) return noneAccts.length ? none() : null;
  // 머리글 앞 낱말(제목)·되풀이 머리글(쪽마다) 걷기 — 머리글 낱말만 3개 넘게 이어진 곳
  var hset = {}; hdr.forEach(function (x) { hset[x] = 1; });
  var s2 = [], minRun = Math.min(3, hdr.length);
  for (var i = i0; i < stream.length; i++) {
    if (hset[stream[i].s]) { var j = i; while (j < stream.length && hset[stream[j].s]) j++; if (j - i >= minRun) { i = j - 1; continue; } }
    s2.push(stream[i]);
  }
  stream = s2;
  var toks = stream.map(function (x) { return x.s; });
  var segs = [];
  for (var p = 0; p < toks.length; p++) {
    if (finTRowDate_(toks, p)) segs.push({ st: p, a: stream[p].a });
    if (segs.length) segs[segs.length - 1].en = p + 1;
  }
  var isNum = function (x) { return FIN_T_NUM_RE_.test(x); };
  // 앞 칸(날짜보다 앞 칸) — 앞 조각 끝의 낱말 lead개를 이 줄 앞으로 옮긴다(숫자면 옮기지 않음)
  if (lead) segs.forEach(function (sg, si) {
    sg.pre = si === 0 ? (firstLead || []) : [];
    if (si === 0) return;
    var pv = segs[si - 1], mv = 0; while (mv < lead && pv.en - mv - 1 > pv.st && !isNum(toks[pv.en - mv - 1]) && !FIN_T_TIME_RE_.test(toks[pv.en - mv - 1])) mv++;
    if (mv) { sg.pre = toks.slice(pv.en - mv, pv.en); pv.en -= mv; }
  });
  var rows = [], carry = null;
  segs.forEach(function (sg, si) {
    var tk = toks.slice(sg.st, sg.en);
    if (sg.pre && sg.pre.length) tk = [tk[0]].concat(sg.pre, tk.slice(1));
    if (carry) { tk = [tk[0]].concat(carry.slice(1), tk.slice(1)); carry = null; }
    var hasAmt = tk.some(function (x, k) { return k > 0 && isNum(x); });
    if (!hasAmt) {
      // 날짜만 있는 조각 — 시각 없이 다음 조각과 날짜가 같으면 그 줄의 앞 날짜 칸(거래일자·거래조작일자), 아니면 앞 줄의 뒤 칸(기산일·처리시각)
      var nx = segs[si + 1];
      if (nx && !tk.some(function (x) { return FIN_T_TIME_RE_.test(x); }) && finTDate_(toks[nx.st]) === finTDate_(tk[0])) { carry = tk; return; }
      if (rows.length && rows[rows.length - 1].a === sg.a) rows[rows.length - 1].tk = rows[rows.length - 1].tk.concat(tk);
      return;
    }
    rows.push({ tk: tk, a: sg.a });
  });
  if (!rows.length) return noneAccts.length ? none() : null;
  rows.forEach(function (r) {
    r.d = finTDate_(r.tk[0]); r.t = ''; r.nums = []; r.cur = '';
    r.tk.forEach(function (x, k) {
      if (k === 0) return;
      if (FIN_T_TIME_RE_.test(x)) { if (!r.t) r.t = finTTime_(x); return; }
      if (isNum(x) && !/^\(/.test(r.tk[k - 1] || '')) r.nums.push({ k: k, v: finTNum_(x) });
      if (FIN_T_CUR_RE_.test(x)) r.cur = x;
    });
    // 방향 낱말 — 「입금/출금/지급」 칸이 따로 있으면 그것, 없으면 거래구분 낱말 속(기일입금·연금출금 등, 한쪽만 걸릴 때)
    r.word = '';
    for (var k = 1; k < r.tk.length; k++) { if (FIN_T_IN_WORD_RE_.test(r.tk[k])) { r.word = 'i'; break; } if (FIN_T_OUT_WORD_RE_.test(r.tk[k])) { r.word = 'o'; break; } }
    if (!r.word) {
      var pw = r.tk.slice(1, r.nums.length ? r.nums[0].k : r.tk.length).join(' ');
      var wi = /입금|이자|결산|신규|환급|맡기/.test(pw), wo = /출금|지급|인출|해지|해약|송금|찾으/.test(pw);
      if (wi !== wo) r.word = wi ? 'i' : 'o';
    }
    r.bare = !r.tk.some(function (x, k) { return k > 0 && /[가-힣A-Za-z]/.test(x); });
    // 금액·잔액 짝 후보(숫자 둘) + 잔액 칸이 비었거나 읽히지 않은 줄을 위한 「금액만」 후보(잔액 = 앞 줄 잔액 ± 금액, 다음 줄이 이어지는지로 확인)
    r.cand = [];
    for (var x = 0; x < r.nums.length; x++) for (var y = x + 1; y < r.nums.length && y <= x + 3; y++) {
      r.cand.push({ ai: x, bi: y, a: Math.abs(r.nums[x].v), b: r.nums[y].v, imp: 0, pri: (y === x + 1 ? 2 : 0) + (x === 0 ? 1 : 0) - (y - x - 1) * 0.5 });
    }
    if (r.nums.length === 1) for (var x2 = 0; x2 < 1; x2++) if (Math.abs(r.nums[x2].v) > 0) {
      r.cand.push({ ai: x2, bi: -1, a: Math.abs(r.nums[x2].v), b: null, imp: 1, pri: -1 - x2 });
      r.cand.push({ ai: x2, bi: -1, a: Math.abs(r.nums[x2].v), b: null, imp: -1, pri: -1 - x2 });
    }
  });
  rows = rows.filter(function (r) { return r.cand.length; });
  if (!rows.length) return noneAccts.filter(Boolean).length ? none() : null;
  var eq = function (u, v) { return Math.abs(u - v) < 0.005; };
  // 앞 줄 잔액 pb → 이 후보의 이어짐 점수와 잔액
  var step = function (pb, c) {
    if (c.imp) { if (pb == null) return { f: 0, B: null }; return { f: 0.5, B: Math.round((pb + c.imp * c.a) * 100) / 100 }; }
    if (pb == null) return { f: 0, B: c.b };
    var d = c.b - pb;
    return { f: eq(Math.abs(d), c.a) || (c.a === 0 && eq(d, 0)) ? 1 : (eq(d, 0) && c.a > 0 ? 0.6 : 0), B: c.b };
  };
  // 계좌마다 동적 계획 — 앞 줄 후보 × 이 줄 후보, 이어짐 점수가 가장 큰 길
  var groups = {}, order = [];
  rows.forEach(function (r) { var k = r.a || ''; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(r); });
  var dp = function (list) {
    var best = list.map(function () { return []; });
    list.forEach(function (r, i) {
      r.cand.forEach(function (c, j) {
        var top = null;
        if (i === 0) { var s0 = step(null, c); if (s0) top = { sc: c.pri * 0.01, from: -1, B: s0.B, f: 0 }; }
        else best[i - 1].forEach(function (b, q) {
          if (!b) return; var s = step(b.B, c); if (!s) return;
          var sc = b.sc + s.f * 10 + c.pri * 0.01;
          if (!top || sc > top.sc) top = { sc: sc, from: q, B: s.B, f: s.f };
        });
        if (!top && i > 0 && !c.imp) { // 앞 줄과 이을 수 없으면 새로 시작
          var bq = -1, bs = -1e9; best[i - 1].forEach(function (b, q) { if (b && b.sc > bs) { bs = b.sc; bq = q; } });
          top = { sc: bs + c.pri * 0.01, from: bq, B: c.b, f: 0 };
        }
        best[i][j] = top;
      });
    });
    var li = list.length - 1, j0 = -1;
    best[li].forEach(function (b, j) { if (b && (j0 < 0 || b.sc > best[li][j0].sc)) j0 = j; });
    var pick = [], info = [];
    for (var i = li, j = j0; i >= 0; i--) { if (j < 0 || !best[i][j]) { j = 0; while (j < best[i].length && !best[i][j]) j++; } pick[i] = j; info[i] = best[i][j]; j = best[i][j].from; }
    var fits = info.filter(function (z, i) { return i > 0 && z.f > 0; }).length;
    return { pick: pick, info: info, fits: fits, sc: best[li][j0].sc };
  };
  var out = [], warn = [], allFit = 0, allPrev = 0, back = 0, junk = 0;
  order.forEach(function (k) {
    var list = groups[k];
    var solve = function (lst) { var f1 = dp(lst), rev = lst.slice().reverse(), f2 = dp(rev); var desc = 0; for (var q = 1; q < lst.length; q++) { if (lst[q].d < lst[q - 1].d) desc++; else if (lst[q].d > lst[q - 1].d) desc--; } return (f2.fits > f1.fits || (f2.fits === f1.fits && desc > 0)) ? { list: rev, d: f2 } : { list: lst, d: f1 }; };
    var use = solve(list);
    // 숫자만 있고 앞뒤 어느 줄과도 잔액이 이어지지 않는 줄 — 글자인식 찌꺼기(쪽 번호·표 밖 숫자)로 보고 빼고 다시 푼다
    var isJunk = function (L0, P0, I0, i) { var r = L0[i], nx = I0[i + 1]; return r.bare && L0.length >= 3 && !(i > 0 && I0[i].f >= 0.6) && !(nx && nx.f >= 0.6); };
    var drop = use.list.filter(function (r, i) { return isJunk(use.list, use.d.pick, use.d.info, i); });
    if (drop.length) { junk += drop.length; list = list.filter(function (r) { return drop.indexOf(r) === -1; }); if (!list.length) return; use = solve(list); }
    // 날짜 차례 — 앞으로 가는 쪽(또는 뒤로 가는 쪽)과 어긋나는 곳 세기
    var dirD = 0; for (var i = 1; i < list.length; i++) { if (list[i].d > list[i - 1].d) dirD++; else if (list[i].d < list[i - 1].d) dirD--; }
    for (var i3 = 1; i3 < list.length; i3++) { if ((dirD >= 0 && list[i3].d < list[i3 - 1].d) || (dirD < 0 && list[i3].d > list[i3 - 1].d)) back++; }
    var L = use.list, P = use.d.pick, I = use.d.info;
    // 다음 줄이 잔액 B에서 이어지는가(금액·잔액 짝 후보 가운데 하나라도)
    var nextFits = function (i, B) { var n = L[i + 1]; return !!n && B != null && n.cand.some(function (z) { return !z.imp && (eq(Math.abs(z.b - B), z.a) || (z.a === 0 && eq(z.b, B))); }); };
    L.forEach(function (r, i) {
      var c = r.cand[P[i]], inf = I[i], hasPrev = i > 0;
      if (hasPrev) allPrev++;
      var prevB = hasPrev ? I[i - 1].B : null, B = inf.B, dir = '?', chk = null, why = '';
      // 앞 줄 잔액이 바뀌었으면(앞 줄을 고쳐 채움) 이 줄 짝을 그 잔액으로 다시 고른다
      var fNow = inf.f;
      if (!c.imp && hasPrev && prevB != null) { fNow = step(prevB, c).f; if (fNow < 1) { var alt = r.cand.filter(function (z) { return !z.imp && step(prevB, z).f === 1; })[0]; if (alt) { c = alt; fNow = 1; } } B = c.b; I[i].B = B; }
      inf = { f: fNow, B: B };
      if (c.imp) {
        dir = c.imp > 0 ? 'i' : 'o';
        if (prevB != null && nextFits(i, B)) why = '잔액 칸이 비어 있어 앞 줄 잔액 ± 금액으로 채움 — 다음 줄과 이어짐 확인';
        else { B = null; chk = false; why = '잔액 칸을 읽지 못함 — 원본 확인'; dir = r.word || dir; }
      } else {
        // 앞 줄과 안 이어지는데, 이 줄 숫자 하나를 금액으로 보고 앞 줄 잔액 ± 금액을 잔액으로 하면 다음 줄이 이어지는 경우 — 잔액 칸에 다른 숫자(점 번호 등)가 읽힌 것
        if (hasPrev && inf.f === 0 && prevB != null) {
          for (var x3 = 0; x3 < Math.min(2, r.nums.length) && !why; x3++) [1, -1].forEach(function (sg) {
            if (why) return; var a3 = Math.abs(r.nums[x3].v), B3 = Math.round((prevB + sg * a3) * 100) / 100;
            if (a3 > 0 && nextFits(i, B3) && (!r.word || (r.word === 'i') === (sg > 0))) { c = { ai: x3, bi: -1, a: a3, b: B3, imp: sg }; B = B3; I[i].B = B3; dir = sg > 0 ? 'i' : 'o'; why = '잔액 칸에 다른 숫자가 읽혀 앞 줄 잔액 ± 금액으로 채움 — 다음 줄과 이어짐 확인'; }
          });
        }
      }
      if (!c.imp) {
        if (hasPrev && inf.f === 1 && !eq(c.b, prevB)) dir = c.b > prevB ? 'i' : 'o';
        else if (r.word) dir = r.word;
        else if (!hasPrev && eq(c.a, c.b)) dir = 'i';
        if (c.a === 0) dir = r.word || 'i';
        if (hasPrev) { if (inf.f === 1) chk = true; else if (inf.f > 0) why = '잔액 그대로인 금액 줄(예금 이자·세금 바로 내줌 등 — 은행 자료 그대로)'; else { chk = false; why = '앞 줄 잔액과 맞지 않음'; } }
        // 신탁·펀드·연금저축 — 잔액 칸이 원금(평가액)이라 지급액만큼 줄지 않는다. 잔액이 낱말 쪽으로 움직였으면 은행 자료 그대로
        if (chk === false && trust && r.word && ((r.word === 'o' && c.b < prevB) || (r.word === 'i' && c.b > prevB))) { chk = null; why = '신탁·펀드 계좌 — 잔액이 원금(평가액)이라 금액만큼 바뀌지 않음(은행 자료 그대로)'; }
        // 마지막 줄이 남은 잔액 전부에 마지막 이자를 얹어 내준 해지 — 잔액 칸이 비어 다른 숫자가 읽힘(11-21: ○○ 신한 「지급 4,020,051」 ← 잔액 4,019,879, 잔액 칸 「37」은 점 번호)
        if (chk === false && i === L.length - 1 && r.word !== 'i' && prevB > 0 && c.a > prevB && c.a - prevB <= Math.max(prevB * 0.05, 100000)) {
          why = '마지막 줄 — 남은 잔액 전부와 이자 ' + Math.round((c.a - prevB) * 100) / 100 + '원을 내준 해지로 보아 잔액 0(원본 잔액 칸은 「' + c.b + '」로 읽힘 — 원본 확인)'; chk = null; dir = 'o'; B = 0; I[i].B = 0;
        }
      }
      if (hasPrev && (chk === true || (chk === null && why))) allFit++;
      var used = {}; used[r.nums[c.ai].k] = 1; if (c.bi >= 0) used[r.nums[c.bi].k] = 1;
      var pre = [], post = [];
      r.tk.forEach(function (x, kk) {
        if (kk === 0 || used[kk] || FIN_T_TIME_RE_.test(x)) return;
        (kk < r.nums[c.ai].k ? pre : post).push(x);
      });
      var cpAcct = '', cpBank = '';
      for (var q = post.length - 1; q >= 0; q--) {
        if (/^\d[\d\-]{8,20}\d$/.test(post[q]) && finAcctDigits_(post[q]).length >= 10) {
          cpAcct = post[q]; var hasB = q > 0 && /은행?$/.test(post[q - 1]) && post[q - 1].length <= 8;
          if (hasB) cpBank = post[q - 1].replace(/은$/, '은행');
          post.splice(hasB ? q - 1 : q, hasB ? 2 : 1); break;
        }
      }
      var kindW = pre.filter(function (x) { return !FIN_T_IN_WORD_RE_.test(x) && !FIN_T_OUT_WORD_RE_.test(x) && !FIN_T_CUR_RE_.test(x) && !finTDate_(x) && x !== '정상'; });
      out.push({ 계좌: k, 날짜: r.d, 시각: r.t, 입금: dir === 'i' ? true : dir === 'o' ? false : null, 금액: c.a, 잔액: B, 통화: r.cur || '',
        구분: kindW.join(' '), 내용: post.filter(function (x) { return !finTDate_(x) && x !== '원' &&!FIN_T_IN_WORD_RE_.test(x) && !FIN_T_OUT_WORD_RE_.test(x); }).join(' '), 적요: '', 상대계좌: cpAcct, 상대은행: cpBank,
        잔액검산: chk, 왜: why, 원본: r.tk.join(' ') });
    });
  });
  var rate = allPrev ? allFit / allPrev : 1;
  if (allPrev && rate < 0.85) return { 버림: '이어지는 줄 ' + Math.round(rate * 100) + '% — 글자 차례가 원본과 다를 수 있어 이 규칙을 쓰지 않음' };
  if (back > Math.max(1, rows.length * 0.03)) return { 버림: '날짜가 앞뒤로 ' + back + '곳 뒤섞임 — 글자인식이 칸을 섞은 것으로 보아 이 규칙을 쓰지 않음' };
  // 0원 줄(결산 원가 0원 등)만 있는 계좌 — 거래로 넣지 않고 계좌 목록에 「금액 있는 거래 없음」으로(구분·거래금액 명세표 규칙과 같게)
  var zeroAcc = [];
  order.forEach(function (k) {
    var mine = out.filter(function (g) { return g.계좌 === k; });
    if (mine.length && mine.every(function (g) { return g.금액 === 0; })) { var lastG = mine.slice().sort(function (p, q) { return p.날짜 < q.날짜 ? -1 : p.날짜 > q.날짜 ? 1 : 0; }).pop(); zeroAcc.push({ 계좌: k, 잔액: lastG.잔액, 날짜: lastG.날짜 }); }
  });
  if (zeroAcc.length) out = out.filter(function (g) { return !zeroAcc.some(function (z) { return z.계좌 === g.계좌; }); });
  if (!out.length && !zeroAcc.length) return noneAccts.filter(Boolean).length ? none() : null;
  var curs = out.map(function (g) { return g.통화; }).filter(String);
  if (junk) warn.push('숫자만 있고 앞뒤 잔액과 이어지지 않는 줄 ' + junk + '개는 거래 줄이 아닌 것(글자인식 찌꺼기)으로 보고 뺐음 — 원본 확인');
  var bad = out.filter(function (g) { return g.잔액검산 === false || g.입금 === null; }).length;
  return { 서식: '글자 줄(머리글 차례)' + (curs.length ? ' · 외화 ' + curs[0] : ''), 은행: bank, 예금주: holder, 계좌번호: firstAcct, 거래: out, 경고: warn, 머리글: hdr, 상품: product,
    무거래계좌: noneAccts.filter(function (a) { return a && !out.some(function (g) { return finAcctDigits_(g.계좌) === finAcctDigits_(a); }); }).map(function (a) { return { 계좌: a, 잔액: null, 날짜: "" }; }).concat(zeroAcc),
    검산: { 맞음: out.filter(function (g) { return g.잔액검산 === true; }).length, 전체: out.length }, 나쁨: bad, 이어짐: rate, 계좌수: order.length };
}


// ============================================================
// [2026.11.21] 칸이 따로 읽힌 스캔 PDF — 날짜·종류 칸 덩어리와 금액·잔액·시각 덩어리가 따로 나오는 글자인식(우리은행 「예금거래실적 증명서」 스캔)
//  날짜는 날짜 차례로(쪽 안에서 덩어리 차례가 섞여 나옴), 숫자는 나온 차례에서 날짜 줄 수(K)만큼 「금액·잔액」을 고른다 —
//  앞 줄 잔액 ± 금액 = 잔액, 종류 낱말(신규·결산 = 들어옴, 지급·해지 = 나감)과 방향이 맞게, 사이 숫자는 건너뛸 수 있게(동적 계획).
//  금액이 잔액보다 앞서 다른 줄 사이에 끼어 읽힌 곳은 「잔액만」 짝(금액 = 잔액 차이, 근처에 그 금액 숫자가 있을 때만 높은 점수)으로.
//  한 계좌만, 잔액 9할 넘게 이어지고 종류 낱말과 어긋남이 없을 때만 쓴다(못 맞추면 쓰지 않음 — 지어내지 않음). 시각은 짝이 한 무리 안에 있을 때만.
// ============================================================
var FIN_T_KIND_IN_RE_ = /신규|입금|결산|이자|환급/, FIN_T_KIND_OUT_RE_ = /지급|출금|해지|해약|인출/;
function finColRows_(text) {
  var t = String(text || '').replace(/\r/g, ''), lines = t.split('\n');
  var flat = t.replace(/\s+/g, '');
  if (!/거래일자|거래일/.test(flat) || !/잔액/.test(flat) || !/지급|입금|출금|금액/.test(flat)) return null;
  var accts = {}; (t.match(new RegExp(FIN_T_ACCT_RE_.source, 'g')) || []).forEach(function (x) { var m = FIN_T_ACCT_RE_.exec(x); if (m) accts[finAcctDigits_(m[1])] = m[1]; });
  if (Object.keys(accts).length !== 1) return null;
  var acct = accts[Object.keys(accts)[0]];
  var dates = [], seq = [], meta = [], allD = 0;
  lines.forEach(function (line) {
    var toks = finTToks_(line); if (!toks.length) return;
    if (FIN_T_META_RE_.test(line) || FIN_T_ACCT_RE_.test(line) || FIN_T_END_RE_.test(line)) { meta.push(line); return; }
    toks.forEach(function (x, i) {
      if (finTRowDate_(toks, i)) {
        var kind = toks[i + 1] && !finTDate_(toks[i + 1]) && !FIN_T_NUM_RE_.test(toks[i + 1]) && /[가-힣]/.test(toks[i + 1]) ? toks[i + 1].replace(/[.,]$/, '') : '';
        allD++; if (kind) dates.push({ d: finTDate_(x), kind: kind, o: dates.length });
        return;
      }
      if (FIN_T_TIME_RE_.test(x)) { seq.push({ time: finTTime_(x) }); return; }
      if (FIN_T_NUM_RE_.test(x)) seq.push({ v: finTNum_(x) });
    });
  });
  // 날짜마다 종류 낱말이 붙어 있는 모양만(날짜 덩어리) — 아니면 다른 모양이라 쓰지 않는다
  var K = dates.length; if (K < 3 || K < allD * 0.8) return null;
  dates.sort(function (p, q) { return p.d < q.d ? -1 : p.d > q.d ? 1 : p.o - q.o; });
  var nums = [], gid = 0, gTime = {}, gCount = {};
  seq.forEach(function (s) { if (s.time) { gTime[gid] = s.time; gid++; } else { nums.push({ v: s.v, g: gid }); gCount[gid] = (gCount[gid] || 0) + 1; } });
  var M = nums.length; if (M < K) return null;
  var eq = function (u, v) { return Math.abs(u - v) < 0.005; };
  var kindDir = function (k) { var w = dates[k].kind, i = FIN_T_KIND_IN_RE_.test(w), o = FIN_T_KIND_OUT_RE_.test(w); return i === o ? 0 : i ? 1 : -1; };
  var near = function (q, a) { for (var z = Math.max(0, q - 4); z <= Math.min(M - 1, q + 4); z++) if (z !== q && eq(Math.abs(nums[z].v), a)) return true; return false; };
  // dp[k][i] — k줄을 만들고 숫자 i개 자리까지 쓴 뒤 가장 좋은 { sc, B, from, p, q, f, ai }
  var dp = [], SKIP = 0.4;
  for (var k = 0; k <= K; k++) dp.push(new Array(M + 1));
  dp[0][0] = { sc: 0, B: null };
  for (var k2 = 0; k2 < K; k2++) {
    var kd = kindDir(k2);
    for (var i = 0; i <= M; i++) {
      var cur = dp[k2][i]; if (!cur) continue;
      var put = function (q, sc, B, p, f, aImp) { var nx = dp[k2 + 1][q + 1]; if (!nx || sc > nx.sc) dp[k2 + 1][q + 1] = { sc: sc, B: B, from: i, p: p, q: q, f: f, aImp: aImp }; };
      var dirPen = function (pb, b, a) { if (pb == null || a === 0 || !kd) return 0; var s = b > pb ? 1 : b < pb ? -1 : 0; return s && s !== kd ? -6 : 0; };
      // 금액·잔액 짝: p = i+s1, q = p+1+s2
      for (var s1 = 0; s1 <= 3; s1++) for (var s2 = 0; s2 <= 2; s2++) {
        var p = i + s1, q = p + 1 + s2; if (q >= M) continue;
        var a = Math.abs(nums[p].v), b = nums[q].v, f = 0;
        if (cur.B == null) f = eq(a, b) ? 1 : 0.3; else { var d = b - cur.B; f = eq(Math.abs(d), a) || (a === 0 && eq(d, 0)) ? 1 : 0; }
        put(q, cur.sc + f * 10 + dirPen(cur.B, b, a) - (s1 + s2) * SKIP, b, p, f, null);
      }
      // 잔액만(금액은 잔액 차이) — 금액 숫자가 다른 줄 사이에 끼어 읽힌 곳
      if (cur.B != null) for (var s3 = 0; s3 <= 3; s3++) {
        var q3 = i + s3; if (q3 >= M) continue;
        var b3 = nums[q3].v, a3 = Math.round(Math.abs(b3 - cur.B) * 100) / 100;
        put(q3, cur.sc + (near(q3, a3) ? 8 : 2) + dirPen(cur.B, b3, a3) - s3 * SKIP - 1, b3, -1, near(q3, a3) ? 1 : 0, a3);
      }
    }
  }
  var bi = -1; for (var e = 0; e <= M; e++) if (dp[K][e] && (bi < 0 || dp[K][e].sc > dp[K][bi].sc)) bi = e;
  if (bi < 0) return null;
  var picks = []; for (var k3 = K, j = bi; k3 > 0; k3--) { var st = dp[k3][j]; picks.unshift(st); j = st.from; }
  var fits = picks.filter(function (x, i) { return i > 0 && x.f === 1; }).length;
  if (fits < (K - 1) * 0.9) return null;
  var out = picks.map(function (x, i) {
    var a = x.aImp != null ? x.aImp : Math.abs(nums[x.p].v), b = nums[x.q].v, pb = i > 0 ? picks[i - 1].B : null, kd = kindDir(i);
    var dir = pb == null ? (eq(a, b) ? 'i' : kd > 0 ? 'i' : kd < 0 ? 'o' : '?') : (b > pb ? 'i' : b < pb ? 'o' : (kd < 0 ? 'o' : 'i'));
    if (a === 0) dir = 'i';
    var g = nums[x.q].g, oneGroup = x.p >= 0 && nums[x.p].g === g && gCount[g] === 2;
    return { 계좌: acct, 날짜: dates[i].d, 시각: oneGroup ? (gTime[g] || '') : '', 입금: dir === 'i' ? true : dir === 'o' ? false : null, 금액: a, 잔액: b, 통화: '',
      구분: dates[i].kind, 내용: '', 적요: '', 상대계좌: '', 상대은행: '',
      잔액검산: pb == null ? null : x.f === 1 ? true : false, 왜: pb == null ? '' : x.f === 1 ? (x.aImp != null ? '금액 숫자가 다른 줄 사이에 끼어 읽혀 잔액 차이로 맞춤' : '') : '앞 줄 잔액과 맞지 않음',
      원본: dates[i].d + ' ' + dates[i].kind + ' · 금액 ' + a + ' · 잔액 ' + b + ' (칸이 따로 읽힌 스캔 — 차례로 맞춤)' };
  });
  // 종류 낱말과 방향이 어긋나면(신규·결산인데 나감 등) 날짜와 금액이 엇갈린 것 — 쓰지 않는다
  var clash = out.filter(function (g, i) { var kd = kindDir(i); return g.금액 > 0 && kd && ((kd > 0) !== (g.입금 === true)); }).length;
  if (clash) return null;
  var holder = (/(?:고\s*객\s*명|예\s*금\s*주(?:\s*(?:성\s*)?명)?|성\s*명)\s*[:：]?\s*(?!비고|구분|명\s)([가-힣]{2,5})/.exec(t) || [])[1] || '';
  return { 서식: '칸이 따로 읽힌 스캔(차례로 맞춤)', 은행: finTBank_(meta, t), 예금주: holder, 계좌번호: acct, 거래: out,
    경고: ['칸이 따로 읽힌 스캔 PDF — 날짜(날짜 차례)와 금액·잔액(잔액이 이어지는 차례)을 맞췄습니다(잔액 ' + fits + '/' + (K - 1) + '줄 이어짐). 거래 시각·적요는 원본 확인'],
    검산: { 맞음: fits, 전체: K }, 나쁨: out.filter(function (g) { return g.잔액검산 === false || g.입금 === null; }).length, 이어짐: K > 1 ? fits / (K - 1) : 1, 계좌수: 1, 무거래계좌: [] };
}
