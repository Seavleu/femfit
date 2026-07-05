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

  const statusLabels: Record<string, { label: string; className: string }> = {
    pending_payment: { label: "Awaiting Payment", className: "bg-yellow-100 text-yellow-800" },
    confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800" },
    packing: { label: "Being Packed", className: "bg-purple-100 text-purple-800" },
    shipped: { label: "Shipped", className: "bg-indigo-100 text-indigo-800" },
    delivered: { label: "Delivered", className: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600" },
    refunded: { label: "Refunded", className: "bg-red-100 text-red-800" },
  };

  return (
    <div className="min-h-screen bg-femfit-warm">
      <div className="border-b border-femfit-border">
        <div className="container py-8 md:py-12">
          <nav className="mb-3 flex items-center gap-2 text-xs text-femfit-mid">
            <Link href="/account" className="hover:text-foreground">Account</Link>
            <span>/</span>
            <span className="text-foreground">Orders</span>
          </nav>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">My Orders</h1>
        </div>
      </div>

      <div className="container py-8">
        {userOrders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="mb-1 font-medium">No orders yet</p>
            <p className="mb-6 text-sm text-femfit-mid">When you place an order, it will appear here</p>
            <Link href="/products" className="rounded-md bg-femfit-charcoal px-6 py-3 text-sm font-medium text-white hover:opacity-90">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3 lg:max-w-3xl">
            {userOrders.map((order) => {
              const status = statusLabels[order.status] ?? { label: order.status, className: "bg-gray-100" };
              return (
                <div key={order.id}
                  className="flex items-center justify-between rounded-lg border border-femfit-border bg-white p-4">
                  <div>
                    <p className="text-sm font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-femfit-mid">
                      {new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      {" · "}
                      {order.paymentMethod === "cod" ? "Cash on Delivery" : "ABA PayWay"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-2xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                    <p className="mt-1 text-sm font-medium">
                      {formatMoney(order.totalCents, order.currency).display}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}