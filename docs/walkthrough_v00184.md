# 📦 WhereIsIt 전체 화면 타이포그래피(Typography) 표준화 및 일관성 통일 (v00184)

본 문서는 WhereIsIt 토스 인앱 미니앱의 탭별(`ExploreTab`, `SearchTab`, `HomeTab`, `AddTab`, `SettingsTab`)로 상이하게 적용되어 있던 글꼴 크기와 굵기, 행간 등의 속성을 **토스 디자인 시스템(TDS) 표준 스케일**에 맞춰 전면 통합하고, 정돈되고 세련된 시각적 위계를 완성한 작업 내역을 정리한 워크스루(Walkthrough)입니다.

---

## 1. [v00184] 주요 변경 및 개선 사항

### 1.1. 토스 디자인 시스템(TDS) 기반 6계층 타이포그래피 스케일 정립
기존에는 각 컴포넌트 파일마다 인라인으로 `21px`, `26px`, `29px`, `18px`, `17px`, `13px` 등 파편화된 수치가 혼용되어, 탭을 이동할 때마다 시각적 크기가 불균일해 보이는 문제가 있었습니다.  
이에 따라 `src/index.css`의 `:root`에 체계화된 타이포그래피 토큰을 정의하고 전면 적용하였습니다.

| 계층 (Tier) | CSS 변수명 | 폰트 크기 | 굵기 (Weight) | 주 사용 컴포넌트 및 영역 |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Display)** | `--font-size-display` | **24px** | 700 (Bold) | 메인 페이지 타이틀 (`.h1-title`), 탐색 최상단 제목 |
| **Tier 2 (Title)** | `--font-size-title` | **20px** | 700 (Bold) | 섹션 헤더 (`.h2-title`), 바텀시트 제목, 모달 타이틀 |
| **Tier 3 (Card Title)**| `--font-size-card` | **17px** | 600 (SemiBold) | 공간/수납처/세부위치/물건 카드 이름 (`.toss-card-title`) |
| **Tier 4 (Label / Nav)**| `--font-size-label` | **15px** | 600 (SemiBold) | 폼 필드 라벨 (`.form-label`), 브레드크럼, 드롭다운 트리거 |
| **Tier 5 (Body / Path)**| `--font-size-body` | **14px** | 400 (Regular) | 본문 설명 (`.body-desc`), 물건 설명, 보관 위치 경로 |
| **Tier 6 (Caption / Meta)**| `--font-size-caption`| **13px** | 400~500 | 보관 물건 개수, 등록일자 메타텍스트 (`.text-small`) |
| **Tier 7 (Badge / Micro)**| `--font-size-badge` | **11px~12px** | 700 (Bold) | D-Day 디데이 뱃지, 개인 물건 뱃지, 수량 표시 |

---

### 1.2. 컴포넌트별 상세 수정 내역

#### 1. `src/index.css`
- `:root`에 7대 타이포그래피 CSS 토큰 변수 정의:
  - `--font-size-display: 24px;`
  - `--font-size-title: 20px;`
  - `--font-size-card: 17px;`
  - `--font-size-label: 15px;`
  - `--font-size-body: 14px;`
  - `--font-size-caption: 13px;`
  - `--font-size-badge: 11px;`
- 표준 유틸리티 클래스 위계 재정의:
  - `.h1-title`: `26px` ➔ `var(--font-size-display)` (24px, 700)
  - `.h2-title`: `21px` ➔ `var(--font-size-title)` (20px, 700)
  - `.body-desc`: `17px` ➔ `var(--font-size-body)` (14px, 400)
  - `.text-small`: `14px` ➔ `var(--font-size-caption)` (13px, 400)
  - `.toss-card-title`, `.toss-meta-text` 클래스 신규 표준화

#### 2. `src/components/ExploreTab.tsx` (탐색 탭)
- **상단 브레드크럼 네비게이션**:
  - `18px` ➔ `15px` (fontWeight: 500~600)로 최적화하여 좁은 화면에서도 줄바꿈 빈도를 대폭 감소시킴.
- **페이지 메인 타이틀**:
  - `style={{ fontSize: '29px' }}` 인라인 오버라이드를 제거하여 표준 `.h1-title` (24px)로 정돈.
- **Level 1~3 공간 / 수납처 / 세부위치 카드**:
  - 카드 이름: `21px` ➔ `17px` (fontWeight: 600)
  - 우측 카운트 메타 정보: `17px` ➔ `13px` (fontWeight: 500, `var(--text-tertiary)`)
- **Level 4 물건 카드**:
  - 물건 이름: `20px` ➔ `17px`
  - 개인 뱃지 & D-Day 뱃지: `13px` ➔ `11px` (fontWeight: 700)
  - 수량 뱃지: `14px` ➔ `12px`
  - 물건 설명 문구: `16px` ➔ `14px` (`var(--text-tertiary)`)
- **물건 수정 폼 모달**:
  - 폼 라벨: 인라인 `17px` / `16px` 오버라이드 제거 ➔ 표준 `.form-label` (15px, 600) 자동 상속
  - 3단계 위치 선택 드롭다운 트리거 및 옵션: `18px` ➔ `15px`
  - 수량 스테퍼 버튼 및 숫자: `21px` ➔ `18px`
  - 날짜 입력창 및 텍스트에어리어: `18px` ➔ `15px`
- **물건 상세정보 및 수납처/세부위치 미리보기 바텀시트**:
  - 헤딩 타이틀: `26px` ➔ `20px` (표준 `.h2-title`)
  - 보관 위치 경로: `18px` ➔ `15px`
  - 보관 수량 / 유통기한 라벨: `20px` ➔ `15px`, 값: `21px` ➔ `17px`
  - 등록일 메타정보: `16px` ➔ `13px`

#### 3. `src/components/SearchTab.tsx` (검색 탭)
- **물건 상세정보 모달**:
  - 헤딩 타이틀: `22px` ➔ `20px`
  - 개인 뱃지 & D-Day 뱃지: `12px` ➔ `11px`
  - 보관 수량 / 유통기한 라벨: `17px` ➔ `15px`, 값: `18px` ➔ `17px`

#### 4. 버전 동기화
- `src/version.ts`, `.env` ➔ `v00184`.

---

## 2. 품질 검증 및 빌드 배포 현황

1. **정적 타입 검사**: `npx tsc --noEmit` ➔ 0 오류 (Clean)
2. **토스 앱인토스 패키징**: `npm run build` (`vite build && ait build`) ➔ `family-inventory.ait` 정상 빌드 완료 (Deployment ID: `01a0e6b1-5526-7a66-9e46-2768aa03f9ff`)
3. **버전 관리**: `src/version.ts`, `.env` ➔ `v00184` 동기화 완료
4. **Google Drive 자동 동기화**: `walkthrough_v00184.md` 자동 생성 및 동기화 완료
5. **백그라운드 태스크**: 0 tasks running (클린)

---
- **문서 작성일**: 2026년 9월 28일
- **적용 버전**: v00184
