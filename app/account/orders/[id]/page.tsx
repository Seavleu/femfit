import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrderById } from "@/lib/orders/queries";
import { CancelOrderButton } from "@/components/features/CancelOrderButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id.slice(0, 8)}…` };
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  confirmed: "Confirmed",
  packing: "Being Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  returned: "Returned",
};

const TIMELINE = [
  "pending_payment",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
] as const;

export default async function AccountOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?redirect=/account/orders/${id}`);

  const order = await getOrderById(id, user.id);
  if (!order) notFound();

  const statusIndex = TIMELINE.indexOf(
    order.status as (typeof TIMELINE)[number]
  );
  const isTerminal = ["cancelled", "refunded", "returned"].includes(order.status);

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
      <nav className="mb-4 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
        <Link href="/account" className="hover:text-foreground">
          Account
        </Link>
        <span>/</span>
        <Link href="/account/orders" className="hover:text-foreground">
          Orders
        </Link>
        <span>/</span>
        <span className="text-foreground">{order.orderNumber}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-mono mb-2">Order</p>
          <h1 className="title-serif">{order.orderNumber}</h1>
          <p className="mt-2 font-mono text-2xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {" · "}
            {order.paymentMethod === "cod" ? "Cash on Delivery" : "ABA PayWay"}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-lg border border-border bg-muted px-3 py-1 font-mono text-2xs uppercase tracking-[0.1em]">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {!isTerminal && (
            <section className="module p-5 md:p-6">
              <p className="label-mono mb-4">Status</p>
              <ol className="space-y-3">
                {TIMELINE.map((step, i) => {
                  const done =
                    statusIndex >= 0
                      ? i <= statusIndex
                      : false;
                  const current = step === order.status;
                  return (
                    <li
                      key={step}
                      className={`flex items-center gap-3 font-mono text-2xs uppercase tracking-[0.1em] ${
                        done ? "text-foreground" : "text-muted-foreground/50"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${
                          current
                            ? "border-foreground bg-foreground text-background"
                            : done
                              ? "border-foreground"
                              : "border-border"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {STATUS_LABELS[step]}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-xs text-muted-foreground">
                Delivery updates are set by our team when the courier collects
                or delivers your parcel (no live courier tracking in Cambodia).
              </p>
            </section>
          )}

          <section className="module p-5 md:p-6">
            <p className="label-mono mb-4">Items</p>
            <ul className="space-y-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {item.slug ? (
                      <Link
                        href={`/products/${item.slug}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{item.productName}</p>
                    )}
                    <p className="font-mono text-2xs text-muted-foreground">
                      {item.sku} · Qty {item.quantity}
                    </p>
                    <p className="mt-1 font-mono text-sm">{item.lineTotalDisplay}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="module p-5 md:p-6">
            <p className="label-mono mb-4">Delivery address</p>
            <p className="text-sm font-medium">{order.shippingAddress.fullName}</p>
            <p className="font-mono text-sm text-muted-foreground">
              {order.shippingAddress.phone}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {[
                order.shippingAddress.street,
                order.shippingAddress.commune,
                order.shippingAddress.district,
                order.shippingAddress.province,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            {order.shippingAddress.notes && (
              <p className="mt-2 text-sm text-muted-foreground">
                Note: {order.shippingAddress.notes}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="module space-y-3 p-5">
            <p className="label-mono">Summary</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{order.subtotalDisplay}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-mono">{order.shippingDisplay}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-sm font-medium">
              <span>Total</span>
              <span className="font-mono">{order.totalDisplay}</span>
            </div>
          </div>

          <CancelOrderButton orderId={order.id} status={order.status} />

          <Link href="/account/orders" className="btn-ghost flex justify-center">
            ← All orders
          </Link>
          <Link href="/help" className="btn-ghost flex justify-center">
            Need help?
          </Link>
        </aside>
      </div>
    </div>
  );
}
