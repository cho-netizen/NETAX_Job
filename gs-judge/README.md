# 판정 서버(gs-judge) — 2026-11-10

세무사님 11-10 "가안으로 하자"(총괄관리자\_기록\판정서버_분리_계획서_20261110.html).
job 서버(gs-backend)가 구글 크기 한도(약 10MB)에 닿아, 판정 묶음 계산만 이 작은 GAS 프로젝트로 옮겼다.

- 프로젝트: https://script.google.com/d/18pjATlox1xF4Cp5KlSVnIQ13pzKsx-gK6ecB6uz24hiu76_sYFJwRjNX/edit
- 배포 ID(늘 이것을 다시 씀): AKfycbxTdcIUxP9_tBV_ZXLHHS8VOFVcK030cIfzre-5Hbeajawib8-yZ3OeyR8p23L5_myv
- 하는 일: 사실을 받아 판정 결과만 돌려준다. 시트·드라이브·장부 권한 없음(appsscript.json oauthScopes 비어 있음).
- job 서버 쪽: gs-backend/judge-remote/JudgeRemote.js(자동 생성)가 같은 이름으로 판정 서버를 부른다. 장부 적기·가족 지도는 job 서버.
- 원본은 gs-backend/JudgeMore.js 하나. 직결(Cloud Run)·시험 도구는 원본을 그대로 쓴다.

## 판정 묶음·엔진·이음매 점검 줄을 고쳤으면
1. `node tools/build-judge.js` — Generated.js·엔진 사본·Seams.js·job 서버 대리 파일 다시 만들기
2. `node tools/judge-remote-check.js` — 나누기 전·뒤 같은 답인지(묶음 이름 전부·판정 창 목록·이음매 줄·닿지 못할 때)
3. gs-judge 폴더에서 `clasp push` → `clasp deploy -i <위 배포 ID>` (job 서버보다 먼저)
4. job 서버를 평소대로 올림 — 배포 직후 이음매 점검 맨 앞 줄 「job 서버 → 판정 서버(닿는지·같은 판인지)」가 판이 다르면 끊김으로 알린다
