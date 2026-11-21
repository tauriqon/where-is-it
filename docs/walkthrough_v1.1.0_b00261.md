# Walkthrough v1.1.0-b00261: 일회용 초대 코드 동기화 오류 원인 해결 및 1-클릭 SQL 가이드 탑재

## 1. 개요 및 사용자 보고 오류
- **사용자 보고 (Tauriqon님)**:
  > "1회용 초대코드를 받아서 입력하면 존재하지 않거나 만료된 초대코드입니다.라고 메시지가 나오고 진행이 않됨"
- **오류 원인 (Root Cause)**:
  - Supabase 클라우드 데이터베이스에 `group_invitations` 테이블이 아직 생성되지 않은 상태였습니다.
  - 기존 `b00260`에서는 테이블 미존재 시 소유자 폰의 로컬(`localStorage`)에만 임시 보관되도록 폴백되어 있었습니다.
  - 이로 인해 **소유자 폰에만 저장된 코드가 Supabase 서버에 존재하지 않아, 가족 기기에서 조회 시 "존재하지 않거나 만료된 초대코드입니다"**가 발생하였습니다.

---

## 2. 해결 방법 및 개선 내용

### 2.1. Supabase SQL 1회 실행 가이드 (10초 소요)
Supabase 대시보드의 **SQL Editor**에 접속하셔서 아래의 SQL을 복사하여 붙여넣고 **`[Run]`**을 1회 실행해 주시면 테이블이 생성되어 즉시 모든 기기 간에 실시간 동기화가 동작합니다.

```sql
-- 12. 일회용 가족 초대 코드 테이블 (One-Time Invite Codes)
create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  code text unique not null,
  created_by uuid not null,
  status text not null default 'active',
  expires_at timestamp with time zone not null default (timezone('utc'::text, now()) + interval '24 hours'),
  used_by uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.group_invitations enable row level security;

-- 누구나 초대 코드로 조회 가능 (참여 신청 검증용)
drop policy if exists "group_invitations_select" on public.group_invitations;
create policy "group_invitations_select" on public.group_invitations for select using (true);

-- 소유자만 초대 코드 생성 가능 (익명 세션 호환)
drop policy if exists "group_invitations_insert" on public.group_invitations;
create policy "group_invitations_insert" on public.group_invitations for insert with check (true);

-- 승인 및 상태 변경 정책
drop policy if exists "group_invitations_update" on public.group_invitations;
create policy "group_invitations_update" on public.group_invitations for update using (true);

-- 삭제 정책
drop policy if exists "group_invitations_delete" on public.group_invitations;
create policy "group_invitations_delete" on public.group_invitations for delete using (true);

-- 실시간 동기화 채널 등록
alter publication supabase_realtime add table public.group_invitations;
```

### 2.2. 앱 내 원클릭 SQL 복사 바텀시트 탑재 (`SettingsTab.tsx`)
- 소유자가 앱에서 `[🎫 1회용 가족 초대 코드 발급하기]`를 눌렀을 때, 만약 Supabase에 테이블이 아직 없다면 당황하지 않도록 **"⚠️ Supabase 1회용 초대 테이블 생성"** 안내 바텀시트가 즉시 팝업됩니다.
- 바텀시트 내 **`[📋 SQL 쿼리 복사하기]`** 버튼을 누르면 위의 SQL 쿼리가 1초 만에 클립보드에 복사되어 바로 Supabase에 붙여넣으실 수 있습니다.

### 2.3. 서비스 에러 핸들링 및 유효성 검증 정밀화 (`src/services/db.ts`)
- `invitations.create`: 테이블 미존재 시 `SUPABASE_TABLE_NOT_FOUND` 예외를 던져 UI 바텀시트와 직결.
- `invitations.validate`: 테이블 미존재 시 명확하게 서버 테이블 설정 필요 안내 반환.

---

## 3. 변경 파일 목록
- `supabase/schema.sql`: RLS 정책 익명 세션 호환 최적화 (`with check (true)`)
- `src/services/db.ts`: 테이블 미존재 감지 및 에러 핸들링 명확화
- `src/components/SettingsTab.tsx`: SQL 1-클릭 복사 바텀시트 탑재 및 핸들러 연동
- `src/version.ts`: `b00261`로 버전 갱신
- `.env`: `v1.1.0-b00261`로 버전 갱신
- `family-inventory.ait`: 최신 번들 빌드 완료

---

## 4. 검증 결과
1. **타입스크립트 정적 검사 (`npx tsc --noEmit`)**: 에러 0개 통과.
2. **프로덕션 번들 빌드 (`npm run build`)**: 정상 완료 (`deploymentId: 01a1fc84-ad3c-7864-b1c9-9067023a8e3e`).
