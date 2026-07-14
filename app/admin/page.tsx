import Link from "next/link";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/catalog/money";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const admin = createServiceRoleClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: todayOrders } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  const { data: revenueRows } = await admin
    .from("orders")
    .select("total_cents")
    .gte("created_at", todayStart.toISOString())
    .in("status", ["confirmed", "packing", "shipped", "delivered"]);
  const todayRevenue = (revenueRows ?? []).reduce(
    (sum, r) => sum + (r.total_cents ?? 0), 0
  );

  const { count: pendingPayment } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_payment");

  const { count: confirmedOrders } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "confirmed");

  const { count: pendingReviews } = await admin
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("is_approved", false)
    .is("deleted_at", null);

  const { data: lowStock } = await admin
    .from("product_variants")
    .select("id, sku, size, color, stock_quantity, products!inner(name)")
    .eq("is_active", true)
    .lte("stock_quantity", 5)
    .order("stock_quantity", { ascending: true })
    .limit(10);

  const { data: recentOrders } = await admin
    .from("orders")
    .select("id, order_number, status, total_cents, currency, payment_method, created_at, shipping_full_name")
    .order("created_at", { ascending: false })
    .limit(8);

  const stats = [
    { label: "Today's Orders", value: todayOrders ?? 0, href: "/admin/orders" },
    { label: "Today's Revenue", value: formatMoney(todayRevenue, "USD").display, href: "/admin/orders" },
    { label: "Awaiting Payment", value: pendingPayment ?? 0, href: "/admin/orders?status=pending_payment", alert: (pendingPayment ?? 0) > 0 },
    { label: "To Pack", value: confirmedOrders ?? 0, href: "/admin/orders?status=confirmed", alert: (confirmedOrders ?? 0) > 0 },
    { label: "Reviews to Moderate", value: pendingReviews ?? 0, href: "/admin/reviews", alert: (pendingReviews ?? 0) > 0 },
    { label: "Low Stock Items", value: (lowStock ?? []).length, href: "/admin/inventory", alert: (lowStock ?? []).length > 0 },
  ];

  const statusColors: Record<string, string> = {
    pending_payment: "bg-muted text-muted-foreground",
    confirmed: "bg-foreground text-background",
    packing: "bg-muted text-foreground",
    shipped: "bg-muted text-foreground",
    delivered: "bg-muted text-foreground",
    cancelled: "bg-muted text-muted-foreground",
    refunded: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="label-mono mb-2">Overview</p>
        <h1 className="title-serif">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`module p-4 transition-opacity hover:opacity-90 ${stat.alert ? "ring-1 ring-rose/30" : ""}`}
          >
            <p className="label-mono">{stat.label}</p>
            <p className={`mt-2 font-serif text-2xl ${stat.alert ? "text-rose" : ""}`}>
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="module overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-serif text-lg">Recent Orders</h2>
            <Link href="/admin/orders" className="label-mono normal-case tracking-[0.12em] hover:text-foreground">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {(recentOrders ?? []).map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">{order.shipping_full_name}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-xl px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] ${statusColors[order.status] ?? "bg-muted text-muted-foreground"}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMoney(order.total_cents, order.currency).display}
                  </p>
                </div>
              </Link>
            ))}
            {(!recentOrders || recentOrders.length === 0) && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No orders yet</p>
            )}
          </div>
        </div>

        <div className="module overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-serif text-lg">Low Stock Alerts</h2>
            <Link href="/admin/inventory" className="label-mono normal-case tracking-[0.12em] hover:text-foreground">
              Manage →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {(lowStock ?? []).map((v: Record<string, unknown>) => {
              const product = v.products as { name: string } | null;
              return (
                <div key={v.id as string} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{product?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.sku} · {[v.size, v.color].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                  <span className={`font-mono text-xs tabular-nums ${(v.stock_quantity as number) === 0 ? "text-destructive" : "text-rose"}`}>
                    {v.stock_quantity as number} left
                  </span>
                </div>
              );
            })}
            {(!lowStock || lowStock.length === 0) && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">All stock levels healthy</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
