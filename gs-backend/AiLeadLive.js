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
// [2026.10.22 넥스가 주인 — 위 1)~4) 순서를 바꿈] 세무사님 원문: "가급적 ai없이 돌아가는 gas를 원하는 거지. 최상위 ai가 도구로 사용하는 것이 gas인 것이다"
//  / "이런 방향이 맞다고 이미 말했는데, 아직까지 이러고 있는 것이 말이 되나?" (공통원칙 1절 정리 10-22)
//  이제 "이 사건 처리하자"는 넥스가 먼저 받는다(step 'turn' 0바퀴). 넥스가 gas_run(GAS 한 바퀴 — 사건파악·서류 읽기·나누기·보정·칸 채우기·교차검증,
//  AI 없이 0원, 다시 읽기 없음)을 부르면 화면이 그 도구를 실행해 결과(GAS가 못 푼 자리)를 넥스에게 돌려준다. 넥스가 판단·질문하고 끝내면
//  화면이 계산·서식·저장·검토서를 한다. "판단할 자리 없으면 AI 안 부름" 관문(3-1)과 GAS 안의 저비용 AI 자동 판단은 쓰지 않는다(GAS가 못 푼 것은 넥스에게).
// =========================================================
var CASEPROC_AI_CLIENT_TOOLS_ = ['gas_run', 'gas_finish']; // 화면이 실행하는 GAS 도구 — 서버는 실행하지 않고 넥스의 부름을 화면에 넘긴다
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
// [2026.10.20 밤샘] 시험 모드(body.dry) — 실제 AI는 부르되 사건에 쓰지 않음(값 넣기·첨부 저장·작업일지·판단 기록 없음, 비용 기록은 [시험])
var CASEPROC_AI_DRY_ = false;
var CASEPROC_AI_NO_TOOLS_ = ['docs_read', 'doc_text']; // [GAS 고도화 ④] 지휘 AI에게 주지 않는 도구 — docs_read(폴더 통째 GAS 판독 돌리기 = gas_run이 함)·doc_text(GAS 판독 원문 몇 줄 = file_read가 더 넓게 함). 넥스 읽기를 막는 것이 아니다(10-28 세무사님 "gas속에 ai를 가두지 마라") — 넥스는 case_files/file_read/doc_view로 어떤 파일이든 읽는다

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

// [2026.10.28 속도 A②] GAS 한 바퀴 결과 묶음 — 칸(정한 값)·남은 질문·서류 정리 결과(파일별 종류·값)·사람/계약/자산 명단을 한 번에 실어 doc_facts·doc_view·people_roster·contract_list·owner_assets 왕복을 없앤다(상한 14,000자)
function caseProcAiGasBundle_(c, items) {
  const out = {};
  try { const v = caseProcNexView_(c, {}); out.정한값 = (v.정한값 || []).slice(0, 50); out.단계 = v.단계; } catch (e) { out.정한값오류 = String(e && e.message || e).slice(0, 60); }
  // [2026.10.28 속도 ⓒ] calc_fill(칸 채우기)이 돌려주는 것과 같은 질문 표 — 넥스가 doc_view·calc_fill·case_view를 또 부르지 않게(가상양도28: 묶음이 있는데도 doc_view를 또 부름)
  try { out.질문표 = caseProcAiSlimItems_(Array.isArray(items) ? items : []).slice(0, 40); } catch (e) { out.질문표 = (Array.isArray(items) ? items : []).slice(0, 40).map(function (it) { return { id: it.id, 글: caseProcAiCut_(it.text || '', 90), 칸: it.target || '' }; }); }
  try { out.서류정리 = caseProcParseAll_(c).slice(0, 40).map(function (x) { return { 파일: x.f.name, 종류: x.p.label || x.p.type, 값: typeof caseProcAiTrimObj_ === 'function' ? caseProcAiTrimObj_(x.p.result || {}, 0) : x.p.result }; }); } catch (e) { out.서류정리오류 = String(e && e.message || e).slice(0, 60); }
  ['people_roster', 'contract_list', 'owner_assets'].forEach(function (nm) { try { const r = caseProcAiFactTool_(c.id, nm, {}); out[{ people_roster: '사람명단', contract_list: '계약목록', owner_assets: '자산목록' }[nm]] = r && r.error ? { 오류: r.error } : r; } catch (e) { out[nm] = { 오류: String(e && e.message || e).slice(0, 60) }; } });
  let s = JSON.stringify(out);
  if (s.length > 14000) { delete out.서류정리; out.서류정리 = '(길어서 뺌 — 필요한 파일만 doc_facts(file))'; s = JSON.stringify(out); }
  if (s.length > 14000) { ['사람명단', '계약목록', '자산목록'].forEach(function (k) { delete out[k]; }); out.명단 = '(길어서 뺌 — 필요하면 people_roster 등)'; s = JSON.stringify(out); }
  return '\n\n[GAS 한 바퀴 결과 묶음 — 아래 정한값·질문표(칸·후보·입력 종류)·서류정리·명단은 이미 실린 것이니 calc_fill·case_view·doc_view·doc_facts·people_roster·contract_list·owner_assets로 다시 보지 마라. 질문이 여럿이면 ask_user 한 번(questions 배열)에 모아 올려라]\n' + s.slice(0, 14000);
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
  // [밤샘 1바퀴] 입수 구멍 — 종류는 이름·첫머리 글로 아는데 서류 규칙이 값을 못 뽑은 서류(종류별 수) · 참고자료(입력 아님)
  const inGap = {}; gas.forEach(function (s) { if (s.이유 === '이름으로 종류 앎') inGap[s.종류] = (inGap[s.종류] || 0) + 1; else if (s.이유 === '참고자료') inGap['(참고·발생문서 — 입력 아님) ' + s.종류] = (inGap['(참고·발생문서 — 입력 아님) ' + s.종류] || 0) + 1; });
  const ask = spots.filter(function (s) { return s.이유 === '빈 칸'; });
  // [세 겹 ①] 길 나누기 — GAS·2번 교차검증이 이미 정한 것은 빼고, 남은 판단 자리를 주제 표로 저비용/총괄에
  const tiers = { GAS: 0, 저비용: 0, 올림: 0, 총괄: 0, 질문: ask.length };
  const light = [], lead = [];
  spots.filter(function (s) { return !CASEPROC_AI_GAS_SPOTS_[s.이유] && s.이유 !== '빈 칸'; }).forEach(function (s) {
    const it = byId[s.자리], a = (it && it.ask) || {}, aj = a.aiJudge;
    if (/^cxai:/.test(s.자리) || (aj && aj.sure === '확실' && aj.value !== '' && aj.value != null)) { tiers[aj && aj.by === 'gas' ? 'GAS' : '저비용']++; return; } // 교차검증(GAS)·저비용이 이미 정함 — 세무사님 확인만
    // [밤샘 2바퀴] 특수관계·§101 시가 질문은 AI가 값도 의견도 못 붙이는 칸(세무사님 확인 절차) — AI를 거치지 않고 바로 질문으로
    if (CASEPROC_AI_RELATION_RE_.test(String(s.자리))) { tiers.질문++; return; }
    const tp = caseProcAiTopic_([s.자리, s.이유, it && it.text, a.label, a.target].join(' '));
    s.topic = tp.topic;
    if (a.route === 'lead') { s.tier = '총괄'; lead.push(s); return; }                       // 2번 교차검증이 표대로 총괄로 보냄
    if (aj) { s.tier = '올림'; s.light = { answer: aj.value, sure: aj.sure, why: aj.why, need: aj.need || [], model: aj.model }; lead.push(s); return; } // 저비용(2번)이 불확실 → 올림
    if (tp.route === 'light') light.push(s); else { s.tier = '총괄'; lead.push(s); }
  });
  // [세 겹 ②] 저비용 1차 — 확실하고 모자란 정보가 없으면 끝(값 칸이면 후보 안의 값만 넣음), 아니면 총괄로 올림
  const plan = { 저비용후보: light.length, 총괄직행: lead.length, 주제: {} };
  light.concat(lead).forEach(function (s) { plan.주제[s.topic] = (plan.주제[s.topic] || 0) + 1; });
  // [2026.10.22 넥스가 주인] gas_run이 부른 자리 세기(noLight)는 저비용 AI를 부르지 않는다 — GAS가 못 푼 것은 그대로 넥스에게
  const lp = body.noLight ? { done: [], up: light.slice(), usd: 0, calls: 0, sent: 0, off: true } : caseProcAiLightPass_(c, light, items);
  let lightApplied = 0;
  lp.done.forEach(function (rec) { const r = CASEPROC_AI_DRY_ ? { applied: false, why: '시험 — 넣지 않음' } : caseProcAiLightApply_(c, rec, items); rec.applied = r.applied; rec.result = r.why; if (r.applied) lightApplied++; tiers.저비용++; });
  lp.up.forEach(function (s) { s.tier = lp.off ? '총괄' : '올림'; lead.push(s); });
  if (!lp.off && !CASEPROC_AI_DRY_) caseProcAiLogCx_(c, cxModelFor_('light'), lp.usd, lp.done.concat(lp.up.map(function (s) { return s.light ? Object.assign({ 자리: s.자리, topic: s.topic }, s.light) : null; }).filter(Boolean)).map(function (r) {
    const it = byId[r.자리] || {}, a = it.ask || {};
    return { iid: r.자리, topic: r.topic || caseProcAiTopic_(r.자리).topic, shape: '저비용|' + (/^doc:/.test(r.자리) ? '서류' : String(a.target || '').split(':')[0]), target: a.target || '', label: a.label || caseProcAiCut_(it.text || r.자리, 60), facts: r.quote || '', cands: caseProcAiOpts_(a).slice(0, 6).map(function (q) { return { v: q.v != null ? q.v : q.value, src: String(q.src || '').slice(0, 100) }; }), answer: r.answer, why: r.why, sure: r.sure, need: r.need || [] };
  }));
  lead.forEach(function (s) { tiers[s.tier] = (tiers[s.tier] || 0) + 1; });
  const level = lead.reduce(function (m, s) { return Math.max(m, caseProcAiSpotLevel_(s)); }, 0);
  const by = {}; lead.forEach(function (s) { by[s.topic || s.이유] = (by[s.topic || s.이유] || 0) + 1; });
  const entry = [
    '사건 ' + caseId + ' — ' + (CASEPROC_TAX_LABEL_[c.세목] || c.세목 || '') + ' · ' + (c.업무유형 || '') + ' · 기준일 ' + (c.기준일 || '?'),
    body.noLight ? 'GAS 한 바퀴가 끝났다(서류 읽기·칸 채우기·교차검증, AI 없이). 아래는 GAS가 못 풀어 너에게 돌아온 자리다 — 이것만 판단한다.' : '입구(GAS)가 상수 한 바퀴를 돌았고(서류 읽기·칸 채우기·교차검증), 저비용 AI가 좁은 판단을 먼저 봤습니다. 아래 자리만 네가 판단한다.',
    '네 자리 ' + lead.length + '개: ' + lead.map(function (s) { return '[' + s.자리 + ' · ' + (s.topic || '') + ' · ' + s.이유 + ' · ' + s.tier + (s.light ? ' — 저비용 답 "' + caseProcAiCut_(s.light.answer || '', 40) + '"(' + (s.light.sure || '') + ')' + (s.light.need && s.light.need.length ? ' 모자란 정보: ' + s.light.need.join(', ') : '') : '') + '] ' + caseProcAiCut_(s.설명 || '', 80); }).join(' / '),
    '저비용·GAS가 이미 정한 것 ' + (tiers.GAS + tiers.저비용) + '개(네가 다시 보지 않는다).',
    '서류에 없어 세무사님께 바로 묻는 빈 칸 ' + ask.length + '개(네가 찾지 않는다): ' + ask.slice(0, 12).map(function (s) { return s.자리; }).join(', '),
    // [2026.10.22] '이름으로 종류 앎'은 글자를 읽은 서류다(값 뽑는 서류 규칙만 없음 — 계산 쪽 규칙이 이미 읽어 썼을 수 있음). 넥스가 "못 읽었다"고 보고한 일(가상양도2 재결서)
    'GAS 몫 ' + gas.length + '개(네가 판단하지 않는다 — "이름으로 종류 앎"은 글자는 읽었고 종류도 알지만 값 뽑는 서류 규칙이 없는 것이라 "못 읽었다"고 보고하지 않는다, "못 읽은 서류"만 글자가 없는 것): ' + gas.slice(0, 8).map(function (s) { return s.자리 + '(' + s.이유 + ')'; }).join(', '),
    caseProcAiAttachLine_(c),
    caseProcAiFactLine_(c, items),
    '비용 상한 ' + caseProcAiCap_(c).toLocaleString('ko-KR') + '원, 바퀴 상한 ' + CASEPROC_AI_MAX_ROUNDS_ + '. ' + (body.noLight
      ? (lead.length ? '지금 칸과 질문은 이미 네 기억에 있다(issue_bundle·fact_map으로 본다). 위 자리만 판단하라.' : '네 자리가 없다 — 세무사님 말씀에 따로 맡기신 일이 없으면 도구를 더 부르지 말고 한두 줄로 보고하고 끝낸다.')
      : 'calc_fill부터 불러 지금 칸과 질문을 본 뒤 판단하라.')
  ].join('\n');
  return { ok: true, ai: lead.length, ask: ask.length, gas: gas.length, byWhy: by, level: level, cap: caseProcAiCap_(c), need: lead.length > 0, tiers: tiers, plan: plan, inGap: inGap, lightApplied: lightApplied, lightOff: lp.off, lightUsd: lp.usd, lightError: lp.error || '',
    lightDone: lp.done.map(function (r) { return { 자리: r.자리, topic: r.topic, answer: caseProcAiMask_(r.answer), why: caseProcAiMask_(r.why), applied: !!r.applied }; }),
    spots: lead.map(function (s) { return { 자리: s.자리, 이유: s.이유, 주제: s.topic || '', 겹: s.tier, 수준: caseProcAiSpotLevel_(s), 설명: caseProcAiCut_(s.설명 || '', 120) }; }), entry: caseProcAiMask_(entry + caseProcAiGasBundle_(c, items)) };
}

// ---------- 지휘 AI에게 주는 도구 — AiLead.js 도구 + 좁은 판단 둘. 운영에서 바뀌는 설명만 고친다 ----------
function caseProcAiLiveTools_() {
  // [GAS 고도화 ④] 서류 접근은 GAS 도구로만 — 폴더 통째 읽기(docs_read)·원문 직접 읽기(doc_text)는 주지 않는다(쟁점 묶음·사실 목록·서류 정리 결과로)
  const tools = JSON.parse(JSON.stringify(CASEPROC_AI_TOOLS_)).filter(function (t) { return CASEPROC_AI_NO_TOOLS_.indexOf(t.name) === -1; });
  tools.forEach(function (t) {
    if (t.name === 'value_set') {
      t.input_schema.properties.basis.description = 'doc: {kind:"doc", file, page(쪽, 알면), find 또는 quote} — file은 facts_find·doc_facts·issue_bundle이 준 출처 파일 이름. 금액·날짜는 원문에 그 값이 있어야 하고, 예/아니오·보기 같은 판단 값은 서류에 글자로 안 나오므로 그 판단을 받치는 원문 문구를 quote로 준다(여러 서류를 묶은 판단이면 {kind:"infer", facts:[…]})';
      t.description = t.description + ' [운영] sure="확실"이고 근거 대조를 통과하면 그 질문의 답으로 실제로 넣는다(출처 칸에 "🤖 AI 판단: why"). sure="불확실"·infer는 넣지 않고 그 질문에 "🤖 AI 의견"으로 붙는다. 시가·특수관계·평가처럼 세액이 크게 갈리는 칸은 넣지 않는다(세무사님 답으로만 — ask_user). itemId는 calc_fill 질문목록의 id.';
    }
    // [2026.10.27 10-27 A] 질문 목록에 없는 확정 칸도 target으로 고칠 수 있게(세무사님 값은 바꾸지 않고 여쭘)
    if (t.name === 'value_set') { t.input_schema.properties.target = { type: 'string', description: '(선택) 질문 목록(itemId)에 없는, 이미 확정된 칸을 고칠 때 그 칸 이름 — calc:a0.assetType·calc:c0.totalPrice·expenses·trTaxFee·ov:사건분류·base. itemId 대신 쓴다. 세무사님이 정하신 값이면 바뀌지 않고 그 사실이 돌아온다(그때는 ask_user로 여쭌다).' }; t.input_schema.required = ['caseId', 'value', 'basis']; t.description += ' itemId가 질문 목록에 없는 확정 칸은 target으로(세무사님 값은 안 바뀜 — 결과의 needConfirm을 보고 ask_user).'; }
    if (t.name === 'ask_user') {
      t.description = '세무사님께 여쭐 질문 고르기 — 서류로 알 수 없는 것만. urgent=true는 계산을 막는 질문(처리 끝에 맨 위·바로), 나머지는 끝에 모아 보여 준다. 이미 있는 질문(itemIds)에 note(무엇을 받으면 정해지는지·네 의견)를 붙인다.';
      t.input_schema.properties.urgent = { type: 'boolean' };
      t.input_schema.properties.questions = { type: 'array', description: '[2026.10.28] 질문 여럿을 한 번에 — 각 항목은 이 도구의 입력과 같은 모양({itemIds, note, target, label, input, cands, urgent})', items: { type: 'object' } };
      t.description += ' 질문이 여럿이면 questions 배열로 한 번에 올린다(차례를 아낌).';
    }
    if (t.name === 'save_draft') t.description = '저장·초안 — 운영에서는 처리 끝에 화면이 저장·종합검토서 초안·현황표를 만든다. 부르지 않아도 된다(부르면 현황표만 본다).';
  });
  tools.push({ name: 'issue_bundle', description: '쟁점 묶음 보기 — 그 질문(itemId)에 GAS·교차검증이 모아 둔 재료: 사건 요약·물린 사실·출처 원문 앞뒤·후보·못 푼 이유·계산기 칸의 쓰임, 저비용 AI의 답과 모자란 정보. 원문이 필요하면 이것으로 본다(원문 파일을 직접 읽는 도구는 없다).',
    input_schema: { type: 'object', properties: { itemId: { type: 'string' } }, required: ['itemId'] } });
  tools.push({ name: 'fact_map', description: '사실 지도(토큰 0) — 서류 조각을 사람·자산·시간·돈 네 축으로 맞물려 둘 이상 서류가 받치는 사실·한 서류뿐인 사실·어긋나는 사실, 그리고 빈칸마다 찾을 서류(법정 서류 기준)와 이 사건에 있는 그 종류 파일. 판단 전에 먼저 부르고, 빈칸을 메운 뒤 다시 부른다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } } } });
  tools.push({ name: 'doc_find', description: '다시 뒤지기(토큰 0, 저장된 판독만) — fact_map이 가리킨 서류를 GAS가 다시 훑어 날짜·금액·낱말 후보를 쪽 번호·판독 종류(Vision 줄·칸 / 쪽 단위 / 드라이브 글)와 함께 돌려준다. want: date | amount | keyword(+keyword). 찾은 값은 value_set basis {kind:"doc", file, page, find}로.',
    input_schema: { type: 'object', properties: { file: { type: 'string' }, want: { type: 'string', enum: ['date', 'amount', 'keyword'] }, keyword: { type: 'string' } }, required: ['file', 'want'] } });
  tools.push({ name: 'quick_judge', description: '좁은 판단 맡기기(저가 AI Haiku 5.5) — 짧고 근거가 서류에 있는 판단: 후보 중 하나 고르기, 표기가 같은 사람·주소인지, 판독 고르기, 처음 보는 서류 종류. 재료(material)에 원문 줄·후보를 넣는다(개인정보는 이미 가려짐). 답·확실 여부·근거를 돌려준다. 불확실이면 네가 판단하거나 여쭙는다.',
    input_schema: { type: 'object', properties: { question: { type: 'string' }, material: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } }, required: ['question', 'material'] } });
  tools.push({ name: 'ask_higher', description: '어려운 판단 올리기(상위 AI Opus 5.5) — 특례가 얽힌 사건분류(1세대1주택·일시적 2주택·상속주택·정비사업 감면), 시가·유사사례 다툼, 법령 해석이 갈리는 것. 재료를 정리해 넘긴다. 최고급(Fable 5.1)이 필요하면 부르지 말고 보고에 "최고급 검토 필요"로 적는다(세무사님이 쓰기 전에 정하심).',
    input_schema: { type: 'object', properties: { question: { type: 'string' }, material: { type: 'string' } }, required: ['question', 'material'] } });
  // [2026.10.22 넥스가 주인] GAS 한 바퀴 — 화면이 실행(서버 6분 한도 안에 한 번에 못 끝나는 여러 단계라). 넥스의 첫 도구
  // [2026.10.27 10-27 C] 질문 닫기 — 서류로 푼 질문(서류 ⚠ 확인 등)·세무사님이 답한 질문을 결정으로 닫는다(예전엔 말로만 "해소"라 하고 질문은 네 바퀴 내내 그대로 다시 떴다)
  tools.push({ name: 'close_question', description: '질문 닫기(토큰 0) — 서류를 읽어 네가 푼 질문(서류 ⚠ 확인·판독 확인 등)이나 세무사님이 채팅으로 답하신 질문을 결정으로 닫아 다음 처리 때 다시 묻지 않게 한다. decision: done(확인·해소)·보류(검토서 "추가로 확인할 사항"에 남김)·무시. note에 근거 한 줄(어느 서류 어느 값으로 풀었나). 세무사님께 여쭐 것은 닫지 말고 ask_user.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, itemIds: { type: 'array', items: { type: 'string' } }, decision: { type: 'string', enum: ['done', '보류', '무시'] }, note: { type: 'string' } }, required: ['caseId', 'itemIds', 'note'] } });
  // [2026.10.27 경우별 저장] 세액계산기는 네가 쓰는 도구 — 세목·입력을 바꿔 몇 번이든 돌려 이름 붙여 저장(기본 저장본·세무사님 값은 그대로)
  tools.push({ name: 'calc_scenario', description: '경우(안) 세액계산 저장(토큰 0) — 세액계산기를 서버에서 돌려 결과를 이름 붙여 따로 저장한다(기본 저장본·세무사님 값은 바뀌지 않음). tax: transfer·gift·inheritance(생략하면 사건 세목). changes: 양도는 계산기 칸 경로(a0.assetType·a0.isOneHouseOneFamily·c0.totalPrice·a0.acquisitionPrice·costs·taxfee·사건분류·seller.multiHouseCount), 증여·상속은 엔진 입력 이름(giftAmount·relation·taxableEstateAmount·hasSpouse…). input: 사건 자료에 없는 전제로 다른 세목을 견줄 때 엔진 입력 전체. 비과세 적용 전/후·필요경비 일부 제외·양도세 vs 증여세 비교처럼 경우마다 한 번씩 부른다. 세액 숫자는 이 결과(저장본 id)에서만 보고하고 암산하지 않는다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, tax: { type: 'string', enum: ['transfer', 'gift', 'inheritance'] }, name: { type: 'string' }, changes: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, value: {} }, required: ['path'] } }, input: { type: 'object' }, why: { type: 'string' } }, required: ['caseId', 'name'] } });
  // [2026.10.27 F] 읽을 범위 — 세무사님 "신고제출 폴더에 있는 파일만 읽어서 다시 처리하라"
  // [2026.10.28 넥스 폭넓은 파일 읽기] 세무사님 원문: "ai는 포괄적으로 파일에 접근할 수 있어야 하지만 gas는 구체적으로 필요한 것만 콕 집어서 알려주어야 한다" / "ai는 사용자의 대리인의 위치이지. gas와 동급이 아니다"
  tools.push({ name: 'case_files', description: '사건 폴더 파일 목록(토큰 0, 읽기만) — 하위 폴더·산출물·보관·이미 낸 신고서·예규·검토 메모·지침까지 전부(폴더·크기·수정일·종류). GAS체크(켬/끔)는 GAS가 읽는 파일 표시일 뿐 참고로만 — 너는 어떤 파일이든 file_read로 읽는다. dir(폴더 이름)·find(파일 이름 낱말)로 좁힐 수 있다.', input_schema: { type: 'object', properties: { dir: { type: 'string', description: '폴더 이름으로 좁히기(선택)' }, find: { type: 'string', description: '파일 이름 낱말로 좁히기(선택)' } } } });
  tools.push({ name: 'file_read', description: '사건 폴더 파일 한 개의 글 읽기(토큰 0) — 체크 목록과 무관하게 어떤 파일이든(글자 기억 _글자인식기억에 있으면 그것, 없으면 드라이브 글자층·PDF 글자). 쟁점이 생기면 세무사님이 폴더에 두신 관련예규·검토 메모·지침부터 이것으로 직접 읽어라. file=파일 이름(또는 폴더/파일 이름), page=쪽("3"·"2-4", 쪽 나눔이 있을 때), start=시작 글자 위치, find=낱말 앞뒤 보기, len=길이(기본 4000). 더있음이면 start를 옮겨 이어 읽는다. 개인정보는 가려서 온다.', input_schema: { type: 'object', properties: { file: { type: 'string' }, page: { type: 'string' }, start: { type: 'number' }, find: { type: 'string' }, len: { type: 'number' } }, required: ['file'] } });
  tools.push({ name: 'set_read_scope', description: 'GAS가 읽을 파일 목록 바꾸기(토큰 0) — 사건마다 "읽을 파일 체크 목록"이 있고 GAS(서류 읽기·칸 채우기·직결, gas_run)는 그 목록의 켜진 파일만 읽는다. 이것은 GAS에게 콕 집어 주는 것이지 네 읽기 범위가 아니다(너는 case_files/file_read로 어떤 파일이든 읽는다). 세무사님이 "○○ 폴더(파일)만 읽어라"·"○○는 빼라" 하시면 on(켤 파일 이름·폴더 이름 — 폴더면 그 아래 하위 폴더까지 전부)·off(끌 파일·폴더)로 목록을 바꾼다(파일 단위). dirs·files는 옛 방식(그 폴더·파일만). clear:true면 전체로. 바꾼 뒤 gas_run을 한 번 다시 부른다. 목록이 아직 없는 사건(case_status 현황의 읽을범위가 null)은 네가 먼저 case_files로 목록을 보고 모르는 파일은 file_read로 읽어 판단한 뒤 ids(켤 파일 전부) 또는 on/off로 정하고, 정한 목록과 이유를 세무사님께 보고한다 — 읽지 않고 체크하지 않는다(세무사님 원문 "ai가 체크를 하려면 뭘 알아야 체크를 할 수 있지 않은가? 뭘 알려면 읽어야 하는 것이고!").',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, ids: { type: 'array', items: { type: 'string' }, description: '켤 파일 이름(또는 폴더/파일) 전부 — 목록을 처음 정할 때(그 밖은 끔)' }, on: { type: 'array', items: { type: 'string' } }, off: { type: 'array', items: { type: 'string' } }, dirs: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'string' } }, clear: { type: 'boolean' }, why: { type: 'string' } }, required: ['caseId'] } });
  tools.push({ name: 'gas_run', description: '[부르기 전에: case_files로 목록을 보고 모르는 파일은 file_read로 읽은 뒤, GAS가 읽을 파일을 set_read_scope로 콕 집어 준 다음 부른다 — 세무사님이 범위를 말씀하셨으면("○○ 폴더는 빼고"·"○○만") 반드시(안 하면 gas_run이 거절된다), 말씀이 없어도 목록에 뺄 폴더(증빙 아닌 폴더·다른 세목 서류 폴더)가 있으면 지정] GAS 한 바퀴(토큰 0, AI 없음) — 사건파악 → 증빙 폴더의 모든 서류 읽기·한 파일에 든 여러 서류 나누기·흐린 사진 보정 → 세액계산기 칸 채우기·서류끼리 교차검증을 한 번에 한다(몇 분 걸림). 돌려주는 것: 채운 칸·남은 질문 수, GAS가 못 풀어 너에게 돌아온 자리, 서류에 없어 세무사님께 바로 여쭐 빈 칸. case_status에서 증빙 읽기·칸 채우기가 이미 되어 있고 새 서류가 없으면 부르지 않는다(세무사님이 이미 하셨거나 지난 처리에서 한 일 — 다시 읽지 않는다). 새 서류가 있거나 아직 안 했으면 한 번만 부른다.',
    input_schema: { type: 'object', properties: { why: { type: 'string', description: '한 줄 — 무엇을 보려고(보통 "처음 한 바퀴")' } } } });
  // [2026.10.22 작업 기록부] 사건 현황 보기 — 세무사님이 직접 하신 일·지난 처리(누가·언제·무엇), 정한 값, 단계별 시각, 새 서류, 반영 현황표, 남은 질문. 늘 맨 먼저(0원)
  tools.push({ name: 'case_status', description: '사건 현황 보기(토큰 0) — 작업 기록부(세무사님이 GAS 도구로 직접 하신 일과 지난 넥스 처리: 누가·언제·무엇), 정한 값과 출처(세무사님 값은 바꾸지 않는다), 단계별로 이미 한 것과 시각, 그 뒤 새로 들어온 서류, 반영 현황표(⑦ — 남은 일의 기준), 남은 질문 목록. 처리를 맡으면 맨 먼저 부르고, 여기서 남은 일만 고른다.',
    input_schema: { type: 'object', properties: {} } });
  // [2026.10.22] 마무리 — 세액계산·서식 대조·저장·종합검토서 초안(화면이 실행, 0원). 맡은 범위에 계산·검토서가 들어 있고 세무사님께 여쭐 것이 없을 때 부른다
  tools.push({ name: 'gas_finish', description: '마무리(토큰 0, 화면이 실행) — 세액계산 → 서식 대조 → 저장 → 종합검토서 초안. 세무사님께 여쭐 것이 남아 있으면 부르지 말고 여쭙고 끝낸다(답이 오면 화면이 이어서 마무리한다). 일부만 맡으셨으면(예: 취득가액만) 부르지 않는다.',
    input_schema: { type: 'object', properties: { why: { type: 'string' } } } });
  // [2026.10.19 법령] 세무사님 "ai가 위임을 받아 사건을 처리할때도 이 과정을 거쳐야 하는 거 아닌가?" — 쟁점마다 법령·예규·판례를 GAS 도구로 찾아(토큰 0) 근거로 쓰면 첨부
  tools.push({ name: 'law_lookup', description: '조문 원문 보기(토큰 0) — 사건 기준일에 시행된 판(법령 정비본, 산식 보정 포함). 쟁점 판단에 필요한 조문을 확인할 때. 근거로 쓰면 law_attach로 사건에 첨부한다. articleNo에 「부칙」을 주면 그 판까지의 부칙(적용례·경과조치 — 언제 양도분부터)을 본다.',
    input_schema: { type: 'object', properties: { lawName: { type: 'string', description: '예: 소득세법 시행령' }, articleNo: { type: 'string', description: '예: 155, 97의2' } }, required: ['lawName', 'articleNo'] } });
  tools.push({ name: 'law_search', description: '예규·해석례·판례·심판례 찾기(토큰 0, 국가법령정보센터) — category: precedent(판례)·interpretation(법령해석례)·administrative_rule(행정규칙)·tax_tribunal(조세심판원). 목록의 id로 law_attach 한다.',
    input_schema: { type: 'object', properties: { category: { type: 'string' }, query: { type: 'string' } }, required: ['category', 'query'] } });
  // [2026.10.21] AI 회의 법령 안건 — 세무사님 "ai회의 결론을 넥스가 보도록 하라"(Federation.js aiJudgeForNex_, 대화창 넥스의 job_lookup law_decisions와 같은 자료)
  tools.push({ name: 'law_decisions', description: 'AI 회의 법령 안건 보기(토큰 0) — 세무사님이 결정한 쟁점(결론·메모·근거)과 아직 판단 대기인 쟁점. 특례·중과·평가처럼 해석이 갈리는 판단 전에 같은 쟁점이 있는지 먼저 본다. "결정"은 그대로 따르고, "판단 대기"·"보류"는 단정하지 말고 질문 메모에 "판단 대기 쟁점"이라고 적는다.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: '쟁점 낱말(예: 투기지역, 일시적 2주택)' } } } });
  tools.push({ name: 'law_attach', description: '근거 자료를 사건에 첨부("AI 첨부(미확인)" — 세무사님이 법령 탭에서 확정하거나 뺀다). 관련법령 파일·검토서 근거에 들어간다. 조문은 kind="statute"+lawName+articleNo(+hang 항 번호), 예규·판례는 kind=그 category+id. use=어느 쟁점·계산 칸에 쓰는지, why=왜(한 줄). 돌려준 id를 value_set의 attach에 넣는다.',
    input_schema: { type: 'object', properties: { kind: { type: 'string' }, lawName: { type: 'string' }, articleNo: { type: 'string' }, hang: { type: 'number' }, id: { type: 'string' }, title: { type: 'string' }, use: { type: 'string' }, why: { type: 'string' } }, required: ['kind', 'use', 'why'] } });
  // [2026.10.20] 업무관리자 지침(업무별 판단 절차) — 세무사님 "이 업무관리자지침과 각종템플릿 작성이 추후 시스템의 성능을 좌우하게 된다". 사이드바 AI와 같은 이름·같은 실행 함수(Code.js toolListBusinessManagers·toolLoadBusinessManager)
  tools.push({ name: 'list_business_managers', description: '업무관리자 지침 목록(토큰 적음) — 업무관리자 폴더 맨 위 지침의 이름과 한 줄 설명. 이 사건 세목·업무유형에 맞는 지침을 고를 때.',
    input_schema: { type: 'object', properties: {} } });
  tools.push({ name: 'load_business_manager', description: '업무관리자 지침 읽기 — list_business_managers 목록의 이름 하나의 전체 내용(판단 순서·필요 서류·자주 틀리는 곳·근거 조문). 이 사건에 맞는 것만, 보통 한두 개.',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: '목록에 나온 이름 그대로(예: 양도_일시적2주택)' } }, required: ['name'] } });
  // [2026.10.21] 절세 아이템 — 대화창·사이드바 넥스와 같은 이름·같은 실행 함수(KnowHow.js knhTaxItemsSearch_·knhTaxItemRead_, 토큰 0)
  tools.push({ name: 'search_tax_items', description: '절세 아이템 찾기(토큰 0) — NETAX가 정리한 절세·자주 묻는 질문·주요 이슈·함정 아이템 목록(제목·요약·근거 조문·검토 상태·기준일·현행화 필요)에서 찾을 말과 맞는 것. 판단 근거로 쓸 만한 정리가 있는지 볼 때.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, semok: { type: 'string', enum: ['양도', '증여', '상속', '공통'], description: '좁힐 세목(선택)' } }, required: ['query'] } });
  tools.push({ name: 'read_tax_item', description: '절세 아이템 하나 읽기(토큰 0) — 본문·근거 조문·검토 상태·기준일·현행화 필요 이유·조심할 곳·"인용" 줄. 근거로 쓰면 인용규칙을 따르고, 세액을 가르는 조문은 law_lookup으로 원문 확인.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string', description: 'id를 모를 때 아이템 제목' } } } });
  tools.forEach(function (t) { if (t.name === 'value_set') t.input_schema.properties.attach = { type: 'array', items: { type: 'string' }, description: '이 판단의 근거로 쓴 첨부 자료 id(law_attach가 돌려준 id 또는 입구 요약의 첨부 목록 id)' }; });
  tools[tools.length - 1].cache_control = { type: 'ephemeral' };
  return tools;
}
// [2026.10.21 넥스 하나로] 세무사님 원문: "관리든 사건처리든 최상위 ai(이하 "넥스"라 부른다)는 나의 대리인의 자격으로 존재한다"
//  "넥스 하나로 합치는 쪽으로 승인한다. 같은 채팅창내에서의 대화는 어떤 ai라도 모두 공유하는 것으로 알고 있었다"
//  사건 지휘도 채팅창 넥스와 같은 신분 — 같은 기본 지시문(DEFAULT_SYSTEM_PROMPT)과 마스터 프로필(remember_fact로 기억한 지침)을 앞에 둔다.
//  야간 경로 점검(SysAudit.js)은 마스터 프로필을 job 경로에서 이미 보므로 지휘 고유 부분(caseProcAiLiveModeText_)만 본다.
function caseProcAiNexBase_() {
  let master = '';
  try { master = typeof getMasterProfileText_ === 'function' ? getMasterProfileText_() || '' : ''; } catch (e) { master = ''; }
  // [2026.10.21] 최근 바뀐 job 기능(배포 기록 — 대화창 넥스와 같은 글, Federation.js ①) — 사건 지휘 넥스도 새 도구·바뀐 동작을 알게
  let changes = ''; try { changes = typeof commRecentChangesPrompt_ === 'function' ? commRecentChangesPrompt_() : ''; } catch (e) { changes = ''; }
  return DEFAULT_SYSTEM_PROMPT + (master ? '\n\n' + master : '') + changes + '\n\n'
    + '[사건 지휘 모드 — 같은 넥스] 지금은 세무사님이 채팅창에서 "이 사건 처리하자"라고 맡긴 사건을 지휘한다. 위 마스터 프로필은 세무사님의 성향·지침을 알기 위한 것이다 — '
    + '거기 나온 도구 중 아래 목록에 없는 것은 부르지 않고 같은 일을 하는 네 도구로 한다(도구 부족 신고는 report_tool_gap). 채팅창에서 세무사님이 하신 말씀은 첫 글의 [세무사님 말씀]에 있다 — 서류보다 앞서는 지시로 따르되, 세액이 크게 갈리는 칸(시가·특수관계 등)은 그 말씀을 근거로 넣지 말고 질문 메모로 확인한다.\n'
    // [2026.10.21] 세무사님 원문: "내가 넥스에게 전체를 맡길때도 있고 부분적으로 맡길때도 있고 아예 맡기지 않고 직접 처리할 때도 있는 것을 모두 감안하라"
    + '[맡긴 범위] 세무사님은 사건을 전체로 맡기기도, 일부만 맡기기도, 직접 처리하기도 한다. (1) 말씀이 범위를 정하면(예: "취득가액만 봐줘", "사건분류만") 그 범위의 자리만 판단하고 나머지 자리는 손대지 않은 채 보고에 "맡기지 않으셔서 두었음"으로 적는다. '
    + '(2) 세무사님이 직접 넣거나 결정한 값(사이드바 확인·세액계산 화면 입력·지난 처리 뒤 고친 값)은 바꾸지 않는다 — 서류와 어긋나 보이면 넣지 말고 질문 메모로 여쭌다. (3) 범위 말씀이 없으면 전체를 맡긴 것으로 본다.\n\n';
}
function caseProcAiLiveSystem_(cap) {
  return caseProcAiNexBase_() + caseProcAiLiveModeText_(cap);
}
function caseProcAiLiveModeText_(cap) {
  return caseProcAiSystem_() + '\n\n' + [
    '[운영 — 지금 판 (2026.10.22 넥스가 주인)]',
    '- 이 사건 처리의 주인은 너(넥스)다. GAS는 네가 부르는 도구다 — 도구 안은 AI 없이 0원으로 돈다(세무사님 "가급적 ai없이 돌아가는 gas를 원하는 거지. 최상위 ai가 도구로 사용하는 것이 gas인 것이다").',
    '- 맨 먼저 case_status로 사건 현황을 본다 — 세무사님이 GAS 도구로 직접 하신 일·지난 처리(누가·언제·무엇), 정한 값, 단계별로 이미 한 것, 새 서류, 반영 현황표(남은 일의 기준). 세무사님은 맡기기 전에 직접 일하시다가 남은 일만 맡기기도 하신다("직접 처리하다가 남은 작업을 AI에게 시킬 수 있으니").',
    '- 남은 일만 한다: 증빙 읽기·칸 채우기가 아직 안 됐거나 새 서류가 있으면 gas_run을 한 번 부르고, 이미 됐으면 부르지 않는다(다시 읽지 않는다). GAS가 못 푼 자리만 판단한다. 세무사님 값(누가=세무사님)은 바꾸지 않고, 서류와 어긋나 보이면 말씀만 드린다. 말씀이 범위를 정하셨으면(예: "취득가액만") 그 범위만.',
    '- 세무사님께 여쭐 것이 생기면 ask_user로 올리고(화면이 계산기 항목별로 묶어 여쭙는다 — 개수로 자르지 않는다) 끝낸다. 여쭐 것이 없고 맡은 범위에 계산·검토서가 들어 있으면 gas_finish(세액계산·서식·저장·검토서)를 부르고 결과를 짧게 보고한다. 판단할 것이 없으면 도구를 더 부르지 않는다(비용을 아낀다).',
    '- 이번 사건 비용 상한 ' + Number(cap).toLocaleString('ko-KR') + '원(너와 quick_judge·ask_higher 합계). 상한에 가까우면 하던 판단까지만 하고 보고한다.',
    '- 좁은 판단은 quick_judge(저가)로, 특례·시가·법령 해석은 ask_higher(상위)로. 최고급은 쓰지 않는다(필요하면 보고에 적음).',
    '- 서류는 GAS 도구로만 본다: issue_bundle(쟁점 묶음)·doc_facts(서류 정리 결과)·facts_find(사실 목록)·재료 도구. docs_read·doc_text(원문 직접 읽기)는 없다 — 위 지침의 doc_text 자리는 issue_bundle로. 단, gas_run 결과의 "종류를 정하지 못한 서류(글자는 읽음)"·의뢰인 메모·사건파악 메모는 규칙이 없어 GAS가 칸에 못 넣은 것이다 — doc_view로 그 글을 읽고 네가 판단한다(세무사님 10-19 "변수담당은 ai이고 상수담당은 gas"). 그 내용을 세무사님께 되묻지 않는다. 정한 값은 value_set(basis doc: 그 파일·그 문장)으로 넣어 🤖 AI 판단 표시와 근거 파일이 남게 한다.', // [2026.10.23 ㅊ1]
    '- 도구로 안 되는 일을 네가 직접 하게 되면(원문을 뒤지고 싶음·여러 값을 머릿속으로 더하거나 나눔·날짜를 세어 봄 등) 그 일을 하지 말고 report_tool_gap으로 "이런 도구가 있으면"을 남긴 뒤 질문으로 돌린다. 그것이 GAS가 자라는 재료다.',
    '- 되돌리기 어려운 일(PDF 묶기·폴더 이름·문자·사건 정보 수정)은 도구가 없다. 필요하면 보고에 "▶실행 카드로 여쭐 것"으로 적는다.',
    '- 빈칸 메우기 고리(세무사님 "빈칸을 채우기 위해 다시 똥통을 뒤지게 되는 것"): ① fact_map으로 빈칸·어긋남을 본다 ② 빈칸마다 찾을서류 중 이 사건에 있는 파일을 고른다 ③ doc_find로 다시 뒤진다(읽기는 GAS) ④ 찾았으면 value_set(근거 doc·쪽), 못 찾았으면 다른 파일 ⑤ fact_map을 다시 불러 메워졌는지 본다 — 빈칸당 다시 뒤지기 2번까지, 더 안 메워지면 남은 빈칸만 추론(infer, 잠정)하거나 짧은 객관식 질문으로 모아 묻는다.',
    '- 업무관리자 지침: case_view 다음, 판단을 시작하기 전에 list_business_managers로 목록을 보고 이 사건 세목·업무유형·AI 자리 주제에 맞는 지침만 load_business_manager로 읽어 그 판단 순서·필요 서류·주의를 따른다(양도 사건이면 "양도_"로 시작하는 것과 특수관계인_판정 같은 공통 지침 중 해당하는 것, 보통 한두 개). 이미 읽은 지침은 다시 읽지 않는다. 지침에 나온 도구 이름이 네 도구에 없으면 같은 일을 하는 네 도구(law_lookup·public_lookup 등)로 하고, 지침의 수치·조문이 세액을 가르면 law_lookup으로 원문을 확인한다. 읽은 지침에 "현행화필요"가 있으면 그 지침을 근거로 쓴 판단의 이유·보고에 그 사실을 적는다. 위 [일하는 순서]·[한도]와 어긋나면 위가 먼저다.',
    '- 절세 아이템(NETAX 정리, 세무사님 "인용할때 근거를 부기하도록 하라"): 특례·함정·자주 틀리는 쟁점이 보이면 search_tax_items로 맞는 정리가 있는지 보고 맞는 것만 read_tax_item으로 읽는다(필요할 때만, 보통 하나). 근거로 쓰면 보고·value_set 이유에 그 "인용" 줄(아이템 이름·근거 조문·기준일·검토 상태)을 붙이고, [확인 필요]·반대 취지·해석 엇갈림 표시는 그대로 옮겨 단정하지 않으며, "현행화 필요"면 그 이유를 적는다. 아이템은 일반 정리라 판단의 근거 조문은 law_lookup으로 원문을 확인해 law_attach한다.',
    '- 법령 근거: 쟁점 판단에 쓴 조문·예규·판례는 law_lookup·law_search로 확인하고 law_attach로 사건에 첨부한 뒤(쓸 곳·이유 한 줄), value_set의 attach에 그 id를 넣는다. 입구 요약의 "첨부된 자료"(세무사님 직접 첨부)는 먼저 읽고 근거로 쓴다.',
    '- AI 회의 결론(2026.10.21 세무사님 "ai회의 결론을 넥스가 보도록 하라"): 해석이 갈리는 판단 전에 law_decisions로 같은 쟁점을 본다. "결정"은 세무사님 결론으로 따르고(근거에 적음), "판단 대기"·"보류"면 값을 넣지 말고 질문 메모에 "AI 회의 판단 대기 쟁점(id)"이라고 적는다.',
    // [2026.10.27 10-27 양도 실사건] 세무사님 원문: "ai에게 종합적으로 지시하면 계산기를 사용하지 않고 ai가 암산으로 세액계산을 하게 되고 그 세액계산의 근거도 남기지 않게 되므로 세금계산신고 절차를 밟도록 주문한 것이었다" / "ai는 내가 직접 작업하는 것을 완전히 대행할 수 있어야 한다"
    '- 세액은 계산 도구로만(암산 금지): 세액 숫자는 tax_calc·calc_scenario·저장된 계산 저장본에서만 보고하고 어느 저장본인지 적는다. 비과세 사건도 계산기로 끝까지 계산한 뒤 비과세를 적용한다. 경우를 바꿔 견줄 때(비과세 적용 전/후, 경비 일부 제외, 양도세 vs 증여세 vs 상속세)는 calc_scenario로 경우마다 저장한다 — 기본 저장본·세무사님 값은 그대로.',
    // [2026.10.27 E·F·G] 세무사님 원문: "신고제출폴더속에 파일들을 모두 아름답게 정리해 놓았는데, 어디서 이상한 것들을 읽어가지고 떠들길래" / "확인했음 이라는 단추만 있으면 도무지 어떻게 하라는 것인가?" / [72] "이미 모두 알려줬는데…"
    '- 세무사님이 "○○ 폴더(파일)만 읽어서 다시 처리하라" 하시면 먼저 set_read_scope로 그 범위를 정하고 gas_run을 다시 부른다 — GAS는 범위 밖 서류(다른 거래 영수증·사진 정산서)를 읽지도 후보로 내지도 않는다(너의 읽기는 별개 — 필요하면 file_read로 어떤 파일이든). 세무사님 말씀 속 폴더 이름을 그대로 쓴다.',
    // [2026.10.28 읽을 대상 ②④] 세무사님 원문: "읽을 파일을 체크하여 지정하는 방법은 어떨까?" / "하위폴더속에 있는 파일은 폴더를 선택하면 모두 읽게 될 터이니"
    // [2026.10.28] 세무사님 원문: "ai가 읽어야할 파일과 gas가 읽어야할 파일이 달라야 하겠구나. 즉 ai는 포괄적으로 파일에 접근할 수 있어야 하지만 gas는 구체적으로 필요한 것만 콕 집어서 알려주어야 한다는 것이다. 따라서 gas에게 읽을 파일을 지정하여 주는 파일선택 기능과 ai가 파일에 접근하는 것과 혼동하지 마라. 다시한번 말하지만 ai는 사용자의 대리인의 위치이지. gas와 동급이 아니다"
    // [2026.10.28 감시] 세무사님 원문: "사건폴더의 모든 파일을 모니터링해서 추가 변경된 것을 미리 읽도록 해야 한다"
    '- 사건 폴더는 GAS가 늘 감시한다(case_status의 서류변동 — 네가 아직 못 본 🆕 새/✏ 바뀐 파일 수와 이름). case_files 목록의 표시: 🆕 새 / ✏ 바뀜 / ✓ 전에 읽음(시각) — ✓는 다시 읽지 않고, 🆕·✏는 file_read로 읽어 둔다. 새 서류가 들어오면 GAS가 너를 따로 깨워 미리 읽게 하므로(기록부 작업 기록 "넥스 — 미리 읽기", 알림), 세무사님이 부르실 때 너는 이미 최신 서류를 알고 있어야 한다.',
    '- 체크 목록은 GAS(서류 읽기·칸 채우기·직결)가 읽을 파일을 콕 집어 주는 것이다. 너는 세무사님 대리인이므로 사건 폴더의 어떤 파일이든 폭넓게 읽는다(case_files로 목록, file_read로 글 — 체크가 꺼진 파일·산출물·보관 폴더도) — 쟁점이 생기면 폴더의 관련예규·검토 메모·지침부터 직접 읽는다. 세무사님이 폴더에 정리해 두신 자료를 지적받은 뒤에야 보는 일은 없어야 한다.',
    // [2026.10.28] 세무사님 원문: "ai가 사용자의 대리인이라고 대체 몇 번을 말하고 있나? ai가 체크를 하려면 뭘 알아야 체크를 할 수 있지 않은가? 뭘 알려면 읽어야 하는 것이고!"
    '- GAS가 읽을 파일은 사건마다 체크 목록이 정한다(case_status 현황의 읽을범위). 체크는 네가 읽어서 안 뒤에 한다 — 순서: case_files로 폴더 파일 목록 보기 → 무엇인지 모르는 파일은 file_read로 읽기 → 이 사건에 필요한 서류인지 판단 → set_read_scope로 GAS에게 체크 목록 지정 → gas_run. 읽고 아는 데서 끝내지 말고 반드시 "GAS에게 콕 집어 주기"(set_read_scope)까지 한 뒤 gas_run — 세무사님이 범위를 말씀하셨는데 set_read_scope 없이 gas_run을 부르면 GAS가 거절한다(가상양도26: 읽고 알고도 지정을 건너뛰어 증여 서류 3개가 GAS에 들어감). 말씀이 없어도 목록에 뺄 폴더(다른 세목 서류·증빙 아닌 폴더)가 보이면 지정한다. 목록이 없으면(null) 네가 이 순서로 직접 폴더를 읽고 판단해 목록을 정하고, 정한 목록(켠 것·뺀 것과 이유)을 세무사님께 보고한다 — 읽지 않고 체크하거나, 읽지도 않고 세무사님께 체크를 미루지 않는다. 세무사님이 "○○는 빼라"·"○○도 읽어라" 하시면 set_read_scope on/off(파일·폴더 이름 그대로). 현황의 새파일미체크에 파일이 있으면 읽지 않았다는 사실을 보고에 적고 체크 여부를 여쭌다.',
    // [2026.10.28 속도 A③] 세무사님 "속도문제를 재검토" → 넥스 왕복 8 → 3~4
    '- 왕복을 아낀다: case_status 첫 응답에 파일 목록·의뢰서/메모 앞부분·미리 읽기 요약이 실려 온다 — 그것을 case_files로 다시 부르지 않는다(본문이 더 필요한 파일만 file_read, 여러 개면 같은 차례에 한꺼번에). gas_run 결과에는 정한 값·질문표(칸·후보·입력 종류)·서류 정리 결과·사람/계약/자산 명단이 묶여 온다 — calc_fill·case_view·doc_view·doc_facts·people_roster·contract_list·owner_assets로 다시 보지 않는다. 세무사님께 올릴 질문이 여럿이면 ask_user 한 번에(questions 배열). 한 차례에 여러 도구를 한꺼번에 불러도 된다(차례마다 10~60초가 든다).',
    '- set_read_scope의 on/off/ids에는 case_files 목록(첫 응답 파일목록)에 있는 이름만 쓴다 — 없는 이름은 결과의 없는파일로 돌아오니, 그 파일을 켰다/껐다고 보고에 적지 않는다(가상양도28: 폴더에 없는 파일을 "끔"이라 적음).',
    '- 묻기 전에 먼저 본다: case_status의 정한값·고침기록·작업기록·채팅 말씀에 세무사님이 이미 정하신 값(누가=세무사님)이 있으면 같은 칸·같은 물음을 다시 묻지 않고 그 값을 쓴다(ask_user도 그런 질문은 올리지 않고 "이미정해진것"으로 돌려준다). 세무사님이 채팅에 적어 주신 숫자는 그대로 value_set(basis user)·value_set(target)으로 넣는다.',
    '- 세무사님께 여쭐 때(ask_user)는 답이 들어갈 칸(target)·후보(cands)·입력 종류(input)를 함께 올린다 — 그래야 화면에 답 칸이 생겨 세무사님이 고르거나 적으면 바로 칸에 들어간다. 칸이 없는 질문만 글로(note만).',
    '- 서류로 네가 푼 질문(서류 ⚠ 확인 등)은 close_question으로 닫는다 — 말로만 "해소"라 하면 다음 처리 때 같은 질문이 다시 뜬다. 이미 확정돼 질문 목록에 없는 칸이 잘못 들어 있으면 value_set(target)으로 고치고, 세무사님이 정하신 값이면 바꾸지 말고 ask_user로 지금 값·서류 값을 여쭌다.',
    '- 모든 글(중간 메모·보고·질문 메모)은 한국어로 쓴다 — 화면에 그대로 보인다.',
    '- 보고는 세무사님이 읽는다 — 쉬운 말로, 표·기호 없이 짧게. 세액은 도구 값 그대로.',
    // [2026.10.22] 세무사님 "채팅창에서는 나와 AI의 소통이 주가 되어야" / "AI주도라고 해서 나하고 상의하지 않고 AI가 무조건 사건을 완결하는 것을 구현하려고 하는 것인가?"
    '- 끝낼 때 쓰는 보고는 채팅창에서 세무사님께 직접 하는 말이다. 굵은 글씨·목록 기호·표 없이 서너 문장: 무엇을 했는지 한 문장, 그다음 계산을 막는 것부터 무엇을 여쭙는지(급한 것 두세 가지만 — 나머지는 화면 질문 목록에 이미 있다). GAS 진행(몇 바퀴·어느 도구)은 쓰지 않는다(화면이 요약해 보인다).',
    '- 맡은 일은 끝까지 하되, 물을 것이 있으면 묻는다(세무사님 "AI가 무조건 사건을 완결하면 절대 안된다는 것이 아니라, 나한테 물을 것이 있으면 물어봐야한다는 뜻이다"). 여쭌 것에 답이 오면 화면이 이어서 마무리한다. 세무사님이 채팅으로 답하시면 같은 넥스(채팅)가 그 칸에 넣는다.',
  ].join('\n');
}

// ---------- 차례 사이 기억(CacheService — 6시간) ----------
function caseProcAiCtxKey_(caseId) { return 'aiLead:' + caseId; }
function caseProcAiCtxLoad_(caseId) {
  try { const s = CacheService.getScriptCache().get(caseProcAiCtxKey_(caseId)); if (s) return JSON.parse(s); } catch (e) {}
  return { lastItems: null, lookups: [], decisions: [], asks: [], opinions: [], gaps: [], attaches: [], subWon: 0 };
}
function caseProcAiCtxSave_(caseId, ctx) {
  try {
    const keep = Object.assign({}, ctx, { lookups: (ctx.lookups || []).slice(-12), lastItems: (ctx.lastItems || []).slice(0, 60) });
    let s = JSON.stringify(keep);
    if (s.length > 95000) { keep.lastItems = (keep.lastItems || []).slice(0, 25); keep.lookups = keep.lookups.slice(-4); s = JSON.stringify(keep); }
    CacheService.getScriptCache().put(caseProcAiCtxKey_(caseId), s.slice(0, 99000), 21600);
  } catch (e) {}
}

// 보낼 메시지 가리기 — 글 조각마다(생각·생각 가림 블록은 그대로), 도구 입력은 JSON 글로 가린 뒤 되돌림
function caseProcAiMaskMsgs_(messages) {
  const mk = typeof cxMask_ === 'function' ? cxMask_ : caseProcAiMask_;
  const one = function (b) {
    if (typeof b === 'string') return mk(b);
    if (!b || typeof b !== 'object' || b.type === 'thinking' || b.type === 'redacted_thinking') return b;
    const o = Object.assign({}, b);
    if (typeof o.text === 'string') o.text = mk(o.text);
    if (o.type === 'tool_result') o.content = Array.isArray(o.content) ? o.content.map(one) : (typeof o.content === 'string' ? mk(o.content) : o.content);
    if (o.type === 'tool_use' && o.input) { try { o.input = JSON.parse(mk(JSON.stringify(o.input))); } catch (e) {} }
    return o;
  };
  return (Array.isArray(messages) ? messages : []).map(function (m) { return Object.assign({}, m, { content: Array.isArray(m.content) ? m.content.map(one) : one(m.content) }); });
}
// ---------- 모델 한 번 부르기 ----------
function caseProcAiCall_(model, system, tools, messages, maxTokens, effort) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) return { error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다.' };
  const cfg = MODEL_CONFIG[model];
  if (!cfg) return { error: '모델 표에 없는 모델: ' + model };
  // [2026.10.20 보안 — 세무사님 조건 "AI로 보낼 때 주민·전화·계좌 가림"] 보내기 직전 한 곳에서 한 번 더 가린다(화면·PC가 이미 가렸어도).
  //  모든 글(사용자 글·본문·도구 결과·도구 입력)에 cxMask_(없으면 caseProcAiMask_). 생각 블록은 서명이 있어 그대로 둔다
  messages = caseProcAiMaskMsgs_(messages);
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
  // 시험 모드: 비용만 셈(buildClaudeUsageInfo_는 사용량 속성에 쓰고 ai_logPaid_는 기록 파일에 씀 — 둘 다 안 부름)
  if (CASEPROC_AI_DRY_) { const u = json.usage || {}; won = Math.round((((u.input_tokens || 0) * cfg.input + (u.output_tokens || 0) * cfg.output + (u.cache_creation_input_tokens || 0) * cfg.input * 1.25 + (u.cache_read_input_tokens || 0) * (cfg.cacheRead != null ? cfg.cacheRead : cfg.input * 0.1)) / 1e6) * CASEPROC_AI_KRW_ * 10) / 10; return { json: json, won: won }; }
  try { const u = buildClaudeUsageInfo_(json, cfg, model, null); won = Math.round(u.costUsd * CASEPROC_AI_KRW_ * 10) / 10; ai_logPaid_({ entry: { kind: 'caseproc-ai', model: model, usd: u.costUsd, q: (CASEPROC_AI_DRY_ ? '[시험] ' : '') + '사건처리 AI 지휘' } }); } catch (e) {}
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
  if (name === 'ask_user' && Array.isArray(input.questions) && input.questions.length) { // [2026.10.28 속도 ⓒ] 질문 여럿을 한 번에(왕복 1)
    const outs = input.questions.slice(0, 12).map(function (q) { let o; try { o = JSON.parse(caseProcAiLiveExec_(caseId, 'ask_user', Object.assign({}, q || {}, { questions: undefined }), ctx).text); } catch (e) { o = { 오류: String(e && e.message || e).slice(0, 80) }; } return o; });
    return { text: JSON.stringify({ ok: true, 묶음: outs.length, 올린질문: outs.reduce(function (s, o) { return s + (Number(o.올린질문) || 0); }, 0), 각각: outs }) };
  }
  if (name === 'ask_user') {
    let ids = (input.itemIds || []).map(String).slice(0, 12);
    // [2026.10.27 G] 이미 세무사님이 정하신 칸은 다시 묻지 않는다(10-27 [71]~[72] "이미 모두 알려줬는데…") — 질문의 칸·새 질문의 target에 세무사님 값이 있으면 그 값을 돌려주고 질문을 올리지 않는다
    const c0 = akReadCase_(caseId), sv0 = c0 ? (caseProcLoad_(caseId) || {}) : {};
    const already = [];
    const settled = function (target) { if (!c0 || !target) return null; let pv = null; try { pv = caseProcPrevValue_(c0, sv0, String(target)); } catch (e) { pv = null; } return pv && pv.who === '세무사님' ? pv : null; };
    ids = ids.filter(function (id) { const it = (ctx.lastItems || []).filter(function (x) { return x.id === id; })[0]; const pv = it && it.ask ? settled(it.ask.target) : null; const dd = sv0.decisions && sv0.decisions[id] && sv0.decisions[id].d; if (pv) { already.push({ 질문: id, 칸: it.ask.target, 세무사님값: caseProcAiMask_(caseProcValueText_(pv.v).slice(0, 80)), 출처: pv.src }); return false; } if (dd === 'done' || dd === '무시') { already.push({ 질문: id, 결정: dd }); return false; } return true; });
    const pvNew = settled(input.target);
    if (pvNew) already.push({ 질문: '(새 질문)', 칸: input.target, 세무사님값: caseProcAiMask_(caseProcValueText_(pvNew.v).slice(0, 80)), 출처: pvNew.src });
    const note = caseProcAiMask_(caseProcAiCut_(input.note || '', 300));
    const newQ = !(input.itemIds || []).length && note && !pvNew; // 질문 목록의 질문이 모두 "이미 정해진 것"으로 걸러졌으면 메모를 새 질문으로 올리지 않는다(같은 물음을 글로 또 묻는 것)
    if (ids.length || newQ) ctx.asks.push({ ids: ids, note: note, urgent: !!input.urgent, target: newQ ? String(input.target || '') : '', label: newQ ? caseProcAiCut_(input.label || '', 40) : '', input: newQ ? String(input.input || '') : '', cands: newQ && Array.isArray(input.cands) ? input.cands.slice(0, 8).map(function (q) { return { v: q && q.v != null ? q.v : '', label: caseProcAiCut_((q && q.label) || '', 60), src: caseProcAiMask_(caseProcAiCut_((q && q.src) || '', 80)) }; }) : [] });
    return { text: JSON.stringify({ ok: true, 올린질문: ids.length + (newQ ? 1 : 0), 언제: input.urgent ? '처리 끝에 맨 위(계산을 막음)' : '처리 끝에 모아서', 이미정해진것: already.length ? already : undefined, 안내: already.length ? '세무사님이 이미 정하신 칸은 묻지 않았다 — 그 값을 그대로 쓰고 보고에 적어라' : undefined }) };
  }
  if (name === 'case_files') { const cf = akReadCase_(caseId); if (!cf) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) }; let r; try { r = caseProcNexFileList_(cf, input || {}); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } return { text: caseProcAiMask_(JSON.stringify(r)).slice(0, 12000) }; } // [2026.10.28 넥스 폭넓은 파일 읽기]
  if (name === 'file_read') { const cf = akReadCase_(caseId); if (!cf) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) }; let r; try { r = caseProcNexFileText_(cf, input || {}); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } ctx.lookups = ctx.lookups || []; ctx.lookups.push({ tool: 'file_read', file: caseProcAiCut_(String((input && input.file) || ''), 80), ok: !!(r && r.ok) }); return { text: caseProcAiMask_(JSON.stringify(r)).slice(0, 14000) }; }
  if (name === 'set_read_scope') { // [2026.10.27 F]
    ctx.scopeSet = true; // [2026.10.28 결함 L] 이번 처리에서 범위를 정했다 — gas_run 허용
    const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
    let r; try { r = caseProcReadScope_(c0, { dirs: input.dirs, files: input.files, ids: Array.isArray(input.ids) ? input.ids : undefined, on: Array.isArray(input.on) ? input.on : undefined, off: Array.isArray(input.off) ? input.off : undefined, clear: !!input.clear, note: caseProcAiCut_(input.why || '', 120), by: '넥스' }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } // [2026.10.28 읽을 대상 ④] on/off 파일 단위
    if (r && r.ok && r.changed && Array.isArray(r.changed.miss) && r.changed.miss.length) { r.없는파일 = r.changed.miss.slice(); r.안내 = '⚠ 목록에 없는 이름 ' + r.changed.miss.length + '개는 켜지도 꺼지지도 않았다(' + r.changed.miss.join(', ') + ') — 보고에 적지 마라. 이름은 case_files 목록 그대로.'; } // [2026.10.28 ⓔ]
    ctx.decisions.push({ at: new Date().toISOString(), itemId: 'readScope', 칸: '읽을 목록', value: input.clear ? '전체' : [(Array.isArray(input.on) && input.on.length ? '켬 ' + input.on.join(',') : ''), (Array.isArray(input.off) && input.off.length ? '끔 ' + input.off.join(',') : ''), (Array.isArray(input.dirs) ? input.dirs.join(',') : '')].filter(Boolean).join(' / ') , basis: 'user', why: caseProcAiMask_(caseProcAiCut_(input.why || '', 120)), sure: '', 결과: r && r.ok ? caseProcAiCut_(r.message || '', 120) + (r.없는파일 ? ' · 없는 파일 ' + r.없는파일.join(',') : '') : '실패 — ' + caseProcAiCut_((r && r.error) || '', 100) });
    return { text: caseProcAiMask_(JSON.stringify(r)).slice(0, 2500) };
  }
  if (name === 'report_tool_gap') {
    ctx.gaps.push({ want: caseProcAiMask_(caseProcAiCut_(input.want, 200)), kind: input.kind || '', tool: input.tool || '', shape: caseProcAiCut_(input.shape || '', 120), instead: caseProcAiCut_(input.instead || '', 120), situation: caseProcAiMask_(caseProcAiCut_(input.situation || '', 300)) }); // [2026.10.21] 막힌 상황(Claude가 재현할 수 있게)
    return { text: JSON.stringify({ ok: true, 기록: '도구 부족으로 남김' }) };
  }
  if (name === 'save_draft') return { text: JSON.stringify({ ok: true, 안내: '처리 끝에 화면이 저장·검토서 초안·현황표를 만든다' }) };
  if (CASEPROC_AI_NO_TOOLS_.indexOf(name) !== -1) { ctx.gaps.push({ want: name + '를 부르려 함 — ' + caseProcAiCut_(JSON.stringify(input.find || input.file || input.phase || ''), 80), kind: '없음', tool: name, auto: true }); return { text: JSON.stringify({ 오류: '이 도구는 없습니다 — issue_bundle·doc_facts·facts_find로 보거나, 안 되면 report_tool_gap 후 질문으로' }) }; }
  if (name === 'case_status') { // [2026.10.22] 넥스 현황 보기 — 남은 질문을 이 차례들의 질문으로 기억(칸 채우기를 다시 돌리지 않고 issue_bundle·value_set을 쓰게)
    const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
    const sv0 = caseProcLoad_(caseId) || {};
    if (!ctx.lastItems && Array.isArray(sv0.remaining) && sv0.remaining.length) { ctx.lastItems = caseProcAiSlimItems_(sv0.remaining); ctx.gasItems = true; }
    let view = {}; try { view = caseProcNexView_(c0, { withFiles: true }); } catch (e) { view = { 오류: String(e && e.message || e).slice(0, 80) }; }
    let rows = []; try { const st = caseProcStatus_(c0, {}); rows = (st.rows || []).map(function (r) { return r[0] + ' · ' + r[1] + ': ' + r[2] + (r[3] ? ' (' + String(r[3]).slice(0, 80) + ')' : ''); }); } catch (e) { rows = ['반영 현황표를 만들지 못함: ' + String(e && e.message || e).slice(0, 60)]; }
    const dec0 = sv0.decisions || {};
    const q = (sv0.remaining || []).slice(0, 40).map(function (it) { const d = dec0[it.id] && dec0[it.id].d; return it.id + ' | ' + (d ? '(' + d + ') ' : '') + caseProcAiCut_(it.text, 70); });
    // [2026.10.28 속도 A①] 세무사님 "속도문제를 재검토" → "넥스 왕복부터": 첫 응답에 파일 목록(case_files 내용)·의뢰서·사건 폴더 바로 아래 md 메모 본문·미리 읽기 요약(nexRead)을 함께 실어 case_files·file_read 왕복을 없앤다(가상양도26·27 실측 8왕복 중 3~4왕복이 이것). 크기 상한 — 본문은 파일당 3,000자·합계 8,000자, 전체 20,000자 넘으면 본문을 빼고 목록만
    let pack = null;
    try {
      const fl = caseProcNexFileList_(c0, { max: 120 });
      // [2026.10.28 속도 ⓑ — 가상양도28 실측: 첫 응답이 약 100초] 본문 대신 앞 300자(한두 줄 요약 구실), 목록은 이름·폴더·종류(표시는 있을 때만), 전체 6,000자 안 — 본문이 더 필요하면 file_read(같은 차례에 여러 개)
      const list = (fl.파일 || []).map(function (f) { const o = { 파일: f.파일, 폴더: f.폴더 === '(사건 폴더 바로 아래)' ? '' : f.폴더, 종류: f.종류 }; if (f.표시) o.표시 = f.표시; return o; });
      const bodies = []; let used = 0;
      (fl.파일 || []).filter(function (f) { return /사건파악용/.test(f.종류) || (/^\(사건 폴더 바로 아래\)/.test(f.폴더) && /\.(md|txt)$/i.test(f.파일)); }).slice(0, 6).forEach(function (f) {
        if (used >= 1500) return;
        let t = null; try { t = caseProcNexFileText_(c0, { file: (/^\(/.test(f.폴더) ? '' : f.폴더 + '/') + f.파일, len: 500 }); } catch (e) { t = null; }
        if (t && t.ok) { const head = String(t.글 || '').replace(/\s+/g, ' ').trim().slice(0, 300); bodies.push({ 파일: f.파일, 앞부분: head, 글자수: t.글자수 || 0 }); used += head.length; }
      });
      const pre = Object.keys(sv0.nexRead || {}).map(function (k) { const r = sv0.nexRead[k]; return { 파일: r.name, 때: r.at, 요약: r.sum || (r.unread ? '읽지 못함' : '') }; }).slice(0, 30);
      pack = { 파일목록: list, 더있음: !!fl.더있음, 의뢰서_메모_앞부분: bodies, 미리읽기요약: pre };
      ctx.packed = true;
    } catch (e) { pack = { 오류: '파일 목록·본문을 싣지 못함: ' + String(e && e.message || e).slice(0, 80) }; }
    const base = { 반영현황표: rows, 현황: view, 남은질문: q, 안내: '단계에 이미 시각이 있고 새서류가 없으면 gas_run을 부르지 않는다. 세무사님 값(누가=세무사님)은 바꾸지 않는다. 남은 일을 한두 줄로 세무사님께 말씀드리듯 정리해 두고 바로 이어 간다. 아래 파일목록·의뢰서_메모_앞부분·미리읽기요약은 이미 실린 것 — case_files로 다시 부르지 마라. 본문이 더 필요한 파일만 file_read(여러 개면 같은 차례에 한꺼번에).' };
    let txt = caseProcAiMask_(JSON.stringify(Object.assign({}, base, pack || {})));
    if (txt.length > 6000 && pack && pack.의뢰서_메모_앞부분) { pack.의뢰서_메모_앞부분 = '(길어서 뺌 — file_read)'; txt = caseProcAiMask_(JSON.stringify(Object.assign({}, base, pack))); }
    if (txt.length > 6000 && pack && pack.미리읽기요약) { pack.미리읽기요약 = '(길어서 뺌 — case_status 현황의 서류변동 참고)'; txt = caseProcAiMask_(JSON.stringify(Object.assign({}, base, pack))); }
    if (txt.length > 6000 && pack && Array.isArray(pack.파일목록)) { pack.파일목록 = pack.파일목록.slice(0, 40).map(function (f) { return f.파일; }); pack.목록줄임 = '파일이 많아 이름만 40개 — 전체는 case_files'; txt = caseProcAiMask_(JSON.stringify(Object.assign({}, base, pack))); }
    return { text: txt.slice(0, 7000) };
  }
  if (name === 'issue_bundle') {
    const it = (ctx.lastItems || []).filter(function (x) { return x.id === input.itemId; })[0];
    if (!it) return { text: JSON.stringify({ 오류: '그 질문이 마지막 칸 채우기에 없음 — calc_fill 먼저' }) };
    const aj = (it.ask && it.ask.aiJudge) || null;
    return { text: caseProcAiMask_(JSON.stringify({ ok: true, 질문: it.text, 자세히: it.detail || '', 후보: ((it.ask && it.ask.cands) || []).slice(0, 8), 쟁점묶음: aj && aj.q ? String(aj.q).slice(0, 2500) : '(묶음 없음 — doc_facts·facts_find로 재료를 찾고, 없으면 report_tool_gap)', 저비용답: aj ? { 값: aj.value, 확실: aj.sure, 근거: aj.why, 모자란정보: aj.need || [] } : null })).slice(0, 4000) };
  }
  if (name === 'value_set') {
    // [2026.10.27 10-27 A] 질문 목록에 없는 확정 칸 — target으로 "칸 값 고치기"(서버 valueFix). 세무사님 값이면 바뀌지 않고 needConfirm이 돌아온다 → ask_user로 여쭌다
    const inItems = (ctx.lastItems || []).some(function (x) { return x.id === input.itemId; });
    if (!inItems && input.target) {
      if (input.sure !== '확실') return { text: JSON.stringify({ ok: false, 반영: '넣지 않음', 이유: '확정 칸 고치기는 sure="확실"일 때만 — 불확실하면 ask_user로 여쭌다' }) };
      const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
      let r; try { r = caseProcValueFix_(c0, { target: String(input.target), value: input.value, by: '넥스', why: caseProcAiCut_(input.why || '', 80) }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      ctx.decisions.push({ at: new Date().toISOString(), itemId: String(input.target), 칸: String(input.target), value: caseProcAiMask_(String(input.value).slice(0, 80)), basis: (input.basis || {}).kind || '', why: caseProcAiMask_(caseProcAiCut_(input.why || '', 120)), sure: input.sure || '', 결과: r && r.ok ? '확정 칸 고침 — ' + caseProcAiCut_(r.message || '', 100) : (r && r.needConfirm ? '세무사님 값 — 바꾸지 않음(여쭘)' : '실패 — ' + caseProcAiCut_((r && r.error) || '', 80)) });
      if (r && r.needConfirm) return { text: JSON.stringify({ ok: false, 반영: '바꾸지 않음(세무사님 값)', 지금값: r.prev, 이유: r.message, 할일: 'ask_user로 지금 값과 서류 값을 함께 여쭙고 끝낸다. 세무사님이 채팅으로 바꾸자고 하시면 채팅 넥스가 caseproc_fix 카드로 바꾼다.' }) };
      return { text: JSON.stringify(r) };
    }
    return { text: JSON.stringify(caseProcAiValueSetLive_(caseId, input, ctx)) };
  }
  if (name === 'close_question') {
    const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
    let r; try { r = caseProcDecide_(c0, { qids: (input.itemIds || []).map(String), d: input.decision || 'done', note: caseProcAiCut_(input.note || '', 200), by: '넥스' }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (r && r.closed && r.closed.length && ctx.lastItems) ctx.lastItems.forEach(function (it) { if (r.closed.indexOf(it.id) !== -1) it.closed = r.d; });
    ctx.decisions.push({ at: new Date().toISOString(), itemId: (input.itemIds || []).join(','), 칸: '질문 닫기', value: input.decision || 'done', basis: '', why: caseProcAiMask_(caseProcAiCut_(input.note || '', 120)), sure: '', 결과: r && r.ok ? '질문 ' + (r.closed || []).length + '건 닫음' : '실패 — ' + caseProcAiCut_((r && r.error) || '', 80) });
    return { text: JSON.stringify(r) };
  }
  if (name === 'calc_scenario') {
    const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
    let r; try { r = caseProcScenario_(c0, { tax: input.tax, name: caseProcAiCut_(input.name || '', 60), changes: Array.isArray(input.changes) ? input.changes.slice(0, 20) : [], input: input.input && typeof input.input === 'object' ? input.input : undefined, why: caseProcAiCut_(input.why || '', 200), by: '넥스' }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    ctx.decisions.push({ at: new Date().toISOString(), itemId: r && r.id ? String(r.id) : 'scenario', 칸: '경우(안) 계산', value: r && r.ok ? String(r.안) + ' ' + Number(r.최종세액 || 0).toLocaleString('ko-KR') + '원' : '', basis: 'calc', why: caseProcAiMask_(caseProcAiCut_(input.why || '', 120)), sure: '', 결과: r && r.ok ? '저장 ' + String(r.id) : '실패 — ' + caseProcAiCut_((r && r.error) || '', 100) });
    return { text: caseProcAiMask_(JSON.stringify(r)).slice(0, 4000) };
  }
  if (name === 'fact_map') { ctx.loop = ctx.loop || { maps: 0, finds: 0, hits: 0, gaps0: null, gapsN: null }; const fm = caseProcAiFactMap_(akReadCase_(caseId), ctx.lastItems || []); ctx.loop.maps++; if (ctx.loop.gaps0 == null) ctx.loop.gaps0 = fm.빈칸.length; ctx.loop.gapsN = fm.빈칸.length; return { text: caseProcAiMask_(JSON.stringify(fm)).slice(0, 5000) }; }
  if (name === 'doc_find') { ctx.loop = ctx.loop || { maps: 0, finds: 0, hits: 0, gaps0: null, gapsN: null }; const df = caseProcAiDocFind_(akReadCase_(caseId), input); ctx.loop.finds++; if (df.찾음) ctx.loop.hits++; return { text: caseProcAiMask_(JSON.stringify(df)).slice(0, 4000) }; }
  if (name === 'list_business_managers') return { text: JSON.stringify(toolListBusinessManagers()).slice(0, 12000) }; // 지침 하나 약 90자 — 지금 30여 개 3천 자, 대량 작성 중이라 넉넉히
  if (name === 'load_business_manager') return { text: JSON.stringify(toolLoadBusinessManager(input.name)).slice(0, 16000) }; // 지침 한 개 6~9KB — 사건 내용이 아니라 가리기 안 함
  if (name === 'search_tax_items') return { text: JSON.stringify(knhTaxItemsSearch_(input)).slice(0, 8000) }; // [2026.10.21] 절세 아이템(사건 내용 아님 — 가리기 안 함)
  if (name === 'read_tax_item') return { text: JSON.stringify(knhTaxItemRead_(input)).slice(0, 20000) };
  if (name === 'law_decisions') { const c0 = akReadCase_(caseId); return { text: JSON.stringify(typeof aiJudgeForNex_ === 'function' ? aiJudgeForNex_(input.query || '', c0 ? (CASEPROC_TAX_LABEL_[c0.세목] || '').replace(/소득세|세$/g, '') : '') : { 오류: '이 판에 없음' }).slice(0, 8000) }; }
  if (name === 'law_lookup' || name === 'law_search' || name === 'law_attach') return { text: caseProcAiMask_(JSON.stringify(caseProcAiLaw_(caseId, name, input, ctx))).slice(0, 6000) };
  // [2026.10.22 넥스가 주인] gas_run이 끝난 뒤엔 칸 채우기·계산·서식을 서버에서 다시 돌리지 않는다(칸 채우기 한 번이 2~3분 — 가상상속1 넥스 차례가 6분 한도에 닿음).
  //  세무사님 "읽은 걸 다시 읽는 것이 대조작업이냐?" — 질문은 GAS 한 바퀴 결과(ctx.lastItems), 넣은 값은 처리 끝에 화면이 칸 채우기 한 번·계산으로 반영
  if (ctx.gasItems && (name === 'calc_fill' || name === 'tax_calc' || name === 'forms_check')) {
    if (name !== 'calc_fill') return { text: JSON.stringify({ ok: true, 안내: '세액계산·서식 대조는 네가 끝낸 뒤 화면이 한다 — 부르지 않아도 된다' }) };
    const li = ctx.lastItems || [];
    return { text: caseProcAiMask_(JSON.stringify({ ok: true, 안내: 'GAS 한 바퀴(gas_run) 결과 그대로 — 칸 채우기를 다시 돌리지 않는다. 채운 값은 case_view·fact_map으로 보고, 네가 넣은 값은 처리 끝에 화면이 칸 채우기 한 번으로 반영한다.',
      질문수: li.length, 질문목록: li.map(function (it) { return it.id + ' | ' + it.kind + ' | ' + caseProcAiCut_(it.text, 60) + (it.ask && it.ask.aiJudge ? ' | AI 의견 있음' : ''); }) })).slice(0, 8000) };
  }
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
  const userOnly = CASEPROC_AI_USER_ONLY_RE_.test([input.itemId, it.text, (it.ask || {}).target, (it.ask || {}).label].join(' ')); // 칸 이름(target·라벨)까지 — 질문 글에 낱말이 없어도 막게
  // [밤샘 5번-5 — 실제 AI 3건에서 찾음] AI는 주민번호 등을 가린 꼴(850101-1******)로만 본다 — 가린 값을 넣으려 하면
  //  GAS가 그 질문 후보 중 가린 꼴이 같은 것 하나로 바꾼다(둘 이상이면 못 정함 → 의견으로). 원래 값은 AI에게 보이지 않는다
  if (/\*{3,}/.test(String(input.value))) {
    const mk = typeof cxMask_ === 'function' ? cxMask_ : caseProcAiMask_;
    const same = ((it.ask && it.ask.cands) || []).filter(function (q) { return q.v != null && mk(String(q.v)) === String(input.value); });
    if (same.length === 1) { input = Object.assign({}, input, { value: String(same[0].v), basis: (input.basis && input.basis.kind === 'doc') ? input.basis : { kind: 'cand' } }); }
  }
  // [2026.10.22] 거절 뒤 다시 내기 — 같은 값에 근거만 바꿔 한 칸에 한 번까지. 값을 바꾸어 다시 내는 것은 막는다(지어내기 방지 — 거절을 피하려 값을 맞추지 않게)
  ctx.rejected = ctx.rejected || {};
  const prevRej = ctx.rejected[input.itemId];
  if (prevRej) {
    if (caseProcAiNorm_(input.value) !== caseProcAiNorm_(prevRej.value)) return { ok: false, 반영: '거절', 이유: '이 질문은 앞서 「' + prevRej.value + '」로 거절됨 — 값을 바꾸어 다시 낼 수 없음(근거만 바꾸어 같은 값으로 한 번, 아니면 ask_user로)' };
    if (prevRej.n >= 2) return { ok: false, 반영: '거절', 이유: '이 질문은 이미 두 번 거절됨 — 더 내지 말고 ask_user 질문 메모로' };
  }
  const chk = caseProcAiCheckBasis_(c, input.value, input.basis, input.itemId, caseId);
  const bs = input.basis || {};
  // 다시 낸 것이 통과하면(또는 다시 거절되면) 앞서 붙인 "근거 대조 못 통과" 의견은 지운다 — 질문에 의견이 둘 붙지 않게
  if (prevRej) ctx.opinions = (ctx.opinions || []).filter(function (o) { return !(o.itemId === input.itemId && o.rejected); });
  if (bs.kind === 'infer') ctx.gaps.push({ want: '사실 목록·후보로 안 나오는 값을 추론함 — ' + caseProcAiCut_(it.text, 60), kind: '값을 안 돌려줌', tool: 'facts_find', auto: true });
  ctx.cxItems = ctx.cxItems || [];
  ctx.cxItems.push({ iid: input.itemId, topic: caseProcAiTopic_([input.itemId, it.text, (it.ask || {}).label, (it.ask || {}).target].join(' ')).topic, shape: '총괄|' + (bs.kind || '') + '|' + String((it.ask || {}).target || '').split(':')[0], target: (it.ask || {}).target || '', label: (it.ask || {}).label || caseProcAiCut_(it.text, 60),
    facts: '근거 ' + (bs.kind || '') + (bs.file ? ' · ' + bs.file : '') + (bs.page ? ' · ' + bs.page + '쪽' : '') + (bs.find ? ' · "' + bs.find + '"' : '') + (bs.quote ? ' · "' + String(bs.quote).slice(0, 120) + '"' : '') + (bs.id ? ' · 조회 ' + bs.id : '') + (Array.isArray(input.attach) && input.attach.length ? ' · 법령 근거 ' + input.attach.slice(0, 4).join(', ') : ''),
    cands: ((it.ask && it.ask.cands) || []).slice(0, 6).map(function (q) { return { v: q.v, src: String(q.src || '').slice(0, 100) }; }), answer: String(input.value), why: input.why || '', sure: input.sure || '', need: [] });
  const rec = { at: new Date().toISOString(), itemId: input.itemId, 칸: caseProcAiCut_(it.text, 80), value: caseProcAiMask_(String(input.value).slice(0, 80)), basis: (input.basis || {}).kind || '', why: why, sure: input.sure || '', 근거첨부: (Array.isArray(input.attach) ? input.attach : []).map(String).slice(0, 6) };
  if (!chk.ok) {
    rec.결과 = '거절 — ' + chk.why; ctx.decisions.push(rec);
    ctx.rejected[input.itemId] = { value: String(input.value), n: (prevRej ? prevRej.n : 0) + 1 };
    // [2026.10.22] 세무사님 "1.2고쳐라" ② — 거절된 판단도 그 질문 옆에 🤖 AI 의견으로(넣지 않음). 전엔 보고 글에만 남아 질문에 답할 때 AI가 어떻게 봤는지 안 보였다.
    //  특수관계·시가처럼 세무사님 답으로만 정하는 칸은 위에서 이미 걸러졌다(여기 오지 않음)
    ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: (why ? why + ' — ' : '') + '근거 대조 못 통과: ' + caseProcAiCut_(String(chk.why).split(' — ')[0], 60), sure: '근거 대조 못 통과', rejected: true });
    return { ok: false, 반영: '거절(질문에 AI 의견으로 붙임)', 이유: chk.why, 다시내기: chk.retry && !prevRej ? '같은 값으로 한 번 더 낼 수 있음(근거만 바꾸어)' : '' };
  }
  if (userOnly || input.sure !== '확실' || chk.provisional || input.dryRun) {
    rec.결과 = userOnly ? '세무사님 답으로만 — AI 의견으로 붙임' : '불확실·추론 — AI 의견으로 붙임';
    ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: input.sure || '불확실' });
    ctx.decisions.push(rec);
    return { ok: true, 반영: 'AI 의견(넣지 않음)', 이유: rec.결과 };
  }
  const a = it.ask || {};
  if (CASEPROC_AI_DRY_) { rec.결과 = '시험 — 근거 통과(넣었을 값, 실제로는 안 넣음)'; ctx.decisions.push(rec); return { ok: true, 반영: '시험 — 넣지 않음', 이유: rec.결과 }; }
  if (a.target && (!CASEPROC_AI_SCALAR_TARGET_RE_.test(a.target) || (/^ih(div)?:/.test(a.target) && !/^\d+$/.test(String(input.value).replace(/[,\s원]/g, ''))))) { rec.결과 = '값 하나로 넣을 수 없는 칸(' + a.target.split(':')[0] + ') — AI 의견으로'; ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: input.sure || '' }); ctx.decisions.push(rec); return { ok: true, 반영: 'AI 의견(이 칸은 AI가 직접 못 넣음)', 이유: rec.결과 }; }
  if (!a.target) { rec.결과 = '넣을 칸 정보가 없음 — AI 의견으로'; ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: '확실' }); ctx.decisions.push(rec); return { ok: true, 반영: 'AI 의견(넣을 칸 없음)', 이유: rec.결과 }; }
  let r;
  try { r = caseProc0_(Object.assign({ caseId: caseId, step: 'apply', target: a.target, value: input.value, src: ('🤖 AI 판단: ' + why).slice(0, 80), label: a.label || '', ans: { qid: it.id, how: 'AI 판단' } })); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
  rec.결과 = r && r.ok !== false ? '반영 — ' + caseProcAiCut_(r.message || '', 80) : '반영 실패 — ' + caseProcAiCut_((r && r.error) || '', 80);
  if (r && r.ok !== false) caseProcAiMarkApplied_(caseId, { iid: input.itemId, target: a.target, label: a.label || caseProcAiCut_(it.text, 60), v: String(input.value), by: 'ai', model: CASEPROC_AI_DIRECTOR_MODEL_, why: why, sure: '확실', tier: '총괄', cands: ((it.ask && it.ask.cands) || []).slice(0, 6) });
  ctx.decisions.push(rec);
  return { ok: !!(r && r.ok !== false), 반영: r && r.ok !== false ? '넣음(🤖 AI 판단)' : '실패', 이유: (r && (r.message || r.error)) || '', 근거대조: chk.why };
}

// [2026.10.21 넥스 하나로] 첫 글 = GAS 입구 요약 + 세무사님 말씀(채팅창 명령 문장 전체) + 같은 채팅창의 최근 대화 + 지난 처리 요약.
//  세무사님 원문: "같은 채팅창내에서의 대화는 어떤 ai라도 모두 공유하는 것으로 알고 있었다" — 예전엔 GAS 요약 한 장만 받아 "처리하자, 시가는 감정가로" 같은 덧붙인 말이 사라졌다.
//  화면이 보낸 body.userText(명령 문장)·body.chat([{role,text}] 최근 대화, 글만). 길이는 잘라서(대화 6천 자·지난 처리 2천 자) — 비용은 첫 차례 한 번, 이후 차례는 캐시.
// [2026.10.22 넥스가 주인] 첫 글 머리 — 사건 정보만(GAS는 아직 안 돌았다). 넥스가 gas_run부터 부른다
function caseProcAiNexEntry_(c) {
  return ['사건 ' + c.id + ' — ' + (CASEPROC_TAX_LABEL_[c.세목] || c.세목 || '') + ' · ' + (c.업무유형 || '') + ' · 기준일 ' + (c.기준일 || '?') + (c.사건명 ? ' · ' + c.사건명 : ''),
    '세무사님이 채팅창에서 이 사건을 너에게 맡기셨다. case_status로 세무사님이 어디까지 하셨는지부터 보고, 남은 일만 GAS 도구로 이어 간다.',
    caseProcAiAttachLine_(c),
    '비용 상한 ' + caseProcAiCap_(c).toLocaleString('ko-KR') + '원, 바퀴 상한 ' + CASEPROC_AI_MAX_ROUNDS_ + '.'].filter(Boolean).join('\n');
}
function caseProcAiFirstText_(c, body) {
  const L = [String(body.entry || '사건 ' + c.id + ' — 입구 요약 없음. calc_fill부터.')];
  const said = String(body.userText || '').trim();
  if (said) L.push('', '[세무사님 말씀 — 이 처리를 맡기며 채팅창에 쓰신 문장 그대로]', caseProcAiCut_(said, 1500));
  const chat = (Array.isArray(body.chat) ? body.chat : []).map(function (m) { return (m && m.role === 'user' ? '세무사님: ' : '넥스: ') + String((m && m.text) || '').replace(/\s+/g, ' ').trim(); }).filter(function (s) { return s.length > 6; });
  if (chat.length) {
    let txt = chat.join('\n'); if (txt.length > 6000) txt = '…(앞 생략)\n' + txt.slice(-6000);
    L.push('', '[같은 채팅창의 최근 대화 — 이 사건에 대한 세무사님 지시·답이 있으면 따른다]', txt);
  }
  let last = null;
  try { const sv = caseProcLoad_(c.id) || {}; const runs = Array.isArray(sv.aiLead) ? sv.aiLead : []; last = runs[runs.length - 1] || null; } catch (e) { last = null; }
  if (last) {
    const dec = (last.decisions || []).map(function (d) { return (d.itemId || d.칸 || '') + '=' + caseProcAiCut_(d.value || '', 30) + '(' + caseProcAiCut_(d.결과 || '', 20) + ')'; }).slice(0, 15);
    L.push('', '[지난 처리 요약 — ' + String(last.at || '').slice(0, 16).replace('T', ' ') + ', ' + (last.mode || '') + ']',
      (last.report ? caseProcAiCut_(last.report, 1500) : '(보고 없음)') + (dec.length ? '\n지난 판단: ' + dec.join(' · ') : '') + '\n지난 판단이 지금 칸 값과 다르면 세무사님이 고친 것이다 — 고친 값을 따르고 다시 넣지 않는다.');
  }
  return L.join('\n');
}

// [2026.10.21 넥스 하나로] 넥스가 GAS 질문 목록에 없는 것을 여쭐 때(ask_user에 itemIds 없이 note만) — 예전엔 화면 어디에도 안 떴다.
//  마지막 지휘 처리의 그런 질문을 처리개요 질문(메모형, 🤖 표시)으로 올린다. 답은 채팅창에 말로 — 같은 채팅 대화가 다음 처리 첫 글로 넥스에게 간다.
function caseProcAiNexAskItems_(c, r) {
  if (!r || !Array.isArray(r.items)) return 0;
  let last = null;
  try { const sv = caseProcLoad_(c.id) || {}; last = (Array.isArray(sv.aiLead) ? sv.aiLead : []).slice(-1)[0] || null; } catch (e) { last = null; }
  if (!last) return 0;
  let n = 0;
  (last.asks || []).forEach(function (a) {
    const note = String((a && a.note) || '').trim();
    if (!note || (a.ids || []).length) return;
    const id = 'nex:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, note, Utilities.Charset.UTF_8)).slice(0, 10);
    if (r.items.some(function (it) { return it.id === id; })) return;
    // [2026.10.27 E] 넣을 칸(target)·후보가 있으면 [확인]에 답 칸이 생긴다(mode input/choose — 그 칸에 바로 들어감). 없으면 note — 화면이 답 글을 받아 넥스에게 넘긴다("확인했음" 단추만 두지 않음)
    const cands = Array.isArray(a.cands) ? a.cands.filter(function (q) { return q && q.v !== '' && q.v != null; }) : [];
    const ask = a.target ? { mode: cands.length ? 'choose' : 'input', target: String(a.target), label: a.label || CASEPROC_FIX_LABELS_[a.target] || a.target, input: a.input === 'select' ? 'text' : (a.input || 'text'), cands: cands, nex: true } : { mode: 'note', nex: true, label: a.label || '넥스 질문' };
    r.items.push(caseProcItem_(id, 'judge', '🤖 넥스가 여쭙니다: ' + caseProcAiCut_(note, 300), ask, (a.urgent ? '계산을 막는 질문입니다. ' : '') + (a.target ? '[확인]에서 값을 고르거나 적으면 「' + ask.label + '」 칸에 바로 들어갑니다.' : '[확인]에서 답을 적으면 넥스가 받아 반영합니다.') + ' 채팅창에 말로 답하셔도 됩니다(' + String(last.at || '').slice(0, 10) + ' 사건 지휘에서 올림).'));
    n++;
  });
  return n;
}

// ---------- step 'turn' — 지휘 AI 한 차례 ----------
//  body: { caseId, messages: [이전 차례들 — 화면이 그대로 들고 옴], entry: 첫 차례 입구 요약, spent: 지금까지 쓴 원, round, items: 첫 차례에만 화면의 마지막 질문 }
// [2026.10.28 결함 L — 가상양도26 운영 확인] 세무사님이 "증여 폴더는 빼고 읽어라" 하셨는데 넥스가 읽고(case_files·file_read) 알고도 set_read_scope 없이 gas_run을 불러 GAS가 증여 서류 3개까지 읽음.
//  GAS 쪽 안전장치(0원): 말씀에 읽을 범위 지시(폴더·파일 + 빼고/제외/말고/만 읽어 류)가 있는데 이번 처리에서 set_read_scope가 안 불린 채 gas_run이 오면 돌리지 않고 "먼저 set_read_scope로"를 돌려준다
var CASEPROC_AI_SCOPE_SAID_RE_ = /(폴더|파일|서류|자료)[^\n]{0,30}(빼고|빼라|빼 ?줘|제외|말고|없이|만 ?읽|만 ?보|만으로|만 가지고|만 써)|(빼고|제외하고|말고)[^\n]{0,20}(읽|처리)|(만|만을) ?읽/;
function caseProcAiScopeSaid_(text) { const t = String(text || '').replace(/\s+/g, ' '); const m = CASEPROC_AI_SCOPE_SAID_RE_.exec(t); return m ? caseProcAiCut_(t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20), 120) : ''; }
function caseProcAiTurn_(body) {
  const t0 = Date.now();
  const caseId = String(body.caseId || '').trim();
  const c = akReadCase_(caseId);
  if (!c) return { error: '사건을 찾지 못했습니다.' };
  const cap = caseProcAiCap_(c), spent = Number(body.spent) || 0, round = Number(body.round) || 0;
  if (spent >= cap) return { ok: true, done: true, stop: 'cap', report: '비용 상한(' + cap.toLocaleString('ko-KR') + '원)에 닿아 여기서 멈춥니다. 남은 것은 지금 GAS 순서로 이어갑니다.', won: 0 };
  if (round >= CASEPROC_AI_MAX_ROUNDS_) return { ok: true, done: true, stop: 'rounds', report: '바퀴 상한(' + CASEPROC_AI_MAX_ROUNDS_ + ')에 닿아 여기서 멈춥니다.', won: 0 };
  // [2026.10.22 넥스가 주인] 끄는 스위치(AI_LEAD = 끄기)면 첫 차례에서 바로 — 화면은 GAS 한 바퀴만 돌고 계산·저장(AI 0원)
  if (round === 0) { try { if (String(PropertiesService.getScriptProperties().getProperty('AI_LEAD') || '') === '끄기') return { ok: true, off: true, done: true, why: 'AI 지휘 꺼짐(스크립트 속성 AI_LEAD = 끄기)', won: 0 }; } catch (e) {} }
  let ctx = round === 0 ? { lastItems: null, lookups: [], decisions: [], asks: [], opinions: [], gaps: [], attaches: [], subWon: 0 } : caseProcAiCtxLoad_(caseId);
  if (round === 0) { ctx.scopeSaid = caseProcAiScopeSaid_(body.userText) || caseProcAiScopeSaid_((Array.isArray(body.chat) ? body.chat : []).filter(function (m) { return m && m.role === 'user'; }).slice(-3).map(function (m) { return m.text; }).join('\n')); ctx.scopeSet = false; } // [2026.10.28 결함 L] 범위 말씀 기억
  if (Array.isArray(body.items)) { ctx.lastItems = caseProcAiSlimItems_(body.items); if (round > 0) ctx.gasItems = true; } // gas_run 뒤 차례에 화면이 그 칸 채우기 질문을 보낸다
  if (!body.entry) body.entry = caseProcAiNexEntry_(c);
  let messages = Array.isArray(body.messages) ? body.messages.slice() : [];
  if (!messages.length) messages = [{ role: 'user', content: caseProcAiMask_(caseProcAiFirstText_(c, body)) }];
  const subBefore = ctx.subWon || 0;
  const r = caseProcAiCall_(CASEPROC_AI_DIRECTOR_MODEL_, caseProcAiLiveSystem_(cap), caseProcAiLiveTools_(), caseProcAiCacheMark_(messages), 3000, 'medium');
  if (r.error) return { ok: false, error: r.error };
  const json = r.json, content = json.content || [];
  const uses = content.filter(function (b) { return b.type === 'tool_use'; });
  const results = [], calls = [], pending = [];
  uses.forEach(function (u) {
    let out;
    // [2026.10.28 결함 L] 세무사님이 읽을 범위를 말씀하셨는데 이번 처리에서 set_read_scope를 안 부른 채 gas_run → GAS를 돌리지 않고 되돌린다(0원). 화면·GAS가 말씀을 대신 해석하지 않는다 — 넥스가 읽고 판단해 콕 집어 줘야 함
    if (u.name === 'gas_run' && ctx.scopeSaid && !ctx.scopeSet) { calls.push(u.name + '(거절)'); ctx.gaps = ctx.gaps || []; results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify({ 오류: 'gas_run을 돌리지 않음 — 세무사님이 읽을 범위를 말씀하셨는데 아직 set_read_scope로 GAS에게 읽을 파일을 콕 집어 주지 않았다. 먼저 set_read_scope(ids 또는 on/off — 폴더·파일 이름 그대로)로 범위를 정한 뒤 gas_run을 다시 불러라.', 세무사님말: ctx.scopeSaid, 다시해도됨: true }) }); return; }
    if (CASEPROC_AI_CLIENT_TOOLS_.indexOf(u.name) !== -1) { pending.push({ id: u.id, name: u.name, input: u.input || {} }); calls.push(u.name); return; } // 화면이 실행하고 결과를 다음 차례에 붙인다
    if (Date.now() - t0 > CASEPROC_AI_TURN_BUDGET_MS_) out = { text: JSON.stringify({ 오류: '이번 차례 시간이 모자라 실행하지 못함 — 다음 차례에 다시 부르면 됨', 다시해도됨: true }) };
    else { try { out = caseProcAiLiveExec_(caseId, u.name, u.input, ctx); } catch (e) { out = { text: JSON.stringify({ 오류: '도구 실행 오류: ' + (e && e.message || e) }) }; } }
    const capLen = u.name === 'case_status' ? 7000 : (u.name === 'file_read' || u.name === 'case_files') ? 14000 : 6000; // [2026.10.28 속도 ⓑ] 첫 응답 6,000자 안 // [2026.10.28 속도 A①] 첫 응답 묶음은 6,000자에 잘리면 뜻이 없다
    results.push({ type: 'tool_result', tool_use_id: u.id, content: String(out.text || '').slice(0, capLen) });
    calls.push(u.name);
  });
  caseProcAiCtxSave_(caseId, ctx);
  const won = Math.round((r.won + (ctx.subWon || 0) - subBefore) * 10) / 10;
  const done = json.stop_reason !== 'tool_use' || !uses.length;
  return { ok: true, done: done, stop: json.stop_reason, assistant: content, toolResults: results, pending: pending, calls: calls, won: won, report: done ? caseProcAiMask_(caseProcAiText_(json)) : '', note: caseProcAiCut_(caseProcAiText_(json), 200),
    decisions: ctx.decisions, asks: ctx.asks, opinions: ctx.opinions, gaps: ctx.gaps, attaches: ctx.attaches || [], loop: ctx.loop || null, model: CASEPROC_AI_DIRECTOR_MODEL_, _ms: Date.now() - t0 };
}

// ---------- step 'finish' — 사건 기록(작업일지 한 줄 + 사건처리 저장) + 판단 기록(나중에 GAS로 옮길 재료, 개인정보 가림) ----------
function caseProcAiFinish_(body) {
  const caseId = String(body.caseId || '').trim();
  const c = akReadCase_(caseId);
  if (!c) return { error: '사건을 찾지 못했습니다.' };
  const ctx = caseProcAiCtxLoad_(caseId);
  const run = { at: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), 세목: c.세목, /* [2026.10.23 ㅅ14차] 예전 toISOString()은 세계시 — 새벽 지휘가 전날 날짜로 검토서 머리말에 붙었다("2026-10-22 사건 지휘", 가상양도17). [2026.10.28 속도 A] 이 주석이 // 라서 뒤의 업무유형·mode·won·rounds·stop이 기록에서 빠져 있었다 — 블록 주석으로 */ 업무유형: c.업무유형 || '', mode: String(body.mode || 'ai'), won: Number(body.won) || 0, rounds: Number(body.rounds) || 0, sec: Number(body.sec) || 0, calls: Number(body.calls) || 0, packed: !!ctx.packed, roundLog: Array.isArray(body.roundLog) ? body.roundLog.slice(0, 20).map(function (x) { return { n: Number(x.n) || 0, sec: Number(x.sec) || 0, tools: Array.isArray(x.tools) ? x.tools.slice(0, 8) : [], inChars: Number(x.inChars) || 0, won: Number(x.won) || 0 }; }) : [], stop: String(body.stop || ''), // [2026.10.28 속도 ⓐ] 왕복마다 초·도구·입력 글자 수 // [2026.10.28 속도 A] 왕복·초·도구 호출 수 — 다음 재기에 씀
    spots: (body.spots || []).slice(0, 30), tiers: body.tiers || null, tools: caseProcAiLiveTools_().map(function (t) { return t.name; }), decisions: (ctx.decisions || []).slice(0, 40), asks: (ctx.asks || []).slice(0, 20), opinions: (ctx.opinions || []).slice(0, 20), gaps: (ctx.gaps || []).slice(0, 20), attaches: (ctx.attaches || []).slice(0, 20), loop: ctx.loop || null, error: String(body.error || '').slice(0, 200),
    report: caseProcAiMask_(String(body.report || '').slice(0, 3000)) }; // [2026.10.21 넥스 하나로] 보고도 사건에 — 다음 처리 첫 글·검토서·채팅 넥스 조회가 읽는다
  try { caseProcPatch_(caseId, function (sv) { sv.aiLead = (Array.isArray(sv.aiLead) ? sv.aiLead : []).concat([run]).slice(-10); }); } catch (e) {}
  // [GAS 고도화 ①] 총괄 AI 판단을 2번 기록 모양(kind 'cx')으로 — 비용은 이번 지휘 비용을 판단 수로 나눠 붙임. 세무사님 수정은 다음 처리 때 2번 0) 단계가 붙인다
  if (run.mode === 'ai' && (ctx.cxItems || []).length) caseProcAiLogCx_(c, CASEPROC_AI_DIRECTOR_MODEL_, run.won / CASEPROC_AI_KRW_, ctx.cxItems, 1);
  // [GAS 고도화 ③] 빠진 도구 — AI가 남긴 것 + 자동으로 잡은 것(없는 도구를 부르려 함·추론 값)
  // [밤샘 1바퀴] 입수 구멍도 빠진 도구로 — 종류는 아는데 서류 규칙이 값을 못 뽑은 서류(사건 이름·파일 이름 없이 종류·장 수만)
  Object.keys(body.inGap || {}).forEach(function (k) { if (k.indexOf('(참고') !== 0) run.gaps.push({ want: '서류 규칙 보완 — ' + caseProcAiCut_(k, 30) + ' ' + (Number(body.inGap[k]) || 0) + '장: 종류는 아는데 값을 못 뽑음', kind: '값을 안 돌려줌', tool: '서류 규칙', auto: true }); });
  caseProcAiLogGaps_(c, run.gaps);
  try { CacheService.getScriptCache().remove(caseProcAiCtxKey_(caseId)); } catch (e) {}
  const applied = run.decisions.filter(function (d) { return /^반영 —/.test(d.결과 || ''); }).length;
  try {
    const line = run.mode === 'gas0' ? '[사건처리] AI 자리 없음 — AI 없이 끝(0원)' : '[사건처리 🤖 AI 지휘] 판단 ' + run.decisions.length + '개(넣음 ' + applied + ' · AI 의견 ' + run.opinions.length + ') · 질문 고름 ' + run.asks.length + (run.attaches.length ? ' · 법령·판례 첨부 ' + run.attaches.length + '건(미확인)' : '') + ' · 비용 ' + run.won + '원 · ' + run.rounds + '바퀴' + (run.stop && run.stop !== 'end_turn' ? ' · 멈춤: ' + run.stop : '');
    work_updateCase({ id: c.id, 작업일지: (Array.isArray(c.작업일지) ? c.작업일지 : []).concat([{ id: 'log_' + Date.now(), date: caseProcToday_(), text: line, dueDate: '' }]) });
  } catch (e) {}
  // 판단 기록 — 사건 이름 없이(세목·업무유형·칸·근거 종류·결과만) 모아 둔다. 되풀이되는 판단은 처음 보는 사건 2건 이상 확인 뒤 GAS 규칙 후보로
  try {
    withLock_(5000, function () {
      let folder = null; try { const pf = ai_paidLogFile_(), ps = pf.getParents(); folder = ps.hasNext() ? ps.next() : null; } catch (e) {}
      if (!folder) return;
      const it = folder.getFilesByName(CASEPROC_AI_LOG_NAME_), f = it.hasNext() ? it.next() : folder.createFile(CASEPROC_AI_LOG_NAME_, '[]', 'application/json');
      let arr = []; try { arr = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '[]'); } catch (e) { arr = []; }
      arr.push(JSON.parse(caseProcAiMask_(JSON.stringify({ at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 세목: run.세목, 업무유형: run.업무유형, mode: run.mode, won: run.won, rounds: run.rounds, stop: run.stop, tiers: run.tiers, tools: run.tools, loop: run.loop,
        spots: run.spots.map(function (s) { return (s.자리 || '') + '|' + (s.이유 || ''); }), decisions: run.decisions.map(function (d) { return { 칸: d.itemId, basis: d.basis, sure: d.sure, 근거첨부: d.근거첨부 || [], 결과: caseProcAiCut_(d.결과 || '', 40) }; }), attaches: run.attaches.map(function (a) { return a.제목; }), gaps: run.gaps }))));
      f.setContent(JSON.stringify(arr.slice(-3000)));
    });
  } catch (e) {}
  return { ok: true, applied: applied, decisions: run.decisions.length };
}

// ---------- [2026.10.19 법령] 첨부 자료 — 입구 요약 한 줄, 조문 보기·예규판례 찾기·첨부(토큰 0) ----------
function caseProcAiAttachLine_(c) {
  const a = (c.법령예규판례 || []).filter(function (e) { return e && e.category !== 'form'; }).slice(-12);
  return a.length ? '첨부된 자료 ' + a.length + '개(먼저 읽고 근거로 쓴다 — 조문 원문은 law_lookup): ' + a.map(function (e) { return '[' + e.category + '|' + e.id + '] ' + caseProcAiCut_(e.제목 || '', 50) + (e.쓸곳 ? ' · 쓸 곳 ' + caseProcAiCut_(e.쓸곳, 30) : '') + ' · ' + (e.첨부 === 'AI' ? 'AI 첨부' : '직접 첨부'); }).join(' / ')
    : '첨부된 자료 없음 — 쟁점 판단에 쓴 조문·예규는 law_lookup·law_search로 찾아 law_attach로 첨부한다.';
}
// 조문 결과(toolLookupStatuteArticle) → 관계법령 모양 글(<개정> 꼬리표 뺌, 줄 끝 두 칸 = 마크다운 줄바꿈 — 화면 📎 첨부와 같은 모양), hang을 주면 그 항만·나머지는 (생략)
function caseProcAiLawText_(r, hang) {
  const u = (r.조문 || [])[0]; if (!u) return '';
  const strip = function (s) { return String(s || '').replace(/\s*<\s*(개정|신설|전문개정|타법개정|본조신설)[^>]*>/g, '').trim(); };
  const hs = u.항 || [], num = function (h) { const m = String(h.항내용 || '').match(/^\s*(?:([①-⑳])|<(\d+)>)/); return !m ? 0 : m[1] ? m[1].charCodeAt(0) - 0x2460 + 1 : +m[2]; }; // 16항부터는 "<16>" 꼴
  const L = hs.length ? [] : [strip(u.조문내용)], ci = function (k) { return k > 15 ? '<' + k + '>' : String.fromCharCode(0x2460 + k - 1); };
  const last = hs.length ? num(hs[hs.length - 1]) : 0, h0 = Number(hang) || 0;
  if (h0 > 1) L.push((h0 > 2 ? '①~' + ci(h0 - 1) : '①') + ' (생략)');
  hs.forEach(function (h) {
    if (h0 && num(h) && num(h) !== h0) return;
    if (h.항내용) L.push(strip(h.항내용));
    (h.호 || []).forEach(function (o) { String(o).split('\n').forEach(function (x, j) { if (x.trim()) L.push((j && /^\s*[가-하]\./.test(x) ? '　　' : '　') + strip(x)); }); });
  });
  if (h0 && last > h0) L.push((last > h0 + 1 ? ci(h0 + 1) + '~' + ci(last) : ci(last)) + ' (생략)');
  return L.filter(Boolean).join('  \n') + '  ';
}
function caseProcAiYmd_(s) { const d = String(s || '').replace(/\D/g, ''); return d.length === 8 ? d.slice(0, 4) + '. ' + Number(d.slice(4, 6)) + '. ' + Number(d.slice(6, 8)) + '.' : String(s || ''); }
function caseProcAiLaw_(caseId, name, input, ctx) {
  const c = akReadCase_(caseId); if (!c) return { 오류: '사건을 찾지 못했습니다.' };
  const base = String(c.기준일 || '').replace(/\D/g, '').slice(0, 8);
  if (name === 'law_search') {
    const r = toolSearchTaxPrecedent(input.category, input.query);
    if (!r || r.error) return { 오류: (r && r.error) || '검색 실패' };
    // 첨부할 때 사건번호·일자를 붙이려고 찾은 목록을 기억해 둔다(토큰 0 — AI에게 다시 묻지 않음)
    const subOf = { precedent: ['사건번호', '선고일자', '법원명'], interpretation: ['안건번호', '회신일자', '질의기관'], administrative_rule: ['행정규칙종류', '발령일자', '소관부처'], tax_tribunal: ['청구번호', '의결일자', '재결구분명'], constitutional: ['사건번호', '종국일자'] }[input.category] || [];
    ctx.found = ctx.found || {};
    (r.results || []).forEach(function (it) { if (it && it.id) ctx.found[input.category + '|' + it.id] = subOf.map(function (k) { return it[k]; }).filter(Boolean).join(' · '); });
    return { 건수: r.totalCount || (r.results || []).length, 목록: (r.results || []).slice(0, 8) };
  }
  if (name === 'law_lookup' || (name === 'law_attach' && input.kind === 'statute')) {
    const r = toolLookupStatuteArticle(input.lawName, input.articleNo, base);
    if (!r || r.error) return { 오류: (r && r.error) || '조문 없음' };
    if (r.부칙) return { 법령: r.법령명, 판: r.판, 부칙: caseProcAiCut_(r.부칙.map(function (b) { return '부칙 <제' + (+b.공포번호) + '호, ' + b.공포일 + '>\n' + b.내용; }).join('\n\n'), 5000), 전체: r.전체 };
    const text = caseProcAiLawText_(r, name === 'law_attach' ? input.hang : 0), u = r.조문[0];
    if (name === 'law_lookup') return { 경고: r.경고 || undefined, 법령: r.법령명, 조: '제' + u.조문번호 + '조' + (u.조문제목 ? '(' + u.조문제목 + ')' : ''), 시행: r.시행일자, 출처: r.출처, 기준일: base || '없음(현행판)', 개정확인: r.개정확인 || '', 판주의: r.판주의 || undefined, 조문: caseProcAiCut_(text, 4500), 산식보정: u.산식보정 || [], 근거아님: u['검증필요_코드에서옮김(근거 아님)'] ? '이 조문 산식 중 코드에서 옮긴 것은 근거 아님' : '' };
    return caseProcAiAttachSave_(c, ctx, { category: 'statute', id: r.법령명 + '|' + u.조문번호 + '|' + (input.hang || ''), 제목: '「' + r.법령명 + '」 제' + String(u.조문번호).replace(/의/, '조의').replace(/^(\d+)$/, '$1조') + (input.hang ? '제' + input.hang + '항' : '') + (u.조문제목 ? '(' + u.조문제목 + ')' : ''),
      요약: caseProcAiCut_(text.replace(/\s+/g, ' '), 300), 법령명: r.법령명, 조: String(u.조문번호), 항: input.hang || '', 판: caseProcAiYmd_(r.시행일자), 기준일판: !!base, 주의: r.경고 || r.판주의 || undefined, 원문: text.slice(0, 6000) }, input); // [2026.10.20] 낡은 연혁 글 판이면 경고·판주의도 첨부에
  }
  if (name === 'law_attach') {
    if (!input.id) return { 오류: '예규·판례는 law_search 목록의 id가 필요합니다.' };
    let d = null; try { d = toolGetTaxPrecedentDetail(input.kind, input.id); } catch (e) { d = null; }
    const pickTxt = function (o) { const k = ['판결요지', '판시사항', '결정요지', '회답', '질의요지', '요지']; for (let i = 0; i < k.length; i++) if (o && o[k[i]]) return String(o[k[i]]); return ''; };
    return caseProcAiAttachSave_(c, ctx, { category: input.kind, id: String(input.id), 제목: caseProcAiCut_(input.title || (d && (d.사건명 || d.안건명 || d.행정규칙명 || d.제목)) || String(input.id), 120), 번호: ((ctx.found || {})[input.kind + '|' + input.id]) || (d && (d.사건번호 || d.안건번호 || d.청구번호)) || '', 요약: caseProcAiCut_(pickTxt(d).replace(/\s+/g, ' '), 400) }, input);
  }
  return { 오류: '모르는 도구' };
}
function caseProcAiAttachSave_(c, ctx, entry, input) {
  entry = Object.assign(entry, { 첨부: 'AI', 확인: false, 쓸곳: caseProcAiMask_(caseProcAiCut_(input.use || '', 60)), 이유: caseProcAiMask_(caseProcAiCut_(input.why || '', 120)), 첨부일: caseProcToday_() });
  const list = (c.법령예규판례 || []).filter(function (e) { return !(e.category === entry.category && e.id === entry.id); });
  const keep = (c.법령예규판례 || []).filter(function (e) { return e.category === entry.category && e.id === entry.id && e.첨부 !== 'AI'; })[0];
  if (keep) return { ok: true, 첨부: '이미 세무사님이 직접 첨부한 자료 — 그대로 둠', id: entry.id };
  if (CASEPROC_AI_DRY_) { ctx.attaches = (ctx.attaches || []).concat([{ id: entry.id, 제목: entry.제목, 쓸곳: entry.쓸곳 }]); return { ok: true, 첨부: '시험 — 저장 안 함', id: entry.id, 제목: entry.제목 }; }
  try { work_updateCase({ id: c.id, 법령예규판례: list.concat([entry]) }); } catch (e) { return { 오류: '첨부 저장 실패: ' + (e && e.message || e) }; }
  ctx.attaches = (ctx.attaches || []).concat([{ id: entry.id, 제목: entry.제목, 쓸곳: entry.쓸곳 }]);
  return { ok: true, 첨부: 'AI 첨부(미확인) — 세무사님이 법령 탭에서 확정하거나 뺀다', id: entry.id, 제목: entry.제목, 판: entry.판 || '' };
}

// 시험 전용 모델 부르기 — kind 'lead'(지휘 AI: 서버가 지침·도구를 붙임, 화면이 준 messages만) / 'sub'(좁은 판단·상위 판단: 물음·재료만)
function caseProcAiModelDry_(body) {
  // [2026.10.21 모델 맞추기 비교] 세무사님 "8번 모델 맞추기도 비교해서 진행하라" — 저비용 쟁점 묶음(cxCallAi_와 같은 지시문)을 고른 모델로 한 번(시험 — 기록·사건 쓰기 없음, 보내기 직전 가림)
  if (body.kind === 'cx') {
    const allow = [LIGHT_MODEL, 'claude-haiku-5-5', 'claude-sonnet-5-5'];
    if (allow.indexOf(body.model) === -1) return { ok: false, error: '비교 허용 모델이 아님: ' + body.model };
    // 생각 깊이(effort low/medium)·답 한도(3000~8000)도 바꿔 본다 — 하이쿠 5.5는 기본(생각 켬·medium)이면 3000 한도를 생각에 다 써 답이 잘렸다(10-21 첫 시험)
    const eff = /^(low|medium)$/.test(String(body.effort || '')) ? body.effort : undefined, mt = Math.min(8000, Math.max(3000, Number(body.maxTokens) || 3000));
    const r = caseProcAiCall_(body.model, CX_AI_SYSTEM_, null, [{ role: 'user', content: String(body.user || '').slice(0, 60000) }], mt, eff);
    if (r.error) return { ok: false, error: r.error };
    return { ok: true, text: caseProcAiText_(r.json), stop: r.json.stop_reason, usage: r.json.usage, won: r.won };
  }
  // [2026.10.21 모델 맞추기 비교] 대화창 넥스 — 넥스 기본 지시문+마스터 프로필, 지난 대화(글만)를 고른 모델로 한 번(도구 없음, 시험 — 기록·쓰기 없음, 보내기 직전 가림)
  if (body.kind === 'chat') {
    const allowC = [LIGHT_MODEL, 'claude-haiku-5-5', 'claude-sonnet-5', 'claude-sonnet-5-5'];
    if (allowC.indexOf(body.model) === -1) return { ok: false, error: '비교 허용 모델이 아님: ' + body.model };
    const msgs = (Array.isArray(body.messages) ? body.messages : []).filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; }).slice(-30);
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return { ok: false, error: '마지막 글은 세무사님 글이어야 합니다' };
    let master = ''; try { master = getMasterProfileText_() || ''; } catch (e) {}
    const cfgC = MODEL_CONFIG[body.model] || {};
    const effC = cfgC.thinkingMode === 'adaptive' ? (/^(low|medium|high)$/.test(String(body.effort || '')) ? body.effort : 'medium') : undefined;
    const r = caseProcAiCall_(body.model, DEFAULT_SYSTEM_PROMPT + (master ? '\n\n' + master : ''), null, msgs, 8000, effC);
    if (r.error) return { ok: false, error: r.error };
    return { ok: true, text: caseProcAiText_(r.json), stop: r.json.stop_reason, usage: r.json.usage, won: r.won };
  }
  if (body.kind === 'sub') { const m = body.model === CASEPROC_AI_HIGH_MODEL_ ? CASEPROC_AI_HIGH_MODEL_ : CASEPROC_AI_LIGHT_MODEL_; const r = caseProcAiSubJudge_(m, body.input || {}, m === CASEPROC_AI_LIGHT_MODEL_ ? 'low' : 'medium'); return { ok: true, text: r.text, won: r.won }; }
  const r = caseProcAiCall_(CASEPROC_AI_DIRECTOR_MODEL_, caseProcAiLiveSystem_(Number(body.cap) || 1000), caseProcAiLiveTools_(), caseProcAiCacheMark_(Array.isArray(body.messages) ? body.messages : []), 3000, 'medium');
  if (r.error) return { ok: false, error: r.error };
  return { ok: true, json: { content: r.json.content, stop_reason: r.json.stop_reason, usage: r.json.usage }, won: r.won };
}
// ---------- 입구 ----------
function caseProcAi_(body) {
  if (!body || !body.caseId) return { error: '사건이 필요합니다.' };
  // [2026.10.20 밤샘] 시험 모드(body.dry)는 서버에서 '모델 한 번 부르기'만 한다 — 사건을 읽지도 쓰지도 않고(사건 단계·도구는 PC 재현기가 사건 복사본으로),
  //  비용 기록·사용량 속성도 쓰지 않는다. 그 밖의 단계를 dry로 부르면 거절(서버에서 사건 단계가 도는 일을 막음)
  CASEPROC_AI_DRY_ = !!body.dry;
  if (CASEPROC_AI_DRY_) { try { return body.step === 'model' ? caseProcAiModelDry_(body) : { ok: false, error: '시험 모드는 모델 부르기(step model)만 — 사건 단계는 PC 재현기에서' }; } finally { CASEPROC_AI_DRY_ = false; } }
  try {
    if (body.step === 'spots') return caseProcAiSpots_(body);
    if (body.step === 'turn') return caseProcAiTurn_(body);
    if (body.step === 'finish') return caseProcAiFinish_(body);
    return { error: '모르는 단계: ' + body.step };
  } catch (e) { return { ok: false, error: 'AI 지휘 처리 오류: ' + (e && e.message || e) }; }
}
