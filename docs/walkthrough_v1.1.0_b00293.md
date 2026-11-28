# 아 찾았다! (Where is it?) - v1.1.0 (b00293) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-28  
**대상 버전**: `v1.1.0 (b00293)`  
**작업 요약**: AI 사진 인식 일일 횟수 제한을 Supabase Edge Function Secret(`AI_DAILY_LIMIT`)으로 중앙 일원화 (앱 재빌드·재심사 없이 Supabase에서만 한도 조정 가능)

---

## 1. 개선 배경
- 기존(`b00292`)에는 클라이언트(`aiVision.ts`)와 서버(`recognize-item`) 양쪽에 일일 한도 숫자가 분리되어 있어, 향후 한도를 늘리거나 줄일 때 양쪽 수정 및 토스 앱 재심사가 필요했습니다.
- 이번 개편으로 **일일 한도의 단일 진실 공급원(SSOT)을 Supabase Edge Function으로 일원화**했습니다.

---

## 2. 세부 변경 내역

### 1) `supabase/functions/recognize-item/index.ts`
- `Deno.env.get('AI_DAILY_LIMIT')` 환경 변수(Secret)를 읽어 일일 한도를 동적으로 적용합니다 (미설정 시 기본값 **`50`회**).
- 한도 초과(`429`) 응답 본문에 `{ error: 'DAILY_LIMIT', limit }`를 함께 반환하여 클라이언트가 현재 서버 한도 숫자를 그대로 안내할 수 있습니다.

### 2) `src/services/aiVision.ts`
- 하드코딩된 `DAILY_AI_LIMIT` 및 `localStorage` 일일 카운터를 제거하고, 네트워크 낭비 방지용 **5초 연타 쿨다운**만 유지했습니다.
- 서버에서 `429 (DAILY_LIMIT)` 응답이 오면 서버가 전달한 `limit` 값을 읽어 `"오늘의 AI 추천 횟수(N회)를 모두 사용했어요. 직접 입력해 주세요."` 토스트를 표시합니다.

### 3) 버전 및 문서 업데이트
- `src/version.ts`: `APP_BUILD_NUMBER = 'b00293'`
- `.env`: `VITE_APP_VERSION=v1.1.0-b00293`
- `docs/technical_specification_and_summary.md` & `where_is_it_summary.md` 업데이트.

---

## 3. 향후 한도 변경 방법 (앱 수정 불필요)
1. Supabase Dashboard ➔ `Edge Functions` ➔ `Secrets`
2. `AI_DAILY_LIMIT` 추가 또는 수정 (예: `50` ➔ `100`) 후 `Save`
3. 앱 재빌드·토스 심사 없이 즉시 반영 완료!
