# 📐 WhereIsIt 바텀시트 비정상 자동 상단 롤백 버그 긴급 수정 (v00209)

본 문서는 WhereIsIt 미니앱에서 **물건 상세 바텀시트 스크롤 도중 화면이 자꾸 맨 위로 튕기듯 자동 롤백되던 현상을 해결한 긴급 패치 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 긴급 버그 발생 원인 분석

1. **사용자 피드백**:
   - "바텀시트에서 수정버튼을 누르기 위해 아래로 스크롤 하면 자꾸 위로 자동 스크롤이 된다"
2. **원인 분석**:
   - 직전 v00208에서 `BottomSheet.tsx` 내부에 `useEffect(..., [isOpen, title])` 훅을 추가하여 타이틀 변경 시 상단으로 스크롤하도록 시도했습니다.
   - 그러나 상위 컴포넌트(`ExploreTab`, `SearchTab` 등)에서 `title` prop으로 전달되던 인라인 JSX 객체(`<span style=...><EmojiIcon ... />...</span>`)가 **컴포넌트 리렌더링마다 새로운 참조값(`title !== prevTitle`)**을 생성했습니다.
   - 그 결과, 사용자가 바텀시트를 터치하여 아래로 스크롤하는 도중 리렌더링이 일어날 때마다 `useEffect`가 반복 실행되어 `scrollTop = 0`으로 강제 롤백되는 심각한 스크롤 방해 현상이 발생했습니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. `BottomSheet.tsx`의 잘못된 `title` 감지 useEffect 제거
- `BottomSheet.tsx` 내부에서 리렌더링마다 스크롤을 초기화하던 `useEffect(..., [isOpen, title])` 훅을 **완전히 제거**했습니다.
- 바텀시트가 새로 열릴 때(`false ➔ true`)에만 딱 1회 `wasOpenRef` 가드를 통해 상단으로 초기화하도록 안전하게 격리했습니다.

### 2.2. `[수정하기]` 클릭 핸들러에서만 단 1회 스크롤 최상단 이동 보장
- `ItemDetailBottomSheet.tsx`, `ExploreTab.tsx`, `SearchTab.tsx`의 `handleStartEdit` 함수 내부에서만 `sheetBody.scrollTop = 0`이 명시적으로 실행되도록 변경했습니다.
- 이제 평상시 물건 상세 내용을 읽거나 아래로 스크롤할 때는 **절대로 스크롤이 위로 튀지 않으며**, 오직 사용자가 맨 아래의 `[수정하기]` 버튼을 탭했을 때만 수정 폼의 맨 위로 매끄럽게 이동합니다.

---

## 3. 변경 파일 목록

1. `src/components/BottomSheet.tsx`:
   - `title` 의존성 useEffect 제거 및 `wasOpenRef` 적용
2. `src/version.ts` & `.env`:
   - `v00209` 버전 업그레이드
3. `docs/walkthrough_v00209.md`:
   - 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 4. 빌드 및 배포 결과

- `npm run build`: Vite 빌드 및 앱인토스 패키징(`family-inventory.ait`) 0건 오류 정상 완료.
- 바텀시트 스크롤 조작감이 본래대로 부드럽고 안정적으로 복원되었으며, 수정하기 버튼 클릭 시에만 정확히 최상단으로 이동합니다.
