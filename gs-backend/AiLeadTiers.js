// =========================================================
// [2026.10.19 5번 — AI 지휘의 세 겹과 GAS 고도화 고리] 세무사님 조건(원문):
//  "하지만 내가 처음에 이것을 경계했던 이유는 그렇게 되면 gas를 고도화하지 않고 종전의 work와 같아질 우려때문이었다.
//   gas를 고도화했고 계속하여 고도화하는 방안이 가미된다면 지금 그렇게 해도 될 것 같다"
//  "세겹으로하고 ai지휘를 켠다"
//  ── 세 겹 ──
//   ① 미리 정한 기준(GAS, 0원): 쟁점 종류(주제)로 길을 나눈다 — 표는 설정값(스크립트 속성 AI_ROUTE_TABLE, JSON 배열)이라 코드 수정 없이 바꿈.
//      서류 한두 장 안에서 끝나고 세액 영향이 작은 것(판독·날짜 고르기·중복·서류 종류·값 고르기) → 저비용(Haiku·제미니)
//      여러 서류·거래를 엮거나 세액이 크게 갈리는 것(사건분류·특수관계 정황·돈 흐름 성격·사전증여 성격·시가·주택 여부) → 총괄(지휘) AI
//   ② 올려보내기: 저비용 AI는 답·sure·"묶음만으로 모자란 정보"(need)를 돌려준다. 불확실·모자라면 GAS가 총괄로 올리고, 총괄도 서류로 못 정하면 세무사님 질문.
//      저비용 전송부는 2번 교차검증의 cxCallAi_(쟁점 묶음만·보내기 직전 가림·6시간 캐시) — 스크립트 속성 CX_AI_AUTO="켜기"일 때만 보냄(AI 지휘 반영 때 함께 켬).
//   ③ 기록으로 고치기: 주제별 "세무사님이 고친 비율"·"총괄 답이 늘 같은 비율"을 주간 점검표에 — 내리기·올리기 후보는 사람이 승인.
//  ── GAS 고도화 다섯 가지 ──
//   ① 판단 기록: 판단마다 칸·근거 서류·쪽·값·모델·비용·세무사님이 고쳤는지 — 2번 틀(유료질문 기록 kind 'cx' + sv.cxAi.applied → cxLogUserFix_)을 그대로 이어 씀
//   ② 주간 점검표(토큰 0): 되풀이되는 AI 판단 → "GAS 규칙 후보"(처음 보는 사건 2건 이상에서 맞은 것만) — 개선후보 보고서(buildImprovementReport_ → 월요일 루틴 PR → 📥)에 실림
//   ③ 빠진 도구: AI가 도구로 못 한 일(원문을 직접 뒤지려 함·손계산·도구 부족 신고) → _사건처리빠진도구.json → 점검표
//   ④ AI의 서류 접근은 GAS 도구로만(글자인식 기억 대조·사실 목록·쟁점 묶음) — 폴더 통째 읽기(docs_read)·원문 직접 읽기(doc_text)는 지휘 AI에게 주지 않음
//   ⑤ 매주 숫자: AI 없이 끝난 사건 비율↑, 사건당 AI 판단 수·비용↓, 규칙으로 옮긴 판단 수, 새로 만든 도구 수 — 두 주 연속 멈추면 경고
// =========================================================
var CASEPROC_AI_ROUTE_DEFAULT_ = [
  // 위에서부터 처음 맞는 줄. re는 쟁점 id·종류·칸 이름·질문 글에 대고 본다
  { topic: '사건분류', route: 'lead', re: '^ov:사건분류|^cls:|사건분류|1세대1주택|일시적 ?2주택|비과세|중과|감면|특례' }, // 맨 위 — 사건분류 질문 글에 '가족관계' 같은 낱말이 있어도 사건분류로
  { topic: '특수관계', route: 'lead', re: '특수관계|관계인지|buyerrel|buyer\\.relation|donorRelation|giftRelation|양수인관계|이월과세관계|가족관계' },
  { topic: '돈흐름', route: 'lead', re: '무슨 돈|^money:|이체 성격|송금 성격|돈 흐름|대여|차용|자금출처' },
  { topic: '사전증여', route: 'lead', re: '사전증여|10년 ?(내|이내)|합산|재차증여' },
  { topic: '시가평가', route: 'lead', re: '시가|relfmv|평가액|감정가|매매사례|유사사례|보충적 평가' },
  { topic: '주택여부', route: 'lead', re: '주택 여부|과세대상 구분|assetType|오피스텔|용도' },
  { topic: '서류종류', route: 'light', re: '처음 보는 서류|^doc:' },
  { topic: '판독', route: 'light', re: '판독|^cxt:|모순|regNo|주민등록번호' },
  { topic: '중복', route: 'light', re: '중복|사본|같은 서류' },
  { topic: '같은지', route: 'light', re: '같은지|표기|같은 사람|주소 표기' },
  { topic: '날짜고르기', route: 'light', re: '일자|날짜|[Dd]ate|취득일|양도일|잔금|증여일|접수일' },
  { topic: '값고르기', route: 'light', re: '값고르기|어긋남|서류끼리 다름|금액' }
];
var CASEPROC_AI_ROUTE_ELSE_ = { topic: '그 밖의 판단', route: 'lead' };
var CASEPROC_AI_GAP_LOG_ = '_사건처리빠진도구.json';
var CASEPROC_AI_PROMOTE_LOG_ = '_사건처리규칙승격기록.json';

function caseProcAiRouteTable_() {
  try {
    const s = PropertiesService.getScriptProperties().getProperty('AI_ROUTE_TABLE');
    if (s) { const t = JSON.parse(s); if (Array.isArray(t) && t.length && t.every(function (x) { return x && x.re && /^(light|lead)$/.test(x.route); })) return t; }
  } catch (e) {}
  return CASEPROC_AI_ROUTE_DEFAULT_;
}
// 글 하나(쟁점 id·종류·칸 이름·질문 글)를 주제·길로
function caseProcAiTopic_(text) {
  const t = String(text || '');
  const tab = caseProcAiRouteTable_();
  for (let i = 0; i < tab.length; i++) { try { if (new RegExp(tab[i].re).test(t)) return { topic: tab[i].topic, route: tab[i].route }; } catch (e) {} }
  return CASEPROC_AI_ROUTE_ELSE_;
}
// 2번 교차검증 쟁점(iss) → 'light' | 'lead' — CrossCheck.js cxResolve0_가 저비용에 보내기 전에 부른다(같은 표)
function caseProcAiRoute_(iss) {
  if (!iss) return 'light';
  return caseProcAiTopic_([iss.iid, iss.kind, iss.target, iss.label].join(' ')).route;
}

// ---------- 저비용 1차(2번 교차검증이 다루지 않는 자리 — 처음 보는 서류 종류·판독·값 고르기) ----------
//  spots step에서 GAS가 부른다. 사건당 한 번(쟁점 묶음만, cxCallAi_ — 가림·캐시). 확실하고 모자란 정보가 없으면 그 자리는 끝,
//  아니면 총괄로 올린다(저비용 답·모자란 정보를 함께). 꺼져 있으면(CX_AI_AUTO 아님·점검 중) 저비용 자리는 그대로 총괄로 간다.
function caseProcAiLightPass_(c, spots, items) {
  const out = { done: [], up: [], usd: 0, calls: 0, sent: 0, off: false };
  const on = (typeof cxAiOn_ === 'function') ? cxAiOn_() : false;
  if (!on || !spots.length || typeof cxCallAi_ !== 'function') { out.off = true; out.up = spots.slice(); return out; }
  const byId = {}; (items || []).forEach(function (it) { byId[it.id] = it; });
  const parts = spots.slice(0, 12).map(function (s) {
    const it = byId[s.자리], a = (it && it.ask) || {};
    let mat = '';
    if (/^doc:/.test(s.자리)) {
      try { const f = caseProcAiFindFile_(c, s.자리.slice(4)); mat = f ? String(tc_docText_(f) || '').slice(0, 700) : ''; } catch (e) {}
      return '### 쟁점 ' + s.자리 + ' (종류: 처음 보는 서류)\n무엇을 정하나: 이 서류가 무슨 서류인지(서류 종류 이름 한 낱말), 이 사건 세액 계산에 쓰이는지\n원문(앞부분):\n' + mat;
    }
    const cs = caseProcAiOpts_(a).slice(0, 6).map(function (q, i) { return (i + 1) + ') ' + (q.v != null ? q.v : q.label) + (q.src ? ' ← ' + String(q.src).slice(0, 120) : ''); }).join('\n');
    return '### 쟁점 ' + s.자리 + ' (종류: ' + s.이유 + ')\n질문: ' + String((it && it.text) || s.설명 || '').slice(0, 300) + (it && it.detail ? '\n자세히: ' + String(it.detail).slice(0, 500) : '') + (cs ? '\n후보:\n' + cs : '') + (a.aiJudge && a.aiJudge.q ? '\n쟁점 묶음:\n' + String(a.aiJudge.q).slice(0, 900) : '');
  });
  const user = '## 사건 요약\n' + (CASEPROC_TAX_LABEL_[c.세목] || c.세목 || '') + ' · ' + (c.업무유형 || '') + ' · 기준일 ' + (c.기준일 || '?') + '\n\n' + parts.join('\n\n');
  const res = cxCallAi_(LIGHT_MODEL, user);
  out.sent = parts.length; out.calls = res.cached ? 0 : 1; out.usd = res.usd || 0;
  if (res.error) { out.up = spots.slice(); out.error = res.error; return out; }
  const got = (typeof cxParseAnswers_ === 'function') ? cxParseAnswers_(res.text) : [];
  spots.forEach(function (s, i) {
    const a = i < 12 ? got.filter(function (g) { return String(g.id) === String(s.자리); })[0] : null;
    const need = a && Array.isArray(a.need) ? a.need.slice(0, 4) : [];
    const rec = { 자리: s.자리, 이유: s.이유, topic: s.topic, answer: a ? String(a.value == null ? '' : a.value).slice(0, 120) : '', sure: a ? (a.sure === '확실' ? '확실' : '불확실') : '답 없음', why: a ? String(a.why || '').slice(0, 200) : '', quote: a ? String(a.quote || '').slice(0, 200) : '', need: need, model: LIGHT_MODEL };
    if (a && rec.sure === '확실' && !need.length && rec.answer) out.done.push(rec); else out.up.push(Object.assign({}, s, { light: rec }));
  });
  return out;
}
// 저비용이 확실하다고 한 값 — 질문 칸이면 후보 안의 값일 때만 넣는다(값 하나 칸만). 서류 종류는 기록만(정리 도구가 다음에 쓰게)
function caseProcAiLightApply_(c, rec, items) {
  const it = (items || []).filter(function (x) { return x.id === rec.자리; })[0];
  if (!it || !it.ask || !it.ask.target) return { applied: false, why: /^doc:/.test(rec.자리) ? '서류 종류 — 기록만' : '넣을 칸 없음' };
  const a = it.ask, cs = caseProcAiOpts_(a).map(function (q) { return caseProcAiNorm_(q.v != null ? q.v : q.value); });
  if (!CASEPROC_AI_SCALAR_TARGET_RE_.test(a.target) || CASEPROC_AI_USER_ONLY_RE_.test([it.id, it.text, a.target, a.label].join(' ')) || cs.indexOf(caseProcAiNorm_(rec.answer)) === -1) return { applied: false, why: '후보 밖 값·여러 값 칸·세무사님 답 칸 — 넣지 않음' };
  let r;
  try { r = caseProc0_({ caseId: c.id, step: 'apply', target: a.target, value: rec.answer, src: ('🤖 AI 판단(저비용): ' + rec.why).slice(0, 80), label: a.label || '', ans: { qid: it.id, how: 'AI 판단(저비용)' } }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
  if (r && r.ok !== false) caseProcAiMarkApplied_(c.id, { iid: it.id, target: a.target, label: a.label || caseProcAiCut_(it.text, 60), v: rec.answer, by: 'ai', model: LIGHT_MODEL, why: rec.why, sure: '확실', tier: '저비용', cands: caseProcAiOpts_(a).slice(0, 6).map(function (q) { return { v: q.v != null ? q.v : q.value, src: String(q.src || '').slice(0, 160) }; }) });
  return { applied: !!(r && r.ok !== false), why: (r && (r.message || r.error)) || '' };
}
// AI가 넣은 값을 2번 판정 기록(sv.cxAi.applied)에 — 다음 처리 때 2번 0) 단계가 세무사님 확인·수정을 보고 cxLogUserFix_로 기록에 붙인다
function caseProcAiMarkApplied_(caseId, a) {
  try {
    caseProcPatch_(caseId, function (sv) {
      sv.cxAi = sv.cxAi || { applied: {}, asked: {} }; sv.cxAi.applied = sv.cxAi.applied || {};
      sv.cxAi.applied[a.iid] = Object.assign({ at: caseProcToday_(), kind: a.tier || '총괄', input: '' }, a);
    });
  } catch (e) {}
}

// ---------- ① 판단 기록 — 2번 기록 모양(유료질문 기록 kind 'cx')으로. 쟁점 종류(kind) = 주제, 모양(shape) = 겹|근거 종류|칸 종류 ----------
function caseProcAiLogCx_(c, model, usd, items, round) {
  if (!items || !items.length) return;
  try {
    ai_logPaid_({ entry: { kind: 'cx', model: model, usd: usd || 0, q: '사건처리 AI 지휘 판단 — ' + (c.사건명 || c.고객명 || '') + ' (판단 ' + items.length + '개)', cx: {
      id: 'cxl_' + Date.now() + '_' + String(c.id).slice(0, 8), caseId: c.id, case: c.사건명 || '', 세목: c.세목, round: round || 1, bundleChars: 0,
      items: items.slice(0, 30).map(function (x) { return { iid: x.iid, kind: x.topic || '그 밖의 판단', shape: x.shape || '', target: x.target || '', label: x.label || '', facts: caseProcAiMask_(x.facts || '').slice(0, 400), cands: (x.cands || []).slice(0, 6), answer: x.answer == null ? '' : String(x.answer), why: caseProcAiMask_(x.why || ''), sure: x.sure === '확실' ? '확실' : '불확실', need: x.need || [], user: null }; }) } } });
  } catch (e) {}
}
// ---------- ③ 빠진 도구 기록(사건 이름 없이) ----------
function caseProcAiLogGaps_(c, gaps) {
  if (!gaps || !gaps.length) return;
  try {
    withLock_(5000, function () {
      let folder = null; try { const pf = ai_paidLogFile_(), ps = pf.getParents(); folder = ps.hasNext() ? ps.next() : null; } catch (e) {}
      if (!folder) return;
      const it = folder.getFilesByName(CASEPROC_AI_GAP_LOG_), f = it.hasNext() ? it.next() : folder.createFile(CASEPROC_AI_GAP_LOG_, '[]', 'application/json');
      let arr = []; try { arr = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '[]'); } catch (e) { arr = []; }
      const at = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
      gaps.forEach(function (g) { arr.push(JSON.parse(caseProcAiMask_(JSON.stringify({ at: at, 세목: c.세목, 업무유형: c.업무유형 || '', caseKey: typeof cxHash_ === 'function' ? cxHash_(String(c.id)) : '', want: g.want, kind: g.kind || '', tool: g.tool || '', shape: g.shape || '', instead: g.instead || '', auto: !!g.auto })))); });
      f.setContent(JSON.stringify(arr.slice(-3000)));
    });
  } catch (e) {}
}
function caseProcAiReadJson_(name) {
  try {
    const pf = ai_paidLogFile_(), ps = pf.getParents(); if (!ps.hasNext()) return [];
    const it = ps.next().getFilesByName(name); if (!it.hasNext()) return [];
    const a = JSON.parse(it.next().getBlob().getDataAsString('UTF-8') || '[]'); return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}

// ---------- ②⑤ 주간 점검표(토큰 0) — Drive 없이 배열만 받는 순수 함수 + 읽는 함수 ----------
//  runs: _사건처리AI판단기록.json(사건처리마다 한 줄 — mode gas0/ai/fallback, won, tiers, tools) / paid: 유료질문 기록(kind 'cx') / gaps: _사건처리빠진도구.json / promoted: _사건처리규칙승격기록.json
//  opt.dev: 개발용 사건 id 목록(스크립트 속성 AI_DEV_CASE_IDS — 규칙 후보의 "처음 보는 사건"에서 뺌)
function caseProcAiWeeklyFrom_(runs, paid, gaps, promoted, opt) {
  opt = opt || {};
  const wk = function (at) { return (typeof cxlogWeekKey_ === 'function' ? cxlogWeekKey_(at) : String(at || '').slice(0, 10)) || '날짜없음'; };
  const dev = {}; (opt.dev || []).forEach(function (id) { dev[String(id)] = 1; });
  const W = {};
  const bucket = function (w) { return W[w] || (W[w] = { week: w, runs: 0, gas0: 0, ai: 0, fallback: 0, won: 0, decisions: 0, tiers: { GAS: 0, 저비용: 0, 올림: 0, 총괄: 0, 질문: 0 }, tools: {}, promoted: 0, gaps: 0 }); };
  (runs || []).forEach(function (r) {
    if (!r || !r.at) return;
    const b = bucket(wk(r.at));
    b.runs++; if (r.mode === 'gas0') b.gas0++; else if (r.mode === 'fallback') b.fallback++; else b.ai++;
    b.won += +r.won || 0; b.decisions += (r.decisions || []).length;
    Object.keys(r.tiers || {}).forEach(function (k) { if (b.tiers[k] != null) b.tiers[k] += +r.tiers[k] || 0; });
    (r.tools || []).forEach(function (t) { b.tools[t] = 1; });
  });
  (promoted || []).forEach(function (p) { if (p && p.at) bucket(wk(p.at)).promoted += 1; });
  (gaps || []).forEach(function (g) { if (g && g.at) bucket(wk(g.at)).gaps += 1; });
  const weeks = Object.keys(W).sort().slice(-(+opt.weeks || 12)).map(function (k) {
    const b = W[k], n = b.gas0 + b.ai + b.fallback;
    return { week: b.week, runs: n, aiFree: n ? Math.round(b.gas0 / n * 1000) / 10 : 0, perCaseDecisions: b.ai ? Math.round(b.decisions / b.ai * 10) / 10 : 0, perCaseWon: n ? Math.round(b.won / n * 10) / 10 : 0, tiers: b.tiers, toolCount: Object.keys(b.tools).length, promoted: b.promoted, gaps: b.gaps, fallback: b.fallback };
  });
  // 새로 만든 도구 수 — 그 주에 처음 보인 도구 이름
  const seen = {}; weeks.forEach(function (w) { const ks = Object.keys(W[w.week].tools); w.newTools = Object.keys(seen).length ? ks.filter(function (t) { return !seen[t]; }).length : 0; ks.forEach(function (t) { seen[t] = 1; }); });
  // 두 주 연속 멈춤 — AI 없이 끝 비율이 안 오르고, 사건당 비용이 안 내리고, 규칙 승격·새 도구가 0인 주가 두 번 잇달아
  const stalled = function (w, prev) { return prev && w.runs && !(w.aiFree > prev.aiFree) && !(w.perCaseWon < prev.perCaseWon) && !w.promoted && !w.newTools; };
  let stall = false;
  if (weeks.length >= 3) { const a = weeks[weeks.length - 1], b = weeks[weeks.length - 2], c0 = weeks[weeks.length - 3]; stall = stalled(a, b) && stalled(b, c0); }
  // ② 규칙 후보 — 같은 주제+모양에 AI가 늘 같은 방식으로 답했고, 처음 보는 사건 2건 이상에서 세무사님이 "확인"(맞음)했고, 한 번도 "수정"하지 않은 것
  const recs = (paid || []).filter(function (r) { return r && r.kind === 'cx' && r.cx && Array.isArray(r.cx.items) && !/\[점검 중|zz_|\[시험\]|harness/.test(String(r.q || '')); });
  const G = {}, T = {};
  recs.forEach(function (r) {
    const cid = String(r.cx.caseId || ''), lead = /^cxl_/.test(String(r.cx.id || ''));
    r.cx.items.forEach(function (it) {
      if (!it) return;
      const gk = (it.kind || '') + '|' + (it.shape || '');
      const g = G[gk] || (G[gk] = { kind: it.kind || '', shape: it.shape || '', cases: {}, okCases: {}, fixed: 0, items: [] });
      g.items.push(it); g.cases[cid] = 1;
      if (it.user && it.user.act === '수정') g.fixed++;
      if (it.user && it.user.act === '확인' && !dev[cid]) g.okCases[cid] = 1;
      // ③(세 겹) 주제별 — 고친 비율, 총괄 답이 늘 같은 비율
      const t = T[it.kind || ''] || (T[it.kind || ''] = { topic: it.kind || '', items: 0, judged: 0, fixed: 0, lead: 0, answers: {} });
      t.items++; if (it.user) t.judged++; if (it.user && it.user.act === '수정') t.fixed++;
      if (lead) { t.lead++; const k = String(it.answer == null ? '' : it.answer).replace(/\s+/g, '').slice(0, 40); t.answers[k] = (t.answers[k] || 0) + 1; }
    });
  });
  const ruleCands = Object.keys(G).map(function (k) { return G[k]; }).filter(function (g) { return Object.keys(g.okCases).length >= 2 && !g.fixed; }).map(function (g) {
    let common = null;
    g.items.forEach(function (it) { const ps = typeof cxlogAnswerPatterns_ === 'function' ? cxlogAnswerPatterns_(it) : []; common = common == null ? ps : common.filter(function (p) { return ps.indexOf(p) !== -1; }); });
    return { kind: g.kind, shape: g.shape, okCases: Object.keys(g.okCases).length, cases: Object.keys(g.cases).length, items: g.items.length, pattern: (common || [])[0] || '', rule: (common || [])[0] && typeof cxlogPatternText_ === 'function' ? cxlogPatternText_(common[0]) : '답이 사건마다 달라 규칙 모양 없음 — 근거(서류·법령)부터 확인' };
  }).sort(function (a, b) { return b.okCases - a.okCases || b.items - a.items; });
  const route = caseProcAiRouteTable_(), routeOf = {}; route.forEach(function (x) { routeOf[x.topic] = x.route; });
  const topics = Object.keys(T).map(function (k) {
    const t = T[k], top = Object.keys(t.answers).sort(function (a, b) { return t.answers[b] - t.answers[a]; })[0];
    const same = t.lead ? Math.round((t.answers[top] || 0) / t.lead * 1000) / 10 : 0, fixRate = t.judged ? Math.round(t.fixed / t.judged * 1000) / 10 : 0;
    const r = routeOf[t.topic] || CASEPROC_AI_ROUTE_ELSE_.route;
    const move = r === 'lead' && t.lead >= 3 && same >= 80 && !t.fixed ? '내리기 후보(총괄 → 저비용 또는 GAS 규칙)' : r === 'light' && t.judged >= 3 && fixRate >= 30 ? '올리기 후보(저비용 → 총괄)' : '';
    return { topic: t.topic, route: r, items: t.items, fixRate: fixRate, leadSame: same, move: move };
  }).sort(function (a, b) { return b.items - a.items; });
  const gapCount = {}; (gaps || []).forEach(function (g) { const k = String(g.want || '').slice(0, 80); if (k) gapCount[k] = (gapCount[k] || 0) + 1; });
  const gapTop = Object.keys(gapCount).sort(function (a, b) { return gapCount[b] - gapCount[a]; }).slice(0, 15).map(function (k) { return { want: k, n: gapCount[k] }; });
  const lines = [];
  const lw = weeks[weeks.length - 1];
  if (!lw) lines.push('🤖 AI 지휘 기록이 아직 없습니다.');
  else {
    lines.push('🤖 AI 지휘 이번 주(' + lw.week + '~) — 사건처리 ' + lw.runs + '건 · AI 없이 끝 ' + lw.aiFree + '% · AI 사건당 판단 ' + lw.perCaseDecisions + '개 · 사건당 ' + lw.perCaseWon + '원 · 규칙 승격 ' + lw.promoted + ' · 새 도구 ' + lw.newTools + (lw.fallback ? ' · 예비 경로 ' + lw.fallback + '건' : ''));
    lines.push('🧭 길 나누기 — GAS 확정 ' + lw.tiers.GAS + ' · 저비용 확정 ' + lw.tiers.저비용 + ' · 올림 ' + lw.tiers.올림 + ' · 총괄 ' + lw.tiers.총괄 + ' · 질문 ' + lw.tiers.질문);
  }
  if (stall) lines.push('⚠ 두 주 연속 멈춤 — AI 없이 끝 비율이 안 오르고 비용이 안 내렸으며 규칙 승격·새 도구가 없습니다. 규칙 후보·빠진 도구부터 PR로.');
  ruleCands.slice(0, 8).forEach(function (r) { lines.push('🧩 GAS 규칙 후보 — ' + r.kind + ' [' + r.shape.slice(0, 40) + ']: 처음 보는 사건 ' + r.okCases + '건에서 맞음(세무사님 확인), 고친 적 없음 — ' + r.rule); });
  topics.filter(function (t) { return t.move; }).forEach(function (t) { lines.push('🔀 ' + t.topic + ' — ' + t.move + ' (고친 비율 ' + t.fixRate + '%, 총괄 답 같은 비율 ' + t.leadSame + '%) — 사람이 승인'); });
  gapTop.slice(0, 5).forEach(function (g) { lines.push('🧰 빠진 도구 — ' + g.want + ' (' + g.n + '번)'); });
  return { ok: true, weeks: weeks, stall: stall, ruleCands: ruleCands.slice(0, 30), topics: topics, gaps: gapTop, lines: lines };
}
function caseProcAiWeekly_(opt) {
  opt = opt || {};
  let paid = []; try { paid = JSON.parse(ai_paidLogFile_().getBlob().getDataAsString('UTF-8') || '[]'); } catch (e) { paid = []; }
  let dev = []; try { dev = String(PropertiesService.getScriptProperties().getProperty('AI_DEV_CASE_IDS') || '').split(/[,\s]+/).filter(Boolean); } catch (e) {}
  return caseProcAiWeeklyFrom_(caseProcAiReadJson_(CASEPROC_AI_LOG_NAME_), paid, caseProcAiReadJson_(CASEPROC_AI_GAP_LOG_), caseProcAiReadJson_(CASEPROC_AI_PROMOTE_LOG_), { dev: dev, weeks: +opt.weeks || 12 });
}

// =========================================================
// [2026.10.20 밤샘 — 세무사님] "정보분석은 잘게 쪼개기가 우선이고 그 다음에는 입체적으로 사실관계를 재구성하는 것이 중요하다"
//  "조각정보를 입체적으로 재구성하다보면 빈칸이 발생하고 빈칸을 채우기 위해 다시 똥통을 뒤지게 되는 것이 데이타확보와 정보분석에서 흔히 있는 일이다."
//  ②-2 입체 재구성(fact_map): 사실 조각(1번 사실 목록 cxFacts_)을 사람·자산·시간·돈 네 축으로 묶어 — 둘 이상 서류가 받침 / 한 서류뿐 / 어긋남,
//   빈칸(계산기가 아직 비었다고 한 칸)마다 "어느 서류에서 찾을 수 있나"(법정·발급 서류 기준 표)와 이 사건에 그 서류가 있는지.
//  다시 뒤지기(doc_find): AI가 고른 서류를 GAS가 다시 훑어(저장된 판독만 — Vision 줄·칸 글, 쪽 단위 글, 드라이브 글, 새 판독·쓰기 없음)
//   날짜·금액·낱말 후보를 쪽 번호와 함께 돌려준다(원문 통째가 아님). AI는 "무엇을 어디서 다시 찾을지"만 고른다.
// =========================================================
var CASEPROC_AI_AXES_ = [['돈', /금액|가액|대금|잔액|보증금|채무|비용|세액|공시|기준시가|매매가|보상/], ['시간', /일$|일자|날짜|기간|접수|개시|사망/], ['사람', /성명|이름|관계|생년|주민|주소|상속인|당사자|매도인|매수인|수증자|증여자/], ['자산', /소재지|지번|면적|지목|용도|구조|물건|토지|건물|주택/]];
// 빈칸 → 찾을 서류(법정·발급 서류 기준 — 이 사무소 파일 이름과 무관)
var CASEPROC_AI_GAP_SRC_ = [
  [/취득일|취득 ?원인/, '등기사항증명서(갑구 접수일·원인)·취득 계약서(잔금일)', /등기|계약/], [/취득가액|취득 ?금액/, '취득 계약서·분양계약서', /계약/],
  [/양도가액|양도일|잔금/, '양도 계약서·등기사항증명서(이전 접수일)', /계약|등기/], [/소재지|면적|지번/, '등기사항증명서·건축물대장·토지대장', /등기|대장/],
  [/주택|용도|assetType/, '건축물대장(주용도)', /대장/], [/세대|거주|전입/, '주민등록 등본·초본', /주민|등본|초본/], [/관계/, '가족관계증명서', /가족/],
  [/증여일|증여재산|증여가액/, '증여계약서·등기사항증명서(증여 원인)', /계약|등기/], [/상속개시|사망|상속인/, '기본증명서·가족관계증명서·제적등본', /기본|가족|제적/],
  [/채무|부채|대출/, '부채증명서·대출 잔액증명서', /부채|대출|잔액/], [/예금|금융재산|잔액/, '잔액증명서·거래내역', /잔액|거래내역|통장/], [/경비|비용|수수료/, '영수증·세금계산서·견적서', /영수증|세금계산서|견적/]
];
function caseProcAiAxis_(f) { const k = String(f.kind || ''); for (let i = 0; i < CASEPROC_AI_AXES_.length; i++) if (CASEPROC_AI_AXES_[i][1].test(k)) return CASEPROC_AI_AXES_[i][0]; const ks = f.keys || {}; return ks.person ? '사람' : ks.asset ? '자산' : ks.date ? '시간' : ks.amount ? '돈' : '그 밖'; }
function caseProcAiFactMap_(c, items) {
  let facts = []; try { facts = (typeof cxFacts_ === 'function' ? cxFacts_(c) : []) || []; } catch (e) { facts = []; }
  const G = {}, A = {}, fileKinds = {};
  facts.forEach(function (f) {
    if (!f || f.kind === '서류') { if (f && f.src && f.src.file) fileKinds[f.src.file] = String(f.value || ''); return; }
    // [밤샘 5번-4] 원문 줄(글자 줄·표 줄 등 찾기용 재료)은 사실이 아니라 지도에서 뺀다
    if (/글자 ?줄|표 ?줄|^text$|^binary$/.test(String(f.kind || ''))) return;
    const ax = caseProcAiAxis_(f), ks = f.keys || {}, file = (f.src && f.src.file) || '';
    if (file && f.src.docType && !fileKinds[file]) fileKinds[file] = f.src.docType;
    const a0 = A[ax] || (A[ax] = { 조각: 0, 출처: 0, 열쇠없음: 0 }); a0.조각++; if (file) a0.출처++;
    // "같은 사실"은 무엇에 대한 사실인지(자산·사람·계좌·서류번호)가 있어야 맞댈 수 있다 — 열쇠 없는 조각은 세기만
    if (!(ks.asset || ks.person || ks.account || ks.docNo)) { a0.열쇠없음++; return; }
    const gk = ax + '|' + f.kind + '|' + (ks.asset || ks.person || ks.account || ks.docNo || '');
    const g = G[gk] || (G[gk] = { ax: ax, kind: f.kind, key: ks.asset || ks.person || ks.account || '', vals: {}, files: {} });
    const v = typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value == null ? '' : f.value).replace(/[\s,원]/g, '');
    if (!v) return;
    (g.vals[v] = g.vals[v] || {})[file + (f._copy ? '#사본' : '')] = (f.src && f.src.page) || 1;
    if (file && !f._copy) (g.files[file] = g.files[file] || {})[v] = 1;
  });
  const sum = {}, conflicts = [], singles = [];
  Object.keys(G).forEach(function (k) {
    const g = G[k], nv = Object.keys(g.vals).length, nf = Object.keys(g.files).length, s = sum[g.ax] || (sum[g.ax] = { 묶음: 0, 받침: 0, 한서류: 0, 어긋남: 0, 여러값: 0 });
    if (!nv) return; s.묶음++;
    // 받침 = 서로 다른 서류 둘 이상이 같은 값 / 어긋남 = 값을 하나만 말하는 서류끼리 값이 다름(통장 거래처럼 한 서류에 값이 여럿인 것은 어긋남 아님)
    const fv = Object.keys(g.files).map(function (fn) { return Object.keys(g.files[fn]); });
    const shared = Object.keys(g.vals).some(function (v) { return fv.filter(function (vs) { return vs.indexOf(v) !== -1; }).length >= 2; });
    const singleVals = fv.filter(function (vs) { return vs.length === 1; }).map(function (vs) { return vs[0]; });
    const clash = !shared && singleVals.length >= 2 && singleVals.some(function (v) { return v !== singleVals[0]; });
    if (shared) s.받침++;
    else if (clash) { s.어긋남++; if (conflicts.length < 12) conflicts.push(g.ax + ' · ' + g.kind + (g.key ? '(' + caseProcAiCut_(g.key, 24) + ')' : '') + ': ' + Object.keys(g.vals).slice(0, 3).map(function (v) { return caseProcAiCut_(v, 24) + '←' + Object.keys(g.vals[v]).slice(0, 2).map(function (f) { return caseProcAiCut_(f, 30); }).join('·'); }).join(' / ')); }
    else if (nf >= 2) s.여러값++; /* 여러 서류에 값이 여럿(거래 줄 등) — 같은 값이 없으면 맞댈 수 없음 */ else { s.한서류++; if (singles.length < 8) singles.push(g.ax + ' · ' + g.kind + ' ← ' + caseProcAiCut_(Object.keys(g.files)[0] || '', 30)); }
  });
  // 빈칸 — 계산기가 비었다고 한 칸(질문 중 빈 칸)마다 찾을 서류와 이 사건에 있는 그 종류 파일
  const files = Object.keys(fileKinds);
  const gaps = (items || []).filter(function (it) { return it.kind === 'missing'; }).slice(0, 15).map(function (it) {
    const t = [it.id, it.text, it.ask && it.ask.label, it.ask && it.ask.target].join(' ');
    const m = CASEPROC_AI_GAP_SRC_.filter(function (x) { return x[0].test(t); })[0];
    const have = m ? files.filter(function (fn) { return m[2].test(fileKinds[fn] + ' ' + fn); }).slice(0, 4) : [];
    return { 칸: it.id, 글: caseProcAiCut_(it.text, 60), 찾을서류: m ? m[1] : '(표에 없음 — 질문)', 이사건에있는파일: have.length ? have : (m ? '없음 — 서류 요청 질문' : '') };
  });
  const tot = { 조각: 0, 출처: 0, 열쇠없음: 0, 묶음: 0, 받침: 0, 어긋남: 0 };
  Object.keys(A).forEach(function (k) { tot.조각 += A[k].조각; tot.출처 += A[k].출처; tot.열쇠없음 += A[k].열쇠없음 || 0; });
  Object.keys(sum).forEach(function (k) { tot.묶음 += sum[k].묶음; tot.받침 += sum[k].받침; tot.어긋남 += sum[k].어긋남; });
  return { ok: true, 축: sum, 조각: A, 합: tot, 지표: { '②-1 출처 비율': tot.조각 ? Math.round(tot.출처 / tot.조각 * 100) : 0, '②-2 둘 이상 서류가 받치는 비율': tot.묶음 ? Math.round(tot.받침 / tot.묶음 * 100) : 0 }, 어긋남: conflicts, 한서류뿐: singles, 빈칸: gaps };
}
// 입구 요약 한 줄 — 사실 지도(GAS, 0원)를 미리 넣어 AI가 fact_map을 부르지 않아도 어긋남·빈칸과 찾을 서류를 본다
function caseProcAiFactLine_(c, items) {
  try {
    const fm = caseProcAiFactMap_(c, items || []);
    const g = fm.빈칸.filter(function (x) { return Array.isArray(x.이사건에있는파일); }).slice(0, 4).map(function (x) { return x.칸 + '→' + x.이사건에있는파일.slice(0, 2).join('·'); });
    return '사실 지도(GAS): 받침 ' + fm.합.받침 + ' · 어긋남 ' + fm.합.어긋남 + (fm.어긋남.length ? '(' + fm.어긋남.slice(0, 2).map(function (x) { return caseProcAiCut_(x, 70); }).join(' / ') + ')' : '') + ' · 빈칸 ' + fm.빈칸.length + (g.length ? ' — 이 사건 서류로 다시 뒤질 수 있는 빈칸: ' + g.join(', ') + ' (doc_find로)' : '') + '. 자세히는 fact_map.';
  } catch (e) { return ''; }
}
// 다시 뒤지기 — 저장된 판독만(새 판독·쓰기 없음). want: date | amount | keyword(+keyword) | name
function caseProcAiDocFind_(c, input) {
  const f = caseProcAiFindFile_(c, input.file);
  if (!f) return { 오류: '서류를 찾지 못함' };
  const srcs = [];
  try { const v = typeof tcVisionText_ === 'function' ? tcVisionText_(f) : ''; if (v) srcs.push(['Vision 줄·칸', v]); } catch (e) {}
  try { const p = typeof tcPdfPageTexts_ === 'function' && /pdf/.test(String(f.mimeType || '')) ? tcPdfPageTexts_(f, 0) : null; if (p && p.pages) srcs.push(['쪽 단위', Object.keys(p.pages).sort(function (a, b) { return a - b; }).filter(function (k) { return p.pages[k]; }).map(function (k) { return '[' + k + '쪽]\n' + p.pages[k]; }).join('\n')]); } catch (e) {}
  try { srcs.push(['드라이브 글', String(tc_docText_(f) || '')]); } catch (e) {}
  const want = String(input.want || 'keyword'), kw = String(input.keyword || '').replace(/\s+/g, '');
  const re = want === 'date' ? /(19|20)\d{2}\s*[.\-년\/]\s*\d{1,2}\s*[.\-월\/]\s*\d{1,2}/g : want === 'amount' ? /\d{1,3}(,\d{3})+(?:\s*원)?|\d+\s*(억|천만|백만)\s*\d*[천백십]?만?\s*원?/g : null;
  const hits = [], seen = {};
  srcs.forEach(function (s) {
    let page = 1;
    String(s[1]).split('\n').forEach(function (line, i, ls) {
      const pm = /^\[(\d+)쪽\]/.exec(line); if (pm) { page = +pm[1]; return; }
      const flat = line.replace(/\s+/g, '');
      const ms = re ? (line.match(re) || []) : (kw && flat.indexOf(kw) !== -1 ? [kw] : []);
      ms.forEach(function (m) { const k = m.replace(/\s+/g, '') + '|' + page; if (seen[k] || hits.length >= 14) return; seen[k] = 1; hits.push({ 값: m.trim(), 쪽: page, 판독: s[0], 앞뒤: caseProcAiMask_(caseProcAiCut_((ls[i - 1] || '') + ' ⟨' + line.trim() + '⟩ ' + (ls[i + 1] || ''), 140)) }); });
    });
  });
  return { ok: true, 파일: f.name, 읽은판독: srcs.map(function (s) { return s[0]; }), 찾음: hits.length, 후보: hits, 안내: hits.length ? '값을 넣으려면 value_set basis {kind:"doc", file, page, find:값}' : '이 서류의 저장된 판독에서 못 찾음 — 다른 서류(fact_map 빈칸의 찾을서류)나 질문으로' };
}
