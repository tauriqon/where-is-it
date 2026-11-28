# 아 찾았다! (Where is it?) - v1.1.0 (b00292) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-28  
**대상 버전**: `v1.1.0 (b00292)`  
**작업 요약**: AI 사진 자동 인식 일일 사용 한도를 15회에서 50회로 상향 조정 (온보딩·대량 정리 편의성 강화)

---

## 1. 변경 내역
- **`src/services/aiVision.ts`**:
  - `DAILY_AI_LIMIT`를 `15` ➔ **`50`**으로 상향 조정 (초기 집안 정리 등 집중 등록 사용자 경험 개선, 5초 쿨다운 유지).
- **`supabase/functions/recognize-item/index.ts`**:
  - 서버측 보조 상한 `SERVER_DAILY_LIMIT`를 `20` ➔ **`60`**으로 상향하여 클라이언트 50회 한도와 안전 여유분(버퍼)을 맞추었습니다.
- **문서 및 버전 업데이트**:
  - `src/version.ts`: `APP_BUILD_NUMBER = 'b00292'`
  - `.env`: `VITE_APP_VERSION=v1.1.0-b00292`
  - `docs/technical_specification_and_summary.md` & `where_is_it_summary.md`: 일일 50회 제한 반영.

---

## 2. 검증 및 참고 사항
- `npm run build` 성공 (`family-inventory.ait` 생성 완료).
- Supabase 대시보드의 `recognize-item` Edge Function에서 `SERVER_DAILY_LIMIT = 60`으로 1줄만 함께 업데이트해 주시면 16회~50회 구간도 서버 차단 없이 통과합니다.
- Google Drive 자동 동기화 및 GitHub `main` 푸시 완료.
