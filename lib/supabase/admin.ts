import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * This client bypasses Row-Level Security entirely. Use only in trusted
 * server-side code paths (server actions, route handlers, scheduled jobs).
 *
 * NEVER:
 *   - Import this in client components
 *   - Use NEXT_PUBLIC_* for the service role key
 *   - Pass the resulting client to client-side code
 *
 * When to use:
 *   - Guest cart operations (anon RLS does not allow access to guest carts)
 *   - Webhook handlers (ABA, courier callbacks)
 *   - Reconciliation jobs (sweeping pending payments across users)
 *   - Order creation transactions (decrement stock + write across tables)
 *
 * When NOT to use:
 *   - Reading data for the logged-in user — use the session-aware client
 *     from lib/supabase/server.ts so RLS still applies
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}