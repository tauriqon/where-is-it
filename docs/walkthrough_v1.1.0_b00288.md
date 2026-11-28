# 아 찾았다! (Where is it?) - v1.1.0 (b00288) 변경 내역 및 Walkthrough

**문서 생성일시**: 2026-11-28  
**대상 버전**: `v1.1.0 (b00288)`  
**작업 요약**: 안드로이드 토스 웹뷰에서 사진 입력·카메라 촬영 시 이미지가 깨지고(`preview` 깨짐 아이콘) AI 인식이 실패하던 치명적 버그 해결

---

## 1. 장애 현상 및 근본 원인 (Root Cause)

### 1) 증상
- iOS에서는 정상 작동했으나, 안드로이드 폰에서 카메라 촬영 또는 앨범 사진 선택 시:
  1. 사진 미리보기 영역에 깨진 이미지 아이콘(`preview`)만 표시됨.
  2. AI 사진 이름·태그 자동 인식도 함께 실패함.

### 2) 근본 원인 (2중 원인)
1. **`ImagePickerBottomSheet.tsx`의 `dataUriToFile` 안드로이드 raw base64 처리 결함**:
   - 안드로이드 토스 SDK(`openCamera({ base64: true })`, `fetchAlbumPhotos({ base64: true })`)는 iOS와 달리 `data:image/jpeg;base64,` 접두사 없이 **순수 base64 문자열(및 76자마다 `\n` 줄바꿈 포함)**을 반환하는 경우가 많습니다.
   - 기존 `dataUriToFile`은 이를 무조건 `fetch(dataUri)`에 넘겼고, 브라우저가 이를 상대 경로 URL로 오인해 호출하면서 SPA 폴백 HTML(`200 OK`, `text/html`)을 이미지 `File`로 포장해 버려 파일 자체가 손상되었습니다.
2. **안드로이드 웹뷰 `blob:` URL 로딩 제약**:
   - `AddTab.tsx`, `imageCompressor.ts`, `aiVision.ts`가 `URL.createObjectURL(file)` 단일 경로에만 의존하여 안드로이드 웹뷰의 `blob:` 제한 환경에서 이미지 렌더링·리사이징이 실패할 위험이 있었습니다.

---

## 2. 세부 수정 사항

### 1) `src/components/ImagePickerBottomSheet.tsx`
- `dataUriToFile` 전면 개선:
  - `data:` URI 및 **접두사 없는 Android 순수 base64**를 `fetch()` 없이 직접 `atob`로 바이너리 디코딩 (`\s` 줄바꿈 제거 및 URL-safe 문자 정규화, 매직 시그니처 기반 MIME 판별).
  - `http(s):`/`blob:`/`file:`/`content:` URL인 경우에만 `fetch`를 사용하며, 응답 `blob.type.startsWith('image/')` 및 `blob.size > 0` 엄격 검증.
  - 변환 실패 시 0바이트 빈 파일 대신 예외를 발생시켜 HTML5 `<input type="file">` 폴백이 안전하게 작동하도록 보강.

### 2) `src/utils/imageCompressor.ts` & `src/services/aiVision.ts`
- `fileToPreviewDataUrl` 유틸리티 추가 및 내보내기.
- `compressImage`와 `resizeImageForAI`에서 `blob:` URL 로딩 실패(`img.onerror`) 시 자동으로 `FileReader.readAsDataURL`로 재시도하는 2중 안전 폴백 탑재.

### 3) `src/components/AddTab.tsx`
- 이미 1024px(약 100~200KB)로 경량 압축된 `optimizedFile`의 미리보기 URL을 `fileToPreviewDataUrl` 기반 Data URL로 생성하도록 전환하여, 안드로이드·iOS 모든 웹뷰에서 메모리 부담 없이 100% 선명하게 표시되도록 개선.

### 4) 버전 업데이트
- `src/version.ts`: `APP_BUILD_NUMBER = 'b00288'`
- `.env`: `VITE_APP_VERSION=v1.1.0-b00288`

---

## 3. 검증 결과
- `npm run build` 정상 완료 (`family-inventory.ait` 번들 생성).
- Google Drive 자동 동기화 및 GitHub `main` 푸시 완료.
