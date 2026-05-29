# 🚀 GitHub - Vercel 자동 연동 및 배포 가이드 (Vite + React + Supabase)

본 문서는 **WhereIsIt** 프로젝트를 GitHub 원격 저장소와 연동하고, Vercel을 통해 글로벌 인프라에 자동 배포(CI/CD)하며, 실시간 업데이트를 처리하는 전 과정을 단계별로 자세히 정리한 가이드입니다. 향후 새로운 프로젝트나 배포 설정을 진행할 때 신속하고 안전한 세팅을 돕는 레퍼런스로 활용할 수 있습니다.

---

## 1. 전제 조건 (Prerequisites)

* **GitHub 계정** 및 **Vercel 계정** 보유
* 로컬 개발 환경에 **Git** 설치 및 프로젝트 초기화 완료
* Supabase 프로젝트가 생성되어 있고, API 정보(`URL`, `ANON_KEY`)가 확보된 상태

---

## 2. [Step 1] GitHub 원격 저장소 설정 (Repository Setup)

Vercel은 GitHub 저장소의 브랜치 이벤트를 감지하여 자동으로 빌드 및 배포를 수행하므로, 최신 소스코드를 GitHub에 안정적으로 동기화하는 것이 첫 단계입니다.

### 2.1. 로컬 저장소 Git 초기화 및 커밋
프로젝트 루트 폴더에서 터미널을 열고 Git 초기화 상태를 점검합니다.
```bash
# 1. Git 저장소 초기화 (이미 되어 있다면 생략 가능)
git init

# 2. 변경 파일 전체 스테이징 (.gitignore가 .env나 node_modules를 제외하는지 반드시 확인)
git add .

# 3. 커밋 생성
git commit -m "feat: 초기 프로젝트 구성 및 Supabase 연동 완료"
```

### 2.2. GitHub 원격 저장소 연결 및 푸시
GitHub 웹사이트에서 새로운 **Private** 또는 **Public** 저장소를 생성한 후, 원격 주소(`https://github.com/사용자이름/저장소이름.git`)를 연결하고 푸시합니다.
```bash
# 1. 기본 브랜치 이름을 main으로 지정
git branch -M main

# 2. 원격 저장소(origin) 연결
git remote add origin https://github.com/tauriqon/where-is-it.git

# 3. main 브랜치를 원격 저장소에 최초 푸시
git push -u origin main
```

---

## 3. [Step 2] Vercel과 GitHub 계정 연동 및 임포트

Vercel 대시보드와 GitHub를 연결하여 저장소 변경 사항을 실시간으로 추적하도록 설정합니다.

1. **Vercel 로그인**: [Vercel 공식 홈페이지](https://vercel.com/)에 접속하여 **Continue with GitHub**를 클릭해 로그인합니다. (GitHub 권한을 연동해두면 저장소 목록을 즉시 가져올 수 있어 매우 편리합니다.)
2. **프로젝트 생성**: Vercel 대시보드 우측 상단의 **[Add New]** 버튼을 클릭하고 **[Project]**를 선택합니다.
3. **저장소 가져오기 (Import)**: 
   * `Import Git Repository` 목록에서 연동된 GitHub 계정의 저장소 중 `where-is-it` 저장소를 찾습니다.
   * 우측의 **[Import]** 버튼을 클릭합니다.
   * *만약 목록에 보이지 않는다면*, `Adjust GitHub App Permissions` 링크를 통해 Vercel이 해당 저장소에 접근할 수 있도록 권한을 허용해 주어야 합니다.

---

## 4. [Step 3] 빌드 및 환경변수(Environment Variables) 설정

Vite 프로젝트의 정상적인 빌드를 위해 컴파일 옵션을 지정하고, Supabase API 키를 환경변수로 입력하는 중요한 단계입니다. **이 설정을 거치지 않으면 배포된 사이트에서 데이터 조회가 불가능합니다.**

### 4.1. Build & Development Settings 설정
Vercel은 리포지토리 안의 `package.json`과 구조를 분석하여 **Framework Preset**을 **Vite**로 자동 감지합니다. 아래 기본 설정을 그대로 유지합니다.
* **Framework Preset**: `Vite`
* **Root Directory**: `./`
* **Build Command**: `npm run build` (내부적으로 TypeScript 컴파일 및 에셋 경량화 번들링 수행)
* **Output Directory**: `dist`

### 4.2. 환경변수 입력 (CRITICAL)
Vite 웹앱은 보안 및 외부 노출 관리를 위해 빌드 시점에 환경변수를 주입받습니다. 로컬의 `.env` 파일에 기록된 정보를 Vercel 대시보드에 그대로 주입해 줍니다.

1. 빌드 설정 영역 아래에 있는 **Environment Variables** 토글을 확장합니다.
2. 다음 두 개의 Key와 Value 쌍을 각각 입력하고 **[Add]** 버튼을 누릅니다.

| Key | Value (예시) | 비고 |
| :--- | :--- | :--- |
| **`VITE_SUPABASE_URL`** | `https://frpqupppuosfpdpjfbsk.supabase.co` | Supabase 프로젝트 URL |
| **`VITE_SUPABASE_ANON_KEY`** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX...` | Supabase Public Anon Key |

> [!IMPORTANT]
> Vite 환경에서는 브라우저 소스코드 단에서 환경변수를 참조하기 위해 반드시 접두사 `VITE_`가 붙어 있어야 합니다. (`VITE_SUPABASE_URL` 등) Vercel에 환경변수를 입력할 때도 로컬 파일과 동일한 대문자 명칭을 그대로 사용해야 오작동을 차단할 수 있습니다.

3. **환경변수 스코프 설정**: 기본값으로 `Production`, `Preview`, `Development` 3개 영역에 모두 체크되어 작동하므로 그대로 둡니다.

---

## 5. [Step 4] 최초 배포 진행 및 확인

모든 설정이 완료되었다면 페이지 하단의 **[Deploy]** 버튼을 클릭합니다.

1. **실시간 빌드 모니터링**: 
   * Vercel 빌드 터미널 창이 나타나면서 소스코드 체크아웃, `npm install` (의존성 로드), `npm run build` (에셋 컴파일) 과정이 실시간으로 진행됩니다.
   * Vite 빌드가 순식간에 완료되며, 성공 시 화면에 화려한 폭죽 애니메이션과 함께 사이트 미리보기(Preview) 썸네일이 제공됩니다.
2. **도메인 접속**:
   * Vercel이 자동으로 생성해 준 도메인 주소(예: `https://where-is-it-xxx.vercel.app`)를 클릭하여 실제 모바일 기기 및 PC 환경에서 접속 상태를 점검합니다.

---

## 6. [Step 5] 지속적 배포 (CI/CD) 파이프라인 활용법

Vercel 연동이 완료된 후부터는 별도의 수동 업로드 작업 없이, Git 명령만으로 완벽한 무중단 자동 업데이트 배포망이 동작합니다.

### 6.1. 프로덕션 자동 배포 (Production Deployment)
* 로컬에서 작업을 마치고 `main` 브랜치로 푸시하면 Vercel이 변경 이벤트를 즉각 인지하여 프로덕션 빌드를 자동으로 실행합니다.
  ```bash
  git add .
  git commit -m "fix(layout): 레이아웃 안정화 패치 반영"
  git push origin main
  ```
* 배포가 완료되는 즉시(약 20~30초 소요) 전 세계 사용자가 접속하는 실제 라이브 URL에 변경 사항이 무중단 패치됩니다.

### 6.2. 프리뷰 배포 (Preview Deployment)
* 여러 명의 개발자가 작업하거나, main에 병합하기 전 사전 검증을 원할 경우 다른 브랜치(예: `dev`, `feature/xxx`)에서 PR(Pull Request)을 생성합니다.
* Vercel은 이 PR을 감지하여 고유한 일회성 임시 웹 주소(Preview URL)를 발급해 줍니다.
* 기획자나 테스터는 main 브랜치에 영향을 주지 않고 이 Preview URL에서 사전에 테스트를 진행한 뒤, 문제가 없을 때 main에 Merge 함으로써 완벽한 안정성을 도모할 수 있습니다.

### 6.3. 즉각적인 롤백 (Instant Rollback)
* 만약 배포된 최신 버전에 치명적인 결함이 발견될 경우, Vercel 대시보드의 **Deployments** 목록으로 이동합니다.
* 정상 작동하던 직전 배포본 우측의 옵션 버튼(`...`)을 눌러 **Instant Rollback**을 선택하면, 단 1초 만에 소스코드를 과거 버전으로 완벽하게 되돌려(Rollback) 서비스 장애를 실시간 방지할 수 있습니다.

---

## 7. 💡 향후 확장을 위한 추가 팁 (Troubleshooting & Tips)

### 7.1. React Router 도입 시 SPA 라우팅(404 에러) 대응
현재 본 앱은 탭 컴포넌트 스위칭 방식이지만, 추후 페이지별 URL 브라우저 라우터(`react-router-dom`)를 적용할 경우, 서브 페이지 URL(예: `/explore`)로 직접 새로고침 접속 시 Vercel 서버가 404 Not Found 에러를 뱉게 됩니다. 이를 해결하기 위해 프로젝트 루트에 `vercel.json` 설정 파일을 다음과 같이 생성하면 됩니다.

* **`vercel.json` 생성 및 작성**
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```
  *(이 설정은 모든 경로 요청을 최상단 `index.html`로 모아주어 클라이언트 사이드 라우팅이 원활하게 동작하도록 차단해 줍니다.)*

### 7.2. 보안을 위한 .env 파일 노출 방지 확인
* 로컬 `.env` 파일에는 데이터베이스 접속 키와 같이 민감한 자격 증명이 포함되어 있으므로 **절대 GitHub 퍼블릭 저장소에 노출되면 안 됩니다.**
* 프로젝트 루트의 `.gitignore` 파일에 반드시 `.env` 라인이 포함되어 있는지 매번 점검하시기 바랍니다.

---
**문서 가이드 작성일**: 2026년 5월 28일  
**배포 기술지원 에이전트**: Antigravity (Google DeepMind advanced AI)
