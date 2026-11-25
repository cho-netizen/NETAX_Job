// ============================================================
// [2026.11.25] 금융거래 분석 → 보고서(개별검토서) 잇기
// ------------------------------------------------------------
// 세무사님 11-25 0시 원문: "시스템은 보고서작성까지 모두 연결되어야 한다."
//  · 사건 폴더 「보고서/개별검토서_금융거래.md」(정식 이름 — 보고서 종류표의 개별검토서_세부명칭). 옛 이름
//    「개별검토서_금융거래내역(추정상속재산_사전증여).md」가 있으면 그 파일을 쓴다.
//  · GAS는 표시 사이(<!-- GAS:금융거래 시작 --> … <!-- GAS:금융거래 끝 -->)만 고친다 — 그 밖의 세무사님·넥스 문단은 한 글자도 손대지 않음.
//    표시가 없는 옛 파일은 맨 뒤에 GAS 칸을 덧붙인다(앞 글 그대로). 고치기 전 판은 「보고서/_이전판」에.
//  · 숫자·목록만(판단 문장 없음). 판단·의견은 세무사님·넥스 몫 — 밤 내부검토서 갱신(넥스)이 기록부 「금융거래 2단계 검토」 줄을 보고 의견 문단을 다듬는다.
//  · 11-14 세무사님 "내가 검토서를 만들라고 한 사건만 검토서가 생성되고"와 이번 말씀이 겹쳐, 사건마다 「사건 기준」 탭 「보고서 저절로」를 「아니오」로 끄실 수 있게 함(기본 예).
// ============================================================

var FIN_RP_NAME_ = '개별검토서_금융거래.md';
var FIN_RP_OLD_ = ['개별검토서_금융거래내역(추정상속재산_사전증여).md'];
var FIN_RP_S_ = '<!-- GAS:금융거래 시작 — 이 사이는 GAS가 금융거래 분석 시트에서 저절로 채웁니다(고치시면 다음 셈에 덮임). 의견은 아래 「세무사님·넥스 의견」에 -->';
var FIN_RP_E_ = '<!-- GAS:금융거래 끝 -->';

function finRpMoney_(n) { return n == null || n === '' ? '' : finRvWon_(n); }
function finRpCell_(s) { return String(s == null ? '' : s).replace(/\|/g, '/').replace(/\n/g, ' '); }
function finRpTable_(hdr, rows) {
  if (!rows.length) return '(없음)\n';
  return '| ' + hdr.join(' | ') + ' |\n|' + hdr.map(function () { return '---'; }).join('|') + '|\n' + rows.map(function (r) { return '| ' + r.map(finRpCell_).join(' | ') + ' |'; }).join('\n') + '\n';
}

// GAS 칸 글(순수) — 같은 분석이면 같은 글(시각 없음 — 바뀐 것이 없으면 파일을 다시 쓰지 않게)
function finRpBlock_(A, U, sheetUrl) {
  var B = A.B, s = [], sum = finRvSummary_(A), C = A.change || { segs: [], drops: [], quarters: [] };
  var own = A.accts.filter(function (a) { return a.own; }), dmin = '', dmax = '';
  A.R.forEach(function (r) { if (!dmin || r.d < dmin) dmin = r.d; if (!dmax || r.d > dmax) dmax = r.d; });
  s.push('## 1. 검토 자료');
  s.push('- 피상속인 ' + (B.피상속인 || '[확인 필요]') + ' · 상속개시일 ' + (B.D ? B.D + (B.D짐작 ? '(「' + B.D짐작 + '」에서 짐작 — [확인 필요])' : '') : '[확인 필요 — 시트 「사건 기준」 탭]'));
  s.push('- 합친 거래 ' + A.R.length + '줄 · 계좌 ' + A.accts.length + '개(피상속인 ' + own.length + '개) · 기간 ' + dmin + ' ~ ' + dmax + ' · 잔액 검산 끊김 ' + A.breaks + '곳');
  // [2026.11.25] 사건 서류에서 읽은 기본 사실(FinDocs.js) — 상속인·빌려준 돈·부동산·보험금(모두 짐작, 근거 서류와 함께)
  var heirs = A.rels.filter(function (x) { return x.갈래 === '상속인' || (!x.갈래 && x.짐작 === '상속인'); });
  s.push('- 상속인 ' + (heirs.length ? heirs.map(function (x) { return x.이름 + (x.관계 || x.관계짐작 ? '(' + (x.관계 || x.관계짐작) + ')' : '') + (x.갈래 ? '' : ' — 짐작'); }).join(' · ') + (U.heirsGuess ? ' (' + U.heirsGuess.from + ')' : '') : '[확인 필요 — 가족관계증명서가 사건 폴더에 없음]'));
  (U.loans || []).forEach(function (l) { s.push('- 빌려준 돈: ' + l.대여인 + ' → ' + l.차용인 + (l.금액 ? ' ' + finRvWon_(l.금액) + '원' : '') + ' (' + String(l.근거).slice(0, 60) + ')'); });
  ((U.facts || {}).부동산 || []).forEach(function (p) { s.push('- 부동산 ' + p.종류 + ': ' + p.부동산 + ' · ' + p.날짜 + ' · ' + p.원인 + (p.금액 ? ' ' + finRvWon_(p.금액) + '원' : '') + ((p.상대 || []).length ? ' · 상대 ' + p.상대.join('·') : '') + ' (' + p.근거 + ')'); });
  ((U.facts || {}).보험금 || []).forEach(function (p) { s.push('- 보험금 ' + finRvWon_(p.금액) + '원 (' + p.근거 + ')'); });
  if (sheetUrl) s.push('- 분석 시트: ' + sheetUrl);
  var aFlags = A.flags.filter(function (f) { return f.번호.charAt(0) === 'A'; });
  s.push('- 자료 빈틈(과세관청은 조회로 볼 수 있는 자료) ' + aFlags.length + '곳' + (aFlags.length ? ':' : ''));
  aFlags.slice(0, 15).forEach(function (f) { s.push('  - ' + f.번호 + ' ' + f.짚을것 + (f.금액 ? ' · ' + finRvWon_(f.금액) + '원' : '') + (f.상태 ? ' — ' + f.상태 : '')); });
  s.push('');
  if ((A.asks || []).length) { s.push(''); s.push('### 여쭐 것(세금이 달라지는 것 — GAS 답안과 근거)'); s.push(finRpTable_(['무엇', '답안', '근거', '정하시는 곳'], A.asks.map(function (q) { return [q.무엇, q.답안 || '', String(q.근거 || '').slice(0, 120), q.곳]; }))); }
  s.push('');
  s.push('## 2. 증감분석(전체 예금 잔액)');
  if (C.segs.length) s.push(finRpTable_(['구간', '시작 잔액', '끝 잔액', '실제 증감', '경상 수입', '경상 지출', '쓰임 안 보이는 유출', '관련인으로'], C.segs.map(function (f) { var g = finTgRegular_(f); return [f.k, finRpMoney_(f.시작), finRpMoney_(f.끝), finRpMoney_((f.끝 || 0) - (f.시작 || 0) - (f.자료시작 || 0)), finRpMoney_(g.경상수입), finRpMoney_(g.경상지출), finRpMoney_(g.설명필요), finRpMoney_(g.관련인으로)]; })));
  else s.push('- 상속개시일이 없어 구간표 없음 — 해마다 표는 시트 「증감분석」 탭');
  s.push('- 크게 줄어든 구간 ' + C.drops.length + '곳' + (C.drops.length ? ':' : ''));
  C.drops.forEach(function (d) { s.push('  - ' + d.시작 + ' ~ ' + d.끝 + ' — ' + finRvWon_(d.줄어듦) + '원 줄어듦 · 쓰임 안 보이는 유출 ' + finRvWon_(d.설명필요) + '원 · 관련인으로 ' + finRvWon_(d.관련인으로) + '원 · 큰 상대 ' + d.큰상대.slice(0, 3).join(', ')); });
  s.push('');
  s.push('## 3. 분석대상자');
  var TG = (A.targets || []).filter(function (t) { return t.구분 < 3; });
  s.push(finRpTable_(['구분', '이름', '갈래', '관계', '§13 기간', '기간 안 나감', '기간 안 들어옴', '순액', '짚을 곳'], TG.slice(0, 40).map(function (t) {
    var x = t.x, n = A.flags.filter(function (f) { return f.상대 === x.이름; }).length;
    return [FIN_TG_GROUPS_[t.구분].slice(0, 1), x.이름, x.갈래 || (x.짐작 ? x.짐작 + ' (짐작)' : '모름'), x.관계 || x.관계짐작 || '', B.D ? t.yrs + '년' : '전체', finRpMoney_(t.기간나감), finRpMoney_(t.기간들어옴), finRpMoney_(t.기간순액), n || ''];
  })));
  if (TG.length > 40) s.push('- 그 밖 ' + (TG.length - 40) + '명 — 시트 「분석대상자」 탭');
  s.push('');
  s.push('## 4. 추정상속재산(상증법 §15)');
  if (!B.D) s.push('- 상속개시일이 없어 셈하지 않음 [확인 필요]');
  else s.push(finRpTable_(['기간', '순인출', '기준', '기준 넘음', '소명액(세무사님 칸)', '미소명', '추정액'], A.s15.map(function (x) { return [x.y + '년 안', finRpMoney_(x.순), finRpMoney_(x.기준), x.넘음 ? '넘음' : '안 넘음', finRpMoney_(x.소명), finRpMoney_(x.미소명), finRpMoney_(x.추정)]; })));
  (A.s15d || []).forEach(function (d) { s.push('- 부담한 채무(§15① 2호) ' + d.y + '년 안 — 통장에 대출로 들어온 돈 ' + finRvWon_(d.채무) + '원 · 기준 ' + finRvWon_(d.기준) + '원 ' + (d.넘음 ? '넘음(용도 소명 필요)' : '안 넘음')); });
  s.push('');
  s.push('## 5. 사전증여재산(상증법 §13)');
  if (!A.s13.length) s.push('- 분석대상자에 상속인·가족·특수관계 법인이 아직 정해지지 않음 [확인 필요 — 시트 「분석대상자」 탭 갈래 ✎]');
  else s.push(finRpTable_(['관련인', '갈래', '합산 기간', '나감', '들어옴', '순액'], A.s13.map(function (x) { return [x.x.이름, (x.x.갈래 || x.x.짐작 || '') + (x.확정 ? '' : ' (짐작)'), x.yrs + '년', finRpMoney_(x.나감), finRpMoney_(x.들어옴), finRpMoney_(x.순액)]; })));
  s.push('');
  s.push('## 6. 짚을 곳(남은 것, 중요도 순)');
  var open = A.flags.filter(function (f) { return !/소명 됨|해당 없음/.test(f.상태 || f.상태답안 || ''); /* 세무사님 칸이 비면 GAS 답안대로 */ }).slice().sort(function (a, b) { return (b.중요도 || 0) - (a.중요도 || 0); });
  s.push('- A 자료 빈틈 ' + sum.짚을곳.A + ' · B 추정상속 ' + sum.짚을곳.B + ' · C 사전증여 ' + sum.짚을곳.C + ' · D 큰돈 ' + sum.짚을곳.D + ' · 남은 것 ' + sum.짚을곳.남은것);
  s.push(finRpTable_(['번호', '짚을 것', '날짜', '금액', '상대', '상태', '배움'], open.slice(0, 30).map(function (f) { return [f.번호, f.짚을것, f.날짜 || '', finRpMoney_(f.금액), f.상대 || '', f.상태 || (f.상태답안 ? f.상태답안 + '(GAS 답안)' : '확인 전'), f.배움 || '']; })));
  if (open.length > 30) s.push('- 그 밖 ' + (open.length - 30) + '곳 — 시트 「짚을 곳」 탭');
  s.push('');
  s.push('## 7. 받을 자료');
  var W = A.flags.filter(function (f) { return f.want; });
  if (!W.length) s.push('(없음)');
  W.slice(0, 30).forEach(function (f) { var w = (U.wants || {})[f.id] || {}; s.push('- ' + f.want.무엇 + ' — ' + f.want.왜 + (w.요청 ? ' · ' + w.요청 : ' · 요청 여부 [세무사님 판단]')); });
  s.push('');
  s.push('## 8. 판단 반영 현황');
  var judged = Object.keys(U.rows || {}).filter(function (k) { var o = U.rows[k]; return o && Object.keys(o).some(function (z) { return z !== '_x' && o[z]; }); }).length;
  s.push('- 세무사님이 정하신 거래 ' + judged + '줄 · 갈래를 고르신 대상자 ' + A.rels.filter(function (x) { return x.갈래; }).length + '명 · 상태를 고르신 짚을 곳 ' + A.flags.filter(function (f) { return f.상태; }).length + '곳');
  var lu = A.learnUsed || {}; if (lu.lanes && (lu.lanes.length || lu.natures || lu.flags)) s.push('- 다른 사건에서 배운 짐작: 갈래 ' + lu.lanes.length + '곳 · 성격 ' + lu.natures + '줄 · 짚을 곳 표시 ' + lu.flags + '곳(시트 「배운 것」 탭)');
  s.push('- 판단(증여·대여·소명·특수관계·상속인)은 세무사님 — 위 숫자는 GAS가 통장 자료로 셈한 것이고 짐작에는 「짐작」 표시.');
  return s.join('\n');
}

// 보고서 파일에 GAS 칸 넣기 — 바뀐 것이 있을 때만 쓴다
function finRpSave_(folder, A, U, sheetUrl) {
  if (/^(아니오|아니요|끔|no)$/i.test(String((U.base || {}).보고서저절로 || '').trim())) return { off: true };
  var block = FIN_RP_S_ + '\n' + finRpBlock_(A, U, sheetUrl) + '\n' + FIN_RP_E_;
  var h = finHash32_(block); if (U.rpHash === h && U.rpFile) { try { DriveApp.getFileById(U.rpFile).getName(); return { same: true }; } catch (e) {} }
  var it = folder.getFoldersByName('보고서'), rf = it.hasNext() ? it.next() : folder.createFolder('보고서');
  var f = null, names = [FIN_RP_NAME_].concat(FIN_RP_OLD_);
  for (var i = 0; i < names.length && !f; i++) { var fi = rf.getFilesByName(names[i]); if (fi.hasNext()) f = fi.next(); }
  var txt;
  if (!f) {
    txt = '# 개별검토서 — 금융거래(추정상속재산·사전증여재산 선제 검토)\n\n> 아래 GAS 칸은 금융거래 분석 시트(1단계 합친 거래 → 증감분석 → 분석대상자 → 대상자별 거래 → §15·§13·짚을 곳)에서 저절로 채워집니다. 판단·의견은 맨 아래 「세무사님·넥스 의견」에 적습니다.\n\n' + block + '\n\n## 세무사님·넥스 의견\n\n(판단·소명 방향을 적는 곳 — GAS는 이 아래를 고치지 않습니다)\n';
    f = rf.createFile(FIN_RP_NAME_, txt, 'text/markdown');
    U.rpHash = h; U.rpFile = f.getId(); U.rpName = f.getName();
    return { made: true, name: FIN_RP_NAME_ };
  }
  var old = f.getBlob().getDataAsString('UTF-8'), a = old.indexOf(FIN_RP_S_.slice(0, 22)), b = old.indexOf(FIN_RP_E_);
  if (a !== -1 && b > a) txt = old.slice(0, a) + block + old.slice(b + FIN_RP_E_.length);
  else txt = old.replace(/\s*$/, '') + '\n\n' + block + '\n';
  if (txt === old) { U.rpHash = h; U.rpFile = f.getId(); U.rpName = f.getName(); return { same: true }; }
  try { var pi = rf.getFoldersByName('_이전판'), pf = pi.hasNext() ? pi.next() : rf.createFolder('_이전판'); pf.createFile(f.getName().replace(/\.md$/, '') + '_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd-HHmm') + '.md', old, 'text/markdown'); } catch (e) {}
  f.setContent(txt);
  U.rpHash = h; U.rpFile = f.getId(); U.rpName = f.getName();
  return { updated: true, name: f.getName() };
}
