# 어디있지? (Where Is It?) - Walkthrough v1.1.0 (b00246)

## 📌 릴리즈 개요
- **버전**: `v1.1.0`
- **빌드 번호**: `b00246`
- **배포 ID (Deployment ID)**: `01a1e8c6-eb87-7009-9189-f0695f8fb2bb`
- **작업 일시**: 2026-11-17
- **핵심 목표**: 앱 로딩 시 발생하는 `Cannot access 'L' before initialization` ReferenceError 런타임 오류 즉시 긴급 수정

---

## 🔍 오류 원인 분석 (Root Cause Analysis)

### `Cannot access 'L' before initialization` (TDZ ReferenceError)
- 이전 빌드(b00245)에서 `ItemDetailBottomSheet.tsx`, `ExploreTab.tsx`, `SearchTab.tsx` 컴포넌트 상단(130~210번 라인)에 바텀시트 닫힘 감지용 `useEffect`를 작성하면서, 수백 라인 뒤쪽에 `const`로 선언되어 있던 `currentItem`과 `handleCancelEdit`을 `useEffect` 내부 및 의존성 배열(`[..., currentItem]`)에서 참조하였습니다.
- JavaScript ES6의 `const` 변수는 선언문이 실행되기 전까지 **TDZ(Temporal Dead Zone)** 상태에 놓이게 됩니다.
- 컴포넌트가 마운트/렌더링되는 시점에 `useEffect`의 의존성 배열을 평가하면서 선언되기 전의 `currentItem`에 접근하게 되었고, 이로 인해 `ReferenceError: Cannot access 'currentItem' before initialization` 에러가 발생하였습니다.
- Vite/Rollup 프로덕션 번들링 과정에서 `currentItem` 변수명이 `'L'`로 단축(Minify)되었기 때문에 화면에 `Cannot access 'L' before initialization.`으로 출력된 것입니다.

---

## 🛠️ 긴급 수정 내역

1. **상단 `useEffect`에서 TDZ 변수 의존성 완전 제거**:
   - `ItemDetailBottomSheet.tsx`, `ExploreTab.tsx`, `SearchTab.tsx` 상단의 시트 닫힘 감지 `useEffect`를 변수 선언 순서에 구애받지 않는 안전한 기존 형태로 원복하였습니다.
   - 선언 순서상 뒤쪽에 위치하던 `currentItem` 및 `handleCancelEdit` 참조를 상단 `useEffect`에서 완전히 제거하였습니다.
2. **드롭다운 및 폼 리셋 로직의 위치 정규화**:
   - 시트 닫기(`handleCloseSheet`, `handleCloseDetailModal`) 및 취소(`handleCancelEdit`) 시 필요한 드롭다운 닫기 및 폼 리셋 로직을 모든 변수가 정상 선언된 이후인 `handleCancelEdit()` 내부로 안전하게 일원화 배치하였습니다.

---

## 📁 파일별 수정 내역

| 파일명 | 변경 내용 |
|---|---|
| `src/components/ItemDetailBottomSheet.tsx` | 상단 `useEffect`에서 TDZ 변수(`currentItem`, `handleCancelEdit`, 드롭다운 상태) 참조 제거 및 `handleCancelEdit` 내부로 리셋 일원화 |
| `src/components/ExploreTab.tsx` | 상단 `useEffect`에서 TDZ 변수 참조 제거 및 `handleCancelEdit` 내부로 리셋 일원화 |
| `src/components/SearchTab.tsx` | 상단 `useEffect`에서 TDZ 변수 참조 제거 및 `handleCancelEdit` 내부로 리셋 일원화 |
| `src/version.ts` | 빌드 번호 `b00245` -> `b00246` 판올림 |

---

## 🧪 검증 결과 (Verification)
1. **타입스크립트 정적 검사**: `npx tsc --noEmit` 통과 (0 errors).
2. **프로덕션 빌드**: `npm run build` 정상 완료 (`deploymentId: 01a1e8c6-eb87-7009-9189-f0695f8fb2bb`).
3. **런타임 검증**: TDZ ReferenceError 원천 차단으로 앱 최초 진입 및 탭 전환 시 화면 로딩 오류 없이 정상 작동 확인.
