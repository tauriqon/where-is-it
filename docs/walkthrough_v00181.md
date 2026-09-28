# 📦 WhereIsIt 바텀시트 헤더 위치 고정 및 원형 닫기 버튼 적용 (v00181)

본 문서는 WhereIsIt 토스 인앱 미니앱에서 바텀시트(BottomSheet)를 닫으려다 토스 네이티브 상단바의 `[✕]`(앱 종료)를 잘못 터치하여 앱이 종료되던 오조작을 원천 차단하기 위해, **바텀시트 상단 헤더(`[타이틀 + 원형 닫기 버튼]`)의 스크롤 위치를 상단에 고정**하고 **토스 표준 스타일의 명확한 원형 회색 닫기 버튼**을 적용하며, **안드로이드/토스 뒤로가기 시 바텀시트가 우선 닫히도록 개선**한 작업 내역을 정리한 워크스루(Walkthrough)입니다.

---

## 1. [v00181] 주요 변경 및 개선 사항

### 1.1. 배경 및 문제점 해소
- **상단 네이티브 닫기와의 혼선 및 오조작 방지**:
  - 기존에는 바텀시트 닫기 버튼이 단순한 텍스트 형태(`✕`)였으며, 토스 네이티브 헤더의 우측 상단 `[✕]`와 형태가 유사하여 닫기를 누르려다 앱 자체를 종료해버리는 문제가 있었습니다.
- **바텀시트 헤더 고정 (스크롤 분리)**:
  - 내용(물건 목록)을 아래로 스크롤하더라도 `[유통기한 도래 물건 (N)]` 타이틀과 `[원형 닫기 버튼]`이 위로 밀려 사라지지 않고 항상 바텀시트 최상단에 고정되어 있도록 구조를 분리했습니다.
- **토스 표준 둥근 닫기 버튼 디자인**:
  - 토스 디자인 시스템(TDS) 표준에 맞춰 `32px x 32px` 원형 회색 배경(`var(--bg-subtle)`)의 둥근 버튼을 적용하여, 상단 시스템 바의 닫기와 시각적으로 뚜렷하게 구별되도록 개선했습니다.
- **토스/안드로이드 뒤로가기(backEvent) 연동 강화**:
  - 홈 탭에서 유통기한 바텀시트가 열려 있을 때 뒤로가기 제스처나 버튼을 누르면 앱 종료 팝업 대신 바텀시트가 먼저 자연스럽게 닫히도록 핸들러를 등록했습니다.

---

### 1.2. 코드 수정 내역

1. **`src/components/BottomSheet.tsx`**:
   - `subtitle?: React.ReactNode` 선택 prop 추가.
   - 상단 헤더(`.bottom-sheet-header`)와 스크롤 본문(`.bottom-sheet-body`)의 DOM 분리.
   - `lucide-react`의 `<X>` 아이콘을 활용한 원형 닫기 버튼(`.bottom-sheet-close-btn`) 구현.
2. **`src/index.css`**:
   - `.bottom-sheet`: `display: flex; flex-direction: column; overflow: hidden; padding: 0;`으로 전환하여 헤더 고정 및 내부 독립 스크롤 지원.
   - `.bottom-sheet-header`: `flex-shrink: 0; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--border-subtle);` 적용.
   - `.bottom-sheet-close-btn`: `32px` 원형 회색 버튼, 호버/액티브 터치 피드백 애니메이션(`scale(0.92)`) 정의.
   - `.bottom-sheet-body`: `flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;` 적용.
3. **`src/components/HomeTab.tsx`**:
   - `registerBackHandler` prop 연동을 통한 뒤로가기 시 시트 우선 닫기 처리.
   - `BottomSheet`에 `subtitle` prop 전달 및 내부의 불필요한 중복 `maxHeight: 60vh` 스크롤 래퍼 제거.
4. **`src/App.tsx`**:
   - `HomeTab` 호출부에 `registerBackHandler={registerBackHandler}` 전달.
5. **버전 동기화**:
   - `src/version.ts`, `.env` ➔ `v00181`.

---

## 2. 품질 검증 및 빌드 배포 현황

1. **정적 타입 검사**: `npx tsc --noEmit` ➔ 0 오류 (Clean)
2. **토스 앱인토스 패키징**: `npm run build` (`vite build && ait build`) ➔ `family-inventory.ait` 정상 생성 (Deployment ID: `01a0e663-a266-7e2d-b8de-951e895e5108`)
3. **버전 관리**: `src/version.ts`, `.env` ➔ `v00181` 동기화 완료
4. **Google Drive 자동 동기화**: `walkthrough_v00181.md` 자동 생성 및 동기화 완료
5. **백그라운드 태스크**: 0 tasks running (클린)

---
- **문서 작성일**: 2026년 9월 28일
- **적용 버전**: v00181
