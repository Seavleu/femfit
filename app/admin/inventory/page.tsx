import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { InventoryAdjustForm } from "@/components/features/admin/InventoryAdjustForm";

export const metadata: Metadata = { title: "Inventory" };

export default async function AdminInventoryPage() {
  const admin = createServiceRoleClient();

  const { data: variants } = await admin
    .from("product_variants")
    .select(`
      id, sku, size, color, stock_quantity, is_active,
      products!inner(id, name, slug)
    `)
    .eq("is_active", true)
    .order("stock_quantity", { ascending: true });

  const { data: recentMovements } = await admin
    .from("inventory_movements")
    .select(`
      id, change_qty, reason, note, created_at,
      product_variants!inner(sku, products!inner(name))
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      <div>
        <p className="label-mono mb-2">Stock</p>
        <h1 className="title-serif">Inventory</h1>
      </div>

      <div className="module overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="label-mono px-4 py-3">Product</th>
              <th className="label-mono px-4 py-3">SKU</th>
              <th className="label-mono px-4 py-3">Variant</th>
              <th className="label-mono px-4 py-3 text-right">Stock</th>
              <th className="label-mono px-4 py-3 text-right">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(variants ?? []).map((v) => {
              const product = v.products as { id: string; name: string; slug: string };
              return (
                <tr key={v.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.sku}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[v.size, v.color].filter(Boolean).join(" / ") || "Default"}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                    v.stock_quantity === 0 ? "text-destructive" :
                    v.stock_quantity <= 5 ? "text-rose" : ""
                  }`}>
                    {v.stock_quantity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <InventoryAdjustForm variantId={v.id} sku={v.sku} currentStock={v.stock_quantity} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="label-mono mb-4">Recent Movements</h2>
        <div className="module overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="label-mono px-4 py-3">SKU</th>
                <th className="label-mono px-4 py-3 text-right">Change</th>
                <th className="label-mono px-4 py-3">Reason</th>
                <th className="label-mono px-4 py-3">Note</th>
                <th className="label-mono px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentMovements ?? []).map((m) => {
                const variant = m.product_variants as { sku: string; products: { name: string } };
                return (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs">{variant.sku}</p>
                      <p className="text-xs text-muted-foreground">{variant.products.name}</p>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                      m.change_qty > 0 ? "text-foreground" : "text-destructive"
                    }`}>
                      {m.change_qty > 0 ? "+" : ""}{m.change_qty}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.reason}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">{m.note ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
