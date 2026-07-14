/**
 * Lightweight Sentry init — Sys Design §9.2.
 * No-ops when SENTRY_DSN is unset (local/dev).
 */

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      environment: process.env.NODE_ENV,
    });
  } catch (err) {
    console.warn("[sentry] init skipped", err);
  }
}

export async function captureException(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.error("[error]", error, context);
    return;
  }
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, { extra: context });
  } catch {
    console.error("[error]", error, context);
  }
}
