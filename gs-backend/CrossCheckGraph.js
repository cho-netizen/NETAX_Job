// =========================================================
// [2026.10.18 교차검증 2번 — 일반 맞대기 엔진] 세무사님: "데이터를 입체적으로 정보화할 때 일방통행식이 아니라 상호 물리고 물리는 데이터들에 대하여
//  입수한 파일이나 시간에 우선순위를 두지 말고 정확성에 우선을 두고 교차검증". 칸마다 손으로 짜지 않고, 1번 cpFacts_의 사실을
//  (대상 열쇠 × 사실 종류)로 묶어 서류마다 다른 값을 모두 맞댄다. 대상: 자산(동·리+지번[|동호]) · 사람(이름) · 자산+해(공시가격) · 자산+사람(지분) · 사업자.
//  판정은 객관 규칙만: 같은 값 / 서류 안 검산(read.check) / 독립 서류 종류 2개 이상 / 주민번호 앞자리 ↔ 생년월일. 사본(같은 서류 종류·같은 값)은 근거 하나,
//  공통 뽑기(read.conf 불확실)는 판정에 안 씀. 안 갈리면 미결 → AI 몫(표기·판독 차이) — 세무사님 원칙대로 맥락은 AI, 서류에 없는 사실만 사용자.
//  계산기 칸은 칸 이름 규칙(…RegNo → 주민번호, …Address → 주소, …Area → 면적, …DeathDate → 사망일 등)으로 사실 종류에 잇고, 지금 값이 판정과 다르면 출처 단 질문.
// =========================================================
const CXG_ASSET_KINDS_ = /^(지번|동호|지목·용도|토지면적|건물면적|전유면적|대지권면적|임대면적|대지권비율|공유자 수|부동산 고유번호|사용승인일|소재지)$/;
const CXG_PERSON_KINDS_ = /^(주민번호|생년월일|주소|등록기준지|사망일|사망신고일)$/;
const CXG_BIZ_KINDS_ = /^(상호|대표자|개업일|업종)$/;
// 종류별로 값이 달라질 수 있는 것(시점이 다르면 정당) — 어긋나도 "시점 다름 가능"으로 정보만(질문 아님)
const CXG_TIME_VARIANT_ = /^(주소|지목·용도|공유자 수)$/;
// 값이 바뀌면 다시 볼 판단(종류별) — 처리 줄에 적고 처리개요를 다시 돌린다
const CXG_DEPS_ = {
  주민번호: ['신고서 인적사항', '관계(상속인·수증자) 판정', '연령 공제'], 생년월일: ['연령 공제(미성년·연로자)', '관계 판정'], 주소: ['1세대1주택·거주기간', '납세지·관할 세무서'],
  사망일: ['상속개시일·신고기한', '사전증여 합산 기간', '평가기준일'], 토지면적: ['기준시가(공시지가×면적)', '필지 안분'], 건물면적: ['기준시가', '주택 면적 요건'], 전유면적: ['기준시가', '국민주택 규모'],
  대지권면적: ['토지 기준시가'], 대지권비율: ['토지 기준시가'], 지분: ['양도·취득가액 안분', '기준시가 × 지분'], 공시가격: ['환산취득가액', '보충적 평가', '고가주택 판정'],
  '지목·용도': ['비사업용 토지·농지 감면', '주택 여부'], 지번: ['자산 열쇠(필지 묶음)'], 동호: ['자산 열쇠(호실)'], 사용승인일: ['신축 주택 판정']
};
function cxgName_(s) { const n = String(s || '').split('|')[0].replace(/\s+/g, ''); return /^[가-힣]{2,5}$/.test(n) ? n : ''; }
function cxgNorm_(kind, v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.n != null && v.d) return String(Math.round(Number(v.n) / Number(v.d) * 1e6) / 1e6); // 지분·대지권비율 {n,d} → 비율
    return '';
  }
  const s = String(v).trim();
  if (/면적/.test(kind)) { const x = Number(s.replace(/[^\d.]/g, '')); return x ? String(Math.round(x * 100) / 100) : ''; }
  if (kind === '주민번호') { const d = s.replace(/[^\d*]/g, ''); return d.length >= 6 ? (d.indexOf('*') !== -1 || d.length < 13 ? d.slice(0, 6) + '-' : d.slice(0, 6) + '-' + d.slice(6, 13)) : ''; }
  if (/일$/.test(kind)) { const m = /(\d{4})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/.exec(s); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : ''; }
  // [밤 1바퀴 자산 축] 소재지·주소는 번지(숫자)가 있어야 값 — "…관양동"처럼 번지 없는 반쪽 주소·"아파트" 같은 낱말은 맞대기 값이 아님
  if (kind === '소재지' || kind === '주소') { if (!/\d/.test(s)) return ''; try { return tcLocKey_(s).join(' '); } catch (e) { return s.replace(/\s+/g, ''); } }
  // [밤 1바퀴] 동호는 동 이름·호 번호로 — "제상가동 제3층 제303호" = "상가동|303", "303호" = "|303"(동 없음)
  if (kind === '동호') { const h = /(\d+)\s*호/.exec(s) || /(\d{3,4})$/.exec(s.replace(/\s+/g, '')); if (!h) return s.replace(/\s+/g, ''); const d = /(?:제\s*)?([가-힣A-Za-z\d]+?)\s*동/.exec(s.replace(/제?\s*\d+\s*층/g, '')); return (d ? d[1].replace(/^제/, '') : '') + '|' + Number(h[1]); }
  return s.replace(/\s+/g, '').replace(/[()·.,]/g, '');
}
// 값 둘이 같은지 — 주소·소재지는 낱말 일부 생략을 허용(tcLocSame_, 한쪽 낱말이 다른 쪽에 모두 있으면 같음), 주민번호는 가려진 뒷자리면 앞 6자리만, 동호는 호 번호(+동이 둘 다 있으면 동)
function cxgSame_(kind, a, b) {
  if (a === b) return true;
  if (kind === '소재지' || kind === '주소') {
    try { if (tcLocSame_(a, b)) return true; } catch (e) {}
    try { const ka = cxAk_(a), kb = cxAk_(b); if (ka && kb && ka.split('|')[0] === kb.split('|')[0] && (!ka.split('|')[1] || !kb.split('|')[1] || ka === kb)) return true; } catch (e) {} // 동·리+번지(자산 열쇠 앞부분)가 같으면 같은 필지 — 시군구 띄어쓰기·붙여쓰기("안양동안구")·앞말 차이는 표기 차이
    const A = String(a).split(' ').filter(String), Bw = String(b).split(' ').filter(String);
    const sub = function (x, y) { return x.length >= 2 && x.every(function (w) { return y.indexOf(w) !== -1; }); };
    return (sub(A, Bw) || sub(Bw, A)) && A.some(function (w) { return /\d/.test(w) && Bw.indexOf(w) !== -1; });
  }
  if (kind === '주민번호') return a.slice(0, 7) === b.slice(0, 7) && (/-$/.test(a) || /-$/.test(b));
  if (kind === '동호') { const A = String(a).split('|'), Bh = String(b).split('|'); return A.length === 2 && Bh.length === 2 && A[1] === Bh[1] && (!A[0] || !Bh[0] || A[0] === Bh[0]); }
  return false;
}
// [밤 1바퀴 자산 축] 면적·고유번호의 범위 — 집합건물 표제부(단지·건물 전체 대지면적·연면적)와 호실 서류(전유부·분양계약서·등기부 전유)의 면적은 뜻이 달라 따로 맞댄다
function cxgScope_(f) { return /표제부|총괄|토지대장|토지\s*등기/.test(String(f.src && f.src.docType || '')) ? '전체' : '호실'; }
// 사실 하나의 맞대기 대상 열쇠
function cxgSubject_(f) {
  const k = f.keys || {};
  if (f.kind === '지분') { const a = String(k.asset || '').split('|')[0], p = cxgName_(k.person); return a && p ? '자산+사람:' + a + '+' + p : ''; }
  if (f.kind === '공시가격' && f.value && typeof f.value === 'object') { const a = String(k.asset || ''); const y = f.value.연도 || String(f.value.기준일 || '').slice(0, 4); return a && y ? '자산+해:' + a + '+' + y : ''; }
  if (CXG_ASSET_KINDS_.test(f.kind)) {
    const a = String(k.asset || '');
    if (!a) { const rd = String(k.road || '').replace(/\s+/g, ''); return rd ? '도로:' + rd : ''; } // [재점검 2] 지번 열쇠가 없으면 도로명 열쇠로
    return '자산:' + (/^(동호|전유면적|대지권면적|대지권비율)$/.test(f.kind) ? a : a.split('|')[0]) + (/^(토지면적|건물면적|부동산 고유번호)$/.test(f.kind) ? '@' + cxgScope_(f) : ''); // [밤 1바퀴] 전체/호실 범위 나눔
  }
  if (CXG_PERSON_KINDS_.test(f.kind)) { const p = cxgName_(k.person); return p ? '사람:' + p : ''; } // keys.person만(거리로 짐작한 personGuess는 안 씀)
  if (CXG_BIZ_KINDS_.test(f.kind)) { const b = String(k.biz || '').replace(/[^\d]/g, ''); return b.length >= 10 ? '사업자:' + b : ''; }
  // [재점검 2] 계좌·문서번호 열쇠 — 같은 계좌의 같은 날 잔액(잔액증명 ↔ 통장), 같은 계좌의 대출 원금, 같은 접수번호의 접수일·등기 원인
  if (/^(잔액|대출 잔액)$/.test(f.kind) && k.account && (k.date || k.dateFrom)) return '계좌+날짜:' + k.account + '+' + (k.date || k.dateFrom);
  if (f.kind === '대출 원금' && k.account) return '계좌:' + k.account;
  if (/^(접수일|등기 원인|등기 목적)$/.test(f.kind) && k.docNo) return '문서:' + String(k.docNo).split('|').slice(0, 2).join('|');
  return '';
}
function cxgValueOf_(f) { return f.kind === '공시가격' && typeof f.value === 'object' ? (f.value.가격 || f.value.단가 || '') : f.value; }
// 묶기 + 판정 — 돌려주는 것: groups[{subject, kind, classes[{v, docs{종류:[파일]}, ndoc, check}], status, d, rule, why, route}]
function cxGraph_(facts) {
  const G = {};
  (facts || []).forEach(function (f) {
    if (!f || !f.src || f.kind === '서류' || f._copy || (f.read && f.read.conf === '불확실')) return; // 사본(_copy)은 서류 종류 수에 안 셈
    const sj = cxgSubject_(f); if (!sj) return;
    const kind = f.kind, n = cxgNorm_(kind, cxgValueOf_(f)); if (!n) return;
    const g = G[sj + '#' + kind] = G[sj + '#' + kind] || { subject: sj, kind: kind, classes: [] };
    let c = g.classes.filter(function (x) { return cxgSame_(kind, x.n, n); })[0];
    if (!c) { c = { n: n, v: f.raw || String(f.value), docs: {}, check: 0, near: '' }; g.classes.push(c); }
    const dt = f.src.docType || '서류';
    c.docs[dt] = c.docs[dt] || []; if (c.docs[dt].indexOf(f.src.file) === -1) c.docs[dt].push(f.src.file); // 같은 서류 종류의 사본은 종류 하나로 셈
    if (f.read && f.read.check === '일치') c.check++; else if (f.read && f.read.check === '불일치') c.check -= 1;
    if (!c.near && f.src.near) c.near = String(f.src.near).slice(0, 160);
  });
  // 사람: 주민번호 앞 6자리 ↔ 생년월일(YYMMDD) — 같은 사람의 다른 종류끼리도 맞댄다
  Object.keys(G).forEach(function (k) {
    const g = G[k]; if (g.kind !== '생년월일') return;
    const rr = G[g.subject + '#주민번호']; if (!rr) return;
    g.cross = rr.classes.map(function (c) { return c.n.slice(0, 6); });
  });
  return Object.keys(G).map(function (k) {
    const g = G[k];
    g.classes.forEach(function (c) { c.ndoc = Object.keys(c.docs).length; });
    if (g.classes.length === 1) {
      const c = g.classes[0];
      g.status = c.ndoc >= 2 ? '일치' : '단독'; g.d = c.v; g.rule = g.status;
      if (g.cross && g.cross.length && g.cross.indexOf(c.n.slice(2, 4) + c.n.slice(5, 7) + c.n.slice(8, 10)) === -1 && /^\d{4}-/.test(c.n)) { g.status = '미결'; g.why = '생년월일 ↔ 주민번호 앞자리 다름(' + c.n + ' ↔ ' + g.cross.join('/') + ')'; g.route = 'AI(판독)'; }
      return g;
    }
    // 값이 갈려도 모두 같은 서류 종류 하나에서만 나왔으면 서로 다른 칸(연면적·주택면적, 토지·건물 등기부 고유번호 등) — 서류끼리의 어긋남이 아님
    const dts = {}; g.classes.forEach(function (c) { Object.keys(c.docs).forEach(function (d) { dts[d] = 1; }); });
    if (Object.keys(dts).length === 1) { g.status = '같은 서류 안 여러 값'; g.why = Object.keys(dts)[0] + ' 안의 서로 다른 칸으로 보임 — 서류끼리 어긋남 아님'; return g; }
    if (CXG_TIME_VARIANT_.test(g.kind)) { g.status = '시점 다름 가능'; g.why = '서류마다 시점이 달라 값이 바뀔 수 있는 종류(이사·지목 변경 등) — 날짜와 함께 보여 줌'; return g; }
    const ck = g.classes.filter(function (c) { return c.check > 0; }), bad = g.classes.filter(function (c) { return c.check < 0; });
    const strong = g.classes.filter(function (c) { return c.ndoc >= 2; });
    if (ck.length === 1 && bad.length === g.classes.length - 1) { g.status = '판정됨'; g.d = ck[0].v; g.rule = '서류 안 검산'; g.why = '검산이 맞는 값은 하나뿐'; return g; }
    if (strong.length === 1 && g.classes.every(function (c) { return c === strong[0] || c.ndoc <= 1; })) { g.status = '판정됨'; g.d = strong[0].v; g.rule = '독립 서류 일치'; g.why = '서로 다른 서류 ' + strong[0].ndoc + '종이 같은 값, 다른 값은 서류 1종뿐'; return g; }
    g.status = '미결';
    // 값끼리 한두 글자만 다르면 판독·표기 차이(흐린 숫자·오타) — AI 판독 몫, 아니면 맥락 판단(AI)
    const near1 = g.classes.length === 2 && cxgEdit1_(g.classes[0].n, g.classes[1].n);
    g.route = near1 ? 'AI(판독)' : 'AI(맥락)';
    g.why = '값이 ' + g.classes.length + '가지로 갈리고 검산·독립 서류 수로 하나로 안 정해짐' + (near1 ? ' — 한두 글자 차이(판독·표기)' : '');
    return g;
  });
}
function cxgEdit1_(a, b) {
  a = String(a); b = String(b); if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  return d + (a.length - i) + (b.length - j) <= 1;
}
// 세액계산기 칸 전수목록(1,264칸)에서 값이 들어가는 칸(checkbox·select·판단·비율·개수 칸 제외, 지방세 제외) 중 칸 이름이 사실 종류(또는 종류 묶음)에 맞는 221칸 — 칸 키 → 사실 종류(자동 생성, 2026-10-18 재점검 1)
const CXG_FIELD_MAP_ = {"assetLocation":"소재지","assetDong":"동호","assetHo":"동호","assetArea":"토지면적","landPricePerSqmAcquisition":"공시가격","landArea":"토지면적","buildingArea":"건물면적","buildingLandPricePerSqmAcquisition":"공시가격","standardPriceAcquisition":"공시가격","fairMarketValueForGiftCheck":"평가","transferDate":"양도일","transferPrice":"양도가액","buyerRegNo":"주민번호","acquisitionDate":"취득일","acquisitionPrice":"취득가액","acquisitionStandardPriceForExpense":"공시가격","transferStandardPriceForConversion":"공시가격","floorAreaSqm":"토지면적","standardPriceTransfer":"공시가격","buildingLandPricePerSqmTransfer":"공시가격","landPricePerSqmTransfer":"공시가격","shareRatio":"지분","date":"취득일","nblBizYearsFarm":"양도일","p90Price0101":"공시가격","rpaMMarketValue":"평가","tfvMSupplementaryValue":"평가","u9AcquisitionDate":"취득일","pdAcquisitionDate":"취득일","rhAcquisitionDate":"취득일","prAcquisitionDate":"취득일","twNewAcqDate":"취득일","twExpropriationDate":"양도일","mgPriorDeposit":"임대 보증금","mgLeaseDeposit":"임대 보증금","hrOriginalTransferDate":"양도일","ciAcquisitionDate":"취득일","rpAcquisitionDate":"취득일","lrMaStandardPrice":"공시가격","rfLandArea":"토지면적","rfAcquisitionDate":"취득일","icMTransferDate":"양도일","landPrice":"공시가격","housePrice":"공시가격","landPriceForBuilding":"공시가격","gwPurchasedIntangible":"평가","otBookValue":"취득가액","otStandardTaxValue":"평가","tbPropertyValue":"평가","prAcquisitionCost":"취득가액","prDepreciation":"취득일","mrAcquisitionCost":"취득가액","mrDepreciation":"취득일","dfDebtAmount":"채무","lpFairValue":"평가","mgPostValue":"평가","mgOvervaluedValue":"평가","puMarketValueEquiv":"평가","puMarketValue":"평가","ocBeforeShares":"지분","ocAfterShares":"지분","ocAfterValuePerShare":"지분","ocBeforePropertyValue":"평가","spAssetValue":"평가","spPriorTaxesSum":"양도일","spComparisonGiftTax":"양도가액","crValuePerShare":"평가","directValue":"평가","tenantBizNo":"주민번호","deposit":"임대 보증금","ratio":"지분","oaCapitalExpenditure":"비용","newHousingCompletionDate":"사용승인일","rightsValue":"평가","originalAssetAcquisitionPrice":"취득가액","originalNecessaryExpenses":"비용","originalAcquisitionStandardPrice":"공시가격","approvalDateStandardPrice":"공시가격","decedentAcquisitionValue":"취득가액","decedentAcquisitionDate":"취득일","relocationRightAppraisalValue":"평가","convertedBuildingAcquisitionValueForPenalty":"취득가액","acquisitionStandardPrice":"공시가격","registrationStandardPrice":"공시가격","transferStandardPrice":"공시가격","donorAcquisitionPrice":"취득가액","donorAcquisitionDate":"취득일","donorNecessaryExpenses":"비용","doneeOwnAcquisitionPrice":"취득가액","doneeOwnNecessaryExpenses":"비용","nhFiveYearMarkValue":"취득일","nhAcquisitionStandardPrice":"공시가격","nhFiveYearStandardPrice":"공시가격","nhTransferStandardPrice":"공시가격","uhExclusiveAreaSqm":"전유면적","uhFiveYearMarkValue":"취득일","uhAcquisitionStandardPrice":"공시가격","uhFiveYearStandardPrice":"공시가격","uhTransferStandardPrice":"공시가격","rpFiveYearMarkValue":"취득일","rpAcquisitionStandardPrice":"공시가격","rpFiveYearStandardPrice":"공시가격","rpTransferStandardPrice":"공시가격","lrRegistrationValue":"평가","lrAcquisitionStandardPrice":"공시가격","lrRegistrationStandardPrice":"공시가격","lrTransferStandardPrice":"공시가격","address":"주소","addressDong":"동호","addressHo":"동호","mhRentalLocation":"소재지","etDepartureMarketValue":"양도가액","etAcquisitionPrice":"취득가액","etOtherExpenses":"비용","etActualTransferPrice":"양도가액","etTaxManagerAddress":"주소","btYearsSince":"양도일","prTransferDate":"양도일","mrTransferDate":"양도일","stTransferPrice":"양도가액","stTransferDate":"양도일","stAcquisitionPrice":"취득가액","stAcquisitionDate":"취득일","stTransferExpenses":"비용","stDonorAcqPrice":"취득가액","giftAmount":"평가","debtAssumed":"채무","priorRelationDeductionUsed":"증여재산","genSkipAmount":"평가","acqDate":"취득일","acqPrice":"취득가액","acqExpense":"비용","otherAssetsGiftValueSum":"평가","cdDonatedAmount":"평가","bdBusinessValue":"평가","bdTotalValue":"평가","bcYearsSinceBase":"사망일","ikFinancialAsset":"평가","ikTotalValue":"평가","chTotalProperty":"평가","chEligibleProperty":"평가","fmvSupplementaryValue":"평가","fmvSimilar90":"평가","ihDeceasedRegNo":"주민번호","ihDeceasedAddress":"주소","ihDeceasedDong":"동호","ihDeceasedHo":"동호","ihDeathDate":"사망일","ihNonTaxable":"평가","ihPublicOrg":"평가","ihPublicTrust":"평가","ihGrossEstateGeneral":"평가","ihNonHeirBequest":"평가","ihGiftToHeirs":"평가","ihPriorGiftedIncluded":"증여재산","ihSpouseGiftBase":"증여재산","ihNonHeirPriorGiftAmount":"평가","ihNonHeirPriorGiftBase":"증여재산","ihNonHeirPriorGiftTaxPaid":"증여재산","ihNetFinancial":"평가","ihAppraisalFee":"비용","ihBusinessStockValue":"사망일","ihTotalGrossEstate":"평가","ihBusinessHeirNonBizAsset":"평가","ihFarmingIndividualAsset":"평가","ihFarmingStockValue":"사망일","ihDisclaimedRedistributed":"평가","ihGenSkipAmount":"평가","ihReinheritedPropertyValue":"평가","ihPriorInheritanceTotalPropertyValue":"평가","ihYearsSincePrior":"사망일","ihForProfitBequest":"평가","ihReporterRegNo":"주민번호","giftDate":"증여일","giftAppraisalFee":"비용","giftNonTaxable":"평가","giftPublicOrg":"평가","giftPublicTrust":"평가","giftDisabledTrust":"평가","srGiftAmount":"평가","srGiftDate":"증여일","srDebtAssumed":"채무","srAppraisalFee":"비용","ntAppraisalFee":"비용","afTotalValue":"채무","afAppraisalFee":"비용","afGiftDate":"증여일","slOriginalValue":"취득일","slRelationDeduction":"증여재산","slAppraisalFee":"비용","slGiftDate":"증여일","pvEventValue":"평가","pvAcquisitionCost":"취득가액","pvAppraisalFee":"비용","pvGiftDate":"증여일","cbFairValue":"평가","cbAcquisitionCost":"취득가액","cbTransferPrice":"양도가액","cbYearsToMaturity":"취득일","cbRelationDeduction":"증여재산","cbAppraisalFee":"비용","cbGiftDate":"증여일","scRelationDeduction":"증여재산","scAppraisalFee":"비용","edRelationDeduction":"증여재산","edAppraisalFee":"비용","edGiftDate":"증여일","poExcessStockValue":"평가","poRevenueAndDonation":"평가","poTotalAssetValue":"평가","poLiabilityValue":"채무","dtAmount":"평가","gspAmount1":"평가","gspAmount2":"평가","gspAmount3":"평가","gspAmount4":"평가","creditorAddress":"주소","amount":"채무","cohabitHouseDebt":"채무","priorGiftAmount":"평가","priorGiftTaxableBase":"증여재산"};
// 계산기 칸 → (대상, 종류) — 칸 이름 규칙(새 칸이 생겨도 이름 규칙이면 따라옴)
const CXG_FIELD_RULES_ = [
  [/RegNo$|regNo$/, '주민번호'], [/Address$|^address$/, '주소'], [/DeathDate$/, '사망일'], [/BirthDate$|birthDate$/, '생년월일'],
  [/^assetArea$|LandArea$|landArea$/, '토지면적'], [/BuildingArea$|buildingArea$/, '건물면적'], [/ExclusiveArea$|exclusiveArea$/, '전유면적'],
  [/landCategory$|Jimok$|jimok$/, '지목·용도']
];
function cxgFieldKind_(k) { if (CXG_FIELD_MAP_[k]) return CXG_FIELD_MAP_[k]; const r = CXG_FIELD_RULES_.filter(function (x) { return x[0].test(k); })[0]; return r ? r[1] : ''; }
// 지금 계산기·처리개요 값 목록: [{path, target, label, kind, subject, cur}]
function cxgCalcFields_(cc) {
  const out = [], sv = caseProcLoad_(cc.id) || {}, ov = cc.사건개요 || {};
  const person = function (name) { const n = cxgName_(name); return n ? '사람:' + n : ''; };
  if (cc.세목 === 'transfer' && sv.trCalc && sv.trCalc.state) {
    const st = sv.trCalc.state;
    (st.transferSellers || []).forEach(function (s, i) { Object.keys(s).forEach(function (k) { const kd = cxgFieldKind_(k); if (kd && person(s.name)) out.push({ path: 'seller.' + k, target: 'calc:seller.' + k, label: '양도인 ' + kd, kind: kd, subject: person(s.name), cur: s[k] }); }); });
    (st.transferContracts || []).forEach(function (ct, ci) { ((ct.buyers || [])[0]) && Object.keys(ct.buyers[0]).forEach(function (k) { const b = ct.buyers[0], kd = cxgFieldKind_(k); if (kd && person(b.name)) out.push({ path: 'c' + ci + '.buyer.' + k, target: 'calc:c' + ci + '.buyer.' + k, label: '양수인 ' + kd, kind: kd, subject: person(b.name), cur: b[k] }); }); });
    const sellerName = cxgName_(((st.transferSellers || [])[0] || {}).name || cc.납세자);
    (st.transferAssets || []).forEach(function (a, i) {
      const ak = cxAk_(a.assetLocation); if (!ak) return;
      Object.keys(a).forEach(function (k) {
        const kd = cxgFieldKind_(k); if (!kd || a[k] === '' || a[k] == null || typeof a[k] === 'object') return;
        let sj = '';
        if (kd === '지분') sj = sellerName ? '자산+사람:' + ak.split('|')[0] + '+' + sellerName : '';
        else if (/^(동호|전유면적|대지권면적|대지권비율)$/.test(kd)) sj = '자산:' + ak;
        else if (/^(토지면적|건물면적|지목·용도|사용승인일|지번)$/.test(kd)) sj = '자산:' + ak.split('|')[0];
        if (sj) out.push({ path: 'a' + i + '.' + k, target: 'calc:a' + i + '.' + k, label: '자산' + (i + 1) + ' ' + kd, kind: kd, subject: sj, cur: a[k] });
      });
    });
  } else if (cc.세목 === 'gift' || cc.세목 === 'inheritance') {
    Object.keys(ov).forEach(function (k) {
      const kd = cxgFieldKind_(k); if (!kd || typeof ov[k] === 'object') return;
      const base = k.replace(/(RegNo|Address|DeathDate|BirthDate)$/, ''), nm = ov[base + 'Name'] || (kd === '사망일' ? ov[base + 'DeceasedName'] || ov.ihDeceasedName : '');
      if (person(nm)) out.push({ path: k, target: 'ov:' + k, label: k, kind: kd, subject: person(nm), cur: ov[k] });
    });
  }
  return out;
}
// 처리개요 끝(cxResolve0_)에서 부름 — 묶음 판정을 기록하고, 계산기 칸과 어긋나면 출처 단 질문, 빈 칸은 판정 값으로
function cxGraphCheck_(cc, r, facts, rec, applyOne) {
  const groups = cxGraph_(facts);
  const S = rec.graph = { groups: groups.length, multi: 0, 일치: 0, 단독: 0, 판정됨: 0, '시점 다름 가능': 0, 미결: 0, ai판독: 0, ai맥락: 0, byKind: {}, calcFields: 0, calcAgree: 0, calcFilled: 0, calcMismatch: [], changed: [], open: [] };
  groups.forEach(function (g) {
    S[g.status] = (S[g.status] || 0) + 1; if (g.classes.length > 1) S.multi++;
    const bk = S.byKind[g.kind] = S.byKind[g.kind] || { n: 0, 미결: 0, 판정됨: 0 }; bk.n++; if (g.status === '미결') { bk.미결++; if (g.route === 'AI(판독)') S.ai판독++; else S.ai맥락++; S.open.push(g.subject + ' ' + g.kind + ': ' + g.classes.map(function (c) { return c.v + '(' + Object.keys(c.docs).join('·') + ')'; }).join(' ↔ ')); } if (g.status === '판정됨') bk.판정됨++;
  });
  const by = {}; groups.forEach(function (g) { by[g.subject + '#' + g.kind] = g; });
  cxgCalcFields_(cc).forEach(function (fd) {
    const g = by[fd.subject + '#' + fd.kind]; if (!g) return;
    S.calcFields++;
    const cur = cxgNorm_(fd.kind, fd.cur);
    if (cur && g.classes.some(function (c) { return cxgSame_(fd.kind, c.n, cur); }) && (g.status !== '판정됨' || cxgSame_(fd.kind, cxgNorm_(fd.kind, g.d), cur))) { S.calcAgree++; return; }
    const iid = 'cxg:' + fd.path + ':' + cxHash_(g.classes.map(function (c) { return c.n; }).join('|') + '|' + cur);
    const cands = g.classes.slice().sort(function (a, b) { return (b.check - a.check) || (b.ndoc - a.ndoc); }).map(function (c) { return { v: String(c.v), src: Object.keys(c.docs).map(function (d) { return d + ' ' + c.docs[d].slice(0, 2).join(', '); }).join(' / ') + (c.ndoc >= 2 ? ' — 서류 ' + c.ndoc + '종 일치' : '') + (c.check > 0 ? ' — 서류 안 검산 일치' : '') }; });
    const decided = (g.status === '판정됨' || g.status === '일치' || g.status === '단독') ? g.d : null;
    if (!cur && decided != null && g.status !== '단독') {
      if (applyOne({ iid: iid, target: fd.target, label: fd.label, input: 'text', cands: cands, kind: '빈칸' }, String(decided), '교차검증(' + g.rule + '): ' + (g.why || '서류 ' + g.classes[0].ndoc + '종 같은 값'), 'gas', { why: g.why || '', rule: g.rule })) { S.calcFilled++; S.changed.push(fd.kind); rec.gas.push({ iid: iid, label: fd.label, v: decided, rule: g.rule }); }
      return;
    }
    if (!cur) return; // 빈 칸인데 서류 1종뿐이거나 미결 — 기존 질문에 맡김
    if (g.status === '시점 다름 가능' && g.classes.some(function (c) { return cxgSame_(fd.kind, c.n, cur); })) { S.calcAgree++; return; }
    S.calcMismatch.push(fd.label + ' 지금 ' + fd.cur + ' ↔ 서류 ' + g.classes.map(function (c) { return c.v + '(' + c.ndoc + '종)'; }).join(', '));
    if (!cands.some(function (x) { return cxgSame_(fd.kind, cxgNorm_(fd.kind, x.v), cur); })) cands.push({ v: String(fd.cur), src: '지금 계산기·처리개요 값' });
    if (r.items.some(function (it) { return it.id === iid || (it.ask && it.ask.target === fd.target); })) return;
    r.items.push(caseProcItem_(iid, 'check', '🧮 교차검증 — 「' + fd.label + '」 지금 값 ' + fd.cur + '이(가) 서류와 다릅니다. ' + (decided != null && g.status === '판정됨' ? '판정: ' + decided + '(' + g.rule + ')' : g.why || '') + ' — 물린 판단: ' + (CXG_DEPS_[fd.kind] || []).join('·'),
      { mode: 'choose', target: fd.target, input: 'text', label: fd.label, cands: cands }));
  });
  if (S.changed.length) r.lines.push('🔁 교차검증으로 채운 칸에 물린 판단을 다시 봅니다: ' + S.changed.map(function (k) { return k + '(' + (CXG_DEPS_[k] || []).join('·') + ')'; }).join(' / '));
  r.lines.push('🧮 사실 묶음 맞대기: 묶음 ' + S.groups + '개(값이 여러 서류에 나온 것 ' + S.multi + ') — 일치 ' + S.일치 + ' · 서류 1종뿐 ' + S.단독 + ' · 판정됨 ' + S.판정됨 + ' · 시점 다름 가능 ' + S['시점 다름 가능'] + ' · 미결 ' + S.미결 + '(AI 판독 ' + S.ai판독 + ' · AI 맥락 ' + S.ai맥락 + ')'
    + ' / 계산기 칸 ' + S.calcFields + '개 — 일치 ' + S.calcAgree + ' · 채움 ' + S.calcFilled + ' · 어긋남 ' + S.calcMismatch.length + (S.open.length ? ' — 미결 예: ' + S.open.slice(0, 3).join(' / ') : ''));
}

// =========================================================
// [2026.10.18 재점검 1] 계산기 칸 값 대조(전 종류) — 대상 열쇠(자산·사람)로 못 묶는 칸(증여재산가액·채무·보증금·금융재산·비용·공시가격 등)도
//  사건 사실 중 같은 종류(종류 묶음)의 값과 맞대어, 지금 값이 어느 서류에도 없는데 그 종류 값이 서류에 있으면 출처 단 질문으로 낸다(판정은 안 함 — 고르는 것은 사람·AI).
//  같은 종류의 값이 서류에 없으면 "근거 없음"으로만 센다. 질문은 사건당 8개까지(칸 순서대로).
// =========================================================
const CXG_KIND_GROUPS_ = {
  평가: /^(감정가액|공시가격|매매사례가액|매매대금|증여재산가액)$/, 채무: /^(대출 잔액|채무|승계보증금|임대 보증금|대출 원금)$/, 비용: /^(중개보수|법무사 비용|취득세|지방교육세|농어촌특별세|합계|지급액|공급가액)$/,
  증여재산: /^(증여재산|증여재산가액|금액)$/, 잔액: /^(잔액|금융재산 줄)$/, '임대 보증금': /^(임대 보증금|전세금|보증금)$/, 공시가격: /^공시가격$/,
  취득가액: /^(취득가액|매매대금)$/, 양도가액: /^(양도가액|매매대금)$/, 취득일: /^(취득일|잔금일|접수일)$/, 양도일: /^(양도일|잔금일|접수일)$/, 증여일: /^(증여일|접수일)$/, 사망일: /^(사망일|상속개시일)$/
};
function cxgNumOrDate_(v) { const s = String(v == null ? '' : v).trim(); const d = /^(\d{4})\D(\d{1,2})\D(\d{1,2})/.exec(s); if (d) return d[1] + '-' + ('0' + d[2]).slice(-2) + '-' + ('0' + d[3]).slice(-2); const n = s.replace(/[^\d]/g, ''); return n.length >= 4 ? String(Number(n)) : ''; }
function cxgFactNum_(f) { const v = f.kind === '공시가격' && typeof f.value === 'object' ? (f.value.가격 || f.value.단가) : f.value; return typeof v === 'object' ? '' : cxgNumOrDate_(v); }
function cxgValueFields_(cc) {
  const out = [], sv = caseProcLoad_(cc.id) || {}, ov = cc.사건개요 || {};
  const kindOf = function (k) { return CXG_FIELD_MAP_[k] || ''; };
  if (cc.세목 === 'transfer' && sv.trCalc && sv.trCalc.state) {
    (sv.trCalc.state.transferAssets || []).forEach(function (a, i) { const ak = cxAk_(a.assetLocation); Object.keys(a).forEach(function (k) { const kd = kindOf(k); if (!kd || !CXG_KIND_GROUPS_[kd] || /^(취득가액|취득일)$/.test(kd)) return; const cur = cxgNumOrDate_(a[k]); if (cur) out.push({ path: 'a' + i + '.' + k, target: 'calc:a' + i + '.' + k, label: '자산' + (i + 1) + ' ' + kd + '(' + k + ')', group: kd, ak: ak, cur: cur, raw: a[k] }); }); });
  } else if (cc.세목 === 'gift' || cc.세목 === 'inheritance') {
    Object.keys(ov).forEach(function (k) { const kd = kindOf(k); if (!kd || !CXG_KIND_GROUPS_[kd] || typeof ov[k] === 'object') return; const cur = cxgNumOrDate_(ov[k]); if (cur) out.push({ path: k, target: 'ov:' + k, label: k + '(' + kd + ')', group: kd, ak: '', cur: cur, raw: ov[k] }); });
  }
  return out;
}
function cxgValueCheck_(cc, r, facts, rec) {
  const fields = cxgValueFields_(cc), V = { fields: fields.length, agree: 0, noEvidence: 0, mismatch: [] };
  let asked = 0;
  fields.forEach(function (fd) {
    const re = CXG_KIND_GROUPS_[fd.group];
    // [2026.10.19 3번 integ 측정으로 찾은 것] 국세 평가(시가·보충적 평가)를 대조할 때 지방세 잣대 값은 뺀다 — 취득세·등록세·재산세 납부 서류와 법무사 견적서의
    //  '공시가격'·'과세표준'·'시가표준액'은 지방세 시가표준액(정원식: 취득세 납부확인서 432,153,909원)이라 국세 보충적 평가(417,813,909원)와 잣대가 다르다
    const localTax = function (f) { return /취득세|등록세|등록면허세|지방세|재산세|견적서/.test(String((f.src && f.src.docType) || '')) || /시가표준액|과세표준/.test(String(f.kind || '')); };
    const hits = (facts || []).filter(function (f) { return f && f.src && f.kind !== '서류' && !f._copy && re.test(f.kind) && !(f.read && f.read.conf === '불확실') && !(/^(평가|공시가격)$/.test(fd.group) && localTax(f)) && (!fd.ak || !(f.keys && f.keys.asset) || cxAkSame_(f.keys.asset, fd.ak)); });
    const vals = {}; hits.forEach(function (f) { const n = cxgFactNum_(f); if (!n) return; const e = vals[n] = vals[n] || { v: n, docs: {} }; e.docs[f.src.docType || '서류'] = (e.docs[f.src.docType || '서류'] || []).concat(f.src.file); });
    const list = Object.keys(vals).map(function (k) { return vals[k]; });
    if (!list.length) { V.noEvidence++; return; }
    if (vals[fd.cur]) { V.agree++; return; }
    V.mismatch.push(fd.label + ' 지금 ' + fd.raw + ' ↔ 서류 ' + list.slice(0, 4).map(function (e) { return e.v; }).join(', '));
    if (asked >= 8 || r.items.some(function (it) { return it.ask && it.ask.target === fd.target; })) return;
    asked++;
    // 지금 값을 1번에 — 지금 값은 이미 정한 근거(질문 답·보충적 평가 등)가 있는 값이고, 서류 값은 대안이다(예전엔 맨 뒤에 둬 1번으로 답하면 다른 잣대 값이 들어갔다)
    const cands = [{ v: fd.cur, src: '지금 값(이미 정한 값 — 그대로 두려면 이것)' }].concat(list.sort(function (a, b) { return Object.keys(b.docs).length - Object.keys(a.docs).length; }).slice(0, 6).map(function (e) { return { v: e.v, src: Object.keys(e.docs).map(function (d) { return d + ' ' + e.docs[d].slice(0, 2).join(', '); }).join(' / ') }; }));
    r.items.push(caseProcItem_('cxv:' + fd.path + ':' + cxHash_(fd.cur + '|' + list.map(function (e) { return e.v; }).join('|')), 'check', '🧮 교차검증 — 「' + fd.label + '」 지금 값 ' + fd.raw + '이(가) 같은 종류 서류 값 어디에도 없습니다(서류: ' + list.slice(0, 3).map(function (e) { return e.v; }).join(', ') + '). 맞는 값을 고르거나 그대로 두세요.',
      { mode: 'choose', target: fd.target, input: /일$/.test(fd.group) ? 'date' : 'money', label: fd.label, cands: cands }));
  });
  rec.valueCheck = V;
  if (V.fields) r.lines.push('🧮 계산기 칸 값 대조(종류 묶음): 칸 ' + V.fields + ' — 서류 값과 같음 ' + V.agree + ' · 서류에 없는 값 ' + V.mismatch.length + ' · 그 종류 서류 없음 ' + V.noEvidence);
}

// [2026.10.18 재점검 18] 상속 사건분류 자동 확정 전 — 특례를 가리키는 사실(사건 사실 목록에서, 판정 아님·근거로만)
//  가업상속: 사업자 사실(상호·사업자번호·개업일·업종) / 영농상속: 농지 지목(전·답·과수원) / 동거주택: 피상속인과 같은 주소의 상속인
function cxSpecialHints_(c, inh) {
  const facts = cxFacts_(c), out = [];
  const sure = facts.filter(function (f) { return f && f.src && !f._copy && !(f.read && f.read.conf === '불확실'); });
  const biz = sure.filter(function (f) { return /^(상호|사업자번호|개업일|업종)$/.test(f.kind); });
  if (biz.length) out.push('가업 — 사업자 서류(' + biz.slice(0, 2).map(function (f) { return (f.src.docType || '서류') + ' ' + f.src.file; }).join(', ') + ')');
  const farm = sure.filter(function (f) { return f.kind === '지목·용도' && /^(전|답|과수원|과)$/.test(String(f.value).replace(/\s+/g, '')); });
  if (farm.length) out.push('영농 — 농지 지목(' + farm.slice(0, 2).map(function (f) { return f.raw + ' ' + f.src.file; }).join(', ') + ')');
  try {
    const dn = cxgName_(((inh || {}).deceased || {}).name || c.납세자), heirs = ((inh || {}).heirs || []).map(function (h) { return cxgName_(h.name); }).filter(String);
    const addr = function (nm) { return sure.filter(function (f) { return f.kind === '주소' && cxgName_((f.keys || {}).person) === nm; }).map(function (f) { return cxgNorm_('주소', f.value); }); };
    if (dn && heirs.length) { const da = addr(dn); const same = heirs.filter(function (h) { return addr(h).some(function (a) { return da.some(function (b) { return cxgSame_('주소', a, b); }); }); }); if (same.length) out.push('동거주택 — 피상속인과 같은 주소의 상속인 ' + same.join(', ')); }
  } catch (e) {}
  return out;
}

// =========================================================
// [2026.10.19 밤 3바퀴 사람 축] 사람·지분 맞대기(객관 규칙만, 판정 안 함 — 어긋나면 출처 단 확인 질문)
//  ① 등기부 같은 소유권 줄의 공유자 지분 합 = 1  ② 상속재산 분할협의서 재산마다 상속인 귀속 지분 합 = 1
//  ③ 피상속인 본인 기준 가족관계증명서의 배우자·자녀 ↔ 분할협의서 상속인 명단(다르면 상속포기·대습·사망 여부 확인 — 맥락이라 AI·세무사 몫)
// =========================================================
function cxgFrac_(v) {
  if (v && typeof v === 'object') { if (v.n != null && v.d) return Number(v.n) / Number(v.d); if (v.분자 != null && v.분모) return Number(v.분자) / Number(v.분모); if (v.지분) return cxgFrac_(v.지분); return NaN; }
  const s = String(v == null ? '' : v).replace(/\s+/g, ''); let m = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s); if (m) return Number(m[1]) / Number(m[2]);
  m = /(\d+(?:\.\d+)?)분의(\d+(?:\.\d+)?)/.exec(s); if (m) return Number(m[2]) / Number(m[1]); return NaN;
}
function cxPersonChecks_(c, facts) {
  const sure = (facts || []).filter(function (f) { return f && f.src && !f._copy && !(f.read && f.read.conf === '불확실'); });
  const out = { checks: 0, ok: 0, issues: [] };
  const src = function (f) { return (f.src.docType || '서류') + ' ' + f.src.file; };
  // ① 등기 소유권 줄 지분 합
  const reg = {}, partial = {};
  // 등기 목적에 "지분"이 있는 줄(지분 이전)은 넘긴 몫만 적혀 합이 1이 아닌 게 정상 — 소유권 전부 이전 줄만 본다
  sure.forEach(function (f) { if (f.kind === '등기 목적' && /지분/.test(String(f.value)) && /소유권이력\d+/.test(String(f.src.rec || ''))) partial[(f.src.fileId || f.src.file) + '#' + /^(.*?소유권이력\d+)/.exec(f.src.rec)[1]] = 1; });
  sure.forEach(function (f) { if (f.kind !== '지분' || !/소유권이력\d+/.test(String(f.src.rec || ''))) return; const k = (f.src.fileId || f.src.file) + '#' + /^(.*?소유권이력\d+)/.exec(f.src.rec)[1]; const fr = cxgFrac_(f.value); if (!isFinite(fr) || fr <= 0 || fr > 1) return; (reg[k] = reg[k] || []).push({ who: cxgName_((f.keys || {}).person) || '?', fr: fr, raw: f.raw, f: f }); });
  Object.keys(reg).forEach(function (k) {
    const L = reg[k]; if (L.length < 2 || partial[k]) return; out.checks++;
    const seen = {}, uniq = L.filter(function (x) { const kk = x.who + '|' + x.fr; if (seen[kk]) return false; seen[kk] = 1; return true; });
    const sum = uniq.reduce(function (s, x) { return s + x.fr; }, 0);
    if (sum <= 1 + 1e-6) { out.ok++; return; } // 1보다 작으면 지분 일부 이전일 수 있어 묻지 않음(보수적) — 1을 넘으면 확실한 모순
    out.issues.push({ what: '등기 공유자 지분 합', why: uniq.map(function (x) { return x.who + ' ' + x.raw; }).join(' + ') + ' = ' + Math.round(sum * 10000) / 10000 + '(1을 넘음 — 판독이 틀렸거나 다른 줄이 섞임)', src: src(L[0].f) });
  });
  // ② 분할협의서 귀속 지분 합(재산마다)
  const div = {};
  sure.forEach(function (f) { if (!/^상속재산 분할/.test(f.kind) || !f.value || typeof f.value !== 'object') return; const prop0 = String(f.value.재산 || '').replace(/\s+/g, ''); if (!prop0) return; const own = f.value.피상속인지분 != null ? String(f.value.피상속인지분) : ''; const prop = prop0 + '@' + (f.src.fileId || f.src.file) + '#' + String(f.src.part || '') + '#' + own; /* 피상속인 지분이 적힌 줄은 따로(그 몫을 나눈 것) */ /* 서류(파일·구간·기록)마다 따로 더함 */ const fr = cxgFrac_(f.value); if (!isFinite(fr)) return; (div[prop] = div[prop] || []).push({ who: cxgName_(f.value.상속인) || String(f.value.상속인 || '?'), fr: fr, f: f }); });
  Object.keys(div).forEach(function (p) {
    const L = div[p]; out.checks++; const ownFr = cxgFrac_(p.split('#').pop());
    const seen = {}, uniq = L.filter(function (x) { const kk = x.who + '|' + x.fr; if (seen[kk]) return false; seen[kk] = 1; return true; });
    const sum = uniq.reduce(function (s, x) { return s + x.fr; }, 0);
    if (Math.abs(sum - 1) < 1e-6 || (isFinite(ownFr) && Math.abs(sum - ownFr) < 1e-6)) { out.ok++; return; } // 합 = 1(피상속인 몫을 1로 본 것) 또는 = 피상속인 지분(전체 대비로 적은 것)
    out.issues.push({ what: '분할협의서 귀속 지분 합', why: p.split('@')[0].slice(0, 40) + ': ' + uniq.map(function (x) { return x.who + ' ' + Math.round(x.fr * 10000) / 10000; }).join(' + ') + ' = ' + Math.round(sum * 10000) / 10000 + '(1이 아님)', src: src(L[0].f) });
  });
  // ③ 상속인 명단 — 피상속인 본인 기준 가족관계증명서(같은 파일·같은 기록 앞부분에 "본인" = 피상속인)
  if (c && c.세목 === 'inheritance') {
    const dec = cxgName_(((c.사건개요 || {}).ihDeceasedName) || '') || cxgName_(((sure.filter(function (f) { return /^(사망일|상속개시일)$/.test(f.kind); })[0] || {}).keys || {}).person);
    const certs = {};
    sure.forEach(function (f) { if (f.kind !== '관계') return; const k = (f.src.fileId || f.src.file) + '#' + String(f.src.part || '') + '#' + String(f.src.rec || '').replace(/\d+$/, '').split('.')[0]; (certs[k] = certs[k] || []).push({ rel: String(f.value), who: cxgName_((f.keys || {}).person), f: f }); });
    const mine = Object.keys(certs).map(function (k) { return certs[k]; }).filter(function (L) { return dec && L.some(function (x) { return x.rel === '본인' && x.who === dec; }); })[0];
    const signers = {}; sure.forEach(function (f) { if (f.kind === '성명' && f.role === '상속인' && /분할/.test(String(f.src.docType || ''))) { const n = cxgName_(f.value); if (n) signers[n] = src(f); } });
    const heirs = {}; (mine || []).forEach(function (x) { if (/^(배우자|자녀|자|딸|아들)$/.test(x.rel) && x.who) heirs[x.who] = x.rel; });
    // [밤 12바퀴 사람 축 다시] 세무사는 증명서에 "사망" 표시가 있는 가족부터 가른다 — 같은 기록(가족N)의 기타:사망 표시(개발용 신수호 배우자 이임규).
    //  사망일을 모르면 먼저 사망(상속인 아님)인지 뒤에 사망(그 상속인이 대신 협의)인지 정하지 않고 알려만 준다. 자녀가 사망이면 대습상속(그 자녀의 배우자·자녀가 협의)
    const deadRec = {}; sure.forEach(function (f) { if (f.kind === '기타:사망' && /^(true|사망)$/.test(String(f.value)) && f.src) deadRec[(f.src.fileId || f.src.file) + '#' + String(f.src.part || '') + '#' + String(f.src.rec || '')] = 1; });
    const dead = {}; (mine || []).forEach(function (x) { if (x.rel !== '본인' && x.who && deadRec[(x.f.src.fileId || x.f.src.file) + '#' + String(x.f.src.part || '') + '#' + String(x.f.src.rec || '')]) dead[x.who] = x.rel; });
    if (mine && Object.keys(signers).length && Object.keys(heirs).length) { // 증명서 쪽 명단을 못 찾으면 비교하지 않음
      out.checks++;
      const missAll = Object.keys(heirs).filter(function (n) { return !signers[n]; }), extra = Object.keys(signers).filter(function (n) { return !heirs[n]; });
      const miss = missAll.filter(function (n) { return !dead[n]; }), missDead = missAll.filter(function (n) { return dead[n]; });
      const deadTxt = missDead.map(function (n) { return n + '(' + dead[n] + ', 사망 표시 — ' + (dead[n] === '배우자' ? '피상속인보다 먼저 사망이면 상속인 아님, 뒤에 사망이면 그 상속인이 대신 협의' : '먼저 사망이면 대습상속: 그 배우자·자녀가 협의') + ')'; });
      if (!miss.length && !extra.length) { out.ok++; if (deadTxt.length) (out.info = out.info || []).push('👥 상속인 명단 맞음 — 협의서에 없는 가족은 사망 표시가 있는 사람뿐: ' + deadTxt.join(', ')); }
      else out.issues.push({ what: '상속인 명단', why: '피상속인 ' + dec + ' 가족관계증명서 배우자·자녀 ' + Object.keys(heirs).length + '명 ↔ 분할협의서 상속인 ' + Object.keys(signers).length + '명' + (miss.length ? ' · 협의서에 없는 사람: ' + miss.join(', ') : '') + (extra.length ? ' · 증명서에 없는 사람: ' + extra.join(', ') : '') + (deadTxt.length ? ' · 사망 표시: ' + deadTxt.join(', ') : '') + ' — 상속포기·먼저 사망(대습)·판독 확인', src: src(mine[0].f) });
    }
  }
  return out;
}

// =========================================================
// [2026.10.19 밤 5바퀴 — 사람처럼 추론해 본 걸음 중 여러 사건에서 되풀이된 GAS 몫] (maps/추론걸음_사람추론.md)
//  ① 같은 자산의 감정평가서가 둘 이상(서로 다른 서류) — 상증법 시행령 §49①: 둘 이상의 감정가액이 있으면 그 평균액. 평균을 근거와 함께 적고,
//     그 자산의 상속재산 평가 질문(ih:)에 "감정가액 평균" 후보로 붙인다(고르는 것은 세무사·AI — 시가 순위 판단은 맥락)  — 개발용 노영환·박종헌
//  ② 임대 보증금 합계(현황표·명세서) ↔ 개별 임대차계약 보증금 — 같은 파일 안 개별 보증금 합, 없으면 다른 계약서 보증금 중 합이 같은 조합(2~8건).
//     맞으면 채무(상증법 §14 임대보증금)의 근거로 적고, 안 맞으면 확인 — 개발용 김창호·노영환·박종헌
// =========================================================
// [2026.10.19 밤 28바퀴 — 5번 도구 고칠 거리] 상속 '채운 칸' 요약 — 필수 칸 4개(피상속인·사망일·상속인 등)가 다 찼다는 줄만 있어,
//  재산 평가·금융재산·채무가 열려 있어도 끝난 것처럼 보였다. 작업 지시 AI·세무사가 한눈에 보도록 금액 칸의 합과 아직 안 정한 것을 적는다(계산 안 함 — 사실 정리만)
function cxInhSummary_(c) {
  if (!c || c.세목 !== 'inheritance' || typeof caseProcInhFacts_ !== 'function') return '';
  let f = null; try { f = caseProcInhFacts_(c); } catch (e) { return ''; }
  if (!f) return '';
  const won = function (v) { return (Number(v) || 0).toLocaleString('ko-KR') + '원'; };
  const assets = f.assets || [], done = assets.filter(function (a) { return Number(a.value) > 0; }), open = assets.filter(function (a) { return !(Number(a.value) > 0); });
  const aSum = done.reduce(function (s, a) { return s + Number(a.value); }, 0);
  const debts = Array.isArray(f.debtsConfirmed) ? f.debtsConfirmed : (f.debts || []).filter(function (d) { return d.sure; });
  const dSum = debts.reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0);
  const duesSum = (f.dues || []).reduce(function (s, d) { return s + (Number(d.amount) || 0); }, 0);
  const pg = f.priorGifts || [], pgSum = pg.reduce(function (s, g) { return s + (Number(g.v) || 0); }, 0);
  const parts = [
    '부동산 평가 ' + done.length + '/' + assets.length + '건 확정 ' + won(aSum) + (open.length ? '(미정: ' + open.slice(0, 3).map(function (a) { return String(a.loc || '').slice(0, 24) + ((a.cands || []).length ? ' 후보 ' + a.cands.length + '개' : ' 자료 없음'); }).join(' / ') + ')' : ''),
    '금융재산 ' + (f.financialValue != null ? won(f.financialValue) : '미정'),
    '채무 ' + won(dSum) + '(' + (Array.isArray(f.debtsConfirmed) ? '확정 ' : '서류 확실 ') + debts.length + '건' + ((f.debts || []).length > debts.length && !Array.isArray(f.debtsConfirmed) ? ', 확인 안 된 ' + ((f.debts || []).length - debts.length) + '건 빠짐' : '') + ')',
    '공과금 ' + won(duesSum),
    '장례비 ' + won((f.funeral || {}).value),
    '감정평가수수료 ' + won(f.appraisalFee ? f.appraisalFee.value : 0),
    '사전증여 ' + (pg.length ? won(pgSum) + '(답한 ' + pg.length + '건)' : '답한 것 없음')
  ];
  return '🧾 상속 칸 요약(사실 정리, 계산 아님): ' + parts.join(' · ') + (f.grossEstate ? ' — 총상속재산 ' + won(f.grossEstate) : ' — 총상속재산은 평가가 끝나야 나옴');
}
// [2026.10.19 밤 25바퀴 — 최상위 AI 모의에서 손으로 계산한 재료] 양도 사건분류 판단 재료(판정 안 함 — 작업 지시 AI·세무사 몫):
//  ① 저가양도 신호: 양도 대금 ÷ 양도일 기준 기준시가 합(공시일 ≤ 양도일인 가장 늦은 해 — 공동주택가격은 총액, 토지는 개별공시지가 × 면적). 같은 성 매수인이면 함께 적음(§101① 5%·3억 기준은 시가로 판정)
//  ② 거주 요약: 초본 거주기간 중 판 자산 주소에 산 기간(없으면 "판 자산 주소 거주 기록 없음")
//  ③ 재촌자경 재료: 농지(답·전·과수원)면 농지 소재 시군구 ↔ 양도인 주소 시군구, 자경 서류 유무(시행령 §168의8)
//  개발용: 이종식(대금 5천만 ÷ 기준시가 합 약 7.48천만 = 67%, 같은 성, 봉화 농지), 방영교(초본상 판 빌라 거주 없음)
function cxTrJudgeMaterials_(c, facts) {
  if (!c || c.세목 !== 'transfer') return '';
  const D = String(c.기준일 || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(D)) return '';
  const cons = typeof cxContracts_ === 'function' ? cxContracts_(facts || [], '') : [];
  const days = function (a) { const x = Date.parse(a), y = Date.parse(D); return isNaN(x) || isNaN(y) ? 1e9 : Math.abs(x - y) / 864e5; };
  const sell = cons.filter(function (x) { return x.total; }).sort(function (a, b) { return days(a.balDate || a.date || '') - days(b.balDate || b.date || ''); })[0];
  if (!sell || days(sell.balDate || sell.date || '') > 400) return '';
  const inSell = (facts || []).filter(function (f) { return f && f.src && (f.src.fileId || f.src.file) === sell.fid; });
  const locs = inSell.filter(function (f) { return f.kind === '소재지' && f.keys && f.keys.asset; });
  const keys = []; locs.forEach(function (f) { const k = String(f.keys.asset); if (!keys.some(function (q) { return cxAkSame_(q, k); })) keys.push(k); });
  const out = [];
  // ① 기준시가 합
  const okYear = function (v) { const pub = String(v.공시일 || ((v.연도 || String(v.기준일 || '').slice(0, 4)) + '-04-30')); return pub <= D; };
  let sum = 0, miss = 0; const parts = [], covered = [];
  keys.slice().sort(function (a, b) { return (String(b).indexOf('|') !== -1) - (String(a).indexOf('|') !== -1); }).forEach(function (k) {
    if (covered.some(function (q) { const qu = q.split('|')[1], ku = String(k).split('|')[1]; return cxAkSame_(q, k) || q.split('|')[0] === String(k).split('|')[0] || (qu && qu === ku); })) return; // 공동주택가격(총액)이 덮은 같은 지번
    const unit = String(k).split('|')[1] || '';
    const P = (facts || []).filter(function (f) { return f && /^공시가격/.test(f.kind) && f.value && typeof f.value === 'object' && f.keys && f.keys.asset && (cxAkSame_(String(f.keys.asset), k) || (unit && String(f.keys.asset).split('|')[1] === unit)) && okYear(f.value); });
    const tot = P.filter(function (f) { return Number(f.value.가격) > 0; }).sort(function (a, b) { return String(b.value.연도) < String(a.value.연도) ? -1 : 1; })[0];
    if (tot) { covered.push(String(k)); sum += Number(tot.value.가격); parts.push(k + ' ' + tot.value.연도 + '년 ' + Number(tot.value.가격).toLocaleString('ko-KR')); return; }
    const up = P.filter(function (f) { return Number(f.value.단가) > 0; }).sort(function (a, b) { return String(b.value.연도) < String(a.value.연도) ? -1 : 1; })[0];
    let ar = (facts || []).filter(function (f) { return f && /^(토지면적|면적)$/.test(f.kind) && f.keys && f.keys.asset && cxAkSame_(String(f.keys.asset), k) && Number(f.value) > 0; }).map(function (f) { return Number(f.value); })[0];
    if (!ar) locs.forEach(function (f) { if (!ar && cxAkSame_(String(f.keys.asset), k)) { const m = /([\d,]+(?:\.\d+)?)\s*(?:m2|㎡|m²)/.exec(String(f.raw || f.value)); if (m) ar = Number(m[1].replace(/,/g, '')); } }); // 계약서 소재지 글의 면적("답 143m2")
    if (up && ar) { const v = Math.round(Number(up.value.단가) * ar); sum += v; parts.push(k + ' ' + up.value.연도 + '년 ' + Number(up.value.단가).toLocaleString('ko-KR') + '원/㎡ × ' + ar + '㎡'); } else miss++;
  });
  const sellers = inSell.filter(function (f) { return f.kind === '성명' && f.role === '매도인'; }).map(function (f) { return String(f.value).replace(/\s+/g, ''); });
  const buyers = inSell.filter(function (f) { return f.kind === '성명' && f.role === '매수인'; }).map(function (f) { return String(f.value).replace(/\s+/g, ''); });
  const tp = String(c.납세자 || '').replace(/\s+/g, '') || sellers[0] || '';
  const sameName = buyers.filter(function (b) { return tp && b && b !== tp && b[0] === tp[0] && !/주식회사|조합|법인|\(주\)/.test(b); });
  if (sum > 0) out.push('- 저가양도 신호: 양도 대금 ' + Number(sell.total).toLocaleString('ko-KR') + '원 ÷ 양도일 기준 기준시가 합 ' + sum.toLocaleString('ko-KR') + '원 = ' + Math.round(100 * sell.total / sum) + '%' + (miss ? '(자산 ' + miss + '개는 기준시가를 못 찾음)' : '') + ' [' + parts.join(' / ') + ']' + (sameName.length ? ' · 매수인 ' + sameName.join(',') + '이(가) 양도인과 같은 성 — 특수관계면 §101①(시가와 차이 5% 또는 3억 이상) 검토' : ''));
  // ② 거주 요약
  const stays = (facts || []).filter(function (f) { return f && f.kind === '거주기간' && f.value && typeof f.value === 'object' && !f._copy; });
  if (stays.length) {
    const toks = []; keys.forEach(function (k) { const core = String(k).split('|')[0].split(' '); if (core.length >= 2) toks.push(core.join(' ')); });
    inSell.forEach(function (f) { if (f.kind === '주소 대응' && f.value && f.value.도로명) toks.push(String(f.value.도로명)); });
    const nz = function (s) { return String(s || '').replace(/\s+/g, ''); };
    const here = stays.filter(function (f) { const a = nz(f.value.주소); return toks.some(function (t) { return t && a.indexOf(nz(t)) !== -1; }); });
    const seen = {}; const fmt = function (f) { const s = (f.value.시작 || '?') + '~' + (f.value.끝표시 || f.value.끝 || '?'); if (seen[s]) return ''; seen[s] = 1; return s + ' ' + String(f.value.주소 || '').slice(0, 30); };
    out.push('- 거주 요약(주민등록 초본): ' + (here.length ? '판 자산 주소 거주 ' + here.map(fmt).filter(Boolean).join(' / ') : '판 자산 주소 거주 기록 없음 — 같은 기간 거주지: ' + stays.slice(-2).map(fmt).filter(Boolean).join(' / ')));
  }
  // ③ 재촌자경 재료
  const farm = locs.some(function (f) { return /\s(답|전|과수원)\s/.test(' ' + String(f.raw || f.value) + ' '); }) || (facts || []).some(function (f) { return f && f.kind === '지목·용도' && /^(답|전|과수원)$/.test(String(f.value)) && f.keys && keys.some(function (k) { return cxAkSame_(String(f.keys.asset || ''), k); }); });
  if (farm) {
    const sgg = function (s) { const m = /([가-힣]+(?:시|군))(?:\s|$)/.exec(String(s || '')); return m ? m[1] : ''; };
    const landSgg = sgg(String((locs[0] || {}).raw || ''));
    const sAddr = inSell.filter(function (f) { return f.kind === '주소' && f.role === '매도인'; })[0] || (facts || []).filter(function (f) { return f && f.kind === '거주기간' && f.value && /현재/.test(String(f.value.끝표시 || '')); })[0];
    const addr = sAddr ? String(sAddr.kind === '거주기간' ? sAddr.value.주소 : sAddr.value) : '';
    const farmDocs = (facts || []).some(function (f) { return f && f.kind === '서류' && /농지원부|농업경영체|직불|자경/.test(String(f.value)); });
    out.push('- 재촌·자경 재료(농지): 농지 소재 ' + (landSgg || '시군구?') + ' ↔ 양도인 주소 ' + (addr ? sgg(addr) || addr.slice(0, 20) : '서류에 없음') + (landSgg && addr && sgg(addr) === landSgg ? '(같은 시군구)' : '') + ' · 자경 서류(농지원부·직불금 등) ' + (farmDocs ? '있음' : '폴더에 없음') + ' — 재촌(같은·연접 시군구 또는 30km 안)·8년(사업용은 기간 기준) 자경이면 사업용·감면, 아니면 비사업용 토지(시행령 §168의8)');
  }
  return out.length ? '양도 사건분류 판단 재료(GAS 정리 — 판정은 AI·세무사):\n' + out.join('\n') : '';
}
// [2026.10.19 밤 17바퀴 — 세목별: 증여만] 10년 합산(상증법 §47②)은 개발용 증여 8건 모두 "있나요?"만 묻는다. 세무사는 먼저 사무소 안의 같은 수증자 다른 증여 사건을 본다.
//  상수(GAS): 작업관리 시트에서 같은 납세자(수증자)·증여 사건을 찾아 날짜·증여자로 가름 — 이번 증여 전 10년 안 + 같은 증여자(수증자 증명서의 부·모는 서로 배우자라 같은 사람)면 합산 후보,
//  증여자 다름·뒤 증여·10년 밖은 합산 아님. 변수(작업 지시 AI·사용자): 사무소 밖 증여, 증여자 배우자 관계가 증명서에 없을 때. 개발용 강정화 가족(임세택 4/28 임미경·7/14 임종삼)
var CX_CASE_ROWS_ = null;
function cxCaseRows_() {
  if (CX_CASE_ROWS_) return CX_CASE_ROWS_;
  try {
    const sh = work_getSheet_(), data = sh.getDataRange().getValues(), col = work_colMap_(data[0]);
    const ymd = function (v) { if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'); const m = /(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/.exec(String(v || '')); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : ''; };
    CX_CASE_ROWS_ = data.slice(1).map(function (r) { let ov = {}; try { ov = JSON.parse(r[col.사건개요] || '{}') || {}; } catch (e) { ov = {}; } return { id: String(r[col.id] || ''), 세목: String(r[col.세목] || ''), 납세자: String(r[col.납세자] || ''), 기준일: ymd(r[col.기준일]), ov: ov, 사건명: String(r[col.사건명] || '') }; });
  } catch (e) { CX_CASE_ROWS_ = []; }
  return CX_CASE_ROWS_;
}
function cxOtherGifts_(c, facts, rows) {
  const out = { lines: [], hits: [], text: '' };
  if (!c || c.세목 !== 'gift') return out;
  const nm = function (s) { return String(s || '').replace(/\s+/g, ''); };
  const donee = nm(c.납세자 || (c.사건개요 || {}).giftDoneeName), D = String(c.기준일 || ''), donor = nm((c.사건개요 || {}).giftDonorName);
  if (!donee) return out;
  const others = (rows || cxCaseRows_()).filter(function (r) { return r.id !== String(c.id) && /증여|gift/.test(r.세목) && nm(r.납세자 || r.ov.giftDoneeName) === donee; });
  if (!others.length) return out;
  // 수증자 기준 증명서의 부·모 — 서로 배우자라 10년 합산에서 같은 증여자(§47② 괄호)
  const par = {}; (facts || []).forEach(function (f) { if (f && f.kind === '관계' && /^(부|모)$/.test(String(f.value)) && f.keys && f.keys.person && (!f.keys.subject || nm(String(f.keys.subject).split('|')[0]) === donee)) { const p = nm(String(f.keys.person).split('|')[0]); if (p) par[p] = 1; } });
  const group = {}; if (donor) { group[donor] = 1; if (par[donor]) Object.keys(par).forEach(function (p) { group[p] = 1; }); }
  const won = function (v) { const n = Number(String(v || '').replace(/[^\d]/g, '')); return n ? n.toLocaleString('ko-KR') + '원' : '금액?'; };
  const tenBefore = /^\d{4}-\d{2}-\d{2}$/.test(D) ? (Number(D.slice(0, 4)) - 10) + D.slice(4) : '';
  others.forEach(function (r) {
    const d = r.기준일 || '', g = nm(r.ov.giftDonorName), desc = (r.ov.giftDonorName || '증여자?') + ' → ' + (r.ov.giftDoneeName || c.납세자) + ' ' + (d || '날짜?') + ' ' + won(r.ov.giftAmount) + '(' + (r.사건명 || r.id) + ')';
    let why;
    if (!D || !d) why = '날짜를 몰라 판단 못 함';
    else if (d > D) why = '이번 증여 뒤 — 이번 신고엔 합산 안 함' + (g && group[g] ? '(같은 증여자라 그 신고에서 이번 증여를 합산)' : g && donor ? '(증여자도 다름)' : '');
    else if (tenBefore && d < tenBefore) why = '10년 밖 — 합산 아님';
    else if (!donor || !g) why = '증여자를 몰라 판단 못 함';
    else if (group[g]) { why = '같은 증여자' + (g !== donor ? '(부·모는 같은 사람)' : '') + ' 10년 안 — 합산 후보'; out.hits.push({ v: String(Number(String(r.ov.giftAmount || '').replace(/[^\d]/g, '')) || ''), src: '사무소 사건 ' + desc }); }
    else why = '증여자 다름 — 합산 아님(배우자·부모 사이가 아니면)';
    out.lines.push(desc + ': ' + why);
  });
  out.text = '사무소의 같은 수증자 다른 증여 사건: ' + out.lines.join(' / ');
  return out;
}
// [2026.10.19 밤 10바퀴 — 자산 축을 추론 먼저로 다시] 상속 재산 목록 맞대기: 세무사는 분할협의서 재산 ↔ 등기부(그 부동산) 목록부터 맞춘다.
//  등기부의 대상 부동산은 구조화된 기록(docs[N].소재지)만 쓴다 — 글자 훑기로 잡힌 소재지에는 근저당권자 은행 지점·앞 권리자 주소가 섞인다(다동 39·남대문로2가 9-1 등, 3사건 되풀이).
//  같은 동·리 + 같은 동호 + 단지 이름 글자가 겹치면 지번 표기만 다른 같은 집(재개발 전 "52번지 일원" ↔ 등기부 898, 개발용 김창호).
//  분할협의서에만 있음 → 등기부 요청 / 등기부에만 있음 → 이미 처분·사전증여·다른 사람 재산인지 묻기(알림). 판정은 안 함.
function cxEstateRoster_(c, facts) {
  const out = { lines: [], notes: [], div: 0, reg: 0 };
  if (!c || c.세목 !== 'inheritance') return out;
  const one = function (f) { return { key: String((f.keys || {}).asset || ''), raw: String(f.raw || f.value || '').replace(/\s+/g, ' ').slice(0, 60), file: f.src.file, fid: f.src.fileId || f.src.file }; };
  const div = [], reg = [];
  (facts || []).forEach(function (f) {
    if (!f || !f.src || f._copy || f.kind !== '소재지' || !(f.keys && f.keys.asset)) return;
    const dt = String(f.src.docType || '');
    if (/분할/.test(dt)) div.push(one(f));
    else if (/등기부/.test(dt) && /^docs\d+$/.test(String(f.src.rec || ''))) reg.push(one(f));
  });
  const uniq = function (L) { const s = {}; return L.filter(function (x) { if (s[x.key]) return false; s[x.key] = 1; return true; }); };
  const D = uniq(div), R = uniq(reg);
  out.div = D.length; out.reg = R.length;
  if (!D.length || !R.length) return out;
  const tri = function (s) { const t = String(s).replace(/[^가-힣]/g, '').replace(/아파트|번지|일원|주식회사/g, ''); const g = {}; for (let i = 0; i + 3 <= t.length; i++) g[t.slice(i, i + 3)] = 1; return g; };
  const nameSame = function (a, b) {
    const A = a.key.split('|'), B = b.key.split('|');
    if (!A[1] || A[1] !== B[1] || A[0].split(' ')[0] !== B[0].split(' ')[0]) return false; // 같은 동·리, 같은 동호
    const ta = tri(a.raw.replace(/^.*?(동|리|가)\s*(산)?\d[\d-]*/, '')), tb = tri(b.raw.replace(/^.*?(동|리|가)\s*(산)?\d[\d-]*/, ''));
    return Object.keys(ta).some(function (k) { return tb[k] && !/[시군구도]$/.test(k); });
  };
  const same = [], renum = [], onlyD = [], usedR = {};
  D.forEach(function (d) {
    const hit = R.filter(function (r) { return cxAkSame_(d.key, r.key); });
    if (hit.length) { same.push(d.key); hit.forEach(function (r) { usedR[r.key] = 1; }); return; }
    const nm = R.filter(function (r) { return nameSame(d, r); })[0];
    if (nm) { renum.push(d.raw + ' ↔ 등기부 ' + nm.raw); usedR[nm.key] = 1; return; }
    onlyD.push(d);
  });
  const onlyR = R.filter(function (r) { return !usedR[r.key] && !D.some(function (d) { return cxAkSame_(d.key, r.key); }); });
  // 등기부 글에는 그 자산이 나오는데 대상 부동산 칸으로 정리가 안 된 경우(사진 등기부·같은 이름 파일 섞임, 개발용 박종헌 원문동) — "등기부 없음"이라고 요청하지 않는다
  const inRegText = function (d) { return (facts || []).some(function (f) { return f && f.src && /등기부/.test(String(f.src.docType || '')) && f.keys && f.keys.asset && cxAkSame_(String(f.keys.asset), d.key); }); };
  const textOnly = onlyD.filter(inRegText);
  for (let i = onlyD.length - 1; i >= 0; i--) if (textOnly.indexOf(onlyD[i]) !== -1) onlyD.splice(i, 1);
  out.lines.push('🏠 재산 목록 맞대기(분할협의서 ' + D.length + '곳 ↔ 등기부 ' + R.length + '곳): 같음 ' + same.length + (renum.length ? ' · 지번 표기만 다른 같은 집 ' + renum.length + '(' + renum.slice(0, 2).join(' / ') + ')' : '') + (textOnly.length ? ' · 등기부 글에만 나옴(대상 부동산 칸 못 읽음) ' + textOnly.length + '(' + textOnly.map(function (d) { return d.raw; }).slice(0, 2).join(' / ') + ')' : '') + (onlyD.length ? ' · 분할협의서에만 ' + onlyD.length : '') + (onlyR.length ? ' · 등기부에만 ' + onlyR.length : ''));
  onlyD.slice(0, 3).forEach(function (d) { out.notes.push('🏠 상속재산 등기부 없음 — 분할협의서의 「' + d.raw + '」 등기부등본이 폴더에 없습니다(소유·지분·담보 확인과 평가에 필요) — 넣어 주세요 (출처: 분할협의서 ' + d.file + ')'); });
  // [밤 14바퀴] 등기부에만 있는 자산은 그 등기부 소유권 줄로 먼저 가른다 — 피상속인이 권리자로 한 번도 없으면 상속재산 아님(처리 줄),
  //  피상속인이 마지막 권리자면 빠진 상속재산(알림), 피상속인 → 다른 사람 증여 등기면 상속개시 전 10년(상속인)·5년(그 밖) 안인지(§13①) — 개발용 박종헌 사당동 139-88(1982 박준영 → 2003 자녀 증여, 피상속인 없음)
  const D0 = String(c.기준일 || ''), dec = cxgName_(((c.사건개요 || {}).ihDeceasedName) || '');
  const heirsN = {}; ((c.사건개요 || {}).상속인목록 || []).forEach(function (h) { const n = cxgName_(h && h.name); if (n) heirsN[n] = 1; });
  const ownRows = function (r) {
    const g = {};
    (facts || []).forEach(function (f) {
      if (!f || !f.src || (f.src.fileId || f.src.file) !== r.fid) return;
      const m = /^(.*?소유권이력\d+)/.exec(String(f.src.rec || '')); if (!m) return;
      const x = g[m[1]] = g[m[1]] || { names: [] };
      if (f.kind === '접수일') x.date = String(f.value); else if (f.kind === '등기 원인' || f.kind === '취득원인') x.cause = String(f.value); else if (f.kind === '성명') { const n = cxgName_(f.value); if (n && x.names.indexOf(n) === -1) x.names.push(n); }
    });
    return Object.keys(g).map(function (k) { return g[k]; }).filter(function (x) { return x.date && x.names.length; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };
  onlyR.slice(0, 3).forEach(function (r) {
    const rows = dec ? ownRows(r) : [];
    if (!rows.length) { out.notes.push('🏠 상속재산 목록 — 등기부 「' + r.raw + '」는 분할협의서에 없습니다 — 상속재산인데 빠진 것인지, 이미 처분·증여했거나 다른 사람 재산인지 알려 주세요 (출처: 등기부 ' + r.file + ')'); return; }
    const last = rows[rows.length - 1], lastDate = last.date, cur = rows.filter(function (x) { return x.date === lastDate; }).reduce(function (a, x) { return a.concat(x.names); }, []);
    const decRows = rows.filter(function (x) { return x.names.indexOf(dec) !== -1; });
    const chain = rows.map(function (x) { return x.date + ' ' + (x.cause || '?') + ' ' + x.names.join('·'); }).join(' → ');
    if (!decRows.length) { out.lines.push('🏠 등기부에만 있는 「' + r.raw + '」 — 소유권 줄에 피상속인(' + dec + ')이 없어 상속재산 아님(' + chain + ')'); return; }
    if (cur.indexOf(dec) !== -1) { out.notes.push('🏠 상속재산 목록 — 등기부 「' + r.raw + '」는 피상속인(' + dec + ') 명의인데 분할협의서에 없습니다 — 빠진 상속재산인지(협의 추가·법정상속분) 알려 주세요 (등기 ' + chain + ', 출처: 등기부 ' + r.file + ')'); return; }
    const out1 = rows.filter(function (x) { return x.date > decRows[decRows.length - 1].date; })[0];
    if (out1 && /증여/.test(out1.cause || '') && /^\d{4}-\d{2}-\d{2}$/.test(D0)) {
      const yrs = (Date.parse(D0) - Date.parse(out1.date)) / (365.2425 * 864e5), toHeir = out1.names.some(function (n) { return heirsN[n]; }), lim = toHeir ? 10 : 5;
      if (yrs <= lim) out.notes.push('🏠 사전증여 후보 — 「' + r.raw + '」 피상속인(' + dec + ') → ' + out1.names.join('·') + ' 증여 등기 ' + out1.date + '(상속개시 전 ' + yrs.toFixed(1) + '년, ' + (toHeir ? '상속인 10년' : '상속인 아님 5년') + ' 안) — 상속세 과세가액에 합산할지(§13①), 그때 낸 증여세(§28) 알려 주세요 (출처: 등기부 ' + r.file + ')');
      else out.lines.push('🏠 등기부에만 있는 「' + r.raw + '」 — 피상속인 → ' + out1.names.join('·') + ' 증여 ' + out1.date + '(상속개시 전 ' + yrs.toFixed(1) + '년, ' + lim + '년 넘음) — 사전증여 합산 아님');
      return;
    }
    out.lines.push('🏠 등기부에만 있는 「' + r.raw + '」 — 피상속인 생전에 다른 사람에게 넘어감(' + chain + ') — 상속재산 아님');
  });
  return out;
}
// [2026.10.19 밤 11바퀴 — 돈 축을 추론 먼저로 다시] 상속 임대보증금 채무는 사망일 현재 유효한 임대차만(상증법 §14 — 상속개시일 현재 피상속인 채무).
//  같은 집(동호까지 같은 자산)의 옛 계약·재계약을 더하면 두 번 센다(개발용 김창호: 같은 호실 2022·2023·2025 계약 — 사망일 현재는 2023 계약),
//  사망일 전에 끝난 계약·사망일 뒤 시작한 계약은 채무 근거가 아니다(노영환 103호 2025-02 종료). 같은 금액·같은 날짜 계약서는 사본으로 한 번만.
function cxLeaseAtDeath_(c, facts) {
  const out = { lines: [], notes: [], n: 0 };
  const D = c && c.세목 === 'inheritance' ? String(c.기준일 || '') : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(D)) return out;
  const g = {};
  (facts || []).forEach(function (f) {
    if (!f || !f.src || f._copy || !/임대차/.test(String(f.src.docType || ''))) return; // 현황표 합계 줄은 날짜가 없어 아래에서 빠짐
    if (!/^(임대 보증금|시작일|종료일|계약일|월세|소재지)$/.test(f.kind)) return;
    const k = (f.src.fileId || f.src.file) + '#' + String(f.src.rec || '').split('.')[0] + '#' + (f.src.part || '');
    const x = g[k] = g[k] || { file: f.src.file };
    if (f.kind === '소재지') { if (!x.key && f.keys && f.keys.asset) x.key = String(f.keys.asset); return; }
    if (!x.key && f.keys && f.keys.asset) x.key = String(f.keys.asset);
    if (x[f.kind] == null) x[f.kind] = String(f.value);
  });
  const seen = {};
  const L = Object.keys(g).map(function (k) { return g[k]; }).filter(function (x) {
    if (!x['임대 보증금'] || !(x['시작일'] || x['종료일'] || x['계약일'])) return false; // 날짜 없는 줄(현황표 합계 등)은 계약으로 안 봄
    const s = x['임대 보증금'] + '|' + (x['월세'] || '') + '|' + (x['시작일'] || '') + '|' + (x['계약일'] || '') + '|' + (x['종료일'] || '');
    if (seen[s]) return false; seen[s] = 1; return true; // 같은 계약서 사본(묶음 PDF·사진)은 한 번만
  });
  out.n = L.length;
  if (!L.length) return out;
  const won = function (v) { return Number(v).toLocaleString('ko-KR') + '원'; };
  const once = function (key) { const s2 = {}; return function (x) { const k = key(x); if (s2[k]) return false; s2[k] = 1; return true; }; }; // 같은 계약의 사본(묶음 PDF와 낱장, 계약일 칸만 다르게 읽힘)
  let ended = L.filter(function (x) { return x['종료일'] && x['종료일'] < D; }).filter(once(function (x) { return x['임대 보증금'] + '|' + x['종료일']; }));
  let later = L.filter(function (x) { return x['시작일'] && x['시작일'] > D; }).filter(once(function (x) { return x['임대 보증금'] + '|' + x['시작일']; }));
  // 같은 집(동·리 + 동호가 같은 자산) 계약 여럿 — 사망일 현재 계약 하나만 채무
  const unit = function (x) { const p = String(x.key || '').split('|'); return p[1] ? p[0].split(' ')[0] + '|' + p[1] : ''; };
  const byUnit = {}; L.forEach(function (x) { const u = unit(x); if (u) (byUnit[u] = byUnit[u] || []).push(x); });
  Object.keys(byUnit).forEach(function (u) {
    const C = byUnit[u]; if (C.length < 2) return;
    const now = C.filter(function (x) { return x['시작일'] && x['시작일'] <= D && (!x['종료일'] || x['종료일'] >= D); });
    if (now.length) { ended = ended.filter(function (x) { return C.indexOf(x) === -1; }); later = later.filter(function (x) { return C.indexOf(x) === -1; }); } // 같은 집 줄에서 이미 정리 — 따로 묻지 않음
    out.lines.push('🏘 같은 집 임대차 ' + C.length + '건(' + u.replace('|', ' ') + ') — 사망일 ' + D + ' 현재 계약: ' + (now.length ? now.map(function (x) { return won(x['임대 보증금']) + '(' + x['시작일'] + '~' + (x['종료일'] || '?') + ', ' + x.file + ')'; }).join(', ') : '못 찾음') + ' — 나머지는 보증금 채무에 더하지 않음');
  });
  ended.slice(0, 2).forEach(function (x) { out.notes.push('🏘 임대보증금 채무 — 「' + x.file + '」 임대차(보증금 ' + won(x['임대 보증금']) + ')는 사망일(' + D + ') 전 ' + x['종료일'] + '에 끝났습니다 — 갱신됐으면 그 계약서를 넣어 주시고, 끝났으면 보증금 채무에서 뺍니다'); });
  later.slice(0, 2).forEach(function (x) { out.notes.push('🏘 임대보증금 채무 — 「' + x.file + '」 임대차(보증금 ' + won(x['임대 보증금']) + ')는 사망일(' + D + ') 뒤 ' + x['시작일'] + '에 시작했습니다 — 상속 뒤 계약이라 채무 근거가 아닙니다(사망일 현재 계약의 보증금을 씁니다)'); });
  if (ended.length || later.length) out.lines.push('🏘 임대차 ' + L.length + '건(사본 빼고) 중 사망일 전 종료 ' + ended.length + ' · 사망일 뒤 시작 ' + later.length);
  return out;
}
function cxLawChecks_(c, facts) {
  const sure = (facts || []).filter(function (f) { return f && f.src && !f._copy && !(f.read && f.read.conf === '불확실'); });
  const out = { lines: [], notes: [], appraisal: [], deposit: { ok: 0, bad: 0 } };
  const won = function (n) { return Math.round(n).toLocaleString('ko-KR') + '원'; };
  // ① 감정가액 평균
  const ap = {};
  sure.forEach(function (f) { if (f.kind !== '감정가액') return; const a = String((f.keys || {}).asset || '').split('|')[0]; const v = Number(f.value) || 0; if (!a || !v) return; const x = ap[a] = ap[a] || {}; x[f.src.file] = x[f.src.file] || v; });
  Object.keys(ap).forEach(function (a) {
    const files = Object.keys(ap[a]); if (files.length < 2) return;
    const vals = files.map(function (k) { return ap[a][k]; }), avg = Math.round(vals.reduce(function (s, v) { return s + v; }, 0) / vals.length);
    out.appraisal.push({ asset: a, avg: avg, vals: vals, files: files });
    out.lines.push('🏷 ' + a + ' 감정평가 ' + files.length + '곳(' + files.map(function (k) { return won(ap[a][k]) + ' ' + k; }).join(' / ') + ') — 평균 ' + won(avg) + '(상증법 시행령 §49①: 감정가액이 둘 이상이면 평균)');
  });
  // ② 보증금 합계 검산
  const deps = sure.filter(function (f) { return f.kind === '임대 보증금' && Number(f.value) > 0; });
  deps.filter(function (f) { return /합계/.test(String(f.src.where || '')); }).forEach(function (t) {
    const total = Number(t.value);
    const same = deps.filter(function (f) { return f !== t && f.src.file === t.src.file && !/합계/.test(String(f.src.where || '')); });
    const sumSame = same.reduce(function (s, f) { return s + Number(f.value); }, 0);
    if (same.length && sumSame === total) { out.deposit.ok++; out.lines.push('🏠 보증금 합계 ' + won(total) + ' = 같은 서류의 개별 보증금 ' + same.length + '건 합(' + t.src.file + ') — 채무(상증법 §14 임대보증금)의 근거'); return; }
    // 다른 계약서들(파일마다 한 값)에서 합이 같은 조합
    const per = {}; deps.forEach(function (f) { if (f.src.file === t.src.file || /합계/.test(String(f.src.where || ''))) return; per[(f.src.fileId || f.src.file) + '#' + (f.src.rec || '')] = Number(f.value); });
    const cand = Object.keys(per).map(function (k) { return { k: k, v: per[k] }; }).filter(function (x) { return x.v <= total; }).slice(0, 16);
    // 합이 맞는 조합이 딱 하나일 때만 인정 — 여럿이면 우연한 합일 수 있어(해마다 재계약한 같은 임차인 등) 확정하지 않는다(보수적)
    let found = null, many = 0;
    const pick = function (i, left, ch) { if (many > 1) return; if (left === 0 && ch.length >= 2) { many++; if (!found) found = ch.slice(); return; } if (ch.length >= 8 || left < 0) return; for (let k = i; k < cand.length; k++) { ch.push(cand[k]); pick(k + 1, left - cand[k].v, ch); ch.pop(); if (many > 1) return; } };
    if (cand.length <= 16) pick(0, total, []);
    if (many > 1) { out.lines.push('🏠 보증금 합계 ' + won(total) + '(' + t.src.file + ')와 합이 같은 계약서 조합이 여럿 — 어느 계약들인지 정하지 않음(해마다 재계약 등)'); return; }
    if (found) { out.deposit.ok++; out.lines.push('🏠 보증금 합계 ' + won(total) + '(' + t.src.file + ') = 임대차계약서 ' + found.length + '건 보증금 합(' + found.map(function (x) { return won(x.v); }).join(' + ') + ') — 채무(상증법 §14)의 근거'); }
    else if (same.length) { out.deposit.bad++; out.notes.push('🏠 보증금 합계 ' + won(total) + '(' + t.src.file + ')가 같은 서류의 개별 보증금 합 ' + won(sumSame) + '과 다릅니다 — 판독 또는 빠진 임차인 확인(채무 칸에 쓰임)'); }
  });
  return out;
}
