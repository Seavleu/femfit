/**
 * ABA webhook signature verification.
 *
 * Per Sys Design §9.1:
 *   "Read raw body BEFORE parsing JSON. Verify HMAC signature with
 *    crypto.timingSafeEqual (constant time). Verify timestamp is within
 *    5 minutes (replay protection). Return 401 BEFORE any DB write on
 *    signature failure."
 *
 * The signature is computed as HMAC-SHA512 of the raw request body
 * using the shared secret (ABA_WEBHOOK_SECRET).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_SECRET = process.env.ABA_WEBHOOK_SECRET ?? "";
const MAX_AGE_SECONDS = 300; // 5 minutes — replay protection

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify the HMAC-SHA512 signature on an ABA webhook request.
 *
 * @param rawBody     The raw request body as a Buffer or string
 * @param signature   The signature from the request header (e.g. X-ABA-Signature)
 * @param timestamp   Optional timestamp header for replay protection
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  timestamp?: string
): VerificationResult {
  if (!WEBHOOK_SECRET) {
    console.error(
      "[webhook] ABA_WEBHOOK_SECRET not configured — rejecting all webhooks"
    );
    return { valid: false, reason: "webhook_secret_not_configured" };
  }

  if (!signature) {
    return { valid: false, reason: "missing_signature" };
  }

  // 1. Replay protection — reject if timestamp is stale
  if (timestamp) {
    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(ts) || Math.abs(now - ts) > MAX_AGE_SECONDS) {
      return { valid: false, reason: "timestamp_expired" };
    }
  }

  // 2. Compute expected HMAC-SHA512
  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
  const expected = createHmac("sha512", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  // 3. Constant-time comparison — prevents timing attacks
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: "signature_length_mismatch" };
  }

  const match = timingSafeEqual(sigBuffer, expectedBuffer);

  if (!match) {
    return { valid: false, reason: "signature_mismatch" };
  }

  return { valid: true };
}

/**
 * Generate a test signature for development.
 * Only use this in tests — never in production code paths.
 */
export function generateTestSignature(body: string, secret?: string): string {
  return createHmac("sha512", secret ?? WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
}