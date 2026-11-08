# 📐 WhereIsIt 등록 탭 작성 중 다른 탭 이탈 시 취소 확인 경고 및 방어 가드 구현 (v00217)

본 문서는 WhereIsIt 미니앱에서 **물건 등록 화면(AddTab)에서 작성 도중 [저장]이나 [취소]를 누르지 않고 하단 네비게이션 탭(홈, 탐색, 검색, 설정 등)을 탭하여 이탈할 때, [취소] 버튼과 동일하게 경고 확인창을 띄워 작성 중인 데이터가 임의로 유실되거나 방치되는 것을 방지하도록 탭 전환 가드(Navigation Guard)를 구현한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 개선 배경 및 사용자 피드백

1. **사용자 요청 사항**:
   - "등록 화면에서 입력중 저장 이나 취소 를 선택하지 않고 홈이나 다른 탭을 선택할 경우 취소 를 눌렀을때와 같이 경고 메시지 창을 보여 주는게 어떨까?"
   - 선택된 동작 옵션: **"(권장) 취소 버튼과 동일하게 경고창을 띄우고, 확인 시 내용 초기화 후 해당 탭으로 이동 (취소 시 화면 유지)"**

2. **문제점 분석**:
   - 기존에는 등록 탭에서 물건 이름, 수량, 사진 등을 입력하다가 하단 네비게이션 바(홈, 위치 탐색, 검색, 설정 등)를 터치하면 경고 없이 즉시 탭이 전환되었습니다.
   - 스마트폰 특성상 키보드나 화면 하단을 조작하다가 실수로 하단 탭을 건드리는 경우가 잦아, 작성 중이던 작업 컨텍스트를 의도치 않게 이탈할 위험이 있었습니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. 탭 전환 가드 인터셉터 시스템 구축 (`src/App.tsx`)
- `tabLeaveHandlersRef` 및 `registerTabLeaveHandler` 등록 API 구현:
  ```tsx
  const tabLeaveHandlersRef = React.useRef<((targetTab: string, params?: any) => boolean)[]>([]);

  const registerTabLeaveHandler = (handler: (targetTab: string, params?: any) => boolean) => {
    tabLeaveHandlersRef.current.push(handler);
    return () => {
      tabLeaveHandlersRef.current = tabLeaveHandlersRef.current.filter(h => h !== handler);
    };
  };
  ```
- `handleNavigateTab` 실행 시 등록된 탭 가드 핸들러를 순회 검사하여, 핸들러가 `false`를 반환할 경우 탭 이동을 즉시 중단하고 현재 등록 탭에 머무르도록 제어.
- `<AddTab registerTabLeaveHandler={registerTabLeaveHandler} ... />`로 핸들러 주입.

### 2.2. 등록 탭 미저장 데이터 감지 및 확인 모달 연동 (`src/components/AddTab.tsx`)
1. **작성 중 내용 정밀 판별 (`checkHasContent`)**:
   - 물건 이름, 메모/설명, 사진(파일/프리뷰), 태그, 유통기한, 선택된 위치(공간/수납처/세부위치) 중 하나라도 입력되어 있는지 확인.
2. **이탈 시도시 경고창 출력**:
   - 작성 중인 내용이 있을 때 다른 탭으로 이동하려고 하면:
     ```
     물건 등록을 취소하시겠습니까?
     작성 중인 내용이 초기화됩니다.
     ```
   - **[취소] 선택 시**: `return false;` → 탭 이동 중단, 작성 중인 폼 화면과 입력 데이터 완벽 유지.
   - **[확인] 선택 시**: 입력 데이터 및 세션 드래프트(`wii_add_item_draft`)를 깨끗하게 초기화하고 타겟 탭으로 이동 허용.
3. **입력 내용이 없을 때 (클린 상태)**:
   - 아무런 입력도 하지 않은 상태에서는 경고창 없이 다른 탭으로 즉시 부드럽게 이동.
4. **예외 처리 (의도된 서브 네비게이션 지원)**:
   - 등록 도중 **[+ 새 공간 추가]**, **[+ 새 수납처 추가]** 버튼을 눌러 보관 위치를 추가하러 가는 경우(`handleRedirectToLocationAdd`), 드래프트를 보존한 채로 이동해야 하므로 경고창을 띄우지 않고 정상 통과되도록 예외 처리.
   - 폼 하단의 **[취소]** 버튼 클릭이나 **[저장]** 완료 시에도 플래그(`isNavigatingAwayRef`)를 통해 확인창이 두 번 뜨는 일이 없도록 방어.

---

## 3. 변경 파일 목록

1. `src/App.tsx`:
   - `tabLeaveHandlersRef` 및 `registerTabLeaveHandler` 시스템 추가
   - `handleNavigateTab` 내 탭 이탈 가드 검사 로직 적용
   - `AddTab` 컴포넌트에 `registerTabLeaveHandler` 전달
2. `src/components/AddTab.tsx`:
   - `AddTabProps`에 `registerTabLeaveHandler` 추가
   - `checkHasContent()` 및 탭 가드 `useEffect` 등록
   - `handleCancel`, `handleSubmit` 이탈 플래그 연동 및 드래프트 자동 저장 최적화
3. `src/version.ts` & `.env`:
   - 앱 버전을 `v00217`으로 업데이트

---

## 4. 검증 결과

1. **빌드 검증**:
   - `npm run build` 결과 Vite 및 AIT 패키징(`family-inventory.ait`) 0 에러로 빌드 성공.
2. **동작 검증**:
   - 등록 탭에서 물건 이름이나 위치 등을 입력 중 하단 탭(홈/탐색/검색/설정) 클릭 시 `물건 등록을 취소하시겠습니까?` 확인창 표시.
   - 취소 선택 시 현재 등록 화면 유지, 확인 선택 시 내용 초기화 후 해당 탭으로 정상 이동.
   - 아무것도 입력하지 않았을 때는 경고 없이 즉시 다른 탭으로 이동.
   - 새 공간/수납처 추가 플로우에서는 경고 없이 이동 및 드래프트 복원 지원.
