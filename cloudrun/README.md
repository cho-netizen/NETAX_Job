# netax-case-reader — 읽기 전용 시험 서비스(Cloud Run)

같은 사건처리 코드(gs-backend, 조립기 tools/build-reader.js)를 node에서 돌려 ①사건파악·②증빙 정리·③칸 채우기 결과를 돌려주는 서비스입니다. 쓰기는 하지 않습니다(결정 파일·사건 행은 응답 `written`에 실어 GAS가 저장).
설계: C:\GitHub\netax-inventory\maps\T6_시험서비스_설계서_20261023.md(2단계) · T6_3단계_화면직결_설계서_20261027.md(3단계).

## 지금 상태(재배포한 사람이 아래 "문:" 줄을 고칩니다 — tools/change-check.js가 이 줄로 ⚠ 판정)
문: 인증 없이 받기(allow-unauthenticated) — 서비스 안에서 구글 ID 토큰 검증(발급자·받는 이·이메일 허용 목록), 2026-10-27 3단계
서비스 계정: case-reader@netax-job.iam.gserviceaccount.com(뷰어) — 가상사건 폴더 40개만
리전: asia-northeast3 · 메모리 1Gi · CPU 1 · 동시 1 · 시간 300초 · 최소 0대 · 최대 1대

## 입구
- GET /health — 토큰 없이 ok(깨우기용, 내용 없음)
- OPTIONS — 허용 출처(https://job.netax.kr, http://localhost)만 204
- POST /read — Authorization: Bearer <구글 ID 토큰> 필수(틀리면 401). 요청 {caseId, folderId, sheetRow?, decisions?, ocrMemory?, options?}.
  글자 기억은 요청 ocrMemory가 있으면 그것, 없으면 사건 폴더의 _글자기억.json(GAS 미리 읽기가 둔 사본).

## 환경변수
- T6_ALLOWED_EMAILS: 허용 이메일(쉼표) — 기본 cho@netax.kr
- T6_AUDIENCE: ID 토큰의 받는 이(Apps Script 클라이언트) — 기본 638504746086-826uq73k9hj7ikingvmuub8o240ddfjt.apps.googleusercontent.com
- CODE_VERSION: 빌드 인자(도커 빌드 때 조립 모듈 머리글·/health codeVersion)

## 빌드·배포(저장소 루트에서)
gcloud builds submit --config cloudrun/cloudbuild.yaml --substitutions _CODE_VERSION=<git short sha> .
gcloud run deploy netax-case-reader --image asia-northeast3-docker.pkg.dev/netax-job/netax-case-reader/netax-case-reader:<sha> --region asia-northeast3 --allow-unauthenticated --service-account case-reader@netax-job.iam.gserviceaccount.com --memory 1Gi --cpu 1 --concurrency 1 --timeout 300 --min-instances 0 --max-instances 1 --port 8080 --set-env-vars T6_ALLOWED_EMAILS=cho@netax.kr
되돌리기(IAM 문): gcloud run services update netax-case-reader --region asia-northeast3 --no-allow-unauthenticated
