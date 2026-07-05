/**
 * Health check endpoint — per Sys Design §9.3.
 * Route: GET /api/health
 *
 * Used by uptime monitoring (e.g. BetterStack/UptimeRobot per Runbook §6).
 * Checks: database reachability. Returns 200 with component status,
 * or 503 if a critical dependency is down.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // Database check — lightweight single-row query
  try {
    const t0 = Date.now();
    const admin = createServiceRoleClient();
    const { error } = await admin.from("categories").select("id").limit(1);
    checks.database = error
      ? { ok: false, error: error.message }
      : { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    checks.database = { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }

  const healthy = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - startedAt,
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}