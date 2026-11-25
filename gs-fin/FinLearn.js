// ============================================================
// [2026.11.25] 금융거래 분석 — 스스로 나아지는 분석(자체 학습, GAS·AI 0원)
// ------------------------------------------------------------
// 세무사님 11-25 0시 원문: "분석기법을 보다 고도화하는 한편 계속 분석기법을 고도화할수 있는 자체지능형 분석시스템을 구현하도록 하라."
// 계획서: docs/_기록/금융거래_분석대상자_자체학습_계획서_20261125.html 3절
//  · 배우는 곳: 모든 사건에서 세무사님이 정하신 것(분석대상자 갈래 ✎ · 거래 성격 ✎ · 세무사님 엑셀 판단 · 짚을 곳 상태 ✎)
//  · 배우는 것: ① 상호·기관 글자 → 갈래 ② 통장 글자 → 성격 ③ 짚을 곳 규칙마다 맞힌 비율(성적)
//  · 쓰는 곳: 다른 사건 후보의 갈래 짐작·성격(GAS)에 「배움」 표시, 짚을 곳 「중요도」·「배움」, 성적 낮은 규칙은 「다듬을 규칙」으로
//  · 사람 이름은 사건마다 달라 사건을 넘어 배우지 않는다(상호·기관·통장 낱말만). 배운 것은 늘 짐작 — 정하는 것은 세무사님.
//  · 학습 파일: 업무관리자/_금융거래_분석학습.json — 사건마다 판단을 모아 두고(사건 열쇠), 쓸 때마다 다시 셈(판단을 고치시면 그대로 따라감)
// ============================================================

var FIN_LN_FILE_ = '_금융거래_분석학습.json';
var FIN_LN_SKIP_NATURE_ = /^(안에서 옮김|바깥 — 안에서 옮김 아님)$/;
var FIN_LN_REAL_ = /소명 안 됨|물음 보냄|답 받음|소명 됨/; // 실제로 살펴볼 일이었던 상태
var FIN_LN_NO_ = /해당 없음/;

// 사건을 넘어 쓸 글자 열쇠 — 숫자·「월」·괄호 떼고 대문자(「전기요금08월」 → 「전기요금」, 「현대카드11」 → 「현대카드」)
function finLnKey_(s) { return finRvNorm_(s).replace(/\d+월?$/g, '').replace(/\d+/g, '').replace(/[*]/g, ''); }
function finLnPersonLike_(s) { return finTgPerson_(s); } // 사람 이름 가름은 분석대상자와 같은 잣대(FinTarget.js)

// ---------- ① 이 사건에서 세무사님이 정하신 것 모으기(순수) ----------
function finLnCollect_(A, U) {
  var lanes = {}, natures = {}, flags = {};
  A.rels.forEach(function (x) {
    if (!x.갈래 || FIN_RV_FAMILY_.test(x.갈래) || finLnPersonLike_(x.이름)) return;
    var k = finLnKey_(x.이름); if (k.length < 2) return; lanes[k] = x.갈래;
  });
  var urow = function (r) { var o = (U.rows || {})[r.k]; if (!o) return {}; var m = Object.assign({}, o._x || {}); Object.keys(o).forEach(function (k) { if (k !== '_x' && o[k]) m[k] = o[k]; }); return m; };
  A.R.forEach(function (r) {
    var n = urow(r).성격; if (!n || FIN_LN_SKIP_NATURE_.test(n) || !r.best || finLnPersonLike_(r.best.raw)) return;
    var k = finLnKey_(r.best.n); if (k.length < 2) return; k += '|' + r.dir;
    var o = natures[k] || (natures[k] = {}); o[n] = (o[n] || 0) + 1;
  });
  A.flags.forEach(function (f) {
    var s = f.상태 || ''; if (!s || s === '확인 전') return;
    var k = f.번호 + '|' + (f.성격열쇠 || ''), o = flags[k] || (flags[k] = {}); o[s] = (o[s] || 0) + 1;
  });
  return { lanes: lanes, natures: natures, flags: flags };
}

// ---------- ② 모든 사건을 합쳐 배운 것(순수) ----------
function finLnAgg_(cases) {
  var lanes = {}, natures = {}, flags = {}, codes = {}, n = 0, codeCases = {};
  Object.keys(cases || {}).forEach(function (cid) {
    var c = cases[cid]; if (!c) return; n++;
    Object.keys(c.lanes || {}).forEach(function (k) { var o = lanes[k] || (lanes[k] = {}); o[c.lanes[k]] = (o[c.lanes[k]] || 0) + 1; });
    Object.keys(c.natures || {}).forEach(function (k) { var o = natures[k] || (natures[k] = { 사건: 0, 줄: {} }); o.사건++; Object.keys(c.natures[k]).forEach(function (v) { o.줄[v] = (o.줄[v] || 0) + c.natures[k][v]; }); });
    Object.keys(c.flags || {}).forEach(function (k) {
      var code = k.split('|')[0]; (codeCases[code] = codeCases[code] || {})[cid] = 1; var o = flags[k] || (flags[k] = { 판단: 0, 해당없음: 0, 살펴봄: 0 }), q = codes[code] || (codes[code] = { 판단: 0, 해당없음: 0, 살펴봄: 0 });
      Object.keys(c.flags[k]).forEach(function (s) { var v = c.flags[k][s]; o.판단 += v; q.판단 += v; if (FIN_LN_NO_.test(s)) { o.해당없음 += v; q.해당없음 += v; } else if (FIN_LN_REAL_.test(s)) { o.살펴봄 += v; q.살펴봄 += v; } });
    });
  });
  // 갈래 — 여러 사건이 다르게 정했으면 가장 많은 쪽(같으면 쓰지 않음)
  var L = {}; Object.keys(lanes).forEach(function (k) { var o = lanes[k], top = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }); if (top.length === 1 || o[top[0]] > o[top[1]]) L[k] = { 갈래: top[0], 사건: o[top[0]] }; });
  // 성격 — 두 줄 넘게, 열에 여덟 넘게 같은 성격일 때만
  var N = {}; Object.keys(natures).forEach(function (k) { var o = natures[k].줄, tot = 0, top = null; Object.keys(o).forEach(function (v) { tot += o[v]; if (!top || o[v] > o[top]) top = v; }); if (tot >= 2 && o[top] / tot >= 0.8) N[k] = { 성격: top, 줄: tot, 몫: Math.round(o[top] / tot * 100) / 100, 사건: natures[k].사건 }; });
  Object.keys(codes).forEach(function (c) { codes[c].사건 = Object.keys(codeCases[c] || {}).length; });
  return { 사건수: n, lanes: L, natures: N, flags: flags, codes: codes };
}

// ---------- ③ 쓰기(순수 — 분석 본체가 부름) ----------
// 갈래 짐작 — 세무사님 갈래·가족 지도 짐작이 없는 대상자만(「(배움)」 표시)
function finLnApplyLanes_(rels, L) {
  if (!L || !L.lanes) return 0; var n = 0;
  rels.forEach(function (x) {
    if (x.갈래 || (x.짐작 && !x.짐작배움 && !/^(금융기관·보험|병원·요양|공과금·세금|그 밖 거래처)$/.test(x.짐작))) return;
    if (finLnPersonLike_(x.이름)) return;
    var h = L.lanes[finLnKey_(x.이름)]; if (!h) return;
    if (x.짐작 !== h.갈래 || !x.짐작배움) { x.짐작 = h.갈래; x.짐작배움 = true; n++; }
  });
  return n;
}
// 성격 — GAS 낱말 규칙이 못 정했거나 「되풀이」뿐인 줄
function finLnNature_(r, L) {
  if (!L || !L.natures || !r.best || finLnPersonLike_(r.best.raw)) return null;
  var h = L.natures[finLnKey_(r.best.n) + '|' + r.dir]; return h || null;
}
// 짚을 곳 중요도 — 금액(자릿수) × 배운 성적(같은 번호·성격이 대개 「해당 없음」이면 낮춤). 성적 없으면 금액만
function finLnScore_(f, L) {
  var amt = Math.max(1, Number(f.금액) || 1), base = Math.round(Math.log(amt) / Math.LN10 * 10) / 10;
  var st = L && L.flags ? (L.flags[f.번호 + '|' + (f.성격열쇠 || '')] || null) : null, code = L && L.codes ? L.codes[f.번호] : null;
  // 같은 번호·성격 판단 3건 넘게(그 묶음), 아니면 번호 전체 판단이 두 사건 넘게·5건 넘게(한 사건 판단만으로 다른 사건 번호 전체를 낮추지 않음)
  var use = st && st.판단 >= 3 ? st : code && code.판단 >= 5 && (code.사건 || 0) >= 2 ? code : null, note = '';
  if (use) {
    var no = use.해당없음 / use.판단;
    base = Math.round(base * (1 - 0.6 * no) * 10) / 10;
    if (use.판단 >= 5 && no >= 0.9) note = '배움: 비슷한 짚을 곳 ' + use.판단 + '건 중 ' + use.해당없음 + '건 「해당 없음」';
    else if (use.판단 >= 3 && use.살펴봄 / use.판단 >= 0.5) note = '배움: 비슷한 짚을 곳 ' + use.판단 + '건 중 ' + use.살펴봄 + '건 실제로 살펴봄';
  }
  return { 점수: base, 배움: note };
}

// ---------- ④ 학습 파일 읽기·쓰기 ----------
var FIN_LN_MEMO_ = null;
function finLnFile_(create) {
  var dir = getBusinessManagerFolder_(); if (!dir) return null;
  var it = dir.getFilesByName(FIN_LN_FILE_); if (it.hasNext()) return it.next();
  if (!create) return null;
  return dir.createFile(FIN_LN_FILE_, JSON.stringify({ 안내: '금융거래 분석 자체 학습 — 세무사님이 사건마다 정하신 갈래·성격·짚을 곳 상태를 모아 다른 사건 분석에 짐작으로 씀(GAS). 고치지 마세요(사건 시트에서 고치시면 따라 바뀜).', cases: {} }), 'application/json');
}
function finLnLoad_() {
  if (FIN_LN_MEMO_) return FIN_LN_MEMO_;
  var D = { cases: {} };
  try { var f = finLnFile_(false); if (f) D = JSON.parse(f.getBlob().getDataAsString('UTF-8')) || D; } catch (e) {}
  D.cases = D.cases || {};
  FIN_LN_MEMO_ = { D: D, agg: finLnAgg_(D.cases) };
  return FIN_LN_MEMO_;
}
// 이 사건 몫이 바뀌었을 때만 파일을 고친다(잠금 — 두 사건이 겹쳐 쓰지 않게)
function finLnSave_(caseId, contrib) {
  var key = String(caseId || ''); if (!key) return false;
  var empty = !Object.keys(contrib.lanes).length && !Object.keys(contrib.natures).length && !Object.keys(contrib.flags).length;
  var M = finLnLoad_(), prev = M.D.cases[key];
  if (JSON.stringify(prev ? { lanes: prev.lanes, natures: prev.natures, flags: prev.flags } : null) === JSON.stringify(empty ? null : contrib)) return false;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return false;
  try {
    var f = finLnFile_(true), D = { cases: {} };
    try { D = JSON.parse(f.getBlob().getDataAsString('UTF-8')) || D; } catch (e) {}
    D.cases = D.cases || {};
    if (empty) delete D.cases[key]; else D.cases[key] = Object.assign({ at: new Date().toISOString() }, contrib);
    D.고친때 = new Date().toISOString();
    f.setContent(JSON.stringify(D));
    FIN_LN_MEMO_ = { D: D, agg: finLnAgg_(D.cases) };
  } finally { lock.releaseLock(); }
  return true;
}

// ---------- ⑤ 「배운 것」 탭 ----------
function finLnWrite_(ss, A, L) {
  var rows = [], blank = ['', '', '', '', ''], t = function (s) { return [s, '', '', '', '']; };
  var used = A.learnUsed || { lanes: [], natures: 0, natureRows: [], flags: 0 };
  rows.push(t('■ 이 사건에 쓴 배움 — 다른 사건에서 세무사님이 정하신 것(모두 짐작 — 고르시면 그 값이 이김)'));
  rows.push(['갈래 짐작', used.lanes.length + '곳', used.lanes.slice(0, 20).join(' · '), '', '']);
  rows.push(['성격(GAS)', used.natures + '줄', used.natureRows.slice(0, 20).join(' · '), '', '']);
  rows.push(['짚을 곳 「배움」 표시', used.flags + '곳', '', '', '']);
  rows.push(blank);
  rows.push(t('■ 짚을 곳 규칙 성적 — 모든 사건에서 세무사님이 상태를 고르신 것(' + ((L && L.사건수) || 0) + '사건)'));
  rows.push(['번호', '판단 받은 수', '「해당 없음」', '실제로 살펴봄(물음·답·소명)', '다듬을 규칙?']);
  var codes = (L && L.codes) || {};
  Object.keys(codes).sort().forEach(function (c) { var q = codes[c], no = q.판단 ? q.해당없음 / q.판단 : 0; rows.push([c, q.판단, q.해당없음 + ' (' + Math.round(no * 100) + '%)', q.살펴봄, q.판단 >= 10 && no >= 0.7 ? '예 — 대개 해당 없음, 규칙을 좁힐 후보' : '']); });
  if (!Object.keys(codes).length) rows.push(['아직 없음 — 짚을 곳 탭 「상태 ✎」를 고르시면 쌓입니다', '', '', '', '']);
  rows.push(blank);
  rows.push(t('■ 배운 갈래(상호·기관) ' + Object.keys((L && L.lanes) || {}).length + '개 · 배운 성격(통장 낱말) ' + Object.keys((L && L.natures) || {}).length + '개'));
  Object.keys((L && L.natures) || {}).slice(0, 60).forEach(function (k) { var h = L.natures[k], p = k.split('|'); rows.push(['성격', p[0] + (p[1] === 'i' ? ' (들어옴)' : ' (나감)'), h.성격, h.줄 + '줄 · ' + Math.round(h.몫 * 100) + '%', h.사건 + '사건']); });
  Object.keys((L && L.lanes) || {}).slice(0, 60).forEach(function (k) { var h = L.lanes[k]; rows.push(['갈래', k, h.갈래, '', h.사건 + '사건']); });
  finRvTab_(ss, '배운 것', ['무엇', '수', '내용', '근거', '더'], rows, { text: [1], note: '스스로 나아지는 분석 — 세무사님이 사건마다 정하신 갈래·성격·짚을 곳 상태를 모아(업무관리자/_금융거래_분석학습.json) 다른 사건 분석에 짐작으로 씁니다. 사람 이름은 사건을 넘어 배우지 않습니다. 「다듬을 규칙」은 성적이 낮아 규칙을 좁힐 후보(Claude·넥스가 고칠 때 봄).' });
}
