# 🛠️ WhereIsIt 토스 v3 정식 설정 파일(apps-in-toss.config.ts) 동기화 및 네이티브 타이틀 숨김 완전 적용 (v00204)

본 문서는 WhereIsIt 미니앱에서 **토스 앱 네이티브 헤더의 기존 아이콘과 타이틀이 숨겨지지 않고 그대로 노출되던 원인을 규명하고, 앱인토스 3.x의 정식 설정 파일인 `apps-in-toss.config.ts`를 업데이트하여 `navigationBar: { withTitle: false }`를 패키지에 완벽히 반영한 내역**을 정리한 워크스루(Walkthrough)입니다.

---

## 1. 근본 원인 규명: 왜 네이티브 타이틀이 여전히 보였을까?

1. **앱인토스 v2 ➔ v3 설정 파일 체계의 차이**:
   - 앱인토스 2.x에서는 `granite.config.ts`를 사용했으나, 앱인토스 3.x(`@apps-in-toss/cli` 3.x)부터는 **`apps-in-toss.config.ts`**가 공식 표준 설정 파일로 채택되었습니다.
   - 프로젝트 루트에 `granite.config.ts`와 `apps-in-toss.config.ts` 두 파일이 공존하고 있었는데, 패키징 도구인 **`ait build`는 오직 `apps-in-toss.config.ts`만 읽어서 `.ait` 아티팩트를 생성**하고 있었습니다.
2. **불일치로 인한 증상**:
   - 이전 작업에서 `granite.config.ts`에 `navigationBar: { withTitle: false }`를 선언하고 새 아이콘 URL을 넣었으나, `ait build`가 읽는 `apps-in-toss.config.ts`는 수정되지 않은 채 구버전 상태(`withTitle: true`, `app-icon-v80.png`)로 남아 있었습니다.
   - 이로 인해 `.ait` 아티팩트 빌드 시 네이티브 타이틀 숨김 옵션이 누락되어, 토스 앱 화면에 여전히 네이티브 헤더(`< 🏠 어디 뒀더라?`)가 노출되었던 것입니다.

---

## 2. 주요 해결 및 변경 내역

### 2.1. `apps-in-toss.config.ts`에 최신 설정 완벽 반영
- `apps-in-toss.config.ts` 파일에 `navigationBar: { withTitle: false }`와 신규 고밀도 타이트 크롭 아이콘 URL(`app-icon-v202.png`)을 정식으로 동기화했습니다:
  ```ts
  export default defineConfig({
    appName: 'family-inventory',
    brand: {
      displayName: '어디 뒀더라?',
      primaryColor: '#3182f6',
      icon: 'https://frpqupppuosfpdpjfbsk.supabase.co/storage/v1/object/public/item-images/brand/app-icon-v202.png',
    },
    navigationBar: {
      withTitle: false,
    },
    // ...
  });
  ```

### 2.2. 빌드 아티팩트(`family-inventory.ait`) 바이너리 검증 완료
- `npm run build` (`vite build && ait build`) 실행 후, `strings family-inventory.ait | grep -i "withTitle"` 명령을 통해 `withTitle: false` 설정이 최종 아티팩트 내에 확실히 포함되었음을 바이너리 레벨에서 직접 검증했습니다.

---

## 3. 변경 파일 요약

1. `apps-in-toss.config.ts`:
   - `navigationBar.withTitle: false` 및 `brand.icon` 업데이트
2. `src/version.ts` & `.env`:
   - `v00204` 버전 업그레이드
3. `docs/walkthrough_v00204.md`:
   - 신규 워크스루 문서 작성 및 구글 드라이브 동기화

---

## 4. 빌드 및 배포 결과

- `npm run build`: Vite 빌드 및 앱인토스 패키징(`family-inventory.ait`) 0건 오류 정상 완료.
- 이제 토스 앱에서 실행 시 네이티브 헤더의 `<` 뒤에 있던 앙증맞은 아이콘과 텍스트가 완전히 숨겨지고, 바로 아래 우리 앱의 28px 큼직한 브랜드 로고 헤더만 시원하게 노출됩니다.
