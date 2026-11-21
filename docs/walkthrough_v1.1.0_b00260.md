# Walkthrough v1.1.0-b00260: 일회용 가족 초대 코드(One-Time Ticket) 보안 엔진 구축 및 복구 마스터키 완전 분리

## 1. 개요 및 요구사항
- **사용자 논의 및 요청 (Tauriqon님)**:
  > "가족 공유를 위해서 공유메시지를 보낼 때 내 보관소 복구 코드를 보내는데, 그러면 내 복구 코드가 노출되는 거 아닌가?
  > 내 보관소를 공유하기 위해서 요청, 승인 과정에서 필요한 코드를 만드는 거는 어떤가? 그럼 내 복구 코드는 나만 아는 거지?
  > 초대코드를 일회용으로 생각할 수는 없나?
  > 진행하자. 그리고 로드맵도 수정하고.."
- **핵심 목표**:
  1. **영구 마스터 복구 코드 (Master Recovery Key)**: 외부 공유가 절대 불가한 소유자 1인 전용 마스터 키로 격리 보호.
  2. **일회용 가족 초대 코드 (One-Time Invite Ticket)**: 가족 초대 시 1회 승인 완료 즉시 영구 만료(Used)되는 일회용 소모품 티켓 시스템 구현.
  3. **소유권 탈취 차단**: 초대 코드를 복구 메뉴에 입력 시 "가족 초대 코드는 복구에 사용할 수 없습니다" 차단 안내.
  4. **마스터 개발 로드맵(`docs/roadmap_and_summary.md`) 갱신**: Phase 2 최신 진행 상황 및 일회용 보안 엔진 내용 통합 반영.

---

## 2. 주요 변경 사항 및 상세 구현

### 2.1. 일회용 가족 초대 모델 설계 및 스키마 추가 (`supabase/schema.sql`)
- `group_invitations` 테이블 신설:
  - `id`: uuid (기본키)
  - `group_id`: uuid (보관소 ID)
  - `code`: text (고유 1회용 코드, 예: `wii-xxxxxx`)
  - `created_by`: uuid (발급 소유자 ID)
  - `status`: text ('active' | 'used' | 'expired')
  - `expires_at`: timestamptz (발급 후 24시간 자동 만료)
  - `used_by`: uuid (가입 승인된 멤버 ID)
- RLS 정책 설정:
  - 초대 코드 검증은 누구나 조회 가능.
  - 초대 코드 발급 및 삭제는 보관소 소유자만 가능.
  - Supabase 실시간 동기화(`supabase_realtime`)에 테이블 등록.

### 2.2. 데이터베이스 및 인증 서비스 구현 (`src/services/db.ts`, `src/contexts/AuthContext.tsx`)
- **초대 코드 발급 (`invitations.create`)**:
  - 기존 active 상태 초대 코드를 만료 처리하고, 새로운 6자리 `wii-` 난수 코드 발급(24시간 유효).
  - Supabase 테이블 미생성 환경에서도 로컬 캐시를 활용해 즉각 완벽 작동하는 무결점 폴백(Graceful Fallback) 탑재.
- **초대 코드 유효성 검증 (`invitations.validate`)**:
  - `status === 'used'`인 경우: "이미 사용된 1회용 초대 코드입니다." 차단.
  - 유효기간 만료 시: "유효기간(24시간)이 지난 초대 코드입니다." 차단.
- **승인 시 1회용 티켓 자동 소멸 (`joinRequests.approve`)**:
  - 소유자가 참여 신청을 [승인]하는 순간, 해당 보관소의 초대 코드를 즉시 `used`로 마킹하여 영구 폐기.
- **복구 메뉴 내 초대 코드 침입 원천 차단 (`restoreByCode`)**:
  - 보관소 복구(기기 변경) 메뉴에 초대 코드를 입력하면 즉시 감지하여 차단하고 가족 동기화 메뉴로 안내.

### 2.3. 사용자 화면(UI) 개편 (`src/components/SettingsTab.tsx`)
1. **보관소 복구 · 기기 변경 화면 (`subPage === 'recovery'`)**:
   - 상단 타이틀을 **`보관소 복구 마스터 키 (비공개 🔒)`**로 승격.
   - 라벨을 `MASTER RECOVERY KEY`로 명확화.
   - 황금색 보안 주의 배너 탑재: *"나만 아는 비밀 마스터 키: 소유자 본인만 안전하게 보관하세요. (가족 초대는 '가족 동기화'에서 1회용 초대 코드를 발급하세요)"*
2. **가족 동기화 설정 화면 (`subPage === 'sync'`)**:
   - 영구 코드 대신 **`일회용 가족 초대 코드`** 섹션으로 전환.
   - 활성 코드가 있을 때: `[코드]` + `[🎫 1회용 (승인 시 만료)]` 뱃지 + `[새 코드]` + `[복사]` + `[공유]` 버튼 제공.
   - 코드가 없을 때: `[🎫 1회용 가족 초대 코드 발급하기]` 원터치 생성 버튼 제공.
   - 공유 메시지 템플릿:
     ```text
     [아 찾았다!]  ${senderName} 보관소 가족 초대 코드 입니다.
     설정의 가족 동기화 에서 입력후 참여 신청하기를 눌러주세요.
     초대 코드 : ${inviteCode}
     * 1회용 초대 코드로, 가족 참여 승인 시 자동 만료됩니다.
     ```

### 2.4. 종합 개발 로드맵 최신화 (`docs/roadmap_and_summary.md`)
- 2026-11-21 기준 Phase 2 최신 진행 상황 전면 갱신:
  - 워크스페이스 전환 모델, 안전 탈퇴 및 복귀, 스마트 코드 추출 완료 반영.
  - 마스터 복구키 vs 일회용 초대 코드 분리 보안 아키텍처 반영.

---

## 3. 변경 파일 목록
- `src/types/index.ts`: `GroupInvitation` 인터페이스 추가
- `supabase/schema.sql`: `group_invitations` 테이블, RLS 정책 및 실시간 채널 정의 추가
- `src/services/db.ts`: `invitations` 서비스 구현, `joinRequests` 및 `restoreByCode` 연동
- `src/contexts/AuthContext.tsx`: `activeInviteCode`, `generateInviteCode`, `loadActiveInviteCode` 공급
- `src/components/SettingsTab.tsx`: 복구 마스터키 보안 경고 및 일회용 초대 코드 UI 적용
- `docs/roadmap_and_summary.md`: 종합 마스터 개발 로드맵 최신화
- `src/version.ts`: `b00260`로 버전 갱신
- `.env`: `v1.1.0-b00260`로 버전 갱신
- `family-inventory.ait`: 최신 번들 빌드 완료

---

## 4. 검증 결과
1. **타입스크립트 정적 검사 (`npx tsc --noEmit`)**: 에러 0개 통과.
2. **프로덕션 번들 빌드 (`npm run build`)**: 정상 완료 (deploymentId: `01a1fc6a-3a43-7745-b869-671f258ae0e8`).
