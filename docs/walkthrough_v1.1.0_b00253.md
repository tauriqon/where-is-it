# Walkthrough v1.1.0-b00253: 보관소 퇴장 후 무한로딩/데이터 유실 해결, 불필요 배지 정리, 안드로이드 토스 [X] 종료 동작 개선

## 1. 작업 개요
Tauriqon님의 요청에 따라 다음 3가지 핵심 문제를 해결하고 안정화 조치를 완료하였습니다:
1. **보관소 카드 불필요 배지 삭제 (빨간색 체크 부분)**:
   - `내 개인 보관소` 우측의 중복 배지 `[내 보관소]` 제거.
   - `Ed.Kim님의 보관소` 우측의 중복 배지 `[Ed.Kim]` 제거로 인해 보관소 타이틀(`Ed.Kim님의 보관 \n 소`)이 두 줄로 개행되던 문제를 해결하여 한 줄로 쾌적하게 표시.
2. **보관소 퇴장(휴지통) 후 무한 로딩 및 개인 보관소 데이터 유실 버그 원천 해결 (그린색 휴지통 부분)**:
   - **무한 로딩 원인**: `leaveGroup` 실행 직후 3초 주기 백그라운드 폴링과 퇴장 완료 알림/새로고침이 동시 충돌하고, `DataContext`의 `refreshData`에서 조건부 조기 반환 시 로딩 상태가 영구 유지되던 문제를 방어 플래그(`isLeavingGroupRef`), 동기식 Ref 즉시 교체, `finally { setLoading(false); }` 보장으로 원천 해결.
   - **데이터 유실/공간 실종 원인**: `getMyGroups`가 `group_members` 테이블만 조인 조회하던 구조를 개선하여 사용자가 `owner_id`인 보관소 테이블(`groups`)을 직접 합산 조회하도록 강화하고, 과거 합치기 등으로 인해 개인 보관소의 공간이 0개로 비어있을 경우 기본 6대 공간(거실, 주방, 안방, 욕실, 현관, 발코니)을 자동 복구 시딩하도록 조치.
3. **안드로이드 토스 앱 상단 `... X` 의 `[X]` 터치 시 토스 전체 종료 현상 해결**:
   - `App.tsx`에서 글로벌하게 상시 등록되어 있던 `homeEvent` 이벤트 리스너를 제거하여, 토스 네이티브 프레임워크가 상단 `[X]` 버튼의 웹뷰 종료 및 이전 화면 복귀 동작을 100% 정상적으로 처리하도록 복원.

---

## 2. 주요 변경 상세

### 2.1. 불필요 배지 제거 및 타이틀 한 줄 최적화 (`SettingsTab.tsx`)
- `SettingsTab.tsx`의 워크스페이스 관리 카드에서 `{isOwner ? '내 보관소' : (g.owner_name || '가족 공유')}` 배지 `<span>`을 삭제.
- 타이틀에 이미 "내 개인 보관소" 및 "{이름}님의 보관소"가 명확히 기재되어 있으므로 중복 정보가 제거되었으며, 타이틀 너비가 충분히 확보되어 글자 개행이 사라졌습니다.

### 2.2. 보관소 퇴장 및 개인 보관소 복귀 안정화 (`db.ts`, `AuthContext.tsx`, `DataContext.tsx`)
1. **`db.ts` (`getMyGroups`)**:
   - 기존: `group_members`의 외래키 조인만 조회.
   - 변경: `owner_id = userId`인 소유 보관소와 `user_id = userId`인 가입 보관소를 `Map`으로 합산 조회하여, 멤버십 레코드 유무와 무관하게 사용자의 개인 보관소가 항상 로드되도록 보장.
2. **`AuthContext.tsx` (`leaveGroup` & Polling)**:
   - `isLeavingGroupRef` 플래그를 도입하여 자발적 보관소 퇴장 진행 중에는 백그라운드 폴링의 강퇴 감지 팝업이 발동하지 않도록 격리.
   - `activeGroupRef.current`를 폴백 보관소(개인 보관소)로 동기식 즉시 교체.
   - 폴백 보관소에 공간이 없을 경우 `seedDefaultData`를 비동기 호출하여 기본 공간 세트를 자동 복원.
3. **`DataContext.tsx` (`refreshData`)**:
   - `!user || !activeGroup` 상태에서도 `setLoading(false)`가 반드시 호출되도록 보장.
   - 소유한 개인 보관소의 공간 개수가 0개일 경우 기본 6대 공간을 자동 복구 시딩하여 빈 화면 고립 방지.
4. **`SettingsTab.tsx` (`leaveGroup` onClick)**:
   - 퇴장 안내 문구 명확화 ("퇴장하시면 내 개인 보관소로 복귀하며, 언제든 공유 코드를 통해 다시 참가하실 수 있습니다.").
   - 퇴장 완료 후 `forceReload(true)`를 통해 홈 탭으로 깔끔하게 복귀.

### 2.3. 토스 앱 [X] 종료 동작 개선 (`App.tsx`)
- `App.tsx`에서 `graniteEvent.addEventListener('homeEvent')` 구독을 제거.
- 사용자가 상단 `[X]` 버튼을 누를 때 토스 네이티브 앱 자체의 네비게이션이 실행되어, 토스 앱이 종료되거나 백그라운드에 고립되지 않고 미니앱만 정상 종료되도록 조치.

---

## 3. 변경 파일 목록
- `src/services/db.ts`: `getMyGroups` 듀얼 쿼리 합산 및 `leave` 함수 안전화
- `src/contexts/AuthContext.tsx`: `leaveGroup` 시 `isLeavingGroupRef` 및 Ref 동기화, 기본 공간 자동 시딩 복구
- `src/contexts/DataContext.tsx`: `refreshData` 무한로딩 방지 및 소유 보관소 0개 공간 자동 복구
- `src/components/SettingsTab.tsx`: 불필요 배지 삭제 및 퇴장 후 홈 복귀 처리
- `src/App.tsx`: 글로벌 `homeEvent` 구독 해제 (네이티브 종료 위임)
- `src/version.ts` & `.env`: 버전 `v1.1.0-b00253`으로 갱신
