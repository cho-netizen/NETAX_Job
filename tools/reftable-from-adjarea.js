// [2026.10.19 조견표 체계] 5번 AdjArea.js(조정대상지역 이력 상수)를 조견표 1부-01 형식으로 옮긴다 — 사용: git show ai-lead-live:gs-backend/AdjArea.js > adj.js; node tools/reftable-from-adjarea.js adj.js reftables/1부-01.json
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const g={};new Function('G',src+';G.E=CASEPROC_ADJ_EVENTS_;G.U=CASEPROC_ADJ_UNVERIFIED_;')(g);
const area=a=>{let s=[a.sd,a.si,a.gu].filter(Boolean).join(' ');if(a.only)s+='('+a.only.join('·')+'만)';if(a.ex)s+='('+a.ex.join('·')+' 제외)';if(a.exRi)s+='('+Object.keys(a.exRi).map(k=>k+' '+a.exRi[k].join('·')).join(', ')+' 제외)';if(a.zone)s+=' ['+a.zone+']';return s;};
const rows=g.E.map(e=>({구분:e.kind+' — 국토교통부공고 제'+e.no+'호',시작:e.date,끝:'—',값:e.areas.map(area).join(', '),조건:'공고 하나(지역 상태는 다음 공고가 바꿀 때까지) · '+(e.dateNote||'공고한 날부터 효력')+(e.areas.some(a=>a.zone)?' · 지구 경계 줄은 확인 필요':''),근거조문:'주택법 §63의2',서식칸:'',출처:e.src,확인:e.dateNote?'확인 필요(효력일 — '+e.dateNote.slice(0,40)+'…)':'원문 대조됨(5번, 공고 원문)'}));
const t={번호:'1부-01',이름:'조정대상지역 지정·해제 이력',무엇:'어느 주소가 어느 날 조정대상지역이었나(공고 18건(목록 19줄))',
기준일:'쓰는 곳마다 다름 — 거주요건은 취득일, 중과는 양도일, 일시적 2주택은 새 주택 취득일',
근거법령:['주택법 §63의2','소득세법 시행령 §154①','소득세법 시행령 §154②','소득세법 §104⑦','소득세법 시행령 §155①','소득세법 시행령 §167의3'],
근거서식:[],출처:[{이름:'국토교통부 행정규칙 게시판(첫 공고 2017-1305호)',주소:'https://www.molit.go.kr/USR/I0204/m_45/dtl.jsp?idx=15151'},{이름:'국가법령정보센터 행정규칙 「조정대상지역 지정」',주소:'https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000281588'}],
대조:['세무사님 해설서 478~483쪽(참고자료조견표 폴더)'],갱신:'수시(공고 날) — 새 공고는 법제처 연혁으로 다시 확인',상태:'초안',
절차:[{단계:1,묻는것:'주소에 시·군·구가 있나',예:'2로',아니오:'확인 필요(주소 보충 질문)',근거:''},{단계:2,묻는것:'그 날짜까지 공고를 날짜 순으로 따라가 그 주소가 든 마지막 줄이 지정인가',예:'3으로',아니오:'비조정',근거:'공고 본문 "공고한 날부터 효력"'},{단계:3,묻는것:'제외 읍·면·동·리, 일부 동만, 지구 경계에 걸리나',예:'확인 필요(경계 질문)',아니오:'조정',근거:'공고 본문'},{단계:4,묻는것:'2017-08-03~11-09 사이 날짜의 거주요건 판정인가',예:'2017-1305호 지역이면 조정(§154②)',아니오:'—',근거:'소득세법 시행령 §154②'}],
행:rows,개정:[],쓰는곳:[{곳:'사건처리 판정',이름:'cls:조정대상지역·cls:거주기간(재기 전용 스위치 CASEPROC_AI_ADJ_TRIAL_)',보는날:'취득일·양도일',켜짐:false},{곳:'계산기 칸',이름:'양도 isAdjustedArea(지금은 사람이 입력)',보는날:'양도일',켜짐:false}],
확인필요:g.U,원본:'5번 세션 gs-backend/AdjArea.js(ai-lead-live f818c2d), maps/조정대상지역_이력표.md — 이 파일은 거기서 옮긴 것'};
fs.writeFileSync(process.argv[3],JSON.stringify(t,null,1));console.log('행',rows.length,'확인 필요 행',rows.filter(r=>/^확인 필요/.test(r.확인)).length,'지역 줄',g.E.reduce((n,e)=>n+e.areas.length,0));
