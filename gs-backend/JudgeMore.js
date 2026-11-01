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
//       대표재직: {절반이상, 십년승계, 최근10년중5년}(예/아니오), 상속인생년월일, 상속인종사년수, 피상속인65세전사망(예/아니오), 임원취임(신고기한까지, 예/아니오/앞으로), 업종해당(시행령 별표, 예/아니오), 가업상속재산가액 }
function judgeFamilyBiz_(p) {
  p = p || {};
  const 개시 = jmYmd_(p.상속개시일), reqs = [], notes = [], 할일 = [];
  const size = String(p.기업규모 || '');
  reqs.push(jmReq_('중소기업 또는 중견기업(중견은 직전 3년 매출 평균 5천억원 미만)', !size ? null : /그밖|대기업/.test(size) ? false : /중견/.test(size) ? (p.매출평균3년 == null || p.매출평균3년 === '' ? null : famNum_(p.매출평균3년) < 500000000000) : true, size || '기업 규모를 모름', '상증법 §18의2①·시행령 §15①②'));
  reqs.push(jmReq_('주된 업종이 시행령 별표 업종', jmYn_(p.업종해당), '', '시행령 §15①1호·②1호'));
  const 경영 = jmYmd_(p.경영시작일), yrs = 경영 && 개시 ? jmDays_(경영, 개시) / 365.25 : null;
  reqs.push(jmReq_('피상속인이 10년 이상 계속 경영', yrs == null ? null : yrs >= 10, yrs == null ? '경영 시작일을 모름(사업자등록·법인등기)' : '경영 ' + yrs.toFixed(1) + '년', '상증법 §18의2①'));
  const share = p.지분율 == null || p.지분율 === '' ? null : Number(String(p.지분율).replace(/[^\d.]/g, ''));
  const listed = jmYn_(p.상장) === true;
  reqs.push(jmReq_('피상속인+특수관계인 지분 ' + (listed ? '20' : '40') + '% 이상을 10년 이상 계속 보유(최대주주등)', share == null ? null : share < (listed ? 20 : 40) ? false : jmYn_(p.지분10년보유), share == null ? '지분율을 모름(주주명부)' : '지분 ' + share + '%', '시행령 §15③1호가목'));
  const d = p.대표재직 || {}, anyRep = [d.절반이상, d.십년승계, d.최근10년중5년].map(jmYn_);
  reqs.push(jmReq_('피상속인 대표이사 재직(가업 기간의 50% 이상 · 10년 이상(상속인 승계) · 최근 10년 중 5년 이상 중 하나)', anyRep.indexOf(true) >= 0 ? true : anyRep.every(function (x) { return x === false; }) ? false : null, '', '시행령 §15③1호나목'));
  const 생 = jmYmd_(p.상속인생년월일);
  reqs.push(jmReq_('상속인 상속개시일 현재 18세 이상', 생 && 개시 ? famAddY_(생, 18) <= 개시 : null, '', '시행령 §15③2호가목'));
  reqs.push(jmReq_('상속인 상속개시 전 2년 이상 가업 종사', jmYn_(p.피상속인65세전사망) === true ? true : p.상속인종사년수 == null || p.상속인종사년수 === '' ? null : Number(p.상속인종사년수) >= 2, jmYn_(p.피상속인65세전사망) === true ? '피상속인이 65세 전 사망 — 이 요건 없음' : '', '시행령 §15③2호나목'));
  const exec = String(p.임원취임 == null ? '' : p.임원취임);
  reqs.push(jmReq_('신고기한까지 임원 취임(그 뒤 2년 안 대표이사 취임)', /앞으로|예정/.test(exec) ? null : jmYn_(exec), /앞으로|예정/.test(exec) ? '아직 — 할 일로 남김' : '', '시행령 §15③2호다·라목'));
  const lim = yrs == null ? null : yrs >= 30 ? 60000000000 : yrs >= 20 ? 40000000000 : yrs >= 10 ? 30000000000 : 0;
  const val = famNum_(p.가업상속재산가액), ded = lim != null && val ? Math.min(val, lim) : null;
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
var JUDGE_MORE_ = { '8년자경': judgeSelfFarm_, '자경': judgeSelfFarm_, '8년 자경농지 감면': judgeSelfFarm_, '동거주택': judgeCohabit_, '동거주택 상속공제': judgeCohabit_, '가업상속': judgeFamilyBiz_, '가업상속공제': judgeFamilyBiz_ };
// 사건에서 부름(ledgerJudgeRun_가 1세대1주택이 아닌 묶음을 넘김) — 사실(facts)은 넥스·세무사님이 준 값, 결과는 장부 기록 + 물건 줄 판정 묶음들 + 장부 판정 칸(L.judge)
function judgeMoreRun_(c, input, by) {
  const kind = String(input.묶음 || input.group || ''), fn = JUDGE_MORE_[kind.replace(/\s+/g, ' ').trim()] || JUDGE_MORE_[kind.replace(/\s/g, '')];
  if (!fn) return { ok: false, error: '없는 묶음: ' + kind + ' — 1세대1주택·8년자경·동거주택·가업상속 중 하나' };
  const r = fn(input.facts || input.사실 || {});
  const out = { ok: true, 결과: r, 넣은사실: input.facts || input.사실 || {}, 알림: (r.알림 || []).slice() };
  if (input.write === false) { out.장부 = '보기만 — 장부에 넣지 않음'; return out; }
  const who = String(by || '세무사님').slice(0, 6);
  try {
    ledgerMutate_(c.id, function (L) {
      L.judge = L.judge || {};
      const oid = String(input.objectId || input.물건 || '');
      // [2026.11.02 쪼개 처리 ③] 물건이 여럿이면 물건마다 따로 남긴다(같은 묶음을 두 물건에 돌리면 앞 결과를 덮던 것) — 열쇠 = 묶음@물건id
      L.judge[r.묶음 + (oid ? '@' + oid : '')] = { 결론: r.결론, 잠정: r.잠정, 표시: r.표시, 엔진칸: r.결론 === '충족' ? r.엔진칸 : {}, 요건: r.요건, 할일: r.할일 || [], 때: caseProcNow_(), 누가: who, 사실: input.facts || input.사실 || {}, 물건: oid };
      out.판정열쇠 = 'judge.' + r.묶음 + (oid ? '@' + oid : ''); // 자문 항목 calc·links에 이 열쇠를 넣으면 요약에 판정 결과가 풀려 나온다
      const o = oid && L.obj && Array.isArray(L.obj.list) ? L.obj.list.filter(function (x) { return x && x.id === oid; })[0] : null;
      if (o) { const one = { 묶음: r.묶음, 결론: r.결론, 잠정: !!r.잠정, 남은것: (r.남은것 || []).slice(0, 12), 표시: r.표시, 때: caseProcNow_(), 누가: who }; const list = (o.판정 && Array.isArray(o.판정.묶음들) ? o.판정.묶음들 : []).filter(function (x) { return x && x.묶음 !== r.묶음; }).concat([one]); o.판정 = Object.assign({}, o.판정 || one, { 묶음들: list }); out.물건 = o.id; }
      ledgerLogTo_(L, { by: who, what: '종합판정', path: 'judge.' + r.묶음 + (oid ? '@' + oid : ''), detail: r.표시.slice(0, 200) });
    });
    out.장부 = '판정 기록 — 장부 계산(상속)이 충족이면 엔진칸을 넣고, 잠정·안 됨이면 넣지 않음' + (r.묶음 === '8년 자경농지 감면' ? ' · 양도는 계산 가정(over)으로 isEightYearFarmland를 주어 경우(안)로 견줄 것' : '');
  } catch (e) { out.알림.push('판정 기록 못 남김: ' + e.message); }
  return out;
}
