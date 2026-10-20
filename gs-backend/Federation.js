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
function aiLooksClientData_(t) {
  t = String(t || '');
  return /\d{6}\s*-\s*[1-4]\d{6}|\d{6}\s*-\s*[1-4]\*{6}|01[016789]-?\d{3,4}-?\d{4}|\d{3,6}-\d{2,6}-\d{4,8}|[가-힣]+(동|로|길)\s*\d+(-\d+)?\s*(번지)?\s*\d*호?|사건번호|고객명|납세자명/.test(t);
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
  var pick = function (x) { return { id: x.id, at: x.firstAt || x.at, text: String(x.text || '').slice(0, 400), status: x.status, statusAt: x.statusAt || '', urgent: !!x.urgent, commit: x.commit || '', days: commReqDays_(x), reopenNote: x.reopenNote || '', restored: !!x.restored }; };
  var open = st.tracking.entries.filter(function (x) { return x.status !== '확인완료'; }).map(pick)
    .sort(function (a, b) { return improve_parseAt_(a.at) - improve_parseAt_(b.at); });
  var done = st.tracking.entries.filter(function (x) { return x.status === '확인완료'; }).slice(-15).reverse().map(pick);
  return { open: open, done: done };
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
    if (!ok) { x.reopenNote = note.slice(0, 1000); x.firstAt = x.firstAt || x.at; x.at = x.statusAt; } // 재오픈은 날짜를 새로 — 다음 보고서에 다시 실린다
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
  // [2026.10.20] 끝나지 않은 요청은 개수 제한 없이 전부(오래된 순), 확인완료는 최근 15건 — 대시보드 🛠 개선요구 카드·설정 📝 요청 상태가 같은 자료를 본다
  var ra = commRequestsAll_(), reqs = ra.open.concat(ra.done);
    return { success: true, changes: commRecentChanges_().slice(0, 12), requests: reqs, openRequests: ra.open, doneRequests: ra.done,
    oldestDays: ra.open.length ? ra.open[0].days : 0, urgent: ra.open.filter(function (r) { return r.urgent && /접수|재오픈/.test(r.status); }).length,
    toConfirm: ra.open.filter(function (r) { return r.status === '반영됨'; }).length, questions: commDevQuestions_(), registry: aiRegistryList_(), dispatch: AI_DISPATCH_TABLE_ };
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
// 위원 API 상태 점검(매일, 0원) → 개선 후보 보고서 다시 만들기. [2026.10.19] AI 자문단 자동 수집은 삭제(트리거 이름은 운영에 걸려 있어 그대로).
function aiFederationNightly() {
  try { aiNightlyHealth_(); } catch (e) { console.error('무료 AI 상태 점검 실패: ' + e.message); }
  try { buildImprovementReport_(); } catch (e) { console.error('개선 후보 보고서 실패: ' + e.message); }
}
function aiFedEnsureTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'aiFederationNightly'; });
  if (!has) ScriptApp.newTrigger('aiFederationNightly').timeBased().everyDays(1).atHour(5).create();
}
