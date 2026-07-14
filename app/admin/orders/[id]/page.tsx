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
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/orders" className="label-mono normal-case tracking-[0.12em] hover:text-foreground">
          ← Orders
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="font-serif text-2xl">{order.order_number}</h1>
        <span className={`rounded-xl px-2.5 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] ${statusColors[order.status] ?? "bg-muted"}`}>
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="module overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <p className="label-mono mb-1">Line items</p>
              <h2 className="font-serif text-lg">Items</h2>
            </div>
            <div className="divide-y divide-border">
              {(items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {item.sku} × {item.quantity}</p>
                  </div>
                  <span className="tabular-nums">
                    {formatMoney(item.unit_price_cents * item.quantity, order.currency).display}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-border px-5 py-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(order.subtotal_cents, order.currency).display}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{formatMoney(order.shipping_cents, order.currency).display}</span></div>
              <div className="flex justify-between border-t border-border pt-2 font-medium"><span>Total</span><span>{formatMoney(order.total_cents, order.currency).display}</span></div>
            </div>
          </div>

          {payments && payments.length > 0 && (
            <div className="module overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="label-mono mb-1">Transactions</p>
                <h2 className="font-serif text-lg">Payments</h2>
              </div>
              <div className="divide-y divide-border">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium uppercase">{p.method === "cod" ? "Cash on Delivery" : "ABA PayWay"}</p>
                      {p.gateway_txn_id && <p className="text-xs text-muted-foreground">Ref: {p.gateway_txn_id}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-xl px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] ${
                        p.status === "succeeded" ? "bg-muted text-foreground" :
                        p.status === "failed" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>{p.status}</span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shipments && shipments.length > 0 && (
            <div className="module overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="label-mono mb-1">Logistics</p>
                <h2 className="font-serif text-lg">Shipment Events</h2>
              </div>
              <div className="divide-y divide-border">
                {shipments.map((s) => (
                  <div key={s.id} className="px-5 py-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium capitalize">{s.status}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {s.tracking_number && <p className="text-xs text-muted-foreground">Tracking: {s.tracking_number} ({s.carrier})</p>}
                    {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {nextStatuses.length > 0 && (
            <div className="module p-5">
              <p className="label-mono mb-2">Workflow</p>
              <h2 className="mb-4 font-serif text-lg">Actions</h2>
              <OrderActions
                orderId={order.id}
                currentStatus={order.status}
                nextStatuses={nextStatuses}
              />
            </div>
          )}

          <div className="module p-5">
            <p className="label-mono mb-2">Delivery</p>
            <h2 className="mb-4 font-serif text-lg">Shipping Address</h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{order.shipping_full_name}</p>
              <p>{order.shipping_phone}</p>
              <p>{order.shipping_street}</p>
              {order.shipping_commune && <p>{order.shipping_commune}</p>}
              <p>{order.shipping_district}, {order.shipping_province}</p>
              {order.shipping_notes && (
                <p className="mt-2 text-xs italic">Note: {order.shipping_notes}</p>
              )}
            </div>
          </div>

          <div className="module p-5">
            <p className="label-mono mb-2">Meta</p>
            <h2 className="mb-4 font-serif text-lg">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Payment</dt><dd className="font-mono text-2xs uppercase tracking-[0.08em]">{order.payment_method === "cod" ? "COD" : "ABA"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd>{new Date(order.created_at).toLocaleString()}</dd></div>
              {order.admin_note && (
                <div><dt className="text-muted-foreground">Admin note</dt><dd className="mt-1 text-xs">{order.admin_note}</dd></div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
