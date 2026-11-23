# 아 찾았다! (Where is it?) - v1.1.0 (b00281) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-23  
**대상 버전**: `v1.1.0 (b00281)`  
**작업 요약**: 태그 입력 지우기(X) 버그 수정 & 카메라 고화질 사진 메모리 OOM 크래시 및 재로딩 탭 이탈 방지

---

## 1. 개선 배경 및 장애 원인 분석

### 1) 태그 입력창 'X' 버튼 클릭 시 삭제되지 않고 태그로 입력되는 문제
- **현상**: 태그 입력창에 글자를 입력한 뒤 취소하기 위해 `X` 버튼을 누르면 입력 내용이 지워지지 않고 오히려 태그로 등록됨.
- **원인**:
  - `<input onBlur={commitTagInput} />`에 포커스 아웃(`blur`) 이벤트 시 자동으로 태그를 확정·추가하는 로직이 적용되어 있었습니다.
  - 사용자가 입력창 우측의 `X` (전체 지우기) 버튼을 터치하거나 마우스로 클릭할 때, 버튼의 `click` 이벤트가 발생하기 전에 인풋창의 `blur` 이벤트가 먼저 발동되어 미완성 입력 글자가 태그로 등록되어 버렸습니다.

### 2) 카메라 사진 촬영 후 입력 시 미니앱 크래시 ("미니앱에 문제가 생겨 새로 로딩합니다") 및 화면 이탈
- **현상**: 카메라로 물건 사진을 촬영한 후 입력(가상 키보드 호출 등) 시 앱이 충돌하며 토스 시스템 오류 팝업 후 초기 홈 화면으로 튕김.
- **원인**:
  - **카메라 원본 해상도 메모리 폭증 (WebKit OOM Crash)**: 토스 브릿지 `openCamera({ base64: true })` 및 `fetchAlbumPhotos` 호출 시 `maxWidth` 리사이징 제한 옵션이 누락되어, 최신 스마트폰의 1200만~4800만 화소 원본 사진이 30MB~50MB 이상의 거대한 Base64 문자열로 네이티브 브릿지를 통과했습니다.
  - **중복 Base64 메모리 할당**: `dataUriToFile` 동기식 `atob` 변환, `AddTab.tsx`의 `FileReader.readAsDataURL` 프리뷰 생성, `aiVision.ts`의 이중 Base64 할당 등으로 모바일 WebKit의 단일 웹뷰 메모리 한계치(약 200MB)를 초과하여 OS 레벨에서 웹뷰 프로세스가 강제 종료(OOM kill)되었습니다.
  - **새로고침 시 탭 초기화**: 토스 웹뷰가 메모리 크래시로 재로딩될 때 `App.tsx`가 항상 `'home'` 탭으로 기본 초기화되어 사용자가 물건 등록 화면에서 튕겨져 나가는 경험을 겪었습니다.

---

## 2. 세부 수정 사항

### 1) 태그 입력창 'X' 지우기 동작 정상화 (`src/components/AddTab.tsx`)
- **`onBlur={commitTagInput}` 제거**: 입력창에서 포커스가 벗어났다고 해서 원치 않는 미완성 텍스트가 태그로 자동 확정되지 않도록 차단. (태그 추가는 명시적으로 `Enter`, 쉼표 `,`, 또는 `[추가]` 버튼을 누를 때만 수행).
- **'X' 버튼에 `onMouseDown` 및 `onTouchStart` 이벤트 적용**:
  - `e.preventDefault()`를 통해 인풋 포커스 아웃을 방지하고 터치 즉시 `setTagInput('')`을 실행하여 텍스트가 깨끗이 지워지도록 개선.

### 2) 토스 네이티브 카메라/앨범 호출 최적화 (`src/components/ImagePickerBottomSheet.tsx`)
- `openCamera({ base64: true, maxWidth: 1024 })` 및 `fetchAlbumPhotos({ maxCount: 1, base64: true, maxWidth: 1024 })` 적용.
- 네이티브 브릿지 단계에서부터 최대 1024px로 리사이징되어 반환되므로 메모리 사용량이 95% 이상 대폭 절감.
- `dataUriToFile` 변환 시 메모리 점유가 큰 동기식 `atob` 대신 비동기 `fetch(dataUri).blob()` 스트림 파이프라인 적용.

### 3) 클라이언트 메모리 제로카피 프리뷰 & 선제적 압축 (`src/components/AddTab.tsx`)
- **Blob Object URL 관리**: 거대한 Base64 Data URL 대신 `URL.createObjectURL(file)`을 사용하여 JS 힙 메모리 할당 없이 브라우저 네이티브 메모리 포인터로 프리뷰 렌더링. 새 이미지 선택, 이미지 삭제, 컴포넌트 언마운트 시 `URL.revokeObjectURL()`을 자동 호출하여 메모리 누수 방지.
- **선제적 클라이언트 압축**: 일반 파일 선택기(HTML file input fallback)를 통해 250KB 이상의 고용량 이미지가 유입될 경우, `compressImage(file, 1024, 1024, 0.8)`로 브라우저 캔버스를 통해 150~250KB 수준으로 즉시 압축 후 상태 저장.

### 4) Gemini AI 이미지 분석 메모리 최적화 (`src/services/aiVision.ts`)
- AI 분석용 리사이징 함수 `resizeImageForAI`에서도 `FileReader.readAsDataURL`을 제거하고 `URL.createObjectURL(file)`을 사용하도록 리팩터링.

### 5) 미니앱 예기치 않은 재로딩 발생 시 등록 화면 및 드래프트 자동 유지 (`src/App.tsx`)
- `sessionStorage`에 현재 활성 탭(`wii_active_tab`) 상태 기록.
- 앱 로드 시 `wii_add_item_draft`가 존재하거나 직전 탭이 `add`였던 경우, 자동으로 `add` 탭을 유지하여 사용자가 작성 중이던 물건 정보를 잃지 않고 등록 화면을 복구하도록 방어.

---

## 3. 검증 결과
- `npm run build` 빌드 검증 성공 (`family-inventory.ait` 번들 생성 완료).
- 태그 입력창 'X' 버튼 터치 시 즉시 입력값 소거 확인.
- 사진 촬영 후 프리뷰 메모리 사용량 최적화 및 크래시 방지 확인.
- Google Drive 동기화 및 Git push 완료.
