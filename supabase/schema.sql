-- 'where-is-it' (어디뒀더라?) Supabase Database Schema
-- 이 스크립트는 여러 번 실행해도 에러가 나지 않도록 안전하게 수정되었습니다.

-- 1. 타임스탬프 자동 갱신 트리거 함수 생성
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- 2. 그룹(보관소) 테이블 생성
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  owner_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 그룹 멤버십 테이블 생성 (다대다 관계)
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member', -- owner / member
  user_name text, -- 멤버의 이름/호칭 (예: "엄마", "첫째")
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (group_id, user_id)
);

-- 4. 가입 신청(Join Requests) 테이블 생성
create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  requester_id uuid not null,
  requester_name text not null, -- 소유자가 식별할 신청자 호칭/이름 (예: "아빠")
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (group_id, requester_id)
);

-- 5. 1단계: 공간 (Spaces)
create table if not exists public.spaces (
    id uuid default gen_random_uuid() primary key,
    user_id uuid default auth.uid() not null,
    group_id uuid references public.groups(id) on delete cascade,
    name text not null,
    icon text default '🏠',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. 2단계: 수납처 (Storages)
create table if not exists public.storages (
    id uuid default gen_random_uuid() primary key,
    space_id uuid references public.spaces(id) on delete cascade not null,
    user_id uuid default auth.uid() not null,
    group_id uuid references public.groups(id) on delete cascade,
    name text not null,
    icon text default '📦',
    image_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. 3단계: 세부위치 (Sections)
create table if not exists public.sections (
    id uuid default gen_random_uuid() primary key,
    storage_id uuid references public.storages(id) on delete cascade not null,
    user_id uuid default auth.uid() not null,
    group_id uuid references public.groups(id) on delete cascade,
    name text not null,
    image_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. 물건 (Items)
create table if not exists public.items (
    id uuid default gen_random_uuid() primary key,
    section_id uuid references public.sections(id) on delete cascade not null,
    user_id uuid default auth.uid() not null,
    group_id uuid references public.groups(id) on delete cascade,
    name text not null,
    description text,
    image_url text,
    quantity integer default 1 not null,
    tags text[] default array[]::text[] not null,
    expiration_date text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 트리거 재등록
drop trigger if exists trigger_update_items_updated_at on public.items;
create trigger trigger_update_items_updated_at
    before update on public.items
    for each row
    execute function update_updated_at_column();

-- =========================================================================
-- 9. Row Level Security (RLS) 설정 및 정책 안전 생성
-- =========================================================================

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.spaces enable row level security;
alter table public.storages enable row level security;
alter table public.sections enable row level security;
alter table public.items enable row level security;

-- 정책 삭제 (중복 및 충돌 방지)
drop policy if exists "groups_read_policy" on public.groups;
drop policy if exists "groups_insert_policy" on public.groups;
drop policy if exists "groups_all_policy" on public.groups;

drop policy if exists "group_members_select" on public.group_members;
drop policy if exists "group_members_insert" on public.group_members;
drop policy if exists "group_members_update" on public.group_members;
drop policy if exists "group_members_delete" on public.group_members;

drop policy if exists "join_requests_select" on public.group_join_requests;
drop policy if exists "join_requests_insert" on public.group_join_requests;
drop policy if exists "join_requests_update" on public.group_join_requests;
drop policy if exists "join_requests_delete" on public.group_join_requests;

drop policy if exists "spaces_group_policy" on public.spaces;
drop policy if exists "storages_group_policy" on public.storages;
drop policy if exists "sections_group_policy" on public.sections;
drop policy if exists "items_group_policy" on public.items;

drop policy if exists "Users can perform all actions on their own spaces" on public.spaces;
drop policy if exists "Users can perform all actions on their own storages" on public.storages;
drop policy if exists "Users can perform all actions on their own sections" on public.sections;
drop policy if exists "Users can perform all actions on their own items" on public.items;

-- [groups 정책]
create policy "groups_read_policy" on public.groups for select using (true);
create policy "groups_insert_policy" on public.groups for insert with check (auth.uid() = owner_id);
create policy "groups_all_policy" on public.groups for all using (auth.uid() = owner_id);

-- [group_members 정책]
create policy "group_members_select" on public.group_members for select using (true);
-- 소유자가 신청자의 가입을 승인하여 멤버십 레코드를 삽입할 수 있도록 정책 확장
create policy "group_members_insert" on public.group_members for insert with check (
  user_id = auth.uid() 
  or group_id in (select id from public.groups where owner_id = auth.uid())
);
create policy "group_members_update" on public.group_members for update using (user_id = auth.uid());
create policy "group_members_delete" on public.group_members for delete using (user_id = auth.uid());

-- [group_join_requests 정책]
create policy "join_requests_select" on public.group_join_requests
  for select using (
    requester_id = auth.uid()
    or group_id in (select id from public.groups where owner_id = auth.uid())
  );
create policy "join_requests_insert" on public.group_join_requests
  for insert with check (requester_id = auth.uid());
create policy "join_requests_update" on public.group_join_requests
  for update using (group_id in (select id from public.groups where owner_id = auth.uid()));
create policy "join_requests_delete" on public.group_join_requests
  for delete using (
    requester_id = auth.uid()
    or group_id in (select id from public.groups where owner_id = auth.uid())
  );

-- [spaces, storages, sections, items 정책 - 그룹 소속 검증 및 레거시 데이터 마이그레이션 허용]
create policy "spaces_group_policy" on public.spaces
  for all using (
    group_id in (select group_id from public.group_members where user_id = auth.uid())
    or (group_id is null and user_id = auth.uid())
  );

create policy "storages_group_policy" on public.storages
  for all using (
    group_id in (select group_id from public.group_members where user_id = auth.uid())
    or (group_id is null and user_id = auth.uid())
  );

create policy "sections_group_policy" on public.sections
  for all using (
    group_id in (select group_id from public.group_members where user_id = auth.uid())
    or (group_id is null and user_id = auth.uid())
  );

create policy "items_group_policy" on public.items
  for all using (
    group_id in (select group_id from public.group_members where user_id = auth.uid())
    or (group_id is null and user_id = auth.uid())
  );

-- =========================================================================
-- 10. 실시간 동기화(Realtime) 활성화
-- =========================================================================
alter publication supabase_realtime add table public.spaces;
alter publication supabase_realtime add table public.storages;
alter publication supabase_realtime add table public.sections;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.group_join_requests;

-- 기존 테이블 스키마에 신규 컬럼이 없을 경우를 대비한 마이그레이션 실행 구문
alter table if exists public.group_members add column if not exists user_name text;
alter table if exists public.items add column if not exists expiration_date text;
