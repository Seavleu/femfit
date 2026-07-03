import Link from "next/link";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/catalog/money";
import { ProductToggle } from "@/components/features/admin/ProductToggle";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage() {
  const admin = createServiceRoleClient();

  const { data: productList } = await admin
    .from("products")
    .select(`
      id, name, slug, base_price_cents, currency, is_active, is_featured,
      created_at, deleted_at,
      categories(name),
      product_variants(id, stock_quantity, is_active)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <p className="text-sm text-gray-500">{(productList ?? []).length} products</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Total Stock</th>
              <th className="px-4 py-3 text-center">Active</th>
              <th className="px-4 py-3 text-center">Featured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(productList ?? []).map((product) => {
              const variants = (product.product_variants ?? []) as { id: string; stock_quantity: number; is_active: boolean }[];
              const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);
              const category = product.categories as { name: string } | null;
              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${product.id}`} className="font-medium text-blue-600 hover:underline">
                      {product.name}
                    </Link>
                    <p className="text-xs text-gray-400">/{product.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(product.base_price_cents, product.currency).display}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${totalStock <= 5 ? "text-red-600 font-medium" : ""}`}>
                    {totalStock}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ProductToggle productId={product.id} field="isActive" value={product.is_active} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs ${product.is_featured ? "text-amber-600" : "text-gray-300"}`}>
                      {product.is_featured ? "★" : "☆"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}