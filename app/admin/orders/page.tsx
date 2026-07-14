import Link from "next/link";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/catalog/money";

export const metadata: Metadata = { title: "Orders" };

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

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
      <div className="flex items-end justify-between">
        <div>
          <p className="label-mono mb-2">Fulfillment</p>
          <h1 className="title-serif">Orders</h1>
        </div>
        <p className="label-mono">{count ?? 0} total</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => {
          const active = (params.status ?? "") === s.value;
          const href = s.value ? `/admin/orders?status=${s.value}` : "/admin/orders";
          return (
            <Link
              key={s.value}
              href={href}
              className={`rounded-xl border px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] transition-colors ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <div className="module overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="label-mono px-4 py-3">Order</th>
              <th className="label-mono px-4 py-3">Customer</th>
              <th className="label-mono px-4 py-3">Status</th>
              <th className="label-mono px-4 py-3">Payment</th>
              <th className="label-mono px-4 py-3 text-right">Total</th>
              <th className="label-mono px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(orders ?? []).map((order) => (
              <tr key={order.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:text-rose">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p>{order.shipping_full_name}</p>
                  <p className="text-xs text-muted-foreground">{order.shipping_province}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-xl px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] ${statusColors[order.status] ?? "bg-muted"}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="label-mono px-4 py-3 normal-case tracking-normal">
                  {order.payment_method === "cod" ? "COD" : "ABA"}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatMoney(order.total_cents, order.currency).display}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/orders?${params.status ? `status=${params.status}&` : ""}page=${page - 1}`}
              className="btn-ghost h-9 px-4"
            >
              ← Previous
            </Link>
          )}
          <span className="label-mono normal-case tracking-normal">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/admin/orders?${params.status ? `status=${params.status}&` : ""}page=${page + 1}`}
              className="btn-ghost h-9 px-4"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
