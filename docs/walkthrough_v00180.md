# 📦 WhereIsIt 홈 탭 유통기한 도래 물건 상위 3개 제한, 바텀시트 전체보기 및 시급성 기반 스마트 정렬 (v00180)

본 문서는 WhereIsIt 토스 인앱 미니앱의 홈 탭에서 유통기한이 임박하거나 지난 물건이 많아질 때 발생할 수 있는 홈 화면 과도 스크롤 및 시각적 피로도를 방지하기 위해, **홈 화면에는 가장 시급한 상위 3개만 컴팩트하게 노출**하고 **3개 초과 시 '외 N개 물건 전체 보기 >' 토스 스타일 바텀시트(BottomSheet)**를 통해 전체 목록을 스크롤 탐색할 수 있도록 개선하며, **시급성 기반 다단계 스마트 정렬**을 적용한 작업 내역을 정리한 워크스루(Walkthrough)입니다.

---

## 1. [v00180] 주요 변경 및 개선 사항

### 1.1. 배경 및 문제점 해소
- **대량의 유통기한 물건 도래 시 홈 화면 과부하 방지**:
  - 기존에는 유통기한 알림 기준(기본 7일)에 해당하는 모든 물건이 홈 화면 본문에 무제한으로 노출되어, 물건이 10~20개 이상일 경우 [최근 활동 물건] 및 전체 화면 밸런스가 무너지는 문제가 있었습니다.
- **상위 3개 압축 노출 + 바텀시트 확장 (Option 1 적용)**:
  - 홈 화면에서는 가장 긴급한 물건 **최대 3개(`slice(0, 3)`)만 깔끔하게 노출**하여 첫 화면의 대시보드 뷰포트를 시원하게 유지합니다.
  - 3개를 초과하는 물건이 있는 경우, 즉시 하단에 `[외 N개 물건 전체 보기 >]` 버튼이 나타나 토스 표준 바텀시트(BottomSheet)를 띄워 전체 목록을 쾌적하게 열람할 수 있도록 개선했습니다.
  - 바텀시트 내에서 물건 카드를 탭하면 바텀시트가 닫히며 해당 물건의 수납 위치(Explore)로 부드럽게 이동합니다.

### 1.2. 추가 보완책: 시급성 기반 스마트 다단계 정렬 (Smart Urgency Sorting)
단순 날짜 순 정렬 시 이미 유통기한이 지난 만료 물건과 다가오는 물건 간의 우선순위 구분이 모호해지는 현상을 해결하기 위해 4단계 스마트 정렬 알고리즘을 도입했습니다:
1. **1순위 (만료 물건 우선)**: 이미 유통기한이 경과한 물건(`dday < 0`)을 최우선으로 배치.
2. **2순위 (경과일 내림차순)**: 만료된 물건들 중에서는 더 오래 방치된(경과일수가 큰) 물건부터 우선 경고.
3. **3순위 (D-Day 및 임박일수 오름차순)**: 아직 만료되지 않은 물건 중에서는 `D-Day(당일)` ➔ `D-1` ➔ `D-2` 순으로 마감이 급박한 순서대로 정렬.
4. **4순위 (이름 가나다순)**: 동일 D-Day일 경우 물건 이름 가나다순 정렬로 안정적인 뷰 제공.

### 1.3. 코드 수정 내역
- **`src/components/HomeTab.tsx`**:
  - `BottomSheet` 컴포넌트 임포트 및 `isExpirationSheetOpen` 토글 상태 추가.
  - 다단계 시급성 정렬 알고리즘 반영:
    ```typescript
    const expirationImminentItems = [...items]
      .filter(it => it.expiration_date && getDDay(it.expiration_date) <= notifyDays)
      .sort((a, b) => {
        const ddayA = getDDay(a.expiration_date!);
        const ddayB = getDDay(b.expiration_date!);
        const isExpiredA = ddayA < 0;
        const isExpiredB = ddayB < 0;
        if (isExpiredA && !isExpiredB) return -1;
        if (!isExpiredA && isExpiredB) return 1;
        if (isExpiredA && isExpiredB) {
          if (ddayA !== ddayB) return ddayA - ddayB; // 오래 지난 만료순
          return a.name.localeCompare(b.name, 'ko');
        }
        if (ddayA !== ddayB) return ddayA - ddayB; // D-Day 당일 및 임박순
        return a.name.localeCompare(b.name, 'ko');
      });
    ```
  - 홈 화면 렌더링을 `displayedExpirationItems`(`slice(0, 3)`)로 제한.
  - `expirationImminentItems.length > 3` 조건부로 `[외 N개 물건 전체 보기 >]` 버튼 렌더링.
  - 모달 영역에 `<BottomSheet>` 컴포넌트를 배치하여 전체 유통기한 도래 물건을 스크롤 뷰로 제공.
- **버전 동기화**:
  - `src/version.ts`: `v00180`
  - `.env`: `VITE_APP_VERSION=v00180`

---

## 2. 품질 검증 및 빌드 배포 현황

1. **정적 타입 검사**: `npx tsc --noEmit` ➔ 0 오류 (Clean)
2. **토스 앱인토스 패키징**: `npm run build` (`vite build && ait build`) ➔ `family-inventory.ait` 정상 빌드 완료
3. **버전 관리**: `src/version.ts`, `.env` ➔ `v00180` 동기화 완료
4. **Google Drive 자동 동기화**: `walkthrough_v00180.md` 자동 생성 및 동기화
5. **백그라운드 태스크**: 0 tasks running (클린)

---
- **문서 작성일**: 2026년 9월 27일
- **적용 버전**: v00180
