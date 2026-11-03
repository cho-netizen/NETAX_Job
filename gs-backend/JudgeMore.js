// [2026.11.01 복잡사건 ⑤] 종합판정 묶음 늘리기 — 세무사님 "고쳐라"(점검서 4절 방향 5): 8년 자경 감면·동거주택 상속공제·가업상속공제
//  1세대1주택 묶음(엔진 judgeTaxReliefJS)과 같은 모양으로 돌려준다: { 묶음, 결론(충족|안 됨), 잠정, 요건[{이름, 결과 ✔|✘|?, 왜, 근거}], 남은것, 표시, 근거, 엔진칸, 할일 }
//  엔진칸 = 세액계산기에 그대로 넣을 칸(가정 over로) — 판정은 사실 확인만, 세액은 계산기가 센다. 요건을 하나라도 모르면 잠정(결론을 단정하지 않음).
//  근거 원문(2026.11.01 업무관리자\법령 읽기용 판에서 읽음): 조특법 §69①·시행령 §66①④⑪⑫⑬⑭ · 조특법 §133① / 상증법 §23의2①②·시행령 §20의2①② / 상증법 §18의2①⑤·시행령 §15③
//  순수 셈 — 드라이브·엔진 없이(tools/family-regress.js가 그대로 부른다)
function jmYmd_(x) { return famYmd_(x); }
function jmDays_(a, b) { return (new Date(b) - new Date(a)) / 864e5; }
function jmMerge_(list) { // [{s,e}] 날짜 구간을 합쳐 겹침을 없앤다
  const xs = list.filter(function (x) { return x.s && x.e && x.s <= x.e; }).sort(function (a, b) { return a.s < b.s ? -1 : 1; }), out = [];
  xs.forEach(function (x) { const l = out[out.length - 1]; if (l && x.s <= l.e) { if (x.e > l.e) l.e = x.e; } else out.push({ s: x.s, e: x.e }); });
  return out;
}
function jmLen_(list) { return list.reduce(function (t, x) { return t + jmDays_(x.s, x.e) + 1; }, 0); }
function jmCut_(list, s, e) { // 구간 목록에서 [s,e]를 뺀다
  const out = []; list.forEach(function (x) { if (e < x.s || s > x.e) { out.push(x); return; } if (x.s < s) out.push({ s: x.s, e: famAddD_(s, -1) }); if (x.e > e) out.push({ s: famAddD_(e, 1), e: x.e }); }); return out;
}
function famAddD_(d, n) { const t = new Date(d); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function jmYn_(v) { if (v === true || v === false) return v; const s = String(v == null ? '' : v).trim(); if (/^(예|true|맞|충족|있음|했|해당|1)$/.test(s)) return true; if (/^(아니|false|없음|못|안|미충족|0)/.test(s)) return false; return null; }
function jmReq_(이름, 결과, 왜, 근거) { return { 이름: 이름, 결과: 결과 === true ? '✔' : 결과 === false ? '✘' : '?', 왜: 왜 || '', 근거: 근거 || '' }; }
function jmWrap_(묶음, reqs, extra) {
  const no = reqs.filter(function (r) { return r.결과 === '✘'; }), unk = reqs.filter(function (r) { return r.결과 === '?'; });
  const 결론 = no.length ? '안 됨' : '충족', 잠정 = !no.length && unk.length > 0;
  const 표시 = 묶음 + ' — ' + (결론 === '충족' ? (잠정 ? '충족(잠정)' : '충족') : '안 됨') + (no.length ? ' (못 갖춤: ' + no.map(function (r) { return r.이름; }).join(', ') + ')' : '') + (unk.length ? ' (남은 것: ' + unk.map(function (r) { return r.이름; }).join(', ') + ')' : '');
  return Object.assign({ 묶음: 묶음, 결론: 결론, 잠정: 잠정, 요건: reqs, 남은것: unk.map(function (r) { return r.이름 + (r.왜 ? ' — ' + r.왜 : ''); }), 표시: 표시, 근거: reqs.map(function (r) { return r.근거; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' · ') }, extra || {});
}

// ① 8년 자경농지 양도소득세 감면(조특법 §69)
//  p: { 양도일, 취득일, 경작:[{시작,끝,누가:본인|피상속인|피상속인배우자}], 거주지역: 같은시군구|연접시군구|30km이내|아님, 직접경작(예/아니오),
//       소득초과해: {본인:[2019,…], 피상속인:[…]} (사업소득+총급여 3,700만원 이상 또는 사업 총수입 기준 이상인 해, 시행령 §66⑭),
//       양도일거주자, 양도일농지, 상속받은날, 상속후경작개월, 도시편입일, 편입시지역(특별시·광역시·시 동 지역 주거·상업·공업 = 예), 환지예정지지정일, 경영이양3년(예=3년 특례 대상) }
function judgeSelfFarm_(p) {
  p = p || {};
  const 양도 = jmYmd_(p.양도일), reqs = [], notes = [], 할일 = [];
  const need = p.경영이양3년 === true ? 3 : 8;
  reqs.push(jmReq_('농지 소재지 거주(재촌)', p.거주지역 == null || p.거주지역 === '' ? null : /같은|연접|30/.test(String(p.거주지역)), p.거주지역 ? String(p.거주지역) : '경작한 동안 어디 살았는지(주민등록 초본)', '조특령 §66①1~3호(같은 시·군·구, 연접 시·군·구, 직선 30km)'));
  reqs.push(jmReq_('직접 경작(상시 종사 또는 농작업 1/2 이상 자기 노동)', jmYn_(p.직접경작), jmYn_(p.직접경작) === null ? '농지원부·농업경영체 등록·직불금·농협 거래로 확인' : '', '조특령 §66⑬'));
  // 경작 기간 — 본인 + (상속받았고 1년 이상 이어 경작했으면, 또는 3년 안 양도 특례면) 피상속인·피상속인 배우자 기간(직전 피상속인만)
  const per = function (who) { return jmMerge_((p.경작 || []).filter(function (x) { return (x.누가 || '본인') === who; }).map(function (x) { return { s: jmYmd_(x.시작), e: jmYmd_(x.끝) || 양도 }; })); };
  const inc = p.소득초과해 || {}, cut = function (list, who) { [].concat(Array.isArray(inc) ? (who === '본인' ? inc : []) : (inc[who] || [])).forEach(function (y) { y = String(y).slice(0, 4); if (/^\d{4}$/.test(y)) list = jmCut_(list, y + '-01-01', y + '-12-31'); }); return list; };
  let days = jmLen_(cut(per('본인'), '본인'));
  const 상속 = jmYmd_(p.상속받은날);
  if (상속) {
    const cont = Number(p.상속후경작개월), within3 = 양도 && 양도 <= famAddY_(상속, 3);
    const ok = cont >= 12 ? true : within3 ? null : (p.상속후경작개월 == null || p.상속후경작개월 === '' ? null : false);
    if (ok !== false) { const add = jmLen_(cut(per('피상속인'), '피상속인')) + jmLen_(cut(per('피상속인배우자'), '피상속인배우자')); days += add; if (add) notes.push('피상속인(배우자 포함) 경작 기간 ' + (add / 365.25).toFixed(1) + '년을 더함(조특령 §66⑪)'); }
    if (ok === null) notes.push(cont >= 12 ? '' : within3 ? '상속 뒤 1년 이상 경작하지 않았어도 3년 안 양도면 수용·지정 지역일 때만 피상속인 기간을 더함(조특령 §66⑫) — 그 지역 지정 확인할 것' : '상속 뒤 이어 경작한 개월 수(상속후경작개월)를 모름');
  }
  const yrs = days / 365.25;
  reqs.push(jmReq_(need + '년 이상 경작', (p.경작 || []).length ? yrs >= need : null, (p.경작 || []).length ? '센 기간 ' + yrs.toFixed(1) + '년(소득 기준 넘은 해 뺌)' : '경작 시작·끝 날을 모름', '조특법 §69①·조특령 §66④⑭'));
  reqs.push(jmReq_('양도일 현재 거주자', jmYn_(p.양도일거주자 == null ? true : p.양도일거주자), '', '조특령 §66①(비거주자 된 날부터 2년 이내 포함)'));
  reqs.push(jmReq_('양도일 현재 농지', jmYn_(p.양도일농지), jmYn_(p.양도일농지) === null ? '양도일 현재 실제 경작 중인 농지인지(매수자 형질변경 등은 계약일 기준 §66⑤)' : '', '조특령 §66⑤'));
  const 편입 = jmYmd_(p.도시편입일);
  if (편입 && 양도) {
    const over3 = 양도 > famAddY_(편입, 3);
    if (p.편입시지역 === true || jmYn_(p.편입시지역) === true) reqs.push(jmReq_('주거·상업·공업지역 편입 3년 안 지남', !over3, over3 ? '편입(' + 편입 + ') 뒤 3년 지나 양도 — 감면 제외(대규모개발사업 지연 등 예외 §66④1호 가~다 확인)' : '', '조특령 §66④1호'));
    else if (p.편입시지역 == null) reqs.push(jmReq_('편입 지역이 특별시·광역시·시 동 지역인지', null, '군·도농복합시 읍·면이면 3년 제외가 없음', '조특령 §66④1호'));
    notes.push('주거지역 등에 편입됐으면 편입일까지 생긴 소득만 감면(조특법 §69①단서·조특령 §66⑦ 기준시가 비율) — 양도소득금액 × (편입일 기준시가 − 취득 기준시가) ÷ (양도 기준시가 − 취득 기준시가)');
  }
  if (jmYmd_(p.환지예정지지정일) && 양도 && 양도 > famAddY_(jmYmd_(p.환지예정지지정일), 3)) reqs.push(jmReq_('환지예정지 지정 3년 안 지남', false, '지정일부터 3년 지나 양도', '조특령 §66④2호'));
  notes.push('감면 한도: 과세기간 1억원, 5개 과세기간(직전 4년 감면액 포함) 2억원(조특법 §133①) — 계산기가 직전 감면액을 받아 셈');
  할일.push({ 무엇: '양도한 해의 예정·확정신고 때 세액감면신청서 제출(조특령 §66⑨)', 때: 양도 ? '양도일 속한 달 말일부터 2개월 안 예정신고와 함께' : '' });
  return jmWrap_('8년 자경농지 감면', reqs, { 센경작연수: Math.round(yrs * 10) / 10, 알림: notes.filter(Boolean), 할일: 할일, 엔진칸: { isEightYearFarmland: true }, 엔진칸뜻: '양도 계산의 그 자산에 isEightYearFarmland=true(충족일 때만 넣을 것)' });
}

// ② 동거주택 상속공제(상증법 §23의2)
//  p: { 상속개시일, 상속인관계(직계비속|대습상속 직계비속의 배우자|그밖), 상속인생년월일, 동거시작일, 동거못한기간:[{시작,끝,사유:징집|취학|근무|요양|그밖}],
//       일세대일주택10년(예/아니오 — 무주택 기간은 포함, 시행령 §20의2① 일시 2주택 예외), 무주택또는공동(예/아니오), 주택가액, 담보채무, 상속지분(0~1) }
function judgeCohabit_(p) {
  p = p || {};
  const 개시 = jmYmd_(p.상속개시일), reqs = [], notes = [];
  const rel = String(p.상속인관계 || '');
  reqs.push(jmReq_('상속인이 직계비속(또는 대습상속한 직계비속의 배우자)', rel ? /직계비속|자녀|아들|딸|손/.test(rel) && !/그밖/.test(rel) : null, rel || '상속인 관계를 모름', '상증법 §23의2①1호 괄호'));
  let cnt = null;
  const 시작 = jmYmd_(p.동거시작일);
  if (개시 && 시작) {
    let s = 시작; const 생 = jmYmd_(p.상속인생년월일); if (생) { const adult = famAddY_(생, 19); if (adult > s) s = adult; } else notes.push('상속인 생년월일이 없어 미성년 기간을 빼지 못함 — 19세 전 기간은 동거 기간에서 뺌(민법 §4)');
    let list = s <= 개시 ? [{ s: s, e: 개시 }] : []; let broken = false;
    (p.동거못한기간 || []).forEach(function (x) { const a = jmYmd_(x.시작), b = jmYmd_(x.끝); if (!a || !b) return; if (/징집|취학|근무|요양|질병/.test(String(x.사유 || ''))) list = jmCut_(list, a, b); else broken = true; });
    cnt = jmLen_(list) / 365.25;
    if (broken) notes.push('징집·취학·근무·요양이 아닌 사유로 따로 산 기간이 있음 — 계속 동거가 끊긴 것으로 볼 수 있음(시행령 §20의2②)');
    reqs.push(jmReq_('10년 이상 계속 하나의 주택에서 동거', broken ? null : cnt >= 10, '센 동거 기간 ' + cnt.toFixed(1) + '년(미성년·징집 등 기간 뺌)', '상증법 §23의2①1호·②, 시행령 §20의2②③'));
  } else reqs.push(jmReq_('10년 이상 계속 하나의 주택에서 동거', null, '동거 시작일·상속개시일이 필요(주민등록 초본)', '상증법 §23의2①1호'));
  reqs.push(jmReq_('10년 이상 1세대를 이뤄 1세대 1주택', jmYn_(p.일세대일주택10년), jmYn_(p.일세대일주택10년) === null ? '그 10년 동안 세대 주택 수(무주택 기간 포함, 일시 2주택 예외는 시행령 §20의2①1~8호)' : '', '상증법 §23의2①2호·시행령 §20의2①'));
  reqs.push(jmReq_('상속개시일 현재 무주택이거나 피상속인과 공동 1세대1주택인 동거 상속인이 상속받음', jmYn_(p.무주택또는공동), '', '상증법 §23의2①3호'));
  const v = famNum_(p.주택가액) - famNum_(p.담보채무), sh = Number(p.상속지분);
  const 공제 = v > 0 ? Math.min(600000000, Math.round(v * (sh > 0 && sh <= 1 ? sh : 1))) : 0;
  if (!famNum_(p.주택가액)) notes.push('주택가액(부수토지 포함)이 없어 공제액은 계산기가 셈');
  else notes.push('공제 = (주택가액 − 그 주택에 담보된 피상속인 채무) × 100%, 6억원 한도 → 약 ' + famWon_(공제) + (sh > 0 && sh < 1 ? '(그 상속인 지분 ' + sh + ')' : ''));
  const y = function (r) { return r.결과 === '✔' ? true : r.결과 === '✘' ? false : undefined; };
  const eng = { tenYearCohabitationRequirementMet: y(reqs[1]), tenYearOneHouseholdRequirementMet: y(reqs[2]), noHouseOrJointHeirRequirementMet: y(reqs[3]) };
  if (famNum_(p.주택가액)) eng.cohabitingHouseValue = Math.max(0, v); if (sh > 0 && sh <= 1) eng.cohabitingHouseShareRatio = sh;
  Object.keys(eng).forEach(function (k) { if (eng[k] === undefined) delete eng[k]; });
  return jmWrap_('동거주택 상속공제', reqs, { 센동거연수: cnt == null ? null : Math.round(cnt * 10) / 10, 공제추정: 공제, 알림: notes, 엔진칸: eng, 엔진칸뜻: '상속 계산 입력에 그대로(모르는 요건은 넣지 않음 — 계산기가 요건 미확인으로 표시)', 할일: [] });
}

// ③ 가업상속공제(상증법 §18의2) — 피상속인·상속인 요건(시행령 §15③)과 사후관리(§18의2⑤ 5년)
//  p: { 상속개시일, 기업규모(중소|중견|그밖), 매출평균3년(중견일 때, 원), 경영시작일(피상속인 계속 경영 시작), 지분율(피상속인+특수관계인, %), 상장(예/아니오), 지분10년보유(예/아니오),
//       대표재직: {절반이상, 십년승계, 최근10년중5년}(예/아니오), 상속인생년월일, 상속인종사년수, 피상속인65세전사망(예/아니오), 임원취임(신고기한까지, 예/아니오/앞으로), 업종해당(시행령 별표, 예/아니오), 가업상속재산가액,
//       특례증여: {증여일, 가업자산상당액(증여 때 조특법 §30의6 특례를 받은 몫), 전부증여(피상속인이 가진 주식 전부를 줬나), 증여전지분율(%), 매출평균3년(증여일 속한 해 직전 3년, 중견일 때), 처분·지분감소(예/아니오), 종사또는대표(예/아니오)} }
//  [2026.11.02 복잡사건 35 「계씨 가업승계 증여 뒤 사망」] 특례 증여 주식도 상속개시일 현재 요건을 갖추면 가업상속으로 봄(조특령 §27의6⑨)
function judgeFamilyBiz_(p) {
  p = p || {};
  const 개시 = jmYmd_(p.상속개시일), reqs = [], notes = [], 할일 = [];
  const size = String(p.기업규모 || '');
  const sg = p.특례증여 && (p.특례증여.증여일 || p.특례증여.가업자산상당액) ? p.특례증여 : null, sgAll = sg && jmYn_(sg.전부증여) === true;
  // 조특령 §27의6⑨1호 괄호: 매출액 평균은 증여일 속한 사업연도 직전 3년 기준 · 주식 전부를 증여했으면 지분 요건(§15③1호가목)은 받은 주식을 상속개시일까지 피상속인이 가진 것으로 봄 · §15③1호나목(대표 재직)은 적용 안 함
  if (sg && sg.매출평균3년 != null && sg.매출평균3년 !== '') p = Object.assign({}, p, { 매출평균3년: sg.매출평균3년 });
  reqs.push(jmReq_('중소기업 또는 중견기업(중견은 직전 3년 매출 평균 5천억원 미만)', !size ? null : /그밖|대기업/.test(size) ? false : /중견/.test(size) ? (p.매출평균3년 == null || p.매출평균3년 === '' ? null : famNum_(p.매출평균3년) < 500000000000) : true, size || '기업 규모를 모름', '상증법 §18의2①·시행령 §15①②'));
  reqs.push(jmReq_('주된 업종이 시행령 별표 업종', jmYn_(p.업종해당), '', '시행령 §15①1호·②1호'));
  const 경영 = jmYmd_(p.경영시작일), yrs = 경영 && 개시 ? jmDays_(경영, 개시) / 365.25 : null;
  reqs.push(jmReq_('피상속인이 10년 이상 계속 경영', yrs == null ? null : yrs >= 10, yrs == null ? '경영 시작일을 모름(사업자등록·법인등기)' : '경영 ' + yrs.toFixed(1) + '년', '상증법 §18의2①'));
  const shareIn_ = sgAll && sg.증여전지분율 != null && sg.증여전지분율 !== '' ? sg.증여전지분율 : p.지분율;
  const share = shareIn_ == null || shareIn_ === '' ? null : Number(String(shareIn_).replace(/[^\d.]/g, ''));
  const listed = jmYn_(p.상장) === true;
  reqs.push(jmReq_('피상속인+특수관계인 지분 ' + (listed ? '20' : '40') + '% 이상을 10년 이상 계속 보유(최대주주등)', share == null ? null : share < (listed ? 20 : 40) ? false : jmYn_(p.지분10년보유), share == null ? '지분율을 모름(주주명부)' : '지분 ' + share + '%' + (sgAll ? ' — 주식 전부를 특례 증여해 받은 주식을 피상속인이 가진 것으로 봄(조특령 §27의6⑨1호)' : ''), '시행령 §15③1호가목' + (sgAll ? '·조특령 §27의6⑨1호' : '')));
  const d = p.대표재직 || {}, anyRep = [d.절반이상, d.십년승계, d.최근10년중5년].map(jmYn_);
  if (sg) reqs.push(jmReq_('피상속인 대표이사 재직', true, '특례 증여 주식의 가업상속은 이 요건을 보지 않음(조특령 §27의6⑨1호 단서)', '조특령 §27의6⑨1호'));
  else reqs.push(jmReq_('피상속인 대표이사 재직(가업 기간의 50% 이상 · 10년 이상(상속인 승계) · 최근 10년 중 5년 이상 중 하나)', anyRep.indexOf(true) >= 0 ? true : anyRep.every(function (x) { return x === false; }) ? false : null, '', '시행령 §15③1호나목'));
  if (sg) reqs.push(jmReq_('받은 사람이 특례 증여 주식을 처분하지 않고 지분율도 낮아지지 않았으며 가업에 종사하거나 대표이사로 재직', jmYn_(sg['처분·지분감소']) === true || jmYn_(sg.처분지분감소) === true || jmYn_(sg.종사또는대표) === false ? false : jmYn_(sg.종사또는대표) === true && (jmYn_(sg['처분·지분감소']) === false || jmYn_(sg.처분지분감소) === false) ? true : null, '', '조특령 §27의6⑨3호'));
  const 생 = jmYmd_(p.상속인생년월일);
  reqs.push(jmReq_('상속인 상속개시일 현재 18세 이상', 생 && 개시 ? famAddY_(생, 18) <= 개시 : null, '', '시행령 §15③2호가목'));
  reqs.push(jmReq_('상속인 상속개시 전 2년 이상 가업 종사', jmYn_(p.피상속인65세전사망) === true ? true : p.상속인종사년수 == null || p.상속인종사년수 === '' ? null : Number(p.상속인종사년수) >= 2, jmYn_(p.피상속인65세전사망) === true ? '피상속인이 65세 전 사망 — 이 요건 없음' : '', '시행령 §15③2호나목'));
  const exec = String(p.임원취임 == null ? '' : p.임원취임);
  reqs.push(jmReq_('신고기한까지 임원 취임(그 뒤 2년 안 대표이사 취임)', /앞으로|예정/.test(exec) ? null : jmYn_(exec), /앞으로|예정/.test(exec) ? '아직 — 할 일로 남김' : '', '시행령 §15③2호다·라목'));
  const lim = yrs == null ? null : yrs >= 30 ? 60000000000 : yrs >= 20 ? 40000000000 : yrs >= 10 ? 30000000000 : 0;
  const sgVal = sg ? famNum_(sg.가업자산상당액) : 0;
  const val = famNum_(p.가업상속재산가액) + sgVal, ded = lim != null && val ? Math.min(val, lim) : null;
  if (sg) {
    notes.push('특례 증여 주식(' + (jmYmd_(sg.증여일) || '증여일 모름') + (sgVal ? ', 가업자산상당액 ' + famWon_(sgVal) : '') + ')은 기간과 관계없이 상속세 과세가액에 더하고(조특법 §30의6⑤→§30의5⑨) 상속개시일 현재 요건을 갖추면 가업상속공제 대상(조특령 §27의6⑨) — 공제 대상 가액에 더했음' + (sgVal ? '' : ' [가업자산상당액을 넣을 것]') + ' · 그 가액은 증여 당시 가액으로 봄 [확인 필요]');
    notes.push('상속인 요건(시행령 §15③2호 — 18세·2년 종사·임원 취임) 중 무엇을 그대로 보는지 [확인 필요: 조특령 §27의6⑨는 1호나목만 빼고 3호를 따로 둠] — 그대로 대조함');
    notes.push('특례 증여세는 §28② 비율 한도 없이 상속세 산출세액에서 빼고 남으면 돌려받지 않음(조특법 §30의5⑩) — 계산기 specialGiftTaxCredit · 사전증여(priorGiftHeirs)에 넣지 말 것(§24 3호 공제한도도 줄이지 않음, §30의5⑨)');
    const sgBad_ = jmYn_(sg['처분·지분감소']) === true || jmYn_(sg.처분지분감소) === true || jmYn_(sg.종사또는대표) === false;
    if (sgBad_) notes.push('받은 주식을 처분했거나 지분이 줄었거나 가업에서 손을 뗐음 → 특례 증여 주식은 가업상속공제 대상이 아님(조특령 §27의6⑨3호) · 증여일부터 5년 안이면 그 증여 자체도 일반 세율로 다시 매기고 이자상당액(조특법 §30의6③) · 피상속인이 남은 주식을 가졌으면 「특례증여」 칸을 비우고 남은 주식만으로 다시 판정할 것');
    if (famNum_(p.가업상속재산가액) === 0 && !sgAll) notes.push('피상속인이 남은 주식을 가졌으면 그 가액(상속개시일 현재, 시행령 §15⑤)도 가업상속재산가액에 넣을 것');
  }
  if (lim) notes.push('공제 한도 ' + famWon_(lim) + '(경영 ' + (yrs >= 30 ? '30년 이상' : yrs >= 20 ? '20~30년' : '10~20년') + ', 상증법 §18의2①1~3호)' + (ded != null ? ' → 공제 ' + famWon_(ded) : ''));
  if (/중견/.test(size)) notes.push('중견기업이면 가업상속재산 외 상속재산이 그 상속인 상속세의 일정 배수를 넘으면 공제 안 됨(§18의2②·시행령 §15⑦) — 계산기 결과를 함께 볼 것');
  notes.push('법인 가업은 주식가액 × (총자산 − 사업무관자산) ÷ 총자산(시행령 §15⑤2호) — 사업무관자산(임대 부동산·과다보유현금 등)을 빼야 함');
  if (개시) {
    const end = famAddY_(개시, 5);
    할일.push({ 무엇: '사후관리 5년(' + 개시 + '~' + end + '): 가업용 자산 40% 이상 처분 금지 · 상속인 가업 종사 · 지분 유지 · 정규직 수·총급여 유지(상증법 §18의2⑤1~4호)', 때: end });
    할일.push({ 무엇: '상속세 신고기한부터 2년 안 대표이사 취임(시행령 §15③2호라목)', 때: (function () { const y = Number(개시.slice(0, 4)), m = Number(개시.slice(5, 7)) + 6, yy = y + Math.floor((m - 1) / 12), mm = ((m - 1) % 12) + 1, last = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10); return famAddY_(last, 2) + '(신고기한 ' + last + ' — 상속개시일 속한 달 말일부터 6개월, 상증법 §67①)'; })() });
  }
  return jmWrap_('가업상속공제', reqs, { 경영연수: yrs == null ? null : Math.round(yrs * 10) / 10, 공제한도: lim, 공제추정: ded, 알림: notes, 할일: 할일, 엔진칸: ded ? { businessInheritanceDeduction: ded, businessOwnershipYearsOfParent: Math.floor(yrs) } : (yrs != null ? { businessOwnershipYearsOfParent: Math.floor(yrs) } : {}), 엔진칸뜻: '상속 계산에 businessInheritanceDeduction(충족일 때만) — 엔진이 세부 칸(자산 비율 등)을 받으면 그쪽이 셈' });
}
// [2026.11.02 복잡사건 「정씨 법인전환」] 법인전환 이월과세(조특법 §32) 요건 판정 — 엔진엔 사후관리 추징 셈(calculateBusinessTransferCarryoverJS)만 있고 요건 대조가 없었음
//  근거 원문(2026.11.02 업무관리자\법령\_본문 2026-09-18 판에서 읽음): 조특법 §2①6호(이월과세 뜻) · §32①~⑤ · 시행령 §28①2호·②(순자산가액·사업용고정자산) · §29②~⑧
function judgeIncorp32_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [];
  const how = String(p.전환방법 || ''), 양수도 = /양수|양도/.test(how);
  reqs.push(jmReq_('현물출자 또는 사업 양도·양수 방법', !how ? null : /현물|양수|양도/.test(how), how || '전환 방법을 모름', '조특법 §32①'));
  reqs.push(jmReq_('새 법인이 소비성서비스업(호텔·여관(관광숙박업 빼고)·일정 주점업·오락·유흥 등)을 하지 않음', p.소비성서비스업 == null || p.소비성서비스업 === '' ? null : !jmYn_(p.소비성서비스업), String(p.업종 || ''), '조특법 §32① · 시행령 §29③'));
  const assets = Array.isArray(p.자산) ? p.자산 : [], 대상 = [], 제외 = [];
  assets.forEach(function (a) {
    const kind = String(a.종류 || ''), use = jmYn_(a.사업사용);
    const why = /주택|입주권|분양권/.test(kind) ? '주택·주택을 취득할 수 있는 권리(§32① 단서, 2020.12.29 개정)' : use === false ? '사업에 직접 쓰지 않음(시행령 §28②)' : '';
    (why ? 제외 : 대상).push({ 이름: a.이름 || kind, 종류: kind, 시가: famNum_(a.시가), 왜: why });
  });
  reqs.push(jmReq_('이월과세 대상 사업용고정자산이 있음(주택·입주권·분양권 빼고)', assets.length ? 대상.length > 0 : null, assets.length ? '대상 ' + 대상.length + '건 · 제외 ' + 제외.length + '건' : '자산 목록을 모름', '조특법 §32① · 시행령 §28②'));
  const 자산합 = assets.reduce(function (t, a) { return t + famNum_(a.시가); }, 0), 부채 = famNum_(p.부채), 순자산 = assets.length ? 자산합 - 부채 : null;
  const cap = p.자본금 == null || p.자본금 === '' ? null : famNum_(p.자본금);
  reqs.push(jmReq_('새 법인 자본금 ≥ 전환하는 사업장의 순자산가액(시가 자산 − 충당금 포함 부채)', cap == null || 순자산 == null ? null : cap >= 순자산, 순자산 == null ? '자산 시가를 모름' : '순자산 ' + famWon_(순자산) + (cap == null ? ' · 자본금 모름' : ' · 자본금 ' + famWon_(cap)), '조특법 §32② · 시행령 §29⑤ · §28①2호'));
  const 설립 = jmYmd_(p.법인설립일 || p.설립등기일), 등기 = jmYmd_(p.설립등기일 || p.법인설립일);
  if (양수도) {
    reqs.push(jmReq_('사업을 하던 거주자가 발기인이 되어 순자산가액 이상 출자', jmYn_(p.발기인출자), '', '시행령 §29②'));
    const 양도일 = jmYmd_(p.사업양도일);
    reqs.push(jmReq_('법인 설립일부터 3개월 안에 사업 전부를 포괄 양도', 양도일 && 설립 ? (function () { const t = new Date(설립); t.setUTCMonth(t.getUTCMonth() + 3); return 양도일 <= t.toISOString().slice(0, 10); })() : null, 양도일 ? '양도일 ' + 양도일 : '사업 양도일을 모름', '시행령 §29②'));
  }
  const 전환일 = jmYmd_(p.현물출자일 || p.사업양도일 || p.설립등기일);
  if (전환일) {
    const y = Number(전환일.slice(0, 4)), m = Number(전환일.slice(5, 7)) + 2, due = new Date(Date.UTC(y + Math.floor((m - 1) / 12), ((m - 1) % 12) + 1, 0)).toISOString().slice(0, 10);
    const ap = String(p.적용신청 == null ? '' : p.적용신청);
    reqs.push(jmReq_('이월과세적용신청서를 그 해 과세표준신고(예정신고 포함) 때 새 법인과 함께 냄', /예정|앞으로/.test(ap) ? null : jmYn_(ap), /예정|앞으로/.test(ap) || !ap ? '예정신고기한 ' + due + ' — 할 일로 남김' : '', '조특법 §32③ · 시행령 §29④'));
    할일.push({ 무엇: '양도소득 예정신고 + 이월과세적용신청서(법인과 함께) 제출 — 시행령 §29④ [확인 필요] 예정신고 때 못 냈으면 확정신고 때 내도 되는지', 때: due });
  }
  if (제외.length) notes.push('이월과세 안 되는 자산(지금 과세): ' + 제외.map(function (x) { return x.이름 + '(' + x.왜 + ')'; }).join(' · ') + ' — 같은 해 다른 양도로 보고 따로 셈한다. 주택이면 1세대1주택 판정을 따로 돌릴 것');
  notes.push('이월과세액 = 대상 자산을 그 과세기간의 유일한 양도자산으로 보고 셈한 양도소득 산출세액(조특법 §2①6호) — 양도세 계산기를 대상 자산만 넣어 한 번 더 돌린 값. 법인이 뒤에 그 자산을 팔면 법인세로 냄');
  // 사후관리 5년(§32⑤) — 처분 계획을 쌓아 50% 넘는 날을 찾는다
  if (등기) {
    const end = famAddY_(등기, 5);
    할일.push({ 무엇: '사후관리 5년(' + 등기 + '~' + end + '): 승계 사업 폐지(법인이 사업용고정자산 절반 이상 처분하거나 사업에 안 씀) · 전환으로 받은 주식 50% 이상 처분(유상·무상이전·감자 포함)이면 이월과세액 납부(조특법 §32⑤ · 시행령 §29⑥⑦)', 때: end });
    const plan = (Array.isArray(p.처분) ? p.처분 : []).map(function (x) { return { 날짜: jmYmd_(x.날짜), 비율: Number(String(x.비율 == null ? '' : x.비율).replace(/[^\d.]/g, '')) || 0, 방법: String(x.방법 || ''), 특례: jmYn_(x.가업승계특례) }; }).filter(function (x) { return x.날짜; }).sort(function (a, b) { return a.날짜 < b.날짜 ? -1 : 1; });
    let acc = 0, hit = null;
    plan.forEach(function (x) {
      if (x.날짜 > end || hit) return;
      const 예외 = /사망|상속|파산|합병|분할|회생|포괄적\s*교환|법령상\s*의무/.test(x.방법) || (/증여/.test(x.방법) && x.특례 === true);
      if (/증여/.test(x.방법) && x.특례 !== true) notes.push(x.날짜 + ' ' + x.비율 + '% 증여 — 가업승계 증여세 특례(조특법 §30의6)를 받아야만 처분에서 빠짐(시행령 §29⑦6호, 받으면 받은 사람이 남은 기간을 이어 짐 §29⑧). [확인 필요] 부동산임대업 법인 주식은 §30의6의 "가업"(상증법 §18의2·시행령 §15 별표 업종)에 들지 않을 수 있음');
      if (!예외) { acc += x.비율; if (acc >= 50) hit = { 날짜: x.날짜, 누적: acc }; }
    });
    if (hit) {
      const y = Number(hit.날짜.slice(0, 4)), m = Number(hit.날짜.slice(5, 7)) + 2, due = new Date(Date.UTC(y + Math.floor((m - 1) / 12), ((m - 1) % 12) + 1, 0)).toISOString().slice(0, 10);
      notes.push('⚠ 처분 계획대로면 ' + hit.날짜 + ' 누적 ' + hit.누적 + '% — 5년 안 50% 이상 처분으로 이월과세액(법인이 이미 낸 세액 빼고)을 ' + due + '까지 양도소득세로 내야 함(조특법 §32⑤2호·전단)');
      할일.push({ 무엇: '이월과세액 납부(사후관리 위반 ' + hit.날짜 + ')', 때: due });
    } else if (plan.length) notes.push('처분 계획 누적 ' + acc + '% — 5년 안 50% 미만(예외 처분 빼고)');
  }
  return jmWrap_('법인전환 이월과세', reqs, { 대상자산: 대상, 제외자산: 제외, 순자산가액: 순자산, 알림: notes, 할일: 할일, 엔진칸: { provision: 'sect32', triggerEvent: 'none' }, 엔진칸뜻: '사후관리 셈(calculate_business_transfer_carryover)에 그대로 — deferredTaxAmount(이월과세액)는 양도세 계산기를 대상 자산만 넣어 돌린 산출세액으로 채움' });
}
// [2026.11.02 복잡사건 27 「제씨 농지 대토」] ⑥ 농지대토 양도소득세 감면(조특법 §70·시행령 §67) — 요건·사후관리 판정
//  p: { 양도일, 수용(예=협의매수·수용, 기한 2년), 종전경작:[{시작,끝}], 종전거주지역(같은|연접|30km|아님), 종전거주년수(양도일 현재 농지소재지 거주 연수),
//       직접경작(예/아니오), 양도일거주자, 종전면적, 종전가액, 새취득일, 새취득원인(매매|상속|증여), 새면적, 새가액,
//       새경작시작일, 새거주지역, 새경작끝(그만둔 날, 계속 중이면 비움), 부득이사유(예=질병 요양 등 시행규칙 기간), 소득초과해:[해],
//       새농지수용일, 소유자사망일, 상속인계속경작(예/아니오), 종전편입일·종전편입시지역·종전환지예정지지정일, 새편입일·새편입시지역, 기준일(오늘 대신) }
function judgeFarmSwap_(p) {
  p = p || {};
  const 양도 = jmYmd_(p.양도일), reqs = [], notes = [], 할일 = [], 추징 = [];
  const 기준 = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const 수용 = jmYn_(p.수용) === true, win = 수용 ? 2 : 1;
  const yrsOf = function (d) { return Math.round(d / 365.25 * 10) / 10; };
  const 초과 = [].concat(p.소득초과해 || []).map(function (y) { return String(y).slice(0, 4); }).filter(function (y) { return /^\d{4}$/.test(y); });
  const cutInc = function (list) { 초과.forEach(function (y) { list = jmCut_(list, y + '-01-01', y + '-12-31'); }); return list; };
  const endOfMonthPlus2_ = function (d) { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)) + 2, yy = y + Math.floor((m - 1) / 12), mm = ((m - 1) % 12) + 1; return new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10); };
  const claw = function (사유, 날) { if (!날) return; 추징.push({ 사유: 사유, 사유발생일: 날, 납부기한: endOfMonthPlus2_(날), 근거: '조특법 §70④⑤·조특령 §67⑩⑪' }); };
  // 1) 거주자·재촌·직접경작 — 종전 농지(조특령 §67①②)
  reqs.push(jmReq_('종전 농지 소재지 거주(같은 시군구·연접·30km 안)', p.종전거주지역 == null || p.종전거주지역 === '' ? null : /같은|연접|30/.test(String(p.종전거주지역)), p.종전거주지역 ? String(p.종전거주지역) : '경작한 동안 어디 살았는지(주민등록 초본)', '조특령 §67①1~3호'));
  reqs.push(jmReq_('양도일 현재 4년 이상 농지소재지 거주', p.종전거주년수 == null || p.종전거주년수 === '' ? null : Number(p.종전거주년수) >= 4, p.종전거주년수 != null && p.종전거주년수 !== '' ? '거주 ' + p.종전거주년수 + '년' : '농지소재지에 산 햇수를 모름', '조특령 §67①'));
  reqs.push(jmReq_('양도일 현재 거주자(비거주자 된 지 2년 안 포함)', jmYn_(p.양도일거주자 == null ? true : p.양도일거주자), '', '조특령 §67①'));
  reqs.push(jmReq_('직접 경작(상시 종사 또는 농작업 1/2 이상 자기 노동)', jmYn_(p.직접경작), jmYn_(p.직접경작) === null ? '농지원부·농업경영체 등록·직불금·농협 거래로 확인' : '', '조특령 §67②'));
  // 2) 종전 농지 4년 이상 거주하며 경작(§67③ 각 호 본문) — 소득 기준 넘은 해는 뺌(§67⑥ → §66⑭)
  const oldList = cutInc(jmMerge_((p.종전경작 || []).map(function (x) { return { s: jmYmd_(x.시작), e: jmYmd_(x.끝) || 양도 }; })));
  const oldDays = jmLen_(oldList);
  reqs.push(jmReq_('종전 농지 4년 이상 거주하며 경작', (p.종전경작 || []).length ? oldDays / 365.25 >= 4 : null, (p.종전경작 || []).length ? '센 기간 ' + yrsOf(oldDays) + '년' + (초과.length ? '(소득 기준 넘은 해 ' + 초과.join('·') + ' 뺌)' : '') : '종전 농지 경작 시작·끝을 모름', '조특령 §67③1·2호, ⑥'));
  // 3) 새 농지 — 취득 순서·기한
  const 새취득 = jmYmd_(p.새취득일);
  let 호 = '';
  if (새취득 && 양도) {
    if (새취득 >= 양도) { 호 = '1호(먼저 팔고 새로 삼)'; reqs.push(jmReq_('종전 농지 양도일부터 ' + win + '년 안 새 농지 취득', 새취득 <= famAddY_(양도, win), '새 농지 취득 ' + 새취득 + ' · 기한 ' + famAddY_(양도, win), '조특령 §67③1호·⑩1호')); if (새취득 > famAddY_(양도, win)) claw('기한 넘겨 새 농지 취득', famAddY_(양도, win)); }
    else { 호 = '2호(먼저 사고 나중에 팜)'; reqs.push(jmReq_('새 농지 취득일부터 ' + win + '년 안 종전 농지 양도', 양도 <= famAddY_(새취득, win), '새 농지 취득 ' + 새취득 + ' · 양도 ' + 양도 + ' · 기한 ' + famAddY_(새취득, win), '조특령 §67③2호')); }
  } else if (양도) {
    const due = famAddY_(양도, win);
    if (기준 > due) { reqs.push(jmReq_('종전 농지 양도일부터 ' + win + '년 안 새 농지 취득', false, '기한 ' + due + '이 지났는데 새 농지 취득 사실이 없음', '조특령 §67③1호·⑩1호')); claw('기한 안 새 농지 취득 안 함', due); }
    else { reqs.push(jmReq_('종전 농지 양도일부터 ' + win + '년 안 새 농지 취득', null, '아직 새 농지를 사지 않음 — ' + due + '까지 사야 함', '조특령 §67③1호')); 할일.push({ 무엇: '새 농지 취득(매매 — 상속·증여는 안 됨), 면적 2/3 이상 또는 가액 1/2 이상', 때: due + '까지(조특령 §67③1호·⑩1호)' }); }
  }
  if (p.새취득원인) reqs.push(jmReq_('새 농지를 상속·증여가 아닌 방법으로 취득', !/상속|증여/.test(String(p.새취득원인)), String(p.새취득원인), '조특령 §67③1호 괄호'));
  // 4) 면적 2/3 이상 또는 가액 1/2 이상
  const oa = famNum_(p.종전면적), na = famNum_(p.새면적), ov = famNum_(p.종전가액), nv = famNum_(p.새가액);
  const areaOk = oa && na ? na * 3 >= oa * 2 : null, valOk = ov && nv ? nv * 2 >= ov : null;
  const sizeOk = areaOk === true || valOk === true ? true : (areaOk === false && valOk === false) || (areaOk === false && valOk === null && !nv) || (valOk === false && areaOk === null && !na) ? false : null;
  if (새취득 || na || nv) {
    reqs.push(jmReq_('새 농지 면적이 종전의 2/3 이상 또는 가액이 1/2 이상', sizeOk, [oa && na ? '면적 ' + na + '/' + oa + '㎡ = ' + Math.round(na / oa * 1000) / 10 + '%' : '', ov && nv ? '가액 ' + Math.round(nv / ov * 1000) / 10 + '%' : ''].filter(Boolean).join(' · ') || '면적·가액을 모름', '조특령 §67③1·2호 가·나목'));
    if (sizeOk === false && 양도) claw('새 농지 면적·가액 기준 못 미침', 새취득 && 새취득 > 양도 ? 새취득 : 양도);
    if (valOk !== null) notes.push('가액 비교의 "가액"은 법령에 정의가 없음 — 실지거래가액끼리 견줌 [확인 필요: 예규·판례로 기준시가 비교 여부]');
  }
  // 5) 새 농지 경작 개시 1년 안(1호: 새 취득일부터, 2호: 종전 양도일부터)
  const 개시기점 = 새취득 && 양도 ? (새취득 >= 양도 ? 새취득 : 양도) : '';
  const 새시작 = jmYmd_(p.새경작시작일);
  if (개시기점) {
    const due = famAddY_(개시기점, 1), 부득이 = jmYn_(p.부득이사유) === true;
    if (새시작) reqs.push(jmReq_('새 농지 소재지에 살며 경작 개시(' + 개시기점 + '부터 1년 안)', 새시작 <= due ? true : 부득이 ? null : false, '개시 ' + 새시작 + ' · 기한 ' + due + (부득이 && 새시작 > due ? ' — 질병 요양 등 부득이 사유 기간은 시행규칙으로 확인 [확인 필요]' : ''), '조특령 §67③1·2호, ⑩2호'));
    else if (기준 > due && !부득이) { reqs.push(jmReq_('새 농지 소재지에 살며 경작 개시(1년 안)', false, '기한 ' + due + ' 지남 · 경작 개시 없음', '조특령 §67⑩2호')); claw('1년 안 새 농지 경작 개시 안 함', due); }
    else { reqs.push(jmReq_('새 농지 소재지에 살며 경작 개시(1년 안)', null, '아직 개시 전 — ' + due + '까지', '조특령 §67③')); 할일.push({ 무엇: '새 농지 소재지(같은 시군구·연접·30km 안)로 살며 직접 경작 시작', 때: due + '까지(조특령 §67⑩2호)' }); }
    if (새시작 && new Date(새시작) > new Date(due) && !부득이 && 기준 >= due) claw('1년 안 새 농지 경작 개시 안 함', due);
  }
  if (새시작) reqs.push(jmReq_('새 농지 소재지 거주(같은 시군구·연접·30km 안)', p.새거주지역 == null || p.새거주지역 === '' ? null : /같은|연접|30/.test(String(p.새거주지역)), p.새거주지역 ? String(p.새거주지역) : '새 농지 경작하며 산 곳(주민등록 초본)', '조특령 §67③ 각 호(새로운 농지소재지)'));
  // 6) 합산 8년(§67③ 단서) — 새 농지 수용(④)·소유자 사망(⑤)·소득 기준 넘은 해(⑥)
  let newDays = 0, broken = '', 남은 = null;
  if (새시작) {
    const 수용일 = jmYmd_(p.새농지수용일), 사망 = jmYmd_(p.소유자사망일);
    let 끝 = jmYmd_(p.새경작끝) || 수용일 || 기준;
    if (사망 && !jmYmd_(p.새경작끝)) { if (jmYn_(p.상속인계속경작) === false) 끝 = 사망; else notes.push('소유자 사망(' + 사망 + ') 뒤 상속인이 농지소재지에 살며 이어 경작하면 피상속인·상속인 기간을 통산(조특령 §67⑤)' + (jmYn_(p.상속인계속경작) === null ? ' — 상속인이 이어 경작하는지 확인할 것' : '')); }
    if (수용일 && 새취득 && 수용일 <= famAddY_(새취득, 4)) { newDays = 4 * 365.25; notes.push('새 농지가 취득 뒤 4년 안 수용(' + 수용일 + ') — 4년 경작한 것으로 봄(조특령 §67④)'); }
    else {
      const raw = [{ s: 새시작, e: 끝 }], kept = cutInc(raw);
      newDays = jmLen_(kept);
      const eightAt = famAddD_(새시작, Math.ceil(8 * 365.25 - oldDays) - 1);
      const hit = 초과.filter(function (y) { return y + '-12-31' >= 새시작 && y + '-01-01' <= eightAt && y + '-01-01' <= 끝; });
      if (hit.length) { broken = hit[0]; newDays = jmLen_(jmCut_(raw, hit[0] + '-01-01', 끝)); }
    }
    const tot = (oldDays + newDays) / 365.25;
    const ended = !!jmYmd_(p.새경작끝) || (jmYn_(p.상속인계속경작) === false && 사망) || !!broken;
    if (broken) { reqs.push(jmReq_('새 농지 계속 경작(합산 8년 전에 소득 기준 넘은 해 없음)', false, broken + '년 소득 기준(사업소득+총급여 3,700만원 등) 넘음 — 계속 경작하지 않은 것으로 봄', '조특령 §67⑥·⑩4호·§66⑭')); claw(broken + '년 소득 기준 넘음', broken + '-01-01'); notes.push('소득 기준 넘은 해의 사유발생일을 그해 1월 1일로 둠 [확인 필요: 과세기간 종료일인지]'); }
    if (tot >= 8) reqs.push(jmReq_('종전 + 새 농지 경작 합산 8년 이상', true, '종전 ' + yrsOf(oldDays) + '년 + 새 ' + yrsOf(newDays) + '년', '조특령 §67③ 단서'));
    else if (ended) { reqs.push(jmReq_('종전 + 새 농지 경작 합산 8년 이상', false, '종전 ' + yrsOf(oldDays) + '년 + 새 ' + yrsOf(newDays) + '년 = ' + Math.round(tot * 10) / 10 + '년', '조특령 §67③ 단서·⑩3호')); if (!broken) claw('합산 8년 못 채우고 경작 그만둠', jmYmd_(p.새경작끝) || jmYmd_(p.소유자사망일)); }
    else { 남은 = famAddD_(새시작, Math.ceil(8 * 365.25 - oldDays) - 1); reqs.push(jmReq_('종전 + 새 농지 경작 합산 8년 이상', null, '지금까지 ' + Math.round(tot * 10) / 10 + '년 — ' + 남은 + '까지 이어 경작하면 채움', '조특령 §67③ 단서')); 할일.push({ 무엇: '새 농지에 살며 계속 경작(그사이 사업소득+총급여 3,700만원 넘는 해가 있으면 끊긴 것으로 봄)', 때: 남은 + '까지(조특령 §67⑥·⑩3·4호)' }); }
  } else if (개시기점) {
    남은 = '경작 개시일 + ' + Math.round((8 - oldDays / 365.25) * 10) / 10 + '년';
    reqs.push(jmReq_('종전 + 새 농지 경작 합산 8년 이상', null, '새 농지 경작 전 — 종전 ' + yrsOf(oldDays) + '년, 새 농지에서 ' + Math.round(Math.max(0, 8 - oldDays / 365.25) * 10) / 10 + '년 더 경작해야 함', '조특령 §67③ 단서'));
  }
  // 7) 주거·상업·공업지역 편입 3년 지남·환지예정지(§70②·§67⑧) — 양도하는 토지와 취득하는 토지 모두
  const zone = function (이름, 편입, 시지역, 환지, 때) {
    편입 = jmYmd_(편입); 환지 = jmYmd_(환지);
    if (편입 && 때) {
      if (jmYn_(시지역) === true) reqs.push(jmReq_(이름 + ' 주거·상업·공업지역 편입 3년 안', 때 <= famAddY_(편입, 3), '편입 ' + 편입 + ' · 기준 ' + 때 + (때 > famAddY_(편입, 3) ? ' — 대규모개발사업 지연 등 예외(§67⑧1호 가~다) 확인' : ''), '조특법 §70②·조특령 §67⑧1호'));
      else if (시지역 == null || 시지역 === '') reqs.push(jmReq_(이름 + ' 편입 지역이 특별시·광역시·시 동 지역인지', null, '광역시 군·도농복합시 읍면이면 3년 제외 없음', '조특령 §67⑧1호'));
    }
    if (환지 && 때 && 때 > famAddY_(환지, 3)) reqs.push(jmReq_(이름 + ' 환지예정지 지정 3년 안', false, '지정 ' + 환지 + '부터 3년 지남(환지청산금 부분은 예외)', '조특령 §67⑧2호'));
  };
  zone('종전 농지', p.종전편입일, p.종전편입시지역, p.종전환지예정지지정일, 양도);
  zone('새 농지', p.새편입일, p.새편입시지역, null, 새취득);
  if (jmYmd_(p.새편입일)) notes.push('새 농지의 편입 3년은 취득일 기준으로 셈 [확인 필요: 조특령 §67⑧은 "양도일 현재"라 새 농지에 어느 날을 쓰는지 예규 확인]');
  if (jmYmd_(p.종전편입일) || jmYmd_(p.종전환지예정지지정일)) notes.push('종전 농지가 주거지역 등에 편입됐거나 환지예정지 지정을 받았으면 그날까지 생긴 소득만 감면(조특법 §70①단서·조특령 §67⑦ 기준시가 비율) — 계산기 zoneIncorporated 칸');
  // 8) 견줌·한도·신청
  if (oldDays / 365.25 >= 8) notes.push('종전 농지 경작이 이미 ' + yrsOf(oldDays) + '년 — 8년 자경 감면(조특법 §69)도 판정해 견줄 것(사후관리가 없음)');
  notes.push('감면 한도: 대토 감면만 5개 과세기간 1억원(조특법 §133①2호가목), 자경·축사·어업·자경산지·대토 묶음 과세기간 1억원·5개 과세기간 2억원(§133①1호·2호나목) — 계산기가 직전 감면액을 받아 셈');
  if (추징.length) notes.push('사후관리 위반이면 감면세액에 이자상당액(종전 농지 예정신고 납부기한 다음 날부터 납부일까지 × 조특령 §11의2⑩2호 율)을 더해 냄 — calculate_clawback_interest 도구로 셈');
  할일.push({ 무엇: '종전 농지 양도 예정·확정신고 때 세액감면신청서 제출(조특령 §67⑨)', 때: 양도 ? endOfMonthPlus2_(양도) + '까지(예정신고와 함께)' : '' });
  const r = jmWrap_('농지대토 감면', reqs, { 대토형태: 호, 종전경작연수: yrsOf(oldDays), 새경작연수: yrsOf(newDays), 합산8년되는날: 남은 || '', 추징: 추징, 알림: notes.filter(Boolean), 할일: 할일 });
  r.엔진칸 = 추징.length ? { isFarmlandSubstitutionExempt: true, isFarmlandSubstitutionRequirementFailed: true } : { isFarmlandSubstitutionExempt: true };
  r.엔진칸뜻 = 추징.length ? '이미 감면받은 경우 추징 계산: isFarmlandSubstitutionExempt + isFarmlandSubstitutionRequirementFailed' : '양도 계산의 그 자산에 isFarmlandSubstitutionExempt=true(충족·잠정일 때 경우(안)로)';
  if (추징.length && r.결론 !== '충족') r.표시 += ' · 추징 ' + 추징.map(function (x) { return x.사유 + '(' + x.납부기한 + '까지)'; }).join(', ');
  return r;
}

// [2026.11.02 복잡사건 28 「구씨 형제 공유토지」] ⑦ 양도로 보지 않는 경우(소득세법 §88 1호 각 목·시행령 §151·§152) — 결론 「충족」 = 양도로 보지 않음
//  p: { 유형: 공유물분할|토지교환|양도담보|신탁|환지, 날짜,
//       공유물분할: 지분(0~1), 받은몫비율(분할 뒤 내 몫 가액 ÷ 전체 가액), 전체시가, 정산금받음, 정산금줌, 내취득가액(내 지분 전체), 내취득일
//       토지교환: 경계조정목적, 법에따른분할(공간정보법 등), 분할면적합, 분할전면적합, 받은토지시가, 받은정산금, 준정산금, 입증자료제출, 내취득가액, 내취득일
//       양도담보: 담보의사, 사용수익유지, 채무약정(원금·이율·변제기한·방법), 계약서사본첨부, 변제충당일
//       신탁: 신탁해지가능, 수익자변경가능, 실질지배(위탁자가 신탁재산을 실질 지배·소유)
//       환지: 환지처분, 보류지충당, 청산금받음, 권리가액, 공고일(환지처분 공고일), 내취득가액, 내취득일 }
function judgeTransferScope_(p) {
  p = p || {};
  const 유형 = String(p.유형 || '').replace(/\s/g, ''), reqs = [], notes = [], 할일 = [];
  let 양도부분 = null;
  const n = famNum_;
  if (/공유/.test(유형)) {
    const 지분 = Number(p.지분), 몫 = Number(p.받은몫비율), 받음 = n(p.정산금받음), 줌 = n(p.정산금줌), 시가 = n(p.전체시가);
    const known = 지분 > 0 && 몫 >= 0 && !isNaN(몫);
    const same = known && Math.abs(몫 - 지분) < 0.005;
    reqs.push(jmReq_('분할 뒤 내 몫 가액이 내 지분 비율과 같거나, 줄어든 몫에 대가를 받지 않음', known ? (same || 몫 > 지분 || !받음) : null, known ? '지분 ' + Math.round(지분 * 1000) / 10 + '% · 받은 몫 ' + Math.round(몫 * 1000) / 10 + '%' : '분할 뒤 몫의 가액 비율(감정가로)을 모름', '소득세법 §88 1호(유상 이전만 양도) — 지분 범위 안의 공유물 분할은 양도 아님 [확인 필요: 판례·예규 번호]'));
    reqs.push(jmReq_('정산금을 받지 않음(준 쪽은 그만큼 새로 취득)', 받음 ? false : (p.정산금받음 == null && p.정산금줌 == null ? null : true), 받음 ? '받음 ' + 받음.toLocaleString() + '원' : 줌 ? '줌 ' + 줌.toLocaleString() + '원 — 양도 아닌 취득' : '', '소득세법 §88 1호·5호(대가관계 금전)'));
    if (known && 몫 < 지분 - 0.005) {
      const r_ = (지분 - 몫) / 지분;
      if (받음) {
        양도부분 = { 무엇: '지분 중 줄어든 ' + Math.round((지분 - 몫) * 1000) / 10 + '%p(내 지분의 ' + Math.round(r_ * 1000) / 10 + '%)', 양도일: jmYmd_(p.날짜), 양도가액: 받음, 취득가액: n(p.내취득가액) ? Math.round(n(p.내취득가액) * r_) : null, 취득일: jmYmd_(p.내취득일) || '', 근거: '소득세법 §88 1호·§96①(실지거래가액 = 받은 정산금)·§97①(취득가액은 지분 비율로 나눔)' };
        if (시가 && Math.abs(받음 - 시가 * (지분 - 몫)) > 시가 * (지분 - 몫) * 0.3) notes.push('정산금 ' + 받음.toLocaleString() + '원이 넘긴 몫의 시가(' + Math.round(시가 * (지분 - 몫)).toLocaleString() + '원)와 30% 넘게 차이 — 특수관계(형제 등)면 부당행위계산 부인(소득세법 §101·시행령 §167③④: 시가 차이 3억 이상 또는 5% 이상)과 저가양수 증여(상증법 §35) 함께 볼 것');
      } else notes.push('내 몫이 지분보다 적은데 정산금이 없음 — 넘긴 몫(시가 ' + (시가 ? Math.round(시가 * (지분 - 몫)).toLocaleString() + '원' : '모름') + ')은 많이 받은 공유자에게 증여(상증법 §4①) — 증여세 판정으로 넘길 것');
    }
    if (known && 몫 > 지분 + 0.005) notes.push('내 몫이 지분보다 큼 — 늘어난 ' + Math.round((몫 - 지분) * 1000) / 10 + '%p는 분할일에 새로 취득(정산금을 줬으면 그 금액이 취득가액, 안 줬으면 증여로 받음). 뒤에 팔 때 두 부분의 취득일·취득가액을 나눠 셈(소득세법 시행령 §162)');
    notes.push('지분 범위 안 분할이면 분할 뒤 토지의 취득일·취득가액은 처음 공유지분을 취득한 때 그대로 [확인 필요: 예규]');
  } else if (/교환/.test(유형)) {
    const a = n(p.분할면적합), b = n(p.분할전면적합);
    reqs.push(jmReq_('불합리한 지상 경계를 합리적으로 바꾸려는 교환', jmYn_(p.경계조정목적), '', '소득세법 시행령 §152③1호'));
    reqs.push(jmReq_('공간정보법 등에 따라 토지를 분할해 교환', jmYn_(p.법에따른분할), '', '소득세법 시행령 §152③1호'));
    reqs.push(jmReq_('분할된 토지 면적 합이 분할 전 전체 면적의 20% 이하', a && b ? a <= b * 0.2 : null, a && b ? Math.round(a / b * 1000) / 10 + '%(' + a + '/' + b + '㎡)' : '분할 면적·전체 면적을 모름', '소득세법 시행령 §152③2호'));
    reqs.push(jmReq_('요건 입증 자료 제출', jmYn_(p.입증자료제출), jmYn_(p.입증자료제출) === null ? '세무서에 낼 자료(국세청 고시)' : '', '소득세법 시행령 §152④⑤'));
    const 받은 = n(p.받은토지시가), 받음 = n(p.받은정산금), 줌 = n(p.준정산금);
    if (받은 || 받음) {
      const 가액 = 받은 + 받음 - 줌;
      양도부분 = { 무엇: '교환으로 넘긴 토지(경계 조정 요건을 못 갖추면 교환 = 양도)', 양도일: jmYmd_(p.날짜), 양도가액: 가액, 취득가액: n(p.내취득가액) || null, 취득일: jmYmd_(p.내취득일) || '', 근거: '소득세법 §88 1호(교환은 양도)·5호(대가관계에 있는 금전과 그 밖의 재산가액) — 받은 토지 시가 + 받은 정산금 − 준 정산금 [확인 필요: 교환 양도가액 산정 판례]' };
      notes.push('교환으로 받은 토지는 같은 날 취득 — 그 취득가액도 넘긴 토지 시가 + 준 정산금 − 받은 정산금으로 장부에 둘 것 [확인 필요]');
    }
  } else if (/담보/.test(유형)) {
    reqs.push(jmReq_('채무 변제를 담보하려고 양도한다는 의사표시', jmYn_(p.담보의사), '', '소득세법 시행령 §151①1호'));
    reqs.push(jmReq_('채무자가 그 자산을 원래대로 사용·수익한다는 의사표시', jmYn_(p.사용수익유지), '', '소득세법 시행령 §151①2호'));
    reqs.push(jmReq_('원금·이율·변제기한·변제방법 약정', jmYn_(p.채무약정), '', '소득세법 시행령 §151①3호'));
    reqs.push(jmReq_('위 요건을 갖춘 계약서 사본을 확정신고서에 첨부', jmYn_(p.계약서사본첨부), jmYn_(p.계약서사본첨부) === null ? '확정신고 때 첨부해야 양도로 안 봄' : '', '소득세법 시행령 §151①'));
    const 충당 = jmYmd_(p.변제충당일);
    if (충당) { reqs.push(jmReq_('요건 위배·채무불이행으로 변제에 충당하지 않음', false, '변제 충당 ' + 충당 + ' — 그때 양도', '소득세법 시행령 §151②')); 양도부분 = { 무엇: '담보 자산 전체(변제 충당)', 양도일: 충당, 양도가액: null, 근거: '소득세법 시행령 §151② — 양도가액은 충당한 채무액 등 실지거래가액 [확인 필요]' }; }
    할일.push({ 무엇: '양도담보 계약서 사본을 양도소득 과세표준 확정신고서에 첨부', 때: '계약한 해의 다음 해 5월(확정신고 기한)' });
  } else if (/신탁/.test(유형)) {
    const 지배 = jmYn_(p.실질지배) === true || jmYn_(p.신탁해지가능) === true || jmYn_(p.수익자변경가능) === true ? true : (jmYn_(p.실질지배) === false && jmYn_(p.신탁해지가능) === false && jmYn_(p.수익자변경가능) === false ? false : null);
    reqs.push(jmReq_('위탁자가 신탁을 해지하거나 수익자를 바꿀 수 있는 등 신탁재산을 실질 지배·소유', 지배, 지배 === null ? '신탁계약서의 해지·수익자 변경 조항 확인' : '', '소득세법 §88 1호다목'));
    if (jmYn_(p.수익자변경가능) === false && jmYn_(p.신탁해지가능) === false) notes.push('위탁자가 해지·수익자 변경을 못 하고 수익자가 남이면 수익권을 넘긴 것 — 양도 또는 증여(상증법 §33 신탁이익 증여)로 따로 볼 것');
  } else if (/환지/.test(유형)) {
    reqs.push(jmReq_('도시개발법 등에 따른 환지처분(지목·지번 변경) 또는 보류지 충당', jmYn_(p.환지처분) === true || jmYn_(p.보류지충당) === true ? true : jmYn_(p.환지처분), '', '소득세법 §88 1호가목·시행령 §152①②'));
    const 청산 = n(p.청산금받음);
    if (청산) {
      reqs.push(jmReq_('환지청산금을 받지 않음', false, '청산금 ' + 청산.toLocaleString() + '원 받음 — 그 부분은 양도', '소득세법 §88 1호(유상 이전) [확인 필요: 청산금 부분 양도 예규]'));
      const 권리 = n(p.권리가액), r_ = 권리 ? 청산 / 권리 : null;
      양도부분 = { 무엇: '환지청산금 받은 부분(권리면적보다 줄어든 면적)', 양도일: jmYmd_(p.공고일) ? famAddD_(jmYmd_(p.공고일), 1) : '', 양도일근거: '환지처분 공고일 다음 날(소득세법 시행령 §162①9호 단서)', 양도가액: 청산, 취득가액: n(p.내취득가액) && r_ ? Math.round(n(p.내취득가액) * r_) : null, 취득일: jmYmd_(p.내취득일) || '', 근거: '취득가액 = 내 취득가액 × 청산금 ÷ 권리가액 [확인 필요: 안분 방식]' };
      if (!권리) notes.push('권리가액을 모름 — 청산금 부분 취득가액을 나눌 수 없음');
    }
    notes.push('환지받은 토지의 취득일은 종전 토지 취득일, 권리면적보다 늘거나 준 면적의 취득·양도시기는 환지처분 공고일 다음 날(소득세법 시행령 §162①9호)' + (jmYmd_(p.공고일) ? '' : ' — 공고일을 모름'));
  } else {
    return jmWrap_('양도로 보지 않음', [jmReq_('유형', null, '공유물분할·토지교환·양도담보·신탁·환지 중 하나', '소득세법 §88 1호')], { 알림: ['유형을 모름'], 할일: [] });
  }
  if (양도부분) notes.push('양도로 보는 부분은 양도소득세 계산기로 따로 셈 — 양도부분의 양도가액·취득가액·취득일을 그대로 넣을 것(예정신고: 양도일 속한 달 말일부터 2개월, 소득세법 §105)');
  const r = jmWrap_('양도로 보지 않음', reqs, { 유형: 유형, 양도부분: 양도부분, 알림: notes, 할일: 할일 });
  if (양도부분 && r.결론 === '안 됨') r.표시 += ' · 양도 부분: ' + 양도부분.무엇 + (양도부분.양도가액 ? ' 양도가액 ' + 양도부분.양도가액.toLocaleString() + '원' : '');
  r.엔진칸 = {}; r.엔진칸뜻 = '엔진칸 없음 — 「안 됨」이면 양도부분 값으로 양도소득세 계산(경우(안))';
  return r;
}


// [2026.11.02 복잡사건 29 「조씨 세무조사 불복」] ⑧ 불복·경정청구 기한(국세기본법 §45의2·§55·§56·§61·§65·§66·§68·§81의15·§5) — 결론 「충족」 = 낸 것은 모두 기한 안(또는 아직 낼 기한이 남음)
//  p: { 기준일(오늘), 공휴일:[YYYY-MM-DD…](설·추석·대체공휴일·임시공휴일),
//       조사결과통지받은날, 과세예고통지받은날, 세액, 납부기한전징수(예), 수시부과(예), 고발통고(예), 제척기간만료일, 적부심청구일, 적부심결정받은날,
//       고지서받은날, 처분청: 세무서|지방청|국세청, 지방청조사(예),
//       이의신청일, 이의항변(예), 이의결정받은날, 심사청구일, 심판청구일, 결정받은날(심사·심판 결정 통지), 소송제기일,
//       법정신고기한, 신고함(예=기한 안 신고 또는 기한후신고), 경정청구일 }
function apDay_(d) { return new Date(d + 'T00:00:00Z').getUTCDay(); }
function apAddM_(d, n) { // 민법 §160 — 다음 날부터 n개월: 끝 = n개월 뒤 같은 날(그 달에 그 날이 없으면 말일)
  d = jmYmd_(d); if (!d) return ''; let y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)) + n; const dd = Number(d.slice(8, 10));
  y += Math.floor((m - 1) / 12); m = (m - 1) % 12 + 1; const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(dd, last)).padStart(2, '0');
}
var AP_FIXED_ = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];
// §5① 기한이 토·일·공휴일·대체공휴일·노동절이면 그 다음 날 — 양력 고정 공휴일·노동절은 스스로, 설·추석·대체·임시 공휴일은 받은 목록으로
function apShift_(d, hol, why) {
  let x = d; const list = (hol || []).map(jmYmd_).filter(Boolean), moved = [];
  for (let i = 0; i < 20; i++) {
    const w = apDay_(x), md = x.slice(5);
    const r = w === 6 ? '토요일' : w === 0 ? '일요일' : md === '05-01' ? '노동절' : AP_FIXED_.indexOf(md) >= 0 ? '공휴일' : list.indexOf(x) >= 0 ? '공휴일(받은 목록)' : '';
    if (!r) break; moved.push(x + ' ' + r); x = famAddD_(x, 1);
  }
  if (moved.length && why) why.push(moved.join(', ') + ' → ' + x + '(국세기본법 §5①)');
  return x;
}
function judgeAppealDeadline_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10), hol = p.공휴일 || [];
  const reqs = [], 기한 = [], notes = [], 할일 = [], 길 = [];
  // 기한 하나 — 받은 날 다음 날부터 셈(국세기본법 §4 → 민법 §157 첫날 불산입): 끝 = 받은 날 + n일
  function due(무엇, base, days, 근거, filed, opt) {
    opt = opt || {}; const b = jmYmd_(base); if (!b) return null;
    const raw = opt.months ? apAddM_(b, opt.months) : opt.years ? famAddY_(b, opt.years) : famAddD_(b, days);
    const why = [];
    let end = apShift_(raw, hol, why);
    if (opt.cap && end > opt.cap) end = opt.cap;
    const f = jmYmd_(filed);
    const 상태 = f ? (f <= end ? '냄 ' + f + ' — 기한 안' : '냄 ' + f + ' — 기한 ' + Math.round(jmDays_(end, f)) + '일 넘김') : (today <= end ? '남음 ' + Math.round(jmDays_(today, end)) + '일' : '지남(' + Math.round(jmDays_(end, today)) + '일 전)');
    const row = { 무엇: 무엇, 시작: b, 마감: end, 미룸: why.join(' '), 상태: 상태, 근거: 근거 + (opt.note ? ' — ' + opt.note : '') };
    기한.push(row);
    if (f) reqs.push(jmReq_(무엇 + ' 기한 안에 냄', f <= end, '마감 ' + end + ' · 낸 날 ' + f, 근거));
    return row;
  }
  function wait(무엇, 시작, 끝, 받음, 근거, 지남말) {
    기한.push({ 무엇: 무엇, 시작: 시작, 마감: 끝, 미룸: '', 상태: 받음 ? '결정 받음 ' + 받음 : (today <= 끝 ? '기다림' : 지남말), 근거: 근거 });
  }
  // 1. 과세전적부심사
  const 조사통지 = jmYmd_(p.조사결과통지받은날), 예고 = jmYmd_(p.과세예고통지받은날), 적부일 = jmYmd_(p.적부심청구일), 통지일 = 조사통지 || 예고;
  const 배제 = [], 제척 = jmYmd_(p.제척기간만료일);
  if (jmYn_(p.납부기한전징수) === true || jmYn_(p.수시부과) === true) 배제.push('납부기한 전 징수·수시부과 사유(§81의15③1호)');
  if (jmYn_(p.고발통고) === true) 배제.push('조세범 고발·통고처분(§81의15③2호)');
  if (제척 && 통지일 && apAddM_(통지일, 3) >= 제척) 배제.push('통지 받은 날부터 제척기간 끝(' + 제척 + ')까지 3개월 이하(§81의15③3호)');
  if (통지일) {
    if (배제.length) { notes.push('과세전적부심사 못 함 — ' + 배제.join(' · ') + ' → 고지 뒤 이의신청·심사·심판으로'); if (적부일) reqs.push(jmReq_('과세전적부심사 대상', false, 배제.join(' · '), '국세기본법 §81의15③')); }
    else {
      due('과세전적부심사 청구', 통지일, 30, '국세기본법 §81의15②(' + (조사통지 ? '세무조사 결과 통지' : '과세예고통지') + ' 받은 날부터 30일)', 적부일, { note: '통지한 세무서장·지방국세청장에게(유권해석 변경 등은 국세청장)' });
      if (p.세액 != null && famNum_(p.세액) < 1000000 && !조사통지) notes.push('고지할 세액이 100만원 밑이면 과세예고통지 의무 대상이 아님(§81의15①3호) — 받은 통지가 업무감사·현지확인 등 다른 호인지 확인');
      if (적부일) {
        wait('과세전적부심사 결정(세무서·지방청이 할 기한)', 적부일, apShift_(famAddD_(적부일, 30), hol, []), jmYmd_(p.적부심결정받은날), '국세기본법 §81의15④(청구 받은 날부터 30일)', '결정기간 지남 — 고지가 왔는지 확인');
        notes.push('과세전적부심사를 했으면 뒤 이의신청은 관할 지방국세청장에게(§66①2호)');
      }
    }
  }
  // 2. 고지 뒤 불복 — 이의(고를 수 있음) → 심사 또는 심판(하나만) → 행정소송
  const 고지 = jmYmd_(p.고지서받은날), 심사일 = jmYmd_(p.심사청구일), 심판일 = jmYmd_(p.심판청구일);
  if (심사일 && 심판일) reqs.push(jmReq_('심사청구와 심판청구를 함께 하지 않음', false, '둘 다 냄 — 심사 ' + 심사일 + ' · 심판 ' + 심판일, '국세기본법 §55⑨'));
  const 국세청처분 = /국세청/.test(String(p.처분청 || '')), 이의낸날 = jmYmd_(p.이의신청일);
  // 국세청장 처분이면 이의신청은 없는 길 — 낸 것은 ✘로만 남기고 뒤 흐름은 바로 심사·심판으로 셈
  const 이의일 = 국세청처분 ? '' : 이의낸날;
  const 바로청구 = !이의일 && (심사일 || 심판일);
  if (고지) {
    if (국세청처분) { notes.push('국세청장 처분은 이의신청 대상이 아님(§55③ 단서) — 바로 심사·심판'); if (이의낸날) reqs.push(jmReq_('국세청장 처분에는 이의신청 안 함', false, '처분청 국세청장', '국세기본법 §55③ 단서')); }
    else if (!바로청구) due('이의신청', 고지, 90, '국세기본법 §66⑥·§61①(고지 받은 날부터 90일)', 이의일, { note: (jmYn_(p.지방청조사) === true || 적부일 ? '관할 지방국세청장에게(§66①1·2호)' : '처분한 세무서장에게(§66①)') + ' · 거치지 않고 바로 심사·심판도 됨(§55③)' });
    if (!이의일) due('심사청구(국세청장) 또는 심판청구(조세심판원) — 이의신청 없이', 고지, 90, '국세기본법 §61①·§68①(고지 받은 날부터 90일)', 심사일 || 심판일);
  }
  if (이의일) {
    const 항변 = jmYn_(p.이의항변) === true, 결정기간끝 = famAddD_(이의일, 항변 ? 60 : 30), 이의결정 = jmYmd_(p.이의결정받은날);
    wait('이의신청 결정(세무서·지방청이 할 기한)', 이의일, 결정기간끝, 이의결정, '국세기본법 §66⑦(받은 날부터 30일, 의견서에 항변하면 60일)', '결정기간 지남');
    if (이의결정 && 이의결정 <= 결정기간끝) due('심사·심판청구 — 이의신청 결정 받은 뒤', 이의결정, 90, '국세기본법 §61②·§68②(결정 통지 받은 날부터 90일)', 심사일 || 심판일);
    else {
      // §61②1호 「결정기간이 지난 날」부터 90일 — 그날은 0시부터 시작하는 날이라 첫날을 넣어 셈(민법 §157 단서)
      const r = due('심사·심판청구 — 이의 결정기간 안에 결정을 못 받음', famAddD_(결정기간끝, 1), 89, '국세기본법 §61②1호·§68②(결정기간이 지난 날부터 90일)', 심사일 || 심판일, { note: '그 날을 첫날로 셈 [확인 필요: 실무 계산]' });
      if (이의결정 && r) notes.push('결정기간이 지난 뒤(' + 이의결정 + ') 결정을 받음 — 그날부터 90일을 다시 주는지는 [확인 필요: 판례] · 이른 쪽(' + r.마감 + ')에 맞추는 게 안전');
    }
    if (!고지) notes.push('고지서 받은 날을 모름 — 이의신청이 기한 안인지 못 봄');
    else if (이의일 > apShift_(famAddD_(고지, 90), hol, [])) notes.push('이의신청이 기한을 넘겨 각하될 수 있음 — 그러면 뒤 심사·심판도 본래 기한(고지 받은 날부터 90일)으로 보아 각하될 수 있음 [확인 필요: 판례] · 경정청구 3개월·5년 길을 함께 볼 것');
  }
  const 청구 = 심사일 || 심판일;
  if (청구) {
    const 이름 = 심사일 ? '심사청구' : '심판청구', 결정끝 = famAddD_(청구, 90), 결정 = jmYmd_(p.결정받은날);
    wait(이름 + ' 결정(할 기한)', 청구, 결정끝, 결정, '국세기본법 §65②·§80의2(받은 날부터 90일)', '결정기간 지남 — 결정 전이라도 행정소송 낼 수 있음(§56③ 단서)');
    if (결정) due('행정소송', 결정, 90, '국세기본법 §56③(결정 통지 받은 날부터 90일)', p.소송제기일);
    else notes.push('행정소송은 ' + 이름 + ' 결정 통지를 받은 날부터 90일(§56③) — 결정기간(' + 결정끝 + ')이 지나면 결정 전이라도 낼 수 있으나(단서), 그것으로 90일이 흐르기 시작하지는 않음 [확인 필요: 판례]');
    길.push((이의일 ? '이의신청 → ' : '') + 이름 + ' → 행정소송');
  } else if (고지 && !이의일 && today <= apShift_(famAddD_(고지, 90), hol, [])) 길.push(국세청처분 ? '고르실 길: 심사(국세청) 또는 심판(조세심판원) → 소송 — 하나만(§55⑨)' : '고르실 길: ① 이의신청(30일 결정) → 심사 또는 심판 → 소송 ② 바로 심사(국세청) 또는 심판(조세심판원) → 소송 — 심사·심판은 하나만(§55⑨)');
  // 3. 경정청구
  const 신고기한 = jmYmd_(p.법정신고기한);
  if (신고기한) {
    const 오년 = apShift_(famAddY_(신고기한, 5), hol, []);
    if (jmYn_(p.신고함) === false) notes.push('기한 안 신고나 기한후신고를 안 했으면 경정청구를 못 함(§45의2①) — 고지분은 불복으로만');
    else {
      due('경정청구(당초 신고분)', 신고기한, 0, '국세기본법 §45의2①(법정신고기한이 지난 후 5년)', p.경정청구일, { years: 5 });
      if (고지) due('경정청구(결정·경정으로 늘어난 세액)', 고지, 0, '국세기본법 §45의2① 단서(처분 받은 날부터 3개월, 5년 안으로 한정)', p.경정청구일, { months: 3, cap: 오년 });
    }
    notes.push('후발적 사유(판결·상호합의·계약 해제 등)가 생기면 안 날부터 3개월 안에 따로 경정청구(§45의2②) — 사유와 날짜를 받으면 다시 돌림');
  }
  if (!hol.length) notes.push('설·추석·대체공휴일·임시공휴일은 공휴일 목록을 받아야 미룸 — 마감이 그 무렵이면 달력 확인 [확인 필요]');
  if (!고지 && !통지일 && !신고기한) reqs.push(jmReq_('날짜', null, '조사결과 통지·고지서·법정신고기한 중 하나는 있어야 기한을 셈', '국세기본법 §61·§81의15·§45의2'));
  const own = function (r) { return !/할 기한/.test(r.무엇); };
  const open = 기한.filter(function (r) { return own(r) && /^남음/.test(r.상태); }).sort(function (a, b) { return a.마감 < b.마감 ? -1 : 1; });
  const missed = 기한.filter(function (r) { return own(r) && /^지남/.test(r.상태); });
  open.forEach(function (r) { 할일.push({ 무엇: r.무엇, 때: r.마감 + '까지', 근거: r.근거 }); });
  if (missed.length && !open.length) notes.push('남은 기한이 없음 — 지난 것: ' + missed.map(function (r) { return r.무엇 + '(' + r.마감 + ')'; }).join(', ') + ' · 남는 길은 고충민원(직권 시정 요청) [확인 필요]');
  if (!reqs.length) reqs.push(jmReq_('낼 기한이 남아 있음', open.length ? true : (missed.length ? false : null), open.length ? '남은 기한 ' + open.length + '개' : missed.length ? '낼 기한이 모두 지남' : '', '국세기본법 §61·§66·§68·§45의2'));
  const r = jmWrap_('불복기한', reqs, { 기한: 기한.sort(function (a, b) { return a.마감 < b.마감 ? -1 : 1; }), 길: 길, 알림: notes, 할일: 할일, 기준일: today });
  if (open.length) r.표시 += ' · 가장 이른 마감: ' + open[0].무엇 + ' ' + open[0].마감;
  r.엔진칸 = {}; r.엔진칸뜻 = '엔진칸 없음 — 기한 판정만(세액은 계산기로)';
  return r;
}


// [2026.11.02 복잡사건 32 「하씨 상속 포기·대습」] ⑨ 상속인과 법정상속분(민법 §1000·§1001·§1003·§1009·§1010·§1042·§1043) + 세법에서 달라지는 것
//  p: { 사망일, 배우자: {이름, 포기}, 자녀: [{이름, 사망일(피상속인보다 먼저·같은 날이면 대습), 결격, 포기, 대습: [{이름, 관계: 배우자|직계비속, 포기}], 자녀: [{이름, 포기}](모든 자녀가 포기했을 때 본위상속할 손자녀)}],
//       직계존속: [{이름, 포기}], 형제자매: [{이름, 포기}], 재산가액(선택: 상속포기로 다음 순위가 받은 재산 셈용) }
//  결론 「충족」 = 상속인이 정해짐. 상속인[]마다 지분(분수·소수). 배우자공제 비율(상증법 §19① D)은 포기한 사람이 포기하지 않은 것으로 보고 따로 셈.
function hsGcd_(a, b) { return b ? hsGcd_(b, a % b) : a; }
function hsFr_(n, d) { const g = hsGcd_(n, d) || 1; return { n: n / g, d: d / g, 표시: (n / g) + '/' + (d / g), 값: Math.round(n / d * 1000000) / 1000000 }; }
function heirSharesCore_(p, ignoreRenounce) {
  const dd = jmYmd_(p.사망일), yn = jmYn_;
  const out_ = (x) => !ignoreRenounce && yn(x && x.포기) === true;
  const gone_ = (x) => yn(x.결격) === true || yn(x.살아있음) === false || (x.사망일 && dd && jmYmd_(x.사망일) <= dd);
  const sp = p.배우자 && (p.배우자.이름 || p.배우자 === true) ? (p.배우자 === true ? { 이름: '배우자' } : p.배우자) : null;
  const spIn = sp && !out_(sp);
  const rows = [], 알림 = [], 포기 = [];
  // 1순위 — 직계비속(대습 포함)
  const stocks = [];
  (p.자녀 || []).forEach(function (c) {
    if (gone_(c)) {
      const subs = (c.대습 || []).filter(function (s) { if (out_(s)) { 포기.push(s.이름 + '(대습 포기)'); return false; } return true; });
      if (subs.length) stocks.push({ 대습: true, 누구: c.이름, 사람: subs });
      else if ((c.대습 || []).length === 0) 알림.push(c.이름 + ' — 먼저 사망·결격인데 대습상속인(배우자·직계비속)을 모름');
      if (c.사망일 && dd && jmYmd_(c.사망일) === dd) 알림.push(c.이름 + ' — 같은 날 사망은 동시사망 추정(민법 §30) → 대습상속(대법원 판례) [확인 필요]');
      return;
    }
    if (c.사망일 && dd && jmYmd_(c.사망일) > dd) 알림.push(c.이름 + ' — 피상속인보다 뒤에 사망: 일단 상속인, 그 몫은 다시 그 사람의 상속(재상속 — 상증법 §30 단기 재상속 세액공제 볼 것)');
    if (out_(c)) { 포기.push(c.이름); return; }
    stocks.push({ 대습: false, 누구: c.이름, 사람: [{ 이름: c.이름, 관계: '직계비속' }] });
  });
  const anyChild = (p.자녀 || []).length > 0;
  let 순위 = '', 다음순위 = false, 세대생략 = [];
  const share_ = (members) => { // members: [{이름, 관계, w}] → 지분
    const W = members.reduce(function (s, m) { return s + m.w; }, 0);
    return members.map(function (m) { return Object.assign({}, m, { 지분: hsFr_(m.w, W) }); });
  };
  if (stocks.length) {
    순위 = '1순위 직계비속' + (spIn ? '·배우자' : '');
    // 배우자 3 : 줄기마다 2 (민법 §1009② 5할 가산) — 줄기 안은 대습상속인끼리 다시 §1009(배우자 3 : 직계비속 2, §1003②·§1010)
    const top = (spIn ? [{ 이름: sp.이름, 관계: '배우자', w: 3 }] : []).concat(stocks.map(function (s, i) { return { 이름: s.누구, 관계: '직계비속', w: 2, i: i }; }));
    const W = top.reduce(function (s, m) { return s + m.w; }, 0);
    top.forEach(function (m) {
      if (m.관계 === '배우자') { rows.push({ 이름: m.이름, 관계: '배우자', 지위: '본위', 지분: hsFr_(3, W) }); return; }
      const st = stocks[m.i];
      if (!st.대습) { rows.push({ 이름: st.누구, 관계: '직계비속', 지위: '본위', 지분: hsFr_(2, W) }); return; }
      const ws = st.사람.map(function (s) { return /배우자/.test(s.관계 || '') ? 3 : 2; }), w2 = ws.reduce(function (a, b) { return a + b; }, 0);
      st.사람.forEach(function (s, k) { rows.push({ 이름: s.이름, 관계: /배우자/.test(s.관계 || '') ? '대습(먼저 사망한 ' + st.누구 + '의 배우자)' : '대습(' + st.누구 + '의 직계비속)', 지위: '대습', 지분: hsFr_(2 * ws[k], W * w2) }); });
    });
  } else if (anyChild && spIn) {
    순위 = '배우자 단독(자녀 모두 포기)';
    rows.push({ 이름: sp.이름, 관계: '배우자', 지위: '본위', 지분: hsFr_(1, 1) });
    알림.push('자녀가 모두 포기하고 배우자가 있으면 배우자 단독 상속(대법원 2023.3.23. 전원합의체 결정 — 손자녀가 공동상속인이 되지 않음) [확인 필요: 사건번호]');
  } else if (anyChild && !spIn) {
    const gk = [];
    (p.자녀 || []).forEach(function (c) { (c.자녀 || []).forEach(function (g) { if (!out_(g)) gk.push({ 이름: g.이름, 관계: '직계비속(손자녀)', w: 1 }); else 포기.push(g.이름 + '(손자녀 포기)'); }); });
    if (gk.length) {
      순위 = '1순위 직계비속 — 자녀 모두 포기해 손자녀가 본위상속(같은 촌수 균분, 민법 §1000②·§1009①)';
      share_(gk).forEach(function (m) { rows.push({ 이름: m.이름, 관계: m.관계, 지위: '본위(자녀 포기로)', 지분: m.지분 }); 세대생략.push(m.이름); });
      다음순위 = true;
    }
  }
  if (!rows.length) {
    const asc = (p.직계존속 || []).filter(function (a) { if (out_(a)) { 포기.push(a.이름); return false; } return true; });
    if (asc.length) {
      순위 = '2순위 직계존속' + (spIn ? '·배우자' : '');
      share_((spIn ? [{ 이름: sp.이름, 관계: '배우자', w: 3 }] : []).concat(asc.map(function (a) { return { 이름: a.이름, 관계: '직계존속', w: 2 }; }))).forEach(function (m) { rows.push({ 이름: m.이름, 관계: m.관계, 지위: '본위', 지분: m.지분 }); });
      if (anyChild) 다음순위 = true;
    } else if (spIn) {
      순위 = '배우자 단독'; rows.push({ 이름: sp.이름, 관계: '배우자', 지위: '본위', 지분: hsFr_(1, 1) });
    } else {
      const sib = (p.형제자매 || []).filter(function (a) { if (out_(a)) { 포기.push(a.이름); return false; } return true; });
      if (sib.length) { 순위 = '3순위 형제자매'; share_(sib.map(function (a) { return { 이름: a.이름, 관계: '형제자매', w: 1 }; })).forEach(function (m) { rows.push({ 이름: m.이름, 관계: m.관계, 지위: '본위', 지분: m.지분 }); }); 다음순위 = true; }
    }
  }
  if (sp && !spIn) 포기.push(sp.이름 + '(배우자)');
  return { 순위: 순위, 상속인: rows, 포기: 포기, 다음순위: 다음순위, 세대생략: 세대생략, 알림: 알림 };
}
function judgeHeirShares_(p) {
  p = p || {};
  const real = heirSharesCore_(p, false), noRen = heirSharesCore_(p, true);
  const reqs = [];
  reqs.push(jmReq_('사망일', jmYmd_(p.사망일) ? true : null, jmYmd_(p.사망일) ? jmYmd_(p.사망일) : '사망일을 알아야 먼저 사망한 자녀(대습)를 가름', '민법 §1001'));
  reqs.push(jmReq_('상속인이 있음', real.상속인.length ? true : null, real.상속인.length ? real.순위 : '상속인을 정할 사람 정보가 모자람(4순위 4촌 이내 방계혈족은 직접 확인, 민법 §1000①4호)', '민법 §1000'));
  const notes = real.알림.slice(), 할일 = [];
  const spR = real.상속인.filter(function (r) { return r.관계 === '배우자'; })[0], spT = noRen.상속인.filter(function (r) { return r.관계 === '배우자'; })[0];
  const 배우자비율_공제용 = spT ? spT.지분 : null;
  if (spT && (!spR || spR.지분.표시 !== spT.지분.표시)) notes.push('배우자상속공제 한도의 법정상속분(상증법 §19① D)은 포기한 사람이 포기하지 않은 것으로 보고 셈: ' + spT.지분.표시 + ' (민법상 실제 지분은 ' + (spR ? spR.지분.표시 : '없음') + ')');
  if (p.배우자 && jmYn_(p.배우자.포기) === true) notes.push('배우자가 포기하면 실제 상속받은 금액이 없어 배우자상속공제는 최소 5억원만(상증법 §19④) [확인 필요: 포기한 배우자에 §19④ 적용 예규]');
  if (real.포기.length) {
    notes.push('상속을 포기한 사람(' + real.포기.join(', ') + ')도 세법상 「상속인」(상증법 §2 4호) — 10년 안 사전증여는 상속세 과세가액에 더하고(§13①1호), 받은 사전증여·보험금 등 비율만큼 납부의무·연대납부(§3의2)');
    할일.push({ 무엇: '포기한 사람이 받은 사전증여(10년)·사망보험금·퇴직금 확인 — 포기해도 간주상속재산(§8·§10)은 받을 수 있고 그만큼 상속세 납부의무', 때: '신고 전' });
    할일.push({ 무엇: '상속포기 신고(민법 §1019① — 상속개시를 안 날부터 3개월 안 가정법원) 접수증명 받기', 때: '상속개시를 안 날부터 3개월' });
  }
  if (real.다음순위 && real.포기.length) notes.push('선순위 상속인의 포기로 다음 순위가 받은 재산은 상속공제 한도에서 뺌(상증법 §24 2호) — 계산기 「상속포기 후 다음 순위 상속분」 칸에 그 재산가액을 넣을 것');
  if (real.세대생략.length) notes.push('자녀 포기로 손자녀(' + real.세대생략.join(', ') + ')가 본위상속하면 세대생략 할증 30%(미성년이고 20억 넘으면 40%) 대상(상증법 §27) — 대습상속만 할증에서 빠짐');
  const 대습 = real.상속인.filter(function (r) { return r.지위 === '대습'; });
  if (대습.length) notes.push('대습상속인(' + 대습.map(function (r) { return r.이름; }).join(', ') + ')은 세대생략 할증 없음(상증법 §27 단서) · 상속공제의 자녀공제는 피상속인의 자녀 수로 셈 [확인 필요: 대습 손자녀를 자녀공제에 넣는지]');
  const r = jmWrap_('상속인·법정상속분', reqs, { 순위: real.순위, 상속인: real.상속인, 포기한사람: real.포기, 배우자비율_공제용: 배우자비율_공제용, 다음순위상속: !!(real.다음순위 && real.포기.length), 세대생략할증: real.세대생략, 알림: notes, 할일: 할일 });
  r.표시 += ' · ' + real.상속인.map(function (x) { return x.이름 + ' ' + x.지분.표시; }).join(', ') + (배우자비율_공제용 ? ' · 배우자공제 비율 ' + 배우자비율_공제용.표시 : '');
  r.엔진칸 = 배우자비율_공제용 ? { spouseLegalShareRatio: 배우자비율_공제용.n / 배우자비율_공제용.d } : {}; // 소수 6자리로 넘기면 한도가 1천 원대 모자람 — 분수 그대로
  r.엔진칸뜻 = 'spouseLegalShareRatio = 상속세 배우자공제 한도의 배우자 법정상속분(포기 없던 것으로 본 비율)';
  return r;
}


// [2026.11.02 복잡사건 33 「왕씨 거주자 판정」] ⑩ 거주자·비거주자 판정(소득세법 §1의2①·시행령 §2·§2의2·§3·§4, 상증법 §2 8호·시행령 §2)
//  p: { 기준일(사망일·증여일·양도일), 목적: 상속세|증여세|소득세, 국내주소(예/아니오 — 주민등록이 아니라 생활관계로), 국내가족(생계를 같이하는 가족), 국내자산, 직업183일(계속 183일 국내 거주가 통상 필요한 직업),
//       계속거주예상(직업·자산상 계속 183일 이상 국내 거주 예상), 외국국적또는영주권, 재입국거주예상, 해외파견(내국법인 국외사업장·100% 현지법인 임직원·국외근무 공무원),
//       영주귀국사망(상속세: 영주 목적 귀국 뒤 국내 사망), 국외이전출국일(주소·거소를 국외로 옮기려 출국한 날),
//       국내체류: [{입국, 출국(비우면 기준일까지)}], 일시출국: [{출국, 입국}](관광·질병 치료 등 명백히 일시 — 국내 거소 기간에 넣음, 소득령 §4②) }
//  결론 「충족」 = 거주자
function rsDays_(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
function judgeResidency_(p) {
  p = p || {};
  const 기준 = jmYmd_(p.기준일), 목적 = String(p.목적 || '소득세'), yn = jmYn_, reqs = [], notes = [], 할일 = [];
  const 상증 = /상속|증여/.test(목적);
  // 국내 거소 기간(입국 다음 날 ~ 출국일, 소득령 §4①) — 일시 출국 기간은 국내로 봄(§4②)
  const spans = [];
  (p.국내체류 || []).forEach(function (s) { const a = jmYmd_(s.입국), b = jmYmd_(s.출국) || 기준; if (a && b && b > a) spans.push([a, b < 기준 || !기준 ? b : 기준]); });
  (p.일시출국 || []).forEach(function (s) { const a = jmYmd_(s.출국), b = jmYmd_(s.입국); if (a && b && b >= a) spans.push([a, b]); });
  spans.sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
  const merged = [];
  spans.forEach(function (s) { const l = merged[merged.length - 1]; if (l && s[0] <= l[1]) { if (s[1] > l[1]) l[1] = s[1]; } else merged.push([s[0], s[1]]); });
  let 최장연속 = 0, 연속끝 = '';
  merged.forEach(function (m) { const d = rsDays_(m[0], m[1]); if (d > 최장연속) { 최장연속 = d; 연속끝 = m[1]; } });
  const 해별 = {};
  merged.forEach(function (m) {
    let a = m[0];
    while (a < m[1]) { const y = a.slice(0, 4), yEnd = (+y + 1) + '-01-01', b = m[1] < yEnd ? m[1] : yEnd; 해별[y] = (해별[y] || 0) + rsDays_(a, b); a = b; }
  });
  const 기준해 = 기준 ? 기준.slice(0, 4) : '';
  // 주소(소득령 §2①③④)
  let 주소 = yn(p.국내주소), 주소왜 = '';
  if (주소 !== true) {
    if (yn(p.직업183일) === true) { 주소 = true; 주소왜 = '계속 183일 이상 국내 거주가 필요한 직업 — 주소 있는 것으로 봄(소득령 §2③1호)'; }
    else if (yn(p.국내가족) === true && yn(p.계속거주예상) === true) { 주소 = true; 주소왜 = '국내에 생계를 같이하는 가족 + 직업·자산상 계속 183일 이상 거주 예상(§2③2호)'; }
  }
  if (yn(p.외국국적또는영주권) === true && yn(p.국내가족) === false && yn(p.재입국거주예상) === false) { 주소 = false; 주소왜 = '외국 국적·영주권 + 국내 가족 없음 + 다시 들어와 주로 살 것으로 보이지 않음 — 국내 주소 없는 것으로 봄(§2④)'; }
  if (주소 === null && yn(p.국내가족) === true && yn(p.국내자산) === true) 주소왜 = '국내 가족·자산이 있음 — 생활관계로 주소 있다고 볼 여지(§2①) [확인 필요]';
  reqs.push(jmReq_('국내에 주소가 있음(생활관계 — 가족·자산 등, 주민등록과 다를 수 있음)', 주소, 주소왜, '소득세법 시행령 §2' + (상증 ? '(상증법 시행령 §2①이 따름)' : '')));
  // 거소 183일
  const yr183 = Object.keys(해별).some(function (y) { return 해별[y] >= 183 && (!기준해 || y <= 기준해); });
  const 거소183 = 상증 ? (최장연속 >= 183) : (yr183 || 최장연속 >= 183);
  const 거소왜 = merged.length ? ('국내 거소 ' + Object.keys(해별).map(function (y) { return y + '년 ' + 해별[y] + '일'; }).join(' · ') + ' / 가장 긴 연속 ' + 최장연속 + '일') : '입출국 기록 없음';
  reqs.push(jmReq_('국내에 183일 이상 거소', merged.length ? 거소183 : null, 거소왜 + (상증 ? ' — 상속·증여는 소득령 §4③(1과세기간 합산)을 따르지 않아 연속 기간으로 봄 [확인 필요]' : ''), 상증 ? '상증법 §2 8호·시행령 §2①(소득령 §4①②④)' : '소득세법 §1의2①1호·시행령 §4①~③'));
  // 특례
  const 파견 = yn(p.해외파견) === true, 귀국사망 = 상증 && yn(p.영주귀국사망) === true;
  if (파견) notes.push('내국법인 국외사업장·100% 해외현지법인 파견 임직원·국외근무 공무원은 거주자로 봄(소득령 §3' + (상증 ? ', 상증령 §2②' : '') + ')');
  if (귀국사망) notes.push('비거주자가 영주 목적으로 귀국해 국내에서 사망하면 거주자로 봄(상증법 시행령 §2② 후단)');
  let 거주자 = 파견 || 귀국사망 || 주소 === true || (거소183 && merged.length > 0);
  const 출국 = jmYmd_(p.국외이전출국일);
  if (출국 && 기준 && !파견 && !귀국사망) {
    const 비거주시작 = (function () { const d = new Date(출국 + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    if (기준 >= 비거주시작 && yn(p.국내주소) !== true) { 거주자 = false; notes.push('주소·거소를 국외로 옮기려 ' + 출국 + ' 출국 — 다음 날(' + 비거주시작 + ')부터 비거주자(소득령 §2의2②1호)'); }
  }
  const 모름 = !파견 && !귀국사망 && 주소 === null && !merged.length && !출국;
  const 결론줄 = jmReq_('거주자', (파견 || 귀국사망) ? true : (모름 ? null : 거주자), 거주자 ? '' : '주소·183일 거소 모두 없음 → 비거주자', '상증법 §2 8호·소득세법 §1의2');
  // 결론은 「거주자」 한 줄로 — 주소·거소 줄은 근거로만(둘 중 하나만 있어도 거주자)
  const shown = [결론줄];
  if (모름) 할일.push({ 무엇: '출입국사실증명(최근 2년)·국내 가족·주소·외국 국적·영주권 확인 — 거주자인지에 따라 상속은 과세 범위·공제가, 증여는 공제·연대납부가 달라짐', 때: '판정 전' });
  else if (!거주자) {
    if (/상속/.test(목적)) notes.push('비거주 피상속인: 국내 재산만 과세(상증법 §3 2호)·기초공제 2억원만(§18 — 인적·일괄·배우자·금융재산·동거주택 공제 없음)·사전증여 가산은 국내 재산만(§13②)·신고기한 9개월(§67④)');
    if (/증여/.test(목적)) notes.push('비거주 수증자: 국내 재산만 증여세 과세대상(§4의2①2호, 국외 재산을 거주자가 주면 국제조세조정법 §35②로 증여자가 냄 — 「국외증여」 묶음)·증여재산공제 없음(§53은 거주자만)·증여자 연대납부(§4의2⑥3호 — 같은 항 단서의 의제·추정 증여 §35~§45의5 등은 빼고)·신고기한 그대로 3개월(§68)');
    if (/소득/.test(목적)) notes.push('비거주자 양도: 1세대1주택 비과세(소득세법 §89①3호)·장기보유 표2 없음, 국외자산 양도소득세는 거주자 5년 요건(§118의2)');
    할일.push({ 무엇: '출입국사실증명·외국 거주(영주권·시민권) 서류·국내 가족 주민등록 확인', 때: '판정 전' });
  } else if (/상속/.test(목적) && yn(p.외국국적또는영주권) === true && !귀국사망) notes.push('외국 국적·영주권이 있어도 국내 주소·183일 거소가 있으면 거주자 — 국외 재산까지 과세(§3 1호)·외국납부세액공제(§29)');
  if (/상속/.test(목적) && yn(p.상속인외국주소) === true) notes.push('상속인이 외국에 주소를 두면 신고기한 9개월(§67④)');
  const r = jmWrap_('거주자', shown, { 목적: 목적, 거주자: !!거주자, 주소: 주소, 거소_해별: 해별, 거소_최장연속: 최장연속, 근거줄: reqs, 알림: notes, 할일: 할일 });
  r.표시 = '거주자 판정(' + 목적 + ') — ' + (결론줄.결과 === '?' ? '모름(잠정)' : 거주자 ? '거주자' : '비거주자') + ' · ' + 거소왜;
  r.엔진칸 = 모름 ? {} : /상속/.test(목적) ? { isDecedentResident: !!거주자 } : /증여/.test(목적) ? { isDoneeResident: !!거주자 } : {};
  r.엔진칸늘 = true; // 비거주자(결론 「안 됨」)도 그 값이 계산 칸 — 모를 때만 비움
  r.엔진칸뜻 = 'isDecedentResident = 상속세 피상속인 거주자 여부 · isDoneeResident = 증여세 수증자 거주자 여부';
  return r;
}

// [2026.11.02 복잡사건 36 「진씨 미국 콘도」] ⑪ 국외 증여 — 누가 어느 법으로 증여세를 내나(상증법 §4의2①·국제조세조정법 §35·시행령 §71·§72)
//  p: { 증여일, 증여자거주자, 수증자거주자(거주자 판정 묶음 결과), 재산소재: 국내|국외, 재산종류(부동산·예금·주식 …), 사인증여(증여자 사망으로 효력),
//       특수관계(수증자가 증여자의 국세기본법 §2 20호 특수관계인), 외국증여세: 부과|면제|없음(외국 법령의 증여세 — 면제받은 것도 「부과」로 봄, 국조법 §35③2호 후단),
//       외국납부세액(원, 가산세 빼고), 외국과세표준(원 — 외국 법령의 증여세 과세표준), 시가근거: {종류: 매매|감정|보상, 날짜}, 유가증권(예/아니오) }
//  결론 「충족」 = 우리나라 증여세를 낸다(누가 내는지는 납세의무자)
function fgAddMonths_(ymd, m) { const d = new Date(ymd + 'T00:00:00'); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); }
function judgeForeignGift_(p) {
  p = p || {};
  const yn = jmYn_, 증여일 = jmYmd_(p.증여일), reqs = [], notes = [], 할일 = [];
  const 증여자 = yn(p.증여자거주자), 수증자 = yn(p.수증자거주자), 사인 = yn(p.사인증여) === true;
  const 소재 = /국외|해외|외국/.test(String(p.재산소재 || '')) ? '국외' : /국내/.test(String(p.재산소재 || '')) ? '국내' : '';
  const 외국세 = /면제/.test(String(p.외국증여세 || '')) ? '면제' : yn(p.외국증여세) === true || /부과|냄|납부/.test(String(p.외국증여세 || '')) ? '부과' : yn(p.외국증여세) === false || /없/.test(String(p.외국증여세 || '')) ? '없음' : '';
  const 외국납부 = Math.max(0, Number(p.외국납부세액) || 0), 외국과표 = Math.max(0, Number(p.외국과세표준) || 0);
  let 법 = '', 납세자 = '', 과세 = null, 왜 = '', 엔진칸 = {};
  if (사인) { 과세 = false; 법 = '상속세'; 왜 = '증여자의 사망으로 효력이 생기는 증여(사인증여)는 증여세가 아니라 상속세(상증법 §2 1호·국조법 §35② 괄호)'; }
  else if (수증자 === true) { 과세 = true; 법 = '상증법'; 납세자 = '수증자'; 왜 = '거주자 수증자 — 국내·국외 모든 증여재산(상증법 §4의2①1호)'; 엔진칸 = { isDoneeResident: true }; }
  else if (수증자 === false && 소재 === '국내') { 과세 = true; 법 = '상증법'; 납세자 = '수증자(증여자 연대납부)'; 왜 = '비거주 수증자 — 국내에 있는 증여재산만(§4의2①2호), 증여자 연대납부(§4의2⑥3호)'; 엔진칸 = { isDoneeResident: false }; }
  else if (수증자 === false && 소재 === '국외' && 증여자 === false) { 과세 = false; 왜 = '비거주자가 비거주자에게 국외 재산을 증여 — 우리나라 증여세 없음(상증법 §4의2①2호·국조법 §35②)'; }
  else if (수증자 === false && 소재 === '국외' && 증여자 === true) {
    법 = '국조법 §35'; 납세자 = '증여자';
    const 특수 = yn(p.특수관계);
    if (특수 === false && (외국세 === '부과' || 외국세 === '면제')) { 과세 = false; 왜 = '거주자 → 비거주자 국외 재산 증여지만 특수관계가 아니고 외국에서 증여세가 부과(면제 포함)됨 — 납부의무 면제(국조법 §35③)'; }
    else if (특수 === true || 외국세 === '없음') { 과세 = true; 왜 = '거주자가 비거주자에게 국외 재산을 증여 — 증여자가 우리나라 증여세를 냄(국조법 §35②)' + (특수 === true ? ', 특수관계라 면제 안 됨(§35③1호)' : ', 외국 증여세가 없어 면제 안 됨(§35③2호)'); }
    else { 과세 = null; 왜 = '거주자 → 비거주자 국외 재산 증여 — 증여자 과세(§35②). 면제(§35③)는 비특수관계 + 외국 증여세 부과가 모두 맞아야 함 — ' + (특수 === null ? '특수관계' : '외국 증여세') + '를 모름'; }
    엔진칸 = { isDoneeResident: false };
  } else 왜 = '수증자 거주 여부' + (수증자 === false && !소재 ? '·재산 소재지' : 수증자 === false ? '·증여자 거주 여부' : '') + '를 알아야 함(거주자 판정 묶음으로)';
  reqs.push(jmReq_('우리나라 증여세 납부의무', 과세, 왜, 법 === '국조법 §35' ? '국제조세조정법 §35②③' : '상증법 §4의2①'));
  if (과세 !== false && (외국세 === '부과' || 외국납부 > 0) && 소재 === '국외') {
    엔진칸.foreignTaxPaidAmount = 외국납부; if (외국과표) 엔진칸.foreignGiftTaxBase = 외국과표;
    notes.push('외국납부세액공제 = 외국에 실제 낸 증여세(가산세 빼고), 한도 = 우리 산출세액 × 외국 과세표준 ÷ 우리 과세표준(' + (법 === '국조법 §35' ? '국조법 §35⑤·시행령 §72①②' : '상증법 §59·시행령 §48') + ') — 과세표준은 증여일 기준환율로 원화 환산(국조령 §72③)' + (외국과표 ? '' : ' · 외국 과세표준을 모르면 한도를 못 셈(넣은 납부액 그대로 씀)'));
    if (법 === '국조법 §35') 할일.push({ 무엇: '외국납부세액공제신청서 + 외국 증여세 납부 증명 제출(국조령 §72④) — 외국 결정이 늦으면 결정통지 받은 날부터 3개월 안(§72⑤), 외국에서 세액이 바뀌어도 같음(§72⑥)', 때: '증여세 신고 때' });
  }
  if (법 === '국조법 §35' && 과세 !== false) {
    const 시 = p.시가근거 || {}, sd = jmYmd_(시.날짜);
    if (증여일 && sd) {
      const 안 = sd >= fgAddMonths_(증여일, -6) && sd <= fgAddMonths_(증여일, 6);
      notes.push('시가: ' + (시.종류 || '매매·감정·보상') + ' ' + sd + ' — ' + (안 ? '증여일 전후 6개월 안이라 시가로 씀' : '증여일 전후 6개월 밖이라 시가로 못 씀 → 상증법 §61~§65 준용(평가가 맞지 않으면 감정평가법인등)') + '(국조령 §71①②). 상증법 증여 평가기간(전 6개월~후 3개월, 상증령 §49①)과 다름');
    } else notes.push('시가: 재산이 있는 나라의 증여 당시 현황을 반영한 시가 — 증여일 전후 6개월 안 매매가·공신력 있는 감정가·수용 보상가(국조령 §71①), 없으면 상증법 §61~§65 준용·맞지 않으면 감정평가법인등(§71②)' + (yn(p.유가증권) === true ? ', 유가증권은 상증법 §63(§71③)' : ''));
    notes.push('준용하는 상증법(국조법 §35⑥): §4의2③(소득세·법인세 부과분 제외)·§47(과세가액)·§53(증여재산공제)·§54~§58(과세표준·세율·할증·납부세액공제)·§68(신고 — 증여일이 속하는 달의 말일부터 3개월)·§69②(신고세액공제)·§70~§72(납부·연부연납·가산금)·§76(결정) — §4의2⑥ 연대납부·§59는 준용 목록에 없음');
    notes.push('[확인 필요] 증여재산공제: 국조법 §35⑥이 상증법 §53을 준용하나 §53 본문은 「거주자가 증여를 받은 경우」 — 비거주 수증자에게 공제가 되는지 갈림. 계산은 두 경우(안)로: 공제 없음(isDoneeResident:false) · 공제 있음(isDoneeResident:true)');
    notes.push('[확인 필요] 10년 합산(§47 준용): 같은 증여자가 같은 수증자에게 10년 안 준 국내 재산(상증법, 수증자 납부)과 이번 국외 재산(국조법, 증여자 납부)을 합산하는지 — 납세의무자가 달라 갈림. 두 경우(안)로 견줄 것');
    notes.push('[확인 필요] 증여자가 10년 안 사망하면 이 증여를 상속세 과세가액에 더하는지(상증법 §13①)·더하면 증여자가 낸 국조법 증여세를 §28로 빼는지');
    if (증여일 && 증여일 < '2017-01-01') notes.push('[확인 필요] 2017.1.1. 전 증여는 옛 국조법 §21(면제 요건이 지금과 다름 — 국조법 부칙 §10②)');
    if (증여일) 할일.push({ 무엇: '증여자가 증여세 신고·납부(국조법 §35⑥·상증법 §68)', 때: (function () { const d = new Date(증여일 + 'T00:00:00'); const e = new Date(d.getFullYear(), d.getMonth() + 4, 0); return e.getFullYear() + '-' + String(e.getMonth() + 1).padStart(2, '0') + '-' + String(e.getDate()).padStart(2, '0'); })() + '까지' });
    할일.push({ 무엇: '수증자 비거주 근거(시민권·영주권·출입국사실증명)·특수관계·재산 소재국 증여세 신고서·납부 영수증·시가 자료(전후 6개월 매매·감정)', 때: '신고 전' });
  }
  if (법 === '상증법' && 수증자 === false) notes.push('비거주 수증자: 증여재산공제 없음(상증법 §53은 거주자만)·혼인출산공제 없음(§53의2) · 같은 증여자의 국외 재산 증여는 국조법 §35로 따로(증여자 납부)');
  if (법 === '상증법' && 수증자 === true && 소재 === '국외') notes.push('거주 수증자가 받은 국외 재산 — 외국에서 낸 증여세는 상증법 §59(시행령 §48)로 공제');
  const r = jmWrap_('국외 증여', reqs, { 적용법: 법, 납세의무자: 납세자, 알림: notes, 할일: 할일 });
  r.표시 = '국외 증여 — ' + (과세 === true ? '우리나라 증여세 냄(' + 법 + ', ' + 납세자 + ')' : 과세 === false ? '우리나라 증여세 없음' + (법 === '상속세' ? '(상속세로)' : 법 ? '(' + 법 + ' 면제)' : '') : '모름(잠정)' + (법 ? ' — ' + 법 + ', ' + 납세자 : ''));
  r.엔진칸 = 엔진칸; r.엔진칸늘 = 과세 !== null;
  r.엔진칸뜻 = 'isDoneeResident = 수증자 거주자 여부(국조법 §35는 false — 공제 넣은 경우(안)는 true로 견줌) · foreignTaxPaidAmount = 외국 납부 증여세 · foreignGiftTaxBase = 외국 과세표준';
  return r;
}

var JUDGE_MORE_ = { '국외증여': judgeForeignGift_, '국외 증여': judgeForeignGift_, '국외재산 증여': judgeForeignGift_, '거주자': judgeResidency_, '거주자 판정': judgeResidency_, '비거주자': judgeResidency_, '상속인': judgeHeirShares_, '법정상속분': judgeHeirShares_, '상속인·법정상속분': judgeHeirShares_, '불복기한': judgeAppealDeadline_, '불복': judgeAppealDeadline_, '경정청구기한': judgeAppealDeadline_, '양도여부': judgeTransferScope_, '양도로 보지 않음': judgeTransferScope_, '농지대토': judgeFarmSwap_, '대토': judgeFarmSwap_, '농지대토 감면': judgeFarmSwap_, '법인전환': judgeIncorp32_, '법인전환 이월과세': judgeIncorp32_, '8년자경': judgeSelfFarm_, '자경': judgeSelfFarm_, '8년 자경농지 감면': judgeSelfFarm_, '동거주택': judgeCohabit_, '동거주택 상속공제': judgeCohabit_, '가업상속': judgeFamilyBiz_, '가업상속공제': judgeFamilyBiz_ };
// 사건에서 부름(ledgerJudgeRun_가 1세대1주택이 아닌 묶음을 넘김) — 사실(facts)은 넥스·세무사님이 준 값, 결과는 장부 기록 + 물건 줄 판정 묶음들 + 장부 판정 칸(L.judge)
function judgeMoreRun_(c, input, by) {
  const kind = String(input.묶음 || input.group || ''), fn = JUDGE_MORE_[kind.replace(/\s+/g, ' ').trim()] || JUDGE_MORE_[kind.replace(/\s/g, '')];
  if (!fn) return { ok: false, error: '없는 묶음: ' + kind + ' — 1세대1주택·8년자경·농지대토·양도여부·불복기한·상속인·거주자·동거주택·가업상속·법인전환·국외증여 중 하나' };
  const r = fn(input.facts || input.사실 || {});
  const out = { ok: true, 결과: r, 넣은사실: input.facts || input.사실 || {}, 알림: (r.알림 || []).slice() };
  if (input.write === false) { out.장부 = '보기만 — 장부에 넣지 않음'; return out; }
  const who = String(by || '세무사님').slice(0, 6);
  try {
    ledgerMutate_(c.id, function (L) {
      L.judge = L.judge || {};
      const oid = String(input.objectId || input.물건 || '');
      // [2026.11.02 쪼개 처리 ③] 물건이 여럿이면 물건마다 따로 남긴다(같은 묶음을 두 물건에 돌리면 앞 결과를 덮던 것) — 열쇠 = 묶음@물건id
      L.judge[r.묶음 + (oid ? '@' + oid : '')] = { 결론: r.결론, 잠정: r.잠정, 표시: r.표시, 엔진칸: (r.결론 === '충족' || r.엔진칸늘) ? r.엔진칸 : {}, 요건: r.요건, 할일: r.할일 || [], 때: caseProcNow_(), 누가: who, 사실: input.facts || input.사실 || {}, 물건: oid };
      out.판정열쇠 = 'judge.' + r.묶음 + (oid ? '@' + oid : ''); // 자문 항목 calc·links에 이 열쇠를 넣으면 요약에 판정 결과가 풀려 나온다
      const o = oid && L.obj && Array.isArray(L.obj.list) ? L.obj.list.filter(function (x) { return x && x.id === oid; })[0] : null;
      if (o) { const one = { 묶음: r.묶음, 결론: r.결론, 잠정: !!r.잠정, 남은것: (r.남은것 || []).slice(0, 12), 표시: r.표시, 때: caseProcNow_(), 누가: who }; const list = (o.판정 && Array.isArray(o.판정.묶음들) ? o.판정.묶음들 : []).filter(function (x) { return x && x.묶음 !== r.묶음; }).concat([one]); o.판정 = Object.assign({}, o.판정 || one, { 묶음들: list }); out.물건 = o.id; }
      ledgerLogTo_(L, { by: who, what: '종합판정', path: 'judge.' + r.묶음 + (oid ? '@' + oid : ''), detail: r.표시.slice(0, 200) });
    });
    out.장부 = '판정 기록 — 장부 계산(상속)이 충족이면 엔진칸을 넣고, 잠정·안 됨이면 넣지 않음' + (r.묶음 === '8년 자경농지 감면' ? ' · 양도는 계산 가정(over)으로 isEightYearFarmland를 주어 경우(안)로 견줄 것' : '');
  } catch (e) { out.알림.push('판정 기록 못 남김: ' + e.message); }
  return out;
}
