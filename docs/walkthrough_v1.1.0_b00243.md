# 어디있지? (Where Is It) 워크스루 - v1.1.0-b00243

## 📌 릴리즈 개요
- **릴리즈 버전**: `v1.1.0`
- **빌드 번호**: `b00243`
- **배포 ID**: `01a1e773-2c6c-7020-8e1a-6d8beee52f50`
- **작업 일시**: 2026-11-17
- **대상 사용자**: **Tauriqon님**

---

## 🛠️ 해결된 핵심 이슈 및 UI 개선

### 1. 태그 입력창 찌그러짐 및 추가 버튼 비정상 팽창 현상 해결
- **문제 현상**:
  - `b00242`에서 태그 입력창 옆에 추가한 `[추가]` 버튼이 화면 가로폭의 80% 이상을 차지하며 비정상적으로 길게 늘어나고, 반대로 태그 텍스트 입력창은 좌측에 20px 수준의 작은 네모로 찌그러져 텍스트를 입력하거나 확인할 수 없던 레이아웃 결함이 발생했습니다.
- **근본 원인**:
  - 공통 버튼 클래스인 `.btn-secondary`에 선언된 `width: 100%` 속성이 Flex 컨테이너 내에서 버튼의 basis를 100%로 팽창시켰고, 상대적으로 `<input>`은 `min-width: 0` 없이 flex가 압축되어 좌측으로 찌그러진 것입니다.
- **해결책**:
  1. **버튼 너비 최적화 (`width: auto`, `minWidth: 68px`, `flexShrink: 0`)**:
     - `.btn-secondary`의 `width: 100%`를 인라인 `width: auto`로 오버라이드하고, "추가" 글자에 딱 맞는 최소 너비(`68px`)를 지정하여 버튼이 불필요하게 늘어나지 않도록 고정했습니다.
  2. **입력창 확장 보장 (`flex: 1`, `minWidth: 0`, `width: 100%`)**:
     - Flex 컨테이너 내에서 축소되지 않고 화면의 남은 가로폭 전체(~85%)를 시원하게 채우도록 `minWidth: 0`과 `flex: 1`을 명시했습니다.
  3. **터치 타겟 및 높이 일원화 (`height: 46px`)**:
     - 토스 디자인 시스템 폼 규격에 맞추어 입력창과 추가 버튼의 높이를 `46px`로 완벽히 정렬하여 터치 편의성을 극대화했습니다.
  4. **전 화면 일괄 적용**:
     - `ItemDetailBottomSheet.tsx` (물건 정보 수정 바텀시트)
     - `AddTab.tsx` (물건 등록 탭)
     - `ExploreTab.tsx` (위치 탐색 탭 내 수정 시트)
     - `SearchTab.tsx` (검색 탭 내 수정 시트)

---

## 🔍 주요 변경 파일 내역

1. **`src/components/ItemDetailBottomSheet.tsx`**:
   - 태그 입력창 flex 비율 정상화 (`flex: 1, minWidth: 0`) 및 `[추가]` 버튼 너비 최적화 (`width: auto, minWidth: 68px`).
2. **`src/components/AddTab.tsx`**:
   - 물건 등록 탭 내 동일 레이아웃 비율 수정 및 높이 46px 정렬.
3. **`src/components/ExploreTab.tsx`**:
   - 위치 탐색 탭 내 동일 레이아웃 비율 수정.
4. **`src/components/SearchTab.tsx`**:
   - 검색 탭 내 동일 레이아웃 비율 수정.
5. **`src/version.ts`**:
   - `b00243` 빌드 번호 갱신.

---

## 🚀 검증 및 배포 결과
- **TypeScript 타입 체크**: `npx tsc --noEmit` 통과 (0 errors).
- **Vite & 앱인토스 빌드**: `npm run build` 성공.
- **배포 Deployment ID**: `01a1e773-2c6c-7020-8e1a-6d8beee52f50`.
