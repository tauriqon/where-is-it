# Walkthrough v1.1.0-b00263: 설정 3대 내비게이션 고속화 (반투명 스티키 헤더, 최상단 Top 플로팅 버튼, 하단 탭 메인 복귀)

## 1. 개요 및 사용자 요청사항
- **사용자 요청 (Tauriqon님)**:
  1. *"설정에서 각 항목으로 들어갔을때 다른 항목으로 가기가 불편하다. 현재는 뒤로가기(<-)을 눌러서 설정메인으로 나간후 다른 항목으로 들어가야 한다. 좀더 편하고 보기 좋은 방법이 없을지 아이디어를 협의해보자."*
  2. *"밑의 설정을 누르면 설정 메인 으로 나가면 어떨까?"*
  3. *"그럼 뒤로가기 버튼을 화면을 위로 스크롤해도 볼수 있도록 위치고정하는 방법은 어떨까? 그리고 반투명으로 처리하고."*
  4. *"추가로 밑으로 스크롤이 되었을때, 한번에 최상단으로 이동하는 버튼을 반투명 블러로 만드는거는 어떤가? 스크롤이 되었을때만 보여주는 걸로. 오른쪽 하단에."*

---

## 2. 주요 개선 내용

### 2.1. 하단 [설정] 탭 터치 시 설정 메인 홈 복귀 (Pop-to-Root)
- **파일**: `src/App.tsx` (`handleNavigateTab`)
- **작동 원리**:
  - 기존에는 설정 탭에 머물고 있을 때 하단 `[설정]` 아이콘을 다시 누르면 아무 동작도 하지 않고 무시(`return`)되었습니다.
  - 이제 서브페이지(`가족 동기화`, `보관위치 관리`, `내 호칭 변경`, `보관소 복구` 등)에 들어가 있는 상태에서 **하단 `[설정]` 탭을 한 번 더 터치하면, 0.1초 만에 설정 메인 홈(`main`)으로 즉시 복귀**하며 뷰포트가 최상단으로 부드럽게 스크롤됩니다.
  - 엄지손가락이 항상 머무는 최적의 동선에서 단 1번의 탭으로 언제든 설정 메인 목록으로 빠져나올 수 있습니다.

---

### 2.2. 상단 뒤로가기 헤더 반투명 블러 위치 고정 (Sticky Glassmorphic Header)
- **파일**: `src/components/SettingsTab.tsx` (`renderStickyHeader`)
- **적용 대상**: 모든 서브페이지 (`profile`, `recovery`, `sync`, `expiration`, `reset`, `manage`, `add`)
- **디자인 및 동작 사양**:
  - `position: sticky; top: -20px; z-index: 30;`
  - `background: rgba(255, 255, 255, 0.85);`
  - `backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`
  - `border-bottom: 1px solid rgba(0, 0, 0, 0.06);`
- **체감 효과**:
  - 화면을 아래로 아무리 길게 스크롤해도 상단에 `[←]` 뒤로가기 버튼과 페이지 제목이 **반투명 블러 유리창 스타일**로 항상 깔끔하게 고정됩니다.
  - 본문 카드가 헤더 뒤로 은은하게 비치며 지나가는 고급스러운 글래스모피즘(Glassmorphism) 효과를 제공합니다.
  - 36px 원형 반투명 뒤로가기 버튼과 햅틱 피드백을 적용하여 가볍고 경쾌한 터치감을 제공합니다.

---

### 2.3. 우측 하단 반투명 블러 최상단 이동(Top) 플로팅 버튼
- **파일**: `src/App.tsx`
- **디자인 및 동작 사양**:
  - **위치**: 우측 하단 네비게이션 바 바로 위 (`right: 18px`, `bottom: calc(84px + env(safe-area-inset-bottom))`).
  - **스타일**: 42px 둥근 원형 버튼, `background: rgba(255, 255, 255, 0.85)`, `backdrop-filter: blur(12px)`, 그림자(`box-shadow: 0 4px 16px rgba(0,0,0,0.12)`), `ChevronUp` 아이콘.
  - **스마트 노출**:
    - 스크롤이 최상단에 있을 때는 숨겨져 있다가(`opacity: 0, scale: 0.8, pointer-events: none`),
    - 스크롤이 **120px 이상 내려갔을 때만 부드러운 페이드인(`opacity: 1, scale: 1`)**으로 자연스럽게 등장합니다.
  - **원터치 점프**: 누르면 토스 햅틱 진동(`tap`)과 함께 화면이 최상단으로 매끄럽게 슝 스크롤됩니다.

---

## 3. 수정 파일 목록
1. `src/App.tsx`:
   - `mainScrollRef` 추가 및 스크롤 이벤트 감지 리스너 탑재
   - `handleNavigateTab`: 같은 탭 터치 시 Pop-to-Root (서브페이지 ➔ 메인 홈) 및 최상단 스크롤
   - 우측 하단 반투명 블러 Scroll-to-Top 플로팅 버튼 컴포넌트 추가
2. `src/components/SettingsTab.tsx`:
   - `renderStickyHeader` 유틸 컴포넌트 추가 (Sticky + 반투명 글래스 블러 + 36px 둥근 버튼)
   - 7개 서브페이지(`profile`, `recovery`, `sync`, `expiration`, `reset`, `manage`, `add`) 헤더 전면 교체
3. `src/version.ts` & `.env`: 버전 번호 `v1.1.0-b00263`로 갱신
