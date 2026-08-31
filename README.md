# party — 모바일 청첩장

배포 주소: <https://nachj.github.io/party/> (Pages 활성화 후)

단일 HTML 파일로 된 모바일 청첩장입니다. 빌드 과정이 없고, `index.html` 하나에 HTML·CSS·JS가 전부 들어 있습니다.

---

## 로컬에서 보기

저장소 루트에서:

```bash
python tools/wedding_site.py
```

`http://localhost:8000/` 이 자동으로 열립니다. 종료는 `Ctrl + C`.

> `index.html` 을 더블클릭하면 안 됩니다. 방명록이 ES 모듈(`import`)을 쓰기 때문에 `file://` 로는 동작하지 않습니다.

휴대폰에서 확인하려면 (같은 와이파이):

```bash
python tools/wedding_site.py serve --lan
```

Python 3.8 이상만 있으면 되고, 추가 패키지 설치는 필요 없습니다.

---

## 구조

```
.
├─ index.html          ← 페이지 전체 (HTML + CSS + JS 단일 파일, 약 1,530행)
├─ images/
│  ├─ Main/1~24.jpg        갤러리 앞 24장
│  ├─ DongJak/1~20.jpg     갤러리 뒤 20장
│  ├─ temp/2.jpg           히어로 메인 사진
│  └─ porch_shot.png       카톡 공유 미리보기 (og:image)
├─ music/Wedding_Smile.mp3 배경음악
├─ tools/wedding_site.py   로컬 서버 · 파일 점검 · 주소/키 교체 도구
├─ .nojekyll               Pages가 파일을 Jekyll로 가공하지 않도록
├─ .gitattributes          `* -text` — Windows git의 CRLF 변환 방지
└─ README_original.md      원작자가 쓴 원본 README
```

섹션은 10개입니다: 히어로 · 인사말 · 갤러리 · 캘린더 · 연락처 · 오시는 길 · 예식 안내 · 참석여부 · 방명록 · 게스트스냅.

---

## 내용 수정

이름·날짜·장소·좌표·계좌·인사말·연락처는 전부 `index.html` 의 `<script id="config">` 블록 한 곳(약 500~600행)에 모여 있습니다. 여기만 고치면 페이지 전체에 반영됩니다.

갤러리 사진은 같은 블록의 `gallery` 배열로 지정합니다.

```js
gallery: [
  ...Array.from({length:24},(_,i)=>`images/Main/${i+1}.jpg`),
  ...Array.from({length:20},(_,i)=>`images/DongJak/${i+1}.jpg`)
],
```

주소·제목·API 키는 도구로 한 번에 바꿀 수 있습니다:

```bash
python tools/wedding_site.py rebrand --base-url https://내아이디.github.io/내레포/
python tools/wedding_site.py rebrand --kakao-key <카카오 JavaScript 키>
python tools/wedding_site.py rebrand --title "이름 ♥ 이름 결혼합니다"
```

사진을 바꾼 뒤에는 누락이 없는지 확인하세요:

```bash
python tools/wedding_site.py status
```

---

## 배포

`main` 브랜치에 push하면 끝입니다. 최초 1회만 Pages를 켜 주세요.

**Settings → Pages → Source** 를 `Deploy from a branch` / `main` / `/ (root)` 로 지정 후 Save.

몇 분 뒤 <https://nachj.github.io/party/> 에서 열립니다. `.nojekyll` 이 있으므로 폴더·파일명이 가공될 걱정은 없습니다.

---

## 알려진 이슈

### 1. 방명록·참석여부가 원작자의 Firebase로 저장됩니다 ⚠️

`index.html` 맨 아래 `firebaseConfig` 는 원작자의 프로젝트(`wedding-sw-js-260823`)를 그대로 가리킵니다.
**이 상태로 공개하면 하객이 남긴 방명록과 참석여부가 남의 데이터베이스에 들어갑니다.**

바꾸려면 Firebase 콘솔에서 프로젝트 생성 → Firestore Database 생성 → 웹 앱 등록 후, 나오는 설정값을 `firebaseConfig` 에 붙여넣으세요. `guestbook` 과 `rsvp` 컬렉션에 대한 읽기/쓰기 규칙도 열어 줘야 합니다.

Firebase 초기화에 실패하면 코드가 자동으로 localStorage 폴백으로 넘어갑니다. 방명록을 아예 쓰지 않으려면 해당 `<script type="module">` 블록을 지우면 됩니다.

### 2. 카카오 지도

`CONFIG.kakaoJsKey` 도 원작자의 키입니다. 카카오는 등록된 도메인에서만 SDK를 허용하므로, 이 저장소 주소에서는 지도가 안 뜨고 안내 문구만 나옵니다.

developers.kakao.com 에서 앱을 만들고 JavaScript 키를 발급받은 뒤, **앱 설정 → 플랫폼 → Web** 에 아래 두 개를 등록하세요.

- `https://nachj.github.io` (배포용)
- `http://localhost:8000` (로컬 확인용)

그리고 `rebrand --kakao-key` 로 교체합니다.

### 3. 사진 용량 — 약 697MB

사진이 원본 해상도 그대로입니다. `images/DongJak/` 은 장당 최대 37MB(7126×4750), `images/Main/` 은 장당 약 9MB(4000×6000)입니다.

- GitHub Pages **사이트 용량 한도가 1GB** 입니다. 현재 약 70%를 씁니다.
- 하객 한 명이 갤러리를 다 보면 약 690MB를 씁니다. **150명이면 월 100GB 권장 대역폭을 넘깁니다.**
- 휴대폰에서 갤러리 로딩이 느립니다. 실측 시 사진 44장을 불러오는 동안 브라우저가 수 초간 멈췄습니다.

갤러리 사진을 긴 변 1600px·품질 82 정도로 줄이면 약 35MB가 되고, 휴대폰 화면에서는 화질 차이가 보이지 않습니다. 원본 화질이 꼭 필요한 경우가 아니라면 줄이는 편을 권합니다.

---

## 출처

원본: <https://github.com/kakaopark857/sangwon_jisu.wedding> (공개 저장소)
원작자가 쓴 설명은 `README_original.md` 에 그대로 두었습니다.

사진·이름·연락처·계좌번호는 원작자 부부의 실제 개인 정보입니다. 이 저장소를 실제 청첩장으로 쓰려면 `<script id="config">` 블록 내용과 `images/`, `music/` 을 전부 본인 것으로 교체하세요.
