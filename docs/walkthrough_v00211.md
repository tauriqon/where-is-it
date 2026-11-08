# 📐 WhereIsIt 위치 인라인 빠른 추가 입력창 레이아웃 깨짐 버그 수정 (v00211)

본 문서는 WhereIsIt 미니앱에서 **물건 수정 시 새로운 공간/수납처/세부위치 추가 입력창이 극도로 좁아지고 [추가] 버튼이 화면 대부분을 차지하던 flexbox 레이아웃 오류를 해결하고 UX를 개선한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 이슈 개요 및 원인 분석

1. **사용자 제보**:
   - "입력창 에러" (스크린샷 첨부)
   - `[+ 새 공간]` 클릭 시 텍스트 입력창이 ~30px 너비로 찌그러져 커서만 보이고, `추가` 버튼이 화면의 약 85% 이상을 차지하며 비정상적으로 넓게 늘어나는 현상 발생.
   - 열린 상태에서 토글 버튼에 `+ 닫기`로 아이콘이 `+`로 표기되는 시각적 어색함 및 취소 버튼 부재.
2. **원인 분석**:
   - `src/index.css`의 전역 스타일에서 `.btn-primary`에 `width: 100%`가 지정되어 있었습니다.
   - 플렉스 컨테이너(`display: flex`) 안에서 `<button className="btn-primary">`에 `width: auto` 및 `flex-shrink: 0`을 주지 않아 버튼이 100% 너비를 차지하려 했습니다.
   - 반면 `<input className="input-text">`는 `flex: 1`만 있고 `min-width: 0`이 없어 flexbox 알고리즘에 의해 입력창이 극도로 압축되어 찌그러졌습니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. 인라인 빠른 추가 플렉스 레이아웃 완벽 교정
- **컨테이너**: `style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center', width: '100%' }}`
- **텍스트 입력창 (`input-text`)**:
  - `flex: 1`, `minWidth: 0`을 부여하여 가용 공간 전체를 안정적으로 꽉 채우도록 수정.
  - `minHeight: 38px`, `height: 38px`, `fontSize: 14px`, `border: 1.5px solid var(--toss-blue)`, `borderRadius: 8px`로 또렷하고 명확한 토스 스타일 포커스 가시성 제공.
- **[추가] 버튼 (`btn-primary`)**:
  - `width: 'auto'`, `flexShrink: 0`, `padding: '0 14px'`, `whiteSpace: 'nowrap'`을 명시하여 글자 길이에 맞춰 컴팩트하게 고정.
- **[취소] 버튼 (`btn-secondary`) 추가**:
  - 입력 중 마음이 바뀌었을 때 인라인 창을 즉시 닫고 입력 텍스트를 초기화할 수 있는 전용 [취소] 버튼 제공.
- **토글 버튼 아이콘 교정**:
  - 열린 상태에서는 `X` 아이콘과 함께 `닫기`, 닫힌 상태에서는 `Plus` 아이콘과 함께 `새 공간 / 새 수납처 / 새 위치`로 전환되도록 개선.

### 2.2. 모든 화면 컴포넌트 일괄 반영
- `ItemDetailBottomSheet.tsx` (홈 탭 및 공용 바텀시트)
- `ExploreTab.tsx` (위치탐색 탭 물건 수정 드롭다운)
- `SearchTab.tsx` (검색 탭 물건 수정 카드)
- 3개 화면 모두의 1단계(공간), 2단계(수납처), 3단계(세부위치) 인라인 입력 필드에 동일하게 적용 완료.

---

## 3. 변경 파일 목록

1. `src/components/ItemDetailBottomSheet.tsx`
2. `src/components/ExploreTab.tsx`
3. `src/components/SearchTab.tsx`
4. `src/version.ts` & `.env` (`v00211` 버전 갱신)
5. `docs/walkthrough_v00211.md` (로컬 및 구글 드라이브 동기화)

---

## 4. 빌드 및 배포 검증

- `npm run build`: Vite 및 앱인토스 패키징 0건 에러 정상 완료.
- 모바일 화면에서 `+ 새 공간/수납처/세부위치`를 누르면 텍스트 입력창이 넓고 시원하게 펴지며, 우측에 `[추가] [취소]` 버튼이 깔끔하게 정렬됩니다.
