# Walkthrough v00221 - 바텀시트 위치 상향 조정 (상단 브랜드 헤더 하단 정렬)

## 1. 개요 (Overview)
* **목적**: 바텀시트(물건 상세정보, 수납처 상세정보, 보관위치 선택 등)가 열렸을 때 화면 상단에 남던 과도한 여백을 줄이고, 뒤배경의 최상단 브랜드 헤더(`[아이콘] 어디 뒀더라?`) 바로 아래까지 시트가 올라오도록 위치 및 높이를 최적화합니다.
* **사용자 요청 사항**:
  > "바텀시트의 위치를 현재보다 위쪽으로 올리자. 내 생각에는 뒤배경의 [아이콘] [어디 뒀더라?] 밑까지 올리면 좋겠는데."

---

## 2. 주요 변경 사항 (Key Changes)

### 2.1 CSS 헤더 높이 연동 및 바텀시트 높이 조정 (`src/index.css`)
* `:root`에 브랜드 헤더 기준 높이 변수 `--header-height: 56px;` 추가.
* `.bottom-sheet`의 높이를 고정/최대 비율(`max-height: 85%`)에서 헤더 기준 동적 계산식으로 변경:
  ```css
  .bottom-sheet {
    width: 100%;
    background-color: var(--bg-app);
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
    padding: 0;
    height: calc(100% - var(--header-height, 56px));
    max-height: calc(100% - var(--header-height, 56px));
    display: flex;
    flex-direction: column;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.08);
    animation: slideUp var(--transition-bounce) forwards;
    position: relative;
    overflow: hidden;
  }
  ```
* 필요 시 자동 높이를 사용할 수 있도록 보조 클래스 `.bottom-sheet--auto-height { height: auto; }` 추가.

### 2.2 앱 상단 브랜드 헤더 높이 일관성 보장 (`src/App.tsx`)
* `<header>`에 `className="app-brand-header"` 및 `height: 'var(--header-height, 56px)'`, `minHeight: 'var(--header-height, 56px)'`, `boxSizing: 'border-box'`를 적용하여 토스 인앱 및 일반 브라우저 환경에서 높이가 일관되게 56px로 유지되도록 보장.
* 헤더 내부의 `[아이콘] 어디 뒀더라?`와 우측 보관소/가족 공유 뱃지가 56px 세로 중앙에 완벽하게 정렬되도록 조정.

### 2.3 바텀시트 컴포넌트 확장성 강화 (`src/components/BottomSheet.tsx`)
* `BottomSheetProps`에 `className`, `style`, `autoHeight` 옵션 지원 추가.
* 상단 드래그 핸들 및 닫기 버튼은 그대로 유지되며, 배경 딤 영역(상단 56px 헤더 영역) 터치 시 시트가 닫히는 토스 네이티브 UX 완벽 보장.

---

## 3. 검증 결과 (Verification)
* **빌드**: `npm run build` (`vite build && ait build`) 성공 (번들 `family-inventory.ait` 정상 생성).
* **시각적 정렬**:
  * 바텀시트가 열릴 때 딤(Backdrop) 뒤로 상단의 `[아이콘] 어디 뒀더라?` 브랜드 헤더가 명확하게 보임.
  * 바텀시트의 상단 라운드 모서리가 헤더 바로 아래 라인(56px)에 딱 맞추어 올라옴.
  * 물건 상세 정보, 수납처 상세 정보 등 내용이 많은 시트에서 스크롤 여유 공간이 대폭 확장되어 한눈에 더 많은 정보를 시원하게 확인 가능.
