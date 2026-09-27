# 📦 WhereIsIt Google Drive 자동 동기화 규칙 수립 (v00172)

본 문서는 WhereIsIt 프로젝트의 개발 산출물 및 버전별 워크스루(Walkthrough)를 **Google Drive 및 NotebookLM에 자동 연계·보관**하기 위해 프로젝트 운영 규칙(`.agents/AGENTS.md`)에 신설된 자동화 제약 사항 및 적용 내역을 정리한 문서입니다.

---

## 1. [v00172] 신규 자동화 규칙 제정

### 1.1. 배경 및 목적
- 프로젝트 진행 중 생성되는 기술 명세서 및 버전별 작업 내역(Walkthrough)을 사용자가 수동 복사·이동하는 번거로움 없이, Google Drive 동기화 폴더에 상시 자동 보관하여 NotebookLM(`where-is-it`) 소스로 원클릭 등록할 수 있도록 프로세스를 표준화했습니다.

### 1.2. 반영된 규칙 파일
- [`.agents/AGENTS.md`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/.agents/AGENTS.md)
- [`.clinerules`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/.clinerules)
- [`.ai_rules`](file:///Users/daewookim/.gemini/antigravity/scratch/where-is-it/.ai_rules)

### 1.3. 규칙 조항 (Google Drive Walkthrough Auto-Sync Constraint)
```markdown
## Google Drive Walkthrough Auto-Sync Constraint
- Rule: Every time code is modified and the version is bumped, ALWAYS automatically generate the detailed walkthrough document for that version at:
  `/Users/daewookim/Library/CloudStorage/GoogleDrive-hansyokim@gmail.com/내 드라이브/Develop Antigravity/where-is-it/walkthrough_v{VERSION}.md`
  and in the local `docs/walkthrough_v{VERSION}.md`.
```

---

## 2. 자동화 워크플로우

1. **사용자 요청**: 기능 개발, 버그 수정, UI 변경 요청
2. **에이전트 실행**:
   - 코드 수정 및 로컬 정적 검사 (`tsc`)
   - 버전 1단계 상향 (`src/version.ts`, `.env`)
   - 토스 패키징 (`npm run build` / `ait build`)
   - 깃 커밋 및 푸시 (`git push origin main`)
   - **구글 드라이브 및 `docs/`에 `walkthrough_v{VERSION}.md` 자동 생성 및 동기화**
   - 백그라운드 태스크 정리 (`0 tasks running`)
3. **NotebookLM 연동**:
   - 사용자는 [NotebookLM](https://notebooklm.google.com/)에서 **[소스 추가] > [Google Drive]**를 누르면 최신 버전의 Walkthrough가 이미 준비되어 있어 즉시 소스로 추가 가능.

---

## 3. 검증 결과
- **규칙 파일 동기화**: `.agents/AGENTS.md`, `.clinerules`, `.ai_rules` 3개 파일 완벽 반영
- **버전 파일**: `src/version.ts`, `.env` ➔ `v00172` 반영
- **동기화 경로**:
  - Google Drive: `내 드라이브/Develop Antigravity/where-is-it/walkthrough_v00172.md`
  - 프로젝트 로컬: `docs/walkthrough_v00172.md`
  - 에이전트 아티팩트: `walkthrough.md`
- **백그라운드 태스크**: 0 running (클린 상태)

---
- **문서 작성일**: 2026년 9월 27일
- **적용 버전**: v00172
