# 📐 WhereIsIt 사진 등록 시 '파일에서 선택' 배제 및 [카메라 촬영 / 사진 앨범] 전용 바텀시트 구현 (v00215)

본 문서는 WhereIsIt 미니앱에서 **사진 등록 시 모바일 OS의 모호한 '파일에서 선택(파일 앱)' 메뉴를 완전히 배제하고, [📷 카메라로 직접 촬영]과 [🖼️ 사진 앨범(보관함)에서 선택] 2가지 전용 선택 바텀시트를 앱 전반에 구축한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 개선 배경 및 사용자 피드백

1. **사용자 요청 사항**:
   - "그리고 파일에서 선택은 없애자."
   - 세부 방향 확인: **"[📷 카메라 촬영]과 [🖼️ 사진 앨범(보관함)] 2가지 선택 팝업만 표시하고 파일 선택은 배제"**
2. **원인 및 문제 분석**:
   - 기존의 표준 `<input type="file" accept="image/*">` 방식은 스마트폰(iOS 등)에서 탭할 때 시스템 팝업에 `사진 보관함`, `사진 찍기` 외에 원치 않는 `파일 선택(또는 파일에서 선택 - iCloud/문서 앱)` 옵션이 함께 노출되었습니다.
   - 사용자 입장에서는 보관 물건이나 수납장 사진을 찍는데 문서 파일 탐색기가 뜨는 것이 불필요하고 혼란을 줄 수 있었습니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. `ImagePickerBottomSheet` 전용 컴포넌트 신규 구현 (`src/components/ImagePickerBottomSheet.tsx`)
- **토스 스타일 슬라이딩 업 시트**:
  - 카메라 아이콘이나 사진 등록 영역 탭 시 화면 하단에서 부드럽게 올라오는 액션 시트 제공.
- **오직 2가지 핵심 액션만 명확히 노출**:
  1. **`📷 카메라로 직접 촬영`**:
     - 토스 네이티브 브릿지 `openCamera` 우선 호출.
     - 웹뷰/브라우저 fallback 시 `<input type="file" accept="image/*" capture="environment">`를 트리거하여 시스템 팝업 없이 **기기 카메라가 즉시 실행**됩니다.
  2. **`🖼️ 사진 앨범(보관함)에서 선택`**:
     - 토스 네이티브 브릿지 `fetchAlbumPhotos` 우선 호출 (파일 앱이 배제된 순수 사진 앨범 피커 실행).
     - 웹뷰/브라우저 fallback 시 이미지 전용 파일 인풋 연동.
  3. **`취소`**:
     - 바텀시트를 닫고 이전 상태를 안전하게 유지.
- **철저한 유효성 검증**:
  - 선택된 파일의 MIME 타입이 `image/`로 시작하지 않을 경우 즉시 차단하여 비이미지 파일의 유입 원천 방지.

### 2.2. 토스 앱 네이티브 권한 선언 (`apps-in-toss.config.ts`, `granite.config.ts`)
- `photos`(read), `camera`(access) 권한을 정식 선언하여 토스 인앱 환경에서 네이티브 카메라 및 사진첩 브릿지가 원활하게 동작하도록 설정.

### 2.3. 앱 전반의 모든 사진 등록 UI에 일괄 적용
1. **`ItemDetailBottomSheet.tsx`**: 수납처 추가, 세부위치 추가, 물건 사진 수정 모두 연동.
2. **`ExploreTab.tsx`**: 위치탐색 탭 내 빠른 수납처/세부위치 추가 연동.
3. **`SearchTab.tsx`**: 검색 탭 내 빠른 수납처/세부위치 추가 연동.
4. **`SettingsTab.tsx`**: 보관위치 관리 신규 등록 및 기존 수납처/세부위치 사진 수정 연동.
5. **`AddTab.tsx`**: 메인 새 물건 등록 화면의 사진 등록 연동.

---

## 3. 변경 파일 목록

1. `src/components/ImagePickerBottomSheet.tsx` (신규):
   - 카메라 촬영 / 사진 앨범 전용 선택 바텀시트
2. `apps-in-toss.config.ts` & `granite.config.ts`:
   - `photos`, `camera` 퍼미션 설정 등록
3. `src/components/ItemDetailBottomSheet.tsx`:
   - `ImagePickerBottomSheet` 연동 및 기존 파일 인풋 교체
4. `src/components/ExploreTab.tsx`:
   - `ImagePickerBottomSheet` 연동 및 기존 파일 인풋 교체
5. `src/components/SearchTab.tsx`:
   - `ImagePickerBottomSheet` 연동 및 기존 파일 인풋 교체
6. `src/components/SettingsTab.tsx`:
   - `ImagePickerBottomSheet` 연동 및 보관위치 등록/수정 교체
7. `src/components/AddTab.tsx`:
   - `ImagePickerBottomSheet` 연동 및 물건 등록 사진 인풋 교체
8. `src/version.ts` & `.env`:
   - `v00215` 버전 업그레이드
9. `docs/walkthrough_v00215.md`:
   - 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 4. 빌드 및 배포 검증

- `npm run build`: Vite 빌드 및 앱인토스 패키징 0건 에러 정상 통과 (`family-inventory.ait`).
- 이제 앱 어디서든 사진을 등록할 때 불필요한 '파일에서 선택' 없이, 카메라 촬영과 사진 앨범 2가지만 명확하게 선택할 수 있습니다.
