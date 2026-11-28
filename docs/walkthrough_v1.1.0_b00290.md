# 아 찾았다! (Where is it?) - v1.1.0 (b00290) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-28  
**대상 버전**: `v1.1.0 (b00290)`  
**작업 요약**: AI 사진 분석 완료 토스트 제거 및 사진 하단 컴팩트 상태 바에서 모델명 제외(소요 시간만 깔끔하게 표시)

---

## 1. 변경 내역
- **`src/components/AddTab.tsx`**:
  - AI 사진 분석 완료 시 노출되던 하단 토스트 팝업을 제거하여 사진 미리보기를 가리지 않도록 개선 (`triggerHaptic('success')` 햅틱 피드백 유지).
  - 사진 미리보기 바로 아래 컴팩트 상태 바에서 내부 모델명을 제외하고 `✨ AI 분석 완료 | 2.12초` 형태로 간결하게 표시.
- **버전 업데이트**:
  - `src/version.ts`: `APP_BUILD_NUMBER = 'b00290'`
  - `.env`: `VITE_APP_VERSION=v1.1.0-b00290`

---

## 2. 검증 결과
- `npm run build` 성공 (`family-inventory.ait` 생성 완료).
- Google Drive 자동 동기화 및 GitHub `main` 푸시 완료.
