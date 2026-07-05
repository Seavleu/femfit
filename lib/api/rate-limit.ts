/**
 * Rate Limiting - Per Sys Design p.9.1
 * - OTP requests: 3h per phone
 * - Login attempts: 5mins per IP
 * - Order creation: 10h per user
 * 
 * Implementation: fixed-window counter in Postgres is simpler and sufficient vs adding Redis
 * if scale demands it later, swap the backing store - interface stays the same
 * 
 * Table (created in 0003_ratelimit_tables.sql):
 *  rate_limits(key text, window_start timestamptz, count int)
 * */ 

import { createServiceRoleClient } from "@/lib/supabase/admin";

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  otpPerPhone: { limit: 3, windowSeconds: 3600 },      // 3/hr per phone
  loginPerIp: { limit: 5, windowSeconds: 60 },          // 5/min per IP
  ordersPerUser: { limit: 10, windowSeconds: 3600 },    // 10/hr per user
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  scope: string,
  key: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const admin = createServiceRoleClient();
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000
  );
  const resetAt = new Date(windowStart.getTime() + rule.windowSeconds * 1000);
  const compositeKey = `${scope}:${key}:${windowStart.toISOString()}`;

  // Upsert the counter atomically via RPC (0003_rate_limits.sql)
  const { data, error } = await admin.rpc("increment_rate_limit", {
    p_key: compositeKey,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    // Fail open on infra errors, but log loudly — per Runbook §5 philosophy:
    // availability first for launch, but alert so we notice
    console.error("[rate-limit] counter error, failing open", error);
    return { allowed: true, remaining: 0, resetAt };
  }

  const count = (data as number) ?? 1;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
  };
}