// ============================================================
// [2026.11.26] 조사 사건 — 상속세 신고서·조사청 서류를 읽어 통장 분석과 맞대기 (GAS, 0원 — 바깥 AI로 보내는 것 없음)
//  세무사님 11-26 "신고분이 아니라 조사분이라서 신고서를 읽어서 정보를 확인해야 할텐데?" → "계획서를 만들라" → "권장대로 하자"
//  (계획서: 총괄관리자\_기록\금융거래_조사사건_신고서맞대기_계획서_20261126.html)
//  · 서류 갈래(finFdKind_): ① 상속세 신고서 묶음 ② 조사청 문서(소명 안내·결정통지) ③ 조사관 지정 거래 표(엑셀) ④ 이미 낸 소명자료 ⑤ 사무소 상담자료
//    — ①~⑤는 은행 거래내역·재산조회회보서로 읽지 않는다(11-26 실제 조사 사건: 신고서를 통장으로 읽어 가짜 3줄, 1차 소명자료를 회보서로 읽어 남의 계좌 8개).
//  · 신고서 칸은 서식에 찍힌 칸 번호·이름으로 읽는다(별지 제9호서식·부표 1·2·3, 별지 제5호서식). 주민등록번호·전화·전자우편은 저장하지 않는다.
//  · 맞대기(짚을 곳 E)·조사청이 묻는 곳(짚을 곳 F)은 짚기만 하고 정하지 않는다 — 판단은 세무사님.
// ============================================================
var FIN_FD_VER_ = '2026-11-26a';
// 서류 읽기(FinDocs.js)가 이름만 보고 건너뛰는 낱말(「명세」·「세액」 등)이 있어도 읽을 서류
var FIN_FD_KEEP_RE_ = /신고서|과세표준|소명|통지|안내|약정서|조사|결정|해명|사용처/;
// 조사관 지정 거래 표로 볼 엑셀 이름(내용은 머리줄 「사용처」·「근거」로 다시 가름)
var FIN_FD_DESIG_NAME_RE_ = /소명|국세청|조사|지정|회신|사용처|해명/;
var FIN_FD_E_ = { E1: '신고 금융재산 ↔ 상속개시일 통장 잔액', E2: '신고와 통장 계좌가 짝이 없음', E3: '신고 사전증여 ↔ 통장에서 간 돈', E4: '신고 채무 ↔ 통장', E5: '처분재산 대금 ↔ 신고 처분재산 산입액', E6: '신고 장례비 ↔ 통장', E7: '신고 추정상속 ↔ 우리 셈', E8: '신고 상속인 ↔ 분석대상자' };

function finFdSq_(t) { return String(t || '').replace(/\s+/g, ''); }
function finFdNum_(s) { var v = String(s == null ? '' : s).replace(/[,\s원]/g, ''); return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null; }
function finFdYmd_(y, m, d) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }

// 서류 갈래 — 글 앞부분(띄어쓰기를 지운 글)으로. 빈 글자면 은행·증명서 등 그 밖 서류
function finFdKind_(text) {
  var s = finFdSq_(text).slice(0, 8000);
  // 사무소 작업 표(「Sheet1 …」)·감정평가서는 신고서·조사청 문서가 아님(11-26 다른 상속 사건 서류로 돌려 봄 — 감정평가서의 「조사」 글자를 안내로 봄)
  if (/^(Sheet|시트)\d*/.test(s) || /감정평가서|APPRAISALREPORT/i.test(s.slice(0, 300))) return '';
  if (/상속세과세표준신고및자진납부계산서|별지제9호서식|상속세과세가액계산명세서|상속인별상속재산및평가명세서|채무[ㆍ·]?공과금[ㆍ·]?장례비용및상속공제명세서|금융재산상속공제신고서/.test(s)) return '상속세 신고서';
  if (/상속세/.test(s) && /결정통지|결정결의서|과세표준및세액의결정|세액계산내용/.test(s) && !/소명자료/.test(s)) return '조사청 결정통지';
  if (/상담자료|세무대리인선임/.test(s)) return '사무소 상담자료';
  var notice = /nts\.go\.kr|조사관|소명(을)?바랍니다|소명요청|확인요청|수증혐의|세무조사사전통지|조사재개|자료제출요구/.test(s);
  var reply = /소명자료|소명내용|거래경위|거래의경위|첨부자료|사실관계/.test(s);
  if (reply && /소명|조사/.test(s)) return '이미 낸 소명';
  if (notice && /소명|조사|혐의|확인요청/.test(s)) return '조사청 안내';
  return '';
}

// ---------- ① 상속세 신고서 ----------
// text = 글자 기억(ocrtxt), tbl = 같은 변환의 칸 자리 지킨 표 글(ocrtbl1_ — 있으면 표가 더 정확)
function finFdParseReturn_(text, tbl) {
  var T = String(tbl || text || '').replace(/\s+/g, ' '), P = String(text || '').replace(/\s+/g, ' ');
  var out = { 재산: [], 상속인: [], 채무: [], 장례: [] };
  // 상속개시일(⑫) — 「상속개시일」 뒤 가까운 날짜
  [P, T].some(function (t) {
    var at = t.search(/상\s*속\s*개\s*시\s*일/); if (at < 0) return false;
    var m = /((?:19|20)\d{2})\s*[-.년]\s*(\d{1,2})\s*[-.월]\s*(\d{1,2})/.exec(t.slice(at, at + 700)); if (!m) return false;
    out.D = finFdYmd_(m[1], m[2], m[3]); return true;
  });
  var dn = /사후관리위반신고\s*7\s*성\s*명\s*([가-힣]{2,4})/.exec(P) || /피\s*상\s*속\s*인[^가-힣]{0,30}성\s*명\s*([가-힣]{2,4})/.exec(P); if (dn) out.피상속인 = dn[1];
  var sn = /1\s*성\s*명\s*([가-힣]{2,4})\s*2\s*주민/.exec(P); if (sn) out.신고인 = sn[1];
  var ag = /13\s*성\s*명\s*([^\d]{2,20}?)\s*14\s*사업자/.exec(P); if (ag) out.세무대리인 = ag[1].trim();
  var kd = /\[\s*(√|V|v|✓)\s*\]\s*(기한\s*내\s*신고|수정\s*신고|기한\s*후\s*신고)/.exec(P); out.신고구분 = kd ? kd[2].replace(/\s/g, '') : '';
  // 부표 1 — 상속받은 총재산명세(「[ ]여[V]부」 국외자산 칸을 줄 표시로 씀)
  var s1 = T.search(/총\s*재\s*산\s*명\s*세/), e1 = (function () { var re = /별지\s*제\s*9\s*호\s*서식\s*부\s*표\s*2/g, m; while ((m = re.exec(T))) if (m.index > s1) return m.index; return T.length; })();
  if (s1 >= 0) {
    var seg = T.slice(s1, e1).split(/\[\s*[VvＶ√✓]?\s*\]\s*여\s*\[\s*[VvＶ√✓]?\s*\]\s*부/);
    for (var i = 1; i < seg.length; i++) {
      var code = (/(\d{2})\s*\|?\s*\|?\s*$/.exec(seg[i - 1]) || [])[1] || '';
      // 줄 끝 = 다음 줄의 재산종류코드(「| | 11 |」) 앞 · 빈 칸 셋 이어짐(합계 칸) 앞. 계좌번호 칸만 빈 「국민은행 | | 1 | 9,468」은 한 줄로 둠
      var row = seg[i].replace(/^[\s|]+/, '').replace(/\|\s*\|\s*\d{2}\s*\|?\s*$/, ''), cut = row.search(/\|\s*\|\s*\|/); row = cut > 0 ? row.slice(0, cut) : row.slice(0, 200);
      row = row.split(/\s(?:상\s*속\s*세\s*과\s*세|1\s*재\s*산\s*구\s*분|계\s*\|)/)[0];
      var cells = row.indexOf('|') >= 0 ? row.split('|').map(function (c) { return c.trim(); }) : null;
      var acctM = /(\d{2,8}(?:-\d{1,8}){1,4}|\d{10,16})/.exec(row);
      var nums = (cells ? cells : row.replace(/\s\d{2}\s*$/, '').split(/\s+/)).map(function (c) { return String(c).trim(); }).filter(function (c) { return /^[\d,]+(\.\d+)?$/.test(c) && (!acctM || c !== acctM[1]); });
      var val = nums.length ? finFdNum_(nums[nums.length - 1]) : null;
      var name = cells ? (cells.filter(function (c) { return c && !/^[\d,.%\-]+$/.test(c); })[0] || '') : row.replace(acctM ? acctM[1] : '\u0000', ' ').replace(/[\d,.%]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!name || val == null) continue;
      out.재산.push({ 코드: code, 이름: name.slice(0, 60), 계좌: acctM && !/번지|호|동|산\s*\d/.test(name) ? acctM[1] : '', 금액: val });
    }
  }
  // 부표 1 나. 과세가액 계산 — 칸 ⑩~㉘ 숫자 19개(⑫ = ⑩ + ⑪, ㉑ = ㉒ + ㉓ + ㉔로 맞는지 보고 씀)
  var tm = /제\s*3\s*0\s*조\s*의\s*6\s*\|?\s*((?:[\d,]+\s+){18}[\d,]+)\s*2\s*9\s*상\s*속\s*세\s*과\s*세\s*가\s*액/.exec(T);
  if (tm) {
    var n = tm[1].trim().split(/\s+/).map(finFdNum_);
    if (n.length === 19 && n[2] === n[0] + n[1] && n[11] === n[12] + n[13] + n[14]) out.과세가액계산 = { 상속재산가액: n[0], 처분재산산입: n[1], 합계: n[2], 공과금: n[12], 장례비: n[13], 채무: n[14], 가산증여: n[15], 가산증여13조: n[16] };
  }
  var gv = /2\s*9\s*상\s*속\s*세\s*과\s*세\s*가\s*액[^\d]{0,60}([\d,]{5,})/.exec(T); if (gv) out.과세가액 = finFdNum_(gv[1]);
  var cg = /3\s*1\s*상\s*속\s*공\s*제\s*금\s*액\s*합\s*계\s*([\d,]{5,})/.exec(T); if (cg) out.상속공제 = finFdNum_(cg[1]);
  // 부표 2 — 상속인별(이름·관계·법정 지분·실제 상속재산가액·§13 가산 증여재산)
  var hr = /\|\s*([가-힣]{2,4})\s*\|\s*\d{6}\s*-\s*\d{7}\s*\|[^|]*\|\s*[^|]*\|\s*([\d]+\s*\/\s*[\d]+|[\d.]+)\s*\|\s*([\d,]+)\s*\|\s*([\d.]+)\s*\|\s*관\s*계[^가-힣]*(?:실\s*제\s*상\s*속\s*재\s*산\s*가\s*액)?\s*([가-힣]{1,4})\s+([\d,]+)/g, hm;
  while ((hm = hr.exec(T))) {
    var tail = T.slice(hm.index, hm.index + 3000), g13 = /2\s*5\s*「\s*상\s*속\s*세\s*및\s*증\s*여\s*세\s*법\s*」\s*제\s*1\s*3\s*조[\s|]*([\d,]+)/.exec(tail);
    out.상속인.push({ 이름: hm[1], 관계: hm[5].replace(/\s/g, ''), 법정지분: hm[2].replace(/\s/g, ''), 실제가액: finFdNum_(hm[6]), 가산증여: g13 ? finFdNum_(g13[1]) : null });
  }
  // 부표 3 가. 채무 — 발생·종료·채권자 줄과 「01.금융채무 3,171,499 …」 종류·금액 차례를 짝지음
  var c0 = T.search(/가\s*\.\s*채\s*무/), c1 = T.search(/나\s*\.\s*공\s*과\s*금/);
  if (c0 >= 0 && c1 > c0) {
    var ct = T.slice(c0, c1), rows = [], rm, rr = /(\d{4}-\d{2}\s*-\s*\d{2})\s*\|\s*(\d{4}-\d{2}\s*-\s*\d{2})?\s*\|\s*([^|]{1,40}?)\s*\|\s*([\d-]{6,14})?/g;
    while ((rm = rr.exec(ct))) rows.push({ 발생: rm[1].replace(/\s/g, ''), 종료: (rm[2] || '').replace(/\s/g, ''), 채권자: rm[3].trim(), 번호: rm[4] || '' });
    var am = [], ar = /(\d{2})\s*\.\s*([가-힣]{2,6})\s+([\d,]{3,})/g, aa; while ((aa = ar.exec(ct))) am.push({ 종류: aa[2], 금액: finFdNum_(aa[3]) });
    rows.forEach(function (r, i) {
      var a = am[i] || {}, person = /^\d{6}-\d{7}$/.test(r.번호) || (/^[가-힣]{2,4}$/.test(r.채권자) && !/카드|은행|금고|보험|공사|공단/.test(r.채권자));
      out.채무.push({ 발생: r.발생, 종료: r.종료, 채권자: r.채권자, 종류: a.종류 || '', 금액: a.금액 == null ? null : a.금액, 개인: person || /개인|사채/.test(a.종류 || '') });
    });
  }
  // 부표 3 장례비용(별지) — 지급처·내역 줄과 「사업자번호 금액」 차례를 짝지음
  var f0 = T.search(/장\s*례\s*비\s*용\s*상\s*속\s*공\s*제\s*명\s*세\s*서\s*\(\s*별\s*지\s*\)/);
  if (f0 >= 0) {
    var ft = T.slice(f0, f0 + 4000).split(/별\s*지\s*제\s*5\s*호|금융재산\s*상속공제/)[0], names = [], nm, nr = /\|\s*([^|\d]{2,30}?)\s*\|\s*([^|\d]{1,20}?)\s*\|/g;
    var body = ft.replace(/^[\s\S]*?지급내역\s*\|/, '');
    while ((nm = nr.exec(body))) { var a1 = nm[1].trim(), b1 = nm[2].trim(); if (a1 && b1 && !/성명|상호|지급|주민|금액/.test(a1 + b1)) names.push({ 지급처: a1, 내역: b1 }); nr.lastIndex = nm.index + nm[0].length - 1; }
    var pays = [], pr = /(\d{3}-\d{2}-\d{5})\s+([\d,]{3,})/g, pp; while ((pp = pr.exec(ft))) pays.push(finFdNum_(pp[2]));
    names.forEach(function (x, i) { if (pays[i] != null) out.장례.push({ 지급처: x.지급처, 내역: x.내역, 금액: pays[i] }); });
  }
  var fs0 = /장\s*례\s*비\s*용[^\d]{0,40}1\s*7\s*계\s*([\d,]{4,})/.exec(T); if (fs0) out.장례비계 = finFdNum_(fs0[1]);
  // 금융재산 상속공제 신고서(별지 제5호서식) — 금융재산·금융채무 합계
  var fa = /①\s*합\s*계\s*\|?\s*종\s*류\s*가\s*액\s*([\d,]{3,})/.exec(T) || /가\s*[-−~]\s*1\s*\.\s*금\s*융\s*재\s*산[\s\S]{0,400}?1\s*합\s*계\s*([\d,]{3,})/.exec(P); if (fa) out.금융재산합계 = finFdNum_(fa[1]); // 표 글 · 글자만(스캔본)
  var fb = /②\s*합\s*계\s*\|?\s*종\s*류\s*가\s*액[^②]{0,120}?([\d,]{3,})\s*3\s*\.\s*금\s*융/.exec(T); if (fb) out.금융채무합계 = finFdNum_(fb[1]);
  return out;
}

// ---------- ② 조사청 안내(소명 요청) ----------
// 글이 사건마다 달라 날짜·금액·지번·매수인만 뽑는다. 항목 = 「○」·「1.」 등으로 나뉜 덩어리
function finFdParseNotice_(text, fname) {
  var t = String(text || '').replace(/\s+/g, ' '), out = { 차수: finFdRound_(String(fname || '') + ' ' + t.slice(0, 200)), 항목: [], 조사관: '' };
  var ob = /(?:담당자?\s*:?\s*)?\(?\s*(0\d{1,2}-\d{3,4}-\d{4})\s*\)?\s*([가-힣]{2,4})\s*조사관/.exec(t); if (ob) out.조사관 = ob[2] + ' 조사관';
  t.split(/○|◦|•|□|(?=\s\d\.\s?[가-힣])/).forEach(function (p) {
    p = p.trim(); if (p.length < 6) return;
    var dates = [], dr = /((?:19|20)\d{2})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})/g, dm; while ((dm = dr.exec(p))) dates.push(finFdYmd_(dm[1], dm[2], dm[3]));
    var amt = null, am = /\(\s*([\d,]{5,})\s*\)/.exec(p) || /([\d,]{7,})\s*원/.exec(p);
    if (am) amt = finFdNum_(am[1]); else { var ek = /(\d+(?:\.\d+)?)\s*억/.exec(p); if (ek) amt = Math.round(Number(ek[1]) * 100000000); }
    // 갈래는 덩어리 앞부분으로(뒤에 다음 항목 글 「3. 2년 내 처분재산 …」이 붙어 오는 일이 있음 — 11-26 실제 안내문)
    var head = p.slice(0, 90), kind = /이체|송금|수증/.test(head) ? '이체' : /처분|매각|양도/.test(head) ? '처분' : /인출|엑셀|사용처/.test(head) ? '인출' : /처분|매각|양도/.test(p) ? '처분' : /이체|송금|수증|증여/.test(p) ? '이체' : '';
    if (!kind || (!dates.length && !amt)) return;
    var buyer = (/\(\s*[\d,]{5,}\s*\)\s*([가-힣]{2,8})\s*원/.exec(p) || [])[1] || '';
    var lot = (/((?:[가-힣]+(?:시|군|구)\s*)?[가-힣]+(?:읍|면|동)\s*[가-힣]*(?:리|동)?\s*(?:산\s*)?(?:번지\s*)?\d+(?:-\d+)?)/.exec(p) || [])[1] || '';
    out.항목.push({ 종류: kind, 날짜: dates[0] || '', 날짜들: dates, 금액: amt, 상대: buyer, 지번: lot.replace(/\s+/g, ' ').trim(), 글: p.slice(0, 160) });
  });
  return out;
}
function finFdRound_(s) { var m = /([1-9])\s*차/.exec(String(s || '')); return m ? Number(m[1]) : 0; }

// ---------- ④ 이미 낸 소명 — 날짜 + 금액이 붙어 있는 곳(통장 줄과 짝지을 단서) ----------
function finFdParseReply_(text, fname) {
  var t = String(text || '').replace(/\s+/g, ' '), out = { 차수: finFdRound_(String(fname || '') + ' ' + t.slice(0, 300)), 초안: /초안/.test(String(fname || '') + t.slice(0, 200)), 줄: [] };
  var dr = /((?:19|20)\d{2})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})\.?/g, m, seen = {};
  while ((m = dr.exec(t)) && out.줄.length < 300) {
    var after = t.slice(m.index + m[0].length, m.index + m[0].length + 90), d = finFdYmd_(m[1], m[2], m[3]);
    var am = /(?:^|[^\d-])([\d]{1,3}(?:,\d{3}){1,4})(?![\d-])/.exec(after), ek = /(\d+(?:\.\d+)?)\s*억\s*원?/.exec(after), v = null;
    if (am && (!ek || am.index < ek.index)) v = finFdNum_(am[1]); else if (ek) v = Math.round(Number(ek[1]) * 100000000);
    if (!v || v < 100000) continue;
    var k = d + '|' + v; if (seen[k]) continue; seen[k] = 1;
    var ctx = after.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '').replace(/[\d,]{5,}/g, '').replace(/\s-\s/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    out.줄.push({ 날짜: d, 금액: v, 글: ctx });
  }
  return out;
}

// ---------- ③ 조사관 지정 거래 표(엑셀 시트 줄들) ----------
function finFdParseDesig_(sheets) {
  var out = { 머리: null, 줄: [] };
  (sheets || []).forEach(function (s) {
    var rows = (s.rows || []).map(function (r) { return (r || []).map(function (v) { return String(v == null ? '' : v).trim(); }); });
    for (var hi = 0; hi < Math.min(rows.length, 15); hi++) {
      var h = rows[hi].map(function (c) { return c.replace(/\s+/g, ''); });
      var col = function (re) { for (var j = 0; j < h.length; j++) if (re.test(h[j])) return j; return -1; };
      var cU = col(/^사용처/), cG = col(/^근거/), cD = col(/거래일자|^일자$|거래일$/), cO = col(/지급|출금/), cI = col(/입금/), cA = col(/^계좌번호$|^계좌$/), cB = col(/^은행|금융기관/);
      if (cU < 0 || cD < 0 || (cO < 0 && cI < 0)) continue;
      if (!out.머리) out.머리 = rows[hi].slice();
      var cN = col(/^내용$|적요/), cC = col(/상대은행|거래상대방은행/), cK = col(/상대계좌/), cH = col(/계좌주|예금주/);
      rows.slice(hi + 1).forEach(function (r) {
        var d = finRvYmd_(r[cD]); if (!d) { var sn = finFdNum_(r[cD]); if (sn && sn > 20000 && sn < 80000) d = new Date(Date.UTC(1899, 11, 30) + sn * 86400000).toISOString().slice(0, 10); }
        var o = cO >= 0 ? finFdNum_(r[cO]) : null, i = cI >= 0 ? finFdNum_(r[cI]) : null; if (!d || (!(o > 0) && !(i > 0))) return;
        out.줄.push({ 시트: s.sheet, 은행: cB >= 0 ? r[cB] : '', 계좌: cA >= 0 ? r[cA] : '', 예금주: cH >= 0 ? r[cH] : '', 날짜: d, 지급: o > 0 ? o : 0, 입금: i > 0 ? i : 0, 내용: cN >= 0 ? r[cN] : '', 상대은행: cC >= 0 ? r[cC] : '', 상대계좌: cK >= 0 ? r[cK] : '', 사용처: r[cU] || '', 근거: cG >= 0 ? r[cG] || '' : '', 원본: r.slice(0, (out.머리 || r).length) });
      });
      break;
    }
  });
  return out;
}

// 서류 읽기(finDocsScan_)가 갈래를 안 서류의 내용을 더 읽음 — 신고서는 표 글(ocrtbl1_)이 있으면 그것으로
function finFdDocExtra_(p, text, f) {
  var z = p && p.조사; if (!z) return;
  if (z.kind === '상속세 신고서') { var tb = ''; try { tb = f && f.id && f.modified ? (tcOcrStoreGet_('ocrtbl1_' + f.id + '_' + f.modified) || '') : ''; } catch (e) { tb = ''; } z.신고 = finFdParseReturn_(text, tb); }
  else if (z.kind === '조사청 안내') z.안내 = finFdParseNotice_(text, f && f.name);
  else if (z.kind === '이미 낸 소명') z.소명 = finFdParseReply_(text, f && f.name);
}

// ---------- 서류 → U.filed(신고서) · U.audit(조사청 안내·이미 낸 소명·지정 표) — finDocsApply_가 부름 ----------
function finFdCollect_(U) {
  var D = U.docs || {}, best = null, notices = [], replies = [], desig = [], kinds = {};
  Object.keys(D).forEach(function (id) {
    var o = D[id]; if (id === '_v' || !o || !o.p || !o.p.조사) return;
    var z = o.p.조사; kinds[z.kind] = (kinds[z.kind] || 0) + 1;
    if (z.신고) { var sc = (z.신고.재산 || []).length * 3 + (z.신고.상속인 || []).length * 2 + (z.신고.D ? 2 : 0) + (z.신고.채무 || []).length; if (!best || sc > best.sc) best = { sc: sc, v: z.신고, from: o.이름 }; }
    if (z.안내) notices.push(Object.assign({ from: o.이름 }, z.안내));
    if (z.소명) replies.push(Object.assign({ from: o.이름 }, z.소명));
    if (z.지정) (z.지정.줄 || []).forEach(function (r) { desig.push(Object.assign({ from: o.이름, 머리: z.지정.머리 }, r)); });
  });
  // 같은 안내를 여러 장(안내문 PDF·안내 메일 화면 그림)으로 받은 사건 — 같은 항목(갈래·날짜·금액)은 한 번만. 차수가 적힌 것·매수인이 읽힌 것이 이김
  notices.sort(function (a, b) { return (b.차수 || 0) - (a.차수 || 0) || (b.항목 || []).filter(function (x) { return x.상대; }).length - (a.항목 || []).filter(function (x) { return x.상대; }).length || (a.from < b.from ? -1 : 1); });
  var seenN = {}; notices.forEach(function (N) { N.항목 = (N.항목 || []).filter(function (it) { var k = it.종류 + '|' + it.날짜 + '|' + (it.금액 || ''); if (seenN[k]) return false; seenN[k] = 1; return true; }); });
  // 지정 표가 여러 판(수정본 등)이면 같은 거래(계좌 끝 6자리·날짜·금액)는 한 번 — 사용처가 적힌 판이 이김
  var dd = {}; desig.forEach(function (r) { var k = String(r.계좌).replace(/\D/g, '').slice(-6) + '|' + r.날짜 + '|' + r.지급 + '|' + r.입금; if (!dd[k] || (!dd[k].사용처 && r.사용처)) dd[k] = r; });
  desig = Object.keys(dd).map(function (k) { return dd[k]; }).sort(function (a, b) { return a.날짜 < b.날짜 ? -1 : a.날짜 > b.날짜 ? 1 : 0; });
  // 신고서가 서식마다 따로 저장된 사건(별지 제9호·부표 1·별지 제5호가 각각 한 파일) — 가장 많이 읽힌 파일을 바탕으로 빈 칸을 다른 파일에서 채움
  var filed = best ? Object.assign({ from: best.from }, best.v) : null;
  if (filed) Object.keys(D).forEach(function (id) {
    var o = D[id], v = o && o.p && o.p.조사 && o.p.조사.신고; if (!v || v === best.v) return;
    ['D', '피상속인', '신고인', '세무대리인', '신고구분', '과세가액', '상속공제', '금융재산합계', '금융채무합계', '과세가액계산', '장례비계'].forEach(function (k) { if ((filed[k] == null || filed[k] === '') && v[k] != null && v[k] !== '') filed[k] = v[k]; });
    ['재산', '상속인', '채무', '장례'].forEach(function (k) { if (!(filed[k] || []).length && (v[k] || []).length) filed[k] = v[k]; });
    if (filed.from.indexOf(o.이름) === -1) filed.from += ' · ' + o.이름;
  });
  var audit = (notices.length || replies.length || desig.length || kinds['조사청 결정통지']) ? { 안내: notices, 소명: replies, 지정: desig, 결정통지: kinds['조사청 결정통지'] || 0 } : null;
  var changed = JSON.stringify([filed, audit]) !== JSON.stringify([U.filed || null, U.audit || null]);
  U.filed = filed; U.audit = audit;
  return changed;
}
// 조사·경정·불복 사건(짚을 곳 E·받을 자료는 이 사건들만 — 계획서 ㉠·㉤)
// 결정통지만 있는 것은 넣지 않음 — 지난 상속의 결정통지가 신고 사건 폴더에 참고로 들어 있는 일이 있음(11-26 다른 상속 사건: 2015년 상속 결정통지)
function finFdAuditCase_(U) { return /세무조사|_조사|조사_|경정|불복|이의신청|심판|심사|수정신고/.test(String(U.caseFolder || '')) || !!(U.audit && ((U.audit.안내 || []).length || (U.audit.지정 || []).length)); }

// ---------- 분석 앞 단계 — 신고 장례비 지급처와 같은 상호·금액인 출금 줄은 성격 「장례비」(세무사님·넥스 성격이 없고 성격을 못 정한 줄만) ----------
function finFdPre_(R, U, B, urow) {
  var F = U.filed; if (!F || !(F.장례 || []).length || !B.D) return;
  F.장례.forEach(function (p) {
    var nm = finRvNorm_(String(p.지급처).replace(/\(주\)|주식회사|㈜/g, ''));
    R.forEach(function (r) {
      if (!r.own || !(r.out > 0) || r.d < finRvAddD_(B.D, -3) || r.d > finRvAddD_(B.D, 60) || urow(r).성격 || r.natWho === 'nex' || r.natWord) return;
      var hit = (nm.length >= 2 && finRvNorm_(r.txt || '').indexOf(nm.slice(0, Math.min(nm.length, 6))) !== -1) || (p.금액 && Math.abs(r.out - p.금액) < 1);
      if (!hit || (r.nature && !/용도 모름|되풀이|^$/.test(r.nature) && !/장례/.test(r.nature))) return;
      r.nature = '장례비(신고 부표 3 — ' + p.지급처 + ')'; r.fdFuneral = p;
    });
  });
}

// ---------- 짚을 곳 E(신고와 다른 곳)·F(조사청이 묻는 곳) — finRvAnalyze_가 짚을 곳을 다 모은 뒤 부름 ----------
function finFdFlags_(fl, A, U) {
  var B = A.B, T = B.T, R = A.R, F = U.filed, AU = U.audit, audit = finFdAuditCase_(U);
  var lane = function (x) { return x ? (x.갈래 || x.짐작 || '') : ''; };
  var cmp = A.filedCmp = [];   // 「신고와 맞대기」 탭 줄: [항목, 신고 값, 통장에서 찾은 값, 차이, 근거, 줄들]
  var near = function (a, b, pct) { return a != null && b != null && Math.abs(a - b) <= Math.max(10000, Math.abs(b) * (pct || 0.01)); };
  var markRow = function (r, memo) { if (!r) return; r.fdMemo = (r.fdMemo ? r.fdMemo + ' · ' : '') + memo; };
  var who = function (r) { return r.party ? r.party.이름 : r.best ? r.best.raw : ''; };
  // 상속개시일 통장 잔액(계좌마다 그날까지 마지막 잔액)
  var balAt = function (a) { if (!B.D) return null; var L = a.rows.filter(function (r) { return r.d <= B.D; }).sort(function (p, q) { return p.d < q.d ? -1 : p.d > q.d ? 1 : (p.t || '') < (q.t || '') ? -1 : 1; }); if (!L.length) return null; var z = L[L.length - 1]; return z.bal != null ? z.bal : null; };
  if (F) {
    // E1·E2 — 신고 금융재산 줄(재산종류코드 11·금융 이름)과 통장 계좌
    if (!(F.재산 || []).length) cmp.push(['부표 1 상속받은 총재산명세', '', '', '', '신고서 재산 줄을 글자로 읽지 못함(스캔 모양이라 칸이 흩어짐) — 원본 확인 [확인 필요]', []]);
    var fin = (F.재산 || []).filter(function (p) { return p.코드 === '11' || /은행|금고|신협|농협|축협|우체국|증권|투자|생명|화재|보험|저축/.test(p.이름); });
    var kindOf = function (p) { return /생명|화재|보험|손해/.test(p.이름) ? '보험' : /증권|투자/.test(p.이름) ? '증권' : '예금'; };
    var accts = A.accts.filter(function (a) { return a.own; }).map(function (a) { return { a: a, bal: balAt(a), used: false }; });
    // 짝 차례: ① 계좌번호 ② 같은 기관·개시일 잔액이 꼭 같음 ③ 같은 기관·1만원 또는 1% 안(여럿이면 가장 가까운 계좌) — 계획서 ㉡
    var pairs = fin.map(function (p) { return { p: p, m: null, kind: kindOf(p) }; });
    var take = function (q, m) { if (m) { m.used = true; q.m = m; } };
    pairs.forEach(function (q) { var dg = String(q.p.계좌 || '').replace(/\D/g, ''); if (dg.length >= 8) take(q, accts.filter(function (x) { return !x.used && finRvAcctLike_(x.a.dg || x.a.acct, dg); })[0]); });
    [0.5, null].forEach(function (tol) {
      pairs.forEach(function (q) {
        if (q.m || q.kind !== '예금') return; var org = finOrgNorm_(q.p.이름);
        take(q, accts.filter(function (x) { return !x.used && x.bal != null && finOrgNorm_(x.a.org) === org && (tol != null ? Math.abs(x.bal - q.p.금액) <= tol : near(x.bal, q.p.금액, 0.01)); }).sort(function (x, y) { return Math.abs(x.bal - q.p.금액) - Math.abs(y.bal - q.p.금액); })[0]);
      });
    });
    pairs.forEach(function (q) {
      var p = q.p, m = q.m, diff = m && m.bal != null ? m.bal - p.금액 : null;
      cmp.push(['E1 금융재산 — ' + p.이름 + (p.계좌 ? ' ' + p.계좌 : ''), p.금액, m ? (m.bal == null ? '(개시일 잔액 없음)' : m.bal) : q.kind === '예금' ? '(거래내역 없음)' : '(' + q.kind + ' — 통장 아님)', diff == null ? '' : diff, m ? '통장 ' + m.a.acct + (String(p.계좌 || '').replace(/\D/g, '').length >= 8 && finRvAcctLike_(m.a.dg || m.a.acct, p.계좌) ? '(계좌번호로 짝)' : '(같은 기관·개시일 잔액으로 짝 — [확인 필요] 같은 계좌인지)') : '', []]);
      if (audit && m && diff != null && Math.abs(diff) >= T.목록기준) fl('E1', 'fin:' + (p.계좌 || p.이름) + ':' + p.금액, { 갈래: 'E 신고와 다른 곳', 짚을것: p.이름 + ' — 신고 ' + finRvWon_(p.금액) + '원 · 상속개시일 통장 잔액 ' + finRvWon_(m.bal) + '원', 날짜: B.D, 금액: Math.abs(diff), 상대: m.a.acct, 까닭: '신고한 금융재산과 상속개시일 잔액이 다르다 — 과세관청은 개시일 잔액을 조회로 안다', 준비: '개시일 잔액증명·신고 평가 근거' });
      if (!m && audit && q.kind !== '보험') fl('E2', 'filed:' + (p.계좌 || p.이름) + ':' + p.금액, { 갈래: 'E 신고와 다른 곳', 짚을것: p.이름 + (p.계좌 ? ' ' + p.계좌 : '') + ' — 신고에 있으나 거래내역이 없음', 날짜: '', 금액: p.금액, 상대: p.이름, 까닭: '신고한 ' + (q.kind === '증권' ? '증권 계좌' : '계좌') + '의 10년 거래내역이 없으면 그 계좌로 오간 돈을 볼 수 없다', 준비: p.이름 + ' 거래내역(10년)', want: { 무엇: p.이름 + (p.계좌 ? ' ' + p.계좌 : '') + ' 거래내역(10년)', 왜: '신고서 금융재산에 있음' } });
    });
    accts.forEach(function (x) {
      if (!fin.length) return; // 신고서 재산 줄을 못 읽었으면 「신고에 없음」이라고 말할 수 없음
      if (x.used || x.bal == null || Math.abs(x.bal) < T.목록기준) return;
      cmp.push(['E2 통장에만 있는 계좌 — ' + x.a.acct, '', x.bal, x.bal, '신고서 금융재산에 같은 기관·금액 줄 없음', []]);
      if (audit) fl('E2', 'acct:' + x.a.acct, { 갈래: 'E 신고와 다른 곳', 짚을것: x.a.acct + ' — 상속개시일 잔액 ' + finRvWon_(x.bal) + '원이 신고서에 없음', 날짜: B.D, 금액: x.bal, 상대: x.a.acct, 까닭: '상속개시일 잔액은 상속재산 — 신고에서 빠졌거나 다른 이름·번호로 적혔는지', 준비: '신고서 금융재산 명세·개시일 잔액증명' });
    });
    if (F.금융재산합계 != null) { var tot = accts.reduce(function (s, x) { return s + (x.bal || 0); }, 0); cmp.push(['금융재산 합계(금융재산 상속공제 신고서 ①)', F.금융재산합계, tot, tot - F.금융재산합계, '통장 쪽은 이 시트에 있는 피상속인 계좌의 개시일 잔액 합(보험·증권 빠짐)', []]); }
    // E3 — 신고 사전증여(§13 가산, 받은 사람) ↔ 통장에서 간 돈(사전증여 셈)
    var g13 = {}; (F.상속인 || []).forEach(function (h) { if (h.가산증여) g13[finRvNorm_(h.이름)] = h.가산증여; });
    var cg = F.과세가액계산 || {}; cmp.push(['㉖ 가산하는 증여재산가액(§13) 합계', cg.가산증여 == null ? '' : cg.가산증여, A.s13.reduce(function (s, x) { return s + Math.max(0, x.순액 - (x.사회통념 || 0)); }, 0), '', '통장 쪽은 「사전증여(§13)」 셈의 나머지 순액 합(증여인지는 판단 전)', []]);
    A.s13.forEach(function (s) {
      var known = (F.상속인 || []).length > 0, nm = finRvNorm_(s.x.이름), dec = g13[nm] || 0, rest = s.순액 - (s.사회통념 || 0);
      if (!s.나감 && !s.들어옴) return;
      cmp.push(['E3 사전증여 — ' + s.x.이름 + '(' + lane(s.x) + ')', known ? dec : '', rest, known ? rest - dec : '', s.yrs + '년 안 나감 ' + finRvWon_(s.나감) + ' · 들어옴 ' + finRvWon_(s.들어옴), []]);
      if (audit && known && rest - dec >= T.큰돈) fl('E3', 'gift:' + s.x.이름, { 갈래: 'E 신고와 다른 곳', 짚을것: s.x.이름 + '에게 간 돈 — 신고 사전증여 ' + finRvWon_(dec) + '원 · 통장 순액 ' + finRvWon_(rest) + '원', 날짜: '', 금액: rest - dec, 상대: s.x.이름, 까닭: '신고하지 않은 사전증여로 볼 수 있다(§13) — 대여·생활비·자기 돈 왕복인지', 준비: '그 돈의 성격(차용증·쓰임)', rows: R.filter(function (r) { return r.party === s.x && r.out > 0 && finRvBefore_(r, B, s.yrs); }).slice(0, 200) });
    });
    // E4 — 신고 채무(개인 채권자) ↔ 그날 들어온 돈·갚은 흔적
    (F.채무 || []).forEach(function (c) {
      if (!c.개인) { cmp.push(['E4 채무 — ' + c.채권자 + '(' + (c.종류 || '') + ')', c.금액, '', '', '금융채무 — 금융재산 상속공제 신고서와 같이 봄', []]); return; }
      var inn = R.filter(function (r) { return r.own && r.in > 0 && c.발생 && Math.abs(finRvDays_(c.발생, r.d)) <= 5 && (near(r.in, c.금액, 0.01) || finTgNameNear_(who(r), c.채권자)); });
      var back = R.filter(function (r) { return r.own && r.out > 0 && c.발생 && r.d >= c.발생 && (who(r) && finTgNameNear_(who(r), c.채권자)); });
      var inSum = inn.reduce(function (s, r) { return s + r.in; }, 0), backSum = back.reduce(function (s, r) { return s + r.out; }, 0);
      cmp.push(['E4 채무 — ' + c.채권자 + '(' + (c.종류 || '개인') + ', ' + c.발생 + ')', c.금액, inSum, inSum - (c.금액 || 0), '그날 앞뒤 5일 들어온 돈 ' + inn.length + '줄 · 그 뒤 채권자에게 나간 돈 ' + finRvWon_(backSum) + '원', inn.concat(back)]);
      inn.forEach(function (r) { markRow(r, '신고 채무 ' + c.채권자 + ' ' + finRvWon_(c.금액) + '원(부표 3)'); });
      if (audit) fl('E4', 'debt:' + c.채권자 + ':' + c.발생, { 갈래: 'E 신고와 다른 곳', 짚을것: '신고 채무 ' + c.채권자 + ' ' + finRvWon_(c.금액) + '원(' + c.발생 + ') — ' + (inn.length ? '그날 앞뒤 들어온 돈 ' + finRvWon_(inSum) + '원' : '그날 앞뒤 들어온 돈 없음'), 날짜: c.발생, 금액: c.금액, 상대: c.채권자, 까닭: '개인에게 진 채무(특히 상속인)는 빌린 돈이 실제로 들어왔는지·이자·갚은 흔적·남은 원금을 본다(§14 채무 공제)' + (backSum ? ' — 그 뒤 채권자에게 나간 돈 ' + finRvWon_(backSum) + '원' : ''), 준비: '차용증·이자 지급·남은 원금 근거', rows: inn.concat(back) });
    });
    // E6 — 신고 장례비 ↔ 통장
    (F.장례 || []).forEach(function (p) { var L = R.filter(function (r) { return r.fdFuneral === p; }); cmp.push(['E6 장례비 — ' + p.지급처 + '(' + p.내역 + ')', p.금액, L.reduce(function (s, r) { return s + r.out; }, 0), '', L.length ? '피상속인 통장에서 나감 ' + L.length + '줄 — 성격 「장례비」' : '피상속인 통장에서 나간 줄 없음(상속인이 낸 것일 수 있음)', L]); });
    // E7 — 신고 처분재산 산입(⑪) ↔ 우리 셈 추정상속
    A.s15.forEach(function (s) {
      cmp.push(['E7 추정상속 ' + s.y + '년 — 신고 ⑪ 처분재산 등 산입액 ↔ 우리 셈 추정액', cg.처분재산산입 == null ? '' : cg.처분재산산입, s.추정, cg.처분재산산입 == null ? '' : s.추정 - cg.처분재산산입, '순인출 ' + finRvWon_(s.순) + ' · 미소명 ' + finRvWon_(s.미소명) + '(「추정상속(§15)」 탭)', []]);
    });
    var s2 = A.s15[1]; if (audit && s2 && s2.추정 > 0 && s2.추정 - (cg.처분재산산입 || 0) >= T.큰돈) fl('E7', 'est', { 갈래: 'E 신고와 다른 곳', 짚을것: '신고 처분재산 등 산입액 ' + finRvWon_(cg.처분재산산입 || 0) + '원 · 우리 셈 2년 추정액 ' + finRvWon_(s2.추정) + '원', 날짜: B.D ? finRvAddY_(B.D, -2) + ' ~ ' + B.D : '', 금액: s2.추정 - (cg.처분재산산입 || 0), 까닭: '과세관청은 2년 안 인출을 같은 방식으로 셈한다(§15) — 소명되지 않은 만큼이 추가 과세', 준비: '「추정상속(§15)」 탭 줄별 쓰임' });
    // E8 — 신고 상속인 ↔ 분석대상자
    var hs = (F.상속인 || []).map(function (h) { return h.이름; }), ours = A.rels.filter(function (x) { return lane(x) === '상속인'; }).map(function (x) { return x.이름; });
    if (hs.length) cmp.push(['E8 상속인', hs.join(' · '), ours.join(' · '), '', (F.상속인 || []).map(function (h) { return h.이름 + '(' + h.관계 + ', 법정 ' + h.법정지분 + ')'; }).join(' · '), []]);
    var miss = hs.filter(function (n) { return !ours.some(function (o) { return finTgNameNear_(o, n); }); }), extra = ours.filter(function (o) { return !hs.some(function (n) { return finTgNameNear_(o, n); }); });
    if (audit && hs.length && (miss.length || extra.length)) fl('E8', 'heirs', { 갈래: 'E 신고와 다른 곳', 짚을것: '상속인이 신고서와 분석대상자에서 다름' + (miss.length ? ' — 신고에만: ' + miss.join('·') : '') + (extra.length ? ' — 분석에만: ' + extra.join('·') : ''), 날짜: '', 금액: null, 까닭: '상속인(10년 합산)과 그 밖(5년)이 갈리면 사전증여 셈이 달라진다', 준비: '가족관계증명서·상속포기 여부' });
  }
  // F — 조사청이 묻는 곳
  if (AU) {
    var replyOf = function (r) { var hits = []; (AU.소명 || []).forEach(function (x) { (x.줄 || []).forEach(function (z) { if (z.날짜 === r.d && near(r.amt, z.금액, 0.001)) hits.push({ 차수: x.차수, 초안: x.초안, 글: z.글, from: x.from }); }); }); return hits; };
    var stateOf = function (rows, round) {
      var hs2 = []; rows.forEach(function (r) { replyOf(r).forEach(function (h) { hs2.push(h); }); });
      if (!hs2.length) return '';
      var mx = hs2.reduce(function (m, h) { return Math.max(m, h.차수 || 0); }, 0), dr = hs2.some(function (h) { return h.초안 && (h.차수 || 0) === mx; });
      if (round && mx && mx < round) return '다시 요청됨(' + round + '차)';
      return '소명 냄(' + (mx ? mx + '차' : '') + (dr ? ' 초안' : '') + ')';
    };
    // 이미 낸 소명 줄 → 거래 줄 메모(GAS)
    R.forEach(function (r) { if (!r.own || !r.amt) return; replyOf(r).forEach(function (h) { markRow(r, (h.차수 ? h.차수 + '차 ' : '') + '소명' + (h.초안 ? '(초안)' : '') + ': ' + (h.글 || h.from)); }); });
    (AU.안내 || []).forEach(function (N) {
      (N.항목 || []).forEach(function (it, ix) {
        if (it.종류 === '이체') {
          var L = R.filter(function (r) { return r.own && r.out > 0 && it.날짜 && Math.abs(finRvDays_(it.날짜, r.d)) <= 2 && (!it.금액 || near(r.out, it.금액, 0.001)); });
          L.forEach(function (r) { markRow(r, '조사청 ' + (N.차수 ? N.차수 + '차 ' : '') + '안내: ' + it.글.slice(0, 40)); });
          var st = stateOf(L, N.차수);
          fl('F1', 'tx:' + it.날짜 + ':' + (it.금액 || ''), { 갈래: 'F 조사청이 묻는 곳', 짚을것: (N.차수 ? N.차수 + '차 ' : '') + '안내 — ' + it.날짜 + ' ' + (it.금액 ? finRvWon_(it.금액) + '원 ' : '') + '이체' + (L.length ? '' : '(통장에서 그 줄을 못 찾음)'), 날짜: it.날짜, 금액: it.금액, 상대: L.length ? who(L[0]) : '', 까닭: '조사청 글: ' + it.글.slice(0, 120), 준비: '받은 사람·돈의 성격(증여·대여·생활비) 근거', rows: L, fdState: st, fdFrom: N.from, want: L.length ? null : { 무엇: it.날짜 + ' ' + (it.금액 ? finRvWon_(it.금액) + '원 ' : '') + '이체가 나간 피상속인 계좌의 그날 앞뒤 거래내역', 왜: '조사청이 물은 거래인데 이 시트 계좌에 그 줄이 없음' } });
        } else if (it.종류 === '처분') {
          var span = it.날짜 ? [finRvAddD_(it.날짜, -60), finRvAddD_(it.날짜, 400)] : null;
          // 매수인 이름이 통장 글자에 있거나(산림청은 소속 국유림관리소 이름으로 찍힘 — 11-26 실제 사건 「춘천국유림관리소」) 금액이 같은 입금
          var buyerRe = it.상대 ? new RegExp(/산림청/.test(it.상대) ? '산림청|국유림|산림' : finRvNorm_(it.상대).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : null;
          var Lin = R.filter(function (r) { return r.own && r.in > 0 && span && r.d >= span[0] && r.d <= span[1] && ((buyerRe && buyerRe.test(finRvNorm_(r.txt || ''))) || (it.금액 && near(r.in, it.금액, 0.001))); });
          var inSum = Lin.reduce(function (s, r) { return s + r.in; }, 0), first = Lin.length ? Lin.reduce(function (m, r) { return r.d < m ? r.d : m; }, Lin[0].d) : '';
          var Lout = first ? R.filter(function (r) { return r.own && r.out >= T.큰돈 && !r.inner && r.d >= first && r.d <= finRvAddD_(first, 90); }) : [];
          Lin.forEach(function (r) { markRow(r, '조사청 처분재산 확인요청: ' + (it.지번 || '') + ' 대금'); });
          var cgv = F && F.과세가액계산 ? F.과세가액계산.처분재산산입 : null;
          fl('F2', 'sale:' + (it.지번 || it.금액) + ':' + it.날짜, { 갈래: 'F 조사청이 묻는 곳', 짚을것: (N.차수 ? N.차수 + '차 ' : '') + '안내 — 처분재산 ' + (it.지번 || '') + ' ' + (it.금액 ? finRvWon_(it.금액) + '원' : '') + (it.상대 ? '(' + it.상대 + ')' : '') + ' · 통장에 들어온 돈 ' + finRvWon_(inSum) + '원(' + Lin.length + '줄)', 날짜: it.날짜, 금액: it.금액 || inSum, 상대: it.상대, 까닭: '매각대금 입금내역과 사용처를 묻는다(§15 재산 종류 ② 부동산)' + (cgv != null ? ' — 신고 ⑪ 처분재산 등 산입액 ' + finRvWon_(cgv) + '원' : '') + (Lout.length ? ' · 들어온 뒤 90일 안 큰 출금 ' + Lout.length + '줄 ' + finRvWon_(Lout.reduce(function (s, r) { return s + r.out; }, 0)) + '원' : ''), 준비: '매매계약서·대금 받은 계좌·쓰임', rows: Lin.concat(Lout), fdState: stateOf(Lin.concat(Lout), N.차수), fdFrom: N.from });
          if (F) cmp.push(['E5 처분재산 — ' + (it.지번 || '') + (it.상대 ? '(' + it.상대 + ')' : ''), it.금액, inSum, inSum - (it.금액 || 0), '조사청 안내 「' + N.from + '」 · 신고 ⑪ ' + (cgv == null ? '[확인 필요]' : finRvWon_(cgv) + '원'), Lin]);
        }
      });
    });
    // 등기부로 안 처분(2년 안)인데 조사청 안내에 없는 것 → E5
    ((U.facts || {}).부동산 || []).forEach(function (p) {
      if (p.종류 !== '처분' || !B.D || p.날짜 < finRvAddY_(B.D, -2) || p.날짜 > B.D) return;
      if ((AU.안내 || []).some(function (N) { return (N.항목 || []).some(function (it) { return it.종류 === '처분' && it.금액 && p.금액 && near(it.금액, p.금액, 0.01); }); })) return;
      var Lp = R.filter(function (r) { return r.own && r.in > 0 && Math.abs(finRvDays_(p.날짜, r.d)) <= 120 && ((p.상대 || []).some(function (w) { return finRvNorm_(r.txt || '').indexOf(finRvNorm_(w)) !== -1; }) || (p.금액 && near(r.in, p.금액, 0.01))); });
      if (audit) fl('E5', 'sale:' + p.날짜 + ':' + (p.금액 || ''), { 갈래: 'E 신고와 다른 곳', 짚을것: '2년 안 처분 ' + p.부동산 + ' ' + p.날짜 + (p.금액 ? ' ' + finRvWon_(p.금액) + '원' : '') + ' — 들어온 돈 ' + Lp.length + '줄', 날짜: p.날짜, 금액: p.금액, 상대: (p.상대 || []).join('·'), 까닭: '처분재산은 §15 재산 종류 ② — 신고 ⑪ ' + (F && F.과세가액계산 ? finRvWon_(F.과세가액계산.처분재산산입) + '원' : '[확인 필요]'), 준비: '매매계약서·대금 쓰임', rows: Lp });
    });
    // F3 — 조사관 지정 거래 표 줄마다 거래 줄을 찾음(계좌 끝자리·날짜·금액)
    var used = {};
    A.fdDesig = (AU.지정 || []).map(function (z, ix) {
      var dg = String(z.계좌 || '').replace(/\D/g, ''), amt = z.지급 || z.입금;
      var cand = R.filter(function (r) { return r.own && r.d === z.날짜 && !used[r.k] && (z.지급 ? near(r.out, z.지급, 0.0001) : near(r.in, z.입금, 0.0001)); });
      if (dg.length >= 6) { var c2 = cand.filter(function (r) { return finRvAcctLike_(r.dg || r.acct, dg); }); if (c2.length) cand = c2; }
      var r0 = cand[0] || null; if (r0) { used[r0.k] = 1; markRow(r0, '조사청 지정 거래' + (z.사용처 ? ' — 지정 표 사용처: ' + String(z.사용처).replace(/\s+/g, ' ').slice(0, 80) : '')); r0.fdDesig = z; }
      var st = r0 ? stateOf([r0], 0) : '';
      fl('F3', 'desig:' + (dg.slice(-6) || z.은행) + ':' + z.날짜 + ':' + amt, { 갈래: 'F 조사청이 묻는 곳', 짚을것: '조사청 지정 거래 — ' + z.은행 + ' ' + z.날짜 + ' ' + (z.지급 ? '지급 ' : '입금 ') + finRvWon_(amt) + '원' + (z.내용 ? ' · ' + z.내용 : '') + (r0 ? '' : '(이 시트 거래에 없음)'), 날짜: z.날짜, 금액: amt, 상대: z.내용 || '', 까닭: '조사관이 사용처를 적어 내라고 지정한 거래(「' + z.from + '」)', 준비: r0 ? '거래 탭 그 줄 「소명 ✎」에 사용처, 「메모 ✎」에 근거서류 — 「조사청 제출용」 탭에 같은 칸 차례로 모임' : z.은행 + ' ' + z.계좌 + ' 거래내역', rows: r0 ? [r0] : [], fdState: st, fdFrom: z.from, want: r0 ? null : { 무엇: z.은행 + ' ' + z.계좌 + ' 거래내역(조사청 지정 거래 ' + z.날짜 + ' 포함)', 왜: '조사관 지정 거래인데 이 시트에 그 계좌 자료가 없음' } });
      return { z: z, r: r0 };
    });
  }
}

// ---------- 시트 — 「신고와 맞대기」·「조사청 제출용」 탭(없으면 지움) ----------
function finFdWrite_(ss, A, U) {
  var gone = function (n) { var o = ss.getSheetByName(n); if (o) try { ss.deleteSheet(o); } catch (e) {} };
  var lg = ss.getSheetByName('거래'), gid = lg ? lg.getSheetId() : null;
  var link = function (r) { return gid != null && r ? '=HYPERLINK("#gid=' + gid + '&range=A' + (r.i + 2) + '","거래 ' + (r.i + 2) + '줄 ›")' : ''; };
  if (U.filed && (A.filedCmp || []).length) {
    var F = U.filed, rows = [], links = [];
    rows.push(['■ 신고서: 「' + F.from + '」' + (F.D ? ' · 상속개시일 ' + F.D : '') + (F.피상속인 ? ' · 피상속인 ' + F.피상속인 : '') + (F.신고구분 ? ' · ' + F.신고구분 : '') + (F.과세가액 ? ' · 과세가액 ' + finRvWon_(F.과세가액) : '') + (F.상속공제 ? ' · 상속공제 ' + finRvWon_(F.상속공제) : ''), '', '', '', '', '']);
    A.filedCmp.forEach(function (c) { rows.push([c[0], c[1], c[2], c[3], c[4], '']); var r0 = (c[5] || [])[0]; if (r0) links.push({ row: rows.length + 1, col: 5, f: link(r0) }); });
    finRvTab_(ss, '신고와 맞대기', ['항목', '신고 값', '통장에서 찾은 값', '차이(통장 − 신고)', '근거·설명', '거래 줄'], rows, { money: [1, 2, 3], links: links.filter(function (L) { return L.f; }), note: '이미 낸 상속세 신고서(부표 1·2·3·금융재산 상속공제 신고서)를 GAS가 칸 번호로 읽어 통장 분석과 맞댄 표입니다(0원). 짝이 「같은 기관·개시일 잔액으로 짝」인 줄은 같은 계좌인지 확인이 필요합니다. 신고와 다른 곳은 짚을 곳 E에 올라갑니다(조사·경정·불복 사건). 판단은 세무사님.' });
  } else gone('신고와 맞대기');
  var DS = A.fdDesig || [];
  if (DS.length) {
    var H = (DS[0].z.머리 || ['은행', '계좌번호', '계좌주', '거래일자', '구분', '지급금액', '입금금액', '내용', '처리점', '거래상대방은행', '상대계좌번호', '사용처', '근거서류']).map(function (h) { return String(h || '').trim(); });
    var iU = H.findIndex(function (h) { return /^사용처/.test(h.replace(/\s/g, '')); }), iG = H.findIndex(function (h) { return /^근거/.test(h.replace(/\s/g, '')); }), iD = H.findIndex(function (h) { return /거래일자|^일자$|거래일$/.test(h.replace(/\s/g, '')); });
    var whoU = [], links2 = [], outRows = DS.map(function (d, ix) {
      var r = d.r, o = r ? (U.rows[r.k] || {}) : {}, row = (d.z.원본 || []).slice(0, H.length); while (row.length < H.length) row.push('');
      var us = finCellUser_(o.소명액), nx = r ? finNexV_(U, 'row:' + r.k + ':소명') : null, um = finCellUser_(o.메모), nm = r ? finNexV_(U, 'row:' + r.k + ':메모') : null;
      var use = us ? { t: us, w: 'user' } : nx ? { t: nx.v, w: 'nex' } : d.z.사용처 ? { t: d.z.사용처, w: 'src' } : r && r.smWhy ? { t: r.smWhy, w: 'gas' } : { t: '', w: '' };
      if (iU >= 0) row[iU] = use.t; if (iG >= 0) row[iG] = um || (nm ? nm.v : '') || d.z.근거 || '';
      if (iD >= 0) row[iD] = d.z.날짜; // 엑셀 날짜 칸(일련번호·시각 붙은 글)은 그날로
      whoU.push(use.w === 'src' ? 'user' : use.w);
      if (r) links2.push({ row: ix + 2, col: H.length, f: link(r) });
      return row.concat([r ? '' : '이 시트 거래에 없음 — 받을 자료', use.w === 'user' ? '세무사님' : use.w === 'nex' ? '넥스(잠정)' : use.w === 'src' ? '지정 표에 적힌 것' : use.w === 'gas' ? 'GAS 자동소명 까닭' : '']);
    });
    var moneyCols = H.map(function (h, i) { return /지급|입금|출금|금액/.test(String(h).replace(/\s/g, '')) ? i : -1; }).filter(function (i) { return i >= 0; });
    finRvTab_(ss, '조사청 제출용', H.concat(['거래 줄', '사용처는 누가']), outRows, { money: moneyCols, text: H.map(function (h, i) { return /계좌/.test(h) ? i : -1; }).filter(function (i) { return i >= 0; }), links: links2.filter(function (L) { return L.f; }), who: iU >= 0 ? [{ col: iU, whos: whoU }] : [], note: '조사관이 보낸 지정 거래 표와 같은 칸 차례입니다(원래 엑셀 파일은 고치지 않음). 사용처 = 거래 탭 그 줄 「소명 ✎」(세무사님 > 넥스 > 지정 표에 적힌 것 > GAS 자동소명 까닭), 근거서류 = 「메모 ✎」. 고치실 때는 거래 탭에서 — 이 탭은 다음 셈에 새로 씁니다. 제출할 엑셀은 이 탭을 내려받으십시오.' });
  } else gone('조사청 제출용');
}

// ---------- 보고서 두 절(FinReport.js가 부름) ----------
function finFdReport_(A, U) {
  var s = [], F = U.filed, AU = U.audit;
  if (AU) {
    s.push('## 조사청이 짚은 것·소명 현황');
    (AU.안내 || []).forEach(function (N) { s.push('- 조사청 안내 「' + N.from + '」' + (N.차수 ? ' (' + N.차수 + '차)' : '') + (N.조사관 ? ' · ' + N.조사관 : '') + ' — 항목 ' + (N.항목 || []).length + '개'); });
    (AU.소명 || []).forEach(function (x) { s.push('- 이미 낸 소명 「' + x.from + '」' + (x.차수 ? ' (' + x.차수 + '차' + (x.초안 ? ' 초안' : '') + ')' : x.초안 ? ' (초안)' : '') + ' — 날짜·금액 단서 ' + (x.줄 || []).length + '곳'); });
    if ((AU.지정 || []).length) s.push('- 조사관 지정 거래 ' + AU.지정.length + '줄 — 거래 탭에서 찾음 ' + (A.fdDesig || []).filter(function (d) { return d.r; }).length + '줄 · 시트 「조사청 제출용」 탭');
    var FF = A.flags.filter(function (f) { return f.번호.charAt(0) === 'F'; });
    s.push(finRpTable_(['번호', '조사청이 묻는 것', '날짜', '금액', '상태'], FF.map(function (f) { return [f.번호, f.짚을것, f.날짜 || '', finRpMoney_(f.금액), f.상태 || (f.상태넥스 ? f.상태넥스 + '(넥스 답)' : f.상태답안 ? f.상태답안 + '(GAS 답)' : '확인 전')]; })));
    s.push('');
  }
  if (F && (A.filedCmp || []).length) {
    s.push('## 신고와 맞대기');
    s.push('- 신고서 「' + F.from + '」' + (F.D ? ' · 상속개시일 ' + F.D : '') + (F.과세가액 ? ' · 과세가액 ' + finRvWon_(F.과세가액) + '원' : '') + ' — GAS가 서식 칸 번호로 읽음(짝은 [확인 필요]가 붙은 줄을 확인)');
    s.push(finRpTable_(['항목', '신고 값', '통장에서 찾은 값', '차이(통장 − 신고)', '근거'], A.filedCmp.map(function (c) { return [c[0], typeof c[1] === 'number' ? finRpMoney_(c[1]) : c[1], typeof c[2] === 'number' ? finRpMoney_(c[2]) : c[2], typeof c[3] === 'number' ? finRpMoney_(c[3]) : c[3], String(c[4] || '').slice(0, 100)]; })));
    var EE = A.flags.filter(function (f) { return f.번호.charAt(0) === 'E'; });
    if (EE.length) { s.push('- 신고와 다른 곳(짚을 곳 E) ' + EE.length + '곳:'); EE.slice(0, 20).forEach(function (f) { s.push('  - ' + f.번호 + ' ' + f.짚을것 + (f.금액 ? ' · 차이 ' + finRvWon_(f.금액) + '원' : '')); }); }
    s.push('');
  }
  return s.join('\n');
}
