# job 관리 서버 (조회 전용 작은 구글 프로젝트)

> 같은 방식의 부가서비스 서버는 `gs-extra/README.md`. 두 서버 모두 `node tools/build-light.js` 한 번으로 Generated.js가 다시 만들어진다(`gs-light` 또는 `gs-extra`만 주면 그것만).

2026-10-17 시작. job 서버(`gs-backend`, 3MB)는 호출마다 코드 전체를 읽느라 빈 호출도 3~5초 걸리고, 사건처리·AI처럼 무거운 일과 겹치면 10~30초씩 튀었다.
화면을 열 때마다 기다리는 조회 4가지만 이 작은 프로젝트가 대신 답한다.

| 조회 | 쓰는 화면 |
|---|---|
| `work_get_cases` 사건 목록 | 대시보드·작업관리·고객관리·수금관리·사이드바 등 거의 전부 |
| `client_get_clients` 고객 목록 | 고객관리·수금관리·작업관리 자동완성 |
| `client_get_consult_logs` 자문내역 | 대시보드·고객관리·수금관리 |
| `list_bookings` 예약 목록 | 대시보드·예약관리 |

- **저장·수정은 전부 job 서버 그대로**: 잠금(LockService)이 프로젝트마다 따로라서, 두 서버가 같은 시트에 쓰면 꼬일 수 있다.
- 조회는 시트를 그때그때 새로 읽는다. 그래서 job 서버에서 저장한 내용이 바로 보인다(이 서버에는 결과 기억 없음).
- 화면(`gs-backend/manage/gasbridge.html`)은 이 서버에 먼저 묻는다. 오류가 나거나 12초 동안 답이 없으면 job 서버로 다시 묻고, 두 번 연달아 실패하면 그 화면에서는 이 서버를 끈다.
- 화면을 열 때 조회마다 한 번, 뒤에서 job 서버의 답과 똑같은지 비교한다. 다르면 오류 기록에 남기고 job 서버로 돌아간다.
- 로그인: 세션 토큰이 맞는지 job 서버(`manageApp_checkToken`)에 한 번 묻고, 맞으면 토큰이 끝날 때까지(최대 6시간) 기억한다. 그래서 이 프로젝트에는 비밀값을 넣지 않는다.

## 파일
- `Generated.js` — **자동 생성, 직접 고치지 말 것.** `node tools/build-light.js`가 `gs-backend/*.js`에서 위 조회 함수와, 그 함수가 쓰는 함수·상수만 골라 복사한다.
- `Light.js` — 입구(doPost/doGet), 로그인 확인, 조회 4가지 연결.
- `appsscript.json` — 권한은 시트 읽기와 외부 호출 두 가지뿐.

## 고쳤을 때 올리는 법 (PC에서, 📥로는 안 올라감)
`gs-backend/Code.js`의 조회 함수(`work_getCases`·`work_readRow_`·`client_getClients` 등)를 고쳤거나 `Light.js`를 고쳤으면, `NETAX_Job` 폴더에서:

```bat
node tools/build-light.js
cd gs-light
clasp push -f
clasp deploy -i AKfycbxnruhEVQURJupt1eM7K8Iyn_EDDwSJ6mcmdvQhGqxF7rxB1VLxZkxJMi5jAYuj8e9woQ -d "깃허브 <커밋>"
```

깜빡하고 안 올렸어도 화면의 비교가 다름을 잡아 job 서버로 돌아가므로, 결과가 틀리게 보이지는 않는다(느려질 뿐).

- scriptId `1tRZAd3vst9Tv0AHiM5cYZ-s1nqHnI5Qw9YJHxqlvt4FnhRQwv0zStUqt`
- 배포 ID `AKfycbxnruhEVQURJupt1eM7K8Iyn_EDDwSJ6mcmdvQhGqxF7rxB1VLxZkxJMi5jAYuj8e9woQ`

## 처음 설치 때 한 번 — 구글 권한 승인
새 프로젝트는 세무사님이 권한을 한 번 허용해야 동작한다. 허용하기 전에는 구글이 "액세스 거부됨" 화면을 내고, 화면은 job 서버로 대신 동작한다.
1. https://script.google.com/d/1tRZAd3vst9Tv0AHiM5cYZ-s1nqHnI5Qw9YJHxqlvt4FnhRQwv0zStUqt/edit 를 연다.
2. 위쪽 함수 선택 칸에서 `doGet`을 고르고 ▶ 실행을 누른다.
3. "권한 검토" → 계정 선택 → "고급" → "(안전하지 않음)으로 이동" → "허용"을 누른다.
