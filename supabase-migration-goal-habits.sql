-- Migration: Goal → Habit linking
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.goal_habits (
  id       uuid primary key default gen_random_uuid(),
  goal_id  uuid not null references public.goals(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  unique (goal_id, habit_id)
);

ALTER TABLE public.goal_habits enable row level security;

CREATE POLICY "Users manage own goal habits"
  ON public.goal_habits FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.goals WHERE id = goal_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.goals WHERE id = goal_id AND user_id = auth.uid())
  );
