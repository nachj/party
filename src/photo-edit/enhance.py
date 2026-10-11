"""표지 사진 재보정(10-11 사용자 "너무 이상하게 편집") — 원본 색·질감 유지 · 가볍게만.
1) 4:5 자르기  2) 1200×1500 확대(Lanczos)  3) 아주 약한 잡티 정리(양방향 필터)  4) 약한 선명  5) 밝은 끝만 살짝 올리고 대비 약간 · 색 이동·입자 없음"""
import cv2, numpy as np, sys
SRC = '/home/rocky/wedding-invitation/src/photo-edit/original.jpg'   # 원본 사진은 저장소에 올리지 않음
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/rocky/wedding-invitation/party/src/photos/17-couple-cover-own.jpg'
img = cv2.imread(SRC)
h, w = img.shape[:2]; cw = int(h * 4 / 5); cx = 462
x0 = max(0, min(w - cw, cx - cw // 2)); img = img[:, x0:x0 + cw]
img = cv2.resize(img, (1200, 1500), interpolation=cv2.INTER_LANCZOS4)
img = cv2.bilateralFilter(img, 5, 12, 5)                                  # 카톡 압축 덩어리만 살짝
f = img.astype(np.float32) / 255
lab = cv2.cvtColor(f, cv2.COLOR_BGR2LAB); L = lab[..., 0] / 100
L = np.clip(L + 0.35 * (L - cv2.GaussianBlur(L, (0, 0), 1.2)), 0, 1)       # 약한 선명
lo, hi = np.percentile(L, 0.5), np.percentile(L, 99.5)
L = np.clip((L - lo) / (hi - lo) * (0.97 - 0.02) + 0.02, 0, 1)             # 흐린 하늘·흰 셔츠 살림
L = L + 0.06 * np.sin(2 * np.pi * (L - 0.5)) * -1 * 0 + 0.08 * (L - 0.5) * (1 - np.abs(2 * L - 1))   # 중간톤 대비 약간
lab[..., 0] = np.clip(L, 0, 1) * 100
lab[..., 1] *= 0.97; lab[..., 2] = lab[..., 2] * 0.97 + 1.0                # 채도 −3% · 아주 약간 따뜻하게
out = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
cv2.imwrite(OUT, np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 90])
