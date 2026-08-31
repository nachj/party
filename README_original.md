# 모바일 청첩장 (상원 ♥ 지수)

GitHub Pages로 배포하는 단일 파일 모바일 청첩장입니다.

## 1. 내용 수정
`index.html` 상단의 `<script id="config">` 안의 `CONFIG` 객체만 고치면 됩니다.
- 신랑/신부 이름·부모님·계좌
- 예식 일시/장소/좌표 (`lat`, `lng`)
- 인사말
- API 키 (`kakaoJsKey`, `naverMapClientId`)

## 2. GitHub 업로드
저장소: `KaKaoPark857/sangwon_jisu.wedding`

웹에서 올리는 방법:
1. 저장소 페이지 → **Add file → Upload files**
2. `index.html` 드래그하여 업로드 → **Commit changes**

또는 터미널:
```
git clone https://github.com/KaKaoPark857/sangwon_jisu.wedding.git
cd sangwon_jisu.wedding
# index.html 복사해 넣기
git add index.html
git commit -m "모바일 청첩장 추가"
git push origin main
```

## 3. GitHub Pages 활성화
저장소 → **Settings → Pages** → Source를 `main` 브랜치 `/ (root)`로 지정 → Save
잠시 후 `https://kakaopark857.github.io/sangwon_jisu.wedding/` 에서 확인됩니다.

## 4. API 키 발급
- **카카오 지도 + 카카오톡 공유**: developers.kakao.com → 내 애플리케이션 생성 → JavaScript 키 복사 → `CONFIG.kakaoJsKey`에 입력.
  - **반드시** [앱 설정 → 플랫폼 → Web]에 배포 도메인(`https://kakaopark857.github.io`)을 등록해야 동작합니다.
  - 카카오톡 공유는 [제품 설정 → 카카오톡 공유] 활성화도 필요합니다.
- **네이버 지도(선택)**: ncloud.com → Maps → Application 등록 후 Client ID 발급. 현재 코드는 카카오 지도 표시 + 네이버/카카오 길찾기 버튼 링크 방식입니다.

## 5. 사진 추가
`사진 자리` placeholder를 실제 `<img src="...">`로 교체하세요. 이미지 파일을 저장소에 함께 올린 뒤 상대 경로로 지정하면 됩니다.

## 6. 방명록 주의 (중요)
현재 방명록은 **브라우저 localStorage** 저장 방식이라 **작성한 기기에서만** 보입니다. 하객끼리 공유되는 진짜 방명록이 필요하면 Firebase Firestore 등 외부 DB 연동이 필요합니다 (코드 내 `loadGB`/`gbSubmit` 부분 교체).
