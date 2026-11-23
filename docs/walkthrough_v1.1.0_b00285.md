# 아 찾았다! (Where is it?) - v1.1.0 (b00285) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-23  
**대상 버전**: `v1.1.0 (b00285)`  
**작업 요약**: 토스 심사 반려 사유(내비게이션 바와 미니앱 자체 뒤로가기 버튼 중복 노출) 즉각 해결 (`withBackButton: false` 복원)

---

## 1. 토스 심사 반려 사유 분석 및 대응

### 1) 반려 사유
- 토스 심사팀 공식 피드백:
  > **"1. 내비게이션 바의 뒤로가기 버튼과 미니앱 자체 헤더 및 뒤로가기 버튼이 함께 노출돼요. 중복된 버튼을 제거해 주세요."**

### 2) 근본 원인 (Root Cause)
- 직전 빌드(`b00284`)에서 안드로이드 뒤로가기 제스처 및 종료 테스트를 위해 `granite.config.ts` 및 `apps-in-toss.config.ts`의 `navigationBar`에 `withBackButton: true`를 일시적으로 재배치했었습니다.
- 그러나 우리 미니앱의 서브페이지(설정 세부화면 등)에는 자체적인 인앱 뒤로가기 헤더 버튼(`<ArrowLeft /> 뒤로`)이 이미 구현되어 있어, 토스 네이티브 상단 내비게이션 바의 `[ < ]` 화살표와 인앱 헤더 뒤로가기 버튼이 위아래로 2개 노출되는 **UI 중복 위반(Duplicate Navigation)**이 발생하여 반려되었습니다.

### 3) 해결 방안
- 토스 UI/UX 표준 가이드라인에 따라 `granite.config.ts` 및 `apps-in-toss.config.ts`의 `withBackButton` 속성을 다시 `false`로 설정하여 토스 네이티브 바의 중복 화살표를 제거했습니다.
- 자체 인앱 뒤로가기 헤더 버튼을 온전히 유지하면서, 안드로이드 기기 물리/제스처 뒤로가기는 `src/App.tsx`의 `graniteEvent.addEventListener('backEvent')` 및 `handleBackActionRef` 시스템이 완벽하게 가로채어 안정적으로 처리합니다.

---

## 2. 세부 변경 사항

### 1) `granite.config.ts` 및 `apps-in-toss.config.ts` 수정
```typescript
navigationBar: {
  withTitle: false,
  withBackButton: false, // 토스 네이티브 중복 뒤로가기 버튼 제거
},
```

### 2) 버전 업데이트
- `src/version.ts`: `APP_BUILD_NUMBER = 'b00285'`
- `.env`: `VITE_APP_VERSION=v1.1.0-b00285`

---

## 3. 검증 결과
- `npm run build` 정상 완료 (`family-inventory.ait` 번들 생성).
- 네이티브 내비게이션 바 뒤로가기 버튼 비활성화로 중복 UI 완전 제거 확인.
- 안드로이드 시스템/제스처 뒤로가기(`backEvent`) 및 인앱 뒤로가기 버튼 정상 작동 확인.
- Google Drive 동기화 및 Git push 완료.
