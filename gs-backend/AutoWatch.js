// =========================================================
// [2026.11.04 혼자 도는 기능 확대 1순위] 세무사님 "시스템이 꺼져 있어도 독자적으로 돌아가는 기능을 확대할 부분이 있는지 찾아보자" → "일단 1순위만 구현하자"
//  검토서: 총괄관리자\_기록\혼자도는기능_확대_검토_20261104.html (1순위 ①~⑦, 모두 토큰 0·되돌릴 수 있음)
//   ① 고객창구 업로드 → 올린 파일을 바로 미리 읽기 줄·한 바퀴 줄에(장부 「고객 받음」·작업일지·문자는 custUploadNote_에 이미 있었음)
//   ② 법령 개정(환경 감시) → 그 조문을 근거로 쓴 진행 사건 찾아 「답하실 것」(awLawImpact_)
//   ③ 판정·계산이 셈한 법정기한을 장부에 모아 달력·아침 문자에(awDeadlines…)
//   ④ 미수 30일 넘은 수금 → 「답하실 것」(awUnpaidCheck_)
//   ⑤ 오래 멈춘 진행 사건 → 「답하실 것」(awStaleCheck_)
//   ⑥ 완료 사건 공유 정리를 새벽 2시 묶음에서(awNightly_가 t6ShareCleanup_ 부름)
//   ⑦ 배포 때 엔진·판정 회귀 자동 — PC 쪽 tools/mark-deployed.js --start
//  「답하실 것」 = 대시보드 카드(Federation.js commStatus_ autoNotices) — 세무사님이 [확인]을 누르면 지워진다. 새로 생긴 알림은 아침 문자 "그 밖에" 줄에도 한 번.
//  모두 GAS만, AI 없음, 0원. 값·칸은 바꾸지 않는다(알리기·기록만). 사건별 넥스 미리 읽기 스위치와 무관.
// =========================================================
var AW_NOTICE_PROP_ = 'aw_notices', AW_DEADLINE_PROP_ = 'aw_deadlines', AW_NIGHT_PROP_ = 'aw_nightly_last';
function awToday_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); }
// [2026.11.12] 세무사님 "<9132일째 움직임이 없음> 시스템 오류 아닌가?" — 사건 행의 수정일은 서버 안에서는 날짜 객체라 String()하면 "Wed Nov 12 2026 …"이 되고,
//  앞 10자 "Wed Nov 12"는 연도가 없어 2001년으로 읽혀 모든 진행 사건이 9,132일째로 올라갔다. 날짜 객체·ISO 글자·요일 글자를 모두 yyyy-MM-dd로.
function awYmd_(v) {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  const t = String(v).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const ms = Date.parse(t); return isNaN(ms) ? '' : Utilities.formatDate(new Date(ms), 'Asia/Seoul', 'yyyy-MM-dd');
}
function awDaysBetween_(a, b) { try { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); } catch (e) { return 0; } }
function awCases_() { try { const r = work_getCases({}); const o = r && r.getContent ? JSON.parse(r.getContent()) : r; return (o && o.cases) || []; } catch (e) { return []; } }
// [2026.11.12] 세무사님 "「답하실 것」에 뭐가 그리 많이 올라가 있는가?" → "권장대로" — 가상·모의·시험 사건은 알림(기한·멈춘 사건·미수)에서 뺀다.
//  예전 /시험용|가상사건/ 은 「가상양도12」·「가상증여9」·「가상상속자문(○○○)_상속_자문」·「모의…」 같은 실제 이름을 못 걸러 진행 사건 전부가 「멈춘 사건」 한 줄씩 올라갔다.
function awVirtual_(c) { const n = String(c && c.사건명 || ''), g = String(c && c.고객명 || ''), o = String(c && c.개요 || ''); return /시험용|가상사건|모의사건/.test(n + o) || /^(가상|모의|시험|테스트)/.test(n.trim()) || /^(가상|모의|시험|테스트)/.test(g.trim()); }
function awOpen_(c) { return c && String(c.상태 || '') !== '완료' && String(c.상태 || '') !== '보류' && !awVirtual_(c); }
// 밤 점검 첫머리: 사건이 달린 알림 중 그 사건이 이제 진행 사건이 아니면(완료·보류·가상·지워짐) 지운다 — 쌓인 것은 세무사님이 줄마다 [확인]을 누르지 않아도 정리되게
function awNoticePrune_(cases) {
  const open = {}; (cases || []).forEach(function (c) { if (c && c.id && awOpen_(c)) open[c.id] = 1; });
  let removed = 0;
  try {
    withLockStrict_(5000, function () {
      const p = PropertiesService.getScriptProperties();
      let q = []; try { q = JSON.parse(p.getProperty(AW_NOTICE_PROP_) || '[]'); } catch (e) { q = []; }
      const bad = function (x) { // [2026.11.12] 날짜 읽기 오류로 올라간 것: 멈춘 사건 열쇠의 마지막 날짜·미수 글의 마지막 고침이 yyyy-MM-dd 꼴이 아님
        if (!x) return true;
        if (x.kind === '멈춘 사건') { const m = /^stale:[^:]*:(.*)$/.exec(String(x.key || '')); return !!m && !/^\d{4}-\d{2}-\d{2}$/.test(m[1]) || /\s[1-9]\d{3,}일째/.test(String(x.text || '')); }
        if (x.kind === '미수') return /마지막 고침/.test(String(x.text || '')) && !/마지막 고침 \d{4}-\d{2}-\d{2}/.test(String(x.text || ''));
        return false;
      };
      const keep = q.filter(function (x) { return !bad(x) && (!(x && x.caseId) || open[x.caseId]); });
      removed = q.length - keep.length;
      if (removed) p.setProperty(AW_NOTICE_PROP_, JSON.stringify(keep));
    });
  } catch (e) {}
  return removed;
}

// ---------- 「답하실 것」 알림 목록 ----------
function awNoticeList_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(AW_NOTICE_PROP_) || '[]'); } catch (e) { return []; } }
function awNoticeAdd_(kind, text, caseId, key, toDigest) { // 같은 열쇠는 한 번만(이미 있으면 false) — 새로 생긴 것만 아침 문자 줄에
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!text) return false;
  let added = false;
  try {
    withLockStrict_(5000, function () {
      const p = PropertiesService.getScriptProperties();
      let q = []; try { q = JSON.parse(p.getProperty(AW_NOTICE_PROP_) || '[]'); } catch (e) { q = []; }
      const k = String(key || (kind + ':' + text)).slice(0, 120);
      if (q.some(function (x) { return x && x.key === k; })) return;
      q.push({ id: 'aw_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), kind: String(kind || '').slice(0, 20), text: text, caseId: String(caseId || ''), key: k, at: caseProcNow_() });
      p.setProperty(AW_NOTICE_PROP_, JSON.stringify(q.slice(-60)));
      added = true;
    });
  } catch (e) {}
  if (added && toDigest !== false) { try { notifyOwner_('normal', kind + ' — ' + text, caseId); } catch (e) {} }
  return added;
}
function awNoticeSeen_(body) { // 화면 [확인]: id 하나 또는 all
  const id = String(body && body.id || ''), all = !!(body && body.all);
  try {
    withLockStrict_(5000, function () {
      const p = PropertiesService.getScriptProperties();
      let q = []; try { q = JSON.parse(p.getProperty(AW_NOTICE_PROP_) || '[]'); } catch (e) { q = []; }
      q = all ? [] : q.filter(function (x) { return x && x.id !== id; });
      p.setProperty(AW_NOTICE_PROP_, JSON.stringify(q));
    });
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  return { ok: true, left: awNoticeList_().length };
}

// ---------- ① 고객창구 업로드 → 바로 읽기 줄 ----------
function awPortalUploaded_(wc, fileId) {
  if (!fileId) return;
  try { cpPrereadQueue_(fileId); } catch (e) {}
  if (wc && wc.id) { try { cpFlowQueueAdd_(wc.id, '고객창구 업로드', 'read'); } catch (e) {} }
}

// ---------- ② 법령 개정 → 영향 받는 진행 사건 ----------
// 장부의 판정 기록(L.judge)·자문 장부(L.adv)에 "§조"가 적혀 있는 진행 사건을 찾는다. 법령 이름이 그 앞 12자 안에 있으면 "맞음", 없으면 "잠정"(다른 법 같은 조 번호일 수 있음).
var AW_LAW_ALIAS_ = { '소득세법': ['소득세법', '소득령', '소득세법 시행령', '소득세법시행령', '소득세법 시행규칙'], '상속세 및 증여세법': ['상증법', '상증세법', '상증령', '상속세 및 증여세법', '상속세및증여세법', '상증규칙'],
  '조세특례제한법': ['조특법', '조특령', '조세특례제한법', '조특규칙'], '국세기본법': ['국세기본법', '국기법', '국기령', '국세기본법 시행령'], '국세징수법': ['국세징수법', '징수법', '징수령'], '국제조세조정에 관한 법률': ['국조법', '국조령', '국제조세조정'] };
function awLawImpact_(lawName, articles, when) {
  const arts = (articles || []).map(function (a) { return String(a && (a.조 || a) || '').trim(); }).filter(Boolean).slice(0, 40);
  if (!arts.length) return { cases: 0 };
  const base = String(lawName || '').replace(/\s+/g, ''), aliases = AW_LAW_ALIAS_[String(lawName || '')] || AW_LAW_ALIAS_[base] || [String(lawName || '')];
  const esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  const aliasRe = new RegExp('(' + aliases.map(function (a) { return esc(a.replace(/\s+/g, '')); }).join('|') + ')');
  const res = []; const t0 = Date.now();
  awCases_().filter(awOpen_).slice(0, 80).forEach(function (c) {
    if (Date.now() - t0 > 120000) return;
    let L = null; try { L = ledgerLoad_(c.id, true); } catch (e) { L = null; }
    if (!L) return;
    let text = ''; try { text = JSON.stringify({ j: L.judge || {}, a: L.adv || {} }); } catch (e) { text = ''; }
    if (!text || text.indexOf('§') === -1) return;
    const hit = [], soft = [];
    arts.forEach(function (art) {
      const re = new RegExp('§\\s*' + esc(art) + '(?![0-9의])', 'g'); let m;
      while ((m = re.exec(text))) { const before = text.slice(Math.max(0, m.index - 14), m.index).replace(/\s+/g, ''); (aliasRe.test(before) ? hit : soft).push(art); if (hit.length + soft.length > 40) break; }
    });
    const u = function (arr) { return arr.filter(function (v, i, a) { return a.indexOf(v) === i; }); };
    if (hit.length || soft.length) res.push({ caseId: c.id, 사건명: String(c.사건명 || c.고객명 || ''), 맞음: u(hit), 잠정: u(soft).filter(function (a) { return hit.indexOf(a) === -1; }) });
  });
  res.forEach(function (r) {
    const line = '「' + lawName + '」 ' + (when || '개정') + ' — 바뀐 조문 ' + (r.맞음.length ? r.맞음.map(function (a) { return '§' + a; }).join('·') : '') + (r.잠정.length ? (r.맞음.length ? ' · 잠정 ' : '잠정 ') + r.잠정.map(function (a) { return '§' + a; }).join('·') : '')
      + '을(를) 근거로 쓴 사건 「' + r.사건명 + '」 — 판정·자문을 다시 볼 것';
    awNoticeAdd_('법령 개정 영향', line, r.caseId, 'law:' + base + ':' + (when || '') + ':' + r.caseId + ':' + arts.slice(0, 6).join(','));
    try { caseProcAlert_(r.caseId, '법령 개정', line); } catch (e) {}
    try { cpNexMomentAdd_(r.caseId, ['법령 개정: ' + line.slice(0, 160)]); } catch (e) {} // 낮에 넥스가 한 줄 — 미리 읽기 스위치가 꺼진 사건은 그쪽에서 걸러짐
  });
  return { cases: res.length, list: res };
}

// ---------- ③ 법정기한 모으기 → 장부(사건 기록부) · 달력 · 아침 문자 ----------
// 판정 결과(r) 안에서 이름에 기한·마감·만료가 든 날짜(YYYY-MM-DD)를 4단계까지 훑어 모은다 — 값은 그대로, 이름은 열쇠 이름(한글)
function awDeadlinesFromResult_(r) {
  const out = [], seen = {};
  const push = function (name, v, flag) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return; const k = name + '@' + v; if (seen[k] || out.length >= 12) return; seen[k] = 1; out.push({ 이름: String(name).slice(0, 40), 날짜: String(v), 잠정: !!flag }); };
  const walk = function (o, depth, pname, flag, inArr) {
    if (!o || typeof o !== 'object' || depth > 4) return;
    if (Array.isArray(o)) { o.forEach(function (x) { if (x && typeof x === 'object') { if (x.마감 || x.기한) push(String(x.이름 || x.종류 || x.사유 || pname || '기한'), x.마감 || x.기한, flag || x.잠정); walk(x, depth + 1, pname, flag || x.잠정, true); } }); return; }
    Object.keys(o).forEach(function (k) { const v = o[k]; if (inArr && (k === '마감' || k === '기한')) return; /* 배열 줄은 위에서 이름 붙여 넣었음 */ if (/^(기한|마감|만료|신고기한|납부기한)$|기한$|마감$|만료일?$/.test(k) && typeof v === 'string') push(k, v, flag || o.잠정); else if (v && typeof v === 'object') walk(v, depth + 1, k, flag || o.잠정, false); });
  };
  walk(r, 0, '', !!(r && r.잠정), false);
  return out;
}
// 한 사건의 기한 = 판정 기록(L.judge[*].기한) + 사건 행 법정일. 사건 기록부 sv.autoDeadlines에 두고(바뀔 때만 씀), 바뀌면 달력을 뒤에서 다시 맞춘다
function awDeadlinesCollect_(c) {
  if (!c || !c.id) return [];
  let L = null; try { L = ledgerLoad_(c.id, true); } catch (e) { L = null; }
  const list = [], seen = {};
  const add = function (d, src) { if (!d || !d.날짜 || seen[d.이름 + '@' + d.날짜]) return; seen[d.이름 + '@' + d.날짜] = 1; list.push({ 이름: d.이름, 날짜: d.날짜, 잠정: !!d.잠정, 출처: src }); };
  if (L && L.judge) Object.keys(L.judge).forEach(function (k) { const j = L.judge[k]; (j && j.기한 || []).forEach(function (d) { add(d, '판정 ' + k.split('@')[0]); }); });
  list.sort(function (a, b) { return a.날짜 < b.날짜 ? -1 : 1; });
  try {
    const sv0 = caseProcLoad_(c.id) || {};
    if (JSON.stringify(sv0.autoDeadlines || []) !== JSON.stringify(list)) {
      caseProcPatch_(c.id, function (sv) { sv.autoDeadlines = list; });
      try { bgEnqueue_('case_calendar', { caseId: c.id }, 'cal_' + c.id, '법정기한 모음 바뀜'); } catch (e) {}
    }
  } catch (e) {}
  return list;
}
// 밤에 전체: 진행 사건의 기한을 한 표(스크립트 속성)로 — 아침 문자·대시보드는 드라이브를 안 열고 이 표만 읽는다. 30일 안 기한은 「답하실 것」에 한 번.
function awDeadlinesNightly_(cases) {
  const today = awToday_(), rows = [], t0 = Date.now();
  (cases || awCases_()).filter(awOpen_).forEach(function (c) {
    if (Date.now() - t0 > 150000) return;
    const ds = awDeadlinesCollect_(c).slice(); // 사본 — 사건 법정일을 기록부 목록에 섞지 않게(섞이면 밤마다 기록부를 다시 쓰게 됨)
    if (c.법정일 && /^\d{4}-\d{2}-\d{2}$/.test(String(c.법정일))) ds.push({ 이름: '법정기한(사건)', 날짜: String(c.법정일), 잠정: false, 출처: '사건' });
    ds.forEach(function (d) {
      if (d.날짜 < today) return;
      rows.push({ caseId: c.id, 사건명: String(c.사건명 || c.고객명 || '').slice(0, 30), 이름: d.이름, 날짜: d.날짜, 잠정: !!d.잠정 });
      const left = awDaysBetween_(today, d.날짜);
      if (left <= 30 && d.출처 !== '사건') awNoticeAdd_('기한', (left === 0 ? '오늘' : left + '일 뒤') + ' ' + d.날짜 + ' ' + d.이름 + (d.잠정 ? '(잠정)' : '') + ' — 「' + String(c.사건명 || c.고객명 || '') + '」', c.id, 'dl:' + c.id + ':' + d.이름 + '@' + d.날짜);
    });
  });
  rows.sort(function (a, b) { return a.날짜 < b.날짜 ? -1 : 1; });
  try { PropertiesService.getScriptProperties().setProperty(AW_DEADLINE_PROP_, JSON.stringify(rows.slice(0, 200))); } catch (e) {}
  return rows;
}
function awDeadlineLines_(days) { // 아침 문자용: 오늘~days일 안 기한(사건 법정일은 문자 본문이 따로 세므로 뺌)
  const today = awToday_(); let rows = []; try { rows = JSON.parse(PropertiesService.getScriptProperties().getProperty(AW_DEADLINE_PROP_) || '[]'); } catch (e) { rows = []; }
  return rows.filter(function (r) { return r.이름 !== '법정기한(사건)' && r.날짜 >= today && awDaysBetween_(today, r.날짜) <= (days || 7); })
    .map(function (r) { return '· ' + r.날짜.slice(5) + ' ' + r.이름 + (r.잠정 ? '(잠정)' : '') + ' ' + r.사건명; });
}

// ---------- ④ 미수 수금 ----------
// 청구 = 사건개요.청구액(처리개요 수금 카드) · 받음 = 상담 기록의 금액(화면 수금 셈과 같은 자료). 고객 단위로 세고, 청구 적은 사건 중 가장 늦게 고친 날부터 30일 넘으면 알림.
function awUnpaidCheck_(cases, days) {
  const lim = days || 30, today = awToday_();
  let logs = []; try { logs = (client_getConsultLogs({}) || {}).logs || []; } catch (e) { logs = []; }
  const paid = {}; logs.forEach(function (l) { const n = Number(l.금액) || 0; if (n > 0 && l.고객ID) paid[l.고객ID] = (paid[l.고객ID] || 0) + n; });
  const bill = {};
  (cases || awCases_()).forEach(function (c) {
    if (!c.고객ID || awVirtual_(c)) return; // [2026.11.12] 가상·모의 사건의 청구액은 미수가 아니다
    let ov = c.사건개요; if (typeof ov === 'string') { try { ov = JSON.parse(ov); } catch (e) { ov = {}; } }
    const amt = Number(String((ov || {}).청구액 || '').replace(/[^\d]/g, '')) || 0; if (!amt) return;
    const b = bill[c.고객ID] = bill[c.고객ID] || { 고객명: c.고객명, 청구: 0, 사건: [], 마지막: '' };
    b.청구 += amt; b.사건.push(String(c.사건명 || '')); const d = awYmd_(c.수정일) || awYmd_(c.의뢰일); if (d > b.마지막) b.마지막 = d;
  });
  const out = [];
  Object.keys(bill).forEach(function (cid) {
    const b = bill[cid], due = b.청구 - (paid[cid] || 0);
    if (due <= 0 || !b.마지막 || awDaysBetween_(b.마지막, today) < lim) return;
    out.push({ 고객ID: cid, 고객명: b.고객명, 미수: due });
    awNoticeAdd_('미수', '「' + b.고객명 + '」 미수 ' + due.toLocaleString('ko-KR') + '원(청구 ' + b.청구.toLocaleString('ko-KR') + ' − 받음 ' + (paid[cid] || 0).toLocaleString('ko-KR') + ') — ' + b.사건.slice(0, 2).join(', ') + ', 마지막 고침 ' + b.마지막, '', 'unpaid:' + cid + ':' + due);
  });
  return out;
}

// ---------- ⑤ 오래 멈춘 사건 ----------
// 마지막 움직임 = 사건 행 수정일 · 작업일지 마지막 날 · 사건 기록부(workLog·fileChanges) 마지막 시각 중 가장 늦은 것. 기본 14일(스크립트 속성 AW_STALE_DAYS로 바꿈).
function awStaleCheck_(cases) {
  let lim = 14; try { lim = Number(PropertiesService.getScriptProperties().getProperty('AW_STALE_DAYS')) || 14; } catch (e) {}
  const today = awToday_(), out = [], t0 = Date.now();
  (cases || awCases_()).filter(awOpen_).forEach(function (c) {
    if (Date.now() - t0 > 100000) return;
    let last = awYmd_(c.수정일) || awYmd_(c.의뢰일);
    (Array.isArray(c.작업일지) ? c.작업일지 : []).forEach(function (e) { const d = awYmd_(e && e.date); if (d > last) last = d; });
    try { const sv = caseProcLoad_(c.id) || {}; [].concat(sv.workLog || [], sv.fileChanges || [], sv.alerts || []).forEach(function (e) { const d = awYmd_(e && e.at); if (d > last) last = d; }); } catch (e) {}
    if (!last || last < '2020-01-01' || awDaysBetween_(last, today) < lim) return; // 2020년 전 날짜는 읽기 오류로 보고 올리지 않는다
    let wait = 0; try { const L = ledgerLoad_(c.id, true); Object.keys((L && L.ev) || {}).forEach(function (p) { if (L.ev[p] && L.ev[p].state === '증빙받을것') wait++; }); } catch (e) {}
    out.push({ caseId: c.id, 사건명: c.사건명, 마지막: last, 받을서류: wait });
    awNoticeAdd_('멈춘 사건', '「' + String(c.사건명 || c.고객명 || '') + '」 ' + awDaysBetween_(last, today) + '일째 움직임 없음(마지막 ' + last + ')' + (wait ? ' — 받을 서류 ' + wait + '개 남음' : ''), c.id, 'stale:' + c.id + ':' + last);
  });
  return out;
}

// [2026.11.13 5차 검문 — 세무사님 "제발 제대로 사용할 수 있게 해 달라"] 실사건 장부 건강표 — 5차 점검의 일곱 가지는 모두 "실사건에서 조용히 비어 있는 것"이라
//  세무사님이 넥스를 불러 보시기 전엔 아무도 몰랐다. 밤마다(GAS만, 0원) 진행 중 실사건마다 센다: 폴더 서류 수 · 장부 서류 줄 · 계산 칸 · 「기타」나 이름과 어긋난 종류 · 폴더에 없는 파일 줄.
//  고칠 수 있는 것은 그 자리에서 고친다(없는 파일 줄 걷기·계산 칸 0이면 첫 바퀴 다시 줄 세우기). 이틀 밤 잇달아 계산 칸이 0이면 아침 「답하실 것」에 한 줄(무엇이 막혔는지).
var AW_HEALTH_PROP_ = 'aw_ledger_health';
// [2026.11.13 5차 재점검 C] 밤 점검 묶음 전체(awNightly_)가 구글 실행 한도 6분 안에 끝나게 — 묶음이 시작한 때(startedAt)부터 5분이 지나면 남은 사건은 다음 밤으로
// [2026.11.13 5차 재점검 G] 서류 수는 서류·사진만 센다(검토서 같은 산출물·의뢰서·시스템 파일 빼고). 양도·증여·상속은 계산 칸, 그 밖(불복·조사·자문 등)은 서류 줄로 잰다
function awLedgerHealth_(cases, startedAt) {
  const t0 = Date.now(), rows = [];
  // 새벽 2시 큰 묶음(runNightlyChiefManager)이 시작한 때가 있으면 그것, 없으면(🐞 단추로 지금 돌림) 이 묶음 시작 — 그때부터 5분 20초가 지나면 멈춤(6분 한도 전)
  const T0 = (typeof NX_NIGHT_T0_ === 'number' && NX_NIGHT_T0_) ? NX_NIGHT_T0_ : (Number(startedAt) || t0);
  if (Date.now() - T0 > 290000) return { 사건: 0, 빨강: 0, 걷음: 0, 어긋남: 0, 건너뜀: '밤 묶음 시간이 모자라 다음 밤에' };
  let prev = {}; try { prev = JSON.parse(PropertiesService.getScriptProperties().getProperty(AW_HEALTH_PROP_) || '{}').byId || {}; } catch (e) { prev = {}; }
  const byId = Object.assign({}, prev); // 이번 밤에 못 본 사건은 지난 결과를 그대로 둔다
  // 지난번에 본 지 오래된 사건부터(못 본 사건이 먼저) — 시간이 모자라 멈춰도 밤마다 돌아가며 모두 본다
  const order = (cases || []).slice().sort(function (a, b) { return String((prev[a.id] && prev[a.id].at) || '').localeCompare(String((prev[b.id] && prev[b.id].at) || '')); });
  order.forEach(function (c) {
    if (Date.now() - T0 > 320000) return;
    if (String(c.상태 || '') !== '진행' || awVirtual_(c) || !String(c.폴더ID || '').trim()) return;
    const h = { 사건: String(c.사건명 || '').slice(0, 30), 서류: 0, 서류줄: 0, 칸: 0, 어긋남: 0, 걷음: 0, 고침: [] };
    try {
      const files = typeof cpWatchFiles_ === 'function' ? cpWatchFiles_(c) : []; // 잘림 표시(truncated)를 그대로 넘긴다 — 거르면 표시가 사라진다(A)
      h.서류 = files.filter(function (f) { return f && (f.kind === 'doc' || f.kind === 'image'); }).length;
      if (files.truncated) h.고침.push('폴더 파일이 많아 목록이 잘림 — 없는 파일 줄은 걷지 않음');
      if (files.length && typeof ledgerDocGone_ === 'function') { const g = ledgerDocGone_(c.id, files, []); h.걷음 = (g && g.n) || 0; if (h.걷음) { h.고침.push('없는 파일 줄 ' + h.걷음 + '개 걷음'); cpFlowQueueAdd_(c.id, '밤 점검 — 없는 파일 줄 정리 뒤 다시 읽기', 'read'); } }
      const L = ledgerLoad_(c.id, true) || {};
      Object.keys(L.rows || {}).forEach(function (p) {
        const r = L.rows[p];
        if (/^doc:.+\.role$/.test(p)) {
          h.서류줄++;
          const nm = p.slice(4, -5), nk = typeof ledgerDocNamed_ === 'function' ? ledgerDocNamed_(nm, '') : null;
          if (r && r.state === '확정' && nk && (String(r.v) === '기타' || (!nk.ok.test(String(r.v)) && String(r.v).indexOf(nk.kind) === -1))) h.어긋남++;
        } else if (!/^(doc:|q:|기준일$)/.test(p) && r && r.v !== '' && r.v != null) h.칸++;
      });
      const taxCase = /^(transfer|gift|inheritance)$/.test(String(c.세목 || '')); // 계산 칸이 있는 세목만 계산 칸으로 잰다(G)
      h.잣대 = taxCase ? '계산 칸' : '서류 줄';
      if (h.서류 && (taxCase ? !h.칸 : !h.서류줄)) {
        caseProcPatch_(c.id, function (sv) { if (sv.firstPass) delete sv.firstPass.queued; });
        cpFlowQueueAdd_(c.id, '첫 바퀴 — 밤 점검: 서류 ' + h.서류 + '개인데 계산 칸 0', 'read');
        h.고침.push('첫 바퀴 다시 줄 세움');
        const was = prev[c.id];
        if (was && was.빨강) awNoticeAdd_('장부 비어 있음', '「' + h.사건 + '」 폴더 서류 ' + h.서류 + '개인데 이틀 밤째 장부 ' + h.잣대 + '이 0 — 서류 읽기가 막혔을 수 있음(설정 🐞 카드·사건 장부 기록에서 까닭 확인)', c.id, 'health0_' + c.id + '_' + caseProcNow_().slice(0, 10), true);
        h.빨강 = true;
      }
      if (h.어긋남) h.고침.push('종류 어긋남 ' + h.어긋남 + '개(다음 서류 읽기에서 묻기로)');
    } catch (e) { h.오류 = String(e && e.message || e).slice(0, 80); }
    byId[c.id] = { 서류: h.서류, 칸: h.칸, 빨강: !!h.빨강, at: caseProcNow_() };
    rows.push(h);
  });
  const out = { at: caseProcNow_(), ms: Date.now() - t0, 사건: rows.length, 빨강: rows.filter(function (h) { return !!h.빨강; }).length, rows: rows, byId: byId };
  // 글자를 중간에서 자르면 다음 밤에 못 읽는다(이틀째 알림이 영영 안 뜸) — 길면 사건별 줄(rows)부터 덜어 낸다
  try { let s = JSON.stringify(out); if (s.length > 8500) { out.rows = rows.map(function (h) { return { 사건: h.사건, 서류: h.서류, 칸: h.칸, 빨강: !!h.빨강 }; }); s = JSON.stringify(out); } if (s.length > 8500) { delete out.rows; s = JSON.stringify(out); } if (s.length <= 9000) PropertiesService.getScriptProperties().setProperty(AW_HEALTH_PROP_, s); } catch (e) {}
  return { 사건: out.사건, 빨강: out.빨강, 걷음: rows.reduce(function (t, h) { return t + h.걷음; }, 0), 어긋남: rows.reduce(function (t, h) { return t + h.어긋남; }, 0) };
}
// ---------- 새벽 2시 묶음에서 부르는 것(③④⑤⑥) ----------
function awNightly_() {
  const t0 = Date.now(), r = {};
  const cases = awCases_();
  try { r.밤검토서예약 = nrEnsureTrigger_(); } catch (e) {} // [2026.11.14] 밤 내부검토서 갱신 틱(30분마다, 01~05시만 일함)
  try { r.정리 = awNoticePrune_(cases); } catch (e) { r.정리오류 = String(e && e.message || e).slice(0, 120); } // [2026.11.12] 진행 사건이 아닌 사건의 묵은 알림부터 지움
  try { r.기한 = awDeadlinesNightly_(cases).length; } catch (e) { r.기한오류 = String(e && e.message || e).slice(0, 120); }
  try { r.미수 = awUnpaidCheck_(cases).length; } catch (e) { r.미수오류 = String(e && e.message || e).slice(0, 120); }
  try { r.멈춤 = awStaleCheck_(cases).length; } catch (e) { r.멈춤오류 = String(e && e.message || e).slice(0, 120); }
  try { r.질문정리 = awQuestionsNightly_(cases); } catch (e) { r.질문정리오류 = String(e && e.message || e).slice(0, 120); } // [2026.11.12 넥스 질문 정리 ②⑤]
  try { const s = t6ShareCleanup_(); r.공유거둠 = s && s.done ? s.done.filter(function (d) { return d.unshared; }).length : 0; if (r.공유거둠) awNoticeAdd_('공유 정리', '완료 사건 폴더의 로봇 공유 ' + r.공유거둠 + '개를 거뒀습니다(밤 자동)', '', 'share:' + awToday_(), false); } catch (e) { r.공유오류 = String(e && e.message || e).slice(0, 120); }
  // [2026.11.13 5차 재점검 C] 장부 건강표는 맨 뒤, 그 앞까지의 기록을 먼저 남긴다 — 건강표가 길어져 6분 한도에 걸려도 앞 단계 기록·공유 정리는 빠지지 않게
  r.at = caseProcNow_(); r.ms = Date.now() - t0;
  try { PropertiesService.getScriptProperties().setProperty(AW_NIGHT_PROP_, JSON.stringify(r)); } catch (e) {}
  try { r.장부건강 = awLedgerHealth_(cases, t0); } catch (e) { r.장부건강오류 = String(e && e.message || e).slice(0, 120); } // [2026.11.13 5차 검문]
  r.ms = Date.now() - t0;
  try { PropertiesService.getScriptProperties().setProperty(AW_NIGHT_PROP_, JSON.stringify(r)); } catch (e) {}
  return r;
}
// [2026.11.12 넥스 질문 정리 계획서 ②·⑤ — 세무사님 "넥스선처리를 미리읽기 틱에 얹는 것은 맞는데, 진행중인 사건만을 대상으로" / 결정 다·라 권장대로]
//  밤마다 GAS만(0원): ① 진행 중 실사건에 넥스 차례 물음이 남아 있으면 낮 틱이 넥스를 깨우게 줄을 세운다 ② 완료 사건에 남은 열린 질문은 닫는다 ③ 사건 목록에 없는 장부 파일(가상·모의·지운 사건)은 드라이브 휴지통으로
function awQuestionsNightly_(cases) {
  const out = { 줄세움: 0, 완료닫음: 0, 휴지통: 0 };
  (cases || []).forEach(function (c) {
    try {
      if (String(c.상태 || '') === '완료') { if (typeof ledgerNexTurnCount_ === 'function' && typeof ledgerCloseAllOpen_ === 'function') { const q = ledgerQRead_(c.id); if (q.remaining.some(function (it) { return !(q.decisions[it.id] && q.decisions[it.id].d); })) { const r = ledgerCloseAllOpen_(c.id, '사건 완료(밤 점검)', 'GAS'); out.완료닫음 += (r && r.closed) || 0; } } return; }
      if (String(c.상태 || '') !== '진행' || awVirtual_(c)) return;
      if (typeof ledgerNexTurnCount_ === 'function' && ledgerNexTurnCount_(c.id) > 0 && typeof cpNexQEnqueue_ === 'function') { cpNexQEnqueue_(c.id); out.줄세움++; }
    } catch (e) {}
  });
  try { if (typeof ledgerOrphanTrash_ === 'function' && (cases || []).length) { const r = ledgerOrphanTrash_((cases || []).map(function (c) { return c.id; })); out.휴지통 = (r && r.trashed) || 0; if (out.휴지통) awNoticeAdd_('장부 정리', '사건 목록에 없는 장부 파일 ' + out.휴지통 + '개를 드라이브 휴지통으로 보냈습니다(가상·모의·지운 사건 — 되살릴 수 있음).', '', 'ledger_orphan_' + caseProcToday_(), true); } } catch (e) { out.휴지통오류 = String(e && e.message || e).slice(0, 80); }
  return out;
}
function awNightlyLast_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(AW_NIGHT_PROP_) || 'null'); } catch (e) { return null; } }

// =========================================================
// [2026.11.14 밤 내부검토서 갱신] 세무사님 원문: "내가 검토서를 만들라고 한 사건만 검토서가 생성되고, 생성된 검토서 중 수정할 사항이 있는 경우에
//  야간작업에서 업데이트하는 것으로 하자" / "보류사건은 아예 제외하라" / "보고서종류도 일단 내부검토서로 국한하자" /
//  "자동 업데이트는 컴퓨터가 꺼져 있고, 야간에만 한다" / "나머지는 권장대로 한다"  — 계획서 docs/_기록/밤_내부검토서_갱신_계획서_20261114.html
//  · 대상: 밤 갱신 목록(nr_review_list)에 오른 내부 검토서(종합검토서·개별검토서_쟁점) 중 상태 「진행」인 실사건 것만(보류·완료·가상 제외)
//    목록에 오르는 길: 세무사님 지시로 넥스가 새로 만든 검토서(넥스 저장 직후 자동) · 설정 › 시스템 관리 카드에서 세무사님이 고른 기존 검토서
//  · 때: 01~05시, job 화면이 30분 넘게 서버를 부르지 않았을 때(= 컴퓨터가 꺼져 있음으로 봄 — 화면이 10분마다 흔적을 보냄)
//  · 바뀐 것 찾기는 GAS(0원) — 없으면 넥스를 부르지 않는다. 있으면 사건마다 넥스가 한 번 파악하고 그 사건 검토서를 이어서 고친다
//  · 고칠 때: 같은 파일 갱신(직전 판 「_이전판」), 세무사님이 쓰신 문단은 그대로(달라 보이면 그 뒤에 밤 갱신 메모), 세액은 계산 저장본 숫자만
//  · 아침: 고친 것만 「답하실 것」에. 고칠 것이 없으면 알림 없이 기록만(설정 카드에서 봄)
// =========================================================
var NR_LIST_PROP_ = 'nr_review_list', NR_STATE_PROP_ = 'nr_state', NR_USE_PROP_ = 'nx_last_use';
var NR_IDLE_MIN_ = 30, NR_START_H_ = 1, NR_END_H_ = 5, NR_REPORT_END_H_ = 8;
var NR_REVIEW_RE_ = /^(종합검토서|개별검토서_.+)\.(md|txt)$/;
var NR_READ_TOOLS_ = /^(case_status|ledger_read|case_files|file_read|fact_map|doc_find|law_lookup|law_search|case_ledger)$/;
function nrHour_() { return Number(Utilities.formatDate(new Date(), 'Asia/Seoul', 'H')); }
// job 화면이 서버를 부를 때마다(manageApp_call) — 5분에 한 번만 속성에 적는다(속성 쓰기 한도)
function nrMarkUse_() {
  try { const ch = CacheService.getScriptCache(); if (ch.get('nr_use_mark')) return; ch.put('nr_use_mark', '1', 300); PropertiesService.getScriptProperties().setProperty(NR_USE_PROP_, String(Date.now())); } catch (e) {}
}
function nrTs_(s) { // 'yyyy-MM-dd HH:mm'(한국 시각) → ms
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ''));
  return m ? (Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':00+09:00') || 0) : 0;
}
function nrList_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(NR_LIST_PROP_) || '[]') || []; } catch (e) { return []; } }
// ── 넥스가 쓴 판(사본) — 「_이전판/_넥스판_이름.json」 {text, prot:[세무사님 문단]} — "_"로 시작해 미리 읽기·감시에서 빠진다
function nrParas_(t) { return String(t || '').replace(/\r/g, '').split(/\n\s*\n/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); }).filter(Boolean); }
function nrSnapFolder_(file) { const p = file.getParents(); return p.hasNext() ? my_getOrCreateSubfolder_(p.next(), '_이전판') : null; }
function nrSnapRead_(file) {
  try { const f = nrSnapFolder_(file); if (!f) return null; const it = f.getFilesByName('_넥스판_' + file.getName() + '.json'); if (!it.hasNext()) return null; const o = JSON.parse(it.next().getBlob().getDataAsString('UTF-8')); return o && typeof o.text === 'string' ? { text: o.text, prot: Array.isArray(o.prot) ? o.prot : [] } : null; } catch (e) { return null; }
}
function nrSnapWrite_(file, text, prot) {
  try {
    const f = nrSnapFolder_(file); if (!f) return false;
    const n = '_넥스판_' + file.getName() + '.json', s = JSON.stringify({ v: 1, at: caseProcNow_(), text: String(text || ''), prot: prot || [] });
    const it = f.getFilesByName(n); if (it.hasNext()) it.next().setContent(s); else f.createFile(Utilities.newBlob(s, 'application/json', n));
    return true;
  } catch (e) { return false; }
}
// 세무사님(사람) 문단 = 지금 글 중 넥스가 쓴 판에 없는 문단 + 전에 세무사님 문단으로 잡힌 것(아직 남아 있는 것). 사본이 없으면 전부 지킨다
function nrProtected_(cur, snap) {
  const now = nrParas_(cur);
  if (!snap) return now;
  const nx = {}; nrParas_(snap.text).forEach(function (p) { nx[p] = 1; });
  const keep = {}; (snap.prot || []).forEach(function (p) { keep[p] = 1; });
  return now.filter(function (p) { return !nx[p] || keep[p]; });
}
// 넥스가 낮에 검토서를 저장한 직후(cpNexWroteMark_) — 밤 갱신 목록에 있는 파일이면 사본을 새로 쓴다(그 사이 세무사님이 고치신 문단은 지킬 문단으로 넘김)
function nrNexWroteHook_(fileId) {
  try {
    if (!nrList_().some(function (x) { return x && x.fileId === fileId; })) return;
    const file = DriveApp.getFileById(fileId), now = file.getBlob().getDataAsString('UTF-8');
    const old = nrSnapRead_(file);
    let pre = null; try { const bk = nrSnapFolder_(file).getFilesByName(file.getName()); if (bk.hasNext()) pre = bk.next().getBlob().getDataAsString('UTF-8'); } catch (e) { pre = null; }
    const human = pre != null ? nrProtected_(pre, old) : (old ? old.prot : []);
    const nowSet = {}; nrParas_(now).forEach(function (p) { nowSet[p] = 1; });
    nrSnapWrite_(file, now, human.filter(function (p) { return nowSet[p]; }));
  } catch (e) {}
}
// 목록 올리기·내리기 — 올릴 때 지금 글을 넥스가 고칠 수 있는 글로 잡는다(고르신 뒤 세무사님이 고치신 문단부터 지킴)
function nrSet_(caseId, fileId, on, by) {
  caseId = String(caseId || ''); fileId = String(fileId || '');
  if (!caseId || !fileId) return { ok: false, error: '사건·파일이 없음' };
  let file = null; try { file = DriveApp.getFileById(fileId); } catch (e) { return { ok: false, error: '파일을 찾지 못함' }; }
  if (on && !NR_REVIEW_RE_.test(file.getName())) return { ok: false, error: '내부 검토서(종합검토서·개별검토서_쟁점)만 올릴 수 있음: ' + file.getName() };
  const out = withLockStrict_(5000, function () {
    const p = PropertiesService.getScriptProperties();
    const a = nrList_().filter(function (x) { return x && x.fileId !== fileId; });
    if (on) a.push({ caseId: caseId, fileId: fileId, name: file.getName(), at: caseProcNow_(), by: String(by || '세무사님') });
    p.setProperty(NR_LIST_PROP_, JSON.stringify(a.slice(-200)));
    return { ok: true, on: !!on, n: a.length };
  });
  if (on && !nrSnapRead_(file)) nrSnapWrite_(file, file.getBlob().getDataAsString('UTF-8'), []);
  try { caseProcPatch_(caseId, function (sv) { caseProcLogTo_(sv, { by: String(by || '세무사님'), what: '밤 검토서 갱신 ' + (on ? '켬' : '끔'), detail: file.getName() }); }); } catch (e) {}
  return out;
}
// 진행 실사건의 내부 검토서 찾기(「보고서」 → 「보고서_내부」 → 사건 폴더 맨 위) — 설정 카드의 고르기 목록
function nrCandidates_(cases) {
  const out = [];
  (cases || awCases_()).forEach(function (c) {
    if (!c || String(c.상태 || '') !== '진행' || awVirtual_(c) || !String(c.폴더ID || '').trim()) return;
    let root; try { root = DriveApp.getFolderById(String(c.폴더ID).trim()); } catch (e) { return; }
    const scan = function (folder, where) { const it = folder.getFiles(); while (it.hasNext()) { const f = it.next(); if (NR_REVIEW_RE_.test(f.getName())) out.push({ caseId: c.id, case: String(c.사건명 || c.고객명 || ''), fileId: f.getId(), name: f.getName(), where: where, at: Utilities.formatDate(f.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') }); } };
    ['보고서', '보고서_내부'].forEach(function (n) { const it = root.getFoldersByName(n); if (it.hasNext()) scan(it.next(), n); });
    scan(root, '사건 폴더');
  });
  return out;
}
// ── 바뀐 것 찾기(GAS, 0원) — 검토서를 마지막으로 고친 뒤로
function nrChanges_(c, fileIds, since) {
  const out = [], seen = {};
  const add = function (s) { s = String(s).slice(0, 140); if (!seen[s]) { seen[s] = 1; out.push(s); } };
  const sv = caseProcLoad_(c.id) || {};
  (Array.isArray(sv.fileChanges) ? sv.fileChanges : []).forEach(function (x) {
    if (!x || fileIds.indexOf(x.id) !== -1 || x.by === '넥스' || !/^(새|바뀜|없어짐)$/.test(String(x.kind || ''))) return;
    if (/^_/.test(String(x.name || '')) || /(^|\/)_/.test(String(x.dir || ''))) return;
    if (nrTs_(x.at) > since) add('서류 ' + x.kind + ': ' + (x.dir ? x.dir + '/' : '') + x.name);
  });
  let L = null; try { L = ledgerLoad_(c.id, true); } catch (e) { L = null; }
  ((L && L.log) || []).forEach(function (e) { if (e && /^(세무사님|넥스|고객)$/.test(String(e.by || '')) && nrTs_(e.at) > since && e.what !== '밤 검토서 갱신') add('사건 장부(' + e.by + '): ' + e.what + (e.path ? ' — ' + e.path : '') + (e.detail ? ' — ' + String(e.detail).slice(0, 60) : '')); });
  (Array.isArray(c.세액계산결과) ? c.세액계산결과 : []).forEach(function (x) { const m = /^tc_(\d{12,})/.exec(String(x && x.id || '')); if (m && Number(m[1]) > since) add('계산 저장본 새로: ' + [x.세목, x.구분, x.안이름 || x.name].filter(Boolean).join(' ')); });
  const due = awYmd_(c.법정일); if (due) { const t = Date.parse(due + 'T00:00:00+09:00'); if (t > since && t <= Date.now()) add('법정기한 지남: ' + due); }
  awNoticeList_().forEach(function (n) { if (n && n.caseId === c.id && /법령/.test(String(n.kind || '')) && nrTs_(n.at) > since) add('법령 개정 알림: ' + String(n.text || '').slice(0, 80)); });
  return out.slice(0, 40);
}
// ── 고치기 — 찾아 바꾸기(한 곳만) → 세무사님 문단이 그대로인지 → 새로 넣은 세액 숫자가 계산 저장본에 있는지
function nrApplyEdits_(text, edits, prot) {
  let t = String(text || '');
  for (let i = 0; i < (edits || []).length; i++) {
    const e = edits[i] || {}, f = String(e.find || '');
    if (!f) return { error: (i + 1) + '번째 고침: 찾을 글이 비었음' };
    const at = t.indexOf(f);
    if (at < 0) return { error: (i + 1) + '번째 고침: 검토서에서 못 찾음 — 「' + f.slice(0, 60) + '」(지금 글을 그대로 옮겨 적어라)' };
    if (t.indexOf(f, at + 1) !== -1) return { error: (i + 1) + '번째 고침: 같은 글이 두 곳 이상 — 앞뒤를 더 붙여 한 곳만 가리켜라' };
    t = t.slice(0, at) + String(e.replace == null ? '' : e.replace) + t.slice(at + f.length);
  }
  const have = {}; nrParas_(t).forEach(function (p) { have[p] = 1; });
  const lost = (prot || []).filter(function (p) { return !have[p]; });
  if (lost.length) return { error: '세무사님이 쓰신 문단은 한 글자도 바꾸거나 지우지 않는다 — 바뀐 문단 ' + lost.length + '개: 「' + lost[0].slice(0, 80) + '」 … 달라 보이면 그 문단 바로 뒤에 빈 줄을 두고 「> 🌙 밤 갱신 메모(날짜): …」 한 줄을 덧붙여라', lost: lost };
  return { text: t };
}
function nrNewTaxNums_(c, before, after) {
  if (typeof citeTaxFigures_ !== 'function') return [];
  let a = [], b = []; try { a = citeTaxFigures_(c, before).없음 || []; b = citeTaxFigures_(c, after).없음 || []; } catch (e) { return []; }
  const had = {}; a.forEach(function (s) { had[String(s).replace(/,/g, '')] = 1; });
  return b.filter(function (s) { return !had[String(s).replace(/,/g, '')]; });
}
// ── 한 사건 — 넥스가 한 번 파악하고 그 사건의 밤 갱신 검토서를 이어서 본다
function nrReviewCase_(c, fileIds, deadlineAt) {
  const t0 = Date.now(), files = [];
  fileIds.forEach(function (id) {
    let f = null; try { f = DriveApp.getFileById(id); if (f.isTrashed()) f = null; } catch (e) { f = null; }
    if (!f) return;
    const sv = caseProcLoad_(c.id) || {}, last = (sv.nightReview && sv.nightReview[id]) || {};
    const since = Math.max(f.getLastUpdated().getTime(), nrTs_(last.at));
    const text = f.getBlob().getDataAsString('UTF-8');
    files.push({ id: id, file: f, name: f.getName(), since: since, text: text, prot: nrProtected_(text, nrSnapRead_(f)) });
  });
  if (!files.length) return { skipped: '검토서 파일이 없음(지워졌거나 휴지통)' };
  const since = Math.min.apply(null, files.map(function (x) { return x.since; }));
  const ch = nrChanges_(c, fileIds, since);
  if (!ch.length) return { skipped: '바뀐 것 없음', files: files.map(function (x) { return x.name; }) };
  try { if (String(PropertiesService.getScriptProperties().getProperty('AI_LEAD') || '') === '끄기') return { skipped: 'AI 지휘 꺼짐(스크립트 속성 AI_LEAD = 끄기)' }; } catch (e) {}
  const ctx = { lastItems: null, lookups: [], decisions: [], asks: [], opinions: [], gaps: [], attaches: [], subWon: 0 };
  const tools = caseProcAiLiveTools_().filter(function (t) { return NR_READ_TOOLS_.test(t.name); }).map(function (t) { const x = Object.assign({}, t); delete x.cache_control; return x; });
  tools.push({ name: 'review_edit', description: '검토서 고치기(저장까지) — fileId의 검토서에서 find(지금 글 그대로, 한 곳만 가리킬 만큼)를 replace로 바꾼다. 여러 곳이면 edits에 차례로. summary=바뀐 결론·사실 한 줄(쉬운 말). 세무사님 문단을 건드리거나 계산 저장본에 없는 세액 숫자를 새로 넣으면 저장하지 않고 이유를 돌려준다.',
    input_schema: { type: 'object', properties: { fileId: { type: 'string' }, edits: { type: 'array', items: { type: 'object', properties: { find: { type: 'string' }, replace: { type: 'string' } }, required: ['find', 'replace'] } }, summary: { type: 'string' } }, required: ['fileId', 'edits', 'summary'] } });
  tools.push({ name: 'review_keep', description: '고칠 것 없음 — fileId 검토서는 바뀐 것을 보고도 고칠 곳이 없다(reason 한 줄). 신고·청구를 이미 냈거나 처리방향이 정해져 결론을 바꾸지 않는 경우도 여기에(reason에 그 사정).',
    input_schema: { type: 'object', properties: { fileId: { type: 'string' }, reason: { type: 'string' } }, required: ['fileId', 'reason'] } });
  const today = caseProcToday_();
  const system = caseProcAiNexBase_() + '\n\n[밤 내부검토서 갱신 — 세무사님이 만들라고 하신 내부 검토서를 밤에 살핀다(세무사님이 부르신 대화가 아님)]\n'
    + '- 할 일: 아래 [바뀐 것]이 검토서의 결론·사실관계·쟁점 검토·확인 필요 사항을 바꾸는지 본다. 필요하면 읽기 도구로 서류·장부·조문을 확인한다. 바뀌는 곳만 review_edit로 고치고, 고칠 곳이 없으면 review_keep. 검토서마다 둘 중 하나로 반드시 끝낸다.\n'
    + '- 고치는 법(지침 사건처리내용_정리절차 5절): 새로 갈아엎지 않는다. 전 결론과 지금 결론이 어떻게 달라졌는지 보이게 이어서 다듬는다 — 바뀐 자리에 「(' + today + ' 밤 갱신: 전 ○○ → 지금 △△, 근거 파일·조문)」를 남긴다.\n'
    + '- [세무사님 문단]은 세무사님이 직접 쓰신 글이다 — 한 글자도 바꾸거나 지우지 않는다. 달라 보이면 그 문단 바로 뒤에 빈 줄을 두고 「> 🌙 밤 갱신 메모(' + today + '): …」 한 줄만 덧붙인다.\n'
    + '- 세액은 이 사건 계산 저장본에 있는 숫자만 옮긴다. 계산을 새로 해야 할 일이면 숫자를 쓰지 말고 「확인 필요 — 세액 다시 계산」으로 적는다(밤에는 계산 저장본을 만들지 않는다). 암산 금지.\n'
    + '- 사건 장부·계산기 칸은 바꾸지 않는다. 세무사님 판단이 필요한 것은 case_ledger do=ask(group 붙여)로만 넘긴다(do=set 등 다른 쓰기는 안 됨).\n'
    + '- 작업관리 처리방향이 정해져 있으면(아래 표시) 결론 문장은 바꾸지 말고 「결정과 달라질 수 있음」을 메모로만 남긴다. 신고·청구를 이미 낸 사건이면(case_status 작업일지로 확인) 고치지 말고 review_keep(reason에 "신고 뒤 — 수정신고·경정청구 검토 필요 여부")로 끝낸다.\n'
    + '- 모든 글은 한국어. 개인정보(주민번호 뒷자리·계좌)는 적지 않는다. 지어내지 않는다(근거 없으면 [확인 필요]).';
  const first = '사건: ' + String(c.사건명 || c.고객명 || '') + ' (' + (CASEPROC_TAX_LABEL_[c.세목] || c.세목 || '') + ' · ' + (c.업무유형 || '') + ' · 상태 ' + (c.상태 || '') + ')\n'
    + '처리방향: ' + (String(c.처리방향 || '').trim() || '(정해지지 않음)') + '\n'
    + '[바뀐 것 — 검토서를 마지막으로 고친 뒤, GAS가 찾음]\n' + ch.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') + '\n\n'
    + files.map(function (x) { return '===== 검토서 「' + x.name + '」 (fileId: ' + x.id + ') =====\n' + x.text.slice(0, 40000) + (x.text.length > 40000 ? '\n…(뒤 생략)' : '') + '\n\n[세무사님 문단 ' + x.prot.length + '개 — 바꾸지 말 것]\n' + x.prot.slice(0, 60).map(function (p) { return '· ' + p.slice(0, 200); }).join('\n'); }).join('\n\n');
  let messages = [{ role: 'user', content: caseProcAiMask_(first) }], won = 0, rounds = 0, calls = [], err = '';
  const result = {}; // fileId → {saved, summary, keep}
  const pending = function () { return files.filter(function (x) { return !result[x.id]; }).length; };
  for (; rounds < 14 && pending(); rounds++) {
    if (Date.now() > deadlineAt - 60000) { err = '시간이 모자라 멈춤(다음 밤에 이어서)'; break; }
    const r = caseProcAiCall_(CASEPROC_AI_HIGH_MODEL_, system, tools, caseProcAiCacheMark_(messages), 6000, 'medium', { kind: '넥스 밤 검토서 갱신', caseId: c.id, caseName: c.사건명 || '', step: rounds + 1, q: '바뀐 것 ' + ch.length + '개' });
    if (r.error) { err = r.error; break; }
    won += r.won || 0;
    const content = r.json.content || [], uses = content.filter(function (b) { return b.type === 'tool_use'; });
    if (!uses.length) { err = err || '넥스가 고치기·그대로 두기 중 하나로 끝내지 않음'; break; }
    const results = [];
    uses.forEach(function (u) {
      calls.push(u.name);
      const inp = u.input || {};
      let out = '';
      if (u.name === 'review_edit' || u.name === 'review_keep') {
        const x = files.filter(function (y) { return y.id === String(inp.fileId || ''); })[0];
        if (!x) out = JSON.stringify({ 오류: '그 fileId의 검토서가 이번 목록에 없음' });
        else if (u.name === 'review_keep') { result[x.id] = { keep: String(inp.reason || '').slice(0, 200) }; out = '{"ok":true}'; }
        else {
          const ap = nrApplyEdits_(x.text, inp.edits || [], x.prot);
          const bad = ap.error ? [] : nrNewTaxNums_(c, x.text, ap.text);
          if (ap.error) out = JSON.stringify({ 저장안함: ap.error });
          else if (bad.length) out = JSON.stringify({ 저장안함: '계산 저장본에 없는 세액 숫자를 새로 넣었다: ' + bad.slice(0, 5).join(', ') + ' — 숫자를 빼고 「확인 필요 — 세액 다시 계산」으로' });
          else {
            try {
              const parent = x.file.getParents().next();
              aiSaveBackupPrev_(parent, x.file);
              x.file.setContent(ap.text);
              const keep = {}; nrParas_(ap.text).forEach(function (p) { keep[p] = 1; });
              nrSnapWrite_(x.file, ap.text, x.prot.filter(function (p) { return keep[p]; }));
              try { cpNexWroteMark_(c.id, x.id); } catch (e) {}
              x.text = ap.text;
              result[x.id] = { saved: true, summary: String(inp.summary || '').slice(0, 200) };
              out = JSON.stringify({ ok: true, 저장: x.name, 안내: '같은 파일을 갱신했고 직전 판은 「_이전판」에 있다' });
            } catch (e) { out = JSON.stringify({ 오류: '저장 실패: ' + String(e && e.message || e).slice(0, 120) }); }
          }
        }
      } else if (u.name === 'case_ledger' && String(inp.do || '') !== 'ask') {
        out = JSON.stringify({ 오류: '밤 갱신에서는 장부에 적지 않는다 — 세무사님께 넘길 것만 do=ask로' });
      } else {
        let ex; try { ex = caseProcAiLiveExec_(c.id, u.name, inp, ctx); } catch (e) { ex = { text: JSON.stringify({ 오류: String(e && e.message || e) }) }; }
        out = String((ex && ex.text) || '');
      }
      results.push({ type: 'tool_result', tool_use_id: u.id, content: out.slice(0, 9000) });
    });
    messages = messages.concat([{ role: 'assistant', content: content }, { role: 'user', content: results }]);
  }
  won = Math.round((won + (ctx.subWon || 0)) * 10) / 10;
  const now = caseProcNow_();
  const saved = files.filter(function (x) { return result[x.id] && result[x.id].saved; });
  caseProcPatch_(c.id, function (sv) {
    sv.nightReview = sv.nightReview || {};
    files.forEach(function (x) { if (result[x.id]) sv.nightReview[x.id] = { at: now, name: x.name, saved: !!result[x.id].saved, summary: result[x.id].summary || result[x.id].keep || '', won: won }; });
    caseProcLogTo_(sv, { by: '넥스', what: '밤 검토서 갱신', detail: (saved.length ? '고침 ' + saved.map(function (x) { return x.name + '(' + result[x.id].summary + ')'; }).join(' · ') : '고칠 것 없음') + ' · 바뀐 것 ' + ch.length + '개 · ' + won + '원' + (err ? ' · ' + err : '') });
  });
  const line = saved.map(function (x) { return x.name + ' — ' + result[x.id].summary; }).join(' / ');
  if (saved.length) { try { cpNexChatNote_(c, '밤에 내부 검토서를 고쳤습니다: ' + line + ' (직전 판은 「_이전판」)', '밤 검토서 갱신'); } catch (e) {} }
  return { saved: saved.length, line: line, keep: files.filter(function (x) { return result[x.id] && result[x.id].keep; }).map(function (x) { return x.name + ' — ' + result[x.id].keep; }), changes: ch.length, won: won, rounds: rounds, calls: calls, error: err || undefined, ms: Date.now() - t0 };
}
// ── 밤 틱(30분마다) — 01~05시 일하고, 05~08시 사이 첫 틱에 아침 보고
function nrNightTick() { // 시간 트리거가 부르는 이름(끝에 _ 없음)
  const h = nrHour_(); if (h < NR_START_H_ || h >= NR_REPORT_END_H_) return;
  const ch = CacheService.getScriptCache(); try { if (ch.get('nr_run')) return; ch.put('nr_run', '1', 330); } catch (e) {}
  try { nrTick_(h, {}); } finally { try { ch.remove('nr_run'); } catch (e) {} }
}
function nrTick_(h, opt) {
  opt = opt || {};
  const started = Date.now(), DEADLINE = 300000, props = PropertiesService.getScriptProperties(), today = awToday_();
  let st = {}; try { st = JSON.parse(props.getProperty(NR_STATE_PROP_) || '{}') || {}; } catch (e) { st = {}; }
  if (st.date !== today) st = { date: today, queue: null, done: [], waits: 0, reported: false };
  const save = function () { try { props.setProperty(NR_STATE_PROP_, JSON.stringify(st).slice(0, 8500)); } catch (e) {} };
  if (h >= NR_END_H_ && !opt.force) { if (!st.reported) { nrReport_(st); st.reported = true; save(); } return st; }
  if (st.reported && !opt.force) return st;
  const lastUse = Number(props.getProperty(NR_USE_PROP_) || 0);
  if (!opt.force && lastUse && Date.now() - lastUse < NR_IDLE_MIN_ * 60000) { st.waits = (st.waits || 0) + 1; st.lastWait = caseProcNow_(); save(); return st; }
  if (!st.queue) {
    const map = {}; awCases_().forEach(function (c) { if (c && c.id) map[c.id] = c; });
    const by = {}; nrList_().forEach(function (x) { const c = x && map[x.caseId]; if (c && String(c.상태 || '') === '진행' && !awVirtual_(c)) (by[x.caseId] = by[x.caseId] || []).push(x.fileId); });
    st.queue = Object.keys(by).map(function (k) { return { caseId: k, fileIds: by[k] }; });
    save();
  }
  while (st.queue.length && Date.now() - started < DEADLINE - 200000) {
    const it = st.queue.shift(); save();
    const c = akReadCase_(it.caseId);
    let r; try { r = c ? nrReviewCase_(c, it.fileIds, started + DEADLINE - 15000) : { skipped: '사건 없음' }; } catch (e) { r = { error: String(e && e.message || e).slice(0, 160) }; }
    st.done.push({ caseId: it.caseId, name: c ? String(c.사건명 || c.고객명 || '') : '', saved: r.saved || 0, line: String(r.line || '').slice(0, 300), keep: (r.keep || []).slice(0, 3), skipped: r.skipped || '', error: r.error || '', won: r.won || 0 });
    save();
  }
  if (!st.queue.length && !st.reported && !opt.force) { nrReport_(st); st.reported = true; save(); }
  return st;
}
function nrReport_(st) {
  const done = st.done || [], saved = done.filter(function (d) { return d.saved; });
  const won = Math.round(done.reduce(function (s, d) { return s + (Number(d.won) || 0); }, 0));
  if (!st.queue && st.waits) { awNoticeAdd_('밤 검토서 갱신', '밤새 job 화면이 켜져 있어 내부 검토서 갱신을 건너뛰었습니다(01~05시 내내 30분 안에 쓰신 흔적).', '', 'nr:' + st.date, true); return; }
  saved.forEach(function (d) { awNoticeAdd_('밤 검토서 갱신', d.name + ' — ' + d.line + (d.won ? ' (' + d.won + '원)' : ''), d.caseId, 'nr:' + st.date + ':' + d.caseId, false); });
  const left = (st.queue || []).length, errs = done.filter(function (d) { return d.error; });
  if (saved.length || errs.length || left) awNoticeAdd_('밤 검토서 갱신', '고친 사건 ' + saved.length + '건' + (errs.length ? ' · 멈춤 ' + errs.length + '건(' + errs.map(function (d) { return d.name; }).join(', ').slice(0, 80) + ')' : '') + (left ? ' · 못 본 사건 ' + left + '건(05시 넘음)' : '') + ' · 넥스 비용 ' + won + '원', '', 'nr:' + st.date, true);
}
function nrEnsureTrigger_() {
  try { const has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'nrNightTick'; }); if (!has) ScriptApp.newTrigger('nrNightTick').timeBased().everyMinutes(30).create(); return true; } catch (e) { return false; }
}
// 설정 › 시스템 관리 카드 — 목록·고를 수 있는 검토서·지난 밤 결과
function nrStatus_() {
  const cases = awCases_(), map = {}; cases.forEach(function (c) { if (c && c.id) map[c.id] = c; });
  const list = nrList_().map(function (x) { const c = map[x.caseId]; const sv = caseProcLoad_(x.caseId) || {}; const nr = (sv.nightReview && sv.nightReview[x.fileId]) || null; return { caseId: x.caseId, case: c ? String(c.사건명 || c.고객명 || '') : '(사건 없음)', 상태: c ? String(c.상태 || '') : '', fileId: x.fileId, name: x.name, at: x.at, by: x.by, last: nr }; });
  const on = {}; list.forEach(function (x) { on[x.fileId] = 1; });
  let st = null; try { st = JSON.parse(PropertiesService.getScriptProperties().getProperty(NR_STATE_PROP_) || 'null'); } catch (e) { st = null; }
  const lastUse = Number(PropertiesService.getScriptProperties().getProperty(NR_USE_PROP_) || 0);
  let trig = false; try { trig = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'nrNightTick'; }); } catch (e) { trig = false; }
  return { ok: true, list: list, candidates: nrCandidates_(cases).filter(function (x) { return !on[x.fileId]; }), state: st, lastUse: lastUse ? Utilities.formatDate(new Date(lastUse), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '', trigger: trig };
}
