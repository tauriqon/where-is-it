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

-- 2. 1단계: 공간 (Spaces)
create table if not exists public.spaces (
    id uuid default gen_random_uuid() primary key,
    user_id uuid default auth.uid() not null,
    name text not null,
    icon text default '🏠',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 2단계: 수납처 (Storages)
create table if not exists public.storages (
    id uuid default gen_random_uuid() primary key,
    space_id uuid references public.spaces(id) on delete cascade not null,
    user_id uuid default auth.uid() not null,
    name text not null,
    icon text default '📦',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. 3단계: 세부위치 (Sections)
create table if not exists public.sections (
    id uuid default gen_random_uuid() primary key,
    storage_id uuid references public.storages(id) on delete cascade not null,
    user_id uuid default auth.uid() not null,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. 물건 (Items)
create table if not exists public.items (
    id uuid default gen_random_uuid() primary key,
    section_id uuid references public.sections(id) on delete cascade not null,
    user_id uuid default auth.uid() not null,
    name text not null,
    description text,
    image_url text,
    quantity integer default 1 not null,
    tags text[] default array[]::text[] not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 트리거 재등록을 위해 기존 트리거가 있으면 삭제 후 생성
drop trigger if exists trigger_update_items_updated_at on public.items;
create trigger trigger_update_items_updated_at
    before update on public.items
    for each row
    execute function update_updated_at_column();

-- =========================================================================
-- 6. Row Level Security (RLS) 설정 및 정책 안전 생성
-- =========================================================================

alter table public.spaces enable row level security;
alter table public.storages enable row level security;
alter table public.sections enable row level security;
alter table public.items enable row level security;

-- Spaces RLS 정책
drop policy if exists "Users can perform all actions on their own spaces" on public.spaces;
create policy "Users can perform all actions on their own spaces"
on public.spaces for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Storages RLS 정책
drop policy if exists "Users can perform all actions on their own storages" on public.storages;
create policy "Users can perform all actions on their own storages"
on public.storages for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Sections RLS 정책
drop policy if exists "Users can perform all actions on their own sections" on public.sections;
create policy "Users can perform all actions on their own sections"
on public.sections for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Items RLS 정책
drop policy if exists "Users can perform all actions on their own items" on public.items;
create policy "Users can perform all actions on their own items"
on public.items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
