# 📐 WhereIsIt 바텀시트 수정 모드 전환 시 최상단 자동 스크롤 개선 (v00208)

본 문서는 WhereIsIt 미니앱에서 **물건 상세 바텀시트에서 `[수정하기]` 버튼을 탭했을 때, 수정 폼의 최상단(물건 이름 및 사진)으로 스크롤이 즉시 자동 이동하도록 개선한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 개선 배경 및 사용자 피드백

1. **상황 및 사용자 피드백**:
   - "바텀시트에서 수정하기 를 선택하면 바텀시트의 맨 위로 이동 하자."
   - "그리고 이 화면에서 위치 수정 카드에서 기존 위치 정보는 선택이 가능한데, 만일 새로운 공간, 수납처, 세부 위치 를 추가하려면?"
2. **원인 분석**:
   - 사용자가 물건 상세 바텀시트에서 하단으로 스크롤하여 맨 아래의 `[수정하기]` 버튼을 누르면, 화면이 수정 모드로 바뀌어도 바텀시트의 내부 스크롤 위치가 하단에 그대로 머물러 있었습니다.
   - 이로 인해 수정 폼의 상단에 있는 물건 이름, 수량, 사진 변경 등의 핵심 입력란이 보이지 않아 사용자가 매번 손으로 맨 위까지 다시 스크롤해야 하는 불편이 있었습니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. `BottomSheet.tsx` 코어 컴포넌트 자동 스크롤 기능 내장
- 바텀시트 본문 스크롤 컨테이너(`.bottom-sheet-body`)에 `bodyRef`를 연결했습니다.
- 바텀시트가 열리거나(`isOpen`), 모드 전환으로 인해 타이틀(`title`)이 변경될 때(예: `물건 상세 정보` ➔ `물건 정보 수정`), 즉시 `scrollTop = 0`으로 초기화하도록 `useEffect` 트리거를 내장했습니다.

### 2.2. 각 탭의 `handleStartEdit` 이벤트 핸들러 이중 보장
- `ItemDetailBottomSheet.tsx` (홈 탭)
- `ExploreTab.tsx` (탐색 탭)
- `SearchTab.tsx` (검색 탭)
- 세 곳 모두에서 `handleStartEdit` 실행 시 `sheetBody.scrollTop = 0`을 즉시 호출하도록 안전장치를 적용했습니다.

---

## 3. 변경 파일 목록

1. `src/components/BottomSheet.tsx`:
   - `bodyRef` 및 `useEffect` 스크롤 초기화 로직 구현
2. `src/components/ItemDetailBottomSheet.tsx`:
   - `handleStartEdit` 내 `scrollTop = 0` 처리
3. `src/components/ExploreTab.tsx`:
   - `handleStartEdit` 내 `scrollTop = 0` 처리
4. `src/components/SearchTab.tsx`:
   - `handleStartEdit` 내 `scrollTop = 0` 처리
5. `src/version.ts` & `.env`:
   - `v00208` 버전 업그레이드
6. `docs/walkthrough_v00208.md`:
   - 신규 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 4. 빌드 및 배포 결과

- `npm run build`: Vite 빌드 및 앱인토스 패키징(`family-inventory.ait`) 0건 오류 정상 완료.
- 이제 물건 상세 화면 하단에서 `[수정하기]`를 누르면 즉각 수정 폼의 최상단(이름 및 사진 영역)으로 부드럽게 이동하여 쾌적한 수정 작업이 가능합니다.
