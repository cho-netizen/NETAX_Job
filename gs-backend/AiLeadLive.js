// =========================================================
// [2026.10.19 5번 — AI 지휘 운영 흐름] 세무사님 결정(원문): "그렇다면 이번에 지휘권을 ai에게 넘기는 것으로 하자. 어차피 가야할 방향이다"
//  "이 사건 처리하자"의 기본 동작:
//   1) GAS 입구가 상수 한 바퀴(사건파악 → 증빙 읽기·나누기·보정 → 칸 채우기 반복)를 돈다 — 지금 ⚡ 처리 그대로, 토큰 0.
//   2) 그 결과에서 AI 자리(caseProcAiVarSpots_)를 센다(step 'spots'). AI 자리가 없으면 AI를 부르지 않고 계산·저장으로 끝(0원).
//   3) AI 자리가 있으면 지휘 AI(Sonnet 5.5)가 도구(AiLead.js CASEPROC_AI_TOOLS_ + 좁은 판단 두 개)를 부려 판단한다(step 'turn',
//      화면이 차례마다 부름 — 한 번 부를 때 모델 한 번 + 그 차례의 도구 실행, Apps Script 6분 한도 안).
//   4) 끝나면 화면이 칸 채우기를 한 번 더 돌려 AI가 넣은 값을 보이고, 계산·서식·저장·검토서·현황표는 지금 ⚡ 처리 그대로.
//  세무사님이 정한 세부(결정표 ① 5번 추천 채택):
//   · 비용 상한: 단순·일반 신고 1,000원, 절세·불복(경정·해명·조사 포함) 5,000원. 최고급 모델(Fable)은 쓰기 전 여쭘(자동으로 안 씀)
//   · AI가 "확실"이라 한 판단은 넣고 🤖 표시와 근거(출처 칸). 시가·관계처럼 세액이 크게 갈리는 칸은 세무사님 답으로만
//   · 좁은 판단은 저가 AI(Haiku 5.5 — quick_judge), 어려운 판단만 상위(Opus 5.5 — ask_higher), 사건 전체 판단은 지휘 AI
//   · 질문은 계산을 막는 것만 바로(urgent), 나머지는 끝에 모아서
//   · 주민번호 뒷자리·계좌·전화 가림(caseProcAiMask_) · 되돌리기 어려운 일은 ▶실행 카드(도구가 없음 — 보고에 적게 함)
//   · 규칙 승격은 처음 보는 사건 2건 이상 확인 뒤(이 파일은 판단 기록만 남김 — _사건처리AI판단기록.json)
//  예비 경로: "GAS 순서로 처리" 말·단추, AI 오류·비용 상한·바퀴 한도면 화면이 그 자리에서 지금 GAS 순서로 이어간다.
//  모델 표는 Code.js MODEL_CONFIG. 도구 강제 지정(tool_choice)은 최신 모델에서 400이라 쓰지 않는다.
// =========================================================
var CASEPROC_AI_DIRECTOR_MODEL_ = 'claude-sonnet-5-5';
var CASEPROC_AI_LIGHT_MODEL_ = 'claude-haiku-5-5';
var CASEPROC_AI_HIGH_MODEL_ = 'claude-opus-5-5';
var CASEPROC_AI_KRW_ = 1400;
var CASEPROC_AI_MAX_ROUNDS_ = 14;
var CASEPROC_AI_TURN_BUDGET_MS_ = 150000; // 한 차례(서버 한 번)에 도구를 새로 시작할 수 있는 시간 — 화면 다리(gasbridge)는 같은 요청을 4분까지 기다린다
// 세액이 크게 갈리는 칸 — AI가 근거를 대도 넣지 않고 세무사님 답으로만(질문 id·질문 글 기준)
var CASEPROC_AI_USER_ONLY_RE_ = /relfmv|시가|특수관계|가족관계|관계인지|평가액|감정가|buyerrel|donorRelation|giftRelation|giftPrior|사전증여|10년 내|합산액/; // 10년 합산(사전증여)은 2번 잠정 0과 같이 세무사님 확인 칸
// 특수관계 질문(2번 relcheck) — 세무사님 원문 "특수관계 여부를 확인하는 절차만 있으면 된다": 총괄 AI도 값·의견을 붙이지 않고 질문 글의 정황 근거만 세무사님께
var CASEPROC_AI_RELATION_RE_ = /^(tr:buyerrel|trc:a\d+\.donorRelation|ov:giftRelation(:.*)?|tr:relfmv)$/;
var CASEPROC_AI_LOG_NAME_ = '_사건처리AI판단기록.json';
var CASEPROC_AI_NO_TOOLS_ = ['docs_read', 'doc_text']; // [GAS 고도화 ④] 지휘 AI에게 주지 않는 도구

// 사건당 비용 상한(원) — 업무유형으로
function caseProcAiCap_(c) {
  const t = String((c && (c.업무유형 || '')) || '') + ' ' + String((c && c._세목작업관리) || '');
  return /절세|불복|경정|해명|조사|이의|심판|심사|컨설팅/.test(t) ? 5000 : 1000;
}

// 판단 자리별 수준(설계 2-7) — 1 저가 · 2 중간 · 3 고급
function caseProcAiSpotLevel_(s) {
  const k = String(s.자리 || ''), why = String(s.이유 || '');
  if (/^cls:(오피스텔|재촌자경|정비사업|상속주택)/.test(k)) return 3;
  if (/무슨 돈인가/.test(why)) return 2;
  if (/처음 보는 서류|판독 갈림|어긋남/.test(why)) return 1;
  return 2;
}

// ---------- step 'spots' — 입구(GAS) 상수 한 바퀴 결과에서 AI 자리를 센다 ----------
//  body: { caseId, ov: { items, needs }, ev: { docTypes } } — 화면이 가진 마지막 칸 채우기·증빙 결과(이미 결정한 질문은 빼고 보냄)
function caseProcAiSpots_(body) {
  const caseId = String(body.caseId || '').trim();
  const c = akReadCase_(caseId);
  if (!c) return { error: '사건을 찾지 못했습니다.' };
  // 끄는 스위치 — 스크립트 속성 AI_LEAD = "끄기"면 배포 없이 곧바로 예전 GAS 순서(AI 지휘·저비용 1차 모두 안 부름)
  try { if (String(PropertiesService.getScriptProperties().getProperty('AI_LEAD') || '') === '끄기') return { ok: true, off: true, need: false, ai: 0, ask: 0, gas: 0, tiers: null, spots: [], why: 'AI 지휘 꺼짐(스크립트 속성 AI_LEAD = 끄기)' }; } catch (e) {}
  const ov = body.ov || {}, ev = body.ev || {}, items = ov.items || [];
  let spots = [];
  // 자리 세기가 실패하면 "AI 없이 끝"으로 숨기지 않고 오류로 돌려준다 — 화면은 예비 경로(지금 GAS 순서)로 가고 오류를 보인다(2026-10-19 재현기에서 조용히 0개로 세던 결함)
  try { spots = caseProcAiVarSpots_('calc_fill', { items: items, needs: ov.needs || null, case: c }, caseId); } catch (e) { return { ok: false, error: 'AI 자리 세기 오류: ' + (e && e.message || e) }; }
  try { spots = spots.concat(caseProcAiVarSpots_('docs_read', { docTypes: ev.docTypes || [] }, caseId)); } catch (e) {}
  const byId = {}; items.forEach(function (it) { byId[it.id] = it; });
  const gas = spots.filter(function (s) { return CASEPROC_AI_GAS_SPOTS_[s.이유]; });
  const ask = spots.filter(function (s) { return s.이유 === '빈 칸'; });
  // [세 겹 ①] 길 나누기 — GAS·2번 교차검증이 이미 정한 것은 빼고, 남은 판단 자리를 주제 표로 저비용/총괄에
  const tiers = { GAS: 0, 저비용: 0, 올림: 0, 총괄: 0, 질문: ask.length };
  const light = [], lead = [];
  spots.filter(function (s) { return !CASEPROC_AI_GAS_SPOTS_[s.이유] && s.이유 !== '빈 칸'; }).forEach(function (s) {
    const it = byId[s.자리], a = (it && it.ask) || {}, aj = a.aiJudge;
    if (/^cxai:/.test(s.자리) || (aj && aj.sure === '확실' && aj.value !== '' && aj.value != null)) { tiers[aj && aj.by === 'gas' ? 'GAS' : '저비용']++; return; } // 교차검증(GAS)·저비용이 이미 정함 — 세무사님 확인만
    const tp = caseProcAiTopic_([s.자리, s.이유, it && it.text, a.label, a.target].join(' '));
    s.topic = tp.topic;
    if (a.route === 'lead') { s.tier = '총괄'; lead.push(s); return; }                       // 2번 교차검증이 표대로 총괄로 보냄
    if (aj) { s.tier = '올림'; s.light = { answer: aj.value, sure: aj.sure, why: aj.why, need: aj.need || [], model: aj.model }; lead.push(s); return; } // 저비용(2번)이 불확실 → 올림
    if (tp.route === 'light') light.push(s); else { s.tier = '총괄'; lead.push(s); }
  });
  // [세 겹 ②] 저비용 1차 — 확실하고 모자란 정보가 없으면 끝(값 칸이면 후보 안의 값만 넣음), 아니면 총괄로 올림
  const plan = { 저비용후보: light.length, 총괄직행: lead.length, 주제: {} };
  light.concat(lead).forEach(function (s) { plan.주제[s.topic] = (plan.주제[s.topic] || 0) + 1; });
  const lp = caseProcAiLightPass_(c, light, items);
  let lightApplied = 0;
  lp.done.forEach(function (rec) { const r = caseProcAiLightApply_(c, rec, items); rec.applied = r.applied; rec.result = r.why; if (r.applied) lightApplied++; tiers.저비용++; });
  lp.up.forEach(function (s) { s.tier = lp.off ? '총괄' : '올림'; lead.push(s); });
  if (!lp.off) caseProcAiLogCx_(c, LIGHT_MODEL, lp.usd, lp.done.concat(lp.up.map(function (s) { return s.light ? Object.assign({ 자리: s.자리, topic: s.topic }, s.light) : null; }).filter(Boolean)).map(function (r) {
    const it = byId[r.자리] || {}, a = it.ask || {};
    return { iid: r.자리, topic: r.topic || caseProcAiTopic_(r.자리).topic, shape: '저비용|' + (/^doc:/.test(r.자리) ? '서류' : String(a.target || '').split(':')[0]), target: a.target || '', label: a.label || caseProcAiCut_(it.text || r.자리, 60), facts: r.quote || '', cands: caseProcAiOpts_(a).slice(0, 6).map(function (q) { return { v: q.v != null ? q.v : q.value, src: String(q.src || '').slice(0, 100) }; }), answer: r.answer, why: r.why, sure: r.sure, need: r.need || [] };
  }));
  lead.forEach(function (s) { tiers[s.tier] = (tiers[s.tier] || 0) + 1; });
  const level = lead.reduce(function (m, s) { return Math.max(m, caseProcAiSpotLevel_(s)); }, 0);
  const by = {}; lead.forEach(function (s) { by[s.topic || s.이유] = (by[s.topic || s.이유] || 0) + 1; });
  const entry = [
    '사건 ' + caseId + ' — ' + (CASEPROC_TAX_LABEL_[c.세목] || c.세목 || '') + ' · ' + (c.업무유형 || '') + ' · 기준일 ' + (c.기준일 || '?'),
    '입구(GAS)가 상수 한 바퀴를 돌았고(서류 읽기·칸 채우기·교차검증), 저비용 AI가 좁은 판단을 먼저 봤습니다. 아래 자리만 네가 판단한다.',
    '네 자리 ' + lead.length + '개: ' + lead.map(function (s) { return '[' + s.자리 + ' · ' + (s.topic || '') + ' · ' + s.이유 + ' · ' + s.tier + (s.light ? ' — 저비용 답 "' + caseProcAiCut_(s.light.answer || '', 40) + '"(' + (s.light.sure || '') + ')' + (s.light.need && s.light.need.length ? ' 모자란 정보: ' + s.light.need.join(', ') : '') : '') + '] ' + caseProcAiCut_(s.설명 || '', 80); }).join(' / '),
    '저비용·GAS가 이미 정한 것 ' + (tiers.GAS + tiers.저비용) + '개(네가 다시 보지 않는다).',
    '서류에 없어 세무사님께 바로 묻는 빈 칸 ' + ask.length + '개(네가 찾지 않는다): ' + ask.slice(0, 12).map(function (s) { return s.자리; }).join(', '),
    'GAS 몫(못 읽은 서류·재료 없음·상수) ' + gas.length + '개: ' + gas.slice(0, 8).map(function (s) { return s.자리 + '(' + s.이유 + ')'; }).join(', '),
    '비용 상한 ' + caseProcAiCap_(c).toLocaleString('ko-KR') + '원, 바퀴 상한 ' + CASEPROC_AI_MAX_ROUNDS_ + '. calc_fill부터 불러 지금 칸과 질문을 본 뒤 판단하라.'
  ].join('\n');
  return { ok: true, ai: lead.length, ask: ask.length, gas: gas.length, byWhy: by, level: level, cap: caseProcAiCap_(c), need: lead.length > 0, tiers: tiers, plan: plan, lightApplied: lightApplied, lightOff: lp.off, lightUsd: lp.usd, lightError: lp.error || '',
    lightDone: lp.done.map(function (r) { return { 자리: r.자리, topic: r.topic, answer: caseProcAiMask_(r.answer), why: caseProcAiMask_(r.why), applied: !!r.applied }; }),
    spots: lead.map(function (s) { return { 자리: s.자리, 이유: s.이유, 주제: s.topic || '', 겹: s.tier, 수준: caseProcAiSpotLevel_(s), 설명: caseProcAiCut_(s.설명 || '', 120) }; }), entry: caseProcAiMask_(entry) };
}

// ---------- 지휘 AI에게 주는 도구 — AiLead.js 도구 + 좁은 판단 둘. 운영에서 바뀌는 설명만 고친다 ----------
function caseProcAiLiveTools_() {
  // [GAS 고도화 ④] 서류 접근은 GAS 도구로만 — 폴더 통째 읽기(docs_read)·원문 직접 읽기(doc_text)는 주지 않는다(쟁점 묶음·사실 목록·서류 정리 결과로)
  const tools = JSON.parse(JSON.stringify(CASEPROC_AI_TOOLS_)).filter(function (t) { return CASEPROC_AI_NO_TOOLS_.indexOf(t.name) === -1; });
  tools.forEach(function (t) {
    if (t.name === 'value_set') {
      t.input_schema.properties.basis.description = 'doc: {kind:"doc", file, page(쪽, 알면), find 또는 quote} — file은 facts_find·doc_facts·issue_bundle이 준 출처 파일 이름';
      t.description = t.description + ' [운영] sure="확실"이고 근거 대조를 통과하면 그 질문의 답으로 실제로 넣는다(출처 칸에 "🤖 AI 판단: why"). sure="불확실"·infer는 넣지 않고 그 질문에 "🤖 AI 의견"으로 붙는다. 시가·특수관계·평가처럼 세액이 크게 갈리는 칸은 넣지 않는다(세무사님 답으로만 — ask_user). itemId는 calc_fill 질문목록의 id.';
    }
    if (t.name === 'ask_user') {
      t.description = '세무사님께 여쭐 질문 고르기 — 서류로 알 수 없는 것만. urgent=true는 계산을 막는 질문(처리 끝에 맨 위·바로), 나머지는 끝에 모아 보여 준다. 이미 있는 질문(itemIds)에 note(무엇을 받으면 정해지는지·네 의견)를 붙인다.';
      t.input_schema.properties.urgent = { type: 'boolean' };
    }
    if (t.name === 'save_draft') t.description = '저장·초안 — 운영에서는 처리 끝에 화면이 저장·종합검토서 초안·현황표를 만든다. 부르지 않아도 된다(부르면 현황표만 본다).';
  });
  tools.push({ name: 'issue_bundle', description: '쟁점 묶음 보기 — 그 질문(itemId)에 GAS·교차검증이 모아 둔 재료: 사건 요약·물린 사실·출처 원문 앞뒤·후보·못 푼 이유·계산기 칸의 쓰임, 저비용 AI의 답과 모자란 정보. 원문이 필요하면 이것으로 본다(원문 파일을 직접 읽는 도구는 없다).',
    input_schema: { type: 'object', properties: { itemId: { type: 'string' } }, required: ['itemId'] } });
  tools.push({ name: 'quick_judge', description: '좁은 판단 맡기기(저가 AI Haiku 5.5) — 짧고 근거가 서류에 있는 판단: 후보 중 하나 고르기, 표기가 같은 사람·주소인지, 판독 고르기, 처음 보는 서류 종류. 재료(material)에 원문 줄·후보를 넣는다(개인정보는 이미 가려짐). 답·확실 여부·근거를 돌려준다. 불확실이면 네가 판단하거나 여쭙는다.',
    input_schema: { type: 'object', properties: { question: { type: 'string' }, material: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } }, required: ['question', 'material'] } });
  tools.push({ name: 'ask_higher', description: '어려운 판단 올리기(상위 AI Opus 5.5) — 특례가 얽힌 사건분류(1세대1주택·일시적 2주택·상속주택·정비사업 감면), 시가·유사사례 다툼, 법령 해석이 갈리는 것. 재료를 정리해 넘긴다. 최고급(Fable 5.1)이 필요하면 부르지 말고 보고에 "최고급 검토 필요"로 적는다(세무사님이 쓰기 전에 정하심).',
    input_schema: { type: 'object', properties: { question: { type: 'string' }, material: { type: 'string' } }, required: ['question', 'material'] } });
  tools[tools.length - 1].cache_control = { type: 'ephemeral' };
  return tools;
}
function caseProcAiLiveSystem_(cap) {
  return caseProcAiSystem_() + '\n\n' + [
    '[운영 — 지금 판]',
    '- 너는 입구(GAS)가 상수 한 바퀴를 끝낸 뒤 넘긴 AI 자리만 맡는다. 서류 읽기·나누기·사진 보정·화면 계산·서식 PDF·저장·검토서는 화면이 끝에 지금 순서대로 한다.',
    '- 이번 사건 비용 상한 ' + Number(cap).toLocaleString('ko-KR') + '원(너와 quick_judge·ask_higher 합계). 상한에 가까우면 하던 판단까지만 하고 보고한다.',
    '- 좁은 판단은 quick_judge(저가)로, 특례·시가·법령 해석은 ask_higher(상위)로. 최고급은 쓰지 않는다(필요하면 보고에 적음).',
    '- 서류는 GAS 도구로만 본다: issue_bundle(쟁점 묶음)·doc_facts(서류 정리 결과)·facts_find(사실 목록)·재료 도구. docs_read·doc_text(원문 직접 읽기)는 없다 — 위 지침의 doc_text 자리는 issue_bundle로.',
    '- 도구로 안 되는 일을 네가 직접 하게 되면(원문을 뒤지고 싶음·여러 값을 머릿속으로 더하거나 나눔·날짜를 세어 봄 등) 그 일을 하지 말고 report_tool_gap으로 "이런 도구가 있으면"을 남긴 뒤 질문으로 돌린다. 그것이 GAS가 자라는 재료다.',
    '- 되돌리기 어려운 일(PDF 묶기·폴더 이름·문자·사건 정보 수정)은 도구가 없다. 필요하면 보고에 "▶실행 카드로 여쭐 것"으로 적는다.',
    '- 보고는 세무사님이 읽는다 — 쉬운 말로, 표·기호 없이 짧게. 세액은 도구 값 그대로.'
  ].join('\n');
}

// ---------- 차례 사이 기억(CacheService — 6시간) ----------
function caseProcAiCtxKey_(caseId) { return 'aiLead:' + caseId; }
function caseProcAiCtxLoad_(caseId) {
  try { const s = CacheService.getScriptCache().get(caseProcAiCtxKey_(caseId)); if (s) return JSON.parse(s); } catch (e) {}
  return { lastItems: null, lookups: [], decisions: [], asks: [], opinions: [], gaps: [], subWon: 0 };
}
function caseProcAiCtxSave_(caseId, ctx) {
  try {
    const keep = Object.assign({}, ctx, { lookups: (ctx.lookups || []).slice(-12), lastItems: (ctx.lastItems || []).slice(0, 60) });
    let s = JSON.stringify(keep);
    if (s.length > 95000) { keep.lastItems = (keep.lastItems || []).slice(0, 25); keep.lookups = keep.lookups.slice(-4); s = JSON.stringify(keep); }
    CacheService.getScriptCache().put(caseProcAiCtxKey_(caseId), s.slice(0, 99000), 21600);
  } catch (e) {}
}

// ---------- 모델 한 번 부르기 ----------
function caseProcAiCall_(model, system, tools, messages, maxTokens, effort) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) return { error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다.' };
  const cfg = MODEL_CONFIG[model];
  if (!cfg) return { error: '모델 표에 없는 모델: ' + model };
  const payload = { model: model, max_tokens: maxTokens || 3000, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: messages };
  if (tools && tools.length) payload.tools = tools;
  if (cfg.thinkingMode === 'adaptive') { payload.thinking = { type: 'adaptive' }; payload.output_config = { effort: effort || 'medium' }; }
  let res, json;
  for (let i = 0; i < 3; i++) {
    res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(payload) });
    const code = res.getResponseCode();
    try { json = JSON.parse(res.getContentText()); } catch (e) { json = { error: { message: '응답을 읽지 못함(' + code + ')' } }; }
    if (code === 429 || code === 529 || code >= 500) { Utilities.sleep(1500 * (i + 1)); continue; }
    break;
  }
  if (!json || json.error) return { error: (json && json.error && json.error.message) || 'AI 응답 없음' };
  let won = 0;
  try { const u = buildClaudeUsageInfo_(json, cfg, model, null); won = Math.round(u.costUsd * CASEPROC_AI_KRW_ * 10) / 10; ai_logPaid_({ entry: { kind: 'caseproc-ai', model: model, usd: u.costUsd, q: '사건처리 AI 지휘' } }); } catch (e) {}
  return { json: json, won: won };
}
// 마지막 메시지 끝에 캐시 경계(지난 차례까지 다시 읽기를 싸게)
function caseProcAiCacheMark_(messages) {
  const m = JSON.parse(JSON.stringify(messages || []));
  for (let i = m.length - 1; i >= 0; i--) {
    const c = m[i].content;
    if (Array.isArray(c) && c.length) { const b = c[c.length - 1]; if (b && b.type !== 'thinking' && b.type !== 'redacted_thinking') { b.cache_control = { type: 'ephemeral' }; break; } }
    else if (typeof c === 'string') { m[i].content = [{ type: 'text', text: c, cache_control: { type: 'ephemeral' } }]; break; }
  }
  return m;
}
function caseProcAiText_(json) { return (json.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim(); }

// 좁은 판단·상위 판단 — 도구 없이 한 번, JSON 한 줄 답
function caseProcAiSubJudge_(model, input, effort) {
  const sys = '너는 세무사 사무실의 판단 보조다. 아래 재료(서류 원문 줄·후보)만 보고 물음에 답한다. 재료에 없는 것은 지어내지 않는다. ' +
    '답은 JSON 한 줄로만: {"답":"...","확실":"확실|불확실","근거":"재료의 어느 줄인지 한두 줄"}';
  const q = '[물음]\n' + caseProcAiMask_(String(input.question || '')).slice(0, 600) + (input.options && input.options.length ? '\n[후보]\n' + input.options.slice(0, 10).map(function (o, i) { return (i + 1) + '. ' + caseProcAiMask_(String(o)).slice(0, 160); }).join('\n') : '') + '\n[재료]\n' + caseProcAiMask_(String(input.material || '')).slice(0, 6000);
  const r = caseProcAiCall_(model, sys, null, [{ role: 'user', content: q }], model === CASEPROC_AI_LIGHT_MODEL_ ? 800 : 2500, effort);
  if (r.error) return { text: JSON.stringify({ 오류: r.error }), won: 0 };
  const t = caseProcAiText_(r.json);
  let o = null; try { o = JSON.parse((/\{[\s\S]*\}/.exec(t) || ['{}'])[0]); } catch (e) { o = null; }
  return { text: JSON.stringify(Object.assign({ 맡은AI: model }, o || { 답: caseProcAiCut_(t, 400), 확실: '불확실' })), won: r.won };
}

// ---------- 도구 실행(운영) — AiLead.js caseProcAiExec_를 감싸고, 값 넣기·질문·좁은 판단만 여기서 ----------
function caseProcAiLiveExec_(caseId, name, input, ctx) {
  input = Object.assign({}, input || {}, { caseId: caseId }); // AI가 다른 사건 id를 넣어도 이 사건으로
  if (name === 'quick_judge' || name === 'ask_higher') {
    const r = caseProcAiSubJudge_(name === 'quick_judge' ? CASEPROC_AI_LIGHT_MODEL_ : CASEPROC_AI_HIGH_MODEL_, input, name === 'quick_judge' ? 'low' : 'medium');
    ctx.subWon = (ctx.subWon || 0) + r.won;
    return { text: r.text, won: r.won };
  }
  if (name === 'ask_user') {
    const ids = (input.itemIds || []).map(String).slice(0, 12);
    ctx.asks.push({ ids: ids, note: caseProcAiMask_(caseProcAiCut_(input.note || '', 300)), urgent: !!input.urgent });
    return { text: JSON.stringify({ ok: true, 올린질문: ids.length, 언제: input.urgent ? '처리 끝에 맨 위(계산을 막음)' : '처리 끝에 모아서' }) };
  }
  if (name === 'report_tool_gap') {
    ctx.gaps.push({ want: caseProcAiMask_(caseProcAiCut_(input.want, 200)), kind: input.kind || '', tool: input.tool || '', shape: caseProcAiCut_(input.shape || '', 120), instead: caseProcAiCut_(input.instead || '', 120) });
    return { text: JSON.stringify({ ok: true, 기록: '도구 부족으로 남김' }) };
  }
  if (name === 'save_draft') return { text: JSON.stringify({ ok: true, 안내: '처리 끝에 화면이 저장·검토서 초안·현황표를 만든다' }) };
  if (CASEPROC_AI_NO_TOOLS_.indexOf(name) !== -1) { ctx.gaps.push({ want: name + '를 부르려 함 — ' + caseProcAiCut_(JSON.stringify(input.find || input.file || input.phase || ''), 80), kind: '없음', tool: name, auto: true }); return { text: JSON.stringify({ 오류: '이 도구는 없습니다 — issue_bundle·doc_facts·facts_find로 보거나, 안 되면 report_tool_gap 후 질문으로' }) }; }
  if (name === 'issue_bundle') {
    const it = (ctx.lastItems || []).filter(function (x) { return x.id === input.itemId; })[0];
    if (!it) return { text: JSON.stringify({ 오류: '그 질문이 마지막 칸 채우기에 없음 — calc_fill 먼저' }) };
    const aj = (it.ask && it.ask.aiJudge) || null;
    return { text: caseProcAiMask_(JSON.stringify({ ok: true, 질문: it.text, 자세히: it.detail || '', 후보: ((it.ask && it.ask.cands) || []).slice(0, 8), 쟁점묶음: aj && aj.q ? String(aj.q).slice(0, 2500) : '(묶음 없음 — doc_facts·facts_find로 재료를 찾고, 없으면 report_tool_gap)', 저비용답: aj ? { 값: aj.value, 확실: aj.sure, 근거: aj.why, 모자란정보: aj.need || [] } : null })).slice(0, 4000) };
  }
  if (name === 'value_set') return { text: JSON.stringify(caseProcAiValueSetLive_(caseId, input, ctx)) };
  // 그 밖 도구 — 시제품 실행기 그대로(조회 결과·마지막 질문은 차례 사이에 기억)
  if (name === 'calc_fill' && ctx.lastItems) CASEPROC_AI_LAST_ITEMS_[caseId] = ctx.lastItems;
  const before = (CP_SECURED_LOG_ || []).length;
  const x = caseProcAiExec_(caseId, name, input);
  if (name === 'calc_fill' && x.raw && x.raw.items) ctx.lastItems = caseProcAiSlimItems_(x.raw.items);
  try { (CP_SECURED_LOG_ || []).slice(before).forEach(function (l) { ctx.lookups.push({ key: l.key, name: l.name, rows: (l.rows || []).slice(0, 30) }); }); } catch (e) {}
  return { text: x.text };
}
function caseProcAiArr_(x) { return Array.isArray(x) ? x : []; }
// AI가 값을 넣어도 되는 칸 — 값 하나로 끝나는 칸만(세액계산기 칸·기준일·처리개요·상속 금액·분할 귀속 번호).
//  사건 정보 수정(case:)·증빙 표시·폴더 만들기는 되돌리기 어려운 일, 상속 채무 목록·증여 내용은 여러 값이 묶인 칸이라 AI 의견으로만
var CASEPROC_AI_SCALAR_TARGET_RE_ = /^(base|calc:.+|ov:.+|ih:.+|ihdiv:div:.+)$/;
// 질문을 차례 사이에 기억할 만큼만(값 넣을 칸·후보) 줄인다
function caseProcAiSlimItems_(items) {
  return (items || []).slice(0, 60).map(function (it) { const a = it.ask; return { id: it.id, kind: it.kind, text: caseProcAiCut_(it.text, 160), detail: caseProcAiCut_(it.detail || '', 400), ask: a ? { target: a.target, label: a.label, mode: a.mode, input: a.input, route: a.route, aiJudge: a.aiJudge ? { by: a.aiJudge.by, value: a.aiJudge.value, sure: a.aiJudge.sure, why: caseProcAiCut_(a.aiJudge.why || '', 200), need: a.aiJudge.need || [], q: String(a.aiJudge.q || '').slice(0, 1500) } : null, cands: (caseProcAiArr_(a.cands).length ? caseProcAiArr_(a.cands) : caseProcAiArr_(a.options)).slice(0, 12).map(function (q) { return { v: q.v != null ? q.v : (q.value != null ? q.value : q.amount), label: q.label, src: caseProcAiCut_(q.src || '', 80) }; }) } : null }; });
}
// 값 넣기 — 근거 대조 → 확실하면 그 질문의 답으로 실제 반영(caseProc0_ apply — 사이드바 답 기록에는 안 남김), 아니면 🤖 AI 의견으로
function caseProcAiValueSetLive_(caseId, input, ctx) {
  const c = akReadCase_(caseId);
  const items = ctx.lastItems || [];
  const it = items.filter(function (x) { return x.id === input.itemId; })[0];
  if (!it) return { ok: false, 반영: '거절', 이유: '그 질문이 마지막 칸 채우기에 없음(' + input.itemId + ') — calc_fill을 먼저 부르고 질문목록의 id로' };
  CASEPROC_AI_LAST_ITEMS_[caseId] = items;
  CP_SECURED_LOG_ = (ctx.lookups || []).slice();
  const why = caseProcAiMask_(caseProcAiCut_(input.why || '', 120));
  if (CASEPROC_AI_RELATION_RE_.test(String(input.itemId || ''))) { ctx.decisions.push({ at: new Date().toISOString(), itemId: input.itemId, 칸: caseProcAiCut_(it.text, 80), value: '', basis: '', why: '', sure: '', 결과: '특수관계 확인 절차 — 값·의견 없이 근거만 세무사님께' }); return { ok: false, 반영: '넣지 않음', 이유: '특수관계·시가 질문은 세무사님 확인 절차만 — 값도 의견도 붙이지 않는다. 필요하면 ask_user로 그 질문을 고르기만(정황 근거는 질문 글에 이미 있음)' }; }
  const userOnly = CASEPROC_AI_USER_ONLY_RE_.test(String(input.itemId || '') + ' ' + String(it.text || ''));
  const chk = caseProcAiCheckBasis_(c, input.value, input.basis, input.itemId, caseId);
  const bs = input.basis || {};
  if (bs.kind === 'infer') ctx.gaps.push({ want: '사실 목록·후보로 안 나오는 값을 추론함 — ' + caseProcAiCut_(it.text, 60), kind: '값을 안 돌려줌', tool: 'facts_find', auto: true });
  ctx.cxItems = ctx.cxItems || [];
  ctx.cxItems.push({ iid: input.itemId, topic: caseProcAiTopic_([input.itemId, it.text, (it.ask || {}).label, (it.ask || {}).target].join(' ')).topic, shape: '총괄|' + (bs.kind || '') + '|' + String((it.ask || {}).target || '').split(':')[0], target: (it.ask || {}).target || '', label: (it.ask || {}).label || caseProcAiCut_(it.text, 60),
    facts: '근거 ' + (bs.kind || '') + (bs.file ? ' · ' + bs.file : '') + (bs.page ? ' · ' + bs.page + '쪽' : '') + (bs.find ? ' · "' + bs.find + '"' : '') + (bs.quote ? ' · "' + String(bs.quote).slice(0, 120) + '"' : '') + (bs.id ? ' · 조회 ' + bs.id : ''),
    cands: ((it.ask && it.ask.cands) || []).slice(0, 6).map(function (q) { return { v: q.v, src: String(q.src || '').slice(0, 100) }; }), answer: String(input.value), why: input.why || '', sure: input.sure || '', need: [] });
  const rec = { at: new Date().toISOString(), itemId: input.itemId, 칸: caseProcAiCut_(it.text, 80), value: caseProcAiMask_(String(input.value).slice(0, 80)), basis: (input.basis || {}).kind || '', why: why, sure: input.sure || '' };
  if (!chk.ok) { rec.결과 = '거절 — ' + chk.why; ctx.decisions.push(rec); return { ok: false, 반영: '거절', 이유: chk.why }; }
  if (userOnly || input.sure !== '확실' || chk.provisional || input.dryRun) {
    rec.결과 = userOnly ? '세무사님 답으로만 — AI 의견으로 붙임' : '불확실·추론 — AI 의견으로 붙임';
    ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: input.sure || '불확실' });
    ctx.decisions.push(rec);
    return { ok: true, 반영: 'AI 의견(넣지 않음)', 이유: rec.결과 };
  }
  const a = it.ask || {};
  if (a.target && (!CASEPROC_AI_SCALAR_TARGET_RE_.test(a.target) || (/^ih(div)?:/.test(a.target) && !/^\d+$/.test(String(input.value).replace(/[,\s원]/g, ''))))) { rec.결과 = '값 하나로 넣을 수 없는 칸(' + a.target.split(':')[0] + ') — AI 의견으로'; ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: input.sure || '' }); ctx.decisions.push(rec); return { ok: true, 반영: 'AI 의견(이 칸은 AI가 직접 못 넣음)', 이유: rec.결과 }; }
  if (!a.target) { rec.결과 = '넣을 칸 정보가 없음 — AI 의견으로'; ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: '확실' }); ctx.decisions.push(rec); return { ok: true, 반영: 'AI 의견(넣을 칸 없음)', 이유: rec.결과 }; }
  let r;
  try { r = caseProc0_(Object.assign({ caseId: caseId, step: 'apply', target: a.target, value: input.value, src: ('🤖 AI 판단: ' + why).slice(0, 80), label: a.label || '', ans: { qid: it.id, how: 'AI 판단' } })); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
  rec.결과 = r && r.ok !== false ? '반영 — ' + caseProcAiCut_(r.message || '', 80) : '반영 실패 — ' + caseProcAiCut_((r && r.error) || '', 80);
  if (r && r.ok !== false) caseProcAiMarkApplied_(caseId, { iid: input.itemId, target: a.target, label: a.label || caseProcAiCut_(it.text, 60), v: String(input.value), by: 'ai', model: CASEPROC_AI_DIRECTOR_MODEL_, why: why, sure: '확실', tier: '총괄', cands: ((it.ask && it.ask.cands) || []).slice(0, 6) });
  ctx.decisions.push(rec);
  return { ok: !!(r && r.ok !== false), 반영: r && r.ok !== false ? '넣음(🤖 AI 판단)' : '실패', 이유: (r && (r.message || r.error)) || '', 근거대조: chk.why };
}

// ---------- step 'turn' — 지휘 AI 한 차례 ----------
//  body: { caseId, messages: [이전 차례들 — 화면이 그대로 들고 옴], entry: 첫 차례 입구 요약, spent: 지금까지 쓴 원, round, items: 첫 차례에만 화면의 마지막 질문 }
function caseProcAiTurn_(body) {
  const t0 = Date.now();
  const caseId = String(body.caseId || '').trim();
  const c = akReadCase_(caseId);
  if (!c) return { error: '사건을 찾지 못했습니다.' };
  const cap = caseProcAiCap_(c), spent = Number(body.spent) || 0, round = Number(body.round) || 0;
  if (spent >= cap) return { ok: true, done: true, stop: 'cap', report: '비용 상한(' + cap.toLocaleString('ko-KR') + '원)에 닿아 여기서 멈춥니다. 남은 것은 지금 GAS 순서로 이어갑니다.', won: 0 };
  if (round >= CASEPROC_AI_MAX_ROUNDS_) return { ok: true, done: true, stop: 'rounds', report: '바퀴 상한(' + CASEPROC_AI_MAX_ROUNDS_ + ')에 닿아 여기서 멈춥니다.', won: 0 };
  let ctx = round === 0 ? { lastItems: null, lookups: [], decisions: [], asks: [], opinions: [], gaps: [], subWon: 0 } : caseProcAiCtxLoad_(caseId);
  if (round === 0 && Array.isArray(body.items)) ctx.lastItems = caseProcAiSlimItems_(body.items);
  let messages = Array.isArray(body.messages) ? body.messages.slice() : [];
  if (!messages.length) messages = [{ role: 'user', content: caseProcAiMask_(String(body.entry || '사건 ' + caseId + ' — 입구 요약 없음. calc_fill부터.')) }];
  const subBefore = ctx.subWon || 0;
  const r = caseProcAiCall_(CASEPROC_AI_DIRECTOR_MODEL_, caseProcAiLiveSystem_(cap), caseProcAiLiveTools_(), caseProcAiCacheMark_(messages), 3000, 'medium');
  if (r.error) return { ok: false, error: r.error };
  const json = r.json, content = json.content || [];
  const uses = content.filter(function (b) { return b.type === 'tool_use'; });
  const results = [], calls = [];
  uses.forEach(function (u) {
    let out;
    if (Date.now() - t0 > CASEPROC_AI_TURN_BUDGET_MS_) out = { text: JSON.stringify({ 오류: '이번 차례 시간이 모자라 실행하지 못함 — 다음 차례에 다시 부르면 됨', 다시해도됨: true }) };
    else { try { out = caseProcAiLiveExec_(caseId, u.name, u.input, ctx); } catch (e) { out = { text: JSON.stringify({ 오류: '도구 실행 오류: ' + (e && e.message || e) }) }; } }
    results.push({ type: 'tool_result', tool_use_id: u.id, content: String(out.text || '').slice(0, 6000) });
    calls.push(u.name);
  });
  caseProcAiCtxSave_(caseId, ctx);
  const won = Math.round((r.won + (ctx.subWon || 0) - subBefore) * 10) / 10;
  const done = json.stop_reason !== 'tool_use' || !uses.length;
  return { ok: true, done: done, stop: json.stop_reason, assistant: content, toolResults: results, calls: calls, won: won, report: done ? caseProcAiMask_(caseProcAiText_(json)) : '', note: caseProcAiCut_(caseProcAiText_(json), 200),
    decisions: ctx.decisions, asks: ctx.asks, opinions: ctx.opinions, gaps: ctx.gaps, model: CASEPROC_AI_DIRECTOR_MODEL_, _ms: Date.now() - t0 };
}

// ---------- step 'finish' — 사건 기록(작업일지 한 줄 + 사건처리 저장) + 판단 기록(나중에 GAS로 옮길 재료, 개인정보 가림) ----------
function caseProcAiFinish_(body) {
  const caseId = String(body.caseId || '').trim();
  const c = akReadCase_(caseId);
  if (!c) return { error: '사건을 찾지 못했습니다.' };
  const ctx = caseProcAiCtxLoad_(caseId);
  const run = { at: new Date().toISOString(), 세목: c.세목, 업무유형: c.업무유형 || '', mode: String(body.mode || 'ai'), won: Number(body.won) || 0, rounds: Number(body.rounds) || 0, stop: String(body.stop || ''),
    spots: (body.spots || []).slice(0, 30), tiers: body.tiers || null, tools: caseProcAiLiveTools_().map(function (t) { return t.name; }), decisions: (ctx.decisions || []).slice(0, 40), asks: (ctx.asks || []).slice(0, 20), opinions: (ctx.opinions || []).slice(0, 20), gaps: (ctx.gaps || []).slice(0, 20), error: String(body.error || '').slice(0, 200) };
  try { caseProcPatch_(caseId, function (sv) { sv.aiLead = (Array.isArray(sv.aiLead) ? sv.aiLead : []).concat([run]).slice(-10); }); } catch (e) {}
  // [GAS 고도화 ①] 총괄 AI 판단을 2번 기록 모양(kind 'cx')으로 — 비용은 이번 지휘 비용을 판단 수로 나눠 붙임. 세무사님 수정은 다음 처리 때 2번 0) 단계가 붙인다
  if (run.mode === 'ai' && (ctx.cxItems || []).length) caseProcAiLogCx_(c, CASEPROC_AI_DIRECTOR_MODEL_, run.won / CASEPROC_AI_KRW_, ctx.cxItems, 1);
  // [GAS 고도화 ③] 빠진 도구 — AI가 남긴 것 + 자동으로 잡은 것(없는 도구를 부르려 함·추론 값)
  caseProcAiLogGaps_(c, run.gaps);
  try { CacheService.getScriptCache().remove(caseProcAiCtxKey_(caseId)); } catch (e) {}
  const applied = run.decisions.filter(function (d) { return /^반영 —/.test(d.결과 || ''); }).length;
  try {
    const line = run.mode === 'gas0' ? '[사건처리] AI 자리 없음 — AI 없이 끝(0원)' : '[사건처리 🤖 AI 지휘] 판단 ' + run.decisions.length + '개(넣음 ' + applied + ' · AI 의견 ' + run.opinions.length + ') · 질문 고름 ' + run.asks.length + ' · 비용 ' + run.won + '원 · ' + run.rounds + '바퀴' + (run.stop && run.stop !== 'end_turn' ? ' · 멈춤: ' + run.stop : '');
    work_updateCase({ id: c.id, 작업일지: (Array.isArray(c.작업일지) ? c.작업일지 : []).concat([{ id: 'log_' + Date.now(), date: caseProcToday_(), text: line, dueDate: '' }]) });
  } catch (e) {}
  // 판단 기록 — 사건 이름 없이(세목·업무유형·칸·근거 종류·결과만) 모아 둔다. 되풀이되는 판단은 처음 보는 사건 2건 이상 확인 뒤 GAS 규칙 후보로
  try {
    withLock_(5000, function () {
      let folder = null; try { const pf = ai_paidLogFile_(), ps = pf.getParents(); folder = ps.hasNext() ? ps.next() : null; } catch (e) {}
      if (!folder) return;
      const it = folder.getFilesByName(CASEPROC_AI_LOG_NAME_), f = it.hasNext() ? it.next() : folder.createFile(CASEPROC_AI_LOG_NAME_, '[]', 'application/json');
      let arr = []; try { arr = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '[]'); } catch (e) { arr = []; }
      arr.push(JSON.parse(caseProcAiMask_(JSON.stringify({ at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 세목: run.세목, 업무유형: run.업무유형, mode: run.mode, won: run.won, rounds: run.rounds, stop: run.stop, tiers: run.tiers, tools: run.tools,
        spots: run.spots.map(function (s) { return (s.자리 || '') + '|' + (s.이유 || ''); }), decisions: run.decisions.map(function (d) { return { 칸: d.itemId, basis: d.basis, sure: d.sure, 결과: caseProcAiCut_(d.결과 || '', 40) }; }), gaps: run.gaps }))));
      f.setContent(JSON.stringify(arr.slice(-3000)));
    });
  } catch (e) {}
  return { ok: true, applied: applied, decisions: run.decisions.length };
}

// ---------- 입구 ----------
function caseProcAi_(body) {
  if (!body || !body.caseId) return { error: '사건이 필요합니다.' };
  try {
    if (body.step === 'spots') return caseProcAiSpots_(body);
    if (body.step === 'turn') return caseProcAiTurn_(body);
    if (body.step === 'finish') return caseProcAiFinish_(body);
    return { error: '모르는 단계: ' + body.step };
  } catch (e) { return { ok: false, error: 'AI 지휘 처리 오류: ' + (e && e.message || e) }; }
}
