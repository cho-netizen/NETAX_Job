// =========================================================
// [2026.10.14] 🏷 납세자·사건명 일괄 정리(토큰 0) — 세무사님 지시: 의뢰인만 알던 때 만든 사건명·폴더명을, 서류로 확인되는 납세자로
// "고객명(납세자)_세목_업무유형" 규칙에 맞춘다(완료 사건 포함). 먼저 미리보기(dry-run)로 바뀔 목록·근거·이상 패턴을 보여 주고,
// [적용]을 누르면 work_updateCase로 납세자를 고친다 — 사건명·Drive 폴더명은 그 저장 안의 기존 규칙이 바꾼다(폴더ID 그대로).
// 대상: 납세자가 비었거나, 상속에서 납세자(피상속인)가 고객명(의뢰인=상속인)과 같은 사건. 근거 = 사건 폴더 서류(사망진단서·가족관계증명서·
// 분할협의서·증여 등기부·증여계약서 — 사건처리와 같은 규칙), 없으면 이미 낸 상속세 신고서의 피상속인 성명. 근거가 없으면 바꾸지 않고 "판단불가".
// 결과: 업무관리자/_납세자정리결과.json
// =========================================================
const TPF_STATE_PROP_ = 'TPF_RUN_STATE';
const TPF_RESULT_NAME_ = '_납세자정리결과.json';

function tpfCandidates_() {
  const sheet = work_getSheet_(), data = sheet.getDataRange().getValues(), col = work_colMap_(data[0]);
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const seMok = data[i][col.세목];
    if (!WORK_TAXPAYER_FIELD_BY_SEMOK_[seMok] || seMok === 'business') continue;
    const tp = String(data[i][col.납세자] || '').trim(), cust = String(data[i][col.고객명] || '').trim();
    if (!cust) continue;
    if (tp && !(seMok === 'inheritance' && tp === cust)) continue;
    out.push(String(data[i][col.id]));
  }
  return out;
}
// 한 사건 — 사건처리 처리개요 단계를 읽기 전용(akSandbox_)으로 돌려 서류로 확정되는 납세의무자를 얻는다
function tpfResolveOne_(caseId) {
  const real = akReadCase_(caseId);
  if (!real) return { id: caseId, error: '사건 없음' };
  const field = WORK_TAXPAYER_FIELD_BY_SEMOK_[real.세목];
  const row = { id: caseId, 사건명: real.사건명 || '', 고객명: real.고객명 || '', 세목: real.세목, 이전납세자: String(real.납세자 || '').trim() };
  if (!String(real.폴더ID || '').trim()) { row.판단불가 = '사건 폴더 없음'; return row; }
  let found = null;
  if (real.세목 !== 'transfer') {
    found = akSandbox_(caseId, function () {
      const c = akReadCase_(caseId);
      const lines = [], items = [];
      c.사건개요 = c.사건개요 || {};
      // 처리개요의 납세의무자 칸이 고객명으로 자동 채워졌을 수 있다(work_resolveTaxpayer_) — 판단은 서류로만 하도록 그 칸을 비우고 돌린다
      if (real.세목 === 'inheritance' && String(c.사건개요[field] || '').trim() === row.고객명) c.사건개요[field] = '';
      const cc = caseProcGiftInhFacts_(c, lines, items) || c;
      const v = String(((cc.사건개요 || {})[field]) || '').replace(/\([^)]*\)/g, '').trim();
      const f = ((caseProcLoad_(caseId).filled) || {})[field];
      return v && f && String(f.v || '').replace(/\([^)]*\)/g, '').trim() === v ? { v: v, src: f.src } : null;
    });
  }
  // 양도 — 매매계약서 규칙 정리의 매도인(검산된 계약서 기준, tc_ruleTransferFacts_)
  if (real.세목 === 'transfer') {
    try { const rf = tc_ruleTransferFacts_({ caseId: caseId }); const nm = String((rf && rf.sellerName) || '').trim(); if (nm && !/\*/.test(nm) && /^[가-힣]{2,5}$/.test(nm)) found = { v: nm, src: '매매계약서 매도인(서류 규칙 정리)' }; } catch (e) {}
  }
  // 서류 규칙으로 못 정했으면(상속) 이미 낸 상속세 신고서의 피상속인 성명 — 신고된 사실이라 이 용도엔 근거로 쓴다
  if (!found && real.세목 === 'inheritance') {
    caseProcFiles_(real).filter(function (f) { return /pdf|^image\//.test(String(f.mimeType || '')) && caseProcIsOutputDoc_(f.name) && /상속/.test(f.name); }).slice(0, 4).forEach(function (f) {
      if (found) return;
      const t = String(tc_docText_(f) || '');
      const m = /피\s*상\s*속\s*인[\s\S]{0,60}?성\s*명\s*([가-힣]{2,4})(?![가-힣*])/.exec(t);
      if (m && m[1] !== row.고객명) found = { v: m[1], src: '상속세 신고서(' + f.name + ') 피상속인 성명' };
    });
  }
  if (!found) { row.판단불가 = real.세목 === 'transfer' ? '매매계약서에서 매도인(양도인)을 확정하지 못함' : '서류에서 ' + (real.세목 === 'inheritance' ? '피상속인' : '수증자') + '을(를) 확정하지 못함'; return row; }
  if (found.v === row.이전납세자) { row.변경없음 = true; return row; }
  row.새납세자 = found.v; row.근거 = found.src;
  row.예상사건명 = row.고객명 + '(' + found.v + ')_' + (WORK_SEMOK_LABELS_[real.세목] || real.세목) + (real.업무유형 ? '_' + real.업무유형 : '');
  return row;
}
// {apply, reset} — 미리보기는 사건 수가 많으면 이어서(more). 적용은 미리보기 결과(저장된 것)로만 한다.
function taxpayerBulkFix_(body) {
  body = body || {};
  const props = PropertiesService.getScriptProperties();
  if (body.apply) {
    const last = tpfLastResult_();
    if (!last || !last.items) return { error: '먼저 미리보기를 해 주세요.' };
    const done = [], failed = [];
    last.items.filter(function (r) { return r.새납세자 && !r.적용; }).forEach(function (r) {
      const c = akReadCase_(r.id);
      if (!c || String(c.납세자 || '').trim() !== r.이전납세자) { failed.push({ id: r.id, 사건명: r.사건명, 사유: '미리보기 뒤 납세자가 바뀜 — 다시 미리보기' }); return; }
      const log = (Array.isArray(c.작업일지) ? c.작업일지 : []).concat([{ id: 'log_' + Date.now(), date: caseProcToday_(), text: '[납세자·사건명 일괄 정리] 납세자 ' + (r.이전납세자 || '(빈칸)') + ' → ' + r.새납세자 + ' (' + String(r.근거).slice(0, 80) + ') — 이전 사건명 ' + r.사건명, dueDate: '' }]);
      const up = work_updateCase({ id: r.id, 납세자: r.새납세자, 작업일지: log, 기대수정일: c.수정일 });
      if (up && up.success !== false) { r.적용 = true; r.이후사건명 = (up.case && up.case.사건명) || ''; r.폴더경고 = up.warning || ''; done.push(r); }
      else failed.push({ id: r.id, 사건명: r.사건명, 사유: (up && up.message) || '저장 실패' });
    });
    last.appliedAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    last.failed = failed;
    tpfSave_(last);
    return { ok: true, applied: done.length, failed: failed, result: last };
  }
  let st = null;
  if (!body.reset) { try { st = JSON.parse(props.getProperty(TPF_STATE_PROP_) || 'null'); } catch (e) { st = null; } }
  if (!st) st = { queue: tpfCandidates_(), items: [] };
  const started = Date.now();
  while (st.queue.length && Date.now() - started < 150000) {
    const id = st.queue.shift();
    try { st.items.push(tpfResolveOne_(id)); } catch (e) { st.items.push({ id: id, error: String(e && e.message || e).slice(0, 120) }); }
  }
  if (st.queue.length) { props.setProperty(TPF_STATE_PROP_, JSON.stringify(st)); return { ok: true, more: true, done: st.items.length, total: st.items.length + st.queue.length }; }
  props.deleteProperty(TPF_STATE_PROP_);
  // 이상 패턴 스스로 점검 — 같은 새 사건명, 한 고객에 여러 건, 대량 변경
  const chg = st.items.filter(function (r) { return r.새납세자; });
  const names = {}, warn = [];
  chg.forEach(function (r) { names[r.예상사건명] = (names[r.예상사건명] || 0) + 1; });
  Object.keys(names).forEach(function (n) { if (names[n] > 1) warn.push('같은 새 사건명 ' + names[n] + '건(' + n + ') — 저장 때 번호가 자동으로 붙음'); });
  if (chg.length > 30) warn.push('바뀔 사건이 ' + chg.length + '건으로 많음 — 목록을 꼭 확인');
  let audit = null;
  try { const a = work_auditCaseFolderNames({}); audit = { count: a.count, items: (a.items || []).slice(0, 40).map(function (x) { return { 현재: x.현재사건명, 제안: x.제안사건명 }; }) }; } catch (e) { audit = { error: String(e && e.message || e) }; }
  const result = { at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 대상: st.items.length, 변경: chg.length, 판단불가: st.items.filter(function (r) { return r.판단불가 || r.error; }).length, warn: warn, items: st.items, 사건명점검: audit };
  tpfSave_(result);
  return { ok: true, result: result };
}
function tpfSave_(obj) {
  try { const folder = getBusinessManagerFolder_(); if (!folder) return; const it = folder.getFilesByName(TPF_RESULT_NAME_); if (it.hasNext()) it.next().setContent(JSON.stringify(obj)); else folder.createFile(TPF_RESULT_NAME_, JSON.stringify(obj), 'application/json'); } catch (e) {}
}
function tpfLastResult_() {
  try { const folder = getBusinessManagerFolder_(), it = folder ? folder.getFilesByName(TPF_RESULT_NAME_) : null; return it && it.hasNext() ? JSON.parse(it.next().getBlob().getDataAsString('UTF-8') || 'null') : null; } catch (e) { return null; }
}
