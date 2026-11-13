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
