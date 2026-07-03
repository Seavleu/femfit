import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { InventoryAdjustForm } from "@/components/features/admin/InventoryAdjustForm";

export const metadata: Metadata = { title: "Inventory" };

/**
 * Inventory management — per DB Schema §6.9 and Runbook §7.6.
 * Shows all variants with current stock, allows manual adjustments
 * that are logged to inventory_movements (append-only audit trail).
 */
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

  // Recent movements for audit trail
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
      <h1 className="text-xl font-semibold">Inventory</h1>

      {/* Stock levels */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Variant</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(variants ?? []).map((v) => {
              const product = v.products as { id: string; name: string; slug: string };
              return (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.sku}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {[v.size, v.color].filter(Boolean).join(" / ") || "Default"}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                    v.stock_quantity === 0 ? "text-red-600" :
                    v.stock_quantity <= 5 ? "text-amber-600" : ""
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

      {/* Audit trail */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-gray-500">Recent Movements</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recentMovements ?? []).map((m) => {
                const variant = m.product_variants as { sku: string; products: { name: string } };
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs">{variant.sku}</p>
                      <p className="text-xs text-gray-400">{variant.products.name}</p>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                      m.change_qty > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {m.change_qty > 0 ? "+" : ""}{m.change_qty}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{m.reason}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{m.note ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
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