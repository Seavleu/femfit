import Link from "next/link";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/catalog/money";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Admin dashboard — operational snapshot.
 * Per PRD §3.0 supporting requirements: at-a-glance view of
 * today's orders, revenue, pending actions, and low-stock alerts.
 */
export default async function AdminDashboardPage() {
  const admin = createServiceRoleClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Today's orders
  const { count: todayOrders } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  // Today's revenue (confirmed+ orders)
  const { data: revenueRows } = await admin
    .from("orders")
    .select("total_cents")
    .gte("created_at", todayStart.toISOString())
    .in("status", ["confirmed", "packing", "shipped", "delivered"]);
  const todayRevenue = (revenueRows ?? []).reduce(
    (sum, r) => sum + (r.total_cents ?? 0), 0
  );

  // Pending actions
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

  // Low stock alerts (variants with stock <= 5 and active)
  const { data: lowStock } = await admin
    .from("product_variants")
    .select("id, sku, size, color, stock_quantity, products!inner(name)")
    .eq("is_active", true)
    .lte("stock_quantity", 5)
    .order("stock_quantity", { ascending: true })
    .limit(10);

  // Recent orders
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
    pending_payment: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    packing: "bg-purple-100 text-purple-800",
    shipped: "bg-indigo-100 text-indigo-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-600",
    refunded: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}
            className={`rounded-lg border bg-white p-4 transition-shadow hover:shadow-sm ${stat.alert ? "border-rose-200" : "border-gray-200"}`}>
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`mt-1 text-xl font-semibold ${stat.alert ? "text-rose-600" : ""}`}>
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent orders */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-medium">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs text-gray-500 hover:text-gray-900">View all →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {(recentOrders ?? []).map((order) => (
              <Link key={order.id} href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50">
                <div>
                  <p className="font-medium">{order.order_number}</p>
                  <p className="text-xs text-gray-500">{order.shipping_full_name}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-2xs font-medium ${statusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatMoney(order.total_cents, order.currency).display}
                  </p>
                </div>
              </Link>
            ))}
            {(!recentOrders || recentOrders.length === 0) && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No orders yet</p>
            )}
          </div>
        </div>

        {/* Low stock */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-medium">Low Stock Alerts</h2>
            <Link href="/admin/inventory" className="text-xs text-gray-500 hover:text-gray-900">Manage →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {(lowStock ?? []).map((v: Record<string, unknown>) => {
              const product = v.products as { name: string } | null;
              return (
                <div key={v.id as string} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{product?.name ?? "Unknown"}</p>
                    <p className="text-xs text-gray-500">
                      {v.sku} · {[v.size, v.color].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                  <span className={`font-medium tabular-nums ${(v.stock_quantity as number) === 0 ? "text-red-600" : "text-amber-600"}`}>
                    {v.stock_quantity as number} left
                  </span>
                </div>
              );
            })}
            {(!lowStock || lowStock.length === 0) && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">All stock levels healthy</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}