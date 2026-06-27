-- =====================================================================
-- FemFit — Migration 0002: Stock helper + auto-cancel job support
-- =====================================================================
-- Per Sys Design §8.4 and Runbook §5.4:
--   - Stock reversal on failed payment / order cancellation
--   - Auto-cancel orders stuck in pending_payment > 15 minutes
--
-- Apply via Supabase SQL Editor.
-- =====================================================================

-- Helper function to safely increment stock.
-- Used by the webhook handler and reconciliation job when a payment
-- fails and stock needs to be returned.
create or replace function public.increment_stock(
  p_variant_id uuid,
  p_qty integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update product_variants
  set stock_quantity = stock_quantity + p_qty,
      updated_at = now()
  where id = p_variant_id;
end;
$$;

grant execute on function public.increment_stock(uuid, integer) to service_role;

comment on function public.increment_stock is
  'Safely increment stock_quantity on a variant. Used by webhook handlers and reconciliation when returning stock for failed/cancelled orders.';

-- =====================================================================
-- END
-- =====================================================================