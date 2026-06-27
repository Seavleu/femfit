/**
 * ABA PayWay Webhook Handler
 * Route: POST /api/v1/webhooks/aba
 *
 * Per Sys Design §9.1 — strict security order:
 *   1. Read raw body BEFORE parsing JSON
 *   2. Verify HMAC-SHA512 with timingSafeEqual
 *   3. Return 401 BEFORE any DB write on failure
 *   4. Log full payload to payment_events (append-only)
 *   5. Idempotent on gateway_txn_id
 *
 * Per Sys Design §8.3 — webhook processing:
 *   - Update payment status (pending/processing → succeeded/failed)
 *   - Transition order status (pending_payment → confirmed)
 *   - All DB writes use service_role (bypasses RLS)
 *
 * NEVER:
 *   - Parse JSON before verifying signature
 *   - Write to DB before verifying signature
 *   - Trust any data in the payload without verification
 */

import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/verify";
import { createServiceRoleClient } from "@/lib/supabase/admin";

// Signature header name — adjust based on ABA's actual header name
const SIGNATURE_HEADER = "x-aba-signature";
const TIMESTAMP_HEADER = "x-aba-timestamp";

export async function POST(request: Request) {
  // ── 1. Read raw body ─────────────────────────────────────────────
  // Must read BEFORE any JSON parsing per Sys Design §9.1
  const rawBody = await request.text();

  // ── 2. Verify HMAC signature ─────────────────────────────────────
  const signature = request.headers.get(SIGNATURE_HEADER) ?? "";
  const timestamp = request.headers.get(TIMESTAMP_HEADER) ?? undefined;

  const verification = verifyWebhookSignature(rawBody, signature, timestamp);

  if (!verification.valid) {
    console.warn("[webhook/aba] signature verification failed", {
      reason: verification.reason,
      ip: request.headers.get("x-forwarded-for"),
    });
    // ── 3. Return 401 BEFORE any DB write ──────────────────────────
    return NextResponse.json(
      {
        type: "https://femfit.com/problems/webhook-unauthorized",
        title: "Invalid signature",
        status: 401,
      },
      {
        status: 401,
        headers: { "Content-Type": "application/problem+json" },
      }
    );
  }

  // ── 4. Parse the verified payload ────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { type: "https://femfit.com/problems/invalid-payload", title: "Invalid JSON", status: 400 },
      { status: 400 }
    );
  }

  // Extract ABA fields (adjust field names to match ABA's actual API)
  const transactionId = (payload.tran_id ?? payload.transaction_id ?? "") as string;
  const abaStatus = (payload.status ?? "") as string;
  const approvalCode = (payload.apv ?? payload.approval_code ?? "") as string;

  if (!transactionId) {
    return NextResponse.json(
      { type: "https://femfit.com/problems/missing-transaction-id", title: "Missing tran_id", status: 400 },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();

  try {
    // ── 5. Find the payment by gateway_txn_id ────────────────────────
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .select("id, order_id, status, amount_cents, currency")
      .eq("gateway_txn_id", transactionId)
      .maybeSingle();

    if (payErr || !payment) {
      // Log unmatched webhook for investigation
      console.warn("[webhook/aba] no matching payment for tran_id", {
        transactionId,
      });
      // Return 200 to prevent ABA from retrying (we'll investigate manually)
      return NextResponse.json({ received: true, matched: false });
    }

    // ── 6. Idempotency — skip if already processed ─────────────────
    if (payment.status === "succeeded" || payment.status === "failed") {
      // Already processed — log the duplicate event but don't re-process
      await admin.from("payment_events").insert({
        payment_id: payment.id,
        event_type: "webhook_duplicate",
        payload,
      });
      return NextResponse.json({ received: true, duplicate: true });
    }

    // ── 7. Map ABA status to our payment status ────────────────────
    // ABA status codes: 0=approved, 1=pending, 2=declined, 3=error
    const statusMap: Record<string, string> = {
      "0": "succeeded",
      approved: "succeeded",
      "2": "failed",
      declined: "failed",
      "3": "failed",
      error: "failed",
    };
    const newPaymentStatus = statusMap[abaStatus] ?? "failed";

    // ── 8. Log the webhook event (append-only) ─────────────────────
    await admin.from("payment_events").insert({
      payment_id: payment.id,
      event_type: `webhook_${newPaymentStatus}`,
      payload,
    });

    // ── 9. Update payment status ───────────────────────────────────
    await admin
      .from("payments")
      .update({
        status: newPaymentStatus,
        raw_response: payload,
        ...(newPaymentStatus === "succeeded"
          ? { paid_at: new Date().toISOString() }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // ── 10. Transition order status ────────────────────────────────
    if (newPaymentStatus === "succeeded") {
      // pending_payment → confirmed (per Sys Design §8.4 state machine)
      await admin
        .from("orders")
        .update({
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.order_id)
        .eq("status", "pending_payment"); // Guard: only transition from pending_payment
    } else if (newPaymentStatus === "failed") {
      // Payment failed — return stock and cancel order
      await handlePaymentFailure(admin, payment.order_id);
    }

    return NextResponse.json({ received: true, status: newPaymentStatus });
  } catch (err) {
    console.error("[webhook/aba] processing error", err);
    // Return 500 so ABA retries
    return NextResponse.json(
      { type: "https://femfit.com/problems/webhook-processing-error", title: "Processing failed", status: 500 },
      { status: 500 }
    );
  }
}

/**
 * Handle payment failure — cancel order and return stock.
 *
 * Per Sys Design §8.4: failed payment transitions order from
 * pending_payment → cancelled and reverses the stock decrement.
 */
async function handlePaymentFailure(
  admin: ReturnType<typeof createServiceRoleClient>,
  orderId: string
) {
  // Get order items to know which variants to restock
  const { data: items } = await admin
    .from("order_items")
    .select("variant_id, quantity")
    .eq("order_id", orderId);

  if (items && items.length > 0) {
    for (const item of items) {
      // Return stock via RPC (0002_stock_helpers.sql)
      await admin.rpc("increment_stock", {
        p_variant_id: item.variant_id,
        p_qty: item.quantity,
      });

      // Log the inventory reversal — append-only per DB Schema §6.9
      await admin.from("inventory_movements").insert({
        variant_id: item.variant_id,
        change_qty: item.quantity,
        reason: "payment_failed",
        reference_id: orderId,
        reference_type: "order",
        note: "Payment failed — stock returned",
      });
    }
  }

  // Cancel the order
  await admin
    .from("orders")
    .update({
      status: "cancelled",
      admin_note: "Auto-cancelled: payment failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending_payment");
}