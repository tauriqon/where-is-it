# 아 찾았다! (Where is it?) - v1.1.0 (b00289) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-28  
**대상 버전**: `v1.1.0 (b00289)`  
**작업 요약**: AI 사진 분석 완료 토스트 메시지에서 내부 모델명 노출 제거 (사용자 친화적 토스트 문구 정돈)

---

## 1. 변경 내역
- **`src/components/AddTab.tsx`**:
  - AI 사진 분석 완료 토스트에서 내부 기술 모델명(`gemini-3.5-flash-lite`)을 제거하고 `🤖 사진 분석: "OO" 및 추천 태그 N개 입력 (2.12초)` 형태로 간결하게 표시 (노출 시간 `3000ms`).
  - 사진 미리보기 하단의 컴팩트 분석 정보 바는 그대로 유지하여 필요 시 소요 시간과 모델명을 확인할 수 있습니다.
- **버전 업데이트**:
  - `src/version.ts`: `APP_BUILD_NUMBER = 'b00289'`
  - `.env`: `VITE_APP_VERSION=v1.1.0-b00289`

---

## 2. 검증 결과
- `npm run build` 성공 (`family-inventory.ait` 생성 완료).
- Google Drive 자동 동기화 및 GitHub `main` 푸시 완료.
