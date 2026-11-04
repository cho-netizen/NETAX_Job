// Federation.js — AI 회의(2026-10-19 재편)·개발자↔사용자 소통·세액 2중 검증. 설명: docs/ai-federation.md
// =========================================================
// [2026.10.19] AI 연합체 → "AI 회의" 하나로 재편 — 세무사님 "이 방향으로 수정하자"(돌지 않는 것은 숨김이 아니라 삭제).
//  회의 틀 하나에 안건 두 종류: ⚖️ 법령 안건(판단 대기 — 회장 Claude=조정 세션), 🛠 시스템 안건(개선 후보 보고서·개정 감시 — 회장=주간 정비 루틴).
//  위원 = Gemini API(무료 등급 키, GEMINI_API_KEY). 키를 넣으면 위원이 늘어나는 자리 = OpenRouter 칸 하나.
//  지운 것: 무료 AI 3곳 다수결, AI 자문단 자동 수집·웹 AI 수동 붙여넣기(기록 파일 _AI자문.json은 남김), 웹 AI(B 등급) 명단, 키 없는 무료 칸·대기 항목.
//  고객 자료는 무료 등급(위원)으로 보내지 않는다 — aiLooksClientData_로 기계적으로 막음.
// =========================================================
var AI_SPECIALTIES_ = ['세법판단', '전략', '문서작성', '요약', '분류추출', '번역', '일반지식', '코딩·기술', '웹검색', '긴문서', '이미지생성', '영상생성', '음성합성', '자막', '편집'];
// keyProp: 스크립트 속성 이름(세무사님이 설정 🤝 카드 🔑에서 직접 넣음 — Claude는 계정·키를 만들거나 넣지 않음)
// dailyFree: 무료 일일 요청 한도(보수적으로 잡음 — 실제 한도는 각 서비스 안내 확인), clientData: 고객 자료 허용
var AI_REGISTRY_ = [
  // ---- Claude API(유료 — 고객 자료 허용, 데이터 학습 미사용 약관). AI 탭·전략 검토·세액 2중 검증 등 기존 배차 ----
  { id: 'claude-sonnet', tier: 'C', name: 'Claude Sonnet(API)', provider: 'claude', modelVar: 'DEFAULT_MODEL', keyProp: 'ANTHROPIC_API_KEY', clientData: true, specialties: ['세법판단', '문서작성', '전략', '코딩·기술'], speed: '보통', cost: '중' },
  { id: 'claude-haiku', tier: 'C', name: 'Claude Haiku(API)', provider: 'claude', modelVar: 'LIGHT_MODEL', keyProp: 'ANTHROPIC_API_KEY', clientData: true, specialties: ['요약', '분류추출', '문서작성'], speed: '빠름', cost: '저' },
  { id: 'claude-opus', tier: 'C', name: 'Claude Opus(API)', provider: 'claude', model: 'claude-opus-4-8', keyProp: 'ANTHROPIC_API_KEY', clientData: true, specialties: ['전략', '세법판단'], speed: '느림', cost: '고' },
  // ---- 위원(무료 등급 — 고객 자료 금지: 입력이 서비스 개선에 쓰일 수 있음) ----
  // id는 'gemini-paid' 그대로(회의 기록 _판단대기.json의 답 키·조정 세션 호출이 이 이름을 씀) — 표시만 바로잡음
  { id: 'gemini-paid', tier: 'A', name: 'Gemini API(무료 등급 — 고객 자료 금지)', provider: 'gemini', model: 'gemini-3.6-flash', keyProp: 'GEMINI_API_KEY', clientData: false, member: true, specialties: ['세법판단', '요약', '긴문서', '코딩·기술'], speed: '빠름', cost: '0', note: '세무사님이 Google AI Studio에서 무료로 받은 키 — 무료 등급은 구글이 입력을 서비스 개선에 쓰고 사람이 볼 수 있어 고객 자료는 보내지 않음' },
  { id: 'openrouter', tier: 'A', name: 'OpenRouter(키를 넣으면 위원 추가)', provider: 'openai', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'deepseek/deepseek-chat-v3-0324:free', keyProp: 'OPENROUTER_API_KEY', clientData: false, member: true, dailyFree: 50, specialties: ['일반지식', '코딩·기술', '요약'], speed: '보통', cost: '0' }
];
// 배차표 — 작업 종류 → 쓰는 AI 순서(앞이 우선), 예산 상한(원, 한 번), 고객자료 여부. 설명·통제용(실제로 도는 줄만 — 2026-10-19 정리)
var AI_DISPATCH_TABLE_ = {
  meeting_law: { label: '⚖️ AI 회의 — 법령 안건(판단 대기)', order: ['gemini-paid', 'openrouter', '회장: Claude(조정 세션)'], maxKrw: 0, clientData: false },
  meeting_system: { label: '🛠 AI 회의 — 시스템 안건(개선 후보 보고서·개정 감시)', order: ['gemini-paid', 'openrouter', '회장: 주간 정비 루틴'], maxKrw: 0, clientData: false },
  tax_judgment: { label: '세무 쟁점 판단', order: ['rules', 'claude-sonnet'], maxKrw: 400, clientData: true },
  strategy: { label: '🧠 전략 검토(AI 작업반장)', order: ['claude-opus', 'claude-sonnet'], maxKrw: 4000, clientData: true, maxRounds: 12 },
  report_judgment: { label: '보고서 판단 문단', order: ['claude-sonnet'], maxKrw: 400, clientData: true },
  report_proofread: { label: '보고서 맞춤법·문장 검토', order: ['claude-haiku'], maxKrw: 60, clientData: true },
  cross_check: { label: '최종 세액 2중 검증', order: ['engine', 'claude-sonnet'], maxKrw: 80, clientData: true }
};
function aiModelOf_(e) { return e.modelVar === 'DEFAULT_MODEL' ? DEFAULT_MODEL : e.modelVar === 'LIGHT_MODEL' ? LIGHT_MODEL : e.model; }
function aiHasKey_(e) { return !!(e.keyProp && PropertiesService.getScriptProperties().getProperty(e.keyProp)); }
function aiTodayKey_() { return 'AI_USE_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd'); }
function aiUsage_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(aiTodayKey_()) || '{}'); } catch (e) { return {}; } }
function aiUsageAdd_(id, n) {
  var p = PropertiesService.getScriptProperties(), u = aiUsage_();
  u[id] = (u[id] || 0) + (n || 1);
  p.setProperty(aiTodayKey_(), JSON.stringify(u));
  // 지난 날짜 기록은 정리(속성 개수 한도 보호)
  var keys = p.getKeys().filter(function (k) { return /^AI_USE_\d{8}$/.test(k) && k !== aiTodayKey_(); });
  keys.sort().slice(0, Math.max(0, keys.length - 7)).forEach(function (k) { p.deleteProperty(k); });
}
function aiHealth_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('AI_HEALTH') || '{}'); } catch (e) { return {}; } }
// 명단 + 지금 상태(키·오늘 사용량·마지막 점검)
function aiRegistryList_() {
  var use = aiUsage_(), h = aiHealth_();
  return AI_REGISTRY_.map(function (e) {
    var st = aiHasKey_(e) ? (h[e.id] && h[e.id].ok === false ? '오류' : '사용 가능') : '키 없음';
    return { id: e.id, tier: e.tier, name: e.name, model: aiModelOf_(e) || '', specialties: e.specialties, clientData: e.clientData, dailyFree: e.dailyFree || null, usedToday: use[e.id] || 0, speed: e.speed || '', cost: e.cost || '', status: st, member: !!e.member, note: e.note || '', keyProp: e.keyProp || '', health: h[e.id] || null, price: (typeof MODEL_CONFIG !== 'undefined' && MODEL_CONFIG[aiModelOf_(e)]) ? { in: MODEL_CONFIG[aiModelOf_(e)].input, out: MODEL_CONFIG[aiModelOf_(e)].output } : null };
  });
}
// 무료 API 요청 만들기(fetchAll용)
function aiBuildRequest_(e, prompt, maxTokens) {
  var key = PropertiesService.getScriptProperties().getProperty(e.keyProp);
  var model = aiModelOf_(e);
  if (e.provider === 'gemini') {
    return { url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens || 1200, temperature: 0.2 } }) };
  }
  if (e.provider === 'openai') {
    var h = { Authorization: 'Bearer ' + key };
    if (e.id === 'openrouter') { h['HTTP-Referer'] = 'https://job.netax.kr'; h['X-Title'] = 'NETAX job'; }
    return { url: e.endpoint, method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: h,
      payload: JSON.stringify({ model: model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 1200, temperature: 0.2 }) };
  }
  if (e.provider === 'claude') {
    return { url: 'https://api.anthropic.com/v1/messages', method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: model, max_tokens: maxTokens || 1200, messages: [{ role: 'user', content: prompt }] }) };
  }
  return null;
}
function aiParseResponse_(e, resp) {
  var code = resp.getResponseCode(), body = {};
  try { body = JSON.parse(resp.getContentText() || '{}'); } catch (x) { body = {}; }
  if (code !== 200) return { ok: false, error: (body.error && (body.error.message || body.error)) ? String(body.error.message || body.error).slice(0, 160) : 'HTTP ' + code };
  var text = '';
  if (e.provider === 'gemini') text = (((body.candidates || [])[0] || {}).content || {}).parts ? body.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('') : '';
  else if (e.provider === 'openai') text = (((body.choices || [])[0] || {}).message || {}).content || '';
  else if (e.provider === 'claude') { text = (body.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n'); try { ai_logDirect_(body, aiModelOf_(e), 'federation', '연합체 호출'); } catch (x) {} }
  // [2026.10.31] 제미니가 글 없이 끝나면 끝난 까닭(MAX_TOKENS 등)도 적는다 — "빈 응답"만으로는 원인을 몰랐다
  var why = e.provider === 'gemini' ? String((((body.candidates || [])[0] || {}).finishReason) || (body.promptFeedback && body.promptFeedback.blockReason) || '') : '';
  return text ? { ok: true, text: text } : { ok: false, error: '빈 응답' + (why ? '(' + why + ')' : '') };
}
// 여러 AI에 동시에 묻기(fetchAll) — 실패·한도 초과는 그 AI만 빠진다
function aiAskMany_(entries, prompt, maxTokens) {
  var reqs = [], used = [];
  entries.forEach(function (e) { var r = aiBuildRequest_(e, prompt, maxTokens); if (r) { reqs.push(r); used.push(e); } });
  if (!reqs.length) return [];
  var t0 = Date.now(), resps = UrlFetchApp.fetchAll(reqs), h = aiHealth_();
  var out = used.map(function (e, i) {
    var r = aiParseResponse_(e, resps[i]);
    aiUsageAdd_(e.id, 1);
    h[e.id] = { ok: r.ok, at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'MM-dd HH:mm'), error: r.ok ? '' : r.error };
    return { ai: e.id, name: e.name, ok: r.ok, text: r.text || '', error: r.error || '', ms: Date.now() - t0 };
  });
  PropertiesService.getScriptProperties().setProperty('AI_HEALTH', JSON.stringify(h));
  return out;
}
// 고객 자료로 보이는 글은 무료 등급으로 보내지 않는다(이름은 기계로 다 못 잡으므로 화면에서 "고객 정보 없음" 확인을 함께 받음)
// [2026.10.20] 정규식을 이름으로 뺐다(동작 같음) — 시스템 자기점검(SysAudit.js)이 지침 글을 무료 AI에 보내기 전 걸리는 부분만 [가림]으로 바꿀 때 같은 기준을 쓴다
var AI_CLIENT_DATA_RE_ = /\d{6}\s*-\s*[1-4]\d{6}|\d{6}\s*-\s*[1-4]\*{6}|01[016789]-?\d{3,4}-?\d{4}|\d{3,6}-\d{2,6}-\d{4,8}|[가-힣]+(동|로|길)\s*\d+(-\d+)?\s*(번지)?\s*\d*호?|사건번호|고객명|납세자명/;
function aiLooksClientData_(t) {
  t = String(t || '');
  return AI_CLIENT_DATA_RE_.test(t);
}

// ---- [2026.10.19 멀티 AI 사이드바] 세무사님 "이 ai연합체를 시스템업그레이드와 법령검색 양쪽에 활용하자", "일단 api없이 해보고"
// 화면(질문지 만들기·복사·사이트 열기·답 붙여넣기·근거 실재 확인·비교표)은 앱 전용(app-only/multiai.html·judgewait.html). 서버는 판단 대기 파일 읽기·저장과 API 칸 묻기만.
var AI_JUDGE_FILE_ = '_판단대기.json'; // 드라이브 0 NETAX/업무관리자/법령/(시스템 전용 — 이름 앞 _). 만듦: netax-inventory/maps/법령도구/판단대기_만들기.js
function aiJudgeFile_() {
  var g = function (p, n) { var it = p && p.getFoldersByName(n); return it && it.hasNext() ? it.next() : null; };
  var d = g(g(getNetaxRootFolder_(), '업무관리자'), '법령'), it = d && d.getFilesByName(AI_JUDGE_FILE_);
  return it && it.hasNext() ? it.next() : null;
}
function aiJudgeGet_() {
  var f = aiJudgeFile_(); if (!f) return { error: '드라이브 업무관리자/법령/' + AI_JUDGE_FILE_ + '이 없습니다.' };
  try { return { success: true, doc: JSON.parse(f.getBlob().getDataAsString('UTF-8')) }; } catch (e) { return { error: '판단 대기 파일을 읽지 못했습니다: ' + e.message }; }
}
// [2026.10.21] 넥스가 읽는 AI 회의 법령 안건 — 세무사님 "ai회의 결론을 넥스가 보도록 하라". 결정된 것은 결론·메모·근거, 아직이면 "판단 대기"(넥스가 단정하지 않게).
//  q가 있으면 제목·설명·조문에 그 낱말이 든 쟁점만. 답(AI별 글)은 싣지 않는다(결정 전 AI 의견을 결론처럼 쓰지 않게).
function aiJudgeForNex_(q, 세목) {
  var r = aiJudgeGet_(); if (!r || !r.doc) return { 오류: (r && r.error) || '판단 대기 파일을 읽지 못함' };
  var words = String(q || '').split(/[\s,·]+/).filter(function (w) { return w.length >= 2; });
  var items = (r.doc.항목 || []).filter(function (x) {
    if (세목 && x.세목 && String(x.세목).indexOf(세목) < 0) return false;
    if (!words.length) return true;
    var hay = [x.제목, x.설명, JSON.stringify(x.조문 || '')].join(' ');
    return words.some(function (w) { return hay.indexOf(w) >= 0; });
  }).slice(0, 15).map(function (x) {
    var d = x.결정 || null, st = x.상태 || (d ? (d.선택 === '보류' ? '보류' : '결정') : '판단 대기');
    return { id: x.id, 세목: x.세목 || '', 제목: x.제목 || '', 상태: st, 결정: d && st === '결정' ? { 선택: d.선택, 내용: d.내용 || '', 메모: d.메모 || '', 근거: d.근거 || [], 때: d.때 || '' } : null };
  });
  return { 안내: '상태가 "결정"인 것만 세무사님 결론 — 그대로 따른다. "판단 대기"·"보류"는 결론이 아니다: 같은 쟁점을 답할 때 "세무사님 판단 대기 중인 쟁점"이라고 밝히고 단정하지 않는다.', 전체: (r.doc.항목 || []).length, 항목: items };
}
// 쟁점 하나에 답(AI별)·근거 확인·결정·첨부를 덧붙인다. 엔진은 고치지 않는다(결정 목록을 조정·서식 세션이 보고 고침).
function aiJudgeSave_(body) {
  var id = String(body && body.id || '');
  return withLock_(10000, function () {
    var f = aiJudgeFile_(); if (!f) return { error: '판단 대기 파일이 없습니다.' };
    var doc = JSON.parse(f.getBlob().getDataAsString('UTF-8')), x = (doc.항목 || []).filter(function (i) { return i.id === id; })[0];
    if (!x) return { error: '쟁점을 찾지 못했습니다: ' + id };
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), log = function (s) { x.기록 = (x.기록 || []).concat([{ 때: now, 무엇: s }]).slice(-80); };
    var a = body.answer;
    if (a && a.ai) {
      x.답 = x.답 || {};
      if (a.text) { x.답[a.ai] = { 이름: a.name || a.ai, 글: String(a.text).slice(0, 12000), 결론: a.결론 || '', 근거: a.근거 || [], 방식: a.방식 || '붙여넣기', 때: now }; log((a.name || a.ai) + ' 답(' + (a.방식 || '붙여넣기') + ')' + (a.결론 ? ' 결론 ' + a.결론 : '')); }
      else if (x.답[a.ai]) { delete x.답[a.ai]; log((a.name || a.ai) + ' 답 지움'); }
    }
    if (body.check && x.답 && x.답[body.check.ai]) x.답[body.check.ai].근거 = body.check.근거 || [];
    var d = body.decision;
    if (d) {
      x.결정 = d.선택 ? { 선택: d.선택, 내용: d.내용 || '', 메모: String(d.메모 || '').slice(0, 2000), 다수: d.다수 || '', 근거: d.근거 || [], 누가: d.누가 || '세무사님', 때: now } : null;
      x.상태 = !d.선택 ? '판단 대기' : d.선택 === '보류' ? '보류' : '결정';
      log(d.선택 ? (d.누가 || '세무사님') + ' 결정 ' + d.선택 + (d.내용 ? ' — ' + d.내용 : '') : '결정 취소');
    }
    if (body.attach && body.attach.length) {
      var add = [].concat(body.attach);
      x.첨부 = (x.첨부 || []).filter(function (e) { return !add.some(function (n) { return n.category === e.category && n.id === e.id; }); }).concat(add);
      log('실재 확인된 근거 첨부 ' + add.length + '건');
    }
    doc.고친때 = now;
    f.setContent(JSON.stringify(doc, null, 1));
    return { success: true, item: x };
  });
}
// API 칸 묻기 — A 무료(키 있을 때)·C 유료(Claude·Gemini — 화면에서 켠 칸만, 기본 꺼짐). 웹 AI(B)는 약관상 자동 질의 금지라 여기서 다루지 않는다.
// head = 쟁점·질문(고객 자료 검사 그대로), law = 정비본 조문 원문(공개 법령이라 "…으로 1년" 같은 주소 꼴 오탐을 피해 주민번호·전화·계좌 꼴만 검사)
function aiAskSlots_(body) {
  var ids = [].concat(body && body.ids || []), head = String(body && body.head || ''), law = String(body && body.law || '');
  if (!ids.length || !head.trim()) return { error: '보낼 AI와 질문이 필요합니다.' };
  if (aiLooksClientData_(head) || /\d{6}\s*-\s*[1-4]\d{6}|01[016789]-?\d{3,4}-?\d{4}|\d{3,6}-\d{2,6}-\d{4,8}/.test(law)) return { error: '주민번호·전화·계좌·상세주소처럼 고객 자료로 보이는 내용이 있어 보내지 않았습니다.' };
  var list = AI_REGISTRY_.filter(function (e) { return ids.indexOf(e.id) !== -1 && (e.tier === 'A' || (e.tier === 'C' && /^(claude|gemini)$/.test(e.provider))) && aiHasKey_(e); });
  if (!list.length) return { error: '보낼 수 있는 API 칸이 없습니다(키 없음).' };
  return { success: true, answers: aiAskMany_(list, head + (law ? '\n\n' + law : ''), Number(body.maxTokens) || 1500) };
}

// ---- 무료 API 상태 점검(매일 밤, 0원) — 키·모델 존재만(모델 목록 조회는 토큰 무과금). 유료 Claude·Gemini 모델 점검은 EnvWatch.js(envTechCheck_)가 한다. ----
function aiNightlyHealth_() {
  var p = PropertiesService.getScriptProperties(), h = aiHealth_(), at = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  var get = function (url, headers) { try { var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: headers || {} }); return { code: r.getResponseCode(), body: JSON.parse(r.getContentText() || '{}') }; } catch (e) { return { code: 0, body: {} }; } };
  AI_REGISTRY_.filter(function (e) { return e.tier === 'A' && e.keyProp && (e.provider === 'gemini' || e.provider === 'openai'); }).forEach(function (e) {
    var key = p.getProperty(e.keyProp); if (!key) return;
    var r = e.provider === 'gemini' ? get('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key)) : get(e.endpoint.replace(/\/chat\/completions$/, '/models'), { Authorization: 'Bearer ' + key });
    var models = (r.body.models || r.body.data || []).map(function (m) { return String(m.name || m.id || '').replace(/^models\//, ''); });
    var ok = r.code === 200 && (!models.length || models.indexOf(e.model) !== -1);
    h[e.id] = { ok: ok, at: at, error: r.code !== 200 ? '키·연결 확인(' + r.code + ')' : ok ? '' : '모델 ' + e.model + ' 없음 — 명단 갱신 필요' };
  });
  p.setProperty('AI_HEALTH', JSON.stringify(h));
  return { at: at, health: h };
}


// ---- 개발자↔사용자 소통 ----
// ① 최근 바뀐 기능(📥 반영·PC 배포 때 기록) — job AI 지시문과 대시보드 "새 기능" 카드에 쓴다
function commRecordChanges_(fromSha) {
  try {
    var feed = gh_feed_(), idx = fromSha ? feed.map(function (x) { return x.sha; }).indexOf(fromSha) : -1;
    var fresh = (idx === -1 ? feed.slice(0, 10) : feed.slice(0, idx)).map(function (x) { return { at: String(x.at).slice(0, 10), sha: x.sha.slice(0, 7), msg: x.msg }; });
    if (!fresh.length) return;
    var p = PropertiesService.getScriptProperties(), cur = [];
    try { cur = JSON.parse(p.getProperty('NX_RECENT_CHANGES') || '[]'); } catch (e) { cur = []; }
    var have = {}; cur.forEach(function (c) { have[c.sha] = 1; });
    var limit = Utilities.formatDate(new Date(Date.now() - 30 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
    cur = fresh.filter(function (c) { return !have[c.sha]; }).concat(cur).filter(function (c) { return c.at >= limit; }).slice(0, 40);
    p.setProperty('NX_RECENT_CHANGES', JSON.stringify(cur));
    // 반영된 커밋에 [요청#ID]가 있으면 그 요청을 "반영됨"으로
    var ids = {}; fresh.forEach(function (c) { (String(c.msg).match(/요청#([A-Za-z0-9-]+)/g) || []).forEach(function (t) { ids[t.replace('요청#', '')] = c.sha; }); });
    if (Object.keys(ids).length) commSetRequestStatus_(ids, '반영됨');
  } catch (e) { /* 기록 실패는 배포를 막지 않음 */ }
}
function commRecentChanges_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('NX_RECENT_CHANGES') || '[]'); } catch (e) { return []; } }
// job AI 지시문 정적부에 넣을 짧은 글(최근 8건)
function commRecentChangesPrompt_() {
  var c = commRecentChanges_().slice(0, 8);
  if (!c.length) return '';
  return '\n\n[최근 바뀐 job 기능 — 사용자가 물으면 이 기능을 안내하라(코드 용어 없이)] ' + c.map(function (x) { return x.at.slice(5) + ' ' + String(x.msg).replace(/\s*Co-Authored-By.*$/i, '').slice(0, 90); }).join(' / ');
}
// ② 요청 상태 수명주기: 접수 → (PR) → 반영됨 → 확인완료 / 재오픈
function commRequestsLoad_() {
  var chief = getChiefManagerFolder_();
  if (!chief) return { folder: null, tracking: { entries: [] } };
  var tr = {};
  try { tr = JSON.parse(readFileIfExists_(chief, IMPROVEMENT_TRACKING_FILE) || '{}'); } catch (e) { tr = {}; }
  tr.entries = tr.entries || [];
  tr.entries.forEach(function (x) {
    if (!x.id) x.id = 'R' + String(x.at || '').replace(/\D/g, '').slice(2, 12);
    if (!x.status) x.status = '접수';
    if (x.urgent === undefined) x.urgent = /긴급|급함|급해|빨리|당장/.test(x.text || '');
  });
  return { folder: chief, tracking: tr };
}
// [2026.10.20] 세무사님 "개선요구사항을 언제 조치하고 지우나? 계속 누적관리하나?" — 원장(개선요구사항.md)은 덧붙이기만,
// 상태 기록(_개선요구사항_처리기록.json)은 끝나지 않은 요청(접수·재오픈·반영됨)을 날짜·개수와 상관없이 끝까지 남기고,
// 세무사님이 👍 확인한 오래된 것만 줄인다. 예전엔 기록을 30건만 남기고(.slice(-30)) 보고서는 8일 안 요청만 담아, 10-11 요청이 10-19부터 루틴에서 빠졌다.
var COMM_REQ_DONE_KEEP_ = 40;               // 👍 확인완료는 최근 40건만 남김(원장에는 그대로 있음)
var COMM_REQ_RESTORE_SINCE_ = '2026-10-09'; // 원장 대조로 되살리는 범위 — 이날부터 루틴이 요청을 직접 처리(그 전은 옛 AI 메모 방식)
function commTrimEntries_(entries) {
  var done = 0;
  entries.forEach(function (x) { if (x.status === '확인완료') done++; });
  var drop = Math.max(0, done - COMM_REQ_DONE_KEEP_);
  return entries.filter(function (x) { if (x.status === '확인완료' && drop > 0) { drop--; return false; } return true; });
}
function commReqNorm_(s) { return String(s || '').replace(/^\s*-\s*\[\d{4}-\d{2}-\d{2}[^\]]*\]\s*/gm, '').replace(/\s+/g, ''); }
// 원장의 "- [yyyy-MM-dd HH:mm] 내용" 항목들
function commLedgerItems_(md) {
  return String(md || '').replace(/\r\n/g, '\n').split(/\n(?=-\s*\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\])/).map(function (b) {
    var m = b.match(/^-\s*\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]\s*([\s\S]*)$/);
    return m ? { at: m[1], text: m[2].replace(/\n  /g, '\n').trim() } : null;
  }).filter(function (x) { return x && x.text; });
}
// 상태 기록에서 빠진 원장 요청을 "접수"로 되살린다(30건 자르기로 잃은 것). 되살린 개수를 돌려준다.
function commReconcile_(st, ledgerMd) {
  if (!st.folder) return 0;
  var md = ledgerMd != null ? ledgerMd : (readFileIfExists_(st.folder, '개선요구사항.md') || '');
  var all = st.tracking.entries.map(function (x) { return commReqNorm_(x.text); }).join('|');
  var ids = {}; st.tracking.entries.forEach(function (x) { ids[x.id] = 1; });
  var added = 0;
  commLedgerItems_(md).forEach(function (it) {
    if (it.at.slice(0, 10) < COMM_REQ_RESTORE_SINCE_) return;
    var key = commReqNorm_(it.text).slice(0, 40);
    if (!key || all.indexOf(key) >= 0) return;
    var base = 'R' + it.at.replace(/\D/g, '').slice(2, 12), id = base, n = 2;
    while (ids[id]) id = base + '-' + (n++);
    ids[id] = 1;
    st.tracking.entries.push({ id: id, at: it.at, text: it.text.slice(0, 4000), status: '접수', urgent: /긴급|급함|급해|빨리|당장/.test(it.text), restored: true });
    added++;
  });
  return added;
}
function commReqDays_(x) { var t = improve_parseAt_(x.firstAt || x.at); return t ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0; }
// 끝나지 않은 요청 전부(오래된 순) + 최근 확인완료 15건. 되살린 것이 있으면 저장까지.
function commRequestsAll_() {
  var st = commRequestsLoad_();
  if (st.folder && commReconcile_(st)) { try { commRequestsSave_(st); } catch (e) {} }
  var pick = function (x) { return { id: x.id, at: x.firstAt || x.at, text: String(x.text || '').slice(0, 400), status: x.status, statusAt: x.statusAt || '', urgent: !!x.urgent, commit: x.commit || '', ver: x.ver || '', days: commReqDays_(x), reopenNote: x.reopenNote || '', restored: !!x.restored, history: (x.history || []).slice(-12) }; };
  var open = st.tracking.entries.filter(function (x) { return x.status !== '확인완료'; }).map(pick)
    .sort(function (a, b) { return improve_parseAt_(a.at) - improve_parseAt_(b.at); });
  var done = st.tracking.entries.filter(function (x) { return x.status === '확인완료'; }).slice(-15).reverse().map(pick);
  return { open: open, done: done };
}
function commRequestsSave_(st) { writeFileOverwrite_(st.folder, IMPROVEMENT_TRACKING_FILE, JSON.stringify(st.tracking), 'application/json'); }
// [2026.10.28] 처리 내역 — 세무사님 "처리가 되었으면서 거기에 남아있는것도 이해가 되지 않고, 각각 어떻게 처리되었는지 확인할 수도 없다".
//  요청마다 history[{at, who, what, commit, ver}]를 쌓아 화면(대시보드 개선요구 카드·설정 📝 요청 상태)에서 펼쳐 본다. 어느 길로 고쳐졌든 한 줄은 남는다:
//  ① 주간 루틴 수정안·커밋 제목 [요청#R…] → 📥·PC 배포 때 commSetRequestStatus_  ② PC Claude가 대화에서 고침 → tools/request-done.js(comm_request_done)
//  ③ 배포(deployRecord_) 때 commAfterDeploy_가 "고침(배포 대기)"을 "반영됨"으로 바꾸고 운영 판 번호를 붙임  ④ 세무사님 👍 확인 / ↩ 다시 요구(commRequestConfirm_)
function commHistPush_(x, who, what, commit, ver) {
  x.history = (x.history || []).concat([{ at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), who: String(who || '').slice(0, 40), what: String(what || '').slice(0, 600), commit: String(commit || '').slice(0, 12), ver: ver ? String(ver) : '' }]).slice(-30);
}
function commSetRequestStatus_(idMap, status) {
  var st = commRequestsLoad_();
  if (!st.folder) return;
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), hit = false;
  st.tracking.entries.forEach(function (x) { if (idMap[x.id] && x.status !== '확인완료') { x.status = status; x.statusAt = now; x.commit = idMap[x.id]; commHistPush_(x, '개발자 수정안', '커밋 제목에 [요청#' + x.id + '] — 📥 반영됨', idMap[x.id], ''); hit = true; } });
  if (hit) commRequestsSave_(st);
}
// PC Claude(대화 세션)가 요청을 고쳤을 때 — tools/request-done.js. deployed=true면 이미 운영에 있는 것(소급 기록), 아니면 "고침(배포 대기)" → 다음 배포 때 반영됨
function commRequestDone_(body) {
  var id = String(body && body.id || '').trim(), what = String(body && body.what || '').trim();
  if (!id || !what) return { error: '요청 번호(id)와 고친 내용(what)이 필요합니다.' };
  return withLock_(10000, function () {
    var st = commRequestsLoad_(), x = st.tracking.entries.filter(function (e) { return e.id === id; })[0];
    if (!x) return { error: '요청 ' + id + '을(를) 찾지 못했습니다.' };
    var deployed = !!(body && body.deployed), ver = String(body && body.ver || '');
    x.status = deployed ? '반영됨' : '고침';
    x.statusAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    if (body && body.commit) x.commit = String(body.commit).slice(0, 12);
    if (ver) x.ver = ver;
    commHistPush_(x, String(body && body.who || 'PC Claude'), what + (deployed ? '' : ' (배포 대기)'), body && body.commit, ver);
    commRequestsSave_(st);
    improveReportRebuildLater_(); // [2026.11.03] 저장 잠금 안에서 보고서 전체를 다시 만들지 않음(Code.js improveReportRebuildLater_)
    return { success: true, status: x.status };
  });
}
// 배포(📥·PC) 기록 때 — "고침(배포 대기)"은 "반영됨"으로, 운영 판 번호 없는 반영됨엔 판 번호를
function commAfterDeploy_(ver, sha) {
  var st = commRequestsLoad_();
  if (!st.folder) return;
  var hit = false, now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  st.tracking.entries.forEach(function (x) {
    if (x.status === '고침') { x.status = '반영됨'; x.statusAt = now; x.ver = ver ? String(ver) : x.ver || ''; commHistPush_(x, '배포', '운영 반영 — 확인해 주세요', String(sha || '').slice(0, 7), ver); hit = true; }
    else if (x.status === '반영됨' && !x.ver && ver) { x.ver = String(ver); hit = true; }
  });
  if (hit) commRequestsSave_(st);
}
function commRequestConfirm_(body) {
  var id = String(body && body.id || ''), ok = !!(body && body.ok), note = String(body && body.note || '').trim();
  return withLock_(10000, function () {
    var st = commRequestsLoad_(), x = st.tracking.entries.filter(function (e) { return e.id === id; })[0];
    if (!x) return { error: '요청을 찾지 못했습니다.' };
    if (!ok && !note) return { error: '무엇이 부족한지 적어 주세요.' };
    x.status = ok ? '확인완료' : '재오픈';
    x.statusAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    if (!ok) { x.reopenNote = note.slice(0, 1000); x.firstAt = x.firstAt || x.at; x.at = x.statusAt; } // 재오픈은 날짜를 새로 — 다음 보고서에 다시 실린다
    commHistPush_(x, '세무사님', ok ? '👍 확인 — 끝' : '↩ 다시 요구: ' + note, '', '');
    commRequestsSave_(st);
    improveReportRebuildLater_(); // [2026.11.03] 👍·↩ 단추가 몇 분 걸리던 것 — 보고서는 1분 뒤 뒤에서
    return { success: true, status: x.status };
  });
}
// ③ 기능 부족 신고(job AI 도구 report_capability_gap) — 고객 값 없이
var COMM_GAPS_FILE_ = '_기능부족신고.json';
function commGapsFile_() { var f = ai_convFolder_(), it = f.getFilesByName(COMM_GAPS_FILE_); return it.hasNext() ? it.next() : f.createFile(COMM_GAPS_FILE_, '[]', 'application/json'); }
function commReportGap_(input) {
  input = input || {};
  var clean = function (s, n) { s = String(s || '').replace(/\d{6}\s*-\s*\d{7}/g, '[주민번호]').replace(/01[016789]-?\d{3,4}-?\d{4}/g, '[전화]'); return s.slice(0, n); };
  var e = { at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), want: clean(input.userWanted, 300), blocker: clean(input.whyBlocked, 300), needTool: clean(input.neededTool, 200), area: clean(input.area, 40) };
  if (!e.want) return { error: 'userWanted가 필요합니다.' };
  // [2026.10.22] 세무사님 "코드는 지금 고쳐 두고 … 다음 진행하자" — 세액·신고 결과가 틀리는 신고는 "급함": 개선요구사항에 🚨 긴급으로도 올려
  //  대시보드 맨 위·주간 보고서 맨 위·처리 상태(접수→반영됨→확인)를 기존 장치로 따라가게 한다(일반 신고처럼 한 주 줄 서지 않게).
  if (input.urgent === true) e.urgent = true;
  var res = withLock_(5000, function () {
    var f = commGapsFile_(), arr = [];
    try { arr = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '[]'); } catch (x) { arr = []; }
    arr.push(e); f.setContent(JSON.stringify(arr.slice(-200)));
    // [2026.10.22] 전에 고친 신고와 같은 것이면 넥스에게 고친 내용을 알려 다시 시도하게(다시 신고로 표시돼 개발자가 먼저 봄)
    var before = null; try { before = commGapStatus_({ want: e.want, at: '9999' }, commGapsResolved_()).처리; } catch (x) { before = null; }
    if (before) return { success: true, message: '개발자에게 "고쳤는데 다시 막힘"으로 전달했습니다. 전에 이렇게 고쳤다고 기록돼 있습니다 — ' + String(before.처리 || '').slice(0, 300) + ' 그 방법대로 한 번 다시 해 보고, 그래도 안 되면 사용자에게 "개발자에게 알렸다"고 짧게 말하라.' };
    return { success: true, message: '개발자(주간 정비 루틴)에게 전달했습니다. 사용자에게 "기능 부족을 개발자에게 알렸다"고만 짧게 말하라.' };
  });
  if (e.urgent && res && res.success) { // 잠금 밖에서(개선요구사항 적기도 잠금을 씀)
    try {
      var add = improve_addRequest_({ text: '🚨 긴급 — 넥스 신고(세액·신고 결과 오류): ' + e.want + (e.blocker ? ' / 막힌 이유: ' + e.blocker : '') + (e.area ? ' / 분야: ' + e.area : '') });
      try { if (typeof notifyOwner_ === 'function') notifyOwner_('digest', '넥스 긴급 신고(세액·신고 결과 오류) — ' + e.want.slice(0, 80)); } catch (x) {} // [2026.10.22] 손목·휴대폰으로 바로 → [2026.10.31] 세무사님 "권장안대로": 개선요구 🚨 긴급(대시보드 오늘 줄)과 겹쳐 '답할 알림'에서 빼고 아침 묶음 문자 한 줄로 — 고칠 사람은 개발 쪽
      res.message += add && add.success ? ' 세액·신고 결과 오류라 개선요구사항에 🚨 긴급으로도 올렸다 — 사용자에게 "긴급으로 올렸다"고 알리고, 고쳐지기 전까지 그 결과는 손으로 검산하라고 말하라.' : ' (긴급 등록은 실패 — 사용자에게 설정 🐞 카드에서 직접 적어 달라고 말하라.)';
    } catch (x) { res.message += ' (긴급 등록 실패: ' + String(x && x.message || x).slice(0, 80) + ')'; }
  }
  return res;
}
function commRecentGaps_(days) {
  var arr = [];
  try { arr = JSON.parse(commGapsFile_().getBlob().getDataAsString('UTF-8') || '[]'); } catch (x) { arr = []; }
  var since = Date.now() - days * 86400000;
  return arr.filter(function (g) { return improve_parseAt_(g.at) >= since; });
}
// [2026.10.22] 세무사님 "진행하고 다음으로 넘어가자" — 기능 부족 신고에 "처리됨" 표시가 없어 고친 신고가 매주 다시 실렸다.
//  처리 장부 = 저장소 docs/gaps-resolved.json([{want: 신고 앞부분, at: 고친 시각, 처리, 근거}]) — 고친 PR·커밋이 한 줄 더한다(웹 루틴·PC Claude 공통).
//  신고 want가 장부 want로 시작하면: 신고 시각 ≤ 고친 시각 → 처리됨(보고서·알림에서 뺌), 신고 시각 > 고친 시각 → 다시 신고(고쳤는데 또 막힘, 먼저 볼 것).
function commGapsResolved_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('gaps_resolved_json'), txt = hit;
  if (hit === null) {
    try { var r = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + GH_REPO_ + '/main/docs/gaps-resolved.json?t=' + Date.now(), { muteHttpExceptions: true }); txt = r.getResponseCode() === 200 ? r.getContentText('UTF-8') : '[]'; } catch (e) { txt = '[]'; }
    try { cache.put('gaps_resolved_json', txt, 1800); } catch (e) {}
  }
  try { var a = JSON.parse(txt || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function commGapNorm_(s) { return String(s || '').replace(/\s+/g, ''); }
// 신고 하나의 상태 — { 상태: '미처리' | '처리됨' | '다시 신고', 처리: 장부 줄 }
function commGapStatus_(g, resolved) {
  var w = commGapNorm_(g && (g.want || g.userWanted)), at = String(g && g.at || ''), hit = null;
  (resolved || []).forEach(function (r) { var k = commGapNorm_(r && r.want); if (k && w.indexOf(k) === 0 && (!hit || String(r.at) > String(hit.at))) hit = r; });
  if (!hit) return { 상태: '미처리', 처리: null };
  return { 상태: at && at > String(hit.at || '') ? '다시 신고' : '처리됨', 처리: hit };
}
// 처리됨은 빼고, 남은 것에 상태를 붙인다(다시 신고가 앞). 처리된 건수도 함께.
function commGapsOpen_(gaps, resolved) {
  var open = [], done = 0;
  (gaps || []).forEach(function (g) {
    var s = commGapStatus_(g, resolved);
    if (s.상태 === '처리됨') { done++; return; }
    var x = {}; Object.keys(g).forEach(function (k) { x[k] = g[k]; }); x.상태 = s.상태;
    if (s.처리) x.전에고친것 = String(s.처리.처리 || '').slice(0, 200) + (s.처리.근거 ? ' — ' + s.처리.근거 : '');
    open.push(x);
  });
  open.sort(function (a, b) { return (a.상태 === '다시 신고' ? 0 : 1) - (b.상태 === '다시 신고' ? 0 : 1); });
  return { open: open, done: done };
}
// ④ 개발자 질문 큐 — 루틴이 저장소 docs/dev-questions.md에 "## Q-날짜-번호 제목" 블록으로 질문을 남기면 job이 보여 주고 답을 받는다
var COMM_ANSWERS_PROP_ = 'NX_DEV_ANSWERS';
function commDevQuestions_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('dev_questions_md'), md = hit;
  if (hit === null) {
    try { var r = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + GH_REPO_ + '/main/docs/dev-questions.md?t=' + Date.now(), { muteHttpExceptions: true }); md = r.getResponseCode() === 200 ? r.getContentText('UTF-8') : ''; } catch (e) { md = ''; }
    try { cache.put('dev_questions_md', md, 1800); } catch (e) {}
  }
  var answers = {};
  try { answers = JSON.parse(PropertiesService.getScriptProperties().getProperty(COMM_ANSWERS_PROP_) || '{}'); } catch (e) { answers = {}; }
  var qs = [], blocks = String(md || '').split(/\n(?=##\s+Q-)/);
  blocks.forEach(function (b) {
    var m = b.match(/^##\s+(Q-[\w-]+)\s*(.*)/);
    if (!m) return;
    if (/^질문 제목/.test(m[2].trim()) || /아래에 질문을 추가하세요/.test(b)) return; // [2026.10.31] 적는 법 견본 블록을 질문으로 세던 것 — 대시보드 '개발자 질문 1건' 헛숫자
    qs.push({ id: m[1], title: m[2].trim().slice(0, 120), body: b.split('\n').slice(1).join('\n').trim().slice(0, 1500), answer: answers[m[1]] ? answers[m[1]].text : '', answeredAt: answers[m[1]] ? answers[m[1]].at : '' });
  });
  return qs;
}
function commDevAnswer_(body) {
  var id = String(body && body.id || ''), text = String(body && body.text || '').trim();
  if (!/^Q-[\w-]+$/.test(id) || !text) return { error: '질문 번호와 답이 필요합니다.' };
  var p = PropertiesService.getScriptProperties(), a = {};
  try { a = JSON.parse(p.getProperty(COMM_ANSWERS_PROP_) || '{}'); } catch (e) { a = {}; }
  a[id] = { text: text.slice(0, 2000), at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') };
  var keys = Object.keys(a); if (keys.length > 60) keys.sort().slice(0, keys.length - 60).forEach(function (k) { delete a[k]; });
  p.setProperty(COMM_ANSWERS_PROP_, JSON.stringify(a));
  improveReportRebuildLater_(); // [2026.11.03] 답 저장이 몇 분 걸리던 것 — 보고서는 1분 뒤 뒤에서
  return { success: true };
}
// ⑥ [2026.10.22] 소통 이음매 점검 — 세무사님 "시스템 변경시 소통점검이 보안점검처럼 항상 이루지도록 하는 대책을 마련하라"
//  배포 직후 점검(Code.js deploySmoke_)이 배포마다(PC·📥·↩) 자동으로 부른다. 토큰 0 — AI를 부르지 않고 "말이 오가는 길"이 살아 있는지만 본다.
//  새 AI 경로·도구·소통 길을 만들면 여기 한 줄을 더한다(Claude작업원칙 L2_comm.md). 끊긴 길은 오류 기록 → 주간 개선 보고서·🐞 카드에 뜬다.
var COMM_SEAM_TEST_SAID_ = '소통점검시험말씀', COMM_SEAM_TEST_CHAT_ = '소통점검시험대화';
function commSeamList_() {
  var toolNames = function (arr) { return (arr || []).map(function (t) { return t && t.name; }); };
  var chatTools = function () { return toolNames(typeof DRIVE_TOOLS !== 'undefined' ? DRIVE_TOOLS : []).concat(toolNames(typeof JOB_AI_TOOLS_ !== 'undefined' ? JOB_AI_TOOLS_ : [])); };
  var leadTools = function () { return typeof caseProcAiLiveTools_ === 'function' ? toolNames(caseProcAiLiveTools_()) : []; };
  var lookupKinds = function () { var j = (typeof JOB_AI_TOOLS_ !== 'undefined' ? JOB_AI_TOOLS_ : []).filter(function (t) { return t.name === 'job_lookup'; })[0]; return (j && j.input_schema && j.input_schema.properties && j.input_schema.properties.kind && j.input_schema.properties.kind.enum) || []; };
  var need = function (have, list, where) { var miss = list.filter(function (n) { return have.indexOf(n) === -1; }); return miss.length ? where + '에 없음: ' + miss.join(', ') : ''; };
  return [
    // 세무사님 ↔ 넥스
    { 길: '세무사님 원칙 → 넥스(공통원칙·마스터 프로필)', fn: function () { var t = getMasterProfileText_(); return !t ? '마스터 프로필을 못 읽음' : (getCommonPrinciplesText_() && t.indexOf('공통원칙') === -1 ? '공통원칙이 넥스 지시문에 안 붙음' : ''); } },
    { 길: 'GAS가 깨운 넥스(미리 읽기·중요한 순간)도 같은 원칙·최근 바뀐 기능', fn: function () { var m = getMasterProfileText_(), b = caseProcAiNexBase_(); return m && b.indexOf(m.slice(0, 200)) === -1 ? 'GAS가 깨운 넥스 지시문에 마스터 프로필이 없음' : ''; } },
    { 길: '채팅창 말씀·최근 대화 → 사건을 맡은 넥스(같은 대화창 넥스)', fn: function () { var src = String(callClaude); if (src.indexOf('nxCaseChatGuide_') === -1 && String(buildContextSystemPrompt).indexOf('nxCaseChatGuide_') === -1) return '사건이 연결된 대화에 일하는 방식이 안 붙음'; return src.indexOf('nxCaseChatTools_(') === -1 ? '사건이 연결된 대화에 사건 도구가 안 붙음' : ''; } },
    // [2026.10.23 T6 2단계] GAS → Cloud Run 읽기 전용 시험 서비스(/health) — 주소(T6_READER_URL)가 있을 때만 본다(2단계 배포 전엔 길이 없는 것이 정상)
    // [2026.10.27 T6 3단계] 화면이 직접 부르는 길 — /health는 토큰 없이 ok(깨우기용), /read는 서비스 안에서 ID 토큰 검증. 직결이 켜져 있으면(T6_READER_DIRECT) 끊김이 곧 ⚡ 지연이라 더 중요
    { 길: '화면 → Cloud Run 시험 서비스(/health' + (/^(1|true|on|켬)$/i.test(String(PropertiesService.getScriptProperties().getProperty('T6_READER_DIRECT') || '')) ? ', 직결 켬' : ', 직결 꺼짐') + ')', fn: function () { var url = String(PropertiesService.getScriptProperties().getProperty('T6_READER_URL') || (typeof T6_READER_URL_DEFAULT_==='string' ? T6_READER_URL_DEFAULT_ : '')).trim().replace(/\/+$/, ''); if (!url) return ''; try { var r = UrlFetchApp.fetch(url + '/health', { headers: { Authorization: 'Bearer ' + ScriptApp.getIdentityToken() }, muteHttpExceptions: true }); var code = r.getResponseCode(); if (code !== 200) return '/health 응답 ' + code; var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {} return j.ok ? '' : '/health 응답이 ok가 아님'; } catch (e) { return '시험 서비스를 못 부름: ' + String(e && e.message || e).slice(0, 100); } } },
    // [2026.10.27 T6 4단계] 사건처리 때만 폴더 공유 — 현황 파일의 폴더가 모두 "완료 안 된 사건"인지(드라이브 호출 없이 사건 목록 대조)
    { 길: '시험 서비스 폴더 공유 = 완료 안 된 사건만', fn: function () { return typeof t6ShareCheck_ === 'function' ? t6ShareCheck_() : '공유 점검 함수 없음'; } },
    // [2026.10.30] 불복 사건개요서 — 세무사님 화면(처리개요 저장)과 넥스(사건 고치기 도구 case_update의 사건개요)가 같은 서버 입구(work_updateCase)로 쓰고, 청구인 ↔ 작업관리 납세자·고객관리 연결 매핑이 서버에 있는지
    { 길: '불복 사건개요서 — 화면·넥스 같은 저장 입구, 청구인 ↔ 납세자·고객관리 연결', fn: function () { if (typeof WORK_TAXPAYER_FIELD_BY_SEMOK_ === 'undefined' || WORK_TAXPAYER_FIELD_BY_SEMOK_.objection !== 'objTaxpayerName') return '서버에 불복 청구인 ↔ 납세자 맞춤이 없음'; if (typeof WORK_PARTY_NAME_TO_ID_FIELDS_ === 'undefined' || !WORK_PARTY_NAME_TO_ID_FIELDS_.objection) return '서버에 불복 청구인 고객관리 연결이 없음'; return typeof work_updateCase === 'function' ? '' : '사건 저장 입구(work_updateCase)가 없음'; } },
    // [2026.10.30 예약 결과 관리] 예약 결과 적기·기존 사건 잇기·연결 후보 — 세무사님 화면(예약관리)과 넥스가 같은 서버 입구, 사건 만들기 관문이 후보를 돌려줌
    { 길: '예약 결과·사건 연결 — 화면·넥스 같은 입구, 사건 만들기 관문에서 예약 후보', fn: function () { if (typeof booking_setResult !== 'function' || typeof booking_candidatesForCase_ !== 'function') return '예약 결과 함수가 이 판에 없음'; var p = typeof JOB_PROPOSE_ACTIONS_ !== 'undefined' ? Object.keys(JOB_PROPOSE_ACTIONS_) : []; var m = need(p, ['booking_result', 'booking_link_case', 'booking_dismiss_candidate'], '넥스 제안') || need(lookupKinds(), ['booking_link_review', 'booking_case_candidates'], '조회 종류'); if (m) return m; return String(work_createCaseFull_).indexOf('booking_candidatesForCase_') === -1 ? '사건 만들기 관문에 예약 후보 찾기가 빠짐' : ''; } },
    // [2026.10.30] 세무서 제출용 검토조서 — 화면(✍ 문서작성 "검토조서 만들기")과 넥스(report_parts do=template label 검토조서)가 같은 틀을 받고, 넥스 사건 지침에 검토조서 규칙이 있는지
    { 길: '검토조서 — 화면·넥스 같은 틀(보고서템플릿 검토조서), 넥스 지침에 작성 규칙', fn: function () { if (typeof NX_CASE_REPORT_TOOL_ === 'undefined' || NX_CASE_REPORT_TOOL_.description.indexOf('검토조서') === -1) return '넥스 보고서 도구에 검토조서 틀 이름이 없음'; if (typeof nxCaseChatGuide_ !== 'function' || String(nxCaseChatGuide_).indexOf('[검토조서') === -1) return '넥스 사건 지침에 검토조서 규칙이 없음'; if (typeof KNH_REPORT_LABELS_ !== 'undefined' && KNH_REPORT_LABELS_.indexOf('검토조서') === -1) return '보고서 틀 이름 목록에 검토조서가 없음'; var r = handleGetReportTemplate({ label: '검토조서' }); return r && r.found ? '' : '보고서템플릿 폴더에 검토조서 틀이 없음(📥 반영 때 저장소 틀이 만들어짐)'; } },
    // [2026.10.31 J] 넥스 도구 카드 — 사건 대화에서 넥스가 부른 도구·실패·부족 신고가 그 사건 장부에 남고, 화면 📒(장부 펼치기·띠)과 넥스 장부 요약이 같은 것을 본다
    { 길: '넥스 도구 카드 — 장부 기록 → 화면 📒·넥스 장부 요약', fn: function () { if (typeof ledgerToolLogPut_ !== 'function' || typeof ledgerToolCard_ !== 'function') return '도구 카드 함수가 이 판에 없음'; var k = ledgerToolCard_({ toolLog: [{ at: 'x', tool: 'seam', ok: false, why: 'w', gap: 'g' }] }); return k && k.부름 === 1 && k.실패 === 1 && k.모자람.length === 1 ? '' : '도구 카드 집계가 틀림'; } },
    // [2026.10.31 H] 업무별 일하는 법 — 사건을 맡은 넥스 일하는 방식에 업무별 지침(넥스_일하는법_○○)을 먼저 읽는 줄이 있는지
    // [2026.11.04 접근권한] 열쇠 관리 — 설정 화면 카드와 밤 환경 감시가 같은 열쇠 목록(ENV_KEY_CATALOG_)을 보고, 상태는 값 없이 끝 4자리까지만
    { 길: '열쇠 관리 — 설정 카드·밤 감시 같은 목록, 값은 끝 4자리까지만', fn: function () { if (typeof envKeyStatus_ !== 'function' || typeof envKeySet_ !== 'function' || typeof ENV_KEY_CATALOG_ === 'undefined') return '열쇠 관리 함수가 이 판에 없음'; var r = envKeyStatus_(); if (!r || !r.success || !r.rows || r.rows.length !== ENV_KEY_CATALOG_.length) return '열쇠 상태 줄 수가 목록과 다름'; var p = PropertiesService.getScriptProperties(); var leak = r.rows.filter(function (x) { var v = String(p.getProperty(x.이름) || ''); return v.length >= 8 && JSON.stringify(x).indexOf(v) !== -1; }); return leak.length ? '열쇠 값이 상태에 그대로 나옴: ' + leak.map(function (x) { return x.이름; }).join(', ') : ''; } },
    // [2026.11.04 ⑨] 넥스만 쓰던 도구 셋(사실 지도·서류 다시 뒤지기·쟁점 묶음) — 세무사님 화면(사실(장부) 도구 줄)과 넥스가 같은 GAS 함수로 본다
    { 길: '사실 지도·서류 다시 뒤지기·쟁점 묶음 — 화면·넥스 같은 함수', fn: function () { if (typeof caseProcNexToolView_ !== 'function') return '화면 입구(caseProcNexToolView_)가 이 판에 없음'; if (typeof caseProcAiFactMap_ !== 'function' || typeof caseProcAiDocFind_ !== 'function') return '사실 지도·서류 찾기 함수가 이 판에 없음'; var src = String(caseProcNexToolView_); return src.indexOf('caseProcAiFactMap_') === -1 || src.indexOf('caseProcAiDocFind_') === -1 ? '화면 입구가 넥스 도구 함수를 안 부름' : ''; } },
    { 길: '넥스 업무별 일하는 법 — 일하는 방식에 지침 읽기 줄', fn: function () { if (typeof nxCaseChatGuide_ !== 'function') return '사건 넥스 일하는 방식이 이 판에 없음'; var g = nxCaseChatGuide_('seam'); return ['종합자문', '양도', '증여', '상속', '세무조사', '불복경정', '가족법인'].every(function (k) { return g.indexOf('넥스_일하는법_' + k) !== -1; }) ? '' : '일하는 방식에 업무별 지침 이름이 빠짐'; } },
    // 넥스 ↔ GAS(도구)
    { 길: '대화창 넥스 조회 길(사건처리·AI 판단·AI 회의 결론)', fn: function () { return need(lookupKinds(), ['caseproc', 'ai_review', 'law_decisions'], '조회 종류'); } },
    { 길: '사건을 맡은 넥스 — 질문(장부 do=ask)·도구 부족 신고(한 길: 개발자 기록 + 사건처리 빠진 도구 기록)·AI 회의 결론', fn: function () { var m = need(chatTools(), ['case_ledger', 'report_capability_gap'], '대화창 도구') || need(leadTools(), ['law_decisions'], '사건 도구'); if (m) return m; return String(callClaude).indexOf('caseProcAiLogGaps_') === -1 ? '사건 연결 대화의 도구 부족 신고가 사건처리 빠진 도구 기록에 안 감' : ''; } },
    // [2026.10.31 묶음 해체] 세무사님 원문(10-31) "개별 gas의 도구들을 넥스가 활용하는 것" / "검토서 초안은 당연히 없어져야 한다." — 넥스가 낱개 도구(case_read·calc_fill)를 서버에서 직접 부르고,
    //  화면 단추와 같은 입구(case_proc step read·fill)를 쓰는지. 묶음(gas_run·gas_finish·step all)·초안 만드는 곳(draft)이 되살아나면 빨갛게
    // [2026.10.22 작업 기록부] 세무사님이 GAS 도구로 직접 하신 일 → 사건 기록부 → 넥스(채팅 조회·사건 지휘)가 읽음
    { 길: '세무사님 직접 작업 → 작업 기록부 → 넥스', fn: function () { if (typeof caseProcNexView_ !== 'function' || typeof caseProcLog_ !== 'function') return '작업 기록부가 이 판에 없음'; var v = caseProcNexView_({ id: 'seam', 증빙목록: [], 사건개요: {} }); return v && v.작업기록 ? '' : '현황에 작업기록 칸이 없음'; } },
    { 길: '넥스가 낱개 GAS 도구를 부름(📖 서류 읽기 case_read·칸 채우기 calc_fill — 화면 단추와 같은 입구)', fn: function () { var m = need(leadTools(), ['case_status', 'case_read', 'calc_fill'], '사건 지휘 도구'); if (m) return m; var lt = leadTools(); if (lt.indexOf('gas_run') !== -1 || lt.indexOf('gas_finish') !== -1) return '묶음 도구(gas_run·gas_finish)가 되살아남'; if (typeof CASEPROC_AI_CLIENT_TOOLS_ !== 'undefined' && CASEPROC_AI_CLIENT_TOOLS_.length) return '화면이 대신 돌리는 넥스 도구가 다시 생김'; if (typeof caseProcTool_ !== 'function') return '낱개 도구 입구(caseProcTool_)가 이 판에 없음'; if (String(caseProcAiExec_).indexOf("step('read'") === -1 || String(caseProcAiExec_).indexOf("step('fill'") === -1) return '넥스 도구가 화면과 같은 입구(read·fill)를 안 부름'; return nxCaseChatGuide_('점검').indexOf('[도구는 낱개]') === -1 ? '넥스 지시문에 "도구는 낱개" 줄이 없음' : ''; } },
    { 길: '묶음·검토서 초안 없음 — 「GAS로 처리」 한 바퀴(step all)·마무리 초안(step draft)이 서버에 없음', fn: function () { if (typeof caseProcAll_ === 'function') return '옛 묶음 입구(caseProcAll_)가 되살아남'; if (typeof caseProcDraft_ === 'function') return '종합검토서 초안을 만드는 곳(caseProcDraft_)이 되살아남'; if (typeof caseProcReviewNotes_ !== 'function') return '보류·추정 줄 → 종합검토서 "확인 필요 사항" 입구(reviewNotes)가 없음'; if (typeof cpFlowQueueRun_ === 'function' && String(cpFlowQueueRun_).indexOf("step: 'all'") !== -1) return '1분 시계가 묶음(all)을 돌림'; return ''; } },
    // [2026.10.23 ㅊ1] 규칙 없는 서류·메모의 글 → 넥스(doc_view) — 빠지면 넥스가 세무사님께 메모 내용을 되묻는다(점검표 139)
    { 길: '서류 읽기 한 길 — 원문은 file_read, GAS 정리값은 doc_facts(doc_view·doc_text는 대화창 넥스에 주지 않음)', fn: function () { var m = need(leadTools(), ['file_read', 'doc_facts'], '사건 도구'); if (m) return m; if (typeof NX_CASE_CHAT_SKIP_ === 'undefined' || NX_CASE_CHAT_SKIP_.indexOf('doc_view') === -1) return 'doc_view가 대화창 넥스에 다시 붙음(같은 글을 다르게 보여 줌)'; return nxCaseChatGuide_('점검').indexOf('file_read') === -1 ? '지시문이 file_read를 안 알려 줌' : ''; } },
    // [2026.10.28] 사건 장부(CaseLedger.js) — 세무사님 말씀·넥스 판단·서류 값이 한 장부에, 채팅 넥스(case_ledger·조회 ledger)·지휘 넥스(ledger_read·case_ledger)·화면(case_proc ledger*)이 같은 입구
    { 길: '사건 장부 — 채팅 넥스·지휘 넥스·화면이 같은 장부에 적음', fn: function () { var m = need(chatTools(), ['case_ledger'], '대화창 도구') || need(lookupKinds(), ['ledger'], '조회 종류') || need(leadTools(), ['ledger_read', 'case_ledger'], '사건 지휘 도구'); if (m) return m; if (typeof ledgerApi_ !== 'function' || typeof ledgerSet_ !== 'function') return '장부 함수가 이 판에 없음'; var n = ledgerNorm_('a0.assetType', '주택(주거용 오피스텔)'); return n && n.v === 'house' ? '' : '고르기 칸 글→코드 변환이 안 됨'; } },
    // [2026.10.28 시정 2단계] 질문·결정은 장부 줄 — 저장 입구(caseProcLoad_·caseProcPatch_)가 장부에서 붙이고 떼며, 직결 서비스는 장부를 받아 돌고 돌려준다(t6RecordForReader_ → t6MergeLedger_)
    { 길: '질문·결정 = 장부 한 곳(화면·넥스·직결 서비스·점검기 같은 길)', fn: function () { if (typeof ledgerQWrite_ !== 'function' || typeof ledgerQRead_ !== 'function') return '장부 질문 함수가 이 판에 없음'; if (typeof caseProcQHydrate_ !== 'function' || typeof caseProcQSplit_ !== 'function') return '저장 입구가 장부로 잇지 않음'; if (typeof t6MergeLedger_ !== 'function') return '직결 서비스 장부 합치기 없음'; var sp = caseProcQSplit_({ remaining: [1], decisions: { a: 1 }, x: 1 }); return (!('remaining' in sp.file) && !('decisions' in sp.file) && sp.file.x === 1) ? '' : '저장 파일에 질문·결정이 남음'; } },
    // [2026.10.29] 사건 장부의 바탕 — 서류 사실·서류끼리 맞대기·칸으로 간 길이 교차검증(처리개요)·직결 서비스·화면 「🔄 서류 사실 다시 모으기」에서 장부 짝 파일로, 화면 📒 ①②③으로 세무사님께
    { 길: '사건 흐름 한 바퀴(의뢰서 가설 → 사건개요 → 확보할 증빙 → 질문) ← 폴더 변동·세무사님 화면 저장·답·넥스 가설 → 장부·화면(⓪ 사건 흐름)', fn: function () { if (typeof caseFlowRound_ !== 'function' || typeof ledgerFromCaseWrite_ !== 'function' || typeof ledgerHypPut_ !== 'function' || typeof ledgerFlowView_ !== 'function') return '사건 흐름 층·한 바퀴 함수가 이 판에 없음'; if (typeof cpFlowQueueAdd_ !== 'function' || typeof cpFlowQueueRun_ !== 'function') return '한 바퀴 줄(폴더 변동·화면 저장·답 → 틱)이 없음'; if (typeof ledgerFlowBrief_ !== 'function') return '사건 화면마다 맨 위 장부 띠가 부르는 입구(ledgerFlow)가 없음'; if (typeof caseProcGraspMore_ !== 'function') return '의뢰서에서 물건·거래·쟁점 뽑기가 없음'; var L = { rows: {}, log: [], ov: {}, hyp: { claims: [{ f: '상대방', v: '홍길동', srcs: ['의뢰서.md'], by: 'GAS' }] } }; ledgerOvFromHypInner_(L); if (!(L.ov['ov.상대방'] && L.ov['ov.상대방'].state === '가설')) return '가설이 사건개요 층에 「가설」로 서지 않음'; var got = []; caseProcGraspMore_('서울특별시 강남구 대치동 316 아파트 양도. 1세대1주택 비과세 검토', { 세목: 'transfer' }, function (f, v) { got.push(f); }, 'x'); return got.indexOf('쟁점') !== -1 && got.indexOf('물건') !== -1 ? '' : '의뢰서 글에서 쟁점·물건을 못 뽑음'; } },
    // [2026.10.29 넥스 1~4] 세무사님 "ai가 처리할때는 사건장부 속의 정보를 적재적소에 제대로 활용하지 못하고 있다는 것인가?" → "그래라" — 장부 → 넥스(지휘·대화창) 길과, 중요한 순간 GAS → 넥스 → 세무사님 길
    // [2026.10.31 세 길 합치기 3] 넥스가 칸에 값을 넣는 세 길(질문 답·확정 칸 고치기·장부 적기)이 모두 ledgerNexGate_ 문을 지나는지, 서류 근거가 원문 대조로 걸리는지
    { 길: '넥스 값 넣기는 한 길·서류 근거는 대조(value_set·target·case_ledger set → 장부 문)', fn: function () { if (typeof ledgerNexGate_ !== 'function') return '장부 문(ledgerNexGate_)이 이 판에 없음'; var miss = []; if (String(caseProcAiValueSetLive_).indexOf('ledgerNexGate_') === -1) miss.push('질문 답'); if (String(caseProcAiLiveExec_).indexOf('ledgerNexGate_') === -1) miss.push('확정 칸 고치기'); if (String(ledgerToolRun_).indexOf('ledgerNexGate_') === -1) miss.push('장부 적기'); if (miss.length) return '문을 안 지나는 길: ' + miss.join(', '); var g = ledgerNexGate_(null, '1', {}, ''); if (!g.ok || g.kind !== '추정') return '근거 없는 값이 추정으로 안 적힘'; var gi = ledgerNexGate_(null, '1', { kind: 'infer' }, ''); return gi.ok ? '근거 사실 없는 추론을 받아 줌' : ''; } },
    { 길: '사건 장부 요약·서류 사실 찾기 → 넥스(지휘 case_status·ledger_read·대화창 caseproc·case_ledger facts/brief)', fn: function () { if (typeof ledgerNexBrief_ !== 'function' || typeof ledgerKbFind_ !== 'function') return '장부 요약·서류 사실 찾기 함수가 이 판에 없음'; var lt = (typeof caseProcAiLiveTools_ === 'function' ? caseProcAiLiveTools_() : []).filter(function (t) { return t.name === 'case_ledger'; })[0]; if (!lt || JSON.stringify(lt.input_schema).indexOf('facts') === -1) return '사건 지휘 case_ledger에 facts가 없음'; var ct = (typeof DRIVE_TOOLS !== 'undefined' ? DRIVE_TOOLS : []).concat(typeof JOB_AI_TOOLS_ !== 'undefined' ? JOB_AI_TOOLS_ : []).filter(function (t) { return t.name === 'case_ledger'; })[0]; if (!ct || JSON.stringify(ct.input_schema).indexOf('facts') === -1) return '대화창 case_ledger에 facts가 없음'; if (String(caseProcAiLiveExec_).indexOf('ledgerNexBrief_') === -1) return '사건 지휘 case_status에 장부 요약이 안 붙음'; if (String(job_lookup_).indexOf('장부요약') === -1) return '대화창 caseproc 조회에 장부 요약이 안 붙음'; var L = { rows: { 'chk:가설.c0.totalPrice': { state: '보류', label: '가설과 다름', ask: 'x' } }, hyp: { claims: [{ f: '쟁점', v: '1세대1주택 비과세', srcs: ['의뢰서.md'] }] }, ev: {} }; var m = ledgerMomentKeys_(L); return Object.keys(m).length === 2 ? '' : '중요한 순간(가설과 다름·새 쟁점)을 못 알아챔'; } },
    // [2026.10.29 넥스 도구 결과 보장] 대화창 넥스가 부른 도구는 하나마다 결과가 꼭 돌아가야 AI 서버가 다음 요청을 받는다. 예전 손 명단(147개)에서 10-28 도구 3개가 빠져 강문영 사건 검토가 거절됐다 — 명단을 없앴고, 여기서 넥스가 받는 도구마다 처리 분기가 있는지 배포 때마다 본다
    { 길: '대화창 넥스 도구 호출 → 서버 처리 → 결과(도구마다 하나씩)', fn: function () { if (typeof callClaude !== 'function' || typeof DRIVE_TOOLS === 'undefined') return '대화창 AI 함수가 이 판에 없음'; var src = String(callClaude); if (src.indexOf("b.name === 'list_drive_folder' ||") !== -1) return '옛 손 명단이 되살아남 — 명단에 없는 도구는 결과 없이 거절됨'; if (!/runToolBlock_\((block|runBlock)\)/.test(src) || src.indexOf('처리 코드가 결과를 만들지 못했다') === -1) return '도구마다 결과를 보장하는 감싸기가 없음'; /* [2026.10.30] 근거 확인이 저장할 글만 바꾼 사본(runBlock)으로 부름 */ var ts = DRIVE_TOOLS.slice(); try { ts = ts.concat(getClientActionTools_({ aiPanel: 'tab', openFile: { liveContent: '' }, currentPath: { folderId: 'x' } }), getClientActionTools_({ openFile: { liveContent: '' } })); } catch (e) { return '화면 도구 목록을 못 만듦: ' + e.message; } var eng = null, engOk = src.indexOf('runUiEngineCalcTool_(block.name') !== -1 && typeof runUiEngineCalcTool_ === 'function'; if (engOk) { try { eng = getUiCalcEngine_(); } catch (e) { engOk = false; } } var seen = {}, miss = []; ts.forEach(function (t) { var n = t && t.name; if (!n || t.type || seen[n]) return; seen[n] = 1; if (n === 'read_drive_file' || src.indexOf("block.name === '" + n + "'") !== -1) return; /* [2026.11.01] 이름별 갈래 없이 엔진 공통 길(runUiEngineCalcTool_)로 도는 계산 도구는 엔진에 그 함수가 있으면 처리됨 */ if (engOk && isUiEngineCalcTool_(n) && typeof eng[(UI_ENGINE_CALC_TOOL_ARGS_[n] || [])[0] || n.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); }) + 'JS'] === 'function') return; miss.push(n); }); return miss.length ? '처리 코드 없는 도구 ' + miss.length + '개(넥스가 부르면 실패 결과만 감): ' + miss.join(', ') : ''; } },
    // [2026.10.29 거래 사슬] 세무사님 "전혀 관계없는 엉뚱한 계약서(거래당사자나 거래물건 등)가 들어와도 분별을 못한다는 것이다. 이것은 반드시 수정되어야 한다"
    { 길: '거래 사슬(계약서·등기부 고리, 사슬 밖 계약서 질문) → 장부·화면·넥스 요약', fn: function () { if (typeof tcDealChain_ !== 'function' || typeof ledgerChainPut_ !== 'function') return '거래 사슬 함수가 이 판에 없음'; if (String(ledgerNexBrief_).indexOf('거래사슬') === -1) return '넥스 장부 요약에 거래 사슬이 없음'; if (String(trcQuestions_).indexOf('사슬밖') === -1) return '사슬 밖 계약서 질문이 없음'; var loc = '경기도 군포시 금정동 689 가상힐타운 제201동 제18층 제1807호'; var regs = [{ file: '등기부.pdf', r: { docs: [{ 소재지: loc, 소유권이력: [{ 순위: '1', 목적: '소유권보존', 접수일: '2022-06-30', 권리자: [{ 이름: '가상건설' }] }, { 순위: '2', 목적: '소유권이전', 접수일: '2022-07-05', 원인: '매매', 원인일: '2019-02-11', 권리자: [{ 이름: '정우진' }] }, { 순위: '3', 목적: '소유권이전', 접수일: '2027-02-22', 원인: '매매', 원인일: '2026-11-05', 권리자: [{ 이름: '한지우' }] }] }] } }]; var cs = [{ file: '분양권매매.pdf', role: 'buyer', r: { 소재지: loc, 매도인: '고현옥', 매수인: '정우진', 계약일: '2019-02-11', 종류: '분양권 매매계약서' } }, { file: '양도.pdf', role: 'seller', r: { 소재지: loc, 매도인: '정우진', 매수인: '한지우', 계약일: '2026-11-05' } }]; var others = [{ file: '공급계약.pdf', r: { 소재지: loc, 종류: '분양(공급)계약서' }, parties: ['고현옥'] }, { file: '엉뚱.pdf', r: { 소재지: '서울특별시 강남구 대치동 316 은마아파트 1동 101호', 매도인: '김철수', 매수인: '이영희', 계약일: '2020-01-01' }, parties: ['김철수', '이영희'] }]; var ch = tcDealChain_(cs, others, regs, ['정우진'], {}); var offF = ch.off.map(function (o) { return o.file; }); if (offF.indexOf('엉뚱.pdf') === -1) return '다른 물건·남의 계약서를 사슬 밖으로 못 가림'; if (offF.length !== 1) return '사슬에 이어진 계약서(분양권 전매·전 소유자 공급계약·양도)를 사슬 밖으로 잘못 봄: ' + offF.join(','); return ch.rows.length === 1 && /취득/.test(ch.rows[0].납세자위치) && /양도/.test(ch.rows[0].납세자위치) ? '' : '납세자 위치(취득·양도 고리)를 못 정함'; } },
    // [2026.10.29 계획서 3판] 세무사님 "gas는 전체가 하나의 틀에 박힌 도구가 아니라 하나하나가 별도의 도구일 뿐이라고!" — 같은 도구를 세무사님 화면·넥스 두 입구가 쥐고, 결과는 장부에. 다시 벨트로 묶이면 여기서 빨갛게
    // [2026.10.29 넥스 하나 — 계획서 3판 5단계·7단계 "두 입구와 화면이 같은 도구 목록을 쥐고 있는지"] 사건에 연결된 대화창 넥스가 사건 도구 전부를 쥐고 실행하는지
    { 길: '넥스 하나 — 🤖 넥스로 처리·"이 사건 처리하자"를 대화창 넥스가 맡음(대화창 도구 + 사건 도구 전부, 같은 지시문)', fn: function () {
      if (typeof nxCaseChatTools_ !== 'function' || typeof nxCaseChatToolRun_ !== 'function' || typeof nxCaseChatGuide_ !== 'function') return '사건 도구 잇기 함수가 이 판에 없음';
      if (typeof callClaude !== 'function') return '대화창 AI 함수가 이 판에 없음';
      var src = String(callClaude);
      if (src.indexOf('nxCaseChatTools_(') === -1) return '대화창 넥스 도구 목록에 사건 도구를 붙이지 않음';
      if (src.indexOf('nxCaseChatToolRun_(') === -1) return '대화창 넥스가 사건 도구를 실행하지 못함(실행기 없음)'; if (src.indexOf("type: 'case_gas'") !== -1) return '화면이 묶음을 대신 돌리던 길(case_gas)이 되살아남'; // [2026.10.31]
      var have = DRIVE_TOOLS.map(function (t) { return t.name; }).concat(JOB_AI_TOOLS_.map(function (t) { return t.name; }));
      var all = caseProcAiLiveTools_().map(function (t) { return t.name; });
      var got = have.concat(nxCaseChatTools_(have).map(function (t) { return t.name; }));
      var miss = all.filter(function (n) { return got.indexOf(n) === -1 && NX_CASE_CHAT_SKIP_.indexOf(n) === -1; }); // [2026.10.30] 일부러 뺀 것(같은 일을 하는 대화창 도구가 있거나 한 길로 합친 것)은 빼고 본다
      if (got.indexOf('report_parts') === -1) return '보고서 재료 도구(report_parts)가 대화창 넥스에 없음 — 보고서 탭 기능을 넥스가 못 씀';
      if (typeof nxCaseCalcToolSave_ !== 'function' || src.indexOf('nxCaseCalcToolSave_(') === -1) return '사건 연결 대화의 계산 도구 결과가 경우(안) 저장본으로 안 남음';
      if (typeof ledgerAdvPut_ !== 'function' || String(ledgerToolRun_).indexOf("'advice'") === -1) return '자문 장부(쟁점·대안·근거·위험·권고·보고서)가 이 판에 없음';
      if (miss.length) return '사건 도구 중 대화창 넥스에 없는 것 ' + miss.length + '개: ' + miss.join(', ');
      if (String(nxCaseChatGuide_('x')).indexOf('잠정치') === -1) return '사건을 맡은 넥스 지시문에 잠정치 방식이 없음';
      return '';
    } },
    // [2026.10.30 근거 확인 — 세무사님 "4번 시험사건에 내가 일일이 그런 걸 확인할 시간이 없다"] 보고서 저장 → GAS 근거 대조 → 보고서 끝 표·넥스에게 [근거 확인]·장부 보고서 칸 → 📒 ⑥ 🔎
    // [2026.10.30 고침] GAS는 넥스 글을 바꾸지 않는다 — 대조 결과는 넥스에게 돌려주고 장부에만(세무사님 "일방통행식 일만")
    { 길: '넥스 보고서 저장(넥스 글 그대로) → 근거 대조(조문·판례·심판례, GAS) → 넥스에게 결과·넥스가 고침·장부 ⑥ 자문 · 세무사님 🔎 근거 확인', fn: function () {
      if (typeof citeCheck_ !== 'function' || typeof citeNexNote_ !== 'function' || typeof citeLedgerMark_ !== 'function' || typeof ledgerCiteRun_ !== 'function') return '근거 대조 도구(CiteCheck.js)가 이 판에 없음';
      var src2 = String(callClaude);
      if (src2.indexOf('citeCheck_(cc') === -1 || src2.indexOf('citeLedgerMark_(cr') === -1) return '넥스 보고서 저장 때 근거 대조가 돌지 않음(callClaude 고리 빠짐)';
      if (src2.indexOf('runToolBlock_(block)') === -1) return 'GAS가 넥스가 저장하는 글을 고쳐 저장함(일방통행 어김)';
      if (String(ledgerToolRun_).indexOf("'check_refs'") === -1 || String(ledgerApi_).indexOf("'ledgerCite'") === -1) return '넥스(do=check_refs)·화면(ledgerCite) 입구 중 빠진 것이 있음';
      if (String(nxCaseChatGuide_('x')).indexOf('예상 반박과 대응') === -1) return '넥스 지시문에 근거 확인·예상 반박 규칙이 없음';
      return '';
    } },
    // [2026.10.30 복합 자문 — 세무사님 "권하는 안대로"] 새 사건 개요 → 의뢰서·넥스 요약 / 문의 장부·함께 보는 세목 → 세무사님 📒 ⑥·넥스 두 입구 / 보고서 저장 → 넥스에게만 문의 답 현황
    { 길: '새 복합 자문 사건 → 복합 자문 의뢰서 · 새 사건 개요 → 넥스 장부 요약 · 문의 칸·함께 보는 세목(세무사님 📒 ⑥ = 넥스 do=advice·do=taxes) → 세목별 장부 계산 → 보고서 저장 때 넥스에게 문의 답 현황', fn: function () {
      if (typeof work_intakeTaxCount_ !== 'function' || String(typeof work_createCase0_ === 'function' ? work_createCase0_ : '').indexOf("['복합자문']") === -1) return '새 복합 자문 사건에 복합 자문 의뢰서(의뢰서_복합자문)가 골라지지 않음';
      if (String(ledgerNexBrief_).indexOf('의뢰개요') === -1) return '넥스 장부 요약에 새 사건 개요가 없음';
      if (typeof ledgerTaxesSet_ !== 'function' || typeof ledgerInqStatus_ !== 'function' || !LEDGER_ADV_KINDS_['문의']) return '함께 보는 세목·문의 칸이 이 판에 없음';
      if (String(ledgerToolRun_).indexOf("'taxes'") === -1 || String(ledgerApi_).indexOf("'ledgerTaxes'") === -1) return '넥스(do=taxes)·화면(ledgerTaxes) 입구 중 빠진 것이 있음';
      if (String(ledgerCompare_).indexOf("tax: 'transfer'") === -1) return '세목 비교의 양도 계산이 사건 세목대로 돎(세목 비교 이름 결함)';
      if (String(callClaude).indexOf('ledgerInqStatus_(') === -1) return '넥스 보고서 저장 때 문의 답 현황을 넥스에게 돌려주지 않음';
      if (String(nxCaseChatGuide_('x')).indexOf('문의사항별 답변') === -1) return '넥스 지시문에 복합 자문(문의 쪼개기·함께 보는 세목·문의별 답변) 규칙이 없음';
      return '';
    } },
    { 길: '도구 하나하나(공부 조회·추정·시험 계산·세목 비교) → 세무사님 화면 📒 ⑤·넥스 두 입구(대화창·사건 처리) → 장부 공부 사실', fn: function () {
      if (typeof ledgerLookup_ !== 'function' || typeof ledgerEstimate_ !== 'function' || typeof ledgerCompare_ !== 'function' || typeof ledgerPubPut_ !== 'function') return '공부 조회·추정·세목 비교 함수가 이 판에 없음';
      var lt = (typeof caseProcAiLiveTools_ === 'function' ? caseProcAiLiveTools_() : []).filter(function (t) { return t.name === 'case_ledger'; })[0];
      var ct = (typeof DRIVE_TOOLS !== 'undefined' ? DRIVE_TOOLS : []).concat(typeof JOB_AI_TOOLS_ !== 'undefined' ? JOB_AI_TOOLS_ : []).filter(function (t) { return t.name === 'case_ledger'; })[0];
      var need = ['lookup', 'estimate', 'compare'], miss = function (t) { var s = t ? JSON.stringify(t.input_schema) : ''; return need.filter(function (k) { return s.indexOf('"' + k + '"') === -1; }); };
      if (miss(lt).length) return '사건 처리 입구 case_ledger에 ' + miss(lt).join('·') + ' 없음';
      if (miss(ct).length) return '대화창 case_ledger에 ' + miss(ct).join('·') + ' 없음';
      if (['ledgerLookup', 'ledgerEstimate', 'ledgerCompare'].some(function (s) { return String(ledgerApi_).indexOf("'" + s + "'") === -1; })) return '세무사님 화면 입구(case_proc step ledgerLookup·Estimate·Compare)가 없음';
      if (String(cpOutsideRun_).indexOf('ledgerPubPut_') === -1) return 'GAS 한 바퀴 바깥 조회 결과가 장부 공부 사실에 안 남음';
      if (String(caseFlowRound_).indexOf('ledgerLookup_') === -1) return 'GAS 규칙(새 필지 → 공부 조회)이 장부 적기에 없음';
      // [2026.10.30] 옛 사건 지휘(caseProcAiTurn_)는 지웠다 — 넥스를 묶던 장치가 되살아났는지는 대화창 넥스 사건 도구 실행(nxCaseChatToolRun_ → caseProcAiLiveExec_)에서 본다
      // [2026.10.31 정리] 전에는 빈 글자('')를 검사해 아래 두 줄이 늘 통과했다 — 실제 함수 글을 본다
      var turn = (typeof nxCaseChatToolRun_ === 'function' ? String(nxCaseChatToolRun_) : '') + (typeof caseProcAiLiveExec_ === 'function' ? String(caseProcAiLiveExec_) : '');
      if (!turn) return '넥스 사건 도구 실행(nxCaseChatToolRun_·caseProcAiLiveExec_)이 이 판에 없음';
      if (typeof caseProcAi_ === 'function' || typeof caseProcAiTurn_ === 'function') return '옛 사건 지휘 길이 되살아남(넥스가 둘)';
      if (turn.indexOf("cut.push('doc_view'") !== -1) return '넥스 도구를 한 바퀴 결과 뒤에 빼는 장치가 다시 들어옴';
      if (/content\.push\(\{\s*type:\s*'tool_use'[^}]*name:\s*'gas_run'/.test(turn)) return '범위를 정하면 gas_run을 강제로 붙이는 장치가 다시 들어옴';
      if (typeof ledgerEvWhere_ !== 'function' || ledgerEvWhere_('토지대장') !== '도구' || ledgerEvWhere_('주민등록초본') !== '고객') return '받을 증빙의 받는 곳(도구·세무사님·고객)을 못 가름';
      return '';
    } },
    { 길: '중요한 순간(가설과 서류가 다름·새 쟁점·새 받을 서류) → 1분 틱이 넥스를 깨움 → 세무사님 알림·채팅 기록·작업일지', fn: function () { if (typeof cpNexMomentAdd_ !== 'function' || typeof cpNexMomentRun_ !== 'function' || typeof cpNexMomentWake_ !== 'function') return '중요한 순간 줄·깨우기 함수가 이 판에 없음'; if (String(cpWatchTick_).indexOf('cpNexMomentRun_') === -1) return '1분 틱이 중요한 순간 줄을 안 돌림'; if (String(caseFlowRound_).indexOf('cpNexMomentAdd_') === -1) return '한 바퀴가 중요한 순간을 줄에 안 넣음'; return String(cpNexMomentWake_).indexOf('caseProcAlertTo_') !== -1 && String(cpNexMomentWake_).indexOf('cpNexChatNote_') !== -1 ? '' : '넥스가 정한 한 줄이 세무사님 알림·채팅으로 안 감'; } },
    { 길: '사건 장부 바탕(서류 사실·맞대기·칸으로 간 길) → 세무사님 화면', fn: function () { if (typeof ledgerKbSave_ !== 'function' || typeof ledgerKbView_ !== 'function' || typeof ledgerKbLoad_ !== 'function') return '장부 바탕 함수가 이 판에 없음'; if (typeof ledgerKbLink_ !== 'function') return '칸 맞대기 기록 함수 없음'; if (typeof ledgerKbBuild_ !== 'function') return '화면 다시 모으기 입구 없음'; if (typeof ledgerKbRelink_ !== 'function') return '칸↔서류 사실 잇기 함수 없음(장부 하나로)'; var LL = { rows: { 'c0.totalPrice': { v: '100000000', state: '확정' } }, kb: { facts: [{ k: '매매대금', v: '100,000,000', f: 'a.pdf', w: '' }] } }; ledgerKbRelink_(LL); if (!(LL.rows['c0.totalPrice'].fx || []).length) return '칸이 같은 값 서류 사실을 못 가리킴'; var g = ledgerKbGroups_([{ kind: '매매대금', raw: '100,000,000', value: 100000000, src: { file: 'a.pdf', docType: '매매계약서' }, keys: { asset: '가동 1' } }, { kind: '등기 거래가액', raw: '100,000,000', value: 100000000, src: { file: 'b.pdf', docType: '등기부' }, keys: { asset: '가동 1' } }]); return g.some(function (x) { return x.st === '일치'; }) ? '' : '서류끼리 같은 값을 일치로 못 묶음'; } },
    // 넥스 ↔ 개발자(Claude)
    { 길: '넥스 → 개발자 신고(대화창)', fn: function () { var m = need(chatTools(), ['report_capability_gap'], '대화창 도구'); if (m) return m; commGapsFile_(); return ''; } },
    { 길: '신고 처리 장부(처리됨·다시 신고)', fn: function () { return Array.isArray(commGapsResolved_()) ? '' : '장부를 못 읽음'; } },
    { 길: '개발자 → 넥스(최근 바뀐 기능)', fn: function () { return commRecentChangesPrompt_() ? '' : '최근 바뀐 기능 기록이 비어 있음'; } },
    { 길: '세무사님 원칙 → 웹 Claude(보고서 공통원칙)', fn: function () { return getCommonPrinciplesText_() ? '' : '공통원칙.md를 못 읽음'; } },
    { 길: '웹 Claude 실행 기록 → job', fn: function () { var r = commRoutineLog_(); return r && r.last ? '' : '실행 기록을 못 읽음'; } },
    // [2026.10.28] 세무사님 "화면 어디서라도 수시로 기재할 수 있도록 하자" — 어느 화면에서든 ✍ 건의(자리·긴급 포함) → 개선요구사항 원장 → 요청 번호(R…) → 웹 Claude. 자리·🚨 머리가 붙어도 원장 읽기가 그대로 되는지
    { 길: '세무사님 건의(어느 화면에서든 ✍·Alt+Q, 자리·🚨 포함) → 개선요구사항 원장 → 요청 번호', fn: function () {
      if (typeof improve_addRequest_ !== 'function') return '건의 저장 함수가 이 판에 없음';
      var it = commLedgerItems_('- [2026-10-28 09:00] 🚨 긴급 — (세액계산 · 사건: 시험 · 세목: 양도소득세) 글\n  둘째 줄\n')[0];
      if (!it || it.text.indexOf('긴급') !== 0 && !/긴급/.test(it.text)) return '자리·긴급 머리가 붙은 원장 줄을 못 읽음';
      return /둘째 줄/.test(it.text) ? '' : '여러 줄 건의가 잘림'; } },
    // [2026.10.28] 요청 처리 내역 — PC Claude 고침(comm_request_done) → 배포 때 반영됨(commAfterDeploy_) → 세무사님 👍/↩. 어느 길이 빠지면 요청이 "접수"에 영원히 남는다
    { 길: '요청 처리 내역(PC 고침 → 배포 때 반영됨 → 👍 확인·↩ 다시 요구)', fn: function () { return typeof commRequestDone_ === 'function' && typeof commAfterDeploy_ === 'function' && typeof commRequestConfirm_ === 'function' ? '' : '처리 내역 함수가 이 판에 없음'; } },
    // [2026.10.22] Claude 세션이 쓴 확인조치사항 판단 대기 ↔ 절세 아이템 [확인 필요] 표시 — 밤 분류 검사가 노하우 화면·개선 후보 보고서로 올린다(KnowHow.js knhClsNightly_)
    { 길: '확인조치사항 판단 대기 ↔ 아이템 표시(분류 검사) → 노하우 화면·보고서', fn: function () { if (typeof knhClsNightly_ !== 'function') return '분류 검사가 이 판에 없음'; return followupFile_() ? '' : '확인조치사항 파일을 못 찾음'; } },
    // 고객·바깥 프로그램 ↔ job(2026-10-22 "다른 프로그램 다른 어플과의 소통")
    { 길: '고객 제출(my.netax.kr) → 사건 처리일지·대시보드', fn: function () { return typeof custUploadNote_ === 'function' && Array.isArray(custUploadsRecent_(7)) ? '' : '고객 제출 알림이 이 판에 없음'; } },
    // [2026.11.04 ⑩-2] 장부 받을 서류(받는 곳 고객) ↔ 고객창구 점검표 — 올리기·「고객 받음」 표시
    { 길: '장부 받을 서류 ↔ 고객창구 점검표(올림·고객 받음)', fn: function () { if (typeof portalSyncCase_ !== 'function' || !BGQ_HANDLERS_.portal_sync) return '고객창구 점검표 맞추기가 이 판에 없음'; if (String(ledgerFromCaseWrite_).indexOf('portal_sync') === -1) return '받을 서류가 바뀌어도 고객창구에 안 올라감'; if (String(custUploadNote_).indexOf('portal_sync') === -1) return '고객이 올려도 장부에 「고객 받음」이 안 붙음'; return ''; } },
    { 길: '사건 만들기 길 하나(예약·고객·사건 목록·의뢰메모·넥스 → 줄·달력·장부·폴더)', fn: function () { if (!BGQ_HANDLERS_.case_ledger) return '새 사건 장부 첫 칸 뒷일이 이 판에 없음'; if (String(work_createCase).indexOf('work_createCaseFull_') === -1) return '사건 만들기 입구가 관문을 안 지남'; if (String(work_createCaseFull_).indexOf('case_ledger') === -1) return '새 사건이 장부에 안 닿음'; if (String(toolCreateWorkCase).indexOf('work_createCase') === -1) return '넥스 사건 만들기가 다른 길'; return ''; } },
    { 길: '문자 발송 실패 → 오류 기록(🐞)', fn: function () { return typeof smsFailLog_ === 'function' ? '' : '문자 실패 기록이 이 판에 없음'; } },
    { 길: '급한 일 → 세무사님 휴대폰·워치 문자, 보통 → 아침 알림', fn: function () { try { ensureDailyReminderTrigger_(); } catch (e) {} return typeof notifyOwner_ !== 'function' ? '알림 통로가 이 판에 없음' : ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sendDailyDeadlineDigest'; }) ? '' : '아침 알림 트리거가 없음(밤 작업이 다음에 걺)'; } },
    // [2026.10.28] 세무사님 "캘린더에서 일정색상을 변경하면 예약관리에서 따로 승인을 하지 않아도 승인되도록" — 10분 트리거가 손 설치뿐이라 빠져 있어도 아무도 몰랐음. 없으면 걸고, 못 걸면 ⚠
    { 길: '상담신청 → 캘린더(색 바꾸면 자동 승인, 10분 트리거)', fn: function () { if (typeof booking_ensureCalendarSyncTrigger_ !== 'function') return '자동 승인 트리거 장치가 이 판에 없음'; try { return booking_ensureCalendarSyncTrigger_() === 'installed' ? '트리거가 없어 이번에 걺(이전엔 빠져 있었음)' : ''; } catch (e) { return '트리거를 걸지 못함: ' + (e.message || e); } } },
    { 길: '휴대폰 창구 녹음 → 상담 녹음(받아쓰기·요약 → 사건)', fn: function () { return typeof consult_finish_ === 'function' && typeof consult_chunk_ === 'function' ? '' : '상담 녹음 서버 길이 이 판에 없음'; } },
    // 기기 3종 2차(2026-10-22) — 세무사님 ↔ 시스템(휴대폰·태블릿·워치)
    { 길: '오늘 할 일(대시보드·휴대폰 창구·현황판)', fn: function () { var t = todoList_(); return t && Array.isArray(t.마감) ? '' : '오늘 할 일을 못 만듦'; } },
    { 길: '알림 문자 → 바로 답하기(확인·보류·나중에)', fn: function () { return typeof notifyAnswer_ === 'function' && Array.isArray(notifyLog_()) ? '' : '알림 답하기가 이 판에 없음'; } },
    { 길: '지문 로그인·모든 기기 로그아웃', fn: function () { return typeof MANAGE_APP_HTTP_FUNCS_ !== 'undefined' && MANAGE_APP_HTTP_FUNCS_.manageApp_deviceLogin && typeof sessRevokeAll_ === 'function' ? '' : '지문 로그인 입구가 이 판에 없음'; } },
    { 길: '이어 보기(다른 기기에서 보던 화면·넥스 대화)', fn: function () { return typeof placeGet_ === 'function' ? '' : '이어 보기가 이 판에 없음'; } },
    { 길: '카카오 봇 오류 기록 → 대시보드·주간 보고서', fn: function () { return Array.isArray(kakaoErrorsRecent_(7)) ? '' : '카카오오류 탭을 못 읽음'; } },
    { 길: '고객 카톡 글 → 넥스 사건처리 조회', fn: function () { return typeof kakaoCaseMessages_ === 'function' ? '' : '카톡 글 읽기가 이 판에 없음'; } },
    // [2026.10.23 ㅅ12차 — 점검표 142] 넥스가 묻는 중에 세무사님이 채팅으로 답한 말을 GAS 규칙이 못 알아들으면 → 대화창 넥스가 열린 질문 목록(cpHint)과 함께 받아 caseproc_answer로 넣기를 제안
    { 길: '채팅 답(GAS 규칙 못 알아들음) → 넥스에게 열린 질문 목록과 함께', fn: function () { try { var p = buildContextSystemPrompt('', { context: { cpHint: { caseId: 'seam', caseName: '시험', state: '시험', open: [{ q: 1, qid: 'x', label: '시험 질문', target: 'ov:시험' }] } } }); var ptxt = (p && typeof p === 'object') ? String(p.full || p.dynamic || '') : String(p || ''); /* buildContextSystemPrompt는 {static, dynamic, full} 묶음을 돌려준다 — @1259 점검이 글자로 보고 "안 붙음"으로 오판 */ if (ptxt.indexOf('[사건처리 질문에 대한 답으로 보임]') === -1) return '열린 질문 목록이 넥스 지시문에 안 붙음'; } catch (e) { return '지시문 만들기 실패: ' + (e && e.message || e); } return (typeof JOB_PROPOSE_ACTIONS_ !== 'undefined' && JOB_PROPOSE_ACTIONS_.caseproc_answer) ? '' : '답 넣기 제안(caseproc_answer)이 이 판에 없음'; } },
    // [2026.10.27 10-27 양도 실사건 A·C·경우별] 넥스(채팅 카드·지휘 도구)와 화면이 같은 서버 입구로 — 확정 칸 고치기(세무사님 값 보호)·질문 닫기·경우(안) 계산 저장·경비 글 → 항목
    { 길: '확정 칸 고치기(넥스 카드·지휘 value_set·화면) — 세무사님 값은 넥스가 못 바꿈', fn: function () {
      if (typeof caseProcValueFix_ !== 'function' || typeof caseProcPrevValue_ !== 'function') return '칸 값 고치기 서버 함수가 이 판에 없음';
      if (!(typeof JOB_PROPOSE_ACTIONS_ !== 'undefined' && JOB_PROPOSE_ACTIONS_.caseproc_fix && JOB_PROPOSE_ACTIONS_.caseproc_undo)) return '채팅 넥스 카드(caseproc_fix·caseproc_undo)가 없음';
      const lt = leadTools(); if (lt.length && !lt.some(function (t) { return t === 'value_set'; })) return '지휘 넥스 value_set이 없음';
      try { const pv = caseProcPrevValue_({ 사건개요: {} }, { trAns: { 'a0.assetType': { v: 'house', src: '세무사님 답(사이드바)', at: '2026-10-27' } } }, 'calc:a0.assetType'); if (!pv || pv.who !== '세무사님') return '세무사님 값 판정이 틀림: ' + JSON.stringify(pv); const pv2 = caseProcPrevValue_({ 사건개요: {} }, { trAns: { costs: { v: { acq: [], tr: [] }, src: '🤖 AI 판단: x' } } }, 'expenses'); if (!pv2 || pv2.who !== '넥스') return '넥스 값 판정이 틀림'; } catch (e) { return '값 주인 판정 실패: ' + (e && e.message || e); }
      return ''; } },
    { 길: '질문 닫기(넥스 카드 caseproc_decide·지휘 close_question·서류 값 기록) → 다음 바퀴에 다시 안 묻기', fn: function () { if (typeof caseProcDecide_ !== 'function') return '질문 닫기 서버 함수가 이 판에 없음'; if (!(typeof JOB_PROPOSE_ACTIONS_ !== 'undefined' && JOB_PROPOSE_ACTIONS_.caseproc_decide)) return '채팅 넥스 카드(caseproc_decide)가 없음'; return need(leadTools(), ['close_question'], '사건 지휘 도구'); } },
    { 길: '경우(안) 세액계산 저장(넥스 카드 calc_scenario·지휘 calc_scenario·세액계산 화면) → 검토서 인용', fn: function () { if (typeof caseProcScenario_ !== 'function' || typeof caseProcCalcCite_ !== 'function') return '경우(안) 계산 서버 함수가 이 판에 없음'; if (!(typeof JOB_PROPOSE_ACTIONS_ !== 'undefined' && JOB_PROPOSE_ACTIONS_.calc_scenario)) return '채팅 넥스 카드(calc_scenario)가 없음'; const m = need(leadTools(), ['calc_scenario'], '사건 지휘 도구'); if (m) return m; try { const lc = caseProcLastCalc_({ 세목: 'transfer', 세액계산결과: [{ id: 'a', 세목: '양도소득세', 최종세액: 1 }, { id: 'b', 세목: '양도소득세', 최종세액: 2, 안: { 이름: '안1' } }] }); if (!lc.last || lc.last.id !== 'a' || !lc.scenarios || lc.scenarios.length !== 1) return '안 저장본이 기본 저장본(최신)을 밀어냄'; } catch (e) { return '저장본 가르기 실패: ' + (e && e.message || e); } return ''; } },
    // [2026.11.01] 세무사님 "넥스플랜이든 뭐든 모든 도구는 넥스가 자유자재로" — 절세플랜 비교 9가지를 화면과 같은 엔진 함수로 넥스가 부름
    { 길: '절세 비교(절세플랜 화면 9가지 = 대화창 넥스 calculate_tax_plan_compare, 같은 엔진 함수) → 사건 연결 시 경우(안) 저장', fn: function () { const ct = chatTools(); if (ct.indexOf('calculate_tax_plan_compare') === -1) return '대화창 넥스 도구에 calculate_tax_plan_compare가 없음'; if (!(typeof BASIC_TOOL_NAMES_ !== 'undefined' && BASIC_TOOL_NAMES_.has('calculate_tax_plan_compare'))) return '절세 비교가 늘 켜진 도구가 아님'; try { const r = runUiEngineCalcTool_('calculate_tax_plan_compare', { kind: 'gen', options: { giftDate: '2026-06-01', amount: 300000000, minor: false } }); if (!r || r.error || !(r.안1_합계 > 0) || !(r.안2_합계 > 0) || !r.가장적은안) return '엔진 절세 비교가 안 돎: ' + JSON.stringify(r || {}).slice(0, 120); } catch (e) { return '엔진 절세 비교 실패: ' + (e && e.message || e); } return ''; } },
    // [2026.11.01 물건 장부] 사건의 물건 목록 — 의뢰 글·서류(caseProcGrasp_) → 사건 장부 obj → 📒 물건 탭(ledgerObjects…) = 넥스 case_ledger do=objects… → 확보할 증빙(소재지 모름) · 양도 자산 칸
    { 길: '물건 목록(의뢰 글·서류 → 사건 장부 물건 줄 ↔ 📒 물건 탭 · 넥스 case_ledger do=objects/object/object_drop/object_sell → 받을 서류·양도 자산 칸)', fn: function () { if (typeof ledgerObjScan_ !== 'function' || typeof ledgerObjSet_ !== 'function' || typeof ledgerObjEvWant_ !== 'function') return '물건 장부 함수가 이 판에 없음'; const tr = String(ledgerToolRun_), ap = String(ledgerApi_); if (tr.indexOf("'objects'") === -1 || tr.indexOf("'object_sell'") === -1) return '넥스 장부 도구에 물건 do가 없음'; if (ap.indexOf('ledgerObjects') === -1 || ap.indexOf('ledgerObjSell') === -1) return '화면 입구(ledgerObjects·ledgerObjSell)가 없음'; if (String(ledgerView_).indexOf('ledgerObjList_') === -1) return '장부 화면이 물건 목록을 안 받음'; if (String(caseProcGrasp_).indexOf('ledgerObjSync_') === -1) return '의뢰 글 읽기가 물건 목록을 안 맞춤'; const sc = ledgerObjScan_('오피스텔 다섯 칸을 보유', '점검'); const n = sc && sc.counts && sc.counts['오피스텔'] ? sc.counts['오피스텔'].n : 0; if (n !== 5) return '"오피스텔 다섯 칸"을 ' + n + '칸으로 읽음'; return ''; } },
    // [2026.11.01] 경우(안) 저장 자리 — 칸(5만 자)에 넘칠 만하면 본문은 사건 장부 폴더 파일, 행 읽기 한 곳에서 다시 붙임
    { 길: '경우(안) 저장 자리(사건 행 칸 ↔ 사건 장부 폴더 <사건ID>.계산저장본.json — 쓰기 work_updateCase, 읽기 work_readRow_)', fn: function () { if (typeof work_calcStoreText_ !== 'function' || typeof work_calcHydrate_ !== 'function') return '저장본 넘기기·다시 붙이기 함수가 이 판에 없음'; const small = [{ id: 'x', 세목: '양도소득세', 최종세액: 1 }]; const st = work_calcStoreText_('점검', small); if (!st || st.error || st.text !== JSON.stringify(small)) return '작은 목록이 칸에 그대로 안 들어감'; if (work_calcHydrate_('점검', small) !== small) return '본문 없는 목록을 다시 붙이려 함'; return ''; } },
    // [2026.10.27 E·F·G] 넥스 질문에 답 칸(target·cands) / 읽을 범위(세무사님 "신고제출 폴더만") / 이미 정하신 값은 다시 묻지 않기
    { 길: '넥스 질문에 답 칸(ask_user target·cands → 화면 input/choose) · 읽을 범위(set_read_scope·caseproc_scope·화면 📂) · 정하신 값 다시 묻지 않기', fn: function () {
      if (typeof caseProcReadScope_ !== 'function' || typeof caseProcScopeView_ !== 'function') return '읽을 범위 서버 함수가 이 판에 없음';
      if (!(typeof JOB_PROPOSE_ACTIONS_ !== 'undefined' && JOB_PROPOSE_ACTIONS_.caseproc_scope)) return '채팅 넥스 카드(caseproc_scope)가 없음';
      const m = need(leadTools(), ['set_read_scope', 'ask_user'], '사건 지휘 도구'); if (m) return m;
      const au = (typeof caseProcAiLiveTools_ === 'function' ? caseProcAiLiveTools_() : []).filter(function (t) { return t.name === 'ask_user'; })[0];
      if (!au || !au.input_schema.properties.target || !au.input_schema.properties.cands) return 'ask_user에 넣을 칸(target)·후보(cands)가 없음 — 화면이 "확인했음" 단추만 띄운다';
      return nxCaseChatGuide_('점검').indexOf('set_read_scope') === -1 ? '지시문에 읽을 범위 도구가 없음' : ''; } },
    // [2026.10.28 읽을 대상 ①~④] 세무사님 원문 "읽을 파일을 체크하여 지정하는 방법은 어떨까?" → "그렇게 만들자." — 판정 함수 하나·체크 목록·목록만 읽기·넥스 파일 단위
    // [2026.10.28] 세무사님 원문: "ai는 포괄적으로 파일에 접근할 수 있어야 하지만 gas는 구체적으로 필요한 것만 콕 집어서 알려주어야 한다" — 넥스 읽기(어떤 파일이든)와 GAS 체크 목록은 다른 길
    // [2026.10.28] 세무사님 원문: "사건폴더의 모든 파일을 모니터링해서 추가 변경된 것을 미리 읽도록 해야 한다"
    // [2026.11.04 혼자 도는 기능 확대 1순위] 고객창구 업로드 → 바로 읽기 줄 / 환경 감시 → 영향 사건 / 밤 점검(기한·미수·멈춘 사건·공유 정리) → 대시보드 「답하실 것」·아침 문자
    { 길: '혼자 도는 점검(AutoWatch) → 「답하실 것」(고객창구 업로드 → 미리 읽기 줄 · 법령 개정 → 영향 사건 · 밤 2시 기한·미수·멈춘 사건·공유 정리 → 대시보드 알림·아침 문자)', fn: function () {
      if (typeof awNoticeAdd_ !== 'function' || typeof awNoticeSeen_ !== 'function' || typeof awLawImpact_ !== 'function' || typeof awNightly_ !== 'function' || typeof awDeadlinesFromResult_ !== 'function' || typeof awPortalUploaded_ !== 'function') return '혼자 도는 점검 함수(AutoWatch.js)가 이 판에 없음';
      if (String(runNightlyChiefManager).indexOf('awNightly_') === -1) return '새벽 2시 묶음이 혼자 도는 점검을 안 부름';
      if (String(custUploadNote_).indexOf('awPortalUploaded_') === -1) return '고객창구 업로드가 읽기 줄에 안 넣음';
      if (String(envWatchLaws_).indexOf('awLawImpact_') === -1) return '환경 감시가 영향 사건을 안 찾음';
      if (String(sendDailyDeadlineDigest).indexOf('awDeadlineLines_') === -1) return '아침 문자에 판정 기한 줄이 없음';
      if (String(commStatus_).indexOf('autoNotices') === -1) return '대시보드로 가는 알림 칸이 없음';
      const d = awDeadlinesFromResult_({ 묶음: '시험', 신고기한: '2026-12-31', 안쪽: { 납부기한: '2027-01-31', 잠정: true }, 기한: [{ 이름: '청구', 마감: '2026-11-30' }] });
      if (d.length !== 3 || !d.some(function (x) { return x.이름 === '납부기한' && x.잠정; })) return '판정 결과에서 기한 뽑기가 다름(' + d.length + '개)';
      return '';
    } },
    { 길: '서류 변동 → 넥스 미리 읽기 → 채팅 보고(미리 읽기 틱 모든 파일 감시 → 기록부 파일 지문·서류 변동 → 진행 중 사건 넥스 깨움(밤엔 미룸) → 읽음 기록·알림·채팅 한 줄)', fn: function () {
      if (typeof cpWatchCase_ !== 'function' || typeof cpWatchTick_ !== 'function' || typeof cpNexPrereadWake_ !== 'function' || typeof cpNexChatNote_ !== 'function' || typeof cpNexPrereadSwitch_ !== 'function') return '감시·미리 읽기 서버 함수가 이 판에 없음'; if (typeof cpLedgerStaleRun_ !== 'function' || typeof ledgerKbBuild_ !== 'function') return '서류 변동 → 사건 장부 바로 갱신 함수가 이 판에 없음';
      let trig = false; try { trig = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'cpPrereadTick'; }); } catch (e) { trig = true; }
      if (!trig) return '미리 읽기 틱 트리거가 없음(cpPrereadEnsureTrigger_)';
      const txt = typeof nxCaseChatGuide_ === 'function' ? nxCaseChatGuide_('점검') : '';
      if (txt.indexOf('✓ 전에 읽음') === -1) return '지휘 지시문에 미리 읽기 표시(🆕/✏/✓) 설명이 없음';
      if (typeof cpWatchNight_ !== 'function' || cpWatchNight_(new Date(2026, 0, 1, 23, 0)) !== true || cpWatchNight_(new Date(2026, 0, 1, 9, 0)) !== false) return '밤 시간 판정(22~07시)이 다름';
      return '';
    } },
    { 길: '넥스 폭넓은 파일 읽기(지휘 case_files/file_read · 대화창 job_lookup case_files/file_read — 체크 목록과 무관, 어떤 파일이든, 토큰 0)', fn: function () {
      if (typeof caseProcNexFileList_ !== 'function' || typeof caseProcNexFileText_ !== 'function') return '넥스 파일 목록·글 읽기 서버 함수가 이 판에 없음';
      const names = (typeof caseProcAiLiveTools_ === 'function' ? caseProcAiLiveTools_() : []).map(function (t) { return t.name; });
      if (names.indexOf('case_files') === -1 || names.indexOf('file_read') === -1) return '지휘 넥스에 case_files/file_read 도구가 없음';
      const lk = (typeof JOB_AI_TOOLS_ !== 'undefined' ? JOB_AI_TOOLS_ : []).filter(function (t) { return t.name === 'job_lookup'; })[0];
      if (lk) { const en = ((lk.input_schema || {}).properties || {}).kind; if (!en || !en.enum || en.enum.indexOf('case_files') === -1 || en.enum.indexOf('file_read') === -1) return '대화창 넥스 job_lookup에 case_files/file_read가 없음'; }
      const txt = typeof nxCaseChatGuide_ === 'function' ? nxCaseChatGuide_('점검') : '';
      if (txt.indexOf('어떤 파일이든') === -1 || txt.indexOf('GAS가 읽을 파일은') === -1) return '지휘 지시문에 넥스 폭넓은 읽기·GAS 체크 목록 구분이 없음';
      return '';
    } },
    { 길: '읽을 파일 체크 목록(화면 📂·⚡ 첫 실행 → step readList/readScope list) · 폴더·파일 판정 하나(⚡·미리 읽기·글자 기억·직결) · 넥스 set_read_scope on/off', fn: function () {
      if (typeof caseProcFolderRule_ !== 'function' || typeof caseProcFileRule_ !== 'function') return '폴더·파일 판정 함수가 이 판에 없음';
      if (typeof caseProcReadList_ !== 'function' || typeof caseProcReadListSave_ !== 'function' || typeof caseProcNewFiles_ !== 'function') return '체크 목록 서버 함수가 이 판에 없음';
      try { if (caseProcFolderRule_('보고서_내부', null, {}).kind !== 'skip' || caseProcFolderRule_('제출자료', null, {}).kind !== 'input') return '폴더 판정이 다름'; const fr = caseProcFileRule_({ name: '사진.jpg', mimeType: 'image/jpeg' }, null, 'input'); if (fr.on || fr.kind !== 'image') return '이미지가 기본 체크됨(10-27 결정 위반)'; if (!caseProcFileRule_({ name: '매매계약서.pdf', mimeType: 'application/pdf' }, null, 'input').on) return 'PDF가 기본 꺼짐'; } catch (e) { return '판정 실행 실패: ' + (e && e.message || e); }
      if (typeof CP_PREREAD_SKIP_DIR_ !== 'undefined') return '미리 읽기가 별도 폴더 규칙을 아직 씀';
      const st = (typeof caseProcAiLiveTools_ === 'function' ? caseProcAiLiveTools_() : []).filter(function (t) { return t.name === 'set_read_scope'; })[0];
      if (!st || !st.input_schema.properties.on || !st.input_schema.properties.off) return '지휘 넥스 set_read_scope에 파일 단위(on/off)가 없음';
      // [2026.10.28 뒤] 세무사님 결정으로 "목록이 없으면 세무사님께 먼저" 문구는 지움(넥스가 읽고 판단해 직접 정함) — 새 지시문 기대: 체크 목록은 GAS 몫 + 읽기 → 판단 → set_read_scope 순서, 도구 설명 "GAS가 읽을 파일"
      const txt = nxCaseChatGuide_('점검');
      if (txt.indexOf('체크 목록은 GAS') === -1) return '지시문에 "체크 목록은 GAS(…)가 읽을 파일을 콕 집어 주는 것"이 없음';
      if (txt.indexOf('case_files로 폴더 파일 목록 보기') === -1 || txt.indexOf('set_read_scope로 GAS에게 체크 목록 지정') === -1) return '지시문에 "case_files 목록 보기 → file_read → 판단 → set_read_scope → gas_run" 순서가 없음';
      if (!/GAS가 읽을 파일/.test(String(st.description || ''))) return 'set_read_scope 설명에 "GAS가 읽을 파일"이 없음(넥스 읽기 범위와 구분)';
      return ''; } },
    { 길: '말로 한 필요경비 → 항목(이름·금액) — 빈 값으로 저장하지 않음', fn: function () { if (typeof cpExpAmountsFromText_ !== 'function') return '경비 글 풀기 함수가 이 판에 없음'; try { const r = cpAnswerValueNorm_('expenses', '취득세교육세 3,583,600원, 등기제비용 426,110원, 법무사수수료 385,000원', { cands: [] }); const d = JSON.parse(r.value || '{}'); if (!d.items || d.items.length !== 3 || d.items[0].amount !== 3583600 || d.items[2].amount !== 385000) return '경비 3건이 항목으로 안 풀림: ' + String(r.value).slice(0, 160); const r2 = cpAnswerValueNorm_('expenses', '경비는 대략 몇백만원쯤 됩니다', { cands: [] }); if (!r2.error) return '못 푼 경비 글이 빈 값(0건)으로 통과함'; const r3 = cpAnswerValueNorm_('expenses', '필요경비 없음', { cands: [] }); if (r3.error || JSON.parse(r3.value).items.length !== 0) return '"없음"이 0건으로 안 들어감'; } catch (e) { return '경비 글 풀기 실패: ' + (e && e.message || e); } return ''; } },
    // [2026.10.23 ㅅ13차 — 점검표 168] 넥스 제안 카드 → GAS 답 넣기: 넥스가 객체로 준 필요경비 값이 그 칸 모양(items)으로 바뀌어 0건이 되지 않는지
    // [2026.10.28 🌐 바깥 조회] 세무사님 "왜 전혀 자료수집을 하지 않느냐" — 소재지가 있는 모든 부동산에 토지대장·토지이용계획·공시가격·건축물대장 묶음이
    //  ⚡(양도·증여·상속)·직결 뒤·세액계산기 버튼·넥스 도구 네 길에서 같은 함수로 돌고, 결과가 반영 현황표 「🌐 바깥 조회」 줄·확보자료 PDF로 돌아오는지
    { 길: '🌐 바깥 조회(토지대장·토지이용계획·공시가격·건축물대장) → ⚡ 양도·증여·상속 기본 단계 · 직결 뒤(t6ApplyRead_) · 계산기 🔍 토지정보 · 넥스 lookup_land_info → 현황표·확보자료', fn: function () {
      var fns = { cpOutsideRun_: typeof cpOutsideRun_, cpOutsideOne_: typeof cpOutsideOne_, trcOutside_: typeof trcOutside_, cpOutsideAfterDirect_: typeof cpOutsideAfterDirect_, cpLandLedger_: typeof cpLandLedger_, cpLandUse_: typeof cpLandUse_, handleLookupLandInfo: typeof handleLookupLandInfo, handleSearchAddressKakao: typeof handleSearchAddressKakao };
      var miss = Object.keys(fns).filter(function (n) { return fns[n] !== 'function'; });
      if (miss.length) return '없는 함수: ' + miss.join(', ');
      try { var src = String(t6ApplyRead_.toString()); if (src.indexOf('cpOutsideAfterDirect_') === -1) return '직결 뒤 바깥 조회가 끊김'; } catch (e) { return '직결 저장 함수를 못 봄'; }
      try { var st = String(caseProcStatus_.toString()); if (st.indexOf('🌐 바깥 조회') === -1) return '반영 현황표에 바깥 조회 줄이 없음'; } catch (e) { return '현황표 함수를 못 봄'; }
      try { var tr = String(trcOverview_.toString()); if (tr.indexOf('trcOutside_') === -1) return '양도 ⚡에서 바깥 조회가 끊김'; } catch (e) { return '양도 처리 함수를 못 봄'; }
      // [2026.10.28 점검 보완] 지역 구분·조정대상지역 이력표·건물 기준시가 입력·층별 용도·허가구역이 묶음 안에 붙어 있는지
      try { var one = String(cpOutsideOne_.toString()); var need = ['cpRegion_', 'caseProcAdjAreaAt_', 'stdStructure', 'floors', 'permit', 'cpEumLand_']; var miss2 = need.filter(function (k) { return one.indexOf(k) === -1; }); if (miss2.length) return '묶음에서 빠짐: ' + miss2.join(','); } catch (e) { return '묶음 함수를 못 봄'; }
      try { var mx = String(trcMixedHouse_.toString()); if (mx.indexOf('S.facts.outside') === -1) return '겸용주택 판단이 바깥 조회 층별 용도를 안 씀'; } catch (e) { return '겸용주택 함수를 못 봄'; }
      return '';
    } },
    { 길: '넥스 제안 카드(답 넣기) → GAS 칸 반영(값 모양 맞추기)', fn: function () { if (typeof cpAnswerValueNorm_ !== 'function') return '값 모양 맞추기가 이 판에 없음'; try { var r = cpAnswerValueNorm_('expenses', { 양도비용: 4480000, 취득비용: 8160000 }, { cands: [{ kind: '양도', label: '중개보수', amount: 4480000, file: '중개보수영수증.pdf' }] }); var d = JSON.parse(r.value); if (!d || !Array.isArray(d.items) || d.items.length !== 2 || d.items[0].label !== '중개보수' || d.items[1].kind !== '취득') return '객체 값이 items 2건으로 안 바뀜: ' + r.value.slice(0, 120); if (/\[object/.test(r.shown)) return '카드 글에 [object Object]'; } catch (e) { return '값 모양 맞추기 실패: ' + (e && e.message || e); } return ''; } },
    // [2026.11.01 종합판정 ①] 비과세·공제·감면 종합판정(1세대1주택) — 넥스 judge_tax_relief·case_ledger do=judge·화면 「판정」(ledgerJudge)이 같은 함수(ledgerJudgeRun_ → 엔진 judgeTaxReliefJS)로 장부 1세대1주택 칸·검토서에 닿는지
    { 길: '종합판정(1세대1주택) — 넥스·화면 같은 함수 → 장부 칸·검토서', fn: function () { var m = need(chatTools(), ['judge_tax_relief'], '대화창 도구'); if (m) return m; if (typeof ledgerJudgeRun_ !== 'function' || typeof ledgerJudgeLabel_ !== 'function') return '장부 판정 함수가 이 판에 없음'; try { var src = String(ledgerToolRun_) + String(ledgerApi_); if (src.indexOf('ledgerJudgeRun_') === -1) return '장부 도구·화면 입구에 판정이 안 이어짐'; if (String(ledgerReviewNotes_).indexOf('ledgerJudgeLabel_') === -1) return '검토서 메모가 판정 글을 안 씀'; } catch (e) { return '장부 함수를 못 봄'; } try { var eng = getUiCalcEngine_(); if (typeof eng.judgeTaxReliefJS !== 'function') return '엔진에 판정 셈 없음'; var r = eng.judgeTaxReliefJS({ 묶음: '1세대1주택', 양도일: '2025-06-01', 대상: { 취득일: '2020-01-01', 양도가액: 500000000, 취득당시조정: false }, 세대: { 거주자: true, 배우자: true }, 물건: [{ 이름: '판정 주택', 종류: '주택', 주택수: '든다', 대상: true }] }); return r && r.결론 === '충족' && !r.잠정 ? '' : '시험 판정이 어긋남: ' + (r && r.표시); } catch (e) { return '엔진 판정 오류: ' + e.message; } } },
    // [2026.11.04 넥스 운영 시험] 넥스 판정 찾기(find_judgment) — 화면 판정 창과 같은 목록(judgeCatalog_)에서 낱말로 묶음을 찾아 judge_tax_relief로 잇는 길
    // [2026.11.04 넥스 운영 시험] 사건 없이 부른 판정 묶음(넥스가 caseId를 안 넣을 때) — 영문 칸을 지우는 매핑 뒤에도 108개 묶음이 judgeMoreRun_로 가야 한다(A~D 넷 다 옛 엔진 오류였던 사고)
    { 길: '넥스 judge_tax_relief 사건 없이 → 판정 묶음(judgeMoreRun_ c=null)', fn: function () { var r = judgeMoreRun_(null, { 묶음: '상속인', facts: { 사망일: '2026-01-10', 배우자: true }, write: false }, '점검'); if (!r || !r.ok || !r.결과 || !/상속인/.test(String(r.결과.묶음 || ''))) return '사건 없는 판정 묶음 길이 끊김: ' + JSON.stringify(r).slice(0, 120); return ''; } },
    { 길: '넥스 판정 찾기(find_judgment) → judge_tax_relief', fn: function () { var m = need(chatTools(), ['find_judgment', 'judge_tax_relief'], '대화창 도구'); if (m) return m; if (typeof nxFindJudgment_ !== 'function') return '판정 찾기 함수 없음(JudgeForm.js nxFindJudgment_)'; var r = nxFindJudgment_({ query: '상속 포기 배우자공제' }); if (!r || !r.ok || !r.판정 || !r.판정.length) return '판정 찾기가 「상속 포기 배우자공제」로 아무 묶음도 못 찾음'; if (!r.판정.some(function (x) { return /상속인|인적공제/.test(x.묶음 + x.이름); })) return '「상속 포기 배우자공제」로 상속인·인적공제 묶음이 안 나옴: ' + r.판정.map(function (x) { return x.묶음; }).join('·'); return ''; } },
    // [2026.11.04 큰일 ④] 화면 판정 창 — 목록·장부 미리 채우기가 넥스와 같은 판정 묶음(JUDGE_MORE_)을 보고, 돌리기·남기기는 넥스와 같은 입구(ledgerJudgeRun_)로
    { 길: '판정 창 — 화면 목록·미리 채우기 → 넥스와 같은 판정 묶음·장부', fn: function () { if (typeof judgeListApi_ !== 'function' || typeof judgePrefill_ !== 'function' || typeof ledgerJudgeRun_ !== 'function') return '판정 창 서버 함수 없음(JudgeForm.js)'; var L = judgeListApi_(); if (!L || !L.판정 || L.판정.length < 20) return '판정 목록이 비거나 너무 적음(' + (L && L.판정 ? L.판정.length : 0) + ')'; var nf = L.판정.filter(function (x) { return !x.따로창 && !x.칸.length; }); return nf.length ? '칸을 못 뽑은 판정: ' + nf.map(function (x) { return x.묶음; }).join('·') : ''; } },
    // [2026.11.01 복잡사건] 고객(가족) 지도·잇기 계산·미래 계획·판정 묶음(8년자경·동거주택·가업상속) — 넥스 case_ledger do=family…plan·judge가 같은 함수로 가족 지도 파일·장부 계산에 닿는지
    { 길: '가족 지도·잇기·미래 계획·판정 묶음 — 넥스 → 가족 지도·장부 계산', fn: function () { if (typeof famView_ !== 'function' || typeof famPlanCompute_ !== 'function' || typeof famChainRun_ !== 'function' || typeof judgeMoreRun_ !== 'function' || typeof judgeIncorp32_ !== 'function') return '가족 지도·판정 묶음 함수가 이 판에 없음'; try { var src = String(ledgerToolRun_); if (src.indexOf('famView_') === -1 || src.indexOf('famPlanRun_') === -1) return '장부 도구에 가족 지도가 안 이어짐'; if (String(ledgerJudgeRun_).indexOf('judgeMoreRun_') === -1) return '판정이 새 묶음으로 안 넘어감'; if (String(ledgerCalcGiftInh_).indexOf('famAutoPriorGift_') === -1) return '증여·상속 계산이 지난 증여를 안 봄'; } catch (e) { return '장부 함수를 못 봄'; } try { var F = { 사람: [{ id: 'p1', 이름: '갑' }, { id: 'p2', 이름: '을' }], 이전: [{ id: 't1', 종류: '증여', 날짜: '2020-03-01', 주는: 'p1', 받는: 'p2', 관계: '직계비속', 금액: 100000000, 산출세액: 5000000 }], 계획: [] }; var pg = famPriorGifts_(F, { date: '2025-03-01', donee: 'p2', donor: 'p1', relation: '직계존속', amount: 50000000 }); if (pg.합계 !== 100000000) return '지난 증여 합산 셈이 어긋남(' + pg.합계 + ')'; var j = judgeCohabit_({}); if (!j || !j.요건) return '판정 묶음 셈이 결과를 안 냄'; } catch (e) { return '가족 지도 셈 오류: ' + e.message; } return ''; } },
    // [2026.11.04 큰일 ⑦] 가족 지도 법인·지분 — 제2차 납세의무·법인거래 판정, 특정법인·일감 계산 도구가 칸이 비면 지도 지분을 읽는지
    { 길: '가족 지도 법인·지분 → 판정·특정법인·일감 도구', fn: function () { if (typeof famHoldings_ !== 'function' || typeof famCorpFill_ !== 'function' || typeof nxFamCorpFill_ !== 'function') return '법인·지분 함수가 이 판에 없음'; try { if (String(judgeMoreRun_).indexOf('famCorpFill_') === -1) return '판정이 지도 지분을 안 읽음'; if (String(toolCalculateSpecificCorporationGiftTax).indexOf('nxFamCorpFill_') === -1 || String(toolCalculateRelatedPartyTransactionGiftTax).indexOf('nxFamCorpFill_') === -1) return '특정법인·일감 도구가 지도 지분을 안 읽음'; if (String(ledgerToolRun_).indexOf('famShareSet_') === -1) return '장부 도구에 지분 적기가 안 이어짐'; var F = { 사람: [{ id: 'p1', 이름: '갑' }, { id: 'p2', 이름: '을' }], 이전: [{ id: 't1', 종류: '증여', 날짜: '2025-01-01', 주는: 'p1', 받는: 'p2', 법인: '가나', 지분: 10 }], 법인: [{ id: 'k1', 이름: '가나' }], 지분: [{ id: 's1', 사람: 'p1', 법인: '가나', 비율: 70, 기준일: '2020-01-01' }] }; var H = famHoldings_(F, '가나', '2026-01-01'); var g = H.주주.filter(function (x) { return x.이름 === '을'; })[0]; if (!g || g.비율 !== 10 || H.합계 !== 70) return '지분 이전 셈이 어긋남'; } catch (e) { return '법인·지분 셈 오류: ' + e.message; } return ''; } },
    // [2026.11.02 쪼개 처리] 도구 결과(계산·계획·판정·조회)를 자문 항목이 인용 · 물건별 모아 보기 · 쟁점별 처리 점검 · 보고서 저장 때 넥스에게 세액 대조
    // [2026.11.02 복잡사건 23] 비사업용 토지 판정 — 넥스 calculate_non_business_land와 화면 판정 창이 같은 엔진 함수(calculateNonBusinessLandJS)를 부르는지
    { 길: '비사업용 토지 판정 — 넥스·화면 같은 엔진 함수', fn: function () { var m = need(chatTools(), ['calculate_non_business_land'], '대화창 도구'); if (m) return m; try { var e = getUiCalcEngine_(); if (typeof e.calculateNonBusinessLandJS !== 'function') return '엔진에 판정 함수 없음'; var r = e.calculateNonBusinessLandJS({ landType: 'farmland', holdingYears: 8, businessUseYears: 0, transferDate: '2026-10-15', acquisitionCause: 'inheritance', inheritanceDate: '2018-07-01', ancestorFarmed8Years: true }); return r && r.비사업용여부 === false ? '' : '8년 자경 상속 농지가 사업용으로 안 나옴'; } catch (err) { return '엔진 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 54] 상속재산 재분할 증여 판정 — 넥스 calculate_inheritance_redivision_gift가 엔진 함수에 닿는지
    { 길: '상속재산 재분할 증여 판정 — 넥스 → 엔진 함수', fn: function () { var m = need(chatTools(), ['calculate_inheritance_redivision_gift'], '대화창 도구'); if (m) return m; try { var e = getUiCalcEngine_(); if (typeof e.calculateInheritanceRedivisionGiftJS !== 'function') return '엔진에 재분할 판정 함수 없음'; var r = e.calculateInheritanceRedivisionGiftJS({ inheritanceDate: '2025-08-20', redivisionDate: '2026-05-15', items: [{ name: '아파트', valueAtRedivision: 1000000000, before: { 장남: 1 }, after: { 장남: 0.6, 차남: 0.4 } }] }); return r && r.증여여부 === true && r.증여자별[0].증여재산가액 === 400000000 ? '' : '신고기한 뒤 재분할 4억이 증여로 안 나옴'; } catch (err) { return '엔진 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 55] 유류분 부족액·반환 — 넥스 calculate_forced_share_return이 엔진 함수에 닿는지
    { 길: '유류분 부족액·반환 세금 효과 — 넥스 → 엔진 함수', fn: function () { var m = need(chatTools(), ['calculate_forced_share_return'], '대화창 도구'); if (m) return m; try { var e = getUiCalcEngine_(); if (typeof e.calculateForcedShareReturnJS !== 'function') return '엔진에 유류분 함수 없음'; var r = e.calculateForcedShareReturnJS({ deathDate: '2026-03-10', estateAtDeath: 0, heirs: [{ name: '장남', relation: 'child', legalShare: 0.5, gifts: 1000000000, giftValueAtGiftTime: 1000000000, giftDate: '2014-01-01' }, { name: '차남', relation: 'child', legalShare: 0.5 }] }); return r && r.기초재산 === 1000000000 && r.반환[0] && r.반환[0].증여에서 === 250000000 ? '' : '유류분 2.5억 반환이 안 나옴'; } catch (err) { return '엔진 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 56] 증여재산 반환·재증여 판정 — 넥스 calculate_gift_return이 엔진 함수에 닿는지
    { 길: '증여재산 반환·재증여 판정 — 넥스 → 엔진 함수', fn: function () { var m = need(chatTools(), ['calculate_gift_return'], '대화창 도구'); if (m) return m; try { var e = getUiCalcEngine_(); if (typeof e.calculateGiftReturnJS !== 'function') return '엔진에 증여 반환 함수 없음'; var a = e.calculateGiftReturnJS({ giftDate: '2026-03-12', returnDate: '2026-06-20', giftValue: 1000000000 }), b = e.calculateGiftReturnJS({ giftDate: '2026-03-12', returnDate: '2026-09-15', giftValue: 1000000000 }); return a && a.당초증여_과세 === false && b.당초증여_과세 === true && b.반환_과세 === false ? '' : '신고기한 안·뒤 3개월 반환 판정이 틀림'; } catch (err) { return '엔진 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 57] 사업기회 제공 증여의제 — 넥스 calculate_business_opportunity_gift_tax가 엔진의 배당 공제 산식·제외 법인 관문에 닿는지
    { 길: '사업기회 제공 증여의제(배당 공제·제외 법인) — 넥스 → 엔진 함수', fn: function () { var m = need(chatTools(), ['calculate_business_opportunity_gift_tax'], '대화창 도구'); if (m) return m; try { var e = getUiCalcEngine_(); var b = { phase: 'initial', profitFromOpportunity: 600000000, shareholderOwnershipRatio: 90, doneeOwnershipRatio: 70, corporateTaxAfterCredit: 120000000, corporateTaxableIncome: 800000000, monthsInInitialYear: 9 }; var a = e.calculateBusinessOpportunityGiftTaxJS(Object.assign({}, b, { dividendIncome: 100000000, distributableProfit: 1000000000 })), x = e.calculateBusinessOpportunityGiftTaxJS(Object.assign({}, b, { providerIsSME: true })); return a && a.배당공제 === 200000000 && a.증여의제이익 === 1200000000 && x.과세대상여부 === false ? '' : '배당 공제 산식이나 중소기업 제외가 안 맞음'; } catch (err) { return '엔진 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 58] 제사용 재산 필지별 — 넥스 calculate_nontaxable_inheritance_property(items)가 엔진의 면적·받는 사람 판정에 닿는지
    { 길: '넥스 → 제사용 재산 필지별 비과세(금양임야·묘토 면적 한도·제사 주재 상속인)', fn: function () { var m = need(chatTools(), ['calculate_nontaxable_inheritance_property'], '대화창 도구'); if (m) return m; try { var e = getUiCalcEngine_(); var r = e.calculateNontaxableInheritancePropertyJS({ itemType: 'ancestral_property', ritualHosts: ['갑'], items: [{ kind: 'forest', area: 19800, value: 100000000, inheritor: '갑' }, { kind: 'paddy', area: 1000, value: 10000000, inheritor: '을' }] }); var ok = r && r.비과세금액 === 50000000 && r.물건별 && r.물건별[1].비과세 === 0; return ok ? '' : '면적 한도·받는 사람 판정이 기대와 다름'; } catch (err) { return '엔진 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 59] 매매계약 해제 — 넥스 judge 「계약해제」가 양도시기 뒤 해제·위약금 기타소득·경정청구 기한을 돌려주는지
    { 길: '넥스 → 매매계약 해제 판정(양도시기 뒤 해제·몰취 계약금 기타소득·경정청구 기한)', fn: function () { try { var r = JUDGE_MORE_['계약해제']({ 잔금일: '2026-03-31', 해제일: '2026-07-10', 해제종류: '법정', 신고함: '예', 입장: '매도인', 받은계약금: 100000000, 돌려준금액: 50000000 }); var ok = r && r.결론 === '충족' && r.기타소득_위약금 === 50000000 && r.할일.length === 1 && r.할일[0].때 === '2026-10-12까지'; return ok ? '' : '해제 판정이 기대와 다름: ' + (r && r.표시); } catch (err) { return '판정 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 60] 동시사망·태아·실종선고 — 넥스 judge 「상속인」이 배우자 동시사망·태아 공제·실종선고일을 엔진칸으로 돌려주는지
    { 길: '넥스 → 상속인 판정(동시사망 배우자 빼기·태아 미성년자공제·실종선고 상속개시일)', fn: function () { try { var a = JUDGE_MORE_['상속인']({ 사망일: '2026-03-14', 배우자: { 이름: '처', 사망일: '2026-03-14' }, 자녀: [{ 이름: '아들', 태아: '예' }] }); var b = JUDGE_MORE_['상속인']({ 실종기간만료일: '2020-06-01', 실종선고일: '2026-02-20', 자녀: [{ 이름: '딸' }] }); var ok = a.엔진칸.hasSpouse === false && a.엔진칸.minorHeirRemainingYears === 19 && a.엔진칸.childCount === 1 && b.엔진칸.dateOfDeath === '2026-02-20' && b.세법상_상속개시.신고기한 === '2026-08-31'; return ok ? '' : '상속인 판정 엔진칸이 기대와 다름'; } catch (err) { return '판정 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 61] 한정승인 — 넥스 judge 「한정승인」이 채무 초과분을 끊고 사전증여를 더한 과세가액·상속인별 칸·경매 양도 취득가액을 돌려주는지
    { 길: '넥스 → 한정승인 판정(기한·채무 초과분 0·사전증여 가산·경매 양도소득세)', fn: function () { try { var r = JUDGE_MORE_['한정승인']({ 사망일: '2026-04-20', 한정승인신고일: '2026-07-01', 재산: [{ 이름: '상가', 평가액: 600000000, 경매일: '2026-12-10', 경락가: 700000000 }], 채무: 900000000, 사전증여: [{ 받은사람: '아들', 금액: 300000000, 증여일: '2019-05-01', 과세표준: 250000000, 낸증여세: 40000000 }] }); var ok = r.결론 === '충족' && r.엔진칸.taxableEstateAmount === 300000000 && r.엔진칸.priorGiftHeirs[0].heirTaxableAmount === 300000000 && r.경매양도[0].양도차익 === 100000000 && r.한정승인마감 === '2026-07-20'; return ok ? '' : '한정승인 판정이 기대와 다름: ' + r.표시; } catch (err) { return '판정 호출 실패: ' + err.message; } } },
    // [2026.11.04 복잡사건 123] 신탁상속 — 넥스 judge 「신탁상속」이 유언대용신탁을 상속재산에 넣고 금전신탁만 금융재산·손자 몫 세대생략으로 가르는지
    { 길: '넥스 → 문화유산 상속세 징수유예 판정(상증법 §74)', fn: function () { try { var r = JUDGE_MORE_['문화유산징수유예']({ 상속개시일: '2026-02-10', 담보: '아니오', 재산: [{ 종류: '국가지정', 가액: 2000000000 }, { 종류: '박물관자료', 박물관: '국공립', 전시일: '2026-05-01', 가액: 500000000 }, { 종류: '그림', 가액: 100000000 }], 엔진칸: { taxableEstateAmount: 10000000000, grossEstateValue: 10000000000 } }); var c = r && r.엔진칸 || {}; return r && r.유예재산가액 === 2500000000 && c.culturalPropertyValue === 2500000000 && r.요건못채움 === 100000000 ? '' : '문화유산 징수유예 판정이 유예 대상·엔진칸을 바르게 가르지 못함'; } catch (e) { return '문화유산 징수유예 판정 오류: ' + e; } } },
    { 길: '넥스 → 상속세 외국납부세액공제 판정(상증법 §29·시행령 §21)', fn: function () { try { var r = JUDGE_MORE_['상속외국납부']({ 피상속인거주자: '예', 우리과세표준: 1000000000, 산출세액: 300000000, 나라들: [{ 나라: '미국', 세종류: '상속세', 외국과세표준: 200000000, 외국납부세액: 80000000, 결정상태: '확정' }] }); return r && r.공제액 === 60000000; } catch (e) { return false; } } },
    { 길: '넥스 → 주식 취득분 맞추기 판정(소득세법 시행령 §162⑤ 먼저 산 것 먼저)', fn: function () { try { var r = JUDGE_MORE_['주식취득분']({ 대주주: '예', 중소기업: '아니오', 취득구분분명: '아니오', 매수: [{ 회차: '1', 취득일: '2020-01-10', 주수: 100, 취득가액: 1000000 }, { 회차: '2', 취득일: '2024-01-10', 주수: 100, 취득가액: 5000000 }], 양도: [{ 양도일: '2024-06-10', 주수: 100, 양도가액: 6000000 }] }); return r && r.경우[0].칸.length === 1 && r.경우[0].칸[0].엔진칸.acquisitionPrice === 1000000; } catch (e) { return false; } } },
    { 길: '넥스 → 증여일 판정(상증법 §32·시행령 §24 증여재산 취득시기)', fn: function () { try { var r = JUDGE_MORE_['증여일']({ 증여자관계: '아버지', 재산들: [{ 이름: '아파트', 종류: '부동산', 가액: 500000000, 계약일: '2026-01-20', 등기접수일: '2026-02-03' }] }); return r && r.표[0].증여일 === '2026-02-03' && r.표[0].신고기한 === '2026-05-31'; } catch (e) { return false; } } },
    { 길: '넥스 → 가업승계 주식 증여 특례 판정(조특법 §30의6·조특령 §27의6)', fn: function () { try { var r = JUDGE_MORE_['가업승계증여']({ 증여일: '2026-03-10', 수증자나이: 35, 증여자나이: 65, 수증자거주자: '예', 증여자관계: '아버지', 기업규모: '중소', 계속경영연수: 25, 증여자지분율: 80, 지분보유연수: 25, 대표재직연수: 25, 영위연수: 25, 최대주주등에게서: '아니오', 주식가액: 5000000000, 총자산: 10000000000, 사업무관자산: 1000000000, 종사시작일: '2025-01-01', 대표취임일: '2027-01-01', 처벌: '아니오' }); return r && r.가업자산상당액 === 4500000000 && r.결론 !== '미충족'; } catch (e) { return false; } } },
    { 길: '넥스 → 상속추정재산 판정(상증법 §15·시행령 §11)', fn: function () { try { var r = JUDGE_MORE_['상속추정재산']({ 상속개시일: '2026-06-15', 거래들: [{ 날짜: '2026-01-10', 구분: '인출', 재산종류: '현금예금유가증권', 금액: 300000000, 용도: '미소명' }] }); return r && r.추정액 === 240000000; } catch (e) { return false; } } },
    { 길: '넥스 → 보험금과세 판정(상증법 §8·§34·시행령 §4①)', fn: function () { try { var r = JUDGE_MORE_['보험금과세']({ 상속개시일: '2026-07-15', 피상속인: '부', 계약들: [{ 이름: '가', 계약자: '장남', 피보험자: '부', 수익자: '장남', 사고: '사망', 보험금: 300000000, 납부: [{ 누가: '부', 금액: 60000000 }, { 누가: '장남', 금액: 40000000, 재원: '본인소득' }] }] }); return r && r.상속재산으로보는보험금 === 180000000; } catch (e) { return false; } } },
    { 길: '넥스 → 대여금채권 판정(상증령 §58②·규칙 §18의2②)', fn: function () { try { var r = JUDGE_MORE_['대여금채권']({ 평가기준일: '2026-07-15', 채권들: [{ 이름: '시험', 관계: '남', 원본: 100000000, 약정이자율: 0, 만기일: '2027-01-15' }] }); return !!(r && r.채권평가액 === 100000000); } catch (e) { return false; } } },
    { 길: '넥스 → 사망퇴직금 판정(상증법 §10)', fn: function () { try { var r = JUDGE_MORE_['사망퇴직금']({ 상속개시일: '2026-07-15', 지급들: [{ 이름: '퇴직금', 금액: 100000000, 지급근거법: '회사규정', 명칭: '퇴직금' }, { 이름: '유족연금', 금액: 50000000, 지급근거법: '국민연금법', 명칭: '유족연금' }] }); return !!(r && r.상속재산으로보는금액 === 100000000); } catch (e) { return false; } } },
    { 길: '넥스 → 교차증여 판정(국세기본법 §14③)', fn: function () { try { var r = JUDGE_MORE_['교차증여']({ 증여들: [{ 이름: '가', 증여자: '갑', 수증자: '을2', 관계: '기타친족', 증여일: '2026-03-02', 금액: 100000000, 실질증여자: '을', 실질관계: '직계존속' }, { 이름: '나', 증여자: '을', 수증자: '갑2', 관계: '기타친족', 증여일: '2026-03-02', 금액: 100000000, 실질증여자: '갑', 실질관계: '직계존속' }] }); return !!(r && r.짝 && r.짝.length === 1 && r.경우.length === 2); } catch (e) { return false; } } },
    { 길: '넥스 → 자기주식 판정(소득세법 §17②1호·§94①3호)', fn: function () { try { var r = JUDGE_MORE_['자기주식']({ 거래들: [{ 이름: '시험', 관계: '배우자', 증여일: '2026-01-02', 증여재산가액: 100000000, 넘긴날: '2026-03-02', 받은돈: 100000000, 목적: '소각' }] }); return !!(r && r.거래표 && r.거래표[0].수증자의제배당 === 0); } catch (e) { return false; } } },
    { 길: '넥스 → 합병 의제배당 판정(소득세법 §17②4호·시행령 §27①1호)', fn: function () { try { var r = JUDGE_MORE_['합병의제배당']({ 적격: '아니오', 등기일: '2026-09-01', 주주들: [{ 이름: '시험', 옛주식수: 100, 옛취득가액: 1000000, 새주식수: 100, 새주식시가: 30000, 받은돈: 0 }] }); return !!(r && r.주주표 && r.주주표[0].비적격의제배당 === 2000000); } catch (e) { return false; } } },
    { 길: '넥스 → 공동명의 전환 판정(상증법 §53·소득세법 §97의2①·시행령 §156①)', fn: function () { try { var r = JUDGE_MORE_['공동명의']({ 양도가액: 1700000000, 양도일: '2027-06-01', 취득가액: 500000000, 취득일: '2014-03-01', 증여지분: 0.5, 증여일: '2026-12-01', 증여재산가액: 750000000, 일세대일주택: '예', 거주연수: 10 }); return !!(r && r.증여세과세표준 === 150000000 && r.경우.some(function (c) { return c.엔진칸 && c.엔진칸.wholeHouseTransferPrice === 1700000000; })); } catch (e) { return false; } } },
    { 길: '넥스 → 임대·담보 재산 평가 판정(상증법 §60·§61⑤·§66·시행령 §63)', fn: function () { try { var r = JUDGE_MORE_['임대담보평가']({ 시가: 1000000000, 임대: [{ 보증금: 200000000, 월세: 10000000 }], 담보: [{ 종류: '근저당', 채권액: 480000000, 채권최고액: 600000000 }] }); return !!(r && r.평가액 === 1000000000 && r.환산가액 === 1200000000 && r.제66조가액 === 680000000); } catch (e) { return false; } } },
    { 길: '넥스 → 상속 인적공제·일괄공제 판정(상증법 §20·§21·시행령 §18)', fn: function () { try { var r = JUDGE_MORE_['인적공제']({ 상속개시일: '2026-10-01', 사람: [{ 관계: '배우자' }, { 관계: '자녀', 나이: 67 }, { 관계: '자녀', 나이: 40, 장애인: '예', 기대여명: 38.6 }] }); return !!(r && r.자녀수 === 2 && r.연로자수 === 0 && r.장애인연수합 === 39 && r.엔진칸.some(function (c) { return c && c.childCount === 2; })); } catch (e) { return false; } } },
    { 길: '넥스 → 미분양주택 특례 판정(조특법 §98의2~§98의9)', fn: function () { try { var r = JUDGE_MORE_['미분양주택특례']({ 납세자: '거주자', 계약일: '2009-06-01', 취득일: '2010-03-01', 양도일: '2013-05-01', 상대방: '사업주체최초', 소재지: '과밀억제', 기준일미분양: '예', 대지면적: 300, 전용면적: 120, 입주사실: '아니오', 해제재계약: '아니오', 대체계약: '아니오', 산출세액: 10000000 }); return r && r.고른조문 === '§98의3' && r.감면율 === 60 && r.감면액 === 6000000; } catch (e) { return false; } } },
    { 길: '넥스 → 양도담보권자 물적납세의무 판정(국세기본법 §42)', fn: function () { try { var r = JUDGE_MORE_['양도담보물적납세']({ 국세들: [{ 세목: '양도소득세', 금액: 50000000, 확정: '신고', 신고일: '2023-08-31' }, { 세목: '종합소득세', 금액: 100000000, 확정: '신고', 신고일: '2025-05-31' }], 다른재산징수액: 0, 재산: { 가액: 400000000, 담보설정일: '2025-01-15', 담보의사: '예' } }); return r && r.걷을금액 === 50000000; } catch (e) { return false; } } },
    { 길: '넥스 → 연대납세의무 판정(국세기본법 §25·소득세법 §2의2)', fn: function () { try { var r = JUDGE_MORE_['연대납세의무']({ 원인: '공유물', 본인: '을', 사람들: [{ 이름: '갑', 지분: 50 }, { 이름: '을', 지분: 50 }], 세금들: [{ 세목: '부가가치세', 금액: 10000000 }, { 세목: '양도소득세', 금액: 30000000, 누가: '갑' }] }); return r && r.사람별최대['을'] === 10000000 && r.사람별최대['갑'] === 40000000; } catch (e) { return false; } } },
    { 길: '넥스 → 국세 우선 배당 순위 판정(국세기본법 §35)', fn: function () { try { var r = JUDGE_MORE_['국세우선']({ 매각대금: 300000000, 집행비용: 0, 매각허가결정일: '2026-09-01', 재산종류: '주택', 권리들: [{ 누구: '은행', 종류: '근저당권', 날짜: '2020-01-01', 금액: 200000000 }], 국세들: [{ 세목: '양도소득세', 금액: 150000000, 확정: '신고', 신고일: '2019-05-31' }] }); return r && r.배분 && r.배분[1].배분 === 150000000 && r.배분[2].배분 === 150000000; } catch (e) { return false; } } },
    { 길: '넥스 → 법인의 제2차 납세의무 판정(국세기본법 §40)', fn: function () { try { var r = JUDGE_MORE_['법인제2차납세의무']({ 출자자종류: '과점주주', 집단지분: 70, 경영지배: '예', 납부기간만료일: '2026-03-31', 체납액: 500000000, 출자자재산: 100000000, 사유: '3호', 법인자산시가: 1000000000, 법인부채시가: 400000000, 출자자주식: 5000, 발행주식: 10000 }); return r && r.한도 === 300000000 && r.책임액 === 300000000; } catch (e) { return false; } } },
    { 길: '넥스 → 사업양수인 제2차 납세의무 판정(국세기본법 §41)', fn: function () { try { var r = JUDGE_MORE_['사업양수인']({ 양도일: '2026-05-31', 포괄승계: '예', 특수관계: '예', 세금: [{ 이름: '부가세', 세목: '부가가치세', 확정일: '2026-04-25', 금액: 200000000 }], 양도인충당후부족액: 150000000, 지급액: 100000000, 시가: 500000000, 평가자산: 600000000, 평가부채: 200000000 }); return r && r.한도 === 400000000 && r.책임액 === 150000000; } catch (e) { return false; } } },
    { 길: '넥스 → 청산인·잔여재산 받은 사람 제2차 납세의무 판정(국세기본법 §38)', fn: function () { try { var r = JUDGE_MORE_['청산인제2차납세의무']({ 해산일: '2026-03-31', 세금: [{ 세목: '법인세', 금액: 100000000 }], 법인충당후부족액: 100000000, 받은사람들: [{ 이름: '갑', 받은재산시가: 60000000 }, { 이름: '을', 받은재산시가: 40000000 }] }); return r && r.사람별[0].책임액 === 100000000 && r.사람별[2].책임액 === 40000000; } catch (e) { return false; } } },
    { 길: '넥스 → 무상주 의제배당 판정(소득세법 §17②2호·5호, 시행령 §27)', fn: function () { try { var r = JUDGE_MORE_['무상주']({ 전입들: [{ 재원: '이익잉여금', 금액: 100000000 }], 신규주식수: 20000, 보유주식: 3000, 발행주식: 10000, 액면가: 5000 }); return r && r.의제배당 === 30000000; } catch (e) { return false; } } },
    { 길: '넥스 → 증액·감액경정 효력·기한 판정(국세기본법 §22의3·§45의2·§26의2⑥)', fn: function () { try { var r = JUDGE_MORE_['증액경정']({ 법정신고기한: '2022-05-31', 당초신고세액: 50000000, 경정들: [{ 이름: '1차', 종류: '증액', 통지받은날: '2026-03-10', 경정후세액: 80000000 }, { 이름: '2차', 종류: '감액', 통지받은날: '2026-05-02', 경정후세액: 70000000 }], 기준일: '2026-11-04' }); return r && r.기한.length === 3 && r.기한[0].끝 === '2027-05-31' && r.기한[1].끝 === '2026-06-08' && r.기한[2].끝 === '2026-06-10' && r.확정세액 === 70000000; } catch (x) { return false; } } },
    { 길: '넥스 → 무체재산권 평가·기타소득 판정(상증법 §64·시행규칙 §19·소득세법 §21①7호)', fn: function () { try { var r = JUDGE_MORE_['무체재산권']({ 상황: '상속', 평가기준일: '2026-03-01', 권리들: [{ 이름: '특허', 종류: '특허권', 취득가액: 50000000, 감가상각누계: 30000000, 잔여존속연수: 3, 연도별수입: [33000000, 36300000, 39930000] }] }); var s = JUDGE_MORE_['무체재산권']({ 상황: '양도', 양도: { 종류: '특허권', 양도가액: 100000000 } }); return r && r.평가합 === 90000000 && s && s.기타소득금액 === 40000000 && s.원천징수 === 8000000; } catch (x) { return false; } } },
    { 길: '넥스 → 서화·골동품 평가·기타소득 판정(상증법 §62②·소득세법 §21②)', fn: function () { try { var r = JUDGE_MORE_['서화골동품']({ 상황: '양도', 양도: { 양도가액: 300000000, 보유기간년: 12, 생존국내원작자: '아니오', 양수자: '경매', 사업장: '아니오' } }); var e = JUDGE_MORE_['서화골동품']({ 상황: '상속', 물건들: [{ 이름: '산수화', 분야: '서화', 감정들: [{ 가액: 100000000 }, { 가액: 120000000 }], 심의회가액: 130000000 }] }); return r && r.기타소득금액 === 30000000 && r.원천징수 === 6000000 && e && e.평가합 === 130000000; } catch (x) { return false; } } },
    { 길: '넥스 → 국외 재산 평가·환율 판정(상증법 시행령 §58의3·§58의4)', fn: function () { try { var r = JUDGE_MORE_['국외재산평가']({ 종류: '상속', 평가기준일: '2026-02-10', 피상속인거주자: '예', 재산들: [{ 이름: '미국 집', 나라: '미국', 종류: '부동산', 통화: 'USD', 외화금액: 800000, 근거: '감정', 근거날짜: '2026-04-01', 감정기관수: 2, 기준환율: 1400, 다른날환율: 1450 }], 채무들: [{ 이름: '모기지', 통화: 'USD', 외화금액: 300000, 기준환율: 1400 }], 국내재산합계: 1000000000 }); return r && r.국외재산합 === 1120000000 && r.외화채무합 === 420000000 && r.경우.length === 3 && r.경우[0].엔진칸.taxableEstateAmount === 1700000000; } catch (e) { return false; } } },
    { 길: '넥스 → 가족 간 금전 대여 판정(상증법 §41의4·§37②·§45②)', fn: function () { try { var r = JUDGE_MORE_['가족차용']({ 대출일: '2026-03-01', 원금: 300000000, 약정이자율: 0, 대출기간개월: 24, 특수관계: '예', 차용증: '예', 변제기: '2028-02-28', 이자지급흔적: '아니오' }); return r && r.연도.length === 2 && r.연도[0].이익 === 13800000 && r.연도[0].과세 === true && r.경우[0].엔진칸.giftAmount === 13800000; } catch (e) { return false; } } },
    { 길: '넥스 → 시효취득 부동산 양도 판정(민법 §245①·소득세법 시행령 §162①6호·§176의2)', fn: function () { try { var r = JUDGE_MORE_['시효취득']({ 점유개시일: '1998-04-01', 등기접수일: '2024-06-15', 양도일: '2026-09-10', 양도가액: 600000000, 취득기준시가: 40000000, 양도기준시가: 360000000, 등기일기준시가: 320000000, 자산: '토지', 비사업용: '아니오' }); return r && r.취득일 === '1998-04-01' && r.취득가액 === 66666667 && Array.isArray(r.경우) && r.경우.length === 2 && r.경우[1].엔진칸.acquisitionDate === '2024-06-15'; } catch (e) { return false; } } },
    { 길: '넥스 → 대물변제 양도 판정(소득세법 §88 1호·§96·시행령 §151·§167)', fn: function () { try { var r = JUDGE_MORE_['대물변제']({ 넘김: '대물변제', 자산: '토지', 채무원금: 500000000, 시가: 700000000, 특수관계: true, 양도일: '2026-03-10' }); return r && r.양도 === true && r.양도가액 === 700000000 && r.부당행위 === true && Array.isArray(r.경우) && r.경우.length === 3; } catch (e) { return false; } } },
    { 길: '넥스 → 국세 징수권 소멸시효 판정(국세기본법 §27·§28)', fn: function () { try { var r = JUDGE_MORE_['징수권소멸시효']({ 기준일: '2026-11-04', 세금: [{ 이름: '가', 확정방식: '고지', 본세: 100000000, 고지납부기한: '2018-03-31', 확정일: '2018-03-01' }], 사건: [{ 세금: '가', 종류: '분납', 시작: '2019-01-01', 끝: '2019-12-31' }] }); return r && r.줄 && r.줄[0].기간 === '5년' && r.줄[0].정지날수 === 365; } catch (e) { return false; } } },
    { 길: '넥스 → 금융재산 상속공제 범위 판정(상증법 §22②)', fn: function () { try { var r = JUDGE_MORE_['금융재산공제']({ 상속개시일: '2026-03-10', 거주자: '예', 재산: [{ 이름: '예금', 가액: 300000000, 종류: '예금', 취급: '금융회사' }, { 이름: '최대주주 주식', 가액: 900000000, 종류: '주식', 취급: '금융회사', 최대주주: '예' }], 채무: [{ 이름: '대출', 금액: 100000000, 채권자: '금융회사', 증빙: '예' }] }); return r && r.순금융재산 === 200000000 && r.공제액 === 40000000; } catch (e) { return false; } } },
    { 길: '넥스 → 추계 취득가액 순서·요건 판정(시행령 §176의2③)', fn: function () { try { var r = JUDGE_MORE_['추계']({ 취득일: '2010-05-01', 장부: '없음', 기준시가취득: 1500000000, 후보: [{ 이름: '갑', 종류: '매매사례', 가액: 300000000, 날짜: '2010-12-01' }, { 이름: '을', 종류: '감정', 가액: 400000000, 날짜: '2010-06-01', 감정기관수: 1 }, { 이름: '병', 종류: '감정', 가액: 420000000, 날짜: '2010-04-01', 감정기관수: 2 }] }); return r && r.적용가액 === 420000000 && /2호/.test(r.적용방법); } catch (e) { return false; } } },
    { 길: '넥스 → 후발적 경정청구 사유·기한 판정(국세기본법 §45의2②)', fn: function () { try { var r = JUDGE_MORE_['후발적경정청구']({ 기준일: '2026-11-04', 법정신고기한: '2020-05-31', 신고: '기한안', 사유: [{ 이름: '갑', 종류: '판결', 안날: '2026-10-01' }, { 이름: '을', 종류: '판례변경', 안날: '2026-10-01' }] }); return r && r.기한.some(function (x) { return x.마감 === '2027-01-04'; }) && /아님 1/.test(r.결론); } catch (e) { return false; } } },
    { 길: '넥스 → 납부기한등 연장·납부고지 유예 판정(국세징수법 §13·§14)', fn: function () { try { var r = JUDGE_MORE_['납부기한연장']({ 세목: '증여세', 세액: 100000000, 기한: '2026-12-31', 사유: '사업손실', 신청일: '2026-12-10', 담보종류: '토지', 담보가액: 130000000 }); return r && r.간주승인일 === '2026-12-20' && r.담보필요액 === 120000000 && r.최대개월 === 9; } catch (e) { return false; } } },
    { 길: '넥스 → 공익신탁재산 과세가액 불산입 판정(상증법 §17·§52)', fn: function () { try { var r = JUDGE_MORE_['공익신탁']({ 상속개시일: '2026-03-15', 엔진칸: { taxableEstateAmount: 3000000000 }, 신탁: [{ 이름: '갑', 가액: 500000000, 출연자: '상속인', 공익신탁법인가: '예', 목적: '장학', 수익자: '공익법인등', 중도해지: '아니오', 잔여귀속: '국가', 신탁이행일: '2026-08-20' }, { 이름: '을', 가액: 300000000, 공익신탁법인가: '아니오', 목적: '장학', 수익자: '공익법인등', 중도해지: '아니오', 잔여귀속: '국가', 신탁이행일: '2026-08-20' }] }); return r && r.불산입액 === 500000000 && r.경우 && r.경우[0].엔진칸.publicTrustAmount === 500000000 && r.경우[0].엔진 === 'calculate_inheritance_tax'; } catch (e) { return false; } } },
    { 길: '넥스 → 공익법인 출연재산 사후관리 즉시 증여세 판정(상증법 §48②③)', fn: function () { try { var r = JUDGE_MORE_['공익법인사후관리']({ 위반: [{ 이름: '매각', 종류: '매각대금', 매각대금: 2000000000, 매각일: '2022-05-10', 사업연도종료일: '2022-12-31', 사용실적: 1200000000 }, { 이름: '임대', 종류: '무상임대', 출연재산가액: 1500000000, 무상: '예', 사용시작일: '2024-03-01' }] }); return r && r.증여세과세가액합계 === 2100000000 && r.경우 && r.경우[0].엔진칸.relation === '기타' ? '' : '공익법인 사후관리 판정이 증여세 과세가액을 바르게 셈하지 못함'; } catch (e) { return '공익법인 사후관리 판정 오류: ' + e; } } },
    { 길: '넥스 → 유언대용신탁 상속 판정(상증법 §9①·§2 5호)', fn: function () { try { var r = JUDGE_MORE_['신탁상속']({ 상속개시일: '2026-03-10', 신탁: [{ 종류: '유언대용', 재산종류: '금전', 수탁자: '금융회사', 가액: 500000000, 관계: '배우자', 생전수익자: '위탁자' }, { 종류: '유언대용', 재산종류: '부동산', 수탁자: '신탁회사', 가액: 1000000000, 관계: '손자', 생전수익자: '위탁자' }], 엔진칸: { taxableEstateAmount: 1000000000, hasSpouse: true } }); var c = r && r.엔진칸 || {}; return r && r.신탁합계 === 1500000000 && r.금전신탁 === 500000000 && c.taxableEstateAmount === 2500000000 && c.isGenerationSkip === true ? '' : '신탁상속 판정이 신탁재산·금융재산·세대생략을 바르게 가르지 못함'; } catch (e) { return '신탁상속 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 122] 농업법인출자 — 넥스 judge 「농업법인출자」가 출자일로 새 이월과세·옛 감면을 가르고 일반 법인 출자를 막는지
    { 길: '넥스 → 농업법인 현물출자 이월과세·감면 판정(조특법 §66·§68)', fn: function () { try { var b = { 출자일: '2026-05-15', 법인종류: '농업회사법인', 농업법인: '예', 농업인: { 거주: '같은시군구', 경작연수: 10 }, 신청: '예', 자산: [{ 이름: '논', 종류: '농지', 실제경작: '예', 시가: 500000000, 취득가액: 100000000, 취득일: '2010-01-01' }] }; var r = JUDGE_MORE_['농업법인출자'](b); var x = JUDGE_MORE_['농업법인출자'](Object.assign({}, b, { 법인종류: '주식회사' })); return r && r.결론 === '충족' && /이월과세/.test(r.특례) && x && x.결론 === '안 됨' ? '' : '농업법인출자 판정이 새 이월과세·법인 종류를 바르게 가르지 못함'; } catch (e) { return '농업법인출자 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 121] 중소기업통합 — 넥스 judge 「중소기업통합」이 §31 갈래로 가 설립 1년 안 법인+과점주주를 막는지
    { 길: '넥스 → 중소기업 간 통합 이월과세 판정(조특법 §31·시행령 §28)', fn: function () { try { var b = { 특례: '통합', 통합일: '2026-06-30', 통합법인설립일: '2025-12-01', 중소기업: '예', 소비성서비스업: '아니오', 주된자산모두승계: '예', 통합법인주주: '예', 과점주주: '예', 자산: [{ 이름: '공장', 종류: '건물', 시가: 500000000, 사업사용: '예' }], 받은주식가액: 500000000, 적용신청: '예' }; var r = JUDGE_MORE_['중소기업통합'](b); return r && r.결론 === '안 됨' && r.엔진칸 && r.엔진칸.provision === 'sect31' ? '' : '중소기업통합 판정이 §31 갈래·1년 안 과점주주 요건을 못 봄'; } catch (e) { return '중소기업통합 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 120] 공장이전 — 넥스 judge 「공장이전」이 과밀억제권역 이전을 막고 지방 이전은 비율대로 분할세액을 셈하는지
    { 길: '넥스 → 공장 이전 양도소득세 분할납부 판정(조특법 §85의7·§85의8)', fn: function () { try { var b = { 양도일: '2026-03-20', 사업인정고시일: '2025-09-01', 양수자: '사업시행자', 기존공장: { 가동시작: '2012-01-01', 양도가액: 3000000000 }, 신규공장: { 소재: '충북 음성', 산업단지: '예', 예정가액: 1800000000 }, 세액: 100000000 }; var r = JUDGE_MORE_['공장이전'](b); var x = JUDGE_MORE_['공장이전'](Object.assign({}, b, { 신규공장: { 소재: '과밀억제', 예정가액: 1800000000 } })); return r && r.분할 === true && r.분할세액 === 60000000 && x && x.분할 === false ? '' : '공장이전 판정이 지방 이전 분할세액·과밀억제 이전 배제를 바르게 셈하지 못함'; } catch (e) { return '공장이전 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 119] 농지교환 — 넥스 judge 「농지교환」이 시행령 §153④1호 제외 농지(도시 주거지역 편입 3년)를 비과세에서 빼는지
    { 길: '넥스 → 농지 교환·분합 비과세 판정(소득세법 §89①2호·시행령 §153)', fn: function () { try { var r = JUDGE_MORE_['농지교환']({ 교환일: '2026-05-10', 사유: '경작상필요', 넘긴농지: { 시가: 400000000, 농지: '예', 지역: '시동', 용도지역: '주거', 편입일: '2021-03-01', 단서가: '아니오', 단서나: '아니오' }, 받은농지: { 시가: 340000000, 농지: '예' }, 정산금: { 받음: 60000000 }, 경작: { 거주지역: '같은시군구' } }); return r && r.결론 === '안 됨' && r.제외농지 === true && r.엔진칸 && !r.엔진칸.isFarmlandExchange ? '' : '농지교환 판정이 §153④ 제외 농지를 비과세에서 빼지 못함'; } catch (e) { return '농지교환 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 118] 비상장평가 — 넥스 judge 「비상장평가」가 부동산 50% 이상을 2:3으로, 추정이익 네 요건을 가려 엔진칸에 넘기는지(상증령 §54①·§56②)
    { 길: '넥스 → 비상장주식 평가 방법 판정(상증령 §54·§56②·§53)', fn: function () { try { var r = JUDGE_MORE_['비상장평가']({ 원인: '증여', 평가기준일: '2026-06-30', 회사: { 사업개시일: '2019-03-01', 발행주식수: 100000, 순손익: [3000000000, 300000000, 200000000], 자산총액: 10000000000, 부동산등가액: 5500000000, 순자산가액: 8000000000 }, 주주: { 최대주주: '예', 평가할주식수: 20000 }, 추정이익: { '1주당': 3500, 평가기관수: 2, 일시우발사건: '예', 신고: '예', 산정기준일: '2026-06-30', 작성일: '2026-08-20' } }); return r && r.가중치 === '2:3' && r.추정이익사용 === true && r.엔진칸.estimatedProfitPerShare === 3500 ? '' : '비상장평가 판정이 가중치·추정이익을 못 가림'; } catch (e) { return '비상장평가 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 117] 주식교환 — 넥스 judge 「주식교환」이 80% 판정에 교환일 전 2년 안 취득분을 금전으로 보는지(조특령 §35의2⑤)
    { 길: '넥스 → 주식의 포괄적 교환 과세이연 판정(조특법 §38·조특령 §35의2)', fn: function () { try { var r = JUDGE_MORE_['주식교환']({ 교환: { 교환일: '2026-03-31', 양법인1년사업: '예', 자회사사업계속: '예', 지분대로배정: '예' }, 주주: { 취득가액: 300000000, 지배주주: '예' }, 대가: { 모회사주식가액: 2400000000, 금전등: 400000000 }, 보유: { 모회사: '예', 주주: '예' }, 모회사사전취득: { 지배주주: '아니오', '2년안취득지분율': 30, '2년안취득가액': 750000000 } }); return r && r.결론 === '안 됨' && r.금전간주 === 250000000 ? '' : '주식교환 판정이 2년 안 취득분을 금전으로 보지 못함'; } catch (e) { return '주식교환 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 116] 자경산지 — 넥스 judge 「자경산지」가 직접 경영 기간을 취득일이 아니라 산림경영계획인가일부터 세는지
    { 길: '넥스 → 자경산지 감면 판정(조특법 §69의4·조특령 §66의4③)', fn: function () { try { var r = JUDGE_MORE_['자경산지']({ 산지: { 취득일: '1990-04-01', 인가일: '2008-05-01', 양도일: '2026-06-15', 보전산지: '예' }, 사람: { 임업인: '예', 거주지역: '같은 시군구', 경영방법: '상시 종사' } }); return r && r.감면율 === 10 && r.엔진칸.forestManagedYears === 18 ? '' : '자경산지 판정이 인가일부터 경영 기간을 세지 못함'; } catch (e) { return '자경산지 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 115] 법인아닌단체 — 넥스 judge 「법인아닌단체」가 분배 안 하는 종중을 1거주자로, 2005년 전 취득 종중 농지를 비사업용 아님으로 가르는지
    { 길: '넥스 → 법인 아닌 단체(종중) 양도 가르기(소득세법 §2③·국세기본법 §13)', fn: function () { try { var r = JUDGE_MORE_['법인아닌단체']({ 단체: { 이름: '곽씨 종중', 법인승인: '아니오' }, 분배: { 비율정함: '아니오', 사실상분배: '아니오' }, 토지: { 종류: '농지', 취득일: '1990-05-01', 취득가액: 50000000, 양도일: '2026-06-10', 양도가액: 1200000000 } }); return r && r.과세방식 === '1거주자' && r.비사업용 === false && r.경우[0].엔진칸.isNonBusinessLand === undefined ? '' : '법인아닌단체 판정이 1거주자·종중 농지 특례를 바로 가르지 못함'; } catch (e) { return '법인아닌단체 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 114] 재상속 — 넥스 judge 「재상속」이 1년 6개월 뒤 배우자 사망을 「2년 이내 90%」로 날짜로 정하고 미납 전의 상속세를 공과금으로 빼는지
    { 길: '넥스 → 단기재상속 가르기(상증법 §30·시행령 §9①)', fn: function () { try { var r = JUDGE_MORE_['재상속']({ 전상속개시일: '2025-03-10', 상속개시일: '2026-09-20', 이번피상속인지위: '배우자', 전상속세산출세액: 600000000, 전상속재산가액: 3000000000, 전상속세과세가액: 2800000000, 재상속재산: [{ 이름: '아파트', 전가액: 800000000, 남음: '예' }], 이번피상속인몫전상속세: 100000000, 사망전납부액: 40000000, 엔진칸: { taxableEstateAmount: 1500000000, childCount: 2 } }); return r && r.공제율 === 90 && r.미납전상속세 === 60000000 && r.경우[0].엔진칸.priorInheritanceDate === '2025-03-10' ? '' : '재상속 판정이 공제율·미납 전의 상속세를 바로 가르지 못함'; } catch (e) { return '재상속 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 113] 신탁수익권 — 넥스 judge 「신탁수익권」이 위탁자 지위까지 넘긴 수익권 양도를 신탁재산 양도로 가르는지
    { 길: '넥스 → 신탁 수익권 양도 가르기(소득세법 §94①6호·시행령 §159의3)', fn: function () { try { var r = JUDGE_MORE_['신탁수익권']({ 수익권: { 종류: '부동산 관리신탁' }, 양도인지위: '위탁자겸수익자', 지배이전: { 위탁자지위이전: '예' }, 양도일: '2026-05-15', 양도가액: 1200000000, 신탁재산: { 자산: '상가', 취득일: '2015-03-01', 취득가액: 700000000 } }); return r && r.지배권이전 === true && r.경우[0].엔진 === 'calculate_transfer_tax' ? '' : '신탁수익권 판정이 위탁자 지위 이전을 신탁재산 양도로 가르지 못함'; } catch (e) { return '신탁수익권 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 112] 배우자양도추정 — 넥스 judge 「배우자양도추정」이 대가 없이 배우자에게 넘긴 상가를 §44① 증여추정으로 가르는지
    { 길: '넥스 → 배우자·직계존비속 양도 증여추정 가르기(상증법 §44)', fn: function () { try { var r = JUDGE_MORE_['배우자양도추정']({ 관계: '아내', 처분방식: '매매', 자산: '상가', 시가: 900000000, 대가: 0, 양도일: '2026-03-10', 취득일: '2012-05-01', 취득가액: 350000000 }); return r && r.추정 === true ? '' : '배우자양도추정 판정이 대가 없는 배우자 양도를 가르지 못함'; } catch (e) { return '배우자양도추정 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 111] 장기일반감면 — 넥스 judge 「장기일반감면」이 취득 뒤 3개월 넘어 등록한 매입임대를 §97의5 감면에서 빼는지
    { 길: '넥스 → 장기일반민간임대주택 양도소득세 감면 요건 가르기(조특법 §97의5)', fn: function () { try { var r = JUDGE_MORE_['장기일반감면']({ 양도일: '2028-08-20', 거주자: '예', 취득일: '2018-05-10', 등록일: '2018-09-20', 종류: '매입', 계약: [{ 시작: '2018-09-20', 끝: '2028-09-30', 보증금: 200000000 }], 전용면적: 59, 수도권: '예', 임대개시기준시가: 250000000 }); return r && r.적용 === false ? '' : '장기일반감면 판정이 3개월 넘어 등록한 집을 가르지 못함'; } catch (e) { return '장기일반감면 판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 110] 신축주택감면 — 넥스 judge 「신축주택감면」이 6억·85㎡ 둘 다 넘는 주택을 가르는지
    { 길: '넥스 → 2013 신축주택 등 감면 요건 가르기(조특법 §99의2)', fn: function () { try { var r = JUDGE_MORE_['신축주택감면']({ 주택: { 종류: '미분양', 공급자: '사업주체', 계약일: '2013-06-01', 취득일: '2013-08-01', 실거래가액: 700000000, 면적: 110, 날인: '예' }, 해제: { 없음: '예' }, 양도: { 양도일: '2018-06-01' }, 기준일: '2026-11-03' }); return r && r.적용 === false ? '' : '신축주택감면 판정이 6억·85㎡ 둘 다 넘는 주택을 가르지 못함'; } catch (e) { return '신축주택감면 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 109] 축사용지 — 넥스 judge 「축사용지」가 시 동 지역 주거지역 편입 3년 지난 축사용지를 감면에서 빼는지
    { 길: '넥스 → 축사용지 감면 요건 가르기(조특법 §69의2)', fn: function () { try { var r = JUDGE_MORE_['축사용지']({ 양도인: { 거주자: '예', 거주지역: '같은 시', 거주년수: 20, 직접축산: '예', 축산년수: 20 }, 토지: { 취득일: '2000-01-01', 지역: '동', 편입일: '2020-03-01' }, 폐업: { 확인서: '예' }, 양도: { 양도일: '2026-09-15' }, 기준일: '2026-11-03' }); return r && r.적용 === false ? '' : '축사용지 판정이 편입 3년 지난 땅을 가르지 못함'; } catch (e) { return '축사용지 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 108] 재해손실 — 넥스 judge 「재해손실」이 보험금을 빼고 신고기한 뒤 재난을 빼는지
    { 길: '넥스 → 재해손실공제 재산별 가르기(상증법 §23·§54)', fn: function () { try { var r = JUDGE_MORE_['재해손실']({ 종류: '상속', 상속개시일: '2026-02-10', 피상속인거주자: '예', 재산: [{ 이름: 'A', 평가액: 300000000, 재난일: '2026-04-12', 재난종류: '산불', 손실가액: 180000000, 보험금: 50000000 }, { 이름: 'B', 평가액: 900000000, 재난일: '2026-10-02', 재난종류: '화재', 손실가액: 200000000 }], 기준일: '2026-11-03' }); return r && r.재해손실공제 === 130000000 && r.신고기한 === '2026-08-31' ? '' : '재해손실 판정이 보험금·신고기한을 가르지 못함'; } catch (e) { return '재해손실 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 107] 경영회생 — 넥스 judge 「경영회생」이 임차기간 끝난 뒤 환매를 환급에서 빼는지
    { 길: '넥스 → 경영회생 농지 환매 환급 요건 가르기(조특법 §70의2)', fn: function () { try { var r = JUDGE_MORE_['경영회생']({ 양도인: { 농업인: '예', 직접경작: '예' }, 공사양도: { 양도일: '2019-05-10', 면적: 10000, 납부세액: 30000000 }, 임차: { 시작일: '2019-05-10', 끝일: '2026-05-09', 직접경작: '예' }, 환매: { 환매일: '2026-06-01', 면적: 10000 }, 기준일: '2026-11-03' }); return r && r.적용 === false && r.환급액 === 0 ? '' : '경영회생 판정이 임차기간 뒤 환매를 가르지 못함'; } catch (e) { return '경영회생 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 106] 대체주택 — 넥스 judge 「대체주택」이 대체주택 살 때 다른 주택이 있으면 특례에서 빼는지
    { 길: '넥스 → 재건축 사업기간 대체주택 요건 가르기(소득세법 시행령 §156의2⑤)', fn: function () { try { var r = JUDGE_MORE_['대체주택']({ 사업: { 종류: '재건축', 사업시행인가일: '2021-06-15', 완성일: '2024-12-20' }, 취득때주택수: 2, 대체주택: { 취득일: '2021-09-01', 전입일: '2021-09-10', 전출일: '2025-02-01', 양도일: '2026-09-30', 양도가액: 900000000, 취득가액: 500000000 }, 이사: { 전입일: '2025-02-01', 세대전원: '예' }, 기준일: '2026-11-03' }); return r && r.적용 === false && r.경우.length === 2 ? '' : '대체주택 판정이 2채 보유를 가르지 못함'; } catch (e) { return '대체주택 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 105] 농어촌주택 — 넥스 judge 「농어촌주택」이 농어촌주택 뒤에 산 일반주택을 특례 대상에서 빼는지
    { 길: '넥스 → 농어촌주택·고향주택 특례 요건 가르기(조특법 §99의4)', fn: function () { try { var r = JUDGE_MORE_['농어촌주택']({ 종류: '농어촌', 일반주택: { 취득일: '2023-02-01', 양도일: '2026-08-20', 양도가액: 900000000, 취득가액: 700000000 }, 농어촌주택: { 취득일: '2021-04-01', 기준시가: 150000000 }, 소재지: { 읍면동: '면', 수도권: '아니오', 도시지역: '아니오', 조정대상지역: '아니오', 토지거래허가구역: '아니오', 관광단지: '아니오' }, 같은연접: '아니오' }); return r && r.적용 === false && r.경우.length === 2 ? '' : '농어촌주택 판정이 뒤에 산 일반주택을 가르지 못함'; } catch (e) { return '농어촌주택 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 104] 경매 — 넥스 judge 「경매」가 낙찰 취득가액에서 명도비·유치권 합의금·이자를 빼고 본인 재취득을 양도 아님으로 가르는지
    { 길: '넥스 → 경매·공매 양도와 낙찰 취득가액 가르기(집행기준 88-0-2·97-163-15~19)', fn: function () { try { var r = JUDGE_MORE_['경매']({ 양도: [{ 이름: '본인', 낙찰자: '본인', 대금완납일: '2026-03-01', 매각대금: 100000000 }], 취득: [{ 이름: '상가', 대금완납일: '2023-04-14', 낙찰가: 500000000, 취득세등: 23000000, 인수보증금: 80000000, 보증금구상: '불가', 유치권합의금: 20000000, 명도비: 15000000, 이자: 30000000, 양도일: '2026-09-30', 양도가액: 900000000 }], 기준일: '2026-11-03' }); return (r && r.넘어간것[0].양도 === false && r.낙찰받은것[0].인정취득가액 === 603000000 && r.경우.length === 2) ? '' : '경매 판정 결과가 다름'; } catch (e) { return '경매 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 103] 부동산권리 — 넥스 judge 「부동산권리」가 택지 공급권을 분양권이 아닌 취득 권리(엔진 acquire_right)로, 지역주택조합 지위를 두 경우로 가르는지
    { 길: '넥스 → 부동산을 취득할 수 있는 권리 가르기(소득세법 §94①2호가·§88 9·10호)', fn: function () { try { var r = JUDGE_MORE_['부동산권리']({ 권리: [{ 이름: '딱지', 공급대상: '택지', 근거법: '공공주택특별법', 지위: '이주자택지', 취득일: '2020-05-10', 양도일: '2026-06-30', 양도가액: 420000000, 취득가액: 150000000 }, { 이름: '조합', 근거법: '주택법 지역주택조합', 지위: '조합원', 취득일: '2024-03-01', 양도일: '2026-06-30' }], 기준일: '2026-11-03' }); return (r && r.권리별[0].엔진칸.rightOrOtherKind === 'acquire_right' && r.권리별[1].잠정 === true && r.경우.length === 3) ? '' : '부동산권리 판정 결과가 다름'; } catch (e) { return '부동산권리 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 102] 납세의무승계 — 넥스 judge 「납세의무승계」가 사망 전 양도를 피상속인 양도로 가르고 상속인별 몫을 받은 재산 한도로 자르는지
    { 길: '넥스 → 상속인 납세의무 승계(국세기본법 §24·시행령 §11)', fn: function () { try { var r = JUDGE_MORE_['납세의무승계']({ 상속개시일: '2025-04-15', 거래: [{ 이름: '아파트', 잔금일: '2025-03-20', 양도가액: 900000000, 받은대금: 900000000, 양도세: 120000000 }], 상속인: [{ 이름: '배우자', 상속분: '3/7', 자산: 600000000 }, { 이름: '장남', 상속분: '2/7', 자산: 20000000 }, { 이름: '차남', 상속분: '2/7', 자산: 400000000 }], 기준일: '2026-11-03' }); return (r && r.승계세금 === 120000000 && r.상속인별[1].낼세금 === 20000000 && r.상속인별[0].낼세금 === 51428571) ? '' : '납세의무승계 판정 결과가 다름'; } catch (e) { return '납세의무승계 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 101] 납부유예 — 넥스 judge 「납부유예」가 유예 금액과 5년 안 지분 감소 때 전부 징수·이자를 셈하는지
    { 길: '넥스 → 가업상속 상속세 납부유예(상증법 §72의2·시행령 §69의3)', fn: function () { try { var r = JUDGE_MORE_['납부유예']({ 상속개시일: '2024-03-10', 중소기업: '예', 가업상속공제: '아니', 담보: '예', 상속세납부세액: 1000000000, 가업상속재산가액: 6000000000, 총상속재산가액: 10000000000, 사유: [{ 일: '2026-05-20', 종류: '지분' }], 기준일: '2026-11-03' }); return (r && r.유예세액 === 600000000 && r.징수[0].징수세액 === 600000000 && r.징수[0].이자상당액 === 31546849) ? '' : '납부유예 판정 결과가 다름'; } catch (e) { return '납부유예 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 100] 환급가산금 — 넥스 judge 「환급가산금」이 납부일 다음 날부터 결정일까지 그때 이율로 셈하는지
    { 길: '넥스 → 국세환급가산금(국세기본법 §52·시행령 §43의3)', fn: function () { try { var r = JUDGE_MORE_['환급가산금']({ 세목: '양도', 원인: '경정', 환급세액: 10000000, 납부: [{ 일: '2025-05-31', 금액: 10000000 }], 경정청구일: '2025-12-01', 결정일: '2026-01-30', 기준일: '2026-11-03' }); return (r && r.환급가산금 === 207232) ? '' : '환급가산금 판정 결과가 다름'; } catch (e) { return '환급가산금 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 99] 부정행위·가산세 — 넥스 judge 「부정행위」가 다운계약서는 40%, 단순 누락은 10%로 나누는지
    { 길: '넥스 → 부정행위 가르기·신고 가산세(국세기본법 §47의3·조세범 처벌법 §3⑥)', fn: function () { try { var r = JUDGE_MORE_['부정행위']({ 세목: '양도', 법정신고기한: '2026-05-31', 신고: '예', 신고할세액: 100000000, 신고한세액: 40000000, 기준일: '2026-05-31', 항목: [{ 이름: '양도가액 줄임', 과세표준: 150000000, 행위: '다운계약서' }, { 이름: '필요경비 착오', 과세표준: 50000000, 행위: '단순 착오' }] }); return (r && r.가산세 && r.가산세.법대로.가산세 === 18000000 + 1500000) ? '' : '부정행위 판정 결과가 다름'; } catch (e) { return '부정행위 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 98] 부과제척기간 — 넥스 judge 「제척기간」이 기산일을 스스로 찾아 끝난 건·남은 건을 가르는지
    { 길: '넥스 → 부과제척기간 판정(국세기본법 §26의2·시행령 §12의3)', fn: function () { try { var r = JUDGE_MORE_['제척기간']({ 기준일: '2026-11-03', 건: [{ 이름: 'A', 세목: '양도', 거래일: '2018-05-10', 신고: '예' }, { 이름: 'B', 세목: '양도', 거래일: '2019-03-20', 신고: '아니오' }] }); var a = r.건별[0], b = r.건별[1]; return (a.기산일 === '2019-06-01' && a.만료일 === '2024-05-31' && !a.오늘부과 && b.기간_년 === 7 && b.오늘부과) ? '' : '제척기간 판정 결과가 다름'; } catch (e) { return '제척기간 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 97] 장기임대 특례 요건 — 넥스 judge 「장기임대특례」가 임대료 5%·통산 임대를 가르고 엔진칸 경우를 내는지
    { 길: '넥스 → 장기일반민간임대 장특 70% 요건 판정(조특법 §97의3)', fn: function () { try { var 계 = [{ 시작: '2014-03-01', 끝: '2016-02-29', 보증금: 200000000 }, { 시작: '2016-03-01', 끝: '2018-02-28', 보증금: 210000000 }, { 시작: '2018-03-01', 끝: '2020-02-29', 보증금: 220000000 }, { 시작: '2020-03-01', 끝: '2022-02-28', 보증금: 231000000 }, { 시작: '2022-03-01', 끝: '2026-09-30', 보증금: 242550000 }]; var a = JUDGE_MORE_['장기임대특례']({ 양도일: '2026-10-15', 거주자: '예', 등록일: '2014-03-01', 종류: '매입', 계약: 계, 전용면적: 59, 취득일: '2014-01-10' }); var b = JUDGE_MORE_['장기임대특례']({ 양도일: '2026-10-15', 거주자: '예', 등록일: '2014-03-01', 종류: '매입', 계약: 계.map(function (c, i) { return i === 4 ? { 시작: c.시작, 끝: c.끝, 보증금: 245000000 } : c; }), 전용면적: 59, 취득일: '2014-01-10' }); return (a && a.특례율 === 70 && b && b.특례율 === 0) ? '' : '장기임대특례 판정 결과가 다름'; } catch (e) { return '장기임대특례 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 96] 나눠 팔기 감면 한도 합산 — 넥스 judge 「나눠팔기」가 분할 1년·2년·같은 사람(배우자)을 가리고 엔진칸을 묶음별로 내는지, 넥스 양도 도구에 그 칸이 있는지
    { 길: '넥스 → 토지 나눠 팔기 감면 한도 합산 판정(조특법 §133③)', fn: function () { try { var a = JUDGE_MORE_['나눠팔기']({ 이번: { 양도일: '2026-03-10', 산사람: '배씨' }, 앞선: [{ 양도일: '2025-11-20', 산사람: '최씨', 배우자: '예', 분할일: '2025-06-01', 감면세액: 100000000, 감면: '자경' }] }); var b = JUDGE_MORE_['나눠팔기']({ 이번: { 양도일: '2026-03-10', 산사람: '배씨' }, 앞선: [{ 양도일: '2025-11-20', 산사람: '남씨', 분할일: '2025-06-01', 감면세액: 100000000, 감면: '자경' }] }); var src = typeof DRIVE_TOOLS !== 'undefined' ? JSON.stringify(DRIVE_TOOLS) : ''; return (a && a.합산 && a.엔진칸.sect133SameBuyerPriorReduction === 100000000 && b && !b.합산) ? (src && src.indexOf('sect133SameBuyerPriorComp') < 0 ? '넥스 양도 도구에 sect133SameBuyerPriorComp 칸 없음' : '') : '나눠팔기 판정 결과가 다름'; } catch (e) { return '나눠팔기 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 95] 개발제한구역 매수 감면 — 넥스 judge 「개발제한구역」이 넘긴 길·취득 시기·계속 거주(부득이 사유)를 가리는지
    { 길: '넥스 → 개발제한구역 매수·해제 뒤 수용 감면 판정(조특법 §77의3·시행령 §74)', fn: function () { try { var a = JUDGE_MORE_['개발제한구역']({ 방식: '매수청구', 지정일: '1971-07-30', 매수청구일: '2026-03-02', 양도일: '2026-09-15', 취득일: '1998-04-01', 취득원인: '상속', 피상속인취득일: '1965-05-10', 거주: [{ 시작: '1960-01-01', 지역: '같은시군구' }] }); var b = JUDGE_MORE_['개발제한구역']({ 방식: '매수청구', 지정일: '1971-07-30', 매수청구일: '2026-03-02', 양도일: '2026-09-15', 취득일: '2000-05-01', 거주: [{ 시작: '2000-05-01', 끝: '2009-12-31', 지역: '같은시군구' }, { 시작: '2013-01-01', 지역: '같은시군구' }], 부득이: [{ 시작: '2010-01-01', 끝: '2012-12-31', 사유: '직장' }] }); if (!(a.감면 && a.감면율 === 40 && !b.감면)) return '개발제한구역 틀림: ' + a.결론 + ' / ' + b.결론; return ''; } catch (x) { return '개발제한구역 오류: ' + x; } } },
    // [2026.11.03 복잡사건 94] 영농상속공제 — 넥스 judge 「영농상속」이 요건(8년·2년·65세 전 면제)과 2년 영농 사용 재산만 가리고, 추징 도구가 엔진에 닿는지
    { 길: '넥스 → 영농상속공제 판정·사후 추징(상증법 §18의3·시행령 §16)', fn: function () { var m = need(chatTools(), ['calculate_succession_deduction_clawback'], '대화창 도구'); if (m) return m; try { var a = JUDGE_MORE_['영농상속']({ 상속개시일: '2026-06-30', 피상속인: { 영농: [{ 시작: '2010-03-01' }], 거주: '같은시군구', 직접영농: '예', 사망나이: 62 }, 상속인: { 생년월일: '1995-01-01', 거주: '연접', 직접영농: '예' }, 재산: [{ 종류: '농지', 가액: 2000000000, 담보채무: 300000000, 영농사용시작일: '2012-01-01' }, { 종류: '농지', 가액: 500000000, 영농사용시작일: '2025-09-01' }] }); if (!(a.결론 === '공제 1,700,000,000원' && a.제외재산 === 500000000)) return '영농상속 틀림: ' + a.표시; var e = getUiCalcEngine_(); return typeof e.calculateSuccessionDeductionClawbackJS === 'function' ? '' : '엔진에 상속공제 추징 함수 없음'; } catch (x) { return '영농상속 오류: ' + x; } } },
    // [2026.11.03 복잡사건 93] 법인·개인 거래 — 넥스 judge 「법인거래」가 특수관계법인 상여 처분 때 양도가액을 시가로, 법인에서 싸게 산 개인의 나중 취득가액에 처분 금액을 더하는지
    { 길: '넥스 → 법인·개인 부동산 거래 판정(소득세법 §96③·소득령 §163⑩2호)', fn: function () { try { var a = JUDGE_MORE_['법인거래']({ 방향: '개인→법인', 특수관계: '예', 대가: 1500000000, 시가: 1000000000, 처분: '예' }); var b = JUDGE_MORE_['법인거래']({ 방향: '법인→개인', 특수관계: '예', 대가: 600000000, 시가: 1000000000, 처분: '예' }); return a.양도가액 === 1000000000 && b.나중취득가액 === 1000000000 && b.증여재산가액 === 0 ? '' : '법인거래 틀림'; } catch (x) { return '법인거래 오류: ' + x; } } },
    // [2026.11.03 복잡사건 92] 비거주자 양도 — 넥스 judge 「비거주자양도」가 비과세를 끄고 매수 법인 원천징수를 적은 금액으로 셈하는지
    { 길: '넥스 → 비거주자 부동산 양도 판정(소득세법 §121②·§156①5호)', fn: function () { try { var a = JUDGE_MORE_['비거주자양도']({ 거주자: '비거주자', 자산: '주택', '1세대1주택': '예', 출국사유: '그밖', 양도일: '2026-08-20', 양도가액: 900000000, 취득가액: 500000000, 양도비용: 10000000, 취득가액확인: '예', 매수인: '법인' }); return a.비과세예외 === false && a.원천징수 === 78000000 && a.예정신고기한 === '2026-10-31' ? '' : '비거주자양도 틀림'; } catch (x) { return '비거주자양도 오류: ' + x; } } },
    // [2026.11.03 복잡사건 91] 부담부증여 — 넥스 judge 「부담부증여」가 직계존비속 증빙 없는 채무를 빼지 않고, 기준시가 평가면 취득가액도 기준시가로 넘기는지
    { 길: '넥스 → 부담부증여 채무 인정·양도분 판정(상증법 §47③·소득령 §159)', fn: function () { try { var a = JUDGE_MORE_['부담부증여']({ 관계: '직계존속', 채무종류: '담보대출', 채무담보관련: '예', 채무액: 300000000, 인수: '예', 입증: '없음', 평가액: 1000000000 }); var b = JUDGE_MORE_['부담부증여']({ 관계: '직계존속', 채무종류: '담보대출', 채무담보관련: '예', 채무액: 300000000, 인수: '예', 입증: '금융기관', 평가액: 600000000, 평가방법: '기준시가', 취득가액: 450000000, 취득당시기준시가: 200000000 }); return a.채무인정 === false && b.양도분 && b.양도분.취득가액 === 100000000 ? '' : '부담부증여 틀림'; } catch (x) { return '부담부증여 오류: ' + x; } } },
    // [2026.11.03 복잡사건 90] 환산가산세 — 넥스 judge 「환산가산세」가 신축 5년·증축 85㎡·건물분만 가르는지
    { 길: '넥스 → 신축·증축 감정·환산 가산세 판정(소득세법 §114의2)', fn: function () { try { var a = JUDGE_MORE_['환산가산세']({ 건물취득원인: '신축', 사용승인일: '2022-06-20', 양도일: '2026-03-31', 취득가액방법: '환산', 건물분가액: 500000000 }); var b = JUDGE_MORE_['환산가산세']({ 건물취득원인: '증축', 증축면적: 60, 증축일: '2023-01-01', 양도일: '2026-01-01', 취득가액방법: '환산' }); return a.가산세 === 25000000 && b.가산세대상 === false ? '' : '환산가산세 틀림'; } catch (x) { return '환산가산세 오류: ' + x; } } },
    // [2026.11.03 복잡사건 89] 미등기 — 넥스 judge 「미등기」가 등기 안 한 땅을 시행령 §168① 빼 주는 자산과 가르는지
    { 길: '넥스 → 미등기양도자산 판정(소득세법 §104③·시행령 §168①)', fn: function () { try { var e = { assetType: 'land', transferPrice: 900000000, acquisitionPrice: 400000000, acquisitionDate: '2016-05-10', transferDate: '2026-06-30' }; var a = JUDGE_MORE_['미등기']({ 자산: '토지', 등기: '아니오', 사유: '도시개발', 엔진칸: e }); var c = JUDGE_MORE_['미등기']({ 자산: '토지', 취득원인: '매매', 등기: '아니오', 사유: '없음', 엔진칸: e }); return a.미등기 === false && a.빠진호[0] === '6호' && a.경우[0].엔진칸.isUnregisteredTransfer === false && c.미등기 === true && c.경우[0].엔진칸.isUnregisteredTransfer === true ? '' : '미등기 틀림'; } catch (x) { return '미등기 오류: ' + x; } } },
    // [2026.11.03 복잡사건 88] 확정신고 — 넥스 judge 「확정신고」가 따로 한 예정신고 셋을 합산하면 세액이 달라져 확정신고 의무로 보는지
    { 길: '넥스 → 예정신고 뒤 확정신고 의무(소득세법 §110④ 단서·시행령 §173⑤)', fn: function () { try { var t = function (d, a, e) { return { 자산: '토지', 양도일: d, 취득일: a, 예정신고: '예', 예정산출세액: e, 엔진칸: { transferPrice: 1, transferDate: d, assetType: 'land', acquisitionDate: a } }; }; var r = JUDGE_MORE_['확정신고']({ 연도: 2026, 거래: [t('2026-03-15', '2015-05-01', 97860000), t('2026-07-20', '2018-02-01', 57314000)], 합산산출세액: 180486000 }); return r.확정신고의무 === true && r.일호 === true && r.추가산출세액 === 25312000 && r.기한 === '2027-05-31' && r.경우.length === 2 && r.경우[0].엔진칸.preliminaryTaxPaid === 155174000 && UI_ENGINE_CALC_TOOL_ARGS_.calculate_transfer_tax_multi[1]({ transactions: [], preliminaryTaxPaid: 5 })[1].preliminaryTaxPaid === 5 ? '' : '확정신고 틀림'; } catch (e) { return '확정신고 오류: ' + e; } } },
    // [2026.11.03 복잡사건 87] 정비청산 — 넥스 judge 「정비청산」이 정비기반시설 없는 정비구역 협의 현금청산에 §77 감면을 안 붙이는지
    { 길: '넥스 → 정비사업 현금청산의 감면 호·양도가액(조특법 §77①2호)', fn: function () { try { var r = JUDGE_MORE_['정비청산']({ 사업: '재개발', 정비기반시설: '아니오', 상대: '조합', 방식: '협의', 고시일: '2023-05-10', 분양신청: '안함', 취득일: '2012-04-01', 잔금일: '2026-08-20', 주택: '예', 일주택: '예', 청산금: 1650000000, 지연이자: 42000000, 취득가액: 420000000 }); return r.감면 === false && r.양도가액 === 1650000000 && r.경우.length === 3 && !r.경우[0].엔진칸.compensationType ? '' : '정비청산 틀림'; } catch (e) { return '정비청산 오류: ' + e; } } },
    // [2026.11.03 복잡사건 86] 의제취득 — 넥스 judge 「의제취득」이 1985년 전 취득 땅의 취득가액을 의제취득일 현재 가액과 실가+물가상승분 중 많은 것으로 하는지
    { 길: '넥스 → 의제취득일 전 취득 자산의 취득가액(소득세법 시행령 §176의2④)', fn: function () { try { var r = JUDGE_MORE_['의제취득']({ 자산: '토지', 취득일: '1975-03-10', 양도일: '2026-10-20', 양도가액: 1200000000, 양도기준시가: 400000000, 의제기준시가: 12000000, 실지취득가액: 15000000, 물가상승률: 2.1 }); return r.취득가액 === 46500000 && r.고른 === '2호' && r.경우.length === 3 && r.경우[0].엔진칸.comparableTransactionPrice === 46500000 ? '' : '의제취득 틀림'; } catch (e) { return '의제취득 오류: ' + e; } } },
    // [2026.11.03 복잡사건 85] 고가 매매 — 넥스 calculate_low_price_transfer_gift_amount가 판 사람 양도가액(§96③2호가)·산 사람 나중 취득가액(시행령 §167④)을 내는지
    { 길: '넥스 → 가족 간 고가 매매 양쪽 양도가액·취득가액(소득세법 §96③·§101①)', fn: function () { try { var r = toolCalculateLowPriceTransferGiftAmount({ fairMarketValue: 500000000, transferPrice: 800000000 }); return r.매도인_양도가액 === 650000000 && r.매수인_나중양도_취득가액 === 500000000 && r.부당행위계산 === true ? '' : '고가 매매 틀림'; } catch (e) { return '고가 매매 오류: ' + e; } } },
    // [2026.11.03 복잡사건 84] 세대판정 — 넥스 judge 「세대판정」이 주소가 다른 배우자·따로 세대가 못 되는 자녀 주택을 세는지
    { 길: '넥스 → 1세대 범위 판정(소득세법 §88 6호·시행령 §152의3)', fn: function () { try { var r = JUDGE_MORE_['세대판정']({ 양도할: 'A', 양도일: '2026-09-30', 취득일: '2014-05-20', 양도가액: 1300000000, 취득가액: 600000000, 배우자: { 있음: '예', 같은주소: '아니오', 주택: ['B'] }, 가족: [{ 이름: '장남', 관계: '자녀', 나이: 32, 같은주소: '예', 주택: ['C'] }, { 이름: '차녀', 관계: '자녀', 나이: 26, 같은주소: '아니오', 소득요건: '아니오', 주택: ['D'] }, { 이름: '모친', 관계: '부모', 나이: 78, 같은주소: '아니오', 주택: ['E'] }] }); return r.세대주택수 === 4 && r.주민주택수 === 2 && r.경우.length >= 2 ? '' : '세대판정 틀림'; } catch (e) { return '세대판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 83] 중과판정 — 넥스 judge 「중과판정」이 지방 저가 주택을 주택 수에서 빼고 일반주택을 중과에서 빼는지
    { 길: '넥스 → 다주택 중과 판정(소득세법 §104⑦·시행령 §167의3)', fn: function () { try { var r = JUDGE_MORE_['중과판정']({ 양도할: 'A', 양도일: '2026-10-15', 취득일: '2016-06-01', 양도가액: 1500000000, 취득가액: 700000000, 조정대상지역: '예', 주택: [{ 이름: 'A', 지역: '수도권' }, { 이름: 'B', 지역: '지방', 기준시가: 180000000 }, { 이름: 'C', 지역: '광역시', 사유: '상속', 상속일: '2023-02-10' }, { 이름: 'D', 지역: '수도권', 사유: '장기임대', 요건확인: '예' }] }); return r.중과주택수 === 3 && r.중과 === false && r.경우.length === 2 && r.경우[0].엔진칸.isMultiHouseRentalExemption === true ? '' : '중과판정 틀림'; } catch (e) { return '중과판정 오류: ' + e; } } },
    // [2026.11.03 복잡사건 82] 필요경비 — 넥스 judge 「필요경비」가 이자·수선비·증빙 없는 지출을 빼는지
    { 길: '넥스 → 필요경비 인정 판정(소득세법 §97·시행령 §163)', fn: function () { try { var r = JUDGE_MORE_['필요경비']({ 양도가액: 500000000, 양도일: '2025-11-28', 취득가액: 300000000, 취득일: '2016-01-10', 항목: [{ 이름: '대출이자', 금액: 10000000 }, { 이름: '엘리베이터 설치', 금액: 20000000, 증빙: '세금계산서' }, { 이름: '도배', 금액: 3000000, 증빙: '카드' }, { 이름: '양도 중개수수료', 금액: 4000000, 증빙: '현금' }] }); return r.필요경비 === 20000000 && r.합계.안됨 === 17000000 ? '' : '필요경비 판정 틀림'; } catch (e) { return '필요경비 오류: ' + e; } } },
    // [2026.11.03 복잡사건 81] 주택여부 — 넥스 judge 「주택여부」가 주거용 오피스텔을 주택으로 세는지
    { 길: '넥스 → 주택 해당 여부 판정(소득세법 §88 7호·시행령 §152의4)', fn: function () { try { var r = JUDGE_MORE_['주택여부']({ 양도할: 'A', 양도일: '2025-11-20', 취득일: '2018-03-15', 양도가액: 1000000000, 취득가액: 420000000, 건물: [{ 이름: 'A', 공부상: '아파트', 실제: '주거' }, { 이름: 'B', 공부상: '오피스텔', 실제: '주거', 전입: '예' }] }); return r.주택수 === 2 && r.공부상주택수 === 1 && r.경우.length === 2 ? '' : '주택여부 판정 틀림'; } catch (e) { return '주택여부 오류: ' + e; } } },
    // [2026.11.03 복잡사건 80] 부수토지 — 넥스 judge 「부수토지」가 배율을 넘는 땅을 갈라 두 거래로 내는지
    { 길: '넥스 → 주택부수토지 배율 판정(시행령 §154⑦·§168의12)', fn: function () { try { var r = JUDGE_MORE_['부수토지']({ 양도일: '2025-10-20', 취득일: '2014-04-10', 양도가액: 1450000000, 취득가액: 520000000, 토지비율: 0.8, 토지면적: 990, 정착면적: 150, 용도지역: '수도권 주거', '1세대1주택': '예' }); return r.넘는면적 === 540 && r.경우.length === 3 && r.경우[0].엔진칸늘.length === 2 && r.경우[0].엔진칸늘[1].isNonBusinessLand === true ? '' : '부수토지 판정 틀림'; } catch (e) { return '부수토지 오류: ' + e; } } },
    // [2026.11.03 복잡사건 79] 양도시기 — 넥스 judge 「양도시기」가 잔금 전 등기를 양도일로 잡고 자가건설은 임시사용승인일로 잡는지
    { 길: '넥스 → 양도·취득 시기 판정(시행령 §162 각 호)', fn: function () { try { var r = JUDGE_MORE_['양도시기']({ 양도: { 원인: '매매', 잔금일: '2026-01-15', 등기접수일: '2025-12-28' }, 취득: { 원인: '자가건설', 사용승인일: '2019-05-10', 임시사용승인일: '2018-11-01' } }); return r.양도시기.날짜 === '2025-12-28' && r.취득시기.날짜 === '2018-11-01' && r.예정신고기한 === '2026-02-28' ? '' : '양도시기 판정 틀림'; } catch (e) { return '양도시기 오류: ' + e; } } },
    // [2026.11.03 복잡사건 78] 보상금구분 — 넥스 judge 「보상금구분」이 영업손실·주거이전비·지역권을 양도가액에서 빼고 소송 증액 추가신고 기한을 잡는지
    { 길: '넥스 → 수용 보상금 가르기(양도·사업·기타·과세 안 함)', fn: function () { try { var r = JUDGE_MORE_['보상금구분']({ 항목: [{ 종류: '토지', 금액: 820000000 }, { 종류: '영업손실', 금액: 96000000 }, { 종류: '주거이전비', 금액: 18000000 }, { 종류: '지역권설정', 금액: 6000000 }, { 종류: '소송 증액', 금액: 110000000 }], 양도일: '2025-06-10', 취득일: '2008-04-01', 취득가액: 310000000, 사업인정고시일: '2024-02-01', 판결확정일: '2026-09-17' }); return r.합계.양도소득 === 930000000 && r.합계.사업소득 === 96000000 && r.기타소득.기타소득금액 === 2400000 && r.추가신고기한 === '2026-11-30' ? '' : '보상금구분 가르기·기한 틀림'; } catch (e) { return '보상금구분 오류: ' + e; } } },
    // [2026.11.03 복잡사건 77] 대토보상 — 넥스 judge 「대토보상」이 대토 몫 과세이연금액을 셈하고 등기 뒤 3년 안 증여를 이자 없는 §73⑤3호 3개월로 잡는지
    { 길: '넥스 → 대토보상 판정(과세이연금액·추징 기한)', fn: function () { try { var r = JUDGE_MORE_['대토보상']({ 사업인정고시일: '2023-05-10', 취득일: '2005-03-01', 양도일: '2025-08-20', 취득가액: 240000000, 필요경비: 10000000, 총보상액: 1000000000, 대토보상액: 600000000, 대토등기일: '2027-06-30', 사유: '3년내증여', 사유일: '2028-02-01' }); var c = r.경우.filter(function (x) { return x.추징; })[0]; return r.과세이연금액 === 315000000 && c && c.추징.근거 === '§73⑤3호' && c.추징.이자 === false && c.추징.신고납부기한 === '2028-05-31' ? '' : '대토보상 과세이연금액·추징 틀림'; } catch (e) { return '대토보상 오류: ' + e; } } },
    // [2026.11.03 복잡사건 76] 부동산매매업 — 넥스 judge 「부동산매매업」이 반년 과세기간 1취득·2판매를 잡고 비교과세 나목을 기본세율로 셈하는지
    { 길: '넥스 → 부동산매매업 판정(사업성·비교과세)', fn: function () { try { var r = JUDGE_MORE_['부동산매매업']({ 사업경비: 8000000, 다른종합소득금액: 30000000, 거래: [{ 이름: '아', 종류: '주택', 취득일: '2025-07-01', 취득가액: 500000000, 양도일: '2025-09-01', 양도가액: 700000000, 필요경비: 20000000, 중과: '예', 주택수: 3 }, { 이름: '임', 종류: '토지', 취득일: '2022-01-01', 취득가액: 100000000, 양도일: '2025-10-01', 양도가액: 260000000, 필요경비: 5000000, 비사업용토지: '예' }] }); var b = r.경우[1]; return r.사업성 === true && b.종합과세표준 === 355500000 && b.비교과세 && b.비교과세.나목 === 2190000 ? '' : '부동산매매업 사업성·나목 틀림'; } catch (e) { return '부동산매매업 오류: ' + e; } } },
    // [2026.11.03 복잡사건 75] 공동상속 — 넥스 judge 「공동상속」이 지분 같으면 거주자를, 그다음 최연장자를 최대지분자로 고르는지
    { 길: '넥스 → 공동상속주택 소수지분 판정(최대지분·거주·최연장)', fn: function () { try { var r = JUDGE_MORE_['공동상속']({ 상속개시일: '2019-03-15', 납세자: '갑', 상속인: [{ 이름: '갑', 지분: 30, 생년월일: '1960-01-01' }, { 이름: '을', 지분: 30, 거주: '예', 생년월일: '1970-01-01' }, { 이름: '병', 지분: 40 }] }); var r2 = JUDGE_MORE_['공동상속']({ 상속개시일: '2019-03-15', 납세자: '갑', 상속인: [{ 이름: '갑', 지분: 50, 생년월일: '1960-01-01' }, { 이름: '을', 지분: 50, 생년월일: '1970-01-01' }] }); return r.소유로보는사람 === '병' && r2.소유로보는사람 === '갑' && r2.세대주택수에듦 === true ? '' : '공동상속 최대지분자 순서 틀림'; } catch (e) { return '공동상속 오류: ' + e; } } },
    // [2026.11.03 복잡사건 74] 다가구 — 넥스 judge 「다가구」가 옥탑을 주택으로 써 4개 층이면 한 채 인정을 첫 경우로 넘기지 않는지
    { 길: '넥스 → 다가구주택 한 채 판정(층수·면적·세대수)', fn: function () { try { var r = JUDGE_MORE_['다가구']({ 대장주택층수: 3, 실제주택층수: 4, 주택바닥면적: 590, 세대수: 9, 양도가액: 1650000000, 양도일: '2026-10-20', 취득가액: 420000000, 취득일: '2009-05-10', 거주연수: 12, 다른주택수: 0 }); return r.다가구 === false && r.엔진칸 && !r.엔진칸.isOneHouseOneFamily ? '' : '다가구 4개 층을 한 채로 봄'; } catch (e) { return '다가구 오류: ' + e; } } },
    // [2026.11.03 복잡사건 73] 상속채무 — 넥스 judge 「상속채무」가 증빙 없는 개인 채무·갚을 수 있는 보증채무를 빼지 않고 상속세 엔진칸을 넘기는지
    { 길: '넥스 → 상속 채무 공제(증빙·보증·증여채무)', fn: function () { try { var r = JUDGE_MORE_['상속채무']({ 상속개시일: '2026-08-14', 자녀수: 2, 상속재산: 2000000000, 채무: [{ 이름: '대출', 종류: '금융', 금액: 500000000, 증빙: ['부채증명'] }, { 이름: '보증', 종류: '보증', 금액: 300000000, 주채무자변제불능: '아니오' }, { 이름: '차용', 종류: '개인', 금액: 100000000 }] }); var c = r.경우[r.경우.length - 1]; return c && c.엔진칸 && c.엔진칸.taxableEstateAmount === 1500000000 ? '' : '상속채무 확실한 빚만 빼는 경우 안 됨'; } catch (e) { return '상속채무 오류: ' + e; } } },
    // [2026.11.03 복잡사건 72] 토지건물구분 — 넥스 judge 「토지건물구분」이 30% 넘게 다른 계약서 값을 안분가액으로 바꿔 엔진칸에 넘기는지
    { 길: '넥스 → 토지·건물 가액 구분(§100③ 30%)', fn: function () { try { var r = JUDGE_MORE_['토지건물구분']({ 양도: { 합계: 3000000000, 토지: 1200000000, 건물: 1800000000, 날짜: '2026-12-20', 토지기준시가: 1200000000, 건물기준시가: 600000000 }, 취득: { 합계: 1500000000, 토지: 1000000000, 건물: 500000000, 날짜: '2014-05-10', 토지기준시가: 700000000, 건물기준시가: 500000000 } }); var t = r.경우[1].엔진칸.transactions; return r.경우.length === 2 && t[0].transferPrice === 2000000000 && t[1].transferPrice === 1000000000 ? '' : '토지건물구분 안분 안 됨'; } catch (e) { return '토지건물구분 오류: ' + e; } } },
    // [2026.11.03 복잡사건 71] 상속평가 — 넥스 judge 「상속평가」가 기준시가·시가 경우마다 상속세 엔진칸과 양도 취득가액을 같이 넘기는지
    { 길: '넥스 → 상속 평가 고르기(기준시가·감정·양도 취득가액)', fn: function () { try { var r = JUDGE_MORE_['상속평가']({ 상속개시일: '2026-07-15', 자녀수: 2, 다른재산과세가액: 300000000, 대상: [{ 이름: '집', 종류: '단독주택', 기준시가: 900000000, 감정: [{ 가액: 1500000000, 날짜: '2026-10-20' }], 예상양도가: 1650000000, 예상양도일: '2028-05-01' }] }); var ok = r && r.경우 && r.경우.length === 2 && r.경우[1].엔진칸.taxableEstateAmount === 1800000000 && r.경우[1].양도[0].엔진칸.acquisitionPrice === 1500000000 && r.경우[0].양도[0].엔진칸.acquisitionPrice === 900000000; return ok ? '' : '상속 평가 경우·양도 취득가액이 안 맞음'; } catch (e) { return '상속평가 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 70] 증여시기 — 넥스 judge 「증여시기」가 후보일마다 기준시가·10년 합산을 바꿔 엔진칸으로 넘기는지
    { 길: '넥스 → 증여 날짜 고르기(기준시가 고시·10년 합산)', fn: function () { try { var r = JUDGE_MORE_['증여시기']({ 증여자관계: '아버지', 재산: [{ 이름: '땅', 종류: '토지', 지금기준시가: 100000000, 다음기준시가: 120000000, 다음고시일: '2027-05-31' }], 사전증여: [{ 날짜: '2017-03-15', 금액: 50000000 }], 후보일: ['2027-03-15', '2027-06-01'] }); var a = r && r.후보판정; var ok = a && a[0].합산 === 50000000 && a[0].증여재산가액 === 100000000 && a[1].합산 === 0 && a[1].증여재산가액 === 120000000; return ok ? '' : '증여시기 판정 결과가 다름: ' + JSON.stringify(a); } catch (e) { return '증여시기 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 69] 생활비교육비 — 넥스 judge 「생활비교육비」가 비과세(직접 지출)와 과세(예금으로 남음)를 가르는지
    { 길: '넥스 → 생활비·교육비·결혼자금 비과세 판정', fn: function () { try { var r = JUDGE_MORE_['생활비교육비']({ 피부양: '예', 지출: [{ 관계: '어머니', 항목: '교육비', 금액: 9000000, 날짜: '2026-03-01', 직접지출: '예' }, { 관계: '아버지', 항목: '생활비', 금액: 20000000, 날짜: '2026-04-01', 남은재산: '예금' }] }); var ok = r && r.비과세합계 === 9000000 && r.과세합계 === 20000000; return ok ? '' : '생활비교육비 판정 결과가 다름: ' + JSON.stringify(r && r.요건); } catch (e) { return '생활비교육비 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 68] 세무조사절차 — 넥스 judge 「세무조사절차」가 사전통지·조사기간·중복조사·결과통지를 가르는지
    { 길: '넥스 → 세무조사 절차 판정(사전통지·조사기간·중복조사)', fn: function () { try { var r = JUDGE_MORE_['세무조사절차']({ 수입금액: 3000000000, 통지받은날: '2026-09-01', 조사시작일: '2026-09-14', 실제종료일: '2026-10-10' }); var ok = r && r.요건 && r.요건[0].결과 === '✘' && r.요건[1].결과 === '✘'; return ok ? '' : '세무조사절차 판정 결과가 다름: ' + JSON.stringify(r && r.요건); } catch (e) { return '세무조사절차 판정 오류: ' + e.message; } } },
    // [2026.11.03 복잡사건 67] 세금대납 — 넥스 judge 「세금대납」이 연대납부 한도·한도 넘은 대납 증여·증여자 연대납부를 가르는지
    { 길: '넥스 → 세금대납 판정(연대납부 한도·대납 증여)', fn: function () { try { var r = JUDGE_MORE_['세금대납']({ 종류: '상속세', 상속세: { 납부일: '2026-05-10', 상속인: [{ 이름: '갑', 받은자산: 600000000, 몫세액: 100000000, 낸세액: 400000000 }, { 이름: '을', 받은자산: 400000000, 몫세액: 300000000, 낸세액: 0, 대납자와관계: '형제' }] } }); var z = JUDGE_MORE_['세금대납']({ 종류: '증여세', 증여세: { 대신낸금액: 1000000, 수증자상황: '비거주', 증여조문: '§4①1호' } }); var ok = r.상속인판정[0].한도 === 500000000 && r.경우.length === 0 && z.연대납부 === true; return ok ? '' : '세금대납 판정 결과 어긋남'; } catch (e) { return String(e && e.message || e); } } },
    // [2026.11.02 복잡사건 66] 차명계좌 — 넥스 judge 「차명계좌」가 계좌별 증여추정 금액·배제기준·제척기간을 돌려주는지
    { 길: '넥스 → 차명계좌 판정(증여추정·배제기준·제척기간)', fn: function () { try { var r = JUDGE_MORE_['차명계좌']({ 관계: '부모', 실소유입증: '아니오', 계좌: [{ 이름: '가', 금액: 500000000, 명의자입증: 100000000, 입금일: '2018-05-10' }, { 이름: '나', 금액: 300000000, 명의자입증: 250000000, 입금일: '2019-01-02' }] }); var ok = r.증여추정합계 === 400000000 && r.계좌판정[1].증여추정 === false && r.제척기간[0].기산일 === '2018-09-01' && r.엔진칸.relation === '직계존속'; return ok ? '' : '차명계좌 판정이 기대와 다름: ' + r.표시 + ' ' + r.증여추정합계; } catch (err) { return '판정 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 65] 부동산 명의신탁 — 넥스 judge 「부동산명의신탁」이 명의신탁·증여를 가르고 양도 엔진칸을 돌려주는지
    { 길: '넥스 → 부동산 명의신탁 판정(명의신탁·취득 때 증여·양도 납세의무자)', fn: function () { try { var r = JUDGE_MORE_['부동산명의신탁']({ 자산: '토지', 자금: '신탁자', 처분권: '신탁자', 대금귀속: '신탁자', 취득일: '2015-03-10', 취득가액: 300000000, 양도일: '2026-04-20', 양도가액: 900000000 }); var ok = r.명의신탁 === true && r.경우.length === 1 && r.엔진칸.transferPrice === 900000000 && r.엔진칸.assetType === 'general'; return ok ? '' : '부동산 명의신탁 판정이 기대와 다름: ' + r.표시; } catch (err) { return '판정 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 64] 제2차 납세의무 — 넥스 judge 「제2차납세의무」가 세목마다 성립일 현재 과점 여부·사람별 한도를 돌려주는지
    { 길: '넥스 → 과점주주 제2차 납세의무 판정(성립일 지분·사람별 한도)', fn: function () { try { var r = JUDGE_MORE_['제2차납세의무']({ 발행주식: 10000, 법인재산충당: 0, 체납: [{ 세목: '법인세', 과세기간끝: '2025-12-31', 금액: 100000000 }], 주주: [{ 이름: '갑', 관계: '본인', 주식수: 4000 }, { 이름: '을', 관계: '배우자', 주식수: 2000 }, { 이름: '병', 관계: '타인', 주식수: 4000 }] }); var ok = r.결론 === '충족' && r.사람별한도['갑'] === 40000000 && r.사람별한도['을'] === 20000000 && !r.사람별한도['병']; return ok ? '' : '제2차 납세의무 판정이 기대와 다름: ' + r.표시 + ' ' + JSON.stringify(r.사람별한도); } catch (err) { return '판정 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 63] 특별연고자 분여 — 넥스 judge 「특별연고자」가 청구 기한·관리인 선임 신고기한·경우 셋 엔진칸을 돌려주는지
    { 길: '넥스 → 특별연고자 분여 판정(청구 기한·신고기한·공제 경우 셋)', fn: function () { try { var r = JUDGE_MORE_['특별연고자']({ 사망일: '2025-03-10', 관리인선임일: '2025-06-02', 수색공고만료일: '2026-07-31', 분여청구일: '2026-09-15', 재산합계: 1150000000, 장례비: 15000000, 분여: [{ 이름: '갑', 관계: '사실혼', 금액: 800000000 }] }); var ok = r.결론 === '충족' && r.청구마감 === '2026-09-30' && r.상속세신고기한 === '2025-12-02' && r.경우.length === 3 && r.경우[1].엔진칸.nonHeirBequestAmount === 800000000 && r.국가귀속 === 335000000; return ok ? '' : '특별연고자 판정이 기대와 다름: ' + r.표시 + ' ' + r.청구마감 + ' ' + r.상속세신고기한 + ' ' + r.국가귀속; } catch (err) { return '판정 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 62] 기타자산 — 넥스 judge 「기타자산」이 영업권(부동산과 함께)·회원권은 양도 기타자산 엔진칸으로, 점포 임차권은 기타소득 60%로 가르는지
    { 길: '넥스 → 기타자산 판정(영업권·회원권 엔진칸 misc_other·점포 임차권 기타소득·설비 사업소득)', fn: function () { try { var r = JUDGE_MORE_['기타자산']({ 양도일: '2026-06-30', 복식부기의무자: '예', 품목: [{ 이름: '영업권', 종류: '영업권', 함께양도부동산: '예', 양도가액: 150000000, 취득가액: 30000000, 취득일: '2012-03-01', 가액구분: '예' }, { 이름: '골프', 종류: '회원권', 양도가액: 260000000, 취득가액: 220000000, 취득일: '2025-09-10' }, { 이름: '점포', 종류: '점포임차권', 양도가액: 80000000 }, { 이름: '주방', 종류: '설비', 양도가액: 30000000 }] }); var f = r.품목판정; var ok = f[0].엔진칸.rightOrOtherKind === 'misc_other' && f[1].엔진칸.rightOrOtherKind === 'misc_other' && f[2].기타소득.기타소득금액 === 32000000 && f[3].소득 === '사업소득'; return ok ? '' : '기타자산 판정이 기대와 다름: ' + r.표시; } catch (err) { return '판정 호출 실패: ' + err.message; } } },
    // [2026.11.02 복잡사건 24] 대주주 판정 — 넥스 check_major_shareholder가 엔진 함수(checkMajorShareholderJS)에 닿는지
    { 길: '대주주 판정 — 넥스 → 엔진 함수', fn: function () { var m = need(chatTools(), ['check_major_shareholder'], '대화창 도구'); if (m) return m; try { var e = getUiCalcEngine_(); if (typeof e.checkMajorShareholderJS !== 'function') return '엔진에 대주주 판정 함수 없음'; var r = e.checkMajorShareholderJS({ marketType: 'kospi', transferDate: '2026-03-20', ownRatioPct: 0.8, ownMarketValue: 4160000000, relatedRatioPct: 0.8, relatedMarketValue: 4160000000, isLargestShareholderGroup: true }); return r && r.대주주여부 === true ? '' : '최대주주 가족 합산 1.6%가 대주주로 안 나옴'; } catch (err) { return '엔진 호출 실패: ' + err.message; } } },
    { 길: '쪼개 처리 — 도구 결과 인용(계산·계획·판정·조회) → 자문 장부 물건별·처리점검 → 보고서 저장 때 넥스에게 세액 대조', fn: function () { if (typeof ledgerRefResolver_ !== 'function' || typeof ledgerAdvByObject_ !== 'function' || typeof ledgerAdvGaps_ !== 'function' || typeof ledgerReportCheck_ !== 'function') return '인용 풀이·물건별·처리점검·보고서 점검이 이 판에 없음'; if (String(ledgerAdvBrief_).indexOf('ledgerRefResolver_(') === -1) return '자문 요약이 계산 말고 다른 결과를 인용하지 못함'; if (String(callClaude).indexOf('ledgerReportCheck_(') === -1) return '넥스 보고서 저장 때 세액 대조를 돌려주지 않음'; if (String(nxCaseChatGuide_('x')).indexOf('쪼개 처리') === -1) return '넥스 지시문에 쪼개 처리 규칙이 없음'; return ''; } },
    // [2026.11.03 결산] 화면에만 있던 엔진 계산기 10개를 넥스 도구로 이음 — 도구가 있고 엔진 함수에 닿는지(국외전출세는 실제로 셈)
    { 길: '넥스 → 엔진 계산기 10개(국외전출세·파생상품·기타자산 주식·취득가액 안분·최초 고시 전·1990 전 기준시가·사후관리 셋·사업기회 부문이익)', fn: function () { var m = need(chatTools(), ['calculate_exit_tax', 'calculate_derivative_transfer_tax', 'calculate_controlling_shareholder_stock', 'calculate_acquisition_allocation', 'calculate_pre_notice_standard_price', 'calculate_pre1990_acquisition_standard_price', 'calculate_return_farm_house_clawback', 'calculate_rental_housing_residence_clawback', 'calculate_inherited_house_undivided_registration_clawback', 'calculate_opportunity_segment_profit'], '대화창 도구'); if (m) return m; try { var r = runUiEngineCalcTool_('calculate_exit_tax', { departureDate: '2026-06-30', residenceYearsIn10: 8, isMajorShareholder: true, departureMarketValue: 1000000000, acquisitionPrice: 300000000 }); return r && !r.error ? '' : '국외전출세 도구가 엔진에 안 닿음: ' + JSON.stringify(r).slice(0, 120); } catch (err) { return '국외전출세 도구 호출 실패: ' + err.message; } } },
    // [2026.11.04 전용택 사건 — 넥스 암산] ① 열람한 계산기 분야가 대화 문맥(browsedCategories)·연결 사건 세목으로 다음 요청에도 열리는지 ② 보고서 저장 때 세액 숫자를 저장본과 대조하는지
    //  ③ 사건분류 「수용 등 공익사업 비과세·감면」이 1세대1주택을 켜지 않는지(토지 0원 사건) ④ 기능 부족 신고가 실제 기록됐을 때만 화면 표(gap_reported)가 가는지
    { 길: '넥스 계산기 열람 → 다음 요청에도 열림(문맥·사건 세목) · 보고서 세액 대조 · 수용 분류 ≠ 1세대1주택 · 신고 표', fn: function () {
      try { var b = String(browsedTaxCategories_.toString()); if (b.indexOf('browsedCategories') === -1 || b.indexOf('BROWSE_CATS_BY_TAX_') === -1) return '열람 분야를 문맥·사건 세목으로 받는 줄이 없음'; } catch (e) { return '열람 분야 함수를 못 봄'; }
      try { var s = browsedTaxCategories_([], { context: { browsedCategories: ['transfer'] } }); if (!s.has('transfer')) return '문맥의 열람 분야가 안 열림'; } catch (e) { return '열람 분야 셈 실패: ' + e.message; }
      if (typeof citeTaxFigures_ !== 'function' || typeof citeTaxNote_ !== 'function') return '보고서 세액 대조 함수가 없음';
      try { var tf = citeTaxFigures_({ 세액계산결과: [{ 최종세액: 87939421 }] }, '| 납부세액 | 87,939,421 |\n| 산출세액 | 79,800,456 |'); if (tf.있음.length !== 1 || tf.없음.length !== 1) return '세액 대조가 저장본 있는/없는 숫자를 못 가름: ' + JSON.stringify(tf.수); } catch (e) { return '세액 대조 실패: ' + e.message; }
      try { var cc = String(callClaude.toString()); if (cc.indexOf('citeTaxFigures_') === -1 || cc.indexOf('tax_unverified') === -1) return '보고서 저장 길에 세액 대조가 안 붙음'; } catch (e) { return '도구 왕복 함수를 못 봄'; }
      try { var st = { transferAssets: [{}], transferContracts: [{ buyers: [{}] }], transferSellers: [{}] }; ledgerApplyClass_(st, '수용 등 공익사업 비과세·감면'); if (st.transferAssets[0].isOneHouseOneFamily) return '수용 분류가 1세대1주택을 켬'; ledgerApplyClass_(st, '1세대1주택 비과세'); if (!st.transferAssets[0].isOneHouseOneFamily) return '1세대1주택 분류가 체크를 안 켬'; } catch (e) { return '사건분류 체크 실패: ' + e.message; }
      try { if (cc.indexOf("type: 'gap_reported'") === -1 || cc.indexOf("type: 'calc_browsed'") === -1) return '신고 표·열람 기억 알림이 화면으로 안 감'; } catch (e) { }
      return '';
    } },
  ];
}
function commSeamCheck_() {
  var out = [];
  commSeamList_().forEach(function (s) {
    var msg = '';
    // [2026.11.04] 판정 묶음 이음매는 참/거짓으로 답한다 — 참은 정상, 거짓은 끊김으로 바꿔 센다(예전엔 참이 끊김·거짓이 정상으로 뒤집혀 셌음)
    try { msg = s.fn(); if (msg === true) msg = ''; else if (msg === false) msg = '판정 결과가 기대와 다름'; else msg = msg || ''; } catch (e) { msg = '오류: ' + String(e && e.message || e).slice(0, 120); }
    out.push({ 길: s.길, ok: !msg, msg: msg });
  });
  return { ok: out.every(function (x) { return x.ok; }), 길: out, 끊김: out.filter(function (x) { return !x.ok; }) };
}
// ⑦ [2026.10.22] 카카오 봇 오류 기록 — 세무사님 "진행하고 일괄배포": 카카오 봇(NETAX_Kakao, 별도 서버)이 실패하면 사건 시트 "카카오오류" 탭에
//  한 줄씩(시각·종류·접속코드·내용) 남긴다. job은 그것을 읽어 대시보드·주간 개선 보고서에 띄운다(파일 저장 실패는 봇이 세무사님께 바로 문자도).
function kakaoErrorsRecent_(days) {
  const sh = SpreadsheetApp.openById(WORK_SHEET_ID).getSheetByName('카카오오류');
  if (!sh || sh.getLastRow() < 2) return [];
  const since = Date.now() - (days || 7) * 86400000, n = Math.min(200, sh.getLastRow() - 1);
  // 시각: 봇이 한국 시각 글자(yyyy-MM-dd HH:mm:ss)로 남긴다(시트 시간대 어긋남 방지). 예전 날짜 값 줄도 읽는다.
  const tsOf = function (v) { if (v instanceof Date) return v.getTime(); const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?/); return m ? Date.parse(m[1] + 'T' + m[2] + (m[3] || ':00') + '+09:00') : 0; };
  return sh.getRange(sh.getLastRow() - n + 1, 1, n, 4).getValues().filter(function (r) { const t = tsOf(r[0]); return t && t >= since; })
    .reverse().slice(0, 30).map(function (r) { return { at: Utilities.formatDate(new Date(tsOf(r[0])), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 종류: String(r[1] || ''), rid: String(r[2] || ''), 내용: String(r[3] || '').slice(0, 200) }; });
}
// ⑤ 대시보드·설정 카드용 한 번에 받기
function commStatus_() {
  // [2026.10.20] 끝나지 않은 요청은 개수 제한 없이 전부(오래된 순), 확인완료는 최근 15건 — 대시보드 🛠 개선요구 카드·설정 📝 요청 상태가 같은 자료를 본다
  var ra = commRequestsAll_(), reqs = ra.open.concat(ra.done);
    return { success: true, changes: commRecentChanges_().slice(0, 12), requests: reqs, openRequests: ra.open, doneRequests: ra.done,
    oldestDays: ra.open.length ? ra.open[0].days : 0, urgent: ra.open.filter(function (r) { return r.urgent && /접수|재오픈/.test(r.status); }).length,
    toConfirm: ra.open.filter(function (r) { return r.status === '반영됨'; }).length, questions: commDevQuestions_(), registry: aiRegistryList_(), dispatch: AI_DISPATCH_TABLE_,
    routine: commRoutineLog_(), uploads: (function () { try { return typeof custUploadsRecent_ === 'function' ? custUploadsRecent_(7) : []; } catch (e) { return []; } })(), // [2026.10.22] 고객이 올린 서류(최근 7일)
    kakaoErrors: (function () { try { return kakaoErrorsRecent_(7); } catch (e) { return []; } })(), // [2026.10.22] 카카오 봇 오류(최근 7일)
    bgFailed: (function () { try { return bgqFailedList_(); } catch (e) { return []; } })(),
    autoNotices: (function () { try { return typeof awNoticeList_ === 'function' ? awNoticeList_() : []; } catch (e) { return []; } })(), autoNightly: (function () { try { return typeof awNightlyLast_ === 'function' ? awNightlyLast_() : null; } catch (e) { return null; } })() }; // [2026.11.04 혼자 도는] 법령 개정 영향·기한·미수·멈춘 사건·공유 정리 // [2026.11.03] 뒤에서 할 일(문자·달력 등) 세 번 실패한 것
}
// ⑧ [2026.10.21] 고객 카톡 글 — 세무사님 결정("진행하고 다음으로 넘어가자"): 고객이 카톡으로 쓴 글이 넥스·job에 전달되지 않던 문제.
//  카카오 봇(NETAX_Kakao, 별도 서버)은 이미 모든 수신 메시지를 사건 시트 "카카오웹훅로그" 탭에 남기고(시각·카카오ID·글·원본), 카카오ID↔접속코드는
//  고객창구 시트 "카카오사용자매핑" 탭에 있다. job이 그 둘을 읽어 이 사건(my_report_id) 고객의 글만 골라 보여 준다 — 카카오 봇은 고치지 않음(응답 시간 제한).
//  참고로만: 계산 칸에 넣지 않는다(공통원칙 — 원시증빙 우선). 넥스는 서류 값과 다르면 그 사실만 세무사님께 말씀드린다.
function kakaoCaseMessages_(c, max) {
  const rid = String((c && c.my_report_id) || '').trim().toUpperCase();
  if (!rid) return [];
  let ids = {};
  try {
    const ms = SpreadsheetApp.openById(MY_SHEET_ID).getSheetByName('카카오사용자매핑');
    if (!ms || ms.getLastRow() < 2) return [];
    ms.getRange(2, 1, ms.getLastRow() - 1, 2).getValues().forEach(function (r) { if (String(r[1]).trim().toUpperCase() === rid && r[0]) ids[String(r[0])] = 1; });
  } catch (e) { return []; }
  if (!Object.keys(ids).length) return [];
  const out = [];
  try {
    const ls = SpreadsheetApp.openById(WORK_SHEET_ID).getSheetByName('카카오웹훅로그');
    if (!ls || ls.getLastRow() < 2) return [];
    const n = Math.min(3000, ls.getLastRow() - 1), start = ls.getLastRow() - n + 1;
    ls.getRange(start, 1, n, 4).getValues().forEach(function (r) {
      const t = String(r[2] || '').trim();
      if (!ids[String(r[1])] || !t || t.toUpperCase() === rid) return; // 접속코드 입력 줄은 뺌
      if (/"media"\s*:\s*\{[^}]*"url"/.test(String(r[3] || ''))) return; // 사진·파일은 제출자료 폴더에 따로 저장됨
      const at = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : String(r[0]).slice(0, 16);
      out.push({ at: at, text: t.slice(0, 500), link: /^https?:\/\//i.test(t) });
    });
  } catch (e) { return []; }
  return out.slice(-(max || 30));
}

// ⑦ [2026.10.21] 주간 개발자 실행 기록 — 웹 Claude 루틴이 끝날 때 tools/routine-log.js로 깃허브 routine-log 가지 docs/routine-log.json에 남긴다.
//  세무사님 결정(2026-10-21 "진행하고 다음항목으로 넘어가자"): 10-12 실행이 주간 한도로 멈췄는데 "성공"으로 남아 아무도 몰랐고, 10-19 실행이 넘긴 38건의 사유가 수정안 글에만 있었다.
//  job은 읽기만 한다. 이번 주 월요일 10시(한국)가 지났는데 그 주 기록이 없으면 missing — 실행이 안 됐거나 기록 전에 멈춘 것.
function commRoutineLog_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('routine_log_json'), txt = hit;
  if (hit === null) {
    try { var r = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + GH_REPO_ + '/routine-log/docs/routine-log.json?t=' + Date.now(), { muteHttpExceptions: true }); txt = r.getResponseCode() === 200 ? r.getContentText('UTF-8') : ''; } catch (e) { txt = ''; }
    try { cache.put('routine_log_json', txt, 1800); } catch (e) {}
  }
  var arr = []; try { arr = JSON.parse(txt || '[]'); } catch (e) { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  var kst = new Date(Date.now() + 9 * 3600000), dow = kst.getUTCDay(); // 0=일
  var monday = new Date(kst.getTime() - ((dow + 6) % 7) * 86400000), mondayStr = monday.toISOString().slice(0, 10);
  var pastMon10 = ((dow + 6) % 7) > 0 || kst.getUTCHours() >= 10;
  var thisWeek = arr.filter(function (e) { return e && String(e.date || '') >= mondayStr; });
  var last = arr.length ? arr[arr.length - 1] : null;
  var pcTodo = last ? (last.skipped || []).filter(function (s) { return s && s.pc; }) : [];
  return { last: last, recent: arr.slice(-6).reverse(), weekStart: mondayStr, missing: pastMon10 && !thisWeek.length, pcTodo: pcTodo };
}
// 🔑 OpenRouter 키 넣기(세무사님이 직접 입력 — 값은 되돌려 주지 않음)
var AI_KEY_NAMES_ = ['OPENROUTER_API_KEY'];
function aiSetKey_(body) {
  var name = String(body && body.name || ''), value = String(body && body.value || '').trim();
  if (AI_KEY_NAMES_.indexOf(name) === -1) return { error: '넣을 수 없는 키 이름입니다.' };
  var p = PropertiesService.getScriptProperties();
  if (!value) { p.deleteProperty(name); return { success: true, removed: true }; }
  if (value.length < 16 || /\s/.test(value)) return { error: '키 형식이 아닌 것 같습니다(공백 없이 통째로 붙여 넣어 주세요).' };
  p.setProperty(name, value);
  return { success: true };
}
// ⑥ 2중 검증 — 엔진 결과를 유료 AI(Sonnet — Haiku는 쉬운 사례도 틀려 오경보가 많았음, 2026-10-14 시험)가 입력값만 보고 독립 계산해 비교. 버튼을 누를 때만, 비용 표시.
function aiCrossCheck_(body) {
  var kind = String(body && body.kind || ''), input = body && body.input, engine = body && body.engine || {};
  if (!/^(transfer|gift|inheritance)$/.test(kind) || !input) return { error: '세목과 입력값이 필요합니다.' };
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY가 없습니다.' };
  // 이름·주소·주민번호 같은 항목은 지우고 숫자·날짜·구분값만 보낸다
  var strip = function (o) {
    if (Array.isArray(o)) return o.map(strip);
    if (!o || typeof o !== 'object') return o;
    var r = {};
    Object.keys(o).forEach(function (k) { if (/name|regNo|address|phone|TaxOffice|성명|주소|주민/i.test(k)) return; r[k] = strip(o[k]); });
    return r;
  };
  var label = { transfer: '양도소득세', gift: '증여세', inheritance: '상속세' }[kind];
  var keys = { transfer: ['과세표준', '산출세액', '납부세액_합계'], gift: ['과세표준', '산출세액', '납부세액'], inheritance: ['과세표준', '산출세액', '납부세액'] }[kind];
  var prompt = '너는 한국 세무 검산자다. 아래 ' + label + ' 계산 입력값(JSON)만 보고 현행 세법(' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd') + ' 기준)으로 독립적으로 계산하라. ' +
    '단계별 계산을 짧게 쓰고, 맨 끝에 다음 JSON만 코드블록으로: {"' + keys.join('": 숫자, "') + '": 숫자, "확신": "높음|보통|낮음", "주의": "입력만으로 판단 어려운 점"}\n\n입력값:\n' + JSON.stringify(strip(input)).slice(0, 12000);
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: DEFAULT_MODEL, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }) });
  var json = {}; try { json = JSON.parse(res.getContentText()); } catch (e) {}
  if (json.error) return { error: 'AI 호출 실패: ' + (json.error.message || '') };
  var text = (json.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
  var usage = null; try { usage = buildClaudeUsageInfo_(json, MODEL_CONFIG[DEFAULT_MODEL], DEFAULT_MODEL, null, Object.assign({}, (typeof AI_COST_CTX_ !== 'undefined' && AI_COST_CTX_) || {}, { kind: '세액 2중 검증', q: '세액 2중 검증(' + label + ')' })); } catch (e) {} // [2026.10.30 비용 기록]
  try { if (usage) ai_logPaid_({ entry: { kind: 'crosscheck', model: DEFAULT_MODEL, usd: usage.costUsd, q: '세액 2중 검증(' + label + ')' } }); } catch (e) {}
  var m = text.match(/```(?:json)?\s*([\s\S]*?)```/), ai = {};
  try { ai = JSON.parse(m ? m[1] : text.slice(text.lastIndexOf('{'))); } catch (e) { ai = {}; }
  var rows = keys.map(function (k) {
    var a = Number(ai[k]), g = Number(engine[k]);
    var same = isFinite(a) && isFinite(g) && Math.abs(a - g) <= Math.max(1000, Math.abs(g) * 0.001);
    return { 항목: k, 엔진: isFinite(g) ? g : null, AI: isFinite(a) ? a : null, 일치: same };
  });
  return { success: true, rows: rows, allSame: rows.every(function (r) { return r.일치; }), confidence: ai.확신 || '', caution: ai.주의 || '', steps: text.replace(/```[\s\S]*?```/g, '').trim().slice(0, 4000), krw: usage ? Math.round(usage.costUsd * 1400) : null };
}

// ---- 야간 실행(새벽 5시, 따로 도는 트리거) — 밤 묶음(runNightlyChiefManager, 6분 제한)을 늘리지 않으려고 분리 ----
// 위원 API 상태 점검(매일, 0원) → 개선 후보 보고서 다시 만들기. [2026.10.19] AI 자문단 자동 수집은 삭제(트리거 이름은 운영에 걸려 있어 그대로).
function aiFederationNightly() {
  try { aiNightlyHealth_(); } catch (e) { console.error('무료 AI 상태 점검 실패: ' + e.message); }
  try { buildImprovementReport_(); } catch (e) { console.error('개선 후보 보고서 실패: ' + e.message); }
}
function aiFedEnsureTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'aiFederationNightly'; });
  if (!has) ScriptApp.newTrigger('aiFederationNightly').timeBased().everyDays(1).atHour(5).create();
}
