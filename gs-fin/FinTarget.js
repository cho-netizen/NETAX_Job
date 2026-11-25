// ============================================================
// [2026.11.25] 금융거래 3단계 — 증감분석 · 분석대상자 · 대상자별 거래 · 계약서에서 주요 거래대상자
// ------------------------------------------------------------
// 세무사님 11-25 0시 원문: "상속인을 포함한 특수관계자와 양도양수, 임대임차 등 주요거래대상자로 구성된 분석대상자 시트를 만들어서
//  분석을 시작해야 하는 것 아닌가? 물론 분석대상자와의 거래분석이전에 증감분석 등이 먼저 이루어 져야하긴 하지만 말야."
// 계획서: docs/_기록/금융거래_분석대상자_자체학습_계획서_20261125.html
//  · 분석 차례: ② 증감분석(전체 예금이 언제 얼마나 늘고 줄었나) → ③ 분석대상자 → ④ 대상자별 거래 → ⑤ 판정(§15·§13·짚을 곳)
//  · 모두 GAS(AI 0원). 갈래·상속인·특수관계는 짐작까지만 — 정하는 것은 세무사님(✎).
// ============================================================

var FIN_TG_MAJOR_ = /^(세입자|임대인|매수인|매도인|공사·용역 업체)$/;
var FIN_TG_DAILY_ = /^(금융기관·보험|병원·요양|공과금·세금|생활 결제처)$/; // [2026.11.25] 가맹점 결제(쿠팡·편의점 등)도 일상
var FIN_TG_GROUPS_ = ['① 상속인·특수관계자', '② 주요 거래대상자', '③ 살펴볼 사람·거래처', '④ 일상 거래처(분석 제외)'];
// 상속개시일 기준 구간(r.period 글자 → 증감분석 구간)
var FIN_TG_SEG_ = { '10년 밖': '10년 넘은 전', '10년 안': '10~5년 전', '5년 안': '5~2년 전', '2년 안': '2~1년 전', '1년 안': '1년 안', '개시 당일(전)': '1년 안', '개시 당일': '개시일·뒤', '개시 당일(후)': '개시일·뒤', '개시 후': '개시일·뒤' };
var FIN_TG_SEG_ORDER_ = ['10년 넘은 전', '10~5년 전', '5~2년 전', '2~1년 전', '1년 안', '개시일·뒤'];
// 증감분석에서 「설명이 필요한」 유출 갈래(쓰임이 통장에 안 보이는 돈)와 관련인으로 간 돈
var FIN_TG_UNEXPLAINED_ = ['현금·수표', '그 밖', '본인 다른 계좌(자료 없음)'];

// 사람 이름으로 보이나 — 한글 2~4자(가린 * 포함) 또는 영문 이름. 「간병비·식비·수신료·원가·코리아」처럼 사람 이름이 아닌 낱말은 뺌(11-25 시험: 실사건 후보)
var FIN_TG_NOTPERSON_RE_ = /(비|료|세|금액|요금|관리|병원|의원|약국|마트|상회|상사|센터|수산|축산|유통|교회|성당|협회|회|원가|식비|주사|코리아|지급|취소|취|입금|출금|이자|급여|보수|수당|연금|보험|카드|은행|생활|용돈|월세|보증)$/;
function finTgPerson_(name) { var n = finRvNorm_(name); if (/^[가-힣*]{2,4}$/.test(n)) return !FIN_TG_NOTPERSON_RE_.test(n) || n.indexOf('*') !== -1; return /^[A-Z]{4,}$/.test(n) && n.length <= 14 && !/(PAY|BANK|CARD|COM|KOREA|MART|SHOP|STORE)/.test(n); }

// ---------- ② 증감분석 — 크게 줄어든 구간(최고점 → 최저점) ----------
//  매일 끝 전체 잔액을 따라가며, 최고점에서 thr(큰돈×3) 넘게 떨어졌다가 thr/2 넘게 되올라오면 한 구간으로 끊는다(1년 넘게 떨어지지 않으면 최고점을 새로 잡음)
function finTgDrops_(R, order, T) {
  var byDay = {}, days = [];
  order.forEach(function (ix) { var r = R[ix]; if (r.own && r.krw && r.total != null) { if (byDay[r.d] === undefined) days.push(r.d); byDay[r.d] = r.total; } });
  var thr = T.큰돈 * 3, out = [], pk = null, tr = null;
  days.forEach(function (d) {
    var v = byDay[d];
    if (!pk) { pk = { d: d, v: v }; return; }
    if (!tr) {
      if (v >= pk.v || finRvDays_(pk.d, d) > 365) pk = { d: d, v: v };
      else if (pk.v - v >= thr) tr = { d: d, v: v };
    } else if (v < tr.v) tr = { d: d, v: v };
    else if (v - tr.v >= thr / 2) { out.push({ from: pk, to: tr }); pk = { d: d, v: v }; tr = null; }
  });
  if (tr) out.push({ from: pk, to: tr });
  return out.map(function (s) {
    var L = R.filter(function (r) { return r.own && r.krw && !r.inner && r.d > s.from.d && r.d <= s.to.d; });
    var lanes = {}, who = {}, outSum = 0, inSum = 0, unexp = 0, toRel = 0;
    L.forEach(function (r) {
      if (r.in > 0) { inSum += r.in; return; }
      if (!(r.out > 0)) return;
      outSum += r.out; var g = r.lane || '그 밖'; lanes[g] = (lanes[g] || 0) + r.out;
      if (FIN_TG_UNEXPLAINED_.indexOf(g) !== -1) unexp += r.out;
      if (g === '관련인') toRel += r.out;
      var w = r.party ? r.party.이름 : r.best ? r.best.raw : (r.nature || '상대 모름'); who[w] = (who[w] || 0) + r.out;
    });
    var top = Object.keys(who).sort(function (a, b) { return who[b] - who[a]; }).slice(0, 5).map(function (k) { return k + ' ' + finRvWon_(who[k]); });
    return { 시작: s.from.d, 끝: s.to.d, 날수: finRvDays_(s.from.d, s.to.d), 최고: s.from.v, 최저: s.to.v, 줄어듦: s.from.v - s.to.v, 나감: outSum, 들어옴: inSum, 갈래: lanes, 큰상대: top, 설명필요: unexp, 관련인으로: toRel, rows: L.filter(function (r) { return r.out >= T.큰돈 / 10; }) };
  });
}

// 경상 수지(해마다) — 경상 수입(이자·연금·임대) / 경상 지출(생활비·공과금·카드) / 쓰임이 안 보이는 유출
function finTgRegular_(f) {
  var i = f.들어옴 || {}, o = f.나감 || {};
  var inc = (i['이자·연금'] || 0) + (i['거래처·임대'] || 0), exp = (o['생활비·공과금·카드'] || 0) + (o['생계·가족비'] || 0) + (o['경조·종교'] || 0); // [2026.11.25] 생계비·가족비·경조비·종교활동비도 경상 지출
  var odd = FIN_TG_UNEXPLAINED_.reduce(function (s, k) { return s + (o[k] || 0); }, 0), rel = o['관련인'] || 0;
  return { 경상수입: inc, 경상지출: exp, 설명필요: odd, 관련인으로: rel };
}

// ---------- ③ 분석대상자 — 관련인 표를 네 갈래로 나누고 대상자마다 합계 ----------
function finTgTargets_(R, rels, B, T, lane, fl, flagsOf) {
  var out = [];
  rels.forEach(function (x) {
    var l = lane(x), L = R.filter(function (r) { return r.party === x && r.own && !r.inner; });
    var sumAll = (x._in || 0) + (x._out || 0), person = finTgPerson_(x.이름);
    // ② 주요 거래대상자는 세입자·임대인·매수인·매도인·업체(갈래 또는 짐작)·계약서에서 찾은 이름, 세무사님이 「그 밖 거래처」로 고르신 큰돈 상대.
    //  GAS가 「그 밖 거래처」로 짐작한 것(급여·연금·수당 같은 수입원)은 ④ — 사람으로 보이는데 갈래가 없으면 ③
    var g = FIN_RV_FAMILY_.test(l) ? 0 : (FIN_TG_MAJOR_.test(l) || x.계약 || (x.갈래 === '그 밖 거래처' && sumAll >= T.큰돈)) ? 1 : (FIN_TG_DAILY_.test(l) || l === '피상속인 본인' || (!x.갈래 && l === '그 밖 거래처') || (!l && !person && sumAll < T.큰돈)) ? 3 : 2;
    var yrs = l === '상속인' ? 10 : 5;
    var W = B.D ? L.filter(function (r) { return finRvBefore_(r, B, yrs); }) : L;
    var wOut = W.reduce(function (s, r) { return s + (r.out || 0); }, 0), wIn = W.reduce(function (s, r) { return s + (r.in || 0); }, 0);
    var by = {}; L.forEach(function (r) { var y = r.d.slice(0, 4); by[y] = (by[y] || 0) + (r.out || 0) - (r.in || 0); });
    var yearsTxt = Object.keys(by).sort().map(function (y) { return y + ' ' + (by[y] >= 0 ? '−' : '+') + finRvWon_(Math.abs(by[y])); }).join(' · ');
    var t = { x: x, 구분: g, 갈래: l, yrs: yrs, rows: L, 기간나감: wOut, 기간들어옴: wIn, 기간순액: wOut - wIn, 해마다: yearsTxt, person: person };
    out.push(t);
    // C7 — 관계를 모르는 사람에게 합산 기간(5년) 안 순액이 큰돈 넘게 감 → 갈래(상속인·가족·남)를 밝혀야 §13을 셀 수 있음
    // (같은 사람이 이미 C3 「나갔다 돌아온 돈」으로 짚였으면 그 줄에서 봄 — 겹쳐 올리지 않음)
    var hasC3 = false; if (typeof flagsOf === 'function') hasC3 = flagsOf().some(function (f) { return f.번호 === 'C3' && f.상대 === x.이름; });
    if (g === 2 && person && !hasC3 && wOut - wIn >= T.큰돈) fl('C7', 'tg:' + x.이름, { 갈래: 'C 사전증여(§13)', 짚을것: x.이름 + '(관계 모름)에게 간 돈 — ' + (B.D ? '5년 안' : '전체') + ' 순액', 날짜: W.length ? W[0].d + ' ~ ' + W[W.length - 1].d : '', 금액: wOut - wIn, 상대: x.이름, 까닭: '상속인이 아닌 사람에게 준 돈도 5년 안이면 합산(상증법 §13① 2호) — 누구인지·준 까닭을 밝혀야 함', 준비: '분석대상자 탭에서 갈래(상속인·가족·남)를 골라 주세요', rows: W.filter(function (r) { return r.out > 0; }) });
  });
  out.sort(function (a, b) { return a.구분 - b.구분 || ((b.x._in || 0) + (b.x._out || 0)) - ((a.x._in || 0) + (a.x._out || 0)); });
  return out;
}

// ---------- 계약서에서 주요 거래대상자(임대차·매매) ----------
var FIN_TG_STOP_NAME_ = /^(주소|성명|서명|날인|인감|전화|연락|주민|등록|번호|대리|대리인|중개|공인|확인|날짜|계약|본인|위임|상호|대표|사업|사업자|소재|소재지|임대|임차|매도|매수|당사자|아래|다음|위의|부동산|표시|특약|금액|보증|월세|잔금|중도|계약금|기간|목적|면적|구조|용도|지번|건물|토지|은행|계좌|입금|해당|각각|모두|그리고)$/;
function finTgContractParse_(text, name) {
  var t = String(text || '').replace(/\r/g, ''), kind = /임대차|전세|월세|임대인|임차인/.test(t + name) ? '임대차' : /매매|분양|양도|양수|매도인|매수인/.test(t + name) ? '매매' : '';
  if (!kind) return null;
  var parties = [], seen = {};
  var add = function (role, nm) {
    nm = String(nm || '').replace(/\s+/g, '').replace(/\(인\)|\(서명\)|\(날인\)|인$/, '');
    if (!/^[가-힣]{2,4}$/.test(nm) || FIN_TG_STOP_NAME_.test(nm)) return;
    var k = role + '|' + nm; if (seen[k]) return; seen[k] = 1; parties.push({ 역할: role.replace('양도인', '매도인').replace('양수인', '매수인'), 이름: nm });
  };
  var re1 = /(임대인|임차인|매도인|매수인|양도인|양수인)[\s\S]{0,120}?성\s*명\s*[:：]?\s*([가-힣]\s*[가-힣]\s*[가-힣]?\s*[가-힣]?)(?=[\s(（,]|$)/g, m;
  while ((m = re1.exec(t)) && parties.length < 12) add(m[1], m[2]);
  var re2 = /(임대인|임차인|매도인|매수인|양도인|양수인)\s*[:：]\s*([가-힣]{2,4})(?=[\s(（,]|$)/g;
  while ((m = re2.exec(t)) && parties.length < 12) add(m[1], m[2]);
  // 역할 글자가 글자인식에서 깨지면(11-25 시험: 실사건 전세 계약서 「임대인」 → 「임주 소」) 서명란 「성명」 차례로 — 표준 계약서는 임대인(매도인) 다음 임차인(매수인)
  var orderGuess = false;
  if (parties.length < 2) {
    var names = [], reN = /성\s*명\s*[:：]?\s*([가-힣]\s*[가-힣]\s*[가-힣]?\s*[가-힣]?)(?=[\s(（,]|$)/g, n2;
    while ((n2 = reN.exec(t)) && names.length < 6) { var nm = n2[1].replace(/\s+/g, ''); if (/^[가-힣]{2,4}$/.test(nm) && !FIN_TG_STOP_NAME_.test(nm) && names.indexOf(nm) === -1) names.push(nm); }
    if (names.length >= 2) {
      var roles = kind === '임대차' ? ['임대인', '임차인'] : ['매도인', '매수인'];
      if (!parties.some(function (q) { return q.이름 === names[0] || q.이름 === names[1]; })) { add(roles[0], names[0]); add(roles[1], names[1]); orderGuess = true; }
    }
  }
  var dates = [], dm, reD = /(\d{4})\s*[년.\-\/]\s*(\d{1,2})\s*[월.\-\/]\s*(\d{1,2})\s*일?/g;
  while ((dm = reD.exec(t)) && dates.length < 8) { var y = Number(dm[1]); if (y < 1980 || y > 2100) continue; var ds = dm[1] + '-' + ('0' + dm[2]).slice(-2) + '-' + ('0' + dm[3]).slice(-2); if (dates.indexOf(ds) === -1) dates.push(ds); }
  var amts = [], am, reA = /(?:₩|금)\s*([\d]{1,3}(?:,\d{3}){2,}|\d{7,})|([\d]{1,3}(?:,\d{3}){2,})\s*원/g;
  while ((am = reA.exec(t)) && amts.length < 8) { var v = Number(String(am[1] || am[2]).replace(/,/g, '')); if (v >= 1000000 && amts.indexOf(v) === -1) amts.push(v); }
  return { 종류: kind, 당사자: parties, 날짜: dates, 금액: amts, 차례짐작: orderGuess };
}
// 같은 사람인가 — 글자인식이 한 글자를 틀린 이름(「조만덕」 → 「조만먹」)도 같은 사람 후보로(세 글자 이상·한 글자만 다름)
function finTgNameNear_(a, b) {
  if (finRvNameLike_(a, b)) return true;
  a = finRvNorm_(a); b = finRvNorm_(b); if (a.length < 3 || a.length !== b.length) return false;
  var d = 0; for (var i = 0; i < a.length; i++) if (a.charAt(i) !== b.charAt(i)) d++;
  return d === 1 && a.charAt(0) === b.charAt(0);
}
// 사건 폴더 계약서 글(이미 읽어 둔 글자 기억 — 새 글자인식은 한 번에 둘까지) → U.contracts(파일 번호·수정 시각으로 기억) · U.rel에 짐작 대상자
function finTgContracts_(folder, U, budgetAt) {
  var files = []; try { files = finFolderFiles_(folder); } catch (e) { return false; }
  files = files.filter(function (f) { return /(계약|임대차|전세|월세|매매|분양|양도|양수)/.test(f.name) && !/^_|^~\$/.test(f.name) && !/\.(json|zip)$/i.test(f.name) && !/금융거래|거래내역|통장/.test(f.name); }).slice(0, 40);
  U.contracts = U.contracts || {};
  var changed = false, live = {}, newOcr = 0;
  files.forEach(function (f) {
    live[f.id] = 1;
    var c = U.contracts[f.id];
    if (c && c.mod === f.modified) return;
    if (Date.now() > budgetAt) return;
    var text = '';
    var prev = TC_NO_NEW_OCR_; TC_NO_NEW_OCR_ = newOcr >= 2;
    try { text = tc_docText_({ id: f.id, name: f.name, mimeType: f.mimeType, modified: f.modified }) || ''; } catch (e) { text = ''; } finally { TC_NO_NEW_OCR_ = prev; }
    if (!text && newOcr < 2) newOcr++;
    if (!text) return; // 다음 번에(글자 기억이 생기면) 다시
    var p = finTgContractParse_(text, f.name);
    U.contracts[f.id] = { mod: f.modified, 이름: f.name, 경로: f.path, p: p };
    changed = true;
  });
  Object.keys(U.contracts).forEach(function (id) { if (!live[id]) { delete U.contracts[id]; changed = true; } });
  return changed;
}
// 계약서 당사자 → 분석대상자 짐작(피상속인이 어느 쪽인지로 상대 갈래를 정함). 피상속인이 없는 계약서는 관련인(가족) 계약이면 그 사람의 「관련 거래·계약」에
function finTgContractRels_(U, decedent) {
  var changed = false, have = {}; U.rel.forEach(function (x) { have[finRvNorm_(x.이름)] = x; });
  var map = { 임대인: { 임차인: '세입자' }, 임차인: { 임대인: '임대인' }, 매도인: { 매수인: '매수인' }, 매수인: { 매도인: '매도인' } };
  Object.keys(U.contracts || {}).forEach(function (id) {
    var c = U.contracts[id], p = c.p; if (!p || !p.당사자 || !p.당사자.length) return;
    var me = p.당사자.filter(function (q) { return finTgNameNear_(q.이름, decedent); })[0];
    var tag = p.종류 + (p.차례짐작 ? '(서명란 차례로 짐작)' : '') + (p.날짜.length ? ' ' + p.날짜.slice(0, 4).join('·') : '') + (p.금액.length ? ' · ' + p.금액.slice(0, 3).map(finRvWon_).join('·') + '원' : '') + ' (' + c.이름 + ')';
    var put = function (x, lane, src) {
      if (!x) { x = { 이름: '', 갈래: '', 짐작: '', 상속인: '', 관계: '', 별칭: [], 계좌: [], 출처: src, 상태: '후보 — 갈래를 골라 주세요' }; }
      return x;
    };
    if (me) {
      p.당사자.forEach(function (q) {
        var lane = (map[me.역할] || {})[q.역할]; if (!lane || finTgNameNear_(q.이름, decedent)) return;
        var x = have[finRvNorm_(q.이름)];
        if (!x) { x = put(null, lane, '계약서 「' + c.이름 + '」'); x.이름 = q.이름; U.rel.push(x); have[finRvNorm_(q.이름)] = x; changed = true; }
        if (!x.갈래 && x.짐작 !== lane && !FIN_RV_FAMILY_.test(x.짐작 || '')) { x.짐작 = lane; changed = true; }
        var k = { 날짜: p.날짜, 금액: p.금액, 파일: c.이름 };
        if (JSON.stringify(x.계약 || null) !== JSON.stringify(k)) { x.계약 = k; changed = true; }
        if (x.계약글 !== tag) { x.계약글 = tag; changed = true; } // GAS 글은 따로 — 「관련 거래·계약 ✎」(세무사님 칸)을 덮지 않음
      });
    } else {
      // 피상속인이 당사자가 아닌 계약 — 가족·관련인이 당사자면 그 사람 재산 취득·처분(C4 계약일 전후 인출)
      p.당사자.forEach(function (q) {
        var x = have[finRvNorm_(q.이름)]; if (!x || !FIN_RV_FAMILY_.test(x.갈래 || x.짐작 || '')) return;
        if (x.계약글 !== tag) { x.계약글 = tag; changed = true; }
      });
    }
  });
  return changed;
}
// 계약서 금액·날짜로 상대 맞추기 — 상대 글자로 못 맞춘 줄 중 계약 금액과 같고 계약일 ±60일 안이면 그 대상자 후보(sure 1)
function finTgContractMatch_(R, rels) {
  var n = 0;
  rels.forEach(function (x) {
    var k = x.계약; if (!k || !(k.금액 || []).length || !(k.날짜 || []).length) return;
    R.forEach(function (r) {
      if (r.party || !r.own || r.inner || r.self || !r.amt) return;
      if (k.금액.indexOf(r.amt) === -1) return;
      if (!k.날짜.some(function (d) { return Math.abs(finRvDays_(d, r.d)) <= 60; })) return;
      r.m = { x: x, sure: 1, how: '계약서 금액·날짜(' + k.파일 + ')' }; r.party = x; n++;
    });
  });
  return n;
}

// ---------- 탭 쓰기 ----------
function finTgWrite_(ss, A, U) {
  var B = A.B, lane = function (x) { return x ? (x.갈래 || x.짐작 || '') : ''; };
  // 증감분석 — 구간(상속개시일 기준) · 크게 줄어든 구간 · 해마다 · 분기마다 · 달마다
  var C = A.change, rows = [];
  var fr = function (f) { var g = finTgRegular_(f), ins = 0, outs = 0; Object.keys(f.들어옴 || {}).forEach(function (k) { ins += f.들어옴[k]; }); Object.keys(f.나감 || {}).forEach(function (k) { outs += f.나감[k]; }); var real = (f.끝 || 0) - (f.시작 || 0) - (f.자료시작 || 0); return [f.k, f.시작, f.끝, real, ins, outs, g.경상수입, g.경상지출, g.설명필요, g.관련인으로, f.안 || '', f.자료시작 || '', f.끊김 || '']; };
  var hdr = ['구간·해·분기·달', '시작 전체 잔액', '끝 전체 잔액', '실제 증감(자료 시작 뺌)', '바깥에서 들어옴', '바깥으로 나감', '경상 수입(이자·연금·임대)', '경상 지출(생활비·공과금·카드)', '쓰임 안 보이는 유출(현금·그 밖·본인 다른 계좌)', '관련인으로 간 돈', '안에서 옮김', '자료 시작 더함', '잔액 끊김'];
  var blank = hdr.map(function () { return ''; }), title = function (t) { var r = blank.slice(); r[0] = t; return r; };
  if (C.segs.length) { rows.push(title('■ 상속개시일(' + B.D + ') 기준 구간')); C.segs.forEach(function (f) { rows.push(fr(f)); }); rows.push(blank); }
  else rows.push(title('■ 상속개시일이 없어 구간표를 못 만듦 — 「사건 기준」 탭에 적어 주세요(아래 해마다는 그대로)'));
  rows.push(title('■ 크게 줄어든 구간 — 최고점에서 ' + finRvWon_(B.T.큰돈 * 3) + '원 넘게 줄었다가 되오른 곳(' + C.drops.length + '곳)'));
  if (!C.drops.length) rows.push(title('  없음'));
  C.drops.forEach(function (d) {
    var r = blank.slice(); r[0] = d.시작 + ' ~ ' + d.끝 + ' (' + d.날수 + '일)'; r[1] = d.최고; r[2] = d.최저; r[3] = -d.줄어듦; r[4] = d.들어옴; r[5] = d.나감; r[7] = d.갈래['생활비·공과금·카드'] || ''; r[8] = d.설명필요; r[9] = d.관련인으로;
    rows.push(r);
    var r2 = blank.slice(); r2[0] = '   간 곳: ' + Object.keys(d.갈래).sort(function (a, b) { return d.갈래[b] - d.갈래[a]; }).map(function (k) { return k + ' ' + finRvWon_(d.갈래[k]); }).join(' · ') + ' / 큰 상대: ' + d.큰상대.join(' · '); rows.push(r2);
  });
  rows.push(blank); rows.push(title('■ 해마다')); A.years.forEach(function (f) { rows.push(fr(f)); });
  rows.push(blank); rows.push(title('■ 분기마다')); C.quarters.forEach(function (f) { rows.push(fr(f)); });
  rows.push(blank); rows.push(title('■ 달마다')); A.months.forEach(function (f) { rows.push(fr(f)); });
  finRvTab_(ss, '증감분석', hdr, rows, { text: [0], money: hdr.map(function (h, i) { return i; }).slice(1), note: '분석의 첫 단계 — 계좌를 지운 피상속인 예금 전체가 언제 얼마나 늘고 줄었는지. 「실제 증감」은 계좌 자료가 시작되며 더해진 잔액을 뺀 것. 「쓰임 안 보이는 유출」이 큰 구간부터 분석대상자·짚을 곳으로 따라가 봅니다(크게 줄어든 구간은 짚을 곳 D3).' });

  // 분석대상자 — 관련인 표를 네 갈래로(세무사님 ✎ 칸은 옛 「관련인」 탭과 같음)
  var TG = A.targets, F = A.flags;
  var fcount = {}; F.forEach(function (f) { if (f.상대) fcount[f.상대] = (fcount[f.상대] || 0) + 1; });
  U.relShown = TG.map(function (t) { return t.x.이름; }); // 시트에 보인 이름 — 거둘 때 「지우신 줄」과 「새로 생긴 줄」을 가름
  // [2026.11.25] 노란 칸 옆에 GAS 답안(상속인·관계 짐작 — 가족관계증명서·의뢰 메모·지난 보고서에서). 노란 칸은 답안이 틀릴 때만(세무사님 "권장대로 하자")
  var th = ['구분', '이름·상호 ✎', '갈래 ✎', '갈래 짐작(GAS)', '상속인인가 ✎', '상속인 짐작(GAS)', '관계 ✎', '관계 짐작(GAS)', '통장에 찍히는 글자 ✎', '계좌번호 ✎', '사업자번호 ✎', '관련 거래·계약 ✎', '근거', '상태', '§13 합산 기간', '기간 안 나감', '기간 안 들어옴', '기간 안 순액(나감−들어옴)', '전체 나감', '전체 들어옴', '오간 줄', '처음', '마지막', '짚을 곳', '해마다 순액(−나감 +들어옴)'];
  finRvTab_(ss, '분석대상자', th, TG.map(function (t) {
    var x = t.x, show = t.구분 < 3;
    return [FIN_TG_GROUPS_[t.구분], x.이름, x.갈래 || '', (x.짐작 || '') + (x.짐작배움 ? ' (배움)' : ''), x.상속인 || '', x.상속인짐작 || '', x.관계 || '', x.관계짐작 || '', (x.별칭 || []).join(' · '), (x.계좌 || []).join(' · '), x.사업자번호 || '', x.거래계약 || x.계약글 || '', x.출처 || '', t.구분 === 3 && !x.갈래 ? '일상 거래처 — 묻지 않음' : (x.답안상태 || ''),
      show ? (B.D ? t.yrs + '년' : '(개시일 없음 — 전체)') : '', show ? t.기간나감 || '' : '', show ? t.기간들어옴 || '' : '', show ? t.기간순액 || '' : '', x._out || '', x._in || '', x._n || '', x._first || '', x._last || '', fcount[x.이름] || '', show ? t.해마다 : ''];
  }), { text: [9, 10, 21, 22], money: [15, 16, 17, 18, 19], lists: [{ col: 2, list: FIN_RV_LANES_ }, { col: 4, list: ['예', '아니오', '모름'] }], note: '분석은 여기서 시작합니다(증감분석 다음). ① 상속인·특수관계자(가족관계증명서·의뢰 메모·지난 보고서·가족 지도·세무사님) ② 주요 거래대상자(세입자·임대인·매수인·매도인·업체 — 사건 폴더 계약서에서 찾은 이름 포함) ③ 살펴볼 사람·거래처(큰돈 오간 상대) ④ 일상 거래처(분석 제외). 갈래·상속인인가는 세무사님이 확정하십니다 — 옆 「짐작(GAS)」 답안이 맞으면 그대로 두시고 틀리면 노란 칸에 적으십시오(성씨가 같은 것은 근거 아님, 짐작·배움은 후보). 줄을 지우시면 보관에서도 빠집니다.' });

  // 대상자별 거래 — ①·②·③(큰 순 40명까지) 대상자마다 해마다 합과 거래 줄
  var trows = [], tw = ['대상자', '구분·해·날짜', '계좌', '나감', '들어옴', '순액(나감−들어옴)', '성격', '기간', '짚임', '열쇠'];
  var tblank = tw.map(function () { return ''; });
  TG.filter(function (t) { return t.구분 < 3 && t.rows.length; }).slice(0, 40).forEach(function (t) {
    var x = t.x, L = t.rows.slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    var o = L.reduce(function (s, r) { return s + (r.out || 0); }, 0), i = L.reduce(function (s, r) { return s + (r.in || 0); }, 0);
    trows.push(['■ ' + x.이름 + (lane(x) ? ' (' + lane(x) + (x.갈래 ? '' : ' — 짐작') + ')' : ''), FIN_TG_GROUPS_[t.구분] + (B.D ? ' · §13 ' + t.yrs + '년 안 순액 ' + finRvWon_(t.기간순액) + '원' : ''), '', o, i, o - i, '', '', '', '']);
    var by = {}; L.forEach(function (r) { var y = r.d.slice(0, 4), b = by[y] || (by[y] = { o: 0, i: 0, n: 0 }); b.o += r.out || 0; b.i += r.in || 0; b.n++; });
    Object.keys(by).sort().forEach(function (y) { trows.push(['', '  ' + y + '년 (' + by[y].n + '줄)', '', by[y].o, by[y].i, by[y].o - by[y].i, '', '', '', '']); });
    var show = L.length > 40 ? L.filter(function (r) { return r.amt >= B.T.목록기준; }).slice(0, 40) : L;
    show.forEach(function (r) { var u = (U.rows || {})[r.k] || {}; trows.push(['', '    ' + r.d + (r.t ? ' ' + r.t.slice(0, 5) : ''), r.acct, r.out || '', r.in || '', '', u.성격 || r.nature || '', r.period || '', (r.flags || []).join(' '), r.k]); });
    if (show.length < L.length) trows.push(['', '    그 밖 ' + (L.length - show.length) + '줄(' + finRvWon_(B.T.목록기준) + '원 아래)', '', '', '', '', '', '', '', '']);
    trows.push(tblank);
  });
  if (!trows.length) trows.push(['분석대상자(①~③)와 오간 거래가 아직 없음 — 분석대상자 탭에서 갈래를 고르시거나 거래 탭 「상대 ✎」에 적어 주세요', '', '', '', '', '', '', '', '', '']);
  finRvTab_(ss, '대상자별 거래', tw, trows, { text: [1, 7, 9], money: [3, 4, 5], note: '분석대상자(①~③)마다 오간 거래 — 해마다 합계와 줄. 줄을 고치실 때는 거래 탭 ✎ 칸에서(이 탭은 GAS가 다시 씀).' });
}
