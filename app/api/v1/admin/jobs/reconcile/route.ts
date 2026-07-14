/**
 * Payment Reconciliation Job.
 * Route: POST /api/v1/admin/jobs/reconcile
 *
 * Per Sys Design §9.3:
 *   "5-minute sweep of pending payments. Query ABA's status API for
 *    each. Update our records if ABA confirms success or failure."
 *
 * Per Runbook §6.4:
 *   "This is a critical background job. Verify it runs every 5 minutes."
 *
 * Triggered by:
 *   - Vercel Cron every 5 minutes (see vercel.json crons entry for this path)
 *   - Manual trigger from admin panel
 *
 * Security:
 *   - Vercel Cron sends a secret in the Authorization header
 *   - Admin panel sends the user's JWT (checked for is_admin)
 *   - All DB operations use service_role
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { queryAbaTransactionStatus } from "@/lib/payments/aba";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const STALE_THRESHOLD_MINUTES = 10;

export async function POST(request: NextRequest) {
  return reconcile(request);
}

/** Vercel Cron invokes GET */
export async function GET(request: NextRequest) {
  return reconcile(request);
}

async function reconcile(request: NextRequest) {
  // ── Auth: Vercel Cron secret or admin JWT ────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const cronOk =
    (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) ||
    (!CRON_SECRET && process.env.NODE_ENV !== "production");

  if (cronOk) {
    // authorized
  } else {
    // Check for admin user
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

  // ── Find stale payments ──────────────────────────────────────────
  const admin = createServiceRoleClient();
  const cutoff = new Date(
    Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000
  ).toISOString();

  const { data: stalePayments, error } = await admin
    .from("payments")
    .select("id, order_id, gateway_txn_id, status, amount_cents, currency")
    .in("status", ["pending", "processing"])
    .lt("created_at", cutoff)
    .not("gateway_txn_id", "is", null);

  if (error) {
    console.error("[reconcile] failed to query stale payments", error);
    return NextResponse.json(
      { error: "Failed to query payments" },
      { status: 500 }
    );
  }

  if (!stalePayments || stalePayments.length === 0) {
    return NextResponse.json({
      reconciled: 0,
      message: "No stale payments found",
    });
  }

  // ── Process each stale payment ───────────────────────────────────
  const results: Array<{
    paymentId: string;
    orderId: string;
    action: string;
  }> = [];

  for (const payment of stalePayments) {
    try {
      const abaStatus = await queryAbaTransactionStatus(
        payment.gateway_txn_id!
      );

      // Log the reconciliation check
      await admin.from("payment_events").insert({
        payment_id: payment.id,
        event_type: "reconciliation_check",
        payload: abaStatus.rawResponse,
      });

      if (abaStatus.status === "approved") {
        // ABA confirms payment succeeded — update our records
        await admin
          .from("payments")
          .update({
            status: "succeeded",
            paid_at: new Date().toISOString(),
            raw_response: abaStatus.rawResponse,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        await admin
          .from("orders")
          .update({
            status: "confirmed",
            admin_note: "Auto-confirmed via reconciliation job",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.order_id)
          .eq("status", "pending_payment");

        await admin.from("payment_events").insert({
          payment_id: payment.id,
          event_type: "reconciliation_confirmed",
          payload: { aba_status: "approved", gateway_ref: abaStatus.gatewayRef },
        });

        results.push({
          paymentId: payment.id,
          orderId: payment.order_id,
          action: "confirmed",
        });
      } else if (
        abaStatus.status === "declined" ||
        abaStatus.status === "error"
      ) {
        // ABA confirms payment failed — cancel and return stock
        await admin
          .from("payments")
          .update({
            status: "failed",
            raw_response: abaStatus.rawResponse,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        // Return stock for the order items
        const { data: items } = await admin
          .from("order_items")
          .select("variant_id, quantity")
          .eq("order_id", payment.order_id);

        if (items) {
          for (const item of items) {
            // Increment stock via RPC (0002_stock_helpers.sql)
            await admin.rpc("increment_stock", {
              p_variant_id: item.variant_id,
              p_qty: item.quantity,
            });

            // Append-only audit log
            await admin.from("inventory_movements").insert({
              variant_id: item.variant_id,
              change_qty: item.quantity,
              reason: "reconciliation_reversal",
              reference_id: payment.order_id,
              reference_type: "order",
              note: "Stock returned — payment failed (reconciliation)",
            });
          }
        }

        await admin
          .from("orders")
          .update({
            status: "cancelled",
            admin_note: "Auto-cancelled via reconciliation — payment failed at ABA",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.order_id)
          .eq("status", "pending_payment");

        results.push({
          paymentId: payment.id,
          orderId: payment.order_id,
          action: "cancelled",
        });
      } else {
        // Still pending at ABA — leave for next sweep
        results.push({
          paymentId: payment.id,
          orderId: payment.order_id,
          action: "still_pending",
        });
      }
    } catch (err) {
      console.error(
        `[reconcile] failed to check payment ${payment.id}`,
        err
      );
      results.push({
        paymentId: payment.id,
        orderId: payment.order_id,
        action: "error",
      });
    }
  }

  return NextResponse.json({
    reconciled: results.length,
    results,
  });
}