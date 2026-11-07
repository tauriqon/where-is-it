# 📦 WhereIsIt 전체 데이터/그룹 클리어 및 공장 초기화 세션 소멸 강화 (v00195)

본 문서는 WhereIsIt 미니앱에서 사용자가 아무도 없는 완전한 0명 상태(클린 슬레이트)에서 완전히 새로운 고유 보관함으로 새 출발할 수 있도록, **기존 데이터베이스의 모든 공간/수납/칸 데이터를 클리어하고, 애플리케이션 내 공장 초기화 시 Supabase 세션 로그아웃(`signOut`) 및 스토리지 캐시 전면 소멸 처리를 강화한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. [v00195] 주요 변경 및 개선 사항

### 1.1. 데이터베이스 공간/수납/물건 잔여 데이터 전면 클리어
- 과거 등록되었던 모든 그룹(`wii-tznonv` 포함 6개 그룹)의 공간, 수납처, 칸, 물건 데이터를 데이터베이스에서 **완전 0건(클린 상태)**으로 소거하였습니다.
  - `items`: 0건
  - `sections`: 0건
  - `storages`: 0건
  - `spaces`: 0건
  - `user_profiles`: 0건
  - `group_join_requests`: 0건
  - `Storage 이미지`: 0건 (브랜드 아이콘 2개 제외 전면 삭제 완료)

### 1.2. 공장 초기화 세션 소멸 로직 고도화 (`src/components/SettingsTab.tsx`)
- 기존의 단순 `localStorage.clear()` 방식에서 발전시켜, Supabase 인증 토큰 및 세션까지 확실하게 끊어낼 수 있도록 `await supabase.auth.signOut()`을 결합하였습니다.
- `localStorage`뿐만 아니라 드래프트나 임시 상태가 남을 수 있는 `sessionStorage`까지 함께 소멸시켜, 초기화 즉시 **단말기가 완전한 0번째 신규 유저로 환생**하도록 보장합니다.

### 1.3. 신규 사용자 온보딩 & 새 출발 플로우 검증
- 기기에서 공장 초기화를 진행하거나 캐시를 비우고 앱을 실행하면:
  1. 기기가 새로운 익명 UUID를 발급받습니다.
  2. 신규 고유 그룹 코드가 자동 생성됩니다.
  3. `v00194`에서 구축된 자동 시딩 엔진에 의해 **표준 6대 공간(거실, 주방, 안방, 서재, 욕실, 안방욕실)**과 **필수 수납처(냉장고, 옷장, 욕실 수납장)**가 자동으로 탑재됩니다.
  4. 과거의 가족 공유(타 멤버 목록 등) 흔적이 전혀 없는 단독 클린 보관함 상태로 새 출발합니다.

---

## 2. 변경 파일 요약

1. `src/components/SettingsTab.tsx`:
   - 공장 초기화 핸들러에 `supabase.auth.signOut()` 및 `sessionStorage.clear()` 추가
2. `src/version.ts`:
   - `APP_VERSION = 'v00195'`
3. `.env`:
   - `VITE_APP_VERSION=v00195`
4. `docs/walkthrough_v00195.md`:
   - 신규 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 3. 빌드 및 검증 결과

- `npm run build`: Vite 빌드 및 앱인토스 패키징(`family-inventory.ait`) 0건 오류 정상 완료.
- Supabase 실시간 DB 검증: `items=0`, `sections=0`, `storages=0`, `spaces=0` 전수 확인 완료.
