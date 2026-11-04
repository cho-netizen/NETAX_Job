// ============================================================
// [2026.11.04 큰일 ④ 판정 창] 세무사님 "권장안대로"(큰일다섯_계획서_20261104 ④)
//  화면 사건 작업의 「판정」 창 하나가 넥스와 같은 판정 묶음(JudgeMore.js JUDGE_MORE_ + 1세대1주택)을 쓴다.
//  칸 목록은 따로 적어 두지 않고 판정 함수 글에서 그때그때 뽑는다(새 묶음을 만들면 창에도 저절로 뜸):
//  p.칸 이름 · 쓰임새로 날짜/숫자/예·아니오/목록을 가름. 결과·장부 기록은 넥스와 같은 입구
//  (case_proc ledgerJudge → ledgerJudgeRun_ → judgeMoreRun_)로 — 여기는 목록·미리 채우기만.
// ============================================================
var JUDGE_GROUPS_ = [
  ['기한', /기한|제척|불복|확정신고|환급|세무조사|납부유예|부정행위|승계|가산세|시기/],
  ['상속증여', /상속|증여|유증|연고|한정승인|대납|차명|명의신탁|생활비|공익|거주자|국외|비상장|재해손실|제2차|부담부/],
  ['주택', /주택|다가구|부수토지|세대|중과|분양권|권리|임대/],
  ['토지', /농지|자경|토지|대토|축사|산지|개발제한|미등기|정비|청산|보상|경매|나눠|의제취득|양도여부|양도로|필요경비|환산|종중|단체/],
  ['감면', /감면|이월과세|과세이연|교환|통합|법인전환|이전|출자|특례/]
];
var JUDGE_CATALOG_MEMO_ = null;
// 판정 함수 이름 → 그 함수 글(별칭이 다른 함수를 감싸면 감싼 함수 글)
function judgeFnBody_(fn) {
  var body = String(fn), call = /(judge[A-Za-z0-9]+_)\(p\)/.exec(body);
  var name = (/^function\s+([\w$]+)/.exec(body) || [])[1] || '';
  if (!name && call) { name = call[1]; try { var g = this[name] || (typeof globalThis !== 'undefined' && globalThis[name]); if (typeof g === 'function') body = String(g); } catch (e) {} }
  return { name: name, body: body };
}
function judgeCatalog_() {
  if (JUDGE_CATALOG_MEMO_) return JUDGE_CATALOG_MEMO_;
  var byFn = [], seen = [];
  Object.keys(JUDGE_MORE_).forEach(function (k) {
    var fn = JUDGE_MORE_[k], i = seen.indexOf(fn);
    if (i === -1) { seen.push(fn); byFn.push({ fn: fn, 별칭: [k] }); } else byFn[i].별칭.push(k);
  });
  // 같은 판정 함수를 감싼 것(계약해제 = 양도여부 + 유형)은 따로 한 줄 — 감싼 함수를 기준으로 칸을 뽑는다
  var out = byFn.map(function (o) {
    var b = judgeFnBody_(o.fn), name = '', r = null;
    try { r = o.fn({}); name = r && r.묶음 || ''; } catch (e) {}
    name = name || o.별칭[0];
    var g = '기타';
    for (var q = 0; q < JUDGE_GROUPS_.length; q++) if (JUDGE_GROUPS_[q][1].test(name + ' ' + o.별칭.join(' '))) { g = JUDGE_GROUPS_[q][0]; break; }
    var 근거 = r && Array.isArray(r.근거) ? r.근거.slice(0, 4) : [];
    return { 묶음: o.별칭[0], 이름: name, 별칭: o.별칭, 무리: g, 칸: judgeFieldsOf_(b.body), 근거: 근거, 함수: b.name };
  });
  // 계산기 카드에서 물건·세대를 읽어 따로 도는 창 셋 — 판정 창에서 고르면 그 창을 연다(창 하나에서 모두 찾게)
  out.unshift({ 묶음: '1세대1주택', 이름: '1세대1주택 비과세', 별칭: ['1세대1주택', '비과세', '고가주택', '일시적 2주택'], 무리: '주택', 칸: [], 근거: ['소득세법 §89①3호', '시행령 §154~§156의2'], 따로창: 'taxRelief' });
  out.push({ 묶음: '비사업용 토지', 이름: '비사업용 토지 판정', 별칭: ['비사업용', '비사업용 토지'], 무리: '토지', 칸: [], 근거: ['소득세법 §104의3', '시행령 §168의6~§168의14'], 따로창: 'nonBizLand' });
  out.push({ 묶음: '대주주', 이름: '대주주 판정', 별칭: ['대주주', '주식 대주주'], 무리: '기타', 칸: [], 근거: ['소득세법 시행령 §157④⑤'], 따로창: 'majorShareholder' });
  JUDGE_CATALOG_MEMO_ = out;
  return out;
}
function judgeFieldsOf_(body) {
  var seen = {}, out = [], m;
  var re = /\bp\.([가-힣A-Za-z_][가-힣A-Za-z0-9_]*)|\bp\[['"]([^'"]+)['"]\]/g;
  while ((m = re.exec(body))) {
    var k = m[1] || m[2];
    if (seen[k] || /^(length|hasOwnProperty)$/.test(k)) continue;
    seen[k] = 1;
    var esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), t = '글';
    if (new RegExp('p\\.' + esc + '\\s*\\|\\|\\s*\\[\\]|Array\\.isArray\\(p\\.' + esc + '\\)').test(body)) t = '목록';
    else if (new RegExp('p\\.' + esc + '\\s*\\|\\|\\s*\\{\\}|typeof p\\.' + esc + " === 'object'|p\\." + esc + '\\.(?!length\\b)[가-힣A-Za-z_]').test(body)) t = '묶음';
    else if (new RegExp('jmYn_\\(p\\.' + esc + '\\)|p\\.' + esc + '\\s*==\\s*null\\s*\\?\\s*(true|false)\\s*:').test(body)) t = '예아니오';
    else if (new RegExp('jmYmd_\\(p\\.' + esc + '\\)').test(body) || (/(일|일자|날)$/.test(k) && !/(일수|일세대)/.test(k))) t = '날짜';
    else if (new RegExp('(famNum_|Number|jmNum_)\\(p\\.' + esc + '\\)').test(body) || /(가액|금액|액|채무|면적|지분|비율|율|연수|개월|세액|이익|주식수|보증금|년|층수|세대수|주택수|인원|명수)$/.test(k)) t = '숫자';
    var sub = [];
    if (t === '목록') {
      var mm = new RegExp('p\\.' + esc + '\\s*\\|\\|\\s*\\[\\]\\)?\\.\\w+\\(function \\((\\w+)').exec(body);
      if (mm) {
        var v = mm[1], chunk = body.slice(mm.index, mm.index + 900), r2 = new RegExp('\\b' + v + '\\.([가-힣A-Za-z_][가-힣A-Za-z0-9_]*)', 'g'), s2;
        while ((s2 = r2.exec(chunk))) if (sub.indexOf(s2[1]) === -1 && !/^(length)$/.test(s2[1])) sub.push(s2[1]);
      }
    } else if (t === '묶음') {
      var r4 = new RegExp('p\\.' + esc + '\\.([가-힣A-Za-z_][가-힣A-Za-z0-9_]*)', 'g'), s4;
      while ((s4 = r4.exec(body))) if (sub.indexOf(s4[1]) === -1 && !/^(length)$/.test(s4[1])) sub.push(s4[1]);
      var ma = new RegExp('(?:const|var|let)\\s+([가-힣A-Za-z_$][가-힣A-Za-z0-9_$]*)\\s*=\\s*p\\.' + esc + '(?![가-힣A-Za-z0-9_])').exec(body);
      if (ma) {
        var r3 = new RegExp('(?:^|[^가-힣A-Za-z0-9_$.])' + ma[1].replace(/\$/g, '\\$') + '\\.([가-힣A-Za-z_][가-힣A-Za-z0-9_]*)', 'g'), s3;
        while ((s3 = r3.exec(body))) if (sub.indexOf(s3[1]) === -1 && !/^(length)$/.test(s3[1])) sub.push(s3[1]);
      }
    }
    out.push(sub.length ? { 이름: k, 종류: t, 속칸: sub.slice(0, 12) } : { 이름: k, 종류: t });
  }
  return out;
}
// [2026.11.04 큰일 ⑩-1] 넥스만 쓰던 계산 도구(화면 계산기에 단추가 없던 것)를 판정 창 「계산」 무리로 — 칸은 넥스 도구 설명(DRIVE_TOOLS input_schema)에서 뽑고,
//  돌리기는 화면이 같은 엔진(taxcalc-engine) 함수를 직접 부른다(서버·토큰 0). 지방세 도구는 범위 밖이라 넣지 않음.
var JUDGE_CALC_TOOLS_ = [
  ['calculate_transfer_tax_with_carryover', '이월과세 양도세(배우자·직계존비속 증여 뒤 양도)'],
  ['calculate_special_rate_gift_tax_clawback', '특례 증여세 추징(창업자금·가업승계)'],
  ['calculate_share_swap_gain_recognition', '주식 교환 과세이연 뒤 양도차익'],
  ['calculate_holding_company_contribution_deferral', '지주회사 현물출자 과세이연'],
  ['calculate_project_reit_contribution_deferral', '프로젝트 리츠 현물출자 과세이연'],
  ['calculate_filing_penalty_reduction', '가산세 감면(기한 후·수정신고)'],
  ['check_correction_claim_eligibility', '경정청구 가능 여부·기한'],
  ['calculate_tax_exclusion_period', '부과제척기간 만료일'],
  ['calculate_donor_direct_transfer_deemed', '증여자 직접 양도 의제(우회 양도)'],
  ['calculate_national_forest_land_reduction', '국유림 산지 양도 감면'],
  ['calculate_long_term_rental_house_reduction', '장기임대주택 양도 감면'],
  ['calculate_restructuring_property_reduction', '구조조정 대상 부동산 감면'],
  ['calculate_inheritance_redivision_gift', '상속재산 재분할 증여'],
  ['calculate_forced_share_return', '유류분 반환'],
  ['calculate_gift_return', '증여재산 반환·재증여'],
  ['calculate_mortgaged_or_leased_property_value', '저당·임대 재산 평가 특례'],
  ['calculate_pre_ipo_stock_value', '상장 준비 주식 평가'],
  ['calculate_virtual_asset_value', '가상자산 평가']
];
function judgeCalcField_(k, p, req) {
  var d = String((p && p.description) || ''), t = (p && p.type) || 'string', kind = '글';
  if (t === 'number' || t === 'integer') kind = '숫자';
  else if (t === 'boolean') kind = '예아니오';
  else if (t === 'array') kind = '목록';
  else if (t === 'object') kind = '묶음';
  else if (/YYYY-MM-DD/.test(d)) kind = '날짜';
  var o = { 이름: k, 종류: kind, 설명: d.slice(0, 300) };
  if (p && p.enum) { o.종류 = '고르기'; o.보기 = p.enum.slice(0, 20); }
  if (req) o.꼭 = true;
  return o;
}
function judgeCalcCatalog_() {
  if (typeof DRIVE_TOOLS === 'undefined') return [];
  return JUDGE_CALC_TOOLS_.map(function (x) {
    var def = DRIVE_TOOLS.filter(function (t) { return t.name === x[0]; })[0]; if (!def) return null;
    var sc = def.input_schema || {}, props = sc.properties || {}, req = sc.required || [];
    var keys = Object.keys(props).sort(function (a, b) { return (req.indexOf(a) === -1) - (req.indexOf(b) === -1); });
    return { 묶음: 'calc:' + x[0], 이름: x[1], 별칭: [x[0]], 무리: '계산', 근거: [String(def.description || '').replace(/^\[[^\]]*\]\s*/, '').slice(0, 160)],
      따로창: 'calc', 엔진: x[0].replace(/_([a-z0-9])/g, function (_, c) { return c.toUpperCase(); }) + 'JS',
      칸: keys.map(function (k) { return judgeCalcField_(k, props[k], req.indexOf(k) !== -1); }) };
  }).filter(Boolean);
}
// 목록만(사건 없이도) — 화면 판정 창이 처음 열 때 한 번 받는다
function judgeListApi_() {
  return { ok: true, 판정: judgeCatalog_().map(function (x) { return { 묶음: x.묶음, 이름: x.이름, 별칭: x.별칭, 무리: x.무리, 칸: x.칸, 근거: x.근거, 따로창: x.따로창 || '' }; }).concat(judgeCalcCatalog_()) };
}
// 장부에서 칸 값 미리 채우기 — ① 같은 묶음을 전에 돌린 사실(L.judge) ② 장부 칸 이름이 판정 칸 이름과 같거나 품으면 그 값
//  (장부에서 확정·추정이 아닌 값은 「잠정」 표시 — 돌리면 판정 결과도 잠정으로 남는다)
function judgePrefill_(c, input) {
  var kind = String(input.묶음 || ''), cat = judgeCatalog_().filter(function (x) { return x.묶음 === kind || x.별칭.indexOf(kind) !== -1; })[0];
  if (!cat) return { ok: false, error: '없는 판정: ' + kind };
  var L = ledgerLoad_(c.id, false), out = {}, from = {};
  var oid = String(input.objectId || input.물건 || '');
  var prev = L.judge && (L.judge[cat.이름 + (oid ? '@' + oid : '')] || L.judge[cat.이름]);
  if (prev && prev.사실) Object.keys(prev.사실).forEach(function (k) { if (k === '유형' && cat.묶음 === '계약해제') return; out[k] = prev.사실[k]; from[k] = '지난 판정(' + String(prev.때 || '').slice(0, 10) + ')'; });
  var rows = L.rows || {};
  var labels = Object.keys(rows).map(function (p) { var l = ''; try { l = ledgerLabel_(p); } catch (e) {} return { p: p, raw: l || p, l: String(l || '').replace(/\s/g, ''), r: rows[p] }; });
  cat.칸.forEach(function (f) {
    if (out[f.이름] != null || f.종류 === '목록') return;
    var key = f.이름.replace(/\s/g, ''); if (key.length < 2) return;
    var ok = function (x) { return x.r && x.r.v != null && x.r.v !== '' && typeof x.r.v !== 'object'; };
    var hit = labels.filter(function (x) { return ok(x) && x.l === key; })[0] || labels.filter(function (x) { return ok(x) && x.l.indexOf(key) !== -1 && x.l.length <= key.length + 6; })[0];
    if (!hit) return;
    var v = hit.r.v; if (f.종류 === '예아니오' && typeof v === 'boolean') v = v ? '예' : '아니오';
    out[f.이름] = v;
    from[f.이름] = '장부 「' + hit.raw + '」' + (hit.r.state === '확정' || hit.r.state === '추정' ? '' : ' — 잠정');
  });
  return { ok: true, 묶음: cat.묶음, 이름: cat.이름, 값: out, 출처: from };
}

// [2026.11.04 넥스 운영 시험] 넥스 도구 find_judgment — 쟁점 낱말로 판정 묶음을 찾아 준다(토큰 0). 화면 판정 창 「찾기」와 같은 목록(judgeCatalog_).
//  가상사건 넷에서 넥스가 판정 묶음을 거의 안 쓰고(상속 7·증여 2·양도 0·가업승계 0) 계산기 체크 칸에 짐작으로 넣던 것 — 묶음 108개를 한 설명에 다 적어 둬도 못 찾았다.
function nxFindJudgment_(input) {
  var q = String((input && input.query) || '').trim();
  if (!q) return { ok: false, error: '찾을 낱말(query)이 비었습니다' };
  var hint = String((input && input.taxType) || '').trim();
  // 넥스가 쓰는 말 → 묶음 이름에 쓰인 말(미국·해외 → 국외·비거주자, 딸 → 자녀 …)
  var SYN = { 미국: '국외 비거주자', 해외: '국외 비거주자', 외국: '국외 비거주자', 송금: '국외', 이민: '비거주자 거주자', 딸: '자녀', 아들: '자녀', 손자: '손자녀', 손녀: '손자녀', 아버지: '직계존속', 어머니: '직계존속', 부모: '직계존속',
    집: '주택', 아파트: '주택', 빌라: '주택', 오피스텔: '주택여부', 전세: '보증금 임대', 월세: '임대', 빚: '채무', 대출: '채무 담보', 보증금: '채무', 농지: '자경 농지', 논: '농지', 밭: '농지', 공장: '사업 가업', 회사: '법인 가업', 주식: '주식 비상장',
    나눠내기: '연부연납', 분납: '연부연납', 대신내기: '물납', 기한: '신고기한 시기', 날짜: '시기', 포기: '상속포기 포기 상속인 법정상속분', 취소: '해제 반환', 무효: '해제 반환', 되돌림: '반환', 경매: '경매 공매', 압류: '체납',
    빌려준: '대여금 무상대출', 빌린: '대여금 무상대출', 빌려: '대여금 무상대출', 돈: '금전 대여금', 전세: '보증금 부담부증여 임대', 시골집: '농어촌주택 상속주택 공동상속', 동생: '형제자매', 형: '형제자매', 누나: '형제자매', 승계: '가업', 물려: '가업 상속', 사망: '상속', 돌아가: '상속', 팔: '양도', 매도: '양도', 처분: '양도' };
  var words = q.split(/[\s,·、]+/).map(function (w) { return w.trim(); }).filter(Boolean);
  words = words.reduce(function (acc, w) { acc.push(w); if (SYN[w]) acc = acc.concat(SYN[w].split(' ')); return acc; }, []).filter(function (w, i, a) { return w.length >= 2 && a.indexOf(w) === i; });
  if (!words.length) words = [q];
  var cat = judgeCatalog_();
  var scored = cat.map(function (c) {
    var names = [c.묶음, c.이름].concat(c.별칭 || []).join(' ');
    var basis = (c.근거 || []).join(' ');
    var fields = (c.칸 || []).map(function (k) { return k && (k.이름 || k.name || String(k)); }).join(' ');
    var s = 0, hit = 0;
    words.forEach(function (w) {
      var generic = /^(상속|증여|양도|세|세금|사건|때|경우|여부|판정|요건)$/.test(w); // 세목 낱말은 거의 모든 묶음에 있어 가볍게
      var ws = 0;
      if (names.indexOf(w) !== -1) ws = generic ? 1 : 6;
      else if (fields.indexOf(w) !== -1) ws = generic ? 1 : 3;
      else if (basis.indexOf(w) !== -1) ws = 1;
      else if (w.length >= 3) { // 낱말 조각(「배우자공제」→「배우자」·「공제」, 「상속주택」→「상속」·「주택」)
        var parts = [w.slice(0, 2), w.slice(-2), w.slice(0, 3), w.slice(-3)];
        if (parts.some(function (p) { return p.length >= 2 && !/^(상속|증여|양도)$/.test(p) && (names.indexOf(p) !== -1); })) ws = 2;
        else if (parts.some(function (p) { return p.length >= 2 && fields.indexOf(p) !== -1; })) ws = 1;
      }
      if (ws) hit++;
      s += ws;
    });
    if (hit >= 2) s += 2 * (hit - 1); // 여러 낱말이 같이 맞으면 그 묶음
    if (hint && c.무리 && c.무리.indexOf(hint.replace(/세$/, '')) !== -1) s += 1;
    return { c: c, s: s };
  }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
  var out = scored.map(function (x) {
    var c = x.c;
    return { 묶음: c.묶음, 이름: c.이름, 별칭: (c.별칭 || []).slice(0, 6), 무리: c.무리, 근거: (c.근거 || []).slice(0, 4),
      넣을칸: (c.칸 || []).slice(0, 14).map(function (k) { return k && k.이름 ? k.이름 + (k.종류 ? '(' + k.종류 + ')' : '') : String(k); }),
      부르는법: c.따로창 ? 'judge_tax_relief group=「' + c.묶음 + '」(계산기 카드 물건·세대로 돎)' : 'judge_tax_relief group=「' + c.묶음 + '」 facts={넣을칸…}' };
  });
  return { ok: true, 찾은수: out.length, 전체묶음수: cat.length, 판정: out,
    안내: out.length ? '맞는 묶음을 judge_tax_relief로 돌려 요건·잠정·할일·엔진칸을 받은 뒤 계산기를 돌려라. 모르는 사실 칸은 비워 두면 잠정으로 가른다.' : '맞는 묶음이 없음 — 다른 낱말로 다시 찾거나, 판정 도구가 없는 쟁점이면 report_capability_gap으로 알려라' };
}
