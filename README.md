# 구슬 대작전 — GitHub Pages용 시제품

30개의 구슬이 핀과 움직이는 장애물을 통과합니다. 먼저 결승선에 도착한 구슬이 당첨됩니다. QR로 입장하면 구슬 번호 하나가 배정되고, 경기 중 한 번 자신의 구슬을 중심으로 반경 155px의 모든 구슬에 무작위 충격파를 가합니다. 자신의 구슬도 포함됩니다. 빈자리는 봇입니다.

## 1. 먼저 데모 체험

이 폴더의 `index.html`을 브라우저에서 열고 **데모 시작하기 → 구슬 낙하 시작**을 누르세요. 드롭다운으로 체험할 구슬을 선택하고 충격파를 사용해 보세요. 구슬마다 스킬 1회로, 데모에서는 다른 구슬로 바꿔 여러 번 테스트할 수 있습니다. QR 모드에서는 각 참가자가 배정받은 구슬만 제어합니다.

별도 빌드, npm 설치가 필요 없습니다. 아래 파일을 GitHub 저장소 최상위에 올립니다.

- index.html
- style.css
- app.js
- config.js
- database.rules.json (Firebase 규칙 입력용)
- README.md
- .nojekyll (빈 파일)

GitHub 저장소 Settings → Pages에서 main 브랜치 / root를 선택합니다. 생성된 HTTPS 주소로 접속하면 됩니다. 저장소 하위 경로도 지원합니다.

## 2. 휴대폰 QR 참여를 연결하는 방법

GitHub Pages는 정적 호스팅이므로 실시간 상태 공유는 Firebase Realtime Database에서 처리합니다. Firebase 설정 없이 데모는 되지만 여러 휴대폰 참여는 되지 않습니다.

1. https://console.firebase.google.com 에서 프로젝트를 만들고 웹 앱을 추가합니다.
2. Authentication → Sign-in method에서 **Anonymous(익명)** 로그인을 켭니다.
3. Authentication → Settings → Authorized domains에 GitHub Pages 호스트(예: `yourname.github.io`)를 추가합니다. 로컬 HTTP 테스트를 한다면 localhost도 추가합니다.
4. Realtime Database를 만들고 데이터베이스 URL을 확인합니다. Firestore가 아닌 **Realtime Database**입니다.
5. Realtime Database → Rules에 `database.rules.json`의 내용을 붙여 넣고 Publish합니다. 공개 읽기/쓰기 테스트 규칙을 사용할 필요가 없습니다.
6. 웹 앱의 Firebase 구성 객체를 `config.js`의 null 대신 넣고 GitHub에 올립니다. databaseURL을 반드시 포함하세요.

```js
window.FIREBASE_CONFIG = {
  apiKey: "콘솔에서 복사",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_DATABASE.REGION.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  appId: "콘솔에서 복사"
};
```

구성 객체는 Firebase 웹 앱의 공개 설정입니다. 관리자 서비스 계정 키나 비공개 키를 여기에 넣지 마세요. 실제 접근 제한은 함께 제공한 데이터베이스 규칙으로 처리합니다.

화면에서 설정 JSON을 저장하는 기능은 **현재 브라우저에만** 적용됩니다. 참가자의 휴대폰에서도 접속하려면 config.js를 설정해 올려야 합니다.

## 3. 행사에서 사용하는 순서

1. PC에서 배포 주소를 열고 **QR 참여 방 만들기**를 누릅니다.
2. 화면을 공유하거나 QR을 보여 주세요. 참가자는 휴대폰으로 QR을 스캔하고 이름을 입력합니다.
3. 진행자 화면의 참가자 목록을 확인한 뒤 **구슬 낙하 시작**을 누릅니다. 참가자는 최대 30명이며, 빈 구슬은 봇입니다. 봇도 당첨될 수 있습니다.
4. 참가자는 휴대폰에서 배정된 번호와 경기를 보고 **충격파**를 한 번 누를 수 있습니다. 반경 안의 모든 구슬이 각기 무작위 방향으로 튕깁니다.
5. 최초 도착 시 결과가 표시됩니다. **새로운 경기 준비**를 누르면 같은 QR 방에서 새로 입장할 수 있습니다. 새 경기에는 참가자들이 이름을 다시 제출합니다.

같은 브라우저의 익명 로그인 ID는 한 참가자로 취급합니다. 다른 휴대폰으로 인원이 분리됩니다. 새로고침해도 같은 방에서는 배정된 구슬을 다시 찾습니다. 진행자는 별도의 구슬을 받지 않으며 경기 운영에 집중합니다.

## 시제품의 동작과 한계

- 진행자 PC가 구슬 물리를 계산하며 약 8회/초 상태를 공유합니다. 참가자는 이 상태를 표시하고 자신의 1회 스킬 요청만 보냅니다. 경기 상태는 진행자만 쓸 수 있습니다.
- **진행자 탭을 계속 열어 두고 화면이 켜진 상태로 유지하세요.** 탭을 닫거나 새로고침하거나 절전 상태가 되면 경기가 멈춥니다. 진행자 복구는 구현하지 않았으므로 새 방을 만드세요. 백그라운드 탭에서도 브라우저 정책에 따라 애니메이션이 중단될 수 있습니다.
- 물리는 시제품용 자체 구현입니다. 공식적인 공정 추첨/경품 시스템을 검증한 구현은 아닙니다. 네트워크 지연으로 버튼 반영 시점이 조금 달라질 수 있습니다.
- QR 이미지는 api.qrserver.com으로 생성하며 공개 참여 링크를 해당 서비스에 보냅니다. 참가자 이름은 QR 요청에 포함하지 않습니다. QR 서비스가 차단되면 참여 링크 복사를 사용하세요.
- 온라인 모드에는 인터넷과 Firebase CDN 접근이 필요합니다. 데모는 외부 라이브러리 없이 동작합니다.
- 기존 방 데이터는 자동 삭제되지 않습니다. 행사 후 Firebase 콘솔에서 rooms 아래 사용하지 않는 방을 삭제하세요. Firebase 사용량/요금은 자신의 프로젝트 설정에 따릅니다.
- 익명 계정 여러 개를 만드는 것까지 막지는 않습니다. 행사 운영용 시제품이며, 부정 참가 방지는 후속 작업입니다.
- 구조: index.html(화면), style.css(반응형 스타일), app.js(물리/게임/온라인 연결), config.js(공개 Firebase 구성), database.rules.json(접근 규칙).

## 검증 상태

JavaScript 구문 검사 및 독립 실행 검사로 구슬 30개 생성, 충격파 범위/자기 구슬 포함/중복 사용 차단, 20회 낙하 경기 완료를 확인했습니다. 이 제작 환경의 로컬 브라우저 접근 제한 때문에 화면 시각 검증은 수행하지 못했습니다. 실제 Firebase 프로젝트의 다중 휴대폰 연결은 계정 설정 후 별도로 확인해야 합니다.

참고한 게임: https://lazygyu.github.io/roulette/ . 이 프로젝트는 해당 게임의 코드나 자산을 복사하지 않은 독립 시제품입니다.

Firebase 공식 문서:
- https://firebase.google.com/docs/database/web/read-and-write
- https://firebase.google.com/docs/auth/web/anonymous-auth
- https://firebase.google.com/docs/database/security

