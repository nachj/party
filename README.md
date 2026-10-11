# 창준 ♥ 영주 모바일 청첩장

2027년 5월 29일 토요일 오후 2시 30분 · W스퀘어컨벤션 L층 그레이스홀

## 파일
| 경로 | 내용 |
|---|---|
| `index.html` | 배포되는 청첩장(한 파일 · 사진은 파일 안에 들어 있음) |
| `bgm-canon.mp3` | 배경음악(index.html 과 같은 폴더) |
| `src/invitation.html` | 청첩장 원본(문구·섹션은 여기서 고친다) |
| `src/blocks.html` · `core.css` · `core.js` | 공통 조각 · 스타일 · 동작(달력·카운트다운·라이트박스·탭·계좌 복사·참석 여부·방명록) |
| `src/photos/` | 들어가는 사진(17 = 표지 · 나머지는 Unsplash 샘플 · `CREDITS.md`) |
| `src/icons/` | Tabler Icons(MIT) 중 쓰는 것 |
| `src/photo-edit/enhance.py` | 표지 사진 보정 스크립트(원본 사진은 저장소에 올리지 않음) |

## 고치고 다시 만들기
```bash
cd src && python3 build.py      # Pillow 필요 · 결과 = ../index.html
```

## 배포
GitHub Pages(main 브랜치 루트). 검색엔진 노출은 `noindex` 로 막아 두었다.

## 출처
- 사진: Unsplash License 샘플(작가는 `src/photos/CREDITS.md`) · 실제 촬영본으로 바꿀 예정
- 음악: Pachelbel, Canon in D · United States Air Force Band Strolling Strings(퍼블릭 도메인 · 앞 2분)
- 글꼴: Google Fonts(EB Garamond · Gowun Batang · Bodoni Moda · Geist Mono · OFL) · Pretendard(OFL)
- 아이콘: Tabler Icons(MIT)
