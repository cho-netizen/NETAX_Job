// =========================================================
// [2026.10.19 시제품 — ai-lead 가지 전용, 운영 반영 안 함] "이 사건 처리하자"를 최상위 AI가 GAS 도구를 부려 처리하는 구조
//  설계: netax-inventory/maps/설계_AI지휘_사건처리.md
//  세무사님: "최상위는 ai이다. ai는 나의 대리인이자 비서이자 분신의 자격이 되는 것이다"
//           "그래서 최상위ai가 필요한 도구가 부족하면 추가로 확보해야 하는 것이고, 도구가 호출하는 ai가 정형화되면 역시 도구를 보완해 나가는 것이다"
//           "그래서 끊임없이 적응하고 발전하는 시스템이 되어야 한다는 것이다"
//  이 파일은 지금 caseProc_ 단계를 고치지 않고 감싸기만 한다:
//   · CASEPROC_AI_TOOLS_ — 최상위 AI에게 줄 사건처리 도구 정의(이름은 영문만 가능 — 설명은 한국어)
//   · caseProcAiExec_(caseId, name, input) — 도구 실행. 결과는 AI가 읽기 좋게 짧게 줄이고(caseProcAiSum_*) 개인정보를 가린다(caseProcAiMask_)
//   · caseProcAiCheckBasis_ — 값_정하기(value_set)의 근거 대조: 근거 서류 원문·조회 결과에 그 값이 없으면 거절(지어내기 막기)
//  아직 어디에도 연결하지 않았다(채팅·화면·서버 입구 없음) — 재현기 tools/ailead-replay.js가 이 함수들을 직접 부른다.
// =========================================================
var CASEPROC_AI_SUM_MAX_ = 1500; // 도구 결과 요약 한 번의 목표 글자 수(넘으면 줄을 줄인다)

var CASEPROC_AI_TOOLS_ = [
  { name: 'case_view', description: '사건 보기 — 사건 기본(세목·업무유형·납세자·기준일·법정기한·폴더), 사건파악 가설(출처별), 지난 결정 수, 질문. 처리를 시작할 때 맨 먼저 부른다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  { name: 'docs_read', description: '서류 읽기 — 사건 폴더 서류의 글자를 읽고(무료 글자인식·Vision·한글 등) 종류를 정하고 증빙목록과 대조한다. 오래 걸리면 more=true(화면이 알아서 이어 부르므로 AI는 끝난 요약만 받는다). phase=read는 글자만, 없으면 대조까지.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, phase: { type: 'string', enum: ['read', 'full'] } }, required: ['caseId'] } },
  { name: 'calc_fill', description: '세액계산기 칸 채우기 — 서류 규칙·사실·교차검증으로 계산기 칸을 채우고(공시가격·실거래가 조회 포함), 채운 칸(값·출처)·남은 칸(왜 필요)·미결 쟁점·되돌아갈 힌트·질문을 돌려준다. 새 사실이 생기면 다시 부른다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  { name: 'doc_text', description: '원문 보기 — 서류 한 개의 글자 중 찾을 낱말(또는 값) 앞뒤 몇 줄만. 판독이 갈리거나 근거를 확인할 때. filed=true면 이미 낸 신고서 폴더(양도코리아 등)까지 — 해명·경정·불복 사건의 당초 신고서를 읽을 때만.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, file: { type: 'string', description: '파일 이름 또는 ID' }, find: { type: 'string' }, lines: { type: 'number' }, filed: { type: 'boolean' } }, required: ['caseId', 'file'] } },
  { name: 'doc_facts', description: '서류 정리 결과 — 서류마다 GAS 규칙이 뽑은 값(등기 소유권 이력·가족관계 목록·계약 당사자·대금·통장 거래·공시가격 등)을 표로. 종류(type)·파일·낱말로 좁혀서 부른다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, type: { type: 'string', description: 'registry·family·contract·bank·officialprice·realprice·appraisal·lease 등(비우면 종류별 개수만)' }, file: { type: 'string' }, find: { type: 'string' }, max: { type: 'number' } }, required: ['caseId'] } },
  { name: 'value_set', description: '값 정하기 — 계산기 칸 하나에 값을 넣는다. 근거(basis)가 필수: {kind:"doc", file, find} 서류 원문, {kind:"lookup", id} 공적 조회 결과, {kind:"user"} 세무사님 답, {kind:"cand"} 합계처럼 GAS가 계산해 낸 후보 중 하나를 고를 때(값이 서류에 그대로 없음 — 고른 이유를 why에), {kind:"infer", facts:[…]} 여러 사실로 추론한 값(잠정 — 확인 질문 필수). 근거에 그 값이 없으면 거절된다. AI가 정한 값은 🤖 AI 판단으로 표시된다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, itemId: { type: 'string' }, value: { type: 'string' }, basis: { type: 'object' }, why: { type: 'string' }, sure: { type: 'string', enum: ['확실', '불확실'] }, dryRun: { type: 'boolean' } }, required: ['caseId', 'itemId', 'value', 'basis'] } },
  { name: 'tax_calc', description: '세액 계산 — 세액계산 엔진(화면과 같은 엔진)으로 계산하고 세액 요약을 돌려준다. 답 안 한 입력 질문이 있으면 확정 전 칸을 알린다(잠정 계산 여부는 AI가 정함, 잠정은 저장 안 함).',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, provisional: { type: 'boolean' } }, required: ['caseId'] } },
  { name: 'forms_check', description: '서식 대조 — 세액인쇄 서식 PDF 유무, 참고자료(기신고서)와 차이(참고만).',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  // [2026.10.19 B-5 조견표 세션] 서식을 막는 빈 칸 — calc_fill 다음, ask_user 전에(질문 고르기·urgent 표시에)
  { name: 'form_needs', description: '필요 서식·빈 칸 — 이 사건 세목의 법정서식(본표·부표)마다 칸 수와 값 있음/빈 칸/화면 입력(확인 불가)/계산기에 없음, 서식을 막는 빈 칸 목록(계산기칸·질문id = calc_fill 질문 target과 같은 꼴, 20개까지). 토큰 0.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  { name: 'ask_user', description: '세무사님께 질문 올리기 — 서류로는 알 수 없는 것만. 후보+출처가 있으면 객관식, 없으면 주관식. 답은 다음 차례에 대화로 온다.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, itemIds: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } }, required: ['caseId'] } },
  { name: 'save_draft', description: '저장·초안 — 작업일지 한 줄, 종합검토서 초안, 반영 현황표.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  // ---- [2026.10.19 빠진 도구 — 도구대조 문서 2절] 재료는 1번 cpFacts_(facts-fix)·2번 CrossCheck*.js(crosscheck) — 속 함수는 고치지 않고 감싸기만 ----
  { name: 'facts_find', description: '사실 찾기 — 사건 서류에서 뽑은 사실(1번 사실 목록)을 조건으로 좁혀 표로: 종류(kind 낱말)·자산·사람·날짜 범위·금액 범위. 출처 파일·위치·판독 확신도·사본 표시 포함.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, kind: { type: 'string' }, asset: { type: 'string' }, person: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, limit: { type: 'number' } }, required: ['caseId'] } },
  { name: 'owner_assets', description: '명의 자산 — 그 사람(기본 납세자)이 등기 권리자인 줄(자산·원인·접수일) + 증여·상속 원인이면 바로 앞 권리자. 1세대1주택·상속주택·이월과세 판단 재료(판정은 안 함).',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, person: { type: 'string' } }, required: ['caseId'] } },
  { name: 'contract_list', description: '계약 목록 — 서류 속 매매계약서마다 자산·계약일·잔금일·매매대금·당사자(역할 판독 의심 표시). 이 사건 양도분인지 다른 집 취득인지(일시적 2주택·대체취득)는 판단 몫.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  { name: 'money_links', description: '돈 맞대기 — 계약 대금 회차·영수증 ↔ 통장 줄을 금액·날짜로 짝짓기(같은 돈 한 판정), 짝 없는 돈·금액 불일치. 짝 없는 돈이 무슨 돈인지는 판단 몫.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  { name: 'time_order', description: '시간 순서 — 같은 계약의 계약일≤중도금일≤잔금일, 등기 순위·접수일 순서 모순, 보유기간 경계(1·2·3·10년)를 넘나드는 날짜 후보.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  { name: 'people_roster', description: '사람 명단 — 서류 속 사람(이름·관계·생년·사망·주소·출처)과 같은 사람 판정·어긋남, 상속이면 상속인·재산 명단 맞대기.',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  { name: 'law_checks', description: '법령 갈림길 재료 — 서류 사실로 본 특례·요건 확인 줄(판정 아님, 근거만).',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' } }, required: ['caseId'] } },
  { name: 'public_lookup', description: '공적 조회 — 조건을 정해 다시 조회: kind=official(공시가격, priceKind land/house/apartment, year) · real(매매사례, base 평가기준일, before/after 개월, area ㎡) · building(건축물대장). 결과 전부와 근거키(확보자료 PDF와 같은 근거).',
    input_schema: { type: 'object', properties: { caseId: { type: 'string' }, kind: { type: 'string', enum: ['official', 'real', 'building'] }, loc: { type: 'string' }, priceKind: { type: 'string' }, year: { type: 'number' }, base: { type: 'string' }, before: { type: 'number' }, after: { type: 'number' }, area: { type: 'number' } }, required: ['caseId', 'kind', 'loc'] } },
  { name: 'report_tool_gap', description: '도구 부족 기록 — "이런 도구가 있으면", "이 도구가 이런 값을 안 돌려준다"를 남긴다(고객 이름·주민번호·전화·주소 넣지 말 것). 처리는 그대로 이어간다.',
    input_schema: { type: 'object', properties: { want: { type: 'string' }, kind: { type: 'string', enum: ['없음', '값을 안 돌려줌', '틀림', '느림', '막힘'] }, tool: { type: 'string' }, shape: { type: 'string' }, instead: { type: 'string' } }, required: ['want', 'kind'] } }
];
// [2026.10.19] 지침 초안(maps/작업지시AI_지침초안.md A절)을 그대로 — 블라인드 모의 3건으로 고친 판, 약 3,800자
function caseProcAiSystem_() {
  return [
    "[너는 누구인가]",
    "너는 조종호 세무사님의 대리인·비서·분신으로 이 사건 전체를 맡는다. 무엇을, 언제, 어떤 도구로 할지와",
    "무엇을 보고하고 무엇을 여쭐지는 네가 정한다. 세무사님이 맡긴 권한(아래 [한도]) 안에서는 네가 결정하고,",
    "그 밖은 여쭙는다. 도구(GAS)와 도구 안의 AI는 네 아래에서 일하고 결과·한계·주의를 보고할 뿐이다.",
    "",
    "[일곱 원칙]",
    "1. 최상위는 너다. GAS가 정한 순서를 따르는 것이 아니라, 이 사건에 필요한 일을 네가 고른다.",
    "2. 도구가 모자라면 report_tool_gap에 남긴다. 같은 판단을 되풀이하게 되면 그것도 남긴다(도구로 옮길 후보).",
    "3. 사건마다 배운다. 이번 사건에서 막힌 곳·모자란 재료를 보고에 적는다.",
    "4. 상수는 GAS, 변수는 너. 정해진 규칙으로 되는 일(읽기·조회·계산·대조·저장)은 도구로만 한다.",
    "   너는 규칙으로 정할 수 없는 자리(판단)만 맡는다.",
    "5. 판단할 것이 없으면 아무것도 하지 않는다. 입구(GAS)가 넘긴 \"AI 자리\"가 없으면 계산·저장만 하고 끝낸다.",
    "6. 처음 지시는 GAS가 받을 수도 있다. 너는 GAS 입구가 상수 한 바퀴를 돈 뒤 넘긴 사건을 받는다.",
    "   입구 요약(채운 칸·남은 칸·AI 자리 목록과 이유)부터 본다.",
    "7. 판단마다 수준이 다르다. 네 수준을 넘는 판단(특례가 얽힌 사건분류, 시가 다툼, 법령 해석이 갈리는 것)은",
    "   sure=\"불확실\"로 두고 보고에 \"상위 검토 필요\"라고 적는다.",
    "",
    "[일하는 순서]",
    "0) 업무 성격부터 확인한다. 서류에 해명자료·경정청구·불복·추징예상·당초 신고서가 있으면 작업관리 업무유형(\"신고\")을",
    "   그대로 믿지 말고, 해명·경정·불복이면 당초 신고서를 입력으로 쓰고 세무사님께 업무 성격부터 여쭙는다.",
    "1) case_view로 사건과 입구 요약을 본다. AI 자리 목록을 세 갈래로 나눈다.",
    "   - 재료 없음·못 읽은 서류: 네 일이 아니다(GAS 몫). 보고에 한 줄만 적는다. 다만 못 읽은 서류가 어떤 판단 칸의",
    "     근거라면(예: 증여세 신고서 → 증여 지분 취득가액) \"그 서류를 읽을 수 있게 넣어 주시면 정해짐\"을 그 질문에 묶는다.",
    "   - 서류에 없는 빈 칸(신고 세무비용, 10년 안 사전증여, 영수증 없는 비용 등): 찾지 말고 바로 질문 목록에 넣는다.",
    "   - 판단: 아래 2)부터 네가 한다.",
    "   calc_fill 요약에서 채운 칸의 값(양도가액 등)과 질문 전부를 먼저 확인한다. 질문수와 보인 질문 수가 다르면",
    "   나머지를 받아 본다. 채운 값이 안 보이면 facts_find로 찾는다.",
    "2) 판단은 위에서 아래로 한다. 다른 판단을 정하는 판단을 먼저 한다.",
    "   양도: 자산 성격(주택인가·오피스텔 용도) → 사건분류(1세대1주택·일시적 2주택·중과·감면) →",
    "         취득일·취득가액(취득 원인: 매매·분양·증여·상속) → 비용 → 특수관계·저가양도 → 이월과세.",
    "   증여: 증여일·증여자·관계 → 재산가액(시가 → 보충적 평가) → 10년 합산(직계존속이면 그 배우자 증여도 합산 —",
    "         배우자 이름을 서류에서 찾아 질문에 넣는다) → 특례 신호(등기부 을구로 인수할 채무·보증금이 있으면 부담부,",
    "         세대생략·창업).",
    "   상속: 상속인 명단 → 상속재산(명의·평가) → 사전증여(이체 성격) → 채무·장례비 → 공제.",
    "3) 판단하기 전에 그 칸이 세액을 바꾸는지 먼저 본다(예: 이월과세 기간이 지났으면 관계는 세액에 영향 없음).",
    "   바꾸지 않으면 질문하지 않고 \"영향 없음\"만 적는다.",
    "   판단마다: 재료 도구(facts_find·owner_assets·contract_list·money_links·time_order·people_roster·law_checks·",
    "   public_lookup)로 사실을 모으고, 갈리면 doc_text로 원문을 본 뒤, value_set으로 근거와 함께 넣는다.",
    "4) 서류로 정할 수 없으면 \"무엇을 받으면 정해지는가\"를 질문으로 만든다(예: 취득일 → 등기부등본,",
    "   거주 → 주민등록초본, 특수관계 → 가족관계증명서, 재촌·자경 → 주소·농지 거리·자경 서류).",
    "   정할 수 없는 값이 계산을 막으면 경우를 나눠 tax_calc(provisional=true)로 각각 계산하고 차이를 보고한다.",
    "5) 새 사실이 생기면 calc_fill을 다시 부른다. 남은 칸이 줄었는지 본다.",
    "6) 끝: tax_calc → forms_check → save_draft → 보고.",
    "",
    "[값 넣기 — value_set 근거 다섯 가지]",
    "- doc: 서류 원문에 그 값이 있어야 한다(file, find). 보기를 고르는 판단은 근거 문구를 quote로 준다.",
    "- lookup: 공적 조회 결과에 그 값이 있어야 한다(id).",
    "- cand: 합계·안분처럼 GAS가 계산해 낸 후보 중 하나를 고를 때. 왜 그 후보인지 why에 적는다.",
    "- user: 세무사님 답.",
    "- infer: 후보도 서류 글자도 없는 값을 여러 사실로 추론할 때(예: 두 등기부로 본 가족 관계). 근거 사실 목록을",
    "  붙인다. infer 값은 잠정 계산에만 쓰고, 반드시 확인 질문을 함께 올린다(확정 값으로 저장되지 않음).",
    "근거에 없으면 거절된다. 거절되면 값을 바꾸어 다시 넣지 말고, 원문을 다시 보거나 질문으로 돌린다.",
    "값을 지어내거나 머릿속으로 계산하지 않는다. 세무사님이 넣은 값은 덮어쓰지 않는다.",
    "",
    "[AI 판단 표시]",
    "네가 정한 값에는 why(근거 한두 줄)와 sure(확실/불확실)를 반드시 적는다. 화면에 \"🤖 AI 판단\"으로",
    "표시되고 세무사님이 근거를 보고 바꿀 수 있다. 확실하지 않은 판단을 확실하다고 하지 않는다.",
    "",
    "[질문 방식]",
    "- 서류로 알 수 없는 것만 묻는다. 서류에 있는데 판단이 필요한 것은 네가 판단한다.",
    "- 후보와 출처가 있으면 객관식(⭐는 근거가 있을 때만), 없으면 주관식. 서류가 필요하면 무슨 서류인지 적는다.",
    "- 계산을 막는 질문은 바로, 나머지는 끝에 모아 한 번에. 한 질문으로 여러 칸이 정해지면 그 하나만 묻는다.",
    "- 이미 답한 것은 다시 묻지 않는다.",
    "",
    "[멈출 때]",
    "- 남은 칸이 다 찼을 때, 또는 남은 것이 세무사님만 아시는 것뿐일 때.",
    "- calc_fill을 두 번 연달아 불러도 남은 칸이 줄지 않을 때.",
    "- 같은 도구가 두 번 실패할 때(실패를 보고하고 다른 길이 있으면 그 길로).",
    "- [한도]에 닿을 때: 바퀴 ★14, 사건당 비용 ★(단순 신고 1,000원 / 절세 연구·불복 5,000원).",
    "- 되돌리기 어려운 일(PDF 묶기 적용·폴더 이름 바꾸기·문자 발송·사건 정보 수정)은 하지 않고 ▶실행 카드로 여쭙는다.",
    "",
    "[보고 — 짧게, 세액은 도구 값 그대로]",
    "0. 처리 전에 세무사님이 아셔야 할 사건 밖 사정(수임 관계·기한 지남·업무 성격이 다름 등)이 있으면 맨 앞에.",
    "1. 처리 결과 한 줄(세액 또는 \"계산 전 — 막힌 칸\").",
    "2. 네가 정한 판단: 칸 · 값 · 근거 한 줄 · 확실/불확실.",
    "3. 세무사님께 여쭐 것(계산을 막는 것 먼저).",
    "4. GAS 몫으로 남은 것(못 읽은 서류·재료 없음) 한 줄.",
    "5. 모자랐던 도구(report_tool_gap에 남긴 것) 한 줄. 6. 쓴 비용·바퀴.",
    "",
    "[개인정보]",
    "도구 결과는 주민번호 뒷자리·계좌·전화가 가려져 온다. 보고·도구 부족 기록에 이름·주민번호·주소를 새로 적지 않는다.",
    "",
    "[처리개요·결정의 뜻]",
    "처리개요는 계산기 값의 요약이다. 확인 = 후보를 물어 반영, 보류 = 진행하고 검토서 추가 확인 사항,",
    "무시 = 제외. 기신고서는 참고만 한다. 다만 경정·수정·불복 사건은 당초 신고서가 입력이다."
  ].join('\n');
}

// ---------- 개인정보 가리기 ----------
function caseProcAiMask_(s) {
  return String(s == null ? '' : s)
    .replace(/(\d{6})\s*-\s*([1-8])\d{6}/g, '$1-$2******')
    .replace(/(01[016789])\s*-?\s*\d{3,4}\s*-?\s*(\d{4})/g, '$1-****-$2')
    // 계좌번호: 하이픈으로 끊긴 숫자 묶음 중 숫자가 10자리 이상인 것(날짜 8자리·금액(하이픈 없음)은 그대로) — 끝 4자리만 남김
    .replace(/\b\d{2,6}(?:-\d{2,8}){2,3}\b/g, function (m) { const d = m.replace(/\D/g, ''); if (d.length < 10) return m; let k = 0; const keep = d.length - 4; return m.replace(/\d/g, function (x) { return (k++ < keep) ? '*' : x; }); });
}
// 질문의 후보·선택지 목록 — 배열이 아닌 모양(묶음 객체 등)으로 오는 질문이 있어 늘 배열로
function caseProcAiOpts_(a) { a = a || {}; return Array.isArray(a.cands) && a.cands.length ? a.cands : (Array.isArray(a.options) ? a.options : (Array.isArray(a.cands) ? a.cands : [])); }
function caseProcAiCut_(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// ---------- 요약 ----------
function caseProcAiSumItems_(items, max) {
  return (items || []).slice(0, max || 20).map(function (it) {
    const a = it.ask || {};
    const o = { id: it.id, 종류: it.kind, 글: caseProcAiCut_(it.text, 110) };
    if (it.card) o.카드 = it.card; // 2번 cxAskOrder_ — 세액계산기 카드 순서
    if (a.mode) o.묻는방식 = a.mode;
    const cands = caseProcAiOpts_(a);
    if (cands.length) o.후보 = cands.slice(0, 3).map(function (x) { return caseProcAiCut_((x.v != null ? x.v : x.label) + (x.src ? ' ← ' + x.src : ''), 80); });
    if (cands.length > 3) o.후보수 = cands.length;
    return o;
  });
}
function caseProcAiSumLines_(lines, max) { return (lines || []).slice(0, max || 10).map(function (l) { return caseProcAiCut_(l, 150); }).concat((lines || []).length > (max || 10) ? ['… 외 ' + ((lines || []).length - (max || 10)) + '줄'] : []); }
function caseProcAiSumCase_(c) {
  if (!c) return null;
  const ov = c.사건개요 || {};
  return { 사건: c.사건명, 세목: c.세목, 업무유형: c.업무유형, 납세자: c.납세자, 기준일: c.기준일 || '', 법정일: c.법정일 || '', 처리개요칸수: Object.keys(ov).filter(function (k) { return ov[k] !== '' && ov[k] != null; }).length };
}
// 단계 결과 → AI가 받을 짧은 글(1,500자 안팎). 줄·질문 수를 줄여 가며 맞춘다.
// [지침 모의로 고침] 채운 칸의 값 — 판단(고가주택 여부 등)에 쓰는 값이 요약에 안 보였다. 처리개요 값 + 양도면 계산기 자산별 양도·취득 값
function caseProcAiFilled_(r) {
  const out = [];
  if (!r || !r.case) return out;
  const ov = r.case.사건개요 || {};
  Object.keys(ov).forEach(function (k) { const v = ov[k]; if (v === '' || v == null || typeof v === 'object') return; out.push(k + '=' + caseProcAiCut_(v, 40)); });
  try {
    const tc = (caseProcLoad_(r.case.id) || {}).trCalc;
    if (tc && tc.state && (tc.state.transferAssets || []).length) trcEngineInputs_(tc.state, r.case.기준일).forEach(function (t, i) {
      out.push('자산' + (i + 1) + ': 양도 ' + (t.transferDate || '?') + ' ' + Number(t.transferPrice || 0).toLocaleString('ko-KR') + '원 · 취득 ' + (t.acquisitionDate || '?') + ' ' + Number(t.acquisitionPrice || 0).toLocaleString('ko-KR') + '원 · 경비 ' + Number(t.necessaryExpenses || 0).toLocaleString('ko-KR') + '원 · ' + (t.assetType || ''));
    });
  } catch (e) {}
  return out;
}
function caseProcAiSummarize_(name, r) {
  const build = function (nl, ni) {
    const o = {};
    if (!r || r.error) return { 오류: r ? r.error : '응답 없음', 다시해도됨: true };
    if (r.case) o.사건 = caseProcAiSumCase_(r.case);
    if (r.more) { o.더있음 = true; if (r.progress) o.진행 = caseProcAiCut_(r.progress, 80); }
    if (r.needs) o.필요칸 = { 전체: r.needs.total, 채움: r.needs.filled, 남은칸: (r.needs.missing || []).slice(0, 15), 나중: r.needs.later || undefined };
    if (r.loop) o.되돌아갈힌트 = { 다시읽기: r.loop.again || undefined, 보정할사진: (r.loop.scan || []).length || undefined, 이유: r.loop.why || undefined };
    if (r.files) { const st = {}; r.files.forEach(function (f) { const k = f.status || f.st || (f.read === false ? '못읽음' : '읽음'); st[k] = (st[k] || 0) + 1; }); o.파일 = { 수: r.files.length, 상태별: st }; }
    if (r.docTypes) { const t = {}; r.docTypes.forEach(function (d) { const k = d.l || d.label || d.t || d.type || '미정'; t[k] = (t[k] || 0) + 1; }); o.서류종류 = t; }
    if (r.lines) o.줄 = caseProcAiSumLines_(r.lines, nl);
    if (name === 'calc_fill') { const fl = caseProcAiFilled_(r); if (fl.length) o.채운칸 = fl.slice(0, 16); }
    // [지침 모의로 고침] 질문은 줄여도 목록은 전부(id·종류·짧은 글·후보 수) — 판단 대상 질문이 잘려 안 보이던 문제
    if (r.items) { o.질문수 = r.items.length; o.질문목록 = r.items.map(function (it) { const n = caseProcAiOpts_(it.ask).length; return it.id + ' | ' + it.kind + ' | ' + caseProcAiCut_(it.text, 46) + (n ? ' | 후보 ' + n : ''); }); o.질문 = caseProcAiSumItems_(r.items, ni); }
    ['needCalc', 'needPdf', 'blocked', 'readOnly', 'ok'].forEach(function (k) { if (r[k] !== undefined) o[k] = r[k]; });
    return o;
  };
  try { if (r && Array.isArray(r.items) && r.items.length && typeof cxAskOrder_ === 'function') r = Object.assign({}, r, { items: cxAskOrder_(r.items, (r.case && r.case.세목) || '') }); } catch (e) {}
  let nl = 10, ni = 20, s = '';
  const cap = name === 'calc_fill' ? CASEPROC_AI_SUM_MAX_ * 2 : CASEPROC_AI_SUM_MAX_; // 칸 채우기는 판단의 출발점이라 두 배까지
  for (let i = 0; i < 6; i++) {
    s = caseProcAiMask_(JSON.stringify(build(nl, ni)));
    if (s.length <= cap) break;
    nl = Math.max(2, Math.floor(nl * 0.6)); ni = Math.max(3, Math.floor(ni * 0.6));
  }
  return s;
}

// 정리 결과 객체를 짧게 — 배열은 앞 8줄, 글은 80자, 깊이 3까지
function caseProcAiTrimObj_(v, d) {
  if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return caseProcAiCut_(v, 80);
  if (d >= 3) return '…';
  if (Array.isArray(v)) { const a = v.slice(0, 8).map(function (x) { return caseProcAiTrimObj_(x, d + 1); }); if (v.length > 8) a.push('… 외 ' + (v.length - 8) + '줄'); return a; }
  const o = {}; Object.keys(v).slice(0, 25).forEach(function (k) { if (/^(raw|text|글자|원문|ocr)$/i.test(k)) return; o[k] = caseProcAiTrimObj_(v[k], d + 1); }); return o;
}

// ---------- 근거 대조(value_set) ----------
function caseProcAiNorm_(v) { return String(v == null ? '' : v).replace(/[\s,원]/g, '').replace(/[.\/]/g, '-'); }
function caseProcAiValueForms_(v) {
  const s = String(v == null ? '' : v).trim(), out = [s];
  const n = s.replace(/[,\s원]/g, '');
  if (/^\d{4,}$/.test(n)) { out.push(n, Number(n).toLocaleString('ko-KR')); }
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (d) { out.push(d[1] + '.' + d[2] + '.' + d[3], d[1] + '. ' + Number(d[2]) + '. ' + Number(d[3]), d[1] + '년 ' + Number(d[2]) + '월 ' + Number(d[3]) + '일', d[1] + d[2] + d[3], d[1] + '/' + d[2] + '/' + d[3]); }
  return out.filter(String);
}
function caseProcAiFindFile_(c, ref, filed) {
  // filed: 이미 낸 신고서(양도코리아 등) 폴더까지 — 해명·경정·불복 사건은 당초 신고서가 입력(지침 0)
  const files = caseProcFiles_(c, filed ? { includeFiled: true } : undefined);
  // caseProcFiles_가 묶음 파일을 "… (묶음 2-8).pdf" 조각으로 이미 펼쳐 준다 — 이름 그대로 먼저 찾고,
  //  없으면(원래 이름으로 물었을 때 등) 조각 이름을 뗀 원래 이름으로 한 번 더 찾는다
  const find = function (r) { return files.filter(function (f) { return f.id === r || f.name === r || (f.dir ? f.dir + '/' + f.name : f.name) === r; })[0] || files.filter(function (f) { return r && f.name.indexOf(r) !== -1; })[0] || null; };
  const r0 = String(ref || '').trim();
  return find(r0) || find(r0.replace(/ \(묶음 \d+-\d+\)(\.[A-Za-z0-9]+)$/, '$1'));
}
// 마지막 칸 채우기(calc_fill)의 질문 — 근거 종류 'cand'(GAS가 낸 후보 중 하나인가) 대조에 쓴다
var CASEPROC_AI_LAST_ITEMS_ = {};
function caseProcAiCheckBasis_(c, value, basis, itemId, caseId) {
  basis = basis || {};
  // 합계·안분처럼 GAS가 계산해 낸 후보 값은 어느 서류에도 그대로 나오지 않는다 — 그 질문의 후보 중 하나일 때만 받는다(AI 몫은 '어느 후보인가'를 고르는 것)
  if (basis.kind === 'cand') {
    const it = (CASEPROC_AI_LAST_ITEMS_[caseId || (c && c.id)] || []).filter(function (x) { return x.id === itemId; })[0];
    if (!it) return { ok: false, why: '그 질문이 마지막 칸 채우기에 없음(' + itemId + ') — calc_fill을 먼저' };
    const cs = caseProcAiOpts_(it.ask).map(function (q) { return caseProcAiNorm_(q.v != null ? q.v : q.value != null ? q.value : q.amount); });
    return cs.indexOf(caseProcAiNorm_(value)) !== -1 ? { ok: true, why: 'GAS가 낸 후보 중 하나(계산값) — 고른 이유는 근거 줄로 남김' } : { ok: false, why: 'GAS가 낸 후보에 없는 값 — 지어낸 값일 수 있어 넣지 않음' };
  }
  if (basis.kind === 'user') return { ok: true, why: '세무사님 답' };
  // 추론 값(후보도 서류 글자도 없음 — 여러 사실로 추론): 근거 사실 목록이 있어야 받고, 잠정(질문 필수)으로 표시한다
  if (basis.kind === 'infer') return (Array.isArray(basis.facts) && basis.facts.length) ? { ok: true, why: '추론(잠정) — 근거 사실 ' + basis.facts.length + '개, 확인 질문 필요', provisional: true } : { ok: false, why: '추론 값은 근거 사실 목록(facts)이 필요' };
  if (basis.kind === 'lookup') {
    const hit = (CP_SECURED_LOG_ || []).filter(function (x) { return x.key === basis.id || x.name === basis.id; })[0];
    if (!hit) return { ok: false, why: '그 조회 결과가 이번 처리에 없음(' + basis.id + ')' };
    const forms = caseProcAiValueForms_(value).map(caseProcAiNorm_);
    const ok = hit.rows.some(function (row) { return row.some(function (cell) { return forms.indexOf(caseProcAiNorm_(cell)) !== -1; }); });
    return ok ? { ok: true, why: '조회 결과에 같은 값' } : { ok: false, why: '조회 결과에 그 값이 없음' };
  }
  if (basis.kind === 'doc') {
    const f = caseProcAiFindFile_(c, basis.file);
    if (!f) return { ok: false, why: '근거 서류를 사건 폴더에서 찾지 못함' };
    const t = String(tc_docText_(f) || '');
    if (!t) return { ok: false, why: '근거 서류의 글자가 없음(아직 못 읽음)' };
    const flat = t.replace(/\s+/g, '');
    // 판단형(보기 고르기) 값은 서류에 그대로 안 나온다 — 근거 문구(quote)를 주면 그 문구가 원문에 있는지로 대조한다
    if (basis.quote) { const q = String(basis.quote).replace(/\s+/g, ''); return q.length >= 4 && flat.indexOf(q) !== -1 ? { ok: true, why: '근거 서류 원문에 그 문구', file: f.name } : { ok: false, why: '근거 서류 원문에 그 문구가 없음 — 지어낸 근거일 수 있어 넣지 않음' }; }
    const hit =caseProcAiValueForms_(value).some(function (x) { return x && flat.indexOf(String(x).replace(/\s+/g, '')) !== -1; });
    return hit ? { ok: true, why: '근거 서류 원문에 같은 값', file: f.name } : { ok: false, why: '근거 서류 원문에 그 값이 없음 — 지어낸 값일 수 있어 넣지 않음', file: f.name };
  }
  return { ok: false, why: '근거 종류가 없음(doc·lookup·user 중 하나)' };
}

// ---------- 상수(GAS)·변수(AI) 자리 — 넷째 원칙. 도구마다 안에서 GAS가 정하는 것과 AI(최상위 또는 도구 안 AI)가 정할 자리 ----------
var CASEPROC_AI_TOOL_ROLES_ = {
  case_view: { 상수: '사건 기본·법정기한·날짜 대조', 변수: '사건파악 가설이 서로 다를 때 어느 것이 맞나' },
  docs_read: { 상수: '글자 읽기·서류 종류 규칙·증빙목록 대조', 변수: '처음 보는 서류 종류(저가), 판독이 갈린 글자(저가)' },
  calc_fill: { 상수: '서류 규칙 값·검산·교차검증 일치·법령 정의·필요 칸 지도', 변수: '후보가 갈린 칸(어긋남)·판단 갈림길·빈 칸' },
  doc_text: { 상수: '원문 앞뒤 줄 꺼내기', 변수: '원문을 읽고 어느 값인지 판단' },
  doc_facts: { 상수: '서류별 정리 결과', 변수: '—' },
  facts_find: { 상수: '사실 걸러 내기·사본 표시', 변수: '—(재료)' },
  owner_assets: { 상수: '납세자 명의 등기 줄·앞 권리자', 변수: '1세대1주택·상속주택·이월과세 해당(중간~고급)' },
  contract_list: { 상수: '계약서별 계약일·잔금일·대금·당사자', 변수: '이 사건 양도분인지 다른 집 취득인지, 역할 판독 의심(중간)' },
  money_links: { 상수: '금액·날짜 짝짓기, 같은 돈 한 판정', 변수: '짝 없는 돈이 무슨 돈인지(중간)' },
  time_order: { 상수: '날짜 순서 모순·보유기간 경계', 변수: '큰 날짜 모순이 판독인지 다른 거래인지(중간)' },
  people_roster: { 상수: '같은 사람 판정·명단 맞대기', 변수: '배우자 사망 여부·표기 다른 사람이 같은지(저가~중간)' },
  law_checks: { 상수: '특례 재료·보증금 합 검산', 변수: '특례 해당 판단(고급)' },
  public_lookup: { 상수: '공시가격·매매사례·건축물대장 조회', 변수: '유사사례 고르기·시가 판단(중간~고급)' },
  value_set: { 상수: '근거 대조(서류 원문·조회 결과에 그 값이 있나)', 변수: '—(AI가 정한 값을 받음)' },
  tax_calc: { 상수: '세액 엔진', 변수: '잠정 계산할지(최상위)' },
  form_needs: { 상수: '서식 칸 해설 색인·칸 값 유무 대조', 변수: '—(재료)' },
  forms_check: { 상수: '서식 유무·기신고서 차이', 변수: '—' },
  ask_user: { 상수: '질문 카드 정리', 변수: '무엇을 여쭐지(최상위)' },
  save_draft: { 상수: '저장·초안·현황표', 변수: '—' },
  report_tool_gap: { 상수: '기록', 변수: '무엇이 모자랐나(최상위)' }
};
// 도구 결과에서 "AI가 판단할 자리(변수)"를 센다 — 재현기가 그물 기록·AI 없이 끝날 수 있는지에 쓴다
// '못 읽은 서류'는 AI 자리가 아니다 — 사진 보정·OCR은 GAS(상수) 몫이라 AI 없이 끝날 수 있는지 셀 때 빼고 따로 센다
var CASEPROC_AI_GAS_SPOTS_ = { '못 읽은 서류': true, '재료 없음': true, '상수': true, 'GAS 표 필요': true, '이름으로 종류 앎': true, '참고자료': true };
// [2026.10.19 5번] 조정지역 이력표 재기 스위치 — 세무사님 확인 전에는 false(운영 판정에 쓰지 않음). 재현기 재기에서만 true로 바꾼다
var CASEPROC_AI_ADJ_TRIAL_ = false;
// 계산기 상태의 자산 소재지·취득일·양도일로 이력표를 찾는다 — { ok: 모두 가려졌나, text, noResidence: 거주요건이 없다고 볼 근거(없으면 '') }
function caseProcAiAdjSpot_(raw, caseId) {
  let s = null;
  try { s = ((caseProcLoad_(caseId) || {}).trCalc || {}).state; } catch (e) {}
  const assets = (s && s.transferAssets) || [], cts = (s && s.transferContracts) || [];
  if (!assets.length) return { ok: false, text: '계산기에 자산이 없어 못 찾음 — 소재지·날짜 확인', noResidence: '' };
  const base = String(((raw && raw.case) || {}).기준일 || '');
  const total = cts.reduce(function (t, x) { return t + (Number(x.totalPrice) || 0); }, 0);
  let ok = true, allNo = true;
  const parts = assets.map(function (a, i) {
    const loc = String(a.assetLocation || ''), acq = String(a.acquisitionDate || ''), tr = String((cts[i] || cts[0] || {}).transferDate || base || '');
    const r1 = caseProcAdjAreaAt_(loc, acq, '거주'), r2 = caseProcAdjAreaAt_(loc, tr);
    if (r1.판정 === '확인 필요' || r2.판정 === '확인 필요') ok = false;
    // 거주요건(소득세법 시행령 §154① 단서)은 2017-08-03 이후 취득하면서 취득 당시 조정대상지역이었던 주택에만 붙는다
    if (!(acq && acq < '2017-08-03') && r1.판정 !== '비조정') allNo = false;
    return '자산' + (i + 1) + '(' + (loc ? loc.split(/\s+/).slice(0, 3).join(' ') : '소재지 없음') + '): 취득 ' + (acq || '?') + ' ' + r1.판정 + ' · 양도 ' + (tr || '?') + ' ' + r2.판정 + (r2.판정 === '확인 필요' || r1.판정 === '확인 필요' ? ' [' + (r1.판정 === '확인 필요' ? r1.이유 : r2.이유) + ']' : '');
  });
  return { ok: ok, text: parts.join(' / '), noResidence: allNo && total > 0 && total <= 1200000000 ? '취득 당시 조정대상지역 아님(또는 2017-08-03 전 취득), 양도가액 12억 이하' : '' };
}
function caseProcAiVarSpots_(name, raw, caseId) {
  const out = [];
  if (!raw || raw.error) return out;
  (raw.items || []).forEach(function (it) {
    const a = it.ask || {}, n = caseProcAiOpts_(a).length;
    const why = /^cxt:|모순/.test(it.id + it.text) ? '판독 갈림' : it.kind === 'missing' ? '빈 칸' : (it.kind === 'judge' || a.mode === 'options') ? '판단 갈림길' : n >= 2 ? '어긋남' : it.kind === 'check' ? '어긋남' : '빈 칸';
    // [2026.10.19 시험33 조사] 납세의무자 칸(수증자·양도인)의 후보가 '사건 납세자' 하나뿐이고 서류에서 그 이름을 못 찾은 경우 — 대조할 서류가 없어
    //  AI가 판단할 재료도 없다. AI 자리가 아니라 서류 요청 질문(빈 칸)으로 센다(개발용 5건·시험 23건 되풀이). 이름 대조로 확실히 정하는 GAS 규칙은 아님
    // [2026.10.19 5번 사건분류 쪼개기] 양도 사건분류 질문은 통째로 AI 자리로 세지 않고, 남은 선택지가 기대는 작은 판단으로 나눠 센다:
    //  사용자 사실(세대 주택 수·관계 등 — 서류에 없어 질문) / 변수(오피스텔 실사용·재촌자경·정비사업 감면·상속주택 정황 — AI 해석) / 상수(GAS 몫 — 표·날짜)
    // 양도 사건에만(증여의 '부담부증여(양도 부분)' 같은 낱말에 걸려 증여 사건분류를 버리던 것 — 2026.10.19 재현기)
    const isTr = raw.case ? raw.case.세목 === 'transfer' : /1세대1주택|일시적|비사업용|중과/.test(JSON.stringify(caseProcAiOpts_(a)));
    if (it.id === 'ov:사건분류' && isTr && /주택|토지|양도|수용|이월과세/.test(JSON.stringify(caseProcAiOpts_(a)))) {
      const opts = caseProcAiOpts_(a).map(function (o) { return String(o.label || o.v || o.value || ''); }).join(' | '), det = (String(it.detail || '') + ' ' + String(it.text || '')).split('서류로 해당 없어 뺀 선택지')[0]; // 뺀 선택지 목록(재건축·재개발 등 낱말)을 신호로 읽지 않게
      const subs = [];
      if (/1세대1주택|일시적2주택|2주택 중과|3주택/.test(opts)) {
        // [연결 지점 — 2026.10.19부터 조정지역 판정의 주인은 조견표 세션(reftables 1부-01). 그쪽 판정 함수가 생기면 caseProcAiAdjSpot_의 caseProcAdjAreaAt_ 부름만 바꾼다]
        // [2026.10.19 5번 조정지역 이력표 — 재기 전용] CASEPROC_AI_ADJ_TRIAL_가 켜졌을 때만 AdjArea.js 이력표로 취득·양도 당시 조정대상지역을 가른다(운영 판정에 안 씀)
        const adj = (typeof CASEPROC_AI_ADJ_TRIAL_ !== 'undefined' && CASEPROC_AI_ADJ_TRIAL_ && typeof caseProcAdjAreaAt_ === 'function') ? caseProcAiAdjSpot_(raw, caseId) : null;
        subs.push({ 자리: 'cls:세대주택수', 이유: '빈 칸', 설명: '[사건분류 쪼개기 — 사용자 사실] 양도일 현재 세대 보유 주택 수(납세자 명의는 등기부로, 세대원·다른 집은 세무사님 확인)' });
        if (adj && adj.noResidence) subs.push({ 자리: 'cls:거주기간', 이유: '상수', 설명: '[조정지역 이력표] 거주요건 없음 — ' + adj.noResidence });
        else subs.push({ 자리: 'cls:거주기간', 이유: /초본/.test(det) ? '상수' : '빈 칸', 설명: '[사건분류 쪼개기] 거주기간 — 초본이 있으면 GAS, 없으면 사용자 사실' });
        if (adj) subs.push({ 자리: 'cls:조정대상지역', 이유: adj.ok ? '상수' : '빈 칸', 설명: '[조정지역 이력표] ' + adj.text });
        else subs.push({ 자리: 'cls:조정대상지역', 이유: 'GAS 표 필요', 설명: '[사건분류 쪼개기 — 상수, 아직 표 없음] 취득·양도 당시 조정대상지역(국토교통부 고시 이력)' });
      }
      if (/오피스텔/.test(det)) subs.push({ 자리: 'cls:오피스텔', 이유: '판단 갈림길', 설명: '[사건분류 쪼개기 — 변수] 오피스텔 실제 사용(주거·업무) — 서류 정황 해석' });
      if (/비사업용|자경/.test(opts) && /농지|자경|재촌|답|전 /.test(det)) subs.push({ 자리: 'cls:재촌자경', 이유: '판단 갈림길', 설명: '[사건분류 쪼개기 — 변수] 재촌·자경 정황' });
      if (/현금청산|정비사업|재건축|재개발|입주권/.test(det)) subs.push({ 자리: 'cls:정비사업', 이유: '판단 갈림길', 설명: '[사건분류 쪼개기 — 변수] 정비사업 현금청산·감면(§77) 해당 여부' });
      if (/상속주택|상속받은|피상속인/.test(det)) subs.push({ 자리: 'cls:상속주택', 이유: '판단 갈림길', 설명: '[사건분류 쪼개기 — 변수] 상속주택 특례 요건 정황' });
      if (/특수관계자/.test(opts)) subs.push({ 자리: 'cls:양수인관계', 이유: '빈 칸', 설명: '[사건분류 쪼개기 — 사용자 사실] 양수인과 특수관계인지' });
      if (/이월과세/.test(opts)) subs.push({ 자리: 'cls:이월과세관계', 이유: '빈 칸', 설명: '[사건분류 쪼개기 — 사용자 사실] 증여자와의 관계(기간 안 증여)' });
      if (/당초 신고|수용\(보상금/.test(det) && /수용/.test(opts)) subs.push({ 자리: 'cls:수용', 이유: '상수', 설명: '[사건분류 쪼개기 — 상수] 양도 원인 수용·당초 신고 근거' });
      if (/읽지 못했습니다/.test(det)) subs.length = 0, subs.push({ 자리: 'cls:서류없음', 이유: '빈 칸', 설명: '[사건분류 쪼개기] 사건분류를 가를 서류가 없음 — 사용자 사실(상담 내용)' });
      if (subs.length) { subs.forEach(function (x) { out.push(x); }); return; }
      // 쪼갤 작은 판단이 하나도 안 나오면 버리지 않고 아래 일반 규칙으로 센다(판단 갈림길)
    }
    const c0 = caseProcAiOpts_(a)[0] || {};
    const noDoc = n === 1 && /사건 납세자/.test(String(c0.src || '')) && (it.kind === 'missing' || /서류로는 확인 못|확인 못 함/.test(String(c0.src || '')));
    out.push({ 자리: it.id, 이유: noDoc ? '빈 칸' : why, 설명: (noDoc ? '[서류 없음 → 서류 요청 질문] ' : '') + caseProcAiMask_(caseProcAiCut_(it.text, 110)), 후보수: n, noDoc: noDoc || undefined });
  });
  // 필요 칸(needs.missing)은 대개 같은 칸의 질문(items)으로 이미 나온다 — 칸 이름 앞부분이 어느 질문 글에 있으면 같은 자리로 보고 세지 않는다
  const itemText = (raw.items || []).map(function (it) { return String(it.text || '') + ' ' + JSON.stringify((it.ask || {}).label || ''); }).join(' ');
  if (raw.needs && raw.needs.missing) raw.needs.missing.forEach(function (m) {
    const core = String(m).split(/[(·]/)[0].trim();
    if (core && itemText.indexOf(core) !== -1) return;
    // "자산2 취득가액"처럼 앞에 자산 번호가 붙은 이름: 번호와 칸 이름이 둘 다 같은 질문에 있으면 같은 자리
    const am = /^(자산[0-9]+)[ ]+(.+)$/.exec(core);
    if (am && (raw.items || []).some(function (it) { const t = String(it.text || ''); return t.indexOf(am[1]) !== -1 && t.indexOf(am[2]) !== -1; })) return;
    if (!out.some(function (x) { return x.자리 === 'need:' + m; })) out.push({ 자리: 'need:' + m, 이유: '빈 칸', 설명: '필요 칸 ' + m });
  });
  let cc = null;
  if (raw.docTypes) raw.docTypes.forEach(function (d) {
    var ty = d.t != null ? d.t : d.type; if (ty && !/미정|unknown|other/.test(String(ty) + String(d.l || d.label || ''))) return;
    // 종류를 못 정한 서류: 글자가 없으면 아직 못 읽은 것(GAS 몫), 글자가 있는데 종류를 모르면 처음 보는 서류(AI 몫)
    var txt = '';
    try { if (caseId) { cc = cc || akReadCase_(caseId); var f = caseProcAiFindFile_(cc, d.name || d.file || ''); txt = f ? String(tc_docText_(f) || '') : ''; } else txt = 'x'; } catch (e) { txt = 'x'; }
    const flat = txt.replace(/\s+/g, '');
    // [2026.10.20 밤샘 1바퀴 — 원시서류 종류별] 이름·첫머리 글로 종류가 분명한 서류는 GAS가 정한다(AI 자리 아님) — 값을 뽑는 규칙이 없으면 '입수 구멍'으로 따로
    const kn = flat.length >= 20 ? caseProcAiDocKind_(d.name || d.file || '', txt) : null;
    out.push({ 자리: 'doc:' + (d.name || d.file || ''), 이유: kn ? (kn.ref ? '참고자료' : '이름으로 종류 앎') : (flat.length >= 20 ? '처음 보는 서류' : '못 읽은 서류'), 종류: kn ? kn.kind : undefined, 설명: caseProcAiMask_(caseProcAiCut_(txt, 90)) });
  });
  if (name === 'money_links' && raw.짝없는돈 && raw.짝없는돈.length && raw.통장줄 === 0) out.push({ 자리: 'money:no-bank', 이유: '재료 없음', 설명: '통장 서류가 없어 계약 대금 ' + raw.짝없는돈.length + '회차의 흐름을 확인 못 함 — 필요하면 통장 요청 질문 하나' });
  else if (name === 'money_links' && raw.짝없는돈) raw.짝없는돈.forEach(function (u, i) { out.push({ 자리: 'money:' + i, 이유: '무슨 돈인가', 설명: caseProcAiMask_(caseProcAiCut_(typeof u === 'string' ? u : JSON.stringify(u), 140)) }); });
  if (name === 'contract_list' && /역할 판독 의심/.test(String(raw.목록 || ''))) out.push({ 자리: 'contract:role', 이유: '판독 갈림' });
  return out;
}
// 서류 이름·첫머리 글 → 종류(GAS 규칙). [세무사님 원칙 — 목표는 앞으로 처리할 사건] 낱말은 법정·발급기관 서식의 공식 명칭만(가족관계등록법·주민등록법 증명서, 등기사항증명서·대장, 토지보상법 재결서·손실보상, 금융기관 증명서, 세법 서식) — 이 사무소 파일 이름 버릇은 쓰지 않는다.
//  이름이 다르게 붙은 서류(예: 사진 파일 번호)는 안 맞아 그대로 '처음 보는 서류'(저비용 AI·질문)로 간다 — 잘못 정하지 않고 묻는 쪽으로 넘어감. 위에서부터 처음 맞는 것. ref=참고자료·발생문서(입력 아님). 이름만 맞고 첫머리 글에 그 종류 낱말이 없으면 '이름'으로만 표시
var CASEPROC_AI_DOC_KINDS_ = [
  ['수용·보상', /재결서|보상금|손실보상|협의취득|지장물/], ['계약서', /계약서/], ['가족·주민 서류', /가족관계|기본증명|혼인관계|제적|주민등록|등본|초본/],
  ['등기·대장', /등기|건축물대장|토지대장|공시지가|공시가격/], ['금융 서류', /거래내역|통장|입출금|납입증명|잔액증명|부채증명/],
  ['세금 서류', /세금계산서|합계표|부가가치세|부가세|신고서|납부서|고지서/], ['영수증·비용', /영수증|견적서|청구서|계산서/],
  // 참고자료는 법령·해석 문서의 공식 명칭만(이름으로만 — 본문에 나오는 낱말로는 안 정함). 사무소 파일 이름 버릇(요구자료·메모·상담·세무사님께 등)은 쓰지 않는다 —
  //  고객이 보낸 편지·상담 메모는 사실이 든 서류라 참고로 빼면 안 되고, 사무소가 만든 결과물은 기존 발생문서 판정(caseProcIsOutputDocFor_)이 맡는다
  ['참고(법령·해석)', /시행령|시행규칙|법률|예규|판례|해석례|질의회신|심판례|결정례/, 1]
];
function caseProcAiDocKind_(name, txt) {
  const n = String(name || '').replace(/.[A-Za-z0-9]+$/, ''), head = String(txt || '').replace(/s+/g, '').slice(0, 300);
  for (let i = 0; i < CASEPROC_AI_DOC_KINDS_.length; i++) { const k = CASEPROC_AI_DOC_KINDS_[i]; if (k[1].test(n) || (!k[2] && k[1].test(head))) return { kind: k[0], ref: !!k[2], by: k[1].test(head) ? '첫머리 글' : '이름' }; }
  return null;
}
// 1번 사실 목록·2번 교차검증 재료 도구 — 결과는 짧게(근거 파일·위치 포함), 판정은 하지 않는다
function caseProcAiFactTool_(caseId, name, input) {
  const c = akReadCase_(caseId);
  if (typeof cxFacts_ !== 'function') return { error: '교차검증 재료(CrossCheck*.js)가 이 판에 없음' };
  const facts = cxFacts_(c) || [];
  const srcOf = function (f) { const s = f.src || {}; return caseProcAiCut_((s.file || '') + (s.where ? ' ' + s.where : ''), 70); };
  if (name === 'facts_find') {
    const q = input || {}, n = Math.min(Number(q.limit) || 12, 25);
    const num = function (f) { const v = typeof f.value === 'number' ? f.value : Number(String(f.value || '').replace(/[,원\s]/g, '')); return isNaN(v) ? null : v; };
    const hit = facts.filter(function (f) {
      if (q.kind && String(f.kind || '').indexOf(q.kind) === -1) return false;
      if (q.asset && JSON.stringify(f.keys || {}).indexOf(q.asset) === -1 && String(f.raw || '').indexOf(q.asset) === -1) return false;
      if (q.person && JSON.stringify(f.keys || {}).indexOf(q.person) === -1 && String(f.raw || '').indexOf(q.person) === -1) return false;
      const d = (f.keys && f.keys.date) || ''; if (q.from && (!d || d < q.from)) return false; if (q.to && (!d || d > q.to)) return false;
      const v = num(f); if (q.min != null && (v == null || v < q.min)) return false; if (q.max != null && (v == null || v > q.max)) return false;
      return true;
    });
    const kinds = {}; facts.forEach(function (f) { kinds[f.kind] = (kinds[f.kind] || 0) + 1; });
    return { ok: true, 전체사실: facts.length, 찾음: hit.length, 사실: hit.slice(0, n).map(function (f) { return { 종류: f.kind, 값: caseProcAiTrimObj_(f.value, 1), 역할: f.role || undefined, 출처: srcOf(f), 확신: (f.read && (f.read.conf || f.read.check)) || undefined, 사본: f._copy ? '사본' : undefined }; }), 종류별: q.kind ? undefined : Object.keys(kinds).slice(0, 30).reduce(function (o, k) { o[k] = kinds[k]; return o; }, {}) };
  }
  if (name === 'owner_assets') return { ok: true, 목록: cxOwnerAssets_(facts, input.person || c.납세자 || c.고객명) || '(명의 등기 줄 없음)' };
  if (name === 'contract_list') return { ok: true, 목록: cxContractList_(facts) || '(매매계약서 없음)' };
  if (name === 'money_links') {
    const m = cxMoneyLinks_(facts, { c: c }) || {};
    const row = function (x) { return caseProcAiCut_(typeof x === 'string' ? x : JSON.stringify(x), 140); };
    // 통장 줄 수 — 0이면 짝 없는 돈은 판단할 재료가 없는 것(AI 자리 아님, "통장 없음" 알림)
    let bankN = 0; try { bankN = (typeof cxmtBankLines_ === 'function' ? cxmtBankLines_(facts) : []).length; } catch (e) { bankN = -1; }
    return { ok: true, 통장줄: bankN, 묶음수: m.groups, 짝맞음: (m.linked || []).length, 금액불일치: (m.mismatch || []).slice(0, 6).map(row), 짝없는돈: (m.unlinked || []).slice(0, 8).map(row), 참고: (m.info || []).slice(0, 4).map(row) };
  }
  if (name === 'time_order') { const t = cxTimeOrder_(facts, { c: c }) || {}; return { ok: true, 줄: caseProcAiSumLines_(t.lines || [], 10), 질문수: (t.items || []).length, 질문: caseProcAiSumItems_(t.items || [], 6) }; }
  if (name === 'people_roster') {
    const p = cxPersonChecks_(c, facts) || {}, e = c.세목 === 'inheritance' ? (cxEstateRoster_(c, facts) || {}) : {};
    return { ok: true, 사람대조: { 확인: p.checks, 맞음: p.ok, 어긋남: (p.issues || []).slice(0, 6).map(function (x) { return caseProcAiCut_(typeof x === 'string' ? x : (x.text || JSON.stringify(x)), 140); }) }, 재산명단: caseProcAiSumLines_(e.lines || [], 6) };
  }
  if (name === 'law_checks') {
    const l = cxLawChecks_(c, facts) || {};
    // [지침 모의로 고침] 등기부 을구(소유권 이외 권리) — 말소 안 된 근저당·전세권·임차권은 부담부증여(인수 채무·보증금)·양도 대금 정산의 신호.
    //  말소됐는지는 GAS가 정하는 상수라, AI가 원문을 다시 읽지 않게 한 줄로 준다(판정은 하지 않음 — 채무를 넘겨받는지는 계약·질문으로)
    const liens = [];
    try {
      (caseProcParseAll_(c) || []).forEach(function (x) {
        const p0 = x.p || x; if (!p0 || p0.type !== 'registry' || !p0.result || !p0.result.docs) return;
        p0.result.docs.forEach(function (d) {
          const own = (d.소유권외 || []).filter(function (y) { return /설정$|근저당|전세권|임차권|질권|저당/.test(String(y.목적 || '')) && !/변경|말소/.test(String(y.목적 || '')); });
          if (!own.length) return;
          const live = own.filter(function (y) { return !y.말소; });
          const where = caseProcAiCut_(d.소재지 || (x.f && x.f.name) || '', 40);
          liens.push(live.length ? '을구 말소 안 된 권리 ' + live.length + '건 — ' + live.map(function (y) { return y.목적 + ' ' + (y.변경후금액 || y.금액 ? Number(y.변경후금액 || y.금액).toLocaleString('ko-KR') + '원' : '') + (y.채무자 ? ' 채무자 ' + y.채무자 : ''); }).join(' / ') + ' (' + where + ') → 인수 채무·보증금 여부 확인 거리'
            : '을구 권리 ' + own.length + '건 모두 말소 (' + where + ') → 인수할 채무·보증금 없음');
        });
      });
    } catch (e) { liens.push('을구 확인 오류: ' + caseProcAiCut_(e && e.message || e, 60)); }
    return { ok: true, 줄: caseProcAiSumLines_(l.lines || [], 10), 을구: liens.slice(0, 4), 메모: caseProcAiSumLines_(l.notes || [], 4) };
  }
  return { error: '모르는 도구' };
}

// ---------- 도구 실행 ----------
//  돌려주는 것: { name, text(AI가 받을 글), raw(원래 결과 — 기록용), chars(원래 결과 글자 수), more }
function caseProcAiExec_(caseId, name, input) {
  input = input || {};
  const step = function (k, extra) { return caseProc_(Object.assign({ caseId: caseId, step: k }, extra || {})); };
  let r;
  try {
    if (name === 'case_view') r = step('basic');
    else if (name === 'docs_read') r = step('evidence', input.phase === 'read' ? { phase: 'read' } : {});
    else if (name === 'calc_fill') { r = step('overview'); if (r && r.items) CASEPROC_AI_LAST_ITEMS_[caseId] = r.items; }
    else if (name === 'tax_calc') r = step('calc');
    else if (name === 'forms_check') r = step('output');
    else if (name === 'form_needs') r = typeof formNeeds_ === 'function' ? formNeeds_(caseId, input) : { error: '서식 도구가 이 판에 없음' }; // [2026.10.19 B-5]
    else if (name === 'save_draft') r = step('status');
    else if (name === 'ask_user') r = { ok: true, 올린질문: (input.itemIds || []).length };
    else if (name === 'report_tool_gap') r = { ok: true, 기록: caseProcAiCut_(input.want, 80) };
    else if (name === 'doc_text') {
      const c = akReadCase_ ? akReadCase_(caseId) : null;
      const f = c && caseProcAiFindFile_(c, input.file, !!input.filed);
      const t = f ? String(tc_docText_(f) || '') : '';
      const ls = t.split(/\n/), n = Math.min(Number(input.lines) || 6, 20);
      const at = input.find ? ls.findIndex(function (l) { return l.replace(/\s+/g, '').indexOf(String(input.find).replace(/\s+/g, '')) !== -1; }) : 0;
      r = f ? { ok: true, 파일: f.name, 찾음: at >= 0, 원문: at >= 0 ? ls.slice(Math.max(0, at - n), at + n + 1).join('\n') : '' } : { error: '서류를 찾지 못함' };
    } else if (name === 'doc_facts') {
      const c = akReadCase_(caseId);
      const parsed = caseProcParseAll_(c);
      if (!input.type && !input.file && !input.find) {
        const cnt = {}; parsed.forEach(function (x) { const k = x.p.type + (x.p.label ? '(' + x.p.label + ')' : ''); cnt[k] = (cnt[k] || 0) + 1; });
        r = { ok: true, 서류수: parsed.length, 종류별: cnt };
      } else {
        const hit = parsed.filter(function (x) {
          return (!input.type || x.p.type === input.type) && (!input.file || String(x.f.name).indexOf(input.file) !== -1) && (!input.find || JSON.stringify(x.p.result || {}).indexOf(input.find) !== -1);
        }).slice(0, Math.min(Number(input.max) || 4, 8));
        r = { ok: true, 찾은서류: hit.length, 서류: hit.map(function (x) { return { 파일: x.f.name, 종류: x.p.label || x.p.type, 값: caseProcAiTrimObj_(x.p.result || {}, 0) }; }) };
      }
    } else if (/^(facts_find|owner_assets|contract_list|money_links|time_order|people_roster|law_checks)$/.test(name)) {
      r = caseProcAiFactTool_(caseId, name, input);
    } else if (name === 'public_lookup') {
      const geo = cpGeo_(input.loc);
      if (!geo || geo.error) r = { error: (geo && geo.error) || '주소를 찾지 못함' };
      else if (input.kind === 'official') { const o = cpOfficialPrice_(geo, input.priceKind || 'land', Number(input.year) || new Date().getFullYear() - 1); r = o.v ? { ok: true, 값: o.v, 출처: o.src, 근거키: ['NX확보', o.src.split(' ')[0], geo.pnu, geo.dong || '', geo.ho || '', o.year].join('|') } : { error: o.error }; }
      else if (input.kind === 'real') {
        const before = CP_SECURED_LOG_.length;
        const o = cpRealCases_(input.loc, Number(input.area) || 0, input.base, Number(input.before) || 6, Number(input.after) || 3);
        const rec = CP_SECURED_LOG_.slice(before).filter(function (x) { return /^매매사례/.test(x.kind); })[0];
        r = o.error ? { error: o.error } : { ok: true, 출처: o.src, 조건: rec ? rec.cond : '', 거래: rec ? rec.rows.slice(0, 15) : o.cases, 거래수: rec ? rec.rows.length : o.cases.length, 근거키: rec ? rec.key : '' };
      } else { const o = cpBuilding_(input.loc); r = o.error ? { error: o.error } : { ok: true, 주용도: o.purpose, 구조: o.structure, 사용승인: o.approval, 전유면적: o.area, 출처: o.src }; }
    } else if (name === 'value_set') {
      const c = akReadCase_(caseId);
      // §101① 시가(tr:relfmv)처럼 세무사님만 정하는 값 — AI가 근거를 대도 넣지 않고 질문으로 둔다(조정 지시: 고른 시가는 세무사님 답으로만)
      const userOnly = /^tr:relfmv$/.test(String(input.itemId || ''));
      const chk = userOnly && (input.basis || {}).kind !== 'user' ? { ok: false, why: '이 칸(§101① 시가)은 세무사님 답으로만 넣습니다 — ask_user로 여쭙기' } : caseProcAiCheckBasis_(c, input.value, input.basis, input.itemId, caseId);
      r = { ok: chk.ok, 반영: chk.ok && !input.dryRun ? '시제품: 반영은 하지 않음(기록만)' : (chk.ok ? '대조 통과(dryRun)' : '거절'), 이유: chk.why, 서류: chk.file || '' };
    } else r = { error: '모르는 도구: ' + name };
  } catch (e) { r = { error: '도구 실행 오류: ' + (e && e.message || e) }; }
  const raw = JSON.parse(JSON.stringify(r || {}));
  const text = (name === 'doc_text' || name === 'value_set' || name === 'ask_user' || name === 'report_tool_gap') ? caseProcAiMask_(JSON.stringify(raw)).slice(0, CASEPROC_AI_SUM_MAX_)
    : /^(doc_facts|facts_find|owner_assets|contract_list|money_links|time_order|people_roster|law_checks|public_lookup|form_needs)$/.test(name) ? caseProcAiMask_(JSON.stringify(raw)).slice(0, CASEPROC_AI_SUM_MAX_ * 2) // 판단 재료 표 — 요약 두 배까지
    : caseProcAiSummarize_(name, raw);
  return { name: name, text: text, raw: raw, chars: JSON.stringify(raw).length, more: !!(raw && raw.more), roles: CASEPROC_AI_TOOL_ROLES_[name] || null, varSpots: caseProcAiVarSpots_(name, raw, caseId) };
}

