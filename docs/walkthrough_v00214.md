# 📐 WhereIsIt 세부위치(sections) 추가 시 Supabase 스키마 에러 해결 (v00214)

본 문서는 WhereIsIt 미니앱에서 **물건 수정 시 새로운 세부 위치(3단계 [+ 새 위치])를 추가할 때 발생하던 Supabase 스키마 에러(`Could not find the 'icon' column of 'sections' in the schema cache`)를 원인 분석하고 해결한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 발생 현상 및 원인 분석

1. **발생 현상**:
   - 물건 정보 수정 바텀시트에서 수납처 선택 후 3단계 [+ 새 위치]를 입력하고 추가 시 다음과 같은 알림창 발생:
     > `"Could not find the 'icon' column of 'sections' in the schema cache"`
2. **원인 분석**:
   - Supabase 데이터베이스의 `public.sections` 테이블 스키마에는 `icon` 컬럼이 존재하지 않고(`storage_id`, `name`, `image_url`, `group_id`, `user_id` 등만 존재), 앱 UI는 세부위치에 대해 기본값 `'📍'`(또는 등록된 `image_url` 썸네일)로 렌더링하도록 설계되어 있었습니다.
   - 그러나 빠른 위치 추가 컴포넌트(`ItemDetailBottomSheet.tsx`, `ExploreTab.tsx`, `SearchTab.tsx`)에서 세부위치를 생성할 때 `createSection(..., '📍', imageUrl)` 형태로 명시적인 아이콘 값을 넘기면서, `dbService.sections.create`가 Supabase에 `{ icon: '📍' }` 필드를 포함하여 INSERT 요청을 보냈습니다.
   - Supabase PostgREST 캐시에는 `sections` 테이블의 `icon` 컬럼이 없으므로 스키마 불일치 에러를 반환한 것입니다.

---

## 2. 해결 및 변경 내역

### 2.1. `dbService.sections` Supabase 통신 페이로드 정제 (`src/services/db.ts`)
- **`sections.create`**:
  - Supabase `sections` 테이블로 INSERT 시 `icon` 필드를 제외하고 `{ storage_id, name, image_url, group_id, user_id }`만 안전하게 전송하도록 수정.
  - 앱 내부 React 상태에 반환되는 객체에는 UI 호환성을 위해 `icon: icon || '📍'` 기본값을 안정적으로 부여.
- **`sections.update`**:
  - `updates`에 혹시 `icon`이 포함되어 있더라도 `{ icon: _ignoredIcon, ...dbUpdates }`로 분리하여 Supabase update 시 에러가 발생하지 않도록 방어 코드 구축.
- **`sections.list`**:
  - DB에서 조회한 `sections` 목록 반환 시 `icon: s.icon || '📍'` 폴백을 보장하여 UI 상에서 일관된 핀(`📍`) 표시 제공.
- **`migrateLegacyData`**:
  - 레거시 데이터 마이그레이션 시 `sectionsToInsert`에서 `icon` 필드 제거.

### 2.2. 빠른 추가 호출부 파라미터 정돈
- `ItemDetailBottomSheet.tsx`, `ExploreTab.tsx`, `SearchTab.tsx`:
  - `createSection(editStorageId, newSectionName.trim(), undefined, imageUrl)` 형태로 호출하여, 기존에 정상 작동하던 `SettingsTab.tsx`(보관위치 관리)와 완전히 동일한 파라미터 규격으로 통일.

---

## 3. 변경 파일 목록

1. `src/services/db.ts`:
   - `sections.create`, `sections.update`, `sections.list`, `migrateLegacyData`에서 Supabase `sections` 테이블의 `icon` 컬럼 비존재 이슈 완벽 방어 처리
2. `src/components/ItemDetailBottomSheet.tsx`:
   - `createSection` 호출 시 icon 인자를 `undefined`로 정돈
3. `src/components/ExploreTab.tsx`:
   - `createSection` 호출 시 icon 인자를 `undefined`로 정돈
4. `src/components/SearchTab.tsx`:
   - `createSection` 호출 시 icon 인자를 `undefined`로 정돈
5. `src/version.ts` & `.env`:
   - `v00214` 버전 업그레이드
6. `docs/walkthrough_v00214.md`:
   - 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 4. 빌드 및 배포 검증

- `npm run build`: Vite 및 앱인토스 빌드(`family-inventory.ait`) 0건 에러 정상 완료.
- 이제 물건 수정 바텀시트, 위치탐색 탭, 검색 탭 어디서든 새로운 세부 위치를 추가할 때 스키마 에러 없이 즉시 정상 생성 및 지정됩니다.
