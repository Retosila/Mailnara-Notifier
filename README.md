# Mailnara Notifier (메일나라 알리미)

삼정데이타서비스에서 제공하는 기업메일 및 그룹웨어 서비스인 _[메일나라](https://www.mailnara.co.kr/)_ 를 위한 알리미 앱(크롬 확장프로그램)입니다.  
현재는 슬랙 API를 통한 알림 전송만 가능합니다.

## 설치 방법

릴리즈된 소스 코드 및 `git clone https://github.com/Retosila/Mailnara-Notifier.git` 명령어를 통해 패키지를 다운받아주세요.  
다음 명령어를 입력하여 빌드해주세요.
build:dev로 빌드 시 개발 및 테스트 상황에서 사용하기 위해 console.\* 코드를 제거하지 않게 됩니다.

```
$ npm install
$ npm run build:prod
```

빌드가 성공적으로 완료되었을 경우, 루트 디렉토리의 `dist/`에 빌드된 파일들이 위치하게 됩니다.

`Settings > Extensions > Extension Manager`로 이동 후 `Developer Mode`를 활성화 시켜준다음 `Load unpacked` 버튼을 클릭해주세요.  
`dist/`를 클릭 후 `Open`을 누르면 확장 프로그램이 브라우저에 추가됩니다.
만약 릴리즈된 특정 버전을 다운로드받으셨을 경우, 위 빌드 과정을 생략 후 압축을 푼 뒤 바로 해당 디렉토리를 `Open`` 하시면 됩니다.

## 사용 방법

1. 슬랙봇 API 토큰 및 알림을 받을 채널 ID를 입력 후 Save 버튼 클릭하여 저장해주세요. (슬랙봇 API 토큰 Slack API페이지에서 발급받을 수 있습니다.)
2. 알림을 받아보길 원하는 메일나라 메일함의 기본 주소(Target Base URL)를 입력해주세요. 여기서 기본 주소란, 메일나라의 모든 메일함 주소들이 공통적으로 공유하는 주소를 말합니다.  
   예를 들어, 사용 중이신 메일나라의 받은 메일함 주소가 "https://mail.sds.co.kr/new_mailnara_web-v5.0/index.php/mail/mail_list/INBOX/0/50"이고 정크 메일 주소가  
   "https://mail.sds.co.kr/new_mailnara_web-v5.0/index.php/mail/mail_list/%EC%A0%95%ED%81%AC%20%EB%A9%94%EC%9D%BC/0/50"이라면 메일함의 기본 주소는  
   "https://mail.sds.co.kr/new_mailnara_web-v5.0/index.php/mail/mail_list/"가 됩니다. 맨 마지막 주소는 반드시 `/`로 끝나야만 합니다.

3. 알림을 받아보길 원하는 메일나라 메일함을 선택해주세요. 현재는 `받은 메일함(Inbox)`과 `정크 메일(Junk)`만 선택 가능합니다. 최소 한 개의 메일함이 선택되어야 있어야 하며, 복수의 메일함을 선택할 수 있습니다.
4. 메일함의 첫페이지에 대해서만 탐색을 할 지(First Page), 모든 페이지(All Pages)에 대해서 탐색을 할 지 선택해주세요.
5. `Apply` 버튼을 클릭하여 설정을 저장해주세요.
6. `Start Watching` 버튼을 눌러 메일함 탐색을 시작해주세요.

_\*메일함 탐색을 위해서는 **탐색 대상 메일함들이 반드시 한 개 이상의 탭에 열려있어야 합니다.** 예를 들어, `받은 메일함`과 `정크 메일`을 둘 다 탐색 중이라면, 브라우저 상에 최소 하나 이상의 받은 메일함 탭, 정크 메일 탭이 존재해야합니다._  
_\*같은 메일함 탭이 여러 개 존재해도 문제가 발생하지 않습니다. 즉, `받은 메일함` 탭이 100개 열려있어도 문제가 되지 않으며, 알림을 정상적으로 1개만 발송됩니다._
_\*메일함 탐색이 시작되었다면 메일나라에 접속한 브라우저를 최소화하거나 비활성화(브라우저의 포그라운드상에 표시되지 않아도) 정상적으로 알림이 전송됩니다._  
_\*읽지 않은 메일이더라도 이미 알림을 보낸 메일인 경우 중복해서 알림을 보내지 않습니다._  
_\*쿼리셀렉터를 통해 DOM 요소를 직접 크롤링하는 방식이기에 메일나라 내부 변경사항 발생 시 예기치 못하게 작동이 안 될 가능성이 있습니다._

<a href="https://www.flaticon.com/free-icons/notify" title="notify icons">Notify icons created by Md Tanvirul Haque - Flaticon</a>
