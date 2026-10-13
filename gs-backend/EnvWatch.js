// =========================================================
// [2026.10.13] 환경 감시 — 세법·예규판례·연례 고시·기술 환경 변화에 job이 스스로 적응하기 위한 "야간 감시"(토큰 0)
// 세무사님 판단: 시스템 존속은 "법령~예규판례 변경과 도구 최신기술에 얼마나 신속정확하게 적응하느냐"에 달렸다.
// 원칙: 감시·수집은 매일/매주 밤 job이 무료 API·공개 페이지로(토큰 0), 판단·수정은 주간 웹 Claude Code 루틴(구독)이 PR로,
//       반영은 세무사님 Merge 후 📥. 결과는 개선 후보 보고서(_개선후보.json)의 laws·precedents·calendar·tech·capabilities 항목.
// 상태(직전 법령 판·조문 지문·마지막으로 본 날짜)는 개선 후보 보고서와 같은 폴더의 _환경감시상태.json에 둔다.
// =========================================================
var ENV_WATCH_LAWS_ = ['소득세법', '소득세법 시행령', '소득세법 시행규칙', '상속세 및 증여세법', '상속세 및 증여세법 시행령', '상속세 및 증여세법 시행규칙',
  '조세특례제한법', '조세특례제한법 시행령', '조세특례제한법 시행규칙', '국세기본법', '국세기본법 시행령'];
var ENV_WATCH_STATE_NAME_ = '_환경감시상태.json';
var ENV_WATCH_RESULT_NAME_ = '_환경감시결과.json';

function envFolder_() {
  var f = improve_reportFile_();
  var p = f.getParents();
  return p.hasNext() ? p.next() : DriveApp.getRootFolder();
}
function envReadJson_(name, dflt) {
  try {
    var it = envFolder_().getFilesByName(name);
    if (it.hasNext()) return JSON.parse(it.next().getBlob().getDataAsString('UTF-8') || 'null') || dflt;
  } catch (e) {}
  return dflt;
}
function envWriteJson_(name, obj) {
  var folder = envFolder_(), it = folder.getFilesByName(name), s = JSON.stringify(obj);
  if (it.hasNext()) it.next().setContent(s); else folder.createFile(name, s, 'application/json');
}
function envToday_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd'); }
function envHash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s), Utilities.Charset.UTF_8)).slice(0, 12);
}
function envFetch_(url, opts) {
  try {
    var o = opts || {}; o.muteHttpExceptions = true; o.followRedirects = true;
    var r = UrlFetchApp.fetch(url, o);
    return { code: r.getResponseCode(), text: r.getContentText('UTF-8') };
  } catch (e) { return { code: 0, text: '', error: String(e && e.message || e) }; }
}

// ---------- 1) 법령 개정 감시 ----------
// 같은 법령명의 판들 중 현행 1개 + 시행 예정 판들을 뽑는다(lawSearch target=eflaw).
function envLawVersions_(oc, name) {
  var r = envFetch_('https://www.law.go.kr/DRF/lawSearch.do?OC=' + encodeURIComponent(oc) + '&target=eflaw&type=XML&display=50&query=' + encodeURIComponent(name));
  if (r.code !== 200) return { error: '법령 검색 실패(' + r.code + ')' };
  var laws;
  try { laws = XmlService.parse(r.text).getRootElement().getChildren('law'); } catch (e) { return { error: '법령 검색 응답 해석 실패' }; }
  var today = envToday_();
  var same = laws.filter(function (x) { return x.getChildText('법령명한글') === name; }).map(function (x) {
    return { mst: x.getChildText('법령일련번호'), ef: String(x.getChildText('시행일자') || ''), prom: String(x.getChildText('공포일자') || ''),
      no: x.getChildText('공포번호') || '', kind: x.getChildText('제개정구분명') || '', cur: /현행/.test(x.getChildText('현행연혁코드') || '') };
  });
  if (!same.length) return { error: '"' + name + '" 검색 결과 없음' };
  var cur = same.filter(function (x) { return x.cur; })[0];
  if (!cur) cur = same.filter(function (x) { return x.ef <= today; }).sort(function (a, b) { return b.ef.localeCompare(a.ef); })[0] || same[0];
  // 시행 예정판 중 현행보다 "나중에 공포된" 것만이 새 개정이다. 예전에 공포돼 미래에 시행되는 조문(예: 2024 공포·2027 시행)을 담은
  // 옛 판은 그 뒤 개정으로 이미 대체돼 현행과 비교하면 거꾸로 된 차이가 나온다. 같은 시행일이 여럿이면 가장 늦게 공포된 판 하나만.
  var byEf = {};
  same.filter(function (x) { return x.ef > today && x.mst !== cur.mst && x.prom >= cur.prom; }).forEach(function (x) {
    if (!byEf[x.ef] || x.prom > byEf[x.ef].prom) byEf[x.ef] = x;
  });
  var futures = Object.keys(byEf).sort().map(function (k) { return byEf[k]; });
  return { cur: cur, futures: futures };
}
// 한 판의 조문별 지문(번호 → 해시). 조문 단위 본문 해시 비교로 "어느 조문이 바뀌었나"를 뽑는다.
function envLawArticleHashes_(oc, mst, ef) {
  var r = envFetch_('https://www.law.go.kr/DRF/lawService.do?OC=' + encodeURIComponent(oc) + '&target=eflaw&type=XML&MST=' + encodeURIComponent(mst) + '&efYd=' + encodeURIComponent(ef));
  if (r.code !== 200) return null;
  var root;
  try { root = XmlService.parse(r.text).getRootElement(); } catch (e) { return null; }
  var jm = root.getChild('조문');
  if (!jm) return null;
  var out = {};
  // 지문은 조문의 "내용"(제목·본문·항·호·목)만으로 만든다 — 조문시행일자·제개정유형·변경여부 같은 판마다 달라지는 꼬리표를 넣으면
  // 모든 조문이 바뀐 것으로 잡힌다(2026.10.13 첫 실행에서 확인). <개정 …>·[시행일 …] 표기도 뺀다.
  var textOf = function (el) {
    var parts = [];
    var walk = function (e) {
      var n = e.getName();
      if (/^(조문제목|조문내용|항내용|호내용|목내용)$/.test(n)) parts.push(e.getText());
      e.getChildren().forEach(walk);
    };
    walk(el);
    return parts.join('|').replace(/<\s*(개정|신설|전문개정|본조신설|삭제)[^>]*>/g, '').replace(/\[[^\]]*(시행일|종전|제목개정)[^\]]*\]/g, '').replace(/\s+/g, '');
  };
  jm.getChildren('조문단위').forEach(function (u) {
    if ((u.getChildText('조문여부') || '') !== '조문') return; // 장·절 제목(전문) 제외
    var key = String(u.getChildText('조문번호') || '') + (u.getChildText('조문가지번호') ? '의' + u.getChildText('조문가지번호') : '');
    if (!key) return;
    // 조문변경여부(Y) — 법제처가 "이 판에서 바뀐 조문"이라고 표시한 것(가장 정확한 변경 목록)
    out[key] = { h: envHash_(textOf(u)), t: String(u.getChildText('조문제목') || '').slice(0, 40), y: (u.getChildText('조문변경여부') || '') === 'Y' ? 1 : 0 };
  });
  return out;
}
// 법제처가 그 판에서 바뀌었다고 표시한 조문(조문변경여부=Y) 목록
function envFlagged_(h) {
  return Object.keys(h || {}).filter(function (k) { return h[k].y; }).map(function (k) { return { 조: k, 제목: h[k].t, 구분: '변경(법제처 표시)' }; })
    .sort(function (x, y) { return (parseInt(x.조, 10) || 0) - (parseInt(y.조, 10) || 0); });
}
function envDiffArticles_(a, b) {
  var changed = [];
  Object.keys(b || {}).forEach(function (k) {
    if (!a || !a[k]) changed.push({ 조: k, 제목: b[k].t, 구분: '신설' });
    else if (a[k].h !== b[k].h) changed.push({ 조: k, 제목: b[k].t, 구분: '변경' });
  });
  Object.keys(a || {}).forEach(function (k) { if (!b || !b[k]) changed.push({ 조: k, 제목: a[k].t, 구분: '삭제' }); });
  changed.sort(function (x, y) { return (parseInt(x.조, 10) || 0) - (parseInt(y.조, 10) || 0); });
  return changed;
}
// 엔진 의존 조문 지도(EngineLawMap.js, tools/build-engine-law-map.js가 Code.js 주석의 §표기로 생성)로 영향 함수 찾기
function envImpactedFns_(lawName, articles) {
  var map = (typeof ENGINE_LAW_MAP_ !== 'undefined' && ENGINE_LAW_MAP_[lawName]) || {};
  var fns = {};
  articles.forEach(function (a) { var base = String(a.조).split('의')[0], key = String(a.조); (map[key] || map[base] || []).forEach(function (f) { fns[f] = 1; }); });
  return Object.keys(fns).slice(0, 30);
}
function envWatchLaws_(state, deadline) {
  var oc = PropertiesService.getScriptProperties().getProperty('LAW_OC');
  if (!oc) return { error: 'LAW_OC 인증키 없음' };
  // 지문 방식이 바뀌면(v2: 내용만) 옛 기준을 버리고 다시 만든다
  if (state.lawsV !== 2) { state.laws = {}; state.lawsV = 2; }
  state.laws = state.laws || {};
  var items = [], pendingBaseline = 0;
  ENV_WATCH_LAWS_.forEach(function (name) {
    if (Date.now() > deadline) { items.push({ 법령: name, 상태: '시간 부족으로 다음 밤에 확인' }); return; }
    var v = envLawVersions_(oc, name);
    if (v.error) { items.push({ 법령: name, 오류: v.error }); return; }
    var st = state.laws[name] || {};
    var item = { 법령: name, 현행: { 시행일: v.cur.ef, 공포일: v.cur.prom, 공포번호: v.cur.no, 구분: v.cur.kind } };
    // 현행 판이 바뀌었으면(새 개정이 시행됨) 직전 판 지문과 비교
    if (st.mst && st.mst !== v.cur.mst) {
      item.새로시행 = true;
      var nh = Date.now() < deadline ? envLawArticleHashes_(oc, v.cur.mst, v.cur.ef) : null;
      if (nh) { var fl = envFlagged_(nh); item.바뀐조문 = fl.length ? fl : (st.hashes ? envDiffArticles_(st.hashes, nh) : []); item.영향함수 = envImpactedFns_(name, item.바뀐조문); }
      if (nh) { st.hashes = nh; st.hashAt = envToday_(); }
    }
    // 처음 보는 법령은 현행 지문을 만들어 둔다(다음 개정 때 비교 기준)
    if (!st.hashes) {
      if (Date.now() < deadline) { var h0 = envLawArticleHashes_(oc, v.cur.mst, v.cur.ef); if (h0) { st.hashes = h0; st.hashAt = envToday_(); } else pendingBaseline++; }
      else pendingBaseline++;
    }
    // 공포 후 시행 전(시행 예정) 개정 — 현행과 비교해 바뀔 조문을 미리 뽑는다(새로 나타난 예정판만 다시 계산)
    var knownF = st.futures || {};
    item.시행예정 = v.futures.map(function (f) {
      var rec = knownF[f.mst];
      if (!rec && Date.now() < deadline && st.hashes) {
        var fh = envLawArticleHashes_(oc, f.mst, f.ef);
        if (fh) { var fl2 = envFlagged_(fh), d = fl2.length ? fl2 : envDiffArticles_(st.hashes, fh); rec = { 바뀔조문: d.slice(0, 80), 바뀔조문수: d.length, 영향함수: envImpactedFns_(name, d), 처음본날: envToday_() }; }
      }
      if (rec) knownF[f.mst] = rec;
      return { 시행일: f.ef, 공포일: f.prom, 공포번호: f.no, 구분: f.kind, 신규: !!(rec && rec.처음본날 === envToday_()), 바뀔조문: rec ? rec.바뀔조문 : null, 바뀔조문수: rec ? rec.바뀔조문수 : null, 영향함수: rec ? rec.영향함수 : null };
    });
    Object.keys(knownF).forEach(function (k) { if (!v.futures.some(function (f) { return f.mst === k; })) delete knownF[k]; });
    st.futures = knownF; st.mst = v.cur.mst; st.ef = v.cur.ef;
    state.laws[name] = st;
    items.push(item);
  });
  return { items: items, baselinePending: pendingBaseline };
}

// ---------- 2) 예규·판례 신착(매주) ----------
var ENV_PREC_KEYWORDS_ = ['1세대1주택', '일시적 2주택', '자경농지', '부담부증여', '동거주택 상속공제', '금융재산 상속공제', '증여재산공제', '장기보유특별공제', '상생임대', '양도소득세 비과세', '상속세 과세가액', '증여세 과세가액'];
var ENV_PREC_TARGETS_ = [
  { target: 'prec', tag: 'prec', id: '판례일련번호', title: '사건명', no: '사건번호', date: '선고일자', kind: '판례' },
  { target: 'expc', tag: 'expc', id: '법령해석례일련번호', title: '안건명', no: '안건번호', date: '회신일자', kind: '법령해석례' },
  { target: 'ttSpecialDecc', tag: 'decc', id: '특별행정심판재결례일련번호', title: '사건명', no: '청구번호', date: '의결일자', kind: '조세심판 등 재결' }
];
// 국세청 고시·훈령(행정규칙) — 건물기준시가 고시·사무처리규정 개정 감지
var ENV_ADMRUL_KEYWORDS_ = ['건물 기준시가', '오피스텔 및 상업용 건물 기준시가', '양도소득세 사무처리규정', '상속세 및 증여세 사무처리규정', '재산평가심의위원회'];
function envWatchPrecedents_(state, deadline) {
  var oc = PropertiesService.getScriptProperties().getProperty('LAW_OC');
  if (!oc) return { error: 'LAW_OC 인증키 없음' };
  state.prec = state.prec || {};
  var since = state.prec.lastDate || Utilities.formatDate(new Date(Date.now() - 30 * 86400000), 'Asia/Seoul', 'yyyyMMdd');
  var seen = state.prec.seen || {}, found = [], maxDate = since;
  ENV_PREC_TARGETS_.forEach(function (t) {
    ENV_PREC_KEYWORDS_.forEach(function (kw) {
      if (Date.now() > deadline) return;
      var r = envFetch_('https://www.law.go.kr/DRF/lawSearch.do?OC=' + encodeURIComponent(oc) + '&target=' + t.target + '&type=XML&display=20&sort=ddes&query=' + encodeURIComponent(kw));
      if (r.code !== 200) return;
      var list;
      try { list = XmlService.parse(r.text).getRootElement().getChildren(t.tag); } catch (e) { return; }
      list.forEach(function (x) {
        var d = String(x.getChildText(t.date) || '').replace(/\D/g, '').slice(0, 8), id = x.getChildText(t.id);
        if (!id || d <= since || seen[t.target + id]) return;
        seen[t.target + id] = d;
        if (d > maxDate) maxDate = d;
        found.push({ 종류: t.kind, 쟁점: kw, 제목: String(x.getChildText(t.title) || '').slice(0, 120), 번호: x.getChildText(t.no) || '', 날짜: d, id: id, target: t.target });
      });
    });
  });
  var admrul = [];
  ENV_ADMRUL_KEYWORDS_.forEach(function (kw) {
    if (Date.now() > deadline) return;
    var r = envFetch_('https://www.law.go.kr/DRF/lawSearch.do?OC=' + encodeURIComponent(oc) + '&target=admrul&type=XML&display=10&sort=ddes&query=' + encodeURIComponent(kw));
    if (r.code !== 200) return;
    try {
      XmlService.parse(r.text).getRootElement().getChildren('admrul').forEach(function (x) {
        var d = String(x.getChildText('발령일자') || '').replace(/\D/g, '').slice(0, 8), id = x.getChildText('행정규칙일련번호');
        if (!id || d <= since || seen['admrul' + id]) return;
        seen['admrul' + id] = d;
        admrul.push({ 종류: '행정규칙(고시·훈령)', 쟁점: kw, 제목: x.getChildText('행정규칙명') || '', 번호: x.getChildText('발령번호') || '', 날짜: d, 소관: x.getChildText('소관부처명') || '' });
      });
    } catch (e) {}
  });
  // 오래된 기억은 정리(180일)
  var cut = Utilities.formatDate(new Date(Date.now() - 180 * 86400000), 'Asia/Seoul', 'yyyyMMdd');
  Object.keys(seen).forEach(function (k) { if (seen[k] < cut) delete seen[k]; });
  state.prec = { lastDate: maxDate, seen: seen, at: envToday_() };
  found.sort(function (a, b) { return b.날짜.localeCompare(a.날짜); });
  return { since: since, items: found.slice(0, 60), admrul: admrul.slice(0, 20),
    note: '국세청 예규(국세법령정보시스템 txsi·taxlaw.nts.go.kr)는 공식 무료 API가 없어 자동 수집 대상이 아님 — 법제처 해석례·판례·조세심판 재결·국세청 행정규칙(고시·훈령)만 수집' };
}

// ---------- 3) 연례 고시·개정 달력 ----------
function envCalendar_() {
  var now = new Date(), y = Number(Utilities.formatDate(now, 'Asia/Seoul', 'yyyy')), m = Number(Utilities.formatDate(now, 'Asia/Seoul', 'M'));
  var ymd = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  var out = [];
  var due = [
    { 월: [1, 2], 항목: '건물기준시가 산정기준(국세청 고시, 매년 1월 1일 시행) — 신축가격기준액·경과연수별 잔가율 표 갱신', 확인: function () {
      var lastYear = 0;
      try { lastYear = Math.max.apply(null, Object.keys(DEPRECIATION_TABLE.I).map(Number)); } catch (e) {}
      var hasBase = false; try { hasBase = typeof eval('BUILDING_BASE_PRICE_' + y) !== 'undefined'; } catch (e) { hasBase = false; }
      return lastYear >= y ? '' : '코드의 잔가율 표가 ' + lastYear + '년까지(올해 ' + y + '년 표 없음)' + (hasBase ? '' : ', 신축가격기준액 ' + y + '년 값 없음');
    } },
    { 월: [2, 3], 항목: '세법 시행령·시행규칙 개정(매년 2~3월 공포) — 법령 감시 결과 확인 후 엔진·자가점검 사례 반영' },
    { 월: [4, 5], 항목: '공동주택가격·개별주택가격 공시(4월 말) — 공시가격 조회 도구·서류 정리 결과 연도 확인' },
    { 월: [5, 6], 항목: '개별공시지가 공시(5월 말) — 공시가격 조회·보충적 평가 연도 확인' },
    { 월: [7, 8], 항목: '정부 세법개정안 발표(7~8월) — 예정 개정 조문을 감시 목록에 추가할지 검토' },
    { 월: [12, 1], 항목: '세법개정안 국회 통과·공포(12월) — 1월 1일 시행분 엔진 반영(법령 감시의 시행 예정 항목 참고)' },
    { 월: [1, 4, 7, 10], 항목: '한국은행 기준금리(전월세 전환율 계산용 LS_BOK_RATES_) 최신화 확인', 확인: function () {
      try { var last = LS_BOK_RATES_[LS_BOK_RATES_.length - 1][0]; return '표의 마지막 변경일 ' + last + ' — 그 뒤 금리 변경이 있었는지 확인'; } catch (e) { return ''; }
    } }
  ];
  due.forEach(function (d) {
    if (d.월.indexOf(m) === -1) return;
    var extra = d.확인 ? d.확인.call(this) : '';
    out.push({ 시기: m + '월', 항목: d.항목, 코드확인: extra || '' });
  });
  // 연중 상시: 코드에 박힌 연도별 표가 올해보다 뒤처졌는지
  try {
    var ly = Math.max.apply(null, Object.keys(DEPRECIATION_TABLE.I).map(Number));
    if (ly < y && out.every(function (o) { return !/건물기준시가/.test(o.항목); })) out.push({ 시기: '상시', 항목: '건물기준시가 잔가율 표가 ' + ly + '년까지 — ' + y + '년 고시 반영 필요', 코드확인: '' });
  } catch (e) {}
  try {
    if (ymd > '2026-06-30' && typeof lsConvRate_ === 'function') {
      var t = lsConvRate_(ymd);
      if (t && t.표밖) out.push({ 시기: '상시', 항목: '전월세 전환율 기준금리 표(LS_BOK_RATES_) 확인 범위가 지남 — 최근 기준금리 변경 반영 필요', 코드확인: '표 확인 범위 2026-06-30까지' });
    }
  } catch (e) {}
  return out;
}

// ---------- 4) 기술 환경 점검(매일) ----------
function envTechCheck_() {
  var props = PropertiesService.getScriptProperties(), out = [], models = {};
  // Anthropic 모델 목록(무과금) — 코드가 쓰는 모델 ID가 아직 있는지, 새 모델이 나왔는지
  var key = props.getProperty('ANTHROPIC_API_KEY');
  var used = Object.keys(MODEL_CONFIG || {}).filter(function (k) { return MODEL_CONFIG[k].provider !== 'gemini'; });
  [DEFAULT_MODEL, LIGHT_MODEL].forEach(function (k) { if (used.indexOf(k) === -1) used.push(k); });
  if (key) {
    var r = envFetch_('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } });
    if (r.code === 200) {
      var ids = [];
      try { ids = (JSON.parse(r.text).data || []).map(function (x) { return x.id; }); } catch (e) {}
      var missing = used.filter(function (k) { return /^claude/.test(k) && ids.indexOf(k) === -1; });
      models.anthropic = { 사용중: used.filter(function (k) { return /^claude/.test(k); }), 없어짐: missing, 새모델: ids.filter(function (i) { return used.indexOf(i) === -1; }).slice(0, 15) };
      if (missing.length) out.push({ 수준: '경고', 항목: 'Claude 모델 ID가 목록에 없음: ' + missing.join(', ') + ' — 이 모델을 부르는 기능이 실패할 수 있음(DEFAULT_MODEL·LIGHT_MODEL·MODEL_CONFIG 확인)' });
    } else out.push({ 수준: '경고', 항목: 'Anthropic 모델 목록 조회 실패(' + r.code + ') — API 키 확인' });
  }
  var gkey = props.getProperty('GEMINI_API_KEY');
  var gUsed = Object.keys(MODEL_CONFIG || {}).filter(function (k) { return MODEL_CONFIG[k].provider === 'gemini'; });
  if (gkey) {
    var g = envFetch_('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(gkey));
    if (g.code === 200) {
      var gids = [];
      try { gids = (JSON.parse(g.text).models || []).map(function (x) { return String(x.name || '').replace(/^models\//, ''); }); } catch (e) {}
      var gm = gUsed.filter(function (k) { return gids.indexOf(k) === -1; });
      models.gemini = { 사용중: gUsed, 없어짐: gm, 새모델: gids.filter(function (i) { return /^gemini/.test(i) && gUsed.indexOf(i) === -1; }).slice(0, 15) };
      if (gm.length) out.push({ 수준: '주의', 항목: 'Gemini 모델 ID가 목록에 없음: ' + gm.join(', ') });
    } else out.push({ 수준: '주의', 항목: 'Gemini 모델 목록 조회 실패(' + g.code + ')' });
  }
  // 법령 OC 키
  var oc = props.getProperty('LAW_OC');
  if (!oc) out.push({ 수준: '경고', 항목: '법령 인증키(LAW_OC) 없음 — 법령·판례 조회와 법령 감시가 멈춤' });
  else {
    var lr = envFetch_('https://www.law.go.kr/DRF/lawSearch.do?OC=' + encodeURIComponent(oc) + '&target=eflaw&type=XML&display=1&query=' + encodeURIComponent('소득세법'));
    if (lr.code !== 200 || !/<law/.test(lr.text)) out.push({ 수준: '경고', 항목: '법령 인증키(LAW_OC) 응답 이상(' + lr.code + ')' });
  }
  // 실거래가(국토부) 키 — 가벼운 1건 조회
  var mk = props.getProperty('MOLIT_API_KEY');
  if (mk) {
    var ym = Utilities.formatDate(new Date(Date.now() - 40 * 86400000), 'Asia/Seoul', 'yyyyMM');
    var mr = envFetch_('https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=' + encodeURIComponent(mk) + '&LAWD_CD=11110&DEAL_YMD=' + ym + '&pageNo=1&numOfRows=1');
    if (mr.code !== 200 || /SERVICE_KEY|SERVICE KEY|LIMITED|<returnAuthMsg>/i.test(mr.text) && !/<resultCode>0+<\/resultCode>/.test(mr.text)) out.push({ 수준: '경고', 항목: '실거래가 API 키(MOLIT_API_KEY) 응답 이상(' + mr.code + ') — 활용기간 만료·트래픽 초과 확인(공공데이터포털)' });
  } else out.push({ 수준: '주의', 항목: '실거래가 API 키(MOLIT_API_KEY) 없음' });
  ['BUILDING_HUB_API_KEY', 'JUSO_API_KEY', 'VWORLD_API_KEY', 'NTS_API_KEY'].forEach(function (k) { if (!props.getProperty(k)) out.push({ 수준: '주의', 항목: k + ' 없음 — 해당 조회 도구가 동작하지 않음' }); });
  // 네이버 블로그 토큰
  var nx = Number(props.getProperty('NAVER_TOKEN_EXPIRES_AT') || 0), nrt = props.getProperty('NAVER_REFRESH_TOKEN');
  if (props.getProperty('NAVER_CLIENT_ID') && !nrt) out.push({ 수준: '주의', 항목: '네이버 블로그 갱신 토큰 없음 — 블로그 자동 발행 전에 다시 로그인 필요' });
  else if (nx && nx < Date.now() - 300 * 86400000) out.push({ 수준: '주의', 항목: '네이버 블로그 토큰이 오래됨 — 갱신 토큰도 만료됐을 수 있음(발행 실패 시 다시 로그인)' });
  return { items: out, models: models };
}

// ---------- 5) 새로 가능해진 기술 수집(능력 정찰, 매주) ----------
// 공개 릴리스 노트·변경 페이지(로그인·유료 불필요)만. 날짜 제목 아래 내용 중 관심 낱말이 든 것만 모은다.
var ENV_CAP_SOURCES_ = [
  { id: 'claude', name: 'Claude(Anthropic) 릴리스 노트', url: 'https://docs.claude.com/en/release-notes/overview', type: 'html' },
  { id: 'gemini', name: 'Gemini API 변경 내역', url: 'https://ai.google.dev/gemini-api/docs/changelog', type: 'html' },
  { id: 'gcpgemini', name: 'Google Cloud Gemini 릴리스 노트', url: 'https://cloud.google.com/feeds/gemini-release-notes.xml', type: 'rss' },
  { id: 'vision', name: 'Google Cloud Vision(OCR) 릴리스 노트', url: 'https://cloud.google.com/feeds/vision-release-notes.xml', type: 'rss' },
  { id: 'gas', name: 'Apps Script 릴리스 노트', url: 'https://developers.google.com/apps-script/release-notes', type: 'html' },
  { id: 'chromeai', name: '크롬 내장 AI(Prompt·Summarizer·Translator 등)', url: 'https://developer.chrome.com/docs/ai/built-in-apis', type: 'page' },
  { id: 'chromeext', name: '크롬 확장프로그램 새 기능', url: 'https://developer.chrome.com/docs/extensions/whats-new', type: 'html' },
  { id: 'chromeblog', name: '크롬 개발자 블로그', url: 'https://developer.chrome.com/static/blog/feed.xml', type: 'rss' },
  { id: 'datagokr', name: '공공데이터포털 신규·수정 API(국세·부동산·등기·주민등록)', type: 'datagokr', keywords: ['국세', '부동산 거래', '공시가격', '건축물대장', '등기', '토지대장', '주민등록', '가족관계', '상속', '사업자등록'] }
];
var ENV_CAP_INTEREST_RE_ = /(ocr|document ai|vision|pdf|handwrit|korean|한국어|batch|discount|price|pricing|cheaper|free tier|deprecat|retire|shut ?down|new model|model|prompt api|summarizer|translator|writer|rewriter|language detector|on-device|gemini nano|built-in ai|extension|side ?panel|offscreen|scripting|downloads|urlfetch|drive|docs|sheets|quota|limit|apps script|structured output|citation|files api|token|cache|caching)/i;
var ENV_MONTHS_ = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
function envStripHtml_(s) { return String(s || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(x[0-9a-f]+|\d+);/gi, function (m, n) { return String.fromCharCode(n.charAt(0).toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : parseInt(n, 10)); }).replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); }
function envParseDate_(s) {
  var m = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i.exec(s);
  if (m) return m[3] + ('0' + ENV_MONTHS_[m[1].toLowerCase()]).slice(-2) + ('0' + m[2]).slice(-2);
  m = /\b(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{1,2})-(\d{4})\b/i.exec(s);
  if (m) return m[3] + ('0' + ENV_MONTHS_[m[1].toLowerCase()]).slice(-2) + ('0' + m[2]).slice(-2);
  m = /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/.exec(s);
  if (m) return m[3] + ('0' + m[1]).slice(-2) + ('0' + m[2]).slice(-2);
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[1] + m[2] + m[3];
  return '';
}
// 날짜 제목(h2·h3 또는 id="october-9-2026" 꼴) 단위로 나눠 [{date, text}]
function envDatedSections_(html) {
  var marks = [], re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>|id="((?:january|february|march|april|may|june|july|august|september|october|november|december)-\d{1,2}-\d{4})"/gi, m;
  while ((m = re.exec(html))) {
    var d = envParseDate_(m[2] || envStripHtml_(m[1]) || '') || (m[0].match(/id="([^"]+)"/) ? envParseDate_(m[0].match(/id="([^"]+)"/)[1]) : '');
    if (d) marks.push({ at: m.index, end: re.lastIndex, d: d });
  }
  var out = [];
  marks.forEach(function (k, i) {
    if (i && marks[i - 1].d === k.d && k.at - marks[i - 1].at < 400) return; // 같은 날짜가 바로 겹쳐 잡힌 것
    var next = i + 1 < marks.length ? marks[i + 1].at : Math.min(html.length, k.end + 20000);
    out.push({ date: k.d, text: envStripHtml_(html.slice(k.end, next)).slice(0, 700) });
  });
  return out;
}
function envWatchCapabilities_(state, deadline) {
  state.cap = state.cap || {};
  var found = [], status = [];
  var floor = Utilities.formatDate(new Date(Date.now() - 45 * 86400000), 'Asia/Seoul', 'yyyyMMdd');
  ENV_CAP_SOURCES_.forEach(function (src) {
    if (Date.now() > deadline) { status.push(src.name + ': 시간 부족(다음 주)'); return; }
    var st = state.cap[src.id] || {}, last = st.last || floor, newest = last;
    try {
      if (src.type === 'datagokr') {
        var seen = st.seen || {}, first = !st.seen, cnt = 0;
        src.keywords.forEach(function (kw) {
          var r = envFetch_('https://www.data.go.kr/tcs/dss/selectDataSetList.do?dType=API&sort=updtDt&perPage=20&keyword=' + encodeURIComponent(kw));
          if (r.code !== 200) return;
          var re = /<a href="\/data\/(\d+)\/openapi\.do">([\s\S]*?)<\/a>[\s\S]*?수정일<\/strong>\s*([\d-]{10})/g, m;
          while ((m = re.exec(r.text))) {
            var id = m[1], title = envStripHtml_(m[2]), d = m[3].replace(/-/g, '');
            if (seen[id] === d) continue;
            var isNew = !seen[id];
            seen[id] = d;
            if (!first && d >= last) { found.push({ 출처: src.name, 날짜: d, 제목: title + (isNew ? ' (신규 등록)' : ' (수정)'), 링크: 'https://www.data.go.kr/data/' + id + '/openapi.do', 낱말: kw }); cnt++; }
            if (d > newest) newest = d;
          }
        });
        st.seen = seen; st.last = newest;
        status.push(src.name + ': ' + (first ? '기준 목록 저장(다음 주부터 신규 비교)' : cnt + '건'));
      } else {
        var r2 = envFetch_(src.url);
        if (r2.code !== 200) { status.push(src.name + ': 읽기 실패(' + r2.code + ')'); return; }
        var secs = [];
        if (src.type === 'rss') {
          var ir = /<(item|entry)>([\s\S]*?)<\/\1>/g, it;
          while ((it = ir.exec(r2.text))) {
            var body = it[2];
            var t = envStripHtml_((/<title[^>]*>([\s\S]*?)<\/title>/.exec(body) || [])[1] || '').replace(/^<!\[CDATA\[|\]\]>$/g, '');
            var dRaw = (/<(pubDate|updated|published)>([^<]+)</.exec(body) || [])[2] || '';
            var dd = dRaw ? Utilities.formatDate(new Date(dRaw), 'Asia/Seoul', 'yyyyMMdd') : '';
            var desc = envStripHtml_(((/<(description|content|summary)[^>]*>([\s\S]*?)<\/\1>/.exec(body) || [])[2] || '').replace(/<!\[CDATA\[|\]\]>/g, ''));
            var link = envStripHtml_((/<link>([^<]+)<\/link>/.exec(body) || /<link[^>]*href="([^"]+)"/.exec(body) || [])[1] || '');
            if (dd) secs.push({ date: dd, text: (t + ' — ' + desc).slice(0, 700), link: link });
          }
        } else if (src.type === 'page') {
          // 날짜 제목이 없는 안내 페이지 — 본문 지문이 바뀌면 "바뀜"으로만 알린다
          var txt = envStripHtml_(r2.text), hsh = envHash_(txt.slice(0, 60000));
          if (st.hash && st.hash !== hsh) found.push({ 출처: src.name, 날짜: envToday_(), 제목: '페이지 내용이 바뀜 — 새 API·지원 범위 변화 확인', 링크: src.url });
          st.hash = hsh; state.cap[src.id] = st; status.push(src.name + ': ' + (st.hash ? '지문 비교' : '기준 저장'));
          return;
        } else secs = envDatedSections_(r2.text);
        var cnt2 = 0;
        secs.forEach(function (s) {
          if (s.date <= last) return;
          if (s.date > newest) newest = s.date;
          if (!ENV_CAP_INTEREST_RE_.test(s.text)) return;
          cnt2++;
          found.push({ 출처: src.name, 날짜: s.date, 제목: s.text.slice(0, 300), 링크: s.link || src.url });
        });
        st.last = newest;
        status.push(src.name + ': ' + cnt2 + '건');
      }
    } catch (e) { status.push(src.name + ': 오류 ' + String(e && e.message || e).slice(0, 60)); }
    state.cap[src.id] = st;
  });
  found.sort(function (a, b) { return b.날짜.localeCompare(a.날짜); });
  return { items: found.slice(0, 40), status: status };
}

// ---------- 묶음 실행 ----------
// 매일 밤: 법령·기술·달력 / 매주(일요일 밤 또는 지난 실행 후 6일 경과): 예규판례·능력정찰
function runEnvWatch_(opts) {
  opts = opts || {};
  var started = Date.now(), deadline = started + (opts.budgetMs || 150000);
  var state = envReadJson_(ENV_WATCH_STATE_NAME_, {});
  var prev = envReadJson_(ENV_WATCH_RESULT_NAME_, {});
  var res = { at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') };
  try { res.laws = envWatchLaws_(state, deadline); } catch (e) { res.laws = { error: String(e && e.message || e) }; }
  try { res.tech = envTechCheck_(); } catch (e) { res.tech = { error: String(e && e.message || e) }; }
  try { res.calendar = envCalendar_(); } catch (e) { res.calendar = []; }
  var weeklyDue = opts.weekly || !state.weeklyAt || (Date.now() - new Date(state.weeklyAt).getTime()) > 6 * 86400000 ||
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'u') === '7';
  if (weeklyDue && Date.now() < deadline + 120000) {
    var wDeadline = Date.now() + 120000;
    try { res.precedents = envWatchPrecedents_(state, wDeadline); } catch (e) { res.precedents = { error: String(e && e.message || e) }; }
    try { res.capabilities = envWatchCapabilities_(state, wDeadline + 60000); } catch (e) { res.capabilities = { error: String(e && e.message || e) }; }
    state.weeklyAt = new Date().toISOString();
    res.weeklyAt = res.at;
  } else {
    // 주간 결과는 다음 주간 실행 때까지 그대로 보여 준다
    res.precedents = prev.precedents || null; res.capabilities = prev.capabilities || null; res.weeklyAt = prev.weeklyAt || null;
  }
  res.secs = Math.round((Date.now() - started) / 1000);
  try { envWriteJson_(ENV_WATCH_STATE_NAME_, state); } catch (e) {}
  try { envWriteJson_(ENV_WATCH_RESULT_NAME_, res); } catch (e) {}
  return res;
}
function envWatchLast_() { return envReadJson_(ENV_WATCH_RESULT_NAME_, null); }
// 개선 후보 보고서에 넣을 요약 + 머리줄
function envWatchForReport_() {
  var r = envWatchLast_();
  if (!r) return null;
  var head = [], laws = r.laws && r.laws.items || [];
  laws.forEach(function (l) {
    if (l.새로시행) head.push('⚖️ ' + l.법령 + ' 새 개정 시행(' + l.현행.시행일 + ')' + (l.바뀐조문 ? ' — 바뀐 조문 ' + l.바뀐조문.length + '개' + (l.영향함수 && l.영향함수.length ? ', 영향 계산함수 ' + l.영향함수.length + '개' : '') : ''));
    (l.시행예정 || []).forEach(function (f) { if (f.신규) head.push('⏳ ' + l.법령 + ' 공포됨·시행 예정 ' + f.시행일 + (f.바뀔조문 ? ' — 바뀔 조문 ' + (f.바뀔조문수 || f.바뀔조문.length) + '개' + (f.영향함수 && f.영향함수.length ? ', 영향 계산함수 ' + f.영향함수.length + '개' : '') : '')); });
  });
  var techItems = r.tech && r.tech.items || [];
  techItems.filter(function (t) { return t.수준 === '경고'; }).forEach(function (t) { head.push('🔧 ' + t.항목); });
  (r.calendar || []).forEach(function (c) { if (c.코드확인) head.push('📅 ' + c.항목.split(' — ')[0] + ' — ' + c.코드확인); });
  var pc = r.precedents && r.precedents.items ? r.precedents.items.length + (r.precedents.admrul || []).length : 0;
  if (pc) head.push('📜 예규·판례·고시 신착 ' + pc + '건(주간)');
  var cc = r.capabilities && r.capabilities.items ? r.capabilities.items.length : 0;
  if (cc) head.push('🛰️ 새로 가능해진 기술 후보 ' + cc + '건(주간)');
  return { at: r.at, head: head, laws: r.laws, precedents: r.precedents, calendar: r.calendar, tech: r.tech, capabilities: r.capabilities,
    count: head.length };
}
// 새벽 4시 전용 실행(시간 트리거) — 감시 후 개선 후보 보고서를 다시 만든다(2시 묶음이 만든 보고서에 이 결과를 덧붙이려고)
function runEnvWatchNightly() {
  try { runEnvWatch_({ budgetMs: 200000 }); } catch (e) { console.error('환경 감시 실패: ' + (e && e.message)); }
  try { buildImprovementReport_(); } catch (e) { console.error('개선 후보 보고서 실패: ' + (e && e.message)); }
  try { CacheService.getScriptCache().remove('dsc_ver_getNightlyStatus'); } catch (e) {}
}
function envEnsureTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'runEnvWatchNightly'; });
  if (!has) ScriptApp.newTrigger('runEnvWatchNightly').timeBased().everyDays(1).atHour(4).create();
  return { ok: true, existed: has };
}
