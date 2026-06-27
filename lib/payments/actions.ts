"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createAbaCheckout, AbaError } from "@/lib/payments/aba";
import { PROBLEMS, type ProblemDetail } from "@/lib/api/errors";

/**
 * Payment session creation.
 *
 * Per Sys Design §8.1: After an order is created with
 * payment_method='aba_payway' and status='pending_payment',
 * we create a payment row and initiate an ABA checkout session.
 *
 * Flow:
 *   1. Verify the order exists and belongs to the user
 *   2. Verify the order is in 'pending_payment' status
 *   3. Create a payment row (status='pending')
 *   4. Call ABA's API to get a checkout redirect URL
 *   5. Update the payment row with gateway_txn_id
 *   6. Return the redirect URL to the client
 */

export type PaymentResult =
  | { ok: true; data: { redirectUrl: string; paymentId: string } }
  | { ok: false; error: ProblemDetail };

export async function initiatePayment(
  orderId: string
): Promise<PaymentResult> {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: PROBLEMS.unauthorized() };
  }

  const admin = createServiceRoleClient();

  // 2. Verify order
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, order_number, status, payment_method, total_cents, currency, user_id, shipping_phone")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return { ok: false, error: PROBLEMS.notFound("Order not found.") };
  }
  if (order.user_id !== user.id) {
    return { ok: false, error: PROBLEMS.forbidden("Not your order.") };
  }
  if (order.status !== "pending_payment") {
    return {
      ok: false,
      error: PROBLEMS.conflict(
        `Order is already ${order.status}. Cannot create a payment session.`
      ),
    };
  }
  if (order.payment_method !== "aba_payway") {
    return {
      ok: false,
      error: PROBLEMS.conflict("This order uses Cash on Delivery."),
    };
  }

  // 3. Check for existing pending payment (prevent duplicate sessions)
  const { data: existingPayment } = await admin
    .from("payments")
    .select("id, status, gateway_txn_id")
    .eq("order_id", orderId)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  let paymentId: string;

  if (existingPayment) {
    paymentId = existingPayment.id;
  } else {
    // Create new payment row
    const { data: newPayment, error: payErr } = await admin
      .from("payments")
      .insert({
        order_id: orderId,
        method: "aba_payway",
        amount_cents: order.total_cents,
        currency: order.currency,
        status: "pending",
      })
      .select("id")
      .single();

    if (payErr || !newPayment) {
      console.error("[initiatePayment] failed to create payment row", payErr);
      return {
        ok: false,
        error: PROBLEMS.serverError("Could not create payment."),
      };
    }
    paymentId = newPayment.id;
  }

  // 4. Call ABA to create checkout session
  try {
    const abaResult = await createAbaCheckout({
      orderId,
      orderNumber: order.order_number,
      totalCents: order.total_cents,
      customerContact: order.shipping_phone ?? "",
    });

    // 5. Update payment with gateway reference
    await admin
      .from("payments")
      .update({
        gateway_txn_id: abaResult.transactionId,
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    // Log the event — append-only per DB Schema §6.10
    await admin.from("payment_events").insert({
      payment_id: paymentId,
      event_type: "checkout_created",
      payload: {
        redirect_url: abaResult.redirectUrl,
        transaction_id: abaResult.transactionId,
      },
    });

    return {
      ok: true,
      data: {
        redirectUrl: abaResult.redirectUrl,
        paymentId,
      },
    };
  } catch (err) {
    const message =
      err instanceof AbaError ? err.message : "Payment gateway unavailable.";
    console.error("[initiatePayment] ABA error", err);

    // Log the failure event
    await admin.from("payment_events").insert({
      payment_id: paymentId,
      event_type: "checkout_failed",
      payload: {
        error: message,
      },
    });

    return {
      ok: false,
      error: PROBLEMS.serverError(message),
    };
  }
}