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
    notes.push('특례 증여 주식(' + (jmYmd_(sg.증여일) || '증여일 모름') + (sgVal ? ', 가업자산상당액 ' + famWon_(sgVal) : '') + ')은 기간과 관계없이 상속세 과세가액에 더하고(조특법 §30의6⑤→§30의5⑨) 상속개시일 현재 요건을 갖추면 가업상속공제 대상(조특령 §27의6⑨) — 공제 대상 가액에 더했음' + (sgVal ? '' : ' [가업자산상당액을 넣을 것]') + ' · 그 가액은 증여 당시 가액으로 봄 [확인 필요 — 권장: 해석① 과세가액에 가산된 증여 당시 가액 그대로 공제 대상(가산액을 넘는 공제 불가, 일관) / 해석② 상속개시일 현재 평가(상증령 §15⑤ 준용). 권장 ①(코드 그대로)]');
    notes.push('상속인 요건(시행령 §15③2호 — 18세·2년 종사·임원 취임) 중 무엇을 그대로 보는지 (원문 확인 2026-11-04: 조특령 §27의6⑨1호 단서·3호) — 그대로 대조함');
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
  const how = String(p.전환방법 || ''), 통합 = /통합|31/.test(String(p.특례 || '') + how), 양수도 = !통합 && /양수|양도/.test(how);
  // [2026.11.03 복잡사건 121 「석씨 공장 둘 통합」] 조특법 §31(중소기업 간 통합) 갈래 — 요건(시행령 §28①②)이 §32와 달라 따로 대조, 사후관리(§31⑦·시행령 §28⑨⑩⑪)는 같은 셈을 쓰되 기산일 = 통합일(사업용고정자산 양도일)
  if (통합) {
    reqs.push(jmReq_('소멸하는 사업자가 중소기업자(중소기업기본법)', jmYn_(p.중소기업), '직전 사업연도 기준 중소기업 확인서', '조특법 §31① · 시행령 §28①'));
    reqs.push(jmReq_('소비성서비스업이 아님(겸영이면 직전 사업연도 수입금액이 가장 큰 사업이 소비성서비스업이 아닐 것)', p.소비성서비스업 == null || p.소비성서비스업 === '' ? null : !jmYn_(p.소비성서비스업), String(p.업종 || ''), '시행령 §28① · §29③'));
    reqs.push(jmReq_('사업장별로 그 사업의 주된 자산을 모두 승계해 사업의 동일성 유지', jmYn_(p.주된자산모두승계), p.주된자산모두승계 == null ? '승계한 자산 목록·사업 계속 여부' : '', '시행령 §28①'));
    reqs.push(jmReq_('소멸하는 사업장의 중소기업자가 통합법인의 주주·출자자', jmYn_(p.통합법인주주), '', '시행령 §28①1호'));
    const 법인설립 = jmYmd_(p.통합법인설립일), 통합일0 = jmYmd_(p.통합일);
    const 일년안 = 법인설립 && 통합일0 ? famAddY_(법인설립, 1) > 통합일0 : null;
    reqs.push(jmReq_('설립 1년 안 된 법인이 출자자인 과점주주 개인의 사업을 승계한 것이 아님', 일년안 == null ? null : !(일년안 && jmYn_(p.과점주주) === true), 법인설립 ? '통합법인 설립 ' + 법인설립 + (일년안 ? ' — 통합일까지 1년 안 됨' + (p.과점주주 == null ? ', 과점주주(국세기본법 §39②)인지 모름' : '') : ' — 1년 넘음') : '통합법인 설립일', '시행령 §28① 후단'));
  } else {
  reqs.push(jmReq_('현물출자 또는 사업 양도·양수 방법', !how ? null : /현물|양수|양도/.test(how), how || '전환 방법을 모름', '조특법 §32①'));
  reqs.push(jmReq_('새 법인이 소비성서비스업(호텔·여관(관광숙박업 빼고)·일정 주점업·오락·유흥 등)을 하지 않음', p.소비성서비스업 == null || p.소비성서비스업 === '' ? null : !jmYn_(p.소비성서비스업), String(p.업종 || ''), '조특법 §32① · 시행령 §29③'));
  }
  const assets = Array.isArray(p.자산) ? p.자산 : [], 대상 = [], 제외 = [];
  assets.forEach(function (a) {
    const kind = String(a.종류 || ''), use = jmYn_(a.사업사용);
    const why = !통합 && /주택|입주권|분양권/.test(kind) ? '주택·주택을 취득할 수 있는 권리(§32① 단서, 2020.12.29 개정)' : 통합 && jmYn_(a.업무무관) === true ? '업무와 관련 없는 부동산(시행령 §28② 괄호)' : use === false ? '사업에 직접 쓰지 않음(시행령 §28②)' : '';
    (why ? 제외 : 대상).push({ 이름: a.이름 || kind, 종류: kind, 시가: famNum_(a.시가), 왜: why });
  });
  reqs.push(jmReq_(통합 ? '이월과세 대상 사업용고정자산(사업에 직접 쓰는 유형·무형자산, 업무무관 부동산 빼고)이 있음' : '이월과세 대상 사업용고정자산이 있음(주택·입주권·분양권 빼고)', assets.length ? 대상.length > 0 : null, assets.length ? '대상 ' + 대상.length + '건 · 제외 ' + 제외.length + '건' : '자산 목록을 모름', 통합 ? '조특법 §31① · 시행령 §28②' : '조특법 §32① · 시행령 §28②'));
  const 자산합 = assets.reduce(function (t, a) { return t + famNum_(a.시가); }, 0), 부채 = famNum_(p.부채), 순자산 = assets.length ? 자산합 - 부채 : null;
  const cap = p.자본금 == null || p.자본금 === '' ? null : famNum_(p.자본금);
  if (통합) { const 주식 = p.받은주식가액 == null || p.받은주식가액 === '' ? null : famNum_(p.받은주식가액); reqs.push(jmReq_('통합으로 받은 주식·지분 가액 ≥ 소멸하는 사업장의 순자산가액(통합일 시가 자산 − 충당금 포함 부채)', 주식 == null || 순자산 == null ? null : 주식 >= 순자산, 순자산 == null ? '자산 시가를 모름' : '순자산 ' + famWon_(순자산) + (주식 == null ? ' · 받은 주식 가액 모름' : ' · 받은 주식 ' + famWon_(주식)), '시행령 §28①2호')); }
  else reqs.push(jmReq_('새 법인 자본금 ≥ 전환하는 사업장의 순자산가액(시가 자산 − 충당금 포함 부채)', cap == null || 순자산 == null ? null : cap >= 순자산, 순자산 == null ? '자산 시가를 모름' : '순자산 ' + famWon_(순자산) + (cap == null ? ' · 자본금 모름' : ' · 자본금 ' + famWon_(cap)), '조특법 §32② · 시행령 §29⑤ · §28①2호'));
  const 설립 = jmYmd_(p.법인설립일 || p.설립등기일), 등기 = jmYmd_(p.설립등기일 || p.법인설립일);
  if (양수도) {
    reqs.push(jmReq_('사업을 하던 거주자가 발기인이 되어 순자산가액 이상 출자', jmYn_(p.발기인출자), '', '시행령 §29②'));
    const 양도일 = jmYmd_(p.사업양도일);
    reqs.push(jmReq_('법인 설립일부터 3개월 안에 사업 전부를 포괄 양도', 양도일 && 설립 ? (function () { const t = new Date(설립); t.setUTCMonth(t.getUTCMonth() + 3); return 양도일 <= t.toISOString().slice(0, 10); })() : null, 양도일 ? '양도일 ' + 양도일 : '사업 양도일을 모름', '시행령 §29②'));
  }
  const 전환일 = 통합 ? jmYmd_(p.통합일) : jmYmd_(p.현물출자일 || p.사업양도일 || p.설립등기일);
  if (전환일) {
    const y = Number(전환일.slice(0, 4)), m = Number(전환일.slice(5, 7)) + 2, due = new Date(Date.UTC(y + Math.floor((m - 1) / 12), ((m - 1) % 12) + 1, 0)).toISOString().slice(0, 10);
    const ap = String(p.적용신청 == null ? '' : p.적용신청);
    reqs.push(jmReq_('이월과세적용신청서를 그 해 과세표준신고(예정신고 포함) 때 ' + (통합 ? '통합법인' : '새 법인') + '과 함께 냄', /예정|앞으로/.test(ap) ? null : jmYn_(ap), /예정|앞으로/.test(ap) || !ap ? '예정신고기한 ' + due + ' — 할 일로 남김' : '', 통합 ? '조특법 §31③ · 시행령 §28③' : '조특법 §32③ · 시행령 §29④'));
    할일.push({ 무엇: '양도소득 예정신고 + 이월과세적용신청서(법인과 함께) 제출 — 시행령 ' + (통합 ? '§28③' : '§29④') + ' (원문 확인 2026-11-04: 조특령 §28③·§29④ ’과세표준신고(예정신고를 포함한다)시’) 예정신고 때 못 냈으면 확정신고 때 내도 되는지', 때: due });
  }
  if (제외.length) notes.push('이월과세 안 되는 자산(지금 과세): ' + 제외.map(function (x) { return x.이름 + '(' + x.왜 + ')'; }).join(' · ') + ' — 같은 해 다른 양도로 보고 따로 셈한다. 주택이면 1세대1주택 판정을 따로 돌릴 것');
  notes.push('이월과세액 = 대상 자산을 그 과세기간의 유일한 양도자산으로 보고 셈한 양도소득 산출세액(조특법 §2①6호) — 양도세 계산기를 대상 자산만 넣어 한 번 더 돌린 값. 법인이 뒤에 그 자산을 팔면 법인세로 냄');
  // 사후관리 5년(§32⑤) — 처분 계획을 쌓아 50% 넘는 날을 찾는다
  const 기산 = 통합 ? jmYmd_(p.통합일) : 등기;
  if (기산) {
    const end = famAddY_(기산, 5);
    할일.push({ 무엇: '사후관리 5년(' + 기산 + '~' + end + '): 승계 사업 폐지(법인이 사업용고정자산 절반 이상 처분하거나 사업에 안 씀) · 전환으로 받은 주식 50% 이상 처분(유상·무상이전·감자 포함)이면 이월과세액 납부(' + (통합 ? '조특법 §31⑦ · 시행령 §28⑨⑩' : '조특법 §32⑤ · 시행령 §29⑥⑦') + ')', 때: end });
    const plan = (Array.isArray(p.처분) ? p.처분 : []).map(function (x) { return { 날짜: jmYmd_(x.날짜), 비율: Number(String(x.비율 == null ? '' : x.비율).replace(/[^\d.]/g, '')) || 0, 방법: String(x.방법 || ''), 특례: jmYn_(x.가업승계특례) }; }).filter(function (x) { return x.날짜; }).sort(function (a, b) { return a.날짜 < b.날짜 ? -1 : 1; });
    let acc = 0, hit = null;
    plan.forEach(function (x) {
      if (x.날짜 > end || hit) return;
      const 예외 = /사망|상속|파산|합병|분할|회생|포괄적\s*교환|법령상\s*의무/.test(x.방법) || (/증여/.test(x.방법) && x.특례 === true);
      if (/증여/.test(x.방법) && x.특례 !== true) notes.push(x.날짜 + ' ' + x.비율 + '% 증여 — 가업승계 증여세 특례(조특법 §30의6)를 받아야만 처분에서 빠짐(시행령 §29⑦6호, 받으면 받은 사람이 남은 기간을 이어 짐 §29⑧). [판단 대기 — 판단거리3차 #1: 별표 원문 없어 결론 못 냄. 권장: 임대업 법인은 가업 아님으로 보고 특례 없이 처분으로 셈(현 안내 유지), 별표 확인 뒤 확정] 부동산임대업 법인 주식은 §30의6의 "가업"(상증법 §18의2·시행령 §15 별표 업종)에 들지 않을 수 있음');
      if (!예외) { acc += x.비율; if (acc >= 50) hit = { 날짜: x.날짜, 누적: acc }; }
    });
    if (hit) {
      const y = Number(hit.날짜.slice(0, 4)), m = Number(hit.날짜.slice(5, 7)) + 2, due = new Date(Date.UTC(y + Math.floor((m - 1) / 12), ((m - 1) % 12) + 1, 0)).toISOString().slice(0, 10);
      notes.push('⚠ 처분 계획대로면 ' + hit.날짜 + ' 누적 ' + hit.누적 + '% — 5년 안 50% 이상 처분으로 이월과세액(법인이 이미 낸 세액 빼고)을 ' + due + '까지 양도소득세로 내야 함(' + (통합 ? '조특법 §31⑦2호' : '조특법 §32⑤2호·전단') + ')');
      할일.push({ 무엇: '이월과세액 납부(사후관리 위반 ' + hit.날짜 + ')', 때: due });
    } else if (plan.length) notes.push('처분 계획 누적 ' + acc + '% — 5년 안 50% 미만(예외 처분 빼고)');
  }
  if (통합) { notes.push('통합법인은 남은 감면기간 동안 창업중소기업(§6)·농공단지 등(§64)·수도권 밖 이전(§63)·농업회사법인(§68) 감면을 이어 받고(§31④⑤·시행령 §28④~⑦), 미공제 세액을 승계(§31⑥·시행령 §28⑧) — 법인세 영역, 이 도구는 양도소득세만 셈'); notes.push('주택도 사업에 직접 쓰는 사업용고정자산이면 §31 대상에서 빠지지 않음(§32① 단서 같은 주택 제외가 §31엔 없음) (원문 확인 2026-11-04: 조특법 §31① · §32① 단서 · 조특령 §28②)'); }
  return jmWrap_(통합 ? '중소기업 간 통합 이월과세' : '법인전환 이월과세', reqs, { 특례: 통합 ? '조특법 §31' : '조특법 §32', 사후관리기산일: 기산 || null, 대상자산: 대상, 제외자산: 제외, 순자산가액: 순자산, 알림: notes, 할일: 할일, 엔진칸: { provision: 통합 ? 'sect31' : 'sect32', triggerEvent: 'none' }, 엔진칸뜻: '사후관리 셈(calculate_business_transfer_carryover)에 그대로 — deferredTaxAmount(이월과세액)는 양도세 계산기를 대상 자산만 넣어 돌린 산출세액으로 채움' });
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
    if (valOk !== null) notes.push('가액 비교의 "가액"은 법령에 정의가 없음 — 실지거래가액끼리 견줌 [확인 필요 — 권장: 해석① 실지거래가액(양도·취득가액 원칙 소득세법 §96·§97) / 해석② 기준시가. 권장 ① — 코드 그대로, 다만 실가가 없으면 기준시가로 견주도록 안내]');
  }
  // 5) 새 농지 경작 개시 1년 안(1호: 새 취득일부터, 2호: 종전 양도일부터)
  const 개시기점 = 새취득 && 양도 ? (새취득 >= 양도 ? 새취득 : 양도) : '';
  const 새시작 = jmYmd_(p.새경작시작일);
  if (개시기점) {
    const due = famAddY_(개시기점, 1), 부득이 = jmYn_(p.부득이사유) === true;
    if (새시작) reqs.push(jmReq_('새 농지 소재지에 살며 경작 개시(' + 개시기점 + '부터 1년 안)', 새시작 <= due ? true : 부득이 ? null : false, '개시 ' + 새시작 + ' · 기한 ' + due + (부득이 && 새시작 > due ? ' — 질병 요양 등 부득이 사유 기간은 시행규칙으로 확인 [실사건 때 확인]' : ''), '조특령 §67③1·2호, ⑩2호'));
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
    if (broken) { reqs.push(jmReq_('새 농지 계속 경작(합산 8년 전에 소득 기준 넘은 해 없음)', false, broken + '년 소득 기준(사업소득+총급여 3,700만원 등) 넘음 — 계속 경작하지 않은 것으로 봄', '조특령 §67⑥·⑩4호·§66⑭')); claw(broken + '년 소득 기준 넘음', broken + '-01-01'); notes.push('소득 기준 넘은 해의 사유발생일을 그해 1월 1일로 둠 [확인 필요 — 권장: 해석① 그 과세기간 1월 1일(코드) / 해석② 과세기간 종료일(소득 초과는 연말에 확정). 권장 ② — 납부기한은 다음 해 2월 말, 이자상당액은 예정신고납부기한부터라 영향 없음]'); }
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
  if (jmYmd_(p.새편입일)) notes.push('새 농지의 편입 3년은 취득일 기준으로 셈 [확인 필요 — 권장: 새 농지에도 §67⑧이 걸리는 것은 분명(§70②). 기준일은 문언이 ’양도일 현재’뿐 — 해석① 종전 농지 양도일 현재 / 해석② 새 농지 취득일 현재(코드). 권장: 취득이 양도 뒤면 취득일, 앞이면 양도일로 …]');
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
    reqs.push(jmReq_('분할 뒤 내 몫 가액이 내 지분 비율과 같거나, 줄어든 몫에 대가를 받지 않음', known ? (same || 몫 > 지분 || !받음) : null, known ? '지분 ' + Math.round(지분 * 1000) / 10 + '% · 받은 몫 ' + Math.round(몫 * 1000) / 10 + '%' : '분할 뒤 몫의 가액 비율(감정가로)을 모름', '소득세법 §88 1호(유상 이전만 양도) — 지분 범위 안의 공유물 분할은 양도 아님 [판단 대기 — 판단거리3차 #2: 법문에 공유물 분할 규정 없음 — 지분대로 나누고 정산금 없으면 소유 형태 변경일 뿐 유상 이전 아님(통설·실무). 권장: 현 판정 유지, 근거는 ’§88 1호 반대해석’으로 적음]'));
    reqs.push(jmReq_('정산금을 받지 않음(준 쪽은 그만큼 새로 취득)', 받음 ? false : (p.정산금받음 == null && p.정산금줌 == null ? null : true), 받음 ? '받음 ' + 받음.toLocaleString() + '원' : 줌 ? '줌 ' + 줌.toLocaleString() + '원 — 양도 아닌 취득' : '', '소득세법 §88 1호·5호(대가관계 금전)'));
    if (known && 몫 < 지분 - 0.005) {
      const r_ = (지분 - 몫) / 지분;
      if (받음) {
        양도부분 = { 무엇: '지분 중 줄어든 ' + Math.round((지분 - 몫) * 1000) / 10 + '%p(내 지분의 ' + Math.round(r_ * 1000) / 10 + '%)', 양도일: jmYmd_(p.날짜), 양도가액: 받음, 취득가액: n(p.내취득가액) ? Math.round(n(p.내취득가액) * r_) : null, 취득일: jmYmd_(p.내취득일) || '', 근거: '소득세법 §88 1호·§96①(실지거래가액 = 받은 정산금)·§97①(취득가액은 지분 비율로 나눔)' };
        if (시가 && Math.abs(받음 - 시가 * (지분 - 몫)) > 시가 * (지분 - 몫) * 0.3) notes.push('정산금 ' + 받음.toLocaleString() + '원이 넘긴 몫의 시가(' + Math.round(시가 * (지분 - 몫)).toLocaleString() + '원)와 30% 넘게 차이 — 특수관계(형제 등)면 부당행위계산 부인(소득세법 §101·시행령 §167③④: 시가 차이 3억 이상 또는 5% 이상)과 저가양수 증여(상증법 §35) 함께 볼 것');
      } else notes.push('내 몫이 지분보다 적은데 정산금이 없음 — 넘긴 몫(시가 ' + (시가 ? Math.round(시가 * (지분 - 몫)).toLocaleString() + '원' : '모름') + ')은 많이 받은 공유자에게 증여(상증법 §4①) — 증여세 판정으로 넘길 것');
    }
    if (known && 몫 > 지분 + 0.005) notes.push('내 몫이 지분보다 큼 — 늘어난 ' + Math.round((몫 - 지분) * 1000) / 10 + '%p는 분할일에 새로 취득(정산금을 줬으면 그 금액이 취득가액, 안 줬으면 증여로 받음). 뒤에 팔 때 두 부분의 취득일·취득가액을 나눠 셈(소득세법 시행령 §162)');
    notes.push('지분 범위 안 분할이면 분할 뒤 토지의 취득일·취득가액은 처음 공유지분을 취득한 때 그대로 [확인 필요 — 권장: 양도가 아니면 취득도 없으므로 원 취득일·가액 그대로가 논리적 귀결. 권장 유지]');
  } else if (/교환/.test(유형)) {
    const a = n(p.분할면적합), b = n(p.분할전면적합);
    reqs.push(jmReq_('불합리한 지상 경계를 합리적으로 바꾸려는 교환', jmYn_(p.경계조정목적), '', '소득세법 시행령 §152③1호'));
    reqs.push(jmReq_('공간정보법 등에 따라 토지를 분할해 교환', jmYn_(p.법에따른분할), '', '소득세법 시행령 §152③1호'));
    reqs.push(jmReq_('분할된 토지 면적 합이 분할 전 전체 면적의 20% 이하', a && b ? a <= b * 0.2 : null, a && b ? Math.round(a / b * 1000) / 10 + '%(' + a + '/' + b + '㎡)' : '분할 면적·전체 면적을 모름', '소득세법 시행령 §152③2호'));
    reqs.push(jmReq_('요건 입증 자료 제출', jmYn_(p.입증자료제출), jmYn_(p.입증자료제출) === null ? '세무서에 낼 자료(국세청 고시)' : '', '소득세법 시행령 §152④⑤'));
    const 받은 = n(p.받은토지시가), 받음 = n(p.받은정산금), 줌 = n(p.준정산금);
    if (받은 || 받음) {
      const 가액 = 받은 + 받음 - 줌;
      양도부분 = { 무엇: '교환으로 넘긴 토지(경계 조정 요건을 못 갖추면 교환 = 양도)', 양도일: jmYmd_(p.날짜), 양도가액: 가액, 취득가액: n(p.내취득가액) || null, 취득일: jmYmd_(p.내취득일) || '', 근거: '소득세법 §88 1호(교환은 양도)·5호(대가관계에 있는 금전과 그 밖의 재산가액) — 받은 토지 시가 + 받은 정산금 − 준 정산금 [확인 필요 — 권장: 권장: 받은 자산 시가(감정) ± 정산금(실지거래가액 해석)·시가 못 구하면 넘긴 토지 시가 — 현 산식 유지]' };
      notes.push('교환으로 받은 토지는 같은 날 취득 — 그 취득가액도 넘긴 토지 시가 + 준 정산금 − 받은 정산금으로 장부에 둘 것 [확인 필요 — 권장: 받은 토지 취득가액 = 교환 당시 받은 토지의 시가(= 넘긴 토지 시가 + 준 정산금 − 받은 정산금)로 보는 해석이 양도가액과 대칭. 권장 유지]');
    }
  } else if (/담보/.test(유형)) {
    reqs.push(jmReq_('채무 변제를 담보하려고 양도한다는 의사표시', jmYn_(p.담보의사), '', '소득세법 시행령 §151①1호'));
    reqs.push(jmReq_('채무자가 그 자산을 원래대로 사용·수익한다는 의사표시', jmYn_(p.사용수익유지), '', '소득세법 시행령 §151①2호'));
    reqs.push(jmReq_('원금·이율·변제기한·변제방법 약정', jmYn_(p.채무약정), '', '소득세법 시행령 §151①3호'));
    reqs.push(jmReq_('위 요건을 갖춘 계약서 사본을 확정신고서에 첨부', jmYn_(p.계약서사본첨부), jmYn_(p.계약서사본첨부) === null ? '확정신고 때 첨부해야 양도로 안 봄' : '', '소득세법 시행령 §151①'));
    const 충당 = jmYmd_(p.변제충당일);
    if (충당) { reqs.push(jmReq_('요건 위배·채무불이행으로 변제에 충당하지 않음', false, '변제 충당 ' + 충당 + ' — 그때 양도', '소득세법 시행령 §151②')); 양도부분 = { 무엇: '담보 자산 전체(변제 충당)', 양도일: 충당, 양도가액: null, 근거: '소득세법 시행령 §151② — 양도가액은 충당한 채무액 등 실지거래가액 (원문 확인 2026-11-04: 소득세법 시행령 §151② · §96①(실지거래가액))' }; }
    할일.push({ 무엇: '양도담보 계약서 사본을 양도소득 과세표준 확정신고서에 첨부', 때: '계약한 해의 다음 해 5월(확정신고 기한)' });
  } else if (/신탁/.test(유형)) {
    const 지배 = jmYn_(p.실질지배) === true || jmYn_(p.신탁해지가능) === true || jmYn_(p.수익자변경가능) === true ? true : (jmYn_(p.실질지배) === false && jmYn_(p.신탁해지가능) === false && jmYn_(p.수익자변경가능) === false ? false : null);
    reqs.push(jmReq_('위탁자가 신탁을 해지하거나 수익자를 바꿀 수 있는 등 신탁재산을 실질 지배·소유', 지배, 지배 === null ? '신탁계약서의 해지·수익자 변경 조항 확인' : '', '소득세법 §88 1호다목'));
    if (jmYn_(p.수익자변경가능) === false && jmYn_(p.신탁해지가능) === false) notes.push('위탁자가 해지·수익자 변경을 못 하고 수익자가 남이면 수익권을 넘긴 것 — 양도 또는 증여(상증법 §33 신탁이익 증여)로 따로 볼 것');
  } else if (/환지/.test(유형)) {
    reqs.push(jmReq_('도시개발법 등에 따른 환지처분(지목·지번 변경) 또는 보류지 충당', jmYn_(p.환지처분) === true || jmYn_(p.보류지충당) === true ? true : jmYn_(p.환지처분), '', '소득세법 §88 1호가목·시행령 §152①②'));
    const 청산 = n(p.청산금받음);
    if (청산) {
      reqs.push(jmReq_('환지청산금을 받지 않음', false, '청산금 ' + 청산.toLocaleString() + '원 받음 — 그 부분은 양도', '소득세법 §88 1호(유상 이전) (원문 확인 2026-11-04: 소득세법 §88 1호가목 · 시행령 §162①9호 단서)'));
      const 권리 = n(p.권리가액), r_ = 권리 ? 청산 / 권리 : null;
      양도부분 = { 무엇: '환지청산금 받은 부분(권리면적보다 줄어든 면적)', 양도일: jmYmd_(p.공고일) ? famAddD_(jmYmd_(p.공고일), 1) : '', 양도일근거: '환지처분 공고일 다음 날(소득세법 시행령 §162①9호 단서)', 양도가액: 청산, 취득가액: n(p.내취득가액) && r_ ? Math.round(n(p.내취득가액) * r_) : null, 취득일: jmYmd_(p.내취득일) || '', 근거: '취득가액 = 내 취득가액 × 청산금 ÷ 권리가액 [확인 필요 — 권장: 해석① 청산금÷권리가액(코드) / 해석② 감소 면적÷종전 면적. 권장 ②(법령이 면적 단위로 규정) — 권리가액 모를 때 대안으로도 유리]' };
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
        if (/법정|약정|취소|무효/.test(종류)) { ok = true; why = 종류 + ' — 계약이 처음부터 없던 것이 되어 양도 없음 [판단 대기 — 판단거리3차 #3: 법령은 ’해제권 행사에 의한 해제’를 경정 사유로 전제하므로 양도 소멸 취급이 법체계에 부합(판례 번호는 원문 없음). 권장 유지]'; }
        else if (/합의/.test(종류)) {
          const 기한 = jmYmd_(p.법정신고기한), 부득 = jmYn_(p.부득이사유);
          if (부득 === true) { ok = true; why = '합의해제지만 계약 성립 뒤 생긴 부득이한 사유(국세기본법 시행령 §25의2 2호)'; }
          else if (기한 && 해제 <= 기한) { ok = true; why = '법정신고기한(' + 기한 + ') 전 합의해제 — 양도 없던 것으로 봄 [판단 대기 — 판단거리3차 #4: 법문엔 기한 전 합의해제 규정 없음(판례·예규 영역). 권장: 현 판정 유지하되 잠정 표시]'; }
          else { ok = 부득 === false ? false : null; why = '법정신고기한 뒤 합의해제는 부득이한 사유가 없으면 이미 성립한 양도소득세에 영향 없음 — 되찾는 것은 새 취득 [판단 대기 — 판단거리3차 #5: 부득이한 사유 없는 합의해제는 경정 사유 아님 → 이미 성립한 양도 유지, 되찾은 것은 새 취득 — 법령 구조와 맞음(판례 확인은 못 함). 권장 유지]'; }
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
    if (/매도/.test(입장) && 받계 > 돌) { 기타소득 = 받계 - 돌; notes.push('몰취한 계약금 ' + 기타소득.toLocaleString() + '원은 양도가액이 아니라 매도인의 기타소득(소득세법 §21①10호 위약금·배상금) — 필요경비 없음, 계약금이 위약금으로 대체된 것이라 원천징수 안 함 (원문 확인 2026-11-04: 소득세법 §21①10호 · §127①6호나목 · §14③8호가목), 다음 해 5월 종합소득 신고(300만원 이하 분리과세 선택 §14③8호 (원문 확인 2026-11-04: 소득세법 §21①10호 · §127①6호나목 · §14③8호가목)) — 종합소득세 계산 도구는 없음'); }
    if (/매수/.test(입장) && 받위) { 기타소득 = 받위; notes.push('받은 위약금 ' + 받위.toLocaleString() + '원은 매수인의 기타소득(소득세법 §21①10호) — 계약금을 돌려받은 부분은 소득 아님'); }
    if (/매도/.test(입장) && 배액) notes.push('매도인이 낸 위약금(배액 상환) ' + 배액.toLocaleString() + '원은 뒤에 이 자산을 다른 사람에게 팔 때 양도 필요경비가 아님 (원문 확인 2026-11-04: 소득세법 시행령 §163①·③(3686~)·⑤(3695~) 열거에 해당 항목 없음) — 받은 매수인은 기타소득');
    // 대금 감액
    let 감액판정 = null;
    if (감액) {
      const 판결 = jmYmd_(p.판결일);
      if (!해제) reqs.push(jmReq_('대금 감액은 양도를 없애지 않음 — 양도는 그대로, 양도가액만 고침', false, '감액 ' + 감액.toLocaleString() + '원', '소득세법 §96①'));
      감액판정 = { 원래양도가액: 원래 || null, 감액: 감액, 고친양도가액: 원래 ? 원래 - 감액 : null };
      if (판결) 할일.push({ 무엇: '양도가액 감액 판결로 경정청구(판결 확정을 안 날부터 3개월, 국세기본법 §45의2②1호)', 때: apShift_(apAddM_(판결, 3), hol, []) + '까지' });
      else notes.push('합의로 깎은 대금은 후발적 경정청구 사유인지 [확인 필요 — 권장: 해석① 사유 아님(일반 경정청구 5년만) / 해석② 4호 ’유사한 사유’. 권장: 5년 안이면 일반 경정청구, 지났으면 4호로 다툼 — 현 안내와 같음] — 법정신고기한부터 5년 안 일반 경정청구(국세기본법 §45의2①)로 실지거래가액을 바로잡을 것');
      양도부분 = { 무엇: '감액 뒤 양도가액으로 다시 셈', 양도일: 시기 || '', 양도가액: 감액판정.고친양도가액, 근거: '소득세법 §96①(실지거래가액)' };
    }
    if (jmYn_(p.허가구역) === true && jmYn_(p.허가받음) !== true) notes.push('토지거래허가구역에서 허가 없이 맺은 매매는 허가 전까지 효력이 없음(부동산 거래신고법 §11⑥) — 허가를 못 받아 무효로 끝나면 양도 아님, 허가 전 대금청산 뒤 허가받으면 신고기한은 허가일 기준(소득세법 §105①1호 단서). 무효인데 등기가 넘어가 대금을 그대로 가진 경우는 양도로 본 판례가 있음 [판단 대기 — 판단거리3차 #6: 신고기한 부분은 법문대로 맞음. 무효 매매 양도 여부는 판례 영역 — 현 안내 유지]');
    if (jmYn_(p.다시판매) === true) notes.push('해제 뒤 다른 사람에게 다시 팔면 새 양도 — 해제가 양도를 없앴으면 취득일·취득가액은 처음 취득한 때 그대로, 합의해제가 양도로 남았으면 되찾은 날이 새 취득일 [확인 필요 — 권장: 양도 소멸이면 원 취득일, 합의해제가 양도로 남으면 되찾은 날 — 390·395와 같은 갈래. 권장 유지]');
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
  // [2026.11.04 공휴일 표 하나] 받은 목록 + 조견표 1부-02에서 뽑은 날짜(HolidayDates.js, 엔진과 같은 원본). 양력 고정 공휴일은 표 밖 해를 위해 그대로 둠.
  let x = d; const list = (hol || []).map(jmYmd_).filter(Boolean).concat(typeof NX_HOLIDAY_DATES_ !== 'undefined' ? NX_HOLIDAY_DATES_ : []), moved = [];
  for (let i = 0; i < 20; i++) {
    const w = apDay_(x), md = x.slice(5);
    const r = w === 6 ? '토요일' : w === 0 ? '일요일' : md === '05-01' ? '노동절' : AP_FIXED_.indexOf(md) >= 0 ? '공휴일' : list.indexOf(x) >= 0 ? '공휴일' : '';
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
      const r = due('심사·심판청구 — 이의 결정기간 안에 결정을 못 받음', famAddD_(결정기간끝, 1), 89, '국세기본법 §61②1호·§68②(결정기간이 지난 날부터 90일)', 심사일 || 심판일, { note: '그 날을 첫날로 셈 [확인 필요 — 권장: 해석① 그 날이 0시부터 시작하므로 초일 산입(코드) / 해석② 초일 불산입. 권장 ①(안전 — 마감이 하루 이름)]' });
      if (이의결정 && r) notes.push('결정기간이 지난 뒤(' + 이의결정 + ') 결정을 받음 — 그날부터 90일을 다시 주는지는 [확인 필요 — 권장: 해석① 본문대로 통지 받은 날부터 90일 다시 기산 / 해석② 단서가 먼저 열려 이른 쪽만. 권장: 이른 쪽에 맞춤(코드)] · 이른 쪽(' + r.마감 + ')에 맞추는 게 안전');
    }
    if (!고지) notes.push('고지서 받은 날을 모름 — 이의신청이 기한 안인지 못 봄');
    else if (이의일 > apShift_(famAddD_(고지, 90), hol, [])) notes.push('이의신청이 기한을 넘겨 각하될 수 있음 — 그러면 뒤 심사·심판도 본래 기한(고지 받은 날부터 90일)으로 보아 각하될 수 있음 [확인 필요 — 권장: 각하된 이의신청은 적법한 전심이 아니므로 §61② 적용 없이 §61① 기한으로 봄이 문언에 부합(판례 확인 못 함). 권장 유지] · 경정청구 3개월·5년 길을 함께 볼 것');
  }
  const 청구 = 심사일 || 심판일;
  if (청구) {
    const 이름 = 심사일 ? '심사청구' : '심판청구', 결정끝 = famAddD_(청구, 90), 결정 = jmYmd_(p.결정받은날);
    wait(이름 + ' 결정(할 기한)', 청구, 결정끝, 결정, '국세기본법 §65②·§80의2(받은 날부터 90일)', '결정기간 지남 — 결정 전이라도 행정소송 낼 수 있음(§56③ 단서)');
    if (결정) due('행정소송', 결정, 90, '국세기본법 §56③(결정 통지 받은 날부터 90일)', p.소송제기일);
    else notes.push('행정소송은 ' + 이름 + ' 결정 통지를 받은 날부터 90일(§56③) — 결정기간(' + 결정끝 + ')이 지나면 결정 전이라도 낼 수 있으나(단서), 그것으로 90일이 흐르기 시작하지는 않음 (원문 확인 2026-11-04: 국기법 §56③)');
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
  if (!hol.length) notes.push('설·추석·대체공휴일·임시공휴일은 공휴일 목록을 받아야 미룸 — 마감이 그 무렵이면 달력 확인 [실사건 때 확인]');
  if (!고지 && !통지일 && !신고기한) reqs.push(jmReq_('날짜', null, '조사결과 통지·고지서·법정신고기한 중 하나는 있어야 기한을 셈', '국세기본법 §61·§81의15·§45의2'));
  const own = function (r) { return !/할 기한/.test(r.무엇); };
  const open = 기한.filter(function (r) { return own(r) && /^남음/.test(r.상태); }).sort(function (a, b) { return a.마감 < b.마감 ? -1 : 1; });
  const missed = 기한.filter(function (r) { return own(r) && /^지남/.test(r.상태); });
  open.forEach(function (r) { 할일.push({ 무엇: r.무엇, 때: r.마감 + '까지', 근거: r.근거 }); });
  if (missed.length && !open.length) notes.push('남은 기한이 없음 — 지난 것: ' + missed.map(function (r) { return r.무엇 + '(' + r.마감 + ')'; }).join(', ') + ' · 남는 길은 고충민원(직권 시정 요청) [실사건 때 확인]');
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
      if (c.사망일 && dd && jmYmd_(c.사망일) === dd) 알림.push(c.이름 + ' — 같은 날 사망은 동시사망 추정(민법 §30) → 대습상속(대법원 판례) [확인 필요 — 권장: 민법 원문이 없어 대조 못 함. 통설·판례상 동시사망자 사이엔 상속 없고 대습상속 됨 — 현 안내 유지]');
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
    알림.push('자녀가 모두 포기하고 배우자가 있으면 배우자 단독 상속(대법원 2023.3.23. 전원합의체 결정 — 손자녀가 공동상속인이 되지 않음) [판단 대기 — 판단거리3차 #7: 민법 원문 없어 대조 못 함. 현 안내 유지, 사건번호는 지어내지 않음]');
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
  if (p.배우자 && jmYn_(p.배우자.포기) === true) notes.push('배우자가 포기하면 실제 상속받은 금액이 없어 배우자상속공제는 최소 5억원만(상증법 §19④) (원문 확인 2026-11-04: 상증법 §19④ · §19① D)');
  if (real.포기.length) {
    notes.push('상속을 포기한 사람(' + real.포기.join(', ') + ')도 세법상 「상속인」(상증법 §2 4호) — 10년 안 사전증여는 상속세 과세가액에 더하고(§13①1호), 받은 사전증여·보험금 등 비율만큼 납부의무·연대납부(§3의2)');
    할일.push({ 무엇: '포기한 사람이 받은 사전증여(10년)·사망보험금·퇴직금 확인 — 포기해도 간주상속재산(§8·§10)은 받을 수 있고 그만큼 상속세 납부의무', 때: '신고 전' });
    할일.push({ 무엇: '상속포기 신고(민법 §1019① — 상속개시를 안 날부터 3개월 안 가정법원) 접수증명 받기', 때: '상속개시를 안 날부터 3개월' });
  }
  if (real.다음순위 && real.포기.length) notes.push('선순위 상속인의 포기로 다음 순위가 받은 재산은 상속공제 한도에서 뺌(상증법 §24 2호) — 계산기 「상속포기 후 다음 순위 상속분」 칸에 그 재산가액을 넣을 것');
  if (real.세대생략.length) notes.push('자녀 포기로 손자녀(' + real.세대생략.join(', ') + ')가 본위상속하면 세대생략 할증 30%(미성년이고 20억 넘으면 40%) 대상(상증법 §27) — 대습상속만 할증에서 빠짐');
  const 대습 = real.상속인.filter(function (r) { return r.지위 === '대습'; });
  if (대습.length) notes.push('대습상속인(' + 대습.map(function (r) { return r.이름; }).join(', ') + ')은 세대생략 할증 없음(상증법 §27 단서) · 상속공제의 자녀공제는 피상속인의 자녀 수로 셈 [확인 필요 — 권장: 해석① 자녀공제는 피상속인의 자녀 수(대습인 불포함) / 해석② 대습 손자녀도 포함. 권장 ①(문언 ’자녀’) — 코드 같음]');
  // [2026.11.02 복잡사건 60] 태아(민법 §1000③ 상속순위는 출생한 것으로 봄)·자녀공제·미성년자공제(상증법 §20①1·2호, 태아는 §20② — 2023.1.1 이후 상속개시) 칸을 판정이 셈
  const 개시 = 실종선고 || jmYmd_(p.사망일), 사람 = {};
  (p.자녀 || []).forEach(function (c) { 사람[c.이름] = c; (c.대습 || []).forEach(function (x) { 사람[x.이름] = x; }); (c.자녀 || []).forEach(function (x) { 사람[x.이름] = x; }); });
  const 태아 = Object.keys(사람).filter(function (k) { return jmYn_(사람[k].태아) === true; });
  if (태아.length) { notes.push('태아(' + 태아.join(', ') + ')는 상속순위에서 이미 태어난 것으로 봄(민법 §1000③) — 살아서 태어나야 상속인(사산이면 처음부터 빼고 다시 나눔) [확인 필요 — 권장: 민법 원문 없어 대조 못 함. 상속세 공제 태아 포함은 법문(§20①)으로 맞음. 현 안내 유지]. 상속세는 태아도 자녀공제 5천만원·미성년자공제 1천만원×19년(상증법 §20②, 2023.1.1 이후 상속개시) — 출생 전 신고면 출생 사실을 신고 뒤 확인'); 할일.push({ 무엇: '태아 출생 확인(출생증명) — 사산이면 상속인·법정상속분·공제를 다시 셈', 때: '출생 뒤 바로' }); }
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
  if (미성년.length) notes.push('미성년자공제(상증법 §20①2호 — 상속인(배우자 제외)·동거가족 중 미성년자, 19세까지 연수×1천만원, 1년 미만 끝수는 1년 (원문 확인 2026-11-04: 상증법 §20③)): ' + 미성년.join(', ') + ' — 상속인 아닌 동거가족 미성년자는 따로 더할 것');
  if (생일모름.length) notes.push('생년월일을 몰라 미성년자공제를 못 셈: ' + 생일모름.join(', '));
  if (자녀수 != null) notes.push('자녀공제 자녀 수 ' + 자녀수 + '명(먼저·같은 날 사망한 자녀 제외, 포기한 자녀·태아 포함 [확인 필요 — 권장: 태아는 법문으로 포함(가). 포기한 자녀는 ’자녀’이면 족하다는 해석이 문언에 맞음(실무 예규 확인 못 함). 권장 포함(코드 같음)])');
  let 세법개시 = null;
  if (실종선고) {
    const y = +실종선고.slice(0, 4), m = +실종선고.slice(5, 7) + (jmYn_(p.국외주소) === true ? 9 : 6), due = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    세법개시 = { 상속개시일: 실종선고, 민법상_사망간주일: 만료 || jmYmd_(p.사망일) || '', 신고기한: due, 근거: '상증법 §2 2호 단서(실종선고로 상속이 개시되면 실종선고일)·§60①(평가기준일)·§67①(그 달 말일부터 6개월, 국외 주소 9개월) · 상속인은 민법 §28 실종기간 만료일 기준' };
    notes.push('실종선고: 상속인·법정상속분은 실종기간 만료일(' + (세법개시.민법상_사망간주일 || '모름') + ') 기준(민법 §28), 상속세 상속개시일·평가기준일은 실종선고일 ' + 실종선고 + '(상증법 §2 2호) — 신고기한 ' + due + ' · 세율·공제는 실종선고일에 시행되던 법 [확인 필요 — 권장: 상속개시일이 실종선고일이므로 그날 시행 법령 적용이 일관. 권장 유지]');
    할일.push({ 무엇: '상속세 신고(실종선고일 기준)', 때: due + '까지' });
  } else if (만료) notes.push('실종기간이 끝났어도 실종선고 전이면 상속세 상속개시일이 아직 없음(상증법 §2 2호) — 실종선고일을 받으면 다시 돌림');
  const r = jmWrap_('상속인·법정상속분', reqs, { 세법상_상속개시: 세법개시 || undefined, 자녀공제_자녀수: 자녀수 == null ? undefined : 자녀수, 미성년자공제_연수: 미성년연수 || undefined,  순위: real.순위, 상속인: real.상속인, 포기한사람: real.포기, 배우자비율_공제용: 배우자비율_공제용, 다음순위상속: !!(real.다음순위 && real.포기.length), 세대생략할증: real.세대생략, 알림: notes, 할일: 할일 });
  r.표시 += ' · ' + real.상속인.map(function (x) { return x.이름 + ' ' + x.지분.표시; }).join(', ') + (배우자비율_공제용 ? ' · 배우자공제 비율 ' + 배우자비율_공제용.표시 : '');
  r.엔진칸 = 배우자비율_공제용 ? { spouseLegalShareRatio: 배우자비율_공제용.n / 배우자비율_공제용.d } : {}; // 소수 6자리로 넘기면 한도가 1천 원대 모자람 — 분수 그대로
  r.엔진칸뜻 = 'spouseLegalShareRatio = 상속세 배우자공제 한도의 배우자 법정상속분(포기 없던 것으로 본 비율)';
  if (p.배우자 && (p.배우자.이름 || p.배우자 === true) && !real.상속인.some(function (x) { return x.관계 === '배우자'; }) && !(p.배우자.포기 && jmYn_(p.배우자.포기) === true)) { r.엔진칸.hasSpouse = false; r.엔진칸뜻 += ' · hasSpouse=false(배우자가 먼저·같은 날 사망)'; }
  if (자녀수 != null) { r.엔진칸.childCount = 자녀수; r.엔진칸뜻 += ' · childCount = 자녀공제 자녀 수'; }
  if (미성년연수) { r.엔진칸.minorHeirRemainingYears = 미성년연수; r.엔진칸뜻 += ' · minorHeirRemainingYears = 상속인 미성년자 19세까지 연수 합(태아 19)'; }
  // [2026.11.04] 상속인별 법정상속분을 상속세 계산 상속인 칸(priorGiftHeirs[].legalShareRatio)에 이름으로 넘김 — §28② 증여세액공제 한도 정밀 계산
  if (real.상속인.length) { r.엔진칸.heirLegalShares = {}; real.상속인.forEach(function (x) { if (x.이름 && x.지분 && x.지분.d) r.엔진칸.heirLegalShares[x.이름] = x.지분.n / x.지분.d; }); r.엔진칸뜻 += ' · heirLegalShares = 상속인 이름별 법정상속분(사전증여 받은 상속인 칸 legalShareRatio로 들어감)'; }
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
  if (주소 === null && yn(p.국내가족) === true && yn(p.국내자산) === true) 주소왜 = '국내 가족·자산이 있음 — 생활관계로 주소 있다고 볼 여지(§2①) [실사건 때 확인]';
  reqs.push(jmReq_('국내에 주소가 있음(생활관계 — 가족·자산 등, 주민등록과 다를 수 있음)', 주소, 주소왜, '소득세법 시행령 §2' + (상증 ? '(상증법 시행령 §2①이 따름)' : '')));
  // 거소 183일
  const yr183 = Object.keys(해별).some(function (y) { return 해별[y] >= 183 && (!기준해 || y <= 기준해); });
  const 거소183 = 상증 ? (최장연속 >= 183) : (yr183 || 최장연속 >= 183);
  const 거소왜 = merged.length ? ('국내 거소 ' + Object.keys(해별).map(function (y) { return y + '년 ' + 해별[y] + '일'; }).join(' · ') + ' / 가장 긴 연속 ' + 최장연속 + '일') : '입출국 기록 없음';
  reqs.push(jmReq_('국내에 183일 이상 거소', merged.length ? 거소183 : null, 거소왜 + (상증 ? ' — 상속·증여는 소득령 §4③(1과세기간 합산)을 따르지 않아 연속 기간으로 봄 [확인 필요 — 권장: §4③(1과세기간 합산·2과세기간 연속)을 빼고 준용하므로 상증은 합산 규정 없이 ’183일 이상 거소’ 자체로 봄 — 연속 기간 해석(코드)이 준용 구조에 부합. 다만 ’연속’이 명문은 아님. 권장 유지]' : ''), 상증 ? '상증법 §2 8호·시행령 §2①(소득령 §4①②④)' : '소득세법 §1의2①1호·시행령 §4①~③'));
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
    notes.push('[확인 필요 — 권장: 해석① 준용은 조문 구조만 빌려 공제 됨 / 해석② ’거주자’ 문언 그대로라 안 됨. 권장: 두 경우 계산(코드) 유지, 보수적 기본은 공제 없음] 증여재산공제: 국조법 §35⑥이 상증법 §53을 준용하나 §53 본문은 「거주자가 증여를 받은 경우」 — 비거주 수증자에게 공제가 되는지 갈림. 계산은 두 경우(안)로: 공제 없음(isDoneeResident:false) · 공제 있음(isDoneeResident:true)');
    notes.push('[확인 필요 — 권장: 납세의무자가 다르나 ’수증자가 받은 증여재산’ 요건은 같음 — 해석 갈림. 권장 두 경우 유지] 10년 합산(§47 준용): 같은 증여자가 같은 수증자에게 10년 안 준 국내 재산(상증법, 수증자 납부)과 이번 국외 재산(국조법, 증여자 납부)을 합산하는지 — 납세의무자가 달라 갈림. 두 경우(안)로 견줄 것');
    notes.push('[확인 필요 — 권장: §13①은 증여 법률을 가리지 않아 가산되는 해석이 문언에 맞고, 그러면 §28 공제도 ’증여 당시 증여세’로 보는 것이 일관. 권장 가산·공제 모두 적용(잠정)] 증여자가 10년 안 사망하면 이 증여를 상속세 과세가액에 더하는지(상증법 §13①)·더하면 증여자가 낸 국조법 증여세를 §28로 빼는지');
    if (증여일 && 증여일 < '2017-01-01') notes.push('[확인 필요 — 권장: 원문 없음 — 그대로 안내] 2017.1.1. 전 증여는 옛 국조법 §21(면제 요건이 지금과 다름 — 국조법 부칙 §10②)');
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
        '처음 마감 ' + 기한1 + ' 지남 · 채무초과 안 날 ' + 초과안날 + ' · 마감 ' + 기한2 + ' · 신고 ' + 신고 + (jmYn_(p.중대과실없음) == null ? ' — 중대한 과실 없었는지(입증 책임 상속인) [실사건 때 확인]' : ''), '민법 §1019③'));
    } else reqs.push(jmReq_('상속개시를 안 날부터 3개월 안 한정승인 신고', false, '마감 ' + 기한1 + ' 지나 ' + 신고 + ' 신고 — 채무초과를 늦게 알았으면 채무초과안날을 넣어 특별한정승인으로 다시', '민법 §1019①·③'));
  } else {
    reqs.push(jmReq_('한정승인 신고', null, '아직 신고 안 함 — 마감 ' + 기한1 + '(그 안에 재산목록 첨부해 가정법원에 신고)', '민법 §1019①·§1030'));
    할일.push({ 무엇: '한정승인 신고(가정법원, 상속재산 목록 첨부) — 안 하면 단순승인으로 봄(민법 §1026 2호)', 때: 기한1 + '까지' });
  }
  if (jmYmd_(p.포기신고일)) notes.push('상속포기(민법 §1041)를 고르면 다음 순위(손자녀·직계존속·형제자매)로 빚이 넘어가 그들도 포기·한정승인해야 함 — 한정승인은 순위가 안 넘어감. 포기자도 상증법 §13①1호의 「상속인」이라 10년 안 사전증여 합산은 그대로 [판단 대기 — 판단거리3차 #8: 법 §2 4호가 ’상속을 포기한 사람’을 상속인에 넣는 것으로 알고 있으나 md 발췌에서 그 문구를 직접 못 봄 — 판례 번호는 원문 없음. 권장 유지(합산)]');
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
  if (가산합) notes.push('상속세 납부의무: 상속인은 「상속으로 얻은 재산」 비율로 내고, 연대납부는 각자 받았거나 받을 재산 한도(상증법 §3의2①·③) — 사전증여 재산이 그 한도에 드는지 (원문 확인 2026-11-04: 상증령 §3③의 총액에서 부채·상속세·그 증여세를 뺀 가액’)). 이미 낸 증여세는 공제(§28)');
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
    if (안쪽 && 경락 !== 평가) { 취득가액 = 경락; 말 = '평가기간(' + 평가시작 + '~' + 평가끝 + ') 안 경매 — 경락가 ' + 경락.toLocaleString() + '원이 상속재산 시가(상증법 §60②, 시행령 §49①3호) → 상속세 평가액을 경락가로 고치고(' + (경락 > 평가 ? '수정신고' : '경정청구') + ') 양도 취득가액도 같은 값 (원문 확인 2026-11-04: 상증령 §49①3호 단서)'; }
    else if (!안쪽 && 경매 <= 결정기한 && 경락 > 평가 && !/^시가|감정/.test(방법)) 말 = '평가기간 밖이지만 법정결정기한(' + 결정기한 + ') 안 — 평가심의위원회 심의로 경락가가 시가가 될 수 있음(시행령 §49① 단서, 사건 20 판정) · 지금 신고 평가액이면 차익만큼 양도소득세';
    else if (!안쪽 && 경락 < 평가 && 경매 <= apAddM_(신고기한, 12)) 말 = '경락가가 평가액보다 낮음 — 상속세 신고기한부터 1년 안 경매면 상속세 경정청구 특례(상증법 §79①2호·시행령 §81, 사건 15 도구)';
    const 차익 = Math.max(0, 경락 - 취득가액 - 경비);
    양도.push({ 이름: x.이름 || '', 양도일: 경매, 양도가액: 경락, 취득가액: 취득가액, 취득일: 사망, 필요경비: 경비, 양도차익: 차익, 세율보유기간시작: jmYmd_(x.피상속인취득일) || '모름', 알림: 말,
      근거: '양도인 = 상속인(한정승인이어도 소유권은 상속인, 경매도 양도 — 소득세법 §88 1호) · 취득가액 = 상속개시일 평가액(소득세법 시행령 §163⑨) · 세율 보유기간은 피상속인 취득일부터(소득세법 §104②1호)·장기보유공제는 상속개시일부터(§95④)' });
  });
  if (양도.length) {
    const 합 = 양도.reduce(function (t, r) { return t + r.양도차익; }, 0);
    notes.push('상속재산 경매·매각 ' + 양도.length + '건 — 양도소득세 납세의무자는 한정승인한 상속인이고, 그 세금은 상속채무가 아니라 상속인 고유의 세금으로 보는 판례가 있어 상속재산 한도로 끊기지 않을 수 있음 [판단 대기 — 판단거리3차 #9: 양도소득은 상속인에게 생긴 소득이라 고유 납세의무(한도 없음)가 법 구조에 부합 — 판례 번호는 원문 없음. 권장 유지] · 양도차익 합계 ' + 합.toLocaleString() + '원');
    양도.forEach(function (r) { if (r.알림) notes.push(r.이름 + ': ' + r.알림); 할일.push({ 무엇: r.이름 + ' 양도소득세 예정신고(경매 대금 완납일 = 양도일, 소득세법 §105)', 때: new Date(Date.UTC(+r.양도일.slice(0, 4), +r.양도일.slice(5, 7) + 2, 0)).toISOString().slice(0, 10) + '까지' }); });
    notes.push('절세 길: 상속세 신고 때 시가(감정·평가기간 안 경락가)로 평가해 두면 경매 차익이 줄어 양도소득세가 줄어듦(상속세는 채무 초과로 0일 때 손해 없음) · 상속재산 파산(채무자회생법 §299)으로 파산관재인이 팔 때 납세의무 [확인 필요 — 권장: 원문 없음 — 그대로 안내]');
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
      if (row.엔진칸 && (취 == null || 취 === 0)) { notes.push('[확인 필요 — 권장: 산 값이 없으면 취득가액 0(실지거래가액 없음)이 문언 — 환산은 매매사례·감정 전제라 영업권엔 부적합. 권장: 0으로 넣고 개산공제 여부만 확인(세무사님 판단)] ' + 이름 + ': 스스로 일군 영업권은 산 값이 없습니다 — 계산기는 취득가액 0을 받지 않으니 취득가액을 어떻게 볼지(0·환산) 세무사님께 여쭐 것(소득세법 §97①1호, 시행령 §163 — 근거 예규 미확인)'); 할일.push({ 일: 이름 + ' 취득가액(스스로 일군 영업권) 정하기', 근거: '소득세법 §97' }); }
    } else if (/주주회원|주식.*회원|회원.*주식/.test(종)) {
      row.소득 = '양도소득(기타자산)'; row.근거 = '소득세법 §94①4호나 괄호(주식을 가져야 시설을 쓰는 회원권)·§94②(주식이어도 4호)'; row.엔진칸 = 양도칸(); row.기준시가 = '주식 평가(소득세법 §99①3·4호, 시행령 §165⑧1호)';
      notes.push(이름 + ': 주식 계산기(주식 세율 20·25%)가 아니라 기타자산 — 기본세율·부동산과 같은 묶음(§102①1호)');
    } else if (/회원|이용권/.test(종)) {
      row.소득 = '양도소득(기타자산)'; row.근거 = '소득세법 §94①4호나'; row.엔진칸 = 양도칸(); row.기준시가 = '지방세법 시가표준액(소득세법 시행령 §165⑧3호)';
    } else if (/이축/.test(종)) {
      const 별도 = jmYn_(it.별도평가신고);
      if (별도 === true) { row.소득 = '토지와 따로(별도 평가 신고)'; row.근거 = '소득세법 §94①4호마 단서'; notes.push('[확인 필요 — 권장: 양도소득에서 빠지면 §21①7호 유사 권리로 기타소득이 문언에 가장 가까움. 권장 기타소득(필요경비 60%)] ' + 이름 + ': 따로 평가해 신고한 이축권의 소득 구분(기타소득 여부) — §21①7호 "그 밖에 이와 유사한 권리" 해당 여부 근거 미확인'); }
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
  if (판정.some(function (r) { return /영업권|인허가|권리금/.test(r.종류) && r.엔진칸; }) && jmYn_((p.품목 || []).find(function (x) { return /영업권|인허가|권리금/.test(String(x.종류 || '')); }).가액구분) !== true) notes.push('[확인 필요 — 권장: ’등’에 영업권(기타자산)이 드는지 문언 불명 — 시행령 §166⑥ 안분 대상 확인 필요. 권장: 토지·건물 안분 뒤 남는 금액을 영업권으로 두는 방식 안내] 영업권 값이 계약서에 따로 나뉘지 않았거나 기준시가로 나눈 값과 30% 넘게 다르면 기준시가 비율로 나눔(소득세법 §100②③) — 영업권도 "토지와 건물 등"에 드는지 근거 미확인');
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
  notes.push('신고기한 ' + 신고기한 + (선임 && 선임 <= 기본기한 ? '(상속재산관리인 선임일 ' + 선임 + '부터 셈 — 상증법 §67③ 「그 지정되거나 선임되는 날부터 계산」: 말일이 아니라 선임일부터 6개월(원문 확인 2026-11-04))' : '(상증법 §67①)'));
  if (확정 && 확정 > 신고기한) { notes.push('[실사건 때 확인] 분여 심판 확정(' + 확정 + ')이 신고기한 뒤 — 특별연고자는 확정 전엔 받을 재산이 없어 신고할 수 없었으므로 기한 뒤 신고 가산세의 정당한 사유(국세기본법 §48①) 해당 여부 근거 미확인. 확정 뒤 곧바로 신고 권함'); 할일.push({ 무엇: '분여 확정 뒤 상속세 기한 후 신고(가산세 감면 신청 함께)', 때: apAddM_(확정, 1) + ' 무렵', 근거: '상증법 §67·국세기본법 §45의3·§48①' }); }
  else 할일.push({ 무엇: '상속세 신고(분여 받은 사람, 심판문 첨부)', 때: 신고기한 + '까지', 근거: '상증법 §67' });
  // 4) 공제 — 배우자공제 없음(사실혼). 일괄공제(§21)는 "상속인이나 수유자"에게 — 특별연고자 해당 여부와 §24①1호 "유증등" 해당 여부가 갈림
  if (분여.some(function (x) { return /사실혼/.test(String(x.관계 || '')); })) notes.push('사실혼 배우자는 상속인이 아니라 배우자공제(상증법 §19) 없음 — 법률상 배우자만');
  notes.push('[판단 대기 — 판단거리3차 #10: 특별연고자는 상속인도 수유자도 아니고 분여는 유증등이 아님 → 문언상 일괄공제 안 되고 §24 1호에도 안 듦(해석②). 권장: 두 경우 계산 유지, 기본은 공제 없음] 특별연고자에게 일괄공제 5억(상증법 §21① "상속인이나 수유자")이 되는지, 분여 재산이 공제 한도에서 빼는 "선순위 상속인이 아닌 자에게 유증등을 한 재산"(§24①1호, 유증등 = §12 1호 유증·사인증여)에 드는지 — 조문에 분여가 적혀 있지 않음. 경우(가)·(나)로 둘 다 계산');
  notes.push('[확인 필요 — 권장: 과세가액은 피상속인 재산 전체라 넣는 것이 문언, 국가 몫 세액은 납부의무자가 없음. 권장: 경우(다) 유지] 아무도 받지 않아 국가에 귀속되는 재산(민법 §1058 — ' + 국가귀속.toLocaleString('ko-KR') + '원)을 과세가액에 넣는지 — 국가는 납부의무가 없어(§3의2①) 넣으면 그 몫 세금은 걷히지 않고 특별연고자 몫 세율만 올라감. 경우(다)로 계산');
  분여.forEach(function (x) { if (jmYn_(x.영리법인) === true) notes.push(x.이름 + ': 영리법인 특별연고자 — 법인은 상속세 면제, 주주 중 상속인·그 직계비속 등이 지분상당액을 냄(상증법 §3의2②)·법인은 법인세(자산수증이익)'); });
  notes.push('분여 받은 재산을 나중에 팔면 취득가액은 상속개시일 평가액(소득세법 시행령 §163⑨) — 취득시기가 상속개시일인지 심판 확정일인지는 (원문 확인 2026-11-04: 소득세법 시행령 §162①5호 · §163⑨)(시행령 §162①5호 "상속 또는 증여")');
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
  // 실질 주주 — 명의만 빌려준 사람의 주식은 실질소유자에게(국세기본법 §14① 실질과세 — 판례 기준은 [실사건 때 확인])
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
  // 부족액을 세목별로 나눔 — 충당 순서 미확인이라 체납액 비율로 나눔([확인 필요 — 권장: 실무는 납부고지서의 세목별 부족액 — 비율 배분은 잠정. 권장: 고지서 금액으로 바꾸도록 안내(코드 같음)])
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
  notes.push('[판단 대기 — 판단거리3차 #11: 문언상 지분 50% 초과 + 경영 지배적 영향력 둘 다 필요 — 지분만 가진 가족이 ’자들’에 드는지는 해석(집단 요건). 권장: 현 안내 유지] "그 법인의 경영에 대하여 지배적인 영향력을 행사하는 자들"(§39 2호 — 이 문구가 들어간 개정 시기·적용 부칙은 법령 폴더 본문에 없어 미확인) — 지분만 가졌고 경영에 관여하지 않은 가족도 과점주주에 드는지. 주주총회 참석·임원 여부·배당 수령 자료로 다툴 수 있음');
  if (주주.some(function (s) { return s.명의만; })) notes.push('(원문 확인 2026-11-04: 국기법 §14①·§39 단서(’실질적으로 권리를 행사하는’ 주식)) 이름만 빌려준 주주는 실질 권리를 행사하지 않아 제2차 납세의무 없음(실질과세 국세기본법 §14①) — 주식은 실질소유자 몫으로 셈. 명의를 빌려준 사람에게는 명의신탁 증여의제(상증법 §45의2)가 따로 걸릴 수 있음 — 넥스 명의신탁 도구');
  notes.push('[확인 필요 — 권장: 1036과 같음] 법인 재산 충당 순서(어느 체납 세목에 먼저 넣는지)를 몰라 부족액을 체납액 비율로 나눔 — 세목마다 과점 여부가 다르면 결과가 달라짐. 세무서 납부고지서의 세목별 금액으로 바꿀 것');
  notes.push('사실혼 배우자도 친족관계(국세기본법 시행령 §1의2①3호)');
  const 통지 = jmYmd_(p.통지일);
  if (통지) { const why = []; const 끝 = apShift_(famAddD_(통지, 90), p.공휴일, why); 할일.push({ 무엇: '제2차 납세의무 납부고지에 대한 이의신청·심사·심판청구(넥스 불복기한 도구로 다시 확인)', 때: 끝 + '까지(고지서 받은 날 다음 날부터 90일' + (why.length ? ', ' + why.join('') : '') + ')', 근거: '국세기본법 §55·§61①·§68①' }); }
  notes.push('다툴 거리: ① 성립일 현재 지분·특수관계 ② 실질 권리 행사(명의주주) ③ 법인 재산 충당이 다 되었는지(부족액) ④ 주된 체납액 자체의 위법 — 주된 납세의무의 부과처분은 제2차 납세의무자도 불복할 수 있는지 [확인 필요 — 권장: 원문 없음 — 권장 현 안내 유지]');
  notes.push('범위 밖 한 줄: 과점주주가 되는 때 법인 부동산 등에 대한 취득세 간주취득(지방세법 §7⑤)은 지방세라 이 도구가 보지 않음');
  return jmWrap_('제2차납세의무', reqs, { 체납합계: 체납합, 부족액: 부족합, 세목별: 세목별, 사람별한도: 합계, 알림: notes, 할일: 할일 });
}

// [2026.11.02 복잡사건 65 「봉씨 아들 이름 땅」] 부동산 명의신탁 — 남(가족) 이름으로 등기한 토지·건물이 명의신탁인지 자금 증여인지 가르고, 누가 무엇을 내는지
//  토지·건물은 명의신탁 증여의제(상증법 §45의2①)에서 빠짐(괄호) → 명의신탁이면 증여세가 아니라: 양도소득세는 양도대금이 실제 돌아간 신탁자(실질과세 국세기본법 §14①, 판례 [판단 대기 — 판단거리3차 #12: 실질과세 문언상 대금이 귀속되는 신탁자가 납세의무자 — 판례 번호는 원문 없음. 권장 유지]),
//  신탁자가 죽으면 신탁자의 상속재산, 1세대1주택 판정도 신탁자 기준([판단 대기 — 판단거리3차 #13: 실질과세로 신탁자 세대 주택으로 보는 것이 일관 — 명문·판례 원문 없음. 권장 유지]). 명의자가 자기 돈이 아닌데 처분권까지 받았다면 명의신탁이 아니라 자금(또는 부동산) 증여(상증법 §2·§4①).
//  부동산실명법(명의신탁 약정 무효 §4, 과징금 §5, 종중·배우자·종교단체 특례 §8)은 법령 폴더에 원문이 없어 조문 내용은 [실사건 때 확인]로만 안내.
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
  if (명의신탁 === false && 신탁자돈) notes.push('신탁자 돈으로 샀는데 명의자가 처분하고 대금도 가짐 → 명의신탁이 아니라 취득 때 자금(또는 부동산) 증여(상증법 §4①) — 증여일 = 취득일, 증여세 신고기한은 그 달 말일부터 3개월(§68①), 제척기간(국세기본법 §26의2④ 15년 사유 해당 여부 (원문 확인 2026-11-04: 국기법 §26의2④는 15년)))');
  if (명의신탁 === null) { notes.push('명의신탁인지 증여인지 정해지지 않음 — 경우 (가) 명의신탁 · (나) 취득 때 증여로 둘 다 셈'); 할일.push({ 무엇: '취득 자금 이체 내역·명의신탁 약정서·대금 받은 통장·재산세 낸 사람 확인', 때: '상담 때', 근거: '국세기본법 §14①' }); }
  // 2) 부동산은 증여의제 없음
  notes.push('토지·건물은 명의신탁해도 명의신탁 증여의제(상증법 §45의2①)가 걸리지 않음(괄호에서 뺌) — 명의자에게 증여세를 매기면 다툴 거리');
  // 3) 부동산실명법 — 특례(배우자·종중·종교단체) vs 무효·과징금
  if (/배우자|종중|종교/.test(관계)) notes.push('[실사건 때 확인 — 부동산실명법 원문 없음] 종중·배우자·종교단체 명의 등기는 조세포탈·강제집행 면탈·법령상 제한 회피 목적이 아니면 명의신탁 약정 무효·과징금이 적용되지 않음(부동산실명법 §8) — 이 경우에도 세법상 실질 소유자는 신탁자');
  else notes.push('[실사건 때 확인 — 부동산실명법 원문 없음] 명의신탁 약정·그에 따른 등기는 무효(부동산실명법 §4), 신탁자에게 과징금(§5, 부동산가액 기준)·형사처벌 — 과징금은 국세가 아니라 이 도구가 셈하지 않음' + (/계약/.test(유형) ? '. 계약명의신탁에서 판 사람이 몰랐으면(매도인 선의) 명의자가 소유권을 확정 취득(§4② 단서) — 이때 신탁자는 자금 반환 청구권만 가져 세법상 소유자도 명의자로 볼 여지 [실사건 때 확인]' : ''));
  // 4) 양도소득세 — 납세의무자
  const 양 = jmYmd_(p.양도일), 취 = jmYmd_(p.취득일);
  const 칸 = function () { const e = { assetType: /주택|아파트/.test(자산) ? 'house' : 'general', transferDate: 양 || undefined, transferPrice: n(p.양도가액) }; if (취) e.acquisitionDate = 취; if (n(p.취득가액)) e.acquisitionPrice = n(p.취득가액); return e; };
  const 계약선의 = /계약/.test(유형) && jmYn_(p.매도인선의) === true;
  if (양) {
    const 신탁자납세 = 명의신탁 === true && !계약선의 && !/명의자/.test(귀속);
    reqs.push(jmReq_('양도소득세 납세의무자 = 신탁자(대금이 신탁자에게 감)', 명의신탁 === null || 계약선의 ? null : 신탁자납세, 계약선의 ? '[판단 대기 — 판단거리3차 #14: 원문 없음 — 두 경우 유지] 매도인 선의 계약명의신탁 — 소유권은 명의자가 확정 취득했지만 대금은 ' + (귀속 || '모름') + ' — 누가 양도자인지 판례 확인 전이라 두 경우로 셈' : 신탁자납세 ? '양도대금 ' + (귀속 || '신탁자') + ' — 실질 양도자는 신탁자' : '명의자', '국세기본법 §14①·소득세법 §88 1호 [판례 확인 필요]'));
    경우.push({ 이름: '(가) 명의신탁 — 신탁자(' + (p.신탁자 || '이름 모름') + ') 양도(신탁자의 취득일·취득가액)', 엔진칸: 칸(), 누가: p.신탁자 || '신탁자' });
    if (명의신탁 !== true || 계약선의) 경우.push({ 이름: '(나) 취득 때 증여(또는 명의자 소유 확정) — 명의자(' + (p.명의자 || '이름 모름') + ') 양도(취득일·취득가액 같음, 증여세는 따로)', 엔진칸: 칸(), 누가: p.명의자 || '명의자', 취득때증여: { 증여일: 취, 증여가액: n(p.취득가액), 관계: 관계 } });
    if (jmYn_(p.명의자신고) === true && 신탁자납세) { notes.push('명의자 이름으로 낸 양도소득세 신고는 실질과 다름 — 세무서가 신탁자에게 다시 매기고(부과) 명의자 몫은 돌려주는(경정) 일이 생김. 신탁자 쪽은 무신고 가산세·부정행위 여부, 명의자 쪽은 경정청구 기한(국세기본법 §45의2① 5년) 확인'); 할일.push({ 무엇: '명의자 신고분 경정청구 · 신탁자 기한 후 신고(또는 수정) 검토', 때: '양도일이 든 해 다음 해 5월 말에서 5년 안', 근거: '국세기본법 §45의2①·§45의3' }); }
    if (/주택|아파트/.test(자산)) notes.push('[판단 대기 — 판단거리3차 #15: 1072와 같음] 1세대1주택·다주택 판정에서 명의신탁 주택은 신탁자 세대의 주택으로 봄(실질) — 신탁자 세대 주택 수가 늘어 다른 집의 비과세가 깨질 수 있음, 넥스 1세대1주택 판정에 넣을 것');
  }
  // 5) 상속 — 신탁자가 죽으면 신탁자 재산
  const 사망 = jmYmd_(p.신탁자사망일);
  if (사망 && 계약선의) notes.push('[확인 필요 — 권장: 원문 없음 — 현 안내 유지] 신탁자 사망 — 매도인 선의 계약명의신탁이면 부동산은 명의자 소유로 확정되어 신탁자 상속재산은 부동산이 아니라 명의자에게 줬던 매수 자금을 돌려받을 권리(부당이득 반환 채권)일 수 있음 — 판례 확인 뒤 상속재산 목록에 넣을 것(상증법 §2 3호)');
  else if (사망) { notes.push('신탁자 사망 — 명의신탁 부동산은 신탁자의 상속재산(실질, 상증법 §2 3호·§7) — 명의자 이름이라 상속세 신고에서 빠지기 쉬움, 상속인이 명의자에게 돌려받을 권리로 넣음 (원문 확인 2026-11-04: 상증법 §2 3호(피상속인에게 귀속되는 재산)·§7 · 국기법 §14①)'); 할일.push({ 무엇: '상속세 신고 재산 목록에 명의신탁 부동산 넣기', 때: '상속개시 월말부터 6개월', 근거: '상증법 §67' }); }
  if (jmYmd_(p.실명전환일)) notes.push('실명 전환(명의자 → 신탁자 이전 등기)은 원래 주인에게 돌려놓는 것이라 양도·증여가 아님 — 다만 등기 원인을 「증여」·「매매」로 하면 그대로 과세될 수 있어 원인 「명의신탁 해지」·증빙 [실사건 때 확인]');
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
  notes.push('[확인 필요 — 권장: 해석① 입금일(명의자 계좌 인도) / 해석② 사실상 지배한 때. 권장 ①(§45④ 추정 구조상 명의 취득일) — 코드 같음] 차명 예금의 증여시기 — 입금한 때인지, 명의자가 인출·사용해 사실상 가진 때인지(판례 기준 미확인). 경우 (나)는 입금일로 셈, 증여일이 바뀌면 10년 합산·신고기한·제척기간이 함께 바뀜');
  // 2) 경우 — (가) 차명: 증여세 없음·출연자 재산 / (나) 증여추정
  경우.push({ 이름: '(가) 출연자 재산(차명) — 증여세 없음' + (사망 ? ', 출연자 상속재산 ' + won(잔액합) + '원' : ''), 증여세: 0, 상속재산가산: 사망 ? 잔액합 : 0 });
  계좌.filter(function (a) { return a.증여추정; }).forEach(function (a) { 경우.push({ 이름: '(나) 증여추정 — ' + a.이름 + ' ' + won(a.증여추정금액) + '원(증여일 ' + (a.입금일 || '모름') + ')', 엔진칸: { giftAmount: a.증여추정금액, relation: rel, giftDate: a.입금일 || undefined, isDoneeResident: true } }); });
  if (추정합 > 1 && 계좌.filter(function (a) { return a.증여추정; }).length > 1) notes.push('같은 출연자에게서 10년 안 증여추정이 여러 건이면 합산(상증법 §47②) — 계산기는 앞 건을 사전증여 칸에 넣어 차례로 돌릴 것');
  // 3) 상속 — 출연자가 죽으면
  if (사망) {
    notes.push('출연자 사망(' + 사망 + ') — 차명이면 계좌 잔액 ' + won(잔액합) + '원은 출연자 상속재산(상증법 §2 3호·§7). 증여로 보면 상속 전 10년(상속인)·5년(그 밖) 안 증여는 상속세 과세가액에 더함(§13①)');
    notes.push('차명 금융재산의 금융재산 상속공제(§22, 순금융재산 20%·2억 한도): 상속세 신고기한까지 신고한 타인 명의 금융재산만 공제에 들고, 기한 안 신고하지 않은 차명 금융재산은 공제에서 빠짐(§22② — 원문 확인 2026-11-04)');
    notes.push('증여로 보아 상속세 과세가액에 더할 때 계산기 상속인 목록(priorGiftHeirs)에 상속인마다 법정상속분(legalShareRatio)까지 넣을 것 — 비우면 증여세액공제(§28②) 한도를 예전 근사로 셈해 공제가 적게 나올 수 있음(검토대상)');
    if (jmYn_(p.상속세신고) === true && jmYn_(p.신고에넣음) !== true) { notes.push('상속세 신고에서 차명계좌를 뺐음 — 과소신고 가산세(부정행위면 40%, 국세기본법 §47의3②)·납부지연 가산세, 기한 뒤라도 수정신고하면 가산세 감면(§48②1호 — 기간별 비율 (원문 확인 2026-11-04: 국기법 §48②1호 가~바목))'); 할일.push({ 무엇: '차명계좌를 넣은 상속세 수정신고', 때: '되도록 빨리(법정신고기한 뒤 2년 안이면 가산세 감면)', 근거: '국세기본법 §45①·§48②1호' }); }
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
  else if (jmYn_(p.부정행위) === true && jmYn_(p.관련자사망) === true) notes.push('상속인·증여자·수증자 중 사망한 사람이 있으면 1년 특례 없음(§26의2⑤ 단서) — 다만 차명계좌를 상속인이 취득한 1호 사례에서 「상속인」 사망만 빼는지 (원문 확인 2026-11-04: 국기법 §26의2⑤ 단서)');
  notes.push('범위 밖 한 줄: 금융실명법상 차명거래 금지·형사처벌, 차명계좌 이자·배당의 소득세 차등과세(금융실명법 §5)는 이 도구가 보지 않음 [실사건 때 확인]');
  return jmWrap_('차명계좌', reqs, { 계좌판정: 계좌, 증여추정합계: 추정합, 잔액합계: 잔액합, 차명: 차명, 경우: 경우, 엔진칸: 경우[1] ? 경우[1].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 제척기간: 제척, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 67 「위씨 상속세 대납」] 세금 대신 내기 — 상속인 한 사람이 다른 상속인 몫 상속세를 내거나, 증여자가 수증자 증여세를 대신 낼 때 그 돈이 또 증여인지
//  상속세: 상속인·수유자는 각자 받았거나 받을 재산(상속으로 얻은 자산 총액 + §13① 가산 증여재산 − 부채 − 그 상속으로 낼 상속세 − 가산 증여재산 증여세, 시행령 §3③)을 한도로 연대납부(상증법 §3의2③)
//   → 자기 몫을 넘어 낸 금액 중 한도 안은 연대납부의무 이행, 한도를 넘은 금액은 다른 상속인에게 준 것([확인 필요 — 권장: 연대납부의무 이행은 자기 채무 이행이라 증여 아님이 법 구조상 자연 — 집행기준 원문 없음. 권장 유지] — 집행기준·판례 근거 미확인, 증여 조문은 §4① 또는 §36 채무면제 등).
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
    notes.push('(원문 확인 2026-11-04: 상증령 §3③) 한도에서 빼는 「그 상속으로 부과되거나 납부할 상속세」(시행령 §3③)가 자기 몫 상속세인지 상속세 전체인지 — 자기 몫으로 셈(전체로 보면 한도가 줄어 증여가 커짐)');
    notes.push('[확인 필요 — 권장: 1167과 같음] 한도 안에서 다른 상속인 몫을 낸 것은 연대납부의무 이행이라 증여가 아니라는 근거(집행기준·판례) 원문 미확인 — 다만 낸 사람이 다른 상속인에게 구상권을 포기하면(돌려받지 않기로 하면) 그 금액을 증여로 보는지도 함께 [확인 필요 — 권장: 1167과 같음]');
    // 한도를 넘은 금액 → 덜 낸 상속인에게 덜 낸 비율로 나눠 증여(경우)
    넘은사람.forEach(function (g) {
      hs.filter(function (h) { return h.덜낸 > 0; }).forEach(function (h) {
        const amt = 덜낸합 ? Math.floor(g.한도넘음 * h.덜낸 / 덜낸합) : 0; if (!amt) return;
        경우.push({ 이름: '한도 넘은 대납 — ' + g.이름 + ' → ' + h.이름 + ' ' + won(amt) + '원 증여(납부일 ' + (납부일 || '모름') + ')', 엔진칸: { giftAmount: amt, relation: relOf(h.관계), giftDate: 납부일 || undefined, isDoneeResident: true } });
      });
    });
    if (경우.length) { notes.push('[확인 필요 — 권장: 타인 세금 대납은 ’제3자로부터 변제를 받은’ 것이라 §36① 문언에 직접 해당(증여일 = 변제받은 날). 권장 §36①로 적음] 한도를 넘은 대납을 증여로 볼 때의 조문(§4① 일반 증여인지 §36 채무면제 등인지)과 받은 사람 — 덜 낸 상속인에게 덜 낸 비율로 나눔'); 할일.push({ 무엇: '한도 넘은 대납분 증여세 신고(받은 상속인)', 때: 납부일 ? new Date(Date.UTC(+납부일.slice(0, 4), +납부일.slice(5, 7) + 3, 0)).toISOString().slice(0, 10) + '까지(납부일이 든 달 말일부터 3개월)' : '납부일이 든 달 말일부터 3개월', 근거: '상증법 §68①' }); }
    notes.push('연부연납 중 한 사람이 남은 회차를 다 내는 경우도 같음 — 회차마다 낸 날 기준으로 한도·증여를 다시 봄 [확인 필요 — 권장: 회차마다 변제받은 날이 증여일 — §36①과 일관. 권장 유지]');
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
    notes.push('증여자가 수증자 증여세 ' + won(대납) + '원을 대신 냄 → 그 금액도 수증자가 받은 증여(같은 증여자 10년 안이라 원증여 ' + won(원) + '원과 합산 §47②) — 증여일은 대신 낸 날((원문 확인 2026-11-04: 상증법 §36①))');
    경우.push({ 이름: '대신 낸 증여세도 증여 — 원증여와 합산', 엔진칸: { giftAmount: 대납, relation: relOf(q.관계), giftDate: 납부일 || undefined, isDoneeResident: !/비거주/.test(상황), priorGiftAmount: 원, priorPaidTax: n(q.증여세) || undefined, priorGiftTaxableBase: n(q.원증여과세표준) || undefined } });
    notes.push('[확인 필요 — 권장: 해석① 합산해 따로(코드) / 해석② 처음부터 가액에 넣어 역산. 권장 ①(법은 변제받은 날 증여로 봄)] 원증여 때 「증여세는 증여자가 낸다」고 약정해 함께 넘긴 경우 처음부터 증여가액에 넣어(세금의 세금) 한 번에 셈하는지 — 경우는 대신 낸 날 따로 증여로 합산해 셈');
    할일.push({ 무엇: '대신 낸 증여세분 증여세 신고(합산)', 때: '대신 낸 날이 든 달 말일부터 3개월', 근거: '상증법 §47②·§68①' });
  }
  if (/비거주/.test(상황)) notes.push('수증자 비거주자 — 증여재산공제 없음(§53 본문 거주자만), 국외 재산이면 국제조세조정법 §35(넥스 국외증여 판정)');
  notes.push('범위 밖 한 줄: 부담부증여에서 수증자가 증여자의 양도소득세를 대신 내면 증여자에게 준 것인지 [확인 필요 — 권장: 증여자의 양도세를 수증자가 내면 증여자가 변제받은 이익(§36①) — 권장 그대로 범위 밖 안내 유지] — 이 도구는 상속세·증여세 대납만 봄');
  return jmWrap_('세금대납', reqs, { 종류: '증여세', 연대납부: 연대, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 68 「선씨 세무조사 통지」] 세무조사 절차 — 사전통지 기한·연기신청·조사기간 한도(연장·중지)·중복조사 금지·결과통지 기한·조사 중 수정신고 가산세를 한꺼번에 봄
//  사전통지: 조사 시작 20일 전(불복 재조사 결정에 따른 재조사는 7일 전) 서면 통지 — 증거인멸 등으로 조사 목적을 이룰 수 없으면 생략(국세기본법 §81의7①, 2024.12.31 개정 문구 (원문 확인 2026-11-04: 국기법 §81의7①)).
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
  else if (받 && 시작) { const d = 일수(받, 시작); reqs.push(jmReq_('사전통지 ' + 앞 + '일 전', d >= 앞, '통지 받은 날 ' + 받 + ' → 조사 시작 ' + 시작 + ' = ' + d + '일 전' + (d >= 앞 ? '' : '(' + (앞 - d) + '일 모자람)'), '국세기본법 §81의7①')); if (d < 앞) notes.push('사전통지가 ' + 앞 + '일보다 늦게 옴 — 절차 위반은 조사 연기 요청·납세자보호관(§81의16) 권리보호 요청 거리, 이 위반만으로 과세처분이 무효·취소되는지 [확인 필요 — 권장: 원문 없음 — 현 안내 유지]'); }
  else reqs.push(jmReq_('사전통지 ' + 앞 + '일 전', null, '통지 받은 날·조사 시작일을 모름', '국세기본법 §81의7①'));
  // 2) 연기신청
  const 사유 = String(p.연기사유 || '');
  if (사유) {
    const 법정 = /재해|화재|천재|질병|병|입원|출장|압수|영치|사업|어려|부도|도산/.test(사유);
    reqs.push(jmReq_('조사 연기 신청 사유', 법정 ? true : null, 사유 + (법정 ? ' — 법정 사유' : ' — 「이에 준하는 사유」(시행령 §63의7①4호)인지 세무서 판단'), '국세기본법 §81의7②·시행령 §63의7①'));
    notes.push('연기 신청은 문서로(시행령 §63의7②) — 세무서는 조사 시작 전까지 결과를 알려야 하고(§81의7③), 연기 사유가 없어지면 5일 전 통지 뒤 조사를 시작할 수 있음(§81의7④1호·⑤ — 원문 확인 2026-11-04)');
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
    notes.push('조사기간 ' + 시작 + ' ~ ' + 끝 + ' = ' + (일수(시작, 끝) + 1) + '일' + (중지일 ? ' − 중지 ' + 중지일 + '일(§81의8④ 안 셈)' : '') + ' = ' + 쓴 + '일 [확인 필요 — 권장: 법문에 영업일 규정 없음 → 달력 날수·첫날 포함이 문언(코드). 권장 유지]');
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
    if (!허용 && r) notes.push('중복조사 금지(§81의4②) 위반으로 얻은 과세자료에 근거한 처분은 위법하다는 판례가 있다고 알려짐 — 판례 원문 미확인 [확인 필요 — 권장: 판례 원문 없음 — 안내 유지], 과세전적부심사·불복에서 첫 다툼 거리');
  }
  // 5) 결과통지 기한
  const 실끝 = jmYmd_(p.실제종료일) || jmYmd_(p.조사종료일);
  if (실끝) {
    const 기한 = famAddD_(실끝, 20), 결 = jmYmd_(p.결과통지받은날);
    reqs.push(jmReq_('조사결과 통지 20일 안', 결 ? 결 <= 기한 : null, '조사 마친 날 ' + 실끝 + ' → ' + 기한 + '까지' + (결 ? ' · 받은 날 ' + 결 : ' · 아직 안 받음') + ' (공시송달 사유면 40일)', '국세기본법 §81의12①'));
    if (결) { const why = []; const 적부 = apShift_(famAddD_(결, 30), hol, why); 할일.push({ 무엇: '과세전적부심사 청구(조사결과 통지 내용이 틀렸다고 보면) — 넥스 불복기한 판정으로 다시 확인', 때: 적부 + '까지(받은 날부터 30일' + (why.length ? ', ' + why.join('') : '') + ')', 근거: '국세기본법 §81의15②' }); notes.push('조사결과 통지를 받으면 과세전적부심사(§81의15) 결정 전까지는 고지(경정)를 미룸이 원칙 — 다만 제척기간이 3개월 안 남는 등 §81의15③ 사유면 바로 고지될 수 있음 [실사건 때 확인 — 호 번호]'); }
    else 할일.push({ 무엇: '조사결과 통지 받기(못 받으면 세무서에 요청)', 때: 기한 + '까지', 근거: '국세기본법 §81의12①' });
  }
  // 6) 조사 중 수정신고 — 가산세 감면 없음
  const 수정 = jmYmd_(p.수정신고일);
  if (수정 && 받 && 수정 >= 받) notes.push('세무조사 통지를 받은 뒤(' + 받 + ') ' + 수정 + ' 수정신고 — 경정할 것을 미리 알고 낸 수정신고라 과소신고 가산세 감면(§48②1호) 없음(시행령 §29 1호). 다만 납부지연 가산세는 수정신고 납부일까지만 붙어 일찍 내는 것이 이익');
  else if (수정) notes.push('조사 통지 전 수정신고(' + 수정 + ') — 법정신고기한 뒤 기간별 과소신고 가산세 감면(§48②1호) 대상');
  notes.push('조사 중 권리: 조사 대상·사유를 적은 사전통지·조사원증 확인(§81의7), 세무대리인 조력(§81의5), 납세자보호관 권리보호 요청(§81의16) — 장부는 조사 목적 범위만 일시 보관 가능(§81의10) (원문 확인 2026-11-04: 국기법 §81의10①~⑥)');
  notes.push('범위 밖 한 줄: 조세범칙조사(조세범 처벌절차법)·지방세 세무조사 절차는 이 도구가 보지 않음');
  return jmWrap_('세무조사절차', reqs, { 사전통지기한일수: 앞, 기간예외: 예외 || undefined, 중지일수: 중지일 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 69 「경씨 손녀 결혼」] 가족 사이 생활비·교육비·축의금·혼수·결혼자금 — 비과세 증여(상증법 §46 5호·시행령 §35④)와 과세 증여를 가르고, 과세분에 혼인·출산 공제(§53의2) 기간을 따짐
//  비과세: 사회통념상 인정되는 이재구호금품·치료비·피부양자의 생활비·교육비(§46 5호), 학자금·장학금, 통상 필요한 기념품·축하금·부의금, 통상 필요한 혼수용품 등 — 「해당 용도에 직접 지출한 것」만(시행령 §35④ 본문).
//   그래서 생활비·교육비 명목이라도 예금·적금·주식·부동산·전세보증금 등 재산으로 남으면 과세([확인 필요 — 권장: ’직접 지출’ 문언으로 재산 축적분은 비과세 아님이 문언상 도출(집행기준 원문은 없음). 권장 유지] — 집행기준 46-35-1 원문 미대조). 부양할 사람(부모)이 능력이 있는데 조부모가 낸 손주 생활비·교육비는 「피부양자」가 아니라 과세될 수 있음([확인 필요 — 권장: ’직접 지출’ 문언으로 재산 축적분은 비과세 아님이 문언상 도출(집행기준 원문은 없음). 권장 유지] — 같은 집행기준).
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
      if (손주 && 피부양 !== false) notes.push('[확인 필요 — 권장: 피부양자 여부가 요건 — 부양 의무자가 따로 있으면 피부양자 아님이 문언 해석. 권장 유지(사실관계 확인)] 조부모가 손주 ' + 항 + '를 낸 경우 — 손주의 부모에게 부양 능력이 있으면 손주는 조부모의 「피부양자」가 아니라 과세된다는 해석(집행기준 46-35-1·판례) 원문 미대조. 부모의 소득·재산 자료로 확인');
    } else if (/학자금|장학금|등록금/.test(항)) { 비과세 = 직접 ? true : null; 왜 = 직접 ? '학자금을 학교에 바로 냄(시행령 §35④2호)' : '학자금을 수증자 통장으로 받음 — 실제 등록금으로 낸 증빙 필요'; 근거 = '시행령 §35④2호'; }
    else if (/축의금|축하금|부의금|기념품|돌|선물/.test(항)) { 비과세 = null; 왜 = '통상 필요한 금품인지(사회통념) — 금액·관계·형편으로 세무서가 판단, 기준 금액 없음'; 근거 = '시행령 §35④3호'; }
    else if (/혼수/.test(항)) { 비과세 = null; 왜 = '통상 필요한 혼수용품(가구·가전 등 일상 용품)은 비과세 — 사치용품·주택·차량은 아님'; 근거 = '시행령 §35④4호'; }
    else if (/차량|자동차|예물|명품|보석|결혼자금|전세|주택|현금/.test(항)) { 비과세 = false; 왜 = 항 + ' — 통상 필요한 혼수용품이나 생활비로 보기 어려움(재산 이전)'; 근거 = '시행령 §35④4호 반대 해석 (원문 확인 2026-11-04: 상증령 §35④4호)'; }
    else { 비과세 = null; 왜 = '항목 「' + 항 + '」 — 비과세 열거(시행령 §35④)에 맞는지 확인'; }
    return { 번호: i + 1, 증여자: x.증여자 || '', 관계: x.관계 || '', 항목: 항, 금액: 금, 날짜: 날, 비과세: 비과세, 왜: 왜, 근거: 근거, 손주: 손주 };
  });
  판.forEach(function (x) { reqs.push(jmReq_(x.번호 + '. ' + (x.증여자 || x.관계) + ' ' + x.항목 + ' ' + won(x.금액) + ' 비과세', x.비과세, x.왜, x.근거)); });
  // 2) 축의금 — 혼주 몫을 자녀가 가지면 혼주가 준 증여
  const 축 = p.축의금 || {};
  if (n(축.총액)) {
    const 혼주 = n(축.혼주몫), 본인 = n(축.총액) - 혼주;
    notes.push('축의금 ' + won(n(축.총액)) + ' = 신랑·신부 손님 몫 ' + won(본인) + '(본인에게 귀속, 증여 아님) + 혼주(부모) 손님 몫 ' + won(혼주) + '(혼주에게 귀속) [확인 필요 — 권장: 판례·집행기준 영역. 권장 현 구분 유지]');
    if (혼주 && (/신랑|신부|본인|자녀/.test(String(축.받은사람 || '')) || jmYn_(축.쓴곳) === true || 축.쓴곳)) {
      판.push({ 번호: 판.length + 1, 증여자: '혼주(부모)', 관계: '아버지', 항목: '혼주 몫 축의금', 금액: 혼주, 날짜: 혼인 || '', 비과세: false, 왜: '부모 손님이 낸 축의금을 자녀가 가져 ' + (축.쓴곳 && 축.쓴곳 !== true ? 축.쓴곳 : '재산') + '에 씀 — 혼주가 자녀에게 준 증여', 근거: '상증법 §4① [확인 필요 — 권장: 혼주에게 귀속된 돈이 자녀에게 가면 §4① 증여 — 문언에 맞음, 귀속 판단만 사실관계]' });
      reqs.push(jmReq_('혼주 몫 축의금 ' + won(혼주) + ' 자녀에게 넘어감', false, '부모 손님 몫을 자녀가 가짐 — 증여', '상증법 §4① [확인 필요 — 권장: 1344와 같음]'));
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
    notes.push('약혼자 사망 등 부득이한 사유로 혼인이 안 되면 그 달 말일부터 3개월 안에 증여자에게 돌려주면 처음부터 증여가 없던 것(상증법 §53의2⑤, 사유는 시행령 (원문 확인 2026-11-04: 상증령 §46의3②))');
  }
  if (!거주) notes.push('수증자 비거주자 — 증여재산공제·혼인출산 공제 없음(§53·§53의2① 거주자만)');
  notes.push('비과세라도 증빙을 남길 것: 학교·병원·가게에 바로 낸 영수증, 생활비는 그때그때 쓴 통장 흐름 — 한꺼번에 받아 쌓아 두면 자금출처 조사(§45)에서 증여로 봄');
  return jmWrap_('생활비교육비', reqs, { 지출판정: 판, 비과세합계: 판.filter(function (x) { return x.비과세 === true; }).reduce(function (s, x) { return s + x.금액; }, 0), 과세합계: 판.filter(function (x) { return x.비과세 === false; }).reduce(function (s, x) { return s + x.금액; }, 0), 모름합계: 모름합, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 70 「모씨 증여 날짜 고르기」] 증여일을 언제로 할지 — 날짜 하나로 바뀌는 것들(기준시가 새 고시, 10년 합산에서 빠지는 날, 미성년→성년 공제, 혼인·출산 공제 기간, 시가 평가기간)을 후보일마다 펼쳐 세액 엔진 칸으로 넘김
//  재산가액: 증여일(평가기준일) 현재 시가(상증법 §60①), 증여일 전 6개월~후 3개월 안 매매·감정·수용 가액은 시가로 봄(시행령 §49①②) — 시가가 없으면 보충적 평가(§61):
//   토지 = 평가기준일 현재 고시된 개별공시지가(§61①1호·시행령 §50⑥), 주택 = 개별·공동주택가격(§61①4호 — 평가기준일 현재 고시된 가격을 쓰는 근거 조문 [확인 필요 — 권장: 주택은 §50⑥ 같은 명문이 없음 — §61①4호의 ’고시된 가격’ 문언과 토지 준용 해석(가 아닌 나에 가까움)]), 오피스텔·상업용 건물 = 국세청장 고시 가액(§61①3호).
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
  사전.filter(function (g) { return g.같은; }).forEach(function (g) { 문턱.push({ 날: famAddD_(famAddY_(g.날짜, 10), 1), 무엇: g.날짜 + ' 증여 ' + won(g.금액) + '원이 합산에서 빠지는 첫날 [확인 필요 — 권장: 해석① 10년 되는 날까지 합산, 다음 날부터 제외(코드) / 해석② 역산 초일 불산입. 권장 ①(안전 쪽으로 하루 늦춤)]', 근거: '상증법 §47②·§53' }); });
  if (성년일) 문턱.push({ 날: 성년일, 무엇: (p.수증자 || '수증자') + ' 성년 — 직계존속 공제 2천만 → 5천만(10년 안 이미 받은 공제와 합쳐 한도)', 근거: '상증법 §53 2호·민법 §4' });
  if (혼인) 문턱.push({ 날: famAddY_(혼인, 2), 무엇: '혼인 공제(1억) 기간 끝 — 혼인신고일 전후 2년', 근거: '상증법 §53의2①' });
  출생.forEach(function (b) { 문턱.push({ 날: famAddY_(b, 2), 무엇: '출산 공제(1억) 기간 끝 — 출생일부터 2년', 근거: '상증법 §53의2②' }); });
  문턱.sort(function (a, b) { return String(a.날).localeCompare(String(b.날)); });
  const 처음 = 후보[0], 끝 = 후보[후보.length - 1];
  const 사이 = 문턱.filter(function (t) { return t.날 > 처음 && t.날 <= 끝; });
  reqs.push(jmReq_('후보일 사이에 세액을 바꾸는 날이 있음', 사이.length ? true : false, 사이.length ? 사이.map(function (t) { return t.날 + ' ' + t.무엇; }).join(' / ') : '후보일 사이에 바뀌는 문턱 없음 — 날짜보다 재산·금액이 세액을 정함', '상증법 §47②·§53·§53의2·§61'));
  const 시가잡힘 = 판.some(function (x) { return x.재산.some(function (a) { return a.시가로잡힘; }); });
  if (시가잡힘) notes.push('평가기간(증여일 전 6개월~후 3개월) 안에 매매·감정 가액이 있으면 기준시가가 아니라 그 가액이 시가(시행령 §49①②) — 같은 단지 비슷한 집의 유사매매사례도 시가가 됨(§49④), 증여일을 옮기면 잡히는 사례도 바뀜. 증여일 뒤 3개월 안 매매사례가 생겨도 시가로 잡힐 수 있음. 아파트처럼 거래가 잦은 재산은 후보일을 옮겨도 그 평가기간 안 새 유사매매사례가 생기기 쉬우니, 기준시가로 잡힌 경우는 「그 사이 매매사례가 없을 때」만 맞음');
  notes.push('시가 없는 상업용 건물·나대지를 기준시가로 신고하면 국세청이 감정평가해 평가심의위원회를 거쳐 시가로 바꿀 수 있음(시행령 §49① 단서 — 법정결정기한까지) [실사건 때 확인 — 대상 범위는 국세청 사무처리규정]');
  notes.push('후보일마다 세액 엔진으로 돌려 견줄 것 — 경우마다 엔진칸이 있음. 기본 고시일(토지 5-31·주택 4-30·상업용 1-1)은 예상일이라 실제 고시일로 바꿔 넣을 것(부동산 가격공시에 관한 법률 시행령 공시 기한 [실사건 때 확인])');
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
    if (후보.length > 1) notes.push(이름 + ': 시가 후보 ' + 후보.map(function (c) { return c.종류 + ' ' + won(c.가액) + '(' + c.날짜 + ', ' + 날수(c.날짜) + '일)'; }).join(' · ') + ' → 상속개시일에 가장 가까운 ' + 시가왜.split(' — ')[0] + ' ' + won(시가) + '이 시가(시행령 §49②) — 감정은 가격산정기준일과 감정평가서 작성일이 모두 평가기간 안이어야 하고(§49②2호) 거리는 가격산정기준일로 잼 — 작성일이 기간 밖인 감정가는 후보에서 뺄 것');
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
  notes.push('(원문 확인 2026-11-04: 소득령 §163⑤1호 각 목·§163③ · 상증령 §20의3①) 감정 수수료를 나중 양도 때 필요경비로 넣을 수 있는지(상속세에서 이미 뺀 금액) — 넣지 않고 셈');
  notes.push('신고 뒤 평가기간 밖(법정결정기한 안)에 세무서가 감정해 시가로 고칠 수 있음(시행령 §49① 단서) — 기준시가 신고 뒤 그런 경정이면 과소신고 가산세는 없음(국세기본법 §47의3④1호다목: 상증법 §60②③·§66 평가가액으로 결정한 경우, 부정행위 제외 — 원문 확인 2026-11-04)');
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
    if (!비율) { r.안분못함 = true; notes.push(이름 + ': 토지·건물 기준시가(또는 감정가)가 둘 다 있어야 안분 — 없으면 장부가액 비율(부가가치세법 시행령 §64①3호) [실사건 때 확인]'); return r; }
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
  if (예외사유) notes.push('[확인 필요 — 권장: 부칙 없음 — 해석① 시행일 이후 양도분부터 / 해석② 신고분부터. 권장: 2025.2.28 이후 양도분에만 예외 적용, 그 전 양도는 예외 없이 30% 규칙(보수)] 시행령 §166⑧(2025.2.28 신설)의 적용 시기 — 부칙 원문 미확인, 그 전 양도엔 예외가 없었을 수 있음');
  notes.push('[확인 필요 — 권장: 문언은 ’가액’을 토지·건물 각각으로 읽히고 하나라도 차이 나면 ’구분이 불분명한 때’로 봄이 자연(코드). 권장 유지] 30% 차이를 토지·건물 어느 하나라도 넘으면 보는지(이 도구), 둘 다 넘어야 보는지 — 합계가 같으면 한쪽만 30% 넘는 경우는 드물지만 비율이 크게 다르면 생김');
  // 양도 엔진칸 — 토지·건물 두 거래로(같은 묶음이라 손익 통산 §102②), 공통 비용은 인정 가액 비율로 안분(§100② 후단)
  const 엔진 = function (값양, 값취, 이름) {
    if (!양.합계 || !취.합계) return null;
    const 토지취득일 = jmYmd_((p.취득 || {}).토지날짜) || 취.날짜, 건물취득일 = jmYmd_((p.취득 || {}).건물날짜) || 취.날짜;
    const 나눔 = function (c, a, b) { return a + b ? Math.round(c * a / (a + b)) : 0; };
    // 함께 산 건물을 철거하고 토지만 팔면 철거한 건물 몫 취득가액도 토지 취득가액으로 [확인 필요 — 권장: 법문엔 철거 건물 취득가액을 토지에 넣는 규정 없음(예규·통칙 영역) — 권장: 토지 이용 목적 취득 뒤 철거면 토지 취득가액에 넣는 실무 해석 유지, 잠정 표시]
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
  if (양.토지만 && n((p.취득 || {}).건물)) notes.push('[확인 필요 — 권장: 같음] 건물을 철거하고 토지만 판 경우 철거한 건물의 취득가액(과 철거비)을 토지 취득가액에 넣음 — 근거 조문·통칙 원문 미확인');
  if (jmYn_(p.토지비사업용) === true) notes.push('토지가 비사업용 토지면 토지 몫에만 10%p 더함(소득세법 §104①8호) — 건물 몫을 부풀리면 세금이 줄어 보이지만 30% 넘으면 안분가액으로 다시 셈');
  if (토지취득일 && 건물취득일 && 토지취득일 !== 건물취득일) notes.push('토지(' + 토지취득일 + ')와 건물(' + 건물취득일 + ') 취득일이 달라 보유기간·장기보유특별공제가 따로 — 몫을 어떻게 나누느냐가 세액을 바꿈');
  if (jmYn_(p.주택) === true) notes.push('주택과 부수토지는 1세대1주택·중과를 함께 봄 — 판정은 1세대1주택 판정 도구로, 이 도구는 나눈 값만');
  if (jmYn_(p.특수관계) === true) notes.push('특수관계인과 거래면 합계 자체가 시가와 다른지 먼저 봄(부당행위계산 소득세법 §101①·시행령 §167③④) — 이 도구는 합계를 맞다고 보고 나누기만');
  notes.push('범위 밖 한 줄: 부가가치세도 건물 공급가액을 같은 방식으로 안분하고 30% 이상 차이면 안분가액(부가가치세법 §29⑨2호 [실사건 때 확인]) — 사는 사람의 감가상각·부가세 환급 때문에 건물값을 높게 적자는 요청이 흔함');
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
      r.왜 = (고지 ? '상속개시일 현재 피상속인이 낼 의무가 있던 ' + (/공공/.test(종류) ? '공공요금' : '세금') + ' — 공과금으로 뺌' : '고지서·체납 확인 서류가 없어 잠정') + (/공공/.test(종류) ? ' (원문 확인 2026-11-04: 상증령 §9① · 상증칙 §2의2)' : '');
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
      r.근거 = '시행령 §10① — 보증채무 기준은 상증법 기본통칙 [실사건 때 확인 — 통칙 번호·원문 미확인]';
      if (불능 !== true) r.받을것.push('주채무자 재산·변제능력 자료(파산·회생·체납 등)');
    } else if (/연대/.test(종류)) {
      const 비 = Number(c.부담비율) > 0 ? Number(c.부담비율) > 1 ? Number(c.부담비율) / 100 : Number(c.부담비율) : 0;
      const 불능 = jmYn_(c.다른연대채무자변제불능) === true;
      r.판정 = 비 || 불능 ? true : null;
      r.인정액 = 불능 ? 금액 : Math.round(금액 * 비);
      r.왜 = 불능 ? '다른 연대채무자가 갚을 수 없어 전부 뺌' : 비 ? '피상속인 부담 몫 ' + Math.round(비 * 100) + '%만 뺌' : '피상속인 부담 몫을 몰라 잠정';
      r.근거 = '시행령 §10① — 연대채무 기준은 상증법 기본통칙 [실사건 때 확인 — 통칙 번호·원문 미확인]';
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
    할일.push({ 무엇: '옥탑·근린생활시설을 주택으로 쓰지 않게 원상복구(용도 되돌림)하고 건축물대장·실제 쓰임을 맞춘 뒤 양도', 때: '양도(잔금) 전', 근거: '건축법 시행령 별표 1 제1호다목 — 양도일 현재 기준 [실사건 때 확인]' });
    notes.push('층수·세대수는 건축물대장이 아니라 실제 쓰임으로 봄 — 위반건축물(옥탑 증축·근생 주거)이면 세무서가 다세대로 보아 비과세를 부인한 사례가 많음 [판례 원문 미확인 — 확인 필요]. 양도일 현재 기준으로 보므로 팔기 전에 원상복구하면 다가구로 돌아올 수 있음 [판단 대기 — 판단거리3차 #16: 실제 쓰임 기준은 §155⑮ ’구획된 부분’ 문언과 맞음. 원상복구 뒤 보유·거주기간은 법문 없음(해석). 권장 유지]');
  }
  if (다가구 && !통째) notes.push('다가구를 구획별로 나눠 팔면 구획마다 한 주택 — 처음 판 구획은 다주택 상태 양도. 한 번에 팔거나 마지막 구획만 비과세를 기대할 수 있음 [확인 필요 — 권장: 법문은 구획별 양도면 구획마다 한 주택 — 남은 구획의 보유기간은 원 취득일부터(새 취득 없음)가 자연. 권장 유지]');
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
    if (!p.상속인.every(function (h) { return h && h.지분 != null && h.지분 !== ''; })) 할일.push({ 무엇: '상속인별 실제 상속지분(협의분할서·등기부) — 법정지분이 아니라 실제로 나눈 지분', 때: '판정 전', 근거: '시행령 §155③ 「상속지분」 (원문 확인 2026-11-04: 소득령 §155③ 단서)' });
  }
  const 납 = 사람.find(function (h) { return h.이름 === p.납세자; });
  const 납세자주인 = !!(주인 && 납 && 주인.이름 === 납.이름);
  const 세대주인 = !!(주인 && 주인.같은세대);
  if (주인 && !납세자주인 && 세대주인) notes.push('최대지분자 「' + 주인.이름 + '」이 납세자와 같은 세대 — 1세대 주택 수에 그 공동상속주택이 듦(세대원 소유 주택은 세대 주택으로 셈) [확인 필요 — 권장: 소유로 보는 사람이 세대원이면 세대 주택 수에 듦이 1세대 판정 구조상 자연 — 예규 원문 없음. 권장 유지]');
  if (납 && !세대주인) reqs.push(jmReq_('납세자는 소수지분자 — 공동상속주택을 주택 수에서 뺌', true, '「' + 납.이름 + '」 지분 ' + Math.round((납.지분 || 0) * 10000) / 100 + '% · 상속받은 지 몇 년이 지나도 그대로(기간 제한 없음)', '시행령 §155③ 본문'));
  // 3) 양도하는 주택이 비과세인가
  const 양도 = String(p.양도주택 || '일반');
  const 다른 = n(p.다른주택수);
  let 한채 = null, 왜한채 = '';
  if (/공동|지분/.test(양도)) {
    한채 = null; 왜한채 = '공동상속주택 지분 자체를 팖 — §155③은 「그 외의 다른 주택」을 팔 때만 주택 수에서 뺌. 지분 양도는 세대가 가진 다른 주택과 함께 1세대1주택인지 따로 봐야 함 [확인 필요 — 권장: 문언상 지분 양도엔 §155③ 특례 없음 → 일반 판정(코드) 맞음. 권장 유지]';
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
  if (!세대주인 && 주인) notes.push('지분을 사고팔아 최대지분자가 바뀌면 판정이 바뀜 — 다른 상속인 지분을 추가로 사면 최대지분자가 될 수 있음 [확인 필요 — 권장: 추가 매입 지분은 ’상속으로’ 소유한 것이 아니라 공동상속주택 지분이 아님이 문언 — 최대지분 판정에 어떻게 넣는지는 예규. 권장 유지]');
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
    notes.push('주택등매매차익 ' + won(주택등차익) + '원(매매가액 − 필요경비 − 기본공제 250만, 장기보유특별공제는 3년 이상 보유분만 — 이 셈에서 뺐음 (원문 확인 2026-11-04: 소득령 §122②3호)) — 가목 세액은 이 거래들만 양도세 엔진(§104 세율)으로 돌린 산출세액');
    세2 = { 가목엔진칸: { transactions: 비교대상.map(엔진거래) }, 나목: 기본세(Math.max(0, 종합과표 - 주택등차익)) };
    reqs.push(jmReq_('비교과세 대상 자산(분양권·비사업용토지·미등기·중과 주택)', true, 비교대상.map(function (t) { return t.이름; }).join('·') + ' — 종합소득 산출세액과 (가)+(나) 중 큰 것', '소득세법 §64① 2호'));
  } else reqs.push(jmReq_('비교과세 대상 자산(분양권·비사업용토지·미등기·중과 주택)', false, '없음 — 종합소득 기본세율만(단기보유 70%·60% 세율이 적용되지 않음)', '소득세법 §64①'));
  경우.push({ 이름: '② 부동산매매업 사업소득으로 봄(기본세율·사업경비 공제·손익 통산)', 사업소득: 사업소득, 종합과세표준: 종합과표, 종합소득산출세액: 세1, 지방소득세포함: Math.floor(세1 * 1.1), 비교과세: 세2 || undefined });
  // 4) 예정신고 기한(매매업)
  const 예정 = 전체거래.filter(function (t) { return !(t.신축 && /주택/.test(t.종류)); }).filter(function (t) { return t.양도일; }).map(function (t) { const d = new Date(t.양도일.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + 3); d.setDate(0); return { 이름: t.이름, 매매일: t.양도일, 기한: d.toISOString().slice(0, 10), 단기기본세율: t.취득일 ? (new Date(t.양도일) - new Date(t.취득일)) < 2 * 365.25 * 86400000 : undefined }; });
  if (사업성) {
    예정.forEach(function (x) { 할일.push({ 무엇: '토지등 매매차익예정신고·납부 — ' + x.이름 + (x.단기기본세율 ? '(2년 미만 — 기본세율)' : ''), 때: x.기한, 근거: '소득세법 §69①③④' }); });
    할일.push({ 무엇: '종합소득세 확정신고(사업소득, 장부 — 복식부기 의무 여부는 수입금액 기준)', 때: '다음 해 5월 31일', 근거: '소득세법 §70·§160 [실사건 때 확인 — 업종별 기준 금액]' });
    notes.push('매매업이면 국민주택규모 초과 주택·토지 아닌 건물 매매에 부가가치세가 붙을 수 있음(부가가치세법 §26①12호 국민주택 공급만 면세) — 이 도구는 부가세를 셈하지 않음 [실사건 때 확인]');
    notes.push('매매업이면 지역 건강보험료가 사업소득으로 오름 — 세금 비교 밖 비용');
  } else notes.push('사업성 정황이 약함 — 양도소득(①)이 원칙. 같은 과세기간(반년)에 1회 취득·2회 판매가 되면 매매업으로 볼 수 있으니 거래 시기를 나눌 때 주의 [확인 필요 — 권장: 소득세법 쪽은 산업분류 기준이고 반년 1취득·2판매는 부가세령 기준 — 사업성 판단은 사실관계. 권장: 안내에 ’부가세령 기준’임을 적고 유지]');
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
  reqs.push(jmReq_('사업인정고시일(고시 전 양도면 양도일)부터 소급 2년 이전 취득', 이년, 취득 ? '취득 ' + 취득 + ' · 기준일 ' + (기준일 || '?') + (고시 && 양도 && 고시 > 양도 ? '(고시 전 양도 — 양도일 기준)' : '') : '취득일 모름', '조특법 §77의2① — §77⑨(피상속인·증여자 취득일)은 §77①②에만 있고 §77의2엔 준용 규정이 없음(원문 확인 2026-11-04): 상속·증여로 취득한 땅은 본인 취득일 기준(보수), 피상속인 취득일로 보는 쪽은 [해석 갈림 — 권장: 본인 취득일]'));
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
    notes.push('대토 취득일을 등기일(' + (등기 || '?') + ')로 넣음 — 대토 취득시기(잔금·등기 중 빠른 날, 소득세법 시행령 §162) 확인 (원문 확인 2026-11-04: 소득령 §162①1·2호)');
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
        추징.이자기간 = { 시작: pd.toISOString().slice(0, 10), 끝: 끝, 날수: Math.max(0, Math.round((new Date(끝) - pd) / 86400000) + 1), 율: '1일 0.022%(시행령 §11의2⑩2호) (원문 확인 2026-11-04: 조특령 §73④ · 조특법 §77의2③·§77⑤→§63③ 준용 · 조특령 §11의2⑩2호)' };
        notes.push('이자상당액 = 추징세액 × 날수 ' + 추징.이자기간.날수 + '일(당초 예정신고 납부기한 다음 날 ' + 추징.이자기간.시작 + ' ~ 납부일 ' + 끝 + ') × 1일 0.022% — 시행령 §63⑨ 준용 [율 원문 대조 — 확인 필요]');
      }
      경우.push({ 이름: '⑥ 추징 — ' + 대상, 추징: 추징 });
    }
  } else if (요건) {
    할일.push({ 무엇: '대토 등기 뒤 3년 안에 팔거나 증여하지 말 것 · 대토 권리를 전매하지 말 것(현금 전환 + 이자 추징)', 때: 등기 ? (function () { const d = new Date(등기); d.setFullYear(d.getFullYear() + 3); return d.toISOString().slice(0, 10) + '까지'; })() : '대토 등기 뒤 3년', 근거: '시행령 §73④⑤' });
  }
  if (요건) 할일.push({ 무엇: '세액감면신청서 또는 과세이연신청서 + 대토보상 신청서·계약서 사본 제출', 때: '양도한 해 과세표준신고 때(예정·확정)', 근거: '조특법 §77의2④ · 시행령 §73⑥' });
  notes.push('§77·§77의2·§77의3 감면 합계 한도: 과세기간 2억, 직전 4개 과세기간 포함 3억(§133②, 2025년 이후 양도) — 직전 감면액(직전감면77)을 넣으면 엔진이 셈. 과세이연은 감면이 아니라 한도에 들지 않음 (원문 확인 2026-11-04: 조특법 §133②)');
  notes.push('농어촌특별세: 감면세액의 20%(농어촌특별세법 §5①1호) — 엔진 결과의 농특세를 함께 볼 것. 과세이연에는 농특세 없음 (원문 확인 2026-11-04: 농특세법 §5①1호)');
  return jmWrap_('대토보상', reqs, { 요건충족: 요건, 대토비율: Math.round(대토 / 총 * 10000) / 10000, 과세이연금액: 요건 ? 이연금액 : undefined, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: true, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 78 「봉씨 수용 보상금」] 수용 보상금을 종류마다 가르기 — 양도소득·사업소득·기타소득·과세 안 함
//  양도소득은 토지·건물(건물에 부속된 시설물과 구축물 포함)의 양도로 생긴 소득만(소득세법 §94①1호) — 보상금 전부를 양도가액으로 넣으면 세액이 부풀고 §77 감면 한도도 엉뚱하게 씀
//  영업손실(휴업·폐업)보상금 = 사업과 관련된 수입금액(시행령 §51③5호) [예규 원문 미확인 — 확인 필요] · 공익사업 지역권·지상권 설정 대가 = 기타소득(§21①9호, 필요경비 60% 시행령 §87 1호의2, 원천 20% §129①6호 라목, 기타소득금액 300만원 이하 분리과세 선택 §14③8호 가목)
//  주거이전비·이사비·이주정착금은 소득세법이 열거한 소득이 아님 — 과세 안 함 [예규 원문 미확인 — 확인 필요] · 영농손실보상금은 작물재배업 관련(§19①1호 괄호·§12 2호 바목) — 과세 안 됨이 일반 [확인 필요 — 권장: 열거 밖 소득은 과세 안 됨이 법 구조(예규 원문은 없음). 영농손실보상은 작물재배업 수입이면 §19①1호 괄호·§12 비과세 범위에 따라 갈림(작물 종류·규모 사실관계). 권장 유지]
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
    [/구축물|부속|담장|옹벽|정화조/, '양도', '건물에 부속된 시설물·구축물 — 건물과 함께 양도', '소득세법 §94①1호 괄호 — 건물에 딸리지 않은 독립 구축물이면 [실사건 때 확인]'],
    [/수목|입목|과수/, '확인', '수목 — 토지와 함께 넘기는 정착물이면 토지 양도가액에 포함, 따로 이전·벌채하는 보상이면 양도 아님', '소득세법 §94①1호 [예규 원문 미확인 — 확인 필요]'],
    [/영업손실|휴업|폐업|영업보상/, '사업', '영업손실(휴업·폐업)보상 — 사업과 관련된 수입금액', '소득세법 시행령 §51③5호 [예규 원문 미확인 — 확인 필요]'],
    [/축산/, '사업', '축산 휴업보상 — 축산업 사업소득 총수입금액', '소득세법 §19①1호 · 시행령 §51③5호 [확인 필요 — 권장: 문언상 사업 관련 수입금액 — 포괄 규정이라 해당(예규 원문 없음). 권장 유지]'],
    [/영농손실|영농보상|농업손실/, '과세안함', '영농손실보상 — 작물재배업 관련(곡물·식량작물은 사업소득 아님, 그 밖 작물재배업 수입 10억원 이하 비과세)', '소득세법 §19①1호 괄호 · §12 2호 바목 · 시행령 §9의4 [예규 원문 미확인 — 확인 필요]'],
    [/주거이전|이사비|이주정착|이주대책|이주비/, '과세안함', '주거이전비·이사비·이주정착금 — 소득세법이 열거한 소득이 아님', '소득세법 §4①·§16~§21·§94 열거 밖 [예규 원문 미확인 — 확인 필요]'],
    [/기계|시설.*이전|이전비|동산/, '사업', '기계·시설 이전비·동산 이전 보상 — 사업용이면 사업소득 총수입금액, 아니면 과세 안 함', '소득세법 시행령 §51③5호 [확인 필요 — 권장: 사업용이면 사업 관련 수입(포괄), 비사업용 동산 보상은 열거 밖 — 2113과 같음]']
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
  if (사합) notes.push('사업 갈래 ' + won(사합) + ' — 받은 해 사업소득 총수입금액(시행령 §51③5호 [확인 필요 — 권장: 같음]). 폐업보상이면 폐업 연도 종합소득세 신고에 넣고, 사업소득 세액은 이 판정에서 셈하지 않음(종합소득세 도구 없음) — 다른 사업소득·경비와 합쳐 따로 셈' + (jmYn_(p.복식부기) === true ? ' · 복식부기의무자는 사업용 유형자산(토지·건물 제외) 처분 이익도 사업소득(§19①20호)' : ''));
  if (무합) notes.push('과세 안 함 갈래 ' + won(무합) + ' — 양도가액·종합소득에 넣지 않음. 다만 근거가 예규·판례라 원문 확인 필요 [확인 필요 — 권장: 같음]');
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
  if (이의.length) notes.push('이의재결 증액 ' + won(합(이의)) + ' — 당초 양도가액에 더해 수정신고(국세기본법 §45) 또는 처음부터 합쳐 확정신고. 소송 증액과 달리 시행령 §173④ 가산세 면제 길이 없음 (원문 확인 2026-11-04: 소득령 §173④ · 국기법 §45(수정신고))');
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
//  고가주택 12억 판정·1세대1주택 비과세는 주택과 배율 안 부수토지만(넘는 땅 값은 빼고 셈 [확인 필요 — 권장: 배율 밖 땅은 비과세 대상 주택 부수토지가 아니므로 고가주택 가액에서도 빼는 해석이 §156 ’주택 및 이에 딸린 토지’ 문언과 일관. 권장 유지(잠정)]) — 넘는 땅은 따로 한 거래(토지)로 엔진에 넘김
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
  else if (!새법 && /수도권|도시/.test(용)) { 배 = 5; 배근거 = '2021년 이전 양도 — 도시지역 5배(종전 규정 [확인 필요 — 권장: 원문 없음 — 2022.1.1 개정 전 도시지역 5배·밖 10배로 알려진 것, 코드 그대로 두되 잠정])'; }
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
  // 3) 금액 나누기 — 넘는 땅 = 땅 값 × 넘는 면적 ÷ 토지면적(같은 필지 단가 같다고 봄 — 위치로 단가가 크게 다르면 감정가액 비율로 [확인 필요 — 권장: 같은 필지 단가 동일 가정은 합리적이나 법문 없음 — 위치 차이가 크면 감정가액 비율. 권장 유지])
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
    else if (/보일러/.test(글)) { 칸 = '갈림'; 왜 = '보일러 교체는 난방시설 개량(자본적)으로 보는 예와 단순 교체(수익적)로 보는 예가 갈림 [확인 필요 — 권장: 해석① 설치·개량이면 자본적 / 해석② 같은 성능 단순 교체면 수익적. 권장: 성능 향상·새 설치면 자본적, 동일 교체는 수익적 — 사실관계로 가름(현 ’갈림’ 유지)]'; 근거 = '시행령 §67②2호·5호'; }
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
      칸 = '자본적지출'; 왜 = '용도변경·개량·확장·설비 설치(가치 증가)' + (/샷시|새시|창호|확장/.test(글) ? ' — 새시·발코니 확장은 자본적으로 보는 예규가 많음 [확인 필요 — 권장: 확장·새시는 §67②5호 ’개량·확장’에 가까움(실무도 자본적) — 예규 원문 없음. 철거비 요건은 법문 그대로(가). 권장 유지]' : '') + (/철거/.test(글) && !/재해|노후/.test(글) ? ' — 철거비는 재해·노후화 등 부득이한 재건축일 때만(아니면 안 됨) [확인 필요 — 권장: 확장·새시는 §67②5호 ’개량·확장’에 가까움(실무도 자본적) — 예규 원문 없음. 철거비 요건은 법문 그대로(가). 권장 유지]' : '');
      근거 = '시행령 §163③1호·3호·§67②';
      if (/철거/.test(글) && !/재해|노후|재건축/.test(글)) { 칸 = '갈림'; }
    }
    else if (/명도|이사비|퇴거/.test(글)) {
      if (jmYn_(it.매매계약따라) === false) { 칸 = '안됨'; 왜 = '매매계약상 인도의무 때문이 아닌 명도비'; 근거 = '시행령 §163⑤1호라목'; }
      else { 칸 = '양도비'; 왜 = '매매계약에 따른 인도의무를 이행하려고 쓴 명도비용' + (jmYn_(it.매매계약따라) === true ? '' : ' — 매매계약서 인도 조항 확인 남음'); 근거 = '시행령 §163⑤1호라목'; }
    }
    else if (/채권.*(매각|할인)|국민주택채권|토지개발채권/.test(글)) { 칸 = '양도비'; 왜 = '취득 때 산 국민주택채권 등을 만기 전 판 매각차손(금융기관 양도분 한도)'; 근거 = '시행령 §163⑤2호'; }
    else if (/중개|소개|신고서|세무사|계약서|공증|인지|증권거래세/.test(글)) { 칸 = '양도비'; 왜 = '양도에 직접 든 비용(소개비·신고서·계약서 작성비·공증·인지)'; 근거 = '시행령 §163⑤1호'; }
    else if (/컨설팅|감정|광고|분양/.test(글)) { 칸 = '갈림'; 왜 = '양도를 위한 컨설팅·감정·광고비는 「유사 비용」인지 갈림 [확인 필요 — 권장: 부동산엔 규칙 열거가 없어 ’유사 비용’으로 못 넣음이 문언 — 해석②(안 됨)가 보수. 권장: 양도비 불인정 기본, 소개비 성격이면 다목으로]'; 근거 = '시행령 §163⑤1호마목'; }
    else { 칸 = '갈림'; 왜 = '어느 칸인지 정해지지 않음 — 쓴 내용을 더 받아야 함'; 근거 = '소득세법 §97①'; }
    // 증빙 요건 — 자본적지출·양도비는 §160의2② 증명서류 또는 금융거래 증명이 있어야 함
    let 증빙 = null;
    if (칸 === '자본적지출' || 칸 === '양도비' || 칸 === '갈림') {
      if (증빙됨 === false) { 증빙 = false; 합.증빙없음 += 금; }
      else if (증빙됨 === true) 증빙 = true;
    } else if (칸 === '취득가액' && 증빙됨 === false) 증빙 = false;
    let 반영 = 칸;
    if ((칸 === '자본적지출' || 칸 === '양도비') && 증빙 === false) { 반영 = '안됨'; 왜 += ' · 그러나 적격 증명서류도 금융거래 증명도 없어 인정 안 됨'; 근거 += ' · 시행령 §163③⑤ 본문'; }
    if (칸 === '취득가액' && 증빙 === false) 왜 += ' · 지급 증명이 없으면 실지거래가액으로 인정받기 어려움 (원문 확인 2026-11-04: 소득세법 §97①1호가(실지거래가액)·§97⑦·소득령 §176의2①)';
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
  let 수 = 셀.length; const 전체 = 판정.length;
  // [2026.11.04 판정 정리] 혼인 특례(소득령 §167의3⑨ 원문 확인): 혼인으로 3주택 이상이 된 세대가 혼인일부터 5년 안에 양도하면 양도일 현재 배우자 보유 주택 수를 빼고 셈(5년 안 새 주택을 산 뒤 양도분은 제외)
  const 혼인 = jmYmd_(p.혼인일), 배우자수 = n(p.배우자주택수), 혼인뒤취득 = jmYmd_(p.혼인뒤취득일);
  let 혼인특례 = '';
  if (혼인 && 양도일 && 양도일 <= addY(혼인, 5) && 수 >= 3 && 배우자수 > 0) {
    if (혼인뒤취득 && 혼인뒤취득 > 혼인 && 혼인뒤취득 <= 양도일) 혼인특례 = '혼인 뒤 새 주택을 취득(' + 혼인뒤취득 + ')한 뒤의 양도라 특례 없음(§167의3⑨ 단서)';
    else { 수 = Math.max(0, 수 - 배우자수); 혼인특례 = '혼인일(' + 혼인 + ')부터 5년 안 양도 — 배우자 보유 ' + 배우자수 + '채를 빼고 ' + 수 + '채로 셈(§167의3⑨)'; }
  }
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
  if (혼인특례) notes.push(혼인특례);
  else if (혼인 && 양도일 && 양도일 <= addY(혼인, 5) && 수 >= 3) notes.push('혼인일(' + 혼인 + ')부터 5년 안 양도 — 양도일 현재 배우자 보유 주택 수(배우자주택수 칸)를 넣으면 그만큼 빼고 셈(§167의3⑨)');
  notes.push('수도권 읍·면 소재 주택은 주택 수에 셈 — §167의3①1호 괄호의 읍·면 제외는 광역시·특별자치시에만 걸리고 수도권은 통째로 「외의 지역」 밖(원문 확인 2026-11-04)');
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
  if (실가 > 0 && rate == null) 할일.push({ 무엇: '생산자물가상승률 — 취득일(' + 취득일 + ')부터 ' + 의제일.slice(0, 4) + '.1.1. 직전일까지(한국은행 생산자물가지수) [확인 필요 — 권장: 법문은 지수 종류 미지정 — 권장: 취득일 속한 달·의제취득일 직전 달의 월 지수 비율(기간 대응이 정확)]', 때: '신고 전', 근거: '소득세법 시행령 §176의2④2호' });
  if (실가 > 0 && /상속|증여/.test(String(p.취득원인 || ''))) notes.push('상속·증여받은 자산의 「취득 당시 실지거래가액」은 상속개시일·증여일 현재 상증법 평가액(시행령 §163⑨) — 그 평가액이 확인될 때만 2호로 봄 (원문 확인 2026-11-04: 소득령 §163⑨)');
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
  if (고른 === '2호') notes.push('2호 가액도 추계(§97①1호나목)라 필요경비는 개산공제(의제취득일 기준시가 × 3%, 시행령 §163⑥) — 환산에만 있는 §97②2호 단서(실제 비용이 더 크면 그 금액)가 2호에도 미치는지 [확인 필요 — 권장: 단서는 환산취득가액일 때만 — 의제취득일 1호(환산)엔 되고 2호(실가+물가)엔 문언상 안 됨. 권장: 2호 고르면 개산공제만(코드)]');
  if (!의기) notes.push('개산공제의 「취득 당시 기준시가」는 의제취득일 현재 기준시가 — 없으면 필요경비 0으로 계산됨');
  notes.push('장기보유특별공제 보유기간도 ' + 의제일 + '부터(§95④·부칙 §8) — 엔진은 취득일이 그 전이면 스스로 의제취득일로 셈' + (주식 ? ' (원문 확인 2026-11-04: 소득세법 §95②(장특은 토지·건물만)·§95④ · 부칙 §8 원문 없음)' : ''));
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
    시기근거 = '소득세법 §98·시행령 §162①1·2호' + (/매도청구/.test(방식) ? ' [확인 필요 — 권장: 공탁은 변제 효력이 있어 공탁일을 청산일로 볼 여지 vs 수령일 — 법문 없음. 권장: 공탁일(변제 효과)로 잠정, 등기접수일이 빠르면 그날]' : '');
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
    if (기반 === true) { 호 = '2호'; 감면됨 = true; 감면왜 = 사업 + ' 정비구역(정비기반시설 수반)의 토지등을 사업시행자에게 양도 → §77①2호' + (/매도청구/.test(방식) ? ' — 매도청구로 넘긴 것도 사업시행자에게 양도 [확인 필요 — 권장: 매도청구에 따른 매매도 사업시행자에게 양도이므로 문언상 포함이 자연 — 예규 원문 없음. 권장 유지]' : ''); }
    else if (기반 === false) { 감면왜 = '정비기반시설을 수반하지 않는 정비구역 — 2호에서 빠짐(§77①2호 괄호), 수용도 아니라 감면 없음'; }
    else { 호 = '2호'; 감면됨 = true; 감면잠정 = true; 감면왜 = '정비기반시설 수반 여부를 모름 — 수반하면 2호, 아니면 감면 없음(잠정으로 2호)'; 할일.push({ 무엇: '정비계획 결정 고시문 — 정비기반시설(도로·공원 등) 설치 계획이 있는지', 때: '신고 전', 근거: '조특법 §77①2호 괄호' }); }
  }
  else if (소규모) { 감면왜 = '「빈집 및 소규모주택 정비에 관한 특례법」 사업 — 「도시 및 주거환경정비법」 정비구역이 아니라 2호 아님, 수용도 아니어서 감면 없음 (원문 확인 2026-11-04: 조특법 §77①2호·3호(수용))'; }
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
    reqs.push(jmReq_('2년 전 취득', y == null ? null : true, (y == null ? '모름' : 재는취득 + ' 취득 → 기준일 ' + 기준 + '까지 ' + y + '년') + (상속증여 && 앞 ? ' (앞사람 취득일, §77⑨)' : '') + (고시 ? '' : ' — 고시일이 없어 양도일로 셈'), '조특법 §77①·⑨ · 도시정비법 §65②(사업시행계획인가 고시 = 사업인정고시로 봄 — 법령 폴더에 원문 없음 [실사건 때 확인])'));
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
    if (멸 && 양도일 && 멸 <= 양도일) { 주택 = false; reqs.push(jmReq_('양도일 현재 주택', true, '아님 — 주택을 ' + 멸 + '에 헐고 ' + 양도일 + '에 넘김 — 양도일 현재 주택이 아니라 토지 양도(1세대1주택 비과세 안 됨) [판단 대기 — 판단거리3차 #17: 양도일 현재 주택이 아니면 토지 양도가 문언 — 예규 원문 없음. 권장 유지]', '소득세법 §89①3호·시행령 §154①')); }
    else if (!멸) { 주택 = true; 주택잠정 = !양도일; reqs.push(jmReq_('양도일 현재 주택', true, '헐기 전에 넘김(또는 멸실일 모름 — 건축물대장 말소일 확인)', '소득세법 §89①3호')); if (!jmYmd_(p.멸실일)) 할일.push({ 무엇: '건축물대장(말소 여부·말소일) — 양도일 전에 헐렸으면 토지 양도', 때: '신고 전', 근거: '소득세법 §89①3호' }); }
    else { 주택 = true; reqs.push(jmReq_('양도일 현재 주택', true, '멸실일(' + 멸 + ')이 양도일 뒤 — 주택 양도', '소득세법 §89①3호')); }
    if (주택) {
      const 일 = jmYn_(p.일주택);
      비과세 = 일 === true;
      reqs.push(jmReq_('1세대1주택', 일 == null ? null : true, 일 === true ? '1세대1주택 — 12억 넘는 몫만 과세' : 일 === false ? '1세대1주택 아님' : '모름 — 「세대판정」·「1세대1주택」 판정으로', '소득세법 §89①3호·시행령 §154'));
      if (일 === true && 고시 && 재는취득 && 재는취득 < 고시) notes.push('사업인정고시일 전 취득 주택이 협의매수·수용되면 보유·거주 기간 제한이 없음(시행령 §154①2호가목) — 정비사업 현금청산이 이 「협의매수·수용」에 드는지 [확인 필요 — 권장: 협의 현금청산은 수용이 아니고 토지보상법 협의매수도 아님 → 문언상 해당 안 됨이 보수(매도청구·수용재결은 ’그 밖의 법률에 의한 수용’ 가능). 권장: 수용재결·매도청구만 해당, 협의청산은 제외]. 엔진은 보유 2년이 넘으면 따로 볼 것 없음');
    }
  }
  if (!주택) notes.push('토지 양도면 비사업용 토지인지 「비사업용 토지」 판정으로 — 협의매수·수용 토지는 취득일이 사업인정고시일부터 5년 이전이면 사업용으로 봄(시행령 §168의14③3호나목); 멸실 뒤 나대지 기간만으로 비사업용이 되지 않는지 함께 볼 것');
  // 4) 양도가액에 넣을 것·뺄 것
  const 청 = n(p.청산금), 지연 = n(p.지연이자), 이주 = n(p.이주비), 주거 = n(p.주거이전비) + n(p.이사비);
  reqs.push(jmReq_('양도가액', 청 ? true : null, 청 ? won(청) + '원(청산금만)' + (지연 ? ' — 지연이자 ' + won(지연) + '원 뺌' : '') + (이주 ? ' · 이주비 ' + won(이주) + '원 뺌' : '') + (주거 ? ' · 주거이전비·이사비 ' + won(주거) + '원 뺌' : '') : '청산금을 모름', '소득세법 §96①'));
  if (지연) notes.push('현금청산 지연이자(도시정비법 §73③)는 양도대가가 아님 — 양도가액에 넣지 않음. 소득 구분(기타소득 등)은 [확인 필요 — 권장: 법정 지연이자는 §21①10호 ’배상금’·다목에 가까워 기타소득이 문언에 가장 가까움(원천 없음). 권장: 기타소득으로 잠정]');
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
      notes.push('확정신고를 안 했을 때 그 추가세액에 무신고가산세(§47의2, 20%)를 붙이는지 과소신고가산세(§47의3, 10%)를 붙이는지 법문에 따로 없음 — ② 과소로 계산, 무신고로 보면 가산세 ' + won(Math.round(추가 * 0.2)) + '원 [확인 필요 — 권장: 확정신고 자체를 안 했으므로 문언상 무신고(§47의2①) — 예정신고분은 ⑤로 제외되고 추가세액만 20%. 과소 10%는 예정신고를 ’신고’로 보는 해석. 권장: 무신고 20%를 기본 경우로, 과소 10%는 대안]');
    }
  } else if (거래.length >= 2) 할일.push({ 무엇: '거래마다 계산 칸(엔진칸) — 그 해 합산 계산(calculate_transfer_tax_multi)을 돌려 「합산산출세액」에 넣기', 때: '판정 전', 근거: '소득세법 §92·§103②·§104⑤' });
  // 예정신고 가산세 — 예정신고를 안 했으면 예정신고 기한 기준으로 가산세(국세기본법 §47의2① 괄호 「예정신고 포함」), 확정 때 같은 몫은 겹쳐 붙이지 않음(⑤)
  if (예정안함.length) notes.push('예정신고를 안 한 양도는 예정신고 기한(양도일이 속한 달 말일부터 2개월, §105①1호)을 넘긴 때부터 무신고가산세·납부지연가산세 대상(국세기본법 §47의2①·§47의4①) — 같은 몫은 확정신고 때 다시 붙이지 않음(§47의2⑤·§47의4⑤). 확정신고 기한까지 신고하면 감면되는지(§48②) (원문 확인 2026-11-04: 국기법 §48②3호라목)');
  if (주건.length) notes.push('주식 예정신고 기한은 양도일이 속한 반기 말일부터 2개월(§105①2호)');
  if (거래.some(function (t) { return /부담부/.test(String(t.이름 || '') + String(t.자산 || '')); })) notes.push('부담부증여의 채무 몫은 예정신고 기한이 양도일이 속한 달 말일부터 3개월(§105①3호)');
  notes.push('같은 해 양도차손은 같은 묶음(§102①) 안에서 먼저 통산(§102②, 시행령 §167의2) — 예정신고 때 통산 못 한 손실도 확정신고로 반영');
  if (의무) 할일.push({ 무엇: '양도소득 과세표준 확정신고서(별지 제84호) — 그 해 양도 ' + 거래.length + '건 합산, 예정신고 납부세액은 기납부로', 때: 기한 + '까지', 근거: '소득세법 §110①·시행령 §173' });
  if (의무 && jmYn_(p.확정신고) === false) 할일.push({ 무엇: '기한 뒤 신고(국세기본법 §45의3) — 빨리 낼수록 가산세 감면(§48②2호) (원문 확인 2026-11-04: 국기법 §48②2호 가~다목)', 때: '가능한 빨리', 근거: '국세기본법 §45의3·§48②' });
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
    reqs.push(jmReq_('대상 자산', false, 자산 + '(부동산을 취득할 수 있는 권리, §94①2호가목)은 등기하는 권리가 아님 — 미등기양도자산으로 보지 않음', '소득세법 §104③ (원문 확인 2026-11-04: 소득세법 §104③·§104①1호 괄호(분양권 60%))'));
    notes.push('분양권·입주권 전매는 등기 대상이 아니어서 미등기로 보지 않았습니다 — 분양권 세율(§104①1호 단서)은 따로 봅니다 (원문 확인 2026-11-04: 소득세법 §104①1호)');
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
  if (/상속/.test(원인)) notes.push('상속은 등기 없이도 사망일에 취득(민법 §187)하지만, 상속등기 없이 바로 양도하면 문언상 「취득 등기를 하지 아니하고 양도」에 듦 — 부득이한 사정이면 미등기로 보지 않은 판례가 있음 [판단 대기 — 판단거리3차 #18: 문언상 상속등기 없는 양도는 미등기 — 부득이한 사정 판례는 원문 없음. 권장 유지]');
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
    reqs.push(jmReq_('부득이한 사정', null, (p.사유설명 || '등기를 못 한 부득이한 사정 주장') + ' — 시행령 §168①에 없는 사유, 판례로만 다툼', '판례 [판단 대기 — 판단거리3차 #19: 열거 밖 사유는 판례로만 — 원문 없음. 권장 유지(잠정 null)]'));
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
    if (/재건축|재개발/.test(원인)) notes.push('재건축·재개발 조합원이 받은 새 건물은 종전 부동산을 이어 가는 것이라 「거주자가 신축」으로 보지 않았습니다 [확인 필요 — 권장: 조합이 지어 조합원이 받은 건물은 거주자 본인 신축이 아님이 문언 — 예규 원문 없음. 권장 유지]');
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
    if (오년 && 양도일 >= famAddD_(오년, -31)) notes.push('5년 되는 날(' + 오년 + ')에 바짝 붙은 양도입니다 — 기산일(사용승인일·사실상 사용일)이 하루만 달라도 갈립니다. 「5년 이내」의 끝 날 셈은 [확인 필요 — 권장: 기산일은 법문, 끝날 셈은 민법 기간 계산(원문 없음) — 5년 되는 날까지 포함이 보수. 권장 유지]');
  }
  // 4. 취득가액을 감정가액·환산취득가액으로 했나
  if (!방법) { reqs.push(jmReq_('감정·환산가액 사용', null, '건물 취득가액을 무엇으로 했는지(실가·환산·감정) 모름', 근거)); }
  else if (!/환산|감정/.test(방법)) {
    reqs.push(jmReq_('감정·환산가액 사용', false, '건물 취득가액을 ' + 방법 + (/실가|실지/.test(방법) ? '(실지거래가액 — 공사비)' : '') + '로 함 — 감정가액·환산취득가액이 아니면 가산세 없음', 근거));
    if (/매매사례|기준시가/.test(방법)) notes.push('§114의2는 감정가액·환산취득가액만 적습니다. 매매사례가액·기준시가로 정한 경우는 문언상 빠집니다 (원문 확인 2026-11-04: 소득세법 §114의2①)');
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
  notes.push('산출세액이 없어도(1세대1주택 비과세·감면으로 0이어도) 붙습니다(§114의2②) — 비과세 주택에도 붙는지 예규 (원문 확인 2026-11-04: 소득세법 §114의2②)');
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
    reqs.push(jmReq_('인수 추정을 깨는 증빙(배우자·직계존비속)', 입증됨, 입증됨 === false ? '증빙이 없으면 인수 안 한 것으로 추정 — 채무를 빼지 않고 전체에 증여세, 양도로 보는 부분도 없음' : 입증됨 == null ? '금융회사·국가·지자체 채무 확인서, 그 밖은 채무부담계약서·채권자확인서·담보·이자 지급 증빙' : (/임대차/.test(입증) ? '임대차계약서 — 확정일자·보증금 받은 통장 내역을 함께 (원문 확인 2026-11-04: 상증법 §47③ 단서·상증령 §36②→§10①)' : 입증), '상증법 §47③·상증령 §36②·§10①1·2호'));
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
  if (인정 !== false && 가까움) notes.push('양도로 보는 부분의 양도소득세는 증여자가 냅니다. 1세대1주택 비과세·장기보유특별공제·중과는 증여자 기준으로 그 부분에 그대로 적용합니다' + (jmYn_(p.증여자1세대1주택) === true ? ' — 증여자 1세대1주택이면 그 부분은 비과세(12억 넘는 고가주택은 넘는 몫만 과세 — 고가 판정을 양도로 보는 부분의 가액이 아니라 주택 전체 가액으로 하는지 [확인 필요 — 권장: 양도로 보는 부분은 증여자의 양도 — 비과세·장특은 증여자 요건으로 보는 것이 구조상 자연(명문은 없음). 권장 유지])' : ''));
  if (jmYn_(p.증여자1세대1주택) == null && /주택/.test(String(p.재산종류 || '')) && 인정 !== false) 할일.push({ 무엇: '증여자 세대가 1세대1주택인지(묶음 「세대판정」·1세대1주택 판정) — 양도로 보는 부분 비과세 여부가 갈림', 때: '계산 전', 근거: '소득세법 §89①3호' });
  if (기한) notes.push(인정 === false ? '신고: 증여세는 수증자가 ' + 기한 + '까지(증여일이 속한 달 말일부터 3개월, 상증법 §68①) — 양도로 보는 부분이 없어 증여자 양도세 신고는 없음' : '신고: 증여세는 수증자, 양도로 보는 부분의 양도세는 증여자 — 둘 다 ' + 기한 + '까지(증여일이 속한 달 말일부터 3개월, 상증법 §68①·소득세법 §105①3호)');
  const 상환 = jmYn_(p.상환능력);
  if (인정 !== false && 상환 !== true) {
    notes.push('수증자가 인수한 채무의 이자·원금을 증여자가 대신 갚으면 그때 다시 증여입니다(상증법 §4①·§36). 수증자 소득으로 갚을 수 없으면 인수 자체를 부인당할 수 있습니다 [확인 필요 — 권장: 법문은 ’객관적으로 인정되는’ 채무 — 상환 능력은 사후관리·사실관계(판례 원문 없음). 권장 유지]');
    할일.push({ 무엇: '수증자 소득·재산으로 이자·원금을 갚는지 확인하고 상환 자금 기록을 남김 — 국세청이 인수 채무를 계속 살핌(부채 사후관리 [실사건 때 확인: 근거 규정])', 때: '신고 뒤 해마다', 근거: '상증법 §4①·§45' });
  }
  if (/임대보증금/.test(종류) && 인정 !== false) notes.push('임대보증금은 수증자가 새 임대인으로 돌려줄 의무를 이어받아야 합니다 — 임차인에게 임대인 바뀜을 알리고 계약을 승계했는지 확인');
  const 발생 = jmYmd_(p.채무발생일);
  if (발생 && 증여일 && 발생 <= 증여일 && famAddY_(발생, 1) > 증여일 && 인정 !== false) notes.push('증여 1년 안에 생긴 채무(' + 발생 + ')입니다 — 증여세를 줄이려고 일부러 만든 채무인지 살필 수 있습니다. 대출금이 어디에 쓰였는지 증빙을 남기십시오 [실사건 때 확인]');
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
//     그 단서는 "§89①3호를 적용할 때"만 적혀 있어 표2까지 주는지는 [확인 필요 — 권장: 단서는 비과세(§89①3호) 적용에만 거주자 취급 — 표2(§95② 거주자 1세대1주택 장특)까지 주는 명문 없음 → 해석①(표1만) 보수. 권장: 표1 기본, 표2는 대안] — 엔진칸 두 경우로 나란히.
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
    // §156⑮·소득령 §207⑦ — 미리 납부·비과세·과세미달 확인서를 매수 법인에 내면 원천징수 없음(일부만 냈을 때 빼고 떼는지는 법에 없어 [확인 필요 — 권장: 법문은 전부/비과세 확인서만 — 일부 납부 시 차감 규정 없음. 권장: 확인서 없으면 전액 원천징수 뒤 §116②4호로 정산(코드 안내)]).
    const 확인서 = jmYn_(p.확인서제출);
    const 면제 = 확인서 === true && (먼저 > 0 || 예외 === true);
    원천 = 면제 ? 0 : 기본;
    if (잔금일) { const y = +잔금일.slice(0, 4), m = +잔금일.slice(5, 7); 원천기한 = new Date(Date.UTC(y, m, 10)).toISOString().slice(0, 10); }
    notes.push('매수인이 법인이라 잔금을 줄 때 원천징수합니다 — ' + (b != null ? '양도가액 10% ' + famWon_(a) + '와 양도차익 20% ' + famWon_(b) + ' 중 적은 ' + famWon_(기본) : '취득가액·양도비용이 확인되지 않아 양도가액 10% ' + famWon_(a)) + (면제 ? ' — 그러나 ' + (먼저 > 0 ? '미리 신고·납부(' + famWon_(먼저) + ')' : '비과세') + ' 확인서를 매수 법인에 내 원천징수 0(§156⑮·소득령 §207⑦)' : 먼저 > 0 ? ' — 미리 ' + famWon_(먼저) + '을 냈어도 세무서 확인서를 매수 법인에 내지 않으면 원천징수는 그대로(§156⑮·소득령 §207⑦)' : '') + (원천기한 ? ' — 매수 법인이 ' + 원천기한 + '까지 납부' : '') + '(소득세법 §156①5호). 원천징수세액의 10%를 지방소득세로 함께 뗍니다(지방세 — 범위 밖, 참고)');
    if (확인 !== true) 할일.push({ 무엇: '매수 법인에 취득 계약서·양도비용 증빙을 미리 줌 — 확인되면 양도가액 10%가 아니라 양도차익 20%와 견준 적은 금액만 뗌', 때: '잔금 전', 근거: '소득세법 §156①5호 단서' });
    if (!면제) 할일.push({ 무엇: (예외 === true ? '비과세' : '미리 예정신고·납부') + ' 확인 신청서(양도소득세 신고납부(비과세·과세미달) 확인 신청서 + 등기부등본·매매계약서)를 납세지 세무서에 내 확인을 받고 그 확인서를 매수 법인에 줌 — 그러면 원천징수를 하지 않아 큰 금액이 묶이지 않음', 때: '잔금 전', 근거: '소득세법 §156⑮·소득령 §207⑦' });
    if (먼저 > 0 && !면제) notes.push('미리 낸 세액과 원천징수가 겹치면 확정신고·경정으로 돌려받습니다(§116②4호로 기납부세액에 들어감) — 일부만 미리 낸 경우 그만큼 빼고 떼는지는 법에 없음 [확인 필요 — 권장: 같음]');
  } else if (비거주 !== false && 법인 === false) notes.push('매수인이 개인이라 원천징수는 없습니다(소득세법 §156① 괄호) — 양도인이 스스로 예정신고·납부');
  else if (비거주 !== false && 법인 == null) 할일.push({ 무엇: '매수인이 법인인지 개인인지 — 법인이면 잔금 때 원천징수', 때: '계약 때', 근거: '소득세법 §156①5호' });
  // 4. 신고·확인서·납세관리인
  let 신고기한 = null;
  if (양도일) { const y = +양도일.slice(0, 4), m = +양도일.slice(5, 7); 신고기한 = new Date(Date.UTC(y, m + 2, 0)).toISOString().slice(0, 10); }
  if (비거주 !== false) {
    notes.push('예정신고는 양도인이 ' + (신고기한 || '양도일이 속한 달 말일부터 2개월') + '까지 합니다(소득세법 §105①1호·§121②) — 원천징수당한 세액은 낸 세금으로 칩니다(§116②4호)' + (원천 ? '. 산출세액보다 원천징수가 많으면 신고로 돌려받습니다 (원문 확인 2026-11-04: 소득세법 §105①1호·§121②·§116②4호)' : ''));
    if (/재외국민|외국인/.test(신분)) 할일.push({ 무엇: '부동산등양도신고확인서를 세무서에서 받아 등기 신청 때 냄(또는 세무서 매도용 인감증명 발급 확인) — 없으면 등기가 안 됨', 때: '잔금·등기 전', 근거: '소득세법 §108·소득령 §171' });
    else if (!신분) 할일.push({ 무엇: '양도인이 재외국민·외국인이면 부동산등양도신고확인서가 필요 — 국적·재외국민 등록 확인', 때: '잔금 전', 근거: '소득세법 §108' });
    if (jmYn_(p.납세관리인) !== true) 할일.push({ 무엇: '국내에 주소·거소가 없으면 납세관리인을 정해 세무서에 신고(고지서·환급 받을 사람)', 때: '신고 전', 근거: '국세기본법 §82' });
    notes.push('부동산 양도소득은 조세조약에서도 부동산이 있는 나라(한국)가 과세하는 것이 보통입니다 — 거주지국에서 외국납부세액공제를 받을 수 있게 납부 증빙을 챙기십시오 [실사건 때 확인: 해당 조세조약]');
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
      경우.push({ 이름: '② 출국 2년 예외가 맞으면 — 비과세는 받고 장특은 표1(표2 [확인 필요 — 권장: 같음])', 엔진: 'calculate_transfer_tax', 엔진칸: ex });
      if (비거주 == null) 경우.push({ 이름: '③ 거주자로 판정되면 — 1세대1주택 비과세·표2', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, nr, { isTransferorResident: true }) });
    } else if (예외 === true && 일주택 !== false) nr.isNonResidentTwoYearException = true, nr.departureDate = 출국일 || undefined;
    if (경우.length) { /* 위에서 냄 */ } else if (nr.isNonResidentTwoYearException) {
      경우.push({ 이름: '① 문언대로 — 비과세는 받고 장특은 표1(표2 배제, §121② 단서·소득령 §180의2①)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, nr, { nonResidentTable2Excluded: true }) });
      경우.push({ 이름: '② 표2까지 주는 해석 [확인 필요 — 권장: 같음]', 엔진: 'calculate_transfer_tax', 엔진칸: nr });
    } else {
      경우.push({ 이름: '① 법대로 — 비거주자(비과세·표2 없음)', 엔진: 'calculate_transfer_tax', 엔진칸: nr });
      if (일주택 === true) 경우.push({ 이름: 비거주 == null ? '② 거주자로 판정되면 — 1세대1주택 비과세·표2' : '② 잘못 — 거주자처럼 1세대1주택 비과세·표2', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, nr, { isTransferorResident: true }) });
    }
  }
  const w = jmWrap_('비거주자양도', reqs, { 비거주자: 비거주, 비과세예외: 예외, 양도차익: 차익, 원천징수: 원천, 원천징수기한: 원천기한, 예정신고기한: 신고기한, 경우: 경우, 알림: notes, 할일: 할일 });
  w.결론 = 비거주 === false ? '거주자 — 대상 아님' : 예외 === true ? '비과세 예외(표2 [확인 필요 — 권장: 같음])' : 예외 == null && /주택/.test(자산) ? '비과세 예외 잠정' : '비과세·표2 없음';
  w.표시 = '비거주자 양도 — ' + w.결론 + (원천 != null ? ' · 매수 법인 원천징수 ' + famWon_(원천) : '') + (신고기한 ? ' · 예정신고 ' + 신고기한 : '');
  return w;
}
// [2026.11.03 복잡사건 93 「백씨 가족법인 거래」] 개인 ↔ 법인 부동산 거래 — 시가와 다른 값(소득세법 §96③·§101①, 소득령 §163⑩·§167③, 상증법 §4의2③④·§35·§45의5)
//  ① 개인이 특수관계법인에 팔고 법인세법 §67로 그 개인의 상여·배당 등으로 처분된 금액이 있으면 양도가액은 법인세법 §52 시가(§96③1호).
//  ② 특수관계법인 외의 자에게 시가보다 비싸게 팔면 양도가액 = 대가 − 상증법 §35 증여재산가액(가목) 또는 배당 등 처분 금액(나목)(§96③2호).
//  ③ 개인이 특수관계인(법인 포함)에게 싸게 팔면 §101① 부당행위 — 차액 3억 이상 또는 시가 5% 이상(소득령 §167③)이면 시가로 다시 셈.
//  ④ 개인이 특수관계 법인에게서 사며 상여·배당 등 처분된 금액이 있으면 나중에 팔 때 취득가액에 그 금액을 더함(소득령 §163⑩2호). §35 증여세를 받았으면 그 증여재산가액(1호).
//  ⑤ 증여세: 받은 이익에 소득세·법인세가 부과되면 증여세 없음(상증법 §4의2③). 영리법인이 받은 이익은 법인세 — 그 주주에게는 §45의3~5(특정법인 등)만(§4의2④).
//  [실사건 때 확인 — 법인세법 원문을 이 컴퓨터에 두지 못함] 법인 쪽 부당행위(법인세법 §52·령 §88①·③ 3억/5%)·소득처분(§67·령 §106 대표 상여 등)은 사람이 판정해 「처분」 칸으로 받는다.
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
  if (!(대가 > 0 && 시가 > 0)) reqs.push(jmReq_('대가와 시가', null, '실제 주고받은 값과 시가(감정·매매사례 등)를 넣어야 차이를 봄', '법인세법 §52 [실사건 때 확인]·상증법 §60'));
  const 차액 = 대가 > 0 && 시가 > 0 ? 대가 - 시가 : null, 고가 = 차액 != null && 차액 > 0, 저가 = 차액 != null && 차액 < 0, ad = 차액 == null ? 0 : Math.abs(차액);
  const 오퍼 = 시가 > 0 && (ad >= 300000000 || ad >= 시가 * 0.05);
  const 기준 = 차액 == null ? '' : '차액 ' + famWon_(ad) + (오퍼 ? ' ≥ 3억 또는 시가 5%(' + famWon_(Math.round(시가 * 0.05)) + ')' : ' < 3억·시가 5%(' + famWon_(Math.round(시가 * 0.05)) + ')');
  reqs.push(jmReq_('특수관계(법인세법 §2 12호)', 특수, 특수 === true ? '대표·주주·그 친족 등 — 부당행위계산 대상' : 특수 === false ? '특수관계 아님 — 부당행위 없음, 고가면 상증법 §35② 30% 기준' : '법인 주주명부·임원 명부·가족관계로 확인', '법인세법 §2 12호·소득세법 §96③ [실사건 때 확인: 법인세법 시행령 §2⑤ 범위]'));
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
    notes.push('법인 쪽: 특수관계인과 시가와 다른 값으로 거래해 법인 소득을 줄였으면 부당행위계산으로 시가 차액을 익금·손금불산입하고 그 금액을 받은 사람에게 상여·배당 등으로 처분합니다 — 법인세법 §52·§67, 기준 ' + 기준 + ' [실사건 때 확인: 법인세법 시행령 §88③ 3억·5% 기준과 §106 처분 종류, 원문 미대조]');
    if (처분 == null) 할일.push({ 무엇: '법인 세무조정에서 부당행위계산·소득처분(상여·배당 등)을 하는지 법인 담당 세무사·결산서로 확인 — 처분 여부로 개인 양도가액·취득가액·증여세가 갈림', 때: '법인 결산(법인세 신고) 전', 근거: '법인세법 §52·§67 [실사건 때 확인]' });
  }
  if (법인매수 === true) {
    // 개인이 법인에 팖
    if (고가 && 특수 === true) {
      if (처분됨 === true) { 양도가액 = 시가; 양도근거 = '소득세법 §96③1호 — 특수관계법인에 팔고 상여·배당 등 처분 금액이 있어 양도가액은 법인세법 §52 시가 ' + famWon_(시가) + '(대가 ' + famWon_(대가) + ' 아님)'; }
      else if (처분됨 === false) { 양도가액 = 대가; 양도근거 = '처분 금액 없음 — §96③1호가 걸리지 않아 대가 ' + famWon_(대가) + '(법인 쪽 부당행위 기준 아래거나 정당한 사유)'; }
      증여세 = 0; 증여근거 = 처분됨 === false ? '처분이 없는 것은 법인 쪽 부당행위 기준(3억·5%) 아래이거나 정당한 사유가 있는 때 — 차액이 3억·시가 5% 아래면 상증법 §35①(시가 30%·3억 중 적은 금액) 기준에도 못 미쳐 증여 없음 [확인 필요 — 권장: 법인 쪽 부당행위 기준(3억·5%) 아래라 §52①이 안 걸리면 §35①도 안 걸림 — 법문(§35③)으로 뒷받침. 다만 ’정당한 사유’로 안 걸린 경우는 §35③ 문언(’시가에 해당하여’)과 다를 수 있음]' : '비싸게 받은 차액은 상여·배당 등 소득으로 소득세 과세 — 증여세 없음(상증법 §4의2③)';
      if (처분됨 !== false) notes.push('차액 ' + famWon_(ad) + '은 ' + (처분종류 || '상여(대표·임원)·배당(주주)') + '로 처분되어 매도인 종합소득세(근로·배당 소득)로 과세됩니다 — 종합소득세 계산 도구는 없음, 법인 원천징수·연말정산 확인 [실사건 때 확인]');
    } else if (고가 && 특수 === false) {
      const gate = 시가 * 0.3, 증여액 = ad >= gate && 정당 !== true ? Math.max(0, ad - 300000000) : 0;
      증여세 = 증여액; 증여근거 = '특수관계 아닌 법인에 비싸게 팖 — 상증법 §35②: 차액 ' + famWon_(ad) + (ad >= gate ? ' ≥ 시가 30%(' + famWon_(Math.round(gate)) + ')' : ' < 시가 30%(' + famWon_(Math.round(gate)) + ')') + (정당 === true ? ', 정당한 사유 있음 — 증여 아님' : '') + ' → 증여재산가액 ' + famWon_(증여액) + '(차액 − 3억)';
      양도가액 = 대가 - 증여액; 양도근거 = '소득세법 §96③2호가 — 대가 ' + famWon_(대가) + ' − §35 증여재산가액 ' + famWon_(증여액) + ' = ' + famWon_(대가 - 증여액) + (증여액 ? '' : '(증여재산가액 0이라 대가 그대로)');
      if (정당 == null && ad >= gate) 할일.push({ 무엇: '「거래의 관행상 정당한 사유」가 있는지(경매·공매·시장 사정 등) — 없으면 §35② 증여', 때: '신고 전', 근거: '상증법 §35②' });
      notes.push('법인이 배당 등으로 처분한 금액이 있으면 §96③2호나목으로 그 금액을 뺍니다 [확인 필요 — 권장: 시행령 조문 못 찾음 — 처분된 금액 전액으로 잠정]');
    } else if (저가) {
      const 시가재계산 = 특수 === true && 오퍼;
      양도가액 = 시가재계산 ? 시가 : (특수 == null && 오퍼 ? null : 대가);
      양도근거 = 시가재계산 ? '소득세법 §101①·소득령 §167③ — 특수관계 법인에 싸게 팔아 ' + 기준 + ': 양도가액을 시가 ' + famWon_(시가) + '로 다시 셈' : 특수 === true ? '부당행위 기준 아래(' + 기준 + ') — 대가 그대로' : 특수 === false ? '특수관계 아님 — 대가 그대로' : '특수관계면 시가(' + famWon_(시가) + '), 아니면 대가 — 잠정';
      증여세 = 0; 증여근거 = '싸게 산 법인은 영리법인 — 받은 이익에 법인세가 붙어 증여세 없음(상증법 §4의2③). 주주에게는 §45의5(특정법인)만 볼 것(§4의2④)';
      if (지분 >= 30) notes.push('매도인 가족이 법인 지분 ' + 지분 + '% — 특정법인(상증법 §45의5)에 싸게 판 것이라 주주(매도인 본인 제외 가족)에게 증여의제가 될 수 있음: 계산기 「특정법인 증여의제」로(주주별 이익 1억 이상만) [확인 필요 — 권장: 법 조문은 확인, 주주별 1억 기준은 시행령 발췌 못 봄 — 계산기로 넘기는 안내 유지]');
      else if (!(지분 > 0)) 할일.push({ 무엇: '법인 주주 구성(매도인 가족 지분 합) 확인 — 30% 이상이면 특정법인 증여의제(상증법 §45의5) 검토', 때: '계약 전', 근거: '상증법 §45의5' });
      notes.push('법인이 개인에게서 싸게 산 부동산은 법인 취득가액이 대가 그대로인 것이 보통이나(저가매입은 부당행위 아님), 유가증권은 다름 — 부동산 법인 처리 [실사건 때 확인: 법인세법 §15②1호·§52]');
    }
  } else if (법인매수 === false) {
    // 개인이 법인에서 삼
    if (저가 && 특수 === true) {
      if (처분됨 === true) { 나중취득 = 대가 + (처분금액 || ad); 나중근거 = '소득령 §163⑩2호 — 특수관계 법인에서 사며 상여·배당 등으로 처분된 금액 ' + famWon_(처분금액 || ad) + '을 나중에 팔 때 취득가액에 더함: ' + famWon_(대가) + ' + ' + famWon_(처분금액 || ad) + ' = ' + famWon_(대가 + (처분금액 || ad)); 증여세 = 0; 증여근거 = '싸게 받은 이익은 상여·배당 등 소득으로 소득세 — 증여세 없음(상증법 §4의2③)'; }
      else if (처분됨 === false) {
        const gate = Math.min(시가 * 0.3, 300000000), 증여액 = ad >= gate && 정당 !== true ? Math.max(0, ad - gate) : 0;
        증여세 = 증여액; 증여근거 = '처분이 없으면 상증법 §35①(특수관계 저가양수): 차액 ' + famWon_(ad) + ', 기준 min(시가 30%, 3억) ' + famWon_(Math.round(gate)) + ' → 증여재산가액 ' + famWon_(증여액) + ' (원문 확인 2026-11-04: 상증령 §2의2①6·7호)';
        나중취득 = 대가 + 증여액; 나중근거 = 증여액 ? '소득령 §163⑩1호 — 증여세 과세받은 증여재산가액을 더함: ' + famWon_(대가) + ' + ' + famWon_(증여액) : '대가 그대로';
      }
      if (처분됨 == null) { 나중근거 = '처분 여부 잠정 — ① 상여·배당 처분되면 취득가액 ' + famWon_(대가 + ad) + '(소득령 §163⑩2호) ② 처분이 없으면 낸 값 ' + famWon_(대가) + '(차액이 3억·5% 아래면 §35① 30%·3억 기준에도 못 미침)'; }
      notes.push('처분된 금액(' + famWon_(처분금액 || ad) + ')은 ' + (처분종류 || '대표·임원이면 상여, 주주면 배당') + ' — 산 사람 종합소득세 과세 [실사건 때 확인: 처분 종류는 법인세법 시행령 §106]');
    } else if (고가 && 특수 === true) {
      나중근거 = '특수관계 법인에서 비싸게 산 경우 — 법인은 이익이 늘어 부당행위가 아님. 산 개인이 나중에 팔 때 취득가액은 낸 값 ' + famWon_(대가) + '인지 시가 ' + famWon_(시가) + '인지 [확인 필요 — 권장: 비싸게 산 경우 법인은 부당행위 없음(이익) → 처분 없음 → 낸 값 그대로가 문언(§163⑩2호는 처분 있을 때만 더함). 다만 개인 쪽 §101 부당행위면 §163①1호 괄호로 시가초과액 제외. 권장: 낸 값(…]';
      나중취득 = null;
      if (지분 >= 30) notes.push('산 개인의 가족이 법인 지분 ' + 지분 + '% — 특정법인에 비싸게 사 준 것이라 다른 주주에게 증여의제(상증법 §45의5) 검토 [확인 필요 — 권장: 같음]');
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
  if (법인매수 != null && 차액 && 특수 !== false) 할일.push({ 무엇: '시가 근거(감정평가서 2곳·매매사례) 확보 — 법인세법 §52 시가와 상증법 시가가 같은 값인지', 때: '계약 전', 근거: '법인세법 §52 [실사건 때 확인]·상증법 §60' });
  const w = jmWrap_('법인거래', reqs, { 방향: 법인매수 === true ? '개인→법인' : 법인매수 === false ? '법인→개인' : null, 차액: 차액, 부당행위기준: 오퍼, 처분: 처분됨, 처분금액: 처분액 || null, 양도가액: 양도가액, 양도가액근거: 양도근거, 나중취득가액: 나중취득, 나중취득가액근거: 나중근거, 증여재산가액: 증여세, 증여근거: 증여근거, 경우: 경우, 알림: notes, 할일: 할일 });
  w.결론 = 법인매수 === true ? (양도가액 != null ? '양도가액 ' + famWon_(양도가액) : '양도가액 잠정(두 경우)') : 법인매수 === false ? (나중취득 != null ? '나중 취득가액 ' + famWon_(나중취득) : '나중 취득가액 [확인 필요 — 권장: 같음]') : '거래 방향 모름';
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
    if (cut) notes.push(label + ' — 사업소득·총급여 3,700만원 이상인 해 ' + cut + '개를 영농 안 한 해로 뺐습니다(시행령 §16⑭, 2026.2.27 신설). 신설 전 과세기간에도 적용되는지는 부칙을 대조하지 못했습니다 [확인 필요 — 권장: 부칙 없음 — 권장: 시행 뒤 상속개시분부터 적용, 그 전은 종전대로(보수)].');
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
  if (후계 === true) notes.push('상속인이 영농·영어·임업후계자(재정경제부령)이면 아래 2년 영농·거주 요건 대신 그 지정으로 적용합니다(시행령 §16③ 본문) — 18세 요건은 문언상 「18세 이상으로서 … 경우 또는 후계자인 경우」라 후계자에게도 붙는지 [확인 필요 — 권장: 문언상 「18세 이상으로서」는 각 호 경우만 꾸미고 후계자 경우는 따로 읽혀 안 붙는 쪽이 가까우나, 보수적으로 18세 요건을 함께 확인].');
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
// [2026.11.03 복잡사건 95 「심씨 그린벨트 땅」] 개발제한구역 매수·해제 뒤 수용 감면 — 조특법 §77의3·시행령 §74·시행규칙 §30
//  엔진은 감면 종류(restricted_zone_40·25)만 고르면 40%·25%를 깎았다 — 매수청구·협의매수인지, 지정일 전 취득·20년 전 취득인지,
//  취득부터 기준일까지 계속 거주했는지(상속은 피상속인 취득일·거주 합침, 부득이 사유는 고교 이상 취학·징집·1년 이상 요양만),
//  해제 뒤 수용은 해제일부터 1년(경제자유구역 등 먼저 지정이면 5년) 안 사업인정고시인지를 보는 곳이 없었다.
//  p: { 방식(매수청구|협의매수|해제후협의|해제후수용|일반매매), 지정일, 해제일, 사업인정고시일, 먼저지정(경제자유구역|택지개발지구|산업단지|기업도시 — 해제 전 지정이면), 먼저지정일,
//       매수청구일, 협의매수일, 양도일, 취득일, 취득원인(매매|상속|증여), 피상속인취득일, 거주:[{시작,끝,지역(같은시군구|연접|30km안|밖)}], 부득이:[{시작,끝,사유}],
//       양도가액, 취득가액, 필요경비, 자경8년(예), 직접경작(예 — 수용 §77 농특세), 채권(예) }
function judgeGbPurchase_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 방식 = String(p.방식 || '');
  const 해제후 = /해제/.test(방식), 수용 = /수용/.test(방식);
  const 안매수 = !해제후 && /매수청구|협의매수/.test(방식);
  const 양도일 = jmYmd_(p.양도일), 지정 = jmYmd_(p.지정일), 해제 = jmYmd_(p.해제일), 고시 = jmYmd_(p.사업인정고시일);
  // 1) 넘긴 길
  let 길ok = null, 길왜 = '';
  if (안매수) { 길ok = true; 길왜 = '개발제한구역 안 토지를 ' + (/청구/.test(방식) ? '토지매수 청구(개발제한구역법 §17)' : '협의매수(개발제한구역법 §20)') + '로 넘김 → §77의3①'; }
  else if (해제후) {
    if (!해제 || !고시) { 길왜 = '해제일·사업인정고시일을 몰라 단서(1년·5년)를 못 봄'; 할일.push({ 무엇: '개발제한구역 해제 고시문(해제일)·사업인정고시문(또는 고시로 보는 실시계획 승인 고시)', 때: '신고 전', 근거: '조특법 §77의3② 단서' }); }
    else {
      const 먼저 = jmYmd_(p.먼저지정일), 먼저됨 = !!(p.먼저지정 && 먼저 && 먼저 <= 해제);
      const 끝 = famAddY_(해제, 먼저됨 ? 5 : 1);
      길ok = 고시 <= 끝;
      길왜 = '해제 ' + 해제 + ' → 사업인정고시 ' + 고시 + (길ok ? ' — ' : ' — 기한 ' + 끝 + '을 넘김, ') + (먼저됨 ? '해제 전에 ' + p.먼저지정 + '로 지정(' + 먼저 + ')돼 5년 안' : '1년 안') + (길ok ? '이라 §77의3②' : '이 아니라 감면 없음');
      if (!먼저됨 && !길ok) notes.push('해제 전에 경제자유구역·택지개발지구·산업단지·기업도시개발구역 등으로 먼저 지정됐으면 5년까지 봄(시행령 §74②) — 지정 고시를 확인할 것');
    }
  } else { 길ok = false; 길왜 = (방식 || '넘긴 길 모름') + ' — 개발제한구역법상 매수청구·협의매수나 해제 뒤 공익사업 협의매수·수용이 아니어서 §77의3 대상 아님'; }
  reqs.push(jmReq_('넘긴 길', 길ok, 길왜, 해제후 ? '조특법 §77의3② 단서·시행령 §74②' : '조특법 §77의3①'));
  // 2) 기준일 — ①은 매수청구일·협의매수일, ②는 사업인정고시일
  const 기준 = 해제후 ? 고시 : jmYmd_(/청구/.test(방식) ? p.매수청구일 : p.협의매수일) || jmYmd_(p.매수청구일) || jmYmd_(p.협의매수일);
  if (!기준 && 길ok !== false) 할일.push({ 무엇: 해제후 ? '사업인정고시일' : '토지매수 청구서 접수일(매수청구) 또는 협의매수 계약일', 때: '신고 전', 근거: '조특법 §77의3①②' });
  // 3) 기한
  const 기한ok = 양도일 ? 양도일 <= '2028-12-31' : null;
  reqs.push(jmReq_('2028.12.31.까지 양도', 기한ok, 양도일 ? 양도일 : '양도일 모름', '조특법 §77의3①②'));
  // 4) 취득일 — 상속은 피상속인 취득일(§77의3③)
  const 상속 = /상속/.test(String(p.취득원인 || '')), 증여 = /증여/.test(String(p.취득원인 || ''));
  const 취 = jmYmd_(p.취득일), 피취 = jmYmd_(p.피상속인취득일);
  const 감면취득 = 상속 ? 피취 : 취;
  if (상속 && !피취) 할일.push({ 무엇: '피상속인이 그 토지를 취득한 날(옛 등기부·토지대장)', 때: '신고 전', 근거: '조특법 §77의3③' });
  if (증여) notes.push('증여받은 토지는 증여받은 날이 취득일 — 상속처럼 앞사람 취득일을 쓰는 규정(§77의3③)이 없음. 증여자 거주 기간도 합치지 않음(시행령 §74④은 피상속인만)');
  let 율 = 0, 율왜 = '';
  if (감면취득 && 기준) {
    const 이십 = famAddY_(기준, -20);
    if (지정 && 감면취득 <= 지정) { 율 = 40; 율왜 = (상속 ? '피상속인 ' : '') + '취득 ' + 감면취득 + ' — 지정일(' + 지정 + ') 이전'; }
    else if (감면취득 <= 이십) { 율 = 25; 율왜 = (상속 ? '피상속인 ' : '') + '취득 ' + 감면취득 + ' — ' + (해제후 ? '사업인정고시일' : '매수청구·협의매수일') + '(' + 기준 + ')부터 20년 이전(' + 이십 + ' 이전)' + (지정 ? '' : ' — 지정일을 몰라 40%는 못 봄'); }
    else { 율왜 = '취득 ' + 감면취득 + ' — 지정일(' + (지정 || '모름') + ') 뒤이고 ' + 기준 + '부터 20년 이전(' + 이십 + ')도 아님'; }
    if (!지정 && 율 !== 40) 할일.push({ 무엇: '개발제한구역 지정 고시일(토지이용계획확인서·지정 고시문)', 때: '신고 전', 근거: '조특법 §77의3①1호' });
  } else 율왜 = '취득일·기준일을 몰라 못 가림';
  reqs.push(jmReq_('취득 시기(40%·25%)', 율 ? true : (감면취득 && 기준 ? false : null), 율왜 + (율 ? ' → ' + 율 + '%' : ''), '조특법 §77의3①②' + (율 === 40 ? '1호' : 율 === 25 ? '2호' : '') + (상속 ? '·③' : '')));
  // 5) 거주 — 취득일부터 기준일까지 계속, 그 지역 안
  const 지역ok = function (v) { const s = String(v || ''); return /같은|연접|30/.test(s) && !/밖|아님/.test(s); };
  let 거주ok = null, 거주왜 = '';
  const 거 = [].concat(p.거주 || []);
  if (감면취득 && 기준 && 거.length) {
    let list = jmMerge_(거.filter(function (x) { return 지역ok(x.지역) && jmYmd_(x.시작); }).map(function (x) { return { s: jmYmd_(x.시작), e: jmYmd_(x.끝) || 기준 }; }));
    let 인정 = 0; const 안된 = [];
    [].concat(p.부득이 || []).forEach(function (x) {
      const a = jmYmd_(x.시작), b = jmYmd_(x.끝); if (!a || !b) return;
      const s = String(x.사유 || '');
      if (/고등|대학|취학|징집|병역|입대|요양|치료|질병/.test(s) && !/중학|초등|유치/.test(s)) { list = jmMerge_(list.concat([{ s: a, e: b }])); 인정 += jmDays_(a, b) + 1; }
      else 안된.push(s || '사유 없음');
    });
    const 창 = jmMerge_(list.map(function (x) { return { s: x.s < 감면취득 ? 감면취득 : x.s, e: x.e > 기준 ? 기준 : x.e }; }).filter(function (x) { return x.s <= x.e; }));
    const 빈 = jmDays_(감면취득, 기준) + 1 - jmLen_(창);
    거주ok = 빈 <= 1;
    const 첫빈 = 거주ok ? '' : (function () { let c = 감면취득; for (let i = 0; i < 창.length; i++) { if (창[i].s > c) return c + '~' + famAddD_(창[i].s, -1); c = famAddD_(창[i].e, 1); } return c + '~' + 기준; })();
    거주왜 = (상속 ? '피상속인·상속인 거주 합쳐 ' : '') + 감면취득 + '~' + 기준 + (거주ok ? ' 계속 거주' + (인정 ? '(부득이 사유 ' + Math.round(인정) + '일 거주로 봄)' : '') : ' 중 ' + Math.round(빈) + '일 끊김(' + 첫빈 + ')') + (안된.length ? ' — 「' + 안된.join('·') + '」는 부득이 사유 아님(고교 이상 취학·징집·1년 이상 요양만, 시행규칙 §30)' : '');
  } else { 거주왜 = '거주 이력(주민등록 초본)을 몰라 못 봄'; 할일.push({ 무엇: '주민등록 초본(취득일부터 ' + (해제후 ? '사업인정고시일' : '매수청구·협의매수일') + '까지 주소 이력)' + (상속 ? '·피상속인 제적 초본' : '') + ' — 토지 소재 시·군·구, 연접 시·군·구 또는 30km 안이었는지', 때: '신고 전', 근거: '시행령 §74①④' }); }
  reqs.push(jmReq_('취득부터 계속 거주', 거주ok, 거주왜, '조특법 §77의3①②·시행령 §74①④·시행규칙 §30'));
  // 결론
  const 감면 = 길ok === true && 기한ok !== false && 율 > 0 && 거주ok === true;
  const 잠정 = !감면 && 길ok !== false && 기한ok !== false && (율 > 0 || !(감면취득 && 기준)) && 거주ok == null;
  const 표 = 감면 ? '§77의3' + (해제후 ? '②' : '①') + ' ' + 율 + '% 감면' : 잠정 ? '§77의3 감면 잠정(' + (율 || '?') + '%) — 확인할 것 남음' : '§77의3 감면 없음';
  // 겹치는 감면
  const 자경 = jmYn_(p.자경8년) === true;
  if (자경) notes.push('8년 자경 감면(§69)과 겹치면 하나만(§127⑦) — 엔진이 경우마다 세액을 내니 덜 내는 쪽을 고를 것. §69는 농특세가 없고(농특세법 시행령 §4①1호), §77의3은 감면세액의 20% 농특세가 붙음');
  if (해제후 && 수용) notes.push('해제 뒤 공익사업 수용·협의매수는 §77(수용 감면, 현금 15%)과도 겹침 — 하나만(§127⑦). §77은 사업인정고시일부터 2년 이전 취득·2026.12.31. 양도까지, 직접 경작 농지면 농특세 없음');
  else if (해제후) notes.push('해제 뒤 협의매수는 §77(공익사업 수용 감면)과도 겹칠 수 있음 — 하나만(§127⑦)');
  if (감면 || 잠정) {
    notes.push('§77의3 감면세액의 20%는 농어촌특별세(농특세법 §4 비과세 목록에 §77의3 없음) · 감면 한도 과세기간 2억원·5년 3억원(§133②) — 엔진이 셈');
    할일.push({ 무엇: '세액감면신청서 + 토지매수 청구·협의매수(해제 뒤면 수용·협의매수) 사실 확인 서류', 때: '양도 과세표준 신고(예정신고 포함) 때', 근거: '시행령 §74③' });
  }
  if (!해제후) notes.push('개발제한구역법상 매수청구·협의매수가 토지보상법 협의매수·수용에 드는지에 따라 비사업용 토지 예외(시행령 §168의14③3호)가 갈림 [확인 필요 — 권장: §168의14③은 ’그 밖의 법률에 따른 협의매수’도 포함 — 개발제한구역법 협의매수가 ’그 밖의 법률’에 들면 예외. 문언상 포함이 자연(호 번호는 발췌 못 봄). 권장: 포함으로 잠정] — 「비사업용 토지」 판정에서 따로 볼 것');
  // 엔진 칸
  const 가 = n(p.양도가액), 취가 = n(p.취득가액);
  if (가 && 양도일 && 취) {
    const 바탕 = { transferPrice: 가, transferDate: 양도일, assetType: 'other', acquisitionDate: 취, acquisitionPrice: 취가, necessaryExpenses: n(p.필요경비), acquisitionCause: 상속 ? 'inheritance' : 증여 ? 'gift' : 'purchase' };
    if (상속 && 피취) { 바탕.isInheritedAsset = true; 바탕.decedentAcquisitionDate = 피취; }
    if (jmYn_(p.비사업용) === true) 바탕.isNonBusinessLand = true;
    const zt = 율 === 25 ? 'restricted_zone_25' : 'restricted_zone_40';
    if (감면 || 잠정) 경우.push({ 이름: '① 법대로 — §77의3 ' + 율 + '% 감면' + (잠정 ? '(잠정)' : ''), 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, 바탕, { compensationType: zt }) });
    else {
      경우.push({ 이름: '① 법대로 — §77의3 감면 없음', 엔진: 'calculate_transfer_tax', 엔진칸: 바탕 });
      if (길ok !== false) 경우.push({ 이름: '② 잘못 — 요건을 안 보고 ' + (율 === 25 ? '25' : '40') + '% 감면', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, 바탕, { compensationType: zt }), 잘못: true });
    }
    if (자경) 경우.push({ 이름: '③ 견줌 — 8년 자경 감면(§69)으로', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, 바탕, { isEightYearFarmland: true }) });
    if (해제후 && 수용) {
      const y2 = 취 && 고시 ? (famAddY_(고시, -2) >= (상속 && 피취 ? 피취 : 취)) : null;
      if (y2 !== false) { const c = Object.assign({}, 바탕, { compensationType: jmYn_(p.채권) === true ? 'bond' : 'cash', publicNoticeDate: 고시 }); if (jmYn_(p.직접경작) === true) c.isCompensationOnSelfCultivatedLand = true; 경우.push({ 이름: '④ 견줌 — 수용 감면(§77①, ' + (jmYn_(p.채권) === true ? '채권' : '현금') + ')으로', 엔진: 'calculate_transfer_tax', 엔진칸: c }); }
    }
  }
  return jmWrap_('개발제한구역', reqs, { 적용: true, 결론: 표, 감면: 감면, 잠정: 잠정 || undefined, 감면율: 감면 || 잠정 ? 율 : 0, 항: 해제후 ? '②' : '①', 기준일: 기준 || null, 감면취득일: 감면취득 || null, 경우: 경우, 엔진칸: 경우[0] && 경우[0].엔진칸, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 96 「엄씨 땅 쪼개 팔기」] 토지를 나눠(또는 지분으로) 해를 넘겨 같은 사람에게 팔 때 감면 한도 합산 — 조특법 §133③(법률 제19936호 부칙: 2024.1.1. 이후 양도분부터)
//  엔진에는 「같은 사람에게 2년 안 앞서 판 부분의 감면세액」 칸이 있었지만 넥스 양도 도구에 그 칸이 없었고, 어떤 앞선 양도가 합산 대상인지
//  (분할은 앞선 양도일부터 거꾸로 1년 안·지분 양도는 분할 없이·2년 안·같은 사람이나 그 배우자·2024년 이후) 가르는 도구가 없었다.
//  또 엔진은 그 금액 하나를 §133①1호(자경 등 1억)와 ②1호(수용 등 2억, 2025년 이후 양도) 두 한도에 똑같이 더했다 — 묶음별로 나눔.
//  p: { 이번: { 양도일, 산사람, 감면(자경|수용 …), 같은땅(예) },
//       앞선: [{ 양도일, 산사람, 배우자(예 — 이번 산 사람이 그 사람의 배우자), 분할일, 지분(예), 감면세액, 감면(자경|축사|대토|수용|대토보상|개발제한구역 …) }],
//       바탕: { 엔진 양도 칸(이번 자산) } }
function judgeSplitSale_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 줄 = [];
  const 이번 = p.이번 || {};
  const 이번일 = jmYmd_(이번.양도일), 이번해 = 이번일 ? 이번일.slice(0, 4) : '';
  const 새묶음 = !이번일 || 이번일 >= '2025-01-01'; // 2025.1.1. 이후 양도: ①(자경 등)과 ②(수용 등) 한도가 따로(법률 제20778호 부칙 제15조①)
  const 수용류 = function (s) { return /수용|77|대토보상|개발제한|그린벨트/.test(String(s || '')) && !/농지대토|대토감면|70/.test(String(s || '')); };
  let 합자경 = 0, 합수용 = 0, 잠정자경 = 0, 잠정수용 = 0, 같은해 = 0;
  [].concat(p.앞선 || []).forEach(function (a, i) {
    const d = jmYmd_(a.양도일), 분 = jmYmd_(a.분할일), 지분 = jmYn_(a.지분) === true, 세 = n(a.감면세액);
    const 왜 = [];
    let ok = true, 모름 = false;
    if (!d) { ok = false; 모름 = true; 왜.push('앞선 양도일 모름'); }
    if (d && d < '2024-01-01') { ok = false; 왜.push('앞선 양도 ' + d + ' — 2024.1.1. 전 양도는 합산하지 않음(법률 제19936호 부칙)'); }
    if (d && 이번일 && 이번일 <= d) { ok = false; 왜.push('이번 양도가 앞선 양도보다 늦지 않음'); }
    if (d && 이번일 && d.slice(0, 4) === 이번해) { ok = false; 같은해++; 왜.push('같은 해(' + 이번해 + ') 양도 — 원래 한 과세기간이라 이 칸이 아니라 여러 건 계산(합산)으로 넣을 것'); }
    if (d && 이번일 && 이번일 > famAddY_(d, 2)) { ok = false; 왜.push('이번 양도 ' + 이번일 + ' — 앞선 양도일부터 2년(' + famAddY_(d, 2) + ')을 넘김'); }
    if (!지분) {
      if (!분) { 모름 = true; 왜.push('분할일 모름 — 분할등기일(토지대장·등기부)을 볼 것'); }
      else if (d && (분 > d || 분 < famAddY_(d, -1))) { ok = false; 왜.push('분할 ' + 분 + ' — 앞선 양도일부터 거꾸로 1년(' + famAddY_(d, -1) + '~' + d + ') 안이 아님'); }
      else if (d) 왜.push('분할 ' + 분 + ' — 앞선 양도 전 1년 안');
    } else 왜.push('지분 양도 — 분할 요건 없음');
    const 같은사람 = 이번.산사람 && a.산사람 && String(이번.산사람).trim() === String(a.산사람).trim();
    const 배우자 = jmYn_(a.배우자) === true;
    if (같은사람) 왜.push('같은 사람(' + a.산사람 + ')에게');
    else if (배우자) 왜.push('앞서 산 ' + (a.산사람 || '사람') + '의 배우자에게');
    else if (jmYn_(a.배우자) === false || (이번.산사람 && a.산사람)) { ok = false; 왜.push('다른 사람(' + (a.산사람 || '?') + ' → ' + (이번.산사람 || '?') + ')에게 — 배우자도 아니면 합산 안 함'); }
    else { 모름 = true; 왜.push('산 사람이 같은지·배우자인지 모름'); }
    const 수 = 수용류(a.감면);
    const 들어감 = ok && !모름, 잠 = ok && 모름;
    if (들어감) { if (수) 합수용 += 세; else 합자경 += 세; }
    if (잠) { if (수) 잠정수용 += 세; else 잠정자경 += 세; }
    if (!세 && (들어감 || 잠)) 할일.push({ 무엇: '앞선 양도(' + (d || (i + 1) + '번째') + ')의 신고서 — 감면받은 양도소득세액', 때: '신고 전', 근거: '조특법 §133③' });
    줄.push({ 앞선양도일: d || null, 산사람: a.산사람 || null, 감면: a.감면 || null, 감면세액: 세, 묶음: 수 ? '§133②1호(수용 등 2억)' : '§133①1호(자경 등 1억)', 합산: 들어감 ? '예' : 잠 ? '잠정' : '아니오', 왜: 왜.join(' · ') });
  });
  const 대상 = 합자경 + 합수용 > 0, 잠정 = !대상 && 잠정자경 + 잠정수용 > 0;
  reqs.push(jmReq_('나눠(지분으로) 해를 넘겨 같은 사람·배우자에게 2년 안 양도', 대상 ? true : 잠정 ? null : false, 줄.map(function (x) { return x.앞선양도일 + ' ' + x.합산 + ' — ' + x.왜; }).join(' / ') || '앞선 양도 없음', '조특법 §133③·법률 제19936호 부칙'));
  const 칸자경 = 새묶음 ? 합자경 : 합자경 + 합수용, 칸수용 = 새묶음 ? 합수용 : 0;
  const 잠자경 = 새묶음 ? 잠정자경 : 잠정자경 + 잠정수용, 잠수용 = 새묶음 ? 잠정수용 : 0;
  const 표 = 대상 ? '§133③ 합산 — 이번 과세기간 한도에 앞선 감면 ' + won(합자경 + 합수용) + '원을 더해 봄' : 잠정 ? '§133③ 합산 잠정 — 확인할 것 남음(앞선 감면 ' + won(잠정자경 + 잠정수용) + '원)' : '§133③ 합산 대상 아님 — 해마다 따로 한도';
  if (!새묶음) notes.push('이번 양도가 2024년 — 그해엔 수용(§77·§77의2·§77의3)도 자경 등과 한 묶음(옛 §133①1호 1억원)이라 앞선 감면을 모두 그 칸에 더함');
  notes.push('§133③은 과세기간 한도(①1호 1억·②1호 2억)에만 씀. 5개 과세기간 한도(①2호·②2호)는 앞선 양도가 직전 4개 과세기간이면 원래 들어감 — 「직전 4개 과세기간 감면세액」 칸(sect133PriorFarm·sect133PriorComp)에도 그 감면을 넣을 것');
  notes.push('앞선 해 신고는 그대로 두고, 한 과세기간으로 보아 넘는 몫은 자산양도 순서에 따라 늦게 판 이번 양도에서 깎임(§133① 후단 "자산양도의 순서에 따라 합산") — 앞선 해를 고쳐 신고해야 하는지 (원문 확인 2026-11-04: 조특법 §133①·② 후단·③)');
  if (같은해) notes.push('같은 해에 판 부분은 원래 한 과세기간 — 이 칸 말고 양도소득세 여러 건 계산(calculate_transfer_tax_multi)으로 함께 넣어야 한도가 맞음');
  notes.push('「동일인」은 산 사람 기준 — 법인이면 같은 법인. 공익사업 시행자에게 나눠 수용된 경우도 같은 시행자면 해당');
  // 엔진 칸
  const 바탕 = p.바탕 || null;
  if (바탕 && 바탕.transferDate && 바탕.transferPrice) {
    const 붙 = function (a, b) { const c = Object.assign({}, 바탕); if (a) c.sect133SameBuyerPriorReduction = a; if (b) c.sect133SameBuyerPriorComp = b; return c; };
    if (대상 || 잠정) {
      경우.push({ 이름: '① 법대로 — 앞선 감면을 과세기간 한도에 합산' + (잠정 ? '(잠정)' : ''), 엔진: 'calculate_transfer_tax', 엔진칸: 대상 ? 붙(칸자경, 칸수용) : 붙(잠자경, 잠수용) });
      경우.push({ 이름: '② 잘못 — 해마다 따로 한도(합산 안 함)', 엔진: 'calculate_transfer_tax', 엔진칸: 붙(0, 0), 잘못: true });
    } else 경우.push({ 이름: '① 법대로 — 따로 한도', 엔진: 'calculate_transfer_tax', 엔진칸: 붙(0, 0) });
  }
  if (대상 || 잠정) 할일.push({ 무엇: '앞선 양도의 매매계약서(산 사람)·분할 전후 토지대장·등기부(분할일)·산 사람 가족관계(배우자인지)', 때: '신고 전', 근거: '조특법 §133③' });
  return jmWrap_('나눠팔기', reqs, { 적용: true, 결론: 표, 합산: 대상, 잠정: 잠정 || undefined, 앞선감면_자경묶음: 대상 ? 칸자경 : 잠자경, 앞선감면_수용묶음: 대상 ? 칸수용 : 잠수용, 엔진칸: { sect133SameBuyerPriorReduction: 대상 ? 칸자경 : 잠자경, sect133SameBuyerPriorComp: 대상 ? 칸수용 : 잠수용 }, 앞선양도: 줄, 경우: 경우, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 97 「도씨 임대 빌라」] 장기일반민간임대주택 장기보유특별공제 70%(옛 규정 8년 50%) 특례 요건 — 조특법 §97의3, 시행령 §97의3②③④, 시행규칙 §44
//  엔진은 등록 시기·종류(rental9703Eligibility_)와 임대연수만 받아 특례율을 줬다. 10년 계속 등록·통산 임대(공실 3개월·재개발 기간), 임대료 5% 증액 제한·1년 안 증액 금지,
//  국민주택규모, 임대개시일 기준시가 6억(수도권 밖 3억), 자동말소 아파트 매입임대(8년 간주)를 가르는 도구가 없어 넥스가 「장기일반」 표시만 보고 70%를 붙일 수 있었다.
//  p: { 양도일, 거주자(예), 등록일(장기일반·공공지원 등록), 종류(건설|매입), 아파트(예), 등록신청일, 단기변경일, 임대개시일(없으면 등록일), 말소일, 말소사유(자동|자진),
//       전용면적, 수도권(예), 읍면(예 — 수도권 밖 도시지역 아닌 읍·면), 임대개시기준시가(주택+부수토지), 취득일, 계약일(취득 계약금 지급일),
//       계약: [{ 시작, 끝, 보증금, 월세 }], 전환율(%, 보증금↔월세 환산), 재개발: { 인가일, 준공일 }, 상속: { 피상속인임대일수 }, 바탕: 엔진 양도 칸 }
function jmAddM_(d, m) { const t = new Date(d); t.setUTCMonth(t.getUTCMonth() + m); return t.toISOString().slice(0, 10); }
function judgeRental9703_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 계약줄 = [];
  const T = jmYmd_(p.양도일), R = jmYmd_(p.등록일), S0 = jmYmd_(p.임대개시일) || R;
  const 말소 = jmYmd_(p.말소일), 자동 = /자동/.test(String(p.말소사유 || ''));
  const 매입 = /매입|purchase/.test(String(p.종류 || '')), 건설 = /건설|construction/.test(String(p.종류 || ''));
  const 아파트 = jmYn_(p.아파트) === true, 신청 = jmYmd_(p.등록신청일) || R, 변경 = jmYmd_(p.단기변경일);
  // ① 거주자
  const 거 = jmYn_(p.거주자);
  reqs.push(jmReq_('거주자', 거 === false ? false : 거 === true ? true : null, 거 === false ? '비거주자는 대상 아님' : 거 === true ? '거주자' : '거주자인지 모름', '시행령 §97의3①'));
  // ② 등록 시기·종류(엔진 rental9703Eligibility_와 같은 기준)
  let 등록ok = null, 등록왜 = '';
  if (!R) 등록왜 = '장기일반·공공지원 등록일 모름 — 임대사업자 등록만으로는 대상 아님';
  else if (R > '2027-12-31') { 등록ok = false; 등록왜 = '등록 ' + R + ' — 2027.12.31.까지 등록분만'; }
  else if (변경 && 변경 >= '2020-07-11') { 등록ok = false; 등록왜 = '단기임대를 ' + 변경 + '에 장기일반으로 변경 신고 — 2020.7.11. 이후 변경 주택 제외(§97의3① 괄호)'; }
  else if (R >= '2023-01-01') { 등록ok = 매입 ? false : 건설 ? true : null; 등록왜 = '2023.1.1. 이후 등록 — 민간건설임대만' + (매입 ? ' — 매입임대라 대상 아님' : 건설 ? '' : ' — 건설·매입 모름'); }
  else if (매입 && R > '2020-12-31') { 등록ok = false; 등록왜 = '매입임대 ' + R + ' 등록 — 2020.12.31.까지 등록분만'; }
  else if (매입 && 아파트 && 신청 >= '2020-07-11') { 등록ok = false; 등록왜 = '아파트 매입임대를 ' + 신청 + '에 장기일반 등록 신청 — 2020.7.11. 이후 신청 제외'; }
  else { 등록ok = true; 등록왜 = '등록 ' + R + (매입 ? ' 매입' : 건설 ? ' 건설' : '') + '임대 — 2022.12.31. 이전 등록이라 종전 규정(8년 50%·10년 70%, 법률 부칙 제38조)'; }
  reqs.push(jmReq_('장기일반·공공지원 등록 시기·종류', 등록ok, 등록왜, '조특법 §97의3①·부칙'));
  const 옛규정 = !!R && R <= '2022-12-31';
  // ③ 계속 등록·통산 임대
  const 끝 = 말소 && (!T || 말소 < T) ? 말소 : T;
  const cs = [].concat(p.계약 || []).map(function (c) { return { s: jmYmd_(c.시작), e: jmYmd_(c.끝), 보: n(c.보증금), 월: n(c.월세) }; })
    .filter(function (c) { return c.s; }).sort(function (a, b) { return a.s < b.s ? -1 : 1; });
  const 재 = p.재개발 || null, 재s = 재 && jmYmd_(재.인가일) ? jmAddM_(jmYmd_(재.인가일), -6) : '', 재e = 재 && jmYmd_(재.준공일) ? jmAddM_(jmYmd_(재.준공일), 6) : '';
  let 임대일 = 0, 공실산입 = 0, 간주 = false;
  const 공실불산입 = [], 재개발줄 = [];
  if (S0 && 끝 && cs.length) {
    const iv = [];
    cs.forEach(function (c, i) {
      const s = c.s < S0 ? S0 : c.s, e = c.e && c.e < 끝 ? c.e : 끝;
      if (e >= s) iv.push({ s: s, e: e });
      const nx = cs[i + 1];
      if (nx && c.e) {
        const gap = jmDays_(c.e, nx.s) - 1;
        if (gap > 0) {
          if (재s && 재e && c.e >= 재s && nx.s <= 재e) 재개발줄.push(c.e + '~' + nx.s + '(' + gap + '일)');
          else if (nx.s <= jmAddM_(c.e, 3)) { iv.push({ s: famAddD_(c.e, 1), e: famAddD_(nx.s, -1) }); 공실산입 += gap; }
          else 공실불산입.push(c.e + '~' + nx.s + '(' + gap + '일)');
        }
      }
    });
    임대일 = jmLen_(jmMerge_(iv));
  }
  const 상속일 = n(p.상속 && p.상속.피상속인임대일수);
  임대일 += 상속일;
  const 연수 = Math.floor(임대일 / 365.25 * 100) / 100;
  const 등록10 = R && 끝 ? famAddY_(R, 10) <= 끝 : null, 등록8 = R && 끝 ? famAddY_(R, 8) <= 끝 : null;
  let 기간ok = null, 기간왜 = '', 엔진연수 = 0;
  if (옛규정 && 매입 && 아파트 && 자동 && 말소) {
    간주 = true; 엔진연수 = 8; 기간ok = true;
    기간왜 = '아파트 매입임대 자동말소(' + 말소 + ') — 8년 등록·임대로 봄(옛 시행령 §97의3②2호, 2020.10.7. 신설·2020.8.18. 이후 말소분) → 50%만';
  } else if (!cs.length || !S0) {
    기간왜 = '임대 계약 목록·임대개시일 없음 — 임대차계약서·표준임대차계약 신고 내역을 받을 것';
  } else {
    const 열 = S0 && 임대일 >= jmDays_(S0, famAddY_(S0, 10)), 여덟 = S0 && 임대일 >= jmDays_(S0, famAddY_(S0, 8));
    if (열 && 등록10 !== false) { 엔진연수 = 10; 기간ok = true; }
    else if (옛규정 && 여덟 && 등록8 !== false) { 엔진연수 = 8; 기간ok = true; }
    else { 엔진연수 = Math.floor(연수); 기간ok = false; }
    기간왜 = '통산 임대 ' + 임대일 + '일(약 ' + 연수 + '년' + (공실산입 ? ', 3개월 안 공실 ' + 공실산입 + '일 넣음' : '') + (상속일 ? ', 피상속인 ' + 상속일 + '일 합산' : '') + ')' +
      (공실불산입.length ? ' · 3개월 넘는 공실 ' + 공실불산입.join(', ') + '는 안 셈' : '') +
      (재개발줄.length ? ' · 재개발 등 기간 ' + 재개발줄.join(', ') + '는 계속 임대로 보되 날수는 안 셈' : '') +
      ' · 계속 등록 ' + R + '~' + 끝 + (등록10 === false ? '(10년 안 됨)' : '') +
      (말소 && (!T || 말소 < T) ? ' · ' + (자동 ? '자동' : '자진') + '말소 ' + 말소 : '') + (엔진연수 === 8 && 기간ok ? ' → 8년 이상 50%(옛 규정)' : '');
  }
  reqs.push(jmReq_('10년 이상 계속 등록·통산 임대(옛 규정은 8년 50%)', 기간ok, 기간왜, '시행령 §97의3②④·§97⑤·시행규칙 §44'));
  // ④ 임대료 5%·1년
  const 전환 = n(p.전환율);
  const 환산 = function (c) { return c.보 + c.월 * 12 / (전환 / 100); };
  let 증액ok = cs.length >= 2 ? true : null, 증액모름 = false, 앞증액 = '';
  for (let i = 1; i < cs.length; i++) {
    const a = cs[i - 1], b = cs[i];
    let r = null, 왜 = '';
    if (!a.월 && !b.월) r = a.보 ? b.보 / a.보 - 1 : null;
    else if (a.보 === b.보 && a.월 && b.월) r = b.월 / a.월 - 1;
    else if (전환) r = 환산(b) / 환산(a) - 1;
    else 왜 = '보증금·월세가 함께 바뀜 — 전환율이 없어 증가율 모름(민간임대주택법 §44④ 기준 [실사건 때 확인])';
    const 옛계약 = b.s < '2020-02-11';
    const 일년 = r > 0 && !!앞증액 && jmDays_(앞증액, b.s) < 365, 앞증액일 = 앞증액;
    if (r > 0) 앞증액 = b.s;
    let 판 = r == null ? null : r > 0.05 + 1e-9 ? false : true;
    if (일년) 판 = false;
    if (옛계약 && 판 === false) 판 = null;
    if (판 === false) 증액ok = false; else if (판 === null) 증액모름 = true;
    계약줄.push({ 판정: 판 === true ? '✔' : 판 === false ? '✘' : '?', 줄: b.s + ' 계약 보증금 ' + won(b.보) + '·월세 ' + won(b.월) + (r == null ? '' : ' — 증가율 ' + Math.round(r * 10000) / 100 + '%') +
      (일년 ? ' · 앞선 증액(' + 앞증액일 + ')부터 1년 안 다시 증액' : '') + (옛계약 && r > 0.05 ? ' · 2020.2.11. 전 계약 — 그때 기준 [확인 필요 — 권장: 부칙 없음 — 권장: 개정 뒤 체결·갱신 계약부터 1년 제한, 그 전 계약은 5% 상한만]' : '') + (왜 ? ' · ' + 왜 : '') });
  }
  if (증액ok === true && 증액모름) 증액ok = null;
  reqs.push(jmReq_('임대료 등 증가율 5% 이하·1년 안 다시 증액 없음', 증액ok, cs.length < 2 ? '갱신·새 계약 목록 없음' : 계약줄.map(function (x) { return x.판정 + ' ' + x.줄; }).join(' / '), '시행령 §97의3③1호·부칙(2020.2.11.) 제16조'));
  // ⑤ 국민주택규모
  const 면 = n(p.전용면적), 한면 = jmYn_(p.읍면) === true ? 100 : 85;
  reqs.push(jmReq_('국민주택규모(전용 ' + 한면 + '㎡) 이하', 면 ? 면 <= 한면 : null, 면 ? '전용 ' + 면 + '㎡' + (한면 === 100 ? '(수도권 밖 도시지역 아닌 읍·면 100㎡)' : '') : '전용면적 모름', '시행령 §97의3③2호·주택법 §2 6호'));
  // ⑥ 임대개시일 기준시가
  const 계 = jmYmd_(p.계약일), 취 = jmYmd_(p.취득일), 옛취득 = (취 && 취 <= '2018-09-13') || (계 && 계 <= '2018-09-13');
  const 한도 = jmYn_(p.수도권) === false ? 300000000 : 600000000, 기 = n(p.임대개시기준시가);
  let 가ok = null, 가왜 = '';
  if (T && T < '2018-10-23') { 가ok = true; 가왜 = '2018.10.23. 전 양도 — 기준시가 요건 없음'; }
  else if (옛취득) { 가ok = true; 가왜 = '2018.9.13. 이전 취득(계약금 지급) — 종전 규정(시행령 부칙 2018.10.23.)'; }
  else if (!기) 가왜 = '임대개시일 기준시가(주택+부수토지) 모름' + (jmYn_(p.수도권) == null ? ' · 수도권인지 모름' : '');
  else { 가ok = 기 <= 한도; 가왜 = '임대개시일 기준시가 ' + won(기) + '원 — 한도 ' + won(한도) + '원(' + (한도 === 300000000 ? '수도권 밖' : '수도권') + ')'; }
  reqs.push(jmReq_('임대개시일 기준시가 ' + 한도 / 1e8 + '억원 이하', 가ok, 가왜, '시행령 §97의3③4호·부칙(2018.10.23.)'));
  // 결론
  const 결과들 = reqs.map(function (r) { return r.결과; });
  const 안됨 = 결과들.indexOf('✘') >= 0, 모름 = !안됨 && 결과들.indexOf('?') >= 0;
  const 율 = 안됨 ? 0 : 엔진연수 >= 10 ? 70 : 엔진연수 >= 8 && 옛규정 ? 50 : 0;
  const 결론 = 안됨 ? '§97의3 특례 안 됨 — 일반 장기보유특별공제' : !율 ? '§97의3 아직 기간 미달' : '§97의3 ' + 율 + '%' + (모름 ? ' 잠정 — 확인할 것 남음' : ' 특례') + ' — 임대기간 중 양도차익에만(시행령 §97의3⑤)';
  notes.push('특례는 신청해야 받음 — 예정·확정신고 때 과세특례적용신청서(조특법 §97의3③·시행령 §97의3⑥). 엔진은 신청·안 함을 둘 다 셈해 적은 쪽을 기본으로 냄');
  notes.push('§97의4(장기임대주택 추가공제)와 겹쳐 받지 못함(§97의3②) · 다주택 중과는 시행령 §167의3대로 따로 판정');
  if (간주) notes.push('자동말소 아파트 8년 간주 호는 2023.2.28. 개정으로 지워짐 — 2022.12.31. 이전 등록분에 계속 쓰는지 시행령 부칙 경과조치 [확인 필요 — 권장: 부칙 없음 — 권장: 2022.12.31 이전 등록분엔 종전 간주 규정 계속(통상 경과조치), 잠정]');
  if (공실불산입.length) notes.push('3개월 넘는 공실은 임대기간에서 빠짐(시행규칙 §44) — 통산 10년이 늦어짐');
  if (상속일) notes.push('상속받은 임대주택은 피상속인 임대기간을 합산(시행령 §97⑤3호 준용) — 상속인이 다시 등록했는지 확인');
  // 엔진칸
  const 바탕 = p.바탕 || null;
  if (바탕 && 바탕.transferDate && 바탕.transferPrice) {
    const 특 = function (y) { return Object.assign({}, 바탕, { rentalSpecialType: 'rental_general', rentalYears: y, rentalRegistrationDate: R || 바탕.rentalRegistrationDate, rentalHousingKind: 매입 ? 'purchase' : 건설 ? 'construction' : 바탕.rentalHousingKind, rentalIsApartment: 아파트, rentalApplyDate: jmYmd_(p.등록신청일) || 바탕.rentalApplyDate, rentalConversionDate: 변경 || 바탕.rentalConversionDate }); };
    const 일 = function () { const c = Object.assign({}, 바탕); delete c.rentalSpecialType; delete c.rentalYears; return c; };
    if (안됨) { 경우.push({ 이름: '① 법대로 — 특례 없음(일반 장특공)', 엔진: 'calculate_transfer_tax', 엔진칸: 일() }); 경우.push({ 이름: '② 잘못 — 요건 안 보고 70%', 엔진: 'calculate_transfer_tax', 엔진칸: 특(10), 잘못: true }); }
    else if (율) { 경우.push({ 이름: '① 법대로 — §97의3 ' + 율 + '%' + (모름 ? '(잠정)' : ''), 엔진: 'calculate_transfer_tax', 엔진칸: 특(엔진연수) }); 경우.push({ 이름: '② 특례 안 될 때 — 일반 장특공', 엔진: 'calculate_transfer_tax', 엔진칸: 일() }); }
    else 경우.push({ 이름: '① 법대로 — 기간 미달(일반 장특공)', 엔진: 'calculate_transfer_tax', 엔진칸: 일() });
  }
  if (모름 || !cs.length) 할일.push({ 무엇: '임대사업자·장기일반 등록증(등록일·말소일), 표준임대차계약서 전부(보증금·월세·기간), 임대개시일 기준시가, 건축물대장(전용면적)', 때: '신고 전', 근거: '조특법 §97의3' });
  return jmWrap_('장기임대특례', reqs, { 적용: true, 결론: 결론, 특례율: 율, 잠정: 모름 || undefined, 임대일수: 임대일, 엔진연수: 엔진연수, 간주8년: 간주 || undefined, 계약: 계약줄, 경우: 경우, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 98 「표씨 지난 일들」] 국세 부과제척기간 — 세목·거래마다 기산일(국세기본법 시행령 §12의3)을 스스로 찾고
//  기간(국세기본법 §26의2①②④)·특례(⑤ 안 날부터 1년, ⑥ 결정·판결·경정청구 뒤)를 가려 오늘 부과할 수 있는지 냄.
//  엔진(calculate_tax_exclusion_period)은 기산일·무신고·부정행위를 사람이 넣어야 했고, 부담부증여 양도소득세(④ 후단 — 증여세와 같은 기간)·
//  상속세 거짓·누락 부분만 15년·⑥ 특례·신고기한이 쉬는 날일 때를 가르는 곳이 없었다.
//  p: { 기준일, 공휴일:[…], 건: [{ 이름, 세목(양도|소득|상속|증여|부담부증여양도), 거래일(양도일·상속개시일·증여일 — 양도·소득은 그 해),
//       신고기한(직접 — 주면 그 날), 비거주(예 — 상속 9개월), 신고(예|아니오), 부정행위(예), 거짓누락(예), 누락유형(가공채무|미등기재산|금융자산),
//       역외(예), 추징사유일(감면·공제 사후 추징 사유가 생긴 날), 불복확정일(§55·감사원·행정소송 결정·판결 확정), 판결확정일(거래 관련 민사 판결 §26의2⑥5호),
//       경정청구일(§45의2 경정청구한 날), 특례: { 유형(1~8 — ⑤ 각 호), 재산가액, 안날, 사망(예 — 상속인·증여자·수증자 중 사망) } }] }
function judgeExclusionPeriod_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10), hol = p.공휴일 || [];
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 줄 = [];
  const 끝날 = function (s, y) { return famAddD_(famAddY_(s, y), -1); }; // 기산일 넣어 셈(민법 §157 단서)·n년 뒤 같은 날 전날(§160②) — 엔진과 같음
  const 남은 = function (e) { return Math.round(jmDays_(today, e)); };
  const 유형이름 = { 1: '제3자 명의 피상속인·증여자 재산 취득', 2: '계약 중 상속 개시로 등기 안 한 재산', 3: '국외 재산', 4: '등기 필요 없는 유가증권·서화·골동품', 5: '수증자 명의 증여자 금융자산', 6: '비거주 피상속인 국내재산', 7: '명의신탁재산 증여의제(§45의2)', 8: '가상자산사업자 밖 가상자산' };
  let 끝남수 = 0, 가능수 = 0, 잠정수 = 0, 쉼미룸 = false;
  [].concat(p.건 || []).forEach(function (c, i) {
    const 이름 = c.이름 || ((i + 1) + '번째');
    const 세목 = String(c.세목 || '');
    const 상증 = /상속|^증여$/.test(세목), 부담 = /부담부/.test(세목), 상속 = /상속/.test(세목);
    const 거래 = jmYmd_(c.거래일), why = [], 근 = [];
    const 신고 = jmYn_(c.신고), 부정 = jmYn_(c.부정행위) === true, 거누 = jmYn_(c.거짓누락) === true || !!c.누락유형, 역외 = jmYn_(c.역외) === true;
    // 1) 법정신고기한 → 기산일(시행령 §12의3①1호 신고기한 다음 날, 예정신고기한은 넣지 않음)
    let 기한 = jmYmd_(c.신고기한), 기한근 = '받은 신고기한';
    if (!기한 && 거래) {
      const y = +거래.slice(0, 4), m = +거래.slice(5, 7);
      if (상속) { 기한 = new Date(Date.UTC(y, m + (jmYn_(c.비거주) === true ? 9 : 6), 0)).toISOString().slice(0, 10); 기한근 = '상속개시일 달 말일부터 ' + (jmYn_(c.비거주) === true ? '9' : '6') + '개월(상증법 §67①)'; }
      else if (/^증여$/.test(세목)) { 기한 = famGiftDue_(거래); 기한근 = '증여일 달 말일부터 3개월(상증법 §68①)'; }
      else { 기한 = (y + 1) + '-05-31'; 기한근 = '다음 해 5월 31일 확정신고기한(소득세법 §110①·§70①) — 예정신고기한은 기산에 넣지 않음(시행령 §12의3①1호 후단)'; }
    }
    let 기산 = '', 기산근 = '';
    if (기한) {
      const w = []; const 기한2 = apShift_(기한, hol, w);
      if (기한2 !== 기한) { 쉼미룸 = true; 근.push('신고기한 ' + 기한 + '이 쉬는 날이라 ' + 기한2 + '까지(국세기본법 §5①) — 기산일도 그 다음 날로 봄 (원문 확인 2026-11-04: 국기법 §5①·국기령 §12의3①1호(신고기한의 다음 날))'); }
      기산 = famAddD_(기한2, 1); 기산근 = 기한근 + ' → 다음 날';
    }
    const 추징 = jmYmd_(c.추징사유일);
    if (추징) { 기산 = 추징; 기산근 = '감면·공제 추징 사유가 생긴 날(시행령 §12의3②3호)'; }
    if (!기산) { 잠정수++; 줄.push({ 이름: 이름, 세목: 세목, 결론: '잠정 — 거래일·신고기한 모름', 왜: '거래일(양도일·상속개시일·증여일)이나 신고기한을 넣을 것' }); return; }
    // 2) 기간
    let 년, 기간근;
    if (상증 || 부담) {
      const 무 = 신고 === false;
      if (부정 || 무) { 년 = 15; 기간근 = '§26의2④' + (부정 ? '1호 부정행위' : '2호 무신고') + ' 15년'; }
      else { 년 = 10; 기간근 = '§26의2④ 본문 10년'; }
      if (부담) 기간근 += ' — 부담부증여의 양도소득세도 증여세와 같음(④ 후단)';
      if (신고 == null && !부정) { why.push('신고했는지 모름 — 신고했으면 10년(' + 끝날(기산, 10) + '까지), 안 했으면 15년(' + 끝날(기산, 15) + '까지)'); }
    } else {
      if (부정) { 년 = 역외 ? 15 : 10; 기간근 = '§26의2②2호 부정행위 ' + 년 + '년'; }
      else if (신고 === false) { 년 = 역외 ? 10 : 7; 기간근 = '§26의2②1호 무신고 ' + 년 + '년'; }
      else { 년 = 역외 ? 7 : 5; 기간근 = '§26의2① ' + 년 + '년'; }
      if (역외) 기간근 += '(역외거래)';
      if (신고 == null && !부정) why.push('신고했는지 모름 — 신고했으면 ' + 년 + '년(' + 끝날(기산, 년) + '까지), 안 했으면 ' + (역외 ? 10 : 7) + '년(' + 끝날(기산, 역외 ? 10 : 7) + '까지)');
    }
    const 기본끝 = 끝날(기산, 년);
    const 부분 = [];
    // 상증 신고했는데 거짓·누락이면 그 부분만 15년(④3호·시행령 §12의2②)
    if (상증 && 신고 === true && !부정 && 거누) { 부분.push({ 부분: '거짓·누락한 부분(' + (c.누락유형 || '거짓·누락') + ')', 년: 15, 끝: 끝날(기산, 15), 근거: '§26의2④3호·시행령 §12의2②' }); 기간근 += ' — 신고한 나머지 부분'; }
    // 3) 특례 ⑤·⑥
    const 특 = [];
    const sp = c.특례 || null;
    if (sp && (상증 || 부담)) {
      const 유 = Number(sp.유형) || 0, 가 = n(sp.재산가액), 안 = jmYmd_(sp.안날), 죽 = jmYn_(sp.사망) === true;
      const ok = 부정 && 유형이름[유] && 가 > 5000000000 && !죽 && 안;
      const 왜5 = [];
      if (!부정) 왜5.push('부정행위로 포탈한 경우만');
      if (!유형이름[유]) 왜5.push('⑤ 각 호 유형을 넣을 것(1~8)'); else 왜5.push(유 + '호 ' + 유형이름[유]);
      if (가 && 가 <= 5000000000) 왜5.push('재산가액 ' + won(가) + '원 — 50억원 이하라 안 됨(⑤ 단서)'); else if (가) 왜5.push('재산가액 ' + won(가) + '원 > 50억원');
      if (죽) 왜5.push('상속인·증여자·수증자 중 사망 — 안 됨(⑤ 단서)');
      if (!안) 왜5.push('과세관청이 안 날 모름');
      if (ok) 특.push({ 특례: '§26의2⑤ 안 날부터 1년', 끝: famAddY_(안, 1), 왜: 왜5.join(' · ') });
      else if (부정 || 유) notes.push(이름 + ': §26의2⑤ 1년 특례 안 걸림 — ' + 왜5.join(' · '));
    }
    const 불 = jmYmd_(c.불복확정일); if (불) 특.push({ 특례: '§26의2⑥1호 결정·판결 확정 뒤 1년(그 결정·판결에 따른 경정만)', 끝: famAddY_(불, 1), 왜: '확정 ' + 불 });
    const 판 = jmYmd_(c.판결확정일); if (판) 특.push({ 특례: '§26의2⑥5호 거래가 판결로 다르게 확정된 날부터 1년', 끝: famAddY_(판, 1), 왜: '확정 ' + 판 });
    const 경 = jmYmd_(c.경정청구일); if (경) 특.push({ 특례: '§26의2⑥3호 경정청구일부터 2개월(그 청구에 따른 경정만)', 끝: jmAddM_(경, 2), 왜: '청구 ' + 경 });
    // 4) 오늘 판정
    const 끝들 = [기본끝].concat(부분.map(function (x) { return x.끝; })).concat(특.map(function (x) { return x.끝; }));
    const 늦은끝 = 끝들.sort().slice(-1)[0];
    const 가능 = today <= 늦은끝, 잠 = why.length > 0;
    if (잠) 잠정수++; else if (가능) 가능수++; else 끝남수++;
    const 결론 = (잠 ? '잠정 — ' : '') + (today <= 기본끝 ? '부과 가능 — ' + 기본끝 + '까지(남은 ' + 남은(기본끝) + '일)' : '기본 기간 끝남(' + 기본끝 + ')') +
      부분.map(function (x) { return ' · ' + x.부분 + ' ' + (today <= x.끝 ? x.끝 + '까지 가능' : x.끝 + ' 끝남'); }).join('') +
      특.map(function (x) { return ' · ' + x.특례 + ' ' + (today <= x.끝 ? x.끝 + '까지 가능' : x.끝 + ' 끝남'); }).join('');
    줄.push({ 이름: 이름, 세목: 세목, 거래일: 거래 || null, 신고기한: 기한 || null, 기산일: 기산, 기산근거: 기산근, 기간_년: 년, 기간근거: 기간근, 만료일: 기본끝, 부분: 부분.length ? 부분 : undefined, 특례: 특.length ? 특 : undefined, 오늘부과: 가능, 결론: 결론, 왜: why.concat(근).join(' · ') || undefined });
    reqs.push(jmReq_(이름 + ' — 오늘(' + today + ') 부과할 수 있음', 잠 ? null : 가능, 결론, '국세기본법 §26의2·시행령 §12의3'));
    // 엔진칸 — 엔진 제척기간 계산으로 다시 셈
    경우.push({ 이름: 이름 + ' — 엔진 다시 셈', 엔진: 'calculate_tax_exclusion_period', 엔진칸: { exclusionPeriodStartDate: 기산, isOffshoreTransaction: 역외, isInheritanceOrGiftTax: 상증 || 부담, isUnreported: 신고 === false, isFraudulent: 부정, isFalseOrOmittedReport: false } });
    // 할 일
    if (가능 && 신고 === false) 할일.push({ 무엇: 이름 + ' — 기한 후 신고(§45의3)·가산세 감면(§48②) 검토(넥스 가산세 감면 도구) — 세무조사 통지 전에 해야 감면', 때: '지금', 근거: '국세기본법 §45의3·§48②' });
    if (가능 && 거누 && 신고 === true) 할일.push({ 무엇: 이름 + ' — 누락한 부분 수정신고(§45) 검토', 때: '지금', 근거: '국세기본법 §45·§48②' });
    if (!가능 && !잠) 할일.push({ 무엇: 이름 + ' — 세무조사·고지가 오면 「부과제척기간(' + 늦은끝 + ') 경과」를 다툴 근거(신고서 접수증·신고기한)를 챙겨 둠', 때: '조사·고지 때', 근거: '국세기본법 §26의2' });
  });
  if (쉼미룸) notes.push('신고기한이 토요일·공휴일이면 §5①로 다음 날까지가 신고기한 — 그 경우 기산일을 미뤄진 기한 다음 날로 셈 (원문 확인 2026-11-04: 국기법 §5① · 국기령 §12의3②2호)');
  notes.push('기간은 기산일을 넣어 세고 n년 뒤 같은 날의 전날 끝(민법 §157 단서·§160②) — 엔진과 같음');
  notes.push('예정신고만 하고 확정신고를 안 해도 되는 양도도 기산일은 확정신고기한(다음 해 5월 31일) 다음 날(시행령 §12의3①1호 후단)');
  notes.push('부정행위로 가산세 부과대상이 되면 그 가산세는 10년(§26의2②3호) · 이월결손금 공제 땐 그 결손금 해 소득세가 공제한 해 신고기한부터 1년(③)');
  notes.push('제척기간은 부과(증액경정 포함)의 기한 — 납세자가 더 낸 세금을 돌려받는 경정청구는 따로(§45의2 법정신고기한부터 5년, 넥스 불복기한 판정)');
  notes.push('명의대여·사실상 귀속자가 결정·판결로 확인되면 그 확정일부터 1년 안 실제 귀속자에게 다시 부과(§26의2⑦)');
  notes.push('2019.12.31 개정 전에 성립한 국세는 그때 규정(옛 §26의2) — 기간은 대체로 같으나 역외거래·⑤ 각 호(가상자산 8호 등)가 뒤에 생겨 [확인 필요 — 권장: 원문 없음 — 그대로]');
  const 결 = '제척기간 ' + 줄.length + '건 — 부과 가능 ' + 가능수 + ' · 끝남 ' + 끝남수 + (잠정수 ? ' · 잠정 ' + 잠정수 : '');
  return jmWrap_('제척기간', reqs, { 적용: true, 결론: 결, 기준일: today, 건별: 줄, 경우: 경우, 엔진칸늘: 경우.length > 1 || undefined, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 99 「석씨 다운계약서」] 부정행위인지·신고 가산세 — 누락·과소 항목마다 그 행위가 「조세범 처벌법」 §3⑥ 각 호의
//  적극적 행위인지(국세기본법 §26의2②2호·시행령 §12의2①) 가르고, 부정 부분만 40%(역외 60%)·나머지 10%(국세기본법 §47의3①, 시행령 §27의2③
//  과세표준 비율 나누기)·무신고 40%/20%(§47의2①)·가산세 안 붙는 부분(§47의3④)·감면(§48①②)·납부지연(§47의4①1호)을 셈.
//  엔진(calculate_filing_penalty_reduction)은 다른 계산기가 낸 가산세에 감면만 붙였고, 「무엇이 부정행위인가」·부정 부분만 40%로 나누기·
//  부정이면 제척기간 10년(상증 15년)·조세범 처벌 기준(§3①)을 가르는 곳이 없었다.
//  p: { 세목(양도|소득|상속|증여), 법정신고기한(없으면 거래일로 셈), 거래일, 신고(예|아니오), 역외(예), 신고할세액(가산세 뺀 바른 세액),
//       신고한세액, 납부한세액(신고 때 낸 돈 — 없으면 신고한세액·무신고면 0), 수정신고일, 기한후신고일, 경정예지(예 — 조사 통지 등으로 미리 알고 냄),
//       정당한사유(예|아니오 + 정당한사유내용), 납부일, 고지일, 기준일, 공휴일:[…],
//       항목: [{ 이름, 과세표준(누락·과소한 과세표준), 행위(무엇을 했나 — 다운계약서·차명계좌·이중장부·단순 누락·착오 …), 이유(평가차이|공제착오|소송|부담부평가) }] }
function judgeFraud_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10), hol = p.공휴일 || [];
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR'); };
  const 버림 = function (v) { return Math.floor(v); };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 줄 = [];
  const 세목 = String(p.세목 || ''), 상증 = /상속|증여/.test(세목) && !/양도/.test(세목), 역외 = jmYn_(p.역외) === true;
  const 신고 = jmYn_(p.신고);
  // 1) 법정신고기한(쉬는 날이면 §5①로 미룸 — 납부기한도 같음)
  let 기한 = jmYmd_(p.법정신고기한);
  const 거래 = jmYmd_(p.거래일);
  if (!기한 && 거래) {
    const y = +거래.slice(0, 4), m = +거래.slice(5, 7);
    if (/상속/.test(세목)) 기한 = new Date(Date.UTC(y, m + 6, 0)).toISOString().slice(0, 10);
    else if (/증여/.test(세목)) 기한 = famGiftDue_(거래);
    else 기한 = (y + 1) + '-05-31';
    notes.push('법정신고기한을 거래일로 셈(' + 기한 + ') — 양도는 확정신고기한으로 셈, 예정신고만 해야 하는 건이면 예정신고기한(양도일 달 말일부터 2개월, 소득세법 §105①)을 직접 넣을 것');
  }
  if (기한) 기한 = apShift_(기한, hol, []);
  // 2) 항목마다 부정행위 가르기(조세범 처벌법 §3⑥: 조세의 부과·징수를 불가능하게 하거나 현저히 곤란하게 하는 「적극적 행위」)
  const 호표 = [
    [1, /이중\s*장부|거짓\s*기장|장부.*(거짓|허위)/, '이중장부의 작성 등 장부의 거짓 기장'],
    [2, /거짓\s*(증빙|문서|계약)|허위\s*(증빙|계약|영수증)|다운\s*계약|업\s*계약|가짜\s*(영수증|계약|증빙)|이면\s*계약/, '거짓 증빙 또는 거짓 문서의 작성 및 수취'],
    [3, /파기|폐기|없앰|지움/, '장부와 기록의 파기'],
    [4, /은닉|숨김|숨겼|차명|남의\s*이름|명의\s*신탁|빼돌|조작|은폐|가장/, '재산의 은닉, 소득·수익·행위·거래의 조작 또는 은폐'],
    [5, /고의.*장부|장부.*(안\s*씀|미작성|안\s*만듦)|세금계산서.*조작|계산서.*조작/, '고의로 장부를 작성·비치하지 않음 또는 (세금)계산서·합계표 조작'],
    [6, /전사적|ERP|전산\s*조작|전자세금계산서.*조작/, '전사적 기업자원 관리설비 또는 전자세금계산서의 조작'],
    [7, /위계|부정한\s*행위|속임/, '그 밖에 위계에 의한 행위 또는 부정한 행위']
  ];
  const 단순 = /단순|누락만|빠뜨림|깜빡|착오|실수|몰라|몰랐|해석|이견|잘못\s*앎|계산\s*틀림/;
  const 면제이유 = {
    평가차이: { 상증: true, 왜: '상증법 §60②③·§66으로 평가한 가액으로 결정(부정행위면 제외) — 가산세 없음', 근거: '국세기본법 §47의3④1호다목' },
    공제착오: { 상증: true, 왜: '상속·증여 공제(§18~§24·§53·§53의2·§54) 적용 착오 — 가산세 없음', 근거: '국세기본법 §47의3④1호나목' },
    소송: { 상증: true, 왜: '신고 때 소유권 소송 등으로 상속·증여재산으로 확정되지 않음 — 가산세 없음', 근거: '국세기본법 §47의3④1호가목' },
    부담부평가: { 양도: true, 왜: '부담부증여 양도 부분을 상증법 §60②③·§66 평가액으로 결정(부정행위면 제외) — 가산세 없음', 근거: '국세기본법 §47의3④1호의2' }
  };
  let 과표합 = 0, 부정과표 = 0, 잠정과표 = 0, 제외과표 = 0, 다운 = false;
  [].concat(p.항목 || []).forEach(function (h, i) {
    const 이름 = h.이름 || ((i + 1) + '번째 항목'), 과 = n(h.과세표준), 행 = String(h.행위 || '');
    과표합 += 과;
    let 판 = null, 호 = null, 왜 = '', 근거 = '조세범 처벌법 §3⑥ · 국세기본법 시행령 §12의2①';
    const 맞 = 호표.filter(function (t) { return t[1].test(행); });
    if (맞.length && !(단순.test(행) && !맞.length)) { 판 = true; 호 = 맞.map(function (t) { return t[0]; }); 왜 = 맞.map(function (t) { return t[0] + '호 ' + t[2]; }).join(' · '); }
    else if (단순.test(행)) { 판 = false; 왜 = '적극적 행위 없이 신고에서 빠뜨림·착오 — 부정행위 아님(§3⑥ 본문 「적극적 행위」)'; }
    else { 왜 = 행 ? '「' + 행 + '」만으로는 가르지 못함 — 계약서·장부·계좌 등 무엇을 꾸미거나 숨겼는지 확인' : '무엇을 했는지(행위) 모름'; }
    if (/다운\s*계약|업\s*계약|이면\s*계약|거짓\s*계약/.test(행)) 다운 = true;
    const 이 = h.이유 && 면제이유[h.이유];
    let 제외 = false;
    if (이 && 판 !== true && ((이.상증 && 상증) || (이.양도 && /양도/.test(세목)))) { 제외 = true; 제외과표 += 과; }
    else if (이 && 판 === true) notes.push(이름 + ': ' + h.이유 + ' 사유가 있어도 부정행위면 가산세가 붙음(§47의3④ 괄호)');
    else if (이) notes.push(이름 + ': ' + h.이유 + ' 사유는 ' + (이.상증 ? '상속세·증여세' : '부담부증여 양도소득세') + '에만 — 이 세목엔 안 걸림');
    if (!제외) { if (판 === true) 부정과표 += 과; else if (판 == null) 잠정과표 += 과; }
    줄.push({ 이름: 이름, 과세표준: 과, 행위: 행 || null, 부정행위: 판 === true ? '예' : 판 === false ? '아니오' : '모름', 조세범처벌법_호: 호 || undefined, 왜: 왜, 가산세제외: 제외 ? 이.왜 : undefined, 근거: 제외 ? 근거 + ' · ' + 이.근거 : 근거 });
    reqs.push(jmReq_(이름 + ' — 부정행위 아님', 판 == null ? null : !판, 왜 + (제외 ? ' · ' + 이.왜 : ''), 근거));
  });
  if (부정과표 + 잠정과표 > 0) notes.push('부정행위는 행위(§3⑥ 각 호)에 더해 「조세의 부과와 징수를 불가능하게 하거나 현저히 곤란하게」 한 결과가 있어야 함(§3⑥ 본문) — 숨긴 정도·세무서가 알 수 있었는지 정황을 함께 볼 것 [실사건 때 확인 — 사실 판단]');
  const 과소과표 = n(p.과소과세표준) || 과표합;
  // 3) 가산세 셈
  const 바른 = n(p.신고할세액), 한 = 신고 === false ? 0 : n(p.신고한세액);
  const 부정율 = 역외 ? 0.6 : 0.4;
  const 셈 = function (잠정부정) { // 잠정 항목을 부정으로 볼지
    const 부과 = 부정과표 + (잠정부정 ? 잠정과표 : 0);
    if (신고 === false) {
      const 무 = 바른, 부정무 = 부과 > 0;
      return { 종류: '무신고', 세액: 무, 부정세액: 부정무 ? 무 : 0, 일반세액: 부정무 ? 0 : 무, 제외세액: 0, 가산세: 버림(무 * (부정무 ? 부정율 : 0.2)), 율: 부정무 ? (역외 ? '60%' : '40%') : '20%', 근거: '국세기본법 §47의2①' + (부정무 ? '1호' : '2호') };
    }
    const 소 = Math.max(0, 바른 - 한);
    const 부 = 과소과표 > 0 ? 버림(소 * 부과 / 과소과표) : 0;
    const 제 = 과소과표 > 0 ? 버림(소 * 제외과표 / 과소과표) : 0;
    const 일 = Math.max(0, 소 - 부 - 제);
    return { 종류: '과소신고', 세액: 소, 부정세액: 부, 일반세액: 일, 제외세액: 제, 가산세: 버림(부 * 부정율) + 버림(일 * 0.1), 율: '부정 ' + (역외 ? '60%' : '40%') + ' · 나머지 10%', 근거: '국세기본법 §47의3①1호·2호 · 시행령 §27의2③(과세표준 비율로 나눔)' + (제 ? ' · §47의3④' : '') };
  };
  const 법대로 = 셈(false), 잠정부정 = 잠정과표 > 0 ? 셈(true) : null;
  if (신고 == null) reqs.push(jmReq_('법정신고기한까지 신고했는지 앎', null, '신고했으면 과소신고(§47의3), 안 했으면 무신고(§47의2)', '국세기본법 §47의2·§47의3'));
  if (!바른) reqs.push(jmReq_('바른 세액(가산세 뺀 신고했어야 할 세액)을 앎', null, '계산 엔진으로 누락 항목을 넣어 다시 셀 것', '국세기본법 §47의2①·§47의3①'));
  // 4) 감면(§48) — 정당한 사유는 사실 판단
  const 정 = jmYn_(p.정당한사유), 예지 = jmYn_(p.경정예지) === true;
  const 수정 = jmYmd_(p.수정신고일), 후 = jmYmd_(p.기한후신고일);
  let 감면율 = 0, 감면근거 = '', 감면왜 = '';
  if (정 === true) { 감면율 = 1; 감면근거 = '국세기본법 §48①2호'; 감면왜 = '정당한 사유' + (p.정당한사유내용 ? '(' + p.정당한사유내용 + ')' : '') + ' — 인정 여부는 과세관청·불복에서 정함 [실사건 때 확인]'; }
  else if (기한 && 신고 !== false && 수정 && !예지) {
    const 표 = [[1, 0.9, '가'], [3, 0.75, '나'], [6, 0.5, '다'], [12, 0.3, '라'], [18, 0.2, '마'], [24, 0.1, '바']];
    const t = 표.find(function (x) { return 수정 <= jmAddM_(기한, x[0]); });
    if (t) { 감면율 = t[1]; 감면근거 = '국세기본법 §48②1호' + t[2] + '목'; 감면왜 = '수정신고 ' + 수정 + ' — 기한 지난 뒤 ' + t[0] + '개월 안'; }
    else 감면왜 = '수정신고가 기한 지난 뒤 2년 넘음 — 감면 없음';
  } else if (기한 && 신고 === false && 후 && !예지) {
    const 표 = [[1, 0.5, '가'], [3, 0.3, '나'], [6, 0.2, '다']];
    const t = 표.find(function (x) { return 후 <= jmAddM_(기한, x[0]); });
    if (t) { 감면율 = t[1]; 감면근거 = '국세기본법 §48②2호' + t[2] + '목'; 감면왜 = '기한 후 신고 ' + 후 + ' — 기한 지난 뒤 ' + t[0] + '개월 안'; }
    else 감면왜 = '기한 후 신고가 기한 지난 뒤 6개월 넘음 — 감면 없음';
  } else if (예지 && (수정 || 후)) 감면왜 = '경정·결정할 것을 미리 알고 냄 — §48② 감면 없음(조사 통지 뒤 수정신고 등)';
  if (정 == null && p.정당한사유내용) reqs.push(jmReq_('정당한 사유', null, p.정당한사유내용 + ' — 시행령 §28①(세법해석 질의회신대로 신고·수용 등으로 의무 이행 못 함) 같은 사정인지', '국세기본법 §48①·시행령 §28①'));
  const 감면 = function (r) { const g = r.가산세 - 버림(r.가산세 * (1 - 감면율) + 1e-6); return { 감면전: r.가산세, 감면: g, 감면뒤: r.가산세 - g }; };
  // 5) 납부지연(§47의4①1호) — 법정납부기한 다음 날부터 납부일(고지 전 납부)·고지일 전날까지, 1일 이자율(시행령 §27의4①)
  const 미납 = Math.max(0, 바른 - (p.납부한세액 != null ? n(p.납부한세액) : 한));
  const 끝 = jmYmd_(p.납부일) || jmYmd_(p.고지일) || today;
  let 지연 = 0; const 지연줄 = [];
  if (기한 && 미납 > 0 && 끝 > 기한) {
    const 율표 = [['0000-01-01', '2019-02-11', 0.0003], ['2019-02-12', '2022-02-14', 0.00025], ['2022-02-15', '9999-12-31', 0.00022]];
    const s0 = famAddD_(기한, 1), e0 = famAddD_(끝, -1);
    율표.forEach(function (t) {
      const s = s0 > t[0] ? s0 : t[0], e = e0 < t[1] ? e0 : t[1];
      if (s <= e) { const d = Math.round(jmDays_(s, e)) + 1; const a = 버림(미납 * d * t[2]); 지연 += a; 지연줄.push({ 기간: s + '~' + e, 일수: d, 이율: (t[2] * 100).toFixed(3) + '%/일', 금액: a }); }
    });
    if (지연줄.length > 1) notes.push('납부지연 기간이 이율 바뀐 날(2019-02-12·2022-02-15)을 넘어 나눠 셈 — 옛 이율과 부칙(기간분부터 새 율) [확인 필요 — 권장: 부칙 없음 — 권장: 각 개정 시행일 이후 기간분부터 새 율(통상 부칙), 코드대로 나눠 셈]');
  }
  // 6) 경우(엔진칸 — 넥스 가산세 감면 도구로 다시 셈)
  const 엔진칸 = function (r) { return { originalPenaltyAmount: r.가산세, filingType: 신고 === false ? 'late_filing' : 'revised', statutoryFilingDeadline: 기한 || undefined, filingDate: (신고 === false ? 후 : 수정) || undefined, isAmendedAfterAuditNotice: 예지, hasJustifiableReason: 정 === true }; };
  const 경우줄 = function (이름, r, 근) { const g = 감면(r); 경우.push({ 이름: 이름, 신고가산세: r.가산세, 감면: g.감면, 감면뒤: g.감면뒤, 납부지연: 지연, 합계: g.감면뒤 + 지연, 나눔: { 부정세액: r.부정세액, 일반세액: r.일반세액, 제외세액: r.제외세액 }, 근거: 근, 엔진: r.가산세 > 0 && (감면율 > 0 || (수정 || 후)) ? 'calculate_filing_penalty_reduction' : undefined, 엔진칸: r.가산세 > 0 ? 엔진칸(r) : undefined }); };
  경우줄('① 법대로' + (잠정과표 ? '(모르는 항목은 부정 아님으로)' : ''), 법대로, 법대로.근거);
  if (잠정부정) 경우줄('② 모르는 항목도 부정행위면', 잠정부정, 잠정부정.근거);
  if (신고 !== false && 부정과표 > 0) { const 다일반 = { 가산세: 버림(법대로.부정세액 * 0.1) + 버림(법대로.일반세액 * 0.1), 부정세액: 0, 일반세액: 법대로.부정세액 + 법대로.일반세액, 제외세액: 법대로.제외세액 }; 경우줄('잘못 — 부정 부분도 10%로 셈', 다일반, '부정행위를 놓침'); }
  if (신고 !== false && 과소과표 > 0 && (부정과표 > 0 || 제외과표 > 0) && 부정과표 < 과소과표) { const 다부정 = { 가산세: 버림((법대로.세액) * 부정율), 부정세액: 법대로.세액, 일반세액: 0, 제외세액: 0 }; 경우줄('잘못 — 과소 전부를 40%로 셈', 다부정, '부정 부분만 나누지 않음(시행령 §27의2③ 어김)'); }
  // 7) 제척기간·조세범·비과세 제한
  const 포탈 = 신고 === false ? (부정과표 > 0 ? 바른 : 0) : 법대로.부정세액;
  if (부정과표 > 0) {
    notes.push('부정행위가 있으면 부과제척기간이 ' + (상증 ? '15년(국세기본법 §26의2④1호)' : (역외 ? '15년' : '10년') + '(§26의2②2호)') + ' — 판정 묶음 「제척기간」에 부정행위: 예로 넣어 만료일을 셀 것');
    const 가중 = (포탈 >= 300000000 && 바른 > 0 && 포탈 / 바른 >= 0.3) || 포탈 >= 500000000;
    notes.push('포탈세액 ' + won(포탈) + '원' + (가중 ? ' — 조세범 처벌법 §3① 단서(3억 이상·30% 이상 또는 5억 이상) 해당: 3년 이하 징역 또는 3배 이하 벌금' : ' — §3① 본문(2년 이하 징역 또는 2배 이하 벌금) 범위') + ' · 법정신고기한 뒤 2년 안 수정신고·6개월 안 기한 후 신고면 형 감경 가능(§3③)');
    할일.push({ 무엇: '부정 항목 증빙(계약서 원본·계좌·장부)을 모아 정말 「적극적 행위」인지·세무서가 알 수 있었는지 가름 — 다툴 여지가 있으면 10% 쪽 근거를 정리', 때: '조사 대응 때', 근거: '조세범 처벌법 §3⑥ · 국세기본법 §47의3①' });
  }
  if (다운 && /양도/.test(세목)) notes.push('거래가액을 실제와 다르게 적은 계약서면 1세대1주택 등 비과세·감면도 줄어듦(소득세법 §91②·조특법 §129②: 비과세받을 세액과 차액 중 적은 금액을 뺌) — 넥스 양도 계산 칸 contractPriceDifference로 셈');
  if (정 !== true && (신고 === false ? !후 : !수정) && 바른 > 한) 할일.push({ 무엇: (신고 === false ? '기한 후 신고(§45의3)' : '수정신고(§45)') + ' — 세무조사 통지 전이면 가산세 감면(§48②), 늦을수록 감면이 줄어듦' + (기한 ? '(지금 ' + (신고 === false ? (today <= jmAddM_(기한, 6) ? '감면 남음' : '6개월 지나 감면 없음') : (today <= jmAddM_(기한, 24) ? '감면 남음' : '2년 지나 감면 없음')) + ')' : ''), 때: '지금', 근거: '국세기본법 §45·§45의3·§48②' });
  notes.push('신고 가산세(§47의2·§47의3)와 납부지연가산세(§47의4)는 따로 — §48② 감면은 신고 가산세에만');
  notes.push('예정신고 때 가산세가 붙은 부분은 확정신고 때 또 붙이지 않음(§47의2⑤·§47의3⑥)');
  const 결 = '부정행위 ' + (부정과표 > 0 ? '있음(과세표준 ' + won(부정과표) + '원)' : '없음') + (잠정과표 ? ' · 모름 ' + won(잠정과표) + '원' : '') + ' — ' + 법대로.종류 + ' 가산세 ' + won(감면(법대로).감면뒤) + '원' + (지연 ? ' + 납부지연 ' + won(지연) + '원' : '');
  return jmWrap_('부정행위', reqs, { 적용: true, 결론: 결, 기준일: today, 법정신고기한: 기한 || null, 항목별: 줄, 가산세: { 법대로: 법대로, 잠정부정: 잠정부정 || undefined, 감면율: 감면율, 감면근거: 감면근거 || undefined, 감면왜: 감면왜 || undefined, 납부지연: 지연, 납부지연줄: 지연줄, 미납세액: 미납 }, 포탈세액: 포탈, 경우: 경우, 엔진칸늘: 경우.length > 1 || undefined, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 100 「정씨 돌려받을 세금」] 국세환급금·환급가산금 — 경정청구·불복·감면으로 돌려받을 세금에 붙는 이자(국세기본법 §52)를
//  원인마다 기산일(시행령 §43의3①)부터 지급결정일(충당이면 충당일)까지 이율 바뀐 날마다 나눠 셈하고(시행규칙 §19의3), 불복 확정 뒤 40일 넘어 주면 1.5배(②단서),
//  고충민원만으로 돌려받으면 0(§52③), 체납·고지세액에 먼저 충당(§51②)·남은 돈 30일 안 지급(§51⑥)·경정청구 결정 2개월(§45의2③)·소멸시효 5년(§54)을 가름.
//  엔진에는 상속세 특례 경정(§79)과 사후관리 이자에만 환급가산금 이율이 있었고, 일반 환급가산금을 셈하는 도구가 없었다.
//  이율 표는 엔진 REFUND_INTEREST_RATE_HISTORY(2026.10.19 조견표 원문 대조)를 그대로 읽음(jmRefundRates_).
//  p: { 세목, 원인(경정|착오|이중|감면|법개정|불복|고충민원|환급신고), 환급세액, 납부:[{일, 금액}](나눠 냈으면 모두), 법정신고기한(원천징수·중간예납분이 있으면),
//       원천징수납부액, 감면결정일, 법개정시행일, 경정청구일, 결정일(환급 결정일), 지급일, 불복확정일, 고충민원(예), 충당:[{이름, 금액, 종류(체납|고지|자진), 동의(예)}], 기준일 }
// [2026.11.04 계산 엔진 하나 ③] 이율 표는 엔진(REFUND_INTEREST_RATE_HISTORY) 하나 — 사본 두지 않고 엔진에서 읽는다(사본엔 2026-01-02 줄이 빠져 있었음, 값은 같음).
function jmRefundRates_() {
  let eng = null;
  try { eng = typeof getUiCalcEngine_ === 'function' ? getUiCalcEngine_() : null; } catch (e) { eng = null; }
  const t = eng && eng.NX_RATE_TABLES_ && eng.NX_RATE_TABLES_.환급가산금;
  if (!Array.isArray(t) || !t.length) throw new Error('계산 못 함 — 엔진을 읽지 못함(환급가산금 이율 표)');
  return t;
}
function judgeRefund_(p) {
  p = p || {};
  const JM_REFUND_RATE_ = jmRefundRates_();
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 원인 = String(p.원인 || ''), 환급 = n(p.환급세액);
  const 고충 = jmYn_(p.고충민원) === true;
  // 1) 기산일(시행령 §43의3①) — 그날의 다음 날
  let 조각 = [], 기산왜 = '', 기산근거 = '';
  const 납부 = [].concat(p.납부 || []).map(function (x) { return { 일: jmYmd_(x.일), 금액: n(x.금액) }; }).filter(function (x) { return x.일 && x.금액; }).sort(function (a, b) { return a.일 < b.일 ? -1 : 1; });
  const 원천 = n(p.원천징수납부액), 신고기한 = jmYmd_(p.법정신고기한);
  if (원천 && 신고기한) 납부.push({ 일: 신고기한, 금액: 원천, 간주: true }); // 원천징수·중간예납은 법정신고기한에 낸 것으로 봄(1호 단서)
  납부.sort(function (a, b) { return a.일 < b.일 ? -1 : 1; });
  if (/감면/.test(원인)) {
    const d = jmYmd_(p.감면결정일); 기산근거 = '시행령 §43의3①2호';
    if (d) { 조각 = [{ 일: d, 금액: 환급 }]; 기산왜 = '적법하게 낸 세금의 감면 — 감면 결정일(' + d + ') 다음 날부터'; }
    else 기산왜 = '감면 결정일 모름';
  } else if (/법개정/.test(원인)) {
    const d = jmYmd_(p.법개정시행일); 기산근거 = '시행령 §43의3①3호';
    if (d) { 조각 = [{ 일: d, 금액: 환급 }]; 기산왜 = '적법하게 낸 뒤 법이 바뀜 — 개정 법률 시행일(' + d + ') 다음 날부터'; }
    else 기산왜 = '개정 법률 시행일 모름';
  } else if (/환급신고/.test(원인)) {
    기산근거 = '시행령 §43의3①4호'; 기산왜 = '세법에 따른 환급세액 신고·신청분 — 신고일(법정신고기일 전이면 그날)·신청일부터 30일 지난 날 다음 날부터(세법 환급기한이 있으면 그 다음 날)';
    const d = jmYmd_(p.경정청구일) || 신고기한; if (d) 조각 = [{ 일: famAddD_(d, 30), 금액: 환급 }];
    notes.push('4호는 소득세법 등의 환급세액(원천징수 초과 등)에 씀 — 양도·상속·증여세를 더 낸 것을 경정으로 돌려받으면 1호');
  } else {
    기산근거 = '시행령 §43의3①1호';
    if (!납부.length) 기산왜 = '낸 날 모름 — 납부일(나눠 냈으면 모두)을 넣을 것';
    else { // 나눠 냈으면 마지막 납부분부터 거꾸로(1호 단서)
      let 남 = 환급;
      for (let i = 납부.length - 1; i >= 0 && 남 > 0; i--) { const a = Math.min(남, 납부[i].금액); 조각.unshift({ 일: 납부[i].일, 금액: a, 간주: 납부[i].간주 }); 남 -= a; }
      if (남 > 0) { notes.push('환급세액이 낸 돈 합계보다 ' + won(남) + '원 많음 — 납부 내역을 다시 볼 것'); reqs.push(jmReq_('환급세액이 낸 돈 안', false, '환급 ' + won(환급) + '원 > 납부 합계', '국세기본법 §51①')); }
      기산왜 = (/착오|이중/.test(원인) ? '잘못·이중 낸 세금' : '낸 뒤 신고·부과를 경정·취소') + ' — 납부일 다음 날부터' + (조각.length > 1 ? '(나눠 낸 것은 마지막 납부분부터 거꾸로 채움)' : '');
    }
  }
  // 2) 끝(§52①: 충당하는 날 또는 지급결정을 하는 날까지) · 결정 기한
  const 청구 = jmYmd_(p.경정청구일), 결정 = jmYmd_(p.결정일), 지급 = jmYmd_(p.지급일), 확정 = jmYmd_(p.불복확정일);
  let 끝 = 결정, 잠정끝 = false;
  if (!끝) {
    if (청구 && /경정/.test(원인)) { 끝 = jmAddM_(청구, 2); 잠정끝 = true; notes.push('결정일 모름 — 경정청구일부터 2개월 안 결정(§45의2③)으로 보고 ' + 끝 + '까지 셈(잠정)'); }
    else { 끝 = today; 잠정끝 = true; notes.push('결정일 모름 — 기준일(' + today + ')까지 셈(잠정)'); }
  }
  if (청구) {
    const 기한 = jmAddM_(청구, 2);
    reqs.push(jmReq_('경정청구를 2개월 안에 결정', 결정 ? 결정 <= 기한 : (today <= 기한 ? null : false), '청구 ' + 청구 + ' → 결정 기한 ' + 기한 + (결정 ? ' · 결정 ' + 결정 : ' · 아직 결정 없음'), '국세기본법 §45의2③'));
    if (!결정 && today > 기한) 할일.push({ 무엇: '2개월 안 결정·통지가 없으면 그 다음 날부터 이의신청·심사·심판청구 가능(§45의2③ 후단·§61②·§68②)', 때: '지금', 근거: '국세기본법 §45의2③' });
  }
  if (결정) {
    const 지기 = famAddD_(결정, 30);
    reqs.push(jmReq_('남은 환급금을 결정일부터 30일 안 지급', 지급 ? 지급 <= 지기 : null, '결정 ' + 결정 + ' → 지급 기한 ' + 지기 + (지급 ? ' · 지급 ' + 지급 : ''), '국세기본법 §51⑥'));
  }
  // 3) 이율 — 기본이자율을 바뀐 날마다 나눔, 불복 확정 뒤 40일 넘어 지급하면 1.5배(시행령 §43의3② 단서)
  const 불복 = /불복/.test(원인) || !!확정;
  let 배 = 1, 배왜 = '';
  if (불복 && 확정) {
    const 사십 = famAddD_(확정, 40), 줄날 = 지급 || 결정;
    if (줄날 && 줄날 >= 사십 && 줄날 >= '2020-02-11') { 배 = 1.5; 배왜 = '불복 결정·판결 확정(' + 확정 + ')부터 40일 지난 뒤(' + 줄날 + ') 지급 — 기본이자율의 1.5배'; }
    else if (!줄날) notes.push('불복으로 돌려받는 돈 — 확정일(' + 확정 + ')부터 40일(' + 사십 + ') 넘어 지급하면 이율 1.5배(시행령 §43의3② 단서)');
    if (배 > 1) notes.push('1.5배를 기산일부터 전 기간에 곱함 — 단서 문언(「그 경우 … 1.5배에 해당하는 이자율을 적용」)대로, 2020-02-11 이후 지급하는 환급금부터 적용(시행령 부칙 제30400호 §4 — 확정일이 아니라 지급일 기준, 원문 확인 2026-11-04)');
  }
  const 셈 = function (zz, 끝날, 율배) {
    let 합 = 0; const 줄 = [];
    zz.forEach(function (z) {
      const s0 = famAddD_(z.일, 1); if (!(끝날 >= s0)) return;
      JM_REFUND_RATE_.forEach(function (h, i) {
        const 다음 = JM_REFUND_RATE_[i + 1] ? famAddD_(JM_REFUND_RATE_[i + 1].from, -1) : '9999-12-31';
        const s = s0 > h.from ? s0 : h.from, e = 끝날 < 다음 ? 끝날 : 다음;
        if (s <= e) { const d = Math.round(jmDays_(s, e)) + 1; const a = z.금액 * d * h.rate * 율배 / 365; 합 += a; 줄.push({ 금액: z.금액, 기간: s + '~' + e, 일수: d, 연이율: (h.rate * 율배 * 100).toFixed(2) + '%', 가산금: Math.floor(a) }); }
      });
      if (s0 < JM_REFUND_RATE_[0].from) notes.push('2012-03-01 전 기간은 이율 표가 없어 첫 이율로 셈하지 않고 뺌 [확인 필요 — 권장: 옛 이율 표(2012년 전)는 이 법령 폴더에 없음 — 첫 이율로 소급 적용하지 않고 뺀 지금 방식이 안전, 옛 이율은 법제처 연혁으로 따로]');
    });
    return { 가산금: Math.floor(합), 줄: 줄 };
  };
  // 4) 충당(§51②) — 체납은 동의 없이, 고지·자진납부 세금은 동의할 때만
  let 남은 = 환급; const 충줄 = [];
  [].concat(p.충당 || []).forEach(function (c) {
    const 종 = String(c.종류 || ''), 동 = jmYn_(c.동의) === true, 액 = n(c.금액);
    const 됨 = /체납/.test(종) || 동;
    const a = 됨 ? Math.min(남은, 액) : 0; 남은 -= a;
    충줄.push({ 이름: c.이름 || 종, 금액: 액, 충당: a, 왜: /체납/.test(종) ? '체납 국세 — 동의 없이 충당(§51②2호), 체납 법정납부기한과 환급금 발생일 중 늦은 때로 거슬러 소멸(§51③)' : 동 ? '동의해 충당(§51②1호·3호, §51④)' : '고지·자진납부 세금은 동의할 때만 충당(§51② 단서) — 동의 안 하면 지급' });
  });
  const 기본 = 고충 ? { 가산금: 0, 줄: [] } : 셈(조각, 끝, 배);
  if (고충) reqs.push(jmReq_('경정청구·불복에 따른 환급(고충민원만이면 가산금 없음)', /경정|불복/.test(원인) || 청구 || 확정 ? true : false, '고충민원 처리만으로 환급·충당하면 환급가산금을 붙이지 않음', '국세기본법 §52③·시행령 §43의3③'));
  if (고충 && (청구 || /경정|불복/.test(원인))) { const r2 = 셈(조각, 끝, 배); 기본.가산금 = r2.가산금; 기본.줄 = r2.줄; }
  경우.push({ 이름: '① 법대로', 환급세액: 환급, 환급가산금: 기본.가산금, 받을돈: 환급 + 기본.가산금, 충당: 환급 - 남은, 지급: 남은 + 기본.가산금 });
  if (불복 && 확정 && 배 === 1) { const r15 = 셈(조각, 끝, 1.5); 경우.push({ 이름: '② 확정 뒤 40일 넘어 지급되면(1.5배)', 환급세액: 환급, 환급가산금: r15.가산금, 받을돈: 환급 + r15.가산금 }); }
  if (조각.length > 1) { const 첫 = 셈([{ 일: 조각[0].일, 금액: 환급 }], 끝, 배); 경우.push({ 이름: '잘못 — 처음 낸 날부터 전부 셈', 환급세액: 환급, 환급가산금: 첫.가산금, 받을돈: 환급 + 첫.가산금, 근거: '시행령 §43의3①1호 단서 어김' }); }
  if (/감면|법개정/.test(원인) && 납부.length) { const 잘 = 셈([{ 일: 납부[납부.length - 1].일, 금액: 환급 }], 끝, 배); 경우.push({ 이름: '잘못 — 납부일부터 셈', 환급세액: 환급, 환급가산금: 잘.가산금, 받을돈: 환급 + 잘.가산금, 근거: '감면·법개정은 결정일·시행일부터(2·3호)' }); }
  // 5) 알림
  notes.push('환급금·환급가산금을 받을 권리는 행사할 수 있는 때부터 5년이면 소멸시효(§54①) — 안내·통지로는 중단 안 됨(③)');
  notes.push('지방소득세(양도·종합소득분)를 함께 돌려받는 몫은 지방세라 따로(지방세기본법) — 이 도구는 국세만');
  if (/경정/.test(원인) && !청구) notes.push('경정청구 기한: 법정신고기한 지난 뒤 5년(§45의2①), 후발 사유는 안 날부터 3개월(②) — 판정 묶음 「불복기한」으로 셀 것');
  if (/양도/.test(p.세목 || '') && /경정/.test(원인)) notes.push('양도소득세를 돌려받으면 지방소득세도 같이 경정청구해야 함(지방세 범위 — 안내만)');
  if (환급 && 남은 < 환급) notes.push('충당한 ' + won(환급 - 남은) + '원에는 충당일까지 가산금이 붙음(§52①) — 지금은 지급결정일 하나로 셈 [실사건 때 확인: 충당일이 지급결정일과 다르면 충당 몫은 충당일까지로 나눠 셀 것(충당일 칸 없음)]');
  const 결 = (원인 || '원인 모름') + ' 환급 ' + won(환급) + '원 + 환급가산금 ' + won(기본.가산금) + '원' + (배 > 1 ? '(1.5배)' : '') + (환급 - 남은 ? ' · 충당 ' + won(환급 - 남은) + '원' : '') + ' · 지급 ' + won(남은 + 기본.가산금) + '원' + (잠정끝 ? ' (결정일 잠정)' : '');
  return jmWrap_('환급가산금', reqs, { 적용: true, 결론: 결, 기준일: today, 기산: { 근거: 기산근거, 왜: 기산왜, 조각: 조각 }, 끝날: 끝, 이율배수: 배, 이율배수왜: 배왜 || undefined, 환급가산금: 기본.가산금, 가산금줄: 기본.줄, 충당: 충줄, 지급액: 남은 + 기본.가산금, 경우: 경우, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 101 「강씨 공장 물려받기」] 가업상속 상속세 납부유예(상증법 §72의2·시행령 §69의2·§69의3) — 가업상속공제 대신 납부유예를 고를 때
//  유예 금액(납부세액 × 가업상속재산 ÷ 총상속재산), 사후관리 사유마다 징수할 세액(처분 비율·종사·지분 감소 5년 안 전부/뒤 비율·고용 70%·상속인 사망)과
//  이자상당액(신고기한 다음 날~사유일, 그때 이자율 ÷ 365로 나눠 셈, 다시 유예받은 것은 50%), 신고·납부기한(사유 달 말일부터 6개월), 다시 유예(⑥)를 가름.
//  엔진에는 이자 계산(method split)만 있고, 유예 금액·사유별 징수세액·공제와 견주기를 셈하는 도구가 없었다. 이율 표는 환급가산금 판정(JM_REFUND_RATE_)과 같은 것을 씀.
//  p: { 상속개시일, 비거주(예), 중소기업(예), 가업상속공제(예 — 받았으면 유예 못 함), 영농상속공제(예), 담보(예), 상속세납부세액, 가업상속재산가액, 총상속재산가액, 다시유예(예 — ⑥에 따라 받은 유예),
//       사유:[{ 일, 종류(처분|종사|휴폐업|지분|고용|사망|담보|징수불능), 처분비율(%), 감소지분율, 개시지분율, 정당한사유(예), 다음상속인공제(예 — 사망 때 다음 상속인이 가업상속공제·유예), 수증특례(예 — 지분 감소가 조특법 §30의6·§30의7 증여) }],
//       고용:{ 정규직평균비율(%), 총급여평균비율(%) }(5년 평균 ÷ 직전 2년 평균), 기준일 }
function judgeDefer_(p) {
  p = p || {};
  const JM_REFUND_RATE_ = jmRefundRates_();
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR'); };
  const 말일 = function (d) { const t = new Date(d); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); };
  const 말일더하기 = function (d, m) { const t = new Date(d); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1 + m, 0)).toISOString().slice(0, 10); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 개시 = jmYmd_(p.상속개시일);
  const 신고기한 = 개시 ? 말일더하기(개시, jmYn_(p.비거주) === true ? 9 : 6) : '';
  // 1) 요건(§72의2①②)
  reqs.push(jmReq_('상속인이 가업(중소기업)을 상속받음', jmYn_(p.중소기업), '가업상속공제 대상 가업(§18의2①) 가운데 중소기업만 — 중견기업은 유예 대상 아님', '상속세및증여세법 §72의2①1호'));
  const 공제받음 = jmYn_(p.가업상속공제) === true || jmYn_(p.영농상속공제) === true;
  reqs.push(jmReq_('가업상속공제(영농상속공제 포함)를 받지 않음', jmYn_(p.가업상속공제) == null && jmYn_(p.영농상속공제) == null ? null : !공제받음, 공제받음 ? '공제를 받았으면 납부유예를 못 함 — 둘 가운데 하나만' : '', '상속세및증여세법 §72의2①2호'));
  reqs.push(jmReq_('담보 제공', jmYn_(p.담보), '', '상속세및증여세법 §72의2②'));
  if (개시) 할일.push({ 무엇: '상속세 신고 때(수정·기한 후 신고 포함) 납부유예신청서·가업상속재산명세서 제출 — 허가 통지는 신고기한 지난 날부터 9개월 안', 때: 신고기한, 근거: '시행령 §69의2①②1호' });
  // 2) 유예 금액(시행령 §69의3①)
  const 납부 = n(p.상속세납부세액), 가업 = n(p.가업상속재산가액), 총 = n(p.총상속재산가액);
  let 유예 = 0;
  if (납부 && 가업 && 총) 유예 = Math.floor(납부 * Math.min(1, 가업 / 총));
  else notes.push('유예 금액 = 상속세 납부세액 × 가업상속 재산가액(시행령 §15⑤) ÷ 총 상속재산가액 — 세 값을 넣을 것');
  // 3) 사후관리 사유(§72의2③⑤) — 차례로 남은 유예액에서 징수
  const 반 = jmYn_(p.다시유예) === true ? 0.5 : 1;
  const 이자 = function (액, 끝) {
    if (!신고기한 || !끝) return { 이자: 0, 줄: [] };
    const s0 = famAddD_(신고기한, 1); let 합 = 0; const 줄 = [];
    JM_REFUND_RATE_.forEach(function (h, i) {
      const 다음 = JM_REFUND_RATE_[i + 1] ? famAddD_(JM_REFUND_RATE_[i + 1].from, -1) : '9999-12-31';
      const s = s0 > h.from ? s0 : h.from, e = 끝 < 다음 ? 끝 : 다음;
      if (s <= e) { const d = Math.round(jmDays_(s, e)) + 1; const a = 액 * d * h.rate * 반 / 365; 합 += a; 줄.push({ 기간: s + '~' + e, 일수: d, 연이율: (h.rate * 반 * 100).toFixed(2) + '%', 이자: Math.floor(a) }); }
    });
    return { 이자: Math.floor(합), 줄: 줄 };
  };
  let 남 = 유예; const 징수줄 = [];
  const 오년 = 개시 ? famAddD_(jmAddM_(개시, 60), -1) : '';
  [].concat(p.사유 || []).map(function (x) { return Object.assign({}, x, { 일: jmYmd_(x.일) }); }).sort(function (a, b) { return (a.일 || '') < (b.일 || '') ? -1 : 1; }).forEach(function (x) {
    const 종 = String(x.종류 || ''), 일 = x.일, 정당 = jmYn_(x.정당한사유) === true;
    let 액 = 0, 왜 = '', 근거 = '', 다시 = false;
    if (정당 && !/사망/.test(종)) { 징수줄.push({ 일: 일, 종류: 종, 징수세액: 0, 왜: '정당한 사유 — 징수 안 함(시행령 §69의3②, §15⑧ 각 목 가운데 상속인 사망 목은 빼고)' }); return; }
    if (/처분/.test(종)) {
      const r = n(x.처분비율) / 100;
      if (r >= 0.4) { 액 = Math.floor(유예 * r); 왜 = '가업용 자산 ' + (r * 100) + '% 처분(40% 이상) — 유예세액 × 처분 비율'; }
      else 왜 = '처분 ' + (r * 100) + '% — 40% 미만이라 징수 없음';
      근거 = '§72의2③1호·시행령 §69의3③(개인 가업만 해당)';
    } else if (/휴폐업/.test(종)) { 액 = 남; 왜 = '1년 이상 휴업(실적 없음 포함)·폐업 — 가업에 종사 안 한 것으로 봄, 전부'; 근거 = '§72의2③2호·시행령 §69의3④2호'; }
    else if (/종사/.test(종)) {
      if (오년 && 일 > 오년) 왜 = '대표이사 등으로 종사 안 함 — 상속개시일부터 5년(' + 오년 + ') 지난 뒤라 징수 없음';
      else { 액 = 남; 왜 = '5년 안 대표이사 등으로 종사 안 함 — 전부'; }
      근거 = '§72의2③2호·시행령 §69의3④1호';
    } else if (/지분/.test(종)) {
      if (jmYn_(x.수증특례) === true) 다시 = true;
      if (오년 && 일 <= 오년) { 액 = 남; 왜 = '상속개시일부터 5년 안 지분 감소 — 전부'; 근거 = '§72의2③3호가목'; }
      else {
        const b = n(x.감소지분율), c = n(x.개시지분율);
        if (b && c) { 액 = Math.min(남, Math.floor(유예 * b / c)); 왜 = '5년 뒤 지분 감소 — 유예세액 × 감소 지분율 ' + b + ' ÷ 개시 지분율 ' + c; }
        else 왜 = '5년 뒤 지분 감소 — 감소 지분율·개시 지분율이 있어야 셈(잠정 0)';
        근거 = '§72의2③3호나목·시행령 §69의3⑥';
      }
    } else if (/고용/.test(종)) {
      const g = p.고용 || {}, a = n(g.정규직평균비율), b = n(g.총급여평균비율);
      if (a && b) { if (a < 70 && b < 70) { 액 = 남; 왜 = '5년 평균 정규직 ' + a + '%·총급여 ' + b + '% — 둘 다 70% 미달, 전부'; } else 왜 = '정규직 ' + a + '%·총급여 ' + b + '% — 둘 다 70% 미달일 때만 징수, 없음'; }
      else 왜 = '정규직 수·총급여 5년 평균 비율이 있어야 셈';
      근거 = '§72의2③4호(§18의2⑤4호, 90%를 70%로)';
    } else if (/사망/.test(종)) {
      액 = 남; 왜 = '상속인 사망 — 전부'; 근거 = '§72의2③5호';
      if (jmYn_(x.다음상속인공제) === true) 다시 = true;
    } else if (/담보|징수불능/.test(종)) { 액 = 남; 왜 = (/담보/.test(종) ? '담보 명령 안 따름' : '국세징수법 §9① 사유로 전액 징수 못 할 우려') + ' — 전부 또는 일부(세무서 재량)'; 근거 = '§72의2⑤·시행령 §69의3⑨'; }
    else 왜 = '사유 종류 모름(처분·종사·휴폐업·지분·고용·사망·담보·징수불능)';
    액 = Math.min(액, 남); 남 -= 액;
    const iz = 이자(액, 일), 기한 = 일 ? 말일더하기(일, 6) : '';
    const 줄 = { 일: 일, 종류: 종, 징수세액: 액, 이자상당액: iz.이자, 합계: 액 + iz.이자, 왜: 왜, 근거: 근거, 신고납부기한: 액 && !/담보|징수불능/.test(종) ? 기한 : undefined, 이자줄: iz.줄 };
    if (다시 && 액) { 줄.다시유예 = /지분/.test(종) ? '수증자가 조특법 §30의6 특례·§30의7 유예를 받으면 이 세액·이자도 다시 유예 신청 가능(§72의2⑥1호) — 그 뒤 이자는 50%' : '다음 상속인이 가업상속공제·납부유예를 받으면 다시 유예 신청 가능(§72의2⑥2호) — 그 뒤 이자는 50%(시행령 §69의3⑦)'; }
    징수줄.push(줄);
    if (액 && !/담보|징수불능/.test(종)) 할일.push({ 무엇: 종 + ' 사유 신고·납부(납부유예 사후관리추징사유 신고 및 자진납부 계산서) ' + won(액 + iz.이자) + '원', 때: 기한, 근거: '§72의2④·시행령 §69의3⑧' });
  });
  // 4) 경우 — 유예 고른 뒤 사유별 결과, 공제와 견줄 엔진칸 안내
  const 낸 = 징수줄.reduce(function (s, x) { return s + (x.합계 || 0); }, 0);
  경우.push({ 이름: '① 납부유예 — 지금 안 내는 상속세', 유예세액: 유예, 신고때낼세액: 납부 - 유예 });
  if (징수줄.length) 경우.push({ 이름: '② 사유가 생겨 낼 돈(세액 + 이자)', 합계: 낸, 남은유예세액: 남 });
  notes.push('가업상속공제(§18의2)와 견줄 것: 공제는 상속세 과세가액에서 빼고(최대 600억), 사후관리는 5년 — 유예는 세액을 미룰 뿐 사라지지 않고 지분 감소·처분·사망 때까지 계속 따라감(종사는 5년 한정, 휴폐업은 언제든). 공제 쪽은 판정 묶음 「가업상속」과 상속세 엔진칸(가업상속공제 칸)으로 셈');
  notes.push('이자율은 사유가 생긴 때의 국세환급가산금 이자율 ÷ 365, 기간 중 바뀌면 바뀌기 전 기간은 그때 이율(시행령 §69의3⑦3호) — 엔진 이자 계산(method split)과 같은 셈');
  if (반 < 1) notes.push('다시 받은 유예(§72의2⑥)라 이자율 × 50%(시행령 §69의3⑦)');
  notes.push('세무서는 해마다 사유가 생겼는지 확인(시행령 §69의3⑩) — 해마다 지분·종사·고용 자료를 챙길 것');
  notes.push('조특법 §30의7(가업승계 증여세 납부유예)은 같은 짜임이지만 증여세 쪽 — 이 묶음은 상속세(§72의2)만 셈(§30의7은 증여세 쪽 별도 조문 — 이 도구 범위 밖, 원문 확인 2026-11-04)');
  const 안됨 = 공제받음 || jmYn_(p.중소기업) === false;
  const 결 = 안됨 ? '납부유예 못 함 — ' + (공제받음 ? '가업상속공제(영농상속공제)를 받음(§72의2①2호)' : '중소기업 아님(§72의2①1호)') + (유예 ? ' · 유예했다면 ' + won(유예) + '원' : '') : (유예 ? '납부유예 ' + won(유예) + '원(납부세액 ' + won(납부) + ' × 가업 ' + won(가업) + ' ÷ 총 ' + won(총) + ')' : '유예 금액 못 셈') + (징수줄.length ? ' · 사유 ' + 징수줄.length + '건 징수 ' + won(낸) + '원(이자 포함) · 남은 유예 ' + won(남) + '원' : '');
  return jmWrap_('납부유예', reqs, { 적용: !안됨, 결론: 결, 기준일: today, 신고기한: 신고기한, 유예세액: 유예, 징수: 징수줄, 남은유예세액: 남, 경우: 경우, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 102 「한씨 아버지가 집을 팔고 돌아가심」] 상속으로 인한 납세의무 승계(국세기본법 §24·시행령 §11·§12) — 피상속인이 판 재산의 양도소득세를 누가·언제·얼마까지
//  거래마다 양도시기(잔금일·등기접수일 중 빠른 날, 소득세법 시행령 §162①1·2호)가 사망 전이면 피상속인 양도 → 상속인이 승계(상속받은 재산 한도), 사망 뒤면 상속인 양도(취득가액은 상속개시일 평가액, 시행령 §163⑨).
//  상속인별 몫은 민법 상속분, 수유자·포기자·유류분·보험금이 있으면 받은 재산 비율(시행령 §11④), 받은 재산 = 자산 − (부채 + 상속세)(§11①). 포기·한정승인자가 받은 보험금은 받은 재산(§24②1호).
//  승계 세금은 상속세 공과금으로 뺌(상증법 §14①1호·시행령 §9①). 대표자 신고 30일(시행령 §12), 확정신고 상속개시 달 말일부터 6개월(소득세법 §118·§74①).
//  p: { 상속개시일, 거래:[{ 이름, 잔금일, 등기일, 양도가액, 받은대금(사망 전 받은 계약금·중도금 등), 양도세(엔진으로 셈한 세액 — 지방소득세 빼고), 신고(예) }], 체납:[{ 세목, 금액 }],
//       상속인:[{ 이름, 상속분(분수 '3/7' 또는 %), 자산, 부채, 상속세, 포기(예), 한정승인(예), 수유자(예), 유류분(예), 보험금 }], 기준일 }
function judgeSuccession_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR'); };
  const 말일더하기 = function (d, m) { const t = new Date(d); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1 + m, 0)).toISOString().slice(0, 10); };
  const 분수 = function (v) { const s = String(v == null ? '' : v).trim(); const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/); if (m) return Number(m[1]) / Number(m[2]); const x = famNum_(s.replace('%', '')); return x > 1 ? x / 100 : x; };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const 개시 = jmYmd_(p.상속개시일);
  reqs.push(jmReq_('상속개시일', 개시 ? true : null, 개시 || '없음 — 사망 전후를 가를 수 없음', '국세기본법 §24①'));
  const 확정기한 = 개시 ? 말일더하기(개시, 6) : '';
  // 1) 거래마다 누구 양도인가
  const 거래줄 = []; let 승계양도세 = 0, 미수채권 = 0;
  [].concat(p.거래 || []).forEach(function (x) {
    const 잔 = jmYmd_(x.잔금일), 등 = jmYmd_(x.등기일);
    const 시기 = [잔, 등].filter(Boolean).sort()[0] || '';
    const 줄 = { 이름: x.이름 || '', 양도시기: 시기 || '?', 근거: '소득세법 §98·시행령 §162①1·2호(대금청산일과 등기접수일 중 빠른 날) — 장기할부·허가구역 등은 판정 묶음 「양도시기」로' };
    if (!시기 || !개시) { 줄.누구 = '?'; 줄.왜 = '양도시기나 상속개시일을 모름'; 거래줄.push(줄); return; }
    const 가 = n(x.양도가액), 받 = n(x.받은대금), 세 = n(x.양도세);
    if (시기 <= 개시) {
      줄.누구 = '피상속인 양도 — 상속인이 납세의무 승계';
      const 예정 = 말일더하기(시기, 2);
      줄.예정신고기한 = 예정; 줄.확정신고기한 = 확정기한;
      if (jmYn_(x.신고) === true) 줄.왜 = '피상속인이 이미 신고 — 남은 세액·가산세만 승계';
      else if (예정 < 개시) 줄.왜 = '예정신고기한(' + 예정 + ')이 사망 전에 지났는데 신고 안 함 — 무신고 가산세·납부지연까지 승계(국세기본법 §24①: 부과되거나 납부할 국세)';
      else 줄.왜 = '사망 때 예정신고기한(' + 예정 + ')이 남아 있음 — 상속인이 신고 [확인 필요 — 권장: ①§74는 「과세표준확정신고의 특례」라 예정신고 기한은 §105① 그대로(연장 없음) ②§118①이 양도소득세 전반에 §74를 준용하므로 예정신고도 6개월로 읽는 해석 — 권장 ①(빠른 날), 가산세 위험 최소]';
      줄.양도세 = 세 || undefined;
      if (세) 승계양도세 += 세; else 줄.빈칸 = '양도세 — 넥스 양도 도구(엔진)로 피상속인을 양도인으로 먼저 셈';
      const 미수 = 가 && 받 < 가 ? 가 - 받 : 0;
      if (미수 && 잔 && 잔 > 개시) { 줄.미수잔금 = 미수; 미수채권 += 미수; }
      else if (가 && 받 < 가 && (!잔 || 잔 > 개시)) { 줄.미수잔금 = 가 - 받; 미수채권 += 가 - 받; }
      if (줄.미수잔금) 줄.상속재산 = '등기가 먼저 넘어가 사망 때 받지 못한 잔금 ' + won(줄.미수잔금) + '원은 상속재산(받을 채권)';
      할일.push({ 무엇: (x.이름 || '양도') + ' 피상속인 명의 양도소득세 신고·납부(상속인 연명 또는 대표자)', 때: 예정 >= 개시 && 예정 < 확정기한 ? 예정 : 확정기한, 근거: '소득세법 §105①·§118·§74①' });
    } else {
      줄.누구 = '상속인 양도 — 계약은 피상속인이 했지만 양도시기가 사망 뒤';
      줄.왜 = '상속인이 양도자. 취득가액은 상속개시일 현재 상속세 평가액(소득세법 시행령 §163⑨) — 평가기간(상속개시일 전후 6개월) 안 매매가액이면 시가가 되어 양도차익이 거의 없음(상증법 §60②·시행령 §49①)';
      줄.상속재산 = 가 ? '상속재산 가액 [확인 필요 — 권장: ①부동산은 매매가액(시가) 전액으로 넣고 받은 계약금·중도금은 현금 자산 + 같은 금액을 선수금 채무로 공제 ②부동산을 (매매가액−받은 대금)으로 평가 — 과세가액은 같아지나 서식 기재가 다름, 권장 ①]' : undefined;
      줄.양도세 = 0;
      줄.신고 = { 예정신고기한: 말일더하기(시기, 2), 근거: '상속인 각자 지분만큼 양도(공동상속이면 지분별 신고)' };
      할일.push({ 무엇: (x.이름 || '양도') + ' 상속인 이름 양도소득세 예정신고(취득가액 = 상속 평가액)', 때: 말일더하기(시기, 2), 근거: '소득세법 §105①1호' });
    }
    거래줄.push(줄);
  });
  const 체납 = [].concat(p.체납 || []).reduce(function (s, x) { return s + n(x.금액); }, 0);
  const 승계 = 승계양도세 + 체납;
  // 2) 상속인별 받은 재산·몫(§24③·시행령 §11)
  const 사람 = [].concat(p.상속인 || []);
  const 특수 = 사람.some(function (h) { return jmYn_(h.수유자) === true || jmYn_(h.포기) === true || jmYn_(h.유류분) === true || n(h.보험금) > 0; });
  const 줄들 = 사람.map(function (h) {
    const 포기 = jmYn_(h.포기) === true, 한정 = jmYn_(h.한정승인) === true;
    let 받은 = Math.max(0, n(h.자산) - n(h.부채) - n(h.상속세));
    if (포기) 받은 = 0;
    const 보험 = n(h.보험금);
    if (보험 && (포기 || 한정)) 받은 += 보험;
    else if (보험 && n(h.체납일수) && n(h.납입일수)) 받은 += Math.floor(보험 * Math.min(1, n(h.체납일수) / n(h.납입일수)));
    return { 이름: h.이름 || '', 상속분: 분수(h.상속분), 받은재산: 받은, 포기: 포기 || undefined, 한정승인: 한정 || undefined, 보험금: 보험 || undefined };
  });
  const 합 = 줄들.reduce(function (s, x) { return s + x.받은재산; }, 0);
  줄들.forEach(function (x) {
    x.비율 = 특수 ? (합 ? x.받은재산 / 합 : 0) : x.상속분;
    x.비율근거 = 특수 ? '받은 재산 ÷ 합계(시행령 §11④ — 수유자·포기자·유류분·보험금이 있음)' : '민법 상속분(§24③ 본문)';
    x.몫 = Math.floor(승계 * x.비율);
    x.한도 = x.받은재산;
    x.낼세금 = Math.min(x.몫, x.한도);
    x.넘는부분 = x.몫 - x.낼세금 > 0 ? x.몫 - x.낼세금 : undefined;
  });
  const 한도합 = 합, 결손 = Math.max(0, 승계 - 한도합);
  if (사람.length) {
    reqs.push(jmReq_('상속인별 몫과 받은 재산 한도', true, '각자 몫까지, 받은 재산 한도 안에서 연대 납부(§24③) — 한 사람이 낼 수 있는 최대는 자기 받은 재산', '국세기본법 §24③·시행령 §11'));
    할일.push({ 무엇: '상속인 대표자 신고(성명·주소) — 안 하면 세무서가 지정', 때: 개시 ? famAddD_(개시, 30) : '', 근거: '국세기본법 §24③ 후단·시행령 §12' });
  }
  if (줄들.some(function (x) { return x.포기 && x.보험금; })) notes.push('상속을 포기한 사람이 받은 보험금(상증법 §8)은 상속받은 재산으로 보아 승계 세금을 냄(§24②1호, 포기자도 상속인으로 봄)');
  if (줄들.some(function (x) { return !x.포기 && !x.한정승인 && x.보험금; })) notes.push('포기·한정승인하지 않은 상속인의 보험금은 피상속인이 체납 중에 보험료를 낸 경우만 체납 일수 비율로 받은 재산에 넣음(§24②2호) — 상속인 줄에 체납일수·납입일수(최초~마지막 보험료 납입 기간)를 넣으면 보험금 × 체납일수 ÷ 납입일수를 받은 재산에 더함, 없으면 넣지 않음');
  const 넘침 = 줄들.reduce(function (s, x) { return s + (x.넘는부분 || 0); }, 0);
  if (넘침 && !결손) notes.push('몫이 받은 재산보다 큰 상속인이 있어 그 넘는 ' + won(넘침) + '원은 그 사람이 내지 않지만, 다른 상속인이 자기 받은 재산 한도 안에서 연대하여 낼 수 있음(§24③ 연대 납부) [확인 필요 — 권장: 문언 「나누어 계산한 국세를 … 받은 재산의 한도에서 연대」 — ①각자 받은 재산 한도 안에서 전체(남의 몫 포함) 연대 ②자기 몫만 — 권장 ①(연대의 뜻), 집행 사례 필요]');
  if (결손) notes.push('승계 세금 ' + won(승계) + '원이 상속인들이 받은 재산 합계 ' + won(한도합) + '원보다 큼 — 넘는 ' + won(결손) + '원은 상속인이 내지 않음(§24① 한도)');
  // 3) 상속세 쪽
  if (승계) notes.push('승계한 세금 ' + won(승계) + '원은 상속세 과세가액에서 공과금으로 뺌(상증법 §14①1호·시행령 §9①: 상속개시일 현재 피상속인이 낼 의무가 있는 조세) — 판정 묶음 「상속채무」·상속세 엔진칸 공과금에 넣을 것. 사망 뒤 상속인이 판 재산의 양도세는 상속인 자기 세금이라 빼지 않음');
  if (미수채권) notes.push('사망 전 등기가 넘어가고 못 받은 잔금 ' + won(미수채권) + '원은 상속재산(채권)으로 더함');
  notes.push('피상속인 양도대금을 사망 전 1년 2억·2년 5억 넘게 쓰고 쓴 곳을 밝히지 못하면 상속 추정(상증법 §15①1호) — 판정 묶음 「상속채무」·상속세 엔진 처분재산 칸');
  notes.push('피상속인에게 한 결정·고지·독촉은 승계한 상속인에게도 효력(§24⑥) — 사망 전 피상속인에게 나온 고지서·독촉은 상속인에게 다시 하지 않아도 그대로 효력');
  경우.push({ 이름: '① 승계 세금 나누기', 승계세금: 승계, 양도세: 승계양도세, 체납: 체납, 상속인별: 줄들.map(function (x) { return { 이름: x.이름, 낼세금: x.낼세금 }; }) });
  if (승계) 경우.push({ 이름: '② 상속세 공과금 공제', 공과금: 승계, 엔진칸뜻: '상속세 계산기 taxableEstateAmount(과세가액)를 정할 때 재산에서 이 공과금을 뺌 — 판정 묶음 「상속채무」 공과금 줄에 넣으면 같이 셈' });
  const 결 = (거래줄.length ? 거래줄.map(function (x) { return (x.이름 || '거래') + ' ' + (/^피상속인/.test(x.누구 || '') ? '피상속인 양도' : /^상속인/.test(x.누구 || '') ? '상속인 양도' : '?'); }).join(' · ') + ' — ' : '') + '승계 세금 ' + won(승계) + '원' + (줄들.length ? '(' + 줄들.map(function (x) { return x.이름 + ' ' + won(x.낼세금); }).join(', ') + ')' : '') + (결손 ? ' · 한도 넘어 안 냄 ' + won(결손) + '원' : '');
  return jmWrap_('납세의무승계', reqs, { 적용: true, 결론: 결, 기준일: today, 확정신고기한: 확정기한 || undefined, 거래: 거래줄, 승계세금: 승계, 상속인별: 줄들, 결손: 결손, 미수잔금채권: 미수채권, 경우: 경우, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 103 「서씨 딱지와 조합원 지위」] 부동산을 취득할 수 있는 권리(소득세법 §94①2호가목)를 셋으로 가름 — 분양권·조합원입주권·그 밖의 취득 권리
//  분양권 = 시행령 §152의5 법률(건축물분양법·공공주택특별법·도시개발법·도시정비법·소규모주택정비법·산업입지법·주택법·택지개발촉진법)에 따른 「주택」 공급계약으로 공급받는 자로 선정된 지위(§88 10호).
//  조합원입주권 = 도시정비법·소규모주택정비법 관리처분계획 인가 등으로 취득한 입주자 지위(§88 9호) — 엔진은 주택(house)과 같은 세율 길.
//  그 밖(이주자택지·협의양도인택지 공급권, 상가·오피스텔 분양 지위 등 주택 아닌 것) = 2호가목 일반 권리: 세율 §104①1·2·3호(2년 이상 기본세율·1~2년 40%·1년 미만 50%),
//  장기보유특별공제 없음(§95② — 1호 자산과 2호가목 중 조합원입주권만), 개산공제 1%(시행령 §163⑥4호 — 그 밖의 자산). 분양권은 60%(1년 미만 70%), 장특 없음.
//  p: { 권리:[{ 이름, 공급대상(주택|택지|상가|오피스텔|기타), 근거법(주택법·택지개발촉진법·공공주택특별법·도시정비법 등), 지위(분양계약|당첨|조합원|이주자택지|협의양도인택지|원조합원|승계조합원),
//        사업계획승인(예/아니오 — 지역주택조합), 취득일, 양도일, 양도가액, 취득가액, 웃돈(프리미엄), 전매제한(예) }], 기준일 }
function judgeAcquireRight_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR'); };
  const 분양권법 = /건축물의\s*분양|건축물분양|공공주택|도시개발|도시\s*및\s*주거환경|도시정비|소규모주택|빈집|산업입지|주택법|택지개발/;
  const 입주권법 = /도시\s*및\s*주거환경|도시정비|소규모주택|빈집/;
  const reqs = [], notes = [], 할일 = [], 경우 = [], 줄들 = [];
  const list = Array.isArray(p.권리) ? p.권리 : (p.권리 ? [p.권리] : []);
  reqs.push(jmReq_('권리 목록', list.length ? true : null, list.length ? list.length + '건' : '없음 — 권리:[{이름, 공급대상, 근거법, 지위, 취득일, 양도일}]', '소득세법 §94①2호가목'));
  list.forEach(function (r, i) {
    r = r || {};
    const 이름 = r.이름 || ('권리 ' + (i + 1));
    const 대상 = String(r.공급대상 || '');
    const 법 = String(r.근거법 || '');
    const 지위 = String(r.지위 || '');
    const 취득 = jmYmd_(r.취득일), 양도 = jmYmd_(r.양도일);
    const 일수 = 취득 && 양도 ? jmDays_(취득, 양도) : null;
    const 보유 = 취득 && 양도 ? (famAddD_(jmAddM_(취득, 24), -1) < 양도 ? '2년 이상' : famAddD_(jmAddM_(취득, 12), -1) < 양도 ? '1년 이상 2년 미만' : '1년 미만') : '';
    let 종류 = '', 근거 = '', 엔진 = null, 세율 = '', 장특 = '', 잠정 = false;
    const 칸 = { transferPrice: famNum_(r.양도가액) || undefined, acquisitionPrice: famNum_(r.취득가액) || undefined, acquisitionDate: 취득 || undefined, transferDate: 양도 || undefined };
    const 주택공급 = /주택|아파트|공동주택|다세대|연립/.test(대상);
    const 지역조합 = /지역주택조합|직장주택조합/.test(법 + 지위 + 이름);
    if (/조합원/.test(지위) && 입주권법.test(법)) {
      종류 = '조합원입주권'; 근거 = '소득세법 §88 9호(도시정비법·소규모주택정비법)';
      엔진 = Object.assign({ assetType: 'house' }, 칸);
      세율 = '주택과 같음 — 1년 미만 70%·1~2년 60%·2년 이상 기본세율(§104①1~3호)';
      장특 = /승계/.test(지위) ? '승계조합원: 장기보유특별공제 없음(§95② — 원조합원의 관리처분계획 인가 전 차익만)' : '원조합원: 관리처분계획 인가 전 종전 부동산 보유분 차익만 장기보유특별공제(§95②) — 인가일·권리가액을 따로 넣어 엔진 조합원입주권 계산 길로 셈 (원문 확인 2026-11-04: 소득세법 §95② 괄호)';
      할일.push(이름 + ': 관리처분계획 인가일·권리가액·청산금을 받아 둘 것(원조합원 장특·주택 수 판정)');
    } else if (지역조합 && !/분양계약|당첨/.test(지위)) {
      종류 = '지역주택조합 조합원 지위 — 분양권인지 원문에 결론 없음';
      근거 = '소득세법 §88 10호·시행령 §152의5(주택법은 분양권 근거법) [판단 대기 — 판단거리3차 #20: ①사업계획승인·동호수 배정·공급계약 뒤면 분양권 ②조합 가입 단계는 그 밖의 권리(§94①2호가) — 권장: 공급계약 체결 여부로 가름, 두 경우 나란히]';
      잠정 = true;
      const A = Object.assign({ assetType: 'presale_right' }, 칸), B = Object.assign({ assetType: 'other', rightOrOtherKind: 'acquire_right' }, 칸);
      엔진 = /^예|^y|승인/i.test(String(r.사업계획승인 || '')) ? A : B;
      세율 = '경우 ① 분양권으로 보면 60%(1년 미만 70%) · 경우 ② 그 밖의 권리로 보면 ' + (보유 === '2년 이상' ? '기본세율' : 보유 === '1년 미만' ? '50%' : '40%');
      장특 = '어느 쪽이든 장기보유특별공제 없음(§95②)';
      경우.push({ 이름: 이름 + ' ① 분양권으로 봄', 엔진칸: A });
      경우.push({ 이름: 이름 + ' ② 그 밖의 취득 권리로 봄', 엔진칸: B });
      notes.push(이름 + ': 사업계획승인' + (r.사업계획승인 ? '(' + r.사업계획승인 + ')' : ' 여부 모름') + ' — 승인 뒤 동·호수 배정·공급계약이 있으면 분양권 쪽, 승인 전 조합 가입 단계면 그 밖의 권리 쪽으로 잠정. 두 경우를 함께 보이고 세무사님 판단 [판단 대기 — 판단거리3차 #21: 같음 — 세무사님 판단]');
      할일.push(이름 + ': 조합 가입계약서·사업계획승인일·동호수 배정 여부·공급계약서를 받을 것');
    } else if (주택공급 && (분양권법.test(법) || !법)) {
      종류 = '분양권'; 근거 = '소득세법 §88 10호·시행령 §152의5' + (법 ? '' : ' (근거법 빈칸 — 잠정)');
      잠정 = !법;
      엔진 = Object.assign({ assetType: 'presale_right' }, 칸);
      세율 = '1년 미만 70%·1년 이상 60%(§104①1·2·3호 단서 — 보유기간 2년 넘어도 기본세율 아님)';
      장특 = '장기보유특별공제 없음(§95②)';
      notes.push(이름 + ': 분양권은 1세대 주택 수에 들어갈 수 있음(§89②·§104⑦ — 2021-01-01 이후 취득한 분양권부터, 소득세법 부칙 법률 제17477호 §4 원문 확인 2026-11-04)' + (취득 && 취득 < '2021-01-01' ? ' — 이 분양권은 그 전(' + 취득 + ') 취득이라 주택 수에 넣지 않음' : '') + '. 같은 세대가 집을 팔 때 판정 묶음 「중과판정」·「1세대1주택」과 함께 볼 것');
    } else {
      종류 = '그 밖의 부동산을 취득할 수 있는 권리(분양권·조합원입주권 아님)';
      근거 = '소득세법 §94①2호가목' + (/택지/.test(대상 + 지위) ? ' — 택지(토지) 공급이라 「주택」 공급계약 지위가 아님(§88 10호)' : '');
      엔진 = Object.assign({ assetType: 'other', rightOrOtherKind: 'acquire_right' }, 칸);
      세율 = 보유 === '2년 이상' ? '기본세율(§104①1호)' : 보유 === '1년 미만' ? '50%(§104①3호)' : 보유 ? '40%(§104①2호)' : '보유기간 모름';
      장특 = '장기보유특별공제 없음(§95② — 2호가목 중 조합원입주권만 공제)';
      if (!대상) { 잠정 = true; notes.push(이름 + ': 공급대상(주택·택지·상가) 빈칸 — 그 밖의 권리로 잠정, 주택이면 분양권으로 바뀌어 60%·주택 수 포함'); }
    }
    if (엔진 && 엔진.assetType === 'other' && !칸.acquisitionPrice) notes.push(이름 + ': 취득가액 빈칸 — 환산하면 개산공제는 1%(시행령 §163⑥4호). 토지처럼 3%를 쓰지 않도록 엔진칸에 rightOrOtherKind acquire_right를 꼭 넣을 것');
    if (/^예|^y/i.test(String(r.전매제한 || ''))) notes.push(이름 + ': 전매제한 기간 안 양도 — 공급 계약이 취소되거나 무효가 될 수 있고, 무효면 양도 자체가 없던 것이 되어 판정 「계약해제」·「양도여부」로 다시 볼 것 [실사건 때 확인: 근거법 전매제한 조문]');
    if (famNum_(r.웃돈)) notes.push(이름 + ': 웃돈(프리미엄) ' + won(r.웃돈) + '원은 양도가액에 들어감 — 다운계약이면 신고 불성실(실지거래가액, §96①). 산 사람의 나중 취득가액도 웃돈 포함');
    reqs.push(jmReq_(이름 + ' 종류', 잠정 ? null : true, 종류, 근거));
    줄들.push({ 이름: 이름, 종류: 종류, 보유: 보유 || undefined, 보유일수: 일수 == null ? undefined : 일수, 세율: 세율, 장기보유특별공제: 장특, 근거: 근거, 잠정: 잠정 || undefined, 엔진칸: 엔진 });
    if (엔진 && !경우.some(function (k) { return k.이름.indexOf(이름 + ' ') === 0; })) 경우.push({ 이름: 이름, 엔진칸: 엔진 });
    if (양도) 할일.push(이름 + ': 예정신고 기한 ' + new Date(Date.UTC(+양도.slice(0, 4), +양도.slice(5, 7) + 2, 0)).toISOString().slice(0, 10) + '(양도일이 속한 달 말일부터 2개월, §105①1호)');
  });
  if (list.length) notes.push('권리 자체는 등기하는 자산이 아니어서 미등기양도자산(§104③ 70%)으로 보지 않음 — 시행령 §168①2호(법률상 등기 불가) 취지. 권리가 아니라 이미 등기할 수 있게 된 토지·건물을 등기 없이 팔면 판정 「미등기」로 볼 것 [판단 대기 — 판단거리3차 #22: ①권리는 등기 대상 자체가 아니라 「등기를 하지 아니하고 양도」에 해당 안 함(권장) ②§104③ 문언상 2호 자산도 대상 — 권장 ①, 실무 확립]');
  const 결 = 줄들.map(function (x) { return x.이름 + ' ' + x.종류.replace(/ —.*$/, '') + (x.잠정 ? '(잠정)' : '') + ' · ' + x.세율.replace(/ —.*$/, ''); }).join(' / ') || '권리 없음';
  return jmWrap_('부동산권리', reqs, { 적용: list.length > 0, 결론: 결, 기준일: today, 권리별: 줄들, 경우: 경우, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 104 「설씨 경매로 잃은 집·경매로 산 상가」] 경매·공매 — 넘어간 쪽(양도)과 낙찰받은 쪽(취득)을 함께 가름
//  양도: 경매·공매도 유상이전(대가 = 채무의 감소, 집행기준 88-0-2) · 본인 자산을 경매로 자기가 다시 취득하면 양도 아님(집행기준 88-152-3 표) ·
//        양도·취득시기 = 매각대금 완납일(소득세법 §98·시행령 §162①, 집행기준 표 「경락에 의한 자산 취득 — 경매대금을 완납한 날」) ·
//        비사업용 토지 기간기준의 양도일 = 최초 경매기일·최초 공매일(시행령 §168의14②1·2호, 집행기준 104의3-168의14-25).
//  취득: 취득가액 = 낙찰가 + 취득세 등 부대비용(시행령 §163①1호) · 대항력 있는 보증금을 떠안고 구상할 수 없으면 필요경비(집행기준 97-163-15, 대항력 있는 임차인이 경락받아 못 받은 보증금 포함) ·
//        민사집행법상 유치권자에게 변제한 채권액은 필요경비(97-163-16) · 법적 지급의무 없는 유치권 합의금은 아님(97-163-17) · 명도비용은 취득가액 아님(97-163-18) · 이자 아님(97-163-19) ·
//        채권자가 강제경매로 채무자 토지를 취득하면 「채권 변제를 받기 위해 취득한 토지」(2년 비사업용 아님)가 아님(집행기준 104의3-168의14-19).
//  p: { 양도:[{ 이름, 자산(주택|토지|상가|그밖), 방식(임의경매|강제경매|공매), 낙찰자(남|본인), 소유자지위(채무자|물상보증인), 최초경매기일, 매각허가일, 대금완납일, 매각대금, 배당받은금액, 취득일, 취득가액, 필요경비, 1세대1주택(예) }],
//       취득:[{ 이름, 자산, 방식, 대금완납일, 낙찰가, 취득세등, 인수보증금, 보증금구상(가능|불가), 유치권변제, 유치권합의금, 명도비, 이자, 채권자로서취득(예), 양도일, 양도가액 }], 기준일 }
function judgeAuction_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [], 양도줄 = [], 취득줄 = [];
  const 양도들 = Array.isArray(p.양도) ? p.양도 : (p.양도 ? [p.양도] : []);
  const 취득들 = Array.isArray(p.취득) ? p.취득 : (p.취득 ? [p.취득] : []);
  const 자산칸 = function (a) { return /주택|아파트|빌라|다세대/.test(String(a || '')) ? 'house' : 'other'; };
  const 기한 = function (d) { return new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) + 2, 0)).toISOString().slice(0, 10); };
  reqs.push(jmReq_('경매 목록', (양도들.length + 취득들.length) ? true : null, '넘어간 것 ' + 양도들.length + '건 · 낙찰받은 것 ' + 취득들.length + '건', '소득세법 §88 1호·집행기준 88-0-2'));

  양도들.forEach(function (r, i) {
    r = r || {};
    const 이름 = r.이름 || ('넘어간 자산 ' + (i + 1));
    const 공매 = /공매/.test(String(r.방식 || ''));
    const 완납 = jmYmd_(r.대금완납일), 첫기일 = jmYmd_(r.최초경매기일), 허가 = jmYmd_(r.매각허가일);
    let 양도임 = true, 잠정 = false, 근거 = '경매·공매도 유상이전 — 대가는 채무의 감소(소득세법 §88 1호, 집행기준 88-0-2)';
    if (/본인/.test(String(r.낙찰자 || ''))) { 양도임 = false; 근거 = '본인 소유 자산을 경매로 자기가 다시 취득 — 양도로 보지 않음(집행기준 88-152-3 표)'; }
    if (양도임 && /물상보증/.test(String(r.소유자지위 || ''))) {
      잠정 = true;
      notes.push(이름 + ': 남의 빚 담보(물상보증인)로 넘어간 경우 — 집행기준에서 따로 정한 원문을 못 찾음. 매각대금으로 남의 빚이 갚아져 구상권이 생기므로 유상이전으로 보는 쪽으로 잠정 [판단 대기 — 판단거리3차 #23: ①매각대금으로 타인 채무가 소멸하고 구상권이 생기므로 양도(권장) ②구상권 회수 불능이어도 양도가액은 매각대금(대손은 별개) — 예규로 확인]. 구상권을 실제로 받을 수 없게 된 사정은 양도가액을 줄이지 않는지도 [판단 대기 — 판단거리3차 #23: ①매각대금으로 타인 채무가 소멸하고 구상권이 생기므로 양도(권장) ②구상권 회수 불능이어도 양도가액은 매각대금(대손은 별개) — 예규로 확인]');
    }
    const 칸 = { assetType: 자산칸(r.자산), transferPrice: famNum_(r.매각대금) || undefined, transferDate: 완납 || undefined, acquisitionPrice: famNum_(r.취득가액) || undefined, acquisitionDate: jmYmd_(r.취득일) || undefined, necessaryExpenses: famNum_(r.필요경비) || undefined };
    if (/^예|^y/i.test(String(r['1세대1주택'] || ''))) 칸.isOneHouseOneFamily = true;
    if (!완납) { 잠정 = true; notes.push(이름 + ': 매각대금 완납일 빈칸 — 양도시기는 완납일(시행령 §162①). 매각허가일' + (허가 ? '(' + 허가 + ')' : '') + '이 아님. 법원 「배당표」·「대금완납증명」으로 확인'); 할일.push(이름 + ': 경매 사건번호로 대금완납일·매각대금·배당표를 받을 것'); }
    if (양도임) {
      if (r.배당받은금액 != null && r.배당받은금액 !== '' && !/물상보증/.test(String(r.소유자지위 || '')) && famNum_(r.매각대금) && famNum_(r.배당받은금액) < famNum_(r.매각대금)) notes.push(이름 + ': 손에 쥔 돈(배당 ' + won(r.배당받은금액) + '원)이 적어도 양도가액은 매각대금 ' + won(r.매각대금) + '원 — 나머지는 채권자에게 가서 내 빚이 줄었으므로(집행기준 88-0-2 「채무의 감소」). 세금을 낼 돈이 없을 수 있으니 미리 알림');
      if (/토지|땅|임야|농지|대지/.test(String(r.자산 || ''))) notes.push(이름 + ': 비사업용 토지 판정의 기간기준은 양도일 대신 ' + (공매 ? '최초 공매일' : '최초 경매기일') + (첫기일 ? '(' + 첫기일 + ')' : '(빈칸)') + '로 셈(시행령 §168의14②' + (공매 ? '2' : '1') + '호) — 판정 「비사업용 토지」에 그 날을 양도일로 넣을 것. 세율·장기보유특별공제의 보유기간은 그대로 완납일까지');
      if (칸.assetType === 'house') notes.push(이름 + ': 경매로 넘어간 집도 1세대1주택 비과세가 됨(양도 원인 제한 없음, 소득세법 §89①3호) — 판정 「1세대1주택」을 함께 볼 것');
      if (완납) 할일.push(이름 + ': 예정신고 기한 ' + 기한(완납) + '(완납일이 속한 달 말일부터 2개월, §105①1호) — 경매로 넘어가 신고를 놓치기 쉬움(무신고 가산세 국세기본법 §47의2)');
      경우.push({ 이름: 이름 + ' 양도', 엔진칸: 칸 });
    }
    reqs.push(jmReq_(이름 + ' 양도인가', 잠정 ? null : true, 양도임 ? '양도' + (잠정 ? '(잠정)' : '') : '양도 아님', 근거));
    양도줄.push({ 이름: 이름, 양도: 양도임, 잠정: 잠정 || undefined, 양도시기: 완납 || undefined, 비사업용기간_양도일: 첫기일 || undefined, 양도가액: famNum_(r.매각대금) || undefined, 근거: 근거, 엔진칸: 양도임 ? 칸 : null });
  });

  취득들.forEach(function (r, i) {
    r = r || {};
    const 이름 = r.이름 || ('낙찰받은 자산 ' + (i + 1));
    const 완납 = jmYmd_(r.대금완납일);
    const 낙찰 = famNum_(r.낙찰가) || 0, 부대 = famNum_(r.취득세등) || 0, 보증 = famNum_(r.인수보증금) || 0, 유치 = famNum_(r.유치권변제) || 0;
    const 합의 = famNum_(r.유치권합의금) || 0, 명도 = famNum_(r.명도비) || 0, 이자 = famNum_(r.이자) || 0;
    const 구상불가 = /불가|없|아니/.test(String(r.보증금구상 || ''));
    const 넣음 = [], 뺌 = [];
    let 인정 = 낙찰 + 부대;
    넣음.push('낙찰가 ' + won(낙찰) + '원(시행령 §163①1호)'); if (부대) 넣음.push('취득세 등 ' + won(부대) + '원');
    if (보증) {
      if (구상불가) { 인정 += 보증; 넣음.push('떠안은 대항력 보증금 ' + won(보증) + '원(구상 불가 — 집행기준 97-163-15)'); }
      else if (r.보증금구상) 뺌.push('떠안은 보증금 ' + won(보증) + '원 — 전 소유자에게 구상할 수 있으면 필요경비 아님(97-163-15)');
      else { 뺌.push('떠안은 보증금 ' + won(보증) + '원 — 구상 가능 여부 모름(잠정 뺌)'); 할일.push(이름 + ': 떠안은 보증금을 전 소유자에게 받을 수 있는지(구상) 확인 — 받을 수 없으면 필요경비(97-163-15)'); }
    }
    if (유치) { 인정 += 유치; 넣음.push('민사집행법상 유치권자에게 갚은 채권 ' + won(유치) + '원(97-163-16)'); }
    if (합의) 뺌.push('지급 의무 없는 유치권 합의금 ' + won(합의) + '원(97-163-17)');
    if (명도) 뺌.push('명도비 ' + won(명도) + '원 — 소유권 확보 직접비용 아님(97-163-18)');
    if (이자) 뺌.push('낙찰 대출 이자·지연 이자 ' + won(이자) + '원(97-163-19)');
    const 다 = 인정 + 합의 + 명도 + 이자 + (구상불가 ? 0 : 보증);
    if (/^예|^y/i.test(String(r.채권자로서취득 || ''))) notes.push(이름 + ': 채권자가 강제경매를 신청해 매각허가로 취득한 토지는 「채권 변제를 받기 위해 취득한 토지」(취득 뒤 2년 비사업용 아님)로 보지 않음(집행기준 104의3-168의14-19) — 사업에 쓰지 않으면 처음부터 비사업용 기간');
    if (!완납) 할일.push(이름 + ': 대금완납일 확인 — 취득시기는 완납일(집행기준 「경락에 의한 자산 취득」)');
    취득줄.push({ 이름: 이름, 취득시기: 완납 || undefined, 인정취득가액: 인정, 다넣으면: 다, 넣는것: 넣음, 빼는것: 뺌 });
    reqs.push(jmReq_(이름 + ' 취득가액', 뺌.some(function (x) { return /모름/.test(x); }) ? null : true, won(인정) + '원(넣지 않는 것 ' + won(다 - 인정) + '원)', '시행령 §163①·집행기준 97-163-15~19'));
    const 양도일 = jmYmd_(r.양도일), 양도가 = famNum_(r.양도가액);
    if (양도일 && 양도가) {
      const 기본 = { assetType: 자산칸(r.자산), transferPrice: 양도가, transferDate: 양도일, acquisitionDate: 완납 || undefined };
      경우.push({ 이름: 이름 + ' ① 법대로', 엔진칸: Object.assign({}, 기본, { acquisitionPrice: 인정 }) });
      if (다 !== 인정) 경우.push({ 이름: 이름 + ' ② 쓴 돈 다 넣음(틀린 길)', 엔진칸: Object.assign({}, 기본, { acquisitionPrice: 다 }) });
    }
  });
  if (취득들.length) notes.push('낙찰받은 사람의 취득세 등은 영수증이 있어야 함 — 명도비·합의금·이자는 낸 돈이어도 양도 때 빼지 못하므로, 낙찰가를 정할 때 그만큼 세금이 더 남는다는 것을 미리 알릴 것');
  const 결 = 양도줄.map(function (x) { return x.이름 + ' ' + (x.양도 ? '양도' + (x.잠정 ? '(잠정)' : '') : '양도 아님'); }).concat(취득줄.map(function (x) { return x.이름 + ' 취득가액 ' + won(x.인정취득가액) + '원'; })).join(' / ') || '경매 없음';
  return jmWrap_('경매', reqs, { 적용: (양도들.length + 취득들.length) > 0, 결론: 결, 기준일: today, 넘어간것: 양도줄, 낙찰받은것: 취득줄, 경우: 경우, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 105 「소씨 시골집과 서울 집」] 농어촌주택·고향주택 취득자 과세특례(조특법 §99의4·시행령 §99의4) 요건을 하나씩 가름
//  일반주택은 농어촌주택등 「취득 전에」 보유하던 주택(①본문) · 1호가목 소재지(수도권·도시지역·조정대상지역·토지거래허가구역·관광단지 아닌 읍·면 또는 별표12 시의 동, 접경·인구감소·기회발전특구 단서)
//  · 1호나목/2호다목 가액(취득 당시 기준시가 3억, 한옥 4억 — 증축·부수토지 추가분 포함 시행령 §99의4⑪) · 2호 고향(등록기준지 10년 등재 또는 10년 거주한 시, 시행령 ⑥) · ③ 같은·연접 읍면동(고향은 시) 배제
//  · 3년 보유(당초 취득일부터, 시행령 ⑫) · ④ 3년 전 일반주택 양도 가능 · ⑥ 3년 못 채우면 그 달 말일부터 2개월 안 추징(세액 = 특례 없었으면 낼 §104 세액, 시행령 ⑧; 수용·상속·멸실 예외 ⑨) · ⑦ 과세특례신고서(시행령 ⑩)
//  p: { 종류:'농어촌'|'고향', 일반주택:{취득일, 양도일, 양도가액, 취득가액, 필요경비, 소재지}, 농어촌주택:{취득일, 소재지, 기준시가, 추가취득가액, 한옥, 처분일, 처분사유},
//       소재지:{읍면동('읍'|'면'|'동'), 별표12시, 수도권, 접경지역, 도시지역, 인구감소지역, 조정대상지역, 토지거래허가구역, 관광단지, 기회발전특구}, 고향:{등재10년, 거주10년, 시}, 같은연접, 다른주택, 기준일 }
function judgeRuralHouse_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR'); };
  const yes = function (v) { return v === true || /^(예|y|yes|true|해당|있음)/i.test(String(v == null ? '' : v)); };
  const no = function (v) { return v === false || /^(아니|n|no|false|해당 ?없|없음)/i.test(String(v == null ? '' : v)); };
  const tri = function (v) { return yes(v) ? true : no(v) ? false : null; };
  const 말일2 = function (d) { return new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) + 2, 0)).toISOString().slice(0, 10); };
  const 고향 = /고향/.test(String(p.종류 || ''));
  const 이름 = 고향 ? '고향주택' : '농어촌주택';
  const G = p.일반주택 || {}, R = p.농어촌주택 || {}, L = p.소재지 || {}, H = p.고향 || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const g취득 = jmYmd_(G.취득일), g양도 = jmYmd_(G.양도일), r취득 = jmYmd_(R.취득일), r처분 = jmYmd_(R.처분일);
  const 시작 = 고향 ? '2009-01-01' : '2003-08-01';
  reqs.push(jmReq_('취득기간', r취득 ? (r취득 >= 시작 && r취득 <= '2028-12-31') : null, r취득 ? r취득 + ' 취득(기간 ' + 시작 + '~2028-12-31)' : '취득일 빈칸', '조특법 §99의4① 본문'));
  reqs.push(jmReq_('일반주택을 먼저 보유', g취득 && r취득 ? g취득 < r취득 : null, g취득 && r취득 ? (g취득 < r취득 ? '일반주택 ' + g취득 + ' → ' + 이름 + ' ' + r취득 : '일반주택(' + g취득 + ')을 ' + 이름 + '(' + r취득 + ') 뒤에 취득 — 「그 농어촌주택등 취득 전에 보유하던 다른 주택」이 아님') : '두 취득일 중 빈칸', '조특법 §99의4① 본문'));
  if (!고향) {
    const 지역 = String(L.읍면동 || '');
    const 지역ok = /읍|면/.test(지역) ? true : /동/.test(지역) ? tri(L.별표12시) : null;
    reqs.push(jmReq_('읍·면 또는 별표12 시의 동', 지역ok, 지역 ? 지역 + (/동/.test(지역) ? (지역ok ? ' — 별표12 시의 동' : 지역ok === false ? ' — 별표12 시가 아닌 동' : ' — 별표12 시인지 모름') : '') : '빈칸', '조특법 §99의4①1호가목·시행령 §99의4②·별표12'));
    const 특구 = yes(L.기회발전특구);
    [['수도권', '접경지역', '수도권(접경지역 단서 — 시행령 §99의4③)'], ['도시지역', '인구감소지역', '도시지역(인구감소지역 등 단서 — 시행령 §99의4④)'], ['조정대상지역', '', '조정대상지역'], ['토지거래허가구역', '', '토지거래허가구역'], ['관광단지', '', '관광단지(시행령 §99의4⑤)']].forEach(function (b) {
      const v = tri(L[b[0]]), 단서 = b[1] ? yes(L[b[1]]) : false;
      const ok = 특구 ? true : v === false ? true : v === true ? 단서 : null;
      reqs.push(jmReq_(b[0] + ' 아님', ok, 특구 ? '기회발전특구 — 가목 제한 없음' : v === null ? '모름 — 잠정' : v ? '해당' + (단서 ? ' · 단서(' + b[1] + ')로 빼지 않음' : '') : '아님', '조특법 §99의4①1호가목 — ' + b[2]));
    });
  } else {
    const 연 = (yes(H.등재10년) || yes(H.거주10년)) ? true : (no(H.등재10년) && no(H.거주10년)) ? false : null;
    reqs.push(jmReq_('고향(10년 등재 또는 10년 거주한 시)', 연, 연 ? (yes(H.등재10년) ? '가족관계등록부 등록기준지 10년 이상' : '10년 이상 거주') : 연 === false ? '둘 다 아님' : '모름 — 잠정', '조특법 §99의4①2호가목·시행령 §99의4⑥'));
    reqs.push(jmReq_('시 지역(별표12)', tri(H.별표12시 != null ? H.별표12시 : L.별표12시), (H.시 ? String(H.시) : '시 이름 빈칸') + (tri(H.별표12시 != null ? H.별표12시 : L.별표12시) === null ? ' — 별표12 시인지 별표12시:예/아니오로' : ''), '조특법 §99의4①2호나목·시행령 §99의4⑦'));
    ['수도권', '조정대상지역', '관광단지'].forEach(function (k) { const v = tri(L[k]); reqs.push(jmReq_(k + ' 아님', v === null ? null : !v, v === null ? '모름 — 잠정' : v ? '해당' : '아님', '조특법 §99의4①2호나목')); });
  }
  const 한옥 = yes(R.한옥) && (!r취득 || r취득 >= '2014-01-01');
  const 한도 = 한옥 ? 400000000 : (!g양도 || g양도 >= '2023-01-01') ? 300000000 : 200000000;
  const 가액 = famNum_(R.기준시가), 추가 = famNum_(R.추가취득가액);
  reqs.push(jmReq_('가액 ' + (한도 / 1e8) + '억 이하', 가액 ? (가액 + 추가) <= 한도 : null, 가액 ? '취득 당시 기준시가 ' + won(가액) + (추가 ? ' + 증축·추가 토지 ' + won(추가) : '') + '원' : '기준시가 빈칸', '조특법 §99의4①1호나목·2호다목·시행령 §99의4⑪' + (한도 === 200000000 ? ' (2023년 전 양도 옛 한도 — 취득일별 옛 한도는 엔진 [확인 필요 — 권장: 취득 당시 기준이므로 취득일에 시행 중이던 한도(2억/3억) 적용이 원칙 — 2023 부칙 원문 없어 [확인 필요] 유지])' : '')));
  const 연접 = tri(p.같은연접);
  reqs.push(jmReq_('같은·연접 ' + (고향 ? '시' : '읍·면·동') + ' 아님', 연접 === null ? null : !연접, 연접 === null ? '모름 — 일반주택 ' + (G.소재지 || '?') + ' / ' + 이름 + ' ' + (R.소재지 || '?') : 연접 ? '같은·연접 — 배제' : '아님', '조특법 §99의4③'));
  const 삼년날 = r취득 ? jmAddM_(r취득, 36) : '';
  let 보유 = null, 보유말 = '';
  if (r취득 && r처분) { 보유 = r처분 >= 삼년날; 보유말 = r취득 + '~' + r처분 + (보유 ? ' 3년 이상' : ' 3년 미만'); }
  else if (r취득) { 보유 = 삼년날 <= today ? true : null; 보유말 = 보유 ? '계속 보유 · ' + 삼년날 + '에 3년 채움' : '계속 보유 중 — ' + 삼년날 + '에 3년. 그 전 일반주택 양도도 적용(④), 못 채우면 추징(⑥)'; }
  reqs.push(jmReq_('3년 이상 보유', 보유, 보유말 || '취득일 빈칸', '조특법 §99의4①④·시행령 §99의4⑫(당초 취득일부터)'));
  if (yes(p.다른주택)) notes.push('세대에 일반주택·' + 이름 + ' 말고 다른 주택이 있으면 이 특례만으로는 1세대1주택이 되지 않음 — 판정 「1세대1주택」·「중과판정」으로 함께 볼 것');
  const 막힘 = reqs.filter(function (r) { return r.결과 === '✘' && r.이름 !== '3년 이상 보유'; });
  const 모름 = reqs.filter(function (r) { return r.결과 === '?' && r.이름 !== '3년 이상 보유'; });
  const 보유미달 = 보유 === false, 부득이 = /수용|협의매수|상속|멸실/.test(String(R.처분사유 || ''));
  const 칸 = { assetType: 'house', transferPrice: famNum_(G.양도가액) || undefined, acquisitionPrice: famNum_(G.취득가액) || undefined, necessaryExpenses: famNum_(G.필요경비) || undefined, acquisitionDate: g취득 || undefined, transferDate: g양도 || undefined };
  경우.push({ 이름: '① 특례 적용 — ' + 이름 + ' 빼고 1세대1주택', 엔진칸: Object.assign({}, 칸, { isOneHouseOneFamily: true }) });
  경우.push({ 이름: '② 특례 못 받음 — 2주택 일반 과세', 엔진칸: Object.assign({}, 칸, { isOneHouseOneFamily: false }) });
  let 결론;
  if (막힘.length) 결론 = '특례 안 됨 — ' + 막힘.map(function (r) { return r.이름; }).join('·') + ' → 경우 ② 세액';
  else if (보유미달 && !부득이) 결론 = '특례 받은 뒤 3년 못 채움 — 경우 ② 세액을 추징(시행령 §99의4⑧)';
  else if (모름.length) 결론 = '잠정 적용 — 확인할 것: ' + 모름.map(function (r) { return r.이름; }).join('·') + ' (두 경우 함께)';
  else 결론 = '특례 적용 — ' + 이름 + '을 주택 수에서 빼고 일반주택 1세대1주택 판정(소득세법 §89①3호) → 경우 ①' + (보유 === null ? ' · 3년 채울 때까지 사후관리' : '');
  if (보유미달) {
    if (부득이) notes.push(이름 + ' ' + r처분 + ' ' + R.처분사유 + ' — 부득이한 사유(시행령 §99의4⑨ 수용·상속·멸실)라 추징하지 않음');
    else 할일.push('추징 신고·납부 기한 ' + 말일2(r처분) + '(3년 못 채운 날이 속한 달 말일부터 2개월, 조특법 §99의4⑥) — 세액은 경우 ② 엔진 결과(일반주택 양도 때 §104 세액, 시행령 §99의4⑧)');
  }
  if (보유 === null && r취득) 할일.push(이름 + '을 ' + 삼년날 + ' 전에 팔거나 넘기면 추징 — 그때까지 보유하도록 알릴 것');
  if (g양도 && !막힘.length) 할일.push('과세특례신고서를 일반주택 양도소득세 신고기한(예정신고 ' + 말일2(g양도) + ')까지 낼 것(조특법 §99의4⑦·시행령 §99의4⑩)');
  if (!고향) 할일.push(이름 + ' 소재지의 용도지역(토지이용계획확인서)·조정대상지역·토지거래허가구역 지정을 확인(조특법 §99의4①1호가목·시행령 §99의4②~⑤ — 「취득 당시」 기준, 원문 확인 2026-11-04)');
  notes.push(이름 + '을 나중에 팔 때는 이 특례가 없음 — 그때 다른 주택이 없으면 그 자체로 1세대1주택 판정');
  notes.push('일반주택이 고가주택(12억 초과)이면 경우 ①도 넘는 부분은 과세 — 엔진이 셈');
  return jmWrap_('농어촌주택', reqs, { 적용: 막힘.length === 0 && !(보유미달 && !부득이), 결론: 결론, 기준일: today, 종류: 이름, 추징: (보유미달 && !부득이) || undefined, 경우: 경우, 알림: notes, 할일: 할일 });
}
// [2026.11.03 복잡사건 106 「선씨 재건축 동안 산 집」] 재개발·재건축·소규모재건축 사업시행기간 거주용 대체주택 비과세(소득세법 시행령 §156의2⑤) 요건을 하나씩 가름
//  본문: 국내에 1주택을 소유한 1세대가 그 주택의 사업 시행기간 동안 거주하려고 산 집 — 1호 사업시행인가일 이후 취득·1년 이상 거주
//  · 2호 새 주택 완성 뒤 3년 안 세대전원 이사(취학·근무·질병 요양 등 부득이하면 일부 못 와도 됨)·1년 이상 계속 거주, 단서 완성 뒤 3년 안 취학·근무로 세대전원 출국하면 출국 뒤 3년 안 해소·입국 뒤 1년 거주
//  · 3호 완성 전 또는 완성 뒤 3년 안 대체주택 양도 · 보유기간·거주기간(§154①) 제한 없음
//  p: { 사업:{종류, 사업시행인가일, 관리처분인가일, 완성일, 완성예정일}, 취득때주택수(대체주택 사기 직전 국내 주택·입주권 수, 사업 대상 포함),
//       대체주택:{취득일, 전입일, 전출일, 양도일, 양도가액, 취득가액, 필요경비}, 이사:{전입일, 세대전원, 못온사유, 전출일, 출국일, 출국사유, 입국일}, 조정대상지역, 기준일 }
function judgeReplacementHouse_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const B = p.사업 || {}, R = p.대체주택 || {}, M = p.이사 || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const 인가 = jmYmd_(B.사업시행인가일), 완성 = jmYmd_(B.완성일), 완성예정 = jmYmd_(B.완성예정일);
  const r취득 = jmYmd_(R.취득일), r전입 = jmYmd_(R.전입일), r전출 = jmYmd_(R.전출일), r양도 = jmYmd_(R.양도일);
  const 사업 = String(B.종류 || '재건축');
  // 본문 — 1주택 소유 1세대
  const 수 = p.취득때주택수 == null || p.취득때주택수 === '' ? null : Number(p.취득때주택수);
  reqs.push(jmReq_('대체주택 사기 전 국내 1주택(사업 대상)', 수 == null || isNaN(수) ? null : 수 === 1, 수 == null || isNaN(수) ? '대체주택 취득 직전 세대의 국내 주택·입주권 수 빈칸' : 수 === 1 ? '사업 대상 주택(입주권) 1채뿐' : '사업 대상 말고도 ' + (수 - 1) + '채 더 — 「국내에 1주택을 소유한 1세대」가 아님', '소득세법 시행령 §156의2⑤ 본문'));
  // 1호
  reqs.push(jmReq_('사업시행인가일 이후 취득', 인가 && r취득 ? r취득 >= 인가 : null, 인가 && r취득 ? (r취득 >= 인가 ? '인가 ' + 인가 + ' → 취득 ' + r취득 : '취득 ' + r취득 + '이 인가 ' + 인가 + '보다 앞섬') : '인가일·취득일 중 빈칸', '시행령 §156의2⑤1호'));
  const r끝 = r전출 || (r양도 && r양도 <= today ? r양도 : '') || today;
  const r1년 = r전입 ? jmAddM_(r전입, 12) : '';
  const r거주 = r전입 ? (r1년 <= r끝 ? true : (r전출 || (r양도 && r양도 <= today)) ? false : null) : null;
  reqs.push(jmReq_('대체주택 1년 이상 거주', r거주, r전입 ? r전입 + '~' + (r전출 || (r양도 && r양도 <= today ? r양도 : '지금')) + (r거주 ? ' 1년 이상' : r거주 === false ? ' 1년 미만(' + r1년 + '까지 필요)' : ' — ' + r1년 + '에 1년') : '전입일 빈칸', '시행령 §156의2⑤1호'));
  // 2호
  const 기한3 = 완성 ? jmAddM_(완성, 36) : '';
  const 신전입 = jmYmd_(M.전입일), 신전출 = jmYmd_(M.전출일), 출국 = jmYmd_(M.출국일), 입국 = jmYmd_(M.입국일);
  const 출국단서 = !!출국 && /취학|근무|직장|유학|파견/.test(String(M.출국사유 || ''));
  let 이사 = null, 이사말 = '';
  if (!완성) { 이사 = null; 이사말 = '새 주택 아직 완성 전' + (완성예정 ? '(예정 ' + 완성예정 + ')' : '') + ' — 완성 뒤 3년 안 세대전원 이사·1년 거주해야 함'; }
  else if (출국단서) {
    const a = 출국 <= 기한3, b = 입국 ? 입국 <= jmAddM_(출국, 36) : (jmAddM_(출국, 36) < today ? false : null);
    const c = 입국 ? (jmAddM_(입국, 12) <= (신전출 || today) ? true : 신전출 ? false : null) : null;
    이사 = a === false || b === false || c === false ? false : (a && b && c) ? true : null;
    이사말 = '단서 — ' + M.출국사유 + ' 출국 ' + 출국 + (a ? '(완성 뒤 3년 안)' : '(완성 뒤 3년 지나 출국 — 단서 아님)') + ' · 입국 ' + (입국 || '아직') + (b === false ? ' (출국 뒤 3년 넘음)' : '') + ' · 입국 뒤 1년 ' + (c ? '채움' : c === false ? '못 채움' : (입국 ? jmAddM_(입국, 12) + '에 채움' : '입국 뒤부터'));
  } else if (!신전입) { 이사 = 기한3 < today ? false : null; 이사말 = 이사 === false ? '완성 ' + 완성 + ' 뒤 3년(' + 기한3 + ')이 지나도록 이사 안 함' : '아직 이사 전 — ' + 기한3 + '까지 세대전원 이사해야 함'; }
  else {
    const 안 = 신전입 <= 기한3;
    const 전원 = jmYn_(M.세대전원), 사유 = /취학|근무|질병|요양|부득이/.test(String(M.못온사유 || ''));
    const 전원ok = 전원 === true ? true : 전원 === false ? (사유 ? true : false) : null;
    const 일년 = jmAddM_(신전입, 12) <= (신전출 || today) ? true : 신전출 ? false : null;
    이사 = !안 || 전원ok === false || 일년 === false ? false : (안 && 전원ok && 일년) ? true : null;
    이사말 = '이사 ' + 신전입 + (안 ? '(완성 뒤 3년 안)' : '(완성 뒤 3년 지나 — ' + 기한3 + ' 넘김)') + ' · ' + (전원 === true ? '세대전원' : 전원 === false ? (사유 ? '일부 못 옴 — ' + M.못온사유 + '(부득이 괄호로 인정)' : '일부 못 옴 — 부득이한 사유 아님') : '세대전원인지 모름') + ' · 1년 계속 거주 ' + (일년 ? '채움' : 일년 === false ? '못 채움(' + 신전출 + ' 전출)' : jmAddM_(신전입, 12) + '에 채움');
  }
  reqs.push(jmReq_('새 주택 완성 뒤 3년 안 세대전원 이사·1년 거주', 이사, 이사말, '시행령 §156의2⑤2호' + (출국단서 ? ' 단서' : '') + '·시행규칙(부득이한 사유)'));
  // 3호
  let 양 = null, 양말 = '';
  if (!r양도) 양말 = '양도일 빈칸';
  else if (완성) { 양 = r양도 <= 기한3; 양말 = '완성 ' + 완성 + ' · 양도 ' + r양도 + (양 ? (r양도 < 완성 ? ' (완성 전)' : ' (완성 뒤 3년 ' + 기한3 + ' 안)') : ' — 완성 뒤 3년(' + 기한3 + ') 지나 양도'); }
  else { 양 = true; 양말 = '양도 ' + r양도 + ' — 새 주택 완성 전'; }
  reqs.push(jmReq_('완성 전 또는 완성 뒤 3년 안 양도', 양, 양말, '시행령 §156의2⑤3호'));
  const 막힘 = reqs.filter(function (r) { return r.결과 === '✘'; });
  const 모름 = reqs.filter(function (r) { return r.결과 === '?'; });
  const 칸 = { assetType: 'house', transferPrice: famNum_(R.양도가액) || undefined, acquisitionPrice: famNum_(R.취득가액) || undefined, necessaryExpenses: famNum_(R.필요경비) || undefined, acquisitionDate: r취득 || undefined, transferDate: r양도 || undefined };
  경우.push({ 이름: '① 대체주택 비과세 — 1세대1주택으로 봄(보유·거주기간 제한 없음)', 엔진칸: Object.assign({}, 칸, { isOneHouseOneFamily: true }) });
  경우.push({ 이름: '② 특례 못 받음 — 사업 대상 주택(입주권)과 2채로 일반 과세', 엔진칸: Object.assign({}, 칸, { isOneHouseOneFamily: false }) });
  let 결론;
  if (막힘.length) 결론 = '대체주택 비과세 안 됨 — ' + 막힘.map(function (r) { return r.이름; }).join('·') + ' → 경우 ② 세액';
  else if (모름.length) 결론 = '잠정 비과세 — 남은 것: ' + 모름.map(function (r) { return r.이름; }).join('·') + ' (두 경우 함께)';
  else 결론 = '대체주택 비과세 — 1세대1주택으로 보아 §154① 적용, 보유·거주기간 제한 없음 → 경우 ①';
  if (!완성 || 이사 === null) {
    const 끝날 = 완성 ? 기한3 : '완성일 뒤 3년';
    할일.push('새 주택 완성 뒤 3년(' + 끝날 + ') 안 세대전원 이사하고 1년 이상 계속 거주해야 비과세가 굳음 — 그 전에 대체주택을 판 사건은 신고 때 잠정, 못 채우면 비과세를 못 받은 세액을 내야 함(그때의 신고·가산세 다루는 법은 [확인 필요 — 권장: 법에 따로 절차 없음 — 요건 미충족이 확정된 때 수정신고(국세기본법 §45)·과소신고 가산세(§47의3)로 가는 것이 권장])');
    if (완성 && 신전입 && !신전출) 할일.push('이사 ' + 신전입 + ' 뒤 ' + jmAddM_(신전입, 12) + '까지 그 집에서 계속 살 것');
  }
  서류.push('사업시행인가 고시문(인가일)', '대체주택 매매계약서·등기부', '주민등록초본(대체주택·새 주택 전입·전출)', '새 주택 사용승인서(완성일)');
  if (출국단서) 서류.push('출입국사실증명·재학·재직(파견) 증명');
  if (수 == null || isNaN(수)) 서류.push('대체주택 취득 직전 세대원 전원의 주택 소유 확인(세대별 주택 수)');
  notes.push('보유·거주 2년이 안 되어도 비과세(§156의2⑤ 후단) — 다만 양도가액 12억을 넘으면 넘는 부분은 과세하고 그 세율은 보유기간대로(엔진이 셈)');
  notes.push('새 주택을 나중에 팔 때 보유기간은 종전 주택 취득일부터 통산하는지 따로 볼 것(소득세법 시행령 §154⑧ 등) — 이 판정은 대체주택만 봄');
  if (jmYn_(p.조정대상지역)) notes.push('경우 ②에서 조정대상지역 2주택이면 중과 여부를 판정 「중과판정」으로 함께 볼 것');
  if (/재개발|재건축/.test(사업) === false && !/소규모/.test(사업)) notes.push('사업 종류 「' + 사업 + '」 — 재개발·재건축·소규모재건축등(시행령 §156의2⑤)인지 확인');
  return jmWrap_('대체주택', reqs, { 적용: 막힘.length === 0, 결론: 결론, 기준일: today, 경우: 경우, 알림: notes, 할일: 할일, 받을서류: 서류 });
}
// [2026.11.03 복잡사건 107 「염씨 빚 갚으려 판 논」] 경영회생 지원 농지 매매 환매 환급(조특법 §70의2·시행령 §67의2) 요건을 하나씩 가름
//  ① 농업인(농지법 §2)이 직접 경작·축산한 농지등을 한국농어촌공사에 양도하고, 임차해 직접 경작·축산하다가 임차기간 안에 환매하면 납부한 양도소득세 환급
//  ⑤ 그 농업인이 임차기간 중 사망하면 농업인이고 직접 경작하는 상속인이 임차기간 안에 환매해 피상속인이 낸 세액 환급 · ③ 환급신청 필요(시행령 §67의2①: 매매계약서·환매계약서)
//  시행령 §67의2② 국세기본법 §51 준용·§52 환급가산금 없음 · ④ 일부 환매는 환매 면적에 상당하는 세액(서식 51호의3 작성방법 4: 가산세·가산금 제외)
//  ② 환매 농지를 다시 팔 때 취득가액·취득시기는 공사에 팔기 전 원래 것(§71 증여감면 농지면 §71④) · 시행령 §67의2③ 임차기간 직접 경작 기간은 자경기간으로 봄(§66·§66의2)
//  p: { 양도인:{농업인, 직접경작}, 공사양도:{양도일, 양도가액, 면적, 납부세액, 가산세, 증여감면농지}, 임차:{시작일, 끝일, 직접경작},
//       환매:{환매일, 환매가액, 면적, 누가(본인|상속인)}, 사망:{사망일, 상속인농업인, 상속인직접경작}, 원래:{취득일, 취득가액, 자경년수},
//       재양도:{양도일, 양도가액, 필요경비, 소재지, 농지(예)}, 기준일 }
function judgeFarmRevival_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const A = p.양도인 || {}, K = p.공사양도 || {}, L = p.임차 || {}, H = p.환매 || {}, D = p.사망 || {}, O = p.원래 || {}, Z = p.재양도 || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const k양도 = jmYmd_(K.양도일), l시작 = jmYmd_(L.시작일), l끝 = jmYmd_(L.끝일), h일 = jmYmd_(H.환매일), d일 = jmYmd_(D.사망일);
  const 상속인 = /상속/.test(String(H.누가 || '')) || !!d일;
  reqs.push(jmReq_('양도한 사람이 농업인', jmYn_(A.농업인), jmYn_(A.농업인) === null ? '농업인(농지법 §2 2호)인지 모름' : jmYn_(A.농업인) ? '농업인' : '농업인 아님', '조특법 §70의2① · 농지법 §2'));
  reqs.push(jmReq_('공사에 팔기 전 직접 경작·축산한 농지등', jmYn_(A.직접경작), jmYn_(A.직접경작) === null ? '공사 양도 전 직접 경작했는지 모름' : jmYn_(A.직접경작) ? '직접 경작' : '직접 경작 안 함', '조특법 §70의2① · 농지관리기금법 §24의3①'));
  reqs.push(jmReq_('공사에서 임차해 직접 경작·축산', jmYn_(L.직접경작), jmYn_(L.직접경작) === null ? '임차 뒤 직접 경작 여부 빈칸' : jmYn_(L.직접경작) ? '임차 ' + (l시작 || '?') + '~' + (l끝 || '?') + ' 직접 경작' : '임차하고 직접 경작하지 않음(재임대·휴경 등)', '조특법 §70의2① · 농지관리기금법 §24의3③'));
  let 기간안 = null, 기간말 = '';
  if (h일 && l끝) { 기간안 = h일 <= l끝 && (!k양도 || h일 >= k양도); 기간말 = '환매 ' + h일 + (기간안 ? ' — 임차기간(' + l끝 + '까지) 안' : ' — 임차기간 끝 ' + l끝 + '을 넘김'); }
  else if (!h일 && l끝) { 기간안 = l끝 < today ? false : null; 기간말 = 기간안 === false ? '임차기간 ' + l끝 + '이 지나도록 환매 안 함' : '아직 환매 전 — ' + l끝 + '까지 환매해야 환급'; }
  else 기간말 = '환매일·임차기간 끝 중 빈칸';
  reqs.push(jmReq_('임차기간 안에 환매', 기간안, 기간말, '조특법 §70의2①'));
  if (상속인) {
    const 중 = d일 && l시작 && l끝 ? d일 >= l시작 && d일 <= l끝 : null;
    reqs.push(jmReq_('농업인이 임차기간 중 사망', 중, d일 ? '사망 ' + d일 + (중 === false ? ' — 임차기간 밖' : 중 ? ' — 임차기간 안' : '') : '사망일 빈칸', '조특법 §70의2⑤'));
    reqs.push(jmReq_('환매한 상속인이 농업인', jmYn_(D.상속인농업인), jmYn_(D.상속인농업인) === null ? '상속인이 농업인인지 모름' : jmYn_(D.상속인농업인) ? '농업인' : '농업인 아님', '조특법 §70의2⑤1호'));
    reqs.push(jmReq_('상속인이 직접 경작·축산', jmYn_(D.상속인직접경작), jmYn_(D.상속인직접경작) === null ? '상속인 직접 경작 여부 빈칸' : jmYn_(D.상속인직접경작) ? '직접 경작' : '직접 경작 안 함', '조특법 §70의2⑤2호'));
    notes.push('상속인 환매 환급(⑤)은 2023.12.31 신설 — 어느 환매분부터 적용하는지 부칙 원문 [확인 필요 — 권장: 원문 없음 — 통상 시행일(2024.1.1) 이후 환매분부터로 보되 [확인 필요] 유지]');
  }
  const 막힘 = reqs.filter(function (r) { return r.결과 === '✘'; }), 모름 = reqs.filter(function (r) { return r.결과 === '?'; });
  // 환급액 — 엔진 calculateFarmlandRepurchaseRefundJS와 같은 칸
  const 납부 = famNum_(K.납부세액) || 0, 가산 = Math.min(납부, famNum_(K.가산세) || 0), 면 = famNum_(K.면적) || 0, h면 = famNum_(H.면적) || 0;
  const 비율 = 면 > 0 && h면 > 0 ? Math.min(1, h면 / 면) : 1, 환급 = Math.floor((납부 - 가산) * 비율 + 1e-6);
  const 환급칸 = { wasRepurchasedWithinLeaseTerm: 기간안 === true, originalTaxPaid: 납부, originalPenaltyAmount: 가산 || undefined, originalArea: 면 || undefined, repurchasedArea: h면 || undefined, leaseFarmedDirectly: jmYn_(L.직접경작) === false ? false : undefined, leaseEndDate: l끝 || undefined, repurchaseDate: h일 || undefined, repurchasedBy: 상속인 ? '상속인' : undefined, deathDate: d일 || undefined, leaseStartDate: l시작 || undefined, heirIsFarmer: 상속인 ? jmYn_(D.상속인농업인) : undefined, heirFarmsDirectly: 상속인 ? jmYn_(D.상속인직접경작) : undefined };
  const 환급표 = 막힘.length ? 0 : 환급;
  // 다시 팔 때 — 경우 ① 특례(원래 취득일·가액) ② 환급 못 받았으면 환매가 새 취득
  const z양도 = jmYmd_(Z.양도일), o취득 = jmYmd_(O.취득일);
  let 자경합 = null;
  if (z양도) {
    const 임차끝 = h일 && (!l끝 || h일 < l끝) ? h일 : (l끝 || today); // 환매하면 임차가 끝남
    const 임차년 = l시작 ? Math.max(0, (Date.parse(임차끝) - Date.parse(l시작)) / 31557600000) : 0;
    const 뒤년 = h일 ? Math.max(0, (Date.parse(z양도) - Date.parse(h일)) / 31557600000) : 0;
    자경합 = Math.floor(((famNum_(O.자경년수) || 0) + (jmYn_(L.직접경작) ? 임차년 : 0) + (famNum_(Z.환매뒤자경년수) != null ? famNum_(Z.환매뒤자경년수) : 뒤년)) * 10) / 10;
    const 뒤만 = Math.floor((famNum_(Z.환매뒤자경년수) != null ? famNum_(Z.환매뒤자경년수) : 뒤년) * 10) / 10;
    const 공통 = { transferPrice: famNum_(Z.양도가액) || undefined, transferDate: z양도, assetType: 'general', necessaryExpenses: famNum_(Z.필요경비) || undefined, acquisitionCause: 'purchase' };
    경우.push({ 이름: '① 특례 — 공사에 팔기 전 원래 취득일·취득가액(§70의2②)' + (자경합 >= 8 ? ' + 8년 자경 감면(자경 통산 ' + 자경합 + '년)' : ''), 엔진칸: Object.assign({}, 공통, { acquisitionDate: o취득 || undefined, acquisitionPrice: famNum_(O.취득가액) || undefined, isEightYearFarmland: 자경합 >= 8 || undefined }), 자경년수_통산: 자경합 });
    경우.push({ 이름: '② 특례 없음 — 환매를 새 취득으로(자경 ' + 뒤만 + '년)', 엔진칸: Object.assign({}, 공통, { acquisitionDate: h일 || undefined, acquisitionPrice: famNum_(H.환매가액) || undefined, isEightYearFarmland: 뒤만 >= 8 || undefined }) });
    notes.push('다시 팔 때 자경기간: 공사 양도 전 자경 ' + (famNum_(O.자경년수) || 0) + '년 + 임차 직접 경작 기간(시행령 §67의2③로 자경으로 봄) + 환매 뒤 자경 = 약 ' + 자경합 + '년' + (자경합 >= 8 ? ' — 8년 자경 감면(§69) 판정 「8년자경」으로 이어 볼 것' : ' — 8년이 안 됨'));
    if (jmYn_(K.증여감면농지)) notes.push('공사에 팔기 전 §71로 증여세를 감면받은 농지 — 다시 팔 때 취득시기·필요경비는 §71④에 따름(§70의2② 단서), 경우 ①의 취득일·가액을 그에 맞춰 고칠 것');
    if (막힘.length) notes.push('환급 요건을 못 채우면 경우 ②가 맞음 — 다만 그때 취득가액이 환매가액인지는 (원문 확인 2026-11-04: 조특법 §70의2②·소득세법 §97①1호가목)');
  }
  let 결론;
  if (막힘.length) 결론 = '환급 안 됨 — ' + 막힘.map(function (r) { return r.이름; }).join('·');
  else if (모름.length) 결론 = '잠정 환급 ' + 환급.toLocaleString('ko-KR') + '원 — 남은 것: ' + 모름.map(function (r) { return r.이름; }).join('·');
  else 결론 = '환급 ' + 환급.toLocaleString('ko-KR') + '원' + (비율 < 1 ? '(일부 환매 ' + h면 + '/' + 면 + ')' : '') + (가산 ? '(가산세·가산금 ' + 가산.toLocaleString('ko-KR') + ' 뺌)' : '') + ' — 환급신청서 제출';
  if (!h일 && l끝 && 기간안 === null) 할일.push(l끝 + '까지 환매해야 환급 — 환매 자금 마련 일정 확인');
  if (!막힘.length) 할일.push('환급신청서(시행규칙 서식 51호의3)에 공사 양도 매매계약서 사본·환매계약서 사본을 붙여 납세지 관할 세무서에 제출(시행령 §67의2①)');
  notes.push('환급금에는 환급가산금이 붙지 않음(시행령 §67의2② 후단) · 환급 신청 기한은 원문에 따로 없음 — 국세환급금 소멸시효(국세기본법 §54, 5년) 적용 여부 [확인 필요 — 권장: 신청 기한 명문 없음 — 환급금 권리로 보아 행사할 수 있는 때(환매일)부터 5년 소멸시효 적용이 권장]');
  서류.push('공사 양도 매매계약서 사본', '공사 임대차계약서(임차기간)', '환매계약서 사본', '농업인 확인(농업경영체 등록확인서 등)', '임차기간 경작 사실(농지원부·직불금 등)');
  if (상속인) 서류.push('기본증명서(사망일)·가족관계증명서', '상속인 농업인 확인·경작 사실');
  return jmWrap_('경영회생', reqs, { 적용: 막힘.length === 0, 결론: 결론, 기준일: today, 환급액: 환급표, 환급엔진칸: 환급칸, 경우: 경우, 알림: notes, 할일: 할일, 받을서류: 서류 });
}
// [2026.11.03 복잡사건 108 「하씨 산불 난 과수원」] 재해손실공제(상증법 §23·§54, 시행령 §20, 시행규칙 별지 제6호서식) 재산별로 가름
//  §23① 거주자의 사망으로 상속이 개시되고, 신고기한(§67) 안에 재난(시행령 §20①: 화재·붕괴·폭발·환경오염사고·자연재해 등)으로 상속재산이 멸실·훼손되면 손실가액을 과세가액에서 공제
//  단서: 보험금 수령·구상권 행사로 보전받을 수 있으면 그만큼 안 됨 — 서식 ③ = ① 손실된 재산가액 − ② 보상금 등(작성방법 2·3) · 시행령 §20② 손실가액 = 재난으로 손실된 상속재산의 가액
//  §54 증여재산도 준용(신고기한 §68, 수증자 신고 — 거주자 요건 없음) · 시행령 §20③ 공제신고서에 재난 증명서류를 붙여 신고와 함께 제출
//  p: { 종류(상속|증여), 상속개시일, 증여일, 피상속인거주자, 외국주소, 기산일(§67③ 유언집행자·관리인 선임일), 과세가액, 재산총액, 배우자, 자녀수, 증여가액, 관계, 엔진기본{},
//       재산:[{이름, 종류, 소재지, 평가액, 재난일, 재난종류, 손실가액, 손실비율, 남은가액, 보험금, 구상가능액, 보험청구중}], 기준일 }
function judgeDisasterLoss_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const 증여 = /증여/.test(String(p.종류 || '')) || (!!jmYmd_(p.증여일) && !jmYmd_(p.상속개시일));
  const 시작 = 증여 ? jmYmd_(p.증여일) : jmYmd_(p.상속개시일);
  const 기산 = jmYmd_(p.기산일) || 시작;
  const 외국 = !증여 && jmYn_(p.외국주소) === true;
  const 달 = 증여 ? 3 : (외국 ? 9 : 6);
  let 기한 = '';
  if (기산) { const d = new Date(기산 + 'T00:00:00Z'); const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1 + 달, 0)); 기한 = e.toISOString().slice(0, 10); }
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [], 표 = [];
  const 거주 = 증여 ? true : jmYn_(p.피상속인거주자);
  if (!증여) reqs.push(jmReq_('피상속인이 거주자', 거주 === false ? false : 거주, 거주 === null ? '피상속인 거주자 여부 빈칸(비우면 거주자로 셈)' : 거주 ? '거주자' : '비거주자 — 재해손실공제 없음', '상증법 §23①'));
  reqs.push(jmReq_('신고기한', 기한 ? true : null, 기한 ? (증여 ? '증여일' : (기산 !== 시작 ? '선임일 ' + 기산 : '상속개시일')) + '이 속한 달 말일부터 ' + 달 + '개월 — ' + 기한 : (증여 ? '증여일' : '상속개시일') + ' 빈칸', 증여 ? '상증법 §68①·§54' : '상증법 §67①' + (외국 ? '·④' : '') + (기산 !== 시작 ? '·③' : '')));
  const 재난말 = /화재|불|산불|붕괴|무너|폭발|환경오염|오염사고|유출|자연재해|태풍|홍수|호우|침수|지진|산사태|낙뢰|폭설|해일|가뭄|우박|강풍|대설|재난/;
  const 아닌말 = /도난|도둑|절도|분실|사기|횡령|가격|시세|하락|파산|부도|압류|경매|노후|자연 마모|감가/;
  let 합 = 0, 확인합 = 0, 말한합 = 0, 잠정있음 = false;
  (p.재산 || []).forEach(function (x, i) {
    const 이름 = x.이름 || ('재산 ' + (i + 1));
    const 평 = n(x.평가액), 날 = jmYmd_(x.재난일), 종 = String(x.재난종류 || '');
    let 손 = n(x.손실가액);
    let 손근거 = '손실가액 직접';
    if (!손 && 평 && famNum_(x.손실비율) > 0) { const r = famNum_(x.손실비율); 손 = Math.floor(평 * (r > 1 ? r / 100 : r)); 손근거 = '평가액 ' + won(평) + ' × 손실 ' + (r > 1 ? r : r * 100) + '%'; }
    if (!손 && 평 && x.남은가액 != null && x.남은가액 !== '') { 손 = Math.max(0, 평 - n(x.남은가액)); 손근거 = '평가액 ' + won(평) + ' − 남은 가액 ' + won(n(x.남은가액)); }
    if (평 && 손 > 평) { 손 = 평; 손근거 += '(평가액 한도)'; }
    말한합 += 손;
    const 보험 = n(x.보험금), 구상 = n(x.구상가능액), 보전 = 보험 + 구상;
    const 왜 = [];
    let 재난 = null;
    if (아닌말.test(종)) { 재난 = false; 왜.push('「' + 종 + '」은 재난(시행령 §20① 화재·붕괴·폭발·환경오염사고·자연재해 등)이 아님 [확인 필요 — 권장: 예시 열거 + 「등」 — ①유사한 사고성 재난만(도난·사기는 아님, 권장) ②넓게 — 예규 필요]'); }
    else if (재난말.test(종)) 재난 = true;
    else 왜.push('재난 종류 빈칸·불분명');
    let 때 = null;
    if (날 && 시작) {
      if (날 < 시작) { 때 = false; 왜.push('재난일 ' + 날 + '이 ' + (증여 ? '증여일' : '상속개시일') + ' 전 — 공제가 아니라 그 상태로 평가(평가기준일 현재 시가 §60①)'); }
      else if (기한 && 날 > 기한) { 때 = false; 왜.push('재난일 ' + 날 + '이 신고기한 ' + 기한 + '을 넘김'); }
      else 때 = true;
    } else 왜.push('재난일 빈칸');
    if (!손) 왜.push('손실가액 빈칸(평가액·손실 비율 또는 손실가액)');
    if (jmYn_(x.보험청구중) === true && !보험) 왜.push('보험 청구 중 — 받을 보험금이 ② 보상금 등에 들어감, 지급액 확인 전엔 잠정');
    const 막 = 재난 === false || 때 === false || (!증여 && 거주 === false);
    const 모 = !막 && (재난 === null || 때 === null || !손 || (jmYn_(x.보험청구중) === true && !보험));
    const 차 = Math.max(0, 손 - 보전);
    const 공제 = 막 ? 0 : 차;
    if (모) 잠정있음 = true;
    합 += 공제; if (!막 && !모) 확인합 += 공제;
    표.push({ 재산: 이름, 종류: x.종류 || '', 소재지: x.소재지 || '', 재난: 종 || '', 재난일: 날 || '', '①손실가액': 손, 손실근거: 손근거, '②보상금등': 보전, '③차감액': 차, 공제: 공제, 판정: 막 ? '✘' : 모 ? '잠정' : '✔', 왜: 왜.join(' · ') || (보전 ? '보험·구상 ' + won(보전) + ' 뺌(서식 작성방법 2·3)' : '') });
  });
  reqs.push(jmReq_('재산별 재난·기한·보전', 표.some(function (r) { return r.판정 === '✔'; }) ? true : (표.some(function (r) { return r.판정 === '잠정'; }) ? null : (표.length ? false : null)), 표.map(function (r) { return r.재산 + ' ' + r.판정 + ' ' + won(r.공제); }).join(' / ') || '재산 빈칸', '상증법 §23①·시행령 §20①②·별지 제6호서식'));
  // 엔진칸 — 상속 calculateInheritanceTaxJS / 증여 calculateGiftTaxJS(disasterLossAmount 하나만 받음)
  const 칸 = function (공) {
    const b = Object.assign({}, p.엔진기본 || {});
    if (증여) { if (p.증여가액 != null) b.giftAmount = n(p.증여가액); if (시작) b.giftDate = 시작; if (p.관계) b.relation = p.관계; }
    else {
      if (p.과세가액 != null) b.taxableEstateAmount = n(p.과세가액);
      if (p.재산총액 != null || p.과세가액 != null) b.grossEstateValue = n(p.재산총액) || n(p.과세가액);
      if (시작) { b.inheritanceDate = 시작; b.dateOfDeath = 시작; }
      if (p.배우자 != null) b.hasSpouse = jmYn_(p.배우자) === true;
      if (p.자녀수 != null) b.childCount = n(p.자녀수);
      b.isDecedentResident = 거주 !== false;
    }
    b.disasterLossAmount = 공 || undefined;
    return b;
  };
  경우.push({ 이름: '① 법대로 — 재산별 ③ 차감액 합계 ' + won(합) + (잠정있음 ? '(잠정 포함)' : ''), 재해손실공제: 합, 엔진칸: 칸(합) });
  if (잠정있음) 경우.push({ 이름: '② 확인된 것만 — ' + won(확인합), 재해손실공제: 확인합, 엔진칸: 칸(확인합) });
  경우.push({ 이름: (잠정있음 ? '③' : '②') + ' 공제 없음(비교)', 재해손실공제: 0, 엔진칸: 칸(0) });
  if (말한합 !== 합) 경우.push({ 이름: (잠정있음 ? '④' : '③') + ' 말한 손실 전부를 넣었을 때(보험·기한·재난 범위를 안 본 잘못 — 비교만) ' + won(말한합), 재해손실공제: 말한합, 엔진칸: 칸(말한합), 잘못: true });
  const 막힘 = reqs.filter(function (r) { return r.결과 === '✘'; });
  let 결론;
  if (!증여 && 거주 === false) 결론 = '공제 없음 — 피상속인 비거주자(§23①)';
  else if (!합) 결론 = '공제 없음 — ' + (표.map(function (r) { return r.재산 + '(' + (r.왜 || r.판정) + ')'; }).join(' · ') || '재산 빈칸');
  else 결론 = (잠정있음 ? '잠정 ' : '') + '재해손실공제 ' + won(합) + '원 — 신고기한 ' + (기한 || '?') + '까지 공제신고서(별지 제6호서식)를 신고서와 함께';
  notes.push('공제액은 재산별로 ① 재난으로 손실된 재산가액 − ② 보험금·구상권으로 보전받았거나 받을 수 있는 금액 = ③(별지 제6호서식 작성방법 2·3) — 손실가액은 ' + (증여 ? '증여재산' : '상속재산') + '의 평가액 중 재난으로 잃은 부분(시행령 §20②)');
  if (!증여) notes.push('재해손실공제는 상속공제 종합한도(§24)에 들어감 — 엔진이 한도를 봄');
  notes.push('신고기한 뒤에 공제신고서를 내도 공제되는지(기한후·경정청구) [확인 필요 — 권장: 제출 시기는 절차 규정이고 공제 요건(§23①)은 기한 내 재난 발생 — 경정청구로 공제 가능하다는 쪽 권장, 예규 확인] — 시행령 §20③은 「상속세과세표준신고와 함께」 제출로 적음');
  notes.push('손실된 재산을 나중에 팔 때 취득가액(소득세법 시행령 §163⑨ 상속·증여 당시 평가액)에서 재해손실분을 빼는지 (원문 확인 2026-11-04: 소득세법시행령 §163⑨ 상속개시일 현재 상증법 §60~§66 평가액)');
  if (증여) notes.push('증여재산 재해손실공제(§54)는 수증자가 신고 — 합산배제증여재산에는 적용 안 함(§55①)');
  if (잠정있음) 할일.push('잠정 재산의 재난일·재난 종류·보험 지급액을 확정해 ③을 다시 셈');
  if (합) 할일.push('재해손실 공제신고서(시행규칙 별지 제6호서식) — 재산별 ①②③, 재난 종류·발생일 — 에 재난 증명서류를 붙여 ' + (기한 ? 기한 + '까지 ' : '') + (증여 ? '증여세' : '상속세') + ' 신고서와 함께 제출(시행령 §20③)');
  서류.push('재난 증명(화재증명원·자연재난 피해신고 확인서·사고 확인 등)', '손실 평가 근거(감정·견적·피해 조사)', '보험 증권·보험금 지급 내역(청구 결과)', '구상권 상대방·합의서');
  return jmWrap_('재해손실', reqs, { 적용: 합 > 0, 결론: 결론, 기준일: today, 신고기한: 기한 || undefined, 재해손실공제: 합, 확인된공제: 확인합, 서식표: 표, 경우: 경우, 엔진칸: 경우[0].엔진칸, 엔진칸늘: true, 알림: notes, 할일: 할일, 받을서류: 서류, 막힘: 막힘.length || undefined });
}
// [2026.11.03 복잡사건 109 「맹씨 한우 축사」] 축사용지 양도소득세 감면(조특법 §69의2·시행령 §66의2) 요건을 하나씩 가름
//  ① 축사용지 소재지에 거주하는 거주자가 8년 이상 직접 축산에 사용한 축사용지를 폐업을 위하여 2028.12.31까지 양도하면 100% 감면(2011.7.25 신설)
//     단서: 주거지역등 편입·환지예정지 지정이면 그날까지 소득만(시행령 ⑩ 기준시가 비율) · ② 5년 안 축산 재개 추징(상속은 예외, 시행령 ⑪) · ③ 감면신청
//  시행령 ① 8년 이상 거주(같은 시·군·구 / 연접 / 직선 30km) + 양도일 현재 거주자(비거주자 된 지 2년 안 포함) · ② 직접 축산(상시 종사 또는 축산작업 1/2 이상)
//  ③ 취득~양도 사이 8년 이상 직접 축산, 1호 시(동) 지역 주거·상업·공업 편입 3년 지남(가·나·다 예외) · 2호 환지예정지 지정 3년 지남은 제외 · ④ 기준일(양도일, 매수자 형질변경이면 계약일)
//  ⑤ 교환·분합·대토 뒤 수용이면 전 기간 통산 · ⑥ 상속인이 1년 이상 축산하면 피상속인(·배우자) 기간 통산 · ⑦ 1년 미만이어도 상속 3년 안 양도 등
//  ⑧ 폐업 = 시장·군수·구청장의 축산기간 및 폐업 확인서 · ⑨ 감면세액 = 산출세액 × 축사용지 면적 ÷ 총 양도면적 · ⑫ 과세표준신고와 함께 감면신청서·폐업 확인서
//  p: { 양도인:{거주자, 비거주된날, 거주지역(같은|연접|30km|밖), 거주년수, 직접축산, 축산년수},
//       토지:{취득일, 취득원인(매매|상속|대토), 축사용지면적, 총양도면적, 지역(동|읍면|군), 편입일, 편입예외, 환지예정일, 기준시가:{취득,편입,양도}},
//       상속:{상속일, 피상속인축산년수, 상속뒤축산년수, 지정지역(택지·산단 등 3년 안 지정)}, 대토:{전축산년수, 수용},
//       폐업:{확인서, 폐업일}, 양도:{양도일, 계약일, 매수자형질변경, 양도가액, 취득가액, 필요경비, 수용},
//       재축산:{재개일, 상속}, 기준일 }
function judgeLivestockLand_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const A = p.양도인 || {}, T = p.토지 || {}, H = p.상속 || {}, X = p.대토 || {}, F = p.폐업 || {}, Y = p.양도 || {}, R = p.재축산 || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const y일 = jmYmd_(Y.양도일), 계약일 = jmYmd_(Y.계약일), 취득일 = jmYmd_(T.취득일), 상속일 = jmYmd_(H.상속일);
  const 가산 = function (d, n) { if (!d) return ''; const a = d.split('-').map(Number); const z = new Date(Date.UTC(a[0] + n, a[1] - 1, a[2])); return z.toISOString().slice(0, 10); };
  // 1. 기간 — 2011.7.25 신설, 2028.12.31까지 양도
  const 기간 = y일 ? (y일 >= '2011-07-25' && y일 <= '2028-12-31') : null;
  reqs.push(jmReq_('2011.7.25 이후 ~ 2028.12.31까지 양도', 기간, y일 ? '양도일 ' + y일 + (기간 ? '' : y일 < '2011-07-25' ? ' — 조문 신설 전' : ' — 적용기한 지남') : '양도일 빈칸', '조특법 §69의2① · 부칙(2011.7.25)'));
  // 2. 양도일 현재 거주자(비거주자 된 지 2년 안 포함)
  const 거주자 = jmYn_(A.거주자), 비거주일 = jmYmd_(A.비거주된날);
  let 거주자결과 = 거주자, 거주자말 = 거주자 === null ? '양도일 현재 거주자인지 모름' : 거주자 ? '거주자' : '비거주자';
  if (거주자 === false && 비거주일 && y일) { 거주자결과 = y일 <= 가산(비거주일, 2); 거주자말 = '비거주자가 된 날 ' + 비거주일 + (거주자결과 ? ' — 2년 안이라 거주자로 봄' : ' — 2년 지남'); }
  reqs.push(jmReq_('양도일 현재 거주자(비거주 2년 안 포함)', 거주자결과, 거주자말, '시행령 §66의2① 본문'));
  // 3. 8년 이상 소재지 거주(같은 시·군·구 / 연접 / 30km)
  const 지역 = String(A.거주지역 || ''), 거주년 = famNum_(A.거주년수);
  const 지역ok = /같|연접|30/.test(지역) ? true : /밖|아니/.test(지역) ? false : null;
  const 재촌 = 지역ok === false ? false : (지역ok === true && 거주년 != null ? 거주년 >= 8 : null);
  reqs.push(jmReq_('축사용지 소재지 8년 이상 거주(재촌)', 재촌, (지역 || '거주 지역 빈칸') + (거주년 != null ? ' · ' + 거주년 + '년' : ' · 거주 연수 빈칸'), '시행령 §66의2① 1~3호'));
  // 4. 직접 축산
  reqs.push(jmReq_('직접 축산(상시 종사 또는 축산작업 1/2 이상 자기 노동)', jmYn_(A.직접축산), jmYn_(A.직접축산) === null ? '직접 축산 여부 모름' : jmYn_(A.직접축산) ? '직접 축산' : '남에게 맡김·임대', '시행령 §66의2②'));
  // 5. 8년 이상 직접 축산 — 상속·대토 통산
  const 본인년 = famNum_(A.축산년수) || 0;
  let 통산 = 본인년, 통산말 = '본인 ' + 본인년 + '년';
  if (/상속/.test(String(T.취득원인 || '')) || 상속일) {
    const 피년 = famNum_(H.피상속인축산년수) || 0, 뒤년 = famNum_(H.상속뒤축산년수) != null ? famNum_(H.상속뒤축산년수) : 본인년;
    const 삼년안 = 상속일 && y일 ? y일 <= 가산(상속일, 3) : null;
    const 지정 = jmYn_(H.지정지역) && jmYn_(Y.수용);
    if (뒤년 >= 1) { 통산 = 뒤년 + 피년; 통산말 = '상속 뒤 ' + 뒤년 + '년(1년 이상 계속 — ⑥) + 피상속인 ' + 피년 + '년'; }
    else if (삼년안 || 지정) { 통산 = 뒤년 + 피년; 통산말 = '상속 뒤 1년 미만이나 ' + (삼년안 ? '상속일부터 3년 안(' + 가산(상속일, 3) + '까지) 양도' : '3년 안 택지·산단 등 지정된 지역 수용') + ' — ⑦로 피상속인 ' + 피년 + '년 통산'; notes.push('⑦ 문언 「3년이 되는 날까지 양도하거나 … 수용되는 경우로서 3년이 되는 날까지 지정되는 경우」를 3년 안 양도 또는 지정지역 수용 어느 하나로 읽음 — 8년 자경(시행령 §66⑫)과 같은 읽기, (원문 확인 2026-11-04: 조특령 §66의2⑦·§66⑫ 같은 구조)'); }
    else { 통산 = 뒤년; 통산말 = '상속 뒤 ' + 뒤년 + '년 — 1년 미만이고 상속 3년도 지나 피상속인 기간을 못 더함(⑥⑦)'; }
    if (famNum_(H.피상속인배우자축산년수)) notes.push('피상속인이 배우자에게 상속받아 축산한 땅이면 그 배우자 기간도 통산(⑥2호) — ' + famNum_(H.피상속인배우자축산년수) + '년 따로 더해 볼 것');
  }
  if (/대토|교환|분합/.test(String(T.취득원인 || '')) && famNum_(X.전축산년수)) {
    if (jmYn_(Y.수용) || jmYn_(X.수용)) { 통산 += famNum_(X.전축산년수); 통산말 += ' + 교환·대토 전 ' + famNum_(X.전축산년수) + '년(새 땅이 수용 — ⑤)'; }
    else notes.push('교환·분합·대토 전 축산 기간은 새 땅이 협의매수·수용되는 경우에만 더함(⑤) — 이번 양도는 수용이 아니라 더하지 않음');
  }
  통산 = Math.floor(통산 * 10) / 10;
  reqs.push(jmReq_('취득~양도 사이 8년 이상 직접 축산', 통산 >= 8, 통산말 + ' = ' + 통산 + '년', '시행령 §66의2③·⑤·⑥·⑦·⑬'));
  // 6. 폐업
  const 폐업 = jmYn_(F.확인서);
  reqs.push(jmReq_('폐업을 위한 양도(축산기간 및 폐업 확인서)', 폐업, 폐업 === null ? '폐업 확인서를 받았는지 모름' : 폐업 ? '확인서 받음' + (jmYmd_(F.폐업일) ? '(폐업 ' + jmYmd_(F.폐업일) + ')' : '') : '폐업 안 함·확인서 없음', '조특법 §69의2① · 시행령 §66의2⑧·⑫'));
  // 7. 편입·환지예정 3년 제외 — 기준일(④)
  const 기준 = jmYn_(Y.매수자형질변경) && 계약일 ? 계약일 : y일;
  if (jmYn_(Y.매수자형질변경) && 계약일) notes.push('매수자가 계약조건대로 형질변경·착공했으므로 편입 3년은 매매계약일 ' + 계약일 + ' 현재로 봄(시행령 §66의2④ 단서)');
  const 편입일 = jmYmd_(T.편입일), 환지일 = jmYmd_(T.환지예정일), 시지역 = /동/.test(String(T.지역 || '')) ? true : /읍|면|군/.test(String(T.지역 || '')) ? false : null;
  let 제외 = false, 제외말 = '편입·환지예정 없음';
  if (편입일 && 기준) {
    const 삼년 = 기준 > 가산(편입일, 3);
    if (!삼년) 제외말 = '주거지역등 편입 ' + 편입일 + ' — 3년 안(' + 가산(편입일, 3) + '까지)이라 제외 아님';
    else if (시지역 === false) 제외말 = '편입 3년 지났으나 읍·면·군 지역 — 1호 제외 대상 아님';
    else if (jmYn_(T.편입예외)) 제외말 = '편입 3년 지났으나 대규모 개발사업·공공 사업자 보상 지연 등 예외(1호 가·나·다목)';
    else if (시지역 === true) { 제외 = true; 제외말 = '시(동) 지역 주거·상업·공업지역 편입 ' + 편입일 + '부터 3년 지남(' + 기준 + ' 현재)'; }
    else { 제외 = null; 제외말 = '편입 3년 지남 — 땅이 시 동 지역인지 읍·면·군인지 빈칸'; }
  }
  if (환지일 && 기준 && 제외 !== true) {
    if (기준 > 가산(환지일, 3)) { 제외 = true; 제외말 = '축사용지 밖 환지예정지 지정 ' + 환지일 + '부터 3년 지남(환지 청산금 부분은 빼지 않음)'; }
    else 제외말 += ' · 환지예정지 지정 ' + 환지일 + ' — 3년 안';
  }
  reqs.push(jmReq_('편입·환지예정 3년 지난 땅이 아님', 제외 === null ? null : !제외, 제외말, '시행령 §66의2③1호·2호·④'));
  const 막힘 = reqs.filter(function (r) { return r.결과 === '✘'; }), 모름 = reqs.filter(function (r) { return r.결과 === '?'; });
  // 감면 범위 — 편입일까지 소득(⑩), 면적 비율(⑨)
  const 면 = famNum_(T.축사용지면적), 총 = famNum_(T.총양도면적), 면비 = 면 > 0 && 총 > 0 ? Math.min(1, 면 / 총) : null;
  const 기 = T.기준시가 || {}, 편입칸 = (편입일 || 환지일) && famNum_(기.취득) != null && famNum_(기.편입) != null && famNum_(기.양도) != null;
  if (면비 != null && 면비 < 1) notes.push('한 번에 판 땅 ' + 총 + '㎡ 중 축사용지 ' + 면 + '㎡만 감면 — 감면세액 = 산출세액 × ' + 면 + '/' + 총 + '(시행령 §66의2⑨)');
  if ((편입일 || 환지일) && !편입칸) 할일.push('편입·환지예정이 있어 그날까지 소득만 감면(§69의2① 단서) — 취득·편입일·양도 당시 기준시가를 넣어야 비율을 셈(시행령 §66의2⑩)');
  if (편입일 || 환지일) notes.push('편입일(환지예정지 지정일)까지 소득만 감면 — 양도소득금액 × (편입일 기준시가 − 취득 기준시가) ÷ (양도 기준시가 − 취득 기준시가)(시행령 §66의2⑩)');
  // 경우 — 엔진칸
  const 공통 = { transferPrice: famNum_(Y.양도가액) || undefined, transferDate: y일 || undefined, acquisitionDate: 취득일 || undefined, acquisitionPrice: famNum_(Y.취득가액) || undefined, necessaryExpenses: famNum_(Y.필요경비) || undefined, assetType: 'general', acquisitionCause: /상속/.test(String(T.취득원인 || '')) ? 'inheritance' : 'purchase' };
  const 편입엔진 = 편입칸 ? { zoneIncorporated: true, zoneStdAcq: famNum_(기.취득), zoneStdIncorp: famNum_(기.편입), zoneStdTransfer: famNum_(기.양도) } : {};
  const 면적엔진 = 면비 != null ? { livestockLandArea: 면, totalTransferArea: 총 } : {};
  const 재개일 = jmYmd_(R.재개일), 재개 = 재개일 && y일 ? 재개일 <= 가산(y일, 5) : false;
  if (y일) {
    경우.push({ 이름: '① 법대로' + (막힘.length ? ' — 요건 못 채워 감면 없음' : ' — 감면(면적·편입 비율 반영)') + (모름.length ? ' [잠정]' : ''), 엔진칸: Object.assign({}, 공통, 막힘.length ? {} : Object.assign({ isLivestockLandExempt: true }, 편입엔진, 면적엔진)) });
    경우.push({ 이름: '② 감면 없음', 엔진칸: Object.assign({}, 공통) });
    if (!막힘.length && (면비 != null && 면비 < 1 || 편입칸)) 경우.push({ 이름: '③ 판 땅 전부·전 기간 감면(잘못 — 면적·편입 비율 안 뺌)', 엔진칸: Object.assign({}, 공통, { isLivestockLandExempt: true }) });
    if (!막힘.length && 재개) 경우.push({ 이름: '④ 5년 안 축산 재개 — 감면세액 추징' + (jmYn_(R.상속) ? '(상속이라 예외)' : ''), 엔진칸: Object.assign({}, 공통, { isLivestockLandExempt: true, isLivestockRestartedWithin5Years: true, isLivestockRestartException: jmYn_(R.상속) || undefined }, 편입엔진, 면적엔진) });
  }
  let 결론;
  if (막힘.length) 결론 = '감면 안 됨 — ' + 막힘.map(function (r) { return r.이름; }).join('·');
  else if (모름.length) 결론 = '잠정 감면 — 남은 것: ' + 모름.map(function (r) { return r.이름; }).join('·');
  else 결론 = '감면(100%' + (면비 != null && 면비 < 1 ? ' × 면적 ' + 면 + '/' + 총 : '') + ((편입일 || 환지일) ? ' · 편입일까지 소득만' : '') + ') — 예정신고 때 감면신청서·폐업 확인서 제출';
  if (y일 && !막힘.length) 할일.push('양도일이 속하는 과세기간 과세표준신고(예정신고 포함) 때 세액감면신청서와 축산기간 및 폐업 확인서를 냄(시행령 §66의2⑫)');
  if (y일 && !막힘.length) 할일.push(가산(y일, 5) + '까지 축산업을 다시 하면 감면세액 추징(§69의2②, 상속으로 축산하게 된 경우는 예외 — 시행령 ⑪) — 고객에게 알림');
  if (재개 && !jmYn_(R.상속)) notes.push('양도 ' + y일 + ' 뒤 ' + 재개일 + '에 축산 재개 — 5년 안이라 감면세액 추징(§69의2②), 이자상당액은 추징 이자 도구로 따로');
  notes.push('감면은 8년 자경·농지대토 등과 §133 한도(1년 1억·5년 2억)를 함께 씀 — 앞선 감면세액 칸을 채울 것');
  서류.push('축산기간 및 폐업 확인서(시장·군수·구청장)', '주민등록초본(8년 거주)', '축산업 등록증·가축사육 기록(직접 축산)', '토지·건축물대장(축사·딸린 땅 면적)', '토지이용계획확인서(편입일)');
  if (상속일) 서류.push('상속 등기·피상속인 축산 사실 자료');
  return jmWrap_('축사용지', reqs, { 적용: 막힘.length === 0, 결론: 결론, 기준일: today, 면적비율: 면비, 축산년수_통산: 통산, 경우: 경우, 알림: notes, 할일: 할일, 받을서류: 서류 });
}
// [2026.11.03 복잡사건 111] 장기일반민간임대주택등 양도소득세 감면(조특법 §97의5·시행령 §97의5) 판정.
//  엔진(calculateLongTermRentalHouseReductionJS sect97_5)은 감면소득 비율만 셈하고 요건(2018.12.31. 취득·3개월 안 등록·10년 「계속」 등록·임대·
//  임대료 5%·국민주택규모·기준시가)을 보지 않아, 넥스가 「장기일반 등록」만 보고 100% 감면을 붙이거나 §97의3 70%·§97의4와 견주지 못했다.
//  p: { 양도일, 거주자(예), 취득일, 계약일(계약금 지급일), 등록일(장기일반·공공지원), 종류(매입|건설), 아파트(예), 임대개시일(없으면 등록일),
//       말소일, 말소사유(자동|자진), 계약: [{ 시작, 끝, 보증금, 월세 }], 전환율, 재개발: { 인가일, 준공일 }, 수용: { 시작, 끝 }, 상속: { 피상속인임대일수 },
//       전용면적, 읍면(예), 수도권(예), 임대개시기준시가, 기준시가: { 취득, 등록(없으면 임대개시기준시가 — §97의3 안분용), 임대끝, 양도 }, 바탕: 엔진 양도 칸 }
function judgeRental9705_(p) {
  p = p || {};
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const T = jmYmd_(p.양도일), R = jmYmd_(p.등록일), S0 = jmYmd_(p.임대개시일) || R;
  const 취 = jmYmd_(p.취득일), 계 = jmYmd_(p.계약일);
  const 말소 = jmYmd_(p.말소일), 자동 = /자동/.test(String(p.말소사유 || ''));
  const 매입 = /매입|purchase/.test(String(p.종류 || '')), 건설 = /건설|construction/.test(String(p.종류 || ''));
  const 아파트 = jmYn_(p.아파트) === true;
  // ① 거주자
  const 거 = jmYn_(p.거주자);
  reqs.push(jmReq_('거주자', 거 === false ? false : 거 === true ? true : null, 거 === false ? '비거주자는 대상 아님' : 거 === true ? '거주자' : '거주자인지 모름', '조특법 §97의5①'));
  // ② 매입임대(민간매입·공공매입)
  reqs.push(jmReq_('민간매입임대·공공매입임대주택', 매입 ? true : 건설 ? false : null, 매입 ? '매입임대' : 건설 ? '건설임대 — §97의5는 「취득」한 매입임대만(건설임대는 §97의3)' : '건설·매입 모름', '조특법 §97의5①1호'));
  // ③ 2018.12.31.까지 취득(계약금 지급 포함)
  let 취ok = null, 취왜 = '';
  if (!취 && !계) 취왜 = '취득일·계약금 지급일 모름';
  else if ((취 && 취 <= '2018-12-31') || (계 && 계 <= '2018-12-31')) { 취ok = true; 취왜 = (취 && 취 <= '2018-12-31') ? '취득 ' + 취 : '계약금 지급 ' + 계 + '(취득 ' + (취 || '모름') + ') — 2018.12.31.까지 계약·계약금이면 됨'; }
  else { 취ok = false; 취왜 = '취득 ' + (취 || '') + (계 ? '·계약 ' + 계 : '') + ' — 2019년 이후 취득분은 대상 아님'; }
  reqs.push(jmReq_('2018.12.31.까지 취득(계약금 지급 포함)', 취ok, 취왜, '조특법 §97의5①1호'));
  // ④ 취득일부터 3개월 안 장기일반 등록
  let 등ok = null, 등왜 = '';
  if (!R || !취) 등왜 = (!R ? '장기일반·공공지원 등록일 모름' : '취득일(잔금·등기 빠른 날) 모름');
  else { const 기한 = jmAddM_(취, 3); 등ok = R <= 기한; 등왜 = '취득 ' + 취 + ' → 등록 ' + R + ' (기한 ' + 기한 + ')' + (등ok ? '' : ' — 3개월 넘음'); }
  reqs.push(jmReq_('취득일부터 3개월 안 장기일반민간임대주택등 등록', 등ok, 등왜, '조특법 §97의5①1호'));
  // ⑤ 10년 이상 「계속」 등록·임대 — 6개월 안 공실·수용·재개발 기간은 계속 임대로 봄(시행령 §97의5①)
  const 끝 = 말소 && (!T || 말소 < T) ? 말소 : T;
  const cs = [].concat(p.계약 || []).map(function (c) { return { s: jmYmd_(c.시작), e: jmYmd_(c.끝), 보: famNum_(c.보증금) || 0, 월: famNum_(c.월세) || 0 }; })
    .filter(function (c) { return c.s; }).sort(function (a, b) { return a.s < b.s ? -1 : 1; });
  const 재 = p.재개발 || null, 재s = 재 && jmYmd_(재.인가일) ? jmAddM_(jmYmd_(재.인가일), -6) : '', 재e = 재 && jmYmd_(재.준공일) ? jmAddM_(jmYmd_(재.준공일), 6) : '';
  const 수 = p.수용 || null, 수s = 수 && jmYmd_(수.시작), 수e = 수 && jmYmd_(수.끝);
  const 끊김 = [], 의제 = [];
  let 계속끝 = '';
  if (S0 && cs.length) {
    계속끝 = cs[0].e || 끝;
    if (cs[0].s > jmAddM_(S0, 6)) 끊김.push('임대개시 ' + S0 + '~첫 계약 ' + cs[0].s);
    for (let i = 1; i < cs.length; i++) {
      const a = cs[i - 1], b = cs[i];
      if (a.e && b.s > famAddD_(a.e, 1)) {
        const 사이 = a.e + '~' + b.s + '(' + Math.round(jmDays_(a.e, b.s) - 1) + '일)';
        if (b.s <= jmAddM_(a.e, 6)) 의제.push(사이 + ' 6개월 안 공실');
        else if (재s && 재e && a.e >= 재s && b.s <= 재e) 의제.push(사이 + ' 재개발 등');
        else if (수s && 수e && a.e >= 수s && b.s <= famAddD_(수e, 1)) 의제.push(사이 + ' 수용');
        else { 끊김.push(사이 + ' 6개월 넘는 공실'); }
      }
      if (!끊김.length) 계속끝 = b.e || 끝;
    }
    if (계속끝 && 끝 && 계속끝 > 끝) 계속끝 = 끝;
  }
  const 상속일 = famNum_(p.상속 && p.상속.피상속인임대일수) || 0;
  const 열해 = S0 ? famAddY_(S0, 10) : '';
  const 등록10 = R && 끝 ? famAddY_(R, 10) <= 끝 : null;
  let 기ok = null, 기왜 = '';
  if (!S0 || !cs.length) 기왜 = '임대개시일·임대 계약 목록 없음 — 표준임대차계약서·임대차계약 신고 내역을 받을 것';
  else {
    const 임대10 = !끊김.length && 열해 && (famAddD_(계속끝, 상속일) >= 열해);
    기ok = 등록10 !== false && !!임대10;
    기왜 = '등록 ' + R + '~' + (끝 || '?') + (등록10 === false ? '(계속 등록 10년 안 됨' + (말소 && (!T || 말소 < T) ? ' — ' + (자동 ? '자동' : '자진') + '말소 ' + 말소 : '') + ')' : '') +
      ' · 임대개시 ' + S0 + ' → 10년 되는 날 ' + 열해 + ' · 계속 임대 끝 ' + (계속끝 || '?') +
      (의제.length ? ' · 계속으로 봄: ' + 의제.join(', ') : '') + (끊김.length ? ' · 계속 끊김: ' + 끊김.join(', ') : '') + (상속일 ? ' · 피상속인 임대 ' + 상속일 + '일 합산' : '');
  }
  reqs.push(jmReq_('10년 이상 계속 등록하고 그동안 계속 임대', 기ok, 기왜, '조특법 §97의5①2호·시행령 §97의5①③·§97⑤1·3호'));
  // ⑥~⑨ §97의3①2호 요건(시행령 §97의3③) — 장기임대특례 판정과 같은 잣대를 그대로 씀
  const r3 = judgeRental9703_(Object.assign({}, p, { 바탕: null }));
  const 같은 = ['임대료 등 증가율', '국민주택규모', '임대개시일 기준시가'];
  (r3.요건 || []).forEach(function (q) {
    if (같은.some(function (k) { return String(q.이름 || '').indexOf(k) === 0; })) reqs.push({ 이름: q.이름, 결과: q.결과, 왜: q.왜, 근거: String(q.근거 || '') + ' (§97의5①3호 준용)' });
  });
  // 결론
  const 결과들 = reqs.map(function (q) { return q.결과; });
  const 안됨 = 결과들.indexOf('✘') >= 0, 모름 = !안됨 && 결과들.indexOf('?') >= 0;
  const 아직 = !안됨 && T && 열해 && T < 열해;
  const 결론 = 안됨 ? '§97의5 감면 안 됨' : 아직 ? '§97의5 아직 10년 전(' + 열해 + ' 뒤 양도해야)' : '§97의5 임대기간 중 양도소득 100% 세액감면' + (모름 ? ' 잠정 — 확인할 것 남음' : '');
  if (아직) reqs.push(jmReq_('양도일이 10년 된 뒤', false, '양도 ' + T + ' < 10년 되는 날 ' + 열해, '조특법 §97의5①2호'));
  notes.push('감면은 신청해야 받음 — 예정·확정신고 때 과세특례적용신청서(§97의5③·시행령 §97의5④)');
  notes.push('§97의3(장특공 70%)·§97의4(추가공제)와 겹쳐 받지 못함(§97의5②) — 아래 경우를 엔진으로 돌려 납부가 적은 쪽을 고를 것');
  notes.push('감면소득 = 양도소득금액 × (임대기간 마지막 날 − 취득 당시) ÷ (양도 당시 − 취득 당시) 기준시가(시행령 §97의5②) — 임대 끝난 뒤 오른 몫은 과세');
  notes.push('농특세: 감면세액의 20%(농특세법 §5①1호, §4 비과세 목록에 없음) · §133 감면 종합한도 목록에 없음');
  if (아파트 && 매입) notes.push('아파트 매입임대 장기일반은 2020.8.18. 민간임대주택법 개정으로 의무기간이 끝나면 자동말소 — 자동말소 뒤엔 「10년 계속 등록」을 못 채움. §97의5에는 §97의3 옛 시행령 같은 「자동말소 간주」 호가 없음 [판단 대기 — 판단거리3차 #24: 원문대로면 요건 미충족(감면 불가) — 경과조치(부칙) 원문 없어 [확인 필요] 유지, 권장 감면 불가로 잠정]');
  if (끊김.length) notes.push('§97의5는 「계속」 임대 — 6개월 넘는 공실은 끊김(§97의3은 통산이라 날수만 빠짐)');
  if (!r3.요건 || r3.요건.every(function (q) { return q.이름.indexOf('임대개시일 기준시가') < 0; })) notes.push('임대개시일 기준시가 요건 판정 못 함');
  notes.push('기준시가 6억(수도권 밖 3억) 요건의 2018.9.13. 이전 취득 종전 규정(시행령 부칙 2018.10.23.)이 §97의5 준용에도 그대로 미치는지 [판단 대기 — 판단거리3차 #25: §97의5①3호가 §97의3①2호 요건 자체를 끌어오므로 그 요건의 경과규정도 함께 미친다고 읽는 쪽 권장]');
  // 엔진칸
  const 기준 = p.기준시가 || {};
  const 바탕 = p.바탕 || null;
  // 임대가 양도일까지 이어졌는지 — 계약이 양도 전에 끝났으면 「임대기간 마지막 날」 기준시가를 따로 씀(시행령 §97의5②)
  const 끝까지 = 계속끝 ? (!!T && 계속끝 >= T) : (!말소 || (!!T && 말소 >= T));
  if (바탕 && 바탕.transferDate && 바탕.transferPrice) {
    const 맨 = function () { const c = Object.assign({}, 바탕); delete c.rentalSpecialType; delete c.rentalYears; delete c.longTermRentalHouseProvision; return c; };
    const 감 = Object.assign(맨(), { longTermRentalHouseProvision: 'sect97_5', lrAcquisitionStandardPrice: famNum_(기준.취득) || undefined, lrTransferStandardPrice: famNum_(기준.양도) || undefined,
      lrRentalEndStandardPrice: famNum_(기준.임대끝) || undefined, lrRentedUntilTransfer: 끝까지 });
    const 년 = S0 && 끝 ? Math.floor(jmDays_(S0, 끝) / 365.25) : 0;
    if (!안됨 && !아직) 경우.push({ 이름: '① §97의5 임대기간 소득 100% 세액감면' + (모름 ? '(잠정)' : ''), 엔진: 'calculate_transfer_tax_multi', 엔진칸: 감 });
    if (r3.특례율) 경우.push({ 이름: '② §97의3 장특공 ' + r3.특례율 + '% (§97의5와 택1)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign(맨(), { rentalSpecialType: 'rental_general', rentalYears: r3.엔진연수, rentalRegistrationDate: R, rentalHousingKind: 매입 ? 'purchase' : 건설 ? 'construction' : undefined, rentalIsApartment: 아파트,
      acquisitionStandardPrice: famNum_(기준.취득) || 바탕.acquisitionStandardPrice, registrationStandardPrice: famNum_(기준.등록) || famNum_(p.임대개시기준시가) || 바탕.registrationStandardPrice, transferStandardPrice: famNum_(기준.양도) || 바탕.transferStandardPrice }) });
    if (년 >= 6) 경우.push({ 이름: '③ §97의4 추가공제(' + Math.min(년, 10) + '년 임대 — 시행령 §97의4 주택 요건 따로 확인)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign(맨(), { rentalSpecialType: 'rental_long', rentalYears: 년 }) });
    경우.push({ 이름: '④ 특례·감면 없음(일반 장특공)', 엔진: 'calculate_transfer_tax', 엔진칸: 맨() });
    if (안됨) 경우.push({ 이름: '⑤ 잘못 — 요건 안 보고 §97의5 감면', 엔진: 'calculate_transfer_tax_multi', 엔진칸: 감, 잘못: true });
    if (!(famNum_(기준.취득) && famNum_(기준.양도) && (famNum_(기준.임대끝) || 끝까지))) 할일.push({ 무엇: '취득 당시·임대 마지막 날·양도 당시 기준시가(홈택스 조회, 고시 전이면 직전 기준시가)', 때: '계산 전', 근거: '시행령 §97의5②' });
  }
  할일.push({ 무엇: '임대사업자·장기일반 등록증(등록일·말소일), 매매계약서·잔금 영수증(취득일·계약금), 표준임대차계약서 전부, 임차인 주민등록 등본(전입일), 건축물대장(전용면적), 임대개시일 기준시가', 때: '신고 전', 근거: '조특법 §97의5·시행령 §97의5④·§97③④' });
  return jmWrap_('장기일반감면', reqs, { 적용: !안됨 && !아직, 결론: 결론, 잠정: 모름 || undefined, 십년되는날: 열해 || undefined, 계속임대끝: 계속끝 || undefined, 장기임대특례율: r3.특례율, 경우: 경우, 알림: notes, 할일: 할일 });
}

// [2026.11.03 복잡사건 110 「피씨 2013 미분양 아파트」] 신축주택 등 취득자 과세특례(조특법 §99의2·시행령 §99의2) — 요건을 날짜·서류로 가르고 경우마다 엔진칸
function judgeNewHouse99_2_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const H = p.주택 || {}, R = p.해제 || {}, E = p.기존주택 || {}, O = p.오피스텔 || {}, Y = p.양도 || {}, K = p.기준시가 || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const 가산 = function (d, n) { if (!d) return ''; const a = d.split('-').map(Number); const z = new Date(Date.UTC(a[0] + n, a[1] - 1, a[2])); return z.toISOString().slice(0, 10); };
  const 종류 = String(H.종류 || ''), 기존형 = /기존|1주택/.test(종류), 오피 = /오피스텔/.test(종류), 자가 = /자기|자가/.test(종류 + String(H.공급자 || ''));
  const 계약일 = jmYmd_(H.계약일), 계약금일 = jmYmd_(H.계약금지급일), 취득일 = jmYmd_(H.취득일), 승인일 = jmYmd_(H.사용승인일), y일 = jmYmd_(Y.양도일);
  // 1. 취득 기간 — 2013.4.1~12.31 최초 매매계약(12.31까지 계약·계약금 포함), 자기 건설은 그 기간 사용승인
  let 기간, 기간말;
  if (자가) { 기간 = 승인일 ? (승인일 >= '2013-04-01' && 승인일 <= '2013-12-31') : null; 기간말 = 승인일 ? '자기 건설 — 사용승인(임시 포함) ' + 승인일 : '자기 건설 — 사용승인일 빈칸'; }
  else { const 기준 = 계약일 || 계약금일; 기간 = 기준 ? (기준 >= '2013-04-01' && 기준 <= '2013-12-31' && (!계약금일 || 계약금일 <= '2013-12-31')) : null; 기간말 = 기준 ? '매매계약 ' + (계약일 || '?') + (계약금일 ? ' · 계약금 ' + 계약금일 : '') : '매매계약일 빈칸'; if (jmYn_(H.최초계약) === false) { 기간 = false; 기간말 += ' — 최초 매매계약이 아님(전매 취득)'; } }
  reqs.push(jmReq_('2013.4.1~12.31 최초 매매계약(계약금 지급 포함) 또는 그 기간 사용승인', 기간, 기간말, '조특법 §99의2① · 시행령 §99의2①8호'));
  // 2. 대상 주택·상대방 — 신축주택등(①1~9호, 상대방 ⑥1호) 또는 감면대상기존주택(③, 상대방 ⑥2호 = 기존주택 양도자)
  const 공급 = String(H.공급자 || '');
  let 대상 = null, 대상말 = (종류 || '주택 종류 빈칸') + (공급 ? ' · 상대방 ' + 공급 : ' · 상대방 빈칸');
  if (기존형) {
    const 수 = famNum_(E.보유주택수), 등기 = jmYmd_(E.취득등기일), 종전 = jmYmd_(E.종전취득등기일), 다른 = jmYmd_(E.다른주택취득일);
    if (수 === 1) { 대상 = 등기 && 계약일 ? 계약일 >= 가산(등기, 2) : null; 대상말 += ' · 2013.4.1 현재 1세대 1주택, 취득 등기 ' + (등기 || '?') + '~계약 ' + (계약일 || '?') + (대상 === false ? ' — 2년 안 됨' : ''); }
    else if (수 === 2 && 종전 && 다른 && 계약일) { 대상 = 다른 >= 가산(종전, 1) && 계약일 <= 가산(다른, 3) && 계약일 >= 가산(종전, 2); 대상말 += ' · 일시적 2주택(종전 등기 ' + 종전 + ' · 다른 주택 ' + 다른 + ')' + (대상 ? '' : ' — 1년 뒤 취득·3년 안 계약·2년 보유 중 못 채움'); }
    else if (수 != null && 수 >= 2) { 대상 = 수 === 2 ? null : false; 대상말 += ' · 보유 ' + 수 + '주택' + (수 === 2 ? ' — 일시적 2주택 날짜 빈칸' : ''); }
    if (/개인|양도자|기존/.test(공급) === false && 공급) { 대상 = false; 대상말 += ' — 기존주택은 그 주택 양도자와 계약해야 함'; }
  } else if (공급) {
    const 사업 = /사업주체|주택건설|보증공사|시공|구조조정|리츠|신탁|자기|자가|분양사업|건축주/.test(공급);
    대상 = 사업 ? true : /개인|분양권|전매/.test(공급) ? false : null;
    if (/미분양/.test(종류) && jmYn_(H.선착순) === false) { 대상 = false; 대상말 += ' — 2013.3.31까지 안 팔린 주택의 선착순 공급이 아님(①1호)'; }
    if (자가 && (jmYn_(H.재개발조합원) || jmYn_(H.멸실재건축))) { 대상 = false; 대상말 += ' — 조합원 관리처분 주택·멸실 재건축 주택은 빠짐(①8호 단서)'; }
  }
  reqs.push(jmReq_('신축주택등(사업주체 등에게서) 또는 감면대상기존주택(1세대 1주택자에게서)', 대상, 대상말, '시행령 §99의2①1~9호·③1·2호·⑥'));
  // 3. 6억 이하 또는 85㎡ 이하 — 둘 다 넘으면 제외(실거래가액, 취득세·부대비용 뺌)
  const 가 = famNum_(H.실거래가액), 면 = famNum_(H.면적);
  const 넘가 = 가 == null ? null : 가 > 600000000, 넘면 = 면 == null ? null : 면 > 85;
  const 규모 = 넘가 === false || 넘면 === false ? true : (넘가 === true && 넘면 === true ? false : null);
  reqs.push(jmReq_('취득가액 6억 이하 또는 전용(연)면적 85㎡ 이하', 규모, (가 != null ? '실거래가 ' + 가.toLocaleString('ko-KR') : '실거래가 빈칸') + ' · ' + (면 != null ? 면 + '㎡' : '면적 빈칸') + (규모 === false ? ' — 둘 다 넘음' : ''), '조특법 §99의2① · 시행령 §99의2②1호·⑤1호'));
  // 4. 2013.3.31 전 계약을 기간 중 해제하고 다시 산 것 아님
  const 해제 = jmYn_(R.전계약해제), 같은사람 = jmYn_(R.해제자본인또는가족);
  const 해제ok = 해제 === null ? (jmYn_(R.없음) ? true : null) : (해제 === false ? true : 같은사람 === false);
  reqs.push(jmReq_('2013.3.31 전 계약을 기간 중 해제한 주택·그 해제자(가족 포함)의 재계약 주택 아님', 해제ok, 해제 === null && !jmYn_(R.없음) ? '해제 이력 모름' : 해제 ? '해제 이력 있음 — ' + (같은사람 ? '해제한 사람·배우자·직계존비속·형제자매가 다시 삼' : 같은사람 === false ? '해제자와 무관한 사람' : '다시 산 사람이 해제자 가족인지 모름') : '해제 이력 없음', '시행령 §99의2②2호·3호·⑤2호'));
  // 5. 오피스텔 — 60일 뒤부터 양도일까지 주민등록(퇴거 6개월 공백 인정) 또는 60일 안 임대 등록
  if (오피) {
    const 주민 = jmYn_(O.주민등록), 임대 = jmYn_(O.임대등록60일);
    const ok = 주민 === true || 임대 === true ? true : (주민 === false && 임대 === false ? false : null);
    reqs.push(jmReq_('오피스텔 — 60일 뒤부터 양도일까지 주민등록 또는 60일 안 임대주택 등록', ok, '주민등록 ' + (주민 === null ? '모름' : 주민 ? '계속' : '빈 기간 있음') + ' · 임대 등록 ' + (임대 === null ? '모름' : 임대 ? '60일 안' : '없음'), '시행령 §99의2②4호·⑤3호'));
  }
  // 6. 확인 날인 계약서 제출 — 법 ④ "확인받아 제출한 경우에만"
  const 날인 = jmYn_(H.날인);
  reqs.push(jmReq_('시장·군수·구청장 확인 날인 매매계약서를 신고 때 제출', 날인, 날인 === null ? '날인 계약서가 있는지 모름' : 날인 ? '날인 받음' : '날인 없음', '조특법 §99의2④ · 시행령 §99의2⑧·⑪·⑫'));
  const 막힘 = reqs.filter(function (r) { return r.결과 === '✘'; }), 모름 = reqs.filter(function (r) { return r.결과 === '?'; });
  // 5년 안·뒤
  const 오년 = 취득일 ? 가산(취득일, 5) : '', 안 = 취득일 && y일 ? y일 <= 오년 : null;
  const 공통 = { assetType: 'house', transferPrice: famNum_(Y.양도가액) || undefined, transferDate: y일 || undefined, acquisitionDate: 취득일 || undefined, acquisitionPrice: famNum_(Y.취득가액) || 가 || undefined, necessaryExpenses: famNum_(Y.필요경비) || undefined, houseCount: famNum_(Y.주택수) || undefined };
  const 오년칸 = { nhAcquisitionStandardPrice: famNum_(K.취득) || undefined, nhFiveYearStandardPrice: famNum_(K.오년) || undefined, nhTransferStandardPrice: famNum_(K.양도) || undefined };
  const 기준시가빈칸 = 안 === false && !(famNum_(K.취득) && famNum_(K.오년) && famNum_(K.양도));
  if (기준시가빈칸) 할일.push('5년(' + 오년 + ') 지나 양도 — 5년간 소득만 공제하므로 취득·5년 되는 날·양도 당시 기준시가를 넣어야 셈(시행령 §99의2⑦·§40①)');
  if (y일) {
    경우.push({ 이름: '① 법대로' + (막힘.length ? ' — 요건 못 채워 감면 없음' : 안 ? ' — 5년 안 양도, 세액 100% 감면' : ' — 5년 뒤 양도, 5년간 소득 공제') + (모름.length ? ' [잠정]' : '') + (!막힘.length && 기준시가빈칸 ? ' [잠정 — 기준시가 없어 엔진이 보유기간으로 안분한 근사치]' : ''), 엔진칸: Object.assign({}, 공통, 막힘.length ? {} : Object.assign({ newHouseReductionProvision: 'sect99_2', nhIsPriceOrAreaQualified: true }, 안 === false ? 오년칸 : {})) });
    경우.push({ 이름: '② 감면 없음', 엔진칸: Object.assign({}, 공통) });
  }
  let 결론;
  if (막힘.length) 결론 = '감면 안 됨 — ' + 막힘.map(function (r) { return r.이름; }).join('·');
  else if (모름.length) 결론 = '잠정 감면 — 남은 것: ' + 모름.map(function (r) { return r.이름; }).join('·');
  else 결론 = (안 === false ? '5년간(' + 오년 + '까지) 소득 공제' : '양도소득세 100% 세액 감면') + ' — 예정·확정신고 때 날인 계약서 사본 제출';
  notes.push('§99의2에는 고가주택 배제 단서가 없음(§99①·§99의3① 단서와 다름) — 양도가액이 고가주택 기준을 넘어도 감면 대상');
  notes.push('§99의2② 이 주택은 다른 주택의 1세대1주택 비과세(소득세법 §89①3호) 판정 때 거주자 소유주택으로 보지 않음 — 1세대1주택 판정에서 주택 수에서 뺄 것');
  notes.push('감면세액의 20%는 농어촌특별세(농특세법 §5①1호, 비과세 목록 §4·시행령 §4에 없음) · §133 감면 종합한도 목록에는 없음');
  notes.push('같은 해 다른 양도와 합산하면 이 자산 소득도 과세표준에 남기고 그 몫 산출세액을 뺌(엔진 처리)');
  notes.push('§99의2③ 가격 급등 지역 제외는 시행령에 지역을 정한 항이 없음 (원문 확인 2026-11-04: 조특법 §99의2③·조특령 §99의2(「제99조의2제3항」 grep 0건))');
  if (y일 && !막힘.length) 할일.push('양도소득 과세표준 예정신고 또는 확정신고와 함께 확인 날인 매매계약서 사본 제출(시행령 §99의2⑧)');
  if (날인 === false || 날인 === null) 할일.push('날인 계약서가 없으면 사업주체등·시·군·구청 확인대장(시행령 ⑪·⑭·⑯)에서 확인받을 수 있는지 알아볼 것');
  서류.push('시장·군수·구청장 확인 날인 매매계약서(신축주택등 또는 감면대상기존주택)', '최초 분양(매매)계약서·계약금 영수증', '등기부등본·건축물대장(면적)');
  if (기존형) 서류.push('2013.4.1 현재 주민등록표(1세대 1주택)', '양도자 주택 취득 등기 자료');
  if (오피) 서류.push('오피스텔 주민등록 기록 또는 임대주택 등록증');
  if (안 === false) 서류.push('취득·5년 되는 날·양도 당시 기준시가 자료');
  return jmWrap_('신축주택감면', reqs, { 적용: 막힘.length === 0, 결론: 결론, 기준일: today, 오년안: 안, 오년되는날: 오년, 주택수: '안 듦(§99의2②)', 경우: 경우, 알림: notes, 할일: 할일, 받을서류: 서류 });
}
// [2026.11.03 복잡사건 112 「여씨 — 아내에게 판 상가, 아들을 거쳐 판 땅」] 배우자 등에게 양도한 재산의 증여 추정 — 상증법 §44, 시행령 §33
//  ① 배우자·직계존비속(배우자등)에게 양도한 재산은 양도한 때의 재산가액을 배우자등이 증여받은 것으로 추정.
//  ② 특수관계인에게 양도한 재산을 그 특수관계인(양수자)이 양수일부터 3년 안에 당초 양도자의 배우자등에게 다시 양도하면, 재양도 당시 재산가액을 그 배우자등이 당초 양도자에게서 증여받은 것으로 추정
//     — 단서: 당초 양도자·양수자가 낸 소득세 결정세액 합계가 그 증여세보다 크면 적용 안 함.
//  ③ 적용 안 함: 1호 법원 결정 경매 2호 파산선고 처분 3호 국세징수법 공매 4호 증권시장 처분(시행령 §33② 시간외시장 매매 등 제외) 5호 대가를 받고 양도한 사실이 명백한 경우(시행령 §33③ 1~3호).
//  ④ ② 본문으로 증여세가 부과되면 당초 양도자·양수자에게 그 양도의 소득세를 부과하지 않음.
function judgeSpouseTransfer44_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const relOf = function (r) { r = String(r || ''); return /배우자|처|남편|아내/.test(r) ? '배우자' : /부모|아버지|어머니|조부|할아버지|할머니|직계존속/.test(r) ? '직계존속' : /자녀|아들|딸|손자|손녀|직계비속/.test(r) ? '직계비속' : /친족|형제|자매|누나|언니|오빠|동생|사촌|삼촌|조카|며느리|사위|특수관계/.test(r) ? '기타친족' : r ? '기타' : ''; };
  const 우 = p.우회 && typeof p.우회 === 'object' ? p.우회 : null;
  const rel = relOf(우 ? (우.최종양수인관계 || p.관계) : p.관계);
  const 배우자등 = rel === '배우자' || rel === '직계존속' || rel === '직계비속';
  const 시가 = num(우 ? (우.재양도시가 || p.시가) : p.시가), 대가 = num(우 ? (우.재양도대가 || p.대가) : p.대가);
  const 양도일 = jmYmd_(우 ? 우.재양도일 : p.양도일) || '';
  const 자산 = String(p.자산 || '토지'), 취득가액 = num(p.취득가액), 취득일 = jmYmd_(p.취득일) || '', 비용 = num(p.양도비용);
  const 방식 = String(p.처분방식 || '매매');
  const 거주 = jmYn_(p.수증자거주자) !== false, 앞증여 = num(p.수증자10년안증여);
  // 관계
  reqs.push(jmReq_(우 ? '최종 양수인이 당초 양도자의 배우자·직계존비속' : '양수인이 배우자·직계존비속', rel ? 배우자등 : null, rel ? rel + (배우자등 ? '' : ' — 배우자등이 아니라 §44 증여추정 대상 아님(특수관계면 §35 저가·고가, 소득세법 §101만 봄)') : '양수인과의 관계를 모름(가족관계증명서)', '상증법 §44①②'));
  // ③ 1~4호 배제
  let 배제 = null, 배제왜 = '';
  if (/경매/.test(방식)) { 배제 = true; 배제왜 = '법원 결정 경매 — §44③1호'; }
  else if (/파산/.test(방식)) { 배제 = true; 배제왜 = '파산선고 처분 — §44③2호'; }
  else if (/공매/.test(방식)) { 배제 = true; 배제왜 = '국세징수법 공매 — §44③3호'; }
  else if (/다자간/.test(방식) && /종가/.test(방식)) { 배제 = true; 배제왜 = '다자간매매체결회사 당일 종가 거래 — 시행령 §33②2호 괄호로 추정 배제(§44③4호)'; }
  else if (/시간외|다자간|장외|블록/.test(방식)) { 배제 = false; 배제왜 = 방식 + ' — 증권시장 처분이라도 시행령 §33②(1호 시간외시장 매매, 2호 다자간매매체결회사의 가격결정 거래 — 당일 종가 거래는 제외)는 배제에서 뺌(추정 적용, 원문 확인 2026-11-04)'; }
  else if (/증권시장|장내|거래소|코스피|코스닥/.test(방식)) { 배제 = true; 배제왜 = '증권시장에서 처분(서로 모르는 사람끼리 사고팖) — §44③4호'; }
  else if (/교환/.test(방식)) { 배제 = true; 배제왜 = '권리 이전·행사에 등기·등록이 필요한 재산을 서로 교환 — 대가 명백(§44③5호·시행령 §33③1호)'; }
  reqs.push(jmReq_('경매·파산·공매·증권시장·교환이 아님', 배제 === true ? false : true, 배제왜 || 방식 + ' — 배제 사유 아님', '상증법 §44③1~5호·시행령 §33②③'));
  // ③5호 대가 입증
  const 출처 = Array.isArray(p.대가출처) ? p.대가출처 : [];
  let 입증 = 0, 차입 = 0, 모름 = 0;
  const 출처줄 = 출처.map(function (s) {
    const 금 = num(s.금액), 종 = String(s.출처 || ''), 증 = jmYn_(s.증빙) === true;
    let 뜻;
    if (/신고|소득|근로|사업|급여|과세/.test(종) && 증) { 입증 += 금; 뜻 = '✔ 이미 과세(비과세·감면 포함)받았거나 신고한 소득 — 시행령 §33③2호'; }
    else if (/상속|증여|수증/.test(종) && 증) { 입증 += 금; 뜻 = '✔ 상속·증여받은 재산 — 시행령 §33③2호'; }
    else if (/처분|매각|팔|예금|적금|해지/.test(종) && 증) { 입증 += 금; 뜻 = '✔ 자기 재산을 처분한 돈 — 시행령 §33③3호'; }
    else if (/차입|대출|빌/.test(종)) { 차입 += 금; 뜻 = '? 빌린 돈 — 시행령 §33③ 1~3호에 없음. 양수인이 자기 소득으로 갚았는지에 따라 갈림 [판단 대기 — 판단거리3차 #26: ①열거에 없어 입증 불인정 ②차입금 상환 재원이 2·3호 재원으로 입증되면 인정(권장) — 예규·판례 필요]'; }
    else { 모름 += 금; 뜻 = '✘ ' + (증 ? '출처 「' + 종 + '」가 §33③에 없음' : '증빙 없음'); }
    return (종 || '출처 모름') + ' ' + famWon_(금) + ' ' + 뜻;
  });
  const 전부입증 = 배제 !== true && 대가 > 0 && 입증 >= 대가;
  const 일부입증 = 배제 !== true && 대가 > 0 && !전부입증 && 입증 + 차입 > 0;
  if (배제 !== true) reqs.push(jmReq_('대가를 치른 것이 입증되지 않음(소득·상속증여재산·처분재산으로 치른 것이 입증되면 추정 안 함)', 대가 > 0 ? (전부입증 ? false : (일부입증 && 입증 + 차입 >= 대가 ? null : true)) : true,
    대가 > 0 ? '대가 ' + famWon_(대가) + ' 중 입증 ' + famWon_(입증) + (차입 ? ' · 빌린 돈 ' + famWon_(차입) : '') + (모름 ? ' · 입증 못 함 ' + famWon_(모름) : '') + (전부입증 ? ' → 대가 명백, 추정 안 함' : '') : '대가를 넣지 않음(대가 없이 넘겼으면 그대로 증여)', '상증법 §44③5호·시행령 §33③2·3호'));
  // ② 우회 3년·단서
  let 우회기간 = null, 단서 = null;
  if (우) {
    const d1 = jmYmd_(우.당초양도일), d2 = jmYmd_(우.재양도일);
    if (d1 && d2) { const 끝 = famAddY_(d1, 3); 우회기간 = d2 <= 끝; reqs.push(jmReq_('특수관계인이 양수일부터 3년 안에 배우자등에게 재양도', 우회기간, '당초 ' + d1 + ' → 재양도 ' + d2 + ' (3년 끝 ' + 끝 + ')', '상증법 §44②')); }
    else reqs.push(jmReq_('특수관계인이 양수일부터 3년 안에 배우자등에게 재양도', null, '당초 양도일·재양도일을 모름', '상증법 §44②'));
    reqs.push(jmReq_('중간 양수인이 당초 양도자의 특수관계인', jmYn_(우.중간특수관계), 우.중간관계 || '중간 양수인과 당초 양도자의 관계(시행령 §2의2)', '상증법 §44②·시행령 §2의2'));
    const 결정합 = num(우.당초양도자결정세액) + num(우.양수자결정세액), 비교 = num(우.비교증여세);
    if (비교 > 0) { 단서 = 결정합 > 비교; reqs.push(jmReq_('소득세 결정세액 합계가 증여세보다 크지 않음(②단서)', !단서, '당초 양도자 ' + famWon_(num(우.당초양도자결정세액)) + ' + 중간 양수자 ' + famWon_(num(우.양수자결정세액)) + ' = ' + famWon_(결정합) + ' vs 증여추정 증여세 ' + famWon_(비교), '상증법 §44② 단서')); }
    else { reqs.push(jmReq_('소득세 결정세액 합계가 증여세보다 크지 않음(②단서)', null, '소득세 결정세액 합계 ' + famWon_(결정합) + ' — 경우 ①을 엔진으로 돌린 산출세액(비교증여세)과 견줘야 정해짐', '상증법 §44② 단서')); notes.push('②단서 비교: 경우 ① 증여세(엔진)를 돌려 「비교증여세」로 다시 넣으면 판정이 정해집니다. 결정세액은 「신고」가 아닌 「결정」세액(경정 포함) [확인 필요 — 권장: ①결정·경정된 세액만 ②신고로 확정된 세액(예정신고 포함)도 「결정세액」으로 봄(권장, 국세기본법 §22 신고확정)]'); }
  }
  // 결론
  const 추정 = 배우자등 && 배제 !== true && !전부입증 && (우 ? (우회기간 !== false && 단서 !== true && jmYn_(우.중간특수관계) !== false) : true) && (대가 > 0 || 출처.length || 시가 > 0);
  const 증여자 = 우 ? '당초 양도자' : '양도자';
  const g = function (금) { return { giftAmount: 금, relation: rel || '기타', giftDate: 양도일 || undefined, isDoneeResident: 거주, priorGiftAmount: 앞증여 || undefined }; };
  const tbase = Object.assign({ assetType: /주택|아파트/.test(자산) ? 'house' : /토지|땅|농지|임야/.test(자산) ? 'land' : 'other', acquisitionPrice: 취득가액 || undefined, acquisitionDate: 취득일 || undefined, necessaryExpenses: 비용 || undefined, transferDate: 양도일 || undefined }, p.엔진칸 || {});
  const ad = 시가 > 0 && 대가 > 0 ? Math.abs(시가 - 대가) : 0, 저가 = 대가 > 0 && 대가 < 시가, 고가 = 대가 > 시가 && 시가 > 0;
  const 오퍼 = 시가 > 0 && (ad >= 300000000 || ad >= 시가 * 0.05);
  const gate35 = Math.min(시가 * 0.3, 300000000), 증여35 = ad >= gate35 && ad > 0 ? Math.round(ad - gate35) : 0;
  const 대가길 = function (머리) {
    // 대가 인정 — 양도자 양도세(§101 시가 재계산·§96③2호가), 저가면 수증자 §35①1호, 고가면 양도자 §35①2호
    const 양가 = 저가 && 오퍼 ? 시가 : 고가 ? 대가 - 증여35 : 대가;
    경우.push({ 이름: 머리 + ' — 양도자 양도소득세(양도가액 ' + famWon_(양가) + (저가 && 오퍼 ? ', 싸게 팔아 시가로 다시 셈 소득세법 §101①·소득령 §167③④' : 고가 && 증여35 ? ', 비싸게 받은 증여분 뺌 §96③2호가' : '') + ')', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, tbase, { transferPrice: 양가 }) });
    if (저가 && 증여35) 경우.push({ 이름: 머리 + ' — 양수인 저가양수 증여(차액 ' + famWon_(ad) + ' − min(시가 30%, 3억) = ' + famWon_(증여35) + ', 상증법 §35①1호)', 엔진: 'calculate_gift_tax', 엔진칸: g(증여35) });
    if (고가 && 증여35) 경우.push({ 이름: 머리 + ' — 양도자 고가양도 증여(' + famWon_(증여35) + ', 상증법 §35①2호 — 증여자는 양수인)', 엔진: 'calculate_gift_tax', 엔진칸: Object.assign(g(증여35), { relation: rel === '직계비속' ? '직계존속' : rel === '직계존속' ? '직계비속' : rel || '기타' }) });
  };
  if (!배우자등 && rel) notes.push('양수인이 배우자·직계존비속이 아니라 §44는 걸리지 않음 — 싸거나 비싸게 거래했으면 상증법 §35·소득세법 §101만 봄(넥스 「법인거래」·저가매매 도구)');
  if (배제 === true) { notes.push('§44③ 배제 — ' + 배제왜 + '. 보통 양도로 양도소득세만 셈'); if (배우자등) 대가길('① 배제 — 보통 양도'); }
  else if (배우자등) {
    if (우 && 추정) {
      경우.push({ 이름: '① 증여추정(§44②) — 재양도 당시 가액 ' + famWon_(시가) + '을 ' + 증여자 + '에게서 증여받은 것으로, 당초·재양도 양도세는 없음(§44④)', 엔진: 'calculate_gift_tax', 엔진칸: g(시가) });
      const p1 = num(우.당초양도가액), p2 = num(우.재양도대가 || p.대가);
      경우.push({ 이름: '② 단서로 추정 안 되면 — 당초 양도(' + famWon_(p1) + ') 양도세', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, tbase, { transferPrice: p1 || undefined, transferDate: jmYmd_(우.당초양도일) || undefined }) });
      경우.push({ 이름: '② 단서로 추정 안 되면 — 중간 양수인 재양도(' + famWon_(p2) + ') 양도세(취득가액 = 당초 양도가액)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, tbase, { transferPrice: p2 || undefined, acquisitionPrice: p1 || undefined, acquisitionDate: jmYmd_(우.당초양도일) || undefined, transferDate: 양도일 || undefined }) });
      notes.push('②는 양도 두 번이 실제 대가로 이루어졌어도 추정 — 다만 ③5호(최종 양수인이 대가를 자기 소득·재산으로 치른 것이 명백)면 적용 안 함 (원문 확인 2026-11-04: 상증법 §44③ 본문 「제1항과 제2항을 적용하지 아니한다」)');
      할일.push({ 무엇: '당초 양도자·중간 양수자의 양도소득세 결정 통지서(결정세액) 확보 — ②단서 비교', 때: '증여세 신고 전', 근거: '상증법 §44② 단서' });
    } else if (추정) {
      경우.push({ 이름: '① 법대로 — 증여추정: 양도한 때 재산가액 ' + famWon_(시가) + '을 ' + rel + '(이)가 증여받음(양도자 양도세 없음)', 엔진: 'calculate_gift_tax', 엔진칸: g(시가) });
      if (일부입증) {
        경우.push({ 이름: '② [판단 대기 — 판단거리3차 #27: ①「대가를 지급한 사실이 입증」 요건 미충족이면 전체 추정 ②입증분만 빼고 나머지 증여 — 권장 ①(문언), 다만 실무상 ②도 쓰여 두 경우 유지] 입증한 대가만 빼면 — ' + famWon_(Math.max(0, 시가 - 입증)) + ' 증여', 엔진: 'calculate_gift_tax', 엔진칸: g(Math.max(0, 시가 - 입증)) });
        notes.push('[판단 대기 — 판단거리3차 #28: 같음] 대가 일부만 입증될 때 §44③5호가 「명백히 인정」 요건이라 전체를 추정하는지, 입증 부분을 빼는지 — 경우 ①(전체)과 ②(뺌)를 나란히 둠');
        if (차입) 대가길('③ 빌린 돈까지 대가로 인정되면');
      }
      notes.push('증여 「추정」이라 반증할 수 있음 — 양수인이 대가를 자기 소득·상속재산·처분재산으로 치른 사실(계좌 이체·소득 신고 내역)을 내면 보통 양도로 바뀜(§44③5호)');
      할일.push({ 무엇: '양수인 대가 자금 증빙 — 이체 내역(양수인 계좌 → 양도자 계좌)·원천(소득금액증명·상속/증여세 신고서·처분 계약서)', 때: '증여세 신고기한 전', 근거: '시행령 §33③2·3호' });
      if (대가 > 0) notes.push('대가로 받은 돈이 다시 양수인에게 돌아갔으면(되돌려 줌) 대가를 받은 것이 아님 — 양도자 계좌 흐름도 볼 것 [실사건 때 확인]');
    } else if (전부입증) {
      notes.push('대가 ' + famWon_(대가) + '를 양수인이 자기 소득·재산으로 치른 것이 입증됨 — §44③5호로 추정 안 함, 보통 양도');
      대가길('① 법대로 — 대가 명백');
      경우.push({ 이름: '② 증빙이 받아들여지지 않으면 — 증여추정 ' + famWon_(시가), 엔진: 'calculate_gift_tax', 엔진칸: g(시가) });
    } else if (우) {
      const p1 = num(우.당초양도가액), p2 = num(우.재양도대가 || p.대가);
      notes.push(단서 === true ? '②단서 — 당초 양도자·중간 양수자 소득세 결정세액 합계가 증여세보다 커 증여추정 안 함: 두 양도 각각 양도소득세' : '3년이 지나 재양도했거나 중간 양수인이 특수관계인이 아님 — §44② 안 걸림, 두 양도 각각 양도소득세(싸게 넘겼으면 §101 부당행위는 따로)');
      경우.push({ 이름: '① 법대로 — 당초 양도(' + famWon_(p1) + ') 양도세', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, tbase, { transferPrice: p1 || undefined, transferDate: jmYmd_(우.당초양도일) || undefined }) });
      경우.push({ 이름: '① 법대로 — 중간 양수인 재양도(' + famWon_(p2) + ') 양도세', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, tbase, { transferPrice: p2 || undefined, acquisitionPrice: p1 || undefined, acquisitionDate: jmYmd_(우.당초양도일) || undefined, transferDate: 양도일 || undefined }) });
    }
  }
  if (추정) {
    if (rel === '배우자') notes.push('배우자 증여재산공제 6억(10년 합산, 상증법 §53 1호) — 앞 10년 배우자 증여가 있으면 수증자10년안증여 칸에');
    notes.push('증여추정으로 증여세를 낸 재산을 수증자가 나중에 팔 때: 취득가액 = 증여재산가액(소득령 §163⑨), 다만 10년 안 팔면 배우자·직계존비속 이월과세(소득세법 §97의2①)로 당초 ' + 증여자 + ' 취득가액을 씀 — 넥스 「가족 지도」 잇기');
    할일.push({ 무엇: '증여세 신고(수증자)', 때: 양도일 ? new Date(Date.UTC(+양도일.slice(0, 4), +양도일.slice(5, 7) + 3, 0)).toISOString().slice(0, 10) + '까지(양도일이 든 달 말일부터 3개월)' : '양도일이 든 달 말일부터 3개월', 근거: '상증법 §68①' });
    if (!우) notes.push('양도자가 이미 양도소득세를 신고·납부했으면 증여추정으로 바뀔 때 그 양도세는 경정청구로 돌려받음 [확인 필요 — 권장: ①엔 명문 없음이 사실 — 증여로 재구성되면 양도가 없는 것이므로 양도세 경정청구(5년)로 돌려받는 쪽 권장]');
  }
  if (!(시가 > 0)) 할일.push({ 무엇: '양도한 때 재산가액(상증법 §60 시가 — 매매사례·감정, 없으면 §61 기준시가)', 때: '판정 전', 근거: '상증법 §44①·§60·§61' });
  notes.push('재산가액은 대가가 아니라 「양도한 때의 재산가액」(상증법 §60 시가) — 대가를 넣으면 증여가 줄어 보임');
  const w = jmWrap_('배우자양도추정', reqs, { 관계: rel || null, 우회: !!우, 배제: 배제 === true, 대가입증: 대가 > 0 ? (전부입증 ? '전부' : 일부입증 ? '일부' : '없음') : null, 입증금액: 입증, 대가출처: 출처줄, 추정: !!추정, 재산가액: 시가 || null, 경우: 경우, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일 });
  w.결론 = 배제 === true ? '§44 배제(' + 배제왜 + ')' : !배우자등 ? (rel ? '§44 대상 아님(' + rel + ')' : '관계 모름') : 추정 ? '증여추정 — ' + famWon_(시가) + (일부입증 ? ' (대가 일부 입증 — 두 경우)' : '') : 전부입증 ? '대가 명백 — 보통 양도' : (우 && 단서 === true ? '②단서 — 소득세 결정세액이 더 커 추정 안 함' : 우 && 우회기간 === false ? '3년 지나 재양도 — §44② 안 걸림' : '판정 못 함(칸 부족)');
  return w;
}

// [2026.11.03 복잡사건 113 「소씨 상가 신탁 수익권」] 신탁 수익권 양도 — 소득세법 §94①6호·시행령 §159의3, §2의3, §104①14호, §102①4호, §103①, §105①1호, §99①8호(상증법 §65①)
//  ① 신탁의 이익을 받을 권리(수익권) 양도는 양도소득(§94①6호) — 3억 이하 20%·초과분 25%(§104①14호), 결손은 다른 묶음과 합하지 않고(§102①4호) 기본공제 250만을 따로(§103①).
//  ② 빼는 수익권(시행령 §159의3): 1호 자본시장법 §110 수익증권 2호 §189 투자신탁 수익권 중 배당소득 과세분 3호 양도소득이 배당소득으로 과세되는 수익권
//     4호 위탁자의 채권자가 채권 원리금 범위에서 선순위 수익자로 참여한 담보 수익권(수탁자가 §115의2 명세서 제출).
//  ③ 단서: 수익권 양도로 신탁재산에 대한 지배·통제권이 사실상 이전되면 신탁재산 자체의 양도로 봄 — 부동산이면 부동산 양도세(장특공·기본세율).
//  ④ 신탁 소득은 수익자에게 귀속(§2의3①), 위탁자가 실질 통제하면 위탁자(§2의3②·시행령 §4의2④).
function judgeTrustBeneficiary_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 권 = p.수익권 && typeof p.수익권 === 'object' ? p.수익권 : {};
  const 종류 = String(권.종류 || p.종류 || '');
  const 양도일 = jmYmd_(p.양도일) || '', 취득일 = jmYmd_(p.취득일) || '';
  const 양가 = num(p.양도가액), 취가 = num(p.취득가액), 비용 = num(p.양도비용), 앞공제 = num(p.같은해쓴기본공제);
  // ② 빼는 수익권
  const yn = function (k) { return jmYn_(권[k]); };
  let 제외 = null, 제외왜 = '';
  if (yn('자본시장법수익증권') === true || /수익증권/.test(종류)) { 제외 = true; 제외왜 = '자본시장법 §110 수익증권 — 시행령 §159의3 1호'; }
  else if ((yn('투자신탁') === true || /투자신탁|펀드/.test(종류)) && yn('배당소득과세') !== false) { 제외 = yn('배당소득과세') === true ? true : null; 제외왜 = '자본시장법 §189 투자신탁 수익권' + (제외 ? ' 중 배당소득 과세분 — 시행령 §159의3 2호' : ' — 배당소득으로 과세되는지 모름(2호)'); }
  else if (yn('배당소득과세') === true) { 제외 = true; 제외왜 = '양도소득이 배당소득으로 과세되는 수익권 — 시행령 §159의3 3호'; }
  else if (yn('담보채권자') === true || /담보|우선수익/.test(종류)) {
    const 범위 = yn('채권원리금범위');
    제외 = 범위 === true ? true : 범위 === false ? false : null;
    제외왜 = '위탁자의 채권자가 선순위 수익자로 참여한 담보 수익권 — ' + (범위 === true ? '채권 원리금 범위 안 → 시행령 §159의3 4호로 뺌' : 범위 === false ? '채권 원리금 범위를 넘음 — 4호는 「채권 원리금의 범위 내에서」 참여한 수익권만 빼므로 이 수익권 전체가 과세 대상(시행령 §159의3 4호 문언, 원문 확인 2026-11-04)' : '채권 원리금 범위 안인지 모름');
  } else { 제외 = false; 제외왜 = (종류 || '수익권') + ' — 시행령 §159의3 1~4호 아님'; }
  reqs.push(jmReq_('양도소득세에서 빼는 수익권이 아님', 제외 === true ? false : 제외 === false ? true : null, 제외왜, '소득세법 §94①6호 괄호·시행령 §159의3'));
  // ③ 지배·통제권 사실상 이전
  const 지 = p.지배이전 && typeof p.지배이전 === 'object' ? p.지배이전 : {};
  const 위탁자지위 = jmYn_(지.위탁자지위이전), 전부 = jmYn_(지.수익권전부), 권한 = jmYn_(지.해지권처분지시권이전);
  let 이전 = null, 이전왜 = '';
  if (위탁자지위 === true) { 이전 = true; 이전왜 = '위탁자 지위까지 함께 넘김 — 신탁재산을 처분·해지할 권한이 넘어감'; }
  else if (전부 === true && 권한 === true) { 이전 = true; 이전왜 = '수익권 전부와 해지권·처분지시권이 함께 넘어감'; }
  else if (전부 === false || 권한 === false || 위탁자지위 === false && 권한 === false) { 이전 = false; 이전왜 = (전부 === false ? '수익권 일부만 양도' : '해지권·처분지시권은 그대로') + ' — 신탁재산 지배·통제권이 넘어가지 않음'; }
  else 이전왜 = '위탁자 지위·해지권·처분지시권이 넘어가는지 모름(신탁계약서·양도계약서) — 두 경우 모두 셈';
  if (제외 !== true) reqs.push(jmReq_('신탁재산 지배·통제권이 사실상 넘어가지 않음(넘어가면 신탁재산 양도)', 이전 === true ? false : 이전 === false ? true : null, 이전왜 + ' [판단 대기 — 판단거리3차 #29: 기준 조문 없음 — 위탁자 지위·해지권·처분지시권 이전 여부(계약서)로 보는 지금 방식 권장]', '소득세법 §94①6호 단서'));
  // ④ 소득 귀속자
  const 통 = p.위탁자통제 && typeof p.위탁자통제 === 'object' ? p.위탁자통제 : {};
  const 양도인지위 = String(p.양도인지위 || '수익자');
  const 통제 = jmYn_(통.해지권) === true || jmYn_(통.수익자변경권) === true || jmYn_(통.잔여재산귀속) === true || (jmYn_(통.원본은위탁자) === true && jmYn_(통.수익자배우자등) === true);
  if (/^수익자/.test(양도인지위) && 통제) notes.push('위탁자가 신탁을 실질 통제(해지권·수익자 변경권·잔여재산 귀속, 또는 원본은 위탁자·수익은 배우자·동거 직계존비속) — 신탁 소득은 위탁자 귀속(소득세법 §2의3②·시행령 §4의2④). 수익자가 넘긴 수익권 양도소득을 위탁자에게 과세하는지 [확인 필요 — 권장: §2의3은 「신탁재산에 귀속되는 소득」만 위탁자 귀속 — 수익권 자체의 양도소득은 양도한 수익자 소득으로 보는 쪽 권장]');
  // 경우
  const 신 = p.신탁재산 && typeof p.신탁재산 === 'object' ? p.신탁재산 : {};
  const 재자산 = String(신.자산 || '건물');
  const sbase = { assetCategory: 'trust_beneficiary', transferPrice: 양가 || undefined, acquisitionPrice: 취가 || undefined, transferExpenses: 비용 || undefined, transferDate: 양도일 || undefined, basicDeductionAlreadyUsed: 앞공제 || undefined };
  const tbase = Object.assign({ assetType: /주택|아파트/.test(재자산) ? 'house' : /토지|땅|농지|임야/.test(재자산) ? 'land' : 'other', transferPrice: num(신.양도가액) || 양가 || undefined, transferDate: 양도일 || undefined,
    acquisitionPrice: num(신.취득가액) || undefined, acquisitionDate: jmYmd_(신.취득일) || undefined, necessaryExpenses: 비용 || undefined, acquisitionCause: 'purchase' }, p.엔진칸 || {});
  if (제외 === true) {
    notes.push('양도소득세 대상 아님 — ' + 제외왜 + '. 양도·환매 이익은 배당소득(소득세법 §17) 등 다른 소득으로 과세될 수 있음 [실사건 때 확인: 이 도구는 배당소득을 셈하지 않음]');
  } else {
    if (이전 !== true) 경우.push({ 이름: (이전 === false ? '① 법대로' : '① 지배권이 안 넘어가면') + ' — 신탁 수익권 양도(§94①6호, 20%·25%, 장특공 없음, 기본공제 따로)', 엔진: 'calculate_stock_transfer_tax', 엔진칸: sbase });
    if (이전 !== false) 경우.push({ 이름: (이전 === true ? '① 법대로' : '② 지배권이 넘어가면') + ' — 신탁재산(' + 재자산 + ') 자체 양도(§94①6호 단서, 취득가액·취득일은 신탁재산 것)', 엔진: 'calculate_transfer_tax', 엔진칸: tbase });
    if (이전 === true) 경우.push({ 이름: '② [견주기] 수익권 양도로 잘못 신고하면', 엔진: 'calculate_stock_transfer_tax', 엔진칸: sbase });
  }
  // 알림·할일
  if (제외 !== true) {
    notes.push('예정신고: 양도일이 속하는 달의 말일부터 2개월(소득세법 §105①1호) — 주식처럼 반기가 아님. 엔진 결과 「예정신고기한」');
    notes.push('기본공제 250만원은 신탁 수익권 묶음에서 따로 1회(§103①), 같은 해 다른 수익권 양도에서 쓴 공제는 같은해쓴기본공제 칸에. 수익권 양도차손은 부동산·주식 소득과 합하지 않음(§102①4호)');
    if (!(취가 > 0)) 할일.push({ 무엇: '수익권 취득가액(실지거래가액) — 없으면 기준시가는 상증법 §65① 준용 평가(소득세법 §99①8호, 원본·수익 수익자가 같으면 신탁재산 평가액, 다르면 원본권·수익권 나눠 평가 — 상증법 시행령 §61, 평가기준일은 양도일·취득일 소득령 §164⑫)', 때: '계산 전', 근거: '소득세법 §97①·§99①8호' });
    if (이전 === true && !(num(신.취득가액) > 0)) 할일.push({ 무엇: '신탁재산의 당초 취득가액·취득일(위탁자가 신탁 전에 산 값 — 등기부·매매계약서)', 때: '계산 전', 근거: '소득세법 §94①6호 단서·§97' });
    if (양도일) 할일.push({ 무엇: '양도소득세 예정신고', 때: new Date(Date.UTC(+양도일.slice(0, 4), +양도일.slice(5, 7) + 2, 0)).toISOString().slice(0, 10) + '까지', 근거: '소득세법 §105①1호' });
    notes.push('수탁자는 수익자명부 변동명세서를 다음 해 5월에 냄(소득세법 §115의2) — 세무서가 양도를 알게 됨');
  }
  const 관 = String(p.양수인관계 || '');
  if (/배우자|아내|남편|아들|딸|자녀|부모|아버지|어머니|손자|친족|형제|특수/.test(관)) notes.push('양수인이 특수관계인(' + 관 + ') — 시가보다 싸게 넘기면 양도가액을 시가로 다시 셈(소득세법 §101①) · 양수인 저가양수 증여(상증법 §35) — 수익권 시가는 상증법 §65① 평가');
  if (/위탁자/.test(양도인지위) && 이전 !== true) notes.push('양도인이 위탁자 겸 수익자인 자익신탁 — 수익권만 넘기고 위탁자 지위·해지권을 남기면 수익권 양도, 함께 넘기면 신탁재산 양도로 다시 볼 수 있음');
  notes.push('신탁을 설정할 때 위탁자가 실질 지배하면 신탁 설정은 양도가 아님(소득세법 §88 1호 다목) — 넥스 「양도여부」 묶음');
  서류.push('신탁계약서(수익자·원본/수익 구분·해지권·수익자 변경권·처분지시권)', '수익권 양도계약서(위탁자 지위 이전 조항)', '수익권 취득 증빙', '수탁자 확인서(수익자명부 변경)');
  const w = jmWrap_('신탁수익권', reqs, { 제외수익권: 제외 === true, 지배권이전: 이전, 경우: 경우, 엔진: 경우[0] ? 경우[0].엔진 : undefined, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = 제외 === true ? '양도소득세 대상 아닌 수익권(' + 제외왜 + ')' : 이전 === true ? '신탁재산 양도로 봄(지배·통제권 이전)' : 이전 === false ? (제외 === null ? '수익권 양도(잠정 — 빼는 수익권인지 모름)' : '신탁 수익권 양도(§94①6호)') : '판정 못 함 — 지배권 이전 모름(두 경우)';
  return w;
}

// [2026.11.03 복잡사건 114 「노씨 부부 연이은 상속」] 단기 재상속 — 상증법 §30·§14①1호·§19②·§67①, 시행령 §9①, 국세기본법 §24①
//  ① 상속개시 후 10년 안에 상속인·수유자가 죽어 다시 상속되면, 전의 상속세가 부과된 상속재산(§13 가산 사전증여 중 상속인·수유자가 받은 것 포함) 중
//     재상속되는 재산에 대한 전의 상속세 상당액을 산출세액에서 뺌(§30①) — 산식 §30②1호 × 공제율(1년 이내 100% … 10년 이내 10%, 2호).
//  ② 재상속분의 재산가액은 「전의」 상속 때 가액(산식의 분모가 전의 상속재산가액) — 이번 상속 때 시가를 넣으면 공제가 부풀거나 줄어듦.
//  ③ 한도: 산출세액 − §28 증여세액공제 − §29 외국납부세액공제(§30③).
//  ④ 이번 피상속인이 아직 내지 않은 전의 상속세(자기 몫)는 상속개시일 현재 납부할 의무가 있는 조세 → 공과금으로 뺌(§14①1호·시행령 §9①).
function judgeReinheritance_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const d1 = jmYmd_(p.전상속개시일) || '', d2 = jmYmd_(p.상속개시일) || '';
  const 지위 = String(p.이번피상속인지위 || '');
  // 몇 년 이내인가 — 전 상속개시일의 n년 뒤 같은 날까지가 n년 이내(엔진 reinhYears_와 같은 셈)
  let n = null;
  if (d1 && d2 && d2 >= d1) { n = 11; for (let k = 1; k <= 10; k++) { if (d2 <= (Number(d1.slice(0, 4)) + k) + d1.slice(4)) { n = k; break; } } }
  const 율 = n && n <= 10 ? (11 - n) * 10 : 0;
  reqs.push(jmReq_('전의 상속개시 후 10년 안에 다시 상속', n == null ? null : n <= 10, n == null ? '두 상속개시일을 모름' : n <= 10 ? n + '년 이내 → 공제율 ' + 율 + '%' : '10년이 지남', '상증법 §30①·②2호'));
  const 지위참 = /상속인|수유자|배우자|자녀|아들|딸/.test(지위) ? true : /그밖|아님|남/.test(지위) ? false : null;
  reqs.push(jmReq_('이번 피상속인이 전의 상속의 상속인 또는 수유자', 지위참, 지위 || '모름', '상증법 §30①'));
  const 전산출 = num(p.전상속세산출세액), 전재산 = num(p.전상속재산가액), 전과세 = num(p.전상속세과세가액);
  reqs.push(jmReq_('전의 상속세가 부과됨(전 산출세액이 있음)', p.전상속세산출세액 == null || p.전상속세산출세액 === '' ? null : 전산출 > 0, 전산출 > 0 ? '전 산출세액 ' + 전산출.toLocaleString() + '원' : p.전상속세산출세액 == null || p.전상속세산출세액 === '' ? '전 상속세 신고서·결정서를 봐야 함' : '전 상속세가 0 — 공제할 전의 상속세가 없음', '상증법 §30①'));
  // 재상속분 — 전의 상속 때 가액으로, 지금 남아 있는 것만(처분·바뀐 재산은 [확인 필요 — 권장: ①같은 재산이 남아 있는 것만(문언, 권장) ②대체 재산도 포함 — 예규 필요])
  const 목록 = Array.isArray(p.재상속재산) ? p.재상속재산 : [];
  let 확실 = 0, 모름 = 0, 처분 = 0, 지금가 = 0, 지금가있음 = true;
  const 줄 = 목록.map(function (x) {
    x = x || {};
    const v = num(x.전가액), 남 = jmYn_(x.남음);
    if (num(x.지금가액) > 0) 지금가 += 남 === false ? 0 : num(x.지금가액); else if (남 !== false) 지금가있음 = false;
    if (남 === true) 확실 += v; else if (남 === false) 처분 += v; else 모름 += v;
    return (x.이름 || '재산') + ' ' + v.toLocaleString() + '원(' + (남 === true ? '남음' : 남 === false ? '처분·바뀜' : '남았는지 모름') + (jmYn_(x.사전증여) === true ? ', §13 가산 사전증여' : '') + ')';
  });
  reqs.push(jmReq_('재상속되는 재산이 있음', 목록.length ? (확실 > 0 ? true : 모름 > 0 ? null : false) : null, 목록.length ? 줄.join(' · ') : '전의 상속재산 중 이번에 다시 상속되는 재산 목록이 없음', '상증법 §30①'));
  if (처분 > 0) notes.push('전의 상속재산 중 처분했거나 다른 재산으로 바뀐 것(' + 처분.toLocaleString() + '원)은 「재상속되는 상속재산」에서 뺐음 — 바뀐 재산(판 돈으로 산 집 등)도 넣을 수 있는지 [확인 필요 — 권장: 같음]');
  // 전의 상속세 미납분 — 공과금
  const 몫세 = num(p.이번피상속인몫전상속세), 낸돈 = num(p.사망전납부액);
  const 미납 = Math.max(0, 몫세 - 낸돈);
  if (미납 > 0) notes.push('이번 피상속인이 사망일까지 내지 않은 전의 상속세 ' + 미납.toLocaleString() + '원은 공과금으로 상속재산가액에서 뺌(상증법 §14①1호·시행령 §9①) — 그 세금은 상속인이 승계해 냄(국세기본법 §24①)');
  // 기한
  const 말일더하기 = function (d, m) { return new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) + m, 0)).toISOString().slice(0, 10); };
  if (d1) {
    const 전신고 = 말일더하기(d1, 6);
    const 분할 = (function () { const t = new Date(전신고 + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); const y = t.getUTCFullYear(), m = t.getUTCMonth() + 9, day = t.getUTCDate(); const e = new Date(Date.UTC(y, m, day)); e.setUTCDate(e.getUTCDate() - 1); return e.toISOString().slice(0, 10); })();
    if (d2 && d2 <= 전신고) { notes.push('이번 피상속인이 전의 상속세 신고기한(' + 전신고 + ') 전에 사망 — 그 신고·납부 의무는 상속인이 승계(국세기본법 §24①). 신고기한이 늘어나는지 (원문 확인 2026-11-04: 상증법 §67①③④·국세기본법 §24①)'); 할일.push({ 무엇: '전의 상속세 신고(승계한 몫 포함)', 때: 전신고 + '까지', 근거: '상증법 §67①·국세기본법 §24①' }); }
    if (/배우자/.test(지위) && d2 && d2 <= 분할) {
      const 분 = jmYn_(p.전배우자분할);
      notes.push('이번 피상속인은 전의 상속의 배우자 — 배우자상속재산분할기한(' + 분할 + ') ' + (분 === true ? '안에 분할(등기)을 마침' : '전에 사망') + (분 === true ? '' : '. 분할 전 사망이면 전의 배우자공제를 실제 몫으로 받을지 5억으로 줄지에 따라 전 산출세액·이번 공제가 함께 바뀜 [판단 대기 — 판단거리3차 #30: 사망은 열거 사유 아님 — ①2호 「등」으로 세무서장 인정 가능(권장) ②불가(5억) · 분할은 사망 배우자의 상속인이 지위를 이어 협의 가능]'));
      if (분 !== true) 할일.push({ 무엇: '전의 상속 배우자 몫 분할(등기)·분할 신고', 때: 분할 + '까지', 근거: '상증법 §19②③' });
    }
  }
  if (d2) 할일.push({ 무엇: '이번 상속세 신고(단기재상속세액공제 적어 넣음 — 별지 제9호서식)', 때: 말일더하기(d2, 6) + '까지', 근거: '상증법 §67①·§30' });
  // 경우
  const base = Object.assign({}, p.엔진칸 || {});
  if (d2 && !base.dateOfDeath) base.dateOfDeath = d2;
  const 과세 = num(base.taxableEstateAmount);
  const 짝 = function (재, extra) {
    const o = Object.assign({}, base, { priorInheritanceTax: 전산출 || undefined, reinheritedPropertyValue: 재 || undefined, priorInheritanceTotalPropertyValue: 전재산 || undefined, priorInheritanceTaxableBase: 전과세 || undefined, priorInheritanceDate: d1 || undefined, yearsSincePriorInheritance: n && n <= 10 ? n : undefined }, extra || {});
    return o;
  };
  const 적용 = reqs.every(function (r) { return r.결과 !== '✘'; });
  if (과세 > 0) {
    const 바른과세 = Math.max(0, 과세 - 미납);
    경우.push({ 이름: '① 법대로 — 재상속분(전의 가액·남은 것) ' + 확실.toLocaleString() + '원 × 공제율 ' + 율 + '%' + (미납 ? ', 미납 전의 상속세 공과금으로 뺌' : ''), 엔진: 'calculate_inheritance_tax', 엔진칸: 적용 ? 짝(확실, { taxableEstateAmount: 바른과세 }) : Object.assign({}, base, { taxableEstateAmount: 바른과세 }) });
    if (모름 > 0) 경우.push({ 이름: '①-2 남았는지 모르는 재산 ' + 모름.toLocaleString() + '원도 재상속분으로 넣으면', 엔진: 'calculate_inheritance_tax', 엔진칸: 짝(확실 + 모름, { taxableEstateAmount: 바른과세 }) });
    if (미납 > 0) 경우.push({ 이름: '② [견주기] 미납 전의 상속세를 공과금으로 안 빼면', 엔진: 'calculate_inheritance_tax', 엔진칸: 적용 ? 짝(확실, { taxableEstateAmount: 과세 }) : Object.assign({}, base) });
    if (적용 && 지금가 > 0 && 지금가있음 && 지금가 !== 확실 + 모름) 경우.push({ 이름: '③ [견주기] 재상속분을 이번 상속 때 시가로 넣으면', 엔진: 'calculate_inheritance_tax', 엔진칸: 짝(지금가, { taxableEstateAmount: 바른과세 }) });
    if (적용 && d1 && d2 && n && n > 1 && n <= 10) {
      const 꽉 = Math.floor((Date.parse(d2) - Date.parse(d1)) / 31557600000);
      if (꽉 < n && 꽉 >= 1) 경우.push({ 이름: '④ [견주기] 경과연수를 꽉 찬 해(' + 꽉 + '년)로 넣으면 — 공제율 ' + ((11 - 꽉) * 10) + '%', 엔진: 'calculate_inheritance_tax', 엔진칸: 짝(확실, { taxableEstateAmount: 바른과세, priorInheritanceDate: undefined, yearsSincePriorInheritance: 꽉 }) });
    }
    if (적용 && 처분 > 0) 경우.push({ 이름: '⑤ [견주기] 처분·바뀐 재산까지 재상속분에 넣으면', 엔진: 'calculate_inheritance_tax', 엔진칸: 짝(확실 + 모름 + 처분, { taxableEstateAmount: 바른과세 }) });
  } else 할일.push({ 무엇: '이번 상속세 과세가액(엔진칸 taxableEstateAmount — 전의 상속세 미납분을 빼기 전 값)', 때: '계산 전', 근거: '상증법 §13·§14' });
  if (!(전재산 > 0) || !(전과세 > 0)) 할일.push({ 무엇: '전의 상속세 신고서(전의 상속재산가액·과세가액·산출세액)', 때: '계산 전', 근거: '상증법 §30②1호' });
  notes.push('공제 한도는 산출세액 − 증여세액공제(§28) − 외국납부세액공제(§29)(§30③) — 엔진이 지킴. 재상속분의 가액은 이번 상속 때 시가가 아니라 전의 상속 때 신고·결정 가액(산식 분모가 전의 상속재산가액)');
  notes.push('이번 상속재산 평가는 이번 상속개시일 현재 시가(상증법 §60) — 전의 상속 때 감정가를 그대로 쓰지 않음. 같은 재산이 1년 반 만에 두 번 과세되므로 전의 상속 때 배우자 몫을 얼마로 했는지가 두 세금 합계를 정함(넥스 절세 비교 「배우자 몫」)');
  서류.push('전의 상속세 신고서·결정서(상속재산가액·과세가액·산출세액)', '전의 상속재산 분할협의서·등기부(배우자 몫·분할일)', '전의 상속세 납부 영수증·연부연납 허가서(미납분)', '두 피상속인 기본증명서(사망일)', '재상속 재산이 지금도 있는지(등기부·잔고)');
  const w = jmWrap_('재상속', reqs, { 공제율: 율 || 0, 이내: n, 재상속분: 확실, 재상속분_모름: 모름 || undefined, 처분재산: 처분 || undefined, 미납전상속세: 미납 || undefined, 경우: 경우, 엔진: 경우[0] ? 경우[0].엔진 : undefined, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = !적용 ? '단기재상속세액공제 없음' : reqs.some(function (r) { return r.결과 === '?'; }) ? '단기재상속세액공제 잠정(' + 율 + '%) — 모르는 사실 있음' : '단기재상속세액공제 ' + 율 + '% (' + n + '년 이내)';
  return w;
}

// [2026.11.03 복잡사건 115 「곽씨 종중 땅」] 법인 아닌 단체(종중)의 양도 — 누가 내나: 국세기본법 §13①②③, 소득세법 §2③④, 시행령 §168의8③6호·§168의9 8호·§168의10 2호·§168의14③4호가, §105①1호
//  ① 법인으로 보는 단체(국세기본법 §13① 주무관청 허가·등록 또는 공익 재단 / §13② 규정·대표자·독립 소유·분배 안 함 + 세무서장 승인)는 법인세 — 양도소득세 아님.
//  ② 그 밖의 법인 아닌 단체는 1거주자(국내 주사무소)로 보아 소득세(소득세법 §2③ 본문) — 기본공제 1회, 단체가 한 사람.
//     단서: 분배비율이 정해져 확인되거나(1호) 사실상 구성원별로 분배되면(2호) 구성원별로 각자 소득세. 일부만 확인되면 확인된 부분만 구성원별, 나머지는 1거주자(§2④).
//  ③ 종중이 2005-12-31 이전에 취득한 농지·임야·목장용지는 비사업용 토지 아님(시행령 §168의8③6호·§168의9 8호·§168의10 2호, 도시지역 농지는 §168의14③4호가).
function judgeClanLand_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 단 = p.단체 && typeof p.단체 === 'object' ? p.단체 : {};
  const 이름 = String(단.이름 || p.이름 || '종중');
  const 토 = p.토지 && typeof p.토지 === 'object' ? p.토지 : {};
  const 종류 = String(토.종류 || '농지');
  const 취득일 = jmYmd_(토.취득일) || '', 양도일 = jmYmd_(토.양도일) || '';
  const 양가 = num(토.양도가액), 취가 = num(토.취득가액), 경비 = num(토.필요경비);
  // ① 법인으로 보는 단체인가
  const 허가 = jmYn_(단.주무관청허가등록), 공익재단 = jmYn_(단.공익재단), 승인 = jmYn_(단.법인승인);
  let 법인 = null, 법인왜 = '';
  if (허가 === true || 공익재단 === true) { 법인 = true; 법인왜 = (허가 === true ? '주무관청 허가·인가·등록을 받은 단체(등기 안 됨)' : '공익 목적 출연 재산이 있는 재단') + ' — 당연히 법인으로 봄(국세기본법 §13①)'; }
  else if (승인 === true) { 법인 = true; 법인왜 = '세무서장 승인을 받은 단체 — 법인으로 봄(§13②), 승인 뒤 3년은 거주자로 바꿀 수 없음(§13③)'; }
  else if (승인 === false && 허가 !== null) { 법인 = false; 법인왜 = '허가·등록도, 세무서장 승인도 없음 — 법인으로 보는 단체 아님'; }
  else if (승인 === false) { 법인 = false; 법인왜 = '세무서장 승인 없음 — 법인으로 보는 단체 아님(주무관청 허가·등록 여부는 확인)'; }
  else 법인왜 = '세무서장 승인(고유번호증 「법인으로 보는 단체」 표시)·주무관청 허가 여부를 모름';
  reqs.push(jmReq_('법인으로 보는 단체가 아님(아니면 양도소득세, 맞으면 법인세)', 법인 === true ? false : 법인 === false ? true : null, 법인왜, '국세기본법 §13①②·소득세법 §2③'));
  // ② 구성원별로 과세하나
  const 분 = p.분배 && typeof p.분배 === 'object' ? p.분배 : {};
  const 비율정함 = jmYn_(분.비율정함), 사실분배 = jmYn_(분.사실상분배);
  const 구성원 = Array.isArray(분.구성원) ? 분.구성원.map(function (m) { return { 이름: String(m.이름 || ''), 비율: famNum_(m.비율) }; }).filter(function (m) { return m.비율 > 0; }) : [];
  const 합 = 구성원.reduce(function (s, m) { return s + m.비율; }, 0);
  const 전체 = 합 > 1.5 ? 100 : 1;   // 비율을 %로 넣었으면 100, 소수면 1
  let 방식 = null, 방식왜 = '';
  if (법인 !== true) {
    if ((비율정함 === true || 사실분배 === true) && 구성원.length && 합 >= 전체 - 1e-9) { 방식 = '구성원별'; 방식왜 = (비율정함 === true ? '구성원 분배비율이 정해져 확인됨(§2③1호)' : '사실상 구성원별로 분배됨(§2③2호)') + ' — 구성원 ' + 구성원.length + '명이 각자 지분만큼 양도소득세'; }
    else if ((비율정함 === true || 사실분배 === true) && 구성원.length) { 방식 = '섞임'; 방식왜 = '일부 구성원(' + 구성원.map(function (m) { return m.이름; }).join('·') + ', 합계 ' + Math.round(합 / 전체 * 1000) / 10 + '%)만 확인 — 확인된 몫은 구성원별, 나머지는 단체를 1거주자로(§2④)'; }
    else if (비율정함 === false && 사실분배 === false) { 방식 = '1거주자'; 방식왜 = '분배비율도 없고 분배하지도 않음 — 단체를 1거주자로(§2③ 본문, 국내 주사무소 기준)'; }
    else 방식왜 = '분배비율이 정해졌는지·판 돈을 구성원에게 나누는지 모름(종중 규약·총회 회의록·통장) — 1거주자와 구성원별 두 경우 모두 셈';
    reqs.push(jmReq_('단체를 1거주자로 봄(분배비율 확인·사실상 분배면 구성원별)', 방식 === '1거주자' ? true : 방식 === '구성원별' ? false : null, 방식왜, '소득세법 §2③ 본문·단서·§2④'));
  }
  // ③ 비사업용 토지 — 종중 소유 2005-12-31 이전 취득
  const 종중 = /종중|문중|화수회/.test(이름 + String(단.종류 || ''));
  let 비사업 = jmYn_(토.비사업용토지), 비사업왜 = '';
  if (종중 && /농지|임야|목장/.test(종류) && 취득일) {
    if (취득일 <= '2005-12-31') { 비사업 = false; 비사업왜 = '종중이 2005-12-31 이전에 취득한 ' + 종류 + ' — 비사업용 토지로 보지 않음(소득세법 시행령 ' + (/임야/.test(종류) ? '§168의9 8호' : /목장/.test(종류) ? '§168의10 2호' : '§168의8③6호, 도시지역 안 농지는 §168의14③4호가') + ')'; }
    else 비사업왜 = '종중이 2006-01-01 이후 취득 — 종중 특례 없음, 일반 요건(사업용 기간)으로 판정 — 넥스 「비사업용토지」 묶음' + (비사업 === null ? ' [모름 → 두 경우]' : '');
  } else if (종중 && /농지|임야|목장/.test(종류)) 비사업왜 = '취득일을 모름 — 2005-12-31 이전이면 비사업용 아님(시행령 §168의8③6호 등)';
  else 비사업왜 = 비사업 === true ? '비사업용 토지(입력)' : 비사업 === false ? '사업용 토지(입력)' : (종류 + ' — 비사업용인지 「비사업용토지」 묶음으로 판정');
  reqs.push(jmReq_('비사업용 토지 아님(+10%p 없음)', 비사업 === true ? false : 비사업 === false ? true : null, 비사업왜, '소득세법 §104①8호·§104의3, 시행령 §168의8~§168의14'));
  // 경우
  const base = Object.assign({ assetType: 'land', transferPrice: 양가 || undefined, acquisitionPrice: 취가 || undefined, necessaryExpenses: 경비 || undefined,
    acquisitionDate: 취득일 || undefined, transferDate: 양도일 || undefined, acquisitionCause: 'purchase' }, p.엔진칸 || {});
  const nb = function (o, v) { const x = Object.assign({}, o); if (v) x.isNonBusinessLand = true; else delete x.isNonBusinessLand; return x; };
  const part = function (r) { const x = Object.assign({}, base); ['transferPrice', 'acquisitionPrice', 'necessaryExpenses'].forEach(function (k) { if (x[k]) x[k] = Math.floor(x[k] * r); }); return x; };
  const 비사업값 = 비사업 === true;
  const 한거주자 = function (pre, r) { return { 이름: pre + ' — ' + 이름 + '을(를) 1거주자로(기본공제 한 번)' + (r < 1 ? ' · 확인 안 된 몫 ' + Math.round(r * 1000) / 10 + '%' : ''), 엔진: 'calculate_transfer_tax', 엔진칸: nb(r < 1 ? part(r) : base, 비사업값) }; };
  const 구성원별 = function (pre, list) { return list.map(function (m) { const r = m.비율 / 전체; return { 이름: pre + ' — 구성원 ' + m.이름 + ' 몫 ' + Math.round(r * 1000) / 10 + '%(각자 기본공제·세율)', 엔진: 'calculate_transfer_tax', 엔진칸: nb(part(r), 비사업값) }; }); };
  if (법인 === true) {
    notes.push('법인으로 보는 단체 — 토지 양도차익은 법인세(대표자가 신고, 국세기본법 §13④). 비영리법인으로 보면 수익사업이 아닌 고유목적 재산의 처분도 법인세 과세 여부를 따져야 함 [판단 대기 — 판단거리3차 #31: 원문 없음 — [확인 필요] 유지]');
    if (양가) 경우.push(Object.assign(한거주자('② [견주기] 법인 아닌 1거주자로 양도소득세 신고하면', 1), { 견주기: true }));
  } else {
    if (방식 === '1거주자' || 방식 === null) 경우.push(한거주자(방식 === null ? '① 분배 안 하면' : '① 법대로', 1));
    if (방식 === '구성원별' || 방식 === null && 구성원.length && 합 >= 전체 - 1e-9) 구성원별(방식 === null ? '② 구성원별로 나누면' : '① 법대로', 구성원).forEach(function (k) { 경우.push(k); });
    if (방식 === '섞임') { 구성원별('① 법대로(확인된 몫)', 구성원).forEach(function (k) { 경우.push(k); }); 경우.push(한거주자('① 법대로(나머지)', 1 - 합 / 전체)); }
    if (방식 === '1거주자' && 구성원.length) 구성원별('② [견주기] 구성원별로 나눠 신고하면', 구성원).forEach(function (k) { k.견주기 = true; 경우.push(k); });
    if (방식 === '구성원별') { const k = 한거주자('② [견주기] 1거주자로 한 번에 신고하면', 1); k.견주기 = true; 경우.push(k); }
    if (비사업 === false && 양가) 경우.push({ 이름: '[견주기] 비사업용 토지로 보면(+10%p, 종중 특례를 놓치면)', 엔진: 'calculate_transfer_tax', 엔진칸: nb(방식 === '구성원별' || 방식 === '섞임' ? part(구성원[0] ? 구성원[0].비율 / 전체 : 1) : base, true), 견주기: true, 메모: 방식 === '구성원별' ? '첫 구성원 몫으로 견줌' : '' });
    if (비사업 === null && /농지|임야|목장/.test(종류) && 양가 && 방식 !== '구성원별') 경우.push({ 이름: '비사업용 토지면(+10%p)', 엔진: 'calculate_transfer_tax', 엔진칸: nb(base, true) });
  }
  // 알림
  if (법인 !== true) {
    notes.push('1거주자로 보면 단체가 한 사람 — 기본공제 250만원 한 번(§103①), 누진세율도 단체 하나로. 구성원별이면 각자 지분 차익에 각자 기본공제·각자 세율(그 해 구성원 본인의 다른 양도와 합산)');
    notes.push('판 돈을 종원에게 나눠 주면 「사실상 분배」(§2③2호)가 되어 구성원별 과세로 바뀔 수 있음 — 나눌지·남길지는 신고 전에 정할 일. 1거주자로 신고한 뒤 나누면 다시 과세되는지 [확인 필요 — 권장: ①분배 확인되면 구성원별 과세로 경정(단체 신고는 취소) ②신고 확정으로 끝 — 권장 ①, 분배 전에 정할 일]');
    notes.push('8년 자경 감면(조특법 §69)은 농지 소재지에 사는 거주자가 직접 경작한 경우 — 종중 땅은 종중이 직접 경작한 것으로 보기 어려움 [판단 대기 — 판단거리3차 #32: 종중은 「직접 경작」을 할 수 없어 감면 불가 쪽 권장 — 예규 확인]. 종원이 경작했어도 그 사람 땅이 아님');
    notes.push('수용이면 공익사업 감면(조특법 §77)은 거주자 대상 — 1거주자로 보는 종중도 적용되는지 [확인 필요 — 권장: 1거주자로 보는 단체도 거주자이므로 적용 가능 쪽 권장(한도 §133는 단체 하나)]. 감면 한도(조특법 §133)는 1거주자 하나로');
    if (양도일) 할일.push({ 무엇: '양도소득세 예정신고(대표자 명의, 단체 고유번호로)', 때: new Date(Date.UTC(+양도일.slice(0, 4), +양도일.slice(5, 7) + 2, 0)).toISOString().slice(0, 10) + '까지', 근거: '소득세법 §105①1호' });
  }
  const 명의 = String(토.등기명의 || '');
  if (명의 && !/종중|단체|문중/.test(명의)) notes.push('등기 명의가 ' + 명의 + '(종원) — 실제 주인이 종중이면 양도소득세 납세의무자는 종중(국세기본법 §14①). 종원 개인 이름으로 신고하면 종원 다른 양도와 합산·종원 주택 수에 섞임 — 넥스 「부동산명의신탁」 묶음 · 종중 명의신탁은 부동산실명법 §8 특례 [실사건 때 확인]');
  if (법인 === null) 할일.push({ 무엇: '고유번호증(세무서) — 「법인으로 보는 단체」 승인인지, 대표자', 때: '계산 전', 근거: '국세기본법 §13②·시행령 §8' });
  if (방식 === null && 법인 !== true) 할일.push({ 무엇: '종중 규약·총회 회의록(분배 결의)·판 돈 통장 — 분배비율·실제 분배 확인', 때: '신고 전', 근거: '소득세법 §2③④' });
  if (!(취가 > 0)) 할일.push({ 무엇: '종중 토지 취득가액 — 오래된 땅이면 의제취득일(1985-01-01) 환산(넥스 「의제취득」 묶음)·환산가액', 때: '계산 전', 근거: '소득세법 §97·시행령 §176의2' });
  서류.push('고유번호증', '종중 규약·대표자 선임 회의록', '양도·분배 결의 회의록', '토지 등기부(명의)', '취득 증빙', '판 돈 통장');
  const w = jmWrap_('법인아닌단체', reqs, { 법인으로봄: 법인, 과세방식: 방식, 비사업용: 비사업, 경우: 경우, 엔진: 경우[0] ? 경우[0].엔진 : undefined, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = 법인 === true ? '법인으로 보는 단체 — 법인세(이 도구 밖)' : 방식 === '1거주자' ? 이름 + '을(를) 1거주자로 양도소득세' : 방식 === '구성원별' ? '구성원별 양도소득세(' + 구성원.length + '명)' : 방식 === '섞임' ? '확인된 몫은 구성원별, 나머지는 1거주자' : '판정 못 함 — 분배 여부 모름(두 경우)' + (법인 === null ? ' · 법인 승인 여부도 확인' : '');
  return w;
}

// [2026.11.03 복잡사건 116 「염씨 산 소나무 숲」] 자경산지 양도소득세 감면 — 조특법 §69의4①②, 조특령 §66의4①~⑩(⑩은 §66⑭ 준용), 조특법 §133①
//  ① 감면율: 직접 경영한 기간 10~20년 10% · 20~30년 20% · 30~40년 30% · 40~50년 40% · 50년 이상 50%(§69의4① 표). 10년 미만이면 감면 없음.
//  ② 직접 경영한 기간은 "취득하고 산림경영계획인가를 받은 날부터" 양도할 때까지 직접 임업에 쓴 기간(시행령 §66의4③) — 취득일부터가 아님.
//     상속 산지는 상속인이 1년 이상 이어 경영했으면 직전 피상속인(그 배우자에게서 상속받은 산지는 배우자 기간도)의 기간을 더함(⑥), 1년 미만이어도 3년 안 양도·수용 + 3년 안 택지개발지구 등 지정이면 더함(⑦).
//     사업소득금액(농업·임업·부동산임대 제외)+총급여 3,700만원 이상인 해 등은 뺌(⑩ → §66⑭).
//  ③ 사람: 직접 경영한 기간 이상 산지 소재 시·군·구, 연접 시·군·구, 30km 안에 산 임업인, 양도일 현재 거주자(비거주자 된 지 2년 안 포함)(①). 방법: 임업 상시 종사 또는 임작업 1/2 이상 자기 노동(②).
//  ④ 산지: 산지관리법 §4①1호 보전산지만(③ 본문). 특별시·광역시·시 동 지역 주거·상업·공업지역 편입 3년 지남(③1호, 대규모개발 등 부득이 사유 예외)·환지예정지 지정 3년 지남(③2호)은 제외.
//     편입·지정 전이면 편입일·지정일까지 소득만 감면(§69의4① 단서·⑧ 기준시가 비율 — 계산기 zone 칸).
//  ⑤ 감면신청서는 과세표준신고(예정신고 포함)와 함께(⑨). 한도는 자경·축사·어업·대토와 묶어 과세기간 1억·5개 과세기간 2억(§133①) — 계산기가 셈.
//  p: { 산지:{취득일, 인가일, 양도일, 보전산지, 도시지역(특별시·광역시·시 동 지역), 주거지역편입일, 부득이사유, 환지예정지지정일, 기준시가:{취득,편입,양도}, 양도가액, 취득가액, 필요경비},
//       사람:{임업인, 양도일거주자, 비거주된날, 거주지역(같은 시군구|연접|30km 이내|아님), 거주연수, 경영방법(상시 종사|절반 이상 자기 노동|맡김)},
//       경영:[{시작, 끝, 누가: 본인|피상속인|피상속인배우자}], 소득초과해:{본인:[해…], 피상속인:[…]}, 상속:{상속받은날, 상속후경영개월, 지정지역3년안},
//       직전감면(직전 4개 과세기간 §66~§70 감면액), 엔진칸 }
function judgeSelfForest_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 산 = p.산지 && typeof p.산지 === 'object' ? p.산지 : {};
  const 사 = p.사람 && typeof p.사람 === 'object' ? p.사람 : {};
  const 상 = p.상속 && typeof p.상속 === 'object' ? p.상속 : {};
  const 취득 = jmYmd_(산.취득일) || '', 인가 = jmYmd_(산.인가일) || '', 양도 = jmYmd_(산.양도일) || '';
  const 상속일 = jmYmd_(상.상속받은날) || '';
  // 사람
  reqs.push(jmReq_('임업인(임업 및 산촌 진흥촉진에 관한 법률)', jmYn_(사.임업인), jmYn_(사.임업인) === null ? '임업경영체 등록·임업인 확인서로 확인' : '', '조특령 §66의4①'));
  const 거주자 = jmYn_(사.양도일거주자 == null ? true : 사.양도일거주자), 비거주 = jmYmd_(사.비거주된날);
  reqs.push(jmReq_('양도일 현재 거주자(비거주자 된 날부터 2년 안 포함)', 거주자 === true ? true : 비거주 && 양도 ? 양도 <= famAddY_(비거주, 2) : 거주자, 비거주 ? '비거주자 된 날 ' + 비거주 : '', '조특령 §66의4①'));
  const 지역 = String(사.거주지역 || '');
  reqs.push(jmReq_('산지 소재지 거주(같은 시·군·구·연접 시·군·구·30km 안)', 지역 ? /같은|연접|30/.test(지역) && !/아님/.test(지역) : null, 지역 || '경영한 동안 어디 살았는지(주민등록 초본)', '조특법 §69의4①·조특령 §66의4①1~3호'));
  const 방법 = String(사.경영방법 || '');
  reqs.push(jmReq_('직접 경영(임업 상시 종사 또는 임작업 1/2 이상 자기 노동)', 방법 ? /상시|절반|1\/2|자기/.test(방법) && !/맡김|위탁|남/.test(방법) : null, 방법 || '임작업 일지·인부 노임·산림조합 위탁 여부로 확인', '조특령 §66의4②'));
  // 산지
  const 보전 = jmYn_(산.보전산지);
  reqs.push(jmReq_('보전산지(산지관리법 §4①1호 — 준보전산지 제외)', 보전, 보전 === null ? '토지이용계획확인서의 산지 구분' : 보전 ? '보전산지' : '준보전산지 — 감면 없음', '조특령 §66의4③ 본문'));
  const 편입 = jmYmd_(산.주거지역편입일), 도시 = jmYn_(산.도시지역), 부득 = jmYn_(산.부득이사유);
  if (편입 && 양도) {
    const over3 = 양도 > famAddY_(편입, 3);
    if (도시 === true) reqs.push(jmReq_('주거·상업·공업지역 편입 뒤 3년 안 양도', over3 ? (부득 === true ? true : 부득 === false ? false : null) : true,
      over3 ? '편입(' + 편입 + ')부터 3년 지나 양도' + (부득 === true ? ' — 대규모개발·공공 사업 등 부득이 사유로 제외 안 됨' : ' — 감면 제외(대규모개발·공공 사업 부득이 사유면 예외, 시행령 §66의4③1호 가~다)') : '편입부터 3년 안', '조특령 §66의4③1호'));
    else if (도시 === null) reqs.push(jmReq_('편입 지역이 특별시·광역시·시 동 지역인지', null, '군·도농복합시 읍·면이면 3년 제외가 없음', '조특령 §66의4③1호'));
    notes.push('주거지역 등에 편입됐으면 편입일까지 생긴 소득만 감면 — 양도소득금액 × (편입일 기준시가 − 취득 당시 기준시가) ÷ (양도 당시 기준시가 − 취득 당시 기준시가)(조특법 §69의4① 단서·조특령 §66의4⑧). 세 기준시가를 넣으면 계산기가 나눔');
  }
  const 환지 = jmYmd_(산.환지예정지지정일);
  if (환지 && 양도) reqs.push(jmReq_('환지예정지(산지 외 토지) 지정 뒤 3년 안 양도', !(양도 > famAddY_(환지, 3)), '지정일 ' + 환지, '조특령 §66의4③2호(환지 청산금 몫은 제외)'));
  if (양도 && 양도 < '2018-01-01') notes.push('자경산지 감면은 2018-01-01 이후 양도분부터(계산기가 막음)');
  // 직접 경영 기간 — 인가일부터, 본인 + 상속 승계 − 소득 기준 넘은 해
  const 시작한계 = 취득 && 인가 ? (취득 > 인가 ? 취득 : 인가) : (인가 || '');
  let list = p.경영 && p.경영.length ? p.경영 : (시작한계 && 양도 ? [{ 시작: 시작한계, 끝: 양도, 누가: '본인' }] : []);
  const inc = p.소득초과해 || {};
  const per = function (who) {
    let xs = jmMerge_(list.filter(function (x) { return (x.누가 || '본인') === who; }).map(function (x) { let s = jmYmd_(x.시작), e = jmYmd_(x.끝) || 양도; if (who === '본인' && 시작한계 && s < 시작한계) s = 시작한계; return { s: s, e: e }; }));
    [].concat(Array.isArray(inc) ? (who === '본인' ? inc : []) : (inc[who] || [])).forEach(function (y) { y = String(y).slice(0, 4); if (/^\d{4}$/.test(y)) xs = jmCut_(xs, y + '-01-01', y + '-12-31'); });
    return xs;
  };
  const 본인일 = jmLen_(per('본인'));
  let 승계일 = 0, 승계 = null;
  if (상속일) {
    const 개월 = Number(상.상속후경영개월), within3 = 양도 && 양도 <= famAddY_(상속일, 3), 지정 = jmYn_(상.지정지역3년안);
    승계 = 개월 >= 12 ? true : (within3 && 지정 === true) ? true : (상.상속후경영개월 == null || 상.상속후경영개월 === '') ? null : (within3 && 지정 === null ? null : false);
    const add = jmLen_(per('피상속인')) + jmLen_(per('피상속인배우자'));
    if (승계 === true) 승계일 = add;
    notes.push(승계 === true ? '피상속인(직전 피상속인, 배우자에게서 상속받았으면 그 배우자 포함) 경영 기간 ' + Math.floor(add / 365.25) + '년을 더함(조특령 §66의4⑥' + (개월 >= 12 ? '' : '·⑦') + ')'
      : 승계 === false ? '상속 뒤 1년 이상 이어 경영하지 않았고 3년 안 양도·지정 특례(⑦)도 아님 — 피상속인 기간을 더하지 못함(조특령 §66의4⑥⑦)'
      : '상속 뒤 경영한 개월 수·3년 안 지정 지역 여부를 모름 — 피상속인 기간을 더할지 잠정(조특령 §66의4⑥⑦)');
    if (승계 !== true && add) 경우.승계추가 = add;
  }
  const 거주연수 = 사.거주연수 == null || 사.거주연수 === '' ? null : Number(사.거주연수);
  let 경영연수 = Math.floor((본인일 + 승계일) / 365.25 + 1e-9);
  if (p.직접경영연수 != null && p.직접경영연수 !== '') 경영연수 = Math.floor(Number(p.직접경영연수));
  const 센연수 = 경영연수;
  if (거주연수 != null && 거주연수 < 경영연수) { notes.push('거주한 기간(' + 거주연수 + '년)이 경영 기간보다 짧음 — 감면율은 "직접 경영한 기간 이상 거주"한 구간까지만(조특령 §66의4①) → ' + Math.floor(거주연수) + '년으로 셈 [확인 필요 — 권장: ①거주기간을 상한으로 경영기간을 줄여 표 적용(지금 셈, 권장) ②거주 < 경영이면 요건 자체 미충족]'); 경영연수 = Math.floor(거주연수); }
  const rateOf = function (y) { return y >= 50 ? 50 : y >= 40 ? 40 : y >= 30 ? 30 : y >= 20 ? 20 : y >= 10 ? 10 : 0; };
  const 율 = rateOf(경영연수);
  reqs.push(jmReq_('산림경영계획인가를 받아 10년 이상 직접 경영', !인가 && !(p.경영 && p.경영.length) && p.직접경영연수 == null ? null : 경영연수 >= 10 ? true : (승계 === null && 경우.승계추가 && Math.floor((본인일 + 경우.승계추가) / 365.25 + 1e-9) >= 10) ? null : false,
    (인가 ? '인가일 ' + 인가 + (취득 && 취득 < 인가 ? '(취득 ' + 취득 + ' 뒤 ' + Math.floor(jmDays_(취득, 인가) / 365.25) + '년 지나 인가 — 그 앞은 안 셈)' : '') + ' · ' : '산림경영계획인가일을 모름 · ') + '센 기간 ' + 경영연수 + '년 → 감면율 ' + 율 + '%', '조특법 §69의4①·조특령 §66의4③'));
  // 엔진칸
  const base = Object.assign({ assetType: 'land', transferPrice: num(산.양도가액) || undefined, acquisitionPrice: num(산.취득가액) || undefined, necessaryExpenses: num(산.필요경비) || undefined,
    acquisitionDate: 취득 || undefined, transferDate: 양도 || undefined, acquisitionCause: 상속일 ? 'inheritance' : 'purchase' }, p.엔진칸 || {});
  if (num(p.직전감면)) base.sect133PriorFarm = num(p.직전감면);
  const 기 = 산.기준시가 || {};
  if (편입 && num(기.양도) > num(기.취득)) Object.assign(base, { zoneIncorporated: true, zoneStdAcq: num(기.취득), zoneStdIncorp: num(기.편입), zoneStdTransfer: num(기.양도) });
  const w = jmWrap_('자경산지 감면', reqs, {});
  const 감면 = function (y) { return Object.assign({}, base, { isForestManagementExempt: true, forestManagedYears: y }); };
  const 없이 = function () { const x = Object.assign({}, base); delete x.isForestManagementExempt; delete x.forestManagedYears; return x; };
  if (w.결론 === '충족' && 율 > 0) 경우.push({ 이름: '① 법대로 — 직접 경영 ' + 경영연수 + '년 감면 ' + 율 + '%' + (w.잠정 ? '(잠정)' : ''), 엔진: 'calculate_transfer_tax', 엔진칸: 감면(경영연수) });
  else 경우.push({ 이름: '① 법대로 — 감면 없음' + (율 === 0 ? '(직접 경영 ' + 경영연수 + '년, 10년 미만)' : '(요건 못 갖춤)'), 엔진: 'calculate_transfer_tax', 엔진칸: 없이() });
  if (취득 && 인가 && 취득 < 인가) { const y0 = Math.floor(jmDays_(취득, 양도) / 365.25 + 1e-9); if (rateOf(y0) !== 율) 경우.push({ 이름: '[견주기] 취득일부터 세면(인가 전 기간까지 넣은 잘못) — ' + y0 + '년 ' + rateOf(y0) + '%', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { isForestManagementExempt: true }), 견주기: true }); }
  if (경우.승계추가) { const y1 = Math.floor((본인일 + 경우.승계추가) / 365.25 + 1e-9); if (rateOf(y1) !== 율) 경우.push({ 이름: (승계 === null ? '[모름] 피상속인 기간을 더하면' : '[견주기] 피상속인 기간을 더하면(⑥⑦ 요건 없이 — 잘못)') + ' — ' + y1 + '년 ' + rateOf(y1) + '%', 엔진: 'calculate_transfer_tax', 엔진칸: 감면(y1), 견주기: 승계 !== null }); }
  delete 경우.승계추가;
  if (w.결론 === '충족' && 율 > 0) 경우.push({ 이름: '[견주기] 감면 없이', 엔진: 'calculate_transfer_tax', 엔진칸: 없이(), 견주기: true });
  if (base.zoneIncorporated) notes.push('편입일까지 소득 비율을 계산기 칸(zoneIncorporated·zoneStd*)에 넣음');
  notes.push('감면 한도: 자경·축사·어업·자경산지·대토 감면을 합쳐 과세기간 1억원, 5개 과세기간 2억원(조특법 §133①) — 직전 4년 감면액(sect133PriorFarm)을 넣으면 계산기가 셈 · 농어촌특별세 비과세(농특세법 §4·시행령 §4①1호)');
  if (양도) 할일.push({ 무엇: '세액감면신청서를 예정신고(또는 확정신고)와 함께 제출', 때: new Date(Date.UTC(+양도.slice(0, 4), +양도.slice(5, 7) + 2, 0)).toISOString().slice(0, 10) + '까지', 근거: '조특법 §69의4②·조특령 §66의4⑨·소득세법 §105①1호' });
  서류.push('산림경영계획 인가서(인가일)', '토지이용계획확인서(보전산지·용도지역·편입일)', '주민등록 초본(경영 기간 거주)', '임업경영체 등록·임업인 확인 서류', '임작업 일지·인부 노임·묘목 구입 등 직접 경영 증빙', '소득금액증명(사업소득·총급여 3,700만원 넘은 해 확인)');
  if (상속일) 서류.push('피상속인 산림경영계획 인가·경영 기간 증빙', '상속 뒤 경영 증빙(1년 이상)');
  if (편입) 서류.push('편입일·취득·양도 당시 개별공시지가');
  return Object.assign(w, { 직접경영연수: 경영연수, 센연수: 센연수, 감면율: 율, 피상속인기간더함: 승계, 경우: 경우, 할일: 할일, 받을서류: 서류, 알림: notes,
    엔진칸: 경우[0].엔진칸, 엔진칸뜻: '양도 계산 거래 하나에 그대로(감면율은 forestManagedYears로 계산기가 정함)' });
}
// [2026.11.03 복잡사건 117 「맹씨 회사 주식 교환」] 주식의 포괄적 교환·이전 과세이연(개인주주) — 조특법 §38①②④, 조특령 §35의2③④⑤⑥⑦⑧⑪⑫⑬⑭⑯
//  ① 요건(§38①): 1호 교환일 현재 1년 이상 사업하던 내국법인끼리(이전으로 새로 생긴 완전모회사는 제외) · 2호 대가 중 완전모회사(그 모회사) 주식 80% 이상, 지분대로 배정(⑦),
//     완전모회사와 ⑥의 주주가 교환으로 받은 주식을 교환일이 속하는 사업연도 끝까지 보유 · 3호 완전자회사가 그 사업연도 끝까지 사업 계속(고정자산 1/2 처분·미사용은 폐지 — ⑧).
//     단서: ⑬의 부득이 사유로 2호(보유)·3호를 못 갖춰도 처분할 때까지 이연.
//  ② 80% 판정(⑤): 완전모회사가 교환일 전 2년 안에 취득한 완전자회사 주식은 금전 교부로 봄 — 지배주주 아니면 발행주식 20% 넘는 부분의 취득가액, 지배주주면 2년 안 취득분 전부.
//  ③ 지금 과세(⑬→③): 개인은 MIN(교환대가 − 완전자회사 주식 취득가액, 주식 외 금전 등) / 나중 취득가액(④): (취득가액 + ③ 양도소득 − 주식 외 대가) × 처분 주식 수 ÷ 교환으로 받은 주식 수.
//  ④ 사후관리(§38②·⑪⑫): 교환일이 속하는 사업연도의 다음 사업연도 개시일부터 2년 안에 완전자회사 폐업(부득이 제외 ⑮) 또는 완전모회사·⑥의 주주가 받은 주식 처분(부득이 제외 ⑯)
//     → 이연받은 세액을 사유일이 속하는 반기 말일부터 2개월 안 납부, 그 주식을 팔면 취득가액은 교환일 현재 시가(⑫1호). 완전모회사는 1개월 안에 주주에게 알림(§38②).
//  ⑥의 주주: 완전자회사 지배주주등(법인령 §43③, 특수관계인 포함) — 4촌 혈족·지분 1% 미만이면서 시가 10억 미만인 자 제외.
//  ⑤ 신청: 교환일이 속하는 과세연도 과세표준 신고 때 완전모회사와 함께 과세특례신청서(⑭).
//  p: { 교환:{종류(교환|이전), 교환일, 사업연도말('12-31'), 양법인1년사업, 모회사신설, 자회사사업계속, 고정자산절반처분, 지분대로배정, 부득이사유},
//       주주:{취득가액, 취득일, 주식수, 지분율, 지분시가, 지배주주, 4촌혈족, 대주주, 중소기업},
//       대가:{모회사주식가액, 모회사주식수, 금전등},
//       모회사사전취득:{지배주주, 2년안취득지분율, 2년안취득가액}, 보유:{모회사, 주주},
//       처분:[{날짜, 주식수, 양도가액, 부득이}], 폐업:{날짜, 부득이}, 엔진칸 }
function judgeShareSwap_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 교 = p.교환 && typeof p.교환 === 'object' ? p.교환 : {};
  const 주 = p.주주 && typeof p.주주 === 'object' ? p.주주 : {};
  const 대 = p.대가 && typeof p.대가 === 'object' ? p.대가 : {};
  const 전 = p.모회사사전취득 && typeof p.모회사사전취득 === 'object' ? p.모회사사전취득 : {};
  const 보 = p.보유 && typeof p.보유 === 'object' ? p.보유 : {};
  const 교환일 = jmYmd_(교.교환일) || '';
  const 부득이 = jmYn_(교.부득이사유) === true;
  const 취가 = num(주.취득가액), 주가 = num(대.모회사주식가액), 현금 = num(대.금전등), 받은주수 = num(대.모회사주식수);
  const 합계 = 주가 + 현금;
  // ⑥ 사후관리·보유 요건이 걸리는 주주인지
  const 지배 = jmYn_(주.지배주주), 사촌 = jmYn_(주['4촌혈족']), 율 = famNum_(주.지분율), 지시 = num(주.지분시가);
  const 소액 = (율 > 0 && 율 < 1 && 지시 > 0 && 지시 < 1000000000) ? true : (율 >= 1 || 지시 >= 1000000000) ? false : null;
  const 대상주주 = 지배 === false ? false : 사촌 === true ? false : 소액 === true ? false : 지배 === true ? true : null;
  // 요건
  const 신설 = jmYn_(교.모회사신설) === true && /이전/.test(String(교.종류 || ''));
  reqs.push(jmReq_('교환일 현재 1년 이상 사업하던 내국법인끼리' + (신설 ? '(이전으로 새로 생긴 완전모회사는 제외)' : ''), jmYn_(교.양법인1년사업), jmYn_(교.양법인1년사업) === null ? '두 법인 법인등기부·사업자등록(개업일)' : '', '조특법 §38①1호'));
  // ⑤ 2년 안 취득분 금전 간주
  const 전율 = famNum_(전['2년안취득지분율']), 전가 = num(전['2년안취득가액']), 전지배 = jmYn_(전.지배주주);
  let 간주 = 0, 간주모름 = false;
  if (전가 > 0) {
    if (전지배 === true) 간주 = 전가;
    else if (전지배 === false) 간주 = 전율 > 20 ? Math.round(전가 * (전율 - 20) / 전율) : 0;
    else { 간주모름 = true; 간주 = 전율 > 20 ? Math.round(전가 * (전율 - 20) / 전율) : 0; }
    if (!(전율 > 0) && 전지배 !== true) 간주모름 = true;
  }
  const 비율 = 합계 > 0 ? 주가 / (합계 + 간주) : 0, 비율없이 = 합계 > 0 ? 주가 / 합계 : 0;
  const 비율ok = 합계 > 0 ? 비율 >= 0.8 : null;
  reqs.push(jmReq_('대가 중 완전모회사 주식 80% 이상(교환일 전 2년 안 취득분은 금전으로 봄)', 간주모름 && 비율ok !== 비율없이 >= 0.8 ? null : 비율ok,
    합계 > 0 ? '주식 ' + 주가 + ' ÷ (대가 ' + 합계 + (간주 ? ' + 금전으로 보는 ' + 간주 : '') + ') = ' + (Math.round(비율 * 10000) / 100) + '%' + (간주모름 ? ' — 완전모회사가 지배주주였는지 모름(⑤1호·2호)' : '') : '교환 계약서(교환비율·교부금)', '조특법 §38①2호·조특령 §35의2⑤'));
  reqs.push(jmReq_('주식을 지분대로 배정(⑥의 주주에게 지분비율 이상)', jmYn_(교.지분대로배정 == null ? null : 교.지분대로배정), '', '조특령 §35의2⑦'));
  const 모보유 = jmYn_(보.모회사), 주보유 = jmYn_(보.주주);
  const 보유결과 = 모보유 === false || (대상주주 === true && 주보유 === false) ? (부득이 ? true : false) : (모보유 === true && (대상주주 === false || 주보유 === true)) ? true : null;
  reqs.push(jmReq_('완전모회사' + (대상주주 !== false ? '·이 주주' : '') + '가 받은 주식을 교환일이 속하는 사업연도 끝까지 보유', 보유결과, 부득이 && (모보유 === false || 주보유 === false) ? '부득이 사유(⑬1호) — 단서로 이연' : '', '조특법 §38①2호·단서'));
  const 계속 = jmYn_(교.자회사사업계속), 절반 = jmYn_(교.고정자산절반처분);
  const 계속결과 = 계속 === false || 절반 === true ? (부득이 ? true : false) : 계속 === true ? true : null;
  reqs.push(jmReq_('완전자회사가 그 사업연도 끝까지 사업 계속(고정자산 1/2 이상 처분·미사용이면 폐지)', 계속결과, 절반 === true ? '고정자산 1/2 이상 처분(⑧)' + (부득이 ? ' — 부득이 사유(⑬2호)' : '') : '', '조특법 §38①3호·조특령 §35의2⑧'));
  const w = jmWrap_('주식교환', reqs);
  // 금액
  const 전체차익 = 합계 - 취가, 지금 = Math.max(0, Math.min(전체차익, 현금)), 이연 = Math.max(0, 전체차익 - 지금);
  const 나중합계 = 취가 + 지금 - 현금;
  // 사후관리 기간 — 교환일이 속하는 사업연도의 다음 사업연도 개시일부터 2년(⑪)
  const 말 = /^\d{2}-\d{2}$/.test(String(교.사업연도말 || '')) ? String(교.사업연도말) : '12-31';
  let 시작 = '', 끝 = '';
  if (교환일) {
    let y = +교환일.slice(0, 4), fyEnd = y + '-' + 말;
    if (fyEnd < 교환일) fyEnd = (y + 1) + '-' + 말;
    const t = new Date(fyEnd + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); 시작 = t.toISOString().slice(0, 10);
    const u = new Date(famAddY_(시작, 2) + 'T00:00:00Z'); u.setUTCDate(u.getUTCDate() - 1); 끝 = u.toISOString().slice(0, 10);
  }
  const 반기기한 = function (d) { const m = +d.slice(5, 7) <= 6 ? 6 : 12; return new Date(Date.UTC(+d.slice(0, 4), m + 2, 0)).toISOString().slice(0, 10); };
  const sb = Object.assign({ assetCategory: 'domestic_stock', isDaejuju: jmYn_(주.대주주) === true || undefined, isSmallMediumCompany: jmYn_(주.중소기업) === true || undefined, transferDate: 교환일 || undefined }, p.엔진칸 || {});
  const 전부과세 = Object.assign({}, sb, { transferPrice: 합계 || undefined, acquisitionPrice: 취가 || undefined });
  const 지금과세 = Object.assign({}, sb, { transferPrice: 지금 || undefined, acquisitionPrice: 0 });
  const 이연됨 = w.결론 === '충족';
  if (!(합계 > 0)) notes.push('교환 대가(모회사 주식 가액·교부금)를 알아야 셈 — 교환 계약서·주주총회 의사록');
  else if (이연됨) {
    경우.push({ 이름: '① 법대로' + (w.잠정 ? '(잠정)' : '') + ' — 이연, 지금은 주식 외 대가 몫 ' + 지금 + '원만 과세(조특령 §35의2③)', 엔진: 'calculate_stock_transfer_tax', 엔진칸: 지금과세, 뜻: '양도가액 칸 = 지금 과세하는 양도소득, 취득가액 0' });
    경우.push({ 이름: '[견주기] 이연 없이 전부 과세하면', 엔진: 'calculate_stock_transfer_tax', 엔진칸: 전부과세, 견주기: true });
  } else {
    경우.push({ 이름: '① 법대로 — 이연 안 됨, 교환으로 넘긴 주식 전부 양도(대가 ' + 합계 + '원)', 엔진: 'calculate_stock_transfer_tax', 엔진칸: 전부과세 });
    if (간주 > 0 && 비율없이 >= 0.8 && reqs.filter(function (r) { return r.결과 === '✘'; }).length === 1)
      경우.push({ 이름: '[견주기] 2년 안 취득분을 빼고 80%를 보면(⑤ 놓침 — 잘못) — 지금 ' + 지금 + '원만 과세', 엔진: 'calculate_stock_transfer_tax', 엔진칸: 지금과세, 견주기: true });
  }
  if (w.잠정 && 이연됨) 경우.push({ 이름: '[모름] 이연이 안 되면 — 전부 과세', 엔진: 'calculate_stock_transfer_tax', 엔진칸: 전부과세 });
  // 받은 주식 처분·폐업
  let 추징 = null;
  const 폐 = p.폐업 && typeof p.폐업 === 'object' ? p.폐업 : {}, 폐일 = jmYmd_(폐.날짜);
  if (이연됨 && 폐일 && 시작 && 폐일 >= 시작 && 폐일 <= 끝 && jmYn_(폐.부득이) !== true) 추징 = { 사유: '완전자회사 폐업 ' + 폐일 + '(§38②1호)', 날: 폐일 };
  [].concat(p.처분 || []).forEach(function (s, i) {
    const d = jmYmd_(s.날짜), n = num(s.주식수), 가 = num(s.양도가액);
    if (!d || !n) return;
    const 안 = 시작 && d >= 시작 && d <= 끝, 바로 = 교환일 && 시작 && d > 교환일 && d < 시작;
    const 이번추징 = 이연됨 && (안 || 바로) && 대상주주 !== false && jmYn_(s.부득이) !== true;
    if (이번추징 && !추징) 추징 = { 사유: '받은 주식 ' + n + '주 처분 ' + d + '(§38②2호' + (바로 ? ' — 사업연도 끝 전 처분이면 ①2호 보유 요건부터 깨짐' : '') + ')', 날: d, 모름: 대상주주 === null };
    const 취득분 = 이연됨 ? (추징 && d >= 추징.날 ? Math.round(주가 * Math.min(n, 받은주수 || n) / (받은주수 || n)) : Math.round(나중합계 * Math.min(n, 받은주수 || n) / (받은주수 || n))) : Math.round(주가 * Math.min(n, 받은주수 || n) / (받은주수 || n));
    if (가 > 0) 경우.push({ 이름: '처분 ' + (i + 1) + ' — ' + d + ' ' + n + '주, 취득가액 ' + 취득분 + '원(' + (!이연됨 ? '이연 안 됐으니 교환일 시가' : 추징 && d >= 추징.날 ? '추징되니 교환일 시가 — ⑫1호' : '조특령 §35의2④ 산식') + ')', 엔진: 'calculate_stock_transfer_tax',
      엔진칸: Object.assign({}, sb, { transferPrice: 가, acquisitionPrice: 취득분, transferDate: d, acquisitionDate: 교환일 || undefined }) });
    if (이연됨 && 받은주수 && n < 받은주수 && !추징) notes.push('교환으로 받은 주식을 먼저 판 것으로 봄(조특령 §35의2④ 후단) — 다른 길로 산 같은 회사 주식이 있어도 이 몫부터');
  });
  if (추징) {
    경우.push({ 이름: (추징.모름 ? '[모름] ⑥의 주주이면 ' : '') + '사후관리 추징 — ' + 추징.사유 + ': 이연받은 세액 = 이 경우 세액 − ① 세액', 엔진: 'calculate_stock_transfer_tax', 엔진칸: 전부과세, 추징: true });
    할일.push({ 무엇: '이연받은 양도소득세 납부(이미 낸 몫 빼고)', 때: 반기기한(추징.날) + '까지', 근거: '조특법 §38②·조특령 §35의2⑫1호' });
  }
  if (대상주주 === null && 이연됨) notes.push('이 주주가 ⑥의 주주(지배주주등, 4촌 혈족·1% 미만 10억 미만 제외)인지 모름 — 맞으면 보유 요건과 처분 추징이 걸림(조특령 §35의2⑥) · 지배주주등 기준은 법인세법 시행령 §43③ [판단 대기 — 판단거리3차 #33: 원문 없음 — 입력으로 받는 지금 방식 유지]');
  if (대상주주 === false && 이연됨) notes.push('⑥의 주주가 아님(' + (사촌 === true ? '4촌 혈족' : 소액 === true ? '지분 1% 미만·시가 10억 미만' : '지배주주 아님') + ') — 이 주주가 받은 주식을 2년 안에 팔아도 추징은 없음(완전모회사 처분·자회사 폐업은 추징)');
  if (이연됨) notes.push('나중에 받은 주식을 팔 때 취득가액 합계 = ' + 취가 + ' + ' + 지금 + ' − ' + 현금 + ' = ' + 나중합계 + '원(조특령 §35의2④)' + (받은주수 ? ', 1주 ' + Math.round(나중합계 / 받은주수) + '원' : '') + ' · 취득일은 [확인 필요 — 권장: 취득일 규정 없음 — 교환일(새 주식 취득)로 보는 쪽 권장, 장기보유 기산은 예규 확인]');
  if (시작) notes.push('사후관리 기간: ' + 시작 + ' ~ ' + 끝 + '(교환일이 속하는 사업연도의 다음 사업연도 개시일부터 2년, 조특령 §35의2⑪) — 완전모회사는 사유가 생기면 1개월 안에 주주에게 알림(§38②)');
  if (교환일) 할일.push({ 무엇: '주식의 포괄적 교환등 과세특례신청서를 완전모회사와 함께 제출(지금 과세 몫은 예정신고)', 때: 반기기한(교환일) + '까지(예정신고) · 확정신고 ' + (+교환일.slice(0, 4) + 1) + '-05-31까지', 근거: '조특령 §35의2⑭·소득세법 §105①2호·§110①' });
  notes.push('완전모회사가 아니라 그 완전모회사의 완전모회사 주식을 받은 경우도 80%·이연이 같음(§38①2호) · 법인 주주는 압축기장충당금(조특령 §35의2①②, 법인세 — 이 도구 밖)');
  서류.push('주식교환계약서(교환비율·교부금)', '주주총회 의사록·교환 공시', '두 법인 법인등기부(설립일)', '완전모회사의 교환일 전 2년 안 완전자회사 주식 취득 내역', '이 주주의 완전자회사 주식 취득 증빙(취득가액·취득일)', '교환일이 속하는 사업연도 끝 주주명부(보유 확인)', '완전자회사 고정자산 처분 내역');
  return Object.assign(w, { 이연: 이연됨, 판정비율: Math.round(비율 * 10000) / 100, 금전간주: 간주, 전체양도차익: 전체차익, 지금과세: 이연됨 ? 지금 : 전체차익, 이연금액: 이연됨 ? 이연 : 0,
    나중취득가액합계: 이연됨 ? 나중합계 : null, 사후관리기간: 시작 ? [시작, 끝] : null, 대상주주: 대상주주, 추징: 추징, 경우: 경우, 할일: 할일, 받을서류: 서류, 알림: notes,
    엔진칸: 경우.length ? 경우[0].엔진칸 : null, 엔진칸뜻: '주식 양도 계산(calculate_stock_transfer_tax)에 그대로 — 지금 과세 몫은 양도가액 칸에 양도소득, 취득가액 0' });
}
// [2026.11.03 복잡사건 118 「설씨 가족회사 주식 증여」] 비상장주식 보충적 평가 방법 가르기 — 상증법 §63①1호나·③, 상증령 §54①④⑥·§55·§56②·§53④⑤⑦⑧·§49①2호·§49의2⑤, 상증규칙 §17의3①
//  ① 가중치(§54①): 순손익가치 3 : 순자산가치 2. 부동산과다보유법인(소득세법 §94①4호다 — 토지·건물·부동산 권리 + 다른 법인 주식×그 법인 부동산 비율이 자산총액의 50% 이상)이면 2 : 3.
//     가중평균이 순자산가치의 80%보다 낮으면 80%(하한).
//  ② 순자산가치만(§54④): 1호 신고기한 안 청산 중·사업 계속 곤란 · 2호 사업개시 전·개시 뒤 3년 미만·휴업·폐업 중(적격분할·물적분할 신설은 분할 전 법인 개시일부터)
//     · 3호 자산총액 중 §94①4호다 1)·2) 합계 80% 이상 · 5호 주식등 80% 이상 · 6호 잔여 존속기한 3년 이내 — 3호·5호는 가중평균이 순자산가치보다 낮을 때만(단서).
//  ③ 추정이익(§56②): 일시·우발 사건(규칙 §17의3① 2~8호)으로 3년 순손익이 왜곡되면, 신용평가기관·회계법인·세무법인 둘 이상이 낸 1주당 추정이익 평균을 쓸 수 있다.
//     네 요건 — 1호 그 사건 · 2호 신고기한까지 신고 · 3호 산정기준일·평가서 작성일이 신고기한 이내 · 4호 산정기준일과 평가기준일이 같은 연도.
//  ④ 할증(§63③·§53⑧): 최대주주등(지분 합 가장 큰 1인과 특수관계인, 평가기준일 전 1년 안 양도·증여분 합산 §53⑤) 주식은 20% 더함 — 중소기업·중견기업(직전 3년 평균 매출 5천억 미만 §53⑦)·§53⑧ 배제 사유는 뺌.
//  ⑤ 시가 먼저(§60①): 평가기간 안 매매가액 등 시가가 있으면 그 값. 주식은 감정가액이 시가가 아님(§49①2호 괄호). 평가심의위원회 신청(§54⑥·§49의2⑤)은 보충적 평가액 70~130% 안 값으로, 상속은 신고기한 만료 4개월 전·증여는 70일 전까지.
//  p: { 원인(증여|상속), 평가기준일, 회사:{사업개시일, 분할전사업개시일, 청산중, 계속곤란, 휴업폐업, 존속기한, 발행주식수, 주식수:[1년전,2년전,3년전], 순손익:[1년전,2년전,3년전],
//         처분손익:[..](유가증권·유형자산 처분손익+자산수증이익등), 세전손익:[..], 자산총액, 부동산등가액, 주식등가액, 순자산가액, 중소기업, 중견매출5천억미만, 결손3년, 개시3년영업손실, 합병분할업종변경3년, 휴업1년},
//       주주:{최대주주, 평가할주식수, 1년안양도증여주식, 명의신탁, 최대주주지위상실}, 추정이익:{1주당, 평가기관수, 일시우발사건, 신고, 산정기준일, 작성일}, 시가:{금액, 날짜, 종류} }
function judgeUnlistedValuation_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 회 = p.회사 && typeof p.회사 === 'object' ? p.회사 : {};
  const 주 = p.주주 && typeof p.주주 === 'object' ? p.주주 : {};
  const 추 = p.추정이익 && typeof p.추정이익 === 'object' ? p.추정이익 : {};
  const 시 = p.시가 && typeof p.시가 === 'object' ? p.시가 : {};
  const 상속 = /상속/.test(String(p.원인 || ''));
  const 기준일 = jmYmd_(p.평가기준일) || '';
  const arr = function (a) { return Array.isArray(a) ? a.map(function (x) { return famNum_(x) || 0; }) : []; };
  const 손익 = arr(회.순손익), 주식수들 = Array.isArray(회.주식수) ? 회.주식수.map(function (x) { return num(x); }) : [];
  const 발행 = num(회.발행주식수), 평가주 = num(주.평가할주식수);
  // 신고기한 — 증여는 증여일이 속하는 달 말일부터 3개월, 상속(국내)은 6개월(상증법 §68①·§67①)
  let 신고기한 = '';
  if (기준일) { const y = +기준일.slice(0, 4), m = +기준일.slice(5, 7); 신고기한 = new Date(Date.UTC(y, m - 1 + (상속 ? 6 : 3) + 1, 0)).toISOString().slice(0, 10); }
  // ② 순자산가치만
  const 개시 = jmYmd_(회.분할전사업개시일) || jmYmd_(회.사업개시일) || '';
  let 개시3년미만 = null;
  if (개시 && 기준일) 개시3년미만 = famAddY_(개시, 3) > 기준일;
  const 자산 = num(회.자산총액), 부동산 = num(회.부동산등가액), 주식등 = num(회.주식등가액);
  const 부비 = 자산 ? 부동산 / 자산 : null, 주비 = 자산 ? 주식등 / 자산 : null;
  let 존속3년 = null;
  if (jmYmd_(회.존속기한) && 기준일) 존속3년 = famAddY_(기준일, 3) >= jmYmd_(회.존속기한);
  const 청산 = jmYn_(회.청산중) === true || jmYn_(회.계속곤란) === true, 휴폐 = jmYn_(회.휴업폐업) === true;
  const 무조건 = 청산 || 휴폐 || 개시3년미만 === true || 존속3년 === true;
  const 부동산과다 = 부비 == null ? null : 부비 >= 0.5;
  // 평가 방법 가르기라 「안 됨」은 없음 — 아는 사실은 ✔(왜에 결과), 모르면 ?(잠정)
  reqs.push(jmReq_('사업개시 뒤 3년 넘었나(못 넘으면 순자산가치만)', 개시3년미만 == null ? null : true, 개시 ? '사업개시일 ' + 개시 + (jmYmd_(회.분할전사업개시일) ? '(분할 전 법인 개시일부터)' : '') + (개시3년미만 ? ' — 3년 미만, 순자산가치만' : ' — 3년 넘음') : '법인등기부·사업자등록증 개업일', '상증령 §54④2호'));
  reqs.push(jmReq_('청산 중·사업 계속 곤란·휴업·폐업인가', (jmYn_(회.청산중) == null && jmYn_(회.계속곤란) == null && jmYn_(회.휴업폐업) == null) ? null : true, (청산 || 휴폐) ? '해당 — 순자산가치만' : '', '상증령 §54④1호·2호'));
  reqs.push(jmReq_('부동산 비율(50% 이상이면 2:3, 80% 이상이면 순자산가치 비교)', 부비 == null ? null : true, 부비 == null ? '자산총액·토지·건물·부동산 권리·다른 법인 주식의 부동산 몫(장부가액, 기준시가가 크면 기준시가 — 소득령 §158④)' : Math.round(부비 * 10000) / 100 + '%', '상증령 §54①·④3호, 소득세법 §94①4호다'));
  // ③ 추정이익
  let 사건 = jmYn_(추.일시우발사건), 사건왜 = '';
  const 처분 = arr(회.처분손익), 세전 = arr(회.세전손익);
  if (사건 == null && 처분.length === 3 && 세전.length === 3) {
    const wa = function (a) { return (a[0] * 3 + a[1] * 2 + a[2]) / 6; };
    const r = wa(세전) > 0 ? wa(처분) / wa(세전) : null;
    if (r != null) { 사건 = r > 0.5; 사건왜 = '처분손익 가중평균 ÷ 세전손익 가중평균 = ' + Math.round(r * 1000) / 10 + '%(50% 넘으면 규칙 §17의3①6호)'; }
  }
  if (사건 == null && (jmYn_(회.합병분할업종변경3년) === true || jmYn_(회.휴업1년) === true)) { 사건 = true; 사건왜 = jmYn_(회.휴업1년) === true ? '최근 3년 중 1년 이상 휴업(5호)' : '3년 안 합병·분할·주요 업종 변경(3호)'; }
  const 추정값 = num(추['1주당']);
  const 기관 = num(추.평가기관수), 산정 = jmYmd_(추.산정기준일) || '', 작성 = jmYmd_(추.작성일) || '';
  const 추정요건 = [];
  if (추정값) {
    추정요건.push(jmReq_('일시·우발 사건으로 순손익 왜곡', 사건, 사건왜 || '규칙 §17의3① 2~8호 중 어느 것인지', '상증령 §56②1호·규칙 §17의3①'));
    추정요건.push(jmReq_('둘 이상 기관 평균', 기관 ? 기관 >= 2 : null, 기관 ? 기관 + '곳' : '신용평가기관·회계법인·세무법인 몇 곳', '상증령 §56② 각 호 외의 부분'));
    추정요건.push(jmReq_('신고기한까지 신고', jmYn_(추.신고), 신고기한 ? 신고기한 + '까지' : '', '상증령 §56②2호'));
    추정요건.push(jmReq_('산정기준일·평가서 작성일이 신고기한 이내', (산정 && 작성 && 신고기한) ? (산정 <= 신고기한 && 작성 <= 신고기한) : null, 산정 || 작성 ? '산정 ' + (산정 || '?') + ' · 작성 ' + (작성 || '?') : '평가서의 두 날짜', '상증령 §56②3호'));
    추정요건.push(jmReq_('산정기준일과 평가기준일이 같은 연도', (산정 && 기준일) ? 산정.slice(0, 4) === 기준일.slice(0, 4) : null, '', '상증령 §56②4호'));
  }
  const 추정쓸수 = 추정값 && 추정요건.every(function (r) { return r.결과 === '✔'; });
  const 추정모름 = 추정값 && !추정쓸수 && !추정요건.some(function (r) { return r.결과 === '✘'; });
  if (추정값) reqs.push(jmReq_('1주당 추정이익을 쓸 수 있나', 추정모름 ? null : true, 추정쓸수 ? '네 요건 모두 ✔ — 추정이익 ' + 추정값 + '원' : (추정모름 ? '남은 요건: ' + 추정요건.filter(function (r) { return r.결과 === '?'; }).map(function (r) { return r.이름; }).join(', ') : '못 씀(' + 추정요건.filter(function (r) { return r.결과 === '✘'; }).map(function (r) { return r.이름; }).join(', ') + ') — 3년 순손익 그대로'), '상증령 §56②'));
  if (!추정값 && 사건 === true) notes.push('일시·우발 사건(' + (사건왜 || '규칙 §17의3①') + ')이 있어 3년 순손익이 부풀었을 수 있음 — 둘 이상 기관에 1주당 추정이익 평가를 맡겨 신고기한(' + (신고기한 || '?') + ')까지 내면 그 값을 쓸 수 있음(상증령 §56②)');
  // ④ 할증
  const 최대 = jmYn_(주.최대주주), 중소 = jmYn_(회.중소기업) === true, 중견 = jmYn_(회.중견매출5천억미만) === true;
  const 배제 = [];
  if (중소) 배제.push('중소기업(§63③)'); if (중견) 배제.push('중견기업 평균 매출 5천억 미만(§63③·상증령 §53⑦)');
  if (jmYn_(회.결손3년) === true) 배제.push('3년 계속 결손(§53⑧1호)');
  if (jmYn_(회.개시3년영업손실) === true) 배제.push('개시 3년 안 영업이익 모두 0 이하(§53⑧5호)');
  if (jmYn_(주.명의신탁) === true) 배제.push('명의신탁 증여의제(§53⑧8호)');
  if (jmYn_(주.최대주주지위상실) === true) 배제.push('상속·증여로 최대주주 지위를 잃음(§53⑧7호 — 그 받는 사람 쪽 (원문 확인 2026-11-04: 상증령 §53⑧7호))');
  if (청산) 배제.push('신고기한 안 청산 확정(§53⑧6호)');
  const 할증 = 최대 === true && !배제.length;
  reqs.push(jmReq_('최대주주등 할증 여부 가림', 최대 == null ? null : true, 최대 == null ? '최대주주등인지(특수관계인 지분 합산, 평가기준일 전 1년 안 양도·증여분 합산 — 상증령 §53④⑤)' : (최대 ? (배제.length ? '최대주주지만 할증 안 함: ' + 배제.join(', ') : '20% 할증') : '최대주주 아님'), '상증법 §63③·상증령 §53'));
  if (num(주['1년안양도증여주식'])) notes.push('최대주주 판정 지분에 평가기준일 전 1년 안 양도·증여한 ' + num(주['1년안양도증여주식']) + '주를 더함(상증령 §53⑤)');
  // 엔진칸
  const base = { totalIssuedShares: 발행, ownedShares: 평가주, netProfit1YearAgo: 손익[0] || 0, netProfit2YearsAgo: 손익[1] || 0, netProfit3YearsAgo: 손익[2] || 0,
    totalIssuedShares1YearAgo: 주식수들[0] || undefined, totalIssuedShares2YearsAgo: 주식수들[1] || undefined, totalIssuedShares3YearsAgo: 주식수들[2] || undefined,
    netAssetValue: num(회.순자산가액), isRealEstateHeavy: 부동산과다 === true, valuationDate: 기준일 || undefined,
    isLiquidationOrBusinessDifficult: 청산, isNewOrDormantOrClosedBusiness: 휴폐 || 개시3년미만 === true, hasFixedDissolutionWithin3Years: 존속3년 === true,
    isRealEstateAssetRatio80Plus: 부비 != null && 부비 >= 0.8, isStockAssetRatio80Plus: 주비 != null && 주비 >= 0.8,
    isMajorShareholder: 최대 === true, isSmallBusiness: 중소, isMediumBusinessUnder500B: 중견, hasContinuousLossFor3Years: jmYn_(회.결손3년) === true,
    newBusinessOperatingLossAllYears: jmYn_(회.개시3년영업손실) === true, isNomineeTrustDeemedGift: jmYn_(주.명의신탁) === true, isLiquidationConfirmedByFilingDeadline: 청산,
    lostMajorShareholderStatusByInheritanceOrGift: jmYn_(주.최대주주지위상실) === true };
  const 법대로 = Object.assign({}, base, 추정쓸수 ? { estimatedProfitPerShare: 추정값 } : {});
  경우.push({ 이름: '① 법대로 — ' + (무조건 ? '순자산가치만' : (부동산과다 ? '2:3(부동산과다)' : '3:2')) + (추정쓸수 ? ' · 추정이익 ' + 추정값 + '원' : '') + (할증 ? ' · 최대주주 20% 할증' : ''), 엔진칸: 법대로 });
  if (추정모름) 경우.push({ 이름: '[모름] 추정이익 요건을 다 갖추면', 엔진칸: Object.assign({}, base, { estimatedProfitPerShare: 추정값 }) });
  if (!무조건 && 부동산과다 === true) 경우.push({ 이름: '[견주기] 부동산과다를 놓쳐 3:2로 보면', 견주기: true, 엔진칸: Object.assign({}, 법대로, { isRealEstateHeavy: false }) });
  if (!무조건 && 추정쓸수) 경우.push({ 이름: '[견주기] 추정이익을 안 쓰면(3년 순손익 그대로)', 견주기: true, 엔진칸: base });
  if (!무조건 && !추정값 && 사건 === true) 경우.push({ 이름: '[견주기] 일시 사건이 있어도 추정이익 없이(지금대로)', 견주기: true, 엔진칸: base });
  if (할증) 경우.push({ 이름: '[견주기] 할증을 빼먹으면', 견주기: true, 엔진칸: Object.assign({}, 법대로, { isMajorShareholder: false }) });
  if (무조건) 경우.push({ 이름: '[견주기] 순자산가치만 쓸 사유를 놓쳐 가중평균으로 보면', 견주기: true, 엔진칸: Object.assign({}, 법대로, { isLiquidationOrBusinessDifficult: false, isNewOrDormantOrClosedBusiness: false, hasFixedDissolutionWithin3Years: false }) });
  // ⑤ 시가·심의
  if (num(시.금액)) notes.push('평가기간 안 시가(' + (시.종류 || '매매 등') + ' ' + num(시.금액) + '원' + (시.날짜 ? ', ' + 시.날짜 : '') + ')가 있으면 보충적 평가보다 먼저(상증법 §60①) — 다만 주식은 감정가액이 시가가 되지 않음(상증령 §49①2호 괄호) · 특수관계인 사이 거래가는 정상 거래인지 따로 봄');
  else notes.push('비상장주식은 감정가액을 시가로 쓸 수 없음(상증령 §49①2호 괄호) — 평가기간 안 남과의 매매가액이 있으면 그 값이 먼저(상증법 §60①)');
  if (신고기한) {
    const 심의 = 상속 ? jmAddM_(신고기한, -4) : famAddD_(신고기한, -70);
    할일.push({ 무엇: '보충적 평가액이 실제와 크게 다르면 평가심의위원회에 평가 신청(보충적 평가액의 70~130% 안 값)', 때: 심의 + '까지', 근거: '상증령 §54⑥·§49의2⑤' });
    할일.push({ 무엇: (상속 ? '상속세' : '증여세') + ' 신고 — 비상장주식 평가 명세서·최근 3년 재무제표·세무조정계산서 첨부' + (추정쓸수 || 추정모름 ? ' · 추정이익 평가서도 이날까지' : ''), 때: 신고기한 + '까지', 근거: (상속 ? '상증법 §67①' : '상증법 §68①') + (추정값 ? '·상증령 §56②2호' : '') });
  }
  notes.push('순손익가치 = 1주당 3년 가중평균 순손익(3:2:1) ÷ 10%(상증령 §54①·상증규칙 §17), 순자산가치 = 순자산가액 ÷ 발행주식 수(§55) · 결과는 calculate_unlisted_stock_value에 엔진칸 그대로');
  서류.push('최근 3년 재무제표·세무조정계산서(법인세 신고서)', '평가기준일 현재 가결산 재무상태표(순자산가액)', '주주명부(평가기준일·1년 전)·특수관계 확인', '부동산 기준시가·장부가액 명세(부동산 비율)', '법인등기부(개업일·존속기한)', '중소기업 기준 검토표(할증 배제)');
  if (사건) 서류.push('일시·우발 사건 증빙(유형자산 처분 내역 등)');
  if (추정값) 서류.push('추정이익 평가서 ' + (기관 || 2) + '부(기관별 산정기준일·작성일)');
  const w = jmWrap_('비상장주식 평가', reqs, {});
  return Object.assign(w, { 신고기한: 신고기한 || null, 부동산비율: 부비 == null ? null : Math.round(부비 * 10000) / 100, 가중치: 무조건 ? '순자산가치만' : (부동산과다 ? '2:3' : (부동산과다 === false ? '3:2' : null)),
    순자산가치만: 무조건, 추정이익사용: !!추정쓸수, 추정요건: 추정요건, 할증: 할증, 할증배제: 배제, 경우: 경우, 할일: 할일, 받을서류: 서류, 알림: notes,
    엔진칸: 경우[0].엔진칸, 엔진칸뜻: '비상장주식 평가(calculate_unlisted_stock_value)에 그대로 — 평가총액은 증여·상속 계산의 재산가액으로' });
}
// [2026.11.03 복잡사건 119 「엄씨 논 바꾸기」] 농지 교환·분합 비과세 가르기 — 소득세법 §89①2호·시행령 §153①③④⑤⑥ (경계 조정 교환은 「양도여부」, 8년 자경 감면은 「8년자경」)
//  ① 비과세(§153①): 각 호 중 하나 — 1호 국가·지자체 시행 사업으로 교환·분합 · 2호 국가·지자체 소유 토지와 · 3호 경작상 필요(단서: 새로 받은 농지를 3년 이상 농지소재지에 거주하며 경작) · 4호 농어촌정비법·농지법·농지관리기금법·농협법에 따라
//     + 쌍방 토지가액 차액이 큰 쪽 가액의 4분의 1 이하.
//  ② 농지소재지(§153③): 농지가 있는 시·군·구 · 연접 시·군·구 · 농지에서 직선 30km 이내(경작 시작 때 해당했으면 행정구역 개편으로 벗어나도 됨).
//  ③ 제외 농지(§153④): 1호 양도일 현재 특별시·광역시(군 제외)·특별자치시(읍·면 제외)·특별자치도(행정시 읍·면 제외)·시(도농복합시 읍·면 제외)의 주거·상업·공업지역 안 농지로 편입 3년 지남
//     (단서 가 1천 명 이상·일정 면적 개발사업의 단계 시행·보상 지연 / 나 국가·지자체·공공기관 사업의 부득이한 사유는 빼 줌) · 2호 환지처분 전 농지 밖 토지로 환지예정지 지정 3년 지남.
//  ④ 3호 3년의 예외: ⑤ 새 농지 취득 뒤 3년 안 협의매수·수용되면 3년 거주·경작으로 봄 · ⑥ 3년 안 소유자 사망하고 상속인이 농지소재지에 거주하며 계속 경작하면 기간 통산.
//  ⑤ 비과세가 안 되면 교환은 양도(소득세법 §88 1호 "매도, 교환") — 넘긴 농지의 양도가액·받은 농지의 취득가액은 교환 당시 시가로 셈 [판단 대기 — 판단거리3차 #34: 교환 당시 넘긴·받은 자산의 시가(감정·매매사례) + 정산금으로 셈 — 판례 기준이라 [확인 필요] 유지]
//  p: { 교환일(양도일 — 정산금 청산일과 등기접수일 중 빠른 날), 사유(국가사업|국가토지|경작상필요|농지법등),
//       넘긴농지:{시가, 취득가액, 취득일, 필요경비, 농지(예), 지역(특별시광역시동|시동|읍면|군), 용도지역(주거|상업|공업|그밖), 편입일, 단서가, 단서나, 환지예정지지정일, 환지예정지농지밖},
//       받은농지:{시가, 농지(예)}, 정산금:{받음, 줌},
//       경작:{시작, 끝(그만둔 날 — 아직이면 비움), 거주지역(같은시군구|연접시군구|30km이내|아님), 수용일, 사망일, 상속인계속경작(예), 상속인경작끝} }
function judgeFarmlandExchange_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 넘 = p.넘긴농지 && typeof p.넘긴농지 === 'object' ? p.넘긴농지 : {};
  const 받 = p.받은농지 && typeof p.받은농지 === 'object' ? p.받은농지 : {};
  const 정 = p.정산금 && typeof p.정산금 === 'object' ? p.정산금 : {};
  const 경 = p.경작 && typeof p.경작 === 'object' ? p.경작 : {};
  const 교환일 = jmYmd_(p.교환일) || '';
  const 사유 = String(p.사유 || '');
  const cat = /국가사업|지자체 ?사업|사업으로/.test(사유) ? 'cat1' : /국가토지|국유|공유지|지자체 ?소유/.test(사유) ? 'cat2' : /경작/.test(사유) ? 'cat3' : /농지법|농어촌|농협|기금/.test(사유) ? 'cat4' : '';
  reqs.push(jmReq_('두 토지 모두 농지(사실상 경작)', (jmYn_(넘.농지) == null || jmYn_(받.농지) == null) ? (jmYn_(넘.농지) === false || jmYn_(받.농지) === false ? false : null) : (jmYn_(넘.농지) && jmYn_(받.농지)), '공부 지목이 아니라 실제 경작 여부(소득세법 §88 8호 「농지」)', '소득세법 §89①2호'));
  reqs.push(jmReq_('교환 사유가 §153① 각 호 중 하나', cat ? true : (사유 ? false : null), cat ? ({ cat1: '1호 국가·지자체 시행 사업', cat2: '2호 국가·지자체 소유 토지와', cat3: '3호 경작상 필요', cat4: '4호 농지법 등에 따른 교환·분합' })[cat] : (사유 ? '「' + 사유 + '」은 각 호에 없음 — 일반 교환(양도)' : '교환 사유(사업 고시·상대방·계약 목적)'), '소득세법 시행령 §153①'));
  // 차액 4분의 1
  const A = num(넘.시가), B = num(받.시가), 큰 = Math.max(A, B), 차 = Math.abs(A - B);
  reqs.push(jmReq_('쌍방 토지가액 차액이 큰 쪽의 4분의 1 이하', (A && B) ? 차 <= 큰 / 4 : null, (A && B) ? '차액 ' + 차.toLocaleString() + '원 ÷ 큰 쪽 ' + 큰.toLocaleString() + '원 = ' + Math.round(차 / 큰 * 1000) / 10 + '%' : '두 농지의 교환 당시 가액(감정가·매매사례·기준시가 — 계약서 가액이 시가와 다르면 시가)', '소득세법 시행령 §153①'));
  if ((num(정.받음) || num(정.줌)) && A && B && Math.abs(Math.abs(A - B) - Math.abs(num(정.받음) - num(정.줌))) > 1) notes.push('정산금(받음 ' + num(정.받음).toLocaleString() + '·줌 ' + num(정.줌).toLocaleString() + ')이 두 가액 차이(' + 차.toLocaleString() + ')와 다름 — 계약 가액이 시가와 다르게 잡혔을 수 있음, 시가 근거부터 맞춤');
  // 제외 농지 ④
  const 지역 = String(넘.지역 || ''), 용도 = String(넘.용도지역 || '');
  const 도시 = /특별시|광역시|특별자치시|시동|시 ?동|동 ?지역/.test(지역) && !/군|읍|면/.test(지역);
  const 주상공 = /주거|상업|공업/.test(용도);
  const 편입 = jmYmd_(넘.편입일) || '';
  let 제외1 = null, 제외1왜 = '';
  if (지역 && 용도) {
    if (!도시 || !주상공) { 제외1 = false; 제외1왜 = !도시 ? '읍·면·군 지역(§153④1호 괄호 밖)' : '주거·상업·공업지역 밖'; }
    else if (!편입 || !교환일) { 제외1 = null; 제외1왜 = '도시 ' + 용도 + '지역 — 편입일을 알아야 3년 지났는지 가림(토지이용계획확인서·도시관리계획 고시)'; }
    else { const 지남 = famAddY_(편입, 3) <= 교환일; const 단서 = jmYn_(넘.단서가) === true || jmYn_(넘.단서나) === true;
      제외1 = 지남 && !단서; 제외1왜 = '편입 ' + 편입 + ' → 3년 되는 날 ' + famAddY_(편입, 3) + (지남 ? (단서 ? ' 지났지만 단서(' + (jmYn_(넘.단서가) === true ? '가 대규모 개발사업 단계 시행·보상 지연' : '나 공공 사업 부득이 사유') + ')로 빼 줌' : ' 지남') : ' 전에 교환');
      if (지남 && !단서 && (jmYn_(넘.단서가) == null || jmYn_(넘.단서나) == null)) notes.push('편입 3년이 지났지만 그 편입이 대규모 개발사업(토지소유자 1천 명 이상 등)의 단계 시행·보상 지연이거나 공공 사업의 부득이한 사유면 제외 농지가 아님(시행령 §153④1호 단서 가·나) — 사업인정고시·보상 일정 확인'); }
  }
  const 환지 = jmYmd_(넘.환지예정지지정일) || '';
  const 제외2 = 환지 && jmYn_(넘.환지예정지농지밖) !== false && 교환일 ? famAddY_(환지, 3) <= 교환일 : (환지 ? null : false);
  const 제외 = 제외1 === true || 제외2 === true;
  reqs.push(jmReq_('제외 농지 아님(도시 주거·상업·공업지역 편입 3년·환지예정지 3년)', 제외 ? false : (제외1 === false && 제외2 === false ? true : null), [제외1왜 || (지역 ? '' : '양도일 현재 소재지(시 동·읍면)·용도지역'), 환지 ? '환지예정지 지정 ' + 환지 + (제외2 === true ? ' — 3년 지남(④2호)' : '') : ''].filter(Boolean).join(' · '), '소득세법 시행령 §153④'));
  // 3호 단서 — 3년 거주·경작
  let 삼년 = null, 삼년왜 = '', 삼년끝 = '';
  const 시작 = jmYmd_(경.시작) || 교환일, 끝 = jmYmd_(경.끝) || '', 거주 = String(경.거주지역 || '');
  if (cat === 'cat3') {
    const 소재 = /같은|연접|30/.test(거주) ? true : (거주 ? false : null);
    삼년끝 = 시작 ? famAddY_(시작, 3) : '';
    const 수용 = jmYmd_(경.수용일) || '', 사망 = jmYmd_(경.사망일) || '';
    if (소재 === false) { 삼년 = false; 삼년왜 = '거주지가 농지소재지 밖(같은·연접 시군구, 30km 이내 아님 — §153③)'; }
    else if (수용 && 교환일 && 수용 < famAddY_(교환일, 3)) { 삼년 = true; 삼년왜 = '취득 뒤 3년 안(' + 수용 + ') 협의매수·수용 — 3년 경작으로 봄(§153⑤)'; }
    else if (사망 && 교환일 && 사망 < famAddY_(교환일, 3)) {
      const 계속 = jmYn_(경.상속인계속경작), 상끝 = jmYmd_(경.상속인경작끝) || '';
      if (계속 === false) { 삼년 = false; 삼년왜 = '3년 안 사망 뒤 상속인이 계속 경작하지 않음(§153⑥)'; }
      else if (계속 === true && (!상끝 || 상끝 >= 삼년끝)) { 삼년 = 상끝 || (교환일 && famAddY_(교환일, 3) <= (jmYmd_(p.오늘) || '')) ? true : null; 삼년왜 = '사망 ' + 사망 + ' — 상속인 경작과 통산(§153⑥)' + (삼년 ? ', 3년 채움' : ', ' + 삼년끝 + '까지 계속하면 채움'); }
      else if (계속 === true) { 삼년 = false; 삼년왜 = '피상속인·상속인 통산해도 ' + 삼년끝 + ' 전에 그만둠(§153⑥)'; }
      else 삼년왜 = '3년 안 사망 — 상속인이 농지소재지에 살며 계속 경작하는지(§153⑥)';
    }
    else if (끝 && 삼년끝) { 삼년 = 소재 === true && 끝 >= 삼년끝 ? true : (끝 < 삼년끝 ? false : null); 삼년왜 = '경작 ' + 시작 + ' ~ ' + 끝 + (끝 < 삼년끝 ? ' — 3년(' + 삼년끝 + ') 못 채움' : ''); }
    else 삼년왜 = 삼년끝 ? '아직 경작 중 — ' + 삼년끝 + '까지 농지소재지에 살며 경작해야 비과세가 굳음' : '새 농지 경작 시작일';
    reqs.push(jmReq_('3호 — 새 농지를 3년 이상 농지소재지에 거주하며 경작', 삼년, 삼년왜, '소득세법 시행령 §153①3호 단서·③⑤⑥'));
  }
  const w = jmWrap_('농지 교환 비과세', reqs, {});
  const 비과세 = w.결론 === '충족';
  // 엔진칸 — 비과세 판정은 엔진(isFarmlandExchange)이 같은 요건으로 다시 봄, 과세면 일반 교환(양도)
  const 양도가액 = (B + num(정.받음) - num(정.줌)) || A;
  const base = { assetType: 'land', transferPrice: 양도가액 || undefined, acquisitionPrice: num(넘.취득가액) || undefined, necessaryExpenses: num(넘.필요경비) || undefined,
    acquisitionDate: jmYmd_(넘.취득일) || undefined, transferDate: 교환일 || undefined, acquisitionCause: 'purchase' };
  const 교환칸 = { isFarmlandExchange: true, farmlandExchangeCategory: cat || undefined, farmlandExchangeValueA: B || undefined, farmlandExchangeValueB: A || undefined,
    farmlandExchangeCultivation3YearsMet: cat === 'cat3' ? 삼년 !== false : undefined, farmlandExchangeExcludedLand: 제외 };
  const 법대로 = Object.assign({}, base, 비과세 ? 교환칸 : {});
  경우.push({ 이름: '① 법대로 — ' + (비과세 ? '농지 교환 비과세' + (w.잠정 ? '(잠정)' : '') : '일반 교환 = 양도(양도가액 = 받은 농지 시가 ' + (num(정.받음) ? '+ 받은 정산금' : '') + (num(정.줌) ? '− 준 정산금' : '') + ')'), 엔진칸: 법대로 });
  if (w.잠정) 경우.push({ 이름: '[모름] 요건을 못 갖추면 — 일반 교환(양도)', 엔진칸: base });
  if (!비과세 && cat && A && B) 경우.push({ 이름: '[견주기] ' + (제외 ? '§153④ 제외 농지를 놓쳐' : '못 갖춘 요건을 놓쳐') + ' 비과세로 보면', 견주기: true, 엔진칸: Object.assign({}, base, 교환칸, { farmlandExchangeExcludedLand: false, farmlandExchangeCultivation3YearsMet: cat === 'cat3' ? true : undefined }) });
  // 할 일·알림
  if (비과세 && cat === 'cat3' && 삼년 !== true && 삼년끝) 할일.push({ 무엇: '받은 농지를 농지소재지(같은·연접 시군구 또는 30km 이내)에 살며 직접 경작 — 그 전에 그만두거나 팔면 비과세가 안 되어 교환을 양도로 신고', 때: 삼년끝 + '까지', 근거: '소득세법 시행령 §153①3호 단서' });
  if (교환일) { const y = +교환일.slice(0, 4), m = +교환일.slice(5, 7); const 예정 = new Date(Date.UTC(y, m - 1 + 2 + 1, 0)).toISOString().slice(0, 10);
    할일.push({ 무엇: 비과세 ? '비과세라 신고 의무는 없으나 요건 증빙(사업 고시·가액 감정·경작 확인)을 보관' : '양도소득세 예정신고(교환한 날이 속하는 달 말일부터 2개월)', 때: 비과세 ? '교환 뒤 5년 이상' : 예정 + '까지', 근거: 비과세 ? '국세기본법 §85의3(장부 보존)' : '소득세법 §105①1호' }); }
  if (!비과세 && cat === 'cat3' && 삼년 === false && 교환일) notes.push('3년 거주·경작을 못 채워 비과세가 안 되는 것이 교환 뒤에 드러났다면 그 교환은 처음부터 양도 — 예정신고 기한이 지났으면 기한 후 신고·가산세(국세기본법 §45의3·§47의2) [확인 필요 — 권장: 특례 없음 — 기한후신고·가산세로 가는 지금 안내 권장]');
  notes.push('일반 교환의 양도가액·취득가액: 법령에 교환의 실지거래가액 정의가 없음 — 교환 당시 넘긴·받은 자산의 시가(감정가·매매사례)와 정산금으로 셈 [판단 대기 — 판단거리3차 #35: 같음]');
  notes.push('받은 농지는 교환일에 취득 — 나중에 팔 때 취득가액은 넘긴 농지 시가 + 준 정산금 − 받은 정산금(= 받은 농지 시가), 취득일은 교환일 [확인 필요 — 권장: 교환일 취득, 취득가액 = 받은 농지 시가(넘긴 농지 시가 ± 정산금)로 보는 쪽 권장]');
  if (cat !== 'cat3' || 비과세) notes.push('넘긴 농지를 8년 이상 자경했다면 비과세가 안 되어도 8년 자경 감면(조특법 §69)을 따로 볼 수 있음 — 판정 묶음 「8년자경」');
  if (!비과세 && 도시 && 주상공) notes.push('도시 주거·상업·공업지역 편입 농지 — 비사업용 토지(+10%p) 여부를 판정 묶음 「비사업용토지」로 따로(소득세법 §104의3·시행령 §168의8)');
  서류.push('교환계약서·정산금 통장 내역', '두 농지 등기부·토지대장', '교환 당시 두 농지 가액 근거(감정평가서·매매사례·개별공시지가)', '토지이용계획확인서(용도지역·편입일)');
  if (cat === 'cat1' || cat === 'cat2' || cat === 'cat4') 서류.push('사업 고시·상대방(국가·지자체) 확인·근거 법률 서류');
  if (cat === 'cat3') 서류.push('주민등록초본(농지소재지 거주)', '농지원부(농업경영체 등록)·경작 확인서', '받은 농지 3년 경작 증빙(농자재 구입·수매 내역)');
  if (환지) 서류.push('환지예정지 지정 통지');
  return Object.assign(w, { 비과세: 비과세, 교환사유: cat || null, 차액비율: (A && B) ? Math.round(차 / 큰 * 10000) / 100 : null, 제외농지: 제외, 삼년경작: cat === 'cat3' ? 삼년 : undefined, 삼년되는날: 삼년끝 || null,
    양도가액: 양도가액 || null, 경우: 경우, 할일: 할일, 받을서류: 서류, 알림: notes, 엔진칸: 경우[0].엔진칸, 엔진칸뜻: '양도소득세 계산(calculate_transfer_tax_multi의 거래 한 건)에 그대로' });
}
// [2026.11.03 복잡사건 122 「연씨 농지·축사 농업회사법인 출자」] 농업법인 현물출자 — 조특법 §66(영농조합법인)·§68(농업회사법인), 시행령 §63·§65
//  ① 갈래(부칙 법률 제21223호 제37조·제38조): 2026-01-01 이후 출자 = 새 §66⑦·§68③ 이월과세(농지·초지 1호 + 농작물재배·축산·임업 직접 사용 부동산 2호, 2026-12-31까지)
//     2025-12-31까지 출자 = 옛 §66④·§68② 농지·초지 양도소득세 100% 감면(법인 인수 채무 몫·주거지역 등 편입·환지예정지 지정 뒤 소득 빼고, 옛 시행령 §63⑮<16>·§65⑦⑧), 축사 등은 옛 §66⑦ 이월과세
//  ② 농업인(시행령 §63④): 농지 등 소재지(같은·연접 시군구, 직선 30km)에 살며 4년 이상 직접 경작 — 사업소득금액+총급여 3,700만원 이상인 해 등은 경작기간에서 뺌(⑭)
//     농업회사법인은 농지법 §2 3호 농업법인으로 한정(§68③). 대상 농지(⑤): 실제 경작하는 전·답·부속시설, 단서로 시행령 §66④ 각 호(시 동 주거·상업·공업 편입 3년 지남·환지예정지 3년 지남) 제외
//  ③ 사후관리: 출자일부터 3년 안 받은 지분 50% 이상 처분(새 ⑨, 처분 달 말일부터 2개월 안 이월과세액 − 법인 납부세액 + 이자 ⑩ — 시행령 §63⑨ 1일 10만분의 22)
//     옛 법은 3년 안 지분 양도 → 감면세액 × 양도 지분 비율을 그 해 과세표준신고 때(옛 ⑤·옛 시행령 §63⑥). 출자 전 직접 사용 + 출자 뒤 기간이 8년 이상이면 안 냄(⑬, 상속은 피상속인 기간 통산)
//  ④ 감면 한도: §133① 과세기간 1억원 · 5개 과세기간 §66~§70 합계 2억원 — 엔진 감면 묶음에 §66이 없어 이 도구가 셈 (원문 확인 2026-11-04: 조특법 §133①1호·2호나목)
//  p: { 출자일, 법인종류(영농조합법인|농업회사법인|그밖), 농업법인(예/아니오 — 농지법 §2 3호), 농업인:{거주(같은시군구|연접|30km|아님), 경작연수, 소득기준넘은해수},
//       신청(예|예정), 자산:[{이름, 종류(농지|초지|축사등|그밖), 실제경작(예), 시가, 취득가액, 취득일, 필요경비, 지역, 용도지역, 편입일, 단서가, 단서나, 환지예정지지정일,
//       담보채무(법인이 인수), 기준시가취득, 기준시가편입, 기준시가양도, 사용시작일, 피상속인사용시작일}],
//       처분:[{날짜, 비율, 방법, 가업승계특례}], 세액(새 법 = 대상 자산만 넣은 산출세액(이월과세액) · 옛 법 = 농지 대상만 넣은 산출세액 — 엔진값), 직전감면세액(앞 4개 과세기간 §66~§70 감면 합계), 이미낸세액, 납부일, 오늘 }
function judgeFarmCorpContribution_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 출자일 = jmYmd_(p.출자일) || '';
  const 새법 = 출자일 ? 출자일 >= '2026-01-01' : null;
  const 법인 = String(p.법인종류 || ''), 영농 = /영농조합/.test(법인), 회사 = /농업회사/.test(법인);
  const 인 = p.농업인 && typeof p.농업인 === 'object' ? p.농업인 : {};
  const 자산 = (Array.isArray(p.자산) ? p.자산 : []).map(function (a) { return a && typeof a === 'object' ? a : {}; });
  const 조 = 회사 ? '§68' : '§66';
  reqs.push(jmReq_('출자 기한(새 법 2026-12-31까지)', 출자일 ? (새법 ? 출자일 <= '2026-12-31' : true) : null, 출자일 ? (새법 ? '2026-01-01 이후 출자 — 새 ' + (회사 ? '§68③' : '§66⑦') + ' 이월과세' : '2025-12-31까지 출자 — 옛 ' + (회사 ? '§68②' : '§66④') + ' 감면(부칙 법률 제21223호 제37조①·제38조①)') : '현물출자일(출자계약·등기 접수일)', '조특법 ' + (회사 ? '§68③' : '§66⑦') + ' · 부칙 제37조·제38조'));
  reqs.push(jmReq_('받는 법인이 영농조합법인 또는 농업회사법인', 영농 || 회사 ? true : (법인 ? false : null), 법인 ? (영농 || 회사 ? 법인 : '「' + 법인 + '」 — 일반 법인 출자는 §32 법인전환(사업 포괄 양도) 길을 따로 봄') : '받는 법인 종류(법인 등기부·정관)', '조특법 §66 · §68'));
  if (회사) reqs.push(jmReq_('농업회사법인이 농지법 §2 3호 농업법인', jmYn_(p.농업법인), jmYn_(p.농업법인) === false ? '농지법상 농업법인 요건(업무집행권자 1/3 이상 농업인 등)을 못 갖춤' : (jmYn_(p.농업법인) == null ? '농업법인 확인(농업경영체 등록·정관·임원 명부)' : ''), '조특법 §68③ 괄호 · 농지법 §2 3호'));
  // 농업인 요건
  const 거주 = String(인.거주 || ''), 소재 = /같은|연접|30/.test(거주) ? true : (거주 ? false : null);
  const 연수 = Number(인.경작연수), 뺄해 = Number(인.소득기준넘은해수) || 0, 순연수 = isFinite(연수) && 인.경작연수 !== '' && 인.경작연수 != null ? 연수 - 뺄해 : null;
  reqs.push(jmReq_('출자자가 농지 등 소재지(같은·연접 시군구, 30km)에 거주', 소재, 거주 || '출자 당시 주소(주민등록초본)', '조특령 §63④'));
  reqs.push(jmReq_('4년 이상 직접 경작(소득 기준 넘은 해 뺌)', 순연수 == null ? null : 순연수 >= 4, 순연수 == null ? '경작 기간(농지원부·농업경영체 등록·직불금)' : '경작 ' + 연수 + '년' + (뺄해 ? ' − 소득 기준 넘은 해 ' + 뺄해 + '년(§63⑭)' : '') + ' = ' + 순연수 + '년', '조특령 §63④⑭'));
  // 자산별 대상·제외
  const 대상 = [], 제외 = [];
  자산.forEach(function (a, i) {
    const 이름 = a.이름 || ('자산' + (i + 1)), 종류 = String(a.종류 || '');
    const 농지 = /농지|초지|전|답|과수원/.test(종류), 부동산 = /축사|창고|퇴비|부동산|임업|재배/.test(종류) && !농지;
    let ok = true, 왜 = '';
    if (!농지 && !부동산) { ok = false; 왜 = '「' + 종류 + '」 — 1호 농지·초지, 2호 농작물재배·축산·임업 직접 사용 부동산 아님'; }
    else if (농지 && jmYn_(a.실제경작) === false) { ok = false; 왜 = '실제 경작하지 않는 농지(조특령 §63⑤)'; }
    else if (!새법 && 부동산) { 왜 = '옛 법 — 축사 등 부동산은 옛 ' + (회사 ? '§68②' : '§66⑦') + ' 이월과세'; }
    let 편입제외 = false, 편입감면비 = null;
    if (농지 && ok) {
      const 지역 = String(a.지역 || ''), 용도 = String(a.용도지역 || ''), 편입 = jmYmd_(a.편입일) || '', 환지 = jmYmd_(a.환지예정지지정일) || '';
      const 도시 = /특별시|광역시|특별자치시|시동|시 ?동|동 ?지역/.test(지역) && !/군|읍|면/.test(지역), 주상공 = /주거|상업|공업/.test(용도);
      const 단서 = jmYn_(a.단서가) === true || jmYn_(a.단서나) === true;
      if (도시 && 주상공 && 편입 && 출자일 && famAddY_(편입, 3) <= 출자일 && !단서) { 편입제외 = true; }
      if (환지 && 출자일 && famAddY_(환지, 3) <= 출자일) 편입제외 = true;
      if (편입제외) { ok = false; 왜 = '시행령 §66④ 각 호 농지(' + (환지 && famAddY_(환지, 3) <= 출자일 ? '환지예정지 지정 ' + 환지 + ' 3년 지남' : '시 동 ' + 용도 + '지역 편입 ' + 편입 + ' 3년 지남') + ') — §63⑤ 단서로 대상 아님'; }
      else if (!새법 && (편입 || 환지)) {
        const B = num(a.기준시가편입), C = num(a.기준시가취득), D = num(a.기준시가양도);
        편입감면비 = B && C != null && D && D > C ? Math.max(0, Math.min(1, (B - C) / (D - C))) : null;
        왜 = '옛 법 — 편입·지정일까지 소득만 감면(옛 시행령 ' + (회사 ? '§65⑧' : '§63<16>') + ')' + (편입감면비 == null ? ' — 기준시가(취득·편입·출자) 셋 필요' : ' 비율 ' + Math.round(편입감면비 * 10000) / 100 + '%');
      }
      if (도시 && 주상공 && !편입) notes.push(이름 + ': 시 동 지역 ' + 용도 + '지역 — 편입일을 알아야 §66④1호(3년) 제외인지 가림(토지이용계획확인서)');
    }
    (ok ? 대상 : 제외).push({ 이름: 이름, 종류: 농지 ? '농지' : (부동산 ? '사업용 부동산' : 종류), 왜: 왜, 편입감면비: 편입감면비, a: a, 농지: 농지 });
  });
  reqs.push(jmReq_('넘기는 자산 중 대상(1호·2호)이 있음', 자산.length ? 대상.length > 0 : null, 자산.length ? '대상 ' + 대상.length + '건 · 제외 ' + 제외.length + '건' : '넘기는 자산 목록', '조특법 ' + (회사 ? '§68③' : '§66⑦') + ' · 시행령 §63⑤'));
  const ap = String(p.신청 == null ? '' : p.신청);
  const 예정 = 출자일 ? new Date(Date.UTC(+출자일.slice(0, 4), +출자일.slice(5, 7) - 1 + 2 + 1, 0)).toISOString().slice(0, 10) : '';
  if (새법 !== false) reqs.push(jmReq_('이월과세적용신청서를 과세표준신고 때 법인과 함께 냄', /예정|앞으로/.test(ap) ? null : jmYn_(ap), /예정|앞으로/.test(ap) || !ap ? (예정 ? '예정신고기한 ' + 예정 + ' — 할 일로 남김' : '') : '', '조특법 §66⑧ · 시행령 §63⑩'));
  const w = jmWrap_(새법 === false ? '농업법인 현물출자 감면(옛 ' + (회사 ? '§68②' : '§66④') + ')' : '농업법인 현물출자 이월과세(' + (회사 ? '§68③' : '§66⑦') + ')', reqs, {});
  const 된다 = w.결론 === '충족';
  // 엔진칸 — 자산마다 한 거래(출자일 양도, 양도가액 = 시가)
  const 칸 = function (x) { const a = x.a; return { assetType: x.농지 || /토지|땅/.test(String(a.종류 || '')) ? 'land' : 'building', transferPrice: num(a.시가) || undefined, acquisitionPrice: num(a.취득가액) || undefined,
    necessaryExpenses: num(a.필요경비) || undefined, acquisitionDate: jmYmd_(a.취득일) || undefined, transferDate: 출자일 || undefined, acquisitionCause: 'purchase', _이름: x.이름 }; };
  const 대상칸 = 대상.map(칸), 제외칸 = 제외.map(칸), 전부 = 대상칸.concat(제외칸);
  // 옛 법 감면 비율(자산별) = (1 − 법인 인수 채무 ÷ 시가) × 편입 전 비율 — 축사 등은 이월과세(감면 아님)
  const 감면비 = 대상.map(function (x) {
    if (새법 !== false || !x.농지) return 0;
    const 시가 = num(x.a.시가), 채무 = num(x.a.담보채무);
    return Math.max(0, 1 - (시가 ? Math.min(채무, 시가) / 시가 : 0)) * (x.편입감면비 == null ? 1 : x.편입감면비);
  });
  if (새법 === false) 대상.forEach(function (x, i) { if (x.농지 && num(x.a.담보채무)) notes.push(x.이름 + ': 법인이 인수한 채무 ' + num(x.a.담보채무).toLocaleString() + '원 몫(양도소득금액 × 채무 ÷ 양도가액)은 감면에서 뺌(옛 시행령 ' + (회사 ? '§65⑦' : '§63⑮') + ') — 감면 비율 ' + Math.round(감면비[i] * 10000) / 100 + '%'); });
  // 세액 — 이월과세액(새 법)·감면세액(옛 법)
  const 세액 = num(p.세액), 직전 = num(p.직전감면세액);
  let 감면세액 = null, 한도 = null;
  if (새법 === false && 세액) {
    const 차 = function (x) { return Math.max(0, num(x.a.시가) - num(x.a.취득가액) - num(x.a.필요경비)); }, 농지들 = 대상.map(function (x, i) { return { x: x, r: 감면비[i] }; }).filter(function (o) { return o.x.농지; });
    const 농지몫 = 농지들.length ? 농지들.reduce(function (s, o) { return s + o.r * 차(o.x); }, 0) / (농지들.reduce(function (s, o) { return s + 차(o.x); }, 0) || 1) : 0;
    const 전 = Math.floor(세액 * 농지몫);
    한도 = Math.max(0, Math.min(100000000, 200000000 - 직전));
    감면세액 = Math.min(전, 한도);
    notes.push('옛 법 감면세액 = 농지 대상만 넣은 산출세액 ' + 세액.toLocaleString() + '원 × 감면 비율(양도차익 가중 ' + Math.round(농지몫 * 10000) / 100 + '%) [확인 필요 — 권장: 원문 없어 근사(세액 비율) 유지 — 누진으로 차이 작음]');
    if (전 > 한도) notes.push('감면세액 ' + 전.toLocaleString() + '원이 §133① 한도(과세기간 1억원 · 5개 과세기간 §66~§70 2억원 − 앞 4년 ' + 직전.toLocaleString() + '원) ' + 한도.toLocaleString() + '원을 넘어 넘는 몫은 냄 (원문 확인 2026-11-04: 조특법 §133①)');
  }
  // 경우
  경우.push({ 이름: '① 법대로 — ' + (된다 ? (새법 === false ? '농지 감면' + (감면세액 != null ? ' ' + 감면세액.toLocaleString() + '원' : '') + ' · 축사 등 이월과세' : '대상 자산 이월과세(지금 0) · 제외 자산만 지금 과세') + (w.잠정 ? '(잠정)' : '') : '요건 못 갖춤 — 모두 지금 과세'),
    엔진칸들: 된다 ? (새법 === false ? 제외칸.concat(대상칸.filter(function (c, i) { return 대상[i].농지; })) : 제외칸) : 전부, 이월칸들: 된다 ? (새법 === false ? 대상칸.filter(function (c, i) { return !대상[i].농지; }) : 대상칸) : [], 감면세액: 된다 ? 감면세액 : null });
  if (된다 || w.잠정) 경우.push({ 이름: '[견주기] 이월과세·감면을 못 받으면(모두 그 해 양도)', 견주기: true, 엔진칸들: 전부 });
  // 사후관리 — 3년 안 지분 처분
  let 추징 = null;
  if (출자일 && 된다) {
    const end = famAddY_(출자일, 3);
    const 사용시작 = 대상.map(function (x) { return jmYmd_(x.a.피상속인사용시작일) || jmYmd_(x.a.사용시작일) || jmYmd_(x.a.취득일) || ''; }).filter(Boolean).sort().pop() || '';
    const 팔년 = 사용시작 ? famAddY_(사용시작, 8) : '';
    할일.push({ 무엇: '사후관리 3년(' + 출자일 + '~' + end + '): 받은 출자지분 ' + (새법 === false ? '양도 → 감면세액 × 양도 비율 추징' : '50% 이상 처분(유상·무상이전·감자 포함) → 이월과세액 + 이자 납부') + (팔년 ? ' — 단 ' + 팔년 + ' 뒤(출자 전 사용 + 출자 뒤 8년)면 안 냄' : ''), 때: end + '까지', 근거: 새법 === false ? '옛 조특법 §66⑤ · 옛 시행령 §63⑥' : '조특법 §66⑨⑩ · 시행령 §63⑫⑬' });
    const plan = (Array.isArray(p.처분) ? p.처분 : []).map(function (x) { return { 날짜: jmYmd_(x.날짜), 비율: Number(String(x.비율 == null ? '' : x.비율).replace(/[^\d.]/g, '')) || 0, 방법: String(x.방법 || ''), 특례: jmYn_(x.가업승계특례) }; }).filter(function (x) { return x.날짜; }).sort(function (a, b) { return a.날짜 < b.날짜 ? -1 : 1; });
    let acc = 0, hit = null, 예외들 = [];
    plan.forEach(function (x) {
      if (x.날짜 > end || hit) return;
      const 예외 = /사망|상속|파산|합병|분할|회생|법령상\s*의무|균등\s*소각/.test(x.방법) || (/증여/.test(x.방법) && x.특례 === true);
      if (예외) { 예외들.push(x.날짜 + ' ' + x.비율 + '% ' + x.방법); return; }
      acc += x.비율; if (새법 === false ? acc > 0 : acc >= 50) hit = { 날짜: x.날짜, 누적: acc };
    });
    if (예외들.length) notes.push('처분에서 빼는 것(시행령 §63⑫ — §28⑩ 준용): ' + 예외들.join(' · '));
    if (hit) {
      if (팔년 && hit.날짜 >= 팔년) notes.push(hit.날짜 + ' 처분 누적 ' + hit.누적 + '% — 출자 전 직접 사용 기간과 합쳐 8년(' + 팔년 + ') 넘어 안 냄(시행령 §63⑬' + (대상.some(function (x) { return jmYmd_(x.a.피상속인사용시작일); }) ? ', 피상속인 기간 통산' : '') + ')');
      else {
        const y = +hit.날짜.slice(0, 4), m = +hit.날짜.slice(5, 7);
        const due = 새법 === false ? (y + 1) + '-05-31' : new Date(Date.UTC(y, m - 1 + 2 + 1, 0)).toISOString().slice(0, 10);
        const 낼 = 새법 === false ? (감면세액 != null ? Math.floor(감면세액 * Math.min(100, hit.누적) / 100) : null) : (세액 ? Math.max(0, 세액 - num(p.이미낸세액)) : null);
        const 납 = jmYmd_(p.납부일) || due;
        const 일수 = 예정 && 납 > 예정 ? Math.round((Date.parse(납) - Date.parse(예정)) / 86400000) : 0;
        const 이자 = 낼 != null ? Math.floor(낼 * 일수 * 22 / 100000) : null;
        추징 = { 사유일: hit.날짜, 누적: hit.누적, 기한: due, 세액: 낼, 이자: 이자, 이자일수: 일수, 합계: 낼 != null ? 낼 + (이자 || 0) : null };
        notes.push('⚠ ' + hit.날짜 + ' 지분 ' + hit.누적 + '% 처분 — ' + (새법 === false ? '감면세액 × 양도 비율을 그 해 과세표준신고(' + due + ')' : '이월과세액(법인이 이미 낸 세액 빼고)을 ' + due + '까지') + ' 양도소득세로' + (낼 != null ? ' ' + 낼.toLocaleString() + '원' : '') + (이자 != null ? ' + 이자 ' + 이자.toLocaleString() + '원(' + 예정 + ' 다음 날부터 ' + 일수 + '일 × 10만분의 22)' : '') + ' [' + (새법 === false ? '확인 필요 — 옛 ⑥ 이자율 조문 표기' : '조특법 §66⑨⑩ · 시행령 §63⑨') + ']');
        할일.push({ 무엇: (새법 === false ? '감면세액 추징분' : '이월과세액') + ' + 이자 납부(지분 처분 ' + hit.날짜 + ')', 때: due });
        경우.push({ 이름: '[추징] ' + hit.날짜 + ' 지분 ' + hit.누적 + '% 처분', 추징: 추징 });
      }
    } else if (plan.length) notes.push('처분 계획 누적 ' + acc + '% — 3년 안 ' + (새법 === false ? '양도 없음' : '50% 미만') + '(예외 처분 빼고)');
  }
  if (제외.length) notes.push('대상 아닌 자산(지금 과세): ' + 제외.map(function (x) { return x.이름 + '(' + x.왜 + ')'; }).join(' · ') + ' — 8년 자경 감면(「8년자경」)·비사업용 토지(「비사업용토지」) 판정을 따로');
  if (새법 !== false) notes.push('이월과세액 = 대상 자산만 그 해 유일한 양도로 보고 셈한 산출세액(조특법 §2①6호) — 법인이 뒤에 그 자산을 팔면 법인세로 냄(법인 쪽 취득가액은 법인세법 영역 — 이 도구 범위 밖)');
  if (회사) notes.push('농업회사법인 출자 — 법인 쪽 법인세 감면(§68①)·취득세(지방세, 이 도구 범위 밖)는 따로');
  if (예정) 할일.push({ 무엇: '양도소득세 예정신고' + (새법 !== false ? ' + 이월과세적용신청서(법인과 함께, 농어업경영체 등록확인서·현물출자계약서 사본 첨부)' : ' + 감면신청'), 때: 예정 + '까지', 근거: 새법 !== false ? '조특령 §63⑩ · 소득세법 §105①1호' : '옛 조특령 §63 · 소득세법 §105①1호' });
  서류.push('현물출자계약서·법인 등기부(설립·출자 지분)', '농어업경영체 등록확인서(출자자·법인)', '주민등록초본(농지 소재지 거주)', '농지원부·직불금·경작 확인(4년)', '넘기는 자산 등기부·토지대장·토지이용계획확인서(용도지역·편입일)', '출자 당시 시가 근거(감정평가서)');
  if (회사) 서류.push('농업회사법인의 농지법상 농업법인 요건 증빙(정관·임원 명부)');
  return Object.assign(w, { 특례: 새법 === false ? '옛 조특법 ' + (회사 ? '§68②' : '§66④') + ' 감면' : '조특법 ' + (회사 ? '§68③' : '§66⑦') + ' 이월과세', 갈래: 새법 == null ? null : (새법 ? '새 법(이월과세)' : '옛 법(감면)'),
    대상자산: 대상.map(function (x) { return { 이름: x.이름, 종류: x.종류, 왜: x.왜 }; }), 제외자산: 제외.map(function (x) { return { 이름: x.이름, 종류: x.종류, 왜: x.왜 }; }),
    감면비율: 감면비, 감면세액: 감면세액, 감면한도: 한도, 추징: 추징, 경우: 경우, 할일: 할일, 받을서류: 서류, 알림: notes,
    엔진칸: 경우[0].엔진칸들, 엔진칸뜻: '경우마다 엔진칸들(지금 과세할 거래)·이월칸들(이월과세 대상 — 대상 자산만 넣어 돌린 산출세액이 이월과세액)을 calculate_transfer_tax_multi에' });
}
// [2026.11.03 복잡사건 120 「방씨 철공소 이전」] 공장 이전 양도소득세 분할납부 — 조특법 §85의7(공익사업 수용으로 지방 이전)·§85의8(중소기업 공장 이전), 시행령 §79의8·§79의9
//  ① 대상(거주자 — 법 각 ①2호): §85의7 = 공익사업 시행으로 사업인정고시일(그 전 양도면 양도일)부터 소급 2년 이상 가동한 공장(2년 미만이면 양도일 현재 1년 이상 가동 공장의 토지로 고시일부터 소급 5년 이상 보유한 것 포함)을
//     공익사업 시행지역 밖 「지방」(시행령 §79의8①: 수도권과밀억제권역·광역시(군·산업단지 제외)·행정중심복합도시등이 아닌 곳)으로 옮기려고 대지·건물을 사업시행자에게 2026-12-31까지 양도
//     §85의8 = 2년 이상 계속 공장시설을 갖추고 사업한 중소기업이 수도권과밀억제권역(산업단지 제외) 밖으로, 또는 산업단지에서 2년 이상 사업하다 같은 산업단지 안으로 이전하며 대지·건물을 2028-12-31까지 양도
//  ② 분할납부할 세액(시행령 §79의8③·§79의9③): 양도차익 × (신규공장 취득가액 ÷ 기존공장 양도가액, 100% 한도). 양도일이 속하는 해 끝까지 못 사면 이전(예정)명세서의 예정가액(④).
//     확정신고기한 끝난 날 이후 5년이 되는 날부터 5년간 균분 이상 납부(법 ①2호 후단). 공장입지기준면적을 넘는 대지 부분은 제외(⑤ 단서).
//  ③ 이전 시기(⑤): 1호 신규공장 사업개시 뒤 2년 안 기존공장 양도 · 2호 기존공장 양도 뒤 3년(부득이 사유 6년) 안 신규공장 취득·사업개시.
//  ④ 사후관리(법 ②): 이전하지 않거나 양도일부터 3년 안 폐업·해산 → 분할세액 전액 + 이자상당가산액(법 §33③ 후단 준용: 사유 발생 달 말일부터 2개월 안, 시행령 §30⑨2호 1일 10만분의 22)
//     예정가액으로 받았는데 실제 취득가액이 작으면 넘게 받은 몫을 사업개시 과세연도에 납부 + 이자(⑦).
//  p: { 특례(수용이전|중소기업이전 — 비우면 사업인정고시일로 가름), 양도일, 사업인정고시일, 양수자(사업시행자|그밖), 중소기업(예),
//       기존공장:{소재(과밀억제|광역시|그밖), 산업단지(예), 가동시작, 토지취득일, 양도가액, 양도차익, 기준면적초과비율(%), 토지만(예)},
//       신규공장:{소재(과밀억제|광역시|광역시군|행복도시|그밖), 산업단지(예), 같은산업단지(예), 시행지역안(예), 사업시행자직접취득(예), 취득가액, 예정가액, 사업개시일},
//       부득이사유(예), 폐업일, 이전안함(예), 세액(이 거래 양도소득세 결정세액 — 엔진값을 넣으면 분할세액을 셈), 거래(엔진칸 — 그대로 돌려줌), 오늘 }
function judgeFactoryRelocation_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 기 = p.기존공장 && typeof p.기존공장 === 'object' ? p.기존공장 : {};
  const 신 = p.신규공장 && typeof p.신규공장 === 'object' ? p.신규공장 : {};
  const 양도일 = jmYmd_(p.양도일) || '', 고시일 = jmYmd_(p.사업인정고시일) || '';
  const 수용 = /수용|공익/.test(String(p.특례 || '')) || (!p.특례 && !!고시일);
  const 조 = 수용 ? '조특법 §85의7' : '조특법 §85의8', 령 = 수용 ? '시행령 §79의8' : '시행령 §79의9';
  const 끝기한 = 수용 ? '2026-12-31' : '2028-12-31';
  reqs.push(jmReq_('거주자가 공장(제조장 등 독립 사업단위)의 대지·건물을 양도', jmYn_(p.공장) === false ? false : (양도일 ? true : null), '시행령 §54① 공장 — 제조장 또는 자동차정비공장', 조 + '①·' + 령 + '⑪'));
  reqs.push(jmReq_('양도일이 ' + 끝기한 + ' 이전', 양도일 ? 양도일 <= 끝기한 : null, 양도일 || '양도일(잔금·등기 중 빠른 날)', 조 + '①'));
  let 토지만 = false;
  if (수용) {
    const 기준 = 고시일 && 양도일 && 양도일 < 고시일 ? 양도일 : (고시일 || 양도일);
    const 가동 = jmYmd_(기.가동시작) || '', 토취 = jmYmd_(기.토지취득일) || '';
    let r = null, why = '공장 가동 시작일(사업자등록·공장등록)';
    if (가동 && 기준) {
      if (famAddY_(가동, 2) <= 기준) { r = true; why = '가동 ' + 가동 + ' → 기준일 ' + 기준 + '에 2년 넘음'; }
      else if (양도일 && famAddY_(가동, 1) <= 양도일 && 토취 && famAddY_(토취, 5) <= 기준) { r = true; 토지만 = true; why = '2년 미만 가동이지만 양도일 현재 1년 넘게 가동·토지 ' + 토취 + '부터 5년 넘게 보유 — 토지만 대상(①괄호)'; }
      else { r = false; why = '가동 ' + 가동 + ' — 기준일(' + 기준 + ')까지 2년 미만' + (토취 ? ', 토지 5년 보유·1년 가동도 못 갖춤' : ''); }
    }
    reqs.push(jmReq_('사업인정고시일(그 전 양도면 양도일)부터 소급 2년 이상 가동', r, why, '조특법 §85의7①'));
    reqs.push(jmReq_('그 공익사업의 사업시행자에게 양도', /시행자/.test(String(p.양수자 || '')) ? true : (p.양수자 ? false : null), p.양수자 ? String(p.양수자) : '양수자(협의취득·수용 재결서)', '조특법 §85의7①'));
    const 소 = String(신.소재 || '');
    let 지방 = null, 지왜 = '신규공장 소재지(과밀억제권역·광역시·행정중심복합도시등인지)';
    if (jmYn_(신.시행지역안) === true && jmYn_(신.사업시행자직접취득) !== true) { 지방 = false; 지왜 = '공익사업 시행지역 안 — 사업시행자에게 직접 산 조성 토지가 아니면 안 됨'; }
    else if (소) {
      if (/과밀/.test(소)) { 지방 = false; 지왜 = '수도권과밀억제권역(§79의8①1호 — 산업단지라도 안 됨)'; }
      else if (/행복|행정중심/.test(소)) { 지방 = false; 지왜 = '행정중심복합도시등(§79의8①3호)'; }
      else if (/광역시/.test(소) && !/군/.test(소)) { 지방 = jmYn_(신.산업단지) === true; 지왜 = 지방 ? '광역시이지만 산업단지(§79의8①2호 단서)' : '광역시 관할(§79의8①2호 — 군·산업단지 아니면 안 됨)'; }
      else { 지방 = true; 지왜 = 소 + ' — 지방'; }
    }
    reqs.push(jmReq_('신규공장이 공익사업 시행지역 밖 「지방」', 지방, 지왜, '시행령 §79의8①'));
  } else {
    reqs.push(jmReq_('중소기업', jmYn_(p.중소기업), '중소기업기본법 기준(조특령 §2) — 직전 사업연도 기준', '조특법 §85의8①'));
    const 가동 = jmYmd_(기.가동시작) || '';
    reqs.push(jmReq_('기존공장에서 2년 이상 계속 공장시설을 갖추고 사업', 가동 && 양도일 ? famAddY_(가동, 2) <= 양도일 : null, 가동 ? '사업 ' + 가동 + ' ~ 양도 ' + (양도일 || '?') : '공장 사업 시작일', '조특법 §85의8①'));
    let 지 = null, 지왜 = '신규공장 소재지';
    if (jmYn_(신.같은산업단지) === true) { 지 = jmYn_(기.산업단지) === true; 지왜 = 지 ? '같은 산업단지 안 다른 공장으로 이전' : '같은 산업단지 이전은 기존공장도 산업단지 안이어야 함'; }
    else if (신.소재) { const 과밀 = /과밀/.test(String(신.소재)) && jmYn_(신.산업단지) !== true; 지 = !과밀; 지왜 = 과밀 ? '수도권과밀억제권역 안(산업단지 밖) — 대상 지역 밖으로 나가지 않음' : String(신.소재) + (jmYn_(신.산업단지) === true ? ' 산업단지' : '') + ' — 과밀억제권역(산업단지 제외) 밖'; }
    reqs.push(jmReq_('수도권과밀억제권역(산업단지 제외) 밖으로, 또는 같은 산업단지 안으로 이전', 지, 지왜, '조특법 §85의8①·시행령 §79의9①'));
  }
  // 이전 시기(⑤)
  const 개시 = jmYmd_(신.사업개시일) || '', 부득이 = jmYn_(p.부득이사유) === true;
  const 마감 = 양도일 ? famAddY_(양도일, 부득이 ? 6 : 3) : '';
  let 시기 = null, 시왜 = '';
  if (개시 && 양도일) {
    if (개시 <= 양도일) { 시기 = famAddY_(개시, 2) >= 양도일; 시왜 = '신규공장 사업개시 ' + 개시 + ' → ' + (시기 ? '2년 안 기존공장 양도(1호)' : '2년 지나 양도'); }
    else { 시기 = 개시 <= 마감; 시왜 = '양도 뒤 ' + 개시 + ' 사업개시 — ' + (부득이 ? '부득이 사유 6년' : '3년') + ' 마감 ' + 마감 + (시기 ? ' 안(2호)' : ' 넘김'); }
  } else if (jmYn_(p.이전안함) === true) { 시기 = false; 시왜 = '이전하지 않음'; }
  else 시왜 = 마감 ? '아직 이전 전 — ' + 마감 + '까지 신규공장을 취득해 사업을 시작해야 함' : '신규공장 사업개시일';
  reqs.push(jmReq_('이전 시기 — 신규 개시 뒤 2년 안 양도 또는 양도 뒤 3년(부득이 6년) 안 개시', 시기, 시왜, 령 + '⑤'));
  const w = jmWrap_(수용 ? '수용 공장 이전 분할납부(§85의7)' : '중소기업 공장 이전 분할납부(§85의8)', reqs, {});
  const 된다 = w.결론 === '충족';
  // 비율·분할세액
  const 양가 = num(기.양도가액), 실 = num(신.취득가액), 예 = num(신.예정가액);
  const 쓸값 = 실 || 예;
  const 비율 = 양가 && 쓸값 ? Math.min(1, 쓸값 / 양가) : null;
  const 초과 = Math.min(100, Math.max(0, famNum_(기.기준면적초과비율) || 0)) / 100;
  const 적용비율 = 비율 == null ? null : 비율 * (1 - 초과);
  const 차익 = num(기.양도차익), 세액 = num(p.세액);
  const 분할세액 = 된다 && 세액 && 적용비율 != null ? Math.floor(Math.round(세액 * 적용비율 * 100) / 100) : 0;
  const y = 양도일 ? +양도일.slice(0, 4) : 0;
  const 확정 = y ? (y + 1) + '-05-31' : '';
  const 시작 = 확정 ? famAddY_(확정, 5) : '';
  const 일정 = 분할세액 ? [0, 1, 2, 3, 4].map(function (i) { return { 때: famAddY_(시작, i), 금액: i < 4 ? Math.floor(분할세액 / 5) : 분할세액 - Math.floor(분할세액 / 5) * 4 }; }) : [];
  // 예정신고 납부기한(이자 기산) — 양도일이 속하는 달 말일부터 2개월
  const 예정기한 = 양도일 ? new Date(Date.UTC(y, +양도일.slice(5, 7) + 2, 0)).toISOString().slice(0, 10) : '';
  const 이자 = function (금액, 납부일) { if (!금액 || !예정기한 || !납부일 || 납부일 <= 예정기한) return 0; const d = Math.round((Date.parse(납부일) - Date.parse(famAddD_(예정기한, 1))) / 864e5) + 1; return Math.floor(금액 * d * 22 / 100000); };
  const 달말2 = function (d) { return new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) + 2, 0)).toISOString().slice(0, 10); };
  let 추징 = null;
  const 폐업 = jmYmd_(p.폐업일) || '';
  if (된다 && 분할세액) {
    let 사유 = '', 사유일 = '';
    if (폐업 && 양도일 && 폐업 < famAddY_(양도일, 3)) { 사유 = '양도일부터 3년 안 폐업·해산'; 사유일 = 폐업; }
    else if (시기 === false || jmYn_(p.이전안함) === true) { 사유 = '공장을 이전하지 않음'; 사유일 = 마감 || jmYmd_(p.오늘) || ''; }
    if (사유) { const 기한 = 달말2(사유일); 추징 = { 사유: 사유, 사유일: 사유일, 세액: 분할세액, 이자: 이자(분할세액, 기한), 납부기한: 기한, 근거: 조 + '②·§33③ 후단·시행령 §30⑨2호' }; }
  }
  let 정산 = null;
  if (된다 && 세액 && 예 && 실 && 실 < 예 && 양가) {
    const 넘은 = Math.floor(Math.round(세액 * (Math.min(1, 예 / 양가) - Math.min(1, 실 / 양가)) * (1 - 초과) * 100) / 100);
    const 개y = 개시 ? +개시.slice(0, 4) : 0;
    const 기한 = 개y ? (개y + 1) + '-05-31' : '';
    정산 = { 넘게받은세액: 넘은, 납부기한: 기한, 이자: 이자(넘은, 기한), 근거: 령 + '⑦' };
  }
  const 거래 = p.거래 && typeof p.거래 === 'object' ? p.거래 : { assetType: 'land', transferPrice: 양가 || undefined, transferDate: 양도일 || undefined, acquisitionCause: 'purchase' };
  경우.push({ 이름: '① 이 거래 양도소득세(분할 전 전체) — ' + (된다 ? '분할납부 ' + Math.round((적용비율 || 0) * 1000) / 10 + '%' + (w.잠정 ? '(잠정)' : '') : '분할납부 안 됨, 전액 납부'), 엔진칸: 거래 });
  // 할 일
  if (된다) {
    할일.push({ 무엇: '분할납부신청서·이전(예정)명세서를 예정신고와 함께 제출(안 내면 분할 못 받음)', 때: 예정기한 + '까지', 근거: 령 + '⑨' });
    if (분할세액) 할일.push({ 무엇: '지금 낼 세액 = 전체 ' + 세액.toLocaleString() + ' − 분할 ' + 분할세액.toLocaleString() + ' = ' + (세액 - 분할세액).toLocaleString() + '원', 때: 예정기한 + '까지', 근거: '소득세법 §106·' + 조 + '①2호' });
    if (일정.length) 할일.push({ 무엇: '분할세액 5년 균분 납부(해마다 ' + 일정[0].금액.toLocaleString() + '원 이상)', 때: 일정[0].때 + ' ~ ' + 일정[4].때, 근거: 조 + '①2호 후단 [확인 필요 — 권장: 「확정신고기한 종료일 이후 5년이 되는 날부터 5년의 기간 동안 균분한 금액 이상」 — 해마다 기일 명문 없음, 해마다 같은 날까지로 보는 지금 방식 권장]' });
    if (!개시 && 마감) 할일.push({ 무엇: '신규공장 취득·사업개시(못 하면 분할세액 전액+이자 추징)', 때: 마감 + '까지', 근거: 령 + '⑤2호·' + 조 + '②' });
    if (예 && !실) 할일.push({ 무엇: '신규공장을 사면 사업개시 과세연도 확정신고와 함께 이전완료보고서 제출 — 실제 취득가액이 예정가액보다 작으면 넘게 받은 몫 납부', 때: '사업개시 다음 해 5월 31일', 근거: 령 + '⑦⑩' });
    if (양도일) 할일.push({ 무엇: '양도일부터 3년 안 폐업·해산하지 않기', 때: famAddY_(양도일, 3) + '까지', 근거: 조 + '②' });
  } else if (예정기한) 할일.push({ 무엇: '양도소득세 예정신고·납부(분할 없이 전액)', 때: 예정기한 + '까지', 근거: '소득세법 §105①1호·§106' });
  if (추징) 할일.push({ 무엇: '추징 — ' + 추징.사유 + ': 분할세액 ' + 추징.세액.toLocaleString() + ' + 이자 ' + 추징.이자.toLocaleString() + '원', 때: 추징.납부기한 + '까지', 근거: 추징.근거 });
  if (정산) 할일.push({ 무엇: '예정가액보다 싸게 산 몫 납부 ' + 정산.넘게받은세액.toLocaleString() + ' + 이자 ' + 정산.이자.toLocaleString() + '원', 때: 정산.납부기한 + '까지', 근거: 정산.근거 });
  notes.push('분할세액 셈: 시행령은 「양도차익 × 비율에 대한 양도소득세」 — 여기서는 이 거래 결정세액 × 비율로 안분함 [확인 필요 — 권장: ①(차익×비율)에 세율을 따로 매긴 세액 ②이 거래 세액 × 비율(지금) — 문언은 ①에 가까우나 누진 차이 작음, 권장 ② 유지하고 ① 견주기]');
  notes.push('이자상당가산액 기간: 법 §33③ 후단 준용 — 시행령 §30⑨2호를 그대로 옮겨 「예정신고 납부기한 다음 날 ~ 납부일」로 셈 [확인 필요 — 권장: 준용 구조상 거주자는 §30⑨2호(예정신고 납부기한 다음 날~납부일)로 읽는 지금 셈 권장]');
  notes.push('지방소득세(양도소득분)도 나눠 내는지는 지방세법 영역 — 이 도구는 국세만 봄');
  if (수용) notes.push('공익사업 수용이면 조특법 §77 수용 감면도 볼 수 있음 — 감면 뒤 세액에 분할을 거는지, 둘을 함께 받는지(조특법 §127) [확인 필요 — 권장: 분할납부는 감면이 아니라 납부 특례 — §127⑦ 중복 제한 대상이 아니므로 감면 뒤 세액에 분할을 거는 쪽 권장, 예규 확인] — 판정 묶음 「보상금구분」·엔진 수용 감면 칸');
  if (토지만) notes.push('2년 미만 가동 — 토지만 대상(①괄호): 건물분 양도차익은 분할 대상이 아님. 토지·건물을 두 거래로 나눠 토지분 세액만 넣을 것(판정 묶음 「토지건물구분」)');
  if (초과) notes.push('공장입지기준면적을 넘는 대지 ' + Math.round(초과 * 100) + '%는 분할 대상에서 뺌(⑤ 단서) — 면적 비율로 줄임 [확인 필요 — 권장: 「대지가 … 면적을 초과하는 경우 그 초과하는 부분」 — 면적 기준 문언이라 면적 비율(지금) 권장]');
  notes.push('개인 공장 건물은 감가상각비로 필요경비에 넣은 금액을 취득가액에서 뺌(소득세법 §97③) — 엔진칸 취득가액 확인');
  서류.push('공장등록증·사업자등록증(가동 시작)', '양도 계약서·협의취득 또는 수용 재결서', '분할납부신청서·이전(예정)명세서', '신규공장 매매계약서·건축 계획(예정가액 근거)', '공장입지기준면적 확인(대지 면적)');
  if (수용) 서류.push('사업인정고시(관보·고시문)');
  else 서류.push('중소기업 확인서');
  return Object.assign(w, { 조문: 조, 분할: 된다, 토지만: 토지만, 비율: 비율 == null ? null : Math.round(비율 * 10000) / 100, 적용비율: 적용비율 == null ? null : Math.round(적용비율 * 10000) / 100,
    분할대상양도차익: 차익 && 적용비율 != null && 된다 ? Math.floor(차익 * 적용비율) : null, 분할세액: 분할세액 || null, 지금낼세액: 세액 ? 세액 - 분할세액 : null, 납부일정: 일정, 이전마감: 마감 || null, 예정신고기한: 예정기한 || null,
    추징: 추징, 정산: 정산, 경우: 경우, 할일: 할일, 받을서류: 서류, 알림: notes, 엔진칸: 경우[0].엔진칸, 엔진칸뜻: '양도소득세 계산(calculate_transfer_tax_multi의 거래 한 건)에 그대로 — 분할은 엔진 결과 세액을 「세액」 칸에 넣어 다시 부르면 셈' });
}
// [2026.11.04 복잡사건 123 「X씨 유언대용신탁」] 유언대용신탁·수익자연속신탁 상속 — 상증법 §2 1호·5호, §3의2, §9①③, §13, §19, §24 1호, §27, §33, 시행령 §19①·§25, 부칙(법률 제17654호)
//  ① 위탁자(피상속인)가 생전엔 자기가 수익자이고 사망으로 수익권이 넘어가는 유언대용신탁(신탁법 §59)·수익자연속신탁(신탁법 §60)은 상속(§2 1호) — 신탁재산은 상속재산(§9①), 받은 사람은 수유자(§2 5호)로 받은 몫만큼 납세의무·연대(§3의2).
//  ② 위탁자 생전에 남(수익자)에게 원본·수익을 준 것은 증여(§33) — 상속인은 10년·상속인 아닌 자는 5년 안 것을 사전증여로 가산(§13①).
//  ③ 손자 등 선순위 상속인이 아닌 사람이 신탁으로 받으면 세대생략 할증(§27, 대습상속 제외)·공제 종합한도에서 빼는지(§24 1호 「유증등」) [판단 대기 — 판단거리3차 #36: 할증(§27)은 수유자 포함이라 적용(이 부분은 원문으로 풀림) · §24 1호 「유증등」(유증·사인증여)에 유언대용신탁이 드는지는 문언상 불명 — 권장 포함(수유자 취급과 일관), 두 경우 유지].
//  ④ 금전신탁(금융회사 수탁)만 금융재산(시행령 §19①) — 부동산·주식 신탁은 금융재산상속공제에 안 넣음.
//  ⑤ 배우자가 신탁으로 받은 몫이 배우자 실제 상속액(§19①)에 드는지 [판단 대기 — 판단거리3차 #37: ①신탁 수익권도 배우자가 상속으로 얻은 재산이라 포함(권장) ②분할·등기 요건(§19②)을 못 갖춰 제외 — 두 경우 유지] — 두 경우로 견줌.
//  ⑥ 수익자연속신탁 1차 수익자가 죽어 2차 수익자로 넘어가면 1차 수익자의 상속재산(§9③).
//  p: { 상속개시일, 신탁:[{이름, 종류:유언대용|수익자연속|그밖, 재산종류:금전|부동산|주식, 수탁자:금융회사|그밖, 가액, 수익자, 관계:배우자|자녀|손자|형제|남, 대습(예/아니오), 생전수익자:위탁자|남, 생전지급:[{날짜,금액}]}],
//       배우자다른상속액, 엔진칸:{ calculate_inheritance_tax 칸 — 신탁 밖 재산만 } }
function judgeTrustInheritance_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const d = jmYmd_(p.상속개시일) || '';
  const 목록 = Array.isArray(p.신탁) ? p.신탁 : [];
  reqs.push(jmReq_('신탁 계약이 있음', 목록.length ? true : null, 목록.length ? 목록.length + '건' : '신탁 계약서를 봐야 함', '신탁법 §59·§60'));
  if (d && d < '2021-01-01') notes.push('상속개시일이 2021.1.1. 전 — 유언대용신탁·수익자연속신탁을 「상속」에 넣은 개정(법률 제17654호, 2020.12.22.)은 그 뒤 상속분부터. 옛 법에서는 신탁 수익권을 상속재산(§9①)으로 보았는지·증여(§33)로 보았는지 (원문 확인 2026-11-04: 상증법 부칙 법률 제17654호 제1조·제2조)');
  // 신탁마다
  let 합 = 0, 금전 = 0, 배우자몫 = 0, 손자몫 = 0, 남몫 = 0, 생전가산 = 0, 생전빠짐 = 0, 생전모름 = 0, 연속 = 0;
  const 줄 = [], 사람 = {};
  목록.forEach(function (t, i) {
    t = t || {};
    const v = num(t.가액), 관 = String(t.관계 || ''), 종 = String(t.종류 || ''), 재 = String(t.재산종류 || '');
    const 이름 = t.이름 || ('신탁 ' + (i + 1));
    const 생전남 = /남|자녀|배우자|손자|수익자/.test(String(t.생전수익자 || '')) && !/위탁자|본인|피상속인/.test(String(t.생전수익자 || ''));
    const 대습 = jmYn_(t.대습) === true;
    합 += v;
    if (/금전|예금|돈|현금/.test(재) && /금융/.test(String(t.수탁자 || '금융회사'))) 금전 += v;
    if (/배우자|아내|남편|처/.test(관)) 배우자몫 += v;
    else if (/손자|손녀|증손/.test(관) && !대습) 손자몫 += v;
    else if (/형제|남|조카|며느리|사위|타인/.test(관)) 남몫 += v;
    if (/연속/.test(종)) 연속 += v;
    사람[t.수익자 || 관 || 이름] = (사람[t.수익자 || 관 || 이름] || 0) + v;
    // 생전 지급 — 위탁자 생전에 남이 수익자였으면 받은 것은 증여(§33)
    (Array.isArray(t.생전지급) ? t.생전지급 : []).forEach(function (g) {
      const a = num(g && g.금액), gd = jmYmd_(g && g.날짜) || '';
      if (!a) return;
      if (!생전남) { notes.push(이름 + ': 생전 지급 ' + a.toLocaleString() + '원은 위탁자 본인이 수익자일 때 받은 것이면 증여 아님 — 남에게 갔는지 [실사건 때 확인]'); return; }
      const 상속인 = /배우자|자녀|아들|딸|아내|남편/.test(관) || (/손자|손녀/.test(관) && 대습);
      const 년 = 상속인 ? 10 : 5;
      if (!d || !gd) { 생전모름 += a; return; }
      const 끝 = (Number(d.slice(0, 4)) - 년) + d.slice(4);
      if (gd > 끝) 생전가산 += a; else 생전빠짐 += a;
    });
    줄.push(이름 + ' ' + v.toLocaleString() + '원 → ' + (t.수익자 || 관 || '수익자 모름') + '(' + (종 || '종류 모름') + ', ' + (재 || '재산 모름') + ')');
  });
  const 상속형 = 목록.filter(function (t) { return /유언대용|연속/.test(String((t || {}).종류 || '')); }).length;
  reqs.push(jmReq_('사망으로 수익권이 넘어가는 신탁(유언대용·수익자연속)', 목록.length ? (상속형 === 목록.length ? true : null) : null, 줄.join(' · ') || '종류를 모름', '상증법 §2 1호·§9①'));
  const 위탁자자익 = 목록.every(function (t) { return !/남|자녀|배우자|손자/.test(String((t || {}).생전수익자 || '')) || /위탁자|본인|피상속인/.test(String((t || {}).생전수익자 || '')); });
  reqs.push(jmReq_('생전엔 위탁자 본인이 수익자(생전 증여 없음)', 목록.length ? (위탁자자익 ? (목록.some(function (t) { return !(t || {}).생전수익자; }) ? null : true) : false) : null, 위탁자자익 ? '생전 수익자가 누구였는지 계약서로 확인' : '생전에 남이 받은 원본·수익은 증여(§33) — 사전증여로 가산', '상증법 §33·§13①'));
  if (합 > 0) notes.push('신탁재산 ' + 합.toLocaleString() + '원은 상속재산(§9①) — 수익자는 수유자(§2 5호)로 받은 몫 비율만큼 상속세를 내고 다른 상속인·수유자와 연대(§3의2①③). 신탁은 수탁자 명의라 등기부·잔고에 피상속인 이름이 안 나옴 — 신탁원부·신탁계약서로 찾아 빠뜨리지 말 것');
  if (생전가산 > 0) notes.push('위탁자 생전에 수익자에게 준 원본·수익 ' + 생전가산.toLocaleString() + '원은 증여(§33)이고 가산 기간(상속인 10년·그 밖 5년) 안 — 상속세 과세가액에 더함(§13①). 그때 증여세를 냈으면 증여세액공제(§28) — 엔진칸 priorGiftHeirs에 그 증여 과세표준·세액을 넣어야 공제 한도(§24 3호)·세액공제가 바로 셈');
  if (생전빠짐 > 0) notes.push('생전 지급 ' + 생전빠짐.toLocaleString() + '원은 가산 기간 밖 — 상속세엔 안 더함(그때 증여세 신고했는지는 따로 확인)');
  if (생전모름 > 0) 할일.push({ 무엇: '생전 지급 날짜 ' + 생전모름.toLocaleString() + '원어치', 때: '계산 전', 근거: '상증법 §13①' });
  if (금전 < 합) notes.push('금융재산상속공제(§22)엔 금융회사에 맡긴 금전신탁 ' + 금전.toLocaleString() + '원만 넣음(시행령 §19①) — 부동산·주식 신탁 ' + (합 - 금전).toLocaleString() + '원은 금융재산이 아님');
  if (손자몫 > 0) notes.push('대습상속이 아닌 손자·손녀에게 신탁으로 간 ' + 손자몫.toLocaleString() + '원은 세대생략 할증 30%(미성년·20억 넘으면 40%) 대상(§27) — 비율을 엔진칸 generationSkipHeirRatio로');
  if (손자몫 + 남몫 > 0) notes.push('선순위 상속인이 아닌 사람(손자 ' + 손자몫.toLocaleString() + '원·그 밖 ' + 남몫.toLocaleString() + '원)이 신탁으로 받은 몫을 공제 종합한도에서 빼는지(§24 1호 「상속인이 아닌 자에게 유증등을 한 재산」) [판단 대기 — 판단거리3차 #38: 같음 — 두 경우 유지] — 두 경우로 견줌');
  if (배우자몫 > 0) notes.push('배우자가 신탁으로 받은 ' + 배우자몫.toLocaleString() + '원을 배우자 실제 상속액(§19①)에 넣는지 [판단 대기 — 판단거리3차 #39: 같음] — 두 경우로 견줌');
  if (연속 > 0) { notes.push('수익자연속신탁 ' + 연속.toLocaleString() + '원: 다음 차례 수익자가 1차 수익자 사망으로 받으면 그것은 1차 수익자의 상속재산(§9③) — 1차 수익자 상속 때 다시 과세(단기재상속세액공제 §30 볼 것)'); 할일.push({ 무엇: '1차 수익자 사망 때 다음 수익자 몫을 그 상속재산에 넣기', 때: '1차 수익자 상속 신고 때', 근거: '상증법 §9③·§30' }); }
  notes.push('유류분: 신탁재산이 유류분 산정 기초재산(민법 §1113·§1114)에 드는지 판례가 갈림 [확인 필요 — 권장: 원문 없음 — [확인 필요] 유지] — 다른 상속인이 반환을 청구하면 판정 묶음 「유류분반환」으로');
  notes.push('신탁재산이 어디 있는지(상증법 §5 — 신탁재산은 그 재산이 있는 곳) — 피상속인이 비거주자면 국내 신탁재산만 과세');
  // 기한
  const 말일더하기 = function (x, m) { return new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) + m, 0)).toISOString().slice(0, 10); };
  if (d) 할일.push({ 무엇: '상속세 신고 — 신탁재산을 상속재산에 넣고 수유자 몫 적기', 때: 말일더하기(d, 6) + '까지', 근거: '상증법 §67①' });
  서류.push('신탁계약서(종류·생전 수익자·사후 수익자·변경권)', '신탁원부(부동산 신탁)·신탁 잔고 증명(금전신탁)', '생전 지급 내역(신탁 회사 지급 명세)', '가족관계증명서(수익자가 상속인인지·대습인지)');
  // 경우 — 엔진칸 base는 신탁 밖 재산
  const base = Object.assign({}, p.엔진칸 || {});
  if (d && !base.dateOfDeath) base.dateOfDeath = d;
  const 밖 = num(base.taxableEstateAmount);
  const 과세 = 밖 + 합 + 생전가산;
  const 사람합 = Object.keys(사람).length;
  if (합 > 0) {
    const gs = 과세 > 0 && 손자몫 > 0 ? Math.round(손자몫 / 과세 * 10000) / 10000 : undefined;
    const 공통 = { taxableEstateAmount: 과세, netFinancialAssets: num(base.netFinancialAssets) + 금전 || undefined };
    if (gs) { 공통.isGenerationSkip = true; 공통.generationSkipHeirRatio = gs; }
    const 배다른 = num(p.배우자다른상속액);
    const 배넣음 = base.hasSpouse ? { spouseActualInheritedAmount: 배다른 + 배우자몫 } : {};
    const 배뺌 = base.hasSpouse ? { spouseActualInheritedAmount: 배다른 } : {};
    const 비상속 = 손자몫 + 남몫;
    경우.push({ 이름: '① 신탁을 상속재산에 넣음 — 배우자 몫은 실제 상속액에 넣고, 선순위 아닌 사람 몫은 공제 한도에서 뺌', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, 공통, 배넣음, 비상속 ? { nonHeirBequestAmount: num(base.nonHeirBequestAmount) + 비상속 } : {}) });
    if (비상속) 경우.push({ 이름: '② 선순위 아닌 사람 몫을 공제 한도에서 안 뺌(§24 1호 「유증등」에 신탁이 안 든다고 보면)', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, 공통, 배넣음) });
    if (배우자몫 && base.hasSpouse) 경우.push({ 이름: '③ 배우자 신탁 몫을 실제 상속액에 안 넣음', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, 공통, 배뺌, 비상속 ? { nonHeirBequestAmount: num(base.nonHeirBequestAmount) + 비상속 } : {}) });
    경우.push({ 이름: '④ [견주기] 신탁을 빠뜨리고 신고하면(신탁 밖 재산만)', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, base.hasSpouse ? 배뺌 : {}) });
    if (금전 < 합) 경우.push({ 이름: '⑤ [견주기] 부동산·주식 신탁까지 금융재산으로 넣으면', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, 공통, 배넣음, { netFinancialAssets: num(base.netFinancialAssets) + 합 }, 비상속 ? { nonHeirBequestAmount: num(base.nonHeirBequestAmount) + 비상속 } : {}) });
  } else 할일.push({ 무엇: '신탁마다 가액(상속개시일 현재 평가액 — §60)', 때: '계산 전', 근거: '상증법 §9①·§60' });
  if (!(밖 > 0)) 할일.push({ 무엇: '신탁 밖 상속세 과세가액(엔진칸 taxableEstateAmount)', 때: '계산 전', 근거: '상증법 §13' });
  const w = jmWrap_('신탁상속', reqs, { 신탁합계: 합, 금전신탁: 금전, 배우자몫: 배우자몫 || undefined, 세대생략몫: 손자몫 || undefined, 비상속인몫: 남몫 || undefined, 생전증여가산: 생전가산 || undefined, 수익자수: 사람합, 경우: 경우, 엔진: 경우[0] ? 경우[0].엔진 : undefined, 엔진칸: 경우[0] ? 경우[0].엔진칸 : undefined, 엔진칸늘: 경우.length > 1 || undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = !목록.length ? '신탁 계약을 봐야 함' : '신탁재산 ' + 합.toLocaleString() + '원 상속재산(§9①)' + (생전가산 ? ' + 생전 증여 가산 ' + 생전가산.toLocaleString() + '원' : '') + (reqs.some(function (r) { return r.결과 === '?'; }) ? ' — 잠정' : '');
  return w;
}

// [2026.11.04 사건 124] 지정문화유산·박물관자료 등 상속세 징수유예(상증법 §74·§75, 시행령 §76, §78⑮, 옛 §12 2호·부칙 법률 제19195호 §6)
function judgeCulturalDeferral_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const d = jmYmd_(p.상속개시일) || '';
  const 목록 = Array.isArray(p.재산) ? p.재산 : [];
  const 담보 = jmYn_(p.담보);
  const 말일더하기 = function (x, m) { return new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) + m, 0)).toISOString().slice(0, 10); };
  const 기한 = d ? 말일더하기(d, jmYn_(p.비거주) === true ? 9 : 6) : '';
  const 옛법 = d && d < '2023-01-01';
  reqs.push(jmReq_('상속재산에 문화유산·박물관자료 등이 있음', 목록.length ? true : null, 목록.length ? 목록.length + '건' : '재산 목록을 봐야 함', '상증법 §74①'));
  let 유예 = 0, 비과세 = 0, 빠짐 = 0, 담보필요 = 0, 징수 = 0;
  const 줄 = [];
  목록.forEach(function (t, i) {
    t = t || {};
    const v = num(t.가액), 종 = String(t.종류 || ''), 이름 = t.이름 || ('재산 ' + (i + 1));
    const 보호 = jmYn_(t.보호구역토지) === true;
    let 호 = 0;
    if (/박물관|미술관/.test(종)) 호 = 2;
    else if (/천연기념물|명승|자연유산|시도자연/.test(종)) 호 = 4;
    else if (/국가지정|시도지정|국보|보물|사적|국가민속/.test(종)) 호 = 3;
    else if (/문화유산자료|문화재자료|국가등록|등록문화/.test(종)) 호 = 1;
    if (!호) { 빠짐 += v; 줄.push(이름 + ': 종류 [실사건 때 확인] — §74① 1~4호 어디인지'); 할일.push({ 무엇: 이름 + ' 지정·등록 종류(지정서·등록증)', 때: '계산 전', 근거: '상증법 §74①' }); return; }
    // 2023.1.1. 전 상속: 국가지정·시도지정문화재(천연기념물 포함)와 보호구역 토지는 비과세(옛 §12 2호, 부칙 §6)
    if (옛법 && (호 === 3 || 호 === 4)) { 비과세 += v; 줄.push(이름 + ' ' + v.toLocaleString() + '원 — 2023.1.1. 전 상속이라 옛 §12 2호 비과세(부칙 법률 제19195호 §6)' + (호 === 4 ? ' [확인 필요 — 권장: 경과조치로 옛 규정 적용은 확정 — 옛 §12 2호가 천연기념물을 「국가지정문화재」에 넣었는지는 옛 조문 원문 없음]' : '')); return; }
    if (호 === 2) {
      const 공익 = jmYn_(t.공익법인박물관), 사립 = /사립/.test(String(t.박물관 || '')), 전시 = jmYmd_(t.전시일) || '';
      const 사유끝 = jmYmd_(t.부득이사유끝) || '';
      const 전시기한 = 사유끝 ? 말일더하기(사유끝, 6) : 기한;
      const ok공익 = !사립 || 공익 === true;
      const ok전시 = 전시 && 전시기한 ? 전시 <= 전시기한 : null;
      if (사립 && 공익 !== true) notes.push(이름 + ': 사립 박물관·미술관은 공익법인등이 세운 것만(§74①2호 괄호) — ' + (공익 === false ? '아니어서 유예 못 받음' : '[실사건 때 확인]'));
      if (ok전시 === false) notes.push(이름 + ': ' + 전시기한 + '까지 박물관에 전시·보존해야 하는데(§74⑧·시행령 §76⑧) ' + 전시 + ' — 늦어서 유예 못 받음');
      if (ok전시 == null) 할일.push({ 무엇: 이름 + ' 박물관 등록·전시 — 늦어도 ' + (전시기한 || '신고기한') + '까지', 때: 전시기한 || '신고기한', 근거: '상증법 §74⑧·시행령 §76⑧' });
      if (!ok공익 || ok전시 === false) { 빠짐 += v; 줄.push(이름 + ' ' + v.toLocaleString() + '원 — 박물관자료 요건 못 채움'); return; }
      if (사립 && 공익 == null || ok전시 == null) notes.push(이름 + ': 박물관자료 요건이 다 확인되지 않아 잠정으로 유예에 넣음');
    }
    유예 += v; if (호 === 1 || 호 === 2) 담보필요 += v;
    줄.push(이름 + ' ' + v.toLocaleString() + '원 — §74①' + 호 + '호' + (보호 ? '(보호구역 토지)' : ''));
    const 양 = jmYmd_(t.양도일) || '', 인 = jmYmd_(t.인출일) || '';
    if (양 || 인) { 징수 += v; notes.push(이름 + ': ' + (양 ? 양 + ' 유상 양도' : 인 + ' 박물관에서 인출(등록취소·폐관·등록자료 제외 — 시행령 §76⑤)') + ' — 그 재산 몫 유예세액을 바로 징수(§74②)'); }
  });
  reqs.push(jmReq_('유예 대상 재산(§74① 각 호)', 목록.length ? (유예 + 비과세 > 0 ? (빠짐 ? null : true) : false) : null, 줄.join(' · ') || '없음', '상증법 §74①·§75' + (옛법 ? '·옛 §12 2호' : '')));
  if (유예 > 0) {
    if (담보필요 > 0) reqs.push(jmReq_('담보 제공(1·2호는 꼭)', 담보 == null ? null : 담보, 담보 == null ? '담보 제공 여부를 봐야 함' : (담보 ? '제공' : '안 함 — 1·2호 재산은 유예 못 받을 수 있음'), '상증법 §74④·§71 준용'));
    if (담보 === false || (담보 == null && 담보필요 === 0)) {
      notes.push('3·4호(지정문화유산·천연기념물 등)는 담보 없이 유예 가능(§74⑤) — 대신 해마다 보유현황 신고(⑥)·양도하려면 7일 전 신고(⑦)');
      notes.push('담보 없이 유예받고 보유현황을 안 내면 유예세액의 1%, 양도 신고를 안 하면 20% 가산세(§78⑮)');
      할일.push({ 무엇: '문화유산 보유현황명세서 제출(시행령 §76⑥)', 때: '해마다 12월 31일까지', 근거: '상증법 §74⑥' });
      할일.push({ 무엇: '양도하기 7일 전 양도거래신고서(시행령 §76⑦)', 때: '양도 7일 전', 근거: '상증법 §74⑦' });
    }
    notes.push('상속인이 유예받은 재산을 그대로 가진 채 사망해 다시 상속이 시작되면 유예세액은 부과 철회 — 다시 안 매김(§74③)');
    notes.push('3% 신고세액공제 기준액에서 유예액을 뺌(§69①1호) — 엔진이 이미 뺌');
  }
  if (비과세 > 0) notes.push('비과세 ' + 비과세.toLocaleString() + '원은 상속세 과세가액에서 빼고 신고(옛 §12 2호) — 유예가 아님');
  if (d) 할일.push({ 무엇: '상속세 신고와 함께 징수유예 신청(유예 재산 명세)', 때: 기한 + '까지', 근거: '상증법 §74①·§67①' });
  서류.push('지정서·등록증(문화유산·천연기념물)', '보호구역 지정 고시(토지)', '박물관 등록증·박물관자료 등록 목록·공익법인 서류', '담보 서류', '재산 평가 근거(§60)');
  // 경우 — 엔진칸 base는 문화유산을 포함한 상속 과세가액
  const base = Object.assign({}, p.엔진칸 || {});
  if (d && !base.dateOfDeath) base.dateOfDeath = d;
  const 과세 = num(base.taxableEstateAmount);
  if (!(num(base.grossEstateValue) > 0) && !(num(base.totalGrossEstateValue) > 0) && 과세 > 0) {
    base.grossEstateValue = num(p.상속재산총액) || 과세;
    if (!num(p.상속재산총액)) notes.push('나눌 바탕(상속재산가액, §13 가산 증여재산 포함 — 시행령 §76①)을 몰라 과세가액으로 잠정 — 「상속재산총액」을 넣으면 정확');
  }
  if (과세 > 0 && (유예 > 0 || 비과세 > 0)) {
    const 비과후 = Math.max(0, 과세 - 비과세);
    if (유예 > 0) 경우.push({ 이름: '① 법대로 — 유예 재산 몫 상속세 징수유예(시행령 §76①)', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, { taxableEstateAmount: 비과후, culturalPropertyValue: 유예, culturalPropertyDeferredTaxAmount: undefined }) });
    if (비과세 > 0) 경우.push({ 이름: '② 옛 법 비과세분을 과세가액에서 뺌(2023.1.1. 전 상속)', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, { taxableEstateAmount: 비과후 }) });
    경우.push({ 이름: '③ [견주기] 유예·비과세를 빠뜨리고 신고하면', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, { culturalPropertyValue: undefined, culturalPropertyDeferredTaxAmount: undefined }) });
  } else if (!(과세 > 0)) 할일.push({ 무엇: '상속세 과세가액(문화유산 포함, 엔진칸 taxableEstateAmount)', 때: '계산 전', 근거: '상증법 §13' });
  const w = jmWrap_('문화유산징수유예', reqs, { 유예재산가액: 유예, 비과세가액: 비과세 || undefined, 요건못채움: 빠짐 || undefined, 바로징수재산: 징수 || undefined, 경우: 경우, 엔진칸: 경우.length ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = !목록.length ? '재산 목록을 봐야 함' : (유예 ? '징수유예 대상 ' + 유예.toLocaleString() + '원(유예세액은 엔진이 셈)' : '유예 대상 없음') + (비과세 ? ' · 옛 법 비과세 ' + 비과세.toLocaleString() + '원' : '') + (징수 ? ' · 양도·인출로 바로 징수 ' + 징수.toLocaleString() + '원어치' : '');
  return w;
}

// [2026.11.04 복잡사건 125 「옥씨 장학재단」] 공익법인 사후관리 위반 — 출연받은 재산을 법대로 안 쓰면 공익법인이 그 가액을 증여받은 것으로 보아 즉시 증여세(상증법 §48②·③, 시행령 §38·§39·§40)
function judgeCharityAftercare_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 말일더하기 = function (x, m) { return new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) + m, 0)).toISOString().slice(0, 10); };
  const 년더하기 = function (x, y) { return (+x.slice(0, 4) + y) + x.slice(4); };
  const 다음날 = function (x) { const t = new Date(x + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
  if (jmYn_(p.종교단체) === true) notes.push('종교단체가 출연받은 헌금(부동산·주식 제외)은 §48②1호·4호를 보지 않음(시행령 §38①) — 해당 헌금이면 빼고 보세요');
  const 목록 = Array.isArray(p.위반) ? p.위반 : [];
  const 불산입 = jmYn_(p.불산입받음);
  reqs.push(jmReq_('공익법인등이 출연받은 재산(§16①·§48①으로 과세가액 불산입)', 불산입 === false ? false : (목록.length ? true : null), 불산입 === false ? '처음부터 불산입을 안 받았으면 §48② 사후관리 대상이 아님' : (목록.length ? 목록.length + '건 살펴봄' : '살펴볼 일 목록이 없음'), '상증법 §48①②'));
  let 합계 = 0, 가산세거리 = 0;
  const 줄 = [];
  목록.forEach(function (t, i) {
    t = t || {};
    const 종 = String(t.종류 || ''), 이름 = t.이름 || ('일 ' + (i + 1));
    let 가액 = 0, 호 = '', 근거 = '', 사유일 = jmYmd_(t.사유발생일) || '', 잠정 = false, 제외 = '';
    if (/매각대금/.test(종)) {
      const 대금 = num(t.매각대금), 쓴 = num(t.사용실적), 외 = num(t.외사용금액), 매각일 = jmYmd_(t.매각일) || '', 연말 = jmYmd_(t.사업연도종료일) || (매각일 ? 매각일.slice(0, 4) + '-12-31' : '');
      const 기준 = Math.floor(대금 * 0.9), 미달 = Math.max(0, 기준 - 쓴);
      const 외분 = (대금 && 외) ? Math.floor(기준 * 외 / 대금) : 0;
      가액 = 외분 + 미달; 호 = '4호'; 근거 = '시행령 §40①3호 — 가 공익 밖 사용분(사용기준금액 = 매각대금 90%, §38④ × 밖에 쓴 금액 ÷ 매각대금) ' + 외분.toLocaleString() + '원 + 나 사용기준 미달분 ' + 미달.toLocaleString() + '원';
      if (!jmYmd_(t.사업연도종료일) && 매각일) notes.push(이름 + ': 사업연도 끝나는 날을 몰라 12월 31일로 잠정');
      if (연말 && !사유일) { 사유일 = 다음날(년더하기(연말, 3)); 잠정 = true; }
      if (연말) { notes.push(이름 + ': 매각대금은 1년 안 30%·2년 안 60% 이상 써야 하고 못 미치면 가산세(§48②5호·시행령 §38⑦·§78⑨2호) — 점검일 ' + 년더하기(연말, 1) + '·' + 년더하기(연말, 2)); 가산세거리++; }
    } else if (/운용소득/.test(종)) {
      const 평가 = num(t.출연재산평가가액), 외 = num(t.외사용금액), 소득 = num(t.운용소득);
      가액 = (평가 && 외 && 소득) ? Math.floor(평가 * 외 / 소득) : num(t.가액);
      호 = '3호'; 근거 = '시행령 §40①2의2 — 출연재산 평가가액(직접 공익 사용분 뺌) × 공익 밖에 쓴 운용소득 ÷ 운용소득(§38⑤)';
      if (!(평가 && 외 && 소득)) 할일.push({ 무엇: 이름 + ': 출연재산 평가가액(직접 공익 사용분 제외)·운용소득·공익 밖에 쓴 금액', 때: '계산 전', 근거: '시행령 §40①2의2' });
      notes.push(이름 + ': 운용소득을 기준금액(80%)보다 덜 쓴 것은 증여세가 아니라 가산세(§48②5호·§78⑨1호) — 따로 보세요');
    } else if (/의결권/.test(종)) {
      가액 = num(t.초과보유주식가액 || t.가액); 호 = '6호'; 근거 = '시행령 §40①3의2 — 의결권 행사한 날 발행주식 10% 넘게 가진 주식 가액';
      if (!사유일) 사유일 = jmYmd_(t.의결권행사일) || '';
    } else if (/주식|초과취득/.test(종)) {
      가액 = num(t.초과취득에쓴재산 || t.가액); 호 = '2호'; 근거 = '시행령 §40①2호 — §16② 비율을 넘는 주식 취득에 쓴 재산 가액';
    } else if (/잔여재산|해산|귀속/.test(종)) {
      가액 = num(t.가액); 호 = '8호(시행령 §38⑧1호)'; 근거 = '시행령 §40①4호 — 국가·지자체·같거나 비슷한 공익법인에 귀속시키지 않은 재산 가액';
    } else if (/특정인|일부.*혜택/.test(종)) {
      가액 = num(t.가액); 호 = '8호(시행령 §38⑧2호)'; 근거 = '시행령 §40①5호 — 특정인에게 준 이익 (원문 확인 2026-11-04: 상증령 §40①5호)';
    } else if (/임대|무상|사용대차|소비대차|자기내부/.test(종)) {
      const 출 = num(t.출연재산가액), 적정 = num(t.적정대가), 낸 = num(t.받은대가);
      const 예외 = String(t.예외 || '');
      호 = '§48③'; 근거 = '시행령 §39③ — 출연자·친족·특수관계인에게 무상이면 출연재산가액, 낮은 대가면 차액 상당 출연재산가액';
      if (예외) 제외 = '시행령 §39② 예외(' + 예외 + ') — 증여세 안 매김 [예외 요건 서류 확인]';
      else if (jmYn_(t.무상) === true || (!낸 && !적정)) 가액 = 출;
      else if (적정 && 낸 < 적정) { 가액 = Math.floor(출 * (적정 - 낸) / 적정); notes.push(이름 + ': 낮은 대가 — 「차액에 상당하는 출연재산가액」을 출연재산가액 × (시가 대가 − 받은 대가) ÷ 시가 대가로 잠정 [확인 필요 — 권장: 셈법 명문 없음 — 출연재산가액 × (시가 대가 − 받은 대가) ÷ 시가 대가(지금) 권장](시행령 §39③)'); }
      else if (적정 && 낸 >= 적정) 제외 = '시가(시행령 §32③ 시가와 법인세법 §52② 시가 중 적은 금액) 이상 대가를 받음 — §48③ 해당 없음';
      if (!사유일) 사유일 = jmYmd_(t.사용시작일) || '';
      const 상대 = String(t.상대 || '');
      if (상대 && !/출연자|친족|특수관계|이사|자녀|아들|딸|배우자|형제|계열/.test(상대)) notes.push(이름 + ': 쓰는 사람이 §48③ 1~3호(출연자·친족·특수관계인 등)인지 [실사건 때 확인]');
    } else if (/3년|미사용|미달|계속/.test(종)) {
      const 출연일 = jmYmd_(t.출연일) || '', 받은 = num(t.출연가액), 쓴 = num(t.사용금액);
      const 계속 = /계속/.test(종);
      가액 = 계속 ? num(t.가액) : Math.max(0, 받은 - 쓴);
      호 = '1호'; 근거 = 계속 ? '시행령 §40①1호 다 — 3년 뒤 계속 안 쓰는 재산 가액' : '시행령 §40①1호 나 — 출연받은 날부터 3년 안에 안 쓰거나 덜 쓴 재산 가액';
      if (!사유일 && 출연일 && !계속) { 사유일 = 다음날(년더하기(출연일, 3)); 잠정 = true; }
      const 부득 = jmYn_(t.부득이사유);
      if (부득 === true) {
        const 보고 = jmYn_(t.사용계획보고), 해소 = jmYmd_(t.사유해소일) || '', 사용 = jmYmd_(t.해소뒤사용일) || '';
        const 기한 = 해소 ? 년더하기(해소, 1) : '';
        if (보고 === true && (!사용 || !기한 || 사용 <= 기한)) { 제외 = '부득이 사유(시행령 §38③)·사용계획 보고' + (기한 ? '·사유 없어진 날부터 1년 안(' + 기한 + '까지) 사용' : '') + ' — 1호 단서로 증여세 안 매김'; if (!사용) 할일.push({ 무엇: 이름 + ': 사유 없어진 날부터 1년 안 직접 공익목적사업에 사용' + (기한 ? '(' + 기한 + '까지)' : ''), 때: 기한 || '사유 해소 뒤 1년', 근거: '상증법 §48②1호 단서' }); }
        else if (보고 == null) notes.push(이름 + ': 부득이 사유가 있어도 사용계획·진도를 납세지 관할 세무서장에게 보고해야 단서 적용 — 보고 여부 (원문 확인 2026-11-04: 상증법 §48②1호 단서·상증령 §38③)');
        else notes.push(이름 + ': 부득이 사유 단서 요건(보고·사유 없어진 날부터 1년 안 사용)을 못 채움 — 즉시 증여세');
      } else if (부득 == null && !계속) notes.push(이름 + ': 3년 안 못 쓴 부득이 사유(주무부장관 인정·인허가 지연·소송 등, 시행령 §38③)가 있었는지 [실사건 때 확인]');
    } else if (/용도외|공익목적.*외|외사용/.test(종)) {
      가액 = num(t.사용금액 || t.가액); 호 = '1호'; 근거 = '시행령 §40①1호 가 — 공익목적 밖에 쓴 재산 가액';
    } else { 줄.push(이름 + ': 종류 [실사건 때 확인] — §48② 1~8호·③ 중 어디인지'); return; }
    if (제외) { 줄.push(이름 + ': ' + 제외); return; }
    if (!(가액 > 0)) { 줄.push(이름 + ': 가액 [실사건 때 확인]'); 할일.push({ 무엇: 이름 + ' 가액 근거 금액', 때: '계산 전', 근거: 근거 }); return; }
    합계 += 가액;
    const 기한 = 사유일 ? 말일더하기(사유일, 3) : '';
    줄.push(이름 + ' ' + 가액.toLocaleString() + '원 — ' + (호 === '§48③' ? '§48③' : '§48②' + 호) + ' · ' + 근거 + (사유일 ? ' · 증여일(사유 발생일) ' + 사유일 + (잠정 ? '(잠정)' : '') + ' · 신고기한 ' + 기한 : ''));
    if (잠정) notes.push(이름 + ': 사유 발생일을 기간 끝난 다음 날로 잠정 — [확인 필요 — 권장: 3년이 끝난 다음 날로 보는 지금 잠정 권장 — 세무서 실무 확인] 세무서가 보는 날');
    if (!사유일) 할일.push({ 무엇: 이름 + ': 사유 발생일(증여일)', 때: '계산 전', 근거: '상증법 §48②' });
    if (기한) 할일.push({ 무엇: 이름 + ': 공익법인 증여세 신고(증여일이 속하는 달 말일부터 3개월)', 때: 기한 + '까지', 근거: '상증법 §48②·§68①' });
    경우.push({ 이름: '① 법대로 — ' + 이름 + ' 증여세(공익법인이 수증자)', 엔진: 'calculate_gift_tax', 엔진칸: { giftAmount: 가액, relation: '기타', giftDate: 사유일 || undefined } });
  });
  reqs.push(jmReq_('사후관리 위반으로 즉시 증여세를 매길 일', 목록.length ? (합계 > 0) : null, 줄.join(' · ') || '없음', '상증법 §48②·③, 시행령 §40①·§39③'));
  if (합계 > 0) {
    notes.push('증여세를 내는 사람은 공익법인등(수증자) — 공익법인은 증여재산공제가 없어 관계 「기타」로 셈');
    notes.push('같은 출연자에게서 받은 재산끼리 10년 합산(§47②)할지는 [확인 필요 — 권장: 증여자(출연자)가 같으면 합산 대상으로 읽힐 수 있으나 사유별 의제라 따로 셈하는 해석도 — 권장 일마다 따로(지금), 예규 확인] — 엔진은 일마다 따로 셈');
    경우.push({ 이름: '② [견주기] 사후관리를 안 보면 — 추가 증여세 0원으로 보이지만 나중에 결정되면 무신고·납부지연 가산세까지', 엔진: null });
  }
  if (가산세거리 || 목록.some(function (t) { return /운용소득/.test(String((t || {}).종류)); })) notes.push('5호(운용소득 80%·매각대금 30%/60%)·7호는 증여세가 아니라 가산세(§78⑨) — 엔진 「공익법인 가산세」(income_underused)로 따로 셈');
  notes.push('이사 중 출연자·특수관계인이 5분의 1을 넘으면 가산세(§48⑧·§78⑥), 출연재산 보고서(§48⑤)·외부감사·전용계좌 의무도 함께 보세요');
  할일.push({ 무엇: '출연재산 등에 대한 보고서·이행 내역 제출', 때: '과세기간·사업연도 종료일부터 4개월 안(시행령 §41① — 원문 확인 2026-11-04)', 근거: '상증법 §48⑤·시행령 §41①' });
  서류.push('출연 증서·출연재산 목록·평가서', '정관(고유목적사업)', '매각 계약서·매각대금 사용 내역', '운용소득 계산서·사용 내역', '임대차·사용대차 계약서·임대료 시가 근거', '주무관청 부득이 사유 인정·사용계획 보고서', '이사회 회의록');
  const w = jmWrap_('공익법인사후관리', reqs, { 증여세과세가액합계: 합계, 경우: 경우, 엔진칸: 경우.length && 경우[0].엔진칸 ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = !목록.length ? '살펴볼 일 목록을 봐야 함' : (합계 > 0 ? '즉시 증여세 과세가액 ' + 합계.toLocaleString() + '원(공익법인이 수증자, 일마다 엔진이 셈)' : '즉시 증여세 매길 일 없음');
  return w;
}

// [2026.11.04 복잡사건 126 「위씨 장학 공익신탁」] 공익신탁재산 과세가액 불산입 — 「공익신탁법」 공익신탁으로 공익법인등에 출연한 재산만, 요건(시행령 §14①)·이행 시기(②)를 갖춰야 상속·증여세 과세가액에서 뺌(상증법 §17·§52, 시행령 §14·§45)
//  엔진은 공익신탁재산가액(publicTrustAmount)을 넣은 대로 빼기만 해서(요건 판정 없음) 요건 못 채운 신탁도 빠질 수 있었다.
//  p: { 세목(상속|증여), 상속개시일, 증여일, 비거주(예), 엔진칸(그 밖 계산 칸), 신탁: [{ 이름, 가액, 출연자(피상속인|상속인|증여자), 공익신탁법인가(예), 목적, 수익자(공익법인등|수혜자|기타), 중도해지(예), 잔여귀속(국가|지자체|다른공익신탁|기타), 신탁이행일, 지연사유(예), 사유해소일 }] }
function judgePublicTrust_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 말일더하기 = function (x, m) { return new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) + m, 0)).toISOString().slice(0, 10); };
  const 증여 = /증여/.test(String(p.세목 || '')) || (!!jmYmd_(p.증여일) && !jmYmd_(p.상속개시일));
  const 기준일 = 증여 ? (jmYmd_(p.증여일) || '') : (jmYmd_(p.상속개시일) || '');
  const 비거주 = jmYn_(p.비거주) === true;
  const 신고기한 = 기준일 ? 말일더하기(기준일, 증여 ? 3 : (비거주 ? 9 : 6)) : '';
  const 조 = 증여 ? '상증법 §52' : '상증법 §17①';
  if (증여) notes.push('증여는 §52 후단이 §17②를, 시행령 §45가 §14를 준용 — 「상속세과세표준 신고기한」은 증여세 신고기한(달 말일부터 3개월, §68①)으로 읽음 [확인 필요 — 권장: 준용 취지상 증여세 신고기한(§68①)으로 읽는 지금 방식 권장]');
  const 목록 = Array.isArray(p.신탁) ? p.신탁 : [];
  let 인정 = 0, 전체 = 0, 잠정 = false, 잠정합 = 0;
  const 줄 = [];
  목록.forEach(function (t, i) {
    t = t || {};
    const 이름 = t.이름 || ('신탁 ' + (i + 1)), 가액 = num(t.가액);
    전체 += 가액;
    const 빠짐 = [], 모름 = [];
    const 인가 = jmYn_(t.공익신탁법인가);
    if (인가 === false) 빠짐.push('「공익신탁법」 공익신탁(법무부장관 인가)이 아님 — 일반 신탁·기부금 신탁은 불산입 안 됨(' + 조 + ')');
    else if (인가 == null) 모름.push('「공익신탁법」에 따른 공익신탁(인가)인지');
    const 목적 = String(t.목적 || '');
    if (목적 && !/종교|자선|학술|공익|장학|교육|의료|사회복지|문화|예술|환경/.test(목적)) 빠짐.push('목적이 종교·자선·학술 그 밖 공익이 아님(' + 조 + ')');
    else if (!목적) 모름.push('신탁 목적');
    const 수 = String(t.수익자 || '');
    if (/공익법인|수혜자/.test(수)) { /* 시행령 §14①1호 충족 */ }
    else if (수) 빠짐.push('수익자가 공익법인등(시행령 §12)이나 그 수혜자가 아님(시행령 §14①1호) — ' + 수);
    else 모름.push('수익자가 공익법인등이거나 그 수혜자인지(시행령 §14①1호)');
    const 해지 = jmYn_(t.중도해지);
    if (해지 === true) 빠짐.push('만기 전에 중도해지·취소됨(시행령 §14①2호)');
    else if (해지 == null) 모름.push('신탁계약에 만기 전 중도해지·취소가 없는지(시행령 §14①2호)');
    const 잔 = String(t.잔여귀속 || '');
    if (/국가|지방자치|지자체|다른.*공익신탁/.test(잔)) { /* §14①3호 */ }
    else if (잔) 빠짐.push('중도해지·종료 때 남은 신탁재산이 국가·지자체·다른 공익신탁에 귀속되지 않음(시행령 §14①3호) — ' + 잔);
    else 모름.push('남은 신탁재산 귀속처(시행령 §14①3호)');
    if (!증여) {
      const 출 = String(t.출연자 || '');
      if (출 && !/피상속인|상속인|유언/.test(출)) 빠짐.push('출연자가 피상속인·상속인이 아님(§17①) — ' + 출);
    }
    const 이행 = jmYmd_(t.신탁이행일) || '';
    let 이행기한 = 신고기한, 지연 = jmYn_(t.지연사유) === true;
    if (지연) {
      const 해소 = jmYmd_(t.사유해소일) || '';
      이행기한 = 해소 ? 말일더하기(해소, 6) : '';
      if (!해소) 모름.push('법령상·행정상 지연 사유가 끝난 날(시행령 §14② 단서 — 그 달 말일부터 6개월)');
      notes.push(이름 + ': 법령상·행정상 사유로 이행이 늦어지면 사유 끝난 날이 속하는 달 말일부터 6개월 안 이행(시행령 §14② 단서)' + (이행기한 ? ' — ' + 이행기한 + '까지' : ''));
    }
    if (이행 && 이행기한 && 이행 > 이행기한) 빠짐.push('신탁 이행일 ' + 이행 + '이 기한 ' + 이행기한 + '을 넘김(시행령 §14②)');
    else if (!이행) { 모름.push('신탁 이행일(이행 기한' + (이행기한 ? ' ' + 이행기한 : ' 모름') + ', 시행령 §14②)'); if (이행기한) 할일.push({ 무엇: 이름 + ': 공익신탁 이행(신탁재산 이전) — 이행일 알려 주기', 때: 이행기한 + '까지', 근거: '시행령 §14②' + (증여 ? '·§45' : '') }); }
    if (!(가액 > 0)) 모름.push('신탁재산 가액(상속·증여 평가액)');
    let 판정;
    if (빠짐.length) 판정 = false; else if (모름.length) 판정 = null; else 판정 = true;
    if (판정 === true) 인정 += 가액;
    if (판정 === null) { 잠정 = true; 잠정합 += 가액; const 남은 = 모름.filter(function (x) { return !/^신탁 이행일/.test(x) || !이행기한; }); if (남은.length) 할일.push({ 무엇: 이름 + ': ' + 남은.join(' · '), 때: '신고 전', 근거: 조 + '·시행령 §14' }); }
    reqs.push(jmReq_(이름 + ' 공익신탁 불산입', 판정, (가액 ? 가액.toLocaleString() + '원 · ' : '') + (빠짐.length ? '안 됨: ' + 빠짐.join(' / ') : 모름.length ? '모름: ' + 모름.join(' / ') : '요건 모두 충족'), 조 + ', 시행령 §14①②' + (증여 ? '·§45' : '')));
    줄.push(이름 + (판정 === true ? ' 불산입' : 판정 === false ? ' 과세' : ' 잠정'));
  });
  if (!목록.length) reqs.push(jmReq_('공익신탁으로 출연한 재산', null, '신탁 목록이 없음', 조));
  const 기본 = (p.엔진칸 && typeof p.엔진칸 === 'object') ? p.엔진칸 : {};
  const 엔진 = 증여 ? 'calculate_gift_tax' : 'calculate_inheritance_tax';
  const 칸 = function (v) { const o = JSON.parse(JSON.stringify(기본)); o.publicTrustAmount = v; if (증여 && 기준일 && !o.giftDate) o.giftDate = 기준일; if (!증여 && 기준일 && !o.dateOfDeath) o.dateOfDeath = 기준일; return o; };
  if (목록.length) {
    경우.push({ 이름: '① 법대로 — 요건 갖춘 공익신탁 ' + 인정.toLocaleString() + '원만 뺌', 엔진: 엔진, 엔진칸: 칸(인정) });
    if (잠정합) 경우.push({ 이름: '② 모르는 요건이 다 갖춰지면 — ' + (인정 + 잠정합).toLocaleString() + '원 뺌(잠정)', 엔진: 엔진, 엔진칸: 칸(인정 + 잠정합) });
    if (전체 > 인정 + 잠정합) 경우.push({ 이름: '③ [견주기] 요건을 안 보고 신탁 전부 ' + 전체.toLocaleString() + '원을 뺐다면(과소신고 위험)', 엔진: 엔진, 엔진칸: 칸(전체) });
  }
  notes.push('공익신탁(§17)은 공익법인등에 직접 출연(§16)과 다른 길 — 직접 출연이면 「공익법인 출연」 요건·§48 사후관리를 보세요');
  notes.push('불산입 뒤 중도해지되거나 남은 재산이 다른 곳에 가면 어떻게 다시 매기는지 법·시행령에 따로 조문이 없음 — 요건(시행령 §14①2·3호) 위반으로 불산입 부인 [확인 필요 — 권장: 원문 없음 — 요건 미충족으로 불산입 부인(상속세 경정) 외 부과 시기·가산세는 [확인 필요] 유지]');
  notes.push('신탁재산 가액은 상속·증여 평가액(§60~)으로 — 엔진 칸 publicTrustAmount');
  if (신고기한) 할일.push({ 무엇: (증여 ? '증여세' : '상속세') + ' 신고(공익신탁 불산입 명세 함께)', 때: 신고기한 + '까지', 근거: 증여 ? '상증법 §68①' : '상증법 §67①' + (비거주 ? '·④(국외 주소 9개월)' : '') });
  서류.push('공익신탁 인가서(법무부장관)', '신탁계약서(수익자·만기·중도해지·잔여재산 귀속 조항)', '신탁재산 이전 증빙(이행일)', '수익자 공익법인등 확인 서류', '지연 사유 증빙(있으면)', '신탁재산 평가 자료');
  const w = jmWrap_('공익신탁', reqs, { 불산입액: 인정, 잠정액: 잠정합, 신탁합계: 전체, 신고기한: 신고기한 || undefined, 잠정: 잠정 || undefined, 경우: 경우, 엔진칸: 경우.length ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = !목록.length ? '공익신탁 목록을 봐야 함' : '불산입 ' + 인정.toLocaleString() + '원' + (잠정합 ? ' · 잠정 ' + 잠정합.toLocaleString() + '원' : '') + (전체 > 인정 + 잠정합 ? ' · 과세 ' + (전체 - 인정 - 잠정합).toLocaleString() + '원' : '') + ' (' + 줄.join(' · ') + ')';
  return w;
}

// [2026.11.04 복잡사건 127 「남씨 추징 4억 낼 돈 없음」] 납부기한등 연장·납부고지 유예 — 사유(국세징수법 §13①·시행령 §11)·신청 기한(시행령 §14)·간주 승인(§13⑤·§14⑤)·기간·분납(시행령 §12)·담보(§15·§18②·시행령 §16)·가산세 미부과(시행령 §13)·취소와 다시 연장 금지(§16)·송달 지연 기한(§17)
//  판정 묶음·엔진에 이 갈래가 없어(0건) 넥스가 「낼 돈 없음」에 연장·유예 길을 못 보여 주던 것.
//  p: { 종류(연장|유예), 세목, 세액, 기한(납부기한등 또는 고지 예정 국세 납부기한), 사유(재난|사업손실|질병상중|압수|전산장애|금융휴무|세무대리인재해|준하는사유), 신청일, 통지일, 통지결과(승인|기각), 연장월수, 특별재난지역등(예), 담보종류(금전|납세보증보험|은행보증|유가증권|토지|건물 등), 담보가액, 담보예외(예 — 시행령 §16 사유를 세무서장이 인정), 분납계획(예), 취소사유(분납미납|담보불응|재산변동|납기전징수사유), 고지서발송일, 고지서도달일 }
function judgePayDeadlineExtension_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 서류 = [];
  const 날더하기 = function (x, d) { const t = new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10) + d)); return t.toISOString().slice(0, 10); };
  const 달더하기 = function (x, m) { const t = new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1 + m, +x.slice(8, 10))); return t.toISOString().slice(0, 10); };
  const 유예 = /유예|고지/.test(String(p.종류 || ''));
  const 조 = 유예 ? '국세징수법 §14' : '국세징수법 §13';
  const 세액 = famNum_(p.세액) > 0 ? famNum_(p.세액) : 0;
  const 기한 = jmYmd_(p.기한) || '';
  // 1) 사유
  const 사 = String(p.사유 || '');
  let 사유호 = '', 사유결과 = null;
  if (/재난|도난|화재/.test(사) && !/세무대리|세무사/.test(사)) { 사유호 = '§13①1호(재난·도난으로 재산에 심한 손실)'; 사유결과 = true; }
  else if (/사업|부도|도산|손실/.test(사)) { 사유호 = '§13①2호(사업에 현저한 손실·부도 도산 우려)'; 사유결과 = true; }
  else if (/질병|중상해|상중|사망|치료/.test(사)) { 사유호 = '§13①3호(본인·동거가족 6개월 이상 치료가 필요한 질병·중상해, 상중)'; 사유결과 = true; }
  else if (/압수|영치/.test(사)) { 사유호 = '시행령 §11 1호(장부·서류 압수·영치)'; 사유결과 = true; }
  else if (/전산|정전|프로그램|시스템/.test(사)) { 사유호 = '시행령 §11 2호(한국은행·체신관서 시스템 장애)'; 사유결과 = true; }
  else if (/휴무|금융/.test(사)) { 사유호 = '시행령 §11 3호(금융회사·체신관서 휴무 등, 국세청장 인정)'; 사유결과 = true; }
  else if (/세무대리|세무사|회계사/.test(사)) { 사유호 = '시행령 §11 4호(장부 대행 세무사·회계사의 재해·장부 도난)'; 사유결과 = true; }
  else if (/준하/.test(사)) { 사유호 = '시행령 §11 5호(1~3호에 준하는 사유 — 세무서장 판단)'; 사유결과 = null; }
  else if (사) { 사유호 = '법 §13①·시행령 §11 사유에 안 맞음 — ' + 사; 사유결과 = false; }
  reqs.push(jmReq_('연장·유예 사유', 사 ? 사유결과 : null, 사 ? 사유호 : '사유 모름 — 「돈이 없다」만으로는 사유가 아님. 사업 손실·질병·재난 중 무엇인지 확인', '국세징수법 §13①·시행령 §11'));
  if (/돈이 없|자금|여유/.test(사) && 사유결과 === false) notes.push('단순히 낼 돈이 없는 것은 사유로 적혀 있지 않음 — 사업 손실(2호)·재산 손실(1호)·질병(3호)에 해당하는 사실이 있는지 먼저 확인하세요');
  // 2) 신청 기한·간주 승인
  const 신청 = jmYmd_(p.신청일) || '';
  let 신청기한 = 기한 ? 날더하기(기한, -3) : '';
  let 간주일 = '';
  if (기한 && 신청) {
    if (신청 > 기한) reqs.push(jmReq_('신청 기한', false, '신청일 ' + 신청 + '이 기한 ' + 기한 + '을 넘김 — 기한이 지난 국세는 연장 신청 대상이 아님(분할납부·체납 단계 다른 길을 보세요)', '시행령 §14'));
    else if (신청 > 신청기한) reqs.push(jmReq_('신청 기한', null, '만료일 3일 전(' + 신청기한 + ')을 넘겨 ' + 신청 + ' 신청 — 세무서장이 3일 전까지 신청서를 낼 수 없다고 인정하면 만료일까지 낼 수 있음(시행령 §14 단서)', '시행령 §14'));
    else reqs.push(jmReq_('신청 기한', true, '만료일 3일 전(' + 신청기한 + ')까지 신청 ' + 신청, '시행령 §14'));
    const 십일전 = 날더하기(기한, -10);
    if (신청 <= 십일전) {
      간주일 = 날더하기(신청, 10);
      notes.push('만료일 10일 전(' + 십일전 + ')까지 신청했으므로, 신청일부터 10일 안에 승인 여부 통지가 없으면 그 10일이 되는 날(' + 간주일 + ') 신청대로 승인한 것으로 봄(' + (유예 ? '§14⑤' : '§13⑤') + ')');
    } else notes.push('만료일 10일 전(' + 십일전 + ') 뒤에 신청 — 통지가 없어도 간주 승인이 없음. 만료일까지 승인 통지를 확인해야 함(' + (유예 ? '§14④' : '§13④') + ')');
  } else if (기한 && !신청) { reqs.push(jmReq_('신청 기한', null, '아직 신청 안 함 — 만료일 3일 전(' + 신청기한 + ')까지', '시행령 §14')); 할일.push({ 무엇: (유예 ? '납부고지 유예' : '납부기한등 연장') + ' 신청서 제출(국세정보통신망 가능) — 10일 전까지 내면 통지 없을 때 간주 승인', 때: 날더하기(기한, -10) + '까지(늦어도 ' + 신청기한 + ')', 근거: '시행령 §14·' + (유예 ? '§14⑤' : '§13⑤') }); }
  else reqs.push(jmReq_('신청 기한', null, '원래 납부기한(또는 고지 예정 기한)을 모름', '시행령 §14'));
  const 통지 = String(p.통지결과 || '');
  if (/기각/.test(통지)) reqs.push(jmReq_('승인', false, '기각 통지' + (p.통지일 ? '(' + p.통지일 + ')' : '') + ' — 원래 기한까지 내야 함. 불복은 「불복기한」 판정으로', 조 + '④'));
  else if (/승인/.test(통지)) reqs.push(jmReq_('승인', true, '승인 통지' + (p.통지일 ? '(' + p.통지일 + ')' : ''), 조 + '④'));
  // 3) 기간·분납
  const 월 = famNum_(p.연장월수) > 0 ? famNum_(p.연장월수) : 0;
  const 특별 = jmYn_(p.특별재난지역등) === true;
  const 세목 = String(p.세목 || '');
  // [2026.11.04 판정 정리] 시행령 §12②의 「소득세」는 양도소득세를 가르지 않음(원문 확인) — 양도소득세도 특례 세목
  const 특례세목 = /소득세|법인세|부가가치세|양도/.test(세목);
  let 최대 = 9;
  if (특별 && 사유결과 !== false && /§13①[123]|§11 5호/.test(사유호)) {
    if (특례세목) 최대 = 24;
  }
  if (월) reqs.push(jmReq_('연장·유예 기간', 월 <= 최대, '바라는 기간 ' + 월 + '개월 · 최대 ' + 최대 + '개월(연장·유예한 날 다음 날부터, 시행령 §12' + (최대 > 9 ? '② 고용재난·산업위기·특별재난지역 등' : '①') + ')', '시행령 §12'));
  if ((월 || 최대) > 6) notes.push('기간이 6개월을 넘으면 가능한 한 시작 뒤 6개월이 지난 날부터 3개월 안에 고르게 나눠 내도록 정함(시행령 §12① 후단) — 분납 계획을 함께 내세요');
  // 4) 담보
  const 담종 = String(p.담보종류 || '');
  const 비율 = /금전|현금|보증보험|은행|보증서/.test(담종) ? 1.1 : 1.2;
  const 필요 = 세액 ? Math.ceil(세액 * 비율) : 0;
  const 담가 = famNum_(p.담보가액) > 0 ? famNum_(p.담보가액) : 0;
  const 예외 = jmYn_(p.담보예외);
  const 자동예외 = /§13①1호|§11 2호|§11 3호/.test(사유호);
  if (자동예외) reqs.push(jmReq_('납세담보', true, '재난·도난(§13①1호)·시스템 장애·금융 휴무(시행령 §11 2·3호) 사유는 담보 요구 예외(시행령 §16 2호)', '국세징수법 §15 단서·시행령 §16'));
  else if (예외 === true) reqs.push(jmReq_('납세담보', true, '사업 심각한 손해·중대한 위기로 기간 안에 낼 수 있다고 세무서장이 인정 — 담보 예외(시행령 §16 1호)', '국세징수법 §15 단서·시행령 §16'));
  else if (담가 && 필요) reqs.push(jmReq_('납세담보', 담가 >= 필요, '요구될 수 있는 담보 ' + 필요.toLocaleString() + '원(국세의 ' + (비율 === 1.1 ? '110% — 금전·보증보험·은행 보증서' : '120% — 그 밖 담보') + ', §18②) · 내놓을 담보 ' + 담가.toLocaleString() + '원', '국세징수법 §15·§18②'));
  else reqs.push(jmReq_('납세담보', null, '세무서장이 담보를 요구할 수 있음(§15)' + (필요 ? ' — 요구되면 ' + 필요.toLocaleString() + '원 이상(' + (비율 === 1.1 ? '110%' : '120%') + ', §18②)' : '') + ' · 담보 예외(시행령 §16 1호) 인정 여부 모름', '국세징수법 §15·§18②·시행령 §16'));
  // 5) 가산세
  notes.push('연장·유예 기간 동안 납부지연가산세(국세기본법 §47의4)·원천징수 등 납부지연가산세(§47의5)를 매기지 않음(시행령 §13) — 기간이 끝난 뒤 못 내면 그날부터 다시 붙음');
  // 6) 취소·다시 연장
  const 취 = String(p.취소사유 || '');
  if (취) {
    const 다시못함 = /분납|미납|담보|납기전|§9/.test(취);
    reqs.push(jmReq_('취소 뒤 다시 연장', 다시못함 ? false : null, '취소 사유: ' + 취 + (다시못함 ? ' — 분납 미납·담보 불응·납기 전 징수 사유(§16①1·2·4호)로 취소되면 같은 국세는 다시 연장·유예 못 함(§16③)' : ' — 재산 상황 변동 등(§16①3호·시행령 §17)은 다시 신청 막히지 않음 [실사건 때 확인: 세무서장 판단]'), '국세징수법 §16①③'));
    할일.push({ 무엇: '취소 통지에 적힌 기한까지 남은 세액 한꺼번에 납부', 때: '취소 통지 받은 즉시', 근거: '국세징수법 §16②' });
  }
  // 7) 송달 지연
  const 발 = jmYmd_(p.고지서발송일) || '', 도 = jmYmd_(p.고지서도달일) || '';
  if (도 && 기한) {
    const 십사 = 날더하기(도, 14);
    if (십사 >= 기한) notes.push('고지서가 ' + 도 + '에 도달해 ' + (도 > 기한 ? '이미 기한(' + 기한 + ')이 지났음(§17①1호)' : '기한(' + 기한 + ')이 14일 안에 옴(§17①2호)') + ' — 도달한 날부터 14일이 지난 날(' + 날더하기(도, 15) + ')이 납부기한(§17) [확인 필요 — 권장: 초일 불산입이면 도달일+15일(지금 셈) 권장]');
  } else if (발 && !도) 할일.push({ 무엇: '고지서 도달일 확인(늦게 도달하면 §17로 기한이 늦춰짐)', 때: '즉시', 근거: '국세징수법 §17' });
  // 결과
  const 쓸월 = 월 ? Math.min(월, 최대) : 최대;
  const 끝 = 기한 ? 달더하기(기한, 쓸월) : '';
  if (끝) notes.push('승인되면 새 기한은 대략 ' + 끝 + '까지(' + 쓸월 + '개월 — 정확한 날은 통지서) [잠정]');
  notes.push('이 판정은 세무서장 재량을 대신하지 못함 — 사유·담보 예외는 세무서장이 인정해야 함(§13①·§15 단서)');
  서류.push('납부기한등 연장(납부고지 유예) 신청서', '사유 증빙(재해 확인서·결산서·부도 자료·진단서·사망 증명 등)', '분납 계획(분납액·횟수)', '납세담보 서류(담보 제공 시)', '고지서와 도달일 증빙');
  const w = jmWrap_(유예 ? '납부고지유예' : '납부기한연장', reqs, { 사유: 사유호 || undefined, 신청기한: 신청기한 || undefined, 간주승인일: 간주일 || undefined, 최대개월: 최대, 담보필요액: 필요 || undefined, 새기한잠정: 끝 || undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  const 막힘 = reqs.filter(function (r) { return r.결과 === '✘'; }).map(function (r) { return r.이름; });
  // [2026.11.04] 연장이 안 되거나 잠정이면 다른 길(분할납부·연부연납·물납)을 같은 결과에 후보로 — 세목별, 계산은 각 도구로
  if (막힘.length || reqs.some(function (r) { return r.결과 !== '✔'; })) {
    const 후보 = [];
    if (/상속|증여/.test(세목) || !세목) {
      후보.push({ 길: '연부연납(상증법 §71)', 맞는때: '상속세·증여세 납부세액 2천만원 초과 · 담보 제공 · 신고기한(고지 기한)까지 신청', 도구: 'calculate_installment_payment_schedule' });
      if (/상속/.test(세목) || !세목) 후보.push({ 길: '물납(상증법 §73)', 맞는때: '상속세만 · 부동산·유가증권이 상속재산의 절반 초과 · 납부세액 2천만원 초과 · 금융재산으로 못 내는 몫', 도구: 'calculate_property_in_kind_payment_eligibility' });
    }
    if (/양도|소득|증여|상속/.test(세목) || !세목) 후보.push({ 길: '분할납부(1천만원 초과 몫 2개월 안)', 맞는때: '양도소득세 소득세법 §112 · 상속·증여세 상증법 §70② — 신고기한까지 신청', 도구: 'calculate_installment_split_payment_limit' });
    if (후보.length) { w.다른길 = 후보; notes.push('연장이 ' + (막힘.length ? '안 되면' : '확정되지 않았으면') + ' 같은 세금을 나눠 내는 다른 길 후보: ' + 후보.map(function (h) { return h.길; }).join(' · ') + ' — 요건은 각 도구로 따로 판정 [잠정]'); }
  }
  w.결론 = (막힘.length ? '안 됨(' + 막힘.join('·') + ')' : reqs.some(function (r) { return r.결과 !== '✔'; }) ? '잠정 — 확인할 것 남음' : '받을 수 있음') + (세액 ? ' · 세액 ' + 세액.toLocaleString() + '원' : '') + ' · 최대 ' + 최대 + '개월' + (필요 && !자동예외 && 예외 !== true ? ' · 담보 요구되면 ' + 필요.toLocaleString() + '원' : '');
  return w;
}

// [2026.11.04 복잡사건 128 「곽씨 상속재산 소송」] 후발적 경정청구 사유·기한(국세기본법 §45의2②③, 시행령 §25의2·§25의3) — 사유마다 각 호 해당·안 날부터 3개월·5년 일반 경정청구와 견주기
//  불복기한 판정은 「후발적 사유가 생기면 따로」라는 알림만 냈고, 계약해제 판정은 해제 한 가지만 봐 판결·소득 귀속·상호합의·연동 세목·허가 취소·장부 압수를 가를 곳이 없었다.
//  p: { 기준일, 공휴일, 세목, 법정신고기한, 신고(기한안|기한후|안함), 결정받음(예), 엔진(calculate_…), 당초엔진칸, 반영엔진칸,
//       사유: [{ 이름, 종류(판결|소득귀속|상호합의|연동|허가취소|계약해제|장부압수|유사|판례변경|착오·누락), 발생일, 안날, 청구일, 해제종류(해제권|부득이), 내용 }] }
function judgeLateCorrectionClaim_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10), hol = p.공휴일 || [];
  const reqs = [], notes = [], 할일 = [], 경우 = [], 기한 = [], 서류 = [];
  const 신고기한 = jmYmd_(p.법정신고기한) || '', 신고 = String(p.신고 || ''), 결정 = jmYn_(p.결정받음) === true;
  const 기한안 = /기한\s*안|기한내|정기/.test(신고), 기한후 = /기한\s*후/.test(신고), 안함 = /안\s*함|무신고/.test(신고);
  // 자격 — ② 「법정신고기한까지 신고한 자 또는 결정을 받은 자」
  let 자격 = null, 자격왜 = '';
  if (기한안 || 결정) { 자격 = true; 자격왜 = 기한안 ? '법정신고기한까지 신고함' : '과세표준·세액 결정을 받음'; }
  else if (기한후) { 자격 = null; 자격왜 = '기한후신고만 함 — 기한후신고에 대한 결정(§45의3③)을 「결정을 받은 자」로 보는지 [확인 필요 — 권장: 기한후신고 뒤 §45의3③ 결정 통지를 받았으면 「결정을 받은 자」로 자격 있음(권장), 결정 전이면 불가]'; }
  else if (안함) { 자격 = false; 자격왜 = '신고도 결정도 없음 — 후발적 경정청구를 할 사람이 아님(§45의2②)'; }
  else 자격왜 = '법정신고기한까지 신고했는지·결정을 받았는지 모름';
  reqs.push(jmReq_('후발적 경정청구를 할 수 있는 사람', 자격, 자격왜, '국세기본법 §45의2②'));
  // 일반 경정청구(①) 5년 — 그 안이면 이 길이 더 넓음
  let 오년 = '';
  if (신고기한 && (기한안 || 기한후)) {
    오년 = apShift_(famAddY_(신고기한, 5), hol, []);
    기한.push({ 무엇: '일반 경정청구(당초 신고분)', 마감: 오년, 근거: '국세기본법 §45의2①(법정신고기한이 지난 후 5년)', 상태: today <= 오년 ? '남음' : '지남' });
  }
  const 종류표 = [
    [/판결|화해|조정|심판|심사|감사원/, '1호', '계산 근거가 된 거래·행위가 그에 관한 소송 판결(화해 등 같은 효력 포함)·심사·심판 결정으로 다른 것으로 확정'],
    [/소득귀속|귀속|제3자/, '2호', '소득·과세물건의 귀속을 제3자에게로 변경시키는 결정·경정'],
    [/상호합의/, '3호', '조세조약 상호합의가 최초 신고·결정과 다르게 이루어짐'],
    [/연동|다른\s*세목|다른\s*과세기간/, '4호', '결정·경정으로 그 이외 과세기간(같은 세목) 또는 다른 세목(같은 과세기간)의 과세표준·세액이 세법상 금액을 넘음'],
    [/허가|취소.*처분|처분.*취소/, '5호·시행령 §25의2 1호', '계산 근거가 된 거래·행위의 효력과 관계되는 관청 허가나 그 밖 처분이 취소됨'],
    [/계약해제|해제|해지|취소/, '5호·시행령 §25의2 2호', '계약이 해제권 행사로 해제되거나 성립 뒤 부득이한 사유로 해제·취소됨'],
    [/장부|압수|영치/, '5호·시행령 §25의2 3호', '장부·증빙이 압수 등 부득이한 사유로 계산할 수 없었는데 그 사유가 없어짐'],
    [/유사/, '5호·시행령 §25의2 4호', '시행령 1~3호와 유사한 사유']
  ];
  const 목록 = Array.isArray(p.사유) ? p.사유 : [];
  let 열린 = 0, 지난 = 0, 아님 = 0;
  목록.forEach(function (c, i) {
    c = c || {};
    const 이름 = c.이름 || ('사유 ' + (i + 1)), 종류 = String(c.종류 || ''), 발생 = jmYmd_(c.발생일) || '', 안날 = jmYmd_(c.안날) || 발생, 청구 = jmYmd_(c.청구일) || '';
    if (/판례\s*변경|해석\s*변경|예규/.test(종류)) {
      아님++; reqs.push(jmReq_(이름 + ' — 후발적 사유', false, '다른 사건의 판례·해석이 바뀐 것은 이 사건 거래·행위가 판결로 달리 확정된 것이 아님 — 후발적 사유 아님 [확인 필요 — 권장: 1호는 「그 거래·행위」에 관한 판결 — 다른 사건 판례 변경은 아님(권장) — 판례 확인] · 5년 안이면 일반 경정청구로', '국세기본법 §45의2②1호'));
      return;
    }
    if (/착오|누락|계산\s*잘못|공제\s*빠/.test(종류)) {
      아님++; reqs.push(jmReq_(이름 + ' — 후발적 사유', false, '신고 때 이미 있던 사실의 착오·누락은 후발적 사유가 아님 — 일반 경정청구(5년' + (오년 ? ', ' + 오년 + '까지' : '') + ')로', '국세기본법 §45의2①·②'));
      return;
    }
    let 호 = null;
    for (let k = 0; k < 종류표.length; k++) if (종류표[k][0].test(종류)) { 호 = 종류표[k]; break; }
    if (!호) { reqs.push(jmReq_(이름 + ' — 후발적 사유', null, '종류를 가를 수 없음(' + (종류 || '빈칸') + ') — 판결·소득귀속·상호합의·연동·허가취소·계약해제·장부압수 중 무엇인지', '국세기본법 §45의2②1~5호')); return; }
    const 왜 = [호[2]];
    let 판정 = true;
    if (/^5호/.test(호[1])) {
      if (!발생) { 판정 = null; 왜.push('사유가 생긴 날을 모름 — 5호는 법정신고기한이 지난 뒤 생긴 사유만'); }
      else if (신고기한 && 발생 <= 신고기한) { 판정 = false; 왜.push('사유가 ' + 발생 + '에 생겨 법정신고기한(' + 신고기한 + ') 전 — 5호 아님(신고에 반영했어야 함) · 일반 경정청구로'); }
    }
    if (/2호/.test(호[1]) && /해제/.test(종류)) {
      const h = String(c.해제종류 || '');
      if (/합의/.test(h)) { 판정 = 판정 === false ? false : null; 왜.push('합의해제는 「부득이한 사유」가 있어야 함 — 사정을 봐야 함 (원문 확인 2026-11-04: 국세기본법시행령 §25의2 2호)'); }
      else if (!h) { 판정 = 판정 === false ? false : null; 왜.push('해제권 행사인지·부득이한 사유인지 모름'); }
    }
    if (/1호/.test(호[1]) && /형사|무죄/.test(종류 + String(c.내용 || ''))) { 판정 = 판정 === false ? false : null; 왜.push('형사 판결은 거래 자체를 확정하는 판결인지 따로 봐야 함 [확인 필요 — 권장: 거래·행위를 확정하는 판결인지 따라 갈림 — 판례 확인]'); }
    if (/1호/.test(호[1]) && /담합|통정|형식|의제자백/.test(String(c.내용 || ''))) { 판정 = 판정 === false ? false : null; 왜.push('조세 회피 목적의 담합·형식 판결이면 사유로 인정 안 될 수 있음 [확인 필요 — 권장: 판례 — 그대로 둠]'); }
    let 마감 = '';
    if (안날) {
      const mv = [];
      마감 = apShift_(apAddM_(안날, 3), hol, mv);
      왜.push('안 날 ' + 안날 + ' → 마감 ' + 마감 + (mv.length ? '(' + mv.join(' ') + ')' : ''));
    } else { 판정 = 판정 === false ? false : null; 왜.push('사유가 생긴 것을 안 날을 모름 — 판결은 확정을 안 날(송달·확정 증명)'); }
    if (판정 !== false && 마감) {
      const 상태 = 청구 ? (청구 <= 마감 ? '냄 ' + 청구 + ' — 기한 안' : '냄 ' + 청구 + ' — 기한 넘김') : (today <= 마감 ? '남음 ' + Math.round(jmDays_(today, 마감)) + '일' : '지남');
      기한.push({ 무엇: 이름 + ' 후발적 경정청구', 마감: 마감, 근거: '국세기본법 §45의2②' + 호[1].replace(/^5호·/, '5호, ') + '(안 날부터 3개월)', 상태: 상태 });
      if (청구 && 청구 > 마감) { 판정 = false; 왜.push('청구가 기한을 넘김'); }
      if (!청구 && today > 마감) { 지난++; 왜.push('기한 지남' + (오년 && today <= 오년 ? ' — 그래도 일반 경정청구 5년(' + 오년 + ') 안이라 그 길로' : '')); }
      if (!청구 && today <= 마감) { 열린++; 할일.push({ 무엇: 이름 + ': 후발적 경정청구(경정청구서 + 사유 증명 서류)', 때: 마감 + '까지', 근거: '국세기본법 §45의2②·시행령 §25의3' }); }
      if (오년 && 마감 <= 오년) 왜.push('5년 일반 경정청구 기간(' + 오년 + ') 안이기도 함 — 둘 중 어느 길로도 됨');
    }
    if (판정 === false) 아님++;
    reqs.push(jmReq_(이름 + ' — 후발적 사유(' + 호[1] + ')', 판정, 왜.join(' · '), '국세기본법 §45의2②' + (/시행령/.test(호[1]) ? ', 시행령 §25의2' : '')));
    if (청구) {
      const 결정끝 = apShift_(apAddM_(청구, 2), hol, []);
      기한.push({ 무엇: 이름 + ' 결정·통지(세무서가 할 기한)', 마감: 결정끝, 근거: '국세기본법 §45의2③(청구 받은 날부터 2개월)', 상태: '기다림' });
      notes.push(이름 + ': 2개월(' + 결정끝 + ')까지 통지가 없으면 그 다음 날(' + famAddD_(결정끝, 1) + ')부터 이의신청·심사·심판·감사원 심사청구를 할 수 있음(§45의2③ 단서) · 보정 요구 기간(시행령 §25의3)은 2개월에 넣지 않음 [확인 필요 — 권장: 보정 기간 제외 규정 없음 — 2개월 그대로 세는 지금 방식 권장]');
    }
  });
  if (!목록.length) reqs.push(jmReq_('후발적 사유', null, '사유 목록이 없음', '국세기본법 §45의2②'));
  // 세액 견주기 — 당초 칸과 사유를 반영한 칸
  if (p.엔진 && p.당초엔진칸 && p.반영엔진칸) {
    경우.push({ 이름: '① 당초 신고·결정 그대로', 엔진: p.엔진, 엔진칸: p.당초엔진칸 });
    경우.push({ 이름: '② 후발적 사유 반영(경정청구할 세액)', 엔진: p.엔진, 엔진칸: p.반영엔진칸 });
    notes.push('돌려받을 세액 = ①납부세액 − ②납부세액 — 환급가산금은 「환급가산금」 판정으로(§52)');
  }
  notes.push('후발적 경정청구는 「안 날부터 3개월」 — 법정신고기한 5년이 지났어도 됨(§45의2② 「제1항에서 규정하는 기간에도 불구하고」)');
  notes.push('원천징수 대상자·원천징수의무자도 같이 청구할 수 있음(§45의2⑤) — 연말정산·원천징수분이면 따로 확인');
  if (!hol.length) notes.push('설·추석·대체공휴일은 공휴일 목록·공휴일 표로 미룸 — 마감 무렵이면 달력 확인');
  서류.push('경정청구서(청구인·결정 또는 신고 내용·경정 이유·바뀐 과세표준과 세액, 시행령 §25의3)', '사유 증명: 판결문·확정증명원 / 상호합의 결과 / 허가 취소 처분서 / 해제 통지·해제 사유 증빙 / 압수 해제 증빙', '당초 신고서·결정 통지서', '사유를 안 날 증빙(송달증명·통지서 받은 날)');
  const w = jmWrap_('후발적경정청구', reqs, { 기한: 기한.sort(function (a, b) { return a.마감 < b.마감 ? -1 : 1; }), 일반경정청구마감: 오년 || undefined, 경우: 경우, 엔진칸: 경우.length ? 경우[1].엔진칸 : undefined, 알림: notes, 할일: 할일, 받을서류: 서류, 기준일: today });
  w.결론 = !목록.length ? '사유 목록을 봐야 함' : '사유 ' + 목록.length + '개 — 낼 수 있음 ' + 열린 + ' · 기한 지남 ' + 지난 + ' · 후발적 사유 아님 ' + 아님;
  if (!경우.length) { w.엔진칸 = {}; w.엔진칸뜻 = '엔진칸 없음 — 당초·반영 칸을 주면 세액을 견줌'; }
  return w;
}

// [2026.11.04 복잡사건 129 「홍씨 옛 땅 계약서 없음」] 추계 결정 — 실지거래가액을 확인할 수 없을 때 매매사례가액·감정가액·환산취득가액·기준시가를 어떤 순서·요건으로 쓰는지(소득세법 §97①1호나목·§114⑤⑦, 시행령 §176의2①~③·⑤, §97⑦)
//  엔진은 실가가 비면 매매사례 → 감정 → 환산 순으로 넣은 값을 그대로 썼다 — 전후 3개월·감정기관 수·특수관계 부당 가격·상장주식 매매사례 제외·신주인수권 환산 제외·
//  기준시가는 과세관청만·전 소유자 확인 실가(§97⑦)·등기부 기재가액 추정(§114⑤)을 보는 곳이 없었다.
//  p: { 거래(취득|양도), 자산(토지|건물|부동산권리|주식|상장주식|신주인수권), 취득일, 양도일, 결정주체(납세자|과세관청), 장부(있음|없음|일부없음|거짓),
//       양도가액, 기준시가취득, 기준시가양도, 전소유자확인(예), 전소유자가액, 전소유자경정(예), 전소유자비과세고가(예), 신고(함|안함), 등기부기재가액,
//       후보: [{ 이름, 종류(매매사례|감정), 가액, 날짜(매매 계약일·감정가액기준일), 감정기관수, 특수관계(예), 부당(예) }], 엔진칸 }
function judgeEstimatedPrice_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const won = function (v) { return Math.round(v).toLocaleString() + '원'; };
  const 달더하기 = function (d, m) { const y = +d.slice(0, 4), mo = +d.slice(5, 7) - 1 + m, dd = +d.slice(8, 10); const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(); return new Date(Date.UTC(y, mo, Math.min(dd, last))).toISOString().slice(0, 10); };
  const 양도쪽 = /양도/.test(String(p.거래 || ''));
  const 기준일 = 양도쪽 ? (jmYmd_(p.양도일) || '') : (jmYmd_(p.취득일) || '');
  const 자산 = String(p.자산 || '');
  const 상장 = /상장/.test(자산), 신주 = /신주인수권/.test(자산), 주식 = /주식|출자|신주/.test(자산);
  const 관청 = /관청|세무서|과세/.test(String(p.결정주체 || ''));
  const 기준시가 = 양도쪽 ? num(p.기준시가양도) : num(p.기준시가취득);
  const 양도가액 = num(p.양도가액);
  const 기본 = (p.엔진칸 && typeof p.엔진칸 === 'object') ? p.엔진칸 : {};
  const 조 = '소득세법 §97①1호나목·§114⑦, 시행령 §176의2';

  // 1. 전 소유자가 확인한 실지거래가액(§97⑦) — 취득가액만
  let 전소유자실가 = 0;
  if (!양도쪽 && jmYn_(p.전소유자확인) === true) {
    const 가 = num(p.전소유자가액), 경정 = jmYn_(p.전소유자경정), 고가 = jmYn_(p.전소유자비과세고가);
    let 판 = null, 왜 = '';
    if (경정 === true) { 판 = false; 왜 = '전 소유자의 양도가액이 §114에 따라 경정됨(§97⑦1호) — 확인 가액을 쓸 수 없음'; }
    else if (고가 === true) { 판 = false; 왜 = '전 소유자 양도가 비과세이고 실지거래가액보다 높게 거래한 것으로 확인됨(§97⑦2호)'; }
    else if (!(가 > 0)) { 왜 = '전 소유자가 신고·확인한 가액을 모름'; }
    else if (경정 == null || 고가 == null) { 왜 = won(가) + ' — 다만 전 소유자 경정(1호)·비과세 고가(2호) 여부를 모름(잠정)'; 전소유자실가 = 가; }
    else { 판 = true; 왜 = won(가) + '을 취득 당시 실지거래가액으로 봄(§97⑦ 본문, 확인 방법은 시행령 §163⑪)'; 전소유자실가 = 가; }
    reqs.push(jmReq_('전 소유자 확인 실지거래가액(§97⑦)', 판, 왜, '소득세법 §97⑦, 시행령 §163⑪'));
    if (판 === false) 전소유자실가 = 0;
    서류.push('전 소유자의 양도소득세 신고서·결정 내용(실지거래가액 확인 자료)');
  }

  // 2. 추계할 수 있는가
  const 장부 = String(p.장부 || '');
  let 사유 = null, 사유왜 = '';
  if (전소유자실가) { 사유 = false; 사유왜 = '전 소유자 확인 가액이 실지거래가액으로 보아짐 — 추계하지 않음'; }
  else if (/거짓|허위/.test(장부)) { 사유 = true; 사유왜 = '장부·매매계약서·영수증 내용이 매매사례가액·감정가액 등에 비추어 거짓임이 명백함(시행령 §176의2①2호)'; }
  else if (/없|분실|일부|누락/.test(장부)) { 사유 = true; 사유왜 = '장부·매매계약서·영수증 등 증빙서류가 없거나 중요한 부분이 미비(시행령 §176의2①1호)'; }
  else if (/있/.test(장부)) { 사유 = false; 사유왜 = '실지거래가액 증빙이 있음 — 실지거래가액으로(§96·§97①1호가목), 추계 안 됨'; }
  else 사유왜 = '실지거래가액 증빙(계약서·영수증·통장)이 있는지 모름';
  reqs.push(jmReq_('실지거래가액을 확인할 수 없음(추계 사유)', 사유, 사유왜, (관청 ? '소득세법 §114⑦, 시행령 §176의2①' : '소득세법 §97①1호나목')));
  if (사유 === null) 할일.push({ 무엇: '취득(양도) 계약서·영수증·대금 통장 찾기 — 있으면 실지거래가액으로', 때: '신고 전', 근거: '소득세법 §97①1호가목' });

  // 3. 후보 거르기
  const lo = 기준일 ? 달더하기(기준일, -3) : '', hi = 기준일 ? 달더하기(기준일, 3) : '';
  const 후보 = Array.isArray(p.후보) ? p.후보 : [];
  const 통과 = [], 탈락 = [];
  let 잠정 = false;
  후보.forEach(function (c, i) {
    c = c || {};
    const 이름 = c.이름 || ('후보 ' + (i + 1)), 종류 = /감정/.test(String(c.종류 || '')) ? '감정' : '매매사례', 가 = num(c.가액), d = jmYmd_(c.날짜) || '';
    const 빠짐 = [], 모름 = [];
    if (!(가 > 0)) 모름.push('가액');
    if (종류 === '매매사례' && 상장) 빠짐.push('주권상장법인 주식은 매매사례가액을 쓰지 않음(시행령 §176의2③1호 괄호)');
    if (!d) 모름.push(종류 === '감정' ? '감정가액기준일' : '매매 계약일');
    else if (lo && (d < lo || d > hi)) 빠짐.push((종류 === '감정' ? '감정가액기준일 ' : '매매사례 ') + d + '이 ' + (양도쪽 ? '양도일' : '취득일') + ' 전후 3개월(' + lo + '~' + hi + ') 밖(시행령 §176의2③' + (종류 === '감정' ? '2호' : '1호') + ')');
    if (종류 === '감정' && 주식) 빠짐.push('주식등은 감정가액을 쓰지 않음(시행령 §176의2③2호 괄호)');
    if (종류 === '감정' && !주식) {
      const n = num(c.감정기관수);
      if (!n) 모름.push('감정한 감정평가업자 수');
      else if (n < 2) {
        if (기준시가 && 기준시가 <= 1000000000) { /* 10억 이하 하나로 됨 */ }
        else if (기준시가) 빠짐.push('기준시가 ' + won(기준시가) + '(10억 초과)인데 감정평가업자 1곳뿐 — 둘 이상의 평균이어야 함(시행령 §176의2③2호)');
        else 모름.push('기준시가(10억 이하면 감정 1곳으로 됨)');
      }
    }
    const 특 = jmYn_(c.특수관계), 부 = jmYn_(c.부당);
    if (특 === true && 부 === true) 빠짐.push('특수관계인과의 거래로 객관적으로 부당한 가액(시행령 §176의2③ 단서)');
    else if (특 === true && 부 == null) 모름.push('특수관계인 거래인데 객관적으로 부당한 가액인지(시행령 §176의2③ 단서)');
    const r = { 이름: 이름, 종류: 종류, 가액: 가, 날짜: d, 빠짐: 빠짐, 모름: 모름 };
    if (빠짐.length) 탈락.push(r); else { 통과.push(r); if (모름.length) 잠정 = true; }
    reqs.push(jmReq_(이름 + '(' + 종류 + ')', 빠짐.length ? false : 모름.length ? null : true, (가 ? won(가) + ' · ' : '') + (빠짐.length ? '못 씀: ' + 빠짐.join(' / ') : 모름.length ? '모름: ' + 모름.join(' / ') : '쓸 수 있음'), '시행령 §176의2③' + (종류 === '감정' ? '2호' : '1호')));
  });

  // 4. 순서대로 고르기
  const 가까운 = function (arr) { return arr.slice().sort(function (a, b) { return Math.abs(new Date(a.날짜) - new Date(기준일)) - Math.abs(new Date(b.날짜) - new Date(기준일)); })[0]; };
  const 사례 = 통과.filter(function (x) { return x.종류 === '매매사례' && x.가액 > 0; });
  const 감정 = 통과.filter(function (x) { return x.종류 === '감정' && x.가액 > 0; });
  let 고른 = null;
  if (사유 !== false) {
    if (사례.length) { const s = 가까운(사례); 고른 = { 호: '1호 매매사례가액', 가액: s.가액, 출처: s.이름, 칸: 'comparableTransactionPrice' }; if (사례.length > 1) notes.push('쓸 수 있는 매매사례가 ' + 사례.length + '건 — 법령에 고르는 기준이 없어 ' + (양도쪽 ? '양도일' : '취득일') + '에 가장 가까운 것(' + s.이름 + ')을 씀 [확인 필요 — 권장: 기준 없음 — 가장 가까운 날(상증령 §49② 취지) 권장]'); }
    else if (감정.length) { const s = 가까운(감정); 고른 = { 호: '2호 감정가액(평균)', 가액: s.가액, 출처: s.이름, 칸: 'appraisalValue' }; }
    else if (!양도쪽 && !신주 && 양도가액 && num(p.기준시가취득) && num(p.기준시가양도)) {
      const v = Math.floor(양도가액 * num(p.기준시가취득) / num(p.기준시가양도) + 1e-6);
      고른 = { 호: '3호 환산취득가액', 가액: v, 출처: '양도가액 ' + won(양도가액) + ' × 취득 기준시가 ' + won(num(p.기준시가취득)) + ' ÷ 양도 기준시가 ' + won(num(p.기준시가양도)), 칸: '환산' };
      if (주식) notes.push('주식 환산취득가액은 시행령 §176의2②1호 산식 — 이 판정은 토지·건물(2호) 비율로 셈 (원문 확인 2026-11-04: 소득세법시행령 §176의2②1호·2호)');
    }
    else if (관청 && 기준시가) 고른 = { 호: '4호 기준시가', 가액: 기준시가, 출처: (양도쪽 ? '양도' : '취득') + ' 당시 기준시가', 칸: '기준시가' };
  }
  if (신주 && !사례.length && !감정.length) notes.push('신주인수권은 3호(환산취득가액)를 건너뜀(시행령 §176의2③ 괄호)');
  if (!관청 && !고른 && 사유 !== false && 기준시가) notes.push('납세자가 신고할 때는 기준시가를 취득가액으로 쓸 수 없음 — §97①1호나목은 매매사례가액·감정가액·환산취득가액만(기준시가는 과세관청 추계 §114⑦·시행령 §176의2③4호)');
  reqs.push(jmReq_('적용할 가액(시행령 §176의2③ 순서)', 사유 === false ? false : 고른 ? (잠정 ? null : true) : null, 사유 === false ? '추계하지 않음' : 고른 ? 고른.호 + ' ' + won(고른.가액) + ' — ' + 고른.출처 : '쓸 수 있는 가액이 없음(매매사례·감정을 더 찾거나 기준시가 확인)', 조));

  // 5. §114⑤ 등기부 기재가액 추정
  const 등기 = num(p.등기부기재가액);
  if (/안|무/.test(String(p.신고 || '')) && 등기 && !주식) {
    notes.push('신고하지 않으면 과세관청은 등기부 기재가액 ' + won(등기) + '을 실지거래가액으로 추정해 결정할 수 있음(§114⑤, 시행령 §176의2⑤ — 그 세액이 300만원 미만이거나, 300만원 이상이면 기한후신고 안내를 받고 30일 안 기한후신고를 안 했을 때. 실지거래가액과 다름을 확인하면 안 씀)');
    할일.push({ 무엇: '기한후신고(실지거래가액 또는 추계 가액으로) — 등기부 기재가액 추정 결정 막기', 때: '세무서 안내를 받은 날부터 30일 안', 근거: '시행령 §176의2⑤2호' });
  }

  // 6. 엔진 경우
  const 칸 = function (방법, 값) {
    const o = JSON.parse(JSON.stringify(기본));
    if (양도쪽) { o.transferPrice = 값; return o; }
    delete o.comparableTransactionPrice; delete o.appraisalValue; delete o.acquisitionStandardPriceForConversion; delete o.transferStandardPriceForConversion;
    if (방법 === 'comparableTransactionPrice' || 방법 === 'appraisalValue') { delete o.acquisitionPrice; o[방법] = 값; }
    else if (방법 === '환산') { delete o.acquisitionPrice; o.acquisitionStandardPriceForConversion = num(p.기준시가취득); o.transferStandardPriceForConversion = num(p.기준시가양도); if (양도가액 && !o.transferPrice) o.transferPrice = 양도가액; }
    else o.acquisitionPrice = 값;
    return o;
  };
  if (전소유자실가) 경우.push({ 이름: '① 전 소유자 확인 실지거래가액 ' + won(전소유자실가) + '(§97⑦)', 엔진: 'calculate_transfer_tax', 엔진칸: 칸('실가', 전소유자실가) });
  else if (고른) 경우.push({ 이름: '① 법대로 — ' + 고른.호 + ' ' + won(고른.가액) + (잠정 ? '(잠정)' : ''), 엔진: 'calculate_transfer_tax', 엔진칸: 칸(고른.칸, 고른.가액) });
  탈락.filter(function (x) { return x.가액 > 0; }).slice(0, 2).forEach(function (x) {
    경우.push({ 이름: '[견주기] 못 쓰는 ' + x.이름 + ' ' + won(x.가액) + '을 썼다면(' + x.빠짐[0].replace(/\(.*$/, '') + ')', 엔진: 'calculate_transfer_tax', 엔진칸: 칸(x.종류 === '감정' ? 'appraisalValue' : 'comparableTransactionPrice', x.가액) });
  });
  if (고른 && 고른.칸 !== '환산' && !양도쪽 && !신주 && 양도가액 && num(p.기준시가취득) && num(p.기준시가양도)) {
    경우.push({ 이름: '[견주기] 순서를 건너뛰고 환산취득가액으로 했다면(앞 순서 가액이 있으면 쓸 수 없음)', 엔진: 'calculate_transfer_tax', 엔진칸: 칸('환산', 0) });
  }
  if (!관청 && !양도쪽 && 기준시가 && 고른 && 고른.칸 !== '기준시가') 경우.push({ 이름: '[견주기] 과세관청이 기준시가 ' + won(기준시가) + '으로 추계했다면(납세자는 못 씀)', 엔진: 'calculate_transfer_tax', 엔진칸: 칸('기준시가', 기준시가) });
  if (등기 && /안|무/.test(String(p.신고 || '')) && !양도쪽) 경우.push({ 이름: '[견주기] 무신고로 등기부 기재가액 ' + won(등기) + '을 취득가액으로 추정 결정되면(§114⑤)', 엔진: 'calculate_transfer_tax', 엔진칸: 칸('실가', 등기) });

  if (!양도쪽) notes.push('취득가액을 환산취득가액(또는 감정가액)으로 하면 필요경비는 개산공제(시행령 §163⑥)와 실제 자본적지출+양도비 중 큰 쪽(§97② 2호 단서) — 엔진이 셈');
  notes.push('매매사례는 해당 자산과 동일성 또는 유사성이 있는 자산이어야 하고, 감정가액은 신빙성이 인정되어야 함(시행령 §176의2③1·2호) — 위치·면적·용도가 비슷한지 확인');
  notes.push('신축·증축 건물을 5년 안에 팔며 감정가액·환산취득가액을 쓰면 건물분 5% 가산세(§114의2) — 판정 「환산가산세」');
  notes.push('상속·증여받은 자산의 취득가액은 상속·증여 평가액(시행령 §163⑨) — 이 판정이 아니라 그 평가액을 넣으세요; 의제취득일 전 취득은 판정 「의제취득」');
  if (사유 !== false && !고른) 할일.push({ 무엇: (양도쪽 ? '양도' : '취득') + '일(' + (기준일 || '모름') + ') 전후 3개월 매매사례·감정평가(기준시가 10억 넘으면 둘 이상) 찾기', 때: '신고 전', 근거: '시행령 §176의2③' });
  서류.push('계약서·영수증·대금 통장(실지거래가액 확인 먼저)', '국토교통부 실거래가 등 매매사례 자료(같거나 비슷한 자산, 전후 3개월)', '감정평가서(감정가액기준일 전후 3개월, 기준시가 10억 넘으면 2곳)', '취득·양도 당시 기준시가 확인서', '등기부등본(등기부 기재가액)');
  const w = jmWrap_('추계', reqs, { 적용방법: 전소유자실가 ? '§97⑦ 전 소유자 확인 실가' : 고른 ? 고른.호 : undefined, 적용가액: 전소유자실가 || (고른 ? 고른.가액 : undefined), 기간: lo ? lo + '~' + hi : undefined, 잠정: 잠정 || undefined, 경우: 경우, 엔진칸: 경우.length ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = 전소유자실가 ? '전 소유자 확인 실지거래가액 ' + won(전소유자실가) + '(§97⑦)' : 사유 === false ? '추계 사유 없음 — 실지거래가액으로' : 고른 ? (양도쪽 ? '양도' : '취득') + '가액 ' + 고른.호 + ' ' + won(고른.가액) + (잠정 ? '(잠정)' : '') + (탈락.length ? ' · 못 쓰는 후보 ' + 탈락.length + '건' : '') : '쓸 수 있는 추계 가액 없음';
  return w;
}

// [2026.11.04 복잡사건 130 「모씨 예금·주식·보험 상속」] 금융재산 상속공제 — 무엇이 금융재산이고 무엇을 빼는지 가르기(상증법 §22, 시행령 §19·§10①1호, 시행규칙 §8)
//  엔진은 순금융재산(netFinancialAssets)을 넣은 대로 받아 공제만 셈 — 최대주주 주식·신고 안 한 차명 금융재산·현금·부동산 신탁·가상자산을 넣어도, 개인 빚·증빙 없는 빚을 빼도 그대로 셌다.
//  p: { 상속개시일, 거주자(예|아니오), 엔진칸(그 밖 상속세 칸), 재산: [{ 이름, 가액, 종류(예금|적금|부금|계금|출자금|금전신탁|비금전신탁|보험금|공제금|주식|채권|회사채|수익증권|출자지분|어음|현금|수표|가상자산|퇴직금|그밖), 취급(금융회사|직접|모름), 최대주주(예), 명의(본인|타인), 타인명의신고(예 — 상속세 신고기한까지 신고함) }], 채무: [{ 이름, 금액, 채권자(금융회사|국가|지자체|개인|그밖), 증빙(예|아니오) }] }
function judgeFinancialDeduction_(p) {
  p = p || {};
  const reqs = [], notes = [], 할일 = [], 경우 = [], 서류 = [];
  const num = function (x) { const v = famNum_(x); return v > 0 ? v : 0; };
  const 말일더하기 = function (x, m) { return new Date(Date.UTC(+x.slice(0, 4), +x.slice(5, 7) + m, 0)).toISOString().slice(0, 10); };
  const 개시 = jmYmd_(p.상속개시일) || '';
  const 거주 = jmYn_(p.거주자);
  // [2026.11.04 판단거리 2차 130] 기한이 쉬는 날이면 다음 일하는 날(국세기본법 §5①)
  const 기한0 = 개시 ? 말일더하기(개시, 6) : '', 기한이동 = [];
  const 신고기한 = 기한0 ? apShift_(기한0, p.공휴일 || [], 기한이동) : '';
  if (기한이동.length) notes.push('신고기한 ' + 기한0 + '이 쉬는 날이라 ' + 신고기한 + '까지(' + 기한이동.join('; ') + ')');
  const 공제액 = function (net) { net = Math.max(0, Math.floor(net)); if (net <= 20000000) return net; return Math.min(200000000, Math.max(20000000, Math.floor(net * 0.2))); };
  reqs.push(jmReq_('거주자의 사망', 거주 === false ? false : 거주 === true ? true : null, 거주 === false ? '피상속인이 비거주자 — 금융재산 상속공제 없음' : 거주 === true ? '거주자 사망' : '피상속인이 거주자인지 모름(§1①·시행령 §2)', '상증법 §22① 본문'));
  const 목록 = Array.isArray(p.재산) ? p.재산 : [], 빚 = Array.isArray(p.채무) ? p.채무 : [];
  let 넣음 = 0, 모름합 = 0, 전부 = 0; const 줄 = [];
  목록.forEach(function (a, i) {
    a = a || {};
    const 이름 = a.이름 || ('재산 ' + (i + 1)), 가액 = num(a.가액), 종 = String(a.종류 || ''), 취 = String(a.취급 || '');
    전부 += 가액;
    let 판정 = null, 왜 = '', 근거 = '시행령 §19①';
    const 주식류 = /주식|출자지분/.test(종);
    if (/현금|수표/.test(종)) { 판정 = false; 왜 = '현금은 금융회사등이 취급하는 금융재산 목록에 없음 — 금융재산 아님 (원문 확인 2026-11-04: 상증령 §19①)'; }
    else if (/비금전신탁|부동산신탁/.test(종)) { 판정 = false; 왜 = '신탁재산은 금전신탁재산만(시행령 §19① 괄호) — 부동산 등 비금전 신탁은 빠짐'; }
    else if (/가상자산|코인/.test(종)) { 판정 = false; 왜 = '가상자산은 시행령 §19①·시행규칙 §8 목록에 없음 (원문 확인 2026-11-04: 상증령 §19①·시행규칙 §8 목록)'; }
    else if (/퇴직/.test(종)) { 판정 = null; 왜 = '퇴직금·퇴직연금이 금융회사등이 취급하는 금융재산인지 따로 확인 [확인 필요 — 권장: 회사가 주는 퇴직금은 금융회사 취급 재산 아님 · DC·IRP 적립금은 금융회사 취급이라 포함 — 권장 이 구분]'; }
    else if (주식류 && jmYn_(a.최대주주) === true) { 판정 = false; 왜 = '최대주주·최대출자자(주주 1인과 특수관계인 합계가 가장 많은 경우 그 모두)가 가진 주식등은 빠짐'; 근거 = '상증법 §22②, 시행령 §19②'; }
    else if (/타인|차명/.test(String(a.명의 || '')) && jmYn_(a.타인명의신고) !== true) {
      판정 = jmYn_(a.타인명의신고) === false ? false : null;
      왜 = '타인 명의 금융재산은 상속세 신고기한' + (신고기한 ? '(' + 신고기한 + ')' : '') + '까지 신고해야 금융재산에 들어감' + (판정 === null ? ' — 신고할지 모름' : ' — 신고 안 함');
      근거 = '상증법 §22②·§67';
      if (판정 === null && 신고기한) 할일.push({ 무엇: 이름 + ': 타인 명의 금융재산을 상속세 신고에 넣을지 정하기(넣으면 공제 대상, 안 넣으면 빠지고 나중에 찾으면 상속재산 누락)', 때: 신고기한 + '까지', 근거: '상증법 §22②' });
    }
    else if (주식류 && /직접|아님/.test(취)) { 판정 = true; 왜 = '비상장 주식·출자지분으로 금융회사가 취급하지 않는 것도 금융재산'; 근거 = '시행규칙 §8 1호'; }
    else if (/회사채/.test(종) && /직접|아님/.test(취)) { 판정 = true; 왜 = '회사가 금융회사를 거치지 않고 직접 모집·매출한 회사채도 금융재산'; 근거 = '시행규칙 §8 2호'; }
    else if (/예금|적금|부금|계금|출자금|금전신탁|보험|공제금|주식|채권|회사채|수익증권|출자지분|어음/.test(종)) {
      if (/금융회사|은행|증권|보험사/.test(취)) { 판정 = true; 왜 = '금융회사등이 취급하는 ' + 종; }
      else if (/직접|아님/.test(취)) { 판정 = false; 왜 = 종 + '이지만 금융회사등이 취급하지 않음(시행규칙 §8의 비상장 주식·직접 발행 회사채 밖)'; }
      else { 판정 = null; 왜 = 종 + ' — 금융회사등(금융실명법 §2 1호, 시행령 §10②)이 취급하는지 모름'; }
      if (주식류 && a.최대주주 == null) { if (판정 === true) 판정 = null; 왜 += ' · 최대주주 묶음인지 모름(§22②)'; }
    }
    else if (종) { 판정 = false; 왜 = '금융재산(예금·보험·주식·채권 등)이 아님 — ' + 종; }
    else 왜 = '재산 종류 모름';
    if (!(가액 > 0)) { if (판정 === true) 판정 = null; 왜 += ' · 가액(상속개시일 평가액) 모름'; }
    if (판정 === true) 넣음 += 가액; if (판정 === null) 모름합 += 가액;
    reqs.push(jmReq_(이름 + ' 금융재산 여부', 판정, (가액 ? 가액.toLocaleString() + '원 · ' : '') + 왜, 근거));
    줄.push(이름 + (판정 === true ? ' 넣음' : 판정 === false ? ' 뺌' : ' 잠정'));
  });
  let 뺄빚 = 0, 모름빚 = 0, 금융빚전부 = 0;
  빚.forEach(function (d, i) {
    d = d || {};
    const 이름 = d.이름 || ('채무 ' + (i + 1)), 금액 = num(d.금액), 채 = String(d.채권자 || ''), 증 = jmYn_(d.증빙);
    let 판정, 왜;
    if (/금융회사|은행|증권|보험|카드|저축/.test(채)) {
      금융빚전부 += 금액;
      if (증 === true) { 판정 = true; 왜 = '금융회사등 채무 · 기관 확인 서류 있음 — 금융재산에서 뺌'; 뺄빚 += 금액; }
      else if (증 === false) { 판정 = false; 왜 = '금융회사등 채무지만 기관 확인 서류로 증명 안 됨 — 금융채무로 안 뺌(상속재산 채무로도 (원문 확인 2026-11-04: 상증령 §19④→§10①1호(입증 방법)·상증법 §14④))'; }
      else { 판정 = null; 왜 = '금융회사등 채무 · 증명 서류 있는지 모름 — 잠정으로 뺌(보수적)'; 모름빚 += 금액; }
    } else if (채) { 판정 = false; 왜 = 채 + ' 채무는 금융채무가 아님(시행령 §19④은 금융회사등 채무만) — 금융재산에서 안 뺌(상속재산 채무 §14로는 따로 봄)'; }
    else { 판정 = null; 왜 = '채권자 모름'; }
    reqs.push(jmReq_(이름 + ' 금융채무로 빼기', 판정, (금액 ? 금액.toLocaleString() + '원 · ' : '') + 왜, '시행령 §19④·§10①1호'));
  });
  const 비거주 = 거주 === false;
  const 순법 = 비거주 ? 0 : Math.max(0, 넣음 - 뺄빚 - 모름빚);
  const 순잠정 = 비거주 ? 0 : Math.max(0, 넣음 + 모름합 - 뺄빚);
  const 순전부 = Math.max(0, 전부 - 금융빚전부);
  const 기본 = (p.엔진칸 && typeof p.엔진칸 === 'object') ? p.엔진칸 : {};
  const 칸 = function (v) { const o = JSON.parse(JSON.stringify(기본)); o.netFinancialAssets = v; if (개시 && !o.dateOfDeath) o.dateOfDeath = 개시; if (비거주 && o.isDecedentResident == null) o.isDecedentResident = false; return o; };
  if (목록.length) {
    경우.push({ 이름: '① 법대로 — 순금융재산 ' + 순법.toLocaleString() + '원 → 공제 ' + 공제액(순법).toLocaleString() + '원', 엔진: 'calculate_inheritance_tax', 엔진칸: 칸(순법) });
    if (순잠정 !== 순법) 경우.push({ 이름: '② 모르는 것이 다 맞으면 — 순금융재산 ' + 순잠정.toLocaleString() + '원 → 공제 ' + 공제액(순잠정).toLocaleString() + '원(잠정)', 엔진: 'calculate_inheritance_tax', 엔진칸: 칸(순잠정) });
    if (순전부 > 순잠정) 경우.push({ 이름: '③ [견주기] 금융처럼 보이는 것 전부 넣었다면 — ' + 순전부.toLocaleString() + '원 → 공제 ' + 공제액(순전부).toLocaleString() + '원(과다공제 위험)', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign(칸(순전부), { isDecedentResident: 기본.isDecedentResident }) });
  } else reqs.push(jmReq_('상속재산 중 금융재산', null, '재산 목록이 없음', '상증법 §22①'));
  notes.push('공제액: 순금융재산 2천만원 이하는 전액, 넘으면 20%와 2천만원 중 큰 금액, 2억원 한도(§22① 1·2호) — 엔진 칸 netFinancialAssets에 순금융재산을 넣으면 엔진이 셈');
  notes.push('최대주주 주식은 금융재산에서만 빠지고 상속재산에는 그대로 들어가며 할증 평가(§63③) 대상인지 따로 봄');
  notes.push('타인 명의 금융재산을 신고기한까지 안 넣으면 공제에서 빠질 뿐 아니라 나중에 찾으면 상속재산 누락(과소신고 가산세·제척기간 15년 §26의2④ (원문 확인 2026-11-04: 국세기본법 §26의2④·⑤))');
  notes.push('금융재산 상속공제는 상속공제 종합한도(§24) 안에서만 받음 — 엔진이 한도를 셈');
  notes.push('금융재산상속공제신고서를 상속세 신고와 함께 내야 함(시행령 §19③) — 내지 않으면 공제가 없어지는지는 법에 따로 없음 [확인 필요 — 권장: 절차 규정 — 미제출이 공제 상실 요건이라는 조문 없음, 경정청구로 공제 가능 쪽 권장]');
  if (신고기한 && !비거주) 할일.push({ 무엇: '상속세 신고와 함께 금융재산상속공제신고서 제출', 때: 신고기한 + '까지', 근거: '시행령 §19③·상증법 §67①' });
  서류.push('금융회사별 잔액증명서(상속개시일 기준)', '금융채무 잔액·부채증명서(시행령 §10①1호)', '주주명부·특수관계인 지분표(최대주주 판정)', '보험계약·지급 내역', '비상장 주식 평가 자료', '타인 명의 계좌 자금 흐름(본인 재산인지)');
  const w = jmWrap_('금융재산공제', reqs, { 순금융재산: 순법, 공제액: 공제액(순법), 잠정순금융재산: 순잠정 !== 순법 ? 순잠정 : undefined, 신고기한: 신고기한 || undefined, 잠정: (모름합 || 모름빚) ? true : undefined, 경우: 경우, 엔진칸: 경우.length ? 경우[0].엔진칸 : undefined, 알림: notes, 할일: 할일, 받을서류: 서류 });
  w.결론 = !목록.length ? '금융재산 목록을 봐야 함' : 비거주 ? '비거주자 사망 — 공제 없음' : '순금융재산 ' + 순법.toLocaleString() + '원 → 공제 ' + 공제액(순법).toLocaleString() + '원' + (순잠정 !== 순법 ? ' · 잠정 ' + 순잠정.toLocaleString() + '원' : '') + ' (' + 줄.join(' · ') + ')';
  return w;
}

// [2026.11.04 복잡사건 131] 국세징수권 소멸시효(국세기본법 §27·§28) — 체납 국세가 언제 소멸하는지·중단·정지가 무엇을 바꾸는지
//  근거 원문(2026.11.04 업무관리자\법령 _본문 국세기본법 20261002 시행판에서 읽음): §26 3호(소멸시효 완성 → 납부의무 소멸) · §27①(5억원 이상 10년·그 밖 5년, 가산세 제외)·②(민법 준용)·③(기산일: 신고 = 법정 신고납부기한 다음 날, 결정·경정 고지 = 고지 납부기한 다음 날)·④(원천징수·납세조합·인지세 고지 = 고지 납부기한 다음 날, 신고납부기한 연장 = 연장된 기한 다음 날)
//   §28①(중단: 납부고지·독촉·교부청구·압류 — 국세징수법 §57①5호 압류금지재산·6호 제3자 재산이라 즉시 해제한 압류는 빼고)·②(새로 진행: 고지 납부기간·독촉 납부기간·교부청구 중·압류해제까지가 지난 때부터)·③(정지: 분납·납부고지 유예·기한 연장·징수유예·압류매각 유예·연부연납·사해행위 취소/채권자대위 소송 중·국외 6개월 이상 계속 체류)·④(소송 각하·기각·취하면 정지 효력 없음)
//   부칙: 법 11604호(2013.1.1.) §5 5억원 10년은 시행 뒤 신고·고지분부터 · 법 16841호(2019.12.31.) §4 「가산세 제외」는 시행 뒤 신고·고지분부터 · 국세징수법 §57①
//  p: { 기준일(오늘), 공휴일:[…],
//       세금:[{ 이름, 세목, 확정방식(신고|고지|원천징수고지|인지세고지), 본세, 가산세, 법정신고납부기한, 연장기한, 고지납부기한, 확정일(신고일·고지일) }],
//       사건:[{ 세금(이름 — 비우면 모든 세금), 종류(납부고지|독촉|교부청구|압류|승인|분납|유예|압류매각유예|연부연납|사해행위소송|국외체류), 시작, 끝, 결과(각하|기각|취하|인용|진행중), 해제사유(5호|6호|그밖) }] }
function judgeCollectionLimitation_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10), hol = p.공휴일 || [];
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], notes = [], 할일 = [], 줄 = [];
  const 끝날 = function (s, y) { return famAddD_(famAddY_(s, y), -1); }; // 기산일 넣어 셈(민법 §157 단서)·n년 뒤 같은 날 전날(§160②) — 제척기간 판정과 같은 셈 (원문 확인 2026-11-04: 국세기본법 §27②(민법 준용)·§27③(기한 다음 날)·민법 §157 단서·§160②)
  const 세금들 = [].concat(p.세금 || []), 사건들 = [].concat(p.사건 || []);
  if (!세금들.length) return jmWrap_('징수권소멸시효', [jmReq_('체납 세금 목록', null, '세목·확정방식·본세·가산세·납부기한을 넣을 것', '국세기본법 §27')], { 줄: [], 경우: [], 할일: [{ 무엇: '체납 세금마다 신고(또는 고지) 날짜·납부기한·본세·가산세를 받을 것(체납 내역·고지서)', 때: '먼저', 근거: '국세기본법 §27' }] });
  const 중단종류 = /^(납부고지|독촉|교부청구|압류|승인)/, 정지종류 = /^(분납|유예|징수유예|기한연장|압류매각유예|연부연납|사해행위소송|채권자대위소송|국외체류)/;
  let 끝남 = 0, 남음 = 0, 잠정 = 0;
  const 셈 = function (t, opt) { // opt: {정지무시, 가산세포함}
    const why = [], 근 = [];
    const 방식 = String(t.확정방식 || '신고'), 본세 = n(t.본세), 가산 = n(t.가산세);
    const 확정 = jmYmd_(t.확정일) || jmYmd_(t.고지납부기한) || jmYmd_(t.법정신고납부기한);
    // 1) 기간 — 5억원 이상 10년(가산세 제외), 2013년 전 신고·고지분은 5년, 2020년 전 신고·고지분은 가산세 포함해 견줌
    let 견줄 = 본세, 견줄근 = '본세(가산세 제외, §27①)';
    if (opt.가산세포함 || (확정 && 확정 < '2020-01-01')) { 견줄 = 본세 + 가산; 견줄근 = opt.가산세포함 ? '가산세까지 더해 견줌 — [견주기] 틀린 셈' : '2020년 전 신고·고지분이라 가산세 포함(법 16841호 부칙 §1 2020.1.1. 시행·§4)'; }
    let 년 = 견줄 >= 500000000 ? 10 : 5;
    if (년 === 10 && 확정 && 확정 < '2013-01-01') { 년 = 5; 견줄근 += ' · 2013년 전 신고·고지분이라 5억원 넘어도 5년(법 11604호 부칙 §5)'; }
    if (!확정) why.push('신고·고지 날짜를 몰라 5억원 기준·옛 부칙을 가리지 못함');
    // 2) 기산일 — §27③④
    let 기한 = '', 기한근 = '';
    if (/원천|인지/.test(방식)) { 기한 = jmYmd_(t.고지납부기한); 기한근 = '고지 납부기한(§27④1·2호)'; }
    else if (/고지|결정|경정/.test(방식)) { 기한 = jmYmd_(t.고지납부기한); 기한근 = '고지 납부기한(§27③2호)'; }
    else { 기한 = jmYmd_(t.연장기한) || jmYmd_(t.법정신고납부기한); 기한근 = jmYmd_(t.연장기한) ? '연장된 신고납부기한(§27④3호)' : '법정 신고납부기한(§27③1호 — 신고한 세액)'; }
    if (!기한) return { 이름: t.이름, 잠정: true, 결론: '잠정 — 납부기한 모름', 왜: [기한근 + '을 넣을 것'], 근거: [] };
    const w = [], 기한2 = apShift_(기한, hol, w);
    if (기한2 !== 기한) 근.push(기한 + '이 쉬는 날이라 기한이 ' + 기한2 + '(§5①) — 기산일도 그 다음 날로 봄 (원문 확인 2026-11-04: 국세기본법 §5①·§27③1호)');
    let 시작 = famAddD_(기한2, 1); const 첫기산 = 시작;
    // 3) 이 세금에 걸린 사건
    const mine = 사건들.filter(function (e) { return !e.세금 || e.세금 === t.이름; }).map(function (e) { return Object.assign({}, e, { 시작: jmYmd_(e.시작), 끝: jmYmd_(e.끝) }); }).filter(function (e) { return e.시작; }).sort(function (a, b) { return a.시작 < b.시작 ? -1 : 1; });
    const 정지구간 = [], 사건줄 = [];
    if (!opt.정지무시) mine.forEach(function (e) {
      const k = String(e.종류 || '');
      if (!정지종류.test(k)) return;
      const e끝 = e.끝 || today;
      if (/사해|대위/.test(k) && /각하|기각|취하/.test(String(e.결과 || ''))) { 사건줄.push(e.시작 + ' ' + k + ' — 소송 결과 ' + e.결과 + ', 정지 효력 없음(§28④)'); return; }
      if (/국외/.test(k)) { if (e끝 < jmAddM_(e.시작, 6)) { 사건줄.push(e.시작 + '~' + e끝 + ' 국외 체류 — 6개월 못 채워 정지 아님(§28③6호)'); return; } if (!e.끝) why.push('국외 체류가 끝났는지 모름 — 기준일까지로 셈(잠정)'); }
      정지구간.push({ s: e.시작, e: e끝, k: k });
    });
    const 합정지 = jmMerge_(정지구간);
    const 마감 = function (s) { // 기간 + 그 안에 걸친 정지 날수(겹침 늘 때마다 다시)
      let d = 끝날(s, 년), prev = '';
      for (let i = 0; i < 50 && d !== prev; i++) { prev = d; const 안 = 합정지.map(function (x) { return { s: x.s < s ? s : x.s, e: x.e > d ? d : x.e }; }).filter(function (x) { return x.s <= x.e; }); d = famAddD_(끝날(s, 년), jmLen_(안)); }
      return d;
    };
    let 압류중 = false, 끝 = 마감(시작);
    mine.forEach(function (e) {
      const k = String(e.종류 || '');
      if (!중단종류.test(k) || 압류중) return;
      if (e.시작 < 시작 && !/압류/.test(k)) { 사건줄.push(e.시작 + ' ' + k + ' — 기산일 전이라 중단 아님'); return; }
      if (e.시작 > 끝) { 사건줄.push(e.시작 + ' ' + k + ' — 이미 ' + 끝 + '에 시효가 끝난 뒤라 효력 없음(§26 3호)'); return; }
      if (/압류/.test(k) && /5호|6호/.test(String(e.해제사유 || ''))) { 사건줄.push(e.시작 + ' 압류 — 국세징수법 §57①' + e.해제사유 + ' 사유로 즉시 해제라 중단 아님(§28①4호 괄호)'); return; }
      let 다시, 근거;
      if (/승인/.test(k)) { 다시 = famAddD_(e.시작, 1); 근거 = '채무 승인(일부 납부·분납 신청 등) — 민법 §168 3호 준용(§27②) [확인 필요 — 권장: 열거 밖이나 민법 §168 3호 승인을 준용으로 인정하는 해석(판례)이 있음 — 권장 인정]'; }
      else if (/압류/.test(k)) { if (!e.끝) { 압류중 = true; 사건줄.push(e.시작 + ' 압류 — 해제되지 않아 시효가 다시 진행하지 않음(§28②4호)'); return; } 다시 = famAddD_(e.끝, 1); 근거 = '압류해제(' + e.끝 + ')까지(§28②4호)'; }
      else { if (!e.끝) why.push(k + '의 납부기간 끝을 모름 — 시작일로 셈(잠정)'); 다시 = famAddD_(e.끝 || e.시작, 1); 근거 = (/고지/.test(k) ? '고지한 납부기간' : /독촉/.test(k) ? '독촉 납부기간' : '교부청구 중 기간') + '이 지난 때부터(§28②)'; }
      사건줄.push(e.시작 + ' ' + k + ' — 중단, ' + 다시 + '부터 새로 진행(' + 근거 + ')');
      시작 = 다시; 끝 = 마감(시작);
    });
    const 정지날 = opt.정지무시 || 압류중 ? 0 : jmLen_(합정지.map(function (x) { return { s: x.s < 시작 ? 시작 : x.s, e: x.e > 끝 ? 끝 : x.e }; }).filter(function (x) { return x.s <= x.e; }));
    let 결론;
    if (압류중) 결론 = '압류 중 — 시효 진행 안 함';
    else if (끝 < today) 결론 = '완성(' + 끝 + ') — 납부의무 소멸(§26 3호)';
    else 결론 = '진행 중 — ' + 끝 + '까지(' + Math.round(jmDays_(today, 끝)) + '일 남음)';
    return { 이름: t.이름, 세목: t.세목 || '', 금액: 본세 + 가산, 기간: 년 + '년', 기간근거: 견줄근 + ' ' + won(견줄) + '원', 처음기산일: 첫기산, 기산근거: 기한근 + ' 다음 날', 마지막기산일: 압류중 ? '' : 시작, 정지날수: 정지날, 완성일: 압류중 ? '' : 끝, 결론: 결론, 사건: 사건줄, 잠정: why.length > 0, 왜: why, 근거: 근 };
  };
  세금들.forEach(function (t) {
    const r = 셈(t, {}), 무시 = 셈(t, { 정지무시: true }), 가산 = 셈(t, { 가산세포함: true });
    if (r.잠정) 잠정++;
    if (/^완성/.test(r.결론 || '')) 끝남++; else if (/진행|압류/.test(r.결론 || '')) 남음++;
    줄.push(Object.assign(r, { 견주기: { 정지무시완성일: 무시.완성일, 정지무시결론: 무시.결론, 가산세포함기간: 가산.기간, 가산세포함완성일: 가산.완성일 } }));
    if (무시.완성일 && r.완성일 && 무시.완성일 !== r.완성일) notes.push((t.이름 || '') + ': 정지 기간을 빼먹으면 ' + 무시.완성일 + '에 끝난다고 잘못 봄(법대로 ' + r.완성일 + ')');
    if (가산.기간 !== r.기간) notes.push((t.이름 || '') + ': 가산세까지 더해 5억원을 견주면 기간이 ' + 가산.기간 + '이 된다고 잘못 봄(§27① 괄호 — 가산세 제외)');
  });
  reqs.push(jmReq_('세금마다 기산일·기간', 잠정 ? null : true, 잠정 ? 잠정 + '건 잠정' : '', '국세기본법 §27①③④'));
  reqs.push(jmReq_('중단·정지 사유 확인', 사건들.length ? true : null, 사건들.length ? '' : '고지·독촉·압류·분납·유예·국외 체류 기록을 받으면 마감일이 바뀔 수 있음', '국세기본법 §28'));
  if (!사건들.length) 할일.push({ 무엇: '체납 내역(홈택스 체납 조회·체납액 증명)·압류 통지·독촉장·분납 승인·출입국 사실증명을 받을 것', 때: '먼저', 근거: '국세기본법 §28' });
  if (끝남) 할일.push({ 무엇: '완성된 세금은 납부의무가 없음 — 남은 압류가 있으면 해제를 요청 [확인 필요 — 권장: 1호(납부·충당)에 준하는 사유로 7호 해제 요청 권장]', 때: '바로', 근거: '국세기본법 §26 3호·국세징수법 §57①' });
  if (끝남) 할일.push({ 무엇: '완성 뒤 낸 세금이 있으면 돌려받을 수 있는지 확인 [확인 필요 — 권장: 납세의무 소멸 뒤 납부는 환급 대상으로 보되 시효이익 포기 논점 — 판례 확인]', 때: '바로', 근거: '국세기본법 §51' });
  줄.filter(function (r) { return r.완성일 && !/^완성/.test(r.결론); }).forEach(function (r) { 할일.push({ 무엇: (r.이름 || '') + ': 시효가 ' + r.완성일 + '에 끝남 — 그 전에 고지·독촉·압류가 있었는지 다시 확인', 때: r.완성일 + ' 전', 근거: '국세기본법 §27·§28' }); });
  notes.push('제척기간(§26의2, 부과할 수 있는 기간)과는 다름 — 소멸시효는 확정된 세금을 걷을 수 있는 기간');
  return jmWrap_('징수권소멸시효', reqs, { 줄: 줄, 완성: 끝남, 남음: 남음, 경우: [{ 경우: '① 법대로', 줄: 줄.map(function (r) { return r.이름 + ' ' + (r.완성일 || r.결론); }) }, { 경우: '② [견주기] 정지 기간 무시', 줄: 줄.map(function (r) { return r.이름 + ' ' + (r.견주기.정지무시완성일 || r.견주기.정지무시결론); }) }, { 경우: '③ [견주기] 가산세까지 5억원 견줌', 줄: 줄.map(function (r) { return r.이름 + ' ' + r.견주기.가산세포함기간 + ' ' + r.견주기.가산세포함완성일; }) }], 알림: notes, 할일: 할일 });
}
// [2026.11.04 복잡사건 132] 사업양수인의 제2차 납세의무(국세기본법 §41, 시행령 §22·§23) — 사업을 넘겨받은 사람이 양도인의 밀린 국세를 얼마까지 내야 하나
//  근거 원문(2026.11.04 업무관리자\법령 _본문에서 읽음 — 국세기본법 20261002 시행판·시행령 20260701 시행판):
//   법 §41①(양도일 이전에 양도인의 납세의무가 확정된 그 사업에 관한 국세·강제징수비를 양도인 재산으로 충당해도 부족하면, 대통령령으로 정하는 양수인이 부족액에 대해 양수한 재산의 가액을 한도로) · ②(가액은 대통령령)
//   시행령 §22(사업장별로 모든 권리(미수금 제외)·모든 의무(미지급금 제외)를 포괄 승계한 자로서 1호 특수관계인 또는 2호 양도인의 조세회피 목적 양수)
//   시행령 §23①(사업장 둘 이상 중 하나를 양수 → 그 사업장 관계 국세 + 공통 국세 중 배분액만) · ②1호(지급했거나 지급할 금액) 2호(없거나 불분명하면 상증법 §60~§66 준용 평가 자산총액 − 부채총액) · ③(1호 금액과 시가의 차액이 3억원 이상이거나 시가의 30% 이상이면 1호·2호 중 큰 금액)
//   시행령 §22 2019.2.12. 개정(1·2호 요건) 부칙 제29534호 §3(원문 확인 2026-11-04): 시행 전에 양도·양수된 경우라도 시행 당시 제2차 납세의무자로서 납부통지를 받지 않았으면 개정 규정(1·2호 요건) 적용
//  p: { 양도일, 사업장(양도인 사업장 수), 양수사업장(이름), 포괄승계(예|아니오|모름), 특수관계(예|아니오|모름), 조세회피목적(예|아니오|모름),
//       세금:[{ 이름, 세목, 확정일, 사업장(이름 — 비우면 양수 사업장), 공통(예), 배분액, 금액 }],
//       양도인충당후부족액(모르면 비움), 지급액, 시가, 평가자산, 평가부채, 양수인들:[{이름, 몫(%)}] }
function judgeBusinessTransferee_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const 있음 = function (v) { return !(v == null || v === ''); };
  const 예 = function (v) { return /^(예|y|yes|true|1|o)$/i.test(String(v == null ? '' : v).trim()); };
  const 아니오 = function (v) { return /^(아니오|아니요|n|no|false|0|x)$/i.test(String(v == null ? '' : v).trim()); };
  const reqs = [], notes = [], 할일 = [], 줄 = [];
  const 양도일 = jmYmd_(p.양도일), 양수장 = String(p.양수사업장 || '').trim(), 여럿 = n(p.사업장) >= 2;
  const 세금들 = [].concat(p.세금 || []);
  if (!양도일 || !세금들.length) return jmWrap_('사업양수인', [jmReq_('양도일·양도인 체납 국세', null, '사업 양도일과 양도인의 밀린 국세(세목·확정일·금액)를 넣을 것', '국세기본법 §41①')], { 줄: [], 경우: [], 할일: [{ 무엇: '사업 양도양수계약서(날짜·넘긴 자산·부채·대금)와 양도인 체납 내역(체납액 증명)을 받을 것', 때: '먼저', 근거: '국세기본법 §41①' }] });
  // 1) 양수인 요건 — 시행령 §22
  let 요건 = true, 잠정 = false;
  const 포괄 = 예(p.포괄승계) ? true : 아니오(p.포괄승계) ? false : null;
  reqs.push(jmReq_('사업장별 포괄 승계(미수금·미지급금만 빼고 모든 권리·의무)', 포괄, 포괄 === null ? '계약서로 넘긴 권리·의무 범위를 볼 것' : (포괄 ? '' : '일부 자산만 산 것 — 제2차 납세의무 없음'), '시행령 §22 본문'));
  const 특 = 예(p.특수관계) ? true : 아니오(p.특수관계) ? false : null, 회 = 예(p.조세회피목적) ? true : 아니오(p.조세회피목적) ? false : null;
  const 호 = (특 === true || 회 === true) ? true : (특 === false && 회 === false) ? false : null;
  reqs.push(jmReq_('1호 특수관계인 또는 2호 조세회피 목적 양수', 호, 호 === null ? '특수관계(국세기본법 §2 20호)·조세회피 목적 여부를 세무사님이 정할 것' : (호 ? (특 ? '1호 특수관계인' : '2호 조세회피 목적') : '둘 다 아님 — 제2차 납세의무 없음'), '시행령 §22 1·2호'));
  if (포괄 === false || 호 === false) 요건 = false;
  if (포괄 === null || 호 === null) 잠정 = true;
  if (특 === null) 할일.push({ 무엇: '양도인과 양수인이 특수관계인지 가족관계증명·주주명부·임원 명단으로 정황을 모아 세무사님이 정함', 때: '먼저', 근거: '시행령 §22 1호·국세기본법 §2 20호' });
  if (포괄 === null) 할일.push({ 무엇: '양도양수계약서·인수 목록으로 사업장의 권리·의무를 모두 넘겼는지(미수금·미지급금만 빼고) 볼 것', 때: '먼저', 근거: '시행령 §22 본문' });
  if (양도일 < '2019-02-12') notes.push('양도일이 2019-02-12 전 — 그 전 시행령 §22에는 1·2호 요건이 없었으나, 시행 당시(2019-02-12) 제2차 납세의무자로서 납부통지를 받지 않았으면 개정 규정(1·2호 요건)이 적용됨(부칙 제29534호 §3) — 납부통지를 그 전에 받았을 때만 옛 규정(요건 없이 포괄 양수인이면 대상)');
  // 2) 대상 국세 — 양도일 이전 확정 · 그 사업(사업장) 관계 · 공통은 배분액
  let 대상 = 0, 전부 = 0;
  세금들.forEach(function (t) {
    const 금액 = n(t.금액), 확정 = jmYmd_(t.확정일), why = [];
    전부 += 금액;
    let 들어감 = true, 셀 = 금액;
    if (!확정) { 들어감 = null; why.push('확정일(신고일·고지일)을 모름 — 잠정으로 넣음'); }
    else if (확정 > 양도일) { 들어감 = false; why.push('양도일(' + 양도일 + ') 뒤에 확정 — 빠짐(법 §41①)'); }
    if (예(t.공통)) {
      if (있음(t.배분액)) { 셀 = Math.min(금액, n(t.배분액)); why.push('여러 사업장 공통 국세 — 양수 사업장 배분액 ' + won(셀) + '원만(시행령 §23① 괄호)'); }
      else if (여럿) { why.push('공통 국세인데 배분액을 모름 — 전액을 잠정으로 넣음 [확인 필요 — 권장: 원문 없음 — 매출·자산 비율 등 합리적 기준으로 잠정]'); if (들어감 !== false) 들어감 = null; }
    } else if (여럿 && t.사업장 && 양수장 && String(t.사업장).trim() !== 양수장) { 들어감 = false; why.push('다른 사업장(' + t.사업장 + ') 국세 — 빠짐(시행령 §23①)'); }
    if (/양도소득|상속|증여|종합부동산/.test(String(t.세목 || ''))) { 들어감 = false; why.push('그 사업에 관한 국세로 보기 어려움(' + t.세목 + ') — 빠짐(법 §41① 「그 사업에 관한」) [확인 필요 — 권장: 사업용 자산 양도세는 논란 — 상속·증여·종부세는 제외 권장, 양도세는 사업장 자산이면 포함 가능성 표시]'); }
    if (들어감 === null) 잠정 = true;
    if (들어감 !== false) 대상 += 셀;
    줄.push({ 이름: t.이름 || '', 세목: t.세목 || '', 확정일: 확정 || '', 금액: 금액, 넣은금액: 들어감 === false ? 0 : 셀, 판정: 들어감 === true ? '들어감' : 들어감 === false ? '빠짐' : '잠정', 왜: why });
  });
  reqs.push(jmReq_('양도일 이전에 확정된 그 사업 국세', 대상 > 0, '대상 ' + won(대상) + '원', '국세기본법 §41①·시행령 §23①'));
  // 3) 부족액 — 양도인 재산으로 충당한 뒤
  let 부족 = 대상, 부족근 = '양도인 재산으로 충당하고 남은 부족액을 몰라 대상 국세 전부로 잠정';
  if (있음(p.양도인충당후부족액)) { 부족 = Math.min(대상, n(p.양도인충당후부족액)); 부족근 = '양도인 재산 충당 뒤 부족액'; }
  else { 잠정 = true; 할일.push({ 무엇: '양도인 남은 재산(압류·공매 결과)으로 먼저 충당했는지, 부족액이 얼마인지 세무서에 확인', 때: '납부통지 받으면 바로', 근거: '국세기본법 §41①' }); }
  reqs.push(jmReq_('양도인 재산으로 충당해도 부족', 부족 > 0, won(부족) + '원 — ' + 부족근, '국세기본법 §41①'));
  // 4) 한도 — 시행령 §23②③
  const 지급 = 있음(p.지급액) ? n(p.지급액) : null, 시가 = 있음(p.시가) ? n(p.시가) : null;
  const 순 = 있음(p.평가자산) ? Math.max(0, n(p.평가자산) - n(p.평가부채)) : null;
  let 한도 = 0, 한도근 = '';
  if (지급 != null && 지급 > 0) {
    한도 = 지급; 한도근 = '지급했거나 지급할 금액(시행령 §23②1호)';
    if (시가 != null) {
      const 차 = Math.abs(시가 - 지급);
      if (차 >= 300000000 || 차 >= 시가 * 0.3) {
        if (순 == null) { 잠정 = true; 한도근 += ' · 시가와 ' + won(차) + '원 차이(③ 해당) — 평가 순자산을 몰라 지급액으로 잠정'; 할일.push({ 무엇: '넘겨받은 자산·부채를 상증법 §60~§66으로 평가해 순자산을 셈', 때: '먼저', 근거: '시행령 §23②2호·③' }); }
        else { 한도 = Math.max(지급, 순); 한도근 = '지급액 ' + won(지급) + '원과 시가 ' + won(시가) + '원 차이 ' + won(차) + '원이 3억원 또는 시가 30% 이상 → 지급액과 평가 순자산 ' + won(순) + '원 중 큰 금액(시행령 §23③)'; }
      } else 한도근 += ' · 시가와 차이 ' + won(차) + '원(3억원·30% 미만이라 ③ 아님)';
    } else { 잠정 = true; 한도근 += ' · 시가를 몰라 ③(차이 3억원·30%)을 못 봄'; 할일.push({ 무엇: '넘겨받은 사업(자산·부채)의 시가를 확인(감정·매매사례)', 때: '먼저', 근거: '시행령 §23③' }); }
  } else if (순 != null) { 한도 = 순; 한도근 = '지급액이 없거나 불분명 → 상증법 준용 평가 자산총액 ' + won(n(p.평가자산)) + '원 − 부채총액 ' + won(n(p.평가부채)) + '원(시행령 §23②2호)'; }
  else { 잠정 = true; 한도 = 부족; 한도근 = '지급액·평가 순자산을 모름 — 한도를 못 셈(부족액 전부로 잠정)'; 할일.push({ 무엇: '양도양수계약서의 대금(지급했거나 지급할 금액)을 받을 것', 때: '먼저', 근거: '시행령 §23②1호' }); }
  reqs.push(jmReq_('양수한 재산의 가액(한도)', 한도 > 0 ? true : null, won(한도) + '원 — ' + 한도근, '국세기본법 §41②·시행령 §23②③'));
  const 책임 = 요건 ? Math.min(부족, 한도) : 0;
  const 양수인들 = [].concat(p.양수인들 || []).map(function (q) { return { 이름: q.이름 || '', 몫: q.몫, 책임액: Math.floor(책임 * n(q.몫) / 100) }; });
  if (양수인들.length > 1) notes.push('공동 양수인은 몫대로 나눠 보였음 — 연대 책임인지 몫만인지 [확인 필요 — 권장: 양수한 재산 가액 한도이므로 각자 양수 몫 한도(지금) 권장]');
  // 견주기
  const 지급만 = 요건 ? Math.min(부족, 지급 != null ? 지급 : 한도) : 0;
  const 전부책임 = 요건 ? 전부 : 0;
  if (지급만 !== 책임) notes.push('계약서 대금만 한도로 보면 ' + won(지급만) + '원 — 법대로(시행령 §23③) ' + won(책임) + '원보다 ' + won(Math.abs(책임 - 지급만)) + '원 ' + (지급만 < 책임 ? '적게' : '많게') + ' 봄');
  if (전부책임 !== 책임) notes.push('양도인 국세 전부를 떠안는다고 보면 ' + won(전부책임) + '원 — 법대로보다 ' + won(Math.abs(전부책임 - 책임)) + '원 ' + (전부책임 > 책임 ? '많음' : '적음') + '(확정일·사업장·부족액·한도를 안 본 셈)');
  if (!요건) notes.push('요건이 안 되어 양수인은 제2차 납세의무가 없음 — 납부고지를 받았으면 불복 거리');
  할일.push({ 무엇: '제2차 납세의무 납부고지를 받으면 받은 날부터 90일 안 이의신청·심사·심판 청구(요건·한도·대상 국세를 다툼)', 때: '고지 받은 날부터 90일', 근거: '국세기본법 §55·§61·§68 — 날짜는 「불복기한」 판정으로 셀 것' });
  할일.push({ 무엇: '양수 전이면 양도인 체납 여부를 확인하고 대금에서 체납액을 정리하게 할 것', 때: '계약 전', 근거: '국세기본법 §41① [실사건 때 확인: 실무 권고]' });
  notes.push('과점주주(§39)·법인(§40)·청산인(§38)의 제2차 납세의무와는 따로 봄');
  return jmWrap_('사업양수인', reqs, { 요건: 요건, 잠정: 잠정, 대상국세: 대상, 부족액: 부족, 한도: 한도, 한도근거: 한도근, 책임액: 책임, 양수인들: 양수인들, 줄: 줄,
    경우: [{ 경우: '① 법대로', 책임액: 책임, 줄: ['대상 ' + won(대상), '부족 ' + won(부족), '한도 ' + won(한도), '책임 ' + won(책임)] },
           { 경우: '② [견주기] 계약서 대금만 한도', 책임액: 지급만, 줄: ['책임 ' + won(지급만)] },
           { 경우: '③ [견주기] 양도인 국세 전부', 책임액: 전부책임, 줄: ['책임 ' + won(전부책임)] }],
    알림: notes, 할일: 할일 });
}
// [2026.11.04 복잡사건 133] 법인의 제2차 납세의무(국세기본법 §40, 시행령 §21) — 과점주주·무한책임사원(출자자)의 밀린 국세를 그 법인이 얼마까지 내야 하나
//  근거 원문(2026.11.04 업무관리자\법령 _본문에서 읽음 — 국세기본법 20261002 시행판·시행령 20260701 시행판·국세징수법 20261002 시행판):
//   법 §40①(국세(둘 이상이면 납부기한이 뒤에 오는 국세)의 납부기간 만료일 현재 무한책임사원 또는 과점주주(출자자)의 재산(그 법인 주식·출자지분 제외)으로 출자자의 국세·강제징수비에 충당해도 부족하면,
//     다음 각 호의 경우에만 부족액에 대해: 1호 재공매·수의계약 하려 해도 매수희망자가 없는 경우 / 2호 외국법인 주식이 외국 재산이라 압류 등 강제징수가 제한 / 3호 법률·정관으로 주식 양도가 제한(국세징수법 §66⑤로 공매할 수 없는 경우 제외))
//   법 §40②(한도 = (법인 자산총액 − 부채총액) × 출자자 소유주식 금액(출자액) ÷ 발행주식 총액(출자총액)) · 시행령 §21(자산·부채는 그 국세(둘 이상이면 납부기한이 뒤인 국세) 납부기간 종료일 현재 시가)
//   과점주주 뜻은 법 §39 2호(1명과 그 특수관계인 소유주식 합계 50% 초과 + 경영 지배) · 국세징수법 §66⑤(심판청구등이 계속 중인 국세로 압류한 재산은 결정·판결 확정 전 공매 못 함)
//  p: { 출자자종류(무한책임사원|과점주주), 집단지분(%, 본인+특수관계인), 경영지배(예|아니오|모름), 납부기간만료일, 체납액(국세+강제징수비),
//       출자자재산(그 법인 주식 제외, 충당 가능액 — 모르면 비움), 사유(1호|2호|3호|없음|모름), 정관양도제한내용, 심판계속중(예|아니오),
//       법인자산시가, 법인부채시가, 법인자산장부, 법인부채장부, 출자자주식, 발행주식(의결권 없는 것 포함 총액 기준 [확인 필요 — 권장: 「총액」 문언이라 의결권 없는 주식도 포함 권장]) }
function judgeCorpSecondary_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const 있음 = function (v) { return !(v == null || v === ''); };
  const 예 = function (v) { return /^(예|y|yes|true|1|o)$/i.test(String(v == null ? '' : v).trim()); };
  const 아니오 = function (v) { return /^(아니오|아니요|n|no|false|0|x)$/i.test(String(v == null ? '' : v).trim()); };
  const reqs = [], notes = [], 할일 = [];
  const 만료 = jmYmd_(p.납부기간만료일), 체납 = n(p.체납액);
  if (!체납) return jmWrap_('법인제2차납세의무', [jmReq_('출자자의 체납 국세', null, '출자자가 밀린 국세·강제징수비와 납부기한을 넣을 것', '국세기본법 §40①')], { 경우: [], 할일: [{ 무엇: '출자자 체납액 증명·법인 주주명부·정관·결산서(납부기간 만료일 무렵)를 받을 것', 때: '먼저', 근거: '국세기본법 §40' }] });
  let 요건 = true, 잠정 = false;
  // 1) 출자자 — 무한책임사원 또는 과점주주(§39 2호)
  const 종류 = String(p.출자자종류 || '').trim();
  let 출자자 = null, 출근 = '';
  if (/무한/.test(종류)) { 출자자 = true; 출근 = '합명회사 사원·합자회사 무한책임사원'; }
  else {
    const 집 = 있음(p.집단지분) ? famNum_(p.집단지분) : null, 지배 = 예(p.경영지배) ? true : 아니오(p.경영지배) ? false : null;
    if (집 == null) { 출자자 = null; 출근 = '본인과 특수관계인 지분 합계를 모름'; }
    else if (집 <= 50) { 출자자 = false; 출근 = '본인·특수관계인 합계 ' + 집 + '% — 50% 초과가 아님'; }
    else if (지배 === false) { 출자자 = false; 출근 = '합계 ' + 집 + '%지만 경영 지배가 아님'; }
    else { 출자자 = 지배 === true ? true : null; 출근 = '합계 ' + 집 + '%' + (지배 === true ? ' · 경영 지배' : ' · 경영 지배 여부 모름'); }
  }
  reqs.push(jmReq_('출자자(무한책임사원 또는 과점주주)', 출자자, 출근, '국세기본법 §40①·§39 1·2호'));
  if (출자자 === false) 요건 = false; if (출자자 === null) { 잠정 = true; 할일.push({ 무엇: '납부기간 만료일 무렵 주주명부·특수관계(가족관계증명 등)로 지분 합계와 경영 지배 정황을 모아 세무사님이 정함', 때: '먼저', 근거: '국세기본법 §39 2호·시행령 §20②·§18의2' }); }
  // 2) 부족 — 출자자 재산(그 법인 주식 제외)으로 충당한 뒤
  let 부족 = 체납, 부족근 = '출자자 재산(그 법인 주식 제외)을 몰라 체납액 전부로 잠정';
  if (있음(p.출자자재산)) { 부족 = Math.max(0, 체납 - n(p.출자자재산)); 부족근 = '체납 ' + won(체납) + '원 − 충당할 재산 ' + won(n(p.출자자재산)) + '원(그 법인 주식은 빼고 셈)'; }
  else { 잠정 = true; 할일.push({ 무엇: '납부기간 만료일 현재 출자자 재산(그 법인 주식 빼고)으로 충당할 수 있는 금액을 세무서 압류·공매 내역으로 확인', 때: '납부통지 받으면 바로', 근거: '국세기본법 §40①' }); }
  reqs.push(jmReq_('출자자 재산(그 법인 주식 제외)으로 충당해도 부족', 부족 > 0, won(부족) + '원 — ' + 부족근, '국세기본법 §40① 본문'));
  if (!만료) { 잠정 = true; 할일.push({ 무엇: '체납 국세의 납부기간 만료일(여럿이면 뒤에 오는 것)을 확인 — 부족·시가를 재는 날', 때: '먼저', 근거: '국세기본법 §40①·시행령 §21' }); }
  // 3) 사유 — 각 호
  const 사유 = String(p.사유 || '').trim();
  let 사 = null, 사근 = '';
  if (/^1|재공매|수의|매수/.test(사유)) { 사 = true; 사근 = '1호 — 재공매·수의계약에도 매수희망자 없음(공매 기록을 받아 볼 것)'; 할일.push({ 무엇: '세무서의 주식 공매·재공매·수의계약 시도 기록(매수희망자 없음)을 받아 볼 것', 때: '먼저', 근거: '국세기본법 §40①1호' }); }
  else if (/^2|외국/.test(사유)) { 사 = true; 사근 = '2호 — 외국법인 주식이 외국 재산이라 강제징수 제한'; }
  else if (/^3|양도제한|정관/.test(사유)) {
    if (예(p.심판계속중)) { 사 = false; 사근 = '3호지만 심판청구 등이 계속 중이라 국세징수법 §66⑤로 공매할 수 없는 경우 — 3호에서 빠짐'; }
    else { 사 = true; 사근 = '3호 — 법률·정관으로 주식 양도 제한' + (p.정관양도제한내용 ? '(' + p.정관양도제한내용 + ')' : ''); notes.push('정관상 「이사회 승인」 같은 양도 제한이 3호의 「양도가 제한된 경우」에 드는지 [확인 필요 — 권장: 판례·예규 — 그대로 둠]'); }
  } else if (/없음|아니/.test(사유)) { 사 = false; 사근 = '각 호 사유 없음 — 주식을 압류·공매하면 되므로 법인은 제2차 납세의무 없음'; }
  else { 사 = null; 사근 = '각 호 사유를 모름'; 할일.push({ 무엇: '정관(주식 양도 제한 조항)·세무서 공매 진행 상황을 확인', 때: '먼저', 근거: '국세기본법 §40①1~3호' }); }
  reqs.push(jmReq_('각 호 사유(주식으로 징수할 수 없는 사정)', 사, 사근, '국세기본법 §40①1~3호·국세징수법 §66⑤'));
  if (사 === false) 요건 = false; if (사 === null) 잠정 = true;
  // 4) 한도 — §40② (시가 순자산 × 지분)
  const 주 = n(p.출자자주식), 총 = n(p.발행주식), 비 = 총 > 0 ? 주 / 총 : null;
  let 한도 = null, 한도근 = '';
  if (비 == null) { 잠정 = true; 한도근 = '출자자 주식·발행주식 총액을 모름'; 할일.push({ 무엇: '주주명부로 출자자 본인 소유주식(출자액)과 발행주식 총액을 확인', 때: '먼저', 근거: '국세기본법 §40②' }); }
  else if (!있음(p.법인자산시가)) { 잠정 = true; 한도근 = '납부기간 종료일 현재 법인 자산·부채 시가를 모름'; 할일.push({ 무엇: '납부기간 종료일 현재 법인 자산·부채를 시가로 평가(부동산 감정·매매사례 등)', 때: '먼저', 근거: '시행령 §21' }); }
  else { const 순 = Math.max(0, n(p.법인자산시가) - n(p.법인부채시가)); 한도 = Math.floor(순 * 비); 한도근 = '(자산 시가 ' + won(n(p.법인자산시가)) + ' − 부채 시가 ' + won(n(p.법인부채시가)) + ') × ' + 주.toLocaleString('ko-KR') + '/' + 총.toLocaleString('ko-KR') + '주 = ' + won(한도) + '원'; if (순 === 0) notes.push('시가 순자산이 0 이하 — 한도 0원'); }
  reqs.push(jmReq_('한도 = 시가 순자산 × 출자자 지분', 한도 == null ? null : true, 한도근, '국세기본법 §40②·시행령 §21'));
  const 쓴한도 = 한도 == null ? 부족 : 한도;
  const 책임 = 요건 ? Math.min(부족, 쓴한도) : 0;
  // 견주기
  let 장부책임 = null;
  if (비 != null && 있음(p.법인자산장부)) { 장부책임 = 요건 ? Math.min(부족, Math.floor(Math.max(0, n(p.법인자산장부) - n(p.법인부채장부)) * 비)) : 0; if (장부책임 !== 책임) notes.push('장부가액 순자산으로 한도를 재면 ' + won(장부책임) + '원 — 법(시행령 §21 시가)대로 ' + won(책임) + '원보다 ' + won(Math.abs(책임 - 장부책임)) + '원 ' + (장부책임 < 책임 ? '적게' : '많게') + ' 봄'); }
  let 집단책임 = null;
  const 집지 = 있음(p.집단지분) ? famNum_(p.집단지분) : null;
  if (집지 != null && 한도 != null && 비 != null) { const 순시 = Math.max(0, n(p.법인자산시가) - n(p.법인부채시가)); 집단책임 = 요건 ? Math.min(부족, Math.floor(순시 * 집지 / 100)) : 0; if (집단책임 !== 책임) notes.push('특수관계인까지 합친 지분(' + 집지 + '%)으로 한도를 재면 ' + won(집단책임) + '원 — 법 §40②의 「출자자의 소유주식」은 체납 출자자 본인 몫으로 보아 ' + won(책임) + '원 (원문 확인 2026-11-04: 국세기본법 §40②)'); }
  if (!요건) notes.push('요건이 안 되어 법인은 제2차 납세의무가 없음 — 법인에 납부고지가 오면 불복 거리');
  할일.push({ 무엇: '법인이 제2차 납세의무 납부고지를 받으면 받은 날부터 90일 안 이의신청·심사·심판 청구(사유·한도·부족액을 다툼)', 때: '고지 받은 날부터 90일', 근거: '국세기본법 §55·§61·§68 — 날짜는 「불복기한」 판정으로 셀 것' });
  할일.push({ 무엇: '법인이 대신 낸 금액은 출자자에게 구상할 채권 — 법인 장부 처리·출자자 상여 등 처분 여부는 법인세 쪽 [실사건 때 확인]', 때: '납부 뒤', 근거: '[실사건 때 확인]' });
  notes.push('출자자(§39 — 법인 체납을 주주가)와 방향이 반대 — 여기는 주주(출자자) 체납을 법인이 냄. 사업양수인(§41)과도 따로 봄');
  return jmWrap_('법인제2차납세의무', reqs, { 요건: 요건, 잠정: 잠정, 부족액: 부족, 한도: 한도, 한도근거: 한도근, 지분비율: 비, 책임액: 책임,
    경우: [{ 경우: '① 법대로', 책임액: 책임, 줄: ['부족 ' + won(부족), '한도 ' + (한도 == null ? '모름' : won(한도)), '책임 ' + won(책임)] },
           { 경우: '② [견주기] 장부가액 순자산으로 한도', 책임액: 장부책임, 줄: ['책임 ' + (장부책임 == null ? '장부가 모름' : won(장부책임))] },
           { 경우: '③ [견주기] 특수관계인 합계 지분으로 한도', 책임액: 집단책임, 줄: ['책임 ' + (집단책임 == null ? '모름' : won(집단책임))] }],
    알림: notes, 할일: 할일 });
}
// [2026.11.04 복잡사건 152] 청산인 등의 제2차 납세의무(국세기본법 §38, 시행령 §19) — 해산한 법인이 국세를 안 내고 잔여재산을 나눠 준 때 청산인·받은 사람이 각자 한도까지 냄 + 받은 사람 의제배당·원천징수 연대(소득세법 §17②3호·§157①)
function judgeLiquidatorSecondary_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const 있음 = function (v) { return !(v == null || v === ''); };
  const reqs = [], notes = [], 할일 = [];
  const 세금 = Array.isArray(p.세금) ? p.세금 : [];
  const 받은 = Array.isArray(p.받은사람들) ? p.받은사람들 : [];
  const 세금합 = 세금.reduce(function (s, t) { return s + n(t && t.금액); }, 0);
  const 원천합 = 세금.reduce(function (s, t) { return s + (t && jmYn_(t.원천징수) === true ? n(t.금액) : 0); }, 0);
  const 받은합 = 받은.reduce(function (s, r) { return s + n(r && r.받은재산시가); }, 0);
  if (!세금합 || !받은.length) return jmWrap_('청산인제2차납세의무', [jmReq_('못 낸 국세와 잔여재산을 받은 사람', null, '세금(세목·금액)과 받은사람들(이름·받은재산시가)을 넣을 것', '국세기본법 §38①')], { 경우: [], 할일: [{ 무엇: '법인 체납 내역(세목·법정기일·금액)과 잔여재산 분배 명세(받은 사람·재산·분배일) 받기', 때: '지금', 근거: '국세기본법 §38' }] });
  const 해산 = jmYmd_(p.해산일), 분배 = jmYmd_(p.분배일), 확정 = jmYmd_(p.잔여재산가액확정일);
  reqs.push(jmReq_('법인이 해산함', 있음(p.해산일) ? true : null, 해산 ? '해산일 ' + 해산 : '해산일 모름 — 법인등기부로 확인', '국세기본법 §38①'));
  reqs.push(jmReq_('해산 법인이 내야 할 국세를 안 낸 채', true, '못 낸 국세 ' + won(세금합) + '원(' + 세금.map(function (t) { return (t.세목 || '국세') + ' ' + won(n(t.금액)); }).join(' · ') + ')', '국세기본법 §38①'));
  reqs.push(jmReq_('잔여재산을 분배하거나 인도함', 받은합 > 0 ? true : false, '분배 합계(분배일·인도일 시가) ' + won(받은합) + '원' + (분배 ? ' · 분배일 ' + 분배 : ''), '국세기본법 §38①·시행령 §19'));
  let 부족 = 있음(p.법인충당후부족액) ? n(p.법인충당후부족액) : null, 잠정 = false;
  if (부족 == null) { 부족 = 세금합; 잠정 = true; notes.push('법인 재산에 강제징수를 해도 모자라는 금액을 모름 — 못 낸 국세 전부(' + won(세금합) + '원)를 잠정 부족액으로 셈. 법인에 남은 재산이 있으면 줄어듦'); }
  reqs.push(jmReq_('법인에 강제징수를 해도 모자람', 부족 > 0 ? (잠정 ? null : true) : false, '부족액 ' + won(부족) + '원' + (잠정 ? '(잠정)' : ''), '국세기본법 §38①'));
  const 요건 = 받은합 > 0 && 부족 > 0;
  if (!있음(p.해산일)) { 잠정 = true; notes.push('해산일을 몰라 해산 여부를 잠정으로 두고 책임액을 셈 — 법인등기부(해산 등기)로 확인할 것'); }
  const 사람 = [];
  const 청한도 = 받은합;
  사람.push({ 누구: '청산인' + (p.청산인 ? '(' + p.청산인 + ')' : ''), 한도: 청한도, 한도근거: '분배하거나 인도한 재산의 가액 합계(국세기본법 §38②1호·시행령 §19 분배일 시가)', 책임액: 요건 ? Math.min(부족, 청한도) : 0 });
  받은.forEach(function (r) {
    const v = n(r.받은재산시가);
    사람.push({ 누구: '받은 사람 ' + (r.이름 || ''), 한도: v, 한도근거: '각자 받은 재산의 가액(국세기본법 §38②2호·시행령 §19 분배일 시가)', 책임액: 요건 ? Math.min(부족, v) : 0 });
  });
  const 배당 = 받은.map(function (r) {
    const v = n(r.받은재산시가), c = 있음(r.주식취득가액) ? n(r.주식취득가액) : null;
    return { 이름: r.이름 || '', 받은재산시가: v, 주식취득가액: c, 의제배당: c == null ? null : Math.max(0, v - c), 잠정: c == null };
  });
  배당.forEach(function (d) {
    if (d.잠정) notes.push(d.이름 + ' 주식 취득가액 모름 — 의제배당 금액을 셀 수 없음(주식 취득 계약서·증자 납입 증빙 받을 것)');
    else if (d.의제배당 > 0) notes.push(d.이름 + ' 의제배당 ' + won(d.의제배당) + '원 = 받은 재산 ' + won(d.받은재산시가) + ' − 주식 취득가액 ' + won(d.주식취득가액) + ' (소득세법 §17②3호, 물건은 시가 소득령 §27①) · 수입시기 잔여재산가액 확정일' + (확정 ? ' ' + 확정 : '') + '(소득령 §46 5호가) — 다른 금융소득과 합쳐 종합소득세: 이 시스템에 종합소득세 계산 도구 없음 → 넥스가 여쭐 것·도구 부족 신고');
  });
  if (원천합 > 0) notes.push('못 낸 국세 중 원천징수할 소득세 ' + won(원천합) + '원은 청산인이 분배액 한도로 받은 사람과 연대해 냄(소득세법 §157①) — 연대 한도 ' + won(Math.min(원천합, 받은합)) + '원, 위 제2차 납세의무와 겹치는 금액은 한 번만 걷음');
  const 지분합 = 받은.reduce(function (s, r) { return s + n(r.지분); }, 0);
  if (지분합 > 0 && 받은합 > 0) 받은.forEach(function (r) {
    const 받비 = n(r.받은재산시가) / 받은합 * 100, 지 = n(r.지분) / 지분합 * 100;
    if (받비 - 지 > 1) notes.push((r.이름 || '') + ' 지분 ' + 지.toFixed(1) + '%인데 잔여재산은 ' + 받비.toFixed(1) + '% 받음 — 지분보다 더 받은 몫은 다른 주주가 준 것으로 볼 여지(증여) [확인 필요 — 상증법 §4① 열거·§2 6호 포괄 증여, 의제배당과 겹침]'); else if (지 - 받비 > 1) notes.push((r.이름 || '') + ' 지분 ' + 지.toFixed(1) + '%인데 잔여재산은 ' + 받비.toFixed(1) + '%만 받음 — 덜 받은 몫은 더 받은 주주에게 준 것으로 볼 여지(그 주주 쪽 증여의 증여자) [확인 필요]');
  });
  notes.push('받은 재산(상가 등)을 나중에 팔 때 취득가액·취득일 — 의제배당으로 과세된 분배일 시가를 취득가액으로 볼지 [확인 필요 — 소득령 §163·§162 원문 대조]; 취득일은 분배(소유권 이전) 때로 보는 것이 보통 [확인 필요]');
  if (!요건) notes.push('요건이 안 되어 제2차 납세의무가 없음 — 납부고지가 오면 불복 거리');
  할일.push({ 무엇: '청산인·받은 사람이 제2차 납세의무 납부고지를 받으면 받은 날부터 90일 안 이의신청·심사·심판 청구(분배 시가·부족액을 다툼)', 때: '고지 받은 날부터 90일', 근거: '국세기본법 §55·§61·§68 — 날짜는 「불복기한」 판정으로 셀 것' });
  할일.push({ 무엇: '잔여재산 분배 명세·분배일 시가 근거(감정·매매사례)와 법인 청산 재무제표 받기', 때: '지금', 근거: '국세기본법 시행령 §19' });
  const 줄1 = 사람.map(function (s) { return s.누구 + ' 한도 ' + won(s.한도) + ' → 책임 ' + won(s.책임액); });
  return jmWrap_('청산인제2차납세의무', reqs, { 요건: 요건, 잠정: 잠정, 부족액: 부족, 사람별: 사람, 의제배당: 배당, 원천징수연대: 원천합 > 0 ? Math.min(원천합, 받은합) : 0, 책임액: 사람.reduce(function (m, s) { return Math.max(m, s.책임액); }, 0),
    경우: [{ 경우: '① 법대로 — 사람마다 받은 만큼까지(나라가 걷을 수 있는 합계)', 책임액: 요건 ? Math.min(부족, 받은합) : 0, 줄: ['부족 ' + won(부족)].concat(줄1, ['한 사람이 내면 그만큼 다른 사람 몫도 줄어듦 — 합계는 부족액과 분배 합계 중 적은 금액'] ) },
           { 경우: '② [견주기] 받은 사람 각자에게 부족액 전부(한도 무시)', 책임액: 요건 ? 부족 : 0, 줄: 받은.map(function (r) { return (r.이름 || '') + ' ' + won(요건 ? 부족 : 0) + ' — 한도(§38②2호)를 무시한 틀린 셈'; }) }],
    알림: notes, 할일: 할일 });
}
// [2026.11.04 복잡사건 153] 무상주(잉여금 자본전입)의 의제배당 — 소득세법 §17②2호·5호·③, 시행령 §27①②③⑤⑥⑦
//  근거 원문(2026.11.04 업무관리자\법령 _본문 소득세법 20260101·시행령 20261001_36737 시행판에서 읽음):
//   §17②2호: 법인의 잉여금 일부·전부를 자본·출자 금액에 전입해 받은 주식 가액은 의제배당. 다만 가목 자본준비금(시행령 §27④ — 법인세법 §17① 각 호, 법인세법 시행령 §12① 각 호 것은 뺌), 나목 재평가적립금(토지 재평가차액 몫은 뺌)을 전입한 것은 아님.
//   §17②5호: 법인이 자기주식을 가진 채 2호 단서(과세 안 되는) 잉여금을 전입해 그 법인 외 주주의 지분비율이 늘면 늘어난 지분 가액은 의제배당.
//   §17③ 단서: 자기주식소각이익 전입·토지 재평가 몫·5호 의제배당은 배당가산(Gross-up) 대상 아님.
//   시행령 §27①1호가: 받은 주식 가액은 액면가액(⑥ 무액면은 전입액 ÷ 신규 주식 수). ②: 무상주를 받은 뒤 1주당 장부가 = 구주 1주당 장부가 ÷ (1 + 구주 1주당 신주 배정 수). ③: 의제배당 안 된 무상주를 받은 날부터 2년 안에 주식을 소각하거나 줄이면 그 무상주를 먼저 줄인 것으로 보고 취득가액 0. ⑦: 소액주주로 취득가액이 분명하지 않으면 액면가액.
//   [확인 필요] 법인세법 시행령 §12① 각 호(자기주식소각이익 중 2년 안 소각·시가 초과 등 과세 몫)의 세부 — 원문 파일 못 찾아 잠정으로 둠.
function judgeBonusShare_(p) {
  p = p || {};
  const n = function (v) { return famNum_(v); };
  const won = function (v) { return Math.round(Number(v) || 0).toLocaleString('ko-KR') + '원'; };
  const 있음 = function (v) { return v !== undefined && v !== null && String(v).trim() !== ''; };
  const reqs = [], notes = [], 할일 = [];
  const 전입들 = Array.isArray(p.전입들) ? p.전입들 : (있음(p.재원) ? [{ 재원: p.재원, 금액: p.전입액, 토지재평가차액: p.토지재평가차액, 자산재평가차액: p.자산재평가차액 }] : []);
  const 신규 = n(p.신규주식수), 보유 = n(p.보유주식), 발행 = n(p.발행주식), 자기 = n(p.회사자기주식);
  if (!전입들.length || !(신규 > 0)) {
    return jmWrap_('무상주', [jmReq_('전입한 잉여금 재원·금액과 새로 낸 주식 수', null, '재원(이익잉여금·주식발행초과금·감자차익·자기주식소각이익·재평가적립금 등)과 신주 수를 알아야 과세 몫을 가름', '소득세법 §17②2호')], { 경우: [],
      할일: [{ 무엇: '주주총회·이사회 의사록(무상증자 결의), 자본금과 적립금 조정명세서(을), 주주명부(전입 전후), 자기주식 현황 받기', 때: '지금', 근거: '소득세법 §17②2호·5호, 시행령 §27' }] });
  }
  const 무액면 = jmYn_(p.무액면) === true;
  const 전입합 = 전입들.reduce(function (s, x) { return s + n(x.금액); }, 0);
  const 액면 = 무액면 ? (신규 > 0 ? 전입합 / 신규 : 0) : n(p.액면가);
  if (!(액면 > 0)) { notes.push('1주 액면가액을 몰라 의제배당 금액을 못 셈 — 정관·등기부로 확인(시행령 §27①1호가·⑥)'); 할일.push({ 무엇: '법인등기부·정관으로 1주 액면가액 확인', 때: '지금', 근거: '소득세법 시행령 §27①1호가' }); }
  // 재원마다 과세 몫 가르기
  const 잠정 = [];
  let 과세액 = 0, 가산제외액 = 0, 비과세액 = 0, 잠정액 = 0;
  const 갈래 = 전입들.map(function (x) {
    const 재원 = String(x.재원 || '').replace(/\s/g, ''); const 금액 = n(x.금액);
    let 과세 = 0, 가산X = 0, 비과세 = 0, 잠 = 0, 근거 = '', 메모 = '';
    if (/이익잉여금|이익준비금|임의적립금|미처분이익|이월이익/.test(재원)) { 과세 = 금액; 근거 = '§17②2호 본문 — 자본준비금·재평가적립금이 아닌 잉여금'; }
    else if (/주식발행초과금|주발초|감자차익/.test(재원)) { 비과세 = 금액; 근거 = '§17②2호가목·시행령 §27④(법인세법 §17①1호·4호) — 자본준비금'; }
    else if (/자기주식소각이익|자기주식처분이익/.test(재원)) {
      const 단기 = jmYn_(x.소각2년안), 시가초과 = jmYn_(x.시가초과);
      if (단기 === true || 시가초과 === true) { 과세 = 금액; 가산X = 금액; 근거 = '법인세법 시행령 §12① 각 호 몫(소각 2년 안·시가가 취득가 넘음)은 자본준비금에서 빠짐 → 의제배당, 배당가산 없음(§17③ 단서) [확인 필요 — 법인세법 시행령 원문 대조]'; }
      else if (단기 === false && 시가초과 === false) { 비과세 = 금액; 근거 = '법인세법 §17①·시행령 §12① 밖 자기주식소각이익 — 자본준비금 [확인 필요]'; }
      else { 잠 = 금액; 근거 = '소각일·소각 당시 시가를 몰라 과세 여부 잠정 — 소각 2년 안이거나 시가가 취득가를 넘으면 과세 [확인 필요]'; 잠정.push('자기주식소각이익 ' + won(금액) + ' 과세 여부'); 할일.push({ 무엇: '자기주식 소각일·소각 당시 시가·취득가액 확인(전입일과 2년 견줌)', 때: '지금', 근거: '법인세법 시행령 §12① [확인 필요]' }); }
    }
    else if (/합병차익|분할차익/.test(재원)) { 잠 = 금액; 근거 = '합병·분할차익 중 피합병법인 이익잉여금 승계 몫 등은 과세(법인세법 §17①5·6호 단서) — 몫을 몰라 잠정 [확인 필요]'; 잠정.push(재원 + ' ' + won(금액) + ' 과세 몫'); 할일.push({ 무엇: '합병·분할차익 구성(승계 이익잉여금·의제배당 몫) 명세 받기', 때: '지금', 근거: '소득세법 §17②2호가, 법인세법 §17①5·6호 [확인 필요]' }); }
    else if (/재평가적립금|재평가/.test(재원)) {
      const 토지 = n(x.토지재평가차액), 자산 = n(x.자산재평가차액);
      if (토지 > 0 && 자산 > 0) { 과세 = Math.round(금액 * 토지 / 자산); 가산X = 과세; 비과세 = 금액 - 과세; 근거 = '§17②2호나목 괄호·시행령 §27⑤ — 토지 재평가차액 몫(전입액 × 토지 재평가차액 ÷ 재평가차액 전체)만 과세, 배당가산 없음(§17③ 단서)'; }
      else if (jmYn_(x.토지만) === true) { 과세 = 금액; 가산X = 금액; 근거 = '전부 토지 재평가차액 몫 — 과세, 배당가산 없음'; }
      else { 잠 = 금액; 근거 = '토지 몫을 몰라 잠정 — 토지 재평가차액(1% 세율 몫)만 과세 [시행령 §27⑤]'; 잠정.push('재평가적립금 ' + won(금액) + ' 중 토지 몫'); 할일.push({ 무엇: '재평가 신고서·재평가차액 명세(토지·건물 나눔) 받기', 때: '지금', 근거: '소득세법 시행령 §27⑤' }); }
    }
    else { 잠 = 금액; 근거 = '재원을 몰라 잠정 — 이익잉여금이면 과세, 자본준비금이면 과세 안 됨'; 잠정.push('재원 모름 ' + won(금액)); 할일.push({ 무엇: '이사회 결의서·자본금과 적립금 조정명세서로 전입 재원 확인', 때: '지금', 근거: '소득세법 §17②2호' }); }
    과세액 += 과세; 가산제외액 += 가산X; 비과세액 += 비과세; 잠정액 += 잠;
    return { 재원: x.재원 || '(모름)', 금액: 금액, 과세: 과세, 배당가산제외: 가산X, 비과세: 비과세, 잠정: 잠, 근거: 근거 };
  });
  reqs.push(jmReq_('잉여금을 자본에 전입해 무상주를 줌', true, '전입 ' + won(전입합) + ' · 신주 ' + 신규.toLocaleString('ko-KR') + '주', '소득세법 §17②2호'));
  reqs.push(jmReq_('과세되는 재원(이익잉여금 등)이 들어 있음', 과세액 > 0 ? true : (잠정액 > 0 ? null : false), '과세 ' + won(과세액) + ' · 비과세 ' + won(비과세액) + (잠정액 > 0 ? ' · 잠정 ' + won(잠정액) : ''), '소득세법 §17②2호 단서'));
  // 이 주주 몫
  const 몫비율 = 발행 > 0 && 보유 > 0 ? 보유 / 발행 : null;
  const 받은 = 있음(p.받은신주) ? n(p.받은신주) : (몫비율 != null ? (자기 > 0 && 발행 - 자기 > 0 ? 신규 * 보유 / (발행 - 자기) : 신규 * 몫비율) : null);
  if (받은 == null) { notes.push('이 주주의 보유 주식·발행 주식 수를 몰라 받은 무상주 수를 못 셈 — 주주명부 확인'); 할일.push({ 무엇: '주주명부(전입 직전)로 보유 주식·발행 주식·자기주식 수 확인', 때: '지금', 근거: '소득세법 §17②2호·5호' }); }
  const 신규1 = 신규 > 0 ? 1 / 신규 : 0;
  const 과세주 = 받은 != null ? 받은 * (과세액 / (전입합 || 1)) : 0;
  const 잠정주 = 받은 != null ? 받은 * (잠정액 / (전입합 || 1)) : 0;
  const 비과세주 = 받은 != null ? 받은 - 과세주 - 잠정주 : 0;
  const 배당2호 = Math.round(과세주 * 액면);
  const 배당2호잠정 = Math.round(잠정주 * 액면);
  const 가산X몫 = 과세액 > 0 ? Math.round(배당2호 * 가산제외액 / 과세액) : 0;
  // 5호 — 자기주식이 있고 비과세 재원을 전입해 지분이 늘어난 몫
  let 배당5호 = 0, 증가분 = 0;
  if (자기 > 0 && 받은 != null && 몫비율 != null && (비과세액 + 잠정액) > 0) {
    const 정상 = 신규 * 몫비율; // 자기주식도 배정됐다면 받았을 수
    증가분 = Math.max(0, 받은 - 정상) * ((비과세액) / (전입합 || 1));
    배당5호 = Math.round(증가분 * 액면);
    reqs.push(jmReq_('회사가 자기주식을 가진 채 과세 안 되는 잉여금을 전입해 다른 주주 지분이 늘어남', 배당5호 > 0, '늘어난 주식 ' + Math.round(증가분).toLocaleString('ko-KR') + '주 × 액면 ' + won(액면), '소득세법 §17②5호'));
    if (배당5호 > 0) notes.push('§17②5호 의제배당 ' + won(배당5호) + ' — 자기주식에 배정 안 된 비과세 무상주가 다른 주주에게 돌아간 몫, 배당가산 없음(§17③ 단서)');
  }
  const 의제배당 = 배당2호 + 배당5호;
  const 가산대상 = Math.max(0, 배당2호 - 가산X몫);
  // 받은 뒤 장부가(시행령 §27②·③)
  const 구주 = 보유 > 0 ? 보유 : null;
  const 구주취득 = 있음(p.구주취득가액) ? n(p.구주취득가액) : (jmYn_(p.소액주주) === true && 구주 ? 구주 * n(p.액면가) : null);
  if (!있음(p.구주취득가액) && jmYn_(p.소액주주) === true) notes.push('소액주주로 구주 취득가액이 분명하지 않아 액면가액으로 봄(시행령 §27⑦)');
  let 장부 = null;
  if (구주 && 받은 != null && 구주취득 != null) {
    const 총주 = 구주 + 받은;
    const 총가 = 구주취득 + 배당2호 + 배당5호; // 과세된 무상주는 액면(의제배당액)이 취득가액, 비과세분은 0
    장부 = { 총주식: Math.round(총주), 총취득가액: Math.round(총가), 주당평균: 총주 > 0 ? Math.round(총가 / 총주) : 0, 비과세무상주: Math.round(비과세주) };
    notes.push('무상주 받은 뒤 1주당 장부가 ' + won(장부.주당평균) + ' (구주 취득가 ' + won(구주취득) + ' + 과세된 무상주 ' + won(의제배당) + ') ÷ ' + 장부.총주식.toLocaleString('ko-KR') + '주 — 시행령 §27② · 나중 양도 때 취득가액(소득령 §163)');
  }
  // 2년 안 소각(시행령 §27③)
  let 단기소각 = null;
  const 전입일 = jmYmd_(p.전입일), 소각일 = jmYmd_(p.소각일);
  if (전입일 && 소각일 && 비과세주 > 0) {
    const d1 = new Date(전입일), d2 = new Date(소각일); const 두해 = new Date(d1); 두해.setFullYear(두해.getFullYear() + 2);
    const 안 = d2 < 두해;
    const 소각주 = n(p.소각주식수), 대가 = n(p.소각대가);
    if (안 && 소각주 > 0) {
      const 먼저 = Math.min(소각주, 비과세주);
      const 나머지 = 소각주 - 먼저;
      const 나머지원가 = 장부 && (장부.총주식 - 비과세주) > 0 ? 나머지 * ((구주취득 + 의제배당) / (장부.총주식 - 비과세주)) : 0;
      const 배당소각 = Math.max(0, Math.round(대가 - 나머지원가));
      단기소각 = { 소각주식수: 소각주, 비과세무상주먼저: Math.round(먼저), 취득가액: Math.round(나머지원가), 소각의제배당: 배당소각 };
      notes.push('무상주 받은 날부터 2년 안 소각 — 비과세 무상주 ' + Math.round(먼저).toLocaleString('ko-KR') + '주를 먼저 소각한 것으로 보고 취득가액 0(시행령 §27③) → 소각 의제배당 ' + won(배당소각) + '(§17②1호)');
    } else if (!안) notes.push('소각이 무상주 받은 날부터 2년 뒤 — §27③ 단기소각 규정 안 걸림, 평균 장부가로 셈');
  } else if (비과세주 > 0) {
    할일.push({ 무엇: '비과세 무상주를 받은 날부터 2년 안에 감자·소각 계획이 있으면 미리 셈(그 무상주가 먼저 소각되고 취득가 0)', 때: 전입일 ? (function () { const d = new Date(전입일); d.setFullYear(d.getFullYear() + 2); return d.toISOString().slice(0, 10) + ' 전'; })() : '전입일부터 2년', 근거: '소득세법 시행령 §27③' });
  }
  // 받은 때·과세
  if (의제배당 > 0) {
    notes.push('의제배당은 배당소득 — 법인이 지급 때 14% 원천징수(지방소득세 별도), 금융소득 합계 2천만원 넘으면 종합과세 [종합소득세 도구 없음 → 넥스가 다른 금융소득을 여쭈고 도구 부족 신고]');
    할일.push({ 무엇: '그해 다른 이자·배당소득 합계 여쭘(2천만원 넘으면 종합과세), 원천징수영수증 받기', 때: '다음 해 5월 종합소득세 신고 전', 근거: '소득세법 §14③6호·§127①2호·§129①2호' });
  }
  if (잠정액 > 0) notes.push('잠정 몫 ' + won(잠정액) + ' — 과세면 의제배당 ' + won(배당2호잠정) + ' 늘어남(경우 ②)');
  notes.push('무상주 취득시기 [확인 필요] — 양도 때 보유기간은 구주 취득일로 볼지 무상주 받은 날로 볼지 원문(소득령 §162) 대조');
  const 근거줄 = 갈래.map(function (g) { return g.재원 + ' ' + won(g.금액) + ' → 과세 ' + won(g.과세) + (g.잠정 ? ' · 잠정 ' + won(g.잠정) : '') + (g.비과세 ? ' · 과세 안 함 ' + won(g.비과세) : '') + ' (' + g.근거 + ')'; });
  return jmWrap_('무상주', reqs, { 요건: 의제배당 > 0, 잠정: 잠정, 재원별: 갈래, 액면가: 액면, 받은무상주: 받은 != null ? Math.round(받은) : null, 과세무상주: Math.round(과세주), 비과세무상주: Math.round(비과세주),
    의제배당: 의제배당, 의제배당2호: 배당2호, 의제배당5호: 배당5호, 배당가산대상: 가산대상, 배당가산제외: 가산X몫 + 배당5호, 원천징수14: Math.floor(의제배당 * 0.14 / 10) * 10, 장부가: 장부, 단기소각: 단기소각,
    경우: [{ 경우: '① 법대로 — 재원마다 가름(잠정 몫은 과세 안 함으로)', 세액: 의제배당, 줄: 근거줄.concat(['의제배당 ' + won(의제배당) + ' (2호 ' + won(배당2호) + ' · 5호 ' + won(배당5호) + ')']) },
           { 경우: '② 잠정 몫도 과세로 보면', 세액: 의제배당 + 배당2호잠정, 줄: ['잠정 몫 ' + won(잠정액) + ' 더함 → 의제배당 ' + won(의제배당 + 배당2호잠정)] },
           { 경우: '③ [견주기] 재원 안 가르고 무상주 전부 과세', 세액: 받은 != null ? Math.round(받은 * 액면) : 0, 줄: ['자본준비금 전입까지 과세한 틀린 셈'] },
           { 경우: '④ [견주기] 무상주는 전부 과세 안 된다고 보면', 세액: 0, 줄: ['이익잉여금 전입 의제배당을 놓친 틀린 셈'] }],
    알림: notes, 할일: 할일 });
}

// [2026.11.04 복잡사건 154 「대물변제」] 빚 대신 부동산을 넘김(대물변제)·양도담보·위자료로 넘김 — 양도인지·양도가액·부당행위·받는 쪽 증여·나중 취득가액을 가름
//  근거 원문(2026.11.04 업무관리자\법령 _본문에서 읽음 — 소득세법 20260101·시행령 20261001·상증법 20260102 시행판):
//   소득세법 §88 1호(양도 = 매도·교환·법인 현물출자 등으로 자산이 유상으로 사실상 이전되는 것) — 대물변제는 채무 소멸을 대가로 한 유상 이전 → 양도
//   §96①(양도가액 = 실지거래가액) — 대물변제의 실지거래가액은 소멸한 채무 원리금 [확인 필요 — 권장: 소멸 채무액]
//   §96③2호(특수관계인에게 시가보다 높게 넘기고 상증법 §35로 증여세 과세받으면 양도가액 = 시가)
//   시행령 §151①(담보 목적 양도: 1. 담보 목적 의사표시 2. 채무자가 원래대로 사용·수익 3. 원금·이율·변제기한·방법 약정 — 모두 갖춘 계약서 사본을 확정신고서에 첨부하면 양도 아님)
//   시행령 §151②(그 뒤 요건 위배하거나 채무불이행으로 변제에 충당한 때 그때 양도)
//   §101①·시행령 §167③(특수관계인에게 시가보다 낮게 양도 — 차액 3억 이상이거나 시가 5% 이상일 때만) ④(시가로 계산) ⑤(시가는 상증법 §60~§66 준용)
//   상증법 §35①(특수관계 저가 양수: 차액 − min(시가×30%, 3억)) ②(특수관계 아님: 차액 ≥ 시가×30%이면 차액 − 3억)
//   시행령 §163⑩1호(받은 사람 나중 취득가액: §35 증여재산가액 더함)
//   §105①1호(예정신고: 양도일 속한 달 말일부터 2개월)
//   위자료 대신 넘김 = 양도 / 재산분할 = 양도 아님 — 판례 원문 시스템에 없음 → [실사건 때 확인]
//  p: { 넘김:'대물변제'|'양도담보'|'위자료'|'재산분할', 자산:'주택'|'토지'|…, 채무원금, 이자, 시가, 취득가액, 비용, 취득일, 양도일, 특수관계:true|false|null,
//       담보의사표시, 채무자사용수익, 원리금약정, 계약서첨부, 변제충당:true|false|null, 1세대1주택:true|false|null, 엔진칸:{} }
function judgeDebtSettle_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 넘김 = String(p.넘김 || '대물변제');
  const 자산 = String(p.자산 || '');
  const 원금 = num(p.채무원금), 이자 = num(p.이자), 시가 = num(p.시가);
  const 채무액 = 원금 + 이자;
  const 취득가액 = num(p.취득가액), 비용 = num(p.비용);
  const 양도일 = jmYmd_(p.양도일);
  const 특수 = jmYn_(p.특수관계);
  let 양도 = null, 양도가액 = 0, 잠정 = false;

  // 1) 양도인지
  if (/재산분할/.test(넘김)) {
    양도 = false;
    reqs.push(jmReq_('양도인지', '✘', '이혼 재산분할로 넘김 — 공유재산을 나누는 것이라 양도 아님', '[실사건 때 확인] 판례(재산분할은 양도 아님) 원문 시스템에 없음'));
    notes.push('재산분할로 받은 사람이 나중에 팔 때 취득일·취득가액은 전 배우자 당초 것 — 가족 지도 「재산분할」 종류로 잇기 [실사건 때 확인]');
  } else if (/양도담보|담보/.test(넘김)) {
    const 셋 = [jmYn_(p.담보의사표시), jmYn_(p.채무자사용수익), jmYn_(p.원리금약정)];
    const 첨부 = jmYn_(p.계약서첨부), 충당 = jmYn_(p.변제충당);
    const 이름 = ['1호 담보 목적 의사표시', '2호 채무자가 원래대로 사용·수익', '3호 원금·이율·변제기한·방법 약정'];
    셋.forEach(function (v, i) { reqs.push(jmReq_(이름[i], v === true ? '✔' : v === false ? '✘' : '?', v == null ? '계약서로 확인' : '', '소득세법 시행령 §151①' + (i + 1) + '호')); });
    reqs.push(jmReq_('계약서 사본 확정신고서 첨부', 첨부 === true ? '✔' : 첨부 === false ? '✘' : '?', '첨부해야 양도로 보지 않음', '시행령 §151① 본문'));
    reqs.push(jmReq_('요건 위배·채무불이행으로 변제 충당', 충당 === true ? '✘' : 충당 === false ? '✔' : '?', 충당 === true ? '충당한 때 양도' : '', '시행령 §151②'));
    if (충당 === true || 셋.indexOf(false) >= 0) 양도 = true;
    else if (셋.every(function (v) { return v === true; }) && 첨부 !== false) { 양도 = false; if (첨부 == null) 잠정 = true; }
    else { 양도 = null; 잠정 = true; }
    if (양도 === false) 할일.push({ 무엇: '양도담보 계약서 사본을 확정신고서에 첨부(빠지면 양도로 봄)', 때: '다음 해 5월 확정신고', 근거: '시행령 §151①' });
    if (충당 === true) notes.push('변제에 충당한 날이 양도일 — 그날 기준 양도가액 = 충당된 채무액(시행령 §151②)');
  } else {
    양도 = true;
    reqs.push(jmReq_('양도인지', '✔', (/위자료/.test(넘김) ? '위자료 채무를 갚으려고 넘김' : '빚을 갚으려고 넘김(대물변제)') + ' — 채무 소멸을 대가로 한 유상 이전', '소득세법 §88 1호' + (/위자료/.test(넘김) ? ' · 위자료 판례 [실사건 때 확인]' : '')));
  }

  // 2) 양도가액·부당행위·받는 쪽 증여
  let 증여액 = 0, 부당 = false, 고가 = false, 증여재산가액 = 0;
  if (양도 !== false) {
    if (채무액 <= 0) { 잠정 = true; reqs.push(jmReq_('없어진 채무액', '?', '원금·이자를 차용증·판결·합의서로 확인', '소득세법 §96①')); }
    else reqs.push(jmReq_('없어진 채무액', '✔', '원금 ' + won(원금) + (이자 ? ' + 이자 ' + won(이자) : '') + ' = ' + won(채무액), '소득세법 §96① [확인 필요 — 권장: 소멸 채무 원리금을 실지거래가액으로]'));
    양도가액 = 채무액;
    if (시가 > 0 && 채무액 > 0 && 채무액 < 시가) {
      const 차액 = 시가 - 채무액;
      if (특수 === true) {
        if (차액 >= 300000000 || 차액 >= 시가 * 0.05) {
          부당 = true; 양도가액 = 시가;
          reqs.push(jmReq_('부당행위(싸게 넘김)', '✘', '특수관계인에게 시가 ' + won(시가) + '보다 ' + won(차액) + ' 싸게 — 시가로 다시 셈', '소득세법 §101①·시행령 §167③④'));
        } else reqs.push(jmReq_('부당행위(싸게 넘김)', '✔', '차액 ' + won(차액) + ' — 3억·시가 5% 모두 안 넘어 안 걸림', '시행령 §167③ 단서'));
        const gate = Math.min(시가 * 0.3, 300000000);
        증여액 = Math.max(0, Math.round(차액 - gate));
      } else if (특수 === false) {
        if (차액 >= 시가 * 0.3) 증여액 = Math.max(0, Math.round(차액 - 300000000));
      } else { 잠정 = true; reqs.push(jmReq_('특수관계', '?', '채권자와의 관계를 세무사님께 여쭘', '소득세법 §101①·상증법 §35')); }
      if (증여액 > 0) { 증여재산가액 = 증여액; notes.push('받는 쪽(채권자) 저가 양수 증여 ' + won(증여액) + ' — 상증법 §35' + (특수 ? '①' : '②') + ' · 증여세 신고는 받은 날 속한 달 말일부터 3개월(§68①)'); }
    } else if (시가 > 0 && 채무액 > 시가) {
      고가 = true;
      const 차액2 = 채무액 - 시가;
      const g2 = 특수 === true ? Math.max(0, Math.round(차액2 - Math.min(시가 * 0.3, 300000000))) : (차액2 >= 시가 * 0.3 ? Math.max(0, Math.round(차액2 - 300000000)) : 0);
      if (g2 > 0) { 양도가액 = 채무액 - g2; notes.push('비싸게 넘김 — 넘긴 사람이 고가 양도 증여 ' + won(g2) + '(상증법 §35) → 양도가액 = 채무액 − 증여재산가액 ' + won(양도가액) + '(소득세법 §96③2호)'); }
      if (특수 === true) notes.push('채권자 쪽 부당행위(시가보다 비싸게 취득) — 채권자가 나중에 팔 때 취득가액은 시가(시행령 §167④)');
    } else if (시가 <= 0) { notes.push('시가 모름 — 감정가·매매사례로 시가 확인(시행령 §167⑤ 상증법 §60~§66 준용, 평가기간 전후 3개월) — 싸게 넘겼는지 못 가림'); 할일.push({ 무엇: '시가 확인(감정 또는 매매사례)', 때: '신고 전', 근거: '시행령 §167⑤' }); }
  }

  // 3) 받는 사람 나중 취득가액
  const 나중취득가액 = 양도 === false ? 0 : (고가 && 특수 === true && 시가 > 0 ? 시가 : 채무액 + 증여재산가액);
  if (양도 !== false && 채무액 > 0) notes.push('받은 사람 나중 취득가액 = 없어진 채권액 ' + won(채무액) + (증여재산가액 ? ' + 증여재산가액 ' + won(증여재산가액) + '(시행령 §163⑩1호)' : '') + ' → ' + won(나중취득가액));

  // 4) 알림·할 일
  if (/주택/.test(자산)) notes.push('1세대1주택이면 비과세(소득세법 §89①3호) — 대물변제여도 양도라 판정 그대로' + (jmYn_(p['1세대1주택']) == null ? ' — 1세대1주택 판정 묶음으로 확인' : ''));
  notes.push('양도시기 [확인 필요 §162] — 대물변제 약정일·등기접수일 중 무엇으로 볼지 원문 대조(권장: 시행령 §162①1호 대금청산일 성격 = 채무 소멸일, 등기가 먼저면 등기접수일)');
  if (양도 !== false) {
    if (양도일) { const y = +양도일.slice(0, 4), m = +양도일.slice(5, 7); const last = new Date(Date.UTC(y, m + 2, 0)).toISOString().slice(0, 10); 할일.push({ 무엇: '양도소득세 예정신고·납부', 때: last + '까지', 근거: '소득세법 §105①1호' }); }
    else 할일.push({ 무엇: '양도일 확인 뒤 예정신고(그 달 말일부터 2개월)', 때: '양도일 뒤', 근거: '소득세법 §105①1호' });
  }

  // 5) 경우(엔진칸)
  const base = Object.assign({ assetType: /주택/.test(자산) ? 'house' : /토지/.test(자산) ? 'land' : 'other', acquisitionPrice: 취득가액 || undefined, necessaryExpenses: 비용 || undefined, acquisitionDate: jmYmd_(p.취득일) || undefined, transferDate: 양도일 || undefined }, p.엔진칸 || {});
  if (양도 !== false && 양도가액 > 0) {
    경우.push({ 이름: '① 법대로 — 양도가액 ' + won(양도가액), 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 양도가액 }) });
    경우.push({ 이름: '② [견주기] 빚 갚은 것이라 양도 아니라고 잘못 봄 — 세금 0', 세액: 0, 줄: ['대물변제도 유상 이전이라 양도(§88 1호) — 이렇게 신고하면 무신고'] });
    if (부당) 경우.push({ 이름: '③ [견주기] 시가 안 보고 채무액 ' + won(채무액) + '으로 신고', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 채무액 }) });
    else if (시가 > 0 && 시가 !== 양도가액) 경우.push({ 이름: '③ [견주기] 채무액 대신 시가 ' + won(시가) + '로 잘못 셈', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 시가 }) });
  }

  const w = jmWrap_('대물변제', reqs, { 넘김: 넘김, 양도: 양도, 잠정: 잠정, 채무액: 채무액, 시가: 시가, 양도가액: 양도가액, 부당행위: 부당, 고가: 고가, 받는쪽증여: 증여재산가액, 나중취득가액: 나중취득가액, 경우: 경우, 알림: notes, 할일: 할일 });
  w.결론 = 양도 === false ? '양도 아님(' + 넘김 + ')' + (잠정 ? ' — 잠정' : '') : 양도 === true ? '양도 — 양도가액 ' + won(양도가액) + (부당 ? '(시가로 다시 셈)' : '') + (잠정 ? ' — 잠정' : '') : '가르지 못함 — 잠정';
  w.표시 = '대물변제 ' + w.결론;
  return w;
}

// [2026.11.05 모의사건 168] 납부고지서·독촉장 송달의 적법성(국세기본법 §8~§12) — 누구에게·어디로·어떤 방법으로 보내야 하고, 언제 도달(효력)하며, 공시송달·전자송달·보충송달 요건을 못 갖추면 처분·기한이 어떻게 되나
//  근거 원문(2026.11.05 업무관리자\법령 읽기용 판 — 국세기본법 20261002 시행판·시행령 20260701 시행판):
//   §8①(명의인의 주소·거소·영업소·사무소, 전자송달은 전자우편주소·국세정보통신망) ②(연대납세의무자는 대표자 — 다만 납부고지·독촉은 모두에게 각각) ③(상속재산관리인) ④(납세관리인이 있으면 고지·독촉은 납세관리인) ⑤(교정시설·유치장 — 시설의 장) · §9·시행령 §5(송달받을 장소 신고 — 그곳으로, 전입신고 동의면 변경신고로 봄)
//   §10①(교부·우편·전자) ②(고지·독촉·강제징수·명령 서류는 등기우편, 단 100만원 미만 중간예납·부가세·신고 뒤 미납 고지서 등은 일반우편 — 시행령 §5의2) ③(교부 — 소속 공무원이 송달 장소에서, 거부 않으면 다른 장소) ④(본인 못 만나면 사리 판별 가능한 사용인·종업원·동거인, 정당한 사유 없이 거부하면 그 장소에 둘 수 있음) ⑤(주소 이전은 주민등록표로 확인해 이전 장소로) ⑥(송달서 서명·날인) ⑦(일반우편 기록) ⑧(전자송달은 신청한 경우만) ⑨(3회 연속 미열람 → 철회 간주, 기한 안 전액 납부면 예외) ⑩(통신망 장애면 교부·우편)
//   §11①(공시송달: 1호 국외·곤란 2호 주소 불명(시행령 §7 — 주민등록표·법인등기부로도 확인 불가) 3호 시행령 §7의2(등기우편 수취인 부재 반송으로 납부기한 안 송달 곤란 / 공무원 2회 이상 방문(첫날~끝날 3일 이상, 공휴일·주말 빼고) 부재) — 공고한 날부터 14일 지나면 송달 간주) ②(국세정보통신망·세무서 게시판·시군구 홈페이지·관보 등, 통신망 공고는 다른 방법과 함께)
//   §12①(도달한 때 효력. 전자송달은 전자우편주소 입력·국세정보통신망 저장 때 도달 간주) · §61①(불복 90일은 「안 날 = 통지받은 날」부터 — 「불복기한」 묶음) · §26의2(제척기간 안에 고지서가 도달해야 부과 효력 [확인 필요 — 판례])
//  놓치던 것: ① 옛 주소·이웃·경비실에 간 고지서를 받은 것으로 치고 90일을 세거나, 반대로 적법한 보충송달(동거인)을 안 받았다고 봄 ② 공시송달을 「공고 뒤 14일」로만 보고 사유(반송·2회 방문·주소 불명 확인)와 공고 방법을 안 따짐 ③ 전자송달 도달은 열람일이 아니라 저장된 때 ④ 연대납세의무자·납세관리인에게 각각 보내야 하는 서류 ⑤ 송달 하자면 처분의 효력·불복기간·제척기간이 모두 달라짐
//  p: { 서류(납부고지서|독촉장|결정통지|조사통지|기타), 고지금액, 명의인(본인|연대납세의무자|납세관리인|상속재산관리인|수용자), 납세관리인있음(예|아니오), 상속재산관리인있음(예), 연대납세의무자들:[{이름, 각각송달(예|아니오)}],
//       송달장소(현주소|신고장소|영업소|옛주소|제3의장소), 주소이전(예|아니오), 이전확인(예|아니오 — 주민등록표로), 신고장소있음(예|아니오),
//       방법(등기우편|일반우편|교부|전자|공시), 수령자(본인|동거인|종업원|사용인|제3자|거부|부재), 수령자사리분별(예|아니오), 수령일, 유치(예 — 거부해 그 장소에 둠), 거부정당사유(예|아니오),
//       전자:{ 신청(예|아니오), 저장일, 열람일, 연속미열람(횟수), 장애(예) }, 공시:{ 사유(국외|주소불명|반송|방문부재), 주민등록확인(예|아니오), 등기반송(예), 방문횟수, 방문첫날, 방문끝날, 공고일, 공고방법들:[국세정보통신망|게시판|홈페이지|관보] },
//       제척기간만료일, 납부기한, 기준일, 공휴일[] }
function judgeServiceValidity_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10), hol = p.공휴일 || [];
  const 서류 = String(p.서류 || '납부고지서'), 고지서류 = /고지|독촉|강제징수|명령/.test(서류), 방법 = String(p.방법 || ''), 명 = String(p.명의인 || '본인');
  let 하자 = [], 도달 = null, 잠정 = false;

  // 1) 누구에게·어디로
  if (jmYn_(p.납세관리인있음) === true && 고지서류 && !/납세관리인/.test(명)) 하자.push('납세관리인이 있는데 본인에게 보냄 — 고지·독촉은 납세관리인의 주소·영업소로(§8④)');
  if (jmYn_(p.상속재산관리인있음) === true && !/상속재산관리인/.test(명)) 하자.push('상속재산관리인이 있는데 다른 사람에게 — 관리인 주소로(§8③)');
  const 연대 = p.연대납세의무자들 || [];
  if (연대.length && 고지서류) { const 빠짐 = 연대.filter(function (x) { return jmYn_(x.각각송달) === false; }); if (빠짐.length) 하자.push('연대납세의무자 ' + 빠짐.map(function (x) { return x.이름; }).join('·') + '에게 각각 송달하지 않음 — 고지·독촉은 모두에게 각각(§8② 단서)'); }
  reqs.push(jmReq_('명의인(누구에게)', 하자.length ? false : true, 하자.length ? 하자.join(' · ') : (명 + (연대.length ? ' · 연대납세의무자 ' + 연대.length + '명 각각 ✔' : '')), '국세기본법 §8②③④'));
  const 장소 = String(p.송달장소 || ''); let 장소ok = null, 장소왜 = '';
  if (jmYn_(p.신고장소있음) === true) { 장소ok = /신고장소/.test(장소); 장소왜 = 장소ok ? '신고한 송달 장소 ✔' : '송달받을 장소를 신고했는데 다른 곳(' + 장소 + ')으로 — 신고 장소로 보내야(§9)'; }
  else if (jmYn_(p.주소이전) === true) { 장소ok = /현주소/.test(장소) && jmYn_(p.이전확인) !== false; 장소왜 = 장소ok ? '이전한 현주소로(주민등록표 확인) ✔' : '주소를 옮겼는데 ' + (/옛주소/.test(장소) ? '옛 주소로 보냄' : '이전 장소 확인 없이 보냄') + ' — 주민등록표로 확인해 이전 장소로(§10⑤)'; }
  else if (/옛주소|제3의장소/.test(장소)) { 장소ok = false; 장소왜 = 장소 + ' — 명의인의 주소·거소·영업소·사무소가 아님(§8①)'; }
  else if (장소) { 장소ok = true; 장소왜 = 장소 + ' ✔'; } else { 잠정 = true; 장소왜 = '송달된 장소(주소·영업소·신고 장소)를 모름'; }
  if (장소ok === false) 하자.push(장소왜);
  reqs.push(jmReq_('송달 장소(어디로)', 장소ok, 장소왜, '국세기본법 §8①·§9·§10⑤'));

  // 2) 방법
  const 금액 = num(p.고지금액);
  if (/일반우편/.test(방법)) { const ok = !고지서류 || (금액 > 0 && 금액 < 1000000 && /중간예납|부가가치세|신고.*미납|원천/.test(서류)); if (!ok) 하자.push('고지·독촉·강제징수 서류를 일반우편으로 — 등기우편이어야(§10②, 일반우편은 100만원 미만 중간예납·부가세·신고 뒤 미납 고지서만)'); reqs.push(jmReq_('송달 방법 — 일반우편', ok, ok ? '허용 범위(100만원 미만 특정 고지서) 또는 고지·독촉 아닌 서류' : '등기우편 아님', '국세기본법 §10②·시행령 §5의2')); 도달 = jmYmd_(p.수령일); if (!도달 && ok) { 잠정 = true; notes.push('일반우편은 도달한 때 효력 — 받은 날을 모르면 세무서의 발송 기록(§10⑦)과 우편 사정으로 다툼'); } }
  else if (/등기우편|교부/.test(방법)) {
    const 수 = String(p.수령자 || ''), 분별 = jmYn_(p.수령자사리분별), 수령일 = jmYmd_(p.수령일);
    let ok = null, 왜 = '';
    if (/본인/.test(수)) { ok = true; 왜 = '본인 수령 ' + (수령일 || ''); 도달 = 수령일; }
    else if (/동거인|종업원|사용인/.test(수)) { ok = 분별 === false ? false : 분별 === true ? true : null; 왜 = 수 + ' 수령(보충송달) — ' + (분별 === false ? '사리를 판별할 수 없는 사람(어린아이 등) — 송달 안 됨' : 분별 === true ? '사리 판별 가능 ✔ 받은 날 도달' : '사리 판별 가능한지(나이·관계) 확인'); if (ok) 도달 = 수령일; if (ok === null) 잠정 = true; }
    else if (/제3자/.test(수)) { ok = false; 왜 = '동거인·종업원·사용인이 아닌 제3자(이웃·경비실·관리사무소 등)가 받음 — 송달 안 됨(§10④) [확인 필요 — 아파트 경비원 판례 갈림]'; }
    else if (/거부/.test(수)) { if (jmYn_(p.거부정당사유) === true) { ok = false; 왜 = '정당한 사유 있는 수령 거부 — 유치송달 못 함'; } else if (jmYn_(p.유치) === true) { ok = true; 왜 = '정당한 사유 없는 거부 → 송달 장소에 둠(유치송달) ✔ 둔 날 도달'; 도달 = 수령일; } else { ok = false; 왜 = '거부했는데 서류를 두지 않음 — 송달 안 됨'; } }
    else if (/부재/.test(수)) { ok = false; 왜 = '부재로 못 전함(반송) — 송달 안 됨 → 다시 송달하거나 공시송달 요건(시행령 §7의2) 확인'; }
    else { 잠정 = true; 왜 = '누가 언제 받았는지(등기 배달 기록·송달서)'; }
    if (ok === false) 하자.push(왜);
    reqs.push(jmReq_('송달 방법 — ' + 방법 + '(누가 받았나)', ok, 왜, '국세기본법 §10②③④⑥·§12①'));
  } else if (/전자/.test(방법)) {
    const e = p.전자 || {}; const 신청 = jmYn_(e.신청), 저장 = jmYmd_(e.저장일), 열람 = jmYmd_(e.열람일);
    const ok = 신청 === true ? true : 신청 === false ? false : null;
    if (ok === false) 하자.push('전자송달을 신청하지 않았는데 전자로만 보냄 — 신청한 경우만(§10⑧)');
    reqs.push(jmReq_('전자송달 신청', ok, ok ? '신청함 ✔' : ok === false ? '미신청' : '홈택스 전자송달 신청 여부', '국세기본법 §10⑧·시행령 §6의2'));
    if (ok) { 도달 = 저장; reqs.push(jmReq_('도달 = 국세정보통신망에 저장된 때(열람일 아님)', 저장 ? true : null, 저장 ? '저장 ' + 저장 + (열람 ? ' · 열람 ' + 열람 + (열람 > 저장 ? ' — 열람일이 아니라 저장일부터 효력' : '') : '') : '저장일(홈택스 송달 내역)', '국세기본법 §12① 단서')); if (Number(e.연속미열람) >= 3) notes.push('3회 연속 미열람 — 전자송달 신청 철회 간주(§10⑨, 기한 안 전액 납부면 예외) → 그 뒤 서류는 우편·교부'); if (jmYn_(e.장애) === true) notes.push('통신망 장애 — 교부·우편으로 송달 가능(§10⑩)'); }
  } else if (/공시/.test(방법)) {
    const g = p.공시 || {}; const 사유 = String(g.사유 || ''); let 사유ok = null, 왜 = '';
    if (/국외/.test(사유)) { 사유ok = true; 왜 = '주소가 국외이고 송달 곤란(1호)'; }
    else if (/주소불명/.test(사유)) { 사유ok = jmYn_(g.주민등록확인) === true ? true : jmYn_(g.주민등록확인) === false ? false : null; 왜 = 사유ok ? '주민등록표·법인등기부로도 확인 불가(2호·시행령 §7)' : 사유ok === false ? '주민등록표로 주소가 확인되는데 공시송달 — 요건 ✘' : '주민등록표·등기부로 확인했는지'; }
    else if (/반송/.test(사유)) { 사유ok = jmYn_(g.등기반송) === true; 왜 = 사유ok ? '등기우편 수취인 부재 반송으로 납부기한 안 송달 곤란(3호·시행령 §7의2 1호)' : '등기우편 반송 사실 확인'; if (jmYn_(g.등기반송) == null) 사유ok = null; }
    else if (/방문/.test(사유)) { const 회 = Number(g.방문횟수) || 0, f = jmYmd_(g.방문첫날), l = jmYmd_(g.방문끝날); const 간격 = f && l ? jmDays_(f, l) : null; 사유ok = 회 >= 2 && 간격 != null ? 간격 >= 3 : (회 >= 2 ? null : false); 왜 = '공무원 방문 ' + 회 + '회' + (간격 != null ? ', 첫날~끝날 ' + 간격 + '일' : '') + (사유ok ? ' ✔(2회 이상·3일 이상 — 공휴일·주말 뺀 계산은 [확인 필요])' : 사유ok === false ? ' — 2회 이상·3일 이상 간격이어야(시행령 §7의2 2호)' : ' — 날짜 확인'); }
    else { 잠정 = true; 왜 = '공시송달 사유(국외·주소 불명·반송·방문 부재)를 모름'; }
    if (사유ok === false) 하자.push('공시송달 사유 없음 — ' + 왜);
    reqs.push(jmReq_('공시송달 사유', 사유ok, 왜, '국세기본법 §11①·시행령 §7·§7의2'));
    const 방 = (g.공고방법들 || []).map(String); const 망 = 방.some(function (m) { return /통신망/.test(m); }), 다른 = 방.some(function (m) { return !/통신망/.test(m); });
    const 방ok = 방.length ? (망 ? 다른 : true) : null;
    if (방ok === false) 하자.push('국세정보통신망 공고만 — 다른 방법(게시판·홈페이지·관보)과 함께해야(§11② 후단)');
    reqs.push(jmReq_('공고 방법', 방ok, 방.length ? 방.join('·') + (방ok ? ' ✔' : '') : '공고 방법(통신망·게시판·홈페이지·관보)', '국세기본법 §11②'));
    const 공고 = jmYmd_(g.공고일); if (공고) { 도달 = famAddD_(공고, 14); reqs.push(jmReq_('효력 — 공고한 날부터 14일', true, '공고 ' + 공고 + ' → ' + 도달 + ' 송달 간주', '국세기본법 §11①')); } else { 잠정 = true; }
  } else { 잠정 = true; reqs.push(jmReq_('송달 방법', null, '등기우편·일반우편·교부·전자·공시 중 무엇으로 왔는지', '국세기본법 §10①')); }

  // 3) 효력·기한
  const 적법 = 하자.length === 0 && !잠정;
  if (도달 && 적법) {
    const why = []; const e90 = apShift_(famAddD_(도달, 90), hol, why);
    reqs.push(jmReq_('도달 → 효력·불복 기산', true, '도달 ' + 도달 + ' → 불복(이의·심사·심판) 90일 ' + e90 + (today > e90 ? ' 지남' : ' 남음 ' + Math.round(jmDays_(today, e90)) + '일') + ' — 「불복기한」 묶음에 받은 날로 넣기', '국세기본법 §12①·§61①'));
    const 제척 = jmYmd_(p.제척기간만료일); if (제척) reqs.push(jmReq_('제척기간 안 도달', 도달 <= 제척, '도달 ' + 도달 + (도달 <= 제척 ? ' ≤ ' : ' > ') + '만료 ' + 제척 + (도달 > 제척 ? ' — 제척기간 지난 뒤 송달된 고지 = 무효 주장' : ''), '국세기본법 §26의2 [확인 필요 — 판례: 고지서가 제척기간 안에 도달해야]'));
    const 납 = jmYmd_(p.납부기한); if (납 && jmDays_(도달, 납) < 14) notes.push('도달일부터 납부기한까지 ' + Math.round(jmDays_(도달, 납)) + '일 — 송달 지연으로 14일이 안 되면 납부기한이 도달일부터 14일 지난 날로 연장(국세징수법 §17 [확인 필요 — 원문은 국세징수법])');
  } else if (하자.length) {
    reqs.push(jmReq_('송달 효력', false, '송달 하자 ' + 하자.length + '건 — 서류가 적법하게 도달하지 않아 처분(고지)의 효력이 생기지 않았다고 다툴 수 있음: 불복 90일도 시작되지 않음, 제척기간 안 적법 송달이 없으면 부과 무효 [확인 필요 — 판례]', '국세기본법 §12①·§61①'));
    할일.push({ 무엇: '송달 하자 증빙(등기 배달 기록·송달서·주민등록초본·공고 기록) 확보 → 처분 무효·취소 주장 또는 재송달 요구', 때: '지금', 근거: '국세기본법 §8~§12' });
  } else { 잠정 = true; }
  notes.push('실제로 받아 본 날이 있으면 그날부터 90일(안 날 기준) — 하자를 다투면서도 기한은 지키는 것이 안전');

  // 4) 경우
  경우.push({ 이름: '① 법대로 — ' + (적법 ? '적법 송달, 도달 ' + 도달 : 하자.length ? '송달 하자 ' + 하자.length + '건(효력·기한 다툼)' : '확인 중'), 줄: 하자.length ? 하자 : ['도달일 기준으로 납부기한·불복 90일'] });
  if (/제3자|옛주소/.test(String(p.수령자) + 장소)) 경우.push({ 이름: '② [견주기] 이웃·경비실·옛 주소에 간 날을 받은 날로 보고 90일을 셈', 줄: ['송달 안 됨 — 실제 안 날 또는 재송달일부터'] });
  if (/공시/.test(방법)) 경우.push({ 이름: '③ [견주기] 공시송달은 「공고 14일」만 보고 사유·공고 방법을 안 따짐', 줄: ['사유(반송·2회 방문·주소 불명 확인)와 공고 방법(통신망 + 다른 방법)이 없으면 송달 간주 없음'] });
  if (/전자/.test(방법)) 경우.push({ 이름: '④ [견주기] 열람한 날부터 90일로 셈', 줄: ['저장된 때 도달(§12① 단서) — 열람이 늦으면 기한이 줄어듦'] });

  const w = jmWrap_('송달', reqs, { 하자: 하자, 도달일: 도달, 적법: 적법, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = 적법 ? '적법 송달 — 도달 ' + 도달 : 하자.length ? '송달 하자 ' + 하자.length + '건 — ' + 하자[0].slice(0, 40) + '…' : '확인 남음 — 잠정';
  w.표시 = '송달 ' + w.결론;
  return w;
}

// [2026.11.05 모의사건 167] 공동사업(동업)에 부동산을 현물출자·탈퇴 — 출자가 양도인지(전부인지 남의 지분만인지), 양도가액·시기, 특수관계 조합원과 저가 출자, 탈퇴 정산금
//  근거 원문(2026.11.05 업무관리자\법령 읽기용 판 — 소득세법 20260701·시행령 20261001 시행판):
//   소득세법 §88 1호(「양도」 = 등기·등록과 관계없이 매도, 교환, 법인에 대한 현물출자 등을 통하여 자산을 유상으로 사실상 이전) — 공동사업(민법상 조합)에 대한 현물출자는 「등」에 들어가 양도 [확인 필요 — 판례: 조합원이 부동산을 조합에 출자하면 조합원 전원의 합유가 되어 전체가 양도(자기 지분 상당분을 빼지 않음) — 판례 번호 원문 시스템에 없음]
//   §96①(양도가액 = 실지거래가액 — 출자 때 평가한 가액[출자가액]) · §101①·시행령 §167③④(특수관계인에게 시가보다 낮게 → 시가로) · 시행령 §162①1호·2호(대금 청산 전 등기면 등기접수일) · §43①②(공동사업장을 1거주자로 보아 소득 계산, 손익분배비율로 분배) ③(특수관계인 거짓 분배비율이면 주된 공동사업자 소득)
//   §94①1호(부동산 양도) — 탈퇴하며 정산금을 받으면 조합 재산(부동산) 지분의 유상 이전 → 양도 [확인 필요 — 판례]
//  놓치던 것: ① 「내 땅을 내가 하는 동업에 넣은 것」이라 양도가 아니라고 보거나 ② 자기 지분만큼은 빼고 남의 지분만 양도로 봄 ③ 출자가액을 장부가(취득가)로 적어 차익 0으로 ④ 특수관계 조합원에게 유리한 저가 출자(부당행위·증여) ⑤ 탈퇴 정산금을 그냥 돌려받은 돈으로 봄 ⑥ 분양·매매 목적 조합이면 사업소득(종합)
//  p: { 출자:{ 출자일, 등기접수일, 자산(토지|건물|주택|기타), 출자가액(조합이 평가한 가액), 시가(감정·매매사례), 취득가액, 취득일, 본인지분율(0~1), 다른조합원특수관계(예|아니오), 출자공동사업자(예|아니오) },
//       조합:{ 사업(부동산임대|분양|매매|건설|기타), 사업자등록(예) }, 탈퇴:{ 탈퇴일, 정산금, 조합부동산시가, 탈퇴시지분율, 출자시가(조합 지분 취득가액 근거) }, 엔진칸{…} }
function judgePartnershipContribution_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const o = p.출자 || {}, j = p.조합 || {}, t = p.탈퇴 || {};
  const 출자가액 = num(o.출자가액), 시가 = num(o.시가), 취득가액 = num(o.취득가액), 지분 = Number(o.본인지분율) || 0, 특수 = jmYn_(o.다른조합원특수관계);
  const 양도일 = jmYmd_(o.등기접수일) || jmYmd_(o.출자일);
  const 사업 = String(j.사업 || '');
  let 잠정 = false;

  // 1) 출자 = 양도(전부)
  if (출자가액 || 시가 || 취득가액) {
    reqs.push(jmReq_('공동사업 현물출자는 양도(전부)', true, '조합에 출자하면 조합원 전원의 합유 재산이 되어 유상 이전 — 자기 지분 ' + (지분 ? Math.round(지분 * 100) + '%' : '') + '만큼을 빼지 않고 전체가 양도', '소득세법 §88 1호(「법인에 대한 현물출자 등」) [확인 필요 — 판례 원문 없음, 권장: 전부 양도]'));
    let 양도가액 = 출자가액 || 시가;
    if (시가 > 0 && 출자가액 > 0 && 출자가액 < 시가) {
      const 차 = 시가 - 출자가액;
      if (특수 === true && (차 >= 300000000 || 차 >= 시가 * 0.05)) { 양도가액 = 시가; reqs.push(jmReq_('특수관계 조합원 — 저가 출자 부당행위', false, '출자가액 ' + won(출자가액) + ' < 시가 ' + won(시가) + '(차 ' + won(차) + ', 3억 또는 5% 이상) → 양도가액을 시가로', '소득세법 §101①·시행령 §167③④')); notes.push('싸게 넣어 다른 조합원(특수관계) 지분 가치가 오른 몫은 증여(상증법 §35·§42의3 검토)'); }
      else if (특수 === true) reqs.push(jmReq_('특수관계 조합원 — 저가 출자 부당행위', true, '차 ' + won(차) + ' — 3억·5% 안', '시행령 §167③ 단서'));
      else if (특수 == null) { 잠정 = true; reqs.push(jmReq_('다른 조합원과 특수관계인지', null, '가족·친족이면 저가 출자가 부당행위·증여 문제', '소득세법 §101·상증법 §35')); }
      else notes.push('남과의 동업 — 출자가액이 시가보다 낮아도 정당한 사유가 있으면 그대로(§35② 30%·3억 기준은 별도)');
    }
    reqs.push(jmReq_('양도가액 = 출자 평가액(시가)', 양도가액 ? true : null, 양도가액 ? won(양도가액) + (출자가액 && 양도가액 === 출자가액 ? ' (조합 출자가액)' : ' (시가)') + (취득가액 ? ' · 취득가액 ' + won(취득가액) + ' → 차익 ' + won(양도가액 - 취득가액) : '') : '출자가액(조합 계약서·감정)·시가', '소득세법 §96①'));
    if (!양도가액) 잠정 = true;
    reqs.push(jmReq_('양도시기', 양도일 ? true : null, 양도일 ? (jmYmd_(o.등기접수일) ? '합유 등기 접수일 ' + 양도일 : '출자일 ' + 양도일 + ' (등기 전이면 등기접수일 [확인 필요])') : '출자일·등기접수일', '소득세법 §98·시행령 §162①1·2호'));
    if (/분양|매매|건설/.test(사업)) notes.push('분양·매매·건설 목적 조합 — 조합이 파는 소득은 사업소득(§43 공동사업장 1거주자, 손익분배비율로 분배) · 출자 자체는 양도소득');
    else notes.push('임대 등 조합 — 조합 소득은 공동사업장 단위로 계산해 손익분배비율로 나눔(§43), 특수관계인 거짓 비율이면 주된 공동사업자 소득(③)');
    if (jmYn_(o.출자공동사업자) === true) notes.push('경영에 참여하지 않는 출자공동사업자 — 분배받는 소득은 배당소득(§17①8호)');
    notes.push('조합 지분(합유 지분)의 취득가액 = 출자 때 양도가액 ' + won(양도가액) + ' — 탈퇴·지분 양도 때 씀 [확인 필요]');
    if (양도일) { const y = +양도일.slice(0, 4), m = +양도일.slice(5, 7); 할일.push({ 무엇: '현물출자 양도소득세 예정신고(양도가액 = 출자 평가액)', 때: new Date(Date.UTC(y, m + 2, 0)).toISOString().slice(0, 10) + '까지', 근거: '소득세법 §105①1호' }); }
    할일.push({ 무엇: '동업계약서(출자가액·지분·손익분배비율)·감정서·합유 등기 자료 모으기', 때: '신고 전', 근거: '§96·§43' });
    const base = Object.assign({ assetType: /주택/.test(String(o.자산)) ? 'house' : /토지/.test(String(o.자산)) ? 'land' : 'other', acquisitionPrice: 취득가액 || undefined, acquisitionDate: jmYmd_(o.취득일) || undefined, transferDate: 양도일 || undefined }, p.엔진칸 || {});
    if (양도가액 && 취득가액) {
      경우.push({ 이름: '① 법대로 — 전체 양도, 양도가액 ' + won(양도가액), 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 양도가액 }) });
      경우.push({ 이름: '② [견주기] 출자는 양도 아니라고 봄 — 0 (무신고)', 세액: 0, 줄: ['§88 1호 현물출자 등 = 유상 이전'] });
      if (지분 > 0 && 지분 < 1) 경우.push({ 이름: '③ [견주기] 자기 지분 ' + Math.round(지분 * 100) + '% 빼고 남의 지분만 양도 — ' + won(Math.round(양도가액 * (1 - 지분))), 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: Math.round(양도가액 * (1 - 지분)), acquisitionPrice: Math.round(취득가액 * (1 - 지분)) }) });
      if (출자가액 && 출자가액 < 양도가액) 경우.push({ 이름: '④ [견주기] 출자가액(장부가) ' + won(출자가액) + '으로 — 시가 아님', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { transferPrice: 출자가액 }) });
    }
  }

  // 2) 탈퇴 — 정산금
  const 정산 = num(t.정산금);
  if (정산 || jmYmd_(t.탈퇴일)) {
    const 취득 = num(t.출자시가) || 출자가액 || 시가, 탈지분 = Number(t.탈퇴시지분율) || 지분;
    const 지분취득 = 취득 && 탈지분 ? Math.round(취득 * 탈지분) : 0;
    reqs.push(jmReq_('탈퇴 정산금 = 조합 지분(부동산 지분) 양도', 정산 ? true : null, 정산 ? '정산금 ' + won(정산) + (지분취득 ? ' − 지분 취득가액 ' + won(지분취득) + '(출자 시가 × 지분 ' + Math.round(탈지분 * 100) + '% [확인 필요]) = 차익 ' + won(정산 - 지분취득) : '') : '정산금·탈퇴일', '소득세법 §88 1호·§94①1호 [확인 필요 — 판례: 탈퇴 정산은 지분 양도]'));
    if (num(t.조합부동산시가) && 탈지분 && 정산 < Math.round(num(t.조합부동산시가) * 탈지분)) notes.push('정산금 ' + won(정산) + '이 지분 시가 ' + won(Math.round(num(t.조합부동산시가) * 탈지분)) + '보다 적음 — 남은 조합원이 특수관계면 저가 양도 부당행위·증여(§35) 검토');
    if (정산 && 지분취득) 경우.push({ 이름: '⑤ 탈퇴 — 지분 양도, 양도가액 ' + won(정산) + ' · 취득가액 ' + won(지분취득), 엔진: 'calculate_transfer_tax', 엔진칸: { assetType: /주택/.test(String(o.자산)) ? 'house' : 'land', transferPrice: 정산, acquisitionPrice: 지분취득, acquisitionDate: 양도일 || undefined, transferDate: jmYmd_(t.탈퇴일) || undefined } });
    if (jmYmd_(t.탈퇴일)) { const d = jmYmd_(t.탈퇴일); 할일.push({ 무엇: '탈퇴 지분 양도소득세 예정신고', 때: new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) + 2, 0)).toISOString().slice(0, 10) + '까지', 근거: '소득세법 §105①1호' }); }
  }
  if (!reqs.length) { 잠정 = true; reqs.push(jmReq_('출자·탈퇴 사실', null, '출자가액·시가·취득가액·지분, 탈퇴 정산금을 모름', '소득세법 §88')); }

  const w = jmWrap_('공동사업출자', reqs, { 양도가액: 출자가액 || 시가, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = (출자가액 || 시가 ? '현물출자 = 전체 양도(양도가액 ' + won(reqs.some(function (r) { return /부당행위/.test(r.이름) && r.결과 === '✘'; }) ? 시가 : (출자가액 || 시가)) + ')' : '') + (정산 ? (출자가액 || 시가 ? ' · ' : '') + '탈퇴 정산 ' + won(정산) + ' 지분 양도' : '') + (w.잠정 ? ' — 잠정' : '') || '가르지 못함 — 잠정';
  w.표시 = '공동사업출자 ' + w.결론;
  return w;
}

// [2026.11.05 모의사건 166] 전환사채등의 인수·전환·양도 이익 증여(상증법 §40) — 누가 어떤 길로 얻은 이익인지(가·나·다·라목·3호), 공모 발행 제외, 증여일, 산식·기준금액, 엔진으로 넘기기
//  근거 원문(2026.11.05 업무관리자\법령 읽기용 판 — 상증법 20260102·시행령 20261001·시행규칙 20260320 시행판):
//   §40①1호(인수·취득일의 이익: 가 특수관계인에게서 시가보다 낮게 취득 / 나 발행법인(상장법인 공모 발행은 제외)의 최대주주·그 특수관계인 주주가 균등 배정 수를 초과해 저가 인수등 / 다 최대주주의 특수관계인(주주 아님)이 법인에서 저가 인수등)
//   §40①2호(주식전환등을 한 날의 이익: 가 특수관계인에게서 취득한 자의 교부주식가액 > 전환가액 / 나 최대주주등 초과 인수분 / 다 비주주 특수관계인 인수분 / 라 교부주식가액 < 전환가액이라 주식 받은 자의 특수관계인이 얻은 이익) · 3호(특수관계인에게 시가보다 비싸게 양도한 양도인 이익)
//   시행령 §30①(1호 이익 = 시가 − 인수·취득가액 / 2호 = (교부주식가액 − 전환가액) × 주식수 − 이자손실분 − 1호 이익, 양도했으면 양도가액 − 취득가액 한도 / 3호(라목) = (전환가액 − 교부주식가액) × 증가 주식수 × 특수관계인 지분율 / 4호 = 양도가액 − 시가)
//   ②(기준금액: 1호·4호 min(시가 30%, 1억) / 2호 1억 / 3호(라목) 0원) ③(최대주주 = 최대주주등 중 보유 주식 가장 많은 1인) ④(공모 = 자본시장법 시행령 §11③) ⑤(교부주식가액 = [(전환 전 1주 평가액 × 전환 전 주식수) + (전환가액 × 증가 주식수)] ÷ 합계, 상장법인은 전환 후 평가액이 더 낮으면 그 가액(라목은 높으면)) · 시행규칙 §10의2(이자손실분 = 만기상환금액을 발행이율로 할인한 현재가치 − 적정 이자율로 할인한 현재가치) · 상증법 §43②(1년 안 같은 거래 합산)
//  놓치던 것: ① 계산기는 네 갈래 숫자만 세고 「누가·어느 목」을 안 가름 — 균등 배정 몫(나목)은 빼야 하는데 전부 과세하거나, 공모 발행 상장사 전환사채를 나·다목으로 과세 ② 전환 이익에서 이자손실분·앞서 과세된 인수 이익을 안 뺌 ③ 기준금액이 갈래마다 다름(1억·30%·0) ④ 증여일이 인수일·전환일·양도일로 갈림 — 신고기한·합산 기준 ⑤ 5년 안 상장이면 §41의3 정산
//  p: { 단계(인수|전환|양도|역방향), 법인:{ 상장(예|아니오), 공모발행(예|아니오), 발행주식총수 }, 당사자:{ 이름, 지위(최대주주|최대주주특수관계주주|최대주주특수관계비주주|남), 보유주식수, 취득처(법인|인수인|특수관계인|시장) },
//       전환사채:{ 총액면(원), 취득가액(총), 시가(총), 인수일, 균등배정가능액(원 — 지분 비율대로 배정받을 수 있는 액), 만기상환금액, 발행이율(소수), 만기까지년 },
//       전환:{ 전환일, 전환가액(1주), 교부주식수, 전환전1주평가액, 전환후1주평가액(상장), 이자손실분(직접), 앞서과세된인수이익, 사채양도(예), 사채양도가액 }, 역방향:{ 특수관계인지분율 }, 양도:{ 양도일, 양도가액, 양수인특수관계(예|아니오) }, 직전1년이익들:[원], 관계(증여세 계산용) }
function judgeConvertibleBond_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 단계 = String(p.단계 || '인수'), 법인 = p.법인 || {}, 자 = p.당사자 || {}, cb = p.전환사채 || {}, cv = p.전환 || {}, 양 = p.양도 || {};
  const 상장 = jmYn_(법인.상장), 공모 = jmYn_(법인.공모발행), 지위 = String(자.지위 || ''), 취득처 = String(자.취득처 || '');
  const 합산 = (p.직전1년이익들 || []).reduce(function (t, v) { return t + num(v); }, 0);
  let 잠정 = false, 목 = '', 이익 = 0, 기준 = 0, 증여일 = null, 엔진칸 = null;

  // 1) 누가 어느 목인가
  const 최대측 = /최대주주/.test(지위), 주주 = /주주$/.test(지위) && !/비주주/.test(지위) || 지위 === '최대주주';
  const 공모제외 = 상장 === true && 공모 === true;
  if (/인수/.test(단계)) {
    if (/특수관계인/.test(취득처)) 목 = '1호 가목(특수관계인에게서 저가 취득)';
    else if (/법인|인수인/.test(취득처) && 최대측 && !공모제외) 목 = /비주주/.test(지위) ? '1호 다목(최대주주의 특수관계인·비주주가 법인에서 저가 인수등)' : '1호 나목(최대주주·특수관계 주주의 균등 배정 초과 저가 인수등)';
    else if (공모제외 && 최대측) 목 = '제외(상장법인 공모 발행 — 나·다목 적용 없음)';
    else if (/남/.test(지위) || /시장/.test(취득처)) 목 = '해당 없음(특수관계 없는 취득)';
    else { 잠정 = true; 목 = ''; }
  } else if (/전환/.test(단계)) {
    if (/특수관계인/.test(취득처)) 목 = '2호 가목';
    else if (최대측 && !공모제외) 목 = /비주주/.test(지위) ? '2호 다목' : '2호 나목(초과 인수분)';
    else if (공모제외 && 최대측) 목 = '제외(공모 발행)';
    else if (/남|시장/.test(지위 + 취득처)) 목 = '해당 없음';
    else { 잠정 = true; }
  } else if (/역방향/.test(단계)) 목 = '2호 라목(교부주식가액 < 전환가액 — 주식 받은 자의 특수관계인 이익)';
  else if (/양도/.test(단계)) 목 = jmYn_(양.양수인특수관계) === true ? '3호(특수관계인에게 고가 양도)' : jmYn_(양.양수인특수관계) === false ? '해당 없음(특수관계 아닌 양수인)' : '';
  if (!목) 잠정 = true;
  reqs.push(jmReq_('어느 목인가(누가·어디서)', 목 ? !/해당 없음|제외/.test(목) : null, 목 || '당사자 지위(최대주주·그 특수관계인 주주·비주주 특수관계인·남)와 취득처(법인·인수인·특수관계인·시장)를 모름', '상증법 §40①·시행령 §30③④'));
  if (/제외|해당 없음/.test(목)) { const w0 = jmWrap_('전환사채', reqs, { 목: 목, 이익: 0, 경우: [], 알림: ['§40 밖 — 다만 특수관계인 간 시가와 다른 거래는 §35(저가·고가 양수도)·§42의3(재산가치 증가)로 따로 볼 것'], 할일: [] }); w0.결론 = 목; w0.표시 = '전환사채 ' + 목; return w0; }

  // 2) 이익·기준금액·증여일
  const 시가 = num(cb.시가), 취득 = num(cb.취득가액);
  if (/인수/.test(단계)) {
    let base = Math.max(0, 시가 - 취득);
    if (/나목/.test(목)) { const 균등 = num(cb.균등배정가능액); if (취득 > 0 && 균등 > 0 && 균등 < 취득) { base = Math.round(base * (취득 - 균등) / 취득); notes.push('나목은 균등 배정 몫 ' + won(균등) + '을 넘는 부분만 — 초과 비율 ' + Math.round((취득 - 균등) / 취득 * 100) + '%로 이익을 안분 [확인 필요 — 권장: 초과 인수분에 해당하는 이익]'); } else if (!균등) { 잠정 = true; notes.push('균등 배정 가능액(지분 비율 × 발행액)을 몰라 초과분을 못 가름'); } }
    이익 = base; 기준 = Math.min(Math.round(시가 * 0.3), 100000000); 증여일 = jmYmd_(cb.인수일);
    reqs.push(jmReq_('이익 = 전환사채등 시가 − 인수·취득가액', 시가 && 취득 ? true : null, 시가 && 취득 ? won(시가) + ' − ' + won(취득) + (/나목/.test(목) ? ' → 초과분 ' : ' = ') + won(이익) : '시가(상증법 §63 평가·시행령 §58의2 전환사채 평가)·취득가액', '시행령 §30①1호'));
    엔진칸 = { caseType: 'acquisition', fairValue: 시가, acquisitionCost: /나목/.test(목) && 이익 < 시가 - 취득 ? 시가 - 이익 : 취득 };
  } else if (/전환/.test(단계)) {
    const 전가 = num(cv.전환가액), 주 = num(cv.교부주식수), 전평 = num(cv.전환전1주평가액), 총주 = num(법인.발행주식총수), 후평 = num(cv.전환후1주평가액);
    let 교부가 = 전평 && 총주 && 주 ? (전평 * 총주 + 전가 * 주) / (총주 + 주) : 0;
    if (상장 === true && 후평 > 0 && 후평 < 교부가) 교부가 = 후평;
    let 이자손실 = num(cv.이자손실분);
    if (!이자손실 && num(cb.만기상환금액) && Number(cb.발행이율) >= 0 && Number(cb.만기까지년) > 0) { const M = num(cb.만기상환금액), r1 = Number(cb.발행이율), r2 = 0.08, t = Number(cb.만기까지년); 이자손실 = Math.max(0, Math.round(M / Math.pow(1 + r1, t) - M / Math.pow(1 + r2, t))); notes.push('이자손실분 ' + won(이자손실) + ' = 만기상환금액을 발행이율 ' + Math.round(r1 * 1000) / 10 + '%로 할인한 값 − 적정 이자율(시행령 §58의2②1호 가목 — 8%로 가정 [확인 필요])로 할인한 값(시행규칙 §10의2)'); }
    const 앞 = num(cv.앞서과세된인수이익);
    let raw = Math.round((교부가 - 전가) * 주) - 이자손실 - 앞;
    if (jmYn_(cv.사채양도) === true) { const cap = Math.max(0, num(cv.사채양도가액) - 취득); if (raw > cap) { notes.push('사채를 양도한 경우 — 이익은 양도가액 − 취득가액 ' + won(cap) + '을 넘지 못함(§30①2호 단서)'); raw = cap; } }
    이익 = Math.max(0, raw); 기준 = 100000000; 증여일 = jmYmd_(cv.전환일);
    if (!교부가) 잠정 = true;
    reqs.push(jmReq_('이익 = (교부주식가액 − 전환가액) × 주식수 − 이자손실분 − 앞서 과세된 인수 이익', 교부가 ? true : null, 교부가 ? '교부주식가액 1주 ' + won(Math.round(교부가)) + (상장 === true && 후평 ? '(상장 — 전환 후 평가액 ' + won(후평) + '과 견줘 낮은 쪽)' : '') + ' − 전환가액 ' + won(전가) + ' × ' + 주 + '주 − 이자손실 ' + won(이자손실) + ' − 앞서 과세 ' + won(앞) + ' = ' + won(이익) : '전환 전 1주 평가액·발행주식총수·전환가액·교부 주식수', '시행령 §30①2호·⑤1호'));
    엔진칸 = { caseType: 'conversion', preConversionValuePerShare: 전평, preConversionShares: 총주, conversionPricePerShare: 전가, increasedShares: 주, interestLossAmount: 이자손실 || undefined, priorAcquisitionGiftAmount: 앞 || undefined, listedPostConversionValuePerShare: 상장 === true && 후평 ? 후평 : undefined, isBondTransferred: jmYn_(cv.사채양도) === true || undefined, bondTransferPrice: num(cv.사채양도가액) || undefined, bondAcquisitionCost: jmYn_(cv.사채양도) === true ? 취득 : undefined };
  } else if (/역방향/.test(단계)) {
    const 전가 = num(cv.전환가액), 주 = num(cv.교부주식수), 전평 = num(cv.전환전1주평가액), 총주 = num(법인.발행주식총수), 후평 = num(cv.전환후1주평가액), 지분 = Number((p.역방향 || {}).특수관계인지분율) || 0;
    let 교부가 = 전평 && 총주 && 주 ? (전평 * 총주 + 전가 * 주) / (총주 + 주) : 0; if (상장 === true && 후평 > 교부가 && 후평) 교부가 = 후평;
    이익 = Math.max(0, Math.round((전가 - 교부가) * 주 * 지분)); 기준 = 0; 증여일 = jmYmd_(cv.전환일);
    if (!교부가 || !지분) 잠정 = true;
    reqs.push(jmReq_('이익 = (전환가액 − 교부주식가액) × 증가 주식수 × 특수관계인 지분율', 교부가 && 지분 ? true : null, 교부가 && 지분 ? '(' + won(전가) + ' − ' + won(Math.round(교부가)) + ') × ' + 주 + ' × ' + Math.round(지분 * 100) + '% = ' + won(이익) + ' — 기준금액 0원(전액)' : '전환 전 평가액·주식수·특수관계인 지분율', '시행령 §30①3호·②3호'));
    엔진칸 = { caseType: 'conversion_reverse', preConversionValuePerShare: 전평, preConversionShares: 총주, conversionPricePerShare: 전가, increasedShares: 주, relatedPriorOwnershipRatio: 지분, listedPostConversionValuePerShare: 상장 === true && 후평 ? 후평 : undefined };
  } else if (/양도/.test(단계)) {
    const 가 = num(양.양도가액); 이익 = Math.max(0, 가 - 시가); 기준 = Math.min(Math.round(시가 * 0.3), 100000000); 증여일 = jmYmd_(양.양도일);
    reqs.push(jmReq_('이익 = 양도가액 − 시가(양도인이 얻음)', 가 && 시가 ? true : null, 가 && 시가 ? won(가) + ' − ' + won(시가) + ' = ' + won(이익) : '양도가액·시가', '시행령 §30①4호'));
    if (!가 || !시가) 잠정 = true;
    엔진칸 = { caseType: 'transfer', fairValue: 시가, transferPrice: 가 };
  }
  const 합이익 = 이익 + 합산, 과세 = 이익 > 0 ? 합이익 >= 기준 : false;
  if (이익 > 0) reqs.push(jmReq_('기준금액(' + (기준 === 0 ? '0원 — 전액' : won(기준) + (/인수|양도/.test(단계) ? ' = min(시가 30%, 1억)' : ' = 1억')) + ')', 과세, (합산 ? '1년 안 같은 거래 ' + won(합산) + ' 합산 → ' : '') + won(합이익) + (과세 ? ' ≥ 기준 → 전액 ' + won(합이익) + ' 과세(넘는 부분만이 아님)' : ' < 기준 → 과세 없음'), '시행령 §30②·상증법 §43②'));
  if (증여일) { const d = 증여일; const last = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) + 3, 0)).toISOString().slice(0, 10); notes.push('증여일 = ' + (/인수/.test(단계) ? '인수·취득일' : /양도/.test(단계) ? '양도일' : '주식전환등을 한 날') + ' ' + d + ' → 신고 ' + last + '까지(§68①)'); if (과세) 할일.push({ 무엇: '증여세 신고(§40 이익 ' + won(합이익) + ')', 때: last + '까지', 근거: '상증법 §68①' }); }
  else { 잠정 = true; notes.push('증여일(인수일·전환일·양도일)을 모름'); }
  notes.push('§40 증여는 증여자 연대납세 없음(§4의2⑥ 단서) · 전환으로 받은 주식의 취득가액은 전환가액 + 과세된 증여이익 [확인 필요 — 소득세법 시행령 §163⑩] · 전환사채등으로 받은 주식이 5년 안에 상장되면 §41의3 상장이익 정산(「상장이익」 묶음)');
  if (/전환/.test(단계) && 상장 !== true) notes.push('비상장 — 전환 전 1주 평가액은 상증법 §63·§54 보충 평가(「비상장평가」 묶음)로');

  // 3) 경우
  if (이익 > 0 && 엔진칸) {
    경우.push({ 이름: '① 법대로 — ' + 목 + ' 이익 ' + won(이익) + (합산 ? ' + 1년 합산 ' + won(합산) : '') + (과세 ? ' → 과세' : ' → 기준 미달'), 엔진: 'calculate_convertible_bond_gift_tax', 엔진칸: Object.assign({}, 엔진칸, p.엔진칸 || {}) });
    if (/나목/.test(목) && num(cb.균등배정가능액)) 경우.push({ 이름: '② [견주기] 균등 배정 몫까지 전부 과세 — ' + won(Math.max(0, 시가 - 취득)), 엔진: 'calculate_convertible_bond_gift_tax', 엔진칸: { caseType: 'acquisition', fairValue: 시가, acquisitionCost: 취득 } });
    if (/전환/.test(단계) && (num(cv.이자손실분) || num(cb.만기상환금액))) 경우.push({ 이름: '③ [견주기] 이자손실분·앞서 과세분을 안 뺌', 엔진: 'calculate_convertible_bond_gift_tax', 엔진칸: Object.assign({}, 엔진칸, { interestLossAmount: 0, priorAcquisitionGiftAmount: 0 }) });
    if (과세 && 기준 > 0) 경우.push({ 이름: '④ [견주기] 기준금액 넘는 부분만 과세로 잘못 — ' + won(Math.max(0, 합이익 - 기준)), 줄: ['단서는 미만이면 제외·이상이면 전액'] });
  }

  const w = jmWrap_('전환사채', reqs, { 목: 목, 이익: 이익, 직전1년합산: 합산, 기준금액: 기준, 과세: 과세, 증여일: 증여일, 엔진칸: 엔진칸, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = 목 + (이익 ? ' — 이익 ' + won(이익) + (과세 ? ' 과세' : ' 기준 미달') : ' — 이익 없음·미정') + (w.잠정 ? ' — 잠정' : '');
  w.표시 = '전환사채 ' + w.결론;
  return w;
}

// [2026.11.05 모의사건 165] 우리사주조합원 주식(조특법 §88의4) — 출자 소득공제, 법인 출연 배정 한도, 인출 때 근로소득(보유기간 비과세), 팔 때 취득가액, 배당 비과세
//  근거 원문(2026.11.05 업무관리자\법령 읽기용 판 — 조특법 20260918 시행판·시행령):
//   §88의4①(출자금과 400만원(벤처기업등 1,500만원) 중 적은 금액 근로소득 공제) ③(조합 통해 배정받는 때 과세 없음) ④(법인 출연분이 대통령령 한도 초과하면 그 부분 과세 — 시행령 §82의4②: 매입가액등 기준 연간 직전연도 총급여 20%, 500만원 이하면 500만원 · ③ 초과 매입가액등 = 근로소득)
//   ⑤(인출하는 우리사주 중 과세인출주식(제외: 1호 공제 안 받은 출자분 2호 ④ 과세분 3호 무상주)의 인출금 = 근로소득, 수입시기 인출일, 회사가 기본세율로 원천징수 — 시행령 §82의4④ 인출금 = min(매입가액등, 인출일 시가), 파산이면 0 · ⑤ 먼저 배정된 주식 먼저 인출)
//   ⑥(보유기간(의무예탁 종료일 다음 날부터 인출일) 비과세: 중소기업 2~4년 50%·4~6년 75%·6년 이상 100% / 그 밖 2~4년 50%·4년 이상 75%) ⑦(출연금을 주식 취득에 안 쓰고 인출하면 인출금에 포함)
//   ⑧(출자 400만원 이하 취득분은 시가 차액 과세 없음, 초과분 취득가액이 기준가액(시행령 ⑨ 취득일 시가 70%, 우선배정 소액주주는 70%와 액면 중 낮은 것)보다 낮으면 차액 근로소득) ⑨(예탁 우리사주 배당 비과세: 예탁 확인·소액주주·액면 합계 1,800만원 이하, 예탁 1년 안 인출이면 배당 과세)
//   시행령 §82의4①1호(시가 = 상증법 §63①② 준용, 전 1개월) 2호(매입가액등 = 조합의 실지 취득가액, 법인·주주 출연·시가 70% 미만 취득분은 시가 70%) ⑧(과세받은 우리사주를 팔 때 취득가액 = 매입가액등)
//  놓치던 것: ① 인출금을 인출일 시가 전부로 셈(매입가액등과 시가 중 적은 것) ② 보유기간 비과세(50·75·100%)를 안 씀, 보유기간을 배정일부터 셈(의무예탁 종료일 다음 날부터) ③ 공제 안 받은 출자분·무상주·한도 초과 과세분은 인출 때 또 과세 안 함 ④ 팔 때 취득가액을 인출일 시가로 잘못(매입가액등) ⑤ 법인 출연 배정 한도(총급여 20%·500만)
//  p: { 중소기업(예|아니오), 벤처등(예|아니오), 전년총급여, 출자들:[{ 연도, 출자금액, 소득공제받음(예|아니오) }],
//       배정들:[{ 이름, 주수, 매입가액등(1주), 취득시가(1주), 출처(조합원출자|법인출연|무상주|시장매입), 배정일, 의무예탁종료일, 공제안받은출자분(예) }],
//       인출:{ 인출일, 주수, 인출일시가(1주), 파산(예) }, 양도:{ 양도일, 양도가액(총), 상장(예|아니오), 장내(예|아니오), 대주주(예|아니오) }, 배당:{ 금액, 예탁일, 액면합계, 소액주주(예|아니오) } }
function judgeEsop_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 중소 = jmYn_(p.중소기업), 벤처 = jmYn_(p.벤처등) === true, 한도출자 = 벤처 ? 15000000 : 4000000;
  let 잠정 = false;

  // 1) 출자 소득공제
  let 공제합 = 0, 비공제출자 = 0;
  (p.출자들 || []).forEach(function (x) { const a = num(x.출자금액); const d = Math.min(a, 한도출자); if (jmYn_(x.소득공제받음) === false) 비공제출자 += a; else { 공제합 += d; 비공제출자 += Math.max(0, a - d); } });
  if ((p.출자들 || []).length) reqs.push(jmReq_('출자금 소득공제(연 ' + won(한도출자) + ' 한도)', true, '공제 ' + won(공제합) + (비공제출자 ? ' · 공제 안 받은(못 받은) 출자 ' + won(비공제출자) + ' — 이 돈으로 산 주식은 인출 때 과세 제외' : ''), '조특법 §88의4①·⑤1호'));

  // 2) 배정 — 법인 출연 한도·시가 70% 기준가액
  const 급여 = num(p.전년총급여), 출연한도 = Math.max(5000000, Math.round(급여 * 0.2));
  let 과세배정 = 0, 배정표 = [];
  (p.배정들 || []).forEach(function (b, i) {
    const 이름 = b.이름 || ('배정' + (i + 1)), 주 = num(b.주수), 매입 = num(b.매입가액등), 시가 = num(b.취득시가), 출처 = String(b.출처 || '조합원출자');
    let 제외 = false, 왜 = '';
    if (/무상주/.test(출처)) { 제외 = true; 왜 = '잉여금 자본전입 무상주 — 인출 때 과세 제외(⑤3호)'; }
    else if (jmYn_(b.공제안받은출자분) === true) { 제외 = true; 왜 = '소득공제 안 받은 출자로 취득 — 인출 때 과세 제외(⑤1호)'; }
    else if (/법인출연/.test(출처)) { const 총 = 매입 * 주; if (급여 && 총 > 출연한도) { const 초과 = 총 - 출연한도; 과세배정 += 초과; 왜 = '법인 출연 ' + won(총) + ' 중 한도 ' + won(출연한도) + '(직전연도 총급여 20%, 최소 500만) 초과 ' + won(초과) + ' → 배정 때 근로소득, 그 주식은 인출 때 제외(⑤2호)'; } else 왜 = '법인 출연 ' + won(총) + (급여 ? ' ≤ 한도 ' + won(출연한도) : ' — 직전연도 총급여를 몰라 한도 못 봄') + ' → 배정 때 과세 없음(③)'; if (!급여) 잠정 = true; }
    else { 왜 = '조합원 출자로 취득 — 배정 때 과세 없음(③)'; if (시가 && 매입 < 시가 * 0.7 && 비공제출자 > 0) 왜 += ' · 출자 400만 초과분으로 산 주식이 시가 70%(' + won(Math.round(시가 * 0.7)) + ')보다 싸면 차액 근로소득(⑧2호) [확인 필요 — 금액 구분은 조합 기장]'; }
    배정표.push({ 이름: 이름, 주수: 주, 매입가액등: 매입, 제외: 제외, 배정일: jmYmd_(b.배정일), 예탁종료: jmYmd_(b.의무예탁종료일) });
    reqs.push(jmReq_(이름 + ' 배정', true, 왜, '조특법 §88의4③④⑧·시행령 §82의4②③⑨'));
  });

  // 3) 인출 — 과세인출주식·인출금·보유기간 비과세 (선입선출)
  const 인 = p.인출 || {}; const 인출일 = jmYmd_(인.인출일), 인출주 = num(인.주수), 인출시가 = num(인.인출일시가);
  let 인출금 = 0, 비과세 = 0, 근로 = 0, 표 = [];
  if (인출주 > 0 && 배정표.length) {
    let 남 = 인출주;
    배정표.sort(function (a, b) { return (a.배정일 || '') < (b.배정일 || '') ? -1 : 1; }).forEach(function (b) {
      if (남 <= 0) return; const 주 = Math.min(남, b.주수); 남 -= 주;
      if (b.제외) { 표.push({ 이름: b.이름, 주수: 주, 과세: false }); return; }
      const 단가 = jmYn_(인.파산) === true ? 0 : (인출시가 ? Math.min(b.매입가액등, 인출시가) : b.매입가액등);
      if (!인출시가 && jmYn_(인.파산) !== true) 잠정 = true;
      const 금 = Math.round(단가 * 주);
      const 보유 = b.예탁종료 && 인출일 ? jmDays_(famAddD_(b.예탁종료, 1), 인출일) / 365.25 : null;
      let 율 = 0; if (보유 != null) { if (중소 === true) 율 = 보유 >= 6 ? 1 : 보유 >= 4 ? 0.75 : 보유 >= 2 ? 0.5 : 0; else if (중소 === false) 율 = 보유 >= 4 ? 0.75 : 보유 >= 2 ? 0.5 : 0; else 잠정 = true; } else 잠정 = true;
      const 비 = Math.round(금 * 율);
      인출금 += 금; 비과세 += 비; 근로 += 금 - 비;
      표.push({ 이름: b.이름, 주수: 주, 과세: true, 단가: 단가, 인출금: 금, 보유년: 보유 == null ? null : Math.round(보유 * 10) / 10, 비과세율: 율, 비과세: 비, 근로소득: 금 - 비 });
    });
    if (남 > 0) notes.push('인출 주수 ' + 인출주 + ' 중 ' + 남 + '주는 배정 내역에 없음 — 조합 기장으로 확인');
    reqs.push(jmReq_('인출금(과세인출주식 × min(매입가액등, 인출일 시가))', 인출금 >= 0 && !표.some(function (r) { return r.과세 && r.단가 == null; }), 표.map(function (r) { return r.이름 + ' ' + r.주수 + '주' + (r.과세 ? ' 인출금 ' + won(r.인출금) + ' · 보유 ' + (r.보유년 == null ? '?' : r.보유년 + '년') + ' → 비과세 ' + Math.round(r.비과세율 * 100) + '% ' + won(r.비과세) + ' · 근로소득 ' + won(r.근로소득) : ' 과세 제외'); }).join(' / '), '조특법 §88의4⑤⑥·시행령 §82의4④⑤'));
    notes.push('보유기간은 배정일이 아니라 증권금융회사 의무예탁 기간 종료일의 다음 날부터 인출일까지(⑥ 후단) · 회사가 인출금에 기본세율로 원천징수, 수입시기 = 인출일');
    if (인출일) 할일.push({ 무엇: '회사가 인출 근로소득 원천징수(기본세율)·연말정산 반영, 조합은 주권인출내역서 제출', 때: '인출 달 다음 달 10일', 근거: '조특법 §88의4⑤·시행령 §82의4⑫' });
  }

  // 4) 양도
  const y = p.양도 || {}; const 양도가액 = num(y.양도가액);
  let 취득가액 = 0; 배정표.forEach(function (b) { 취득가액 += b.매입가액등 * b.주수; });
  if (양도가액) {
    const 상장 = jmYn_(y.상장), 장내 = jmYn_(y.장내), 대 = jmYn_(y.대주주);
    const 과세 = 상장 === true && 장내 === true && 대 === false ? false : (상장 === false || 대 === true || 장내 === false) ? true : null;
    reqs.push(jmReq_('양도소득 과세 여부', 과세 === null ? null : true, 과세 === false ? '상장 소액주주 장내 양도 — 비과세' : 과세 === true ? '과세(비상장·대주주·장외) — 취득가액 = 매입가액등 ' + won(취득가액) + '(인출일 시가가 아님)' : '상장·장내·대주주 여부', '소득세법 §94①3호·조특령 §82의4⑧'));
    if (과세 === null) 잠정 = true;
    if (과세 === true) { 경우.push({ 이름: '③ 팔 때 — 취득가액 매입가액등 ' + won(취득가액) + ', 양도차익 ' + won(양도가액 - 취득가액), 엔진: 'calculate_stock_transfer_tax', 엔진칸: { assetCategory: 'domestic_stock', transferPrice: 양도가액, acquisitionPrice: 취득가액, transferDate: jmYmd_(y.양도일) || undefined, isSmallMediumCompany: 중소 === true ? true : 중소 === false ? false : undefined, isDaejuju: 대 === true } }); if (인출시가 && 인출주) 경우.push({ 이름: '④ [견주기] 취득가액을 인출일 시가 ' + won(인출시가 * 인출주) + '로 잘못', 엔진: 'calculate_stock_transfer_tax', 엔진칸: { assetCategory: 'domestic_stock', transferPrice: 양도가액, acquisitionPrice: 인출시가 * 인출주, isSmallMediumCompany: 중소 === true ? true : 중소 === false ? false : undefined, isDaejuju: 대 === true } }); }
  }

  // 5) 배당 비과세
  const d = p.배당 || {};
  if (num(d.금액)) {
    const ok = jmYn_(d.소액주주) === true && num(d.액면합계) <= 18000000 && (인출일 && jmYmd_(d.예탁일) ? jmDays_(jmYmd_(d.예탁일), 인출일) >= 365 : true);
    reqs.push(jmReq_('예탁 우리사주 배당 비과세', jmYn_(d.소액주주) == null ? null : ok, '소액주주 ' + (jmYn_(d.소액주주) === true ? '✔' : jmYn_(d.소액주주) === false ? '✘' : '?') + ' · 액면 합계 ' + won(num(d.액면합계)) + (num(d.액면합계) <= 18000000 ? ' ≤ 1,800만 ✔' : ' > 1,800만 ✘') + (인출일 && jmYmd_(d.예탁일) && jmDays_(jmYmd_(d.예탁일), 인출일) < 365 ? ' · 예탁 1년 안 인출 — 그 전 배당을 인출일에 과세' : ''), '조특법 §88의4⑨'));
  }

  // 6) 경우
  if (인출금 > 0) {
    경우.unshift({ 이름: '① 법대로 — 인출 근로소득 ' + won(근로) + '(인출금 ' + won(인출금) + ' − 보유 비과세 ' + won(비과세) + ')', 세액: undefined, 줄: ['회사 원천징수 기본세율, 그해 근로소득에 합산'] }, { 이름: '② [견주기] 인출일 시가 전부 × 주수 = ' + won(Math.round(인출시가 * 표.filter(function (r) { return r.과세; }).reduce(function (t, r) { return t + r.주수; }, 0))) + '를 근로소득으로(min·보유 비과세·제외 주식 무시)', 줄: ['시행령 §82의4④·법 ⑤⑥'] });
  }

  const w = jmWrap_('우리사주', reqs, { 소득공제합: 공제합, 비공제출자: 비공제출자, 배정과세: 과세배정, 인출표: 표, 인출금: 인출금, 보유비과세: 비과세, 인출근로소득: 근로, 양도취득가액: 취득가액, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = (인출금 ? '인출 근로소득 ' + won(근로) + '(비과세 ' + won(비과세) + ')' : 과세배정 ? '배정 때 근로소득 ' + won(과세배정) : 공제합 ? '출자 공제 ' + won(공제합) : '가르지 못함') + (w.잠정 ? ' — 잠정' : '');
  w.표시 = '우리사주 ' + w.결론;
  return w;
}

// [2026.11.05 모의사건 164] 주식매수선택권(스톡옵션) 행사와 그 주식의 양도 — 행사이익이 근로소득인지 기타소득인지, 벤처기업 특례 셋(비과세 §16의2·납부특례 §16의3·과세특례 §16의4)을 어떻게 고르나, 팔 때 취득가액
//  근거 원문(2026.11.05 업무관리자\법령 읽기용 판 — 조특법 20260918 시행판·시행령·소득세법 20260701·시행령 20261001 시행판):
//   소득세법 §21①22호(퇴직 전에 받은 선택권을 퇴직 후 행사하거나 고용관계 없이 받아 행사한 이익 = 기타소득) · 재직 중 행사이익은 근로소득(§20·시행령 §38①17호 [확인 필요 — 원문 줄을 이번 판에서 못 찾음]) · 시행령 §163⑬(행사로 취득한 주식을 팔 때 취득가액 = 행사 당시 시가)
//   조특법 §16의2①(벤처기업 임원 등이 2027.12.31. 이전 부여받은 선택권 행사이익(행사 당시 시가 − 실제 매수가액) 중 연간 2억원 비과세, 벤처기업별 누적 5억원 한도) ②(벤처법 §16의3 부여분, 상법 §340의2·§542의3 부여분은 코넥스 상장기업만)
//   §16의3①(비과세 제외 행사이익 소득세 — 신청하면 원천징수 안 하고 확정신고 때 4/5를 빼고 내며 다음 4년 1/4씩 분할, 현금 정산은 제외) ②(§74④ 출국 준용)
//   §16의4①(적격 선택권 — 벤처법 §16의3 부여 요건 + 행사일부터 2년 역산 전체 행사가액 5억원 이하 — 신청하면 행사 때 과세 안 함. 단, 부여 당시 시가보다 낮은 행사가액 차액(시가 이하 발행이익)은 행사 때 과세) ②(판 때 양도소득세) ③(양도소득금액 = 양도가액 − max(실제 매수가액, 부여 당시 시가) − (§16의2 비과세액 − 시가 이하 발행이익 중 비과세액)) ⑤(1년 안 처분·증여, 전체 5억 초과, 전용계좌 밖 거래 → 모든 행사이익을 그때 근로·기타소득으로) ⑧(전용계좌) ⑨(행사 때 벤처 아니어도 적용) · 시행령 §14의4①(제외 임직원: 모두 행사하면 10% 초과 보유, 지배주주등, 10% 초과 주주와 그 친족) ②(특례적용신청서 — 행사일 전일까지 회사에)
//  놓치던 것: ① 행사이익 전부를 근로소득으로만 보고 벤처 비과세 2억·누적 5억을 안 씀 ② 퇴직 후 행사는 기타소득(22호 — 필요경비 없음)인데 근로소득으로 ③ 과세특례(§16의4)를 고르면 취득가액이 행사 당시 시가(§163⑬)가 아니라 max(행사가액, 부여시가)로 바뀜 — 이걸 놓치면 양도차익이 틀림 ④ 1년 안 처분·전용계좌 밖 거래로 특례가 깨지는 사후관리 ⑤ 납부특례 5년 분할
//  p: { 회사:{ 벤처(예|아니오), 코넥스(예|아니오), 중소기업(예|아니오), 상장(예|아니오) }, 부여근거(벤처법|상법), 부여일, 부여당시시가(1주), 행사가액(1주), 행사일, 행사당시시가(1주), 주식수, 신분(재직|퇴직후|고용관계없음), 현금정산(예|아니오),
//       특례(비과세|납부특례|과세특례|없음|모름), 올해이미비과세(원), 법인별누적비과세(원, 이번 전), 전체행사가액2년(원, 이번 포함), 전용계좌(예|아니오), 신청일, 제외사유(10%초과|지배주주|없음),
//       양도:{ 양도일, 양도가액(총), 대주주(예|아니오), 증여(예) }, 한계세율(%, 종합소득 가정) }
function judgeStockOption_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 회사 = p.회사 || {}, 양도 = p.양도 || {};
  const 벤처 = jmYn_(회사.벤처), 코넥스 = jmYn_(회사.코넥스), 중소 = jmYn_(회사.중소기업);
  const n = num(p.주식수), 행사가 = num(p.행사가액), 행사시가 = num(p.행사당시시가), 부여시가 = num(p.부여당시시가);
  const 행사일 = jmYmd_(p.행사일), 부여일 = jmYmd_(p.부여일);
  const 행사이익 = Math.max(0, Math.round((행사시가 - 행사가) * n)), 시가이하발행이익 = Math.max(0, Math.round((부여시가 - 행사가) * n));
  const 신분 = String(p.신분 || '재직'), 특례 = String(p.특례 || '모름');
  let 잠정 = false;

  // 1) 행사이익과 소득 종류
  if (!n || !행사시가 || !행사가) { 잠정 = true; reqs.push(jmReq_('행사이익', null, '주식수·행사가액·행사 당시 시가(비상장이면 상증법 평가)를 모름', '조특법 §16의2①(행사 당시 시가 − 실제 매수가액)')); }
  else reqs.push(jmReq_('행사이익', true, '(' + won(행사시가) + ' − ' + won(행사가) + ') × ' + n + '주 = ' + won(행사이익) + (시가이하발행이익 ? ' (그중 시가 이하 발행이익 ' + won(시가이하발행이익) + ')' : ''), '조특법 §16의2①'));
  const 기타 = /퇴직|고용/.test(신분);
  reqs.push(jmReq_('소득 종류', true, 기타 ? '퇴직 뒤 행사 또는 고용관계 없이 받음 — 기타소득(필요경비 간주 없음, 원천 20%·300만 초과 종합)' : '재직 중 행사 — 근로소득(회사가 원천징수·연말정산)', 기타 ? '소득세법 §21①22호' : '소득세법 §20·시행령 §38①17호 [확인 필요]'));

  // 2) 벤처 특례 적용 가능한지
  const 근거 = String(p.부여근거 || ''), 부여ok = 부여일 ? 부여일 <= '2027-12-31' : null;
  const 상법코넥스 = /상법/.test(근거) ? 코넥스 === true : null;
  const 특례대상 = 벤처 === true && 부여ok !== false && (/벤처법/.test(근거) ? true : /상법/.test(근거) ? 상법코넥스 : null);
  if (벤처 === true) reqs.push(jmReq_('벤처 특례 대상 선택권', 특례대상, 특례대상 === true ? '벤처기업(또는 30% 인수 기업) 임원·종업원이 2027.12.31. 이전 부여받음 · ' + (/벤처법/.test(근거) ? '벤처법 §16의3 부여' : '상법 부여 — 코넥스 상장기업') : 특례대상 === false ? (/상법/.test(근거) && 코넥스 === false ? '상법으로 부여한 선택권은 코넥스 상장기업만 특례' : '부여일이 2027.12.31. 뒤') : '부여 근거(벤처법 §16의3 / 상법)·코넥스 여부·부여일 확인', '조특법 §16의2①②'));
  else if (벤처 === false) notes.push('벤처기업 아님 — 조특법 §16의2~§16의4 특례 없음, 행사이익 전부 과세(행사 때)');
  else { 잠정 = true; reqs.push(jmReq_('벤처기업인지', null, '벤처기업 확인서(벤처법)로 확인 — 특례 셋의 문', '조특법 §16의2')); }

  // 3) §16의2 비과세 — 연 2억·누적 5억
  let 비과세 = 0;
  if (특례대상 === true && 행사이익 > 0) {
    const 연남은 = Math.max(0, 200000000 - num(p.올해이미비과세)), 누적남은 = Math.max(0, 500000000 - num(p.법인별누적비과세));
    비과세 = Math.min(행사이익, 연남은, 누적남은);
    reqs.push(jmReq_('§16의2 비과세(연 2억·법인별 누적 5억)', 비과세 > 0, '비과세 ' + won(비과세) + ' = min(행사이익 ' + won(행사이익) + ', 올해 남은 ' + won(연남은) + ', 누적 남은 ' + won(누적남은) + ')' + (비과세 < 행사이익 ? ' → 과세 ' + won(행사이익 - 비과세) : ''), '조특법 §16의2① 본문·단서'));
    할일.push({ 무엇: '회사(원천징수의무자)가 비과세특례적용명세서 제출(다음 해 2월 말), 행사 당시 시가 정보를 증권사에 통보', 때: '다음 해 2월 말', 근거: '조특령 §14의2②③' });
  }
  const 과세행사이익 = Math.max(0, 행사이익 - 비과세);

  // 4) §16의3 납부특례 / §16의4 과세특례
  const 현금 = jmYn_(p.현금정산) === true;
  if (특례대상 === true && 과세행사이익 > 0 && !현금) notes.push('납부특례(§16의3): 신청하면 원천징수 없이 확정신고 때 행사이익 몫 소득세의 1/5만 내고 나머지 4/5를 다음 4년 1/4씩 — 현금 정산이면 못 씀');
  if (현금) notes.push('행사가액과 시가 차액을 현금으로 받음 — 납부특례·과세특례(§16의3·§16의4) 모두 못 씀, 행사이익 과세');
  let 과세특례 = null;
  if (특례대상 === true && !현금) {
    const 제외 = String(p.제외사유 || '없음'), 전체 = num(p.전체행사가액2년), 계좌 = jmYn_(p.전용계좌), 신청 = jmYmd_(p.신청일);
    const c1 = /벤처법/.test(근거) ? true : false, c2 = 전체 ? 전체 <= 500000000 : null, c3 = !/10%|지배/.test(제외), c4 = 계좌, c5 = 신청 && 행사일 ? 신청 < 행사일 : null;
    과세특례 = [c1, c2, c3, c4, c5].some(function (v) { return v === false; }) ? false : [c1, c2, c3, c4, c5].every(function (v) { return v === true; }) ? true : null;
    reqs.push(jmReq_('§16의4 과세특례(행사 때 과세 안 함 → 팔 때 양도소득)', 과세특례, [c1 ? '벤처법 §16의3 부여 ✔' : '상법 부여 — 적격 아님 ✘', c2 === null ? '2년 역산 전체 행사가액(5억 이하) ?' : c2 ? '전체 행사가액 ' + won(전체) + ' ≤ 5억 ✔' : '전체 행사가액 ' + won(전체) + ' > 5억 ✘', c3 ? '제외 임직원 아님 ✔' : '10% 초과·지배주주 등 제외 ✘', c4 === null ? '전용계좌 ?' : c4 ? '전용계좌 ✔' : '전용계좌 없음 ✘', c5 === null ? '행사일 전일까지 신청 ?' : c5 ? '신청 ' + 신청 + ' ✔' : '신청이 행사일 뒤 ✘'].join(' · '), '조특법 §16의4①·⑧·시행령 §14의4①②'));
    if (과세특례 !== true && 과세특례 !== false) 잠정 = true;
    if (과세특례 === true && 시가이하발행이익 > 0) notes.push('시가 이하 발행이익 ' + won(시가이하발행이익) + '(부여 당시 시가 − 행사가액)은 과세특례여도 행사 때 과세(§16의4① 단서) — 비과세 2억은 여기에 먼저 쓸 수 있음');
    if (과세특례 === true) { notes.push('사후관리: 행사일부터 1년 안 처분·증여, 2년 전체 행사가액 5억 초과, 전용계좌로 다른 주식 거래 → 그날 속한 해에 모든 행사이익을 근로·기타소득으로 과세(§16의4⑤)'); 할일.push({ 무엇: '특례적용신청서 + 전용계좌개설확인서를 행사일 전날까지 회사에 제출', 때: 행사일 ? '행사일 전날' : '행사 전', 근거: '조특령 §14의4②' }); }
  }

  // 5) 팔 때 — 취득가액 두 갈래
  const 양도가액 = num(양도.양도가액), 양도일 = jmYmd_(양도.양도일);
  const 취득일반 = Math.round(행사시가 * n), 취득특례 = Math.round(Math.max(행사가, 부여시가) * n);
  const D = 과세특례 === true ? Math.min(비과세, 시가이하발행이익) : 0; // 시가 이하 발행이익에 쓴 비과세
  const 차익일반 = 양도가액 ? 양도가액 - 취득일반 : 0, 차익특례 = 양도가액 ? 양도가액 - 취득특례 - (비과세 - D) : 0;
  if (양도가액) {
    if (양도일 && 행사일 && 과세특례 === true && jmDays_(행사일, 양도일) < 365) reqs.push(jmReq_('행사일부터 1년 뒤 처분', false, '행사 ' + 행사일 + ' → 양도 ' + 양도일 + ' 1년 안 — 과세특례 깨짐: 처분일 속한 해에 행사이익 ' + won(행사이익) + ' 전부 근로·기타소득 과세(파산 등 부득이한 사유 예외)', '조특법 §16의4⑤1호'));
    reqs.push(jmReq_('양도소득금액(취득가액 갈래)', true, 과세특례 === true ? '과세특례: 양도가액 ' + won(양도가액) + ' − max(행사가액, 부여시가) ' + won(취득특례) + ' − (비과세 ' + won(비과세) + ' − 시가 이하 발행이익 비과세 ' + won(D) + ') = ' + won(차익특례) : '일반: 양도가액 ' + won(양도가액) + ' − 행사 당시 시가 ' + won(취득일반) + ' = ' + won(차익일반) + ' (행사가액 ' + won(Math.round(행사가 * n)) + '이 아님)', 과세특례 === true ? '조특법 §16의4③' : '소득세법 시행령 §163⑬'));
    notes.push('주식 양도 과세 여부·세율은 상장·대주주·중소기업으로(「대주주」 묶음·주식 양도소득세 계산기) — 비상장 벤처면 소액주주도 과세, 중소기업 10%');
  }

  // 6) 경우
  const 세율 = Number(p.한계세율) > 0 ? Number(p.한계세율) / 100 : 0.385;
  if (행사이익 > 0) {
    경우.push({ 이름: '① 벤처 특례 없이 — 행사이익 ' + won(행사이익) + ' 전부 ' + (기타 ? '기타소득' : '근로소득') + '(한계세율 ' + Math.round(세율 * 100) + '% 가정 ' + won(Math.round(행사이익 * 세율)) + ')', 세액: Math.round(행사이익 * 세율), 줄: ['종합소득 합산 — 실제 세액은 그해 다른 소득에 따라'] });
    if (비과세 > 0) 경우.push({ 이름: '② §16의2 비과세 ' + won(비과세) + ' 적용 — 과세 행사이익 ' + won(과세행사이익) + ' → ' + won(Math.round(과세행사이익 * 세율)) + (과세행사이익 > 0 && !현금 ? ' (납부특례면 5년 분할)' : ''), 세액: Math.round(과세행사이익 * 세율), 줄: ['연 2억·누적 5억'] });
    if (과세특례 === true) 경우.push({ 이름: '③ §16의4 과세특례 — 행사 때 ' + (시가이하발행이익 - D > 0 ? '시가 이하 발행이익 ' + won(시가이하발행이익 - D) + '만 과세' : '0') + ', 팔 때 양도소득 ' + (양도가액 ? won(차익특례) : '(양도가액 미정)'), 엔진: 양도가액 ? 'calculate_stock_transfer_tax' : undefined, 엔진칸: 양도가액 ? Object.assign({ assetCategory: 'domestic_stock', transferPrice: 양도가액, acquisitionPrice: 취득특례 + (비과세 - D), transferDate: 양도일 || undefined, isSmallMediumCompany: 중소 === true ? true : 중소 === false ? false : undefined, isDaejuju: jmYn_(양도.대주주) === true }, p.엔진칸 || {}) : undefined, 세액: 양도가액 ? undefined : Math.round((시가이하발행이익 - D) * 세율) });
    if (양도가액) { 경우.push({ 이름: '④ 일반 갈래로 팔 때 — 양도소득 ' + won(차익일반) + '(취득가액 = 행사 당시 시가)', 엔진: 'calculate_stock_transfer_tax', 엔진칸: Object.assign({ assetCategory: 'domestic_stock', transferPrice: 양도가액, acquisitionPrice: 취득일반, transferDate: 양도일 || undefined, isSmallMediumCompany: 중소 === true ? true : 중소 === false ? false : undefined, isDaejuju: jmYn_(양도.대주주) === true }, p.엔진칸 || {}) }); 경우.push({ 이름: '⑤ [견주기] 취득가액을 행사가액 ' + won(Math.round(행사가 * n)) + '으로 잘못 — 양도차익 ' + won(양도가액 - Math.round(행사가 * n)) + '(행사이익을 두 번 과세)', 엔진: 'calculate_stock_transfer_tax', 엔진칸: { assetCategory: 'domestic_stock', transferPrice: 양도가액, acquisitionPrice: Math.round(행사가 * n), isSmallMediumCompany: 중소 === true ? true : 중소 === false ? false : undefined, isDaejuju: jmYn_(양도.대주주) === true } }); }
  }

  const w = jmWrap_('주식매수선택권', reqs, { 행사이익: 행사이익, 시가이하발행이익: 시가이하발행이익, 소득종류: 기타 ? '기타소득' : '근로소득', 벤처특례대상: 특례대상, 비과세: 비과세, 과세행사이익: 과세행사이익, 과세특례: 과세특례, 취득가액일반: 취득일반, 취득가액특례: 취득특례, 양도차익일반: 차익일반, 양도차익특례: 차익특례, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = !행사이익 ? '행사이익을 못 셈 — 잠정' : '행사이익 ' + won(행사이익) + ' ' + (기타 ? '기타소득' : '근로소득') + (비과세 ? ' · 벤처 비과세 ' + won(비과세) : '') + (과세특례 === true ? ' · 과세특례(팔 때 양도소득)' : '') + (w.잠정 ? ' — 잠정' : '');
  w.표시 = '주식매수선택권 ' + w.결론;
  return w;
}

// [2026.11.05 모의사건 163] 주식매수청구권 행사(반대주주) — 합병·분할·영업양도·포괄적 교환에 반대해 회사에 판 주식의 세금: 양도소득인지, 소액주주도 과세되는지(장외), 포괄적 교환만 제외, 세율·대주주, 의제배당 아님
//  근거 원문(2026.11.05 업무관리자\법령 읽기용 판 — 소득세법 20260701 시행판):
//   §94①3호 가목 1)(주권상장법인 주식 — 대주주가 양도하는 것) 2)(대주주 아닌 자가 「증권시장에서의 거래에 의하지 아니하고」 양도하는 주식. 다만 상법 §360의2·§360의15 포괄적 교환·이전 또는 §360의5·§360의22의 주식매수청구권 행사로 양도하는 주식은 제외) · 나목(주권비상장법인 주식 — 모두)
//   §104①11호 가목(대주주: 1년 미만 보유 중소기업 외 30%, 그 밖 3억 이하 20%·초과 25%) 나목(대주주 아닌 자: 중소기업 10%, 그 밖 20% [엔진 세율표]) · §88 1호(양도 = 매도·교환 등 유상 이전 — 회사에 파는 것도 양도)
//   §17②1호(주식 소각·감자로 받는 금액이 취득가액을 넘으면 의제배당) — 매수청구로 회사가 사들인 뒤 소각해도 판 주주에게는 양도(의제배당 아님) [확인 필요 — 권장: 양도소득, 해석례 원문 시스템에 없음]
//   §105①2호(주식등 예정신고: 양도일이 속하는 반기 말일부터 2개월) · 시행령 §162①1호(대금 청산일, 불분명하면 명의개서일)
//  놓치던 것: ① 상장 소액주주가 「거래소 밖(회사에 직접)」 팔았는데 비과세로 잘못 봄 — 합병·분할·영업양도 반대 매수청구는 과세, 포괄적 교환·이전 반대 매수청구만 제외 ② 비상장은 누구나 과세 ③ 세율은 대주주·중소기업·보유 1년으로 갈림(「대주주」 묶음) ④ 소각을 보고 의제배당(배당소득·종합과세)으로 잘못 감 ⑤ 매수가액은 협의가·법원 결정가 — 법원에서 올려 받으면 추가 신고
//  p: { 회사:{ 이름, 상장(예|아니오), 중소기업(예|아니오) }, 사유(합병|분할|분할합병|영업양도|포괄적교환|포괄적이전|정관변경|기타), 상법조문,
//       주주:{ 대주주(예|아니오|모름), 주식수, 취득가액, 취득일, 보유개월 }, 매수:{ 청구일, 협의가액(1주), 법원결정가액(1주), 대금받은날, 명의개서일, 총대금 }, 회사처분(소각|보유|재매각|모름), 증권거래세율(%), 엔진칸{…} }
function judgeAppraisalRightSale_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 회사 = p.회사 || {}, 주주 = p.주주 || {}, 매수 = p.매수 || {};
  const 상장 = jmYn_(회사.상장), 중소 = jmYn_(회사.중소기업), 대주주 = jmYn_(주주.대주주);
  const 사유 = String(p.사유 || ''), 교환이전 = /포괄적\s*(교환|이전)/.test(사유) || /360의(2|5|15|22)/.test(String(p.상법조문 || ''));
  const 주식수 = num(주주.주식수), 단가 = num(매수.법원결정가액) || num(매수.협의가액), 총대금 = num(매수.총대금) || Math.round(단가 * 주식수);
  const 취득가액 = num(주주.취득가액), 양도일 = jmYmd_(매수.대금받은날) || jmYmd_(매수.명의개서일);
  let 잠정 = false;

  // 1) 양도인지
  reqs.push(jmReq_('회사에 판 것도 「양도」', true, '매수청구권 행사로 회사가 사들임 — 유상 이전(배당·감자가 아님)' + (/소각/.test(String(p.회사처분 || '')) ? ' · 회사가 나중에 소각해도 판 주주에게는 양도 [확인 필요]' : ''), '소득세법 §88 1호·§94①3호'));

  // 2) 과세 대상인지 — 상장 소액주주 장외·포괄적 교환 제외
  let 과세 = null, 왜 = '';
  if (상장 === false) { 과세 = true; 왜 = '비상장 주식 — 누구나 과세(§94①3호 나목)'; }
  else if (상장 === true) {
    if (대주주 === true) { 과세 = true; 왜 = '상장 대주주 — 과세(가목 1))'; }
    else if (대주주 === false) { if (교환이전) { 과세 = false; 왜 = '상장 소액주주가 포괄적 교환·이전 반대 매수청구권 행사로 양도 — 가목 2) 단서로 제외(과세 없음)'; } else { 과세 = true; 왜 = '상장 소액주주지만 증권시장 밖(회사에 직접) 양도 — 가목 2) 과세. 제외는 포괄적 교환·이전 매수청구뿐(' + (사유 || '합병 등') + '은 해당 없음)'; } }
    else { 잠정 = true; 왜 = '대주주인지(「대주주」 묶음 — 직전 사업연도 말 지분·시가총액)에 따라 세율이 갈리나, 소액주주라도 장외라 과세' + (교환이전 ? '(포괄적 교환·이전 매수청구면 소액주주는 제외)' : ''); 과세 = 교환이전 ? null : true; }
  } else { 잠정 = true; 왜 = '회사가 상장인지 모름'; }
  reqs.push(jmReq_('양도소득 과세 대상', 과세, 왜, '소득세법 §94①3호 가목 2)·나목'));

  // 3) 세율 갈래
  if (과세 !== false) {
    const 보유 = Number(주주.보유개월) || (jmYmd_(주주.취득일) && 양도일 ? jmDays_(jmYmd_(주주.취득일), 양도일) / 30.4 : 0);
    let 세율설명 = '';
    if (대주주 === true) 세율설명 = (보유 && 보유 < 12 && 중소 === false) ? '대주주·1년 미만·중소기업 외 → 30%' : '대주주 → 3억 이하 20%·초과 25%';
    else if (대주주 === false) 세율설명 = 중소 === true ? '소액주주·중소기업 → 10%' : 중소 === false ? '소액주주·중소기업 외 → 20%' : '소액주주 — 중소기업 여부(조특법 §5①)로 10%·20%';
    else 세율설명 = '대주주 여부 확인 뒤';
    if (중소 == null || 대주주 == null) 잠정 = true;
    reqs.push(jmReq_('세율', 대주주 != null && (대주주 === true || 중소 != null) ? true : null, 세율설명, '소득세법 §104①11호'));
  }

  // 4) 양도가액·시기·증권거래세·신고
  if (총대금) reqs.push(jmReq_('양도가액 = 매수가액', true, won(총대금) + (num(매수.법원결정가액) ? ' (법원 결정가 ' + won(num(매수.법원결정가액)) + '/주)' : num(매수.협의가액) ? ' (협의가 ' + won(num(매수.협의가액)) + '/주)' : ''), '소득세법 §96①'));
  else { 잠정 = true; reqs.push(jmReq_('양도가액', null, '협의 매수가액 또는 법원 결정가액 × 주식수', '소득세법 §96①')); }
  if (num(매수.협의가액) && !num(매수.법원결정가액)) notes.push('매수가액 협의가 안 돼 법원에 결정을 청구하면 결정가로 바뀜 — 더 받으면 받은 해에 추가 신고(또는 양도가액 확정 후 신고) [확인 필요: 추가분 양도시기]');
  if (양도일) { const y = +양도일.slice(0, 4), m = +양도일.slice(5, 7); const half = m <= 6 ? y + '-08-31' : (y + 1) + '-02-28'; reqs.push(jmReq_('양도시기·예정신고', true, '대금 받은 날(명의개서) ' + 양도일 + ' → 반기 말일부터 2개월 ' + half, '소득세법 §105①2호·시행령 §162①1호')); if (과세 !== false) 할일.push({ 무엇: '주식 양도소득세 예정신고·납부', 때: half + '까지', 근거: '소득세법 §105①2호' }); }
  else notes.push('양도시기는 대금을 받은 날(불분명하면 명의개서일) — 회사 매수 대금 지급일 확인');
  if (과세 !== false) notes.push('증권거래세는 장외 거래 세율(비상장·장외 0.35% [확인 필요 — 증권거래세법 원문 시스템에 없음]) — 양도자가 신고·납부(반기), 양도비용으로 공제');
  if (/소각/.test(String(p.회사처분 || ''))) notes.push('회사가 매수 뒤 소각(감자) — 회사 쪽 자본 거래이고, 판 주주에게 의제배당(§17②1호)을 적용하지 않음 [확인 필요 — 권장: 양도소득 유지, 「자기주식」 묶음과 같이]');
  if (대주주 == null) 할일.push({ 무엇: '「대주주」 묶음으로 직전 사업연도 말 지분율·시가총액 확인', 때: '신고 전', 근거: '시행령 §157' });

  // 5) 경우(엔진칸)
  const base = Object.assign({ assetCategory: 'domestic_stock', transferPrice: 총대금 || undefined, acquisitionPrice: 취득가액 || undefined, transferDate: 양도일 || undefined, isSmallMediumCompany: 중소 === true ? true : 중소 === false ? false : undefined }, p.엔진칸 || {});
  if (과세 === true && 총대금) {
    경우.push({ 이름: '① 법대로 — 양도소득(' + (대주주 === true ? '대주주' : '소액주주') + (중소 === true ? '·중소기업' : 중소 === false ? '·중소기업 외' : '') + ')', 엔진: 'calculate_stock_transfer_tax', 엔진칸: Object.assign({}, base, { isDaejuju: 대주주 === true, holdingMonths: 대주주 === true ? Math.round(Number(주주.보유개월) || 0) || undefined : undefined }) });
    if (상장 === true && 대주주 === false) 경우.push({ 이름: '② [견주기] 상장 소액주주라 비과세로 잘못 봄 — 무신고', 세액: 0, 줄: ['장외 양도는 과세(§94①3호 가목 2)) — 무신고가산세 20%·납부지연가산세'] });
    if (대주주 === true) 경우.push({ 이름: '③ [견주기] 소액주주 세율(10·20%)로 잘못 셈', 엔진: 'calculate_stock_transfer_tax', 엔진칸: Object.assign({}, base, { isDaejuju: false }) });
    if (/소각/.test(String(p.회사처분 || ''))) 경우.push({ 이름: '④ [견주기] 의제배당(배당소득·종합과세)으로 잘못 봄 — 차익 ' + won(Math.max(0, 총대금 - 취득가액)) + '을 배당으로', 줄: ['양도소득이 맞음 [확인 필요]'] });
  } else if (과세 === false && 총대금) 경우.push({ 이름: '① 법대로 — 포괄적 교환·이전 반대 매수청구(상장 소액주주) 제외 → 양도소득세 없음', 세액: 0, 줄: ['§94①3호 가목 2) 단서'] });

  const w = jmWrap_('주식매수청구', reqs, { 과세: 과세, 총대금: 총대금, 취득가액: 취득가액, 양도일: 양도일, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = 과세 === false ? '양도소득세 없음(포괄적 교환·이전 매수청구 제외)' : 과세 === true ? '양도소득 과세' + (총대금 ? ' — 양도가액 ' + won(총대금) : '') + (w.잠정 ? ' — 잠정' : '') : '가르지 못함 — 잠정';
  w.표시 = '주식매수청구 ' + w.결론;
  return w;
}

// [2026.11.04 모의사건 162] 체납 강제징수 절차 — 독촉·압류·공매가 법대로 가고 있나, 무엇은 압류 못 하나(급여·소액 예금·보험·생활필수품), 언제 해제·유예되나, 체납자가 죽으면
//  근거 원문(2026.11.04 업무관리자\법령 읽기용 판 — 국세징수법 20261002 시행판·시행령 20261001 시행판):
//   §9①(납부기한 전 징수 사유: 체납 강제징수 시작·경매·파산·거래정지·법인 해산·포탈 행위·납세관리인 없이 출국) ②(단축 기한 고지) · §10①②(지정납부기한 뒤 10일 안 독촉장, 독촉 기한은 20일 안)
//   §31①(압류 요건: 1호 독촉 기한까지 미납 2호 §9② 단축 기한까지 미납) ②③④(확정 전 보전압류 — 지방청장 승인·통지, 담보 제공 또는 3개월 안 확정 안 되면 즉시 해제) · §32(초과압류 금지)
//   §41(압류금지 재산: 생활필수품·3개월 식료품·직업 도장·제사 물건·장례 물건·학업 서적·농어업 기구·직업 기구·신체보조기구와 경형자동차·사망급여금·주택임대차 우선변제금·18호 소액금융재산) · 시행령 §31(개인별 잔액 250만원 미만 예금, 사망보험금 1,500만원 이하, 치료비 보험금 전부·그 밖 1/2, 해약·만기환급금 250만원 이하)
//   §42①②③④(급여: 총액(세후)의 1/2 압류 금지, 1/2이 월 250만원 미만이면 250만원, 300만원 넘으면 300만원 + (1/2 − 300만원) × 1/2 — 시행령 §32 · 퇴직금 1/2)
//   §57①(즉시 해제: 전부 납부·충당, 부과 전부 취소, 일부 공매로 전부 징수, 남을 여지 없음(위원회 심의), 압류금지재산, 제3자 재산) ②(재량 해제: 가격 변동으로 현저히 초과, 일부 납부, 일부 취소, 다른 재산 제공)
//   §28(제3자 소유권 주장: 매각 5일 전까지 증거 제출 → 정지, 부당 통지 뒤 15일 안 소송 증명) · §25(사해행위 취소 청구 — 징수 피하려는 처분·사해신탁) · §27(체납자 사망해도 속행, 사망 뒤 체납자 명의 재산 압류는 상속인에 대한 것)
//   §66④⑤(보전압류 재산은 확정 전, 심판청구등 계속 중인 국세는 결정·판결 확정 전 공매 불가 — 부패·감량 재산 예외) · §67(수의계약: 추산가격 1천만원 미만, 1년 5회 유찰 등) · §68(공매예정가격, 감정) · §73(공고 10일 이상) · §75(체납자·담보물 소유자·공유자·배우자·담보권자에게 통지)
//   §105(압류·매각 유예: 성실납세자 또는 사업 정상화로 징수 가능 — 신청·직권, 압류 해제 가능, 담보 요구(성실납세자 납부계획서 + 체납정리위원회 인정이면 면제))
//  놓치던 것: ① 급여를 전액 또는 1/2로만 보고 250만·300만 구간을 안 봄 ② 잔액 250만원 미만 예금·소액 보험·경형자동차를 압류당하고도 해제를 못 챙김 ③ 심판청구 중인데 공매 진행 ④ 가족 명의 재산 압류(제3자 §28)와 체납자 사망 뒤 압류(상속인 §27)를 섞음 ⑤ 체납 직전 가족 증여는 사해행위 취소(§25) 위험
//  p: { 기준일, 체납들:[{ 세목, 금액, 지정납부기한, 독촉장받은날, 독촉기한, 불복중(예|아니오), 납부기한전징수사유, 확정전보전압류(예), 보전압류일 }],
//       압류들:[{ 이름, 종류(부동산|예금|급여|퇴직금|보험|자동차|동산|채권|기타), 가액, 압류일, 월급여세후, 퇴직금총액, 예금잔액, 보험{사망보험금, 치료비보험금, 그밖보험금, 해약환급금, 만기환급금}, 경형자동차(예), 생활필수품(예), 우선변제보증금, 제3자소유(예), 제3자이의제출일, 체납자사망후압류(예) }],
//       공매:{ 공고일, 공고기간일, 매각일, 체납자통지(예|아니오), 추산가격, 유찰횟수, 첫공매일 }, 유예:{ 사유(성실납세자|사업정상화), 납부계획서(예) }, 사망:{ 사망일 }, 납부:{ 전부납부(예), 일부납부액, 부과취소(전부|일부|없음) }, 사해행위:{ 처분일, 상대(가족|남), 종류(증여|저가양도|신탁) } }
function judgeEnforcementCollection_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [], 표 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  let 잠정 = false;
  const 체납합 = (p.체납들 || []).reduce(function (t, x) { return t + num(x.금액); }, 0);
  const 불복중 = (p.체납들 || []).some(function (x) { return jmYn_(x.불복중) === true; });

  // 1) 독촉 → 압류 요건
  (p.체납들 || []).forEach(function (c, i) {
    const 이름 = (c.세목 || '체납' + (i + 1)) + ' ' + won(num(c.금액));
    const 기한 = jmYmd_(c.지정납부기한), 독촉받 = jmYmd_(c.독촉장받은날), 독촉기한 = jmYmd_(c.독촉기한);
    if (c.납부기한전징수사유) { reqs.push(jmReq_(이름 + ' — 납부기한 전 징수', true, String(c.납부기한전징수사유) + ' — 단축 기한 고지 뒤 미납이면 독촉 없이 압류(§31①2호)', '국세징수법 §9①②·§31①2호')); return; }
    if (jmYn_(c.확정전보전압류) === true) { const d = jmYmd_(c.보전압류일); reqs.push(jmReq_(이름 + ' — 확정 전 보전압류', d ? (jmDays_(d, today) <= 92 ? null : false) : null, d ? '압류 ' + d + ' — 3개월(' + apAddM_(d, 3) + ') 안 확정 안 되면 즉시 해제, 납세담보 제공으로도 해제 · 확정 전 공매 불가' + (jmDays_(d, today) > 92 ? ' → 3개월 지남, 해제 요구' : '') : '보전압류일 확인', '국세징수법 §31②③④·§66④')); return; }
    if (!기한) { 잠정 = true; reqs.push(jmReq_(이름 + ' — 지정납부기한', null, '고지서 납부기한을 모름', '국세징수법 §10①')); return; }
    const 독촉ok = 독촉받 ? true : (today > famAddD_(기한, 10) ? null : null);
    reqs.push(jmReq_(이름 + ' — 독촉장(납부기한 뒤 10일 안, 기한 20일 안)', 독촉받 ? (독촉기한 ? jmDays_(독촉받, 독촉기한) <= 20 : null) : null, 독촉받 ? '독촉장 ' + 독촉받 + (독촉기한 ? ' · 기한 ' + 독촉기한 + (jmDays_(독촉받, 독촉기한) <= 20 ? '' : ' — 20일 넘는 기한(절차 하자 주장 가능 [확인 필요])') : ' · 독촉 기한 모름') : '독촉장을 받은 날·기한 확인 — 독촉 기한 전에는 압류 못 함(§31①1호)', '국세징수법 §10①②·§31①1호'));
    if (독촉기한 && today <= 독촉기한) notes.push(이름 + ': 독촉 기한 ' + 독촉기한 + '까지 내면 압류 안 됨 — 납부기한등 연장·분납·유예 길도 같이(「납부기한연장」 묶음)');
    if (jmYn_(c.불복중) === true) notes.push(이름 + ': 심판청구등 계속 중 — 압류는 될 수 있어도 결정·판결 확정 전 공매는 못 함(§66⑤)');
  });

  // 2) 압류마다 — 금지·제한·제3자·초과
  let 압류합 = 0, 해제대상 = [];
  (p.압류들 || []).forEach(function (a, i) {
    const 이름 = a.이름 || ('압류' + (i + 1)), 종 = String(a.종류 || ''), 가 = num(a.가액);
    let 가능 = 가, 금지 = 0, 왜 = '', ok = true;
    if (/급여/.test(종)) {
      const 총 = num(a.월급여세후); const half = 총 / 2;
      금지 = half < 2500000 ? Math.min(총, 2500000) : half > 3000000 ? 3000000 + (half - 3000000) / 2 : half;
      금지 = Math.round(금지); 가능 = Math.max(0, 총 - 금지);
      왜 = '세후 월 ' + won(총) + ' — 압류 금지 ' + won(금지) + '(' + (half < 2500000 ? '1/2이 250만원 미만 → 250만원' : half > 3000000 ? '1/2이 300만원 초과 → 300만 + (1/2 − 300만) × 1/2' : '총액의 1/2') + ') · 압류 가능 월 ' + won(가능);
      if (!총) { ok = null; 왜 = '세후 급여 총액(근로소득 − 소득세·지방소득세)을 모름'; 잠정 = true; }
    } else if (/퇴직/.test(종)) { const 총 = num(a.퇴직금총액); 금지 = Math.round(총 / 2); 가능 = 총 - 금지; 왜 = '퇴직금 ' + won(총) + ' — 1/2 ' + won(금지) + ' 압류 금지'; }
    else if (/예금/.test(종)) { const 잔 = num(a.예금잔액) || 가; if (잔 < 2500000) { ok = false; 가능 = 0; 왜 = '개인별 잔액 ' + won(잔) + ' < 250만원 — 소액금융재산, 압류 금지(즉시 해제)'; 해제대상.push(이름); } else 왜 = '잔액 ' + won(잔) + ' ≥ 250만원 — 압류 가능(전액)'; }
    else if (/보험/.test(종)) {
      const b = a.보험 || {}; const 사 = num(b.사망보험금), 치 = num(b.치료비보험금), 그 = num(b.그밖보험금), 해 = num(b.해약환급금), 만 = num(b.만기환급금);
      금지 = Math.min(사, 15000000) + 치 + Math.round(그 / 2) + Math.min(해, 2500000) + Math.min(만, 2500000);
      const 총 = 사 + 치 + 그 + 해 + 만; 가능 = Math.max(0, 총 - 금지);
      왜 = '보장성보험 — 금지 ' + won(금지) + '(사망보험금 1,500만 이하·치료비 전부·그 밖 1/2·해약·만기환급금 250만 이하) · 가능 ' + won(가능);
      if (가능 === 0 && 총 > 0) { ok = false; 해제대상.push(이름); }
    }
    else if (jmYn_(a.경형자동차) === true || jmYn_(a.생활필수품) === true) { ok = false; 가능 = 0; 왜 = (jmYn_(a.경형자동차) === true ? '경형자동차(§41 14호)' : '생활필수품(§41 1호)') + ' — 압류 금지, 즉시 해제'; 해제대상.push(이름); }
    else if (num(a.우선변제보증금) > 0) { 금지 = num(a.우선변제보증금); 가능 = Math.max(0, 가 - 금지); 왜 = '임차보증금 중 우선변제액 ' + won(금지) + '(§41 17호) 압류 금지 · 나머지 ' + won(가능); }
    else 왜 = '압류 가능 ' + won(가) + (/부동산/.test(종) ? ' — 등기 촉탁으로 효력(§45·§46), 사용·수익은 그대로(§47)' : '');
    if (jmYn_(a.제3자소유) === true) { ok = null; 왜 += ' · 제3자(가족 등) 소유 주장 — 매각 5일 전까지 증거 제출하면 강제징수 정지(§28①②), 부당 통지 뒤 15일 안 소송'; 할일.push({ 무엇: 이름 + ' 제3자 소유 증거 서류 제출', 때: '매각 5일 전까지', 근거: '국세징수법 §28①' }); if (jmYn_(a.체납자사망후압류) === true) 왜 += ' — 다만 체납자 사망 뒤 체납자 명의 재산 압류는 상속인에 대한 것(§27②)이라 상속인은 제3자가 아님'; }
    압류합 += 가능;
    표.push({ 이름: 이름, 종류: 종, 가액: 가, 압류금지: 금지, 압류가능: 가능, 적법: ok });
    reqs.push(jmReq_(이름 + ' 압류', ok, 왜, '국세징수법 §41·§42·시행령 §31·§32·§28'));
  });
  if (체납합 > 0 && 압류합 > 체납합 * 1.3 && (p.압류들 || []).length > 1) notes.push('압류 가능 가액 합 ' + won(압류합) + '이 체납액 ' + won(체납합) + '을 크게 넘음 — 초과압류 금지(§32), 가격 변동으로 현저히 초과하면 일부 해제 요구(§57②1호)');
  if (해제대상.length) 할일.push({ 무엇: '압류금지재산 압류 해제 신청: ' + 해제대상.join(', '), 때: '즉시', 근거: '국세징수법 §57①5호' });

  // 3) 해제·납부
  const n = p.납부 || {};
  if (jmYn_(n.전부납부) === true || /전부/.test(String(n.부과취소 || ''))) { reqs.push(jmReq_('압류 즉시 해제', true, jmYn_(n.전부납부) === true ? '체납액 전부 납부·충당' : '부과 전부 취소', '국세징수법 §57①1호·2호')); 할일.push({ 무엇: '압류 해제(등기 말소) 확인', 때: '납부 뒤', 근거: '§57①·§58' }); }
  else if (num(n.일부납부액) > 0 || /일부/.test(String(n.부과취소 || ''))) notes.push('일부 납부·일부 취소 — 압류 일부 해제는 세무서장 재량(§57②2·3호), 다른 재산을 제공해 바꿔 압류 요구 가능(4호)');

  // 4) 공매
  const g = p.공매 || {};
  if (jmYmd_(g.공고일) || num(g.추산가격)) {
    reqs.push(jmReq_('불복 계속 중 공매 금지', 불복중 ? false : true, 불복중 ? '심판청구등 계속 중인 국세 — 결정·판결 확정 전 공매 불가(부패·감량 재산 예외) → 공매 중지 요구' : '', '국세징수법 §66⑤'));
    if (jmYmd_(g.공고일)) { const 일 = Number(g.공고기간일) || (jmYmd_(g.매각일) ? jmDays_(jmYmd_(g.공고일), jmYmd_(g.매각일)) : 0); reqs.push(jmReq_('공매공고 기간 10일 이상', 일 ? 일 >= 10 : null, 일 ? 일 + '일' : '공고일·매각일', '국세징수법 §73')); }
    if (g.체납자통지 != null) reqs.push(jmReq_('체납자에게 공매통지', jmYn_(g.체납자통지), jmYn_(g.체납자통지) === false ? '통지 없는 공매는 위법 주장 가능 [확인 필요 — 판례]' : '', '국세징수법 §75①1호'));
    if (num(g.추산가격) > 0 && num(g.추산가격) < 10000000) notes.push('추산가격 ' + won(num(g.추산가격)) + ' < 1천만원 — 수의계약으로 매각될 수 있음(§67 3호)');
    if (Number(g.유찰횟수) >= 5) notes.push('1회 공매 뒤 1년간 5회 이상 유찰 — 수의계약 가능(§67 5호)');
    notes.push('공매예정가격은 세무서장이 정하고 감정 참고(§68) — 매각 전 제3자 소유권 주장은 5일 전까지(§28)');
  }

  // 5) 유예·사망·사해행위
  const u = p.유예 || {};
  if (u.사유) { reqs.push(jmReq_('압류·매각 유예(' + u.사유 + ')', null, '세무서장 재량 — 신청하면 압류 해제도 가능, 담보 요구(성실납세자가 납부계획서 내고 체납정리위원회가 인정하면 담보 면제)', '국세징수법 §105①②③')); 할일.push({ 무엇: '압류·매각 유예 신청서 + 체납세액 납부계획서' + (jmYn_(u.납부계획서) === true ? '(있음)' : ''), 때: '공매 전', 근거: '국세징수법 §105·시행령' }); }
  if ((p.사망 || {}).사망일) { notes.push('체납자 사망 ' + jmYmd_(p.사망.사망일) + ' — 시작된 강제징수는 계속(§27①), 사망 뒤 체납자 명의 재산 압류는 상속인에 대한 압류(§27②) · 상속인의 납부 한도(상속재산 한도)는 「납세의무승계」 묶음'); 할일.push({ 무엇: '상속인별 승계 한도(받은 재산 − 부채 − 상속세) 셈 — 한도 넘는 압류는 다툼', 때: '지금', 근거: '국세기본법 §24' }); }
  const s = p.사해행위 || {};
  if (jmYmd_(s.처분일)) { const 뒤 = (p.체납들 || []).some(function (c) { const k = jmYmd_(c.지정납부기한); return k && jmYmd_(s.처분일) >= famAddY_(k, -1); }); notes.push('체납 무렵(' + jmYmd_(s.처분일) + ') ' + (s.상대 || '') + '에게 ' + (s.종류 || '처분') + ' — 징수를 피하려는 처분이면 세무서장이 사해행위 취소·원상회복 청구(§25, 민법 §406 안 날부터 1년·행위 5년)' + (뒤 ? ' — 체납 전후 1년 안이라 위험 큼' : '') + ' · 받은 가족은 증여세·저가 양수 증여(「법인거래」·§35)도 따로'); }

  // 6) 경우
  const 급여 = 표.filter(function (r) { return /급여/.test(r.종류); });
  경우.push({ 이름: '① 법대로 — 압류 가능 합 ' + won(압류합) + (해제대상.length ? ' · 해제 대상 ' + 해제대상.join(', ') : ''), 줄: 표.map(function (r) { return r.이름 + ': 가능 ' + won(r.압류가능) + (r.압류금지 ? ' / 금지 ' + won(r.압류금지) : '') + (r.적법 === false ? ' (압류 금지 — 해제)' : ''); }) });
  if (급여.length) { const a = (p.압류들 || []).find(function (x) { return /급여/.test(String(x.종류 || '')); }); const 총 = num(a && a.월급여세후); 경우.push({ 이름: '② [견주기] 급여 1/2을 그냥 압류 — ' + won(Math.round(총 / 2)) + '/월', 줄: ['법대로 ' + won(급여[0].압류가능) + '/월(250만·300만 구간)'] }); }
  if (해제대상.length) 경우.push({ 이름: '③ [견주기] 소액 예금·보험·경형차를 압류당한 채로 둠', 줄: ['§57①5호 즉시 해제 대상 — 해제 신청'] });
  if (불복중 && (jmYmd_(g.공고일) || num(g.추산가격))) 경우.push({ 이름: '④ [견주기] 심판청구 중인데 공매가 진행됨', 줄: ['§66⑤ — 공매 중지 요구·위법 공매 다툼'] });

  const w = jmWrap_('강제징수', reqs, { 기준일: today, 체납합: 체납합, 압류가능합: 압류합, 해제대상: 해제대상, 표: 표, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = (체납합 ? '체납 ' + won(체납합) + ' · ' : '') + '압류 가능 ' + won(압류합) + (해제대상.length ? ' · 해제 대상 ' + 해제대상.length + '건' : '') + (불복중 ? ' · 불복 중(공매 불가)' : '') + (w.잠정 ? ' — 잠정' : '');
  w.표시 = '강제징수 ' + w.결론;
  return w;
}

// [2026.11.04 모의사건 161] 연부연납 허가·담보·취소 — 상속세·증여세를 나눠 낼 수 있는지(2천만원·회당 1천만원·기간 한도), 어떤 담보를 얼마나(120%·110%), 언제 신청·허가 간주, 무엇이 취소 사유인지
//  근거 원문(2026.11.04 업무관리자\법령 읽기용 판 — 상증법 20260102·시행령 20261001·국세징수법 20261002·시행령 20261001 시행판):
//   상증법 §71①(납부세액 2천만원 초과 — 신청·허가, 담보 제공. 국세징수법 §18①1~4호 담보로 신청하면 신청일에 허가 간주) ②(기간: 상속 가업 20년 또는 허가 뒤 10년부터 10년 / 그 밖 10년 / 증여 조특법 §30의6 특례 15년 / 그 밖 5년 — 각 회분 1천만원 초과하도록) ④(취소·변경: 1호 회분 미납 2호 담보 명령 불응 3호 국세징수법 §9① 사유 4호 사업 폐업·종사 안 함 등) ⑤(통지)
//   시행령 §67①(신고와 함께 신청 — 수정신고·기한후신고 포함, 결정 통지면 고지서 납부기한까지) ②(허가 여부 통지: 신고분은 법정결정기한, 수정·기한후는 9개월·증여 6개월, 고지분은 납부기한 뒤 14일 — 안 보내면 허가 간주) ③(고지분 납부지연가산세 제외) ④(담보는 국세징수법 §18~§23 준용) · §68①(매년 납부액 = 대상금액 ÷ (기간 + 1), 1천만원 초과 범위) ② (가업 몫 = 상속세 × (기업상속재산가액 − 가업상속공제) ÷ (총상속재산가액 − 가업상속공제))
//   상증법 §72·시행령 §69(가산금 = 잔액 × 일수 × 국세기본법 시행령 §43의3② 이자율 — 엔진 calculate_installment_payment_schedule이 셈) · §70②(분납과 중복 불가 — 엔진 안내)
//   국세징수법 §18①(담보 종류: 1 금전 2 국채 등 유가증권 3 납세보증보험증권 4 은행 등 납세보증서 5 토지 6 보험 든 등기·등록 건물·공장재단·광업재단·선박·항공기·건설기계) ②(담보할 국세의 120% 이상, 금전·납세보증보험증권·은행 납세보증서는 110%) · §19(평가: 유가증권 시가, 보험증권 보험금액, 보증서 보증금액, 토지·건물 등 대통령령) · 시행령 §19②1호(토지·건물은 상증법 §60·§61 가액 — 제공일 기준) · §20③(등기필증 제시, 세무서장이 저당권 등기, 건물은 화재보험증권) · §21(변경 승인·보충 요구) · §23(납부되면 해제)
//  놓치던 것: ① 세액 2천만 문턱만 보고 「회당 1천만 초과」로 기간이 줄어드는 것을 놓침 ② 담보를 세액 100%로 준비 — 120%(현금·보험·은행보증 110%)가 필요 ③ 1~4호 담보면 신청일 허가 간주, 부동산 담보면 통지(또는 기한 경과) 때까지 대기 ④ 건물 담보는 보험 필수, 담보 가액은 상증법 평가액(시가·기준시가)이지 매매 호가가 아님 ⑤ 가업 재산 몫만 20년, 나머지는 10년
//  p: { 세목(상속|증여), 납부세액, 가업몫세액(상속 가업상속재산 몫 또는 증여 §30의6 특례 몫), 신청기간년, 가업몫기간년, 신청경로(신고|수정신고|기한후신고|고지), 신고기한 또는 고지납부기한, 신청일, 허가통지일,
//       담보들:[{ 종류(금전|유가증권|납세보증보험|은행납세보증서|기타납세보증서|토지|건물|공장재단|선박|항공기|건설기계), 가액(상증법 평가액 또는 보험·보증금액), 보험(예|아니오), 등기(예|아니오) }],
//       납부들:[{ 회차, 기한, 납부일 }], 사유들:[폐업|종사안함|담보명령불응|납부기한전징수사유], 기준일, 이자율(%) }
function judgeInstallmentPermit_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10);
  const 증여 = /증여/.test(String(p.세목 || '상속')), 세액 = num(p.납부세액), 가업 = Math.min(세액, num(p.가업몫세액)), 일반 = 세액 - 가업;
  let 잠정 = false;

  // 1) 2천만원 초과
  reqs.push(jmReq_('납부세액 2천만원 초과', 세액 ? 세액 > 20000000 : null, 세액 ? won(세액) + (세액 > 20000000 ? '' : ' — 연부연납 못 함(분납 §70② 검토)') : '납부세액을 모름', '상증법 §71①'));

  // 2) 기간 한도와 회당 1천만원
  const 한도일반 = 증여 ? 5 : 10, 한도가업 = 증여 ? 15 : 20;
  const 신청 = Number(p.신청기간년) || 0, 신청가업 = Number(p.가업몫기간년) || 신청;
  const 회당 = function (금액, 년) { return 년 > 0 ? 금액 / (년 + 1) : 0; };
  const 최대년 = function (금액) { return Math.max(0, Math.floor((금액 - 1) / 10000000) - 1); }; // 회당 = 금액 ÷ (년+1) > 1천만원이 되는 가장 긴 년
  if (세액 > 20000000) {
    if (일반 > 0) {
      const y = Math.min(신청 || 한도일반, 한도일반), per = 회당(일반, y), maxY = Math.min(한도일반, 최대년(일반));
      reqs.push(jmReq_((가업 ? '일반 재산 몫 ' : '') + '기간 ' + y + '년(한도 ' + 한도일반 + '년) · 회당 1천만원 초과', 신청 > 한도일반 ? false : per > 10000000, 신청 > 한도일반 ? '신청 ' + 신청 + '년이 한도 ' + 한도일반 + '년 초과' : '회당 ' + won(Math.round(per)) + ' = ' + won(일반) + ' ÷ (' + y + ' + 1)' + (per > 10000000 ? '' : ' ≤ 1천만원 → 기간을 ' + maxY + '년 이하로'), '상증법 §71② 단서·시행령 §68①'));
      if (per <= 10000000 && maxY > 0) notes.push('일반 몫 ' + won(일반) + '으로 회당 1천만원을 넘기려면 최대 ' + maxY + '년(회당 ' + won(Math.round(회당(일반, maxY))) + ')');
    }
    if (가업 > 0) {
      const y = Math.min(신청가업 || 한도가업, 한도가업), per = 회당(가업, y);
      reqs.push(jmReq_('가업 몫 ' + won(가업) + ' 기간 ' + y + '년(한도 ' + 한도가업 + '년' + (증여 ? '' : ' 또는 허가 뒤 10년부터 10년') + ')', 신청가업 > 한도가업 ? false : per > 10000000, 신청가업 > 한도가업 ? '한도 초과' : '회당 ' + won(Math.round(per)) + (per > 10000000 ? '' : ' ≤ 1천만원 → 기간 단축'), '상증법 §71②1호가목·2호가목·시행령 §68②'));
      notes.push('가업 몫 = 상속세 × (기업상속재산가액 − 가업상속공제) ÷ (총상속재산가액 − 가업상속공제)(시행령 §68②) — 「가업상속」 묶음 결과로 셈, 나머지는 일반 한도');
    }
  }

  // 3) 담보 — 종류·가액 120/110%·보험·허가 간주
  const 담보들 = p.담보들 || [];
  const 대상 = 세액 > 0 ? Math.round(세액 - 회당(일반, Math.min(신청 || 한도일반, 한도일반)) - (가업 ? 회당(가업, Math.min(신청가업 || 한도가업, 한도가업)) : 0)) : 0;
  let 환산합 = 0, 간주 = 담보들.length > 0, 종류문제 = [];
  담보들.forEach(function (d) {
    const 종 = String(d.종류 || ''), 가 = num(d.가액);
    const 낮음 = /금전|납세보증보험|은행납세보증서/.test(종);
    const ok종 = /금전|유가증권|납세보증보험|납세보증서|토지|건물|공장재단|광업재단|선박|항공기|건설기계/.test(종);
    if (!ok종) { 종류문제.push(종 + ' — 국세징수법 §18① 담보가 아님(비상장주식·채권·예금 담보 등)'); return; }
    if (/건물|공장재단|광업재단|선박|항공기|건설기계/.test(종) && jmYn_(d.보험) === false) 종류문제.push(종 + ' — 보험에 들지 않아 담보 불가(§18①6호)');
    if (/토지|건물|공장|선박|항공|건설|기타납세보증서/.test(종)) 간주 = false;
    환산합 += 낮음 ? 가 / 1.1 : 가 / 1.2; // 각 담보가 떠받칠 수 있는 국세
  });
  if (담보들.length) {
    const 받침 = Math.round(환산합);
    reqs.push(jmReq_('담보 가액(담보할 국세의 120%, 금전·납세보증보험·은행 보증서 110%)', 종류문제.length ? false : (대상 ? 받침 >= 대상 : null), 종류문제.length ? 종류문제.join(' · ') : '담보로 떠받칠 수 있는 국세 ' + won(받침) + ' vs 연부연납 대상 ' + won(대상) + (받침 >= 대상 ? '' : ' — ' + won(대상 - 받침) + ' 모자람(담보 추가·보충 요구 §21②)'), '국세징수법 §18②·§19·시행령 §19②'));
    reqs.push(jmReq_('허가 간주(1~4호 담보로 신청)', 간주 ? true : null, 간주 ? '금전·유가증권·납세보증보험·은행 납세보증서 — 신청일에 허가받은 것으로 봄' : '토지·건물 담보 — 세무서장이 저당권 등기 뒤 허가 여부 통지(기한 안 안 오면 허가 간주)', '상증법 §71① 후단·시행령 §67②'));
    if (담보들.some(function (d) { return /토지|건물/.test(String(d.종류 || '')); })) notes.push('부동산 담보 가액은 제공일 기준 상증법 §60·§61 평가액(시가 없으면 기준시가) — 호가·감정 최고액이 아님(국세징수법 시행령 §19②1호) · 등기필증 제시 → 세무서장이 저당권 등기(§20③), 건물은 화재보험증권');
  } else if (세액 > 20000000) { 잠정 = true; reqs.push(jmReq_('담보', null, '담보 종류·가액을 모름 — 연부연납 대상 ' + won(대상) + '의 120%(현금·보험·은행보증 110%) 준비', '상증법 §71①·국세징수법 §18②')); }

  // 4) 신청 시기·허가 통지 기한
  const 경로 = String(p.신청경로 || '신고'), 기한 = jmYmd_(p.신고기한) || jmYmd_(p.고지납부기한), 신청일 = jmYmd_(p.신청일);
  const 말일뒤 = function (b, 개월) { return new Date(Date.UTC(+b.slice(0, 4), +b.slice(5, 7) + 개월, 0)).toISOString().slice(0, 10); };
  if (기한) {
    const okT = 신청일 ? 신청일 <= 기한 : null;
    reqs.push(jmReq_('신청 시기(' + (/고지/.test(경로) ? '고지서 납부기한까지' : '신고와 함께') + ')', okT, 신청일 ? '신청 ' + 신청일 + (okT ? ' — 기한 ' + 기한 + ' 안' : ' — 기한 ' + 기한 + ' 넘김(연부연납 못 함)') : '신청서를 ' + 기한 + '까지', '시행령 §67①'));
    const 통지한도 = /고지/.test(경로) ? famAddD_(기한, 14) : /수정|기한후/.test(경로) ? 말일뒤(신청일 || 기한, 증여 ? 6 : 9) : 말일뒤(기한, 증여 ? 6 : 9);
    const 통지 = jmYmd_(p.허가통지일);
    if (!간주) notes.push('허가 여부 서면 통지 기한 ' + 통지한도 + '(' + (/고지/.test(경로) ? '납부기한 뒤 14일' : /수정|기한후/.test(경로) ? '신고한 달 말일부터 ' + (증여 ? 6 : 9) + '개월' : '법정결정기한 — 신고기한 뒤 ' + (증여 ? 6 : 9) + '개월') + ') — 그때까지 안 보내면 허가 간주(시행령 §67②)' + (통지 ? ' · 통지 받음 ' + 통지 : today > 통지한도 ? ' · 기한 지남 → 허가된 것' : ''));
    if (/고지/.test(경로)) notes.push('고지분: 납부기한 뒤 통지가 와도 통지일 전까지 납부지연가산세 없음(시행령 §67③)');
  } else { 잠정 = true; reqs.push(jmReq_('신고기한·고지 납부기한', null, '신청 시기와 통지 기한의 기준', '시행령 §67①②')); }

  // 5) 취소 사유
  const 사유 = (p.사유들 || []).map(String), 납부 = p.납부들 || [];
  const 미납 = 납부.filter(function (x) { const k = jmYmd_(x.기한), d = jmYmd_(x.납부일); return k && (!d ? today > k : d > k); });
  if (미납.length) { reqs.push(jmReq_('회분을 기한 안에 냄', false, 미납.map(function (x) { return (x.회차 || '') + '회 ' + jmYmd_(x.기한) + (jmYmd_(x.납부일) ? ' → ' + jmYmd_(x.납부일) + ' 늦음' : ' 미납'); }).join(' · ') + ' — 허가 취소·변경, 남은 세액 전액 또는 일부 징수 가능', '상증법 §71④1호')); 할일.push({ 무엇: '밀린 회분 즉시 납부·취소 전 소명', 때: '즉시', 근거: '상증법 §71④1호·⑤' }); }
  사유.forEach(function (s) { if (/폐업|종사/.test(s)) reqs.push(jmReq_('가업 계속(폐업·종사 중단 없음)', false, s + ' — 가업 몫 연부연납 취소 사유(시행령 §67⑥)', '상증법 §71④4호')); else if (/담보/.test(s)) reqs.push(jmReq_('담보 변경·보충 명령 따름', false, s, '상증법 §71④2호·국세징수법 §21②')); else if (/납부기한전|징수/.test(s)) reqs.push(jmReq_('납부기한 전 징수 사유 없음', false, s + ' — 국세징수법 §9①(체납·강제집행·파산 등)', '상증법 §71④3호')); });
  notes.push('가산금: 회분마다 잔액 × 일수 × 국세기본법 시행령 §43의3② 이자율(허가일 기준, 바뀌면 구간별) — 「연부연납 회차표」 계산기(엔진)가 셈 · 자진납부 분납(§70②, 2개월)과 중복 안 됨');
  할일.push({ 무엇: '연부연납신청서 + 담보 서류(공탁수령증·보험증권·보증서·등기필증·화재보험증권)를 ' + (/고지/.test(경로) ? '고지서 납부기한' : '신고') + '까지 제출', 때: 기한 || '신고 때', 근거: '시행령 §67①·국세징수법 §20' });
  if (담보들.length) 할일.push({ 무엇: '다 낸 뒤 담보 해제(저당권 말소) 신청 — 세무서장은 지체 없이 해제', 때: '완납 뒤', 근거: '국세징수법 §23' });

  // 6) 경우(엔진칸)
  if (세액 > 20000000) {
    const y = Math.min(신청 || 한도일반, 한도일반);
    경우.push({ 이름: '① 법대로 — ' + (가업 ? '일반 몫 ' + won(일반) + ' ' + y + '년 + 가업 몫 ' + won(가업) + ' ' + Math.min(신청가업 || 한도가업, 한도가업) + '년' : won(세액) + ' ' + y + '년, 회당 ' + won(Math.round(회당(세액, y)))) + ' · 담보 ' + won(Math.round(대상 * 1.2)) + '(부동산) 또는 ' + won(Math.round(대상 * 1.1)) + '(현금·보험·은행보증)', 엔진: 'calculate_installment_payment_schedule', 엔진칸: Object.assign({ taxType: 증여 ? 'gift' : 'inheritance', totalTaxAmount: 세액, installmentPeriodYears: y, filingDeadline: 기한 || undefined, referenceDate: 신청일 || 기한 || undefined, annualInterestRatePercent: Number(p.이자율) > 0 ? Number(p.이자율) : undefined }, 가업 ? { specialPortionAmount: 가업, specialPeriodYears: Math.min(신청가업 || 한도가업, 한도가업) } : {}) });
    경우.push({ 이름: '② [견주기] 담보를 세액 100%(' + won(대상) + ')만 준비 — 120%·110%에 못 미쳐 보충 요구·허가 안 됨', 줄: ['국세징수법 §18②'] });
    const perMax = 회당(일반 || 세액, 한도일반);
    if (perMax <= 10000000) 경우.push({ 이름: '③ [견주기] 한도 ' + 한도일반 + '년을 그대로 신청 — 회당 ' + won(Math.round(perMax)) + ' ≤ 1천만원이라 허가 안 됨(최대 ' + 최대년(일반 || 세액) + '년)', 줄: ['상증법 §71② 단서'] });
    if (가업 > 0) 경우.push({ 이름: '④ [견주기] 전체 세액을 가업 한도 ' + 한도가업 + '년으로 신청 — 일반 몫은 ' + 한도일반 + '년까지만', 줄: ['시행령 §68②'] });
  }

  const w = jmWrap_('연부연납', reqs, { 세목: 증여 ? '증여세' : '상속세', 납부세액: 세액, 가업몫: 가업, 연부연납대상: 대상, 담보필요액: { 부동산: Math.round(대상 * 1.2), 현금등: Math.round(대상 * 1.1) }, 허가간주: 담보들.length ? 간주 : null, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = !세액 ? '납부세액을 몰라 가르지 못함 — 잠정' : 세액 <= 20000000 ? '연부연납 못 함(2천만원 이하)' : (w.결론 === '안 됨' ? '요건 못 갖춤 — ' + reqs.filter(function (r) { return r.결과 === '✘'; }).map(function (r) { return r.이름; }).join(', ') : '연부연납 가능' + (w.잠정 ? '(잠정)' : '') + ' — 대상 ' + won(대상));
  w.표시 = '연부연납 ' + w.결론;
  return w;
}

// [2026.11.04 모의사건 160] 증액경정·감액경정의 효력(국세기본법 §22의3) — 당초 신고분과 경정분을 각각 언제까지 어떤 길로 다투나, 불복 결정·판결 뒤 과세관청의 1년 재처분(특례제척기간 §26의2⑥⑦)
//  근거 원문(2026.11.04 업무관리자\법령 읽기용 판 — 국세기본법 20261002 시행판):
//   §22의3①(당초 확정된 세액을 증가시키는 경정은 당초 확정 세액에 관한 권리·의무관계에 영향을 미치지 않음) ②(감소시키는 경정은 그 감소 세액 외의 세액에 관한 권리·의무관계에 영향 없음)
//   §45의2①(법정신고기한 뒤 5년 안 경정청구. 단서: 결정·경정으로 증가된 과세표준·세액은 그 처분을 안 날(통지받은 날)부터 3개월 안 — 법정신고기한 뒤 5년 안으로 한정) ②1호(판결 등으로 거래가 다른 것으로 확정 — 안 날부터 3개월, 후발적)
//   §61①(심사청구는 처분을 안 날부터 90일) · §68①(심판청구 90일 — 「불복기한」 묶음) · §56②③(소송은 심사·심판 거친 뒤 결정 통지받은 날부터 90일)
//   §26의2⑥1호(불복 결정·판결 확정일부터 1년 안 경정 등 처분 가능 — 특례제척기간) 1의2호(연동 세목·과세기간 1년) 3호(경정청구일부터 2개월) 5호(거래가 판결로 달리 확정 — 1년) · ⑦(명의대여·실질귀속자 확인 — 당초 처분 취소하고 1년 안 실질귀속자에게)
//  놓치던 것: ① 증액경정 고지서를 받고 「전체 세액」을 90일 안에 다투면 된다고 보는 것 — 당초 신고분은 §22의3①로 따로 남아 5년 경정청구(또는 그 기한이 지났으면 못 다툼), 증액분만 90일 불복·3개월 경정청구 ② 감액경정을 받았다고 당초 처분 불복기간이 새로 시작되지 않음(②) ③ 불복에서 이겨도 1년 안 다른 사유로 재처분 가능(§26의2⑥1호) ④ 2024.12.31. 개정으로 증액분 경정청구 기한이 90일 → 3개월
//  p: { 세목, 법정신고기한, 당초신고세액, 당초신고일,
//       경정들:[{ 이름, 종류(증액|감액|결정), 통지받은날, 경정후세액 또는 증가세액·감소세액, 불복(이의신청|심사청구|심판청구|소송|없음), 불복일, 결정통지일, 결정종류(인용|일부인용|기각|각하|재조사) }],
//       기준일, 공휴일[YYYY-MM-DD…], 판결: { 확정일, 결과(납세자승|패), 명의대여확인(예), 실질귀속자(이름) }, 다투려는것(당초신고분|증액분|모두) }
function judgeCorrectionEffect_(p) {
  p = p || {};
  const today = jmYmd_(p.기준일) || new Date().toISOString().slice(0, 10), hol = p.공휴일 || [];
  const reqs = [], notes = [], 할일 = [], 기한 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const shift = function (raw) { const why = []; return { 날: apShift_(raw, hol, why), 왜: why }; };
  const 상태 = function (end) { return today <= end ? '남음 ' + Math.round(jmDays_(today, end)) + '일' : '지남(' + Math.round(jmDays_(end, today)) + '일 전)'; };
  const 신고기한 = jmYmd_(p.법정신고기한), 당초 = num(p.당초신고세액);
  let 잠정 = false;

  // 1) 당초 신고분 — 5년 경정청구
  if (신고기한) {
    const e5 = shift(famAddY_(신고기한, 5));
    기한.push({ 무엇: '당초 신고분 경정청구(법정신고기한 뒤 5년)', 끝: e5.날, 상태: 상태(e5.날), 근거: '국세기본법 §45의2①' });
    reqs.push(jmReq_('당초 신고분은 증액경정과 따로 남음', true, '증액경정은 당초 확정 세액 ' + (당초 ? won(당초) : '') + '의 권리·의무에 영향 없음 — 당초분 다툼은 5년 경정청구(' + e5.날 + ', ' + 상태(e5.날) + ')' + (today > e5.날 ? ' → 지나 못 다툼(증액 처분 불복에서 당초분 위법을 주장해도 취소 범위는 증액분 [확인 필요 — 판례])' : ''), '국세기본법 §22의3①·§45의2①'));
  } else { 잠정 = true; reqs.push(jmReq_('법정신고기한', null, '당초 신고의 법정신고기한을 모름 — 5년 경정청구 기한을 못 셈', '국세기본법 §45의2①')); }

  // 2) 경정마다 — 증액분 90일 불복·3개월 경정청구 / 감액은 새 기간 없음
  let 누적 = 당초;
  (p.경정들 || []).forEach(function (c, i) {
    const 이름 = c.이름 || ('경정' + (i + 1)), 종류 = String(c.종류 || '증액'), 받은 = jmYmd_(c.통지받은날);
    const 후 = num(c.경정후세액), 증 = num(c.증가세액), 감 = num(c.감소세액);
    const 변동 = 후 ? 후 - 누적 : (증 || -감);
    if (후) 누적 = 후; else 누적 += 변동;
    if (!받은) { 잠정 = true; reqs.push(jmReq_(이름 + ' 통지받은 날', null, '고지서(경정통지)를 받은 날 — 모든 기한의 시작', '국세기본법 §61①·§45의2① 단서')); return; }
    if (/감액/.test(종류) || 변동 < 0) {
      reqs.push(jmReq_(이름 + '(감액 ' + won(Math.abs(변동)) + ') — 나머지 세액의 불복기간 그대로', true, '감액경정은 감소분 외의 세액에 영향 없음 — 당초 처분(또는 앞 증액분)의 90일이 새로 시작되지 않음', '국세기본법 §22의3②'));
      notes.push(이름 + ': 감액으로 줄어든 ' + won(Math.abs(변동)) + '은 환급·충당(환급가산금은 「환급가산금」 묶음) — 더 깎아 달라는 다툼은 원 처분의 기한 안에서만');
      return;
    }
    const e90 = shift(famAddD_(받은, 90)), e3 = shift(apAddM_(받은, 3));
    const cap = 신고기한 ? shift(famAddY_(신고기한, 5)).날 : null; const e3c = cap && e3.날 > cap ? cap : e3.날;
    기한.push({ 무엇: 이름 + ' 증액분 ' + won(변동) + ' 불복(이의신청·심사·심판 90일)', 끝: e90.날, 상태: 상태(e90.날), 근거: '국세기본법 §61①·§66①·§68①' });
    기한.push({ 무엇: 이름 + ' 증액분 경정청구(안 날부터 3개월' + (cap ? ', 5년 안 한정' : '') + ')', 끝: e3c, 상태: 상태(e3c), 근거: '국세기본법 §45의2① 단서(2024.12.31. 개정 — 90일 → 3개월)' });
    const 불복 = String(c.불복 || '없음'), 불복일 = jmYmd_(c.불복일);
    const ok = 불복일 ? 불복일 <= e90.날 : (today <= e90.날 ? null : false);
    reqs.push(jmReq_(이름 + ' 증액분 ' + won(변동) + ' 다툴 길', ok, 불복일 ? (불복 + ' ' + 불복일 + (ok ? ' — 90일 안' : ' — 90일 넘김(' + e90.날 + ')')) : (today <= e90.날 ? '90일 ' + e90.날 + '까지 불복 또는 3개월 ' + e3c + '까지 경정청구 — 남음' : '90일(' + e90.날 + ')·3개월(' + e3c + ') 모두 지남 — 증액분 확정'), '국세기본법 §22의3①·§61①·§45의2① 단서'));
    if (불복일 && ok === false) notes.push(이름 + ': 기한 넘긴 불복은 각하 — 후발적 사유(§45의2②)가 있으면 그 길만');
    // 결정·판결 뒤 과세관청 재처분 1년
    const 결 = jmYmd_(c.결정통지일), 결종 = String(c.결정종류 || '');
    if (결) {
      const e90b = shift(famAddD_(결, 90));
      if (/기각|일부|각하/.test(결종)) 기한.push({ 무엇: 이름 + ' ' + 결종 + ' 뒤 다음 단계(심판→소송 90일)', 끝: e90b.날, 상태: 상태(e90b.날), 근거: '국세기본법 §56③·§61②' });
      if (/재조사/.test(결종)) notes.push(이름 + ': 재조사 결정 — 처분청 재조사 뒤 처분 결과 통지받은 날부터 90일 안 심사·심판 또는 바로 소송(§56② 단서·④)');
      if (/인용|일부/.test(결종)) { const e1 = shift(famAddY_(결, 1)); 기한.push({ 무엇: 이름 + ' 결정 확정 뒤 과세관청 재처분 가능 기간(특례제척 1년)', 끝: e1.날, 상태: 상태(e1.날), 근거: '국세기본법 §26의2⑥1호' }); notes.push(이름 + ': 이겨도 결정·판결 취지에 따른 다른 사유의 재처분이 1년 안 가능(§26의2⑥1호) — 연동 세목·과세기간도 1년(1의2호)'); }
    }
  });

  // 3) 판결 뒤
  const j = p.판결 || {};
  if (jmYmd_(j.확정일)) {
    const d = jmYmd_(j.확정일), e1 = shift(famAddY_(d, 1));
    기한.push({ 무엇: '판결 확정 뒤 과세관청 경정·재처분(특례제척 1년)', 끝: e1.날, 상태: 상태(e1.날), 근거: '국세기본법 §26의2⑥1호' });
    if (jmYn_(j.명의대여확인) === true || j.실질귀속자) notes.push('명의대여·실질귀속자가 판결로 확인됨 — 당초 처분을 취소하고 1년 안 실질귀속자(' + (j.실질귀속자 || '') + ')에게 다시 과세(§26의2⑦) — 「부동산명의신탁」·「차명계좌」 묶음과 같이');
    if (/승/.test(String(j.결과 || ''))) { const e3 = shift(apAddM_(d, 3)); 기한.push({ 무엇: '판결로 거래가 달리 확정 — 연관 세목·연도 후발적 경정청구(안 날부터 3개월)', 끝: e3.날, 상태: 상태(e3.날), 근거: '국세기본법 §45의2②1호' }); }
  }

  // 4) 경우 — 다투려는 것
  const 다 = String(p.다투려는것 || '모두');
  const 증액들 = 기한.filter(function (k) { return /증액분 .*불복/.test(k.무엇); });
  경우.push({ 이름: '① 법대로 — 당초분은 5년 경정청구, 증액분은 각각 90일 불복·3개월 경정청구, 감액은 새 기간 없음', 줄: 기한.map(function (k) { return k.무엇 + ' → ' + k.끝 + ' (' + k.상태 + ')'; }) });
  경우.push({ 이름: '② [견주기] 마지막 증액 고지 뒤 90일 안에 전체 세액(당초분 포함)을 다툴 수 있다고 봄', 줄: ['당초 신고분은 §22의3①로 따로 — 5년 경정청구 기한이 지났으면 못 돌려받음' + (당초 ? '(당초 ' + won(당초) + ')' : '')] });
  경우.push({ 이름: '③ [견주기] 감액경정 통지일부터 90일을 다시 셈', 줄: ['감액경정은 감소분 외 세액의 권리·의무에 영향 없음(§22의3②) — 원 처분 기한 그대로'] });
  if (증액들.length > 1) 경우.push({ 이름: '④ [견주기] 여러 번 증액을 마지막 것 하나로 묶어 다툼', 줄: ['증액분마다 통지받은 날이 달라 90일·3개월이 따로 — 앞 증액분은 그 기한 안에만'] });
  할일.push({ 무엇: '경정마다 고지서 받은 날(우편 수령일·전자고지 열람일) 증빙 모으기', 때: '지금', 근거: '국세기본법 §61①(안 날 = 받은 날)' });
  if (today && 기한.some(function (k) { return /남음/.test(k.상태) && Math.round(jmDays_(today, k.끝)) <= 14; })) 할일.push({ 무엇: '2주 안 끝나는 기한 — 「불복기한」 묶음으로 날짜(공휴일 이동) 다시 확인해 서류 접수', 때: '즉시', 근거: '국세기본법 §5①' });

  const w = jmWrap_('증액경정', reqs, { 기준일: today, 당초신고세액: 당초, 확정세액: 누적, 기한: 기한, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = (기한.length ? '기한 ' + 기한.length + '개 — ' + 기한.filter(function (k) { return /남음/.test(k.상태); }).length + '개 남음' : '기한을 못 셈') + (w.잠정 ? ' — 잠정' : '');
  w.표시 = '증액경정 ' + w.결론;
  return w;
}

// [2026.11.04 모의사건 159] 특허권·상표권·저작권 등 무체재산권 — 상속·증여 평가(장래 수입 현재가치, 취득가액 잔액과 큰 쪽)와 팔거나 빌려줄 때 기타소득(60% 필요경비·원천징수)
//  근거 원문(2026.11.04 업무관리자\법령 읽기용 판 — 상증법 20260102·시행령 20261001·시행규칙 20260320·소득세법 20260701·시행령 20261001 시행판):
//   상증법 §64(무체재산권 가액 = 1호 취득가액 − 취득일부터 평가기준일까지 법인세법상 감가상각비 / 2호 장래 경제적 이익을 고려해 대통령령으로 평가한 금액 중 큰 금액)
//   시행령 §59⑤(특허권·실용신안권·상표권·디자인권·저작권 등: 장래 각 연도 수입금액을 재정경제부령으로 환산한 금액의 합계. 수입이 확정되지 않았으면 평가기준일 전 3년 각 연도 수입 합계를 평균한 금액을 각 연도 수입으로 할 수 있음) ②④(영업권·어업권은 영업권 산식 — 「기타자산」·영업권 묶음) ⑥(광업권 — 채굴가능연수)
//   시행규칙 §19②(각 연도 수입금액 ÷ (1 + 10/100)ⁿ, n = 평가기준일부터의 경과연수) ③(최종 경과연수 = 존속기간 − 평가기준일 전일까지 경과연수, 20년 초과면 20년)
//   소득세법 §21①7호(광업권·어업권·산업재산권·산업정보·상표권·영업권 등을 양도·대여하고 받는 금품 = 기타소득) · 5호(저작자 외의 자가 저작권을 양도·사용하게 하고 받는 금품) · §94①4호 가(사업용 부동산과 함께 양도하는 영업권은 양도소득 기타자산)
//   시행령 §87 1의2(7호 등은 받은 금액의 60%를 필요경비, 실제가 크면 실제 — 5호 저작권은 이 목록에 없음 [확인 필요]) · §14③8호 가(기타소득금액 300만원 이하면 분리과세 선택) · 원천징수 20%(§129①6호 [확인 필요])
//   소득세법 §12 3호 어(직무발명보상금 비과세 — 대통령령 금액)
//  놓치던 것: ① 특허권을 취득가액 잔액(또는 0)으로만 넣어 로열티 계약이 있는데 장래 수입을 안 봄 ② 할인(10%) 없이 단순 합, 20년 한도 안 봄 ③ 상속인이 특허를 팔면 양도소득세가 아니라 기타소득(60% 경비·원천 20%) ④ 영업권은 사업용 부동산과 함께 넘기면 양도소득 ⑤ 저작권 상속인의 사용료는 60% 경비 목록 밖
//  p: { 상황(상속|증여|양도|사용료), 평가기준일, 권리들:[{ 이름, 종류(특허권|실용신안권|상표권|디자인권|저작권|영업권|광업권|기타), 취득가액, 감가상각누계, 존속만료일, 잔여존속연수, 연도별수입:[원…], 최근3년수입:[원,원,원] }],
//       양도: { 종류, 양도가액 또는 사용료(연), 실제경비, 취득가액(상속·증여 평가액 등), 양도자(상속인|원저작자|발명자), 사업용부동산과함께(예|아니오), 특수관계(예), 시가(평가액) } }
function judgeIntangibleRight_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [], 표 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 상황 = String(p.상황 || '상속'), 기준일 = jmYmd_(p.평가기준일);
  let 잠정 = false, 평가합 = 0, 단순합계 = 0, 잔액합 = 0;

  if (/상속|증여/.test(상황)) {
    (p.권리들 || []).forEach(function (r, i) {
      const 이름 = r.이름 || ('권리' + (i + 1)), 종류 = String(r.종류 || '');
      if (/영업권|어업권|양식업권/.test(종류)) { reqs.push(jmReq_(이름 + ' 평가', null, '영업권·어업권은 시행령 §59②④ 영업권 산식(초과이익 × 5년) — 「기타자산」 묶음·영업권 계산기로', '시행령 §59②④')); 잠정 = true; return; }
      if (/광업권|채석권/.test(종류)) { reqs.push(jmReq_(이름 + ' 평가', null, '광업권은 채굴가능연수 동안 3년 평균 소득을 환산(시행령 §59⑥) — 따로 셈', '시행령 §59⑥')); 잠정 = true; return; }
      const 취득 = num(r.취득가액), 상각 = num(r.감가상각누계), 잔액 = Math.max(0, 취득 - 상각);
      let n = Number(r.잔여존속연수) > 0 ? Number(r.잔여존속연수) : (jmYmd_(r.존속만료일) && 기준일 ? jmDays_(기준일, jmYmd_(r.존속만료일)) / 365.25 : 0);
      const n0 = n; n = Math.min(20, Math.ceil(n));
      let 수입 = (r.연도별수입 || []).map(num).filter(function (v) { return v > 0; }), 수입근거 = '확정 계약 연도별 수입';
      if (!수입.length && (r.최근3년수입 || []).length) { const xs = (r.최근3년수입 || []).map(num); const avg = Math.round(xs.reduce(function (t, v) { return t + v; }, 0) / xs.length); 수입 = []; for (let k = 0; k < n; k++) 수입.push(avg); 수입근거 = '최근 3년 평균 ' + won(avg) + '을 각 연도 수입으로(시행령 §59⑤ 후단) [확인 필요: 평균 방법은 시행규칙]'; }
      if (수입.length > n) 수입 = 수입.slice(0, n);
      let pv = 0, 단순 = 0; 수입.forEach(function (v, k) { pv += v / Math.pow(1.1, k + 1); 단순 += v; }); pv = Math.round(pv);
      const 가액 = Math.max(잔액, pv);
      let ok = null, 왜 = '';
      if (!n0 && !수입.length && !취득) { 왜 = '존속기간(특허 출원일부터 20년·저작권 사후 70년 등)과 장래 수입(계약서·최근 3년 로열티), 취득가액을 모름'; }
      else { ok = (n0 > 0 || !수입.length) ? true : null; 왜 = '장래 수입 현재가치 ' + won(pv) + '(' + 수입.length + '년, ' + 수입근거 + ', 연 10% 할인' + (n0 > 20 ? ', 20년 한도' : '') + ')' + ' vs 취득가액 잔액 ' + won(잔액) + ' → 큰 쪽 ' + won(가액) + (n0 <= 0 && 수입.length ? ' — 잔여 존속기간을 몰라 수입 연수 그대로 씀(존속기간 확인)' : ''); if (n0 <= 0 && 수입.length) 잠정 = true; }
      if (ok !== true) 잠정 = true;
      평가합 += 가액; 단순합계 += Math.max(잔액, 단순); 잔액합 += 잔액;
      표.push({ 이름: 이름, 종류: 종류, 잔여연수: Math.round(n0 * 10) / 10, 쓴연수: 수입.length, 현재가치: pv, 취득잔액: 잔액, 가액: 가액 });
      reqs.push(jmReq_(이름 + ' 평가', ok, 왜, '상증법 §64·시행령 §59⑤·시행규칙 §19②③'));
      if (/저작권/.test(종류)) notes.push(이름 + ': 저작권 존속기간은 저작자 사망 뒤 70년(저작권법 §39) — 평가는 20년 한도(시행규칙 §19③)');
      if (/특허/.test(종류)) notes.push(이름 + ': 특허권 존속기간은 출원일부터 20년(특허법 §88) — 등록원부로 만료일 확인');
    });
    if (표.length) notes.push('첫해 수입의 n을 1로 두고 할인함(평가기준일부터의 경과연수) [확인 필요 — 권장: n=1부터] · 수입이 매년 다르면 계약서 금액 그대로, 미확정이면 3년 평균');
    if (단순합계 !== 평가합 && 단순합계 > 평가합) notes.push('할인 없이 수입을 그냥 더하면 ' + won(단순합계) + ' — 법대로 ' + won(평가합));
    if (/증여/.test(상황) && jmYn_(p.특수관계) === true) notes.push('특수관계인에게 평가액보다 싸게 넘기면 상증법 §35 저가 양수 증여·소득세법 §101 부당행위 — 시가 = 이 평가액');
    할일.push({ 무엇: '특허·상표 등록원부(존속기간)·실시(사용)계약서·최근 3년 로열티 입금 내역·취득 원가와 상각 명세', 때: '신고 전', 근거: '상증법 §64·시행령 §59⑤' });
  }

  // 팔거나 빌려줄 때
  const y = p.양도 || {};
  let 소득금액 = 0, 원천 = 0, 소득구분 = '';
  const 금액 = num(y.양도가액) || num(y.사용료);
  if ((/양도|사용료/.test(상황) || 금액 > 0)) {
    const 종류 = String(y.종류 || (p.권리들 && p.권리들[0] && p.권리들[0].종류) || ''), 양도자 = String(y.양도자 || '상속인');
    if (/영업권/.test(종류) && jmYn_(y.사업용부동산과함께) === true) { 소득구분 = '양도소득(기타자산)'; reqs.push(jmReq_('영업권을 사업용 부동산과 함께 양도', true, '양도소득 기타자산(§94①4호 가) — 「기타자산」 묶음·양도소득세 계산기로', '소득세법 §94①4호 가')); }
    else if (/저작권/.test(종류) && /원저작자|저작자/.test(양도자)) { 소득구분 = '사업소득 또는 기타소득 15호'; reqs.push(jmReq_('저작자 본인의 저작권 대가', null, '계속·반복이면 사업소득, 일시적이면 기타소득 15호(문예창작, 60%) — 세무사님께 여쭘', '소득세법 §19·§21①15호')); 잠정 = true; }
    else if (/저작권/.test(종류)) { 소득구분 = '기타소득 5호(저작자 외의 자)'; const 실제 = num(y.실제경비) + num(y.취득가액); 소득금액 = Math.max(0, 금액 - 실제); 원천 = Math.round(소득금액 * 0.2); reqs.push(jmReq_('상속인의 저작권 양도·사용료 — 기타소득 5호', true, '받은 금액 ' + won(금액) + ' − 실제 경비 ' + won(실제) + ' = ' + won(소득금액) + ' — 60% 간주경비 목록(시행령 §87 1의2)에 5호가 없어 실제 경비만 [확인 필요]', '소득세법 §21①5호·시행령 §87')); }
    else { 소득구분 = '기타소득 7호'; const 법정 = Math.round(금액 * 0.6), 실제 = num(y.실제경비) + num(y.취득가액), 경비 = Math.max(법정, 실제); 소득금액 = Math.max(0, 금액 - 경비); 원천 = Math.round(소득금액 * 0.2); reqs.push(jmReq_((/사용료/.test(상황) || num(y.사용료) ? '대여(사용료)' : '양도') + ' — 산업재산권 기타소득 7호', true, '받은 금액 ' + won(금액) + ' − 필요경비 ' + won(경비) + (실제 > 법정 ? '(실제, 취득가액 포함)' : '(60%)') + ' = ' + won(소득금액), '소득세법 §21①7호·시행령 §87 1의2')); }
    if (/기타소득 (7호|5호)/.test(소득구분)) {
      notes.push('원천징수 20% ' + won(원천) + '(지방소득세 별도) — 지급하는 쪽이 뗌 · 기타소득금액 300만원 초과면 다음 해 5월 종합소득 합산(300만원 이하는 분리과세 선택 §14③8호 가)');
      if (잠정 === false && num(y.양도가액) && jmYn_(y.특수관계) === true && num(y.시가) > 금액) notes.push('특수관계인에게 시가(평가액 ' + won(num(y.시가)) + ')보다 싸게 — 받는 쪽 §35 증여, 파는 쪽 부당행위(§101) 검토');
      할일.push({ 무엇: 소득금액 > 3000000 ? '종합소득세 확정신고에 기타소득 합산' : '분리과세 선택 여부 결정', 때: '다음 해 5월', 근거: '소득세법 §14③8호 가·§70' });
    }
    if (jmYn_(y.직무발명) === true) notes.push('종업원·교직원이 받는 직무발명보상금은 연 700만원까지 비과세(§12 3호 어·시행령 §17의3) [확인 필요 — 금액은 시행령] — 특허권 자체의 양도와 구분');
    if (금액 > 0 && /기타소득 7호/.test(소득구분)) {
      경우.push({ 이름: '① 법대로 — 기타소득 7호, 소득금액 ' + won(소득금액) + ', 원천 20% ' + won(원천), 세액: 원천, 줄: ['종합과세 시 다른 소득과 합산(세율 6~45%) — 원천 20%는 기납부'] });
      경우.push({ 이름: '② [견주기] 양도소득세로 잘못 신고 — 특허권은 §94 양도소득 자산이 아님', 세액: 0, 줄: ['세목 틀림 → 기타소득 무신고'] });
      경우.push({ 이름: '③ [견주기] 60% 필요경비를 놓치고 전부 소득으로', 세액: Math.round(금액 * 0.2), 줄: [] });
    }
  }

  const w = jmWrap_('무체재산권', reqs, { 상황: 상황, 표: 표, 평가합: 평가합, 할인없는합: 단순합계, 취득잔액합: 잔액합, 소득구분: 소득구분, 기타소득금액: 소득금액, 원천징수: 원천, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  if (/상속|증여/.test(상황) && 평가합 > 0) 경우.unshift({ 이름: '① 법대로 — 평가액 ' + won(평가합) + '(장래 수입 현재가치 vs 취득 잔액 큰 쪽)', 금액: 평가합 }, { 이름: '② [견주기] 취득가액 잔액 ' + won(잔액합) + '만 넣음(장래 수입 무시)', 금액: 잔액합 }, { 이름: '③ [견주기] 할인 없이 수입 단순 합 ' + won(단순합계), 금액: 단순합계 });
  w.결론 = /상속|증여/.test(상황) ? (평가합 ? '평가액 ' + won(평가합) : '평가 못 함') + (w.잠정 ? ' — 잠정' : '') : (소득구분 ? 소득구분 + (소득금액 ? ' ' + won(소득금액) + '(원천 ' + won(원천) + ')' : '') : '가르지 못함') + (w.잠정 ? ' — 잠정' : '');
  w.표시 = '무체재산권 ' + w.결론;
  return w;
}

// [2026.11.04 모의사건 158] 서화·골동품(미술품) — 상속·증여 평가(전문감정 둘 이상·감정평가심의회), 감정수수료 공제, 문화유산·미술품 물납, 팔 때 기타소득(6천만원·필요경비 80~90%·분리과세·원천징수)
//  근거 원문(2026.11.04 업무관리자\법령 읽기용 판 — 상증법 20260102·시행령 20261001·소득세법 20260701·시행령 20261001 시행판):
//   상증법 §62②(서화·골동품 등 유형재산은 대통령령 방법) · 시행령 §52②2호(판매용 아닌 서화·골동품 등: 전문분야별 둘 이상 전문감정기관 감정가액 평균. 단서: 국세청장 위촉 3인 이상 감정평가심의회 가액에 미달하면 심의회 가액, 특수관계인 간 양도·양수로 심의회 가액 150% 초과해도 심의회 가액. 분야 가~사) · ②1호(판매용 상품은 처분 예상가액, 없으면 장부가액)
//   상증법 §25①2호(상속재산 감정평가 수수료 공제 — 시행령 §20의3, 유형재산 전문가 감정수수료 500만원 한도 [엔진 artAppraisalFeeAmount와 같음]) · 상증법 §73의2①(문화유산·미술품 물납: 납부세액 2천만원 초과 + 납부세액이 상속재산 중 금융재산가액 초과) ②③(세무서장 → 문체부 통보, 문체부가 가치 인정해 요청) · 시행령 §75의2①(대상: 지정·등록 문화유산, 회화·판화·조각·공예·서예 등 미술품 — 부동산 제외)
//   소득세법 §21②(대통령령 서화·골동품 양도 소득은 기타소득 — 사업장 갖춘 경우 제외) · 시행령 §41⑭(개당·점당·조당 양도가액 6천만원 이상, 회화·데생·파스텔·콜라주·오리지널 판화·석판화·제작 100년 넘은 골동품 등. 단서: 양도일 현재 생존한 국내 원작자 작품 제외) ⑱(사업장·사업자등록이면 사업소득)
//   소득세법 §12 5호 사(박물관·미술관에 양도한 소득 비과세) · 시행령 §87 2호(필요경비: 1억원 이하 90%, 1억원 초과 9천만원 + 초과분 80%(보유 10년 이상 90%), 실제 경비가 크면 실제) · §14③8호 다(§21② 기타소득은 분리과세) · §129①6호(기타소득 원천징수 20% [확인 필요]) · §155의5(양수자가 원천징수 곤란하면 양도자가 원천징수의무자)
//  놓치던 것: ① 감정 하나로 상속 평가 ② 특수관계 저가·고가 거래의 심의회 150% 단서 ③ 팔 때 양도소득세로 잘못 보거나(서화는 양도소득 자산 아님) 종합과세로 잘못 셈 ④ 6천만원·생존 작가·박물관 양도 비과세 문턱 ⑤ 미술품 물납(§73의2) 길
//  p: { 상황(상속|증여|양도), 평가기준일, 물건들:[{ 이름, 분야(서화|전적|도자기|토기|철물|목공예|민속장신구|선사유물|석공예|골동품|미술품), 판매용(예|아니오), 감정들:[{기관, 가액}], 심의회가액, 특수관계거래(예|아니오), 감정수수료 }],
//       상속: { 납부세액, 금융재산가액, 물납희망(예), 문화유산지정(예|아니오) },
//       양도: { 양도가액(개당), 보유기간년, 생존국내원작자(예|아니오), 양수자(박물관|미술관|화랑|경매|개인), 사업장(예|아니오), 실제경비, 취득가액(상속·증여 평가액 등), 원작자국내(예|아니오) } }
function judgeArtAntique_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [], 표 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 상황 = String(p.상황 || '상속');
  let 잠정 = false, 평가합 = 0, 수수료합 = 0;

  // 1) 상속·증여 평가
  if (/상속|증여/.test(상황)) {
    (p.물건들 || []).forEach(function (a, i) {
      const 이름 = a.이름 || ('물건' + (i + 1)), 감정 = (a.감정들 || []).map(function (g) { return num(g.가액); }).filter(function (v) { return v > 0; });
      const 심의 = num(a.심의회가액), 특수 = jmYn_(a.특수관계거래) === true;
      let 가액 = 0, 왜 = '', ok = null;
      if (jmYn_(a.판매용) === true) { 가액 = num(a.처분예상가액) || num(a.장부가액); ok = 가액 ? true : null; 왜 = '판매용 상품 — 처분 예상가액, 없으면 장부가액(시행령 §52②1호)'; }
      else if (감정.length >= 2) {
        const 평균 = Math.round(감정.reduce(function (t, v) { return t + v; }, 0) / 감정.length);
        가액 = 평균; ok = true; 왜 = '전문감정기관 ' + 감정.length + '곳 평균 ' + won(평균);
        if (심의 > 0 && 평균 < 심의) { 가액 = 심의; 왜 += ' < 감정평가심의회 ' + won(심의) + ' → 심의회 가액(단서)'; }
        else if (심의 > 0 && 특수 && 평균 > 심의 * 1.5) { 가액 = 심의; 왜 += ' > 심의회 가액 150%(특수관계 양도·양수) → 심의회 가액(단서)'; }
      } else if (감정.length === 1) { 가액 = 감정[0]; ok = null; 왜 = '감정 한 곳 ' + won(감정[0]) + ' — 전문분야별 둘 이상 전문감정기관 평균이어야 함(시행령 §52②2호)'; }
      else if (심의 > 0) { 가액 = 심의; ok = null; 왜 = '감정평가심의회 가액만 있음 ' + won(심의) + ' — 전문감정 둘 이상을 먼저 받고 심의회 가액과 견줌'; }
      else { ok = null; 왜 = '전문감정기관(분야별: 서화·전적 / 도자기·토기·철물 / 목공예·민속장신구 / 선사유물 / 석공예 / 기타 골동품 / 미술품) 둘 이상 감정'; }
      if (ok !== true) 잠정 = true;
      평가합 += 가액; 수수료합 += num(a.감정수수료);
      표.push({ 이름: 이름, 분야: a.분야 || '', 감정수: 감정.length, 평균: 감정.length ? Math.round(감정.reduce(function (t, v) { return t + v; }, 0) / 감정.length) : 0, 심의회: 심의 || null, 가액: 가액 });
      reqs.push(jmReq_(이름 + ' 평가', ok, 왜, '상증법 §62②·시행령 §52②'));
    });
    const 수수료공제 = Math.min(수수료합, 5000000);
    if (수수료합 > 0) notes.push('유형재산 전문가 감정수수료 ' + won(수수료합) + ' → 공제 ' + won(수수료공제) + '(500만원 한도, 상증법 §25①2호·시행령 §20의3 — 감정평가법인 수수료 500만원과 따로) — 엔진 칸 artAppraisalFeeAmount');
    notes.push('시가(§60) 원칙은 그대로 — 평가기간 안 경매·매매가 있으면 그 가액이 먼저이고, 없을 때 §62② 전문감정 평균(시행령 §52②2호) [확인 필요 — 권장: §60② 시가 우선]');
    // 물납
    const s = p.상속 || {};
    if (/상속/.test(상황) && (jmYn_(s.물납희망) === true || num(s.납부세액) > 0)) {
      const 납 = num(s.납부세액), 금융 = num(s.금융재산가액);
      const 대상 = jmYn_(s.문화유산지정) === true || (p.물건들 || []).some(function (a) { return /서화|미술품|회화|판화|조각|공예|서예/.test(String(a.분야 || '')); });
      reqs.push(jmReq_('문화유산·미술품 물납 요건', 납 > 20000000 && 납 > 금융 && 대상 ? true : (납 && s.금융재산가액 != null ? false : null), '납부세액 ' + won(납) + (납 > 20000000 ? ' > 2천만' : ' ≤ 2천만(✘)') + ' · 금융재산 ' + won(금융) + (납 > 금융 ? ' < 납부세액' : ' ≥ 납부세액(✘)') + (대상 ? ' · 대상(지정·등록 문화유산 또는 회화·판화·조각·공예·서예 미술품)' : ' · 골동품 일반은 대상인지 [확인 필요]'), '상증법 §73의2①·시행령 §75의2①'));
      if (납 > 20000000 && 납 > 금융 && 대상) 할일.push({ 무엇: '문화유산등 물납 신청(세무서장 → 문체부 통보 → 문체부 요청이 있어야 허가)', 때: '상속세 신고기한까지(연부연납·물납 신청과 같이)', 근거: '상증법 §73의2②③·시행령 §75의2·§75의3' });
      notes.push('물납 허가 한도·충당 순서는 시행령 §75의3~§75의5 [확인 필요]');
    }
  }

  // 2) 팔 때 — 기타소득
  const y = p.양도 || {};
  let 소득금액 = 0, 원천 = 0, 과세 = null;
  if (/양도/.test(상황) || num(y.양도가액) > 0) {
    const 가액 = num(y.양도가액), 보유 = Number(y.보유기간년) || 0, 생존 = jmYn_(y.생존국내원작자), 양수자 = String(y.양수자 || ''), 사업 = jmYn_(y.사업장);
    reqs.push(jmReq_('개당·점당·조당 양도가액 6천만원 이상', 가액 ? 가액 >= 60000000 : null, 가액 ? won(가액) + (가액 >= 60000000 ? '' : ' — 6천만원 미만은 과세 대상 아님') : '양도가액을 모름', '소득세법 시행령 §41⑭'));
    reqs.push(jmReq_('생존한 국내 원작자의 작품 아님', 생존 == null ? null : !생존, 생존 === true ? '양도일 현재 생존한 국내 원작자 작품 — 제외(과세 없음)' : 생존 === false ? '' : '작가 생존·국적 확인', '시행령 §41⑭ 단서'));
    reqs.push(jmReq_('사업장·사업자등록 없음(기타소득)', 사업 == null ? null : !사업, 사업 === true ? '사업장·사업자등록 있음 — 사업소득으로 종합과세' : '', '소득세법 §21②·시행령 §41⑱'));
    const 비과세 = /박물관|미술관/.test(양수자);
    if (비과세) reqs.push(jmReq_('박물관·미술관에 양도 — 비과세', true, '양수자 ' + 양수자, '소득세법 §12 5호 사'));
    과세 = 가액 >= 60000000 && 생존 !== true && 사업 !== true && !비과세;
    if (가액 && (생존 == null || 사업 == null)) 잠정 = true;
    if (과세) {
      const 법정경비 = 가액 <= 100000000 ? Math.round(가액 * 0.9) : 90000000 + Math.round((가액 - 100000000) * (보유 >= 10 ? 0.9 : 0.8));
      const 실제 = num(y.실제경비) + num(y.취득가액);
      const 경비 = Math.max(법정경비, 실제);
      소득금액 = Math.max(0, 가액 - 경비); 원천 = Math.round(소득금액 * 0.2);
      reqs.push(jmReq_('필요경비', true, (실제 > 법정경비 ? '실제 경비 ' + won(실제) + '(취득가액 포함)가 법정 ' + won(법정경비) + '보다 커 실제' : '법정 ' + won(법정경비) + ' = ' + (가액 <= 100000000 ? '양도가액 90%' : '9천만 + 1억 초과분 ' + won(가액 - 100000000) + ' × ' + (보유 >= 10 ? '90%(보유 10년 이상)' : '80%')) + (실제 ? ' ≥ 실제 ' + won(실제) : '')) + ' → 소득금액 ' + won(소득금액), '시행령 §87 2호'));
      notes.push('분리과세(§14③8호 다) — 종합소득에 안 넣음. 원천징수 20% ' + won(원천) + '(지방소득세 별도) — 양수자(화랑·경매사)가 떼고, 개인 양수자라 곤란하면 양도자 본인이 원천징수의무자(§155의5) [확인 필요: 20% 세율 §129①6호]');
      if (보유 < 10 && 가액 > 100000000 && jmYn_(y.상속받음) === true) notes.push('상속받은 작품의 보유기간을 피상속인 기간과 합치는지 [확인 필요] — 합치면 10년 이상 90%');
      할일.push({ 무엇: '양수자 원천징수 영수증 확보(없으면 본인이 원천징수 신고·납부)', 때: '양도 다음 달 10일', 근거: '소득세법 §127·§155의5' });
    }
    if (가액 > 0) {
      if (과세) {
        경우.push({ 이름: '① 법대로 — 기타소득 분리과세, 소득금액 ' + won(소득금액) + ' × 20% = ' + won(원천), 세액: 원천, 줄: ['양도가액 ' + won(가액) + ' − 필요경비 ' + won(가액 - 소득금액)] });
        경우.push({ 이름: '② [견주기] 양도소득세로 잘못 신고 — 서화·골동품은 양도소득 자산(§94)이 아님', 세액: 0, 줄: ['잘못된 세목 신고 → 기타소득 무신고·원천징수 누락 가산세'] });
        경우.push({ 이름: '③ [견주기] 필요경비 없이 양도가액 전부를 소득으로 봄', 세액: Math.round(가액 * 0.2), 줄: ['법정 필요경비 80~90%를 놓침'] });
        if (가액 > 100000000 && 보유 >= 10) 경우.push({ 이름: '④ [견주기] 보유 10년 이상인데 80%로 셈', 세액: Math.round(Math.max(0, 가액 - (90000000 + Math.round((가액 - 100000000) * 0.8))) * 0.2), 줄: ['10년 이상은 초과분 90%'] });
      } else 경우.push({ 이름: '① 법대로 — 과세 없음(' + (가액 < 60000000 ? '6천만원 미만' : 생존 === true ? '생존 국내 작가' : 비과세 ? '박물관·미술관 양도 비과세' : 사업 === true ? '사업소득으로 따로' : '') + ')', 세액: 0, 줄: [] });
    }
  }

  const w = jmWrap_('서화골동품', reqs, { 상황: 상황, 표: 표, 평가합: 평가합, 감정수수료공제: Math.min(수수료합, 5000000), 기타소득금액: 소득금액, 원천징수: 원천, 과세: 과세, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = /양도/.test(상황) ? (과세 === null ? '양도가액 모름 — 잠정' : 과세 ? '기타소득 ' + won(소득금액) + '(원천 20% ' + won(원천) + ')' : '과세 없음') : (평가합 ? '평가액 합 ' + won(평가합) : '평가 못 함') + (w.잠정 ? ' — 잠정' : '');
  w.표시 = '서화골동품 ' + w.결론;
  return w;
}

// [2026.11.04 모의사건 157] 국외 재산 상속·증여 평가 — 외국 부동산·외화 예금·외화 빚을 어떤 가액·어느 날 환율로 넣나
//  근거 원문(2026.11.04 업무관리자\법령 읽기용 판 — 상증법 20260102 시행판·시행령 20261001 시행판):
//   상증법 §3①(거주자 사망 → 모든 상속재산, 비거주자 → 국내 재산만) · §60①②③(평가기준일 시가 → 시가 산정 어려우면 §61~§65 보충 평가) · §60⑤(기준시가 10억원 이하 부동산은 감정기관 하나 — 시행령 §49⑥)
//   시행령 §49①(평가기간: 상속 전후 6개월·증여 전 6개월~후 3개월 안 매매·감정(둘 이상 감정 평균)·수용·경매·공매 — 특수관계 거래 등 부당한 가액 제외)
//   시행령 §58의3①(외국에 있는 재산으로서 §60~§65를 적용하는 것이 부적당하면 그 나라에서 양도소득세·상속세·증여세 등 부과 목적으로 평가한 가액) ②(그 평가액도 없으면 세무서장등이 둘 이상 국내·외국 감정기관 감정 참작)
//   시행령 §58의4(외화 자산·부채는 평가기준일 현재 외국환거래법 §5① 기준환율 또는 재정환율로 환산) · 상증법 §14①3호(거주자 사망 — 채무 공제, 외화 빚도) · §14②(비거주자 — 그 국내 상속재산 관련 공과금·채무만)
//   상증법 §29(외국납부세액공제 — 「상속외국납부」 묶음) · §67④(피상속인·상속인 외국 주소면 신고기한 9개월 — 「신고기한」 묶음)
//  놓치던 것: ① 외국 부동산을 현지 과세 목적 평가액(미국 county assessed value 등 — 보통 시가보다 낮음)으로 바로 넣기 — 시가(매매·둘 이상 감정)가 있으면 그것이 먼저(§58의3①은 「부적당한 경우」에만)
//            ② 환율을 신고일·송금일·납부일 것으로 쓰기 — 평가기준일(사망일·증여일) 기준환율(§58의4) ③ 외화 빚(모기지)을 빼먹거나 다른 날 환율로 ④ 비거주자 피상속인인데 국외 재산을 넣기
//  p: { 종류(상속|증여), 평가기준일(상속개시일 또는 증여일), 피상속인거주자(예|아니오), 수증자거주자, 증여자거주자,
//       재산들:[{ 이름, 나라, 종류(부동산|예금|주식|기타), 통화(USD|JPY|EUR|…), 외화금액(시가 또는 평가액), 근거(매매|감정|현지과세평가|기준시가|없음), 근거날짜, 감정기관수, 특수관계거래(예), 기준환율(평가기준일 — 1통화당 원), 다른날환율(견주기용), 현지과세평가액(외화) }],
//       채무들:[{ 이름, 통화, 외화금액, 기준환율, 담보재산(이름) }], 국내재산합계(원), 국내채무합계(원), 엔진칸{…} }
function judgeForeignAssetValuation_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [], 표 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 증여 = /증여/.test(String(p.종류 || '상속'));
  const 기준일 = jmYmd_(p.평가기준일) || jmYmd_(p.상속개시일) || jmYmd_(p.증여일);
  const 거주 = 증여 ? jmYn_(p.수증자거주자) : jmYn_(p.피상속인거주자);
  let 잠정 = false;

  // 1) 국외 재산이 과세 범위에 들어오나
  if (!증여) {
    reqs.push(jmReq_('피상속인 거주자(국외 재산도 상속재산)', 거주 === false ? false : 거주 === true ? true : null, 거주 === false ? '비거주자 사망 — 국외 재산은 우리 상속세 밖(국내 재산만, 채무도 국내 재산 관련만 §14②)' : 거주 === true ? '거주자 사망 — 국내·국외 모든 재산' : '「거주자」 묶음으로 먼저 판정', '상증법 §3①·§14②'));
    if (거주 == null) 잠정 = true;
  } else {
    reqs.push(jmReq_('국외 재산 증여 과세 범위', 거주 === true ? true : 거주 === false ? null : null, 거주 === true ? '수증자 거주자 — 국외 재산도 증여세' : '수증자 비거주자면 국내 재산만(거주자가 비거주자에게 국외 재산 증여는 국조법 §35 — 「국외증여」 묶음)', '상증법 §4의2①·국조법 §35'));
    if (거주 !== true) 잠정 = true;
  }
  if (!기준일) { 잠정 = true; reqs.push(jmReq_('평가기준일', null, '상속개시일(사망일) 또는 증여일 — 환율·평가기간의 기준', '상증법 §60①')); }

  // 2) 재산마다 가액·환율
  let 국외재산합 = 0, 다른날합 = 0, 현지평가합 = 0;
  (p.재산들 || []).forEach(function (a, i) {
    const 외화 = num(a.외화금액), 환율 = Number(a.기준환율) > 0 ? Number(a.기준환율) : 0, 다른 = Number(a.다른날환율) > 0 ? Number(a.다른날환율) : 0;
    const 근거 = String(a.근거 || '없음'), 날 = jmYmd_(a.근거날짜), 감정수 = Number(a.감정기관수) || 0, 통화 = String(a.통화 || 'KRW');
    let 가액방식 = '', 왜 = '', ok = null;
    const 안 = (function () { if (!기준일 || !날) return null; const d = jmDays_(기준일, 날); return 증여 ? (d >= -183 && d <= 92) : (d >= -183 && d <= 183); })();
    if (/매매/.test(근거)) { if (jmYn_(a.특수관계거래) === true) { 가액방식 = '매매(특수관계 — 부당하면 제외)'; ok = null; 왜 = '특수관계인과의 거래가액은 객관적으로 부당하면 시가에서 제외(시행령 §49①1호 가목) — 감정으로'; } else if (안 === false) { 가액방식 = '매매(평가기간 밖)'; ok = null; 왜 = '매매일 ' + 날 + '이 평가기간 밖 — 평가심의위원회 거쳐야 시가(§49① 단서)'; } else { 가액방식 = '매매가액(시가)'; ok = true; 왜 = '평가기간 안 매매 — 시가'; } }
    else if (/감정/.test(근거)) { if (감정수 >= 2 || (감정수 === 1 && /부동산/.test(String(a.종류)) && 외화 * 환율 <= 1000000000)) { 가액방식 = '감정가액(시가)'; ok = 안 === false ? null : true; 왜 = (감정수 >= 2 ? '둘 이상 감정 평균' : '기준시가 10억원 이하 부동산 — 감정 하나(§60⑤)') + (안 === false ? ' — 감정일이 평가기간 밖, 평가심의위원회' : ''); } else { 가액방식 = '감정 하나(부족)'; ok = null; 왜 = '감정기관 둘 이상 평균이 원칙(시행령 §49①2호) — 10억원 넘는 부동산·주식은 하나로 부족'; } }
    else if (/현지|과세/.test(근거)) { 가액방식 = '현지 과세 목적 평가액(§58의3①)'; ok = null; 왜 = '§60~§65 적용이 「부적당한 경우」에만 — 평가기간 안 매매·감정이 있으면 그것이 먼저, 없음을 확인한 뒤 이 가액'; }
    else if (/기준시가/.test(근거)) { 가액방식 = '보충 평가(§61)'; ok = null; 왜 = '외국 부동산에 우리 기준시가는 없음 — 현지 과세 평가액(§58의3①) 또는 둘 이상 감정(②)'; }
    else { 가액방식 = '없음'; ok = null; 왜 = '시가(매매·감정) → 현지 과세 평가액 → 세무서장 감정 순으로 확보'; }
    if (ok !== true) 잠정 = true;
    const 원화 = 환율 ? Math.round(외화 * 환율) : (통화 === 'KRW' ? 외화 : 0);
    if (!원화) { 잠정 = true; 왜 += ' · 평가기준일 기준환율(' + 통화 + ')이 없어 원화로 못 바꿈'; }
    const 다른원화 = 다른 ? Math.round(외화 * 다른) : 0;
    국외재산합 += 원화; 다른날합 += 다른원화 || 원화; 현지평가합 += num(a.현지과세평가액) && 환율 ? Math.round(num(a.현지과세평가액) * 환율) : 원화;
    표.push({ 이름: a.이름 || ('재산' + (i + 1)), 나라: a.나라 || '', 종류: a.종류 || '', 통화: 통화, 외화: 외화, 기준환율: 환율 || null, 원화: 원화, 방식: 가액방식 });
    reqs.push(jmReq_((a.이름 || '재산' + (i + 1)) + ' 가액', ok, 가액방식 + ' ' + (외화 ? 외화.toLocaleString('ko-KR') + ' ' + 통화 : '') + (환율 ? ' × ' + 환율 + ' = ' + won(원화) : '') + ' — ' + 왜, '상증법 §60·시행령 §49①·§58의3·§58의4'));
  });
  // 3) 외화 채무
  let 채무합 = 0;
  (p.채무들 || []).forEach(function (d, i) {
    const 외화 = num(d.외화금액), 환율 = Number(d.기준환율) > 0 ? Number(d.기준환율) : 0, 원화 = 환율 ? Math.round(외화 * 환율) : (String(d.통화 || 'KRW') === 'KRW' ? 외화 : 0);
    if (!원화) 잠정 = true;
    채무합 += 원화;
    reqs.push(jmReq_((d.이름 || '채무' + (i + 1)) + ' 공제', 거주 === false ? (d.담보재산 ? null : false) : (원화 ? true : null), 거주 === false ? '비거주자 — 국내 상속재산에 관한 채무만(§14②)' : (원화 ? 외화.toLocaleString('ko-KR') + ' ' + (d.통화 || '') + ' × ' + 환율 + ' = ' + won(원화) + ' (평가기준일 환율)' : '평가기준일 기준환율 필요'), '상증법 §14①3호·시행령 §58의4'));
  });
  if ((p.재산들 || []).length) notes.push('환율은 평가기준일(' + (기준일 || '사망일·증여일') + ') 현재 외국환거래법 §5① 기준환율(USD) 또는 재정환율(그 밖 통화) — 신고일·송금일·납부일 환율이 아님(시행령 §58의4). 한국은행·서울외국환중개 고시값을 쓸 것');
  if (다른날합 && 다른날합 !== 국외재산합) notes.push('다른 날 환율로 넣으면 국외 재산 합계 ' + won(다른날합) + '(법대로 ' + won(국외재산합) + ') — 차이 ' + won(Math.abs(다른날합 - 국외재산합)));
  if (현지평가합 && 현지평가합 !== 국외재산합) notes.push('현지 과세 목적 평가액으로 넣으면 ' + won(현지평가합) + ' — 시가(매매·감정)가 있는데 이것을 쓰면 과소신고');
  notes.push('외국에서 낸 상속세·유산세는 「상속외국납부」 묶음(§29)으로 공제 — 외국 납부액 환산 환율은 [확인 필요]');
  if (!증여) { if (jmYn_(p.피상속인외국주소) === true || jmYn_(p.상속인외국주소) === true) notes.push('피상속인·상속인이 외국에 주소 — 신고기한 9개월(§67④)'); 할일.push({ 무엇: '국외 재산마다 평가기간 안 매매·감정(둘 이상, 10억 이하 부동산은 하나) 확보, 없으면 현지 과세 평가서 번역본', 때: '신고 전', 근거: '시행령 §49①·§58의3' }); 할일.push({ 무엇: '평가기준일 기준환율·재정환율 고시 자료 첨부', 때: '신고 때', 근거: '시행령 §58의4' }); }
  else 할일.push({ 무엇: '증여일 기준환율 고시 자료·현지 평가 자료 첨부', 때: '증여일 속한 달 말일부터 3개월', 근거: '상증법 §68·시행령 §58의4' });

  // 4) 경우(엔진칸) — 상속이면 과세가액을 만들어 계산기로
  const 국내 = num(p.국내재산합계), 국내채무 = num(p.국내채무합계);
  if (!증여 && 거주 !== false && 국외재산합 > 0) {
    const 가액 = Math.max(0, 국내 + 국외재산합 - 국내채무 - 채무합);
    const base = Object.assign({ isDecedentResident: true }, p.엔진칸 || {});
    경우.push({ 이름: '① 법대로 — 국외 ' + won(국외재산합) + '(평가기준일 환율·시가) − 외화 빚 ' + won(채무합) + ' → 과세가액 ' + won(가액), 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, { taxableEstateAmount: 가액 }) });
    if (다른날합 && 다른날합 !== 국외재산합) 경우.push({ 이름: '② [견주기] 다른 날(신고일 등) 환율 — 과세가액 ' + won(Math.max(0, 국내 + 다른날합 - 국내채무 - 채무합)), 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, { taxableEstateAmount: Math.max(0, 국내 + 다른날합 - 국내채무 - 채무합) }) });
    if (현지평가합 && 현지평가합 !== 국외재산합) 경우.push({ 이름: '③ [견주기] 현지 과세 평가액으로 — 과세가액 ' + won(Math.max(0, 국내 + 현지평가합 - 국내채무 - 채무합)), 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, { taxableEstateAmount: Math.max(0, 국내 + 현지평가합 - 국내채무 - 채무합) }) });
    if (채무합 > 0) 경우.push({ 이름: '④ [견주기] 외화 빚 ' + won(채무합) + '을 빼먹음', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, base, { taxableEstateAmount: 가액 + 채무합 }) });
  } else if (증여 && 거주 === true && 국외재산합 > 0) {
    경우.push({ 이름: '① 법대로 — 국외 재산 ' + won(국외재산합) + ' 증여', 엔진: 'calculate_gift_tax', 엔진칸: Object.assign({ giftAmount: 국외재산합, relation: p.관계 || '직계존속', giftDate: 기준일 || undefined }, p.엔진칸 || {}) });
    if (다른날합 && 다른날합 !== 국외재산합) 경우.push({ 이름: '② [견주기] 다른 날 환율 ' + won(다른날합), 엔진: 'calculate_gift_tax', 엔진칸: Object.assign({ giftAmount: 다른날합, relation: p.관계 || '직계존속', giftDate: 기준일 || undefined }, p.엔진칸 || {}) });
  }

  const w = jmWrap_('국외재산평가', reqs, { 종류: 증여 ? '증여' : '상속', 평가기준일: 기준일, 표: 표, 국외재산합: 국외재산합, 외화채무합: 채무합, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = (!증여 && 거주 === false) ? '비거주자 — 국외 재산은 과세 밖' : '국외 재산 ' + won(국외재산합) + (채무합 ? ' − 외화 빚 ' + won(채무합) : '') + ' (평가기준일 ' + (기준일 || '?') + ' 환율)' + (w.잠정 ? ' — 잠정' : '');
  w.표시 = '국외재산평가 ' + w.결론;
  return w;
}

// [2026.11.04 모의사건 156] 가족 간 금전 대여(차용증) — 무상·저리 대출 이익 증여(상증법 §41의4), 부동산 무상 담보 이용(§37②), 상환 자금 출처(§45②), 이자 받은 쪽 이자소득
//  근거 원문(2026.11.04 업무관리자\법령 읽기용 판 — 상증법 20260102 시행판·시행령 20261001 시행판·소득세법 20260701 시행판):
//   상증법 §41의4①(무상이면 대출금액 × 적정 이자율, 저리면 그 금액 − 실제 지급 이자 — 대출받은 날에 증여재산가액. 단서: 기준금액 미만이면 제외) ②(대출기간 없으면 1년, 1년 이상이면 1년 되는 날 다음 날 매년 새로 대출받은 것으로 봄) ③(특수관계 아니면 거래 관행상 정당한 사유 없는 경우만)
//   시행령 §31의4①(적정 이자율 = 재정경제부령 이자율, 법인에게서 빌리면 법인세법 시행령 §89③ 이율) ②(기준금액 1천만원) ③(여러 차례면 각 대출일 기준) · 상증법 §43②(증여일부터 소급 1년 안 같은 거래 이익 합산)
//   상증법 §37②(타인 부동산을 무상 담보로 금전 차입 — 담보 이용 개시일이 증여일) ③ · 시행령 §27⑤(차입금 × 적정 이자율 − 실제 이자, 기간 없으면 1년·넘으면 매년 새로) ⑥(1천만원)
//   상증법 §45②③(채무 상환 자금 출처 증여 추정·소명) · §4의2⑤(§41의4는 납부 능력 없으면 면제)·⑥ 단서(§41의4·§37 증여자 연대납세 없음)
//   소득세법 §16①11호(비영업대금의 이익 = 이자소득) · §129①1호 나목(원천징수 25%) · §127①1호(이자소득을 지급하는 자가 원천징수 — 개인 포함)
//  놓치던 것: 1천만원을 「넘는 부분만」 과세로 잘못 세기 쉬움(단서는 미만이면 전부 제외·이상이면 전부 과세) · 매년 새로 대출받은 것으로 봐 해마다 다시 세야 함 · 담보 이익(§37②)은 따로 1천만원 기준 · 이자를 주면 받는 부모 쪽 25% 원천징수 · 차용증 없으면 원금 자체가 증여
//  p: { 대출일, 원금, 약정이자율(연 %), 실제지급이자(연, 원 — 없으면 원금×약정이자율), 대출기간개월(없으면 12), 특수관계(예|아니오), 정당한사유(특수관계 아닐 때 예|아니오), 대여자법인(예), 적정이자율(기본 4.6),
//       차용증(예|아니오), 변제기, 이자지급흔적(예|아니오), 원금상환들:[{날짜, 금액}], 상환자금입증액, 직전1년이익들:[원…], 관계(직계존속|배우자|기타친족|기타), 수증자납부능력없음(예),
//       담보:{ 차입금, 실제이자(연), 차입기간개월, 제공자특수관계(예|아니오) }, 받는쪽: { 금융소득합계(그 해 다른 이자·배당) } }
function judgeFamilyLoan_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 대출일 = jmYmd_(p.대출일), 원금 = num(p.원금), 약정율 = Number(p.약정이자율) > 0 ? Number(p.약정이자율) : 0;
  const 개월 = Number(p.대출기간개월) > 0 ? Number(p.대출기간개월) : 12;
  const 적정율 = Number(p.적정이자율) > 0 ? Number(p.적정이자율) : 4.6;
  const 실제이자연 = p.실제지급이자 != null && p.실제지급이자 !== '' ? num(p.실제지급이자) : Math.round(원금 * 약정율 / 100);
  const 특수 = jmYn_(p.특수관계), 법인 = jmYn_(p.대여자법인) === true, 차용증 = jmYn_(p.차용증), 흔적 = jmYn_(p.이자지급흔적);
  const 상환들 = (p.원금상환들 || []).map(function (x) { return { 날짜: jmYmd_(x.날짜), 금액: num(x.금액) }; }).filter(function (x) { return x.금액 > 0; });
  const 상환합 = 상환들.reduce(function (t, x) { return t + x.금액; }, 0);
  let 잠정 = false;

  // 1) 빌린 돈인지 받은 돈인지 — 차용증·변제기·이자·상환 흔적
  const 근거수 = [차용증 === true, !!jmYmd_(p.변제기), 흔적 === true || 실제이자연 > 0, 상환합 > 0].filter(Boolean).length;
  reqs.push(jmReq_('실제 대여(증여 아님)', 차용증 === false && 흔적 !== true && 상환합 === 0 ? false : 근거수 >= 2 ? true : null,
    차용증 === false && 흔적 !== true && 상환합 === 0 ? '차용증·이자·상환 흔적이 없음 — 원금 ' + won(원금) + ' 자체가 증여로 추정될 위험' : 근거수 >= 2 ? '차용증·변제기·이자·상환 중 ' + 근거수 + '가지 갖춤' : '차용증(작성일·변제기·이자율), 이자 이체 내역, 원금 상환 내역을 갖출 것',
    '상증법 §2 6호·§45② [확인 필요 — 권장: 차용증만으로는 부족, 이자·상환 실적으로 실질 판단]'));
  if (reqs[0].결과 === '?') 잠정 = true;

  // 2) 특수관계 아니면 정당한 사유
  if (특수 === false) reqs.push(jmReq_('특수관계 아님 → 거래 관행상 정당한 사유 없을 때만 과세', jmYn_(p.정당한사유) === true ? false : jmYn_(p.정당한사유) === false ? true : null, jmYn_(p.정당한사유) == null ? '정당한 사유(시중 금리·담보·상환 능력 등) 확인' : '', '상증법 §41의4③'));
  else if (특수 == null) { reqs.push(jmReq_('특수관계인 간 대출', null, '빌려준 사람과의 관계(부모·형제·법인)를 세무사님께 여쭘', '상증법 §41의4③·시행령 §2의2')); 잠정 = true; }
  if (법인) notes.push('법인에게서 빌림 — 적정 이자율은 법인세법 시행령 §89③ 이율(가중평균차입이자율 또는 당좌대출이자율)을 씀(시행령 §31의4① 단서) — 법인 쪽 부당행위(인정이자)도 같이 봄');

  // 3) 해마다 이익 — 대출받은 날 기준, 1년 넘으면 매년 새로(§41의4②)
  const 해수 = Math.max(1, Math.ceil(개월 / 12)), 연도 = [];
  let 잔액 = 원금, 총과세 = 0;
  for (let k = 0; k < 해수; k++) {
    const 시작 = 대출일 ? famAddY_(대출일, k) : null;
    // 그 해 시작 전 상환분을 잔액에서 뺌(여러 차례 상환 — 상환일 이후 잔액으로)
    if (시작) 상환들.forEach(function (x) { if (x.날짜 && x.날짜 < 시작 && !x.뺌) { 잔액 -= x.금액; x.뺌 = true; } });
    const 월 = Math.min(12, 개월 - k * 12), 이자가정 = 실제이자연 * 월 / 12 * (원금 ? 잔액 / 원금 : 1);
    const 적정액 = Math.round(Math.max(0, 잔액) * 적정율 / 100 * 월 / 12), 이익 = Math.max(0, Math.round(적정액 - 이자가정));
    const 합산 = k === 0 ? (p.직전1년이익들 || []).reduce(function (t, v) { return t + num(v); }, 0) : 0;
    const 과세 = (이익 + 합산) >= 10000000;
    연도.push({ 해: k + 1, 증여일: 시작, 잔액: Math.max(0, 잔액), 개월: 월, 적정이자: 적정액, 실제이자: Math.round(이자가정), 이익: 이익, 직전1년합산: 합산, 과세: 과세, 증여재산가액: 과세 ? 이익 + 합산 : 0 });
    if (과세) 총과세 += 이익 + 합산;
  }
  const 첫 = 연도[0];
  reqs.push(jmReq_('무상·저리 대출 이익 1천만원 이상(연 단위)', 원금 ? 첫.과세 : null, 원금 ? ('1년차 이익 ' + won(첫.이익) + ' = ' + won(첫.잔액) + ' × ' + 적정율 + '% × ' + 첫.개월 + '/12 − 실제 이자 ' + won(첫.실제이자) + (첫.직전1년합산 ? ' + 1년 안 같은 거래 ' + won(첫.직전1년합산) : '') + (첫.과세 ? ' → 1천만원 이상이라 전액 과세(넘는 부분만이 아님)' : ' → 1천만원 미만이라 과세 없음')) : '원금을 모름', '상증법 §41의4① 단서·시행령 §31의4②·§43②'));
  if (해수 > 1) notes.push('대출 ' + 개월 + '개월 — 1년 되는 날 다음 날 매년 새로 대출받은 것으로 봐 해마다 다시 셈(§41의4②): ' + 연도.map(function (y) { return y.해 + '년차 ' + (y.증여일 || '') + ' 이익 ' + won(y.이익) + (y.과세 ? '(과세)' : '(미달)'); }).join(' · '));
  if (연도.some(function (y) { return y.과세; })) notes.push('과세되는 해의 증여세는 같은 증여자 10년 합산(§47②)·직계존속 공제 5천만원(§53)에 걸림 — 해마다 증여세 신고(대출일·그 1년 뒤 날이 증여일, 그 달 말일부터 3개월)');
  if (원금 > 0 && 약정율 === 0 && 실제이자연 === 0) { const 한도 = Math.floor(10000000 / (적정율 / 100)); notes.push('무이자로 1년 빌릴 때 이익이 1천만원 미만이 되는 원금 한도 ' + won(한도) + '(1천만원 ÷ ' + 적정율 + '%) — 넘으면 전액 과세'); }

  // 4) 담보 이익(§37②) — 따로 1천만원
  const 담 = p.담보 || {}; const 차입 = num(담.차입금); let 담보이익 = 0, 담보과세 = false;
  if (차입 > 0) {
    const 담월 = Number(담.차입기간개월) > 0 ? Math.min(12, Number(담.차입기간개월)) : 12;
    담보이익 = Math.max(0, Math.round(차입 * 적정율 / 100 * 담월 / 12 - num(담.실제이자) * 담월 / 12));
    담보과세 = 담보이익 >= 10000000;
    reqs.push(jmReq_('남의 부동산 무상 담보 이용 이익(§37②) 1천만원 이상', 담보과세, '차입금 ' + won(차입) + ' × ' + 적정율 + '% − 실제 이자 ' + won(num(담.실제이자)) + ' = ' + won(담보이익) + (담보과세 ? ' → 과세(담보 이용 개시일이 증여일, 1년 넘으면 매년)' : ' → 미달'), '상증법 §37②·시행령 §27⑤⑥'));
    if (jmYn_(담.제공자특수관계) === false) notes.push('담보 제공자가 특수관계 아니면 정당한 사유 없을 때만(§37③)');
  }

  // 5) 상환 자금 출처(§45②)
  if (상환합 > 0) {
    const 입증 = num(p.상환자금입증액);
    reqs.push(jmReq_('원금 상환 자금 출처 소명', p.상환자금입증액 == null || p.상환자금입증액 === '' ? null : 입증 >= 상환합 * 0.8, p.상환자금입증액 == null || p.상환자금입증액 === '' ? '상환 ' + won(상환합) + '의 출처(소득·차입·재산 처분) 자료' : '입증 ' + won(입증) + ' / 상환 ' + won(상환합) + (입증 >= 상환합 * 0.8 ? ' — 80% 이상 소명' : ' — 부족분 증여 추정 위험, 「자금출처」 계산기로') , '상증법 §45②③·시행령 §34'));
    if (p.상환자금입증액 == null || p.상환자금입증액 === '') 잠정 = true;
  }

  // 6) 이자 받는 쪽 — 비영업대금 이자소득
  if (실제이자연 > 0) {
    const 원천 = Math.round(실제이자연 * 0.25);
    notes.push('이자 ' + won(실제이자연) + '/년은 빌려준 사람의 비영업대금 이익(이자소득, 소득세법 §16①11호) — 지급하는 자녀가 25% ' + won(원천) + ' 원천징수·다음 달 10일 납부(§127①1호·§129①1호 나목, 지방소득세 별도) · 그 해 금융소득 2천만원 넘으면 종합과세');
    할일.push({ 무엇: '이자 지급 때 25% 원천징수해 신고·납부(원천징수이행상황신고)', 때: '이자 지급한 달 다음 달 10일', 근거: '소득세법 §127·§128·§129①1호 나목' });
  }
  notes.push('§41의4·§37 증여는 증여자 연대납세 없음(§4의2⑥ 단서) · 수증자가 낼 능력 없으면 면제(§4의2⑤ — §41의4만, §37②는 아님)');
  연도.forEach(function (y) { if (y.과세 && y.증여일) { const d = y.증여일; const last = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) + 2, 0)).toISOString().slice(0, 10); 할일.push({ 무엇: y.해 + '년차 증여세 신고(이익 ' + won(y.증여재산가액) + ')', 때: last + '까지', 근거: '상증법 §68①·§41의4②' }); } });
  if (reqs[0].결과 !== '✔') 할일.push({ 무엇: '차용증(확정일자·공증)·이자 이체·상환 계획 갖추기', 때: '대출 때', 근거: '[실사건 때 확인] 실질 판단' });

  // 7) 경우(엔진칸)
  const rel = p.관계 || (특수 === true ? '직계존속' : '기타');
  if (원금 > 0) {
    if (첫.과세) 경우.push({ 이름: '① 법대로 — 1년차 이익 ' + won(첫.증여재산가액) + ' 전액이 증여재산가액', 엔진: 'calculate_gift_tax', 엔진칸: { giftAmount: 첫.증여재산가액, relation: rel, giftDate: 대출일 || undefined } });
    else 경우.push({ 이름: '① 법대로 — 1년차 이익 ' + won(첫.이익) + ' < 1천만원 → 증여세 0(대여 사실 입증이 전제)', 세액: 0, 줄: ['차용증·이자·상환 흔적이 없으면 원금 자체가 증여(경우 ③)'] });
    if (첫.과세 && 첫.이익 > 10000000) 경우.push({ 이름: '② [견주기] 1천만원 넘는 부분 ' + won(첫.이익 - 10000000) + '만 과세로 잘못 셈', 엔진: 'calculate_gift_tax', 엔진칸: { giftAmount: 첫.이익 - 10000000, relation: rel, giftDate: 대출일 || undefined } });
    경우.push({ 이름: '③ [견주기] 차용으로 인정 못 받아 원금 ' + won(원금) + ' 전체가 증여', 엔진: 'calculate_gift_tax', 엔진칸: { giftAmount: 원금, relation: rel, giftDate: 대출일 || undefined } });
    if (약정율 < 적정율) { const 적정이자 = Math.round(원금 * 적정율 / 100); 경우.push({ 이름: '④ [안] 적정 이자율 ' + 적정율 + '%로 이자 ' + won(적정이자) + '/년 주면 증여 0 — 대신 받는 쪽 이자소득세(원천 25% ' + won(Math.round(적정이자 * 0.25)) + ')', 세액: Math.round(적정이자 * 0.25), 줄: ['증여세 0 · 원천징수 ' + won(Math.round(적정이자 * 0.25)) + '(지방소득세 별도)'] }); }
    if (담보과세) 경우.push({ 이름: '⑤ 담보 이익 ' + won(담보이익) + ' 증여(§37②)', 엔진: 'calculate_gift_tax', 엔진칸: { giftAmount: 담보이익, relation: rel, giftDate: 대출일 || undefined } });
  }

  const w = jmWrap_('가족차용', reqs, { 원금: 원금, 적정이자율: 적정율, 실제이자연: 실제이자연, 연도: 연도, 총과세이익: 총과세, 담보이익: 담보이익, 담보과세: 담보과세, 상환합: 상환합, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = !원금 ? (차입 > 0 ? (담보과세 ? '담보 이익 ' + won(담보이익) + ' 증여(§37②)' : '담보 이익 ' + won(담보이익) + ' — 1천만원 미만, 증여세 없음') : '원금을 몰라 가르지 못함 — 잠정') : (reqs[0].결과 === '✘' ? '대여 아님 — 원금 ' + won(원금) + ' 증여 위험' : (첫.과세 ? '대출 이익 증여 — 1년차 ' + won(첫.증여재산가액) : '대출 이익 1천만원 미만 — 증여세 없음') + (담보과세 ? ' · 담보 이익 ' + won(담보이익) + ' 증여' : '') + (w.잠정 ? ' — 잠정' : ''));
  w.표시 = '가족차용 ' + w.결론;
  return w;
}

// [2026.11.04 모의사건 155] 점유취득시효(민법 §245①)로 취득한 부동산의 양도 — 20년 점유 뒤 등기해 얻은 땅을 팔 때
//  근거 원문(2026.11.04 업무관리자\법령 읽기용 판에서 읽음 — 소득세법 20260701 시행판·시행령 20261001 시행판):
//   시행령 §162①6호(민법 §245①로 부동산 소유권을 취득하는 경우 취득시기 = 그 부동산의 점유를 개시한 날)
//   법 §97①1호(취득가액: 가목 실지거래가액, 확인할 수 없을 때만 나목 매매사례가액·감정가액·환산취득가액 순차) · §97②2호(환산이면 개산공제, 단서: 환산+개산 < 자본적지출+양도비 면 뒤쪽) · §114⑦
//   시행령 §176의2②2호(환산 = 양도 실지거래가액 × 취득당시 기준시가 ÷ 양도당시 기준시가) · §163①2호(취득 쟁송 소송비용은 실지거래가액에 더함)·③2호(취득 뒤 쟁송 소송비용은 자본적지출)
//   법 §95④(장기보유특별공제 보유기간은 취득일부터) · §104의3(비사업용 토지 — 기간 기준도 취득일부터) · 법률 제4803호 부칙 §8(1984.12.31. 이전 취득 토지·건물 의제취득일 1985.1.1.)
//   상증법 §2 6호(증여 = 타인에게 무상으로 재산을 「이전」하거나 재산가치를 증가시키는 것) — 시효취득은 법률 규정에 따른 원시취득이라 「이전」이 아님 [확인 필요 — 권장: 증여세 없음]
//  놓치던 것: 넥스가 등기접수일(판결 뒤)을 취득일로 보면 장특공·세율·비사업용 기간이 다 틀리고, 환산 기준시가를 등기일 것으로 쓰면 취득가액이 크게 부풀어 과소신고가 된다.
//  p: { 점유개시일, 등기접수일, 판결확정일, 양도일, 양도가액, 자산(토지|건물|주택), 점유원인(상속점유|무등기매수|경계침범|기타), 전소유자특수관계(예|아니오),
//       취득기준시가(점유개시일 당시), 양도기준시가, 등기일기준시가, 등기일시가(증여세 견주기용), 매매사례가액(점유개시일 전후 3개월), 감정가액,
//       소송비용, 자본적지출, 양도비, 농지(예|아니오), 재촌자경(예|아니오 — 점유 기간 내내), 비사업용(예|아니오|모름), 엔진칸{…} }
function judgeAdversePossession_(p) {
  p = p || {}; const reqs = [], notes = [], 할일 = [], 경우 = [];
  const num = function (x) { const n = famNum_(x); return n > 0 ? n : 0; };
  const won = famWon_;
  const 점유 = jmYmd_(p.점유개시일), 등기 = jmYmd_(p.등기접수일), 판결 = jmYmd_(p.판결확정일), 양도일 = jmYmd_(p.양도일);
  const 양도가액 = num(p.양도가액), 취득기준 = num(p.취득기준시가), 양도기준 = num(p.양도기준시가), 등기기준 = num(p.등기일기준시가);
  const 매매사례 = num(p.매매사례가액), 감정 = num(p.감정가액), 소송비 = num(p.소송비용), 자본적 = num(p.자본적지출), 양도비 = num(p.양도비);
  const 자산 = String(p.자산 || '토지'), 농지 = jmYn_(p.농지) === true || /농지|전|답|과수원/.test(자산), 자경 = jmYn_(p.재촌자경), 특수 = jmYn_(p.전소유자특수관계);
  let 잠정 = false;

  // 1) 시효취득인지 — 20년 점유 + 등기(민법 §245①)
  const 끝 = 등기 || 판결 || 양도일;
  const 년수 = 점유 && 끝 ? jmDays_(점유, 끝) / 365.25 : null;
  reqs.push(jmReq_('20년 이상 소유 의사로 평온·공연하게 점유', 년수 == null ? null : 년수 >= 20, 년수 == null ? '점유를 시작한 날과 등기(판결)한 날을 모름' : '점유 ' + 년수.toFixed(1) + '년(점유개시 ' + 점유 + ' → ' + 끝 + ')', '민법 §245①'));
  reqs.push(jmReq_('시효취득 등기를 마침', 등기 ? true : null, 등기 ? '등기접수 ' + 등기 : '민법 §245①은 「등기함으로써」 소유권을 취득 — 등기 전에는 팔 수 없음(등기부·판결문으로 확인)', '민법 §245①'));
  if (년수 != null && 년수 < 20) notes.push('20년이 안 되면 시효취득이 아님 — 실제 등기 원인(매매·증여·상속)으로 다시 봐야 함');

  // 2) 취득시기 = 점유개시일(시행령 §162①6호) — 1984.12.31. 이전 점유면 의제취득일
  let 취득일 = 점유, 의제 = false;
  if (점유 && 점유 < '1985-01-01' && /토지|건물|주택/.test(자산)) { 취득일 = '1985-01-01'; 의제 = true; }
  reqs.push(jmReq_('취득시기 = 점유를 시작한 날', 점유 ? true : null, 점유 ? (의제 ? '점유개시 ' + 점유 + ' — 1984.12.31. 이전이라 의제취득일 1985.1.1.(법률 제4803호 부칙 §8) — 「의제취득」 묶음으로 취득가액 셈' : '점유개시 ' + 점유 + ' (등기접수일 ' + (등기 || '모름') + '이 아님)') : '점유개시일을 모름(점유 사실은 판결문·농지원부·이웃 확인서)', '소득세법 시행령 §162①6호'));
  if (등기 && 점유) notes.push('취득일을 등기접수일(' + 등기 + ')로 쓰면 보유기간·장기보유특별공제·세율·비사업용 기간이 모두 틀림 — 점유개시일(' + 점유 + ')이 취득일');

  // 3) 증여세인지 — 원시취득이라 「이전」 아님(권장), 전 소유자가 가족이면 의심
  reqs.push(jmReq_('증여세 과세 대상 아님(원시취득)', 특수 === true ? null : true, 특수 === true ? '전 소유자가 특수관계인 — 시효취득 꼴을 빌린 무상 이전이 아닌지 세무서가 볼 수 있음(점유 경위·판결 다툼 여부로 소명)' : '법률 규정에 따른 원시취득 — 상증법 §2 6호의 「이전」이 아님', '상증법 §2 6호 [확인 필요 — 권장: 증여세 없음(시효취득은 원시취득)]'));
  if (특수 === true) { 잠정 = true; notes.push('특수관계인 땅을 20년 점유했다고 등기하면 실질이 증여인지 다툼 — 다퉈서 받은 판결(의제자백 아닌 대심)인지, 전 소유자가 이의 없이 넘겼는지 자료를 모아 둘 것'); }
  notes.push('전 소유자(등기명의인) 쪽: 대가 없이 소유권을 잃은 것이라 양도 아님(소득세법 §88 1호 유상 이전 아님) · 증여도 아님 — 세금 없음 [확인 필요]');

  // 4) 취득가액 — 실지거래가액 없음 → 매매사례·감정·환산(점유개시일 기준시가)
  let 방식 = '', 취득가액 = 0;
  if (매매사례 > 0) { 방식 = '매매사례가액'; 취득가액 = 매매사례; }
  else if (감정 > 0) { 방식 = '감정가액'; 취득가액 = 감정; }
  else if (양도가액 > 0 && 취득기준 > 0 && 양도기준 > 0) { 방식 = '환산취득가액'; 취득가액 = Math.round(양도가액 * 취득기준 / 양도기준); }
  else { 잠정 = true; }
  reqs.push(jmReq_('취득가액(실지거래가액 없음 → 매매사례·감정·환산 순)', 방식 ? true : null, 방식 ? 방식 + ' ' + won(취득가액) + (방식 === '환산취득가액' ? ' = 양도가액 ' + won(양도가액) + ' × 취득 당시(점유개시일) 기준시가 ' + won(취득기준) + ' ÷ 양도 당시 기준시가 ' + won(양도기준) : '') : '점유개시일 전후 3개월 매매사례가액·감정가액이 없으면 점유개시일 당시 기준시가(개별공시지가)와 양도 당시 기준시가가 필요', '소득세법 §97①1호 나목·§114⑦ · 시행령 §176의2②2호·③'));
  if (방식 === '환산취득가액' && 등기기준 > 0 && 등기기준 !== 취득기준) notes.push('환산할 때 등기일 기준시가(' + won(등기기준) + ')를 쓰면 취득가액이 ' + won(Math.round(양도가액 * 등기기준 / 양도기준)) + '으로 부풀어 과소신고 — 점유개시일 당시 기준시가(' + won(취득기준) + ')로');
  if (방식 === '환산취득가액' && 점유 && 점유 < '1990-01-01' && !의제) notes.push('1990년 전 점유개시 — 개별공시지가가 없어 취득 당시 기준시가는 시행령 §164 환산(1990.8.30. 공시지가 × 지방세 과세시가표준액 비율) — 세무사님께 여쭘');
  if (방식 === '환산취득가액' && 양도일 && 양도일 >= '2018-01-01' && /건물|주택/.test(자산)) notes.push('건물을 신축·증축 뒤 5년 안에 환산가액으로 신고하면 환산가액 5% 가산세(§114의2) — 「환산가산세」 묶음으로 확인');

  // 5) 필요경비 — 환산이면 개산공제(기준시가 3%) vs 소송비용·자본적지출·양도비 합계 중 큰 쪽(§97②2호 단서)
  const 실제경비 = 소송비 + 자본적 + 양도비, 개산 = 방식 === '환산취득가액' && 취득기준 > 0 ? Math.round(취득기준 * 0.03) : 0;
  let 필요경비 = 0, 경비설명 = '';
  if (방식 === '환산취득가액') {
    if (취득가액 + 개산 >= 실제경비) { 필요경비 = 취득가액 + 개산; 경비설명 = '환산 ' + won(취득가액) + ' + 개산공제 ' + won(개산) + '(기준시가 3%)' + (실제경비 ? ' ≥ 실제 경비 ' + won(실제경비) + ' → 환산 쪽' : ''); }
    else { 필요경비 = 실제경비; 경비설명 = '실제 경비(소송비용 ' + won(소송비) + ' + 자본적지출 ' + won(자본적) + ' + 양도비 ' + won(양도비) + ') ' + won(실제경비) + ' > 환산 + 개산 ' + won(취득가액 + 개산) + ' → 실제 경비 쪽(§97②2호 단서)'; }
  } else if (방식) { 필요경비 = 취득가액 + 실제경비; 경비설명 = 방식 + ' ' + won(취득가액) + ' + 자본적지출·양도비 ' + won(실제경비); }
  reqs.push(jmReq_('필요경비', 방식 ? true : null, 경비설명 || '취득가액을 정한 뒤', '소득세법 §97②2호 · 시행령 §163③2호(취득 뒤 소유권 확보 소송비용 — 그 해 소득 계산에 넣은 것 제외)·⑥'));
  if (소송비 > 0) notes.push('시효취득 등기 소송비용 ' + won(소송비) + ' — 그 해 사업소득 등 필요경비에 넣었다면 뺌(시행령 §163③2호 괄호)');

  // 6) 장특공·비사업용·감면
  const 보유년 = 취득일 && 양도일 ? jmDays_(취득일, 양도일) / 365.25 : null;
  if (보유년 != null) notes.push('보유기간 ' + 보유년.toFixed(1) + '년(취득일 ' + 취득일 + '부터, §95④) — 장기보유특별공제 표1 ' + Math.min(30, Math.max(0, Math.floor(보유년) * 2)) + '%' + (등기 && 양도일 ? ' (등기일부터 세면 ' + (jmDays_(등기, 양도일) / 365.25).toFixed(1) + '년 → ' + Math.min(30, Math.max(0, Math.floor(jmDays_(등기, 양도일) / 365.25) * 2)) + '%로 틀림)' : ''));
  let 비사업용 = jmYn_(p.비사업용);
  if (비사업용 == null && 농지) { 비사업용 = 자경 === true ? false : 자경 === false ? true : null; }
  if (/토지/.test(자산) || 농지) {
    reqs.push(jmReq_('비사업용 토지 아님', 비사업용 == null ? null : !비사업용, 비사업용 == null ? '점유개시일부터 양도일까지(취득일 기준 기간) 재촌자경·사업 사용 기간으로 판정 — 「비사업용」 판정 필요' : 비사업용 ? '비사업용 — 세율 +10%p' : (농지 ? '점유 기간 내내 재촌자경 — 사업용' : '사업용'), '소득세법 §104의3 · 시행령 §168의6(기간 기준의 취득일 = 점유개시일)'));
    if (비사업용 == null) 잠정 = true;
  }
  if (농지 && 자경 === true) { notes.push('농지를 점유 기간 내내 재촌자경 — 8년 자경 감면(조특법 §69) 검토 [확인 필요 — 권장: 경작 기간은 점유개시일(취득일)부터 셈, 등기일부터가 아님]'); 할일.push({ 무엇: '「8년자경」 묶음으로 감면 판정(경작 시작 = 점유개시일)', 때: '신고 전', 근거: '조특법 §69·시행령 §66' }); }

  // 7) 할 일
  if (양도일) { const y = +양도일.slice(0, 4), m = +양도일.slice(5, 7); 할일.push({ 무엇: '양도소득세 예정신고·납부', 때: new Date(Date.UTC(y, m + 2, 0)).toISOString().slice(0, 10) + '까지', 근거: '소득세법 §105①1호' }); }
  할일.push({ 무엇: '점유개시일 증빙(판결문 사실인정·농지원부·과세대장·이웃 확인서)과 점유개시일 당시 개별공시지가 확보', 때: '신고 전', 근거: '시행령 §162①6호·§176의2' });
  if (!등기) 할일.push({ 무엇: '시효취득 등기(소유권이전등기 판결 → 등기) — 등기 뒤에 양도', 때: '양도 전', 근거: '민법 §245①' });

  // 8) 경우(엔진칸)
  const base = Object.assign({ assetType: /주택/.test(자산) ? 'house' : /토지|농지/.test(자산) || 농지 ? 'land' : 'other', transferPrice: 양도가액 || undefined, transferDate: 양도일 || undefined, necessaryExpenses: 실제경비 || undefined }, p.엔진칸 || {});
  const priceIn = function (acqStd) { const o = {}; if (매매사례 > 0) o.comparableTransactionPrice = 매매사례; else if (감정 > 0) o.appraisalValue = 감정; else if (acqStd > 0 && 양도기준 > 0) { o.acquisitionStandardPriceForConversion = acqStd; o.transferStandardPriceForConversion = 양도기준; } return o; };
  if (양도가액 > 0 && 취득일) {
    경우.push({ 이름: '① 법대로 — 취득일 ' + 취득일 + '(점유개시), ' + (방식 || '취득가액 미정') + (비사업용 ? ', 비사업용' : ''), 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { acquisitionDate: 취득일, isNonBusinessLand: 비사업용 === true || undefined }, priceIn(취득기준)) });
    if (등기) 경우.push({ 이름: '② [견주기] 등기접수일 ' + 등기 + '을 취득일로 잘못 봄' + (방식 === '환산취득가액' && 등기기준 > 0 ? ' + 등기일 기준시가로 환산 — 보유기간·취득가액 모두 틀림' : ' — 보유기간이 틀림'), 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { acquisitionDate: 등기, isNonBusinessLand: 비사업용 === true || undefined }, priceIn(등기기준 || 취득기준)) });
    if (비사업용 == null && (/토지/.test(자산) || 농지)) 경우.push({ 이름: '③ [견주기] 비사업용으로 판정될 때(세율 +10%p)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, base, { acquisitionDate: 취득일, isNonBusinessLand: true }, priceIn(취득기준)) });
    if (num(p.등기일시가) > 0) 경우.push({ 이름: '④ [견주기] 증여로 잘못 봄 — 등기일 시가 ' + won(num(p.등기일시가)) + ' 증여세(원시취득이라 증여 아님)', 엔진: 'calculate_gift_tax', 엔진칸: { giftAmount: num(p.등기일시가), relation: 특수 === true ? (p.관계 || '직계존속') : '기타', giftDate: 등기 || undefined } });
  }

  const w = jmWrap_('시효취득', reqs, { 취득일: 취득일, 의제취득: 의제, 점유년수: 년수 == null ? null : Math.round(년수 * 10) / 10, 취득가액방식: 방식, 취득가액: 취득가액, 필요경비: 필요경비, 개산공제: 개산, 비사업용: 비사업용, 증여세: 특수 === true ? null : false, 경우: 경우, 알림: notes, 할일: 할일 });
  if (잠정) w.잠정 = true;
  w.결론 = (년수 != null && 년수 < 20) ? '시효취득 아님(20년 미만)' : '시효취득 양도 — 취득일 ' + (취득일 || '?') + (방식 ? ' · ' + 방식 + ' ' + won(취득가액) : ' · 취득가액 미정') + (w.잠정 ? ' — 잠정' : '');
  w.표시 = w.결론;
  return w;
}

// [2026.11.04 복잡사건 134] 국세의 우선(국세기본법 §35·§36) — 경매·공매 매각대금을 국세와 저당권·전세권·확정일자 임차인 등에게 어떤 차례로 나누나
//  근거 원문(2026.11.04 업무관리자\법령 _본문에서 읽음 — 국세기본법 20261002 시행판·부칙 제19189호):
//   §35①(국세는 다른 채권에 우선. 다만 1호 지방세·공과금 체납처분비 / 2호 강제집행·경매·파산 절차 비용 / 3호 법정기일 전에 설정된 가 전세권·질권·저당권 나 대항요건+확정일자 임차권 다 담보가등기로 담보된 채권
//     / 3의2 그런 권리가 설정된 재산이 양도·상속·증여된 뒤 매각 — 직전 보유자 체납 고려 금액 범위는 국세 우선 / 4호 소액임차보증금 최우선 / 5호 근로기준법 §38·근로자퇴직급여 보장법 §12 우선 임금 등)
//   §35②(법정기일: 1호 신고 확정 국세 = 신고일(중간예납·예정신고 포함) / 2호 결정·경정·수시부과 = 납부고지서 발송일 / 3호 인지세·원천징수 = 확정일 / 4호 제2차 납세의무자 재산 = 납부고지서 발송일
//     / 5호 양도담보재산 = 발송일 / 6호 국세징수법 §31② 압류 관련 확정 국세 = 압류등기일 / 7·8호 신탁재산 부가세·종부세 = 발송일)
//   §35③(그 재산에 부과된 상속세·증여세·종합부동산세는 3호 채권보다 우선 — 이른바 당해세)
//   §35⑦(주택 확정일자 임차권·주거용 건물 전세권 채권은 그 확정일자·설정일보다 법정기일이 늦은 당해세의 우선 징수 순서에 대신하여 변제 — 대신 변제는 그 당해세 징수액 한도, 저당권 등의 변제액과 당해세를 먼저 걷었을 때 임차인이 받을 수 있던 몫에는 영향 없음)
//   부칙(제19189호, 2022.12.31) §1 단서·§3: §35 개정규정은 2023.4.1. 시행, 그 이후 매각결정(국세징수법 §84)·매각허가 결정(민사집행법 §128)부터 적용
//   §35⑥(법정기일 전 1년 안 특수관계인과 맺은 저당권·임대차 등은 짜고 한 거짓 계약으로 추정 — 세무서장이 법원에 취소 청구) · §36①(압류한 국세는 교부청구한 다른 국세보다 우선)
//  p: { 매각대금, 집행비용, 매각허가결정일, 재산종류(주택|상가|토지 등), 최우선소액보증금(§35①4호 금액 합계 — 주택임대차보호법 §8 금액은 넣은 대로), 최우선임금(§35①5호 — 최종 3개월 임금·3년 퇴직금·재해보상),
//       권리들: [{ 누구, 종류(저당권|근저당권|전세권|질권|확정일자임차권|담보가등기), 날짜(설정등기일 또는 대항요건·확정일자 중 늦은 날), 금액(채권최고액 안 실제 채권), 주거용(예|아니오), 특수관계(예|아니오) }],
//       국세들: [{ 세목, 금액, 확정(신고|고지|원천|압류|제2차), 신고일, 고지발송일, 확정일, 압류등기일, 당해세(예 — 이 재산에 부과된 상속세·증여세·종부세), 압류(예 — 이 재산을 압류한 국세) }],
//       양도상속증여후(예 — 권리 설정 뒤 재산이 넘어간 경우 3의2), 이전일(양도·상속·증여 등기일),
//       직전보유자: { 보유전전세권등(예 — 직전 보유자가 갖기 전부터 전세권등 있었음 → 0원), 체납들:[{세목, 금액, 법정기일}] } }
//   §35①3의2 단서·시행령 §18③(1호 직전 보유자 체납 국세 중 법정기일이 그 보유 중 가장 빠른 전세권등 설정일보다 빠른 것의 합 / 2호 보유 전부터 있었으면 0원)
function judgeTaxPriority_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const 예 = function (v) { return /^(예|y|yes|true|1|o)$/i.test(String(v == null ? '' : v).trim()); };
  const reqs = [], notes = [], 할일 = [];
  const 대금 = n(p.매각대금);
  if (!대금) return jmWrap_('국세우선', [jmReq_('매각대금', null, '경매·공매 매각대금(또는 예상 낙찰가)을 넣을 것', '국세기본법 §35①')], { 경우: [], 할일: [{ 무엇: '등기부(을구 저당권·전세권)·임대차계약서·전입·확정일자·국세 체납 내역(세목·신고일·고지 발송일)을 모을 것', 때: '먼저', 근거: '국세기본법 §35' }] });
  let 잠정 = false;
  const 허가 = jmYmd_(p.매각허가결정일);
  const 대신변제가능 = !허가 || 허가 >= '2023-04-01';
  if (!허가) { 잠정 = true; notes.push('매각허가 결정일을 몰라 2023.4.1. 뒤로 보고 §35⑦(주택 임차인 대신 변제)을 넣음'); }
  // 국세 하나하나의 법정기일
  const 세 = (p.국세들 || []).map(function (t, i) {
    const 확 = String(t.확정 || '').trim();
    let 날 = null, 근 = '';
    if (/압류/.test(확) && jmYmd_(t.압류등기일)) { 날 = jmYmd_(t.압류등기일); 근 = '§35②6호 압류등기일'; }
    else if (/원천|인지/.test(확)) { 날 = jmYmd_(t.확정일); 근 = '§35②3호 확정일'; }
    else if (/고지|결정|경정|제2차|수시/.test(확)) { 날 = jmYmd_(t.고지발송일); 근 = /제2차/.test(확) ? '§35②4호 납부고지서 발송일' : '§35②2호 납부고지서 발송일'; }
    else if (/신고/.test(확)) { 날 = jmYmd_(t.신고일); 근 = '§35②1호 신고일'; }
    else { 날 = jmYmd_(t.신고일) || jmYmd_(t.고지발송일); 근 = '확정 방식 모름'; }
    if (!날) { 잠정 = true; 할일.push({ 무엇: (t.세목 || '국세 ' + (i + 1)) + '의 법정기일(신고일·납부고지서 발송일)을 세무서 체납 내역으로 확인', 때: '배당표 나오기 전', 근거: '국세기본법 §35②' }); }
    return { 누구: '국세 ' + (t.세목 || (i + 1)), 세목: String(t.세목 || ''), 금액: n(t.금액), 날: 날, 날근: 근, 당해: 예(t.당해세), 압류: 예(t.압류), 종: '국세' };
  });
  const 권 = (p.권리들 || []).map(function (r, i) {
    const 날 = jmYmd_(r.날짜);
    if (!날) { 잠정 = true; 할일.push({ 무엇: (r.누구 || '권리 ' + (i + 1)) + '의 설정등기일(임차인은 대항요건과 확정일자 중 늦은 날)을 등기부·확정일자 부여 내역으로 확인', 때: '먼저', 근거: '국세기본법 §35①3호·시행령' }); }
    const 종 = String(r.종류 || '').trim();
    const 주택임 = (/임차/.test(종) && /주택/.test(String(p.재산종류 || ''))) || (/전세/.test(종) && 예(r.주거용));
    return { 누구: (r.누구 || '권리 ' + (i + 1)) + '(' + (종 || '담보') + ')', 종류: 종, 금액: n(r.금액), 날: 날, 주택임: 주택임, 특수: 예(r.특수관계), 종: '권리' };
  });
  for (const t of 세) if (t.당해 && !/상속|증여|종합부동산|종부/.test(t.세목)) notes.push(t.누구 + ' — 당해세(§35③)는 그 재산에 부과된 상속세·증여세·종합부동산세뿐이라 일반 국세로 셈');
  for (const t of 세) if (t.당해 && !/상속|증여|종합부동산|종부/.test(t.세목)) t.당해 = false;
  // §35①3의2 — 전세권등이 설정된 재산이 양도·상속·증여된 뒤 매각(시행령 §18③으로 국세 우선 금액)
  const 이전일 = jmYmd_(p.이전일);
  const 직 = p.직전보유자 || {};
  const 삼의이권 = 예(p.양도상속증여후) && 이전일 ? 권.filter(function (r) { return r.날 && r.날 < 이전일; }) : [];
  const 삼최초 = 삼의이권.map(function (r) { return r.날; }).sort()[0] || null;
  let 삼의이금액 = 0, 삼의이근 = '';
  if (예(p.양도상속증여후) && !이전일) { 잠정 = true; 할일.push({ 무엇: '재산이 양도·상속·증여된 날(소유권 이전 등기일)을 등기부로 확인', 때: '먼저', 근거: '국세기본법 §35①3의2' }); }
  if (삼의이권.length) {
    if (예(직.보유전전세권등)) { 삼의이금액 = 0; 삼의이근 = '직전 보유자가 갖기 전부터 전세권등이 있었음 — 0원(시행령 §18③2호)'; }
    else {
      const 체 = (직.체납들 || []).map(function (t) { return { 세목: t.세목, 금액: n(t.금액), 날: jmYmd_(t.법정기일) }; });
      if (!체.length) { 잠정 = true; 할일.push({ 무엇: '직전 보유자가 그 재산을 가질 때 밀린 국세(세목·금액·법정기일)를 세무서에 확인 — 없으면 0원', 때: '배당표 나오기 전', 근거: '국세기본법 시행령 §18③1호' }); }
      체.forEach(function (t) { if (!t.날) 잠정 = true; else if (t.날 < 삼최초) 삼의이금액 += t.금액; });
      삼의이근 = '직전 보유자 체납 국세 중 법정기일이 가장 빠른 전세권등 설정일(' + 삼최초 + ')보다 빠른 것의 합 ' + won(삼의이금액) + '원(시행령 §18③1호)' + (직.보유전전세권등 == null ? ' — 직전 보유 전 전세권등이 있었는지 모름 [잠정]' : '');
      if (직.보유전전세권등 == null) 잠정 = true;
    }
  }
  // 배분 한 바퀴 — 대신변제(§35⑦) 넣을지, 당해세를 당해세로 볼지 고를 수 있게
  function 배분(옵) {
    const rows = [];
    let 남 = 대금;
    const 쓰 = function (누구, 근거, 청구) { const 받 = Math.min(남, 청구); 남 -= 받; rows.push({ 누구: 누구, 근거: 근거, 청구: 청구, 배분: 받 }); return 받; };
    쓰('집행비용', '§35①2호', n(p.집행비용));
    const 소 = n(p.최우선소액보증금), 임 = n(p.최우선임금);
    if (소 + 임 > 0) { const 몫 = Math.min(남, 소 + 임); const a = 소 + 임 > 0 ? Math.floor(몫 * 소 / (소 + 임)) : 0; 남 -= 몫; if (소) rows.push({ 누구: '소액임차보증금 최우선', 근거: '§35①4호', 청구: 소, 배분: a }); if (임) rows.push({ 누구: '최우선 임금·퇴직금', 근거: '§35①5호', 청구: 임, 배분: 몫 - a }); if (몫 < 소 + 임) notes.push('최우선 몫끼리도 다 못 받아 금액 비율로 나눔 [확인 필요 — 권장: 같은 순위 금액 비율 안분(지금) 권장]'); }
    const 당해들 = 옵.당해 ? 세.filter(function (t) { return t.당해; }) : [];
    const 삼 = 옵.삼의이 && 삼의이권.length ? 삼의이권 : [];
    // §35③ 뒷부분 — 3의2 권리보다 앞서는 당해세는 종합부동산세뿐(상속세·증여세 당해세는 3의2 권리 뒤)
    const 당해앞 = 삼.length ? 당해들.filter(function (t) { return /종합부동산|종부/.test(t.세목); }) : 당해들;
    const 당해뒤 = 당해들.filter(function (t) { return 당해앞.indexOf(t) < 0; });
    const 당해행 = [];
    const 당해쓰 = function (t, 근) { const 받 = Math.min(남, t.금액); 남 -= 받; const r = { 누구: t.누구 + ' — 당해세', 근거: 근, 청구: t.금액, 배분: 받, _t: t }; rows.push(r); 당해행.push(r); };
    당해앞.forEach(function (t) { 당해쓰(t, '§35③'); });
    // §35①3의2 — 양도·상속·증여 전에 설정된 전세권등은 새 소유자 국세보다 앞, 다만 시행령 §18③ 금액 범위에서는
    //  법정기일이 그 전세권등 설정일보다 빠른 국세가 앞
    const 남은액 = new Map();
    const 행들 = [];
    if (삼.length) {
      let 한 = 삼의이금액;
      세.filter(function (t) { return 당해들.indexOf(t) < 0 && t.날 && t.날 < 삼최초; }).sort(function (x, y) { return x.날 < y.날 ? -1 : x.날 > y.날 ? 1 : 0; }).forEach(function (t) {
        const 몫 = Math.min(한, t.금액); if (몫 <= 0) return; 한 -= 몫;
        const 받 = Math.min(남, 몫); 남 -= 받; rows.push({ 누구: t.누구 + ' — 3의2 단서 몫', 근거: '§35①3의2 단서·시행령 §18③', 청구: 몫, 배분: 받 });
        남은액.set(t, t.금액 - 몫);
      });
      삼.slice().sort(function (x, y) { return x.날 < y.날 ? -1 : x.날 > y.날 ? 1 : 0; }).forEach(function (x) { const 받 = Math.min(남, x.금액); 남 -= 받; const r = { 누구: x.누구, 근거: '설정 ' + x.날 + ' — 이전(' + 이전일 + ') 전 설정, §35①3의2', 청구: x.금액, 배분: 받, _x: x }; rows.push(r); 행들.push(r); });
      당해뒤.forEach(function (t) { 당해쓰(t, '§35③(3의2 권리 뒤)'); });
    }
    // 날짜 차례 — 권리는 법정기일 「전에」 설정돼야 국세보다 앞(같은 날은 국세 먼저)
    const 줄 = 권.filter(function (x) { return 삼.indexOf(x) < 0; }).concat(세.filter(function (t) { return 당해들.indexOf(t) < 0 && 남은액.get(t) !== 0; }).map(function (t) { return 남은액.has(t) ? Object.assign({}, t, { 금액: 남은액.get(t) }) : t; })).slice();
    줄.sort(function (a, b) { const x = a.날 || '9999-12-31', y = b.날 || '9999-12-31'; if (x !== y) return x < y ? -1 : 1; if (a.종 !== b.종) return a.종 === '국세' ? -1 : 1; if (a.종 === '국세' && a.압류 !== b.압류) return a.압류 ? -1 : 1; return 0; });
    줄.map(function (x) { const 받 = Math.min(남, x.금액); 남 -= 받; const r = { 누구: x.누구, 근거: x.종 === '국세' ? '법정기일 ' + (x.날 || '모름') + '(' + x.날근 + ')' : '설정·확정일자 ' + (x.날 || '모름') + ' — §35①3호', 청구: x.금액, 배분: 받, _x: x }; rows.push(r); 행들.push(r); return r; });
    // §35⑦ — 주택 임차인·주거용 전세권은 확정일자·설정일보다 법정기일이 늦은 당해세의 자리를 대신
    const 바꾼 = [];
    if (옵.대신 && 대신변제가능) {
      for (const r of 행들) {
        if (!r._x || r._x.종 !== '권리' || !r._x.주택임 || !r._x.날) continue;
        for (const d of 당해행) {
          if (!d._t.날 || !(r._x.날 < d._t.날)) continue;
          const 모자 = r.청구 - r.배분; if (모자 <= 0) break;
          const 옮 = Math.min(모자, d.배분); if (옮 <= 0) continue;
          d.배분 -= 옮; r.배분 += 옮; 바꾼.push(r._x.누구 + '이(가) ' + d._t.누구 + ' 자리에서 ' + won(옮) + '원 대신 받음');
          // 당해세는 임차인이 원래 받던 자리 뒤에서 남은 것을 받음 — 다른 채권 몫은 그대로(§35⑦ 후단)
        }
      }
    }
    rows.push({ 누구: '남는 돈(일반채권·소유자)', 근거: '', 청구: 0, 배분: 남 });
    rows.forEach(function (r) { delete r._t; delete r._x; });
    return { 줄: rows, 바꾼: 바꾼 };
  }
  const 법 = 배분({ 당해: true, 대신: true, 삼의이: true });
  const 없이 = 배분({ 당해: true, 대신: false, 삼의이: true });
  const 일반 = 배분({ 당해: false, 대신: false, 삼의이: true });
  const 삼없이 = 삼의이권.length ? 배분({ 당해: true, 대신: true, 삼의이: false }) : null;
  // 요건·알림
  reqs.push(jmReq_('매각허가 결정이 2023.4.1. 이후(§35⑦ 대신 변제 적용)', 허가 ? 대신변제가능 : null, 허가 ? 허가 + (대신변제가능 ? ' — 적용' : ' — 개정 전이라 적용 안 함') : '결정일 모름', '국세기본법 부칙(제19189호) §1 단서·§3'));
  const 당해 = 세.filter(function (t) { return t.당해; });
  reqs.push(jmReq_('당해세(그 재산에 부과된 상속세·증여세·종부세)', 당해.length ? true : false, 당해.length ? 당해.map(function (t) { return t.누구 + ' ' + won(t.금액) + '원'; }).join(', ') : '없음', '국세기본법 §35③'));
  reqs.push(jmReq_('국세 법정기일', 세.every(function (t) { return t.날; }) ? true : null, 세.map(function (t) { return t.누구 + ' ' + (t.날 || '모름') + '(' + t.날근 + ')'; }).join(' · ') || '국세 없음', '국세기본법 §35②'));
  for (const r of 권) if (r.특수 && r.날) for (const t of 세) if (t.날 && r.날 < t.날) { const 일년전 = (Number(t.날.slice(0, 4)) - 1) + t.날.slice(4); if (r.날 >= 일년전) { notes.push(r.누구 + ' — ' + t.누구 + ' 법정기일 전 1년 안 특수관계인과 맺은 계약이라 짜고 한 거짓 계약으로 추정(§35⑥) — 세무서장이 취소를 청구할 수 있음'); 할일.push({ 무엇: r.누구 + '의 실제 돈 오간 증빙(대출금 입금·보증금 이체)을 모아 진짜 계약임을 밝힐 준비', 때: '취소 소송 전', 근거: '국세기본법 §35⑥ 후단' }); break; } }
  if (삼의이권.length) { reqs.push(jmReq_('이전 전 설정 전세권등(§35①3의2)', true, 삼의이권.map(function (r) { return r.누구 + ' ' + r.날; }).join(', ') + ' · 국세 우선 금액 ' + won(삼의이금액) + '원 — ' + 삼의이근, '국세기본법 §35①3의2·§35③·시행령 §18③')); notes.push('3의2 권리보다 앞서는 당해세는 종합부동산세뿐 — 상속세·증여세 당해세는 그 권리 뒤(§35③ 뒷부분)'); }
  else if (예(p.양도상속증여후)) notes.push('권리 설정 뒤 재산이 넘어감 — 이전일(p.이전일)이 없거나 이전 전에 설정된 권리가 없어 §35①3의2를 셈하지 않음 [잠정]');
  const 압 = 세.filter(function (t) { return t.압류; });
  if (압.length && 세.length > 1) notes.push('압류한 국세는 교부청구한 다른 국세보다 앞(§36①) — 국세끼리 법정기일 차례와 압류 차례가 엇갈리고 그 사이에 저당권이 끼면 순환이 생겨 안분 뒤 흡수 방식으로 나눔 [확인 필요 — 권장: 판례 계산례 — 그대로 둠]');
  notes.push('지방세(재산세 등 당해세 포함)는 범위 밖이라 넣지 않음 — 배당표에 지방세가 있으면 그 몫만큼 뒤 순위가 줄어듦 [실사건 때 확인]');
  notes.push('최우선 몫이 아닌 나머지 임금채권(근로기준법 §38①)은 넣지 않음 — 있으면 저당권 뒤·그보다 늦은 국세 앞이 되는 순환이 생김 [확인 필요 — 권장: 그대로 둠]');
  for (const b of 법.바꾼) notes.push('§35⑦ ' + b);
  할일.push({ 무엇: '법원 배당표를 받으면 이 배분과 대조 — 다르면 배당기일에 이의하고 1주 안 배당이의 소', 때: '배당기일', 근거: '민사집행법 §151·§154 [확인 필요 — 권장: 확인 못 함 — [확인 필요] 유지]' });
  할일.push({ 무엇: '임차인 상담이면 전입·확정일자 날짜와 집주인 국세 체납·법정기일(납세증명서·미납국세 열람)을 계약 전에 확인', 때: '계약 전', 근거: '국세기본법 §35①3호·국세징수법 §109(미납국세 등의 열람 — 임대인 동의로 계약 전 또는 임대차 시작일까지 신청)' });
  const 표 = function (r) { return r.줄.filter(function (x) { return x.청구 || x.배분; }).map(function (x) { return x.누구 + ' ' + won(x.배분) + (x.청구 ? '/' + won(x.청구) : ''); }); };
  const 찾 = function (r, 이름) { const x = r.줄.filter(function (y) { return y.누구.indexOf(이름) >= 0; })[0]; return x ? x.배분 : null; };
  return jmWrap_('국세우선', reqs, { 잠정: 잠정, 배분: 법.줄, 대신변제: 법.바꾼, 남는돈: 찾(법, '남는 돈'),
    경우: [{ 경우: '① 법대로(당해세 §35③ + 주택 임차인 대신 변제 §35⑦)', 배분: 법.줄, 줄: 표(법) },
           { 경우: '② [견주기] 대신 변제 없이(2023.4.1. 전 매각허가 방식)', 배분: 없이.줄, 줄: 표(없이) },
           { 경우: '③ [견주기] 당해세를 일반 국세처럼 법정기일 차례로만', 배분: 일반.줄, 줄: 표(일반) }].concat(삼없이 ? [{ 경우: '④ [견주기] §35①3의2 없이(날짜 차례만)', 배분: 삼없이.줄, 줄: 표(삼없이) }] : []),
    삼의이: 삼의이권.length ? { 금액: 삼의이금액, 근거: 삼의이근, 최초설정일: 삼최초, 이전일: 이전일 } : null,
    알림: notes, 할일: 할일 });
}
// [2026.11.04 복잡사건 135] 연대납세의무(국세기본법 §25, 소득세법 §2의2·§43) — 공유물·공동사업·법인 분할에서 누가 어느 세금을 얼마까지 내야 하나
//  근거 원문(2026.11.04 업무관리자\법령 _본문에서 읽음 — 국세기본법 20261002 시행판·소득세법 20260701 시행판):
//   국세기본법 §25①(공유물, 공동사업 또는 그 공동사업에 속하는 재산과 관계되는 국세·강제징수비는 공유자 또는 공동사업자가 연대하여 납부)
//   §25②(분할 뒤 분할법인 존속: 분할법인·분할신설법인·분할합병 상대방 법인은 분할등기일 이전에 분할법인에 부과되거나 납세의무가 성립한 국세·강제징수비를 분할로 승계된 재산가액을 한도로 연대)
//   §25③(분할 뒤 분할법인 소멸: 분할신설법인·분할합병 상대방 법인이 분할법인에 부과되거나 분할법인이 낼 국세·강제징수비를 승계된 재산가액 한도로 연대) · §25④(채무자회생법 §215 신회사는 기존 법인 국세 연대)
//   소득세법 §2의2①(§43 공동사업 소득금액은 공동사업자별로 납세의무, 단서: §43③ 주된 공동사업자에게 합산과세되면 그 특수관계인은 손익분배비율에 해당하는 그의 소득금액을 한도로 연대)
//   소득세법 §2의2⑤(공동으로 소유한 자산의 양도소득금액은 공동 소유하는 각 거주자가 납세의무) · §2의2③(§101② 우회양도는 증여자와 수증자 연대)
//  p: { 원인(공유물|공동사업|분할존속|분할소멸|신회사), 본인(볼 사람 이름), 사람들:[{이름, 지분(%), 손익분배비율(%), 역할(분할법인|분할신설법인|분할합병상대방), 승계재산가액}],
//       세금들:[{세목, 금액, 누가(그 사람 몫만이면 이름, 공동이면 비움), 성립일, 합산과세(예 — §43③), 주된사업자(이름), 합산소득금액, 우회양도(예), 증여자, 수증자}], 분할등기일 }
function judgeJointLiability_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const 예 = function (v) { return /^(예|y|yes|true|1|o)$/i.test(String(v == null ? '' : v).trim()); };
  const 원인 = String(p.원인 || '').trim();
  const 사람들 = (p.사람들 || []).filter(function (x) { return x && x.이름; });
  const 세금들 = (p.세금들 || []).filter(function (x) { return x && n(x.금액) > 0; });
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  const 분할 = /분할/.test(원인), 신회사 = /신회사|회생/.test(원인);
  reqs.push(jmReq_('연대의 원인', 원인 ? /공유|공동|분할|신회사|회생/.test(원인) : null, 원인 || '공유물·공동사업·분할(존속/소멸)·회생 신회사 중 무엇인지', '국세기본법 §25①~④'));
  reqs.push(jmReq_('같이 지는 사람(지분·역할)', 사람들.length ? true : null, 사람들.length ? 사람들.map(function (x) { return x.이름; }).join('·') : '공유자·공동사업자·분할 관계 법인 목록', '국세기본법 §25'));
  const 등기 = jmYmd_(p.분할등기일);
  if (분할 && !등기) 알림.push('분할등기일을 몰라 분할 전 세금인지 가르지 못했습니다 — 법인 등기부로 확인(§25②)');
  const 지분합 = 사람들.reduce(function (a, x) { return a + n(x.지분); }, 0);
  if (!분할 && !신회사 && 사람들.length && Math.abs(지분합 - 100) > 0.01) 알림.push('지분 합계가 ' + 지분합 + '%입니다 — 등기부·동업계약서로 확인');
  const 남은한도 = {}; 사람들.forEach(function (x) { 남은한도[x.이름] = n(x.승계재산가액); });
  const 몫 = function (who, amt, key) { const x = 사람들.filter(function (y) { return y.이름 === who; })[0]; const r = x ? n(x[key || '지분']) : 0; return Math.round(amt * r / 100); };
  세금들.forEach(function (t) {
    const 세목 = String(t.세목 || ''), 금액 = n(t.금액), 누가 = String(t.누가 || '').trim(), row = { 세목: 세목, 금액: 금액, 누가: 누가 || '공동', 방식: '', 근거: '', 사람별: {}, 각자몫: {} };
    사람들.forEach(function (x) { row.사람별[x.이름] = 0; row.각자몫[x.이름] = 0; });
    if (분할 || 신회사) {
      const 성립 = jmYmd_(t.성립일);
      const 전 = 신회사 || /소멸/.test(원인) ? true : (등기 && 성립 ? 성립 <= 등기 : null);
      사람들.forEach(function (x) {
        const 역 = String(x.역할 || '');
        if (전 === false) return;
        if (/^분할법인$/.test(역)) { row.사람별[x.이름] = 금액; row.각자몫[x.이름] = 금액; return; }
        const lim = 신회사 ? 금액 : Math.min(금액, 남은한도[x.이름]); if (!신회사) 남은한도[x.이름] -= lim; // 한도는 세금마다가 아니라 승계 재산가액 하나를 모든 세금이 나눠 씀
        row.사람별[x.이름] = lim;
        if (!신회사 && !(n(x.승계재산가액) > 0)) 알림.push(x.이름 + ' 승계 재산가액을 몰라 한도를 0으로 두었습니다 — 분할계획서·분할 대차대조표로 확인(§25②③)');
      });
      row.방식 = 신회사 ? '신회사 연대 전액' : 전 === false ? '분할등기일 뒤 성립 — 분할법인만' : 전 === null ? '분할 전후 모름(잠정 연대)' : '승계 재산가액 한도 연대';
      if (전 === false) { 사람들.forEach(function (x) { if (/^분할법인$/.test(String(x.역할 || ''))) { row.사람별[x.이름] = 금액; row.각자몫[x.이름] = 금액; } }); }
      row.근거 = 신회사 ? '국세기본법 §25④' : /소멸/.test(원인) ? '국세기본법 §25③' : '국세기본법 §25②';
    } else if (예(t.우회양도)) {
      row.방식 = '우회양도 — 증여자·수증자 연대'; row.근거 = '소득세법 §2의2③·§101②';
      [t.증여자, t.수증자].forEach(function (w) { if (w && row.사람별.hasOwnProperty(w)) row.사람별[w] = 금액; });
      if (t.증여자 && row.각자몫.hasOwnProperty(t.증여자)) row.각자몫[t.증여자] = 금액;
    } else if (/양도소득/.test(세목)) {
      row.방식 = '공동소유 자산 양도 — 각자 자기 몫만'; row.근거 = '소득세법 §2의2⑤';
      if (누가 && row.사람별.hasOwnProperty(누가)) { row.사람별[누가] = 금액; row.각자몫[누가] = 금액; }
      else { 사람들.forEach(function (x) { row.사람별[x.이름] = row.각자몫[x.이름] = 몫(x.이름, 금액); }); 알림.push('양도소득세 ' + won(금액) + '원을 공동 합계로 넣어 지분대로 나눴습니다 — 양도소득세는 사람마다 따로 계산(공제·세율 구간이 사람마다 다름)하니 세액계산 도구로 사람별로 다시 돌릴 것'); }
    } else if (/종합소득|사업소득/.test(세목)) {
      row.근거 = '소득세법 §2의2①·§43';
      if (예(t.합산과세) && t.주된사업자) {
        row.방식 = '§43③ 합산과세 — 주된 공동사업자 + 특수관계인은 자기 분배 소득금액 한도 연대';
        const 주 = String(t.주된사업자), 합 = n(t.합산소득금액);
        if (row.사람별.hasOwnProperty(주)) { row.사람별[주] = 금액; row.각자몫[주] = 금액; }
        사람들.forEach(function (x) {
          if (x.이름 === 주) return;
          const 분배 = n(x.손익분배비율), 내소득 = 합 ? Math.round(합 * 분배 / 100) : 0;
          const lim = 합 ? Math.min(금액, Math.round(금액 * 내소득 / 합)) : 0;
          row.사람별[x.이름] = lim;
          알림.push(x.이름 + ': 연대 한도는 법 문언상 「손익분배비율에 해당하는 그의 소득금액」(' + won(내소득) + '원) — 세액 한도로 ' + won(lim) + '원(합산 세액 × 내 소득 ÷ 합산 소득)으로 바꿔 둠 [확인 필요 — 권장: 한도가 소득금액 단위 — 세액 환산 방법 명문 없음, 비례 환산(지금) 권장]');
        });
        if (!합) 할일.push('합산 소득금액·손익분배비율(동업계약서)을 넣어야 특수관계인 연대 한도를 셉니다');
      } else {
        row.방식 = '공동사업 소득 — 공동사업자별 각자 몫';
        if (누가 && row.사람별.hasOwnProperty(누가)) { row.사람별[누가] = 금액; row.각자몫[누가] = 금액; }
        else { 사람들.forEach(function (x) { row.사람별[x.이름] = row.각자몫[x.이름] = 몫(x.이름, 금액, n(x.손익분배비율) ? '손익분배비율' : '지분'); }); 알림.push('종합소득세를 합계로 넣어 손익분배비율(없으면 지분)로 나눴습니다 — 사람마다 다른 소득과 합쳐 따로 계산되는 세금입니다'); }
      }
    } else {
      row.방식 = '공유물·공동사업 관계 국세 — 연대 전액'; row.근거 = '국세기본법 §25①';
      사람들.forEach(function (x) { row.사람별[x.이름] = 금액; row.각자몫[x.이름] = 몫(x.이름, 금액); });
      if (/종합부동산/.test(세목)) 알림.push('종합부동산세는 사람별로 과세되는 세금이라 §25① 연대에 드는지 [확인 필요 — 권장: 공유물 관련 국세이나 인별 과세 — 원문 없어 [확인 필요] 유지] — 연대로 두었음');
      if (누가) 알림.push(세목 + '에 「누가」(' + 누가 + ')를 적었지만 공유물·공동사업 관계 국세는 연대이므로 모두가 전액까지 낼 수 있습니다');
    }
    표.push(row);
  });
  const 합 = function (who, key) { return 표.reduce(function (a, r) { return a + (r[key][who] || 0); }, 0); };
  const 사람별최대 = {}, 사람별몫 = {};
  사람들.forEach(function (x) { 사람별최대[x.이름] = 합(x.이름, '사람별'); 사람별몫[x.이름] = 합(x.이름, '각자몫'); });
  const 본인 = String(p.본인 || (사람들[0] && 사람들[0].이름) || '');
  const 본인지분 = (사람들.filter(function (x) { return x.이름 === 본인; })[0] || {}).지분;
  const 경우 = [];
  if (본인 && !분할 && !신회사) {
    경우.push({ 이름: '① 법대로', 금액: 사람별최대[본인] || 0, 설명: 본인 + '이(가) 세무서에 낼 수 있는 최대 금액(연대분 전액 + 자기 몫 세금)' });
    경우.push({ 이름: '② [견주기] 모든 세금을 연대 전액으로 잘못 봄', 금액: 표.reduce(function (a, r) { return a + r.금액; }, 0), 설명: '양도소득세·종합소득세까지 남의 몫을 낸다고 봄' });
    경우.push({ 이름: '③ [견주기] 모든 세금을 지분대로만 잘못 봄', 금액: 표.reduce(function (a, r) { return a + (/연대 전액/.test(r.방식) ? Math.round(r.금액 * n(본인지분) / 100) : (r.사람별[본인] || 0)); }, 0), 설명: '부가가치세 등 연대 세금을 자기 지분만 낸다고 봄' });
  } else if (본인) {
    경우.push({ 이름: '① 법대로', 금액: 사람별최대[본인] || 0, 설명: 본인 + '이(가) 연대로 낼 수 있는 최대 금액' });
    경우.push({ 이름: '② [견주기] 한도 없이 전액 연대로 잘못 봄', 금액: 표.reduce(function (a, r) { return a + (/분할법인만/.test(r.방식) ? 0 : r.금액); }, 0), 설명: '승계 재산가액 한도를 놓침' });
  }
  if (표.some(function (r) { return /연대/.test(r.방식); })) {
    할일.push('연대분을 혼자 냈으면 다른 연대납세자에게 그 몫을 돌려받을 수 있습니다(민법 구상) — 지분·약정 증빙을 챙길 것 [실사건 때 확인: 구상 범위]');
    할일.push('연대납세의무자 각자에게 납부고지가 가야 합니다 — 받은 고지서·고지 대상자 확인(국세기본법 §8② 단서: 납부고지·독촉 서류는 연대납세의무자 모두에게 각각 송달, 원문 확인 2026-11-04)');
  }
  할일.push('불복은 고지를 받은 날부터 90일 안(국세기본법 §61·§68)');
  return jmWrap_('연대납세의무', reqs, { 원인: 원인, 표: 표, 사람별최대: 사람별최대, 사람별몫: 사람별몫, 본인: 본인, 경우: 경우, 알림: 알림, 할일: 할일 });
}
// [2026.11.04 복잡사건 136] 양도담보권자의 물적납세의무 — 국세기본법 §42(2026-10-02 시행판)·§35②5호·§35⑥, 국세징수법 §7(2026-10-02 시행판)
//  §42①: 납세자가 국세·강제징수비를 체납하고 양도담보재산이 있으면, 다른 재산에 강제징수를 해도 모자랄 때만 그 양도담보재산으로써 징수한다.
//         단서: 그 국세의 법정기일 전에 담보의 목적이 된 양도담보재산은 그러하지 아니하다.
//  §42②: 국세징수법 §7① 납부고지 뒤 채무 불이행으로 재산이 양도담보권자에게 확정 귀속되어 양도담보권이 소멸해도 고지 당시 재산을 양도담보재산으로 본다.
//  §42③: 양도담보재산 = 계약으로 양도했을 때 실질적으로 양도인에 대한 채권담보의 목적이 된 재산.
//  §35②5호: 양도담보재산에서 징수하는 국세의 법정기일 = 국세징수법 §7 납부고지서 발송일(담보권자 쪽 다른 채권과 견줄 때).
//  국세징수법 §7①: 납부기한은 고지하는 날부터 30일 이내, ②: 납세자에게 통지·물적납세의무자 주소지 세무서장에게도 통지.
//  p: { 납세자, 담보권자, 국세들:[{세목, 금액, 확정(신고|고지|원천|압류), 신고일, 고지발송일, 확정일, 압류등기일}], 강제징수비,
//       다른재산징수액(납세자의 다른 재산으로 걷을 수 있는 금액, 모르면 비움),
//       재산:{ 이름, 가액, 담보설정일(양도담보 설정계약·이전등기일), 피담보채권, 담보의사(예|아니오|모름), 정산약정, 확정귀속일 },
//       고지발송일(담보권자에게 보낸 §7 납부고지서), 특수관계(담보권자가 특수관계인인지) }
function judgeTransferSecurity_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  const 재 = p.재산 || {};
  const 담보일 = jmYmd_(재.담보설정일), 가액 = n(재.가액), 귀속 = jmYmd_(재.확정귀속일), 고지 = jmYmd_(p.고지발송일);
  const 의사 = jmYn_(재.담보의사);
  const 세 = (p.국세들 || []).filter(function (t) { return t && n(t.금액) > 0; });
  const 비 = n(p.강제징수비);
  reqs.push(jmReq_('납세자의 국세 체납', 세.length ? true : null, 세.length ? 세.map(function (t) { return (t.세목 || '국세') + ' ' + won(n(t.금액)); }).join(', ') : '체납 세목·금액·법정기일(체납 내역)', '국세기본법 §42①'));
  reqs.push(jmReq_('양도담보재산(실질이 채권담보)', 의사, 의사 === false ? '실제 매매(진정한 양도) — 양도담보재산이 아니라 물적납세의무 없음' : 의사 === true ? '채권담보 목적의 양도' : '차용증·이자 약정·변제 뒤 되돌려 받기로 한 약정·사용수익 유지로 담보인지 확인', '국세기본법 §42③'));
  // 확정 귀속(채무 불이행으로 담보권자 것이 됨) — 고지 뒤면 §42②로 계속 양도담보재산, 고지 전이면 더는 양도담보재산이 아님
  let 귀속막힘 = false;
  if (귀속) {
    if (고지 && 귀속 > 고지) 알림.push('확정 귀속(' + 귀속 + ')이 납부고지(' + 고지 + ') 뒤라 고지 당시 재산을 계속 양도담보재산으로 봅니다(§42②)');
    else if (고지 && 귀속 <= 고지) { 귀속막힘 = true; 알림.push('납부고지(' + 고지 + ') 전에 확정 귀속(' + 귀속 + ')되어 양도담보권이 소멸했습니다 — §42②는 고지 뒤 귀속만 덮으므로 물적납세의무를 묻기 어렵습니다 (원문 확인 2026-11-04: 국세기본법 §42②)'); }
    else 알림.push('확정 귀속일은 있으나 납부고지 발송일을 몰라 §42②에 드는지 못 가렸습니다 — 고지서로 확인');
  }
  reqs.push(jmReq_('납부고지 전 확정 귀속 아님', 귀속막힘 ? false : (귀속 && !고지 ? null : true), 귀속막힘 ? '고지 전 귀속으로 양도담보권 소멸' : '', '국세기본법 §42②'));
  // 세금마다 법정기일 — §42① 단서(그 국세의 법정기일 전에 담보의 목적이 된 재산은 제외)
  let 잠정 = false;
  세.forEach(function (t, i) {
    const 확 = String(t.확정 || '').trim();
    let 날 = null, 근 = '';
    if (/압류/.test(확) && jmYmd_(t.압류등기일)) { 날 = jmYmd_(t.압류등기일); 근 = '§35②6호 압류등기일'; }
    else if (/원천|인지/.test(확)) { 날 = jmYmd_(t.확정일); 근 = '§35②3호 확정일'; }
    else if (/고지|결정|경정|수시/.test(확)) { 날 = jmYmd_(t.고지발송일); 근 = '§35②2호 납부고지서 발송일'; }
    else if (/신고/.test(확)) { 날 = jmYmd_(t.신고일); 근 = '§35②1호 신고일'; }
    else { 날 = jmYmd_(t.신고일) || jmYmd_(t.고지발송일); 근 = '확정 방식 모름'; }
    let 가능 = null, 왜 = '';
    if (!날 || !담보일) { 잠정 = true; 왜 = !날 ? '법정기일 모름(잠정 포함)' : '담보 설정일 모름(잠정 포함)'; 가능 = true; }
    else if (담보일 < 날) { 가능 = false; 왜 = '법정기일(' + 날 + ') 전에 담보가 됨(' + 담보일 + ') — 이 재산에서 못 걷음'; }
    else { 가능 = true; 왜 = '담보(' + 담보일 + ')가 법정기일(' + 날 + ') 뒤 — 이 재산에서 걷을 수 있음'; if (담보일 === 날) 알림.push((t.세목 || '국세') + ': 담보 설정일과 법정기일이 같은 날입니다 — 「전에」가 아니라 걷을 수 있다고 보았음 (원문 확인 2026-11-04: 국세기본법 §42① 단서)'); }
    표.push({ 세목: String(t.세목 || '국세 ' + (i + 1)), 금액: n(t.금액), 법정기일: 날, 근거: 근, 담보재산에서: 가능 ? (왜.indexOf('잠정') >= 0 ? '잠정 가능' : '가능') : '불가', 왜: 왜 });
  });
  const 체납합 = 세.reduce(function (a, t) { return a + n(t.금액); }, 0) + 비;
  const 가능합 = 표.filter(function (r) { return r.담보재산에서 !== '불가'; }).reduce(function (a, r) { return a + r.금액; }, 0) + (비 && 표.some(function (r) { return r.담보재산에서 !== '불가'; }) ? 비 : 0);
  if (비) 알림.push('강제징수비 ' + won(비) + '원은 걷을 수 있는 세금과 함께 담보재산에서 걷는다고 보았음 (원문 확인 2026-11-04: 국세기본법 §42①(「국세 및 강제징수비를 징수」))');
  // 보충성 — 다른 재산으로 강제징수해도 모자랄 때만
  const 다른 = p.다른재산징수액 === '' || p.다른재산징수액 == null ? null : n(p.다른재산징수액);
  let 부족 = null;
  if (다른 === null) { 잠정 = true; 부족 = 체납합; 알림.push('납세자의 다른 재산으로 걷을 금액을 몰라 체납 전액이 모자란다고 잠정했습니다 — 재산 조회·압류 결과로 확인'); }
  else 부족 = Math.max(0, 체납합 - 다른);
  reqs.push(jmReq_('다른 재산으로 강제징수해도 모자람', 다른 === null ? null : 부족 > 0, 다른 === null ? '다른 재산 강제징수 결과 모름' : (부족 > 0 ? '모자라는 금액 ' + won(부족) + '원' : '다른 재산으로 다 걷힘'), '국세기본법 §42① 본문'));
  reqs.push(jmReq_('법정기일 뒤에 담보가 된 세금이 있음', 표.length ? (표.some(function (r) { return r.담보재산에서 !== '불가'; }) ? (표.some(function (r) { return /잠정/.test(r.담보재산에서); }) ? null : true) : false) : null, 표.length ? '' : '세금별 법정기일·담보 설정일', '국세기본법 §42① 단서·§35②'));
  // 걷을 수 있는 금액 — min(법정기일 뒤 세금, 모자라는 금액, 재산 가액). 다른 재산이 어느 세금에 먼저 들어가는지에 따라 아래로 내려갈 수 있음
  const 상한 = Math.min(가능합, 부족, 가액 || Infinity);
  const 하한 = 다른 === null ? 상한 : Math.min(Math.max(0, 가능합 - 다른), 가액 || Infinity);
  if (!가액) { 잠정 = true; 알림.push('양도담보재산 가액을 몰라 재산 가액 한도를 두지 않았습니다 — 감정·시세로 확인(물적납세는 그 재산으로써만 걷음)'); }
  const 결과금액 = (의사 === false || 귀속막힘) ? 0 : (isFinite(상한) ? 상한 : 0);
  if (결과금액 && 하한 < 상한) 알림.push('다른 재산으로 걷은 ' + won(다른) + '원을 담보재산에서 걷을 수 있는 세금(' + won(가능합) + '원)에 먼저 넣으면 ' + won(하한) + '원까지 내려갑니다 — 어느 세금에 먼저 충당하는지 [확인 필요 — 권장: 확인 못 함 — 유지]');
  if (재.피담보채권 && 가액) 알림.push('양도담보권자 채권 ' + won(n(재.피담보채권)) + '원 — 매각대금에서 이 채권과 국세의 순서는 국세우선 판정(§35, 양도담보재산 국세 법정기일 = 고지서 발송일 §35②5호)으로 따로 볼 것 (원문 확인 2026-11-04: 국세기본법 §35②5호)');
  // 특수관계인과 법정기일 전 1년 안 양도담보 설정 → 짜고 한 거짓 계약 추정(§35⑥ 후단)
  if (jmYn_(p.특수관계) === true && 담보일) {
    표.forEach(function (r) { if (r.법정기일 && r.담보재산에서 === '불가') { const d = jmDays_(담보일, r.법정기일); if (d > 0 && d <= 366) 알림.push(r.세목 + ': 특수관계인과 법정기일 전 1년 안에 맺은 양도담보 설정계약이라 짜고 한 거짓 계약으로 추정됩니다 — 세무서가 법원에 취소를 청구할 수 있습니다(국세기본법 §35⑥) [확인 필요 — 권장: 초일 불산입 역산 — 지금 366일 셈 대체로 맞음]'); } });
  }
  if (의사 === false) 알림.push('진정한 양도(매매)라면 물적납세의무가 아니라 그 양도의 양도소득세·사해행위 취소 문제로 봅니다 — 「양도여부」 판정(양도담보 유형)도 함께 볼 것');
  const 경우 = [
    { 이름: '① 법대로', 금액: 결과금액, 설명: (p.담보권자 || '양도담보권자') + '이(가) 그 재산으로써 낼 수 있는 최대 금액(법정기일 뒤 담보 세금 · 모자라는 금액 · 재산 가액 중 적은 것)' },
    { 이름: '② [견주기] 법정기일 단서를 놓침(모든 세금)', 금액: (의사 === false || 귀속막힘) ? 0 : Math.min(체납합, 부족, 가액 || Infinity), 설명: '법정기일 전에 담보가 된 세금까지 걷는다고 봄' },
    { 이름: '③ [견주기] 보충성을 놓침(다른 재산 무시)', 금액: (의사 === false || 귀속막힘) ? 0 : Math.min(가능합, 가액 || Infinity), 설명: '다른 재산으로 걷을 수 있어도 담보재산에서 먼저 걷는다고 봄' }
  ];
  if (결과금액 > 0) {
    할일.push({ 무엇: '양도담보권자에게 국세징수법 §7 납부고지서가 왔는지 — 징수할 금액·산출 근거가 적혔는지 확인, 납부기한은 고지일부터 30일 안', 때: '고지 받은 날', 근거: '국세징수법 §7①' });
    할일.push({ 무엇: '납세자에게도 통지가 갔는지 확인(담보권자 주소지 세무서장에게도 통지)', 때: '고지 뒤', 근거: '국세징수법 §7②' });
    할일.push({ 무엇: '담보권자가 대신 낸 금액은 납세자에게 돌려받거나 피담보채권에 더할 수 있는지 약정 확인', 때: '납부 전', 근거: '[실사건 때 확인: 민법 구상]' });
  }
  할일.push({ 무엇: '불복은 고지를 받은 날부터 90일 안', 때: '고지 받은 날부터', 근거: '국세기본법 §61①·§68①' });
  const r = jmWrap_('양도담보물적납세', reqs, { 납세자: p.납세자 || '', 담보권자: p.담보권자 || '', 표: 표, 체납합: 체납합, 담보재산에서걷을수있는세금: 가능합, 모자라는금액: 부족, 걷을금액: 결과금액, 하한: 결과금액 ? 하한 : 0, 경우: 경우, 알림: 알림, 할일: 할일 });
  if (잠정 && r.결론 === '충족' && !r.잠정) { r.잠정 = true; r.표시 = r.표시.replace('— 충족', '— 충족(잠정)'); }
  return r;
}
// [2026.11.04 복잡사건 137] 미분양주택 양도소득세 특례 가르기 — 조특법 §98의2~§98의9·조특령 §98의2~§98의8(20270101 판 원문)
//  §98의2: 거주자가 2008.11.3~2010.12.31(그때까지 계약·계약금 포함) 취득한 수도권 밖 미분양주택 — 장특 표2·기본세율, §89①3호 주택 수 제외.
//  §98의3: 거주자 2009.2.12~2010.2.11 / 비거주자(국내사업장 없음) 2009.3.16~2010.2.11, 서울 밖(지정지역 제외)·사업주체 최초 계약 미분양 —
//          5년 안 양도 100%(과밀억제권역 60%), 5년 뒤면 5년 차익 공제. ③ 주택 수 제외. 시행령 §98의3② 입주사실·해제 재계약·대체계약 제외, 과밀은 대지 660㎡·149㎡ 한도.
//  §98의4: 비거주자(국내사업장 없음) 2009.3.16~2010.2.11 취득 주택(§98의3 미분양 아닌 것) — 세액 10% 감면.
//  §98의5: 2010.2.11 미분양인 수도권 밖 주택을 2011.4.30까지 사업주체 등과 최초 계약 — 5년 안 분양가 인하율 10% 이하 60·20% 이하 80·넘으면 100. ② 주택 수 제외.
//  §98의6: 준공후미분양(2011.3.29 기준) 최초 계약 — 1호 사업주체가 2011.12.31까지 계약해 2년 이상 임대, 2호 본인이 등록·2011.12.31까지 임대계약해 5년 이상 임대 — 50%. ② 주택 수 제외.
//  §98의7: 내국인이 2012.9.24~12.31 최초 계약·계약금, 2012.9.23 미분양, 9억 이하 — 5년 안 100%. ② 주택 수 제외.
//  §98의8: 거주자가 2015.1.1~12.31 최초 계약, 2014.12.31 준공후미분양, 6억 이하·135㎡ 이하, 2015.12.31까지 등록·임대계약해 5년 이상 임대 — 5년 차익 50% 공제. ② 주택 수 제외.
//  §98의9: 1세대 1주택자가 2024.1.10~2026.12.31 수도권 밖 준공후미분양(85㎡·6억, 2026.2.27 이후 취득 7억) 최초 계약 취득 — 종전 주택 1세대1주택 판정 때 그 주택 제외.
//  p: { 조문(sect98_3 등, 모르면 비움), 납세자(거주자|비거주자|내국인), 국내사업장(있음|없음), 계약일, 계약금납부일, 취득일, 양도일,
//       상대방(사업주체최초|대한주택보증|시공자대물|부동산투자회사|신탁업자|기타), 소재지(서울|지정지역|과밀억제|수도권|지방),
//       기준일미분양(예|아니오), 준공후미분양(예|아니오), 분양공고가, 계약가, 취득가액, 전용면적, 대지면적,
//       입주사실(예=계약일 현재 입주한 적 있음), 해제재계약, 대체계약, 자기건설, 조합원, 임대:{누가(사업주체|본인), 등록일, 계약일, 연수},
//       1세대1주택(예=§98의9 취득 때 다른 주택 1채), 산출세액(엔진에서 낸 양도소득 산출세액 — 있으면 감면액을 보임) }
function judgeUnsoldHouse_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const 계약 = jmYmd_(p.계약일), 계약금 = jmYmd_(p.계약금납부일), 취득 = jmYmd_(p.취득일), 양도 = jmYmd_(p.양도일);
  const 기준날 = 계약 || 계약금 || 취득;
  const in_ = function (a, b) { return 기준날 ? (기준날 >= a && 기준날 <= b) : null; };
  const 사람 = String(p.납세자 || '').trim(), 장 = String(p.국내사업장 || '').trim();
  const 거주자 = 사람 ? /거주자/.test(사람) && !/비거주/.test(사람) : null;
  const 비사업장 = /비거주/.test(사람) ? (장 ? /없/.test(장) : null) : (사람 ? false : null);
  const 곳 = String(p.소재지 || '').trim();
  const 수도권밖 = 곳 ? /지방|수도권\s*밖|비수도권/.test(곳) : null;
  const 서울밖 = 곳 ? !/서울/.test(곳) && !/지정지역/.test(곳) : null;
  const 과밀 = 곳 ? /과밀/.test(곳) : null;
  const 상 = String(p.상대방 || '').trim();
  const 최초 = 상 ? !/기타|개인|전매|아님/.test(상) : null;
  const 미분 = jmYn_(p.기준일미분양), 준공후 = jmYn_(p.준공후미분양);
  const 입주 = jmYn_(p.입주사실), 재계약 = jmYn_(p.해제재계약), 대체 = jmYn_(p.대체계약);
  const 가액 = n(p.취득가액), 면적 = n(p.전용면적), 대지 = n(p.대지면적);
  const 공고 = n(p.분양공고가), 계약가 = n(p.계약가);
  const 인하율 = 공고 && 계약가 ? Math.round((공고 - 계약가) / 공고 * 10000) / 100 : null;
  const 임 = p.임대 || {};
  const 보유년 = 취득 && 양도 ? jmDays_(취득, 양도) / 365.25 : null;
  const 오년안 = 보유년 == null ? null : 보유년 <= 5;
  const 산출 = n(p.산출세액);
  const 제외 = function (reqs, 근거) {
    reqs.push(jmReq_('계약일 현재 입주한 적 없음', 입주 == null ? null : !입주, 입주 ? '이미 입주한 사실이 있는 주택은 빠짐' : '입주 사실(전입·관리비) 확인', 근거));
    reqs.push(jmReq_('기간 안 해제 뒤 같은 주택 재계약 아님', 재계약 == null ? null : !재계약, 재계약 ? '해제하고 다시 계약한 주택은 빠짐' : '', 근거));
    reqs.push(jmReq_('대체 주택 계약 아님', 대체 == null ? null : !대체, 대체 ? '다른 주택 대신 바꿔 계약한 것은 빠짐' : '', 근거));
  };
  const 후보 = [];
  const add = function (조, 이름, reqs, 효과, 엔진) {
    const r = jmWrap_(이름, reqs, {});
    후보.push({ 조문: 조, 이름: 이름, 결론: r.결론, 잠정: r.잠정, 요건: reqs, 효과: 효과, 엔진: 엔진, 남은것: r.남은것 });
  };
  // §98의2
  (function () {
    const reqs = [];
    reqs.push(jmReq_('거주자', 거주자, 사람 || '거주자인지', '조특법 §98의2①'));
    reqs.push(jmReq_('2008.11.3~2010.12.31 취득(그때까지 계약·계약금 포함)', in_('2008-11-03', '2010-12-31'), 기준날 || '계약일·계약금 납부일', '조특법 §98의2①'));
    reqs.push(jmReq_('수도권 밖 미분양주택', 수도권밖 === false ? false : (수도권밖 && 미분 !== false ? (미분 ? true : null) : null), 곳 || '소재지·미분양 여부(시장·군수 날인 계약서)', '조특법 §98의2①·조특령 §98의2①'));
    add('sect98_2', '§98의2 지방 미분양주택 과세특례', reqs, '장기보유특별공제 표2·기본세율, 1세대1주택 판정 때 주택 수 제외(§98의2④) — 감면율 아님', 'unsoldHouseReductionProvision=sect98_2 — 장특 표2 보유 칸·중과 뺌·주택 수 제외 알림 [확인 필요 — 권장: 각 호에서 표1/표2 어느 것인지 원문 확인 필요 — 2021년 이후 거주 요건 가산은 §95② 표2 본문 구조상 적용 여부 해석]');
  })();
  // §98의3
  (function () {
    const reqs = [];
    const 사람ok = 거주자 === true ? in_('2009-02-12', '2010-02-11') : (비사업장 === true ? in_('2009-03-16', '2010-02-11') : (사람 ? false : null));
    reqs.push(jmReq_('거주자 2009.2.12~2010.2.11 / 국내사업장 없는 비거주자 2009.3.16~2010.2.11 계약·취득', 사람ok, (사람 || '납세자') + ' · ' + (기준날 || '계약일'), '조특법 §98의3①'));
    reqs.push(jmReq_('서울 밖(지정지역 제외)', 서울밖, 곳 || '소재지', '조특법 §98의3①'));
    reqs.push(jmReq_('사업주체 등과 최초 계약한 미분양주택', 최초 === false ? false : (최초 && 미분 ? true : (미분 === false ? false : null)), 상 || '상대방·2009.2.11 미분양 여부', '조특령 §98의3①'));
    if (jmYn_(p.조합원) === true) reqs.push(jmReq_('재개발·재건축 조합원 분 아님', false, '조합원 몫 주택은 빠짐', '조특법 §98의3②'));
    if (과밀) reqs.push(jmReq_('과밀억제권역은 대지 660㎡·면적 149㎡ 이하', (대지 || 면적) ? (대지 <= 660 && 면적 <= 149) : null, '대지 ' + (대지 || '?') + '㎡ · 면적 ' + (면적 || '?') + '㎡', '조특령 §98의3①'));
    제외(reqs, '조특령 §98의3②');
    const 율 = 과밀 ? 60 : 100;
    add('sect98_3', '§98의3 미분양주택 감면', reqs, 오년안 === false ? '5년 넘어 양도 — 취득일부터 5년간 생긴 차익을 소득금액에서 뺌' : '5년 안 양도 — 산출세액 ' + 율 + '% 감면' + (과밀 ? '(과밀억제권역)' : ''), 'unsoldHouseReductionProvision=sect98_3 · uhIsOverconcentrationZone=' + (과밀 ? '예' : '아니오') + (오년안 === false ? ' · uhFiveYearMarkValue(5년 되는 날 시가)·기준시가 두 칸' : ''));
  })();
  // §98의4
  (function () {
    const reqs = [];
    reqs.push(jmReq_('국내사업장 없는 비거주자', 비사업장, 사람 || '납세자', '조특법 §98의4'));
    reqs.push(jmReq_('2009.3.16~2010.2.11 계약·취득', in_('2009-03-16', '2010-02-11'), 기준날 || '계약일', '조특법 §98의4'));
    add('sect98_4', '§98의4 비거주자 주택 10% 감면', reqs, '산출세액 10% 감면(보유기간 요건 없음, §98의3 미분양주택이면 §98의3이 먼저)', 'unsoldHouseReductionProvision=sect98_4');
  })();
  // §98의5
  (function () {
    const reqs = [];
    reqs.push(jmReq_('거주자 또는 비거주자', 사람 ? /거주/.test(사람) : null, 사람 || '납세자', '조특법 §98의5①'));
    reqs.push(jmReq_('수도권 밖', 수도권밖, 곳 || '소재지', '조특법 §98의5①'));
    reqs.push(jmReq_('2010.2.11 현재 미분양을 2011.4.30까지 사업주체 등과 최초 계약', 기준날 ? (기준날 >= '2010-02-12' && 기준날 <= '2011-04-30' && 최초 !== false && 미분 !== false ? (최초 && 미분 ? true : null) : false) : null, (기준날 || '계약일') + (상 ? ' · ' + 상 : ''), '조특법 §98의5①·조특령 §98의4①'));
    제외(reqs, '조특령 §98의4②');
    const 율 = 인하율 == null ? null : 인하율 <= 10 ? 60 : 인하율 <= 20 ? 80 : 100;
    reqs.push(jmReq_('분양가 인하율(분양공고가 대비)', 인하율 == null ? null : true, 인하율 == null ? '분양공고가·계약가' : 인하율 + '% → ' + 율 + '%', '조특령 §98의4④'));
    add('sect98_5', '§98의5 지방 미분양주택 감면', reqs, 오년안 === false ? '5년 넘어 양도 — 5년간 차익 × 감면율만큼 뺌' : '5년 안 양도 — 산출세액 ' + (율 == null ? '60~100' : 율) + '% 감면', 'unsoldHouseReductionProvision=sect98_5 · uhPriceDiscountRate=' + (인하율 == null ? '?' : 인하율));
    후보[후보.length - 1].율 = 율;
  })();
  // §98의6
  (function () {
    const reqs = [];
    const 누가 = String(임.누가 || '').trim();
    reqs.push(jmReq_('준공후미분양(2011.3.29 현재 사용검사 뒤 미계약)을 2011.3.29~12.31 사업주체 등과 최초 계약', in_('2011-03-29', '2011-12-31') === false || 준공후 === false || 최초 === false ? false : (준공후 && 최초 && 기준날 ? true : null), (기준날 || '계약일') + (상 ? ' · ' + 상 : ''), '조특법 §98의6①·조특령 §98의5②③ [확인 필요 — 권장: 「2011.12.31까지 임대계약」만 있고 시작일 명문 없음 — 시행령 ② 사용검사 기준일(2011.3.29)로 잠정]'));
    if (/사업주체/.test(누가)) {
      reqs.push(jmReq_('사업주체 등이 2011.12.31까지 임대계약해 2년 이상 임대', jmYmd_(임.계약일) ? (jmYmd_(임.계약일) <= '2011-12-31' && n(임.연수) >= 2 ? true : (n(임.연수) ? false : null)) : null, '임대계약 ' + (jmYmd_(임.계약일) || '?') + ' · ' + (임.연수 || '?') + '년', '조특법 §98의6①1호'));
    } else {
      reqs.push(jmReq_('본인이 사업자·임대사업자 등록하고 2011.12.31까지 임대계약해 5년 이상 임대', (jmYmd_(임.등록일) && jmYmd_(임.계약일)) ? (jmYmd_(임.계약일) <= '2011-12-31' && n(임.연수) >= 5 ? true : (n(임.연수) ? false : null)) : null, '등록 ' + (jmYmd_(임.등록일) || '?') + ' · 임대계약 ' + (jmYmd_(임.계약일) || '?') + ' · ' + (임.연수 || '?') + '년(등록일부터 셈, 시행령 §98의5⑤)', '조특법 §98의6①2호'));
    }
    제외(reqs, '조특령 §98의5③');
    add('sect98_6', '§98의6 준공후미분양 임대 감면', reqs, 오년안 === false ? '5년 넘어 양도 — 5년간 차익의 50% 뺌' : '5년 안 양도 — 산출세액 50% 감면', 'unsoldHouseReductionProvision=sect98_6 · uhSect986ItemType=' + (/사업주체/.test(누가) ? "''(1호)" : "'item2'(2호)"));
  })();
  // §98의7
  (function () {
    const reqs = [];
    reqs.push(jmReq_('내국인', 사람 ? !/외국/.test(사람) : null, 사람 || '납세자', '조특법 §98의7①'));
    reqs.push(jmReq_('2012.9.24~12.31 최초 계약·계약금', 기준날 ? (in_('2012-09-24', '2012-12-31') && 최초 !== false ? (최초 ? true : null) : false) : null, (기준날 || '계약일') + (상 ? ' · ' + 상 : ''), '조특법 §98의7①'));
    reqs.push(jmReq_('2012.9.23 현재 미분양', 미분, '', '조특령 §98의6①'));
    reqs.push(jmReq_('실지 취득가액 9억 이하(취득세 제외)', 가액 ? 가액 <= 900000000 : null, 가액 ? won(가액) : '취득가액', '조특령 §98의6②'));
    제외(reqs, '조특령 §98의6②');
    add('sect98_7', '§98의7 미분양주택 감면(2012)', reqs, 오년안 === false ? '5년 넘어 양도 — 5년간 차익을 뺌' : '5년 안 양도 — 산출세액 100% 감면', 'unsoldHouseReductionProvision=sect98_7');
  })();
  // §98의8
  (function () {
    const reqs = [];
    reqs.push(jmReq_('거주자', 거주자, 사람 || '납세자', '조특법 §98의8①'));
    reqs.push(jmReq_('2014.12.31 현재 준공후미분양을 2015.1.1~12.31 사업주체 등과 최초 계약', 기준날 ? (in_('2015-01-01', '2015-12-31') && 준공후 !== false && 최초 !== false ? (준공후 && 최초 ? true : null) : false) : null, 기준날 || '계약일', '조특법 §98의8①·조특령 §98의7①'));
    reqs.push(jmReq_('취득가액 6억 이하·면적 135㎡ 이하', (가액 && 면적) ? (가액 <= 600000000 && 면적 <= 135) : ((가액 > 600000000 || 면적 > 135) ? false : null), won(가액) + ' · ' + (면적 || '?') + '㎡', '조특법 §98의8①'));
    reqs.push(jmReq_('2015.12.31까지 등록·임대계약하고 5년 이상 임대', (jmYmd_(임.등록일) && jmYmd_(임.계약일)) ? (jmYmd_(임.등록일) <= '2015-12-31' && jmYmd_(임.계약일) <= '2015-12-31' && n(임.연수) >= 5 ? true : (n(임.연수) ? false : null)) : null, '등록 ' + (jmYmd_(임.등록일) || '?') + ' · 임대 ' + (임.연수 || '?') + '년', '조특법 §98의8①'));
    add('sect98_8', '§98의8 준공후미분양 임대 과세특례(2015)', reqs, '취득일부터 5년간 차익의 50%를 소득금액에서 뺌(5년 임대 뒤)', 'unsoldHouseReductionProvision=sect98_8 · uhExclusiveAreaSqm=' + (면적 || '?'));
  })();
  // §98의9
  (function () {
    const reqs = [];
    const 한도 = 취득 && 취득 >= '2026-02-27' ? 700000000 : 600000000;
    reqs.push(jmReq_('1세대 1주택자가 취득', jmYn_(p['1세대1주택']), '취득 때 다른 주택 1채인지', '조특법 §98의9①'));
    reqs.push(jmReq_('2024.1.10~2026.12.31 취득', 취득 ? (취득 >= '2024-01-10' && 취득 <= '2026-12-31') : null, 취득 || '취득일', '조특법 §98의9①'));
    reqs.push(jmReq_('수도권 밖 준공후미분양을 사업주체·분양사업자·시공자와 최초 계약', 수도권밖 === false || 준공후 === false || 최초 === false ? false : (수도권밖 && 준공후 && 최초 ? true : null), (곳 || '소재지') + (상 ? ' · ' + 상 : ''), '조특령 §98의8'));
    reqs.push(jmReq_('면적 85㎡·취득가액 ' + (한도 / 1e8) + '억 이하', (가액 && 면적) ? (가액 <= 한도 && 면적 <= 85) : ((가액 > 한도 || 면적 > 85) ? false : null), won(가액) + ' · ' + (면적 || '?') + '㎡', '조특령 §98의8(2026.2.27 개정 7억)'));
    add('sect98_9', '§98의9 준공후미분양 1주택 특례', reqs, '종전 주택을 팔 때 이 주택을 1세대1주택 판정에서 뺌(감면 아님) — 이 주택 자체를 팔 때는 일반 과세', '감면 칸 아님 — 1세대1주택 판정·중과판정에서 주택 수 제외로 반영');
  })();
  // 고르기: 지정한 조문이 있으면 그것, 없으면 충족 → 잠정 순
  const 순 = { '충족': 0 };
  const 지정 = String(p.조문 || '').replace(/§|의/g, function (m) { return m === '§' ? 'sect' : '_'; }).replace(/^98_/, 'sect98_');
  let 고름 = 후보.filter(function (c) { return c.조문 === 지정; })[0];
  if (!고름) {
    const 율표 = { sect98_3: 과밀 ? 60 : 100, sect98_4: 10, sect98_6: 50, sect98_7: 100, sect98_8: 50, sect98_2: 0, sect98_9: 0 };
    const 큰순 = function (a, b) { return ((b.조문 === 'sect98_5' ? (b.율 || 60) : 율표[b.조문]) || 0) - ((a.조문 === 'sect98_5' ? (a.율 || 60) : 율표[a.조문]) || 0); };
    const ok = 후보.filter(function (c) { return c.결론 === '충족' && !c.잠정; }).sort(큰순);
    const 잠 = 후보.filter(function (c) { return c.결론 === '충족' && c.잠정; }).sort(큰순);
    고름 = ok[0] || 잠[0] || null;
  }
  const 알림 = [], 할일 = [];
  const 주택수제외 = 고름 && 고름.결론 === '충족' && ['sect98_2', 'sect98_3', 'sect98_5', 'sect98_6', 'sect98_7', 'sect98_8', 'sect98_9'].indexOf(고름.조문) >= 0;
  if (주택수제외) 알림.push('이 주택은 다른 주택을 팔 때 1세대1주택 판정에서 주택 수에 넣지 않습니다(' + (고름.조문 === 'sect98_2' ? '§98의2④' : 고름.조문 === 'sect98_9' ? '§98의9①' : 고름.조문.replace('sect98_', '§98의') + ' 주택 수 제외 항') + ') — 「1세대1주택」·「중과판정」 판정에 함께 넣을 것. 다주택 중과 주택 수에서는 §98의2·§98의3·§98의5~§98의8 감면 주택만 빠지고(소득령 §167의3①5호 목록 — 원문 확인 2026-11-04) §98의4·§98의9는 그 목록에 없어 중과 주택 수에는 셈');
  if (고름 && /sect98_[3578]/.test(고름.조문) && 오년안 === false) 알림.push('취득일부터 5년이 넘어 양도했습니다 — 5년 되는 날 시가(없으면 기준시가 비율)로 5년간 차익을 따로 셉니다');
  if (후보.filter(function (c) { return c.결론 === '충족'; }).length > 1) 알림.push('두 조문 이상에 걸립니다: ' + 후보.filter(function (c) { return c.결론 === '충족'; }).map(function (c) { return c.이름; }).join(', ') + ' — 겹쳐 받지 못하니 유리한 하나를 고를 것 (원문 확인 2026-11-04: 조특법 §127⑦)');
  if (jmYn_(p.자기건설) === true) 알림.push('직접 지은 주택은 §98의3②(기간 안 착공·사용승인)만 넣고, 소실·멸실 뒤 다시 지은 것은 빠집니다');
  할일.push({ 무엇: '시장·군수·구청장이 미분양주택임을 확인해 날인한 매매계약서 사본(§98의9는 사업주체 확인서)', 때: '예정신고 또는 확정신고 때 함께 냄', 근거: '조특령 §98의2②·§98의3⑤·§98의4⑤·§98의5⑥·§98의6⑤' });
  if (고름 && /sect98_[68]/.test(고름.조문)) 할일.push({ 무엇: '사업자·임대사업자 등록증·임대차계약서 사본', 때: '신고 때', 근거: '조특령 §98의5⑥' });
  할일.push({ 무엇: '감면받으면 농어촌특별세 20% 함께', 때: '신고 때', 근거: '(원문 확인 2026-11-04: 농어촌특별세법 §5①1호·§4 비과세 목록)' });
  const 율 = 고름 ? (고름.조문 === 'sect98_3' ? (과밀 ? 60 : 100) : 고름.조문 === 'sect98_4' ? 10 : 고름.조문 === 'sect98_5' ? 고름.율 : 고름.조문 === 'sect98_6' ? 50 : 고름.조문 === 'sect98_7' ? 100 : 0) : 0;
  const 감면액 = 고름 && 고름.결론 === '충족' && 산출 && 오년안 !== false ? Math.floor(산출 * (율 || 0) / 100) : 0;
  const 경우 = [];
  if (산출) {
    경우.push({ 이름: '① 법대로', 감면율: 율 || 0, 감면액: 감면액, 낼세금: 산출 - 감면액, 설명: 고름 ? 고름.이름 + ' — ' + 고름.효과 : '맞는 조문 없음' });
    if (고름 && 고름.조문 === 'sect98_3' && 과밀) 경우.push({ 이름: '② [견주기] 과밀억제권역을 놓쳐 100%', 감면율: 100, 감면액: 산출, 낼세금: 0, 설명: '과밀억제권역이면 60%뿐' });
    if (고름 && 고름.조문 === 'sect98_5' && 율 !== 100) 경우.push({ 이름: '② [견주기] 인하율을 안 보고 100%', 감면율: 100, 감면액: 산출, 낼세금: 0, 설명: '인하율 ' + 인하율 + '%면 ' + 율 + '%' });
    if (!고름 || 고름.결론 !== '충족') 경우.push({ 이름: '② [견주기] 요건 안 보고 감면', 감면율: 100, 감면액: 산출, 낼세금: 0, 설명: '요건이 빠져도 계산기 칸만 고르면 감면됨' });
  }
  const 표 = 후보.map(function (c) { return { 조문: c.조문.replace('sect98_', '§98의'), 이름: c.이름, 결론: c.결론 + (c.잠정 && c.결론 === '충족' ? '(잠정)' : ''), 효과: c.효과, 엔진: c.엔진, 못갖춤: c.요건.filter(function (r) { return r.결과 === '✘'; }).map(function (r) { return r.이름; }) }; });
  const reqs = 고름 ? 고름.요건 : [jmReq_('맞는 미분양 특례 조문', 후보.every(function (c) { return c.결론 === '안 됨'; }) ? false : null, '어느 조문에도 맞지 않음', '조특법 §98의2~§98의9')];
  const r = jmWrap_('미분양주택특례', reqs, { 고른조문: 고름 ? 고름.조문.replace('sect98_', '§98의') : '', 이름: 고름 ? 고름.이름 : '', 효과: 고름 ? 고름.효과 : '일반 양도로 계산', 엔진칸: 고름 ? 고름.엔진 : '', 감면율: 율 || 0, 분양가인하율: 인하율, 보유년: 보유년 == null ? null : Math.round(보유년 * 100) / 100, 주택수제외: !!주택수제외, 감면액: 감면액, 후보: 표, 경우: 경우, 알림: 알림, 할일: 할일 });
  return r;
}

// [2026.11.04 복잡사건 138] 상속세 외국납부세액공제 — 상증법 §29(2026-01-02 시행판)·§67④, 시행령 §21(2026-10-01 시행판)
//  §29: 거주자의 사망으로 상속세를 부과하는 경우, 외국에 있는 상속재산에 대하여 외국 법령에 따라 상속세를 부과받았으면 그 상속세 상당액을 산출세액에서 공제.
//  시행령 §21①: 공제액 = 상속세산출세액 × (외국 법령에 따라 상속세가 부과된 상속재산의 과세표준(그 외국 법령 기준) ÷ 법 §25① 상속세 과세표준).
//              다만 외국 법령에 따라 부과된 상속세액을 넘으면 그 상속세액이 한도. ②: 외국납부세액공제신청서를 과세표준신고와 함께 제출.
//  §67④: 피상속인이나 상속인이 외국에 주소를 두면 신고기한 9개월.
//  p: { 피상속인거주자(예|아니오), 상속개시일, 피상속인외국주소, 상속인외국주소, 우리과세표준, 산출세액, 증여세액공제(§28 등 앞 공제 합계),
//       나라들:[{ 나라, 재산(국외에 있는 재산 이름들), 국외재산평가액(우리 평가, 원), 세종류(상속세|유산세|증여세|소득세|지방세|모름),
//                 국내재산포함(외국 과세표준에 국내 재산도 들어갔는지 예|아니오), 외국과세표준(원화 환산 뒤, 원), 국외분과세표준(국외 재산 몫만, 원),
//                 외국납부세액(원화, 가산세·이자 뺀 본세), 가산세포함(넣은 납부액에 가산세·이자가 섞였는지), 결정상태(확정|신고만|불복중|모름) }] }
function judgeForeignEstateTaxCredit_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  let 잠정 = false;
  const 거주 = jmYn_(p.피상속인거주자);
  const 과표 = n(p.우리과세표준), 산출 = n(p.산출세액), 앞공제 = n(p.증여세액공제);
  const 나라 = (p.나라들 || []).filter(function (c) { return c && (n(c.외국납부세액) > 0 || n(c.외국과세표준) > 0 || c.나라); });
  reqs.push(jmReq_('거주자의 사망으로 상속세를 매김', 거주, 거주 === false ? '비거주자 피상속인 — 국내 재산만 과세하고 외국납부세액공제는 없음' : 거주 === true ? '' : '피상속인 거주자 여부(「거주자」 판정)', '상증법 §29'));
  reqs.push(jmReq_('외국에 있는 상속재산에 외국 상속세를 부과받음', 나라.length ? (나라.some(function (c) { return n(c.외국납부세액) > 0; }) ? true : null) : null, 나라.length ? '' : '나라별 외국 상속세 결정·납부 내역', '상증법 §29'));
  let 합공제 = 0, 합납부 = 0, 합과표 = 0, 단순합 = 0;
  나라.forEach(function (c) {
    const 이름 = c.나라 || '외국';
    const 종류 = String(c.세종류 || '').trim();
    const 납 = n(c.외국납부세액), 외과 = n(c.외국과세표준);
    let 분자 = n(c.국외분과세표준), 비고 = [];
    let 인정 = true;
    if (/증여|소득|지방/.test(종류)) {
      if (/지방/.test(종류)) { 비고.push('지방정부 상속세(주 상속세 등)도 그 나라 법령에 따른 상속세면 들 수 있음 [확인 필요 — 권장: 주 법령도 외국 법령 — 포함 권장]'); 잠정 = true; }
      else { 인정 = false; 비고.push(종류 + '는 상속세가 아니어서 이 공제에 넣지 않음(§29 「상속세」) — 증여세면 생전 증여의 §59 증여세 외국납부공제로, 소득세는 상속세 공제 대상 아님'); }
    } else if (!종류 || /모름/.test(종류)) { 잠정 = true; 비고.push('외국 세금이 상속세(유산세 포함)인지 확인'); }
    if (/예/.test(String(c.가산세포함 || ''))) { 잠정 = true; 비고.push('넣은 납부액에 가산세·이자가 섞임 — 본세만 넣을 것 (원문 확인 2026-11-04: 상증법 §29·상증령 §21① 단서)'); }
    if (jmYn_(c.국내재산포함) === true && !분자) { 잠정 = true; 비고.push('외국 과세표준에 국내 재산도 들어갔는데 국외 재산 몫을 나누지 않음 — §29는 「외국에 있는 상속재산」에 대한 상속세만 공제'); }
    if (!분자) 분자 = 외과;
    if (/불복|신고만|모름/.test(String(c.결정상태 || ''))) { 잠정 = true; 비고.push('외국 세액이 아직 확정 전(' + c.결정상태 + ') — 바뀌면 경정청구·수정신고로 맞춤 [실사건 때 확인]'); }
    let 한도식 = null;
    if (산출 && 과표 && 분자) 한도식 = Math.round(산출 * Math.min(1, 분자 / 과표));
    else if (인정) { 잠정 = true; }
    const 공제 = !인정 ? 0 : (한도식 === null ? 납 : Math.min(납, 한도식));
    if (인정) { 합공제 += 공제; 합납부 += 납; 합과표 += 분자; }
    단순합 += 납;
    표.push({ 나라: 이름, 재산: c.재산 || '', 세종류: 종류 || '모름', 외국납부세액: 납, 분자과세표준: 분자, 비율한도: 한도식, 공제: 공제, 비고: 비고.join(' / ') });
  });
  // 나라를 합쳐 한 번에 넣으면 한 나라의 남는 한도가 다른 나라 초과 납부를 덮음 — 나라마다 따로 셈 [확인 필요 — 권장: 「외국의 법령」 단수 — 법령(나라)별로 셈하는 쪽 권장]
  let 합산식 = null;
  if (산출 && 과표 && 합과표) 합산식 = Math.min(합납부, Math.round(산출 * Math.min(1, 합과표 / 과표)));
  if (표.length > 1 && 합산식 !== null && 합산식 !== 합공제) 알림.push('나라를 합쳐 한 번에 셈하면 ' + won(합산식) + '원, 나라마다 따로 셈하면 ' + won(합공제) + '원 — 시행령 §21①은 「외국」을 하나로 적어 나라별 한도인지 원문에 없음 [확인 필요 — 권장: 같음]. 엔진칸은 나라별 합계를 넘김');
  const 남은세 = Math.max(0, 산출 - 앞공제);
  let 결과공제 = 거주 === false ? 0 : 합공제;
  if (산출 && 결과공제 > 남은세) { 알림.push('공제가 산출세액 − 앞 공제(증여세액공제 등) ' + won(남은세) + '원을 넘어 거기까지만(엔진과 같음)'); 결과공제 = 남은세; }
  if (거주 === null) 잠정 = true;
  if (!과표 || !산출) 알림.push('우리 과세표준·산출세액을 넣지 않아 비율 한도를 못 셈 — 상속세 엔진을 먼저 돌려 넣거나, 엔진칸(외국 과세표준·납부액)을 그대로 넘기면 엔진이 셈');
  const 엔진칸 = 거주 === false ? { foreignTaxPaidAmount: 0 } : { foreignTaxPaidAmount: 결과공제 || 합납부, foreignEstateTaxBase: 합과표 || undefined };
  if (거주 === false && 단순합 > 0) 알림.push('비거주자 피상속인은 국내 재산만 과세되고 외국 상속세는 공제하지 않습니다(§29 「거주자의 사망」) — 엔진도 0으로 봄');
  // 신고기한 — 외국 주소면 9개월(§67④)
  const 개시 = jmYmd_(p.상속개시일);
  const 외주소 = jmYn_(p.피상속인외국주소) === true || jmYn_(p.상속인외국주소) === true;
  let 신고기한 = '';
  if (개시) {
    const d = new Date(개시 + 'T00:00:00Z');
    const 말 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (외주소 ? 9 : 6) + 1, 0));
    신고기한 = apShift_(말.toISOString().slice(0, 10), p.공휴일 || [], null);
    알림.push('상속세 신고기한 ' + 신고기한 + '(상속개시일이 속하는 달 말일부터 ' + (외주소 ? '9개월 — 피상속인이나 상속인이 외국에 주소, §67④' : '6개월, §67①') + ', 토·일·공휴일이면 다음 날 — 국세기본법 §5①)');
  }
  알림.push('외국 과세표준·납부액의 원화 환산 기준일(상속개시일·납부일) [확인 필요 — 권장: 원문 없음 — 상속개시일(평가기준일) 환율 권장, 납부액은 납부일 환율 해석도] — 엔진에는 원화로 넣음');
  할일.push({ 무엇: '외국납부세액공제신청서를 상속세 과세표준신고서와 함께 제출', 때: 신고기한 ? 신고기한 + '까지' : '상속세 신고 때', 근거: '상증법 시행령 §21②' });
  할일.push({ 무엇: '나라별 외국 상속세 결정서·납부 영수증·외국 과세표준 명세(국외 재산 몫이 보이게) 받기', 때: '신고 전', 근거: '상증법 §29' });
  if (표.some(function (r) { return /확정 전/.test(r.비고); })) 할일.push({ 무엇: '외국 세액이 확정·변경되면 공제액을 다시 셈해 경정청구 또는 수정신고', 때: '외국 결정 뒤', 근거: '[확인 필요 — 권장: 후발적 사유(4호 유사)로 볼 여지 — 권장 ②5호·시행령 4호]' });
  const 경우 = [
    { 이름: '① 법대로(나라별 비율 한도·국외 재산 몫·상속세만)', 공제: 결과공제, 설명: '산출세액 × 국외 재산 과세표준 ÷ 우리 과세표준, 실제 낸 상속세 한도' },
    { 이름: '② [견주기] 낸 외국 세금을 그대로 공제', 공제: 거주 === false ? 0 : Math.min(단순합, 남은세 || 단순합), 설명: '비율 한도·세금 종류·국외 재산 몫을 보지 않음' }
  ];
  const r = jmWrap_('상속외국납부', reqs, { 표: 표, 공제액: 결과공제, 합산식: 합산식, 남은산출세액: 남은세, 신고기한: 신고기한, 엔진칸: 엔진칸, 경우: 경우, 알림: 알림, 할일: 할일 });
  if (잠정 && r.결론 === '충족') r.잠정 = true;
  return r;
}

// [2026.11.04 복잡사건 139] 여러 번 나눠 산 같은 주식을 일부 판 경우 — 판 주식의 취득시기·취득가액 고르기
//  소득세법 시행령 §162⑤(2026-10-01 시행판): 법 §98·이 조 ①을 적용할 때 양도한 자산의 취득시기가 분명하지 아니하면 먼저 취득한 자산을 먼저 양도한 것으로 본다.
//  §162①5호: 상속·증여로 취득한 자산은 상속개시일·증여받은 날. §163⑨: 상속·증여받은 자산의 취득가액은 상증법에 따라 평가한 가액.
//  §163①4호·5호: 합병·분할로 받은 주식 1주당 취득원가 = 옛 주식 취득에 든 총금액(법인세법 §16①5호·6호 의제배당 더하고 금전 등 교부금 뺌) ÷ 받은 주식 수.
//  §163⑬: 주식매수선택권 행사로 취득한 주식은 행사 당시 시가. 세율은 소득세법 §104①11호(대주주·중소기업 외 법인·1년 미만 30%) — 엔진이 셈.
//  p: { 종목, 대주주(예|아니오), 중소기업(예|아니오), 상장장내소액(예|아니오), 취득구분분명(예|아니오 — 판 주식이 어느 회차인지 증빙으로 가려지나),
//       매수:[{ 회차, 취득일, 주수, 취득가액(총, 원), 방법(매수|상속|증여|무상주|합병|분할|주식매수선택권), 평가액(상속·증여 총), 행사시가(1주),
//               옛주식취득총액, 의제배당, 교부금, 증여자관계 }],
//       양도:[{ 양도일, 주수, 양도가액(총), 양도비용, 지정회차:[회차…] }] }
function judgeStockLotMatching_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], 알림 = [], 할일 = [];
  let 잠정 = false;
  const 대주주 = jmYn_(p.대주주), 중소 = jmYn_(p.중소기업), 분명 = jmYn_(p.취득구분분명);
  if (jmYn_(p.상장장내소액) === true) 알림.push('상장주식을 대주주 아닌 사람이 증권시장에서 팔면 양도소득세 과세 대상이 아님(소득세법 §94①3호가목) — 아래 계산은 과세되는 경우만 뜻 있음');
  if (대주주 === null) { 잠정 = true; 알림.push('대주주인지 모름 — 「대주주」 판정을 먼저 돌릴 것(세율·1년 미만 30%가 갈림)'); }
  if (중소 === null) { 잠정 = true; 알림.push('중소기업 주식인지 모름 — 세율이 갈림'); }
  // 회차 정리: 1주당 취득가액·취득일
  const 회차 = (p.매수 || []).map(function (b, i) {
    const 주수 = n(b.주수), 방법 = String(b.방법 || '매수').trim(), 비고 = [];
    let 단가 = 주수 ? n(b.취득가액) / 주수 : 0, 근거 = '시행령 §163①1호(실지 취득가액)';
    if (/상속|증여/.test(방법)) {
      if (n(b.평가액)) { 단가 = n(b.평가액) / 주수; 근거 = '시행령 §163⑨(상증법 평가액) · 취득일 §162①5호'; }
      else { 잠정 = true; 비고.push('상속·증여 평가액이 없어 넣은 취득가액을 씀 — 상증법 평가액(신고·결정가액)을 넣을 것'); }
      if (/증여/.test(방법)) 비고.push('증여받은 주식 — 배우자·직계존비속에게 받아 1년 안 양도면 「주식 이월과세」 도구로 따로 셈(소득세법 §97의2①, 2025-01-01 이후 증여받은 주식부터 — 부칙 법률 제20615호 §8 원문 확인 2026-11-04' + (b.취득일 && jmYmd_(b.취득일) < '2025-01-01' ? '; 이 증여는 그 전이라 주식 이월과세 대상 아님' : '') + ')');
    } else if (/선택권/.test(방법)) {
      if (n(b.행사시가)) { 단가 = n(b.행사시가); 근거 = '시행령 §163⑬(행사 당시 시가)'; }
      else { 잠정 = true; 비고.push('주식매수선택권 행사 당시 시가가 없음 — 낸 행사가격이 아니라 그 시가가 취득가액(§163⑬)'); }
    } else if (/합병|분할/.test(방법)) {
      if (n(b.옛주식취득총액)) { 단가 = Math.max(0, n(b.옛주식취득총액) + n(b.의제배당) - n(b.교부금)) / 주수; 근거 = '시행령 §163①' + (/합병/.test(방법) ? '4호' : '5호') + '(옛 주식 취득 총금액 + 의제배당 − 교부금) ÷ 받은 주식 수'; }
      else { 잠정 = true; 비고.push(방법 + '으로 받은 주식 — 옛 주식 취득 총금액·의제배당·교부금으로 1주당 취득원가를 셈(§163①4·5호)'); }
      잠정 = true; 비고.push(방법 + '으로 받은 주식의 취득시기를 옛 주식 취득일로 볼지 ' + 방법 + '등기일로 볼지 [확인 필요 — 권장: 원문 없음 — 합병등기일 취득으로 보되 보유기간 통산은 예규 확인] — 넣은 취득일을 씀');
    } else if (/무상/.test(방법)) {
      잠정 = true; 비고.push('무상주 — 취득가액·취득시기를 어떻게 볼지 [확인 필요 — 권장: 의제배당 과세된 무상주는 액면, 자본잉여금 전입 무상주는 0원·옛 주식 취득일 — 예규 확인]. 넣은 값(없으면 0원)을 씀');
    }
    const 일 = jmYmd_(b.취득일);
    if (!일) { 잠정 = true; 비고.push('취득일이 없음'); }
    return { 회차: b.회차 || String(i + 1), 취득일: 일 || '', 주수: 주수, 남음: 주수, 단가: 단가, 방법: 방법, 근거: 근거, 비고: 비고 };
  }).filter(function (x) { return x.주수 > 0; });
  const 보유주 = 회차.reduce(function (a, x) { return a + x.주수; }, 0);
  const 양도 = (p.양도 || []).map(function (s) { return { 양도일: jmYmd_(s.양도일) || '', 주수: n(s.주수), 가액: n(s.양도가액), 비용: n(s.양도비용), 지정: (s.지정회차 || []).map(String) }; })
    .filter(function (s) { return s.주수 > 0; }).sort(function (a, b) { return a.양도일 < b.양도일 ? -1 : 1; });
  const 판주 = 양도.reduce(function (a, s) { return a + s.주수; }, 0);
  reqs.push(jmReq_('여러 번 취득한 같은 종목을 일부 양도', 회차.length > 1 && 양도.length ? true : (회차.length && 양도.length ? true : null), 회차.length && 양도.length ? '' : '회차별 취득 내역(취득일·주수·가액)과 양도 내역', '시행령 §162⑤'));
  reqs.push(jmReq_('판 주식 수가 가진 주식 수 이내', 판주 && 보유주 ? 판주 <= 보유주 : null, 판주 > 보유주 ? '판 ' + won(판주) + '주가 넣은 취득 ' + won(보유주) + '주보다 많음 — 빠진 취득 회차가 있음' : '', '—'));
  reqs.push(jmReq_('판 주식의 취득시기를 가르는 법', 분명 === null ? null : true, 분명 === true ? '증빙으로 어느 회차인지 분명 — 그 회차대로' : 분명 === false ? '분명하지 않음 — 먼저 산 것을 먼저 판 것으로 봄' : '판 주식이 어느 회차인지 증빙(실물 증권 번호·따로 된 계좌 등)으로 가려지는지', '시행령 §162⑤'));
  if (분명 === null) 잠정 = true;
  const 달수 = function (a, b) { if (!a || !b) return null; const x = a.split('-').map(Number), y = b.split('-').map(Number); return (y[0] - x[0]) * 12 + (y[1] - x[1]) - (y[2] < x[2] ? 1 : 0); };
  // 맞추기: 방식 = 'fifo' | 'lifo' | 'avg'
  const 맞추기 = function (방식) {
    const lots = 회차.map(function (x) { return Object.assign({}, x, { 남음: x.주수 }); }).sort(function (a, b) { return a.취득일 < b.취득일 ? -1 : a.취득일 > b.취득일 ? 1 : 0; });
    return 양도.map(function (s) {
      let 남 = s.주수; const 조각 = [];
      let 차례 = 방식 === 'lifo' ? lots.slice().reverse() : lots.slice();
      if (방식 === 'fifo' && 분명 === true && s.지정.length) 차례 = lots.filter(function (x) { return s.지정.indexOf(x.회차) >= 0; }).concat(lots.filter(function (x) { return s.지정.indexOf(x.회차) < 0; }));
      const 그때 = lots.filter(function (x) { return x.남음 > 0 && (!x.취득일 || !s.양도일 || x.취득일 <= s.양도일); });
      const 평균 = 방식 === 'avg' ? (function () { const q = 그때.reduce(function (a, x) { return a + x.남음; }, 0); return q ? 그때.reduce(function (a, x) { return a + x.남음 * x.단가; }, 0) / q : 0; })() : 0;
      차례.forEach(function (x) {
        if (남 <= 0 || x.남음 <= 0 || (x.취득일 && s.양도일 && x.취득일 > s.양도일)) return;
        const q = Math.min(남, x.남음); x.남음 -= q; 남 -= q;
        조각.push({ 회차: x.회차, 취득일: x.취득일, 주수: q, 단가: 방식 === 'avg' ? 평균 : x.단가, 달: 달수(x.취득일, s.양도일) });
      });
      return { 양도: s, 조각: 조각, 모자람: 남 };
    });
  };
  const 단기 = function (달) { return 대주주 === true && 중소 === false && 달 !== null && 달 < 12; };
  const 묶기 = function (결과) {
    const 칸 = [];
    결과.forEach(function (r) {
      const s = r.양도, 판 = r.조각.reduce(function (a, c) { return a + c.주수; }, 0) || 1;
      [true, false].forEach(function (짧) {
        const cs = r.조각.filter(function (c) { return 단기(c.달) === 짧; });
        if (!cs.length) return;
        const q = cs.reduce(function (a, c) { return a + c.주수; }, 0);
        const 달들 = cs.map(function (c) { return c.달; }).filter(function (d) { return d !== null; });
        칸.push({ 양도일: s.양도일, 주수: q, 짧음: 짧, 조각: cs.map(function (c) { return c.회차 + '회차 ' + won(c.주수) + '주(' + (c.취득일 || '취득일?') + ', 1주 ' + won(Math.round(c.단가)) + '원)'; }).join(' · '),
          엔진칸: { assetCategory: 'domestic_stock', transferDate: s.양도일 || undefined, transferPrice: Math.round(s.가액 * q / 판), transferExpenses: Math.round(s.비용 * q / 판),
            acquisitionPrice: Math.round(cs.reduce(function (a, c) { return a + c.주수 * c.단가; }, 0)), holdingMonths: 달들.length ? (짧 ? Math.max.apply(null, 달들) : Math.min.apply(null, 달들)) : undefined,
            isDaejuju: 대주주 === true, isSmallMediumCompany: 중소 === true } });
      });
    });
    return 칸;
  };
  let eng = null;
  try { eng = typeof getUiCalcEngine_ === 'function' ? getUiCalcEngine_() : null; } catch (e) { eng = null; }
  const 세액 = function (칸) {
    if (!eng || typeof eng.calculateStockTransferTaxJS !== 'function') return null;
    let 합 = 0; const 해 = {};
    칸.forEach(function (c) { (해[(c.양도일 || '').slice(0, 4)] = 해[(c.양도일 || '').slice(0, 4)] || []).push(c); });
    Object.keys(해).forEach(function (y) {
      let 쓴공제 = 0, 손실 = 0;
      해[y].sort(function (a, b) { const k = function (c) { return c.엔진칸.transferPrice - c.엔진칸.acquisitionPrice < 0 ? 0 : (c.짧음 ? 1 : 2); }; return k(a) - k(b); }).forEach(function (c) {
        const out = eng.calculateStockTransferTaxJS(Object.assign({}, c.엔진칸, { basicDeductionAlreadyUsed: 쓴공제, priorNetGainOrLoss: 손실 }));
        c.결과 = out && !out.error ? { 과세표준: out.과세표준, 산출세액: out.산출세액, 세율: out.적용세율_설명 } : { 오류: out && out.error };
        if (out && !out.error) { 쓴공제 += out.기본공제 || 0; 손실 = Math.min(0, 손실 + (c.엔진칸.transferPrice - c.엔진칸.acquisitionPrice - (c.엔진칸.transferExpenses || 0))); 합 += out.산출세액 || 0; }
      });
    });
    return 합;
  };
  const 법 = 맞추기('fifo'), 법칸 = 묶기(법), 법세 = 세액(법칸);
  법.forEach(function (r) { if (r.모자람 > 0) 알림.push(r.양도.양도일 + ' 양도 ' + won(r.양도.주수) + '주 중 ' + won(r.모자람) + '주는 그 전에 취득한 회차가 없음 — 빠진 취득 내역을 받을 것'); });
  const 평균칸 = 묶기(맞추기('avg')), 평균세 = 세액(평균칸);
  const 뒤칸 = 묶기(맞추기('lifo')), 뒤세 = 세액(뒤칸);
  if (법칸.some(function (c) { return c.짧음; }) && 법칸.some(function (c) { return !c.짧음; })) 알림.push('한 번 판 것 안에 1년 미만 회차와 1년 넘은 회차가 섞임 — 대주주·중소기업 외 법인은 1년 미만 몫만 30%(소득세법 §104①11호가목1)), 엔진칸을 둘로 나눠 넘김(양도가액·비용은 주수 비율)');
  if (법칸.some(function (c) { return c.짧음; })) 알림.push('기본공제 250만원을 1년 미만(30%) 몫에 먼저 뺐음 — 같은 날 한 번 판 것 안에서 어느 몫에 먼저 빼는지 [확인 필요 — 권장: 같은 날 안 순서 규정 없음 — 납세자 유리(세율 높은 1년 미만 몫 먼저) 권장]');
  if (eng && 법세 !== null && 평균세 !== null && 법세 !== 평균세) 알림.push('증권사 잔고의 평균단가로 신고하면 산출세액 ' + won(평균세) + '원, 법대로(시행령 §162⑤ 먼저 산 것 먼저) ' + won(법세) + '원 — 평균단가는 이 조문에 없는 방식 [확인 필요 — 권장: 평균법은 조문에 없음 — 예규 확인]');
  회차.forEach(function (x) { x.비고.forEach(function (b) { if (알림.indexOf(x.회차 + '회차: ' + b) < 0) 알림.push(x.회차 + '회차: ' + b); }); });
  할일.push({ 무엇: '회차별 매매·입고 내역(증권사 거래내역서·잔고 증명, 비상장은 매매계약서·주주명부·증권거래세 신고서) 받기', 때: '신고 전', 근거: '시행령 §162⑤·§163①' });
  if (분명 === true) 할일.push({ 무엇: '판 주식이 그 회차임을 보이는 증빙(실물 증권 번호·따로 된 계좌 기록)을 신고 서류에 붙임', 때: '신고 때', 근거: '시행령 §162⑤ 반대 해석 — 분명하면 그대로' });
  양도.forEach(function (s) {
    if (!s.양도일) return;
    const d = new Date(s.양도일 + 'T00:00:00Z');
    const 반 = d.getUTCMonth() < 6 ? new Date(Date.UTC(d.getUTCFullYear(), 8, 0)) : new Date(Date.UTC(d.getUTCFullYear() + 1, 2, 0));
    할일.push({ 무엇: s.양도일 + ' 양도분 예정신고', 때: apShift_(반.toISOString().slice(0, 10), p.공휴일 || [], null) + '까지(양도일이 속하는 반기 말일부터 2개월, 쉬는 날이면 다음 날 — 국세기본법 §5①)', 근거: '소득세법 §105①2호' });
  });
  const 경우 = [
    { 이름: '① 법대로 — ' + (분명 === true ? '증빙대로(지정 회차), 나머지는 먼저 산 것부터' : '먼저 산 것을 먼저 판 것으로(시행령 §162⑤)'), 엔진: 'calculate_stock_transfer_tax', 엔진칸들: 법칸.map(function (c) { return c.엔진칸; }), 산출세액: 법세, 칸: 법칸 },
    { 이름: '② [견주기] 증권사 평균단가로 신고', 산출세액: 평균세, 칸: 평균칸, 설명: '모든 회차를 평균 낸 1주 가액 — 법 조문에 없는 방식' },
    { 이름: '③ [견주기] 나중 산 것을 먼저 판 것으로', 산출세액: 뒤세, 칸: 뒤칸, 설명: '취득시기가 분명하지 않은데 고르면 안 됨' }
  ];
  const r = jmWrap_('주식취득분', reqs, { 종목: p.종목 || '', 회차: 회차.map(function (x) { return { 회차: x.회차, 취득일: x.취득일, 주수: x.주수, 방법: x.방법, '1주 취득가액': Math.round(x.단가), 근거: x.근거 }; }),
    엔진칸: 법칸.length === 1 ? 법칸[0].엔진칸 : { 여러건: 법칸.map(function (c) { return c.엔진칸; }) }, 산출세액: 법세, 경우: 경우, 알림: 알림, 할일: 할일 });
  if (잠정 && r.결론 === '충족' && !r.잠정) { r.잠정 = true; r.표시 = r.표시.replace('— 충족', '— 충족(잠정)'); }
  return r;
}

// [2026.11.04 복잡사건 140] 증여일(증여재산의 취득시기) 가르기 — 상증법 §32·§68①·§47②·§60①(2026-01-02 시행판), 시행령 §24(2026-10-01 시행판)
//  §32: 증여재산의 취득시기는 §33~§39·§39의2·§39의3·§40·§41의2~§41의5·§42·§42의2·§44·§45·§45의2~§45의5가 적용되면 그 규정에 따로 정한 날, 그 밖에는 시행령이 정하는 날.
//  시행령 §24①: 1호 등기·등록이 필요한 재산 = 등기·등록접수일(민법 §187 등기를 요하지 않는 취득은 실제 취득일)
//               2호 수증자 명의로 지은 건물(가)·수증자 명의로 산 분양권 건물(나) = 사용승인서 교부일(사용승인 전 사실상 사용·임시사용승인은 그 날, 무허가는 사실상 사용일)
//               3호 타인의 기여로 가치가 늘어난 재산 = 가 개발구역 고시일 · 나 형질변경허가일 · 다 공유물 분할등기일 · 라 인가·허가일 · 마 상장일·등록일·합병등기일 · 바 보험사고 발생일 · 사 가치 증가 사유 발생일
//               4호 그 밖 = 인도한 날 또는 사실상 사용한 날
//  시행령 §24②: 주식 = 수증자가 받은 사실이 배당금 지급·주주권 행사 등으로 객관적으로 확인되는 날(분명하지 않거나 받기 전에 명의개서·기재했으면 명의개서일·기재일)
//  시행령 §24③: 무기명채권 = 이자 지급 사실 등으로 취득 사실이 객관적으로 확인되는 날(분명하지 않으면 이자 지급·상환을 청구한 날)
//  §68①: 신고기한 = 증여받은 날이 속하는 달 말일부터 3개월 / §60①: 평가 기준일 = 증여일 / §47②: 증여일 전 10년 안 같은 사람 증여 합산
//  p: { 증여자관계, 수증자생년월일, 세대생략(예), 실제신고일, 다른직계존속공제씀,
//       앞선증여들:[{ 증여일, 금액, 과세표준, 낸세액 }],
//       재산들:[{ 이름, 종류(부동산|차량·선박|신축건물|분양권|주식|무기명채권|금전|동산|가치증가|기타), 가액, 계약일, 등기접수일, 등기불요(예 — 민법 §187), 등기불요사유, 실제취득일,
//                 사용승인일, 임시사용승인일, 사실상사용일, 무허가(예), 인도일, 이체일, 주주권행사일(배당 수령·주총 의결권 등 첫 날), 명의개서일,
//                 이자지급일, 이자청구일, 가치증가사유(개발구역|형질변경|공유물분할|인가허가|상장|합병|보험사고|기타), 가치증가사유일, 특례조문(예 §35·§41의3) }] }
function judgeGiftAcquisitionDate_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  let 잠정 = false;
  const 말일3 = function (d) { const t = new Date(d + 'T00:00:00Z'); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 4, 0)).toISOString().slice(0, 10); };
  const 달빼기 = function (d, k) { let y = +d.slice(0, 4), m = +d.slice(5, 7) - k; while (m < 1) { m += 12; y -= 1; } const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(+d.slice(8, 10), last)).padStart(2, '0'); };
  const 이른 = function (a) { return a.filter(Boolean).sort()[0] || ''; };
  const 관계 = String(p.증여자관계 || '직계존속');
  const rel = /배우자|처|남편|아내/.test(관계) ? '배우자' : /부모|아버지|어머니|조부|할아버지|할머니|직계존속/.test(관계) ? '직계존속' : /자녀|아들|딸|손자|손녀|직계비속/.test(관계) ? '직계비속' : /친족|형제|자매|사촌|삼촌|조카|며느리|사위/.test(관계) ? '기타친족' : '기타';
  const 생일 = jmYmd_(p.수증자생년월일), 성년일 = 생일 ? famAddY_(생일, 19) : '';
  const 특례목록 = /§\s*(3[3-9]|39의[23]|40|41의[2-5]|42|42의2|44|45|45의[2-5])\b/;
  const 재산 = (p.재산들 || []).filter(function (a) { return a && (a.이름 || n(a.가액)); });
  if (!재산.length) return jmWrap_('증여일', [jmReq_('증여재산', null, '증여재산(종류·날짜들)을 모름', '상증법 §32·시행령 §24')], { 알림: ['증여한 재산마다 종류와 계약일·등기접수일·인도일 같은 날짜를 넣어 주세요'], 할일: [] });
  재산.forEach(function (a, i) {
    const 이름 = a.이름 || ('재산 ' + (i + 1));
    const 종류 = String(a.종류 || '기타');
    const 계약 = jmYmd_(a.계약일);
    let 날 = '', 근거 = '', 왜 = '', 잠 = false;
    const 특 = String(a.특례조문 || '');
    if (특 && 특례목록.test(특)) {
      날 = ''; 잠 = true; 근거 = '상증법 §32 · ' + 특;
      왜 = 특 + '가 적용되는 이익은 그 조문이 정한 날이 증여일(§32) — 이 도구가 아니라 그 조문 계산기의 증여일을 쓸 것';
    } else if (/신축|분양권/.test(종류)) {
      const 승인 = jmYmd_(a.사용승인일), 임시 = jmYmd_(a.임시사용승인일), 사용 = jmYmd_(a.사실상사용일);
      if (jmYn_(a.무허가) === true) { 날 = 사용; 근거 = '시행령 §24①2호 단서(무허가)'; 왜 = '허가 없이 지은 건물은 사실상 사용일'; }
      else {
        const 앞 = 이른([임시, 사용]);
        if (앞 && (!승인 || 앞 < 승인)) { 날 = 앞; 근거 = '시행령 §24①2호 단서'; 왜 = '사용승인 전에 ' + (앞 === 임시 ? '임시사용승인' : '사실상 사용') + ' — 그 날'; }
        else { 날 = 승인; 근거 = '시행령 §24①2호 ' + (/분양권/.test(종류) ? '나목' : '가목'); 왜 = (/분양권/.test(종류) ? '수증자 명의로 산 분양권의 건물' : '수증자 명의로 지은 건물') + ' — 사용승인서 교부일'; }
      }
      if (!날) { 잠 = true; 왜 = '사용승인일·임시사용승인일·사실상 사용일을 모름'; }
      if (계약 && 날 && 계약 < 날) 알림.push(이름 + ': 공사·분양 계약일(' + 계약 + ')이 아니라 ' + 날 + '이 증여일 — 그 사이 자금을 대준 것은 건물 증여로 보고 따로 현금 증여로 셈하지 않도록 (원문 확인 2026-11-04: 상증령 §24①2호 가·나목)');
    } else if (/주식|출자|지분/.test(종류)) {
      const 받 = 이른([jmYmd_(a.인도일), jmYmd_(a.주주권행사일)]), 개서 = jmYmd_(a.명의개서일);
      if (개서 && (!받 || 개서 < 받)) { 날 = 개서; 근거 = '시행령 §24② 단서'; 왜 = 받 ? '받기(' + 받 + ') 전에 명의개서 — 명의개서일' : '받은 날이 분명하지 않아 명의개서일·명부 기재일'; if (!받) 잠 = false; }
      else if (받) { 날 = 받; 근거 = '시행령 §24② 본문'; 왜 = '배당 수령·주주권 행사 등으로 받은 사실이 객관적으로 확인되는 날'; if (!jmYmd_(a.주주권행사일) && !jmYmd_(a.인도일)) 잠 = true; }
      else { 잠 = true; 왜 = '인도일·주주권 행사일·명의개서일을 모름'; }
      if (계약 && 날 && 계약 !== 날) 알림.push(이름 + ': 주식 증여계약일(' + 계약 + ')이 아니라 ' + 날 + '이 증여일 — 상장주식이면 평가(전후 2개월 평균, §63①1호가목)도 이 날 기준');
    } else if (/무기명|채권/.test(종류)) {
      const 지급 = jmYmd_(a.이자지급일), 청구 = jmYmd_(a.이자청구일);
      if (지급) { 날 = 지급; 근거 = '시행령 §24③ 본문'; 왜 = '이자 지급 사실 등으로 취득이 객관적으로 확인되는 날'; }
      else if (청구) { 날 = 청구; 근거 = '시행령 §24③ 단서'; 왜 = '취득일이 분명하지 않아 이자 지급·채권 상환을 청구한 날'; }
      else { 잠 = true; 왜 = '이자 지급일·청구일을 모름'; }
    } else if (/가치증가|가치 증가/.test(종류)) {
      const 사유 = String(a.가치증가사유 || '기타'), 일 = jmYmd_(a.가치증가사유일);
      const 목 = /개발/.test(사유) ? '가목(개발구역 고시일)' : /형질/.test(사유) ? '나목(형질변경허가일)' : /공유물|분할/.test(사유) ? '다목(공유물 분할등기일)' : /인가|허가/.test(사유) ? '라목(인가·허가일)' : /상장|합병|등록/.test(사유) ? '마목(상장일·등록일·합병등기일)' : /보험/.test(사유) ? '바목(보험사고 발생일)' : '사목(가치 증가 사유 발생일)';
      날 = 일; 근거 = '시행령 §24①3호 ' + 목; 왜 = '타인의 기여로 가치가 늘어난 재산 — ' + 목;
      if (!일) { 잠 = true; 왜 += ' — 그 날을 모름'; }
      알림.push(이름 + ': 가치 증가 이익(§42의3 재산 취득 후 재산가치 증가)은 §32가 적어 둔 특례 조문이라 그 계산기(재산가치증가)의 증여일도 함께 볼 것 (원문 확인 2026-11-04: 상증령 §24①3호·상증법 §42의3②)');
    } else if (/부동산|토지|건물|아파트|주택|상가|차량|선박|항공기|건설기계|회원권|광업권|어업권/.test(종류)) {
      const 접수 = jmYmd_(a.등기접수일);
      if (jmYn_(a.등기불요) === true) { 날 = jmYmd_(a.실제취득일); 근거 = '시행령 §24①1호 괄호(민법 §187)'; 왜 = '등기를 요하지 않는 취득(' + (a.등기불요사유 || '판결·경매·공용징수 등') + ') — 실제 취득일'; if (!날) { 잠 = true; 왜 += ' — 그 날을 모름'; } }
      else if (접수) { 날 = 접수; 근거 = '시행령 §24①1호'; 왜 = '등기·등록이 필요한 재산 — 등기·등록접수일(계약일·잔금일 아님)'; }
      else { 잠 = true; 날 = ''; 왜 = '아직 등기·등록 접수 전 — 접수하는 날이 증여일, 그 전엔 증여가 끝나지 않음'; }
    } else {
      const 인도 = jmYmd_(a.인도일) || (/금전|현금|예금/.test(종류) ? jmYmd_(a.이체일) : ''), 사용 = jmYmd_(a.사실상사용일);
      날 = 이른([인도, 사용]); 근거 = '시행령 §24①4호'; 왜 = /금전|현금|예금/.test(종류) ? '돈을 넘긴 날(이체·인도일)' : '인도한 날 또는 사실상 사용한 날';
      if (!날) { 잠 = true; 왜 += ' — 그 날을 모름'; }
    }
    if (잠) 잠정 = true;
    const 가액 = n(a.가액);
    const 줄 = { 이름: 이름, 종류: 종류, 가액: 가액, 계약일: 계약 || '', 증여일: 날, 근거: 근거, 왜: 왜, 잠정: 잠 };
    if (날) {
      줄.신고기한 = 말일3(날);
      줄.평가기간 = 달빼기(날, 6) + ' ~ ' + apAddM_(날, 3);
      줄.합산시작 = famAddY_(날, -10);
      if (성년일) 줄.미성년 = 날 < 성년일;
      if (계약 && 계약 !== 날) {
        줄.계약일로보면 = { 신고기한: 말일3(계약), 평가기간: 달빼기(계약, 6) + ' ~ ' + apAddM_(계약, 3), 미성년: 성년일 ? 계약 < 성년일 : undefined };
      }
    }
    표.push(줄);
  });
  // 날짜순으로 엔진칸 — 같은 증여자의 앞선 증여(이 목록 안 앞 재산 포함)를 10년 합산(§47②)
  const 앞선 = (p.앞선증여들 || []).map(function (g) { return { 날: jmYmd_(g.증여일), 금액: n(g.금액), 과세표준: n(g.과세표준), 낸세액: n(g.낸세액) }; }).filter(function (g) { return g.날 && g.금액; });
  const 엔진칸들 = function (기준) {
    const 줄들 = 표.map(function (r) { return { r: r, d: 기준 === '계약' ? (r.계약일 || r.증여일) : r.증여일 }; }).filter(function (x) { return x.d && x.r.가액; });
    const 날별 = {};
    줄들.forEach(function (x) { (날별[x.d] = 날별[x.d] || []).push(x.r); });
    const 날들 = Object.keys(날별).sort();
    const 지난 = 앞선.slice();
    return 날들.map(function (d) {
      const 합 = 날별[d].reduce(function (s, r) { return s + r.가액; }, 0);
      const 열 = famAddY_(d, -10);
      const 합산 = 지난.filter(function (g) { return g.날 >= 열 && g.날 < d; });
      const 합산액 = 합산.reduce(function (s, g) { return s + g.금액; }, 0);
      const e = { giftAmount: 합, relation: rel, giftDate: d, isDoneeResident: true };
      if (성년일 && d < 성년일) e.isMinor = true;
      if (jmYn_(p.세대생략) === true) e.isGenerationSkip = true;
      if (rel === '직계존속' && n(p.다른직계존속공제씀)) e.priorRelationDeductionUsedOther = n(p.다른직계존속공제씀);
      if (합산액 >= 10000000) {
        e.priorGiftAmount = 합산액;
        const t = 합산.reduce(function (s, g) { return s + g.낸세액; }, 0), b = 합산.reduce(function (s, g) { return s + g.과세표준; }, 0);
        if (t) e.priorPaidTax = t; if (b) e.priorGiftTaxableBase = b;
      }
      let k = null;
      if (eng && typeof eng.calculateGiftTaxJS === 'function') { try { k = eng.calculateGiftTaxJS(e); } catch (er) { k = null; } }
      지난.push({ 날: d, 금액: 합, 과세표준: k ? Number(k.과세표준 || 0) : 0, 낸세액: k ? Math.max(0, Number(k.산출세액_할증후 || k.산출세액 || 0) - Number(e.priorPaidTax || 0)) : 0, 이번: true });
      return { 증여일: d, 재산: 날별[d].map(function (r) { return r.이름; }), 납부세액: k ? Number(k.납부세액 || 0) : undefined, 합산: 합산액 >= 10000000 ? 합산액 : 0, 합산에서빠진: 앞선.filter(function (g) { return g.날 < 열; }).map(function (g) { return g.날; }), 엔진칸: e };
    });
  };
  let eng = null;
  try { eng = typeof getUiCalcEngine_ === 'function' ? getUiCalcEngine_() : null; } catch (er) { eng = null; }
  const 법대로 = 엔진칸들('법'), 계약대로 = 엔진칸들('계약');
  const 합계 = function (xs) { return xs.every(function (x) { return x.납부세액 !== undefined; }) ? xs.reduce(function (t, x) { return t + x.납부세액; }, 0) : undefined; };
  if (법대로.some(function (x) { return x.합산 && 지난이번(x); })) 알림.push('같은 증여자에게서 이 목록 안 앞 재산도 받아 날짜순으로 10년 합산했음(§47②) — 앞 재산의 과세표준·그때 낼 세액(산출세액 − 그때 공제받은 기납부세액)을 다음 증여의 기납부세액 공제(§58)로 넘김' + (eng ? '' : ' [엔진을 못 읽어 앞 재산 세액은 0으로 넘김 — 엔진으로 다시 돌릴 것]'));
  function 지난이번(x) { return x.합산 > 0; }
  const 다른 = 표.filter(function (r) { return r.계약일로보면; });
  다른.forEach(function (r) {
    const 바 = [];
    if (r.계약일로보면.신고기한 !== r.신고기한) 바.push('신고기한 ' + r.계약일로보면.신고기한 + ' → ' + r.신고기한);
    if (r.계약일로보면.미성년 !== undefined && r.계약일로보면.미성년 !== r.미성년) 바.push('미성년 공제 ' + (r.계약일로보면.미성년 ? '2천만' : '5천만') + ' → ' + (r.미성년 ? '2천만' : '5천만'));
    바.push('평가기간 ' + r.계약일로보면.평가기간 + ' → ' + r.평가기간);
    알림.push(r.이름 + ': 계약일(' + r.계약일 + ')로 보면 ' + 바.join(' · ') + ' — 증여일은 ' + r.증여일 + '(' + r.근거 + ')');
  });
  앞선.forEach(function (g) {
    const 빠진곳 = 법대로.filter(function (x) { return g.날 < famAddY_(x.증여일, -10); }).map(function (x) { return x.증여일; });
    const 계약에선들어감 = 계약대로.filter(function (x) { return g.날 >= famAddY_(x.증여일, -10) && g.날 < x.증여일; }).map(function (x) { return x.증여일; });
    if (빠진곳.length && 계약에선들어감.length) 알림.push(g.날 + ' 앞선 증여 ' + won(g.금액) + '원 — 계약일로 보면 10년 합산에 들지만, 법대로 증여일(' + 빠진곳.join('·') + ')로 보면 10년이 지나 합산에서 빠짐(§47② 「증여일 전 10년 이내」) [확인 필요 — 권장: 역산 초일 불산입 — 지금 셈 권장]');
  });
  // 신고 늦음
  const 신고 = jmYmd_(p.실제신고일);
  if (신고) 표.forEach(function (r) { if (r.신고기한 && 신고 > r.신고기한) 알림.push(r.이름 + ': 실제 신고일 ' + 신고 + '이 신고기한 ' + r.신고기한 + '보다 늦음 — 무신고 가산세·신고세액공제 없음(국세기본법 §47의2, 상증법 §69) · 「가산세판정」으로 볼 것'); });
  // 요건 줄
  const 모름 = 표.filter(function (r) { return !r.증여일; });
  reqs.push(jmReq_('재산마다 증여일을 법대로 정함', 모름.length ? null : true, 모름.length ? 모름.map(function (r) { return r.이름 + ' — ' + r.왜; }).join(' / ') : '', '상증법 §32·시행령 §24'));
  if (다른.length) reqs.push(jmReq_('계약일과 증여일이 다른 재산이 있음', true, 다른.map(function (r) { return r.이름 + ' 계약 ' + r.계약일 + ' → 증여일 ' + r.증여일; }).join(' / '), '시행령 §24①'));
  알림.push('평가기간은 증여일 전 6개월~후 3개월(시행령 §49①) — 증여일이 바뀌면 시가로 잡히는 매매·감정 사례도 바뀜. 같은 날 여러 재산은 한 증여로 묶어 엔진칸 하나');
  표.filter(function (r) { return r.증여일; }).forEach(function (r) { 할일.push({ 무엇: r.이름 + ' 증여세 신고·납부', 때: r.신고기한 + '까지', 근거: '상증법 §68①' }); });
  표.filter(function (r) { return /부동산|토지|건물|아파트|주택|상가|차량|선박/.test(r.종류) && !r.증여일 && /등기·등록 접수 전/.test(r.왜); }).forEach(function (r) { 할일.push({ 무엇: r.이름 + ' 증여 등기 접수 — 접수일이 증여일이 됨(기준시가 고시·10년 합산 문턱은 「증여시기」로 견줌)', 때: '정할 때', 근거: '시행령 §24①1호' }); });
  if (표.some(function (r) { return /주식/.test(r.종류) && !jmYmd_(((p.재산들 || []).find(function (a) { return (a.이름 || '') === r.이름; }) || {}).주주권행사일); })) 할일.push({ 무엇: '주식은 배당 수령·주주총회 참석 같은 받은 사실 증빙(주주명부·배당 통장)을 받아 증여일을 굳힐 것', 때: '신고 전', 근거: '시행령 §24②' });
  const 경우 = [
    { 이름: '① 법대로(재산마다 §24 증여일)', 날별: 법대로, 납부세액합계: 합계(법대로) },
    { 이름: '② [견주기] 계약일을 증여일로', 날별: 계약대로, 납부세액합계: 합계(계약대로) }
  ];
  const r = jmWrap_('증여일', reqs, { 표: 표, 경우: 경우, 엔진칸: 법대로[0] ? 법대로[0].엔진칸 : undefined, 엔진칸늘: 법대로.length > 1 || undefined, 알림: 알림, 할일: 할일 });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '').replace('— 충족', '— 충족(잠정)'); }
  return r;
}

// [2026.11.04 복잡사건 141] 가업승계 주식 증여세 과세특례 요건·사후관리 — 조특법 §30의6(2026-09-18 시행판)·조특령 §27의6(2026-09-18 시행판)
//  §30의6①: 18세 이상 거주자가 60세 이상 부모로부터 가업(중소기업 또는 직전 3개 과세연도 매출액 평균 5천억원 이상이 아닌 중견기업, 부모가 10년 이상 계속 경영)의
//           주식등을 증여받고 가업을 승계하면 가업자산상당액(10~20년 300억 · 20~30년 400억 · 30년 이상 600억 한도)에서 10억원 공제 뒤 10%(과세표준 120억 초과분 20%).
//           단서: 가업 승계 뒤 승계 당시 최대주주등(당초 증여자·수증자 제외)에게서 받는 것은 제외. §53·§53의2·§56 적용 안 함(일반 공제·신고세액공제 없음).
//  §30의6②·조특령 ②: 2인 이상 승계 — 1인이 모두 받은 것으로 보고, 같은 날이면 주식 가액 비율로 나눔(1호), 앞서 받은 승계자가 있으면 그 사람을 수증자로 봄(2호).
//  §30의6③: 정당한 사유 없이 가업을 승계하지 않거나, 5년 안에 1. 가업에 종사하지 않거나 휴업·폐업 2. 지분 감소 → 그 주식 가액에 일반 증여세 + 이자상당액.
//  §30의6④: 증여자·수증자의 조세포탈·회계부정(증여일 전 10년 ~ 증여일부터 5년 안 행위)으로 징역형·벌금형 확정 — 1호 과세표준·세액 결정 전이면 특례 없음, 2호 뒤면 일반 증여세 + 이자.
//  §30의6⑦: 이 특례를 받으면 §30의5(창업자금) 특례는 못 받음. ⑧: 사유 발생일이 속하는 달의 말일부터 3개월 안 신고·납부.
//  조특령 §27의6①1호: 증여자는 상증령 §15③1호가목(최대주주등으로 특수관계인과 합쳐 40%(상장 20%) 이상을 10년 이상 계속 보유) + 나목(대표이사 재직
//                    — 가업 영위기간의 50% 이상 또는 증여일부터 소급해 10년 중 5년 이상). 2호: 수증자 또는 그 배우자가 §68 신고기한까지 가업에 종사하고 증여일부터 3년 안 대표이사 취임.
//  조특령 ③: 승계하지 않은 경우 = ①2호를 갖추지 않은 경우. ④ 정당한 사유: 1. 수증자 사망 → 상속인이 상속세 신고기한까지 수증자 지위 승계 2. 국가·지방자치단체 증여 3. 그 밖에 재정경제부령.
//  조특령 ⑤: 이자 = 결정세액 × 당초 신고기한 다음 날부터 추징사유 발생일까지 × 시행령 §11의2⑩2호 율.
//  조특령 ⑥: 종사하지 않는 경우에는 5년까지 대표이사직을 유지하지 않는 경우, 상증령 §15⑪2호·3호 포함 — 2호: 주된 업종 변경(단, 표준산업분류 대분류 안에서 별표 업종으로 바꾸는 것·평가심의위원회 심의를 거친 변경은 제외) · 3호: 1년 이상 휴업(실적 없는 경우 포함)·폐업(원문 확인 2026-11-04).
//  조특령 ⑦: 지분 감소 — 처분(합병·분할 등 조직변경으로 처분했지만 최대주주등인 경우, 상장 요건 맞추려 처분 등 제외), 유상증자 때 실권 등으로 지분율 낮아짐
//            (투자 위한 제3자 배정·채무 출자전환으로 낮아졌지만 최대주주등인 경우 제외), 특수관계인 처분·실권으로 수증자가 최대주주등이 아니게 된 경우.
//  조특령 ⑩: 가업자산상당액 = 주식가액 × (1 − 사업무관자산 ÷ 총자산), 상증령 §15⑤2호 준용(상속개시일 → 증여일).
//  p: { 증여일, 수증자나이, 증여자나이, 수증자거주자, 증여자관계(부|모|조부모|기타), 기업규모(중소|중견|대기업), 중견3년평균매출(원), 계속경영연수,
//       증여자지분율(특수관계인 합산 %), 상장(예/아니오), 지분보유연수, 대표재직연수, 영위연수, 최근10년대표연수, 최대주주등에게서(당초 증여자·수증자 아닌 최대주주등 — 예/아니오),
//       주식가액(원), 총자산(원), 사업무관자산(원), 같은날다른승계자가액(원), 앞선특례증여가액, 앞선특례세액, 창업자금특례받음(예/아니오),
//       종사시작일, 대표취임일(수증자 또는 배우자), 처벌(증여자·수증자 조세포탈·회계부정 확정 — 예/아니오), 처벌확정일, 결정일,
//       사후사건:[{ 일, 종류(종사안함|대표사임|휴업|폐업|업종변경|처분|증자|특수관계인처분|사망|국가증여), 최대주주유지(예/아니오), 사유(조직변경|상장요건|제3자배정|출자전환|기타), 처분비율 }] }
function judgeBizSuccessionGift_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR'); };
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  let 잠정 = false;
  const 증여일 = jmYmd_(p.증여일);
  const 수나 = n(p.수증자나이), 증나 = n(p.증여자나이);
  reqs.push(jmReq_('수증자 18세 이상 거주자', !수나 ? null : 수나 >= 18 && jmYn_(p.수증자거주자) !== false, !수나 ? '수증자 나이(증여일 현재)' : jmYn_(p.수증자거주자) === false ? '비거주자는 대상 아님' : 수나 < 18 ? '18세 미만' : '', '조특법 §30의6①'));
  const 관계 = String(p.증여자관계 || '');
  reqs.push(jmReq_('60세 이상 부모에게서 받음', !증나 ? null : 증나 >= 60 && (!관계 || /^(부|모|아버지|어머니|부모)/.test(관계)), !증나 ? '증여자 나이(증여일 현재)' : 증나 < 60 ? '60세 미만' : /^(부|모|아버지|어머니|부모)/.test(관계) || !관계 ? '' : 관계 + '는 부모가 아님(조부모는 대상 아님 — 부모가 사망했어도 (원문 확인 2026-11-04: 조특법 §30의6①))', '조특법 §30의6①'));
  const 규모 = String(p.기업규모 || '');
  const 매출 = n(p.중견3년평균매출);
  let 규모결과 = null, 규모왜 = '중소기업 또는 중견기업인지(증여일 현재, 상증령 §15①②)';
  if (/중소/.test(규모)) { 규모결과 = true; 규모왜 = ''; }
  else if (/중견/.test(규모)) { 규모결과 = 매출 ? 매출 < 500000000000 : null; 규모왜 = 매출 ? (매출 >= 500000000000 ? '직전 3개 과세연도 매출액 평균 5천억원 이상' : '') : '직전 3개 과세연도 매출액 평균'; }
  else if (/대/.test(규모)) { 규모결과 = false; 규모왜 = '대기업은 대상 아님'; }
  reqs.push(jmReq_('가업: 중소기업 또는 매출 평균 5천억원 미만 중견기업', 규모결과, 규모왜, '조특법 §30의6①·조특령 §27의6⑭⑮'));
  const 연수 = n(p.계속경영연수);
  reqs.push(jmReq_('부모가 10년 이상 계속 경영', !연수 ? null : 연수 >= 10, !연수 ? '부모의 계속 경영 연수' : 연수 < 10 ? 연수 + '년' : '', '조특법 §30의6①'));
  const 한도 = 연수 >= 30 ? 60000000000 : 연수 >= 20 ? 40000000000 : 연수 >= 10 ? 30000000000 : 0;
  const 상장 = jmYn_(p.상장) === true, 지분 = Number(p.증여자지분율) || 0, 보유 = n(p.지분보유연수);
  reqs.push(jmReq_('증여자가 최대주주등으로 특수관계인과 ' + (상장 ? '20' : '40') + '% 이상을 10년 이상 계속 보유', !지분 || !보유 ? null : 지분 >= (상장 ? 20 : 40) && 보유 >= 10, !지분 || !보유 ? '주주명부·주식변동상황명세서(10년)' : (지분 < (상장 ? 20 : 40) ? '지분 ' + 지분 + '%' : '보유 ' + 보유 + '년'), '조특령 §27의6①1호가 → 상증령 §15③1호가목'));
  const 대표 = n(p.대표재직연수), 영위 = n(p.영위연수), 최근 = n(p.최근10년대표연수);
  let 대표결과 = null;
  if ((대표 && 영위) || 최근) 대표결과 = (대표 && 영위 && 대표 >= 영위 / 2) || 최근 >= 5;
  if (대표결과 === false && (!대표 || !영위 || !최근)) 대표결과 = null;
  reqs.push(jmReq_('증여자가 대표이사로 영위기간의 50% 이상 또는 최근 10년 중 5년 이상 재직', 대표결과, 대표결과 === null ? '법인등기부 임원 기록(대표 재직 연수·영위 연수)' : 대표결과 ? '' : '대표 ' + 대표 + '년 / 영위 ' + 영위 + '년 · 최근 10년 ' + 최근 + '년', '조특령 §27의6①1호나'));
  const 최대 = jmYn_(p.최대주주등에게서);
  reqs.push(jmReq_('당초 증여자·수증자 아닌 다른 최대주주등에게서 받은 것이 아님', 최대 === null ? null : !최대, 최대 === null ? '증여자가 가업 승계 뒤 승계 당시 최대주주등인지' : 최대 ? '승계 뒤 다른 최대주주등에게서 받은 주식은 제외' : '', '조특법 §30의6① 단서'));
  // 수증자 종사·대표 취임(조특령 ①2호)
  let 신고기한 = '';
  if (증여일) { const d = new Date(증여일 + 'T00:00:00Z'); 신고기한 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 4, 0)).toISOString().slice(0, 10); }
  let 대표기한 = '';
  if (증여일) { const d = new Date(증여일 + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 3); 대표기한 = d.toISOString().slice(0, 10); }
  const 종사 = jmYmd_(p.종사시작일), 취임 = jmYmd_(p.대표취임일);
  const 종사결과 = 종사 && 신고기한 ? 종사 <= 신고기한 : null;
  const 취임결과 = 취임 && 대표기한 ? 취임 <= 대표기한 : null;
  // 종사·취임을 못 하면 특례를 받은 뒤 「가업을 승계하지 않은 경우」로 추징한다(§30의6③·조특령 ③) — 요건 탈락이 아니라 추징 사유로 셈
  reqs.push(jmReq_('수증자(또는 배우자)가 신고기한(' + (신고기한 || '증여일이 속하는 달 말일부터 3개월') + ')까지 가업에 종사(못 하면 추징)', 종사결과 === false ? true : 종사결과, 종사결과 === null ? '종사 시작일(4대보험·급여 기록)' : 종사결과 ? '' : '종사 시작 ' + 종사 + ' — 늦음, 아래 추징', '조특령 §27의6①2호·③'));
  reqs.push(jmReq_('증여일부터 3년(' + (대표기한 || '?') + ') 안 대표이사 취임(못 하면 추징)', 취임결과 === false ? true : 취임결과, 취임결과 === null ? '대표이사 취임일(아직이면 기한 안에 취임 — 못 하면 추징)' : 취임결과 ? '' : '취임 ' + 취임 + ' — 늦음, 아래 추징', '조특령 §27의6①2호·③'));
  const 처벌 = jmYn_(p.처벌);
  const 결정일 = jmYmd_(p.결정일), 확정 = jmYmd_(p.처벌확정일);
  let 처벌호 = '';
  if (처벌 === true) 처벌호 = 확정 && 결정일 && 확정 > 결정일 ? '2호' : '1호';
  reqs.push(jmReq_('증여자·수증자 조세포탈·회계부정 징역·벌금형 확정 없음(결정 전)', 처벌 === null ? true : 처벌호 !== '1호', 처벌호 === '1호' ? '결정 전 확정 → 특례 없음' : '', '조특법 §30의6④1호'));
  if (처벌 === null) 알림.push('증여일 전 10년 ~ 증여일부터 5년 안 조세포탈(조세범 처벌법 §3①)·회계부정(외부감사법 §39①) 행위로 처벌이 확정되면 특례가 없거나 추징됨(§30의6④) — 확인할 것');
  if (jmYn_(p.창업자금특례받음) === true) reqs.push(jmReq_('창업자금 특례(§30의5)와 겹쳐 받지 않음', false, '§30의6을 받은 거주자는 §30의5를 못 받음(§30의6⑦)', '조특법 §30의6⑦'));
  // 가업자산상당액
  const 주식 = n(p.주식가액), 총 = n(p.총자산), 무관 = n(p.사업무관자산);
  let 비율 = 1;
  if (총) 비율 = Math.max(0, 1 - Math.min(무관, 총) / 총);
  else { 잠정 = true; 알림.push('총자산·사업무관자산을 넣지 않아 주식가액 전부를 가업자산상당액으로 봄(잠정) — 조특령 §27의6⑩·상증령 §15⑤2호'); }
  const 상당 = Math.round(주식 * 비율);
  const 무관몫 = 주식 - 상당;
  표.push({ 항목: '증여받은 주식 가액', 금액: 주식 });
  표.push({ 항목: '가업자산상당액(× ' + (Math.round(비율 * 10000) / 100) + '%)', 금액: 상당, 근거: '조특령 §27의6⑩' });
  if (무관몫) 표.push({ 항목: '사업무관자산 몫(특례 밖 — 일반 증여세)', 금액: 무관몫, 근거: '조특법 §30의6① 「가업자산상당액」' });
  if (한도) 표.push({ 항목: '한도(계속 경영 ' + 연수 + '년)', 금액: 한도, 근거: '조특법 §30의6①1~3호' });
  const 앞 = n(p.앞선특례증여가액);
  if (한도 && 상당 + 앞 > 한도) 알림.push('가업자산상당액 ' + won(상당 + 앞) + '원(앞선 특례 포함)이 한도 ' + won(한도) + '원을 넘음 — 넘는 몫은 일반 증여세로 (원문 확인 2026-11-04: 조특법 §30의6①1~3호)');
  // 엔진
  let eng = null;
  try { eng = typeof getUiCalcEngine_ === 'function' ? getUiCalcEngine_() : null; } catch (er) { eng = null; }
  const 엔진칸 = { specialType: 'business_succession', giftAmount: 주식, giftDate: 증여일 || undefined, doneeAge: 수나 || undefined, donorAge: 증나 || undefined,
    businessOwnershipYearsOfParent: 연수 || undefined, totalAssetValue: 총 || undefined, nonBizAsset55: 총 ? 무관 : undefined,
    coSuccessorSameDayGiftAmount: n(p.같은날다른승계자가액) || undefined, priorSpecialGiftAmount: 앞 || undefined, priorPaidTax: n(p.앞선특례세액) || undefined,
    isReceivedFromMajorShareholderAfterSuccession: 최대 === true ? true : undefined };
  const 일반칸 = { relation: '직계존속', giftAmount: 주식, giftDate: 증여일 || undefined, priorGiftAmount: 0 };
  let 특례결과 = null, 일반결과 = null, 무관결과 = null;
  const 결론요건 = reqs.filter(function (r) { return r.결과 === '✘'; }).length === 0;
  if (eng) {
    if (결론요건 && typeof eng.calculateSpecialRateGiftTaxJS === 'function') { try { 특례결과 = eng.calculateSpecialRateGiftTaxJS(엔진칸); } catch (er) { 특례결과 = { error: String(er) }; } }
    if (typeof eng.calculateGiftTaxJS === 'function') { try { 일반결과 = eng.calculateGiftTaxJS(일반칸); } catch (er) { 일반결과 = { error: String(er) }; } }
    if (결론요건 && 무관몫 > 0 && typeof eng.calculateGiftTaxJS === 'function') { try { 무관결과 = eng.calculateGiftTaxJS({ relation: '직계존속', giftAmount: 무관몫, giftDate: 증여일 || undefined, priorGiftAmount: 0 }); } catch (er) { 무관결과 = { error: String(er) }; } }
  } else 알림.push('엔진을 못 읽어 세액은 엔진칸으로 다시 돌릴 것');
  const 특례세 = 특례결과 && !특례결과.error ? (특례결과.납부세액 != null ? 특례결과.납부세액 : 특례결과.산출세액) : null;
  const 일반세 = 일반결과 && !일반결과.error ? 일반결과.납부세액 : null;
  // 사후관리 5년
  let 끝5 = '';
  if (증여일) { const d = new Date(증여일 + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 5); 끝5 = d.toISOString().slice(0, 10); }
  const 사건 = (p.사후사건 || []).filter(Boolean);
  let 추징일 = '', 추징사유 = '';
  if (취임결과 === false) { 추징일 = 대표기한; 추징사유 = '3년 안 대표이사 취임 안 함 → 가업 승계 안 함(조특령 ③)'; }
  if (종사결과 === false) { 추징일 = 신고기한; 추징사유 = '신고기한까지 종사 안 함 → 가업 승계 안 함(조특령 ③)'; }
  사건.forEach(function (e) {
    const 일 = jmYmd_(e.일), 종 = String(e.종류 || ''), 유지 = jmYn_(e.최대주주유지), 사유 = String(e.사유 || '');
    let 판 = '', 걸림 = false;
    if (끝5 && 일 && 일 > 끝5) 판 = '5년(' + 끝5 + ') 지난 뒤 — 사후관리 끝';
    else if (/사망/.test(종)) 판 = '수증자 사망 — 상속인이 상속세 신고기한까지 수증자 지위를 이으면 정당한 사유(조특령 ④1호), 아니면 (원문 확인 2026-11-04: 조특령 §27의6④1호·3호(재정경제부령 부득이 사유))';
    else if (/국가/.test(종)) 판 = '국가·지방자치단체에 증여 — 정당한 사유(조특령 ④2호)';
    else if (/처분/.test(종) && !/특수/.test(종)) { if (/조직변경|상장/.test(사유) && 유지 !== false) 판 = (/상장/.test(사유) ? '상장 요건 맞추려 처분' : '합병·분할 등 조직변경') + ' — 최대주주등이면 지분 감소로 보지 않음(조특령 ⑦1호 단서) (원문 확인 2026-11-04: 조특령 §27의6⑦1호 가·나목)'; else { 걸림 = true; 판 = '처분 → 지분 감소(§30의6③2호·조특령 ⑦)'; } }
    else if (/증자/.test(종)) { if (/제3자배정|출자전환/.test(사유) && 유지 !== false) 판 = '제3자 배정·출자전환으로 지분율 낮아짐 — 최대주주등이면 감소로 보지 않음(조특령 ⑦2호)'; else { 걸림 = true; 판 = '증자 실권 등으로 지분율 낮아짐 → 지분 감소(조특령 ⑦2호)'; } }
    else if (/특수관계인처분/.test(종)) { if (유지 === false) { 걸림 = true; 판 = '특수관계인 처분·실권으로 최대주주등 아님 → 지분 감소(조특령 ⑦3호)'; } else 판 = '특수관계인 처분이지만 수증자가 여전히 최대주주등 — 감소로 보지 않음' + (유지 === null ? ' [최대주주등 여부 확인]' : ''); }
    else if (/업종/.test(종) && /대분류|심의/.test(사유)) 판 = '주된 업종 변경이지만 ' + (/심의/.test(사유) ? '평가심의위원회 심의를 거친 변경' : '표준산업분류 대분류 안의 별표 업종으로 변경') + ' — 종사 안 함으로 보지 않음(상증령 §15⑪2호 단서, 원문 확인 2026-11-04)';
    else if (/휴업/.test(종) && /1년 미만|일시|[1-9]개월|1[01]개월/.test(사유)) 판 = '휴업이나 1년 미만 — 종사 안 함 아님(상증령 §15⑪3호는 1년 이상 휴업만, 원문 확인 2026-11-04)';
    else if (/종사안함|대표사임|휴업|폐업|업종/.test(종)) { 걸림 = true; 판 = (/대표/.test(종) ? '5년까지 대표이사직 유지 안 함' : /업종/.test(종) ? '주된 업종 변경(대분류 밖이거나 심의 없이 — 상증령 §15⑪2호)' : /휴업/.test(종) ? '1년 이상 휴업(실적 없음 포함 — 상증령 §15⑪3호)' : 종) + ' → 가업 종사 안 함·휴폐업(§30의6③1호·조특령 ⑥)'; if (/업종|휴업/.test(종) && !사유) 잠정 = true; }
    else 판 = '[실사건 때 확인] 종류를 알 수 없음';
    if (걸림 && (!추징일 || (일 && 일 < 추징일))) { 추징일 = 일; 추징사유 = 판; }
    표.push({ 항목: '사후: ' + (일 || '날짜?') + ' ' + 종, 판정: 판, 추징: 걸림 });
  });
  if (처벌호 === '2호') { 추징일 = 추징일 && 추징일 < 확정 ? 추징일 : 확정; 추징사유 = 추징사유 || '결정 뒤 조세포탈·회계부정 처벌 확정(§30의6④2호)'; }
  let 추징결과 = null;
  if (추징일 && eng && typeof eng.calculateSpecialRateGiftTaxClawbackJS === 'function') {
    try { 추징결과 = eng.calculateSpecialRateGiftTaxClawbackJS({ specialType: 'business_succession', clawbackAmount: 상당 || 주식, alreadyPaidSpecialTax: 특례세 || 0, giftDate: 증여일, violationDate: 추징일, donorDoneeContext: { relation: '직계존속', giftDate: 증여일 } }); } catch (er) { 추징결과 = { error: String(er) }; }
  }
  if (추징일) 알림.push('추징 사유: ' + 추징사유 + ' — 사유일 ' + 추징일 + ', 그 달 말일부터 3개월 안 신고·납부(§30의6⑧)' + (추징결과 && 추징결과.신고기한 ? ' → ' + 추징결과.신고기한 : '') + '. 재과세 대상 가액을 가업자산상당액으로 넣음 [판단 대기 — 판단거리3차 #40: 법문은 전부 — 비율 규정 없어 전부 과세 권장(납부유예 §30의7③2호나와 다름)]');
  const 무관세 = 무관결과 && !무관결과.error ? 무관결과.납부세액 : null;
  if (주식 && 무관몫 > 0) 알림.push('사업무관자산 몫 ' + won(무관몫) + '원은 특례 밖 — 특례 엔진은 가업자산상당액만 셈하므로 이 몫은 일반 증여세로 따로 셈' + (무관세 != null ? '(이 몫만이면 ' + won(무관세) + '원)' : '') + ' (원문 확인 2026-11-04: 조특법 §30의6⑤·§30의5⑪)');
  if (특례세 != null && 일반세 != null) 알림.push('특례 ' + won(특례세) + '원 vs 일반 증여세 ' + won(일반세) + '원(같은 가액·직계존속 공제·신고세액공제 포함) — 특례는 상속 때 기간 없이 상속세 과세가액에 더하고(§30의6⑤ → §30의5⑧), 증여세는 상속세에서 공제(§30의5⑨)');
  할일.push({ 무엇: '증여세 과세표준신고서와 함께 주식등 특례신청서 제출(신고기한까지 내지 않으면 특례 없음 (원문 확인 2026-11-04: 조특법 §30의6⑤→§30의5⑫))', 때: 신고기한 ? 신고기한 + '까지' : '증여세 신고 때', 근거: '조특법 §30의6⑤·조특령 §27의6⑬' });
  할일.push({ 무엇: '수증자(또는 배우자) 가업 종사 시작', 때: 신고기한 ? 신고기한 + '까지' : '신고기한까지', 근거: '조특령 §27의6①2호' });
  할일.push({ 무엇: '수증자(또는 배우자) 대표이사 취임', 때: 대표기한 ? 대표기한 + '까지' : '증여일부터 3년 안', 근거: '조특령 §27의6①2호' });
  할일.push({ 무엇: '5년 동안 종사·대표 유지·휴폐업 없음·지분 유지(처분·실권 금지) 지켜보기', 때: 끝5 ? 끝5 + '까지' : '증여일부터 5년', 근거: '조특법 §30의6③·조특령 ⑥⑦' });
  const 경우 = [
    { 이름: '① 특례(가업자산상당액 − 10억 × 10%, 120억 초과 20%)', 납부세액: 특례세, 엔진칸: 엔진칸, 설명: 결론요건 ? '' : '요건이 빠져 특례를 못 받음' },
    { 이름: '② [견주기] 일반 증여세', 납부세액: 일반세, 엔진칸: 일반칸 }
  ];
  if (무관세 != null) 경우.splice(1, 0, { 이름: '①-2 사업무관자산 몫 일반 증여세', 납부세액: 무관세, 엔진칸: { relation: '직계존속', giftAmount: 무관몫, giftDate: 증여일 || undefined } });
  if (추징결과 && !추징결과.error) 경우.push({ 이름: '③ 사후관리 위반 추징(' + 추징일 + ')', 추가납부세액: 추징결과.추가납부할세액, 이자상당액: 추징결과.이자상당액, 이자포함: 추징결과.이자포함_납부할세액, 신고기한: 추징결과.신고기한 });
  const r = jmWrap_('가업승계증여', reqs, { 표: 표, 가업자산상당액: 상당, 한도: 한도, 신고기한: 신고기한, 대표취임기한: 대표기한, 사후관리끝: 끝5, 특례세액: 특례세, 무관몫세액: 무관세, 일반세액: 일반세, 특례결과: 특례결과, 추징: 추징결과, 경우: 경우, 엔진칸: 엔진칸, 알림: 알림, 할일: 할일 });
  if (잠정 && r.결론 === '충족' && !r.잠정) { r.잠정 = true; r.표시 = r.표시.replace('— 충족', '— 충족(잠정)'); }
  return r;
}

// [2026.11.04 복잡사건 142] 상속개시일 전 처분재산·인출금·채무부담 상속 추정 — 상증법 §15(2026-01-02 시행판), 시행령 §11(2026-10-01 시행판)
//  §15①: 피상속인이 재산을 처분하거나 채무를 부담한 경우 다음이면 상속받은 것으로 추정해 §13 과세가액에 산입.
//   1호 처분해 받은 금액·재산에서 인출한 금액이 상속개시일 전 1년 이내 재산 종류별 2억원 이상, 2년 이내 재산 종류별 5억원 이상으로서 용도가 객관적으로 명백하지 않은 경우
//   2호 부담한 채무를 합친 금액이 1년 이내 2억원 이상, 2년 이내 5억원 이상으로서 용도가 객관적으로 명백하지 않은 경우
//  §15②: 국가·지자체·금융회사등이 아닌 자에 대한 채무로서 상속인이 변제할 의무가 없는 것으로 추정되면 과세가액에 산입(기준금액·차감 없음).
//  시행령 §11①1호 처분가액 중 1년·2년 이내에 실제 수입한 금액 / 2호 실제 인출한 금전등 — 통장·위탁자계좌로 예입된 경우 인출 합계에서 그 기간 예입 합계를 빼되,
//         그 통장·계좌에서 인출한 금전등이 아닌 예입은 빼지 않음 / ② 용도가 명백하지 않은 경우 1~5호 / ③ §15② = 시행령 §10①2호 서류로 실제 부담 확인 안 됨
//         / ④ 입증 안 된 금액이 (받은 금액 20%, 2억) 중 적은 금액에 미달하면 추정 안 함, 이상이면 그 적은 금액을 뺀 금액을 추정 / ⑤ 재산 종류: 현금·예금·유가증권 / 부동산·부동산 권리 / 그 밖
//  p: { 상속개시일, 거래들:[{ 날짜, 구분(처분|인출|예입|채무), 재산종류(현금예금유가증권|부동산|기타 — 채무는 무시), 금액, 받은돈:[{일, 금액}](처분 대금을 나눠 받았으면),
//        재예입(예입 줄: 그 통장·계좌에서 뺀 돈을 다시 넣은 것인지 예|아니오), 용도(소명|상속인|특수관계|재산취득|미소명|모름), 근거(영수증·계약서 등 글),
//        상대방, 채권자종류(금융|국가|개인), 상속인변제확인(예|아니오|모름), 내용 }] }
function judgeDisposalPresumption_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  let 잠정 = false;
  const 개시 = jmYmd_(p.상속개시일);
  if (!개시) { 잠정 = true; 알림.push('상속개시일을 모름 — 1년·2년 기간을 셀 수 없음'); }
  const d1 = 개시 ? famAddY_(개시, -1) : '', d2 = 개시 ? famAddY_(개시, -2) : '';
  // 1년 이내 = 상속개시일 1년 전 같은 날부터 [확인 필요 — 권장: 역산 초일 불산입 — 지금 셈 권장]
  const 안 = function (일, 시작) { return !!(개시 && 일 && 일 >= 시작 && 일 <= 개시); };
  const 종류명 = function (t) { t = String(t || ''); return /부동산|토지|건물|분양|입주/.test(t) ? '부동산·부동산 권리' : /기타|그 ?밖|가상|회원권|차량|골프/.test(t) ? '그 밖의 재산' : '현금·예금·유가증권'; };
  const 칸 = {}; // 종류별 { 일년:{액,예입,소명,소명잠정}, 이년:{...} }
  const 칸얻기 = function (k) { if (!칸[k]) 칸[k] = { 일년: { 액: 0, 예입: 0, 소명: 0, 잠정소명: 0 }, 이년: { 액: 0, 예입: 0, 소명: 0, 잠정소명: 0 } }; return 칸[k]; };
  let 가공채무 = 0, 가공잠정 = 0, 가공잠정1 = 0, 가공잠정2 = 0, 사전증여 = 0, 기간밖 = [];
  (p.거래들 || []).forEach(function (t, i) {
    if (!t) return;
    const 구분 = String(t.구분 || '').trim() || '인출';
    const 이름 = (t.내용 || 구분) + (t.날짜 ? '(' + t.날짜 + ')' : '');
    const 일 = jmYmd_(t.날짜);
    const 금 = n(t.금액);
    if (/예입|입금/.test(구분)) {
      const 재 = jmYn_(t.재예입);
      const k = 종류명(t.재산종류), c = 칸얻기(k);
      if (재 === true) { if (안(일, d1)) c.일년.예입 += 금; if (안(일, d2)) c.이년.예입 += 금; }
      else if (재 === null) { 잠정 = true; 할일.push({ 무엇: 이름 + ' 예입 ' + won(금) + '이 그 통장에서 뺀 돈을 다시 넣은 것인지(통장 흐름)', 때: '상속세 신고 전', 근거: '시행령 §11①2호 후단' }); }
      표.push({ 줄: 이름, 구분: '예입', 종류: k, 금액: 금, 셈: 재 === true ? '인출에서 뺌' : 재 === false ? '안 뺌 — 그 통장에서 뺀 돈이 아님(급여·연금·남의 돈 등)' : '잠정 — 안 뺌', 근거: '시행령 §11①2호' });
      return;
    }
    // 채무
    const 채무 = /채무|차입|대출|빌/.test(구분);
    const k = 채무 ? '부담채무' : 종류명(t.재산종류);
    // 처분 대금은 실제 받은 날·금액으로
    const 받 = (Array.isArray(t.받은돈) && t.받은돈.length) ? t.받은돈.map(function (x) { return { 일: jmYmd_(x.일), 금: n(x.금액) }; }) : [{ 일: 일, 금: 금 }];
    const a1 = 받.reduce(function (s, x) { return s + (안(x.일, d1) ? x.금 : 0); }, 0);
    const a2 = 받.reduce(function (s, x) { return s + (안(x.일, d2) ? x.금 : 0); }, 0);
    const 합받 = 받.reduce(function (s, x) { return s + x.금; }, 0);
    if (!a2 && 개시) { 기간밖.push(이름 + ' ' + won(합받)); }
    // §15② 가공채무 — 사인 채무이고 상속인 변제 의무가 확인 안 되면 전액(1호 채무 줄에는 넣지 않음)
    if (채무 && /개인|사인|기타/.test(String(t.채권자종류 || ''))) {
      const 변 = jmYn_(t.상속인변제확인);
      if (변 === false) { 가공채무 += 금; 표.push({ 줄: 이름, 구분: '채무(§15②)', 종류: '변제의무 없는 사인 채무', 금액: 금, 셈: '전액 과세가액에 더함 — 기준금액·차감 없음', 근거: '상증법 §15②·시행령 §11③' }); 할일.push({ 무엇: 이름 + ' 채무를 상속인이 실제로 갚는다는 서류(차용증·이자 지급·상환 통장, 시행령 §10①2호)', 때: '상속세 신고 전', 근거: '시행령 §11③' }); return; }
      if (변 === null) { 가공잠정 += 금; 가공잠정1 += a1; 가공잠정2 += a2; 잠정 = true; 할일.push({ 무엇: 이름 + ' 채무를 상속인이 실제로 갚는지(차용증·이자·상환 통장)', 때: '상속세 신고 전', 근거: '상증법 §15②·시행령 §10①2호' }); }
    }
    const 용 = String(t.용도 || '').trim();
    const 근거있음 = !!String(t.근거 || '').trim();
    let 소명 = 0, 잠소 = 0, 셈 = '', 근 = '시행령 §11②';
    if (/상속인/.test(용)) {
      // 상속인에게 준 돈 — 쓴 곳은 밝혀졌으나 사전증여(§13①1호, 10년)로 과세가액에 더함 + 증여세
      소명 = 1; 사전증여 += Math.max(a1, a2) || 합받;
      셈 = '쓴 곳 밝혀짐(상속인에게 줌) — §15 추정 대신 사전증여로 더함(상증법 §13①1호) · 신고 안 했으면 증여세(§47·§68) 따로';
      근 = '상증법 §13①1호';
      할일.push({ 무엇: 이름 + ' 받은 상속인의 증여세 신고 여부 확인 — 안 했으면 기한 후 신고', 때: '상속세 신고 전', 근거: '상증법 §68①' });
    } else if (/특수관계/.test(용)) {
      if (근거있음) { 잠소 = 1; 잠정 = true; 셈 = '특수관계인에게 지출 — 근거 있음, 사회통념상 지출 사실이 인정되는지 잠정(시행령 §11②3호)'; }
      else { 셈 = '특수관계인에게 지출 — 근거 없어 용도 불분명(시행령 §11②3호)'; }
    } else if (/재산취득|취득/.test(용)) {
      if (근거있음) { 소명 = 1; 셈 = '그 돈으로 산 다른 재산 확인(상속재산에 이미 들어 있어야 함, 시행령 §11②4호의 반대)'; }
      else { 셈 = '산 재산이 확인 안 됨 — 용도 불분명(시행령 §11②4호)'; }
    } else if (/소명|병원|생활|세금|상환|이자|공과/.test(용)) {
      if (근거있음) { 소명 = 1; 셈 = '쓴 곳 증빙 있음'; }
      else { 잠소 = 1; 잠정 = true; 셈 = '쓴 곳을 말했으나 증빙 없음 — 지금은 용도 불분명(시행령 §11②1호), 증빙을 받으면 소명'; 할일.push({ 무엇: 이름 + ' 쓴 곳 증빙(영수증·계약서·이체 상대방)', 때: '상속세 신고 전', 근거: '시행령 §11②1호' }); }
    } else {
      if (/모름/.test(용) || !용) { 잠정 = true; 할일.push({ 무엇: 이름 + ' 어디에 썼는지 상속인께 여쭙고 증빙 받기', 때: '상속세 신고 전', 근거: '상증법 §15①' }); }
      셈 = '용도 불분명(' + (용 || '모름') + ')';
    }
    const c = 칸얻기(k);
    c.일년.액 += a1; c.이년.액 += a2;
    if (소명) { c.일년.소명 += a1; c.이년.소명 += a2; }
    if (잠소) { c.일년.잠정소명 += a1; c.이년.잠정소명 += a2; }
    표.push({ 줄: 이름, 구분: 구분, 종류: k, 금액: 합받, '1년안': a1, '2년안': a2, 셈: 셈, 근거: 근 });
  });
  const 추정 = function (액, 예입, 소명, 기준) {
    const 순 = Math.max(0, 액 - 예입);
    if (순 < 기준) return { 순: 순, 미입증: 0, 뺄금액: 0, 추정: 0, 기준넘음: false };
    const 미 = Math.max(0, 순 - Math.min(소명, 순));
    const 뺄 = Math.min(Math.floor(순 * 0.2), 200000000);
    return { 순: 순, 미입증: 미, 뺄금액: 뺄, 추정: 미 >= 뺄 ? 미 - 뺄 : 0, 기준넘음: true };
  };
  const 줄만들기 = function (잠정소명도) {
    return Object.keys(칸).map(function (k) {
      const c = 칸[k];
      return { category: k, oneYearAmount: c.일년.액, oneYearSelfDeposit: Math.min(c.일년.예입, c.일년.액), oneYearExplained: c.일년.소명 + (잠정소명도 ? c.일년.잠정소명 : 0),
        twoYearAmount: c.이년.액, twoYearSelfDeposit: Math.min(c.이년.예입, c.이년.액), twoYearExplained: c.이년.소명 + (잠정소명도 ? c.이년.잠정소명 : 0) };
    }).filter(function (x) { return x.oneYearAmount || x.twoYearAmount; });
  };
  const 법대로 = 줄만들기(false), 받으면 = 줄만들기(true);
  const 종류표 = 법대로.map(function (x) {
    const o = 추정(x.oneYearAmount, x.oneYearSelfDeposit, x.oneYearExplained, 200000000);
    const t = 추정(x.twoYearAmount, x.twoYearSelfDeposit, x.twoYearExplained, 500000000);
    return { 종류: x.category, 일년: o, 이년: t, 추정액: Math.max(o.추정, t.추정), 쓴기간: t.추정 > o.추정 ? '2년' : o.추정 > 0 ? '1년' : '' };
  });
  const 합 = function (rows) { return rows.reduce(function (s, x) { return s + Math.max(추정(x.oneYearAmount, x.oneYearSelfDeposit, x.oneYearExplained, 200000000).추정, 추정(x.twoYearAmount, x.twoYearSelfDeposit, x.twoYearExplained, 500000000).추정); }, 0); };
  const 추정합 = 합(법대로), 받은뒤합 = 합(받으면);
  종류표.forEach(function (r) {
    const 넘 = r.일년.기준넘음 || r.이년.기준넘음;
    const 왜 = !넘 ? '1년 ' + won(r.일년.순) + '(2억 미만)·2년 ' + won(r.이년.순) + '(5억 미만) — 기준 안 넘어 추정 안 함'
      : '1년 순 ' + won(r.일년.순) + ' · 2년 순 ' + won(r.이년.순) + ' → 미입증 ' + won(Math.max(r.일년.미입증, r.이년.미입증)) + '에서 ' + won(r.쓴기간 === '1년' ? r.일년.뺄금액 : r.이년.뺄금액) + '(20%·2억 중 적은 금액) 빼고 ' + won(r.추정액) + (r.쓴기간 ? '(' + r.쓴기간 + ' 기준이 큼)' : '');
    reqs.push(jmReq_(r.종류 + ' — 상속 추정 없음', r.추정액 > 0 ? false : true, 왜, r.종류 === '부담채무' ? '상증법 §15①2호·시행령 §11②④' : '상증법 §15①1호·시행령 §11①④⑤'));
  });
  if (가공채무 || 가공잠정) reqs.push(jmReq_('사인 채무를 상속인이 실제로 갚음(§15②)', 가공채무 ? false : null, 가공채무 ? won(가공채무) + ' 변제의무 확인 안 됨 — 전액 더함' : won(가공잠정) + ' 확인 전', '상증법 §15②·시행령 §11③'));
  if (기간밖.length) 알림.push('상속개시일 전 2년 밖 거래는 §15 추정 대상이 아님: ' + 기간밖.join(', ') + ' — 다만 상속인에게 간 돈이면 10년 사전증여(§13①1호)로 따로 봄');
  if (사전증여) 알림.push('상속인에게 간 돈 ' + won(사전증여) + ' — §15가 아니라 사전증여로 과세가액에 더하고(§13①1호), 그 상속인 몫 증여세는 상속세에서 증여세액공제(§28) · 판정 묶음 「차명계좌」(명의만 빌린 돈인지)·가족 지도 증여 줄로');
  if (Object.keys(칸).length > 1) 알림.push('재산 종류마다 따로 기준(1년 2억·2년 5억)을 봄 — 종류를 합쳐 한 줄로 넣으면 기준을 잘못 넘김(시행령 §11⑤ 「재산 종류별」)');
  if (칸['부담채무']) 알림.push('채무는 종류를 나누지 않고 합친 금액으로 기준을 봄(§15①2호 「채무를 합친 금액」) · 서식 부표4의 채무 Ⅰ·Ⅱ 줄 나눔과 기준 셈의 관계 (원문 확인 2026-11-04: 상증법 §15①2호)');
  알림.push('추정은 상속인이 쓴 곳을 밝히면 깨짐 — 미입증 금액에서 20%·2억 중 적은 금액을 빼 주는 것은 다 밝히지 못해도 되는 몫(시행령 §11④)');
  알림.push('1년·2년은 상속개시일 1년(2년) 전 같은 날부터 셈 [확인 필요 — 권장: 같음]');
  if (가공잠정) 알림.push('사인 채무 ' + won(가공잠정) + '을 상속인이 갚는지 확인 전 — 못 갚을 빚(가공 채무)로 밝혀지면 전액 더함(§15②), 엔진칸은 경우 ③에');
  const 엔칸 = function (rows, 가공) { const o = { disposalPresumptionItems: rows }; if (가공) o.presumedFictitiousDebtAmount = 가공; return o; };
  const 경우 = [
    { 이름: '① 법대로(지금 증빙 — 종류별 기준·재예입 뺌·20%·2억 뺌)', 추정액: 추정합 + 가공채무, 사전증여: 사전증여, 엔진칸: 엔칸(법대로, 가공채무) }
  ];
  if (받은뒤합 !== 추정합) 경우.push({ 이름: '② 말씀한 쓴 곳 증빙을 다 받는다고 봄(잠정 소명 넣음)', 추정액: 받은뒤합 + 가공채무, 사전증여: 사전증여, 엔진칸: 엔칸(받으면, 가공채무) });
  if (가공잠정) 경우.push({ 이름: '③ 확인 전 사인 채무도 갚을 의무 없다고 봄(§15②)', 추정액: null, 사전증여: 사전증여, 엔진칸: 엔칸(법대로.map(function (x) { return x.category !== '부담채무' ? x : Object.assign({}, x, { oneYearAmount: Math.max(0, x.oneYearAmount - 가공잠정1), twoYearAmount: Math.max(0, x.twoYearAmount - 가공잠정2) }); }), 가공채무 + 가공잠정) });
  경우.forEach(function (c) { if (c.추정액 === null) c.추정액 = 합(c.엔진칸.disposalPresumptionItems) + (c.엔진칸.presumedFictitiousDebtAmount || 0); });
  // 견주기 — 흔한 잘못: 종류를 합치고 재예입을 안 뺌
  const 한줄 = 법대로.filter(function (x) { return x.category !== '부담채무'; }).reduce(function (s, x) { s.oneYearAmount += x.oneYearAmount; s.twoYearAmount += x.twoYearAmount; s.oneYearExplained += x.oneYearExplained; s.twoYearExplained += x.twoYearExplained; return s; }, { category: '현금·예금·유가증권', oneYearAmount: 0, oneYearSelfDeposit: 0, oneYearExplained: 0, twoYearAmount: 0, twoYearSelfDeposit: 0, twoYearExplained: 0 });
  const 한줄들 = [한줄].concat(법대로.filter(function (x) { return x.category === '부담채무'; }));
  경우.push({ 이름: '[견주기] 재산 종류를 합쳐 한 줄로·재예입도 안 뺌', 추정액: 합(한줄들) + 가공채무, 사전증여: 사전증여, 엔진칸: 엔칸(한줄들, 가공채무) });
  경우.push({ 이름: '[견주기] 추정을 아예 안 봄', 추정액: 0, 사전증여: 0, 엔진칸: { disposalPresumptionItems: [] } });
  let 신고기한 = '';
  if (개시) { const d = new Date(개시 + 'T00:00:00Z'); 신고기한 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 7, 0)).toISOString().slice(0, 10); 알림.push('상속세 신고기한 ' + 신고기한 + '(상속개시일이 속한 달 말일부터 6개월, §67① — 외국 주소면 9개월)'); }
  할일.push({ 무엇: '피상속인 통장 2년치(모든 계좌)·처분 계약서·대출 약정서 받기 — 종류별 인출·처분·차입 줄 세우기', 때: '상속세 신고 전', 근거: '상증법 §15①·시행령 §11①' });
  const r = jmWrap_('상속추정재산', reqs, { 거래표: 표, 종류표: 종류표, 추정액: 추정합, 가공채무: 가공채무, 사전증여: 사전증여, 증빙받은뒤추정액: 받은뒤합, 기간: { 일년시작: d1, 이년시작: d2, 상속개시일: 개시 }, 신고기한: 신고기한, 엔진칸: 경우[0].엔진칸, 경우: 경우, 알림: 알림, 할일: 할일 });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}

// [2026.11.04 복잡사건 143] 보험금 — 상속재산으로 보는 보험금과 보험금의 증여 가르기 — 상증법 §8·§34·§22·§46 8호·§27(2026-01-02 시행판), 시행령 §4①·§19①·§35⑥(2026-10-01 시행판)
//  §8①: 피상속인의 사망으로 받는 보험금으로서 피상속인이 보험계약자인 계약에 의한 것은 상속재산으로 봄. ②: 계약자가 피상속인이 아니어도 피상속인이 실질적으로 보험료를 냈으면 계약자로 봄.
//  시행령 §4①: 상속재산으로 보는 보험금 = 받은 보험금 합계 × 피상속인이 낸 보험료 ÷ 그 계약의 총 보험료.
//  §34①: 보험사고(만기 포함)가 생긴 날을 증여일로 — 1호 수령인과 납부자가 다르면 수령인 아닌 자가 낸 보험료에 대한 보험금 상당액 / 2호 수령인이 증여받은 재산으로 냈으면 그 몫의 보험금 상당액 − 그 보험료. ②: §8로 상속재산이 되면 적용 안 함.
//  §46 8호·시행령 §35⑥: 장애인을 수익자로 한 보험의 보험금은 증여세 비과세, 연 4천만원 한도(증여에만 — 상속재산으로 보는 보험금엔 없음).
//  §22·시행령 §19①: 보험금은 금융재산(금융재산 상속공제 바탕). §27: 피상속인의 자녀 아닌 직계비속이 상속인·수유자면 할증(대습상속은 빼고).
//  p: { 상속개시일, 피상속인(이름 — 납부 줄 누가와 맞춤), 계약들:[{ 이름, 계약자, 피보험자, 수익자, 수익자관계(배우자|자녀|손자녀|부모|형제|기타 — 피상속인 기준),
//        수익자상속인(예|아니오|모름), 대습(예|아니오), 수익자장애인(예|아니오), 수익자미성년(예|아니오), 사고(사망|만기|기타), 사고일, 보험금,
//        총보험료(비우면 납부 줄 합), 납부:[{ 누가, 금액, 재원(본인소득|증여받은돈|모름), 증여자, 관계(수익자 기준: 배우자|부모|조부모|자녀|기타친족|기타) }] }],
//      상속기본(선택: 보험금 빼고 넣은 상속세 엔진 입력) }
function judgeInsuranceTax_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; };
  const 같다 = function (a, b) { a = String(a || '').trim(); b = String(b || '').trim(); return !!a && a === b; };
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  let 잠정 = false;
  const 개시 = jmYmd_(p.상속개시일);
  const 피 = String(p.피상속인 || '피상속인').trim();
  const 말일3 = function (d) { if (!d) return ''; const x = new Date(d + 'T00:00:00Z'); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 4, 0)).toISOString().slice(0, 10); };
  const 공제한도 = function (관계, 미성년) { return /배우자/.test(관계) ? 600000000 : /부모|조부모|직계존속/.test(관계) ? (미성년 ? 20000000 : 50000000) : /자녀|직계비속/.test(관계) ? 50000000 : /친족|형제/.test(관계) ? 10000000 : 0; };
  const 엔관계 = function (관계) { return /배우자/.test(관계) ? '배우자' : /부모|조부모|직계존속/.test(관계) ? '직계존속' : /자녀|직계비속/.test(관계) ? '직계비속' : /친족|형제/.test(관계) ? '기타친족' : '기타'; };
  let 간주 = 0, 간주대안추가 = 0, 세대생략 = 0, 수유자보험 = 0, 포기자보험 = 0;
  const 증여들 = [], 증여대안빼기 = []; // 경우 ②에서 상속으로 옮길 §34①2호 몫
  const 장애비과세 = {}; // 수익자|연도 → 쓴 한도
  (p.계약들 || []).forEach(function (c, ci) {
    if (!c) return;
    const 이름 = c.이름 || ('보험 ' + (ci + 1));
    const 보험금 = n(c.보험금);
    const 납 = Array.isArray(c.납부) && c.납부.length ? c.납부 : (c.계약자 ? [{ 누가: c.계약자, 금액: n(c.총보험료), 재원: /피상속인/.test(c.계약자) || 같다(c.계약자, 피) ? '본인소득' : '모름' }] : []);
    const 총 = n(c.총보험료) || 납.reduce(function (s, x) { return s + n(x.금액); }, 0);
    const 사고 = String(c.사고 || '').trim() || (같다(c.피보험자, 피) ? '사망' : '');
    const 사망 = /사망/.test(사고) && (같다(c.피보험자, 피) || /피상속인/.test(String(c.피보험자 || '')));
    const 사고일 = jmYmd_(c.사고일) || (사망 ? 개시 : '');
    if (!보험금 || !총) { 잠정 = true; 할일.push({ 무엇: 이름 + ' 보험금 지급 명세·보험료 납입 내역(납입자별)', 때: '신고 전', 근거: '시행령 §4①·상증법 §34①' }); }
    if (!사고일) { 잠정 = true; 알림.push(이름 + ' 보험사고일을 모름 — 증여일(§34① 보험사고 발생일)과 신고기한을 셀 수 없음'); }
    const 수익 = String(c.수익자 || '').trim();
    const 장애 = jmYn_(c.수익자장애인) === true;
    const 상속인 = jmYn_(c.수익자상속인);
    const 대습 = jmYn_(c.대습) === true;
    const 몫 = function (금) { return 총 ? Math.round(보험금 * 금 / 총) : 0; };
    const 줄 = { 계약: 이름, 수익자: 수익, 보험금: 보험금, 총보험료: 총, 갈래: [] };
    if (같다(수익, 피) || (사망 && /피상속인/.test(수익))) {
      // 수익자가 피상속인 본인(사망보험금이 피상속인에게) — 본래의 상속재산(§7), 보험금 청구권
      간주 += 보험금; 줄.갈래.push({ 누가낸: '모두', 금액: 보험금, 셈: '수익자가 피상속인 — 보험금 청구권이 본래 상속재산(상증법 §7)', 근거: '상증법 §7' });
      표.push(줄); return;
    }
    납.forEach(function (x) {
      const 누 = String(x.누가 || '').trim();
      const 금 = n(x.금액);
      const 상당 = 몫(금);
      const 재원 = String(x.재원 || '').trim();
      if (같다(누, 피) || /피상속인/.test(누)) {
        if (사망) {
          간주 += 상당;
          if (/손자|손녀|증손/.test(String(c.수익자관계 || '')) && !대습) 세대생략 += 상당;
          if (상속인 === false) 수유자보험 += 상당;
          if (jmYn_(c.상속포기) === true) 포기자보험 += 상당;
          줄.갈래.push({ 누가낸: 누 || 피, 보험료: 금, 금액: 상당, 셈: (같다(c.계약자, 피) || /피상속인/.test(String(c.계약자 || '')) ? '피상속인이 계약자 — §8①' : '계약자는 ' + (c.계약자 || '모름') + '이나 피상속인이 실제로 냄 — §8②') + ' · 보험금 × ' + won(금) + ' ÷ ' + won(총), 근거: 같다(c.계약자, 피) ? '상증법 §8①·시행령 §4①' : '상증법 §8②·시행령 §4①' });
        } else {
          // 피상속인이 살아 있을 때 만기·다른 사고 — 피상속인이 낸 보험료 몫은 피상속인이 준 증여(§34①1호)
          증여들.push({ 계약: 이름, 증여자: 누 || 피, 수증자: 수익, 관계: x.관계 || c.수익자관계, 증여재산가액: 상당, 증여일: 사고일, 호: '1호', 장애: 장애, 미성년: jmYn_(c.수익자미성년) === true });
          줄.갈래.push({ 누가낸: 누 || 피, 보험료: 금, 금액: 상당, 셈: '피상속인 생전 보험사고 — 낸 사람이 준 증여(§34①1호)', 근거: '상증법 §34①1호' });
        }
        return;
      }
      if (같다(누, 수익)) {
        if (/증여/.test(재원)) {
          const 가 = Math.max(0, 상당 - 금);
          const 증여자 = String(x.증여자 || '').trim();
          const 증여자가피 = 같다(증여자, 피) || /피상속인/.test(증여자);
          증여들.push({ 계약: 이름, 증여자: 증여자 || '모름', 수증자: 수익, 관계: x.관계 || '', 증여재산가액: 가, 증여일: 사고일, 호: '2호', 장애: 장애, 미성년: jmYn_(c.수익자미성년) === true, 상속대안: 사망 && 증여자가피 ? 상당 : 0 });
          if (사망 && 증여자가피) { 간주대안추가 += 상당; 증여대안빼기.push(증여들.length - 1); 잠정 = true; }
          if (!증여자) { 잠정 = true; 할일.push({ 무엇: 이름 + ' 보험료로 쓴 돈을 누구에게서 받았는지(이체 기록)', 때: '신고 전', 근거: '상증법 §34①2호' }); }
          줄.갈래.push({ 누가낸: 누, 보험료: 금, 금액: 가, 셈: '수령인이 증여받은 돈으로 냄 — 보험금 상당액 ' + won(상당) + ' − 보험료 ' + won(금) + '(§34①2호)' + (사망 && 증여자가피 ? ' · 돈 준 사람이 피상속인이라 「실질적으로 냈다」(§8②)로 볼 여지 [판단 대기 — 판단거리3차 #41: ①수령인이 증여받은 돈으로 냈으면 §34①2호 명문(권장) ②피상속인 실질 납부로 §8② 상속재산 — 두 경우 유지] — 경우 ②' : ''), 근거: '상증법 §34①2호' });
          할일.push({ 무엇: 이름 + ' 보험료로 쓴 돈을 받을 때 증여세 신고 여부(보험료 ' + won(금) + ' 자체도 그때 증여)', 때: '신고 전', 근거: '상증법 §68①·§47②' });
        } else if (/모름/.test(재원) || !재원) {
          잠정 = true;
          할일.push({ 무엇: 이름 + ' 수령인(' + 수익 + ')이 낸 보험료 ' + won(금) + '의 돈 출처(본인 소득 통장인지)', 때: '신고 전', 근거: '상증법 §34①2호' });
          줄.갈래.push({ 누가낸: 누, 보험료: 금, 금액: 0, 셈: '수령인이 직접 냄 — 본인 소득이면 과세 안 함, 출처를 아직 모름(잠정)', 근거: '상증법 §34①' });
        } else {
          줄.갈래.push({ 누가낸: 누, 보험료: 금, 금액: 0, 셈: '수령인 본인 소득으로 냄 — 과세 안 함', 근거: '상증법 §34①1호(반대)' });
        }
        return;
      }
      if (!누 || /모름/.test(누)) {
        잠정 = true;
        할일.push({ 무엇: 이름 + ' 보험료 ' + won(금) + '을 누가 냈는지(보험사 납입 내역·출금 통장)', 때: '신고 전', 근거: '시행령 §4①·상증법 §34①' });
        줄.갈래.push({ 누가낸: '모름', 보험료: 금, 금액: 상당, 셈: '낸 사람을 모름 — 계약자(' + (c.계약자 || '모름') + ')가 냈다고 잠정', 근거: '상증법 §8②·§34①' });
        if (사망 && (같다(c.계약자, 피) || /피상속인/.test(String(c.계약자 || '')))) { 간주 += 상당; 표.push(줄); return; }
        if (같다(c.계약자, 수익)) return;
        증여들.push({ 계약: 이름, 증여자: c.계약자 || '모름', 수증자: 수익, 관계: c.수익자관계, 증여재산가액: 상당, 증여일: 사고일, 호: '1호', 장애: 장애, 잠정: true, 미성년: jmYn_(c.수익자미성년) === true });
        return;
      }
      // 수령인 아닌 다른 사람(피상속인 말고)이 냄 — §34①1호, 낸 사람이 준 증여
      증여들.push({ 계약: 이름, 증여자: 누, 수증자: 수익, 관계: x.관계 || '', 증여재산가액: 상당, 증여일: 사고일, 호: '1호', 장애: 장애, 미성년: jmYn_(c.수익자미성년) === true });
      줄.갈래.push({ 누가낸: 누, 보험료: 금, 금액: 상당, 셈: 누 + '이 냄 — 보험금 × ' + won(금) + ' ÷ ' + won(총) + '을 ' + 누 + '이 ' + 수익 + '에게 준 증여(§34①1호, 증여일 ' + (사고일 || '모름') + ')', 근거: '상증법 §34①1호' });
      if (!x.관계) { 잠정 = true; 할일.push({ 무엇: 이름 + ' ' + 누 + '와 ' + 수익 + '의 관계(증여재산공제)', 때: '신고 전', 근거: '상증법 §53' }); }
    });
    if (사망 && 상속인 === null && 줄.갈래.some(function (g) { return /§8/.test(g.근거); })) { 잠정 = true; 할일.push({ 무엇: 이름 + ' 수익자 ' + 수익 + '이 상속인인지(가족관계증명서·상속 포기 여부)', 때: '신고 전', 근거: '상증법 §2 4호·§3의2' }); }
    표.push(줄);
  });
  // 증여세 — 장애인 비과세(연 4천만)를 수익자·연도별로 나눠 씀, 엔진으로 셈
  let eng = null;
  try { eng = typeof getUiCalcEngine_ === 'function' ? getUiCalcEngine_() : null; } catch (er) { eng = null; }
  const 증여셈 = function (제외) {
    const 쓴 = {};
    return 증여들.map(function (g, i) {
      if (제외 && 제외.indexOf(i) >= 0) return null;
      const 연 = String(g.증여일 || '').slice(0, 4), key = g.수증자 + '|' + 연;
      let 비과세 = 0;
      if (g.장애 && g.증여재산가액 > 0) { const 남 = Math.max(0, 40000000 - (쓴[key] || 0)); 비과세 = Math.min(남, g.증여재산가액); 쓴[key] = (쓴[key] || 0) + 비과세; }
      const 과세 = Math.max(0, g.증여재산가액 - 비과세);
      const o = { 계약: g.계약, 증여자: g.증여자, 수증자: g.수증자, 호: g.호, 증여일: g.증여일, 신고기한: 말일3(g.증여일), 증여재산가액: g.증여재산가액, 장애인비과세: 비과세, 과세가액: 과세 };
      if (과세 > 0) {
        const e = { giftAmount: 과세, relation: 엔관계(g.관계), relationDeductionLimit: 공제한도(g.관계, g.미성년), giftDate: g.증여일, giftReceivedDate: g.증여일, isMinor: !!g.미성년, isGenerationSkip: /조부모/.test(String(g.관계 || '')), filingStatus: 'ontime' };
        o.엔진칸 = e;
        if (eng && typeof eng.calculateGiftTaxJS === 'function') { try { const k = eng.calculateGiftTaxJS(e); if (k && !k.error) { o.과세표준 = k.과세표준; o.납부세액 = k.납부할세액 !== undefined ? k.납부할세액 : k.최종납부세액 !== undefined ? k.최종납부세액 : k.납부세액; } } catch (er) { /* 엔진 오류는 납부세액 비움 */ } }
      } else o.납부세액 = 0;
      return o;
    }).filter(Boolean);
  };
  const 증여법 = 증여셈(null), 증여대안 = 증여셈(증여대안빼기);
  const 증여합 = function (xs) { return xs.every(function (x) { return x.납부세액 !== undefined; }) ? xs.reduce(function (s, x) { return s + x.납부세액; }, 0) : undefined; };
  // 상속세 — 상속기본이 있으면 보험금을 더해 엔진으로
  const 기본 = p.상속기본 && typeof p.상속기본 === 'object' ? p.상속기본 : null;
  const 상속칸 = function (더함, 세대, 수유) {
    const o = { deemedInsuranceAmount: 더함, netFinancialAssetsAdd: 더함 };
    if (!기본) return o;
    const b = Object.assign({}, 기본);
    b.taxableEstateAmount = (Number(b.taxableEstateAmount) || 0) + 더함;
    b.grossEstateValue = (Number(b.grossEstateValue) || Number(기본.taxableEstateAmount) || 0) + 더함;
    b.netFinancialAssets = (Number(b.netFinancialAssets) || 0) + 더함;
    if (세대 > 0) { const 앞 = (Number(기본.generationSkipHeirRatio) || 0) * (Number(기본.grossEstateValue) || Number(기본.taxableEstateAmount) || 0); b.generationSkipHeirRatio = Math.min(1, (앞 + 세대) / b.grossEstateValue); }
    if (수유) b.nonHeirBequestAmount = (Number(b.nonHeirBequestAmount) || 0) + 수유;
    return b;
  };
  const 상속셈 = function (b) {
    if (!기본 || !eng || typeof eng.calculateInheritanceTaxJS !== 'function') return undefined;
    try { const k = eng.calculateInheritanceTaxJS(b); if (!k || k.error) return undefined; return { 과세표준: k.과세표준, 금융재산공제: k.금융재산공제 || k.금융재산상속공제, 납부세액: k.납부할세액 !== undefined ? k.납부할세액 : k.자진납부할세액 !== undefined ? k.자진납부할세액 : k.산출세액 }; } catch (er) { return undefined; }
  };
  const 경우 = [];
  const 넣기 = function (이름, 더함, 세대, 수유, 증여) {
    const 칸 = 상속칸(더함, 세대, 수유), 상 = 상속셈(칸), 증 = 증여합(증여);
    경우.push({ 이름: 이름, 상속재산으로보는보험금: 더함, 상속세: 상 ? 상.납부세액 : undefined, 증여세: 증, 합계: 상 && 증 !== undefined ? 상.납부세액 + 증 : undefined, 상속엔진칸: 칸, 증여: 증여 });
  };
  넣기('① 법대로(낸 사람별로 나눔 — 피상속인 몫 상속, 남이 낸 몫 증여, 수령인 소득 몫 과세 안 함)', 간주, 세대생략, 0, 증여법);
  if (간주대안추가) 넣기('② 피상속인이 준 돈으로 낸 보험료를 「피상속인이 실질적으로 냄」(§8②)으로 봄 [판단 대기 — 판단거리3차 #42: 같음]', 간주 + 간주대안추가, 세대생략, 0, 증여대안);
  if (수유자보험) 넣기('③ 상속인 아닌 수령인의 보험금을 상속공제 한도에서 뺌(§24①1호 「유증등」에 넣음) [판단 대기 — 판단거리3차 #43: 문언상 유증등 아님 — ①한도 차감 안 함(문언) ②실질상 차감(국세청 해석 가능성) — 권장 ① 두 경우 유지]', 간주, 세대생략, 수유자보험, 증여법);
  const 총보험금 = 표.reduce(function (s, r) { return s + (/피상속인/.test(r.수익자) ? 0 : 0) + (r.갈래.some(function (g) { return /§8|§7/.test(g.근거); }) ? r.보험금 : 0); }, 0);
  넣기('[견주기] 보험금을 상속재산에 아예 안 넣음', 0, 0, 0, 증여법);
  if (총보험금 !== 간주) 넣기('[견주기] 피상속인이 피보험자인 보험금을 낸 사람 안 가리고 모두 상속재산', 총보험금, 세대생략, 0, 증여셈(증여들.map(function (g, i) { return 표.some(function (r) { return r.계약 === g.계약 && r.갈래.some(function (x) { return /§8|§7/.test(x.근거); }); }) ? i : -1; }).filter(function (i) { return i >= 0; })));
  // 요건 줄
  reqs.push(jmReq_('상속재산으로 보는 보험금 = 피상속인이 낸 보험료 몫만', true, '계약마다 보험금 × 피상속인이 낸 보험료 ÷ 총 보험료 → ' + won(간주), '상증법 §8·시행령 §4①'));
  if (증여들.length) reqs.push(jmReq_('남이 낸 보험료 몫은 낸 사람마다 따로 증여', true, 증여법.map(function (g) { return g.증여자 + '→' + g.수증자 + ' ' + won(g.증여재산가액) + '(' + g.호 + ')'; }).join(', '), '상증법 §34①'));
  if (간주대안추가) reqs.push(jmReq_('증여받은 돈으로 낸 보험료를 §34①2호로 봄', null, '돈 준 사람이 피상속인 — §8② 「실질적으로 냄」과 갈림 ' + won(간주대안추가), '상증법 §8②·§34①2호·②'));
  // 알림
  if (간주) 알림.push('상속재산으로 보는 보험금 ' + won(간주) + '은 금융재산 — 금융재산 상속공제(순금융재산 20%, 2억 한도) 바탕에 넣음(§22·시행령 §19①)');
  if (세대생략) 알림.push('피상속인의 자녀 아닌 직계비속(손자녀 등)이 받은 보험금 ' + won(세대생략) + ' — 세대를 건너뛴 할증 30%(미성년이 20억 넘게 받으면 40%) 비율에 넣음(§27, 대습상속이면 뺌)');
  if (수유자보험) 알림.push('상속인 아닌 사람이 받은 보험금 ' + won(수유자보험) + ' — 수유자로 상속세 납부의무(§3의2①)·연대납부(§3의2③) · 상속공제 한도(§24)에서 빼는지는 [판단 대기 — 판단거리3차 #44: 같음](경우 ③)');
  if (포기자보험) 알림.push('상속을 포기한 사람이 받은 보험금 ' + won(포기자보험) + ' — 보험금은 받는 사람 고유재산이라 포기해도 받지만, 세법은 상속재산으로 보고 포기한 사람도 상속인으로 보아(§2 4호) 받은 몫만큼 상속세를 냄');
  if (증여들.some(function (g) { return g.장애; })) 알림.push('장애인 수익자 보험금 비과세(§46 8호·시행령 §35⑥, 연 4천만원)는 증여(§34) 몫에만 — 상속재산으로 보는 보험금(§8)엔 이 비과세가 없음');
  else if ((p.계약들 || []).some(function (c) { return c && jmYn_(c.수익자장애인) === true; })) 알림.push('장애인 수익자 보험금 비과세(§46 8호, 연 4천만원)는 증여에만 — 상속재산으로 보는 보험금엔 적용 안 함(장애인공제 §20①은 따로)');
  if (증여들.length) 알림.push('보험금 증여의 증여일은 보험사고 날(사망·만기, §34①) — 신고기한은 그달 말일부터 3개월(§68①), 10년 합산(§47②)은 낸 사람(증여자)마다');
  if (개시) { const d = new Date(개시 + 'T00:00:00Z'); 알림.push('상속세 신고기한 ' + new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 7, 0)).toISOString().slice(0, 10) + '(상속개시일이 속한 달 말일부터 6개월, §67①)'); }
  알림.push('배우자가 받은 보험금이 배우자 상속공제의 「실제 상속받은 금액」에 드는지 [판단 대기 — 판단거리3차 #45: 간주상속재산도 상속으로 얻은 재산 — 포함 권장] — 배우자 몫 계산(§19①·시행령 §17)은 따로 맞춰 봄');
  알림.push('보험금은 수령인 고유 권리 — 상속재산 분할 대상은 아니지만 상속세는 수령인이 받은 몫 비율로 나눠 냄(§3의2①·시행령 §3)');
  할일.push({ 무엇: '보험사별 계약 조회(계약자·피보험자·수익자)·보험금 지급 명세·납입 내역(누가 어느 통장에서 냈는지)', 때: '신고 전', 근거: '시행령 §4①·상증법 §34①' });
  const r = jmWrap_('보험금과세', reqs, { 계약표: 표, 상속재산으로보는보험금: 간주, 세대생략보험금: 세대생략, 수유자보험금: 수유자보험, 증여: 증여법, 증여세합계: 증여합(증여법), 엔진칸: 경우[0].상속엔진칸, 경우: 경우, 알림: 알림, 할일: 할일 });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}

// [2026.11.04] 대여금 채권 평가 — 피상속인(증여자)이 남에게 빌려준 돈을 상속(증여)재산으로 얼마로 넣는지 가른다(사건 144 「채씨」).
//  상증법 §60①·③ 시가 원칙, 시가가 없으면 보충적 평가 — 시행령 §58②: 대부금·외상매출금·받을어음 등 채권가액은 기획재정부령으로 정하는 방법,
//  평가기준일 현재 회수불가능한 것으로 인정되는 부분은 넣지 않음(단서). 시행규칙 §18의2②: 1호 원본 회수기간 5년 초과 또는 회사정리·화의 등으로
//  채권 내용이 바뀌면 각 연도 회수금액(원본+이자)을 적정할인율로 할인한 현재가치 합계 / 2호 그 밖에는 원본 + 평가기준일까지 미수이자.
//  시행규칙 §18의3: 적정할인율 연 8%. 대여금은 금융회사 채권이 아니어서 금융재산상속공제(§22·시행령 §19①)에 넣지 않는다.
function judgeLoanReceivable_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  let 잠정 = false;
  const 기준 = jmYmd_(p.평가기준일 || p.상속개시일 || p.증여일);
  const 할인율 = 0.08;
  const 일수 = function (a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); };
  const 더해 = function (d, y) { const x = new Date(d + 'T00:00:00Z'); return new Date(Date.UTC(x.getUTCFullYear() + y, x.getUTCMonth(), x.getUTCDate())).toISOString().slice(0, 10); };
  const 가족 = /배우자|자녀|아들|딸|부모|형제|자매|손자|사위|며느리|친족|상속인/;
  if (!기준) { 잠정 = true; 알림.push('평가기준일(상속개시일·증여일)을 모름 — 미수이자·회수기간을 셀 수 없음'); }
  reqs.push(jmReq_('평가기준일', 기준 ? true : null, 기준 ? 기준 : '모름', '상증법 §60①'));
  let 합법 = 0, 합원본 = 0, 합불능빼기 = 0, 무증빙원본 = 0, 가족무이자 = 0;
  (p.채권들 || []).forEach(function (c, ci) {
    if (!c) return;
    const 이름 = c.이름 || ('채권 ' + (ci + 1));
    const 원본 = n(c.원본);
    const 율 = Math.max(0, Number(c.약정이자율) || 0) / (Number(c.약정이자율) > 1 ? 100 : 1);
    const 관계 = String(c.관계 || '').trim();
    const 대여일 = jmYmd_(c.대여일);
    const 만기 = jmYmd_(c.만기일);
    const 마지막 = jmYmd_(c.마지막이자일) || 대여일;
    const 변경 = jmYn_(c.채권내용변경) === true;
    const 무기한 = jmYn_(c.기간없음) === true || /입회금|보증금/.test(String(c.종류 || ''));
    const 불능 = String(c.회수불능사유 || '').trim();
    const 증빙 = jmYn_(c.회수불능증빙);
    const 차용증 = jmYn_(c.차용증);
    const o = { 채권: 이름, 채무자: c.채무자 || '', 관계: 관계, 원본: 원본 };
    if (!원본) { 잠정 = true; 할일.push({ 무엇: 이름 + ' 원본 금액(차용증·이체 내역)', 때: '신고 전', 근거: '시행령 §58②' }); }
    합원본 += 원본;
    if (차용증 !== true && 가족.test(관계)) { 무증빙원본 += 원본; }
    if (율 === 0 && 가족.test(관계) && 원본 >= 100000000) 가족무이자 += 원본;
    // 0) 시가가 있으면 시가(§60① — 평가기간 안 채권 매매·경매·수용·감정 등으로 확인된 값), 보충적 평가는 시가가 없을 때만(§60③)
    const 시가 = n(c.시가);
    if (시가) {
      const 시가근거 = String(c.시가근거 || '').trim();
      o.방법 = '시가(상증법 §60①' + (시가근거 ? ' — ' + 시가근거 : '') + ')'; o.평가액 = 시가;
      if (!시가근거) { 잠정 = true; 할일.push({ 무엇: 이름 + ' 시가로 본 값의 근거(평가기간 안 채권 매매계약·경락·감정서 등)', 때: '신고 전', 근거: '상증법 §60①·시행령 §49①' }); }
      합법 += 시가; 표.push(o);
      reqs.push(jmReq_(이름, 시가근거 ? true : null, o.방법 + ' ' + won(시가) + (시가근거 ? '' : ' — 근거 서류 받을 것(잠정)'), '상증법 §60①'));
      return;
    }
    // 1) 회수불능
    if (불능) {
      if (증빙 === true) { o.방법 = '회수불능(시행령 §58② 단서)'; o.평가액 = 0; o.근거 = 불능; 합불능빼기 += 원본; 표.push(o); reqs.push(jmReq_(이름 + ' 회수불능', true, 불능 + ' — 증빙 있음, 0원', '시행령 §58② 단서')); return; }
      잠정 = true;
      o.방법 = '회수불능 주장 — 증빙 없음, 잠정으로 넣음'; o.근거 = 불능;
      할일.push({ 무엇: 이름 + ' 회수불능 증빙(파산·회생 결정문, 강제집행 불능 조서, 행방불명·사망 확인, 소멸시효 완성 사실 등)', 때: '신고 전', 근거: '시행령 §58② 단서' });
      reqs.push(jmReq_(이름 + ' 회수불능', null, 불능 + ' — 증빙이 없어 넣어 둠(잠정)', '시행령 §58② 단서'));
      if (가족.test(관계)) 알림.push(이름 + ' 가족(' + 관계 + ')이 갚을 수 없다는 말만으로는 회수불능으로 보기 어려움 — 채무자 재산·소득 확인 [실사건 때 확인]');
    }
    // 2) 5년 초과·내용 변경 → 현재가치
    let 남은년 = null, 전체년 = null;
    if (기준 && 만기) 남은년 = 일수(기준, 만기) / 365;
    if (대여일 && 만기) 전체년 = 일수(대여일, 만기) / 365;
    const 오년 = 무기한 || (남은년 !== null && 남은년 > 5);
    const 갈림 = !무기한 && 남은년 !== null && 전체년 !== null && (남은년 > 5) !== (전체년 > 5);
    if (!만기 && !무기한 && !변경 && !Array.isArray(c.연도별회수)) { 잠정 = true; 알림.push(이름 + ' 만기(회수 약정일)를 모름 — 회수기간 5년 초과 여부를 못 가려 원본+미수이자로 셈(규칙 §18의2②2호)'); 할일.push({ 무엇: 이름 + ' 차용증의 상환 약정(만기·분할상환)', 때: '신고 전', 근거: '규칙 §18의2②' }); }
    if (갈림) { 잠정 = true; 알림.push(이름 + ' 처음 약정은 ' + 전체년.toFixed(1) + '년, 평가기준일부터 남은 기간은 ' + 남은년.toFixed(1) + '년 — 「원본의 회수기간 5년 초과」를 어느 쪽으로 재는지 [확인 필요 — 권장: 평가기준일부터 남은 회수기간(지금) 권장 — 약정 전체 기간 해석도 가능](지금은 남은 기간으로 셈)'); }
    if (오년 || 변경) {
      let 회수 = Array.isArray(c.연도별회수) && c.연도별회수.length ? c.연도별회수.map(function (x) { return { 날짜: jmYmd_(x.날짜), 금액: n(x.금액) }; }) : null;
      const 끝 = 만기 || (기준 ? 더해(기준, 5) : '');
      if (!회수 && 기준 && 끝) {
        회수 = [];
        for (let y = 1; ; y++) {
          const d = 더해(기준, y);
          if (d >= 끝) { 회수.push({ 날짜: 끝, 금액: 원본 + Math.round(원본 * 율 * Math.min(1, 일수(더해(기준, y - 1), 끝) / 365)) }); break; }
          if (율 > 0) 회수.push({ 날짜: d, 금액: Math.round(원본 * 율) });
          if (y > 60) break;
        }
      }
      if (회수 && 기준) {
        let pv = 0;
        const 줄 = 회수.map(function (x) { let k = 1; while (k < 100 && 더해(기준, k) < x.날짜) k++; const v = Math.round(x.금액 / Math.pow(1 + 할인율, k)); pv += v; return { 날짜: x.날짜, 회수: x.금액, 연차: k, 현재가치: v }; });
        o.방법 = (변경 ? '채권 내용 변경(회생·화의 등)' : 무기한 ? '회수기간 없음 — 5년으로 봄' : '회수기간 5년 초과') + ' → 연 8% 현재가치(규칙 §18의2②1호·§18의3)';
        o.회수표 = 줄; o.평가액 = pv;
        알림.push(이름 + ' 연차는 평가기준일부터 해마다 같은 날로 셈(1년 안 회수 = 1차년, 그 뒤 1년마다 1씩) — 해마다 할인하는 법은 [확인 필요 — 권장: 각 연도 회수액을 연 8%로 현재가치 — 연차는 평가기준일부터 1년 단위(지금) 권장]');
        if (무기한) 알림.push(이름 + ' 회수기간이 없는 시설이용권 입회금·보증금은 5년 뒤 회수로 봄(규칙 §18의2②1호 괄호)');
      } else { 잠정 = true; o.방법 = '현재가치 셈에 필요한 날짜가 없음 — 원본으로 넣음(잠정)'; o.평가액 = 원본; }
    } else {
      let 미수 = c.미수이자 !== undefined && c.미수이자 !== '' ? n(c.미수이자) : null;
      if (미수 === null) {
        if (율 > 0 && 기준 && 마지막) 미수 = Math.round(원본 * 율 * Math.max(0, 일수(마지막, 기준)) / 365);
        else if (율 > 0) { 미수 = 0; 잠정 = true; 알림.push(이름 + ' 이자를 언제까지 받았는지 모름 — 미수이자 0으로 둠(잠정)'); }
        else 미수 = 0;
      }
      o.방법 = '원본 + 평가기준일까지 미수이자(규칙 §18의2②2호)'; o.미수이자 = 미수; o.평가액 = 원본 + 미수;
    }
    합법 += o.평가액 || 0;
    표.push(o);
    reqs.push(jmReq_(이름, o.평가액 !== undefined ? true : null, o.방법 + ' ' + won(o.평가액), o.방법.indexOf('1호') >= 0 ? '규칙 §18의2②1호' : '규칙 §18의2②2호'));
  });
  if (!(p.채권들 || []).length) { 잠정 = true; 알림.push('채권 목록이 비어 있음 — 피상속인 통장에서 남에게 보낸 큰돈·차용증을 먼저 찾음'); }
  if (가족무이자) 알림.push('가족에게 이자 없이(또는 낮게) 빌려준 원본 ' + won(가족무이자) + ' — 빌린 사람은 금전무상대출 이익(§41의4, 적정이자율 연 4.6%와 차이, 1년 1천만원 이상) 증여세를 따로 봄');
  if (무증빙원본) 알림.push('차용증·이자 받은 기록 없이 가족에게 건넨 ' + won(무증빙원본) + ' — 빌려준 돈이 아니라 증여로 보일 수 있음: 상속인이면 10년 안 사전증여(§13①1호)로 더하고 증여세·가산세가 따로 생김 [실사건 때 확인](경우 ③)');
  if (표.some(function (o) { return /상속인|자녀|아들|딸|배우자/.test(o.관계); })) 알림.push('상속인이 채무자인 채권도 상속재산 — 그 상속인이 받으면 채권·채무가 섞여 없어지지만(민법 §507) 상속세 과세가액엔 넣음, 분할 협의에서 그 상속인 몫으로 셈');
  알림.push('대여금은 금융회사 채권이 아니어서 금융재산상속공제(§22·시행령 §19①)에 넣지 않음 · 받은 이자는 피상속인 비영업대금 이익(소득세법 §16①11호, 원천 25%) — 사망 전까지 종합소득세 신고했는지 확인');
  할일.push({ 무엇: '피상속인 계좌 10년치에서 남에게 보낸 큰돈·받은 이자 흐름, 차용증·공증·소송 서류', 때: '신고 전', 근거: '시행령 §58②·상증법 §15' });
  // 상속세 셈
  const 기본 = p.상속기본 && typeof p.상속기본 === 'object' ? p.상속기본 : null;
  let eng = null;
  try { eng = typeof getUiCalcEngine_ === 'function' ? getUiCalcEngine_() : null; } catch (er) { eng = null; }
  const 상속칸 = function (더함, 증여로) {
    const o = { loanReceivableAmount: 더함 };
    if (!기본) return o;
    const b = Object.assign({}, 기본);
    b.taxableEstateAmount = (Number(b.taxableEstateAmount) || 0) + 더함 + (증여로 || 0);
    b.grossEstateValue = (Number(b.grossEstateValue) || Number(기본.taxableEstateAmount) || 0) + 더함;
    if (증여로) b.priorGiftedAmountIncludedInEstate = (Number(b.priorGiftedAmountIncludedInEstate) || 0) + 증여로;
    return b;
  };
  const 상속셈 = function (b) {
    if (!기본 || !eng || typeof eng.calculateInheritanceTaxJS !== 'function') return undefined;
    try { const k = eng.calculateInheritanceTaxJS(b); if (!k || k.error) return undefined; return { 과세표준: k.과세표준, 납부세액: k.납부할세액 !== undefined ? k.납부할세액 : k.자진납부할세액 !== undefined ? k.자진납부할세액 : k.산출세액 }; } catch (er) { return undefined; }
  };
  const 경우 = [];
  const 넣기 = function (이름, 더함, 증여로) { const 칸 = 상속칸(더함, 증여로), 상 = 상속셈(칸); 경우.push({ 이름: 이름, 채권평가액: 더함, 사전증여로: 증여로 || 0, 과세표준: 상 ? 상.과세표준 : undefined, 상속세: 상 ? 상.납부세액 : undefined, 상속엔진칸: 칸 }); };
  넣기('① 법대로(규칙 §18의2② · 회수불능은 증빙 있는 것만 뺌)', 합법);
  넣기('② [견주기] 원본 그대로(현재가치·회수불능 안 봄)', 합원본);
  if (무증빙원본) {
    const 남 = 표.reduce(function (s, o) { return s + (가족.test(o.관계) && !(p.채권들 || []).some(function (c) { return c && (c.이름 === o.채권) && jmYn_(c.차용증) === true; }) ? 0 : (o.평가액 || 0)); }, 0);
    넣기('③ [실사건 때 확인] 차용증 없는 가족 몫을 사전증여로 봄(§13①1호, 증여세·가산세 따로)', 남, 무증빙원본);
  }
  if (기준 && p.상속개시일) { const d = new Date(기준 + 'T00:00:00Z'); 알림.push('상속세 신고기한 ' + new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 7, 0)).toISOString().slice(0, 10) + '(상속개시일이 속한 달 말일부터 6개월, §67①)'); }
  const r = jmWrap_('대여금채권', reqs, { 평가기준일: 기준, 채권표: 표, 채권평가액: 합법, 원본합계: 합원본, 회수불능으로뺀원본: 합불능빼기, 엔진칸: 경우[0].상속엔진칸, 경우: 경우, 알림: 알림, 할일: 할일 });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}
// [2026.11.04] 사망으로 받는 퇴직금·유족연금 가르기 — 피상속인의 사망으로 회사·연금공단 등이 주는 돈이 상속재산인지 가른다(사건 145 「서씨」).
//  상증법 §10 본문: 피상속인에게 지급될 퇴직금·퇴직수당·공로금·연금 또는 이와 유사한 것이 사망으로 지급되면 상속재산으로 본다.
//  단서 1호 국민연금법 유족연금·사망으로 지급되는 반환일시금 / 2호 공무원연금법·공무원 재해보상법·사립학교교직원 연금법의 퇴직유족연금 등 열거 급여 /
//  3호 군인연금법·군인 재해보상법의 열거 급여 / 4호 산업재해보상보험법 유족보상연금·유족보상일시금·유족특별급여·진폐유족연금 /
//  5호 근로자의 업무상 사망으로 근로기준법 등을 준용해 사업자가 유족에게 주는 유족보상금·재해보상금과 유사한 것 /
//  6호 = 시행령 §6: 전직대통령예우에 관한 법률·별정우체국법의 유족연금·유족연금일시금·유족일시금.
//  열거에 없는 급여(예: 공무원연금 퇴직수당, 국민연금 사망일시금, 산재 장례비)는 본문으로 돌아가므로 법문대로면 상속재산 — 유족 고유 권리로 보는 해석이 있어 [확인 필요 — 권장: 법문대로면 본문(상속재산) — 유족 고유권리 해석은 예규·심판례, 권장 법문대로 넣고 잠정 표시].
function judgeRetirementDeathPay_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [], 표 = [];
  let 잠정 = false;
  const 개시 = jmYmd_(p.상속개시일);
  // 단서 각 호의 열거 이름(법문 그대로)
  const 열거 = [
    { 호: '1호', 법: /국민연금/, 이름: ['유족연금', '반환일시금'] },
    { 호: '2호', 법: /공무원연금|공무원\s*재해보상|사립학교|사학연금/, 이름: ['퇴직유족연금', '장해유족연금', '순직유족연금', '직무상유족연금', '위험직무순직유족연금', '퇴직유족연금부가금', '퇴직유족연금일시금', '퇴직유족일시금', '순직유족보상금', '직무상유족보상금', '위험직무순직유족보상금'] },
    { 호: '3호', 법: /군인연금|군인\s*재해보상/, 이름: ['퇴역유족연금', '상이유족연금', '순직유족연금', '퇴역유족연금부가금', '퇴역유족연금일시금', '순직유족연금일시금', '퇴직유족일시금', '장애보상금', '사망보상금'] },
    { 호: '4호', 법: /산업재해|산재/, 이름: ['유족보상연금', '유족보상일시금', '유족특별급여', '진폐유족연금'] },
    { 호: '6호(시행령 §6)', 법: /전직대통령|별정우체국/, 이름: ['유족연금', '유족연금일시금', '유족일시금'] }
  ];
  const 붙임 = function (s) { return String(s || '').replace(/\s+/g, ''); };
  if (!개시) { 잠정 = true; 알림.push('상속개시일을 모름 — 신고기한을 셀 수 없음'); }
  reqs.push(jmReq_('상속개시일', 개시 ? true : null, 개시 || '모름', '상증법 §10'));
  let 넣음 = 0, 뺌 = 0, 모름합 = 0, 전부 = 0, 포기자몫 = 0, 연금형 = 0;
  (p.지급들 || []).forEach(function (x, i) {
    if (!x) return;
    const 이름 = x.이름 || ('지급 ' + (i + 1));
    const 금액명목 = n(x.금액);
    const 정기금 = n(x.정기금평가액);
    const 연금 = jmYn_(x.연금형) === true;
    const 금액 = 연금 && 정기금 ? 정기금 : 금액명목;
    const 법 = String(x.지급근거법 || '').trim();
    const 명칭 = 붙임(x.명칭 || x.이름);
    const 업무상 = jmYn_(x.업무상사망);
    const o = { 지급: 이름, 지급근거법: 법 || '모름', 명칭: x.명칭 || '', 받는사람: x.받는사람 || '', 금액: 금액 };
    전부 += 금액;
    if (!금액명목) { 잠정 = true; 할일.push({ 무엇: 이름 + ' 지급 금액(지급 통지서·통장)', 때: '신고 전', 근거: '상증법 §10' }); }
    if (연금 && !정기금) { 잠정 = true; 연금형 += 금액명목; 알림.push(이름 + ' 연금으로 받는데 정기금 평가액이 없어 넣은 금액 그대로 셈 — 상속재산이면 정기금을 받을 권리로 평가(§65①·시행령 §62, 정기금 평가 도구)'); }
    let 판정 = null, 왜 = '', 근거 = '상증법 §10 본문';
    if (/조의금|부의금|조위금/.test(명칭)) { 판정 = false; 왜 = '조문객이 유족에게 주는 돈 — 피상속인에게 지급될 돈이 아님(§10 밖)'; 근거 = '상증법 §10 본문'; }
    else {
      const 호 = 열거.filter(function (e) { return e.법.test(법); })[0];
      if (호) {
        const 맞음 = 호.이름.filter(function (m) { return 명칭.indexOf(m) >= 0; }).sort(function (a, b) { return b.length - a.length; })[0];
        if (맞음) { 판정 = false; 왜 = 법 + ' ' + 맞음 + ' — 단서 ' + 호.호 + ' 열거'; 근거 = '상증법 §10 ' + 호.호; }
        else if (!명칭) { 판정 = null; 왜 = 법 + ' 급여 이름을 모름 — 단서 열거인지 못 가림'; }
        else {
          판정 = true; 왜 = 법 + ' 「' + (x.명칭 || x.이름) + '」은 단서 ' + 호.호 + ' 열거에 없음 — 본문대로 상속재산';
          if (/사망일시금|퇴직수당|장례|장의|장제/.test(명칭)) { 잠정 = true; 왜 += ' [확인 필요 — 권장: 같음]'; 할일.push({ 무엇: 이름 + ' 상속재산 포함 여부 — 예규·심판례 확인(열거에 없는 급여)', 때: '신고 전', 근거: '상증법 §10 단서' }); }
        }
      } else if (/근로기준|회사|사업자|단체협약|취업규칙|회사규정/.test(법) || (x.명칭 && /유족보상|재해보상|위로금|공로금|퇴직금|퇴직수당|퇴직연금/.test(명칭))) {
        if (/유족보상|재해보상/.test(명칭) || (/위로금/.test(명칭) && 업무상 === true)) {
          if (업무상 === true) { 판정 = false; 왜 = '근로자의 업무상 사망으로 사업자가 유족에게 주는 유족보상금·재해보상금(또는 유사한 것) — 단서 5호'; 근거 = '상증법 §10 5호'; }
          else if (업무상 === null) { 판정 = null; 왜 = '유족보상·재해보상인데 업무상 사망인지 모름 — 5호는 업무상 사망만'; 할일.push({ 무엇: 이름 + ' 업무상 사망 인정 서류(산재 승인·회사 재해 확인)', 때: '신고 전', 근거: '상증법 §10 5호' }); }
          else { 판정 = true; 왜 = '업무 밖 사망에 회사가 준 보상·위로금 — 5호(업무상 사망) 아님, 본문 「이와 유사한 것」'; }
        } else { 판정 = true; 왜 = '피상속인에게 지급될 퇴직금·퇴직수당·공로금·연금 또는 유사한 것이 사망으로 지급됨'; }
        if (/퇴직연금|DC|IRP|개인형/.test(명칭)) { 왜 += ' · 확정기여형·개인형 퇴직연금 적립금은 피상속인 계좌 자산(본래 상속재산)으로 볼 수도 있음 [확인 필요 — 권장: 본래 상속재산이든 간주상속재산이든 과세가액은 같음 — 금융재산공제 판정만 갈림(8637)]'; }
      } else { 판정 = null; 왜 = '지급 근거(어느 법·회사 규정)를 모름'; 할일.push({ 무엇: 이름 + ' 지급 근거(지급 결정 통지서의 법 이름·급여 이름)', 때: '신고 전', 근거: '상증법 §10' }); }
    }
    if (판정 === null) { 잠정 = true; 모름합 += 금액; }
    if (판정 === true) 넣음 += 금액; else if (판정 === false) 뺌 += 금액;
    o.판정 = 판정 === true ? '상속재산' : 판정 === false ? '상속재산 아님' : '모름(잠정 — 넣어 둠)';
    o.왜 = 왜; o.근거 = 근거;
    if (판정 !== false && jmYn_(x.상속포기) === true) 포기자몫 += 금액;
    표.push(o);
    reqs.push(jmReq_(이름, 판정, 왜 + ' ' + won(금액), 근거));
  });
  if (!(p.지급들 || []).length) { 잠정 = true; 알림.push('지급 목록이 비어 있음 — 회사 퇴직금·연금공단 유족급여·단체보험 통지서를 먼저 모음'); }
  const 법대로 = 넣음 + 모름합;
  if (포기자몫) 알림.push('상속을 포기한 사람이 받는 상속재산 몫 ' + won(포기자몫) + ' — 포기해도 간주상속재산은 받을 수 있고 받은 재산 한도로 상속세 납부의무(§3의2①·③, 민법 §1019 포기와 별개)');
  if (모름합) 알림.push('근거·이름을 모르는 ' + won(모름합) + '은 넣어 두었음(잠정) — 열거 급여로 확인되면 빼기');
  알림.push('상속재산으로 보는 퇴직금은 금융회사 취급 금융재산인지 따로 봄 — 금융재산상속공제(§22·시행령 §19①)에 넣는지 (원문 확인 2026-11-04: 상증령 §19①)');
  알림.push('사망 퇴직금에 원천징수된 퇴직소득세는 피상속인의 소득세 — 상속개시일 현재 납부의무가 있던 공과금(§14①1호·시행령 §9①)으로 뺄 수 있는지 [확인 필요 — 권장: 퇴직소득 귀속이 사망일이라 사망일 현재 납부의무 성립 — 공제 포함 권장]');
  알림.push('조의금(부의금)은 상속재산이 아니고, 장례비 공제(§14①2호, 500만~1,000만원·봉안 500만원)와 따로 셈');
  할일.push({ 무엇: '회사 퇴직금 지급 명세·연금공단 급여 결정 통지서(급여 이름이 적힌 것)·산재 승인 통지', 때: '신고 전', 근거: '상증법 §10' });
  // 상속세 셈
  const 기본 = p.상속기본 && typeof p.상속기본 === 'object' ? p.상속기본 : null;
  let eng = null;
  try { eng = typeof getUiCalcEngine_ === 'function' ? getUiCalcEngine_() : null; } catch (er) { eng = null; }
  const 상속칸 = function (더함) {
    const o = { deemedRetirementAmount: 더함 };
    if (!기본) return o;
    const b = Object.assign({}, 기본);
    b.taxableEstateAmount = (Number(b.taxableEstateAmount) || 0) + 더함;
    b.grossEstateValue = (Number(b.grossEstateValue) || Number(기본.taxableEstateAmount) || 0) + 더함;
    return b;
  };
  const 상속셈 = function (b) {
    if (!기본 || !eng || typeof eng.calculateInheritanceTaxJS !== 'function') return undefined;
    try { const k = eng.calculateInheritanceTaxJS(b); if (!k || k.error) return undefined; return { 과세표준: k.과세표준, 납부세액: k.납부할세액 !== undefined ? k.납부할세액 : k.자진납부할세액 !== undefined ? k.자진납부할세액 : k.산출세액 }; } catch (er) { return undefined; }
  };
  const 경우 = [];
  const 넣기 = function (이름, 더함) { const 칸 = 상속칸(더함), 상 = 상속셈(칸); 경우.push({ 이름: 이름, 상속재산으로: 더함, 과세표준: 상 ? 상.과세표준 : undefined, 상속세: 상 ? 상.납부세액 : undefined, 상속엔진칸: 칸 }); };
  넣기('① 법대로(§10 본문 넣고 단서 열거만 뺌, 모르는 것은 넣어 둠)', 법대로);
  넣기('② [견주기] 받은 돈 모두 넣음', 전부);
  넣기('③ [견주기] 받은 돈 모두 뺌(유족 돈이라고 봄)', 0);
  if (모름합) 넣기('④ 모르는 것이 열거 급여로 확인되면', 넣음);
  if (개시) { const d = new Date(개시 + 'T00:00:00Z'); 알림.push('상속세 신고기한 ' + new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 7, 0)).toISOString().slice(0, 10) + '(상속개시일이 속한 달 말일부터 6개월, §67①)'); }
  const r = jmWrap_('사망퇴직금', reqs, { 상속개시일: 개시, 지급표: 표, 상속재산으로보는금액: 법대로, 뺀금액: 뺌, 모르는금액: 모름합, 받은돈합계: 전부, 엔진칸: 경우[0].상속엔진칸, 경우: 경우, 알림: 알림, 할일: 할일 });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}
// [2026.11.04] 교차증여 가르기 — 형제·친척이 서로의 자녀에게 맞바꿔 증여해 공제·누진세율을 피한 것을 실질대로 다시 짤지 가른다(사건 146 「강씨 형제」).
//  국세기본법 §14③: 제3자를 통한 간접적인 방법이나 둘 이상의 행위·거래를 거치는 방법으로 세법의 혜택을 부당하게 받기 위한 것으로 인정되면
//  경제적 실질에 따라 당사자가 직접 거래한 것으로 보거나 연속된 하나의 거래로 보아 세법을 적용한다.
//  상증법 §47②: 10년 안 동일인(직계존속이면 그 배우자 포함)에게서 받은 증여는 합산 / §53: 직계존속 5천만(미성년 2천만)·4촌 이내 혈족 등 1천만 /
//  §57①: 자녀 아닌 직계비속이면 30% 할증(최근친 직계비속 사망 예외).
//  교차증여를 실질 증여자로 다시 짠 대법원 판결(2017.2.15. 선고 2015두46963)이 있다고 알려져 있음 — 판결 원문 미확인 [판단 대기 — 판단거리3차 #46: 유지].
//  p: { 증여들:[{ 이름, 증여자, 수증자, 관계(형식상 증여자와 수증자: 직계존속|직계비속|배우자|기타친족|기타), 증여일, 금액, 미성년, 세대생략,
//                 실질증여자(다시 짜면 누가 준 것인지), 실질관계(그 사람과 수증자), 실질세대생략 }],
//       정황:{ 같은때(예/아니오), 금액비슷, 서로약속(합의·문자 등), 자금맞바꿈(돈이 오가며 서로 갚음), 다른이유(사업상 이유 등 — 있으면 '예') },
//       앞선증여들:[{ 증여자, 수증자, 증여일, 금액, 과세표준, 낸세액 }], 신고함(예/아니오) }
function judgeCrossGift_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [];
  let 잠정 = false;
  const 관계들 = ['배우자', '직계존속', '직계비속', '기타친족', '기타'];
  const 증여 = (p.증여들 || []).filter(Boolean).map(function (g, i) {
    return { 이름: g.이름 || ('증여 ' + (i + 1)), 증여자: String(g.증여자 || '').trim(), 수증자: String(g.수증자 || '').trim(),
      관계: 관계들.indexOf(g.관계) >= 0 ? g.관계 : '', 증여일: jmYmd_(g.증여일), 금액: n(g.금액), 미성년: jmYn_(g.미성년) === true,
      세대생략: jmYn_(g.세대생략) === true, 실질증여자: String(g.실질증여자 || '').trim(), 실질관계: 관계들.indexOf(g.실질관계) >= 0 ? g.실질관계 : '',
      실질세대생략: jmYn_(g.실질세대생략) === true };
  });
  if (!증여.length) return jmWrap_('교차증여', [jmReq_('증여들', null, '증여 목록이 없음', '국세기본법 §14③')], { 알림: ['증여마다 증여자·수증자·관계·날짜·금액, 다시 짜면 누가 준 것인지(실질증여자)를 넣어 주세요'], 할일: [] });
  증여.forEach(function (g) {
    if (!g.관계) { 잠정 = true; 알림.push(g.이름 + ': 형식상 관계를 모름 — 공제를 셀 수 없음'); }
    if (!g.증여일 || !g.금액) { 잠정 = true; 알림.push(g.이름 + ': 날짜·금액을 모름'); }
  });
  // 짝 찾기 — 형식상 증여자 → 실질증여자를 이어 돌아오는 고리(둘이면 A↔B, 셋 이상이면 A→B→C→A 돌려 주기)
  const 짝 = [], 쓴 = {};
  증여.forEach(function (g0) {
    if (쓴[g0.이름] || !g0.실질증여자 || g0.실질증여자 === g0.증여자) return;
    const 들 = [g0], 본 = {}; 본[g0.이름] = true;
    let cur = g0;
    while (cur.실질증여자 !== g0.증여자 && 들.length < 증여.length) {
      const nx = 증여.find(function (h) { return !쓴[h.이름] && !본[h.이름] && h.실질증여자 && h.증여자 === cur.실질증여자 && h.실질증여자 !== h.증여자; });
      if (!nx) { cur = null; break; }
      들.push(nx); 본[nx.이름] = true; cur = nx;
    }
    if (!cur || cur.실질증여자 !== g0.증여자 || 들.length < 2) return;
    들.forEach(function (g) { 쓴[g.이름] = true; });
    짝.push({ 가: 들[0], 나: 들[1], 들: 들, 이름: 들.length === 2 ? 들[0].이름 + ' ↔ ' + 들[1].이름 : 들.map(function (g) { return g.이름; }).join(' → ') + ' → (처음으로)' });
  });
  // 정황 — 판결이 본 요소(시기·대상·금액이 비슷, 서로 합의, 다른 이유 없음) [판단 대기 — 판단거리3차 #47: 같음]
  const 정 = p.정황 || {};
  const 날차 = function (x, y) { if (!x || !y) return null; return Math.abs((new Date(x) - new Date(y)) / 86400000); };
  const 정황표 = 짝.map(function (s) {
    const 날들 = s.들.map(function (g) { return g.증여일; }).filter(Boolean).sort(), 금들 = s.들.map(function (g) { return g.금액; }).filter(Boolean);
    const d = 날들.length === s.들.length ? 날차(날들[0], 날들[날들.length - 1]) : null;
    const 같은때 = jmYn_(정.같은때) !== null ? jmYn_(정.같은때) : (d === null ? null : d <= 90);
    const 비 = 금들.length === s.들.length ? Math.min.apply(null, 금들) / Math.max.apply(null, 금들) : null;
    const 금액비슷 = jmYn_(정.금액비슷) !== null ? jmYn_(정.금액비슷) : (비 === null ? null : 비 >= 0.8);
    const 약속 = jmYn_(정.서로약속), 맞바꿈 = jmYn_(정.자금맞바꿈), 다른이유 = jmYn_(정.다른이유);
    const 항목 = [['같은 때(90일 안)', 같은때, d === null ? '날짜 모름' : d + '일 차이'], ['금액 비슷(8할 이상)', 금액비슷, 비 === null ? '금액 모름' : Math.round(비 * 100) + '%'],
      ['서로 약속(합의·문자 등)', 약속, ''], ['돈이 서로 맞바뀜', 맞바꿈, '']];
    const 예 = 항목.filter(function (h) { return h[1] === true; }).length, 모 = 항목.filter(function (h) { return h[1] === null; }).length;
    let 판정;
    if (다른이유 === true) 판정 = '다시 짤 위험 낮음(다른 이유 있음 — 증빙 필요)';
    else if (예 >= 3 || (같은때 === true && 금액비슷 === true && (약속 === true || 맞바꿈 === true))) 판정 = '다시 짤 위험 높음';
    else if (예 >= 2 || 모 >= 2) { 판정 = '다시 짤 수 있음(잠정)'; 잠정 = true; }
    else 판정 = '다시 짤 위험 낮음';
    return { 짝: s.이름, 사람수: s.들.length, 항목: 항목.map(function (h) { return { 무엇: h[0], 맞음: h[1], 왜: h[2] }; }), 다른이유: 다른이유, 판정: 판정 };
  });
  reqs.push(jmReq_('맞바꾼 증여 짝', 짝.length ? true : false, 짝.length ? 짝.map(function (s) { return s.이름; }).join(' · ') : '실질증여자가 서로 엇갈리는 짝 없음', '국세기본법 §14③'));
  정황표.forEach(function (x) { reqs.push(jmReq_(x.짝 + ' 부당한 혜택 정황', /높음/.test(x.판정) ? true : /잠정/.test(x.판정) ? null : false, x.판정, '국세기본법 §14③ · 대법원 2015두46963 [판단 대기 — 판단거리3차 #48: 같음]')); });
  // 세액 — ① 형식대로 ② 실질대로 다시 짬
  let eng = null;
  try { eng = typeof getUiCalcEngine_ === 'function' ? getUiCalcEngine_() : null; } catch (er) { eng = null; }
  const 다시짬 = {};
  짝.forEach(function (s) { s.들.forEach(function (g) { 다시짬[g.이름] = true; }); });
  const 앞선 = (p.앞선증여들 || []).filter(Boolean).map(function (g) { return { 증여자: String(g.증여자 || '').trim(), 수증자: String(g.수증자 || '').trim(), 날: jmYmd_(g.증여일), 금액: n(g.금액), 과세표준: n(g.과세표준), 낸세액: n(g.낸세액) }; }).filter(function (g) { return g.날 && g.금액; });
  const 셈 = function (실질) {
    // 실질이면 짝 증여의 증여자·관계를 실질 쪽으로 바꿈, 같은 날 같은 사람끼리 묶음
    const 줄 = 증여.map(function (g) {
      const 바꿈 = 실질 && 다시짬[g.이름];
      return { 이름: g.이름, 증여자: 바꿈 ? g.실질증여자 : g.증여자, 수증자: g.수증자, 관계: 바꿈 ? (g.실질관계 || g.관계) : g.관계, 날: g.증여일, 금액: g.금액, 미성년: g.미성년, 세대생략: 바꿈 ? g.실질세대생략 : g.세대생략 };
    }).filter(function (x) { return x.날 && x.금액 && x.관계; });
    const 묶 = {};
    줄.forEach(function (x) { const k = x.수증자 + '|' + x.증여자 + '|' + x.날; (묶[k] = 묶[k] || { 수증자: x.수증자, 증여자: x.증여자, 날: x.날, 관계: x.관계, 미성년: x.미성년, 세대생략: x.세대생략, 금액: 0, 들: [] }); 묶[k].금액 += x.금액; 묶[k].들.push(x.이름); });
    const 지난 = 앞선.map(function (g) { return Object.assign({}, g); });
    const 결과 = Object.keys(묶).map(function (k) { return 묶[k]; }).sort(function (a, b) { return a.날 < b.날 ? -1 : a.날 > b.날 ? 1 : 0; }).map(function (m) {
      const 열 = famAddY_(m.날, -10);
      // 10년 합산 — 같은 증여자(직계존속이면 그 배우자도 같은 사람으로 봄은 넣은 이름이 같을 때만)
      const 합산 = 지난.filter(function (g) { return g.수증자 === m.수증자 && g.증여자 === m.증여자 && g.날 >= 열 && g.날 < m.날; });
      const 합산액 = 합산.reduce(function (s, g) { return s + g.금액; }, 0);
      const e = { giftAmount: m.금액, relation: m.관계, giftDate: m.날, isDoneeResident: true };
      if (m.미성년) e.isMinor = true;
      if (m.세대생략) e.isGenerationSkip = true;
      if (합산액 >= 10000000) {
        e.priorGiftAmount = 합산액;
        const t = 합산.reduce(function (s, g) { return s + g.낸세액; }, 0), b = 합산.reduce(function (s, g) { return s + g.과세표준; }, 0);
        if (t) e.priorPaidTax = t; if (b) e.priorGiftTaxableBase = b;
      }
      // 공제 한도 — 같은 수증자가 10년 안 같은 관계 묶음에서 이미 받은 공제
      const 같은묶음 = 지난.filter(function (g) { return g.수증자 === m.수증자 && g.관계 === m.관계 && g.증여자 !== m.증여자 && g.날 >= 열 && g.날 < m.날 && g.이번; });
      const 쓴공제 = 같은묶음.reduce(function (s, g) { return s + (g.공제 || 0); }, 0);
      if (쓴공제 && m.관계 === '직계존속') e.priorRelationDeductionUsedOther = 쓴공제;
      let k = null;
      if (eng && typeof eng.calculateGiftTaxJS === 'function') { try { k = eng.calculateGiftTaxJS(e); } catch (er) { k = null; } }
      const ok = k && !k.error;
      지난.push({ 증여자: m.증여자, 수증자: m.수증자, 날: m.날, 금액: m.금액, 관계: m.관계, 과세표준: ok ? Number(k.과세표준 || 0) : 0, 공제: ok ? Number(k.증여재산공제 || 0) : 0, 낸세액: ok ? Math.max(0, Number(k.산출세액_할증후 || k.산출세액 || 0) - Number(e.priorPaidTax || 0)) : 0, 이번: true });
      return { 수증자: m.수증자, 증여자: m.증여자, 관계: m.관계, 증여일: m.날, 금액: m.금액, 들어간증여: m.들, 합산: 합산액 >= 10000000 ? 합산액 : 0, 과세표준: ok ? k.과세표준 : undefined, 납부세액: ok ? Number(k.납부세액 || 0) : undefined, 엔진칸: e };
    });
    const 합 = 결과.every(function (x) { return x.납부세액 !== undefined; }) ? 결과.reduce(function (t, x) { return t + x.납부세액; }, 0) : undefined;
    return { 줄: 결과, 납부세액합계: 합 };
  };
  const 형식 = 셈(false), 실질 = 셈(true);
  const 경우 = [{ 이름: '① 형식대로(신고한 대로)', 줄: 형식.줄, 납부세액합계: 형식.납부세액합계 }];
  if (짝.length) 경우.push({ 이름: '② 실질대로 다시 짬(국세기본법 §14③)', 줄: 실질.줄, 납부세액합계: 실질.납부세액합계 });
  if (짝.length && 형식.납부세액합계 !== undefined && 실질.납부세액합계 !== undefined) {
    const 차 = 실질.납부세액합계 - 형식.납부세액합계;
    알림.push('다시 짜이면 증여세 본세가 ' + won(Math.abs(차)) + (차 >= 0 ? ' 늘어남' : ' 줄어듦') + '(' + won(형식.납부세액합계) + ' → ' + won(실질.납부세액합계) + ') — 가산세·납부지연 이자는 따로');
  }
  if (짝.length) {
    알림.push('다시 짜이면 각 수증자는 자기 부모에게 받은 것으로 보아 같은 증여자의 다른 증여와 10년 합산(§47②)·공제 한도(§53)·누진세율이 함께 걸림');
    알림.push('형식대로 낸 신고는 과소신고가 됨 — 과소신고 가산세(부정행위가 아니면 10%, 거짓 서류·약속을 숨기면 40% 다툼 소지, 국세기본법 §47의3) · 납부지연 가산세(§47의4) (원문 확인 2026-11-04: 국세기본법 §47의3①(일반 10%·부정 40%))');
    알림.push('제척기간: 다시 짜는 결정은 신고기한 다음 날부터 10년(부정행위·무신고면 15년, 국세기본법 §26의2④) (원문 확인 2026-11-04: 국세기본법 §26의2④)');
    알림.push('같은 결과가 날 정도로 시기·금액이 맞물리면 「서로 다른 이유(사업상 목적·각자 따로 한 결정)」를 보일 증빙이 없을 때 위험이 큼 — 판결 원문 대조 [판단 대기 — 판단거리3차 #49: 같음]');
    할일.push({ 무엇: '두 증여의 결정 경위 — 각자 따로 정했는지(날짜·대화·가족회의 기록)', 왜: '서로 약속했는지가 다시 짜기의 핵심 정황' });
    할일.push({ 무엇: '돈의 흐름 — 각 증여 재원과 받은 뒤 쓰임', 왜: '받은 돈이 다시 상대 집으로 가면 맞바꿈 정황' });
    할일.push({ 무엇: '두 집안의 다른 증여(10년 안)', 왜: '다시 짜면 합산되는 금액' });
  }
  증여.forEach(function (g) {
    if (g.관계 === '기타친족' && !다시짬[g.이름]) 알림.push(g.이름 + ': 4촌 이내 혈족·3촌 이내 인척이면 공제 1천만(§53 4호) — 짝이 되는 증여가 있는지 확인');
  });
  const r = jmWrap_('교차증여', reqs, { 증여표: 증여.map(function (g) { return { 이름: g.이름, 증여자: g.증여자, 수증자: g.수증자, 관계: g.관계, 증여일: g.증여일, 금액: g.금액, 실질증여자: g.실질증여자 || undefined, 다시짬: !!다시짬[g.이름] }; }),
    짝: 정황표, 경우: 경우, 엔진칸: 경우[경우.length - 1].줄.map(function (x) { return x.엔진칸; }), 엔진칸늘: true, 알림: 알림, 할일: 할일 });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}
// [2026.11.04] 자기주식 — 배우자·직계존비속에게 받은 주식을 회사가 사들일 때(자기주식 취득) 그 성격(소각 = 의제배당 / 그 밖 = 양도)과
//  실질로 다시 짤 위험을 가른다(사건 147 「노씨 부부 회사 주식」).
//  소득세법 §17②1호: 주식의 소각이나 자본의 감소로 받은 금전 등이 그 주식을 취득하기 위하여 사용한 금액을 넘는 금액은 의제배당 /
//   §17④: 취득에 사용한 금액이 분명하지 않으면 액면가액. 증여받은 주식의 「취득에 사용한 금액」을 증여재산가액으로 볼지는 원문에 없음 [판단 대기 — 판단거리3차 #50: 원문 없음 — 증여세 과세가액(증여재산가액)으로 보는 쪽 권장(불분명하면 액면 §17④)].
//  소득세법 §94①3호: 주식등의 양도는 양도소득 / §97의2①: 배우자·직계존비속에게 받은 §94①3호 주식을 증여일부터 1년 안 양도하면
//   취득가액을 증여자 취득가액으로(증여세 상당액은 필요경비, 시행령 §163의2②) / §97의2②3호: 이월과세 세액이 더 적으면 적용 안 함.
//  국세기본법 §14③: 둘 이상의 행위·거래를 거쳐 세법 혜택을 부당하게 받으면 경제적 실질에 따라 하나의 거래로 보아 과세 —
//   증여 뒤 곧 소각해 대금이 증여자에게 돌아가면 증여자가 직접 소각 대금을 받은 것으로(증여자 의제배당) 다시 짤 수 있음 — 판례 번호 미확인 [판단 대기 — 판단거리3차 #51: 유지].
//  p: { 회사:{ 이름, 중소기업, 상장(예/아니오) },
//       거래들:[{ 이름, 주주(받은 사람), 증여자, 관계(배우자|직계존속|직계비속|기타), 증여일, 주식수, 증여재산가액(증여 평가액 합계),
//                 증여세산출세액, 증여세과세가액, 증여자취득가액, 증여자취득일, 증여자사망일, 넘긴날(회사가 사들인 날), 받은돈,
//                 목적(소각|보유|재매각|모름), 액면가액(1주), 대주주(예/아니오), 돈흐름(받은 돈이 증여자에게 감: 예/아니오), 평가액(넘긴 날 1주 시가) }],
//       정황:{ 미리계획(증여 전에 소각을 정함: 예/아니오), 다른이유(소각 대금을 받은 사람이 따로 씀 등: 예/아니오) } }
function judgeTreasuryStock_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [], 경우 = [], 표 = [];
  let 잠정 = false;
  const 회 = p.회사 || {}, 정 = p.정황 || {};
  const 관계들 = ['배우자', '직계존속', '직계비속', '기타'];
  const 목적들 = ['소각', '보유', '재매각', '모름'];
  const 거래 = (p.거래들 || []).filter(Boolean).map(function (g, i) {
    return { 이름: g.이름 || ('거래 ' + (i + 1)), 주주: String(g.주주 || '').trim(), 증여자: String(g.증여자 || '').trim(),
      관계: 관계들.indexOf(g.관계) >= 0 ? g.관계 : '', 증여일: jmYmd_(g.증여일), 주식수: n(g.주식수), 증여가액: n(g.증여재산가액),
      증여세: n(g.증여세산출세액), 과세가액: n(g.증여세과세가액), 증여자취가: n(g.증여자취득가액), 증여자취일: jmYmd_(g.증여자취득일),
      증여자사망: jmYmd_(g.증여자사망일), 넘긴날: jmYmd_(g.넘긴날), 받은돈: n(g.받은돈), 목적: 목적들.indexOf(g.목적) >= 0 ? g.목적 : '모름',
      액면: n(g.액면가액), 대주주: jmYn_(g.대주주), 돈흐름: jmYn_(g.돈흐름), 평가액: n(g.평가액) };
  });
  if (!거래.length) return jmWrap_('자기주식', [jmReq_('거래들', null, '회사가 사들인 주식 목록이 없음', '소득세법 §17②1호·§94①3호')], { 알림: ['거래마다 받은 사람·증여자·관계·증여일·증여재산가액·회사에 넘긴 날·받은 돈·목적(소각/보유/재매각)을 넣어 주세요'], 할일: [] });
  const 일수 = function (a, b) { return (a && b) ? Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) : null; };
  const 한해안 = function (g) { return !!(g.증여일 && g.넘긴날 && g.넘긴날 <= famAddY_(g.증여일, 1)); };
  거래.forEach(function (g) {
    const 이월관계 = g.관계 === '배우자' || g.관계 === '직계존속' || g.관계 === '직계비속';
    const 날 = 일수(g.증여일, g.넘긴날);
    const 행 = { 이름: g.이름, 주주: g.주주, 증여자: g.증여자, 관계: g.관계 || '모름', 증여일: g.증여일, 넘긴날: g.넘긴날, 지난날수: 날, 받은돈: g.받은돈, 목적: g.목적 };
    if (!g.관계) { 잠정 = true; 알림.push(g.이름 + ': 증여자와의 관계를 모름 — 이월과세(§97의2①)·실질 위험을 가를 수 없음'); }
    if (!g.받은돈 || !g.넘긴날) { 잠정 = true; 알림.push(g.이름 + ': 회사에 넘긴 날·받은 돈을 모름'); }
    if (!g.증여가액) { 잠정 = true; 알림.push(g.이름 + ': 증여재산가액(증여 신고 평가액)을 모름 — 의제배당·양도차익을 셀 수 없음'); }
    // 1) 성격 — 소각이면 의제배당, 그 밖은 양도
    const 소각 = g.목적 === '소각', 양도 = g.목적 === '보유' || g.목적 === '재매각';
    if (g.목적 === '모름') { 잠정 = true; 알림.push(g.이름 + ': 회사가 소각하려고 샀는지(의제배당) 갖고 있거나 다시 팔려고 샀는지(양도) 모름 — 두 경우를 함께 셈'); }
    행.성격 = 소각 ? '의제배당(소득세법 §17②1호)' : 양도 ? '양도(§94①3호)' : '모름 — 두 경우';
    // 수증자 의제배당 — 취득에 사용한 금액 = 증여재산가액으로 봄 [판단 대기 — 판단거리3차 #52: 같음], 없으면 액면(§17④)
    const 취득사용 = g.증여가액 || (g.액면 && g.주식수 ? g.액면 * g.주식수 : 0);
    const 수증자배당 = Math.max(0, g.받은돈 - 취득사용);
    행.수증자의제배당 = 수증자배당;
    if (!g.증여가액 && 취득사용) 알림.push(g.이름 + ': 증여재산가액이 없어 취득에 쓴 돈을 액면가액(' + won(취득사용) + ')으로 봄(§17④) — 잠정');
    // 2) 양도로 보면 엔진 칸(이월과세 도구 — 1년·관계·§97의2②3호 비교를 엔진이 함)
    const sb = Object.assign({ assetCategory: 'domestic_stock',
      isDaejuju: g.대주주 === true || undefined, isSmallMediumCompany: jmYn_(회.중소기업) === true || undefined,
      transferPrice: g.받은돈 || undefined, transferDate: g.넘긴날 || undefined }, p.엔진칸 || {});
    const 양도칸 = 이월관계 ? Object.assign({}, sb, { giftReceivedDate: g.증여일 || undefined, donorRelation: g.관계 === '배우자' ? 'spouse' : 'lineal',
      donorAcquisitionPrice: g.증여자취가 || undefined, donorAcquisitionDate: g.증여자취일 || undefined, donorDeathDate: g.증여자사망 || undefined,
      doneeOwnAcquisitionPrice: g.증여가액 || undefined, giftTaxPaid: g.증여세 || 0, giftTaxableValue: g.과세가액 || g.증여가액 || undefined })
      : Object.assign({}, sb, { acquisitionPrice: g.증여가액 || undefined });
    const 양도엔진 = 이월관계 ? 'calculate_stock_transfer_tax_with_carryover' : 'calculate_stock_transfer_tax';
    if (소각 || g.목적 === '모름') {
      경우.push({ 이름: g.이름 + ' ' + (소각 ? '① 법대로' : '[모름] 소각이면') + ' — 받은 사람 ' + (g.주주 || '') + ' 의제배당 ' + won(수증자배당) + '(받은 돈 ' + won(g.받은돈) + ' − 취득에 쓴 돈 ' + won(취득사용) + ')',
        엔진: '', 엔진칸: null, 금액: 수증자배당, 소득: '배당소득(종합소득세 — 이 도구는 세액을 셈하지 않음)' });
    }
    if (양도 || g.목적 === '모름') {
      경우.push({ 이름: g.이름 + ' ' + (양도 ? '① 법대로' : '[모름] 소각이 아니면') + ' — 주식 양도' + (이월관계 && 한해안(g) ? '(1년 안 — 이월과세 견주기 §97의2①②3호)' : ''), 엔진: 양도엔진, 엔진칸: 양도칸 });
    }
    if (소각) {
      경우.push({ 이름: g.이름 + ' [견주기] 소각인데 양도로 신고하면', 엔진: 양도엔진, 엔진칸: 양도칸, 견주기: true });
      if (이월관계 && 한해안(g)) 알림.push(g.이름 + ': 소각은 양도가 아니라 의제배당이라 §97의2① 이월과세(양도소득 규정)가 바로 걸리지 않음 — 그래서 증여재산가액이 곧 취득에 쓴 돈이 되어 의제배당이 0에 가까워짐. 이 틈을 실질과세로 다시 짤 위험(아래)이 있음');
    }
    // 3) 실질로 다시 짤 위험 — 증여 뒤 곧 소각 + 돈이 증여자에게 감 / 미리 계획
    if (이월관계 && (소각 || g.목적 === '모름')) {
      const 짧음 = 날 != null && 날 <= 365, 돈감 = g.돈흐름 === true, 계획 = jmYn_(정.미리계획) === true, 다른 = jmYn_(정.다른이유) === true;
      const 점 = (짧음 ? 1 : 0) + (돈감 ? 2 : 0) + (계획 ? 2 : 0) - (다른 ? 2 : 0);
      const 판정 = 점 >= 3 ? '위험 높음' : 점 >= 1 ? '위험 있음' : (g.돈흐름 == null && jmYn_(정.미리계획) == null) ? '모름' : '위험 낮음';
      행.실질위험 = 판정;
      const 증여자배당 = Math.max(0, g.받은돈 - (g.증여자취가 || (g.액면 && g.주식수 ? g.액면 * g.주식수 : 0)));
      행.증여자의제배당 = 증여자배당;
      if (판정 !== '위험 낮음') {
        if (판정 === '모름') 잠정 = true;
        경우.push({ 이름: g.이름 + ' [' + 판정 + '] 실질로 다시 짜면 — 증여자 ' + (g.증여자 || '') + '가 직접 소각 대금을 받은 것: 의제배당 ' + won(증여자배당) + '(받은 돈 − 증여자 취득가액 ' + won(g.증여자취가) + '), 증여는 없던 것으로 [판단 대기 — 판단거리3차 #53: 같음]',
          엔진: '', 엔진칸: null, 금액: 증여자배당, 소득: '증여자 배당소득(종합소득세)', 위험: true });
        if (!g.증여자취가) { 잠정 = true; 알림.push(g.이름 + ': 증여자 취득가액을 모름 — 다시 짤 때 의제배당을 셀 수 없음(§17④ 액면)'); }
        알림.push(g.이름 + ': 증여 ' + (날 != null ? 날 + '일' : '?') + ' 뒤 회사가 사들임' + (돈감 ? '·받은 돈이 증여자에게 감' : '') + (계획 ? '·증여 전에 소각을 정함' : '') + ' — 국세기본법 §14③ 실질과세로 증여자 의제배당 ' + won(증여자배당) + '로 다시 짤 위험(' + 판정 + '). 차이 ' + won(Math.max(0, 증여자배당 - 수증자배당)) + '이 배당소득으로 늘어남 — 판례 원문 대조 [판단 대기 — 판단거리3차 #54: 같음]');
        할일.push({ 무엇: g.이름 + ' 소각 대금이 어디로 갔는지(받은 사람 통장 → 쓰임)', 왜: '증여자에게 돌아가면 실질 위험이 커짐' });
        할일.push({ 무엇: g.이름 + ' 증여와 소각을 언제 누가 정했는지(이사회·주총 의사록 날짜, 증여 계약일)', 왜: '미리 계획했는지가 핵심 정황' });
      }
    }
    // 4) 값 — 넘긴 값이 시가와 다르면
    if (g.평가액 && g.주식수 && g.받은돈) {
      const 시가 = g.평가액 * g.주식수, 차 = g.받은돈 - 시가;
      행.시가 = 시가;
      if (Math.abs(차) >= 시가 * 0.3 || Math.abs(차) >= 300000000) 알림.push(g.이름 + ': 회사가 낸 값(' + won(g.받은돈) + ')이 시가(' + won(시가) + ')와 ' + won(Math.abs(차)) + ' 차이 — 소각이면 다른 주주에게 감자 이익 증여(상증법 §39의2 — 기준금액 3억, 1주 차액이 평가액의 30% 이상이면 기준 0: 시행령 §29의2② 원문 확인 2026-11-04)·회사 쪽 부당행위(법인세법 §52, 범위 밖)');
      else if (차 !== 0) 알림.push(g.이름 + ': 회사가 낸 값이 시가와 ' + won(Math.abs(차)) + ' 차이 — 기준금액 밑(시행령 §29의2②: 이익 3억 미만이고 1주 차액이 평가액의 30% 미만)');
    } else if (g.받은돈) { 할일.push({ 무엇: g.이름 + ' 넘긴 날 1주 시가(비상장 평가)', 왜: '회사가 낸 값이 시가와 다르면 다른 주주 증여·부당행위 문제' }); }
    if (g.증여자사망 && g.넘긴날 && g.증여자사망 <= g.넘긴날) 알림.push(g.이름 + ': 증여자가 넘기기 전에 사망 — 양도 이월과세는 배제될 수 있음(§97의2①, 엔진이 봄)');
    표.push(행);
  });
  reqs.push(jmReq_('성격(소각 또는 양도) 확정', 거래.every(function (g) { return g.목적 !== '모름'; }) ? true : null, '이사회·주총 결의·자기주식 처분 기록으로 확인', '소득세법 §17②1호·§94①3호'));
  reqs.push(jmReq_('증여재산가액 확인', 거래.every(function (g) { return g.증여가액 > 0; }) ? true : null, '증여세 신고서·평가 근거', '소득세법 §17②1호(취득에 사용한 금액) [판단 대기 — 판단거리3차 #55: 같음]'));
  알림.push('의제배당은 종합소득세(배당소득, 금융소득 2천만원 넘으면 종합과세·Gross-up) — 이 도구는 세액을 셈하지 않음, 금액만 냄. 수입시기(감자 결의일 등)는 소득세법 시행령 원문 대조 (원문 확인 2026-11-04: 소득세법시행령 §46)');
  알림.push('배우자·직계존비속에게 받은 주식을 소각해 의제배당을 줄이는 것을 막는 개정(증여자 취득가액으로 보는 규정)이 있는지는 이 판정 기준일 법령에서 찾지 못함 — 시행일·부칙 (원문 확인 2026-11-04: 소득세법 §17·시행령 §27(현행 md) — 해당 규정 없음, §97의2①(양도 쪽 1년)만)');
  알림.push('회사 쪽: 자기주식 취득은 배당가능이익 한도·주총 결의 등 상법 절차(§341)를 지켜야 함 — 어기면 취득 무효·업무무관 가지급금 다툼 [실사건 때 확인]. 증권거래세는 범위 밖');
  할일.push({ 무엇: '자기주식 취득 결의 의사록·취득 공고·처분(소각) 결의', 왜: '소각 목적인지·상법 절차를 지켰는지' });
  할일.push({ 무엇: '증여세 신고서와 주식 평가 명세', 왜: '증여재산가액(취득에 쓴 돈)과 평가 방법' });
  const r = jmWrap_('자기주식', reqs, { 거래표: 표, 경우: 경우, 엔진칸: 경우.filter(function (x) { return x.엔진칸; }).map(function (x) { return x.엔진칸; }), 엔진칸늘: true, 알림: 알림, 할일: 할일 });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}
// [2026.11.04] 합병·분할 의제배당 — 다니던 회사가 합병·분할되어 주주가 새 회사 주식·합병교부금을 받을 때 의제배당과
//  새 주식 취득가액을 가른다(사건 148 「명씨」).
//  소득세법 §17②4호: 합병으로 소멸한 법인의 주주가 받는 합병대가(주식 + 금전 + 그 밖의 재산)가 옛 주식을 취득하기 위하여 사용한 금액을 넘는 금액은 의제배당 /
//   §17②6호: 분할도 같음(분할법인이 존속하면 소각 등으로 줄어든 주식만) / §17③: 배당가산(Gross-up) 대상 / §17④: 취득에 사용한 금액이 분명하지 않으면 액면가액.
//  소득세법 시행령 §27①1호나목: 법인세법 §44②1·2호(분할은 §46②1·2호)의 요건을 갖춘 합병(적격)이면 받은 주식은 옛 주식의 취득가액으로 —
//   단서: 주식과 금전 등을 함께 받고 그 주식의 시가가 옛 취득가액보다 작으면 시가 / §27①1호라목: 그 밖(비적격)은 취득 당시 시가 / §27①2호: 그 밖의 재산은 시가 /
//   §27⑦: 소액주주로 취득가액이 분명하지 않으면 액면가액(다른 가액을 입증하면 그 가액).
//  시행령 §46 5호나·다: 수입시기는 합병등기일·분할등기일 / §163①4·5호: 새 주식 취득가액 = 옛 취득가액 + 의제배당 − 받은 금전·그 밖의 재산 /
//  §129①2호나: 배당 원천징수 14%. 법인세법(적격 요건) 원문은 법령 폴더에 없음 — 적격 여부는 입력으로 받고 [판단 대기 — 판단거리3차 #56: 유지].
//  p: { 갈래(합병|분할), 존속(분할법인이 남는지: 예/아니오), 소멸법인, 새법인, 등기일, 적격(예|아니오|모름), 상장(새 법인),
//       주주들:[{ 이름, 옛주식수, 옛취득가액(합계), 옛취득일, 액면가액(1주), 소액주주(예/아니오), 새주식수, 새주식시가(1주), 받은돈(합병교부금·분할교부금),
//                 그밖재산(시가 합계), 대주주(예/아니오), 중소기업(예/아니오), 특수관계합병(예/아니오),
//                 나중양도:{ 주식수, 양도가액, 양도일 } }] }
function judgeMergerDividend_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Number(v || 0).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [], 경우 = [], 표 = [];
  let 잠정 = false;
  const 갈래 = p.갈래 === '분할' ? '분할' : '합병';
  const 적격 = jmYn_(p.적격);
  const 호 = 갈래 === '분할' ? '§17②6호' : '§17②4호';
  const 등기일 = jmYmd_(p.등기일);
  const 주주 = (p.주주들 || []).filter(Boolean).map(function (g, i) {
    const ly = g.나중양도 || {};
    return { 이름: g.이름 || ('주주 ' + (i + 1)), 옛수: n(g.옛주식수), 옛취가: n(g.옛취득가액), 옛취일: jmYmd_(g.옛취득일), 액면: n(g.액면가액),
      소액: jmYn_(g.소액주주), 새수: n(g.새주식수), 새시가: n(g.새주식시가), 돈: n(g.받은돈), 그밖: n(g.그밖재산), 대주주: jmYn_(g.대주주),
      중소: jmYn_(g.중소기업), 특관: jmYn_(g.특수관계합병), 양수: n(ly.주식수), 양가: n(ly.양도가액), 양일: jmYmd_(ly.양도일) };
  });
  if (!주주.length) return jmWrap_('합병의제배당', [jmReq_('주주들', null, '주주 목록이 없음', '소득세법 ' + 호)], { 알림: ['주주마다 옛 주식 수·취득가액·받은 새 주식 수와 시가·받은 돈(교부금)을 넣어 주세요'], 할일: [] });
  if (!등기일) { 잠정 = true; 알림.push(갈래 + '등기일을 모름 — 의제배당 수입시기(시행령 §46 5호' + (갈래 === '분할' ? '다' : '나') + '목)를 정할 수 없음'); }
  if (적격 == null) { 잠정 = true; 알림.push('적격' + 갈래 + '인지 모름 — 적격이면 받은 주식을 옛 취득가액으로, 아니면 시가로 셈(시행령 §27①1호나·라목). 두 경우를 함께 셈'); }
  if (갈래 === '분할' && jmYn_(p.존속) === true) 알림.push('분할법인이 남는 분할(존속) — 의제배당은 분할로 줄어든 주식만 셈(소득세법 §17②6호). 옛 주식 수·취득가액 칸에는 줄어든 주식 몫만 넣어야 함');
  const 셈 = function (g, 적) {
    const 옛 = g.옛취가;
    const 시가합 = g.새시가 * g.새수;
    let 주식가액, 근거;
    if (적) {
      if ((g.돈 || g.그밖) && 시가합 && 시가합 < 옛) { 주식가액 = 시가합; 근거 = '적격이나 금전과 함께 받고 주식 시가가 옛 취득가액보다 작아 시가(시행령 §27①1호나목 단서)'; }
      else { 주식가액 = 옛; 근거 = '적격 — 옛 취득가액(시행령 §27①1호나목)'; }
    } else { 주식가액 = 시가합; 근거 = '비적격 — 받은 주식의 시가(시행령 §27①1호라목)'; }
    const 배당 = Math.max(0, 주식가액 + g.돈 + g.그밖 - 옛);
    const 새취가합 = Math.max(0, 옛 + 배당 - g.돈 - g.그밖);
    return { 주식가액: 주식가액, 근거: 근거, 의제배당: 배당, 새취득가액합: 새취가합, 새1주: g.새수 ? Math.round(새취가합 / g.새수) : 0, 원천징수: Math.floor(배당 * 0.14 / 10) * 10 };
  };
  주주.forEach(function (g) {
    const 행 = { 이름: g.이름, 옛주식수: g.옛수, 새주식수: g.새수, 받은돈: g.돈 };
    if (!g.옛취가) {
      if (g.액면 && g.옛수) { g.옛취가 = g.액면 * g.옛수; 잠정 = true; 알림.push(g.이름 + ': 옛 주식 취득가액이 분명하지 않아 액면가액 ' + won(g.옛취가) + '으로 봄(소득세법 §17④' + (g.소액 === true ? '·시행령 §27⑦ 소액주주' : '') + ') — 다른 가액을 입증하면 그 가액'); 할일.push({ 무엇: g.이름 + ' 옛 주식을 얻을 때 낸 돈(출자·매매 계약·증여·상속 평가액)', 왜: '취득가액이 분명하면 액면 대신 그 금액 — 의제배당이 바뀜' }); }
      else { 잠정 = true; 알림.push(g.이름 + ': 옛 주식 취득가액·액면가액을 모두 모름 — 의제배당을 셀 수 없음'); }
    }
    if (!g.새수) { 잠정 = true; 알림.push(g.이름 + ': 받은 새 주식 수를 모름'); }
    if (!g.새시가 && 적격 !== true) { 잠정 = true; 알림.push(g.이름 + ': 새 주식 1주 시가를 모름 — 비적격이면 의제배당을 셀 수 없음(시행령 §27①1호라목)'); 할일.push({ 무엇: g.이름 + ' 받은 새 주식의 ' + (등기일 || '등기일') + ' 시가(상장이면 종가, 비상장이면 평가)', 왜: '비적격이면 의제배당·새 취득가액이 시가로 정해짐' }); }
    const 갈래들 = 적격 == null ? [true, false] : [적격];
    갈래들.forEach(function (적) {
      const r = 셈(g, 적);
      const 머리 = 적격 == null ? ('[모름] ' + (적 ? '적격이면' : '비적격이면')) : '① 법대로(' + (적 ? '적격' : '비적격') + ')';
      경우.push({ 이름: g.이름 + ' ' + 머리 + ' — 의제배당 ' + won(r.의제배당) + '(받은 주식 ' + won(r.주식가액) + ' + 받은 돈 ' + won(g.돈 + g.그밖) + ' − 옛 취득가액 ' + won(g.옛취가) + ') · 원천징수 14% ' + won(r.원천징수) + ' · 새 주식 1주 취득가액 ' + won(r.새1주),
        엔진: '', 엔진칸: null, 금액: r.의제배당, 소득: '배당소득(종합소득세 — 이 도구는 세액을 셈하지 않음)', 근거: r.근거, 새취득가액합: r.새취득가액합 });
      행[(적 ? '적격' : '비적격') + '의제배당'] = r.의제배당;
      행[(적 ? '적격' : '비적격') + '새1주취득가액'] = r.새1주;
      // 나중에 새 주식을 팔 때 — 엔진 주식 계산기, 취득가액은 §163①4·5호
      if (g.양수 && g.양가) {
        const 몫 = g.새수 ? Math.round(r.새취득가액합 * Math.min(g.양수, g.새수) / g.새수) : 0;
        const 칸 = { assetCategory: 'domestic_stock', acquisitionPrice: 몫 || undefined, acquisitionDate: g.옛취일 || undefined, transferPrice: g.양가, transferDate: g.양일 || undefined,
          isDaejuju: g.대주주 === true || undefined, isSmallMediumCompany: g.중소 === true || undefined };
        경우.push({ 이름: g.이름 + ' ' + 머리 + ' 뒤 새 주식 ' + g.양수 + '주를 팔면 — 취득가액 ' + won(몫) + '(시행령 §163①' + (갈래 === '분할' ? '5' : '4') + '호)', 엔진: 'calculate_stock_transfer_tax', 엔진칸: 칸 });
        if (몫 !== Math.round(g.옛취가 * Math.min(g.양수, g.새수) / (g.새수 || 1)))
          경우.push({ 이름: g.이름 + ' ' + 머리 + ' [견주기] 팔 때 옛 취득가액을 그대로 쓰면(의제배당으로 이미 과세된 몫을 또 셈)', 엔진: 'calculate_stock_transfer_tax', 견주기: true,
            엔진칸: Object.assign({}, 칸, { acquisitionPrice: Math.round(g.옛취가 * Math.min(g.양수, g.새수) / (g.새수 || 1)) || undefined }) });
      }
    });
    if (g.양수 && !g.옛취일) { 잠정 = true; 알림.push(g.이름 + ': 새 주식 보유기간을 옛 주식 취득일부터 셀지 원문에서 확인하지 못함 — 대주주 단기 세율에 닿으면 [확인 필요 — 권장: 원문 없음 — 유지]'); }
    if (g.특관 === true || g.대주주 === true) 알림.push(g.이름 + ': 특수관계 법인 사이 합병이고 대주주면 합병비율이 시가와 어긋나 생긴 이익이 상증법 §38 합병에 따른 이익의 증여가 될 수 있음 — 판정 도구 「합병 이익 증여」로 따로 셈(이 도구는 의제배당만)');
    표.push(행);
  });
  reqs.push(jmReq_('적격 ' + 갈래 + ' 여부', 적격 == null ? null : true, '합병법인 세무조정계산서·적격' + 갈래 + ' 과세특례신청서', '소득세법 시행령 §27①1호나목(법인세법 §44②·§46② 원문은 폴더에 없음 [판단 대기 — 판단거리3차 #57: 같음])'));
  reqs.push(jmReq_('옛 주식 취득가액', 주주.every(function (g) { return g.옛취가 > 0; }) ? true : null, '출자·매매·증여·상속 근거', '소득세법 §17②·④'));
  reqs.push(jmReq_(갈래 + '등기일', 등기일 ? true : null, '법인 등기부', '소득세법 시행령 §46 5호'));
  알림.push('의제배당은 배당소득 — ' + (등기일 ? 등기일 :갈래 + '등기일') + '에 받은 것으로 보고(시행령 §46 5호), 새 법인이 14%를 떼어 냄(소득세법 §129①2호나목, 지방소득세 따로). 금융소득이 해마다 2천만원을 넘으면 종합과세·배당가산(§17③) — 이 도구는 종합소득세를 셈하지 않음');
  알림.push('적격 요건(사업 1년 이상·합병대가 중 주식 비율·주식 배정·사업 계속 등)은 법인세법 §44②·§46②에 있으나 원문이 법령 폴더에 없어 판정하지 않음 — 입력한 적격 여부로만 셈 [판단 대기 — 판단거리3차 #58: 같음]');
  할일.push({ 무엇: '합병(분할) 계약서·합병비율 산정 근거·주주별 교부 내역', 왜: '받은 새 주식 수·교부금·그 밖의 재산 확인' });
  할일.push({ 무엇: '새 법인이 낸 원천징수영수증(배당)', 왜: '의제배당 금액·원천징수가 맞는지 견줌' });
  const r = jmWrap_('합병의제배당', reqs, { 주주표: 표, 경우: 경우, 엔진칸: 경우.filter(function (x) { return x.엔진칸; }).map(function (x) { return x.엔진칸; }), 엔진칸늘: true, 알림: 알림, 할일: 할일 });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}
// [2026.11.04] 부부 공동명의 전환 — 단독명의 주택의 지분을 배우자에게 증여한 뒤 양도할 때, 증여하지 않고 파는 경우와
//  증여세·두 사람 양도소득세 합계를 견준다(사건 149 「공씨」).
//  상증법 §53 1호: 배우자로부터 증여받으면 6억원 공제(10년 안 같은 사람 증여 합산 공제 한도) / §47②: 10년 안 같은 사람 증여 합산 /
//  소득세법 §97의2①: 배우자에게 증여받은 자산을 증여일부터 10년(2023.1.1. 전 증여는 5년) 안 양도하면 취득가액은 증여자 취득가액, 낸 증여세는 필요경비 —
//   사망으로 혼인관계가 끝난 경우 제외 / §97의2②2호: 이월과세로 §89①3호 비과세가 되면 적용 안 함 / ②3호: 이월과세 세액이 더 적으면 적용 안 함 /
//  시행령 §163의2②: 필요경비에 넣는 증여세 = 증여세 산출세액 × 그 자산 과세가액 ÷ 과세가액 합계 / §95④ 단서: 이월과세면 보유기간은 증여자 취득일부터 /
//  소득세법 §89①3호·시행령 §156①: 고가주택(12억원) 판정은 주택 전체 양도가액으로 — 공동명의 지분 양도도 나누기 전 값으로 본다.
//  p: { 양도가액(주택 전체), 양도일, 취득가액(증여자 취득 때 전체), 취득일, 필요경비(전체), 증여지분(예: 0.5), 증여일, 증여재산가액(그 지분 시가),
//       앞선배우자증여(10년 안 같은 배우자 증여 과세가액 합), 증여세산출세액(알면), 일세대일주택(예|아니오|모름), 거주연수(증여자), 수증자거주연수,
//       증여자사망일, 나중양도일 }
function judgeJointOwnership_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [], 경우 = [];
  let 잠정 = false;
  const 전가 = n(p.양도가액), 전취 = n(p.취득가액), 전경 = n(p.필요경비);
  const 양일 = jmYmd_(p.양도일), 취일 = jmYmd_(p.취득일), 증일 = jmYmd_(p.증여일), 사망 = jmYmd_(p.증여자사망일), 나중 = jmYmd_(p.나중양도일);
  let 지분 = famNum_(p.증여지분); if (지분 > 1) 지분 = 지분 / 100; if (!(지분 > 0 && 지분 < 1)) 지분 = 0;
  const 증가 = n(p.증여재산가액), 앞선 = n(p.앞선배우자증여);
  const 일주 = jmYn_(p.일세대일주택);
  const 거주 = famNum_(p.거주연수) || 0, 수거주 = p.수증자거주연수 != null && p.수증자거주연수 !== '' ? famNum_(p.수증자거주연수) : null;
  reqs.push(jmReq_('주택 전체 양도가액', 전가 > 0 ? true : null, '매매계약서(공동명의면 두 사람 합계)', '소득세법 §96①'));
  reqs.push(jmReq_('증여자 취득가액·취득일', 전취 > 0 && 취일 ? true : null, '증여자 취득 때 계약서·등기부', '소득세법 §97의2①'));
  reqs.push(jmReq_('증여 지분', 지분 > 0 ? true : null, '증여계약서·등기부 지분', '상증법 §2'));
  reqs.push(jmReq_('증여일', 증일 ? true : null, '등기부 접수일(증여 등기)', '상증법 시행령 §24'));
  reqs.push(jmReq_('증여재산가액(그 지분 시가)', 증가 > 0 ? true : null, '감정서·매매사례가액 — 시가로 평가', '상증법 §60'));
  if (!(전가 > 0 && 지분 > 0)) return jmWrap_('공동명의', reqs, { 알림: ['주택 전체 양도가액과 증여할 지분을 넣어야 견줄 수 있음'] });
  if (!증가) 잠정 = true;
  // 증여세 산출세액 — 입력이 없으면 상증법 §26 세율로 잠정 계산(엔진 ② 값으로 바꿀 것)
  const 과표 = Math.max(0, 증가 + 앞선 - 600000000);
  const 누진 = function (x) { const t = [[100000000, 0.1, 0], [500000000, 0.2, 10000000], [1000000000, 0.3, 60000000], [3000000000, 0.4, 160000000], [Infinity, 0.5, 460000000]]; for (let i = 0; i < t.length; i++) if (x <= t[i][0]) return Math.round(x * t[i][1] - t[i][2]); return 0; };
  let 증세 = n(p.증여세산출세액), 증세잠정 = false;
  if (!증세 && 과표 > 0) { 증세 = 누진(과표); 증세잠정 = true; }
  const 일주칸 = 일주 === true;
  // ① 증여하지 않고 단독으로 양도
  const 단독 = { transferPrice: 전가, acquisitionPrice: 전취, acquisitionDate: 취일, transferDate: 양일, necessaryExpenses: 전경, isOneHouseOneFamily: 일주칸, residenceYears: 거주 };
  경우.push({ 이름: '① 증여하지 않고 단독명의로 양도', 엔진: 'calculate_transfer_tax', 엔진칸: 단독 });
  // ② 증여세
  경우.push({ 이름: '② 배우자에게 ' + Math.round(지분 * 100) + '% 증여 — 증여세', 엔진: 'calculate_gift_tax', 엔진칸: { giftAmount: 증가, relation: '배우자', giftDate: 증일, priorGiftAmount: 앞선 },
    잠정세액: 증세잠정 ? 증세 : undefined, 설명: '과세표준 ' + won(과표) + '(증여재산가액 ' + won(증가) + (앞선 ? ' + 10년 안 앞선 증여 ' + won(앞선) : '') + ' − 배우자공제 6억원, §53 1호·§47②)' });
  // ③ 증여 뒤 양도 — 두 사람 따로(기본공제·세율도 사람마다)
  const 남은 = 1 - 지분;
  const mk = function (date, wrong) {
    const 남편 = { transferPrice: Math.round(전가 * 남은), acquisitionPrice: Math.round(전취 * 남은), acquisitionDate: 취일, transferDate: date, necessaryExpenses: Math.round(전경 * 남은),
      isOneHouseOneFamily: 일주칸, residenceYears: 거주 };
    const 아내 = { transferPrice: Math.round(전가 * 지분), transferDate: date, giftReceivedDate: 증일, donorRelation: 'spouse',
      doneeOwnAcquisitionPrice: 증가, doneeOwnNecessaryExpenses: Math.round(전경 * 지분),
      donorAcquisitionPrice: Math.round(전취 * 지분), donorAcquisitionDate: 취일, donorNecessaryExpenses: Math.round(전경 * 지분),
      giftTaxPaid: 증세, giftTaxableValue: 증가 + 앞선, isOneHouseOneFamily: 일주칸, residenceYears: 수거주 != null ? 수거주 : 거주 };
    if (사망) 아내.donorDeathDate = 사망;
    if (!wrong) { 남편.wholeHouseTransferPrice = 전가; 아내.wholeHouseTransferPrice = 전가; }
    return { 남편: 남편, 아내: 아내 };
  };
  const now = mk(양일, false);
  경우.push({ 이름: '③-1 증여 뒤 양도 — 증여자 몫(' + Math.round(남은 * 100) + '%)', 엔진: 'calculate_transfer_tax', 엔진칸: now.남편 });
  경우.push({ 이름: '③-2 증여 뒤 양도 — 배우자 몫(' + Math.round(지분 * 100) + '%, 이월과세 견줌)', 엔진: 'calculate_transfer_tax_with_carryover', 엔진칸: now.아내 });
  if (나중) {
    const later = mk(나중, false);
    경우.push({ 이름: '④-0 ' + 나중 + ' 양도 — 증여하지 않았다면(단독)', 엔진: 'calculate_transfer_tax', 엔진칸: Object.assign({}, 단독, { transferDate: 나중 }) });
    경우.push({ 이름: '④-1 ' + 나중 + ' 양도 — 증여자 몫', 엔진: 'calculate_transfer_tax', 엔진칸: later.남편 });
    경우.push({ 이름: '④-2 ' + 나중 + ' 양도 — 배우자 몫(이월과세 기간 지났는지 엔진이 봄)', 엔진: 'calculate_transfer_tax_with_carryover', 엔진칸: later.아내 });
  }
  if (일주칸) {
    경우.push({ 이름: '③-2 다른 해석 [판단 대기 — 판단거리3차 #59: 원칙은 수증자 취득일 — 1세대1주택 2년 보유 판정의 세대 통산은 조문 없음, 예규 확인(두 경우 유지)] — 같은 세대 배우자에게 받은 지분의 보유기간을 증여자 취득일부터 이어 보면(이월과세 없이)', 엔진: 'calculate_transfer_tax',
      엔진칸: { transferPrice: now.아내.transferPrice, acquisitionPrice: 증가, acquisitionDate: 취일, transferDate: 양일, necessaryExpenses: now.아내.doneeOwnNecessaryExpenses, isOneHouseOneFamily: true, residenceYears: now.아내.residenceYears, wholeHouseTransferPrice: 전가 },
      설명: '소득세법 §95④ 단서는 이월과세(§97의2①)일 때만 증여자 취득일부터 셈 — 이월과세가 안 걸리는 1세대1주택 지분의 보유기간(2년)을 세대 통산으로 볼지 원문에 없음, 예규 [판단 대기 — 판단거리3차 #60: 같음]' });
    const bad = mk(양일, true);
    경우.push({ 이름: '[견주기] 지분 값만 넣고 주택 전체 양도가액을 안 넘김(틀린 길)', 엔진: 'calculate_transfer_tax_with_carryover', 엔진칸: bad.아내, 견주기: true,
      설명: '고가주택 12억원 판정을 지분 값(' + won(Math.round(전가 * 지분)) + ')으로 하게 되어 고가주택이 아닌 것처럼 셈 — 시행령 §156①은 주택 전체로' });
  }
  if (일주 === null) { 잠정 = true; reqs.push(jmReq_('1세대1주택 여부', null, '세대 주택 수 — 세대판정·주택여부 묶음으로', '소득세법 §89①3호')); }
  // 알림
  const 기간 = 증일 && 증일 < '2023-01-01' ? 5 : 10;
  if (증일) {
    const 끝 = (Number(증일.slice(0, 4)) + 기간) + 증일.slice(4);
    알림.push('배우자 몫은 증여일(' + 증일 + ')부터 ' + 기간 + '년 안(' + 끝 + ' 전) 양도하면 이월과세 — 취득가액은 증여자 취득가액, 보유기간은 증여자 취득일부터, 증여세는 필요경비(소득세법 §97의2①·§95④' + (기간 === 5 ? ', 2023.1.1. 전 증여는 5년' : '') + ')');
  }
  알림.push('이월과세를 하면 1세대1주택 비과세가 되는 경우(§97의2②2호)나 이월과세 세액이 더 적은 경우(②3호)는 이월과세를 하지 않음 — 엔진이 두 세액을 견줌');
  알림.push('공동명의 지분을 팔 때도 고가주택(12억원) 판정·양도차익 안분은 주택 전체 양도가액으로(소득세법 §89①3호·시행령 §156①·§160①) — 넥스 양도 도구에 wholeHouseTransferPrice(주택 전체 양도가액)를 꼭 넘김');
  알림.push('배우자공제 6억원은 10년 안 같은 배우자에게 받은 증여를 합쳐 한 번(상증법 §53 1호·§47②) — 앞선 증여를 빠뜨리면 증여세가 적게 나옴');
  if (증세잠정) 알림.push('증여세 산출세액 ' + won(증세) + '은 상증법 §26 세율로 셈한 잠정 값 — ② 엔진 결과(신고세액공제 전 산출세액)로 바꿔 넣을 것');
  if (사망) 알림.push('증여자(배우자)가 양도 전 사망하면 이월과세 제외(§97의2① 괄호) — 배우자 몫 취득가액은 증여재산가액');
  알림.push('배우자 몫의 거주기간(장기보유특별공제 표2)을 증여자와 함께 산 기간으로 볼지 — 수증자거주연수를 따로 넣지 않으면 증여자 거주연수로 셈 [확인 필요 — 권장: 거주기간은 세대 단위 요건 — 증여자와 함께 산 기간 통산 권장, 예규 확인]');
  알림.push('증여받은 지분 취득세·등록면허세(지방세)는 이 도구가 셈하지 않음 — 비용으로 견줄 때 따로 더할 것');
  알림.push('증여재산가액은 증여일 현재 시가(상증법 §60) — 기준시가로 낮게 신고하면 이월과세가 안 걸릴 때 배우자 몫 취득가액도 낮아짐(소득세법 시행령 §163⑨) (원문 확인 2026-11-04: 소득세법시행령 §163⑨)');
  할일.push({ 무엇: '증여 지분 감정평가서 또는 매매사례가액', 왜: '증여재산가액(시가)·나중 취득가액 근거' });
  할일.push({ 무엇: '10년 안 같은 배우자 증여 내역(증여세 신고서)', 왜: '배우자공제 6억원 합산' });
  할일.push({ 무엇: '세대 주택 수·거주기간(주민등록 초본)', 왜: '1세대1주택·장기보유특별공제 표2' });
  const r = jmWrap_('공동명의', reqs, { 경우: 경우, 엔진칸: 경우.map(function (x) { return x.엔진칸; }), 엔진칸늘: true, 증여세과세표준: 과표, 증여세산출세액: 증세, 증여세잠정: 증세잠정, 지분: 지분, 알림: 알림, 할일: 할일,
    견주는법: '①의 세액  vs  ②증여세(신고세액공제 뒤) + ③-1 + ③-2 — 합계가 작은 쪽이 유리. 취득세(지방세)는 따로' });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}
// [2026.11.04] 임대·담보가 걸린 재산의 평가 — 시가·보충적 평가액·임대료 등 환산가액·담보채권액을 법 순서대로 견준다(사건 150 「황씨」).
//  상증법 §60①: 시가로 평가(시가가 있으면 §61을 쓰지 않음) / §61①~④: 시가를 산정하기 어려우면 기준시가 등 보충적 평가 /
//  §61⑤: 사실상 임대차계약이 체결되거나 임차권이 등기된 재산은 임대료 등을 기준으로 환산한 가액과 §61①~④ 가액 중 큰 금액 /
//  시행령 §50⑦: 환산가액 = 1년 임대료 ÷ 기획재정부령 이율(12%) + 임대보증금 / ⑧: 토지·건물 소유자가 같으면 기준시가 비율로 나눔 —
//   소유자가 다르면 각자 계약분, 한 사람만 임대차 당사자면 그 임대료를 토지·건물 전체 것으로 보고 기준시가로 나눔 /
//  §66: 저당권·질권·양도담보·전세권(임대보증금을 받고 임대한 재산 포함)·담보신탁이 걸린 재산은 §60에 따른 가액과 시행령 §63의 가액 중 큰 금액 /
//  시행령 §63①: 저당·근저당·질권·양도담보 = 그 재산이 담보하는 채권액(공동저당은 평가기준일 재산가액으로 나눈 몫), 전세권 = 전세금(임대보증금) /
//  §63②: 근저당 채권최고액이 채권액보다 적으면 채권최고액, 신용보증기관 보증은 뺌, 한 재산이 여러 채권(전세금·임차보증금 포함)의 담보면 그 합계.
//  p: { 시가(있으면), 토지기준시가, 건물기준시가, 보충적평가액(직접 셈했으면), 임대:[{보증금, 월세, 전세권등기(예|아니오), 당사자(모두|토지만|건물만)}],
//       담보:[{종류(저당|근저당|공동저당|질권|양도담보|신탁), 채권액, 채권최고액, 이재산가액, 공동재산가액합}], 신용보증, 지분, 토지건물소유자같음,
//       증여일, 관계(배우자|직계존속|직계비속|기타친족|기타), 인수채무(수증자가 떠안는 보증금·대출), 인수채무증빙(예|아니오) }
function judgeLeaseMortgageValuation_(p) {
  p = p || {};
  const n = function (v) { const x = famNum_(v); return x > 0 ? x : 0; };
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [], 경우 = [];
  let 잠정 = false;
  const 시가 = n(p.시가), 토기 = n(p.토지기준시가), 건기 = n(p.건물기준시가);
  const 보충 = n(p.보충적평가액) || (토기 + 건기);
  const 임대 = Array.isArray(p.임대) ? p.임대 : (p.보증금 != null || p.월세 != null ? [{ 보증금: p.보증금, 월세: p.월세 }] : []);
  const 담보 = Array.isArray(p.담보) ? p.담보 : [];
  let 지분 = famNum_(p.지분); if (지분 > 1) 지분 = 지분 / 100; if (!(지분 > 0 && 지분 <= 1)) 지분 = 1;
  const 증일 = jmYmd_(p.증여일);
  reqs.push(jmReq_('시가(감정가·매매사례가액 등)', 시가 > 0 ? true : null, '감정평가서·평가기간 안 매매사례 — 없으면 보충적 평가', '상증법 §60①②·시행령 §49'));
  reqs.push(jmReq_('토지·건물 기준시가', 보충 > 0 ? true : null, '개별공시지가·건물 기준시가(고시)', '상증법 §61①'));
  reqs.push(jmReq_('임대차계약(보증금·월세)', 임대.length ? true : null, '임대차계약서 원본·임대료 통장 내역', '상증법 §61⑤·시행령 §50⑦'));
  reqs.push(jmReq_('담보 채권액(평가기준일 현재)', 담보.length ? (담보.every(function (d) { return n(d.채권액) > 0; }) ? true : null) : true, '금융기관 부채증명서(평가기준일 잔액)·등기부 을구', '상증법 §66·시행령 §63①'));
  if (!(시가 > 0 || 보충 > 0)) return jmWrap_('임대담보평가', reqs, { 알림: ['시가나 기준시가가 하나는 있어야 평가할 수 있음'] });
  // 임대료 등 환산가액(시행령 §50⑦) — 1년 임대료 ÷ 12% + 임대보증금
  let 보증합 = 0, 월세합 = 0, 전세권보증 = 0, 당사자한쪽 = false;
  임대.forEach(function (x) { const b = n(x.보증금), m = n(x.월세); 보증합 += b; 월세합 += m; if (jmYn_(x.전세권등기) === true) 전세권보증 += b; if (/토지만|건물만/.test(String(x.당사자 || ''))) 당사자한쪽 = true; });
  const 환산 = (보증합 > 0 || 월세합 > 0) ? Math.round(월세합 * 12 / 0.12 + 보증합) : 0;
  // 담보채권액(시행령 §63①②) — 근저당은 채권최고액이 적으면 그 값, 공동저당은 이 재산 몫, 여러 채권이면 합계
  let 담보합 = 0, 최고액그대로 = 0, 최고액있음 = false;
  const 담보줄 = 담보.map(function (d) {
    const 종 = String(d.종류 || '저당');
    let 액 = n(d.채권액); const 최고 = n(d.채권최고액);
    if (!액 && 최고) { 액 = 최고; 잠정 = true; 알림.push('「' + 종 + '」 채권액(평가기준일 잔액)이 없어 채권최고액 ' + won(최고) + '으로 잠정 — 부채증명서로 바꿀 것'); }
    let 몫 = 액;
    if (최고 && 최고 < 액) 몫 = 최고;
    if (/공동/.test(종)) {
      const 이 = n(d.이재산가액), 합 = n(d.공동재산가액합);
      if (이 && 합 && 합 >= 이) 몫 = Math.round(몫 * 이 / 합);
      else { 잠정 = true; 알림.push('공동저당 — 공동으로 담보된 재산들의 평가기준일 가액을 넣어야 이 재산 몫으로 나눔(시행령 §63①2호), 지금은 채권액 전부로 잠정'); }
    }
    if (최고 > 0) 최고액있음 = true;
    최고액그대로 += 최고 > 0 ? 최고 : 액;
    담보합 += 몫;
    return { 종류: 종, 채권액: 액, 채권최고액: 최고 || null, 이재산몫: 몫 };
  });
  const 신보 = n(p.신용보증);
  const 담보순 = Math.max(0, 담보합 - 신보);
  // §60(시가) 또는 §61(보충적·환산 중 큰 값) — 시가가 있으면 환산가액은 견주지 않음
  const 쓴곳 = 시가 > 0 ? '시가' : '보충적';
  const 가60 = 시가 > 0 ? 시가 : Math.max(보충, 환산);
  const 가66 = 담보순 + 보증합; // 임대보증금(전세금)은 시행령 §63①5호·②로 담보채권과 합계
  const 전체 = Math.max(가60, 가66);
  const 평가액 = Math.round(전체 * 지분);
  const 근거줄 = 가66 > 가60 ? '§66(담보채권액 ' + won(담보순) + ' + 임대보증금 ' + won(보증합) + ')' : (시가 > 0 ? '§60 시가' : (환산 > 보충 ? '§61⑤ 임대료 등 환산가액' : '§61①~④ 기준시가'));
  if (!(시가 > 0)) 잠정 = 잠정 || false;
  if (!임대.length && !담보.length) 알림.push('임대차도 담보도 없으면 이 도구가 아니라 시가·보충적 평가만으로 충분함');
  // 토지·건물 나눔(시행령 §50⑧) — 보충적 평가에서 환산가액을 썼을 때
  let 나눔 = null;
  if (쓴곳 === '보충적' && 환산 > 보충 && 토기 > 0 && 건기 > 0) {
    const 토 = Math.round(환산 * 토기 / (토기 + 건기));
    나눔 = { 토지: 토, 건물: 환산 - 토, 근거: jmYn_(p.토지건물소유자같음) === false ? (당사자한쪽 ? '시행령 §50⑧2호나 — 한 사람만 임대차 당사자면 그 임대료를 토지·건물 전체 것으로 보고 기준시가로 나눔' : '시행령 §50⑧2호가 — 소유자가 다르면 각자 맺은 계약으로 따로 환산(이 숫자는 같은 소유자로 본 잠정)') : '시행령 §50⑧1호 — 토지·건물 소유자가 같으면 기준시가 비율로 나눔' };
    if (jmYn_(p.토지건물소유자같음) === false && !당사자한쪽) 잠정 = true;
  }
  // 경우
  const 엔칸 = { baseValue: 시가 > 0 ? 시가 : 보충, baseKind: 쓴곳, securedDebtAmount: 담보합, creditGuaranteeAmount: 신보 || undefined, annualRent: 월세합 * 12, deposit: 보증합, ownershipRatio: 지분 };
  경우.push({ 이름: '① 법대로 평가(§60·§61⑤ 먼저, 다음 §66) — ' + 근거줄, 엔진: 'calculate_mortgaged_or_leased_property_value', 엔진칸: 엔칸, 설명: '최종평가액 ' + won(평가액) });
  const 관계 = String(p.관계 || '');
  if (관계) {
    const 인수 = n(p.인수채무);
    const g = { giftAmount: 평가액, relation: 관계, giftDate: 증일 || undefined };
    if (인수) { g.debtAssumedAmount = 인수; g.isDebtObjectivelyProven = jmYn_(p.인수채무증빙) === true; }
    경우.push({ 이름: '② 그 평가액으로 증여세' + (인수 ? '(부담부증여 — 떠안는 보증금·대출 ' + won(인수) + ' 뺌)' : ''), 엔진: 'calculate_gift_tax', 엔진칸: g });
    if (인수) 알림.push('수증자가 떠안는 임대보증금·대출 ' + won(인수) + '은 증여재산에서 빼고(상증법 §47①), 그만큼은 증여자가 양도한 것 — 증여자 양도소득세는 「부담부증여」 묶음으로 따로 셈(소득세법 §88 1호 단서)');
  }
  // [견주기] 옛 길 — 셋 중 큰 값(시가에도 환산가액을 견주고, 보증금을 담보에 안 더함)
  const 옛 = Math.round(Math.max(시가 > 0 ? 시가 : 보충, 담보순, 환산) * 지분);
  경우.push({ 이름: '[견주기] 옛 길 — 시가·담보채권액·환산가액 셋 중 큰 값', 엔진: 'calculate_mortgaged_or_leased_property_value', 견주기: true,
    엔진칸: { baseValue: 시가 > 0 ? 시가 : 보충, securedDebtAmount: 담보합, creditGuaranteeAmount: 신보 || undefined, annualRent: 월세합 * 12, deposit: 보증합, ownershipRatio: 지분 }, 설명: won(옛) + (옛 !== 평가액 ? ' — 법대로와 ' + won(Math.abs(옛 - 평가액)) + ' 차이' : ' — 같음') });
  if (관계 && 옛 !== 평가액) 경우.push({ 이름: '[견주기] 옛 길 평가액으로 증여세', 엔진: 'calculate_gift_tax', 견주기: true, 엔진칸: Object.assign({}, 경우.filter(function (c) { return c.엔진 === 'calculate_gift_tax'; })[0].엔진칸, { giftAmount: 옛 }) });
  if (최고액있음 && 최고액그대로 !== 담보합) {
    const 최 = Math.round(Math.max(가60, Math.max(0, 최고액그대로 - 신보) + 보증합) * 지분);
    경우.push({ 이름: '[견주기] 채권최고액을 그대로 담보채권액으로 넣음', 엔진: 'calculate_mortgaged_or_leased_property_value', 견주기: true, 엔진칸: Object.assign({}, 엔칸, { securedDebtAmount: 최고액그대로 }), 설명: won(최) + ' — 법은 평가기준일 실제 채권액(최고액이 더 적을 때만 최고액, 시행령 §63②)' });
  }
  // 알림
  if (시가 > 0 && 환산 > 시가) 알림.push('시가가 있으면 임대료 등 환산가액(' + won(환산) + ')은 견주지 않음 — §61⑤는 보충적 평가 안에서만(§60①). 담보 쪽(§66)만 시가와 견줌');
  if (!(시가 > 0)) 알림.push('시가를 찾지 못해 보충적 평가 — 평가기간(증여일 전 6개월~후 3개월) 안 감정·매매사례·수용가액이 있으면 그 값이 시가(시행령 §49), 평가심의위원회 길도 있음 (원문 확인 2026-11-04: 상증령 §49①(증여 전 6개월~후 3개월 매매·감정·수용가액))');
  if (보증합 > 0) 알림.push('임대보증금 ' + won(보증합) + '은 §66 쪽에서 담보채권액과 합쳐 견줌(시행령 §63①5호·②) — 환산가액에도 들어가지만 두 길은 따로 견주고 큰 값 하나만 씀');
  if (전세권보증 > 0) 알림.push('전세권이 등기된 보증금 ' + won(전세권보증) + '은 전세금 하나로만 셈 — 「담보」에 전세권을 또 넣으면 두 번 들어감');
  if (신보) 알림.push('신용보증기관 보증 ' + won(신보) + '은 담보채권액에서 뺌(시행령 §63②)');
  if (지분 < 1) 알림.push('지분 ' + Math.round(지분 * 1000) / 10 + '% — 시가·기준시가·보증금·담보채권액은 재산 전체 기준으로 견준 뒤 지분을 곱함');
  if (나눔) 알림.push('환산가액 토지 ' + won(나눔.토지) + ' · 건물 ' + won(나눔.건물) + ' — ' + 나눔.근거);
  알림.push('증여받은 재산을 나중에 팔면 취득가액은 이 평가액(소득세법 시행령 §163⑨) — 기준시가·환산가액으로 낮게 평가하면 나중 양도차익이 커짐');
  알림.push('취득세·등록면허세(지방세)는 이 도구가 셈하지 않음 — 알림만');
  할일.push({ 무엇: '금융기관 부채증명서(증여일 현재 잔액)', 왜: '근저당은 채권최고액이 아니라 실제 채권액(시행령 §63①3호)' });
  할일.push({ 무엇: '임대차계약서 전부·임대료 입금 내역', 왜: '보증금·월세(시행령 §50⑦), 사실상 임대차 여부' });
  할일.push({ 무엇: '평가기간 안 감정·매매사례 확인', 왜: '시가가 있으면 환산가액을 쓰지 않음(§60①)' });
  const r = jmWrap_('임대담보평가', reqs, { 경우: 경우, 엔진칸: 경우.map(function (x) { return x.엔진칸; }), 엔진칸늘: true,
    평가액: 평가액, 제60조가액: 가60, 제66조가액: 가66, 환산가액: 환산, 보충적평가액: 보충, 시가: 시가 || null, 담보채권액: 담보순, 임대보증금: 보증합, 쓴평가: 근거줄, 담보줄: 담보줄, 토지건물나눔: 나눔, 옛길평가액: 옛, 지분: 지분,
    알림: 알림, 할일: 할일, 견주는법: '§60 가액(시가, 없으면 기준시가와 환산가액 중 큰 값)  vs  §66 가액(담보채권액 + 임대보증금) — 큰 값 × 지분' });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}

// [2026.11.04] 상속 인적공제(자녀·미성년자·연로자·장애인)와 일괄공제 고르기 — 사람마다 어느 공제가 되는지·겹쳐 받는지를 가른다(사건 151 「편씨」).
//  상증법 §20①: 거주자 사망 — 1호 자녀(태아 포함) 1명 5천만 / 2호 상속인(배우자 제외)·동거가족 중 미성년자(태아 포함) 1천만 × 19세까지 연수 /
//   3호 상속인(배우자 제외)·동거가족 중 65세 이상 5천만 / 4호 상속인·동거가족 중 장애인 1천만 × 상속개시일 현재 통계표 성별·연령별 기대여명 연수.
//   후단: 1호 사람이 2호에 해당하면, 4호 사람이 1~3호 또는 §19(배우자공제)에 해당하면 각각 합산 — 그 밖의 겹침(1호와 3호 등)은 합산 문구 없음.
//  §20③: 2호·4호 연수의 1년 미만은 1년. 시행령 §18①: 동거가족 = 상속개시일 현재 피상속인이 사실상 부양하는 직계존비속(배우자의 직계존속 포함)·형제자매.
//   ③ 장애인 = 소득세법 시행령 §107① 각 호(장애인복지법 장애인·상이자·중단 없는 치료가 필요한 중증환자 등), ②④ 태아·장애인 증명서류는 신고 때 제출.
//  §21①: 상속인·수유자는 기초공제(§18)+§20 합계와 5억 중 큰 금액 — 단서: 신고(§67·국세기본법 §45의3 기한후신고)가 없으면 5억.
//   ②: 배우자가 단독으로 상속받으면 기초공제+§20 합계로만(5억 없음). §24: 공제 종합한도.
//  p: { 상속개시일, 피상속인거주자(예|아니오), 신고(기한안|기한후|무신고), 배우자단독(예|아니오|모름),
//       사람:[{ 이름, 관계(배우자|자녀|손자녀|부모|배우자부모|형제자매|그밖), 생년월일 또는 나이, 태아(예), 상속인(예|아니오), 상속포기(예),
//               동거부양(예|아니오), 장애인(예|아니오|모름), 기대여명(연수), 성별 }] }
function judgeHeirPersonalDeduction_(p) {
  p = p || {};
  const won = function (v) { return Math.round(Number(v || 0)).toLocaleString('ko-KR') + '원'; };
  const reqs = [], 알림 = [], 할일 = [], 경우 = [], 줄 = [];
  let 잠정 = false;
  const 개시 = jmYmd_(p.상속개시일);
  const 사람 = Array.isArray(p.사람) ? p.사람 : [];
  reqs.push(jmReq_('상속개시일', 개시 ? true : null, '사망진단서·기본증명서', '상증법 §20①2호·4호(연수는 개시일 현재)'));
  reqs.push(jmReq_('피상속인 거주자', jmYn_(p.피상속인거주자) === false ? false : true, '비거주자면 §20·§21 없이 기초공제 2억만', '상증법 §18·§20①·§21①'));
  reqs.push(jmReq_('상속인·가족 명단', 사람.length ? true : null, '가족관계증명서·제적등본·주민등록등본', '상증법 §20①, 시행령 §18①'));
  if (!사람.length) return jmWrap_('인적공제', reqs, { 알림: ['사람 명단이 있어야 셈할 수 있음'] });
  const 거주 = jmYn_(p.피상속인거주자) !== false;
  const 나이 = function (x) {
    if (jmYn_(x.태아) === true) return -1;
    const b = jmYmd_(x.생년월일);
    if (b && 개시) { let a = Number(개시.slice(0, 4)) - Number(b.slice(0, 4)); if (개시.slice(5) < b.slice(5)) a -= 1; return a; }
    const a = famNum_(x.나이); return a > 0 || x.나이 === 0 ? a : null;
  };
  // 19세가 될 때까지의 연수 — 생일까지 남은 기간, 1년 미만은 1년(§20③)
  const 미성년연수 = function (x) {
    if (jmYn_(x.태아) === true) return 19;
    const b = jmYmd_(x.생년월일);
    if (b && 개시) {
      const y19 = String(Number(b.slice(0, 4)) + 19) + b.slice(4);
      const ms = new Date(y19) - new Date(개시); if (!(ms > 0)) return 0;
      return Math.ceil(ms / (365.2425 * 86400000) - 1e-9);
    }
    const a = 나이(x); return a != null && a < 19 ? 19 - a : 0;
  };
  let 자녀수 = 0, 미성년합 = 0, 연로수 = 0, 장애합 = 0, 겹침막음 = 0, 자녀포기 = 0;
  사람.forEach(function (x) {
    const 관 = String(x.관계 || ''), 이름 = String(x.이름 || 관 || '?');
    const 배우자 = /^배우자$/.test(관);
    const 상속인 = jmYn_(x.상속인) !== false; // [2026.11.04 판정 정리] 상속을 포기한 사람도 「상속인」(상증법 §2 4호 원문 확인) — 2·3호 대상에서 빼지 않음
    const 동거 = jmYn_(x.동거부양) === true && /자녀|손자녀|부모|배우자부모|조부모|형제자매|직계/.test(관);
    const 대상 = 상속인 || 동거; // 2~4호: 상속인 및 동거가족
    const a = 나이(x);
    const 받음 = [];
    let 금 = 0;
    if (/^자녀$/.test(관)) { 받음.push('자녀 5천만(1호)'); 금 += 50000000; 자녀수++; if (jmYn_(x.상속포기) === true) 자녀포기++; }
    if (!배우자 && 대상 && a != null && a < 19) {
      const yrs = 미성년연수(x); 받음.push('미성년자 1천만 × ' + yrs + '년(2호)'); 금 += yrs * 10000000; 미성년합 += yrs;
    }
    if (!배우자 && 대상 && a != null && a >= 65) {
      if (/^자녀$/.test(관)) { 겹침막음++; 받음.push('65세 이상이나 자녀공제와 합산 문구 없음 — 연로자공제 안 더함(§20① 후단)'); }
      else { 받음.push('연로자 5천만(3호)'); 금 += 50000000; 연로수++; }
    }
    const 장 = jmYn_(x.장애인);
    if (대상 && 장 === true) {
      let le = Math.floor(famNum_(x.기대여명) || 0);
      if (!(famNum_(x.기대여명) > 0)) { 잠정 = true; le = 0; 할일.push({ 무엇: 이름 + ' 기대여명 연수', 왜: '상속개시일 현재 통계청 생명표 성별·연령별 기대여명(§20①4호) — 넣기 전엔 장애인공제 0으로 잠정' }); }
      else { const f = famNum_(x.기대여명); le = Math.ceil(f - 1e-9); }
      받음.push('장애인 1천만 × ' + le + '년(4호' + (배우자 ? ', 배우자공제와 합산' : '') + ')'); 금 += le * 10000000; 장애합 += le;
      할일.push({ 무엇: 이름 + ' 장애인증명서(또는 장애인등록증·상이자 증명)', 왜: '신고 때 제출(시행령 §18④) — 범위는 소득세법 시행령 §107①' });
    } else if (대상 && 장 == null && x.장애인 !== undefined) { 잠정 = true; 알림.push(이름 + ' 장애인 여부를 모름 — 소득세법 시행령 §107①(중증환자 포함)에 들면 장애인공제가 더 붙을 수 있음'); }
    if (!대상 && !/^자녀$/.test(관)) 받음.push('상속인도 아니고 부양 동거가족도 아님 — 2~4호 없음');
    if (jmYn_(x.태아) === true) 할일.push({ 무엇: 이름 + ' 임신 사실 확인 서류', 왜: '태아 자녀·미성년자공제(시행령 §18②)' });
    if (jmYn_(x.상속포기) === true && a != null && (a < 19 || a >= 65)) 알림.push(이름 + '은 상속을 포기했지만 상속인(상증법 §2 4호)이라 2·3호 대상');
    줄.push({ 이름: 이름, 관계: 관, 나이: a, 상속인: 상속인, 동거가족: 동거, 받는공제: 받음, 금액: 금 });
  });
  const 인적합 = 자녀수 * 50000000 + 미성년합 * 10000000 + 연로수 * 50000000 + 장애합 * 10000000;
  const 신고 = String(p.신고 || '기한안');
  const 무신고 = /무신고/.test(신고);
  let 단독 = jmYn_(p.배우자단독);
  const 배우자있음 = 사람.some(function (x) { return /^배우자$/.test(String(x.관계 || '')); });
  const 다른상속인 = 사람.some(function (x) { return !/^배우자$/.test(String(x.관계 || '')) && jmYn_(x.상속인) !== false && jmYn_(x.상속포기) !== true; });
  if (단독 == null && 배우자있음) { 단독 = !다른상속인; }
  const 포기로단독 = 단독 && 사람.some(function (x) { return jmYn_(x.상속포기) === true; });
  let 일괄 = 0, 고른것 = '';
  if (!거주) { 일괄 = 200000000; 고른것 = '비거주 — 기초공제 2억만(§18)'; }
  else if (단독) { 일괄 = 200000000 + 인적합; 고른것 = '배우자 단독 상속 — 기초공제+인적공제만(§21②)'; }
  else if (무신고) { 일괄 = 500000000; 고른것 = '신고 없음 — 일괄공제 5억(§21① 단서)'; }
  else { 일괄 = Math.max(500000000, 200000000 + 인적합); 고른것 = 200000000 + 인적합 > 500000000 ? '기초공제+인적공제가 5억보다 큼' : '일괄공제 5억이 큼(§21①)'; }
  reqs.push(jmReq_('배우자 단독 상속 여부', 단독 == null ? null : true, '상속재산분할협의서·상속포기 심판문', '상증법 §21②'));
  // 엔진칸 — calculate_inheritance_tax 인적공제 칸
  const 엔칸 = { childCount: 자녀수, minorHeirRemainingYears: 미성년합, elderlyHeirCount: 연로수, disabledHeirRemainingYears: 장애합, isSpouseOnlyHeir: !!단독, isDecedentResident: 거주, filingStatus: 무신고 ? 'unreported' : 'ontime', dateOfDeath: 개시 || undefined };
  if (/기한후/.test(신고)) { 엔칸.isLateFiled = true; }
  경우.push({ 이름: '① 법대로 — ' + 고른것, 엔진: 'calculate_inheritance_tax', 엔진칸: 엔칸, 설명: '인적공제 ' + won(인적합) + ' → 기초·인적 또는 일괄 ' + won(일괄) });
  if (겹침막음) {
    경우.push({ 이름: '[견주기] 65세 이상 자녀에게 연로자공제까지 더함', 엔진: 'calculate_inheritance_tax', 견주기: true, 엔진칸: Object.assign({}, 엔칸, { elderlyHeirCount: 연로수 + 겹침막음 }), 설명: '§20① 후단에 1호+3호 합산 문구가 없음 — ' + won(겹침막음 * 50000000) + ' 많게 셈' });
  }
  if (포기로단독) {
    경우.push({ 이름: '[판단 대기 — 판단거리3차 #61: ①포기 뒤 혼자 받으면 단독 상속(일괄공제 불가) ②공동상속인이 있었으면 단독 아님 — 판례·예규 확인, 두 경우 유지] 상속포기로 배우자 혼자 남은 것을 단독 상속으로 안 보면(일괄공제 5억과 견줌)', 엔진: 'calculate_inheritance_tax', 엔진칸: Object.assign({}, 엔칸, { isSpouseOnlyHeir: false }), 설명: '§21② "단독으로 상속받는 경우" — 공동상속인 포기 뒤 혼자 받는 경우 포함 여부 해석 [판단 대기 — 판단거리3차 #61: ①포기 뒤 혼자 받으면 단독 상속(일괄공제 불가) ②공동상속인이 있었으면 단독 아님 — 판례·예규 확인, 두 경우 유지]' });
    잠정 = true;
  }
  if (!단독 && !무신고 && 거주) {
    const 장없이 = 200000000 + 인적합 - 장애합 * 10000000;
    if (장애합 > 0 && 장없이 < 500000000 && 200000000 + 인적합 > 500000000) 알림.push('장애인공제 ' + won(장애합 * 10000000) + '가 있어야 기초+인적이 5억을 넘음 — 장애인증명서·기대여명이 공제 크기를 가름');
  }
  // 알림
  if (자녀포기) 알림.push('상속을 포기한 자녀 ' + 자녀포기 + '명도 자녀공제(1호 "자녀 1명")에 셈 — 포기한 사람도 「상속인」(상증법 §2 4호)이라 2호·3호 「상속인 및 동거가족」에도 들어감(원문 확인 2026-11-04)');
  if (사람.some(function (x) { return /손자녀/.test(String(x.관계 || '')); })) 알림.push('손자녀는 1호 「자녀」가 아님 — 대습상속인이거나 부양 동거가족일 때 2~4호만');
  알림.push('배우자는 2호·3호 대상이 아님(괄호 "배우자는 제외") — 4호 장애인공제는 배우자공제와 합산');
  알림.push('동거가족 = 상속개시일 현재 피상속인이 사실상 부양한 직계존비속(배우자의 직계존속 포함)·형제자매(시행령 §18①) — 함께 살았다는 것만으로는 안 됨, 부양 사실 증빙');
  알림.push('인적공제·일괄공제는 공제 종합한도(§24: 과세가액 − 상속인 아닌 자 유증등 − 포기로 다음 순위가 받은 몫 − 가산한 사전증여 과세표준) 안에서만 — 엔진이 한도를 셈');
  if (무신고) 알림.push('신고하지 않으면 기초+인적이 5억보다 커도 5억만(§21① 단서) — 기한후신고(국세기본법 §45의3)도 신고로 봄');
  할일.push({ 무엇: '가족관계증명서·주민등록등본(상속개시일 현재)', 왜: '자녀·나이·동거 여부' });
  if (사람.some(function (x) { return jmYn_(x.동거부양) === true && jmYn_(x.상속인) === false; })) 할일.push({ 무엇: '부양 사실 증빙(생활비 이체·의료비 납부 등)', 왜: '상속인 아닌 동거가족 공제(시행령 §18①)' });
  const r = jmWrap_('인적공제', reqs, { 경우: 경우, 엔진칸: 경우.map(function (x) { return x.엔진칸; }), 엔진칸늘: true,
    사람줄: 줄, 인적공제합계: 인적합, 자녀수: 자녀수, 미성년연수합: 미성년합, 연로자수: 연로수, 장애인연수합: 장애합, 기초인적또는일괄: 일괄, 배우자단독: !!단독, 고른것: 고른것,
    알림: 알림, 할일: 할일, 견주는법: '기초공제 2억 + 인적공제 합계 vs 일괄공제 5억 중 큰 값(배우자 단독이면 앞쪽만, 무신고면 5억만)' });
  if (잠정 && !r.잠정) { r.잠정 = true; r.표시 = String(r.표시 || '') + '(잠정)'; }
  return r;
}

var JUDGE_MORE_ = { '인적공제': judgeHeirPersonalDeduction_, '일괄공제': judgeHeirPersonalDeduction_, '장애인공제': judgeHeirPersonalDeduction_, '연로자공제': judgeHeirPersonalDeduction_, '미성년자공제': judgeHeirPersonalDeduction_, '임대담보평가': judgeLeaseMortgageValuation_, '저당평가': judgeLeaseMortgageValuation_, '임대료환산': judgeLeaseMortgageValuation_, '담보평가': judgeLeaseMortgageValuation_, '공동명의': judgeJointOwnership_, '지분증여': judgeJointOwnership_, '공동명의전환': judgeJointOwnership_, '부부공동명의': judgeJointOwnership_, '합병의제배당': judgeMergerDividend_, '분할의제배당': judgeMergerDividend_, '합병대가': judgeMergerDividend_, '분할대가': judgeMergerDividend_, '합병교부금': judgeMergerDividend_, '자기주식': judgeTreasuryStock_, '주식소각': judgeTreasuryStock_, '배우자증여소각': judgeTreasuryStock_, '이익소각': judgeTreasuryStock_, '교차증여': judgeCrossGift_, '맞바꾼증여': judgeCrossGift_, '우회증여': judgeCrossGift_, '실질증여자': judgeCrossGift_, '사망퇴직금': judgeRetirementDeathPay_, '퇴직금등': judgeRetirementDeathPay_, '유족연금': judgeRetirementDeathPay_, '간주상속퇴직금': judgeRetirementDeathPay_, '대여금채권': judgeLoanReceivable_, '대여금': judgeLoanReceivable_, '채권평가': judgeLoanReceivable_, '회수불능채권': judgeLoanReceivable_, '보험금과세': judgeInsuranceTax_, '보험금': judgeInsuranceTax_, '사망보험금': judgeInsuranceTax_, '§34': judgeInsuranceTax_, '상속추정재산': judgeDisposalPresumption_, '처분재산 추정': judgeDisposalPresumption_, '상속개시전 처분재산': judgeDisposalPresumption_, '§15': judgeDisposalPresumption_, '가업승계증여': judgeBizSuccessionGift_, '가업승계 증여세 특례': judgeBizSuccessionGift_, '가업승계 주식 증여': judgeBizSuccessionGift_, '§30의6': judgeBizSuccessionGift_, '증여일': judgeGiftAcquisitionDate_, '증여재산 취득시기': judgeGiftAcquisitionDate_, '증여재산취득시기': judgeGiftAcquisitionDate_, '§24': judgeGiftAcquisitionDate_, '주식취득분': judgeStockLotMatching_, '선입선출': judgeStockLotMatching_, '§162⑤': judgeStockLotMatching_, '상속외국납부': judgeForeignEstateTaxCredit_, '외국납부세액공제': judgeForeignEstateTaxCredit_, '§29': judgeForeignEstateTaxCredit_, '미분양주택특례': judgeUnsoldHouse_, '미분양주택': judgeUnsoldHouse_, '준공후미분양': judgeUnsoldHouse_, '§98의3': judgeUnsoldHouse_, '양도담보물적납세': judgeTransferSecurity_, '물적납세의무': judgeTransferSecurity_, '양도담보권자': judgeTransferSecurity_, '§42': judgeTransferSecurity_, '연대납세의무': judgeJointLiability_, '연대납세': judgeJointLiability_, '§25': judgeJointLiability_, '국세우선': judgeTaxPriority_, '배당순위': judgeTaxPriority_, '§35': judgeTaxPriority_, '법인제2차납세의무': judgeCorpSecondary_, '법인제2차': judgeCorpSecondary_, '§40': judgeCorpSecondary_, '사업양수인': judgeBusinessTransferee_, '사업양수인제2차납세의무': judgeBusinessTransferee_, '§41': judgeBusinessTransferee_, '징수권소멸시효': judgeCollectionLimitation_, '소멸시효': judgeCollectionLimitation_, '국세징수권': judgeCollectionLimitation_, '§27': judgeCollectionLimitation_, '금융재산공제': judgeFinancialDeduction_, '금융재산상속공제': judgeFinancialDeduction_, '§22': judgeFinancialDeduction_, '추계': judgeEstimatedPrice_, '추계결정': judgeEstimatedPrice_, '추계취득가액': judgeEstimatedPrice_, '§176의2': judgeEstimatedPrice_, '후발적경정청구': judgeLateCorrectionClaim_, '후발적경정': judgeLateCorrectionClaim_, '경정청구사유': judgeLateCorrectionClaim_, '§45의2②': judgeLateCorrectionClaim_, '납부기한연장': judgePayDeadlineExtension_, '납부고지유예': judgePayDeadlineExtension_, '징수유예': judgePayDeadlineExtension_, '납부기한등연장': judgePayDeadlineExtension_, '국세징수법 §13': judgePayDeadlineExtension_, '공익신탁': judgePublicTrust_, '공익신탁불산입': judgePublicTrust_, '공익신탁재산': judgePublicTrust_, '§17': judgePublicTrust_, '§52': judgePublicTrust_, '공익법인사후관리': judgeCharityAftercare_, '출연재산사후관리': judgeCharityAftercare_, '공익법인 사후관리': judgeCharityAftercare_, '§48②': judgeCharityAftercare_, '문화유산징수유예': judgeCulturalDeferral_, '문화재징수유예': judgeCulturalDeferral_, '박물관자료': judgeCulturalDeferral_, '§74': judgeCulturalDeferral_, '신탁상속': judgeTrustInheritance_, '유언대용신탁': judgeTrustInheritance_, '수익자연속신탁': judgeTrustInheritance_, '신탁 상속': judgeTrustInheritance_, '§9': judgeTrustInheritance_, '농업법인출자': judgeFarmCorpContribution_, '영농조합 현물출자': judgeFarmCorpContribution_, '농업회사법인 현물출자': judgeFarmCorpContribution_, '§66⑦': judgeFarmCorpContribution_, '§68③': judgeFarmCorpContribution_, '중소기업통합': judgeIncorp32_, '중소기업 간 통합': judgeIncorp32_, '§31': judgeIncorp32_, '공장이전': judgeFactoryRelocation_, '공장 이전 분할납부': judgeFactoryRelocation_, '§85의7': judgeFactoryRelocation_, '§85의8': judgeFactoryRelocation_, '농지교환': judgeFarmlandExchange_, '농지 교환': judgeFarmlandExchange_, '교환·분합': judgeFarmlandExchange_, '§89①2호': judgeFarmlandExchange_, '비상장평가': judgeUnlistedValuation_, '비상장주식 평가': judgeUnlistedValuation_, '순자산가치': judgeUnlistedValuation_, '§54': judgeUnlistedValuation_, '주식교환': judgeShareSwap_, '주식의 포괄적 교환': judgeShareSwap_, '포괄적 교환': judgeShareSwap_, '§38': judgeShareSwap_, '자경산지': judgeSelfForest_, '자경산지 감면': judgeSelfForest_, '산지 감면': judgeSelfForest_, '§69의4': judgeSelfForest_, '법인아닌단체': judgeClanLand_, '종중': judgeClanLand_, '종중 양도': judgeClanLand_, '법인 아닌 단체': judgeClanLand_, '§2③': judgeClanLand_, '재상속': judgeReinheritance_, '단기재상속': judgeReinheritance_, '§30': judgeReinheritance_, '연이은상속': judgeReinheritance_, '2차상속': judgeReinheritance_, '신탁수익권': judgeTrustBeneficiary_, '신탁 수익권': judgeTrustBeneficiary_, '수익권양도': judgeTrustBeneficiary_, '§94①6호': judgeTrustBeneficiary_, '배우자양도추정': judgeSpouseTransfer44_, '§44': judgeSpouseTransfer44_, '배우자 양도 증여추정': judgeSpouseTransfer44_, '우회양도 증여추정': judgeSpouseTransfer44_, '장기일반감면': judgeRental9705_, '§97의5': judgeRental9705_, '97의5': judgeRental9705_, '임대주택감면': judgeRental9705_, '신축주택감면': judgeNewHouse99_2_, '신축주택': judgeNewHouse99_2_, '§99의2': judgeNewHouse99_2_, '99의2': judgeNewHouse99_2_, '2013신축주택': judgeNewHouse99_2_, '축사용지': judgeLivestockLand_, '축사': judgeLivestockLand_, '축사용지감면': judgeLivestockLand_, '재해손실': judgeDisasterLoss_, '재해손실공제': judgeDisasterLoss_, '재난손실': judgeDisasterLoss_, '경영회생': judgeFarmRevival_, '경영회생 농지': judgeFarmRevival_, '농지 환매': judgeFarmRevival_, '대체주택': judgeReplacementHouse_, '재건축 대체주택': judgeReplacementHouse_, '사업기간 대체주택': judgeReplacementHouse_, '농어촌주택': judgeRuralHouse_, '고향주택': judgeRuralHouse_, '농어촌주택특례': judgeRuralHouse_, '경매': judgeAuction_, '공매': judgeAuction_, '경락': judgeAuction_, '경매취득': judgeAuction_, '부동산권리': judgeAcquireRight_, '분양권판정': judgeAcquireRight_, '택지공급권': judgeAcquireRight_, '지역주택조합': judgeAcquireRight_, '납세의무승계': judgeSuccession_, '상속인 납세의무': judgeSuccession_, '사망 전 양도': judgeSuccession_, '납부유예': judgeDefer_, '가업납부유예': judgeDefer_, '상속세납부유예': judgeDefer_, '환급가산금': judgeRefund_, '국세환급': judgeRefund_, '경정환급': judgeRefund_, '부정행위': judgeFraud_, '가산세판정': judgeFraud_, '신고불성실': judgeFraud_, '제척기간': judgeExclusionPeriod_, '부과제척기간': judgeExclusionPeriod_, '장기임대특례': judgeRental9703_, '장기일반민간임대': judgeRental9703_, '97의3': judgeRental9703_, '나눠팔기': judgeSplitSale_, '토지분할양도': judgeSplitSale_, '감면한도합산': judgeSplitSale_, '개발제한구역': judgeGbPurchase_, '개발제한구역감면': judgeGbPurchase_, '그린벨트': judgeGbPurchase_, '영농상속': judgeFarmInheritance_, '영농상속공제': judgeFarmInheritance_, '영농 상속': judgeFarmInheritance_, '법인거래': judgeCorpIndividualDeal_, '법인 거래': judgeCorpIndividualDeal_, '가족법인 거래': judgeCorpIndividualDeal_, '특수관계법인 거래': judgeCorpIndividualDeal_, '비거주자양도': judgeNonResidentTransfer_, '비거주자 양도': judgeNonResidentTransfer_, '재외국민 양도': judgeNonResidentTransfer_, '외국인 양도': judgeNonResidentTransfer_, '부담부증여': judgeBurdenedGift_, '부담부 증여': judgeBurdenedGift_, '채무 인수 증여': judgeBurdenedGift_, '환산가산세': judgeNewBuildConversion_, '신축 환산 가산세': judgeNewBuildConversion_, '감정가액 가산세': judgeNewBuildConversion_, '미등기': judgeUnregistered_, '미등기양도': judgeUnregistered_, '미등기 양도자산': judgeUnregistered_, '확정신고': judgeFinalReturn_, '확정신고 의무': judgeFinalReturn_, '예정신고 합산': judgeFinalReturn_, '정비청산': judgeRedevCash_, '현금청산': judgeRedevCash_, '재개발 현금청산': judgeRedevCash_, '매도청구': judgeRedevCash_, '의제취득': judgeDeemedAcq_, '의제취득일': judgeDeemedAcq_, '1985년 전 취득': judgeDeemedAcq_, '세대판정': judgeHousehold_, '1세대 범위': judgeHousehold_, '세대 구성': judgeHousehold_, '중과판정': judgeSurcharge_, '다주택 중과': judgeSurcharge_, '중과 제외': judgeSurcharge_, '필요경비': judgeExpenses_, '필요경비 판정': judgeExpenses_, '자본적지출': judgeExpenses_, '주택여부': judgeIsHouse_, '주택 해당': judgeIsHouse_, '사실상 주거용': judgeIsHouse_, '부수토지': judgeHouseLandExcess_, '주택부수토지': judgeHouseLandExcess_, '부수토지 배율': judgeHouseLandExcess_, '양도시기': judgeTransferTiming_, '취득시기': judgeTransferTiming_, '양도·취득시기': judgeTransferTiming_, '보상금구분': judgeCompensationSplit_, '수용보상금': judgeCompensationSplit_, '보상금 가르기': judgeCompensationSplit_, '대토보상': judgeLandReplacement_, '대토': judgeLandReplacement_, '대토보상 과세이연': judgeLandReplacement_, '부동산매매업': judgeRealEstateDealer_, '매매업': judgeRealEstateDealer_, '부동산 단타': judgeRealEstateDealer_, '공동상속': judgeCoInheritedHouse_, '공동상속주택': judgeCoInheritedHouse_, '공동상속주택 소수지분': judgeCoInheritedHouse_, '다가구': judgeMultiHousehold_, '다가구주택': judgeMultiHousehold_, '다가구 한 채': judgeMultiHousehold_, '상속채무': judgeInheritDebt_, '상속 채무 공제': judgeInheritDebt_, '채무 공과금 장례비': judgeInheritDebt_, '토지건물구분': judgeLandBuildingSplit_, '일괄양도 안분': judgeLandBuildingSplit_, '토지 건물 가액 구분': judgeLandBuildingSplit_, '상속평가': judgeInheritValuation_, '상속 평가 선택': judgeInheritValuation_, '감정평가 신고': judgeInheritValuation_, '증여시기': judgeGiftTiming_, '증여 날짜': judgeGiftTiming_, '증여일 고르기': judgeGiftTiming_, '생활비교육비': judgeFamilySupportGift_, '비과세증여': judgeFamilySupportGift_, '혼인출산공제': judgeFamilySupportGift_, '세무조사절차': judgeTaxAudit_, '세무조사': judgeTaxAudit_, '세무조사 통지': judgeTaxAudit_, '세금대납': judgeTaxProxyPay_, '상속세 대납': judgeTaxProxyPay_, '증여세 대납': judgeTaxProxyPay_, '차명계좌': judgeBorrowedAccount_, '차명 예금': judgeBorrowedAccount_, '차명계좌 증여추정': judgeBorrowedAccount_, '부동산명의신탁': judgeNomineeRealty_, '명의신탁 부동산': judgeNomineeRealty_, '제2차납세의무': judgeSecondaryLiability_, '제2차 납세의무': judgeSecondaryLiability_, '과점주주': judgeSecondaryLiability_, '특별연고자': judgeSpecialRelation_, '특별연고자 분여': judgeSpecialRelation_, '재산분여': judgeSpecialRelation_, '기타자산': judgeOtherAsset_, '영업권': judgeOtherAsset_, '회원권': judgeOtherAsset_, '영업권·회원권': judgeOtherAsset_, '한정승인': judgeLimitedAccept_, '상속 한정승인': judgeLimitedAccept_, '특별한정승인': judgeLimitedAccept_, '국외증여': judgeForeignGift_, '국외 증여': judgeForeignGift_, '국외재산 증여': judgeForeignGift_, '거주자': judgeResidency_, '거주자 판정': judgeResidency_, '비거주자': judgeResidency_, '상속인': judgeHeirShares_, '법정상속분': judgeHeirShares_, '상속인·법정상속분': judgeHeirShares_, '불복기한': judgeAppealDeadline_, '불복': judgeAppealDeadline_, '경정청구기한': judgeAppealDeadline_, '양도여부': judgeTransferScope_, '계약해제': function (p) { p = Object.assign({}, p || {}); if (!p.유형) p.유형 = '계약해제'; return judgeTransferScope_(p); }, '양도로 보지 않음': judgeTransferScope_, '농지대토': judgeFarmSwap_, '대토': judgeFarmSwap_, '농지대토 감면': judgeFarmSwap_, '법인전환': judgeIncorp32_, '법인전환 이월과세': judgeIncorp32_, '8년자경': judgeSelfFarm_, '자경': judgeSelfFarm_, '8년 자경농지 감면': judgeSelfFarm_, '동거주택': judgeCohabit_, '동거주택 상속공제': judgeCohabit_, '가업상속': judgeFamilyBiz_, '가업상속공제': judgeFamilyBiz_, '청산인제2차납세의무': judgeLiquidatorSecondary_, '청산인': judgeLiquidatorSecondary_, '잔여재산분배': judgeLiquidatorSecondary_, '§38①': judgeLiquidatorSecondary_, '무상주': judgeBonusShare_, '자본전입': judgeBonusShare_, '무상증자': judgeBonusShare_, '의제배당무상주': judgeBonusShare_, '§17②2호': judgeBonusShare_, '대물변제': judgeDebtSettle_, '위자료': judgeDebtSettle_, '채무변제양도': judgeDebtSettle_, '양도담보충당': judgeDebtSettle_, '시효취득': judgeAdversePossession_, '점유취득시효': judgeAdversePossession_, '취득시효': judgeAdversePossession_, '시효취득양도': judgeAdversePossession_, '민법 §245': judgeAdversePossession_, '가족차용': judgeFamilyLoan_, '차용증': judgeFamilyLoan_, '금전무상대출': judgeFamilyLoan_, '무상대출': judgeFamilyLoan_, '저리대출': judgeFamilyLoan_, '§41의4': judgeFamilyLoan_, '담보제공이익': judgeFamilyLoan_, '§37②': judgeFamilyLoan_, '국외재산평가': judgeForeignAssetValuation_, '국외재산': judgeForeignAssetValuation_, '외국부동산평가': judgeForeignAssetValuation_, '외화평가': judgeForeignAssetValuation_, '환율평가': judgeForeignAssetValuation_, '§58의3': judgeForeignAssetValuation_, '§58의4': judgeForeignAssetValuation_, '서화골동품': judgeArtAntique_, '서화': judgeArtAntique_, '골동품': judgeArtAntique_, '미술품': judgeArtAntique_, '미술품물납': judgeArtAntique_, '§62②': judgeArtAntique_, '§52②': judgeArtAntique_, '§21②': judgeArtAntique_, '무체재산권': judgeIntangibleRight_, '특허권': judgeIntangibleRight_, '상표권': judgeIntangibleRight_, '저작권': judgeIntangibleRight_, '산업재산권': judgeIntangibleRight_, '§64': judgeIntangibleRight_, '§59⑤': judgeIntangibleRight_, '§21①7호': judgeIntangibleRight_, '증액경정': judgeCorrectionEffect_, '감액경정': judgeCorrectionEffect_, '경정의효력': judgeCorrectionEffect_, '경정 효력': judgeCorrectionEffect_, '특례제척기간': judgeCorrectionEffect_, '재처분': judgeCorrectionEffect_, '§22의3': judgeCorrectionEffect_, '§26의2⑥': judgeCorrectionEffect_, '연부연납': judgeInstallmentPermit_, '연부연납허가': judgeInstallmentPermit_, '연부연납담보': judgeInstallmentPermit_, '납세담보': judgeInstallmentPermit_, '연부연납취소': judgeInstallmentPermit_, '§71': judgeInstallmentPermit_, '국세징수법 §18': judgeInstallmentPermit_, '강제징수': judgeEnforcementCollection_, '체납처분': judgeEnforcementCollection_, '압류': judgeEnforcementCollection_, '압류금지': judgeEnforcementCollection_, '급여압류': judgeEnforcementCollection_, '공매절차': judgeEnforcementCollection_, '압류해제': judgeEnforcementCollection_, '국세징수법 §41': judgeEnforcementCollection_, '주식매수청구': judgeAppraisalRightSale_, '주식매수청구권': judgeAppraisalRightSale_, '반대주주': judgeAppraisalRightSale_, '매수청구양도': judgeAppraisalRightSale_, '§94①3호': judgeAppraisalRightSale_, '주식매수선택권': judgeStockOption_, '스톡옵션': judgeStockOption_, '벤처스톡옵션': judgeStockOption_, '선택권행사이익': judgeStockOption_, '§16의2': judgeStockOption_, '§16의4': judgeStockOption_, '우리사주': judgeEsop_, '우리사주조합': judgeEsop_, '우리사주인출': judgeEsop_, '자사주배정': judgeEsop_, '§88의4': judgeEsop_, '전환사채': judgeConvertibleBond_, '전환사채이익': judgeConvertibleBond_, '신주인수권부사채': judgeConvertibleBond_, '주식전환이익': judgeConvertibleBond_, '§40': judgeConvertibleBond_, '공동사업출자': judgePartnershipContribution_, '동업출자': judgePartnershipContribution_, '조합출자': judgePartnershipContribution_, '공동사업탈퇴': judgePartnershipContribution_, '현물출자양도': judgePartnershipContribution_, '송달': judgeServiceValidity_, '송달적법': judgeServiceValidity_, '공시송달': judgeServiceValidity_, '전자송달': judgeServiceValidity_, '고지서송달': judgeServiceValidity_, '국세기본법 §8': judgeServiceValidity_, '§11': judgeServiceValidity_ };
// 판정 글(알림·할일·표시)에 계산 범위 밖 세금이 나오는지 — 「아님·없음·과세 안 함」으로 부정한 줄은 뺀다
function judgeOutOfScope_(r) {
  const lines = [].concat(r.알림 || [], r.할일 || [], r.확인할것 || [], [r.표시 || '']).map(String).filter(function (t) { return !/(아님|아니|없음|안 됨|과세 안|해당 없|부과분 제외|비교 밖|건강보험)/.test(t) || /따로|별도|넣어/.test(t); });
  const txt = lines.join(' '), out = [];
  if (/법인세/.test(txt)) out.push('법인세');
  if (/종합소득세|사업소득|기타소득|의제배당|배당소득|근로소득|상여/.test(txt)) out.push('종합소득세');
  return out;
}
// 사건에서 부름(ledgerJudgeRun_가 1세대1주택이 아닌 묶음을 넘김) — 사실(facts)은 넥스·세무사님이 준 값, 결과는 장부 기록 + 물건 줄 판정 묶음들 + 장부 판정 칸(L.judge)
function judgeMoreRun_(c, input, by) {
  const kind = String(input.묶음 || input.group || ''), fn = JUDGE_MORE_[kind.replace(/\s+/g, ' ').trim()] || JUDGE_MORE_[kind.replace(/\s/g, '')];
  if (!fn) return { ok: false, error: '없는 묶음: ' + kind + ' — 1세대1주택·8년자경·농지대토·양도여부·계약해제·한정승인·특별연고자·제2차납세의무·부동산명의신탁·차명계좌·세금대납·세무조사절차·생활비교육비·증여시기·상속평가·토지건물구분·상속채무·다가구·공동상속·부동산매매업·대토보상·보상금구분·양도시기·부수토지·주택여부·필요경비·중과판정·세대판정·의제취득·정비청산·확정신고·미등기·환산가산세·부담부증여·비거주자양도·법인거래·영농상속·개발제한구역·나눠팔기·장기임대특례·제척기간·부정행위·환급가산금·납부유예·납세의무승계·부동산권리·경매·농어촌주택·대체주택·경영회생·재해손실·축사용지·신축주택감면·장기일반감면·배우자양도추정·기타자산·불복기한·상속인·거주자·동거주택·가업상속·법인전환·국외증여·공익법인사후관리·공익신탁·납부기한연장·후발적경정청구·추계·금융재산공제·징수권소멸시효·사업양수인·법인제2차납세의무·국세우선·연대납세의무·양도담보물적납세·미분양주택특례·상속외국납부·주식취득분·증여일·가업승계증여·상속추정재산·보험금과세·대여금채권·사망퇴직금·교차증여·자기주식·합병의제배당·공동명의·임대담보평가·인적공제·청산인제2차납세의무 중 하나' };
  let r, facts = input.facts || input.사실 || {}, mapNote = '';
  // [2026.11.04 큰일 ⑦] 법인 이름이 있으면 가족 지도 지분을 먼저 읽는다 — 칸에 넣은 값이 있으면 그 값이 우선
  if (typeof famCorpFill_ === 'function' && c && (fn === JUDGE_MORE_['제2차납세의무'] || fn === JUDGE_MORE_['법인거래'])) {
    try { const fl = famCorpFill_(c, fn === JUDGE_MORE_['제2차납세의무'] ? '제2차' : '가족지분', facts); if (fl.채움.length) { facts = fl.facts; mapNote = '가족 지도에서 채운 칸: ' + fl.채움.join('·') + ' — ' + fl.지도.출처 + ' (주주명부·주식변동상황명세서로 확인할 것)'; } } catch (e) { mapNote = '⚠ 가족 지도 지분을 읽지 못함: ' + String(e && e.message || e); }
  }
  try { r = fn(facts); } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  const out = { ok: true, 결과: r, 넣은사실: facts, 알림: (mapNote ? [mapNote] : []).concat(r.알림 || []) };
  if (input.write === false) { out.장부 = '보기만 — 장부에 넣지 않음'; return out; }
  const who = String(by || '세무사님').slice(0, 6);
  try {
    ledgerMutate_(c.id, function (L) {
      L.judge = L.judge || {};
      const oid = String(input.objectId || input.물건 || '');
      // [2026.11.02 쪼개 처리 ③] 물건이 여럿이면 물건마다 따로 남긴다(같은 묶음을 두 물건에 돌리면 앞 결과를 덮던 것) — 열쇠 = 묶음@물건id
      L.judge[r.묶음 + (oid ? '@' + oid : '')] = { 결론: r.결론, 잠정: r.잠정, 표시: r.표시, 엔진칸: (r.결론 === '충족' || r.엔진칸늘) ? r.엔진칸 : {}, 요건: r.요건, 할일: r.할일 || [], 기한: (typeof awDeadlinesFromResult_ === 'function' ? awDeadlinesFromResult_(r) : []), 때: caseProcNow_(), 누가: who, 사실: facts, 물건: oid };
      out.판정열쇠 = 'judge.' + r.묶음 + (oid ? '@' + oid : ''); // 자문 항목 calc·links에 이 열쇠를 넣으면 요약에 판정 결과가 풀려 나온다
      const o = oid && L.obj && Array.isArray(L.obj.list) ? L.obj.list.filter(function (x) { return x && x.id === oid; })[0] : null;
      if (o) { const one = { 묶음: r.묶음, 결론: r.결론, 잠정: !!r.잠정, 남은것: (r.남은것 || []).slice(0, 12), 표시: r.표시, 때: caseProcNow_(), 누가: who }; const list = (o.판정 && Array.isArray(o.판정.묶음들) ? o.판정.묶음들 : []).filter(function (x) { return x && x.묶음 !== r.묶음; }).concat([one]); o.판정 = Object.assign({}, o.판정 || one, { 묶음들: list }); out.물건 = o.id; }
      // [2026.11.04 판단거리 ①] 법인세·종합소득세(사업·기타·배당 소득 등)는 이 시스템 계산 범위 밖 — 판정 글에 그 몫이 나오면 장부 여쭐 것에 한 줄 세움(계산은 세무사님 값으로)
      const oos = judgeOutOfScope_(r);
      if (oos.length) { const qp = 'q:범위밖:' + r.묶음 + (oid ? '@' + oid : ''); ledgerAskInner_(L, qp, { label: '범위 밖 세금 — ' + oos.join('·'), question: '이 몫은 ' + oos.join('·') + ' — 이 도구 계산 범위 밖입니다. 세무사님 계산값을 넣어 주세요(판정: ' + r.묶음 + ')', by: 'GAS', keep: true }); out.알림.push('범위 밖 세금(' + oos.join('·') + ') — 장부 여쭐 것에 올림'); }
      ledgerLogTo_(L, { by: who, what: '종합판정', path: 'judge.' + r.묶음 + (oid ? '@' + oid : ''), detail: r.표시.slice(0, 200) });
    });
    out.장부 = '판정 기록 — 장부 계산(상속)이 충족이면 엔진칸을 넣고, 잠정·안 됨이면 넣지 않음' + (r.묶음 === '8년 자경농지 감면' ? ' · 양도는 계산 가정(over)으로 isEightYearFarmland를 주어 경우(안)로 견줄 것' : '');
  } catch (e) { out.알림.push('판정 기록 못 남김: ' + e.message); }
  return out;
}
