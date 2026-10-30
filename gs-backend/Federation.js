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
  return text ? { ok: true, text: text } : { ok: false, error: '빈 응답' };
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
    try { buildImprovementReport_(); } catch (e) {}
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
    try { buildImprovementReport_(); } catch (e) {}
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
      try { if (typeof notifyOwner_ === 'function') notifyOwner_('urgent', '넥스 긴급 신고(세액·신고 결과 오류) — ' + e.want.slice(0, 80)); } catch (x) {} // [2026.10.22] 손목·휴대폰으로 바로
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
  try { buildImprovementReport_(); } catch (e) {}
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
    // 넥스 ↔ GAS(도구)
    { 길: '대화창 넥스 조회 길(사건처리·AI 판단·AI 회의 결론)', fn: function () { return need(lookupKinds(), ['caseproc', 'ai_review', 'law_decisions'], '조회 종류'); } },
    { 길: '사건을 맡은 넥스 — 질문(장부 do=ask)·도구 부족 신고(한 길: 개발자 기록 + 사건처리 빠진 도구 기록)·AI 회의 결론', fn: function () { var m = need(chatTools(), ['case_ledger', 'report_capability_gap'], '대화창 도구') || need(leadTools(), ['law_decisions'], '사건 도구'); if (m) return m; return String(callClaude).indexOf('caseProcAiLogGaps_') === -1 ? '사건 연결 대화의 도구 부족 신고가 사건처리 빠진 도구 기록에 안 감' : ''; } },
    // [2026.10.22 넥스가 주인] 넥스 → GAS 한 바퀴(gas_run, 화면이 실행) → GAS가 못 푼 자리 → 넥스. 첫 글이 gas_run을 부르라고 하는지, 도구가 있는지
    // [2026.10.22 작업 기록부] 세무사님이 GAS 도구로 직접 하신 일 → 사건 기록부 → 넥스(채팅 조회·사건 지휘)가 읽음
    { 길: '세무사님 직접 작업 → 작업 기록부 → 넥스', fn: function () { if (typeof caseProcNexView_ !== 'function' || typeof caseProcLog_ !== 'function') return '작업 기록부가 이 판에 없음'; var v = caseProcNexView_({ id: 'seam', 증빙목록: [], 사건개요: {} }); return v && v.작업기록 ? '' : '현황에 작업기록 칸이 없음'; } },
    { 길: '넥스가 GAS 한 바퀴를 도구로 부름(사건처리 주인은 넥스)', fn: function () { var m = need(leadTools(), ['case_status', 'gas_run', 'gas_finish'], '사건 지휘 도구'); if (m) return m; if (typeof CASEPROC_AI_CLIENT_TOOLS_ === 'undefined' || CASEPROC_AI_CLIENT_TOOLS_.indexOf('gas_run') === -1) return '화면 실행 도구 표에 gas_run이 없음'; return nxCaseChatGuide_('점검').indexOf('gas_run') === -1 ? '넥스 지시문에 gas_run 순서가 없음' : ''; } },
    // [2026.10.23 ㅊ1] 규칙 없는 서류·메모의 글 → 넥스(doc_view) — 빠지면 넥스가 세무사님께 메모 내용을 되묻는다(점검표 139)
    { 길: '서류 읽기 한 길 — 원문은 file_read, GAS 정리값은 doc_facts(doc_view·doc_text는 대화창 넥스에 주지 않음)', fn: function () { var m = need(leadTools(), ['file_read', 'doc_facts'], '사건 도구'); if (m) return m; if (typeof NX_CASE_CHAT_SKIP_ === 'undefined' || NX_CASE_CHAT_SKIP_.indexOf('doc_view') === -1) return 'doc_view가 대화창 넥스에 다시 붙음(같은 글을 다르게 보여 줌)'; return nxCaseChatGuide_('점검').indexOf('file_read') === -1 ? '지시문이 file_read를 안 알려 줌' : ''; } },
    // [2026.10.28] 사건 장부(CaseLedger.js) — 세무사님 말씀·넥스 판단·서류 값이 한 장부에, 채팅 넥스(case_ledger·조회 ledger)·지휘 넥스(ledger_read·case_ledger)·화면(case_proc ledger*)이 같은 입구
    { 길: '사건 장부 — 채팅 넥스·지휘 넥스·화면이 같은 장부에 적음', fn: function () { var m = need(chatTools(), ['case_ledger'], '대화창 도구') || need(lookupKinds(), ['ledger'], '조회 종류') || need(leadTools(), ['ledger_read', 'case_ledger'], '사건 지휘 도구'); if (m) return m; if (typeof ledgerApi_ !== 'function' || typeof ledgerSet_ !== 'function') return '장부 함수가 이 판에 없음'; var n = ledgerNorm_('a0.assetType', '주택(주거용 오피스텔)'); return n && n.v === 'house' ? '' : '고르기 칸 글→코드 변환이 안 됨'; } },
    // [2026.10.28 시정 2단계] 질문·결정은 장부 줄 — 저장 입구(caseProcLoad_·caseProcPatch_)가 장부에서 붙이고 떼며, 직결 서비스는 장부를 받아 돌고 돌려준다(t6RecordForReader_ → t6MergeLedger_)
    { 길: '질문·결정 = 장부 한 곳(화면·넥스·직결 서비스·점검기 같은 길)', fn: function () { if (typeof ledgerQWrite_ !== 'function' || typeof ledgerQRead_ !== 'function') return '장부 질문 함수가 이 판에 없음'; if (typeof caseProcQHydrate_ !== 'function' || typeof caseProcQSplit_ !== 'function') return '저장 입구가 장부로 잇지 않음'; if (typeof t6MergeLedger_ !== 'function') return '직결 서비스 장부 합치기 없음'; var sp = caseProcQSplit_({ remaining: [1], decisions: { a: 1 }, x: 1 }); return (!('remaining' in sp.file) && !('decisions' in sp.file) && sp.file.x === 1) ? '' : '저장 파일에 질문·결정이 남음'; } },
    // [2026.10.29] 사건 장부의 바탕 — 서류 사실·서류끼리 맞대기·칸으로 간 길이 교차검증(처리개요)·직결 서비스·화면 「🔄 서류 사실 다시 모으기」에서 장부 짝 파일로, 화면 📒 ①②③으로 세무사님께
    { 길: '사건 흐름 한 바퀴(의뢰서 가설 → 사건개요 → 확보할 증빙 → 질문) ← 폴더 변동·세무사님 화면 저장·답·넥스 가설 → 장부·화면(⓪ 사건 흐름)', fn: function () { if (typeof caseFlowRound_ !== 'function' || typeof ledgerFromCaseWrite_ !== 'function' || typeof ledgerHypPut_ !== 'function' || typeof ledgerFlowView_ !== 'function') return '사건 흐름 층·한 바퀴 함수가 이 판에 없음'; if (typeof cpFlowQueueAdd_ !== 'function' || typeof cpFlowQueueRun_ !== 'function') return '한 바퀴 줄(폴더 변동·화면 저장·답 → 틱)이 없음'; if (typeof ledgerFlowBrief_ !== 'function') return '사건 화면마다 맨 위 장부 띠가 부르는 입구(ledgerFlow)가 없음'; if (typeof caseProcGraspMore_ !== 'function') return '의뢰서에서 물건·거래·쟁점 뽑기가 없음'; var L = { rows: {}, log: [], ov: {}, hyp: { claims: [{ f: '상대방', v: '홍길동', srcs: ['의뢰서.md'], by: 'GAS' }] } }; ledgerOvFromHypInner_(L); if (!(L.ov['ov.상대방'] && L.ov['ov.상대방'].state === '가설')) return '가설이 사건개요 층에 「가설」로 서지 않음'; var got = []; caseProcGraspMore_('서울특별시 강남구 대치동 316 아파트 양도. 1세대1주택 비과세 검토', { 세목: 'transfer' }, function (f, v) { got.push(f); }, 'x'); return got.indexOf('쟁점') !== -1 && got.indexOf('물건') !== -1 ? '' : '의뢰서 글에서 쟁점·물건을 못 뽑음'; } },
    // [2026.10.29 넥스 1~4] 세무사님 "ai가 처리할때는 사건장부 속의 정보를 적재적소에 제대로 활용하지 못하고 있다는 것인가?" → "그래라" — 장부 → 넥스(지휘·대화창) 길과, 중요한 순간 GAS → 넥스 → 세무사님 길
    { 길: '사건 장부 요약·서류 사실 찾기 → 넥스(지휘 case_status·ledger_read·대화창 caseproc·case_ledger facts/brief)', fn: function () { if (typeof ledgerNexBrief_ !== 'function' || typeof ledgerKbFind_ !== 'function') return '장부 요약·서류 사실 찾기 함수가 이 판에 없음'; var lt = (typeof caseProcAiLiveTools_ === 'function' ? caseProcAiLiveTools_() : []).filter(function (t) { return t.name === 'case_ledger'; })[0]; if (!lt || JSON.stringify(lt.input_schema).indexOf('facts') === -1) return '사건 지휘 case_ledger에 facts가 없음'; var ct = (typeof DRIVE_TOOLS !== 'undefined' ? DRIVE_TOOLS : []).concat(typeof JOB_AI_TOOLS_ !== 'undefined' ? JOB_AI_TOOLS_ : []).filter(function (t) { return t.name === 'case_ledger'; })[0]; if (!ct || JSON.stringify(ct.input_schema).indexOf('facts') === -1) return '대화창 case_ledger에 facts가 없음'; if (String(caseProcAiLiveExec_).indexOf('ledgerNexBrief_') === -1) return '사건 지휘 case_status에 장부 요약이 안 붙음'; if (String(job_lookup_).indexOf('장부요약') === -1) return '대화창 caseproc 조회에 장부 요약이 안 붙음'; var L = { rows: { 'chk:가설.c0.totalPrice': { state: '보류', label: '가설과 다름', ask: 'x' } }, hyp: { claims: [{ f: '쟁점', v: '1세대1주택 비과세', srcs: ['의뢰서.md'] }] }, ev: {} }; var m = ledgerMomentKeys_(L); return Object.keys(m).length === 2 ? '' : '중요한 순간(가설과 다름·새 쟁점)을 못 알아챔'; } },
    // [2026.10.29 넥스 도구 결과 보장] 대화창 넥스가 부른 도구는 하나마다 결과가 꼭 돌아가야 AI 서버가 다음 요청을 받는다. 예전 손 명단(147개)에서 10-28 도구 3개가 빠져 강문영 사건 검토가 거절됐다 — 명단을 없앴고, 여기서 넥스가 받는 도구마다 처리 분기가 있는지 배포 때마다 본다
    { 길: '대화창 넥스 도구 호출 → 서버 처리 → 결과(도구마다 하나씩)', fn: function () { if (typeof callClaude !== 'function' || typeof DRIVE_TOOLS === 'undefined') return '대화창 AI 함수가 이 판에 없음'; var src = String(callClaude); if (src.indexOf("b.name === 'list_drive_folder' ||") !== -1) return '옛 손 명단이 되살아남 — 명단에 없는 도구는 결과 없이 거절됨'; if (!/runToolBlock_\((block|runBlock)\)/.test(src) || src.indexOf('처리 코드가 결과를 만들지 못했다') === -1) return '도구마다 결과를 보장하는 감싸기가 없음'; /* [2026.10.30] 근거 확인이 저장할 글만 바꾼 사본(runBlock)으로 부름 */ var ts = DRIVE_TOOLS.slice(); try { ts = ts.concat(getClientActionTools_({ aiPanel: 'tab', openFile: { liveContent: '' }, currentPath: { folderId: 'x' } }), getClientActionTools_({ openFile: { liveContent: '' } })); } catch (e) { return '화면 도구 목록을 못 만듦: ' + e.message; } var seen = {}, miss = []; ts.forEach(function (t) { var n = t && t.name; if (!n || t.type || seen[n]) return; seen[n] = 1; if (n !== 'read_drive_file' && src.indexOf("block.name === '" + n + "'") === -1) miss.push(n); }); return miss.length ? '처리 코드 없는 도구 ' + miss.length + '개(넥스가 부르면 실패 결과만 감): ' + miss.join(', ') : ''; } },
    // [2026.10.29 거래 사슬] 세무사님 "전혀 관계없는 엉뚱한 계약서(거래당사자나 거래물건 등)가 들어와도 분별을 못한다는 것이다. 이것은 반드시 수정되어야 한다"
    { 길: '거래 사슬(계약서·등기부 고리, 사슬 밖 계약서 질문) → 장부·화면·넥스 요약', fn: function () { if (typeof tcDealChain_ !== 'function' || typeof ledgerChainPut_ !== 'function') return '거래 사슬 함수가 이 판에 없음'; if (String(ledgerNexBrief_).indexOf('거래사슬') === -1) return '넥스 장부 요약에 거래 사슬이 없음'; if (String(trcQuestions_).indexOf('사슬밖') === -1) return '사슬 밖 계약서 질문이 없음'; var loc = '경기도 군포시 금정동 689 가상힐타운 제201동 제18층 제1807호'; var regs = [{ file: '등기부.pdf', r: { docs: [{ 소재지: loc, 소유권이력: [{ 순위: '1', 목적: '소유권보존', 접수일: '2022-06-30', 권리자: [{ 이름: '가상건설' }] }, { 순위: '2', 목적: '소유권이전', 접수일: '2022-07-05', 원인: '매매', 원인일: '2019-02-11', 권리자: [{ 이름: '정우진' }] }, { 순위: '3', 목적: '소유권이전', 접수일: '2027-02-22', 원인: '매매', 원인일: '2026-11-05', 권리자: [{ 이름: '한지우' }] }] }] } }]; var cs = [{ file: '분양권매매.pdf', role: 'buyer', r: { 소재지: loc, 매도인: '고현옥', 매수인: '정우진', 계약일: '2019-02-11', 종류: '분양권 매매계약서' } }, { file: '양도.pdf', role: 'seller', r: { 소재지: loc, 매도인: '정우진', 매수인: '한지우', 계약일: '2026-11-05' } }]; var others = [{ file: '공급계약.pdf', r: { 소재지: loc, 종류: '분양(공급)계약서' }, parties: ['고현옥'] }, { file: '엉뚱.pdf', r: { 소재지: '서울특별시 강남구 대치동 316 은마아파트 1동 101호', 매도인: '김철수', 매수인: '이영희', 계약일: '2020-01-01' }, parties: ['김철수', '이영희'] }]; var ch = tcDealChain_(cs, others, regs, ['정우진'], {}); var offF = ch.off.map(function (o) { return o.file; }); if (offF.indexOf('엉뚱.pdf') === -1) return '다른 물건·남의 계약서를 사슬 밖으로 못 가림'; if (offF.length !== 1) return '사슬에 이어진 계약서(분양권 전매·전 소유자 공급계약·양도)를 사슬 밖으로 잘못 봄: ' + offF.join(','); return ch.rows.length === 1 && /취득/.test(ch.rows[0].납세자위치) && /양도/.test(ch.rows[0].납세자위치) ? '' : '납세자 위치(취득·양도 고리)를 못 정함'; } },
    // [2026.10.29 계획서 3판] 세무사님 "gas는 전체가 하나의 틀에 박힌 도구가 아니라 하나하나가 별도의 도구일 뿐이라고!" — 같은 도구를 세무사님 화면·넥스 두 입구가 쥐고, 결과는 장부에. 다시 벨트로 묶이면 여기서 빨갛게
    // [2026.10.29 넥스 하나 — 계획서 3판 5단계·7단계 "두 입구와 화면이 같은 도구 목록을 쥐고 있는지"] 사건에 연결된 대화창 넥스가 사건 도구 전부를 쥐고 실행하는지
    { 길: '넥스 하나 — 🤖 넥스로 처리·"이 사건 처리하자"를 대화창 넥스가 맡음(대화창 도구 + 사건 도구 전부, 같은 지시문)', fn: function () {
      if (typeof nxCaseChatTools_ !== 'function' || typeof nxCaseChatToolRun_ !== 'function' || typeof nxCaseChatGuide_ !== 'function') return '사건 도구 잇기 함수가 이 판에 없음';
      if (typeof callClaude !== 'function') return '대화창 AI 함수가 이 판에 없음';
      var src = String(callClaude);
      if (src.indexOf('nxCaseChatTools_(') === -1) return '대화창 넥스 도구 목록에 사건 도구를 붙이지 않음';
      if (src.indexOf('nxCaseChatToolRun_(') === -1 || src.indexOf("type: 'case_gas'") === -1) return '대화창 넥스가 사건 도구를 실행하지 못함(실행기·GAS 넘기기 없음)';
      var have = DRIVE_TOOLS.map(function (t) { return t.name; }).concat(JOB_AI_TOOLS_.map(function (t) { return t.name; }));
      var all = caseProcAiLiveTools_().map(function (t) { return t.name; });
      var got = have.concat(nxCaseChatTools_(have).map(function (t) { return t.name; }));
      var miss = all.filter(function (n) { return got.indexOf(n) === -1 && NX_CASE_CHAT_SKIP_.indexOf(n) === -1; }); // [2026.10.30] 일부러 뺀 것(같은 일을 하는 대화창 도구가 있거나 한 길로 합친 것)은 빼고 본다
      if (got.indexOf('report_parts') === -1) return '보고서 재료 도구(report_parts)가 대화창 넥스에 없음 — 문서작성 탭 기능을 넥스가 못 씀';
      if (typeof nxCaseCalcToolSave_ !== 'function' || src.indexOf('nxCaseCalcToolSave_(') === -1) return '사건 연결 대화의 계산 도구 결과가 경우(안) 저장본으로 안 남음';
      if (typeof ledgerAdvPut_ !== 'function' || String(ledgerToolRun_).indexOf("'advice'") === -1) return '자문 장부(쟁점·대안·근거·위험·권고·보고서)가 이 판에 없음';
      if (miss.length) return '사건 도구 중 대화창 넥스에 없는 것 ' + miss.length + '개: ' + miss.join(', ');
      if (String(nxCaseChatGuide_('x')).indexOf('잠정치') === -1) return '사건을 맡은 넥스 지시문에 잠정치 방식이 없음';
      return '';
    } },
    // [2026.10.30 근거 확인 — 세무사님 "4번 시험사건에 내가 일일이 그런 걸 확인할 시간이 없다"] 보고서 저장 → GAS 근거 대조 → 보고서 끝 표·넥스에게 [근거 확인]·장부 보고서 칸 → 📒 ⑥ 🔎
    { 길: '넥스 보고서 저장 → 근거 대조(조문·판례·심판례, GAS) → 보고서 끝 근거 확인표·넥스 고침·장부 ⑥ 자문 · 세무사님 🔎 근거 확인', fn: function () {
      if (typeof citeCheck_ !== 'function' || typeof citeTableMd_ !== 'function' || typeof citeLedgerMark_ !== 'function' || typeof ledgerCiteRun_ !== 'function') return '근거 대조 도구(CiteCheck.js)가 이 판에 없음';
      var src2 = String(callClaude);
      if (src2.indexOf('citeCheck_(cc') === -1 || src2.indexOf('citeLedgerMark_(cr') === -1) return '넥스 보고서 저장 때 근거 대조가 돌지 않음(callClaude 고리 빠짐)';
      if (String(ledgerToolRun_).indexOf("'check_refs'") === -1 || String(ledgerApi_).indexOf("'ledgerCite'") === -1) return '넥스(do=check_refs)·화면(ledgerCite) 입구 중 빠진 것이 있음';
      if (String(nxCaseChatGuide_('x')).indexOf('예상 반박과 대응') === -1) return '넥스 지시문에 근거 확인·예상 반박 규칙이 없음';
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
      if (String(caseFlowRound_).indexOf('ledgerLookup_') === -1) return 'GAS 규칙(새 필지 → 공부 조회)이 한 바퀴에 없음';
      var turn = ''; // [2026.10.30] 옛 사건 지휘(caseProcAiTurn_)는 지웠다 — 넥스를 묶던 장치가 되살아났는지는 대화창 넥스 사건 도구 실행(nxCaseChatToolRun_)에서 본다
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
    { 길: '넥스 제안 카드(답 넣기) → GAS 칸 반영(값 모양 맞추기)', fn: function () { if (typeof cpAnswerValueNorm_ !== 'function') return '값 모양 맞추기가 이 판에 없음'; try { var r = cpAnswerValueNorm_('expenses', { 양도비용: 4480000, 취득비용: 8160000 }, { cands: [{ kind: '양도', label: '중개보수', amount: 4480000, file: '중개보수영수증.pdf' }] }); var d = JSON.parse(r.value); if (!d || !Array.isArray(d.items) || d.items.length !== 2 || d.items[0].label !== '중개보수' || d.items[1].kind !== '취득') return '객체 값이 items 2건으로 안 바뀜: ' + r.value.slice(0, 120); if (/\[object/.test(r.shown)) return '카드 글에 [object Object]'; } catch (e) { return '값 모양 맞추기 실패: ' + (e && e.message || e); } return ''; } }
  ];
}
function commSeamCheck_() {
  var out = [];
  commSeamList_().forEach(function (s) {
    var msg = '';
    try { msg = s.fn() || ''; } catch (e) { msg = '오류: ' + String(e && e.message || e).slice(0, 120); }
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
    kakaoErrors: (function () { try { return kakaoErrorsRecent_(7); } catch (e) { return []; } })() }; // [2026.10.22] 카카오 봇 오류(최근 7일)
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
