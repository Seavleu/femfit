/**
 * Transactional email via Resend — PRD §6.1 / Sys Design notifications.
 * SMS is deferred; email is the launch channel when a recipient exists.
 * Always writes to `notifications` for audit (even when skipped / failed).
 */

import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@femfit.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type Template =
  | "order_confirmed"
  | "order_cancelled"
  | "order_shipped";

interface SendArgs {
  userId: string | null;
  to: string | null | undefined;
  template: Template;
  subject: string;
  html: string;
  payload: Record<string, unknown>;
}

async function logNotification(input: {
  userId: string | null;
  template: Template;
  recipient: string;
  payload: Record<string, unknown>;
  status: "pending" | "sent" | "failed";
  externalId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}) {
  const admin = createServiceRoleClient();
  await admin.from("notifications").insert({
    user_id: input.userId,
    channel: "email",
    template: input.template,
    recipient: input.recipient,
    payload: input.payload,
    status: input.status,
    external_id: input.externalId ?? null,
    error_message: input.errorMessage ?? null,
    sent_at: input.sentAt ?? null,
  });
}

async function sendEmail(args: SendArgs): Promise<void> {
  const recipient = args.to?.trim();
  if (!recipient || !recipient.includes("@")) {
    await logNotification({
      userId: args.userId,
      template: args.template,
      recipient: recipient || "(none)",
      payload: args.payload,
      status: "failed",
      errorMessage: "No email on profile — skipped (SMS deferred)",
    });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await logNotification({
      userId: args.userId,
      template: args.template,
      recipient,
      payload: args.payload,
      status: "failed",
      errorMessage: "RESEND_API_KEY not configured",
    });
    console.warn("[email] RESEND_API_KEY missing — notification logged only");
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: args.subject,
      html: args.html,
    });

    if (error) {
      await logNotification({
        userId: args.userId,
        template: args.template,
        recipient,
        payload: args.payload,
        status: "failed",
        errorMessage: error.message,
      });
      return;
    }

    await logNotification({
      userId: args.userId,
      template: args.template,
      recipient,
      payload: args.payload,
      status: "sent",
      externalId: data?.id ?? null,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error("[email]", message);
    await logNotification({
      userId: args.userId,
      template: args.template,
      recipient,
      payload: args.payload,
      status: "failed",
      errorMessage: message,
    });
  }
}

async function resolveUserEmail(userId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return data?.email ?? null;
}

export async function sendOrderConfirmedEmail(input: {
  userId: string;
  orderId: string;
  orderNumber: string;
  totalDisplay: string;
}): Promise<void> {
  const email = await resolveUserEmail(input.userId);
  await sendEmail({
    userId: input.userId,
    to: email,
    template: "order_confirmed",
    subject: `Order ${input.orderNumber} confirmed — FemFit`,
    html: `
      <p>Thanks for your order.</p>
      <p><strong>${input.orderNumber}</strong> · ${input.totalDisplay}</p>
      <p><a href="${APP_URL}/account/orders/${input.orderId}">View order</a></p>
      <p>We'll update you when it ships. Cash on Delivery: pay the courier on arrival.</p>
    `,
    payload: {
      order_id: input.orderId,
      order_number: input.orderNumber,
      total_display: input.totalDisplay,
    },
  });
}

export async function sendOrderCancelledEmail(input: {
  userId: string;
  orderId: string;
  orderNumber: string;
}): Promise<void> {
  const email = await resolveUserEmail(input.userId);
  await sendEmail({
    userId: input.userId,
    to: email,
    template: "order_cancelled",
    subject: `Order ${input.orderNumber} cancelled — FemFit`,
    html: `
      <p>Your order <strong>${input.orderNumber}</strong> has been cancelled.</p>
      <p><a href="${APP_URL}/account/orders/${input.orderId}">View details</a></p>
    `,
    payload: {
      order_id: input.orderId,
      order_number: input.orderNumber,
    },
  });
}

export async function sendOrderShippedEmail(input: {
  userId: string;
  orderId: string;
  orderNumber: string;
  trackingNumber?: string | null;
}): Promise<void> {
  const email = await resolveUserEmail(input.userId);
  const tracking = input.trackingNumber
    ? `<p>Tracking reference: <strong>${input.trackingNumber}</strong> (manual courier — no live tracking link).</p>`
    : `<p>Our team handed your parcel to a local courier. Status updates appear in your account.</p>`;

  await sendEmail({
    userId: input.userId,
    to: email,
    template: "order_shipped",
    subject: `Order ${input.orderNumber} shipped — FemFit`,
    html: `
      <p>Good news — <strong>${input.orderNumber}</strong> is on the way.</p>
      ${tracking}
      <p><a href="${APP_URL}/account/orders/${input.orderId}">Track in your account</a></p>
    `,
    payload: {
      order_id: input.orderId,
      order_number: input.orderNumber,
      tracking_number: input.trackingNumber ?? null,
    },
  });
}
