# 🚀 Walkthrough: v1.1.0 (b00230)
**배포 일시**: 2026-11-14 14:36 (KST)  
**빌드 식별자**: `v1.1.0 (b00230)`  
**AIT 번들**: `family-inventory.ait` (deploymentId: `01a1d88e-d87a-7216-a662-067e5b186359`)

---

## 📋 개요 및 업데이트 목적
Phase 2 (데이터 100% 안전 보장 & 기기 변경 지원)의 1단계 핵심 기능인 **'영구 복구 코드(Recovery Code) 발급 및 1초 보관소 복원 시스템'**을 신설하고, 직전 대화에서 협의된 **'설정 메뉴 앱 평가 14일 쿨다운 바이패스'** 개선을 완벽히 통합 적용했습니다.

---

## ✨ 주요 구현 사항

### 1. 6자리 영구 복구 코드 발급 & 기기 변경 1초 복원 체계
- **DB 서비스 확장 (`src/services/db.ts`)**:
  - `dbService.groups.restoreByCode(code: string)` 신설:
    - 대소문자 무관 및 `wii-` 접두사 자동 보정 처리 (예: `7k9m2p`, `wii-7k9m2p`, `WII-7K9M2P` 모두 인식).
    - Supabase RLS 정책 내에서 신규 기기를 해당 보관소의 `owner` 권한으로 등록/업서트.
- **인증 컨텍스트 연동 (`src/contexts/AuthContext.tsx`)**:
  - `restoreByRecoveryCode(code)` 함수 제공: 복구 코드 입력 시 해당 보관소로 즉시 액티브 전환 및 `wii_active_group_id` 영구 보존.
  - `isOwner` 판별 로직 고도화: 기존 `owner_id === user.id`뿐만 아니라 복구 코드로 합류한 `member.role === 'owner'` 유저도 100% 동일한 소유자 권한 부여.
- **데이터 컨텍스트 및 앱 전역 연동 (`src/contexts/DataContext.tsx`, `src/App.tsx`)**:
  - 복원된 보관소의 비공개 물건 및 공간/수납처 데이터가 1초 만에 무손실 로드되도록 동기화.
- **설정 UI 신설 (`src/components/SettingsTab.tsx`)**:
  - 설정 메인 메뉴에 **[보관소 복구 코드 · 기기 변경]** 신규 메뉴 항목 추가.
  - 서브페이지(`subPage === 'recovery'`):
    - **내 보관소 고유 복구 코드 카드**: 큰 글씨의 코드 표시 + 원클릭 클립보드 복사 버튼 + 안내 팁.
    - **이전 보관소 불러오기(데이터 복원) 카드**: 복구 코드 입력창 + [보관소 데이터 불러오기] 버튼 + 로딩 상태 표시.

### 2. 설정 탭 리뷰 수동 호출 14일 쿨다운 바이패스 연동
- **`src/services/analytics.ts`**:
  - `requestInAppReview(reason, force = false)` 파라미터 추가.
  - 설정 탭에서 직접 탭한 경우 `force = true`로 동작하여 14일 쿨다운 타이머를 무시하고 즉시 토스 리뷰 바텀시트 요청.
- **`src/components/SettingsTab.tsx`**:
  - 수동 호출 연동 및 이미 평가했거나 다음에 하기를 누른 유저를 위한 안내 토스트 추가.

### 3. 버전 관리 및 AIT 번들 빌드
- `src/version.ts`: 공식 릴리즈 버전 `v1.1.0`, 빌드 번호 `b00230` 적용.
- `family-inventory.ait`: 정상 생성 완료 (`01a1d88e-d87a-7216-a662-067e5b186359`).

---

## 🧪 검증 결과
1. **타입 검사**: `npx tsc --noEmit` ➔ 0 에러 통과.
2. **패키지 빌드**: `npm run build` (Vite + AIT) ➔ 에러 없이 성공 (`family-inventory.ait`).
3. **복구 코드 입력 유연성**: `wii-` 접두사 유무 및 대소문자 관계없이 매칭 지원.

---

## 📱 실기기 테스트 가이드 (Tauriqon님 확인용)
1. 토스 콘솔의 [앱 출시] 메뉴에 이번 `family-inventory.ait`를 업로드합니다.
2. **[테스트하기]**를 눌러 Tauriqon님의 스마트폰 토스 앱에서 QR 코드를 스캔합니다.
3. 앱 접속 후 **[설정 ➔ 보관소 복구 코드 · 기기 변경]** 메뉴에 진입합니다:
   - **확인 1**: 내 복구 코드가 잘 표시되고, [코드 복사] 버튼을 누르면 정상 복사되는지 확인.
   - **확인 2**: 설정 탭의 `[⭐ 앱 평가 및 리뷰 남기기]`를 눌렀을 때 토스 리뷰 바텀시트가 즉시 뜨는지 확인.
