# 🔍 WhereIsIt 사진 확대(줌) 모달 WebKit 축소 버그 해결 및 레이아웃 최적화 (v00196)

본 문서는 WhereIsIt 미니앱에서 물건 상세 바텀시트 내 2단계(수납처) 및 3단계(세부위치) 사진 클릭 시, **사진이 모달 중앙에 약 49px×66px 크기의 아주 작은 썸네일로 찌그러져 표시되던 WebKit(Safari/토스 인앱 웹뷰) 렌더링 결함을 해결하고 모달 인터랙션을 전면 개선한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. [v00196] 원인 분석 및 기술적 배경

### 1.1. 원인: WebKit Flexbox Replaced Element 계산 결함 (Safari Flex Bug)
- 기존 확대 모달 구조는 `display: flex; align-items: center; justify-content: center;` 컨테이너의 직계 자식으로 `<img>` 태그를 두고, `maxWidth: 95%`, `maxHeight: 85%`, `objectFit: contain`만을 부여했습니다.
- iOS Safari 및 토스 인앱 브라우저(WebKit 엔진)에서는 직계 자식인 `<img>`에 명시적인 부모 래퍼나 `min-width: 0; min-height: 0; flex-shrink: 0;` 제약이 없을 경우, 플렉스 박스의 자동 최소 크기(`min-width/height: auto`)를 0 또는 최소 썸네일 크기로 잘못 계산하여 이미지를 극단적으로 축소(collapse)시키는 고질적인 WebKit 렌더링 버그가 발생합니다.
- 추가로 `@keyframes tossModalPop` 애니메이션이 종료 확인 모달 조건부 블록 내에만 인라인 선언되어 있어, 평상시 확대 모달 팝업 시 키프레임이 유실되는 부작용이 있었습니다.

---

## 2. 주요 개선 사항

### 2.1. Safari 대응 전용 이미지 래퍼 컨테이너 구축 (`src/App.tsx`)
- `<img>` 태그를 플렉스 직계 자식으로 두지 않고, `overflow: hidden`, `borderRadius: 16px`, `boxShadow`를 가진 전용 래퍼 컨테이너(`div`)로 감싸 WebKit의 치수 계산 루프를 원천 차단했습니다.
- 이미지에 `width: auto; height: auto; maxWidth: min(92vw, 440px); maxHeight: 82dvh; minWidth: 0; minHeight: 0; flexShrink: 0; objectFit: contain; display: block;`을 부여하여:
  - 가로/세로 비율을 온전히 보존하면서
  - 모바일 화면 가득 시원하고 선명하게 확대되도록 최적화했습니다.

### 2.2. 전역 애니메이션 키프레임 표준화 (`src/index.css`)
- 종료 모달 내부에 임시로 격리되어 있던 `@keyframes tossModalPop`을 `src/index.css`의 전역 애니메이션 영역으로 정식 승격 등록하여, 모든 모달 및 팝업 인터랙션에서 부드러운 토스식 탄성 팝 애니메이션이 항상 정상 재생되도록 통일했습니다.

### 2.3. 확대 모달 전용 햅틱 및 뒤로가기(Back Handler) 연동 강화 (`src/App.tsx`)
- 사진 확대 시 부드러운 햅틱 피드백(`triggerHaptic('light')`)을 제공하고, 사진 자체 탭 및 우측 상단 `✕` 버튼 탭을 통한 직관적인 닫기를 지원합니다.
- 안드로이드 하드웨어 뒤로가기 또는 토스 `backEvent` 발생 시, **확대된 사진 모달이 최우선으로 닫히도록 LIFO 스택 핸들러(`zoomedImageUrlRef`)를 연계**하여 사용자 편의성을 극대화했습니다.

---

## 3. 변경 파일 요약

1. `src/App.tsx`:
   - `zoomedImageUrlRef` 및 최우선 뒤로가기 핸들러 연동
   - 확대/닫기 시 햅틱 피드백(`handleOpenZoom`, `handleCloseZoom`) 적용
   - Safari Flexbox 축소 방지 래퍼 및 반응형 뷰포트(`100dvh`, `min(92vw, 440px)`) 구축
   - 종료 확인 모달 내 인라인 `<style>` 태그 정리
2. `src/index.css`:
   - `@keyframes tossModalPop` 전역 애니메이션 정의 추가
3. `src/version.ts`:
   - `APP_VERSION = 'v00196'`
4. `.env`:
   - `VITE_APP_VERSION=v00196`
5. `docs/walkthrough_v00196.md`:
   - 신규 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 4. 빌드 및 검증 결과

- `npm run build`: Vite 빌드 및 앱인토스 패키징(`family-inventory.ait`) 0건 오류 정상 완료.
- 모바일 화면 크기 및 WebKit 렌더링 안정성 확보 확인.
