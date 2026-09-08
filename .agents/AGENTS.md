# Project-Scoped Rules & Constraints

## Commit Message Versioning Constraint
- **Rule**: Every commit message MUST include the current version number of the application.
- **Format**: `[commit message] ([version])` (e.g., `feat: swap home tab sections (v00050)`).

## Command Execution & Background Task Constraint
- **Rule**: ALWAYS run shell commands synchronously (with sufficient `WaitMsBeforeAsync`) or immediately manage/kill any background tasks so that lingering tasks never clutter the UI (`tasks running` spinners).

## Git Push Constraint
- **Rule**: ALWAYS execute `git push origin main` (or current branch with `BypassSandbox: true`) immediately after completing a git commit to ensure remote GitHub repository is always up to date.

## Terminology & Component UI Standards
- **바텀시트 (BottomSheet)**: 토스 스타일 슬라이딩 업 시트 (물건 상세 정보, 수납처 상세 정보 등).
- **하단 고정 시트 (Bottom Fixed Sheet)**: 메인 하단 네비게이션 탭 바를 숨기고, 하단에 `[생성/확인]` 및 `[취소]` 버튼을 고정시켜 입력에 집중하는 전면/서브 폼 레이아웃 (새 보관위치 추가 등).

