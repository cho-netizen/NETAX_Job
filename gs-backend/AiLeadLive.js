// =========================================================
// [2026.10.19 5번 — AI 지휘 운영 흐름] 세무사님 결정(원문): "그렇다면 이번에 지휘권을 ai에게 넘기는 것으로 하자. 어차피 가야할 방향이다"
//  "이 사건 처리하자"의 기본 동작:
//   1) GAS 입구가 상수 한 바퀴(사건파악 → 증빙 읽기·나누기·보정 → 칸 채우기 반복)를 돈다 — 지금 ⚡ 처리 그대로, 토큰 0.
//   2) 그 결과에서 AI 자리(caseProcAiVarSpots_)를 센다(step 'spots'). AI 자리가 없으면 AI를 부르지 않고 계산·저장으로 끝(0원).
//   3) AI 자리가 있으면 지휘 AI(Sonnet 5.5)가 도구(AiLead.js CASEPROC_AI_TOOLS_ + 좁은 판단 두 개)를 부려 판단한다(step 'turn',
//      화면이 차례마다 부름 — 한 번 부를 때 모델 한 번 + 그 차례의 도구 실행, Apps Script 6분 한도 안).
//   4) 끝나면 화면이 칸 채우기를 한 번 더 돌려 AI가 넣은 값을 보이고, 계산·서식·저장·검토서·현황표는 지금 ⚡ 처리 그대로.
//  세무사님이 정한 세부(결정표 ① 5번 추천 채택):
//   · 비용 상한: 단순·일반 신고 1,000원, 절세·불복(경정·해명·조사 포함) 5,000원. 최고급 모델(Fable)은 쓰기 전 여쭘(자동으로 안 씀)
//   · AI가 "확실"이라 한 판단은 넣고 🤖 표시와 근거(출처 칸). 시가·관계처럼 세액이 크게 갈리는 칸은 세무사님 답으로만
//   · 좁은 판단은 저가 AI(Haiku 5.5 — quick_judge), 어려운 판단만 상위(Opus 5.5 — ask_higher), 사건 전체 판단은 지휘 AI
//   · 질문은 계산을 막는 것만 바로(urgent), 나머지는 끝에 모아서
//   · 주민번호 뒷자리·계좌·전화 가림(caseProcAiMask_) · 되돌리기 어려운 일은 ▶실행 카드(도구가 없음 — 보고에 적게 함)
//   · 규칙 승격은 처음 보는 사건 2건 이상 확인 뒤(이 파일은 판단 기록만 남김 — _사건처리AI판단기록.json)
//  예비 경로: "GAS 순서로 처리" 말·단추, AI 오류·비용 상한·바퀴 한도면 화면이 그 자리에서 지금 GAS 순서로 이어간다.
//  모델 표는 Code.js MODEL_CONFIG. 도구 강제 지정(tool_choice)은 최신 모델에서 400이라 쓰지 않는다.
// [2026.10.22 넥스가 주인 — 위 1)~4) 순서를 바꿈] 세무사님 원문: "가급적 ai없이 돌아가는 gas를 원하는 거지. 최상위 ai가 도구로 사용하는 것이 gas인 것이다"
//  / "이런 방향이 맞다고 이미 말했는데, 아직까지 이러고 있는 것이 말이 되나?" (공통원칙 1절 정리 10-22)
//  이제 "이 사건 처리하자"는 넥스가 먼저 받는다(step 'turn' 0바퀴). 넥스가 gas_run(GAS 한 바퀴 — 사건파악·서류 읽기·나누기·보정·칸 채우기·교차검증,
//  AI 없이 0원, 다시 읽기 없음)을 부르면 화면이 그 도구를 실행해 결과(GAS가 못 푼 자리)를 넥스에게 돌려준다. 넥스가 판단·질문하고 끝내면
//  화면이 계산·서식·저장·검토서를 한다. "판단할 자리 없으면 AI 안 부름" 관문(3-1)과 GAS 안의 저비용 AI 자동 판단은 쓰지 않는다(GAS가 못 푼 것은 넥스에게).
// =========================================================
var CASEPROC_AI_CLIENT_TOOLS_ = []; // [2026.10.31 묶음 해체] 화면이 대신 돌리던 묶음 도구(gas_run 한 바퀴·gas_finish 마무리)는 없앴다 — 넥스 도구는 모두 서버가 바로 실행(화면 단추와 같은 입구)
var CASEPROC_AI_DIRECTOR_MODEL_ = 'claude-sonnet-5-5';
var CASEPROC_AI_LIGHT_MODEL_ = 'claude-haiku-5-5';
var CASEPROC_AI_HIGH_MODEL_ = 'claude-opus-5-5';
var CASEPROC_AI_KRW_ = 1400;
var CASEPROC_AI_MAX_ROUNDS_ = 14;
// [2026.10.28 속도 ④바퀴] 세무사님 "이어서 돌려라" — 가상양도32 실측 왕복 8·294초·458원: 지시문으로는 모델이 안 따른다(다른 도구로 우회, ask_user 뒤 또 한 왕복). 왕복 수를 코드로 못 박는다
var CASEPROC_AI_EXPLORE_TOOLS_ = ['case_files', 'file_read', 'case_view', 'doc_view', 'facts_find', 'doc_facts', 'doc_find', 'fact_map', 'case_status']; // "탐색" 도구(읽고 둘러보기) — 그 밖은 "일" 도구
var CASEPROC_AI_EXPLORE_MAX_ = 1; // GAS 한 바퀴 전 탐색 차례 상한 — 넘으면 돌리지 않고 "지금 아는 것으로 set_read_scope"로 되돌림(0원)
var CASEPROC_AI_TURN_BUDGET_MS_ = 150000; // 한 차례(서버 한 번)에 도구를 새로 시작할 수 있는 시간 — 화면 다리(gasbridge)는 같은 요청을 4분까지 기다린다
// 세액이 크게 갈리는 칸 — AI가 근거를 대도 넣지 않고 세무사님 답으로만(질문 id·질문 글 기준)
var CASEPROC_AI_USER_ONLY_RE_ = /relfmv|시가|특수관계|가족관계|관계인지|평가액|감정가|buyerrel|donorRelation|giftRelation|giftPrior|사전증여|10년 내|합산액/; // 10년 합산(사전증여)은 2번 잠정 0과 같이 세무사님 확인 칸
// 특수관계 질문(2번 relcheck) — 세무사님 원문 "특수관계 여부를 확인하는 절차만 있으면 된다": 총괄 AI도 값·의견을 붙이지 않고 질문 글의 정황 근거만 세무사님께
var CASEPROC_AI_RELATION_RE_ = /^(tr:buyerrel|trc:a\d+\.donorRelation|ov:giftRelation(:.*)?|tr:relfmv)$/;
var CASEPROC_AI_LOG_NAME_ = '_사건처리AI판단기록.json';
// [2026.10.20 밤샘] 시험 모드(body.dry) — 실제 AI는 부르되 사건에 쓰지 않음(값 넣기·첨부 저장·작업일지·판단 기록 없음, 비용 기록은 [시험])
var CASEPROC_AI_DRY_ = false;
var CASEPROC_AI_NO_TOOLS_ = ['docs_read', 'doc_text']; // [GAS 고도화 ④] 지휘 AI에게 주지 않는 도구 — docs_read(폴더 통째 GAS 판독 돌리기 = case_read가 함)·doc_text(GAS 판독 원문 몇 줄 = file_read가 더 넓게 함). 넥스 읽기를 막는 것이 아니다(10-28 세무사님 "gas속에 ai를 가두지 마라") — 넥스는 case_files/file_read/doc_view로 어떤 파일이든 읽는다

// 사건당 비용 상한(원) — 업무유형으로

// 판단 자리별 수준(설계 2-7) — 1 저가 · 2 중간 · 3 고급

// [2026.10.28 속도 A②] GAS 한 바퀴 결과 묶음 — 칸(정한 값)·남은 질문·서류 정리 결과(파일별 종류·값)·사람/계약/자산 명단을 한 번에 실어 doc_facts·doc_view·people_roster·contract_list·owner_assets 왕복을 없앤다(상한 14,000자)
// ---------- step 'spots' — 입구(GAS) 상수 한 바퀴 결과에서 AI 자리를 센다 ----------
//  body: { caseId, ov: { items, needs }, ev: { docTypes } } — 화면이 가진 마지막 칸 채우기·증빙 결과(이미 결정한 질문은 빼고 보냄)

// ---------- 지휘 AI에게 주는 도구 — AiLead.js 도구 + 좁은 판단 둘. 운영에서 바뀌는 설명만 고친다 ----------
function caseProcAiLiveTools_() {
  // [GAS 고도화 ④] 서류 접근은 GAS 도구로만 — 폴더 통째 읽기(docs_read)·원문 직접 읽기(doc_text)는 주지 않는다(쟁점 묶음·사실 목록·서류 정리 결과로)
  const tools = JSON.parse(JSON.stringify(CASEPROC_AI_TOOLS_)).filter(function (t) { return CASEPROC_AI_NO_TOOLS_.indexOf(t.name) === -1; });
  tools.forEach(function (t) {
    if (t.name === 'value_set') {
      t.input_schema.properties.basis.description = 'doc: {kind:"doc", file, page(쪽, 알면), find 또는 quote} — file은 facts_find·doc_facts·issue_bundle이 준 출처 파일 이름. 금액·날짜는 원문에 그 값이 있어야 하고, 예/아니오·보기 같은 판단 값은 서류에 글자로 안 나오므로 그 판단을 받치는 원문 문구를 quote로 준다(여러 서류를 묶은 판단이면 {kind:"infer", facts:[…]})';
      t.description = t.description + ' [운영] sure="확실"이고 근거 대조를 통과하면 그 질문의 답으로 실제로 넣는다(출처 칸에 "🤖 AI 판단: why"). sure="불확실"·infer는 넣지 않고 그 질문에 "🤖 AI 의견"으로 붙는다. 시가·특수관계·평가처럼 세액이 크게 갈리는 칸은 넣지 않는다(세무사님 답으로만 — ask_user). itemId는 calc_fill 질문목록의 id.';
    }
    // [2026.10.27 10-27 A] 질문 목록에 없는 확정 칸도 target으로 고칠 수 있게(세무사님 값은 바꾸지 않고 여쭘)
    if (t.name === 'value_set') { t.input_schema.properties.target = { type: 'string', description: '(선택) 질문 목록(itemId)에 없는, 이미 확정된 칸을 고칠 때 그 칸 이름 — calc:a0.assetType·calc:c0.totalPrice·expenses·trTaxFee·ov:사건분류·base. itemId 대신 쓴다. 세무사님이 정하신 값이면 바뀌지 않고 그 사실이 돌아온다(그때는 ask_user로 여쭌다).' }; t.input_schema.required = ['caseId', 'value', 'basis']; t.description += ' itemId가 질문 목록에 없는 확정 칸은 target으로(세무사님 값은 안 바뀜 — 결과의 needConfirm을 보고 ask_user).'; }
    if (t.name === 'ask_user') {
      t.description = '세무사님께 여쭐 질문 고르기 — 서류로 알 수 없는 것만. urgent=true는 계산을 막는 질문(처리 끝에 맨 위·바로), 나머지는 끝에 모아 보여 준다. 이미 있는 질문(itemIds)에 note(무엇을 받으면 정해지는지·네 의견)를 붙인다.';
      t.input_schema.properties.urgent = { type: 'boolean' };
      t.input_schema.properties.questions = { type: 'array', description: '[2026.10.28] 질문 여럿을 한 번에 — 각 항목은 이 도구의 입력과 같은 모양({itemIds, note, target, label, input, cands, urgent})', items: { type: 'object' } };
      t.description += ' 질문이 여럿이면 questions 배열로 한 번에 올린다(차례를 아낌).';
    }
    if (t.name === 'save_draft') t.description = '저장·초안 — 운영에서는 처리 끝에 화면이 저장·종합검토서 초안·현황표를 만든다. 부르지 않아도 된다(부르면 현황표만 본다).';
  });
  tools.push({ name: 'issue_bundle', description: '쟁점 묶음 보기 — 그 질문(itemId)에 GAS·교차검증이 모아 둔 재료: 사건 요약·물린 사실·출처 원문 앞뒤·후보·못 푼 이유·계산기 칸의 쓰임, 저비용 AI의 답과 모자란 정보. 원문이 필요하면 이것으로 본다(원문 파일을 직접 읽는 도구는 없다).',
    input_schema: { type: 'object', properties: { itemId: { type: 'string' } }, required: ['itemId'] } });
  tools.push({ name: 'fact_map', description: '사실 지도(토큰 0) — 서류 조각을 사람·자산·시간·돈 네 축으로 맞물려 둘 이상 서류가 받치는 사실·한 서류뿐인 사실·어긋나는 사실, 그리고 빈칸마다 찾을 서류(법정 서류 기준)와 이 사건에 있는 그 종류 파일. 판단 전에 먼저 부르고, 빈칸을 메운 뒤 다시 부른다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } } } });
  tools.push({ name: 'doc_find', description: '다시 뒤지기(토큰 0, 저장된 판독만) — fact_map이 가리킨 서류를 GAS가 다시 훑어 날짜·금액·낱말 후보를 쪽 번호·판독 종류(Vision 줄·칸 / 쪽 단위 / 드라이브 글)와 함께 돌려준다. want: date | amount | keyword(+keyword). 찾은 값은 value_set basis {kind:"doc", file, page, find}로.',
    input_schema: { type: 'object', properties: { file: { type: 'string' }, want: { type: 'string', enum: ['date', 'amount', 'keyword'] }, keyword: { type: 'string' } }, required: ['file', 'want'] } });
  tools.push({ name: 'quick_judge', description: '좁은 판단 맡기기(저가 AI Haiku 5.5) — 짧고 근거가 서류에 있는 판단: 후보 중 하나 고르기, 표기가 같은 사람·주소인지, 판독 고르기, 처음 보는 서류 종류. 재료(material)에 원문 줄·후보를 넣는다(개인정보는 이미 가려짐). 답·확실 여부·근거를 돌려준다. 불확실이면 네가 판단하거나 여쭙는다.',
    input_schema: { type: 'object', properties: { question: { type: 'string' }, material: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } }, required: ['question', 'material'] } });
  tools.push({ name: 'ask_higher', description: '어려운 판단 올리기(상위 AI Opus 5.5) — 특례가 얽힌 사건분류(1세대1주택·일시적 2주택·상속주택·정비사업 감면), 시가·유사사례 다툼, 법령 해석이 갈리는 것. 재료를 정리해 넘긴다. 최고급(Fable 5.1)이 필요하면 부르지 말고 보고에 "최고급 검토 필요"로 적는다(세무사님이 쓰기 전에 정하심).',
    input_schema: { type: 'object', properties: { question: { type: 'string' }, material: { type: 'string' } }, required: ['question', 'material'] } });
  // [2026.10.22 넥스가 주인] GAS 한 바퀴 — 화면이 실행(서버 6분 한도 안에 한 번에 못 끝나는 여러 단계라). 넥스의 첫 도구
  // [2026.10.27 10-27 C] 질문 닫기 — 서류로 푼 질문(서류 ⚠ 확인 등)·세무사님이 답한 질문을 결정으로 닫는다(예전엔 말로만 "해소"라 하고 질문은 네 바퀴 내내 그대로 다시 떴다)
  tools.push({ name: 'close_question', description: '질문 닫기(토큰 0) — 서류를 읽어 네가 푼 질문(서류 ⚠ 확인·판독 확인 등)이나 세무사님이 채팅으로 답하신 질문을 결정으로 닫아 다음 처리 때 다시 묻지 않게 한다. decision: done(확인·해소)·보류(검토서 "추가로 확인할 사항"에 남김)·무시. note에 근거 한 줄(어느 서류 어느 값으로 풀었나). 세무사님께 여쭐 것은 닫지 말고 ask_user.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, itemIds: { type: 'array', items: { type: 'string' } }, decision: { type: 'string', enum: ['done', '보류', '무시'] }, note: { type: 'string' } }, required: ['caseId', 'itemIds', 'note'] } });
  // [2026.10.27 경우별 저장] 세액계산기는 네가 쓰는 도구 — 세목·입력을 바꿔 몇 번이든 돌려 이름 붙여 저장(기본 저장본·세무사님 값은 그대로)
  tools.push({ name: 'calc_scenario', description: '경우(안) 세액계산 저장(토큰 0) — 세액계산기를 서버에서 돌려 결과를 이름 붙여 따로 저장한다(기본 저장본·세무사님 값은 바뀌지 않음). tax: transfer·gift·inheritance(생략하면 사건 세목). changes: 양도는 계산기 칸 경로(a0.assetType·a0.isOneHouseOneFamily·c0.totalPrice·a0.acquisitionPrice·costs·taxfee·사건분류·seller.multiHouseCount), 증여·상속은 엔진 입력 이름(giftAmount·relation·taxableEstateAmount·hasSpouse…). input: 사건 자료에 없는 전제로 다른 세목을 견줄 때 엔진 입력 전체. 비과세 적용 전/후·필요경비 일부 제외·양도세 vs 증여세 비교처럼 경우마다 한 번씩 부른다. 세액 숫자는 이 결과(저장본 id)에서만 보고하고 암산하지 않는다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, tax: { type: 'string', enum: ['transfer', 'gift', 'inheritance'] }, name: { type: 'string' }, changes: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, value: {} }, required: ['path'] } }, input: { type: 'object' }, why: { type: 'string' } }, required: ['caseId', 'name'] } });
  // [2026.10.27 F] 읽을 범위 — 세무사님 "신고제출 폴더에 있는 파일만 읽어서 다시 처리하라"
  // [2026.10.28 넥스 폭넓은 파일 읽기] 세무사님 원문: "ai는 포괄적으로 파일에 접근할 수 있어야 하지만 gas는 구체적으로 필요한 것만 콕 집어서 알려주어야 한다" / "ai는 사용자의 대리인의 위치이지. gas와 동급이 아니다"
  tools.push({ name: 'case_files', description: '사건 폴더 파일 목록(토큰 0, 읽기만) — 하위 폴더·산출물·보관·이미 낸 신고서·예규·검토 메모·지침까지 전부(폴더·크기·수정일·종류). GAS체크(켬/끔)는 GAS가 읽는 파일 표시일 뿐 참고로만 — 너는 어떤 파일이든 file_read로 읽는다. dir(폴더 이름)·find(파일 이름 낱말)로 좁힐 수 있다.', input_schema: { type: 'object', properties: { dir: { type: 'string', description: '폴더 이름으로 좁히기(선택)' }, find: { type: 'string', description: '파일 이름 낱말로 좁히기(선택)' } } } });
  tools.push({ name: 'file_read', description: '사건 폴더 파일 한 개의 글 읽기(토큰 0) — 체크 목록과 무관하게 어떤 파일이든(글자 기억 _글자인식기억에 있으면 그것, 없으면 드라이브 글자층·PDF 글자). 쟁점이 생기면 세무사님이 폴더에 두신 관련예규·검토 메모·지침부터 이것으로 직접 읽어라. file=파일 이름(또는 폴더/파일 이름), page=쪽("3"·"2-4", 쪽 나눔이 있을 때), start=시작 글자 위치, find=낱말 앞뒤 보기, len=길이(기본 4000). 더있음이면 start를 옮겨 이어 읽는다. 개인정보는 가려서 온다.', input_schema: { type: 'object', properties: { file: { type: 'string' }, page: { type: 'string' }, start: { type: 'number' }, find: { type: 'string' }, len: { type: 'number' } }, required: ['file'] } });
  // [2026.10.28] 사건 장부(CaseLedger.js) — 사실의 유일한 저장소. 서류를 읽어 정한 값은 근거와 함께 적고, 확신 없으면 물어볼 것으로. 세무사님 말씀은 kind 세무사님으로 바로.
  tools.push({ name: 'ledger_read', description: '사건 장부 요약 보기(토큰 0) — 띠·마지막 장부 적기·남은 물음(가설과 다름 포함)·사건개요(정함·가설)·확보할 증빙(받을 것)·칸 값(주인 세무사님/넥스/서류/규칙/추정·상태·같은 값 서류·다른 값 서류). case_status 첫 응답에 이미 실려 오니, 값을 적거나 답을 받은 뒤 다시 볼 때 부른다. 서류 사실은 case_ledger do:facts.', input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } });
  tools.push({ name: 'case_ledger', description: '사건 장부에 적기(토큰 0, 바로 실행). do=set{path,value,kind(세무사님|넥스|추정),file,page,quote,why} — 칸 경로는 세액계산기 칸(seller.name·c0.date·c0.totalPrice·c0.buyer.name·c0.buyer.relation·a0.assetLocation·a0.assetType·a0.acquisitionDate·a0.acquisitionPrice·a0.contract·costs·taxfee·사건분류·기준일·doc:<파일>.role). 고르기 칸은 코드값(assetType house|other|presale_right · buyer.relation none|sibling|lineal|spouse|relative · assetKind land|building|land_building|stock|other · transferCause sale|expropriation|exchange|gift_burden|other). 세무사님이 정한 값은 바뀌지 않는다(거절되면 지금 값·서류 값만 보고). do=ask{path,question,cands:[{v,src}],needDoc} — 확신 없을 때 값 대신 물어볼 것. do=decide{path,decision(확인|보류|무시),note}. do=undo{path}. do=calc — 장부(확정+추정)로 세액계산기를 돌려 저장, 납부세액·빈 칸·추가 확인 사항을 받는다(세액은 이 숫자만). do=import — 옛 저장소를 장부로 한 번 옮김. do=hyp{field(상대방|관계|물건|거래|쟁점|요청),value,file} — 의뢰서·메모를 읽고 GAS 규칙이 못 뽑은 사건개요 가설을 보탬(「넥스 판단」 표시, 계산 칸엔 안 들어감). do=facts{find_kind,find_file,find_value,find_to,limit} — 장부가 모아 둔 서류 사실 찾기(읽기만, 번호·값·파일·자리·쓰인 칸). do=brief — 장부 요약(읽기만). '
      // [2026.10.29 계획서 3판] 대화창 넥스 case_ledger와 같은 도구 — 세무사님 화면 📒 ⑤와 같은 함수(넥스의 두 입구가 같은 도구를 쥔다)
      + 'do=lookup{loc,what,dates,onlyNew} — 공부 조회: 있는 조회 도구(토지대장·토지이용계획·토지이음·건축물대장·공시가격·조정대상지역·매매사례)를 필지 하나(loc) 또는 장부·처리개요·의뢰서 가설의 모든 필지에, what으로 고른 것만(비우면 매매사례 뺀 전부). 서류 없이 의뢰 메모만 있어도 된다. 결과는 장부 공부 사실·확보자료 PDF. '
      + 'do=estimate{values} — 의뢰서 등 가설의 거래 날짜·금액·물건을 계산 칸에 추정으로(values[{path,value,why}]면 그 가정값을, 정해진 칸은 안 바꿈). do=calc{name,over} — 장부(정함+추정)로 시험 계산(언제든, 물어볼 것이 남아도). name·over[{path,value}](이번 계산에만 쓰는 가정, 장부 값 그대로)면 경우(안)으로 저장. '
      + 'do=compare{gift,inheritance,name} — 같은 사실로 세목 비교: 양도 사건은 장부로 양도세, gift{relation 필수, giftAmount 없으면 장부 양도가액}, inheritance{calculate_inheritance_tax 입력}을 각각 계산해 나란히.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, do: { type: 'string', enum: ['set', 'ask', 'decide', 'undo', 'calc', 'lookup', 'estimate', 'compare', 'import', 'hyp', 'facts', 'brief'] },
      loc: { type: 'string' }, what: { type: 'array', items: { type: 'string', enum: ['토지대장', '토지이용계획', '토지이음', '건축물대장', '공시가격', '조정대상지역', '매매사례'] } }, dates: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, date: { type: 'string' } } } }, onlyNew: { type: 'boolean' },
      values: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, value: {}, why: { type: 'string' } } } }, name: { type: 'string' }, over: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, value: {} } } }, gift: { type: 'object' }, inheritance: { type: 'object' }, find_kind: { type: 'string' }, find_file: { type: 'string' }, find_value: { type: 'string' }, find_to: { type: 'string' }, limit: { type: 'number' }, field: { type: 'string' }, path: { type: 'string' }, value: {}, kind: { type: 'string', enum: ['세무사님', '넥스', '추정'] }, file: { type: 'string' }, page: { type: 'string' }, quote: { type: 'string' }, why: { type: 'string' }, question: { type: 'string' }, cands: { type: 'array', items: { type: 'object', properties: { v: {}, src: { type: 'string' } } } }, needDoc: { type: 'boolean' }, decision: { type: 'string', enum: ['확인', '보류', '무시'] }, note: { type: 'string' } }, required: ['caseId', 'do'] } });
  tools.push({ name: 'set_read_scope', description: 'GAS가 읽을 파일 목록 바꾸기(토큰 0) — 사건마다 "읽을 파일 체크 목록"이 있고 GAS(서류 읽기·칸 채우기·직결, case_read)는 그 목록의 켜진 파일만 읽는다. 이것은 GAS에게 콕 집어 주는 것이지 네 읽기 범위가 아니다(너는 case_files/file_read로 어떤 파일이든 읽는다). 세무사님이 "○○ 폴더(파일)만 읽어라"·"○○는 빼라" 하시면 on(켤 파일 이름·폴더 이름 — 폴더면 그 아래 하위 폴더까지 전부)·off(끌 파일·폴더)로 목록을 바꾼다(파일 단위). dirs·files는 옛 방식(그 폴더·파일만). clear:true면 전체로. 바꾼 뒤 case_read을 한 번 다시 부른다. 목록이 아직 없는 사건(case_status 현황의 읽을범위가 null)은 네가 먼저 case_files로 목록을 보고 모르는 파일은 file_read로 읽어 판단한 뒤 ids(켤 파일 전부) 또는 on/off로 정하고, 정한 목록과 이유를 세무사님께 보고한다 — 읽지 않고 체크하지 않는다(세무사님 원문 "ai가 체크를 하려면 뭘 알아야 체크를 할 수 있지 않은가? 뭘 알려면 읽어야 하는 것이고!").',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, ids: { type: 'array', items: { type: 'string' }, description: '켤 파일 이름(또는 폴더/파일) 전부 — 목록을 처음 정할 때(그 밖은 끔)' }, on: { type: 'array', items: { type: 'string' } }, off: { type: 'array', items: { type: 'string' } }, dirs: { type: 'array', items: { type: 'string' } }, files: { type: 'array', items: { type: 'string' } }, clear: { type: 'boolean' }, why: { type: 'string' } }, required: ['caseId'] } });
  // [2026.10.31 묶음 해체] 세무사님 원문(10-31) "개별 gas의 도구들을 넥스가 활용하는 것" — 예전 gas_run(한 바퀴: 읽기·칸 채우기·교차검증을 한 번에, 화면이 실행)을
  //  📖 서류 읽기 하나로(서버가 바로 실행, 화면 "📖 서류 읽기" 단추와 같은 입구 step 'read'). 칸 채우기는 calc_fill, 계산은 tax_calc·case_ledger do=calc, 서식은 forms_check로 따로
  tools.push({ name: 'case_read', description: '📖 서류 읽기(토큰 0, 서버 실행 — 세무사님 화면 📖 단추와 같은 도구): 사건파악 → GAS 읽을 목록의 서류 글자 읽기·정리 → 읽은 사실을 장부에 적기(가설·사건개요·받을 증빙·새 필지). 칸 채우기·계산은 하지 않는다(그건 calc_fill·tax_calc). 서류가 많으면 more/partial이 오고 같은 도구를 다시 부르면 이어 읽는다. [부르기 전에: case_files로 목록을 보고 모르는 파일은 file_read로 읽은 뒤, GAS가 읽을 파일을 set_read_scope로 콕 집어 준 다음 부른다 — 세무사님이 범위를 말씀하셨으면("○○ 폴더는 빼고"·"○○만") 반드시(안 하면 gas_run이 거절된다), 말씀이 없어도 목록에 뺄 폴더(증빙 아닌 폴더·다른 세목 서류 폴더)가 있으면 지정] GAS 한 바퀴(토큰 0, AI 없음) — 사건파악 → 증빙 폴더의 모든 서류 읽기·한 파일에 든 여러 서류 나누기·흐린 사진 보정 → 세액계산기 칸 채우기·서류끼리 교차검증을 한 번에 한다(몇 분 걸림). 돌려주는 것: 채운 칸·남은 질문 수, GAS가 못 풀어 너에게 돌아온 자리, 서류에 없어 세무사님께 바로 여쭐 빈 칸. case_status에서 증빙 읽기·칸 채우기가 이미 되어 있고 새 서류가 없으면 부르지 않는다(세무사님이 이미 하셨거나 지난 처리에서 한 일 — 다시 읽지 않는다). 새 서류가 있거나 아직 안 했으면 한 번만 부른다.',
    input_schema: { type: 'object', properties: { why: { type: 'string', description: '한 줄 — 무엇을 보려고(보통 "처음 읽기")' } } } });
  // [2026.10.22 작업 기록부] 사건 현황 보기 — 세무사님이 직접 하신 일·지난 처리(누가·언제·무엇), 정한 값, 단계별 시각, 새 서류, 반영 현황표, 남은 질문. 늘 맨 먼저(0원)
  tools.push({ name: 'case_status', description: '사건 현황 보기(토큰 0) — 작업 기록부(세무사님이 GAS 도구로 직접 하신 일과 지난 넥스 처리: 누가·언제·무엇), 정한 값과 출처(세무사님 값은 바꾸지 않는다), 단계별로 이미 한 것과 시각, 그 뒤 새로 들어온 서류, 반영 현황표(⑦ — 남은 일의 기준), 남은 질문 목록. 처리를 맡으면 맨 먼저 부르고, 여기서 남은 일만 고른다.',
    input_schema: { type: 'object', properties: {} } });
  // [2026.10.19 법령] 세무사님 "ai가 위임을 받아 사건을 처리할때도 이 과정을 거쳐야 하는 거 아닌가?" — 쟁점마다 법령·예규·판례를 GAS 도구로 찾아(토큰 0) 근거로 쓰면 첨부
  tools.push({ name: 'law_lookup', description: '조문 원문 보기(토큰 0) — 사건 기준일에 시행된 판(법령 정비본, 산식 보정 포함). 쟁점 판단에 필요한 조문을 확인할 때. 근거로 쓰면 law_attach로 사건에 첨부한다. articleNo에 「부칙」을 주면 그 판까지의 부칙(적용례·경과조치 — 언제 양도분부터)을 본다.',
    input_schema: { type: 'object', properties: { lawName: { type: 'string', description: '예: 소득세법 시행령' }, articleNo: { type: 'string', description: '예: 155, 97의2' } }, required: ['lawName', 'articleNo'] } });
  tools.push({ name: 'law_search', description: '예규·해석례·판례·심판례 찾기(토큰 0, 국가법령정보센터) — category: precedent(판례)·interpretation(법령해석례)·administrative_rule(행정규칙)·tax_tribunal(조세심판원). 목록의 id로 law_attach 한다.',
    input_schema: { type: 'object', properties: { category: { type: 'string' }, query: { type: 'string' } }, required: ['category', 'query'] } });
  // [2026.10.21] AI 회의 법령 안건 — 세무사님 "ai회의 결론을 넥스가 보도록 하라"(Federation.js aiJudgeForNex_, 대화창 넥스의 job_lookup law_decisions와 같은 자료)
  tools.push({ name: 'law_decisions', description: 'AI 회의 법령 안건 보기(토큰 0) — 세무사님이 결정한 쟁점(결론·메모·근거)과 아직 판단 대기인 쟁점. 특례·중과·평가처럼 해석이 갈리는 판단 전에 같은 쟁점이 있는지 먼저 본다. "결정"은 그대로 따르고, "판단 대기"·"보류"는 단정하지 말고 질문 메모에 "판단 대기 쟁점"이라고 적는다.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: '쟁점 낱말(예: 투기지역, 일시적 2주택)' } } } });
  tools.push({ name: 'law_attach', description: '근거 자료를 사건에 첨부("AI 첨부(미확인)" — 세무사님이 법령 탭에서 확정하거나 뺀다). 관련법령 파일·검토서 근거에 들어간다. 조문은 kind="statute"+lawName+articleNo(+hang 항 번호), 예규·판례는 kind=그 category+id. use=어느 쟁점·계산 칸에 쓰는지, why=왜(한 줄). 돌려준 id를 value_set의 attach에 넣는다.',
    input_schema: { type: 'object', properties: { kind: { type: 'string' }, lawName: { type: 'string' }, articleNo: { type: 'string' }, hang: { type: 'number' }, id: { type: 'string' }, title: { type: 'string' }, use: { type: 'string' }, why: { type: 'string' } }, required: ['kind', 'use', 'why'] } });
  // [2026.10.20] 업무관리자 지침(업무별 판단 절차) — 세무사님 "이 업무관리자지침과 각종템플릿 작성이 추후 시스템의 성능을 좌우하게 된다". 사이드바 AI와 같은 이름·같은 실행 함수(Code.js toolListBusinessManagers·toolLoadBusinessManager)
  tools.push({ name: 'list_business_managers', description: '업무관리자 지침 목록(토큰 적음) — 업무관리자 폴더 맨 위 지침의 이름과 한 줄 설명. 이 사건 세목·업무유형에 맞는 지침을 고를 때.',
    input_schema: { type: 'object', properties: {} } });
  tools.push({ name: 'load_business_manager', description: '업무관리자 지침 읽기 — list_business_managers 목록의 이름 하나의 전체 내용(판단 순서·필요 서류·자주 틀리는 곳·근거 조문). 이 사건에 맞는 것만, 보통 한두 개.',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: '목록에 나온 이름 그대로(예: 양도_일시적2주택)' } }, required: ['name'] } });
  // [2026.10.21] 절세 아이템 — 대화창·사이드바 넥스와 같은 이름·같은 실행 함수(KnowHow.js knhTaxItemsSearch_·knhTaxItemRead_, 토큰 0)
  tools.push({ name: 'search_tax_items', description: '절세 아이템 찾기(토큰 0) — NETAX가 정리한 절세·자주 묻는 질문·주요 이슈·함정 아이템 목록(제목·요약·근거 조문·검토 상태·기준일·현행화 필요)에서 찾을 말과 맞는 것. 판단 근거로 쓸 만한 정리가 있는지 볼 때.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, semok: { type: 'string', enum: ['양도', '증여', '상속', '공통'], description: '좁힐 세목(선택)' } }, required: ['query'] } });
  tools.push({ name: 'read_tax_item', description: '절세 아이템 하나 읽기(토큰 0) — 본문·근거 조문·검토 상태·기준일·현행화 필요 이유·조심할 곳·"인용" 줄. 근거로 쓰면 인용규칙을 따르고, 세액을 가르는 조문은 law_lookup으로 원문 확인.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string', description: 'id를 모를 때 아이템 제목' } } } });
  tools.forEach(function (t) { if (t.name === 'value_set') t.input_schema.properties.attach = { type: 'array', items: { type: 'string' }, description: '이 판단의 근거로 쓴 첨부 자료 id(law_attach가 돌려준 id 또는 입구 요약의 첨부 목록 id)' }; });
  tools[tools.length - 1].cache_control = { type: 'ephemeral' };
  return tools;
}
// [2026.10.21 넥스 하나로] 세무사님 원문: "관리든 사건처리든 최상위 ai(이하 "넥스"라 부른다)는 나의 대리인의 자격으로 존재한다"
//  "넥스 하나로 합치는 쪽으로 승인한다. 같은 채팅창내에서의 대화는 어떤 ai라도 모두 공유하는 것으로 알고 있었다"
//  사건 지휘도 채팅창 넥스와 같은 신분 — 같은 기본 지시문(DEFAULT_SYSTEM_PROMPT)과 마스터 프로필(remember_fact로 기억한 지침)을 앞에 둔다.
//  야간 경로 점검(SysAudit.js)은 마스터 프로필을 job 경로에서 이미 보므로 지휘 고유 부분(caseProcAiLiveModeText_)만 본다.
function caseProcAiNexBase_() {
  let master = '';
  try { master = typeof getMasterProfileText_ === 'function' ? getMasterProfileText_() || '' : ''; } catch (e) { master = ''; }
  // [2026.10.21] 최근 바뀐 job 기능(배포 기록 — 대화창 넥스와 같은 글, Federation.js ①) — 사건 지휘 넥스도 새 도구·바뀐 동작을 알게
  let changes = ''; try { changes = typeof commRecentChangesPrompt_ === 'function' ? commRecentChangesPrompt_() : ''; } catch (e) { changes = ''; }
  return DEFAULT_SYSTEM_PROMPT + (master ? '\n\n' + master : '') + changes + '\n\n'
    // [2026.10.30 1단계] 옛 사건 지휘(채팅 밖 따로 돈 넥스)를 지웠다 — 사건 처리는 대화창 넥스가 맡고, 이 바탕 글은 GAS가 넥스를 깨우는 일(미리 읽기·중요한 순간)에만 쓴다
    + '[GAS가 깨운 일 — 같은 넥스] 지금은 세무사님이 부르신 대화가 아니라 GAS가 사건 일로 너를 깨웠다. 위 마스터 프로필은 세무사님의 성향·지침을 알기 위한 것이다 — '
    + '거기 나온 도구 중 아래 목록에 없는 것은 부르지 않는다. 한 일과 세무사님께 드릴 말은 사건 기록·채팅 기록으로 돌아가 같은 넥스(대화창)가 이어 받는다.\n'
    // [2026.10.21] 세무사님 원문: "내가 넥스에게 전체를 맡길때도 있고 부분적으로 맡길때도 있고 아예 맡기지 않고 직접 처리할 때도 있는 것을 모두 감안하라"
    + '[맡긴 범위] 세무사님은 사건을 전체로 맡기기도, 일부만 맡기기도, 직접 처리하기도 한다. (1) 말씀이 범위를 정하면(예: "취득가액만 봐줘", "사건분류만") 그 범위의 자리만 판단하고 나머지 자리는 손대지 않은 채 보고에 "맡기지 않으셔서 두었음"으로 적는다. '
    + '(2) 세무사님이 직접 넣거나 결정한 값(사이드바 확인·세액계산 화면 입력·지난 처리 뒤 고친 값)은 바꾸지 않는다 — 서류와 어긋나 보이면 넣지 말고 질문 메모로 여쭌다. (3) 범위 말씀이 없으면 전체를 맡긴 것으로 본다.\n\n';
}

// ---------- 차례 사이 기억(CacheService — 6시간) ----------
function caseProcAiCtxKey_(caseId) { return 'aiLead:' + caseId; }
function caseProcAiCtxLoad_(caseId) {
  try { const s = CacheService.getScriptCache().get(caseProcAiCtxKey_(caseId)); if (s) return JSON.parse(s); } catch (e) {}
  return { lastItems: null, lookups: [], decisions: [], asks: [], opinions: [], gaps: [], attaches: [], subWon: 0 };
}
function caseProcAiCtxSave_(caseId, ctx) {
  try {
    const keep = Object.assign({}, ctx, { lookups: (ctx.lookups || []).slice(-12), lastItems: (ctx.lastItems || []).slice(0, 60) });
    let s = JSON.stringify(keep);
    if (s.length > 95000) { keep.lastItems = (keep.lastItems || []).slice(0, 25); keep.lookups = keep.lookups.slice(-4); s = JSON.stringify(keep); }
    CacheService.getScriptCache().put(caseProcAiCtxKey_(caseId), s.slice(0, 99000), 21600);
  } catch (e) {}
}

// 보낼 메시지 가리기 — 글 조각마다(생각·생각 가림 블록은 그대로), 도구 입력은 JSON 글로 가린 뒤 되돌림
function caseProcAiMaskMsgs_(messages) {
  const mk = typeof cxMask_ === 'function' ? cxMask_ : caseProcAiMask_;
  const one = function (b) {
    if (typeof b === 'string') return mk(b);
    if (!b || typeof b !== 'object' || b.type === 'thinking' || b.type === 'redacted_thinking') return b;
    const o = Object.assign({}, b);
    if (typeof o.text === 'string') o.text = mk(o.text);
    if (o.type === 'tool_result') o.content = Array.isArray(o.content) ? o.content.map(one) : (typeof o.content === 'string' ? mk(o.content) : o.content);
    if (o.type === 'tool_use' && o.input) { try { o.input = JSON.parse(mk(JSON.stringify(o.input))); } catch (e) {} }
    return o;
  };
  return (Array.isArray(messages) ? messages : []).map(function (m) { return Object.assign({}, m, { content: Array.isArray(m.content) ? m.content.map(one) : one(m.content) }); });
}
// ---------- 모델 한 번 부르기 ----------
// [2026.10.30 비용 기록] costMeta = { kind: '넥스 미리 읽기'|'판단 도구', caseId, caseName, q } — 비용 기록 시트의 종류·사건. 없으면 '판단 도구'(+ 이 실행의 사건)
function caseProcAiCall_(model, system, tools, messages, maxTokens, effort, costMeta) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) return { error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다.' };
  const cfg = MODEL_CONFIG[model];
  if (!cfg) return { error: '모델 표에 없는 모델: ' + model };
  // [2026.10.20 보안 — 세무사님 조건 "AI로 보낼 때 주민·전화·계좌 가림"] 보내기 직전 한 곳에서 한 번 더 가린다(화면·PC가 이미 가렸어도).
  //  모든 글(사용자 글·본문·도구 결과·도구 입력)에 cxMask_(없으면 caseProcAiMask_). 생각 블록은 서명이 있어 그대로 둔다
  messages = caseProcAiMaskMsgs_(messages);
  const payload = { model: model, max_tokens: maxTokens || 3000, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: messages };
  if (tools && tools.length) payload.tools = tools;
  if (cfg.thinkingMode === 'adaptive') { payload.thinking = { type: 'adaptive' }; payload.output_config = { effort: effort || 'medium' }; }
  let res, json;
  for (let i = 0; i < 3; i++) {
    res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(payload) });
    const code = res.getResponseCode();
    try { json = JSON.parse(res.getContentText()); } catch (e) { json = { error: { message: '응답을 읽지 못함(' + code + ')' } }; }
    if (code === 429 || code === 529 || code >= 500) { Utilities.sleep(1500 * (i + 1)); continue; }
    break;
  }
  if (!json || json.error) return { error: (json && json.error && json.error.message) || 'AI 응답 없음' };
  let won = 0;
  // 시험 모드: 비용만 셈(buildClaudeUsageInfo_는 사용량 속성에 쓰고 ai_logPaid_는 기록 파일에 씀 — 둘 다 안 부름)
  if (CASEPROC_AI_DRY_) { const u = json.usage || {}; won = Math.round((((u.input_tokens || 0) * cfg.input + (u.output_tokens || 0) * cfg.output + (u.cache_creation_input_tokens || 0) * cfg.input * 1.25 + (u.cache_read_input_tokens || 0) * (cfg.cacheRead != null ? cfg.cacheRead : cfg.input * 0.1)) / 1e6) * CASEPROC_AI_KRW_ * 10) / 10; return { json: json, won: won }; }
  // [2026.10.30 비용 기록] 유료질문기록의 이름이 옛 "사건처리 AI 지휘"로만 찍혀 무엇에 쓴 돈인지 안 보였다 — 종류(넥스 미리 읽기·판단 도구)로
  const cm = Object.assign({ kind: '판단 도구' }, (typeof AI_COST_CTX_ !== 'undefined' && AI_COST_CTX_) ? { caseId: AI_COST_CTX_.caseId, caseName: AI_COST_CTX_.caseName, convId: AI_COST_CTX_.convId, step: AI_COST_CTX_.step } : {}, costMeta || {});
  try { const u = buildClaudeUsageInfo_(json, cfg, model, null, cm); won = Math.round(u.costUsd * CASEPROC_AI_KRW_ * 10) / 10; ai_logPaid_({ entry: { kind: 'caseproc-ai', model: model, usd: u.costUsd, q: (CASEPROC_AI_DRY_ ? '[시험] ' : '') + cm.kind + (cm.caseName ? ' — ' + cm.caseName : '') } }); } catch (e) {}
  return { json: json, won: won };
}
// 마지막 메시지 끝에 캐시 경계(지난 차례까지 다시 읽기를 싸게)
function caseProcAiCacheMark_(messages) {
  const m = JSON.parse(JSON.stringify(messages || []));
  for (let i = m.length - 1; i >= 0; i--) {
    const c = m[i].content;
    if (Array.isArray(c) && c.length) { const b = c[c.length - 1]; if (b && b.type !== 'thinking' && b.type !== 'redacted_thinking') { b.cache_control = { type: 'ephemeral' }; break; } }
    else if (typeof c === 'string') { m[i].content = [{ type: 'text', text: c, cache_control: { type: 'ephemeral' } }]; break; }
  }
  return m;
}
function caseProcAiText_(json) { return (json.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim(); }

// 좁은 판단·상위 판단 — 도구 없이 한 번, JSON 한 줄 답
function caseProcAiSubJudge_(model, input, effort) {
  const sys = '너는 세무사 사무실의 판단 보조다. 아래 재료(서류 원문 줄·후보)만 보고 물음에 답한다. 재료에 없는 것은 지어내지 않는다. ' +
    '답은 JSON 한 줄로만: {"답":"...","확실":"확실|불확실","근거":"재료의 어느 줄인지 한두 줄"}';
  const q = '[물음]\n' + caseProcAiMask_(String(input.question || '')).slice(0, 600) + (input.options && input.options.length ? '\n[후보]\n' + input.options.slice(0, 10).map(function (o, i) { return (i + 1) + '. ' + caseProcAiMask_(String(o)).slice(0, 160); }).join('\n') : '') + '\n[재료]\n' + caseProcAiMask_(String(input.material || '')).slice(0, 6000);
  const r = caseProcAiCall_(model, sys, null, [{ role: 'user', content: q }], model === CASEPROC_AI_LIGHT_MODEL_ ? 800 : 2500, effort, { kind: '판단 도구', q: String(input.question || '').slice(0, 80) });
  if (r.error) return { text: JSON.stringify({ 오류: r.error }), won: 0 };
  const t = caseProcAiText_(r.json);
  let o = null; try { o = JSON.parse((/\{[\s\S]*\}/.exec(t) || ['{}'])[0]); } catch (e) { o = null; }
  return { text: JSON.stringify(Object.assign({ 맡은AI: model }, o || { 답: caseProcAiCut_(t, 400), 확실: '불확실' })), won: r.won };
}

// ---------- 도구 실행(운영) — AiLead.js caseProcAiExec_를 감싸고, 값 넣기·질문·좁은 판단만 여기서 ----------
function caseProcAiLiveExec_(caseId, name, input, ctx) {
  input = Object.assign({}, input || {}, { caseId: caseId }); // AI가 다른 사건 id를 넣어도 이 사건으로
  if (name === 'quick_judge' || name === 'ask_higher') {
    const r = caseProcAiSubJudge_(name === 'quick_judge' ? CASEPROC_AI_LIGHT_MODEL_ : CASEPROC_AI_HIGH_MODEL_, input, name === 'quick_judge' ? 'low' : 'medium');
    ctx.subWon = (ctx.subWon || 0) + r.won;
    return { text: r.text, won: r.won };
  }
  if (name === 'ask_user' && Array.isArray(input.questions) && input.questions.length) { // [2026.10.28 속도 ⓒ] 질문 여럿을 한 번에(왕복 1)
    const outs = input.questions.slice(0, 12).map(function (q) { let o; try { o = JSON.parse(caseProcAiLiveExec_(caseId, 'ask_user', Object.assign({}, q || {}, { questions: undefined }), ctx).text); } catch (e) { o = { 오류: String(e && e.message || e).slice(0, 80) }; } return o; });
    return { text: JSON.stringify({ ok: true, 묶음: outs.length, 올린질문: outs.reduce(function (s, o) { return s + (Number(o.올린질문) || 0); }, 0), 각각: outs }) };
  }
  if (name === 'ask_user') {
    let ids = (input.itemIds || []).map(String).slice(0, 12);
    // [2026.10.27 G] 이미 세무사님이 정하신 칸은 다시 묻지 않는다(10-27 [71]~[72] "이미 모두 알려줬는데…") — 질문의 칸·새 질문의 target에 세무사님 값이 있으면 그 값을 돌려주고 질문을 올리지 않는다
    const c0 = akReadCase_(caseId), sv0 = c0 ? (caseProcLoad_(caseId) || {}) : {};
    const already = [];
    const settled = function (target) { if (!c0 || !target) return null; let pv = null; try { pv = caseProcPrevValue_(c0, sv0, String(target)); } catch (e) { pv = null; } return pv && pv.who === '세무사님' ? pv : null; };
    ids = ids.filter(function (id) { const it = (ctx.lastItems || []).filter(function (x) { return x.id === id; })[0]; const pv = it && it.ask ? settled(it.ask.target) : null; const dd = sv0.decisions && sv0.decisions[id] && sv0.decisions[id].d; if (pv) { already.push({ 질문: id, 칸: it.ask.target, 세무사님값: caseProcAiMask_(caseProcValueText_(pv.v).slice(0, 80)), 출처: pv.src }); return false; } if (dd === 'done' || dd === '무시') { already.push({ 질문: id, 결정: dd }); return false; } return true; });
    const pvNew = settled(input.target);
    if (pvNew) already.push({ 질문: '(새 질문)', 칸: input.target, 세무사님값: caseProcAiMask_(caseProcValueText_(pvNew.v).slice(0, 80)), 출처: pvNew.src });
    const note = caseProcAiMask_(caseProcAiCut_(input.note || '', 300));
    const newQ = !(input.itemIds || []).length && note && !pvNew; // 질문 목록의 질문이 모두 "이미 정해진 것"으로 걸러졌으면 메모를 새 질문으로 올리지 않는다(같은 물음을 글로 또 묻는 것)
    if (ids.length || newQ) ctx.asks.push({ ids: ids, note: note, urgent: !!input.urgent, target: newQ ? String(input.target || '') : '', label: newQ ? caseProcAiCut_(input.label || '', 40) : '', input: newQ ? String(input.input || '') : '', cands: newQ && Array.isArray(input.cands) ? input.cands.slice(0, 8).map(function (q) { return { v: q && q.v != null ? q.v : '', label: caseProcAiCut_((q && q.label) || '', 60), src: caseProcAiMask_(caseProcAiCut_((q && q.src) || '', 80)) }; }) : [] });
    return { text: JSON.stringify({ ok: true, 올린질문: ids.length + (newQ ? 1 : 0), 언제: input.urgent ? '처리 끝에 맨 위(계산을 막음)' : '처리 끝에 모아서', 이미정해진것: already.length ? already : undefined, 안내: already.length ? '세무사님이 이미 정하신 칸은 묻지 않았다 — 그 값을 그대로 쓰고 보고에 적어라' : undefined }) };
  }
  if (name === 'case_files') { const cf = akReadCase_(caseId); if (!cf) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) }; let r; try { r = caseProcNexFileList_(cf, input || {}); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } return { text: caseProcAiMask_(JSON.stringify(r)).slice(0, 12000) }; } // [2026.10.28 넥스 폭넓은 파일 읽기]
  if (name === 'file_read') { const cf = akReadCase_(caseId); if (!cf) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) }; let r; try { r = caseProcNexFileText_(cf, input || {}); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } ctx.lookups = ctx.lookups || []; ctx.lookups.push({ tool: 'file_read', file: caseProcAiCut_(String((input && input.file) || ''), 80), ok: !!(r && r.ok) }); return { text: caseProcAiMask_(JSON.stringify(r)).slice(0, 14000) }; }
  if (name === 'ledger_read') { const cf = akReadCase_(caseId); if (!cf) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) }; let r; try { r = Object.assign({ ok: true }, ledgerNexBrief_(cf, 5800)); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } return { text: cxMask_(JSON.stringify(r)) }; } // [2026.10.28] 사건 장부 — [2026.10.29 넥스 1] 장부 전체(수만 자)는 6,000자에서 잘려 흐름·질문이 늘 빠졌다 → 요약 묶음(서류 사실은 case_ledger do:facts)
  if (name === 'case_ledger') { let r; try { r = ledgerToolRun_(Object.assign({}, input || {}, { caseId: (input && input.caseId) || caseId }), '넥스'); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } return { text: cxMask_(JSON.stringify(r)) }; }
  if (name === 'set_read_scope') { // [2026.10.27 F]
    ctx.scopeSet = true; // [2026.10.28 결함 L] 이번 처리에서 범위를 정했다 — case_read 허용
    const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
    let r; try { r = caseProcReadScope_(c0, { dirs: input.dirs, files: input.files, ids: Array.isArray(input.ids) ? input.ids : undefined, on: Array.isArray(input.on) ? input.on : undefined, off: Array.isArray(input.off) ? input.off : undefined, clear: !!input.clear, note: caseProcAiCut_(input.why || '', 120), by: '넥스' }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } // [2026.10.28 읽을 대상 ④] on/off 파일 단위
    if (r && r.ok && r.changed && Array.isArray(r.changed.miss) && r.changed.miss.length) { r.없는파일 = r.changed.miss.slice(); r.안내 = '⚠ 목록에 없는 이름 ' + r.changed.miss.length + '개는 켜지도 꺼지지도 않았다(' + r.changed.miss.join(', ') + ') — 보고에 적지 마라. 이름은 case_files 목록 그대로.'; } // [2026.10.28 ⓔ]
    ctx.decisions.push({ at: new Date().toISOString(), itemId: 'readScope', 칸: '읽을 목록', value: input.clear ? '전체' : [(Array.isArray(input.on) && input.on.length ? '켬 ' + input.on.join(',') : ''), (Array.isArray(input.off) && input.off.length ? '끔 ' + input.off.join(',') : ''), (Array.isArray(input.dirs) ? input.dirs.join(',') : '')].filter(Boolean).join(' / ') , basis: 'user', why: caseProcAiMask_(caseProcAiCut_(input.why || '', 120)), sure: '', 결과: r && r.ok ? caseProcAiCut_(r.message || '', 120) + (r.없는파일 ? ' · 없는 파일 ' + r.없는파일.join(',') : '') : '실패 — ' + caseProcAiCut_((r && r.error) || '', 100) });
    return { text: caseProcAiMask_(JSON.stringify(r)).slice(0, 2500) };
  }
  if (name === 'report_tool_gap') {
    ctx.gaps.push({ want: caseProcAiMask_(caseProcAiCut_(input.want, 200)), kind: input.kind || '', tool: input.tool || '', shape: caseProcAiCut_(input.shape || '', 120), instead: caseProcAiCut_(input.instead || '', 120), situation: caseProcAiMask_(caseProcAiCut_(input.situation || '', 300)) }); // [2026.10.21] 막힌 상황(Claude가 재현할 수 있게)
    return { text: JSON.stringify({ ok: true, 기록: '도구 부족으로 남김' }) };
  }
  if (name === 'save_draft') return { text: JSON.stringify({ ok: true, 안내: '처리 끝에 화면이 저장·검토서 초안·현황표를 만든다' }) };
  if (CASEPROC_AI_NO_TOOLS_.indexOf(name) !== -1) { ctx.gaps.push({ want: name + '를 부르려 함 — ' + caseProcAiCut_(JSON.stringify(input.find || input.file || input.phase || ''), 80), kind: '없음', tool: name, auto: true }); return { text: JSON.stringify({ 오류: '이 도구는 없습니다 — issue_bundle·doc_facts·facts_find로 보거나, 안 되면 report_tool_gap 후 질문으로' }) }; }
  if (name === 'case_status') { // [2026.10.22] 넥스 현황 보기 — 남은 질문을 이 차례들의 질문으로 기억(칸 채우기를 다시 돌리지 않고 issue_bundle·value_set을 쓰게)
    const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
    const sv0 = caseProcLoad_(caseId) || {};
    if (!ctx.lastItems && Array.isArray(sv0.remaining) && sv0.remaining.length) { ctx.lastItems = caseProcAiSlimItems_(sv0.remaining); }
    let view = {}; try { view = caseProcNexView_(c0, { withFiles: true }); } catch (e) { view = { 오류: String(e && e.message || e).slice(0, 80) }; }
    let rows = []; try { const st = caseProcStatus_(c0, {}); rows = (st.rows || []).map(function (r) { return r[0] + ' · ' + r[1] + ': ' + r[2] + (r[3] ? ' (' + String(r[3]).slice(0, 80) + ')' : ''); }); } catch (e) { rows = ['반영 현황표를 만들지 못함: ' + String(e && e.message || e).slice(0, 60)]; }
    const dec0 = sv0.decisions || {};
    const q = (sv0.remaining || []).slice(0, 40).map(function (it) { const d = dec0[it.id] && dec0[it.id].d; return it.id + ' | ' + (d ? '(' + d + ') ' : '') + caseProcAiCut_(it.text, 70); });
    // [2026.10.28 속도 A①] 세무사님 "속도문제를 재검토" → "넥스 왕복부터": 첫 응답에 파일 목록(case_files 내용)·의뢰서·사건 폴더 바로 아래 md 메모 본문·미리 읽기 요약(nexRead)을 함께 실어 case_files·file_read 왕복을 없앤다(가상양도26·27 실측 8왕복 중 3~4왕복이 이것). 크기 상한 — 본문은 파일당 3,000자·합계 8,000자, 전체 20,000자 넘으면 본문을 빼고 목록만
    let pack = null;
    try {
      const fl = caseProcNexFileList_(c0, { max: 120 });
      // [2026.10.28 속도 ⓑ — 가상양도28 실측: 첫 응답이 약 100초] 본문 대신 앞 300자(한두 줄 요약 구실), 목록은 이름·폴더·종류(표시는 있을 때만), 전체 6,000자 안 — 본문이 더 필요하면 file_read(같은 차례에 여러 개)
      const list = (fl.파일 || []).map(function (f) { const o = { 파일: f.파일, 폴더: f.폴더 === '(사건 폴더 바로 아래)' ? '' : f.폴더, 종류: f.종류 }; if (f.표시) o.표시 = f.표시; return o; });
      const bodies = []; let used = 0;
      (fl.파일 || []).filter(function (f) { return /사건파악용/.test(f.종류) || (/^\(사건 폴더 바로 아래\)/.test(f.폴더) && /\.(md|txt)$/i.test(f.파일)); }).slice(0, 6).forEach(function (f) {
        if (used >= 1500) return;
        let t = null; try { t = caseProcNexFileText_(c0, { file: (/^\(/.test(f.폴더) ? '' : f.폴더 + '/') + f.파일, len: 500 }); } catch (e) { t = null; }
        if (t && t.ok) { const head = String(t.글 || '').replace(/\s+/g, ' ').trim().slice(0, 300); bodies.push({ 파일: f.파일, 앞부분: head, 글자수: t.글자수 || 0 }); used += head.length; }
      });
      const pre = Object.keys(sv0.nexRead || {}).map(function (k) { const r = sv0.nexRead[k]; return { 파일: r.name, 때: r.at, 요약: r.sum || (r.unread ? '읽지 못함' : '') }; }).slice(0, 30);
      pack = { 파일목록: list, 더있음: !!fl.더있음, 의뢰서_메모_앞부분: bodies, 미리읽기요약: pre };
      ctx.packed = true;
    } catch (e) { pack = { 오류: '파일 목록·본문을 싣지 못함: ' + String(e && e.message || e).slice(0, 80) }; }
    let costLine = ''; try { costLine = aiCostCaseSummary_(caseId).line || ''; } catch (e) { costLine = ''; } // [2026.10.30 비용 기록] 넥스가 "이 사건에 지금까지 ○원"을 말할 수 있게(시트 읽기만, 0원)
    const base = { 반영현황표: rows, 현황: view, 남은질문: q, AI비용: costLine, 안내: '단계에 이미 시각이 있고 새서류가 없으면 case_read를 부르지 않는다. 세무사님 값(누가=세무사님)은 바꾸지 않는다. 남은 일을 한두 줄로 세무사님께 말씀드리듯 정리해 두고 바로 이어 간다. 아래 파일목록·의뢰서_메모_앞부분·미리읽기요약은 이미 실린 것 — case_files로 다시 부르지 마라. 본문이 더 필요한 파일만 file_read(여러 개면 같은 차례에 한꺼번에).' };
    let txt = caseProcAiMask_(JSON.stringify(Object.assign({}, base, pack || {})));
    if (txt.length > 6000 && pack && pack.의뢰서_메모_앞부분) { pack.의뢰서_메모_앞부분 = '(길어서 뺌 — file_read)'; txt = caseProcAiMask_(JSON.stringify(Object.assign({}, base, pack))); }
    if (txt.length > 6000 && pack && pack.미리읽기요약) { pack.미리읽기요약 = '(길어서 뺌 — case_status 현황의 서류변동 참고)'; txt = caseProcAiMask_(JSON.stringify(Object.assign({}, base, pack))); }
    if (txt.length > 6000 && pack && Array.isArray(pack.파일목록)) { pack.파일목록 = pack.파일목록.slice(0, 40).map(function (f) { return f.파일; }); pack.목록줄임 = '파일이 많아 이름만 40개 — 전체는 case_files'; txt = caseProcAiMask_(JSON.stringify(Object.assign({}, base, pack))); }
    // [2026.10.29 넥스 3] 사건 장부 요약을 현황 뒤에 따로 6,000자 안으로 — 현황 묶음(6,000자)을 줄이지 않고, 장부를 따로 부르지 않아도 첫 현황에서 흐름·남은 물음·가설과 다름을 보게
    let lb = ''; try { lb = caseProcAiMask_(JSON.stringify(ledgerNexBrief_(c0, 6000))); } catch (e) { lb = JSON.stringify({ 오류: '장부 요약을 만들지 못함: ' + String(e && e.message || e).slice(0, 80) }); }
    return { text: txt.slice(0, 7000) + '\n\n[사건 장부 요약 — 먼저 본다: 남은물음(가설과다름)·사건개요 가설·확보할증빙_받을것·칸값의 다른값서류는 세무사님과 상의할 거리. 근거 서류 사실은 case_ledger do:facts]\n' + lb.slice(0, 6500) };
  }
  if (name === 'issue_bundle') {
    const it = (ctx.lastItems || []).filter(function (x) { return x.id === input.itemId; })[0];
    if (!it) return { text: JSON.stringify({ 오류: '그 질문이 마지막 칸 채우기에 없음 — calc_fill 먼저' }) };
    const aj = (it.ask && it.ask.aiJudge) || null;
    return { text: caseProcAiMask_(JSON.stringify({ ok: true, 질문: it.text, 자세히: it.detail || '', 후보: ((it.ask && it.ask.cands) || []).slice(0, 8), 쟁점묶음: aj && aj.q ? String(aj.q).slice(0, 2500) : '(묶음 없음 — doc_facts·facts_find로 재료를 찾고, 없으면 report_tool_gap)', 저비용답: aj ? { 값: aj.value, 확실: aj.sure, 근거: aj.why, 모자란정보: aj.need || [] } : null })).slice(0, 4000) };
  }
  if (name === 'value_set') {
    // [2026.10.27 10-27 A] 질문 목록에 없는 확정 칸 — target으로 "칸 값 고치기"(서버 valueFix). 세무사님 값이면 바뀌지 않고 needConfirm이 돌아온다 → ask_user로 여쭌다
    const inItems = (ctx.lastItems || []).some(function (x) { return x.id === input.itemId; });
    if (!inItems && input.target) {
      if (input.sure !== '확실') return { text: JSON.stringify({ ok: false, 반영: '넣지 않음', 이유: '확정 칸 고치기는 sure="확실"일 때만 — 불확실하면 ask_user로 여쭌다' }) };
      const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
      let r; try { r = caseProcValueFix_(c0, { target: String(input.target), value: input.value, by: '넥스', why: caseProcAiCut_(input.why || '', 80) }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      ctx.decisions.push({ at: new Date().toISOString(), itemId: String(input.target), 칸: String(input.target), value: caseProcAiMask_(String(input.value).slice(0, 80)), basis: (input.basis || {}).kind || '', why: caseProcAiMask_(caseProcAiCut_(input.why || '', 120)), sure: input.sure || '', 결과: r && r.ok ? '확정 칸 고침 — ' + caseProcAiCut_(r.message || '', 100) : (r && r.needConfirm ? '세무사님 값 — 바꾸지 않음(여쭘)' : '실패 — ' + caseProcAiCut_((r && r.error) || '', 80)) });
      if (r && r.needConfirm) return { text: JSON.stringify({ ok: false, 반영: '바꾸지 않음(세무사님 값)', 지금값: r.prev, 이유: r.message, 할일: 'ask_user로 지금 값과 서류 값을 함께 여쭙고 끝낸다. 세무사님이 채팅으로 바꾸자고 하시면 채팅 넥스가 caseproc_fix 카드로 바꾼다.' }) };
      return { text: JSON.stringify(r) };
    }
    return { text: JSON.stringify(caseProcAiValueSetLive_(caseId, input, ctx)) };
  }
  if (name === 'close_question') {
    const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
    let r; try { r = caseProcDecide_(c0, { qids: (input.itemIds || []).map(String), d: input.decision || 'done', note: caseProcAiCut_(input.note || '', 200), by: '넥스' }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (r && r.closed && r.closed.length && ctx.lastItems) ctx.lastItems.forEach(function (it) { if (r.closed.indexOf(it.id) !== -1) it.closed = r.d; });
    ctx.decisions.push({ at: new Date().toISOString(), itemId: (input.itemIds || []).join(','), 칸: '질문 닫기', value: input.decision || 'done', basis: '', why: caseProcAiMask_(caseProcAiCut_(input.note || '', 120)), sure: '', 결과: r && r.ok ? '질문 ' + (r.closed || []).length + '건 닫음' : '실패 — ' + caseProcAiCut_((r && r.error) || '', 80) });
    return { text: JSON.stringify(r) };
  }
  if (name === 'calc_scenario') {
    const c0 = akReadCase_(caseId); if (!c0) return { text: JSON.stringify({ 오류: '사건을 찾지 못함' }) };
    let r; try { r = caseProcScenario_(c0, { tax: input.tax, name: caseProcAiCut_(input.name || '', 60), changes: Array.isArray(input.changes) ? input.changes.slice(0, 20) : [], input: input.input && typeof input.input === 'object' ? input.input : undefined, why: caseProcAiCut_(input.why || '', 200), by: '넥스' }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    ctx.decisions.push({ at: new Date().toISOString(), itemId: r && r.id ? String(r.id) : 'scenario', 칸: '경우(안) 계산', value: r && r.ok ? String(r.안) + ' ' + Number(r.최종세액 || 0).toLocaleString('ko-KR') + '원' : '', basis: 'calc', why: caseProcAiMask_(caseProcAiCut_(input.why || '', 120)), sure: '', 결과: r && r.ok ? '저장 ' + String(r.id) : '실패 — ' + caseProcAiCut_((r && r.error) || '', 100) });
    return { text: caseProcAiMask_(JSON.stringify(r)).slice(0, 4000) };
  }
  if (name === 'fact_map') { ctx.loop = ctx.loop || { maps: 0, finds: 0, hits: 0, gaps0: null, gapsN: null }; const fm = caseProcAiFactMap_(akReadCase_(caseId), ctx.lastItems || []); ctx.loop.maps++; if (ctx.loop.gaps0 == null) ctx.loop.gaps0 = fm.빈칸.length; ctx.loop.gapsN = fm.빈칸.length; return { text: caseProcAiMask_(JSON.stringify(fm)).slice(0, 5000) }; }
  if (name === 'doc_find') { ctx.loop = ctx.loop || { maps: 0, finds: 0, hits: 0, gaps0: null, gapsN: null }; const df = caseProcAiDocFind_(akReadCase_(caseId), input); ctx.loop.finds++; if (df.찾음) ctx.loop.hits++; return { text: caseProcAiMask_(JSON.stringify(df)).slice(0, 4000) }; }
  if (name === 'list_business_managers') return { text: JSON.stringify(toolListBusinessManagers()).slice(0, 12000) }; // 지침 하나 약 90자 — 지금 30여 개 3천 자, 대량 작성 중이라 넉넉히
  if (name === 'load_business_manager') return { text: JSON.stringify(toolLoadBusinessManager(input.name)).slice(0, 16000) }; // 지침 한 개 6~9KB — 사건 내용이 아니라 가리기 안 함
  if (name === 'search_tax_items') return { text: JSON.stringify(knhTaxItemsSearch_(input)).slice(0, 8000) }; // [2026.10.21] 절세 아이템(사건 내용 아님 — 가리기 안 함)
  if (name === 'read_tax_item') return { text: JSON.stringify(knhTaxItemRead_(input)).slice(0, 20000) };
  if (name === 'law_decisions') { const c0 = akReadCase_(caseId); return { text: JSON.stringify(typeof aiJudgeForNex_ === 'function' ? aiJudgeForNex_(input.query || '', c0 ? (CASEPROC_TAX_LABEL_[c0.세목] || '').replace(/소득세|세$/g, '') : '') : { 오류: '이 판에 없음' }).slice(0, 8000) }; }
  if (name === 'law_lookup' || name === 'law_search' || name === 'law_attach') return { text: caseProcAiMask_(JSON.stringify(caseProcAiLaw_(caseId, name, input, ctx))).slice(0, 6000) };
  // [2026.10.31 묶음 해체] 예전엔 gas_run 뒤 칸 채우기·계산·서식 도구를 막았다 — 이제 낱개 도구라 넥스가 필요할 때 부른다(막힘 걷음)
  // 그 밖 도구 — 시제품 실행기 그대로(조회 결과·마지막 질문은 차례 사이에 기억)
  if (name === 'calc_fill' && ctx.lastItems) CASEPROC_AI_LAST_ITEMS_[caseId] = ctx.lastItems;
  const before = (CP_SECURED_LOG_ || []).length;
  const x = caseProcAiExec_(caseId, name, input);
  if (name === 'calc_fill' && x.raw && x.raw.items) ctx.lastItems = caseProcAiSlimItems_(x.raw.items);
  try { (CP_SECURED_LOG_ || []).slice(before).forEach(function (l) { ctx.lookups.push({ key: l.key, name: l.name, rows: (l.rows || []).slice(0, 30) }); }); } catch (e) {}
  return { text: x.text };
}
function caseProcAiArr_(x) { return Array.isArray(x) ? x : []; }
// AI가 값을 넣어도 되는 칸 — 값 하나로 끝나는 칸만(세액계산기 칸·기준일·처리개요·상속 금액·분할 귀속 번호).
//  사건 정보 수정(case:)·증빙 표시·폴더 만들기는 되돌리기 어려운 일, 상속 채무 목록·증여 내용은 여러 값이 묶인 칸이라 AI 의견으로만
var CASEPROC_AI_SCALAR_TARGET_RE_ = /^(base|calc:.+|ov:.+|ih:.+|ihdiv:div:.+)$/;
// 질문을 차례 사이에 기억할 만큼만(값 넣을 칸·후보) 줄인다
function caseProcAiSlimItems_(items) {
  return (items || []).slice(0, 60).map(function (it) { const a = it.ask; return { id: it.id, kind: it.kind, text: caseProcAiCut_(it.text, 160), detail: caseProcAiCut_(it.detail || '', 400), ask: a ? { target: a.target, label: a.label, mode: a.mode, input: a.input, route: a.route, aiJudge: a.aiJudge ? { by: a.aiJudge.by, value: a.aiJudge.value, sure: a.aiJudge.sure, why: caseProcAiCut_(a.aiJudge.why || '', 200), need: a.aiJudge.need || [], q: String(a.aiJudge.q || '').slice(0, 1500) } : null, cands: (caseProcAiArr_(a.cands).length ? caseProcAiArr_(a.cands) : caseProcAiArr_(a.options)).slice(0, 12).map(function (q) { return { v: q.v != null ? q.v : (q.value != null ? q.value : q.amount), label: q.label, src: caseProcAiCut_(q.src || '', 80) }; }) } : null }; });
}
// 값 넣기 — 근거 대조 → 확실하면 그 질문의 답으로 실제 반영(caseProc0_ apply — 사이드바 답 기록에는 안 남김), 아니면 🤖 AI 의견으로
function caseProcAiValueSetLive_(caseId, input, ctx) {
  const c = akReadCase_(caseId);
  const items = ctx.lastItems || [];
  const it = items.filter(function (x) { return x.id === input.itemId; })[0];
  if (!it) return { ok: false, 반영: '거절', 이유: '그 질문이 마지막 칸 채우기에 없음(' + input.itemId + ') — calc_fill을 먼저 부르고 질문목록의 id로' };
  CASEPROC_AI_LAST_ITEMS_[caseId] = items;
  CP_SECURED_LOG_ = (ctx.lookups || []).slice();
  const why = caseProcAiMask_(caseProcAiCut_(input.why || '', 120));
  if (CASEPROC_AI_RELATION_RE_.test(String(input.itemId || ''))) { ctx.decisions.push({ at: new Date().toISOString(), itemId: input.itemId, 칸: caseProcAiCut_(it.text, 80), value: '', basis: '', why: '', sure: '', 결과: '특수관계 확인 절차 — 값·의견 없이 근거만 세무사님께' }); return { ok: false, 반영: '넣지 않음', 이유: '특수관계·시가 질문은 세무사님 확인 절차만 — 값도 의견도 붙이지 않는다. 필요하면 ask_user로 그 질문을 고르기만(정황 근거는 질문 글에 이미 있음)' }; }
  const userOnly = CASEPROC_AI_USER_ONLY_RE_.test([input.itemId, it.text, (it.ask || {}).target, (it.ask || {}).label].join(' ')); // 칸 이름(target·라벨)까지 — 질문 글에 낱말이 없어도 막게
  // [밤샘 5번-5 — 실제 AI 3건에서 찾음] AI는 주민번호 등을 가린 꼴(850101-1******)로만 본다 — 가린 값을 넣으려 하면
  //  GAS가 그 질문 후보 중 가린 꼴이 같은 것 하나로 바꾼다(둘 이상이면 못 정함 → 의견으로). 원래 값은 AI에게 보이지 않는다
  if (/\*{3,}/.test(String(input.value))) {
    const mk = typeof cxMask_ === 'function' ? cxMask_ : caseProcAiMask_;
    const same = ((it.ask && it.ask.cands) || []).filter(function (q) { return q.v != null && mk(String(q.v)) === String(input.value); });
    if (same.length === 1) { input = Object.assign({}, input, { value: String(same[0].v), basis: (input.basis && input.basis.kind === 'doc') ? input.basis : { kind: 'cand' } }); }
  }
  // [2026.10.22] 거절 뒤 다시 내기 — 같은 값에 근거만 바꿔 한 칸에 한 번까지. 값을 바꾸어 다시 내는 것은 막는다(지어내기 방지 — 거절을 피하려 값을 맞추지 않게)
  ctx.rejected = ctx.rejected || {};
  const prevRej = ctx.rejected[input.itemId];
  if (prevRej) {
    if (caseProcAiNorm_(input.value) !== caseProcAiNorm_(prevRej.value)) return { ok: false, 반영: '거절', 이유: '이 질문은 앞서 「' + prevRej.value + '」로 거절됨 — 값을 바꾸어 다시 낼 수 없음(근거만 바꾸어 같은 값으로 한 번, 아니면 ask_user로)' };
    if (prevRej.n >= 2) return { ok: false, 반영: '거절', 이유: '이 질문은 이미 두 번 거절됨 — 더 내지 말고 ask_user 질문 메모로' };
  }
  const chk = caseProcAiCheckBasis_(c, input.value, input.basis, input.itemId, caseId);
  const bs = input.basis || {};
  // 다시 낸 것이 통과하면(또는 다시 거절되면) 앞서 붙인 "근거 대조 못 통과" 의견은 지운다 — 질문에 의견이 둘 붙지 않게
  if (prevRej) ctx.opinions = (ctx.opinions || []).filter(function (o) { return !(o.itemId === input.itemId && o.rejected); });
  if (bs.kind === 'infer') ctx.gaps.push({ want: '사실 목록·후보로 안 나오는 값을 추론함 — ' + caseProcAiCut_(it.text, 60), kind: '값을 안 돌려줌', tool: 'facts_find', auto: true });
  ctx.cxItems = ctx.cxItems || [];
  ctx.cxItems.push({ iid: input.itemId, topic: caseProcAiTopic_([input.itemId, it.text, (it.ask || {}).label, (it.ask || {}).target].join(' ')).topic, shape: '총괄|' + (bs.kind || '') + '|' + String((it.ask || {}).target || '').split(':')[0], target: (it.ask || {}).target || '', label: (it.ask || {}).label || caseProcAiCut_(it.text, 60),
    facts: '근거 ' + (bs.kind || '') + (bs.file ? ' · ' + bs.file : '') + (bs.page ? ' · ' + bs.page + '쪽' : '') + (bs.find ? ' · "' + bs.find + '"' : '') + (bs.quote ? ' · "' + String(bs.quote).slice(0, 120) + '"' : '') + (bs.id ? ' · 조회 ' + bs.id : '') + (Array.isArray(input.attach) && input.attach.length ? ' · 법령 근거 ' + input.attach.slice(0, 4).join(', ') : ''),
    cands: ((it.ask && it.ask.cands) || []).slice(0, 6).map(function (q) { return { v: q.v, src: String(q.src || '').slice(0, 100) }; }), answer: String(input.value), why: input.why || '', sure: input.sure || '', need: [] });
  const rec = { at: new Date().toISOString(), itemId: input.itemId, 칸: caseProcAiCut_(it.text, 80), value: caseProcAiMask_(String(input.value).slice(0, 80)), basis: (input.basis || {}).kind || '', why: why, sure: input.sure || '', 근거첨부: (Array.isArray(input.attach) ? input.attach : []).map(String).slice(0, 6) };
  if (!chk.ok) {
    rec.결과 = '거절 — ' + chk.why; ctx.decisions.push(rec);
    ctx.rejected[input.itemId] = { value: String(input.value), n: (prevRej ? prevRej.n : 0) + 1 };
    // [2026.10.22] 세무사님 "1.2고쳐라" ② — 거절된 판단도 그 질문 옆에 🤖 AI 의견으로(넣지 않음). 전엔 보고 글에만 남아 질문에 답할 때 AI가 어떻게 봤는지 안 보였다.
    //  특수관계·시가처럼 세무사님 답으로만 정하는 칸은 위에서 이미 걸러졌다(여기 오지 않음)
    ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: (why ? why + ' — ' : '') + '근거 대조 못 통과: ' + caseProcAiCut_(String(chk.why).split(' — ')[0], 60), sure: '근거 대조 못 통과', rejected: true });
    return { ok: false, 반영: '거절(질문에 AI 의견으로 붙임)', 이유: chk.why, 다시내기: chk.retry && !prevRej ? '같은 값으로 한 번 더 낼 수 있음(근거만 바꾸어)' : '' };
  }
  if (userOnly || input.sure !== '확실' || chk.provisional || input.dryRun) {
    rec.결과 = userOnly ? '세무사님 답으로만 — AI 의견으로 붙임' : '불확실·추론 — AI 의견으로 붙임';
    ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: input.sure || '불확실' });
    ctx.decisions.push(rec);
    return { ok: true, 반영: 'AI 의견(넣지 않음)', 이유: rec.결과 };
  }
  const a = it.ask || {};
  if (CASEPROC_AI_DRY_) { rec.결과 = '시험 — 근거 통과(넣었을 값, 실제로는 안 넣음)'; ctx.decisions.push(rec); return { ok: true, 반영: '시험 — 넣지 않음', 이유: rec.결과 }; }
  if (a.target && (!CASEPROC_AI_SCALAR_TARGET_RE_.test(a.target) || (/^ih(div)?:/.test(a.target) && !/^\d+$/.test(String(input.value).replace(/[,\s원]/g, ''))))) { rec.결과 = '값 하나로 넣을 수 없는 칸(' + a.target.split(':')[0] + ') — AI 의견으로'; ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: input.sure || '' }); ctx.decisions.push(rec); return { ok: true, 반영: 'AI 의견(이 칸은 AI가 직접 못 넣음)', 이유: rec.결과 }; }
  if (!a.target) { rec.결과 = '넣을 칸 정보가 없음 — AI 의견으로'; ctx.opinions.push({ itemId: input.itemId, value: rec.value, why: why, sure: '확실' }); ctx.decisions.push(rec); return { ok: true, 반영: 'AI 의견(넣을 칸 없음)', 이유: rec.결과 }; }
  let r;
  try { r = caseProc0_(Object.assign({ caseId: caseId, step: 'apply', target: a.target, value: input.value, src: ('🤖 AI 판단: ' + why).slice(0, 80), label: a.label || '', ans: { qid: it.id, how: 'AI 판단' } })); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
  rec.결과 = r && r.ok !== false ? '반영 — ' + caseProcAiCut_(r.message || '', 80) : '반영 실패 — ' + caseProcAiCut_((r && r.error) || '', 80);
  if (r && r.ok !== false) caseProcAiMarkApplied_(caseId, { iid: input.itemId, target: a.target, label: a.label || caseProcAiCut_(it.text, 60), v: String(input.value), by: 'ai', model: CASEPROC_AI_DIRECTOR_MODEL_, why: why, sure: '확실', tier: '총괄', cands: ((it.ask && it.ask.cands) || []).slice(0, 6) });
  ctx.decisions.push(rec);
  return { ok: !!(r && r.ok !== false), 반영: r && r.ok !== false ? '넣음(🤖 AI 판단)' : '실패', 이유: (r && (r.message || r.error)) || '', 근거대조: chk.why };
}

// [2026.10.21 넥스 하나로] 첫 글 = GAS 입구 요약 + 세무사님 말씀(채팅창 명령 문장 전체) + 같은 채팅창의 최근 대화 + 지난 처리 요약.
//  세무사님 원문: "같은 채팅창내에서의 대화는 어떤 ai라도 모두 공유하는 것으로 알고 있었다" — 예전엔 GAS 요약 한 장만 받아 "처리하자, 시가는 감정가로" 같은 덧붙인 말이 사라졌다.
//  화면이 보낸 body.userText(명령 문장)·body.chat([{role,text}] 최근 대화, 글만). 길이는 잘라서(대화 6천 자·지난 처리 2천 자) — 비용은 첫 차례 한 번, 이후 차례는 캐시.
// [2026.10.22 넥스가 주인] 첫 글 머리 — 사건 정보만(GAS는 아직 안 돌았다). 넥스가 낱개 도구(case_status·case_read 등)를 골라 부른다

// [2026.10.21 넥스 하나로] 넥스가 GAS 질문 목록에 없는 것을 여쭐 때(ask_user에 itemIds 없이 note만) — 예전엔 화면 어디에도 안 떴다.
//  마지막 지휘 처리의 그런 질문을 처리개요 질문(메모형, 🤖 표시)으로 올린다. 답은 채팅창에 말로 — 같은 채팅 대화가 다음 처리 첫 글로 넥스에게 간다.
function caseProcAiNexAskItems_(c, r) {
  if (!r || !Array.isArray(r.items)) return 0;
  let last = null;
  try { const sv = caseProcLoad_(c.id) || {}; last = (Array.isArray(sv.aiLead) ? sv.aiLead : []).slice(-1)[0] || null; } catch (e) { last = null; }
  if (!last) return 0;
  let n = 0;
  (last.asks || []).forEach(function (a) {
    const note = String((a && a.note) || '').trim();
    if (!note || (a.ids || []).length) return;
    const id = 'nex:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, note, Utilities.Charset.UTF_8)).slice(0, 10);
    if (r.items.some(function (it) { return it.id === id; })) return;
    // [2026.10.27 E] 넣을 칸(target)·후보가 있으면 [확인]에 답 칸이 생긴다(mode input/choose — 그 칸에 바로 들어감). 없으면 note — 화면이 답 글을 받아 넥스에게 넘긴다("확인했음" 단추만 두지 않음)
    const cands = Array.isArray(a.cands) ? a.cands.filter(function (q) { return q && q.v !== '' && q.v != null; }) : [];
    const ask = a.target ? { mode: cands.length ? 'choose' : 'input', target: String(a.target), label: a.label || CASEPROC_FIX_LABELS_[a.target] || a.target, input: a.input === 'select' ? 'text' : (a.input || 'text'), cands: cands, nex: true } : { mode: 'note', nex: true, label: a.label || '넥스 질문' };
    r.items.push(caseProcItem_(id, 'judge', '🤖 넥스가 여쭙니다: ' + caseProcAiCut_(note, 300), ask, (a.urgent ? '계산을 막는 질문입니다. ' : '') + (a.target ? '[확인]에서 값을 고르거나 적으면 「' + ask.label + '」 칸에 바로 들어갑니다.' : '[확인]에서 답을 적으면 넥스가 받아 반영합니다.') + ' 채팅창에 말로 답하셔도 됩니다(' + String(last.at || '').slice(0, 10) + ' 사건 지휘에서 올림).'));
    n++;
  });
  return n;
}

// ---------- step 'turn' — 지휘 AI 한 차례 ----------
//  body: { caseId, messages: [이전 차례들 — 화면이 그대로 들고 옴], entry: 첫 차례 입구 요약, spent: 지금까지 쓴 원, round, items: 첫 차례에만 화면의 마지막 질문 }
// [2026.10.28 결함 L — 가상양도26 운영 확인] 세무사님이 "증여 폴더는 빼고 읽어라" 하셨는데 넥스가 읽고(case_files·file_read) 알고도 set_read_scope 없이 gas_run을 불러 GAS가 증여 서류 3개까지 읽음.
//  GAS 쪽 안전장치(0원): 말씀에 읽을 범위 지시(폴더·파일 + 빼고/제외/말고/만 읽어 류)가 있는데 이번 처리에서 set_read_scope가 안 불린 채 gas_run이 오면 돌리지 않고 "먼저 set_read_scope로"를 돌려준다

// ---------- step 'finish' — 사건 기록(작업일지 한 줄 + 사건처리 저장) + 판단 기록(나중에 GAS로 옮길 재료, 개인정보 가림) ----------

// ---------- [2026.10.19 법령] 첨부 자료 — 입구 요약 한 줄, 조문 보기·예규판례 찾기·첨부(토큰 0) ----------
function caseProcAiAttachLine_(c) {
  const a = (c.법령예규판례 || []).filter(function (e) { return e && e.category !== 'form'; }).slice(-12);
  return a.length ? '첨부된 자료 ' + a.length + '개(먼저 읽고 근거로 쓴다 — 조문 원문은 law_lookup): ' + a.map(function (e) { return '[' + e.category + '|' + e.id + '] ' + caseProcAiCut_(e.제목 || '', 50) + (e.쓸곳 ? ' · 쓸 곳 ' + caseProcAiCut_(e.쓸곳, 30) : '') + ' · ' + (e.첨부 === 'AI' ? 'AI 첨부' : '직접 첨부'); }).join(' / ')
    : '첨부된 자료 없음 — 쟁점 판단에 쓴 조문·예규는 law_lookup·law_search로 찾아 law_attach로 첨부한다.';
}
// 조문 결과(toolLookupStatuteArticle) → 관계법령 모양 글(<개정> 꼬리표 뺌, 줄 끝 두 칸 = 마크다운 줄바꿈 — 화면 📎 첨부와 같은 모양), hang을 주면 그 항만·나머지는 (생략)
function caseProcAiLawText_(r, hang) {
  const u = (r.조문 || [])[0]; if (!u) return '';
  const strip = function (s) { return String(s || '').replace(/\s*<\s*(개정|신설|전문개정|타법개정|본조신설)[^>]*>/g, '').trim(); };
  const hs = u.항 || [], num = function (h) { const m = String(h.항내용 || '').match(/^\s*(?:([①-⑳])|<(\d+)>)/); return !m ? 0 : m[1] ? m[1].charCodeAt(0) - 0x2460 + 1 : +m[2]; }; // 16항부터는 "<16>" 꼴
  const L = hs.length ? [] : [strip(u.조문내용)], ci = function (k) { return k > 15 ? '<' + k + '>' : String.fromCharCode(0x2460 + k - 1); };
  const last = hs.length ? num(hs[hs.length - 1]) : 0, h0 = Number(hang) || 0;
  if (h0 > 1) L.push((h0 > 2 ? '①~' + ci(h0 - 1) : '①') + ' (생략)');
  hs.forEach(function (h) {
    if (h0 && num(h) && num(h) !== h0) return;
    if (h.항내용) L.push(strip(h.항내용));
    (h.호 || []).forEach(function (o) { String(o).split('\n').forEach(function (x, j) { if (x.trim()) L.push((j && /^\s*[가-하]\./.test(x) ? '　　' : '　') + strip(x)); }); });
  });
  if (h0 && last > h0) L.push((last > h0 + 1 ? ci(h0 + 1) + '~' + ci(last) : ci(last)) + ' (생략)');
  return L.filter(Boolean).join('  \n') + '  ';
}
function caseProcAiYmd_(s) { const d = String(s || '').replace(/\D/g, ''); return d.length === 8 ? d.slice(0, 4) + '. ' + Number(d.slice(4, 6)) + '. ' + Number(d.slice(6, 8)) + '.' : String(s || ''); }
function caseProcAiLaw_(caseId, name, input, ctx) {
  const c = akReadCase_(caseId); if (!c) return { 오류: '사건을 찾지 못했습니다.' };
  const base = String(c.기준일 || '').replace(/\D/g, '').slice(0, 8);
  if (name === 'law_search') {
    const r = toolSearchTaxPrecedent(input.category, input.query);
    if (!r || r.error) return { 오류: (r && r.error) || '검색 실패' };
    // 첨부할 때 사건번호·일자를 붙이려고 찾은 목록을 기억해 둔다(토큰 0 — AI에게 다시 묻지 않음)
    const subOf = { precedent: ['사건번호', '선고일자', '법원명'], interpretation: ['안건번호', '회신일자', '질의기관'], administrative_rule: ['행정규칙종류', '발령일자', '소관부처'], tax_tribunal: ['청구번호', '의결일자', '재결구분명'], constitutional: ['사건번호', '종국일자'] }[input.category] || [];
    ctx.found = ctx.found || {};
    (r.results || []).forEach(function (it) { if (it && it.id) ctx.found[input.category + '|' + it.id] = subOf.map(function (k) { return it[k]; }).filter(Boolean).join(' · '); });
    return { 건수: r.totalCount || (r.results || []).length, 목록: (r.results || []).slice(0, 8) };
  }
  if (name === 'law_lookup' || (name === 'law_attach' && input.kind === 'statute')) {
    const r = toolLookupStatuteArticle(input.lawName, input.articleNo, base);
    if (!r || r.error) return { 오류: (r && r.error) || '조문 없음' };
    if (r.부칙) return { 법령: r.법령명, 판: r.판, 부칙: caseProcAiCut_(r.부칙.map(function (b) { return '부칙 <제' + (+b.공포번호) + '호, ' + b.공포일 + '>\n' + b.내용; }).join('\n\n'), 5000), 전체: r.전체 };
    const text = caseProcAiLawText_(r, name === 'law_attach' ? input.hang : 0), u = r.조문[0];
    if (name === 'law_lookup') return { 경고: r.경고 || undefined, 법령: r.법령명, 조: '제' + u.조문번호 + '조' + (u.조문제목 ? '(' + u.조문제목 + ')' : ''), 시행: r.시행일자, 출처: r.출처, 기준일: base || '없음(현행판)', 개정확인: r.개정확인 || '', 판주의: r.판주의 || undefined, 조문: caseProcAiCut_(text, 4500), 산식보정: u.산식보정 || [], 근거아님: u['검증필요_코드에서옮김(근거 아님)'] ? '이 조문 산식 중 코드에서 옮긴 것은 근거 아님' : '' };
    return caseProcAiAttachSave_(c, ctx, { category: 'statute', id: r.법령명 + '|' + u.조문번호 + '|' + (input.hang || ''), 제목: '「' + r.법령명 + '」 제' + String(u.조문번호).replace(/의/, '조의').replace(/^(\d+)$/, '$1조') + (input.hang ? '제' + input.hang + '항' : '') + (u.조문제목 ? '(' + u.조문제목 + ')' : ''),
      요약: caseProcAiCut_(text.replace(/\s+/g, ' '), 300), 법령명: r.법령명, 조: String(u.조문번호), 항: input.hang || '', 판: caseProcAiYmd_(r.시행일자), 기준일판: !!base, 주의: r.경고 || r.판주의 || undefined, 원문: text.slice(0, 6000) }, input); // [2026.10.20] 낡은 연혁 글 판이면 경고·판주의도 첨부에
  }
  if (name === 'law_attach') {
    if (!input.id) return { 오류: '예규·판례는 law_search 목록의 id가 필요합니다.' };
    let d = null; try { d = toolGetTaxPrecedentDetail(input.kind, input.id); } catch (e) { d = null; }
    const pickTxt = function (o) { const k = ['판결요지', '판시사항', '결정요지', '회답', '질의요지', '요지']; for (let i = 0; i < k.length; i++) if (o && o[k[i]]) return String(o[k[i]]); return ''; };
    return caseProcAiAttachSave_(c, ctx, { category: input.kind, id: String(input.id), 제목: caseProcAiCut_(input.title || (d && (d.사건명 || d.안건명 || d.행정규칙명 || d.제목)) || String(input.id), 120), 번호: ((ctx.found || {})[input.kind + '|' + input.id]) || (d && (d.사건번호 || d.안건번호 || d.청구번호)) || '', 요약: caseProcAiCut_(pickTxt(d).replace(/\s+/g, ' '), 400) }, input);
  }
  return { 오류: '모르는 도구' };
}
function caseProcAiAttachSave_(c, ctx, entry, input) {
  entry = Object.assign(entry, { 첨부: 'AI', 확인: false, 쓸곳: caseProcAiMask_(caseProcAiCut_(input.use || '', 60)), 이유: caseProcAiMask_(caseProcAiCut_(input.why || '', 120)), 첨부일: caseProcToday_() });
  const list = (c.법령예규판례 || []).filter(function (e) { return !(e.category === entry.category && e.id === entry.id); });
  const keep = (c.법령예규판례 || []).filter(function (e) { return e.category === entry.category && e.id === entry.id && e.첨부 !== 'AI'; })[0];
  if (keep) return { ok: true, 첨부: '이미 세무사님이 직접 첨부한 자료 — 그대로 둠', id: entry.id };
  if (CASEPROC_AI_DRY_) { ctx.attaches = (ctx.attaches || []).concat([{ id: entry.id, 제목: entry.제목, 쓸곳: entry.쓸곳 }]); return { ok: true, 첨부: '시험 — 저장 안 함', id: entry.id, 제목: entry.제목 }; }
  try { work_updateCase({ id: c.id, 법령예규판례: list.concat([entry]) }); } catch (e) { return { 오류: '첨부 저장 실패: ' + (e && e.message || e) }; }
  ctx.attaches = (ctx.attaches || []).concat([{ id: entry.id, 제목: entry.제목, 쓸곳: entry.쓸곳 }]);
  return { ok: true, 첨부: 'AI 첨부(미확인) — 세무사님이 법령 탭에서 확정하거나 뺀다', id: entry.id, 제목: entry.제목, 판: entry.판 || '' };
}

// 시험 전용 모델 부르기 — kind 'lead'(지휘 AI: 서버가 지침·도구를 붙임, 화면이 준 messages만) / 'sub'(좁은 판단·상위 판단: 물음·재료만)
// ---------- 입구 ----------

// ============================================================
// [2026.10.29 넥스 하나 — 계획서 3판 5단계 "두 입구가 같은 도구 목록과 같은 지시문을 쓴다"]
// 세무사님 원문(10-29): "이 문제는 종전에 해결한다고 하지 않았던가? 또 사기친것인가?" — 20:47 "계획서 3판을 모두 만들었습니다"라고
//  보고했으나 사건 처리 입구는 여전히 따로 짠 도구 22개·비용 상한·"짧게"였다. 이제 🤖 넥스로 처리·"이 사건 처리하자"도 대화창 넥스
//  (callClaude) 하나가 맡는다 — 대화창 도구 전부 + 아래 사건 도구. 사건 도구 실행은 지휘 실행기(caseProcAiLiveExec_)를 그대로 쓰고,
//  [2026.10.31] 넥스 사건 도구는 모두 서버가 바로 실행한다(예전 gas_run·gas_finish를 화면이 돌리던 clientAction case_gas는 없앰).
// ============================================================
// 대화창에 이미 같은 일을 하는 도구가 있거나 대화창에서 뜻이 없는 것 — ask_user(질문은 case_ledger do=ask + 채팅으로 묶어 여쭘)·save_draft(화면 마무리 전용)
// [2026.10.30 1단계 길 정리] 서류 읽기는 file_read(원문) + doc_facts(GAS 정리값) 한 길 — doc_view는 같은 글자 기억을 앞 3천 자만 주고 서류 종류를 GAS 규칙으로 다시 정해
//  의뢰서를 "대출잔액증명서"로 보이게 했다(10-29 운영 시험). 도구 부족 신고는 대화창 report_capability_gap 한 길(사건 연결 땐 사건처리 빠진 도구 기록에도 함께 — Code.js)
var NX_CASE_CHAT_SKIP_ = ['ask_user', 'save_draft', 'report_tool_gap', 'case_ledger', 'list_business_managers', 'load_business_manager', 'search_tax_items', 'read_tax_item', 'doc_view', 'doc_text'];
// [2026.10.30 1단계 보고서 한 길] ✍문서작성 탭의 서버 기능 다섯 가지를 넥스도 쓰게 — 공통원칙 "세무사님만 할 수 있는 화면 동작이 있으면 넥스 대행이 덜 된 것"
//  (쟁점 문단 라이브러리·적용 조문 원문 부록·사건 서류 값·보고서 틀·슬라이드 자문보고서). 화면과 같은 서버 함수를 부른다(토큰 0)
var NX_CASE_REPORT_TOOL_ = { name: 'report_parts', description: '보고서 재료(토큰 0, ✍문서작성 탭과 같은 기능): do=template(label: 보고서 틀 이름 — 자문보고서·종합검토서·개별검토서·불복청구서·요약보고서·진행보고서·검토조서·신고보고서·번역서) 틀 본문 / do=paragraphs 쟁점 문단 라이브러리 목록(세무사님이 다듬은 표준 문단 — 맞는 문단을 가져다 빈칸만 채운다) / do=statutes(laws:[{lawName, articleNo}]) 적용 조문 원문 부록 / do=docfacts 사건 서류 정리 값(문단 빈칸용) / do=slides 슬라이드 자문보고서 틀을 사건 폴더에 만듦 / do=reviewnotes 장부의 추정·받을 증빙·보류 줄과 보류·받을 예정 질문(종합검토서 "확인 필요 사항"에 옮길 것 — 세무사님 작성관리 새 종합검토서와 같은 입구). 보고서 본문은 save_file_to_folder로 사건 폴더에 .md로 저장하면(path는 사건 폴더 기준 — 고객용 path ["보고서_외부"], 내부 검토 ["보고서_내부"]; 어디에 저장됐는지는 결과의 folderPath 그대로 말한다) 자문 장부 보고서 칸에 저절로 적힌다. 쓰기 전에 job_lookup kind=reports(search)로 사무소 기존 보고서 1~2개를 본보기로 읽는다.',
  input_schema: { type: 'object', properties: { do: { type: 'string', enum: ['template', 'paragraphs', 'statutes', 'docfacts', 'slides'] }, label: { type: 'string' }, laws: { type: 'array', items: { type: 'object', properties: { lawName: { type: 'string' }, articleNo: { type: 'string' } } } } }, required: ['do'] } };
function nxCaseReportParts_(caseId, input) {
  const d = String((input && input.do) || '');
  if (d === 'template') { const r = handleGetReportTemplate({ label: String(input.label || '자문보고서') }); return r && r.found === false ? { ok: false, error: '그 이름의 보고서 틀이 없음 — 자문보고서·종합검토서·개별검토서·불복청구서·요약보고서 등' } : r; }
  if (d === 'paragraphs') { const r = rwListParagraphs_(); return r && Array.isArray(r.items) ? Object.assign({}, r, { items: r.items.slice(0, 80) }) : r; }
  if (d === 'statutes') return rwStatuteAppendix_({ laws: input.laws || [] });
  if (d === 'docfacts') return rwCaseDocFacts_({ caseId: caseId });
  if (d === 'reviewnotes') { const c = akReadCase_(caseId); return c ? caseProcReviewNotes_(c) : { ok: false, error: '사건을 찾지 못함' }; } // [2026.10.31 초안 없앰]
  if (d === 'slides') { const c = job_findCase_(caseId); if (!c || !c.폴더ID) return { ok: false, error: '사건 폴더가 없음' }; return handleCreateAdvisorySlideReport({ folderId: c.폴더ID, 고객명: c.고객명 || '', 사건명: c.사건명 || '', 법정일: c.법정일 || '' }); }
  return { ok: false, error: 'do는 template·paragraphs·statutes·docfacts·reviewnotes·slides 중 하나' };
}
function nxCaseChatTools_(haveNames) {
  const have = haveNames || [];
  return caseProcAiLiveTools_().filter(function (t) { return NX_CASE_CHAT_SKIP_.indexOf(t.name) === -1 && have.indexOf(t.name) === -1; })
    .map(function (t) { const c = Object.assign({}, t); delete c.cache_control; return c; }).concat(have.indexOf('report_parts') === -1 ? [NX_CASE_REPORT_TOOL_] : []);
}
function nxCaseChatToolNames_() { return caseProcAiLiveTools_().map(function (t) { return t.name; }).filter(function (n) { return NX_CASE_CHAT_SKIP_.indexOf(n) === -1; }).concat(['report_parts']); }
// 사건 도구 하나 실행(서버) — 차례 사이 기억(ctx)은 지휘와 같은 캐시(6시간)
function nxCaseChatToolRun_(caseId, name, input) {
  if (name === 'report_parts') { let r; try { r = nxCaseReportParts_(caseId, input || {}); } catch (e) { r = { ok: false, error: String(e && e.message || e).slice(0, 200) }; } return JSON.stringify(r); }
  const ctx = caseProcAiCtxLoad_(caseId);
  let x;
  try { x = caseProcAiLiveExec_(caseId, name, input || {}, ctx); } catch (e) { x = { text: JSON.stringify({ 오류: String(e && e.message || e).slice(0, 200) }) }; }
  caseProcAiCtxSave_(caseId, ctx);
  return String((x && x.text) || '');
}
// [2026.10.30 운영 시험(가상조사대응)] 사건이 연결된 대화에서 문서 저장(save_file_to_folder·export_to_google_doc)의 path는 사건 폴더 기준으로 푼다.
//  예전엔 드라이브 맨 위부터 찾아 ["보고서_내부"]가 실패했고, 넥스가 path 없이 다시 저장하자 보고서가 드라이브 맨 위에 떨어졌는데 넥스는 "사건 폴더 아래"라고 보고했다.
//  맨 위부터 준 경로(…/사건폴더/보고서_내부)도 사건 폴더 이름 뒤만 쓴다. 없는 하위 폴더면 저장하지 않고 오류로 알린다(엉뚱한 곳에 떨어지지 않게).
//  돌려줌: {folder, label} / {error} / null(사건 폴더를 못 찾음 — 예전 방식대로)
function nxCaseSaveFolder_(caseId, pathIn) {
  let root = null;
  try { const cr = job_findCase_(caseId); if (cr && String(cr.폴더ID || '').trim()) root = DriveApp.getFolderById(String(cr.폴더ID).trim()); } catch (e) { root = null; }
  if (!root) return null;
  const caseName = root.getName();
  let rel = (Array.isArray(pathIn) ? pathIn : []).map(function (p) { return String(p || '').trim(); }).filter(Boolean);
  const at = rel.indexOf(caseName);
  if (at >= 0) rel = rel.slice(at + 1);
  let f = root;
  for (let i = 0; i < rel.length; i++) {
    const it = f.getFoldersByName(rel[i]);
    if (!it.hasNext()) return { error: '사건 폴더 「' + caseName + '」 안에 「' + rel.slice(0, i + 1).join(' / ') + '」 폴더가 없어 저장하지 않았다. 사건 대화에서 path는 사건 폴더 기준이다(예: ["보고서_내부"], ["보고서_외부"]) — 사건 폴더 바로 아래면 path를 비워라.' };
    f = it.next();
  }
  return { folder: f, label: [caseName].concat(rel) };
}
// [2026.10.30 1단계 계산 한 길] 사건이 연결된 대화에서 넥스가 calculate_* 계산 도구(부담부증여·저가양수·자금출처·가업승계·평가 등 100여 개)를 쓰면
//  그 결과를 사건의 세액계산결과(경우(안) 저장본 — calc_scenario·장부 시험 계산과 같은 저장소)에 남긴다. 예전엔 채팅 답으로만 흘러가 보고서가 인용할 수 없었다.
//  기본 저장본(세무사님 값·확정 입력)은 건드리지 않는다(안 항목은 서식·현황표의 기본 숫자가 되지 않는다).
var NX_CASE_CALC_PAY_KEYS_ = ['납부할세액', '납부세액', '총납부세액', '최종납부세액', '자진납부할세액', '납부할_세액', '결정세액', '산출세액'];
function nxCaseCalcToolSave_(caseId, name, input, resultText) {
  let r = null; try { r = JSON.parse(String(resultText || '')); } catch (e) { return null; }
  if (!r || typeof r !== 'object' || r.error || r.오류) return null;
  const c = job_findCase_(caseId); if (!c) return null;
  const all = Array.isArray(c.세액계산결과) ? c.세액계산결과 : [];
  let pay; NX_CASE_CALC_PAY_KEYS_.some(function (k) { const v = Number(r[k]); if (r[k] != null && Number.isFinite(v)) { pay = v; return true; } return false; });
  const why = String((input && (input.why || input.이유)) || '').slice(0, 200);
  const n = all.filter(function (e) { return e && e.안; }).length + 1;
  let nm = String((input && (input.name || input.안이름)) || '').trim().slice(0, 60) || (name.replace(/^calculate_/, '') + ' 안' + n);
  if (all.some(function (e) { return e && e.안 && e.안.이름 === nm; })) nm += '(' + n + ')';
  const slimIn = JSON.parse(JSON.stringify(input || {})); delete slimIn.why; delete slimIn.name;
  // 저장값은 작게 — 세액계산결과는 사건 행 한 칸(5만 자)에 모두 들어가므로 저장본 하나 2천 자 안팎: 입력 700자, 결과는 숫자·짧은 값 칸만 1,200자까지
  let inText = JSON.stringify(slimIn); if (inText.length > 700) inText = inText.slice(0, 700) + '…';
  const rs = {}; Object.keys(r).forEach(function (k) { const v = r[k]; if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 80)) rs[k] = v; });
  let outText = JSON.stringify(rs); if (outText.length > 1200) outText = outText.slice(0, 1200) + '…';
  const entry = { id: 'tc_' + Date.now(), 세목: name, 구분: '경우(안) 대화창 계산 도구', 요약: ['[경우(안)] ' + nm + ' — 계산 도구 ' + name, why ? '이유: ' + why : ''].filter(Boolean).join('\n'),
    최종세액: Number.isFinite(pay) ? pay : undefined, 계산일: caseProcToday_(), 기준일스냅샷: String(c.기준일 || ''),
    안: { 이름: nm, 세목: name, 바꾼칸: [], 누가: '넥스', 때: caseProcNow_(), 바탕: '대화창 계산 도구 입력', 이유: why },
    저장값: { tool: name, inputs: inText, result: outText } };
  // 같은 도구·같은 입력의 저장본이 이미 있으면 새로 쌓지 않고 그것을 돌려준다(되풀이 계산으로 저장본이 불어나 칸 한도에 닿는 것 막기)
  const dup = all.filter(function (e) { return e && e.저장값 && e.저장값.tool === name && e.저장값.inputs === inText; })[0];
  if (dup) return { 저장본id: dup.id, 안: dup.안 ? dup.안.이름 : '', 최종세액: dup.최종세액, 안내: '같은 입력의 계산이 이미 저장돼 있어 새로 저장하지 않음 — 이 저장본을 인용한다' };
  if (JSON.stringify(all.concat([entry])).length > 45000) return { 저장: '못 함 — 이 사건의 계산 저장본이 사건 칸 한도(5만 자)에 가까움. 세무사님께 오래된 경우(안) 정리를 여쭙고, 이 결과는 보고서에 "저장 안 된 계산"으로 밝힌다' };
  const up = work_updateCase({ id: c.id, 세액계산결과추가: entry /* [2026.10.30] 잠금 안 덧붙이기 — 잇단 저장이 앞 저장본을 덮지 않게 */ });
  if (!up || up.success === false) return { 저장: '실패 — ' + ((up && up.message) || '사건 행을 못 고침') };
  try { caseProcLog_(c.id, { by: '넥스', what: '경우(안) 계산 저장(대화창 계산 도구)', key: entry.id, detail: nm + ' — ' + name + (Number.isFinite(pay) ? ' 세액 ' + pay : '') }); } catch (e) {}
  return { 저장본id: entry.id, 안: nm, 최종세액: Number.isFinite(pay) ? pay : '(결과에 납부세액 칸 없음 — 결과 원문은 저장본에)' };
}
// 사건을 맡은 대화창 넥스의 일하는 방식 — 대화가 사건에 연결돼 있을 때 지시문에 붙는다
function nxCaseChatGuide_(caseId) {
  return '\n\n[사건을 맡은 넥스 — 세무사님의 대리인으로 일하는 방식] (사건ID ' + caseId + ')\n'
    + '세무사님은 국세청 37년(세무조사반장 25년) 출신 세무사로 상속·증여·양도 구조 설계, 세무조사 대응, 불복·경정, 가족법인·가업승계 자문을 하신다. 신고는 그 일의 한 갈래일 뿐이다(세무사님 "내가 신고사건만 처리하려고 이 시스템을 만들었겠나?"). 너는 그 대리인이다 — 맡기신 범위 안에서 세무사님이 직접 하실 일을 같은 도구로 대신 한다.\n'
    + '- 정해진 순서는 없다(세무사님 "gas는 전체가 하나의 틀에 박힌 도구가 아니라 하나하나가 별도의 도구일 뿐"). 사건에 맞게 오가며 한다: 있는 자료 정리(case_status — 장부 요약·자문 장부가 함께 옴, 서류 원문은 file_read, GAS 정리값은 doc_facts, 장부 사실은 case_ledger do=facts; 규칙이 못 뽑은 의뢰 내용은 do=hyp) → 거론된 필지는 case_ledger do=lookup으로 공부 조회(토지대장·토지이용계획·건축물대장·공시가격·조정대상지역·매매사례 — 서류 없이 소재지만 있어도) → 장부 보완(do=set·estimate) → 언제든 시험 계산(do=calc 경우 이름·가정, 다른 세목과 견주기 do=compare, calc_scenario, calculate_* 계산 도구 — 사건이 연결돼 있으면 모두 그 사건의 경우(안) 저장본으로 남는다) → 모자란 서류는 받는 곳([도구]는 직접 조회, [세무사님]·[고객]은 세무사님께)으로 나눠 물을 것과 함께 정리 → 새 사실이 나오면 장부를 고치고 다시.\n'
    + '- 모르는 값에서 멈추지 않는다(세무사님 "양도비용이나 취득비용 같은 것은 증빙이 없어도 충분히 예상액을 가늠하여 잠정치를 반영할 수 있고, 취득가액이나 양도가액도 금액이 특정되지 않으면 잠정금액으로 계산할 수도 있는 것이다. 즉 다양한 경우에 유연하게 대응할 수 있어야 한다"). 근거(시세·공시가격·통상 비율·의뢰 말씀 등)와 산식을 밝힌 잠정치로 case_ledger do=estimate 또는 set(kind 추정)으로 넣고 계산을 이어 간다. 잠정치는 늘 "잠정"과 근거를 함께 보이고, 확인할 것·받을 증빙에 올린다. 확정 신고·서식만 확인된 값으로 낸다. 지어내기 금지는 근거 없이 사실처럼 말하거나 없는 조문·판례·수치를 만드는 것이다.\n'
    // [2026.10.31 H — 할 일 장부 2번 업무별 일하는 법] 담당 AI를 두지 않는 대신(세무사님 "그냥 넥스하나로 충분하다") 업무마다 끝난 모습·먼저 볼 사실·늘 보는 쟁점·대안·도구·위험·여쭐 것·사후관리를 세무사님이 고치시는 지침 한 장으로
    + '- [업무별 일하는 법] 일을 시작하면 이 사건 업무에 맞는 지침을 load_business_manager로 먼저 읽고 그 틀(1 끝난 모습 ~ 8 사후관리)대로 한다 — 넥스_일하는법_양도 / 넥스_일하는법_증여 / 넥스_일하는법_상속 / 넥스_일하는법_세무조사 / 넥스_일하는법_불복경정 / 넥스_일하는법_가족법인. 여러 업무가 섞이면(부담부증여·상속 후 양도·법인전환 등) 해당 장을 모두 읽는다. 장의 "끝난 모습"을 다 채우기 전엔 끝났다고 하지 않는다.\n'
    + '- 자문은 이렇게 한다: 쟁점을 뽑고 → 대안을 스스로 세운다(시기·양도/증여/부담부증여/상속까지 보유·요건 갖추기·법인 등, 조사·불복이면 과세 논리와 대응 논리) → 대안마다 계산 도구로 돌려 경우(안)으로 저장하고 견준다(case_ledger do=compare·calc, 계산기 도구) → 조문(lookup_statute_article·law_lookup)·판례·예규(search_tax_precedent·law_search)·AI 회의 결론(law_decisions)·절세 아이템(search_tax_items)·업무관리자 지침(load_business_manager)으로 근거와 위험(추징·부당행위·이월과세 등)을 붙인다 → 권고를 정한다 → 보고서로 낸다.\n'
    + '- 자문의 뼈대는 자문 장부에 적는다(case_ledger do=advice) — 보고서를 저장하기 전에 쟁점(item 쟁점)·대안마다 하나씩(item 대안, calc에 그 대안의 저장본)·위험(item 위험)·근거(item 근거)를 먼저 적고 권고(item 권고)로 묶는다(장부가 비면 세무사님 화면 📒 ⑥ 자문이 비고 다음 대화가 이어받지 못한다): 쟁점·대안·근거·위험·권고·보고서를 한 줄 제목과 설명으로, 대안·권고에는 견준 계산 저장본 id(calc)를, 근거에는 실재 확인한 조문·판례·지침 이름(refs)을, 서로 이어진 항목은 links로. 숫자는 장부에 적지 않고 저장본으로만 잇는다. 세무사님이 적으신 항목은 바꾸지 않는다. 세무사님이 화면(📒 장부 ⑥ 자문)에서 같은 장부를 보신다.\n'
    // [2026.10.30 복합 자문 — 세무사님 "권하는 안대로"(복합자문사건_개선_계획서)] 문의가 여러 세목에 걸쳐 여러 개인 자문 — 문의를 하나씩 쫓고 세목마다 칸을 연다
    + '- [복합 자문 — 의뢰인 문의가 여러 세목에 걸쳐 여러 개일 때] ① 맨 먼저 의뢰서·의뢰개요(사건 장부 요약)·세무사님 말씀에 있는 문의를 하나도 빼지 않고 하나씩 case_ledger do=advice item=문의로 적는다(title=물으신 것을 원문대로 한 줄, no=물으신 순서, tax=그 문의의 세목 — 둘에 걸치면 둘 다). 문의를 합치거나 바꿔 쓰지 않는다. ② 문의에 나온 세목이 주 세목 말고도 있으면 case_ledger do=taxes(taxes=그 세목들, why=어느 문의 때문인지)로 함께 보는 세목을 정한다 — 그래야 그 세목의 칸·의뢰 메모 추정·받을 증빙·장부 계산(do=calc tax=…)이 열린다. 세무사님이 정하신 목록이면 바꾸지 않는다. ③ 계산 도구는 필요한 세목 분야를 모두 연다(browse_tax_calculators를 세목마다). ④ 쟁점에도 tax를 붙인다. ⑤ 업무가 여럿 섞이면(예: 양도+상속+가족법인) load_business_manager로 그 업무마다 지침을 모두 읽는다. ⑥ 보고서는 자문보고서 틀의 "문의사항별 답변" 절에 문의 번호마다 결론 한두 줄과 "쟁점 ○ 참조"만 쓰고, 풀이는 쟁점별 검토에만 둔다. ⑦ 보고서를 저장하면 저장 결과에 "문의 답 현황"이 붙는다 — 답한 문의는 do=advice item=문의 id status=답함(answer=답 요지)으로, 자료가 없어 답을 못 낸 문의는 status=보류(text=까닭·필요한 자료)로 적는다. 답 안 함이 남은 채 끝내지 않는다.\n'
    + '- 보고서(세무사님 "기존 보고서 모음을 참고하라"): ① job_lookup kind=reports(search에 세목·종류 낱말)로 사무소 기존 보고서 중 같은 세목·같은 종류 1~2개를 골라 read_drive_file로 읽고 구성·어조·깊이를 본보기로 삼는다(고객 이름·숫자는 옮기지 않는다) ② report_parts do=template로 틀(자문보고서·종합검토서·개별검토서·불복청구서 등)을, do=paragraphs로 세무사님이 다듬은 쟁점 문단을, do=statutes로 적용 조문 원문 부록을 가져온다 ③ 세액·비교표는 저장본에서만 인용하고(case_ledger do=cite로 입력·결과 확인) 어느 저장본인지 적는다 — 암산 금지 ④ 잠정치는 "잠정"과 근거, 확인할 것·받을 서류를 보고서에 그대로 밝힌다 ⑤ save_file_to_folder로 사건 폴더에 .md로 저장(path는 사건 폴더 기준 — 고객용 ["보고서_외부"], 내부 검토 ["보고서_내부"]; 저장 위치는 결과의 folderPath 그대로 보고) — 자문 장부 보고서 칸에 저절로 적히니, 인용한 저장본은 do=advice item=보고서 id calc로 잇는다.\n'
    // [2026.10.30] 세무서 제출용 검토조서 — 세무사님 "ai에게 분명히 신고에 첨부할 보고서를 작성하자고 했는데 내부검토보고서 형식으로 작성을 했더라구. 세무서에 신고 참고로 작성하는 것은 달라야 하거든"
    + '- [검토조서 — 세무서에 신고와 함께 내는 문서] 세무사님이 신고에 첨부할·세무서에 낼 보고서를 말씀하시면 그것은 검토조서다(종합검토서·개별검토서·자문보고서 모양으로 쓰지 않는다). ① report_parts do=template label="검토조서"로 틀을 받아 틀 첫머리 작성 안내(세무사님 원문 결정)를 그대로 따른다 — 사무소 기존 보고서는 본보기로 삼지 않는다(세무서 제출 본보기가 아니다) ② 틀의 "양도/증여/상속 시작~끝" 중 사건 세목 하나, "정리용/쟁점용 시작~끝" 중 하나만 남기고 그 표시 줄은 지운다: 쟁점 없이 신고 내용 정리면 정리용, 쟁점(비과세·감면·공제 요건 등)을 근거와 함께 설명하면 쟁점용 ③ 큰 제목 "검토조서", 아래 부제 "- ○○○ ○○세 신고 관련 참고사항 -", 수신 없음, 공문 개조식(~함·~임), 번호는 적지 않고 목록 단계(- / 두 칸 들여 - / 네 칸 들여 -)로 ④ 틀은 가장 복잡한 경우를 다 넣은 풀버전이다 — 이 사건에 해당하는 줄만 채우고 나머지는 아래 단계 줄까지 줄째 지운다("(…이면)·(있으면)" 줄은 해당하면 괄호 머리를 지우고 채움, 해당 없으면 지움, 양도는 "자산" 묶음을 자산마다 하나씩·"합산"은 늘 남김). 틀에 적힌 조문도 이 사건에 맞는지 원문으로 확인. 금액은 계산기 저장본에서만 인용하고 금액마다 산출근거·세부 내역, 공과금·채무 등 여러 건은 건마다 한 줄, 해당 없으면 "없음" ⑤ 반대 해석례는 절대 언급하지 않는다(구별 단락도 없음). 목차·위험도·대안 비교·종전 자문 경위·고객 사정·문의처·잠정치를 넣지 않는다. 사실관계·금액은 사건 폴더 서류에서 확인한 것만 쓴다 — 상담 메모·말씀은 서류가 아니므로 서류로 확인되지 않은 칸은 짐작으로 채우지 말고 [확인 필요]로 둔다. 잠정치·[확인 필요]가 하나라도 남으면 저장하지 말고 받을 서류·확인할 것을 항목별로 묶어 세무사님께 여쭌다 ⑥ 서명은 작성일과 "이음세무컨설팅 세무사 조종호" 한 줄 ⑦ 저장: save_file_to_folder path ["보고서_외부"], 이름 "검토조서.md"(정리용) 또는 "검토조서_쟁점이름.md"(쟁점용, 고객명 넣지 않음). 같은 이름이 이미 있으면 덮어쓰지 않고 다른 쟁점 이름으로 — 세무사님이 그 검토조서를 고치라고 하셨을 때만 overwrite:true ⑧ PDF는 세무사님이 ✍ 문서작성 내려받기 "인쇄용 PDF(A4 여백·쪽마다 머리글)"로 만드신다고 알린다(보기용 PDF는 여백 없음).\n'
    // [2026.10.30 1단계] 옛 사건 지휘 지시문을 지우며 옮겨 온 규칙(원문은 각 줄의 날짜 결정)
    + '- [맡긴 범위] 세무사님은 사건을 전체로·일부만 맡기시거나 직접 처리하신다("내가 넥스에게 전체를 맡길때도 있고 부분적으로 맡길때도 있고 아예 맡기지 않고 직접 처리할 때도 있는 것을 모두 감안하라"). 말씀이 범위를 정하면(예: "취득가액만 봐줘") 그 범위만 하고 나머지는 "맡기지 않으셔서 두었음"으로 적는다. 범위 말씀이 없으면 전체를 맡긴 것으로 본다. 세무사님이 직접 넣거나 정한 값은 바꾸지 않는다 — 어긋나 보이면 여쭌다.\n'
    + '- [파일 읽기] 너는 대리인이라 사건 폴더의 어떤 파일이든 폭넓게 읽는다(case_files로 폴더 파일 목록 보기, file_read로 글 — 체크가 꺼진 파일·산출물·보관 폴더·예규·메모도). 목록 표시 🆕 새 / ✏ 바뀜 / ✓ 전에 읽음(시각) — ✓는 다시 읽지 않는다. GAS가 읽을 파일은 사건마다 체크 목록이 정한다: 체크 목록은 GAS(서류 읽기·칸 채우기·직결)가 읽을 파일을 콕 집어 주는 것이고 너의 읽기를 막지 않는다. 순서: case_files로 폴더 파일 목록 보기 → 모르는 파일은 file_read → 이 사건에 필요한지 판단 → set_read_scope로 GAS에게 체크 목록 지정 → (한꺼번에 읽힐 것이 있으면) case_read.\n'
    + '- [값·질문·근거] 서류로 정한 값은 value_set(근거 서류·쪽·문장)이나 case_ledger do=set(kind 넥스, file·quote·why)으로 넣고, 서류로 풀린 질문은 close_question으로 닫는다(말로만 "해소"라 하면 다음에 또 뜬다). 좁은 판단은 quick_judge(저가), 특례·시가·법령 해석이 갈리면 ask_higher(상위). 쟁점 판단에 쓴 조문·예규·판례는 law_lookup·law_search로 확인하고 law_attach로 사건에 첨부한다. 해석이 갈리는 판단 전엔 law_decisions로 AI 회의 결론을 본다("결정"은 따르고 "판단 대기"면 단정하지 않는다). 판단 전에 list_business_managers·load_business_manager로 이 사건에 맞는 업무관리자 지침을 읽는다.\n'
    // [2026.10.31 묶음 해체] 세무사님 원문(10-29) "의뢰메모만 있다고 하면, 일단 있는 자료를 조리있게 정리를 해야 할 것이고, 거기에 거론된 것들을 다양한 증빙을 확보하여 확인하고 상세하게 사건장부를 보완해 나가고, 그런 과정에서 새로운 내용이 나오면 사건장부를 수정해 나가고"
    + '- [도구는 낱개] GAS 도구는 하나씩 따로 쓴다 — 정해진 순서·묶음은 없다. 늘 쓰는 흐름: 있는 자료 정리(case_status·ledger_read·case_files·file_read) → 서류로 확인(case_read 📖 서류 읽기 — 서류가 안 읽혔거나 새 서류가 있을 때만, 읽은 사실은 장부에 적힘) → 장부 보완(case_ledger do=set·value_set·close_question) → 칸 채우기(calc_fill — 장부 값을 계산기 칸으로, 질문 판정) → 시험 계산(case_ledger do=calc·calc_scenario, 잠정치도) → 모자란 것은 받을 서류·질문으로 요청·여쭘 → 새 사실이 나오면 앞으로 돌아간다. 서식 대조는 forms_check. 종합검토서·자문보고서는 report_parts 틀로 쓰고 장부의 보류·추정·받을 증빙 줄(report_parts do=reviewnotes)을 "확인 필요 사항"에 옮긴다 — 검토서 초안을 만드는 도구는 없다.\n'
    + '- 물을 것은 case_ledger do=ask로 장부 질문에 올리고(사이드바에 뜸), 채팅에서는 항목별로 묶어 여쭌다(개수로 자르지 않는다). 세무사님 값(누가=세무사님)은 바꾸지 않는다. 고객에게 직접 보내는 일은 하지 않는다.\n'
    + '- 맡은 일은 보고서까지 끝까지 한다. 채팅은 세무사님과의 대화가 주이고, GAS가 한 일은 요약만 한다.\n'
    // [2026.10.30 A1] 운영 실측: 넥스가 위험·근거를 적지 않고 "장부 저장 오류로 적지 못했다"고 보고(그 시각 도구 오류 기록 없음), 보고서엔 장부보다 먼저 써서 "적지 못했다"가 남음
    + '- 도구가 실패했다고 말하는 것은 도구가 실제로 오류를 돌려준 경우뿐이다 — 그때는 오류 문구를 그대로 옮긴다. 하지 않은 일을 "오류로 못 했다"고 하지 않는다. 보고서를 저장하면 결과에 [자문 장부 실제 상태]가 붙는다 — 보고서·말의 장부 이야기는 그 숫자에 맞추고, 빈 칸이 있으면 그 자리에서 do=advice로 채운 뒤 보고서를 고친다.\n'
    // [2026.10.30 근거 확인 — 세무사님 "4번 시험사건에 내가 일일이 그런 걸 확인할 시간이 없다" → 계획서 "권하는 안대로"(반박은 넥스 스스로, ❌는 돌려 고치게)]
    + '- 근거는 원문으로 확인된 것만 쓴다. 보고서를 저장하면 GAS가 조문·판례·심판례를 원문과 대조해 저장 결과에 [근거 확인](✅ 실재·❌ 없음·❓ 자동 확인 못 함, 판례·심판례 결론 인용·기각)을 돌려주고 장부 보고서 칸에 적는다 — 글은 네가 쓴 그대로 저장되며 GAS는 고치지 않는다. 문서에 근거 확인표가 필요하면 네가 판단해 넣는다(세무서 제출 검토조서에는 넣지 않는다). ❌는 law_lookup·law_search로 다시 찾아 맞는 근거로 고치거나 빼고 같은 이름으로 다시 저장한다 — 그래도 남으면 세무사님께 채팅으로 그 근거를 그대로 알린다. ❓(국세청 예규 등)는 "자동 확인 못 함"으로 두고 단정하지 않는다. 저장 전 초안은 case_ledger do=check_refs text=…로 미리 확인할 수 있다.\n'
    + '- 판례·심판례는 결론(인용·기각)이 이 사건 주장 방향과 같은지 원문 요지(law_attach가 가져오는 요약)로 확인하고 쓴다 — 반대 결론은 유리한 근거처럼 쓰지 않고 "불리한 선례"로 밝힌다.\n'
    + '- 자문·불복·조사 대응 보고서에는 "예상 반박과 대응" 절을 둔다 — 과세관청(조사관·심판관) 시각에서 이 결론을 깨려는 반박을 결론을 가르는 순서로 세우고, 반박마다 대응 논리와 그 근거(원문 확인한 것)·남는 위험을 적는다. 반박이 이기면 결론·권고를 고친다. 위험은 자문 장부 위험 칸에도 적는다.\n'
    // [2026.10.30 운영 시험(가상상속자문)에서 드러난 버릇] 6~7단계마다 "다음 요청에서 이어가겠다"며 멈춤·"잠정치로 진행해도 될까요?" 허락 구함·의뢰 메모에 있는 가족·사전증여를 다시 물음·증여세 계산기를 "이번엔 못 부른다"며 미룸
    + '- 한 번 맡기시면 이번 차례 안에서 보고서 저장까지 이어 간다(단계 한도는 넉넉하다). "다음 요청에서 이어가겠다"며 멈추지 않는다. "잠정치로 진행해도 될까요?"라고 허락을 구하지 않는다 — 잠정치로 진행하는 것이 세무사님 원칙이다. 물을 것은 보고서의 "추가로 확인할 사항"과 끝 말에 항목별로 묶어 여쭙고, 답이 오면 그 값으로 다시 계산해 보고서를 고친다.\n'
    + '- 의뢰 메모·상담 기록·세무사님 말씀에 이미 있는 사실(가족 구성·나이·재산·대출·사전증여 등)은 다시 묻지 않는다 — "의뢰 말씀 기준(잠정)"으로 쓰고, 서류로 확인할 것은 받을 증빙으로만 올린다. 묻는 것은 말씀에도 서류에도 없는 것과, 결론을 가르는데 말씀이 애매한 것뿐이다.\n'
    + '- 필요한 계산 도구(calculate_*)가 지금 목록에 없으면 browse_tax_calculators(category: transfer·gift·inheritance 등)로 그 분야를 연 뒤 같은 차례에 바로 쓴다 — "이번엔 못 부른다"며 미루지 않는다. 증여·양도·상속을 견주는 자문이면 처음에 필요한 분야를 모두 연다.';
}
