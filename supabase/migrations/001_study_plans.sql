-- Run this in Supabase Dashboard → SQL Editor (paste and Run) to create the table and RLS.
-- Required for "My plan" saving to work.

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan jsonb not null,
  context jsonb,
  created_at timestamptz default now()
);

alter table public.study_plans enable row level security;

-- Users can only see and insert their own rows
create policy "Users can read own study_plans"
  on public.study_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own study_plans"
  on public.study_plans for insert
  with check (auth.uid() = user_id);

-- Optional: allow update/delete of own rows
create policy "Users can update own study_plans"
  on public.study_plans for update
  using (auth.uid() = user_id);

create policy "Users can delete own study_plans"
  on public.study_plans for delete
  using (auth.uid() = user_id);
