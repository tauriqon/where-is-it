# 🚀 Walkthrough: v1.0.0 (b00229)
**배포 일시**: 2026-11-14 09:54 (KST)  
**빌드 식별자**: `v1.0.0 (b00229)`  
**AIT 번들**: `family-inventory.ait` (2.3MB, deploymentId: `01a1d78b-c82d-7a94-95a7-a30e27dd4c55`)

---

## 📋 개요 및 업데이트 목적
토스 공식 가이드에서 정의하는 **'2단계: 추천 미니앱 (스토어 큐레이션 및 추천 탭 노출)'** 선정을 위한 1차 핵심 기술 요구사항인 **토스 전환 지표(핵심 이벤트) 전송**과 **토스 공식 인앱 리뷰(별점/평가) 유도 UX**를 완벽하게 연동했습니다.

---

## ✨ 주요 구현 사항

### 1. 토스 분석 SDK (`Analytics.log`) 핵심 지표 연동
- **신규 서비스 생성**: `src/services/analytics.ts`
- **대표 전환 이벤트 (`item_created`)**:
  - `DataContext.tsx`의 `createItem` 완료 시점에 즉시 토스 분석 서버로 이벤트 발송
  - 전송 데이터:
    - `log_name`: `'item_created'`
    - `log_type`: `'event'`
    - `params`: `{ item_name, has_expiration, total_created_count, timestamp }`
  - 토스 콘솔의 **'대표 전환 지표(CVR)'** 집계 기준으로 동작
- **검색 조회 이벤트 (`item_searched`)**:
  - `SearchTab.tsx`의 `handleSearchSubmit` 실행 시 검색어 및 결과 수 전송
- **소비기한 확인 이벤트 (`expiry_viewed`)**:
  - `HomeTab.tsx`에서 유통기한 임박 카드가 노출될 때 전송

### 2. 토스 공식 인앱 리뷰 (`Review.request`) 연동
- **공식 API 지원 검증**: 토스 앱 버전 및 환경 검증 (`Review.request.isSupported()`)
- **자연스러운 마일스톤 기반 리뷰 유도**:
  - 유저가 물건을 **1회, 3회, 7회 등록** 완료하여 앱의 가치를 느낀 직후(1.2초 뒤) 부드럽게 토스 공식 리뷰 바텀시트 요청
  - **피로도 방지 안전장치**: 최소 14일 쿨다운(`14 * 24 * 60 * 60 * 1000`) 적용으로 과도한 반복 요청 원천 차단
- **설정(더보기) 메뉴 직접 평가 구좌 추가**:
  - `SettingsTab.tsx`에 **[⭐ 앱 평가 및 리뷰 남기기]** 메뉴 항목 신설
  - 언제든 유저가 자발적으로 토스 스토어 별점 및 응원 리뷰를 남길 수 있도록 지원

### 3. 버전 관리 및 번들 빌드
- `src/version.ts`: `v1.0.0 (b00229)` 반영
- `family-inventory.ait` 패키징 완료 (오류 없이 정상 빌드 완료)

---

## 🧪 검증 결과
- `npm run build`: Vite 및 AIT 빌드 0 에러 정상 통과
- `family-inventory.ait`: 정상 생성 완료 (2.3MB)
- `Review.request` 및 `Analytics.log` 타입 검증 완료

---

## 📌 토스 콘솔 핵심지표 등록 가이드
1. 이번에 빌드된 `family-inventory.ait`(`v1.0.0-b00229`)를 토스 콘솔에 새 버전으로 등록합니다.
2. 기기에서 앱을 켜고 물건을 1개 등록합니다. (토스 서버로 `item_created` 전송)
3. 토스 콘솔의 **[핵심 지표 / 등록하기]** 화면으로 돌아와 새로고침 후 `+ 이벤트 추가하기`를 누르면 `item_created`가 목록에 노출되며, 대표 전환 지표로 바로 선택할 수 있습니다.
