import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Payment Processing",
  description: "Your payment is being processed.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ order?: string; status?: string }>;
}

/**
 * ABA redirects the customer back here after payment.
 *
 * Per Sys Design §8.3: the return URL includes the order ID and
 * a status hint. However, we NEVER trust the status from the URL —
 * the webhook is the source of truth. This page simply shows a
 * "processing" state and polls/refreshes until the webhook has
 * updated the order status.
 *
 * For COD orders, this page is not used — they go to /checkout/success.
 */
export default async function CheckoutCompletePage({ searchParams }: Props) {
  const { order: orderId, status: statusHint } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !orderId) {
    redirect("/");
  }

  // Check current order status from our DB (not from URL params)
  const admin = createServiceRoleClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, status, total_cents, currency")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    redirect("/");
  }

  // If the webhook has already processed, redirect to success/failure
  if (order.status === "confirmed") {
    redirect(`/checkout/success?order=${orderId}`);
  }
  if (order.status === "cancelled") {
    return <PaymentFailed orderNumber={order.order_number} />;
  }

  // Still pending — show processing state
  return <PaymentProcessing orderNumber={order.order_number} />;
}

function PaymentProcessing({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="min-h-screen bg-femfit-warm">
      <div className="container flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-femfit-gray">
          <svg
            className="h-8 w-8 animate-spin text-femfit-mid"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-medium">Processing your payment</h1>
        <p className="mb-2 text-sm text-femfit-mid">
          Order {orderNumber}
        </p>
        <p className="mb-8 text-sm text-femfit-mid">
          This usually takes a few seconds. Please don&rsquo;t close this page.
        </p>
        <p className="text-xs text-femfit-mid">
          If this takes more than a minute, your payment may still be processing.
          Check your order status in{" "}
          <Link href="/account/orders" className="underline">
            My Orders
          </Link>
          .
        </p>
        {/* Auto-refresh after 5 seconds to check if webhook has landed */}
        <meta httpEquiv="refresh" content="5" />
      </div>
    </div>
  );
}

function PaymentFailed({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="min-h-screen bg-femfit-warm">
      <div className="container flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-femfit/10">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C4847A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-medium">Payment unsuccessful</h1>
        <p className="mb-2 text-sm text-femfit-mid">
          Order {orderNumber}
        </p>
        <p className="mb-8 text-sm text-femfit-mid">
          Your payment could not be processed. No charges were made.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/cart"
            className="rounded-md bg-femfit-charcoal px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Return to cart
          </Link>
          <Link
            href="/"
            className="rounded-md border border-femfit-border px-6 py-3 text-sm font-medium transition-colors hover:bg-femfit-gray"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}