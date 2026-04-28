-- Migration: Add start_date and end_date to habits
-- Run this in Supabase SQL Editor

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date   date;

-- Backfill start_date from created_at for existing habits
UPDATE public.habits
  SET start_date = date(created_at)
  WHERE start_date IS NULL;

-- Make start_date required going forward
ALTER TABLE public.habits
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN start_date SET DEFAULT current_date;
