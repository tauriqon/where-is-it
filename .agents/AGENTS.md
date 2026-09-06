# Project-Scoped Rules & Constraints

## Commit Message Versioning Constraint
- **Rule**: Every commit message MUST include the current version number of the application.
- **Format**: `[commit message] ([version])` (e.g., `feat: swap home tab sections (v00050)`).

## Command Execution & Background Task Constraint
- **Rule**: ALWAYS run shell commands synchronously (with sufficient `WaitMsBeforeAsync`) or immediately manage/kill any background tasks so that lingering tasks never clutter the UI (`tasks running` spinners).

## Git Push Constraint
- **Rule**: ALWAYS execute `git push origin main` (or current branch with `BypassSandbox: true`) immediately after completing a git commit to ensure remote GitHub repository is always up to date.

