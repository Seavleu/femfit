import Link from "next/link";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/features/admin/ProductForm";

export const metadata: Metadata = { title: "New Product" };

export default async function AdminNewProductPage() {
  const admin = createServiceRoleClient();
  const { data: categories } = await admin
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-4 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
          <Link href="/admin/products" className="hover:text-foreground">
            Products
          </Link>
          <span>/</span>
          <span className="text-foreground">New</span>
        </nav>
        <p className="label-mono mb-2">Catalog</p>
        <h1 className="title-serif">New product</h1>
      </div>
      <ProductForm
        mode="create"
        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
