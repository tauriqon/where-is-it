# 📦 WhereIsIt 홈 탭 '최근 활동 물건' UX 정돈 (v00173)

본 문서는 WhereIsIt 토스 인앱 미니앱의 홈 탭에서 불필요한 시각적 노이즈를 유발하고 하단 탭 내비게이션과 중복되던 **[전체 보기 >] 링크 버튼을 제거**하여 보다 직관적이고 깔끔한 토스 스타일 미니멀 대시보드를 구축한 작업 내역을 정리한 워크스루(Walkthrough)입니다.

---

## 1. [v00173] 주요 변경 및 개선 사항

### 1.1. 배경 및 문제점
- **멘탈 모델 불일치**: [최근 활동 물건] 옆의 [전체 보기 >] 버튼 클릭 시, 사용자가 기대하는 '최근 등록/수정 활동 타임라인 목록'이 아닌 '하단 탐색(Explore) 탭(공간별 수납 위치 계층 트리)'으로 단순 화면 전환되어 혼란을 유발함.
- **하단 내비게이션과의 중복**: 화면 하단 탭 바에 항상 고정 노출되는 [탐색] 버튼과 100% 동일한 기능을 수행하여 시각적 및 기능적 중복(Redundancy) 발생.
- **시각적 산만함**: 깔끔한 타이틀 옆에 파란색 보조 버튼이 위치하여 카드 대시보드의 정돈된 인상을 저해함.

### 1.2. 코드 수정 내역
- **대상 파일**: `src/components/HomeTab.tsx`
- `items.length > 4` 조건으로 렌더링되던 `[전체 보기 >]` 버튼 태그를 완전히 제거.
- `최근 활동 물건` 타이틀(`h2-title`)을 단독 헤더로 간결하게 배치하여 여백과 폰트 위계를 깔끔하게 정리.

```tsx
// 변경 전:
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
  <h2 className="h2-title" style={{ fontSize: '20px' }}>최근 활동 물건</h2>
  {items.length > 4 && (
    <button onClick={() => onNavigateTab('explore')}>
      전체 보기 <ChevronRight size={16} />
    </button>
  )}
</div>

// 변경 후:
<div style={{ marginBottom: '16px' }}>
  <h2 className="h2-title" style={{ fontSize: '20px', margin: 0 }}>최근 활동 물건</h2>
</div>
```

---

## 2. 품질 검증 및 빌드 배포 현황

1. **정적 타입 검사**: `npx tsc --noEmit` ➔ 0 오류 (Clean)
2. **토스 앱인토스 패키징**: `npm run build` (`vite build && ait build`) ➔ `family-inventory.ait` 정상 생성 (Deployment ID: `01a0e172-021c-7638-85de-4c67654594c2`)
3. **버전 관리**: `src/version.ts`, `.env` ➔ `v00173` 동기화 완료
4. **Google Drive 자동 동기화**: `walkthrough_v00173.md` 생성 완료
5. **백그라운드 태스크**: 0 tasks running (클린)

---
- **문서 작성일**: 2026년 9월 27일
- **적용 버전**: v00173
