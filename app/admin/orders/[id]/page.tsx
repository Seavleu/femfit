import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/catalog/money";
import { OrderActions } from "@/components/features/admin/OrderActions";

export const metadata: Metadata = { title: "Order Detail" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const admin = createServiceRoleClient();

  const { data: order } = await admin
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (!order) redirect("/admin/orders");

  const { data: items } = await admin
    .from("order_items")
    .select("id, product_name, sku, unit_price_cents, quantity, variant_id")
    .eq("order_id", id);

  const { data: payments } = await admin
    .from("payments")
    .select("id, method, status, amount_cents, currency, gateway_txn_id, paid_at, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  const { data: shipments } = await admin
    .from("shipment_events")
    .select("id, status, tracking_number, carrier, note, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  // Valid next statuses per Sys Design §8.4
  const transitions: Record<string, { value: string; label: string }[]> = {
    pending_payment: [{ value: "cancelled", label: "Cancel Order" }],
    confirmed: [
      { value: "packing", label: "Start Packing" },
      { value: "cancelled", label: "Cancel Order" },
    ],
    packing: [{ value: "shipped", label: "Mark as Shipped" }],
    shipped: [{ value: "delivered", label: "Mark as Delivered" }],
    delivered: [{ value: "refunded", label: "Issue Refund" }],
  };
  const nextStatuses = transitions[order.status] ?? [];

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-gray-900">← Orders</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold">{order.order_number}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[order.status] ?? "bg-gray-100"}`}>
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-medium">Items</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {(items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-gray-500">SKU: {item.sku} × {item.quantity}</p>
                  </div>
                  <span className="tabular-nums">
                    {formatMoney(item.unit_price_cents * item.quantity, order.currency).display}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatMoney(order.subtotal_cents, order.currency).display}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{formatMoney(order.shipping_cents, order.currency).display}</span></div>
              <div className="flex justify-between font-medium pt-1 border-t border-gray-100"><span>Total</span><span>{formatMoney(order.total_cents, order.currency).display}</span></div>
            </div>
          </div>

          {/* Payment history */}
          {payments && payments.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-medium">Payments</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium uppercase">{p.method === "cod" ? "Cash on Delivery" : "ABA PayWay"}</p>
                      {p.gateway_txn_id && <p className="text-xs text-gray-500">Ref: {p.gateway_txn_id}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-2xs font-medium ${
                        p.status === "succeeded" ? "bg-green-100 text-green-800" :
                        p.status === "failed" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>{p.status}</span>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shipment events */}
          {shipments && shipments.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-medium">Shipment Events</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {shipments.map((s) => (
                  <div key={s.id} className="px-4 py-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium capitalize">{s.status}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {s.tracking_number && <p className="text-xs text-gray-500">Tracking: {s.tracking_number} ({s.carrier})</p>}
                    {s.note && <p className="text-xs text-gray-500">{s.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          {nextStatuses.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-medium">Actions</h2>
              <OrderActions
                orderId={order.id}
                currentStatus={order.status}
                nextStatuses={nextStatuses}
              />
            </div>
          )}

          {/* Shipping address */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium">Shipping Address</h2>
            <div className="space-y-1 text-sm text-gray-600">
              <p className="font-medium text-gray-900">{order.shipping_full_name}</p>
              <p>{order.shipping_phone}</p>
              <p>{order.shipping_street}</p>
              {order.shipping_commune && <p>{order.shipping_commune}</p>}
              <p>{order.shipping_district}, {order.shipping_province}</p>
              {order.shipping_notes && (
                <p className="mt-2 text-xs italic text-gray-400">Note: {order.shipping_notes}</p>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Payment</dt><dd className="uppercase">{order.payment_method === "cod" ? "COD" : "ABA"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Created</dt><dd>{new Date(order.created_at).toLocaleString()}</dd></div>
              {order.admin_note && (
                <div><dt className="text-gray-500">Admin note</dt><dd className="mt-1 text-xs">{order.admin_note}</dd></div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}