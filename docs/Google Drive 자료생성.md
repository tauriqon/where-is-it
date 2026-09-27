# 📁 Google Drive 자료 생성 및 NotebookLM 연동 가이드

본 문서는 WhereIsIt 프로젝트 진행 중 **Google Drive에 원하는 문서를 생성하기 위한 프롬프트 템플릿**과, 코드 수정 및 버전 갱신 시 **Walkthrough 문서를 구글 드라이브에 자동 보관(Auto-Sync)**하기 위한 운영 가이드입니다.

---

## 1. Google Drive 동기화 기본 경로

- **Google Drive 경로**: `내 드라이브/Develop Antigravity/where-is-it/`
- **로컬 마운트 절대경로**: `/Users/daewookim/Library/CloudStorage/GoogleDrive-hansyokim@gmail.com/내 드라이브/Develop Antigravity/where-is-it/`
- **프로젝트 내부 백업 경로**: `docs/`

---

## 2. 대화창에서 바로 쓰는 프롬프트 템플릿

### 2.1. 버전 수정 후 Walkthrough 저장 요청 (표준)
```text
수정 작업 완료 후 이번 버전의 Walkthrough 문서를 구글 드라이브(Develop Antigravity/where-is-it/walkthrough_v{버전}.md)에 저장해줘.
```

### 2.2. 간편 단축형 요청
```text
방금 작업한 내용으로 구글 드라이브에 최신 walkthrough.md 저장해줘.
```

### 2.3. 특정 주제 및 명세서 문서 생성 요청
```text
[원하는 주제, 예: 현재 Supabase 테이블 스키마 및 RLS 보안 규칙 / 토스 광고 연동 가이드 / 네이티브 헤더 정책]를 마크다운으로 정리해서 구글 드라이브(Develop Antigravity/where-is-it/)에 [파일명.md]로 저장해줘.
```

---

## 3. 완전 자동화 방안 (Zero-Prompt Automation)

매번 프롬프트를 입력하지 않고도, **코드를 수정하고 버전을 올릴 때마다(`v00172`, `v00173`...) 에이전트가 알아서 구글 드라이브에 `walkthrough_v?????.md`를 자동 생성**하도록 프로젝트 규칙(`.agents/AGENTS.md`)에 등록하는 방법입니다.

### 3.1. 자동화 규칙 정의 (`.agents/AGENTS.md`)
```markdown
## Google Drive Walkthrough Auto-Sync Constraint
- **Rule**: Every time code is modified and the version is bumped, ALWAYS automatically generate the detailed walkthrough document for that version at:
  `/Users/daewookim/Library/CloudStorage/GoogleDrive-hansyokim@gmail.com/내 드라이브/Develop Antigravity/where-is-it/walkthrough_v{VERSION}.md`
  and in the local `docs/walkthrough_v{VERSION}.md`.
```

### 3.2. 자동화 흐름
1. **사용자**: 평소처럼 기능 개발 또는 UI 수정 요청 (예: "홈 화면 버튼 위치 바꿔줘")
2. **AI 에이전트**:
   - 코드 수정 및 테스트
   - 버전 상향 (`version.ts`, `.env`)
   - 토스 패키징(`ait build`) 및 깃 커밋/푸시
   - **Google Drive 경로에 `walkthrough_v?????.md` 자동 생성 및 로컬 `docs/` 백업**
   - 백그라운드 태스크 정리 (`0 tasks running`)
3. **NotebookLM 활용**:
   - 사용자는 [NotebookLM](https://notebooklm.google.com/) 접속 ➔ **`where-is-it`** 노트북 열기
   - **[소스 추가 (+)] ➔ [Google Drive]** 선택
   - 이미 동기화되어 목록에 대기 중인 최신 **`walkthrough_v?????.md`**를 클릭 한 번으로 소스 등록 완료!

---

## 4. 참고 사항
- Google Drive에 저장된 `.md` 파일은 클라우드와 수초 내에 실시간 동기화됩니다.
- NotebookLM은 마크다운(`.md`), PDF, 텍스트(`.txt`), Google Docs 형식을 모두 공식 지원합니다.

---
- **작성일**: 2026년 9월 27일
- **프로젝트**: WhereIsIt (내 물건 어디 있지?)
