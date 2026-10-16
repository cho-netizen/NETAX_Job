# job 부가서비스 서버 (조회 전용 작은 구글 프로젝트)

2026-10-17. 세무사님 그림(관리 / 처리 / 부가서비스 3분할)의 세 번째 서버다. 관리 서버(`gs-light`)와 같은 방식으로 동작한다. 자세한 원리·올리는 법은 `gs-light/README.md`를 보고, 이 문서는 다른 점만 적는다.

| 조회 | 쓰는 화면 |
|---|---|
| `listFolder` 폴더 보기 | 일반메모·필기메모, 증빙확보, 사이드바 등 폴더를 여는 곳 전부 |
| `getNetaxRootPath` | 메모 |
| `listCaseTemplates`, `getCaseTemplateContent` 서식(템플릿) | 메모(사건개요 서식) |
| `listGeneralMemos` 메모 목록 | 메모 |
| `list_all_reports` 보고서 모음 | 보고서 모음(**"다시 만들기"는 job 서버**, 목록 파일을 고쳐 쓰므로) |
| `get_latest_template_review` 서식 점검 결과 | 보고서 모음 |

## 옮기지 않은 것 (job 서버 그대로)
- **블로그 연결·발행**(네이버·구글 블로그·구글 비즈니스): 연결 정보(비밀값)가 job 서버에 있다. 또 네이버·구글에 job 서버 주소가 등록돼 있다.
- **열람관리**(보고서 등록·삭제·비밀번호): 관리자 코드(비밀값)가 필요하다. 또 rpt.netax.kr의 고객 열람 기록이 같은 시트에 쓰인다.
- **설정**(📥 반영, AI 키, 정답지 점검 등): job 서버 자체를 다루는 일이다.
- 파일 읽기(`readFile`): 서류 글자인식을 하고, 그 결과를 기억하는 폴더 설정을 job 서버와 같이 쓴다.
- 쇼츠 목록: 처음 열 때 폴더를 만들고 설정에 적는다(두 서버가 따로 만들 수 있음).
- 모든 저장·업로드·삭제.

## 폴더 위치 설정
기본 폴더, 업무관리자(0 NETAX), 총괄관리자 폴더 ID를 쓴다. 이 값들은 비밀값이 아니다. 로그인 토큰을 확인할 때 job 서버(`manageApp_extraConfig`)에서 받아 이 프로젝트의 스크립트 속성에 적는다.
값을 받기 전에는 아무 조회도 하지 않는다. 값이 없으면 기본 폴더 대신 드라이브 맨 위를 보거나, 거기에 새 폴더를 만들 수 있기 때문이다.

## 올리는 법 (PC에서, 📥로는 안 올라감)
```bat
node tools/build-light.js
cd gs-extra
clasp push -f
clasp deploy -i AKfycbxZhdrTsjYg5NaX1lg3YnLozI0d3pGcLmXVVfZTC52qkmIhMSiujgfwo3IoxXO-6SPB -d "깃허브 <커밋>"
```
- scriptId: `.clasp.json` 참고
- 처음 한 번 권한 승인: 편집기 왼쪽 파일 목록에서 **Extra.gs**를 연다 → 함수 칸에서 `doGet`을 고른다 → ▶ 실행 → 허용. 드라이브·시트를 읽고 job 서버에 묻는 권한이다.
