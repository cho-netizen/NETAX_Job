// ============================================================
// [2026.11.24] 금융거래 2단계 — 사전증여·추정상속재산 선제 검토(과세관청이 볼 것을 먼저 추려냄)
// ------------------------------------------------------------
// 세무사님 11-24 「권장대로 하자」 — 계획서 docs/_기록/금융거래_2단계_분석_계획서_20261124.html(둘째 판)
//  "핵심은 과세관청에서 납세자가 제시하지 않은 금융자료가지 망라하여 사전증여 여부와 추정상속 여부를 검토하는 것을 선제적으로 검토하는 것이다"
//  "기존에 내가 검토하던 형식을 그대로 답습하려고 하지는 마라 … 중요한 것은 검토방법이나 검토로직이다"
//  "완성되기 전에는 내가 수동분석을 병행할 수 있도록 해야 하고, 수동분석하는 것을 수시로 분석시스템에 업데이트 해야 한다"
//
//  · 1단계가 만든 합친 시트(금융거래_통합_○○)를 읽어 같은 시트에 2단계 칸·탭을 더한다(GAS, AI 0원).
//    순서(계획서 4절): 전체 잔액 → 안에서 옮김 지우기 → 바깥 흐름 → 상대 밝히기(관련인) → 한 건으로 묶기 → 성격 후보 → 기간·기준 → 짚을 곳 A~D
//  · 세무사님 칸(✎)은 사건 폴더 「_금융거래_검토.json」(보관)이 원본이고 시트는 고치시는 자리 — 거래 열쇠로 보관했다가 다시 합쳐도 다시 붙인다.
//    GAS는 ✎ 칸을 덮어쓰지 않는다(빈 칸에 세무사님 엑셀 판단을 옮겨 넣는 것만). 넥스는 「넥스 의견」 칸에만.
//  · 판단(증여·대여·소명·특수관계)은 세무사님 몫. GAS는 후보·까닭·합계만. 성씨만 같은 것은 맞춤으로 치지 않는다.
//  · 언제: 1분 틱(job 서버 FinProxy.js → fin_merge_auto)이 1단계를 본 뒤 여기로 — 시트를 세무사님이 고치셨거나(파일 수정 시각),
//    1단계가 다시 썼거나, 이 규칙 판(FIN_RV_VER_)·가족 지도가 바뀌었을 때만 다시 셈. 셈 결과가 같으면 시트를 다시 쓰지 않는다.
// ============================================================
var FIN_RV_VER_ = '2026-11-25c';
var FIN_RV_FILE_ = '_금융거래_검토.json';
var FIN_RV_DEF_ = { 큰돈: 10000000, 현금쪼갬합계: 10000000, 현금쪼갬일: 3, 자주횟수: 3, 자주합계: 10000000, 목록기준: 1000000, 직전일: 90 };
var FIN_RV_LANES_ = ['상속인', '상속인 아닌 가족·친척', '특수관계 법인', '세입자', '임대인', '매수인', '매도인', '공사·용역 업체', '그 밖 거래처', '금융기관·보험', '병원·요양', '공과금·세금', '피상속인 본인', '그 밖'];
var FIN_RV_FAMILY_ = /^(상속인|상속인 아닌 가족·친척|특수관계 법인)$/;
var FIN_RV_NOT_PARTY_ = /^(금융기관·보험|병원·요양|공과금·세금|피상속인 본인)$/;
var FIN_RV_NATURES_ = ['안에서 옮김', '바깥 — 안에서 옮김 아님', '대여', '대여 회수', '차입', '차입 상환', '이자 지급', '이자 수입', '월세', '보증금 받음', '보증금 돌려줌', '매각대금', '취득대금', '생활비·부양', '병원비', '세금', '공과금·관리비', '카드대금', '보험료', '보험금', '연금·급여 수입', '현금 인출', '현금 입금', '수표', '해지·만기', '사전증여 의심', '자기 돈 왕복', '용도 모름'];
var FIN_RV_JUDGE_ = ['대여(채권 남음)', '사전증여', '생활비·부양', '자기 돈 왕복', '정상 거래', '미소명', '모름'];
var FIN_RV_STATE_ = ['확인 전', '물음 보냄', '답 받음', '소명 됨', '소명 안 됨', '해당 없음'];
var FIN_RV_MEAN_ = ['상대', '성격', '묶음', '소명액', '메모', '가져오지 않음'];
// 거래 탭에 2단계가 더하는 칸 — GAS 칸 / 세무사님 칸(✎) / 넥스 칸
var FIN_RV_GAS_COLS_ = ['전체 잔액', '기간', '흐름', '상대(GAS)', '맞춘 까닭', '성격(GAS)', '묶음(GAS)', '짚임'];
var FIN_RV_USER_COLS_ = ['상대 ✎', '성격 ✎', '묶음 ✎', '소명액 ✎', '메모 ✎'];
var FIN_RV_USER_KEY_ = { '상대 ✎': '상대', '성격 ✎': '성격', '묶음 ✎': '묶음', '소명액 ✎': '소명액', '메모 ✎': '메모' };
var FIN_RV_NEX_COL_ = '넥스 의견', FIN_RV_KEY_COL_ = '열쇠';
// 2단계 탭(1단계 탭 「거래」 바로 뒤에 이 차례로)
// [2026.11.25] 분석 차례대로 — 증감분석 → 분석대상자 → 대상자별 거래 → 판정(짚을 곳·§15·§13) → 받을 자료 → 배운 것 → 기준(옛 「흐름」·「관련인」은 앞 둘로 바뀜)
var FIN_RV_TABS_ = ['증감분석', '분석대상자', '대상자별 거래', '짚을 곳', '추정상속(§15)', '사전증여(§13)', '묶음', '받을 자료', '배운 것', '사건 기준', '엑셀 판단 가져오기'];
var FIN_RV_OLD_TABS_ = ['흐름', '관련인'];

// ---------- 글자 다듬기·맞추기(순수) ----------
var FIN_RV_GENERIC_RE_ = /^(대체|이체|현금|타행|타행이체|타행환|타행IB|타행MB|타행CD|타행SB|자동이체|자동납부|인터넷|인터넷뱅킹|인뱅|모바일|모바일뱅킹|스마트|스마트폰|스마트뱅킹|폰뱅킹|텔레뱅킹|CD|ATM|CDATM|창구|수표|자기앞|자기앞수표|이자|결산|결산이자|예금이자|해지|만기|지급|입금|출금|송금|당행|당행이체|CMS|펌뱅킹|오픈뱅킹|체크카드|전자금융|IB|MB|SB|BZ|대체입금|대체출금|현금입금|현금출금|이체입금|이체출금|기타|정상|취소|오류정정|원금|원리금|이자지급|과세|비과세|송금입금|가상계좌|무통장|무통장입금|입금이체|출금이체|일반|창구입금|창구출금|모바일입금|모바일출금|인터넷입금|인터넷출금|계좌이체|간편이체|간편송금|오픈|FB|EB|TB)$/;
function finRvNorm_(s) {
  return String(s == null ? '' : s).replace(/\(주\)|㈜|주식회사|유한회사|\(유\)|\(사\)|사단법인|재단법인/g, '').replace(/[\s()\[\]{}<>·.,\-_/\\:;'"`~!?@#$%^&+=|]/g, '').replace(/님$/, '').toUpperCase();
}
var FIN_RV_BANKONLY_RE_ = null;
function finRvGeneric_(n) {
  if (!n || n.length < 2 || /^[\d*]+$/.test(n) || FIN_RV_GENERIC_RE_.test(n)) return true;
  if (FIN_RV_BANKONLY_RE_ === null) FIN_RV_BANKONLY_RE_ = typeof FIN_BANK_RE_ !== 'undefined' ? new RegExp('^(' + FIN_BANK_RE_.source.replace(/^\(|\)$/g, '') + ')(은행)?$') : /^$/;
  return FIN_RV_BANKONLY_RE_.test(n);
}
// 가린 자리(*)를 빼고 오른쪽부터 맞대기 — 같은 자리 숫자가 6개 이상 같고 다른 자리가 없으면 같은 계좌
function finRvAcctLike_(a, b) {
  a = String(a || '').replace(/[^\d*]/g, ''); b = String(b || '').replace(/[^\d*]/g, '');
  if (!a || !b) return false;
  var n = 0, i = a.length - 1, j = b.length - 1;
  for (; i >= 0 && j >= 0; i--, j--) { var x = a.charAt(i), y = b.charAt(j); if (x === '*' || y === '*') continue; if (x !== y) return false; n++; }
  return n >= 6;
}
// 이름(가린 글자 * 허용) — 같은 길이에 * 아닌 글자가 모두 같으면 같은 사람
function finRvNameLike_(a, b) {
  a = finRvNorm_(a); b = finRvNorm_(b); if (!a || !b) return false; if (a === b) return true;
  if (a.length !== b.length || (a.indexOf('*') === -1 && b.indexOf('*') === -1)) return false;
  for (var i = 0; i < a.length; i++) { var x = a.charAt(i), y = b.charAt(i); if (x !== '*' && y !== '*' && x !== y) return false; }
  return true;
}
function finRvTexts_(r) { return [r.상대, r.내용, r.메모].map(function (s) { return { raw: String(s || '').trim(), n: finRvNorm_(s) }; }).filter(function (x) { return x.n; }); }
// 낱말 — 통장 글은 지점·은행·숫자·거래 말·이름이 한 칸에 붙어 온다(11-24 시험: 실사건 PDF 「999300 전자금융타행이체전문 김○○ 농협 5,000,000」).
//  사람·상호로 보이는 낱말만 남긴다. 앞에 붙은 은행 이름(「신한박○○」)은 떼어 낸다.
var FIN_RV_BANKPFX_RE_ = /^(신한|국민|농협|축협|우리|하나|기업|우체국|새마을|신협|수협|KB|NH|IBK|SC|씨티|카카오|토스|케이|부산|대구|경남|광주|전북|제주|산업|수출입)(?=[가-힣A-Z]{2,})/;
var FIN_RV_TOKNOT_RE_ = /이체|송금|대체|입금|출금|전문|거래|처리|자동|납부|결제|인출|분기|신규|추가|공동망|타발|당발|타행|당행|펌뱅킹|오픈뱅킹|전자금융|인터넷|모바일|스마트|텔레|창구|자기앞|수표발행|정기|해지|만기|이자|결산|원리금|상환|대출원금|정상|취소|정정|은행|저축|금고|^[A-Z]{1,3}$/;
var FIN_RV_PLACE_RE_ = /.(역|지점|영업점|우체국|출장소|지사|본부)$/;
function finRvTokens_(raw) {
  var out = [];
  // 「세종로 (0235)」·「일반업무( (2497)」처럼 점포 번호가 붙은 낱말은 거래한 지점 — 상대가 아님(11-24 시험: 실사건 국민은행 PDF)
  String(raw || '').replace(/[^\s()]+\(?\s*\(\s*\d{3,5}\s*\)/g, ' ').split(/[\s:：;,，/|·]+/).forEach(function (w) {
    var n = finRvNorm_(w); if (!n) return;
    // 앞에 붙은 은행 이름은 남은 글자가 사람 이름(한글 2~4자)일 때만 뗀다 — 「국민연금」·「신한카드」·「카카오뱅크」는 그대로
    var m = FIN_RV_BANKPFX_RE_.exec(n), rest = m ? n.slice(m[1].length) : '';
    if (m && /^[가-힣]{2,4}$/.test(rest) && !/^(연금|카드|생명|은행|저축|증권|캐피탈|보험|적금|예금|뱅크|페이|머니|화재|손해|건강|신탁|펀드|대출|이자)/.test(rest)) n = rest;
    if (n.length < 2 || /\d{3,}/.test(n) || /^\d/.test(n) || finRvGeneric_(n) || FIN_RV_TOKNOT_RE_.test(n)) return;
    if (/^(국민|신한|농협|축협|우리|하나|기업|우체국|새마을|신협|수협|씨티|카카오|토스|케이|부산|대구|경남|광주|전북|제주|산업|SC제일)은?$/.test(n)) return; // 「국민은」(잘린 은행 이름)
    if (FIN_RV_PLACE_RE_.test(n)) return;
    if (out.indexOf(n) === -1) out.push(n);
  });
  return out;
}
// 상대로 보이는 낱말 하나 — 「상대」 칸 낱말이 먼저, 없으면 내용·메모의 마지막 낱말(통장 글은 대개 상대가 끝에 옴)
function finRvParty_(r) {
  var fields = [r.상대, r.내용, r.메모];
  for (var i = 0; i < fields.length; i++) {
    var t = finRvTokens_(fields[i]); if (!t.length) continue;
    var n = i === 0 ? t[0] : t[t.length - 1];
    return { raw: n, n: n };
  }
  return null;
}
function finRvYmd_(s) {
  var t = String(s == null ? '' : s).trim(), m;
  if ((m = /^(\d{4})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})/.exec(t))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  if ((m = /^(\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})(?!\d)/.exec(t))) return (Number(m[1]) > 50 ? '19' : '20') + m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(t))) return m[1] + '-' + m[2] + '-' + m[3];
  return '';
}
function finRvAddY_(d, n) { if (!d) return ''; var s = (Number(d.slice(0, 4)) + n) + d.slice(4); if (s.slice(5) === '02-29') s = s.slice(0, 5) + '02-28'; return s; }
function finRvAddD_(d, n) { var t = Date.parse(d + 'T00:00:00Z'); if (!t) return ''; return new Date(t + n * 86400000).toISOString().slice(0, 10); }
function finRvDays_(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
function finRvMin_(t) { var m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function finRvNum_(v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).replace(/[,\s원₩]/g, ''); if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null; return Number(s); }
function finRvWon_(n) { return (Math.round(Number(n) || 0)).toLocaleString('ko-KR'); }
function finRvKrw_(r) { return !r.cur || r.cur === '원' || r.cur === 'KRW'; }

// ---------- 사건 기준 ----------
function finRvBase_(U, taxpayer) {
  var b = U.base || {}, num = function (k) { var v = finRvNum_(b[k]); return v != null && v > 0 ? v : FIN_RV_DEF_[k]; };
  // 상속개시일 — 세무사님 값 > 사건 폴더 의뢰서·메모 글에서 짐작한 값(U.guess — 「(추정)」이라 적힌 것도 짐작으로 표시)
  var D = finRvYmd_(b.상속개시일) || finRvYmd_((U.guess || {}).D), tm = /^(\d{1,2}):(\d{2})/.exec(String(b.상속개시시각 || ''));
  return { 피상속인: String(b.피상속인 || taxpayer || '').trim(), D: D, D짐작: !finRvYmd_(b.상속개시일) && !!D ? (U.guess || {}).from : '', Dt: tm ? ('0' + tm[1]).slice(-2) + ':' + tm[2] : '',
    T: { 큰돈: num('큰돈'), 현금쪼갬합계: num('현금쪼갬합계'), 현금쪼갬일: num('현금쪼갬일'), 자주횟수: num('자주횟수'), 자주합계: num('자주합계'), 목록기준: num('목록기준'), 직전일: num('직전일') } };
}
function finRvPeriod_(r, B) {
  if (!B.D) return '';
  if (r.d > B.D) return '개시 후';
  if (r.d === B.D) return B.Dt && r.t ? (r.t.slice(0, 5) < B.Dt ? '개시 당일(전)' : '개시 당일(후)') : '개시 당일';
  if (r.d >= finRvAddY_(B.D, -1)) return '1년 안';
  if (r.d >= finRvAddY_(B.D, -2)) return '2년 안';
  if (r.d >= finRvAddY_(B.D, -5)) return '5년 안';
  if (r.d >= finRvAddY_(B.D, -10)) return '10년 안';
  return '10년 밖';
}
// 상속개시일 전(당일은 시각이 있으면 그 전만)으로 N년 안인가
function finRvBefore_(r, B, years) {
  if (!B.D || r.d > B.D) return false;
  if (r.d === B.D && B.Dt && r.t && r.t.slice(0, 5) >= B.Dt) return false;
  return r.d >= finRvAddY_(B.D, -years);
}

// ---------- 성격 후보(낱말) ----------
function finRvNatureWord_(r, txt) {
  var o = r.out > 0, i = r.in > 0, s = txt;
  if (/대출|대부금|융자|마이너스|상환원금|상환이자|원리금상환/.test(s)) return o ? '대출 상환·이자' : '대출받은 돈';
  if (/해지|만기|중도해지/.test(s)) return '해지·만기';
  if (o && /납부출금|자동납부|지로|CMS출금/.test(s)) return '공과금·관리비';
  if (i && /이자|결산|이익분배/.test(s)) return '이자 수입';
  if (i && /연금|급여|월급|상여|기초노령|기초연금|보수|수당|휴가비|성과급|퇴직금/.test(s)) return '연금·급여 수입';
  if (o && /국민연금|건강보험|건보|장기요양/.test(s)) return '공과금·관리비';
  if (o && /카드/.test(s)) return '카드대금';
  if (/보험|생명|화재|손해|공제회/.test(s)) return o ? '보험료' : '보험금';
  if (o && /국세|지방세|세무서|구청|시청|군청|재산세|소득세|부가세|양도세|상속세|증여세|위택스|홈택스|지로|관세|취득세|등록세/.test(s)) return '세금';
  if (o && /전기|한전|가스|수도|관리비|통신|KT|SKT|LGU|유플러스|아파트|케이블|인터넷요금|휴대폰|핸드폰/.test(s)) return '공과금·관리비';
  if (o && /병원|의원|요양|약국|치과|한의|메디|의료|간병|장례|상조/.test(s)) return '병원비';
  if (/수표/.test(s)) return '수표';
  if (/현금|ATM|CD|창구출금|창구입금|무통장/.test(s)) return o ? '현금 인출' : '현금 입금';
  if (i && r.in >= 50000000 && /매매|매도|매각|잔금|계약금|중도금|보상/.test(s)) return '매각대금';
  if (o && /매매|매수|잔금|계약금|중도금|분양/.test(s)) return '취득대금';
  if (/보증금/.test(s)) return o ? '보증금 돌려줌' : '보증금 받음';
  if (i && /월세|임대료|차임/.test(s)) return '월세';
  return '';
}

// ---------- 본체(순수 — 이 컴퓨터 시험이 그대로 부름) ----------
// R: 거래 줄 [{k,d,t,acct,dg,org,holder,in,out,bal,cur,상대,상대은행,상대계좌,구분,내용,메모}]  U: 보관(rows·rel·bundles·flags·base)
function finRvAnalyze_(R, U, opt) {
  opt = opt || {};
  var B = finRvBase_(U, opt.taxpayer), T = B.T, P = finRvNorm_(B.피상속인);
  // 세무사님 칸 = 시트에 적으신 값 > 엑셀에서 옮긴 값(_x)
  var urow = function (r) { var o = U.rows && U.rows[r.k]; if (!o) return {}; if (!o._x) return o; var m = Object.assign({}, o._x); Object.keys(o).forEach(function (k) { if (k !== '_x' && o[k]) m[k] = o[k]; }); return m; };
  // ① 피상속인 계좌(예금주가 비었거나 피상속인) — 다른 사람 계좌는 전체 잔액·안에서 옮김에서 뺀다
  var accts = {}, acctList = [];
  R.forEach(function (r) {
    var a = accts[r.acct]; if (!a) { a = accts[r.acct] = { acct: r.acct, dg: r.dg, org: r.org, holder: r.holder, rows: [] }; acctList.push(a); }
    a.rows.push(r);
  });
  acctList.forEach(function (a) { a.own = !a.holder || !P || finRvNameLike_(a.holder, B.피상속인) || finRvNorm_(a.holder).indexOf(P) !== -1 || P.indexOf(finRvNorm_(a.holder)) !== -1; });
  R.forEach(function (r) {
    r.own = accts[r.acct].own; r.krw = finRvKrw_(r); r.dir = r.in > 0 ? 'i' : r.out > 0 ? 'o' : ''; r.amt = r.in > 0 ? r.in : r.out;
    r.tx = finRvTexts_(r); r.tx.forEach(function (x) { x.gen = finRvGeneric_(x.n); });
    r.tok = []; [r.상대, r.내용, r.메모].forEach(function (s) { finRvTokens_(s).forEach(function (w) { if (r.tok.indexOf(w) === -1) r.tok.push(w); }); });
    // 성격 짐작 글에는 거래구분 칸도 넣는다(「납부출금」·「대출」처럼 구분 칸에만 있는 말 — 11-24 운영: 본인 이름 자동납부를 다른 계좌로 봄)
    r.best = finRvParty_(r); r.txt = r.tx.map(function (x) { return x.raw; }).concat([String(r.구분 || '')]).join(' ');
    r.cdg = String(r.상대계좌 || '').replace(/[^\d*]/g, '');
  });
  var order = R.map(function (r, i) { return i; }).sort(function (p, q) { var a = R[p], b = R[q]; return a.d < b.d ? -1 : a.d > b.d ? 1 : (a.t || '') < (b.t || '') ? -1 : (a.t || '') > (b.t || '') ? 1 : p - q; });

  // ② 안에서 옮김 — 피상속인 계좌끼리 같은 금액(원화). 단서(상대계좌·본인 이름·은행 이름)가 있으면 하루 차이까지, 없으면 같은 날(시각 있으면 30분 안)
  var hint = function (o, n) {
    if (o.상대계좌 && finRvAcctLike_(o.상대계좌, n.dg)) return true;
    if (n.상대계좌 && finRvAcctLike_(n.상대계좌, o.dg)) return true;
    if (P && P.length >= 2 && ((o.best && o.best.n.indexOf(P) !== -1) || (n.best && n.best.n.indexOf(P) !== -1))) return true;
    return false;
  };
  // 받는 줄은 날짜로 모아 둔다 — 같은 금액, 또는 단서가 있으면 보낸 쪽이 수수료만큼(5천원 안) 많은 것까지(11-24 시험: 실사건 70,003,000 → 70,000,000)
  var insBy = {};
  R.forEach(function (r) { if (r.own && r.krw && r.in > 0) (insBy[r.d] = insBy[r.d] || []).push(r); });
  order.forEach(function (ix) {
    var o = R[ix]; if (!(o.own && o.krw && o.out > 0) || o.pair) return;
    if (urow(o).성격 && !/안에서 옮김/.test(urow(o).성격)) return; // 세무사님이 다른 성격으로 정하신 줄은 짝짓지 않음
    var best = null, bs = -1;
    [finRvAddD_(o.d, -1), o.d, finRvAddD_(o.d, 1)].reduce(function (a, d) { return a.concat(insBy[d] || []); }, []).forEach(function (n) {
      if (n.pair || n.acct === o.acct) return;
      var fee = o.out - n.in; if (fee < 0 || fee > 5000) return;
      if (fee > 0 && !hint(o, n)) return;
      if (urow(n).성격 && !/안에서 옮김/.test(urow(n).성격)) return;
      var dd = Math.abs(finRvDays_(o.d, n.d)); if (dd > 1) return;
      var h = hint(o, n), mo = finRvMin_(o.t), mn = finRvMin_(n.t), tdiff = mo != null && mn != null && dd === 0 ? Math.abs(mo - mn) : null;
      if (!h && dd !== 0) return;
      if (!h && tdiff != null && tdiff > 30) return;
      if (!h && tdiff == null && o.out < 100000) return;
      var sc = (h ? 4 : 0) + (dd === 0 ? 2 : 0) + (fee === 0 ? 1 : 0) + (tdiff != null ? (tdiff <= 10 ? 2 : tdiff <= 60 ? 1 : 0) : 0);
      if (sc > bs) { bs = sc; best = n; }
    });
    if (best) { o.pair = best; best.pair = o; o.pairWhy = best.pairWhy = (hint(o, best) ? '상대계좌·본인 이름' : '같은 날 같은 금액') + (o.out !== best.in ? ' · 수수료 ' + finRvWon_(o.out - best.in) + '원' : ''); }
  });
  // 세무사님이 「안에서 옮김」으로 정하신 줄은 짝이 없어도 안에서 옮김
  // 짝 줄은 못 찾았지만 상대 계좌가 피상속인의 다른 계좌(이 시트에 있음)인 줄도 안에서 옮김
  var ownDg = acctList.filter(function (a) { return a.own && String(a.dg || '').replace(/\D/g, '').length >= 8; });
  R.forEach(function (r) { if (!r.pair && r.own && r.krw && r.cdg.replace(/\D/g, '').length >= 8 && !(urow(r).성격 && !/안에서 옮김/.test(urow(r).성격))) { var to = ownDg.filter(function (a) { return a.acct !== r.acct && finRvAcctLike_(a.dg, r.cdg); })[0]; if (to) { r.innerTo = to.acct; r.pairWhy = '상대 계좌가 피상속인 ' + to.acct + '(짝 줄 못 찾음)'; } } });
  R.forEach(function (r) { r.inner = !!r.pair || !!r.innerTo || /^안에서 옮김/.test(urow(r).성격 || ''); if (/^바깥/.test(urow(r).성격 || '')) r.inner = false; });
  // 짝이 없는데 피상속인 본인 이름으로 오간 줄 — 자료가 없는 피상속인 다른 계좌(관련인이 아님)
  //  · 「예금신규·예금추가입금·적금」처럼 피상속인 상품으로 간 줄도 같음(11-24 시험: 실사건 세무사님 「본인계좌 대체」 줄)
  //  · 이름 없이 계좌번호만 찍힌 큰돈은 「본인 다른 계좌일 수 있음」(selfMaybe) — 정하지 않고 그 계좌 자료를 받을 것으로
  R.forEach(function (r) {
    var mine = !r.inner && r.own && !urow(r).상대;
    // 본인 이름 낱말이 따로 있을 때만(「국세+본인 이름」·「본인 이름+경기군포」처럼 세금·공과금을 본인 이름으로 낸 줄은 본인 계좌가 아님 — 11-24 시험)
    r.self = mine && ((P.length >= 2 && r.tok.indexOf(P) !== -1 && !/세금|공과금|병원|카드|보험|대출/.test(finRvNatureWord_(r, r.txt))) || /예금신규|예금추가|정기예금신규|적금신규|적금납입|신탁신규|펀드매수|청약저축/.test(r.txt.replace(/\s+/g, '')));
    r.selfMaybe = mine && !r.self && !r.tok.length && r.amt >= T.큰돈 && (r.cdg.replace(/\D/g, '').length >= 10 || /^\d{10,}$/.test(finRvNorm_(r.내용)) || /^\d{10,}$/.test(finRvNorm_(r.상대)));
  });

  // ③ 전체 잔액(피상속인 원화 계좌 — 그 순간 계좌마다 마지막 잔액의 합)
  var last = {}, total = 0, starts = [], breaks = 0;
  order.forEach(function (ix) {
    var r = R[ix]; if (!r.own || !r.krw) return;
    var prev = last[r.acct], flow = (r.in || 0) - (r.out || 0), bal = r.bal;
    if (prev === undefined) { var open = bal != null ? bal - flow : 0; last[r.acct] = open; total += open; if (open) starts.push({ d: r.d, acct: r.acct, open: open }); prev = open; r.start = open; }
    if (bal == null) bal = prev + flow;
    // 1단계가 「－ 잔액 그대로인 금액 줄(이자를 바로 지급 등)」로 둔 줄은 은행 자료 그대로라 끊김으로 세지 않는다
    else if (Math.abs(prev + flow - bal) > 0.5) { if (/^(－|✅)/.test(r.검산 || '')) r.held = true; else { r.gap = bal - (prev + flow); breaks++; } }
    total += bal - prev; last[r.acct] = bal; r.total = Math.round(total * 100) / 100;
  });

  // ④ 관련인 — 보관된 표(세무사님·가족 지도·후보) + 세무사님이 거래 칸에 적으신 상대
  // [2026.11.25] 세무사님이 손대지 않은 「자주 오간 상대(GAS)」 후보는 셈마다 자료에서 새로 만든다 — 앞 판 후보를 들고 가면 한 셈에 200개씩
  //  더 붙어 셈마다 늘었음(11-25 운영 시험: 9,808줄 사건이 둘째 셈에 974줄을 더 맞춤). 계좌번호 칸만 GAS가 적어 둔 것과 다르면 아래에서 되살림.
  //  (앞 판이 후보로 넣은 피상속인 본인 이름은 되살리지 않음 — 11-24)
  var gasUntouched = function (x) { return x.출처 === '자주 오간 상대(GAS)' && !x.갈래 && !x.상속인 && !x.관계 && !(x.별칭 || []).length && !x.사업자번호 && !x.거래계약; };
  var gasSetAside = [];
  var rels = (U.rel || []).filter(function (x) {
    if (x.출처 === '자주 오간 상대(GAS)' && !x.갈래 && finRvNameLike_(x.이름, B.피상속인)) return false;
    if (gasUntouched(x)) { gasSetAside.push(x); return false; }
    return true;
  }).map(function (x) { return Object.assign({}, x, { 별칭: (x.별칭 || []).slice(), 계좌: (x.계좌 || []).slice() }); });
  var relBy = function (name) { var n = finRvNorm_(name); return rels.filter(function (x) { return finRvNorm_(x.이름) === n; })[0] || null; };
  var lane = function (x) { return x ? (x.갈래 || x.짐작 || '') : ''; };
  R.forEach(function (r) {
    var u = urow(r); if (!u.상대 || relBy(u.상대)) return;
    rels.push({ 이름: String(u.상대).trim(), 갈래: '', 짐작: '', 상속인: '', 관계: '', 별칭: [], 계좌: [], 출처: '세무사님이 거래 칸에 적으심', 상태: '갈래를 골라 주세요' });
  });
  // 세무사님이 정하신 줄에서 별칭·계좌를 배움(같은 글자·같은 계좌가 다른 줄에서도 그 사람으로 맞춰지게)
  //  상대 계좌번호는 그 번호로 오간 줄의 상대 글자가 하나뿐일 때만 배운다 — 결제대행·카드 번호처럼 여러 가맹점이 같은 번호로 찍히는 것을 사람 계좌로 착각하지 않게
  //  (11-24 시험: 실사건 쿠팡·세븐일레븐·DB손해보험이 같은 번호로 찍혀 2,795줄이 「서울대학교병원」으로 맞춰짐)
  var acctTexts = {};
  R.forEach(function (r) { var dg = r.cdg.replace(/\D/g, ''); if (dg.length >= 8 && r.best) { var o = acctTexts[dg] || (acctTexts[dg] = {}); o[r.best.n] = 1; } });
  var acctOne = function (raw) { var dg = String(raw || '').replace(/\D/g, ''); return dg.length >= 8 && acctTexts[dg] && Object.keys(acctTexts[dg]).length === 1; };
  var learned = 0;
  R.forEach(function (r) {
    var u = urow(r); if (!u.상대) return; var x = relBy(u.상대); if (!x) return;
    if (r.best && finRvNorm_(x.이름) !== r.best.n && x.별칭.map(finRvNorm_).indexOf(r.best.n) === -1 && x.별칭.length < 30) { x.별칭.push(r.best.raw); learned++; }
    var dg = String(r.상대계좌 || '').replace(/[^\d*]/g, '');
    if (dg.replace(/\*/g, '').length >= 8 && acctOne(r.상대계좌) && !x.계좌.some(function (a) { return finRvAcctLike_(a, dg); }) && x.계좌.length < 10) { x.계좌.push(r.상대계좌); learned++; }
  });
  var prep = function () { rels.forEach(function (x) { x._nm = finRvNorm_(x.이름); x._al = (x.별칭 || []).map(finRvNorm_).filter(String); x._ac = (x.계좌 || []).filter(function (a) { return String(a).replace(/[^\d]/g, '').length >= 6; }); }); };
  prep();
  var match = function (r) {
    if (!r.own || r.inner || r.self) return null;
    var t = r.tx, ng = t.filter(function (s) { return !s.gen; }), tk = r.tok, cd = r.cdg.replace(/\*/g, '').length >= 6, bestM = null;
    if (!ng.length && !cd) return null;
    rels.forEach(function (x) {
      if (lane(x) === '피상속인 본인') return;
      var nm = x._nm; if (!nm) return;
      var hit = null;
      if (cd && x._ac.length && x._ac.some(function (a) { return finRvAcctLike_(a, r.cdg); })) hit = { sure: 3, how: '상대 계좌번호' };
      else if (x._al.length && (t.some(function (s) { return x._al.indexOf(s.n) !== -1; }) || tk.some(function (w) { return x._al.indexOf(w) !== -1; }))) hit = { sure: 3, how: '정하신 별칭' };
      else if (t.some(function (s) { return s.n === nm; }) || tk.indexOf(nm) !== -1) hit = { sure: 3, how: '이름 같음' };
      else if (nm.length >= 2 && ng.some(function (s) { return (nm.length >= 3 && s.n.indexOf(nm) !== -1) || (nm.length === 2 && s.n.indexOf(nm) === 0); }) || tk.some(function (w) { return w.length >= 3 && nm.indexOf(w) === 0; })) hit = { sure: 1, how: '글자 일부(잘림·덧붙음)' };
      else if (/^[가-힣]{3}$/.test(nm) && tk.some(function (w) { return w === nm.slice(1); })) hit = { sure: 1, how: '성 빠짐' };
      // 같은 확실함·같은 길이면 목록 차례가 아니라 정해진 잣대로(11-25 운영: 「식비 쿠팡」 한 줄이 셈마다 쿠팡↔식비로 바뀜 — 첫 셈은 계산 차례, 다음 셈은 시트 탭 차례라서)
      // ① 세무사님이 갈래를 고르신 대상자 ② 긴 이름 ③ 통장 글자에서 먼저 나온 이름 ④ 이름 글자 차례
      if (hit) {
        var pos = (function () { var p = finRvNorm_(r.txt || '').indexOf(nm); return p < 0 ? 1e9 : p; })();
        var key = [hit.sure, x.갈래 ? 1 : 0, nm.length, -pos];
        var better = !bestM;
        if (!better) { for (var ki = 0; ki < key.length; ki++) { if (key[ki] !== bestM.key[ki]) { better = key[ki] > bestM.key[ki]; break; } if (ki === key.length - 1) better = nm < bestM.x._nm; } }
        if (better) bestM = { x: x, sure: hit.sure, how: hit.how, key: key };
      }
    });
    if (bestM) delete bestM.key;
    return bestM;
  };
  R.forEach(function (r) { r.m = match(r); });
  // 같은 상대 계좌로 오간 다른 줄을 세무사님이 정하셨으면 그 상대가 후보
  var byAcctUser = {};
  R.forEach(function (r) { var u = urow(r), dg = String(r.상대계좌 || '').replace(/[^\d]/g, ''); if (u.상대 && dg.length >= 8) byAcctUser[dg] = u.상대; });
  R.forEach(function (r) { var dg = String(r.상대계좌 || '').replace(/[^\d]/g, ''); if (!r.m && r.own && !r.inner && dg.length >= 8 && byAcctUser[dg]) { var x = relBy(byAcctUser[dg]); if (x) r.m = { x: x, sure: 1, how: '같은 상대 계좌의 다른 줄을 정하심' }; } });
  // 최종 상대 = 세무사님 칸 > GAS 맞춤
  R.forEach(function (r) { var u = urow(r); r.party = u.상대 ? relBy(u.상대) : r.m ? r.m.x : null; r.partyUser = !!u.상대; });
  // [2026.11.25] 계약서(임대차·매매)에서 찾은 대상자 — 상대 글자로 못 맞춘 줄을 계약 금액·날짜로
  var byContract = finTgContractMatch_(R, rels);

  // ⑤ 자주 오간 상대 — 관련인 표에 없는 글자를 모아 후보로(세무사님은 갈래만 고르심)
  var grp = {};
  R.forEach(function (r) {
    if (!r.own || r.inner || r.self || r.party || !r.best || !r.krw) return;
    var g = grp[r.best.n] || (grp[r.best.n] = { raw: r.best.raw, n: 0, sum: 0, dg: {} });
    g.n++; g.sum += r.amt; var dg = String(r.상대계좌 || ''); if (acctOne(dg)) g.dg[dg] = 1;
  });
  var newCand = 0;
  Object.keys(grp).filter(function (k) { return grp[k].n >= T.자주횟수 || grp[k].sum >= T.자주합계; }).sort(function (a, b) { return grp[b].sum - grp[a].sum; }).slice(0, 200).forEach(function (k) {
    if (relBy(grp[k].raw)) return;
    var g = grp[k], w = g.raw;
    if (finRvNameLike_(w, B.피상속인)) return; // [2026.11.24] 피상속인 본인 이름(「○○○ 납부출금」처럼 은행이 예금주 이름을 적은 자동납부)은 관련인 후보가 아님
    var guess = /카드|보험|생명|화재|손해|증권|투자|은행|금고|신협|저축|캐피탈|공제|적금|예금|펀드|신탁|뱅크|페이/.test(w) ? '금융기관·보험' : /병원|의원|요양|약국|치과|한의|메디|의료/.test(w) ? '병원·요양' : /세무서|구청|시청|군청|국세|지방세|한전|전기|가스|수도|관리비|통신|KT|SKT|LGU|건강보험|국민연금|지로/.test(w) ? '공과금·세금' : /급여|보수|수당|휴가비|성과급|퇴직|연금/.test(w) ? '그 밖 거래처' : '';
    rels.push({ 이름: w, 갈래: '', 짐작: guess, 상속인: '', 관계: '', 별칭: [], 계좌: Object.keys(g.dg).slice(0, 5), 출처: '자주 오간 상대(GAS)', 상태: '후보 — 갈래를 골라 주세요' });
    newCand++;
  });
  // 셈 머리에서 거둔 후보 가운데 세무사님이 계좌번호를 적으신 것(GAS가 이번에 적을 계좌와 다름)은 되살림
  gasSetAside.forEach(function (x) {
    var g = grp[x.이름] || grp[finRvNorm_(x.이름)], own = relBy(x.이름);
    var extra = (x.계좌 || []).filter(function (a) { return !(g && g.dg[a]) && !(own && (own.계좌 || []).indexOf(a) !== -1); });
    if (!extra.length) return;
    if (own) { extra.forEach(function (a) { own.계좌.push(a); }); }
    else rels.push(Object.assign({}, x, { 별칭: [], 계좌: (x.계좌 || []).slice() }));
    newCand++;
  });
  if (newCand) { prep(); R.forEach(function (r) { if (!r.party && r.own && !r.inner) { var m = match(r); if (m) { r.m = m; r.party = m.x; } } }); }
  // [2026.11.25] 다른 사건에서 배운 갈래(상호·기관) — 세무사님 갈래·가족 지도 짐작이 없는 대상자만
  var learnUsed = { lanes: [], natures: 0, natureRows: [], flags: 0 };
  finLnApplyLanes_(rels, opt.learn); learnUsed.lanes = rels.filter(function (x) { return x.짐작배움 && !x.갈래; }).map(function (x) { return x.이름 + '→' + x.짐작; });

  // ⑥ 성격 후보 + 되풀이
  R.forEach(function (r) {
    if (r.inner) { r.nature = '안에서 옮김'; return; }
    if (r.self) { r.nature = '본인 다른 계좌(자료 없음)'; return; }
    if (r.selfMaybe) { r.nature = '계좌번호만(본인 예금일 수 있음)'; return; }
    if (!r.tok.length && !r.cdg && !finRvNatureWord_(r, r.txt)) { r.nature = '용도 모름(글자 없음)'; return; }
    var l = lane(r.party), w = finRvNatureWord_(r, r.txt);
    if (l === '세입자') w = r.in > 0 ? (w === '보증금 받음' || r.in >= T.큰돈 ? '보증금 받음' : '월세') : '보증금 돌려줌';
    else if (l === '매수인' && r.in > 0) w = '매각대금';
    else if (l === '매도인' && r.out > 0) w = '취득대금';
    else if (FIN_RV_FAMILY_.test(l)) w = w && /현금|수표/.test(w) ? w : r.out > 0 ? '관련인에게 감' : '관련인에게서 옴';
    r.nature = w;
  });
  var rec = {};
  R.forEach(function (r) { if (r.inner || !r.own || !r.amt) return; var key = (r.party ? 'p:' + r.party.이름 : r.best ? 't:' + r.best.n : '') ; if (!key) return; key += '|' + r.dir + '|' + r.amt; (rec[key] = rec[key] || []).push(r); });
  Object.keys(rec).forEach(function (k) {
    var L = rec[k], months = {}; L.forEach(function (r) { months[r.d.slice(0, 7)] = 1; });
    if (Object.keys(months).length >= 3) L.forEach(function (r) { r.repeat = Object.keys(months).length; if (!r.nature) r.nature = '되풀이(매달 같은 금액)'; });
  });
  // [2026.11.25] 다른 사건에서 배운 성격(통장 낱말) — GAS 낱말 규칙이 못 정했거나 「되풀이」뿐인 줄만
  R.forEach(function (r) {
    if (r.inner || r.self || r.selfMaybe || !r.own || (r.nature && !/^되풀이/.test(r.nature))) return;
    var h = finLnNature_(r, opt.learn); if (!h) return;
    r.nature = h.성격; r.natureLearn = true; learnUsed.natures++;
    var w = (r.best ? r.best.raw : '') + '→' + h.성격; if (learnUsed.natureRows.indexOf(w) === -1) learnUsed.natureRows.push(w);
  });

  // ⑦ 묶음 — 세무사님 칸 > GAS 후보(같은 상대와 나가고 들어온 돈이 둘 다 있으면 한 건)
  var both = {};
  R.forEach(function (r) { if (r.party && !r.inner && !FIN_RV_NOT_PARTY_.test(lane(r.party))) { var b = both[r.party.이름] || (both[r.party.이름] = { sum: 0 }); b[r.dir] = 1; b.sum += r.amt; } });
  R.forEach(function (r) {
    var u = urow(r);
    var b = r.party && both[r.party.이름]; r.bundleGas = b && b.i && b.o && b.sum >= T.큰돈 ? r.party.이름 + ' 오간 돈' : '';
    r.bundle = u.묶음 || r.bundleGas;
  });
  var bundles = {}, bList = [];
  R.forEach(function (r) {
    if (!r.bundle) return; var b = bundles[r.bundle];
    if (!b) { b = bundles[r.bundle] = { 이름: r.bundle, 상대: r.party ? r.party.이름 : '', 나감: 0, 들어옴: 0, 첫: r.d, 끝: r.d, 줄: 0, 세무사님: false }; bList.push(b); }
    if (r.out > 0) b.나감 += r.out; if (r.in > 0) b.들어옴 += r.in; if (r.d < b.첫) b.첫 = r.d; if (r.d > b.끝) b.끝 = r.d; b.줄++;
    if (urow(r).묶음) b.세무사님 = true; if (!b.상대 && r.party) b.상대 = r.party.이름;
  });
  bList.forEach(function (b) { var s = (U.bundles || {})[b.이름] || {}; b.순액 = b.나감 - b.들어옴; b.판단 = s.판단 || ''; b.메모 = s.메모 || ''; });

  // ⑧ 기간·흐름 갈래
  R.forEach(function (r) {
    r.period = finRvPeriod_(r, B);
    if (!r.own) { r.flow = '다른 사람 계좌'; return; }
    if (!r.krw) { r.flow = '외화(따로)'; return; }
    if (r.inner) { r.flow = '안에서 옮김'; return; }
    var l = lane(r.party), n = urow(r).성격 || r.nature || '';
    var g;
    if (r.self) g = '본인 다른 계좌(자료 없음)';
    else if (FIN_RV_FAMILY_.test(l)) g = '관련인';
    else if (/매각|보증금|보험금|해지|만기/.test(n) || /매수인/.test(l)) g = r.in > 0 ? '다른 자산·처분' : (/보증금/.test(n) ? '보증금' : '다른 자산·취득');
    else if (/이자 수입|연금/.test(n)) g = '이자·연금';
    else if (/현금|수표/.test(n)) g = '현금·수표';
    else if (/세금|공과금|병원|카드|보험료/.test(n) || /공과금|병원|금융기관/.test(l)) g = '생활비·공과금·카드';
    else if (/^(세입자|임대인|매도인|공사·용역 업체|그 밖 거래처)$/.test(l) || /월세/.test(n)) g = '거래처·임대';
    else g = '그 밖';
    r.flow = (r.in > 0 ? '들어옴 · ' : '나감 · ') + g; r.lane = g;
  });

  // ⑨ 짚을 곳 A~D
  var flags = [], fl = function (code, id, o) { var s = (U.flags || {})[code + ':' + id] || {}; flags.push(Object.assign({ 번호: code, id: code + ':' + id, 상태: s.상태 || '', 메모: s.메모 || '' }, o)); (o.rows || []).forEach(function (r) { (r.flags = r.flags || []).indexOf(code) === -1 && r.flags.push(code); }); };
  var D10 = B.D ? finRvAddY_(B.D, -10) : '';
  acctList.forEach(function (a) {
    if (!a.rows.length) return;
    var first = a.rows.reduce(function (m, r) { return r.d < m ? r.d : m; }, a.rows[0].d), lastD = a.rows.reduce(function (m, r) { return r.d > m ? r.d : m; }, a.rows[0].d);
    var lastBal = (function () { var L = a.rows.slice().sort(function (p, q) { return p.d < q.d ? -1 : p.d > q.d ? 1 : (p.t || '') < (q.t || '') ? -1 : 1; }); var z = L[L.length - 1]; return z.bal; })();
    if (!a.own) { fl('A3', 'acct:' + a.acct, { 갈래: 'A 자료 빈틈', 짚을것: '피상속인 아닌 사람 계좌 자료가 섞여 있음 — 전체 잔액에서 뺌', 날짜: first + ' ~ ' + lastD, 상대: a.holder, 까닭: '예금주 ' + a.holder + ' — 관련인 쪽 자료라면 피상속인 계좌에서 간 돈의 도착지로 이어 봄', 준비: '관련인 표에 그 사람을 넣어 주세요' }); return; }
    if (D10 && first > finRvAddD_(D10, 60)) fl('A1', 'start:' + a.acct, { 갈래: 'A 자료 빈틈', 짚을것: a.acct + ' — 자료가 ' + first + '부터(상속개시 10년 전 ' + D10 + '부터 필요)', 날짜: first, 금액: a.rows[0].bal, 까닭: '과세관청은 피상속인 금융재산을 조회해 계좌·기간을 안다 — 그 계좌를 그때 열었는지, 앞 자료가 빠졌는지', 준비: a.acct + ' 거래내역 ' + D10 + ' ~ ' + first, want: { 무엇: a.acct + ' 거래내역 ' + D10 + ' ~ ' + first + '(계좌를 그때 연 것이면 개설일 확인)', 왜: '10년 자료에 못 미침' } });
    if (B.D && lastD < finRvAddD_(B.D, -60) && lastBal) fl('A1', 'end:' + a.acct, { 갈래: 'A 자료 빈틈', 짚을것: a.acct + ' — 자료가 ' + lastD + '까지(잔액 ' + finRvWon_(lastBal) + '원 남음)', 날짜: lastD, 금액: lastBal, 까닭: '상속개시일까지의 자료가 없으면 그 뒤 인출을 볼 수 없다', 준비: a.acct + ' 거래내역 ' + lastD + ' ~ ' + B.D, want: { 무엇: a.acct + ' 거래내역 ' + lastD + ' ~ ' + B.D, 왜: '상속개시일까지 자료 없음' } });
  });
  (opt.notTx || []).forEach(function (c) { if (/재산|조회|회보|상속인|금융/.test(c.파일 + ' ' + c.내용)) fl('A1', 'doc:' + c.파일, { 갈래: 'A 자료 빈틈', 짚을것: '조회 결과 서류 — 계좌 목록과 맞대 보기', 날짜: '', 상대: '', 까닭: '조회된 계좌 중 거래내역을 안 받은 계좌가 있으면 과세관청만 보는 자료가 된다(자동 맞대기는 아직 — 서류를 보시고 빠진 계좌를 받을 자료에)', 준비: c.파일 }); });
  // A2·A4 — 같은 상대(상대 계좌번호, 없으면 글자)끼리 한 건으로 모은다
  var gA = {}, gKey = function (code, r) { var dg = String(r.상대계좌 || '').replace(/[^\d]/g, ''); return code + ':' + (dg.length >= 6 ? 'acct' + dg : 'txt' + (r.best ? r.best.n : '-')); };
  var gAdd = function (code, r, o) { var k = gKey(code, r), g = gA[k] || (gA[k] = { code: code, o: o, rows: [] }); g.rows.push(r); };
  R.forEach(function (r) {
    if (!r.own || !r.krw || r.inner) return;
    if (r.selfMaybe) gAdd('A2', r, { 짚을것: '계좌번호만 찍힌 큰돈 — 피상속인 다른 예금·적금인지', 까닭: '이름 없이 계좌번호로 오간 큰돈은 대개 본인 예금·적금(신규·만기) — 그 계좌가 피상속인 것이면 자료가 빠진 것이고, 아니면 받은 사람을 밝혀야 한다', 무엇: '계좌 ' + (r.상대계좌 || r.내용 || r.상대) + ' — 누구 명의인지·거래내역' });
    else if (r.self) gAdd('A2', r, { 짚을것: '피상속인 다른 계좌·상품으로 오갔는데 그 자료가 없음', 까닭: '피상속인 다른 계좌(또는 상품)가 있다는 뜻 — 그 계좌는 과세관청이 조회로 본다', 무엇: (function () { var w = ((/\d/.test(r.상대은행 || '') ? '' : (r.상대은행 || '')) + ' ' + (r.상대계좌 || '')).trim(); var t = String(r.내용 || r.상대 || r.거래구분 || r.txt || '').trim(); return '피상속인 다른 계좌·상품 거래내역 — ' + (w || (t ? '통장에 「' + t + '」로 찍힌 것(어느 계좌인지 확인)' : '받는 이·보낸 이 글자가 없는 줄(그 날짜·금액이 오간 계좌 확인)')); })() });
    else if (r.out >= T.큰돈 && /증권|투자|정기예금|적금|신탁|펀드|CMA|청약|채권|ISA/i.test(r.txt) && !/카드/.test(r.txt)) gAdd('A2', r, { 짚을것: '금융상품으로 간 돈 — 그 상품 자료 없음', 까닭: '증권·예금·보험 상품은 상속재산이거나 그 해지금이 다시 어디로 갔는지 본다', 무엇: (r.best ? r.best.raw : '') + ' 상품 내역(잔고·해지)' });
    if (r.out > 0 && /해지|만기/.test(r.txt) && r.bal === 0 && !/이자|세금|제세|세액/.test(String(r.내용 || '') + String(r.상대 || ''))) gAdd('A4', r, { 짚을것: '해지금이 간 곳이 보이지 않음', 까닭: '해지·만기 돈의 도착지를 본다', 무엇: '' });
  });
  Object.keys(gA).forEach(function (k) {
    var g = gA[k], L = g.rows, sum = L.reduce(function (s, r) { return s + r.amt; }, 0), who = L[0].best ? L[0].best.raw : (L[0].상대계좌 || '');
    if (g.code === 'A2' && sum < T.큰돈 / 10 && L.length < 3) return; // 몇만 원 한두 줄은 짚지 않음(합계 100만원·3줄 아래)
    var span = L[0].d + (L.length > 1 ? ' ~ ' + L[L.length - 1].d : '');
    fl(g.code, k.slice(g.code.length + 1), { 갈래: 'A 자료 빈틈', 짚을것: g.o.짚을것 + (L.length > 1 ? ' — ' + L.length + '줄' : ''), 날짜: span, 금액: sum, 상대: who + (L[0].상대계좌 ? ' ' + L[0].상대계좌 : ''), 까닭: g.o.까닭, 준비: g.o.무엇 || '해지금 받은 계좌', rows: L,
      want: g.o.무엇 ? { 무엇: g.o.무엇, 왜: span + ' ' + L.length + '줄 ' + finRvWon_(sum) + '원' } : null });
  });
  // 관련인 계좌 자료(A3)·사전증여(C)
  var fam = rels.filter(function (x) { return FIN_RV_FAMILY_.test(lane(x)); });
  var s13 = [];
  fam.forEach(function (x) {
    var heir = lane(x) === '상속인', yrs = heir ? 10 : 5, L = R.filter(function (r) { return r.party === x && r.own && !r.inner; });
    var inWin = L.filter(function (r) { return finRvBefore_(r, B, yrs); });
    var by = {}; L.forEach(function (r) { var y = r.d.slice(0, 4), o = by[y] || (by[y] = { 나감: 0, 들어옴: 0, 줄: 0 }); o.나감 += r.out || 0; o.들어옴 += r.in || 0; o.줄++; });
    var outW = inWin.reduce(function (s, r) { return s + (r.out || 0); }, 0), inW = inWin.reduce(function (s, r) { return s + (r.in || 0); }, 0);
    s13.push({ x: x, heir: heir, yrs: yrs, by: by, 나감: outW, 들어옴: inW, 순액: outW - inW, 줄: inWin.length, 확정: !!x.갈래, rows: L });
    if (!L.length) return;
    if (outW >= T.큰돈) fl('A3', 'rel:' + x.이름, { 갈래: 'A 자료 빈틈', 짚을것: x.이름 + '(' + lane(x) + ') 쪽 계좌 자료', 날짜: '', 금액: outW, 상대: x.이름, 까닭: '도착한 쪽(관련인 계좌)은 납세자가 내지 않지만 조사에서 볼 수 있다[확인 필요 — 조회 근거 조문]', 준비: x.이름 + ' 계좌의 받은 날 전후 내역·쓰임', want: { 무엇: x.이름 + ' 계좌 — 피상속인에게서 받은 날 전후 내역·쓰임', 왜: yrs + '년 안 ' + finRvWon_(outW) + '원 받음', 고를것: true } });
    fl('C1', 'rel:' + x.이름, { 갈래: 'C 사전증여(§13)', 짚을것: x.이름 + '(' + lane(x) + (x.갈래 ? '' : ' — 짐작') + ')에게 간 돈 — ' + yrs + '년 안', 날짜: inWin.length ? inWin[0].d + ' ~ ' + inWin[inWin.length - 1].d : '', 금액: outW, 상대: x.이름, 까닭: '나감 ' + finRvWon_(outW) + ' · 들어옴 ' + finRvWon_(inW) + ' · 순액 ' + finRvWon_(outW - inW) + '원(' + inWin.length + '줄) — 증여·대여·생활비 판단', 준비: '차용증·이자·상환 내역, 생활비라면 쓰임', rows: inWin });
    var rp = L.filter(function (r) { return r.repeat && r.out > 0; });
    if (rp.length >= 3) fl('C2', 'rel:' + x.이름, { 갈래: 'C 사전증여(§13)', 짚을것: x.이름 + '에게 매달 같은 금액', 날짜: rp[0].d + ' ~ ' + rp[rp.length - 1].d, 금액: rp.reduce(function (s, r) { return s + r.out; }, 0), 상대: x.이름, 까닭: '나눠 준 증여로 볼 수 있다 — 생활비·부양인지', 준비: '생활비·부양 사정', rows: rp });
    L.filter(function (r) { return r.in >= T.큰돈; }).forEach(function (r) { fl('C5', r.k, { 갈래: 'C 사전증여(§13)', 짚을것: x.이름 + '에게서 들어온 돈', 날짜: r.d, 금액: r.in, 상대: x.이름, 까닭: '빌려준 돈을 돌려받은 것인지, 거꾸로 준 것인지', 준비: '성격', rows: [r] }); });
    var ct = String((x.거래계약 || '') + ' ' + (x.계약글 || '')), dm = ct.match(/\d{4}[-.]\d{1,2}[-.]\d{1,2}/g) || [];
    dm.map(finRvYmd_).filter(String).forEach(function (cd) {
      var near = R.filter(function (r) { return r.own && !r.inner && r.out >= T.큰돈 && Math.abs(finRvDays_(cd, r.d)) <= 30; });
      if (near.length) fl('C4', 'rel:' + x.이름 + ':' + cd, { 갈래: 'C 사전증여(§13)', 짚을것: x.이름 + ' 거래·계약(' + cd + ') 전후 피상속인 인출', 날짜: cd, 금액: near.reduce(function (s, r) { return s + r.out; }, 0), 상대: x.이름, 까닭: '관련인 재산 취득 자금의 출처로 본다', 준비: x.이름 + ' 취득 서류·자금 출처', rows: near });
    });
  });
  bList.forEach(function (b) { if (b.나감 && b.들어옴) fl('C3', 'bundle:' + b.이름, { 갈래: 'C 사전증여(§13)', 짚을것: b.이름 + ' — 나갔다 돌아온 돈', 날짜: b.첫 + ' ~ ' + b.끝, 금액: b.순액, 상대: b.상대, 까닭: '나감 ' + finRvWon_(b.나감) + ' · 들어옴 ' + finRvWon_(b.들어옴) + ' — 남은 순액이 증여 또는 대여 채권', 준비: '대여면 차용증·이자·남은 원금(상속재산 채권)', rows: R.filter(function (r) { return r.bundle === b.이름; }) }); });
  // B 추정상속
  var two = R.filter(function (r) { return r.own && r.krw && finRvBefore_(r, B, 2); });
  two.forEach(function (r) {
    if (r.inner || !(r.out >= T.큰돈)) return;
    var n = urow(r).성격 || r.nature || '';
    if (/현금 인출|수표|용도 모름|계좌번호만/.test(n) || (!r.party && !r.best)) fl('B2', r.k, { 갈래: 'B 추정상속(§15)', 짚을것: (/계좌번호만/.test(n) ? '계좌번호만 찍힌 돈 — 본인 예금이면 그 자료로 소명' : '행방이 끊긴 돈 — ' + (n || '상대 모름')), 날짜: r.d, 금액: r.out, 상대: r.best ? r.best.raw : '', 까닭: '2년 안 인출 — 용도를 소명하지 못하면 상속재산으로 추정', 준비: '쓰임(영수증·계약서·받은 사람)', rows: [r] });
    else if (!r.party && !/세금|공과금|병원|카드|보험료|취득대금|해지|본인/.test(n)) fl('B2', r.k, { 갈래: 'B 추정상속(§15)', 짚을것: '받은 사람과의 관계 모름 — ' + r.best.raw, 날짜: r.d, 금액: r.out, 상대: r.best.raw, 까닭: '2년 안 인출 — 받은 사람이 누구인지(관련인인지) 밝히지 못하면 용도 소명이 안 된다', 준비: '받은 사람·쓰임 — 관련인 표에 넣어 주세요', rows: [r] });
  });
  if (B.D) {
    var near = R.filter(function (r) { return r.own && r.krw && !r.inner && r.out > 0 && r.d <= B.D && r.d >= finRvAddD_(B.D, -T.직전일); });
    var nearSum = near.reduce(function (s, r) { return s + r.out; }, 0);
    if (nearSum >= T.큰돈) fl('B3', 'near', { 갈래: 'B 추정상속(§15)', 짚을것: '상속개시 전 ' + T.직전일 + '일 나간 돈', 날짜: finRvAddD_(B.D, -T.직전일) + ' ~ ' + B.D, 금액: nearSum, 까닭: near.length + '줄 — 사망 직전에 몰린 인출은 집중해서 본다', 준비: '큰 줄부터 쓰임', rows: near.filter(function (r) { return r.out >= T.큰돈 / 10; }) });
    var aft = R.filter(function (r) { return r.own && r.krw && !r.inner && r.out > 0 && (r.d > B.D || (r.d === B.D && (!B.Dt || !r.t || r.t.slice(0, 5) >= B.Dt))); });
    [['day', aft.filter(function (r) { return r.d === B.D; }), '상속개시 당일 인출' + (B.Dt ? '(사망 시각 뒤·시각 없는 줄)' : '(시각 확인)')], ['after', aft.filter(function (r) { return r.d > B.D; }), '상속개시 뒤 인출']].forEach(function (p) {
      var L = p[1]; if (!L.length) return;
      fl('B3', p[0], { 갈래: 'B 추정상속(§15)', 짚을것: p[2] + ' — ' + L.length + '줄', 날짜: L[0].d + (L.length > 1 ? ' ~ ' + L[L.length - 1].d : ''), 금액: L.reduce(function (s, r) { return s + r.out; }, 0), 상대: L.slice().sort(function (a, b) { return b.out - a.out; }).slice(0, 3).map(function (r) { return r.party ? r.party.이름 : r.best ? r.best.raw : (r.nature || '상대 모름'); }).join(' · '), 까닭: '사망 뒤 인출은 예금 자체(상속재산)로 본다 — 당일은 시각으로 가름. 장례비·공과금이면 그 증빙', 준비: '거래 시각·쓰임', rows: L });
    });
  }
  // 쪼갠 현금 인출 — 며칠 안 큰돈 아래로 여러 번, 합하면 큰돈 넘음
  var cash = R.filter(function (r) { return r.own && r.krw && !r.inner && r.out > 0 && r.out < T.큰돈 && /현금 인출|수표|글자 없음/.test(urow(r).성격 || r.nature || '') && (!D10 || r.d >= D10); }).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  for (var ci = 0; ci < cash.length;) {
    var j = ci, sum = 0; while (j < cash.length && finRvDays_(cash[ci].d, cash[j].d) <= T.현금쪼갬일 - 1) { sum += cash[j].out; j++; }
    if (j - ci >= 2 && sum >= T.현금쪼갬합계) { fl('B4', cash[ci].k, { 갈래: 'B 추정상속(§15)', 짚을것: '며칠 사이 나눠 뽑은 현금 ' + (j - ci) + '번', 날짜: cash[ci].d + ' ~ ' + cash[j - 1].d, 금액: sum, 까닭: '나눠 뽑은 현금은 합계로 본다[확인 필요 — 고액현금거래 보고 기준 원문]', 준비: '합계 기준 쓰임', rows: cash.slice(ci, j) }); ci = j; } else ci++;
  }
  // C6 — 받은 사람을 알 수 없는 큰 현금·수표·글자 없는 인출(10년 — 2년 안은 B2에서 봄). 받은 사람이 상속인이면 사전증여, 아니면 쓰임 소명
  R.forEach(function (r) {
    if (!r.own || !r.krw || r.inner || r.self || !(r.out >= T.큰돈) || r.party || (D10 && r.d < D10) || finRvBefore_(r, B, 2)) return;
    var n = urow(r).성격 || r.nature || '';
    if (/현금 인출|수표|용도 모름/.test(n)) fl('C6', r.k, { 갈래: 'C 사전증여(§13)', 짚을것: '받은 사람 모를 큰 ' + (/수표/.test(n) ? '수표' : /현금/.test(n) ? '현금' : '인출'), 날짜: r.d, 금액: r.out, 상대: '', 까닭: '수표·현금은 누가 받았는지 추적된다 — 상속인(10년)·그 밖(5년)에게 갔으면 사전증여', 준비: '받은 사람·쓰임(수표면 사본·지급 내역)', rows: [r] });
  });
  // D 큰돈 출처·행방(B5 처분대금 포함)
  var bigDay = {};
  R.forEach(function (r) {
    if (!r.own || !r.krw || r.inner || r.self || !(r.in >= T.큰돈) || /이자 수입|연금/.test(urow(r).성격 || r.nature || '')) return;
    if (D10 && r.d < D10) return;
    var sale = /매각대금/.test(urow(r).성격 || r.nature || '');
    fl(sale ? 'B5' : 'D1', r.k, { 갈래: sale ? 'B 추정상속(§15)' : 'D 큰돈 출처·행방', 짚을것: sale ? '처분대금으로 보이는 돈' : '크게 들어온 돈', 날짜: r.d, 금액: r.in, 상대: r.party ? r.party.이름 : r.best ? r.best.raw : '', 까닭: sale ? '부동산·주식 처분대금은 §15 재산 종류 ②·③ 기준 — 쓰임을 본다' : '들어온 돈의 출처와, 그 돈이 간 곳', 준비: '출처 서류(계약서·보험·보증금)', rows: [r] });
    (bigDay[r.d] = bigDay[r.d] || []).push(r);
  });
  // D2 — 큰 유입(같은 날 것은 합쳐서)이 90일 안에 간 곳. 앞 유입이 이미 짚은 줄은 다시 세지 않는다
  var usedD2 = {};
  Object.keys(bigDay).sort().forEach(function (d) {
    var L = bigDay[d], inSum = L.reduce(function (s, r) { return s + r.in; }, 0); if (inSum < T.큰돈 * 5) return;
    var after = R.filter(function (z) { return z.own && z.krw && !z.inner && z.out > 0 && !usedD2[z.k] && z.d >= d && finRvDays_(d, z.d) <= 90; }).sort(function (a, b) { return b.out - a.out; });
    var take = [], acc = 0; after.forEach(function (z) { if (acc < inSum && z.out >= T.큰돈 / 10) { take.push(z); acc += z.out; usedD2[z.k] = 1; } });
    if (take.length) fl('D2', d, { 갈래: 'D 큰돈 출처·행방', 짚을것: d + ' 들어온 ' + finRvWon_(inSum) + '원 — 90일 안 나간 곳', 날짜: d + ' ~ ' + finRvAddD_(d, 90), 금액: acc, 상대: take.slice(0, 3).map(function (z) { return z.party ? z.party.이름 : z.best ? z.best.raw : (z.nature || '상대 모름'); }).join(' · '), 까닭: '큰 유입 뒤 줄어든 돈이 B·C로 이어지는 줄기', 준비: '큰 줄부터 쓰임', rows: take });
  });

  // [2026.11.25] A5 — 피상속인이 낸 보험료(보험회사별 합계). 피상속인이 보험료를 낸 보험의 보험금은 상속재산으로 본다(상증법 §8) — 과세관청은 보험 계약을 조회로 안다
  var prem = {};
  R.forEach(function (r) {
    if (!r.own || !r.krw || r.inner || !(r.out > 0) || (D10 && r.d < D10)) return;
    if (!/^보험료$/.test(urow(r).성격 || r.nature || '')) return;
    var w = r.party ? r.party.이름 : r.best ? finLnKey_(r.best.raw) || r.best.raw : '보험(상대 모름)', g = prem[w] || (prem[w] = { rows: [], sum: 0 });
    g.rows.push(r); g.sum += r.out;
  });
  Object.keys(prem).forEach(function (w) {
    var g = prem[w]; if (g.sum < T.목록기준) return;
    fl('A5', 'ins:' + w, { 갈래: 'A 자료 빈틈', 짚을것: '피상속인이 낸 보험료 — ' + w + ' ' + g.rows.length + '회', 날짜: g.rows[0].d + ' ~ ' + g.rows[g.rows.length - 1].d, 금액: g.sum, 상대: w, 까닭: '피상속인이 보험료를 낸 보험의 보험금은 상속재산으로 본다(상증법 §8) — 계약자·피보험자·수익자·해지환급금은 과세관청이 조회로 안다', 준비: w + ' 보험계약 내역', rows: g.rows, want: { 무엇: w + ' 보험계약 내역(계약자·피보험자·수익자·해지환급금·보험금 지급)', 왜: '피상속인이 보험료 ' + finRvWon_(g.sum) + '원(' + g.rows.length + '회) 냄' } });
  });
  // [2026.11.25] B6 — 상속개시 전 부담한 채무(상증법 §15① 2호: 1년 안 2억원·2년 안 5억원 넘게 부담한 채무의 용도가 명백하지 않으면 상속 추정)
  var s15d = !B.D ? [] : [1, 2].map(function (y) {
    var L = R.filter(function (r) { return r.own && r.krw && !r.inner && r.in > 0 && finRvBefore_(r, B, y) && /대출받은 돈|^차입$/.test(urow(r).성격 || r.nature || ''); });
    var sum = L.reduce(function (s, r) { return s + r.in; }, 0), 기준 = y === 1 ? 200000000 : 500000000;
    if (sum >= 기준) fl('B6', 'debt' + y, { 갈래: 'B 추정상속(§15)', 짚을것: y + '년 안 부담한 채무(대출로 들어온 돈)가 기준(' + finRvWon_(기준) + '원) 넘음', 날짜: finRvAddY_(B.D, -y) + ' ~ ' + B.D, 금액: sum, 까닭: '상증법 §15① 2호 — 부담한 채무의 용도를 소명하지 못하면 상속받은 것으로 추정(통장에 대출로 찍힌 돈만 셈 — 개인에게 빌린 돈은 세무사님 성격 「차입」 ✎)', 준비: '대출 계약서·쓰임', rows: L });
    return { y: y, 채무: sum, 기준: 기준, 넘음: sum >= 기준, 줄: L.length };
  });

  // ⑩ §15 추정상속 셈(1년·2년)
  var s15 = [1, 2].map(function (y) {
    var W = R.filter(function (r) { return r.own && r.krw && finRvBefore_(r, B, y); });
    var 인출 = W.reduce(function (s, r) { return s + (r.out || 0); }, 0), 재예입 = W.filter(function (r) { return r.inner && r.in > 0; }).reduce(function (s, r) { return s + r.in; }, 0);
    // 소명액 = 세무사님 칸 합계. 세무사님이 「안에서 옮김」으로 정하신 줄인데 짝 자료가 없는 것(본인 다른 예금 등)은 소명액을 안 적으셨으면 그 금액을 소명으로 셈
    var 순 = 인출 - 재예입, 소명 = W.filter(function (r) { return r.out > 0; }).reduce(function (s, r) { var v = finRvNum_(urow(r).소명액); if (v == null && r.inner && !r.pair) v = r.out; return s + (v || 0); }, 0);
    var 참고 = W.filter(function (r) { return !r.inner && r.out > 0 && /세금|공과금|병원|카드|보험료/.test(urow(r).성격 || r.nature || ''); }).reduce(function (s, r) { return s + r.out; }, 0);
    var 기준 = y === 1 ? 200000000 : 500000000, 미소명 = Math.max(0, 순 - 소명), 차감 = Math.min(순 * 0.2, 200000000);
    return { y: y, 인출: 인출, 재예입: 재예입, 순: 순, 기준: 기준, 넘음: 순 >= 기준, 소명: 소명, 참고: 참고, 미소명: 미소명, 차감: Math.round(차감), 추정: 순 >= 기준 && 미소명 >= 차감 ? Math.round(미소명 - 차감) : 0, 줄: W.length };
  });
  if (B.D) s15.forEach(function (s) { if (s.넘음) fl('B1', 'y' + s.y, { 갈래: 'B 추정상속(§15)', 짚을것: s.y + '년 안 순인출이 기준(' + finRvWon_(s.기준) + '원) 넘음', 날짜: finRvAddY_(B.D, -s.y) + ' ~ ' + B.D, 금액: s.순, 까닭: '미소명 ' + finRvWon_(s.미소명) + ' − 차감 ' + finRvWon_(s.차감) + ' = 추정 ' + finRvWon_(s.추정) + '원(소명액은 세무사님 칸 합계)', 준비: '「추정상속(§15)」 탭 줄별 쓰임' }); });

  // ⑪ 흐름(해마다·달마다)
  var flowBy = function (keyOf) {
    var o = {}, keys = [];
    order.forEach(function (ix) {
      var r = R[ix]; if (!r.own || !r.krw) return; var k = keyOf(r), f = o[k];
      if (!f) { f = o[k] = { k: k, 시작: r.total != null ? r.total - ((r.in || 0) - (r.out || 0)) - (r.start || 0) : null, 끝: null, 들어옴: {}, 나감: {}, 안: 0, 자료시작: 0, 끊김: 0 }; keys.push(k); }
      if (r.start) f.자료시작 += r.start;
      if (r.gap) f.끊김 += r.gap;
      if (r.inner) f.안 += r.out || 0;
      else if (r.lane) { var side = r.in > 0 ? f.들어옴 : f.나감; side[r.lane] = (side[r.lane] || 0) + r.amt; }
      f.끝 = r.total;
    });
    return keys.map(function (k) { return o[k]; });
  };
  var years = flowBy(function (r) { return r.d.slice(0, 4); }), months = flowBy(function (r) { return r.d.slice(0, 7); });

  // 관련인 통계
  rels.forEach(function (x) { var L = R.filter(function (r) { return r.party === x; }); x._n = L.length; x._in = L.reduce(function (s, r) { return s + (r.in || 0); }, 0); x._out = L.reduce(function (s, r) { return s + (r.out || 0); }, 0); x._first = L.length ? L.reduce(function (m, r) { return r.d < m ? r.d : m; }, L[0].d) : ''; x._last = L.length ? L.reduce(function (m, r) { return r.d > m ? r.d : m; }, L[0].d) : ''; });
  // [2026.11.25] ② 증감분석 — 구간(상속개시일 기준)·분기·크게 줄어든 구간(D3)
  var quarters = flowBy(function (r) { return r.d.slice(0, 4) + '-' + (Math.floor((Number(r.d.slice(5, 7)) - 1) / 3) + 1) + '분기'; });
  var segs = B.D ? flowBy(function (r) { return FIN_TG_SEG_[r.period] || r.period || '?'; }) : [];
  var drops = finTgDrops_(R, order, T);
  drops.forEach(function (d) { if (d.설명필요 + d.관련인으로 >= T.큰돈) fl('D3', d.시작, { 갈래: 'D 큰돈 출처·행방', 짚을것: '예금이 크게 줄어든 구간 — ' + finRvWon_(d.줄어듦) + '원(' + d.날수 + '일)', 날짜: d.시작 + ' ~ ' + d.끝, 금액: d.설명필요 + d.관련인으로, 상대: d.큰상대.slice(0, 3).join(' · '), 까닭: '쓰임 안 보이는 유출 ' + finRvWon_(d.설명필요) + '원 · 관련인으로 ' + finRvWon_(d.관련인으로) + '원 — 과세관청은 예금 잔액이 크게 줄어든 때부터 본다', 준비: '그 구간 큰 줄의 쓰임·받은 사람', rows: d.rows }); });
  // ③ 분석대상자(네 갈래)·C7
  var targets = finTgTargets_(R, rels, B, T, lane, fl, function () { return flags; });
  // 짚을 곳 중요도(금액 × 배운 성적)
  flags.forEach(function (f) { var r0 = (f.rows || [])[0]; f.성격열쇠 = r0 ? (r0.nature || '') : ''; var sc = finLnScore_(f, opt.learn); f.중요도 = sc.점수; f.배움 = sc.배움; if (sc.배움) learnUsed.flags++; });
  var order2 = { A: 0, B: 1, C: 2, D: 3 };
  flags.sort(function (a, b) { return order2[a.번호.charAt(0)] - order2[b.번호.charAt(0)] || (b.중요도 || 0) - (a.중요도 || 0) || a.번호.localeCompare(b.번호); });
  return { B: B, R: R, order: order, accts: acctList, rels: rels, bundles: bList, flags: flags, s15: s15, s13: s13, years: years, months: months, starts: starts, breaks: breaks, learned: learned, newCand: newCand,
    change: { segs: segs, quarters: quarters, drops: drops }, targets: targets, learnUsed: learnUsed, byContract: byContract, s15d: s15d };
}

// ---------- 보관 파일 ----------
function finRvLoad_(folder) {
  var it = folder.getFilesByName(FIN_RV_FILE_), U = null, f = null;
  if (it.hasNext()) { f = it.next(); try { U = JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { U = null; } }
  U = U || {}; ['rows', 'bundles', 'flags', 'base', 'excel', 'wants'].forEach(function (k) { if (!U[k] || typeof U[k] !== 'object' || Array.isArray(U[k])) U[k] = {}; }); if (!Array.isArray(U.rel)) U.rel = [];
  return { f: f, U: U };
}
function finRvSave_(folder, S) { var t = JSON.stringify(S.U); if (S.f) S.f.setContent(t); else S.f = folder.createFile(FIN_RV_FILE_, t, 'application/json'); }

// ---------- 시트에서 세무사님 칸 거두기 ----------
function finRvHdrIdx_(hdr) { var o = {}; hdr.forEach(function (h, i) { h = String(h || '').trim(); if (h && o[h] === undefined) o[h] = i; }); return o; }
function finRvRowKey_(row, I) {
  var g = function (h) { var i = I[h]; return i === undefined ? '' : row[i]; };
  return [g('계좌'), g('거래일자'), g('거래시간'), finRvNum_(g('입금')) || '', finRvNum_(g('출금')) || '', finRvNum_(g('잔액')) == null ? '' : finRvNum_(g('잔액'))].join('|');
}
// 같은 열쇠가 여럿(같은 시각·같은 금액·같은 잔액)이면 #2, #3 …
function finRvKeys_(list) { var seen = {}; return list.map(function (k) { seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? k + '#' + seen[k] : k; }); }
function finRvHarvest_(ss, U) {
  var changed = false, put = function (o, k, v) { v = v == null ? '' : String(v).trim(); if ((o[k] || '') !== v) { if (v) o[k] = v; else delete o[k]; changed = true; } };
  var sh = ss.getSheetByName('거래');
  if (sh && sh.getLastRow() > 1) {
    var V = sh.getDataRange().getValues(), I = finRvHdrIdx_(V[0]);
    var have = FIN_RV_USER_COLS_.concat([FIN_RV_NEX_COL_]).filter(function (h) { return I[h] !== undefined; });
    if (have.length) {
      var keys = I[FIN_RV_KEY_COL_] !== undefined ? V.slice(1).map(function (r) { return String(r[I[FIN_RV_KEY_COL_]] || ''); }) : finRvKeys_(V.slice(1).map(function (r) { return finRvRowKey_(r, I); }));
      V.slice(1).forEach(function (r, n) {
        var k = keys[n]; if (!k) return; var o = U.rows[k] || {}, before = JSON.stringify(o);
        have.forEach(function (h) {
          var f = h === FIN_RV_NEX_COL_ ? '넥스' : FIN_RV_USER_KEY_[h], v = r[I[h]];
          if (f === '소명액') v = finRvNum_(v) == null ? String(v || '').trim() : String(finRvNum_(v));
          // 엑셀에서 옮겨 넣은 값이 그대로면 세무사님이 고치신 것이 아님(엑셀이 바뀌면 따라 바뀜)
          if (o._x && o._x[f] !== undefined && String(v == null ? '' : v).trim() === o._x[f]) return;
          v = String(v == null ? '' : v).trim(); if (v) o[f] = v; else delete o[f];
          if (o._x && o._x[f] !== undefined) delete o._x[f];
        });
        if (JSON.stringify(o) !== before) { changed = true; if (Object.keys(o).filter(function (x) { return x !== '_x'; }).length || (o._x && Object.keys(o._x).length)) U.rows[k] = o; else delete U.rows[k]; }
      });
    }
  }
  var rel = ss.getSheetByName('분석대상자') || ss.getSheetByName('관련인');
  if (rel && rel.getLastRow() > 1) {
    var RV = rel.getDataRange().getValues(), RI = finRvHdrIdx_(RV[0]), cur = {};
    U.rel.forEach(function (x) { cur[finRvNorm_(x.이름)] = x; });
    var g = function (r, h) { return RI[h] === undefined ? undefined : String(r[RI[h]] == null ? '' : r[RI[h]]).trim(); };
    var keep = [];
    RV.slice(1).forEach(function (r) {
      var name = g(r, '이름·상호 ✎'); if (!name) return;
      var x = cur[finRvNorm_(name)] || { 이름: name, 별칭: [], 계좌: [], 출처: '세무사님이 표에 더하심' };
      var set = function (k, v) { if (v === undefined) return; if (JSON.stringify(x[k] == null ? '' : x[k]) !== JSON.stringify(v)) { x[k] = v; changed = true; } };
      set('이름', name); set('갈래', g(r, '갈래 ✎')); set('상속인', g(r, '상속인인가 ✎')); set('관계', g(r, '관계 ✎'));
      var al = g(r, '통장에 찍히는 글자 ✎'); if (al !== undefined) set('별칭', al ? al.split(/\s*[·,]\s*/).filter(String) : []);
      var ac = g(r, '계좌번호 ✎'); if (ac !== undefined) set('계좌', ac ? ac.split(/\s*[·,]\s*/).filter(String) : []);
      var ct = g(r, '관련 거래·계약 ✎'); if (ct !== undefined && x.계약글 && ct === x.계약글) ct = x.거래계약 || ''; // 계약서에서 GAS가 보인 글 그대로면 세무사님 값 아님
      set('사업자번호', g(r, '사업자번호 ✎')); set('거래계약', ct);
      if (x.갈래 && /후보|골라/.test(String(x.상태 || ''))) x.상태 = '확정';
      if (!cur[finRvNorm_(name)]) changed = true;
      keep.push(x); cur[finRvNorm_(name)] = null;
    });
    // 표에서 지우신 줄은 보관에서도 뺀다(GAS 후보는 다음 셈에 다시 생길 수 있음) — 지난번 시트에 안 보였던 새 줄(가족 지도·계약서에서 방금 더한 것)은 남김
    var shown = {}; (U.relShown || []).forEach(function (n) { shown[finRvNorm_(n)] = 1; });
    U.rel.forEach(function (x) { var n = finRvNorm_(x.이름); if (cur[n] && !shown[n]) keep.push(x); });
    if (keep.length !== U.rel.length) changed = true;
    U.rel = keep;
  }
  var bt = ss.getSheetByName('묶음');
  if (bt && bt.getLastRow() > 1) {
    var BV = bt.getDataRange().getValues(), BI = finRvHdrIdx_(BV[0]);
    BV.slice(1).forEach(function (r) { var n = String(r[BI['묶음 이름']] || '').trim(); if (!n) return; var o = U.bundles[n] || {}; put(o, '판단', r[BI['판단 ✎']]); put(o, '메모', r[BI['메모 ✎']]); if (Object.keys(o).length) U.bundles[n] = o; else delete U.bundles[n]; });
  }
  var ft = ss.getSheetByName('짚을 곳');
  if (ft && ft.getLastRow() > 1) {
    var FV = ft.getDataRange().getValues(), FI = finRvHdrIdx_(FV[0]);
    FV.slice(1).forEach(function (r) { var id = String(r[FI['열쇠']] || '').trim(); if (!id) return; var o = U.flags[id] || {}; put(o, '상태', r[FI['상태 ✎']]); put(o, '메모', r[FI['메모 ✎']]); if (Object.keys(o).length) U.flags[id] = o; else delete U.flags[id]; });
  }
  var wt = ss.getSheetByName('받을 자료');
  if (wt && wt.getLastRow() > 1) {
    var WV = wt.getDataRange().getValues(), WI = finRvHdrIdx_(WV[0]);
    WV.slice(1).forEach(function (r) { var id = String(r[WI['열쇠']] || '').trim(); if (!id) return; var o = U.wants[id] || {}; put(o, '요청', r[WI['요청 ✎']]); put(o, '메모', r[WI['메모 ✎']]); if (Object.keys(o).length) U.wants[id] = o; else delete U.wants[id]; });
  }
  var base = ss.getSheetByName('사건 기준');
  if (base && base.getLastRow() > 1) {
    var CV = base.getDataRange().getValues(), CI = finRvHdrIdx_(CV[0]);
    CV.slice(1).forEach(function (r) { var k = String(r[CI['열쇠']] || '').trim(); if (!k) return; var v = r[CI['값 ✎']]; if (v instanceof Date) v = Utilities.formatDate(v, 'Asia/Seoul', k === '상속개시시각' ? 'HH:mm' : 'yyyy-MM-dd'); put(U.base, k, v); });
  }
  var xt = ss.getSheetByName('엑셀 판단 가져오기');
  if (xt && xt.getLastRow() > 1) {
    var XV = xt.getDataRange().getValues(), XI = finRvHdrIdx_(XV[0]);
    XV.slice(1).forEach(function (r) { var id = String(r[XI['열쇠']] || '').trim(); if (!id) return; var p = id.split('|'), e = U.excel[p[0]]; if (!e) return; e.mean = e.mean || {}; var v = String(r[XI['뜻 ✎']] || '').trim(); if ((e.mean[p.slice(1).join('|')] || '') !== v) { if (v) e.mean[p.slice(1).join('|')] = v; else delete e.mean[p.slice(1).join('|')]; changed = true; } });
  }
  return changed;
}

// ---------- 시트의 거래 줄 읽기 ----------
function finRvRead_(ss) {
  var sh = ss.getSheetByName('거래'); if (!sh || sh.getLastRow() < 2) return null;
  var V = sh.getDataRange().getValues(), I = finRvHdrIdx_(V[0]);
  var g = function (r, h) { var i = I[h]; return i === undefined ? '' : r[i]; };
  var keys = finRvKeys_(V.slice(1).map(function (r) { return finRvRowKey_(r, I); }));
  var R = V.slice(1).map(function (r, n) {
    var acct = String(g(r, '계좌') || ''), d = finRvYmd_(g(r, '거래일자') instanceof Date ? Utilities.formatDate(g(r, '거래일자'), 'Asia/Seoul', 'yyyy-MM-dd') : g(r, '거래일자'));
    return { i: n, k: keys[n], d: d, t: String(g(r, '거래시간') || ''), acct: String(g(r, '기관') || '') + ' ' + acct, dg: acct, org: String(g(r, '기관') || ''), holder: String(g(r, '예금주') || ''),
      in: finRvNum_(g(r, '입금')) || 0, out: finRvNum_(g(r, '출금')) || 0, bal: finRvNum_(g(r, '잔액')), cur: String(g(r, '통화') || '원'),
      내용: String(g(r, '내용') || ''), 상대: String(g(r, '상대') || ''), 상대은행: String(g(r, '상대은행') || ''), 상대계좌: String(g(r, '상대계좌') || ''), 구분: String(g(r, '거래구분') || ''), 메모: String(g(r, '메모') || ''), 검산: String(g(r, '검산') || '') };
  }).filter(function (r) { return r.d; });
  return { sh: sh, V: V, I: I, R: R };
}

// ---------- 시트 쓰기 ----------
function finRvTab_(ss, title, hdr, data, o) {
  o = o || {};
  var sh = ss.getSheetByName(title);
  if (sh) { sh.clear(); try { sh.getDataRange().clearDataValidations(); } catch (e) {} }
  else {
    var ref = ss.getSheetByName('거래'), at = ref ? ref.getIndex() : ss.getSheets().length;
    var before = FIN_RV_TABS_.slice(0, FIN_RV_TABS_.indexOf(title)).filter(function (t) { return ss.getSheetByName(t); }).map(function (t) { return ss.getSheetByName(t).getIndex(); });
    sh = ss.insertSheet(title, Math.max.apply(null, [at].concat(before)));
  }
  var w = hdr.length, vals = [hdr].concat(data.length ? data : [hdr.map(function () { return ''; })]);
  vals = vals.map(function (r) { r = r.slice(0, w); while (r.length < w) r.push(''); return r.map(function (v) { return v == null ? '' : v; }); });
  (o.text || []).forEach(function (ci) { sh.getRange(1, ci + 1, vals.length, 1).setNumberFormat('@'); });
  for (var s = 0; s < vals.length; s += 4000) sh.getRange(s + 1, 1, Math.min(4000, vals.length - s), w).setValues(vals.slice(s, s + 4000));
  (o.money || []).forEach(function (ci) { sh.getRange(2, ci + 1, Math.max(1, vals.length - 1), 1).setNumberFormat('#,##0'); });
  sh.getRange(1, 1, 1, w).setFontWeight('bold').setBackground('#eef2f7');
  hdr.forEach(function (h, i) { if (/✎$/.test(h)) { sh.getRange(1, i + 1).setBackground('#ffe8a3'); sh.getRange(2, i + 1, Math.max(1, vals.length - 1), 1).setBackground('#fffbea'); } });
  (o.lists || []).forEach(function (L) { var rule = SpreadsheetApp.newDataValidation().requireValueInList(L.list, true).setAllowInvalid(true).build(); sh.getRange(2, L.col + 1, Math.max(1, vals.length - 1) + 200, 1).setDataValidation(rule); });
  if (o.note) sh.getRange(1, 1).setNote(o.note);
  sh.setFrozenRows(1);
  return sh;
}
function finRvWrite_(ss, A, U, ctx) {
  var X = ctx.X, sh = X.sh, I = X.I, nRow = X.V.length - 1;
  // 읽은 뒤 세무사님이 줄 차례를 바꾸셨으면(정렬) 칸이 어긋나므로 쓰지 않고 다음 번에 다시
  if (sh.getLastRow() - 1 !== nRow) return { moved: true };
  var cols = ['계좌', '거래일자', '거래시간', '입금', '출금', '잔액'].map(function (h) { return I[h]; });
  if (cols.every(function (c) { return c !== undefined; }) && nRow) {
    var lo = Math.min.apply(null, cols), hi = Math.max.apply(null, cols), now = sh.getRange(2, lo + 1, nRow, hi - lo + 1).getValues();
    var I2 = {}; ['계좌', '거래일자', '거래시간', '입금', '출금', '잔액'].forEach(function (h) { I2[h] = I[h] - lo; });
    var k2 = finRvKeys_(now.map(function (r) { return finRvRowKey_(r, I2); })), k1 = finRvKeys_(X.V.slice(1).map(function (r) { return finRvRowKey_(r, I); }));
    for (var z = 0; z < nRow; z++) if (k1[z] !== k2[z]) return { moved: true };
  }
  // 거래 탭 — 2단계 칸이 없으면 오른쪽 끝에 머리를 더한다(세무사님이 옮기셨으면 그 자리 그대로)
  var hdr = X.V[0].slice(), add = FIN_RV_GAS_COLS_.concat(FIN_RV_USER_COLS_, [FIN_RV_NEX_COL_, FIN_RV_KEY_COL_]).filter(function (h) { return I[h] === undefined; });
  if (add.length) { sh.getRange(1, hdr.length + 1, 1, add.length).setValues([add]); add.forEach(function (h) { I[h] = hdr.length; hdr.push(h); }); }
  if (sh.getMaxColumns() < hdr.length) sh.insertColumnsAfter(sh.getMaxColumns(), hdr.length - sh.getMaxColumns());
  var lane = function (x) { return x ? (x.갈래 || x.짐작 || '') : ''; };
  var byI = {}; A.R.forEach(function (r) { byI[r.i] = r; });
  var gasVals = [], keyVals = [];
  for (var n = 0; n < nRow; n++) {
    var r = byI[n];
    if (!r) { gasVals.push(FIN_RV_GAS_COLS_.map(function () { return ''; })); keyVals.push(['']); continue; }
    var u = U.rows[r.k] || {};
    gasVals.push([r.total == null ? '' : r.total, r.period || '', r.flow || '', r.m ? r.m.x.이름 + (lane(r.m.x) ? '(' + lane(r.m.x) + ')' : '') + (r.m.sure < 3 ? ' — 후보' : '') : '', r.pair ? '짝: ' + r.pair.acct + ' ' + r.pair.d + (r.pair.t ? ' ' + r.pair.t : '') + ' (' + r.pairWhy + ')' : r.innerTo ? r.pairWhy : r.m ? r.m.how : '',
      r.nature || '', r.bundleGas || '', (r.flags || []).join(' ')]);
    keyVals.push([r.k]);
  }
  // GAS 칸은 붙어 있으면 한 번에, 아니면 칸마다
  var gi = FIN_RV_GAS_COLS_.map(function (h) { return I[h]; }), contig = gi.every(function (c, j) { return j === 0 || c === gi[j - 1] + 1; });
  if (nRow) {
    if (contig) for (var s = 0; s < nRow; s += 4000) sh.getRange(s + 2, gi[0] + 1, Math.min(4000, nRow - s), gi.length).setValues(gasVals.slice(s, s + 4000));
    else gi.forEach(function (c, j) { sh.getRange(2, c + 1, nRow, 1).setValues(gasVals.map(function (v) { return [v[j]]; })); });
    sh.getRange(2, I[FIN_RV_KEY_COL_] + 1, nRow, 1).setNumberFormat('@').setValues(keyVals);
    sh.getRange(2, I['전체 잔액'] + 1, nRow, 1).setNumberFormat('#,##0');
    // 세무사님 칸 — 보관된 값(1단계가 다시 써 칸이 비었으면 되살림) · 빈 칸엔 엑셀에서 옮긴 판단.
    //  읽은 뒤 세무사님이 그새 고치신 칸(읽을 때 값과 지금 값이 다름)은 그대로 두고 보관에 담는다.
    FIN_RV_USER_COLS_.concat([FIN_RV_NEX_COL_]).forEach(function (h) {
      var f = h === FIN_RV_NEX_COL_ ? '넥스' : FIN_RV_USER_KEY_[h], c = I[h], cur = sh.getRange(2, c + 1, nRow, 1).getValues(), dirty = false;
      var readC = X.I[h];
      for (var q = 0; q < nRow; q++) {
        var r2 = byI[q]; if (!r2) continue;
        var now = String(cur[q][0] == null ? '' : cur[q][0]).trim(), seen = readC === undefined ? '' : String(X.V[q + 1][readC] == null ? '' : X.V[q + 1][readC]).trim();
        var o = U.rows[r2.k] || {};
        if (readC !== undefined && now !== seen) { if (now) o[f] = now; else delete o[f]; U.rows[r2.k] = o; continue; }
        var want = o[f] || (o._x && o._x[f]) || '';
        if (String(want) !== now) { cur[q][0] = f === '소명액' && finRvNum_(want) != null ? finRvNum_(want) : want; dirty = true; }
      }
      if (dirty) sh.getRange(2, c + 1, nRow, 1).setValues(cur);
    });
  }
  // 머리·바탕색·고르기 목록(처음 한 번이면 충분하지만 1단계가 다시 쓰면 새로)
  FIN_RV_GAS_COLS_.concat([FIN_RV_KEY_COL_]).forEach(function (h) { sh.getRange(1, I[h] + 1).setBackground('#dfe8f5').setFontWeight('bold'); });
  FIN_RV_USER_COLS_.forEach(function (h) { sh.getRange(1, I[h] + 1).setBackground('#ffe8a3').setFontWeight('bold'); if (nRow) sh.getRange(2, I[h] + 1, nRow, 1).setBackground('#fffbea'); });
  sh.getRange(1, I[FIN_RV_NEX_COL_] + 1).setBackground('#e8f5e9').setFontWeight('bold');
  sh.getRange(1, I['전체 잔액'] + 1).setNote('피상속인 원화 계좌 잔액의 합(그 순간 계좌마다 마지막 잔액). 본인 계좌끼리 옮긴 돈은 그대로 — 바깥과 오간 돈만 전체 잔액을 바꾼다.');
  sh.getRange(1, I['상대 ✎'] + 1).setNote('세무사님 칸(✎) — 적으시면 GAS 후보를 덮습니다. 「분석대상자」 탭의 이름을 고르거나 새 이름을 적으시면 관련인 표에 생깁니다. GAS는 이 칸을 덮어쓰지 않습니다.');
  if (nRow) {
    var vr = function (list) { return SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(true).build(); };
    sh.getRange(2, I['성격 ✎'] + 1, nRow, 1).setDataValidation(vr(FIN_RV_NATURES_));
    var names = A.rels.map(function (x) { return x.이름; }).filter(String).slice(0, 480);
    if (names.length) sh.getRange(2, I['상대 ✎'] + 1, nRow, 1).setDataValidation(vr(names));
  }

  // 짚을 곳
  var F = A.flags;
  finRvTab_(ss, '짚을 곳', ['갈래', '번호', '짚을 것', '날짜', '금액', '상대', '까닭(과세관청이 보는 점)', '준비할 것', '줄 수', '상태 ✎', '메모 ✎', '열쇠', '중요도', '배움'],
    F.map(function (f) { return [f.갈래, f.번호, f.짚을것, f.날짜 || '', f.금액 == null ? '' : f.금액, f.상대 || '', f.까닭 || '', f.준비 || '', (f.rows || []).length || '', f.상태 || '', f.메모 || '', f.id, f.중요도 || '', f.배움 || '']; }),
    { text: [3, 11], money: [4], lists: [{ col: 9, list: FIN_RV_STATE_ }], note: '과세관청이 이 사건에서 짚을 곳을 먼저 추린 목록(GAS, 0원). 상태·메모(✎)는 세무사님 칸 — 다시 셈해도 남습니다. 거래 탭 「짚임」 칸에 같은 번호가 붙습니다.' });

  // 추정상속(§15)
  var B = A.B, s15rows = [];
  if (!B.D) s15rows.push(['상속개시일이 없음 — 「사건 기준」 탭에 적어 주시면 셈합니다', '', '']);
  A.s15.forEach(function (s) {
    s15rows.push([s.y + '년 안(' + (B.D ? finRvAddY_(B.D, -s.y) + ' ~ ' + B.D : '') + ')', '', '']);
    s15rows.push(['① 인출 합계(피상속인 원화 계좌 출금 전체)', s.인출, s.줄 + '줄']);
    s15rows.push(['② 같은 기간 다시 예입된 돈 — 피상속인 다른 계좌에서 옮겨 온 것(안에서 옮김)', s.재예입, '시행령 §11①2호: 그 통장에서 인출한 돈이 다시 들어온 것만 뺌']);
    s15rows.push(['③ 순인출 ① − ②', s.순, '']);
    s15rows.push(['④ 기준 ' + finRvWon_(s.기준) + '원 넘었나', s.넘음 ? '넘음' : '안 넘음', '상증법 §15① 1호 — 현금·예금·유가증권 종류']);
    s15rows.push(['⑤ 소명액(세무사님 칸 합계)', s.소명, '참고: 성격 후보가 세금·공과금·병원·카드·보험료인 출금 ' + finRvWon_(s.참고) + '원(증빙을 붙이시면 소명 후보)']);
    s15rows.push(['⑥ 미소명액 ③ − ⑤', s.미소명, '']);
    s15rows.push(['⑦ 차감가액 min(③ × 20%, 2억원)', s.차감, '시행령 §11④']);
    s15rows.push(['⑧ 추정액(⑥ ≥ ⑦ 이면 ⑥ − ⑦)', s.추정, s.넘음 ? '' : '기준을 넘지 않아 추정 대상 아님']);
    s15rows.push(['', '', '']);
  });
  (A.s15d || []).forEach(function (d) { s15rows.push(['부담한 채무(§15① 2호) ' + d.y + '년 안 — 통장에 대출로 들어온 돈', d.채무, (d.넘음 ? '기준 ' + finRvWon_(d.기준) + '원 넘음 — 짚을 곳 B6' : '기준 ' + finRvWon_(d.기준) + '원 안 넘음') + ' · ' + d.줄 + '줄(개인에게 빌린 돈은 거래 탭 성격 「차입」 ✎)']); });
  s15rows.push(['1년·2년 둘 다 기준을 넘으면 둘 다 보이고 계산기에는 큰 쪽 — [확인 필요 — 집행기준, 지침 8절]', '', '']);
  s15rows.push(['부동산·그 밖 재산(종류 ②·③)의 처분은 통장 입금만으로 정하지 않음 — 처분 서류로', '', '']);
  s15rows.push(['', '', '']);
  s15rows.push(['줄별(부표4(을) 초안) — 2년 안 바깥으로 나간 돈 ' + finRvWon_(B.T.목록기준) + '원 이상, 큰 순', '', '']);
  var list = A.R.filter(function (r) { return r.own && r.krw && !r.inner && r.out > 0 && finRvBefore_(r, B, 2); }).sort(function (a, b) { return b.out - a.out; });
  var big = list.filter(function (r) { return r.out >= B.T.목록기준; }), small = list.filter(function (r) { return r.out < B.T.목록기준; });
  var t15 = s15rows.concat([['날짜 · 계좌 · 상대 · 성격 · 기간', '금액', '소명액(세무사님 칸) · 메모']]).concat(big.map(function (r) { var u = U.rows[r.k] || {}; return [[r.d, r.acct, r.party ? r.party.이름 : r.best ? r.best.raw : '', u.성격 || r.nature || '', r.period].filter(String).join(' · '), r.out, [u.소명액 ? finRvWon_(finRvNum_(u.소명액) || 0) + '원' : '', u.메모 || ''].filter(String).join(' · ')]; }));
  if (small.length) t15.push(['그 밖 ' + small.length + '줄(' + finRvWon_(B.T.목록기준) + '원 아래)', small.reduce(function (s, r) { return s + r.out; }, 0), '']);
  finRvTab_(ss, '추정상속(§15)', ['항목', '금액', '설명'], t15, { money: [1], note: '근거 지침: 상속_추정상속재산_처분인출.md · 계좌거래내역_분석.md 5절. 소명 여부는 세무사님 판단(거래 탭 소명액 ✎).' });

  // 사전증여(§13)
  var t13 = [];
  if (!A.s13.length) t13.push(['분석대상자에 상속인·가족·특수관계 법인이 아직 없음 — 「분석대상자」 탭에서 갈래를 골라 주시면 셈합니다', '', '', '', '', '', '', '']);
  A.s13.forEach(function (s) {
    t13.push([s.x.이름, lane(s.x) + (s.확정 ? '' : '(짐작)'), s.yrs + '년', '합산 기간 안 합계', s.나감, s.들어옴, s.순액, s.줄]);
    Object.keys(s.by).sort().forEach(function (y) { var o = s.by[y]; t13.push(['', '', '', y + '년', o.나감, o.들어옴, o.나감 - o.들어옴, o.줄]); });
    A.bundles.filter(function (b) { return b.상대 === s.x.이름; }).forEach(function (b) { t13.push(['', '', '', '묶음: ' + b.이름 + (b.판단 ? ' — ' + b.판단 : ' — 판단 전'), b.나감, b.들어옴, b.순액, b.줄]); });
  });
  finRvTab_(ss, '사전증여(§13)', ['관련인', '갈래', '합산 기간', '해·묶음', '나감', '들어옴', '순액(나감−들어옴)', '줄'], t13, { money: [4, 5, 6], text: [3], note: '상증법 §13① — 상속인 10년·그 밖 5년(신고 여부 무관). 증여·대여·생활비 판단은 세무사님(묶음 탭 판단 ✎). 지침: 상속_사전증여재산_합산.md · 계좌거래내역_분석.md 6절.' });

  // [2026.11.25] 증감분석·분석대상자·대상자별 거래(옛 「흐름」·「관련인」을 바꿈 — FinTarget.js)
  finTgWrite_(ss, A, U);

  // 묶음
  finRvTab_(ss, '묶음', ['묶음 이름', '상대', '나감', '들어옴', '순액(나감−들어옴)', '첫 날', '끝 날', '줄', '출처', '판단 ✎', '메모 ✎'],
    A.bundles.map(function (b) { return [b.이름, b.상대, b.나감, b.들어옴, b.순액, b.첫, b.끝, b.줄, b.세무사님 ? '세무사님 칸' : 'GAS 후보(같은 상대와 오간 돈)', b.판단, b.메모]; }),
    { text: [5, 6], money: [2, 3, 4], lists: [{ col: 9, list: FIN_RV_JUDGE_ }], note: '같은 일에서 나온 줄을 한 건으로. 거래 탭 「묶음 ✎」에 이름을 적으시면 그 묶음이 생깁니다. 짚을 대상은 순액입니다.' });

  // 받을 자료
  var W = []; F.forEach(function (f) { if (f.want) W.push({ id: f.id, f: f }); });
  finRvTab_(ss, '받을 자료', ['무엇', '왜', '짚을 곳', '요청 ✎', '메모 ✎', '열쇠'],
    W.map(function (w) { var s = U.wants[w.id] || {}; return [w.f.want.무엇, w.f.want.왜 + (w.f.want.고를것 && !s.요청 ? ' — 요청할지 골라 주세요' : ''), w.f.번호, s.요청 || '', s.메모 || '', w.id]; }),
    { text: [5], lists: [{ col: 3, list: ['요청함', '요청 안 함', '받음'] }], note: '납세자가 내지 않았지만 과세관청이 볼 수 있는 자료(짚을 곳 A). 요청할지는 세무사님이 고르십니다.' });

  // 배운 것(FinLearn.js)
  finLnWrite_(ss, A, ctx.learn);

  // 사건 기준
  var b0 = U.base || {};
  var baseRows = [
    ['피상속인', b0.피상속인 || '', B.피상속인, '예금주가 이 이름(또는 빈칸)인 계좌만 전체 잔액·안에서 옮김에 넣음'],
    ['상속개시일', b0.상속개시일 || '', B.D ? B.D + (B.D짐작 ? ' — 「' + B.D짐작 + '」에서 짐작, 확인해 주세요' : '') : '(없음 — 적어 주시면 §15·§13을 셈합니다)', '예: 2026-04-06 — 1년·2년·5년·10년 구간의 기준'],
    ['상속개시시각', b0.상속개시시각 || '', B.Dt || '(없음)', '예: 07:32 — 당일 거래를 사망 전·후로 가름'],
    ['큰돈', b0.큰돈 || '', B.T.큰돈, '짚을 곳에 올릴 한 줄 금액(원)'],
    ['현금쪼갬합계', b0.현금쪼갬합계 || '', B.T.현금쪼갬합계, '며칠 사이 나눠 뽑은 현금의 합계 기준(원)'],
    ['현금쪼갬일', b0.현금쪼갬일 || '', B.T.현금쪼갬일, '나눠 뽑은 현금을 묶어 볼 날 수'],
    ['자주횟수', b0.자주횟수 || '', B.T.자주횟수, '관련인 후보로 올릴 오간 횟수'],
    ['자주합계', b0.자주합계 || '', B.T.자주합계, '관련인 후보로 올릴 오간 합계(원)'],
    ['목록기준', b0.목록기준 || '', B.T.목록기준, '§15 줄별 목록에 한 줄씩 보일 금액(원)'],
    ['직전일', b0.직전일 || '', B.T.직전일, '사망 직전 몰린 인출로 볼 날 수'],
    ['보고서저절로', b0.보고서저절로 || '', /^(아니오|아니요|끔)$/.test(String(b0.보고서저절로 || '').trim()) ? '아니오' : '예', '「아니오」면 보고서/개별검토서_금융거래.md를 저절로 만들거나 고치지 않음(GAS 칸만 고치고 세무사님·넥스 문단은 안 건드림)']
  ];
  finRvTab_(ss, '사건 기준', ['항목', '값 ✎', '지금 쓰는 값', '설명', '열쇠'], baseRows.map(function (r) { return [r[0], r[1], r[2], r[3], r[0]]; }), { text: [1, 2, 4], note: '값 ✎ 칸에 적으시면 다음 셈부터 그 값으로. 비우시면 기본값.' });

  // 엑셀 판단 가져오기
  var xr = [];
  Object.keys(U.excel || {}).forEach(function (fid) {
    var e = U.excel[fid]; (e.cols || []).forEach(function (c) { var mk = c.sheet + '|' + c.h; xr.push([e.name, c.sheet, c.h, c.n, (c.ex || []).join(' · '), (e.mean || {})[mk] || '', c.guess || '', e.got && e.got[mk] ? e.got[mk] : '', fid + '|' + mk]); });
  });
  FIN_RV_OLD_TABS_.forEach(function (n) { var o = ss.getSheetByName(n); if (o) try { ss.deleteSheet(o); } catch (e) {} });
  finRvTab_(ss, '엑셀 판단 가져오기', ['파일', '시트', '칸 이름', '채운 줄', '예시 값', '뜻 ✎', '짐작', '가져온 줄', '열쇠'], xr, { text: [1, 2, 8], lists: [{ col: 5, list: FIN_RV_MEAN_ }], note: '세무사님이 엑셀에서 하신 판단을 읽기만 해서 가져옵니다(엑셀 파일은 고치지 않음). 칸마다 뜻을 한 번 골라 주시면, 거래 열쇠(계좌·날짜·금액)로 맞춰 거래 탭 ✎ 칸의 빈 곳에 넣습니다. 파일이 바뀌면 다시 읽습니다.' });
  finRvOrderTabs_(ss);
}
// 2단계 탭을 「거래」 바로 뒤에 분석 차례대로(차례가 이미 맞으면 건드리지 않음)
function finRvOrderTabs_(ss) {
  var ref = ss.getSheetByName('거래'); if (!ref) return;
  var list = FIN_RV_TABS_.map(function (n) { return ss.getSheetByName(n); }).filter(Boolean), at = ref.getIndex();
  if (list.every(function (sh, i) { return sh.getIndex() === at + 1 + i; })) return;
  list.forEach(function (sh, i) { ss.setActiveSheet(sh); ss.moveActiveSheet(at + 1 + i); });
  try { ss.setActiveSheet(list[0]); } catch (e) {}
}

// ---------- 엑셀 판단 가져오기(세무사님 작업 파일 — 읽기만) ----------
// 사건 폴더 맨 위 엑셀(1단계가 합본으로 보고 읽지 않는 파일)에서 은행 칸(날짜·금액·잔액) 말고 세무사님이 더하신 칸을 찾는다
function finRvExcelScan_(folder, U, budgetAt) {
  var files = finFolderFiles_(folder).filter(function (f) { return !f.dir && /\.(xlsx|xlsm|xls)$/i.test(f.name) && !/^~\$/.test(f.name); });
  var live = {}, changed = false;
  files.forEach(function (f) {
    live[f.id] = 1;
    var e = U.excel[f.id];
    if (e && e.modified === f.modified) return;
    if (Date.now() > budgetAt) return;
    var sheets = null; try { sheets = bankReadFile_(f.id).sheets; } catch (err) { U.excel[f.id] = { name: f.name, modified: f.modified, cols: [], rows: [], err: String(err && err.message || err).slice(0, 120), mean: e ? e.mean : {} }; changed = true; return; }
    var cols = [], rows = [];
    (sheets || []).forEach(function (s) {
      var raw = (s.rows || []).map(function (r) { return (r || []).map(bankCell_); }), hi = bankFindHeader_(raw); if (hi < 0) return;
      var hdr = raw[hi], map = finGuessMap_(hdr), keyOf = function (h) { return finKey_(h); };
      var col = {}; hdr.forEach(function (h, i) { var t = map[String(h).trim()]; if (t && col[t] === undefined) col[t] = i; });
      var ai = hdr.findIndex(function (h) { return /^(계좌번호|계좌)$/.test(keyOf(h)); });
      if (col.거래일자 === undefined && col.거래일시 === undefined) return;
      if (col.입금 === undefined && col.출금 === undefined && col.금액 === undefined) return;
      hdr.forEach(function (h, i) {
        if (!h || map[String(h).trim()] || i === ai || /^(순번|번호|NO|순|기관|은행|금융기관|은행명)$/i.test(keyOf(h))) return;
        var vals = raw.slice(hi + 1).map(function (r) { return r[i]; }).filter(function (v) { return v !== '' && v != null; });
        if (!vals.length) return;
        var ex = {}; vals.forEach(function (v) { ex[v] = (ex[v] || 0) + 1; });
        var top = Object.keys(ex).sort(function (a, b) { return ex[b] - ex[a]; }).slice(0, 4).map(function (v) { return v.slice(0, 20); });
        var numOnly = vals.every(function (v) { return finRvNum_(v) != null; });
        cols.push({ sheet: s.sheet, h: String(h).trim(), i: i, n: vals.length, ex: top, guess: numOnly ? '숫자뿐 — 가져오지 않음 같음' : /검토|메모|비고|판단|추정|기간|소명/.test(h) ? '판단 칸 같음' : '' });
      });
      raw.slice(hi + 1).forEach(function (r) {
        var d = finRvYmd_(r[col.거래일자 !== undefined ? col.거래일자 : col.거래일시]); if (!d) return;
        var inn = col.입금 !== undefined ? finRvNum_(r[col.입금]) : null, out = col.출금 !== undefined ? finRvNum_(r[col.출금]) : null;
        if (inn == null && out == null && col.금액 !== undefined) { var amt = finRvNum_(r[col.금액]), dirTxt = col.입출구분 !== undefined ? String(r[col.입출구분]) : ''; if (amt != null) { if (/입금|입/.test(dirTxt)) inn = amt; else if (/출금|지급|출/.test(dirTxt)) out = amt; } }
        if (!(inn > 0) && !(out > 0)) return;
        var vals2 = {}; cols.forEach(function (c) { if (c.sheet === s.sheet && r[c.i] !== '' && r[c.i] != null) vals2[c.h] = String(r[c.i]).slice(0, 200); });
        if (!Object.keys(vals2).length) return;
        rows.push({ sheet: s.sheet, dg: ai >= 0 ? String(r[ai]).replace(/[^\d]/g, '') : '', d: d, in: inn > 0 ? inn : 0, out: out > 0 ? out : 0, bal: col.잔액 !== undefined ? finRvNum_(r[col.잔액]) : null, v: vals2 });
      });
    });
    U.excel[f.id] = { name: f.name, modified: f.modified, cols: cols, rows: rows, mean: e ? (e.mean || {}) : {}, got: {} };
    changed = true;
  });
  Object.keys(U.excel).forEach(function (id) { if (!live[id]) { delete U.excel[id]; changed = true; } });
  return changed;
}
// 뜻을 고르신 칸의 값을 거래 줄에 맞춰 U.rows[k]._x(엑셀에서 옮긴 값)로 — 세무사님이 시트에 적으신 값이 있으면 그 칸은 그대로(셈은 urow가 둘을 합쳐 봄)
function finRvExcelApply_(R, U) {
  var idx = {};
  R.forEach(function (r) { var dg = String(r.dg || '').replace(/[^\d]/g, ''), k = r.d + '|' + r.in + '|' + r.out; (idx[k] = idx[k] || []).push({ r: r, dg: dg }); });
  var used = {}, n = 0;
  Object.keys(U.rows).forEach(function (k) { if (U.rows[k]._x) { delete U.rows[k]._x; if (!Object.keys(U.rows[k]).length) delete U.rows[k]; } });
  Object.keys(U.excel || {}).forEach(function (fid) {
    var e = U.excel[fid], mean = e.mean || {}; e.got = {};
    if (!Object.keys(mean).some(function (k) { return mean[k] && mean[k] !== '가져오지 않음'; })) return;
    (e.rows || []).forEach(function (x) {
      var cand = (idx[x.d + '|' + x.in + '|' + x.out] || []).filter(function (c) { return !used[c.r.k] && (!x.dg || !c.dg || x.dg.slice(-6) === c.dg.slice(-6)); });
      if (cand.length > 1 && x.bal != null) { var b = cand.filter(function (c) { return c.r.bal != null && Math.abs(c.r.bal - x.bal) < 0.5; }); if (b.length) cand = b; }
      var c = cand[0]; if (!c) return; used[c.r.k] = 1;
      var o = U.rows[c.r.k] || {}, xo = {};
      Object.keys(x.v).forEach(function (h) { var m = mean[x.sheet + '|' + h]; if (!m || m === '가져오지 않음') return; var v = String(x.v[h]).trim(); if (!v) return; if (m === '소명액' && finRvNum_(v) == null) return; xo[m] = xo[m] ? xo[m] + ' / ' + v : v; e.got[x.sheet + '|' + h] = (e.got[x.sheet + '|' + h] || 0) + 1; });
      var put = {}; Object.keys(xo).forEach(function (m) { if (!o[m]) put[m] = xo[m]; });
      if (Object.keys(put).length) { o._x = put; U.rows[c.r.k] = o; n++; }
    });
  });
  return n;
}

// ---------- 가족 지도(같은 고객) — 관련인 표로 ----------
function finRvFamily_(c, U) {
  var key = String((c && (c.고객ID || c.고객명 || c.id)) || '').trim(); if (!key) return false;
  var it = DriveApp.getFilesByName('_가족_' + key.replace(/[\\/:*?"<>|\s]/g, '_') + '.json'); if (!it.hasNext()) return false;
  var F = null; try { F = JSON.parse(it.next().getBlob().getDataAsString('UTF-8')); } catch (e) { return false; }
  var have = {}, changed = false; U.rel.forEach(function (x) { have[finRvNorm_(x.이름)] = x; });
  (F && F.사람 || []).forEach(function (p) {
    var n = String(p.이름 || '').trim(); if (!n || have[finRvNorm_(n)]) return;
    var heir = p.상속인 === true || /^(예|true|상속인)$/.test(String(p.상속인 || ''));
    U.rel.push({ 이름: n, 갈래: '', 짐작: heir ? '상속인' : '상속인 아닌 가족·친척', 상속인: '', 관계: String(p.관계 || ''), 별칭: [], 계좌: [], 출처: '가족 지도(세무사님 확인 전)', 상태: '후보 — 갈래를 골라 주세요' });
    changed = true;
  });
  (F && F.법인 || []).forEach(function (k) {
    var n = String(k.이름 || '').trim(); if (!n || have[finRvNorm_(n)]) return;
    U.rel.push({ 이름: n, 갈래: '', 짐작: '특수관계 법인', 상속인: '', 관계: '', 별칭: [], 계좌: [], 사업자번호: String(k.사업자번호 || ''), 출처: '가족 지도 법인(세무사님 확인 전)', 상태: '후보 — 갈래를 골라 주세요' });
    changed = true;
  });
  return changed;
}

// ---------- 한 사건 2단계 — 1단계 자동(finMergeAutoRun_)이 부름 ----------
// force: 1단계가 시트를 새로 썼을 때. 그 밖엔 시트가 고쳐졌거나(파일 수정 시각) 규칙 판·엑셀·가족 지도가 바뀐 때만 셈
function finRvRun_(c, folder, st, opt) {
  opt = opt || {};
  var last = st.s.last; if (!last || !last.url) return { skip: '합친 시트 없음' };
  var id = (/\/d\/([^/]+)/.exec(last.url) || [])[1]; if (!id) return { skip: '시트 주소 이상' };
  var file = DriveApp.getFileById(id), mod = file.getLastUpdated().getTime();
  var S = finRvLoad_(folder), U = S.U, budgetAt = Date.now() + (opt.budgetMs || 120000);
  var xChanged = finRvExcelScan_(folder, U, budgetAt);
  if (!U.relShown) U.relShown = U.rel.map(function (x) { return x.이름; }); // 옛 판 보관(시트에 보인 이름 기록 없음) — 지금 있는 이름이 시트에 보인 것
  var famChanged = false; try { famChanged = finRvFamily_(c, U); } catch (e) {}
  try { var gD = finRvGuessD_(folder); if (JSON.stringify(gD || null) !== JSON.stringify(U.guess || null)) { U.guess = gD; famChanged = true; } } catch (e) {}
  // [2026.11.25] 사건 폴더 계약서(임대차·매매)에서 주요 거래대상자 · 다른 사건에서 배운 것(자체 학습)
  var decedent = String((U.base || {}).피상속인 || '').trim() || finTaxpayer_(folder.getName(), c);
  try { if (finTgContracts_(folder, U, budgetAt)) famChanged = true; if (finTgContractRels_(U, decedent)) famChanged = true; } catch (e) {}
  var LN = null; try { LN = finLnLoad_().agg; } catch (e) { LN = null; }
  var lnHash = LN ? finHash32_(JSON.stringify([LN.lanes, LN.natures, LN.codes, LN.flags])) : '';
  if (lnHash !== (U.lnHash || '')) famChanged = true;
  if (!opt.force && !xChanged && !famChanged && U.ver === FIN_RV_VER_ && U.sheetId === id && U.mod && mod <= U.mod + 3000) return { ok: true, nochange: true };
  var ss = SpreadsheetApp.openById(id);
  var harvested = finRvHarvest_(ss, U);
  var X = finRvRead_(ss); if (!X) return { skip: '거래 탭 없음' };
  finRvExcelApply_(X.R, U);
  var notTx = (last.확인 || []).filter(function (k) { return k.종류 === '거래내역 아님'; });
  var A = finRvAnalyze_(X.R, U, { taxpayer: finTaxpayer_(folder.getName(), c), notTx: notTx, learn: LN });
  // 배운 별칭·계좌·새 후보를 보관에
  U.rel = A.rels.map(function (x) { var o = {}; Object.keys(x).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = x[k]; }); return o; });
  var sum = finRvSummary_(A);
  var outHash = finHash32_(JSON.stringify(sum) + '|' + JSON.stringify(A.R.map(function (r) { return [r.k, r.total, r.period, r.flow, r.m ? r.m.x.이름 + r.m.sure : '', r.nature, r.bundleGas, (r.flags || []).join(' ')]; })) + '|' + JSON.stringify(U.rel) + '|' + JSON.stringify(A.flags.map(function (f) { return [f.id, f.금액, f.상태, f.메모]; })) + JSON.stringify(U.wants) + JSON.stringify(U.base) + JSON.stringify(Object.keys(U.excel).map(function (k) { return [k, U.excel[k].mean, U.excel[k].got]; })) + JSON.stringify(A.bundles) + JSON.stringify(A.flags.map(function (f) { return [f.중요도, f.배움]; })) + JSON.stringify((A.change.drops || []).map(function (d) { return [d.시작, d.끝, d.설명필요, d.관련인으로]; })) + JSON.stringify(A.learnUsed) + (LN ? LN.사건수 : 0));
  var wrote = false;
  if (opt.force || outHash !== U.outHash || U.sheetId !== id) {
    var w = finRvWrite_(ss, A, U, { X: X, learn: LN });
    if (w && w.moved) { finRvSave_(folder, S); return { ok: true, retry: true, 까닭: '읽는 사이 거래 탭 줄 차례가 바뀜 — 다음 번에 다시' }; }
    SpreadsheetApp.flush();
    wrote = true;
  }
  var prevSum = U.sum ? JSON.stringify(U.sum) : '';
  U.ver = FIN_RV_VER_; U.sheetId = id; U.outHash = outHash; U.sum = sum; U.at = new Date().toISOString();
  U.mod = DriveApp.getFileById(id).getLastUpdated().getTime();
  // [2026.11.25] 자체 학습 — 이 사건에서 세무사님이 정하신 것을 학습 파일에(바뀐 때만) · 보고서(개별검토서_금융거래.md) GAS 칸
  var learnSaved = false; try { learnSaved = finLnSave_(c.id || c.고객ID || folder.getId(), finLnCollect_(A, U)); } catch (e) {}
  try { var LN2 = finLnLoad_().agg; U.lnHash = finHash32_(JSON.stringify([LN2.lanes, LN2.natures, LN2.codes, LN2.flags])); } catch (e) {}
  var rp = null; try { rp = finRpSave_(folder, A, U, last.url); } catch (e) { rp = { error: String(e && e.message || e).slice(0, 160) }; }
  finRvSave_(folder, S);
  return { ok: true, wrote: wrote, harvested: harvested, changed: prevSum !== JSON.stringify(sum), 요약: sum, 학습: learnSaved, 보고서: rp };
}
function finRvSummary_(A) {
  var cnt = {}; A.flags.forEach(function (f) { var g = f.번호.charAt(0); cnt[g] = (cnt[g] || 0) + 1; });
  var open = A.flags.filter(function (f) { return !/소명 됨|해당 없음/.test(f.상태 || ''); });
  return {
    상속개시일: A.B.D || '', 피상속인: A.B.피상속인,
    추정상속: A.s15.map(function (s) { return { 기간: s.y + '년', 순인출: s.순, 기준넘음: s.넘음, 소명액: s.소명, 미소명: s.미소명, 추정액: s.추정 }; }),
    사전증여: A.s13.map(function (s) { return { 관련인: s.x.이름, 갈래: (s.x.갈래 || s.x.짐작 || '') + (s.확정 ? '' : '(짐작)'), 합산기간: s.yrs + '년', 나감: s.나감, 들어옴: s.들어옴, 순액: s.순액 }; }),
    짚을곳: { A: cnt.A || 0, B: cnt.B || 0, C: cnt.C || 0, D: cnt.D || 0, 남은것: open.length },
    큰것: open.slice().sort(function (a, b) { return (b.금액 || 0) - (a.금액 || 0); }).slice(0, 12).map(function (f) { return f.번호 + ' ' + f.짚을것 + (f.날짜 ? ' · ' + f.날짜 : '') + (f.금액 ? ' · ' + finRvWon_(f.금액) + '원' : ''); }),
    관련인: { 확정: A.rels.filter(function (x) { return x.갈래; }).length, 후보: A.rels.filter(function (x) { return !x.갈래; }).length },
    받을자료: A.flags.filter(function (f) { return f.want; }).length,
    전체잔액끝: (function () { var t = null; A.order.forEach(function (ix) { if (A.R[ix].total != null) t = A.R[ix].total; }); return t; })(),
    잔액끊김: A.breaks,
    분석대상자: (function () { var o = { 상속인특수관계자: 0, 주요거래대상자: 0, 살펴볼: 0 }; (A.targets || []).forEach(function (t) { if (t.구분 === 0) o.상속인특수관계자++; else if (t.구분 === 1) o.주요거래대상자++; else if (t.구분 === 2) o.살펴볼++; }); return o; })(),
    크게줄어든구간: ((A.change || {}).drops || []).map(function (d) { return d.시작 + '~' + d.끝 + ' ' + finRvWon_(d.줄어듦) + '원'; }).slice(0, 5)
  };
}
// 1단계 자동이 부르는 입구 — 2단계가 실패해도 1단계 결과는 그대로(실패는 결과에 적어 틱 기록으로)
function finRvSafe_(c, folder, st, opt) {
  try { return finRvRun_(c, folder, st, opt); }
  catch (e) { return { error: '2단계 검토 실패: ' + String(e && e.message || e).slice(0, 200) }; }
}
// 💰 창·넥스가 읽는 2단계 요약(보관 파일에서 — 시트를 열지 않음)
function finRvSummaryOf_(folder) {
  var U = finRvLoad_(folder).U; if (!U.sum) return null;
  return Object.assign({}, U.sum, { at: U.at ? Utilities.formatDate(new Date(U.at), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '', 판: U.ver || '', 보고서: U.rpFile ? { name: '보고서/' + (U.rpName || FIN_RP_NAME_), url: 'https://drive.google.com/file/d/' + U.rpFile + '/view' } : null });
}
// 상속개시일 짐작 — 사건 폴더 맨 위 글 파일(의뢰서·메모 .md/.txt)의 「상속개시일 : 2026.5.15」·「사망일자: …」(세무사님 값이 있으면 쓰지 않음)
//  (11-24 확인: 실사건 의뢰 메모 .txt "상속개시일 : 2026.5.15일(추정)" · 다른 네 사건 의뢰서는 칸이 비어 있음)
function finRvGuessDText_(t) {
  var m = /(상속\s*개시일|사망\s*일자?|사망일)\s*[:：]?\s*(\d{4})\s*[.\-년\/]\s*(\d{1,2})\s*[.\-월\/]\s*(\d{1,2})/.exec(String(t || ''));
  return m ? m[2] + '-' + ('0' + m[3]).slice(-2) + '-' + ('0' + m[4]).slice(-2) : '';
}
function finRvGuessD_(folder) {
  var it = folder.getFiles(), n = 0;
  while (it.hasNext() && n < 40) {
    var f = it.next(), name = f.getName(); n++;
    if (!/\.(md|txt)$/i.test(name) || /^_/.test(name) || f.getSize() > 200000) continue;
    var t = ''; try { t = f.getBlob().getDataAsString('UTF-8'); } catch (e) { continue; }
    var d = finRvGuessDText_(t); if (d) return { D: d, from: name };
  }
  return null;
}
