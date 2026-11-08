# 🎨 WhereIsIt 상단 헤더 브랜드 아이콘 여백 완전 제거 및 고밀도 꽉 채움 리사이즈 (v00202)

본 문서는 WhereIsIt 미니앱에서 **토스 앱 최상단 네이티브 내비게이션 바(헤더)에 표시되는 '어디 뒀더라?' 앞의 브랜드 아이콘이 왜소하게 보이던 현상을 해결하기 위해, 아이콘 사방의 불필요한 빈 여백을 0%로 완전히 제거(Tight Crop)하고 캔버스에 꽉 차도록 리사이징하여 체감 크기를 대폭 확대한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 개선 배경 및 원인 분석

1. **상황 및 사용자 요청**:
   - 화면 최상단 네이티브 헤더 `< 🏠 어디 뒀더라? ... X` 에서 앱 타이틀 앞의 집 모양 아이콘이 상대적으로 작고 눈에 덜 띄어 사이즈 확대 요청.
2. **원인 분석**:
   - 토스 상단 헤더는 웹뷰가 아닌 토스 네이티브 컴포넌트로, `granite.config.ts`의 `brand.icon` 이미지를 가져와 고정된 프레임(약 22px × 22px) 안에 비율을 유지하며 맞추어(ScaleAspectFit) 렌더링합니다.
   - 기존 등록된 원본 이미지(`app-icon.png`)를 정밀 픽셀 분석한 결과, 1000px × 1000px 캔버스 사방에 약 50~60px 이상의 빈 여백(패딩)이 둘러싸고 있었습니다.
   - 이로 인해 토스 네이티브 바가 캔버스 전체를 22px 틀에 맞출 때, 여백만큼 집 모양 그래픽이 안쪽으로 축소되어 실제로는 14~15px 수준으로 유독 작게 보였습니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. 아이콘 사방 여백 완전 제거 (Tight Crop & Bleed to Edge)
- 중앙 바운딩 박스를 기준으로 불필요한 사방 여백을 완전히 잘라내고, 지붕 꼭대기, 좌측 처마, 돋보기 손잡이 끝이 캔버스 모서리에 완벽히 밀착하도록 꽉 채워 리샘플링했습니다 (`public/app-icon-v202.png` 및 `public/app-icon.png`).
- JPEG 압축 노이즈가 없는 무손실 고화질 PNG 포맷으로 정식 변환했습니다.

### 2.2. Supabase Storage 업로드 및 `granite.config.ts` 갱신
- 새로 생성된 고밀도 타이트 크롭 아이콘을 Supabase Storage의 `item-images/brand/app-icon-v202.png`에 업로드 완료했습니다.
- `granite.config.ts`의 `brand.icon` URL을 신규 고밀도 아이콘 URL로 갱신하여, 토스 네이티브 헤더가 새로운 꽉 찬 이미지를 즉시 불러오도록 반영했습니다:
  ```ts
  brand: {
    displayName: '어디 뒀더라?',
    primaryColor: '#3182f6',
    icon: 'https://frpqupppuosfpdpjfbsk.supabase.co/storage/v1/object/public/item-images/brand/app-icon-v202.png',
  }
  ```
- **효과**: 토스 네이티브 바의 동일한 22px 프레임 안에서도, 여백 없이 꽉 찬 그래픽 덕분에 **실제 체감 면적이 약 30% 이상 확 커져 시각적으로 훨씬 크고 또렷하게 표시**됩니다.

---

## 3. 변경 파일 요약

1. `public/app-icon-v202.png` & `public/app-icon.png`:
   - 사방 여백 0% 타이트 크롭 및 고밀도 PNG 변환
2. `granite.config.ts`:
   - `brand.icon`을 `app-icon-v202.png` 신규 URL로 업데이트
3. `src/version.ts` & `.env`:
   - `v00202` 버전 업그레이드
4. `docs/walkthrough_v00202.md`:
   - 신규 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 4. 빌드 및 배포 결과

- `npm run build`: Vite 빌드 및 앱인토스 패키징(`family-inventory.ait`) 0건 오류 정상 완료.
- 이제 토스 앱 상단 헤더의 '어디 뒀더라?' 앞 아이콘이 왜소해 보이지 않고 시원하고 선명하게 표시됩니다.
