# 🚀 어디뒀더라? (where-is-it) Walkthrough (v1.1.0-b00240)

## 📌 릴리즈 개요
- **릴리즈 버전**: `v1.1.0`
- **빌드 번호**: `b00240`
- **배포 deploymentId**: `01a1e359-5374-796a-a543-968a41ba930e`
- **주요 목표**: **위치 탐색 탭의 `useMemo` 누락 런타임 오류 긴급 수정**

---

## 🔍 에러 원인 분석 (Root Cause)

### 1. 현상
- 앱 하단의 `위치 탐색` 탭을 누르면 다음 오류 화면이 발생:
  > **"화면을 불러오는 중 오류가 발생했습니다"**<br>
  > `Can't find variable: useMemo`

### 2. 원인
- `b00238` 빌드에서 공간 중복 방어 렌더링을 위해 `displaySpaces` 및 `sameNameSpaceIds`에 `useMemo`를 도입했으나, `ExploreTab.tsx` 최상단 import문에 `useMemo`가 누락되어 런타임 참조 에러(`ReferenceError`)가 발생했습니다.

---

## 🛠️ 해결 및 조치 내용

- **위치**: `src/components/ExploreTab.tsx`
- **수정**:
  - `import React, { useState, useEffect, useRef, useMemo } from 'react';`로 `useMemo` 임포트를 정상 추가.
  - 이제 `위치 탐색` 탭 진입 시 에러 없이 즉시 정상 렌더링되며, 중복 없는 깔끔한 공간 목록이 표시됩니다.

---

## 🎯 검증 결과
1. **타입스크립트 검사**: `npx tsc --noEmit` 통과 (에러 0건).
2. **프로덕션 빌드**: `npm run build` 성공 (`deploymentId: 01a1e359-5374-796a-a543-968a41ba930e`).
