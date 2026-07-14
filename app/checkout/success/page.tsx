import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrderById } from "@/lib/orders/queries";

export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "Your FemFit order has been placed.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ order?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { order: orderId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !orderId) {
    redirect("/");
  }

  const order = await getOrderById(orderId, user.id);
  if (!order) {
    redirect("/");
  }

  const statusLabels: Record<string, string> = {
    confirmed: "Confirmed",
    pending_payment: "Awaiting Payment",
    packing: "Being Packed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
      <div className="mx-auto max-w-2xl">
        {/* Success header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="title-serif mb-2">Order Confirmed</h1>
          <p className="text-sm text-muted-foreground">
            Thank you for your order. We&rsquo;ll start preparing it right
            away.
          </p>
        </div>

        {/* Order details card */}
        <div className="module p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="label-mono mb-1">Order number</p>
              <p className="font-mono text-lg">{order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="label-mono mb-1">Status</p>
              <span className="inline-block rounded-lg border border-border bg-muted px-3 py-1 font-mono text-2xs uppercase tracking-[0.1em] text-foreground">
                {statusLabels[order.status] ?? order.status}
              </span>
            </div>
          </div>

          {/* Items */}
          <div className="mb-6 space-y-3">
            <h2 className="label-mono">Items ordered</h2>
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="font-mono text-2xs text-muted-foreground">
                    SKU: {item.sku} × {item.quantity}
                  </p>
                </div>
                <span className="font-mono text-sm">{item.lineTotalDisplay}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <dl className="mb-6 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-mono">{order.subtotalDisplay}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-mono">{order.shippingDisplay}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-medium">Total</dt>
              <dd className="font-mono text-base font-medium">
                {order.totalDisplay}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment</dt>
              <dd className="font-mono text-2xs uppercase tracking-[0.1em]">
                {order.paymentMethod === "cod"
                  ? "Cash on Delivery"
                  : "ABA PayWay"}
              </dd>
            </div>
          </dl>

          {/* Shipping address */}
          <div className="mb-6 border-t border-border pt-4">
            <h2 className="label-mono mb-2">Shipping to</h2>
            <p className="text-sm font-medium">
              {order.shippingAddress.fullName}
            </p>
            <p className="text-sm text-muted-foreground">
              {order.shippingAddress.phone}
            </p>
            <p className="text-sm text-muted-foreground">
              {order.shippingAddress.street}
            </p>
            <p className="text-sm text-muted-foreground">
              {order.shippingAddress.district},{" "}
              {order.shippingAddress.province}
            </p>
          </div>

          {/* COD reminder */}
          {order.paymentMethod === "cod" && (
            <div className="module-muted px-4 py-3 text-sm">
              <p className="font-medium">Cash on Delivery</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Please have{" "}
                <span className="font-medium text-foreground">
                  {order.totalDisplay}
                </span>{" "}
                ready when the courier arrives. We&rsquo;ll send you a
                tracking update once your order ships.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/products" className="btn-solid">
            Continue shopping
          </Link>
          <Link href="/" className="btn-ghost">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
