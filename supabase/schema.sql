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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (group_id, user_id)
);

-- 4. 1단계: 공간 (Spaces)
create table if not exists public.spaces (
    id uuid default gen_random_uuid() primary key,
    user_id uuid default auth.uid() not null,
    group_id uuid references public.groups(id) on delete cascade,
    name text not null,
    icon text default '🏠',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. 2단계: 수납처 (Storages)
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

-- 6. 3단계: 세부위치 (Sections)
create table if not exists public.sections (
    id uuid default gen_random_uuid() primary key,
    storage_id uuid references public.storages(id) on delete cascade not null,
    user_id uuid default auth.uid() not null,
    group_id uuid references public.groups(id) on delete cascade,
    name text not null,
    image_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. 물건 (Items)
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
-- 8. Row Level Security (RLS) 설정 및 정책 안전 생성
-- =========================================================================

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
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
drop policy if exists "group_members_delete" on public.group_members;
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

-- [group_members 정책 - 재귀 무한 루프 방지를 위해 단순화]
create policy "group_members_select" on public.group_members for select using (user_id = auth.uid());
create policy "group_members_insert" on public.group_members for insert with check (user_id = auth.uid());
create policy "group_members_delete" on public.group_members for delete using (user_id = auth.uid());

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
-- 9. 실시간 동기화(Realtime) 활성화
-- =========================================================================
alter publication supabase_realtime add table public.spaces;
alter publication supabase_realtime add table public.storages;
alter publication supabase_realtime add table public.sections;
alter publication supabase_realtime add table public.items;
