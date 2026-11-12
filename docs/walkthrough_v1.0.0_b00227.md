# Walkthrough v1.0.0-b00227 - 토스 콘솔 특수문자 정책 반영 앱 명칭 최적화 ('아 찾았다 · 내 물건 찾기')

## 1. 개요 (Overview)
* **목적**:
  * 토스 개발자 콘솔의 앱 이름 특수문자 허용 정책(`:`, `·`, `?`만 허용)에 부합하도록 앱 표시명을 최적화합니다.
  * 토스 생태계 표준에 최적화된 **가운뎃점(`·`)**을 적용하여 **`아 찾았다 · 내 물건 찾기`**로 공식 명칭을 완벽히 동기화합니다.
* **사용자 결정**:
  > "앱 이름에서 특수문자는 :, ·, ? 만 사용할 수 있다고 나옴."  
  > 가운뎃점(`·`) 활용안 제시 ➔ "아 찾았다 · 내 물건 찾기"

---

## 2. 변경 상세 내역 (Key Implementation Details)

### 2.1 토스 앱 프레임워크 설정 동기화
* **[`apps-in-toss.config.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/apps-in-toss.config.ts)** & **[`granite.config.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/granite.config.ts)**:
  ```typescript
  brand: {
    displayName: '아 찾았다 · 내 물건 찾기', // 콘솔에 등록한 앱 이름과 100% 일치
    primaryColor: '#3182f6',
    ...
  }
  ```
* **[`index.html`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/index.html)**:
  ```html
  <title>아 찾았다 · 내 물건 찾기</title>
  ```

### 2.2 공유 텍스트 및 버전 관리
* **[`src/components/SettingsTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/SettingsTab.tsx)**:
  * 초대 링크 텍스트: `📱 토스 미니앱 [아 찾았다 · 내 물건 찾기] 보러가기`
* **[`src/version.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/version.ts)**:
  * 빌드 번호: `APP_BUILD_NUMBER = 'b00227'` (`v1.0.0 (b00227)`)
* **[`.env`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/.env)**:
  * `VITE_APP_VERSION=v1.0.0-b00227`

---

## 3. 변경 파일 목록 (Changed Files)
* [`apps-in-toss.config.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/apps-in-toss.config.ts): 브랜드 displayName 변경
* [`granite.config.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/granite.config.ts): 브랜드 displayName 변경
* [`index.html`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/index.html): HTML title 태그 변경
* [`src/components/SettingsTab.tsx`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/components/SettingsTab.tsx): 공유 텍스트 명칭 변경
* [`src/version.ts`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/src/version.ts): 빌드 번호 `b00227` 갱신
* [`.env`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/.env): 버전 표기 갱신

---

## 4. 빌드 및 배포 산출물 (Build & Deployment)
* 번들 파일: `family-inventory.ait` 생성 완료 (deploymentId: `01a1cd5d-b63d-72dd-978a-dd1c252feedb`)
* Git 커밋 및 푸시: `refactor: update app display name to 아 찾았다 · 내 물건 찾기 (v1.0.0-b00227)`
