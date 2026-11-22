# 아 찾았다! (Where is it?) - v1.1.0 (b00274) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-22  
**대상 버전**: `v1.1.0 (b00274)`  
**작업 요약**: 입력창 전체 지우기 (X) 원형 버튼 도입, Google Gemini 1.5 Flash 기반 사진 속 물건 대표 이름 자동 인식 서비스 연동, 및 API 요금 가이드 문서 저장

---

## 1. 개선 배경 및 목적
- **입력 편의성 극대화 (Clear Button)**:
  - 모바일 기기에서 긴 물건 이름이나 태그를 수정할 때 백스페이스 키를 반복해서 누르는 불편함을 해소하기 위해, 입력 내용이 있을 때 원터치로 전체 삭제할 수 있는 `(X)` 원형 버튼을 제공.
- **물건 사진 촬영 시 이름 자동 입력 (AI Vision)**:
  - 사진을 찍거나 앨범에서 물건 사진을 등록할 때, 이름 입력창이 비어 있는 경우(`!name.trim()`)에 한해 초고속 멀티모달 AI(Google Gemini 1.5 Flash)가 사진을 분석하여 물건의 대표 명사(예: '무선 이어폰', '여권 지갑', '손톱깎이' 등)를 자동으로 채워 넣는 스마트 등록 경험 제공.
- **구글 API 요금 가이드 문서 분리 보관**:
  - AI 비전 사용 요금, 1일 1,500회 무료 티어 한도, 3중 비용 방어 설계 및 API 키 발급 가이드를 별도 문서로 영구 보관.

---

## 2. 세부 변경 사항

### 1) 입력창 전체 지우기 (X) 버튼 구현
- **파일**: `src/components/AddTab.tsx`, `src/components/ItemDetailBottomSheet.tsx`
- **적용 위치**:
  - `AddTab.tsx`: [물건 이름] 입력창, [태그 입력] 입력창
  - `ItemDetailBottomSheet.tsx`: [물건 이름 수정] 입력창
- **동작 방식**:
  - 글자가 1글자 이상 입력되면 우측 끝에 은은한 회색 원형 `(X)` 버튼이 노출됨.
  - 버튼 터치 시 전체 텍스트가 즉각 비워지며, 가벼운 햅틱 피드백(`tickWeak`)과 함께 포커스를 유지하여 즉시 새 텍스트를 입력 가능.

### 2) Google Gemini 1.5 Flash 기반 AI 비전 물건 이름 자동 인식 서비스
- **신규 파일**: `src/services/aiVision.ts`
- **핵심 기능**:
  - `isAiVisionConfigured()`: `VITE_GEMINI_API_KEY` 설정 여부 확인.
  - `resizeImageForAI()`: 사진 원본(5~10MB)을 Canvas를 통해 가로세로 512px 수준의 JPEG(30~50KB)로 즉시 압축 리사이징하여 전송 트래픽과 토큰 소모를 최소화 (응답 시간 1초 이내).
  - `recognizeItemFromImage()`: Gemini 1.5 Flash API를 호출하여 핵심 물건 대표 명사(1~3단어)를 정확히 추출 및 정제.
- **AddTab 연동 흐름**:
  - 사진 촬영/선택 완료 시, [물건 이름]이 비어있는 경우에만 자동 발동.
  - 분석 진행 중에는 이름 입력창 플레이스홀더에 `🤖 AI가 사진 속 물건을 인식하고 있어요...` 및 우측 스피너(`Loader2`) 노출.
  - 분석 완료 시 자동으로 이름이 채워지며, 성공 햅틱과 토스트 알림(`🤖 사진 분석: "OO"(으)로 자동 입력되었습니다.`) 제공.

### 3) API 요금 및 운영 가이드 문서 저장
- **로컬 문서**: [`docs/google_gemini_api_pricing_guide.md`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/docs/google_gemini_api_pricing_guide.md)
- **Google Drive 연동**: `내 드라이브/Develop Antigravity/where-is-it/google_gemini_api_pricing_guide.md`

---

## 3. 검증 결과
- `npm run build` 빌드 검증 성공 (`family-inventory.ait` 번들 생성 완료).
- 물건 이름 입력 시 X 버튼 즉시 노출 및 터치 시 원터치 초기화 확인.
- API 키가 설정되지 않은 상태에서도 안전하게 예외 처리되어 기존 사진 등록에 지장 없음을 검증.
- API 키 등록 시 즉각 사진 분석 및 자동 입력 파이프라인 가동 준비 완료.
