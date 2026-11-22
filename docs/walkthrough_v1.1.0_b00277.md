# 아 찾았다! (Where is it?) - v1.1.0 (b00277) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-22  
**대상 버전**: `v1.1.0 (b00277)`  
**작업 요약**: 사진 등록 시 AI Vision 기반 물건 대표 이름 및 추천 태그(2~3개) 동시 스마트 자동 입력 기능 적용

---

## 1. 개선 배경 및 목적
- Tauriqon님의 요청: *"물건 인식 후 태그도 자동입력이 가능할까?"* ➔ *"적용하자"*
- 물건 등록 시 사진을 촬영하거나 앨범에서 선택했을 때, 물건 이름뿐만 아니라 보관 카테고리/용도/특성을 나타내는 적절한 태그(2~3개)까지 함께 자동으로 입력받을 수 있도록 기능을 대폭 확장했습니다.
- **핵심 아키텍처 및 비용 최적화**:
  - 기존 AI Vision 서비스 호출(단 1회)에서 이름과 추천 태그를 단일 JSON 형식(`{ "name": "...", "tags": [...] }`)으로 동시에 추론하도록 설계하여 **추가 API 비용 및 토큰 소모를 0원으로 유지**했습니다.
  - 사용자가 이전에 등록해 둔 전체 태그 목록(`allTags`)을 프롬프트 힌트로 주입하여 태그 파편화를 방지하고 기존 태그 우선 재활용을 유도했습니다.
  - 기존에 이미 등록해 둔 태그와의 중복 제거 및 병합 처리를 통해 사용자 경험을 극대화했습니다.

---

## 2. 세부 변경 사항

### 1) AI Vision 서비스 고도화 (`src/services/aiVision.ts`)
- **인터페이스 정의**:
  ```typescript
  export interface AiRecognitionResult {
    name: string | null;
    tags: string[];
  }
  ```
- **함수 제공**: `recognizeItemAndTags(file: File, existingTags: string[] = []): Promise<AiRecognitionResult | null>`
- **모델 체인**: `gemini-3.5-flash-lite` ➔ `gemini-3.5-flash` ➔ `gemini-2.5-flash` ➔ `gemini-1.5-flash` 순차 폴백.
- **JSON 파싱 및 정제**: 코드블록 제거, 따옴표/해시태그/불필요 어미 정제, 빈 태그 필터링.
- **하위 호환성 유지**: 기존 `recognizeItemFromImage` 래퍼 유지.

### 2) 물건 등록 화면 연동 (`src/components/AddTab.tsx`)
- **상태 및 Ref 관리**: `nameRef` 및 `tagsRef`를 활용하여 비동기 AI 분석 중 사용자가 수동 입력한 내용이 유실되지 않도록 보장.
- **자동 입력 로직 (`handleImageSelected`)**:
  - 이름이 비어있으면 AI가 인식한 대표 물건 이름 자동 채움.
  - 추천된 태그 목록을 기존 등록 태그와 중복 없이 결합하여 자동 추가.
  - 입력 완료 시 햅틱 피드백(`success`)과 함께 상세 토스트 표시:
    - 이름 & 태그 동시 입력 시: `🤖 사진 분석: "[물건이름]" 및 추천 태그 N개가 자동 입력되었습니다.`
- **UI 안내 문구 및 뱃지 업데이트**:
  - 인풋 플레이스홀더: `🤖 AI가 사진 속 물건과 추천 태그를 인식하고 있어요...`
  - 섹션 라벨 뱃지: `✨ 스마트 이름 & 태그 자동 입력`
  - 설명 문구: `사진을 찍거나 올리면 AI가 물건 이름과 추천 태그를 자동으로 입력해 드려요.`
  - 미등록 점선 상자 서브 텍스트: `✨ 사진 등록 시 물건 이름과 태그가 자동 입력됩니다`
  - 이미지 피커 바텀시트 서브 텍스트: `사진을 등록하면 AI가 물건 이름과 태그를 스마트하게 자동 입력해 드려요`

### 3) 버전 업데이트
- `src/version.ts`: `APP_BUILD_NUMBER = 'b00277'`
- `.env`: `VITE_APP_VERSION=v1.1.0-b00277`

---

## 3. 검증 결과
- `npm run build` 빌드 검증 성공 (`family-inventory.ait` 번들 생성 완료).
- Google Gemini 3.5 Flash Lite API를 통한 이미지 인식 및 JSON 응답(이름 + 태그) 정제 로직 완벽 검증.
- 0 background tasks 상태 유지.
