// Federation.js — AI 연합체·AI 자문단·개발자↔사용자 소통·세액 2중 검증(2026.10.13). 설명: docs/ai-federation.md
// =========================================================
// [2026.10.13] AI 연합체 · 개발자↔사용자 소통 · AI 자문단 — 세무사님 구상
//  "다양한 AI를 무료 계정으로라도 망라해 적재적소에 활용하는 AI 연합체", "여러 AI들로부터 관련 기술 정보를 꾸준히 습득해 시스템에 적용".
//  운영팀장 = GAS(배차·예산·고객자료 차단·기록은 규칙이라 0원, 매번 똑같이 지킴). 정비팀장 = 웹 Claude Code 루틴(주간, 구독).
//  등급: A 무료 공식 API(GAS가 직접 호출) / B 무료 웹 계정(약관상 자동화 금지 → 수동: 질문 복사·사이트 열기·답 붙여넣기)
//        / C 유료 API·기기 안 AI. 고객 자료는 C만 — 배차 단계에서 기계적으로 막는다. 상세: docs/ai-federation.md
// =========================================================
var AI_SPECIALTIES_ = ['세법판단', '전략', '문서작성', '요약', '분류추출', '번역', '일반지식', '코딩·기술', '웹검색', '긴문서', '이미지생성', '영상생성', '음성합성', '자막', '편집'];
// keyProp: 스크립트 속성 이름(세무사님이 설정 🤝 카드 🔑에서 직접 넣음 — Claude는 계정·키를 만들거나 넣지 않음)
// dailyFree: 무료 일일 요청 한도(보수적으로 잡음 — 실제 한도는 각 서비스 안내 확인), clientData: 고객 자료 허용
var AI_REGISTRY_ = [
  // ---- C 유료 API (고객 자료 허용 — 데이터 학습 미사용 약관) ----
  { id: 'claude-sonnet', tier: 'C', name: 'Claude Sonnet(API)', provider: 'claude', modelVar: 'DEFAULT_MODEL', keyProp: 'ANTHROPIC_API_KEY', clientData: true, specialties: ['세법판단', '문서작성', '전략', '코딩·기술'], speed: '보통', cost: '중' },
  { id: 'claude-haiku', tier: 'C', name: 'Claude Haiku(API)', provider: 'claude', modelVar: 'LIGHT_MODEL', keyProp: 'ANTHROPIC_API_KEY', clientData: true, specialties: ['요약', '분류추출', '문서작성'], speed: '빠름', cost: '저' },
  { id: 'claude-opus', tier: 'C', name: 'Claude Opus(API)', provider: 'claude', model: 'claude-opus-4-8', keyProp: 'ANTHROPIC_API_KEY', clientData: true, specialties: ['전략', '세법판단'], speed: '느림', cost: '고' },
  { id: 'gemini-paid', tier: 'C', name: 'Gemini(유료 API)', provider: 'gemini', model: 'gemini-3.6-flash', keyProp: 'GEMINI_API_KEY', clientData: true, specialties: ['긴문서', '요약', '분류추출'], speed: '빠름', cost: '저', note: '결제 연결된 키일 때만 고객자료 허용(무료 등급 키는 입력이 개선에 쓰일 수 있음)' },
  { id: 'chrome-nano', tier: 'C', name: '크롬 내장 AI(Gemini Nano, 기기 안)', provider: 'device', clientData: true, specialties: ['요약', '분류추출', '번역'], speed: '빠름', cost: '0', status: '대기', note: 'PC 밖으로 안 나감. 확장프로그램 Prompt API 연결은 다음 단계(환경변화 세션 capabilities로 지원 여부 확인)' },
  // ---- A 무료 공식 API (고객 자료 금지 — 무료 등급은 입력이 서비스 개선에 쓰일 수 있음) ----
  { id: 'gemini-free', tier: 'A', name: 'Gemini API 무료 등급', provider: 'gemini', model: 'gemini-3.6-flash', keyProp: 'GEMINI_FREE_API_KEY', clientData: false, dailyFree: 200, specialties: ['일반지식', '요약', '긴문서', '코딩·기술'], speed: '빠름', cost: '0' },
  { id: 'groq', tier: 'A', name: 'Groq(무료, 오픈모델)', provider: 'openai', endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', keyProp: 'GROQ_API_KEY', clientData: false, dailyFree: 300, specialties: ['일반지식', '요약', '코딩·기술'], speed: '매우 빠름', cost: '0' },
  { id: 'openrouter', tier: 'A', name: 'OpenRouter 무료 모델', provider: 'openai', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'deepseek/deepseek-chat-v3-0324:free', keyProp: 'OPENROUTER_API_KEY', clientData: false, dailyFree: 50, specialties: ['일반지식', '코딩·기술', '요약'], speed: '보통', cost: '0' },
  { id: 'mistral', tier: 'A', name: 'Mistral(무료 실험 등급)', provider: 'openai', endpoint: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest', keyProp: 'MISTRAL_API_KEY', clientData: false, dailyFree: 100, specialties: ['일반지식', '요약', '번역'], speed: '빠름', cost: '0' },
  { id: 'hf', tier: 'A', name: 'Hugging Face 공개 모델', provider: 'openai', endpoint: 'https://router.huggingface.co/v1/chat/completions', model: 'meta-llama/Llama-3.1-8B-Instruct', keyProp: 'HF_TOKEN', clientData: false, dailyFree: 50, specialties: ['요약', '분류추출'], speed: '보통', cost: '0' },
  { id: 'google-tts', tier: 'A', name: 'Google Cloud 음성합성(무료 범위)', provider: 'none', clientData: false, specialties: ['음성합성'], cost: '0(월 무료 범위)', status: '대기', note: '쇼츠용 후보 — 파이프라인은 별도 설계(docs/shorts-pipeline.md)' },
  // ---- B 무료 웹 계정 (약관상 자동 접속·답 자동수집 금지 → 수동 모드만) ----
  { id: 'web-chatgpt', tier: 'B', name: 'ChatGPT(웹)', url: 'https://chatgpt.com/', clientData: false, specialties: ['일반지식', '코딩·기술', '이미지생성', '문서작성'], tos: 'OpenAI 약관: 데이터·Output을 자동/프로그램으로 추출 금지' },
  { id: 'web-gemini', tier: 'B', name: 'Gemini(웹)', url: 'https://gemini.google.com/app', clientData: false, specialties: ['일반지식', '웹검색', '이미지생성', '영상생성'], tos: '구글 약관: robots.txt 등 기계판독 지시를 어기는 자동 접근 금지 — /app·/chat은 robots.txt 차단' },
  { id: 'web-claude', tier: 'B', name: 'Claude(웹)', url: 'https://claude.ai/new', clientData: false, specialties: ['문서작성', '코딩·기술', '세법판단'], tos: 'Anthropic 소비자 약관: API 키 외 봇·스크립트 자동 접속 금지' },
  { id: 'web-copilot', tier: 'B', name: 'Copilot(웹)', url: 'https://copilot.microsoft.com/', clientData: false, specialties: ['웹검색', '일반지식', '이미지생성'], tos: '마이크로소프트 서비스 약관: 명시 허용 없이 웹 스크래핑·데이터 추출 금지' },
  { id: 'web-perplexity', tier: 'B', name: 'Perplexity(웹)', url: 'https://www.perplexity.ai/', clientData: false, specialties: ['웹검색', '일반지식'], tos: 'Perplexity 약관: 봇·자동화 도구·크롤러 사용 금지' },
  { id: 'web-deepseek', tier: 'B', name: 'DeepSeek(웹)', url: 'https://chat.deepseek.com/', clientData: false, specialties: ['코딩·기술', '일반지식'], tos: 'DeepSeek 약관: 로봇·스파이더 등 자동 수단으로 내용 복제 금지' },
  { id: 'web-grok', tier: 'B', name: 'Grok(웹)', url: 'https://grok.com/', clientData: false, specialties: ['웹검색', '일반지식', '이미지생성'], tos: 'xAI 이용정책: 허가 없는 봇·스크립트 자동 접속 금지(원문 재확인 필요)' },
  { id: 'web-clovax', tier: 'B', name: '클로바X(웹)', url: 'https://clova-x.naver.com/', clientData: false, specialties: ['일반지식', '번역', '문서작성'], tos: '네이버 이용약관: 자동화 수단 접근 제한(원문 재확인 필요) — 확인 전까지 수동' }
];
// 배차표 — 작업 종류 → 팀원 순서(앞이 우선), 예산 상한(원, 한 번), 고객자료 여부. 기존 ⚡ → 🔮 → 유료 경로를 이 표로 설명·통제한다.
var AI_DISPATCH_TABLE_ = {
  general_question: { label: '일반 질문(고객자료 없음)', order: ['rules', 'gemini-free', 'groq', 'mistral', 'openrouter', 'web-gemini-ext', 'claude-haiku'], maxKrw: 30, clientData: false, consensus: 3 },
  tax_judgment: { label: '세무 쟁점 판단', order: ['rules', 'claude-sonnet'], maxKrw: 400, clientData: true },
  strategy: { label: '🧠 전략 검토(AI 작업반장)', order: ['claude-opus', 'claude-sonnet'], maxKrw: 4000, clientData: true, maxRounds: 12 },
  doc_read: { label: '서류 읽기', order: ['rules', 'drive-ocr', 'gemini-paid', 'claude-haiku'], maxKrw: 50, clientData: true },
  report_fill: { label: '보고서 템플릿·문단 채우기', order: ['rules'], maxKrw: 0, clientData: true },
  report_judgment: { label: '보고서 판단 문단', order: ['claude-sonnet'], maxKrw: 400, clientData: true },
  report_proofread: { label: '보고서 맞춤법·문장 검토', order: ['claude-haiku'], maxKrw: 60, clientData: true },
  long_summary: { label: '수백 쪽 자료 요약', order: ['gemini-paid', 'claude-haiku'], maxKrw: 200, clientData: true },
  cross_check: { label: '최종 세액 2중 검증', order: ['engine', 'claude-sonnet'], maxKrw: 80, clientData: true },
  tech_advice: { label: 'AI 자문단(기술 정보)', order: ['gemini-free', 'groq', 'mistral', 'openrouter', 'hf', 'web-*(수동)'], maxKrw: 0, clientData: false },
  content_creation: { label: '콘텐츠 제작(블로그·쇼츠 — 설계 단계)', order: ['claude-sonnet', 'web-*(수동)', 'google-tts'], maxKrw: 0, clientData: false }
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
    var st = e.status || (e.tier === 'B' ? '수동(약관상 자동화 금지)' : e.provider === 'none' || e.provider === 'device' ? '대기' : aiHasKey_(e) ? (h[e.id] && h[e.id].ok === false ? '오류' : '사용 가능') : '대기(키 없음)');
    return { id: e.id, tier: e.tier, name: e.name, model: aiModelOf_(e) || '', specialties: e.specialties, clientData: e.clientData, dailyFree: e.dailyFree || null, usedToday: use[e.id] || 0, speed: e.speed || '', cost: e.cost || '', status: st, url: e.url || '', tos: e.tos || '', note: e.note || '', keyProp: e.keyProp || '', health: h[e.id] || null, price: (typeof MODEL_CONFIG !== 'undefined' && MODEL_CONFIG[aiModelOf_(e)]) ? { in: MODEL_CONFIG[aiModelOf_(e)].input, out: MODEL_CONFIG[aiModelOf_(e)].output } : null };
  });
}
// 배차 — 고객자료 여부 → 무료 가능 → 주특기 → 남은 한도 순으로 실제 호출 가능한 A·C 후보를 고른다(B는 수동이라 제외).
function aiDispatch_(opts) {
  opts = opts || {};
  var use = aiUsage_();
  var c = AI_REGISTRY_.filter(function (e) {
    if (e.tier === 'B' || e.provider === 'none' || e.provider === 'device') return false;
    if (opts.hasClientData && !e.clientData) return false; // 고객 자료는 무료 등급·웹 AI로 절대 안 보냄
    if (opts.freeOnly && e.tier !== 'A') return false;
    if (!aiHasKey_(e)) return false;
    if (e.dailyFree && (use[e.id] || 0) >= e.dailyFree) return false;
    if (opts.specialty && e.specialties.indexOf(opts.specialty) === -1) return false;
    return true;
  });
  c.sort(function (a, b) { return (a.tier === 'A' ? 0 : 1) - (b.tier === 'A' ? 0 : 1); });
  return c;
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
function aiLooksClientData_(t) {
  t = String(t || '');
  return /\d{6}\s*-\s*[1-4]\d{6}|\d{6}\s*-\s*[1-4]\*{6}|01[016789]-?\d{3,4}-?\d{4}|\d{3,6}-\d{2,6}-\d{4,8}|[가-힣]+(동|로|길)\s*\d+(-\d+)?\s*(번지)?\s*\d*호?|사건번호|고객명|납세자명/.test(t);
}
function aiNormConclusion_(s) {
  s = String(s || '');
  var m = s.match(/결론\s*[:：]\s*([^\n]+)/);
  var c = (m ? m[1] : s.split('\n').filter(function (x) { return x.trim(); }).slice(-1)[0] || '').trim();
  return c;
}
function aiBigrams_(s) { s = String(s || '').replace(/[\s\p{P}]/gu, ''); var b = {}; for (var i = 0; i + 1 < s.length; i++) b[s.substr(i, 2)] = 1; return b; }
function aiSimilar_(a, b) {
  var na = (String(a).match(/\d[\d,.]*/g) || []).map(function (x) { return x.replace(/,/g, ''); }).sort().join('|');
  var nb = (String(b).match(/\d[\d,.]*/g) || []).map(function (x) { return x.replace(/,/g, ''); }).sort().join('|');
  if (na && nb && na !== nb) return 0; // 숫자가 다르면 다른 결론
  var A = aiBigrams_(a), B = aiBigrams_(b), inter = 0, uni = 0, k;
  for (k in A) { uni++; if (B[k]) inter++; }
  for (k in B) if (!A[k]) uni++;
  return uni ? inter / uni : 0;
}
// 다수결 교차검증 — 고객 자료 없는 일반 질문을 무료 API 3곳에 동시에 묻고 결론이 맞는지 본다
function aiConsensus_(body) {
  var q = String(body && body.question || '').trim();
  if (!q) return { error: '질문이 비어 있습니다.' };
  if (!(body && body.noClientData)) return { error: '고객 정보가 없는 질문인지 확인(체크)해 주세요 — 무료 AI에는 고객 자료를 보내지 않습니다.' };
  if (aiLooksClientData_(q)) return { error: '주민번호·전화·계좌·상세주소처럼 고객 자료로 보이는 내용이 있어 무료 AI로 보내지 않았습니다.' };
  var cands = aiDispatch_({ freeOnly: true }).slice(0, 3);
  if (!cands.length) return { error: '쓸 수 있는 무료 AI가 없습니다 — 설정 🤝 카드 🔑에서 무료 API 키를 넣어 주세요(_확인조치사항.md에 발급 방법).' };
  var prompt = '다음 질문에 한국어로 정확하게 답하라. 모르면 모른다고 하라. 근거(법령 조문·공식 문서명)가 있으면 적어라. 마지막 줄은 반드시 "결론: (한 문장)" 형식.\n\n질문: ' + q;
  var answers = aiAskMany_(cands, prompt, 900).filter(function (a) { return a.ok; });
  answers.forEach(function (a) { a.conclusion = aiNormConclusion_(a.text); });
  // 결론끼리 묶기(비슷함 0.5 이상이면 같은 결론)
  var groups = [];
  answers.forEach(function (a) {
    var g = groups.filter(function (x) { return aiSimilar_(x.rep, a.conclusion) >= 0.5; })[0];
    if (g) g.members.push(a.name); else groups.push({ rep: a.conclusion, members: [a.name] });
  });
  groups.sort(function (x, y) { return y.members.length - x.members.length; });
  var top = groups[0] || null, agree = top ? top.members.length : 0;
  var verdict = !answers.length ? '답을 받지 못함' : agree >= 2 && agree === answers.length ? '일치(' + agree + '/' + answers.length + ')' : agree >= 2 ? '다수(' + agree + '/' + answers.length + ')' : '불일치 — 유료 AI나 법령 원문으로 확인 권장';
  return { success: true, verdict: verdict, agree: agree, total: answers.length, adopted: agree >= 2 ? top.rep : '', groups: groups, answers: answers.map(function (a) { return { name: a.name, conclusion: a.conclusion, text: a.text.slice(0, 2500) }; }) };
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
      x.결정 = d.선택 ? { 선택: d.선택, 내용: d.내용 || '', 메모: String(d.메모 || '').slice(0, 2000), 다수: d.다수 || '', 근거: d.근거 || [], 누가: '세무사님', 때: now } : null;
      x.상태 = !d.선택 ? '판단 대기' : d.선택 === '보류' ? '보류' : '결정';
      log(d.선택 ? '결정 ' + d.선택 + (d.내용 ? ' — ' + d.내용 : '') : '결정 취소');
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

// ---- AI 자문단(주 1회, 무료 API, 0원) ----
var AI_ADVICE_FILE_ = '_AI자문.json';
function aiAdviceFile_() { var f = ai_convFolder_(), it = f.getFilesByName(AI_ADVICE_FILE_); return it.hasNext() ? it.next() : f.createFile(AI_ADVICE_FILE_, '{"rounds":[],"scores":{}}', 'application/json'); }
function aiAdviceLoad_() { try { var o = JSON.parse(aiAdviceFile_().getBlob().getDataAsString('UTF-8') || '{}'); o.rounds = o.rounds || []; o.scores = o.scores || {}; return o; } catch (e) { return { rounds: [], scores: {} }; } }
function aiAdviceSave_(o) { o.rounds = o.rounds.slice(-12); aiAdviceFile_().setContent(JSON.stringify(o)); }
// 질문 만들기 — 막힌·비싼 기능 목록(저장소 문서) + 개선 후보 보고서(오류·유료 비용) → 기술 질문. 고객 정보는 넣지 않는다.
function aiAdviceQuestions_() {
  var qs = [], seen = {};
  var add = function (topic, q) { var k = q.slice(0, 40); if (seen[k] || qs.length >= 5) return; seen[k] = 1; qs.push({ topic: topic, q: q }); };
  var ctx = '배경: 구글 앱스스크립트(GAS)로 만든 세무사무소 업무 시스템. 비용 원칙 — 반복 작업은 GAS·무료 OCR·규칙으로 0원, 유료 AI는 판단에만. 개인정보는 외부 무료 서비스로 보내지 않음.';
  // ① 막혀 있거나 비싼 기능 목록(환경변화 세션이 저장소에 둔 문서 — 이름이 바뀌어도 찾게 여러 후보)
  ['docs/blocked-capabilities.md', 'docs/capabilities-blocked.md', 'docs/막힌기능.md'].some(function (path) {
    try {
      var r = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + GH_REPO_ + '/main/' + path, { muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) return false;
      r.getContentText('UTF-8').split('\n').filter(function (l) { return /^\s*[-*]\s+\S/.test(l) && !aiLooksClientData_(l); }).slice(0, 6).forEach(function (l) {
        var item = l.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').slice(0, 160);
        add('막힌 기능', ctx + '\n지금 막혀 있거나 비싼 기능: "' + item + '". 2025~2026년 기준 무료 또는 매우 저렴하게 이것을 해결할 수 있는 최신 기술·API·서비스가 있나? 공식 문서 이름과 무료 한도, GAS에서 쓰는 방법을 단계별로. 확실하지 않으면 그렇다고 적어라.');
      });
      return true;
    } catch (e) { return false; }
  });
  // ② 개선 후보 보고서 — 반복 오류·유료 비용·느린 화면(고객 값 없는 이름표만)
  var rep = null;
  try { rep = getImprovementReport_().report; } catch (e) { rep = null; }
  if (rep) {
    (rep.errors || []).slice(0, 2).forEach(function (er) {
      var m = String(er.message || '').replace(/[가-힣]{2,4}(님|씨)/g, '').slice(0, 120);
      if (!aiLooksClientData_(m)) add('반복 오류', ctx + '\n이런 오류가 반복된다: "' + (er.where || '') + ' — ' + m + '". 원인 후보와 GAS/브라우저에서의 일반적인 해결책을 알려 달라.');
    });
    if (rep.paid && rep.paid.totalKrw > 1000) add('비용', ctx + '\n지난주 유료 AI 비용 ' + rep.paid.totalKrw + '원(용도: ' + Object.keys(rep.paid.byKind || {}).join(', ') + '). 같은 품질을 더 싸게(무료 API·규칙·캐시·배치 등) 얻는 최신 방법은?');
  }
  // ③ 늘 묻는 기본 질문(새 기술 정찰)
  add('새 기술', ctx + '\n한국어 스캔 PDF(저해상도 정부 민원서류, 표 많음)의 글자·표를 더 정확히 읽는 무료/저가 방법 중 최근 6개월 안에 새로 나오거나 좋아진 것은? 구글 Document AI·Vision·Gemini 등 비교, 무료 한도 포함.');
  add('새 기술', ctx + '\n크롬 확장프로그램·브라우저 안에서 무료로 쓸 수 있는 AI(예: 크롬 내장 Gemini Nano Prompt API) 최신 지원 현황과, 개인정보를 PC 밖으로 내보내지 않고 요약·분류에 쓰는 방법은?');
  return qs;
}
// 문장에서 제안 항목 뽑기(번호·글머리표 줄)
function aiAdviceSuggestions_(text) {
  return String(text || '').split('\n').map(function (l) { return l.trim(); })
    .filter(function (l) { return /^(\d+[.)]|[-*•])\s+/.test(l) && l.length > 12; })
    .map(function (l) { return l.replace(/^(\d+[.)]|[-*•])\s+/, '').replace(/\*\*/g, '').slice(0, 220); }).slice(0, 12);
}
function aiAdviceRun_(body) {
  var now = new Date();
  var force = body && body.force;
  if (!force && now.getDay() !== 1) return { skipped: '월요일에만(수동은 설정 🐞 카드 🧑‍🏫 버튼)' };
  var o = aiAdviceLoad_(), week = Utilities.formatDate(now, 'Asia/Seoul', "yyyy-'W'ww");
  if (!force && o.rounds.length && o.rounds[o.rounds.length - 1].week === week) return { skipped: '이번 주 이미 실행' };
  var cands = aiDispatch_({ freeOnly: true }).slice(0, 4);
  var qs = aiAdviceQuestions_();
  var round = { week: week, at: Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), questions: [] };
  qs.forEach(function (q, qi) {
    var answers = cands.length ? aiAskMany_(cands, q.q + '\n\n답은 번호 목록(1. 2. 3.)으로 구체적인 제안 위주로.', 1200).filter(function (a) { return a.ok; }) : [];
    var item = { id: week + '-' + (qi + 1), topic: q.topic, q: q.q, answers: answers.map(function (a) { return { ai: a.ai, name: a.name, mode: 'api', text: a.text.slice(0, 4000) }; }), suggestions: [] };
    aiAdviceCluster_(item);
    round.questions.push(item);
  });
  o.rounds.push(round);
  aiAdviceSave_(o);
  return { success: true, week: week, questions: round.questions.length, ais: cands.map(function (c) { return c.name; }), noFreeAi: !cands.length };
}
// 제안 묶기 — 비슷한 제안을 여러 AI가 하면 "공통", 하나만 하면 "단독"
function aiAdviceCluster_(item) {
  var prev = {};
  (item.suggestions || []).forEach(function (s) { prev[s.text] = s.verdict; });
  var sugg = [];
  item.answers.forEach(function (a) {
    aiAdviceSuggestions_(a.text).forEach(function (t) {
      var g = sugg.filter(function (s) { return aiSimilar_(s.text, t) >= 0.33; })[0];
      if (g) { if (g.ais.indexOf(a.name) === -1) g.ais.push(a.name); }
      else sugg.push({ text: t, ais: [a.name] });
    });
  });
  sugg.forEach(function (s) { s.common = s.ais.length >= 2; if (prev[s.text]) s.verdict = prev[s.text]; });
  sugg.sort(function (x, y) { return y.ais.length - x.ais.length; });
  item.suggestions = sugg.slice(0, 15);
}
// B 등급(웹 AI) 수동 답 붙여넣기
function aiAdviceAddManual_(body) {
  var qid = String(body && body.qid || ''), ai = String(body && body.ai || ''), text = String(body && body.text || '').trim();
  if (!qid || !ai || !text) return { error: '질문·AI·답이 필요합니다.' };
  var e = AI_REGISTRY_.filter(function (x) { return x.id === ai; })[0];
  return withLock_(10000, function () {
    var o = aiAdviceLoad_(), found = null;
    o.rounds.forEach(function (r) { r.questions.forEach(function (q) { if (q.id === qid) found = q; }); });
    if (!found) return { error: '질문을 찾지 못했습니다.' };
    found.answers = found.answers.filter(function (a) { return a.ai !== ai; }).concat([{ ai: ai, name: e ? e.name : ai, mode: 'manual', text: text.slice(0, 6000) }]);
    aiAdviceCluster_(found);
    aiAdviceSave_(o);
    return { success: true };
  });
}
// 채택·기각 표시 → AI 성적표
function aiAdviceMark_(body) {
  var qid = String(body && body.qid || ''), idx = Number(body && body.idx), verdict = body && body.verdict === '채택' ? '채택' : body && body.verdict === '기각' ? '기각' : '';
  if (!qid || isNaN(idx) || !verdict) return { error: '질문·제안·판정이 필요합니다.' };
  return withLock_(10000, function () {
    var o = aiAdviceLoad_(), q = null;
    o.rounds.forEach(function (r) { r.questions.forEach(function (x) { if (x.id === qid) q = x; }); });
    var s = q && q.suggestions[idx];
    if (!s) return { error: '제안을 찾지 못했습니다.' };
    var old = s.verdict;
    s.verdict = verdict;
    s.ais.forEach(function (name) {
      var sc = o.scores[name] || (o.scores[name] = { proposed: 0, adopted: 0, rejected: 0 });
      if (old === '채택') sc.adopted--; if (old === '기각') sc.rejected--;
      if (!old) sc.proposed++;
      if (verdict === '채택') sc.adopted++; else sc.rejected++;
    });
    aiAdviceSave_(o);
    return { success: true };
  });
}
function aiAdviceGet_() {
  var o = aiAdviceLoad_(), last = o.rounds[o.rounds.length - 1] || null;
  return { success: true, latest: last, scores: o.scores, registry: aiRegistryList_().filter(function (x) { return x.tier === 'B'; }).map(function (x) { return { id: x.id, name: x.name, url: x.url, tos: x.tos }; }) };
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
function commRequestsSave_(st) { writeFileOverwrite_(st.folder, IMPROVEMENT_TRACKING_FILE, JSON.stringify(st.tracking), 'application/json'); }
function commSetRequestStatus_(idMap, status) {
  var st = commRequestsLoad_();
  if (!st.folder) return;
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), hit = false;
  st.tracking.entries.forEach(function (x) { if (idMap[x.id] && x.status !== '확인완료') { x.status = status; x.statusAt = now; x.commit = idMap[x.id]; hit = true; } });
  if (hit) commRequestsSave_(st);
}
function commRequestConfirm_(body) {
  var id = String(body && body.id || ''), ok = !!(body && body.ok), note = String(body && body.note || '').trim();
  return withLock_(10000, function () {
    var st = commRequestsLoad_(), x = st.tracking.entries.filter(function (e) { return e.id === id; })[0];
    if (!x) return { error: '요청을 찾지 못했습니다.' };
    x.status = ok ? '확인완료' : '재오픈';
    x.statusAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    if (!ok) { x.reopenNote = note.slice(0, 1000); x.at = x.statusAt; } // 재오픈은 날짜를 새로 — 다음 보고서에 다시 실린다
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
  return withLock_(5000, function () {
    var f = commGapsFile_(), arr = [];
    try { arr = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '[]'); } catch (x) { arr = []; }
    arr.push(e); f.setContent(JSON.stringify(arr.slice(-200)));
    return { success: true, message: '개발자(주간 정비 루틴)에게 전달했습니다. 사용자에게 "기능 부족을 개발자에게 알렸다"고만 짧게 말하라.' };
  });
}
function commRecentGaps_(days) {
  var arr = [];
  try { arr = JSON.parse(commGapsFile_().getBlob().getDataAsString('UTF-8') || '[]'); } catch (x) { arr = []; }
  var since = Date.now() - days * 86400000;
  return arr.filter(function (g) { return improve_parseAt_(g.at) >= since; });
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
// ⑤ 대시보드·설정 카드용 한 번에 받기
function commStatus_() {
  var st = commRequestsLoad_(), reqs = st.tracking.entries.slice(-15).reverse().map(function (x) { return { id: x.id, at: x.at, text: String(x.text || '').slice(0, 200), status: x.status, statusAt: x.statusAt || '', urgent: !!x.urgent, commit: x.commit || '' }; });
  var adv = aiAdviceLoad_(), last = adv.rounds[adv.rounds.length - 1] || null;
  var advSummary = last ? { week: last.week, at: last.at, questions: last.questions.length, common: last.questions.reduce(function (s, q) { return s + q.suggestions.filter(function (x) { return x.common; }).length; }, 0), adopted: last.questions.reduce(function (s, q) { return s + q.suggestions.filter(function (x) { return x.verdict === '채택'; }).length; }, 0), pending: last.questions.reduce(function (s, q) { return s + q.suggestions.filter(function (x) { return x.common && !x.verdict; }).length; }, 0) } : null;
    return { success: true, changes: commRecentChanges_().slice(0, 12), requests: reqs, urgent: reqs.filter(function (r) { return r.urgent && /접수|재오픈/.test(r.status); }).length,
    toConfirm: reqs.filter(function (r) { return r.status === '반영됨'; }).length, questions: commDevQuestions_(), advice: advSummary, registry: aiRegistryList_(), dispatch: AI_DISPATCH_TABLE_ };
}
// 🔑 무료 API 키 넣기(세무사님이 직접 입력 — 값은 되돌려 주지 않음)
var AI_KEY_NAMES_ = ['GEMINI_FREE_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_API_KEY', 'HF_TOKEN'];
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
  var usage = null; try { usage = buildClaudeUsageInfo_(json, MODEL_CONFIG[DEFAULT_MODEL], DEFAULT_MODEL, null); } catch (e) {}
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
// 무료 API 상태 점검(매일) + AI 자문단(월요일만, 주 1회) → 개선 후보 보고서 다시 만들기. 모두 0원(무료 API만).
function aiFederationNightly() {
  try { aiNightlyHealth_(); } catch (e) { console.error('무료 AI 상태 점검 실패: ' + e.message); }
  try { aiAdviceRun_({}); } catch (e) { console.error('AI 자문단 실패: ' + e.message); }
  try { buildImprovementReport_(); } catch (e) { console.error('개선 후보 보고서 실패: ' + e.message); }
}
function aiFedEnsureTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'aiFederationNightly'; });
  if (!has) ScriptApp.newTrigger('aiFederationNightly').timeBased().everyDays(1).atHour(5).create();
}
