-- =====================================================================
-- FemFit — Migration 0003: Rate limit counters
-- =====================================================================
-- Per Sys Design §9.1: OTP 3/hr/phone, login 5/min/IP, orders 10/hr/user.
-- Fixed-window counters stored in Postgres. Apply via Supabase SQL Editor.
-- =====================================================================

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null default 1,
  updated_at   timestamptz not null default now()
);

-- Cleanup index for the sweep job
create index if not exists idx_rate_limits_window
  on public.rate_limits(window_start);

-- RLS: no client access at all — service_role only
alter table public.rate_limits enable row level security;

-- Atomic increment-and-return. Returns the new count for the key.
create or replace function public.increment_rate_limit(
  p_key text,
  p_window_start timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key)
  do update set count = rate_limits.count + 1, updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

grant execute on function public.increment_rate_limit(text, timestamptz) to service_role;

-- Cleanup: delete windows older than 24h (call from the reconcile cron
-- or a separate scheduled job)
create or replace function public.cleanup_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  delete from rate_limits where window_start < now() - interval '24 hours';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

grant execute on function public.cleanup_rate_limits() to service_role;

-- =====================================================================
-- END
-- =====================================================================