// ============================================================
// [2026.11.25] 사건 서류 읽기 — 상속개시일·가족(상속인 짐작)·의뢰 메모의 사람·빌려준 돈 (GAS, 0원)
//  세무사님 11-25 "상속인정보조차 파악하지 않았다" / "상속개시일도 스스로 파악하지 못하나?" → "권장대로 하자"
//  (계획서: 총괄관리자\_기록\금융거래_답안먼저_계획서_20261125.html A절)
//  · 읽는 곳: 사건 폴더 서류의 글(tc_docText_ — job 서버가 이미 읽어 둔 글자 기억을 먼저 씀, 새 글자인식은 한 번에 둘까지)과
//    사건 폴더 맨 위 의뢰 메모(.txt·.md). 바깥 AI로 보내는 것 없음.
//  · 정하는 것은 모두 「짐작」 — 근거 파일 이름을 함께 남기고, 세무사님 칸(✎)이 있으면 그 값이 먼저다.
//  · 차례(앞이 먼저): 사망진단서·시체검안서 → 기본증명서 → 주민등록초본 「사망신고말소」 → 상속재산분할협의서 → 넥스 보고서 → 의뢰 메모(추정)
// ============================================================
var FIN_DOC_VER_ = '2026-11-25b';
// 읽지 않을 서류(값을 찾을 일이 없는 것 — 읽는 시간을 아낌). 이름만으로 거르고, 남는 서류는 글로 무엇인지 알아본다
//  (세무사님 11-25 "금융정보를 분석하려면 해당사건의 모든 정보를 최대한 파악해야" — 등기부(부동산 취득·처분)·재산조회회보서(피상속인 금융 계좌 목록)·보험금 지급증명서도 읽음)
var FIN_DOC_SKIP_RE_ = /(거래내역|금융거래|통장|입출금|등기필|건축물대장|토지이용|매매실례가|실거래|공시지가|감정평가|영수증|취득세|법무사|장례|안치|명세|이택스|확정일자|평가기준|고액출금|세액|계산기|비밀번호|병원비|매매계약|전세계약|임대차|월세|유형자산)/;
var FIN_DOC_RANK_ = { '사망진단서·시체검안서': 1, '기본증명서': 2, '주민등록초본': 3, '상속재산분할협의서': 4, '넥스 보고서': 5, '의뢰 메모': 6 };
var FIN_DOC_KIN_RE_ = /(아들|딸|자녀|배우자|남편|아내|사위|며느리|손자|손녀|동생|형|누나|언니|오빠|조카|형제|자매|부친|모친|어머니|아버지|엄마|아빠)/;
var FIN_DOC_STOP_ = /^(피상속인|상속인|의뢰인|세입자|임차인|임대인|대여인|차용인|본인|성명|구분|사항|출생|주민|등록|가족|부모|자녀|배우자|누구|확인|현재|제출|자료|추정|사망|이름|관계|상속|사건|계약|부탁)$/;

function finDocYmd_(y, m, d) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
// 이름이 글 안에 있는가(글자 사이 띄어 읽힌 것 「이 진 우」도)
function finDocHasName_(t, name) {
  var n = String(name || '').replace(/\s/g, ''); if (n.length < 2) return false;
  return new RegExp(n.split('').join('\\s?')).test(t);
}
function finDocName_(s) { s = String(s || '').trim(); return /^[가-힣]{2,4}$/.test(s) && !FIN_DOC_STOP_.test(s) ? s : ''; }

// 서류 한 장의 글 → 알아본 것
function finDocParse_(text, fname) {
  var t = String(text || '').replace(/\s+/g, ' '), out = { 종류: [], 사망: [], 가족: null, 대여: [] };
  var DT = /(19\d{2}|20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?)?/;
  // ① 사망진단서·시체검안서 — 「사망일시」 뒤 가까운 날짜(칸 번호·장소 글이 사이에 낄 수 있음)
  if (/사\s*망\s*진\s*단\s*서|시\s*체\s*검\s*안\s*서/.test(t)) {
    out.종류.push('사망진단서·시체검안서');
    var re = /사\s*망\s*일\s*시/g, m;
    while ((m = re.exec(t))) {
      var seg = t.slice(m.index, m.index + 240).split(/사망의\s*원인|발\s*병|진단\s*연월일|발급|작성\s*일/)[0], d = DT.exec(seg);
      if (d && Number(d[1]) >= 1990) { out.사망.push({ D: finDocYmd_(d[1], d[2], d[3]), T: d[4] ? ('0' + d[4]).slice(-2) + ':' + ('0' + (d[5] || '0')).slice(-2) : '', how: '사망진단서·시체검안서' }); break; }
    }
  }
  // ② 기본증명서 — 「사망일시·사망연월일」 (가족관계증명서의 「사망 1943년 …」은 태어난 날이라 보지 않음)
  if (/기\s*본\s*증\s*명\s*서/.test(t) && !/가족관계증명서/.test(t)) {
    out.종류.push('기본증명서');
    var b = /사망\s*(?:일시|연월일)\s*:?\s*(19\d{2}|20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(t);
    if (b) out.사망.push({ D: finDocYmd_(b[1], b[2], b[3]), T: '', how: '기본증명서' });
  }
  // ③ 주민등록초본 — 「2026-07-05 2026-07-08 ○○○의 본인 사망신고말소」(앞 날짜 = 발생일)
  if (/초\s*본/.test(t) && /사망신고말소/.test(t)) {
    out.종류.push('주민등록초본');
    var c = /(\d{4})-(\d{2})-(\d{2})(?:\s+\d{4}-\d{2}-\d{2})?\s*(?:([가-힣]{2,4})의\s*)?본인\s*사망신고말소/.exec(t);
    if (c) out.사망.push({ D: finDocYmd_(c[1], c[2], c[3]), T: '', how: '주민등록초본', who: c[4] || '' });
  }
  // ④ 상속재산분할협의서 — 「2026년 4월 17일 ○○○의 사망으로 인하여 개시된 상속」
  var s4 = /(19\d{2}|20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*([가-힣]{2,4})\s*의\s*사망으로/.exec(t);
  if (s4) { out.종류.push('상속재산분할협의서'); out.사망.push({ D: finDocYmd_(s4[1], s4[2], s4[3]), T: '', how: '상속재산분할협의서', who: s4[4] }); }
  // 가족관계증명서 — 본인 + 가족사항(부·모·배우자·자녀, 사망 표시)
  if (/가\s*족\s*관\s*계\s*증\s*명\s*서/.test(t)) {
    var at = t.search(/가족\s*사항/), me = null, mr = /본인\s+([가-힣]{2,4})/g, mm, head = at >= 0 ? t.slice(Math.max(0, at - 300), at) : '';
    while ((mm = mr.exec(head))) me = mm; // 가족사항 바로 앞의 「본인 ○○○」(한 파일에 초본·여러 증명서가 묶여 있을 수 있음)
    if (me && at >= 0) {
      out.종류.push('가족관계증명서');
      var tail = t.slice(at, at + 900).split(/위 가족관계증명서|구분 상세내용/)[0], ppl = [], seen = {};
      var pr = /(배우자|자녀|부|모)\s+([가-힣]{2,4})\s*(?:\([^)]{0,10}\)?|[^\s가-힣]{0,3}\))?\s*(사망)?/g, q;
      while ((q = pr.exec(tail))) {
        var nm = finDocName_(q[2]); if (!nm || seen[nm]) continue; seen[nm] = 1;
        ppl.push({ 관계: q[1], 이름: nm, 사망: !!q[3] });
      }
      if (ppl.length) out.가족 = { 본인: me[1], 사람: ppl };
    }
  }
  // 등기부 갑구 — 소유권이 옮겨 간 날(원인일)·원인·거래가액·권리자(누가 사고 누가 팔았는지는 finDocsApply_가 피상속인 이름으로 가름)
  if (/갑\s*구/.test(t) && /소유권/.test(t)) {
    var g0 = t.search(/갑\s*구/), g1 = t.search(/을\s*구/), gtxt = t.slice(g0, g1 > g0 ? g1 : g0 + 6000);
    var head = (/\[(?:집합건물|토지|건물)\]\s*([^【\[]{4,60})/.exec(t) || [])[1] || '', reg = [];
    gtxt.split(/(?=\s\d{1,2}(?:-\d)?\s+(?:소유권이전|소유권보존|\d+번[가-힣]+지분전부))/).forEach(function (seg) {
      var ds = []; seg.replace(/(19\d{2}|20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, function (_, y, mo, d) { ds.push(finDocYmd_(y, mo, d)); return _; });
      if (!ds.length || !/소유권|지분/.test(seg)) return;
      var why = /협의분할에\s*의한\s*상속|상속/.test(seg) ? '상속' : /증여/.test(seg) ? '증여' : /매매/.test(seg) ? '매매' : /보존/.test(seg) ? '보존' : '';
      var amt = /거래가액\s*금\s*([\d,]+)\s*원/.exec(seg), who = [], wr = /(?:소유자|공유자|지분\s*\d*분의\s*\d*)\s+([가-힣]{2,4})/g, wm;
      while ((wm = wr.exec(seg))) { var wn = finDocName_(wm[1]); if (wn && who.indexOf(wn) === -1) who.push(wn); }
      reg.push({ 접수: ds[0], 원인일: ds[1] && ds[1] <= ds[0] ? ds[1] : ds[0], 원인: why, 금액: amt ? Number(amt[1].replace(/,/g, '')) : null, 권리자: who, 글: seg.slice(0, 400) });
    });
    if (reg.length) { out.종류.push('등기부'); out.등기 = { 부동산: head.trim().slice(0, 50), 차례: reg }; }
  }
  // 재산조회회보서(금융) — 피상속인 이름으로 된 금융 계좌 목록(기관·계좌번호). 거래내역을 받지 못한 계좌를 찾는 데 씀
  if (/재산\s*조회|조회\s*회보/.test(t) && /(은행|금융|증권|생명|화재|보험|농협|신협|새마을|우체국|저축)/.test(t)) {
    var acc = [], ar = /((?:[가-힣]{1,6}(?:은행|증권|생명|화재|보험|금고|농협|신협|우체국|저축은행|투자증권)))[^\d]{0,30}?(\d{2,6}(?:-\d{1,7}){1,4}|\d{10,16})/g, am;
    while ((am = ar.exec(t)) && acc.length < 300) acc.push({ 기관: am[1], 계좌: am[2] });
    if (acc.length) { out.종류.push('재산조회회보서'); out.계좌 = acc; }
  }
  // 보험금 지급증명서 — 사망보험금 등 지급액(들어온 돈의 출처)
  if (/보험금\s*지급\s*(증명|내역|확인)/.test(t)) {
    var ins = [], ir = /(사망|일반사망|재해사망|보험금)[^\d]{0,20}([\d,]{6,})/g, im;
    while ((im = ir.exec(t)) && ins.length < 20) { var v = Number(im[2].replace(/,/g, '')); if (v >= 100000 && v < 1e11 && ins.indexOf(v) === -1) ins.push(v); } // 1천억 넘는 것은 날짜·번호 숫자
    if (ins.length) { out.종류.push('보험금 지급증명서'); out.보험금 = ins; }
  }
  // [2026.11.25] 주민등록표 등본 — 같은 세대 사람(생계비·가족비를 가르는 근거, 세무사님 「권장대로」 ㉠)
  if (/주\s*민\s*등\s*록\s*표/.test(t) && /등\s*본/.test(t) && !/초\s*본/.test(t)) {
    var hh = [], hr = /(세대주|본인|배우자|처|남편|자녀|자|손자|손녀|손|며느리|자부|사위|모|부|동거인)\s+([가-힣]{2,4})/g, hm;
    while ((hm = hr.exec(t)) && hh.length < 20) { var hn = finDocName_(hm[2]); if (hn && hh.indexOf(hn) === -1) hh.push(hn); }
    if (hh.length) { out.종류.push('주민등록표 등본'); out.세대 = hh; }
  }
  // 금전소비대차계약서·차용증 — 대여인·차용인·금액
  if (/(금전\s*소비\s*대차|차\s*용\s*증)/.test(t)) {
    var L = /대\s*여\s*인\s*:?\s*([가-힣]{2,4})[\s\S]{0,80}?차\s*용\s*인\s*:?\s*([가-힣]{2,4})/.exec(t);
    if (L) {
      out.종류.push('금전소비대차·차용증');
      var amt = /금\s*([\d,]{5,})\s*원/.exec(t);
      out.대여.push({ 대여인: L[1], 차용인: L[2], 금액: amt ? Number(amt[1].replace(/,/g, '')) : null });
    }
  }
  return out;
}

// 의뢰 메모 글 → 사람(관계)·「상속인은 ○○ 1인」·차입
function finDocMemoParse_(text) {
  var out = { 사람: [], 상속인말: null, 차입: [], 동거: [] }, seen = {};
  var add = function (n, rel, line) { n = finDocName_(String(n || '').replace(/씨$/, '')); if (!n) return; if (seen[n]) { if (!seen[n].관계 && rel) seen[n].관계 = rel; return; } seen[n] = { 이름: n, 관계: rel, 글: String(line || '').trim().slice(0, 80) }; out.사람.push(seen[n]); };
  String(text || '').split(/\r?\n/).forEach(function (line) {
    var m;
    if ((m = /([가-힣]{2,4})의\s*배우자는\s*([가-힣]{2,4})/.exec(line))) add(m[2], m[1] + '의 배우자', line);
    if ((m = /([가-힣]{2,4})(?:씨)?(?:은|는|이|가|와|과)\s*[^.\n]{0,20}(같이\s*살|함께\s*살|같이\s*거주|함께\s*거주|동거|모시고)/.exec(line))) { var hn0 = finDocName_(m[1]); if (hn0 && out.동거.indexOf(hn0) === -1) out.동거.push(hn0); }
    if ((m = /상속인은\s*([가-힣]{2,4})\s*1\s*인/.exec(line))) out.상속인말 = { 이름: m[1], 글: line.trim().slice(0, 80) };
    if ((m = /((?:[가-힣]{2,4}\s*,\s*)+[가-힣]{2,4}|[가-힣]{2,4})\s*(?:씨)?(?:은|는|이|가)\s*세입자/.exec(line))) m[1].split(/\s*,\s*/).forEach(function (n) { add(n, '세입자', line); });
    if ((m = /([가-힣]{2,4})(?:씨)?(?:은|는)\s*([\d,]+)\s*(백만원|만원|원)을?\s*차입/.exec(line))) {
      var v = Number(m[2].replace(/,/g, '')) * (m[3] === '백만원' ? 1000000 : m[3] === '만원' ? 10000 : 1);
      out.차입.push({ 차용인: m[1], 금액: v, 글: line.trim().slice(0, 80) });
    }
    // 「○○(씨)는/은 … 아들·딸·동생 …」(한 줄 안)
    //  주어는 줄(목록 표시 뒤) 맨 앞의 이름만 — 안내 글 속 「…이 속하는 달 … 배우자」 같은 것을 사람으로 읽지 않게
    var sub = /^[\s\-*·•0-9.)]*([가-힣]{2,3}?)(?:씨)?(?:은|는)\s/.exec(line), kin = FIN_DOC_KIN_RE_.exec(line);
    if (sub && kin && !/배우자는/.test(line)) {
      var rel = (/[:：]\s*(.+)$/.exec(line) || [])[1] || line.slice(sub.index + sub[0].length);
      var k2 = /((?:엄마|아빠|어머니|아버지|피상속인)?\s*(?:\([가-힣]{2,4}\))?\s*(?:의\s*)?(?:아들|딸|자녀|배우자|남편|아내|사위|며느리|손자|손녀|동생|형|누나|언니|오빠|조카|형제|자매))/.exec(rel);
      if (k2) add(sub[1], k2[1].replace(/\s+/g, ' ').trim(), line);
    }
  });
  return out;
}

// 사건 폴더 서류 훑기(바뀐 파일만 다시) → U.docs
function finDocsScan_(folder, U, budgetAt) {
  var files = []; try { files = finFolderFiles_(folder); } catch (e) { return false; }
  var memo = files.filter(function (f) { return /\.(txt|md)$/i.test(f.name) && !/^_/.test(f.name) && f.size < 200000; }); // 하위 폴더 메모까지(예: 양도/0 ○○ 양도 사건.txt)
  var docs = files.filter(function (f) { return /\.(pdf|jpe?g|png|hwp)$/i.test(f.name) && !/^_|^~\$/.test(f.name) && !FIN_DOC_SKIP_RE_.test(f.name); }).slice(0, 60);
  U.docs = U.docs || {}; if (U.docs._v !== FIN_DOC_VER_) U.docs = { _v: FIN_DOC_VER_ };
  var changed = false, live = { _v: 1 }, newOcr = 0;
  memo.forEach(function (f) {
    live[f.id] = 1; var o = U.docs[f.id]; if (o && o.mod === f.modified) return;
    var t = ''; try { t = DriveApp.getFileById(f.id).getBlob().getDataAsString('UTF-8'); } catch (e) { return; }
    U.docs[f.id] = { mod: f.modified, 이름: f.name, 메모: finDocMemoParse_(t), D: finRvGuessDText_(t) }; changed = true;
  });
  docs.forEach(function (f) {
    live[f.id] = 1; var o = U.docs[f.id]; if (o && o.mod === f.modified) return;
    if (Date.now() > budgetAt) return;
    var text = '', prev = TC_NO_NEW_OCR_; TC_NO_NEW_OCR_ = newOcr >= 2;
    try { text = tc_docText_({ id: f.id, name: f.name, mimeType: f.mimeType, modified: f.modified }) || ''; } catch (e) { text = ''; } finally { TC_NO_NEW_OCR_ = prev; }
    if (!text) { if (newOcr < 2) newOcr++; return; } // 글자 기억이 생기면 다음 번에
    U.docs[f.id] = { mod: f.modified, 이름: f.name, 경로: f.path, p: finDocParse_(text, f.name) }; changed = true;
  });
  // 그 전에 작성된 보고서 모두(세무사님 11-25 "그 전에 작성된 보고서까지 모두 읽어야 한다") — 보고서 폴더와 그 안 _이전판·_보관,
  //  사건 폴더의 _이전판(.md·.txt). 금융거래 검토서는 GAS가 쓴 것이라 뺌. 지난 판은 지금 판보다 뒤 차례
  try {
    var rd = function (fo, label, old, depth) {
      var it = fo.getFiles();
      while (it.hasNext()) {
        var f = it.next(), n = f.getName(); if (!/\.(md|txt)$/i.test(n) || /금융거래/.test(n) || /^~\$/.test(n)) continue;
        var id = 'rp_' + f.getId(), mod = f.getLastUpdated().getTime(); live[id] = 1; if (U.docs[id] && U.docs[id].mod === mod) continue;
        var tx = ''; try { tx = f.getBlob().getDataAsString('UTF-8'); } catch (e) { continue; }
        U.docs[id] = { mod: mod, 이름: label + n, 보고서: true, 지난판: old, 메모: finDocMemoParse_(tx), D: finRvGuessDText_(tx), Dt: (/상속\s*개시일[^\n]{0,30}?(\d{1,2})\s*시\s*(\d{1,2})\s*분/.exec(tx) || []).slice(1).join(':') };
        changed = true;
      }
      if (depth < 1) { var di = fo.getFolders(); while (di.hasNext()) { var d = di.next(); if (/^_(이전판|보관)$/.test(d.getName())) rd(d, label + d.getName() + '/', true, depth + 1); } }
    };
    var rp = folder.getFoldersByName('보고서'); if (rp.hasNext()) rd(rp.next(), '보고서/', false, 0);
    var op = folder.getFoldersByName('_이전판'); if (op.hasNext()) rd(op.next(), '_이전판/', true, 1);
  } catch (e) {}
  Object.keys(U.docs).forEach(function (id) { if (!live[id]) { delete U.docs[id]; changed = true; } });
  return changed;
}

// 훑은 것 → 상속개시일 짐작(U.guess)·가족·메모 사람(U.rel 짐작)·빌려준 돈(U.loans). 세무사님 칸은 건드리지 않음
function finDocsApply_(U, decedent) {
  var D = U.docs || {}, cands = [], fam = null, famFrom = '', memoP = [], heirSay = null, loans = [], prop = [], listed = [], insur = [], house = [];
  var near = function (a) { return !a || finTgNameNear_(a, decedent); };
  Object.keys(D).forEach(function (id) {
    if (id === '_v') return; var o = D[id];
    if (o.p) {
      (o.p.사망 || []).forEach(function (s) { if (near(s.who)) cands.push({ D: s.D, T: s.T || '', how: s.how, from: s.how + ' 「' + o.이름 + '」', r: FIN_DOC_RANK_[s.how] || 9 }); });
      if (o.p.가족 && finTgNameNear_(o.p.가족.본인, decedent) && (!fam || o.p.가족.사람.length > fam.length)) { fam = o.p.가족.사람; famFrom = '가족관계증명서 「' + o.이름 + '」'; }
      (o.p.대여 || []).forEach(function (l) { loans.push({ 대여인: l.대여인, 차용인: l.차용인, 금액: l.금액, 근거: '금전소비대차·차용증 「' + o.이름 + '」' }); });
      // 등기부 — 피상속인 이름이 든 차례 = 산 것, 그 바로 뒤 피상속인 이름이 없는 매매 = 판 것(금액은 거래가액)
      if (o.p.등기) {
        var had = false;
        var prevWho = [];
        o.p.등기.차례.forEach(function (e) {
          var mine = finDocHasName_(e.글, decedent), others = (e.권리자 || []).filter(function (w) { return !finTgNameNear_(w, decedent); });
          // 산 것: 판 사람 = 바로 앞 차례의 권리자(피상속인 아닌 사람) → 매도인 / 판 것: 이 차례의 권리자 → 매수인
          if (mine && /매매|증여|상속/.test(e.원인)) prop.push({ 부동산: o.p.등기.부동산, 종류: '취득', 원인: e.원인, 날짜: e.원인일, 금액: e.금액, 상대: e.원인 === '매매' ? prevWho.filter(function (w) { return !finTgNameNear_(w, decedent); }) : [], 근거: '등기부 「' + o.이름 + '」' });
          else if (had && !mine && e.원인 === '매매') prop.push({ 부동산: o.p.등기.부동산, 종류: '처분', 원인: e.원인, 날짜: e.원인일, 금액: e.금액, 상대: others, 근거: '등기부 「' + o.이름 + '」' });
          had = mine || (had && !/매매|증여/.test(e.원인));
          if ((e.권리자 || []).length) prevWho = e.권리자;
        });
      }
      (o.p.계좌 || []).forEach(function (a) { listed.push({ 기관: a.기관, 계좌: a.계좌, 근거: '재산조회회보서 「' + o.이름 + '」' }); });
      (o.p.보험금 || []).forEach(function (v) { insur.push({ 금액: v, 근거: '보험금 지급증명서 「' + o.이름 + '」' }); });
      if (o.p.세대 && o.p.세대.some(function (w) { return finTgNameNear_(w, decedent); })) o.p.세대.forEach(function (w) { if (!finTgNameNear_(w, decedent)) house.push({ 이름: w, 근거: '주민등록표 등본 「' + o.이름 + '」' }); });
    }
    var kind = o.보고서 ? (o.지난판 ? '지난 보고서' : '넥스 보고서') : '의뢰 메모';
    if (o.메모) {
      o.메모.사람.forEach(function (p) { memoP.push(Object.assign({ from: kind + ' 「' + o.이름 + '」' }, p)); });
      if (o.메모.상속인말 && (!heirSay || !o.보고서)) heirSay = Object.assign({ from: kind + ' 「' + o.이름 + '」' }, o.메모.상속인말);
      (o.메모.동거 || []).forEach(function (w) { house.push({ 이름: w, 근거: kind + ' 「' + o.이름 + '」' }); });
      o.메모.차입.forEach(function (l) { loans.push({ 대여인: decedent, 차용인: l.차용인, 금액: l.금액, 근거: kind + ' 「' + o.이름 + '」: ' + l.글 }); });
    }
    if (o.D) cands.push({ D: o.D, T: o.Dt || '', how: kind, from: kind + ' 「' + o.이름 + '」', r: o.보고서 ? (o.지난판 ? 7 : 5) : 6 });
  });
  // 상속개시일 — 앞선 근거. 서로 다른 날이 있으면 어긋남으로(여쭐 것)
  cands.sort(function (a, b) { return a.r - b.r || (a.D < b.D ? -1 : 1); });
  var g = cands[0] ? { D: cands[0].D, T: cands[0].T || (cands.filter(function (c) { return c.D === cands[0].D && c.T; })[0] || {}).T || '', from: cands[0].from,
    다른날: cands.filter(function (c) { return c.D !== cands[0].D; }).map(function (c) { return c.D + ' — ' + c.from; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 5) } : null;
  var changed = JSON.stringify(g) !== JSON.stringify(U.guess || null); U.guess = g;
  // 가족 → 상속인 짐작(민법 §1000·§1003: 직계비속·배우자가 먼저, 직계비속이 없으면 직계존속·배우자)
  var have = {}; U.rel.forEach(function (x) { have[finRvNorm_(x.이름)] = x; });
  var upsert = function (name, f) {
    var x = have[finRvNorm_(name)];
    if (!x) { x = { 이름: name, 갈래: '', 짐작: '', 관계: '', 별칭: [], 계좌: [], 출처: f.출처, 상태: '' }; U.rel.push(x); have[finRvNorm_(name)] = x; changed = true; }
    Object.keys(f).forEach(function (k) {
      if (k === '출처') { if (String(x.출처 || '').indexOf(f.출처) === -1) { x.출처 = f.출처 + (x.출처 ? ' · ' + x.출처 : ''); changed = true; } return; }
      if (String(x[k] || '') !== String(f[k])) { x[k] = f[k]; changed = true; }
    });
  };
  if (fam) {
    var alive = function (r) { return fam.filter(function (p) { return p.관계 === r && !p.사망; }); };
    var kids = alive('자녀'), sp = alive('배우자'), par = alive('부').concat(alive('모'));
    var heirs = (kids.length ? kids : par).concat(sp).map(function (p) { return p.이름; });
    fam.forEach(function (p) {
      var heir = heirs.indexOf(p.이름) !== -1;
      upsert(p.이름, { 짐작: heir ? '상속인' : '상속인 아닌 가족·친척', 관계짐작: p.관계 + (p.사망 ? '(사망)' : ''), 출처: famFrom });
    });
    U.heirsGuess = { 이름: heirs, from: famFrom };
  } else U.heirsGuess = null;
  // 의뢰 메모의 사람 — 가족관계증명서로 정해진 사람은 관계만 보탬
  //  [2026.11.25 운영 확인] 가족관계증명서에 있는 사람은 메모·보고서 글이 갈래·관계를 덮지 않음(출처 글 순서가 아니라 증명서 명단으로 가름 —
  //  운영에서 지난 보고서의 「…세입자」 글이 출처 앞에 붙어 자녀를 세입자로 덮었음)
  var famNames = {}; (fam || []).forEach(function (q) { famNames[finRvNorm_(q.이름)] = 1; });
  memoP.forEach(function (p) {
    var x = have[finRvNorm_(p.이름)], famSet = !!famNames[finRvNorm_(p.이름)];
    var lane = p.관계 === '세입자' ? '세입자' : /(아들|딸|자녀)$/.test(p.관계) ? '상속인' : FIN_DOC_KIN_RE_.test(p.관계) ? '상속인 아닌 가족·친척' : '';
    var f = { 출처: p.from };
    if (!famSet) { if (lane) f.짐작 = lane; }
    if (p.관계 && (!x || !x.관계짐작 || !famSet)) f.관계짐작 = p.관계;
    upsert(p.이름, f);
  });
  U.heirSay = heirSay;
  var seenL = {}; loans = loans.filter(function (l) { var k = finRvNorm_(l.대여인) + '|' + finRvNorm_(l.차용인) + '|' + (l.금액 || ''); if (seenL[k]) return false; seenL[k] = 1; return true; }); // 같은 차용증 사본 여럿은 한 번만
  if (JSON.stringify(loans) !== JSON.stringify(U.loans || [])) { U.loans = loans; changed = true; }
  // 같은 등기(여러 사본)는 한 번만
  var seenP = {}; prop = prop.filter(function (p) { var k = p.종류 + p.날짜 + (p.금액 || ''); if (seenP[k]) return false; seenP[k] = 1; return true; });
  var seenA = {}; listed = listed.filter(function (a) { var k = String(a.계좌).replace(/\D/g, ''); if (seenA[k]) return false; seenA[k] = 1; return true; });
  // 등기부의 사고판 상대 → 매수인·매도인 짐작(가족으로 정해진 사람은 그대로)
  prop.forEach(function (p) {
    (p.상대 || []).forEach(function (w) {
      var x = have[finRvNorm_(w)], lane2 = p.종류 === '처분' ? '매수인' : '매도인', f = { 출처: p.근거, 관계짐작: '부동산 ' + (p.종류 === '처분' ? '산 사람' : '판 사람') + '(' + p.부동산.slice(0, 24) + ' ' + p.날짜 + (p.금액 ? ' · ' + finRvWon_(p.금액) + '원' : '') + ')' };
      if (!x || !FIN_RV_FAMILY_.test(x.짐작 || '')) { f.짐작 = lane2; }
      upsert(w, f);
    });
  });
  var seenH = {}; house = house.filter(function (h) { var k = finRvNorm_(h.이름); if (seenH[k]) return false; seenH[k] = 1; return true; });
  var hhObj = house.length ? { 이름: house.map(function (h) { return h.이름; }), 근거: house.map(function (h) { return h.이름 + ' — ' + h.근거; }) } : null;
  if (JSON.stringify(hhObj) !== JSON.stringify(U.household || null)) { U.household = hhObj; changed = true; }
  var facts = { 부동산: prop, 회보계좌: listed, 보험금: insur };
  if (JSON.stringify(facts) !== JSON.stringify(U.facts || null)) { U.facts = facts; changed = true; }
  return changed;
}

// ============================================================
// [2026.11.25] 서류에서 정하지 못한 기본 사실 → 받을 자료(짚을 곳 A6·A7·A8). finRvAnalyze_가 짚을 곳을 다 모은 뒤 부름
// ============================================================
function finDocFlags_(fl, B, U, rels, acctList) {
  if (!B.D) fl('A6', 'doc:D', { 갈래: 'A 자료 빈틈', 짚을것: '상속개시일을 알 서류가 사건 폴더에 없음', 날짜: '', 금액: null, 까닭: '상속개시일이 있어야 1·2·5·10년 구간(§15·§13)을 셈한다', 준비: '사망진단서 또는 기본증명서(상세)', want: { 무엇: '피상속인 사망진단서 또는 기본증명서(상세)', 왜: '상속개시일' } });
  var heirSet = rels.some(function (x) { return x.갈래 === '상속인' || x.짐작 === '상속인'; });
  if (!heirSet) fl('A7', 'doc:family', { 갈래: 'A 자료 빈틈', 짚을것: '상속인을 알 서류가 사건 폴더에 없음', 날짜: '', 금액: null, 까닭: '상속인(10년)·그 밖(5년) 합산 기간과 사전증여 대상을 가르려면 가족 관계가 있어야 한다', 준비: '피상속인 가족관계증명서(상세)', want: { 무엇: '피상속인 가족관계증명서(상세)', 왜: '상속인·가족' } });
  var have = acctList.map(function (a) { return String(a.dg || a.acct || '').replace(/\D/g, ''); }).filter(function (d) { return d.length >= 6; });
  ((U.facts || {}).회보계좌 || []).forEach(function (l) {
    var d = String(l.계좌).replace(/\D/g, ''); if (d.length < 8) return;
    if (have.some(function (h) { return h.indexOf(d.slice(-8)) !== -1 || d.indexOf(h.slice(-8)) !== -1; })) return;
    fl('A8', 'listed:' + d, { 갈래: 'A 자료 빈틈', 짚을것: l.기관 + ' ' + l.계좌 + ' — 재산조회회보서에 있으나 거래내역 없음', 날짜: '', 금액: null, 까닭: '과세관청은 회보서의 모든 계좌를 본다(' + l.근거 + ')', 준비: l.기관 + ' ' + l.계좌 + ' 10년 거래내역', want: { 무엇: l.기관 + ' ' + l.계좌 + ' 거래내역(10년)', 왜: '회보서에 있음' } });
  });
}

// ============================================================
// [2026.11.25] 노란 칸 답안 먼저(계획서 B) — GAS가 서류·통장에서 낸 답안을 노란 칸 옆 「답안(GAS)」에. 노란 칸(세무사님)이 비면 답안대로 셈.
//  답안은 세무사님 판단으로 세지 않는다(자체 학습은 세무사님 칸만 배움). 세금이 달라지는 것만 「여쭐 것」으로 묶음
// ============================================================
var FIN_ANS_DEAL_ = /^(세입자|임대인|매수인|매도인)$/;
function finAnsAll_(A, U) {
  var B = A.B, T = B.T, decedent = B.피상속인, lane = function (x) { return x ? (x.갈래 || x.짐작 || '') : ''; };
  var byName = {}; A.rels.forEach(function (x) { byName[finRvNorm_(x.이름)] = x; });
  var loanOf = function (name) { return (U.loans || []).filter(function (l) { return finTgNameNear_(l.차용인, name) && finTgNameNear_(l.대여인, decedent); })[0] || null; };
  var near = function (a, b, pct) { return a && b && Math.abs(a - b) <= Math.max(1000, b * pct); };
  var propOf = function (r) { return ((U.facts || {}).부동산 || []).filter(function (p) { return p.금액 && near(r.amt, p.금액, 0.05) && Math.abs(finRvDays_(p.날짜, r.d)) <= 150 && ((p.종류 === '처분') === (r.in > 0)); })[0] || null; };
  var insOf = function (r) { return r.in > 0 ? ((U.facts || {}).보험금 || []).filter(function (p) { return near(r.amt, p.금액, 0.001); })[0] || null : null; };
  var NORM_RE = /^(생계비|가족비|경조비|종교활동비)/, natOf = function (r) { var o = (U.rows || {})[r.k] || {}; return o.성격 || r.nature || ''; };
  var normSum = function (rows) { return rows.filter(function (r) { return r.out > 0 && NORM_RE.test(natOf(r)); }).reduce(function (s, r) { return s + r.out; }, 0); };
  var normShare = function (rows) { var all = rows.reduce(function (s, r) { return s + (r.out || 0); }, 0); return all ? normSum(rows) / all : 0; };
  // 짚을 곳 상태
  A.flags.forEach(function (f) {
    var x = f.상대 ? byName[finRvNorm_(f.상대)] : null, L = x ? loanOf(x.이름) : null, ans = '확인 전', why = '';
    var rows = f.rows || [], pr = null, ins = null;
    rows.some(function (r) { pr = propOf(r); ins = insOf(r); return pr || ins; });
    if (/^A/.test(f.번호)) { ans = '확인 전'; why = '받을 자료 — 요청해 받으면 「답 받음」'; }
    else if (L) { ans = '소명 됨'; why = '대여(채권 — 상속재산에 넣음): ' + L.근거; }
    else if (normShare(rows) >= 0.95) { ans = '해당 없음'; why = '생계비·가족비·경조비·종교활동비 ' + finRvWon_(normSum(rows)) + '원 — 사회통념 범위면 증여 아님(상증법 §46 5호·시행령 §35④)' + (T.사회통념한도 ? '' : ', 한도는 사건 기준 탭 「사회통념한도」'); }
    else if (x && FIN_ANS_DEAL_.test(lane(x))) { ans = '해당 없음'; why = lane(x) + '(' + (x.출처 || '') + ') — 보증금·대금으로 보임'; }
    else if (pr) { ans = '해당 없음'; why = '부동산 ' + pr.종류 + ' ' + pr.날짜 + ' ' + finRvWon_(pr.금액) + '원(' + pr.근거 + ')'; }
    else if (ins) { ans = '해당 없음'; why = '보험금 ' + finRvWon_(ins.금액) + '원(' + ins.근거 + ')'; }
    else why = /^B/.test(f.번호) ? '쓰임을 밝혀야 함(소명 판단)' : '근거 서류를 찾지 못함';
    var ns = normSum(rows); if (ans === '확인 전' && ns > 0) why = (why === '근거 서류를 찾지 못함' ? '' : why + ' · ') + '그 가운데 생계비·가족비·경조비·종교활동비 ' + finRvWon_(ns) + '원은 사회통념 범위면 증여 아님(§46 5호) — 나머지 ' + finRvWon_(Math.max(0, rows.reduce(function (s, r) { return s + (r.out || 0); }, 0) - ns)) + '원 쓰임 확인';
    f.상태답안 = ans; f.답안근거 = why;
    if (f.want) { f.요청답안 = '요청함'; f.요청근거 = '과세관청이 볼 수 있는 자료 — 사건 폴더에 없음'; }
  });
  // 묶음 판단
  A.bundles.forEach(function (b) {
    var x = byName[finRvNorm_(b.상대 || '')], L = x ? loanOf(x.이름) : null, big = Math.max(b.나감, b.들어옴);
    if (L) { b.판단답안 = b.순액 > 0 ? '대여(채권 남음)' : '정상 거래'; b.답안근거 = L.근거 + (L.금액 ? ' · ' + finRvWon_(L.금액) + '원' : ''); }
    else if (x && FIN_ANS_DEAL_.test(lane(x))) { b.판단답안 = '정상 거래'; b.답안근거 = lane(x) + ' — 보증금·대금(' + (x.출처 || '') + ')'; }
    else if (big && Math.abs(b.순액) <= big * 0.1) { b.판단답안 = '자기 돈 왕복'; b.답안근거 = '나감·들어옴이 거의 같음'; }
    else { b.판단답안 = '모름'; b.답안근거 = '근거 서류를 찾지 못함'; }
  });
  // 여쭐 것 — 세금이 달라지는 것만. 여기 오른 것의 그 칸(_ask)만 시트 바탕을 노랗게(세무사님 11-25 "내가 입력할 것과 아닌 것을 명확하게 구분해 줘야지")
  var asks = [], base = U.base || {};
  A.rels.forEach(function (x) { x._ask = ''; }); A.bundles.forEach(function (b) { b._ask = false; }); A.flags.forEach(function (f) { f._ask = false; }); A._askD = false;
  if (!finRvYmd_(base.상속개시일)) {
    if (!U.guess || (U.guess.다른날 || []).length) A._askD = true;
    if (!U.guess) asks.push({ 무엇: '상속개시일', 답안: '(서류 없음)', 근거: '사망진단서·기본증명서·초본이 사건 폴더에 없음 — 받을 자료', 곳: '사건 기준 탭 「값 ✎」', 열쇠: 'ask:D' });
    else if ((U.guess.다른날 || []).length) asks.push({ 무엇: '상속개시일(서류끼리 다름)', 답안: U.guess.D + (U.guess.T ? ' ' + U.guess.T : ''), 근거: U.guess.from + ' / 다른 날: ' + U.guess.다른날.join('; '), 곳: '사건 기준 탭 「값 ✎」', 열쇠: 'ask:D2' });
  }
  if (U.heirsGuess && !A.rels.some(function (x) { return x.갈래 === '상속인'; })) {
    var say = U.heirSay && U.heirsGuess.이름.join('') !== U.heirSay.이름 ? ' / ' + U.heirSay.from + ': 「' + U.heirSay.글 + '」(상속포기 등 확인)' : '';
    asks.push({ 무엇: '상속인 확정', 답안: U.heirsGuess.이름.join(' · '), 근거: U.heirsGuess.from + say, 곳: '분석대상자 탭 「갈래 ✎」(바탕이 노란 줄 — 맞으면 「상속인」, 아니면 맞는 갈래)', 열쇠: 'ask:heirs' });
    A.rels.forEach(function (x) { if (!x.갈래 && x.짐작 === '상속인') x._ask = 'heir'; });
  }
  // 큰돈이 오갔는데 누구인지 모르는 상대(③) — 가족·친척·특수관계면 §13 합산이 달라짐
  (A.targets || []).forEach(function (t) {
    var x = t.x; if (t.구분 !== 2 || !x || x.갈래 || x.짐작 || (t.기간나감 || 0) < T.큰돈) return;
    x._ask = 'who';
    asks.push({ 무엇: x.이름 + ' — 누구인지(가족·친척·특수관계면 사전증여 합산, ' + (B.D ? t.yrs + '년' : '전체') + ' 안 나감 ' + finRvWon_(t.기간나감) + '원)', 답안: '(모름)', 근거: '서류·통장 글자로 관계를 찾지 못함 · ' + (x.출처 || ''), 곳: '분석대상자 탭 「갈래 ✎」(바탕이 노란 줄)', 열쇠: 'ask:who:' + finRvNorm_(x.이름) });
  });
  A.bundles.forEach(function (b) {
    var x = byName[finRvNorm_(b.상대 || '')];
    if (!b.판단 && x && FIN_RV_FAMILY_.test(lane(x)) && Math.abs(b.순액) >= T.큰돈 && (b._ask = true)) asks.push({ 무엇: b.이름 + (b.순액 > 0 ? ' — 대여인지 증여인지(순액 ' : ' — 무슨 돈인지(빌린 돈·갚은 돈·받은 돈, 순액 ') + finRvWon_(b.순액) + '원)', 답안: b.판단답안, 근거: b.답안근거, 곳: '묶음 탭 「판단 ✎」', 열쇠: 'ask:b:' + b.이름 });
  });
  A.flags.forEach(function (f) { if (/^B/.test(f.번호) && !f.상태 && f.상태답안 === '확인 전' && (f._ask = true)) asks.push({ 무엇: f.짚을것 + (f.금액 ? ' · ' + finRvWon_(f.금액) + '원' : ''), 답안: f.상태답안, 근거: f.까닭 || '', 곳: '짚을 곳 탭 「상태 ✎」(바탕이 노란 줄 — 일부만 소명되면 거래 탭 「소명액 ✎」도)', 열쇠: 'ask:' + f.id }); });
  // 분석대상자 상태 — 적으셔야 할 줄 · 답안 있는 줄 · 묻지 않는 줄을 글로도 가름
  A.rels.forEach(function (x) { x.답안상태 = x.갈래 ? '확정(세무사님)' : x._ask ? '적으셔야 함 — 여쭐 것' : x.짐작 ? '답안(GAS) — 맞으면 안 적으셔도 됨' : '모름 — 큰돈 아님, 안 적으셔도 됨'; });
  A.asks = asks;
}

// ============================================================
// [2026.11.25] 넥스가 쓰는 길(계획서 D) — 세무사님이 넥스를 부르실 때만(밤·자동 넥스는 이 도구를 못 씀: job 서버 NR_READ_TOOLS_에 없음)
//  ① 성격: 통장 글자 종류의 뜻 → GAS가 못 정한 줄에만 「(넥스)」로  ② 대상자: 답안이 빈 사람만 짐작으로(세무사님 값·GAS 답안은 안 바꿈)
//  ③ 의견: 거래 줄 「넥스 의견」 칸. 쓴 뒤 그 사건 2단계를 바로 다시 셈해 시트·보고서에 반영
// ============================================================
function finNexNote_(b) {
  var c = finCase_(b.caseId), folder = DriveApp.getFolderById(c.폴더ID), S = finRvLoad_(folder), U = S.U;
  U.nex = U.nex || { natures: {} }; var n = { 성격: 0, 대상자: 0, 의견: 0, 안씀: [] };
  (Array.isArray(b.성격) ? b.성격 : []).slice(0, 500).forEach(function (x) {
    var k = finRvNorm_(String(x && x.글자 || '')).replace(/\d{4,}/g, '#'), v = String(x && x.성격 || '').trim().slice(0, 30);
    if (!k || !v) return; if (U.nex.natures[k] !== v) { U.nex.natures[k] = v; n.성격++; }
  });
  var have = {}; (U.rel || []).forEach(function (x) { have[finRvNorm_(x.이름)] = x; });
  (Array.isArray(b.대상자) ? b.대상자 : []).slice(0, 200).forEach(function (p) {
    var name = String(p && p.이름 || '').trim(); if (!name) return;
    var x = have[finRvNorm_(name)];
    if (!x) { x = { 이름: name, 갈래: '', 짐작: '', 관계: '', 별칭: [], 계좌: [], 출처: '넥스(세무사님 확인 전)', 상태: '' }; U.rel.push(x); have[finRvNorm_(name)] = x; }
    var put = function (k, v) { v = String(v || '').trim(); if (v && !x[k]) { x[k] = v.slice(0, 40); return true; } return false; };
    var did = false;
    if (!x.갈래) did = put('짐작', p.갈래) || did;
    did = put('관계짐작', p.관계) || did;
    if (did) { if (String(x.출처 || '').indexOf('넥스') === -1) x.출처 = (x.출처 ? x.출처 + ' · ' : '') + '넥스' + (p.근거 ? '(' + String(p.근거).slice(0, 60) + ')' : ''); n.대상자++; }
    else n.안씀.push(name + ' — 이미 답안·세무사님 값이 있음');
  });
  (Array.isArray(b.의견) ? b.의견 : []).slice(0, 500).forEach(function (o) {
    var k = String(o && o.열쇠 || '').trim(), v = String(o && o.의견 || '').trim().slice(0, 300); if (!k || !v) return;
    var row = U.rows[k] || {}; if (row.넥스 !== v) { row.넥스 = v; U.rows[k] = row; (U.nexPend = U.nexPend || {})[k] = 1; n.의견++; }
  });
  U.nex.at = new Date().toISOString();
  finRvSave_(folder, S);
  var st = finStateLoad_(folder), rr = null;
  try { rr = finRvRun_(c, folder, st, { force: true, budgetMs: 200000 }); } catch (e) { rr = { error: String(e && e.message || e).slice(0, 160) }; }
  return { ok: true, 적음: n, 다시셈: rr && rr.ok ? (rr.retry ? '다음 번에(줄 차례가 바뀜)' : '시트·보고서에 반영') : (rr && (rr.skip || rr.error)) || '', 안내: '넥스 값은 「(넥스)」·「넥스」 출처로 보이고 세무사님 판단으로 세지 않습니다(✎ 칸이 먼저).' };
}
