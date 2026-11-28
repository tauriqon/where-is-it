# 아 찾았다! (Where is it?) - v1.1.0 (b00286) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-28  
**대상 버전**: `v1.1.0 (b00286)`  
**작업 요약**: 긴급 보안 및 최적화 3대 조치 — Gemini API 키 클라이언트 완전 제거 및 Supabase Edge Function(`recognize-item`) 프록시 구축, 공식 모델명 정상화(`gemini-2.5-flash` / `2.0-flash`), 클라이언트·서버 2중 과금 방어선(일일 15회 + 5초 쿨다운) 탑재

---

## 1. 긴급 점검 배경 및 취약점 분석

대화 `긴급 분석-20261127`에서 도출된 3가지 P0 긴급 기술 과제를 즉시 조치했습니다.

1. **클라이언트 번들 내 Gemini API 키 평문 노출 (보안/과금 리스크)**:
   - 기존 `src/services/aiVision.ts`는 `import.meta.env.VITE_GEMINI_API_KEY`를 브라우저에서 직접 `fetch` 호출하여, 프로덕션 빌드 번들(`dist/assets/*.js`)에 API 키가 평문으로 포함되는 취약점이 있었습니다.
2. **미존재 Gemini 모델명 호출로 인한 404 폴백 지연**:
   - 기존 `candidateModels` 배열의 선두에 구글 API에 존재하지 않는 `gemini-3.5-flash-lite`, `gemini-3.5-flash`가 포함되어 있어 매 요청마다 불필요한 HTTP 404 실패 라운드트립이 발생했습니다.
3. **무분별한 연속 호출 및 과금 폭탄 방어선 부재**:
   - 기기당 일일 호출 횟수 제한이나 연타 방지 쿨다운이 없어 비정상적인 호출이 발생할 경우 API 비용이 무제한 증가할 위험이 있었습니다.

---

## 2. 세부 구현 내역

### 1) Supabase Edge Function 보안 프록시 구축 (`supabase/functions/recognize-item/index.ts`)
- **비공개 Secret 키 격리**: `Deno.env.get('GEMINI_API_KEY')`를 서버리스 환경에서만 읽고, `x-goog-api-key` 헤더로 구글 엔드포인트와 통신합니다.
- **세션 JWT 인증 검증**: `Authorization: Bearer <JWT>` 헤더로 `supabase.auth.getUser()`를 검증하여 우리 앱 사용자가 아닌 제3자의 무단 스크래핑을 원천 차단합니다.
- **공식 고속 모델명 정상화**: `['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']` 공식 모델 리스트로 교체하여 404 지연 없이 즉각 응답합니다.
- **페이로드 및 서버측 Rate Limit 가드**: 허용 MIME(`image/jpeg`, `image/png`, `image/webp`) 및 크기 상한(약 1.1MB) 검증, 유저당 보조 Rate Limit(일일 20회 / 3초 쿨다운) 적용.

### 2) 클라이언트 AI Vision 리팩토링 및 2중 과금 방어선 (`src/services/aiVision.ts`, `.env`)
- `.env`에서 `VITE_GEMINI_API_KEY`를 완전히 제거하고, `aiVision.ts`가 `supabase.functions.invoke('recognize-item', ...)`를 통해 Edge Function 프록시만 호출하도록 전환했습니다.
- **클라이언트 2중 방어선 탑재**:
  - **일일 호출 제한**: 기기당 하루 최대 **15회** (`localStorage` 날짜별 자동 초기화). 초과 시 안내 토스트 표시 후 수동 입력 유도.
  - **연타 방지 쿨다운**: 최소 **5초** 간격 제한.
- Edge Function 미배포/오류 시에도 앱이 멈추지 않고 수동 입력으로 부드럽게 폴백됩니다.

### 3) ESLint·버전·문서 업데이트
- `eslint.config.js`: `supabase/functions` 경로를 `globalIgnores`에 추가하여 Deno 문법과의 린트 충돌 방지.
- `src/version.ts` & `.env`: `v1.1.0-b00286`으로 버전 업데이트.
- `docs/technical_specification_and_summary.md` & `where_is_it_summary.md`: 보안 프록시 아키텍처, 공식 모델명, Rate Limit 정책 반영.

---

## 3. Supabase 대시보드 필수 후속 작업 (Tauriqon님 확인 사항)

코드 레벨에서 클라이언트 키 노출은 100% 제거되었습니다. 실서비스에서 AI 사진 인식이 새 프록시로 동작하도록 아래 2단계만 Supabase 대시보드에서 적용해 주시면 완료됩니다.

1. **기존 노출된 Gemini API 키 폐기 및 신규 발급 (권장)**:
   - [Google AI Studio](https://aistudio.google.com/apikey)에서 기존 키(`AQ.Ab8RN6...`)를 삭제(Revoke)하고 새 API 키를 발급합니다.
2. **Supabase Edge Function 배포 및 Secret 등록**:
   - **Secret 등록**: Supabase Dashboard ➔ `Edge Functions` ➔ `Secrets` ➔ Key: `GEMINI_API_KEY`, Value: `새 API 키` 저장.
   - **함수 배포**: Supabase Dashboard ➔ `Edge Functions` ➔ `Deploy a new function` (이름: `recognize-item`)에 `supabase/functions/recognize-item/index.ts` 코드를 붙여넣어 배포 (또는 로컬에 Supabase CLI 설치 후 `supabase functions deploy recognize-item` 실행).

---

## 4. 검증 결과
- `npm run build` 성공 (`dist/` 및 `family-inventory.ait` 번들 생성 완료).
- 프로덕션 번들(`dist/assets/*.js`) 전수 검사 결과: `AQ.Ab8RN6`, `VITE_GEMINI_API_KEY`, `generativelanguage.googleapis.com` 문자열 **0건(완전 제거 확인)**.
- Google Drive 동기화 및 GitHub `main` 푸시 완료.
