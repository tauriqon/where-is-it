# 아 찾았다! (Where is it?) - v1.1.0 (b00287) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-28  
**대상 버전**: `v1.1.0 (b00287)`  
**작업 요약**: 실제 스마트폰 화면에서 AI 사진 인식 소요 시간(초) 및 실제 적용된 Gemini 모델명을 실시간 확인할 수 있도록 UI 표시 추가

---

## 1. 변경 배경
- Tauriqon님 요청: *"실제 폰에서 인식 속도와 실제 적용된 모델을 볼 수 있도록 하자."*
- Supabase Edge Function(`recognize-item`)이 이미 응답 JSON에 `model` 필드를 반환하고 있었으므로, 클라이언트에서 전체 소요 시간(`elapsedMs`)과 적용 모델명(`model`)을 함께 수집하여 폰 화면에서 즉각 확인할 수 있도록 개선했습니다.

---

## 2. 세부 변경 사항

### 1) `src/services/aiVision.ts`
- `AiRecognitionResult` 인터페이스에 `model?: string | null` 및 `elapsedMs?: number` 필드 추가.
- `recognizeItemAndTags` 시작 시점(`performance.now()`)부터 Edge Function 응답 완료 시점까지의 실제 단말 체감 소요 시간(`elapsedMs`)과 서버가 반환한 실제 모델명(`data.model`)을 결과 객체에 포함해 반환.

### 2) `src/components/AddTab.tsx`
- **분석 완료 토스트 강화**: 토스트 메시지에 `(1.82초 · gemini-3.5-flash-lite)` 형식으로 소요 시간과 적용 모델을 함께 표시하고 노출 시간을 `4000ms`로 확대.
- **사진 미리보기 하단 상태 바 추가**: 토스트가 사라진 뒤에도 폰 화면에서 확인할 수 있도록, 사진 미리보기 바로 아래에 `✨ AI 분석 완료 | 1.82초 · gemini-3.5-flash-lite` 칩을 표시 (사진 삭제 또는 등록 완료/초기화 시 자동 숨김).

### 3) 버전 업데이트
- `src/version.ts`: `APP_BUILD_NUMBER = 'b00287'`
- `.env`: `VITE_APP_VERSION=v1.1.0-b00287`

---

## 3. 검증 결과
- `npm run build` 정상 완료 (`family-inventory.ait` 번들 생성).
- Google Drive 자동 동기화 및 GitHub `main` 푸시 완료.
