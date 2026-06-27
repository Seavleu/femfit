/**
 * ABA PayWay API client.
 *
 * Per Sys Design §8.1: "Hosted checkout — redirect customer to ABA's
 * payment page. ABA handles card data; we never touch PAN."
 *
 * This module wraps ABA's merchant API. All monetary amounts are in
 * USD cents internally; ABA expects dollars as a decimal string.
 *
 * Environment variables required:
 *   ABA_MERCHANT_ID     — from ABA merchant portal
 *   ABA_API_KEY         — API key for server-to-server calls
 *   ABA_API_URL         — sandbox or production URL
 *   ABA_RETURN_URL      — our post-payment redirect (e.g. https://femfit.com/checkout/success)
 *   ABA_WEBHOOK_SECRET  — HMAC-SHA512 shared secret for webhook verification
 */

const ABA_MERCHANT_ID = process.env.ABA_MERCHANT_ID ?? "";
const ABA_API_KEY = process.env.ABA_API_KEY ?? "";
const ABA_API_URL =
  process.env.ABA_API_URL ?? "https://checkout-sandbox.payway.com.kh/api";
const ABA_RETURN_URL =
  process.env.ABA_RETURN_URL ?? "http://localhost:3000/checkout/complete";

export interface AbaCheckoutRequest {
  /** Our internal order ID (used as tran_id on ABA's side) */
  orderId: string;
  /** Order number for display (e.g. FF-2026-123456) */
  orderNumber: string;
  /** Total in USD cents */
  totalCents: number;
  /** Customer email or phone for ABA receipt */
  customerContact: string;
}

export interface AbaCheckoutResponse {
  /** URL to redirect the customer to */
  redirectUrl: string;
  /** ABA's transaction reference */
  transactionId: string;
}

/**
 * Create a hosted checkout session with ABA PayWay.
 *
 * Per Sys Design §8.1: we send the order details to ABA and receive
 * a redirect URL. The customer completes payment on ABA's page.
 * ABA then sends a webhook to our endpoint.
 */
export async function createAbaCheckout(
  req: AbaCheckoutRequest
): Promise<AbaCheckoutResponse> {
  if (!ABA_MERCHANT_ID || !ABA_API_KEY) {
    throw new AbaError(
      "ABA PayWay credentials not configured. Set ABA_MERCHANT_ID and ABA_API_KEY in .env.local."
    );
  }

  // ABA expects amount as a decimal string (e.g. "24.99")
  const amountStr = (req.totalCents / 100).toFixed(2);

  const payload = {
    merchant_id: ABA_MERCHANT_ID,
    tran_id: req.orderId,
    amount: amountStr,
    firstname: "",
    lastname: "",
    phone: req.customerContact,
    email: "",
    items: req.orderNumber,
    return_url: ABA_RETURN_URL,
    continue_success_url: `${ABA_RETURN_URL}?order=${req.orderId}&status=success`,
    return_deeplink: "",
    currency: "USD",
    type: "purchase",
    payment_option: "abapay_khqr cards",
  };

  const response = await fetch(`${ABA_API_URL}/payment-gateway/api/payment/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ABA_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[ABA] checkout creation failed", {
      status: response.status,
      body: text,
    });
    throw new AbaError(`ABA checkout creation failed: ${response.status}`);
  }

  const data = await response.json();

  // ABA returns a checkout URL and transaction reference
  // Exact field names depend on ABA's API version — adjust when
  // integrating with the real API
  return {
    redirectUrl: data.checkout_url ?? data.redirect_url ?? "",
    transactionId: data.tran_id ?? req.orderId,
  };
}

/**
 * Query ABA for the current status of a transaction.
 *
 * Per Sys Design §9.3: used by the reconciliation job to catch
 * payments where the webhook was lost.
 */
export async function queryAbaTransactionStatus(
  transactionId: string
): Promise<{
  status: "approved" | "declined" | "pending" | "error";
  gatewayRef: string | null;
  rawResponse: Record<string, unknown>;
}> {
  if (!ABA_MERCHANT_ID || !ABA_API_KEY) {
    throw new AbaError("ABA credentials not configured.");
  }

  const response = await fetch(
    `${ABA_API_URL}/payment-gateway/api/payment/check-transaction`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ABA_API_KEY}`,
      },
      body: JSON.stringify({
        merchant_id: ABA_MERCHANT_ID,
        tran_id: transactionId,
      }),
    }
  );

  if (!response.ok) {
    throw new AbaError(`ABA status query failed: ${response.status}`);
  }

  const data = await response.json();

  // Map ABA status codes to our internal states
  const statusMap: Record<string, "approved" | "declined" | "pending" | "error"> = {
    "0": "approved",
    "1": "pending",
    "2": "declined",
    "3": "error",
  };

  return {
    status: statusMap[data.status?.toString()] ?? "error",
    gatewayRef: data.apv ?? null,
    rawResponse: data,
  };
}

export class AbaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AbaError";
  }
}