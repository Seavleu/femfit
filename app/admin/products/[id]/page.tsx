import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ProductForm } from "@/components/features/admin/ProductForm";
import { VariantManager } from "@/components/features/admin/VariantManager";
import { SoftDeleteProductButton } from "@/components/features/admin/SoftDeleteProductButton";

export const metadata: Metadata = { title: "Edit Product" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminProductDetailPage({ params }: Props) {
  const { id } = await params;
  const admin = createServiceRoleClient();

  const [{ data: product }, { data: categories }, { data: variants }] =
    await Promise.all([
      admin
        .from("products")
        .select(
          "id, name, slug, sku, category_id, description, base_price_cents, compare_at_price_cents, currency, is_active, is_featured, deleted_at"
        )
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order"),
      admin
        .from("product_variants")
        .select("id, sku, size, color, price_cents, stock_quantity, is_active")
        .eq("product_id", id)
        .order("size"),
    ]);

  if (!product || product.deleted_at) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav className="mb-4 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted-foreground">
            <Link href="/admin/products" className="hover:text-foreground">
              Products
            </Link>
            <span>/</span>
            <span className="text-foreground">{product.name}</span>
          </nav>
          <p className="label-mono mb-2">Edit</p>
          <h1 className="title-serif">{product.name}</h1>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">
            SKU {product.sku} · /{product.slug}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/products/${product.slug}`}
            className="btn-ghost"
            target="_blank"
          >
            View in shop
          </Link>
          <SoftDeleteProductButton productId={product.id} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="label-mono">Product details</h2>
        <ProductForm
          mode="edit"
          categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            categoryId: product.category_id,
            description: product.description,
            basePriceCents: product.base_price_cents,
            compareAtPriceCents: product.compare_at_price_cents,
            isActive: product.is_active,
            isFeatured: product.is_featured,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="label-mono">Variants</h2>
        <VariantManager
          productId={product.id}
          variants={(variants ?? []).map((v) => ({
            id: v.id,
            sku: v.sku,
            size: v.size,
            color: v.color,
            priceCents: v.price_cents,
            stockQuantity: v.stock_quantity,
            isActive: v.is_active,
          }))}
        />
      </section>
    </div>
  );
}
