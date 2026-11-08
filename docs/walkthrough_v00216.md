# 📐 WhereIsIt 등록 탭 런타임 에러(`imagePreview`) 복구 및 에러 바운더리 자동 복구 강화 (v00216)

본 문서는 WhereIsIt 미니앱에서 **'등록' 탭 진입 시 발생했던 `Can't find variable: imagePreview` 런타임 에러를 해결하고, 새로고침 시에도 동일 에러 화면에 갇히는 무한 루프 현상을 방지하도록 AppErrorBoundary의 자동 복구 메커니즘을 강화한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 발생 원인 및 문제 분석

1. **사용자 제보 현상**:
   - 하단 탭 바에서 '등록' 탭을 선택하자 에러 화면(ErrorBoundary) 발생:
     - `화면을 불러오는 중 오류가 발생했습니다`
     - `Can't find variable: imagePreview`
   - 이후 '새로고침 시도하기' 버튼을 누르거나 앱을 새로 시작해도 계속 동일한 에러 화면에 갇히는 현상 발생.

2. **원인 분석**:
   - **원인 1 (`AddTab.tsx`)**: v00215 버전에서 카메라/사진 앨범 전용 바텀시트(`ImagePickerBottomSheet`)를 연동하던 중, 상태 변수 교체 과정에서 `const [imagePreview, setImagePreview] = useState<string | null>(null);` 선언부가 누락되었습니다. 이로 인해 '등록' 탭 진입 시 JSX에서 `imagePreview` 참조 에러(`ReferenceError`)가 발생했습니다.
   - **원인 2 (`App.tsx` ErrorBoundary)**: 사용자가 마지막으로 머문 활성 탭이 `localStorage ('wii_active_tab')`에 저장되어 있는데, '등록(`add`)' 탭에서 에러가 발생한 상태에서 단순 `window.location.reload()`만 실행할 경우 다시 `add` 탭을 마운트하면서 에러 화면이 반복되는 루프가 발생했습니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. `AddTab.tsx` 내 누락된 `imagePreview` 상태 선언부 복구
- `src/components/AddTab.tsx` 파일 내 `imagePreview` 상태 훅을 정상 복원:
  ```tsx
  // 이미지 업로드 상태
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  ```
- 사진 선택 핸들러(`handleImageSelected`), 취소 초기화(`handleCancel`), 등록 성공 후 초기화, 이미지 미리보기 렌더링 영역이 모두 정상 작동하도록 완벽 복원되었습니다.

### 2.2. `App.tsx` 에러 바운더리 무한 루프 탈출 안전장치 마련
- `AppErrorBoundary` 컴포넌트의 `새로고침 시도하기` 버튼 클릭 시:
  - `localStorage.setItem('wii_active_tab', 'home')`를 통해 활성 탭을 안전한 기본 '홈(홈 탭)'으로 강제 리셋.
  - 임시 작성 중이던 드래프트 데이터(`wii_add_item_draft`)를 소거하여 잠재적 렌더링 충돌 방지.
  - 이후 페이지를 리로드함으로써, 특정 탭에서 에러가 발생하더라도 앱 재실행 시 항상 안전하게 홈 화면으로 복귀할 수 있도록 보장.

---

## 3. 변경 파일 목록

1. `src/components/AddTab.tsx`:
   - `imagePreview` / `setImagePreview` 상태 훅 복원
2. `src/App.tsx`:
   - `AppErrorBoundary` 새로고침 핸들러에 홈 탭 리셋 및 세션 드래프트 정리 방어 로직 추가
3. `src/version.ts` & `.env`:
   - 앱 버전을 `v00216`으로 업데이트

---

## 4. 검증 결과

1. **빌드 검증**:
   - `npm run build` 결과 Vite 및 앱인토스(AIT) 패키징(`family-inventory.ait`) 0 에러로 빌드 성공.
2. **동작 검증**:
   - '등록' 탭 진입 시 정상적으로 3단계 보관 위치 선택기, 스마트폰 카메라/앨범 연동 사진 등록 영역, 물건 정보 입력창이 정상 렌더링됨.
   - 예외 발생 시에도 새로고침을 통해 안전하게 홈 탭으로 복구 가능.
