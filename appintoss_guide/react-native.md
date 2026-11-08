---
url: 'https://developers-apps-in-toss.toss.im/tutorials/react-native.md'
description: >-
  React Native 방식으로 앱인토스 미니앱을 개발하는 방법을 안내해요. 프로젝트 생성부터 설정, 실행, 디버깅, 출시까지 전체 과정을
  다뤄요.
---

# React Native 시작하기

::: tip 처음 시작한다면?
앱인토스 개발이 처음이거나 AI와 함께 빠르게 미니앱을 만들어보고 싶다면,\
[AI로 미니앱 만들기](/tutorials/ai-vibe-coding.html) 문서를 먼저 읽어보세요.
:::

React Native 기반의 Granite 프레임워크로 개발하는 방식이에요.\
네이티브 수준의 UI/UX가 필요하거나, 토스앱과 자연스럽게 어우러지는 경험을 만들고 싶은 팀에 적합해요.

* 토스앱의 네이티브 UI와 일관된 경험을 제공하고 싶어요.
* 복잡한 애니메이션이나 제스처 처리가 필요해요.
* React Native 개발 경험이 있는 팀이에요.

::: tip 알아두세요
네이티브 모듈이 필요한 라이브러리는 앱인토스에서 지원하는 범위 내에서만 사용할 수 있어요.
:::

WebView로 개발하고 싶다면 → [WebView 시작하기](/tutorials/webview.html)

***

## 1. 프로젝트 만들기

앱을 만들 위치에서 다음 명령어를 실행하세요.

::: code-group

```sh [npm]
npm create granite-app
```

```sh [pnpm]
pnpm create granite-app
```

```sh [yarn]
yarn create granite-app
```

:::

### 1-1. 앱 이름 지정하기

앱 이름은 [kebab-case](https://developer.mozilla.org/en-US/docs/Glossary/Kebab_case) 형식으로 입력해요.

```sh
my-granite-app
```

### 1-2. 도구 선택하기

프로젝트 생성 시 코드 품질 도구를 선택할 수 있어요.

* `prettier` + `eslint`: 코드 포맷팅과 린팅을 각각 담당해요. 세밀한 설정과 다양한 플러그인으로 유연한 코드 품질 관리를 지원해요.
* `biome`: Rust 기반의 빠르고 통합적인 포맷팅·린팅 도구예요. 간단한 설정으로 효율적인 작업이 가능해요.

### 1-3. 의존성 설치하기

프로젝트 폴더로 이동한 뒤 의존성을 설치하세요.

::: code-group

```sh [npm]
cd my-granite-app
npm install
```

```sh [pnpm]
cd my-granite-app
pnpm install
```

```sh [yarn]
cd my-granite-app
yarn install
```

:::

***

## 2. 프레임워크 설치하기

앱인토스 SDK를 사용하려면 `@apps-in-toss/framework` 패키지를 설치해야 해요.

::: code-group

```sh [npm]
npm install @apps-in-toss/framework
```

```sh [pnpm]
pnpm add @apps-in-toss/framework
```

```sh [yarn]
yarn add @apps-in-toss/framework
```

:::

***

## 3. 설정 파일 수정하기

`ait init` 명령어로 앱 개발에 필요한 기본 환경을 구성할 수 있어요.

::: code-group

```sh [npm]
npx ait init
```

```sh [pnpm]
pnpm ait init
```

```sh [yarn]
yarn ait init
```

:::

1. 프레임워크를 선택하세요.
2. 앱 이름(`appName`)을 입력하세요. 앱인토스 콘솔에서 등록한 이름과 동일하게 입력해 주세요.

초기화가 완료되면 프로젝트 루트에 `granite.config.ts` 파일이 생성돼요.\
`appName`, `displayName`, `icon`을 앱인토스 콘솔에 등록한 앱 정보와 동일하게 수정해 주세요.

```ts [granite.config.ts]
import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  appName: '<app-name>', // 앱인토스 콘솔에서 등록한 앱 이름으로 바꿔주세요.
  plugins: [
    appsInToss({
      brand: {
        displayName: '앱 이름', // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
        primaryColor: '#3182F6', // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
        icon: null, // 콘솔에서 업로드한 이미지의 URL을 입력하세요.(콘솔의 앱 정보에서 업로드한 이미지를 우클릭해 링크 복사 후 넣어주세요)
      },
      permissions: [],
    }),
  ],
});
```

자세한 설정 방법은 [공통 설정](/bedrock/reference/framework/UI/Config.html) 문서를 확인해 주세요.

***

## 4. TDS 설치하기

**TDS(Toss Design System) React Native** 패키지를 사용하면 토스 디자인 시스템 기반의 컴포넌트를 쉽게 적용할 수 있어요.

::: code-group

```sh [npm]
npm install @toss/tds-react-native
```

```sh [yarn]
yarn add @toss/tds-react-native
```

```sh [pnpm]
pnpm add @toss/tds-react-native
```

:::

TDS 컴포넌트 사용법과 가이드는 [TDS React Native 문서](https://tossmini-docs.toss.im/tds-react-native/)를 확인해 주세요.

::: tip 로컬에서는 TDS를 테스트할 수 없어요
로컬 브라우저에서는 TDS가 동작하지 않아요.\
[샌드박스앱](/development/test/sandbox)을 통해 테스트해 주세요.
:::

***

## 5. 개발 서버 실행하기

::: code-group

```sh [npm]
npm run dev
```

```sh [pnpm]
pnpm dev
```

```sh [yarn]
yarn dev
```

:::

Metro 개발 서버가 실행되면 샌드박스 앱에서 미니앱을 확인할 수 있어요.\
샌드박스 앱에서 테스트하는 자세한 방법은 [샌드박스앱](/development/test/sandbox.html) 문서를 확인해 주세요.

::: tip too many open files 에러가 발생한다면
node\_modules 디렉토리를 삭제한 뒤 다시 의존성을 설치해 보세요.

```sh
rm -rf node_modules
npm install  # 또는 yarn, pnpm에 맞게
```

:::

***

## 6. 미니앱 실행하기

### iOS 시뮬레이터에서 실행하기

1. 샌드박스 앱을 실행해요.
2. 스킴을 입력하고 "스키마 열기" 버튼을 눌러요. 예: `intoss://kingtoss`
3. 화면 상단에 `Bundling {n}%...`가 표시되면 연결이 성공한 거예요.

### iOS 실기기에서 실행하기

아이폰에서 실행하려면 로컬 서버와 같은 와이파이에 연결되어 있어야 해요.

1. 샌드박스 앱을 실행하면 **"로컬 네트워크"** 권한 요청 메시지가 표시돼요. **"허용"** 버튼을 눌러주세요.

2) 서버 주소 입력 화면에서 로컬 서버 IP 주소를 입력하고 저장해요.
   * macOS에서는 `ipconfig getifaddr en0` 명령어로 IP 주소를 확인할 수 있어요.
3) "스키마 열기" 버튼을 눌러요.
4) 화면 상단에 `Bundling {n}%...`가 표시되면 연결이 성공한 거예요.

::: details "로컬 네트워크" 권한을 수동으로 허용하는 방법

1. 아이폰 \[설정] 앱에서 **"앱인토스"** 를 검색해 이동해요.
2. **"로컬 네트워크"** 옵션을 켜주세요.

### Android 실기기 또는 에뮬레이터에서 실행하기

1. Android 실기기를 컴퓨터와 USB로 연결해요.

2. `adb` 명령어로 포트를 연결해요.

   ```sh
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:5173 tcp:5173
   ```

   특정 기기를 연결하려면 `-s` 옵션을 추가해요.

   ```sh
   adb -s {디바이스아이디} reverse tcp:8081 tcp:8081
   adb -s {디바이스아이디} reverse tcp:5173 tcp:5173
   ```

3. 샌드박스 앱에서 스킴을 입력하고 실행 버튼을 눌러요. 예: `intoss://kingtoss`

4. 화면 상단에 번들링 진행 상태가 표시되면 연결이 완료된 거예요.

::: details 자주 쓰는 adb 명령어

```sh
# 연결 끊기
adb kill-server

# 포트 연결하기
adb reverse tcp:8081 tcp:8081
adb reverse tcp:5173 tcp:5173

# 연결 상태 확인하기
adb reverse --list
```

:::

***

## 7. 디버깅하기

### 준비하기

React Native Debugger는 Chrome 브라우저가 필요해요.\
설치되어 있지 않다면 [Chrome 웹브라우저](https://www.google.com/intl/ko_kr/chrome/)를 먼저 다운로드해 주세요.

### Metro 개발 서버로 디버깅하기

개발 서버가 실행된 상태에서 터미널의 `j` 키를 누르면 React Native Debugger가 열려요.\
기기와 Metro 서버가 연결된 상태에서만 열려요.

![Metro 개발 서버를 띄운 화면](/assets/debugging-1.l_S37mue.webp)

![기기와 연결된 상태](/assets/debugging-2.DCHkgbTZ.webp)

디버거는 아래 탭을 제공해요.

![디버거 탭 소개 이미지](/assets/debugging-3.BrqNX-xr.webp)

* **Console**: `console.log` 등으로 기록한 로그를 확인하고, REPL 환경에서 코드를 직접 실행할 수 있어요.
* **Source**: 실행 중인 코드를 보고 중단점을 추가할 수 있어요.
* **Network**: 네트워크 요청과 응답을 확인할 수 있어요.
* **Memory**: Hermes 엔진의 메모리 사용량을 프로파일링할 수 있어요.
* **Profiler**: 코드 실행 성능을 측정할 수 있어요.

#### Breakpoints로 디버깅하기

중단점을 설정하려면 `Cmd` + `P`로 파일 검색 창을 열고 파일을 선택해요.\
원하는 줄을 클릭하면 중단점이 추가돼요. 코드가 해당 지점에 도달하면 실행이 멈추고 현재 상태를 확인할 수 있어요.

![중단점 추가 예시 이미지 1](/assets/debugging-7.CM6Ww2wP.webp)

![중단점 추가 예시 이미지 2](/assets/debugging-8.CBsEKBeq.webp)

소스 코드에 `debugger` 키워드를 추가하면 해당 지점에서 자동으로 코드가 중단돼요.

![debugger 코드 사용 예시 이미지](/assets/debugging-6.0Ua4wvgz.webp)

#### 예외 상황 디버깅하기

**Source 탭** 우측 상단 Breakpoints 섹션에서 아래 옵션을 활성화할 수 있어요.

* **Pause on uncaught exceptions**: 예기치 못한 예외 발생 시 자동으로 코드를 중단해요.
* **Pause on caught exceptions**: 핸들링 여부와 관계없이 모든 예외에서 중단해요.

![예외 상황 디버깅 설정 예시 이미지 1](/assets/debugging-9.D16aemZE.webp)

::: tip 유의하세요
서비스가 완전히 중단된 후에는 예외 Breakpoints가 제대로 동작하지 않는 버그가 있어요.\
개발 서버와 React Native Debugger를 재시작하면 해결할 수 있어요.
:::

### React DevTools로 디버깅하기

React DevTools를 사용하면 컴포넌트 구조를 시각적으로 탐색하고 디버깅할 수 있어요.

서비스가 실행 중이라면 개발 모드 RN 뷰를 `R` 키로 새로고침해 주세요.\
아래와 같은 화면이 나타나면 연결이 완료된 거예요.

![React DevTools 기기와 연결하기 2](/assets/debugging-18.DkJAGa4j.webp)

::: tip Android 기기를 사용한다면
`adb reverse tcp:8097 tcp:8097` 명령어로 포트를 열어야 React DevTools가 정상적으로 동작해요.
:::

#### 요소 인스펙팅

요소 선택 버튼을 누른 뒤 기기에서 확인할 요소를 터치하면 React DevTools에서 해당 요소로 바로 이동해요.

#### Prop 변경하기

선택한 컴포넌트의 Prop을 확인하고 실시간으로 변경할 수 있어요.\
원하는 Prop을 더블 클릭한 뒤 값을 입력하면 바로 반영돼요.

### 트러블슈팅

::: details Metro 개발 서버가 열려 있는데 `잠시 문제가 생겼어요` 메시지가 표시돼요
개발 서버에 제대로 연결되지 않은 문제일 수 있어요. `adb` 연결을 끊고 8081, 5173 포트를 다시 연결해 보세요.
:::

::: details 연결 가능한 기기가 없다고 떠요
React Native View가 나타나는 시점에 개발 서버와 기기가 연결돼요.\
연결 가능한 기기가 없다면 개발 서버가 제대로 빌드되고 있는지 확인해 보세요.

![개발 서버 연결 상태 확인 이미지](/assets/debugging-22.CNlkgu01.webp)
:::

::: details REPL이 동작하지 않아요
React Native 버그로 REPL이 멈추는 현상이 발생할 수 있어요.\
콘솔 탭 옆 눈 모양 아이콘을 클릭하고 입력 필드에 `__DEV__`, `1` 등 임의의 코드를 입력하고 평가해 보세요.

![REPL 프리징 해결 방법 이미지](/resources/learn-more/debugging/debugging-23.webp)
:::

::: details 네트워크 인스펙터가 동작하지 않아요
네트워크 인스펙터는 다중 인스턴스를 지원하지 않아요. 소켓 커넥션이 꼬인 경우 아래 순서로 해결해 보세요.

1. 앱을 완전히 종료해요.
2. 개발 서버를 중단하고 네트워크 인스펙터를 닫아요.
3. 앱을 다시 시작하고 `dev` 스크립트를 실행해요.

이 절차로도 해결되지 않으면 담당자에게 제보해 주세요.
:::

***

## 8. 빌드하기

번들 파일은 `.ait` 확장자를 가진 파일로, 빌드된 프로젝트를 패키징한 결과물이에요.

::: code-group

```sh [npm]
npm run build
```

```sh [pnpm]
pnpm build
```

```sh [yarn]
yarn build
```

:::

빌드가 완료되면 프로젝트 루트에 `<서비스명>.ait` 파일이 생성돼요.\
자세한 테스트 방법은 [토스앱](/development/test/toss.html) 문서를 참고해 주세요.

***

## 9. 출시하기

출시하는 방법은 [미니앱 출시](/development/deploy.html) 문서를 참고하세요.
