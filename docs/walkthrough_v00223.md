# Walkthrough v00223 - 아이폰(iOS) 테두리 스와이프 뒤로가기(앱 강제 종료) 방지 적용

## 1. 개요 (Overview)
* **목적**: 애플 아이폰(iOS) 환경에서 사용자가 화면 좌측 가장자리를 무심코 쓸어넘길 때, 토스 네이티브 컨테이너의 화면 전환(Interactive Pop Gesture)에 의해 앱이 갑작스럽게 튕겨나가는(강제 종료되는) 현상을 원천 방지합니다.
* **사용자 요청 사항**:
  > "애플의 아이폰에서는 우리 앱 화면에서 왼쪽 테두리에서 오른쪽으로 전체 화면을 스크롤하면 앱에서 그냥 빠져나가는데, 안드로이드 폰에서는 그런 현상이 없다. 왜그런지?" -> "적용하자."

---

## 2. 배경 및 원인 분석 (Background & Technical Analysis)

### 2.1 안드로이드 vs iOS 제스처 처리 차이
* **안드로이드 (Android)**:
  * 테두리 스와이프 제스처 시 안드로이드 OS 수준의 `뒤로가기 키(KeyEvent.KEYCODE_BACK)` 이벤트가 발생합니다.
  * 토스 앱이 이를 `graniteEvent.backEvent`로 웹뷰에 전달하며, 우리 앱의 `registerBackHandler`가 가로채어 바텀시트 닫기, 수정/등록 중 경고창 띄우기 등의 로직을 안전하게 실행합니다.
* **아이폰 (iOS / Apple UIKit)**:
  * iOS는 네이티브 내비게이션 컨트롤러의 화면 전환 기능인 `interactivePopGestureRecognizer`가 기본 활성화되어 있습니다.
  * 화면 좌측 테두리를 스와이프하면 웹뷰나 자바스크립트가 터치를 감지하기도 전에 iOS 운영체제(네이티브)가 먼저 터치 이벤트를 낚아챕니다.
  * 그 결과 웹앱의 안전 확인 팝업이나 바텀시트 닫기 로직이 실행될 기회조차 없이, 토스 네이티브가 우리 미니앱 ViewController 자체를 화면 스택에서 날려버려(Pop) 토스 홈으로 즉시 튕겨나가게 되었습니다.

---

## 3. 주요 구현 내용 (Key Implementation)

### 3.1 토스 공식 SDK `Screen.setIosSwipeBack({ isEnabled: false })` 연동
* **파일**: `src/App.tsx`
* **구현 방식**:
  ```typescript
  import { graniteEvent, closeView, generateHapticFeedback, Screen } from '@apps-in-toss/web-framework';

  // AppContent 마운트 시 1회 실행
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      Screen.setIosSwipeBack({ isEnabled: false }).catch((err: any) => {
        console.warn('Screen.setIosSwipeBack failed:', err);
      });
    } catch (e) {
      console.warn('Toss SDK Screen not available or failed:', e);
    }
  }, []);
  ```
* **동작 효과**:
  1. 앱 시작 시 토스 iOS 네이티브 컨테이너에 신호를 보내 `interactivePopGestureRecognizer`를 비활성화합니다.
  2. 아이폰 사용자가 좌측 화면 테두리를 오른쪽으로 스와이프하더라도 화면이 갑자기 닫히거나 앱이 종료되지 않습니다.
  3. 모든 화면 전환, 바텀시트 닫기, 수정 이탈은 앱 내부의 명시적인 버튼(`<`, `✕`, `[취소]`, `[닫기]`) 및 안전 경고창을 통해서만 질서 있게 이루어집니다.

---

## 4. 검증 결과 (Verification)
* **빌드 검증**: `npm run build` (`vite build && ait build`) 성공.
* **번들 패키징**: `dist/` 및 `family-inventory.ait` 정상 생성 확인.
* **예외 처리 검증**: 비-토스 브라우저 환경 및 에러 발생 시 앱이 멈추지 않도록 안전한 `try-catch` 및 `.catch()` 예외 처리 완비.
