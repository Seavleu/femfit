import Link from "next/link";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/catalog/money";

export const metadata: Metadata = { title: "Orders" };

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

/**
 * Order list — per PRD §3.0 supporting requirements.
 * Filterable by status, paginated, shows key order details.
 */
export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const admin = createServiceRoleClient();
  const pageSize = 20;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * pageSize;

  let query = admin
    .from("orders")
    .select("id, order_number, status, total_cents, currency, payment_method, created_at, shipping_full_name, shipping_phone, shipping_province", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data: orders, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  const statuses = [
    { value: "", label: "All" },
    { value: "pending_payment", label: "Pending Payment" },
    { value: "confirmed", label: "Confirmed" },
    { value: "packing", label: "Packing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "refunded", label: "Refunded" },
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="text-sm text-gray-500">{count ?? 0} total</p>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => {
          const active = (params.status ?? "") === s.value;
          const href = s.value ? `/admin/orders?status=${s.value}` : "/admin/orders";
          return (
            <Link key={s.value} href={href}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}>
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(orders ?? []).map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium text-blue-600 hover:underline">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p>{order.shipping_full_name}</p>
                  <p className="text-xs text-gray-400">{order.shipping_province}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-2xs font-medium ${statusColors[order.status] ?? "bg-gray-100"}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs uppercase text-gray-500">
                  {order.payment_method === "cod" ? "COD" : "ABA"}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatMoney(order.total_cents, order.currency).display}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/admin/orders?${params.status ? `status=${params.status}&` : ""}page=${page - 1}`}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-100">← Previous</Link>
          )}
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/admin/orders?${params.status ? `status=${params.status}&` : ""}page=${page + 1}`}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-100">Next →</Link>
          )}
        </div>
      )}
    </div>
  );
}