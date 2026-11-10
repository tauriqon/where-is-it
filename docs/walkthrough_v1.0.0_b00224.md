# Walkthrough v1.0.0-b00224 - 공식 릴리즈 버전 체계 수립 및 1차 심사용 가족 동기화 임시 숨김(Feature Flag) 적용

## 1. 개요 (Overview)
* **목적**:
  1. 외부 공개용 공식 버전(`v1.0.0`)과 내부 개발 추적용 빌드 번호(`b00224`)의 이원화 체계를 확립하여 전문적인 릴리즈 관리 기반을 구축합니다.
  2. 토스 미니앱 1차 정식 출시 심사에서 심사관의 단일 기기(1인) 테스트 환경에 최적화하여 보완 요청 없이 원패스 초고속 승인을 받을 수 있도록, 가족 동기화 기능을 안전하게 임시 비활성화(Feature Flag)합니다.
* **사용자 요청 사항**:
  > "외부 공개용 공식 버전에 v 를 쓰고, 내부 개발 관리용 빌드 번호에 b 를 쓰는 이유는?"  
  > "그럼 walkthrough 문서도 walkthrough_bXXXXX.md 로 만들어 지는거지?" -> "2안(walkthrough_v1.0.0_b00224.md)으로 하는게 어떨까?" -> "진행하자."

---

## 2. 버전 관리 체계 이원화 (Release Versioning Strategy)

### 2.1 버전 분리 구성 ([`src/version.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/version.ts))
* **대외 공식 릴리즈 버전**: `APP_RELEASE_VERSION = 'v1.0.0'` (SemVer: Major.Minor.Patch)
  * 토스 콘솔 등록 및 일반 사용자 대상 공식 표기.
* **내부 개발 관리용 빌드 번호**: `APP_BUILD_NUMBER = 'b00224'` (Build / Revision Number)
  * 커밋, 워크스루 문서, 디버그 및 에러 추적용.
* **통합 표기**: `APP_VERSION = 'v1.0.0 (b00224)'`

### 2.2 워크스루 및 Git 규칙 갱신 ([`.agents/AGENTS.md`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/.agents/AGENTS.md))
* **커밋 메시지 형식**: `[commit message] (v{RELEASE_VERSION}-{BUILD_NUMBER})`  
  * 예: `feat: hide family sync and set v1.0.0 (v1.0.0-b00224)`
* **워크스루 파일명**: `walkthrough_v{RELEASE_VERSION}_{BUILD_NUMBER}.md`  
  * 예: `walkthrough_v1.0.0_b00224.md`
  * 기존 `walkthrough_v00223.md` 파일들의 알파벳 `v` 정렬 순서를 완벽히 유지하면서, 릴리즈 버전별(`v1.0.0`, `v1.1.0` 등) 그룹화가 자연스럽게 이루어집니다.

---

## 3. 가족 동기화 Feature Flag 상세 구현 (Key Implementation)

### 3.1 Feature Flag 정의 ([`src/version.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/version.ts))
```typescript
// 1차 출시 심사용 임시 비활성화 (토스 1차 심사 통과 후 v1.1.0에서 true로 오픈 예정)
export const ENABLE_FAMILY_SYNC = false;
```
* **무손실 안전 설계**: DB 스키마, Auth/Data 컨텍스트의 그룹 동기화 로직, 초대 코드 생성 로직 등 모든 핵심 비즈니스 로직은 100% 보존되며 UI 진입점만 On/Off 스위치로 제어됩니다.

### 3.2 UI 진입점 및 문구 최적화
1. **메인 상단 헤더 ([`src/App.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/App.tsx))**:
   * 우측의 `[🏠 내 보관소]` 동기화 설정 이동 뱃지 버튼을 조건부 숨김 처리.
   * 상단 바가 `[아이콘] 어디 뒀더라?`로 깔끔하게 정돈되어 1인 개인 정리함의 집중도를 극대화.
2. **설정 탭 ([`src/components/SettingsTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/SettingsTab.tsx))**:
   * 메뉴 목록 2번 '가족 동기화' 항목을 조건부 숨김 (`ENABLE_FAMILY_SYNC && ...`).
   * '내 호칭 / 이름 변경' 설명 문구를 `보관소에서 사용할 내 호칭 수정`으로 자연스럽게 전환.
   * 설정 홈 설명 문구를 `보관 환경 구조 및 알림 설정을 편리하게 관리합니다.`로 정돈.
   * `subPage === 'sync'` 직접 접근 시 가드 처리.
3. **물건 등록 및 수정 폼 (4개 컴포넌트 일괄)**:
   * 적용 대상:
     * [`src/components/AddTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/AddTab.tsx) (물건 등록 탭)
     * [`src/components/ExploreTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/ExploreTab.tsx) (탐색 탭 수정 폼)
     * [`src/components/SearchTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/SearchTab.tsx) (검색 탭 수정 폼)
     * [`src/components/ItemDetailBottomSheet.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/ItemDetailBottomSheet.tsx) (홈/공통 상세 바텀시트 수정 폼)
   * 내용: `🔒 개인 물건 (가족 공유 시 숨기기)` 체크박스를 `{ENABLE_FAMILY_SYNC && isOwner && (`로 감싸 숨김 처리.
   * 효과: 심사관에게 혼란을 줄 수 있는 가족 공유 관련 잔여 문구를 완벽히 제거하여 1인 단독 물건 정리에 완전히 몰입할 수 있도록 개선.
4. **딥링크 초대 팝업 ([`src/App.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/App.tsx))**:
   * `incomingSyncCode` 검사 및 가입 신청 모달 노출을 `ENABLE_FAMILY_SYNC` 조건으로 차단.

---

## 4. 검증 결과 (Verification)
* **빌드 검증**: `npm run build` (`vite build && ait build`) 0건 에러 정상 완료.
* **번들 패키징**: `dist/` 및 `family-inventory.ait` 정상 생성 확인 (불필요한 UI 미렌더링으로 번들 사이즈 806.20 kB 경량화).
* **UI 검증**:
  * 메인 헤더: 동기화 뱃지 없이 깔끔한 단독 브랜드 타이틀 표시.
  * 설정 탭: 보관위치 관리, 내 호칭/이름 변경, 유통기한 알림 설정 등 1인 핵심 메뉴로 정돈.
  * 물건 등록/수정: 가족 숨김 체크박스 없이 깔끔한 입력 폼 렌더링.
  * 설정 최하단: `where is it . v1.0.0 (b00224)` 정상 표기.
