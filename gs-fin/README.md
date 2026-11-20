# 금융거래 합치기 서버(gs-fin) — 2026-11-20

세무사님 11-20 「권장대로 하자」(docs/_기록/금융거래_10년검토_계획서_20261120.html — 1단계 한 파일로 합치기, ㉦ 작은 서버 따로).
상속 사건 폴더의 은행 거래내역 **원시파일**(엑셀·PDF·사진·압축)을 은행 서식표로 칸을 맞춰 사건 폴더의 구글 시트 하나 「금융거래_통합_(납세자)_날짜」로 합친다.
CSV(세무사님 변환본)·사건 맨 위 합본·사무소가 손본 파일은 읽지 않는다. 2단계(조건 뽑기)는 여기 없다.

- 세무사님 화면: 사건 머리줄 「💰 금융거래 합치기」(상속 사건) · 설정 › 서류 글자인식 「💰 은행 서식표」 — `gs-backend/manage/finmerge.html`이 이 서버를 바로 부름(로그인 표를 실어)
- 넥스: 사건 대화 도구 `bank_merge`(do=list·run) — job 서버 `gs-backend/FinProxy.js`가 job 서버 로그인 표를 새로 받아 이 서버를 부름(같은 함수)
- 로그인 확인: 관리 서버(gs-light)와 같음 — 표가 맞는지 job 서버 `manageApp_checkToken`에 한 번 묻고 기억. 비밀값 없음
- 사건 암호(암호 걸린 은행 엑셀·압축): 이 서버 스크립트 속성 `FIN_PW_<사건ID 해시>`에만. 시트·진행 파일·기록엔 남기지 않음
- 은행 서식표: 첫 판은 `FinMerge.js FIN_FORMATS_BUILTIN_`(11-20 고객사건 폴더 원시파일 조사 5가지), 고친 것·새 서식은 업무관리자/`금융거래_은행서식표.json`
- 진행 기억: 사건 폴더 `_금융거래_합치기_진행.json`(한 번 부를 때 4분 30초까지 읽고, 읽은 파일은 다시 읽지 않음)

## 파일
- `Fin.js` 입구·로그인 확인 · `FinMerge.js` 서식표·파일 읽기 · `FinRun.js` 나눠 돌리기·합치기·시트 쓰기 · `FinCrypt.js` 암호 풀기(엑셀 agile·standard, 압축 ZipCrypto) — 손으로 고침
- `Generated.js` — **자동 생성, 고치지 말 것.** `node tools/build-light.js gs-fin`이 gs-backend에서 엑셀 정리(bankParseRows_ 등)·글자 읽기(tc_docText_·docBankStmtParse_)·사건 찾기 함수를 복사

## 처음 올리기(한 번)
1. `cd gs-fin` → `clasp create --type webapp --title "NETAX job 금융거래 합치기 서버" --rootDir .` (새 구글 프로젝트, .clasp.json 생김)
2. `node ../tools/build-light.js gs-fin` → `clasp push -f`
3. 편집기에서 `doGet`을 한 번 실행해 권한 승인(드라이브·시트·바깥 호출) — **세무사님 몫**
4. 편집기 배포 → 새 배포 → 웹 앱 → 나로 실행 → 모든 사용자 → 배포 ID를 아래에 적음
5. 배포 주소를 `gs-backend/FinProxy.js FIN_SERVER_URL_`과 `gs-backend/manage/finmerge.html FM_URL`에 적고 `node tools/build-app.js` → job 서버·화면 평소대로 올림
6. 배포 직후 이음매 점검 「넥스·화면 → 금융거래 합치기 서버」가 통과하는지 확인

## 고쳤을 때
`node tools/build-light.js gs-fin` → `cd gs-fin` → `clasp push -f` → `clasp deploy -i <배포 ID> -d "깃허브 <커밋>"`

- scriptId: 106rq0YGihyR2452Qpx6ykqYWyIcG17SOo_e5CzxRy-0oxqeeOWGa2Irw
- 배포 ID: AKfycbwut0DS0v2KwV7VZZkeZ_Xz73VfHELrlxbolYY0Q2QIsU57RmZokDcGQ8SMxJxp7psIoQ (11-20 편집기 새 배포 — clasp 첫 배포 AKfycbwMeYiBmiU72rPISMEMOX8r3hAJPLMcPrVili0MfnCK0LJ_G9sNYnMNLJym4rjUR5vPag 는 403이라 안 씀)

## 시험(11-20, 로컬 흉내 — 구글 서버 아님)
고객사건 상속 사건 원시 엑셀 59개(+압축 안 26개)를 이 컴퓨터 엑셀로 읽기 전용 사본에서 값만 뽑아 합치기 본체를 돌림:
같은 거래 두 벌(국민 기간 나눈 파일 셋 + 전체 파일 238줄, 농협 1~8번 두 벌 476줄)을 한 번만 셈 · 계좌마다 총괄 검산(처음 잔액 + 입금 − 출금 = 끝 잔액) 맞음 ·
국민 인터넷 해마다 받은 11개 파일 → 한 계좌 1,879줄 · 우체국 한 파일 시트 38개 → 계좌 38개 · 신한 암호 엑셀 3개 「암호」 · 세무사님 합본·손본 파일 「건너뜀」 ·
엑셀로 한글 암호를 건 시험 파일이 맞는 암호로 열리고 틀린 암호는 거절. PDF·사진(글자인식)·구글 시트 쓰기는 구글 서버에서만 확인 가능.
