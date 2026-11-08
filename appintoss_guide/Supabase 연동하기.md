---
url: 'https://developers-apps-in-toss.toss.im/supabase/intro.md'
description: 앱인토스(미니앱) WebView 환경에서 Supabase를 연동하는 방법을 안내해요.
---

# Supabase 연동하기

앱인토스(미니앱) WebView 환경에서 Supabase를 연동하는 방법을 안내해요.\
Supabase JS 클라이언트는 프레임워크에 무관하게 동작해요. 코드 예제는 **Vite(React + TypeScript)** 기준으로 작성되었어요.

***

## 개요

Supabase는 인증, 데이터베이스(PostgreSQL), 파일 저장, 실시간 구독 등을 제공하는 오픈소스 백엔드 서비스예요.\
앱인토스 WebView 환경에서도 동일하게 사용할 수 있지만, **보안 설정과 환경 변수 관리**가 중요해요.

***

## 1. 준비하기

* Supabase 계정 ([supabase.com](https://supabase.com))
* Vite(React + TypeScript)로 만든 프로젝트
* Node.js, npm (또는 yarn, pnpm)

## 2. Supabase 프로젝트 만들기

1. Supabase 대시보드에서 **New project**를 눌러 새 프로젝트를 만들어요.
2. 프로젝트 이름, 데이터베이스 비밀번호, 리전을 설정하고 생성을 완료해요.
3. 프로젝트가 준비되면 대시보드에서 아래 정보를 확인할 수 있어요.

```text
Project URL     : https://<project-id>.supabase.co
Publishable key : sb_publishable_xxxxxxxxxxxx
```

## 3. 환경 변수 설정하기

Supabase 연결 정보는 보안을 위해 환경 변수로 관리하는 걸 권장해요.\
프로젝트 루트에 `.env` 파일을 만들고 아래처럼 작성하세요.

```bash
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
```

## 4. Supabase 설치 및 초기화

`src/supabase/client.ts` 파일을 만들고 아래처럼 Supabase 클라이언트를 초기화해요.

```bash
npm install @supabase/supabase-js
```

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
```

::: tip 참고
Publishable key는 Stripe의 `pk_live_...`, Firebase의 `apiKey`처럼 클라이언트에 노출해도 괜찮은 공개 키예요.
단, **RLS(Row Level Security) 정책을 반드시 설정해야** 해요. RLS 없이는 publishable key만 있으면 누구나 테이블 전체를 읽고 쓸 수 있어요.

`secret` 키는 RLS를 전부 우회하는 비밀 키예요. 서버에서만 사용하고 절대 클라이언트에 노출하지 마세요.
:::

## 5. 데이터베이스 사용 예제

Supabase 클라이언트를 초기화했다면, React 컴포넌트 안에서 데이터를 읽거나 쓸 수 있어요.\
아래는 `App.tsx`에서 단일 행을 읽고 저장하는 가장 간단한 예시예요.

Supabase 대시보드의 **Table Editor**에서 `users` 테이블을 만들고, `id`(int8, primary key)와 `name`(text) 컬럼을 추가해요.

```tsx
import { useState, useEffect } from 'react';
import { supabase } from './supabase/client';

function App() {
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');

  // Supabase에서 데이터 읽기
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('users').select('name').eq('id', 1).single();
      if (data) {
        setSavedName(data.name);
      }
    };
    fetchData();
  }, []);

  // Supabase에 데이터 쓰기
  const handleSave = async () => {
    await supabase.from('users').upsert({ id: 1, name });
    setSavedName(name);
    setName('');
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Supabase 간단 예제</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 입력" />
      <button onClick={handleSave}>저장</button>
      <p>저장된 이름: {savedName || '(없음)'}</p>
    </div>
  );
}

export default App;
```

### 동작 방식

* 데이터 읽기 (`.select()`)
  * `users` 테이블에서 `id`가 1인 행을 한 번만 불러와요.
  * 행이 존재하면 `name` 값을 화면에 표시해요.

* 데이터 쓰기 (`.upsert()`)
  * 입력한 이름을 `users` 테이블에 저장해요.
  * 행이 없으면 새로 생성하고, 있으면 덮어써요.

::: tip Supabase 추가 기능

* 실시간 구독: `.channel()`, `.on()`을 사용하면 데이터 변경 시 UI가 자동으로 갱신돼요.
* 파일 저장: `supabase.storage`로 이미지나 파일을 업로드할 수 있어요.
* 인증 연동: `supabase.auth`와 함께 사용하면 사용자별 데이터 저장이 가능해요.
  :::

## 6. 보안 체크리스트

* 민감한 정보 환경 변수로 관리하기
  * Supabase URL, publishable key 등은 코드에 직접 작성하지 않고 `.env`로 관리하세요.
* 환경 파일을 Git 등에 업로드하지 않기
  * `.env` 파일은 `.gitignore`에 반드시 추가하세요.
  * 키가 노출되면 Supabase 대시보드에서 즉시 키를 재발급하세요.
* **Row Level Security(RLS) 반드시 설정하기**
  * Supabase의 모든 테이블은 기본적으로 RLS가 비활성화되어 있어요.
  * RLS가 꺼진 상태에서는 publishable key만 있으면 누구나 테이블 전체에 접근할 수 있어요.
  * 배포 전에 반드시 RLS를 활성화하고, 인증된 사용자만 접근하도록 정책(Policy)을 설정하세요.
  * Supabase 대시보드 **Table Editor → 테이블 선택 → RLS** 탭에서 설정할 수 있어요.
* 출처(Origin) 제한 확인하기
  * Supabase 대시보드의 **Authentication → URL Configuration**에서 허용 도메인을 제한해두세요.
  * 미니앱(WebView) 도메인만 허용하면 무단 접근을 예방할 수 있어요.

::: tip 허용 대상 도메인
`https://<appName>.apps.tossmini.com` — 실제 서비스 환경\
`https://<appName>.private-apps.tossmini.com` — 콘솔 QR 테스트 환경
:::
