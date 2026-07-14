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
      <div className="flex items-end justify-between">
        <div>
          <p className="label-mono mb-2">Catalog</p>
          <h1 className="title-serif">Products</h1>
        </div>
        <p className="label-mono">{(productList ?? []).length} products</p>
      </div>

      <div className="module overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="label-mono px-4 py-3">Product</th>
              <th className="label-mono px-4 py-3">Category</th>
              <th className="label-mono px-4 py-3 text-right">Price</th>
              <th className="label-mono px-4 py-3 text-right">Total Stock</th>
              <th className="label-mono px-4 py-3 text-center">Active</th>
              <th className="label-mono px-4 py-3 text-center">Featured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(productList ?? []).map((product) => {
              const variants = (product.product_variants ?? []) as { id: string; stock_quantity: number; is_active: boolean }[];
              const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);
              const category = product.categories as { name: string } | null;
              return (
                <tr key={product.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${product.id}`} className="font-medium hover:text-rose">
                      {product.name}
                    </Link>
                    <p className="font-mono text-2xs text-muted-foreground">/{product.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(product.base_price_cents, product.currency).display}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${totalStock <= 5 ? "font-medium text-destructive" : ""}`}>
                    {totalStock}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ProductToggle productId={product.id} field="isActive" value={product.is_active} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs ${product.is_featured ? "text-rose" : "text-muted-foreground/40"}`}>
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
