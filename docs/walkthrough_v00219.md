# 📐 WhereIsIt 토스 상단 네이티브 닫기 버튼([··· ✕]의 ✕) 종료 시 등록 이탈 방어 경고 구축 (v00219)

본 문서는 WhereIsIt 미니앱에서 **토스 앱 상단 네이티브 헤더의 [··· ✕] 중 ✕(닫기) 버튼을 터치하여 미니앱을 종료하려 할 때, 물건 등록(AddTab)에서 작성 중이던 내용이 있다면 `homeEvent`를 가로채어 취소/종료 확인 경고창을 띄우고 데이터가 임의로 유실되지 않도록 방어 시스템을 구축한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 개선 배경 및 사용자 피드백

1. **사용자 요청 사항 (Tauriqon님)**:
   - "... X 의 X 를 눌러서 종료시 경고가 않뜸"
2. **원인 분석**:
   - 기존에는 안드로이드/기기 뒤로가기 제스처인 `graniteEvent.addEventListener('backEvent')`만 구독하고 있었습니다.
   - 하지만 토스 네이티브 쉘 상단 우측에 위치한 **`[··· ✕]` 네이티브 닫기 버튼**을 탭할 때 토스 OS는 `backEvent`가 아닌 **`homeEvent`**를 발생시킵니다.
   - `homeEvent` 리스너가 등록되어 있지 않아 토스 네이티브 쉘이 미니앱을 곧바로 종료시키면서 작성 중이던 내용 확인 절차가 누락되었던 것입니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. 토스 네이티브 `homeEvent` 이벤트 구독 및 제어 (`src/App.tsx`)
- 토스 SDK의 `graniteEvent.addEventListener('homeEvent')`를 정식으로 등록하여 상단 ✕(닫기/홈) 버튼 터치를 앱에서 직접 가로챌 수 있도록 구현:
  ```tsx
  const handleHomeAction = () => {
    // 0. 확대 이미지 뷰가 열려있다면 닫기
    if (zoomedImageUrlRef.current) {
      handleCloseZoom();
      return;
    }

    // 1. 등록 탭 등에서 작성 중 이탈 가드가 등록되어 있는지 검사
    if (tabLeaveHandlersRef.current.length > 0) {
      for (const handler of tabLeaveHandlersRef.current) {
        const canLeave = handler('exit');
        if (!canLeave) {
          // 사용자가 취소를 눌러 종료를 거부함 -> 종료 중단
          return;
        }
      }
    }

    // 2. 바텀시트나 수정 중인 하위 핸들러(backHandlers)가 있는지 검사
    if (backHandlersRef.current.length > 0) {
      const handlers = backHandlersRef.current;
      for (let i = handlers.length - 1; i >= 0; i--) {
        const handled = handlers[i]();
        if (handled) return;
      }
    }

    // 3. 작성 중인 내용이 없거나 이탈이 승인된 경우 정상 종료
    try {
      closeView();
    } catch (e) {
      console.warn('Failed to call closeView:', e);
    }
  };
  ```

### 2.2. 등록 탭(AddTab) 미저장 데이터 보호
- 사용자가 물건 등록 화면에서 이름, 사진, 메모, 위치 등을 입력 중인 상태에서 상단 `✕` 버튼을 누르면:
  ```
  물건 등록을 취소하시겠습니까?
  작성 중인 내용이 초기화됩니다.
  ```
- **[취소] 선택 시**: `canLeave`가 `false`를 반환하여 `closeView()` 호출을 중단하고, 토스 앱이 종료되지 않은 채 등록 화면을 안전하게 유지.
- **[확인] 선택 시**: 입력 데이터 및 세션 드래프트를 초기화하고 `closeView()`를 호출하여 미니앱을 안전하게 닫음.
- **입력 내용이 없는 평상시(홈, 탐색, 검색, 빈 등록화면 등)**: 불필요한 팝업 없이 즉시 `closeView()`가 실행되어 산뜻하게 종료.

---

## 3. 변경 파일 목록

1. `src/App.tsx`:
   - `handleHomeAction` 구현 및 `graniteEvent.addEventListener('homeEvent')` 구독 연동
2. `src/version.ts` & `.env`:
   - 앱 버전을 `v00219`으로 업데이트

---

## 4. 검증 결과

1. **빌드 검증**:
   - `npm run build` 결과 Vite 및 앱인토스 패키징(`family-inventory.ait`) 0 에러로 빌드 완료.
2. **동작 검증**:
   - 등록 폼 작성 중 토스 앱 상단 우측의 `[··· ✕]` 중 `✕` 버튼을 눌렀을 때 취소 확인창 정상 노출.
   - [취소] 시 앱 종료가 차단되고 등록 화면 유지, [확인] 시 앱이 정상 종료됨.
