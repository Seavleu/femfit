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
    <div className="min-h-screen bg-femfit-warm">
      <div className="container py-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          {/* Success header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-medium tracking-tight md:text-3xl">
              Order Confirmed
            </h1>
            <p className="text-sm text-femfit-mid">
              Thank you for your order. We&rsquo;ll start preparing it right
              away.
            </p>
          </div>

          {/* Order details card */}
          <div className="rounded-lg border border-femfit-border bg-white p-6">
            <div className="mb-6 flex items-center justify-between border-b border-femfit-border pb-4">
              <div>
                <p className="text-xs text-femfit-mid">Order number</p>
                <p className="text-lg font-medium">{order.orderNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-femfit-mid">Status</p>
                <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="mb-6 space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-femfit-mid">
                Items ordered
              </h2>
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-xs text-femfit-mid">
                      SKU: {item.sku} × {item.quantity}
                    </p>
                  </div>
                  <span>{item.lineTotalDisplay}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <dl className="mb-6 space-y-2 border-t border-femfit-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-femfit-mid">Subtotal</dt>
                <dd>{order.subtotalDisplay}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-femfit-mid">Shipping</dt>
                <dd>{order.shippingDisplay}</dd>
              </div>
              <div className="flex justify-between border-t border-femfit-border pt-2">
                <dt className="font-medium">Total</dt>
                <dd className="text-base font-medium">
                  {order.totalDisplay}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-femfit-mid">Payment</dt>
                <dd className="text-xs font-medium uppercase">
                  {order.paymentMethod === "cod"
                    ? "Cash on Delivery"
                    : "ABA PayWay"}
                </dd>
              </div>
            </dl>

            {/* Shipping address */}
            <div className="mb-6 border-t border-femfit-border pt-4">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-widest text-femfit-mid">
                Shipping to
              </h2>
              <p className="text-sm font-medium">
                {order.shippingAddress.fullName}
              </p>
              <p className="text-sm text-femfit-mid">
                {order.shippingAddress.phone}
              </p>
              <p className="text-sm text-femfit-mid">
                {order.shippingAddress.street}
              </p>
              <p className="text-sm text-femfit-mid">
                {order.shippingAddress.district},{" "}
                {order.shippingAddress.province}
              </p>
            </div>

            {/* COD reminder */}
            {order.paymentMethod === "cod" && (
              <div className="rounded-md bg-femfit-gray/50 px-4 py-3 text-sm">
                <p className="font-medium">Cash on Delivery</p>
                <p className="mt-1 text-xs text-femfit-mid">
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
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/products"
              className="rounded-md bg-femfit-charcoal px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Continue shopping
            </Link>
            <Link
              href="/"
              className="rounded-md border border-femfit-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-femfit-gray"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}