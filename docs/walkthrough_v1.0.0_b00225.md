# Walkthrough v1.0.0-b00225 - 토스 1차 심사 반려 사유(뒤로가기 중복) 조치 및 토스 라이브 전면 광고 연동 완료

## 1. 개요 (Overview)
* **목적**:
  1. 토스 미니앱 1차 심사 반려 피드백(*"내비게이션 바의 뒤로가기 버튼과 미니앱 자체 헤더 및 뒤로가기 버튼이 함께 노출돼요. 중복된 버튼을 제거해 주세요."*)을 완벽히 해소합니다.
  2. 토스 개발자 콘솔에서 정식 발급된 라이브 전면 광고 그룹 ID(`ait.v2.live.41b1a3be69b94e33`)를 연동합니다.
  3. Tauriqon님과 사전 확정한 광고 노출 정책(30개 이상 보관 유저 대상, 등록/수정 5회, 검색상세 7회, 5분 시간 쿨다운)을 안정적으로 구현합니다.
* **사용자 승인**:
  > "등록/수정 5회, 검색상세 7회, 5분 시간 쿨다운 으로 일단 정하고, 광고 ID 발급후 진행하자. 향후에 내가 광고 ID를 알려주면 나에게 진행여부를 알려주고, 승인을 받을수 있니?"  
  > "ait.v2.live.41b1a3be69b94e33" -> 계획 보고 -> "진행하자"

---

## 2. 심사 반려 사유 조치 (Duplicate Back Button Elimination)

### 2.1 원인 분석
* 토스 미니앱 프레임워크는 `navigationBar` 설정 시 `withBackButton`의 기본값이 `true`로 동작합니다.
* 이에 따라 토스 네이티브 상단 네비게이션 바에 `[ < ]` 뒤로가기 버튼이 렌더링되면서, 미니앱 내부의 자체 헤더 및 서브 화면(설정 상세, 바텀시트 등) 뒤로가기 버튼과 중복되어 UX 가이드 위반으로 반려되었습니다.

### 2.2 설정 파일 수정 ([`apps-in-toss.config.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/apps-in-toss.config.ts), [`granite.config.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/granite.config.ts))
```typescript
  navigationBar: {
    withTitle: false,
    withBackButton: false, // 토스 네이티브 뒤로가기 숨김 -> 미니앱 자체 커스텀 네비게이션 단독 사용
  },
```
* **결과**: 토스 네이티브 뒤로가기 버튼이 완전히 숨겨지고 미니앱 자체 헤더 및 뒤로가기만 깔끔하게 노출되어 중복 버튼 문제가 원천 해소되었습니다.

---

## 3. 정식 토스 라이브 전면 광고 연동 및 노출 정책 구현

### 3.1 라이브 광고 그룹 ID 반영 ([`.env`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/.env), [`src/services/ads.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/services/ads.ts))
* **발급된 공식 ID**: `ait.v2.live.41b1a3be69b94e33`
* `.env` 환경 변수 `VITE_INTERSTITIAL_AD_GROUP_ID`에 등록 및 `src/services/ads.ts`의 기본 폴백값으로 지정.

### 3.2 광고 정책 상세 설계 ([`src/services/ads.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/services/ads.ts))
| 항목 | 정책 내용 | 관리 방식 |
| :--- | :--- | :--- |
| **적용 대상** | 보관 물건 **30개 이상** 보유 시 | `totalItemCount >= 30` 조건 검사 |
| **등록/수정 트리거** | 물건 등록 및 수정 누적 **5회**마다 1회 | `localStorage` (`wii_ad_save_edit_count`) |
| **검색상세 트리거** | 검색 결과 물건 상세 열람 누적 **7회**마다 1회 | `localStorage` (`wii_ad_search_view_count`) |
| **시간 쿨다운** | 직전 광고 노출 후 **최소 5분 (300초)** 경과 필수 | `localStorage` (`wii_ad_last_shown_time`) |
| **사용자 UX 보호** | 광고 송출 전 안내 토스트 후 1초 대기 | `💡 30개 이상 보관 중: 잠시 후 안내 광고가 표시됩니다.` |

* **쿨다운 보호 로직**:
  * 5회(등록/수정) 또는 7회(검색상세) 카운트를 충족하더라도, 직전 광고 시청 후 5분이 지나지 않았다면 광고를 건너뛰어 사용자의 피로도를 최소화합니다.
  * `localStorage` 기반으로 카운트 및 시점이 저장되어 미니앱 재접속이나 새로고침 시에도 정확한 주기가 보장됩니다.

### 3.3 컴포넌트별 연동 지점
1. **데이터 컨텍스트 ([`src/contexts/DataContext.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/contexts/DataContext.tsx))**:
   * `createItem`: 물건 추가 완료 시 `triggerSaveEditAd(totalCount)` 호출.
   * `updateItem`: 물건 수정 완료 시 `triggerSaveEditAd(items.length)` 호출.
2. **검색 탭 ([`src/components/SearchTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/SearchTab.tsx))**:
   * `handleCloseDetailModal`: 물건 상세 바텀시트 닫기(X 버튼, 백드롭 터치, 뒤로가기) 시 `triggerSearchViewAd(items.length)` 호출.
   * 검색 결과를 확인한 후 작업이 완료되는 자연스러운 시점에 광고가 노출되도록 배치하여 사용자 흐름을 방해하지 않습니다.

---

## 4. 변경된 파일 목록 (Changed Files)
* [`apps-in-toss.config.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/apps-in-toss.config.ts): `withBackButton: false` 설정
* [`granite.config.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/granite.config.ts): `withBackButton: false` 설정
* [`.env`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/.env): 라이브 광고 ID 및 버전 설정
* [`src/version.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/version.ts): 빌드 번호 `b00225` 갱신
* [`src/services/ads.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/services/ads.ts): 5회/7회 분리 카운터, 5분 쿨다운 및 라이브 AdMob 연동
* [`src/contexts/DataContext.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/contexts/DataContext.tsx): 등록/수정 광고 트리거 연동
* [`src/components/SearchTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/SearchTab.tsx): 검색상세 닫기 시 광고 트리거 연동

---

## 5. 검증 및 빌드 결과 (Build & Verification)
* `npm run build` (`vite build && ait build`): 정상 빌드 완료.
* 번들 파일: `family-inventory.ait` 생성 완료 (deploymentId: `01a1c93c-6cbd-7e3e-af64-0ff85e7b62db`).
* Git 커밋 & 푸시: `v1.0.0-b00225` 태그로 `main` 브랜치에 안전하게 동기화 완료.
