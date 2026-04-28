-- Migration: Add frequency columns to habits
-- Run this in Supabase SQL Editor

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS frequency  TEXT    NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS week_days  TEXT[],   -- e.g. {'monday','wednesday','friday'}
  ADD COLUMN IF NOT EXISTS month_days TEXT[];   -- e.g. {'5','15','last'}

-- All existing habits default to 'daily' (every day) — no change in behavior
-- New habits can be set to 'weekly' or 'monthly' with specific days
