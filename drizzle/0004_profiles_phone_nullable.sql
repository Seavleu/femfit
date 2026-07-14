-- =====================================================================
-- FemFit — Migration 0004: Allow nullable profiles.phone
-- =====================================================================
-- Google OAuth users authenticate with email and may not have a phone
-- until checkout. UNIQUE is preserved (Postgres allows multiple NULLs).
-- Apply via Supabase SQL Editor or `pnpm db:migrate`.
-- =====================================================================

alter table public.profiles
  alter column phone drop not null;
