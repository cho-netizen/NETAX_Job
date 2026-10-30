// KnowHow.js — [2026.10.20] 지침·템플릿 정비 순환. 세무사님:
//   "개별업무나 상황별 지침서 그리고 검토서나 보고서나 의뢰서 템플릿이 노하우의 최종 결정체가 된다. 지속적으로 이런 파일을 만들도록 하는 장치를 마련하라"
//   "기존 파일을 점검하여 수정할 것은 수정하고 폐기할 것은 폐기하고 새로 만들 것은 만들어야 한다"
//
// 흐름(돈 드는 AI는 앱 서버에서 자동으로 부르지 않는다 — 토큰 원칙):
//  ① 밤(0원, knhNightly_ ← runNightlyChiefManager): 재료 모으기 + 모든 지침·템플릿 판정(현행/수정 필요/폐기 후보) + 업무별 보유 현황(빈칸 = 신규 필요).
//     재료: 최근 완료 사건의 검토서·보고서(고객 이름·금액 가림, 템플릿 대비 변경량) / 세무사님이 고친 칸(CORR_LOG) / 지침 없는 업무 /
//           반복된 유료 AI 질문 / 법령 개정(EnvWatch 결과 → 그 조문을 인용한 파일) / 쓰인 횟수(템플릿)·읽힌 횟수(지침).
//     틀린 경로·도구·조문·옛 방식은 시스템 자기점검(SysAudit.js sysAuditRules_)과 **같은 함수**로 본다 — 지침은 그 점검 결과를 그대로 읽고,
//     템플릿은 같은 함수에 템플릿 본문을 넣어 돌린다(그 파일이 서버에 없으면 이 부분만 건너뛰고 "자기점검 결과 없음"으로 적는다).
//  ② 주간 웹 Claude Code 루틴(구독): 개선 후보 보고서의 knowhow(knhForReport_)를 읽어 신규·수정 초안·폐기 제안을
//     gs-backend/knowhow/ 아래 파일 + _index.txt 한 줄로 PR에 올린다(루틴은 드라이브에 직접 못 씀).
//  ③ 세무사님이 PR 승인 → 📥 반영 때 gh_deployApply_가 knhSyncFromGithub_로 그 제안 파일을 드라이브 각 폴더의 "_제안함"에 넣는다(바로 쓰이지 않음).
//  ④ 🧭 시스템 관리 "📚 제안 대기"(manage/knowhow.html)에서 보기·차이 보기 → ✅ 채택(이전 판은 "_이전판") / ✏ 작성관리에서 고쳐서 채택 / ✖ 반려(사유 → 다음 루틴이 읽음),
//     폐기 제안은 ✅ 폐기(지우지 않고 그 폴더 "_폐기"로 옮김) / ✖ 유지. 처리한 제안 파일은 "_제안함/_처리됨"으로 옮긴다(지우지 않음).
// 저장: 총괄관리자/_지침정비/ — 정비판정_최신.json(판정·현황판), _정비상태.json(법령 개정 누적·본 사건), _제안목록.json(제안 원장), _제안결정기록.json(결정)
// 순수 함수(knhCoverage_·knhJudge_·knhParseIndex_·knhMask_·knhChangeRatio_)는 드라이브를 모른다 — tools/knowhow-check.js가 node에서 실제 드라이브 목록으로 같은 함수를 돌린다.

var KNH_DIR_ = '_지침정비';
var KNH_RESULT_ = '정비판정_최신.json';
var KNH_STATE_ = '_정비상태.json';
var KNH_LEDGER_ = '_제안목록.json';
var KNH_DECISIONS_ = '_제안결정기록.json';
var KNH_INBOX_ = '_제안함';
var KNH_DONE_ = '_처리됨';
var KNH_RETIRE_ = '_폐기';
var KNH_UNUSED_DAYS_ = 90;     // 이 기간 동안 한 번도 안 쓰이면(셈을 시작한 지 이만큼 지난 뒤부터) 폐기 후보
var KNH_KINDS_ = ['지침', '보고서', '의뢰서', '문단'];

// 업무(세목 × 업무유형) — workmanage.html WORK_UPTYPE_OPTIONS_·Code.js WORK_SEMOK_LABELS_와 같은 값
var KNH_SEMOK_ = { transfer: '양도', gift: '증여', inheritance: '상속', business: '사업', objection: '불복' };
var KNH_UPTYPES_ = {
  양도: ['신고', '자문', '상담'], 증여: ['신고', '자문', '상담'], 상속: ['신고', '자문', '상담'], 사업: ['신고', '자문', '상담'],
  불복: ['이의신청', '심사청구', '심판청구', '행정소송', '경정청구', '과세적부', '해명자료', '세무조사', '자금출처소명']
};
// 업무별로 "관련 지침"으로 보는 이름 — 세목 업무는 이름이 "세목_"으로 시작하는 지침, 불복 세부유형은 그 낱말이 든 지침.
// 핵심(core): 이 업무를 처음부터 끝까지 이끄는 지침 — 없으면 빈칸(신규 필요)으로 본다.
var KNH_TASK_GUIDE_ = {
  양도: { any: /^양도_/, core: /^양도_(계산구조|기본흐름|신고)/ },
  증여: { any: /^증여_/, core: /^증여_(계산구조|기본흐름|신고)/ },
  상속: { any: /^상속_/, core: /^상속_(계산구조|기본흐름|신고)/ },
  사업: { any: /^(사업|종합소득|종소|부가)/, core: /^(사업|종합소득|종소)_(계산구조|기본흐름|신고)/ },
  이의신청: { any: /불복|이의신청/, core: /불복|이의신청/ }, 심사청구: { any: /불복|심사청구/, core: /불복|심사청구/ },
  심판청구: { any: /불복|심판청구/, core: /불복|심판청구/ }, 행정소송: { any: /불복|행정소송/, core: /행정소송/ },
  과세적부: { any: /과세전적부|과세적부|불복/, core: /과세전적부|과세적부/ }, 경정청구: { any: /경정청구/, core: /경정청구/ },
  해명자료: { any: /해명/, core: /해명/ }, 세무조사: { any: /세무조사/, core: /세무조사/ }, 자금출처소명: { any: /자금출처/, core: /자금출처/ }
};
// 업무별 보고서 템플릿(작성관리 문서 종류 이름 — reportwriter.html fallbackName). 상담은 폴더·문서가 없는 업무라 없음.
var KNH_REPORT_LABELS_ = ['종합검토서', '개별검토서', '자문보고서', '신고보고서', '검토조서', '진행보고서', '불복청구서', '번역서', '요약보고서'];
var KNH_TASK_REPORTS_ = { 신고: ['신고보고서', '종합검토서'], 자문: ['자문보고서', '종합검토서'], 상담: [],
  이의신청: ['불복청구서'], 심사청구: ['불복청구서'], 심판청구: ['불복청구서'], 행정소송: ['불복청구서'], 과세적부: ['불복청구서'], 경정청구: ['불복청구서'],
  해명자료: ['자문보고서'], 세무조사: ['진행보고서'], 자금출처소명: ['자문보고서'] };

// ---------------------------------------------------------------------------------------------
// 순수 함수
// ---------------------------------------------------------------------------------------------
function knhBase_(name) { return String(name || '').replace(/\.(md|txt)$/i, ''); }

// 새 사건에 실제로 들어가는 의뢰서 템플릿 — Code.js work_seedCaseTemplateIfAny_ 후보 순서(세목+업무유형 → 업무유형 → 세목) 그대로.
// 상담은 사건 폴더를 만들지 않아(newRow 폴더ID '') 의뢰서가 들어가지 않는다.
function knhPickIntake_(semok, up, intakeNames) {
  if (up === '상담') return null;
  var have = {}; (intakeNames || []).forEach(function (n) { have[knhBase_(n)] = 1; });
  var cands = [semok + up, up, semok].map(function (n) { return '의뢰서_' + n; });
  for (var i = 0; i < cands.length; i++) if (have[cands[i]]) return cands[i];
  return null;
}

// 업무별 보유 현황. input: { cases:[{세목, 업무유형, 수정일}], bm:[{name, modified, status}], tpl:{보고서:[{name,modified,status}], 의뢰서:[...]}, today:'yyyy-MM-dd' }
function knhCoverage_(input) {
  var cnt = {}, recent = {};
  var today = input.today || '';
  var cutoff = today ? knhAddDays_(today, -180) : '';
  (input.cases || []).forEach(function (c) {
    var s = KNH_SEMOK_[c.세목] || c.세목 || '';
    var k = s + '|' + (c.업무유형 || '');
    cnt[k] = (cnt[k] || 0) + 1;
    if (cutoff && String(c.수정일 || '').slice(0, 10) >= cutoff) recent[k] = (recent[k] || 0) + 1;
  });
  var bm = input.bm || [], rep = (input.tpl && input.tpl.보고서) || [], intake = (input.tpl && input.tpl.의뢰서) || [];
  var byName = {}; bm.concat(rep, intake).forEach(function (f) { byName[knhBase_(f.name)] = f; });
  var rows = [];
  Object.keys(KNH_UPTYPES_).forEach(function (s) {
    KNH_UPTYPES_[s].forEach(function (up) {
      var g = KNH_TASK_GUIDE_[s === '불복' ? up : s];
      var guides = bm.filter(function (f) { return g.any.test(knhBase_(f.name)); }).map(function (f) { return knhBase_(f.name); });
      var core = guides.filter(function (n) { return g.core.test(n); });
      var intakeName = knhPickIntake_(s, up, intake.map(function (f) { return f.name; }));
      var reps = (KNH_TASK_REPORTS_[up] || []).filter(function (l) { return rep.some(function (f) { return knhBase_(f.name) === l; }); });
      var needReps = (KNH_TASK_REPORTS_[up] || []).filter(function (l) { return reps.indexOf(l) === -1; });
      var related = guides.concat(intakeName ? [intakeName] : [], reps);
      var last = '', worst = '현행';
      var rank = { '현행': 0, '수정 필요': 1, '폐기 후보': 2 };
      related.forEach(function (n) { var f = byName[n]; if (!f) return; if (String(f.modified || '') > last) last = String(f.modified || ''); if (f.status && rank[f.status] > rank[worst]) worst = f.status; });
      var blanks = [];
      if (!core.length) blanks.push(guides.length ? '이끄는 지침(' + (s === '불복' ? up : s + ' 계산구조·신고 흐름') + ')' : '지침');
      if (up !== '상담' && !intakeName) blanks.push('의뢰서');
      needReps.forEach(function (l) { blanks.push('보고서 템플릿 ' + l); });
      var k = s + '|' + up;
      rows.push({ 세목: s, 업무유형: up, 업무: s === '불복' ? up : s + ' ' + up, 사건수: cnt[k] || 0, 최근사건: recent[k] || 0,
        지침: guides, 핵심지침: core, 의뢰서: intakeName, 보고서: reps, 마지막정비: last.slice(0, 10), 상태: related.length ? worst : '', 빈칸: blanks });
    });
  });
  // 사건 목록에 있는데 위 표에 없는 업무(옛 이름 등)
  Object.keys(cnt).forEach(function (k) {
    var p = k.split('|');
    if (rows.some(function (r) { return r.세목 === p[0] && r.업무유형 === p[1]; })) return;
    rows.push({ 세목: p[0], 업무유형: p[1], 업무: p.join(' '), 사건수: cnt[k], 최근사건: recent[k] || 0, 지침: [], 핵심지침: [], 의뢰서: null, 보고서: [], 마지막정비: '', 상태: '', 빈칸: ['표에 없는 업무 이름 — 사건 목록의 세목·업무유형 확인'] });
  });
  // 빈칸이 있는 업무 중 사건이 많은 것부터(다음 작성 대상)
  var order = rows.filter(function (r) { return r.빈칸.length; }).sort(function (a, b) { return (b.최근사건 - a.최근사건) || (b.사건수 - a.사건수); });
  return { rows: rows, next: order.slice(0, 12).map(function (r) { return { 업무: r.업무, 사건수: r.사건수, 최근사건: r.최근사건, 빈칸: r.빈칸 }; }) };
}

function knhAddDays_(ymd, d) {
  var t = new Date(String(ymd).slice(0, 10) + 'T00:00:00Z').getTime() + d * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
function knhDaysBetween_(a, b) { return Math.round((new Date(String(b).slice(0, 10) + 'T00:00:00Z') - new Date(String(a).slice(0, 10) + 'T00:00:00Z')) / 86400000); }

// 조문 인용 → '소득세법시행령|155' 같은 키. SysAudit.js sysAuditCitations_가 있으면 그것(자기점검과 같은 해석), 없으면 간단한 자체 해석.
function knhCitationKeys_(text) {
  var keys = {};
  String(text || '').split('\n').forEach(function (line) {
    if (typeof sysAuditCitations_ === 'function') {
      sysAuditCitations_(line).forEach(function (c) { keys[c.key + '|' + c.jo] = c.label; });
      return;
    }
    var re = /(소득세법|상속세\s*및\s*증여세법|조세특례제한법|국세기본법)(\s*시행령|\s*시행규칙)?\s*(?:§\s*(\d+)(?:\s*의\s*(\d+))?|제\s*(\d+)\s*조(?:\s*의\s*(\d+))?)/g, m;
    while ((m = re.exec(line))) {
      var jo = (m[3] || m[5]) + ((m[4] || m[6]) ? '의' + (m[4] || m[6]) : '');
      keys[m[1].replace(/\s/g, '') + (m[2] ? m[2].replace(/\s/g, '') : '') + '|' + jo] = m[0];
    }
  });
  return keys;
}

// 판정. input:
//  files: [{ kind:'지침'|'보고서'|'의뢰서'|'문단', name, text, modified:'yyyy-MM-dd HH:mm', md5 }]
//  audit: { '종류/파일이름': { problems:[{kind, level, text, line}] } }   ← 자기점검(sysAuditRules_) 결과 — 지침은 야간 자기점검 파일, 템플릿은 여기서 같은 함수로
//  lawChanges: [{ key:'소득세법시행령', jo:'155', 시행일:'2026-10-01', 감지일:'2026-10-02', 법령:'소득세법 시행령', 구분 }]
//  uses: { '지침/이름': { n, last } }, useSince:'yyyy-MM-dd', today
//  intakeReachable: { '의뢰서_x': '쓰이는 업무 설명' } (없으면 안 쓰임), corrections:[{docType, field, count}]
//  tplStats: { 템플릿별:[{종류, 템플릿, 사본수, 공통추가제목:[], 늘빈칸:[]}], 문단사용:[{문단, 사용}] }
// 돌려줌: [{ kind, name, status, tags:[], reasons:[{type:'수정'|'폐기'|'참고', why, detail?}], uses, modified }]
function knhJudge_(input) {
  var today = input.today || '';
  var useDays = input.useSince && today ? knhDaysBetween_(input.useSince, today) : 0;
  var out = [];
  var tplBy = {}; ((input.tplStats && input.tplStats.템플릿별) || []).forEach(function (t) { tplBy[t.종류 + '/' + t.템플릿] = t; });
  var paraBy = {}; ((input.tplStats && input.tplStats.문단사용) || []).forEach(function (p) { paraBy[p.문단] = p.사용; });
  (input.files || []).forEach(function (f) {
    var reasons = [], tags = [];
    var text = String(f.text || '');
    var base = knhBase_(f.name);
    var add = function (type, why, detail) { reasons.push(detail ? { type: type, why: why, detail: detail } : { type: type, why: why }); };
    // 1) 자기점검과 같은 함수로 본 틀린 곳(옛 주소·방식, 없는 도구·지침·경로, 없는 조문)
    var au = input.audit && input.audit[f.kind + '/' + f.name];
    if (au && au.problems) {
      var bad = au.problems.filter(function (p) { return p.level === '문제' && p.kind !== '중복'; });
      if (bad.length) {
        var kinds = {}; bad.forEach(function (p) { kinds[p.kind] = (kinds[p.kind] || 0) + 1; });
        add('수정', '틀린 곳 ' + bad.length + '곳(' + Object.keys(kinds).map(function (k) { return k + ' ' + kinds[k]; }).join(', ') + ') — 시스템 자기점검', bad.slice(0, 6).map(function (p) { return (p.line ? p.line + '줄: ' : '') + p.text; }));
      }
      var dupe = au.problems.filter(function (p) { return p.kind === '중복'; });
      if (dupe.length >= 5) add('참고', '다른 지침과 같은 문장 ' + dupe.length + '곳 — 한 곳에 두고 가리키기(통합 검토)');
    } else if (f.kind === '지침' && input.audit) tags.push('자기점검 결과 없음');
    // 2) 현행화 — [2026.10.22] 절세 아이템과 같은 판정 함수(knhCurrency_) 하나로 합침. 세무사님 "2번 작업을 하자"(지침·의뢰서·보고서 템플릿에도 같은 현행화 점검).
    //    인용 조문 개정(확인 결론 _개정확인.json 반영)·본문 날짜 지남·개편안 60일·기준일 1년. 조문은 본문 전체에서(지침은 근거가 본문 곳곳에 있음).
    var cur = knhCurrency_(knhDocFacts_(text, f.modified, Object.keys(knhCitationKeys_(text))), input.lawChanges, today, input.confirms);
    if (cur.법령.length) add('수정', '법령 개정 반영 필요 — ' + cur.법령.slice(0, 4).map(knhLawLabel_).join(', ') + (cur.법령.length > 4 ? ' 외 ' + (cur.법령.length - 4) + '개' : ''), cur.법령.map(function (c) { return c.법령 + ' §' + c.jo; }));
    cur.이유.filter(function (r) { return !/^인용 조문 개정/.test(r); }).forEach(function (r) { add('수정', '현행화 필요 — ' + r); });
    if (cur.필요) tags.push('현행화 필요');
    // 3) 아직 확인 못 한 곳·검토 전 초안
    var conf = (text.match(/\[확인 필요/g) || []).length;
    if (conf) add('보완', '"[확인 필요]" ' + conf + '곳 — 원문 확인해 채울 것');
    if (/^>\s*상태:\s*초안/m.test(text)) tags.push('검토 전 초안');
    // 4) 세무사님이 반복해서 고친 곳
    if (f.kind === '보고서' || f.kind === '의뢰서') {
      var ts = tplBy[f.kind + '/' + f.name];
      if (ts && (ts.공통추가제목 || []).length) add('수정', '사본 ' + ts.사본수 + '건에서 공통으로 새로 넣은 제목 — ' + ts.공통추가제목.slice(0, 4).join(', '));
      if (ts && (ts.늘빈칸 || []).length) add('수정', '늘 비워 두는 칸 — ' + ts.늘빈칸.slice(0, 5).join(', ') + '(빼거나 설명 고칠 것)');
    }
    if (f.kind === '지침' && /^서류_/.test(base)) {
      (input.corrections || []).forEach(function (c) {
        var words = String(c.docType || '').split(/[\s_·/()]+/).filter(function (w) { return w.length >= 2; });
        if (words.some(function (w) { return base.indexOf(w) !== -1; })) add('수정', '세무사님이 이 서류의 "' + c.field + '" 칸을 ' + c.count + '번 고침 — 읽는 법 보완');
      });
    }
    // 5) 폐기 후보 — 대체됨·안 쓰임·스스로 폐기 표시
    if (/^>\s*상태:\s*(폐기|대체)/m.test(text) || /이\s*(지침|템플릿)은\s*[^\n]{0,40}(으로|로)\s*대체/.test(text)) add('폐기', '본문에 폐기·대체 표시가 있음');
    if (f.kind === '의뢰서' && input.intakeReachable && !input.intakeReachable[base]) add('폐기', '새 사건에 자동으로 들어가는 업무가 없음 — 더 구체적인 의뢰서가 먼저 쓰이거나(상담은 폴더 없음) 이름이 규칙과 다름');
    if (f.kind === '보고서' && KNH_REPORT_LABELS_.indexOf(base) === -1) add('폐기', '작성관리 문서 종류에 없는 이름이라 불러지지 않음(이름을 문서 종류와 같게 하거나 폐기)');
    var u = input.uses && input.uses[f.kind + '/' + base];
    if (f.kind !== '문단') {
      if (useDays >= KNH_UNUSED_DAYS_ && !(u && u.n)) add('폐기', '최근 ' + useDays + '일 동안 한 번도 ' + (f.kind === '지침' ? 'AI가 읽지' : '쓰이지') + ' 않음');
      else if (!(u && u.n)) tags.push(useDays ? '셈 ' + useDays + '일째 — 아직 0회' : '쓰임 셈 시작 전');
    } else if (paraBy[f.name] === 0) tags.push('최근 40일 사본에 안 쓰임');
    if (text.replace(/\s/g, '').length < 150) add('수정', '내용이 거의 없음(' + text.replace(/\s/g, '').length + '자)');
    // 상태: 폐기 > 수정(보완 포함). 급한 정도(priority): 3 = 틀린 곳·법령 개정, 2 = 세무사님이 반복해서 고친 곳·내용 없음, 1 = [확인 필요]만, 0 = 현행 — 주간 루틴은 높은 것부터
    var status = reasons.some(function (r) { return r.type === '폐기'; }) ? '폐기 후보' : reasons.some(function (r) { return r.type === '수정' || r.type === '보완'; }) ? '수정 필요' : '현행';
    var pri = reasons.some(function (r) { return r.type === '수정' && /자기점검|법령 개정/.test(r.why); }) ? 3 : reasons.some(function (r) { return r.type === '수정' || r.type === '폐기'; }) ? 2 : reasons.some(function (r) { return r.type === '보완'; }) ? 1 : 0;
    out.push({ kind: f.kind, name: f.name, status: status, priority: pri, tags: tags, reasons: reasons, uses: u || { n: 0, last: '' }, modified: f.modified || '', md5: f.md5 || '', chars: text.length, fileId: f.fileId || '' });
  });
  out.sort(function (a, b) { return b.priority - a.priority || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.name < b.name ? -1 : 1); });
  return out;
}
// 본문에 그 날짜(2027-09-09 / 2027.9.9. / 2027. 9. 9. / 2027년 9월 9일)가 적혀 있나
function knhMentionsDate_(text, ymd) {
  // [2026.10.21] 역슬래시가 빠진 채(\d → d, '\s' → 's') 들어가 있어 늘 false였다 — 고침(법령 개정을 이미 본문에 반영한 파일도 "반영 필요"로 남던 원인)
  var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  var y = m[1], mo = String(+m[2]), d = String(+m[3]);
  return new RegExp(y + '\\s*[.\\-년]\\s*0?' + mo + '\\s*[.\\-월]\\s*0?' + d + '(?!\\d)').test(String(text || ''));
}

// 저장소 gs-backend/knowhow/_index.txt — 탭 구분: id 종류 작업 대상 제안파일 기준MD5 이유
function knhParseIndex_(txt) {
  var out = [], errs = [];
  String(txt || '').split('\n').forEach(function (l, i) {
    if (!l.trim() || l.charAt(0) === '#') return;
    var p = l.split('\t').map(function (x) { return x.trim(); });
    var e = { id: p[0], 종류: p[1], 작업: p[2], 대상: p[3], 파일: p[4] && p[4] !== '-' ? p[4] : '', 기준md5: p[5] && p[5] !== '-' ? p[5] : '', 이유: p.slice(6).join(' ') };
    if (!e.id || KNH_KINDS_.indexOf(e.종류) === -1 || ['신규', '수정', '폐기'].indexOf(e.작업) === -1 || !e.대상 || (e.작업 !== '폐기' && !e.파일)) { errs.push((i + 1) + '줄 형식 오류: ' + l.slice(0, 80)); return; }
    if (/[\\\/:*?"<>|]/.test(e.대상) || e.대상.charAt(0) === '_') { errs.push((i + 1) + '줄 대상 이름이 잘못됨: ' + e.대상); return; }
    if (!/\.(md|txt)$/i.test(e.대상)) e.대상 += '.md';
    out.push(e);
  });
  return { entries: out, errors: errs };
}

// 고객 정보 가리기 — 사건 당사자 이름(작업관리 고객명·납세자), 다섯 자리 이상 숫자(금액·번호), 주소 번지, 주민번호 모양
function knhMask_(text, names) {
  var t = String(text || '');
  (names || []).slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (n) { if (n && n.length >= 2) t = t.split(n).join('○○'); });
  t = t.replace(/\d{6}\s*-\s*\d{7}/g, '######-#######')
    .replace(/[가-힣]+(?:로|길|동|리)\s*\d+(?:-\d+)?(?:번지)?/g, '(주소)')
    .replace(/\d{1,3}(?:,\d{3}){1,}|\d{5,}/g, '#');
  return t;
}

// 템플릿 대비 변경량 — 템플릿 제목(##) 중 사본에 남은 비율, 사본에 새로 생긴 제목
function knhChangeRatio_(tplText, copyText) {
  var heads = function (t) { return (String(t).match(/^#{2,3}\s.+$/gm) || []).map(function (h) { return h.replace(/^#+\s*/, '').replace(/[\d.()\s·:—–-]+/g, ' ').trim(); }).filter(function (h) { return h.length >= 2; }); };
  var a = heads(tplText), b = heads(copyText);
  if (!a.length) return { kept: 1, added: b };
  var kept = a.filter(function (h) { return b.indexOf(h) !== -1; }).length / a.length;
  return { kept: Math.round(kept * 100) / 100, added: b.filter(function (h) { return a.indexOf(h) === -1; }) };
}

// ---------------------------------------------------------------------------------------------
// GAS — 폴더·파일
// ---------------------------------------------------------------------------------------------
function knhDir_() { var c = getChiefManagerFolder_(); return c ? getOrCreateSubfolder_(c, KNH_DIR_) : null; }
function knhReadJson_(name, dflt) {
  var d = knhDir_(); if (!d) return dflt;
  var it = d.getFilesByName(name);
  if (!it.hasNext()) return dflt;
  try { return JSON.parse(it.next().getBlob().getDataAsString('UTF-8') || 'null') || dflt; } catch (e) { return dflt; }
}
function knhWriteJson_(name, obj) { var d = knhDir_(); if (d) writeFileOverwrite_(d, name, JSON.stringify(obj), 'application/json'); }
function knhNow_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
function knhMd5_(s) { return typeof tplMd5_ === 'function' ? tplMd5_(s) : Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)); }

// 종류별 원본 폴더 — 지침 = 업무관리자 맨 위, 보고서·의뢰서 = 각 템플릿 폴더, 문단 = 보고서템플릿/문단
function knhFolder_(kind) {
  if (kind === '지침') return getBusinessManagerFolder_();
  if (kind === '보고서') return getReportTemplateFolder_();
  if (kind === '의뢰서') return getCaseTemplateFolder_();
  if (kind === '문단') { var r = getReportTemplateFolder_(); if (!r) return null; var it = r.getFoldersByName('문단'); return it.hasNext() ? it.next() : null; }
  return null;
}
function knhSub_(folder, name, create) {
  if (!folder) return null;
  var it = folder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFolder(name) : null;
}
function knhFindFile_(folder, name) {
  if (!folder) return null;
  var it = folder.getFilesByName(name);
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}
function knhListFiles_(kind) {
  var folder = knhFolder_(kind), out = [];
  if (!folder) return out;
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next(), n = f.getName();
    if (!/\.(md|txt)$/i.test(n) || f.isTrashed()) continue;
    if (kind === '문단' && n.charAt(0) === '_') continue; // _사용법.md
    var text = '';
    try { text = f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''); } catch (e) { }
    out.push({ kind: kind, name: n, text: text, fileId: f.getId(), md5: knhMd5_(text), modified: Utilities.formatDate(f.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') });
  }
  out.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  return out;
}

// ---------------------------------------------------------------------------------------------
// 쓰인 횟수 — Code.js toolLoadBusinessManager(지침)·handleGetReportTemplate(보고서)·work_seedCaseTemplateIfAny_(의뢰서)가 부른다
// ---------------------------------------------------------------------------------------------
function knhCountUse_(kind, name) {
  var p = PropertiesService.getScriptProperties();
  var u = {};
  try { u = JSON.parse(p.getProperty('KNH_USE') || '{}'); } catch (e) { u = {}; }
  var k = kind + '/' + knhBase_(name);
  var e = u[k] || [0, ''];
  e[0]++; e[1] = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  u[k] = e;
  p.setProperty('KNH_USE', JSON.stringify(u));
  if (!p.getProperty('KNH_USE_SINCE')) p.setProperty('KNH_USE_SINCE', e[1]);
}
function knhUses_() {
  var p = PropertiesService.getScriptProperties(), u = {}, out = {};
  try { u = JSON.parse(p.getProperty('KNH_USE') || '{}'); } catch (e) { u = {}; }
  Object.keys(u).forEach(function (k) { out[k] = { n: u[k][0], last: u[k][1] }; });
  return { uses: out, since: p.getProperty('KNH_USE_SINCE') || '' };
}

// ---------------------------------------------------------------------------------------------
// 재료 모으기(0원)
// ---------------------------------------------------------------------------------------------
function knhCaseRows_() {
  var rows = [], names = [];
  try {
    var sh = work_getSheet_(), vals = sh.getDataRange().getValues(), col = work_colMap_(vals[0]);
    vals.slice(1).forEach(function (r) {
      var fmt = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd') : String(v || ''); };
      rows.push({ id: String(r[col.id] || ''), 세목: String(r[col.세목] || ''), 업무유형: String(r[col.업무유형] || ''), 상태: String(r[col.상태] || ''), 수정일: fmt(r[col.수정일]), 폴더ID: String(r[col.폴더ID] || '') });
      [r[col.고객명], r[col.납세자]].forEach(function (v) { String(v || '').split(/[,()\s]+/).forEach(function (n) { if (n.length >= 2 && n.length <= 4) names.push(n); }); });
    });
  } catch (e) { }
  return { rows: rows, names: names };
}

// 최근 완료 사건의 검토서·보고서 → "이 사건에서 배운 것" 재료(이름·금액 가림). 한 번 본 사건은 다시 싣지 않는다(최근 결과는 60일 보관).
function knhCaseMaterial_(cr, state, tplFiles, deadline) {
  var seen = state.casesSeen || {}, out = [];
  var since = Utilities.formatDate(new Date(Date.now() - 21 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
  var reps = (tplFiles.보고서 || []);
  cr.rows.filter(function (r) { return r.상태 === '완료' && r.폴더ID && r.수정일 >= since && !seen[r.id]; }).slice(0, 8).forEach(function (r) {
    if (Date.now() > deadline) return;
    var item = { 업무: (KNH_SEMOK_[r.세목] || r.세목) + ' ' + r.업무유형, 완료: r.수정일, 문서: [] };
    try {
      var it = DriveApp.getFolderById(r.폴더ID).getFoldersByName(typeof WORK_SUBFOLDER_INTERNAL_REPORT !== 'undefined' ? WORK_SUBFOLDER_INTERNAL_REPORT : '보고서_내부');
      if (it.hasNext()) {
        var fi = it.next().getFiles(), n = 0;
        while (fi.hasNext() && n < 3) {
          var f = fi.next();
          if (!/\.md$/i.test(f.getName())) continue;
          n++;
          var text = f.getBlob().getDataAsString('UTF-8');
          // [2026.10.21] 사본 첫머리 "바탕 템플릿: <이름> · 판 <수정일>" 줄이 있으면 그것으로 템플릿을 짝짓고(없으면 예전처럼 파일 이름으로),
          // 그 판이 지금 템플릿보다 옛것이면 표시한다 — 변경량은 지금 템플릿과 비교하므로 옛 판 사본은 템플릿이 고쳐진 만큼 크게 나온다.
          var st = knhTplParseStamp_(text);
          var tp = (st && reps.filter(function (t) { return knhBase_(t.name) === st.name; })[0]) || reps.filter(function (t) { return f.getName().indexOf(knhBase_(t.name)) !== -1; })[0];
          var ch = tp ? knhChangeRatio_(tp.text, text) : null;
          // 세무사님 판단이 담기는 절(판단·결론·검토의견·쟁점)만 짧게
          var secs = [];
          String(text).split(/\n(?=##\s)/).forEach(function (s) { if (/^##\s*[^\n]*(판단|결론|검토\s*의견|쟁점|세무사|유의|주의)/.test(s) && secs.join('').length < 1500) secs.push(s.slice(0, 700)); });
          item.문서.push({ 템플릿: tp ? tp.name : '', 바탕판: st ? st.ver : '', 옛판으로씀: !!(st && tp && st.ver < tp.modified), 제목남은비율: ch ? ch.kept : null, 새제목: ch ? ch.added.slice(0, 8).map(function (h) { return knhMask_(h, cr.names); }) : [],
            크게고침: !!(ch && (ch.kept < 0.5 || ch.added.length >= 4)), 판단발췌: knhMask_(secs.join('\n'), cr.names).slice(0, 1500), 글자수: text.length });
        }
      }
    } catch (e) { item.오류 = String(e && e.message || e).slice(0, 100); }
    seen[r.id] = r.수정일;
    out.push(item);
  });
  // 오래된 본 기록 정리
  var cut = Utilities.formatDate(new Date(Date.now() - 120 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
  Object.keys(seen).forEach(function (k) { if (seen[k] < cut) delete seen[k]; });
  state.casesSeen = seen;
  return out;
}

// 법령 개정 누적 — EnvWatch 결과(그날 밤만 새로시행 표시)를 쌓아 두어, 그 조문을 인용한 파일이 고쳐질 때까지 "개정 반영 필요"로 남긴다
function knhLawChanges_(state) {
  var list = state.lawChanges || [];
  var have = {}; list.forEach(function (c) { have[c.key + '|' + c.jo + '|' + c.시행일] = 1; });
  try {
    var r = typeof envWatchLast_ === 'function' ? envWatchLast_() : null;
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    ((r && r.laws && r.laws.items) || []).forEach(function (l) {
      var key = String(l.법령 || '').replace(/\s/g, '');
      var push = function (arr, ef, kind) {
        (arr || []).forEach(function (a) {
          var jo = String(a.조 || '').replace(/^제|조$/g, '');
          var k = key + '|' + jo + '|' + ef;
          if (!jo || have[k]) return; have[k] = 1;
          list.push({ key: key, jo: jo, 법령: l.법령, 시행일: knhYmd_(ef), 감지일: today, 구분: kind, 제목: a.제목 || '' });
        });
      };
      if (l.새로시행) push(l.바뀐조문, l.현행 && l.현행.시행일, '시행');
      (l.시행예정 || []).forEach(function (f) { push(f.바뀔조문, f.시행일, '시행예정'); });
    });
  } catch (e) { }
  var cut = Utilities.formatDate(new Date(Date.now() - 400 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
  state.lawChanges = list.filter(function (c) { return c.감지일 >= cut; }).slice(-600);
  return state.lawChanges;
}
function knhYmd_(s) { var m = String(s || '').match(/(\d{4})\D?(\d{2})\D?(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : String(s || ''); }

// 반복된 유료 AI 질문 중 맞는 지침이 없어 보이는 것(지침 이름 낱말과 하나도 안 겹침)
function knhPaidGaps_(bmNames) {
  var paid = [];
  try { paid = JSON.parse(ai_paidLogFile_().getBlob().getDataAsString('UTF-8') || '[]'); } catch (e) { paid = []; }
  var since = Date.now() - 30 * 86400000;
  var words = {}; bmNames.forEach(function (n) { knhBase_(n).split(/[_\s]+/).forEach(function (w) { if (w.length >= 2) words[w] = 1; }); });
  var g = {};
  paid.filter(function (p) { return p.kind === 'chat' && improve_parseAt_(p.at) >= since && !improve_isTestNoise_(p.q); }).forEach(function (p) {
    var norm = String(p.q || '').replace(/\d+/g, '').replace(/\s+/g, '').slice(0, 18);
    var e = g[norm] || (g[norm] = { pattern: norm, count: 0, sample: String(p.q || '').slice(0, 60) });
    e.count++;
  });
  return Object.keys(g).map(function (k) { return g[k]; }).filter(function (e) {
    if (e.count < 2) return false;
    return !Object.keys(words).some(function (w) { return e.sample.indexOf(w) !== -1; });
  }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
}

// 템플릿은 자기점검과 같은 함수(sysAuditRules_)로 본다 — 그 파일이 서버에 없으면 null
function knhAuditTemplates_(tplAll, bmNames) {
  if (typeof sysAuditRules_ !== 'function' || typeof sysAuditToolNames_ !== 'function') return null;
  var r = sysAuditRules_({
    files: tplAll.map(function (t) { return { name: t.kind + '/' + t.name, role: 'tpl', text: t.text, modified: t.modified, hash: t.md5 }; }),
    toolNames: sysAuditToolNames_(), bmNames: bmNames,
    law: typeof sysAuditLaw_ === 'function' ? sysAuditLaw_ : null,
    resolvePath: typeof sysAuditPathResolver_ === 'function' ? sysAuditPathResolver_() : null
  });
  var out = {}; (r.files || []).forEach(function (f) { out[f.name] = { problems: (f.problems || []).filter(function (p) { return p.kind !== '중복'; }) }; });
  return out;
}
// 지침은 야간 자기점검 결과를 그대로(같은 밤 앞에서 돈다)
function knhAuditGuides_() {
  if (typeof sysAuditResult_ !== 'function') return null;
  var r = null;
  try { r = sysAuditResult_().result; } catch (e) { r = null; }
  if (!r || !r.rules || !r.rules.files) return null;
  var out = {}; r.rules.files.forEach(function (f) { if (f.role === 'bm') out[f.name] = { problems: f.problems || [] }; });
  return { byName: out, at: r.at };
}

// ---------------------------------------------------------------------------------------------
// 밤 실행
// ---------------------------------------------------------------------------------------------
function knhNightly_(opts) {
  opts = opts || {};
  var started = Date.now(), deadline = started + (opts.budgetMs || 150000);
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var res = { at: knhNow_(), ran: false, warn: [] };
  try {
    if (!knhDir_()) throw new Error('총괄관리자 폴더가 설정되지 않아 판정 결과를 남길 곳이 없습니다(CHIEF_MANAGER_FOLDER_ID).');
    var state = knhReadJson_(KNH_STATE_, {});
    var files = {}, all = [];
    KNH_KINDS_.forEach(function (k) { files[k] = knhListFiles_(k); all = all.concat(files[k]); });
    if (!files.지침.length) res.warn.push('업무관리자 폴더에서 지침을 하나도 읽지 못함');
    var bmNames = files.지침.map(function (f) { return knhBase_(f.name); });
    var cr = knhCaseRows_();
    if (!cr.rows.length) res.warn.push('사건 목록을 읽지 못함 — 업무별 사건 수가 0으로 보임');
    var lawChanges = knhLawChanges_(state);
    var uses = knhUses_();
    var tplStats = null;
    try { var rep = getImprovementReport_().report; tplStats = rep && rep.templates && !rep.templates.error ? rep.templates : null; } catch (e) { }
    var corrections = [];
    try { corrections = corrSummary_(Date.now() - 60 * 86400000); } catch (e) { }
    // 자기점검(같은 함수)
    var audit = {}, auditNote = '';
    var ga = knhAuditGuides_();
    if (ga) { Object.keys(ga.byName).forEach(function (n) { audit['지침/' + n] = ga.byName[n]; }); auditNote = '지침: 시스템 자기점검(' + ga.at + ') 결과'; }
    else res.warn.push('지침 자기점검 결과가 없음(SysAudit.js 없음 또는 아직 안 돔) — 틀린 경로·도구·조문 판정은 빠짐');
    var tplAll = files.보고서.concat(files.의뢰서, files.문단);
    if (Date.now() < deadline) {
      try { var ta = knhAuditTemplates_(tplAll, bmNames); if (ta) { tplAll.forEach(function (t) { audit[t.kind + '/' + t.name] = ta[t.kind + '/' + t.name] || { problems: [] }; }); auditNote += ' · 템플릿: 같은 함수로 오늘 점검'; } else res.warn.push('템플릿 자기점검 함수가 없음 — 템플릿의 틀린 경로·도구·조문 판정은 빠짐'); }
      catch (e) { res.warn.push('템플릿 점검 오류: ' + e.message); }
    }
    // 의뢰서가 실제로 쓰이는 업무
    var reach = {};
    Object.keys(KNH_UPTYPES_).forEach(function (s) { KNH_UPTYPES_[s].forEach(function (up) { var p = knhPickIntake_(s, up, files.의뢰서.map(function (f) { return f.name; })); if (p) reach[p] = (reach[p] ? reach[p] + ', ' : '') + (s === '불복' ? up : s + ' ' + up); }); });
    var confirms = knhLawConfirmMap_((knhReadJson_(KNH_LAW_CONFIRM_, { items: [] }) || {}).items); // [2026.10.22] 개정 확인 결론(절세 아이템과 같은 기록)
    var judged = knhJudge_({ files: all, audit: Object.keys(audit).length ? audit : null, lawChanges: lawChanges, confirms: confirms, uses: uses.uses, useSince: uses.since, today: today, intakeReachable: reach, corrections: corrections, tplStats: tplStats });
    var stBy = {}; judged.forEach(function (j) { stBy[j.kind + '/' + knhBase_(j.name)] = j.status; });
    var withSt = function (k) { return files[k].map(function (f) { return { name: f.name, modified: f.modified, status: stBy[k + '/' + knhBase_(f.name)] }; }); };
    var cov = knhCoverage_({ cases: cr.rows, bm: withSt('지침'), tpl: { 보고서: withSt('보고서'), 의뢰서: withSt('의뢰서') }, today: today });
    var material = { cases: Date.now() < deadline ? knhCaseMaterial_(cr, state, files, deadline) : [], corrections: corrections.slice(0, 10), paidGaps: knhPaidGaps_(bmNames) };
    var prevCases = (knhReadJson_(KNH_RESULT_, {}).material || {}).cases || [];
    var cut = knhAddDays_(today, -60);
    material.cases = material.cases.concat(prevCases.filter(function (c) { return c.완료 >= cut; })).slice(0, 20);
    knhWriteJson_(KNH_STATE_, state);
    var newNeeded = cov.next.map(function (r) { return { 업무: r.업무, 빈칸: r.빈칸, 사건수: r.사건수 }; });
    material.paidGaps.forEach(function (g) { newNeeded.push({ 업무: '반복 질문 "' + g.sample.slice(0, 30) + '…"(' + g.count + '회)', 빈칸: ['맞는 지침 없음'], 사건수: 0 }); });
    var totals = { 파일: judged.length, 현행: 0, '수정 필요': 0, '폐기 후보': 0, 신규필요: newNeeded.length, 급함: 0, 보완만: 0 };
    judged.forEach(function (j) { totals[j.status]++; if (j.priority >= 2 && j.status === '수정 필요') totals.급함++; if (j.priority === 1) totals.보완만++; });
    res = { at: res.at, ran: true, secs: Math.round((Date.now() - started) / 1000), warn: res.warn, auditNote: auditNote, totals: totals,
      files: judged, coverage: cov.rows, newNeeded: newNeeded, material: material, lawChanges: lawChanges.slice(-80), usesSince: uses.since };
  } catch (err) {
    res.ran = false; res.reason = String(err && err.message || err);
  }
  knhWriteJson_(KNH_RESULT_, res);
  try { PropertiesService.getScriptProperties().setProperty('KNH_LAST', JSON.stringify({ at: res.at, ran: res.ran, reason: res.reason || '', totals: res.totals || null })); } catch (e) { }
  return res;
}

// ---------------------------------------------------------------------------------------------
// 제안 — 원장(_제안목록.json) + 드라이브 "_제안함"(AI 도구 propose_new_business_manager가 직접 넣은 것도 함께)
// ---------------------------------------------------------------------------------------------
function knhLedger_() { var l = knhReadJson_(KNH_LEDGER_, { items: [] }); l.items = l.items || []; return l; }
function knhDecisions_() { var d = knhReadJson_(KNH_DECISIONS_, { items: [] }); d.items = d.items || []; return d; }

function knhProposals_() {
  var led = knhLedger_(), pend = [], known = {};
  led.items.forEach(function (x) { if (x.fileId) known[x.fileId] = 1; });
  led.items.filter(function (x) { return x.상태 === '대기'; }).forEach(function (x) { pend.push(x); });
  // 원장에 없는 _제안함 파일(AI 사이드바가 제안한 지침 등)
  KNH_KINDS_.forEach(function (k) {
    var inbox = knhSub_(knhFolder_(k), KNH_INBOX_, false);
    if (!inbox) return;
    var it = inbox.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      if (!/\.(md|txt)$/i.test(f.getName()) || f.isTrashed() || known[f.getId()]) continue;
      pend.push({ id: 'D-' + f.getId().slice(-10), 종류: k, 작업: knhFindFile_(knhFolder_(k), f.getName()) ? '수정' : '신규', 대상: f.getName(), fileId: f.getId(), 이유: '드라이브 _제안함에 들어 있던 초안(AI 사이드바 제안 등)', at: Utilities.formatDate(f.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), 출처: '드라이브', 상태: '대기' });
    }
  });
  return pend;
}

// 제안 하나 + 지금 원본(차이 보기용)
function knhProposalDetail_(p) {
  var folder = knhFolder_(p.종류), cur = folder ? knhFindFile_(folder, p.대상) : null, prop = null;
  try { prop = p.fileId ? DriveApp.getFileById(p.fileId) : null; } catch (e) { prop = null; }
  var curText = cur ? cur.getBlob().getDataAsString('UTF-8') : '';
  var propText = prop ? knhStripHeader_(prop.getBlob().getDataAsString('UTF-8')) : '';
  return Object.assign({}, p, { curExists: !!cur, curFileId: cur ? cur.getId() : '', curText: curText, curMd5: cur ? knhMd5_(curText) : '', propText: propText,
    baseChanged: !!(p.기준md5 && cur && knhMd5_(curText) !== p.기준md5), propMissing: p.작업 !== '폐기' && !prop });
}
// propose_new_business_manager가 붙이는 안내 주석은 채택 때 뗀다(문단 머리말 <!-- 문단정보 -->는 그대로)
function knhStripHeader_(t) { return String(t || '').replace(/^﻿/, '').replace(/^<!--\s*AI가 [^\n]*?제안한[^\n]*?-->\s*\n*/, ''); }

function knhDecide_(body) {
  var id = String(body && body.id || ''), decision = String(body && body.decision || ''), reason = String(body && body.reason || '').trim().slice(0, 500);
  if (!id || ['adopt', 'reject', 'retire', 'keep'].indexOf(decision) === -1) return { error: '무엇을 할지 알 수 없습니다.' };
  if ((decision === 'reject' || decision === 'keep') && !reason) return { error: '반려·유지 사유를 한 줄 적어 주세요 — 다음 주 루틴이 읽고 같은 제안을 되풀이하지 않습니다.' };
  return withLock_(15000, function () {
    var p = knhProposals_().filter(function (x) { return x.id === id; })[0];
    if (!p) return { error: '그 제안을 찾지 못했습니다(이미 처리했을 수 있음) — 목록을 새로 불러 주세요.' };
    if ((decision === 'retire' || decision === 'keep') !== (p.작업 === '폐기')) return { error: p.작업 === '폐기' ? '폐기 제안은 ✅ 폐기 또는 ✖ 유지로 처리합니다.' : '신규·수정 제안은 ✅ 채택 또는 ✖ 반려로 처리합니다.' };
    var folder = knhFolder_(p.종류);
    if (!folder) return { error: p.종류 + ' 폴더를 찾지 못했습니다.' };
    var cur = knhFindFile_(folder, p.대상), result = '';
    if (decision === 'adopt') {
      var prop = null;
      try { prop = DriveApp.getFileById(p.fileId); } catch (e) { }
      if (!prop) return { error: '제안 파일을 찾지 못했습니다.' };
      var text = knhStripHeader_(prop.getBlob().getDataAsString('UTF-8'));
      if (text.replace(/\s/g, '').length < 50) return { error: '제안 내용이 비어 있습니다.' };
      if (p.종류 === '지침' && !/^#\s+\S/.test(text.replace(/^\s+/, ''))) return { error: '지침 첫 줄이 "# 이 파일이 다루는 것 한 줄"이 아닙니다 — ✏ 작성관리에서 첫 줄을 고친 뒤 채택해 주세요(AI가 지침을 고를 때 첫 줄을 봅니다).' };
      if (cur) {
        var backed = aiSaveBackupPrev_(folder, cur);
        if (!backed) return { error: '이전 판을 「_이전판」에 보관하지 못해 채택을 멈췄습니다.' };
        cur.setContent(text);
        result = '「' + p.대상 + '」을 고쳤습니다(이전 판은 같은 폴더 「_이전판」).';
      } else {
        cur = folder.createFile(Utilities.newBlob(text, /\.md$/i.test(p.대상) ? 'text/markdown' : 'text/plain', p.대상));
        result = '「' + p.대상 + '」을 새로 만들었습니다.';
      }
      if (p.종류 === '지침') { try { PropertiesService.getScriptProperties().setProperty('AUDIT_PENDING', p.대상); } catch (e) { } }
    } else if (decision === 'retire') {
      if (!cur) return { error: '폐기할 「' + p.대상 + '」이 이미 없습니다.' };
      var bin = knhSub_(folder, KNH_RETIRE_, true);
      if (knhFindFile_(bin, p.대상)) cur.setName(knhBase_(p.대상) + '_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd') + (p.대상.match(/\.(md|txt)$/i) || ['.md'])[0]);
      cur.moveTo(bin);
      result = '「' + p.대상 + '」을 같은 폴더 「_폐기」로 옮겼습니다(지우지 않음 — 되살리려면 드라이브에서 다시 옮기면 됩니다).';
    } else result = decision === 'reject' ? '반려했습니다 — 사유는 다음 주 루틴이 읽습니다.' : '유지하기로 했습니다 — 사유는 다음 주 루틴이 읽습니다.';
    if (decision === 'adopt' || decision === 'retire') knhIdxTouch_(folder); // [2026.10.21] 그 폴더 목록 색인도 바로 맞춘다
    // 처리한 제안 파일은 _제안함/_처리됨으로(지우지 않음)
    if (p.fileId) { try { var pf = DriveApp.getFileById(p.fileId); pf.moveTo(knhSub_(knhSub_(folder, KNH_INBOX_, true), KNH_DONE_, true)); } catch (e) { } }
    var at = knhNow_();
    var led = knhLedger_(), found = false;
    led.items.forEach(function (x) { if (x.id === p.id) { x.상태 = { adopt: '채택', reject: '반려', retire: '폐기', keep: '유지' }[decision]; x.결정일 = at; x.사유 = reason; found = true; } });
    if (!found) led.items.push(Object.assign({}, p, { 상태: { adopt: '채택', reject: '반려', retire: '폐기', keep: '유지' }[decision], 결정일: at, 사유: reason }));
    knhWriteJson_(KNH_LEDGER_, led);
    var dec = knhDecisions_();
    dec.items.push({ id: p.id, 종류: p.종류, 작업: p.작업, 대상: p.대상, 결정: { adopt: '채택', reject: '반려', retire: '폐기', keep: '유지' }[decision], 사유: reason, at: at, 고쳐서채택: !!(body && body.edited) });
    if (dec.items.length > 500) dec.items = dec.items.slice(-500);
    knhWriteJson_(KNH_DECISIONS_, dec);
    return { success: true, message: result };
  });
}

// 📥 반영 때(gh_deployApply_) — 저장소 gs-backend/knowhow/_index.txt의 새 제안을 드라이브 각 폴더 "_제안함"에 넣는다. 원장에 있는 id는 다시 넣지 않는다.
function knhSyncFromGithub_(sha) {
  var out = { 넣음: [], 건너뜀: 0, 오류: [] };
  var idx = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + GH_REPO_ + '/' + sha + '/gs-backend/knowhow/_index.txt', { muteHttpExceptions: true });
  if (idx.getResponseCode() !== 200) return { skipped: '제안 목록(knowhow/_index.txt)이 없음' };
  var parsed = knhParseIndex_(idx.getContentText('UTF-8'));
  out.오류 = parsed.errors.slice(0, 10);
  var led = knhLedger_(), have = {};
  led.items.forEach(function (x) { have[x.id] = 1; });
  var todo = parsed.entries.filter(function (e) { if (have[e.id]) { out.건너뜀++; return false; } return true; });
  var reqs = todo.filter(function (e) { return e.파일; }).map(function (e) { return { url: 'https://raw.githubusercontent.com/' + GH_REPO_ + '/' + sha + '/gs-backend/knowhow/' + e.파일.split('/').map(encodeURIComponent).join('/'), muteHttpExceptions: true }; });
  var resps = reqs.length ? UrlFetchApp.fetchAll(reqs) : [], ri = 0;
  var at = knhNow_();
  todo.forEach(function (e) {
    var text = null;
    if (e.파일) { var r = resps[ri++]; if (r.getResponseCode() !== 200) { out.오류.push(e.id + ': 제안 파일을 받지 못함(' + e.파일 + ')'); return; } text = r.getContentText('UTF-8'); }
    var folder = knhFolder_(e.종류);
    if (!folder) { out.오류.push(e.id + ': ' + e.종류 + ' 폴더 없음'); return; }
    var fileId = '';
    if (text !== null) {
      var inbox = knhSub_(folder, KNH_INBOX_, true), old = knhFindFile_(inbox, e.대상);
      if (old) { old.setContent(text); fileId = old.getId(); }
      else fileId = inbox.createFile(Utilities.newBlob(text, 'text/markdown', e.대상)).getId();
    }
    led.items.push({ id: e.id, 종류: e.종류, 작업: e.작업, 대상: e.대상, 이유: e.이유, 기준md5: e.기준md5, fileId: fileId, at: at, sha: String(sha).slice(0, 7), 출처: '주간 루틴', 상태: '대기' });
    out.넣음.push(e.id + ' ' + e.작업 + ' ' + e.대상);
  });
  if (out.넣음.length) knhWriteJson_(KNH_LEDGER_, led);
  return out;
}

// ---------------------------------------------------------------------------------------------
// 개선 후보 보고서(주간 루틴이 읽음) — Code.js buildImprovementReport_가 부른다
// ---------------------------------------------------------------------------------------------
function knhForReport_() {
  var r = knhReadJson_(KNH_RESULT_, null);
  if (!r) return null;
  var head = [], pend = [];
  try { pend = knhProposals_(); } catch (e) { }
  var t = r.totals || {};
  if (!r.ran) head.push('📚 지침·템플릿 정비 판정 안 됨 — ' + (r.reason || '이유 모름'));
  else head.push('📚 지침·템플릿 정비 — 수정 필요 ' + (t['수정 필요'] || 0) + '(급함 ' + (t.급함 || 0) + ', [확인 필요]만 ' + (t.보완만 || 0) + ') · 폐기 후보 ' + (t['폐기 후보'] || 0) + ' · 빈칸(신규 필요) ' + (t.신규필요 || 0) + (pend.length ? ' · 세무사님 승인 대기 ' + pend.length : '') + ' — 주간 루틴이 초안 PR');
  var cutoff = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
  var decisions = knhDecisions_().items.filter(function (d) { return String(d.at) >= cutoff; });
  var led = knhLedger_().items.map(function (x) { return { id: x.id, 종류: x.종류, 작업: x.작업, 대상: x.대상, 상태: x.상태 }; });
  // 고칠 파일의 지금 원문(초안은 반드시 이 원문에서 출발) — 상한 12개·각 12,000자
  var need = (r.files || []).filter(function (f) { return f.status !== '현행'; }).slice(0, 40);
  var texts = {};
  need.slice(0, 12).forEach(function (f) { try { var fo = knhFolder_(f.kind), x = fo && knhFindFile_(fo, f.name); if (x) texts[f.kind + '/' + f.name] = x.getBlob().getDataAsString('UTF-8').slice(0, 12000); } catch (e) { } });
  var data = { at: r.at, ran: r.ran, reason: r.reason || '', warn: r.warn || [], auditNote: r.auditNote || '', totals: t,
    판정: (r.files || []).map(function (f) { return { 종류: f.kind, 파일: f.name, 상태: f.status, 급함: f.priority, 이유: f.reasons, 표시: f.tags, 쓰임: f.uses, 고친날: f.modified, md5: f.md5 }; }),
    지금원문: texts, 신규필요: r.newNeeded || [], 현황: (r.coverage || []).map(function (c) { return { 업무: c.업무, 사건수: c.사건수, 지침: c.지침, 의뢰서: c.의뢰서, 보고서: c.보고서, 빈칸: c.빈칸 }; }),
    재료: r.material || {}, 법령개정: r.lawChanges || [], 제안원장: led, 승인대기: pend.map(function (p) { return { id: p.id, 종류: p.종류, 작업: p.작업, 대상: p.대상 }; }), 최근결정: decisions };
  // [2026.10.21] 절세 아이템 현행화 필요(밤 판정) — 고치는 일은 세무사님·세션(드라이브 절세 폴더). 루틴은 목록을 보고 보고서에 올린다.
  var tc = knhReadJson_(KNH_TAX_CURRENCY_, null);
  if (tc) { data.절세현행화 = tc; if (tc.현행화필요) head.push('💡 절세 아이템 현행화 필요 ' + tc.현행화필요 + '건(전체 ' + tc.전체 + ', 시간에 따라 바뀌는 내용 있음 ' + tc.시간민감 + ') — 절세플랜 📚 ⚠ 거르기에서 보기'); }
  // [2026.10.22] 표시 분류 오류 후보(확인조치사항 판단 대기인데 아이템·지침에 같은 쟁점 [확인 필요]가 남음) — 루틴은 고치지 않고 보고서에 올린다
  var cl = knhReadJson_(KNH_CLS_FILE_, null);
  if (cl) {
    data.분류오류 = { at: cl.at, ran: cl.ran, reason: cl.reason || '', 후보: (cl.후보 || []).map(function (c) { return { 항목: c.항목, 파일: c.파일, 줄: c.줄들.map(function (x) { return x.줄; }), 찾은방법: c.찾은방법 }; }), 파일안적은항목: cl.파일안적은항목 || 0 };
    if (!cl.ran) head.push('🔀 표시 분류 검사 안 됨 — ' + (cl.reason || '이유 모름'));
    else if ((cl.후보 || []).length) head.push('🔀 표시 분류 오류 후보 ' + cl.후보.length + '곳(줄 ' + cl.후보줄 + ') — 확인조치사항 판단 대기인데 아이템·지침에 같은 쟁점 [확인 필요]가 남음, 🧭 시스템 관리 노하우에서 보기(고치지 않음)');
  }
  var guide = 'knowhow(📚 지침·템플릿 정비 — 세무사님 "노하우의 최종 결정체… 수정할 것은 수정하고 폐기할 것은 폐기하고 새로 만들 것은 만들어야"): 매주 한다. '
    + '① 판정의 수정 필요 — 급함(3=틀린 경로·도구·조문(시스템 자기점검)·법령 개정 반영, 2=세무사님이 반복해서 고친 곳·내용 없음, 1=[확인 필요]만) 높은 것부터 → 지금원문[종류/파일]에서 출발한 수정본([확인 필요]는 현행 원문으로 확인된 것만 채움). '
    + '② 신규필요(현황의 빈칸, 맞는 지침 없는 반복 질문)와 재료.cases(완료 사건의 판단 발췌·크게 고친 보고서 — 이미 가려져 있지만 더 일반화)로 새 지침·템플릿 초안. '
    + '③ 폐기 후보 → 폐기 제안(이유 한 줄). 결과물은 바로 쓰이지 않는다: gs-backend/knowhow/<종류>/<파일이름>에 초안을 두고 gs-backend/knowhow/_index.txt에 한 줄 '
    + '(탭 구분: id(K-YYYYMMDD-n) 종류(지침|보고서|의뢰서|문단) 작업(신규|수정|폐기) 대상파일이름 제안파일(knowhow/ 아래 경로, 폐기면 -) 기준MD5(수정·폐기=판정의 md5, 신규=-) 이유)을 더하는 PR. '
    + '📥 반영 때 job이 드라이브 "_제안함"에 넣고, 세무사님이 🧭 시스템 관리 📚 제안 대기에서 채택·반려한다. 이미 원장(제안원장)에 있는 id·대상은 다시 올리지 않는다. '
    + '최근결정의 반려·유지 사유를 먼저 읽고 같은 제안을 되풀이하지 말 것(사유를 고친 새 제안은 가능). 기존 templates 흐름(공통추가제목·늘빈칸 통계로 gs-backend/templates 고침)은 그대로 두되, 같은 파일을 두 흐름에서 동시에 고치지 않는다. '
    + '지침 형식: 첫 줄 "# 제목 — 다루는 것 한 줄(80자 이내)", "> 상태: 초안(세무사님 검토 전) · 작성 날짜 · 근거 법령판", 1 언제 쓰는가 / 2 판단 순서 / 3 필요한 사실·서류→계산기 칸 / 4 계산기·조회 도구(코드에 있는 이름만) / 5 자주 틀리는 곳 / 6 고객에게 물을 것 / 7 근거 조문("법률명 §조번호") / 8 최신 확인 필요. '
    + '조문·세율·기한은 현행 원문으로 확인한 것만 쓰고 모르면 [확인 필요: 무엇]. 지방세는 범위 밖. 고객 이름·주소·금액·사건 고유 사실은 절대 넣지 말고 일반화(저장소 공개). 고객 자료를 무료 외부 AI로 보내지 않는다. 한 주에 제안은 10건 이내, 질 우선.';
  guide += ' 분류오류(🔀): 같은 쟁점이 확인조치사항 판단 대기와 아이템·지침 [확인 필요]에 함께 있는 후보다(낱말 맞춤이라 헛잡힘이 있을 수 있음) — 고치지 말고 보고서에 그대로 올린다. 판정·표시 바꾸기는 세무사님·세션이 한다(작성기준 "표시는 한 쟁점에 하나뿐").';
  return { head: head, data: data, guide: guide, count: (t['수정 필요'] || 0) + (t['폐기 후보'] || 0) + (t.신규필요 || 0) + ((cl && cl.후보 || []).length) ? 1 : 0 };
}

// ---------------------------------------------------------------------------------------------
// 화면(manage/knowhow.html) 입구 — Code.js 한 줄: action이 knh_로 시작하면 여기로
// ---------------------------------------------------------------------------------------------
function knhDispatch_(body) {
  var a = body && body.action;
  try {
    if (a === 'knh_summary') {
      var last = null;
      try { last = JSON.parse(PropertiesService.getScriptProperties().getProperty('KNH_LAST') || 'null'); } catch (e) { }
      return { success: true, last: last, pending: knhProposals_().length };
    }
    if (a === 'knh_status') {
      var r = knhReadJson_(KNH_RESULT_, null);
      if (r) delete r.material; // 화면엔 재료(사건 발췌)를 싣지 않는다
      return { success: true, result: r, pending: knhProposals_().map(function (p) { return { id: p.id, 종류: p.종류, 작업: p.작업, 대상: p.대상, 이유: p.이유, at: p.at, 출처: p.출처 }; }),
        decisions: knhDecisions_().items.slice(-20).reverse(), 개정: knhLawReview_(r), 분류: knhReadJson_(KNH_CLS_FILE_, null) };
    }
    if (a === 'knh_cls_run') return { success: true, result: knhClsNightly_({ budgetMs: 45000 }) };
    if (a === 'knh_law_confirm') return knhLawConfirm_(body);
    if (a === 'knh_proposal') {
      var p = knhProposals_().filter(function (x) { return x.id === body.id; })[0];
      if (!p) return { error: '그 제안을 찾지 못했습니다(이미 처리했을 수 있음).' };
      return { success: true, proposal: knhProposalDetail_(p) };
    }
    if (a === 'knh_decide') return knhDecide_(body);
    if (a === 'knh_run') return { success: true, result: knhNightly_({ trigger: '화면' }) };
    if (a === 'knh_index') return knhIdxForScreen_(body);
    return { error: '모르는 동작: ' + a };
  } catch (e) { return { error: String(e && e.message || e) }; }
}

// =============================================================================================
// [2026.10.21] 노하우 파일 공용 장치 두 가지 — 세무사님 "둘 다 공용방식으로 진행하라"(받아 오신 원칙 1·3):
//  "1. 사건에는 템플릿 버전을 남길 것. 나중에 템플릿을 개선해도 과거 사건 보고서가 바뀌면 안 됩니다."
//  "3. 목록은 캐시, 본문은 필요할 때만. 색인은 화면에 캐시해 두고 즉시 보여주고, 본문은 클릭할 때 불러옵니다."
//  (원칙 2 "시트는 색인만, 본문은 파일로"는 이미 지켜짐 — 노하우 본문은 드라이브 .md 파일)
// 대상: 의뢰서템플릿·보고서템플릿·문단·절세 아이템 등 "계속하여 노하우로서 축적할 데이타". 새 노하우 폴더는 knhIdxRoots_에 한 줄 더하면 같은 장치를 쓴다.
// =============================================================================================

// ---- 가. 목록 색인(_색인.json) — 폴더마다 제목·종류·한 줄 요약·수정일·파일ID만(본문 없음) ----
var KNH_IDX_FILE_ = '_색인.json';
// 순수 함수(드라이브 모름) — 화면(taxplan.html title_·meta_·gist_)과 같은 규칙
function knhIdxIsItem_(name) { name = String(name || ''); return /\.(md|txt)$/i.test(name) && name.charAt(0) !== '_'; }
function knhIdxTitle_(name) { return String(name || '').replace(/\.(md|txt)$/i, '').replace(/^\d+[\s._-]+/, ''); }
// 머리 줄(> 로 시작하는 맨 앞 인용) 중 "종류:" "한 줄 요약:" 같은 칸
function knhIdxMeta_(src) {
  var m = {}, lines = String(src || '').split(/\r?\n/);
  for (var i = 0; i < Math.min(lines.length, 14); i++) {
    var L = lines[i];
    if (!/^\s*>/.test(L)) continue;
    L.replace(/^\s*>\s*/, '').split(/\s+·\s+/).forEach(function (part) {
      var k = part.match(/^\s*([^:：]{1,12})\s*[:：]\s*(.+)$/);
      if (k) m[k[1].trim()] = k[2].trim();
    });
  }
  return m;
}
// 한 줄 요약 — "## 핵심" 아래 첫 "- " 줄(굵게·괄호 조문은 빼고 짧게)
function knhIdxGist_(src) {
  var m = String(src || '').match(/##\s*핵심[^\n]*\n+\s*-\s*([^\n]+)/);
  if (!m) return '';
  var t = m[1].replace(/\*\*/g, '').replace(/\([^)]*§[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 90 ? t.slice(0, 88) + '…' : t;
}
// [2026.10.21 v2] 색인 항목에 근거·검토 상태·기준일·시간에 따라 바뀌는 내용(변동)·본문 날짜·인용 조문·[확인 필요]/해석 엇갈림 수를 더한다
//  (세무사님 "넥스가 절세 아이템을 근거로 답하게 하기를 진행하되, 안전장치를 마련해야 한다" — 인용 근거 부기·정기 현행화의 재료).
//  예전(v1) 항목은 그대로 읽히고, 다음 맞추기 때 v2로 다시 만든다(knhIdxCompare_).
var KNH_IDX_V_ = 3; // [2026.10.22] v3 — 언급(글에 적힌 모든 날짜) 칸, 머리 줄 날짜는 지남 판정에서 뺌
function knhIdxEntry_(f) {
  var src = String(f.text || '').replace(/^﻿/, ''), m = knhIdxMeta_(src);
  var e = { v: KNH_IDX_V_, id: f.id, 파일: f.name, 제목: knhIdxTitle_(f.name), 종류: m['종류'] || '', 요약: knhIdxGist_(src), 수정일: f.modified };
  var x = knhItemFacts_(src, f.modified);
  Object.keys(x).forEach(function (k) { e[k] = x[k]; });
  return e;
}
// 화면·넥스 도구에 넘기는 색인 한 줄(파일ID·이름·수정일은 바깥에 따로)
function knhIdxBrief_(e) {
  if (!e) return null;
  return { 제목: e.제목, 종류: e.종류, 요약: e.요약, 근거: e.근거 || '', 검토: e.검토 || '', 기준일: e.기준일 || '', 변동: e.변동 || [], 날짜: e.날짜 || [], 언급: e.언급 || [],
    조문: e.조문 || [], 확인필요: e.확인필요 || 0, 엇갈림: e.엇갈림 || 0 };
}

// ---- 절세 아이템 안전장치 재료(순수 함수) ----
// 날짜 꼴: 2026.5.10. / 2026-05-10 / 2026. 5. 10. / 2026년 5월 10일 → '2026-05-10'
function knhItemDates_(text) {
  var out = {}, re = /(20\d\d)\s*[.\-년]\s*(\d{1,2})\s*[.\-월]\s*(\d{1,2})(?!\d)/g, m;
  while ((m = re.exec(String(text || '')))) {
    var mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    out[m[1] + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d] = 1;
  }
  return Object.keys(out).sort();
}
// 아이템 근거 줄의 조문 → '소득세법시행령|167의3' 같은 키(법령 개정 감시 knhLawChanges_와 같은 꼴).
// 아이템은 "소득세법 §104⑦, §95②, 시행령 §167의3①"처럼 법 이름을 한 번만 쓰므로 앞 법 이름을 이어 받는다.
var KNH_LAW_ABBR_ = { '소득세법': '소득세법', '소득법': '소득세법', '소법': '소득세법', '상속세및증여세법': '상속세및증여세법', '상증법': '상속세및증여세법', '상증세법': '상속세및증여세법',
  '조세특례제한법': '조세특례제한법', '조특법': '조세특례제한법', '국세기본법': '국세기본법', '국기법': '국세기본법' };
function knhItemCites_(text) {
  var keys = {}, law = '', sub = '';
  var re = /(소득세법|소득법|소법|상속세\s*및\s*증여세법|상증세법|상증법|조세특례제한법|조특법|국세기본법|국기법)?\s*(시행령|시행규칙)?\s*(?:§\s*|제\s*)(\d+)(?:\s*조)?(?:\s*의\s*(\d+)(?!\s*[0-9년개월일세억만원배%명호]))?/g, m;
  String(text || '').split('\n').forEach(function (line) { // 법 이름은 다음 줄로도 이어 받는다(근거 원문 절의 "- 시행령 §…" 줄)
    re.lastIndex = 0;
    while ((m = re.exec(line))) {
      if (m[0].indexOf('§') === -1 && !/제\s*\d+\s*조/.test(m[0])) continue; // "제3" 같은 낱말은 조문이 아님
      if (/부칙\s*$/.test(line.slice(Math.max(0, m.index - 6), m.index + (m[0].length - m[0].replace(/^[^§제]*/, '').length)))) continue; // "부칙 §2"는 본법·시행령 조문이 아님
      if (m[1]) { law = KNH_LAW_ABBR_[m[1].replace(/\s/g, '')] || ''; sub = ''; }
      if (m[2]) sub = m[2]; else if (m[1]) sub = '';
      if (!law) continue;
      keys[law + sub + '|' + m[3] + (m[4] ? '의' + m[4] : '')] = 1;
    }
  });
  return Object.keys(keys);
}
// 시간에 따라 바뀌는 내용의 종류
function knhItemVolatile_(text, dates, base) {
  var t = String(text || ''), out = [];
  if (/개편안|확정\s*전|입법\s*예고|정부안/.test(t)) out.push('개편안');
  if (/유예|한시|일몰|종료/.test(t)) out.push('유예·종료');
  if ((dates || []).some(function (d) { return d > base; })) out.push('기한·시행일');
  if (/세율|공제액|공제\s*한도|한도액|\d+\s*%/.test(t)) out.push('세율·공제액');
  return out;
}
// [2026.10.22] 현행화 재료(지침·의뢰서·보고서 템플릿·문단·절세 아이템 공용) — 세무사님 "2번 작업을 하자"
//  기준일 = 머리 줄 "기준일:" > "작성:"의 날짜 > 파일 수정일.
//  날짜(지남 판정용) = 본문 날짜 중 기준일 뒤의 것. 머리의 ">" 줄(작성일·"개정 확인" 기록 등)은 뺀다 — 확인 기록 날짜가 "본문 날짜 지남"으로 다시 잡힌 일(10-22) 때문.
//  언급 = 머리 줄까지 포함해 글에 적힌 모든 날짜(개정 시행일을 적어 두면 "반영함"으로 본다 — 예: "> 개정 확인: … 2027. 9. 9. 시행 … 내용은 바뀌지 않음").
//  cites: 인용 조문 키 목록(지침·템플릿은 본문 전체에서 knhCitationKeys_로, 절세 아이템은 근거 줄·근거 원문 절에서 knhItemCites_로).
function knhDocFacts_(src, modified, cites) {
  src = String(src || '').replace(/^﻿/, '');
  var m = knhIdxMeta_(src);
  var lines = src.split(/\r?\n/), head = [], body = [];
  lines.forEach(function (l, i) { (i < 14 && /^\s*>/.test(l) ? head : body).push(l); });
  // 작성일: "작성:" 칸, 없으면 머리 줄의 첫 yyyy-MM-dd(지침 "> 상태: 초안(…) · 2026-10-20 · …")
  var made = String(m['작성'] || '').match(/(20\d\d)-(\d{2})-(\d{2})/) || head.join('\n').match(/(20\d\d)-(\d{2})-(\d{2})/);
  var own = String(m['기준일'] || '').match(/(20\d\d)\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/);
  var mod = String(modified || '').match(/(20\d\d)\D(\d{2})\D(\d{2})/);
  var base = own ? own[1] + '-' + ('0' + own[2]).slice(-2) + '-' + ('0' + own[3]).slice(-2) : made ? made[1] + '-' + made[2] + '-' + made[3] : mod ? mod[1] + '-' + mod[2] + '-' + mod[3] : '';
  var bodyDates = knhItemDates_(body.join('\n'));
  return {
    기준일: base,
    변동: knhItemVolatile_(body.join('\n'), bodyDates, base),
    날짜: bodyDates.filter(function (d) { return d > base; }).slice(0, 12),
    언급: knhItemDates_(src).slice(-40),
    조문: (cites || []).slice(0, 40)
  };
}
function knhItemFacts_(src, modified) {
  src = String(src || '').replace(/^﻿/, '');
  var m = knhIdxMeta_(src);
  var sec = src.match(/##\s*근거 원문[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  var f = knhDocFacts_(src, modified, knhItemCites_((m['근거'] || '') + '\n' + (sec ? sec[1] : '')));
  f.근거 = String(m['근거'] || '').slice(0, 300);
  f.검토 = m['검토 상태'] || '';
  f.확인필요 = (src.match(/\[확인 필요/g) || []).length;
  f.엇갈림 = (src.match(/반대\s*취지|해석(이)?\s*엇갈|해석이\s*갈/g) || []).length;
  return f;
}
function knhLawLabel_(c) { return c.법령 + ' §' + c.jo + '(' + c.시행일 + (c.구분 === '시행예정' ? ' 시행 예정' : ' 시행') + (c.확인 === '있음' ? ' · 확인: 실질 변경 있음' : '') + ')'; }
// 개정 확인 결론 — 총괄관리자\_지침정비\_개정확인.json { items:[{ key, jo, 시행일, 법령, 결론:'없음'|'있음', 메모, at }] }.
//  개정 하나를 한 번만 확인하면 그 조문을 인용한 모든 지침·템플릿·절세 아이템 판정이 같이 쓴다(같은 개정을 파일마다 다시 확인하지 않게).
//  "없음"(타법개정으로 법률 이름만 바뀜 등 실질 변경 없음) → 현행화 이유에서 뺀다. "있음" → 반영할 때까지 남기고 "확인: 실질 변경 있음"을 붙인다.
var KNH_LAW_CONFIRM_ = '_개정확인.json';
function knhLawConfirmKey_(c) { return String(c.key || '') + '|' + String(c.jo || '') + '|' + String(c.시행일 || ''); }
function knhLawConfirmMap_(list) { var o = {}; (list || []).forEach(function (x) { o[knhLawConfirmKey_(x)] = x; }); return o; }
// 화면(🧭 📚)용 — 확인할 개정 목록: 지금 판정에서 걸린 지침·템플릿 수, 절세 아이템 수, 확인 결론. 걸린 것도 확인한 것도 없는 개정은 싣지 않는다.
function knhLawReview_(r) {
  var lc = [], cf = {}, tax = null;
  try { lc = (knhReadJson_(KNH_STATE_, {}) || {}).lawChanges || []; } catch (e) { }
  try { cf = knhLawConfirmMap_((knhReadJson_(KNH_LAW_CONFIRM_, { items: [] }) || {}).items); } catch (e) { }
  try { tax = knhReadJson_(KNH_TAX_CURRENCY_, null); } catch (e) { }
  return lc.map(function (c) {
    var tag = c.법령 + ' §' + c.jo, docs = [], items = 0;
    ((r && r.files) || []).forEach(function (f) { (f.reasons || []).forEach(function (x) { if (/^법령 개정/.test(x.why) && (x.detail || []).indexOf(tag) !== -1) docs.push(f.kind + ' · ' + knhBase_(f.name)); }); });
    ((tax && tax.목록) || []).forEach(function (t) { if ((t.이유 || []).some(function (s) { return s.indexOf(tag + '(' + c.시행일) !== -1; })) items++; });
    var x = cf[knhLawConfirmKey_(c)] || null;
    return { key: c.key, jo: c.jo, 법령: c.법령, 시행일: c.시행일, 구분: c.구분, 제목: c.제목 || '', 감지일: c.감지일, 문서: docs, 절세: items, 확인: x ? { 결론: x.결론, 메모: x.메모 || '', at: x.at } : null };
  }).filter(function (v) { return v.문서.length || v.절세 || v.확인; });
}
// 개정 확인 결론 기록(사람이 원문을 대조한 뒤 🧭 📚·절세 아이템 칸에서 누름) — 결론 '없음'|'있음', ''이면 기록을 지운다
function knhLawConfirm_(body) {
  var c = { key: String(body && body.key || ''), jo: String(body && body.jo || ''), 시행일: String(body && body.시행일 || '') };
  var 결론 = String(body && body.결론 || ''), 메모 = String(body && body.메모 || '').trim().slice(0, 300);
  if (!c.key || !c.jo || !c.시행일 || ['없음', '있음', ''].indexOf(결론) === -1) return { error: '어느 개정을 어떻게 확인했는지 알 수 없습니다.' };
  var known = ((knhReadJson_(KNH_STATE_, {}) || {}).lawChanges || []).filter(function (x) { return knhLawConfirmKey_(x) === knhLawConfirmKey_(c); })[0];
  if (!known) return { error: '법령 개정 감시 기록에 없는 개정입니다 — 화면을 새로 불러 주세요.' };
  return withLock_(10000, function () {
    var d = knhReadJson_(KNH_LAW_CONFIRM_, { items: [] }) || { items: [] };
    d.items = (d.items || []).filter(function (x) { return knhLawConfirmKey_(x) !== knhLawConfirmKey_(c); });
    if (결론) d.items.push({ key: c.key, jo: c.jo, 시행일: c.시행일, 법령: known.법령, 제목: known.제목 || '', 결론: 결론, 메모: 메모, at: knhNow_() });
    knhWriteJson_(KNH_LAW_CONFIRM_, d);
    return { success: true, message: 결론 ? known.법령 + ' §' + c.jo + '(' + c.시행일 + ') — "실질 변경 ' + 결론 + '"으로 기록했습니다.' + (결론 === '없음' ? ' 이 개정으로 걸린 지침·템플릿·절세 아이템의 표시가 풀립니다(지침·템플릿은 🔄 다시 판정 뒤).' : ' 반영할 때까지 표시가 남습니다.') : '확인 기록을 지웠습니다.' };
  });
}
// 현행화 필요 판정(공용) — f: knhDocFacts_ 결과(또는 같은 칸을 가진 색인 한 줄), lawChanges: 법령 개정 감시 누적(knhLawChanges_),
//  today 'yyyy-MM-dd', confirms: knhLawConfirmMap_ 결과(없어도 됨)
//  ① 인용 조문 개정 — 글에 그 시행일이 적혀 있지 않고, 확인 결론이 "없음"이 아니며, 시행 예정은 기준일 당일 이후 감지, 이미 시행은 기준일 뒤 시행·감지
//  ② 본문의 날짜(기한·시행일·유예 끝)가 오늘 지남 ③ 개편안 내용인데 기준일에서 60일 넘음 ④ 시간에 따라 바뀌는 내용이 있는데 기준일에서 1년 넘음
function knhCurrency_(f, lawChanges, today, confirms) {
  var out = { 필요: false, 이유: [], 법령: [] };
  if (!f || !f.기준일) return out;
  var cites = {}; (f.조문 || []).forEach(function (k) { cites[k] = 1; });
  var said = {}; (f.언급 || []).concat(f.날짜 || []).forEach(function (d) { said[d] = 1; });
  (lawChanges || []).forEach(function (c) {
    if (!cites[c.key + '|' + c.jo] || said[c.시행일]) return;
    var cf = confirms && confirms[knhLawConfirmKey_(c)];
    if (cf && cf.결론 === '없음') return;
    var hit = c.구분 === '시행예정' ? String(c.감지일 || '') >= f.기준일 : (String(c.시행일 || '') > f.기준일 || String(c.감지일 || '') > f.기준일);
    if (hit) out.법령.push({ key: c.key, jo: c.jo, 법령: c.법령, 시행일: c.시행일, 구분: c.구분, 제목: c.제목 || '', 확인: cf ? cf.결론 : '' });
  });
  if (out.법령.length) out.이유.push('인용 조문 개정 — ' + out.법령.slice(0, 3).map(knhLawLabel_).join(', ') + (out.법령.length > 3 ? ' 외 ' + (out.법령.length - 3) + '개' : ''));
  var passed = (f.날짜 || []).filter(function (d) { return d <= today; });
  if (passed.length) out.이유.push('본문의 날짜(기한·시행일·유예 끝)가 지남 — ' + passed.slice(0, 3).join(', ') + ' (기준일 ' + f.기준일 + ')');
  var age = knhDaysBetween_(f.기준일, today);
  if ((f.변동 || []).indexOf('개편안') !== -1 && age > 60) out.이유.push('개편안 내용 — 기준일에서 ' + age + '일 지남(국회 통과·수정 여부 확인)');
  if ((f.변동 || []).length && age > 365) out.이유.push('기준일에서 1년 넘음(' + age + '일) — 세율·공제액·기한 확인');
  out.필요 = out.이유.length > 0;
  return out;
}
// 색인과 실제 파일 목록 맞대기 — 같은 ID·같은 이름·같은 수정일이면 그대로 쓰고, 나머지는 다시 읽을 것(stale), 없어진 파일 수(removed)
// [2026.10.21] 예전 꼴(v1) 항목도 다시 읽을 것으로 본다(근거·기준일 칸 채우기)
function knhIdxCompare_(items, listing) {
  var by = {}, keep = {}, stale = [], removed = 0, seen = {};
  (items || []).forEach(function (e) { if (e && e.id) by[e.id] = e; });
  (listing || []).forEach(function (f) {
    seen[f.id] = 1;
    var e = by[f.id];
    if (e && e.수정일 === f.modified && e.파일 === f.name && (e.v || 1) >= KNH_IDX_V_) keep[f.id] = e; else stale.push(f);
  });
  Object.keys(by).forEach(function (id) { if (!seen[id]) removed++; });
  return { keep: keep, stale: stale, removed: removed };
}

// GAS — 폴더 하나 맞추기. 바뀐 파일만 다시 읽고(deadline까지), 달라진 게 있으면 _색인.json을 고쳐 쓴다.
function knhIdxMod_(d) { return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy.MM.dd HH:mm:ss'); } // listFolder modifiedDate와 같은 꼴
function knhIdxListing_(folder) {
  var out = [], it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next(), n = f.getName();
    if (!knhIdxIsItem_(n) || f.isTrashed()) continue;
    out.push({ id: f.getId(), name: n, modified: knhIdxMod_(f.getLastUpdated()), file: f });
  }
  out.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko', { numeric: true }); });
  return out;
}
function knhIdxReadFile_(folder) {
  var f = knhFindFile_(folder, KNH_IDX_FILE_);
  if (!f) return null;
  try { var j = JSON.parse(f.getBlob().getDataAsString('UTF-8') || 'null'); return j && Array.isArray(j.items) ? j : null; } catch (e) { return null; }
}
function knhIdxSync_(folder, deadline) {
  var listing = knhIdxListing_(folder), idx = knhIdxReadFile_(folder);
  var cmp = knhIdxCompare_(idx ? idx.items : [], listing);
  var items = [], files = [], read = 0, stale = 0;
  listing.forEach(function (f) {
    var e = cmp.keep[f.id] || null;
    if (!e && Date.now() < deadline) {
      try { e = knhIdxEntry_({ id: f.id, name: f.name, modified: f.modified, text: f.file.getBlob().getDataAsString('UTF-8') }); read++; } catch (er) { e = null; }
    }
    if (e) items.push(e); else stale++;
    files.push({ id: f.id, name: f.name, modifiedDate: f.modified, 색인: knhIdxBrief_(e) });
  });
  var wrote = false;
  if (read || cmp.removed || (!idx && listing.length)) {
    try { writeFileOverwrite_(folder, KNH_IDX_FILE_, JSON.stringify({ v: 1, at: knhNow_(), 폴더: folder.getName(), items: items }), 'application/json'); wrote = true; }
    catch (e) { console.log('노하우 색인 쓰기 실패(' + folder.getName() + '): ' + e.message); }
  }
  return { files: files, total: listing.length, read: read, removed: cmp.removed, stale: stale, wrote: wrote };
}

// 노하우 폴더 등록부 — subs: 바로 아래 하위 폴더(_로 시작하는 것 빼고)도 각각 색인
function knhIdxRoots_() {
  var out = [], add = function (key, folder, subs) { if (folder) out.push({ key: key, folder: folder, subs: !!subs }); };
  var bm = null;
  try { bm = getBusinessManagerFolder_(); } catch (e) { }
  add('절세', knhSub_(bm, '절세', false), true);
  // 의뢰서템플릿은 아직 넣지 않는다 — work 화면(document-tools.js)·부가서비스 서버(gs-extra, clasp로만 올림)의 의뢰서 템플릿 목록이
  // 폴더 파일을 거르지 않고 다 보여 줘서 _색인.json이 "템플릿"으로 섞인다. 넣으려면 먼저 Code.js handleListCaseTemplates가
  // _로 시작하는 파일을 빼게 고치고 gs-extra를 다시 만들어(tools/build-light.js) 함께 올린 뒤 여기 add('의뢰서', knhFolder_('의뢰서'), false).
  add('보고서', knhFolder_('보고서'), false);
  add('문단', knhFolder_('문단'), false);
  return out;
}
function knhIdxSubs_(folder) {
  var out = [], it = folder.getFolders();
  while (it.hasNext()) { var d = it.next(); if (d.getName().charAt(0) !== '_' && !d.isTrashed()) out.push(d); }
  return out;
}

// 화면 입구 knh_index {key:'절세'} — 목록 + 색인(본문 없음). 색인이 낡은 파일은 몇 초 안에서만 고쳐 읽고, 나머지는 색인:null로 돌려
// 화면이 예전 방식(본문 읽어 요약 뽑기)으로 물러서 채운다(기능이 소리 없이 빠지지 않게). 밤 점검이 나머지를 맞춘다.
function knhIdxForScreen_(body) {
  var key = String(body && body.key || '');
  var root = knhIdxRoots_().filter(function (r) { return r.key === key; })[0];
  if (!root) return { error: '「' + key + '」 노하우 폴더를 찾지 못했습니다.' };
  var g = knhIdxGather_(root, Date.now() + 8000);
  // [2026.10.21] 절세 아이템은 줄마다 현행화 필요 판정(인용 조문 개정·날짜 지남·개편안·1년 넘음)을 붙인다 — 화면이 ⚠ 표시·거르기에 쓴다
  if (key === '절세') knhIdxAddCurrency_(g);
  return { success: true, folderId: root.folder.getId(), files: g.files, folders: g.folders, stale: g.stale };
}
function knhIdxGather_(root, deadline) {
  var top = knhIdxSync_(root.folder, deadline), stale = top.stale;
  var folders = root.subs ? knhIdxSubs_(root.folder).map(function (d) {
    try { var s = knhIdxSync_(d, deadline); stale += s.stale; return { id: d.getId(), name: d.getName(), files: s.files }; }
    catch (e) { return { id: d.getId(), name: d.getName(), files: [], error: String(e && e.message || e) }; }
  }) : [];
  return { files: top.files, folders: folders, stale: stale };
}
// 지침·템플릿 한 파일의 현행화 판정을 지금 — Code.js toolLoadBusinessManager(넥스가 지침을 읽을 때)
function knhDocCurrencyNow_(text, lastUpdated) {
  var cx = knhCurrencyCtx_();
  var mod = lastUpdated ? Utilities.formatDate(lastUpdated, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '';
  return knhCurrency_(knhDocFacts_(text, mod, Object.keys(knhCitationKeys_(text))), cx.lc, cx.today, cx.confirms);
}
// 현행화 판정에 드는 것 한 번에 — 법령 개정 감시 누적·개정 확인 결론·오늘
function knhCurrencyCtx_() {
  var c = { today: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), lc: [], confirms: {} };
  try { c.lc = (knhReadJson_(KNH_STATE_, {}) || {}).lawChanges || []; } catch (e) { }
  try { c.confirms = knhLawConfirmMap_((knhReadJson_(KNH_LAW_CONFIRM_, { items: [] }) || {}).items); } catch (e) { }
  return c;
}
function knhIdxAddCurrency_(g) {
  var cx = knhCurrencyCtx_();
  g.files.concat.apply(g.files, g.folders.map(function (d) { return d.files; })).forEach(function (f) {
    if (f.색인) f.색인.현행화 = knhCurrency_(f.색인, cx.lc, cx.today, cx.confirms);
  });
  return g;
}

// ---- 넥스 도구 — 절세 아이템 찾기·읽기(토큰 0, 같은 색인) ----
// 세무사님 원문(2026-10-21): "넥스가 절세 아이템을 근거로 답하게 하기를 진행하되, 안전장치를 마련해야 한다. 하라.
//  1. 인용할때 근거를 부기하도록 하라 2. 절세아이템 중 시간에 따라 변경되는 내용은 정기적으로 업데이트를 해야 한다"
// 대화창·사이드바(Code.js JOB_AI_TOOLS_)와 사건 지휘(AiLeadLive.js)가 같은 두 함수를 부른다(넥스 하나로).
var KNH_ITEM_CITE_RULE_ = '이 아이템을 근거로 답하면: ① 답 끝에 "인용" 줄을 그대로 붙이고, 아이템 문장을 옮길 때는 그 문장에 적힌 근거 조문·해석 번호를 괄호로 함께 옮긴다(아이템에 없는 조문·번호를 지어 붙이지 않는다). '
  + '② 옮긴 부분에 [확인 필요]·반대 취지·해석 엇갈림 표시가 있으면 그 표시를 그대로 옮기고 단정하지 않는다. ③ 검토 상태가 "세무사님 검토 전"이면 답에 그렇게 밝힌다. '
  + '④ 현행화 필요면 그 이유를 먼저 말하고, 세율·기한·시행일은 조문 원문 조회로 확인한 뒤에만 단정한다. ⑤ 아이템은 일반 정리다 — 사건 사실에 대입한 결론은 네 판단임을 구분해 말한다.';
function knhTaxItemsAll_(deadlineMs) {
  var root = knhIdxRoots_().filter(function (r) { return r.key === '절세'; })[0];
  if (!root) return null;
  var g = knhIdxAddCurrency_(knhIdxGather_(root, Date.now() + (deadlineMs || 4000))), out = [];
  g.files.forEach(function (f) { out.push({ f: f, 세목: '공통' }); });
  g.folders.forEach(function (d) { d.files.forEach(function (f) { out.push({ f: f, 세목: d.name }); }); });
  return out;
}
// 찾을 말 → 낱말(조사 떼기). 순수 함수
function knhItemTerms_(q) {
  return String(q || '').toLowerCase().split(/[\s,.;:!?·/()「」"'“”‘’\-]+/).map(function (w) {
    return w.replace(/(으로|에서|에게|하면|하나요|인가요|되나요|나요|까요|은|는|이|가|을|를|에|의|로|와|과|도|만)$/, '');
  }).filter(function (w) { return w.length >= 2; });
}
function knhItemScore_(b, title, terms) {
  var s = 0, T = String(title || '').toLowerCase(), Y = String(b && b.요약 || '').toLowerCase(), G = String(b && b.근거 || '').toLowerCase(), K = String(b && b.종류 || '').toLowerCase();
  terms.forEach(function (t) { if (T.indexOf(t) !== -1) s += 3; if (Y.indexOf(t) !== -1) s += 2; if (G.indexOf(t) !== -1) s += 1; if (K.indexOf(t) !== -1) s += 1; });
  return s;
}
function knhTaxItemsSearch_(input) {
  input = input || {};
  var all = knhTaxItemsAll_(4000);
  if (!all) return { 오류: '절세 아이템 폴더(업무관리자\\절세)를 찾지 못했습니다.' };
  var terms = knhItemTerms_(input.query), want = String(input.세목 || input.semok || '').replace(/소득세|세$/g, '');
  var rows = all.filter(function (x) { return !want || x.세목.indexOf(want) !== -1; }).map(function (x) {
    return { x: x, s: terms.length ? knhItemScore_(x.f.색인, knhIdxTitle_(x.f.name), terms) : 1 };
  }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, Math.min(+input.limit || 8, 15));
  return {
    ok: true, 전체: all.length, 찾음: rows.length,
    아이템: rows.map(function (r) {
      var b = r.x.f.색인 || {};
      return { id: r.x.f.id, 제목: b.제목 || knhIdxTitle_(r.x.f.name), 세목: r.x.세목, 종류: b.종류 || '', 요약: b.요약 || '', 근거: b.근거 || '', 검토: b.검토 || '', 기준일: b.기준일 || '',
        현행화필요: b.현행화 && b.현행화.필요 ? b.현행화.이유 : null, 조심: (b.확인필요 ? '[확인 필요] ' + b.확인필요 + '곳' : '') + (b.엇갈림 ? (b.확인필요 ? ' · ' : '') + '반대 취지·해석 엇갈림 ' + b.엇갈림 + '곳' : '') };
    }),
    안내: rows.length ? '맞는 것만 read_tax_item(id)로 읽어라(보통 1~2개). ' + KNH_ITEM_CITE_RULE_ : '맞는 절세 아이템이 없다 — 아이템을 근거로 답한다고 말하지 마라(다른 낱말로 한 번 더 찾거나, 조문 원문 조회로 답한다).'
  };
}
function knhTaxItemRead_(input) {
  input = input || {};
  var all = knhTaxItemsAll_(3000);
  if (!all) return { 오류: '절세 아이템 폴더(업무관리자\\절세)를 찾지 못했습니다.' };
  var id = String(input.id || ''), name = String(input.제목 || input.title || input.name || '').trim();
  var hit = all.filter(function (x) { return id && x.f.id === id; })[0]
    || all.filter(function (x) { return name && (knhIdxTitle_(x.f.name) === name || x.f.name === name); })[0]
    || all.filter(function (x) { return name && knhIdxTitle_(x.f.name).indexOf(name) !== -1; })[0];
  if (!hit) return { 오류: '그 절세 아이템을 찾지 못했습니다 — search_tax_items가 준 id를 그대로 써라.' };
  var text = '';
  try { text = DriveApp.getFileById(hit.f.id).getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''); } catch (e) { return { 오류: '아이템을 읽지 못했습니다: ' + e.message }; }
  // 색인이 낡았어도 방금 읽은 본문으로 다시 판정한다
  var b = knhIdxBrief_(knhIdxEntry_({ id: hit.f.id, name: hit.f.name, modified: hit.f.modifiedDate, text: text }));
  var cx = knhCurrencyCtx_(), cur = knhCurrency_(b, cx.lc, cx.today, cx.confirms);
  var careful = text.split('\n').filter(function (l) { return /\[확인 필요|반대\s*취지|해석(이)?\s*엇갈|해석이\s*갈/.test(l); })
    .map(function (l) { l = l.trim(); return l.length > 220 ? l.slice(0, 218) + '…' : l; }).slice(0, 20);
  var cite = '〔근거: 절세 아이템 「' + b.제목 + '」(' + hit.세목 + ')' + (b.근거 ? ' · ' + b.근거 : '') + (b.기준일 ? ' · 기준일 ' + b.기준일 : '') + (b.검토 ? ' · ' + b.검토 : '')
    + (cur.필요 ? ' · ⚠ 현행화 필요' : '') + '〕';
  return {
    ok: true, id: hit.f.id, 아이템: b.제목, 세목: hit.세목, 종류: b.종류, 근거조문: b.근거, 검토상태: b.검토 || '(표시 없음 — 검토 여부 모름으로 말할 것)', 기준일: b.기준일,
    시간에따라바뀌는내용: b.변동, 현행화: cur, 조심할곳: careful, 인용: cite, 인용규칙: KNH_ITEM_CITE_RULE_,
    본문: text.length > 16000 ? text.slice(0, 16000) + '\n…(뒤는 잘림)' : text
  };
}

// 파일을 고쳐 저장한 직후 — 그 파일이 든 폴더에 색인이 있으면 그 폴더만 맞춘다(Code.js uploadFile의 knowIndex 표시, 제안 채택·폐기)
function knhIdxTouch_(fileOrFolder) {
  try {
    var ps = typeof fileOrFolder.getParents === 'function' && typeof fileOrFolder.getFiles !== 'function' ? fileOrFolder.getParents() : null;
    var list = [];
    if (ps) { while (ps.hasNext()) list.push(ps.next()); } else list.push(fileOrFolder);
    list.forEach(function (p) { if (knhFindFile_(p, KNH_IDX_FILE_)) knhIdxSync_(p, Date.now() + 4000); });
  } catch (e) { console.log('노하우 색인 갱신 실패(밤 점검이 다시 맞춤): ' + e.message); }
}

// 밤 점검(Code.js runNightlyChiefManager) — 등록된 모든 노하우 폴더의 색인을 실제 파일 목록과 맞춘다. 바뀐 파일만 읽어 보통 몇 초.
function knhIdxNightly_(opts) {
  var deadline = Date.now() + ((opts && opts.budgetMs) || 40000);
  var sum = { at: knhNow_(), 폴더: 0, 항목: 0, 다시읽음: 0, 빠짐: 0, 남음: 0, 오류: [] };
  knhIdxRoots_().forEach(function (r) {
    [r.folder].concat(r.subs ? knhIdxSubs_(r.folder) : []).forEach(function (d) {
      try { var s = knhIdxSync_(d, deadline); sum.폴더++; sum.항목 += s.total; sum.다시읽음 += s.read; sum.빠짐 += s.removed; sum.남음 += s.stale; }
      catch (e) { sum.오류.push(d.getName() + ': ' + String(e && e.message || e).slice(0, 80)); }
    });
  });
  // [2026.10.21] 절세 아이템 현행화 — 밤마다 판정해 총괄관리자\_지침정비\절세현행화_최신.json에 남긴다(주간 정비 루틴·화면이 읽음).
  //  내용 수정(현행화)은 세무사님·세션이 한다 — 여기서 세법 문장을 고치지 않는다.
  try {
    var all = knhTaxItemsAll_(Math.max(1000, deadline - Date.now()));
    if (all) {
      var need = all.filter(function (x) { return x.f.색인 && x.f.색인.현행화 && x.f.색인.현행화.필요; });
      var cur = { at: knhNow_(), 전체: all.length, 시간민감: all.filter(function (x) { return x.f.색인 && (x.f.색인.변동 || []).length; }).length,
        색인없음: all.filter(function (x) { return !x.f.색인; }).length, 현행화필요: need.length,
        목록: need.map(function (x) { return { id: x.f.id, 제목: x.f.색인.제목, 세목: x.세목, 기준일: x.f.색인.기준일, 이유: x.f.색인.현행화.이유 }; }) };
      knhWriteJson_(KNH_TAX_CURRENCY_, cur);
      sum.절세현행화필요 = need.length;
    }
  } catch (e) { sum.오류.push('절세 현행화 판정: ' + String(e && e.message || e).slice(0, 80)); }
  // [2026.10.22] 표시 분류 오류 검사(확인조치사항 판단 대기 ↔ 아이템에 남은 [확인 필요]) — 색인 맞추기와 따로 30초. 고치지 않고 표시만.
  try {
    var cls = knhClsNightly_({ budgetMs: 30000 });
    if (cls.ran) sum.분류오류후보 = cls.후보.length; else sum.오류.push('표시 분류 검사: ' + String(cls.reason || '').slice(0, 80));
  } catch (e) { sum.오류.push('표시 분류 검사: ' + String(e && e.message || e).slice(0, 80)); }
  try { PropertiesService.getScriptProperties().setProperty('KNH_IDX_LAST', JSON.stringify(sum)); } catch (e) { }
  return sum;
}
var KNH_TAX_CURRENCY_ = '절세현행화_최신.json';

// ---- 나. 바탕 템플릿 판 기록 — 사건 폴더에 템플릿 사본을 만들 때 첫머리(글 파일) 또는 드라이브 파일 설명(그 밖)에 한 줄 ----
// 판 = 템플릿 파일의 드라이브 수정 시각. 파일 이름엔 판을 붙이지 않는다(같은 이름 갱신·_이전판 보관이 기존 규칙).
// 글 파일에는 HTML 주석으로 넣는다 — 원문 편집창에선 보이고, 미리보기·고객 발행본에는 나타나지 않는다.
function knhTplStampLine_(name, ver) { return '<!-- 바탕 템플릿: ' + knhBase_(name) + ' · 판 ' + ver + ' -->'; }
var KNH_STAMP_RE_ = /^﻿?\s*<!--\s*바탕 템플릿:\s*(.+?)\s*·\s*판\s*([^>]*?)\s*-->[ \t]*\r?\n?/;
function knhTplParseStamp_(text) {
  var m = KNH_STAMP_RE_.exec(String(text || ''));
  return m ? { name: m[1], ver: m[2] } : null;
}
// 맨 앞에 판 줄이 이미 있으면 바꿔 끼우고, 없으면 붙인다
function knhTplApplyStamp_(text, line) {
  var t = String(text == null ? '' : text).replace(/^﻿/, '');
  return line + '\n' + t.replace(KNH_STAMP_RE_, '');
}
function knhTplVer_(tplFile) { return Utilities.formatDate(tplFile.getLastUpdated(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
function knhTplStampText_(tplFile, text) {
  try { return knhTplApplyStamp_(text, knhTplStampLine_(tplFile.getName(), knhTplVer_(tplFile))); } catch (e) { return text; }
}
function knhTplStampDesc_(copyFile, tplFile) {
  try { copyFile.setDescription('바탕 템플릿: ' + knhBase_(tplFile.getName()) + ' · 판 ' + knhTplVer_(tplFile)); } catch (e) { console.log('바탕 템플릿 판 기록 실패: ' + e.message); }
}

// =============================================================================================
// [2026.10.22] 표시 분류 오류 검사 — 세무사님 원문(2026-10-22): "확인필요에서 확인하고 나서 판단대기로 분류하는 것 아닌가?" / "나는 분류시스템의 문제를 지적하는 것이다".
// 규칙(업무관리자\절세\_작성기준.md, Claude작업원칙 L2_taxlaw 3절 "표시는 한 쟁점에 하나뿐"): [확인 필요] → 근거로 결론 나면 표시를 지운다 /
//  근거끼리 부딪히거나 엔진과 다르면 확인조치사항에 올리고 같은 자리 표시를 "[판단 대기 — 확인조치사항 💡 절]"로 바꾼다. 같은 쟁점이 두 상태에 동시에 있으면 분류 오류.
// 밤(knhIdxNightly_ 끝, 토큰 0)에 확인조치사항의 미결(- [ ]) 항목마다, 그 항목이 가리키는 아이템·지침에 같은 쟁점 낱말이 든 [확인 필요] 줄이 남았는지 본다.
// 파일 내용은 고치지 않는다(표시만) — 결과는 총괄관리자\_지침정비\분류점검_최신.json → 🧭 시스템 관리 노하우 화면 한 구역·개선 후보 보고서 한 줄.
// 헛잡힘 줄이기(10-22 "낱말만으로 세어 6건이라 했다가 실제 2건"):
//  ① 낱말은 그 항목 글에서만 — 한 항목이 파일 여럿을 가리키면("양도 65 …, 증여 33 …") 그 파일 번호 뒤 글토막만 그 파일에 쓴다.
//  ② 낱말마다 드묾 무게 = ln(전체 파일 수 ÷ 그 낱말이 나오는 파일 수). 일반 낱말 목록과 무게 1.5 미만(대략 파일 다섯 중 하나 넘게 나오는 말)은 버린다.
//     해석·판례 번호(재산세제과-1422, 2013두23195)는 통째 한 낱말 — 기관 이름만 같은 다른 해석에 걸리지 않게.
//  ③ [확인 필요] 줄 하나에 드문 낱말이 둘 이상·무게 합 4 이상(항목이 가리킨 파일·제목이 그 쟁점인 파일) / 셋 이상·7 이상(그 밖 파일)이어야 후보.
//     숫자로 시작하는 말(2년·12억·3건)은 낱말로 안 친다. 아이템 제목으로 가리킨 것은 제목이 두 낱말 이상·8자 이상일 때만.
//  ④ 항목이 파일을 안 적었으면 💡 절(절세 아이템 작업의 판단 대기) 항목만 아이템 전체에서 찾는다 — 다른 절은 엔진·서식 결정이라 아이템 표시와 짝이 아니다
//     (작성기준: "확인조치사항 항목에는 그 아이템 파일 이름을 적는다". 파일을 안 적은 💡 항목 수도 따로 보인다).
var KNH_CLS_FILE_ = '분류점검_최신.json';
var KNH_CLS_SEMOK_ = ['양도', '증여', '상속', '공통'];
var KNH_CLS_STOP_ = ('확인 필요 판단 대기 엔진 아이템 적용 경우 여부 결정 예규 해석 문언 지금 보임 보인다 보이므로 건 때 등 및 또는 기준 계산 원문 근거 세무사님 표시 그대로 나란히 적음 '
  + '고침 고치지 고칠 후보 검토대상 확인됨 결론 맞아 맞는가 맞는지 있음 없음 없이 않음 되는 된다 한다 하는 했다 위해 대한 관련 따라 따른 이후 이전 같은 다른 '
  + '세법 법령 조문 시행령 소득세법 상증법 조특법 국세기본법 세액 세금 금액 실무 처리 반영 제안 카드 포함 지금은 하나 모두 각각 엇갈리는 엇갈림 반대 취지 손대지 '
  + '추가 자동 작업 나온 대기로 필요한 이상 이하 초과 미만 기간 해당 차이 약 예 그 이 저 것 수 있다 없다 '
  + '서식 별지 신청서 화면 칸 칸을 둘지 고르는 고르 예에서 오류 사건에서 전까지 추후 감사 걸리 갱신 다름 의심 등에도 문구 json 아이템엔 엇갈리 남는다 확인할 확인 후 문언상 만이라 보완').split(' ');
var KNH_CLS_CITE_RE_ = /[가-힣]{2,}(?:과|국|실|팀)?-\d{2,4}-?[가-힣]*-?\d{2,5}|\d{4}[가-힣]{1,2}\d{2,6}|[가-힣]{2,}\d{5}-\d{2,5}/g;
var KNH_CLS_MIN_W_ = 1.5, KNH_CLS_NEAR_ = 4, KNH_CLS_FAR_ = 7;
var KNH_CLS_SYN_ = { '장기보유특별공제': ['장특공'], '장특공': ['장기보유특별공제'], '기재부': ['기획재정부'], '기획재정부': ['기재부'], '양도소득세': ['양도세'], '양도세': ['양도소득세'] };
var KNH_CLS_MARK_RE_ = /확인\s*필요/;

// 낱말 — 꾸밈 글자 떼고, 끝 조사 하나 떼고, 두 글자 이상(숫자만·날짜 꼬리는 뺌)
function knhClsWords_(s) {
  var out = {}, stop = {};
  KNH_CLS_STOP_.forEach(function (w) { stop[w] = 1; });
  (String(s || '').match(KNH_CLS_CITE_RE_) || []).forEach(function (c) { out[c] = 1; });
  String(s || '').replace(KNH_CLS_CITE_RE_, ' ').replace(/\*\*|`|\(\d{4}-\d{2}-\d{2}[^)]*\)/g, ' ').split(/[^0-9A-Za-z가-힣§①-⑳]+/).forEach(function (w) {
    var b = w.replace(/(으로는|으로|에서|에게|까지|부터|이라|이면|인데|인지|인가|에는|에도|로는|이다|은|는|이|가|을|를|에|의|로|와|과|도|만|땐)$/, '');
    if (b.length >= 2) w = b;
    if (w.length < 2 || /^\d/.test(w) || stop[w] || KNH_CLS_SEMOK_.indexOf(w) !== -1) return;
    out[w] = 1;
  });
  return Object.keys(out);
}
// 항목 글 → 가리키는 파일들(번호 "양도 15"·"양도 20·22", 아이템 제목 앞부분, 지침 파일 이름)과 그 파일에 쓸 글토막. 순수 함수
function knhClsPointers_(text, files) {
  var t = String(text || ''), hits = [];
  var re = /(양도|증여|상속|공통)\s*(\d{1,3})((?:\s*[·,]\s*\d{1,3})*)(?![\d.]|\s*(?:호|억|만|천|년|월|일|%|조|개|건|명|회|배|원|장|번))/g, m;
  while ((m = re.exec(t))) {
    var nums = [m[2]].concat((m[3] || '').split(/[·,]/).map(function (x) { return x.trim(); }).filter(Boolean));
    for (var i = 0; i < nums.length; i++) hits.push({ key: m[1] + ' ' + ('0' + (+nums[i])).slice(-2), at: m.index, how: '번호' });
  }
  (files || []).forEach(function (f) {
    // 아이템 제목은 낱말 둘 이상·8자 이상일 때만 "이름을 적었다"로 본다("장기보유특별공제"처럼 한 낱말 제목은 쟁점 설명 속 낱말과 구별 안 됨)
    var head = f.kind === '지침' ? knhBase_(f.name) : knhIdxTitle_(f.name).split(/\s+—\s+/)[0];
    if (head.length < 8 || (f.kind !== '지침' && !/\s/.test(head))) return;
    var at = t.indexOf(head);
    if (at !== -1) hits.push({ key: f.key, at: at, how: f.kind === '지침' ? '지침 이름' : '아이템 제목' });
  });
  hits.sort(function (a, b) { return a.at - b.at; });
  var seen = {}, out = [];
  hits.forEach(function (h) {
    var next = hits.filter(function (x) { return x.at > h.at; })[0];
    var seg = t.slice(h.at, next ? next.at : t.length);
    if (seen[h.key]) { seen[h.key].seg += ' ' + seg; return; }
    seen[h.key] = { key: h.key, how: h.how, seg: seg };
    out.push(seen[h.key]);
  });
  return out;
}
// 순수 함수(드라이브 모름) — input = { followText, files: [{ key:'양도 15', kind:'절세'|'지침', name, id, text }] }
function knhClsCheck_(input) {
  input = input || {};
  var files = input.files || [], N = files.length, byKey = {};
  files.forEach(function (f) { byKey[f.key] = f; f._lines = String(f.text || '').split(/\r?\n/); });
  var open = followupParse_(input.followText || '').items.filter(function (x) { return !x.done; });
  var wCache = {};
  var variants = function (w) { return [w].concat(KNH_CLS_SYN_[w] || []); };
  var has = function (s, w) { return variants(w).some(function (v) { return s.indexOf(v) !== -1; }); };
  var weight = function (w) { // 드묾 무게 ln(N/df) — 어느 파일에도 없으면 0(쓸모없음)
    if (wCache[w] == null) { var d = files.filter(function (f) { return has(String(f.text || ''), w); }).length; wCache[w] = d ? Math.log(N / d) : 0; }
    return wCache[w];
  };
  var rare = function (ws) { return ws.filter(function (w) { return weight(w) >= KNH_CLS_MIN_W_; }); };
  var score = function (s, terms) { var h = terms.filter(function (w) { return has(s, w); }); return { h: h, w: h.reduce(function (a, w) { return a + weight(w); }, 0) }; };
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var cands = [], noPtr = [];
  open.forEach(function (it) {
    var full = it.text + '\n' + (it.detail || '');
    var bold = ((it.text.match(/\*\*([^*]+)\*\*/) || [])[1] || it.text.split(/\s+—\s+/)[0]).replace(/^\([^)]*\)\s*/, '').slice(0, 120);
    var ptrs = knhClsPointers_(full, files).filter(function (p) { return byKey[p.key]; });
    var targets = ptrs.map(function (p) { return { f: byKey[p.key], terms: rare(knhClsWords_(bold + ' ' + p.seg)), how: p.how === '번호' ? '항목에 적힌 번호' : '항목에 적힌 ' + p.how, need: KNH_CLS_NEAR_ }; });
    if (!ptrs.length && /💡|절세/.test(it.sec)) {
      noPtr.push(bold);
      var terms = rare(knhClsWords_(full));
      files.forEach(function (f) {
        if (f.kind !== '절세') return;
        var t = score(knhIdxTitle_(f.name), terms), near = t.h.length >= 2 && t.w >= KNH_CLS_NEAR_;
        targets.push({ f: f, terms: terms, how: near ? '항목에 파일이 안 적힘 — 낱말로 찾음(파일 제목도 그 쟁점)' : '항목에 파일이 안 적힘 — 낱말로 찾음', need: near ? KNH_CLS_NEAR_ : KNH_CLS_FAR_, title: near ? t.h : null });
      });
    }
    targets.forEach(function (tg) {
      if (tg.terms.length < 2) return;
      var rows = [];
      tg.f._lines.forEach(function (L, i) {
        if (!KNH_CLS_MARK_RE_.test(L)) return;
        var sc = score(L, tg.terms);
        if (sc.h.length < (tg.need === KNH_CLS_FAR_ ? 3 : 2) || sc.w < tg.need) return;
        // 제목 덕분에 문턱을 낮춘 파일은 그 줄에 제목에 없는 드문 낱말이 하나는 있어야 한다(제목 낱말 "표1·표2"만 맞는 줄은 그 파일 어디에나 있음)
        if (tg.title && !sc.h.some(function (w) { return tg.title.indexOf(w) === -1; })) return;
        var s = L.trim();
        rows.push({ 줄: i + 1, 글: s.length > 240 ? s.slice(0, 238) + '…' : s, 낱말: sc.h.slice(0, 8), 무게: r1(sc.w), 표시: /\[\s*확인\s*필요/.test(L) ? '[확인 필요]' : '글 속 "확인 필요"' });
      });
      if (rows.length) cands.push({ 항목: bold, 절: it.sec, 확인조치줄: it.line + 1, 파일: tg.f.name, 파일키: tg.f.key, 종류: tg.f.kind, fileId: tg.f.id, 찾은방법: tg.how, 문턱: tg.need,
        쟁점낱말: tg.terms.slice().sort(function (a, b) { return weight(b) - weight(a); }).slice(0, 12), 줄들: rows.slice(0, 10) });
    });
  });
  return { 미결: open.length, 파일: N, 후보: cands, 후보줄: cands.reduce(function (s, c) { return s + c.줄들.length; }, 0), 파일안적은항목: noPtr.length, 파일안적은항목목록: noPtr.slice(0, 30) };
}

// 드라이브 — 확인조치사항 + 절세 아이템 전부 + 확인조치사항에 이름이 적힌 지침만 읽는다(쓰기는 결과 파일 하나뿐)
function knhClsNightly_(opts) {
  var deadline = Date.now() + ((opts && opts.budgetMs) || 30000);
  var res = { at: knhNow_(), ran: false, warn: [] };
  try {
    var ff = typeof followupFile_ === 'function' ? followupFile_() : null;
    if (!ff) throw new Error('확인조치사항 파일을 찾지 못했습니다.');
    var followText = followupReadText_(ff);
    var root = knhIdxRoots_().filter(function (r) { return r.key === '절세'; })[0];
    if (!root) throw new Error('절세 아이템 폴더(업무관리자\\절세)를 찾지 못했습니다.');
    var files = [], unread = 0;
    var readF = function (f) { try { return f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''); } catch (e) { return null; } };
    var addDir = function (d, semok) {
      var it = d.getFiles();
      while (it.hasNext()) {
        var f = it.next(), n = f.getName();
        if (!knhIdxIsItem_(n) || f.isTrashed()) continue;
        var text = Date.now() > deadline ? null : readF(f);
        if (text == null) { unread++; continue; }
        var num = (n.match(/^(\d{1,3})[\s._-]/) || [])[1];
        files.push({ key: num ? semok + ' ' + ('0' + (+num)).slice(-2) : semok + '/' + n, kind: '절세', name: n, id: f.getId(), text: text });
      }
    };
    addDir(root.folder, '공통');
    knhIdxSubs_(root.folder).forEach(function (d) { addDir(d, d.getName()); });
    var bmF = knhFolder_('지침');
    if (bmF) {
      var it2 = bmF.getFiles();
      while (it2.hasNext()) {
        var g = it2.next(), gn = g.getName();
        if (!/\.(md|txt)$/i.test(gn) || gn.charAt(0) === '_' || g.isTrashed() || followText.indexOf(knhBase_(gn)) === -1) continue;
        var gt = readF(g);
        if (gt != null) files.push({ key: '지침/' + gn, kind: '지침', name: gn, id: g.getId(), text: gt });
      }
    }
    if (unread) res.warn.push('시간이 모자라거나 읽기 오류로 아이템 ' + unread + '개를 못 읽음 — 그 파일은 이번 검사에서 빠짐(다음 밤에 다시)');
    var r = knhClsCheck_({ followText: followText, files: files });
    res = Object.assign(res, r, { ran: true, 확인조치파일: ff.getName(), 확인조치fileId: ff.getId() });
  } catch (e) { res.ran = false; res.reason = String(e && e.message || e); }
  knhWriteJson_(KNH_CLS_FILE_, res);
  return res;
}
