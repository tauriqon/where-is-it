# 📦 WhereIsIt 홈 화면 물건 상세 바텀시트 종료 시 홈 화면 유지 및 직관적 위치 이동 (v00191)

본 문서는 WhereIsIt 미니앱에서 사용자가 홈 화면([최근 활동 물건], [유통기한 도래 물건])에서 물건을 선택했을 때 강제로 [위치 탐색] 탭으로 이동하던 기존 방식을 개선하여, **홈 화면 위에서 물건 상세 바텀시트를 즉시 열람**하고 바텀시트 종료(`[X]`, 오버레이 터치, 뒤로가기) 시 **홈 화면에 그대로 머무르도록** 개편한 작업 내역을 정리한 워크스루(Walkthrough)입니다.

또한 보관 위치를 직접 둘러보고 싶을 때는 바텀시트 내 **[보관 위치] 카드**를 터치하여 의도적으로 [위치 탐색] 탭으로 이동할 수 있도록 역할을 명확히 분리했습니다.

---

## 1. [v00191] 개선 배경 및 문제 해결 (As-Is vs To-Be)

### 1.1. 기존 문제점 (As-Is)
- 홈 화면에서 최근 등록/수정된 물건이나 유통기한 임박 물건을 탭했을 때 `onNavigateTab('explore', ...)`가 호출되어 **탭 자체가 [위치 탐색]으로 강제 전환**되었습니다.
- 사용자는 단순히 물건 정보를 살짝 확인(Peek)하려던 것인데, 바텀시트를 닫으면 홈 화면이 아니라 낯선 탐색 화면에 남겨져 *"어? 내가 왜 여기 있지?"* 하는 컨텍스트 이탈과 혼란(Disorientation)이 발생했습니다.
- 다시 홈 화면으로 가기 위해 하단 네비게이션 탭 바에서 [홈]을 다시 눌러야 하는 불필요한 이동 피로도가 존재했습니다.

### 1.2. 개편 후 동작 (To-Be)
- **홈 화면 컨텍스트 유지**:
  - 홈 화면에서 물건을 누르면 **홈 화면 위에 오버레이로 물건 상세 바텀시트**가 바로 열립니다.
  - 바텀시트 닫기(`[X]`, 오버레이 탭, 안드로이드/토스 뒤로가기 버튼) 시 **홈 화면에 온전히 복귀**합니다.
- **능동적이고 직관적인 위치 탐색 이동**:
  - 물건의 보관 위치를 직접 확인하거나 주변 물건들을 탐색하고 싶을 때는, 바텀시트 내 **`[보관 위치: 공간 > 수납처 > 세부위치]` 카드**를 터치하면 `[위치 탐색]` 탭의 해당 보관 위치로 즉시 이동합니다.
  - 보관 위치 카드 우측에 `위치 바로가기 >` 안내 텍스트와 인터랙티브 피드백을 추가하여, 누르면 해당 위치로 이동한다는 점을 시각적으로 명확히 전달합니다.

```text
┌──────────────────────────────────────────────┐
│ [  ㅡ  ] (드래그 핸들)                         │
│ 비상약 상자 🔒개인                         [ X ]│  <-- 물건명 고정 헤더
├──────────────────────────────────────────────┤
│ [                물건 사진                    ] │  <-- 터치 시 사진 확대
│                                              │
│ [보관 위치               위치 바로가기 >]      │  <-- 탭하면 [위치 탐색]으로 이동!
│ 거실 > 수납장 > 1번 서랍                        │
│                                              │
│ 보관 수량: 1개  /  유통기한: 2026-10-15 [⚠️] │
│ [      수정하기      ]  [      삭제하기      ]│
└──────────────────────────────────────────────┘
```

---

## 2. 세부 구현 내용

### 2.1. 공통 컴포넌트 `ItemDetailBottomSheet.tsx` 신규 구축
- **파일**: [`src/components/ItemDetailBottomSheet.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/ItemDetailBottomSheet.tsx)
- **주요 기능**:
  - **헤더 표준화(v00190 규격)**: 상단 타이틀에 물건 이름 및 `🔒 개인` 뱃지 고정 표시.
  - **인터랙티브 보관 위치 카드**:
    - `onNavigateToLocation?: (sectionId: string) => void` 콜백 연동.
    - `toss-card-interactive` 스타일 및 `위치 바로가기 >` 표시.
    - 보관처/세부위치 사진 클릭 시는 버블링을 방지하여 사진 확대(`onZoomImage`)로 연결.
  - **수정 및 삭제 풀 지원**: 홈 화면에서 열람 중에도 [수정하기], [삭제하기]가 완벽히 동작.
  - **뒤로가기 핸들러 연동**: 토스 및 모바일 네이티브 뒤로가기(`backEvent`) 시 바텀시트 우선 종료.

### 2.2. 홈 탭 연동 (`HomeTab.tsx`)
- **파일**: [`src/components/HomeTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/HomeTab.tsx)
- **주요 변경**:
  - `viewItemId`, `isItemDetailOpen` 상태 신설.
  - [최근 활동 물건] 및 [유통기한 도래 물건] 카드 클릭 시 `setViewItemId(item.id)` + `setIsItemDetailOpen(true)`로 홈 화면 위에서 바텀시트 오픈.
  - [외 N개 전체보기] 바텀시트 내부 아이템 클릭 시에도 전체보기 시트를 닫고 물건 상세 시트로 자연스럽게 전환.
  - 보관 위치 바로가기 터치 시에만 `onNavigateTab('explore', { sectionId })`로 위치 탐색 탭 전환.

### 2.3. 메인 앱 연동 (`App.tsx`)
- **파일**: [`src/App.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/App.tsx)
- `HomeTab`에 `onZoomImage={setZoomedImageUrl}`를 전달하여 홈 화면에서 열린 물건 사진 터치 시 전체화면 이미지 줌 기능 지원.

---

## 3. 변경 파일 요약

1. `src/components/ItemDetailBottomSheet.tsx` [NEW]:
   - 공통 물건 상세 및 수정 바텀시트 컴포넌트 신규 작성
2. `src/components/HomeTab.tsx` [MODIFY]:
   - 물건 선택 시 홈 화면 유지 및 ItemDetailBottomSheet 렌더링
   - 보관 위치 클릭 시에만 탐색 탭 이동
3. `src/App.tsx` [MODIFY]:
   - HomeTab에 `onZoomImage` 전달
4. `src/version.ts` [MODIFY]:
   - `APP_VERSION = 'v00191'`
5. `.env` [MODIFY]:
   - `VITE_APP_VERSION=v00191`
6. `docs/walkthrough_v00191.md` [NEW]:
   - 버전 상세 워크스루 문서 작성

---

## 4. 빌드 및 배포 검증

- **Vite & 앱인토스 빌드**: `npm run build` 정상 통과 (0 errors, `family-inventory.ait` 패키징 완료).
- **시나리오 검증**:
  - 홈 화면에서 물건 카드 클릭 ➔ 화면 탭 전환 없이 바텀시트 정상 노출.
  - 바텀시트 `[X]` 닫기 ➔ 홈 화면 유지 확인.
  - 바텀시트 내 `[보관 위치]` 카드 클릭 ➔ `[위치 탐색]` 탭으로 전환되며 해당 보관 위치로 정상 이동 확인.
