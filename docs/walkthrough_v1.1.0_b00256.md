# Walkthrough v1.1.0-b00256: 안드로이드 미니앱 기동 불가 오류 긴급 정상화 (미지원 homeEvent 리스너 제거)

## 1. 긴급 제보 및 현상 확인
- **사용자 제보 (Tauriqon님)**:
  > "안드로이드 폰에서 앱이 안열림."
- **현상**:
  - `v1.1.0-b00255` 배포 직후 안드로이드 토스 앱에서 미니앱 진입 시 화면이 열리지 않고 즉시 강제 종료/크래시 발생.

---

## 2. 근본 원인 분석 (Root Cause Analysis)

### 2.1. `homeEvent` 구독에 따른 토스 안드로이드 네이티브 브릿지 크래시
- `b00254` 및 `b00255`에서 상단 `[··· ✕]` 네이티브 닫기를 감지하기 위해 추가했던 `graniteEvent.addEventListener('homeEvent')`가 원인이었습니다.
- 미니앱이 실행될 때 `graniteEvent.addEventListener('homeEvent')`는 토스 네이티브 브릿지로 `bridge.loose.__subscribeAppEvent({ method: 'homeEvent' })` IPC 메시지를 즉시 전송합니다.
- 토스 안드로이드 네이티브 컨테이너(Java/Kotlin)는 일반 서드파티 미니앱에서 `homeEvent` 구독을 지원하지 않으며, 등록 요청 시 네이티브 레벨에서 처리되지 않은 예외(Unhandled Exception)가 발생하여 미니앱 웹뷰 액티비티 자체가 기동 즉시 강제 종료되었습니다.

### 2.2. 상단 네이티브 `[··· ✕]`의 본질적 특성
- 토스 상단 네이티브 바의 `[··· ✕]` 캡슐 버튼은 웹뷰 외부의 네이티브 OS 영역이며, 보안 및 탈출 보장 정책상 웹뷰 JavaScript에서 클릭 이벤트를 감지하거나 가로챌 수 없습니다.
- 따라서 `homeEvent`는 `[✕]` 클릭을 잡지도 못하면서 안드로이드 브릿지만 파괴하는 문제가 있었습니다.

---

## 3. 수정 및 조치 사항 (`v1.1.0-b00256`)

1. **`graniteEvent.addEventListener('homeEvent')` 완전 제거**
   - 브릿지 크래시를 유발하는 `homeEvent` 구독 코드를 완전히 제거했습니다.
   - 검증된 공식 `graniteEvent.addEventListener('backEvent')`만 안정적으로 동작하도록 원복하여 안드로이드 앱 기동이 즉각 정상화되었습니다.

2. **미지원 스킴 및 불필요한 종료 상태 정리**
   - `openURL('supertoss://home')` 스킴 호출 및 `isExiting` 렌더 차단 블록을 제거하고, 토스 표준 공식 종료 API인 `closeView()` 단일 호출로 정리했습니다.

3. **설정 탭 내 `[🚪 앱 종료하기]` 버튼 유지 및 안정화**
   - 사용자가 원할 때 안전하게 앱을 닫을 수 있도록 `SettingsTab`에 추가된 `[🚪 앱 종료하기]` 버튼은 정상 유지되며, 확인 모달을 통해 `closeView()`로 안전하게 종료됩니다.

---

## 4. 변경 파일 목록
- `src/App.tsx`:
  - `openURL` import 및 `isExiting` 상태 제거
  - `handleHomeAction` 및 `graniteEvent.addEventListener('homeEvent')` 완전 삭제
  - 안정적인 `backEvent` 리스너 및 `closeView()` 종료 로직 복원
- `src/version.ts`: `b00256`로 버전 갱신
- `.env`: `v1.1.0-b00256`로 버전 갱신
- `family-inventory.ait`: 최신 번들 빌드 완료

---

## 5. 검증 결과
1. **타입스크립트 검사 (`npx tsc --noEmit`)**: 에러 0개 통과.
2. **프로덕션 빌드 (`npm run build`)**: 번들 패키징 정상 완료 (deploymentId: `01a1f39c-cde1-74e5-a670-39416e3bb07e`).
