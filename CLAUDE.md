# 이 저장소 전용 규칙

## 이 저장소의 두 가지 역할
1. **루트의 `CNAME`/`index.html`** — job.netax.kr을 새 관리 앱(구글 앱스스크립트) 주소로 자동
   이동시키는 리다이렉트 페이지. 깃허브 페이지로 서빙됨. 이 두 파일은 거의 안 바뀔 것이다.
2. **`gs-backend/` 폴더** — 새 관리 앱("사건처리"부터 "작성관리"까지, `?app=manage`로 진입)의
   실제 소스코드. 2026-09-02에 `NETAX_Work-staging`(원래 종전 채팅앱의 스테이징 저장소)에서
   이 저장소로 옮겨왔다 — 종전 채팅앱은 언젠가 폐기될 예정이라, 그 폐기 시점에 새 관리 앱
   코드까지 같이 사라지는 걸 막기 위해 독립된 곳으로 분리한 것. `gs-backend/`는 여전히
   `NETAX_Work`/`NETAX_Work-staging`과 **같은 구글 앱스스크립트 프로젝트**(scriptId
   `1b85NoFaMldCQonIGKMRj2Fn8bXtaYGu51k9SiBZ3m5Mk6iylNMlxqnDm`)를 공유한다 — 예약/작업관리/
   고객관리 등 뒷단 로직(Code.js)은 원래부터 이 프로젝트 하나로 통합되어 있었고, 이번에 옮긴
   건 프론트엔드 코드(화면)의 "저장 위치"일 뿐, 배포 대상 자체는 그대로다.

깃허브 페이지가 이 저장소 안의 `gs-backend/` 폴더도 정적 파일로 서빙하긴 하지만(예:
`job.netax.kr/gs-backend/Code.js`), 아무도 그 경로로 링크를 안 거니 실질적으로 노출될 일은
없고, HTML 파일들은 구글 앱스스크립트가 처리해야 하는 템플릿 태그가 그대로 남아있어 깨진
상태로만 보인다 — 신경 쓸 필요 없음.

## GS(Apps Script) 코드 수정 시 반드시 지킬 절차
`gs-backend` 폴더 안의 `.js`/`.html`/`appsscript.json` 파일을 수정했다면, 코드 수정만으로는
실제 서비스에 반영되지 않는다. 아래 순서를 매번 빠짐없이 실행한다 (사용자에게 각 단계를 할지
묻지 말고, 커밋/푸시 승인 규칙과 별개로 이 기술적 절차는 자동으로 진행한다 — 단, git commit/push
자체의 승인은 전역 규칙을 그대로 따른다):

1. `clasp push` — 로컬 수정사항을 Apps Script 서버로 올린다. (`gs-backend` 폴더 안에서 실행)
2. `clasp deploy -i <기존 배포 ID>` — **반드시 기존 배포 ID를 재사용**한다. 새 배포를 만들면
   웹앱 URL이 바뀌어 리다이렉트 페이지(`index.html`)와 다른 프론트엔드들에 박힌 주소가 전부
   깨지므로, `clasp deploy` (ID 옵션 없이)로 새 배포를 만드는 것은 금지.
3. 위 두 단계가 끝난 뒤에만 `git commit`/`git push` 진행 여부를 평소 규칙대로 묻는다 (이건
   실제 반영과 무관한 기록/백업용이라 순서상 나중이어도 무방).

### 이 저장소의 배포 ID
배포 ID = AKfycbyFbvXiV6rSzCvhtc_T2WrzNF5ZxhOFWtSSsgzSavzPbjv4LBGhjXhu_Q2_8m-PDj8s
(`gs-backend/manage/aisidebar.html`의 `AI_SB_GAS_URL`, 리다이렉트 `index.html`의 대상 주소와
동일한 ID인지 항상 확인할 것 — 다르면 잘못된 배포에 올리는 것임)

`NETAX_Work`/`NETAX_Work-staging`도 여전히 같은 scriptId/배포ID를 쓴다(뒷단 로직 공유,
[[project-netax-backend]] 참고) — 이 저장소와 그쪽 저장소 양쪽에서 `gs-backend/Code.js`를
동시에 건드리는 일이 없도록 주의(같은 프로젝트에 두 곳에서 clasp push하면 나중에 push한 쪽이
이긴다).
