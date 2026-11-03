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
  } else if (/해제|해약|취소|무효|감액/.test(유형)) {
    // [2026.11.02 복잡사건 59 「진씨 매매 깨짐」] 매매계약 해제·취소·무효·대금 감액 — 예전엔 이 갈래가 없어 넥스가
    //  잔금 뒤 해제를 그대로 양도로 신고하거나, 몰취한 계약금(위약금)을 양도가액에 넣고, 경정청구 기한(안 날부터 3개월)을 놓칠 위험.
    const 잔금 = jmYmd_(p.잔금일), 등기 = jmYmd_(p.등기접수일), 해제 = jmYmd_(p.해제일), 종류 = String(p.해제종류 || (/합의/.test(유형) ? '합의' : /취소/.test(유형) ? '취소' : /무효/.test(유형) ? '무효' : '')).replace(/\s/g, '');
    const 시기 = 잔금 && 등기 ? (잔금 < 등기 ? 잔금 : 등기) : (잔금 || 등기 || '');
    const 감액 = n(p.감액), 원래 = n(p.원래양도가액), hol = p.공휴일 || [];
    if (해제) {
      const 전 = !시기 || 해제 < 시기;
      if (전) reqs.push(jmReq_('양도시기(대금청산일·등기접수일 중 빠른 날) 전에 계약이 끝남', true, 시기 ? '양도시기 ' + 시기 + ' · 해제 ' + 해제 : '잔금·등기 없음 — 이전 자체가 없음', '소득세법 §88 1호(사실상 유상 이전)·시행령 §162①1·2호'));
      if (!전) {
        let ok = null, why = '';
        if (/법정|약정|취소|무효/.test(종류)) { ok = true; why = 종류 + ' — 계약이 처음부터 없던 것이 되어 양도 없음 [확인 필요: 판례 번호]'; }
        else if (/합의/.test(종류)) {
          const 기한 = jmYmd_(p.법정신고기한), 부득 = jmYn_(p.부득이사유);
          if (부득 === true) { ok = true; why = '합의해제지만 계약 성립 뒤 생긴 부득이한 사유(국세기본법 시행령 §25의2 2호)'; }
          else if (기한 && 해제 <= 기한) { ok = true; why = '법정신고기한(' + 기한 + ') 전 합의해제 — 양도 없던 것으로 봄 [확인 필요: 판례·예규]'; }
          else { ok = 부득 === false ? false : null; why = '법정신고기한 뒤 합의해제는 부득이한 사유가 없으면 이미 성립한 양도소득세에 영향 없음 — 되찾는 것은 새 취득 [확인 필요: 판례]'; }
        } else why = '해제 종류(법정·약정·합의·취소·무효)를 모름';
        reqs.push(jmReq_('양도시기 뒤 해제가 양도를 없애는 해제임', ok, '양도시기 ' + 시기 + ' 뒤 ' + 해제 + ' 해제 — ' + why, '국세기본법 §45의2②5호·시행령 §25의2 2호'));
        if (jmYn_(p.신고함) === true && ok !== false) {
          const 끝 = apShift_(apAddM_(해제, 3), hol, []);
          할일.push({ 무엇: '이미 낸 양도소득세 후발적 경정청구(해제를 안 날부터 3개월, 국세기본법 §45의2②5호·시행령 §25의2 2호)', 때: 끝 + '까지' });
        }
        if (jmYn_(p.신고함) !== true && ok === true) notes.push('아직 신고 안 했으면 이 양도는 신고하지 않음 — 다만 해제 증빙(해제 통지·판결·등기 말소)을 보관');
      }
    }
    // 위약금(계약금 몰취·배액 상환) — 양도소득이 아니라 받은 쪽의 기타소득
    const 입장 = String(p.입장 || '매도인'), 받계 = n(p.받은계약금), 돌 = n(p.돌려준금액), 배액 = n(p.배액상환), 받위 = n(p.받은위약금);
    let 기타소득 = 0;
    if (/매도/.test(입장) && 받계 > 돌) { 기타소득 = 받계 - 돌; notes.push('몰취한 계약금 ' + 기타소득.toLocaleString() + '원은 양도가액이 아니라 매도인의 기타소득(소득세법 §21①10호 위약금·배상금) — 필요경비 없음, 계약금이 위약금으로 대체된 것이라 원천징수 안 함 [확인 필요: §127①6호 단서], 다음 해 5월 종합소득 신고(300만원 이하 분리과세 선택 §14③8호 [확인 필요]) — 종합소득세 계산 도구는 없음'); }
    if (/매수/.test(입장) && 받위) { 기타소득 = 받위; notes.push('받은 위약금 ' + 받위.toLocaleString() + '원은 매수인의 기타소득(소득세법 §21①10호) — 계약금을 돌려받은 부분은 소득 아님'); }
    if (/매도/.test(입장) && 배액) notes.push('매도인이 낸 위약금(배액 상환) ' + 배액.toLocaleString() + '원은 뒤에 이 자산을 다른 사람에게 팔 때 양도 필요경비가 아님 [확인 필요: 소득세법 시행령 §163 · 예규] — 받은 매수인은 기타소득');
    // 대금 감액
    let 감액판정 = null;
    if (감액) {
      const 판결 = jmYmd_(p.판결일);
      if (!해제) reqs.push(jmReq_('대금 감액은 양도를 없애지 않음 — 양도는 그대로, 양도가액만 고침', false, '감액 ' + 감액.toLocaleString() + '원', '소득세법 §96①'));
      감액판정 = { 원래양도가액: 원래 || null, 감액: 감액, 고친양도가액: 원래 ? 원래 - 감액 : null };
      if (판결) 할일.push({ 무엇: '양도가액 감액 판결로 경정청구(판결 확정을 안 날부터 3개월, 국세기본법 §45의2②1호)', 때: apShift_(apAddM_(판결, 3), hol, []) + '까지' });
      else notes.push('합의로 깎은 대금은 후발적 경정청구 사유인지 [확인 필요] — 법정신고기한부터 5년 안 일반 경정청구(국세기본법 §45의2①)로 실지거래가액을 바로잡을 것');
      양도부분 = { 무엇: '감액 뒤 양도가액으로 다시 셈', 양도일: 시기 || '', 양도가액: 감액판정.고친양도가액, 근거: '소득세법 §96①(실지거래가액)' };
    }
    if (jmYn_(p.허가구역) === true && jmYn_(p.허가받음) !== true) notes.push('토지거래허가구역에서 허가 없이 맺은 매매는 허가 전까지 효력이 없음(부동산 거래신고법 §11⑥) — 허가를 못 받아 무효로 끝나면 양도 아님, 허가 전 대금청산 뒤 허가받으면 신고기한은 허가일 기준(소득세법 §105①1호 단서). 무효인데 등기가 넘어가 대금을 그대로 가진 경우는 양도로 본 판례가 있음 [확인 필요: 판례 번호]');
    if (jmYn_(p.다시판매) === true) notes.push('해제 뒤 다른 사람에게 다시 팔면 새 양도 — 해제가 양도를 없앴으면 취득일·취득가액은 처음 취득한 때 그대로, 합의해제가 양도로 남았으면 되찾은 날이 새 취득일 [확인 필요]');
    const r0 = jmWrap_('양도로 보지 않음', reqs.length ? reqs : [jmReq_('해제일', null, '해제일을 모름', '소득세법 §88 1호')], { 유형: 유형, 양도시기: 시기, 양도부분: 양도부분, 기타소득_위약금: 기타소득 || undefined, 대금감액: 감액판정 || undefined, 알림: notes, 할일: 할일 });
    r0.엔진칸 = {}; r0.엔진칸뜻 = 감액판정 ? '감액이면 고친 양도가액으로 양도소득세 계산(경우(안))' : '엔진칸 없음 — 「충족」이면 양도소득세 계산 안 함, 위약금은 기타소득';
    return r0;
  } else {
    return jmWrap_('양도로 보지 않음', [jmReq_('유형', null, '공유물분할·토지교환·양도담보·신탁·환지·계약해제 중 하나', '소득세법 §88 1호')], { 알림: ['유형을 모름'], 할일: [] });
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
  // [2026.11.02 복잡사건 60 「현씨 일가 사고」] 예전엔 배우자가 피상속인보다 먼저·같은 날(동시사망 추정, 민법 §30) 사망해도 상속인으로 셈 → 배우자공제까지 붙음
  const spGone = !!(sp && gone_(sp));
  const spIn = sp && !out_(sp) && !spGone;
  const rows = [], 알림 = [], 포기 = [];
  if (spGone) 알림.push(sp.이름 + '(배우자) — 피상속인보다 먼저' + (sp.사망일 && jmYmd_(sp.사망일) === dd ? '·같은 날(동시사망 추정, 민법 §30 — 서로 상속하지 않음)' : '') + ' 사망해 상속인 아님 · 배우자 상속공제 없음(상증법 §19)');
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
    const asc = (p.직계존속 || []).filter(function (a) { if (gone_(a)) return false; if (out_(a)) { 포기.push(a.이름); return false; } return true; });
    if (asc.length) {
      순위 = '2순위 직계존속' + (spIn ? '·배우자' : '');
      share_((spIn ? [{ 이름: sp.이름, 관계: '배우자', w: 3 }] : []).concat(asc.map(function (a) { return { 이름: a.이름, 관계: '직계존속', w: 2 }; }))).forEach(function (m) { rows.push({ 이름: m.이름, 관계: m.관계, 지위: '본위', 지분: m.지분 }); });
      if (anyChild) 다음순위 = true;
    } else if (spIn) {
      순위 = '배우자 단독'; rows.push({ 이름: sp.이름, 관계: '배우자', 지위: '본위', 지분: hsFr_(1, 1) });
    } else {
      const sib = (p.형제자매 || []).filter(function (a) { if (gone_(a)) return false; if (out_(a)) { 포기.push(a.이름); return false; } return true; });
      if (sib.length) { 순위 = '3순위 형제자매'; share_(sib.map(function (a) { return { 이름: a.이름, 관계: '형제자매', w: 1 }; })).forEach(function (m) { rows.push({ 이름: m.이름, 관계: m.관계, 지위: '본위', 지분: m.지분 }); }); 다음순위 = true; }
    }
  }
  if (sp && !spIn && !spGone) 포기.push(sp.이름 + '(배우자)');
  return { 순위: 순위, 상속인: rows, 포기: 포기, 다음순위: 다음순위, 세대생략: 세대생략, 알림: 알림 };
}
function judgeHeirShares_(p) {
  p = p || {};
  // [2026.11.02 복잡사건 60] 실종선고 — 민법상 사망 = 실종기간 만료일(§28, 상속인은 그날 기준), 세법상 상속개시일 = 실종선고일(상증법 §2 2호) → 신고기한·평가기준일이 달라짐
  const 실종선고 = jmYmd_(p.실종선고일), 만료 = jmYmd_(p.실종기간만료일);
  if (만료 && !jmYmd_(p.사망일)) p = Object.assign({}, p, { 사망일: 만료 });
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
  // [2026.11.02 복잡사건 60] 태아(민법 §1000③ 상속순위는 출생한 것으로 봄)·자녀공제·미성년자공제(상증법 §20①1·2호, 태아는 §20② — 2023.1.1 이후 상속개시) 칸을 판정이 셈
  const 개시 = 실종선고 || jmYmd_(p.사망일), 사람 = {};
  (p.자녀 || []).forEach(function (c) { 사람[c.이름] = c; (c.대습 || []).forEach(function (x) { 사람[x.이름] = x; }); (c.자녀 || []).forEach(function (x) { 사람[x.이름] = x; }); });
  const 태아 = Object.keys(사람).filter(function (k) { return jmYn_(사람[k].태아) === true; });
  if (태아.length) { notes.push('태아(' + 태아.join(', ') + ')는 상속순위에서 이미 태어난 것으로 봄(민법 §1000③) — 살아서 태어나야 상속인(사산이면 처음부터 빼고 다시 나눔) [확인 필요: 판례]. 상속세는 태아도 자녀공제 5천만원·미성년자공제 1천만원×19년(상증법 §20②, 2023.1.1 이후 상속개시) — 출생 전 신고면 출생 사실을 신고 뒤 확인'); 할일.push({ 무엇: '태아 출생 확인(출생증명) — 사산이면 상속인·법정상속분·공제를 다시 셈', 때: '출생 뒤 바로' }); }
  const kids = (p.자녀 || []).filter(function (c) { return !(jmYn_(c.결격) === true) && !(c.사망일 && jmYmd_(p.사망일) && jmYmd_(c.사망일) <= jmYmd_(p.사망일)); });
  const 자녀수 = (p.자녀 || []).length ? kids.length : null;
  let 미성년연수 = 0, 미성년 = [], 생일모름 = [];
  real.상속인.forEach(function (h) {
    if (h.관계 === '배우자') return;
    const x = 사람[h.이름] || {};
    if (jmYn_(x.태아) === true) { 미성년연수 += 19; 미성년.push(h.이름 + ' 19년(태아)'); return; }
    const b = jmYmd_(x.생년월일);
    if (!b) { if (/직계비속|대습/.test(h.관계)) 생일모름.push(h.이름); return; }
    const n19 = famAddY_(b, 19);
    if (개시 && 개시 < n19) { const y = Math.ceil(jmDays_(개시, n19) / 365.25 - 1e-9); 미성년연수 += y; 미성년.push(h.이름 + ' ' + y + '년'); }
  });
  if (미성년.length) notes.push('미성년자공제(상증법 §20①2호 — 상속인(배우자 제외)·동거가족 중 미성년자, 19세까지 연수×1천만원, 1년 미만 끝수는 1년 [확인 필요: 시행령 끝수 조항]): ' + 미성년.join(', ') + ' — 상속인 아닌 동거가족 미성년자는 따로 더할 것');
  if (생일모름.length) notes.push('생년월일을 몰라 미성년자공제를 못 셈: ' + 생일모름.join(', '));
  if (자녀수 != null) notes.push('자녀공제 자녀 수 ' + 자녀수 + '명(먼저·같은 날 사망한 자녀 제외, 포기한 자녀·태아 포함 [확인 필요: 포기·대습 자녀공제 예규])');
  let 세법개시 = null;
  if (실종선고) {
    const y = +실종선고.slice(0, 4), m = +실종선고.slice(5, 7) + (jmYn_(p.국외주소) === true ? 9 : 6), due = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    세법개시 = { 상속개시일: 실종선고, 민법상_사망간주일: 만료 || jmYmd_(p.사망일) || '', 신고기한: due, 근거: '상증법 §2 2호 단서(실종선고로 상속이 개시되면 실종선고일)·§60①(평가기준일)·§67①(그 달 말일부터 6개월, 국외 주소 9개월) · 상속인은 민법 §28 실종기간 만료일 기준' };
    notes.push('실종선고: 상속인·법정상속분은 실종기간 만료일(' + (세법개시.민법상_사망간주일 || '모름') + ') 기준(민법 §28), 상속세 상속개시일·평가기준일은 실종선고일 ' + 실종선고 + '(상증법 §2 2호) — 신고기한 ' + due + ' · 세율·공제는 실종선고일에 시행되던 법 [확인 필요]');
    할일.push({ 무엇: '상속세 신고(실종선고일 기준)', 때: due + '까지' });
  } else if (만료) notes.push('실종기간이 끝났어도 실종선고 전이면 상속세 상속개시일이 아직 없음(상증법 §2 2호) — 실종선고일을 받으면 다시 돌림');
  const r = jmWrap_('상속인·법정상속분', reqs, { 세법상_상속개시: 세법개시 || undefined, 자녀공제_자녀수: 자녀수 == null ? undefined : 자녀수, 미성년자공제_연수: 미성년연수 || undefined,  순위: real.순위, 상속인: real.상속인, 포기한사람: real.포기, 배우자비율_공제용: 배우자비율_공제용, 다음순위상속: !!(real.다음순위 && real.포기.length), 세대생략할증: real.세대생략, 알림: notes, 할일: 할일 });
  r.표시 += ' · ' + real.상속인.map(function (x) { return x.이름 + ' ' + x.지분.표시; }).join(', ') + (배우자비율_공제용 ? ' · 배우자공제 비율 ' + 배우자비율_공제용.표시 : '');
  r.엔진칸 = 배우자비율_공제용 ? { spouseLegalShareRatio: 배우자비율_공제용.n / 배우자비율_공제용.d } : {}; // 소수 6자리로 넘기면 한도가 1천 원대 모자람 — 분수 그대로
  r.엔진칸뜻 = 'spouseLegalShareRatio = 상속세 배우자공제 한도의 배우자 법정상속분(포기 없던 것으로 본 비율)';
  if (p.배우자 && (p.배우자.이름 || p.배우자 === true) && !real.상속인.some(function (x) { return x.관계 === '배우자'; }) && !(p.배우자.포기 && jmYn_(p.배우자.포기) === true)) { r.엔진칸.hasSpouse = false; r.엔진칸뜻 += ' · hasSpouse=false(배우자가 먼저·같은 날 사망)'; }
  if (자녀수 != null) { r.엔진칸.childCount = 자녀수; r.엔진칸뜻 += ' · childCount = 자녀공제 자녀 수'; }
  if (미성년연수) { r.엔진칸.minorHeirRemainingYears = 미성년연수; r.엔진칸뜻 += ' · minorHeirRemainingYears = 상속인 미성년자 19세까지 연수 합(태아 19)'; }
  if (세법개시) { r.엔진칸.dateOfDeath = 세법개시.상속개시일; r.엔진칸뜻 += ' · dateOfDeath = 실종선고일(세법상 상속개시일)'; }
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

// [2026.11.02 복잡사건 61 「민씨 빚 상속」] ⑨ 한정승인 — 빚이 재산보다 많은 상속. 예전엔 이 판정이 없어 넥스가
//  ① 한정승인 기한(안 날부터 3개월)·특별한정승인(채무초과를 안 날부터 3개월)을 못 세고 ② 「한정승인이면 상속세·양도세 없음」으로 볼 위험
//  — 실제로는 채무 초과분은 0으로 끊기고(상증법 §13① 후단) 사전증여는 그대로 더해 상속세가 나오며, 상속재산이 경매로 팔리면 그 양도소득세는
//  상속인이 냄(취득가액 = 상속개시일 평가액, 소득세법 시행령 §163⑨). 평가액을 기준시가로 낮게 신고하면 경매 차익만큼 상속인 고유재산에서 세금이 나감.
//  p: { 사망일, 안날(상속개시를 안 날 — 없으면 사망일), 한정승인신고일, 채무초과안날(특별한정승인), 중대과실없음(예), 포기신고일, 공휴일:[…],
//       재산:[{이름, 종류, 평가액, 평가방법(시가|기준시가|공시가격), 경매일(또는 매각일), 경락가, 필요경비, 피상속인취득일}],
//       채무, 공과금, 장례비, 사전증여:[{받은사람, 상속인(예/아니오), 금액, 증여일, 과세표준, 낸증여세}], 국외주소(예) }
function judgeLimitedAccept_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const 사망 = jmYmd_(p.사망일), 안날 = jmYmd_(p.안날) || 사망, 신고 = jmYmd_(p.한정승인신고일), 초과안날 = jmYmd_(p.채무초과안날), hol = p.공휴일 || [];
  const reqs = [], notes = [], 할일 = [];
  if (!사망) return jmWrap_('한정승인', [jmReq_('사망일', null, '사망일을 모름', '민법 §1019')], { 알림: ['사망일을 모름'], 할일: [] });
  // 1) 기한 — 민법 §1019① 상속개시 있음을 안 날부터 3개월(첫날 불산입 §157, 끝 §159·§160, 토·공휴일이면 다음 날 §161)
  const 기한1 = apShift_(apAddM_(안날, 3), hol, []);
  let 특별 = false;
  if (신고) {
    if (신고 <= 기한1) reqs.push(jmReq_('상속개시를 안 날부터 3개월 안 한정승인 신고', true, '안 날 ' + 안날 + ' · 마감 ' + 기한1 + ' · 신고 ' + 신고, '민법 §1019①·§1030'));
    else if (초과안날) {
      const 기한2 = apShift_(apAddM_(초과안날, 3), hol, []); 특별 = true;
      reqs.push(jmReq_('특별한정승인 — 채무초과를 중대한 과실 없이 3개월 안에 알지 못했고, 안 날부터 3개월 안 신고', 신고 <= 기한2 ? (jmYn_(p.중대과실없음) === false ? false : jmYn_(p.중대과실없음) === true ? true : null) : false,
        '처음 마감 ' + 기한1 + ' 지남 · 채무초과 안 날 ' + 초과안날 + ' · 마감 ' + 기한2 + ' · 신고 ' + 신고 + (jmYn_(p.중대과실없음) == null ? ' — 중대한 과실 없었는지(입증 책임 상속인) [확인 필요]' : ''), '민법 §1019③'));
    } else reqs.push(jmReq_('상속개시를 안 날부터 3개월 안 한정승인 신고', false, '마감 ' + 기한1 + ' 지나 ' + 신고 + ' 신고 — 채무초과를 늦게 알았으면 채무초과안날을 넣어 특별한정승인으로 다시', '민법 §1019①·③'));
  } else {
    reqs.push(jmReq_('한정승인 신고', null, '아직 신고 안 함 — 마감 ' + 기한1 + '(그 안에 재산목록 첨부해 가정법원에 신고)', '민법 §1019①·§1030'));
    할일.push({ 무엇: '한정승인 신고(가정법원, 상속재산 목록 첨부) — 안 하면 단순승인으로 봄(민법 §1026 2호)', 때: 기한1 + '까지' });
  }
  if (jmYmd_(p.포기신고일)) notes.push('상속포기(민법 §1041)를 고르면 다음 순위(손자녀·직계존속·형제자매)로 빚이 넘어가 그들도 포기·한정승인해야 함 — 한정승인은 순위가 안 넘어감. 포기자도 상증법 §13①1호의 「상속인」이라 10년 안 사전증여 합산은 그대로 [확인 필요: 대법원 1993.9.28. 93누8092]');
  // 2) 상속세 — 채무 초과분은 없는 것으로(§13① 후단), 사전증여는 그대로 가산(상속인 10년·그 밖 5년, §13①1·2호)
  const 평가끝 = apAddM_(사망, 6), 평가시작 = apAddM_(famAddY_(사망, -1), 6);
  const 시가로 = function (x) { const d = jmYmd_(x.경매일), v = n(x.경락가); return d && v && d >= 평가시작 && d <= 평가끝 ? v : n(x.평가액); };
  const 재산 = (p.재산 || []), 신고합 = 재산.reduce(function (t, x) { return t + n(x.평가액); }, 0), 재산합 = 재산.reduce(function (t, x) { return t + 시가로(x); }, 0), 채무 = n(p.채무), 공과 = n(p.공과금);
  if (재산합 !== 신고합) notes.push('평가기간 안 경매가 있어 상속재산 합계를 경락가로 고침: ' + 신고합.toLocaleString() + ' → ' + 재산합.toLocaleString() + '원(상증법 §60②)');
  const 순 = 재산합 - 채무 - 공과, 초과 = Math.max(0, -순);
  const 증여 = (p.사전증여 || []).map(function (g) {
    const d = jmYmd_(g.증여일), 상속인 = jmYn_(g.상속인) !== false, 한 = 상속인 ? 10 : 5, 안 = d ? famAddY_(d, 한) > 사망 : null;
    return { 받은사람: g.받은사람 || '', 상속인: 상속인, 금액: n(g.금액), 증여일: d, 합산: 안, 과세표준: n(g.과세표준), 낸증여세: n(g.낸증여세), 근거: '상증법 §13①' + (상속인 ? '1호(상속인 10년)' : '2호(상속인 아닌 자 5년)') };
  });
  const 가산 = 증여.filter(function (g) { return g.합산 === true; }), 가산합 = 가산.reduce(function (t, g) { return t + g.금액; }, 0);
  const 과세가액 = Math.max(0, 순) + 가산합;
  if (초과) notes.push('채무·공과금이 재산보다 ' + 초과.toLocaleString() + '원 많음 — 그 초과분은 없는 것으로 보고(상증법 §13① 후단) 사전증여 ' + 가산합.toLocaleString() + '원에서 빼지 않음 → 상속세 과세가액 ' + 과세가액.toLocaleString() + '원. 한정승인이어도 사전증여를 받은 상속인은 상속세를 낼 수 있음');
  if (가산합) notes.push('상속세 납부의무: 상속인은 「상속으로 얻은 재산」 비율로 내고, 연대납부는 각자 받았거나 받을 재산 한도(상증법 §3의2①·③) — 사전증여 재산이 그 한도에 드는지 [확인 필요: 시행령 §3①]. 이미 낸 증여세는 공제(§28)');
  증여.filter(function (g) { return g.합산 === false; }).forEach(function (g) { notes.push(g.받은사람 + ' ' + g.증여일 + ' 증여는 ' + (g.상속인 ? 10 : 5) + '년 지나 합산 안 함'); });
  if (채무) notes.push('채무 공제는 입증된 것만(상증법 §14①·④, 시행령 §10① — 금융회사 채무는 확인서, 개인 채무는 차용증·이자 지급 등). 개인 사채를 입증 못 하면 초과분이 줄고 과세가액이 늘 수 있음');
  const 신고기한 = (function () { const y = +사망.slice(0, 4), m = +사망.slice(5, 7) + (jmYn_(p.국외주소) === true ? 9 : 6); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); })();
  할일.push({ 무엇: '상속세 신고(과세가액 0이어도 사전증여가 있으면 낼 세액 확인, 채무 입증 서류)', 때: 신고기한 + '까지' });
  // 3) 상속재산 경매·매각 — 양도소득세는 상속인 몫, 평가기간 안 경락가는 상속재산 시가
  const 결정기한 = apAddM_(신고기한, 9);
  const 양도 = [];
  재산.forEach(function (x) {
    const 경매 = jmYmd_(x.경매일), 경락 = n(x.경락가); if (!경매 || !경락) return;
    const 평가 = n(x.평가액), 방법 = String(x.평가방법 || ''), 경비 = n(x.필요경비), 안쪽 = 경매 >= 평가시작 && 경매 <= 평가끝;
    let 취득가액 = 평가, 말 = '';
    if (안쪽 && 경락 !== 평가) { 취득가액 = 경락; 말 = '평가기간(' + 평가시작 + '~' + 평가끝 + ') 안 경매 — 경락가 ' + 경락.toLocaleString() + '원이 상속재산 시가(상증법 §60②, 시행령 §49①3호) → 상속세 평가액을 경락가로 고치고(' + (경락 > 평가 ? '수정신고' : '경정청구') + ') 양도 취득가액도 같은 값 [확인 필요: §49①3호 단서 제외 사유]'; }
    else if (!안쪽 && 경매 <= 결정기한 && 경락 > 평가 && !/^시가|감정/.test(방법)) 말 = '평가기간 밖이지만 법정결정기한(' + 결정기한 + ') 안 — 평가심의위원회 심의로 경락가가 시가가 될 수 있음(시행령 §49① 단서, 사건 20 판정) · 지금 신고 평가액이면 차익만큼 양도소득세';
    else if (!안쪽 && 경락 < 평가 && 경매 <= apAddM_(신고기한, 12)) 말 = '경락가가 평가액보다 낮음 — 상속세 신고기한부터 1년 안 경매면 상속세 경정청구 특례(상증법 §79①2호·시행령 §81, 사건 15 도구)';
    const 차익 = Math.max(0, 경락 - 취득가액 - 경비);
    양도.push({ 이름: x.이름 || '', 양도일: 경매, 양도가액: 경락, 취득가액: 취득가액, 취득일: 사망, 필요경비: 경비, 양도차익: 차익, 세율보유기간시작: jmYmd_(x.피상속인취득일) || '모름', 알림: 말,
      근거: '양도인 = 상속인(한정승인이어도 소유권은 상속인, 경매도 양도 — 소득세법 §88 1호) · 취득가액 = 상속개시일 평가액(소득세법 시행령 §163⑨) · 세율 보유기간은 피상속인 취득일부터(소득세법 §104②1호)·장기보유공제는 상속개시일부터(§95④)' });
  });
  if (양도.length) {
    const 합 = 양도.reduce(function (t, r) { return t + r.양도차익; }, 0);
    notes.push('상속재산 경매·매각 ' + 양도.length + '건 — 양도소득세 납세의무자는 한정승인한 상속인이고, 그 세금은 상속채무가 아니라 상속인 고유의 세금으로 보는 판례가 있어 상속재산 한도로 끊기지 않을 수 있음 [확인 필요: 대법원 판례 번호·배당 순위] · 양도차익 합계 ' + 합.toLocaleString() + '원');
    양도.forEach(function (r) { if (r.알림) notes.push(r.이름 + ': ' + r.알림); 할일.push({ 무엇: r.이름 + ' 양도소득세 예정신고(경매 대금 완납일 = 양도일, 소득세법 §105)', 때: new Date(Date.UTC(+r.양도일.slice(0, 4), +r.양도일.slice(5, 7) + 2, 0)).toISOString().slice(0, 10) + '까지' }); });
    notes.push('절세 길: 상속세 신고 때 시가(감정·평가기간 안 경락가)로 평가해 두면 경매 차익이 줄어 양도소득세가 줄어듦(상속세는 채무 초과로 0일 때 손해 없음) · 상속재산 파산(채무자회생법 §299)으로 파산관재인이 팔 때 납세의무 [확인 필요]');
  }
  const r = jmWrap_('한정승인', reqs, { 특별한정승인: 특별 || undefined, 한정승인마감: 기한1, 재산합계: 재산합, 채무공과합계: 채무 + 공과, 채무초과액: 초과, 사전증여가산: 가산, 상속세과세가액: 과세가액, 상속세신고기한: 신고기한, 경매양도: 양도, 알림: notes, 할일: 할일 });
  r.엔진칸 = { dateOfDeath: 사망, taxableEstateAmount: 과세가액, priorGiftedAmountIncludedInEstate: 가산합, debtExcessAmount: 초과,
    nonHeirPriorGiftAmountTotal: 가산.filter(function (g) { return !g.상속인; }).reduce(function (t, g) { return t + g.금액; }, 0), nonHeirPriorGiftTaxableBaseTotal: 가산.filter(function (g) { return !g.상속인; }).reduce(function (t, g) { return t + g.과세표준; }, 0), nonHeirPriorGiftTaxPaidTotal: 가산.filter(function (g) { return !g.상속인; }).reduce(function (t, g) { return t + g.낸증여세; }, 0),
    priorGiftHeirs: 가산.filter(function (g) { return g.상속인; }).map(function (g) { const h = { name: g.받은사람, priorGiftAmount: g.금액, priorGiftTaxableBase: g.과세표준, priorGiftTaxPaid: g.낸증여세 }; if (순 <= 0) h.heirTaxableAmount = g.금액; return h; }) };
  // 순재산이 0 이하면 상속인 각자의 상속세 과세가액상당액 = 각자의 사전증여(상속받은 순재산이 없음) — 이 칸이 없으면 엔진이 상속인별 안분 비율을 못 구해 증여세액공제(§28)가 0이 됨
  if (순 > 0 && 가산.some(function (g) { return g.상속인 && g.낸증여세; })) notes.push('증여세액공제(상증법 §28) 상속인별 한도를 셈하려면 상속인마다 실제 받은 상속재산(actualInheritedValue)을 상속세 계산기에 넣을 것');
  if (p.장례비 != null && p.장례비 !== '') r.엔진칸.funeralCostAmount = n(p.장례비);
  r.엔진칸늘 = true;
  r.엔진칸뜻 = '상속세 계산기 칸 — 과세가액 = max(0, 재산 − 채무 − 공과금) + 합산 사전증여(장례비는 funeralCostAmount로 따로, 상속재산보다 큰 부분은 엔진이 안 뺌) · 경매양도 줄은 양도소득세 계산기에(취득가액·취득일 = 상속개시일 평가액·사망일)';
  return r;
}

// [2026.11.02 복잡사건 62 「곽씨 식당 넘김」] 기타자산·영업권·회원권 — 무엇이 양도소득이고 무엇이 기타소득·사업소득인지 품목마다 가르고,
//  양도소득이면 엔진칸(assetType other + rightOrOtherKind misc_other: 단기세율·장기보유특별공제 없음, 개산공제 1%)을, 기타소득이면 필요경비 60%로 셈.
//  넥스 양도 도구에 기타자산 표시가 없어 회원권을 1년 안에 팔면 단기세율 50%, 영업권을 오래 가졌으면 장기보유특별공제가 붙던 것을 막는다.
//  - 영업권(인허가 이익 포함): 사업에 쓰던 토지·건물(1호)·부동산 권리(2호)와 함께 넘기면 양도소득 기타자산(소득세법 §94①4호가) / 따로 넘기면 기타소득(§21①7호, 시행령 §41③)
//  - 점포 임차권: 사업소득이 나는 점포의 임차인 지위를 넘긴 이익 = 기타소득(§21①7호 괄호, 시행령 §41④) — 필요경비 받은 금액의 60%(시행령 §87 1호의2)
//  - 회원권·시설물이용권, 주식 형태 회원권: 양도소득 기타자산(§94①4호나, 주식이어도 §94②로 4호) — 기준시가는 지방세 시가표준액(시행령 §165⑧3호)·주식은 ⑧1호
//  - 이축권: 토지와 함께 넘기고 따로 평가해 신고하지 않으면 기타자산(§94①4호마) — 양도 도구 hasRelocationRight·relocationRightAppraisalValue 칸
//  - 사업용 기계·비품·차량: 복식부기의무자면 사업소득(§19①20호, 시행령 §37의2), 아니면 양도소득·사업소득 목록 어디에도 없음
//  p: { 양도일, 복식부기의무자(예/아니오), 품목:[{이름, 종류(영업권|인허가|점포임차권|회원권|주주회원권|이축권|설비|차량|비품), 함께양도부동산(예/아니오 — 사업에 쓰던 토지·건물·부동산 권리),
//       별도평가신고(이축권), 양도가액, 취득가액, 취득일, 실제경비, 가액구분(예/아니오 — 계약서에 품목별 값이 나뉘어 있나)}] }
function judgeOtherAsset_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const 양도 = jmYmd_(p.양도일), 복식 = jmYn_(p.복식부기의무자), reqs = [], notes = [], 할일 = [], 판정 = [];
  let 양도합 = 0, 기타합 = 0, 사업합 = 0, 잠정 = false;
  (p.품목 || []).forEach(function (it, i) {
    const 이름 = it.이름 || ('품목 ' + (i + 1)), 종 = String(it.종류 || ''), 가 = n(it.양도가액), 취 = it.취득가액 == null || it.취득가액 === '' ? null : n(it.취득가액), 취일 = jmYmd_(it.취득일) || null;
    const 함께 = jmYn_(it.함께양도부동산), row = { 이름: 이름, 종류: 종, 양도가액: 가 };
    const 양도칸 = function () { const e = { assetType: 'other', rightOrOtherKind: 'misc_other', transferDate: 양도 || undefined, transferPrice: 가 }; if (취 != null && 취 > 0) e.acquisitionPrice = 취; if (취일) e.acquisitionDate = 취일; if (n(it.실제경비)) e.necessaryExpenses = n(it.실제경비); return e; };
    const 기타 = function () { const 경비 = Math.max(Math.floor(가 * 0.6), n(it.실제경비)), 금액 = Math.max(0, 가 - 경비); return { 필요경비: 경비, 기타소득금액: 금액, 원천징수_소득세: Math.floor(금액 * 0.2 / 10) * 10, 원천징수_지방소득세: Math.floor(금액 * 0.02 / 10) * 10, 분리과세_선택: 금액 <= 3000000 }; };
    if (/점포/.test(종)) {
      row.소득 = '기타소득'; row.근거 = '소득세법 §21①7호(괄호 점포 임차권)·시행령 §41④, 필요경비 시행령 §87 1호의2';
      if (함께 === true) { row.소득 = '양도소득(기타자산)'; row.근거 = '소득세법 §94①4호가 — 등기된 부동산임차권·전세권(§94①2호) 등과 함께 넘긴 영업권, 시행령 §41③'; row.엔진칸 = 양도칸(); }
      else row.기타소득 = 기타();
    } else if (/영업권|인허가|권리금/.test(종)) {
      if (함께 === true) { row.소득 = '양도소득(기타자산)'; row.근거 = '소득세법 §94①4호가·시행령 §41③(1호·2호 자산과 함께 넘긴 영업권은 기타소득 아님)'; row.엔진칸 = 양도칸(); row.기준시가 = '상증법 시행령 §59② 준용 평가액(소득세법 시행령 §165⑧2호) — 넥스 도구 calculate_goodwill_value'; }
      else if (함께 === false) { row.소득 = '기타소득'; row.근거 = '소득세법 §21①7호(영업권), 필요경비 시행령 §87 1호의2'; row.기타소득 = 기타(); }
      else { 잠정 = true; row.소득 = '모름 — 두 경우'; row.근거 = '§94①4호가 / §21①7호'; row.엔진칸 = 양도칸(); row.기타소득 = 기타(); reqs.push(jmReq_(이름 + ' — 사업에 쓰던 토지·건물을 함께 넘겼나', null, '함께면 양도소득 기타자산, 따로면 기타소득(필요경비 60%) — 양수도 계약서로 확인', '소득세법 §94①4호가·§21①7호')); }
      if (row.엔진칸 && (취 == null || 취 === 0)) { notes.push('[확인 필요] ' + 이름 + ': 스스로 일군 영업권은 산 값이 없습니다 — 계산기는 취득가액 0을 받지 않으니 취득가액을 어떻게 볼지(0·환산) 세무사님께 여쭐 것(소득세법 §97①1호, 시행령 §163 — 근거 예규 미확인)'); 할일.push({ 일: 이름 + ' 취득가액(스스로 일군 영업권) 정하기', 근거: '소득세법 §97' }); }
    } else if (/주주회원|주식.*회원|회원.*주식/.test(종)) {
      row.소득 = '양도소득(기타자산)'; row.근거 = '소득세법 §94①4호나 괄호(주식을 가져야 시설을 쓰는 회원권)·§94②(주식이어도 4호)'; row.엔진칸 = 양도칸(); row.기준시가 = '주식 평가(소득세법 §99①3·4호, 시행령 §165⑧1호)';
      notes.push(이름 + ': 주식 계산기(주식 세율 20·25%)가 아니라 기타자산 — 기본세율·부동산과 같은 묶음(§102①1호)');
    } else if (/회원|이용권/.test(종)) {
      row.소득 = '양도소득(기타자산)'; row.근거 = '소득세법 §94①4호나'; row.엔진칸 = 양도칸(); row.기준시가 = '지방세법 시가표준액(소득세법 시행령 §165⑧3호)';
    } else if (/이축/.test(종)) {
      const 별도 = jmYn_(it.별도평가신고);
      if (별도 === true) { row.소득 = '토지와 따로(별도 평가 신고)'; row.근거 = '소득세법 §94①4호마 단서'; notes.push('[확인 필요] ' + 이름 + ': 따로 평가해 신고한 이축권의 소득 구분(기타소득 여부) — §21①7호 "그 밖에 이와 유사한 권리" 해당 여부 근거 미확인'); }
      else { row.소득 = '양도소득(기타자산, 토지와 함께)'; row.근거 = '소득세법 §94①4호마'; row.엔진칸 = Object.assign(양도칸(), { hasRelocationRight: true }); notes.push(이름 + ': 토지 거래 계산기 칸 hasRelocationRight(감정가액 relocationRightAppraisalValue)로 토지와 함께 넣으세요'); }
    } else if (/설비|비품|기계|차량|운반|공구|집기/.test(종)) {
      if (복식 === true) { row.소득 = '사업소득'; row.근거 = '소득세법 §19①20호·시행령 §37의2(복식부기의무자의 사업용 유형자산)'; 사업합 += 가; }
      else if (복식 === false) { row.소득 = '과세 대상 아님'; row.근거 = '양도소득(§94①)·사업소득(§19①20호, 복식부기의무자만) 목록에 없음'; }
      else { 잠정 = true; row.소득 = '모름 — 복식부기의무자면 사업소득'; row.근거 = '소득세법 §19①20호·§160③'; reqs.push(jmReq_('복식부기의무자인가(직전 연도 수입금액, §160③)', null, '설비·차량 처분이 사업소득인지 가름', '소득세법 §19①20호')); }
    } else { row.소득 = '모름'; row.근거 = ''; reqs.push(jmReq_(이름 + ' — 종류', null, '영업권·점포임차권·회원권·주주회원권·이축권·설비 중 무엇인지', '소득세법 §94①4호·§21①7호')); }
    if (row.엔진칸) 양도합 += 가; if (row.기타소득) 기타합 += 가;
    판정.push(row);
  });
  const 양도건 = 판정.filter(function (r) { return r.엔진칸; });
  if (양도건.length) notes.push('기타자산은 단기세율·장기보유특별공제가 없습니다(소득세법 §104①1호·§95②) — 양도 계산기에 rightOrOtherKind "misc_other"를 꼭 넣을 것(빠지면 1년 안 회원권은 50%·오래 가진 영업권엔 장기보유특별공제가 붙음)');
  if (양도건.length) notes.push('기타자산은 토지·건물과 같은 묶음 — 같은 해 부동산 양도가 있으면 양도차손을 서로 빼고 기본공제 250만원은 묶음에 한 번(소득세법 §102①1호·§103①1호), calculate_transfer_tax_multi로 함께');
  if (판정.some(function (r) { return /영업권|인허가|권리금/.test(r.종류) && r.엔진칸; }) && jmYn_((p.품목 || []).find(function (x) { return /영업권|인허가|권리금/.test(String(x.종류 || '')); }).가액구분) !== true) notes.push('[확인 필요] 영업권 값이 계약서에 따로 나뉘지 않았거나 기준시가로 나눈 값과 30% 넘게 다르면 기준시가 비율로 나눔(소득세법 §100②③) — 영업권도 "토지와 건물 등"에 드는지 근거 미확인');
  if (판정.some(function (r) { return r.기타소득; })) notes.push('기타소득은 받은 금액의 20%(지방소득세 2%) 원천징수 대상(소득세법 §129①6호라목) — 기타소득금액 300만원 이하·원천징수되면 분리과세 선택(§14③8호가), 넘으면 다음 해 5월 종합소득세 합산 [원천징수 의무자가 개인 양수인일 때는 확인 필요]');
  if (사업합) notes.push('사업용 설비 처분 ' + 사업합.toLocaleString('ko-KR') + '원은 그 해 사업소득 총수입금액 — 장부가액(감가상각 뒤)을 필요경비로(소득세법 §19①20호, 시행령 §37의2)');
  const r = jmWrap_('기타자산', reqs.length ? reqs : [jmReq_('품목별 소득 구분', 판정.length > 0, 판정.length ? '' : '품목이 없음', '소득세법 §94①4호·§21①7호·§19①20호')], {
    품목판정: 판정, 양도소득_합계: 양도합, 기타소득_받은금액_합계: 기타합, 사업소득_설비: 사업합, 알림: notes, 할일: 할일
  });
  if (잠정) r.잠정 = true;
  return r;
}

// [2026.11.02 복잡사건 63 「표씨 홀로 사망」] 특별연고자 분여 — 상속인 없이 죽은 사람의 재산을 사실혼 배우자·요양간호한 사람 등이 법원 심판으로 나눠 받을 때
//  분여도 상속(상증법 §2 1호다)이라 받은 사람이 상속세를 냄(§3의2①, 영리법인은 ② 주주). 사실혼 배우자는 배우자공제 없음(§19 법률상 배우자).
//  청구 기한(민법 §1057의2② 상속인 수색공고 기간 끝난 뒤 2개월), 신고기한(§67① 상속개시 월말 6개월, ③ 상속재산관리인이 그 안에 선임되면 선임일부터),
//  해석이 갈리는 두 곳(일괄공제 §21이 특별연고자에게 되는지·분여가 공제 한도 §24①1호 "유증등"에 드는지, 국가 귀속분 민법 §1058을 과세가액에 넣는지)은 경우별 엔진칸으로.
//  p: { 사망일, 관리인선임일, 수색공고만료일, 분여청구일, 분여확정일, 재산합계, 채무, 공과금, 장례비, 국외주소,
//       분여:[{이름, 관계(사실혼|생계같이|요양간호|기타), 금액, 영리법인(예)}], 사전증여:[{받은사람, 금액, 증여일, 과세표준, 낸증여세}] }
function judgeSpecialRelation_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const 사망 = jmYmd_(p.사망일), 선임 = jmYmd_(p.관리인선임일), 수색끝 = jmYmd_(p.수색공고만료일), 청구 = jmYmd_(p.분여청구일), 확정 = jmYmd_(p.분여확정일);
  const reqs = [], notes = [], 할일 = [];
  if (!사망) return jmWrap_('특별연고자', [jmReq_('사망일', null, '사망일을 모름', '상증법 §2 2호')], { 알림: ['사망일을 모름'], 할일: [] });
  // 1) 청구 기한 — 민법 §1057의2② 상속인 수색공고(§1057, 1년 이상) 기간이 끝난 뒤 2개월 안
  const 청구마감 = 수색끝 ? apAddM_(수색끝, 2) : null;
  reqs.push(jmReq_('분여 청구 기한(수색공고 기간 끝난 뒤 2개월)', !청구마감 || !청구 ? null : 청구 <= 청구마감, 청구마감 ? '마감 ' + 청구마감 + (청구 ? ' · 청구 ' + 청구 : ' · 청구일 모름') : '수색공고 만료일을 모름', '민법 §1057의2②'));
  const 분여 = p.분여 || [];
  reqs.push(jmReq_('특별연고(생계를 같이함·요양간호·그 밖의 특별한 연고)', 분여.length ? (분여.every(function (x) { return /사실혼|생계|요양|간호|연고|기타/.test(String(x.관계 || '')); }) ? true : null) : null, '법원 심판으로 정해짐 — 심판문 받기', '민법 §1057의2①'));
  // 2) 과세가액 — 재산 − 채무·공과금 − 장례비(엔진이 한도 셈), 특별연고자는 상속인 아님 → 사전증여는 5년 안만(§13①2호)
  const 재산 = n(p.재산합계), 채무 = n(p.채무) + n(p.공과금), 분여합 = 분여.reduce(function (s, x) { return s + n(x.금액); }, 0);
  let 가산 = 0, 가산세액 = 0, 가산과표 = 0;
  (p.사전증여 || []).forEach(function (g) { const d = jmYmd_(g.증여일); if (d && d > famAddY_(사망, -5)) { 가산 += n(g.금액); 가산세액 += n(g.낸증여세); 가산과표 += n(g.과세표준); } });
  const 순 = Math.max(0, 재산 - 채무), 국가귀속 = Math.max(0, 순 - n(p.장례비) - 분여합);
  // 3) 신고기한 — §67① 상속개시 월말부터 6개월(국외 9개월), ③ 관리인이 그 기간 안에 선임되면 선임일부터
  const 기본기한 = (function () { const y = +사망.slice(0, 4), m = +사망.slice(5, 7) + (jmYn_(p.국외주소) === true ? 9 : 6); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); })();
  const 신고기한 = 선임 && 선임 <= 기본기한 ? apAddM_(선임, jmYn_(p.국외주소) === true ? 9 : 6) : 기본기한;
  notes.push('신고기한 ' + 신고기한 + (선임 && 선임 <= 기본기한 ? '(상속재산관리인 선임일 ' + 선임 + '부터 셈 — 상증법 §67③, 선임일이 든 달 말일부터인지는 [확인 필요])' : '(상증법 §67①)'));
  if (확정 && 확정 > 신고기한) { notes.push('[확인 필요] 분여 심판 확정(' + 확정 + ')이 신고기한 뒤 — 특별연고자는 확정 전엔 받을 재산이 없어 신고할 수 없었으므로 기한 뒤 신고 가산세의 정당한 사유(국세기본법 §48①) 해당 여부 근거 미확인. 확정 뒤 곧바로 신고 권함'); 할일.push({ 무엇: '분여 확정 뒤 상속세 기한 후 신고(가산세 감면 신청 함께)', 때: apAddM_(확정, 1) + ' 무렵', 근거: '상증법 §67·국세기본법 §45의3·§48①' }); }
  else 할일.push({ 무엇: '상속세 신고(분여 받은 사람, 심판문 첨부)', 때: 신고기한 + '까지', 근거: '상증법 §67' });
  // 4) 공제 — 배우자공제 없음(사실혼). 일괄공제(§21)는 "상속인이나 수유자"에게 — 특별연고자 해당 여부와 §24①1호 "유증등" 해당 여부가 갈림
  if (분여.some(function (x) { return /사실혼/.test(String(x.관계 || '')); })) notes.push('사실혼 배우자는 상속인이 아니라 배우자공제(상증법 §19) 없음 — 법률상 배우자만');
  notes.push('[확인 필요] 특별연고자에게 일괄공제 5억(상증법 §21① "상속인이나 수유자")이 되는지, 분여 재산이 공제 한도에서 빼는 "선순위 상속인이 아닌 자에게 유증등을 한 재산"(§24①1호, 유증등 = §12 1호 유증·사인증여)에 드는지 — 조문에 분여가 적혀 있지 않음. 경우(가)·(나)로 둘 다 계산');
  notes.push('[확인 필요] 아무도 받지 않아 국가에 귀속되는 재산(민법 §1058 — ' + 국가귀속.toLocaleString('ko-KR') + '원)을 과세가액에 넣는지 — 국가는 납부의무가 없어(§3의2①) 넣으면 그 몫 세금은 걷히지 않고 특별연고자 몫 세율만 올라감. 경우(다)로 계산');
  분여.forEach(function (x) { if (jmYn_(x.영리법인) === true) notes.push(x.이름 + ': 영리법인 특별연고자 — 법인은 상속세 면제, 주주 중 상속인·그 직계비속 등이 지분상당액을 냄(상증법 §3의2②)·법인은 법인세(자산수증이익)'); });
  notes.push('분여 받은 재산을 나중에 팔면 취득가액은 상속개시일 평가액(소득세법 시행령 §163⑨) — 취득시기가 상속개시일인지 심판 확정일인지는 [확인 필요](시행령 §162①5호 "상속 또는 증여")');
  const 과세가액 = 순 + 가산, base = { dateOfDeath: 사망, taxableEstateAmount: 과세가액, funeralCostAmount: n(p.장례비) || undefined, hasSpouse: false, childCount: 0 };
  if (가산) Object.assign(base, { nonHeirPriorGiftAmountTotal: 가산, nonHeirPriorGiftTaxableBaseTotal: 가산과표, nonHeirPriorGiftTaxPaidTotal: 가산세액 });
  const 경우 = [
    { 이름: '(가) 일괄공제 되고 분여는 공제 한도에서 안 뺌', 엔진칸: base },
    { 이름: '(나) 분여를 "유증등"처럼 공제 한도에서 뺌(§24①1호)', 엔진칸: Object.assign({}, base, { nonHeirBequestAmount: 분여합 }) },
    { 이름: '(다) 국가 귀속분을 과세가액에서 뺌', 엔진칸: Object.assign({}, base, { taxableEstateAmount: Math.max(0, 과세가액 - 국가귀속) }) }
  ];
  // 5) 납부 나눔 — 각자 받은 재산 비율(상증법 §3의2①·시행령 §3①, 사전증여 없을 때 단순화), 연대납부는 각자 받은 재산 한도(§3의2③)
  const 나눔 = 분여.map(function (x) { return { 이름: x.이름, 금액: n(x.금액), 비율: 과세가액 ? Math.round(n(x.금액) / 과세가액 * 10000) / 10000 : 0, 영리법인: jmYn_(x.영리법인) === true || undefined }; });
  return jmWrap_('특별연고자', reqs, { 청구마감: 청구마감, 상속세신고기한: 신고기한, 상속세과세가액: 과세가액, 분여합계: 분여합, 국가귀속: 국가귀속, 사전증여가산: 가산, 납부나눔: 나눔, 엔진칸: base, 경우: 경우, 엔진칸늘: true, 알림: notes, 할일: 할일 });
}

// [2026.11.02 복잡사건 64 「길씨 부도 법인」] 출자자(과점주주)의 제2차 납세의무 — 법인 재산으로 체납 국세를 다 못 걷으면 그 국세의 납세의무 성립일 현재 과점주주가
//  부족액 × (자기가 실질적으로 권리를 행사하는 의결권 주식 ÷ 의결권 있는 발행주식 총수)를 한도로 냄(국세기본법 §39 2호·단서). 상장 법인(유가증권·코스닥)은 제외(시행령 §20①).
//  과점주주 = 주주 1명과 특수관계인(친족관계·경제적 연관관계·경영지배관계 일부 — 시행령 §20②·§18의2) 지분 합계가 50% 초과 + 경영에 지배적인 영향력.
//  세목마다 성립일이 달라(§21② 법인세·부가세는 과세기간 끝, ③ 원천징수는 지급 때·예정신고 부가세는 예정신고기간 끝) 성립일마다 지분을 다시 봄 — 그 뒤 주식을 팔아도 책임은 남음.
//  p: { 상장(예/아니오), 기준주주(이름 — 비우면 성립일마다 가장 많이 가진 주주), 발행주식(의결권 있는 주식 총수, 또는 이력 [{날짜, 주식수}]), 통지일(제2차 납세의무 납부고지서 받은 날),
//       체납:[{세목, 과세기간끝 또는 성립일, 원천징수지급일, 예정신고(예), 금액(본세+가산세+강제징수비 중 체납)}], 법인재산충당(법인 재산으로 걷은·걷을 금액),
//       주주:[{이름, 관계(본인|배우자|사실혼|자녀|부모|형제|4촌|인척|임원|사용인|생계의존|타인), 이력:[{날짜, 주식수}] 또는 주식수, 명의만(예 — 이름만 빌려줌), 실질소유자(이름)}] }
function judgeSecondaryLiability_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const reqs = [], notes = [], 할일 = [];
  if (jmYn_(p.상장) === true) return jmWrap_('제2차납세의무', [jmReq_('비상장 법인', false, '유가증권·코스닥 상장 법인은 출자자 제2차 납세의무 없음', '국세기본법 §39 본문 괄호·시행령 §20①')], { 알림: ['상장 법인 — 과점주주 제2차 납세의무 대상 아님'], 할일: [] });
  // 지분 이력에서 그날 현재 주식 수
  const at = function (hist, d, plain) { if (!hist || !hist.length) return n(plain); let v = 0; hist.slice().sort(function (a, b) { return String(a.날짜).localeCompare(String(b.날짜)); }).forEach(function (h) { if (jmYmd_(h.날짜) && jmYmd_(h.날짜) <= d) v = n(h.주식수); }); return v; };
  const total = function (d) { return Array.isArray(p.발행주식) ? at(p.발행주식, d) : n(p.발행주식); };
  // 실질 주주 — 명의만 빌려준 사람의 주식은 실질소유자에게(국세기본법 §14① 실질과세 — 판례 기준은 [확인 필요])
  const 주주 = (p.주주 || []).map(function (s) { return { 이름: s.이름, 관계: String(s.관계 || ''), 이력: s.이력, 주식수: s.주식수, 명의만: jmYn_(s.명의만) === true, 실질: s.실질소유자 }; });
  const 친족 = /본인|배우자|사실혼|자녀|아들|딸|손|부모|아버지|어머니|형제|자매|누나|언니|오빠|동생|4촌|사촌|3촌|삼촌|조카|인척|며느리|사위|처|남편|아내|시|장인|장모/;
  const 연관 = /임원|이사|감사|사용인|직원|생계/;
  // 성립일 — 국세기본법 §21②1호·4호(과세기간 끝), ③1호(원천징수: 지급 때), ③3호(예정신고 부가세: 예정신고기간 끝)
  const 체납 = (p.체납 || []).map(function (t) {
    const 세목 = String(t.세목 || ''); let 성립 = jmYmd_(t.성립일), 근 = '국세기본법 §21';
    if (!성립 && /원천/.test(세목)) { 성립 = jmYmd_(t.원천징수지급일); 근 = '국세기본법 §21③1호(지급하는 때)'; }
    if (!성립) { 성립 = jmYmd_(t.과세기간끝); 근 = /부가/.test(세목) && jmYn_(t.예정신고) === true ? '국세기본법 §21③3호(예정신고기간 끝)' : '국세기본법 §21②1·4호(과세기간 끝)'; }
    return { 세목: 세목, 성립일: 성립, 근거: 근, 금액: n(t.금액) };
  });
  const 체납합 = 체납.reduce(function (s, t) { return s + t.금액; }, 0), 충당 = n(p.법인재산충당);
  const 부족합 = Math.max(0, 체납합 - 충당);
  reqs.push(jmReq_('법인 재산으로 충당해도 부족', !체납.length ? null : (p.법인재산충당 == null || p.법인재산충당 === '' ? null : 부족합 > 0), p.법인재산충당 == null || p.법인재산충당 === '' ? '법인 재산(압류·공매로 걷을 금액)을 모름 — 부족액이 정해져야 한도가 정해짐' : '체납 ' + 체납합.toLocaleString('ko-KR') + '원 − 법인 재산 ' + 충당.toLocaleString('ko-KR') + '원 = 부족 ' + 부족합.toLocaleString('ko-KR') + '원', '국세기본법 §39 본문'));
  // 부족액을 세목별로 나눔 — 충당 순서 미확인이라 체납액 비율로 나눔([확인 필요])
  const 세목별 = 체납.map(function (t) {
    const 부족 = 체납합 ? Math.round(부족합 * t.금액 / 체납합) : 0, d = t.성립일, T = total(d);
    if (!d || !T) return { 세목: t.세목, 성립일: d || '모름', 근거: t.근거, 부족액: 부족, 과점: null, 사람: [], 왜: !d ? '성립일 모름' : '그날 발행주식 수 모름' };
    // 그날 실질 주식 수
    const hold = {};
    주주.forEach(function (s) { const k = s.명의만 && s.실질 ? s.실질 : s.이름; hold[k] = (hold[k] || 0) + at(s.이력, d, s.주식수); });
    const rel = {}; 주주.forEach(function (s) { if (!rel[s.이름]) rel[s.이름] = s.관계; });
    // 관계는 「본인」(기준주주)에 대한 관계 — 본인과 특수관계인은 한 묶음, 관계가 「타인」이거나 비어 있는 주주는 각자 따로 한 묶음(남이 혼자 50% 넘으면 그 사람이 과점주주)
    const 기준 = p.기준주주 || 주주.map(function (s) { return /본인/.test(s.관계) ? s.이름 : null; }).filter(Boolean)[0] || Object.keys(hold).sort(function (a, b) { return hold[b] - hold[a]; })[0];
    const 가족 = Object.keys(hold).filter(function (k) { if (k === 기준) return true; const r = rel[k] || ''; return 친족.test(r) || 연관.test(r) || /경영지배|지배/.test(r); });
    const 묶음들 = [가족].concat(Object.keys(hold).filter(function (k) { return 가족.indexOf(k) < 0; }).map(function (k) { return [k]; }));
    const 잰 = 묶음들.map(function (g) { return { 기준: g[0] === 기준 ? 기준 : g[0], 사람: g, 비율: g.reduce(function (s, k) { return s + hold[k]; }, 0) / T }; }).sort(function (a, b) { return b.비율 - a.비율; });
    const 큰 = 잰[0], 과점 = 큰.비율 > 0.5;
    const 사람 = 과점 ? 큰.사람.filter(function (k) { return hold[k] > 0; }).map(function (k) { return { 이름: k, 주식수: hold[k], 지분: Math.round(hold[k] / T * 10000) / 100, 한도: Math.floor(부족 * hold[k] / T) }; }) : [];
    return { 세목: t.세목, 성립일: d, 근거: t.근거, 부족액: 부족, 기준주주: 큰.기준, 묶음지분: Math.round(큰.비율 * 10000) / 100, 과점: 과점, 사람: 사람, 가족묶음지분: Math.round(가족.reduce(function (s, k) { return s + hold[k]; }, 0) / T * 10000) / 100 };
  });
  const any = 세목별.some(function (x) { return x.과점 === true; }), unknown = 세목별.some(function (x) { return x.과점 === null; });
  reqs.push(jmReq_('성립일 현재 과점주주(주주 1명과 특수관계인 지분 합계 50% 초과)', any ? true : unknown ? null : false, 세목별.map(function (x) { return x.세목 + ' ' + x.성립일 + ' ' + (x.과점 === null ? x.왜 : x.묶음지분 + '%' + (x.과점 ? ' 과점' : ' 과점 아님')); }).join(' · '), '국세기본법 §39 2호·시행령 §20②·§18의2'));
  // 사람별 합계
  const 합계 = {}; 세목별.forEach(function (x) { x.사람.forEach(function (s) { 합계[s.이름] = (합계[s.이름] || 0) + s.한도; }); });
  notes.push('과점주주 여부·지분은 세목마다 그 국세의 납세의무 성립일 현재로 봄(국세기본법 §39 본문) — 성립일 뒤 주식을 팔거나 넘겨도 책임은 그대로, 성립일 전에 판 지분은 책임 없음');
  notes.push('한도 = 부족액 ÷ 의결권 있는 발행주식 총수 × 그 사람이 실질적으로 권리를 행사하는 의결권 주식(§39 단서) — 과점주주끼리 연대해 부족액 전부를 내는 것이 아님');
  notes.push('[확인 필요] "그 법인의 경영에 대하여 지배적인 영향력을 행사하는 자들"(§39 2호 — 이 문구가 들어간 개정 시기·적용 부칙은 법령 폴더 본문에 없어 미확인) — 지분만 가졌고 경영에 관여하지 않은 가족도 과점주주에 드는지. 주주총회 참석·임원 여부·배당 수령 자료로 다툴 수 있음');
  if (주주.some(function (s) { return s.명의만; })) notes.push('[확인 필요] 이름만 빌려준 주주는 실질 권리를 행사하지 않아 제2차 납세의무 없음(실질과세 국세기본법 §14①) — 주식은 실질소유자 몫으로 셈. 명의를 빌려준 사람에게는 명의신탁 증여의제(상증법 §45의2)가 따로 걸릴 수 있음 — 넥스 명의신탁 도구');
  notes.push('[확인 필요] 법인 재산 충당 순서(어느 체납 세목에 먼저 넣는지)를 몰라 부족액을 체납액 비율로 나눔 — 세목마다 과점 여부가 다르면 결과가 달라짐. 세무서 납부고지서의 세목별 금액으로 바꿀 것');
  notes.push('사실혼 배우자도 친족관계(국세기본법 시행령 §1의2①3호)');
  const 통지 = jmYmd_(p.통지일);
  if (통지) { const why = []; const 끝 = apShift_(famAddD_(통지, 90), p.공휴일, why); 할일.push({ 무엇: '제2차 납세의무 납부고지에 대한 이의신청·심사·심판청구(넥스 불복기한 도구로 다시 확인)', 때: 끝 + '까지(고지서 받은 날 다음 날부터 90일' + (why.length ? ', ' + why.join('') : '') + ')', 근거: '국세기본법 §55·§61①·§68①' }); }
  notes.push('다툴 거리: ① 성립일 현재 지분·특수관계 ② 실질 권리 행사(명의주주) ③ 법인 재산 충당이 다 되었는지(부족액) ④ 주된 체납액 자체의 위법 — 주된 납세의무의 부과처분은 제2차 납세의무자도 불복할 수 있는지 [확인 필요]');
  notes.push('범위 밖 한 줄: 과점주주가 되는 때 법인 부동산 등에 대한 취득세 간주취득(지방세법 §7⑤)은 지방세라 이 도구가 보지 않음');
  return jmWrap_('제2차납세의무', reqs, { 체납합계: 체납합, 부족액: 부족합, 세목별: 세목별, 사람별한도: 합계, 알림: notes, 할일: 할일 });
}

// [2026.11.02 복잡사건 65 「봉씨 아들 이름 땅」] 부동산 명의신탁 — 남(가족) 이름으로 등기한 토지·건물이 명의신탁인지 자금 증여인지 가르고, 누가 무엇을 내는지
//  토지·건물은 명의신탁 증여의제(상증법 §45의2①)에서 빠짐(괄호) → 명의신탁이면 증여세가 아니라: 양도소득세는 양도대금이 실제 돌아간 신탁자(실질과세 국세기본법 §14①, 판례 [확인 필요]),
//  신탁자가 죽으면 신탁자의 상속재산, 1세대1주택 판정도 신탁자 기준([확인 필요]). 명의자가 자기 돈이 아닌데 처분권까지 받았다면 명의신탁이 아니라 자금(또는 부동산) 증여(상증법 §2·§4①).
//  부동산실명법(명의신탁 약정 무효 §4, 과징금 §5, 종중·배우자·종교단체 특례 §8)은 법령 폴더에 원문이 없어 조문 내용은 [확인 필요]로만 안내.
//  p: { 신탁자, 명의자, 관계(배우자|종중|종교단체|자녀|부모|형제|타인), 유형(등기명의신탁|계약명의신탁|모름), 자금(신탁자|명의자|섞임), 처분권(신탁자|명의자 — 팔 때 누가 정했나),
//       매도인선의(계약명의신탁에서 판 사람이 명의신탁을 몰랐나), 자산(토지|주택|건물|주식 등), 취득일, 취득가액, 양도일, 양도가액, 대금귀속(신탁자|명의자), 명의자신고(예 — 명의자 이름으로 양도세를 신고했나), 신탁자사망일, 실명전환일 }
function judgeNomineeRealty_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 자산 = String(p.자산 || ''), 관계 = String(p.관계 || ''), 유형 = String(p.유형 || ''), 자금 = String(p.자금 || ''), 처분 = String(p.처분권 || ''), 귀속 = String(p.대금귀속 || '');
  const 부동산 = /토지|땅|주택|아파트|건물|상가|부동산|농지|임야/.test(자산) || !자산;
  if (!부동산) { notes.push('토지·건물이 아닌 재산(주식 등)은 명의신탁 증여의제(상증법 §45의2) 대상 — 넥스 명의신탁(주식) 도구로'); return jmWrap_('부동산명의신탁', [jmReq_('토지·건물', false, 자산 + '은 §45의2 증여의제 대상', '상증법 §45의2① 괄호')], { 알림: notes, 할일: 할일 }); }
  // 1) 명의신탁인가 증여인가 — 돈을 누가 댔고 처분을 누가 정했나
  const 신탁자돈 = /신탁자/.test(자금), 명의자돈 = /명의자/.test(자금), 신탁자처분 = /신탁자/.test(처분) || /신탁자/.test(귀속);
  const 명의신탁 = 신탁자돈 && 신탁자처분 ? true : 명의자돈 ? false : (신탁자돈 && /명의자/.test(처분 + 귀속) ? false : null);
  reqs.push(jmReq_('명의신탁(신탁자가 돈을 대고 처분·대금을 신탁자가 가짐)', 명의신탁, '자금 ' + (자금 || '모름') + ' · 처분권 ' + (처분 || '모름') + ' · 대금 ' + (귀속 || '모름'), '국세기본법 §14①·상증법 §45의2① 괄호'));
  if (명의신탁 === false && 신탁자돈) notes.push('신탁자 돈으로 샀는데 명의자가 처분하고 대금도 가짐 → 명의신탁이 아니라 취득 때 자금(또는 부동산) 증여(상증법 §4①) — 증여일 = 취득일, 증여세 신고기한은 그 달 말일부터 3개월(§68①), 제척기간(국세기본법 §26의2④ 15년 사유 해당 여부 [확인 필요])');
  if (명의신탁 === null) { notes.push('명의신탁인지 증여인지 정해지지 않음 — 경우 (가) 명의신탁 · (나) 취득 때 증여로 둘 다 셈'); 할일.push({ 무엇: '취득 자금 이체 내역·명의신탁 약정서·대금 받은 통장·재산세 낸 사람 확인', 때: '상담 때', 근거: '국세기본법 §14①' }); }
  // 2) 부동산은 증여의제 없음
  notes.push('토지·건물은 명의신탁해도 명의신탁 증여의제(상증법 §45의2①)가 걸리지 않음(괄호에서 뺌) — 명의자에게 증여세를 매기면 다툴 거리');
  // 3) 부동산실명법 — 특례(배우자·종중·종교단체) vs 무효·과징금
  if (/배우자|종중|종교/.test(관계)) notes.push('[확인 필요 — 부동산실명법 원문 없음] 종중·배우자·종교단체 명의 등기는 조세포탈·강제집행 면탈·법령상 제한 회피 목적이 아니면 명의신탁 약정 무효·과징금이 적용되지 않음(부동산실명법 §8) — 이 경우에도 세법상 실질 소유자는 신탁자');
  else notes.push('[확인 필요 — 부동산실명법 원문 없음] 명의신탁 약정·그에 따른 등기는 무효(부동산실명법 §4), 신탁자에게 과징금(§5, 부동산가액 기준)·형사처벌 — 과징금은 국세가 아니라 이 도구가 셈하지 않음' + (/계약/.test(유형) ? '. 계약명의신탁에서 판 사람이 몰랐으면(매도인 선의) 명의자가 소유권을 확정 취득(§4② 단서) — 이때 신탁자는 자금 반환 청구권만 가져 세법상 소유자도 명의자로 볼 여지 [확인 필요]' : ''));
  // 4) 양도소득세 — 납세의무자
  const 양 = jmYmd_(p.양도일), 취 = jmYmd_(p.취득일);
  const 칸 = function () { const e = { assetType: /주택|아파트/.test(자산) ? 'house' : 'general', transferDate: 양 || undefined, transferPrice: n(p.양도가액) }; if (취) e.acquisitionDate = 취; if (n(p.취득가액)) e.acquisitionPrice = n(p.취득가액); return e; };
  const 계약선의 = /계약/.test(유형) && jmYn_(p.매도인선의) === true;
  if (양) {
    const 신탁자납세 = 명의신탁 === true && !계약선의 && !/명의자/.test(귀속);
    reqs.push(jmReq_('양도소득세 납세의무자 = 신탁자(대금이 신탁자에게 감)', 명의신탁 === null || 계약선의 ? null : 신탁자납세, 계약선의 ? '[확인 필요] 매도인 선의 계약명의신탁 — 소유권은 명의자가 확정 취득했지만 대금은 ' + (귀속 || '모름') + ' — 누가 양도자인지 판례 확인 전이라 두 경우로 셈' : 신탁자납세 ? '양도대금 ' + (귀속 || '신탁자') + ' — 실질 양도자는 신탁자' : '명의자', '국세기본법 §14①·소득세법 §88 1호 [판례 확인 필요]'));
    경우.push({ 이름: '(가) 명의신탁 — 신탁자(' + (p.신탁자 || '이름 모름') + ') 양도(신탁자의 취득일·취득가액)', 엔진칸: 칸(), 누가: p.신탁자 || '신탁자' });
    if (명의신탁 !== true || 계약선의) 경우.push({ 이름: '(나) 취득 때 증여(또는 명의자 소유 확정) — 명의자(' + (p.명의자 || '이름 모름') + ') 양도(취득일·취득가액 같음, 증여세는 따로)', 엔진칸: 칸(), 누가: p.명의자 || '명의자', 취득때증여: { 증여일: 취, 증여가액: n(p.취득가액), 관계: 관계 } });
    if (jmYn_(p.명의자신고) === true && 신탁자납세) { notes.push('명의자 이름으로 낸 양도소득세 신고는 실질과 다름 — 세무서가 신탁자에게 다시 매기고(부과) 명의자 몫은 돌려주는(경정) 일이 생김. 신탁자 쪽은 무신고 가산세·부정행위 여부, 명의자 쪽은 경정청구 기한(국세기본법 §45의2① 5년) 확인'); 할일.push({ 무엇: '명의자 신고분 경정청구 · 신탁자 기한 후 신고(또는 수정) 검토', 때: '양도일이 든 해 다음 해 5월 말에서 5년 안', 근거: '국세기본법 §45의2①·§45의3' }); }
    if (/주택|아파트/.test(자산)) notes.push('[확인 필요] 1세대1주택·다주택 판정에서 명의신탁 주택은 신탁자 세대의 주택으로 봄(실질) — 신탁자 세대 주택 수가 늘어 다른 집의 비과세가 깨질 수 있음, 넥스 1세대1주택 판정에 넣을 것');
  }
  // 5) 상속 — 신탁자가 죽으면 신탁자 재산
  const 사망 = jmYmd_(p.신탁자사망일);
  if (사망 && 계약선의) notes.push('[확인 필요] 신탁자 사망 — 매도인 선의 계약명의신탁이면 부동산은 명의자 소유로 확정되어 신탁자 상속재산은 부동산이 아니라 명의자에게 줬던 매수 자금을 돌려받을 권리(부당이득 반환 채권)일 수 있음 — 판례 확인 뒤 상속재산 목록에 넣을 것(상증법 §2 3호)');
  else if (사망) { notes.push('신탁자 사망 — 명의신탁 부동산은 신탁자의 상속재산(실질, 상증법 §2 3호·§7) — 명의자 이름이라 상속세 신고에서 빠지기 쉬움, 상속인이 명의자에게 돌려받을 권리로 넣음 [확인 필요]'); 할일.push({ 무엇: '상속세 신고 재산 목록에 명의신탁 부동산 넣기', 때: '상속개시 월말부터 6개월', 근거: '상증법 §67' }); }
  if (jmYmd_(p.실명전환일)) notes.push('실명 전환(명의자 → 신탁자 이전 등기)은 원래 주인에게 돌려놓는 것이라 양도·증여가 아님 — 다만 등기 원인을 「증여」·「매매」로 하면 그대로 과세될 수 있어 원인 「명의신탁 해지」·증빙 [확인 필요]');
  return jmWrap_('부동산명의신탁', reqs, { 명의신탁: 명의신탁, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.02 복잡사건 66 「염씨 차명계좌」] 차명 예금·증권계좌 — 남(가족) 이름 계좌의 돈이 명의자에게 증여된 것인지, 출연자 재산인지 가르고 증여세·상속세·제척기간을 함께 봄
//  실명 확인된 계좌의 재산은 명의자가 취득한 것으로 추정해 재산 취득자금 증여추정(상증법 §45①)을 적용(§45④) — 명의자가 자기 소득·상속·수증·처분대가로 입증한 금액을 뺀 나머지가 증여추정,
//  다만 입증 못 한 금액이 취득가액의 20%와 2억 중 적은 금액에 못 미치면 추정하지 않음(시행령 §34①). 출연자가 실제 주인임을 입증하면 증여가 아니고 출연자 재산 — 출연자가 죽으면 상속재산.
//  부정행위로 상속세·증여세를 포탈하고 수증자 명의 금융자산을 보유·사용하면(국세기본법 §26의2⑤5호, 피상속인 재산을 제3자 명의로 두었다 상속인이 취득하면 1호) 재산가액 50억 초과·관련자 생존 시 안 날부터 1년.
//  p: { 명의자, 출연자, 관계(출연자가 명의자에게 — 배우자|부모|조부모|자녀|기타친족|타인), 계좌:[{이름, 종류(예금|증권|외국), 금액(입금·취득 당시), 잔액(지금 또는 사망일 평가액), 입금일, 명의자입증(명의자 자기 돈으로 입증한 금액), 명의자사용(예 — 명의자가 인출·사용)}],
//       실소유입증(예|아니오|모름 — 출연자가 통장·도장·비밀번호를 관리하고 이자를 가졌나), 출연자사망일, 상속세신고(예 — 신고했나), 신고에넣음(예 — 차명계좌를 상속세 신고에 넣었나), 부정행위(예), 안날(세무서가 안 날), 관련자사망(예) }
function judgeBorrowedAccount_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 관계 = String(p.관계 || ''), 실소유 = jmYn_(p.실소유입증), 사망 = jmYmd_(p.출연자사망일);
  const rel = /배우자|처|남편|아내/.test(관계) ? '배우자' : /부모|아버지|어머니|조부|할아버지|할머니|직계존속/.test(관계) ? '직계존속' : /자녀|아들|딸|손자|손녀|직계비속/.test(관계) ? '직계비속' : /친족|형제|자매|사촌|삼촌|조카|며느리|사위/.test(관계) ? '기타친족' : '기타';
  const 계좌 = (p.계좌 || []).map(function (a, i) {
    const 금 = n(a.금액), 입증 = Math.min(금, n(a.명의자입증)), 미입증 = 금 - 입증, 배제 = Math.min(Math.floor(금 * 0.2), 200000000);
    const 추정 = 미입증 > 0 && 미입증 >= 배제;
    return { 이름: a.이름 || ('계좌 ' + (i + 1)), 종류: a.종류 || '', 금액: 금, 잔액: a.잔액 == null || a.잔액 === '' ? 금 : n(a.잔액), 입금일: jmYmd_(a.입금일) || '', 명의자입증: 입증, 미입증: 미입증, 배제기준: 배제, 증여추정: 추정, 증여추정금액: 추정 ? 미입증 : 0, 명의자사용: jmYn_(a.명의자사용) === true };
  });
  if (!계좌.length) return jmWrap_('차명계좌', [jmReq_('계좌', null, '계좌·금액을 모름', '상증법 §45④')], { 알림: ['계좌를 넣어 주세요'], 할일: [] });
  const 추정합 = 계좌.reduce(function (s, a) { return s + a.증여추정금액; }, 0), 잔액합 = 계좌.reduce(function (s, a) { return s + a.잔액; }, 0), 사용 = 계좌.some(function (a) { return a.명의자사용; });
  // 1) 실제 주인 — 출연자 재산(차명)인가 명의자 재산(증여)인가
  const 차명 = 실소유 === true && !사용 ? true : 실소유 === false || 사용 ? false : null;
  reqs.push(jmReq_('출연자 재산(차명) — 출연자가 관리하고 명의자는 쓰지 않음', 차명, '실소유 입증 ' + (실소유 === true ? '예' : 실소유 === false ? '아니오' : '모름') + (사용 ? ' · 명의자가 인출·사용한 계좌 있음' : ''), '상증법 §45④(명의자 취득 추정 — 반대 입증 가능)·국세기본법 §14①'));
  계좌.forEach(function (a) { notes.push(a.이름 + ': 금액 ' + won(a.금액) + ' − 명의자 입증 ' + won(a.명의자입증) + ' = 미입증 ' + won(a.미입증) + (a.증여추정 ? ' → 증여추정(배제기준 ' + won(a.배제기준) + ' 이상)' : ' → 배제기준(취득가액 20%와 2억 중 적은 ' + won(a.배제기준) + ') 미만이라 추정 안 함') + ' (상증법 §45①④·시행령 §34①)'); });
  if (사용) notes.push('명의자가 인출·사용한 계좌가 있음 — 출연자가 실제 주인이라는 반대 입증이 어려워지고, 부정행위면 수증자 명의 금융자산 사용(국세기본법 §26의2⑤5호) 1년 특례 대상');
  notes.push('[확인 필요] 차명 예금의 증여시기 — 입금한 때인지, 명의자가 인출·사용해 사실상 가진 때인지(판례 기준 미확인). 경우 (나)는 입금일로 셈, 증여일이 바뀌면 10년 합산·신고기한·제척기간이 함께 바뀜');
  // 2) 경우 — (가) 차명: 증여세 없음·출연자 재산 / (나) 증여추정
  경우.push({ 이름: '(가) 출연자 재산(차명) — 증여세 없음' + (사망 ? ', 출연자 상속재산 ' + won(잔액합) + '원' : ''), 증여세: 0, 상속재산가산: 사망 ? 잔액합 : 0 });
  계좌.filter(function (a) { return a.증여추정; }).forEach(function (a) { 경우.push({ 이름: '(나) 증여추정 — ' + a.이름 + ' ' + won(a.증여추정금액) + '원(증여일 ' + (a.입금일 || '모름') + ')', 엔진칸: { giftAmount: a.증여추정금액, relation: rel, giftDate: a.입금일 || undefined, isDoneeResident: true } }); });
  if (추정합 > 1 && 계좌.filter(function (a) { return a.증여추정; }).length > 1) notes.push('같은 출연자에게서 10년 안 증여추정이 여러 건이면 합산(상증법 §47②) — 계산기는 앞 건을 사전증여 칸에 넣어 차례로 돌릴 것');
  // 3) 상속 — 출연자가 죽으면
  if (사망) {
    notes.push('출연자 사망(' + 사망 + ') — 차명이면 계좌 잔액 ' + won(잔액합) + '원은 출연자 상속재산(상증법 §2 3호·§7). 증여로 보면 상속 전 10년(상속인)·5년(그 밖) 안 증여는 상속세 과세가액에 더함(§13①)');
    notes.push('[확인 필요] 차명 금융재산을 상속재산에 넣을 때 금융재산 상속공제(§22, 순금융재산 20%·2억 한도) 적용 여부 — 조문엔 신고 요건이 없으나 신고 누락분까지 되는지 근거 미확인');
    notes.push('증여로 보아 상속세 과세가액에 더할 때 계산기 상속인 목록(priorGiftHeirs)에 상속인마다 법정상속분(legalShareRatio)까지 넣을 것 — 비우면 증여세액공제(§28②) 한도를 예전 근사로 셈해 공제가 적게 나올 수 있음(검토대상)');
    if (jmYn_(p.상속세신고) === true && jmYn_(p.신고에넣음) !== true) { notes.push('상속세 신고에서 차명계좌를 뺐음 — 과소신고 가산세(부정행위면 40%, 국세기본법 §47의3②)·납부지연 가산세, 기한 뒤라도 수정신고하면 가산세 감면(§48②1호 — 기간별 비율 [확인 필요])'); 할일.push({ 무엇: '차명계좌를 넣은 상속세 수정신고', 때: '되도록 빨리(법정신고기한 뒤 2년 안이면 가산세 감면)', 근거: '국세기본법 §45①·§48②1호' }); }
    else if (jmYn_(p.상속세신고) !== true) { const y = +사망.slice(0, 4), m = +사망.slice(5, 7) + 6; const 기한 = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); 할일.push({ 무엇: '상속세 신고에 차명계좌 잔액 넣기', 때: 기한 + '까지(국외 주소면 9개월)', 근거: '상증법 §67①' }); }
  }
  // 4) 제척기간 — 상속·증여세 10년, 무신고·부정행위·거짓·누락 15년(§26의2④), 특례 1년(⑤)
  const 기산 = function (d, months) { if (!d) return ''; const y = +d.slice(0, 4), m = +d.slice(5, 7) + months; const end = new Date(Date.UTC(y, m, 0)); end.setUTCDate(end.getUTCDate() + 1); return end.toISOString().slice(0, 10); };
  const 제척 = [];
  계좌.filter(function (a) { return a.증여추정 && a.입금일; }).forEach(function (a) { const s = 기산(a.입금일, 3); 제척.push({ 무엇: a.이름 + ' 증여세', 기산일: s, 만료_15년: famAddD_(famAddY_(s, 15), -1), 엔진칸: { exclusionPeriodStartDate: s, isInheritanceOrGiftTax: true, isUnreported: true, isFraudulent: jmYn_(p.부정행위) === true } }); });
  if (사망) { const s = 기산(사망, 6); 제척.push({ 무엇: '상속세', 기산일: s, 만료_15년: famAddD_(famAddY_(s, 15), -1), 엔진칸: { exclusionPeriodStartDate: s, isInheritanceOrGiftTax: true, isFalseOrOmittedReport: jmYn_(p.상속세신고) === true, isUnreported: jmYn_(p.상속세신고) !== true, isFraudulent: jmYn_(p.부정행위) === true } }); }
  const 안날 = jmYmd_(p.안날), 특례 = jmYn_(p.부정행위) === true && 안날 && 잔액합 > 5000000000 && jmYn_(p.관련자사망) !== true;
  if (특례) { 제척.forEach(function (x) { x.특례_만료 = famAddY_(안날, 1); Object.assign(x.엔진칸, { isSpecialOneYearCaseApplicable: true, knownDate: 안날, fraudBasisPropertyValue: 잔액합 }); }); notes.push('부정행위·재산가액 50억 초과·관련자 생존 — 원래 제척기간이 지나도 세무서가 안 날(' + 안날 + ')부터 1년 안 부과 가능(국세기본법 §26의2⑤' + (사망 ? '1호' : '5호') + ')'); }
  else if (jmYn_(p.부정행위) === true && 잔액합 <= 5000000000) notes.push('재산가액 50억 이하라 안 날부터 1년 특례(§26의2⑤ 단서)는 걸리지 않음 — 원래 제척기간(15년)만');
  else if (jmYn_(p.부정행위) === true && jmYn_(p.관련자사망) === true) notes.push('상속인·증여자·수증자 중 사망한 사람이 있으면 1년 특례 없음(§26의2⑤ 단서) — 다만 차명계좌를 상속인이 취득한 1호 사례에서 「상속인」 사망만 빼는지 [확인 필요]');
  notes.push('범위 밖 한 줄: 금융실명법상 차명거래 금지·형사처벌, 차명계좌 이자·배당의 소득세 차등과세(금융실명법 §5)는 이 도구가 보지 않음 [확인 필요]');
  return jmWrap_('차명계좌', reqs, { 계좌판정: 계좌, 증여추정합계: 추정합, 잔액합계: 잔액합, 차명: 차명, 경우: 경우, 엔진칸: 경우[1] ? 경우[1].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 제척기간: 제척, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 67 「위씨 상속세 대납」] 세금 대신 내기 — 상속인 한 사람이 다른 상속인 몫 상속세를 내거나, 증여자가 수증자 증여세를 대신 낼 때 그 돈이 또 증여인지
//  상속세: 상속인·수유자는 각자 받았거나 받을 재산(상속으로 얻은 자산 총액 + §13① 가산 증여재산 − 부채 − 그 상속으로 낼 상속세 − 가산 증여재산 증여세, 시행령 §3③)을 한도로 연대납부(상증법 §3의2③)
//   → 자기 몫을 넘어 낸 금액 중 한도 안은 연대납부의무 이행, 한도를 넘은 금액은 다른 상속인에게 준 것([확인 필요] — 집행기준·판례 근거 미확인, 증여 조문은 §4① 또는 §36 채무면제 등).
//  증여세: 증여자가 수증자 증여세를 대신 내면 그 금액도 증여(같은 증여자 10년 합산 §47②) — 다만 수증자 주소불명·무자력(강제징수로도 확보 곤란)·비거주자이면 증여자 연대납부의무(§4의2⑥ 1~3호)라 증여 아님,
//   그래도 §4의2⑥ 단서 조문(§4①2호·3호, §35~§39의3, §40, §41의2~§41의5, §42~§42의3, §45, §45의3~§45의5 등)으로 생긴 증여세는 연대납부의무가 없어 대신 내면 증여.
//  p: { 종류(상속세|증여세),
//       상속세: { 납부일, 상속인:[{이름, 받은자산(상속받은 자산 + 가산 증여재산), 부채(물려받은 채무·공과금), 가산증여세(가산한 증여재산에 대해 낸 증여세), 몫세액(각자 낼 상속세 — 안분 결과), 낸세액, 대납자와관계(이 상속인이 보기에 대납자는 — 배우자|부모|자녀|형제|기타친족|타인)}] },
//       증여세: { 증여자, 수증자, 관계(수증자가 보기에 증여자는), 원증여가액, 원증여과세표준, 원증여일, 증여세, 대신낸금액, 납부일, 수증자상황(주소불명|무자력|비거주|없음), 증여조문(예: §4①1호, §35, §45의3) } }
function judgeTaxProxyPay_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const relOf = function (r) { r = String(r || ''); return /배우자|처|남편|아내/.test(r) ? '배우자' : /부모|아버지|어머니|조부|할아버지|할머니|직계존속/.test(r) ? '직계존속' : /자녀|아들|딸|손자|손녀|직계비속/.test(r) ? '직계비속' : /친족|형제|자매|누나|언니|오빠|동생|사촌|삼촌|조카|며느리|사위/.test(r) ? '기타친족' : '기타'; };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 종류 = /증여/.test(String(p.종류 || '')) ? '증여세' : '상속세';
  if (종류 === '상속세') {
    const q = p.상속세 || p, 납부일 = jmYmd_(q.납부일) || '';
    const hs = (q.상속인 || []).map(function (h, i) {
      const 몫 = n(h.몫세액), 낸 = n(h.낸세액);
      const 한도 = Math.max(0, n(h.받은자산) - n(h.부채) - 몫 - n(h.가산증여세));
      return { 이름: h.이름 || ('상속인 ' + (i + 1)), 받은자산: n(h.받은자산), 한도: 한도, 몫세액: 몫, 낸세액: 낸, 더낸: Math.max(0, 낸 - 몫), 덜낸: Math.max(0, 몫 - 낸), 관계: h.대납자와관계 || '' };
    });
    if (!hs.length) return jmWrap_('세금대납', [jmReq_('상속인별 받은 재산·몫 세액·낸 세액', null, '상속인 목록이 없음', '상증법 §3의2③·시행령 §3③')], { 알림: ['상속인마다 받은 재산·각자 몫 상속세·실제 낸 세액을 넣어 주세요'], 할일: [] });
    const 덜낸합 = hs.reduce(function (s, h) { return s + h.덜낸; }, 0);
    hs.forEach(function (h) {
      // 남의 몫으로 낸 금액(더낸) 중 연대납부 한도(받은 재산 − 자기 몫 세금 …)를 넘는 금액만 증여로 봄 — 한도에서 자기 몫은 이미 뺐으므로 더낸 금액과 한도를 견줌
      h.한도안 = Math.min(h.더낸, h.한도); h.한도넘음 = h.더낸 - h.한도안;
      notes.push(h.이름 + ': 받은 재산 ' + won(h.받은자산) + ' − 부채·자기 몫 상속세·가산 증여세 = 연대납부 한도 ' + won(h.한도) + ' · 자기 몫 ' + won(h.몫세액) + ' · 낸 ' + won(h.낸세액) + (h.더낸 ? ' → 남의 몫 ' + won(h.더낸) + '(한도 안 ' + won(h.한도안) + (h.한도넘음 ? ' · 한도 넘음 ' + won(h.한도넘음) : '') + ')' : '') + ' (상증법 §3의2③·시행령 §3③)');
    });
    const 넘은사람 = hs.filter(function (h) { return h.한도넘음 > 0; });
    reqs.push(jmReq_('대신 낸 상속세가 연대납부 한도 안', 넘은사람.length ? false : true, 넘은사람.length ? 넘은사람.map(function (h) { return h.이름 + ' 한도 넘음 ' + won(h.한도넘음); }).join(' · ') : '모두 한도 안', '상증법 §3의2③·시행령 §3③'));
    notes.push('[확인 필요] 한도에서 빼는 「그 상속으로 부과되거나 납부할 상속세」(시행령 §3③)가 자기 몫 상속세인지 상속세 전체인지 — 자기 몫으로 셈(전체로 보면 한도가 줄어 증여가 커짐)');
    notes.push('[확인 필요] 한도 안에서 다른 상속인 몫을 낸 것은 연대납부의무 이행이라 증여가 아니라는 근거(집행기준·판례) 원문 미확인 — 다만 낸 사람이 다른 상속인에게 구상권을 포기하면(돌려받지 않기로 하면) 그 금액을 증여로 보는지도 함께 [확인 필요]');
    // 한도를 넘은 금액 → 덜 낸 상속인에게 덜 낸 비율로 나눠 증여(경우)
    넘은사람.forEach(function (g) {
      hs.filter(function (h) { return h.덜낸 > 0; }).forEach(function (h) {
        const amt = 덜낸합 ? Math.floor(g.한도넘음 * h.덜낸 / 덜낸합) : 0; if (!amt) return;
        경우.push({ 이름: '한도 넘은 대납 — ' + g.이름 + ' → ' + h.이름 + ' ' + won(amt) + '원 증여(납부일 ' + (납부일 || '모름') + ')', 엔진칸: { giftAmount: amt, relation: relOf(h.관계), giftDate: 납부일 || undefined, isDoneeResident: true } });
      });
    });
    if (경우.length) { notes.push('[확인 필요] 한도를 넘은 대납을 증여로 볼 때의 조문(§4① 일반 증여인지 §36 채무면제 등인지)과 받은 사람 — 덜 낸 상속인에게 덜 낸 비율로 나눔'); 할일.push({ 무엇: '한도 넘은 대납분 증여세 신고(받은 상속인)', 때: 납부일 ? new Date(Date.UTC(+납부일.slice(0, 4), +납부일.slice(5, 7) + 3, 0)).toISOString().slice(0, 10) + '까지(납부일이 든 달 말일부터 3개월)' : '납부일이 든 달 말일부터 3개월', 근거: '상증법 §68①' }); }
    notes.push('연부연납 중 한 사람이 남은 회차를 다 내는 경우도 같음 — 회차마다 낸 날 기준으로 한도·증여를 다시 봄 [확인 필요]');
    return jmWrap_('세금대납', reqs, { 종류: '상속세', 상속인판정: hs, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
  }
  // 증여세 대납
  const q = p.증여세 || p, 대납 = n(q.대신낸금액), 원 = n(q.원증여가액), 납부일 = jmYmd_(q.납부일) || '', 원일 = jmYmd_(q.원증여일) || '';
  const 상황 = String(q.수증자상황 || ''), 조문 = String(q.증여조문 || '');
  const 연대사유 = /주소|거소/.test(상황) ? '1호(주소·거소 불분명)' : /무자력|능력|체납/.test(상황) ? '2호(납부능력 없음·강제징수로도 곤란)' : /비거주/.test(상황) ? '3호(수증자 비거주자)' : '';
  const 단서 = /§?4조?①?\s*[23]호|4①[23]|§?3[5-9]|§?39의[23]|§?40|§?41의[2-5]|§?42(의[23])?|§?45(?!의2)(의[345])?|§?48/.test(조문.replace(/\s/g, ''));
  const 연대 = !!연대사유 && !단서;
  reqs.push(jmReq_('증여자 연대납부의무(대신 내도 증여 아님)', 연대사유 ? 연대 : (상황 ? false : null), 연대사유 ? 연대사유 + (단서 ? ' — 그러나 ' + 조문 + ' 증여는 연대납부 제외(§4의2⑥ 단서)' : '') : (상황 ? '수증자 상황 「' + 상황 + '」 — 연대납부 사유(주소불명·무자력·비거주) 아님' : '수증자 상황(주소·납부능력·거주)을 모름'), '상증법 §4의2⑥'));
  if (연대) notes.push('증여자가 연대납부의무(§4의2⑥ ' + 연대사유 + ')로 낸 증여세는 다시 증여가 아님 — 수증자에게 구상할 수 있는지는 민사 문제');
  else {
    notes.push('증여자가 수증자 증여세 ' + won(대납) + '원을 대신 냄 → 그 금액도 수증자가 받은 증여(같은 증여자 10년 안이라 원증여 ' + won(원) + '원과 합산 §47②) — 증여일은 대신 낸 날([확인 필요])');
    경우.push({ 이름: '대신 낸 증여세도 증여 — 원증여와 합산', 엔진칸: { giftAmount: 대납, relation: relOf(q.관계), giftDate: 납부일 || undefined, isDoneeResident: !/비거주/.test(상황), priorGiftAmount: 원, priorPaidTax: n(q.증여세) || undefined, priorGiftTaxableBase: n(q.원증여과세표준) || undefined } });
    notes.push('[확인 필요] 원증여 때 「증여세는 증여자가 낸다」고 약정해 함께 넘긴 경우 처음부터 증여가액에 넣어(세금의 세금) 한 번에 셈하는지 — 경우는 대신 낸 날 따로 증여로 합산해 셈');
    할일.push({ 무엇: '대신 낸 증여세분 증여세 신고(합산)', 때: '대신 낸 날이 든 달 말일부터 3개월', 근거: '상증법 §47②·§68①' });
  }
  if (/비거주/.test(상황)) notes.push('수증자 비거주자 — 증여재산공제 없음(§53 본문 거주자만), 국외 재산이면 국제조세조정법 §35(넥스 국외증여 판정)');
  notes.push('범위 밖 한 줄: 부담부증여에서 수증자가 증여자의 양도소득세를 대신 내면 증여자에게 준 것인지 [확인 필요] — 이 도구는 상속세·증여세 대납만 봄');
  return jmWrap_('세금대납', reqs, { 종류: '증여세', 연대납부: 연대, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 68 「선씨 세무조사 통지」] 세무조사 절차 — 사전통지 기한·연기신청·조사기간 한도(연장·중지)·중복조사 금지·결과통지 기한·조사 중 수정신고 가산세를 한꺼번에 봄
//  사전통지: 조사 시작 20일 전(불복 재조사 결정에 따른 재조사는 7일 전) 서면 통지 — 증거인멸 등으로 조사 목적을 이룰 수 없으면 생략(국세기본법 §81의7①, 2024.12.31 개정 문구 [확인 필요]).
//  연기신청: 천재지변·사업 큰 어려움·그 밖에 시행령 사유(화재 등 재해, 질병·장기출장, 장부 압수·영치, 이에 준하는 사유)(§81의7②·시행령 §63의7①), 서면 신청(시행령 §63의7②).
//  조사기간: 가장 큰 해 수입금액·양도가액 100억 미만이면 20일 이내(§81의8②), 연장은 첫 번 세무관서장·2회부터 상급관서장 승인으로 각각 20일 이내(③ 본문) — ③ 1~5호(상속세·증여세 조사·주식변동·명의위장·차명계좌 등)는 한도 없음, 중지 기간은 조사기간·연장기간에 안 셈(④).
//  재조사: 같은 세목·같은 과세기간은 §81의4② 1~7호(시행령 §63의2)가 아니면 다시 조사 못 함. 결과통지: 조사 마친 날부터 20일(§11① 공시송달 사유는 40일) 안 설명·서면 통지(§81의12①).
//  p: { 세목, 조사종류(일반|상속증여|주식변동|범칙 등), 수입금액(조사대상 과세기간 중 가장 큰 해의 수입금액 또는 양도가액), 재조사결정(예 — 불복 재조사 결정에 따른 조사), 통지생략사유(예 — 증거인멸 우려 등),
//       통지받은날, 조사시작일(통지서에 적힌 날), 실제시작일, 조사종료일(통지서), 실제종료일, 연장:[{일수, 승인(세무서장|상급)}], 중지:[{시작, 끝}], 탈루유형(무자료|역외|명의위장|차명|부동산투기 — ③ 1~4호),
//       연기사유(재해|질병|출장|압수|사업어려움|기타), 연기신청일, 같은세목기간조사(예 — 전에 같은 세목·같은 과세기간을 조사받음), 재조사사유(명백한자료|거래상대방|여러기간|재조사결정|금품|부분조사|일제조사 등),
//       결과통지받은날, 수정신고일(조사 중 수정신고), 공휴일:[날짜] }
function judgeTaxAudit_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], hol = p.공휴일 || [];
  const 일수 = function (a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); };
  const 받 = jmYmd_(p.통지받은날), 시작 = jmYmd_(p.실제시작일) || jmYmd_(p.조사시작일), 재결 = jmYn_(p.재조사결정) === true;
  // 1) 사전통지 — 시작 며칠 전에 받았나(받은 날과 시작일 사이 날수)
  const 앞 = 재결 ? 7 : 20;
  if (jmYn_(p.통지생략사유) === true) { reqs.push(jmReq_('사전통지(생략 사유)', null, '증거인멸 등 조사 목적을 이룰 수 없다고 보아 통지 생략 — 생략 사유가 맞는지가 다툴 거리', '국세기본법 §81의7① 단서')); }
  else if (받 && 시작) { const d = 일수(받, 시작); reqs.push(jmReq_('사전통지 ' + 앞 + '일 전', d >= 앞, '통지 받은 날 ' + 받 + ' → 조사 시작 ' + 시작 + ' = ' + d + '일 전' + (d >= 앞 ? '' : '(' + (앞 - d) + '일 모자람)'), '국세기본법 §81의7①')); if (d < 앞) notes.push('사전통지가 ' + 앞 + '일보다 늦게 옴 — 절차 위반은 조사 연기 요청·납세자보호관(§81의16) 권리보호 요청 거리, 이 위반만으로 과세처분이 무효·취소되는지 [확인 필요]'); }
  else reqs.push(jmReq_('사전통지 ' + 앞 + '일 전', null, '통지 받은 날·조사 시작일을 모름', '국세기본법 §81의7①'));
  // 2) 연기신청
  const 사유 = String(p.연기사유 || '');
  if (사유) {
    const 법정 = /재해|화재|천재|질병|병|입원|출장|압수|영치|사업|어려|부도|도산/.test(사유);
    reqs.push(jmReq_('조사 연기 신청 사유', 법정 ? true : null, 사유 + (법정 ? ' — 법정 사유' : ' — 「이에 준하는 사유」(시행령 §63의7①4호)인지 세무서 판단'), '국세기본법 §81의7②·시행령 §63의7①'));
    notes.push('연기 신청은 문서로(시행령 §63의7②) — 세무서는 조사 시작 전까지 결과를 알려야 하고(§81의7③), 연기 사유가 없어지면 5일 전 통지 뒤 조사를 시작할 수 있음(§81의7④ [확인 필요 — 항 번호])');
    if (!jmYmd_(p.연기신청일) && 시작) 할일.push({ 무엇: '세무조사 연기 신청서(사유 증빙 붙임)', 때: famAddD_(시작, -1) + '까지(조사 시작 전)', 근거: '국세기본법 §81의7②·시행령 §63의7②' });
  }
  // 3) 조사기간 — 100억 미만 20일, 연장 각 20일, ③ 1~5호 한도 없음, 중지 기간 뺌
  const 수입 = n(p.수입금액), 종류 = String(p.조사종류 || '') + ' ' + String(p.세목 || ''), 탈루 = String(p.탈루유형 || '');
  const 예외 = /상속|증여|주식변동|범칙|동시/.test(종류) ? '5호(' + (종류.match(/상속|증여|주식변동|범칙|동시/) || [''])[0] + ' 조사)' : /무자료|위장거래|가공/.test(탈루) ? '1호' : /역외|해외/.test(탈루) ? '2호' : /명의위장|이중장부|차명|현금/.test(탈루) ? '3호' : /거짓계약|미등기|투기/.test(탈루) ? '4호' : '';
  const 끝 = jmYmd_(p.실제종료일) || jmYmd_(p.조사종료일);
  const 중지일 = (p.중지 || []).reduce(function (s, x) { const a = jmYmd_(x.시작), b = jmYmd_(x.끝); return a && b ? s + 일수(a, b) + 1 : s; }, 0);
  const 연장 = (p.연장 || []).map(function (x, i) { return { 회: i + 1, 일수: n(x.일수), 승인: String(x.승인 || '') }; });
  let 기간판정 = null;
  if (시작 && 끝) {
    const 쓴 = 일수(시작, 끝) + 1 - 중지일;
    notes.push('조사기간 ' + 시작 + ' ~ ' + 끝 + ' = ' + (일수(시작, 끝) + 1) + '일' + (중지일 ? ' − 중지 ' + 중지일 + '일(§81의8④ 안 셈)' : '') + ' = ' + 쓴 + '일 [확인 필요 — 첫날·토요일·공휴일을 넣어 세는지(달력 날수로 셈)]');
    if (!수입 && !예외) reqs.push(jmReq_('조사기간 한도', null, '가장 큰 해 수입금액·양도가액을 모름 — 100억 미만이면 20일', '국세기본법 §81의8②'));
    else if (수입 >= 10000000000 && !예외) reqs.push(jmReq_('조사기간 한도', null, '수입금액 ' + won(수입) + '원(100억 이상) — 20일 한도 없음, 「최소한」 원칙만(§81의8① 본문)', '국세기본법 §81의8①②'));
    else if (예외) { reqs.push(jmReq_('조사기간 한도', true, '§81의8③ ' + 예외 + ' — 20일·연장 20일 한도 없음', '국세기본법 §81의8③')); }
    else {
      const 연장합 = 연장.reduce(function (s, x) { return s + Math.min(20, x.일수); }, 0), 한도 = 20 + 연장합;
      const 연장잘못 = 연장.filter(function (x) { return x.일수 > 20 || (x.회 >= 2 && x.승인 && !/상급|지방청|국세청/.test(x.승인)); });
      기간판정 = 쓴 <= 한도;
      reqs.push(jmReq_('조사기간 20일(연장 각 20일) 안', 기간판정 && !연장잘못.length, '100억 미만 · 한도 20일' + (연장.length ? ' + 연장 ' + 연장.map(function (x) { return x.회 + '회 ' + x.일수 + '일(' + (x.승인 || '승인 모름') + ')'; }).join(', ') : '') + ' = ' + 한도 + '일 · 쓴 ' + 쓴 + '일' + (연장잘못.length ? ' · 연장 문제: ' + 연장잘못.map(function (x) { return x.회 + '회(' + (x.일수 > 20 ? '20일 넘음' : '2회부터는 상급관서 승인') + ')'; }).join(', ') : ''), '국세기본법 §81의8②③'));
      if (연장.length) notes.push('연장은 §81의8① 단서 1~6호 사유(조사 기피·거래처 확인·탈루 혐의·천재지변·납세자보호관 인정·납세자 신청)가 있어야 하고, 사유·기간을 문서로 통지해야 함(⑦) — 연장 통지서를 받았는지 확인');
    }
  }
  // 4) 중복조사
  if (jmYn_(p.같은세목기간조사) === true) {
    const r = String(p.재조사사유 || '');
    const 허용 = 재결 ? '4호(불복 재조사 결정)' : /명백|탈루.*자료/.test(r) ? '1호' : /거래상대|거래처/.test(r) ? '2호' : /여러|2개|두 ?해/.test(r) ? '3호' : /재조사.?결정|불복/.test(r) ? '4호' : /금품/.test(r) ? '5호' : /부분/.test(r) ? '6호' : /일제|투기|매점|환급|범칙|기관/.test(r) ? '7호(시행령 §63의2)' : '';
    reqs.push(jmReq_('같은 세목·같은 과세기간 재조사 허용 사유', 허용 ? true : (r ? false : null), 허용 ? r + ' — §81의4② ' + 허용 : (r ? '「' + r + '」는 §81의4② 1~7호 사유로 보이지 않음 — 중복조사 금지 위반 다툼 거리' : '재조사 사유를 모름 — 통지서의 조사 사유 확인'), '국세기본법 §81의4②·시행령 §63의2'));
    if (!허용 && r) notes.push('중복조사 금지(§81의4②) 위반으로 얻은 과세자료에 근거한 처분은 위법하다는 판례가 있다고 알려짐 — 판례 원문 미확인 [확인 필요], 과세전적부심사·불복에서 첫 다툼 거리');
  }
  // 5) 결과통지 기한
  const 실끝 = jmYmd_(p.실제종료일) || jmYmd_(p.조사종료일);
  if (실끝) {
    const 기한 = famAddD_(실끝, 20), 결 = jmYmd_(p.결과통지받은날);
    reqs.push(jmReq_('조사결과 통지 20일 안', 결 ? 결 <= 기한 : null, '조사 마친 날 ' + 실끝 + ' → ' + 기한 + '까지' + (결 ? ' · 받은 날 ' + 결 : ' · 아직 안 받음') + ' (공시송달 사유면 40일)', '국세기본법 §81의12①'));
    if (결) { const why = []; const 적부 = apShift_(famAddD_(결, 30), hol, why); 할일.push({ 무엇: '과세전적부심사 청구(조사결과 통지 내용이 틀렸다고 보면) — 넥스 불복기한 판정으로 다시 확인', 때: 적부 + '까지(받은 날부터 30일' + (why.length ? ', ' + why.join('') : '') + ')', 근거: '국세기본법 §81의15②' }); notes.push('조사결과 통지를 받으면 과세전적부심사(§81의15) 결정 전까지는 고지(경정)를 미룸이 원칙 — 다만 제척기간이 3개월 안 남는 등 §81의15③ 사유면 바로 고지될 수 있음 [확인 필요 — 호 번호]'); }
    else 할일.push({ 무엇: '조사결과 통지 받기(못 받으면 세무서에 요청)', 때: 기한 + '까지', 근거: '국세기본법 §81의12①' });
  }
  // 6) 조사 중 수정신고 — 가산세 감면 없음
  const 수정 = jmYmd_(p.수정신고일);
  if (수정 && 받 && 수정 >= 받) notes.push('세무조사 통지를 받은 뒤(' + 받 + ') ' + 수정 + ' 수정신고 — 경정할 것을 미리 알고 낸 수정신고라 과소신고 가산세 감면(§48②1호) 없음(시행령 §29 1호). 다만 납부지연 가산세는 수정신고 납부일까지만 붙어 일찍 내는 것이 이익');
  else if (수정) notes.push('조사 통지 전 수정신고(' + 수정 + ') — 법정신고기한 뒤 기간별 과소신고 가산세 감면(§48②1호) 대상');
  notes.push('조사 중 권리: 조사 대상·사유를 적은 사전통지·조사원증 확인(§81의7), 세무대리인 조력(§81의5), 납세자보호관 권리보호 요청(§81의16) — 장부는 조사 목적 범위만 일시 보관 가능(§81의10) [확인 필요 — 조문 원문 미대조]');
  notes.push('범위 밖 한 줄: 조세범칙조사(조세범 처벌절차법)·지방세 세무조사 절차는 이 도구가 보지 않음');
  return jmWrap_('세무조사절차', reqs, { 사전통지기한일수: 앞, 기간예외: 예외 || undefined, 중지일수: 중지일 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 69 「경씨 손녀 결혼」] 가족 사이 생활비·교육비·축의금·혼수·결혼자금 — 비과세 증여(상증법 §46 5호·시행령 §35④)와 과세 증여를 가르고, 과세분에 혼인·출산 공제(§53의2) 기간을 따짐
//  비과세: 사회통념상 인정되는 이재구호금품·치료비·피부양자의 생활비·교육비(§46 5호), 학자금·장학금, 통상 필요한 기념품·축하금·부의금, 통상 필요한 혼수용품 등 — 「해당 용도에 직접 지출한 것」만(시행령 §35④ 본문).
//   그래서 생활비·교육비 명목이라도 예금·적금·주식·부동산·전세보증금 등 재산으로 남으면 과세([확인 필요] — 집행기준 46-35-1 원문 미대조). 부양할 사람(부모)이 능력이 있는데 조부모가 낸 손주 생활비·교육비는 「피부양자」가 아니라 과세될 수 있음([확인 필요] — 같은 집행기준).
//  혼인·출산 공제: 직계존속에게서 혼인신고일 전후 2년 안 받은 증여, 자녀 출생일(입양신고일)부터 2년 안 받은 증여 — 합쳐 평생 1억(§53의2①②③), 거주자만, §4①4·5호·②(재산가치 증가 등) 증여엔 안 됨(④).
//   혼인 전 공제를 받고 최초 증여일부터 2년 안 혼인 못 하면 2년 되는 날이 든 달 말일부터 3개월 안 수정신고·기한후신고 → 가산세 면제·이자상당액(⑥), 약혼자 사망 등 부득이 사유로 3개월 안 돌려주면 처음부터 증여 없음(⑤).
//  p: { 수증자, 거주자(예), 혼인신고일, 자녀출생일:[날짜], 혼인출산공제씀(이미 쓴 혼인·출산 공제), 피부양(예|아니오 — 수증자가 증여자의 피부양자인가: 소득·재산 없고 부양의무자가 부양 못 함),
//       지출:[{증여자, 관계(수증자가 보기에 — 아버지|어머니|할아버지|할머니|외조부 등), 항목(생활비|교육비|학자금|치료비|축의금|혼수|결혼자금|예물|차량|기타), 금액, 날짜, 직접지출(예 — 학교·병원·가게에 바로 냄), 남은재산(예금|주식|부동산|전세|없음)}],
//       축의금:{ 총액, 혼주몫(부모 손님이 낸 몫), 받은사람(신랑신부|혼주), 쓴곳(예 — 전세보증금) } }
function judgeFamilySupportGift_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 거주 = jmYn_(p.거주자) !== false, 혼인 = jmYmd_(p.혼인신고일), 출생 = (p.자녀출생일 || []).map(jmYmd_).filter(Boolean), 피부양 = jmYn_(p.피부양);
  const 조부모 = /할아버지|할머니|조부|조모|외조/;
  const relOf = function (r) { r = String(r || ''); return /배우자|남편|아내/.test(r) ? '배우자' : /아버지|어머니|부모|부친|모친|조부|조모|할아버지|할머니|외조|직계존속/.test(r) ? '직계존속' : /아들|딸|자녀|손자|손녀|직계비속/.test(r) ? '직계비속' : /형제|자매|오빠|언니|누나|동생|삼촌|고모|이모|외삼촌|친족|사촌/.test(r) ? '기타친족' : '기타'; };
  // 1) 지출 한 건씩 — 비과세인가
  const 판 = (p.지출 || []).map(function (x, i) {
    const 항 = String(x.항목 || ''), 금 = n(x.금액), 날 = jmYmd_(x.날짜) || '', 직접 = jmYn_(x.직접지출) === true, 남 = String(x.남은재산 || '');
    const 재산 = /예금|적금|주식|부동산|전세|보증금|펀드|채권|아파트|토지/.test(남);
    const 손주 = 조부모.test(String(x.관계 || ''));
    let 비과세 = null, 왜 = '', 근거 = '상증법 §46 5호·시행령 §35④';
    if (재산) { 비과세 = false; 왜 = 항 + ' 명목이지만 ' + 남 + '(으)로 남음 — 용도에 직접 지출한 것이 아님'; }
    else if (/생활비|교육비|치료비|병원|의료/.test(항)) {
      if (피부양 === false) { 비과세 = false; 왜 = '수증자가 증여자의 피부양자가 아님(소득·재산 있거나 부양의무자가 따로 부양 가능)' + (손주 ? ' — 부모가 부양할 수 있는데 조부모가 낸 손주 ' + 항 : ''); }
      else if (피부양 === true && (직접 || /생활비/.test(항))) { 비과세 = true; 왜 = '피부양자 ' + 항 + (직접 ? ' — 용도에 바로 냄' : ' — 그때그때 생활에 씀'); }
      else { 비과세 = null; 왜 = 항 + ' — 피부양자인지' + (직접 ? '' : '·용도에 바로 냈는지') + ' 모름'; }
      if (손주 && 피부양 !== false) notes.push('[확인 필요] 조부모가 손주 ' + 항 + '를 낸 경우 — 손주의 부모에게 부양 능력이 있으면 손주는 조부모의 「피부양자」가 아니라 과세된다는 해석(집행기준 46-35-1·판례) 원문 미대조. 부모의 소득·재산 자료로 확인');
    } else if (/학자금|장학금|등록금/.test(항)) { 비과세 = 직접 ? true : null; 왜 = 직접 ? '학자금을 학교에 바로 냄(시행령 §35④2호)' : '학자금을 수증자 통장으로 받음 — 실제 등록금으로 낸 증빙 필요'; 근거 = '시행령 §35④2호'; }
    else if (/축의금|축하금|부의금|기념품|돌|선물/.test(항)) { 비과세 = null; 왜 = '통상 필요한 금품인지(사회통념) — 금액·관계·형편으로 세무서가 판단, 기준 금액 없음'; 근거 = '시행령 §35④3호'; }
    else if (/혼수/.test(항)) { 비과세 = null; 왜 = '통상 필요한 혼수용품(가구·가전 등 일상 용품)은 비과세 — 사치용품·주택·차량은 아님'; 근거 = '시행령 §35④4호'; }
    else if (/차량|자동차|예물|명품|보석|결혼자금|전세|주택|현금/.test(항)) { 비과세 = false; 왜 = 항 + ' — 통상 필요한 혼수용품이나 생활비로 보기 어려움(재산 이전)'; 근거 = '시행령 §35④4호 반대 해석 [확인 필요]'; }
    else { 비과세 = null; 왜 = '항목 「' + 항 + '」 — 비과세 열거(시행령 §35④)에 맞는지 확인'; }
    return { 번호: i + 1, 증여자: x.증여자 || '', 관계: x.관계 || '', 항목: 항, 금액: 금, 날짜: 날, 비과세: 비과세, 왜: 왜, 근거: 근거, 손주: 손주 };
  });
  판.forEach(function (x) { reqs.push(jmReq_(x.번호 + '. ' + (x.증여자 || x.관계) + ' ' + x.항목 + ' ' + won(x.금액) + ' 비과세', x.비과세, x.왜, x.근거)); });
  // 2) 축의금 — 혼주 몫을 자녀가 가지면 혼주가 준 증여
  const 축 = p.축의금 || {};
  if (n(축.총액)) {
    const 혼주 = n(축.혼주몫), 본인 = n(축.총액) - 혼주;
    notes.push('축의금 ' + won(n(축.총액)) + ' = 신랑·신부 손님 몫 ' + won(본인) + '(본인에게 귀속, 증여 아님) + 혼주(부모) 손님 몫 ' + won(혼주) + '(혼주에게 귀속) [확인 필요 — 축의금 귀속 기준은 판례·집행기준 원문 미대조]');
    if (혼주 && (/신랑|신부|본인|자녀/.test(String(축.받은사람 || '')) || jmYn_(축.쓴곳) === true || 축.쓴곳)) {
      판.push({ 번호: 판.length + 1, 증여자: '혼주(부모)', 관계: '아버지', 항목: '혼주 몫 축의금', 금액: 혼주, 날짜: 혼인 || '', 비과세: false, 왜: '부모 손님이 낸 축의금을 자녀가 가져 ' + (축.쓴곳 && 축.쓴곳 !== true ? 축.쓴곳 : '재산') + '에 씀 — 혼주가 자녀에게 준 증여', 근거: '상증법 §4① [확인 필요]' });
      reqs.push(jmReq_('혼주 몫 축의금 ' + won(혼주) + ' 자녀에게 넘어감', false, '부모 손님 몫을 자녀가 가짐 — 증여', '상증법 §4① [확인 필요]'));
    }
  }
  // 3) 과세분 — 증여자별로 묶어 엔진칸(혼인·출산 공제 기간 따짐)
  const 예정 = !혼인 && jmYn_(p.혼인예정) === true;
  const 혼인기간 = function (d) { return 예정 && d ? true : 혼인 && d ? (d >= famAddD_(famAddY_(혼인, -2), 0) && d <= famAddY_(혼인, 2)) : false; };
  const 출산기간 = function (d) { return d && 출생.some(function (b) { return d >= b && d <= famAddY_(b, 2); }); };
  const 묶음 = {};
  판.filter(function (x) { return x.비과세 === false; }).forEach(function (x) { const r0 = relOf(x.관계), k = 조부모.test(String(x.관계 || '')) ? '조부모' : r0 === '직계존속' ? '부모' : (x.증여자 || x.관계 || '증여자'); (묶음[k] = 묶음[k] || { 관계: x.관계, 이름: [], 합: 0, 날: '', 건: [] }); 묶음[k].합 += x.금액; 묶음[k].건.push(x); if (묶음[k].이름.indexOf(x.증여자) < 0) 묶음[k].이름.push(x.증여자); if (x.날짜 > 묶음[k].날) 묶음[k].날 = x.날짜; });
  const 모름합 = 판.filter(function (x) { return x.비과세 === null; }).reduce(function (s, x) { return s + x.금액; }, 0);
  let 쓴공제 = n(p.혼인출산공제씀), 쓴관계 = n(p.직계존속공제씀);
  Object.keys(묶음).sort(function (a, b) { return String(묶음[a].날).localeCompare(String(묶음[b].날)); }).forEach(function (k) {
    const g = 묶음[k], rel = relOf(g.관계), 조 = 조부모.test(String(g.관계 || ''));
    const 혼 = g.건.every(function (x) { return 혼인기간(x.날짜); }), 출 = !혼 && g.건.every(function (x) { return 출산기간(x.날짜); });
    const 공제됨 = rel === '직계존속' && 거주 && (혼 || 출);
    const e = { giftAmount: g.합, relation: rel, giftDate: g.날 || undefined, isDoneeResident: 거주 };
    if (rel === '직계존속' && 쓴관계) e.priorRelationDeductionUsedOther = 쓴관계;
    if (공제됨) { if (혼) e.isMarriageGift = true; else e.isBirthGift = true; if (쓴공제) e.priorMarriageOrBirthDeductionUsed = 쓴공제; }
    if (조) e.isGenerationSkip = true;
    경우.push({ 이름: k + '(' + g.이름.filter(Boolean).join('·') + ') → ' + (p.수증자 || '수증자') + ' 과세 증여 ' + won(g.합) + '원' + (공제됨 ? (혼 ? ' (혼인 공제 기간 안)' : ' (출산 공제 기간 안)') : '') + (조 ? ' · 세대생략 할증' : ''), 엔진칸: e });
    if (rel === '직계존속') 쓴관계 += Math.min(g.합, Math.max(0, 50000000 - 쓴관계));
    if (공제됨) 쓴공제 += Math.min(g.합, Math.max(0, 100000000 - 쓴공제));
    if (rel === '직계존속' && !공제됨 && (혼인 || 출생.length)) notes.push(k + ' 증여 중 혼인신고일 전후 2년·출생일부터 2년 밖 날짜가 있어 혼인·출산 공제를 넣지 않음 — 기간 안 건만 따로 나눠 돌릴 것(상증법 §53의2①②)');
    if (조) notes.push(g.이름.filter(Boolean).join('·') + '(조부모) → 손주 증여는 세대생략 할증 30%(상증법 §57, 수증자 미성년·20억 초과면 40%) — 수증자의 부모가 살아 있을 때. 증여재산공제(직계존속 5천만, 미성년 2천만)는 부모·조부모 합쳐 10년 한 번(§53)');
  });
  notes.push('증여자는 부모(아버지·어머니 — 직계존속과 그 배우자는 한 사람, 상증법 §47②)와 조부모로 묶음. 직계존속 공제(§53 5천만, 10년)·혼인출산 공제(§53의2 1억, 평생)는 수증자 기준 한 번이라 날짜가 앞선 증여부터 씀 — 같은 날 여러 증여자면 과세가액 비율로 나눔(시행령 §46①, 엔진 relationDeductionCap·marriageBirthDeductionCap)');
  if (모름합) notes.push('비과세인지 정해지지 않은 금액 ' + won(모름합) + '원 — 경우에 넣지 않음, 증빙(영수증·학교 납부 내역·통장 흐름)으로 정해 다시 돌릴 것');
  // 4) 혼인 전 공제 사후관리 — 2년 안 혼인 안 하면 수정신고
  const 첫공제 = 판.filter(function (x) { return x.비과세 === false && relOf(x.관계) === '직계존속' && x.날짜; }).map(function (x) { return x.날짜; }).sort()[0];
  if (!혼인 && jmYn_(p.혼인예정) === true && 첫공제) {
    const 이년 = famAddY_(첫공제, 2), 끝 = new Date(Date.UTC(+이년.slice(0, 4), +이년.slice(5, 7) + 3, 0)).toISOString().slice(0, 10);
    할일.push({ 무엇: '혼인 전 받은 혼인 공제 — ' + 이년 + '까지 혼인신고 못 하면 수정신고(가산세 없이 이자상당액만)', 때: 끝 + '까지(2년 되는 날이 든 달 말일부터 3개월)', 근거: '상증법 §53의2⑥' });
    notes.push('약혼자 사망 등 부득이한 사유로 혼인이 안 되면 그 달 말일부터 3개월 안에 증여자에게 돌려주면 처음부터 증여가 없던 것(상증법 §53의2⑤, 사유는 시행령 [확인 필요])');
  }
  if (!거주) notes.push('수증자 비거주자 — 증여재산공제·혼인출산 공제 없음(§53·§53의2① 거주자만)');
  notes.push('비과세라도 증빙을 남길 것: 학교·병원·가게에 바로 낸 영수증, 생활비는 그때그때 쓴 통장 흐름 — 한꺼번에 받아 쌓아 두면 자금출처 조사(§45)에서 증여로 봄');
  return jmWrap_('생활비교육비', reqs, { 지출판정: 판, 비과세합계: 판.filter(function (x) { return x.비과세 === true; }).reduce(function (s, x) { return s + x.금액; }, 0), 과세합계: 판.filter(function (x) { return x.비과세 === false; }).reduce(function (s, x) { return s + x.금액; }, 0), 모름합계: 모름합, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 70 「모씨 증여 날짜 고르기」] 증여일을 언제로 할지 — 날짜 하나로 바뀌는 것들(기준시가 새 고시, 10년 합산에서 빠지는 날, 미성년→성년 공제, 혼인·출산 공제 기간, 시가 평가기간)을 후보일마다 펼쳐 세액 엔진 칸으로 넘김
//  재산가액: 증여일(평가기준일) 현재 시가(상증법 §60①), 증여일 전 6개월~후 3개월 안 매매·감정·수용 가액은 시가로 봄(시행령 §49①②) — 시가가 없으면 보충적 평가(§61):
//   토지 = 평가기준일 현재 고시된 개별공시지가(§61①1호·시행령 §50⑥), 주택 = 개별·공동주택가격(§61①4호 — 평가기준일 현재 고시된 가격을 쓰는 근거 조문 [확인 필요]), 오피스텔·상업용 건물 = 국세청장 고시 가액(§61①3호).
//  합산: 증여일 전 10년 안 같은 사람(직계존속이면 그 배우자 포함)에게 받은 증여 합계 1천만원 이상이면 더함(§47②). 공제: 직계존속 5천만(미성년 2천만), 받기 전 10년 안 공제받은 금액과 합쳐 한도(§53 2호).
//  p: { 수증자, 수증자생년월일, 증여자관계(직계존속|배우자|기타친족|기타), 세대생략(예), 혼인신고일, 자녀출생일[], 다른직계존속공제씀(이번 증여자 말고 다른 직계존속에게 10년 안 받은 공제액),
//       재산:[{이름, 종류(토지|단독주택|공동주택|상업용건물|오피스텔|기타), 지분(%, 기본 100), 지금기준시가, 다음기준시가(새로 고시될 예상 가액), 다음고시일(기본: 토지 다음 5-31, 주택 다음 4-30, 상업용 다음 1-1 — 실제 고시일로 바꿀 것),
//              시가:[{가액, 날짜(매매계약일·감정 가격산정기준일), 종류(매매|감정|수용|유사매매)}]}],
//       사전증여:[{날짜, 금액, 과세표준, 낸세액, 같은증여자(예 — 이번 증여자 또는 그 배우자)}], 후보일:[...], 기준일(오늘 — 기본 첫 후보일) }
function judgeGiftTiming_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 달빼기 = function (d, k) { let y = +d.slice(0, 4), m = +d.slice(5, 7) - k; while (m < 1) { m += 12; y -= 1; } const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(+d.slice(8, 10), last)).padStart(2, '0'); };
  const 관계 = String(p.증여자관계 || '직계존속');
  const rel = /배우자|처|남편|아내/.test(관계) ? '배우자' : /부모|아버지|어머니|조부|할아버지|할머니|직계존속/.test(관계) ? '직계존속' : /자녀|아들|딸|손자|손녀|직계비속/.test(관계) ? '직계비속' : /친족|형제|자매|사촌|삼촌|조카|며느리|사위/.test(관계) ? '기타친족' : '기타';
  const 생일 = jmYmd_(p.수증자생년월일), 혼인 = jmYmd_(p.혼인신고일), 출생 = (p.자녀출생일 || []).map(jmYmd_).filter(Boolean);
  const 성년일 = 생일 ? famAddY_(생일, 19) : '';
  const 재산 = (p.재산 || []).map(function (a, i) {
    const 종류 = String(a.종류 || '기타'), 지금 = jmYmd_(p.기준일) || jmYmd_((p.후보일 || [])[0]) || '';
    const y = 지금 ? +지금.slice(0, 4) : 0;
    let 고시 = jmYmd_(a.다음고시일);
    if (!고시 && y) { const md = /토지/.test(종류) ? '05-31' : /주택|아파트|빌라/.test(종류) ? '04-30' : /상업|오피스텔|상가/.test(종류) ? '01-01' : ''; if (md) { 고시 = y + '-' + md; if (고시 <= 지금) 고시 = (y + 1) + '-' + md; } }
    return { 이름: a.이름 || ('재산 ' + (i + 1)), 종류: 종류, 지분: a.지분 == null || a.지분 === '' ? 1 : n(a.지분) / 100, 지금기준시가: n(a.지금기준시가), 다음기준시가: a.다음기준시가 == null || a.다음기준시가 === '' ? null : n(a.다음기준시가), 다음고시일: 고시 || '', 고시일기본값: !jmYmd_(a.다음고시일),
      시가: (a.시가 || []).map(function (s) { return { 가액: n(s.가액), 날짜: jmYmd_(s.날짜) || '', 종류: s.종류 || '' }; }).filter(function (s) { return s.가액 && s.날짜; }) };
  });
  const 후보 = (p.후보일 || []).map(jmYmd_).filter(Boolean).sort();
  if (!재산.length || !후보.length) return jmWrap_('증여시기', [jmReq_('재산·후보일', null, (재산.length ? '' : '재산을 모름 ') + (후보.length ? '' : '후보일을 모름'), '상증법 §60·§61·§47②')], { 알림: ['증여할 재산(기준시가·새 고시 예상)과 견줄 증여 후보일을 넣어 주세요'], 할일: [] });
  const 사전 = (p.사전증여 || []).map(function (g) { return { 날짜: jmYmd_(g.날짜) || '', 금액: n(g.금액), 과세표준: n(g.과세표준), 낸세액: n(g.낸세액), 같은: jmYn_(g.같은증여자) !== false }; }).filter(function (g) { return g.날짜 && g.금액; });
  const 판 = 후보.map(function (d) {
    const 가액들 = 재산.map(function (a) {
      const 기간시작 = 달빼기(d, 6), 기간끝 = apAddM_(d, 3);
      const 안 = a.시가.filter(function (s) { return s.날짜 >= 기간시작 && s.날짜 <= 기간끝; }).sort(function (x, y) { return Math.abs(Date.parse(x.날짜) - Date.parse(d)) - Math.abs(Date.parse(y.날짜) - Date.parse(d)); });
      const 새 = a.다음기준시가 != null && a.다음고시일 && d >= a.다음고시일;
      const 기준 = 새 ? a.다음기준시가 : a.지금기준시가;
      const 값 = 안.length ? 안[0].가액 : 기준;
      return { 이름: a.이름, 평가: 안.length ? '시가(' + (안[0].종류 || '매매·감정') + ' ' + 안[0].날짜 + ', 평가기간 ' + 기간시작 + '~' + 기간끝 + ')' : (새 ? '새 기준시가(' + a.다음고시일 + ' 고시' + (a.고시일기본값 ? ' — 기본값' : '') + ')' : '지금 기준시가'), 가액: Math.floor(값 * a.지분), 시가로잡힘: !!안.length, 기간끝: 기간끝 };
    });
    const 합 = 가액들.reduce(function (s, x) { return s + x.가액; }, 0);
    const 열년전 = famAddY_(d, -10);
    const 합산 = 사전.filter(function (g) { return g.같은 && g.날짜 >= 열년전 && g.날짜 < d; });
    const 빠짐 = 사전.filter(function (g) { return g.같은 && g.날짜 < 열년전; });
    const 합산액 = 합산.reduce(function (s, g) { return s + g.금액; }, 0);
    const 미성년 = !!(성년일 && d < 성년일);
    const 혼 = rel === '직계존속' && 혼인 && d >= famAddY_(혼인, -2) && d <= famAddY_(혼인, 2);
    const 출 = rel === '직계존속' && !혼 && 출생.some(function (b) { return d >= b && d <= famAddY_(b, 2); });
    const e = { giftAmount: 합, relation: rel, giftDate: d, isDoneeResident: true };
    if (미성년) e.isMinor = true;
    if (jmYn_(p.세대생략) === true) e.isGenerationSkip = true;
    if (혼) e.isMarriageGift = true; if (출) e.isBirthGift = true;
    if (rel === '직계존속' && n(p.다른직계존속공제씀)) e.priorRelationDeductionUsedOther = n(p.다른직계존속공제씀);
    if (합산액 >= 10000000) { e.priorGiftAmount = 합산액; const t = 합산.reduce(function (s, g) { return s + g.낸세액; }, 0), b = 합산.reduce(function (s, g) { return s + g.과세표준; }, 0); if (t) e.priorPaidTax = t; if (b) e.priorGiftTaxableBase = b; }
    return { 증여일: d, 재산: 가액들, 증여재산가액: 합, 합산: 합산액 >= 10000000 ? 합산액 : 0, 합산에서빠진: 빠짐.map(function (g) { return g.날짜; }), 미성년: 미성년, 혼인공제기간: !!혼, 출산공제기간: !!출, 엔진칸: e };
  });
  판.forEach(function (x) {
    경우.push({ 이름: x.증여일 + ' 증여 — 재산 ' + won(x.증여재산가액) + '원' + (x.합산 ? ' + 10년 합산 ' + won(x.합산) : ' (합산 없음)') + (x.미성년 ? ' · 미성년 공제 2천만' : '') + (x.혼인공제기간 ? ' · 혼인 공제 기간' : '') + (x.출산공제기간 ? ' · 출산 공제 기간' : ''), 엔진칸: x.엔진칸, 재산: x.재산 });
    notes.push(x.증여일 + ': ' + x.재산.map(function (a) { return a.이름 + ' ' + won(a.가액) + '(' + a.평가 + ')'; }).join(' · ') + (x.합산 ? ' · 10년 안 증여 ' + won(x.합산) + '원 합산(§47②)' : '') + (x.합산에서빠진.length ? ' · ' + x.합산에서빠진.join('·') + ' 증여는 10년 지나 합산에서 빠짐' : ''));
  });
  // 날짜가 바뀌는 문턱 — 후보일 사이에 무엇이 바뀌는지
  const 문턱 = [];
  재산.forEach(function (a) { if (a.다음기준시가 != null && a.다음고시일) 문턱.push({ 날: a.다음고시일, 무엇: a.이름 + ' 기준시가 ' + won(a.지금기준시가) + ' → ' + won(a.다음기준시가) + (a.다음기준시가 > a.지금기준시가 ? ' (오름 — 고시일 전 증여가 유리)' : a.다음기준시가 < a.지금기준시가 ? ' (내림 — 고시일 뒤 증여가 유리)' : ''), 근거: '상증법 §61①·시행령 §50⑥' }); });
  사전.filter(function (g) { return g.같은; }).forEach(function (g) { 문턱.push({ 날: famAddD_(famAddY_(g.날짜, 10), 1), 무엇: g.날짜 + ' 증여 ' + won(g.금액) + '원이 합산에서 빠지는 첫날 [확인 필요 — 「증여일 전 10년 이내」 끝날 셈법]', 근거: '상증법 §47②·§53' }); });
  if (성년일) 문턱.push({ 날: 성년일, 무엇: (p.수증자 || '수증자') + ' 성년 — 직계존속 공제 2천만 → 5천만(10년 안 이미 받은 공제와 합쳐 한도)', 근거: '상증법 §53 2호·민법 §4' });
  if (혼인) 문턱.push({ 날: famAddY_(혼인, 2), 무엇: '혼인 공제(1억) 기간 끝 — 혼인신고일 전후 2년', 근거: '상증법 §53의2①' });
  출생.forEach(function (b) { 문턱.push({ 날: famAddY_(b, 2), 무엇: '출산 공제(1억) 기간 끝 — 출생일부터 2년', 근거: '상증법 §53의2②' }); });
  문턱.sort(function (a, b) { return String(a.날).localeCompare(String(b.날)); });
  const 처음 = 후보[0], 끝 = 후보[후보.length - 1];
  const 사이 = 문턱.filter(function (t) { return t.날 > 처음 && t.날 <= 끝; });
  reqs.push(jmReq_('후보일 사이에 세액을 바꾸는 날이 있음', 사이.length ? true : false, 사이.length ? 사이.map(function (t) { return t.날 + ' ' + t.무엇; }).join(' / ') : '후보일 사이에 바뀌는 문턱 없음 — 날짜보다 재산·금액이 세액을 정함', '상증법 §47②·§53·§53의2·§61'));
  const 시가잡힘 = 판.some(function (x) { return x.재산.some(function (a) { return a.시가로잡힘; }); });
  if (시가잡힘) notes.push('평가기간(증여일 전 6개월~후 3개월) 안에 매매·감정 가액이 있으면 기준시가가 아니라 그 가액이 시가(시행령 §49①②) — 같은 단지 비슷한 집의 유사매매사례도 시가가 됨(§49④), 증여일을 옮기면 잡히는 사례도 바뀜. 증여일 뒤 3개월 안 매매사례가 생겨도 시가로 잡힐 수 있음. 아파트처럼 거래가 잦은 재산은 후보일을 옮겨도 그 평가기간 안 새 유사매매사례가 생기기 쉬우니, 기준시가로 잡힌 경우는 「그 사이 매매사례가 없을 때」만 맞음');
  notes.push('시가 없는 상업용 건물·나대지를 기준시가로 신고하면 국세청이 감정평가해 평가심의위원회를 거쳐 시가로 바꿀 수 있음(시행령 §49① 단서 — 법정결정기한까지) [확인 필요 — 대상 범위는 국세청 사무처리규정]');
  notes.push('후보일마다 세액 엔진으로 돌려 견줄 것 — 경우마다 엔진칸이 있음. 기본 고시일(토지 5-31·주택 4-30·상업용 1-1)은 예상일이라 실제 고시일로 바꿔 넣을 것(부동산 가격공시에 관한 법률 시행령 공시 기한 [확인 필요])');
  if (rel === '직계존속') notes.push('공제는 수증자 기준 10년 안 직계존속 전체 합계로 한도(§53) — 다른 직계존속(어머니·조부모)에게 10년 안 받은 공제는 「다른직계존속공제씀」에 넣을 것');
  할일.push({ 무엇: '고른 증여일 뒤 증여세 신고·납부', 때: '증여일이 든 달 말일부터 3개월', 근거: '상증법 §68①' });
  사이.filter(function (t) { return /기준시가/.test(t.무엇); }).forEach(function (t) { const 오름 = /오름/.test(t.무엇); 할일.push({ 무엇: t.무엇.split(' 기준시가')[0] + ' — ' + (오름 ? '새 기준시가 고시 전에 증여하려면 등기 접수(증여일)를 고시일 전에' : '기준시가가 내리니 등기 접수(증여일)를 고시일 뒤로') + ' — 부동산 증여일은 소유권이전등기 접수일', 때: t.날 + (오름 ? ' 전' : ' 이후'), 근거: '상증법 시행령 §24①1호·§50⑥' }); });
  return jmWrap_('증여시기', reqs, { 후보판정: 판, 문턱: 문턱, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 71 「육씨 상속 평가 고르기」] 상속재산을 기준시가로 신고할지 감정가로 신고할지 — 상속세와 나중 양도세를 함께 견줌
//  상속받은 자산을 팔 때 취득가액 = 상속개시일 현재 상증법 §60~§66으로 평가한 가액(세무서장이 결정·경정한 가액이 있으면 그 가액, 소득세법 시행령 §163⑨ 본문) — 취득일은 상속개시일(시행령 §162①5호)
//   → 높게 평가해 신고하면 상속세는 늘고 나중 양도세는 줄어듦. 상속공제 안쪽이면 상속세는 그대로 0이고 양도세만 줆.
//  시가 원칙(상증법 §60①): 평가기간(상속개시일 전후 6개월, 시행령 §49①) 안 매매·감정·수용·경매·공매가 있으면 그것이 시가 — 기준시가(보충적 평가 §61)는 시가를 산정하기 어려울 때만(§60③)
//   매매가는 매매계약일, 감정가는 가격산정기준일·감정평가서 작성일로 평가기간 안인지 봄(시행령 §49②).
//   감정은 둘 이상 감정기관 평균(시행령 §49①2호) — 기준시가 10억원 이하 부동산은 하나로 됨(§60⑤·시행령 §49⑥).
//   감정가가 기준금액(보충적 평가액과 유사 시가의 90% 중 적은 금액)에 못 미치면 시가로 안 봄(시행령 §49①2호 단서).
//  감정평가 수수료(상속세 신고용, 그 감정가로 신고한 때만)는 500만원까지 상속재산에서 뺌(상증법 §25①2호·시행령 §20의3①1호·②·③).
//  p: { 상속개시일, 기준일(오늘), 배우자(예|아니오), 자녀수, 배우자실제상속액(모르면 비움 — 법정지분 가정),
//       다른재산과세가액(이 대상 말고 나머지 상속세 과세가액 — 부채·장례비 뺀 뒤),
//       대상: [{ 이름, 종류(주택|토지|상가|건물|기타), 기준시가, 유사시가(아파트 유사매매가 있으면),
//               감정: [{ 가액, 날짜(가격산정기준일), 기관 }], 감정수수료, 매매: { 가액, 날짜(계약일) },
//               예상양도가, 예상양도일, 필요경비, 피상속인취득일, 1세대1주택(예|아니오), 거주연수 }] }
function judgeInheritValuation_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const 달더하기 = function (ymd, m) { const y = +ymd.slice(0, 4), mo = +ymd.slice(5, 7) - 1 + m, d = +ymd.slice(8, 10); const ny = y + Math.floor(mo / 12), nm = ((mo % 12) + 12) % 12; const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate(); return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(Math.min(d, last)).padStart(2, '0'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 개시 = jmYmd_(p.상속개시일) || '', 오늘 = jmYmd_(p.기준일) || '';
  const 대상 = Array.isArray(p.대상) ? p.대상 : (p.대상 ? [p.대상] : []);
  if (!개시 || !대상.length) return jmWrap_('상속평가', [jmReq_('상속개시일·평가할 재산', null, !개시 ? '상속개시일이 없음' : '평가할 재산(대상)이 없음', '상증법 §60·소득세법 시행령 §163⑨')], { 알림: ['상속개시일과 재산마다 기준시가·감정가·예상 양도가를 넣어 주세요'], 할일: [] });
  const 시작 = 달더하기(개시, -6), 끝 = 달더하기(개시, 6);
  const 기간안 = function (d) { d = jmYmd_(d) || ''; return !!d && d >= 시작 && d <= 끝; };
  const 신고기한 = new Date(Date.UTC(+개시.slice(0, 4), +개시.slice(5, 7) + 6, 0)).toISOString().slice(0, 10);
  notes.push('평가기간 ' + 시작 + ' ~ ' + 끝 + '(상속개시일 전후 6개월, 시행령 §49①) · 상속세 신고기한 ' + 신고기한 + '(개시일이 든 달 말일부터 6개월, §67①)');
  const 종류집 = function (k) { k = String(k || ''); return /주택|아파트|빌라|연립|다세대|단독/.test(k) ? '주택' : /토지|땅|임야|농지|대지/.test(k) ? '토지' : /상가|건물|오피스|공장/.test(k) ? '건물' : '기타'; };
  const 날수 = function (d) { return Math.abs((Date.parse(d) - Date.parse(개시)) / 86400000); };
  const 판 = 대상.map(function (a, i) {
    const 이름 = a.이름 || ('재산 ' + (i + 1)), 기준 = n(a.기준시가), 유사 = n(a.유사시가), 유사날 = jmYmd_(a.유사시가날짜) || '', 종류 = 종류집(a.종류);
    const 공동 = /아파트|연립|다세대|빌라|공동/.test(String(a.종류 || ''));
    // 감정은 가격산정기준일과 감정평가서 작성일이 모두 평가기간 안이어야 함(시행령 §49②2호)
    const 감정들 = (a.감정 || []).map(function (g) { return { 가액: n(g.가액), 날짜: jmYmd_(g.날짜) || '', 작성일: jmYmd_(g.작성일) || '', 기관: g.기관 || '' }; }).filter(function (g) { return g.가액 > 0; });
    const 안감정 = 감정들.filter(function (g) { return 기간안(g.날짜) && (!g.작성일 || 기간안(g.작성일)); });
    const 필요수 = 기준 > 0 && 기준 <= 1000000000 && 종류 !== '기타' ? 1 : 2;
    const 평균 = 안감정.length ? Math.round(안감정.reduce(function (s, g) { return s + g.가액; }, 0) / 안감정.length) : 0;
    const 기준금액 = 유사 ? Math.min(기준, Math.round(유사 * 0.9)) : 기준;
    const 감정됨 = 안감정.length >= 필요수 && (!기준금액 || 평균 >= 기준금액);
    const 매매 = a.매매 && n(a.매매.가액) ? { 가액: n(a.매매.가액), 날짜: jmYmd_(a.매매.날짜) || '' } : null;
    const 매매안 = !!(매매 && 기간안(매매.날짜));
    const 감정밖 = 감정들.filter(function (g) { return 안감정.indexOf(g) < 0; });
    if (감정들.length && 안감정.length < 필요수) notes.push(이름 + ': 평가기간 안 감정 ' + 안감정.length + '곳 — ' + (필요수 === 2 ? '기준시가 10억원 넘는 재산(또는 부동산 아님)이라 감정기관 둘 이상의 평균이어야 함(시행령 §49①2호·§49⑥)' : '하나면 됨') + (감정밖.length ? ' · 기간 밖 감정(가격산정기준일·작성일) ' + 감정밖.map(function (g) { return g.날짜 + (g.작성일 ? '/' + g.작성일 : ''); }).join(', ') + '은 평가심의위원회 심의를 거쳐야 시가(시행령 §49① 단서)' : ''));
    if (안감정.length >= 필요수 && 기준금액 && 평균 < 기준금액) notes.push(이름 + ': 감정 평균 ' + won(평균) + '이 기준금액 ' + won(기준금액) + '(보충적 평가액' + (유사 ? '·유사 시가 90% 중 적은 금액' : '') + ')에 못 미쳐 시가로 안 봄(시행령 §49①2호 단서)');
    if (매매 && !매매안) notes.push(이름 + ': 매매 계약일 ' + (매매.날짜 || '모름') + '이 평가기간 밖 — 그 값은 시가가 아님(법정결정기한 안이면 심의로 시가가 될 수 있음, 시행령 §49① 단서)');
    // 시가 후보 — 둘 이상이면 평가기준일에 가장 가까운 날의 가액(같은 날 둘 이상이면 평균), 해당 재산 매매·감정이 있으면 유사매매(④)는 안 씀(시행령 §49② 후단·단서)
    const 후보 = [];
    if (매매안) 후보.push({ 종류: '매매', 가액: 매매.가액, 날짜: 매매.날짜 });
    if (감정됨) 후보.push({ 종류: '감정 ' + 안감정.length + '곳 평균', 가액: 평균, 날짜: 안감정.map(function (g) { return g.날짜; }).sort(function (x, y) { return 날수(x) - 날수(y); })[0] });
    if (!후보.length && 유사) 후보.push({ 종류: '유사매매', 가액: 유사, 날짜: 유사날 || 개시 });
    let 시가 = 0, 시가왜 = '';
    if (후보.length) { const m = Math.min.apply(null, 후보.map(function (c) { return 날수(c.날짜); })); const 가까운 = 후보.filter(function (c) { return 날수(c.날짜) === m; }); 시가 = Math.round(가까운.reduce(function (s, c) { return s + c.가액; }, 0) / 가까운.length); 시가왜 = 가까운.map(function (c) { return c.종류 + '(' + c.날짜 + ')'; }).join('·') + (후보.length > 1 ? ' — 상속개시일에 가장 가까움' : ''); }
    if (후보.length > 1) notes.push(이름 + ': 시가 후보 ' + 후보.map(function (c) { return c.종류 + ' ' + won(c.가액) + '(' + c.날짜 + ', ' + 날수(c.날짜) + '일)'; }).join(' · ') + ' → 상속개시일에 가장 가까운 ' + 시가왜.split(' — ')[0] + ' ' + won(시가) + '이 시가(시행령 §49②) — 감정은 가격산정기준일로 거리를 잼 [확인 필요]');
    if (공동 && !유사 && !매매안) notes.push(이름 + ': 공동주택은 같은 단지 비슷한 면적 매매(유사매매사례가액)가 시가가 됨 — 신고한 경우 평가기준일 전 6개월부터 신고일까지(시행령 §49④) — 국토부 실거래가로 확인할 것');
    return { 이름: 이름, 종류: 종류, 기준시가: 기준, 감정평균: 감정됨 ? 평균 : 0, 감정곳: 안감정.length, 필요감정곳: 필요수, 매매가: 매매안 ? 매매.가액 : 0, 유사시가: 유사, 시가: 시가, 시가근거: 시가왜, 예상감정가: n(a.예상감정가), 감정수수료: n(a.감정수수료), 기준시가신고가능: !시가, 시가가감정: /감정/.test(시가왜.split(' — ')[0]) && !/매매/.test(시가왜.split(' — ')[0]), 원: a };
  });
  // 경우: ① 기준시가 ② 감정가 ③ 6개월 안 판 값(있을 때)
  const 다른 = n(p.다른재산과세가액), 배우자 = jmYn_(p.배우자) === true, 자녀 = n(p.자녀수);
  const 법정 = 배우자 ? 1.5 / (1.5 + Math.max(자녀, 0)) : 0;
  const 상속칸 = function (합, 수수료) {
    const c = { taxableEstateAmount: 다른 + 합, grossEstateValue: 다른 + 합, inheritanceDate: 개시, dateOfDeath: 개시, hasSpouse: 배우자, childCount: 자녀, isDecedentResident: true, netFinancialAssets: n(p.순금융재산) };
    if (수수료) c.appraisalFeeAmount = 수수료;
    if (배우자) { c.spouseLegalShareRatio = 법정; c.spouseActualInheritedAmount = n(p.배우자실제상속액) || Math.round((다른 + 합) * 법정); }
    return c;
  };
  const 양도칸 = function (r, 값) {
    const a = r.원; if (!n(a.예상양도가)) return null;
    const c = { transferPrice: n(a.예상양도가), transferDate: jmYmd_(a.예상양도일) || undefined, assetType: r.종류 === '주택' ? 'house' : 'other', acquisitionDate: 개시, acquisitionPrice: 값, acquisitionCause: 'inheritance', isInheritedAsset: true, necessaryExpenses: n(a.필요경비) };
    if (jmYmd_(a.피상속인취득일)) { c.inheritedDecedentAcquisitionDate = jmYmd_(a.피상속인취득일); c.decedentAcquisitionDate = jmYmd_(a.피상속인취득일); }
    if (jmYn_(a['1세대1주택']) === true) { c.isOneHouseOneFamily = true; if (a.거주연수 != null) c.residenceYears = Number(a.거주연수); }
    return { 이름: r.이름, 도구: 'calculate_transfer_tax', 엔진칸: c };
  };
  const 만들기 = function (이름, 고르기, 수수료여부) {
    let 합 = 0, 수수료 = 0; const 값들 = [], 양도 = [];
    판.forEach(function (r) { const v = 고르기(r); 합 += v.값; 값들.push(r.이름 + ' ' + won(v.값) + '(' + v.왜 + ')'); if (수수료여부 && v.감정) 수수료 += r.감정수수료; const t = 양도칸(r, v.값); if (t) 양도.push(t); });
    경우.push({ 이름: 이름 + ' — ' + 값들.join(' · '), 상속재산평가: 합, 엔진칸: 상속칸(합, 수수료), 양도: 양도 });
  };
  const 기준고르기 = function (r) { return { 값: r.기준시가, 왜: '기준시가' + (r.기준시가신고가능 ? '' : ' — 시가가 있어 이대로는 신고 위험') }; };
  const 시가고르기 = function (r) { return r.시가 ? { 값: r.시가, 왜: '시가: ' + r.시가근거, 감정: r.시가가감정 } : 기준고르기(r); };
  만들기('① 기준시가로 신고', 기준고르기, false);
  if (판.some(function (r) { return r.시가; })) 만들기('② 법대로 시가로 신고', 시가고르기, true);
  if (판.some(function (r) { return r.예상감정가 && !r.시가; })) 만들기('③ 지금 감정을 받는다면(예상 감정가)', function (r) { return r.예상감정가 && !r.시가 ? { 값: r.예상감정가, 왜: '예상 감정가(아직 안 받음) — 기준시가 10억 이하 1곳·넘으면 2곳', 감정: true } : 시가고르기(r); }, true);
  const 위험 = 판.filter(function (r) { return !r.기준시가신고가능; });
  reqs.push(jmReq_('기준시가로 신고해도 되나(평가기간 안 시가 없음)', 위험.length ? false : true, 위험.length ? 위험.map(function (r) { return r.이름 + ' — ' + r.시가근거 + ' ' + won(r.시가); }).join(' · ') + ' → 이 값이 시가' : '평가기간 안 매매·감정·유사매매 없음(지금까지 아는 것만)', '상증법 §60①②③·시행령 §49①④'));
  판.forEach(function (r) {
    if (jmYn_(r.원['1세대1주택']) === true) notes.push(r.이름 + ': 팔 때 1세대1주택 비과세(12억 이하)면 양도세 줄이는 효과가 없거나 작음 — 고가주택이면 12억 넘는 몫에만 효과(소득세법 §89①3호·시행령 §160①)');
    if (r.원.예상양도일 && jmYmd_(r.원.피상속인취득일) === '') notes.push(r.이름 + ': 피상속인 취득일이 없음 — 상속받고 2년 안에 팔면 세율 보유기간은 피상속인 취득일부터(소득세법 §104②1호)');
  });
  notes.push('견주는 법: 경우마다 상속세(엔진칸) + 재산별 양도세(양도 엔진칸)와 지방소득세 10%를 더해 합이 적은 쪽 — 다만 양도세는 판 해에 내므로 시간 차·양도 계획이 바뀔 위험을 함께 말씀드릴 것');
  notes.push('상속 취득가액은 신고한 값이 아니라 세무서가 결정·경정한 값이 있으면 그 값(시행령 §163⑨) — 기준시가로 신고한 뒤 세무서가 감정으로 경정하면 취득가액도 그 값');
  notes.push('[확인 필요] 감정 수수료를 나중 양도 때 필요경비로 넣을 수 있는지(상속세에서 이미 뺀 금액) — 넣지 않고 셈');
  notes.push('[확인 필요] 신고 뒤 평가기간 밖(법정결정기한 안)에 세무서가 감정해 시가로 고칠 수 있음(시행령 §49① 단서) — 기준시가 신고 뒤 그런 경정이면 상속세 가산세는 없음(§47③ 해석 [확인 필요])');
  if (!오늘 || 오늘 <= 끝) 할일.push({ 무엇: '감정으로 갈 거면 평가기간 안에 감정(가격산정기준일이 ' + 끝 + '까지)·감정서 받기', 때: 끝 + '까지', 근거: '시행령 §49①②' });
  할일.push({ 무엇: '상속세 신고·감정 수수료 지급 증빙 함께 제출', 때: 신고기한 + '까지', 근거: '상증법 §67①·시행령 §20의3④' });
  if (오늘 && 오늘 > 끝) notes.push('오늘(' + 오늘 + ')은 평가기간이 지남 — 새 감정은 평가심의위원회 심의를 거쳐야 시가(시행령 §49① 단서)');
  return jmWrap_('상속평가', reqs, { 평가기간: { 시작: 시작, 끝: 끝 }, 상속세신고기한: 신고기한, 재산판정: 판.map(function (r) { const o = Object.assign({}, r); delete o.원; return o; }), 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 72 「봉씨 상가 토지·건물 나눠 적기」] 토지와 건물을 함께 사고팔 때 계약서에 나눠 적은 값을 그대로 인정하나
//  토지·건물을 함께 취득·양도하면 각각 구분해 기장하되, 구분이 불분명하면 기준시가 등으로 안분(소득세법 §100② — 시행령 §166⑥: 부가가치세법 시행령 §64① 준용)
//  구분 기장한 가액이 안분가액과 100분의 30 이상 차이 나면 구분이 불분명한 것으로 봄(§100③ 본문) — 다른 법령에 따라 구분한 경우·함께 취득한 뒤 건물을 철거하고 토지만 쓰는 경우는 제외(§100③ 단서·시행령 §166⑧)
//  안분 순서(부가가치세법 시행령 §64①, 엔진 calculateProportionalAllocationJS와 같음): 토지·건물 기준시가가 모두 있으면 기준시가 비율 → 하나라도 없으면 감정가 비율 → 그것도 없으면 장부가액 비율
//  공통 취득가액·양도비용은 각 자산 가액에 비례해 안분(§100② 후단)
//  p: { 양도: { 합계, 토지(계약서 토지값), 건물(계약서 건물값), 날짜, 토지기준시가, 건물기준시가, 토지감정, 건물감정, 비용(양도비 공통) },
//       취득: { 합계, 토지, 건물, 날짜(같이 산 날), 토지날짜·건물날짜(따로 취득했으면), 토지기준시가, 건물기준시가, 토지감정, 건물감정, 비용 },
//       예외(다른법령구분|철거), 토지비사업용(예), 주택(예 — 이 경우 1세대1주택 판정 도구로), 특수관계(예) }
function judgeLandBuildingSplit_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 예외 = String(p.예외 || '');
  const 예외사유 = /법령|공공|수용|보상|경매/.test(예외) ? '다른 법령에 따라 가액을 구분(시행령 §166⑧1호)' : /철거|멸실/.test(예외) ? '함께 취득한 뒤 건물을 철거하고 토지만 사용(시행령 §166⑧2호)' : '';
  const 쪽 = function (q, 이름) {
    q = q || {};
    const 토 = n(q.토지), 건 = n(q.건물), 합 = n(q.합계) || 토 + 건;
    const 토기 = n(q.토지기준시가), 건기 = n(q.건물기준시가), 토감 = n(q.토지감정), 건감 = n(q.건물감정);
    const 비율 = 토기 && 건기 ? { 토: 토기, 건: 건기, 왜: '기준시가 비율(부가가치세법 시행령 §64①1호)' } : 토감 && 건감 ? { 토: 토감, 건: 건감, 왜: '감정가 비율(§64①2호)' } : 토 && 건 ? null : null;
    // 철거 예외는 함께 취득한 뒤의 일이라 취득 쪽에만(시행령 §166⑧2호), 다른 법령 구분은 양쪽
    const 예외여기 = 예외사유 && (이름 === '취득' || !/철거/.test(예외사유)) ? 예외사유 : '';
    const r = { 쪽: 이름, 합계: 합, 계약토지: 토, 계약건물: 건, 날짜: jmYmd_(q.날짜) || '', 비용: n(q.비용) };
    if (!합) { r.모름 = true; return r; }
    if (!건 && !건기 && !건감) { r.토지만 = true; r.인정토지 = 합; r.인정건물 = 0; r.계약토지 = 합; r.계약건물 = 0; r.인정왜 = '토지만(건물 없음)'; r.예외 = 예외여기; return r; }
    if (!비율) { r.안분못함 = true; notes.push(이름 + ': 토지·건물 기준시가(또는 감정가)가 둘 다 있어야 안분 — 없으면 장부가액 비율(부가가치세법 시행령 §64①3호) [확인 필요]'); return r; }
    r.안분근거 = 비율.왜; r.안분토지 = Math.floor(합 * 비율.토 / (비율.토 + 비율.건)); r.안분건물 = 합 - r.안분토지;
    if (토 + 건 && 토 + 건 !== 합) notes.push(이름 + ': 계약서 토지 ' + won(토) + ' + 건물 ' + won(건) + ' = ' + won(토 + 건) + '이 합계 ' + won(합) + '와 다름 — 부가가치세가 섞였는지 볼 것(건물분 부가세는 양도가액이 아님)');
    if (토 || 건) {
      r.차이토지 = r.안분토지 ? Math.abs(토 - r.안분토지) / r.안분토지 : 0; r.차이건물 = r.안분건물 ? Math.abs(건 - r.안분건물) / r.안분건물 : 0;
      r.넘음30 = r.차이토지 >= 0.3 || r.차이건물 >= 0.3;
    } else r.구분안함 = true;
    // 인정 값
    if (r.구분안함) { r.인정토지 = r.안분토지; r.인정건물 = r.안분건물; r.인정왜 = '계약서에 나눠 적지 않음 → 안분(§100②)'; }
    else if (r.넘음30 && !예외여기) { r.인정토지 = r.안분토지; r.인정건물 = r.안분건물; r.인정왜 = '30% 이상 차이 → 구분 불분명으로 보고 안분(§100③)'; }
    else { r.인정토지 = 토; r.인정건물 = 건; r.인정왜 = r.넘음30 ? '30% 넘지만 예외 — ' + 예외여기 + ' → 계약서대로' : '30% 안 → 계약서대로(§100②)'; }
    r.예외 = 예외여기; return r;
  };
  const 양 = 쪽(p.양도, '양도'), 취 = 쪽(p.취득, '취득');
  [양, 취].forEach(function (r) {
    if (r.모름 || r.안분못함 || r.토지만) return;
    if (r.구분안함) reqs.push(jmReq_(r.쪽 + ' — 계약서에 토지·건물을 나눠 적음', false, '토지·건물을 나눠 적지 않음 → 안분 토지 ' + won(r.안분토지) + ' · 건물 ' + won(r.안분건물) + '(' + r.안분근거 + ')', '소득세법 §100②·시행령 §166⑥'));
    else reqs.push(jmReq_(r.쪽 + ' — 계약서 구분 인정(안분가액과 30% 안)', r.넘음30 ? (r.예외 ? true : false) : true, '계약 토지 ' + won(r.계약토지) + ' / 안분 ' + won(r.안분토지) + '(' + Math.round(r.차이토지 * 1000) / 10 + '% 차이) · 계약 건물 ' + won(r.계약건물) + ' / 안분 ' + won(r.안분건물) + '(' + Math.round(r.차이건물 * 1000) / 10 + '% 차이)' + (r.넘음30 && r.예외 ? ' — 예외: ' + r.예외 : ''), '소득세법 §100③·시행령 §166⑧'));
  });
  if (예외사유) notes.push('[확인 필요] 시행령 §166⑧(2025.2.28 신설)의 적용 시기 — 부칙 원문 미확인, 그 전 양도엔 예외가 없었을 수 있음');
  notes.push('[확인 필요] 30% 차이를 토지·건물 어느 하나라도 넘으면 보는지(이 도구), 둘 다 넘어야 보는지 — 합계가 같으면 한쪽만 30% 넘는 경우는 드물지만 비율이 크게 다르면 생김');
  // 양도 엔진칸 — 토지·건물 두 거래로(같은 묶음이라 손익 통산 §102②), 공통 비용은 인정 가액 비율로 안분(§100② 후단)
  const 엔진 = function (값양, 값취, 이름) {
    if (!양.합계 || !취.합계) return null;
    const 토지취득일 = jmYmd_((p.취득 || {}).토지날짜) || 취.날짜, 건물취득일 = jmYmd_((p.취득 || {}).건물날짜) || 취.날짜;
    const 나눔 = function (c, a, b) { return a + b ? Math.round(c * a / (a + b)) : 0; };
    // 함께 산 건물을 철거하고 토지만 팔면 철거한 건물 몫 취득가액도 토지 취득가액으로 [확인 필요 — 근거 원문 미확인]
    if (양.토지만 && 값취.건) { 값취 = { 토: 값취.토 + 값취.건, 건: 0 }; }
    const tx = [
      { 이름: '토지', transferPrice: 값양.토, transferDate: 양.날짜 || undefined, assetType: 'other', acquisitionDate: 토지취득일 || undefined, acquisitionPrice: 값취.토, necessaryExpenses: 나눔(양.비용, 값양.토, 값양.건) + 나눔(취.비용, 값취.토, 값취.건), acquisitionCause: 'purchase' },
      { 이름: '건물', transferPrice: 값양.건, transferDate: 양.날짜 || undefined, assetType: 'other', acquisitionDate: 건물취득일 || undefined, acquisitionPrice: 값취.건, necessaryExpenses: 양.비용 + 취.비용 - 나눔(양.비용, 값양.토, 값양.건) - 나눔(취.비용, 값취.토, 값취.건), acquisitionCause: 'purchase' }];
    if (jmYn_(p.토지비사업용) === true) tx[0].isNonBusinessLand = true;
    const tx2 = tx.filter(function (t) { return t.transferPrice > 0; });
    return { 이름: 이름 + ' — 양도 토지 ' + won(값양.토) + '·건물 ' + won(값양.건) + ' / 취득 토지 ' + won(값취.토) + '·건물 ' + won(값취.건), 도구: 'calculate_transfer_tax_multi', 엔진칸: { transactions: tx2.map(function (t) { const o = Object.assign({}, t); delete o.이름; return o; }) } };
  };
  const 계약 = function (r) { return r.구분안함 || r.안분못함 || r.모름 ? { 토: r.안분토지 || 0, 건: r.안분건물 || 0 } : { 토: r.계약토지, 건: r.계약건물 }; };
  const 인정 = function (r) { return { 토: r.인정토지 != null ? r.인정토지 : (r.계약토지 || 0), 건: r.인정건물 != null ? r.인정건물 : (r.계약건물 || 0) }; };
  const e1 = 엔진(계약(양), 계약(취), '① 계약서대로 신고하면');
  const e2 = 엔진(인정(양), 인정(취), '② 세법이 인정하는 값(§100②③)');
  if (e1) 경우.push(e1);
  if (e2 && JSON.stringify(e2.엔진칸) !== JSON.stringify(e1 && e1.엔진칸)) 경우.push(e2);
  const 토지취득일 = jmYmd_((p.취득 || {}).토지날짜) || '', 건물취득일 = jmYmd_((p.취득 || {}).건물날짜) || '';
  if (양.토지만 && n((p.취득 || {}).건물)) notes.push('[확인 필요] 건물을 철거하고 토지만 판 경우 철거한 건물의 취득가액(과 철거비)을 토지 취득가액에 넣음 — 근거 조문·통칙 원문 미확인');
  if (jmYn_(p.토지비사업용) === true) notes.push('토지가 비사업용 토지면 토지 몫에만 10%p 더함(소득세법 §104①8호) — 건물 몫을 부풀리면 세금이 줄어 보이지만 30% 넘으면 안분가액으로 다시 셈');
  if (토지취득일 && 건물취득일 && 토지취득일 !== 건물취득일) notes.push('토지(' + 토지취득일 + ')와 건물(' + 건물취득일 + ') 취득일이 달라 보유기간·장기보유특별공제가 따로 — 몫을 어떻게 나누느냐가 세액을 바꿈');
  if (jmYn_(p.주택) === true) notes.push('주택과 부수토지는 1세대1주택·중과를 함께 봄 — 판정은 1세대1주택 판정 도구로, 이 도구는 나눈 값만');
  if (jmYn_(p.특수관계) === true) notes.push('특수관계인과 거래면 합계 자체가 시가와 다른지 먼저 봄(부당행위계산 소득세법 §101①·시행령 §167③④) — 이 도구는 합계를 맞다고 보고 나누기만');
  notes.push('범위 밖 한 줄: 부가가치세도 건물 공급가액을 같은 방식으로 안분하고 30% 이상 차이면 안분가액(부가가치세법 §29⑨2호 [확인 필요]) — 사는 사람의 감가상각·부가세 환급 때문에 건물값을 높게 적자는 요청이 흔함');
  if (경우.length > 1) 할일.push({ 무엇: '계약서 토지·건물 값을 안분가액 30% 안으로 다시 쓰거나, 신고 때 안분가액으로 신고', 때: 양.날짜 ? '잔금 전(계약 고칠 때)·양도일이 든 달 말일부터 2개월 안 예정신고' : '계약·신고 전', 근거: '소득세법 §100③·§105①' });
  return jmWrap_('토지건물구분', reqs, { 양도: 양, 취득: 취, 예외: 예외사유 || undefined, 경우: 경우, 엔진칸: 경우[경우.length - 1] ? 경우[경우.length - 1].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 73 「반씨 빚 많은 상속」] 상속재산에서 빼는 공과금·장례비·채무 — 어떤 빚이 증빙으로 빠지나
//  상속개시일 현재 피상속인이나 상속재산에 관련된 공과금·장례비용·채무를 뺌(상증법 §14①), 증여채무(상속인 10년·상속인 아닌 자 5년 안)는 채무가 아님(§14①3호 괄호)
//  채무는 상속인이 실제로 부담하는 사실이 증명돼야 — 국가·지방자치단체·금융회사등 채무는 그 기관 채무 확인 서류, 그 밖의 채무는 채무부담계약서·채권자확인서·담보설정·이자지급 증빙 등(시행령 §10①)
//  공과금 = 상속개시일 현재 피상속인이 납부할 의무가 있고 상속인에게 승계된 조세·공공요금 등(시행령 §9①·시행규칙 §2의2)
//  장례비 = 장례 직접 비용(500만 미만이면 500만, 1천만 넘으면 1천만) + 봉안시설·자연장지(500만 한도)(시행령 §9②) — 세액 엔진이 funeralCostAmount·funeralNicheCostAmount로 직접 셈
//  빼는 금액이 상속재산보다 크면 넘는 부분은 없는 것으로 봄(§13① 후단) — 사전증여 가산분에서 빼지 못함
//  p: { 상속개시일, 배우자(예), 자녀수, 배우자실제상속액, 상속재산(총액), 사전증여(상속세 과세가액에 더할 사전증여 합계),
//       채무: [{ 이름, 종류(금융|국가|개인|임대보증금|보증|연대|증여|세금|공공요금|기타), 금액, 채권자, 채권자상속인(예), 증빙[부채증명|계약서|채권자확인|담보|이자지급|이체|고지서|임대차계약], 발생일, 주채무자변제불능(예/아니오), 부담비율(연대 — 피상속인 몫), 다른연대채무자변제불능(예), 받는사람상속인(예 — 증여채무), 사용처확인(예/아니오) }],
//       장례비, 장례비증빙(예), 봉안비, 기준일 }
function judgeInheritDebt_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 판 = [];
  const 개시 = jmYmd_(p.상속개시일) || '';
  const 일수 = function (a, b) { return a && b ? Math.round((new Date(b) - new Date(a)) / 86400000) : null; };
  const 년전 = function (y) { if (!개시) return ''; const d = new Date(개시); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10); };
  (p.채무 || []).forEach(function (c) {
    c = c || {};
    const 종류 = String(c.종류 || '기타'), 금액 = n(c.금액), 증빙 = [].concat(c.증빙 || []).map(String).join(' ');
    const 발생 = jmYmd_(c.발생일) || '';
    const r = { 이름: c.이름 || 종류, 종류: 종류, 신고액: 금액, 인정액: 0, 판정: null, 왜: '', 근거: '', 받을것: [] };
    const 있음 = function (re) { return re.test(증빙); };
    if (/증여/.test(종류)) {
      const 상속인 = jmYn_(c.받는사람상속인) === true, 한 = 상속인 ? 년전(10) : 년전(5);
      const 안 = 발생 && 한 && 발생 >= 한;
      r.판정 = 안 ? false : 발생 ? true : null; r.인정액 = r.판정 === true ? 금액 : 0;
      r.왜 = 안 ? '상속개시일 전 ' + (상속인 ? '10년' : '5년') + ' 안에 ' + (상속인 ? '상속인' : '상속인 아닌 자') + '에게 진 증여채무 — 채무로 안 뺌' : 발생 ? '증여채무지만 ' + (상속인 ? '10년' : '5년') + ' 전 — 채무로 뺌(증빙은 따로)' : '증여채무가 생긴 날을 몰라 판정 못 함';
      r.근거 = '상증법 §14①3호 괄호';
      if (!발생) r.받을것.push('증여 약정서(날짜)');
    } else if (/세금|공공요금|공과/.test(종류)) {
      const 고지 = 있음(/고지|납부서|체납|확인/);
      r.판정 = 고지 ? true : null; r.인정액 = 고지 ? 금액 : 0;
      r.왜 = (고지 ? '상속개시일 현재 피상속인이 낼 의무가 있던 ' + (/공공/.test(종류) ? '공공요금' : '세금') + ' — 공과금으로 뺌' : '고지서·체납 확인 서류가 없어 잠정') + (/공공/.test(종류) ? ' [확인 필요 — 시행규칙 §2의2(2026.1.2 개정) 「공공요금에 해당하는 경우를 제외」 문구와 시행령 §9① 「조세·공공요금」의 관계]' : '');
      r.근거 = '상증법 §14①1호·시행령 §9①·시행규칙 §2의2';
      if (!고지) r.받을것.push('세금 고지서·체납 내역(사망일 현재)');
    } else if (/금융|국가|카드|은행|대출/.test(종류)) {
      const ok = 있음(/부채증명|금융|조회|대출|확인/);
      r.판정 = ok ? true : null; r.인정액 = ok ? 금액 : 0;
      r.왜 = ok ? '그 기관의 채무 확인 서류(부채증명 등)로 증명' : '부채증명을 아직 받지 않아 잠정 — 받으면 그대로 뺌';
      r.근거 = '시행령 §10①1호';
      if (!ok) r.받을것.push(r.이름 + ' 부채증명서(사망일 현재 잔액)');
    } else if (/임대|보증금/.test(종류) && !/보증채무|^보증$/.test(종류)) {
      const 계 = 있음(/임대차|계약/), 돈 = 있음(/이체|통장|영수|확인/);
      r.판정 = 계 && 돈 ? true : 계 || 돈 ? null : false; r.인정액 = r.판정 === true ? 금액 : 0;
      r.왜 = r.판정 === true ? '임대차계약서와 보증금 받은 증빙으로 확인되는 임대보증금 — 채무로 뺌' : r.판정 === null ? '임대차계약서나 보증금 받은 증빙 중 하나만 — 잠정' : '임대차 증빙 없음';
      r.근거 = '시행령 §10①2호';
      if (!(계 && 돈)) r.받을것.push(r.이름 + ' ' + (계 ? '' : '임대차계약서 ') + (돈 ? '' : '보증금 받은 통장 내역'));
    } else if (/^보증|보증채무/.test(종류)) {
      const 불능 = jmYn_(c.주채무자변제불능);
      r.판정 = 불능 === true ? true : 불능 === false ? false : null; r.인정액 = r.판정 === true ? 금액 : 0;
      r.왜 = 불능 === true ? '주채무자가 갚을 수 없어 피상속인이 부담하게 될 것이 확실한 보증채무 — 뺌(구상권으로 돌려받을 수 있는 만큼은 빼지 않음)' : 불능 === false ? '주채무자가 갚을 수 있는 보증채무 — 빼지 않음' : '주채무자가 갚을 수 있는지 몰라 잠정';
      r.근거 = '시행령 §10① — 보증채무 기준은 상증법 기본통칙 [확인 필요 — 통칙 번호·원문 미확인]';
      if (불능 !== true) r.받을것.push('주채무자 재산·변제능력 자료(파산·회생·체납 등)');
    } else if (/연대/.test(종류)) {
      const 비 = Number(c.부담비율) > 0 ? Number(c.부담비율) > 1 ? Number(c.부담비율) / 100 : Number(c.부담비율) : 0;
      const 불능 = jmYn_(c.다른연대채무자변제불능) === true;
      r.판정 = 비 || 불능 ? true : null;
      r.인정액 = 불능 ? 금액 : Math.round(금액 * 비);
      r.왜 = 불능 ? '다른 연대채무자가 갚을 수 없어 전부 뺌' : 비 ? '피상속인 부담 몫 ' + Math.round(비 * 100) + '%만 뺌' : '피상속인 부담 몫을 몰라 잠정';
      r.근거 = '시행령 §10① — 연대채무 기준은 상증법 기본통칙 [확인 필요 — 통칙 번호·원문 미확인]';
      if (!비 && !불능) r.받을것.push('연대채무 약정서(부담 비율)');
    } else {
      // 개인 채무 — 채무부담계약서·채권자확인서·담보설정·이자지급 증빙 등(시행령 §10①2호)
      const 계 = 있음(/계약|차용/), 확 = 있음(/채권자확인|확인서/), 담 = 있음(/담보|근저당|저당/), 이 = 있음(/이자|이체|통장/);
      const 강 = 담 || 이, 약 = 계 || 확;
      const 상속인채권 = jmYn_(c.채권자상속인) === true;
      r.판정 = 강 ? true : 약 ? null : false; r.인정액 = r.판정 === true ? 금액 : 0;
      r.왜 = 강 ? '담보설정·이자지급(돈이 오간 흔적) 증빙으로 실제 채무 확인' : 약 ? '계약서·채권자확인서만 있음 — 돈이 실제로 오갔는지(빌려준 돈 이체·이자 지급) 없으면 부인될 수 있어 잠정' : '증빙 없음 — 빼지 못함';
      if (상속인채권) r.왜 += ' · 채권자가 상속인 — 가족 사이 차용은 실제 빌려준 돈의 흐름까지 봄';
      r.근거 = '상증법 §14④·시행령 §10①2호';
      if (!강) r.받을것.push(r.이름 + ' 빌려준 돈 이체 내역·이자 지급 통장 내역' + (계 ? '' : '·차용증'));
    }
    // §15①2호 — 상속개시일 전 1년 2억·2년 5억 넘게 진 빚은 쓴 곳을 밝혀야(추정은 상속추정재산 도구)
    r.발생일 = 발생;
    if (발생 && 개시 && !/증여|세금|공공요금|공과/.test(종류)) { const d = 일수(발생, 개시); r.개시전일수 = d; }
    판.push(r);
  });
  const 개시전 = function (일) { return 판.filter(function (r) { return r.개시전일수 != null && r.개시전일수 >= 0 && r.개시전일수 <= 일; }).reduce(function (s, r) { return s + r.신고액; }, 0); };
  const 년1 = 개시전(365), 년2 = 개시전(730);
  if (년1 >= 200000000 || 년2 >= 500000000) {
    notes.push('상속개시일 전 1년 안에 진 빚 ' + won(년1) + '·2년 안 ' + won(년2) + ' — 1년 2억·2년 5억 이상이면 빌린 돈을 어디 썼는지 밝히지 못한 금액(20%·2억 중 적은 금액을 뺀)을 상속받은 것으로 추정(상증법 §15①2호·시행령 §11) → 판정 묶음 「상속추정재산」으로');
    할일.push({ 무엇: '상속개시 전 1~2년 안에 빌린 돈의 쓴 곳 자료(통장·영수증)', 때: '상속세 신고 전', 근거: '상증법 §15①2호' });
  }
  판.forEach(function (r) { reqs.push(jmReq_(r.이름 + '(' + r.종류 + ') ' + won(r.신고액) + ' — 상속재산에서 뺌', r.판정, r.왜 + (r.판정 === true && r.인정액 !== r.신고액 ? ' → ' + won(r.인정액) : ''), r.근거)); r.받을것.forEach(function (x) { 할일.push({ 무엇: x, 때: '상속세 신고 전', 근거: r.근거 }); }); });
  // 장례비 — 엔진이 500만 바닥·1천만 한도·봉안 500만 한도를 셈
  const 장 = n(p.장례비), 장증 = jmYn_(p.장례비증빙) === true, 봉 = n(p.봉안비);
  const 장인정 = 장 && 장증 ? 장 : 0;
  if (장 && !장증) { notes.push('장례비 ' + won(장) + ' 증빙이 없음 — 증빙 없으면 500만원만 빠짐(시행령 §9②1호) · 영수증·카드 내역을 모으면 1천만원까지'); 할일.push({ 무엇: '장례식장·상조·음식 영수증(사망일~장례일)', 때: '상속세 신고 전', 근거: '시행령 §9②' }); }
  if (봉) notes.push('봉안시설·자연장지 ' + won(봉) + ' — 500만원 한도로 따로 빠짐(시행령 §9②2호)');
  // 경우
  const 재산 = n(p.상속재산), 사전 = n(p.사전증여);
  const 배우자 = jmYn_(p.배우자) === true, 자녀 = n(p.자녀수);
  const 칸 = function (빚, 장례) {
    const 순 = Math.max(0, 재산 - 빚);
    const c = { taxableEstateAmount: 순 + 사전, grossEstateValue: 재산, inheritanceDate: 개시 || undefined, dateOfDeath: 개시 || undefined, hasSpouse: 배우자, childCount: 자녀, isDecedentResident: true, funeralCostAmount: 장례, funeralNicheCostAmount: 봉 };
    if (사전) c.priorGiftedAmountIncludedInEstate = 사전;
    if (배우자) { const 법정 = 1.5 / (1.5 + Math.max(자녀, 0)); c.spouseLegalShareRatio = 법정; c.spouseActualInheritedAmount = n(p.배우자실제상속액) || Math.round((순 + 사전) * 법정); }
    return c;
  };
  const 합 = function (f) { return 판.reduce(function (s, r) { return s + f(r); }, 0); };
  const 전부 = 합(function (r) { return r.신고액; }), 확실 = 합(function (r) { return r.판정 === true ? r.인정액 : 0; }), 잠정 = 합(function (r) { return r.판정 === null ? r.신고액 : 0; });
  if (재산) {
    경우.push({ 이름: '① 신고하려는 빚 전부(' + won(전부) + ')·장례비 ' + (장 ? won(장) : '증빙 없어 500만'), 빼는빚: 전부, 엔진칸: 칸(전부, 장) });
    if (잠정) 경우.push({ 이름: '② 증빙 있는 것 + 잠정(받을 서류를 받는다고 보고, ' + won(확실 + 잠정) + ')', 빼는빚: 확실 + 잠정, 엔진칸: 칸(확실 + 잠정, 장인정) });
    경우.push({ 이름: '③ 지금 증빙으로 확실한 것만(' + won(확실) + ')·장례비 ' + (장인정 ? won(장인정) : '증빙 없어 500만'), 빼는빚: 확실, 엔진칸: 칸(확실, 장인정) });
    경우.forEach(function (c) { if (!c.엔진칸.taxableEstateAmount) { c.과세가액0 = true; c.이름 += ' — 과세가액 0, 상속세 없음'; c.엔진칸 = undefined; } });
    for (let i = 경우.length - 1; i > 0; i--) if (JSON.stringify(경우[i].엔진칸) === JSON.stringify(경우[i - 1].엔진칸)) 경우.splice(i, 1);
    if (전부 > 재산) notes.push('빚(' + won(전부) + ')이 상속재산(' + won(재산) + ')보다 큼 — 넘는 부분은 없는 것으로 보고 사전증여 가산분에서 빼지 못함(상증법 §13① 후단). 상속인이 갚을 빚이 남으면 한정승인·상속포기(민법 §1019① 안 날부터 3개월)를 판정 묶음 「한정승인」·「상속인」으로');
  }
  notes.push('빠지는 빚은 상속인이 실제로 갚는 것이라야(시행령 §10①) — 신고 뒤 세무서는 금융 부채·개인 채무의 실제 상환을 따로 봄. 가공 채무로 밝혀지면 그만큼 다시 더하고 가산세(국세기본법 §47의3)');
  if (개시) {
    const d = new Date(개시); const 신고기한 = new Date(d.getFullYear(), d.getMonth() + 7, 0);
    const 기 = 신고기한.getFullYear() + '-' + String(신고기한.getMonth() + 1).padStart(2, '0') + '-' + String(신고기한.getDate()).padStart(2, '0');
    notes.push('상속세 신고기한 ' + 기 + '(상속개시일이 속한 달 말일부터 6개월, 상증법 §67①)');
  }
  return jmWrap_('상속채무', reqs, { 채무판정: 판, 빼는빚: { 신고: 전부, 확실: 확실, 잠정: 잠정 }, 상속개시전1년빚: 년1, 상속개시전2년빚: 년2, 경우: 경우, 엔진칸: 경우.filter(function (c) { return c.엔진칸; })[0] ? 경우.filter(function (c) { return c.엔진칸; })[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 74 「길씨 다가구 옥탑」] 다가구주택을 한 채로 보나 — 층수·면적·세대수, 통째 양도, 상가 겸용
//  1세대1주택 비과세(소득세법 §89①3호)를 볼 때 건축법 시행령 별표 1 제1호다목의 다가구주택은 구획된 부분을 각각 하나의 주택으로 보되, 구획별로 팔지 않고 하나의 매매단위로 팔면 전체를 하나의 주택으로 봄(시행령 §155⑮)
//  고가주택(12억) 판정도 그 전체를 하나의 주택으로(시행령 §156③) · 중과 주택 수는 §155⑮ 준용, 단서(전체 한 채)는 거주자가 고를 때만(시행령 §167의3②1호)
//  다가구주택 요건(건축법 시행령 별표 1 제1호다목): 주택으로 쓰는 층수(지하층 제외) 3개 층 이하(1층 바닥면적 1/2 이상을 필로티 주차장으로 쓰고 나머지를 주택 외 용도로 쓰면 그 층 제외) · 1개 동 주택 바닥면적(부설 주차장 제외) 합계 660㎡ 이하 · 19세대 이하 [별표 원문 대조 — 확인 필요]
//  요건을 넘으면(옥탑·근린생활시설을 주택으로 쓰는 등) 다세대주택(공동주택)과 같아져 호마다 한 주택 — 실제 쓰임으로 봄 [판례 원문 미확인 — 확인 필요]
//  p: { 대장용도(다가구|다세대|단독|근생), 구분등기(예), 대장주택층수, 실제주택층수(옥탑·근생 주거 포함), 필로티주차(예), 주택바닥면적(㎡), 세대수, 실제세대수,
//       주택연면적, 주택외연면적(상가), 양도방식(통째|호별), 양도가액, 양도일, 취득가액, 취득일, 필요경비, 거주연수, 다른주택수(세대가 이 건물 말고 가진 주택 수), 보유2년(예), 거주2년(예 — 조정대상지역 취득) }
function judgeMultiHousehold_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 용도 = String(p.대장용도 || '');
  const 구분등기 = jmYn_(p.구분등기) === true;
  const 필로티 = jmYn_(p.필로티주차) === true;
  const 층대장 = n(p.대장주택층수), 층실제 = n(p.실제주택층수) || 층대장;
  const 면적 = Number(p.주택바닥면적) || 0, 세대 = n(p.실제세대수) || n(p.세대수);
  const 통째 = !/호별|나눠|일부/.test(String(p.양도방식 || '통째'));
  // 1) 다가구 요건 — 건축물대장과 실제 쓰임 둘 다
  const 층ok = 층실제 ? 층실제 <= 3 : null, 면ok = 면적 ? 면적 <= 660 : null, 세ok = 세대 ? 세대 <= 19 : null;
  reqs.push(jmReq_('주택으로 쓰는 층수 3개 층 이하(지하층 제외)', 층ok, 층실제 ? '실제 ' + 층실제 + '개 층' + (층대장 && 층대장 !== 층실제 ? '(건축물대장 ' + 층대장 + '개 층 — 옥탑·근린생활시설을 주택으로 씀)' : '') + (필로티 ? ' · 1층 필로티 주차는 층수에서 뺀 값으로 넣을 것' : '') : '층수 모름', '건축법 시행령 별표 1 제1호다목 1)'));
  reqs.push(jmReq_('주택 바닥면적 합계 660㎡ 이하(부설 주차장 제외)', 면ok, 면적 ? 면적 + '㎡' : '면적 모름', '건축법 시행령 별표 1 제1호다목 2)'));
  reqs.push(jmReq_('19세대 이하', 세ok, 세대 ? 세대 + '세대' + (n(p.실제세대수) && n(p.세대수) && n(p.실제세대수) !== n(p.세대수) ? '(대장 ' + n(p.세대수) + '세대)' : '') : '세대수 모름', '건축법 시행령 별표 1 제1호다목 3)'));
  if (구분등기) reqs.push(jmReq_('호별 구분등기 없음(구분등기면 다세대)', false, '호마다 구분등기 — 다세대주택(공동주택)으로 각 호가 한 주택', '건축법 시행령 별표 1 제2호다목·시행령 §155⑮'));
  const 다가구 = !구분등기 && 층ok !== false && 면ok !== false && 세ok !== false && !/다세대|아파트|연립/.test(용도);
  const 모름 = 다가구 && (층ok === null || 면ok === null || 세ok === null);
  // 2) 한 채로 보나
  let 주택수;
  if (다가구 && 통째) { 주택수 = 1; reqs.push(jmReq_('하나의 매매단위로 통째 양도 → 전체를 한 주택', true, '다가구주택을 구획별로 나누지 않고 한 번에 팖', '소득세법 시행령 §155⑮ 단서')); }
  else if (다가구) { 주택수 = 세대 || null; reqs.push(jmReq_('하나의 매매단위로 통째 양도 → 전체를 한 주택', false, '구획별로 나눠 팖 — 구획마다 한 주택(' + (세대 || '?') + '채)', '소득세법 시행령 §155⑮ 본문')); }
  else { 주택수 = 구분등기 ? (세대 || null) : (세대 || null); }
  // 3) 상가 겸용
  const 주연 = Number(p.주택연면적) || 0, 외연 = Number(p.주택외연면적) || 0;
  if (주연 && 외연) notes.push('상가 겸용 — 주택 연면적 ' + 주연 + '㎡ ' + (주연 > 외연 ? '>' : '≤') + ' 주택 외 ' + 외연 + '㎡: ' + (주연 > 외연 ? '전부 주택으로 봄(시행령 §154③ 본문). 다만 양도가액 12억 넘는 고가주택이면 주택 부분만 주택(시행령 §160① 괄호, 2022.1.1 이후 양도) — 판정 묶음 「1세대1주택」으로' : '주택 외 부분은 주택이 아님(§154③ 단서) — 상가 몫은 따로 과세(판정 묶음 「토지건물구분」으로 가액 나누기)'));
  // 4) 세액 — ① 다가구 한 채(비과세·고가 초과분) ② 공동주택(다세대)으로 봄(비과세 안 됨)
  const 양가 = n(p.양도가액), 취가 = n(p.취득가액);
  const 다른 = n(p.다른주택수);
  const 한채요건 = !(다가구 && !통째) && 다른 === 0 && jmYn_(p.보유2년) !== false && jmYn_(p.거주2년) !== false;
  if (다른 > 0) notes.push('세대가 이 건물 말고 주택 ' + 다른 + '채를 더 가짐 — 다가구 한 채로 보더라도 1세대1주택이 아님(일시적 2주택 등 특례는 판정 묶음 「1세대1주택」으로)');
  const 칸 = function (한채) {
    if (!양가) return null;
    const c = { transferPrice: 양가, transferDate: jmYmd_(p.양도일) || undefined, assetType: 'house', acquisitionDate: jmYmd_(p.취득일) || undefined, acquisitionPrice: 취가, necessaryExpenses: n(p.필요경비), acquisitionCause: 'purchase' };
    if (한채) { c.isOneHouseOneFamily = true; if (p.거주연수 != null && p.거주연수 !== '') c.residenceYears = Number(p.거주연수); }
    return c;
  };
  const e1 = 칸(true), e2 = 칸(false);
  if (e1 && 한채요건) 경우.push({ 이름: '① 다가구 한 채로 인정(1세대1주택 — 12억까지 비과세, 넘는 몫만 과세)', 엔진칸: e1 });
  if (e2) 경우.push({ 이름: (한채요건 ? '② ' : '① ') + '한 채로 인정 안 됨(공동주택 여러 채 또는 1세대1주택 요건 밖) — 비과세 없이 과세', 엔진칸: e2 });
  if (경우.length > 1 && !다가구) { 경우.reverse(); 경우[0].이름 = 경우[0].이름.replace(/^② /, '① 지금 판정 — '); 경우[1].이름 = 경우[1].이름.replace(/^① /, '② 다가구로 바로잡으면 — '); }
  // 5) 할 일
  if (다가구 === false || (층대장 && 층실제 > 층대장)) {
    할일.push({ 무엇: '옥탑·근린생활시설을 주택으로 쓰지 않게 원상복구(용도 되돌림)하고 건축물대장·실제 쓰임을 맞춘 뒤 양도', 때: '양도(잔금) 전', 근거: '건축법 시행령 별표 1 제1호다목 — 양도일 현재 기준 [확인 필요]' });
    notes.push('층수·세대수는 건축물대장이 아니라 실제 쓰임으로 봄 — 위반건축물(옥탑 증축·근생 주거)이면 세무서가 다세대로 보아 비과세를 부인한 사례가 많음 [판례 원문 미확인 — 확인 필요]. 양도일 현재 기준으로 보므로 팔기 전에 원상복구하면 다가구로 돌아올 수 있음 [확인 필요 — 원상복구 뒤 보유·거주기간 계산]');
  }
  if (다가구 && !통째) notes.push('다가구를 구획별로 나눠 팔면 구획마다 한 주택 — 처음 판 구획은 다주택 상태 양도. 한 번에 팔거나 마지막 구획만 비과세를 기대할 수 있음 [확인 필요 — 남은 구획의 보유기간 기산]');
  if (모름) 할일.push({ 무엇: '건축물대장(층별 용도·면적)·실제 세대 현황(전입 세대 열람)', 때: '판정 전', 근거: '건축법 시행령 별표 1' });
  notes.push('중과 주택 수를 셀 때는 다가구를 구획마다 한 채로 세되, 거주자가 고르면 전체 한 채(시행령 §167의3②1호) — 다른 주택 양도 때 이 다가구를 한 채로 신고할지 정해야 함');
  return jmWrap_('다가구', reqs, { 다가구: 다가구, 확인부족: 모름 || undefined, 통째양도: 통째, 주택수로봄: 주택수, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 75 「위씨 4남매 공동상속」] 공동상속주택 — 누가 소유한 것으로 보나(최대지분·거주·최연장), 소수지분자의 일반주택 비과세
//  공동상속주택(상속으로 여러 사람이 공동으로 소유하는 1주택, 피상속인이 2주택 이상이면 §155② 각 호 순위의 1주택) 외의 다른 주택을 양도할 때 그 공동상속주택은 그 거주자의 주택으로 보지 않음.
//  다만 상속지분이 가장 큰 상속인은 그렇지 않고, 가장 큰 사람이 2명 이상이면 1. 그 주택에 거주하는 사람 3. 최연장자 순으로 그 사람이 소유한 것으로 봄(소득세법 시행령 §155③, 2호 삭제)
//  피상속인이 2주택 이상이면 상속주택 1채: 1. 소유기간 가장 긴 것 2. 거주기간 가장 긴 것 3. 상속개시 당시 거주한 것 4. 기준시가 가장 높은 것(시행령 §155② 각 호)
//  중과 주택 수도 상속지분이 가장 큰 상속인 소유로 셈(시행령 §167의3②2호)
//  p: { 상속개시일, 납세자(이름), 상속인:[{이름, 지분(% 또는 '1/4'), 거주(예 — 그 주택에 삶), 생년월일, 같은세대(예 — 납세자와 같은 세대)}],
//       피상속인주택:[{이름, 소유시작일, 거주년수, 개시당시거주(예), 기준시가}](2채 이상일 때), 공동상속주택이름,
//       양도주택(일반|공동상속지분), 일반주택취득일, 일반주택증여2년(예 — 상속개시 전 2년 안 피상속인에게 받음), 다른주택수(공동상속주택·양도주택 말고 세대 주택 수),
//       양도가액, 양도일, 취득가액, 취득일, 필요경비, 거주연수 }
function judgeCoInheritedHouse_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const 지분 = function (v) { const s = String(v == null ? '' : v).trim(); const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/); if (m) return Number(m[1]) / Number(m[2]); const x = Number(s.replace(/[^0-9.]/g, '')); return x > 1 ? x / 100 : x; };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 개시 = jmYmd_(p.상속개시일);
  // 1) 어느 주택이 공동상속주택인가 — 피상속인이 2채 이상이면 §155② 각 호 순위
  let 상속주택 = p.공동상속주택이름 || '';
  const 집 = Array.isArray(p.피상속인주택) ? p.피상속인주택.filter(function (h) { return h && h.이름; }) : [];
  if (집.length > 1) {
    const 기간 = function (h) { const a = jmYmd_(h.소유시작일); return a && 개시 ? (new Date(개시) - new Date(a)) : -1; };
    const 정렬 = 집.slice().sort(function (a, b) {
      return (기간(b) - 기간(a)) || ((Number(b.거주년수) || 0) - (Number(a.거주년수) || 0)) || ((jmYn_(b.개시당시거주) === true) - (jmYn_(a.개시당시거주) === true)) || (n(b.기준시가) - n(a.기준시가));
    });
    const 첫 = 정렬[0], 둘 = 정렬[1];
    const 왜 = 기간(첫) !== 기간(둘) ? '1호 피상속인 소유기간이 가장 김' : (Number(첫.거주년수) || 0) !== (Number(둘.거주년수) || 0) ? '2호 소유기간이 같아 거주기간이 가장 김' : (jmYn_(첫.개시당시거주) === true) !== (jmYn_(둘.개시당시거주) === true) ? '3호 소유·거주기간이 같아 상속개시 당시 거주한 주택' : n(첫.기준시가) !== n(둘.기준시가) ? '4호 기준시가가 가장 높음' : '4호 괄호 — 기준시가도 같아 상속인이 고름';
    if (상속주택 && 상속주택 !== 첫.이름) notes.push('넣은 공동상속주택 「' + 상속주택 + '」과 순위로 고른 「' + 첫.이름 + '」이 다름 — 순위에 따른 1주택만 공동상속주택(특례) 대상, 나머지 상속주택은 일반 주택으로 셈');
    상속주택 = 첫.이름;
    reqs.push(jmReq_('피상속인이 2주택 이상 — 특례 대상 상속주택 1채', true, '「' + 첫.이름 + '」 — ' + 왜, '소득세법 시행령 §155② 각 호'));
  }
  // 2) 누가 소유한 것으로 보나 — 최대지분 → 거주자 → 최연장자
  const 사람 = (Array.isArray(p.상속인) ? p.상속인 : []).filter(function (h) { return h && h.이름; }).map(function (h) { return { 이름: h.이름, 지분: 지분(h.지분), 거주: jmYn_(h.거주) === true, 생: jmYmd_(h.생년월일) || '', 같은세대: jmYn_(h.같은세대) === true || h.이름 === p.납세자 }; });
  let 주인 = null, 순서 = '';
  if (사람.length) {
    const 최대 = Math.max.apply(null, 사람.map(function (h) { return h.지분 || 0; }));
    let 후보 = 사람.filter(function (h) { return Math.abs((h.지분 || 0) - 최대) < 1e-9; });
    순서 = '상속지분이 가장 큰 사람(' + Math.round(최대 * 10000) / 100 + '%)';
    if (후보.length > 1) {
      const 거주 = 후보.filter(function (h) { return h.거주; });
      if (거주.length === 1) { 후보 = 거주; 순서 += ' 여럿 → 1호 그 주택에 거주하는 사람'; }
      else {
        if (거주.length > 1) 후보 = 거주;
        const 생있음 = 후보.every(function (h) { return h.생; });
        if (생있음) { 후보 = 후보.slice().sort(function (a, b) { return a.생 < b.생 ? -1 : a.생 > b.생 ? 1 : 0; }); if (후보[0].생 !== 후보[1].생) 후보 = [후보[0]]; 순서 += ' 여럿 → ' + (거주.length > 1 ? '거주자도 여럿 → ' : '거주자 없음 → ') + '3호 최연장자'; }
        else 순서 += ' 여럿 → 3호 최연장자(생년월일 모름)';
      }
    }
    if (후보.length === 1) 주인 = 후보[0];
    reqs.push(jmReq_('공동상속주택을 소유한 것으로 보는 사람', 주인 ? true : null, 주인 ? '「' + 주인.이름 + '」 — ' + 순서 : '정하지 못함 — ' + 순서, '소득세법 시행령 §155③ 단서·각 호'));
    if (!p.상속인.every(function (h) { return h && h.지분 != null && h.지분 !== ''; })) 할일.push({ 무엇: '상속인별 실제 상속지분(협의분할서·등기부) — 법정지분이 아니라 실제로 나눈 지분', 때: '판정 전', 근거: '시행령 §155③ 「상속지분」 [확인 필요 — 등기 지분 기준]' });
  }
  const 납 = 사람.find(function (h) { return h.이름 === p.납세자; });
  const 납세자주인 = !!(주인 && 납 && 주인.이름 === 납.이름);
  const 세대주인 = !!(주인 && 주인.같은세대);
  if (주인 && !납세자주인 && 세대주인) notes.push('최대지분자 「' + 주인.이름 + '」이 납세자와 같은 세대 — 1세대 주택 수에 그 공동상속주택이 듦(세대원 소유 주택은 세대 주택으로 셈) [확인 필요 — 예규]');
  if (납 && !세대주인) reqs.push(jmReq_('납세자는 소수지분자 — 공동상속주택을 주택 수에서 뺌', true, '「' + 납.이름 + '」 지분 ' + Math.round((납.지분 || 0) * 10000) / 100 + '% · 상속받은 지 몇 년이 지나도 그대로(기간 제한 없음)', '시행령 §155③ 본문'));
  // 3) 양도하는 주택이 비과세인가
  const 양도 = String(p.양도주택 || '일반');
  const 다른 = n(p.다른주택수);
  let 한채 = null, 왜한채 = '';
  if (/공동|지분/.test(양도)) {
    한채 = null; 왜한채 = '공동상속주택 지분 자체를 팖 — §155③은 「그 외의 다른 주택」을 팔 때만 주택 수에서 뺌. 지분 양도는 세대가 가진 다른 주택과 함께 1세대1주택인지 따로 봐야 함 [확인 필요]';
    notes.push(왜한채);
  } else if (!세대주인) {
    한채 = 다른 === 0; 왜한채 = 한채 ? '공동상속주택을 빼면 일반주택 1채 — 1세대1주택 비과세(§89①3호·시행령 §154①)' : '공동상속주택을 빼도 다른 주택 ' + 다른 + '채 — 1세대1주택 아님';
  } else {
    const 일반취득 = jmYmd_(p.일반주택취득일);
    const 개시전보유 = 일반취득 && 개시 ? 일반취득 <= 개시 : null;
    if (jmYn_(p.일반주택증여2년) === true) { 한채 = false; 왜한채 = '최대지분자 세대 — 일반주택이 상속개시 전 2년 안 피상속인에게 증여받은 것이라 §155② 일반주택이 아님'; }
    else if (개시전보유 === false) { 한채 = false; 왜한채 = '최대지분자 세대 — 일반주택(' + 일반취득 + ')을 상속개시 뒤 취득해 §155② 괄호 「상속개시 당시 보유한 주택」이 아님 → 2주택'; }
    else { 한채 = 개시전보유 === null ? null : 다른 === 0; 왜한채 = '최대지분자 세대 — 공동상속주택이 주택 수에 들지만 상속주택 특례(§155②)로 일반주택 1채로 봄' + (개시전보유 === null ? ' — 일반주택 취득일 모름' : ''); }
  }
  reqs.push(jmReq_('양도하는 주택이 1세대1주택으로 비과세되나', 한채, 왜한채, '소득세법 §89①3호·시행령 §155②③'));
  // 4) 세액 — ① 비과세(1세대1주택) ② 과세
  const 양가 = n(p.양도가액);
  const 칸 = function (비과) { if (!양가) return null; const c = { transferPrice: 양가, transferDate: jmYmd_(p.양도일) || undefined, assetType: 'house', acquisitionDate: jmYmd_(p.취득일) || jmYmd_(p.일반주택취득일) || undefined, acquisitionPrice: n(p.취득가액), necessaryExpenses: n(p.필요경비), acquisitionCause: 'purchase' }; if (비과) { c.isOneHouseOneFamily = true; if (p.거주연수 != null && p.거주연수 !== '') c.residenceYears = Number(p.거주연수); } return c; };
  const e1 = 칸(true), e2 = 칸(false);
  if (e1 && e2) {
    if (한채 === false) { 경우.push({ 이름: '① 지금 판정 — 1세대1주택 아님, 과세', 엔진칸: e2 }); 경우.push({ 이름: '② 소수지분자였다면 — 1세대1주택 비과세(협의분할 때 지분을 정해야 함, 신고기한 뒤 바꾸면 증여 — 묶음 「상속재분할」)', 엔진칸: e1 }); }
    else { 경우.push({ 이름: '① 1세대1주택 비과세(12억 넘는 몫만 과세)' + (한채 === null ? ' — 잠정' : ''), 엔진칸: e1 }); 경우.push({ 이름: '② 공동상속주택이 주택 수에 들면 — 과세', 엔진칸: e2 }); }
  }
  // 5) 상속주택 판정 엔진칸(calculateInheritedHouseExclusionJS)
  const 상속엔진칸 = { isCoInheritedHouse: true, isLargestShareHolder: 세대주인, inheritanceDate: 개시 || undefined, generalHouseAcquisitionDate: jmYmd_(p.일반주택취득일) || undefined, isGeneralHouseGiftedWithin2Years: jmYn_(p.일반주택증여2년) === true };
  if (세대주인) notes.push('최대지분자 세대는 공동상속주택이 주택 수에 들어 상속주택 특례(§155②)를 따로 맞춰야 함 — 일반주택은 상속개시 당시 보유분만, 피상속인과 같은 세대였으면 동거봉양 합가 확인(§155② 단서, 판정 묶음 「1세대1주택」)');
  if (!세대주인 && 주인) notes.push('지분을 사고팔아 최대지분자가 바뀌면 판정이 바뀜 — 다른 상속인 지분을 추가로 사면 최대지분자가 될 수 있음 [확인 필요 — 추가 취득 지분의 공동상속주택 여부 예규]');
  notes.push('중과 주택 수도 상속지분이 가장 큰 상속인 소유로 셈(시행령 §167의3②2호) — 소수지분자는 다른 주택을 팔 때 중과 주택 수에서도 빠짐');
  return jmWrap_('공동상속', reqs, { 공동상속주택: 상속주택 || undefined, 소유로보는사람: 주인 ? 주인.이름 : undefined, 납세자최대지분: 납세자주인, 세대주택수에듦: 세대주인, 일세대일주택: 한채, 상속주택엔진칸: 상속엔진칸, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 76 「추씨 빌라 단타」] 부동산을 자주 사고팔면 양도소득인가 사업소득(부동산매매업)인가 — 사업성 정황·업종·비교과세·예정신고
//  부동산매매업 = 한국표준산업분류의 비주거용 건물건설업(자영건설 판매) + 부동산 개발 및 공급업. 다만 주거용 건물 개발 및 공급업(구입한 주거용 건물을 재판매하는 경우는 제외)은 뺌 — 주택 신축판매는 건설업, 산 주택을 되파는 것은 매매업(소득세법 시행령 §122①)
//  매매업자의 종합소득 산출세액 = 큰 것(① 종합소득 산출세액 ② 주택등매매차익 × §104 세율 + (종합과세표준 − 주택등매매차익) × 기본세율) — 주택등매매차익 = 분양권(§104①1호 중 분양권)·비사업용토지(8호)·미등기(10호)·중과 주택(§104⑦)의 매매차익(소득세법 §64①, 차익 = 매매가액 − 시행령 §163 필요경비 − 기본공제 − 장기보유특별공제 시행령 §122②)
//  토지등 매매차익예정신고: 매매일이 속하는 달 말일부터 2개월, 2년 미만 보유도 단기세율 대신 기본세율(소득세법 §69①③ 단서)
//  사업성 판단(계속·반복): 부가가치세법 시행규칙 §2 — 한 과세기간에 1회 이상 취득하고 2회 이상 판매하면 부동산매매업으로 봄 [원문 대조 — 확인 필요], 최종은 거래 규모·횟수·목적 사실판단 [판례 — 확인 필요]
//  과세기간(사업성 판정): 부가가치세 과세기간 — 1기 1.1~6.30, 2기 7.1~12.31(부가가치세법 §5①) [원문 대조 — 확인 필요] · 세액은 과세연도(양도일이 속한 해)별로 따로(소득세법 §5)
//  p: { 과세연도(없으면 판매가 가장 많은 해), 사업자등록(예), 판매목적(예 — 광고·분양·리모델링 등), 다른종합소득금액, 사업경비(이자·인건비·광고 등 양도 필요경비 밖), 이월결손금, 소득공제(없으면 150만 잠정),
//       거래:[{이름, 종류(주택|토지|상가|분양권), 신축(예 — 직접 지어 팖), 취득일, 취득가액, 양도일, 양도가액, 필요경비, 중과(예 — §104⑦ 다주택), 주택수, 비사업용토지(예), 미등기(예)}] }
function judgeRealEstateDealer_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const 기본세 = function (b) { if (!b || b <= 0) return 0; const t = [[14e6, .06, 0], [50e6, .15, 1.26e6], [88e6, .24, 5.76e6], [150e6, .35, 15.44e6], [300e6, .38, 19.94e6], [500e6, .40, 25.94e6], [1e9, .42, 35.94e6], [Infinity, .45, 65.94e6]]; const r = t.find(function (x) { return b <= x[0]; }); return Math.max(0, Math.floor(b * r[1] - r[2] + 1e-6)); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  let 거래 = (Array.isArray(p.거래) ? p.거래 : []).filter(function (t) { return t && (t.양도가액 || t.양도일); }).map(function (t) {
    return { 이름: t.이름 || '', 종류: String(t.종류 || '주택'), 신축: jmYn_(t.신축) === true, 취득일: jmYmd_(t.취득일), 취득가액: n(t.취득가액), 양도일: jmYmd_(t.양도일), 양도가액: n(t.양도가액), 필요경비: n(t.필요경비), 중과: jmYn_(t.중과) === true, 주택수: n(t.주택수), 비사업: jmYn_(t.비사업용토지) === true, 미등기: jmYn_(t.미등기) === true };
  });
  if (!거래.length) return jmWrap_('부동산매매업', [jmReq_('거래', null, '거래 목록이 없음', '소득세법 §64')], { 알림: notes, 할일: [{ 무엇: '해마다 사고판 부동산 목록(취득일·양도일·가액)', 때: '판정 전', 근거: '부가가치세법 시행규칙 §2' }] });
  // 1) 사업성 — 부가가치세 과세기간(반년)마다 취득·판매 횟수
  const 기 = function (d) { return d.slice(0, 4) + '년 ' + (Number(d.slice(5, 7)) <= 6 ? '1기' : '2기'); };
  const 해 = {};
  거래.forEach(function (t) { if (t.취득일) { const y = 기(t.취득일); (해[y] = 해[y] || { 취득: 0, 판매: 0 }).취득++; } if (t.양도일) { const y = 기(t.양도일); (해[y] = 해[y] || { 취득: 0, 판매: 0 }).판매++; } });
  const 걸린해 = Object.keys(해).sort().filter(function (y) { return 해[y].취득 >= 1 && 해[y].판매 >= 2; });
  const 보유월 = 거래.filter(function (t) { return t.취득일 && t.양도일; }).map(function (t) { return (new Date(t.양도일) - new Date(t.취득일)) / (86400000 * 30.44); });
  const 평균보유 = 보유월.length ? Math.round(보유월.reduce(function (a, b) { return a + b; }, 0) / 보유월.length * 10) / 10 : null;
  reqs.push(jmReq_('한 과세기간에 1회 이상 취득하고 2회 이상 판매', 걸린해.length ? true : false, Object.keys(해).sort().map(function (y) { return y + ' 취득 ' + 해[y].취득 + '·판매 ' + 해[y].판매; }).join(' / ') + (걸린해.length ? ' → ' + 걸린해.join('·') + ' 기준에 걸림' : ''), '부가가치세법 시행규칙 §2② · 과세기간 §5① [원문 대조 — 확인 필요]'));
  const 정황 = [];
  if (jmYn_(p.사업자등록) === true) 정황.push('사업자등록');
  if (jmYn_(p.판매목적) === true) 정황.push('판매 목적 광고·리모델링');
  if (평균보유 != null && 평균보유 < 24) 정황.push('평균 보유 ' + 평균보유 + '개월');
  if (거래.length >= 5) 정황.push('거래 ' + 거래.length + '건');
  reqs.push(jmReq_('계속·반복적 사업성(정황)', 정황.length >= 2 || (걸린해.length && 정황.length >= 1) ? true : 정황.length ? null : false, 정황.join(' · ') || '정황 없음', '소득세법 §19①·§64, 사실판단 [판례 — 확인 필요]'));
  const 사업성 = 걸린해.length > 0 || 정황.length >= 2;
  // 2) 업종 — 신축 주택은 건설업(매매업 아님), 산 주택 되팔기·토지·상가는 매매업
  const 신축주택 = 거래.filter(function (t) { return t.신축 && /주택/.test(t.종류); });
  if (신축주택.length) reqs.push(jmReq_('주택 신축판매는 부동산매매업이 아님(건설업)', true, 신축주택.map(function (t) { return t.이름; }).join('·') + ' — 주거용 건물 개발 및 공급업, §64 비교과세·§69 예정신고 없음', '소득세법 시행령 §122① 단서'));
  // 3) 세액은 과세연도 하나씩 — 양도일이 그 해인 거래만
  const 연도들 = {}; 거래.forEach(function (t) { if (t.양도일) { const y = t.양도일.slice(0, 4); 연도들[y] = (연도들[y] || 0) + 1; } });
  const 연도 = String(p.과세연도 || Object.keys(연도들).sort(function (a, b) { return 연도들[b] - 연도들[a] || b.localeCompare(a); })[0] || '');
  const 다른해 = Object.keys(연도들).filter(function (y) { return y !== 연도; });
  if (다른해.length) notes.push(연도 + '년 양도분만 셈 — ' + 다른해.join('·') + '년 양도분은 그 해 따로(과세연도 칸을 바꿔 다시 돌릴 것, 소득세법 §5) · 사업경비·다른 종합소득도 ' + 연도 + '년 것만 넣을 것');
  const 전체거래 = 거래; 거래 = 거래.filter(function (t) { return !t.양도일 || t.양도일.slice(0, 4) === 연도; });
  // 양도소득으로 볼 때(엔진) / 사업소득(매매업)으로 볼 때
  const 엔진거래 = function (t) {
    const at = /분양권/.test(t.종류) ? 'presale_right' : /주택/.test(t.종류) ? 'house' : 'general';
    const c = { transferPrice: t.양도가액, transferDate: t.양도일 || undefined, assetType: at, acquisitionDate: t.취득일 || undefined, acquisitionPrice: t.취득가액, necessaryExpenses: t.필요경비, acquisitionCause: 'purchase' };
    if (t.중과) { c.isMultiHouseSurcharge = true; if (t.주택수) c.multiHouseCount = t.주택수; }
    if (t.비사업) c.isNonBusinessLand = true;
    if (t.미등기) c.isUnregisteredTransfer = true;
    return c;
  };
  const 양도칸 = 거래.map(엔진거래);
  경우.push({ 이름: '① 양도소득으로 봄(단기세율·건별 기본공제)', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: 양도칸 } });
  // 사업소득 — 매매차익 합계 − 사업경비 − 이월결손금 + 다른 종합소득 − 소득공제
  const 매매거래 = 거래.filter(function (t) { return !(t.신축 && /주택/.test(t.종류)); });
  const 차익 = 거래.reduce(function (a, t) { return a + (t.양도가액 - t.취득가액 - t.필요경비); }, 0);
  const 사업소득 = 차익 - n(p.사업경비);
  const 공제 = p.소득공제 != null && p.소득공제 !== '' ? n(p.소득공제) : 1500000;
  if (p.소득공제 == null || p.소득공제 === '') notes.push('종합소득공제를 본인 기본공제 150만으로 잠정(소득세법 §50) — 부양가족·연금보험료 등이 있으면 넣을 것');
  const 종합과표 = Math.max(0, 사업소득 - n(p.이월결손금) + n(p.다른종합소득금액) - 공제);
  const 세1 = 기본세(종합과표);
  const 비교대상 = 매매거래.filter(function (t) { return t.중과 || t.비사업 || t.미등기 || /분양권/.test(t.종류); });
  let 세2 = null, 주택등차익 = 0;
  if (비교대상.length) {
    주택등차익 = Math.max(0, 비교대상.reduce(function (a, t) { return a + (t.양도가액 - t.취득가액 - t.필요경비); }, 0) - 2500000);
    notes.push('주택등매매차익 ' + won(주택등차익) + '원(매매가액 − 필요경비 − 기본공제 250만, 장기보유특별공제는 3년 이상 보유분만 — 이 셈에서 뺐음 [확인 필요]) — 가목 세액은 이 거래들만 양도세 엔진(§104 세율)으로 돌린 산출세액');
    세2 = { 가목엔진칸: { transactions: 비교대상.map(엔진거래) }, 나목: 기본세(Math.max(0, 종합과표 - 주택등차익)) };
    reqs.push(jmReq_('비교과세 대상 자산(분양권·비사업용토지·미등기·중과 주택)', true, 비교대상.map(function (t) { return t.이름; }).join('·') + ' — 종합소득 산출세액과 (가)+(나) 중 큰 것', '소득세법 §64① 2호'));
  } else reqs.push(jmReq_('비교과세 대상 자산(분양권·비사업용토지·미등기·중과 주택)', false, '없음 — 종합소득 기본세율만(단기보유 70%·60% 세율이 적용되지 않음)', '소득세법 §64①'));
  경우.push({ 이름: '② 부동산매매업 사업소득으로 봄(기본세율·사업경비 공제·손익 통산)', 사업소득: 사업소득, 종합과세표준: 종합과표, 종합소득산출세액: 세1, 지방소득세포함: Math.floor(세1 * 1.1), 비교과세: 세2 || undefined });
  // 4) 예정신고 기한(매매업)
  const 예정 = 전체거래.filter(function (t) { return !(t.신축 && /주택/.test(t.종류)); }).filter(function (t) { return t.양도일; }).map(function (t) { const d = new Date(t.양도일.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + 3); d.setDate(0); return { 이름: t.이름, 매매일: t.양도일, 기한: d.toISOString().slice(0, 10), 단기기본세율: t.취득일 ? (new Date(t.양도일) - new Date(t.취득일)) < 2 * 365.25 * 86400000 : undefined }; });
  if (사업성) {
    예정.forEach(function (x) { 할일.push({ 무엇: '토지등 매매차익예정신고·납부 — ' + x.이름 + (x.단기기본세율 ? '(2년 미만 — 기본세율)' : ''), 때: x.기한, 근거: '소득세법 §69①③④' }); });
    할일.push({ 무엇: '종합소득세 확정신고(사업소득, 장부 — 복식부기 의무 여부는 수입금액 기준)', 때: '다음 해 5월 31일', 근거: '소득세법 §70·§160 [확인 필요 — 업종별 기준 금액]' });
    notes.push('매매업이면 국민주택규모 초과 주택·토지 아닌 건물 매매에 부가가치세가 붙을 수 있음(부가가치세법 §26①12호 국민주택 공급만 면세) — 이 도구는 부가세를 셈하지 않음 [확인 필요]');
    notes.push('매매업이면 지역 건강보험료가 사업소득으로 오름 — 세금 비교 밖 비용');
  } else notes.push('사업성 정황이 약함 — 양도소득(①)이 원칙. 같은 과세기간(반년)에 1회 취득·2회 판매가 되면 매매업으로 볼 수 있으니 거래 시기를 나눌 때 주의 [확인 필요]');
  return jmWrap_('부동산매매업', reqs, { 사업성: 사업성, 과세연도: 연도, 걸린해: 걸린해, 평균보유개월: 평균보유, 예정신고: 사업성 ? 예정 : undefined, 경우: 경우, 엔진칸: { transactions: 양도칸 }, 엔진칸늘: true, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 77 「봉씨 대토보상」] 수용 보상을 땅(대토)으로 받을 때 — 40% 감면이냐 과세이연이냐, 뒤에 추징되는 사유·세액·기한
//  대토보상(조특법 §77의2①): 사업인정고시일(고시 전 양도면 양도일)부터 소급 2년 이전 취득 토지등을 2026.12.31까지 사업시행자에게 양도하고 양도대금을 공익사업으로 조성한 토지로 받은 부분 — 양도소득세 40% 감면 또는 과세이연
//  감면·이연 대상 금액 = (양도차익 − 장기보유특별공제) × 대토보상 상당액 ÷ 총보상액(시행령 §73①1호·2호) · 과세이연이면 대토 양도 때 취득가액 = 대토 취득가액 − 과세이연금액, 장기보유특별공제 보유기간은 대토 취득 때부터(§73①2호 후단)
//  현금 몫은 §77① 감면(현금 15%·채권 20%·3년 만기 35%·5년 만기 45%) · §77·§77의2·§77의3 감면 합계 한도 과세기간 2억·5개 과세기간 3억(§133②, 2025.3.14 신설)
//  추징: ④ 전매금지 위반으로 현금 전환·대토 등기 뒤 3년 안 양도(수용 제외) → 감면세액 전액(과세이연은 과세이연금액 상당 세액) + 이자상당액, 사유월 말일부터 2개월
//        ⑤ 등기원인이 대토보상 아님·그 밖의 현금 전환·3년 안 증여(3개월)·상속(6개월, 상속인)·리츠 현물출자 주식 5년 안 처분 → 대토 감면과 현금 감면의 차액(과세이연은 과세이연금액 상당 세액), 이자 없음
//        과세이연금액 상당 세액 = 총보상액에 대한 세액(양도소득금액에 §77 감면율 적용) − 현금·채권 보상으로 이미 낸 세액(§73④ 괄호)
//  신청: 양도한 과세연도 과세표준신고 때 세액감면신청서 또는 과세이연신청서 + 대토보상 신청서·계약서 사본(§73⑥)
//  p: { 사업인정고시일, 취득일, 양도일, 취득가액, 필요경비, 총보상액, 대토보상액, 채권보상액, 채권종류(bond|bond_3y|bond_5y), 비사업용토지(예), 직전감면77(직전 4개 과세기간 §77류 감면세액),
//       대토등기일, 사유(전매위반전환|현금전환|3년내양도|수용|3년내증여|3년내상속|등기원인|리츠처분), 사유일, 납부일, 선택(감면|과세이연),
//       대토양도가액·대토양도일·대토필요경비(나중에 대토를 팔 때) }
function judgeLandReplacement_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 고시 = jmYmd_(p.사업인정고시일), 취득 = jmYmd_(p.취득일), 양도 = jmYmd_(p.양도일);
  const 총 = n(p.총보상액), 대토 = Math.min(n(p.대토보상액), 총), 채권 = Math.min(n(p.채권보상액), 총 - 대토), 현금 = Math.max(0, 총 - 대토 - 채권);
  const 취가 = n(p.취득가액), 경비 = n(p.필요경비);
  if (!총 || !대토) return jmWrap_('대토보상', [jmReq_('대토보상액', null, '총보상액·대토보상액이 없음', '조특법 §77의2①')], { 알림: notes, 할일: [{ 무엇: '보상계약서(대토·현금·채권 나눔)', 때: '판정 전', 근거: '시행령 §73⑥' }] });
  // 1) 요건
  const 기준일 = 고시 && 양도 && 고시 <= 양도 ? 고시 : 양도;
  let 이년 = null;
  if (취득 && 기준일) { const d = new Date(기준일); d.setFullYear(d.getFullYear() - 2); 이년 = 취득 <= d.toISOString().slice(0, 10); }
  reqs.push(jmReq_('사업인정고시일(고시 전 양도면 양도일)부터 소급 2년 이전 취득', 이년, 취득 ? '취득 ' + 취득 + ' · 기준일 ' + (기준일 || '?') + (고시 && 양도 && 고시 > 양도 ? '(고시 전 양도 — 양도일 기준)' : '') : '취득일 모름', '조특법 §77의2① (상속·이월과세 증여는 피상속인·증여자 취득일, §77⑨ 준용 [확인 필요])'));
  const 기한 = 양도 ? 양도 <= '2026-12-31' : null;
  reqs.push(jmReq_('2026.12.31까지 사업시행자에게 양도', 기한, 양도 || '양도일 모름', '조특법 §77의2①'));
  reqs.push(jmReq_('양도대금을 공익사업으로 조성한 토지로 보상(대토)', true, '총보상 ' + won(총) + ' 중 대토 ' + won(대토) + '(' + Math.round(대토 / 총 * 1000) / 10 + '%) · 채권 ' + won(채권) + ' · 현금 ' + won(현금), '토지보상법 §63① 단서 · 조특법 §77의2①'));
  const 요건 = 이년 !== false && 기한 !== false;
  // 2) 세액 — 거래를 보상 종류별로 나눠 엔진에 넘김(한 번의 양도라 기본공제·누진은 엔진이 합쳐 셈)
  const 몫 = function (금액, 종류) {
    if (!금액) return null;
    const r = 금액 / 총;
    const c = { transferPrice: 금액, transferDate: 양도 || undefined, assetType: 'general', acquisitionDate: 취득 || undefined, acquisitionPrice: Math.round(취가 * r), necessaryExpenses: Math.round(경비 * r), acquisitionCause: 'purchase', isExpropriated: true };
    if (종류) { c.compensationType = 종류; if (고시) c.publicNoticeDate = 고시; }
    if (jmYn_(p.비사업용토지) === true) c.isNonBusinessLand = true;
    if (n(p.직전감면77)) c.sect133PriorComp = n(p.직전감면77);
    return c;
  };
  const 채권종류 = /bond_3y|bond_5y|bond/.test(String(p.채권종류 || '')) ? String(p.채권종류) : 'bond';
  const 현금칸 = 몫(현금, 요건 ? 'cash' : null), 채권칸 = 몫(채권, 요건 ? 채권종류 : null);
  const 감면칸 = [현금칸, 채권칸, 몫(대토, 요건 ? 'land_replacement' : null)].filter(Boolean);
  const 이연칸 = [현금칸, 채권칸].filter(Boolean);
  const 전부현금칸 = [몫(총, 요건 ? 'cash' : null)];
  // 과세이연금액 = (양도차익 − 장기보유특별공제) × 대토/총 — 장특 공제율은 엔진이 셈(토지 보유연수), 여기선 양도차익 × 대토 몫만 내고 나머지는 엔진 결과로 바로잡도록 알림
  const 차익 = Math.max(0, 총 - 취가 - 경비);
  const 보유 = 취득 && 양도 ? Math.floor((new Date(양도) - new Date(취득)) / (365.25 * 86400000)) : 0;
  const 장특율 = 보유 >= 3 ? Math.min(0.30, 0.02 * 보유) : 0;
  const 이연금액 = Math.round((차익 - Math.floor(차익 * 장특율)) * 대토 / 총);
  if (요건) {
    경우.push({ 이름: '① 대토 몫 40% 감면 신청(현금·채권 몫은 §77 감면)', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: 감면칸 } });
    if (이연칸.length) 경우.push({ 이름: '② 대토 몫 과세이연 신청 — 지금은 현금·채권 몫만 과세', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: 이연칸 }, 과세이연금액: 이연금액 });
    else 경우.push({ 이름: '② 전부 대토 — 과세이연이면 지금 낼 양도소득세 0', 과세이연금액: 이연금액, 지금납부: 0 });
    경우.push({ 이름: '③ 비교 — 전부 현금으로 받았다면(§77 현금 감면)', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: 전부현금칸 } });
    notes.push('과세이연금액 ' + won(이연금액) + '원 = (양도차익 ' + won(차익) + ' − 장기보유특별공제 ' + Math.round(장특율 * 100) + '% [보유 ' + 보유 + '년, 엔진 셈과 같은지 확인]) × 대토 ' + won(대토) + ' ÷ 총보상 ' + won(총) + ' (시행령 §73①2호)');
    notes.push('감면과 과세이연 고르기: 감면은 지금 40%를 확정해 끝내고(한도 §133② 과세기간 2억·5년 3억 안), 과세이연은 지금 0이지만 대토를 팔 때 취득가액이 과세이연금액만큼 낮아지고 장기보유특별공제가 대토 취득 때부터 다시 셈 — 대토를 오래 갖거나 상속할 계획이면 이연, 곧 팔 계획이면 감면이 유리한 경우가 많음 [사안별 — 아래 대토 양도 경우로 견줄 것]');
  } else notes.push('대토보상 요건 밖(' + (이년 === false ? '고시일부터 2년 안 취득' : '') + (기한 === false ? ' 2026.12.31 뒤 양도' : '') + ') — 감면·과세이연 없이 수용 양도로 과세(① 칸)');
  if (!요건) 경우.push({ 이름: '① 감면 없이 과세', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: 전부현금칸 } });
  // 3) 나중에 대토를 팔 때(과세이연이면 취득가액에서 이연금액을 뺌)
  const 대양가 = n(p.대토양도가액), 대양일 = jmYmd_(p.대토양도일), 등기 = jmYmd_(p.대토등기일);
  if (요건 && 대양가) {
    const base = { transferPrice: 대양가, transferDate: 대양일 || undefined, assetType: 'general', acquisitionDate: 등기 || undefined, necessaryExpenses: n(p.대토필요경비), acquisitionCause: 'purchase' };
    경우.push({ 이름: '④ 대토 양도 — 감면을 받았던 경우(취득가액 = 대토보상액)', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: [Object.assign({}, base, { acquisitionPrice: 대토 })] } });
    경우.push({ 이름: '⑤ 대토 양도 — 과세이연을 받았던 경우(취득가액 = 대토보상액 − 과세이연금액)', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: [Object.assign({}, base, { acquisitionPrice: Math.max(0, 대토 - 이연금액) })] } });
    notes.push('대토 취득일을 등기일(' + (등기 || '?') + ')로 넣음 — 대토 취득시기(잔금·등기 중 빠른 날, 소득세법 시행령 §162) 확인 [확인 필요]');
  }
  // 4) 추징 사유
  const 사유 = String(p.사유 || ''), 사유일 = jmYmd_(p.사유일);
  if (사유) {
    const 삼년 = 등기 && 사유일 ? (new Date(사유일) - new Date(등기)) < 3 * 365.25 * 86400000 : null;
    let 조 = null, 이자 = false, 달 = 2, 대상 = '';
    if (/전매/.test(사유)) { 조 = '§73④1호'; 이자 = true; 대상 = '전매금지 위반으로 현금 전환'; }
    else if (/수용/.test(사유)) { 조 = null; 대상 = '대토 취득 뒤 3년 안 협의매수·수용 — 추징 안 함(§73④2호 단서)'; }
    else if (/양도/.test(사유)) { if (삼년 !== false) { 조 = '§73④2호'; 이자 = true; } 대상 = '등기 뒤 3년 안 대토 양도'; }
    else if (/증여/.test(사유)) { if (삼년 !== false) { 조 = '§73⑤3호'; 달 = 3; } 대상 = '등기 뒤 3년 안 증여'; }
    else if (/상속/.test(사유)) { if (삼년 !== false) { 조 = '§73⑤3호'; 달 = 6; } 대상 = '등기 뒤 3년 안 상속(상속인이 냄)'; }
    else if (/현금/.test(사유)) { 조 = '§73⑤2호'; 대상 = '전매 위반 밖의 사유로 현금 전환'; }
    else if (/등기원인/.test(사유)) { 조 = '§73⑤1호'; 대상 = '대토 소유권 이전등기 원인이 대토보상 아님'; }
    else if (/리츠/.test(사유)) { 조 = '§73⑤4호'; 대상 = '대토 권리를 리츠에 현물출자하고 받은 주식을 5년 안 처분(3년 만기 채권 감면과의 차액)'; }
    reqs.push(jmReq_('사후관리 — 추징 사유', 조 ? false : true, 대상 + (삼년 === false ? ' · 등기 ' + 등기 + '부터 3년 지남 — 추징 아님' : '') + (조 ? ' → ' + (이자 ? '감면세액 전액(과세이연은 과세이연금액 상당 세액) + 이자상당액' : '대토 감면 − 현금 감면 차액(과세이연은 과세이연금액 상당 세액), 이자 없음') : ''), '조특법 §77의2③ · 시행령 ' + (조 || '§73④·⑤')));
    if (조 && 사유일) {
      const d = new Date(사유일.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + 1 + 달); d.setDate(0);
      const 납기 = d.toISOString().slice(0, 10);
      할일.push({ 무엇: '추징세액 신고·납부(양도소득세) — ' + 대상, 때: 납기, 근거: '시행령 ' + 조 });
      const 추징 = { 사유: 대상, 근거: 조, 신고납부기한: 납기, 이자: 이자, 감면계산: '① 경우의 대토 몫 감면세액' + (이자 ? ' 전액' : ' − 같은 몫을 현금으로 받았을 때 감면(15%)'), 과세이연계산: '③ 경우 결정세액(총보상 전부 §77 감면율) − ② 경우에 이미 낸 세액' };
      if (이자 && 양도) {
        const pd = new Date(양도.slice(0, 7) + '-01'); pd.setMonth(pd.getMonth() + 3); pd.setDate(0); pd.setDate(pd.getDate() + 1);
        const 끝 = jmYmd_(p.납부일) || 납기;
        추징.이자기간 = { 시작: pd.toISOString().slice(0, 10), 끝: 끝, 날수: Math.max(0, Math.round((new Date(끝) - pd) / 86400000) + 1), 율: '1일 0.022%(시행령 §11의2⑩2호) [확인 필요]' };
        notes.push('이자상당액 = 추징세액 × 날수 ' + 추징.이자기간.날수 + '일(당초 예정신고 납부기한 다음 날 ' + 추징.이자기간.시작 + ' ~ 납부일 ' + 끝 + ') × 1일 0.022% — 시행령 §63⑨ 준용 [율 원문 대조 — 확인 필요]');
      }
      경우.push({ 이름: '⑥ 추징 — ' + 대상, 추징: 추징 });
    }
  } else if (요건) {
    할일.push({ 무엇: '대토 등기 뒤 3년 안에 팔거나 증여하지 말 것 · 대토 권리를 전매하지 말 것(현금 전환 + 이자 추징)', 때: 등기 ? (function () { const d = new Date(등기); d.setFullYear(d.getFullYear() + 3); return d.toISOString().slice(0, 10) + '까지'; })() : '대토 등기 뒤 3년', 근거: '시행령 §73④⑤' });
  }
  if (요건) 할일.push({ 무엇: '세액감면신청서 또는 과세이연신청서 + 대토보상 신청서·계약서 사본 제출', 때: '양도한 해 과세표준신고 때(예정·확정)', 근거: '조특법 §77의2④ · 시행령 §73⑥' });
  notes.push('§77·§77의2·§77의3 감면 합계 한도: 과세기간 2억, 직전 4개 과세기간 포함 3억(§133②, 2025년 이후 양도) — 직전 감면액(직전감면77)을 넣으면 엔진이 셈. 과세이연은 감면이 아니라 한도에 들지 않음 [확인 필요]');
  notes.push('농어촌특별세: 감면세액의 20%(농어촌특별세법 §5①1호) — 엔진 결과의 농특세를 함께 볼 것. 과세이연에는 농특세 없음 [확인 필요]');
  return jmWrap_('대토보상', reqs, { 요건충족: 요건, 대토비율: Math.round(대토 / 총 * 10000) / 10000, 과세이연금액: 요건 ? 이연금액 : undefined, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: true, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 78 「봉씨 수용 보상금」] 수용 보상금을 종류마다 가르기 — 양도소득·사업소득·기타소득·과세 안 함
//  양도소득은 토지·건물(건물에 부속된 시설물과 구축물 포함)의 양도로 생긴 소득만(소득세법 §94①1호) — 보상금 전부를 양도가액으로 넣으면 세액이 부풀고 §77 감면 한도도 엉뚱하게 씀
//  영업손실(휴업·폐업)보상금 = 사업과 관련된 수입금액(시행령 §51③5호) [예규 원문 미확인 — 확인 필요] · 공익사업 지역권·지상권 설정 대가 = 기타소득(§21①9호, 필요경비 60% 시행령 §87 1호의2, 원천 20% §129①6호 라목, 기타소득금액 300만원 이하 분리과세 선택 §14③8호 가목)
//  주거이전비·이사비·이주정착금은 소득세법이 열거한 소득이 아님 — 과세 안 함 [예규 원문 미확인 — 확인 필요] · 영농손실보상금은 작물재배업 관련(§19①1호 괄호·§12 2호 바목) — 과세 안 됨이 일반 [확인 필요]
//  이의재결·행정소송 증액은 양도가액에 더함 — 소송 증액은 판결 확정일이 속하는 달의 다음 다음 달 말일까지 추가신고·납부하면 가산세 없음(시행령 §173④)
//  p: { 항목: [{ 종류, 금액, 설명 }], 양도일, 취득일, 취득가액, 필요경비, 사업인정고시일, 보상방식(현금|채권), 비사업용토지(예), 직전감면77, 판결확정일, 사업자(예), 복식부기(예) }
//  종류 예: 토지·건물·구축물(건물 부속)·수목·영업손실·영농손실·축산휴업·주거이전비·이사비·이주정착금·지역권설정·잔여지매수·잔여지가치하락·이의재결증액·소송증액·지연가산금·기계이전비
function judgeCompensationSplit_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 항목 = Array.isArray(p.항목) ? p.항목 : [];
  if (!항목.length) return jmWrap_('보상금구분', [jmReq_('보상금 항목', null, '보상금 항목(종류·금액)이 없음', '소득세법 §94①1호')], { 할일: [{ 무엇: '보상금 내역서·재결서·지장물 명세(항목별 금액)', 때: '판정 전', 근거: '토지보상법 §61~§78' }] });
  // 1) 가르기 표 — 갈래: 양도 | 사업 | 기타 | 과세안함 | 확인
  const 표 = [
    [/지연|가산금|법정이자/, '확인', '보상금 지급 지연 가산금·지연손해금 — 양도가액 아님, 기타소득(§21①10호)인지 다툼', '소득세법 §21①10호 · 시행령 §41⑧ [판례 원문 미확인 — 확인 필요]'],
    [/잔여지.*매수|매수.*잔여지/, '양도', '잔여지 매수청구로 넘긴 땅 — 수용과 같음', '토지보상법 §74 · 소득세법 §88 1호 · 조특법 §77①3호'],
    [/잔여지.*(가치|하락|손실)|가치하락/, '확인', '잔여지 가치하락 손실보상 — 땅을 넘긴 대가가 아님', '토지보상법 §73 · 소득세법 §94 [판례 원문 미확인 — 확인 필요]'],
    [/지역권|지상권|구분지상권|송전|선하지/, '기타', '공익사업 지역권·지상권 설정 대가 — 기타소득(땅을 넘긴 것이 아님)', '소득세법 §21①9호 · 시행령 §87 1호의2'],
    [/이의재결|증액.*재결|재결.*증액/, '양도', '이의재결 증액 — 당초 양도가액에 더함', '소득세법 §96① · 시행령 §173④(소송이면)'],
    [/소송|판결/, '양도', '행정소송 증액 — 당초 양도가액에 더함', '소득세법 §96① · 시행령 §173④'],
    [/^토지|토지보상/, '양도', '토지 양도 대가', '소득세법 §94①1호 · 조특법 §77'],
    [/건물/, '양도', '건물 양도 대가', '소득세법 §94①1호'],
    [/구축물|부속|담장|옹벽|정화조/, '양도', '건물에 부속된 시설물·구축물 — 건물과 함께 양도', '소득세법 §94①1호 괄호 — 건물에 딸리지 않은 독립 구축물이면 [확인 필요]'],
    [/수목|입목|과수/, '확인', '수목 — 토지와 함께 넘기는 정착물이면 토지 양도가액에 포함, 따로 이전·벌채하는 보상이면 양도 아님', '소득세법 §94①1호 [예규 원문 미확인 — 확인 필요]'],
    [/영업손실|휴업|폐업|영업보상/, '사업', '영업손실(휴업·폐업)보상 — 사업과 관련된 수입금액', '소득세법 시행령 §51③5호 [예규 원문 미확인 — 확인 필요]'],
    [/축산/, '사업', '축산 휴업보상 — 축산업 사업소득 총수입금액', '소득세법 §19①1호 · 시행령 §51③5호 [확인 필요]'],
    [/영농손실|영농보상|농업손실/, '과세안함', '영농손실보상 — 작물재배업 관련(곡물·식량작물은 사업소득 아님, 그 밖 작물재배업 수입 10억원 이하 비과세)', '소득세법 §19①1호 괄호 · §12 2호 바목 · 시행령 §9의4 [예규 원문 미확인 — 확인 필요]'],
    [/주거이전|이사비|이주정착|이주대책|이주비/, '과세안함', '주거이전비·이사비·이주정착금 — 소득세법이 열거한 소득이 아님', '소득세법 §4①·§16~§21·§94 열거 밖 [예규 원문 미확인 — 확인 필요]'],
    [/기계|시설.*이전|이전비|동산/, '사업', '기계·시설 이전비·동산 이전 보상 — 사업용이면 사업소득 총수입금액, 아니면 과세 안 함', '소득세법 시행령 §51③5호 [확인 필요]']
  ];
  const 갈 = { 양도: [], 사업: [], 기타: [], 과세안함: [], 확인: [] };
  항목.forEach(function (h) {
    const k = String(h.종류 || '') + ' ' + String(h.설명 || '');
    let hit = null;
    for (let i = 0; i < 표.length; i++) if (표[i][0].test(k)) { hit = 표[i]; break; }
    const row = { 종류: h.종류, 금액: n(h.금액), 갈래: hit ? hit[1] : '확인', 왜: hit ? hit[2] : '어느 보상인지 알 수 없음', 근거: hit ? hit[3] : '토지보상법 §61~§78' };
    if (hit && hit[1] === '사업' && /기계|시설|이전비|동산/.test(k) && jmYn_(p.사업자) === false) { row.갈래 = '과세안함'; row.왜 = '사업자가 아님 — 생활용 동산 이전 보상'; }
    갈[row.갈래].push(row);
  });
  const 합 = function (a) { return a.reduce(function (s, x) { return s + x.금액; }, 0); };
  const 양합 = 합(갈.양도), 사합 = 합(갈.사업), 기합 = 합(갈.기타), 무합 = 합(갈.과세안함), 확합 = 합(갈.확인), 총합 = 양합 + 사합 + 기합 + 무합 + 확합;
  ['양도', '사업', '기타', '과세안함', '확인'].forEach(function (g) {
    갈[g].forEach(function (r) { reqs.push(jmReq_(r.종류 + ' ' + won(r.금액) + ' → ' + ({ 양도: '양도소득', 사업: '사업소득', 기타: '기타소득', 과세안함: '과세 안 함', 확인: '갈래 확인 필요' })[g], g === '확인' ? null : true, r.왜, r.근거)); });
  });
  // 2) 양도소득 — 엔진 칸(양도 갈래만, 증액분 포함)
  const 고시 = jmYmd_(p.사업인정고시일), 양도 = jmYmd_(p.양도일), 취득 = jmYmd_(p.취득일);
  const 기준일 = 고시 && 양도 && 고시 <= 양도 ? 고시 : 양도;
  let 이년 = null;
  if (취득 && 기준일) { const d = new Date(기준일); d.setFullYear(d.getFullYear() - 2); 이년 = 취득 <= d.toISOString().slice(0, 10); }
  const 감면 = 이년 === true && (!양도 || 양도 <= '2026-12-31');
  reqs.push(jmReq_('§77 수용 감면 — 사업인정고시일(고시 전 양도면 양도일)부터 2년 이전 취득·2026.12.31까지 양도', 이년 === null ? null : 감면, 취득 ? '취득 ' + 취득 + ' · 기준일 ' + (기준일 || '?') : '취득일 모름', '조특법 §77① — 감면은 양도 갈래(토지·건물)에만'));
  const 칸 = function (가액, 수용) {
    if (!가액) return null;
    const c = { transferPrice: 가액, transferDate: 양도 || undefined, assetType: 'general', acquisitionDate: 취득 || undefined, acquisitionPrice: n(p.취득가액), necessaryExpenses: n(p.필요경비), acquisitionCause: 'purchase', isExpropriated: true };
    if (수용) { c.compensationType = /채권/.test(String(p.보상방식 || '')) ? 'bond' : 'cash'; if (고시) c.publicNoticeDate = 고시; }
    if (jmYn_(p.비사업용토지) === true) c.isNonBusinessLand = true;
    if (n(p.직전감면77)) c.sect133PriorComp = n(p.직전감면77);
    return c;
  };
  const e양 = 칸(양합, 감면);
  if (e양) 경우.push({ 이름: '① 바르게 — 양도 갈래(' + 갈.양도.map(function (r) { return r.종류; }).join('·') + ') ' + won(양합) + '만 양도가액', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: [e양] } });
  const 수목 = 갈.확인.filter(function (r) { return /수목|입목|과수/.test(r.종류); });
  if (수목.length && e양) 경우.push({ 이름: '② 수목을 토지와 함께 넘긴 정착물로 보면 — 양도가액 ' + won(양합 + 합(수목)), 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: [칸(양합 + 합(수목), 감면)] } });
  if (총합 > 양합 && e양) 경우.push({ 이름: '③ 잘못 — 보상금 전부 ' + won(총합) + '을 양도가액으로 넣으면(견주기용)', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: [칸(총합, 감면)] }, 잘못: true });
  // 3) 기타소득 — 지역권·지상권 설정 대가
  let 기타 = undefined;
  if (기합) {
    const 경비 = Math.round(기합 * 0.6), 소득 = 기합 - 경비, 원천 = Math.floor(소득 * 0.2 / 10) * 10;
    기타 = { 받은금액: 기합, 필요경비60: 경비, 기타소득금액: 소득, 원천징수20: 원천, 지방소득세: Math.floor(원천 * 0.1 / 10) * 10, 분리과세선택: 소득 <= 3000000 };
    notes.push('지역권·지상권 설정 대가 ' + won(기합) + ' — 기타소득금액 ' + won(소득) + '(필요경비 60%) · 원천징수 ' + won(원천) + '(20%, 지방소득세 별도) · ' + (소득 <= 3000000 ? '300만원 이하 — 분리과세(원천징수로 끝)와 종합과세 중 고를 수 있음(§14③8호 가목)' : '300만원 넘음 — 다른 종합소득과 합산 신고(§14②·§70)'));
  }
  // 4) 사업소득
  if (사합) notes.push('사업 갈래 ' + won(사합) + ' — 받은 해 사업소득 총수입금액(시행령 §51③5호 [확인 필요]). 폐업보상이면 폐업 연도 종합소득세 신고에 넣고, 사업소득 세액은 이 판정에서 셈하지 않음(종합소득세 도구 없음) — 다른 사업소득·경비와 합쳐 따로 셈' + (jmYn_(p.복식부기) === true ? ' · 복식부기의무자는 사업용 유형자산(토지·건물 제외) 처분 이익도 사업소득(§19①20호)' : ''));
  if (무합) notes.push('과세 안 함 갈래 ' + won(무합) + ' — 양도가액·종합소득에 넣지 않음. 다만 근거가 예규·판례라 원문 확인 필요 [확인 필요]');
  if (확합) 할일.push({ 무엇: '갈래 확인 — ' + 갈.확인.map(function (r) { return r.종류 + ' ' + won(r.금액); }).join(' · '), 때: '신고 전', 근거: '보상 근거 조문(토지보상법 §73·§75 등)과 보상 명세의 보상 대상 확인' });
  // 5) 증액·기한
  const 소송 = 갈.양도.filter(function (r) { return /소송|판결/.test(r.종류); });
  const 확정 = jmYmd_(p.판결확정일);
  let 추가신고기한 = undefined;
  if (소송.length && 확정) {
    const d = new Date(확정.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + 3); d.setDate(0);
    추가신고기한 = d.toISOString().slice(0, 10);
    할일.push({ 무엇: '소송 증액 ' + won(합(소송)) + ' 추가신고·납부(이 기한까지면 가산세 없음)', 때: 추가신고기한, 근거: '소득세법 시행령 §173④' });
  } else if (소송.length) 할일.push({ 무엇: '판결 확정일 확인 — 추가신고 기한(확정일이 속하는 달의 다음 다음 달 말일) 셈', 때: '판결 확정 뒤', 근거: '시행령 §173④' });
  const 이의 = 갈.양도.filter(function (r) { return /이의재결/.test(r.종류); });
  if (이의.length) notes.push('이의재결 증액 ' + won(합(이의)) + ' — 당초 양도가액에 더해 수정신고(국세기본법 §45) 또는 처음부터 합쳐 확정신고. 소송 증액과 달리 시행령 §173④ 가산세 면제 길이 없음 [확인 필요 — 이의재결 증액분 가산세]');
  notes.push('§77 감면은 양도 갈래에만 · 한 해 감면 한도(조특법 §133)는 엔진이 셈 — 보상금 전부를 양도로 넣으면 한도를 엉뚱한 몫에 씀');
  return jmWrap_('보상금구분', reqs, { 가르기: 갈, 합계: { 양도소득: 양합, 사업소득: 사합, 기타소득: 기합, 과세안함: 무합, 확인필요: 확합, 전체: 총합 }, 감면대상: 감면, 기타소득: 기타, 추가신고기한: 추가신고기한, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 79 「하씨 시기 얽힘」] 양도·취득 시기를 원인마다 가르기 — 보유기간·세율·귀속연도·신고기한이 모두 이 날짜에 매달림
//  원칙은 대금을 청산한 날(소득세법 §98, 매수자가 부담하기로 한 양도소득세 등은 대금에서 뺌) · 예외는 시행령 §162① 각 호
//   1호 청산일 불분명 → 등기·등록접수일·명의개서일 / 2호 청산 전 등기 → 등기접수일(그래서 매매는 "잔금일·등기접수일 중 빠른 날") / 3호 장기할부 → 등기접수일·인도일·사용수익일 중 빠른 날
//   4호 자가건설 → 사용승인서 교부일(그 전 사실상 사용·임시사용승인이면 빠른 날, 무허가는 사실상 사용일) / 5호 상속·증여 → 상속개시일·증여받은 날 / 6호 점유취득시효 → 점유 개시일
//   7호 수용 → 청산일·수용개시일·등기접수일 중 빠른 날(소유권 소송으로 공탁이면 판결 확정일) / 8호 미완성 자산 → 완성·확정된 날 / 9호 환지 → 종전 토지 취득일(증감 면적은 환지처분 공고 다음 날)
//  ⑤ 취득시기가 불분명하면 먼저 취득한 것을 먼저 양도 · 1984.12.31 이전 취득 토지·건물은 1985.1.1 취득으로 봄(법률 제4803호 부칙 제8조 [원문 미확인 — 확인 필요])
//  p: { 양도: {원인, 계약일, 잔금일, 잔금분명(예), 등기접수일, 인도일, 사용수익일, 할부횟수, 최종할부일, 수용개시일, 공탁소송(예), 판결확정일, 완성일, 허가일(토지거래허가)},
//       취득: {원인(매매|장기할부|자가건설|상속|증여|시효취득|수용|미완성|환지|지적재조사), 잔금일, 잔금분명, 등기접수일, 인도일, 사용수익일, 할부횟수, 최종할부일, 사용승인일, 임시사용승인일, 사실상사용일, 무허가(예), 상속개시일, 증여일, 점유개시일, 완성일, 환지전취득일, 환지공고일, 증감면적},
//       자산종류(house|general|land), 양도가액, 취득가액, 필요경비, 1세대1주택(예), 거주연수 }
function judgeTransferTiming_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 빠른 = function (arr) { const a = arr.filter(Boolean).sort(); return a[0] || null; };
  const 다음날 = function (d) { const x = new Date(d); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
  // 한 쪽(양도 또는 취득) 시기
  const 시기 = function (q, 쪽) {
    q = q || {};
    const 원인 = String(q.원인 || '매매');
    const 잔 = jmYmd_(q.잔금일), 등 = jmYmd_(q.등기접수일), 인 = jmYmd_(q.인도일), 사 = jmYmd_(q.사용수익일);
    const 분명 = jmYn_(q.잔금분명) !== false && !!잔;
    if (/상속/.test(원인)) return { 날짜: jmYmd_(q.상속개시일), 호: '5호', 왜: '상속이 개시된 날(사망일)' };
    if (/증여/.test(원인)) return { 날짜: jmYmd_(q.증여일) || 등, 호: '5호', 왜: '증여받은 날' + (jmYmd_(q.증여일) ? '' : ' — 증여일을 몰라 등기접수일로(상증법 시행령 §24①1호: 부동산은 등기접수일)') };
    if (/시효|점유/.test(원인)) return { 날짜: jmYmd_(q.점유개시일), 호: '6호', 왜: '점유를 시작한 날(민법 §245① 20년 점유취득시효)' };
    if (/자가건설|신축|건설/.test(원인)) {
      const 승 = jmYmd_(q.사용승인일), 임 = jmYmd_(q.임시사용승인일), 실 = jmYmd_(q.사실상사용일);
      if (jmYn_(q.무허가) === true) return { 날짜: 실, 호: '4호 단서', 왜: '건축허가 없이 지은 건물 — 사실상 사용일' };
      const d = 빠른([승, 임, 실]);
      return { 날짜: d, 호: '4호', 왜: '사용승인서 교부일' + (d && d !== 승 ? '보다 ' + (d === 임 ? '임시사용승인일' : '사실상 사용일') + '이 빨라 그날' : '') };
    }
    if (/환지/.test(원인)) {
      const 공고 = jmYmd_(q.환지공고일);
      return { 날짜: jmYmd_(q.환지전취득일), 호: '9호', 왜: '환지 전 토지 취득일' + (n(q.증감면적) ? ' · 늘어난 ' + n(q.증감면적) + '㎡는 환지처분 공고 다음 날 ' + (공고 ? 다음날(공고) : '?') + ' 취득' : ''), 증감분: n(q.증감면적) && 공고 ? 다음날(공고) : undefined };
    }
    if (/지적재조사/.test(원인)) return { 날짜: jmYmd_(q.환지전취득일) || 잔, 호: '9호의2', 왜: '경계 확정으로 늘어난 면적은 종전 토지 취득일' };
    if (/수용/.test(원인)) {
      if (jmYn_(q.공탁소송) === true) return { 날짜: jmYmd_(q.판결확정일), 호: '7호 단서', 왜: '소유권 소송으로 보상금 공탁 — 판결 확정일' };
      const d = 빠른([잔, jmYmd_(q.수용개시일), 등]);
      return { 날짜: d, 호: '7호', 왜: '청산일·수용개시일·등기접수일 중 빠른 날' };
    }
    if (/할부/.test(원인)) {
      const 회 = n(q.할부횟수), 끝 = jmYmd_(q.최종할부일), 처음 = 빠른([등, 인, 사]);
      let 장기 = null;
      if (회 && 끝 && 처음) { const y = new Date(다음날(처음)); y.setFullYear(y.getFullYear() + 1); 장기 = 회 >= 2 && 끝 >= y.toISOString().slice(0, 10); }
      reqs.push(jmReq_(쪽 + ' — 장기할부(2회 이상 나눠 받고, 등기·인도·사용수익 중 빠른 날 다음 날부터 마지막 할부일까지 1년 이상)', 장기, (회 || '?') + '회 · 마지막 ' + (끝 || '?') + ' · 빠른 날 ' + (처음 || '?'), '소득세법 시행규칙 §78③ [원문 미확인 — 확인 필요]'));
      if (장기 !== false) return { 날짜: 처음, 호: '3호', 왜: '장기할부 — 등기접수일·인도일·사용수익일 중 빠른 날' };
    }
    if (/미완성|분양|건설중|미확정/.test(원인) && jmYmd_(q.완성일) && (!잔 || jmYmd_(q.완성일) > 잔)) return { 날짜: jmYmd_(q.완성일), 호: '8호', 왜: '대금을 다 낼 때까지 목적물이 완성되지 않음 — 완성(사용승인 등)된 날' };
    if (!분명) return { 날짜: 등, 호: '1호', 왜: '대금 청산일이 분명하지 않음 — 등기·등록접수일' };
    if (등 && 등 < 잔) return { 날짜: 등, 호: '2호', 왜: '대금을 다 내기 전에 등기 — 등기접수일(잔금일 ' + 잔 + '보다 빠름)' };
    return { 날짜: 잔, 호: '§98 본문', 왜: '대금을 청산한 날' + (등 ? '(등기 ' + 등 + '보다 빠르거나 같음)' : '') };
  };
  const 양 = 시기(p.양도, '양도'), 취 = 시기(p.취득, '취득');
  reqs.push(jmReq_('양도시기 ' + (양.날짜 || '?'), 양.날짜 ? true : null, 양.왜, '소득세법 §98 · 시행령 §162①' + 양.호.replace(/§98 본문/, '').replace(/^/, ' ')));
  reqs.push(jmReq_('취득시기 ' + (취.날짜 || '?'), 취.날짜 ? true : null, 취.왜, '소득세법 §98 · 시행령 §162①' + 취.호.replace(/§98 본문/, '').replace(/^/, ' ')));
  let 취득일 = 취.날짜;
  if (취득일 && 취득일 < '1985-01-01' && !/주식/.test(String(p.자산종류 || ''))) { notes.push('1984.12.31 이전 취득 토지·건물 — 1985.1.1에 취득한 것으로 봄(법률 제4803호 부칙 제8조 [원문 미확인 — 확인 필요]). 취득가액도 그날 기준'); 취득일 = '1985-01-01'; }
  if ((p.양도 || {}).대금에양도세 || jmYn_((p.양도 || {}).매수자부담양도세) === true) notes.push('매수자가 양도소득세를 대신 내기로 했으면 그 세금은 "대금"에서 빼고 청산일을 봄(§98 후단) — 세금만 남기고 잔금을 다 받은 날이 청산일');
  // 2) 신고기한·귀속연도
  const 허가 = jmYmd_((p.양도 || {}).허가일);
  const 기준 = 허가 && 양.날짜 && 허가 > 양.날짜 ? 허가 : 양.날짜;
  let 예정기한 = null;
  if (기준) { const d = new Date(기준.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + 3); d.setDate(0); 예정기한 = d.toISOString().slice(0, 10); }
  if (예정기한) 할일.push({ 무엇: '예정신고·납부' + (허가 && 허가 > 양.날짜 ? '(토지거래허가 전에 대금 청산 — 허가일이 속하는 달 기준)' : ''), 때: 예정기한, 근거: '소득세법 §105①1호' });
  if (양.날짜) notes.push('귀속 과세연도 ' + 양.날짜.slice(0, 4) + '년 — 같은 해 다른 양도와 합산(§102)·확정신고 ' + (Number(양.날짜.slice(0, 4)) + 1) + '년 5월(§110)');
  // 3) 보유기간 경계 — 엔진으로 견줌(①법대로 ②흔한 잘못: 잔금일만 봄)
  const 잔양 = jmYmd_((p.양도 || {}).잔금일), 잔취 = jmYmd_((p.취득 || {}).잔금일);
  const 칸 = function (양도일, 취득일2) {
    if (!n(p.양도가액) || !양도일 || !취득일2) return null;
    const c = { transferPrice: n(p.양도가액), transferDate: 양도일, assetType: String(p.자산종류 || 'general').replace(/land/, 'general'), acquisitionDate: 취득일2, acquisitionPrice: n(p.취득가액), necessaryExpenses: n(p.필요경비), acquisitionCause: /상속/.test(String((p.취득 || {}).원인)) ? 'inheritance' : /증여/.test(String((p.취득 || {}).원인)) ? 'gift' : 'purchase' };
    if (jmYn_(p['1세대1주택']) === true) { c.isOneHouseOneFamily = true; if (p.거주연수 != null && p.거주연수 !== '') c.residenceYears = Number(p.거주연수); }
    return c;
  };
  const e1 = 칸(양.날짜, 취득일);
  if (e1) 경우.push({ 이름: '① 법대로 — 양도 ' + 양.날짜 + '(' + 양.호 + ') · 취득 ' + 취득일 + '(' + 취.호 + ')', 엔진: 'calculate_transfer_tax', 엔진칸: e1 });
  const 잘양 = 잔양 || 양.날짜, 잘취 = (잔취 && !/상속|증여|시효|환지/.test(String((p.취득 || {}).원인))) ? 잔취 : 취득일;
  if (e1 && (잘양 !== 양.날짜 || 잘취 !== 취득일)) 경우.push({ 이름: '② 잘못 — 잔금일만 보면(양도 ' + 잘양 + ' · 취득 ' + 잘취 + ')', 엔진: 'calculate_transfer_tax', 엔진칸: 칸(잘양, 잘취), 잘못: true });
  // 1·2·3년이 차는 날 — 취득일 다음 날부터 세어(민법 §157 초일 불산입) 취득일과 같은 날짜에 참(세액 엔진과 같음)
  if (취득일) {
    const 찬 = function (y) { const d = new Date(취득일); d.setFullYear(d.getFullYear() + y); return d.toISOString().slice(0, 10); };
    const 경계 = [[1, '1년(1년 미만 단기 세율 경계)'], [2, '2년(단기 세율 끝·1세대1주택 보유 2년)'], [3, '3년(장기보유특별공제 시작)']];
    경계.forEach(function (b) {
      const 찰날 = 찬(b[0]);
      if (양.날짜 && 양.날짜 < 찰날) {
        const 남 = Math.round((new Date(찰날) - new Date(양.날짜)) / 86400000);
        if (남 <= 120) 할일.push({ 무엇: b[1] + ' 보유는 ' + 찰날 + '에 찹니다(양도일 ' + 양.날짜 + ' — ' + 남 + '일 모자람). 아직 잔금·등기 전이면 둘 다 ' + 찰날 + ' 이후로(취득일과 같은 날짜에 참 — 세액 엔진도 같은 셈)', 때: '잔금·등기 전', 근거: '소득세법 §95④·§104①2·3호 · 시행령 §162①2호' });
      }
    });
  }
  if (취.증감분) notes.push('환지로 늘어난 면적은 따로 취득일(' + 취.증감분 + ') — 그 부분은 보유기간이 짧아 단기 세율·장특 0%일 수 있음, 양도가액·취득가액을 면적으로 나눠 두 거래로');
  if (/상속/.test(String((p.취득 || {}).원인))) notes.push('상속받은 자산의 단기 세율 보유기간은 피상속인 취득일부터(§104②1호) · 장기보유특별공제는 상속개시일부터(§95④) — 엔진에 피상속인 취득일 칸이 있으면 함께 넣을 것');
  return jmWrap_('양도시기', reqs, { 양도시기: 양, 취득시기: 취, 취득일로봄: 취득일, 예정신고기한: 예정기한, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 80 「석씨 넓은 마당」] 주택부수토지가 배율을 넘으면 넘는 땅은 1세대1주택 비과세에서 빠지고(시행령 §154⑦) 비사업용 토지가 됨(소득세법 §104의3①5호·시행령 §168의12)
//  배율(시행령 §154⑦·§168의12, 2022.1.1. 이후 양도분 — 2020.2.11. 개정 부칙): 도시지역 안 — 수도권 주거·상업·공업 3배, 수도권 녹지 5배, 수도권 밖 5배 / 그 밖의 토지 10배
//   2021.12.31. 이전 양도는 종전 규정(도시지역 5배·그 밖 10배 [종전 원문 미확인 — 확인 필요]) · 수용되는 땅(사업인정 고시 전 취득)은 고시일 전날 용도지역(2025.11.28. 개정, 그 뒤 양도분)
//  고가주택 12억 판정·1세대1주택 비과세는 주택과 배율 안 부수토지만(넘는 땅 값은 빼고 셈 [확인 필요]) — 넘는 땅은 따로 한 거래(토지)로 엔진에 넘김
//  양도일 현재 주택이어야 함(시행령 §154① — 매매계약 뒤 그 계약에 따라 주택 외 용도로 바꾸면 계약일 현재). 멸실해 나대지로 넘기면 주택 아님
//  p: { 양도일, 취득일, 양도가액(주택+토지 합), 취득가액(합), 필요경비, 토지양도가액·토지취득가액(없으면 토지비율로), 토지비율(0~1, 기준시가 비율),
//       토지면적, 정착면적(건물이 정착된 면적), 용도지역(수도권 주거|수도권 상업|수도권 공업|수도권 녹지|수도권 밖 도시지역|도시지역 밖·관리·농림·자연환경보전), 수용(예)·고시전날용도지역,
//       1세대1주택(예), 거주연수, 주택상태(있음|멸실|용도변경), 멸실일, 매매계약일, 계약따라변경(예 — 매매계약에 따른 용도변경·멸실), 부수토지만양도(예), 건물소유세대(같음|다름) }
function judgeHouseLandExcess_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const f = function (v) { return Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0; };
  const won = function (v) { return Math.round(v).toLocaleString('ko-KR') + '원'; };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 양도일 = jmYmd_(p.양도일), 취득일 = jmYmd_(p.취득일), 계약일 = jmYmd_(p.매매계약일), 멸실일 = jmYmd_(p.멸실일);
  const 땅 = f(p.토지면적), 정착 = f(p.정착면적);
  // 1) 배율
  const 용 = String((jmYn_(p.수용) === true && p.고시전날용도지역) ? p.고시전날용도지역 : (p.용도지역 || ''));
  const 새법 = !양도일 || 양도일 >= '2022-01-01';
  let 배 = 0, 배근거 = '';
  if (/도시지역 밖|그 밖|관리|농림|자연환경/.test(용)) { 배 = 10; 배근거 = '도시지역 밖 10배'; }
  else if (!새법 && /수도권|도시/.test(용)) { 배 = 5; 배근거 = '2021년 이전 양도 — 도시지역 5배(종전 규정 [확인 필요])'; }
  else if (/수도권 밖/.test(용)) { 배 = 5; 배근거 = '수도권 밖 도시지역 5배'; }
  else if (/녹지/.test(용)) { 배 = 5; 배근거 = '수도권 녹지지역 5배'; }
  else if (/주거|상업|공업/.test(용)) { 배 = 3; 배근거 = '수도권 주거·상업·공업지역 3배'; }
  if (jmYn_(p.수용) === true && !p.고시전날용도지역) notes.push('수용되는 땅이면(사업인정 고시 전 취득) 고시일 전날 용도지역으로 배율을 봄(시행령 §154⑦ 후단, 2025.11.28. 개정 — 그 뒤 양도분) — 「고시전날용도지역」 칸을 넣을 것');
  const 한도 = 배 && 정착 ? 정착 * 배 : 0;
  reqs.push(jmReq_('부수토지 배율', !배 || !땅 || !정착 ? null : 땅 <= 한도, !배 ? '용도지역 「' + 용 + '」을 배율 표에 못 맞춤 — 토지이용계획확인서' : !땅 || !정착 ? '토지면적·정착면적이 없음 — 토지대장·건축물대장' : '토지 ' + 땅 + '㎡ · 정착 ' + 정착 + '㎡ × ' + 배 + '배(' + 배근거 + ') = ' + 한도 + '㎡', '소득세법 §89①3호 · 시행령 §154⑦ · 2020.2.11. 개정 부칙(2022.1.1. 이후 양도분)'));
  const 초과면적 = 한도 && 땅 > 한도 ? 땅 - 한도 : 0;
  const 율 = 초과면적 ? 초과면적 / 땅 : 0;
  // 2) 양도일 현재 주택인가
  const 상태 = String(p.주택상태 || '있음');
  let 주택임 = true;
  if (/멸실|용도변경/.test(상태)) {
    const 계약따라 = jmYn_(p.계약따라변경) === true;
    if (/용도변경/.test(상태) && 계약따라 && 계약일) { 주택임 = true; notes.push('매매계약 뒤 그 계약에 따라 주택 외 용도로 바꿔 넘김 — 매매계약일(' + 계약일 + ') 현재로 1세대1주택을 봄(시행령 §154① 괄호)'); }
    else if (/멸실/.test(상태) && 계약따라 && 계약일) { 주택임 = null; notes.push('매매계약에 따라 잔금 전 주택을 멸실 — 시행령 §154① 괄호는 "용도변경"만 적어 멸실도 계약일 현재로 볼지 갈림 [예규 원문 미확인 — 확인 필요]. 두 경우를 함께 냄'); }
    else { 주택임 = false; notes.push('양도일(' + (양도일 || '?') + ') 현재 주택이 없음(' + 상태 + (멸실일 ? ' ' + 멸실일 : '') + ') — 주택이 아니라 땅(나대지)을 판 것이어서 1세대1주택 비과세가 아님(시행령 §154① "양도일 현재"). 땅 전체가 비사업용 토지인지는 「비사업용 토지 판정」으로(주택 멸실 뒤 기간 — 시행령 §168의6 기간 기준)'); }
  }
  reqs.push(jmReq_('양도일 현재 주택', 주택임, 주택임 === true ? '주택으로 봄' : 주택임 === false ? '주택 아님(' + 상태 + ')' : '매매특약 멸실 — 갈림', '시행령 §154①'));
  if (jmYn_(p.부수토지만양도) === true) { reqs.push(jmReq_('주택과 함께 양도', false, '주택 건물은 남기고 부수토지만 따로 팜 — 주택과 떼어 판 부수토지는 1세대1주택 비과세 대상이 아님 [예규 원문 미확인 — 확인 필요]', '소득세법 §89①3호')); 주택임 = false; }
  if (/다름/.test(String(p.건물소유세대 || ''))) notes.push('건물과 땅의 주인이 다른 세대 — 땅 주인 세대는 그 땅 위 주택을 갖고 있지 않아 땅만 판 것으로 보여 1세대1주택 비과세가 어렵다는 것이 일반 해석 [판례·예규 원문 미확인 — 확인 필요]');
  // 3) 금액 나누기 — 넘는 땅 = 땅 값 × 넘는 면적 ÷ 토지면적(같은 필지 단가 같다고 봄 — 위치로 단가가 크게 다르면 감정가액 비율로 [확인 필요])
  const 양합 = n(p.양도가액), 취합 = n(p.취득가액), 경비 = n(p.필요경비), 비 = f(p.토지비율);
  const 땅양 = n(p.토지양도가액) || (비 ? 양합 * 비 : 0), 땅취 = n(p.토지취득가액) || (비 ? 취합 * 비 : 0);
  if (초과면적 && (!땅양 || !땅취)) reqs.push(jmReq_('토지·건물 가액', null, '넘는 땅 값을 나누려면 토지양도가액·토지취득가액(또는 토지비율 — 기준시가 비율, 소득세법 §100②)', '소득세법 §100②'));
  const 넘양 = Math.round(땅양 * 율), 넘취 = Math.round(땅취 * 율), 넘경 = 양합 ? Math.round(경비 * 넘양 / 양합) : 0;
  const 주양 = 양합 - 넘양, 주취 = 취합 - 넘취, 주경 = 경비 - 넘경;
  const 일주 = jmYn_(p['1세대1주택']) === true;
  const 집칸 = function (가, 취, 경, 비과세) {
    const c = { transferPrice: 가, transferDate: 양도일, assetType: 'house', acquisitionDate: 취득일, acquisitionPrice: 취, necessaryExpenses: 경, acquisitionCause: 'purchase' };
    if (비과세) { c.isOneHouseOneFamily = true; if (p.거주연수 != null && p.거주연수 !== '') c.residenceYears = Number(p.거주연수); }
    return c;
  };
  const 땅칸 = function (가, 취, 경, 비사업) { return { transferPrice: 가, transferDate: 양도일, assetType: 'general', acquisitionDate: 취득일, acquisitionPrice: 취, necessaryExpenses: 경, acquisitionCause: 'purchase', isNonBusinessLand: !!비사업 }; };
  const 됨 = 양합 && 양도일 && 취득일;
  if (됨 && 주택임 !== false && 초과면적 && 땅양 && 땅취) {
    경우.push({ 이름: '① 법대로 — 주택+배율 안 땅 ' + won(주양) + (일주 ? '(1세대1주택)' : '') + ' · 넘는 땅 ' + 초과면적 + '㎡ ' + won(넘양) + '(비사업용 토지 +10%p)', 엔진: 'calculate_transfer_tax_multi', 엔진칸늘: [집칸(주양, 주취, 주경, 일주), 땅칸(넘양, 넘취, 넘경, true)] });
    경우.push({ 이름: '② 넘는 땅이 비사업용 기간 기준을 피하면(시행령 §168의6) — 넘는 땅을 일반 토지로', 엔진: 'calculate_transfer_tax_multi', 엔진칸늘: [집칸(주양, 주취, 주경, 일주), 땅칸(넘양, 넘취, 넘경, false)] });
    경우.push({ 이름: '③ 잘못 — 배율을 안 보고 전부 ' + (일주 ? '1세대1주택' : '주택') + '으로', 엔진: 'calculate_transfer_tax', 엔진칸늘: [집칸(양합, 취합, 경비, 일주)], 잘못: true });
  } else if (됨 && 주택임 === false) {
    경우.push({ 이름: '① 법대로 — 주택 아님: 땅(나대지) 전체를 토지로' + (jmYn_(p.부수토지만양도) === true ? '(부수토지만 양도)' : ''), 엔진: 'calculate_transfer_tax', 엔진칸늘: [땅칸(땅양 || 양합, 땅취 || 취합, 경비, false)] });
    경우.push({ 이름: '② 그 땅이 비사업용 토지이면', 엔진: 'calculate_transfer_tax', 엔진칸늘: [땅칸(땅양 || 양합, 땅취 || 취합, 경비, true)] });
    경우.push({ 이름: '③ 잘못 — 1세대1주택으로 보면', 엔진: 'calculate_transfer_tax', 엔진칸늘: [집칸(양합, 취합, 경비, 일주)], 잘못: true });
  } else if (됨 && 주택임 === null) {
    경우.push({ 이름: '① 계약일 현재 주택으로 보면(1세대1주택' + (초과면적 ? ', 넘는 땅은 따로' : '') + ')', 엔진: 'calculate_transfer_tax_multi', 엔진칸늘: 초과면적 && 땅양 && 땅취 ? [집칸(주양, 주취, 주경, 일주), 땅칸(넘양, 넘취, 넘경, true)] : [집칸(양합, 취합, 경비, 일주)] });
    경우.push({ 이름: '② 양도일 현재(멸실 뒤 땅)로 보면 — 토지', 엔진: 'calculate_transfer_tax', 엔진칸늘: [땅칸(땅양 || 양합, 땅취 || 취합, 경비, false)] });
  } else if (됨) {
    경우.push({ 이름: '① 배율 안 — 전부 ' + (일주 ? '1세대1주택' : '주택'), 엔진: 'calculate_transfer_tax', 엔진칸늘: [집칸(양합, 취합, 경비, 일주)] });
  }
  if (초과면적) {
    notes.push('넘는 땅 ' + 초과면적 + '㎡(땅의 ' + (율 * 100).toFixed(1) + '%)는 주택에 딸린 땅으로 보지 않아 1세대1주택 비과세에서 빠지고 따로 토지로 과세(시행령 §154⑦) · 비사업용 토지(소득세법 §104의3①5호·시행령 §168의12)가 되어 +10%p — 다만 기간 기준(시행령 §168의6)은 「비사업용 토지 판정」으로 확인');
    if (일주) notes.push('고가주택 12억 판정은 주택과 배율 안 땅 값(' + won(주양) + ')으로 봄 [넘는 땅 값을 빼는지 원문 확인 필요]');
    할일.push({ 무엇: '토지대장(면적)·건축물대장(건물이 정착된 면적 — 1층 바닥면적, 처마·발코니 제외 여부 확인)·토지이용계획확인서(용도지역)', 때: '신고 전', 근거: '시행령 §154⑦' });
    if (!n(p.토지양도가액)) 할일.push({ 무엇: '토지·건물 값을 나눈 근거(계약서 구분 기재 또는 기준시가 비율 — §100②) · 넘는 땅이 길·밭처럼 단가가 다르면 감정', 때: '신고 전', 근거: '소득세법 §100②' });
    if (취득일 && 취득일 >= '2009-03-16' && 취득일 <= '2012-12-31') notes.push('2009.3.16.~2012.12.31. 사이 취득 — 넘는 땅이 비사업용 토지여도 +10%p를 붙이지 않음(법률 제9270호 부칙 제14조, 세액 엔진이 이미 반영) — ①과 ②가 같게 나옴');
    if (배 === 3) notes.push('2021년까지 양도였다면 같은 땅이 5배까지 주택부수토지 — ' + (정착 * 5) + '㎡(종전 규정, 2020.2.11. 개정 부칙)');
  }
  return jmWrap_('부수토지', reqs, { 배율: 배, 배율근거: 배근거, 한도면적: 한도, 넘는면적: 초과면적, 넘는비율: 율, 나눔: 초과면적 ? { 주택분: { 양도가액: 주양, 취득가액: 주취, 필요경비: 주경 }, 넘는땅: { 양도가액: 넘양, 취득가액: 넘취, 필요경비: 넘경 } } : null, 주택임: 주택임, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸늘 && 경우[0].엔진칸늘[0], 엔진칸늘: 경우[0] && 경우[0].엔진칸늘, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 81 「표씨 오피스텔·근생 빌라」] 공부상 용도가 아니라 실제로 주거용인지로 주택인지 가르기 — 1세대1주택·주택수가 여기에 매달림
//  소득세법 §88 7호: "주택" = 허가 여부·공부상 용도와 관계없이 세대원이 독립된 주거생활을 할 수 있는 구조(시행령 §152의4 — 세대별 공간마다 출입문·화장실·취사시설, 2024.2.29. 신설)를 갖춰
//   사실상 주거용으로 쓰는 건물 · 용도가 분명하지 않으면 공부상 용도 / 1세대1주택은 양도일 현재(시행령 §154①)
//  p: { 양도할(건물 이름), 양도일, 취득일, 양도가액, 취득가액, 필요경비, 거주연수, 1세대(예),
//       건물:[{이름, 공부상(주택|아파트|오피스텔|근린생활|업무|기타), 실제(주거|업무|비어있음|모름), 출입문·화장실·취사(예/아니오), 전입(예 — 본인·임차인 전입신고), 주택임대등록(예), 일반임대사업자(예 — 부가세 일반과세),
//              부가세환급(예), 임차인사업자(예 — 임차인이 그곳을 사업장으로 등록), 재산세주택분(예), 비고}] }
function judgeIsHouse_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 판정 = [];
  const 양도일 = jmYmd_(p.양도일);
  (Array.isArray(p.건물) ? p.건물 : []).forEach(function (b) {
    const 공 = String(b.공부상 || ''), 실 = String(b.실제 || '모름');
    const 공부주택 = /주택|아파트|다세대|연립|다가구/.test(공);
    const 구 = ['출입문', '화장실', '취사'].map(function (k) { return jmYn_(b[k]); });
    const 구조 = 구.indexOf(false) >= 0 ? false : 구.every(function (x) { return x === true; }) ? true : null;
    const 주거쪽 = [], 업무쪽 = [];
    if (jmYn_(b.전입) === true) 주거쪽.push('전입신고');
    if (jmYn_(b.주택임대등록) === true) 주거쪽.push('주택임대사업자 등록');
    if (jmYn_(b.재산세주택분) === true) 주거쪽.push('재산세 주택분 과세');
    if (jmYn_(b.임차인사업자) === true) 업무쪽.push('임차인 사업장 등록');
    if (jmYn_(b.일반임대사업자) === true) 업무쪽.push('일반임대사업자(부가세)');
    if (jmYn_(b.부가세환급) === true) 업무쪽.push('분양 때 부가세 환급');
    let 주택 = null, 왜 = '';
    if (구조 === false) { 주택 = false; 왜 = '출입문·화장실·취사시설 중 없는 것이 있어 주택 구조가 아님(시행령 §152의4)'; }
    else if (/주거/.test(실)) { 주택 = true; 왜 = '실제로 주거용으로 씀' + (주거쪽.length ? '(' + 주거쪽.join('·') + ')' : '') + (구조 === null && !공부주택 ? ' — 구조(출입문·화장실·취사) 확인 남음' : ''); }
    else if (/업무/.test(실)) { 주택 = false; 왜 = '실제로 업무용으로 씀' + (업무쪽.length ? '(' + 업무쪽.join('·') + ')' : ''); }
    else if (주거쪽.length && !업무쪽.length) { 주택 = true; 왜 = '실제 쓰임을 모르나 주거 쪽 증거만 있음(' + 주거쪽.join('·') + ') — 잠정'; }
    else if (업무쪽.length && !주거쪽.length) { 주택 = false; 왜 = '실제 쓰임을 모르나 업무 쪽 증거만 있음(' + 업무쪽.join('·') + ') — 잠정'; }
    else { 주택 = 공부주택; 왜 = (/비어/.test(실) ? '비어 있음' : 주거쪽.length ? '증거가 엇갈림(주거: ' + 주거쪽.join('·') + ' / 업무: ' + 업무쪽.join('·') + ')' : '실제 쓰임을 알 증거 없음') + ' — 용도가 분명하지 않아 공부상 용도(' + (공 || '?') + ')에 따름(§88 7호 후단)' + (/비어/.test(실) ? ' [비어 있던 기간 직전 쓰임으로 보는 해석도 있음 — 확인 필요]' : ''); }
    const 잠정 = 구조 === null && 주택 === true && !공부주택 || /잠정|엇갈림|증거 없음|비어/.test(왜);
    판정.push({ 이름: b.이름 || '?', 공부상: 공, 실제: 실, 주택: 주택, 잠정: 잠정, 왜: 왜, 주거증거: 주거쪽, 업무증거: 업무쪽 });
    reqs.push(jmReq_((b.이름 || '?') + ' 주택 여부', 잠정 ? null : true, (주택 ? '주택' : '주택 아님') + ' — ' + 왜, '소득세법 §88 7호 · 시행령 §152의4'));
    if (공부주택 !== 주택) notes.push((b.이름 || '?') + ': 공부상 「' + 공 + '」이지만 ' + (주택 ? '주택으로 셈' : '주택으로 세지 않음') + ' — ' + 왜);
    if (주택 && /오피스텔|업무|근린/.test(공) && jmYn_(b.부가세환급) === true) notes.push((b.이름 || '?') + ': 분양 때 부가세를 돌려받은 뒤 주거용으로 쓰면 면세 전용으로 부가세를 다시 낼 수 있음(부가가치세법 §10① [세목 범위 밖 — 확인 필요])');
    if (잠정) 할일.push({ 무엇: (b.이름 || '?') + ' — 실제 쓰임 증거(임대차계약서 용도·전입세대 열람·사업자등록 여부·관리비·재산세 과세 구분·내부 사진(출입문·화장실·취사))', 때: '신고 전', 근거: '소득세법 §88 7호' });
  });
  const 집수 = 판정.filter(function (x) { return x.주택 === true; }).length;
  const 공부집수 = 판정.filter(function (x) { return /주택|아파트|다세대|연립|다가구/.test(x.공부상); }).length;
  const 대상 = 판정.filter(function (x) { return x.이름 === p.양도할; })[0];
  if (p.양도할 && !대상) reqs.push(jmReq_('양도할 건물', null, '「' + p.양도할 + '」이 건물 목록에 없음', ''));
  const 대상주택 = 대상 ? 대상.주택 : null;
  if (대상) reqs.push(jmReq_('1세대1주택(주택 수)', 대상주택 === false ? false : 집수 === 1 ? true : 집수 > 1 ? false : null, 대상주택 === false ? '양도할 건물이 주택이 아님 — 1세대1주택 비과세 대상 아님(일반 건물 양도)' : '양도일 현재 주택 ' + 집수 + '채(공부상으로만 세면 ' + 공부집수 + '채)' + (집수 > 1 ? ' — 일시적 2주택 등 특례는 「1세대1주택」 판정으로' : ''), '소득세법 §89①3호 · 시행령 §154①'));
  const 칸 = function (비과세, 주택자산) {
    if (!n(p.양도가액) || !양도일 || !jmYmd_(p.취득일)) return null;
    const c = { transferPrice: n(p.양도가액), transferDate: 양도일, assetType: 주택자산 ? 'house' : 'general', acquisitionDate: jmYmd_(p.취득일), acquisitionPrice: n(p.취득가액), necessaryExpenses: n(p.필요경비), acquisitionCause: 'purchase' };
    if (비과세) { c.isOneHouseOneFamily = true; if (p.거주연수 != null && p.거주연수 !== '') c.residenceYears = Number(p.거주연수); }
    return c;
  };
  if (대상) {
    const 법 = 칸(대상주택 === true && 집수 === 1, 대상주택 !== false);
    if (법) 경우.push({ 이름: '① 실제 쓰임으로 — 주택 ' + 집수 + '채' + (대상주택 === false ? '(양도 건물은 주택 아님)' : 집수 === 1 ? '(1세대1주택)' : '(1세대1주택 아님 — 특례 없으면 과세)'), 엔진: 'calculate_transfer_tax', 엔진칸: 법 });
    const 공대상 = /주택|아파트|다세대|연립|다가구/.test(대상.공부상);
    const 잘 = 칸(공대상 && 공부집수 === 1, 공대상);
    if (잘 && (공부집수 !== 집수 || 공대상 !== (대상주택 === true))) 경우.push({ 이름: '② 잘못 — 공부상 용도로만 세면(주택 ' + 공부집수 + '채)', 엔진: 'calculate_transfer_tax', 엔진칸: 잘, 잘못: true });
  }
  if (집수 > 1) notes.push('주택 수가 늘면 조정대상지역 다주택 중과(소득세법 §104⑦·시행령 §167의3 — 중과 유예 기간 확인)·일시적 2주택 기한도 다시 봐야 함');
  notes.push('주택 여부는 건물마다 양도일 현재로 봄 — 그 전 쓰임이 바뀌었으면(업무→주거) 보유기간·거주기간은 주거용으로 쓴 날부터(시행령 §154⑤ 단서)');
  return jmWrap_('주택여부', reqs, { 건물판정: 판정, 주택수: 집수, 공부상주택수: 공부집수, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 82 「모씨 상가 리모델링」] 쓴 돈마다 필요경비로 인정되는지 가르기 — 취득가액에 넣을 것·자본적지출·양도비·안 되는 것·증빙 요건·감가상각 차감
//  소득세법 §97①(취득가액·자본적지출액·양도비)·③(사업소득에서 뺀 감가상각비는 취득가액에서 차감) · 시행령 §163①(취득 실지거래가액 — 취득원가·취득 쟁송 소송비)·
//  ③(자본적지출 1호 §67② 준용·2호 취득 후 쟁송 소송비·2의2 보상금 증액 소송비(증액분 한도)·3호 용도변경·개량·이용편의·3의2 개발부담금·3의3 재건축부담금·4호 시행규칙 §79①)·
//  ⑤(양도비 — 증권거래세·신고서/계약서 작성비·공증·인지·소개비·매매계약에 따른 명도비용·국민주택채권 매각차손) · ③⑤ 모두 §160의2② 증명서류 수취·보관 또는 금융거래 증명서류로 확인될 때만
//  p: { 양도가액, 양도일, 취득가액, 취득일, 자산(house|general), 감가상각누계(사업소득에서 필요경비로 넣은 것), 보상금증액(수용 증액분),
//       항목:[{이름, 금액, 언제(취득|보유|양도), 증빙(세금계산서|카드|현금영수증|계좌이체|영수증|없음), 매매계약따라(예 — 명도비), 비고}] }
function judgeExpenses_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return n(v).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 줄 = [], 안된것 = [];
  const 합 = { 취득가액: 0, 자본적지출: 0, 양도비: 0, 안됨: 0, 갈림: 0, 증빙없음: 0 };
  (Array.isArray(p.항목) ? p.항목 : []).forEach(function (it) {
    const 이름 = String(it.이름 || '?'), 글 = 이름 + ' ' + String(it.비고 || ''), 금 = n(it.금액), 언제 = String(it.언제 || '');
    const 증 = String(it.증빙 || '');
    const 증빙됨 = /세금계산서|계산서|카드|현금영수증|계좌|이체|금융/.test(증) ? true : /없음|현금$|^현금 /.test(증) || 증 === '현금' ? false : 증 ? null : null;
    let 칸 = null, 왜 = '', 근거 = '';
    if (/이자|대출/.test(글) && !/약정.*이자|이자.*약정/.test(글)) { 칸 = '안됨'; 왜 = '대출이자는 취득원가가 아님(약정으로 대금에 더한 이자만 포함, 지급 지연 이자도 제외)'; 근거 = '시행령 §163①3호'; }
    else if (/재산세|종부세|종합부동산|관리비|보험료/.test(글)) { 칸 = '안됨'; 왜 = '보유 중 세금·관리비는 필요경비가 아님'; 근거 = '소득세법 §97①'; }
    else if (/위약금|해약금|배상금/.test(글)) { 칸 = '안됨'; 왜 = '계약 해제 위약금·배상금은 필요경비가 아님'; 근거 = '소득세법 §97① [예규 확인 필요]'; }
    else if (/도배|장판|페인트|도장|청소|싱크|수리|보수|교체.*(전등|수전|타일)/.test(글) && !/개조|확장|증축|용도/.test(글)) { 칸 = '안됨'; 왜 = '원상회복·유지 수선(수익적지출) — 가치를 늘리거나 내용연수를 늘리지 않음'; 근거 = '시행령 §163③1호·§67②'; }
    else if (/보일러/.test(글)) { 칸 = '갈림'; 왜 = '보일러 교체는 난방시설 개량(자본적)으로 보는 예와 단순 교체(수익적)로 보는 예가 갈림 [확인 필요]'; 근거 = '시행령 §67②2호·5호'; }
    else if (/취득세|등록세|등록면허세|법무사|등기|취득.*(중개|수수료|소개)|(중개|수수료|소개).*취득|매입.*(중개|수수료)/.test(글) || 언제 === '취득' && /중개|수수료|소개/.test(글)) { 칸 = '취득가액'; 왜 = '취득에 든 부대비용 — 취득가액에 더함'; 근거 = '시행령 §163①1호·§89①'; }
    else if (/소송|화해/.test(글)) {
      if (/보상금|수용/.test(글)) { 칸 = '자본적지출'; 왜 = '보상금 증액 소송비 — 증액보상금 한도'; 근거 = '시행령 §163③2의2호'; }
      else if (언제 === '취득' || /취득.*쟁송|매수.*소송/.test(글)) { 칸 = '취득가액'; 왜 = '취득에 관한 쟁송의 소유권 확보 소송비 — 취득가액'; 근거 = '시행령 §163①2호'; }
      else { 칸 = '자본적지출'; 왜 = '취득 뒤 쟁송에서 소유권을 지키려고 직접 쓴 소송비'; 근거 = '시행령 §163③2호'; }
    }
    else if (/개발부담금/.test(글)) { 칸 = '자본적지출'; 왜 = '개발부담금'; 근거 = '시행령 §163③3의2호'; }
    else if (/재건축부담금|재건축초과이익/.test(글)) { 칸 = '자본적지출'; 왜 = '재건축부담금'; 근거 = '시행령 §163③3의3호'; }
    else if (/수익자부담금|사방|도로|장애.*철거/.test(글)) { 칸 = '자본적지출'; 왜 = '토지 이용 편의 비용(수익자부담금·장애철거·도로·사방)'; 근거 = '시행령 §163③4호·시행규칙 §79①'; }
    else if (/엘리베이터|승강기|냉난방|냉방|난방|피난|소방|개조|증축|확장|용도변경|리모델링|샷시|새시|창호|방수|철거/.test(글)) {
      칸 = '자본적지출'; 왜 = '용도변경·개량·확장·설비 설치(가치 증가)' + (/샷시|새시|창호|확장/.test(글) ? ' — 새시·발코니 확장은 자본적으로 보는 예규가 많음 [확인 필요]' : '') + (/철거/.test(글) && !/재해|노후/.test(글) ? ' — 철거비는 재해·노후화 등 부득이한 재건축일 때만(아니면 안 됨) [확인 필요]' : '');
      근거 = '시행령 §163③1호·3호·§67②';
      if (/철거/.test(글) && !/재해|노후|재건축/.test(글)) { 칸 = '갈림'; }
    }
    else if (/명도|이사비|퇴거/.test(글)) {
      if (jmYn_(it.매매계약따라) === false) { 칸 = '안됨'; 왜 = '매매계약상 인도의무 때문이 아닌 명도비'; 근거 = '시행령 §163⑤1호라목'; }
      else { 칸 = '양도비'; 왜 = '매매계약에 따른 인도의무를 이행하려고 쓴 명도비용' + (jmYn_(it.매매계약따라) === true ? '' : ' — 매매계약서 인도 조항 확인 남음'); 근거 = '시행령 §163⑤1호라목'; }
    }
    else if (/채권.*(매각|할인)|국민주택채권|토지개발채권/.test(글)) { 칸 = '양도비'; 왜 = '취득 때 산 국민주택채권 등을 만기 전 판 매각차손(금융기관 양도분 한도)'; 근거 = '시행령 §163⑤2호'; }
    else if (/중개|소개|신고서|세무사|계약서|공증|인지|증권거래세/.test(글)) { 칸 = '양도비'; 왜 = '양도에 직접 든 비용(소개비·신고서·계약서 작성비·공증·인지)'; 근거 = '시행령 §163⑤1호'; }
    else if (/컨설팅|감정|광고|분양/.test(글)) { 칸 = '갈림'; 왜 = '양도를 위한 컨설팅·감정·광고비는 「유사 비용」인지 갈림 [확인 필요]'; 근거 = '시행령 §163⑤1호마목'; }
    else { 칸 = '갈림'; 왜 = '어느 칸인지 정해지지 않음 — 쓴 내용을 더 받아야 함'; 근거 = '소득세법 §97①'; }
    // 증빙 요건 — 자본적지출·양도비는 §160의2② 증명서류 또는 금융거래 증명이 있어야 함
    let 증빙 = null;
    if (칸 === '자본적지출' || 칸 === '양도비' || 칸 === '갈림') {
      if (증빙됨 === false) { 증빙 = false; 합.증빙없음 += 금; }
      else if (증빙됨 === true) 증빙 = true;
    } else if (칸 === '취득가액' && 증빙됨 === false) 증빙 = false;
    let 반영 = 칸;
    if ((칸 === '자본적지출' || 칸 === '양도비') && 증빙 === false) { 반영 = '안됨'; 왜 += ' · 그러나 적격 증명서류도 금융거래 증명도 없어 인정 안 됨'; 근거 += ' · 시행령 §163③⑤ 본문'; }
    if (칸 === '취득가액' && 증빙 === false) 왜 += ' · 지급 증명이 없으면 실지거래가액으로 인정받기 어려움 [확인 필요]';
    if (/보상금 증액/.test(왜) && n(p.보상금증액) && 금 > n(p.보상금증액)) { 왜 += ' · 증액보상금 ' + won(p.보상금증액) + '원 한도로 줄임'; }
    const 인정금 = /보상금 증액/.test(왜) && n(p.보상금증액) ? Math.min(금, n(p.보상금증액)) : 금;
    합[반영 === '갈림' ? '갈림' : 반영] += 반영 === '안됨' || 반영 === '갈림' ? 금 : 인정금;
    줄.push({ 이름: 이름, 금액: 금, 칸: 반영, 본디칸: 칸, 증빙: 증빙, 왜: 왜, 근거: 근거 });
    if (반영 === '안됨') 안된것.push(이름 + ' ' + won(금) + '원 — ' + 왜 + ' (' + 근거 + ')'); else reqs.push(jmReq_(이름 + ' ' + won(금) + '원', 반영 === '갈림' || 증빙 === null && 반영 !== '취득가액' ? null : true, (반영 === '안됨' ? '안 됨' : 반영 === '갈림' ? '갈림' : 반영) + ' — ' + 왜, 근거));
    if (반영 !== '안됨' && 반영 !== '취득가액' && 증빙 === null) 할일.push({ 무엇: 이름 + ' — 세금계산서·카드·현금영수증 또는 계좌이체 내역', 때: '신고 전', 근거: '시행령 §163③⑤ · 소득세법 §160의2②' });
    if (반영 === '갈림') 할일.push({ 무엇: 이름 + ' — 무엇을 했는지 견적서·공사 내역·사진(개량인지 원상회복인지)', 때: '신고 전', 근거: 근거 });
  });
  const 상각 = n(p.감가상각누계);
  const 취득 = n(p.취득가액) + 합.취득가액 - 상각;
  if (상각) reqs.push(jmReq_('감가상각비 차감', true, '사업소득 계산에서 필요경비로 넣은 감가상각비 ' + won(상각) + '원을 취득가액에서 뺌', '소득세법 §97③'));
  notes.push('취득가액(취득 부대비용 더하고 감가상각 뺀 것) ' + won(취득) + '원 · 자본적지출 ' + won(합.자본적지출) + '원 · 양도비 ' + won(합.양도비) + '원 · 안 되는 것 ' + won(합.안됨) + '원 · 갈림 ' + won(합.갈림) + '원');
  안된것.forEach(function (x) { notes.push('필요경비 아님: ' + x); });
  if (합.증빙없음) notes.push('증빙 없는 지출 ' + won(합.증빙없음) + '원은 인정 안 됨 — 지금이라도 받을 수 있는 계좌이체 내역·세금계산서가 있는지 확인');
  notes.push('취득가액을 확인 못 해 환산취득가액을 쓰면 자본적지출·양도비 대신 개산공제를 씀. 다만 (환산취득가액+개산공제)가 (자본적지출+양도비)보다 적으면 뒤쪽을 고를 수 있음(소득세법 §97②2호 단서) — 엔진 환산 경로가 셈');
  const 칸만 = function (취득가, 경비) {
    if (!n(p.양도가액) || !jmYmd_(p.양도일) || !jmYmd_(p.취득일)) return null;
    return { transferPrice: n(p.양도가액), transferDate: jmYmd_(p.양도일), assetType: p.자산 === 'house' ? 'house' : 'general', acquisitionDate: jmYmd_(p.취득일), acquisitionPrice: 취득가, necessaryExpenses: 경비, acquisitionCause: 'purchase' };
  };
  const 법 = 칸만(취득, 합.자본적지출 + 합.양도비);
  if (법) 경우.push({ 이름: '① 법대로 — 인정되는 것만(갈림 빼고)', 엔진: 'calculate_transfer_tax', 엔진칸: 법 });
  if (법 && 합.갈림) 경우.push({ 이름: '② 갈림 항목까지 인정되면', 엔진: 'calculate_transfer_tax', 엔진칸: 칸만(취득, 합.자본적지출 + 합.양도비 + 합.갈림) });
  const 전부 = 줄.reduce(function (s, x) { return s + x.금액; }, 0);
  if (법) 경우.push({ 이름: '③ 잘못 — 쓴 돈 전부 필요경비·감가상각 안 뺌', 엔진: 'calculate_transfer_tax', 엔진칸: 칸만(n(p.취득가액), 전부), 잘못: true });
  return jmWrap_('필요경비', reqs, { 항목판정: 줄, 합계: 합, 취득가액: 취득, 필요경비: 합.자본적지출 + 합.양도비, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 83 「길씨 집 넷」] 다주택 중과 — 어느 주택이 중과 주택 수에서 빠지고, 파는 주택이 중과에서 빠지는지 가르기
//  소득세법 §104⑦ · 시행령 §167의3(3주택 이상)·§167의10(2주택): ①1호(수도권·광역시·특별자치시 밖, 광역시 군·읍면 포함, 양도 당시 기준시가 3억 이하)·12호(소형신축·지방 미분양·인구감소지역 등)는
//   주택 수에도 안 셈 / 2~8의2호(§167의10은 2~7호)는 주택 수엔 세되 그 주택은 중과 안 함 / 10호 그 주택들을 빼면 1채만 남는 「일반주택」도 중과 안 함 / 11호 조정 공고 전 계약 / 13호(§167의10 15호) 1주택 특례 비과세 요건 충족
//   12의2호 보유 2년 이상·2026-05-09까지 양도 한시배제는 엔진이 셈(computeMultiHouseSurchargeExclusion)
//  p: { 양도할, 양도일, 취득일, 양도가액, 취득가액, 필요경비, 조정대상지역(예), 계약일, 혼인일,
//       주택:[{이름, 지역(수도권|광역시|특별자치시|지방), 군읍면(예 — 광역시 군·읍면), 기준시가(양도 당시), 사유(장기임대|감면임대|사원용|조특감면|국가유산|상속|저당취득|어린이집|공고전계약|소형신축|미분양|인구감소|1주택특례|부득이|소송|수도권밖),
//              상속일, 취득일, 판결일, 정비구역(예), 요건확인(예 — 임대·사원용 등 그 호의 요건을 서류로 확인)}] }
function judgeSurcharge_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const addY = function (d, k) { return d ? (Number(d.slice(0, 4)) + k) + d.slice(4) : ''; };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 판정 = [];
  const 양도일 = jmYmd_(p.양도일);
  const 집 = Array.isArray(p.주택) ? p.주택 : [];
  const 조정 = jmYn_(p.조정대상지역);
  const 수제외 = function (h) { // 1호·12호 — 주택 수에 안 셈
    const 지방 = /지방/.test(h.지역 || '') || (/광역시|특별자치시/.test(h.지역 || '') && jmYn_(h.군읍면) === true);
    if (지방 && n(h.기준시가) > 0 && n(h.기준시가) <= 300000000) return { 호: '1호', 왜: '수도권·광역시·특별자치시 밖' + (jmYn_(h.군읍면) === true ? '(광역시 군·읍면)' : '') + ', 양도 당시 기준시가 ' + n(h.기준시가).toLocaleString() + '원 ≤ 3억' };
    if (지방 && !n(h.기준시가)) return { 호: '1호?', 왜: '지방 주택인데 양도 당시 기준시가를 모름 — 3억 이하면 주택 수에서 빠짐', 잠정: true };
    if (/소형신축|미분양|인구감소/.test(h.사유 || '')) { const d = jmYmd_(h.취득일); const 안 = /인구감소/.test(h.사유) ? d >= '2026-01-01' : d >= '2024-01-10' && d <= '2027-12-31'; return 안 ? { 호: '12호', 왜: h.사유 + ' — 취득일 ' + d + ' (면적·가액 요건은 서류로)', 잠정: jmYn_(h.요건확인) !== true } : { 호: '', 왜: h.사유 + ' 취득일(' + (d || '?') + ')이 기간 밖 — 12호 아님' }; }
    return null;
  };
  const 호목록3 = { '장기임대': '2호', '감면임대': '3호', '사원용': '4호', '조특감면': '5호', '국가유산': '6호', '상속': '7호', '저당취득': '8호', '어린이집': '8호의2' };
  const 호목록2 = { '장기임대': '2호', '감면임대': '2호', '사원용': '2호', '조특감면': '2호', '국가유산': '2호', '상속': '2호', '저당취득': '2호', '어린이집': '2호', '부득이': '3호', '수도권밖': '4호', '소송': '7호' };
  집.forEach(function (h) {
    const 이름 = h.이름 || '?', 사 = String(h.사유 || '');
    const s = 수제외(h);
    let 제외 = null, 잠정 = !!(s && s.잠정), 왜 = s && s.호 ? s.왜 : '';
    if (!(s && s.호 && s.호 !== '1호?') && 사) {
      if (/상속/.test(사)) { const d = jmYmd_(h.상속일); 제외 = d ? (양도일 <= addY(d, 5) ? { 왜: '상속받은 날(' + d + ')부터 5년 안' } : { 지남: '상속받은 날(' + d + ')부터 5년 지남 — 7호 아님' }) : { 왜: '상속일 모름', 잠정: true }; }
      else if (/저당취득/.test(사)) { const d = jmYmd_(h.취득일); 제외 = d && 양도일 <= addY(d, 3) ? { 왜: '저당권 실행·대물변제로 취득한 날(' + d + ')부터 3년 안' } : { 지남: '취득일부터 3년 지났거나 취득일 모름 — 8호 아님' }; }
      else if (/소송/.test(사)) { const d = jmYmd_(h.판결일); 제외 = !d || 양도일 <= addY(d, 3) ? { 왜: d ? '확정판결일(' + d + ')부터 3년 안' : '소유권 소송 진행 중' } : { 지남: '확정판결일부터 3년 지남' }; }
      else if (호목록3[사] || 호목록2[사] || /공고전계약|1주택특례/.test(사)) 제외 = { 왜: 사, 잠정: jmYn_(h.요건확인) !== true && /장기임대|감면임대|사원용|어린이집|부득이|수도권밖/.test(사) };
      if (제외 && 제외.잠정) 잠정 = true;
    }
    판정.push({ 이름: 이름, 사유: 사, 수제외: !!(s && s.호 && s.호 !== '1호?'), 수제외호: s && s.호 || '', 제외: !!(제외 && !제외.지남), 지남: 제외 && 제외.지남 || '', 잠정: 잠정, 왜: [왜, 제외 && (제외.왜 || 제외.지남)].filter(Boolean).join(' · '), 기준시가: n(h.기준시가) });
    if (잠정) 할일.push({ 무엇: 이름 + ' — ' + (s && s.호 === '1호?' ? '양도 당시 기준시가(공시가격) 확인' : 사 + ' 요건 서류(임대사업자·사업자등록증·임대차계약서·임대개시일 기준시가, 상속·취득 등기 등)'), 때: '신고 전', 근거: '시행령 §167의3① · §167의10①' });
  });
  const 셀 = 판정.filter(function (x) { return !x.수제외; });
  const 수 = 셀.length, 전체 = 판정.length;
  const 세3 = 수 >= 3, 세2 = 수 === 2;
  const 대상 = 판정.filter(function (x) { return x.이름 === p.양도할; })[0];
  reqs.push(jmReq_('조정대상지역', 조정 === null ? null : 조정, 조정 === true ? '양도일 현재 조정대상지역' : 조정 === false ? '조정대상지역 아님 — 중과 없음(§104⑦)' : '양도일 현재 조정대상지역인지 모름', '소득세법 §104⑦'));
  reqs.push(jmReq_('중과 주택 수', 판정.some(function (x) { return x.수제외호 === '1호?'; }) ? null : true, '전체 ' + 전체 + '채 중 주택 수에 세는 것 ' + 수 + '채' + (전체 > 수 ? '(빠짐: ' + 판정.filter(function (x) { return x.수제외; }).map(function (x) { return x.이름 + ' ' + x.수제외호; }).join(', ') + ')' : ''), 세3 ? '시행령 §167의3①(1호·12호는 주택 수에 안 셈)' : '시행령 §167의10①'));
  let 중과 = null, 왜 = '';
  if (!대상) reqs.push(jmReq_('양도할 주택', null, '「' + (p.양도할 || '?') + '」이 주택 목록에 없음', ''));
  else {
    const 일반호 = 세3 ? /2호|3호|4호|5호|6호|7호|8호/ : /2호|3호|4호|5호|6호|7호/;
    const 표 = 세3 ? 호목록3 : 호목록2;
    const 남 = 셀.filter(function (x) { return !(x.제외 && 일반호.test(표[x.사유] || '')); });
    if (대상.수제외) { 중과 = false; 왜 = 대상.수제외호 + ' 주택 — 주택 수에도 안 세고 중과도 안 함'; }
    else if (조정 === false || 수 < 2) { 중과 = false; 왜 = 조정 === false ? '조정대상지역 아님' : '중과 주택 수 ' + 수 + '채 — 다주택 아님'; }
    else if (대상.제외) { const 호 = /공고전계약/.test(대상.사유) ? '11호' : /1주택특례/.test(대상.사유) ? (세3 ? '13호' : '15호') : 표[대상.사유] || ''; 중과 = false; 왜 = (세3 ? '§167의3①' : '§167의10①') + 호 + ' ' + 대상.사유 + ' — 중과 안 함(' + 대상.왜 + ')'; }
    else if (!세3 && 대상.기준시가 > 0 && 대상.기준시가 <= 100000000 && jmYn_((집.filter(function (h) { return h.이름 === 대상.이름; })[0] || {}).정비구역) !== true) { 중과 = false; 왜 = '2주택 — 양도 당시 기준시가 1억 이하(§167의10①9호)'; }
    else if (남.length === 1 && 남[0].이름 === 대상.이름) { 중과 = false; 왜 = (세3 ? '§167의3①10호' : '§167의10①10호') + ' 일반주택 — ' + 셀.filter(function (x) { return x.이름 !== 대상.이름; }).map(function (x) { return x.이름 + '(' + (표[x.사유] || x.사유) + ')'; }).join('·') + '을 빼면 이 주택 한 채만 남음'; }
    else { 중과 = 조정 === true ? true : null; 왜 = (세3 ? '3주택 이상' : '2주택') + ' 중과 대상 — 빠지는 사유 없음' + (남.length > 1 ? '(제외 주택을 빼도 ' + 남.length + '채: ' + 남.map(function (x) { return x.이름; }).join('·') + ')' : ''); }
    reqs.push(jmReq_('파는 주택이 중과 대상인지', 대상.잠정 || 셀.some(function (x) { return x.잠정 && x.이름 !== 대상.이름; }) ? null : true, (중과 ? '중과 대상' : 중과 === false ? '중과 안 함' : '모름') + ' — ' + 왜, 세3 ? '소득세법 §104⑦3호·4호 · 시행령 §167의3①' : '소득세법 §104⑦1호·2호 · 시행령 §167의10①'));
    판정.filter(function (x) { return x.지남; }).forEach(function (x) { notes.push(x.이름 + ': ' + x.지남 + ' — 주택 수에 세고 중과 제외도 안 됨'); });
  }
  const 칸 = function (주택수, 제외) {
    if (!n(p.양도가액) || !양도일 || !jmYmd_(p.취득일)) return null;
    const c = { transferPrice: n(p.양도가액), transferDate: 양도일, assetType: 'house', acquisitionDate: jmYmd_(p.취득일), acquisitionPrice: n(p.취득가액), necessaryExpenses: n(p.필요경비), acquisitionCause: 'purchase', isAdjustedArea: 조정 === true, multiHouseCount: 주택수 };
    if (제외) { c.isMultiHouseRentalExemption = true; c.mhRentalExemptionType = 'general'; }
    if (jmYmd_(p.계약일)) c.saleContractDate = jmYmd_(p.계약일);
    return c;
  };
  if (대상) {
    const 법 = 칸(수, 중과 === false && !대상.수제외 && 수 >= 2);
    if (법 && 대상.수제외) { 법.multiHouseCount = 0; }
    if (법) 경우.push({ 이름: '① 법대로 — 중과 주택 수 ' + 수 + '채 · ' + (중과 ? '중과' : 중과 === false ? '중과 안 함' : '중과 모름(조정 여부 확인)'), 엔진: 'calculate_transfer_tax', 엔진칸: 법 });
    const 잘 = 칸(전체, false);
    if (잘 && (전체 !== 수 || 중과 === false)) 경우.push({ 이름: '② 잘못 — 집을 모두 세고 빠지는 주택을 안 봄(' + 전체 + '채)', 엔진: 'calculate_transfer_tax', 엔진칸: 잘, 잘못: true });
  }
  notes.push('보유 2년 이상이고 2026-05-09까지 판 주택(또는 그날까지 계약·토지거래허가 신청한 주택)은 한시 배제(§167의3①12의2호) — 엔진이 양도일·계약일로 셈');
  notes.push('다가구는 구획마다 한 채(거주자가 고르면 전체 한 채), 공동상속주택은 지분이 가장 큰 상속인 것으로 셈(§167의3②1·2호) — 그렇게 센 뒤 목록에 넣을 것');
  if (jmYmd_(p.혼인일)) notes.push('혼인으로 3주택 이상이 됐고 혼인일(' + jmYmd_(p.혼인일) + ')부터 5년 안 양도면 배우자 주택 수를 빼고 판정하는 특례(§167의3⑨) — [확인 필요] 이 도구는 넣지 않음');
  notes.push('수도권 읍·면 소재 주택을 1호(지방 저가)로 볼지는 괄호 문언이 광역시·특별자치시만 가리키는지에 달림 — 도구는 수도권이면 늘 주택 수에 셈 [확인 필요]');
  return jmWrap_('중과판정', reqs, { 주택판정: 판정, 중과주택수: 수, 전체주택수: 전체, 중과: 중과, 왜: 왜, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 84 「반씨 세대」] 1세대 범위 — 누구의 주택을 한 세대 주택 수에 넣는지 가르기(주민등록과 다를 때)
//  소득세법 §88 6호: 1세대 = 거주자와 배우자(사실상 이혼 아닌 관계 포함)가 그들과 같은 주소·거소에서 생계를 같이하는 가족(거주자·배우자의 직계존비속과 그 배우자, 형제자매 —
//   취학·질병 요양·근무상·사업상 형편으로 본래 주소에서 일시 퇴거한 사람 포함)과 함께 구성하는 가족 단위. 배우자가 없어도 시행령 §152의3(30세 이상·배우자 사망·이혼·
//   기준 중위소득 40% 이상 소득으로 독립 생계, 미성년 제외)이면 따로 1세대
//  p: { 양도할(주택 이름), 양도일, 취득일, 양도가액, 취득가액, 필요경비, 거주연수, 본인주택:[이름], 배우자({있음(예), 같은주소, 사실상이혼(예), 주택:[이름]}),
//       가족:[{이름, 관계(자녀|부모|형제자매|며느리|사위|손자|조부모|기타), 나이, 같은주소(예), 생계(같이|따로|모름), 일시퇴거(취학|질병|근무|사업), 혼인(예 — 본인 배우자 있음),
//              배우자사망이혼(예), 소득요건(예/아니오 — 시행령 §152의3 3호), 주택:[이름]}] }
function judgeHousehold_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const arr = function (v) { return Array.isArray(v) ? v : v ? String(v).split(/[,·\s]+/).filter(Boolean) : []; };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 판정 = [];
  const 양도일 = jmYmd_(p.양도일);
  const 배 = p.배우자 || {};
  const 배있음 = jmYn_(배.있음) === true || arr(배.주택).length > 0;
  const 본집 = arr(p.본인주택);
  if (p.양도할 && 본집.indexOf(p.양도할) < 0) 본집.push(p.양도할);
  판정.push({ 이름: '본인', 관계: '본인', 포함: true, 주민포함: true, 잠정: false, 왜: '양도하는 거주자', 주택: 본집 });
  if (배있음) {
    const 따로 = jmYn_(배.같은주소) === false;
    판정.push({ 이름: '배우자', 관계: '배우자', 포함: true, 주민포함: !따로, 잠정: false, 왜: '배우자는 주소가 달라도 같은 1세대(§88 6호 — 「거주자 및 그 배우자」가 세대의 중심)' + (따로 ? ' — 따로 살아도 포함' : ''), 주택: arr(배.주택) });
  } else if (jmYn_(배.사실상이혼) === true) {
    판정.push({ 이름: '전 배우자', 관계: '배우자', 포함: true, 주민포함: jmYn_(배.같은주소) === true, 잠정: true, 왜: '법률상 이혼했으나 생계를 같이하는 등 사실상 이혼으로 보기 어려움 — 배우자로 봄(§88 6호 괄호)', 주택: arr(배.주택) });
  }
  (Array.isArray(p.가족) ? p.가족 : []).forEach(function (g) {
    const 관 = String(g.관계 || ''), 이름 = g.이름 || 관 || '?', 나이 = n(g.나이);
    const 가족범위 = /자녀|아들|딸|부모|아버지|어머니|형제|자매|며느리|사위|손자|손녀|조부|조모|장인|장모|시부|시모|직계/.test(관);
    const 같은 = jmYn_(g.같은주소), 생계 = String(g.생계 || '모름'), 퇴거 = String(g.일시퇴거 || '');
    let 포함 = false, 잠정 = false, 왜 = '';
    // 그 사람이 따로 1세대가 될 수 있나(§88 6호 단서·시행령 §152의3) — 배우자 없는 사람만 따짐
    const 독립 = jmYn_(g.혼인) === true ? { 된다: true, 왜: '배우자가 있어 스스로 1세대' }
      : 나이 >= 30 ? { 된다: true, 왜: '30세 이상(§152의3 1호)' }
      : jmYn_(g.배우자사망이혼) === true ? { 된다: true, 왜: '배우자 사망·이혼(2호)' }
      : jmYn_(g.소득요건) === true && 나이 >= 19 ? { 된다: true, 왜: '중위소득 40% 이상 소득으로 독립 생계(3호)' }
      : jmYn_(g.소득요건) === true && 나이 && 나이 < 19 ? { 된다: false, 왜: '미성년이라 소득이 있어도 3호 안 됨(3호 단서)' }
      : 나이 && 나이 < 30 ? { 된다: jmYn_(g.소득요건) === false ? false : null, 왜: '30세 미만·배우자 없음' + (jmYn_(g.소득요건) === false ? '·소득 요건 못 갖춤' : '·소득 요건 모름') }
      : { 된다: null, 왜: '나이·혼인·소득 모름' };
    if (!가족범위) { 포함 = false; 왜 = 관 + ' — 직계존비속(그 배우자)·형제자매가 아니라 같은 집에 살아도 세대원 아님'; }
    else if (같은 === true || /취학|질병|근무|사업/.test(퇴거)) {
      if (/따로/.test(생계) && 독립.된다 === true) { 포함 = false; 잠정 = true; 왜 = '같은 주소지만 생계를 따로 하고 ' + 독립.왜 + ' — 별도 세대 주장(생계 독립을 서류로 입증해야 함)'; }
      else { 포함 = true; 왜 = (같은 === true ? '같은 주소에서 ' : 퇴거 + ' 때문에 일시 퇴거 — 본래 주소에서 ') + '생계를 같이함' + (/모름/.test(생계) ? '(같은 주소면 같이한다고 봄)' : '') + (/따로/.test(생계) ? ' — 생계 따로라 해도 ' + 독립.왜 + '이라 따로 1세대가 못 됨' : ''); 잠정 = /따로/.test(생계) && 독립.된다 === null; }
    } else if (같은 === false) {
      if (독립.된다 === false) { 포함 = true; 잠정 = true; 왜 = '주소는 다르나 ' + 독립.왜 + ' — 따로 1세대가 못 돼 부모 세대에 듦(§88 6호 단서) [실제 생계 독립 여부는 예규로 다툼 — 확인 필요]'; }
      else if (독립.된다 === true) { 포함 = false; 왜 = '주소가 다르고 ' + 독립.왜; }
      else { 포함 = null; 잠정 = true; 왜 = '주소는 다르나 ' + 독립.왜 + ' — 따로 1세대인지 모름'; }
    } else { 포함 = null; 잠정 = true; 왜 = '같은 주소인지 모름'; }
    const 주민 = 가족범위 && 같은 === true;
    판정.push({ 이름: 이름, 관계: 관, 나이: 나이 || null, 포함: 포함, 주민포함: 주민, 잠정: 잠정, 왜: 왜, 주택: arr(g.주택) });
    if (잠정) 할일.push({ 무엇: 이름 + ' — ' + (/따로/.test(생계) ? '생계 독립 증빙(본인 명의 소득·임차·생활비 부담 서류)' : '주민등록등본·가족관계증명서·소득금액증명(중위소득 40% 확인)'), 때: '신고 전', 근거: '소득세법 §88 6호 · 시행령 §152의3' });
  });
  const 집 = function (f) { const s = []; 판정.filter(f).forEach(function (x) { x.주택.forEach(function (h) { if (s.indexOf(h) < 0) s.push(h); }); }); return s; };
  const 법집 = 집(function (x) { return x.포함 === true; });
  const 모름집 = 집(function (x) { return x.포함 === null; });
  const 주민집 = 집(function (x) { return x.주민포함; });
  const 본인만 = 본집.slice();
  판정.forEach(function (x) { reqs.push(jmReq_(x.이름 + (x.관계 && x.관계 !== x.이름 ? '(' + x.관계 + ')' : '') + ' 세대원', x.포함 === null || x.잠정 ? null : true, (x.포함 === true ? '세대원' : x.포함 === false ? '세대원 아님' : '모름') + ' — ' + x.왜 + (x.주택.length ? ' · 주택 ' + x.주택.join('·') : ''), '소득세법 §88 6호' + (x.관계 === '배우자' || x.관계 === '본인' ? '' : ' · 시행령 §152의3'))); });
  reqs.push(jmReq_('1세대 주택 수', 모름집.length ? null : true, '세대원 주택 ' + 법집.length + '채(' + 법집.join('·') + ')' + (모름집.length ? ' + 세대원인지 모르는 사람의 주택 ' + 모름집.join('·') : '') + ' — 주민등록상 같은 주소만 세면 ' + 주민집.length + '채, 본인 명의만 세면 ' + 본인만.length + '채', '소득세법 §89①3호 · 시행령 §154①'));
  const 칸 = function (일주택) {
    if (!n(p.양도가액) || !양도일 || !jmYmd_(p.취득일)) return null;
    const c = { transferPrice: n(p.양도가액), transferDate: 양도일, assetType: 'house', acquisitionDate: jmYmd_(p.취득일), acquisitionPrice: n(p.취득가액), necessaryExpenses: n(p.필요경비), acquisitionCause: 'purchase' };
    if (일주택) { c.isOneHouseOneFamily = true; if (p.거주연수 != null && p.거주연수 !== '') c.residenceYears = Number(p.거주연수); }
    return c;
  };
  if (p.양도할) {
    const 법 = 칸(법집.length === 1 && !모름집.length);
    if (법) 경우.push({ 이름: '① 법대로 — 1세대 주택 ' + 법집.length + '채' + (모름집.length ? ' + 세대원인지 모르는 사람의 주택 ' + 모름집.length + '채(세는 쪽으로 — 잠정, 1세대1주택 아님)' : 법집.length === 1 ? '(1세대1주택)' : '(1세대1주택 아님 — 특례 없으면 과세)'), 엔진: 'calculate_transfer_tax', 엔진칸: 법 });
    if (모름집.length) { const c1 = 칸(법집.length === 1); if (c1) 경우.push({ 이름: '①-2 그 사람이 따로 1세대로 확인되면 — 1세대 주택 ' + 법집.length + '채', 엔진: 'calculate_transfer_tax', 엔진칸: c1 }); }
    if (주민집.length !== 법집.length) { const c2 = 칸(주민집.length === 1); if (c2) 경우.push({ 이름: '② 잘못 — 주민등록상 같은 주소만 셈(' + 주민집.length + '채)', 엔진: 'calculate_transfer_tax', 엔진칸: c2, 잘못: true }); }
    if (본인만.length !== 법집.length && 본인만.length !== 주민집.length) { const c3 = 칸(본인만.length === 1); if (c3) 경우.push({ 이름: '③ 잘못 — 본인 명의만 셈(' + 본인만.length + '채)', 엔진: 'calculate_transfer_tax', 엔진칸: c3, 잘못: true }); }
  }
  if (법집.length > 1) notes.push('세대 주택이 2채 이상 — 일시적 2주택·상속주택·동거봉양 합가(10년)·혼인 합가(10년) 같은 특례는 「1세대1주택」 판정으로, 조정대상지역 중과는 「중과판정」으로 이어 볼 것');
  notes.push('세대원 판정은 양도일 현재(시행령 §154①) — 양도 전에 자녀가 30세가 되거나 혼인·취업으로 따로 나가면 결과가 바뀜. 위장 전출은 실질로 봄');
  notes.push('주민등록은 근거 서류일 뿐 — 같은 주소라도 생계가 따로면 별도 세대, 주소가 달라도 따로 1세대가 못 되면 같은 세대(§88 6호)');
  return jmWrap_('세대판정', reqs, { 세대원: 판정, 세대주택: 법집, 세대주택수: 법집.length, 주민주택수: 주민집.length, 본인주택수: 본인만.length, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 86 「염씨 할아버지 땅」] 의제취득일 전에 취득한 자산의 취득가액 — 의제취득일 현재 가액과 「실제 취득가액 + 물가상승분」 중 많은 것
//  소득세법 시행령 §162⑥⑦(법률 제4803호 부칙 §8): 토지·건물·부동산 권리·기타자산은 1985.1.1., 주식은 1986.1.1. 전에 취득하면 그날 취득한 것으로 봄
//  시행령 §176의2④: 의제취득일 전 취득 자산(상속·증여받은 것 포함)의 의제취득일 현재 취득가액 = 다음 중 많은 것
//   1호 의제취득일 현재 ③1호(매매사례가액)·2호(감정가액)·3호(환산취득가액)로 정한 가액(순서대로)
//   2호 취득 당시 실지거래가액(또는 그때 매매사례·감정가액)이 확인되면 그 가액 + 그 가액 × 취득일부터 의제취득일 직전일까지 생산자물가상승률
//  p: { 자산(토지건물|권리|기타자산|주식), 취득일, 취득원인(매매|상속|증여), 양도일, 양도가액, 양도기준시가, 의제기준시가(의제취득일 현재 기준시가),
//       의제매매사례, 의제감정(의제취득일 전후 3개월 안), 실지취득가액(취득 당시 확인된 값), 실가근거(계약서 등), 물가상승률(0.6 또는 60%) 또는 물가지수{취득, 의제직전},
//       필요경비(자본적지출+양도비 실제), 미등기(예) }
function judgeDeemedAcq_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 주식 = /주식|출자/.test(String(p.자산 || ''));
  const 의제일 = 주식 ? '1986-01-01' : '1985-01-01';
  const 취득일 = jmYmd_(p.취득일), 양도일 = jmYmd_(p.양도일);
  const 근거일 = '소득세법 시행령 §162⑥⑦(법률 제4803호 부칙 §8) — ' + (주식 ? '주식 1986.1.1.' : '토지·건물·부동산 권리·기타자산 1985.1.1.');
  if (!취득일) { reqs.push(jmReq_('취득일', null, '취득일을 몰라 의제취득일 전인지 못 가림', 근거일)); return jmWrap_('의제취득', reqs, { 의제취득일: 의제일, 할일: [{ 무엇: '취득일 — 등기부(접수일)·옛 계약서·토지대장 소유권 변동일', 때: '신고 전', 근거: 근거일 }] }); }
  if (취득일 >= 의제일) { reqs.push(jmReq_('의제취득일 전 취득', false, 취득일 + ' 취득 — 의제취득일(' + 의제일 + ') 뒤라 실제 취득일·취득가액 그대로', 근거일)); return jmWrap_('의제취득', reqs, { 의제취득일: 의제일, 적용: false }); }
  reqs.push(jmReq_('의제취득일 전 취득', true, 취득일 + ' 취득 → ' + 의제일 + '에 취득한 것으로 봄(보유기간·취득가액 모두 그날 기준)', 근거일));
  const 양가 = n(p.양도가액), 양기 = n(p.양도기준시가), 의기 = n(p.의제기준시가);
  const 사례 = n(p.의제매매사례), 감정 = n(p.의제감정);
  // 1호 — §176의2③을 순서대로(1호 매매사례 → 2호 감정 → 3호 환산)
  let v1 = 0, v1법 = '';
  if (사례 > 0) { v1 = 사례; v1법 = '매매사례가액(③1호)'; }
  else if (감정 > 0) { v1 = 감정; v1법 = '감정가액(③2호)'; }
  else if (양가 && 양기 && 의기) { v1 = Math.floor(양가 * 의기 / 양기 + 1e-6); v1법 = '환산취득가액(③3호 = 양도가액 ' + 양가.toLocaleString('ko-KR') + ' × 의제취득일 기준시가 ' + 의기.toLocaleString('ko-KR') + ' ÷ 양도 당시 기준시가 ' + 양기.toLocaleString('ko-KR') + ')'; }
  reqs.push(jmReq_('1호 의제취득일 현재 가액', v1 ? true : null, v1 ? v1.toLocaleString('ko-KR') + '원 — ' + v1법 : '양도가액·양도 당시 기준시가·의제취득일 기준시가가 없어 환산 못 함', '소득세법 시행령 §176의2④1호·③'));
  if (!v1) 할일.push({ 무엇: '의제취득일(' + 의제일 + ') 현재 기준시가 — 토지는 1990.8.30. 전이면 1990.1.1. 개별공시지가와 토지등급(토지대장)으로 환산(시행령 §164④, 세액계산 화면 「1990년 전 기준시가」)', 때: '신고 전', 근거: '소득세법 시행령 §176의2②2호·§164' });
  // 2호 — 실지취득가액 + 물가상승분
  const 실가 = n(p.실지취득가액);
  let rate = null;
  if (p.물가상승률 != null && p.물가상승률 !== '') { const s = String(p.물가상승률); rate = Number(s.replace(/[^0-9.\-]/g, '')); if (/%/.test(s) || rate > 3) rate = rate / 100; if (!isFinite(rate)) rate = null; }
  else if (p.물가지수 && Number(p.물가지수.취득) > 0 && Number(p.물가지수.의제직전) > 0) rate = Number(p.물가지수.의제직전) / Number(p.물가지수.취득) - 1;
  let v2 = 0;
  if (실가 > 0 && rate != null) { v2 = Math.floor(실가 * (1 + rate) + 1e-6); }
  reqs.push(jmReq_('2호 실제 취득가액 + 물가상승분', 실가 > 0 ? (rate != null ? true : null) : true,
    실가 > 0 ? (rate != null ? 실가.toLocaleString('ko-KR') + ' + ' + 실가.toLocaleString('ko-KR') + ' × 생산자물가상승률 ' + (Math.round(rate * 10000) / 100) + '% = ' + v2.toLocaleString('ko-KR') + '원' + (p.실가근거 ? ' — 근거 ' + p.실가근거 : '') : '취득 당시 값 ' + 실가.toLocaleString('ko-KR') + '원은 있으나 물가상승률을 모름')
      : '취득 당시 실지거래가액이 확인되지 않아 2호 없음 — 1호로만',
    '소득세법 시행령 §176의2④2호'));
  if (실가 > 0 && rate == null) 할일.push({ 무엇: '생산자물가상승률 — 취득일(' + 취득일 + ')부터 ' + 의제일.slice(0, 4) + '.1.1. 직전일까지(한국은행 생산자물가지수) [확인 필요: 월 지수·연 지수 중 어느 것으로 재는지]', 때: '신고 전', 근거: '소득세법 시행령 §176의2④2호' });
  if (실가 > 0 && /상속|증여/.test(String(p.취득원인 || ''))) notes.push('상속·증여받은 자산의 「취득 당시 실지거래가액」은 상속개시일·증여일 현재 상증법 평가액(시행령 §163⑨) — 그 평가액이 확인될 때만 2호로 봄 [확인 필요]');
  const 취득가액 = Math.max(v1, v2);
  const 고른 = !취득가액 ? '' : v2 > v1 ? '2호' : '1호';
  if (취득가액) reqs.push(jmReq_('의제취득일 현재 취득가액', (v1 && (실가 === 0 || rate != null)) ? true : null, 취득가액.toLocaleString('ko-KR') + '원(' + 고른 + (v1 && v2 ? ' — 1호 ' + v1.toLocaleString('ko-KR') + ' / 2호 ' + v2.toLocaleString('ko-KR') + ' 중 많은 것' : '') + ')', '소득세법 시행령 §176의2④'));
  // 엔진 칸 — 취득가액이 추계(§97①1호나목)라 필요경비는 개산공제(의제취득일 기준시가 × 3%, 시행령 §163⑥), 환산이면 §97②2호 단서(실제 비용이 더 크면)
  const 바탕 = function () {
    const c = { transferPrice: 양가, transferDate: 양도일, assetType: 'other', acquisitionDate: 취득일, acquisitionCause: /상속/.test(String(p.취득원인 || '')) ? 'inheritance' : /증여/.test(String(p.취득원인 || '')) ? 'gift' : 'purchase' };
    if (jmYn_(p.미등기) === true) c.isUnregisteredTransfer = true;
    return c;
  };
  if (주식 && 취득가액) notes.push('주식은 주식 양도 계산기로 — 취득가액 칸에 ' + 취득가액.toLocaleString('ko-KR') + '원을 넣을 것(부동산 계산 칸은 내지 않음)');
  if (!주식 && 양가 && 양도일 && 취득가액) {
    const c = 바탕();
    if (의기) c.acquisitionStandardPriceForConversion = 의기;
    if (양기) c.transferStandardPriceForConversion = 양기;
    if (고른 === '1호' && v1법.indexOf('환산') === 0) { if (n(p.필요경비)) c.necessaryExpenses = n(p.필요경비); }
    else if (고른 === '1호' && v1법.indexOf('감정') === 0) c.appraisalValue = 취득가액;
    else c.comparableTransactionPrice = 취득가액; // 매매사례 또는 2호 — 엔진은 추계 가액으로 보고 필요경비를 개산공제로 함
    경우.push({ 이름: '① 법대로 — 의제취득일 현재 취득가액 ' + 취득가액.toLocaleString('ko-KR') + '원(' + 고른 + ')', 엔진: 'calculate_transfer_tax', 엔진칸: c });
    if (실가 > 0) { const w = 바탕(); w.acquisitionPrice = 실가; if (n(p.필요경비)) w.necessaryExpenses = n(p.필요경비); 경우.push({ 이름: '② 잘못 — 옛 계약서 값 ' + 실가.toLocaleString('ko-KR') + '원을 그대로 취득가액으로', 엔진: 'calculate_transfer_tax', 엔진칸: w, 잘못: true }); }
    if (고른 === '2호' && v1) { const w3 = 바탕(); if (의기) w3.acquisitionStandardPriceForConversion = 의기; if (양기) w3.transferStandardPriceForConversion = 양기; if (v1법.indexOf('환산') !== 0) w3.comparableTransactionPrice = v1; else if (n(p.필요경비)) w3.necessaryExpenses = n(p.필요경비); 경우.push({ 이름: '③ 잘못 — 1호(' + v1법.replace(/\(.*$/, '') + ')만 보고 2호를 안 견줌', 엔진: 'calculate_transfer_tax', 엔진칸: w3, 잘못: true }); }
  }
  if (고른 === '2호') notes.push('2호 가액도 추계(§97①1호나목)라 필요경비는 개산공제(의제취득일 기준시가 × 3%, 시행령 §163⑥) — 환산에만 있는 §97②2호 단서(실제 비용이 더 크면 그 금액)가 2호에도 미치는지 [확인 필요]');
  if (!의기) notes.push('개산공제의 「취득 당시 기준시가」는 의제취득일 현재 기준시가 — 없으면 필요경비 0으로 계산됨');
  notes.push('장기보유특별공제 보유기간도 ' + 의제일 + '부터(§95④·부칙 §8) — 엔진은 취득일이 그 전이면 스스로 의제취득일로 셈' + (주식 ? ' [확인 필요: 엔진은 주식도 1985.1.1.로 셈 — 주식은 장기보유특별공제가 없어 세액엔 영향 없음]' : ''));
  notes.push('8년 자경·비사업용 토지 판정의 보유·경작 기간은 실제 취득일 기준(의제 아님) — 「8년자경」·「비사업용 토지」 판정은 실제 취득일을 넣을 것');
  return jmWrap_('의제취득', reqs, { 의제취득일: 의제일, 적용: true, 일호: v1 || null, 일호방법: v1법 || null, 이호: v2 || null, 물가상승률: rate, 취득가액: 취득가액 || null, 고른: 고른 || null, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 87 「육씨 재개발 현금청산」] 정비사업 현금청산·매도청구 — 감면 호·양도시기·주택인지·지연이자 가르기
//  조특법 §77①: 사업인정고시일(그 전 양도면 양도일)부터 소급 2년 이전 취득 토지등을 2026.12.31.까지 양도 → 1호 공익사업 시행자에게 양도 / 2호 「도시 및 주거환경정비법」
//   정비구역(정비기반시설을 수반하지 아니하는 정비구역 제외)의 토지등을 사업시행자에게 양도 / 3호 수용. ⑥ 1·2호 감면신청은 사업시행자, ⑦ 3호는 본인(시행령 §72⑦⑧).
//   ③2호 사업시행계획인가·사업완료를 기한까지 못 하면 사업시행자가 감면세액을 냄. ⑨ 상속·이월과세 증여 자산은 앞사람 취득일
//  소득세법 시행령 §162①7호: 수용이면 대금청산일·수용개시일·소유권이전등기접수일 중 빠른 날(소유권 소송으로 공탁되면 판결 확정일), 그 밖엔 1·2호(대금청산일·등기접수일 중 빠른 날)
//  p: { 사업(재개발|재건축|주거환경개선|가로주택|소규모재건축|기타), 정비기반시설(예/아니오/모름), 상대(조합|사업시행자|기타), 방식(협의|수용재결|매도청구),
//       고시일(사업시행계획인가 고시일), 분양신청(함|안함|철회|제외), 취득일, 취득원인(매매|상속|증여), 앞사람취득일, 이월과세(예),
//       잔금일, 등기접수일, 수용개시일, 공탁소송(예), 판결확정일, 주택(예 — 원래 주택), 멸실일, 일주택(예/아니오/모름 — 멸실 안 됐을 때 1세대1주택인지), 거주연수,
//       청산금, 지연이자, 이주비, 주거이전비, 이사비, 취득가액, 필요경비, 채권(예 — 보상채권으로 받음) }
function judgeRedevCash_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 사업 = String(p.사업 || ''), 방식 = String(p.방식 || '협의'), 상대 = String(p.상대 || '조합');
  if (/^함$|신청함|조합원/.test(String(p.분양신청 || ''))) {
    reqs.push(jmReq_('현금청산 대상', false, '분양신청을 해 조합원입주권을 받음 — 현금청산이 아니라 입주권(관리처분계획인가 뒤 양도는 입주권 양도, 소득세법 §88 9호·§89①4호)', '소득세법 §88 9호'));
    return jmWrap_('정비청산', reqs, { 적용: false, 알림: ['입주권 양도는 「1세대1주택」 판정(입주권 특례 §89①4호·시행령 §156의2)으로'] });
  }
  // 1) 양도일 — 수용재결이면 7호, 협의·매도청구는 1·2호
  const 잔 = jmYmd_(p.잔금일), 등 = jmYmd_(p.등기접수일), 수 = jmYmd_(p.수용개시일), 판 = jmYmd_(p.판결확정일);
  const 빠른 = function (a) { a = a.filter(Boolean).sort(); return a[0] || ''; };
  let 양도일 = '', 시기왜 = '', 시기근거 = '';
  if (/수용/.test(방식)) {
    if (jmYn_(p.공탁소송) === true) { 양도일 = 판; 시기왜 = '소유권 소송으로 보상금 공탁 → 판결 확정일'; }
    else { 양도일 = 빠른([잔, 수, 등]); 시기왜 = '수용재결 → 대금청산일·수용개시일·등기접수일 중 빠른 날'; }
    시기근거 = '소득세법 시행령 §162①7호';
  } else {
    양도일 = 빠른([잔, 등]); 시기왜 = (/매도청구/.test(방식) ? '매도청구(재건축) — 판결로 이전돼도 수용이 아니어서 ' : '협의 현금청산 — ') + '대금청산일·등기접수일 중 빠른 날';
    시기근거 = '소득세법 §98·시행령 §162①1·2호' + (/매도청구/.test(방식) ? ' [확인 필요: 매도청구 판결 뒤 공탁된 경우의 대금청산일]' : '');
  }
  reqs.push(jmReq_('양도일', 양도일 ? true : null, 양도일 ? 양도일 + ' — ' + 시기왜 : '잔금일·등기접수일' + (/수용/.test(방식) ? '·수용개시일' : '') + '이 없어 못 정함', 시기근거));
  if (!양도일) 할일.push({ 무엇: '청산금 받은 날(통장)·소유권이전 등기접수일' + (/수용/.test(방식) ? '·수용재결서의 수용개시일·공탁서' : ''), 때: '신고 전', 근거: 시기근거 });
  // 2) 감면 — 어느 호인가
  const 도정법 = /재개발|재건축|주거환경/.test(사업);
  const 소규모 = /가로|소규모|빈집/.test(사업);
  const 시행자 = /조합|사업시행자|시행자|LH|공사/.test(상대);
  const 기반 = jmYn_(p.정비기반시설);
  let 호 = '', 감면왜 = '', 감면됨 = false, 감면잠정 = false;
  if (!시행자) { 감면왜 = '사업시행자(조합)가 아닌 사람에게 판 것 — §77 감면 없음'; }
  else if (/수용/.test(방식)) { 호 = '3호'; 감면됨 = true; 감면왜 = '수용재결로 넘어감 → §77①3호(수용)' + (도정법 && 기반 === false ? ' — 정비기반시설이 없어 2호는 안 되지만 수용이면 3호' : ''); }
  else if (도정법) {
    if (기반 === true) { 호 = '2호'; 감면됨 = true; 감면왜 = 사업 + ' 정비구역(정비기반시설 수반)의 토지등을 사업시행자에게 양도 → §77①2호' + (/매도청구/.test(방식) ? ' — 매도청구로 넘긴 것도 사업시행자에게 양도 [확인 필요: 매도청구분을 2호로 보는지 예규]' : ''); }
    else if (기반 === false) { 감면왜 = '정비기반시설을 수반하지 않는 정비구역 — 2호에서 빠짐(§77①2호 괄호), 수용도 아니라 감면 없음'; }
    else { 호 = '2호'; 감면됨 = true; 감면잠정 = true; 감면왜 = '정비기반시설 수반 여부를 모름 — 수반하면 2호, 아니면 감면 없음(잠정으로 2호)'; 할일.push({ 무엇: '정비계획 결정 고시문 — 정비기반시설(도로·공원 등) 설치 계획이 있는지', 때: '신고 전', 근거: '조특법 §77①2호 괄호' }); }
  }
  else if (소규모) { 감면왜 = '「빈집 및 소규모주택 정비에 관한 특례법」 사업 — 「도시 및 주거환경정비법」 정비구역이 아니라 2호 아님, 수용도 아니어서 감면 없음 [확인 필요]'; }
  else { 감면왜 = '사업 종류를 몰라 감면 호를 못 가림'; 감면잠정 = true; 할일.push({ 무엇: '사업 종류(재개발·재건축·주거환경개선·가로주택 등) — 조합 설립인가서·정비구역 지정 고시', 때: '신고 전', 근거: '조특법 §77①' }); }
  // 2년 요건·기한
  const 고시 = jmYmd_(p.고시일);
  const 앞 = jmYmd_(p.앞사람취득일), 취 = jmYmd_(p.취득일);
  const 상속증여 = /상속/.test(String(p.취득원인 || '')) || (/증여/.test(String(p.취득원인 || '')) && jmYn_(p.이월과세) === true);
  const 재는취득 = 상속증여 && 앞 ? 앞 : 취;
  if (감면됨) {
    const 기준 = 고시 && (!양도일 || 고시 <= 양도일) ? 고시 : 양도일;
    const 년 = function (a, b) { if (!a || !b) return null; let y = Number(b.slice(0, 4)) - Number(a.slice(0, 4)); if (b.slice(5) < a.slice(5)) y--; return y; };
    const y = 년(재는취득, 기준);
    if (y == null) { 감면잠정 = true; 할일.push({ 무엇: '사업시행계획인가 고시일(도시정비법상 사업인정고시로 봄)·취득일', 때: '신고 전', 근거: '조특법 §77①' }); }
    else if (y < 2) { 감면됨 = false; 감면왜 += ' — 그러나 ' + (고시 && 기준 === 고시 ? '고시일(' + 고시 + ')' : '양도일') + '부터 소급 2년 이전 취득이 아님(' + 재는취득 + ') → 감면 없음'; }
    reqs.push(jmReq_('2년 전 취득', y == null ? null : true, (y == null ? '모름' : 재는취득 + ' 취득 → 기준일 ' + 기준 + '까지 ' + y + '년') + (상속증여 && 앞 ? ' (앞사람 취득일, §77⑨)' : '') + (고시 ? '' : ' — 고시일이 없어 양도일로 셈'), '조특법 §77①·⑨ · 도시정비법 §65②(사업시행계획인가 고시 = 사업인정고시로 봄 — 법령 폴더에 원문 없음 [확인 필요])'));
    if (양도일 && 양도일 > '2026-12-31') { 감면됨 = false; 감면왜 += ' — 2026.12.31. 뒤 양도라 감면 기한 지남'; }
  }
  reqs.push(jmReq_('§77 감면', 감면잠정 ? null : true, (감면됨 ? '감면 — ' : '감면 없음 — ') + (호 && 감면됨 ? 호 + ' — ' : '') + 감면왜, '조특법 §77①'));
  if (감면됨) 할일.push({ 무엇: 호 === '3호' ? '세액감면신청서 — 본인이 확정(예정)신고 때 수용 확인 서류와 함께 내야 함' : '세액감면신청서 — 사업시행자(조합)가 내는 것(§77⑥). 조합에 신청 여부·사본을 받아 둘 것', 때: '신고 때', 근거: 호 === '3호' ? '조특법 §77⑦·시행령 §72⑧' : '조특법 §77⑥·시행령 §72⑦' });
  if (감면됨 && 호 === '2호') notes.push('사업시행자가 지정일부터 1년 안에 사업시행계획인가를 못 받거나 공사완료일까지 사업을 못 끝내면 감면세액을 사업시행자가 냄(§77③2호·시행령 §72⑤) — 양도자에게 다시 걷지 않음');
  // 3) 주택인가 — 양도일 현재
  const 멸 = jmYmd_(p.멸실일);
  const 원주택 = jmYn_(p.주택) === true;
  let 주택 = false, 비과세 = false, 주택잠정 = false;
  if (원주택) {
    if (멸 && 양도일 && 멸 <= 양도일) { 주택 = false; reqs.push(jmReq_('양도일 현재 주택', true, '아님 — 주택을 ' + 멸 + '에 헐고 ' + 양도일 + '에 넘김 — 양도일 현재 주택이 아니라 토지 양도(1세대1주택 비과세 안 됨) [확인 필요: 멸실 뒤 현금청산을 토지 양도로 보는 예규]', '소득세법 §89①3호·시행령 §154①')); }
    else if (!멸) { 주택 = true; 주택잠정 = !양도일; reqs.push(jmReq_('양도일 현재 주택', true, '헐기 전에 넘김(또는 멸실일 모름 — 건축물대장 말소일 확인)', '소득세법 §89①3호')); if (!jmYmd_(p.멸실일)) 할일.push({ 무엇: '건축물대장(말소 여부·말소일) — 양도일 전에 헐렸으면 토지 양도', 때: '신고 전', 근거: '소득세법 §89①3호' }); }
    else { 주택 = true; reqs.push(jmReq_('양도일 현재 주택', true, '멸실일(' + 멸 + ')이 양도일 뒤 — 주택 양도', '소득세법 §89①3호')); }
    if (주택) {
      const 일 = jmYn_(p.일주택);
      비과세 = 일 === true;
      reqs.push(jmReq_('1세대1주택', 일 == null ? null : true, 일 === true ? '1세대1주택 — 12억 넘는 몫만 과세' : 일 === false ? '1세대1주택 아님' : '모름 — 「세대판정」·「1세대1주택」 판정으로', '소득세법 §89①3호·시행령 §154'));
      if (일 === true && 고시 && 재는취득 && 재는취득 < 고시) notes.push('사업인정고시일 전 취득 주택이 협의매수·수용되면 보유·거주 기간 제한이 없음(시행령 §154①2호가목) — 정비사업 현금청산이 이 「협의매수·수용」에 드는지 [확인 필요]. 엔진은 보유 2년이 넘으면 따로 볼 것 없음');
    }
  }
  if (!주택) notes.push('토지 양도면 비사업용 토지인지 「비사업용 토지」 판정으로 — 협의매수·수용 토지는 취득일이 사업인정고시일부터 5년 이전이면 사업용으로 봄(시행령 §168의14③3호나목); 멸실 뒤 나대지 기간만으로 비사업용이 되지 않는지 함께 볼 것');
  // 4) 양도가액에 넣을 것·뺄 것
  const 청 = n(p.청산금), 지연 = n(p.지연이자), 이주 = n(p.이주비), 주거 = n(p.주거이전비) + n(p.이사비);
  reqs.push(jmReq_('양도가액', 청 ? true : null, 청 ? won(청) + '원(청산금만)' + (지연 ? ' — 지연이자 ' + won(지연) + '원 뺌' : '') + (이주 ? ' · 이주비 ' + won(이주) + '원 뺌' : '') + (주거 ? ' · 주거이전비·이사비 ' + won(주거) + '원 뺌' : '') : '청산금을 모름', '소득세법 §96①'));
  if (지연) notes.push('현금청산 지연이자(도시정비법 §73③)는 양도대가가 아님 — 양도가액에 넣지 않음. 소득 구분(기타소득 등)은 [확인 필요]');
  if (이주) notes.push('이주비는 조합이 빌려준 돈(대여금) — 청산금에서 갚으면 그 몫도 청산금 전액이 양도가액, 따로 받은 이주비를 더하지 않음');
  if (주거) notes.push('주거이전비·이사비는 토지보상법 §78에 따른 이주 보상 — 토지·건물 대가가 아니어서 양도가액에 넣지 않음(종류별은 「수용보상금」 판정)');
  // 엔진 칸
  const 바탕 = function () {
    const c = { transferPrice: 청, transferDate: 양도일, assetType: 주택 ? 'house' : 'other', acquisitionDate: 취, acquisitionPrice: n(p.취득가액), necessaryExpenses: n(p.필요경비), acquisitionCause: /상속/.test(String(p.취득원인 || '')) ? 'inheritance' : /증여/.test(String(p.취득원인 || '')) ? 'gift' : 'purchase' };
    if (/상속/.test(String(p.취득원인 || '')) && 앞) { c.isInheritedAsset = true; c.decedentAcquisitionDate = 앞; }
    if (고시) c.publicNoticeDate = 고시;
    return c;
  };
  if (청 && 양도일 && 취) {
    const c = 바탕();
    if (감면됨) c.compensationType = jmYn_(p.채권) === true ? 'bond' : 'cash';
    if (주택 && 비과세) { c.isOneHouseOneFamily = true; if (p.거주연수 != null && p.거주연수 !== '') c.residenceYears = Number(p.거주연수); }
    경우.push({ 이름: '① 법대로 — 청산금 ' + won(청) + '원 · ' + (주택 ? (비과세 ? '1세대1주택' : '주택') : '토지') + ' · ' + (감면됨 ? '§77①' + 호 + ' 감면' + (감면잠정 ? '(잠정)' : '') : '감면 없음'), 엔진: 'calculate_transfer_tax', 엔진칸: c });
    if (지연 || 이주 || 주거) { const w = Object.assign({}, c, { transferPrice: 청 + 지연 + 이주 + 주거 }); 경우.push({ 이름: '② 잘못 — 지연이자·이주비·이전비까지 양도가액에(' + won(청 + 지연 + 이주 + 주거) + '원)', 엔진: 'calculate_transfer_tax', 엔진칸: w, 잘못: true }); }
    if (!감면됨 && 시행자) { const w2 = Object.assign({}, c, { compensationType: 'cash' }); 경우.push({ 이름: '③ 잘못 — 감면 요건이 없는데 수용 감면을 붙임', 엔진: 'calculate_transfer_tax', 엔진칸: w2, 잘못: true }); }
    if (원주택 && !주택 && jmYn_(p.일주택) === true) { const w3 = Object.assign({}, c, { assetType: 'house', isOneHouseOneFamily: true }); if (p.거주연수 != null && p.거주연수 !== '') w3.residenceYears = Number(p.거주연수); 경우.push({ 이름: '④ 잘못 — 헐린 뒤 넘겼는데 1세대1주택 비과세로', 엔진: 'calculate_transfer_tax', 엔진칸: w3, 잘못: true }); }
  }
  if (감면됨) notes.push('§77 감면세액의 20%는 농어촌특별세(직접 경작 농지 수용만 비과세 — 농특세법 시행령 §4①1호), 감면 한도(조특법 §133) — 엔진이 셈');
  return jmWrap_('정비청산', reqs, { 적용: true, 양도일: 양도일 || null, 감면호: 감면됨 ? 호 : null, 감면: 감면됨, 주택: 주택, 비과세: 비과세, 양도가액: 청 || null, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 88 「주씨 한 해 세 번 양도」] 예정신고를 따로 한 뒤 확정신고를 해야 하나 — 소득세법 §110④ 단서·시행령 §173⑤
//  §110④ 본문: 예정신고를 한 자는 확정신고를 하지 아니할 수 있다. 단서·시행령 §173⑤: 다음이면 확정신고 해야 함
//   1호 그 해 누진세율 자산을 2회 이상 예정신고하면서 §107②(이미 신고한 소득금액과 합산)로 신고하지 않은 경우
//   2호 토지·건물·부동산 권리·기타자산·신탁 수익권을 2회 이상 양도 — §103②(기본공제 순서)를 적용하면 당초 산출세액이 달라지는 경우
//   3호 주식등(§94①3호가·나목)을 2회 이상 양도 — §103②를 적용하면 달라지는 경우
//   4호 토지·건물·부동산 권리·기타자산을 둘 이상 양도 — §104⑤(비교과세)를 적용하면 달라지는 경우
//  p: { 연도, 거래:[{ 이름, 자산(토지|건물|주택|권리|기타자산|주식|신탁수익권), 양도일, 취득일, 미등기(예), 예정신고(예|아니오), 예정신고일, 합산신고(예 — §107②로 앞 건과 합산해 신고),
//        예정산출세액(그 예정신고서 산출세액), 예정납부세액, 엔진칸(그 거래의 calculate_transfer_tax 칸) }],
//      합산산출세액(calculate_transfer_tax_multi로 돌린 그 해 산출세액 합계 — 비우면 엔진 경우를 먼저 돌릴 것), 확정신고(함|안함|아직), 납부일(가산세 셀 때), 토지허가일 }
function judgeFinalReturn_(p) {
  p = p || {};
  const n = function (v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0); };
  const won = function (v) { return Math.round(Number(v) || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 거래 = (Array.isArray(p.거래) ? p.거래 : []).filter(function (t) { return t; });
  const 근거본 = '소득세법 §110①④, 시행령 §173⑤';
  if (!거래.length) { reqs.push(jmReq_('그 해 양도 목록', null, '거래가 없어 판정 못 함', 근거본)); return jmWrap_('확정신고', reqs, { 할일: [{ 무엇: '그 해(1.1.~12.31.) 양도한 자산 전부 — 양도일·자산 종류·예정신고서(산출세액)', 때: '판정 전', 근거: 근거본 }] }); }
  const 연도 = String(p.연도 || (jmYmd_(거래[0].양도일) || '').slice(0, 4));
  const 기한 = p.토지허가일 ? (Number(String(jmYmd_(p.토지허가일)).slice(0, 4)) + 1) + '-05-31' : (연도 ? (Number(연도) + 1) + '-05-31' : '');
  const 주식 = function (t) { return /주식|출자/.test(String(t.자산 || '')); };
  const 부동산류 = function (t) { return !주식(t); };
  // 누진세율(§104①1호 기본세율·8호 비사업용·⑦ 중과 등 — 「기본세율 + 가산」 포함) 대상인지 — 보유 2년 미만(단기 비례세율)·미등기(70%)는 비례
  const 누진 = function (t) {
    if (주식(t) || jmYn_(t.미등기) === true) return false;
    const a = jmYmd_(t.취득일), d = jmYmd_(t.양도일);
    if (!a || !d) return null;
    const y2 = String(Number(a.slice(0, 4)) + 2) + a.slice(4);
    return d >= y2;
  };
  const 예정함 = 거래.filter(function (t) { return jmYn_(t.예정신고) === true; });
  const 예정안함 = 거래.filter(function (t) { return jmYn_(t.예정신고) === false; });
  const 예정모름 = 거래.filter(function (t) { return jmYn_(t.예정신고) === null; });
  // §110① — 예정신고를 하지 않은 양도가 있으면 ④ 본문(면제)이 미치지 않음
  if (예정안함.length) reqs.push(jmReq_('예정신고 안 한 양도', true, 예정안함.map(function (t) { return t.이름 || t.양도일; }).join('·') + ' — 예정신고를 안 했으니 확정신고(§110①)로 신고해야 함(§110④ 본문 면제는 예정신고를 한 자만)', '소득세법 §105①·§110①④'));
  if (예정모름.length) reqs.push(jmReq_('예정신고 여부', null, 예정모름.map(function (t) { return t.이름 || t.양도일; }).join('·') + ' — 예정신고를 했는지 모름', '소득세법 §105·§110④'));
  // 1호
  const 누진예정 = 예정함.filter(function (t) { return 누진(t) === true; });
  const 합산안함 = 누진예정.slice(1).filter(function (t) { return jmYn_(t.합산신고) !== true; });
  const 일호 = 누진예정.length >= 2 && 합산안함.length > 0;
  if (누진예정.length >= 2) reqs.push(jmReq_('1호 누진세율 자산 예정신고 2회 이상', 일호 ? true : (합산안함.length === 0 && 누진예정.slice(1).every(function (t) { return jmYn_(t.합산신고) === true; }) ? true : null),
    일호 ? '누진세율 자산 예정신고 ' + 누진예정.length + '회 — 뒤 신고(' + 합산안함.map(function (t) { return t.이름 || t.양도일; }).join('·') + ')를 §107②로 앞 건과 합산하지 않음 → 확정신고 해야 함'
      : '누진세율 자산 예정신고 ' + 누진예정.length + '회 — 뒤 신고를 모두 §107②로 합산해 신고함(1호 아님, 2·4호는 따로 봄)', '소득세법 시행령 §173⑤1호·소득세법 §107②'));
  // 2·4호 — 부동산류 2건 이상: 합산(§103②·§104⑤)한 산출세액과 예정신고 산출세액 합을 견줌
  const 부건 = 거래.filter(부동산류), 주건 = 거래.filter(주식);
  const 예정합 = 거래.reduce(function (s, t) { return s + n(t.예정산출세액); }, 0);
  const 예정납부합 = 거래.reduce(function (s, t) { return s + n(t.예정납부세액 != null && t.예정납부세액 !== '' ? t.예정납부세액 : t.예정산출세액); }, 0);
  const 합산 = p.합산산출세액 != null && p.합산산출세액 !== '' ? n(p.합산산출세액) : null;
  const 예정다있음 = 예정함.length === 거래.length && 거래.every(function (t) { return t.예정산출세액 != null && t.예정산출세액 !== ''; });
  let 다름 = null;
  if (합산 !== null && 예정다있음) 다름 = 합산 !== 예정합;
  const 이미의무 = 예정안함.length > 0 || 일호;
  if (부건.length >= 2) reqs.push(jmReq_('2·4호 부동산 등 2건 이상 — 합산하면 세액이 달라지나', 다름 === null ? (이미의무 ? true : null) : true,
    다름 === null && 이미의무 ? '확정신고 의무는 ' + (예정안함.length ? '예정신고 안 한 양도' : '1호') + '로 이미 정해짐 — 합산 세액은 ① 경우로 셈' : 다름 === null ? '그 해 합산 산출세액(calculate_transfer_tax_multi)과 각 예정신고 산출세액이 있어야 견줌 — 아래 ① 경우를 돌려 「합산산출세액」에 넣을 것'
      : 다름 ? '합산 산출세액 ' + won(합산) + '원 ≠ 예정신고 산출세액 합 ' + won(예정합) + '원(차이 ' + won(합산 - 예정합) + '원) → 확정신고 해야 함(기본공제 순서 §103②·비교과세 §104⑤ — 2호·4호)'
        : '합산 산출세액 = 예정신고 산출세액 합(' + won(합산) + '원) — 2·4호 아님', '소득세법 시행령 §173⑤2호·4호, 소득세법 §103②·§104⑤'));
  if (주건.length >= 2) { reqs.push(jmReq_('3호 주식 2회 이상', null, '주식 ' + 주건.length + '건 — §103②(기본공제 순서)로 당초 산출세액이 달라지면 확정신고 [이 판정은 주식 묶음 세액을 견주지 않음 — 주식 양도 계산기로 확인]', '소득세법 시행령 §173⑤3호')); }
  if (부건.length && 주건.length) notes.push('부동산 등과 주식은 기본공제(각 250만원)·세율이 따로라(§103①, §102①) 서로 합산하지 않음 — 확정신고는 한 신고서에 함께');
  const 의무 = 예정안함.length > 0 || 일호 || 다름 === true;
  const 모름 = !의무 && (예정모름.length > 0 || (부건.length >= 2 && 다름 === null) || 주건.length >= 2);
  reqs.push(jmReq_('확정신고 의무', 의무 ? true : (모름 ? null : true), 의무 ? '확정신고 해야 함 — 기한 ' + (기한 || '다음 해 5.31.') + (p.토지허가일 ? '(토지거래허가 전 대금청산 — 허가일이 속한 해의 다음 해, §110①)' : '')
    : 모름 ? '아직 못 가림 — 남은 것을 채울 것' : '예정신고로 끝남(§110④ 본문) — 확정신고 안 해도 됨', 근거본));
  const 추가 = (합산 !== null && 예정다있음) ? 합산 - 예정합 : null;
  if (추가 !== null && 추가 < 0) notes.push('합산하면 산출세액이 ' + won(-추가) + '원 줄어듦(양도차손 통산 §102②·기본공제 등) — 확정신고(또는 기한 뒤 경정청구 국세기본법 §45의2)로 돌려받음');
  // 엔진 경우 — calculate_transfer_tax_multi
  const 칸들 = 거래.map(function (t) { return t.엔진칸; }).filter(function (c) { return c && typeof c === 'object'; });
  if (칸들.length === 거래.length && 거래.length >= 2) {
    const 다음해 = 연도 ? (Number(기한.slice(0, 4))) + '-06-01' : '';
    경우.push({ 이름: '① 법대로 — 확정신고 기한(' + 기한 + ')까지 합산해 신고·납부(예정 때 낸 ' + won(예정납부합) + '원은 기납부)', 엔진: 'calculate_transfer_tax_multi', 엔진칸: { transactions: 칸들, filingStatus: 'ontime', preliminaryTaxPaid: 예정납부합 } });
    if (추가 !== null && 추가 > 0 && 다음해) {
      const 납부일 = jmYmd_(p.납부일) || '';
      const base = { transactions: 칸들, filingStatus: 'underreported', underreportedTaxAmount: 추가, preliminaryTaxPaid: 예정납부합, unpaidStartDate: 다음해, unpaidTaxForLatePenalty: 추가 };
      if (납부일) base.paidDate = 납부일;
      경우.push({ 이름: '② 확정신고를 안 함 — 과소신고로 볼 때(예정신고는 했으므로, 국세기본법 §47의3①) 추가 ' + won(추가) + '원 × 10% + 납부지연(' + 다음해 + '부터' + (납부일 ? ' ' + 납부일 + '까지' : '') + ')', 엔진: 'calculate_transfer_tax_multi', 엔진칸: base, 잘못: true });
      notes.push('확정신고를 안 했을 때 그 추가세액에 무신고가산세(§47의2, 20%)를 붙이는지 과소신고가산세(§47의3, 10%)를 붙이는지 법문에 따로 없음 — ② 과소로 계산, 무신고로 보면 가산세 ' + won(Math.round(추가 * 0.2)) + '원 [확인 필요: 국세청 예규]');
    }
  } else if (거래.length >= 2) 할일.push({ 무엇: '거래마다 계산 칸(엔진칸) — 그 해 합산 계산(calculate_transfer_tax_multi)을 돌려 「합산산출세액」에 넣기', 때: '판정 전', 근거: '소득세법 §92·§103②·§104⑤' });
  // 예정신고 가산세 — 예정신고를 안 했으면 예정신고 기한 기준으로 가산세(국세기본법 §47의2① 괄호 「예정신고 포함」), 확정 때 같은 몫은 겹쳐 붙이지 않음(⑤)
  if (예정안함.length) notes.push('예정신고를 안 한 양도는 예정신고 기한(양도일이 속한 달 말일부터 2개월, §105①1호)을 넘긴 때부터 무신고가산세·납부지연가산세 대상(국세기본법 §47의2①·§47의4①) — 같은 몫은 확정신고 때 다시 붙이지 않음(§47의2⑤·§47의4⑤). 확정신고 기한까지 신고하면 감면되는지(§48②) [확인 필요]');
  if (주건.length) notes.push('주식 예정신고 기한은 양도일이 속한 반기 말일부터 2개월(§105①2호)');
  if (거래.some(function (t) { return /부담부/.test(String(t.이름 || '') + String(t.자산 || '')); })) notes.push('부담부증여의 채무 몫은 예정신고 기한이 양도일이 속한 달 말일부터 3개월(§105①3호)');
  notes.push('같은 해 양도차손은 같은 묶음(§102①) 안에서 먼저 통산(§102②, 시행령 §167의2) — 예정신고 때 통산 못 한 손실도 확정신고로 반영');
  if (의무) 할일.push({ 무엇: '양도소득 과세표준 확정신고서(별지 제84호) — 그 해 양도 ' + 거래.length + '건 합산, 예정신고 납부세액은 기납부로', 때: 기한 + '까지', 근거: '소득세법 §110①·시행령 §173' });
  if (의무 && jmYn_(p.확정신고) === false) 할일.push({ 무엇: '기한 뒤 신고(국세기본법 §45의3) — 빨리 낼수록 가산세 감면(§48②2호) [확인 필요: 감면 구간]', 때: '가능한 빨리', 근거: '국세기본법 §45의3·§48②' });
  return jmWrap_('확정신고', reqs, { 연도: 연도 || null, 기한: 기한 || null, 확정신고의무: 의무, 일호: 일호, 다름: 다름, 예정산출세액합: 예정합 || null, 예정납부세액합: 예정납부합 || null, 합산산출세액: 합산, 추가산출세액: 추가, 추가지방소득세: 추가 !== null ? Math.round(추가 * 0.1) : null, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 89 「노씨 미등기 넷」] 미등기양도자산인지 — 소득세법 §104③(미등기양도자산 = §94①1·2호 자산을 취득한 자가 취득 등기를 하지 않고 양도)·
//  시행령 §168①(빼 주는 자산 1~4·6·7호). 미등기면 세율 70%(§104①10호)·장기보유특별공제 배제(§95②)·기본공제 배제(§103①1호 단서)·
//  개산공제 0.3%(시행령 §163⑥)·비과세 배제(§91①)·감면 배제(조특법 §129②). 판정은 엔진 칸 isUnregisteredTransfer를 켤지 끌지만 정한다.
//  p: { 자산(토지|건물|주택|분양권|입주권|지상권|전세권|임차권|주식|기타), 취득원인(매매|상속|증여|신축|경매|환지|체비지), 취득일, 양도일,
//       등기(예|아니오 — 양도 당시 내 이름으로 취득 등기가 돼 있었나), 사유(장기할부|법률|법원|무허가|도시개발|체비지공사대가|부득이|없음),
//       사유설명, 자경8년(예)·농지대토(예)·농지교환(예), 일세대일주택(예 — §89①3호 요건 갖춤), 건축허가(없음), 건설사업자(예), 환지처분공고일, 엔진칸 }
function judgeUnregistered_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 자산 = String(p.자산 || ''), 원인 = String(p.취득원인 || ''), 사유 = String(p.사유 || '');
  const 양도일 = jmYmd_(p.양도일);
  const 근거 = '소득세법 §104③·시행령 §168①';
  const 효과 = '세율 70%(§104①10호)·장기보유특별공제 배제(§95②)·기본공제 배제(§103①1호 단서)·개산공제 0.3%(시행령 §163⑥)·비과세 배제(§91①)·감면 배제(조특법 §129②)';
  const ec = p.엔진칸 && typeof p.엔진칸 === 'object' ? p.엔진칸 : null;
  const 끝 = function (미등기, extra) {
    if (ec) {
      경우.push({ 이름: '① 법대로 — ' + (미등기 === true ? '미등기양도자산(70%)' : 미등기 === false ? '미등기 아님(일반 계산)' : '미등기로 잠정'), 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, ec, { isUnregisteredTransfer: 미등기 !== false }) });
      if (미등기 === false && jmYn_(p.등기) === false && !((extra || {}).빠진호 || []).some(function (h) { return h === '3호'; })) 경우.push({ 이름: '② 잘못 — 등기 안 했다고 무조건 미등기(70%)로 계산', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, ec, { isUnregisteredTransfer: true }) });
      if (미등기 !== false) 경우.push({ 이름: '② 잘못 — 미등기를 놓치고 일반 계산(공제·비과세·감면 붙음)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, ec, { isUnregisteredTransfer: false }) });
    }
    const w = jmWrap_('미등기', reqs, Object.assign({ 미등기: 미등기, 효과: 미등기 === false ? '' : 효과, 경우: 경우, 엔진칸늘: ec ? { isUnregisteredTransfer: 미등기 !== false } : null, 알림: notes, 할일: 할일 }, extra || {}));
    w.표시 = '미등기 — ' + (미등기 === true ? '미등기양도자산(70%)' : 미등기 === false ? '미등기 아님' + (w.빠진호 ? '(시행령 §168① ' + w.빠진호.join('·') + ')' : '') : '모름(잠정 미등기)' + (w.남은것.length ? ' — 남은 것: ' + w.남은것.map(function (x) { return x.split(' — ')[0]; }).join(', ') : ''));
    return w;
  };
  // 1. 대상 자산 — §94①1호(토지·건물)·2호(부동산에 관한 권리)만
  if (/주식|출자|기타|영업권|회원권|파생/.test(자산)) { reqs.push(jmReq_('대상 자산', false, 자산 + '은 §94①3호 이하 자산이라 미등기양도자산 규정이 없음', 근거)); return 끝(false); }
  if (/분양권|입주권|권리/.test(자산) && !/지상권|전세권|임차권/.test(자산)) {
    reqs.push(jmReq_('대상 자산', false, 자산 + '(부동산을 취득할 수 있는 권리, §94①2호가목)은 등기하는 권리가 아님 — 미등기양도자산으로 보지 않음', '소득세법 §104③ [확인 필요: 분양권 미등기 해당 여부 예규]'));
    notes.push('분양권·입주권 전매는 등기 대상이 아니어서 미등기로 보지 않았습니다 — 분양권 세율(§104①1호 단서)은 따로 봅니다 [확인 필요]');
    return 끝(false);
  }
  reqs.push(jmReq_('대상 자산', true, (자산 || '토지·건물') + ' — §94①1·2호 자산', 근거));
  // 2. 등기 여부
  const 등기 = jmYn_(p.등기);
  if (등기 === true) { reqs.push(jmReq_('취득 등기', false, '양도 당시 취득 등기가 돼 있음 — 미등기 아님', 근거)); return 끝(false); }
  if (등기 == null) {
    reqs.push(jmReq_('취득 등기', null, '양도 당시 내 이름으로 취득 등기가 돼 있었는지 모름', 근거));
    할일.push({ 무엇: '등기사항전부증명서(양도일 현재) — 갑구에 양도인 명의 소유권이전등기 접수일', 때: '신고 전', 근거: 근거 });
    return 끝(null);
  }
  reqs.push(jmReq_('취득 등기', true, '양도 당시 취득 등기를 하지 않음' + (/상속/.test(원인) ? '(상속등기 없이 양도)' : /증여/.test(원인) ? '(증여등기 없이 양도)' : ''), 근거));
  if (/상속/.test(원인)) notes.push('상속은 등기 없이도 사망일에 취득(민법 §187)하지만, 상속등기 없이 바로 양도하면 문언상 「취득 등기를 하지 아니하고 양도」에 듦 — 부득이한 사정이면 미등기로 보지 않은 판례가 있음 [확인 필요: 판례·예규]');
  // 3. 빼 주는 자산 — 시행령 §168①
  const 빼기 = [];
  if (/장기할부/.test(사유)) 빼기.push(['1호', '장기할부조건으로 취득해 계약조건상 양도 당시 등기가 불가능']);
  if (/법률|법원/.test(사유)) 빼기.push(['2호', '법률 규정 또는 법원 결정으로 양도 당시 등기가 불가능' + (p.사유설명 ? '(' + p.사유설명 + ')' : '')]);
  if (jmYn_(p.자경8년) === true || jmYn_(p.농지대토) === true || jmYn_(p.농지교환) === true) 빼기.push(['3호', (jmYn_(p.자경8년) === true ? '8년 자경 감면 농지(조특법 §69①)' : jmYn_(p.농지대토) === true ? '농지대토 감면 농지(조특법 §70①)' : '비과세 농지 교환·분합(§89①2호)')]);
  const 무허가 = /무허가/.test(사유) || /없음|아니오/.test(String(p.건축허가 || ''));
  if (무허가 && /주택/.test(자산)) {
    const 일주 = jmYn_(p.일세대일주택);
    if (일주 === true) 빼기.push(['4호', '1세대1주택 비과세 요건(§89①3호)을 갖춘 주택으로 건축허가를 받지 않아 등기가 불가능']);
    else if (일주 == null) { reqs.push(jmReq_('1세대1주택 요건(4호)', null, '건축허가 없는 주택 — 1세대1주택 비과세 요건을 갖추면 미등기에서 빠짐(4호)', '시행령 §168①4호')); 할일.push({ 무엇: '1세대1주택 판정(묶음 「1세대1주택」) — 갖추면 4호로 미등기 아님', 때: '판정 전', 근거: '시행령 §168①4호' }); return 끝(null); }
    else notes.push('건축허가 없는 주택이지만 1세대1주택 요건을 못 갖춰 4호로 빠지지 않음 — 건물분은 미등기(70%), 등기된 부수토지는 따로 일반 계산(토지·건물 거래를 나눠 엔진에)');
  }
  if (/도시개발/.test(사유)) 빼기.push(['6호', '「도시개발법」 도시개발사업이 끝나지 않아 토지 취득등기를 못 하고 양도']);
  if (/체비지/.test(사유) || /체비지/.test(원인)) {
    const 공고 = jmYmd_(p.환지처분공고일), 건설 = jmYn_(p.건설사업자);
    if (건설 === true && (!공고 || !양도일 || 양도일 < 공고)) 빼기.push(['7호', '건설사업자가 공사용역 대가로 받은 체비지를 환지처분공고 전에 양도' + (공고 ? '' : '(공고일 모름 — 잠정)')]);
    else if (건설 !== true && !빼기.some(function (x) { return x[0] === '6호'; })) notes.push('체비지를 산 사람(건설사업자 아님)이 등기 없이 넘김 — 7호는 건설사업자만. 도시개발사업이 끝나지 않아 등기를 못 했으면 6호로 빠짐(사유 「도시개발」)');
  }
  if (빼기.length) {
    빼기.forEach(function (x) { reqs.push(jmReq_('빼 주는 자산 ' + x[0], true, x[1] + ' — 미등기양도자산에서 제외', '시행령 §168①' + x[0])); });
    if (빼기.some(function (x) { return x[0] === '4호'; })) notes.push('4호로 미등기에서 빠져도 고가주택(12억 초과)이면 넘는 몫은 과세(§89①3호·§95③) — 엔진 칸 isOneHouseOneFamily로');
    if (빼기.some(function (x) { return x[0] === '3호'; })) notes.push('3호로 빠지면 감면·비과세가 그대로 붙음 — 개산공제도 3%(0.3% 아님, 시행령 §163⑥)');
    return 끝(false, { 빠진호: 빼기.map(function (x) { return x[0]; }) });
  }
  if (/부득이/.test(사유)) {
    reqs.push(jmReq_('부득이한 사정', null, (p.사유설명 || '등기를 못 한 부득이한 사정 주장') + ' — 시행령 §168①에 없는 사유, 판례로만 다툼', '판례 [확인 필요: 대법원 판례 번호]'));
    할일.push({ 무엇: '등기를 못 한 사정 증빙(소송·가처분·행정 지연 서류 등)', 때: '신고 전', 근거: '시행령 §168①2호·판례' });
    return 끝(null);
  }
  reqs.push(jmReq_('빼 주는 자산', true, '시행령 §168① 1~4·6·7호 어디에도 들지 않음 — 미등기양도자산', '시행령 §168①'));
  notes.push('미등기 효과: ' + 효과);
  if (/매매/.test(원인) || !원인) notes.push('잔금 뒤 등기 없이 다시 판 경우(중간생략) — 부동산등기 특별조치법 위반(과태료·벌칙)은 세금 밖, 앞 매도인의 양도 신고도 함께 확인');
  할일.push({ 무엇: '양도 전이면 취득 등기를 먼저 하면 일반 계산 — 이미 양도했으면 미등기양도자산(세율 70%)으로 신고', 때: '양도 전이면 등기부터', 근거: '소득세법 §104③' });
  return 끝(true);
}
// [2026.11.03 복잡사건 90 「차씨 신축 상가」] 신축·증축 건물을 5년 안에 팔며 감정가액·환산취득가액을 쓴 가산세 — 소득세법 §114의2①②
//  (신축 또는 85㎡ 넘는 증축 건물을 취득일·증축일부터 5년 안에 양도 + 취득가액을 §97①1호나목 감정가액·환산취득가액으로 → 그 건물분(증축은 증축분만)의 5%를 결정세액에 더함,
//  산출세액이 없어도), 신축 건물 취득일 = 사용승인서 교부일·그 전 사실상 사용일·임시사용승인일 중 빠른 날, 무허가는 사실상 사용일(시행령 §162①4호).
//  연혁(엔진 conversionPenaltyRuleAt_과 같음): 2018.1.1. 전 양도 없음 · 2018~2019 양도는 신축 건물의 환산가액만(법률 제13558호) · 2020.1.1. 이후 감정가액·증축까지(법률 제16104호).
//  p: { 건물취득원인(신축|증축|매매|상속|증여|재건축), 사용승인일, 임시사용승인일, 사실상사용일, 무허가(예), 증축일, 증축면적(㎡), 양도일,
//       취득가액방법(실가|환산|감정|매매사례|기준시가), 건물분가액(감정가액·환산취득가액 중 건물 몫, 원), 증축분가액(증축한 부분 몫, 원), 공사비증빙(있음|없음|일부), 엔진칸(건물 거래) }
function judgeNewBuildConversion_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 원인 = String(p.건물취득원인 || ''), 방법 = String(p.취득가액방법 || ''), 근거 = '소득세법 §114의2①②';
  const 양도일 = jmYmd_(p.양도일);
  const ec = p.엔진칸 && typeof p.엔진칸 === 'object' ? p.엔진칸 : null;
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const 끝 = function (대상, 기준액, extra) {
    const 가산세 = 대상 === false ? 0 : (기준액 > 0 ? Math.round(기준액 * 0.05) : null);
    if (ec) {
      const on = 대상 !== false;
      경우.push({ 이름: '① 법대로 — ' + (대상 === true ? '가산세 ' + (가산세 == null ? '(건물분 가액 모름)' : famWon_(가산세)) : 대상 === false ? '가산세 없음' : '가산세 붙는 것으로 잠정'), 엔진: 'calculate_transfer_tax',
        엔진칸: Object.assign({}, ec, { isNewBuildingWithin5Years: on, convertedBuildingAcquisitionValueForPenalty: on && 기준액 > 0 ? 기준액 : undefined }) });
      if (대상 !== false) 경우.push({ 이름: '② 잘못 — 가산세를 놓침', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, ec, { isNewBuildingWithin5Years: false, convertedBuildingAcquisitionValueForPenalty: undefined }) });
      else if (/환산|감정/.test(방법)) 경우.push({ 이름: '② 잘못 — 환산·감정이라고 무조건 5%를 붙임', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, ec, { isNewBuildingWithin5Years: true }) });
    }
    const w = jmWrap_('환산가산세', reqs, Object.assign({ 가산세대상: 대상, 가산세: 가산세, 기준액: 기준액 || null, 경우: 경우,
      엔진칸늘: ec ? { isNewBuildingWithin5Years: 대상 !== false, convertedBuildingAcquisitionValueForPenalty: 대상 !== false && 기준액 > 0 ? 기준액 : undefined } : null, 알림: notes, 할일: 할일 }, extra || {}));
    w.표시 = '환산가산세 — ' + (대상 === true ? '붙음 ' + (가산세 == null ? '(건물분 감정·환산가액 모름)' : famWon_(가산세) + '(' + famWon_(기준액) + ' × 5%)') : 대상 === false ? '없음' : '모름(잠정 붙음)' + (w.남은것.length ? ' — 남은 것: ' + w.남은것.map(function (x) { return x.split(' — ')[0]; }).join(', ') : ''));
    return w;
  };
  // 1. 거주자가 지은 건물인가 — 신축·증축만
  const 증축 = /증축/.test(원인);
  if (!/신축|증축|건설|지음/.test(원인)) {
    reqs.push(jmReq_('신축·증축', false, (원인 || '취득 원인 모름') + ' — 내가 신축·증축한 건물이 아니면 가산세 대상 아님', 근거));
    if (/재건축|재개발/.test(원인)) notes.push('재건축·재개발 조합원이 받은 새 건물은 종전 부동산을 이어 가는 것이라 「거주자가 신축」으로 보지 않았습니다 [확인 필요: 조합원 신축 건물의 §114의2 적용 예규]');
    if (!원인) { reqs[0] = jmReq_('신축·증축', null, '건물을 직접 지었는지(신축·증축) 모름', 근거); return 끝(null, 0); }
    return 끝(false, 0);
  }
  reqs.push(jmReq_('신축·증축', true, 증축 ? '증축한 건물' : '직접 신축한 건물', 근거));
  // 2. 증축은 바닥면적 합계 85㎡ 넘을 때만
  if (증축) {
    const 면적 = Number(p.증축면적);
    if (!(면적 > 0)) { reqs.push(jmReq_('증축 85㎡ 초과', null, '증축 바닥면적 합계를 모름 — 85㎡ 이하면 가산세 없음', 근거)); 할일.push({ 무엇: '건축물대장(증축 연월일·증축 바닥면적)', 때: '신고 전', 근거: 근거 }); }
    else if (면적 <= 85) { reqs.push(jmReq_('증축 85㎡ 초과', false, '증축 바닥면적 ' + 면적 + '㎡ — 85㎡ 이하', 근거)); return 끝(false, 0); }
    else reqs.push(jmReq_('증축 85㎡ 초과', true, '증축 바닥면적 ' + 면적 + '㎡', 근거));
  }
  // 3. 5년 — 신축은 취득일(시행령 §162①4호), 증축은 증축일부터
  let 기산 = '';
  if (증축) 기산 = jmYmd_(p.증축일);
  else if (jmYn_(p.무허가) === true) 기산 = jmYmd_(p.사실상사용일);
  else { const ds = [p.사용승인일, p.임시사용승인일, p.사실상사용일].map(jmYmd_).filter(Boolean).sort(); 기산 = ds[0] || ''; }
  const 오년 = 기산 ? famAddY_(기산, 5) : '';
  if (!기산 || !양도일) {
    reqs.push(jmReq_('5년 안 양도', null, (증축 ? '증축일' : '신축 건물 취득일(사용승인서 교부일·사실상 사용일·임시사용승인일 중 빠른 날)') + (기산 ? '' : ' 모름') + (양도일 ? '' : ' · 양도일 모름'), '소득세법 §114의2①·시행령 §162①4호'));
    if (!기산) 할일.push({ 무엇: 증축 ? '건축물대장(증축일)' : '사용승인서·임시사용승인서·건축물대장(사용승인일) — 그 전에 들어가 살거나 쓴 날이 있으면 그 증빙(전입·전기 사용 등)', 때: '신고 전', 근거: '시행령 §162①4호' });
  } else if (양도일 > 오년) { reqs.push(jmReq_('5년 안 양도', false, 기산 + '부터 5년(' + 오년 + ')이 지나 ' + 양도일 + ' 양도', '소득세법 §114의2①')); return 끝(false, 0, { 기산일: 기산, 오년되는날: 오년 }); }
  else {
    reqs.push(jmReq_('5년 안 양도', true, 기산 + '부터 5년(' + 오년 + ') 안인 ' + 양도일 + ' 양도', '소득세법 §114의2①·시행령 §162①4호'));
    if (오년 && 양도일 >= famAddD_(오년, -31)) notes.push('5년 되는 날(' + 오년 + ')에 바짝 붙은 양도입니다 — 기산일(사용승인일·사실상 사용일)이 하루만 달라도 갈립니다. 「5년 이내」의 끝 날 셈은 [확인 필요]');
  }
  // 4. 취득가액을 감정가액·환산취득가액으로 했나
  if (!방법) { reqs.push(jmReq_('감정·환산가액 사용', null, '건물 취득가액을 무엇으로 했는지(실가·환산·감정) 모름', 근거)); }
  else if (!/환산|감정/.test(방법)) {
    reqs.push(jmReq_('감정·환산가액 사용', false, '건물 취득가액을 ' + 방법 + (/실가|실지/.test(방법) ? '(실지거래가액 — 공사비)' : '') + '로 함 — 감정가액·환산취득가액이 아니면 가산세 없음', 근거));
    if (/매매사례|기준시가/.test(방법)) notes.push('§114의2는 감정가액·환산취득가액만 적습니다. 매매사례가액·기준시가로 정한 경우는 문언상 빠집니다 [확인 필요]');
    return 끝(false, 0, { 기산일: 기산, 오년되는날: 오년 });
  } else reqs.push(jmReq_('감정·환산가액 사용', true, '건물 취득가액을 ' + (/감정/.test(방법) ? '감정가액' : '환산취득가액') + '으로 함', '소득세법 §97①1호나목·§114의2①'));
  const 공사비 = jmYn_(p.공사비증빙);
  if (/환산|감정/.test(방법) && (공사비 === true || /일부/.test(String(p.공사비증빙 || '')))) notes.push('공사비 증빙(도급계약서·세금계산서·이체 내역)이 ' + (공사비 === true ? '있으면' : '일부라도 있으면') + ' 실지거래가액을 확인할 수 있어 환산·감정을 쓸 수 없습니다(소득세법 §97①1호·§114⑦·시행령 §176의2①) — 공사비 실가로 하면 가산세도 없습니다. 공사비가 환산가액보다 적으면 세금이 늘 수 있으니 둘 다 계산해 견주십시오');
  // 5. 연혁 — 양도일
  if (양도일 && 양도일 < '2018-01-01') { reqs.push(jmReq_('양도일 연혁', false, '2018.1.1. 전 양도 — §114의2 없음', '소득세법 §114의2(법률 제13558호 부칙)')); return 끝(false, 0, { 기산일: 기산, 오년되는날: 오년 }); }
  if (양도일 && 양도일 < '2020-01-01' && (증축 || /감정/.test(방법))) { reqs.push(jmReq_('양도일 연혁', false, '2018~2019 양도는 신축 건물의 환산가액만 — ' + (증축 ? '증축' : '감정가액') + '은 없음', '소득세법 §114의2(법률 제13558호·제16104호)')); return 끝(false, 0, { 기산일: 기산, 오년되는날: 오년 }); }
  // 6. 가산세 기준액 — 건물분(증축은 증축분)만, 땅은 빼고
  const 기준액 = 증축 ? num(p.증축분가액) : num(p.건물분가액);
  if (!기준액) {
    reqs.push(jmReq_('건물분 가액', null, (증축 ? '증축한 부분' : '건물') + '의 감정가액·환산취득가액(땅 몫 뺀 것) 모름', 근거));
    할일.push({ 무엇: (증축 ? '증축분' : '건물분') + ' 환산취득가액 = 양도가액 중 건물 몫 × 취득 당시 건물 기준시가 ÷ 양도 당시 건물 기준시가(시행령 §176의2②2호) — 땅·건물은 기준시가 비율로 나눔(묶음 「토지건물구분」)', 때: '계산 전', 근거: '시행령 §176의2②·§166⑥' });
  }
  notes.push('가산세는 ' + (증축 ? '증축한 부분' : '건물') + ' 몫에만 붙습니다 — 땅까지 합친 환산가액에 5%를 붙이면 과다합니다(엔진은 건물분 가액을 안 주면 그 거래의 취득가액 전체에 붙이므로, 땅과 건물을 한 거래로 넣을 때는 기준액을 꼭 넘기십시오)');
  notes.push('산출세액이 없어도(1세대1주택 비과세·감면으로 0이어도) 붙습니다(§114의2②) — 비과세 주택에도 붙는지 예규 [확인 필요]');
  return 끝(reqs.some(function (r) { return r.결과 === '?'; }) ? null : true, 기준액, { 기산일: 기산, 오년되는날: 오년 });
}
// [2026.11.03 복잡사건 91 「양씨 전세 낀 아파트」] 부담부증여 — 인수 채무를 증여에서 빼 주는지·얼마를 양도로 보는지(상증법 §47①③·상증령 §36·§10①, 소득세법 §88 1호 후단·소득령 §151③·§159, §105①3호)
//  ① 빼 주는 채무: 그 증여재산에 담보된 채무 + 증여자가 그 재산을 남에게 빌려준 임대보증금(§47①·상증령 §36①), 수증자가 실제로 인수한 것만.
//  ② 배우자·직계존비속 사이: 인수했어도 "인수되지 않은 것으로 추정"(§47③) — 국가·지자체·금융회사 채무 확인 서류, 그 밖의 채무는 채무부담계약서·채권자확인서·담보·이자 증빙으로 깸(상증령 §36②→§10①1·2호).
//     추정을 못 깨면 증여세는 전체에 붙고 양도로 보는 부분도 없음(소득령 §151③ 단서).
//  ③ 양도로 보는 부분(소득령 §159①): 양도가액 = 평가액 × 채무액 ÷ 증여가액, 취득가액 = 취득가액 × 채무액 ÷ 증여가액 — 증여가액을 기준시가로 평가했으면 취득가액도 기준시가(①1호 괄호).
//     양도세 대상 아닌 재산을 함께 주면 채무를 가액 비율로 먼저 나눔(②).
//  ④ 신고: 증여세(수증자)·양도세(증여자) 모두 증여일이 속한 달 말일부터 3개월(상증법 §68①·소득세법 §105①3호).
//  p: { 관계(배우자|직계존속|직계비속|그밖친족|타인 — 수증자 쪽에서 본 증여자), 증여일, 재산종류(주택|토지|건물|상가|주식|그밖), 채무종류(담보대출|임대보증금|개인채무|세금|그밖),
//       채무담보관련(예: 그 재산에 담보 설정·그 재산의 임대보증금), 채무발생일, 채무액, 인수(예|아니오|모름: 채무자 명의변경·임대차 승계), 입증(금융기관|국가지자체|계약서|임대차계약서|없음|모름),
//       평가액(증여재산 상증법 평가액), 평가방법(시가|감정|유사매매|기준시가), 취득가액(증여자 실지 취득가액), 취득당시기준시가, 다른재산가액(함께 준 양도세 대상 아닌 재산, §159②),
//       상환능력(있음|없음|모름), 증여자1세대1주택(예|아니오|모름), 필요경비, 엔진칸증여(calculate_gift_tax에 넘길 다른 칸) }
function judgeBurdenedGift_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 관계 = String(p.관계 || ''), 종류 = String(p.채무종류 || ''), 입증 = String(p.입증 || ''), 평가방법 = String(p.평가방법 || '');
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const 채무 = num(p.채무액), 평가 = num(p.평가액), 다른 = num(p.다른재산가액), 경비 = num(p.필요경비);
  const 증여일 = jmYmd_(p.증여일);
  const 가까움 = /배우자|직계/.test(관계);
  const 근거 = '상증법 §47①③·상증령 §36·§10①, 소득령 §151③·§159';
  // 신고기한: 증여일이 속한 달 말일부터 3개월 → 3개월 뒤 달의 말일
  const 기한 = (function () { if (!증여일) return null; const y = +증여일.slice(0, 4), m = +증여일.slice(5, 7); const t = new Date(Date.UTC(y, m + 3, 0)); return t.toISOString().slice(0, 10); })();
  // 1. 빼 주는 채무인가 — 그 재산에 담보된 채무·그 재산의 임대보증금
  let 관련 = jmYn_(p.채무담보관련);
  if (/개인채무|세금/.test(종류) && 관련 !== true) 관련 = false;
  reqs.push(jmReq_('그 재산에 담보된 채무·임대보증금', 관련, 관련 === false ? (종류 || '이 채무') + '는 증여재산에 담보되거나 그 재산 임대보증금이 아님 — 증여에서 안 빠지고 양도도 아님' : 관련 == null ? '등기사항전부증명서(근저당)·임대차계약서로 그 재산에 걸린 채무인지 확인' : '', '상증법 §47①·상증령 §36①'));
  // 2. 수증자가 실제로 인수했나
  const 인수 = jmYn_(p.인수);
  reqs.push(jmReq_('수증자가 실제로 인수', 인수, 인수 === false ? '채무자·임대인이 그대로 증여자 — 인수 아님' : 인수 == null ? '대출 채무자 변경(채무인수 약정)·임대차 승계(임차인 확인)가 됐는지' : '', '상증법 §47①'));
  // 3. 배우자·직계존비속이면 추정을 깨는 증빙
  let 입증됨 = true;
  if (가까움) {
    입증됨 = /금융|국가|지자체|계약|임대차/.test(입증) ? true : /없음/.test(입증) ? false : null;
    reqs.push(jmReq_('인수 추정을 깨는 증빙(배우자·직계존비속)', 입증됨, 입증됨 === false ? '증빙이 없으면 인수 안 한 것으로 추정 — 채무를 빼지 않고 전체에 증여세, 양도로 보는 부분도 없음' : 입증됨 == null ? '금융회사·국가·지자체 채무 확인서, 그 밖은 채무부담계약서·채권자확인서·담보·이자 지급 증빙' : (/임대차/.test(입증) ? '임대차계약서 — 확정일자·보증금 받은 통장 내역을 함께 [확인 필요: 임대보증금 입증 서류 범위]' : 입증), '상증법 §47③·상증령 §36②·§10①1·2호'));
  }
  const 인정 = 관련 === false || 인수 === false || 입증됨 === false ? false : (관련 == null || 인수 == null || 입증됨 == null ? null : true);
  const 인정채무 = 인정 === false ? 0 : Math.min(채무, 평가 || 채무);
  // 4. 양도로 보는 부분(§159) — 인정될 때만
  let 양도분 = null;
  const A_실가 = num(p.취득가액), A_기준 = num(p.취득당시기준시가), 기준시가평가 = /기준시가/.test(평가방법);
  if (인정 !== false && 평가 > 0 && 인정채무 > 0) {
    const 안분채무 = 다른 > 0 ? Math.min(인정채무, Math.round(인정채무 * 평가 / (평가 + 다른))) : 인정채무;
    const A = 기준시가평가 ? A_기준 : A_실가;
    if (기준시가평가 && !A_기준) { reqs.push(jmReq_('취득 당시 기준시가', null, '증여가액을 기준시가로 평가했으면 양도분 취득가액도 기준시가 — 취득 당시 기준시가 모름', '소득령 §159①1호 괄호')); 할일.push({ 무엇: '증여자 취득 당시 기준시가(공동주택가격·개별공시지가) 확인', 때: '계산 전', 근거: '소득령 §159①1호' }); }
    if (!기준시가평가 && !A_실가) { reqs.push(jmReq_('증여자 취득가액', null, '양도분 취득가액 = 취득가액 × 채무 ÷ 증여가액 — 실지 취득가액 모름(모르면 환산)', '소득령 §159①1호·소득세법 §97①1호')); }
    양도분 = { 안분채무: 안분채무, 양도가액: Math.round(평가 * 안분채무 / 평가), 취득가액: A ? Math.round(A * 안분채무 / 평가) : null, 취득가액기준: 기준시가평가 ? '기준시가' : '실지 취득가액', 신고: '증여자(양도인)', 기한: 기한 };
    if (다른 > 0) notes.push('양도세 대상 아닌 재산(' + famWon_(다른) + ')을 함께 주어 채무를 가액 비율로 먼저 나눴습니다 — 양도로 보는 채무 ' + famWon_(안분채무) + '(소득령 §159②). 증여세에서는 인수 채무 전체를 뺍니다');
  }
  // 5. 엔진 칸 — ① 법대로 ② 잘못
  const eg = p.엔진칸증여 && typeof p.엔진칸증여 === 'object' ? p.엔진칸증여 : {};
  const rel = /배우자/.test(관계) ? '배우자' : /직계존속/.test(관계) ? '직계존속' : /직계비속/.test(관계) ? '직계비속' : /친족/.test(관계) ? '기타친족' : '기타';
  const g = function (빼기, 증명) { return Object.assign({}, eg, { relation: eg.relation || rel, giftAmount: 평가, debtAssumedAmount: 빼기 ? 채무 : 0, isDebtObjectivelyProven: 증명 }); };
  const tr = function (기준) { return { assetAcquisitionPrice: A_실가 || undefined, giftValuedByStandardPrice: 기준 || undefined, acquisitionStandardPrice: 기준 ? A_기준 : undefined, assetGiftValue: 평가, totalDebtAmount: 인정채무 || 채무, otherAssetsGiftValueSum: 다른 || undefined, necessaryExpenses: 경비 || undefined }; };
  if (평가 > 0) {
    if (인정 !== false) {
      경우.push({ 이름: '① 법대로 — 채무 ' + famWon_(인정채무) + ' 빼고 증여세' + (인정 == null ? '(잠정)' : ''), 엔진: 'calculate_gift_tax', 엔진칸: g(true, true) });
      if (양도분 && 양도분.취득가액 != null) 경우.push({ 이름: '① 법대로 — 양도로 보는 부분(취득가액 ' + 양도분.취득가액기준 + ')', 엔진: 'calculate_burdened_gift_transfer', 엔진칸: tr(기준시가평가) });
      if (인정 == null) 경우.push({ 이름: '② 증빙을 못 내면 — 채무를 빼지 않고 전체 증여세(양도 없음)', 엔진: 'calculate_gift_tax', 엔진칸: g(false, false) });
      if (기준시가평가 && A_실가 && A_기준) 경우.push({ 이름: '② 잘못 — 기준시가로 평가하고 취득가액은 실지 취득가액을 씀', 엔진: 'calculate_burdened_gift_transfer', 엔진칸: tr(false) });
    } else {
      경우.push({ 이름: '① 법대로 — 채무를 빼지 않고 전체 증여세(양도 없음)', 엔진: 'calculate_gift_tax', 엔진칸: g(false, false) });
      if (채무 > 0 && 관련 !== false && 인수 !== false) 경우.push({ 이름: '② 잘못 — 증빙 없이 채무를 빼고 양도로 신고', 엔진: 'calculate_gift_tax', 엔진칸: g(true, true) });
    }
  }
  // 6. 알림·할일
  if (인정 !== false && 가까움) notes.push('양도로 보는 부분의 양도소득세는 증여자가 냅니다. 1세대1주택 비과세·장기보유특별공제·중과는 증여자 기준으로 그 부분에 그대로 적용합니다' + (jmYn_(p.증여자1세대1주택) === true ? ' — 증여자 1세대1주택이면 그 부분은 비과세(12억 넘는 고가주택은 넘는 몫만 과세 — 고가 판정을 양도로 보는 부분의 가액이 아니라 주택 전체 가액으로 하는지 [확인 필요: 소득령 §156①은 일부 양도 때 전체로 환산])' : ''));
  if (jmYn_(p.증여자1세대1주택) == null && /주택/.test(String(p.재산종류 || '')) && 인정 !== false) 할일.push({ 무엇: '증여자 세대가 1세대1주택인지(묶음 「세대판정」·1세대1주택 판정) — 양도로 보는 부분 비과세 여부가 갈림', 때: '계산 전', 근거: '소득세법 §89①3호' });
  if (기한) notes.push(인정 === false ? '신고: 증여세는 수증자가 ' + 기한 + '까지(증여일이 속한 달 말일부터 3개월, 상증법 §68①) — 양도로 보는 부분이 없어 증여자 양도세 신고는 없음' : '신고: 증여세는 수증자, 양도로 보는 부분의 양도세는 증여자 — 둘 다 ' + 기한 + '까지(증여일이 속한 달 말일부터 3개월, 상증법 §68①·소득세법 §105①3호)');
  const 상환 = jmYn_(p.상환능력);
  if (인정 !== false && 상환 !== true) {
    notes.push('수증자가 인수한 채무의 이자·원금을 증여자가 대신 갚으면 그때 다시 증여입니다(상증법 §4①·§36). 수증자 소득으로 갚을 수 없으면 인수 자체를 부인당할 수 있습니다 [확인 필요: 판례·예규]');
    할일.push({ 무엇: '수증자 소득·재산으로 이자·원금을 갚는지 확인하고 상환 자금 기록을 남김 — 국세청이 인수 채무를 계속 살핌(부채 사후관리 [확인 필요: 근거 규정])', 때: '신고 뒤 해마다', 근거: '상증법 §4①·§45' });
  }
  if (/임대보증금/.test(종류) && 인정 !== false) notes.push('임대보증금은 수증자가 새 임대인으로 돌려줄 의무를 이어받아야 합니다 — 임차인에게 임대인 바뀜을 알리고 계약을 승계했는지 확인');
  const 발생 = jmYmd_(p.채무발생일);
  if (발생 && 증여일 && 발생 <= 증여일 && famAddY_(발생, 1) > 증여일 && 인정 !== false) notes.push('증여 1년 안에 생긴 채무(' + 발생 + ')입니다 — 증여세를 줄이려고 일부러 만든 채무인지 살필 수 있습니다. 대출금이 어디에 쓰였는지 증빙을 남기십시오 [확인 필요]');
  if (인정 == null) 할일.push({ 무엇: '채무 인정 여부를 가를 서류 — 등기사항전부증명서(근저당)·대출 채무인수 약정·부채증명서·임대차계약서', 때: '신고 전', 근거: 근거 });
  const 증여분 = 평가 > 0 ? 평가 - 인정채무 : null;
  const w = jmWrap_('부담부증여', reqs, { 채무인정: 인정, 인정채무: 평가 > 0 || 채무 ? 인정채무 : null, 증여재산가액_채무뺌: 증여분, 양도분: 양도분, 신고기한: 기한, 경우: 경우, 알림: notes, 할일: 할일 });
  w.결론 = 인정 === false ? '채무 안 빠짐' : 인정 == null ? '채무 빠짐(잠정)' : '채무 빠짐';
  w.표시 = '부담부증여 — ' + (인정 === false ? '채무를 빼지 않음(전체 증여·양도 없음)' : '채무 ' + famWon_(인정채무) + ' 뺌' + (인정 == null ? '(잠정)' : '') + (양도분 ? ' · 양도로 보는 부분 양도가액 ' + famWon_(양도분.양도가액) + (양도분.취득가액 != null ? '·취득가액 ' + famWon_(양도분.취득가액) + '(' + 양도분.취득가액기준 + ')' : '') : '')) + (w.남은것.length ? ' (남은 것: ' + w.남은것.map(function (x) { return x.split(' — ')[0]; }).join(', ') + ')' : '');
  return w;
}
// [2026.11.03 복잡사건 92 「강씨 재외동포 아파트」] 비거주자 국내 부동산 양도 — 비과세·장특 표2·매수 법인 원천징수·양도신고확인서·신고(소득세법 §121②·§156①5호·§108·§105·§116②4호, 소득령 §180의2①·§207③·§171·§154①2호)
//  ① 비거주자는 거주자와 같은 방법으로 분류과세하되 1세대1주택 비과세(§89①3호)·조합원입주권 비과세(4호)·장특 표2(§95② 단서)를 적용하지 않음(§121② 단서·소득령 §180의2①).
//     단 해외이주·1년 이상 국외 취학·근무로 출국해 출국일 현재 1주택을 출국일부터 2년 안에 팔면 §89①3호(비과세)는 적용(§180의2① 단서 → §154①2호 나·다목).
//     그 단서는 "§89①3호를 적용할 때"만 적혀 있어 표2까지 주는지는 [확인 필요] — 엔진칸 두 경우로 나란히.
//  ② 매수인이 법인(내국법인·외국법인 국내사업장 등)이면 대금을 줄 때 원천징수: 양도가액 10%, 취득가액·양도비용이 확인되면 그것과 양도차익 20% 중 적은 금액(§156①5호).
//     매수인이 개인(거주자·비거주자)이면 원천징수 의무 없음(§156① 괄호). 양도자가 미리 신고·납부했거나 비과세·과세미달임을 세무서 확인서로 증명해 매수 법인에 내면 원천징수하지 않음(§156⑮·소득령 §207⑦ — 빼는 것이 아니라 전부 안 뗌).
//     원천징수세액은 다음 달 10일까지 납부(§156①), 결정 때 낸 세금으로 침(§116②4호).
//  ③ 재외국민·외국인은 등기 신청 때 부동산등양도신고확인서 제출(§108·소득령 §171, 세무서 매도용 인감 확인을 받으면 낸 것으로 봄).
//  ④ 예정신고: 양도일이 속한 달 말일부터 2개월(§105①1호). 국내에 주소가 없으면 납세관리인(국세기본법 §82).
//  p: { 거주자(비거주자|거주자|모름), 신분(재외국민|외국인|내국인), 출국일, 출국사유(해외이주|취학|근무|그밖), 출국일1주택(예|아니오|모름), 양도일, 잔금일, 자산(주택|토지|건물|그밖),
//       1세대1주택(예|아니오|모름: 출국 전 국내 세대 기준), 거주연수, 양도가액, 취득가액, 양도비용, 취득가액확인(예|아니오|모름), 매수인(법인|개인|모름), 먼저낸세액, 납세관리인(예|아니오|모름), 엔진칸 }
function judgeNonResidentTransfer_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const 근거 = '소득세법 §121②·§156①5호·§108·§105①·§116②4호·§156⑮, 소득령 §180의2①·§207⑦·§171·§154①2호';
  const 거주s = String(p.거주자 || ''), 신분 = String(p.신분 || ''), 사유 = String(p.출국사유 || ''), 자산 = String(p.자산 || '주택'), 매수인 = String(p.매수인 || '');
  const 비거주 = /비거주/.test(거주s) ? true : /^거주/.test(거주s) ? false : null;
  const 양도일 = jmYmd_(p.양도일), 잔금일 = jmYmd_(p.잔금일) || 양도일, 출국일 = jmYmd_(p.출국일);
  const 양도가액 = num(p.양도가액), 취득가액 = num(p.취득가액), 비용 = num(p.양도비용);
  const 차익 = 양도가액 > 0 && 취득가액 > 0 ? Math.max(0, 양도가액 - 취득가액 - 비용) : null;
  // 1. 거주자인가
  reqs.push(jmReq_('양도인이 비거주자', 비거주, 비거주 === false ? '거주자 — 이 묶음 대상 아님(거주자와 같이 1세대1주택·표2 판정)' : 비거주 == null ? '183일·생활 근거로 거주자인지부터(묶음 「거주자」)' : '국내 주소·183일 거소 없음 — 국내원천 부동산 양도소득으로 분류과세(§119 9호·§121②)', '소득세법 §1의2·§121②, 소득령 §2'));
  if (비거주 == null) 할일.push({ 무엇: '양도일 현재 거주자인지 판정(묶음 「거주자」 — 출입국 기록·가족·직업·자산)', 때: '계약 전', 근거: '소득령 §2·§2의2' });
  // 2. 1세대1주택 비과세 — 비거주자는 출국 2년 예외만
  const 일주택 = /주택/.test(자산) ? jmYn_(p['1세대1주택']) : false;
  const 이주사유 = /해외이주|취학|근무/.test(사유) ? true : 사유 ? false : null;
  const 출국1주택 = jmYn_(p.출국일1주택);
  const 이년 = 출국일 && 양도일 ? 양도일 <= famAddY_(출국일, 2) : null;
  let 예외 = null;
  if (비거주 === false) 예외 = null;
  else if (!/주택/.test(자산)) 예외 = false;
  else 예외 = 이주사유 === false || 출국1주택 === false || 이년 === false ? false : (이주사유 && 출국1주택 && 이년 ? true : null);
  if (비거주 !== false && /주택/.test(자산)) reqs.push(jmReq_('출국 2년 안 1주택 비과세 예외', 예외, 예외 === true ? '해외이주·국외 취학·근무로 출국, 출국일 현재 1주택, 출국일(' + 출국일 + ')부터 2년 안 양도 — §89①3호 비과세는 적용' : 예외 === false ? (이년 === false ? '출국일(' + 출국일 + ')부터 2년(' + famAddY_(출국일, 2) + ')이 지나 양도 — 비과세 없음' : 이주사유 === false ? '출국 사유가 해외이주·1년 이상 국외 취학·근무가 아님 — 비과세 없음' : '출국일 현재 1주택이 아님 — 비과세 없음') : '출국 사유(해외이주 신고확인서·재학·재직 증명)·출국일 현재 1주택·출국일을 확인', '소득령 §180의2① 단서·§154①2호 나·다목'));
  if (비거주 !== false && 예외 == null && /주택/.test(자산)) 할일.push({ 무엇: '출국 2년 예외 서류 — 해외이주신고확인서(또는 현지 이주 확인)·국외 재학·재직증명서·출입국사실증명·출국일 현재 주택 보유 확인', 때: '양도 전', 근거: '소득령 §154①2호 나·다목' });
  // 3. 매수 법인 원천징수
  const 법인 = /법인/.test(매수인) ? true : /개인/.test(매수인) ? false : null;
  const 확인 = jmYn_(p.취득가액확인);
  const 먼저 = num(p.먼저낸세액);
  let 원천 = null, 원천기한 = null;
  if (비거주 !== false && 법인 === true && 양도가액 > 0) {
    const a = Math.floor(양도가액 * 0.10), b = 확인 === true && 차익 != null ? Math.floor(차익 * 0.20) : null;
    const 기본 = b != null ? Math.min(a, b) : a;
    // §156⑮·소득령 §207⑦ — 미리 납부·비과세·과세미달 확인서를 매수 법인에 내면 원천징수 없음(일부만 냈을 때 빼고 떼는지는 법에 없어 [확인 필요]).
    const 확인서 = jmYn_(p.확인서제출);
    const 면제 = 확인서 === true && (먼저 > 0 || 예외 === true);
    원천 = 면제 ? 0 : 기본;
    if (잔금일) { const y = +잔금일.slice(0, 4), m = +잔금일.slice(5, 7); 원천기한 = new Date(Date.UTC(y, m, 10)).toISOString().slice(0, 10); }
    notes.push('매수인이 법인이라 잔금을 줄 때 원천징수합니다 — ' + (b != null ? '양도가액 10% ' + famWon_(a) + '와 양도차익 20% ' + famWon_(b) + ' 중 적은 ' + famWon_(기본) : '취득가액·양도비용이 확인되지 않아 양도가액 10% ' + famWon_(a)) + (면제 ? ' — 그러나 ' + (먼저 > 0 ? '미리 신고·납부(' + famWon_(먼저) + ')' : '비과세') + ' 확인서를 매수 법인에 내 원천징수 0(§156⑮·소득령 §207⑦)' : 먼저 > 0 ? ' — 미리 ' + famWon_(먼저) + '을 냈어도 세무서 확인서를 매수 법인에 내지 않으면 원천징수는 그대로(§156⑮·소득령 §207⑦)' : '') + (원천기한 ? ' — 매수 법인이 ' + 원천기한 + '까지 납부' : '') + '(소득세법 §156①5호). 원천징수세액의 10%를 지방소득세로 함께 뗍니다(지방세 — 범위 밖, 참고)');
    if (확인 !== true) 할일.push({ 무엇: '매수 법인에 취득 계약서·양도비용 증빙을 미리 줌 — 확인되면 양도가액 10%가 아니라 양도차익 20%와 견준 적은 금액만 뗌', 때: '잔금 전', 근거: '소득세법 §156①5호 단서' });
    if (!면제) 할일.push({ 무엇: (예외 === true ? '비과세' : '미리 예정신고·납부') + ' 확인 신청서(양도소득세 신고납부(비과세·과세미달) 확인 신청서 + 등기부등본·매매계약서)를 납세지 세무서에 내 확인을 받고 그 확인서를 매수 법인에 줌 — 그러면 원천징수를 하지 않아 큰 금액이 묶이지 않음', 때: '잔금 전', 근거: '소득세법 §156⑮·소득령 §207⑦' });
    if (먼저 > 0 && !면제) notes.push('미리 낸 세액과 원천징수가 겹치면 확정신고·경정으로 돌려받습니다(§116②4호로 기납부세액에 들어감) — 일부만 미리 낸 경우 그만큼 빼고 떼는지는 법에 없음 [확인 필요]');
  } else if (비거주 !== false && 법인 === false) notes.push('매수인이 개인이라 원천징수는 없습니다(소득세법 §156① 괄호) — 양도인이 스스로 예정신고·납부');
  else if (비거주 !== false && 법인 == null) 할일.push({ 무엇: '매수인이 법인인지 개인인지 — 법인이면 잔금 때 원천징수', 때: '계약 때', 근거: '소득세법 §156①5호' });
  // 4. 신고·확인서·납세관리인
  let 신고기한 = null;
  if (양도일) { const y = +양도일.slice(0, 4), m = +양도일.slice(5, 7); 신고기한 = new Date(Date.UTC(y, m + 2, 0)).toISOString().slice(0, 10); }
  if (비거주 !== false) {
    notes.push('예정신고는 양도인이 ' + (신고기한 || '양도일이 속한 달 말일부터 2개월') + '까지 합니다(소득세법 §105①1호·§121②) — 원천징수당한 세액은 낸 세금으로 칩니다(§116②4호)' + (원천 ? '. 산출세액보다 원천징수가 많으면 신고로 돌려받습니다 [확인 필요: 환급 절차]' : ''));
    if (/재외국민|외국인/.test(신분)) 할일.push({ 무엇: '부동산등양도신고확인서를 세무서에서 받아 등기 신청 때 냄(또는 세무서 매도용 인감증명 발급 확인) — 없으면 등기가 안 됨', 때: '잔금·등기 전', 근거: '소득세법 §108·소득령 §171' });
    else if (!신분) 할일.push({ 무엇: '양도인이 재외국민·외국인이면 부동산등양도신고확인서가 필요 — 국적·재외국민 등록 확인', 때: '잔금 전', 근거: '소득세법 §108' });
    if (jmYn_(p.납세관리인) !== true) 할일.push({ 무엇: '국내에 주소·거소가 없으면 납세관리인을 정해 세무서에 신고(고지서·환급 받을 사람)', 때: '신고 전', 근거: '국세기본법 §82' });
    notes.push('부동산 양도소득은 조세조약에서도 부동산이 있는 나라(한국)가 과세하는 것이 보통입니다 — 거주지국에서 외국납부세액공제를 받을 수 있게 납부 증빙을 챙기십시오 [확인 필요: 해당 조세조약]');
  }
  // 5. 엔진칸 — 표2 해석 두 갈래
  const base = Object.assign({ assetType: /토지/.test(자산) ? 'land' : /주택/.test(자산) ? 'house' : 'other', transferPrice: 양도가액 || undefined, acquisitionPrice: 취득가액 || undefined, necessaryExpenses: 비용 || undefined, transferDate: 양도일 || undefined }, p.엔진칸 || {});
  if (비거주 !== false) {
    const nr = Object.assign({}, base, { isTransferorResident: false, isOneHouseOneFamily: !!(일주택 === true), residenceYears: Number(p.거주연수) || 0 });
    // [같은 날 고침] 예외를 모르면(잠정) 예외 아닌 경우를 ①로, 예외인 경우를 ②로 — 예전엔 모르는데도 예외 칸을 켜 두 경우가 같게 나왔음.
    //  1세대1주택이 아니거나 모르면 예외 칸은 켜지 않는다(비과세 자체가 안 됨).
    const ex = Object.assign({}, nr, { isNonResidentTwoYearException: true, nonResidentTable2Excluded: true }); if (출국일) ex.departureDate = 출국일;
    if (예외 == null && /주택/.test(자산) && 일주택 === true) {
      경우.push({ 이름: '① 예외 서류를 못 내면 — 비거주자(비과세·표2 없음)', 엔진: 'calculate_transfer_tax', 엔진칸: nr });
      경우.push({ 이름: '② 출국 2년 예외가 맞으면 — 비과세는 받고 장특은 표1(표2 [확인 필요])', 엔진: 'calculate_transfer_tax', 엔진칸: ex });
      if (비거주 == null) 경우.push({ 이름: '③ 거주자로 판정되면 — 1세대1주택 비과세·표2', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, nr, { isTransferorResident: true }) });
    } else if (예외 === true && 일주택 !== false) nr.isNonResidentTwoYearException = true, nr.departureDate = 출국일 || undefined;
    if (경우.length) { /* 위에서 냄 */ } else if (nr.isNonResidentTwoYearException) {
      경우.push({ 이름: '① 문언대로 — 비과세는 받고 장특은 표1(표2 배제, §121② 단서·소득령 §180의2①)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, nr, { nonResidentTable2Excluded: true }) });
      경우.push({ 이름: '② 표2까지 주는 해석 [확인 필요]', 엔진: 'calculate_transfer_tax', 엔진칸: nr });
    } else {
      경우.push({ 이름: '① 법대로 — 비거주자(비과세·표2 없음)', 엔진: 'calculate_transfer_tax', 엔진칸: nr });
      if (일주택 === true) 경우.push({ 이름: 비거주 == null ? '② 거주자로 판정되면 — 1세대1주택 비과세·표2' : '② 잘못 — 거주자처럼 1세대1주택 비과세·표2', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, nr, { isTransferorResident: true }) });
    }
  }
  const w = jmWrap_('비거주자양도', reqs, { 비거주자: 비거주, 비과세예외: 예외, 양도차익: 차익, 원천징수: 원천, 원천징수기한: 원천기한, 예정신고기한: 신고기한, 경우: 경우, 알림: notes, 할일: 할일 });
  w.결론 = 비거주 === false ? '거주자 — 대상 아님' : 예외 === true ? '비과세 예외(표2 [확인 필요])' : 예외 == null && /주택/.test(자산) ? '비과세 예외 잠정' : '비과세·표2 없음';
  w.표시 = '비거주자 양도 — ' + w.결론 + (원천 != null ? ' · 매수 법인 원천징수 ' + famWon_(원천) : '') + (신고기한 ? ' · 예정신고 ' + 신고기한 : '');
  return w;
}
// [2026.11.03 복잡사건 93 「백씨 가족법인 거래」] 개인 ↔ 법인 부동산 거래 — 시가와 다른 값(소득세법 §96③·§101①, 소득령 §163⑩·§167③, 상증법 §4의2③④·§35·§45의5)
//  ① 개인이 특수관계법인에 팔고 법인세법 §67로 그 개인의 상여·배당 등으로 처분된 금액이 있으면 양도가액은 법인세법 §52 시가(§96③1호).
//  ② 특수관계법인 외의 자에게 시가보다 비싸게 팔면 양도가액 = 대가 − 상증법 §35 증여재산가액(가목) 또는 배당 등 처분 금액(나목)(§96③2호).
//  ③ 개인이 특수관계인(법인 포함)에게 싸게 팔면 §101① 부당행위 — 차액 3억 이상 또는 시가 5% 이상(소득령 §167③)이면 시가로 다시 셈.
//  ④ 개인이 특수관계 법인에게서 사며 상여·배당 등 처분된 금액이 있으면 나중에 팔 때 취득가액에 그 금액을 더함(소득령 §163⑩2호). §35 증여세를 받았으면 그 증여재산가액(1호).
//  ⑤ 증여세: 받은 이익에 소득세·법인세가 부과되면 증여세 없음(상증법 §4의2③). 영리법인이 받은 이익은 법인세 — 그 주주에게는 §45의3~5(특정법인 등)만(§4의2④).
//  [확인 필요 — 법인세법 원문을 이 컴퓨터에 두지 못함] 법인 쪽 부당행위(법인세법 §52·령 §88①·③ 3억/5%)·소득처분(§67·령 §106 대표 상여 등)은 사람이 판정해 「처분」 칸으로 받는다.
//  p: { 방향(개인→법인|법인→개인), 특수관계(예|아니오|모름: 법인세법 §2 12호), 대가, 시가, 처분(예|아니오|모름: 법인세법 §67 상여·배당 등 처분), 처분금액, 처분종류(상여|배당|기타소득|기타사외유출),
//       자산(토지|주택|건물|그밖), 취득가액, 양도비용, 양도일, 주주가족지분(%: 개인 매도인 가족이 가진 법인 지분 합), 정당사유(예|아니오|모름), 엔진칸 }
function judgeCorpIndividualDeal_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const 방향s = String(p.방향 || ''), 법인매수 = /개인\s*→\s*법인|법인에\s*팔|법인\s*매수/.test(방향s) ? true : /법인\s*→\s*개인|법인에서\s*사|개인\s*매수/.test(방향s) ? false : null;
  const 특수 = jmYn_(p.특수관계), 처분 = jmYn_(p.처분), 정당 = jmYn_(p.정당사유);
  const 대가 = num(p.대가), 시가 = num(p.시가), 처분금액 = num(p.처분금액), 취득가액 = num(p.취득가액), 비용 = num(p.양도비용);
  const 양도일 = jmYmd_(p.양도일), 자산 = String(p.자산 || '토지'), 처분종류 = String(p.처분종류 || '');
  const 지분 = famNum_(p.주주가족지분);
  if (법인매수 == null) reqs.push(jmReq_('거래 방향', null, '개인이 법인에 팔았나(개인→법인), 법인에서 샀나(법인→개인)', '소득세법 §96③·소득령 §163⑩'));
  if (!(대가 > 0 && 시가 > 0)) reqs.push(jmReq_('대가와 시가', null, '실제 주고받은 값과 시가(감정·매매사례 등)를 넣어야 차이를 봄', '법인세법 §52 [확인 필요]·상증법 §60'));
  const 차액 = 대가 > 0 && 시가 > 0 ? 대가 - 시가 : null, 고가 = 차액 != null && 차액 > 0, 저가 = 차액 != null && 차액 < 0, ad = 차액 == null ? 0 : Math.abs(차액);
  const 오퍼 = 시가 > 0 && (ad >= 300000000 || ad >= 시가 * 0.05);
  const 기준 = 차액 == null ? '' : '차액 ' + famWon_(ad) + (오퍼 ? ' ≥ 3억 또는 시가 5%(' + famWon_(Math.round(시가 * 0.05)) + ')' : ' < 3억·시가 5%(' + famWon_(Math.round(시가 * 0.05)) + ')');
  reqs.push(jmReq_('특수관계(법인세법 §2 12호)', 특수, 특수 === true ? '대표·주주·그 친족 등 — 부당행위계산 대상' : 특수 === false ? '특수관계 아님 — 부당행위 없음, 고가면 상증법 §35② 30% 기준' : '법인 주주명부·임원 명부·가족관계로 확인', '법인세법 §2 12호·소득세법 §96③ [확인 필요: 법인세법 시행령 §2⑤ 범위]'));
  if (특수 == null) 할일.push({ 무엇: '특수관계 확인 — 주주명부(주식등변동상황명세서)·법인 등기부(임원)·가족관계증명서', 때: '계약 전', 근거: '법인세법 §2 12호' });
  if (차액 === 0) notes.push('대가가 시가와 같아 부당행위·증여 문제는 없습니다. 시가 근거(감정평가서 등)를 남겨 두십시오.');
  let 양도가액 = null, 양도근거 = '', 나중취득 = null, 나중근거 = '', 증여세 = null, 증여근거 = '';
  // 법인 쪽 부당행위가 걸릴지(잠정) — 처분 칸을 모를 때만 씀
  // 법인 쪽 부당행위는 법인이 손해 보는 쪽(법인이 비싸게 삼·싸게 팖)만 — 법인이 싸게 사거나 비싸게 팔면 법인 이익이 늘어 부당행위 아님
  const 법인손해 = (법인매수 === true && 고가) || (법인매수 === false && 저가);
  const 법인부당잠정 = 특수 === true && 오퍼 && 정당 !== true && 법인손해;
  const 처분됨 = 처분 === true ? true : 처분 === false ? false : (특수 === false ? false : (법인부당잠정 ? null : (특수 === true ? false : null)));
  const 처분액 = 처분금액 || (처분됨 !== false && 특수 === true && 오퍼 ? ad : 0);
  if (특수 === true && 법인손해) {
    notes.push('법인 쪽: 특수관계인과 시가와 다른 값으로 거래해 법인 소득을 줄였으면 부당행위계산으로 시가 차액을 익금·손금불산입하고 그 금액을 받은 사람에게 상여·배당 등으로 처분합니다 — 법인세법 §52·§67, 기준 ' + 기준 + ' [확인 필요: 법인세법 시행령 §88③ 3억·5% 기준과 §106 처분 종류, 원문 미대조]');
    if (처분 == null) 할일.push({ 무엇: '법인 세무조정에서 부당행위계산·소득처분(상여·배당 등)을 하는지 법인 담당 세무사·결산서로 확인 — 처분 여부로 개인 양도가액·취득가액·증여세가 갈림', 때: '법인 결산(법인세 신고) 전', 근거: '법인세법 §52·§67 [확인 필요]' });
  }
  if (법인매수 === true) {
    // 개인이 법인에 팖
    if (고가 && 특수 === true) {
      if (처분됨 === true) { 양도가액 = 시가; 양도근거 = '소득세법 §96③1호 — 특수관계법인에 팔고 상여·배당 등 처분 금액이 있어 양도가액은 법인세법 §52 시가 ' + famWon_(시가) + '(대가 ' + famWon_(대가) + ' 아님)'; }
      else if (처분됨 === false) { 양도가액 = 대가; 양도근거 = '처분 금액 없음 — §96③1호가 걸리지 않아 대가 ' + famWon_(대가) + '(법인 쪽 부당행위 기준 아래거나 정당한 사유)'; }
      증여세 = 0; 증여근거 = 처분됨 === false ? '처분이 없는 것은 법인 쪽 부당행위 기준(3억·5%) 아래이거나 정당한 사유가 있는 때 — 차액이 3억·시가 5% 아래면 상증법 §35①(시가 30%·3억 중 적은 금액) 기준에도 못 미쳐 증여 없음 [확인 필요: 정당한 사유로 처분이 없을 때]' : '비싸게 받은 차액은 상여·배당 등 소득으로 소득세 과세 — 증여세 없음(상증법 §4의2③)';
      if (처분됨 !== false) notes.push('차액 ' + famWon_(ad) + '은 ' + (처분종류 || '상여(대표·임원)·배당(주주)') + '로 처분되어 매도인 종합소득세(근로·배당 소득)로 과세됩니다 — 종합소득세 계산 도구는 없음, 법인 원천징수·연말정산 확인 [확인 필요]');
    } else if (고가 && 특수 === false) {
      const gate = 시가 * 0.3, 증여액 = ad >= gate && 정당 !== true ? Math.max(0, ad - 300000000) : 0;
      증여세 = 증여액; 증여근거 = '특수관계 아닌 법인에 비싸게 팖 — 상증법 §35②: 차액 ' + famWon_(ad) + (ad >= gate ? ' ≥ 시가 30%(' + famWon_(Math.round(gate)) + ')' : ' < 시가 30%(' + famWon_(Math.round(gate)) + ')') + (정당 === true ? ', 정당한 사유 있음 — 증여 아님' : '') + ' → 증여재산가액 ' + famWon_(증여액) + '(차액 − 3억)';
      양도가액 = 대가 - 증여액; 양도근거 = '소득세법 §96③2호가 — 대가 ' + famWon_(대가) + ' − §35 증여재산가액 ' + famWon_(증여액) + ' = ' + famWon_(대가 - 증여액) + (증여액 ? '' : '(증여재산가액 0이라 대가 그대로)');
      if (정당 == null && ad >= gate) 할일.push({ 무엇: '「거래의 관행상 정당한 사유」가 있는지(경매·공매·시장 사정 등) — 없으면 §35② 증여', 때: '신고 전', 근거: '상증법 §35②' });
      notes.push('법인이 배당 등으로 처분한 금액이 있으면 §96③2호나목으로 그 금액을 뺍니다 [확인 필요: 소득령 대통령령 금액]');
    } else if (저가) {
      const 시가재계산 = 특수 === true && 오퍼;
      양도가액 = 시가재계산 ? 시가 : (특수 == null && 오퍼 ? null : 대가);
      양도근거 = 시가재계산 ? '소득세법 §101①·소득령 §167③ — 특수관계 법인에 싸게 팔아 ' + 기준 + ': 양도가액을 시가 ' + famWon_(시가) + '로 다시 셈' : 특수 === true ? '부당행위 기준 아래(' + 기준 + ') — 대가 그대로' : 특수 === false ? '특수관계 아님 — 대가 그대로' : '특수관계면 시가(' + famWon_(시가) + '), 아니면 대가 — 잠정';
      증여세 = 0; 증여근거 = '싸게 산 법인은 영리법인 — 받은 이익에 법인세가 붙어 증여세 없음(상증법 §4의2③). 주주에게는 §45의5(특정법인)만 볼 것(§4의2④)';
      if (지분 >= 30) notes.push('매도인 가족이 법인 지분 ' + 지분 + '% — 특정법인(상증법 §45의5)에 싸게 판 것이라 주주(매도인 본인 제외 가족)에게 증여의제가 될 수 있음: 계산기 「특정법인 증여의제」로(주주별 이익 1억 이상만) [확인 필요: 시행령 §34의5 기준]');
      else if (!(지분 > 0)) 할일.push({ 무엇: '법인 주주 구성(매도인 가족 지분 합) 확인 — 30% 이상이면 특정법인 증여의제(상증법 §45의5) 검토', 때: '계약 전', 근거: '상증법 §45의5' });
      notes.push('법인이 개인에게서 싸게 산 부동산은 법인 취득가액이 대가 그대로인 것이 보통이나(저가매입은 부당행위 아님), 유가증권은 다름 — 부동산 법인 처리 [확인 필요: 법인세법 §15②1호·§52]');
    }
  } else if (법인매수 === false) {
    // 개인이 법인에서 삼
    if (저가 && 특수 === true) {
      if (처분됨 === true) { 나중취득 = 대가 + (처분금액 || ad); 나중근거 = '소득령 §163⑩2호 — 특수관계 법인에서 사며 상여·배당 등으로 처분된 금액 ' + famWon_(처분금액 || ad) + '을 나중에 팔 때 취득가액에 더함: ' + famWon_(대가) + ' + ' + famWon_(처분금액 || ad) + ' = ' + famWon_(대가 + (처분금액 || ad)); 증여세 = 0; 증여근거 = '싸게 받은 이익은 상여·배당 등 소득으로 소득세 — 증여세 없음(상증법 §4의2③)'; }
      else if (처분됨 === false) {
        const gate = Math.min(시가 * 0.3, 300000000), 증여액 = ad >= gate && 정당 !== true ? Math.max(0, ad - gate) : 0;
        증여세 = 증여액; 증여근거 = '처분이 없으면 상증법 §35①(특수관계 저가양수): 차액 ' + famWon_(ad) + ', 기준 min(시가 30%, 3억) ' + famWon_(Math.round(gate)) + ' → 증여재산가액 ' + famWon_(증여액) + ' [확인 필요: 법인과 개인 사이 §35① 특수관계 범위]';
        나중취득 = 대가 + 증여액; 나중근거 = 증여액 ? '소득령 §163⑩1호 — 증여세 과세받은 증여재산가액을 더함: ' + famWon_(대가) + ' + ' + famWon_(증여액) : '대가 그대로';
      }
      if (처분됨 == null) { 나중근거 = '처분 여부 잠정 — ① 상여·배당 처분되면 취득가액 ' + famWon_(대가 + ad) + '(소득령 §163⑩2호) ② 처분이 없으면 낸 값 ' + famWon_(대가) + '(차액이 3억·5% 아래면 §35① 30%·3억 기준에도 못 미침)'; }
      notes.push('처분된 금액(' + famWon_(처분금액 || ad) + ')은 ' + (처분종류 || '대표·임원이면 상여, 주주면 배당') + ' — 산 사람 종합소득세 과세 [확인 필요: 처분 종류는 법인세법 시행령 §106]');
    } else if (고가 && 특수 === true) {
      나중근거 = '특수관계 법인에서 비싸게 산 경우 — 법인은 이익이 늘어 부당행위가 아님. 산 개인이 나중에 팔 때 취득가액은 낸 값 ' + famWon_(대가) + '인지 시가 ' + famWon_(시가) + '인지 [확인 필요: 소득세법 §97·소득령 §163, 부당행위로 법인에 이익을 준 것 — 주주에겐 §45의5 검토]';
      나중취득 = null;
      if (지분 >= 30) notes.push('산 개인의 가족이 법인 지분 ' + 지분 + '% — 특정법인에 비싸게 사 준 것이라 다른 주주에게 증여의제(상증법 §45의5) 검토 [확인 필요]');
    } else if (저가 && 특수 === false) {
      const gate = 시가 * 0.3, 증여액 = ad >= gate && 정당 !== true ? Math.max(0, ad - 300000000) : 0;
      증여세 = 증여액; 증여근거 = '특수관계 아닌 법인에서 싸게 삼 — 상증법 §35②: 시가 30% 기준, 증여재산가액 ' + famWon_(증여액);
      나중취득 = 대가 + 증여액; 나중근거 = 증여액 ? '소득령 §163⑩1호 — ' + famWon_(대가) + ' + ' + famWon_(증여액) : '대가 그대로';
    }
  }
  // 엔진칸 — 개인이 법인에 판 경우 양도세
  if (법인매수 === true && 대가 > 0) {
    const base = Object.assign({ assetType: /주택/.test(자산) ? 'house' : /토지/.test(자산) ? 'land' : 'other', acquisitionPrice: 취득가액 || undefined, necessaryExpenses: 비용 || undefined, transferDate: 양도일 || undefined }, p.엔진칸 || {});
    if (고가 && 특수 === true && 처분 == null) {
      경우.push({ 이름: '① 법인이 상여·배당 처분하면 — 양도가액 시가(§96③1호)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 시가 }) });
      경우.push({ 이름: '② 처분이 없으면 — 대가 그대로', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 대가 }) });
    } else if (저가 && 특수 == null && 오퍼) {
      경우.push({ 이름: '① 특수관계면 — 시가로 다시 셈(§101①)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 시가 }) });
      경우.push({ 이름: '② 특수관계 아니면 — 대가 그대로', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 대가 }) });
    } else if (양도가액 != null) {
      경우.push({ 이름: '① 법대로 — 양도가액 ' + famWon_(양도가액), 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 양도가액 }) });
      if (양도가액 !== 대가) 경우.push({ 이름: '② 잘못 — 실제 받은 대가 ' + famWon_(대가) + '로 신고', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 대가 }) });
    }
  }
  if (법인매수 === false && 나중취득 != null) 할일.push({ 무엇: '나중에 이 부동산을 팔 때 취득가액을 ' + famWon_(나중취득) + '로(낸 값 ' + famWon_(대가) + ' 아님) — 처분·증여세 결정 서류를 사건 장부에 남김', 때: '나중 양도 때', 근거: 처분됨 === true ? '소득령 §163⑩2호' : '소득령 §163⑩1호' });
  if (법인매수 != null && 차액 && 특수 !== false) 할일.push({ 무엇: '시가 근거(감정평가서 2곳·매매사례) 확보 — 법인세법 §52 시가와 상증법 시가가 같은 값인지', 때: '계약 전', 근거: '법인세법 §52 [확인 필요]·상증법 §60' });
  const w = jmWrap_('법인거래', reqs, { 방향: 법인매수 === true ? '개인→법인' : 법인매수 === false ? '법인→개인' : null, 차액: 차액, 부당행위기준: 오퍼, 처분: 처분됨, 처분금액: 처분액 || null, 양도가액: 양도가액, 양도가액근거: 양도근거, 나중취득가액: 나중취득, 나중취득가액근거: 나중근거, 증여재산가액: 증여세, 증여근거: 증여근거, 경우: 경우, 알림: notes, 할일: 할일 });
  w.결론 = 법인매수 === true ? (양도가액 != null ? '양도가액 ' + famWon_(양도가액) : '양도가액 잠정(두 경우)') : 법인매수 === false ? (나중취득 != null ? '나중 취득가액 ' + famWon_(나중취득) : '나중 취득가액 [확인 필요]') : '거래 방향 모름';
  if (처분 == null && 법인부당잠정) w.결론 += ' · 법인 처분 잠정';
  w.표시 = '법인·개인 거래 — ' + w.결론 + (증여세 ? ' · 증여재산가액 ' + famWon_(증여세) : 증여세 === 0 ? ' · 증여세 없음' : '');
  return w;
}
// [2026.11.03 복잡사건 94 「노씨 영농상속」] 영농상속공제 요건·재산·사후관리(상증법 §18의3·§18의4, 시행령 §16)
//  ① 피상속인(시행령 §16②): 개인 영농 — 상속개시일 8년 전부터 계속 직접 영농(그 8년 안 질병 요양·수용등으로 못 한 기간은 1년까지 영농으로 봄) + 농지등 소재 시군구·연접·30km 안 거주(1호).
//     법인 영농 — 8년 전부터 계속 경영(질병 요양 기간은 경영으로 봄) + 최대주주등으로 본인·특수관계인 합 50% 이상 계속 보유(2호). 단서: 법인 영농상속 뒤 그때 최대주주등(받은 상속인 빼고)이 죽어 개시되는 상속엔 적용 안 함.
//  ② 상속인(③): 상속개시일 현재 18세 이상 + 개인 — 2년 전부터 계속 직접 영농(§15⑧2호다목 사유·수용등 1년까지는 영농으로 봄)·피상속인이 65세 전에 또는 천재지변 등 부득이하게 죽었으면 2년 요건 없음 + 같은 거주 요건.
//     법인 — 2년 전부터 계속 종사(같은 단서) + 신고기한까지 임원 취임 + 신고기한부터 2년 안 대표이사등 취임. 또는 재정경제부령 영농·영어·임업후계자.
//  ③ 직접 영농(④): 상시 종사 또는 작업 1/2 이상 자기 노동. ⑭(2026.2.27 신설): 사업소득금액(농업·임업·어업·부동산임대·농가부업 빼고)+총급여 3,700만원 이상인 해, 사업 총수입이 소득령 §208⑤2호 기준 이상인 해는 영농 안 한 것으로 봄.
//  ④ 재산(⑤1호): 피상속인이 상속개시일 2년 전부터 영농에 쓴 농지·초지·산림지·어선·어업권·양식업권·축사 등 — 2026.2.27 이후 개시분은 그 자산에 담보된 채무를 뺌. 법인은 주식등 × 사업관련 비율(2호). 한도 30억(§18의3①, 2023년 전 개시는 엔진 연혁).
//  ⑤ 사후관리(§18의3④⑦, 시행령 §16⑥~⑧): 5년 안 정당사유 없이 영농상속재산 처분 또는 영농 미종사 → 공제액 × 100%(처분은 서식 부표6 ㉖ 처분비율) 산입 + 이자상당액, 사유 발생 달 말일부터 6개월 안 신고·납부.
//  ⑥ §18의3⑥ 조세포탈·회계부정 형 확정 → 결정 전이면 공제 안 함. §18의4: 같은 재산에 가업상속공제와 함께 안 됨.
//  p: { 상속개시일, 형태(개인|법인), 피상속인: { 영농:[{시작,끝}], 중단:[{시작,끝,사유:질병|요양|수용|그밖}], 거주(같은시군구|연접|30km|아님), 직접영농(예/아니오), 소득초과해:[연도],
//        사망나이 또는 생년월일, 부득이사망(예/아니오), 경영시작일, 최대주주지분(%) }, 상속인: { 생년월일, 영농:[{시작,끝}], 중단:[…], 거주, 직접영농, 소득초과해, 후계자(예/아니오), 임원취임일, 대표취임일 },
//      재산:[{ 종류, 가액, 담보채무, 영농사용시작일, 가업공제(예=같은 재산에 가업상속공제) }], 주식가액, 사업관련비율(0~1), 포탈형확정(예/아니오),
//      사후: { 처분일, 처분가액, 미종사일, 정당사유(예/아니오/모름) }, 엔진칸(나머지 상속세 칸) }
function judgeFarmInheritance_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const 개시 = jmYmd_(p.상속개시일), 법인 = /법인/.test(String(p.형태 || '')), 새법 = !!개시 && 개시 >= '2026-02-27';
  const 피 = p.피상속인 || {}, 상 = p.상속인 || {};
  if (!개시) reqs.push(jmReq_('상속개시일', null, '사망일을 알아야 8년·2년 기간과 적용 법을 셈', '상증법 §18의3①·시행령 §16②③'));
  // 계속 종사 — 창 [개시−N년, 개시]를 영농 기간(+ 인정 중단 1년까지)이 빈틈없이 덮고, 창 시작 전부터 영농했는지
  const cover = function (who, N, gapRe, label) {
    const 영농 = who.영농 || (who.영농시작일 ? [{ 시작: who.영농시작일, 끝: who.영농끝 }] : []);
    if (!개시 || !영농.length) return { ok: null, why: label + ' 영농 시작·끝 날을 모름' };
    const from = famAddY_(개시, -N);
    let list = jmMerge_(영농.map(function (x) { return { s: jmYmd_(x.시작), e: jmYmd_(x.끝) || 개시 }; }).filter(function (x) { return x.s; }));
    const 처음 = list.length ? list[0].s : '';
    let cut = 0;
    if (새법) [].concat(who.소득초과해 || []).forEach(function (y) { y = String(y).slice(0, 4); if (/^\d{4}$/.test(y) && y + '-12-31' >= from && y + '-01-01' <= 개시) { list = jmCut_(list, y + '-01-01', y + '-12-31'); cut++; } });
    let allow = 0;
    (who.중단 || []).forEach(function (x) { const a = jmYmd_(x.시작), b = jmYmd_(x.끝); if (!a || !b || !gapRe.test(String(x.사유 || ''))) return; const s = a < from ? from : a, e = b > 개시 ? 개시 : b; if (s > e) return; const room = 365 - allow; if (room <= 0) return; const len = Math.min(room, jmDays_(s, e) + 1); allow += len; list = jmMerge_(list.concat([{ s: s, e: famYmd_(new Date(new Date(s).getTime() + (len - 1) * 864e5).toISOString().slice(0, 10)) }])); });
    const inWin = jmMerge_(list.map(function (x) { return { s: x.s < from ? from : x.s, e: x.e > 개시 ? 개시 : x.e }; }).filter(function (x) { return x.s <= x.e; }));
    const total = jmDays_(from, 개시) + 1, got = jmLen_(inWin), hole = total - got;
    const ok = 처음 <= from && hole <= 1;
    if (cut) notes.push(label + ' — 사업소득·총급여 3,700만원 이상인 해 ' + cut + '개를 영농 안 한 해로 뺐습니다(시행령 §16⑭, 2026.2.27 신설). 신설 전 과세기간에도 적용되는지는 부칙을 대조하지 못했습니다 [확인 필요].');
    return { ok: ok, from: from, hole: Math.round(hole), cut: cut, allow: allow, why: (처음 > from ? label + ' 영농 시작 ' + 처음 + ' — ' + from + '보다 늦음' : hole > 1 ? label + ' ' + from + '~' + 개시 + ' 중 ' + Math.round(hole) + '일 빈틈' + (cut ? '(소득 기준 넘은 해 ' + cut + '개 뺌 — 시행령 §16⑭)' : '') : label + ' ' + from + '부터 계속' + (allow ? '(인정 중단 ' + allow + '일 포함)' : '') + (cut ? ' · 소득 기준 넘은 해 없음 확인' : '')) };
  };
  const 거주ok = function (v) { return v == null || v === '' ? null : /같은|연접|30/.test(String(v)) && !/아님|밖/.test(String(v)); };
  // ① 피상속인
  if (!법인) {
    const c = cover(피, 8, /질병|요양|수용|협의매수/, '피상속인');
    reqs.push(jmReq_('피상속인 8년 전부터 계속 직접 영농', c.ok, c.why, '시행령 §16②1호가목' + (새법 ? '·⑭' : '')));
    reqs.push(jmReq_('피상속인 거주(농지등 소재 시군구·연접·30km 안)', 거주ok(피.거주), 피.거주 ? String(피.거주) : '주민등록 초본으로 확인', '시행령 §16②1호나목'));
    reqs.push(jmReq_('피상속인 직접 영농(상시 종사·작업 1/2 이상 자기 노동)', jmYn_(피.직접영농), jmYn_(피.직접영농) == null ? '농업경영체 등록·농지원부·직불금·농협 거래로 확인' : '', '시행령 §16④'));
  } else {
    const c = cover({ 영농: 피.경영시작일 ? [{ 시작: 피.경영시작일 }] : 피.영농, 중단: 피.중단 }, 8, /질병|요양/, '피상속인 경영');
    reqs.push(jmReq_('피상속인 8년 전부터 계속 법인 경영', c.ok, c.why, '시행령 §16②2호가목'));
    const 지분 = famNum_(피.최대주주지분);
    reqs.push(jmReq_('최대주주등·본인과 특수관계인 50% 이상 계속 보유', 피.최대주주지분 == null || 피.최대주주지분 === '' ? null : 지분 >= 50, 피.최대주주지분 == null || 피.최대주주지분 === '' ? '주식등변동상황명세서로 8년 지분 확인' : '합계 ' + 지분 + '%', '시행령 §16②2호나목'));
    notes.push('법인 영농상속 뒤 그때 최대주주등(이번에 받은 상속인 빼고)이 죽어 상속이 개시되면 그 상속엔 영농상속공제가 없습니다(시행령 §16② 단서).');
  }
  // ② 상속인
  const 생 = jmYmd_(상.생년월일), 후계 = jmYn_(상.후계자);
  const 성년 = 개시 && 생 ? famAddY_(생, 18) <= 개시 : null;
  reqs.push(jmReq_('상속인 상속개시일 현재 18세 이상', 성년, 생 ? '생년월일 ' + 생 : '상속인 생년월일을 모름', '시행령 §16③ 본문'));
  if (후계 === true) notes.push('상속인이 영농·영어·임업후계자(재정경제부령)이면 아래 2년 영농·거주 요건 대신 그 지정으로 적용합니다(시행령 §16③ 본문) — 18세 요건은 문언상 「18세 이상으로서 … 경우 또는 후계자인 경우」라 후계자에게도 붙는지 [확인 필요].');
  let 사망나이 = famNum_(피.사망나이);
  if (!(사망나이 > 0) && jmYmd_(피.생년월일) && 개시) { const b = jmYmd_(피.생년월일); 사망나이 = Number(개시.slice(0, 4)) - Number(b.slice(0, 4)) - (개시.slice(5) < b.slice(5) ? 1 : 0); }
  const 면제 = (사망나이 > 0 && 사망나이 < 65) || jmYn_(피.부득이사망) === true;
  if (후계 !== true) {
    if (면제) reqs.push(jmReq_('상속인 2년 전부터 계속 ' + (법인 ? '종사' : '직접 영농'), true, '피상속인이 ' + (사망나이 > 0 && 사망나이 < 65 ? '65세 전(' + 사망나이 + '세) 사망' : '부득이한 사유로 사망') + ' — 2년 요건 없음', 법인 ? '시행령 §16③2호가목 단서' : '시행령 §16③1호가목 단서'));
    else { const c = cover(상, 2, /병역|질병|요양|취학|수용|협의매수|부득이/, '상속인'); reqs.push(jmReq_('상속인 2년 전부터 계속 ' + (법인 ? '종사' : '직접 영농'), c.ok, c.why + (사망나이 > 0 ? ' (피상속인 ' + 사망나이 + '세 사망 — 단서 해당 안 됨)' : ''), (법인 ? '시행령 §16③2호가목' : '시행령 §16③1호가목') + (새법 ? '·⑭' : ''))); }
    if (!법인) reqs.push(jmReq_('상속인 거주(같은 지역)', 거주ok(상.거주), 상.거주 ? String(상.거주) : '주민등록 초본으로 확인', '시행령 §16③1호나목'));
    else {
      const 신고기한 = 개시 ? famYmd_(new Date(Date.UTC(Number(개시.slice(0, 4)), Number(개시.slice(5, 7)) + 6, 0)).toISOString().slice(0, 10)) : '';
      const 임 = jmYmd_(상.임원취임일), 대 = jmYmd_(상.대표취임일), 대기한 = 신고기한 ? famAddY_(신고기한, 2) : '';
      reqs.push(jmReq_('신고기한까지 임원 취임', 임 && 신고기한 ? 임 <= 신고기한 : null, 임 ? '취임 ' + 임 + ' / 기한 ' + 신고기한 : '임원 취임일을 모름(기한 ' + 신고기한 + ')', '시행령 §16③2호나목'));
      reqs.push(jmReq_('신고기한부터 2년 안 대표이사등 취임', 대 && 대기한 ? 대 <= 대기한 : null, 대 ? '취임 ' + 대 + ' / 기한 ' + 대기한 : '대표 취임 전이면 ' + 대기한 + '까지 취임해야 함', '시행령 §16③2호나목'));
      if (!대 && 대기한) 할일.push({ 무엇: '상속인 대표이사등 취임(법인 등기)', 때: 대기한 + '까지', 근거: '시행령 §16③2호나목' });
    }
    reqs.push(jmReq_('상속인 직접 영농', 법인 ? true : jmYn_(상.직접영농), 법인 ? '법인 영농은 종사 요건으로 봄' : jmYn_(상.직접영농) == null ? '농업경영체 등록 등으로 확인' : '', '시행령 §16④'));
  }
  const 포탈 = jmYn_(p.포탈형확정);
  if (포탈 === true) reqs.push(jmReq_('조세포탈·회계부정 형 확정 없음', false, '결정 전에 형이 확정되면 공제 없음', '상증법 §18의3⑥1호'));
  // ④ 재산
  const 담보뺌 = 새법, 두해전 = 개시 ? famAddY_(개시, -2) : '';
  let 대상 = 0, 담보합 = 0, 제외 = 0, 가업겹침 = 0; const 줄 = [];
  (p.재산 || []).forEach(function (a) {
    const 가액 = num(a.가액), 채무 = Math.min(가액, num(a.담보채무)), 시작 = jmYmd_(a.영농사용시작일), 종류 = String(a.종류 || '');
    const 종류ok = /농지|전|답|과수|초지|산림|임야|어선|어업권|양식|축사|염전|창고|부속/.test(종류);
    const 기간ok = 시작 && 두해전 ? 시작 <= 두해전 : null, 겹 = jmYn_(a.가업공제) === true;
    let 넣음 = 종류ok && 기간ok !== false && !겹, 순 = 넣음 ? 가액 - (담보뺌 ? 채무 : 0) : 0;
    if (넣음) { 대상 += 순; if (담보뺌) 담보합 += 채무; } else 제외 += 가액;
    if (겹) 가업겹침 += 가액;
    줄.push({ 종류: 종류, 가액: 가액, 담보채무: 채무, 넣음: 넣음, 순액: 순, 왜: !종류ok ? '영농상속재산 종류 아님(주택·상가 등)' : 기간ok === false ? '피상속인이 ' + 두해전 + ' 뒤부터 영농에 씀(2년 미달)' : 겹 ? '같은 재산에 가업상속공제 — §18의4' : 기간ok == null ? '영농 사용 시작일 모름(잠정 포함)' : (담보뺌 && 채무 ? '담보채무 ' + famWon_(채무) + ' 뺌' : '') });
    if (기간ok == null && 종류ok) 할일.push({ 무엇: 종류 + ' — 피상속인이 ' + (두해전 || '2년 전') + '부터 영농에 썼는지(농지원부·경작 사실 확인서·직불금)', 때: '신고 전', 근거: '시행령 §16⑤1호' });
  });
  const 주식 = num(p.주식가액), 비율 = Math.min(1, Math.max(0, Number(p.사업관련비율) || 0)), 주식몫 = 법인 && 주식 ? Math.round(주식 * (비율 || 1)) : 0;
  if (법인 && 주식 && !(비율 > 0)) notes.push('법인 주식은 (1 − 사업무관 자산 ÷ 총자산) 비율만 들어갑니다(시행령 §16⑤2호) — 비율을 못 받아 100%로 둠(잠정). 계산기 「사업관련 자산비율」 칸에 결산서 숫자를 넣으십시오.');
  대상 += 주식몫;
  if (가업겹침) notes.push('같은 재산 ' + famWon_(가업겹침) + '에 가업상속공제를 받으면 영농상속공제는 그 재산에 못 받습니다(상증법 §18의4) — 다른 재산이면 둘 다 됩니다.');
  if (담보합) notes.push('2026.2.27 이후 개시분이라 영농 자산에 담보된 채무 ' + famWon_(담보합) + '을 빼고 공제 대상을 셈합니다(시행령 §16⑤1호, 부칙 제5조). 서식(2025.3.21. 판)엔 담보채무 칸이 없어 ①에 순액을 적습니다.');
  const 한도 = 개시 && 개시 < '2023-01-01' ? null : 3000000000;
  const w0 = jmWrap_('영농상속', reqs, {});
  const 된다 = w0.결론 === '충족';
  const 공제 = 된다 ? (한도 ? Math.min(대상, 한도) : 대상) : 0;
  if (!한도) notes.push('2023년 전 개시 상속의 한도(20억·15억 등)는 엔진이 상속개시일로 셉니다.');
  // ⑤ 사후관리
  const 후 = p.사후 || {}, 처분일 = jmYmd_(후.처분일), 미종사일 = jmYmd_(후.미종사일), 정당 = jmYn_(후.정당사유), 끝5 = 개시 ? famAddY_(개시, 5) : '';
  const 사유일 = [처분일, 미종사일].filter(Boolean).sort()[0] || '';
  let 추징 = null;
  if (사유일 && 끝5) {
    if (사유일 >= 끝5) notes.push('사유 발생일 ' + 사유일 + '이 상속개시일부터 5년(' + 끝5 + ')이 지나 사후관리 대상이 아닙니다(§18의3④).');
    else if (정당 === true) notes.push('정당한 사유(상속인 사망·해외이주·수용·국가 양도·교환·분합·대토·물납 등, 시행령 §16⑥)면 추징하지 않습니다 — 근거 서류를 남기십시오.');
    else {
      const 처분 = 사유일 === 처분일 && !(미종사일 && 미종사일 <= 처분일);
      const dv = num(후.처분가액), fv = 대상 - 주식몫 > 0 ? 대상 - 주식몫 : 대상;
      추징 = { 사유: 처분 ? '영농상속재산 처분' : '상속인 영농 미종사', 사유일: 사유일, 코드: 처분 ? '07' : '08', 산입액: 처분 && dv && fv ? Math.floor(공제 * Math.min(1, dv / fv)) : 공제, 신고기한: famYmd_(new Date(Date.UTC(Number(사유일.slice(0, 4)), Number(사유일.slice(5, 7)) + 6, 0)).toISOString().slice(0, 10)) };
      if (정당 == null) notes.push('정당한 사유가 있는지 모릅니다(시행령 §16⑥) — 없다고 보고 추징을 셈했습니다(잠정).');
      if (처분 && !(dv && fv)) notes.push('처분한 재산 가액을 모르면 공제 전액을 산입합니다(잠정) — 서식 부표6 ㉖은 처분재산가액 ÷ 영농상속재산가액을 곱합니다.');
      할일.push({ 무엇: '영농상속공제 사후관리 추징 신고·납부(사후관리추징사유 신고 및 자진납부 계산서)', 때: 추징.신고기한 + '까지', 근거: '상증법 §18의3⑦·시행령 §16⑫' });
    }
  }
  if (된다 && 개시) 할일.push({ 무엇: '5년(' + 끝5 + '까지) 영농상속재산을 팔지 말고 상속인이 계속 영농 — 해마다 세무서가 확인(시행령 §16⑬)', 때: 끝5 + '까지', 근거: '상증법 §18의3④' });
  if (된다 || w0.잠정) 할일.push({ 무엇: '영농상속재산명세서와 영농상속 사실 증명 서류(농업경영체 등록 확인서·농지원부·주민등록 초본·소득 금액 증명) 상속세 신고 때 제출', 때: '신고기한까지', 근거: '상증법 §18의3②·시행령 §16⑪' });
  // 엔진 칸 — ① 법대로 ② 흔한 잘못(요건 안 보고 재산 전부 공제)
  const base = Object.assign({ dateOfDeath: 개시 || undefined, isDecedentResident: true }, p.엔진칸 || {});
  const 총가액 = 줄.filter(function (x) { return !/종류 아님/.test(x.왜); }).reduce(function (t, x) { return t + x.가액; }, 0) + 주식; // 흔한 잘못 = 영농 재산이면 요건·2년·담보채무를 안 보고 전부
  const flags = { decedentFarmingRequirementMet: reqs.filter(function (r) { return /피상속인|최대주주/.test(r.이름); }).every(function (r) { return r.결과 === '✔'; }) ? true : reqs.some(function (r) { return /피상속인|최대주주/.test(r.이름) && r.결과 === '✘'; }) ? false : undefined,
    heirAge18OrOlder: 성년 === true ? true : 성년 === false ? false : undefined,
    heirFarmingRequirementMet: reqs.filter(function (r) { return /^상속인|임원|대표/.test(r.이름) && !/18세/.test(r.이름); }).some(function (r) { return r.결과 === '✘'; }) ? false : reqs.filter(function (r) { return /^상속인|임원|대표/.test(r.이름) && !/18세/.test(r.이름); }).every(function (r) { return r.결과 === '✔'; }) ? true : undefined };
  if (포탈 === true) flags.decedentFarmingRequirementMet = false;
  const 개인몫 = 대상 - 주식몫;
  const 법대로 = Object.assign({}, base, 된다 ? { farmingIndividualAssetValue: 개인몫 + (담보뺌 ? 담보합 : 0), farmingIndividualSecuredDebt: 담보뺌 ? 담보합 : undefined, farmingStockValue: 주식몫 || undefined, farmingTotalAssetValue: undefined } : { farmingIndividualAssetValue: 0 }, flags);
  if (주식몫) { 법대로.farmingStockValue = 주식몫; 법대로.farmingTotalAssetValue = 1; 법대로.farmingNonBizAsset55 = 0; } // 이미 비율을 곱한 몫을 넘김
  경우.push({ 이름: '① 법대로 — 영농상속공제 ' + famWon_(공제) + (w0.잠정 ? '(잠정)' : ''), 엔진: 'calculate_inheritance_tax', 엔진칸: 법대로 });
  if (총가액 > 공제) 경우.push({ 이름: '② 잘못 — 요건·재산 안 가리고 영농 재산 ' + famWon_(Math.min(총가액, 3000000000)) + ' 전부 공제', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, { farmingIndividualAssetValue: 총가액 - 주식, farmingStockValue: 주식 || undefined, farmingTotalAssetValue: 주식 ? 1 : undefined, farmingNonBizAsset55: 주식 ? 0 : undefined, decedentFarmingRequirementMet: true, heirAge18OrOlder: true, heirFarmingRequirementMet: true }) });
  if (추징 && 공제) 경우.push({ 이름: '③ 5년 안 ' + 추징.사유 + '(' + 추징.사유일 + ') — 추징', 엔진: 'calculate_succession_deduction_clawback', 엔진칸: { violationCode: 추징.코드, inheritanceDate: 개시, violationDate: 추징.사유일, original: 법대로, deductionAmount: 공제, farmDisposedValue: 추징.코드 === '07' && num(후.처분가액) ? num(후.처분가액) : undefined, farmInheritedValue: 추징.코드 === '07' && num(후.처분가액) ? (개인몫 > 0 ? 개인몫 : 대상) : undefined } });
  const w = jmWrap_('영농상속', reqs, { 공제대상: 대상, 담보채무뺌: 담보합 || null, 주식몫: 주식몫 || null, 제외재산: 제외 || null, 공제: 공제, 한도: 한도, 재산: 줄, 추징: 추징, 엔진칸: 법대로, 경우: 경우, 알림: notes, 할일: 할일 });
  w.결론 = 된다 ? (w0.잠정 ? '공제 ' + famWon_(공제) + '(잠정)' : '공제 ' + famWon_(공제)) : '공제 안 됨';
  w.표시 = '영농상속공제 — ' + w.결론 + (w.남은것.length ? ' · 남은 것 ' + w.남은것.length : '') + (추징 ? ' · 5년 안 ' + 추징.사유 + ' 추징' : '');
  return w;
}
var JUDGE_MORE_ = { '영농상속': judgeFarmInheritance_, '영농상속공제': judgeFarmInheritance_, '영농 상속': judgeFarmInheritance_, '법인거래': judgeCorpIndividualDeal_, '법인 거래': judgeCorpIndividualDeal_, '가족법인 거래': judgeCorpIndividualDeal_, '특수관계법인 거래': judgeCorpIndividualDeal_, '비거주자양도': judgeNonResidentTransfer_, '비거주자 양도': judgeNonResidentTransfer_, '재외국민 양도': judgeNonResidentTransfer_, '외국인 양도': judgeNonResidentTransfer_, '부담부증여': judgeBurdenedGift_, '부담부 증여': judgeBurdenedGift_, '채무 인수 증여': judgeBurdenedGift_, '환산가산세': judgeNewBuildConversion_, '신축 환산 가산세': judgeNewBuildConversion_, '감정가액 가산세': judgeNewBuildConversion_, '미등기': judgeUnregistered_, '미등기양도': judgeUnregistered_, '미등기 양도자산': judgeUnregistered_, '확정신고': judgeFinalReturn_, '확정신고 의무': judgeFinalReturn_, '예정신고 합산': judgeFinalReturn_, '정비청산': judgeRedevCash_, '현금청산': judgeRedevCash_, '재개발 현금청산': judgeRedevCash_, '매도청구': judgeRedevCash_, '의제취득': judgeDeemedAcq_, '의제취득일': judgeDeemedAcq_, '1985년 전 취득': judgeDeemedAcq_, '세대판정': judgeHousehold_, '1세대 범위': judgeHousehold_, '세대 구성': judgeHousehold_, '중과판정': judgeSurcharge_, '다주택 중과': judgeSurcharge_, '중과 제외': judgeSurcharge_, '필요경비': judgeExpenses_, '필요경비 판정': judgeExpenses_, '자본적지출': judgeExpenses_, '주택여부': judgeIsHouse_, '주택 해당': judgeIsHouse_, '사실상 주거용': judgeIsHouse_, '부수토지': judgeHouseLandExcess_, '주택부수토지': judgeHouseLandExcess_, '부수토지 배율': judgeHouseLandExcess_, '양도시기': judgeTransferTiming_, '취득시기': judgeTransferTiming_, '양도·취득시기': judgeTransferTiming_, '보상금구분': judgeCompensationSplit_, '수용보상금': judgeCompensationSplit_, '보상금 가르기': judgeCompensationSplit_, '대토보상': judgeLandReplacement_, '대토': judgeLandReplacement_, '대토보상 과세이연': judgeLandReplacement_, '부동산매매업': judgeRealEstateDealer_, '매매업': judgeRealEstateDealer_, '부동산 단타': judgeRealEstateDealer_, '공동상속': judgeCoInheritedHouse_, '공동상속주택': judgeCoInheritedHouse_, '공동상속주택 소수지분': judgeCoInheritedHouse_, '다가구': judgeMultiHousehold_, '다가구주택': judgeMultiHousehold_, '다가구 한 채': judgeMultiHousehold_, '상속채무': judgeInheritDebt_, '상속 채무 공제': judgeInheritDebt_, '채무 공과금 장례비': judgeInheritDebt_, '토지건물구분': judgeLandBuildingSplit_, '일괄양도 안분': judgeLandBuildingSplit_, '토지 건물 가액 구분': judgeLandBuildingSplit_, '상속평가': judgeInheritValuation_, '상속 평가 선택': judgeInheritValuation_, '감정평가 신고': judgeInheritValuation_, '증여시기': judgeGiftTiming_, '증여 날짜': judgeGiftTiming_, '증여일 고르기': judgeGiftTiming_, '생활비교육비': judgeFamilySupportGift_, '비과세증여': judgeFamilySupportGift_, '혼인출산공제': judgeFamilySupportGift_, '세무조사절차': judgeTaxAudit_, '세무조사': judgeTaxAudit_, '세무조사 통지': judgeTaxAudit_, '세금대납': judgeTaxProxyPay_, '상속세 대납': judgeTaxProxyPay_, '증여세 대납': judgeTaxProxyPay_, '차명계좌': judgeBorrowedAccount_, '차명 예금': judgeBorrowedAccount_, '차명계좌 증여추정': judgeBorrowedAccount_, '부동산명의신탁': judgeNomineeRealty_, '명의신탁 부동산': judgeNomineeRealty_, '제2차납세의무': judgeSecondaryLiability_, '제2차 납세의무': judgeSecondaryLiability_, '과점주주': judgeSecondaryLiability_, '특별연고자': judgeSpecialRelation_, '특별연고자 분여': judgeSpecialRelation_, '재산분여': judgeSpecialRelation_, '기타자산': judgeOtherAsset_, '영업권': judgeOtherAsset_, '회원권': judgeOtherAsset_, '영업권·회원권': judgeOtherAsset_, '한정승인': judgeLimitedAccept_, '상속 한정승인': judgeLimitedAccept_, '특별한정승인': judgeLimitedAccept_, '국외증여': judgeForeignGift_, '국외 증여': judgeForeignGift_, '국외재산 증여': judgeForeignGift_, '거주자': judgeResidency_, '거주자 판정': judgeResidency_, '비거주자': judgeResidency_, '상속인': judgeHeirShares_, '법정상속분': judgeHeirShares_, '상속인·법정상속분': judgeHeirShares_, '불복기한': judgeAppealDeadline_, '불복': judgeAppealDeadline_, '경정청구기한': judgeAppealDeadline_, '양도여부': judgeTransferScope_, '계약해제': function (p) { p = Object.assign({}, p || {}); if (!p.유형) p.유형 = '계약해제'; return judgeTransferScope_(p); }, '양도로 보지 않음': judgeTransferScope_, '농지대토': judgeFarmSwap_, '대토': judgeFarmSwap_, '농지대토 감면': judgeFarmSwap_, '법인전환': judgeIncorp32_, '법인전환 이월과세': judgeIncorp32_, '8년자경': judgeSelfFarm_, '자경': judgeSelfFarm_, '8년 자경농지 감면': judgeSelfFarm_, '동거주택': judgeCohabit_, '동거주택 상속공제': judgeCohabit_, '가업상속': judgeFamilyBiz_, '가업상속공제': judgeFamilyBiz_ };
// 사건에서 부름(ledgerJudgeRun_가 1세대1주택이 아닌 묶음을 넘김) — 사실(facts)은 넥스·세무사님이 준 값, 결과는 장부 기록 + 물건 줄 판정 묶음들 + 장부 판정 칸(L.judge)
function judgeMoreRun_(c, input, by) {
  const kind = String(input.묶음 || input.group || ''), fn = JUDGE_MORE_[kind.replace(/\s+/g, ' ').trim()] || JUDGE_MORE_[kind.replace(/\s/g, '')];
  if (!fn) return { ok: false, error: '없는 묶음: ' + kind + ' — 1세대1주택·8년자경·농지대토·양도여부·계약해제·한정승인·특별연고자·제2차납세의무·부동산명의신탁·차명계좌·세금대납·세무조사절차·생활비교육비·증여시기·상속평가·토지건물구분·상속채무·다가구·공동상속·부동산매매업·대토보상·보상금구분·양도시기·부수토지·주택여부·필요경비·중과판정·세대판정·의제취득·정비청산·확정신고·미등기·환산가산세·부담부증여·비거주자양도·법인거래·영농상속·기타자산·불복기한·상속인·거주자·동거주택·가업상속·법인전환·국외증여 중 하나' };
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
