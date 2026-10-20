// ============================================================
// [2026.10.18 사용자 소통] 사건처리 질문을 세액계산기 카드 순서로 묶고, 사용자 답을 기록 한 건으로 만든다 — 순수 함수만
//  세무사님 기준(원문 3): "불확실하거나 부족한 정보는 사용자와 소통을 통해서 보완해 나가야 하는데, 이 부분이 너무나 부족하다"
//  · 정보는 세액계산기 카드 순서대로 묻는다(양도: 사건 기본 → 양도인 → 양도계약 → 양도자산 → 취득 → 필요경비 → 특례 → 서류 요청 → 알림)
//  · 같은 칸(target)을 묻는 질문이 여럿이면 하나로 합친다 — 후보는 합치되 같은 값은 한 번만, 출처는 이어 붙인다(mergedIds에 합친 id)
//  · 칸 판별은 ask.target 모양으로 한다(calc:seller.*, calc:c0.totalPrice, calc:a0.acquisitionDate, ov:giftRelation, ih:pg_…, base, expenses, ihdebts …)
//  · 교차검증 질문(cxb:·cxg:·cxt:·cxai:)도 그 칸의 카드로 — target이 없는 cxt:(시간 순서 모순)는 문구 낱말로 카드를 고른다
//  화면(manage/aichat.html NXAI_CP_CARDS_ / nxAiCpCard_)에도 같은 표가 있다 — 서버가 card를 안 준 옛 결과도 화면에서 같은 규칙으로 묶는다. 한쪽을 고치면 다른 쪽도.
// ============================================================

const CXA_CARDS_ = {
  transfer: ['사건 기본', '양도인', '양도계약', '양도자산', '취득', '필요경비', '특례', '서류 요청', '알림'],
  gift: ['사건 기본', '수증자', '증여자·관계', '증여재산·평가', '채무인수', '10년 합산', '특례', '서류 요청', '알림'],
  inheritance: ['사건 기본', '피상속인', '상속인', '상속재산·평가', '금융재산', '채무·공과금', '장례비', '사전증여', '특례', '서류 요청', '알림'],
  other: ['사건 기본', '계산기 칸', '서류 요청', '알림']
};
const CXA_TAX_ = { transfer: 'transfer', '양도': 'transfer', '양도세': 'transfer', '양도소득세': 'transfer', gift: 'gift', '증여': 'gift', '증여세': 'gift', inheritance: 'inheritance', '상속': 'inheritance', '상속세': 'inheritance' };

function cxaTax_(t) { return CXA_TAX_[String(t || '').trim()] || 'other'; }
// 세목 칸이 비었거나 "불복"처럼 세 세목이 아니면 질문 칸 모양으로 짐작(양도 calc:·증여 ov:gift·상속 ih:) — 못 하면 other
function cxaGuessTax_(items) {
  const ts = (items || []).map(function (it) { return String(((it && it.ask) || {}).target || ''); });
  if (ts.some(function (t) { return /^calc:(seller|c\d|a\d|oa)\b/.test(t) || t === 'trTaxFee' || t === 'expenses'; })) return 'transfer';
  if (ts.some(function (t) { return /^ov:gift|^giftdeal$/.test(t); })) return 'gift';
  if (ts.some(function (t) { return /^ih:|^ihdiv:|^ihdebts$|^ov:(ihDeceased|상속인)/.test(t); })) return 'inheritance';
  return 'other';
}

// 양도 계산기 자산 칸(calc:a0.<k>) 이름 → 카드
function cxaTrAssetField_(k) {
  if (/Expenses?$/.test(k) && !/StandardPrice/.test(k)) return '필요경비';                // transferExpenses·oaTransferExpenses (…StandardPriceForExpense는 기준시가라 취득)
  if (/^(capex|capital|improvement)/i.test(k)) return '필요경비';
  if (/^transfer(Price|Date)$/.test(k) || /^buyer/.test(k)) return '양도계약';
  if (/^(oaResident|oaForeignTax)|^(donor|doneeOwn|giftReceived|residence|lived|original|decedent|converted)/.test(k)) return '특례'; // 이월과세·우회양도·거주·국외 세액공제
  if (/^(acquisition|acq[A-Z]|standardPrice|landPrice|buildingLandPrice|housePrice|p90|newHousingCompletion|approvalDate)/.test(k) || /^(transfer|registration)StandardPrice/.test(k)) return '취득'; // 취득일·취득가액·기준시가(공시가격)
  if (/^(asset|land|building|floor|share|ownership|ratio$|address|isOverseasAsset$|house|housing|exclusive|zone|use[A-Z])/.test(k)) return '양도자산';
  return '특례'; // 그 밖의 자산 칸(nh·uh·rp·lr·tw·hr… 특례 계산 칸, is… 체크)
}
// 문구 낱말로 카드 고르기 — target이 없는 교차검증 질문(cxt: 시간 순서 모순 등)에만 쓴다
function cxaCardByWords_(tax, s) {
  s = String(s || '');
  const rules = {
    transfer: [[/주소이력|거주기간|전입/, '특례'], [/양도인|매도인/, '양도인'], [/취득|사용승인|기준시가|공시가격/, '취득'], [/양도일|잔금|양도가액|매매대금|계약일|양수인|매수인/, '양도계약'], [/소재지|면적|주택|지번|지분/, '양도자산'], [/필요경비|중개|수수료|취득세/, '필요경비']],
    gift: [[/수증자/, '수증자'], [/증여자|관계/, '증여자·관계'], [/채무|담보|근저당/, '채무인수'], [/10년|합산|이전 증여/, '10년 합산'], [/증여일|증여재산|평가|감정|지분/, '증여재산·평가']],
    inheritance: [[/상속인 명단/, '상속인'], [/임대보증금 채무/, '채무·공과금'], [/상속재산 목록|상속재산 등기부/, '상속재산·평가'], [/주소이력|거주기간|전입/, '특례'], [/피상속인|사망|상속개시/, '피상속인'], [/상속인/, '상속인'], [/장례/, '장례비'], [/사전증여|이체/, '사전증여'], [/금융|예금|보험/, '금융재산'], [/채무|공과금|보증금/, '채무·공과금'], [/상속재산|평가|감정|등기|지분|분할/, '상속재산·평가']]
  }[tax] || [];
  for (let i = 0; i < rules.length; i++) if (rules[i][0].test(s)) return rules[i][1];
  return '';
}

// 질문 하나 → 카드 이름. 순서: target 모양 → 방식(mode) → id 머리 → (교차검증만) 문구 낱말 → 알림
function cxaCardOf_(it, tax) {
  const a = (it && it.ask) || {}, id = String((it && it.id) || ''), t = String(a.target || ''), mode = String(a.mode || '');
  let m;
  // 사건 기본(세목·납세자·법정일·폴더·업무유형)
  if (/^case:/.test(t) || mode === 'view' || mode === 'folder' || /^(basic|grasp|appeal):/.test(id) && !/^basic:날짜/.test(id)) return '사건 기본';
  // 서류(받았나요·자동 정리 원문 대조·어느 거래 서류인지·별건 하위폴더)
  if (mode === 'evidence' || mode === 'docok' || /^(ev|file|rf|evidence):/.test(id)) return '서류 요청';
  // 기준일(양도일·증여일·상속개시일) — 세목마다 그 날짜가 있는 카드
  if (t === 'base' || mode === 'base' || /^(base|ov:기준일|ref:date|basic:날짜|calc:base)/.test(id)) return { transfer: '양도계약', gift: '증여재산·평가', inheritance: '피상속인' }[tax] || '사건 기본';
  if (t === 'ov:사건분류') return tax === 'other' ? '계산기 칸' : '특례';
  if (tax === 'transfer') {
    if (/^calc:seller\./.test(t)) return '양도인';
    if ((m = /^calc:c\d+\.(.+)$/.exec(t))) return /expenses?$/i.test(m[1]) ? '필요경비' : '양도계약';
    if ((m = /^calc:a\d+\.(.+)$/.exec(t))) return cxaTrAssetField_(m[1]);
    if (t === 'calc:oa.share') return '양도자산';
    if (t === 'calc:oa.fxT') return '양도계약';
    if (t === 'calc:oa.fxA') return '취득';
    if (/^calc:oa\./.test(t)) return '특례';
    if (t === 'expenses' || t === 'trTaxFee' || mode === 'expenses') return '필요경비';
    if (t === 'trParcels' || t === 'trCompSplit') return '양도계약';
    if (/^calc:/.test(t)) return '특례';
  } else if (tax === 'gift') {
    if (t === 'giftdeal' || mode === 'giftdeal') return '수증자'; // 증여 내용(증여자·수증자·증여일·대상·금액)을 한 번에 — 첫 카드에서 묻는다
    if ((m = /^ov:(.+)$/.exec(t))) {
      const k = m[1];
      if (/^giftDonee/.test(k)) return '수증자';
      if (/^giftDonor|^giftRelation/.test(k)) return '증여자·관계';
      if (/^giftDebt/.test(k)) return '채무인수';
      if (/^giftPrior/.test(k)) return '10년 합산';
      if (/^gift|^증여재산/.test(k)) return '증여재산·평가';
    }
    if (/^gift:lien/.test(id)) return '채무인수';
    if (/^gift:memoprior/.test(id)) return '10년 합산';
    if ((m = /^calc:(?:.*\.)?([A-Za-z0-9]+)$/.exec(t))) return /^(sr|af|sl|pv|cb|ed)[A-Z]/.test(m[1]) ? '특례' : '증여재산·평가';
  } else if (tax === 'inheritance') {
    if ((m = /^ov:(.+)$/.exec(t))) {
      const k = m[1];
      if (/^ihDeceased|^ihDeath/.test(k)) return '피상속인';
      if (/^상속인|^ihReporter|^ihHeir/.test(k)) return '상속인';
      if (/^ih(Business|Farming)|^bc/.test(k)) return '특례';
      if (/^ihYearsSincePrior/.test(k)) return '사전증여';
    }
    if (/^ihdiv:/.test(t)) return '상속재산·평가';
    if (t === 'ihdebts' || mode === 'debts' || /^ih:debts/.test(id)) return '채무·공과금';
    if ((m = /^ih:(.+)$/.exec(t) || /^ih:(.+)$/.exec(id))) {
      const k = m[1];
      if (/^financial/.test(k)) return '금융재산';
      if (/^(funeral|niche|fn_|fnev)/.test(k)) return '장례비';
      if (/^pg_/.test(k)) return '사전증여';
      return '상속재산·평가'; // asset:… · ins_…(간주상속재산 보험금) · d15_…(§15 추정상속재산)
    }
  } else if (t) return '계산기 칸';
  if (/^cx[a-z]*:/.test(id)) { const w = cxaCardByWords_(tax, (a.label || '') + ' ' + (it.text || '')); if (w) return w; } // [밤 7바퀴 소통] 새 교차검증 질문(cxp 사람·지분, cxl 평가·보증금, cxw 합산 기간, cxv 값 대조)도 문구로 카드에
  return '알림';
}

// 같은 값인지 — 금액·숫자·날짜는 숫자만, 글자는 빈칸 빼고
function cxaNormV_(v, input) {
  const s = String(v == null ? '' : v).trim();
  if (input === 'money' || input === 'number' || input === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/[^\d]/g, '');
  return s.replace(/\s+/g, '').toLowerCase();
}

// 같은 칸을 묻는 질문 여럿 → 하나(첫 질문 자리에, 첫 질문 id로). 후보는 값이 같으면 한 번만 두고 출처를 이어 붙인다.
function cxaMerge_(list) {
  const first = list[0];
  const out = Object.assign({}, first, { ask: Object.assign({}, first.ask || {}) });
  const a = out.ask;
  const cands = [];
  const addCand = function (c, input) {
    if (!c) return;
    const n = cxaNormV_(c.v, input);
    const same = cands.filter(function (x) { return cxaNormV_(x.v, input) === n; })[0];
    if (!same) { cands.push(Object.assign({}, c)); return; }
    const srcs = String(same.src || '').split(' / ');
    String(c.src || '').split(' / ').forEach(function (s) { if (s && srcs.indexOf(s) === -1) srcs.push(s); });
    same.src = srcs.filter(String).join(' / ');
  };
  const opts = [];
  list.forEach(function (it) {
    const x = it.ask || {};
    (x.cands || []).forEach(function (c) { addCand(c, x.input || a.input); });
    (x.options || []).forEach(function (o) {
      const key = typeof o === 'object' && o ? String(o.value) + '|' + (o.decide || '') + '|' + (o.mode || '') : String(o);
      if (!opts.some(function (p) { return (typeof p === 'object' && p ? String(p.value) + '|' + (p.decide || '') + '|' + (p.mode || '') : String(p)) === key; })) opts.push(o);
    });
    if (x.withInput) a.withInput = true;
    if (!a.aiJudge && x.aiJudge) a.aiJudge = x.aiJudge;
    if (!a.input && x.input) a.input = x.input;
    if (!a.label && x.label) a.label = x.label;
  });
  if (cands.length) a.cands = cands;
  if (opts.length) a.options = opts;
  if (a.mode === 'input' && cands.length) a.mode = 'choose';
  // 교차검증·AI 판단 질문이 섞였으면 표시를 남긴다 — 화면이 "서류끼리 다름" 꼬리표·후보별 출처 서류를 그린다
  if (list.some(function (it) { return /^cx(b|g|t|ai):/.test(String(it.id || '')) || /^🧮 교차검증/.test(String(it.text || '')) || (it.ask && it.ask.aiJudge); })) a.xdocs = true;
  out.mergedIds = list.map(function (it) { return it.id; });
  out.text = String(first.text || '') + ' (같은 칸을 묻는 질문 ' + list.length + '개를 하나로 합침)';
  const others = list.slice(1).map(function (it) { return '· ' + String(it.text || '').slice(0, 300); });
  out.detail = [first.detail || '', '합친 질문:', others.join('\n')].filter(String).join('\n');
  return out;
}

// 질문 목록 → 카드 이름(card)·카드 순번(cardNo, 1부터)·전체 순번(ord)을 붙여 카드 순서로 정렬(같은 카드 안에서는 원래 순서)
//  items: [{id, kind, text, ask:{mode, target, label, cands, options}, detail}], 세목: transfer/gift/inheritance 또는 양도/증여/상속
//  돌려주는 배열은 새 배열(원래 질문 객체는 바꾸지 않음). 연결: 처리 단계 결과(res.items)를 화면에 돌려주기 직전에 부른다.
function cxAskOrder_(items, 세목) {
  const src = Array.isArray(items) ? items : [];
  let tax = cxaTax_(세목);
  if (tax === 'other') tax = cxaGuessTax_(src);
  const cards = CXA_CARDS_[tax];
  // 1) 같은 칸 합치기 — 고르기·입력(choose/input)끼리, 선택지(options)끼리만(방식이 다른 질문은 화면이 다르게 그려서 섞지 않음)
  const groups = {}, order = [];
  src.forEach(function (it, i) {
    const a = (it && it.ask) || {}, t = String(a.target || ''), mode = String(a.mode || '');
    const fam = mode === 'choose' || mode === 'input' ? 'ci' : mode === 'options' ? 'opt' : '';
    const key = t && fam ? t + '|' + fam : '#' + i;
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(it);
  });
  const merged = order.map(function (k) { const g = groups[k]; return g.length > 1 ? cxaMerge_(g) : Object.assign({}, g[0]); });
  // 2) 카드 붙이기 + 안정 정렬
  const withCard = merged.map(function (it, i) {
    let card = cxaCardOf_(it, tax);
    if (cards.indexOf(card) === -1) card = '알림';
    return { it: Object.assign(it, { card: card, cardNo: cards.indexOf(card) + 1 }), i: i };
  });
  withCard.sort(function (x, y) { return (x.it.cardNo - y.it.cardNo) || (x.i - y.i); });
  return withCard.map(function (x, n) { x.it.ord = n + 1; return x.it; });
}

// ============================================================
// [2026.10.18 사용자 소통 4번] 답 쌓기 — 사이드바에서 받은 답 하나를 기록 한 건으로(반복되면 GAS 규칙으로 바꿀 재료)
//  저장은 cxLogUserAnswer_가 한다(이 함수는 만들기만 — 서버·시트·드라이브를 건드리지 않음).
//  c = 사건(id·세목), body = 반영 요청({target, value, src, label, ans:{qid, how, nCands, pick, file}}), result = caseProcApply_ 결과
//  돌려줌: {at, caseId, 세목, target, label, value, src, 근거파일, 후보수, 고른후보(0부터, 없으면 -1), 출처종류, qid, ok}
// ============================================================
function cxAnswerRecord_(c, body, result) {
  c = c || {}; body = body || {};
  const ans = body.ans && typeof body.ans === 'object' ? body.ans : {};
  const src = String(body.src == null ? '' : body.src);
  let value = body.value;
  if (value != null && typeof value !== 'string') { try { value = JSON.stringify(value); } catch (e) { value = String(value); } }
  value = String(value == null ? '' : value).slice(0, 500);
  // 근거 파일: 화면이 보낸 것 → src의 "근거: 파일" → src 속 파일 이름 모양
  let file = String(ans.file || '');
  if (!file) { const m = /근거:\s*([^/]+?)\s*$/.exec(src); if (m) file = m[1].replace(/\(파일 \d+개\)$/, '').trim(); }
  if (!file) { const m = /([^\s/()'"‘’]+\.(?:pdf|jpe?g|png|heic|tiff?|xlsx?|xlsm|csv|hwpx?|docx?|txt|zip))/i.exec(src); if (m) file = m[1]; }
  const nC = Number(ans.nCands);
  const pick = Number.isFinite(Number(ans.pick)) && ans.pick !== '' && ans.pick != null ? Number(ans.pick) : -1;
  const how = String(ans.how || '');
  let kind;
  if (/🤖|AI 판단/.test(src)) kind = 'AI 판단 후보';
  else if (/교차검증/.test(src)) kind = '교차검증 후보';
  else if (how === '선택지' || how === '직접 입력') kind = how;
  else if (pick >= 0) kind = /세무사님 답|처리개요\(지금 값\)|지금 계산기/.test(src) ? '지금 값 유지' : '서류 후보';
  else if (how) kind = how; // '직접 입력' · '선택지' · '말로 답' · '체크 목록'
  else if (/세무사님 선택/.test(src)) kind = '선택지';
  else if (/세무사님 답\(사이드바\)/.test(src)) kind = '말로 답';
  else if (/세무사님 직접 입력/.test(src)) kind = '직접 입력';
  else kind = '기타';
  const now = function () {
    try { if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); } catch (e) {}
    return new Date().toISOString();
  };
  return {
    at: body.at || now(),
    caseId: String(c.id || body.caseId || ''),
    세목: String(c.세목 || ''),
    target: String(body.target || ''),
    label: String(body.label || ''),
    value: value,
    src: src.slice(0, 300),
    근거파일: file,
    후보수: Number.isFinite(nC) && nC >= 0 ? nC : 0,
    고른후보: pick,
    출처종류: kind,
    qid: String(ans.qid || ''),
    ok: !!(result && result.ok)
  };
}
