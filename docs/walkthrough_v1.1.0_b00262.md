# Walkthrough v1.1.0-b00262: 브라우저 기본 경고창 제거(도메인 헤더 제거) 및 가족 기기 초기화 2단계 자동 정리 탑재

## 1. 개요 및 사용자 요청사항
- **사용자 요청 (Tauriqon님)**:
  1. *"초대코드로 Ed.Kim 의 보관소를 공유한 상태에서 공장초기화 를 진행하면 어떻게 되지? 가족 기기가 초기화 된것을 소유자 기기에서 알고 자동으로 내보내기를 할수는 없나? 적용하자."*
  2. *"그리고 첨부사진의 메시지 에 나오는 'https:.......페이지 내용:' 부분을 없애자. 관련 다른 메시지 도 확인해서 없애자."*

---

## 2. 주요 개선 내용

### 2.1. 브라우저 기본 팝업 및 도메인 헤더 원천 제거 (`showCustomAlert`, `showCustomConfirm`)
- **기존 문제**:
  - 모바일 웹뷰(WebView) 환경에서 자바스크립트 기본 `window.alert()` 및 `window.confirm()` 실행 시 OS/브라우저 정책에 의해 대화상자 상단에 `'https://family-inventory.private-apps.tossmini.com' 페이지 내용:`이라는 긴 도메인 URL 헤더가 강제 노출되어 앱의 완성도를 저해함.
- **해결 방안**:
  1. **토스 스타일 커스텀 모달 컴포넌트 탑재 (`src/utils/toast.ts`)**:
     - `showCustomAlert(message, options)`: 둥근 카드(R24), 부드러운 백드롭 블러(Backdrop blur), 볼드한 토스 블루 확인 버튼, 햅틱 피드백 지원.
     - `showCustomConfirm(message, options)`: 비동기 `Promise<boolean>`을 반환하며 [취소] 및 위험 작업 강조(빨간색 `isDanger`) 지원.
  2. **글로벌 `window.alert` 오버라이드 (`src/main.tsx`)**:
     - 앱 진입점에서 `window.alert`를 `showCustomAlert`로 전역 대체하여 어떤 라이브러리나 레거시 코드에서 경고창을 띄우더라도 브라우저 도메인 헤더가 절대 나타나지 않도록 원천 차단.
  3. **공유 해제 및 가입 승인 알림 개선 (`src/contexts/AuthContext.tsx`)**:
     - 소유자가 멤버를 내보냈을 때 나타나는 *"보관소 소유자에 의해 공유 접근 권한이 해제되었습니다. 내 개인 보관소로 복귀합니다."* 알림을 `await showCustomAlert(...)`로 변경.
     - 사용자가 모달의 **[확인]** 버튼을 직접 누른 직후에만 화면이 안전하게 리로드되도록 전환 흐름을 안정화.

---

### 2.2. 가족 기기 초기화 시 2단계 자동 멤버십 정리 (Auto-Leave & Orphan Cleanup)
가족 구성원이 소유자(Ed.Kim)의 보관소에 참여한 상태에서 기기 공장 초기화를 진행할 경우, 소유자 기기에서 유령 멤버가 남지 않도록 **2중 자동화 메커니즘**을 탑재하였습니다.

#### [1단계] 공장 초기화 시 선제적 자동 탈퇴 (Graceful Auto-Leave)
- **동작 위치**: `src/components/SettingsTab.tsx` (`handleExecuteResetConfirm`)
- **작동 원리**:
  - 가족 멤버가 `[설정 > 공장 초기화]`를 실행할 때, 기기 로컬 캐시를 삭제하고 `signOut()`하기 직전에 Supabase 서버로 즉시 요청을 보냅니다:
    ```sql
    DELETE FROM group_members WHERE user_id = currentUserId AND role = 'member';
    DELETE FROM group_join_requests WHERE requester_id = currentUserId;
    ```
  - Supabase Realtime이 활성화되어 있으므로, **소유자(Ed.Kim) 기기의 화면에 0.5초 만에 실시간 반영되어 멤버 목록에서 해당 가족 멤버가 저절로 사라집니다.** (소유자가 수동으로 내보내기를 누를 필요 없음)

#### [2단계] 재가입 승인 시 이전 고아 멤버 자동 청소 (Auto Orphan Cleanup on Re-join)
- **동작 위치**: `src/services/db.ts` (`joinRequests.approve`)
- **작동 원리**:
  - 만약 가족 기기가 오프라인 상태에서 초기화되었거나, 브라우저 설정에서 앱 데이터를 강제 삭제하여 1단계 자동 탈퇴 신호가 서버로 전송되지 못한 경우:
  - 해당 가족이 재부팅 후 새로 발급받은 1회용 초대 코드로 동일한 호칭(예: '김미미', '아내')으로 다시 참여 신청을 하고 소유자가 **[승인]**하는 순간,
    ```sql
    DELETE FROM group_members 
    WHERE group_id = request.group_id 
      AND role = 'member' 
      AND user_name = request.requester_name 
      AND user_id != request.requester_id;
    ```
  - 동일한 호칭을 가졌던 이전의 유령/고아(Orphan) 멤버 레코드를 서버가 자동으로 탐색하여 깨끗하게 지워줍니다.
  - 이를 통해 **멤버 목록에 동일한 이름의 가족이 중복으로 남는 현상을 100% 방지**합니다.

---

### 2.3. 가족 공유 및 보관소 설정 인터랙션 전면 개편
- `SettingsTab.tsx`의 주요 대화상자를 모두 커스텀 모달 및 토스트로 전환:
  - **보관소 퇴장 확인**: 브라우저 팝업 -> 토스 커스텀 Confirm 모달
  - **멤버 내보내기**: 브라우저 팝업 -> 빨간색 강조 커스텀 위험 Confirm 모달 + 완료 토스트
  - **가입 신청 거절**: 브라우저 팝업 -> 커스텀 Confirm 모달 + 정보 토스트
  - **가입 신청 취소**: 브라우저 팝업 -> 커스텀 Confirm 모달 + 정보 토스트
  - **보관소 복구 완료**: 브라우저 팝업 -> 커스텀 Alert 모달 후 리로드

---

## 3. 수정 및 영향받은 파일 목록
1. `src/utils/toast.ts`: `showCustomAlert`, `showCustomConfirm` 모달 함수 추가
2. `src/main.tsx`: `window.alert`를 `showCustomAlert`로 글로벌 오버라이드
3. `src/contexts/AuthContext.tsx`: 권한 해제 및 가입 승인 안내를 `await showCustomAlert(...)`로 교체
4. `src/services/db.ts`: `joinRequests.approve` 시 동일 `user_name`의 고아 멤버 레코드 자동 청소 로직 추가
5. `src/components/SettingsTab.tsx`: 공장 초기화 시 선제적 멤버십 자동 삭제, 복구/퇴장/내보내기/거절 시 커스텀 다이얼로그 적용
6. `src/version.ts` & `.env`: 버전 번호 `v1.1.0-b00262`로 갱신
