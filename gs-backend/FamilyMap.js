// [2026.11.01 복잡사건 ①②③④⑥] 고객(가족) 지도 — 세무사님 "고쳐라"(점검서 넥스_복잡사건_능력점검_20261101 4절 방향 1~4·6)
//  원인: 사건 장부 뼈대 = 계산기 칸(한 사건 = 거래 한 건)이라 가족 전체·지난 이전·시간줄을 둘 곳이 없었다.
//  그래서 한 고객(가족)에 파일 하나: 사람·지난 이전(증여·양도·상속·부담부증여·빌린 돈 …, 건별)·미래 계획 — 그 고객의 여러 사건이 함께 본다.
//  저장: 총괄관리자\_사건장부\_가족_<고객ID>.json (사건 장부와 같은 폴더, 같은 잠금). 값 주인(누가)·근거(출처)를 줄마다 남긴다.
//  쓰는 곳: ① 넥스 case_ledger do=family·person·transfer·family_drop·chain·plan ② 장부 증여·상속 계산(지난 증여 자동 합산 — ledgerCalcGiftInh_)
//  ③ 화면 📒 장부 › 가족 탭(같은 함수). GAS 도구라 토큰 0.
var FAM_PREFIX_ = '_가족_';
var FAM_KINDS_ = ['증여', '부담부증여', '양도', '상속', '빌림', '갚음', '매매', '재산분할', '그밖'];
var FAM_RELS_ = ['배우자', '직계존속', '직계비속', '기타친족', '기타'];

function famKeyOf_(c) { return String((c && (c.고객ID || c.고객명 || c.id)) || '').trim(); }
function famFile_(key, create) {
  const folder = ledgerFolder_();
  const name = FAM_PREFIX_ + String(key).replace(/[\\/:*?"<>|\s]/g, '_') + '.json';
  const it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(name, '{}', 'application/json') : null;
}
function famEmpty_(key) { return { key: String(key || ''), 사람: [], 이전: [], 계획: [], log: [], at: '' }; }
function famNorm_(o, key) { o = o || {}; o.key = String(key || o.key || ''); ['사람', '이전', '계획', 'log'].forEach(function (k) { if (!Array.isArray(o[k])) o[k] = []; }); return o; }
var FAM_MEMO_ = {};
function famLoad_(key, fresh) {
  const k = String(key || '');
  if (!fresh && FAM_MEMO_[k]) return JSON.parse(FAM_MEMO_[k]);
  try { const f = famFile_(k, false); if (!f) return famEmpty_(k); const o = famNorm_(JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}'), k); FAM_MEMO_[k] = JSON.stringify(o); return o; }
  catch (e) { return famEmpty_(k); }
}
function famMutate_(key, mutate) {
  return withLock_(15000, function () {
    const F = famLoad_(key, true); const out = mutate(F); F.at = caseProcNow_();
    if (F.log.length > 300) F.log = F.log.slice(-300);
    const s = JSON.stringify(F); famFile_(key, true).setContent(s); FAM_MEMO_[String(key)] = s; return out;
  });
}

// ── 순수 셈(드라이브·엔진 없이 — 이 컴퓨터 시험 tools/family-regress.js가 그대로 부른다) ──
function famYmd_(x) { const s = String(x == null ? '' : x).trim(); if (/^\d{4}$/.test(s)) return s + '-07-01'; const m = /^(\d{4})[-.\/]\s*(\d{1,2})[-.\/]\s*(\d{1,2})/.exec(s); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : ''; }
function famAddY_(d, n) { d = famYmd_(d); if (!d) return ''; let s = (Number(d.slice(0, 4)) + n) + d.slice(4); if (s.slice(5) === '02-29') s = s.slice(0, 5) + '02-28'; return s; }
// 금액 — 200000000 · "2억" · "3억 5천만" · "1억2,500만원" · "5천만" 모두 원으로(앞 판은 "3억 5천만"을 35원으로 읽었음)
function famNum_(x) {
  if (typeof x === 'number') return x;
  const s = String(x == null ? '' : x).replace(/[,\s원]/g, '');
  if (!s) return 0;
  if (!/[억만천백십]/.test(s)) return Number(s.replace(/[^\d.-]/g, '')) || 0;
  const sub = function (p) { // 만 아래 자리: "2천5백" · "5000" · "3.5"
    if (!p) return 0; if (!/[천백십]/.test(p)) return Number(p) || 0;
    let n = 0; p.replace(/(\d+(?:\.\d+)?)?(천|백|십)|(\d+(?:\.\d+)?)$/g, function (_, d, u, tail) { if (u) n += (d === undefined ? 1 : Number(d)) * (u === '천' ? 1000 : u === '백' ? 100 : 10); else if (tail) n += Number(tail); return ''; });
    return n;
  };
  const e = s.split('억'), hasE = e.length > 1, rest = hasE ? e.slice(1).join('') : s;
  const m = rest.split('만'), hasM = m.length > 1;
  const v = (hasE ? sub(e[0]) * 1e8 : 0) + (hasM ? sub(m[0]) * 1e4 + sub(m.slice(1).join('')) : sub(rest));
  return Math.round(s.charAt(0) === '-' ? -Math.abs(v) : v);
}
function famWon_(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
function famPerson_(F, who) { const w = String(who || '').trim(); if (!w) return null; return F.사람.filter(function (p) { return p.id === w; })[0] || F.사람.filter(function (p) { return p.이름 === w; })[0] || null; }
function famName_(F, who) { const p = famPerson_(F, who); return p ? p.이름 : String(who || ''); }
function famSpouseOf_(F, who) { const p = famPerson_(F, who); if (!p) return ''; if (p.배우자) return famName_(F, p.배우자); const q = F.사람.filter(function (x) { return x.배우자 && famName_(F, x.배우자) === p.이름; })[0]; return q ? q.이름 : ''; }
function famIsGift_(t) { return t && /^(증여|부담부증여)$/.test(t.종류) && !famGiftReturn_(t).없던것; }
// [2026.11.02 「차씨 되돌림」] 증여 반환(상증법 §4④) — 증여 줄의 「반환일」을 보고 판정. 금전은 제외, 반환 전에 세무서가 결정(§76)했으면(「결정일」) 제외.
//  신고기한(증여일 속한 달 말일부터 3개월, §68①)까지 반환 → 처음부터 증여 없던 것(합산·상속 가산·잇기에서 빠짐)
//  신고기한 뒤 3개월 안 반환 → 당초 증여는 과세, 반환(다시 증여)은 과세 안 함 / 그 뒤 반환 → 반환도 새 증여(받은 사람 → 준 사람 줄을 따로 적을 것)
function famGiftDue_(d) { d = famYmd_(d); if (!d) return ''; const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) + 3, 0)); return t.toISOString().slice(0, 10); }
function famGiftReturn_(t) {
  const back = famYmd_(t && t.반환일); if (!back || !/^(증여|부담부증여)$/.test(t.종류)) return {};
  const d = famYmd_(t.날짜), due = famGiftDue_(d), due3 = due ? famGiftDue_(due.slice(0, 8) + '01') : '';
  const cash = /현금|금전|예금|돈|송금|이체/.test(String(t.물건종류 || '') + ' ' + String(t.물건 || ''));
  const dec = famYmd_(t.결정일), decided = dec && dec <= back;
  if (cash) return { 단계: '금전', 신고기한: due, 알림: '금전 증여는 돌려줘도 §4④가 적용되지 않음 — 당초 증여 과세, 돌려준 것도 새 증여로 볼 수 있음(상증법 §4④ 괄호)' };
  if (decided) return { 단계: '결정뒤', 신고기한: due, 알림: '반환 전에 세무서가 결정(' + dec + ')해 §4④ 괄호로 당초 증여 과세' };
  if (due && back <= due) return { 없던것: true, 단계: '기한안', 신고기한: due, 알림: '신고기한(' + due + ')까지 돌려줘 처음부터 증여가 없던 것(§4④ 앞부분) — 합산·상속 가산에서 뺌' };
  if (due3 && back <= due3) return { 단계: '3개월안', 신고기한: due, 알림: '신고기한 뒤 3개월(' + due3 + ') 안 반환 — 당초 증여는 과세, 반환은 과세 안 함(§4④ 뒷부분)' };
  return { 단계: '그뒤', 신고기한: due, 알림: '신고기한 뒤 3개월(' + (due3 || '?') + ')이 지나 반환 — 당초 증여 과세, 반환도 새 증여(받은 사람 → 준 사람 줄을 따로 적을 것)' };
}
// 증여 한 건의 과세가액 몫 — 부담부증여는 인수 채무를 뺀 것(§47①). 금액이 없으면 0
//  [2026.11.02 복잡물건 점검 #12] 채무 칸은 「채무인수」가 정식 이름 — 「채무」·「인수채무」로 적어도 같은 칸으로 읽는다(예전엔 말없이 0)
function famDebt_(t) { return famNum_(t.채무인수 != null && t.채무인수 !== '' ? t.채무인수 : t.인수채무 != null && t.인수채무 !== '' ? t.인수채무 : t.채무); }
function famGiftValue_(t) { return Math.max(0, famNum_(t.금액) - (t.종류 === '부담부증여' ? famDebt_(t) : 0)); }
// 조특법 특례 증여(가업승계 §30의6·창업자금 §30의5) — 다른 증여와 10년 합산하지 않고(§30의5⑪, §30의6⑤ 준용), 상속엔 기간 없이 가산(§30의5⑨)
function famSpecial_(t) { const s = String((t && (t.특례 || t.종류)) || ''); return /가업|business/.test(s) ? '가업승계' : /창업/.test(s) ? '창업자금' : ''; }
// [2026.11.02 #10] 금전 무상대출(상증법 §41의4) — 「빌림」 줄을 해마다 한 번 받은 증여로 펼친다.
//  이익 = 대출금액 × 적정이자율 − 실제 낸 이자(①1·2호), 1년마다 새로 빌린 것으로 봄(②), 이익이 기준금액 1천만원 미만이면 뺀다(① 단서·시행령 §31의4②).
//  적정이자율은 줄의 「적정이자율」(%)이 먼저, 없으면 4.6%(시행규칙 §10의5 → 법인세법 시행규칙 §43② — 바뀌면 줄에 적을 것).
//  끝: 줄의 「상환일」 또는 같은 두 사람 사이 「갚음」 줄 날짜, 없으면 until(보는 날).
function famLoanGifts_(F, until) {
  const out = []; until = famYmd_(until);
  F.이전.forEach(function (t) {
    if (t.종류 !== '빌림' || t.무상 === false) return;
    const d0 = famYmd_(t.날짜), amt = famNum_(t.금액); if (!d0 || !amt) return;
    const back = F.이전.filter(function (x) { return x.종류 === '갚음' && famName_(F, x.주는) === famName_(F, t.받는) && famName_(F, x.받는) === famName_(F, t.주는) && famYmd_(x.날짜) > d0; }).map(function (x) { return famYmd_(x.날짜); }).sort()[0];
    const end = famYmd_(t.상환일) || back || until || d0;
    const rate = (t.적정이자율 != null && t.적정이자율 !== '' ? Number(t.적정이자율) : 4.6) / 100, interest = famNum_(t.이자);
    for (let k = 0; k < 40; k++) {
      const d = famAddY_(d0, k); if (!d || (k > 0 && d >= end)) break;
      const v = Math.max(0, Math.round(amt * rate) - interest);
      out.push({ id: t.id + '#' + (k + 1), 종류: '증여', 날짜: d, 주는: t.주는, 받는: t.받는, 관계: t.관계, 금액: v < 10000000 ? 0 : v, 신고: t.신고, 무상대출: { 원줄: t.id, 해: k + 1, 원금: amt, 이자율: rate * 100, 기준미달: v < 10000000 }, 물건: '무상대출 이익(상증법 §41의4) ' + (k + 1) + '년째' });
    }
  });
  return out.filter(function (x) { return x.금액 > 0; });
}
// 합산·가산이 보는 이전 목록 = 지도 줄 + 무상대출 이익(해마다)
// [2026.11.02 복잡사건 35] 특례 증여 줄의 「특례밖금액」(사업무관자산 몫·한도 넘는 몫 — 엔진 기본세율적용대상_증여재산가액)은 일반 증여로 떼어 냄
//  → 10년 합산(§47②)·상속 가산 10년(§13①)·§24 공제한도 차감·§28② 한도 공제를 보통 증여처럼. 그 몫의 과세표준·산출세액은 「특례밖과세표준」·「특례밖산출세액」
function famSplitSpecial_(t) {
  const x = famNum_(t.특례밖금액);
  if (!famSpecial_(t) || !(x > 0)) return [t];
  const a = Object.assign({}, t, { 금액: Math.max(0, famNum_(t.금액) - x) }), b = Object.assign({}, t, { id: (t.id || '') + '밖', 특례: '', 종류: '증여', 금액: x, 과세표준: famNum_(t.특례밖과세표준), 산출세액: famNum_(t.특례밖산출세액), 공제사용: famNum_(t.특례밖공제사용), 특례밖금액: 0 });
  return [a, b];
}
function famEvents_(F, until) { return F.이전.reduce(function (a, t) { return a.concat(famSplitSpecial_(t)); }, []).concat(famLoanGifts_(F, until)); }
// [2026.11.02 #5] 세대생략(상증법 §57①) — 받는 사람이 주는 사람의 자녀가 아닌 직계비속인가.
//  판정 순서: ① 사람 줄의 「세대」 숫자(받는 − 주는 ≥ 2) ② 「부모」(받는 사람의 부모 이름·id 목록)에 주는 사람이 없고, 그 부모의 부모에 있음
//  ③ 사람 줄 「관계」가 손자·손녀·증손 등이고 주는 사람이 본인·배우자(글로 추정 — 알림에 적음). 모르면 null.
//  주는 사람의 자녀(받는 사람의 부모)가 증여일 전에 사망했으면 할증 안 함(§57① 괄호) → 대습: true
function famParentsOf_(F, p) { if (!p) return []; const v = p.부모; return (Array.isArray(v) ? v : String(v || '').split(/[,·、\/]/)).map(function (s) { return famName_(F, String(s).trim()); }).filter(Boolean); }
function famGenSkip_(F, donorWho, doneeWho, date) {
  const a = famPerson_(F, donorWho), b = famPerson_(F, doneeWho); if (!a || !b) return null;
  const dead = function (names) { return names.some(function (n) { const q = famPerson_(F, n); return q && famYmd_(q.사망일) && (!date || famYmd_(q.사망일) <= famYmd_(date)); }); };
  if (Number(a.세대) > 0 && Number(b.세대) > 0) { const gap = Number(b.세대) - Number(a.세대); if (gap < 2) return { 해당: false, 근거: '세대 ' + a.세대 + '→' + b.세대 }; const mids = famParentsOf_(F, b); return { 해당: true, 대습: mids.length ? dead(mids) : false, 근거: '세대 ' + a.세대 + '→' + b.세대 }; }
  const pa = famParentsOf_(F, b);
  if (pa.length) {
    if (pa.indexOf(a.이름) >= 0) return { 해당: false, 근거: b.이름 + '의 부모 = ' + pa.join('·') };
    const mids = pa.filter(function (n) { return famParentsOf_(F, famPerson_(F, n)).indexOf(a.이름) >= 0 || (famSpouseOf_(F, a.이름) && famParentsOf_(F, famPerson_(F, n)).indexOf(famSpouseOf_(F, a.이름)) >= 0); });
    if (mids.length) return { 해당: true, 대습: dead(mids), 근거: b.이름 + '의 부모 ' + mids.join('·') + '의 부모가 ' + a.이름 };
    return null;
  }
  if (/손자|손녀|손주|외손|증손/.test(String(b.관계 || '')) && /본인|배우자|^$/.test(String(a.관계 || ''))) return { 해당: true, 대습: false, 근거: '사람 줄 관계 「' + b.관계 + '」로 추정 — 부모·세대 칸을 넣으면 정확', 추정: true };
  return null;
}
// [2026.11.02 #7] 1순위 상속인(민법 §1000①1호) — 피상속인의 자녀만. 손자녀는 자녀가 먼저 죽었을 때 대습상속(§1001)으로만.
//  부모 칸이 있으면 그것으로, 없으면 관계 글(손자·손녀 등은 뺌) · 상속인 === false 는 뺌(포기 등)
// 받는 날 미성년(만 19세 미만, 민법 §4) — 증여재산공제 2천만원(상증법 §53 2호 단서)·세대생략 40% 할증(§57① 단서) 판정에 씀. 생년월일 없으면 null
function famIsMinorAt_(F, who, date) { const p = famPerson_(F, who), b = famYmd_(p && p.생년월일), d = famYmd_(date); if (!b || !d) return null; return d < famAddY_(b, 19); }
function famChildrenOf_(F, dec, at) {
  const d = famName_(F, dec), sp = famSpouseOf_(F, d), out = [];
  F.사람.forEach(function (p) {
    if (p.이름 === d || p.상속인 === false || p.상속인 === '아니오') return;
    const pa = famParentsOf_(F, p), rel = String(p.관계 || '');
    const isChild = pa.length ? (pa.indexOf(d) >= 0) : (/직계비속|자녀|아들|딸/.test(rel) && !/손|증손/.test(rel));
    if (isChild) { if (!(famYmd_(p.사망일) && (!at || famYmd_(p.사망일) <= famYmd_(at)))) out.push(p.이름); return; }
  });
  return out;
}

// 상증법 §47② — 해당 증여일 전 10년 이내 동일인(증여자가 직계존속이면 그 배우자 포함)에게서 받은 증여재산가액을 합친 금액이 1천만원 이상이면 가산.
//  §58① 가산한 증여의 산출세액(증여 당시)은 납부세액공제. 공제 사용(§53)은 수증자 기준 10년 같은 관계 묶음의 합(이 셈은 지도에 적힌 「공제사용」 값만 더한다).
//  합산배제증여재산(§47① 괄호)은 지도 줄에 「합산배제」 표시가 있으면 뺀다.
function famPriorGifts_(F, q) {
  const date = famYmd_(q.date), donee = famName_(F, q.donee), donor = famName_(F, q.donor);
  if (!date || !donee || !donor) return { 세대생략: null, list: [], 합계: 0, 기납부: 0, 공제사용: 0, 알림: ['합산을 보려면 증여일·받는 사람·주는 사람이 다 있어야 함'] };
  const rel = String(q.relation || '');
  const donors = [donor]; if (/^직계존속/.test(rel)) { const sp = famSpouseOf_(F, donor); if (sp) donors.push(sp); }
  const from = famAddY_(date, -10), notes = [];
  const sk = /^직계존속/.test(rel) ? famGenSkip_(F, donor, donee, date) : null;
  const list = famEvents_(F, date).filter(function (t) {
    if (!famIsGift_(t) || famSpecial_(t) || t.id === q.skipId || (q.caseId && t.사건id === q.caseId)) return false;
    const d = famYmd_(t.날짜); if (!d || d <= from || d > date) return false;
    if (d === date && famGiftValue_(t) === famNum_(q.amount)) return false; // 이번 증여 자신
    return famName_(F, t.받는) === donee && donors.indexOf(famName_(F, t.주는)) >= 0 && !t.합산배제;
  }).sort(function (a, b) { return famYmd_(a.날짜) < famYmd_(b.날짜) ? -1 : 1; });
  const sum = list.reduce(function (s, t) { return s + famGiftValue_(t); }, 0);
  if (list.length && sum + famNum_(q.amount) < 10000000) { notes.push('10년 합계가 1천만원 미만이라 합산하지 않음(§47②)'); return { 세대생략: sk, list: [], 합계: 0, 기납부: 0, 공제사용: 0, 알림: notes, 뺀것: list }; }
  const noTax = list.filter(function (t) { return t.산출세액 === '' || t.산출세액 == null; });
  if (noTax.length) notes.push('산출세액이 비어 기납부세액공제에 못 넣은 증여 ' + noTax.length + '건(' + noTax.map(function (t) { return famYmd_(t.날짜); }).join(', ') + ') — 그때 법으로 다시 계산해 넣을 것(§58①: 증여 당시 산출세액)');
  if (list.some(function (t) { return /무신고|모름|^아니|안 ?함/.test(String(t.신고 || '')); })) notes.push('무신고·모름인 증여가 있음 — 그 증여의 증여세·가산세도 따로 생김(국세기본법 §47의2 무신고가산세·§26의2④ 부과제척기간 15년)');
  if (donors.length > 1) notes.push('증여자가 직계존속이라 그 배우자(' + donors[1] + ')에게서 받은 것도 합산(§47② 괄호)');
  if (list.some(function (t) { return t.무상대출; })) notes.push('무상대출 이익(상증법 §41의4)을 해마다 한 번 받은 증여로 넣음 — 적정이자율 ' + list.filter(function (t) { return t.무상대출; })[0].무상대출.이자율 + '%(바뀌었으면 「빌림」 줄의 적정이자율 칸에)');
  if (sk && sk.해당) notes.push('세대생략 증여(§57①) — ' + sk.근거 + (sk.대습 ? ' · 중간 세대(자녀)가 먼저 사망해 할증 없음(§57① 괄호)' : ' · 산출세액 30%(20억 넘고 미성년이면 40%) 가산'));
  return { 세대생략: sk, list: list, 합계: sum, 기납부: list.reduce(function (s, t) { return s + famNum_(t.산출세액); }, 0), 공제사용: list.reduce(function (s, t) { return s + famNum_(t.공제사용); }, 0), 알림: notes };
}
// 상증법 §13①1·2호 — 상속개시일 전 10년 이내 상속인에게, 5년 이내 상속인 아닌 자에게 한 증여는 과세가액에 가산. §28 증여세액공제는 그 증여의 산출세액(과세표준과 함께)
function famPriorForEstate_(F, q) {
  const date = famYmd_(q.date), dec = famName_(F, q.deceased);
  if (!date || !dec) return { 상속인: [], 그밖: [], 알림: ['상속개시일·피상속인 이름이 있어야 함'] };
  const heirOf = function (n) { const p = famPerson_(F, n); if (q.heirs && q.heirs.length) return q.heirs.indexOf(n) >= 0; return p ? p.상속인 === true || p.상속인 === '예' : null; };
  const notes = [], heir = [], other = [];
  famEvents_(F, date).forEach(function (t) {
    if (!famIsGift_(t) || famName_(F, t.주는) !== dec) return;
    const d = famYmd_(t.날짜); if (!d || d > date) return;
    // [2026.11.02 #6] 조특법 특례 증여(가업승계·창업자금)는 기간과 관계없이 가산(§30의5⑨, §30의6⑤ 준용) — 그 증여세는 §28② 한도와 관계없이 공제(§30의5⑩)
    if (famSpecial_(t)) { heir.push(t); notes.push(famSpecial_(t) + ' 특례 증여(' + d + ') — 기간과 관계없이 상속세 과세가액에 가산(조특법 §30의5⑨·§30의6⑤)'); return; }
    const to = famName_(F, t.받는), h = heirOf(to);
    if (h === null) notes.push(to + '이(가) 상속인인지 지도에 없음 — 10년(상속인)으로 봄, 확인할 것');
    if (h !== false) { if (d > famAddY_(date, -10)) heir.push(t); }
    else if (d > famAddY_(date, -5)) other.push(t);
  });
  return { 상속인: heir, 그밖: other, 알림: notes };
}
// 엔진 상속 입력에 사전증여를 얹는다(장부 사전증여 칸이 비었을 때만 — 두 번 더하지 않게)
function famApplyEstatePriors_(input, pr) {
  const amt = function (t) { return famGiftValue_(t); }, sum = function (a) { return a.reduce(function (s, t) { return s + amt(t); }, 0); };
  // 특례 증여(가업승계·창업자금)는 따로: 과세가액엔 기간 없이 가산(§13①1호 적용, 조특법 §30의5⑨), §24 3호 공제한도 계산엔 넣지 않음(같은 항 뒷부분),
  //  그 증여세는 §28② 한도와 관계없이 산출세액에서 공제(§30의5⑩) → 엔진 specialGiftTaxCredit
  const sp = pr.상속인.filter(famSpecial_), h = pr.상속인.filter(function (t) { return !famSpecial_(t); }), o = pr.그밖;
  const ss = sum(sp), hs = sum(h), os = sum(o);
  if (!hs && !os && !ss) return 0;
  if (h.length) { input.priorGiftHeirs = (input.priorGiftHeirs || []).concat(h.map(function (t) { const e = { priorGiftAmount: amt(t), priorGiftTaxableBase: famNum_(t.과세표준), priorGiftTaxPaid: famNum_(t.산출세액) }; if (t.상속분) e.actualInheritedValue = famNum_(t.상속분); return e; })); }
  if (h.length || sp.length) input.giftToHeirsWithin10Years = (Number(input.giftToHeirsWithin10Years) || 0) + hs + ss;
  if (sp.length) input.specialGiftTaxCredit = (Number(input.specialGiftTaxCredit) || 0) + sp.reduce(function (s, t) { return s + famNum_(t.산출세액); }, 0);
  if (o.length) { input.nonHeirPriorGiftAmountTotal = (Number(input.nonHeirPriorGiftAmountTotal) || 0) + os; input.nonHeirPriorGiftTaxableBaseTotal = (Number(input.nonHeirPriorGiftTaxableBaseTotal) || 0) + o.reduce(function (s, t) { return s + famNum_(t.과세표준); }, 0); input.nonHeirPriorGiftTaxPaidTotal = (Number(input.nonHeirPriorGiftTaxPaidTotal) || 0) + o.reduce(function (s, t) { return s + famNum_(t.산출세액); }, 0); }
  input.priorGiftedAmountIncludedInEstate = (Number(input.priorGiftedAmountIncludedInEstate) || 0) + hs + os + ss;
  input.taxableEstateAmount = (Number(input.taxableEstateAmount) || 0) + hs + os + ss;
  return hs + os + ss;
}

// 시간줄 — 사람·이전·사건을 날짜 순으로 한 줄씩(과거 → 지금 → 앞으로 할 일). 이전마다 "그때 법" 기준일과 넘겨진 기간(합산·이월과세·제척)을 붙인다
function famTimeline_(F, today) {
  today = famYmd_(today) || '';
  const rows = [];
  F.사람.forEach(function (p) { if (famYmd_(p.생년월일)) rows.push({ 날짜: famYmd_(p.생년월일), 무엇: '출생', 누구: p.이름 }); if (famYmd_(p.사망일)) rows.push({ 날짜: famYmd_(p.사망일), 무엇: '사망(상속 개시)', 누구: p.이름, 법기준일: famYmd_(p.사망일) }); });
  F.이전.forEach(function (t) {
    const d = famYmd_(t.날짜), r = { 날짜: d || '(날짜 없음)', 무엇: t.종류 + (t.물건 ? ' — ' + t.물건 : ''), 누구: famName_(F, t.주는) + ' → ' + famName_(F, t.받는), 금액: famNum_(t.금액), 신고: t.신고 || '', id: t.id, 법기준일: d, 앞으로: [] };
    if (d && famIsGift_(t)) {
      r.앞으로.push({ 날짜: famAddY_(d, 10), 무엇: '이 증여의 10년 합산(§47②)·상속인 사전증여 가산(§13①1호) 끝' });
      if (/^(배우자|직계존속|직계비속)$/.test(t.관계 || '')) r.앞으로.push({ 날짜: famAddY_(d, d >= '2023-01-01' ? 10 : 5), 무엇: '받은 사람이 팔면 이월과세(소득세법 §97의2①, ' + (d >= '2023-01-01' ? '2023.1.1. 이후 증여 10년' : '그 전 증여 5년') + ') 끝' });
      if (/무신고|모름|^아니|안 ?함/.test(t.신고 || '')) r.앞으로.push({ 날짜: famAddY_(d, 15), 무엇: '무신고 증여 부과제척기간 15년(국세기본법 §26의2④2호 — 부과할 수 있는 날(신고기한 다음 날)부터 셈, 그날은 대략)' });
    }
    const rt = famGiftReturn_(t); if (rt.알림) { r.반환 = rt.단계; r.앞으로.push({ 날짜: famYmd_(t.반환일), 무엇: '반환 — ' + rt.알림 }); }
    if (t.종류 === '빌림' && d) r.앞으로.push({ 날짜: '', 무엇: '빌린 돈 — 이자·원금 갚은 기록이 없으면 증여 추정 다툼(상증법 §41의4 금전 무상대출 등 · 확인 필요)' });
    rows.push(r);
  });
  (F.계획 || []).slice(-1).forEach(function (pl) { (pl.이전계획 || []).forEach(function (s) { rows.push({ 날짜: famYmd_(s.해 || s.날짜), 무엇: '[계획] ' + (s.종류 || '증여'), 누구: famName_(F, s.주는) + ' → ' + famName_(F, s.받는), 금액: famNum_(s.금액), 계획: true }); }); });
  rows.sort(function (a, b) { return String(a.날짜) < String(b.날짜) ? -1 : String(a.날짜) > String(b.날짜) ? 1 : 0; });
  rows.forEach(function (r) { if (today && /^\d{4}/.test(r.날짜)) r.때 = r.계획 ? '앞으로' : r.날짜 <= today ? '지난' : '앞으로'; if (today) (r.앞으로 || []).forEach(function (a) { if (a.날짜 && a.날짜 < today) a.지남 = true; }); });
  return rows;
}

// ── 미래 설계(방향 ④) — 이전 계획표 × 사망 시점 × 재산 증가율 → 경우마다 증여세·상속세(1차·2차) 합계, 계획 없을 때와 견줌 ──
//  법은 바꾸지 않는다: 미래 날짜 계산은 엔진이 아는 가장 늦은 판(공포된 개정 포함)으로 — 법이 바뀌면 다시 돌린다(결과 맨 앞에 적음).
//  calc(name, input) = 엔진. plan = { 피상속인, 배우자, 지금: 'YYYY-MM-DD', 증가율(%), 재산: {이름: 지금 값}, 상속인수: {자녀수}, 배우자비율(0~1, 배우자가 실제 받는 몫),
//   이전계획: [{해|날짜, 주는, 받는, 금액, 관계}], 사망후년: [5,10,15], 배우자사망후년: (첫 사망 뒤 몇 년, 비우면 2차 상속 안 셈) }
function famPlanCompute_(F, plan, calc) {
  plan = plan || {};
  const now = famYmd_(plan.지금) || '2026-07-01', g = (Number(plan.증가율) || 0) / 100;
  const dec = famName_(F, plan.피상속인), sp = plan.배우자 === false ? '' : famName_(F, plan.배우자 || famSpouseOf_(F, dec));
  if (!dec) return { ok: false, error: '피상속인(plan.피상속인)이 필요합니다' };
  const base = plan.재산 || {}, estate0 = famNum_(base[dec]), sp0 = sp ? famNum_(base[sp]) : 0;
  if (!estate0) return { ok: false, error: '피상속인 지금 재산(plan.재산[\'' + dec + '\'])이 필요합니다' };
  // [2026.11.02 #7] 자녀 수 = 피상속인의 자녀(손자녀 빼고, famChildrenOf_) — 예전엔 관계 「직계비속」인 손자까지 셈
  const kidNames = famChildrenOf_(F, dec), kids = Number((plan.상속인수 || {}).자녀수 != null ? plan.상속인수.자녀수 : kidNames.length) || 0;
  const spRatio = plan.배우자비율 == null ? null : Number(plan.배우자비율);
  const yearsOf = function (d) { return (new Date(famYmd_(d)) - new Date(now)) / (365.25 * 864e5); };
  const steps = (plan.이전계획 || []).map(function (s, i) { return { i: i, 날짜: famYmd_(s.날짜 || s.해), 주는: famName_(F, s.주는), 받는: famName_(F, s.받는), 금액: famNum_(s.금액), 관계: String(s.관계 || ''), 종류: s.종류 || '증여', 특례: famSpecial_(s), 특례입력: s.특례입력 || null }; }).filter(function (s) { return s.날짜 && s.금액 > 0; });
  const bad = steps.filter(function (s) { return FAM_RELS_.indexOf(s.관계) < 0; });
  if (bad.length) return { ok: false, error: '계획 줄의 관계(받는 사람 기준 주는 사람: 배우자/직계존속/직계비속/기타친족/기타)가 비었거나 틀림: ' + bad.map(function (s) { return (s.i + 1) + '번'; }).join(', ') };
  const offs = (plan.사망후년 && plan.사망후년.length ? plan.사망후년 : [5, 10, 15]).map(Number).filter(function (n) { return n >= 0; }).slice(0, 6);
  const notes = ['미래 세율·공제는 지금 아는 가장 늦은 법(공포된 개정 포함)으로 셈 — 법이 바뀌면 다시 돌릴 것', '재산 증가율 ' + (g * 100) + '%/년(모든 재산 같게) · 증여한 재산의 그 뒤 불어난 몫은 받은 사람 것으로 봄', '증여재산은 증여 때 값으로 합산(§13①·§47②) · 시가·평가방법 차이는 셈하지 않음'];
  if ((plan.상속인수 || {}).자녀수 == null) notes.push('자녀 수 ' + kids + '명(' + (kidNames.join('·') || '없음') + ') — 1순위 상속인은 피상속인의 자녀(민법 §1000①1호), 손자녀는 대습상속(§1001)일 때만 · 다르면 plan.상속인수.자녀수로');
  if (spRatio == null && sp) notes.push('배우자가 실제 받는 몫(plan.배우자비율)이 없어 법정상속분으로 봄(민법 §1009 — 배우자 1.5 : 자녀 1)');
  const one = function (off, withPlan) {
    const death = famAddY_(now, off), T = off, out = { 사망: death, 증여: [], 증여세: 0, 상속세1: 0, 상속세2: 0 };
    const done = []; // 이번 경우에 실제로 한 계획 증여(사망 전)
    (withPlan ? steps : []).filter(function (s) { return s.날짜 < death || s.주는 !== dec; }).forEach(function (s) {
      if (s.주는 === dec && s.날짜 >= death) return;
      // 같은 증여자(직계존속이면 배우자 포함) 10년 합산 — 지도의 지난 증여 + 앞선 계획 증여
      const F2 = { 사람: F.사람, 이전: F.이전.concat(done.map(function (d) { return { id: 'plan' + d.i, 종류: '증여', 특례: d.특례, 날짜: d.날짜, 주는: d.주는, 받는: d.받는, 금액: d.금액, 산출세액: d.산출, 공제사용: d.공제 }; })) };
      let r, pr = { 합계: 0, 세대생략: null };
      if (s.특례) {
        // [2026.11.02 #6] 가업승계(조특법 §30의6)·창업자금(§30의5) 특례 증여 — 특례 세액 도구로, 다른 증여와 합산하지 않음(§30의5⑪)
        r = calc('calculate_special_rate_gift_tax', Object.assign({ specialType: s.특례 === '가업승계' ? 'business_succession' : 'startup', giftAmount: s.금액, giftDate: s.날짜 }, s.특례입력 || {})) || {};
      } else {
        pr = famPriorGifts_(F2, { date: s.날짜, donee: s.받는, donor: s.주는, relation: s.관계, amount: s.금액 });
        const inp = { giftAmount: s.금액, relation: s.관계, giftDate: s.날짜, isDoneeResident: true };
        if (pr.합계) { inp.priorGiftAmount = pr.합계; inp.priorPaidTax = pr.기납부; if (pr.공제사용) inp.priorRelationDeductionUsed = pr.공제사용; }
        // [2026.11.02 #5] 세대생략 할증(상증법 §57) — 지도의 부모·세대 칸으로 판정해 넘김
        if (pr.세대생략 && pr.세대생략.해당) { inp.isGenerationSkip = true; if (pr.세대생략.대습) inp.isSubstituteGiftDueToDeath = true; }
        if (famIsMinorAt_(F2, s.받는, s.날짜) === true) inp.isMinor = true;
        r = calc('calculate_gift_tax', inp) || {};
      }
      const 산출 = r.산출세액_할증후 != null ? r.산출세액_할증후 : (r.산출세액 || 0);
      // [2026.11.02 복잡사건 35] 특례 밖 몫(사업무관자산 몫·한도 넘는 몫, 엔진 기본세율적용대상_증여재산가액)은 일반 증여 — 따로 증여세를 매기고
      //  상속 때도 보통 사전증여(10년 안만 가산·§24 공제한도 차감·§28② 한도)로 다룬다. 예전엔 그 몫의 증여세가 빠지고 상속에선 통째 특례로 셈
      const out_ = s.특례 && !r.error ? Math.max(0, Number(r.기본세율적용대상_증여재산가액) || 0) : 0;
      let r2 = null, 산출2 = 0;
      if (out_ > 0) {
        const pr2 = famPriorGifts_(F2, { date: s.날짜, donee: s.받는, donor: s.주는, relation: s.관계 || '직계존속', amount: out_ });
        const inp2 = { giftAmount: out_, relation: s.관계 || '직계존속', giftDate: s.날짜, isDoneeResident: true };
        if (pr2.합계) { inp2.priorGiftAmount = pr2.합계; inp2.priorPaidTax = pr2.기납부; if (pr2.공제사용) inp2.priorRelationDeductionUsed = pr2.공제사용; }
        r2 = calc('calculate_gift_tax', inp2) || {};
        산출2 = r2.산출세액_할증후 != null ? r2.산출세액_할증후 : (r2.산출세액 || 0);
      }
      done.push({ i: s.i, 특례: s.특례, 날짜: s.날짜, 주는: s.주는, 받는: s.받는, 금액: s.금액 - out_, 산출: 산출, 공제: r.증여재산공제 || 0, 과세표준: r.과세표준 || 0, 관계: s.관계 });
      if (out_ > 0) done.push({ i: s.i + '밖', 특례: '', 날짜: s.날짜, 주는: s.주는, 받는: s.받는, 금액: out_, 산출: 산출2, 공제: r2.증여재산공제 || 0, 과세표준: r2.과세표준 || 0, 관계: s.관계 || '직계존속' });
      out.증여.push({ 날짜: s.날짜, 누구: s.주는 + ' → ' + s.받는, 금액: s.금액, 합산: pr.합계, 특례: s.특례 || undefined, 특례밖: out_ || undefined, 특례밖증여세: r2 ? Number(r2.납부세액) || 0 : undefined, 세대생략: pr.세대생략 && pr.세대생략.해당 ? (pr.세대생략.대습 ? '대습(할증 없음)' : '할증') : undefined, 증여세: (Number(r.납부세액) || 0) + (r2 ? Number(r2.납부세액) || 0 : 0), error: r.error || (r2 && r2.error) });
      out.증여세 += (Number(r.납부세액) || 0) + (r2 ? Number(r2.납부세액) || 0 : 0);
    });
    // 1차 상속 — 피상속인 재산을 불리고, 한 증여는 그 증여 뒤 불어날 몫까지 뺀다
    let est = estate0 * Math.pow(1 + g, T);
    done.filter(function (d) { return d.주는 === dec; }).forEach(function (d) { est -= d.금액 * Math.pow(1 + g, Math.max(0, T - yearsOf(d.날짜))); });
    done.filter(function (d) { return d.받는 === dec; }).forEach(function (d) { est += d.금액 * Math.pow(1 + g, Math.max(0, T - yearsOf(d.날짜))); });
    est = Math.max(0, Math.round(est));
    const legal = sp ? 1.5 / (1.5 + Math.max(kids, 0)) : 0, spShare = sp ? (spRatio == null ? legal : spRatio) : 0;
    const inh = { taxableEstateAmount: est, hasSpouse: !!sp, childCount: kids, inheritanceDate: death, isDecedentResident: true, netFinancialAssets: 0 };
    if (sp) { inh.spouseActualInheritedAmount = Math.round(est * spShare); inh.spouseLegalShareRatio = legal; }
    const Fd = { 사람: F.사람, 이전: F.이전.concat(done.map(function (d) { return { id: 'plan' + d.i, 종류: '증여', 특례: d.특례, 날짜: d.날짜, 주는: d.주는, 받는: d.받는, 금액: d.금액, 과세표준: d.과세표준, 산출세액: d.산출 }; })) };
    const pe = famPriorForEstate_(Fd, { date: death, deceased: dec });
    out.사전증여가산 = famApplyEstatePriors_(inh, pe);
    const r1 = calc('calculate_inheritance_tax', inh) || {};
    out.상속재산 = est; out.상속세1 = Number(r1.납부세액) || 0; out.상속1과세표준 = r1.과세표준; if (r1.error) out.error = r1.error;
    // 2차 상속(배우자) — 배우자 재산 + 1차에서 받은 몫(세후 몫으로 근사) 을 불려서. 단기재상속 세액공제(§30)는 엔진에 넘김
    if (sp && plan.배우자사망후년 != null && plan.배우자사망후년 !== '') {
      const off2 = Number(plan.배우자사망후년) || 0, death2 = famAddY_(death, off2), T2 = T + off2;
      const got = inh.spouseActualInheritedAmount || 0, tax1Share = est ? out.상속세1 * (got / est) : 0;
      let est2 = sp0 * Math.pow(1 + g, T2) + Math.max(0, got - tax1Share) * Math.pow(1 + g, off2);
      done.filter(function (d) { return d.주는 === sp; }).forEach(function (d) { est2 -= d.금액 * Math.pow(1 + g, Math.max(0, T2 - yearsOf(d.날짜))); });
      est2 = Math.max(0, Math.round(est2));
      const inh2 = { taxableEstateAmount: est2, hasSpouse: false, childCount: kids, inheritanceDate: death2, isDecedentResident: true, netFinancialAssets: 0 };
      if (off2 < 10 && got > 0) Object.assign(inh2, { priorInheritanceDate: death, priorInheritanceTax: out.상속세1, priorInheritanceTaxableBase: Number(r1.과세표준) || 0, priorInheritanceTotalPropertyValue: est, reinheritedPropertyValue: got, yearsSincePriorInheritance: off2 });
      famApplyEstatePriors_(inh2, famPriorForEstate_(Fd, { date: death2, deceased: sp }));
      const r2 = calc('calculate_inheritance_tax', inh2) || {};
      out.배우자사망 = death2; out.상속재산2 = est2; out.상속세2 = Number(r2.납부세액) || 0; if (r2.error) out.error = (out.error ? out.error + ' / ' : '') + r2.error;
    }
    out.합계 = out.증여세 + out.상속세1 + out.상속세2;
    return out;
  };
  const rows = offs.map(function (off) { const a = one(off, true), b = one(off, false); return { 사망후년: off, 계획대로: a, 계획없이: b, 차이: b.합계 - a.합계 }; });
  return { ok: true, 피상속인: dec, 배우자: sp, 지금: now, 증가율: g * 100, 이전계획: steps, 경우: rows, 알림: notes };
}
function famPlanLines_(r) {
  const out = ['미래 설계 — 피상속인 ' + r.피상속인 + (r.배우자 ? ' · 배우자 ' + r.배우자 : '') + ' · 지금 ' + r.지금 + ' · 재산 증가율 ' + r.증가율 + '%'];
  r.경우.forEach(function (x) {
    const a = x.계획대로, b = x.계획없이;
    out.push(x.사망후년 + '년 뒤 사망(' + a.사망 + ') — 계획대로 ' + famWon_(a.합계) + '(증여세 ' + famWon_(a.증여세) + ' · 상속세 ' + famWon_(a.상속세1) + (a.배우자사망 ? ' · 2차 ' + famWon_(a.상속세2) : '') + ') / 계획 없이 ' + famWon_(b.합계) + ' → ' + (x.차이 >= 0 ? '줄어듦 ' : '늘어남 ') + famWon_(Math.abs(x.차이)));
  });
  return out.concat(r.알림.map(function (n) { return '· ' + n; }));
}

// ── 잇기 계산(방향 ③) — 지도의 지난 증여·상속 한 건 → 그 물건을 판 양도 ──
//  증여 받은 것: 배우자·직계존비속이면 이월과세(소득세법 §97의2 — 엔진 calculate_transfer_tax_with_carryover가 적용·미적용 중 큰 세액, §97의2②3호)
//   그 밖 특수관계인이면 우회양도 부인(§101②: 수증자 증여세+양도세 < 증여자가 직접 판 양도세면 증여자가 판 것으로, 그때 증여세는 안 매김 §101③)
//  상속 받은 것: 취득가액 = 상속개시일 현재 평가액(소득세법 시행령 §163⑨), 취득일 = 상속개시일 — 보통 양도 계산으로
// 양도 칸은 한글(양도가액·양도일·필요경비) · 계산기 이름(transferPrice·transferDate·necessaryExpenses) 둘 다 받는다
function famSaleNorm_(sale) { sale = Object.assign({}, sale || {}); if (sale.양도가액 == null && sale.transferPrice != null) sale.양도가액 = sale.transferPrice; if (sale.양도일 == null && sale.transferDate != null) sale.양도일 = sale.transferDate; if (sale.필요경비 == null && sale.necessaryExpenses != null) sale.필요경비 = sale.necessaryExpenses;
  // 화면 한글 칸 → 엔진 칸(입주권·겸용주택)
  [['권리가액', 'rightsValue'], ['청산금', 'settlementPaid'], ['관리처분인가일', 'managementDispositionDate'], ['종전자산취득가액', 'originalAssetAcquisitionPrice'], ['주택연면적', 'mixedUseHouseArea'], ['주택외연면적', 'mixedUseOtherArea']].forEach(function (k) { if (sale[k[1]] == null && sale[k[0]] != null && sale[k[0]] !== '') sale[k[1]] = k[1] === 'managementDispositionDate' ? famYmd_(sale[k[0]]) : famNum_(sale[k[0]]); });
  return sale; }
function famChainInputs_(F, t, sale) {
  sale = famSaleNorm_(sale);
  const price = famNum_(sale.양도가액), date = famYmd_(sale.양도일);
  if (!price || !date) return { error: '양도가액·양도일(sale.양도가액·sale.양도일)이 필요합니다' };
  const kindText = String(sale.assetType || sale.종류 || t.물건종류 || t.물건 || ''), allText = [sale.assetType, sale.종류, t.물건종류, t.물건].filter(Boolean).join(' ');
  // [2026.11.02 복잡물건 점검 #3] 조합원입주권 — 엔진은 주택(house) + isReconstructionRights로 셈(소득세법 시행령 §166). 예전엔 「기타」로 넘어감
  const isRights = /입주권|union_right|reconstruction/i.test(allText) || sale.isReconstructionRights === true;
  const asset = isRights || /house|주택|아파트/.test(kindText) ? 'house' : /분양권|presale/.test(kindText) ? 'presale_right' : 'other';
  const common = { transferPrice: price, transferDate: date, assetType: asset, necessaryExpenses: famNum_(sale.필요경비) };
  ['isOneHouseOneFamily', 'residenceYears', 'multiHouseCount', 'isAdjustedArea', 'isNonBusinessLand', 'mixedUseHouseArea', 'mixedUseOtherArea', 'mixedUseHouseStdPrice', 'mixedUseOtherStdPrice',
    'rightsValue', 'settlementPaid', 'managementDispositionDate', 'isOriginalMember', 'isCompletedNewHousing', 'originalAssetAcquisitionPrice', 'originalNecessaryExpenses', 'useConvertedRightsBaseAcquisitionPrice', 'originalAcquisitionStandardPrice', 'approvalDateStandardPrice',
    'sect133PriorFarm', 'sect133PriorSect70', 'sect133PriorComp', 'sect133PriorWide', 'sect133SameBuyerPriorReduction'].forEach(function (k) { if (sale[k] !== undefined) common[k] = sale[k]; });
  const notes = [];
  if (isRights) {
    common.isReconstructionRights = true;
    const miss = ['rightsValue', 'managementDispositionDate'].filter(function (k) { return !sale[k]; });
    if (miss.length) notes.push('입주권 계산 칸이 비었음: ' + miss.map(function (k) { return k === 'rightsValue' ? '권리가액(종전자산평가액)' : '관리처분계획인가일'; }).join('·') + ' — 관리처분계획서로 채울 것(시행령 §166①)');
  }
  // [2026.11.02 #8] 감면 5개 과세기간 한도(조특법 §133①2호) — 지도에 같은 사람이 직전 4개 과세기간에 「양도」하며 받은 감면세액(감면세액·감면 칸)을 엔진 칸으로
  const seller = famName_(F, t.받는), yr = Number(date.slice(0, 4));
  if (!['sect133PriorFarm', 'sect133PriorSect70', 'sect133PriorComp'].some(function (k) { return sale[k] !== undefined; })) {
    const pri = { sect133PriorFarm: 0, sect133PriorSect70: 0, sect133PriorComp: 0 }, used = [];
    F.이전.forEach(function (x) {
      if (x.종류 !== '양도' || famName_(F, x.주는) !== seller || !famNum_(x.감면세액)) return;
      const y = Number(famYmd_(x.날짜).slice(0, 4)); if (!(y >= yr - 4 && y <= yr - 1)) return;
      const k = String(x.감면 || x.감면종류 || '');
      if (/§?70|대토/.test(k)) { pri.sect133PriorSect70 += famNum_(x.감면세액); pri.sect133PriorFarm += famNum_(x.감면세액); }
      else if (/§?6[6-9]|자경|축사|어업|농지/.test(k)) pri.sect133PriorFarm += famNum_(x.감면세액);
      else if (/§?77|수용|공익/.test(k)) pri.sect133PriorComp += famNum_(x.감면세액);
      else { notes.push('지도의 ' + famYmd_(x.날짜) + ' 양도 감면세액 ' + famWon_(famNum_(x.감면세액)) + '은 감면 종류(감면 칸)가 없어 한도 계산에 못 넣음'); return; }
      used.push(famYmd_(x.날짜) + ' ' + (x.물건 || '') + ' ' + k + ' ' + famWon_(famNum_(x.감면세액)));
    });
    Object.keys(pri).forEach(function (k) { if (pri[k]) common[k] = pri[k]; });
    if (used.length) notes.push('직전 4개 과세기간 감면세액을 5개 과세기간 한도(조특법 §133①2호)에 넣음: ' + used.join(' · '));
  }
  if (t.종류 === '상속') {
    if (!famNum_(t.금액)) return { error: '상속 줄에 상속개시일 현재 평가액(금액)이 없습니다' };
    return { tool: 'calculate_transfer_tax_multi', input: { transactions: [Object.assign({}, common, { acquisitionDate: famYmd_(t.날짜), acquisitionPrice: famNum_(t.금액), acquisitionCause: 'inheritance' })] }, 알림: notes, 법: '상속받은 자산 — 취득가액은 상속개시일 현재 평가액(소득세법 시행령 §163⑨)·취득일은 상속개시일(시행령 §162①5호)' };
  }
  // [2026.11.02 복잡사건 「한씨 부자 매매」] 가족에게 싸게 산 집(매매 줄) — 취득가액 = 실제 낸 값 + 과세받은 증여재산가액(소득세법 시행령 §163⑩1호, 상증법 §35)
  if (t.종류 === '매매') {
    const paid = famNum_(t.금액); if (!paid) return { error: '매매 줄에 실제 낸 값(금액)이 없습니다' };
    let gift = famNum_(t.증여재산가액 || t.증여의제이익);
    if (!gift && famNum_(t.시가) > paid && typeof toolCalculateLowPriceTransferGiftAmount !== 'function') notes.push('증여재산가액 칸이 비어 취득가액에 못 더함 — 상증법 §35 계산(calculate_low_price_transfer_gift_amount)으로 세어 칸에 넣을 것');
    else if (!gift && famNum_(t.시가) > paid) {
      const lg = toolCalculateLowPriceTransferGiftAmount({ fairMarketValue: famNum_(t.시가), transferPrice: paid, isSpecialRelation: t.특수관계 !== '아니오' });
      gift = lg && lg.과세대상여부 ? famNum_(lg.증여재산가액) : 0;
      if (gift) notes.push('지도에 증여재산가액이 없어 시가 ' + famWon_(famNum_(t.시가)) + '·낸 값으로 상증법 §35 계산 ' + famWon_(gift) + ' — 실제로 증여세를 과세받았는지(신고·결정) 확인할 것');
      if (!gift) notes.push('시가보다 싸게 샀지만 증여재산가액이 0 — §35 기준(시가 30%·3억 중 적은 금액) 아래면 더할 것 없음');
    }
    const acq = paid + gift;
    return { tool: 'calculate_transfer_tax_multi', input: { transactions: [Object.assign({}, common, { acquisitionDate: famYmd_(t.날짜), acquisitionPrice: acq })] }, 알림: notes,
      법: '매매로 산 자산 — 취득가액 = 실제 낸 값 ' + famWon_(paid) + (gift ? ' + 과세받은 증여재산가액 ' + famWon_(gift) + '(소득세법 시행령 §163⑩1호)' : '') + ' · 취득일 = 매매일(시행령 §162 — 대금청산일과 등기접수일 중 빠른 날, 지도 날짜가 그 날인지 확인할 것)' };
  }
  // [2026.11.02 복잡사건 「배씨 이혼」] 이혼 재산분할(민법 §839의2)로 받은 자산 — 양도·증여가 아니라 공동재산을 나눈 것이므로 받은 사람이 팔 때
  //  취득일·취득가액은 전 배우자가 당초 취득한 날·값([확인 필요] 조문 없음 — 판례·소득세 집행기준 기준, 번호 확인). 위자료로 넘긴 것은 넘긴 사람의 「양도」 줄로 적는다
  if (t.종류 === '재산분할') {
    const gaps = []; if (!famYmd_(t.주는이취득일)) gaps.push('주는이취득일'); if (!famNum_(t.주는이취득가액)) gaps.push('주는이취득가액');
    if (gaps.length) return { error: '재산분할 줄에 전 배우자 당초 ' + gaps.map(function (k) { return k === '주는이취득일' ? '취득일(주는이취득일)' : '취득가액(주는이취득가액)'; }).join('·') + '이 없습니다 — 등기부·당초 매매계약서로 채울 것', gaps: gaps };
    notes.push('[확인 필요] 재산분할 자산의 취득일·취득가액을 전 배우자 당초 것으로 잇는 근거는 조문이 아닌 판례·집행기준 — 위자료·채무 대신 넘긴 부분이 섞였으면 그 부분은 넘긴 사람의 양도(대물변제)이고 받은 사람은 그날 그 값에 산 것');
    if (/house|주택|아파트/.test(kindText)) notes.push('1세대1주택 보유·거주기간 — 전 배우자 보유기간을 이어 세는지는 [확인 필요](집행기준) · 이혼한 뒤엔 각자 1세대(시행령 §152의3 2호), 다만 사실상 이혼으로 보기 어려우면 배우자로 봄(소득세법 §88 6호 괄호)');
    return { tool: 'calculate_transfer_tax_multi', input: { transactions: [Object.assign({}, common, { acquisitionDate: famYmd_(t.주는이취득일), acquisitionPrice: famNum_(t.주는이취득가액), necessaryExpenses: famNum_(common.necessaryExpenses) + famNum_(t.주는이필요경비) })] }, 알림: notes,
      법: '이혼 재산분할로 받은 자산 — 취득일 ' + famYmd_(t.주는이취득일) + '·취득가액 ' + famWon_(famNum_(t.주는이취득가액)) + '(전 배우자 당초 것, [확인 필요] 판례·집행기준) · 분할일 ' + famYmd_(t.날짜) + '은 취득일이 아님' };
  }
  if (famGiftReturn_(t).없던것) return { error: '이 증여는 신고기한 안에 돌려줘 처음부터 없던 것(상증법 §4④) — 준 사람의 당초 취득으로 잇기 없이 계산할 것' };
  if (!famIsGift_(t)) return { error: '잇기 계산은 증여·부담부증여·상속·매매·재산분할 줄만 합니다(지금 줄: ' + t.종류 + ')' };
  const rel = String(t.관계 || '');
  const g = famGiftValue_(t);
  if (!g) return { error: '증여 줄에 증여 당시 평가액(금액)이 없습니다' };
  // [2026.11.02 #2] 부담부증여 — 받은 사람의 취득가액은 채무 부분까지 증여일 현재 평가액(시행령 §163⑨ 괄호 "부담부증여의 채무액에 해당하는 부분도 포함")
  const full = t.종류 === '부담부증여' ? famNum_(t.금액) : g, debt = t.종류 === '부담부증여' ? famDebt_(t) : 0;
  if (t.종류 === '부담부증여' && !debt) notes.push('부담부증여인데 인수 채무(채무인수 칸)가 0 — 채무 금액을 넣을 것');
  if (/^(배우자|직계존속|직계비속)$/.test(rel)) {
    const inp = Object.assign({}, common, { giftReceivedDate: famYmd_(t.날짜), donorRelation: rel === '배우자' ? 'spouse' : 'lineal', doneeOwnAcquisitionPrice: full, giftTaxableValue: famNum_(t.과세가액) || g, giftTaxPaid: famNum_(t.산출세액) });
    if (t.주는이취득가액) inp.donorAcquisitionPrice = famNum_(t.주는이취득가액);
    if (t.주는이취득일) inp.donorAcquisitionDate = famYmd_(t.주는이취득일);
    if (t.주는이필요경비) inp.donorNecessaryExpenses = famNum_(t.주는이필요경비);
    const dp = famPerson_(F, t.주는); if (dp && famYmd_(dp.사망일)) inp.donorDeathDate = famYmd_(dp.사망일);
    const gaps = []; if (!inp.donorAcquisitionPrice) gaps.push('주는이취득가액'); if (!inp.donorAcquisitionDate) gaps.push('주는이취득일');
    const law = '배우자·직계존비속에게 받은 자산 — 이월과세(소득세법 §97의2①, ' + (famYmd_(t.날짜) >= '2023-01-01' ? '증여일부터 10년' : '2022.12.31. 이전 증여는 5년') + ' 이내 양도) · 적용 세액이 미적용보다 적으면 적용 안 함(§97의2②3호)';
    if (debt > 0 && full > 0) {
      // 이월과세가 채무 부분에도 미치는지 §97의2① 문언에 없음 → [확인 필요] 두 경우를 다 셈:
      //  가) 증여 부분만 이월과세 — 채무 부분은 증여일에 평가액(=채무액)으로 산 것으로 보고 따로(한 해 두 거래로 합산)
      //  나) 전체 이월과세 — 받은 사람 취득가액 = 증여일 평가액 전체
      const r = g / full, cut = function (v, k) { return Math.round((Number(v) || 0) * (k ? r : 1 - r)); };
      const giftPart = Object.assign({}, inp, { transferPrice: cut(price, true), necessaryExpenses: cut(common.necessaryExpenses, true), doneeOwnAcquisitionPrice: g });
      if (inp.donorAcquisitionPrice) giftPart.donorAcquisitionPrice = cut(inp.donorAcquisitionPrice, true);
      if (inp.donorNecessaryExpenses) giftPart.donorNecessaryExpenses = cut(inp.donorNecessaryExpenses, true);
      const debtPart = Object.assign({}, common, { transferPrice: price - giftPart.transferPrice, necessaryExpenses: famNum_(common.necessaryExpenses) - giftPart.necessaryExpenses, acquisitionDate: famYmd_(t.날짜), acquisitionPrice: full - g, acquisitionCause: 'purchase' });
      notes.push('[확인 필요] 부담부증여 채무 부분에도 이월과세(§97의2①)가 미치는지 조문에 적혀 있지 않음 — 가) 증여 부분만 이월과세·채무 부분은 증여일 평가액 취득 / 나) 전체 이월과세, 두 경우를 다 셈(큰 쪽을 경우(안) 세액으로)');
      return { tool: 'burdened_two_ways', 가: { transactions: [giftPart, debtPart] }, 나: inp, gaps: gaps, 알림: notes, 법: law + ' · 부담부증여 받은 사람 취득가액 = 증여일 평가액(채무 부분 포함, 시행령 §163⑨)' };
    }
    return { tool: 'calculate_transfer_tax_with_carryover', input: inp, gaps: gaps, 알림: notes, 법: law };
  }
  return { tool: 'bypass', 알림: notes, 수증자: Object.assign({}, common, { acquisitionDate: famYmd_(t.날짜), acquisitionPrice: full, acquisitionCause: 'gift' }), 증여자: t.주는이취득가액 && t.주는이취득일 ? Object.assign({}, common, { acquisitionDate: famYmd_(t.주는이취득일), acquisitionPrice: famNum_(t.주는이취득가액), necessaryExpenses: famNum_(common.necessaryExpenses) + famNum_(t.주는이필요경비) }) : null,
    giftDate: famYmd_(t.날짜), 증여세: famNum_(t.납부세액 || t.산출세액), 법: '특수관계인(배우자·직계존비속 아님)에게 증여 뒤 ' + (famYmd_(t.날짜) >= '2023-01-01' ? '10년' : '5년') + ' 이내 양도 — 우회양도 부인(소득세법 §101②, 양도소득이 수증자에게 실질 귀속되면 제외 §101②단서)' };
}

// ── 넥스·화면 도구(드라이브를 쓰는 길) ──
function famCases_(c) {
  try { const all = (typeof work_getCases === 'function' ? work_getCases() : null) || []; const list = Array.isArray(all) ? all : (all.cases || []);
    return list.filter(function (x) { return x && x.id !== c.id && ((c.고객ID && x.고객ID === c.고객ID) || (!c.고객ID && c.고객명 && x.고객명 === c.고객명)); }).slice(0, 40).map(function (x) { return { id: x.id, 사건명: x.사건명 || '', 세목: x.세목 || '', 기준일: x.기준일 || '', 상태: x.상태 || '' }; });
  } catch (e) { return []; }
}
function famView_(c) {
  const key = famKeyOf_(c), F = famLoad_(key);
  const today = typeof caseProcToday_ === 'function' ? caseProcToday_() : '';
  // 증여 줄마다 그 증여를 할 때 합산될 지난 증여(§47②)를 미리 붙여 보인다
  const gifts = F.이전.filter(famIsGift_).map(function (t) { const pr = famPriorGifts_(F, { date: t.날짜, donee: t.받는, donor: t.주는, relation: t.관계, amount: famGiftValue_(t), skipId: t.id }); return { id: t.id, 날짜: famYmd_(t.날짜), 누구: famName_(F, t.주는) + ' → ' + famName_(F, t.받는), 합산될지난증여: pr.합계, 건: pr.list.map(function (x) { return famYmd_(x.날짜) + ' ' + famWon_(famGiftValue_(x)); }), 알림: pr.알림 }; }).filter(function (x) { return x.합산될지난증여 || x.알림.length; });
  const gaps = [];
  F.이전.forEach(function (t) { const miss = []; if (!famYmd_(t.날짜)) miss.push('날짜'); if (!famNum_(t.금액) && t.종류 !== '그밖') miss.push('금액'); if (famIsGift_(t) && !t.관계) miss.push('관계'); if (famIsGift_(t) && (t.산출세액 === '' || t.산출세액 == null) && !/무신고/.test(t.신고 || '')) miss.push('산출세액(신고서)'); if (miss.length) gaps.push({ id: t.id, 무엇: t.종류 + ' ' + famName_(F, t.주는) + '→' + famName_(F, t.받는), 빈칸: miss }); });
  return { ok: true, 가족: key, 사람: F.사람, 이전: F.이전.slice().sort(function (a, b) { return famYmd_(a.날짜) < famYmd_(b.날짜) ? -1 : 1; }), 시간줄: famTimeline_(F, today), 합산: gifts, 빈칸: gaps, 계획: (F.계획 || []).slice(-5), 같은고객사건: famCases_(c), 때: F.at || '', 기록: F.log.slice(-15) };
}
function famLog_(F, by, what, detail) { F.log.push({ at: caseProcNow_(), by: String(by || '').slice(0, 6), what: what, detail: String(detail || '').slice(0, 240) }); }
function famPersonSet_(c, input, by) {
  const p = Object.assign({}, input.person || input.사람 || input.f || {}); if (input.id && !p.id) p.id = input.id; // 넥스 do=person{f,id} · 화면 {person}
  const name = String(p.이름 || p.name || '').trim(); if (!name && !p.id) return { ok: false, error: 'person.이름이 필요합니다' };
  return famMutate_(famKeyOf_(c), function (F) {
    let row = p.id ? F.사람.filter(function (x) { return x.id === p.id; })[0] : F.사람.filter(function (x) { return x.이름 === name; })[0];
    const isNew = !row; if (!row) { row = { id: 'p' + Date.now().toString(36) + F.사람.length }; F.사람.push(row); }
    ['이름', '관계', '생년월일', '사망일', '상속인', '배우자', '부모', '세대', '주소', '메모', '출처'].forEach(function (k) { if (p[k] !== undefined) row[k] = typeof p[k] === 'string' ? p[k].trim().slice(0, 200) : p[k]; });
    if (name) row.이름 = name; row.누가 = String(by || '').slice(0, 6); row.때 = caseProcNow_();
    famLog_(F, by, isNew ? '사람 더함' : '사람 고침', row.이름 + (row.관계 ? '(' + row.관계 + ')' : ''));
    return { ok: true, id: row.id, 사람: row, message: (isNew ? '가족 지도에 사람 더함: ' : '사람 고침: ') + row.이름 };
  });
}
function famTransferSet_(c, input, by) {
  const t = Object.assign({}, input.transfer || input.이전 || input.f || {}); if (input.id && !t.id) t.id = input.id; // 넥스 do=transfer{f,id} · 화면 {transfer}
  if ((t.채무인수 == null || t.채무인수 === '') && (t.채무 != null || t.인수채무 != null)) t.채무인수 = t.채무 != null ? t.채무 : t.인수채무; // #12 칸 이름 맞춤
  if (!t.id && FAM_KINDS_.indexOf(String(t.종류 || '')) < 0) return { ok: false, error: 'transfer.종류는 ' + FAM_KINDS_.join('·') + ' 중 하나' };
  if (t.관계 && FAM_RELS_.indexOf(String(t.관계)) < 0) return { ok: false, error: 'transfer.관계(받는 사람 기준 주는 사람)는 ' + FAM_RELS_.join('·') + ' 중 하나' };
  return famMutate_(famKeyOf_(c), function (F) {
    let row = t.id ? F.이전.filter(function (x) { return x.id === t.id; })[0] : null;
    if (t.id && !row) return { ok: false, error: '그 이전 줄이 없음: ' + t.id };
    const isNew = !row; if (!row) { row = { id: 't' + Date.now().toString(36) + F.이전.length }; F.이전.push(row); }
    ['종류', '날짜', '주는', '받는', '관계', '물건', '물건종류', '금액', '평가', '채무인수', '과세가액', '과세표준', '산출세액', '납부세액', '공제사용', '신고', '합산배제', '상속분', '주는이취득가액', '주는이취득일', '주는이필요경비', '특례', '특례밖금액', '특례밖과세표준', '특례밖산출세액', '특례밖공제사용', '이자', '적정이자율', '상환일', '무상', '감면세액', '감면', '시가', '증여재산가액', '특수관계', '반환일', '결정일', '사건id', '근거', '메모'].forEach(function (k) { if (t[k] !== undefined) row[k] = typeof t[k] === 'string' ? t[k].trim().slice(0, 300) : t[k]; });
    if (row.날짜) row.날짜 = famYmd_(row.날짜) || row.날짜;
    row.누가 = String(by || '').slice(0, 6); row.때 = caseProcNow_(); if (!row.근거) row.근거 = '근거 없음 — 잠정(서류로 확인할 것)';
    // 사람이 지도에 없으면 이름만으로 더한다(관계는 비움 — 넥스·세무사님이 채움)
    [row.주는, row.받는].forEach(function (n) { if (n && !famPerson_(F, n)) F.사람.push({ id: 'p' + Date.now().toString(36) + F.사람.length, 이름: String(n).trim(), 누가: row.누가, 때: row.때, 출처: '이전 줄에서 이름만' }); });
    famLog_(F, by, isNew ? '이전 더함' : '이전 고침', row.종류 + ' ' + row.날짜 + ' ' + famName_(F, row.주는) + '→' + famName_(F, row.받는) + ' ' + famWon_(famNum_(row.금액)));
    const pr = famIsGift_(row) ? famPriorGifts_(F, { date: row.날짜, donee: row.받는, donor: row.주는, relation: row.관계, amount: famGiftValue_(row), skipId: row.id }) : null;
    return { ok: true, id: row.id, 이전: row, 합산될지난증여: pr ? { 합계: pr.합계, 건수: pr.list.length, 알림: pr.알림 } : undefined, message: (isNew ? '가족 지도에 ' : '고침: ') + row.종류 + ' ' + (row.날짜 || '') + ' ' + famWon_(famNum_(row.금액)) };
  });
}
function famDrop_(c, input, by) {
  const id = String(input.id || '').trim(); if (!id) return { ok: false, error: 'id(사람 p… 또는 이전 t…)가 필요합니다' };
  return famMutate_(famKeyOf_(c), function (F) {
    const before = F.사람.length + F.이전.length;
    F.사람 = F.사람.filter(function (x) { return x.id !== id; }); F.이전 = F.이전.filter(function (x) { return x.id !== id; });
    if (before === F.사람.length + F.이전.length) return { ok: false, error: '그 줄이 없음: ' + id };
    famLog_(F, by, '지움', id); return { ok: true, message: '지움: ' + id };
  });
}
// 잇기 계산 실행 — 결과는 이 사건의 경우(안) 저장본으로(검토서가 인용)
function famChainRun_(c, input, by) {
  const F = famLoad_(famKeyOf_(c), true), t = F.이전.filter(function (x) { return x.id === String(input.from || ''); })[0];
  if (!t) return { ok: false, error: '가족 지도에 그 이전 줄이 없음: ' + (input.from || '(from 없음)') + ' — case_ledger do=family로 id를 보세요' };
  input = Object.assign({}, input, { sale: famSaleNorm_(input.sale) });
  const b = famChainInputs_(F, t, input.sale);
  if (b.error) return { ok: false, error: b.error };
  const lines = [b.법].concat(b.알림 || []), won = famWon_;
  let tax = 0, saved = null;
  if (b.tool === 'burdened_two_ways') {
    if (b.gaps && b.gaps.length) return { ok: false, error: '이월과세 잇기 계산엔 주는 사람의 취득가액·취득일이 필요합니다(지금 빈 칸: ' + b.gaps.join('·') + ')' };
    const ra = runUiEngineCalcTool_('calculate_transfer_tax_multi', b.가) || {}, rb = runUiEngineCalcTool_('calculate_transfer_tax_with_carryover', b.나) || {};
    if (ra.error || rb.error) return { ok: false, error: '계산 실패: ' + (ra.error || rb.error) };
    const ta = Number(ra.납부세액_합계 != null ? ra.납부세액_합계 : ra.산출세액_합계) || 0, tb = Number(rb.납부세액 != null ? rb.납부세액 : rb.납부세액_합계) || 0;
    lines.push('가) 증여 부분만 이월과세 + 채무 부분 따로(합산) 납부세액 ' + won(ta));
    lines.push('나) 전체 이월과세 납부세액 ' + won(tb) + (rb.이월과세_적용여부 !== undefined ? ' (이월과세 ' + (rb.이월과세_적용여부 ? '적용' : '적용 안 함') + ')' : ''));
    tax = Math.max(ta, tb);
    lines.push('경우(안) 세액은 큰 쪽 ' + won(tax) + ' — 어느 쪽이 맞는지 [확인 필요]');
    saved = { inputs: { 가: b.가, 나: b.나 }, result: { 납부세액: tax, 가: ta, 나: tb } };
  } else if (b.tool === 'bypass') {
    const r1 = runUiEngineCalcTool_('calculate_transfer_tax_multi', { transactions: [b.수증자] }) || {};
    const doneeT = Number(r1.결정세액_합계 != null ? r1.결정세액_합계 : r1.산출세액_합계) || 0;
    lines.push('수증자가 판 양도세(산출 기준) ' + won(doneeT) + ' + 그 증여세 ' + won(b.증여세));
    if (!b.증여자) { lines.push('⚠ 증여자의 취득가액·취득일(주는이취득가액·주는이취득일)이 지도에 없어 증여자 직접 양도 세액을 못 셈 — 지도에 넣고 다시'); tax = doneeT; }
    else {
      const r2 = runUiEngineCalcTool_('calculate_transfer_tax_multi', { transactions: [b.증여자] }) || {};
      const donorT = Number(r2.결정세액_합계 != null ? r2.결정세액_합계 : r2.산출세액_합계) || 0;
      const eng = getUiCalcEngine_(), yrs = (new Date(b.수증자.transferDate) - new Date(b.giftDate)) / (365.25 * 864e5);
      const d = eng && typeof eng.calculateDonorDirectTransferDeemedJS === 'function' ? eng.calculateDonorDirectTransferDeemedJS({ yearsSinceGift: yrs, giftReceivedDate: b.giftDate, transferDate: b.수증자.transferDate, doneeGiftTax: b.증여세, doneeTransferTax: doneeT, donorDirectTransferTax: donorT, isGainActuallyAttributedToDonee: !!(input.sale || {}).수증자귀속 }) : null;
      lines.push('증여자가 직접 판 것으로 본 양도세 ' + won(donorT));
      lines.push(d ? (d.적용여부 ? '→ 부인 적용: 증여자에게 양도세, 당초 증여세는 안 매김(§101③)' : '→ 부인 안 함: ' + (d.안내 || '')) : '(엔진에 우회양도 판정 셈이 없음)');
      tax = d && d.적용여부 ? donorT : doneeT + b.증여세;
    }
  } else {
    if (b.tool === 'calculate_transfer_tax_with_carryover' && b.gaps && b.gaps.length) return { ok: false, error: '이월과세 잇기 계산엔 주는 사람의 취득가액·취득일이 필요합니다(지금 빈 칸: ' + b.gaps.join('·') + ') — 이전 줄에 넣고 다시 하세요. 모르면 주는 사람의 취득 서류를 받을 것으로 올리고 여쭙니다(지어 넣지 않음)', 빈칸: b.gaps };
    const r = runUiEngineCalcTool_(b.tool, b.input);
    if (!r || r.error) return { ok: false, error: '계산 실패: ' + ((r && r.error) || '엔진 없음') };
    tax = Number(r.납부세액 != null ? r.납부세액 : r.납부세액_합계 != null ? r.납부세액_합계 : r.산출세액_합계) || 0;
    if (r.이월과세_적용여부 !== undefined) lines.push('이월과세 ' + (r.이월과세_적용여부 ? '적용' : '적용 안 함') + (r.이월과세_판정 || r.안내 ? ' — ' + String(r.이월과세_판정 || r.안내).slice(0, 200) : ''));
    lines.push('납부세액 ' + won(tax));
    (b.gaps || []).forEach(function (k) { lines.push('⚠ 지도에 ' + k + '이(가) 없어 이월과세 적용 쪽을 셈하지 못했을 수 있음 — 주는 사람의 취득 서류로 채울 것'); });
    saved = { inputs: b.input, result: { 납부세액: tax } };
  }
  const name = String(input.name || ('잇기 — ' + t.종류 + ' ' + famYmd_(t.날짜) + ' → 양도 ' + famYmd_((input.sale || {}).양도일))).slice(0, 60);
  const entry = { id: 'tc_' + Date.now(), 세목: '양도소득세', 구분: '경우(안) 잇기 계산', 요약: ['[경우(안)] ' + name].concat(lines).join('\n'), 최종세액: tax, 계산일: caseProcToday_(), 기준일스냅샷: famYmd_((input.sale || {}).양도일),
    저장값: Object.assign({ ledger: true, chain: { from: t.id, 종류: t.종류 } }, saved || {}), 안: { 이름: name, 세목: 'transfer', 바꾼칸: [], 누가: String(by || '넥스').slice(0, 6), 때: caseProcNow_(), 바탕: '가족 지도 이전 ' + t.id, 바탕저장본id: '', 이유: String(input.why || '').slice(0, 200) } };
  const up = work_updateCase({ id: c.id, 세액계산결과추가: entry });
  if (!up || up.success === false) return { ok: false, error: '저장 실패: ' + ((up && up.message) || '') };
  famMutate_(famKeyOf_(c), function (F2) { famLog_(F2, by, '잇기 계산', t.id + ' → ' + entry.id + ' ' + won(tax)); });
  return { ok: true, id: entry.id, 최종세액: tax, 요약: lines, message: '잇기 계산 저장(' + entry.id + ') — ' + won(tax) };
}
function famPlanRun_(c, input, by) {
  const key = famKeyOf_(c), F = famLoad_(key, true);
  const plan = Object.assign({ 지금: caseProcToday_() }, input.plan || {});
  const r = famPlanCompute_(F, plan, runUiEngineCalcTool_);
  if (!r.ok) return r;
  const lines = famPlanLines_(r);
  const plId = 'pl' + Date.now().toString(36); // [2026.11.02 쪼개 처리 ①] 자문 항목 calc·links에 이 id를 넣어 인용
  if (input.save !== false) famMutate_(key, function (F2) { F2.계획 = (F2.계획 || []).concat([{ id: plId, 이름: String(plan.이름 || '계획 ' + ((F2.계획 || []).length + 1)).slice(0, 60), 때: caseProcNow_(), 누가: String(by || '').slice(0, 6), 이전계획: plan.이전계획 || [], 가정: { 증가율: plan.증가율, 사망후년: plan.사망후년, 배우자사망후년: plan.배우자사망후년, 배우자비율: plan.배우자비율 }, 요약: lines }]).slice(-20); famLog_(F2, by, '미래 설계', lines[0]); });
  // message는 짧게(화면 알림) — 숫자는 요약 줄에(화면 결과 칸·넥스가 읽음), 같은 글을 두 번 띄우지 않는다
  return Object.assign(r, { 계획id: input.save !== false ? plId : '', 요약: lines, message: '미래 계획 견주기 — 사망 시점 ' + (r.경우 || []).length + '가지' + (input.save !== false ? ' · 가족 지도에 계획 저장' : '') });
}
// 장부 계산이 부르는 곳 — 증여: 장부 사전증여 칸이 비면 지도의 §47② 합산 / 상속: 장부 사전증여 칸·chainFrom이 비면 지도의 §13① 가산
function famAutoPriorGift_(c, input, L) {
  try {
    const F = famLoad_(famKeyOf_(c)); if (!F.이전.length) return null;
    const row = function (p) { const r = L.rows[p]; return r && (r.state === '확정' || r.state === '추정') ? r.v : ''; };
    const donee = row('g.giftDoneeName') || c.고객명, donor = row('g.giftDonorName');
    const pr = famPriorGifts_(F, { date: input.giftDate, donee: donee, donor: donor, relation: input.relation, amount: input.giftAmount, caseId: c.id });
    if (pr.세대생략 && pr.세대생략.해당 && input.isGenerationSkip == null) { input.isGenerationSkip = true; if (pr.세대생략.대습) input.isSubstituteGiftDueToDeath = true; }
    if (input.isMinor == null && famIsMinorAt_(F, donee, input.giftDate) === true) input.isMinor = true;
    if (!pr.합계) return pr.알림.length ? { 줄: ['가족 지도: ' + pr.알림.join(' · ')] } : null;
    input.priorGiftAmount = pr.합계; input.priorPaidTax = pr.기납부; if (pr.공제사용) input.priorRelationDeductionUsed = pr.공제사용;
    return { 줄: ['가족 지도에서 10년 합산(§47②) ' + pr.list.length + '건 ' + famWon_(pr.합계) + ': ' + pr.list.map(function (t) { return famYmd_(t.날짜) + ' ' + famName_(F, t.주는) + ' ' + famWon_(famGiftValue_(t)); }).join(', ') + ' · 기납부세액 ' + famWon_(pr.기납부)].concat(pr.알림.map(function (n) { return '가족 지도: ' + n; })) };
  } catch (e) { return { 줄: ['가족 지도를 못 읽어 지난 증여 합산을 못 함: ' + e.message] }; }
}
function famAutoEstatePrior_(c, input, L) {
  try {
    const F = famLoad_(famKeyOf_(c)); if (!F.이전.length) return null;
    const r = L.rows['i.deceasedName'], dec = (r && r.v) || (F.사람.filter(function (p) { return famYmd_(p.사망일) && famYmd_(p.사망일) === famYmd_((L.rows['기준일'] || {}).v || c.기준일); })[0] || {}).이름;
    const date = famYmd_(input.inheritanceDate || (L.rows['기준일'] || {}).v || c.기준일);
    if (!dec || !date) return null;
    const pe = famPriorForEstate_(F, { date: date, deceased: dec });
    const add = famApplyEstatePriors_(input, pe);
    if (!add) return pe.알림.length ? { 줄: pe.알림.map(function (n) { return '가족 지도: ' + n; }) } : null;
    return { 줄: ['가족 지도에서 사전증여 가산(§13①) 상속인 ' + pe.상속인.length + '건·그 밖 ' + pe.그밖.length + '건 ' + famWon_(add) + ' — 증여세액공제(§28)는 지도에 적힌 그 증여의 산출세액'].concat(pe.알림.map(function (n) { return '가족 지도: ' + n; })) };
  } catch (e) { return { 줄: ['가족 지도를 못 읽어 사전증여 가산을 못 함: ' + e.message] }; }
}
