/**
 * Release abandoned payment reservations.
 * Route: POST /api/v1/admin/jobs/release-reservations
 *
 * Sys Design §9.3 / PRD §3.3:
 *   Orders stuck in pending_payment > 15 minutes are cancelled and stock returned.
 *
 * Auth: CRON_SECRET Bearer or admin JWT (same pattern as reconcile).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const TIMEOUT_MINUTES = 15;

export async function POST(request: NextRequest) {
  return releaseReservations(request);
}

/** Vercel Cron invokes GET */
export async function GET(request: NextRequest) {
  return releaseReservations(request);
}

async function releaseReservations(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";

  // Vercel Cron may send CRON_SECRET; allow unauthenticated only when secret unset (local)
  const cronOk =
    (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) ||
    (!CRON_SECRET && process.env.NODE_ENV !== "production");

  if (cronOk) {
    // authorized
  } else {
    const admin = createServiceRoleClient();
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await admin.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const admin = createServiceRoleClient();
  const cutoff = new Date(
    Date.now() - TIMEOUT_MINUTES * 60 * 1000
  ).toISOString();

  const { data: staleOrders, error } = await admin
    .from("orders")
    .select("id, order_number, user_id")
    .eq("status", "pending_payment")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[release-reservations] query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!staleOrders?.length) {
    return NextResponse.json({ released: 0, message: "No stale reservations" });
  }

  const results: Array<{ orderId: string; action: string }> = [];

  for (const order of staleOrders) {
    try {
      const { data: items } = await admin
        .from("order_items")
        .select("variant_id, quantity")
        .eq("order_id", order.id);

      if (items) {
        for (const item of items) {
          if (!item.variant_id) continue;
          await admin.rpc("increment_stock", {
            p_variant_id: item.variant_id,
            p_qty: item.quantity,
          });
          await admin.from("inventory_movements").insert({
            variant_id: item.variant_id,
            change_qty: item.quantity,
            reason: "reservation_release",
            reference_id: order.id,
            reference_type: "order",
            note: `Order ${order.order_number} auto-cancelled — payment abandoned >${TIMEOUT_MINUTES}m`,
          });
        }
      }

      const { data: updated } = await admin
        .from("orders")
        .update({
          status: "cancelled",
          admin_note: `Auto-cancelled — pending_payment exceeded ${TIMEOUT_MINUTES} minutes`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending_payment")
        .select("id")
        .maybeSingle();

      results.push({
        orderId: order.id,
        action: updated ? "cancelled" : "skipped",
      });
    } catch (err) {
      console.error(`[release-reservations] ${order.id}`, err);
      results.push({ orderId: order.id, action: "error" });
    }
  }

  return NextResponse.json({
    released: results.filter((r) => r.action === "cancelled").length,
    results,
  });
}
