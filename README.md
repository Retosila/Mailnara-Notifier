# Mailnara Notifier (메일나라 알리미)

삼정데이타서비스에서 제공하는 기업메일 및 그룹웨어 서비스인 _[메일나라](https://www.mailnara.co.kr/)_ 를 위한 알리미 앱(크롬 확장프로그램)입니다.  
현재는 슬랙 API를 통한 알림 전송만 가능합니다.

## 설치 방법

릴리즈된 소스 코드 및 `git clone https://github.com/Retosila/Mailnara-Notifier.git` 명령어를 통해 패키지를 다운받아주세요.  
다음 명령어를 입력해주세요. (Tailwind CSS 파일을 빌드하기 위해 필요한 과정입니다.)  

```
$ npm install
$ npm run build
```

`Settings > Extensions > Extension Manager`로 이동 후 `Developer Mode`를 활성화 시켜준다음 `Load unpacked` 버튼을 클릭해주세요.  
마지막으로 다운로드 받았던 프로젝트 디렉토리를 선택 후 `Open`을 누르면 확장 프로그램이 브라우저에 추가됩니다.  

## 사용 방법

최초 실행 시 확장 프로그램 UI상에서 슬랙봇 API 토큰 및 알림을 받을 채널 ID를 입력 후 Save 버튼 클릭하여 저장해주세요.  
(슬랙봇 API 토큰 Slack API페이지에서 발급받을 수 있습니다.)

메일나라에 로그인 후 `메일 > 받은 메일함`의 1페이지에 접속한 뒤 확장 프로그램 UI에서 `Start Watching` 버튼을 눌러 메일함 탐색을 시작해주세요.

**메일함 탐색이 시작되었다면 메일나라에 접속한 브라우저를 최소화하거나 다른 탭을 활성화해도 정상적으로 알림이 전송됩니다.*  
**현재는 메일나라 `메일 > 받은 메일함`상의 1페이지에 존재하는 읽지 않은 메일만 1분 주기로 크롤링합니다.*  
**읽지 않은 메일이더라도 이미 알림을 보낸 메일인 경우 중복해서 알림을 보내지 않습니다.*  
**개인적인 목적으로 제작한 것으로 삼정데이타서비스 전용 도메인(https://mail.sds.co.kr) 으로만 사용 가능합니다.*  
**만약 메일나라를 사용 중인 다른 기업 회원이시라면 manifest.json 및 scripts/inject.js 파일을 환경에 맞게 변경 후 사용해주세요.*  
**쿼리셀렉터를 통해 DOM 요소를 직접 크롤링하는 방식이기에 메일나라 내부 변경사항 발생 시 예기치 못하게 작동이 안 될 가능성이 있습니다.*  


<a href="https://www.flaticon.com/free-icons/notify" title="notify icons">Notify icons created by Md Tanvirul Haque - Flaticon</a>