# 아 찾았다! (Where is it?) - v1.1.0 (b00264) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-21  
**대상 버전**: `v1.1.0 (b00264)`  
**작업 요약**: 최상단 이동(Scroll-to-Top) 버튼 스크롤 이벤트 감지 버그 수정 및 설정 상단 고정 헤더 반투명 블러 투명도 향상 (frosted glass aesthetic)

---

## 1. 문제 원인 분석 (Root Cause Analysis)

### 1) 최상단 이동(Scroll-to-Top) 버튼 미노출 버그
- **이전 상황 (`b00263`)**:
  - `src/App.tsx`에서 `useEffect(() => { ... }, [])`로 최초 마운트 시에만 `mainScrollRef.current`에 스크롤 이벤트 리스너를 바인딩하도록 구현되었습니다.
  - 하지만 앱 최초 마운트 시 `authLoading && !user` 조건에 의해 세션 확인 전체 화면 스피너가 먼저 렌더링되므로, `<main ref={mainScrollRef}>` DOM 요소가 아직 존재하지 않았습니다(`null`).
  - 이로 인해 이벤트 리스너가 실제로 부착되지 못하고 종료되었으며, 사용자 세션이 로드된 후에도 `deps: []` 때문에 리스너가 영구적으로 재부착되지 않아 스크롤 이벤트가 전혀 발생하지 않았습니다.
  - 또한 z-index가 `89`로 설정되어 있어 하단 탭 바(`zIndex: 100`) 등에 가려질 수 있는 구조였습니다.

### 2) 설정 서브페이지 상단 헤더 투명도 문제
- 기존 헤더 배경색이 `rgba(255, 255, 255, 0.85)`로 불투명도가 높아, 화면을 위로 스크롤할 때 밑으로 지나가는 카드와 텍스트 등의 내용이 가려져 반투명 효과가 체감되지 않았습니다.

---

## 2. 주요 개선 및 수정 사항

### 1) 스크롤 감지 다중 보장 (Double-Guaranteed Scroll Binding)
- `<main className="scrollable safe-top" ref={mainScrollRef} onScroll={handleMainScroll}>`:
  - JSX 요소에 직접 React 합성 이벤트 `onScroll={handleMainScroll}`을 바인딩하여 DOM 마운트 타이밍과 관계없이 스크롤 발생 즉시 100% 감지되도록 수정하였습니다.
- `useEffect` 의존성 배열에 `[user, authLoading, activeTab, settingsSubPage]`를 지정하고, `mainEl` 및 `window` 양측에 스크롤 리스너를 부착하여 어떤 환경(iOS Safari, 데스크톱 시뮬레이터, 웹뷰 등)에서도 스크롤이 누락되지 않도록 다중 보장하였습니다.
- 스크롤 표시 임계값을 `40px`로 최적화하여 사용자가 화면을 조금만 스크롤해도 부드럽게 최상단 이동 버튼이 나타나도록 하였습니다.

### 2) 최상단 이동 버튼 UI/UX 고도화
- **위치 기준**: `position: 'absolute'`로 설정하여 `.app-wrapper` 내부(데스크톱 시뮬레이터 및 모바일 전체 화면) 우측 하단(`bottom: 86px + safe-area`, `right: 18px`)에 정확히 고정.
- **레이어 계층**: `zIndex: 110`으로 설정하여 하단 탭 바(`zIndex: 100`)보다 항상 상위에 안정적으로 떠 있도록 보장.
- **스타일링**:
  - 배경: `rgba(255, 255, 255, 0.65)` + `backdropFilter: blur(16px)` 프로스티드 글래스.
  - 크기: 44px × 44px, 원형, 부드러운 그림자(`boxShadow: 0 4px 16px rgba(0, 0, 0, 0.14)`).
  - 아이콘: `<ChevronUp size={24} strokeWidth={2.8} />`.
  - 클릭 동작: 햅틱 진동(`triggerHaptic('tap')`)과 함께 부드러운 스크롤(`scrollTo({ top: 0, behavior: 'smooth' })`).

### 3) 상단 고정 헤더 투명도 및 프로스티드 글래스 강화
- `src/components/SettingsTab.tsx`의 `renderStickyHeader`:
  - 배경 투명도: `rgba(255, 255, 255, 0.85)` ➔ `rgba(255, 255, 255, 0.55)` (투명도를 높여 스크롤되는 내용이 반투명 블러 너머로 은은하게 보이도록 개선).
  - 블러 강도: `blur(12px)` ➔ `blur(16px)`로 강화하여 심미적인 iOS/토스풍 프로스티드 글래스 룩앤필 완성.
  - 뒤로가기 버튼: `rgba(255, 255, 255, 0.72)` 배경 + `1px solid rgba(0,0,0,0.08)` 보더 및 소프트 섀도우를 추가하여 스크롤되는 내용 위에서도 가독성과 탭 영역이 선명하게 유지되도록 처리.

---

## 3. 검증 결과
- `npm run build` 정상 완료 (`family-inventory.ait` 번들 생성 성공).
- 스크롤 발생 시 `showScrollTop` 플래그가 정상적으로 `true`로 전환되며 최상단 이동 버튼이 스케일/페이드 애니메이션과 함께 등장.
- 상단 헤더 아래로 카드가 통과할 때 반투명 블러 효과를 통해 밑의 내용이 고급스럽게 비침.
