# 🐛 WhereIsIt 검색 탭 onNavigateTab props 누락 런타임 오류 긴급 픽스 (v00201)

본 문서는 WhereIsIt 미니앱에서 **검색 탭에서 물건을 검색하여 상세 화면을 열 때 `Can't find variable: onNavigateTab` 런타임 에러가 발생하던 문제를 해결한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 문제 분석 및 에러 원인

1. **에러 메시지**:
   - `Can't find variable: onNavigateTab`
2. **발생 원인**:
   - `v00200`에서 검색 탭(`SearchTab.tsx`)에 [위치 바로가기 >] 기능을 추가하면서 `onNavigateTab` 함수를 호출하도록 코드를 구성했습니다.
   - 컴포넌트 타입 인터페이스(`SearchTabProps`)에는 `onNavigateTab`이 정상 정의되어 있었으나, 정작 `SearchTab` 함수 컴포넌트 파라미터 디스트럭처링 `{ onZoomImage, registerBackHandler }`에서 `onNavigateTab`을 인자로 꺼내오지 않아, 런타임에 전역 스코프에서 `onNavigateTab`을 찾지 못하고 에러 화면(Error Boundary)이 발생했습니다.

---

## 2. 해결 내역

1. **`SearchTab.tsx` props 파라미터 디스트럭처링 보강**:
   - `export const SearchTab: React.FC<SearchTabProps> = ({ onNavigateTab, onZoomImage, registerBackHandler }) => {` 로 수정하여 부모인 `App.tsx`로부터 전달된 `onNavigateTab` 콜백을 정상적으로 수신하도록 수정했습니다.
2. **정상 동작 검증**:
   - 검색 탭에서 물건을 검색하고 상세 화면을 열었을 때 에러 없이 즉시 표시되며, `[위치 바로가기 >]` 버튼을 누르면 탐색 탭의 해당 보관 위치로 즉시 이동합니다.

---

## 3. 변경 파일 요약

1. `src/components/SearchTab.tsx`:
   - 컴포넌트 인자에 `onNavigateTab` 추가
2. `src/version.ts` & `.env`:
   - `v00201` 버전 업그레이드
3. `docs/walkthrough_v00201.md`:
   - 신규 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 4. 빌드 및 배포 결과

- `npm run build`: Vite 빌드 및 앱인토스 패키징(`family-inventory.ait`) 0건 오류 정상 완료.
- 이제 검색 화면에서 물건을 검색하고 상세 정보를 확인할 때 에러 없이 매끄럽게 동작합니다.
