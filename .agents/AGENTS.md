# Project-Scoped Rules & Constraints

## Commit Message Versioning Constraint
- **Rule**: Every commit message MUST include the current version number of the application.
- **Format**: `[commit message] ([version])` (e.g., `feat: swap home tab sections (v00050)`).

## Command Execution & Background Task Constraint
- **Rule**: ALWAYS run shell commands synchronously (with sufficient `WaitMsBeforeAsync`) or immediately manage/kill any background tasks so that lingering tasks never clutter the UI (`tasks running` spinners).

