// =========================================================
// [2026.10.14] 🧪 정답지 점검(토큰 0) — "이 사건 처리하자"를 고치고 브라우저로 하나씩 확인하던 핑퐁을 없애려고 만든 회귀시험.
// 사건 폴더의 _정답지.json(세무사님이 확인한 정답 — 저장소에는 절대 넣지 않음, 고객 자료)과, 사이드바가 도는 것과 같은 서버 단계
// (기본 → 증빙 → 처리개요)와 세액계산 화면 엔진(taxcalc-engine.html을 서버에서 그대로 실행)의 결과를 칸별로 대조한다.
// AI 호출 없음. 결과는 업무관리자 폴더 _정답지점검결과.json에 저장하고, 실패는 개선 후보 보고서(buildImprovementReport_)에 올라간다.
//
// 정답지 형식(일부 칸만 있어도 됨 — 있는 칸만 대조):
// { "상태": "초안"|"확정", "출처": "…", "세목": "inheritance",
//   "기준일": "YYYY-MM-DD", "법정일": "YYYY-MM-DD",
//   "피상속인": "…", "상속인수": 4, "상속인": ["이름(관계)", …],
//   "재산": [{ "소재지": "…(일부 낱말)", "가액": 123 }], "금융재산": 0, "장례비": 0, "봉안시설": 0,
//   "과세가액": 0, "과세표준": 0, "산출세액": 0, "신고세액공제": 0, "납부세액": 0,
//   "남은항목": [{ "포함": "봉안시설", "종류": "missing" }],   ← 도구가 물어야 하는 것 전부(이 밖의 질문은 결함)
//   "근거": { "칸": "어느 서류로 확인했는지" } }
// 증여·양도는 기준일·법정일·처리개요 칸·저장된 계산의 최종세액(납부세액)을 대조한다.
// =========================================================
const AK_KEY_NAME_ = '_정답지.json';
const AK_RESULT_NAME_ = '_정답지점검결과.json';
const AK_STATE_PROP_ = 'AK_RUN_STATE';

function akReadCase_(caseId) {
  const sheet = work_getSheet_(), col = work_colMap_(sheet.getDataRange().getValues()[0]);
  const found = work_findCaseRow_(sheet, col, caseId);
  return found ? work_readRow_(col, found.row) : null;
}
function akKeyFile_(folderId) {
  try {
    const it = DriveApp.getFolderById(folderId).getFilesByName(AK_KEY_NAME_);
    return it.hasNext() ? it.next() : null;
  } catch (e) { return null; }
}
function akLoadKey_(c) {
  const f = akKeyFile_(String(c.폴더ID || '').trim());
  if (!f) return null;
  try { return { key: JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}'), fileId: f.getId() }; } catch (e) { return { key: null, error: '정답지 JSON을 읽지 못함: ' + e.message, fileId: f.getId() }; }
}
// 정답지가 있는 사건 — Drive 검색 한 번으로(사건 폴더를 하나씩 열지 않음)
function akCasesWithKey_() {
  const sheet = work_getSheet_(), data = sheet.getDataRange().getValues(), col = work_colMap_(data[0]);
  const byFolder = {};
  for (let i = 1; i < data.length; i++) { const fid = String(data[i][col.폴더ID] || '').trim(); if (fid) byFolder[fid] = String(data[i][col.id]); }
  const out = [];
  const it = DriveApp.searchFiles("title = '" + AK_KEY_NAME_ + "' and trashed = false");
  while (it.hasNext()) {
    const f = it.next(), ps = f.getParents();
    while (ps.hasNext()) { const p = ps.next(); if (byFolder[p.getId()] && out.indexOf(byFolder[p.getId()]) === -1) out.push(byFolder[p.getId()]); }
  }
  return out;
}
const akNorm_ = function (x) { return String(x == null ? '' : x).replace(/\([^)]*\)/g, '').replace(/[\s,·]/g, ''); };
const akDigits_ = function (v) { return String(v == null ? '' : v).replace(/[^\d-]/g, ''); };
function akSame_(exp, got, kind) {
  if (got === null || got === undefined || got === '') return false;
  if (kind === 'money' || kind === 'number') return Number(akDigits_(exp)) === Number(akDigits_(got));
  if (kind === 'list') {
    const a = (exp || []).map(akNorm_).sort(), b = (got || []).map(akNorm_).sort();
    return a.length === b.length && a.every(function (x, i) { return x === b[i]; });
  }
  return akNorm_(exp) === akNorm_(got);
}
// 사건의 지금 값(도구가 낸 값) — 상속은 서류 규칙 정리(caseProcInhFacts_) + 화면 엔진 계산, 증여·양도는 처리개요·저장된 계산
function akToolValues_(c) {
  const v = {}, saved = caseProcLoad_(c.id), filled = saved.filled || {}, ov = c.사건개요 || {};
  const put = function (k, val, src, kind) { v[k] = { v: val, src: src || '', kind: kind || 'text' }; };
  put('기준일', c.기준일 || '', (filled.기준일 && filled.기준일.src) || '사건 기준일', 'date');
  put('법정일', c.법정일 || '', '사건 법정일(기준일로 계산)', 'date');
  if (c.세목 === 'inheritance') {
    const f = caseProcInhFacts_(c);
    put('피상속인', f.deceased.name || '', f.deceased.src);
    put('상속인수', f.heirs.length, f.heirs[0] ? f.heirs[0].src : '서류 없음', 'number');
    put('처리개요 상속인수', ov.상속인수 || '', (filled.상속인수 && filled.상속인수.src) || '처리개요', 'number');
    put('상속인', f.heirs.map(function (h) { return h.name + '(' + (h.relation || '?') + ')'; }), f.heirs[0] ? f.heirs[0].src : '', 'list');
    put('상속인 주민번호', f.heirs.filter(function (h) { return /^\d{6}-\d{7}$/.test(h.regNo || ''); }).length + '/' + f.heirs.length, '전체 번호가 확인된 상속인 수', 'text');
    v._assets = f.assets.map(function (a) { return { loc: a.loc, v: a.value, src: a.valueSrc || (a.cands.length ? '후보 ' + a.cands.length + '개(선택 필요)' : '평가 자료 없음') }; });
    put('금융재산', f.financialValue, f.financialSrc, 'money');
    put('장례비', f.funeral.value, f.funeral.src, 'money');
    put('봉안시설', f.niche && f.niche.value !== null ? f.niche.value : 0, f.niche ? (f.niche.src || (f.niche.receipt ? '영수증 ' + f.niche.receipt.amount.toLocaleString('ko-KR') + '원(공제액 선택 전)' : '공제 0 — 계약서만 있고 납부 증빙 없음')) : '봉안 서류 없음(공제 0)', 'money'); // 계산에 들어가는 공제 대상 금액
    put('총상속재산', f.grossEstate, f.grossEstate ? '부동산 평가 + 금융재산' : '평가 안 끝남', 'money');
    if (f.grossEstate) {
      const input = { taxableEstateAmount: f.grossEstate, hasSpouse: f.heirs.some(function (h) { return h.relation === '배우자'; }), childCount: f.heirs.filter(function (h) { return h.relation === '자녀'; }).length,
        netFinancialAssets: f.financialValue || 0, funeralCostAmount: f.funeral.value || 0, funeralNicheCostAmount: (f.niche && f.niche.value) || 0 };
      const r = runUiEngineCalcTool_('calculate_inheritance_tax', input) || { error: '엔진 없음' };
      v._engineInput = input;
      if (r.error) put('계산', '', '엔진 오류: ' + r.error);
      else {
        put('과세가액', (r.상속세과세가액_적용값 || 0) - (r.장례비용공제 || 0), '화면 엔진(상속세과세가액 − 장례비용공제)', 'money');
        put('상속공제', (r.상속공제_합계 || 0) - (r.장례비용공제 || 0), '화면 엔진(일괄·금융재산 등, 장례비 제외)', 'money');
        ['과세표준', '산출세액', '신고세액공제', '납부세액'].forEach(function (k) { put(k, r[k], '화면 엔진', 'money'); });
      }
    }
  } else {
    Object.keys(ov).forEach(function (k) { if (typeof ov[k] !== 'object') put('처리개요 ' + k, ov[k], (filled[k] && filled[k].src) || '처리개요'); });
    const lc = caseProcLastCalc_(c).last;
    if (lc) put('납부세액', lc.최종세액, '저장된 계산(' + (lc.계산일 || '') + ')', 'money');
  }
  return v;
}
const AK_FIELD_KIND_ = { 기준일: 'date', 법정일: 'date', 상속인수: 'number', 상속인: 'list', 금융재산: 'money', 장례비: 'money', 봉안시설: 'money', 총상속재산: 'money', 과세가액: 'money', 상속공제: 'money', 과세표준: 'money', 산출세액: 'money', 신고세액공제: 'money', 납부세액: 'money' };
// 한 사건 점검 — 사이드바와 같은 서버 단계를 그대로(확인창·대화 전환 없이) 돌린 뒤 대조. 증빙 단계가 서류를 다 못 읽으면 more
function akRunCase_(caseId, key) {
  let c = akReadCase_(caseId);
  if (!c) return { caseId: caseId, error: '사건을 찾지 못했습니다.' };
  const out = { caseId: caseId, 사건명: c.사건명 || c.고객명 || '', 상태: key.상태 || '초안', rows: [], extra: [], missing: [], steps: {} };
  const ev = caseProcEvidence_(c);
  if (ev.more) return { caseId: caseId, more: true, progress: ev.progress };
  c = akReadCase_(caseId);
  const ovr = caseProcOverview_(c);
  c = akReadCase_(caseId);
  const basic = caseProcBasic_(c, {});
  const calc = caseProcCalc_(c);
  const decisions = (caseProcLoad_(caseId).decisions) || {};
  const live = [].concat(basic.items || [], ev.items || [], ovr.items || [], calc.items || []).filter(function (it) { const d = decisions[it.id]; return !(d && (d.d === '무시' || d.d === 'done')); })
    .filter(function (it) { return !/^calc:/.test(it.id); }); // 세액 재계산 안내는 화면이 하는 일 — 정답 대조는 아래 엔진 계산으로
  out.steps = { evidence: ev.lines || [], overview: ovr.lines || [] };
  const tool = akToolValues_(c);
  const row = function (field, exp, got, kind) {
    const t = got || { v: '', src: '값 없음' };
    out.rows.push({ field: field, expected: exp, tool: t.v === undefined || t.v === null ? '' : t.v, src: t.src, ok: akSame_(exp, t.v, kind || t.kind || AK_FIELD_KIND_[field]) });
  };
  Object.keys(key).forEach(function (k) {
    if (/^(상태|출처|세목|남은항목|근거|메모|재산)$/.test(k)) return;
    if (k === '상속인수') { row('상속인수', key[k], tool.상속인수, 'number'); row('처리개요 상속인수', key[k], tool['처리개요 상속인수'], 'number'); return; }
    row(k, key[k], tool[k] || tool['처리개요 ' + k], AK_FIELD_KIND_[k]);
  });
  (key.재산 || []).forEach(function (a) {
    const n = akNorm_(a.소재지);
    const hit = (tool._assets || []).filter(function (x) { return akNorm_(x.loc).indexOf(n) !== -1 || n.indexOf(akNorm_(x.loc)) !== -1 || tcLocSame_(x.loc, a.소재지); })[0];
    row('재산 ' + a.소재지, a.가액, hit ? { v: hit.v, src: hit.loc + ' — ' + hit.src, kind: 'money' } : { v: '', src: '도구가 이 재산을 찾지 못함(등기부·분할협의서 정리 확인)' }, 'money');
  });
  if (key.재산) (tool._assets || []).forEach(function (x) {
    if (!(key.재산 || []).some(function (a) { const n = akNorm_(a.소재지); return akNorm_(x.loc).indexOf(n) !== -1 || n.indexOf(akNorm_(x.loc)) !== -1 || tcLocSame_(x.loc, a.소재지); }))
      out.rows.push({ field: '재산(정답지에 없음) ' + x.loc, expected: '(없음)', tool: x.v, src: x.src, ok: false });
  });
  // 남은 항목 — 정답지에 없는 질문은 결함, 정답지에 있는데 도구가 안 물은 것도 결함
  const exp = (key.남은항목 || []).map(function (e) { return typeof e === 'string' ? { 포함: e } : e; });
  const used = {};
  exp.forEach(function (e) {
    const words = String(e.포함 || '').split(/\s+/).filter(String);
    const hit = live.filter(function (it) { return !used[it.id] && words.every(function (w) { return it.text.indexOf(w) !== -1; }) && (!e.종류 || it.kind === e.종류); })[0];
    if (hit) used[hit.id] = true; else out.missing.push(e.포함 + (e.종류 ? ' (' + e.종류 + ')' : ''));
  });
  live.forEach(function (it) { if (!used[it.id]) out.extra.push({ id: it.id, kind: it.kind, text: it.text, detail: it.detail || '' }); });
  // ⚠ 서류 질문이 정답지에 없는 것이면 그 서류의 서버 글자인식 원문(앞 4천 자)을 남긴다 — 규칙을 실제 원문으로 고치려고(결과 파일은 업무관리자 폴더, 저장소에는 안 들어감)
  out.ocr = {};
  out.extra.forEach(function (x) {
    const m = /^file:([^:]+):(\d+)$/.exec(x.id);
    if (!m) return;
    try { const f = DriveApp.getFileById(m[1]); out.ocr[f.getName()] = String(tc_docText_({ id: m[1], name: f.getName(), mimeType: f.getMimeType(), modified: Number(m[2]) }) || '').slice(0, 4000); } catch (e) {}
  });
  out.engineInput = tool._engineInput || null;
  out.fails = out.rows.filter(function (r) { return !r.ok; }).length + out.extra.length + out.missing.length;
  out.pass = out.fails === 0;
  return out;
}
// 🧪 정답지 점검 실행 — {caseId?, reset?}. 사건이 많거나 처음 읽는 서류가 많으면 more:true(화면이 이어서 다시 부름)
function answerKeyRun_(body) {
  body = body || {};
  const props = PropertiesService.getScriptProperties();
  let st = null;
  if (!body.reset) { try { st = JSON.parse(props.getProperty(AK_STATE_PROP_) || 'null'); } catch (e) { st = null; } }
  if (!st || (body.caseId && st.only !== body.caseId)) {
    const ids = body.caseId ? [String(body.caseId)] : akCasesWithKey_();
    st = { only: body.caseId || '', queue: ids, results: [], startedAt: new Date().toISOString() };
  }
  const started = Date.now();
  while (st.queue.length && Date.now() - started < 60000) {
    const id = st.queue[0];
    const c = akReadCase_(id);
    const k = c ? akLoadKey_(c) : null;
    let r;
    if (!c) r = { caseId: id, error: '사건 없음' };
    else if (!k || !k.key) r = { caseId: id, 사건명: c.사건명 || '', error: (k && k.error) || '이 사건 폴더에 ' + AK_KEY_NAME_ + '이 없습니다.' };
    else { try { r = akRunCase_(id, k.key); } catch (e) { r = { caseId: id, 사건명: c.사건명 || '', error: '점검 중 오류: ' + (e && e.message || e) }; } }
    if (r.more) { props.setProperty(AK_STATE_PROP_, JSON.stringify(st)); return { ok: true, more: true, caseId: id, progress: r.progress, done: st.results.length, total: st.results.length + st.queue.length }; }
    st.results.push(r); st.queue.shift();
  }
  if (st.queue.length) { props.setProperty(AK_STATE_PROP_, JSON.stringify(st)); return { ok: true, more: true, done: st.results.length, total: st.results.length + st.queue.length }; }
  props.deleteProperty(AK_STATE_PROP_);
  const result = { at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), cases: st.results, pass: st.results.filter(function (r) { return r.pass; }).length, total: st.results.length };
  try {
    const folder = getBusinessManagerFolder_();
    if (folder) { const it = folder.getFilesByName(AK_RESULT_NAME_); if (it.hasNext()) it.next().setContent(JSON.stringify(result)); else folder.createFile(AK_RESULT_NAME_, JSON.stringify(result), 'application/json'); }
  } catch (e) { result.saveError = String(e && e.message || e); }
  return { ok: true, result: result };
}
function answerKeyLast_() {
  try {
    const folder = getBusinessManagerFolder_(), it = folder ? folder.getFilesByName(AK_RESULT_NAME_) : null;
    return it && it.hasNext() ? { ok: true, result: JSON.parse(it.next().getBlob().getDataAsString('UTF-8') || 'null') } : { ok: true, result: null };
  } catch (e) { return { error: String(e && e.message || e) }; }
}
// 개선 후보 보고서용 요약 — 고객 이름 없이 사건 id·칸 이름·종류만(보고서는 공개 저장소 루틴이 읽음)
function answerKeyForReport_() {
  const last = answerKeyLast_().result;
  if (!last) return null;
  const fails = (last.cases || []).filter(function (r) { return !r.pass; }).map(function (r) {
    return { caseId: r.caseId, error: r.error || '', fields: (r.rows || []).filter(function (x) { return !x.ok; }).map(function (x) { return x.field.replace(/^재산 .*/, '재산가액'); }),
      extra: (r.extra || []).map(function (x) { return x.kind + ':' + String(x.id).replace(/:[^:]*$/, ''); }), missing: (r.missing || []).length };
  });
  return { at: last.at, pass: last.pass, total: last.total, fails: fails };
}
// 정답지 저장 — 화면에서 고친 정답지(JSON)를 사건 폴더에 쓴다. 세무사님이 [확정]하면 상태가 확정이 된다.
function answerKeySave_(body) {
  const c = akReadCase_(String(body.caseId || ''));
  if (!c || !String(c.폴더ID || '').trim()) return { error: '사건 또는 사건 폴더가 없습니다.' };
  let key = body.key;
  if (typeof key === 'string') { try { key = JSON.parse(key); } catch (e) { return { error: 'JSON 형식이 아닙니다: ' + e.message }; } }
  if (!key || typeof key !== 'object') return { error: '정답지 내용이 없습니다.' };
  const f = akKeyFile_(c.폴더ID), txt = JSON.stringify(key, null, 1);
  if (f) f.setContent(txt); else DriveApp.getFolderById(c.폴더ID).createFile(AK_KEY_NAME_, txt, 'application/json');
  return { ok: true, message: '정답지를 저장했습니다(' + (key.상태 || '초안') + ').' };
}
function answerKeyGet_(body) {
  const c = akReadCase_(String(body.caseId || ''));
  if (!c) return { error: '사건이 없습니다.' };
  const k = akLoadKey_(c);
  return { ok: true, key: k ? k.key : null, error: k && k.error };
}
// 양도코리아 결과 PDF → 정답지 초안(토큰 0: 무료 글자인식 + 규칙). 이미 있는 정답지의 "확정" 칸은 건드리지 않는다.
// 서식 이름표(상속세·증여세·양도소득세 과세표준신고 및 자진납부계산서)의 숫자 칸을 이름표 바로 뒤 숫자로 읽는다.
const AK_FORM_LABELS_ = {
  inheritance: [['과세가액', /상\s*속\s*세\s*과\s*세\s*가\s*액/], ['상속공제', /상\s*속\s*공\s*제\s*(?:합\s*계|액)?/], ['과세표준', /과\s*세\s*표\s*준/], ['산출세액', /산\s*출\s*세\s*액/], ['신고세액공제', /신\s*고\s*세\s*액\s*공\s*제/], ['납부세액', /(?:자\s*진\s*)?납\s*부\s*할\s*세\s*액(?:\s*합\s*계)?/]],
  gift: [['과세표준', /과\s*세\s*표\s*준/], ['산출세액', /산\s*출\s*세\s*액/], ['신고세액공제', /신\s*고\s*세\s*액\s*공\s*제/], ['납부세액', /(?:자\s*진\s*)?납\s*부\s*할\s*세\s*액(?:\s*합\s*계)?/]],
  transfer: [['과세표준', /과\s*세\s*표\s*준/], ['산출세액', /산\s*출\s*세\s*액/], ['납부세액', /(?:자\s*진\s*)?납\s*부\s*할\s*세\s*액(?:\s*합\s*계)?/]]
};
function akParseFormResult_(text, seMok) {
  const t = String(text || ''), out = {};
  (AK_FORM_LABELS_[seMok] || []).forEach(function (p) {
    const m = p[1].exec(t);
    if (!m) return;
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const n = /([\d]{1,3}(?:,\d{3})+|\d{4,})/.exec(after);
    if (n) out[p[0]] = Number(n[1].replace(/,/g, ''));
  });
  return out;
}
function answerKeyDraft_(body) {
  const ids = body && body.caseId ? [String(body.caseId)] : null;
  const sheet = work_getSheet_(), data = sheet.getDataRange().getValues(), col = work_colMap_(data[0]);
  const made = [];
  for (let i = 1; i < data.length; i++) {
    const c = work_readRow_(col, data[i]);
    if (ids && ids.indexOf(String(c.id)) === -1) continue;
    if (!ids && (c.상태 === '완료' || !CASEPROC_TAX_LABEL_[c.세목])) continue;
    if (!String(c.폴더ID || '').trim()) continue;
    const files = caseProcFiles_(c).filter(function (f) { return /pdf|^image\//.test(String(f.mimeType || '')) && /양도\s*코리아|yangdo|신고서|계산서|계산명세/i.test(f.name); });
    let res = null, src = '';
    files.slice(0, 6).forEach(function (f) {
      if (res) return;
      const txt = tc_docText_(f) || '';
      if (!/과\s*세\s*표\s*준/.test(txt) || !/산\s*출\s*세\s*액/.test(txt)) return;
      const r = akParseFormResult_(txt, c.세목);
      if (Object.keys(r).length >= 2) { res = r; src = f.name; }
    });
    if (!res) { if (ids) made.push({ caseId: c.id, 사건명: c.사건명, error: '양도코리아 결과(과세표준·산출세액이 있는 서식 PDF)를 사건 폴더에서 찾지 못했습니다.' }); continue; }
    const cur = (akLoadKey_(c) || {}).key || {};
    const confirmed = cur.상태 === '확정';
    const key = Object.assign({}, cur);
    Object.keys(res).forEach(function (k) { if (!(confirmed && key[k] !== undefined)) key[k] = res[k]; });
    key.세목 = key.세목 || c.세목;
    if (!confirmed) key.상태 = '초안';
    key.근거 = Object.assign({}, key.근거 || {}, Object.keys(res).reduce(function (o, k) { o[k] = '양도코리아 결과(' + src + ') — 글자인식·규칙 초안, 세무사님 확인 전'; return o; }, {}));
    answerKeySave_({ caseId: c.id, key: key });
    made.push({ caseId: c.id, 사건명: c.사건명, from: src, fields: res });
  }
  return { ok: true, made: made };
}
