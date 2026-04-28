-- ============================================================
-- Dayflow — run this entire file in Supabase SQL Editor
-- ============================================================

-- 1. journal_entries
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null,
  content     text not null default '',
  mood        smallint not null default 3 check (mood between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, entry_date)
);

alter table public.journal_entries enable row level security;

create policy "Users manage own journal entries"
  on public.journal_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. habits
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#8B5CF6',
  is_archived boolean not null default false,
  sort_order  integer not null default 0,
  start_date  date not null default current_date,
  end_date    date,
  created_at  timestamptz not null default now()
);

alter table public.habits enable row level security;

create policy "Users manage own habits"
  on public.habits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. habit_logs
create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  log_date    date not null,
  completed   boolean not null default false,
  unique (habit_id, log_date)
);

alter table public.habit_logs enable row level security;

create policy "Users manage own habit logs"
  on public.habit_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. todos
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  notes       text,
  due_date    date,
  is_done     boolean not null default false,
  priority    text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at  timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "Users manage own todos"
  on public.todos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. goals
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  target_date date,
  status      text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at  timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Users manage own goals"
  on public.goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for common queries
create index if not exists idx_journal_entries_user_date on public.journal_entries (user_id, entry_date);
create index if not exists idx_habit_logs_user_date      on public.habit_logs (user_id, log_date);
create index if not exists idx_todos_user_due            on public.todos (user_id, due_date);
create index if not exists idx_habits_user               on public.habits (user_id, is_archived, sort_order);
create index if not exists idx_goals_user_status         on public.goals (user_id, status);
