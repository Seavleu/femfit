import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatMoney } from "@/lib/catalog/money";

export const metadata: Metadata = { title: "My Orders" };
export const dynamic = "force-dynamic";

/**
 * Order history — per PRD §3.4:
 * "Customers can view their order history with current status."
 * RLS also enforces user_id = auth.uid() as defense in depth.
 */
export default async function AccountOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/account/orders");

  const userOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      paymentMethod: orders.paymentMethod,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt));

  const statusLabels: Record<string, string> = {
    pending_payment: "Awaiting Payment",
    confirmed: "Confirmed",
    packing: "Being Packed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-6 md:px-6 md:pt-8">
      <nav className="mb-4 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
        <Link href="/account" className="transition-colors hover:text-foreground">
          Account
        </Link>
        <span>/</span>
        <span className="text-foreground">Orders</span>
      </nav>
      <h1 className="title-serif mb-8">My Orders</h1>

      {userOrders.length === 0 ? (
        <div className="module flex flex-col items-center px-6 py-16 text-center">
          <p className="mb-1 font-medium">No orders yet</p>
          <p className="mb-6 text-sm text-muted-foreground">
            When you place an order, it will appear here
          </p>
          <Link href="/products" className="btn-solid">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3 lg:max-w-3xl">
          {userOrders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="module flex items-center justify-between p-4 transition-colors hover:border-foreground/20 md:p-5"
            >
              <div>
                <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                <p className="font-mono text-2xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {" · "}
                  {order.paymentMethod === "cod" ? "Cash on Delivery" : "ABA PayWay"}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-lg border border-border bg-muted px-2.5 py-0.5 font-mono text-2xs uppercase tracking-[0.1em] text-foreground">
                  {statusLabels[order.status] ?? order.status}
                </span>
                <p className="mt-1 font-mono text-sm font-medium">
                  {formatMoney(order.totalCents, order.currency).display}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
