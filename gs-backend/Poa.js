// [2026-11-27] 세무조사 위임장·위임해지 — 넥스가 위임·해지를 처리하는 GAS 도구(넥스·세무사님 공용, 비용 0).
//  근거: 세무사님 11-27 「조사사무처리규정에 의한 위임장 양식을 확보하고 …」 → 「위임해지관련 양식도 확보하라. 그리고 해당 양식을 넥스시스템으로 구현하자.
//   즉 md파일로 작성하고 규정서식에 맞게 랜더링하자」 / 「그래야 넥스가 위임,해임을 처리할 수 있다」 → 계획서
//   총괄관리자/_기록/세무조사_위임장_넥스구현_계획서_20261127.html → 「권장대로 하자」(㉠ 규정서식 그대로·제출처만 사전통지서에서 ㉡ 관계 「세무조사 대리」
//   ㉢ 개인 위임자는 주민번호 앞 6자리와 뒤 첫 자리까지 ㉣ 설정에 사업장 주소·상호·자격 ㉤ 명단은 세무대리인 한 줄 ㉥ 위임장.md·위임해지.md, 조사가 둘 이상이면 _세목).
//  하는 일: 칸 채우기(설정 › 세무대리인 정보 / 고객관리 / 사건 폴더의 「세무조사 사전통지」 글자) → 사건 「보고서」 폴더에 md 저장(덮어쓰지 않음)
//   → 사건 장부 「세무대리 위임」 줄(poa.*)에 위임·해지 기록. 서식 모양은 화면 그리개(manage/mdrender.html 규정서식)가 그린다.
//  세무서에 팩스·메일로 보내지 않는다 — 서명·날인 뒤 제출은 세무사님(「제출했음」을 누르면 장부에 제출일).
//  입구: 화면 callGas('poa_make'|'poa_status'|'poa_submitted') — Code.js의 POA_ACTIONS_ 줄. 넥스: 사건 대화 도구 poa_form(AiLead.js).

var POA_ACTIONS_ = ['poa_make', 'poa_status', 'poa_submitted'];
function poa_dispatch_(body) {
  body = body || {};
  if (!body.caseId) return { ok: false, error: '사건(caseId)이 없습니다.' };
  switch (body.action) {
    case 'poa_make': return poaMake_(String(body.caseId), { revoke: !!body.revoke, detail: body.detail, overwrite: !!body.overwrite, by: '세무사님' });
    case 'poa_status': return poaStatus_(String(body.caseId), true);
    case 'poa_submitted': return poaSubmitted_(String(body.caseId), { revoke: !!body.revoke, date: body.date });
  }
  return { ok: false, error: '알 수 없는 작업: ' + body.action };
}

// 사건 장부 칸 — 「세무대리 위임」 묶음
var POA_LEDGER_ = {
  office: { path: 'poa.office', label: '세무대리 위임 — 조사관서' },
  tax: { path: 'poa.taxItem', label: '세무대리 위임 — 조사세목' },
  start: { path: 'poa.startDate', label: '세무대리 위임 — 조사 시작일' },
  end: { path: 'poa.endDate', label: '세무대리 위임 — 조사 종료일' },
  agent: { path: 'poa.agentName', label: '세무대리 위임 — 세무대리인' },
  grant: { path: 'poa.grantDate', label: '세무대리 위임 — 위임일' },
  file: { path: 'poa.file', label: '세무대리 위임 — 위임장 파일' },
  submit: { path: 'poa.submitDate', label: '세무대리 위임 — 위임장 제출일' },
  revoke: { path: 'poa.revokeDate', label: '세무대리 위임 — 해지일' },
  revokeFile: { path: 'poa.revokeFile', label: '세무대리 위임 — 위임해지 파일' },
  revokeSubmit: { path: 'poa.revokeSubmitDate', label: '세무대리 위임 — 위임해지 제출일' }
};

function poaToday_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); }
function poaDot_(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '')); return m ? m[1] + '. ' + Number(m[2]) + '. ' + Number(m[3]) + '.' : ''; }
function poaNeed_(what) { return '⚠[확인필요: ' + what + ']'; }

// ── 사전통지서 글자 읽기(순수 함수 — 시험은 tools/poa-check.js) ──
//  국세기본법 시행규칙 별지 제54호 서식(세무조사 사전 통지)과 같이 온 위임장·청렴서약서 글에서
//  조사관서·세목·조사기간·담당 과(반)·전화를 읽는다. 못 읽은 칸은 비운다(지어 넣지 않음).
function poaNoticeParse_(text) {
  var t = String(text || '');
  var flat = t.replace(/[ \t 　]+/g, ' ');
  var out = { office: '', tax: '', start: '', end: '', dept: '', tel: '', taxpayer: '', fax: '', mail: '' };
  var pad = function (n) { return ('0' + Number(n)).slice(-2); };
  var ymd = function (y, m, d) { return y + '-' + pad(m) + '-' + pad(d); };
  // 관서 — 「○○세무서장」(끝 서명란·귀하)이 가장 믿을 만하다
  var m = /([가-힣]{2,10}(?:지방국세청|세무서))\s*장/.exec(flat) || /^\s*([가-힣]{2,10}(?:지방국세청|세무서))\s*$/m.exec(t);
  if (m) out.office = m[1];
  // 조사기간 — 같이 온 위임장·청렴서약서 문장 「2026.08.12.부터 2026.08.31.까지」가 먼저, 없으면 통지서 「조사 기간」 칸
  m = /((?:19|20)\d{2})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})\s*\.?\s*부터\s*((?:19|20)\d{2})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})\s*\.?\s*까지/.exec(flat);
  if (m) { out.start = ymd(m[1], m[2], m[3]); out.end = ymd(m[4], m[5], m[6]); }
  else {
    m = /조\s*사\s*기\s*간[^\d]{0,20}((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*[~∼\-]?\s*((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(flat);
    if (m) { out.start = ymd(m[1], m[2], m[3]); out.end = ymd(m[4], m[5], m[6]); }
  }
  // 세목 — 「…까지 실시하는 양도소득세조사」, 없으면 통지서 앞부분의 세목 낱말 하나
  m = /까지\s*실시하는\s*([가-힣]{2,12}세)\s*조사/.exec(flat);
  if (m) out.tax = m[1];
  else {
    var head = t.split(/\r?\n/).slice(0, 30).join('\n');
    var tm = head.match(/(양도소득세|종합소득세|증여세|상속세|부가가치세|법인세|원천세|개별소비세|자금출처)/g);
    if (tm && tm.length) out.tax = tm[0];
  }
  // 담당 과·반 — 같이 온 위임장 안내 「안양세무서 재산법인세과 재산1반」이 먼저, 없으면 「재산법인세과 담당자」·「(조사팀 : 재산1반 …)」
  m = /(?:세무서|지방국세청)\s+([가-힣]{2,12}과)(?:\s+([가-힣]{0,8}\d{1,2}\s*[반팀]))?/.exec(flat);
  if (m) out.dept = m[1] + (m[2] ? ' ' + m[2].replace(/\s+/g, '') : '');
  else {
    m = /([가-힣]{2,12}과)\s*담당자/.exec(flat);
    if (m) out.dept = m[1];
    var tm2 = /조사팀\s*[:：]\s*([가-힣]{0,8}\d{1,2}\s*[반팀])/.exec(flat);
    if (tm2) out.dept = (out.dept ? out.dept + ' ' : '') + tm2[1].replace(/\s+/g, '');
  }
  // 전화 — 「담당자 ○○○(전화: 031-…)」가 먼저
  m = /담당자\s*[가-힣]{2,4}\s*\(\s*전화\s*[:：]?\s*(0\d{1,2}-\d{3,4}-\d{4})/.exec(flat) || /전화\s*[:：]?\s*(0\d{1,2}-\d{3,4}-\d{4})/.exec(flat);
  if (m) out.tel = m[1];
  m = /수신자\s*([가-힣]{2,5})/.exec(flat); if (m) out.taxpayer = m[1];
  m = /팩스\s*\(?\s*[:：]?\s*(0\d{2,3}-?\d{3,4}-?\d{4})/.exec(flat); if (m) out.fax = m[1];
  m = /([A-Za-z0-9._-]+@nts\.go\.kr)/.exec(flat); if (m) out.mail = m[1];
  return out;
}

// 주민번호 → 앞 6자리와 뒤 첫 자리까지(㉢)
function poaMaskRrn_(rrn) {
  var d = String(rrn || '').replace(/[^\d]/g, '');
  return d.length >= 7 ? d.slice(0, 6) + '-' + d.charAt(6) + '******' : '';
}

// 사건 폴더에서 사전통지서 찾기 — 이름에 「사전통지」·「사전 통지」, 여럿이면 납세자·고객 이름이 든 것
function poaFindNotice_(c) {
  var files = []; try { files = (typeof caseProcNexAllFiles_ === 'function' ? caseProcNexAllFiles_(c) : []) || []; } catch (e) { return { error: '사건 폴더를 보지 못했습니다: ' + String(e && e.message || e).slice(0, 80) }; }
  var cand = files.filter(function (f) { return /사전\s*통지/.test(String(f.name || '')) && !/\.(md|json)$/i.test(String(f.name || '')); });
  if (!cand.length) return { none: true };
  var who = [c.납세자, c.고객명].map(function (x) { return String(x || '').replace(/\(.*$/, '').trim(); }).filter(function (x) { return x.length >= 2; });
  var pick = null;
  who.some(function (w) { pick = cand.filter(function (f) { return String(f.name).indexOf(w) !== -1; })[0] || null; return !!pick; });
  if (!pick) pick = cand[0];
  var text = ''; try { text = String(tc_docText_(pick) || ''); } catch (e) { return { file: pick.name, error: '글을 읽지 못했습니다: ' + String(e && e.message || e).slice(0, 80) }; }
  return { file: (pick.dir ? pick.dir + '/' : '') + pick.name, text: text, others: cand.length - 1 };
}

// 위임자(고객관리) — 성명·주소·전화·사업자번호·주민번호(가림)
function poaClient_(c) {
  var out = { name: String(c.납세자 || c.고객명 || '').replace(/\(.*$/, '').trim(), addr: '', phone: '', bizNo: '', rrn: '' };
  try {
    var sheets = client_getSheets_(), data = sheets.clients.getDataRange().getValues(), col = client_colMap_(data[0], CLIENT_HEADERS);
    var row = null;
    for (var i = 1; i < data.length; i++) { if (c.고객ID && String(data[i][col.id]) === String(c.고객ID)) { row = data[i]; break; } }
    if (!row && out.name) { var same = []; for (var j = 1; j < data.length; j++) if (String(data[j][col.성명]).trim() === out.name) same.push(data[j]); if (same.length === 1) row = same[0]; }
    if (row) {
      out.name = String(row[col.성명] || out.name).trim();
      out.addr = String(row[col.주소] || '').trim();
      out.phone = String(row[col.전화번호] || '').trim();
      out.bizNo = String(row[col.사업자번호] || '').trim();
      if (col.주민등록번호암호화 !== undefined && row[col.주민등록번호암호화]) out.rrn = poaMaskRrn_(client_decryptRRN_(row[col.주민등록번호암호화]));
    }
  } catch (e) { out.err = String(e && e.message || e).slice(0, 80); }
  return out;
}

// 세무대리인(설정 › 세무대리인 정보)
function poaAgent_() {
  var s = {}; try { s = getTaxAgentSettings_() || {}; } catch (e) { s = {}; }
  var birth = String(s.taxAgentBirth || '').replace(/[^\d]/g, '');
  return {
    name: String(s.taxAgentName || '').trim(), phone: String(s.taxAgentPhone || '').trim(),
    birth: birth.length === 8 ? birth.slice(0, 4) + '.' + birth.slice(4, 6) + '.' + birth.slice(6) : String(s.taxAgentBirth || '').trim(),
    bizNo: String(s.taxAgentBizNo || '').trim(), addr: String(s.taxAgentAddr || '').trim(),
    firm: String(s.taxAgentFirm || '').trim(), qual: String(s.taxAgentQual || '').trim() || '세무사'
  };
}

// 장부의 「세무대리 위임」 줄 → 상태
function poaStatus_(caseId, fresh) {
  var L = null; try { L = ledgerLoad_(caseId, !!fresh); } catch (e) { return { ok: false, error: '사건 장부를 읽지 못했습니다: ' + String(e && e.message || e).slice(0, 80) }; }
  var rows = (L && L.rows) || {};
  var g = function (k) { var r = rows[POA_LEDGER_[k].path]; return r && r.v !== undefined && r.v !== null ? String(r.v) : ''; };
  var st = g('revoke') ? '해지됨' : g('grant') ? '위임 중' : '없음';
  var todo = '';
  if (st === '위임 중' && !g('submit')) todo = '위임장 서명·제출';
  if (st === '해지됨' && !g('revokeSubmit')) todo = '위임해지 서명·제출';
  return { ok: true, 상태: st, 조사관서: g('office'), 조사세목: g('tax'), 조사시작일: g('start'), 조사종료일: g('end'), 세무대리인: g('agent'),
    위임일: g('grant'), 위임장: g('file'), 위임장제출일: g('submit'), 해지일: g('revoke'), 위임해지: g('revokeFile'), 위임해지제출일: g('revokeSubmit'), 할일: todo };
}

// 칸 값 → md(규정 문장은 화면 그리개가 씀 — 여기서는 칸만)
function poaBuildMd_(revoke, d) {
  var V = function (x, need) { return String(x || '').trim() || (need ? poaNeed_(need) : ''); };
  var L = [];
  L.push(revoke ? '<!-- 서식: 조사사무처리규정 별지 제13-1호 위임해지 -->' : '<!-- 서식: 조사사무처리규정 별지 제13호 위임장 -->');
  L.push('<!-- GAS가 채움(' + poaToday_() + ') — 세무대리인=설정 › 세무대리인 정보, 위임자=고객관리, 조사=' + (d.src || '사건 장부') + '. ⚠ 칸은 채운 뒤 지웁니다. 문장은 화면이 규정 문구 그대로 씁니다. -->');
  L.push('# ' + (revoke ? '위임해지' : '위임장'), '');
  L.push('## 세무대리인');
  L.push('- 성명: ' + V(d.ag.name, '세무대리인 성명 — 설정 › 세무대리인 정보'));
  L.push('- 전화번호: ' + V(d.ag.phone, '전화번호 — 설정'));
  L.push('- 생년월일: ' + V(d.ag.birth, '생년월일 — 설정'));
  L.push('- 사업자등록번호: ' + V(d.ag.bizNo, '사업자등록번호 — 설정'));
  L.push('- 사업장소재지(주소): ' + V(d.ag.addr, '사업장 주소 — 설정'));
  L.push('- 자격: ' + V(d.ag.qual || '세무사'));
  L.push('- 관계: 세무조사 대리', '');
  L.push(revoke ? '## 해지 내용' : '## 위임 내용');
  L.push('- 조사관서: ' + V(d.office, '조사관서 — 예: 안양세무서'));
  L.push('- 조사기간: ' + (d.start && d.end ? poaDot_(d.start) + ' ~ ' + poaDot_(d.end) : poaNeed_('조사기간 — 시작일 ~ 종료일')));
  L.push('- 조사세목: ' + V(d.tax, '조사세목'));
  L.push((revoke ? '- 해지일: ' : '- 위임일: ') + poaDot_(d.date), '');
  L.push('## 위임자');
  L.push('- 사업장소재지(주소): ' + V(d.pr.addr, '위임자 주소 — 고객관리'));
  L.push('- 법인명(상호): ' + V(d.pr.firm));
  L.push('- 사업자(주민)등록번호: ' + V(d.pr.no, '등록번호 — 고객관리'));
  L.push('- 대표자(성명): ' + V(d.pr.name, '위임자 성명'), '');
  if (!revoke) {
    L.push('## 제출처');
    L.push('- 조사과: ' + V(d.dept, '조사과·반 — 사전통지서'));
    L.push('- 전화: ' + V(d.tel, '조사과 전화 — 사전통지서'), '');
  }
  L.push('## 세무대리인 명단');
  L.push('| 순번 | 소속 | 직위/직책 | 성명 | 생년월일 | 자격 |');
  L.push('|---|---|---|---|---|---|');
  L.push('| 1 | ' + V(d.ag.firm, '소속(상호) — 설정') + ' | 대표 | ' + V(d.ag.name, '성명') + ' | ' + V(d.ag.birth, '생년월일') + ' | ' + V(d.ag.qual || '세무사') + ' |');
  return L.join('\n') + '\n';
}

// 만들기 — opts { revoke, detail(같은 사건에 조사가 둘 이상일 때 세목 등), overwrite, by('세무사님'|'넥스') }
function poaMake_(caseId, opts) {
  opts = opts || {};
  var revoke = !!opts.revoke;
  var c = null; try { c = akReadCase_(caseId); } catch (e) { c = null; }
  if (!c) return { ok: false, error: '사건을 찾지 못했습니다.' };
  var st = poaStatus_(caseId, true);
  var ag = poaAgent_(), cl = poaClient_(c);
  var d = { ag: ag, pr: { addr: cl.addr, firm: '', no: cl.bizNo || cl.rrn, name: cl.name }, date: poaToday_(), src: '' };
  var notice = null, warn = [];
  if (revoke && st.ok && st.상태 !== '없음') {
    // 해지는 장부에 남은 위임 기록(조사·대리인)을 그대로 이어 쓴다
    d.office = st.조사관서; d.tax = st.조사세목; d.start = st.조사시작일; d.end = st.조사종료일; d.src = '사건 장부 「세무대리 위임」';
    if (st.상태 === '해지됨') warn.push('이미 해지된 위임입니다(해지일 ' + st.해지일 + ') — 위임해지를 다시 만듭니다.');
  }
  if (!d.office || !d.start || !d.tax) {
    notice = poaFindNotice_(c);
    if (notice && notice.text) {
      var p = poaNoticeParse_(notice.text);
      d.office = d.office || p.office; d.tax = d.tax || p.tax; d.start = d.start || p.start; d.end = d.end || p.end;
      d.dept = p.dept; d.tel = p.tel;
      d.src = d.src ? d.src + ' + ' + notice.file : notice.file;
      if (p.taxpayer && cl.name && p.taxpayer !== cl.name) warn.push('사전통지서 수신자(' + p.taxpayer + ')와 위임자(' + cl.name + ')가 다릅니다 — 확인해 주세요.');
      if (notice.others) warn.push('사건 폴더에 사전통지서가 ' + (notice.others + 1) + '개 있어 「' + notice.file + '」을 읽었습니다.');
    } else if (notice && notice.none) warn.push('사건 폴더에 「세무조사 사전통지」 파일이 없어 조사관서·기간·세목·제출처를 비워 둡니다.');
    else if (notice && notice.error) warn.push(notice.error);
  }
  if (revoke && st.ok && st.상태 === '없음') warn.push('장부에 위임 기록이 없습니다 — 위임장 없이 위임해지를 만듭니다.');
  var md = poaBuildMd_(revoke, d);
  var tgt = reportSaveTarget_(c, { kind: revoke ? '위임해지' : '위임장', detail: opts.detail || '' });
  if (!tgt.ok) return { ok: false, error: tgt.error || '저장 자리를 정하지 못했습니다.' };
  var ex = tgt.folder.getFilesByName(tgt.name);
  if (ex.hasNext() && !opts.overwrite) {
    var f0 = ex.next();
    return { ok: false, exists: true, fileId: f0.getId(), name: tgt.name, message: '「보고서」 폴더에 ' + tgt.name + '이(가) 이미 있습니다 — 덮어쓰지 않았습니다. 같은 사건에 조사가 둘 이상이면 세부명칭(예: 양도소득세)을 붙여 다시 만드세요.' };
  }
  var file;
  if (ex.hasNext() || (opts.overwrite && tgt.folder.getFilesByName(tgt.name).hasNext())) { file = tgt.folder.getFilesByName(tgt.name).next(); file.setContent(md); }
  else file = tgt.folder.createFile(Utilities.newBlob(md, 'text/markdown', tgt.name));
  // 장부 기록 — GAS(규칙). 새 위임이면 앞 위임의 해지·제출 기록을 거둔다
  var ops = [], add = function (k, v) { if (String(v || '').trim()) ops.push({ path: POA_LEDGER_[k].path, value: v, kind: '규칙', by: 'GAS', sure: '확실', label: POA_LEDGER_[k].label, file: tgt.name, why: (revoke ? '위임해지' : '위임장') + ' 만듦(' + (opts.by || 'GAS') + ')' }); };
  if (!revoke) {
    add('office', d.office); add('tax', d.tax); add('start', d.start); add('end', d.end); add('agent', ag.name); add('grant', d.date); add('file', tgt.name);
    ['submit', 'revoke', 'revokeFile', 'revokeSubmit'].forEach(function (k) { ops.push({ drop: true, path: POA_LEDGER_[k].path, by: 'GAS' }); });
  } else {
    add('revoke', d.date); add('revokeFile', tgt.name);
    ops.push({ drop: true, path: POA_LEDGER_.revokeSubmit.path, by: 'GAS' });
  }
  var lr = null; try { lr = ledgerBatch_(caseId, ops); } catch (e) { warn.push('장부 기록 실패: ' + String(e && e.message || e).slice(0, 80)); }
  if (lr && lr.errors && lr.errors.length) warn.push('장부 기록 중 오류: ' + lr.errors.slice(0, 2).join(' / '));
  var need = (md.match(/⚠\[확인필요: ([^\]]+)\]/g) || []).map(function (x) { return x.replace(/^⚠\[확인필요: |\]$/g, ''); });
  return { ok: true, fileId: file.getId(), name: tgt.name, folderId: tgt.folder.getId(), revoke: revoke, 확인할칸: need, 알림: warn, 읽은서류: d.src || '', 상태: poaStatus_(caseId),
    안내: (revoke ? '위임해지' : '위임장') + '을 사건 「보고서」 폴더에 ' + tgt.name + '(으)로 저장했습니다' + (need.length ? ' — ⚠ 칸 ' + need.length + '곳은 채워야 합니다' : '') + '. 서명·날인 뒤 제출은 세무사님이 하시고 「제출했음」을 누르시면 됩니다(시스템은 세무서에 보내지 않음).' };
}

// 제출했음 — 세무사님이 서명·날인해 세무서에 낸 날(세무사님 값)
function poaSubmitted_(caseId, opts) {
  opts = opts || {};
  var st = poaStatus_(caseId, true);
  if (!st.ok) return st;
  var revoke = !!opts.revoke;
  if (!revoke && st.상태 !== '위임 중') return { ok: false, error: '위임 중인 위임장이 없습니다(지금: ' + st.상태 + ').' };
  if (revoke && st.상태 !== '해지됨') return { ok: false, error: '만든 위임해지가 없습니다(지금: ' + st.상태 + ').' };
  var k = revoke ? 'revokeSubmit' : 'submit';
  var date = String(opts.date || '').trim() || poaToday_();
  var r = ledgerSet_(caseId, { path: POA_LEDGER_[k].path, value: date, kind: '세무사님', by: '세무사님', label: POA_LEDGER_[k].label, why: '「제출했음」' });
  if (!r || r.ok === false) return { ok: false, error: (r && (r.error || r.message)) || '장부에 적지 못했습니다.' };
  return { ok: true, 상태: poaStatus_(caseId) };
}

// 넥스 도구 poa_form — do: make(위임장) | revoke(위임해지) | status | submitted(세무사님이 제출했다고 하셨을 때만)
function poaNexTool_(caseId, input) {
  input = input || {};
  var d = String(input.do || 'status');
  if (d === 'status') return poaStatus_(caseId, true);
  if (d === 'make') return poaMake_(caseId, { detail: input.detail, by: '넥스' });
  if (d === 'revoke') return poaMake_(caseId, { revoke: true, detail: input.detail, by: '넥스' });
  if (d === 'submitted') return poaSubmitted_(caseId, { revoke: !!input.revoke, date: input.date });
  return { ok: false, error: 'do는 make·revoke·status·submitted 중 하나입니다.' };
}
