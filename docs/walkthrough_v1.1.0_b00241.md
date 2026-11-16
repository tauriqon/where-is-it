# 어디있지? (Where Is It) 워크스루 - v1.1.0-b00241

## 📌 릴리즈 개요
- **릴리즈 버전**: `v1.1.0`
- **빌드 번호**: `b00241`
- **배포 ID**: `01a1e377-ca52-778f-96b3-641dd6e20fee`
- **작업 일시**: 2026-11-16
- **대상 사용자**: **Tauriqon님**

---

## 🛠️ 해결된 핵심 이슈 및 근본 원인 분석

### 1. 가족기기 호칭이 참여 보관소 소유자의 호칭(예: Ed.Kim)으로 바뀌는 버그 해결
- **근본 원인**:
  - `AuthContext.tsx`의 `refreshActiveGroupMembers` 함수 내에 멤버십 호칭이 `'소유자'`이거나 비어있을 경우, 보관소 내의 다른 커스텀 이름(소유자 이름: `Ed.Kim`)을 찾아 자동으로 상속(`Auto-inheriting nickname`)하고 이를 `dbService.groups.updateMemberName`으로 DB에 영구 반영하던 레거시 로직이 존재했습니다.
  - 이로 인해 가족 멤버(User B)가 참여하자마자 소유자(User A)의 호칭이 가족 멤버의 세션 및 DB 행에 강제 복사되었습니다.
- **해결책**:
  1. `AuthContext.tsx`에서 무차별적인 호칭 상속 로직을 완전히 제거했습니다.
  2. `dbService.groups.join` 호출 시, 참여자의 호칭이 `'소유자'`이거나 비어있을 경우 자동으로 `'가족'`으로 정제하여 저장하도록 방어 로직을 구축했습니다.
  3. **자가 치유(Self-Healing) 탑재**: 이미 해당 버그로 인해 소유자 호칭(`Ed.Kim`)으로 오염되어 있는 가족기기가 접속할 경우, 시스템이 이를 감지하여 즉시 본래의 저장된 호칭 또는 `'가족'`으로 자동 정화 및 복구합니다.

---

### 2. 합치기 완료 후 "존재하지 않는 워크스페이스입니다." 에러 발생 원천 차단
- **근본 원인**:
  - `SettingsTab.tsx`의 `executeJoinGroup`에서 대상 보관소 가입(`join`) 및 데이터 합치기(`merge`) 후 `switchActiveGroup(targetGroup.id)`를 호출했으나, `AuthContext` 내부의 React 상태인 `myGroups` 배열이 아직 갱신되지 않은 상태였습니다.
  - 이로 인해 `myGroups.find(g => g.id === targetGroup.id)`가 `undefined`를 반환하며 `throw new Error('존재하지 않는 워크스페이스입니다.')` 예외가 발생했습니다.
- **해결책**:
  1. `switchActiveGroup(groupId, providedGroup)`에 대상 그룹 객체를 직접 전달할 수 있도록 시그니처를 확장했습니다.
  2. 만약 메모리 내 `myGroups`에 대상 그룹이 없더라도 즉시 `dbService.groups.getMyGroups()` 및 `dbService.groups.get(groupId)`를 통해 DB에서 최신 워크스페이스를 실시간 동기화하여 찾아내도록 폴백 메커니즘을 완성했습니다.
  3. `executeJoinGroup`에서 `targetGroup` 객체를 직접 인자로 전달하여 전환 실패가 100% 발생하지 않도록 개선했습니다.

---

### 3. 가족기기에서 합치기 후 데이터가 0개(빈 화면)로 나오던 현상 해결
- **근본 원인**:
  - `merge` 단계에서 기존 가족기기 보관소의 모든 공간/수납처/물건이 대상 가족 보관소로 정상 이전되었습니다.
  - 그러나 위의 "존재하지 않는 워크스페이스입니다." 예외가 발생하면서 활성 보관소 전환(`switchActiveGroup`)과 리로드가 중단되었습니다.
  - 결과적으로 가족기기는 **이미 모든 데이터가 이전되어 텅 빈 기존 보관소**에 그대로 머무르게 되어 데이터가 0개로 노출되었습니다.
- **해결책**:
  1. 가입 직후 `localStorage.setItem('wii_active_group_id', targetGroup.id)`를 선제적으로 안전하게 기록합니다.
  2. `switchActiveGroup(targetGroup.id, targetGroup)`을 통해 합쳐진 대상 보관소로 즉시 원자적 전환을 수행합니다.
  3. **기존 고립 기기 자동 구제 탑재**: 이미 데이터가 이전된 후 텅 빈 보관소에 고립되어 있는 가족기기가 새로고침 접속 시, 보유 물건이 0개이고 참여 중인 데이터 보유 가족 보관소가 있을 경우 자동으로 해당 가족 보관소로 활성 전환을 수행하여 즉시 전체 데이터를 조회할 수 있도록 자가 치유합니다.

---

## 🔍 주요 변경 파일 내역

1. **`src/services/db.ts`**:
   - `groups.join`: `userName`이 `'소유자'`이거나 비어있을 경우 `'가족'`으로 표준화하여 upsert.
   - `groups.get`: 그룹 ID(`groupId`)로 보관소 단건을 직접 조회하는 안전망 메서드 추가.

2. **`src/contexts/AuthContext.tsx`**:
   - `refreshActiveGroupMembers`: 소유자 호칭 오염 로직 제거 및 오염된 멤버 호칭 자가 치유(Self-Healing) 로직 탑재.
   - `loadUserSession`: 합치기 후 빈 보관소에 남아있는 기기를 위한 자동 구제 로직 추가.
   - `switchActiveGroup`: `providedGroup` 직접 인수 및 DB 실시간 재조회 폴백 구현.
   - `updateMyNickname`: 브라우저 로컬 스토리지(`wii_my_nickname`) 선제 저장 및 전역 보관소 동기화.
   - `refreshGroups`: 외부에서 그룹 목록을 실시간 갱신할 수 있는 헬퍼 함수 제공.

3. **`src/components/SettingsTab.tsx`**:
   - `executeJoinGroup`: 본인 호칭 안전화(`safeNickname`), `localStorage` 즉시 저장, `switchActiveGroup(targetGroup.id, targetGroup)` 안전 호출.
   - 워크스페이스 전환기: `switchActiveGroup(g.id, g)` 타겟 객체 직결.
   - 가입 안내 텍스트: 현재 설정된 호칭 또는 `'가족'`으로 명확하게 사전 안내.

4. **`src/App.tsx`**:
   - 공유 접속 종료 시 `switchActiveGroup(defaultGroup.id, defaultGroup)` 안전 객체 전달.

5. **`src/version.ts`**:
   - `b00241` 빌드 번호 갱신.

---

## 🚀 검증 및 배포 결과
- **TypeScript 타입 체크**: `npx tsc --noEmit` 통과 (0 errors).
- **Vite & 앱인토스 빌드**: `npm run build` 성공.
- **배포 Deployment ID**: `01a1e377-ca52-778f-96b3-641dd6e20fee`.
