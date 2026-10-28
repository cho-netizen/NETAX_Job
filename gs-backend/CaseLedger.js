// ============================================================
// CaseLedger.js — 사건 장부: 사건의 모든 사실을 적는 단일 저장소 [2026.10.28 신설]
// ------------------------------------------------------------
// 세무사님 원문(10-28): "확보할 수 있는 정보를 최대한 확보하고, 확보된 정보를 최대한 활용해서 사건처리를 하자는 것이고,
//   부족한 정보는 물어보거나 확보할 증빙으로 분류하자는 거 아닌가? 확인되지 않은 정보중에 추정치나 가정치를 넣어서 진행할 수도 있고 말야."
// 세무사님 원문(10-19): "변수담당은 ai이고 상수담당은 gas라고 생각하자."
// 세무사님 원문(10-15): 수집·반영·소통 3대 약점 → "사실 장부·칸 연결·한곳에서 묻기" 구조 — 그동안 만들지 않고 저장소 7곳(trCalc·trAns·filled·remaining·decisions·valueHist·사건개요)에
//   땜질만 하다 10-28 김향숙 사건(물건 1건·서류 7장)이 실패("그걸 알면서도 안 만들었다고?"). 이 파일이 그 장부다.
//
// 구조 — 계산기 칸 하나 = 장부 한 줄. 칸 경로는 세액계산기 입력 경로 그대로(서식이 기준):
//   seller.name · seller.regNo · seller.address · seller.multiHouseCount · seller.isTransferorResident
//   c0.date · c0.totalPrice · c0.transferCause · c0.buyer.name · c0.buyer.regNo · c0.buyer.relation   (c1·c2… 계약이 여럿일 때)
//   a0.assetLocation · a0.assetKind · a0.assetType · a0.assetDong · a0.assetHo · a0.assetArea · a0.acquisitionDate · a0.acquisitionPrice · a0.contract(이 자산이 걸린 계약 c0…)
//   a0.isOneHouseOneFamily · a0.isNonBusinessLand · a0.isUnregisteredTransfer · a0.acquisitionStandardPriceForExpense · a0.transferStandardPriceForConversion …(계산기 자산 카드 칸 전부)
//   costs({acq:[{label,amount,file,date}], tr:[…]}) · taxfee · 사건분류 · 기준일
//   doc:<파일 이름>.role — 서류의 역할(양도계약서·취득계약서·등기부·전소유자 분양계약서·영수증·간편계산서·기타): 사건 뼈대. 넥스가 읽어 정하고, 애매하면 물어볼 것으로.
// 줄: { v, label, src:{kind, who, file, page, quote}, sure, state, ask, cands, at, hist[] }
//   src.kind: 세무사님 | 넥스 | 서류 | 규칙 | 추정 | 계산      sure: 확실 | 애매 | 모름
//   state: 확정 | 추정 | 물어볼것 | 증빙받을것 | 보류 | 무시
// 쓰는 길 하나(ledgerSet_) — 규칙:
//   ① 세무사님이 정한 값은 아무도 덮지 않는다(넥스는 "지금 값·서류 값"만 말씀드린다). 세무사님만 바꾼다.
//   ② 넥스가 정한 값은 세무사님·넥스만 바꾼다(서류·규칙 결과가 뒤에 와도 덮지 않는다).
//   ③ 서류·규칙 값은 더 확실한 서류·규칙, 넥스, 세무사님이 덮는다.
//   ④ 서류·규칙이 "애매·모름"이면 값을 정하지 않고 후보와 함께 "물어볼것"으로 선다 — 혼자 정하지 않는다(10-18 "불확실하면 소통으로 보완").
//   ⑤ 고르기 칸(과세대상 구분·양수인 관계·자산 종류·양도 원인·주택 수·예/아니오)은 코드값만 받는다. 글은 코드로 바꾸고, 못 바꾸면 거절(10-27 긴급 "주택(주거용 오피스텔)" 글이 들어가 세액 0원).
//   ⑥ 값이 들어오면 그 칸의 "물어볼것·증빙받을것"은 그 자리에서 풀린다(질문 목록이 따로 없으니 어긋날 수 없다).
//   ⑦ 추정은 상태 "추정"으로 넣고 계산을 돌린다. 검토서 "추가로 확인할 사항"에 추정·증빙받을것·보류 줄이 그대로 들어간다.
// 읽는 길 하나 — 계산기 상태(ledgerCalcState_)·질문 목록(ledgerQuestions_)·검토서 메모(ledgerReviewNotes_)·화면 표(ledgerView_)는 전부 장부에서 뽑는다.
// 저장: 총괄관리자\_사건장부\<사건ID>.json (잠금 안에서 읽고-고치고-쓴다). 옛 저장소는 ledgerImportLegacy_로 한 번 옮겨 오고 그 뒤엔 보지 않는다.
// ============================================================

var LEDGER_FOLDER_ = '_사건장부';
var LEDGER_STATES_ = ['확정', '추정', '물어볼것', '증빙받을것', '보류', '무시'];
var LEDGER_KINDS_ = ['세무사님', '넥스', '서류', '규칙', '추정', '계산'];
var LEDGER_SURE_ = ['확실', '애매', '모름'];
// 값 주인 우열 — 같은 급 이상만 덮는다
var LEDGER_RANK_ = { 세무사님: 3, 넥스: 2, 서류: 1, 규칙: 1, 추정: 1, 계산: 1 };
// 고르기 칸 코드값 — 화면 세액계산기 select 값과 같다(CH_ASSET_TYPE_OPTIONS_·CH_ASSET_KIND_OPTIONS_·양수인 관계 질문 tr:buyerrel)
var LEDGER_ENUMS_ = {
  assetType: { codes: ['house', 'other', 'presale_right'], ko: { house: '주택·조합원입주권', other: '그 외 부동산', presale_right: '분양권' } },
  assetKind: { codes: ['land', 'building', 'land_building', 'stock', 'other'], ko: { land: '토지', building: '건물', land_building: '토지+건물', stock: '주식', other: '기타' } },
  'buyer.relation': { codes: ['none', 'sibling', 'lineal', 'spouse', 'relative'], ko: { none: '특수관계 없음', sibling: '형제자매', lineal: '직계존비속', spouse: '배우자', relative: '기타 친족' } },
  transferCause: { codes: ['sale', 'expropriation', 'exchange', 'gift_burden', 'other'], ko: { sale: '매매', expropriation: '수용', exchange: '교환', gift_burden: '부담부증여', other: '기타' } }
};
var LEDGER_DOC_ROLES_ = ['양도계약서', '취득계약서', '등기부', '전소유자 분양계약서', '분양권 매매계약서', '영수증', '간편계산서', '신고서', '등초본', '가족관계', '기타'];

function ledgerFolder_() {
  const root = getChiefManagerFolder_();
  if (!root) throw new Error('총괄관리자 폴더가 설정되어 있지 않습니다');
  return getOrCreateSubfolder_(root, LEDGER_FOLDER_);
}
function ledgerFile_(caseId, create) {
  const folder = ledgerFolder_();
  const name = String(caseId).replace(/[^\w-]/g, '_') + '.json';
  const it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFile(name, '{}', 'application/json') : null;
}
function ledgerEmpty_(caseId) { return { caseId: String(caseId || ''), rows: {}, log: [], at: '' }; }
// 한 실행 안의 읽기 메모 — 사건 처리 저장 파일을 불러올 때마다(질문·결정을 장부에서 붙임) 드라이브를 다시 읽지 않게. 쓰기(ledgerMutate_)는 잠금 안에서 늘 새로 읽고, 쓴 뒤 메모를 바꾼다
var LEDGER_MEMO_ = {};
function ledgerLoad_(caseId, fresh) {
  const k = String(caseId || '');
  if (!fresh && LEDGER_MEMO_[k]) return JSON.parse(LEDGER_MEMO_[k]);
  try {
    const f = ledgerFile_(caseId, false);
    if (!f) return ledgerEmpty_(caseId);
    const o = JSON.parse(f.getBlob().getDataAsString('UTF-8') || '{}') || {};
    o.caseId = k; o.rows = o.rows || {}; o.log = Array.isArray(o.log) ? o.log : [];
    LEDGER_MEMO_[k] = JSON.stringify(o);
    return o;
  } catch (e) { return ledgerEmpty_(caseId); }
}
// 잠금 안에서 읽고-고치고-쓴다(동시에 도는 넥스·화면이 서로 덮지 않게). mutate(L)가 돌려준 값을 그대로 돌려준다
function ledgerMutate_(caseId, mutate) {
  return withLock_(15000, function () {
    const L = ledgerLoad_(caseId, true);
    const out = mutate(L);
    L.at = caseProcNow_();
    const f = ledgerFile_(caseId, true);
    const s = JSON.stringify(L);
    f.setContent(s);
    LEDGER_MEMO_[String(caseId || '')] = s;
    return out;
  });
}
function ledgerLogTo_(L, e) {
  L.log = (L.log || []).concat([{ at: caseProcNow_(), by: String(e.by || '').slice(0, 6), what: String(e.what || '').slice(0, 30), path: String(e.path || '').slice(0, 80), detail: String(e.detail || '').slice(0, 240) }]).slice(-400);
}

// ── 칸 이름(한글) — 기존 이름표를 그대로 쓴다(서식 기준 이름) ──
function ledgerLabel_(path) {
  const p = String(path || '');
  let m;
  if ((m = /^doc:(.+)\.role$/.exec(p))) return '서류 역할 — ' + m[1];
  if (/^q:/.test(p)) return '질문';
  if (/^(costs|taxfee|사건분류|기준일)$/.test(p)) return CASEPROC_FIELD_KO_[p] || p;
  if ((m = /^a(\d+)\.contract$/.exec(p))) return '자산' + (Number(m[1]) + 1) + ' 걸린 계약';
  try { const l = caseProcFieldLabel_('calc:' + p); if (l && l !== 'calc:' + p) return l; } catch (e) {}
  const last = p.split('.').pop();
  return CASEPROC_FIELD_KO_[last] || p;
}
// ── 고르기 칸 코드값 — 글을 코드로. 못 바꾸면 error ──
function ledgerEnumOf_(path) {
  const p = String(path || '');
  if (/\.assetType$/.test(p)) return 'assetType';
  if (/\.assetKind$/.test(p)) return 'assetKind';
  if (/\.buyer\.relation$/.test(p)) return 'buyer.relation';
  if (/\.transferCause$/.test(p)) return 'transferCause';
  return '';
}
function ledgerNorm_(path, value) {
  const p = String(path || ''), s = String(value == null ? '' : value).trim();
  const en = ledgerEnumOf_(p);
  if (en) {
    const spec = LEDGER_ENUMS_[en];
    if (spec.codes.indexOf(s) !== -1) return { v: s };
    const hit = ledgerEnumGuess_(en, s);
    if (hit) return { v: hit, note: '글 "' + s.slice(0, 30) + '" → ' + spec.ko[hit] };
    return { error: ledgerLabel_(p) + '은(는) ' + spec.codes.map(function (c) { return c + '=' + spec.ko[c]; }).join(' · ') + ' 중 하나여야 합니다 — 받은 값: ' + s.slice(0, 40) };
  }
  if (/\.multiHouseCount$/.test(p)) { const n = (s.match(/\d+/) || [])[0]; return n ? { v: String(Number(n)) } : { error: '보유 주택 수는 숫자여야 합니다 — 받은 값: ' + s.slice(0, 30) }; }
  if (/\.(is[A-Z]\w*)$/.test(p)) { if (typeof value === 'boolean') return { v: value }; if (/^(true|1|예|켬|yes|해당|맞)/.test(s)) return { v: true }; if (/^(false|0|아니|끔|no|비해당|없)/.test(s)) return { v: false }; return { error: ledgerLabel_(p) + '은(는) 예/아니오 칸입니다 — 받은 값: ' + s.slice(0, 30) }; }
  if (/(Price|Amount|Value|StandardPrice|Sqm|Assumed|Fee|PaidTax|DeductionUsed)$|^taxfee$/.test(p)) { const n = Number(s.replace(/[^\d]/g, '')); if (!s) return { v: '' }; if (!Number.isFinite(n)) return { error: ledgerLabel_(p) + '은(는) 금액 칸입니다 — 받은 값: ' + s.slice(0, 30) }; return { v: n }; }
  if (/(Date|^기준일)$/.test(p)) { const m = /((?:19|20)\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/.exec(s); if (!s) return { v: '' }; if (!m) return { error: ledgerLabel_(p) + '은(는) 날짜 칸(YYYY-MM-DD)입니다 — 받은 값: ' + s.slice(0, 30) }; return { v: m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) }; }
  if (p === 'costs') {
    let d = value; try { if (typeof d === 'string') d = JSON.parse(d); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') return { error: '필요경비는 {acq:[{label,amount,file,date}], tr:[…]} 모양이어야 합니다(acq=취득비용, tr=양도비용)' };
    const fix = function (l) { return (Array.isArray(l) ? l : []).map(function (x) { return { label: String(x.label || '').slice(0, 60), amount: Number(String(x.amount == null ? '' : x.amount).replace(/[^\d]/g, '')) || 0, file: String(x.file || '').slice(0, 80), date: String(x.date || '').slice(0, 10) }; }).filter(function (x) { return x.amount > 0; }); };
    const items = Array.isArray(d.items) ? d.items : null;
    const acq = items ? items.filter(function (x) { return x && x.kind === '취득'; }) : d.acq, tr = items ? items.filter(function (x) { return x && x.kind !== '취득'; }) : d.tr;
    return { v: { acq: fix(acq), tr: fix(tr) } };
  }
  if ((/^doc:/.test(p))) { if (!s) return { error: '서류 역할이 비어 있습니다' }; return { v: s.slice(0, 40) }; } // GAS·넥스가 읽은 종류 이름 그대로 — 역할 목록에 부분 일치로 붙이지 않는다(10-28 "매매계약서"가 "분양권 매매계약서"로 바뀐 결함)
  if ((/^a\d+\.contract$/.test(p))) { const m = /c?(\d+)/.exec(s); return m ? { v: 'c' + Number(m[1]) } : { error: '걸린 계약은 c0·c1… 모양 — 받은 값: ' + s.slice(0, 20) }; }
  return { v: typeof value === 'object' ? value : s };
}
function ledgerEnumGuess_(en, s) {
  if (en === 'assetType') {
    if (/분양권/.test(s) && !/주택/.test(s)) return 'presale_right';
    if (/아님|아니|업무용|그\s*외|기타|비주택|토지|상가|오피스텔\s*\(업무/.test(s)) return 'other';
    if (/주택|주거|아파트|입주권|house/i.test(s)) return 'house';
  }
  if (en === 'buyer.relation') {
    if (/배우자|부부|남편|아내/.test(s)) return 'spouse';
    if (/형제|자매|남매/.test(s)) return 'sibling';
    if (/직계|부모|자녀|아들|딸|조부|손/.test(s)) return 'lineal';
    if (/없|아님|아니|무관|타인|제3자/.test(s)) return 'none';
    if (/친족|친척|인척|관계\s*있|특수관계/.test(s)) return 'relative';
  }
  if (en === 'assetKind') {
    if (/토지\s*[+·]\s*건물|토지와\s*건물/.test(s)) return 'land_building';
    if (/토지|땅|농지|임야|대지|전\b|답\b/.test(s)) return 'land';
    if (/건물|아파트|오피스텔|주택|상가|빌라|다세대|구분소유/.test(s)) return 'building';
    if (/주식|출자/.test(s)) return 'stock';
  }
  if (en === 'transferCause') {
    if (/수용|보상/.test(s)) return 'expropriation';
    if (/교환/.test(s)) return 'exchange';
    if (/부담부/.test(s)) return 'gift_burden';
    if (/매매|매도|양도|거래/.test(s)) return 'sale';
  }
  return '';
}
function ledgerValueText_(path, v) {
  if (v === undefined || v === null || v === '') return '(비어 있음)';
  const en = ledgerEnumOf_(path);
  if (en && LEDGER_ENUMS_[en].ko[v]) return LEDGER_ENUMS_[en].ko[v];
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  if (path === 'costs' && typeof v === 'object') { const s = function (l) { return (l || []).reduce(function (t, x) { return t + (Number(x.amount) || 0); }, 0); }; return '취득비용 ' + s(v.acq).toLocaleString('ko-KR') + '원(' + (v.acq || []).length + '건) · 양도비용 ' + s(v.tr).toLocaleString('ko-KR') + '원(' + (v.tr || []).length + '건)'; }
  if (typeof v === 'number' || (/(Price|Amount|Value|StandardPrice)$|^taxfee$/.test(path) && /^\d+$/.test(String(v)))) return Number(v).toLocaleString('ko-KR') + '원';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 120);
  return String(v).slice(0, 120);
}

// ── 쓰기 — 장부에 값을 적는 유일한 길 ──
// input: { path, value, kind(세무사님|넥스|서류|규칙|추정|계산), by(기록 주체 — 생략하면 kind), file, page, quote(원문 한 줄), why, sure(확실|애매|모름), cands:[{v,src}], label, estimate(true면 추정) }
function ledgerSet_(caseId, input) {
  const pre = ledgerSetPrep_(input);
  if (pre.error) return { ok: false, error: pre.error };
  return ledgerMutate_(caseId, function (L) { return ledgerSetInner_(L, pre); });
}
// 여러 줄을 한 번에(잠금·드라이브 쓰기 1회) — GAS 서류 읽기 결과·질문 목록 옮기기에
function ledgerBatch_(caseId, ops) {
  const preps = (ops || []).map(function (op) { return op && op.ask ? { ask: op } : op && op.drop ? { drop: op } : ledgerSetPrep_(op); });
  return ledgerMutate_(caseId, function (L) {
    const out = { ok: true, set: 0, asked: 0, refused: 0, dropped: 0, errors: [] };
    preps.forEach(function (p) {
      if (p.error) { out.errors.push(p.error); return; }
      if (p.drop) { const d = p.drop, r0 = L.rows[d.path]; if (!r0) return; delete L.rows[d.path]; out.dropped++; ledgerLogTo_(L, { by: d.by || 'GAS', what: '값 지움', path: d.path, detail: (r0.label || d.path) + ' ' + ledgerValueText_(d.path, r0.v) + ' — 서류를 다시 읽어 더는 나오지 않는 값' }); return; }
      if (p.ask) { const a = p.ask, prev = L.rows[a.path]; if (prev && (prev.state === '확정' || prev.state === '추정') && (LEDGER_RANK_[prev.src && prev.src.kind] || 0) > 1) return; ledgerAskInner_(L, a.path, { label: a.label, question: a.question, cands: a.cands, by: a.by || 'GAS', needDoc: !!a.needDoc, keep: true }); out.asked++; return; }
      const r = ledgerSetInner_(L, p);
      if (r.ok && r.asked) out.asked++; else if (r.ok) out.set++; else if (r.refused) out.refused++; else out.errors.push(r.error);
    });
    return out;
  });
}
function ledgerSetPrep_(input) {
  input = input || {};
  const path = String(input.path || '').trim();
  if (!path) return { error: '칸 경로(path)가 필요합니다' };
  const kind = LEDGER_KINDS_.indexOf(input.kind) !== -1 ? input.kind : (input.estimate ? '추정' : '세무사님');
  const sure = input.estimate ? '애매' : (LEDGER_SURE_.indexOf(input.sure) !== -1 ? input.sure : '확실');
  const by = String(input.by || (kind === '서류' || kind === '규칙' || kind === '계산' ? 'GAS' : kind)).slice(0, 6);
  const hasValue = !(input.value === undefined || input.value === null || (typeof input.value === 'string' && !input.value.trim()));
  let norm = { v: '' };
  if (hasValue) { norm = ledgerNorm_(path, input.value); if (norm.error) return { error: norm.error }; }
  const label = String(input.label || ledgerLabel_(path)).slice(0, 40);
  const src = { kind: kind, who: by, file: String(input.file || '').slice(0, 80), page: String(input.page || '').slice(0, 10), quote: String(input.quote || '').slice(0, 160), why: String(input.why || '').slice(0, 160) };
  return { path: path, kind: kind, sure: sure, by: by, hasValue: hasValue, norm: norm, label: label, src: src, cands: input.cands || [], estimate: !!input.estimate, why: input.why };
}
function ledgerSetInner_(L, p) {
  const path = p.path, kind = p.kind, sure = p.sure, by = p.by, hasValue = p.hasValue, norm = p.norm, label = p.label, src = p.src, input = { cands: p.cands, estimate: p.estimate, why: p.why };
  {
    const prev = L.rows[path] || null;
    const prevKind = prev && prev.src ? prev.src.kind : '';
    const prevSettled = prev && (prev.state === '확정' || prev.state === '추정') && prev.v !== '' && prev.v !== undefined && prev.v !== null;
    // 서류·규칙(GAS)은 사람·넥스가 다룰 줄(물어볼것·증빙받을것·보류·무시)을 건드리지 않는다 — 질문은 사람·넥스가 풀거나, GAS가 ask로 후보를 더할 뿐
    if (prev && /^(물어볼것|증빙받을것|보류|무시)$/.test(prev.state) && (LEDGER_RANK_[kind] || 0) <= 1 && !input.estimate) return { ok: false, refused: true, quiet: true, message: '「' + label + '」은 ' + prev.state + ' 상태 — 서류·규칙 값으로 바꾸지 않음' };
    // 같은 주인이 같은 값을 다시 적는 것은 기록하지 않는다(GAS가 서류를 다시 읽을 때마다 이력이 불지 않게)
    if (prevSettled && prevKind === kind && hasValue && JSON.stringify(prev.v) === JSON.stringify(norm.v)) return { ok: true, same: true, row: ledgerRowOut_(path, prev), message: '「' + label + '」 그대로' };
    // ①② 값 주인 우열 — 낮은 급은 높은 급의 값을 덮지 못한다(넥스가 넥스 값, 세무사님이 세무사님 값은 바꿀 수 있다)
    if (prevSettled && (LEDGER_RANK_[kind] || 0) < (LEDGER_RANK_[prevKind] || 0)) {
      return { ok: false, refused: true, prev: ledgerRowOut_(path, prev), message: '「' + label + '」은 ' + prevKind + '이 정한 값(' + ledgerValueText_(path, prev.v) + ')입니다 — ' + kind + '은(는) 바꾸지 못합니다. 서류 값이 다르면 그 사실만 말씀드립니다.' };
    }
    // ③ 서류·규칙끼리는 더 확실한 쪽만 덮는다(같은 확신이면 나중 것 — 교차검증은 넥스·규칙이 따로 한다)
    if (prevSettled && (kind === '서류' || kind === '규칙') && (prevKind === '서류' || prevKind === '규칙') && prev.sure === '확실' && sure !== '확실') {
      return ledgerAskInner_(L, path, { label: label, question: '서류끼리 값이 다릅니다 — ' + ledgerValueText_(path, prev.v) + '(' + (prev.src.file || prevKind) + ') / ' + ledgerValueText_(path, norm.v) + '(' + (src.file || kind) + ')', cands: [{ v: prev.v, src: prev.src.file || prevKind }, { v: norm.v, src: src.file || kind }].concat(input.cands || []), by: by, keep: true });
    }
    // ④ 서류·규칙이 애매·모름이면 값을 정하지 않고 물어볼 것으로(후보와 함께)
    if ((kind === '서류' || kind === '규칙') && sure !== '확실' && !input.estimate) {
      const cands = (input.cands || []).slice();
      if (hasValue && !cands.some(function (x) { return String(x.v) === String(norm.v); })) cands.unshift({ v: norm.v, src: (src.file ? src.file : kind) + (src.quote ? ' "' + src.quote.slice(0, 60) + '"' : '') });
      return ledgerAskInner_(L, path, { label: label, question: String(input.why || '서류로 확신하지 못함'), cands: cands, by: by, keep: true });
    }
    if (!hasValue) return { ok: false, error: '넣을 값(value)이 없습니다 — 비우려면 ledgerDecide_(무시) 또는 ledgerAsk_' };
    const state = (kind === '추정' || input.estimate) ? '추정' : '확정';
    const row = Object.assign({}, prev || {}, { v: norm.v, label: label, src: src, sure: sure, state: state, ask: '', cands: [], at: caseProcNow_() });
    row.hist = (prev && Array.isArray(prev.hist) ? prev.hist : []).concat([{ at: row.at, by: by, kind: kind, prev: prev ? { v: prev.v, kind: prevKind, state: prev.state } : null, next: { v: norm.v, kind: kind, state: state }, why: src.why || src.quote || '' }]).slice(-30);
    L.rows[path] = row;
    ledgerLogTo_(L, { by: by, what: state === '추정' ? '추정 넣음' : (prev && prev.state === '물어볼것' ? '답 반영' : '값 정함'), path: path, detail: label + ' ' + (prev ? ledgerValueText_(path, prev.v) : '(비어 있음)') + ' → ' + ledgerValueText_(path, norm.v) + ' (' + kind + (src.file ? ' · ' + src.file : '') + (src.why ? ' · ' + src.why.slice(0, 60) : '') + ')' });
    return { ok: true, row: ledgerRowOut_(path, row), note: norm.note || '', message: '「' + label + '」 ← ' + ledgerValueText_(path, norm.v) + (state === '추정' ? ' (추정 — 검토서에 표시)' : '') + (norm.note ? ' (' + norm.note + ')' : '') };
  }
}
function ledgerAskInner_(L, path, o) {
  const prev = L.rows[path] || {};
  // 같은 질문이 이미 서 있으면 그대로(기록·이력을 불리지 않음) — 화면이 질문 목록을 저장할 때마다 다시 오기 때문
  const sameState = prev.state === (o.needDoc ? '증빙받을것' : '물어볼것');
  if (sameState && String(prev.ask || '') === String(o.question || '').slice(0, 300) && JSON.stringify((prev.cands || []).map(function (x) { return String(x.v); })) === JSON.stringify((o.cands || []).slice(0, 8).map(function (x) { return String(x.v); }))) return { ok: true, asked: true, same: true, row: ledgerRowOut_(path, prev), message: '「' + (prev.label || path) + '」 ' + prev.state + ' 그대로' };
  const row = Object.assign({}, prev, { label: String(o.label || prev.label || ledgerLabel_(path)).slice(0, 40), state: o.needDoc ? '증빙받을것' : '물어볼것', ask: String(o.question || '').slice(0, 300), cands: (o.cands || []).slice(0, 8).map(function (x) { return { v: x.v, src: String(x.src || '').slice(0, 120) }; }), at: caseProcNow_() });
  if (!row.src) row.src = { kind: '질문', who: String(o.by || '').slice(0, 6), file: '', page: '', quote: '', why: '' };
  if (!o.keep) { row.v = prev.v; }
  row.hist = (Array.isArray(prev.hist) ? prev.hist : []).concat([{ at: row.at, by: o.by || '', kind: '질문', prev: prev.state ? { v: prev.v, state: prev.state } : null, next: { state: row.state }, why: row.ask }]).slice(-30);
  L.rows[path] = row;
  ledgerLogTo_(L, { by: o.by || '', what: row.state, path: path, detail: row.label + ' — ' + row.ask.slice(0, 120) + (row.cands.length ? ' · 후보 ' + row.cands.length + '개' : '') });
  return { ok: true, asked: true, row: ledgerRowOut_(path, row), message: '「' + row.label + '」 ' + row.state + '으로 둠' + (row.cands.length ? ' — 후보 ' + row.cands.map(function (x) { return ledgerValueText_(path, x.v); }).join(' / ') : '') };
}
// 물어볼 것·증빙 받을 것으로 세우기(값은 두고 상태만) — 넥스·GAS가 "모르겠다"를 적는 길
function ledgerAsk_(caseId, input) {
  input = input || {};
  const path = String(input.path || '').trim(); if (!path) return { ok: false, error: '칸 경로(path)가 필요합니다' };
  return ledgerMutate_(caseId, function (L) {
    const prev = L.rows[path];
    if (prev && prev.state === '확정' && prev.src && prev.src.kind === '세무사님' && input.by !== '세무사님') return { ok: false, refused: true, message: '「' + (prev.label || path) + '」은 세무사님이 정한 값입니다 — 다시 묻지 않습니다. 서류 값이 다르면 그 사실만 말씀드립니다.' };
    return ledgerAskInner_(L, path, { label: input.label, question: input.question, cands: input.cands, by: input.by || '넥스', needDoc: !!input.needDoc, keep: true });
  });
}
// 보류·무시·확인(값 그대로 확정) — 세무사님·넥스의 결정
function ledgerDecide_(caseId, input) {
  input = input || {};
  const path = String(input.path || '').trim(); if (!path) return { ok: false, error: '칸 경로(path)가 필요합니다' };
  const d = { 보류: '보류', 무시: '무시', 확인: '확정', done: '확정', 확정: '확정' }[String(input.decision || '').trim()];
  if (!d) return { ok: false, error: '결정은 확인·보류·무시 중 하나입니다' };
  const by = String(input.by || '세무사님').slice(0, 6);
  return ledgerMutate_(caseId, function (L) {
    const prev = L.rows[path] || { label: ledgerLabel_(path) };
    if (d === '확정' && (prev.v === undefined || prev.v === null || prev.v === '')) return { ok: false, error: '「' + prev.label + '」에 값이 없어 확인으로 닫지 못합니다 — 값을 넣거나 보류·무시로' };
    const row = Object.assign({}, prev, { state: d, at: caseProcNow_(), note: String(input.note || '').slice(0, 200) });
    if (d === '확정') { row.src = Object.assign({}, prev.src || {}, { kind: by === '넥스' ? '넥스' : '세무사님', who: by }); row.sure = '확실'; row.ask = ''; }
    row.hist = (Array.isArray(prev.hist) ? prev.hist : []).concat([{ at: row.at, by: by, kind: '결정', prev: { state: prev.state }, next: { state: d }, why: row.note }]).slice(-30);
    L.rows[path] = row;
    ledgerLogTo_(L, { by: by, what: '결정 ' + d, path: path, detail: row.label + (row.note ? ' — ' + row.note : '') });
    return { ok: true, row: ledgerRowOut_(path, row), message: '「' + row.label + '」 → ' + d };
  });
}
// 되돌리기 — 마지막 고침을 전 값으로(세무사님 요청 또는 넥스가 자기 값만)
function ledgerUndo_(caseId, input) {
  input = input || {};
  const path = String(input.path || '').trim(); if (!path) return { ok: false, error: '칸 경로(path)가 필요합니다' };
  const by = String(input.by || '세무사님').slice(0, 6);
  return ledgerMutate_(caseId, function (L) {
    const row = L.rows[path]; if (!row || !Array.isArray(row.hist) || !row.hist.length) return { ok: false, error: '되돌릴 기록이 없습니다' };
    const last = row.hist[row.hist.length - 1];
    if (by === '넥스' && row.src && row.src.kind === '세무사님') return { ok: false, refused: true, message: '세무사님이 정한 값은 넥스가 되돌리지 않습니다' };
    const back = last.prev || { v: '', state: '물어볼것' };
    const nrow = Object.assign({}, row, { v: back.v === undefined ? '' : back.v, state: back.state || (back.v ? '확정' : '물어볼것'), at: caseProcNow_() });
    if (back.kind) nrow.src = Object.assign({}, row.src || {}, { kind: back.kind });
    nrow.hist = row.hist.concat([{ at: nrow.at, by: by, kind: '되돌림', prev: { v: row.v, state: row.state }, next: { v: nrow.v, state: nrow.state }, why: '' }]).slice(-30);
    L.rows[path] = nrow;
    ledgerLogTo_(L, { by: by, what: '되돌림', path: path, detail: (row.label || path) + ' ' + ledgerValueText_(path, row.v) + ' → ' + ledgerValueText_(path, nrow.v) });
    return { ok: true, row: ledgerRowOut_(path, nrow), message: '「' + (row.label || path) + '」 ' + ledgerValueText_(path, nrow.v) + '로 되돌림' };
  });
}
function ledgerRowOut_(path, r) {
  r = r || {};
  return { path: path, label: r.label || ledgerLabel_(path), v: r.v === undefined ? '' : r.v, 값: ledgerValueText_(path, r.v), state: r.state || '', kind: r.src ? r.src.kind : '', who: r.src ? r.src.who : '', file: r.src ? r.src.file : '', quote: r.src ? r.src.quote : '', why: r.src ? r.src.why : '', sure: r.sure || '', ask: r.ask || '', cands: (r.cands || []).map(function (x) { return { v: x.v, 값: ledgerValueText_(path, x.v), src: x.src }; }), at: r.at || '', note: r.note || '', histN: (r.hist || []).length };
}
// ── 읽기 ──
function ledgerRows_(caseId, filter) {
  const L = ledgerLoad_(caseId);
  const st = filter && filter.state ? (Array.isArray(filter.state) ? filter.state : [filter.state]) : null;
  return Object.keys(L.rows).filter(function (p) { return !st || st.indexOf(L.rows[p].state) !== -1; }).sort(ledgerPathSort_).map(function (p) { return ledgerRowOut_(p, L.rows[p]); });
}
function ledgerPathSort_(a, b) {
  const g = function (p) { return /^doc:/.test(p) ? 0 : /^기준일$/.test(p) ? 1 : /^seller\./.test(p) ? 2 : /^c\d+\./.test(p) ? 3 : /^a\d+\./.test(p) ? 4 : /^(costs|taxfee)$/.test(p) ? 5 : 6; };
  return g(a) - g(b) || (a < b ? -1 : a > b ? 1 : 0);
}
function ledgerQuestions_(caseId) { return ledgerRows_(caseId, { state: ['물어볼것', '증빙받을것'] }); }
function ledgerReviewNotes_(caseId) { return ledgerRows_(caseId, { state: ['추정', '증빙받을것', '보류'] }); }
function ledgerSummary_(caseId) {
  const L = ledgerLoad_(caseId), n = {};
  LEDGER_STATES_.forEach(function (s) { n[s] = 0; });
  Object.keys(L.rows).forEach(function (p) { n[L.rows[p].state] = (n[L.rows[p].state] || 0) + 1; });
  n.전체 = Object.keys(L.rows).length; n.at = L.at || '';
  return n;
}

// ── 장부 → 세액계산기 상태(양도) — 확정·추정 줄만. 비어 있으면 비어 있는 대로(추정도 없으면 엔진이 "필요합니다"로 알린다) ──
function ledgerCalcState_(caseId) {
  const L = ledgerLoad_(caseId);
  const st = { transferSellers: [{}], transferContracts: [], transferAssets: [], acquisitionContracts: [] };
  const src = {}, used = [];
  const ct = function (i) { while (st.transferContracts.length <= i) { const k = st.transferContracts.length; st.transferContracts.push({ id: 'trc_c' + (k + 1), name: '양도계약 ' + ('0' + (k + 1)).slice(-2), date: '', totalPrice: 0, totalExpenseItems: [], externalMembers: [], buyers: [{}], transferCause: 'sale' }); } return st.transferContracts[i]; };
  const as = function (i) { while (st.transferAssets.length <= i) { const k = st.transferAssets.length; st.transferAssets.push({ id: 'trc_a' + (k + 1) + '_1', transferContractId: 'trc_c' + (k + 1), assetLocation: '', acquisitionDate: '', acquisitionPrice: '', acquisitionExpenseItems: [] }); } return st.transferAssets[i]; };
  Object.keys(L.rows).sort(ledgerPathSort_).forEach(function (p) {
    const r = L.rows[p];
    if (!(r.state === '확정' || r.state === '추정') || r.v === '' || r.v === undefined || r.v === null) return;
    let m;
    if ((m = /^seller\.(\w+)$/.exec(p))) st.transferSellers[0][m[1]] = r.v;
    else if ((m = /^c(\d+)\.buyer\.(\w+)$/.exec(p))) ct(Number(m[1])).buyers[0][m[2]] = r.v;
    else if ((m = /^c(\d+)\.(\w+)$/.exec(p))) ct(Number(m[1]))[m[2]] = r.v;
    else if ((m = /^a(\d+)\.contract$/.exec(p))) { const ci = Number(String(r.v).replace(/\D/g, '')) || 0; ct(ci); as(Number(m[1])).transferContractId = 'trc_c' + (ci + 1); }
    else if ((m = /^a(\d+)\.(\w+)$/.exec(p))) as(Number(m[1]))[m[2]] = r.v;
    else if (p === 'costs') { const a0 = as(0), c0 = ct(0); a0.acquisitionExpenseItems = (r.v.acq || []).map(function (x) { return { label: x.label + (x.file ? ' (' + x.file + ')' : ''), amount: Number(x.amount) || 0, payDate: x.date || '' }; }); c0.totalExpenseItems = (r.v.tr || []).map(function (x) { return { label: x.label + (x.file ? ' (' + x.file + ')' : ''), amount: Number(x.amount) || 0, payDate: x.date || '' }; }); }
    else if (p === 'taxfee') { if (Number(r.v)) ct(0).totalExpenseItems = (ct(0).totalExpenseItems || []).concat([{ label: '양도소득세 신고 세무비용', amount: Number(r.v), payDate: '' }]); }
    else if (p === '사건분류') { ledgerApplyClass_(st, String(r.v)); }
    else return;
    src[p] = r.src; used.push(p);
  });
  // 계약마다 양도자산이 하나는 있어야 엔진이 돈다 — 자산 줄이 전혀 없으면 계약 수만큼 빈 자산
  st.transferContracts.forEach(function (c, i) { if (!st.transferAssets.some(function (a) { return a.transferContractId === c.id; })) as(st.transferAssets.length).transferContractId = c.id; });
  // 자산 과세대상 구분이 비어 있으면 엔진 기본(other)이 조용히 쓰인다 — 비어 있는 자산을 알려 준다
  const gaps = [];
  st.transferAssets.forEach(function (a, i) { ['assetType', 'acquisitionDate', 'acquisitionPrice'].forEach(function (k) { if (a[k] === '' || a[k] === undefined) gaps.push('a' + i + '.' + k); }); });
  st.transferContracts.forEach(function (c, i) { ['date', 'totalPrice'].forEach(function (k) { if (!c[k]) gaps.push('c' + i + '.' + k); }); });
  return { state: st, src: src, used: used, gaps: gaps, 기준일: (L.rows['기준일'] && L.rows['기준일'].v) || '' };
}
// 사건분류 글 → 계산기 체크(1세대1주택·비사업용·미등기·주택 수) — 서식의 체크 칸과 같다
function ledgerApplyClass_(st, cls) {
  const a0 = st.transferAssets[0] || (st.transferAssets.push({ id: 'trc_a1_1', transferContractId: 'trc_c1' }), st.transferAssets[0]);
  if (/1세대\s*1주택|비과세/.test(cls)) a0.isOneHouseOneFamily = true;
  if (/비사업용/.test(cls)) a0.isNonBusinessLand = true;
  if (/미등기/.test(cls)) a0.isUnregisteredTransfer = true;
  const m = /(\d)\s*주택/.exec(cls); if (m && !st.transferSellers[0].multiHouseCount) st.transferSellers[0].multiHouseCount = m[1];
  if (/특수관계/.test(cls) && st.transferContracts[0] && st.transferContracts[0].buyers[0] && !st.transferContracts[0].buyers[0].relation) st.transferContracts[0].buyers[0].relation = 'relative';
}
// ── 증여·상속 — 계산기 칸을 장부 줄로(처리개요 단계 끝에서 부름) ──
// 증여: 처리개요 칸 = 계산기 칸(GI_CALC_KEYS_ + 기납부세액·이미 쓴 공제) → g.<칸>. 값 주인은 그 칸 근거 기록(filled.src)으로 가른다.
// 상속: 상속 사실(caseProcInhFacts_ — 서류 + 세무사님 세부 답 ihChoices)을 계산기 입력 단위로 → i.<칸>. 세무사님이 장부에서 이 칸을 직접 고치면 그 값이 이긴다(규칙 ①).
var LEDGER_GIFT_KEYS_ = ['giftDoneeName', 'giftDonorName', 'giftRelation', 'giftAmount', 'giftDebtAssumed', 'giftDebtProven', 'giftPriorAmount', 'giftPriorPaidTax', 'giftPriorDeductionUsed', 'giftAppraisalFee'];
function ledgerFromGiftInh_(c, items) {
  if (!c || !/^(gift|inheritance)$/.test(c.세목)) return null;
  const sv = caseProcLoad_(c.id) || {}, filled = sv.filled || {}, ov = c.사건개요 || {}, ops = [];
  const kindOf = function (s) { s = String(s || ''); return /세무사님/.test(s) ? '세무사님' : /🤖|넥스|AI 판단/.test(s) ? '넥스' : /규칙|검산|교차|계산/.test(s) ? '규칙' : '서류'; };
  // est: 서류가 없어서 정한 값(채무 0원·공과금 0원·금융재산 0원처럼 "없음으로 봄")은 확정이 아니라 추정 — 계산은 진행하고 검토서 "추가로 확인할 사항"에 남는다(10-28 원문 "추정치나 가정치를 넣어서 진행할 수도")
  const put = function (path, v, s, sure, est) {
    if (v === undefined || v === null || String(v).trim() === '') return;
    const kd = kindOf(s);
    ops.push({ path: path, value: v, kind: kd, by: kd === '세무사님' || kd === '넥스' ? kd : 'GAS', quote: String(s || '').slice(0, 160), why: est ? String(est).slice(0, 160) : kd === '세무사님' ? String(s || '').slice(0, 160) : '', sure: sure || '확실', estimate: !!est && kd !== '세무사님' && kd !== '넥스' });
  };
  if (c.기준일) put('기준일', c.기준일, (filled.기준일 && filled.기준일.src) || '사건 기준일(규칙)');
  if (c.세목 === 'gift') {
    LEDGER_GIFT_KEYS_.forEach(function (k) { const s = filled[k] && filled[k].src; if (s) put('g.' + k, ov[k], s); });
  } else {
    let f = null; try { f = caseProcInhFacts_(c); } catch (e) { f = null; }
    if (f) {
      const sum = function (l, key) { return (l || []).reduce(function (t, x) { return t + (Number(x[key || 'amount']) || 0); }, 0); };
      if (f.financialValue != null) put('i.financialAmount', f.financialValue, '규칙 — ' + String(f.financialSrc || '금융재산'), '', f.financialAssumedZero ? '금융재산 서류가 폴더에 없어 0원으로 봄' : '');
      const valued = (f.assets || []).filter(function (a) { return Number(a.value) > 0; });
      if (valued.length) put('i.realEstateAmount', valued.reduce(function (t, a) { return t + Number(a.value); }, 0), '규칙 — 상속재산 평가 ' + valued.length + '건(' + valued.map(function (a) { return String(a.loc || '').slice(0, 20); }).join(', ') + ')');
      const debts = Array.isArray(f.debtsConfirmed) ? f.debtsConfirmed : (f.debts || []).filter(function (d) { return d.sure; });
      const unsure = Array.isArray(f.debtsConfirmed) ? [] : (f.debts || []).filter(function (d) { return !d.sure; });
      if (unsure.length) { // 서류로 확실하지 않은 채무 후보가 있으면 정하지 않고 묻는다(후보와 출처를 함께)
        ops.push({ ask: true, path: 'i.debtAmount', label: '채무', question: '채무 후보 중 서류로 확실하지 않은 것이 ' + unsure.length + '건 있습니다 — ' + unsure.map(function (d) { return (d.src || d.file || '') + ' ' + Number(d.amount || 0).toLocaleString('ko-KR') + '원' + (d.note ? '(' + d.note + ')' : ''); }).join(' / ').slice(0, 220),
          cands: [{ v: sum(debts), src: '확실한 채무만 ' + debts.length + '건' }, { v: sum(debts) + sum(unsure), src: '후보 전부 ' + (debts.length + unsure.length) + '건' }], by: 'GAS' });
      } else put('i.debtAmount', sum(debts), (Array.isArray(f.debtsConfirmed) ? '세무사님 확정 채무' : '규칙 — 서류로 확실한 채무') + ' ' + debts.length + '건', '', debts.length ? '' : '채무 서류에서 읽은 채무가 없어 0원으로 봄');
      put('i.duesAmount', sum(f.dues), '규칙 — 공과금 ' + (f.dues || []).length + '건', '', (f.dues || []).length ? '' : '공과금 서류에서 읽은 것이 없어 0원으로 봄');
      if (f.funeral && f.funeral.value != null && Number(f.funeral.value) > 0) put('i.funeralAmount', f.funeral.value, String(f.funeral.src || '장례비'));
      if (f.niche && f.niche.value != null && Number(f.niche.value) > 0) put('i.nicheAmount', f.niche.value, String(f.niche.src || '봉안시설'));
      if (f.appraisalFee && f.appraisalFee.value) put('i.appraisalFeeAmount', f.appraisalFee.value, String(f.appraisalFee.src || '감정평가수수료'));
      const pgs = Array.isArray(f.priorGifts) ? f.priorGifts : [];
      if (pgs.length) { put('i.priorGiftHeirAmount', pgs.filter(function (g) { return g.heir; }).reduce(function (t, g) { return t + (Number(g.v) || 0); }, 0), '세무사님 답 — 사전증여(상속인 10년)'); put('i.priorGiftOtherAmount', pgs.filter(function (g) { return !g.heir; }).reduce(function (t, g) { return t + (Number(g.v) || 0); }, 0), '세무사님 답 — 사전증여(그 밖 5년)'); }
      if ((f.heirs || []).length) {
        const hs = f.heirs[0] && f.heirs[0].src;
        put('i.heirCount', String(f.heirs.length), '규칙 — ' + String(hs || '가족관계증명서'));
        put('i.isSpouse', f.heirs.some(function (h) { return h.relation === '배우자'; }), '규칙 — ' + String(hs || '가족관계증명서'));
        put('i.childCount', String(f.heirs.filter(function (h) { return h.relation === '자녀'; }).length), '규칙 — ' + String(hs || '가족관계증명서'));
      }
      if (f.deceased && f.deceased.name) put('i.deceasedName', f.deceased.name, String(f.deceased.src || '사망 서류'));
    }
  }
  return ledgerBatch_(c.id, ops); // 질문은 처리개요 끝(caseProcOverview_)에서 세목 가리지 않고 한 번에 장부로
}
function ledgerGiftInput_(c, L) {
  const row = function (p) { const r = L.rows[p]; return r && (r.state === '확정' || r.state === '추정') ? r.v : ''; };
  const dg = function (x) { return Number(String(x == null ? '' : x).replace(/[^\d]/g, '')) || 0; };
  const amt = dg(row('g.giftAmount')), rel = String(row('g.giftRelation') || '');
  const gaps = []; if (!amt) gaps.push('g.giftAmount'); if (!rel) gaps.push('g.giftRelation');
  if (gaps.length) return { gaps: gaps };
  const input = { giftAmount: amt, relation: /^배우자/.test(rel) ? '배우자' : /^직계존속/.test(rel) ? '직계존속' : /^직계비속/.test(rel) ? '직계비속' : /기타\s*친족/.test(rel) ? '기타친족' : '기타', isGenerationSkip: /2촌\s*이상|조부|손자|손녀|세대\s*생략/.test(rel), giftDate: row('기준일') || c.기준일 || undefined, isDoneeResident: true };
  if (dg(row('g.giftDebtAssumed'))) { input.debtAssumedAmount = dg(row('g.giftDebtAssumed')); input.isDebtObjectivelyProven = !/없|아니|미입증/.test(String(row('g.giftDebtProven') || '')); }
  if (dg(row('g.giftPriorAmount'))) input.priorGiftAmount = dg(row('g.giftPriorAmount'));
  if (dg(row('g.giftPriorPaidTax'))) input.priorPaidTax = dg(row('g.giftPriorPaidTax'));
  if (dg(row('g.giftPriorDeductionUsed'))) input.priorRelationDeductionUsed = dg(row('g.giftPriorDeductionUsed'));
  if (dg(row('g.giftAppraisalFee'))) input.appraisalFeeAmount = dg(row('g.giftAppraisalFee'));
  const open = ledgerQuestions_(c.id).filter(function (q) { return /^g\.giftPrior/.test(q.path); });
  return { input: input, gaps: open.length ? open.map(function (q) { return q.path; }) : [] };
}
function ledgerInhInput_(c, L) {
  const row = function (p) { const r = L.rows[p]; return r && (r.state === '확정' || r.state === '추정') ? r.v : ''; };
  const dg = function (x) { return Number(String(x == null ? '' : x).replace(/[^\d]/g, '')) || 0; };
  const fin = dg(row('i.financialAmount')), re = dg(row('i.realEstateAmount')), gross = fin + re;
  const gaps = []; if (!gross) gaps.push('i.financialAmount·i.realEstateAmount'); if (row('i.heirCount') === '') gaps.push('i.heirCount');
  if (!gross) return { gaps: gaps };
  const pgH = dg(row('i.priorGiftHeirAmount')), pgO = dg(row('i.priorGiftOtherAmount'));
  const input = { taxableEstateAmount: Math.max(0, gross - dg(row('i.debtAmount')) - dg(row('i.duesAmount'))) + pgH + pgO, appraisalFeeAmount: dg(row('i.appraisalFeeAmount')),
    hasSpouse: row('i.isSpouse') === true || row('i.isSpouse') === 'true', childCount: dg(row('i.childCount')), netFinancialAssets: fin,
    funeralCostAmount: dg(row('i.funeralAmount')), funeralNicheCostAmount: dg(row('i.nicheAmount')), isDecedentResident: true };
  if (pgH + pgO) { input.priorGiftedAmountIncludedInEstate = pgH + pgO; if (pgH) input.giftToHeirsWithin10Years = pgH; if (pgO) input.nonHeirPriorGiftAmountTotal = pgO; }
  const open = ledgerQuestions_(c.id).filter(function (q) { return /^i\./.test(q.path); });
  return { input: input, gaps: gaps.concat(open.map(function (q) { return q.path; })) };
}
// 장부로 세액계산기를 돌려 사건에 저장(기본 저장본 — 구분 '장부 계산'). 추정 줄이 있으면 요약에 적는다
function ledgerCalcRun_(c, body) {
  body = body || {};
  if (c.세목 === 'gift' || c.세목 === 'inheritance') return ledgerCalcGiftInh_(c, body);
  if (c.세목 !== 'transfer') return { ok: false, error: '장부 계산은 양도·증여·상속만 합니다' };
  const by = String(body.by || '넥스').slice(0, 6);
  const cs = ledgerCalcState_(c.id);
  if (!cs.state.transferContracts.length) return { ok: false, error: '장부에 양도계약 줄(c0.date·c0.totalPrice)이 없습니다' };
  const inputs = trcEngineInputs_(cs.state, cs.기준일 || c.기준일 || '');
  const res = runUiEngineCalcTool_('calculate_transfer_tax_multi', { transactions: inputs });
  if (!res || res.error) return { ok: false, error: '계산 실패: ' + ((res && res.error) || '엔진 없음'), gaps: cs.gaps };
  const won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
  const est = ledgerReviewNotes_(c.id);
  const lines = ['거래 ' + res.거래건수 + '건 · 비과세 ' + res.비과세건수 + '건', '합산과세표준 ' + won(res.합산과세표준), '산출세액 합계 ' + won(res.산출세액_합계), '지방소득세 ' + won(res.지방소득세), '납부세액 합계 ' + won(res.납부세액_합계)];
  if (est.length) lines.push('추가로 확인할 사항 ' + est.length + '건: ' + est.map(function (r) { return r.label + '(' + r.state + (r.state === '추정' ? ' ' + r.값 : '') + ')'; }).join(', ').slice(0, 300));
  if (cs.gaps.length) lines.push('비어 있는 칸: ' + cs.gaps.map(ledgerLabel_).join(', ').slice(0, 200));
  const all = Array.isArray(c.세액계산결과) ? c.세액계산결과 : [];
  const entry = { id: 'tc_' + Date.now(), 세목: '양도소득세', 구분: '장부 계산(서버)', 요약: ['[장부 계산] ' + (c.사건명 || c.고객명 || ''), '장부 줄 ' + cs.used.length + '개(확정·추정)'].concat(lines).join('\n'), 최종세액: Number(res.납부세액_합계), 계산일: caseProcToday_(), 기준일스냅샷: String(c.기준일 || ''),
    저장값: Object.assign({ ledger: true, inputs: { transactions: inputs }, result: { 거래건수: res.거래건수, 비과세건수: res.비과세건수, 합산과세표준: res.합산과세표준, 산출세액_합계: res.산출세액_합계, 지방소득세: res.지방소득세, 납부세액_합계: res.납부세액_합계 } }, cs.state) };
  const up = work_updateCase({ id: c.id, 세액계산결과: all.concat([entry]), 기대수정일: c.수정일 });
  if (!up || up.success === false) return { ok: false, error: '저장 실패: ' + ((up && up.message) || '사건 행을 못 고침') };
  ledgerMutate_(c.id, function (L) { ledgerLogTo_(L, { by: by, what: '세액계산 저장', path: entry.id, detail: '납부세액 ' + won(res.납부세액_합계) + (est.length ? ' · 추정·보류 ' + est.length + '건' : '') + (cs.gaps.length ? ' · 빈 칸 ' + cs.gaps.length : '') }); });
  return { ok: true, id: entry.id, 최종세액: Number(res.납부세액_합계), 요약: lines, gaps: cs.gaps, 추가확인: est.map(function (r) { return r.label + ' — ' + r.state + (r.ask ? ': ' + r.ask : ''); }), message: '세액계산 저장(' + entry.id + ') — 납부세액 ' + won(res.납부세액_합계) + (cs.gaps.length ? ' · 빈 칸 ' + cs.gaps.length + '개' : '') };
}

function ledgerCalcGiftInh_(c, body) {
  const by = String((body && body.by) || '넥스').slice(0, 6), L = ledgerLoad_(c.id), gift = c.세목 === 'gift';
  const b = gift ? ledgerGiftInput_(c, L) : ledgerInhInput_(c, L);
  if (!b.input) return { ok: false, error: '장부에 계산기 필수 칸이 없음: ' + (b.gaps || []).join(', '), gaps: b.gaps };
  const r = runUiEngineCalcTool_(gift ? 'calculate_gift_tax' : 'calculate_inheritance_tax', b.input);
  if (!r || r.error) return { ok: false, error: '계산 실패: ' + ((r && r.error) || '엔진 없음'), gaps: b.gaps };
  const won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
  const est = ledgerReviewNotes_(c.id), label = gift ? '증여세' : '상속세';
  const 산출 = gift ? (r.산출세액_할증후 != null ? r.산출세액_할증후 : r.산출세액) : r.산출세액;
  const lines = ['과세표준 ' + won(r.과세표준), '산출세액 ' + won(산출), '신고세액공제 ' + won(r.신고세액공제), '납부세액 ' + won(r.납부세액)];
  if (est.length) lines.push('추가로 확인할 사항 ' + est.length + '건: ' + est.map(function (x) { return x.label + '(' + x.state + ')'; }).join(', ').slice(0, 300));
  if ((b.gaps || []).length) lines.push('남은 물어볼 것·빈 칸: ' + b.gaps.map(ledgerLabel_).join(', ').slice(0, 200));
  const all = Array.isArray(c.세액계산결과) ? c.세액계산결과 : [];
  const entry = { id: 'tc_' + Date.now(), 세목: label, 구분: '장부 계산(서버)', 요약: ['[장부 계산] ' + (c.사건명 || c.고객명 || '')].concat(lines).join('\n'), 최종세액: Number(r.납부세액), 계산일: caseProcToday_(), 기준일스냅샷: String(c.기준일 || ''), 저장값: { ledger: true, tax: c.세목, inputs: b.input, result: { 과세표준: r.과세표준, 산출세액: 산출, 신고세액공제: r.신고세액공제, 납부세액: r.납부세액 } } };
  const up = work_updateCase({ id: c.id, 세액계산결과: all.concat([entry]), 기대수정일: c.수정일 });
  if (!up || up.success === false) return { ok: false, error: '저장 실패: ' + ((up && up.message) || '사건 행을 못 고침') };
  ledgerMutate_(c.id, function (L2) { ledgerLogTo_(L2, { by: by, what: '세액계산 저장', path: entry.id, detail: label + ' 납부세액 ' + won(r.납부세액) + ((b.gaps || []).length ? ' · 남은 것 ' + b.gaps.length : '') }); });
  return { ok: true, id: entry.id, 최종세액: Number(r.납부세액), 요약: lines, gaps: b.gaps || [], input: b.input, message: label + ' 계산 저장(' + entry.id + ') — 납부세액 ' + won(r.납부세액) };
}
// ── 옛 저장소 → 장부 한 번 옮기기(장부가 비어 있을 때만) — 값 주인은 출처 글로 가른다(세무사님/🤖·넥스/그 외 서류) ──
function ledgerImportLegacy_(c) {
  const sv = caseProcLoad_(c.id) || {}; // 먼저 불러 둔다 — 옛 질문·결정이 있으면 이때 장부 질문 줄로 옮겨진다
  const L0 = ledgerLoad_(c.id), valued = Object.keys(L0.rows).filter(function (p) { return !/^q:/.test(p) && L0.rows[p].v !== '' && L0.rows[p].v !== undefined && L0.rows[p].v !== null; });
  if (valued.length) return { ok: true, skipped: true, message: '장부에 값이 이미 있어 옮기지 않음(' + valued.length + '줄)' };
  const tr = sv.trAns || {}, st = sv.trCalc && sv.trCalc.state, tsrc = (sv.trCalc && sv.trCalc.src) || {};
  const kindOf = function (s) { s = String(s || ''); return /세무사님/.test(s) ? '세무사님' : /🤖|AI 판단|넥스/.test(s) ? '넥스' : /규칙 정리|빠른 날|검산/.test(s) ? '규칙' : '서류'; };
  let n = 0, asked = 0;
  return ledgerMutate_(c.id, function (L) {
    const put = function (path, v, srcTxt, sure) {
      if (v === '' || v === undefined || v === null) return;
      const norm = ledgerNorm_(path, v); if (norm.error) { L.rows[path] = Object.assign(ledgerAskInner_(L, path, { question: '옛 값이 칸 모양에 안 맞음: ' + norm.error, cands: [{ v: v, src: srcTxt }], by: '옮김', keep: true }).row ? L.rows[path] : {}, {}); asked++; return; }
      const kind = kindOf(srcTxt);
      L.rows[path] = { v: norm.v, label: ledgerLabel_(path), src: { kind: kind, who: kind === '서류' || kind === '규칙' ? 'GAS' : kind, file: (String(srcTxt).match(/[\w가-힣().\- ]+\.(pdf|jpg|jpeg|png|xlsx?|hwp|docx?)/i) || [''])[0].slice(0, 80), page: '', quote: String(srcTxt).slice(0, 160), why: '옛 저장소에서 옮김' }, sure: sure || '확실', state: '확정', ask: '', cands: [], at: caseProcNow_(), hist: [{ at: caseProcNow_(), by: '옮김', kind: kind, prev: null, next: { v: norm.v, kind: kind, state: '확정' }, why: '옛 저장소(trAns·trCalc)에서' }] };
      n++;
    };
    if (st) {
      const s0 = (st.transferSellers || [])[0] || {};
      Object.keys(s0).forEach(function (k) { put('seller.' + k, s0[k], tsrc['seller.' + k] || '서류'); });
      (st.transferContracts || []).forEach(function (ct, i) { ['date', 'totalPrice', 'transferCause'].forEach(function (k) { put('c' + i + '.' + k, ct[k], tsrc['c' + i + '.' + k] || '서류'); }); const b = (ct.buyers || [])[0] || {}; Object.keys(b).forEach(function (k) { put('c' + i + '.buyer.' + k, b[k], tsrc['c' + i + '.buyer.' + k] || '서류'); }); });
      (st.transferAssets || []).forEach(function (a, i) { Object.keys(a).forEach(function (k) { if (/^(id|transferContractId|acquisitionExpenseItems)$/.test(k)) return; put('a' + i + '.' + k, a[k], tsrc['a' + i + '.' + k] || '서류'); }); const ci = Number(String(a.transferContractId || '').replace(/\D/g, '')) || 1; if (ci !== i + 1) put('a' + i + '.contract', 'c' + (ci - 1), '옛 계산기 입력'); });
    }
    Object.keys(tr).forEach(function (p) { const x = tr[p]; if (!x) return; if (p === 'costs') put('costs', x.v, x.src); else if (p === 'taxfee') put('taxfee', x.v, x.src); else if (p === '사건분류') put('사건분류', x.v, x.src); else put(p, x.v, x.src); });
    if (c.기준일) put('기준일', c.기준일, (sv.filled && sv.filled.기준일 && sv.filled.기준일.src) || '사건 기준일');
    // 질문·결정은 여기서 옮기지 않는다 — 사건 처리 저장 파일을 처음 불러올 때(caseProcQMigrate_) 장부 질문 줄로 옮겨진다
    ledgerLogTo_(L, { by: '옮김', what: '옛 저장소 옮김', detail: '값 ' + n + '줄 · 물어볼 것 ' + asked + '줄' });
    return { ok: true, moved: n, asked: asked, message: '옛 저장소에서 값 ' + n + '줄·물어볼 것 ' + asked + '줄을 장부로 옮김' };
  });
}

// ── 옛 처리 경로 → 장부 (이음새) ──
// 옛 칸 이름(calc:a0.assetType·expenses·trTaxFee·ov:사건분류·base·ovAsset:0:취득일·cls:양수인관계 …) → 장부 칸 경로. 모르는 것은 ''
function ledgerTargetPath_(target) {
  let t = String(target || '').trim(), m;
  if (!t) return '';
  const fixed = { expenses: 'costs', 'calc:costs': 'costs', trTaxFee: 'taxfee', 'calc:taxfee': 'taxfee', 'ov:사건분류': '사건분류', base: '기준일', 'ov:기준일': '기준일', 'cls:양수인관계': 'c0.buyer.relation', 'cls:세대주택수': 'seller.multiHouseCount', 'cls:오피스텔': 'a0.assetType', 'ov:trBuyerRelation': 'c0.buyer.relation', 'ov:trTransferorName': 'seller.name', 'ov:trTransferorRegNo': 'seller.regNo', 'ov:trTransferorAddress': 'seller.address', 'ov:trBuyerName': 'c0.buyer.name', 'ov:trBuyerRegNo': 'c0.buyer.regNo', trRelFmv: 'relFmv' };
  if (fixed[t]) return fixed[t];
  if ((m = /^ledger:(.+)$/.exec(t))) return m[1];
  if ((m = /^calc:(.+)$/.exec(t))) return m[1];
  // [2026.10.28] 증여 — 처리개요 칸(ov:gift…)이 곧 계산기 칸 → 장부 g.<칸>. 상속 — 세부 질문(ih:재산·장례비 줄·사전증여 …)은 장부 i.q.<열쇠>(답은 상속 사실 계산에 들어가 i.* 계산기 칸을 다시 만든다)
  if ((m = /^ov:(gift\w+)$/.exec(t))) return 'g.' + m[1];
  if (t === 'giftdeal') return 'g.deal';
  if ((m = /^ih:(.+)$/.exec(t))) return 'i.q.' + m[1];
  if ((m = /^ihdiv:(.+)$/.exec(t))) return 'i.qdiv.' + m[1];
  if (t === 'ihdebts') return 'i.q.debts';
  if (/^(g|i)\./.test(t)) return t;
  if ((m = /^ovAsset:(\d+):(.+)$/.exec(t))) { const k = { 양도가액: 'c0.totalPrice', 취득가액: 'a' + m[1] + '.acquisitionPrice', 취득일: 'a' + m[1] + '.acquisitionDate', assetLocation: 'a' + m[1] + '.assetLocation', 주택판단: 'a' + m[1] + '.assetType' }[m[2]]; return k || ''; }
  if (/^(seller\.|c\d+\.|a\d+\.|costs$|taxfee$|사건분류$|기준일$|doc:)/.test(t)) return t;
  return '';
}
// GAS 서류 읽기·규칙 정리가 만든 계산기 입력(S.state·S.src·S.cands) → 장부. 값은 서류/규칙(확실), 후보가 갈리는 칸은 물어볼 것.
//  서류 모순(양도일이 취득일보다 앞섬·양수인 이름 = 양도인)은 값을 믿지 않고 물어볼 것으로 — 혼자 정하지 않는다(10-28 김향숙: 취득계약서가 양도계약 01로 서서 양도일 2019 < 취득일 2022)
function ledgerFromGas_(c, S) {
  if (!S || !S.state) return { ok: false, error: '계산기 입력 없음' };
  const st = S.state, src = S.src || {}, cands = S.cands || {}, ops = [];
  const kindOf = function (s) { s = String(s || ''); return /규칙 정리|빠른 날|검산 일치|사건 기준일|교차검증/.test(s) ? '규칙' : '서류'; };
  const fileOf = function (s) { return (String(s || '').match(/[\w가-힣().\-_ ]+\.(pdf|jpg|jpeg|png|xlsx?|hwp|docx?)/i) || [''])[0].slice(0, 80); };
  const push = function (path, v) {
    if (v === '' || v === undefined || v === null || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) return;
    if (/^(seller\.|c\d+\.|a\d+\.)/.test(path) && /(^|\.)(id|transferContractId|acquisitionExpenseItems|totalExpenseItems|externalMembers|buyers|provisional|_\w+)$/.test(path)) return;
    const s = String(src[path] || '');
    if (!s) return; // 출처 없는 값은 계산기 입력의 기본값(양도가액 0·양도 원인 '매매' 등)이지 서류에서 읽은 사실이 아니다 — 장부에 적지 않는다(10-28 배애란: 양도가액 0원이 서류 값으로 섰던 것)
    if (v === 0 || v === '0') return;
    if (/^(세무사님|🤖|AI 판단|넥스)/.test(s)) return; // 답 저장소에서 온 값은 그 주인이 이미 장부에 적었다
    if (cands[path] && cands[path].length) return; // 후보가 갈리는 칸은 아래에서 물어볼 것으로
    ops.push({ path: path, value: v, kind: kindOf(s), by: 'GAS', file: fileOf(s), quote: s.slice(0, 160), sure: /⚠|확인 필요|원문 확인|검산 안 됨|추정/.test(s) ? '애매' : '확실' });
  };
  const s0 = (st.transferSellers || [])[0] || {};
  Object.keys(s0).forEach(function (k) { push('seller.' + k, s0[k]); });
  (st.transferContracts || []).forEach(function (ct, i) {
    Object.keys(ct).forEach(function (k) { if (k !== 'buyers' && k !== 'name') push('c' + i + '.' + k, ct[k]); });
    const b = (ct.buyers || [])[0] || {}; Object.keys(b).forEach(function (k) { push('c' + i + '.buyer.' + k, b[k]); });
  });
  (st.transferAssets || []).forEach(function (a, i) {
    Object.keys(a).forEach(function (k) { push('a' + i + '.' + k, a[k]); });
    const ci = Number(String(a.transferContractId || '').replace(/\D/g, '')) || (i + 1); if (ci !== i + 1) ops.push({ path: 'a' + i + '.contract', value: 'c' + (ci - 1), kind: '규칙', by: 'GAS', quote: '계산기 입력 자산-계약 연결' });
  });
  Object.keys(cands).forEach(function (p) {
    const path = ledgerTargetPath_(p) || p; if (!/^(seller\.|c\d+\.|a\d+\.|costs$|taxfee$|사건분류$|기준일$)/.test(path)) return;
    ops.push({ ask: true, path: path, question: '서류에서 값이 하나로 정해지지 않음 — 후보 중 고르거나 직접 넣어 주세요', cands: (cands[p] || []).map(function (x) { return { v: x.v, src: x.src }; }), by: 'GAS' });
  });
  // 서류 모순 → 물어볼 것(값을 믿지 않음). 모순이 하나라도 있으면 계약 수·역할 자체가 의심스러우니 둘째 계약부터는 값으로 적지 않고 전부 물어볼 것으로(허상 계약 방지)
  const sName = String(s0.name || '').replace(/\s+/g, '');
  const asks = [], suspect = [];
  (st.transferContracts || []).forEach(function (ct, i) {
    const b = (ct.buyers || [])[0] || {};
    if (b.name && sName && String(b.name).replace(/\s+/g, '') === sName) { suspect.push(i); asks.push({ ask: true, path: 'c' + i + '.buyer.name', question: '서명란 매수인 이름이 양도인(' + sName + ')과 같게 읽혔습니다 — 글자인식 순서가 섞인 것일 수 있어 양수인 이름을 정해 주세요', cands: [], by: 'GAS' }); }
    (st.transferAssets || []).forEach(function (a) {
      if (a.transferContractId !== ct.id || !ct.date || !a.acquisitionDate) return;
      if (String(ct.date) < String(a.acquisitionDate)) { suspect.push(i); asks.push({ ask: true, path: 'c' + i + '.date', question: '양도일(' + ct.date + ')이 취득일(' + a.acquisitionDate + ')보다 앞섭니다 — 이 계약서가 양도 계약인지(취득 계약을 양도로 읽은 것은 아닌지) 확인이 필요합니다. ' + String(src['c' + i + '.transferCause'] || ''), cands: [{ v: ct.date, src: src['c' + i + '.date'] || '' }], by: 'GAS' }); }
    });
  });
  if (suspect.length && (st.transferContracts || []).length >= 2) {
    const why = '계약서 ' + st.transferContracts.length + '건이 모두 양도로 읽혔는데 모순(양도일<취득일 또는 양수인=양도인)이 있어 계약 수·역할이 확실하지 않음 — 어느 서류가 양도계약서인지 정해 주세요';
    for (let k = ops.length - 1; k >= 0; k--) { const m = /^(c|a)(\d+)\./.exec(ops[k].path); if (m && Number(m[2]) >= 1 && !ops[k].ask) { const o = ops[k]; ops[k] = { ask: true, path: o.path, question: why, cands: [{ v: o.value, src: o.quote || o.file || o.kind }], by: 'GAS' }; } }
    asks.push({ ask: true, path: 'doc:양도계약서.role', question: why + '. ' + (st.transferContracts || []).map(function (ct, i) { return '계약 ' + (i + 1) + ': 양도일 ' + (ct.date || '?') + ' · ' + String(src['c' + i + '.transferCause'] || ''); }).join(' / '), cands: (st.transferContracts || []).map(function (ct, i) { return { v: '양도계약서', src: '계약 ' + (i + 1) + ' ' + String(src['c' + i + '.transferCause'] || '') }; }), by: 'GAS' });
  }
  asks.forEach(function (a) { ops.push(a); });
  if (c && c.기준일) ops.push({ path: '기준일', value: c.기준일, kind: '규칙', by: 'GAS', quote: '사건 기준일(양도일)' });
  // GAS가 지난 읽기에서 적었는데 이번 읽기에는 없는 값은 GAS 자기 줄이므로 지운다(서류를 다시 읽으면 GAS 주장은 통째로 새로 선다 — 사람·넥스 줄은 그대로)
  const L0 = ledgerLoad_(c.id), have = {}; ops.forEach(function (o) { have[o.path] = true; });
  Object.keys(L0.rows).forEach(function (p) { const r0 = L0.rows[p]; if (!have[p] && r0 && r0.state === '확정' && r0.src && /^(서류|규칙)$/.test(r0.src.kind) && /^(seller\.|c\d+\.|a\d+\.)/.test(p)) ops.push({ drop: true, path: p, by: 'GAS' }); });
  const r = ledgerBatch_(c.id, ops);
  ledgerMutate_(c.id, function (L) { ledgerLogTo_(L, { by: 'GAS', what: '서류 읽기 반영', detail: '값 ' + r.set + '줄 · 물어볼 것 ' + r.asked + '줄' + (r.refused ? ' · 주인 있는 칸 ' + r.refused + '줄은 그대로' : '') + (r.errors.length ? ' · 못 넣음 ' + r.errors.length : '') }); });
  return r;
}
// 서류 → 역할 → 칸. GAS 증빙 읽기가 본 모든 서류의 역할을 장부 줄(doc:<파일>.role)로 — 종류를 정한 서류는 규칙 값, 못 정한 서류(글자는 읽음·글자를 못 읽음)는 "이 서류가 무엇인지" 물어볼 것.
//  종류를 못 정한 서류를 조용히 버리지 않는다(10-15 "파일을 말없이 건너뛰지 않는다"). 넥스가 맡은 사건이면 넥스가 그 파일을 먼저 읽어 역할을 정하고 사실을 적는다.
function ledgerDocRoles_(c, docs, unknown) {
  const ops = [], seen = {};
  const unk = {}; (unknown || []).forEach(function (f) { if (f && f.name) unk[f.name] = true; });
  (docs || []).forEach(function (f) {
    if (!f || !f.name || seen[f.name]) return; seen[f.name] = true;
    const path = 'doc:' + String(f.name).slice(0, 80) + '.role';
    if (unk[f.name]) {
      const noText = !!(f.p && !f.p.t && f.p.nt);
      const n = f.p && typeof f.p.n === 'number' ? f.p.n : -1, head = (f.p && f.p.head) || '';
      // 읽은 것이 무엇인지 그대로 보인다 — "글자는 읽음"이 아니라 "N자 읽음, 시작 글: …". 글자가 아주 적으면(암호 잠김·빈 쪽·그림) 증빙 받을 것으로
      const tiny = noText || (n >= 0 && n < 40);
      const readTxt = noText ? '글자를 하나도 읽지 못함(그림만·흐린 사진·암호 잠김)' : (n >= 0 ? '읽은 글자 ' + n + '자' + (head ? ' · 시작: "' + head.slice(0, 80) + '"' : '') : '읽은 글자 수 기록 없음(지난 읽기)');
      ops.push({ ask: true, path: path, label: '서류 역할 — ' + String(f.name).slice(0, 30), question: (tiny ? '서류를 제대로 읽지 못했습니다 — ' + readTxt + '. 암호가 걸린 PDF면 암호를 풀어 다시 넣어 주시거나, 무엇인지 정해 주세요' : '서류 종류를 규칙으로 정하지 못했습니다 — ' + readTxt + '. 넥스가 읽어 역할을 정하거나 골라 주세요') + '. 역할이 정해지기 전엔 칸 질문을 내지 않습니다', cands: LEDGER_DOC_ROLES_.map(function (r) { return { v: r, src: '역할 고르기' }; }), by: 'GAS', needDoc: tiny });
      return;
    }
    const label = f.p && (f.p.l || f.p.t) ? String(f.p.l || f.p.t) : '';
    if (!label) return;
    ops.push({ path: path, value: label, kind: '규칙', by: 'GAS', file: String(f.name).slice(0, 80), quote: '서류 규칙 판별', sure: '확실' });
  });
  if (!ops.length) return { ok: true, set: 0, asked: 0 };
  const r = ledgerBatch_(c.id, ops);
  ledgerMutate_(c.id, function (L) { ledgerLogTo_(L, { by: 'GAS', what: '서류 역할', detail: '정함 ' + r.set + '개 · 못 정함(물어볼 것) ' + r.asked + '개' }); });
  return r;
}
// ── 질문 = 장부 줄 [2026.10.28 시정 2단계 — 질문 목록 단일화] ──
// 예전: GAS가 낸 질문은 화면이 받아 서버에 "남은 질문(remaining)"으로 저장해야만 남았고(화면 없이 도는 길 — 넥스 지휘·점검 — 에선 질문이 사라짐),
//  질문 결정(decisions)은 또 따로, 장부에는 그 일부를 베껴 적었다(ledgerFromQuestions_·ledgerMirrorDecide_). 셋이 어긋나 "답했는데 질문이 안 닫힘"·"같은 답 세 번"이 났다(10-28 김향숙).
// 이제: 질문 하나 = 장부 줄. 넣을 칸이 있으면 그 칸 줄(rows[칸].qs[질문id]), 칸이 없는 판단·서류 확인 질문은 질문 줄(rows['q:'+질문id]). 결정은 그 줄의 qd[질문id]와 줄 상태.
//  사건 처리 저장 파일은 질문·결정을 갖지 않는다 — 저장 입구(caseProcStore_·caseProcPatch_)가 장부로 보내고, 불러오기(caseProcLoad_)는 ledgerQRead_로 붙인다.
//  칸 값이 세무사님·넥스로 정해지면 그 칸의 질문은 닫힌다(규칙 ⑥ — 질문 목록이 따로 없으니 어긋날 수 없다).
function ledgerQPath_(it) {
  const p = it && it.ask && it.ask.target ? ledgerTargetPath_(it.ask.target) : '';
  return p || ('q:' + String((it && it.id) || '').slice(0, 160));
}
function ledgerQOpenState_(s) { return /^(물어볼것|증빙받을것|보류)$/.test(String(s || '')); }
// 이 질문이 세운 물음을 거둘 때 돌아갈 상태 — 질문 전에 값이 정해져 있었으면 그 값·상태로
function ledgerQBack_(r) {
  const h = Array.isArray(r.hist) ? r.hist : [];
  for (let i = h.length - 1; i >= 0; i--) { if (h[i] && h[i].kind === '질문') { const pv = h[i].prev; return pv && (pv.state === '확정' || pv.state === '추정') && r.v !== '' && r.v !== undefined && r.v !== null ? pv : null; } }
  return null;
}
// 서류 → 칸 이음 점검 [2026.10.28] — 파일 장부(caseProcLedger_)에서 "읽음·종류 앎"인데 내용이 어느 칸에도 쓰이지 않고 증빙목록 표시만 된 서류는 장부 물음(doc:<파일>.use).
//  관련 서류가 폴더에 있는데 칸에 들어간 것이 없으면 그 칸 값을 확정할 근거가 없다(10-28 원문 "확보된 정보를 최대한 활용 … 부족한 정보는 물어보거나 확보할 증빙으로").
//  그 서류가 나중에 칸에 쓰이면(처리에 씀) GAS가 세운 이 물음은 내려간다. 세무사님이 무시하면 그대로 무시.
function ledgerDocUse_(c, fileRows) {
  if (!c || !Array.isArray(fileRows)) return null;
  const L0 = ledgerLoad_(c.id), ops = [], want = {};
  fileRows.forEach(function (r) {
    if (!r || !r.n || r.st !== '읽음' || r.use !== '증빙목록 확보') return;
    const path = 'doc:' + String(r.n).slice(0, 80) + '.use'; want[path] = true;
    ops.push({ ask: true, path: path, label: '서류 내용 — ' + String(r.n).slice(0, 30), by: 'GAS', cands: [],
      question: '「' + String(r.kind || '서류') + '」(' + r.n + ')는 무슨 서류인지는 알아봤지만 그 안의 금액·날짜를 계산기 어느 칸에도 넣지 못했습니다. 이 서류의 값이 들어갈 칸(📒 사건 장부)에 넣어 주시거나, 넣을 것이 없으면 「무시」를 눌러 주세요.' });
  });
  Object.keys(L0.rows).forEach(function (p) { const r = L0.rows[p]; if (/^doc:.+\.use$/.test(p) && !want[p] && /^(물어볼것|증빙받을것)$/.test(r.state) && r.src && r.src.kind === '질문' && r.src.who === 'GAS' && !r.qd) ops.push({ drop: true, path: p, by: 'GAS' }); });
  return ops.length ? ledgerBatch_(c.id, ops) : { ok: true, asked: 0, dropped: 0 };
}
// 쓰기 — rem: 질문 목록(순서대로; undefined면 질문은 그대로), dec: 질문 결정 지도 {질문id:{d,at,text,note}}(undefined면 결정은 그대로)
//  o.partial: 이번 목록이 질문 전부가 아님(가벼운 다시 맞추기 — 사건파악·메모 질문을 다시 만들지 않음) → 목록에 없다고 떼지 않는다
function ledgerQWrite_(caseId, rem, dec, o) {
  o = o || {};
  const san = typeof caseProcQSan_ === 'function' ? caseProcQSan_ : function (x) { return JSON.parse(JSON.stringify(x)); };
  return ledgerMutate_(caseId, function (L) {
    const out = { asked: 0, attached: 0, removed: 0, decided: 0 };
    const rowOf = function (id) { const ps = Object.keys(L.rows); for (let i = 0; i < ps.length; i++) { const r = L.rows[ps[i]]; if ((r.qs && r.qs[id]) || (r.qd && r.qd[id])) return ps[i]; } return ''; };
    if (Array.isArray(rem)) {
      const want = {}; rem.forEach(function (it, i) { if (it && it.id) want[String(it.id)] = { it: it, n: i }; });
      // 1) GAS가 더는 묻지 않는 질문(이번 목록에 없고 결정도 없음)은 줄에서 뗀다 — 그 질문이 세운 물음이면 거둔다
      if (!o.partial) Object.keys(L.rows).forEach(function (p) {
        const r = L.rows[p]; if (!r.qs) return;
        Object.keys(r.qs).forEach(function (id) { if (!want[id] && !(r.qd && r.qd[id] && r.qd[id].d) && !(dec && dec[id] && dec[id].d)) { delete r.qs[id]; out.removed++; } });
        if (Object.keys(r.qs).length) return;
        delete r.qs;
        if (r.qAsk && /^(물어볼것|증빙받을것)$/.test(r.state)) {
          const back = ledgerQBack_(r);
          if (back) { r.state = back.state; r.ask = ''; r.cands = []; }
          else if (!r.qd || !Object.keys(r.qd).length) { delete L.rows[p]; return; }
        }
        delete r.qAsk;
      });
      // 2) 이번 목록의 질문 — 그 칸 줄(없으면 질문 줄)에 붙인다. 칸 값이 세무사님·넥스로 이미 정해졌으면 물음을 세우지 않는다(답하면 닫힘)
      Object.keys(want).forEach(function (id) {
        const it = want[id].it, path = rowOf(id) || ledgerQPath_(it), prev = L.rows[path];
        const hi = prev && (prev.state === '확정' || prev.state === '추정') && (LEDGER_RANK_[prev.src && prev.src.kind] || 0) > 1;
        const decided = (prev && prev.qd && prev.qd[id] && prev.qd[id].d) || (dec && dec[id] && dec[id].d);
        if (!hi && !decided && !/^ledger:/.test(id)) { // ledger:<칸> 질문은 장부 물음을 그대로 보인 것 — 다시 세우지 않는다
          const a = it.ask || {};
          const cands = (a.cands || []).map(function (x) { return { v: x.v, src: x.src || x.label || '' }; })
            .concat((a.options || []).filter(function (x) { return x && x.value !== undefined && x.value !== ''; }).map(function (x) { return { v: x.value, src: '선택지: ' + String(x.label || '') }; }));
          const lab = String(a.label || (/^q:/.test(path) ? String(it.text || '').slice(0, 30) : '') || ledgerLabel_(path));
          ledgerAskInner_(L, path, { label: lab, question: String(it.text || ''), cands: cands, by: 'GAS', needDoc: /증빙\s*(받|요청)|서류를\s*(넣|받)/.test(String(it.text || '')) && !cands.length, keep: true });
          L.rows[path].qAsk = true; out.asked++;
        }
        const row = L.rows[path] || (L.rows[path] = { label: ledgerLabel_(path), v: '', state: '물어볼것', src: { kind: '질문', who: 'GAS' }, at: caseProcNow_() });
        row.qs = row.qs || {}; const q = san(it); q._n = want[id].n; row.qs[id] = q; out.attached++;
      });
    }
    if (dec && typeof dec === 'object') {
      // 3) 결정 — 취소된 결정은 떼고(그 결정이 만든 보류·무시는 물음으로 되돌림), 새 결정은 줄 상태로
      Object.keys(L.rows).forEach(function (p) {
        const r = L.rows[p]; if (!r.qd) return;
        Object.keys(r.qd).forEach(function (id) {
          if (dec[id] && dec[id].d) return;
          delete r.qd[id];
          if (/^(보류|무시)$/.test(r.state) && r.qdState) { r.state = r.qs && Object.keys(r.qs).length ? '물어볼것' : r.state; delete r.qdState; }
        });
        if (!Object.keys(r.qd).length) { delete r.qd; if (/^q:/.test(p) && !r.qs) delete L.rows[p]; }
      });
      Object.keys(dec).forEach(function (id) {
        const d = dec[id]; if (!d || !d.d) return;
        const p = rowOf(id) || (/^ledger:/.test(id) ? id.slice(7) : 'q:' + String(id).slice(0, 160));
        const r = L.rows[p] || (L.rows[p] = { label: String(d.text || id).slice(0, 30), v: '', state: '물어볼것', src: { kind: '질문', who: '결정' }, at: caseProcNow_() });
        r.qd = r.qd || {};
        const nd = { d: String(d.d).slice(0, 4), at: String(d.at || '').slice(0, 10), text: String(d.text || '').slice(0, 200), note: String(d.note || '').slice(0, 200) };
        if (JSON.stringify(r.qd[id] || null) === JSON.stringify(nd)) return;
        r.qd[id] = nd; out.decided++;
        const open = ledgerQOpenState_(r.state) || r.state === '무시';
        if (/^(보류|예정)$/.test(nd.d) && open) { r.state = '보류'; r.qdState = true; }
        else if (nd.d === '무시' && open) { r.state = '무시'; r.qdState = true; }
        else if (nd.d === 'done' && open) {
          if (r.v !== '' && r.v !== undefined && r.v !== null) { r.state = '확정'; r.ask = ''; }
          else if (/^q:/.test(p)) { r.state = '확정'; r.v = '확인'; r.ask = ''; }
          delete r.qdState;
        }
        ledgerLogTo_(L, { by: '결정', what: '질문 결정 ' + nd.d, path: p, detail: (r.label || p) + (nd.text ? ' — ' + nd.text.slice(0, 100) : '') });
      });
    }
    return out;
  });
}
// 읽기 — 열린 질문 목록(옛 remaining 모양, 질문 순서대로)과 질문 결정 지도(옛 decisions 모양). 닫힌 질문(칸 값이 정해짐)은 결정 'done'으로 보인다
function ledgerQRead_(caseId) {
  const L = ledgerLoad_(caseId), items = [], dec = {};
  Object.keys(L.rows).forEach(function (p) {
    const r = L.rows[p];
    Object.keys(r.qd || {}).forEach(function (id) { dec[id] = r.qd[id]; });
    Object.keys(r.qs || {}).forEach(function (id) {
      const it = r.qs[id], qd = r.qd && r.qd[id];
      if (qd && (qd.d === 'done' || qd.d === '무시')) return;
      if (!ledgerQOpenState_(r.state) && !(qd && /^(보류|예정)$/.test(qd.d))) { dec[id] = { d: r.state === '무시' ? '무시' : 'done', at: String(r.at || '').slice(0, 10), text: String(it.text || '').slice(0, 200), note: '장부 ' + (r.label || p) + ' ' + r.state }; return; }
      items.push(it);
    });
    // GAS 질문이 붙지 않은 물음(서류 역할·서류 모순·넥스가 세운 물음)도 질문 목록에 — 세무사님이 AI 없이 GAS 화면만 쓰셔도 같은 물음을 보고 답한다(답은 장부 그 칸으로)
    if (!/^q:/.test(p) && ledgerQOpenState_(r.state) && !(r.qs && Object.keys(r.qs).some(function (id) { return !(r.qd && r.qd[id] && /^(done|무시)$/.test(r.qd[id].d)); }))) {
      const id = 'ledger:' + p;
      const opts = /\.role$/.test(p) && /^doc:/.test(p) ? LEDGER_DOC_ROLES_.map(function (x) { return { label: x, value: x }; }) : null;
      const en = ledgerEnumOf_(p);
      const it = { id: id, step: 'ledger', kind: r.state === '증빙받을것' ? 'missing' : 'judge', text: String((r.label || p) + ' — ' + (r.ask || '값을 정해 주세요')).slice(0, 300),
        ask: { mode: opts || en ? 'options' : 'choose', target: id, label: r.label || p, cands: (r.cands || []).map(function (x) { return { v: String(x.v), label: '', src: String(x.src || '') }; }), options: opts || (en ? LEDGER_ENUMS_[en].codes.map(function (k) { return { label: LEDGER_ENUMS_[en].ko[k], value: k }; }) : undefined), withInput: !opts && !en } };
      it._n = /^doc:/.test(p) ? -1000 : -1;
      if (r.qd && r.qd[id] && /^(보류|예정)$/.test(r.qd[id].d)) dec[id] = r.qd[id];
      items.push(it);
    }
  });
  items.sort(function (a, b) { return (a._n || 0) - (b._n || 0); });
  return { remaining: items.map(function (it) { const x = Object.assign({}, it); delete x._n; return x; }), decisions: dec };
}
// 사이드바 답·칸 값 고치기(옛 apply·valueFix) → 장부 같은 값(값 주인 = 답한 이)
function ledgerMirrorApply_(c, body) {
  const path = ledgerTargetPath_(body && body.target); if (!path) return null;
  const who = caseProcWho_(body.src, body.by) === '넥스' ? '넥스' : '세무사님';
  let v = body.value; if (path === 'costs' && typeof v === 'string') { try { v = JSON.parse(v); } catch (e) {} }
  const r = ledgerSet_(c.id, { path: path, value: v, kind: who, by: who, why: String(body.why || body.src || '').slice(0, 160), label: body.label });
  return r;
}
// 장부 값을 계산기 입력 위에 덮는다(장부가 이긴다) — 세액계산 화면이 받는 입력
function ledgerOverlayState_(caseId, state) {
  const L = ledgerLoad_(caseId);
  if (!Object.keys(L.rows).length) return { state: state, n: 0 };
  const st = JSON.parse(JSON.stringify(state || { transferSellers: [{}], transferContracts: [], transferAssets: [], acquisitionContracts: [] }));
  const cs = ledgerCalcState_(caseId);
  // 장부에서 만든 상태의 값이 있는 칸만 덮는다(장부에 없는 계산기 보조 칸은 옛 입력 그대로)
  const over = function (dst, srcO) { Object.keys(srcO || {}).forEach(function (k) { const v = srcO[k]; if (v === '' || v === undefined || v === null) return; if (Array.isArray(v) && !v.length) return; if (k === 'buyers') { dst.buyers = dst.buyers && dst.buyers.length ? dst.buyers : [{}]; over(dst.buyers[0], (v[0] || {})); return; } dst[k] = v; }); };
  st.transferSellers = st.transferSellers && st.transferSellers.length ? st.transferSellers : [{}];
  over(st.transferSellers[0], cs.state.transferSellers[0]);
  cs.state.transferContracts.forEach(function (ct, i) { if (!st.transferContracts[i]) st.transferContracts[i] = ct; else over(st.transferContracts[i], ct); });
  cs.state.transferAssets.forEach(function (a, i) { if (!st.transferAssets[i]) st.transferAssets[i] = a; else over(st.transferAssets[i], a); });
  // 장부에 계약·자산이 더 적으면(옛 입력이 허상 계약을 만들었으면) 장부 수에 맞춘다
  if (cs.state.transferContracts.length && st.transferContracts.length > cs.state.transferContracts.length) { st.transferContracts = st.transferContracts.slice(0, cs.state.transferContracts.length); const ids = st.transferContracts.map(function (x) { return x.id; }); st.transferAssets = st.transferAssets.filter(function (a) { return ids.indexOf(a.transferContractId) !== -1; }); }
  return { state: st, n: cs.used.length, gaps: cs.gaps };
}
// ── 화면·넥스용 한 묶음 ──
function ledgerView_(c) {
  const rows = ledgerRows_(c.id), L = ledgerLoad_(c.id);
  const by = {}; LEDGER_STATES_.forEach(function (s) { by[s] = []; });
  rows.forEach(function (r) { (by[r.state] || (by[r.state] = [])).push(r); });
  const calcs = (Array.isArray(c.세액계산결과) ? c.세액계산결과 : []).slice(-5).map(function (e) { return { id: e.id, 구분: e.구분, 최종세액: e.최종세액, 계산일: e.계산일 }; });
  return { ok: true, 사건: (c.사건명 || c.고객명 || '') + ' · ' + (c.세목 || ''), 요약: ledgerSummary_(c.id), 줄: rows, 상태별: by, 기록: (L.log || []).slice(-40), 계산저장본: calcs, 칸코드: LEDGER_ENUMS_, 서류역할: LEDGER_DOC_ROLES_ };
}
// 넥스 도구(채팅 넥스 case_ledger · 지휘 넥스 case_ledger) — 바로 실행. 세무사님 말씀을 옮긴 값은 kind 세무사님(값 주인)·by 넥스(적은 이)
function ledgerToolRun_(input, by) {
  input = input || {};
  const c = typeof job_findCase_ === 'function' ? job_findCase_(String(input.caseId || '')) : null;
  if (!c) return { ok: false, error: '사건을 찾을 수 없습니다: ' + (input.caseId || '(없음)') };
  const d = String(input.do || '').trim();
  const kind = input.kind === '세무사님' ? '세무사님' : input.kind === '추정' ? '추정' : '넥스';
  const who = String(by || '넥스').slice(0, 6);
  let r;
  if (d === 'set') r = ledgerSet_(c.id, { path: input.path, value: input.value, kind: kind, by: who, file: input.file, page: input.page, quote: input.quote, why: input.why, label: input.label, cands: input.cands });
  else if (d === 'ask') r = ledgerAsk_(c.id, { path: input.path, label: input.label, question: input.question || input.why, cands: input.cands, needDoc: !!input.needDoc, by: who });
  else if (d === 'decide') r = ledgerDecide_(c.id, { path: input.path, decision: input.decision, note: input.note || input.why, by: who });
  else if (d === 'undo') r = ledgerUndo_(c.id, { path: input.path, by: who });
  else if (d === 'calc') r = ledgerCalcRun_(c, { by: who });
  else if (d === 'import') r = ledgerImportLegacy_(c);
  else r = { ok: false, error: 'do는 set·ask·decide·undo·calc·import 중 하나' };
  if (r && r.ok) r.남은질문 = ledgerQuestions_(c.id).length;
  return r;
}
// case_proc 입구(step: ledger·ledgerSet·ledgerAsk·ledgerDecide·ledgerUndo·ledgerCalc·ledgerImport) — 화면·넥스·사이드바가 같은 길
function ledgerApi_(c, body) {
  body = body || {};
  const who = body.by === '넥스' ? '넥스' : '세무사님';
  switch (body.step) {
    case 'ledger': return ledgerView_(c);
    case 'ledgerSet': return ledgerSet_(c.id, Object.assign({}, body, { kind: body.kind || who, by: body.by || who }));
    case 'ledgerAsk': return ledgerAsk_(c.id, Object.assign({}, body, { by: body.by || who }));
    case 'ledgerDecide': return ledgerDecide_(c.id, Object.assign({}, body, { by: body.by || who }));
    case 'ledgerUndo': return ledgerUndo_(c.id, Object.assign({}, body, { by: body.by || who }));
    case 'ledgerCalc': return ledgerCalcRun_(c, { by: body.by || who });
    case 'ledgerImport': return ledgerImportLegacy_(c);
    default: return null;
  }
}
