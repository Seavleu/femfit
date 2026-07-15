"use server";

/**
 * Admin catalog mutations — API Spec §8.8 Products.
 * Responsibilities:
 *   - Admin-only writes
 *   - Money as integer cents
 *   - Soft-delete products (deleted_at)
 *   - Variant stock changes → inventory_movements (adjustment/restock)
 *   - Idempotency-Key on create
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { withIdempotency, IdempotencyConflictError } from "@/lib/api/idempotency";
import { makeSku, slugify } from "@/lib/admin/catalog-utils";

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) throw new Error("Not an admin");
  return user.id;
}

function revalidateCatalog(productId?: string, slug?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
  if (slug) revalidatePath(`/products/${slug}`);
}

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must be lowercase letters, numbers, and hyphens",
    })
    .optional(),
  sku: z.string().trim().min(2).max(40).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  basePriceCents: z.number().int().min(0),
  compareAtPriceCents: z.number().int().min(0).optional().nullable(),
  currency: z.enum(["USD", "KHR"]).default("USD"),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  primaryImageUrl: z.string().url().optional().nullable(),
  idempotencyKey: z.string().uuid().optional(),
});

const updateProductSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(2).max(200).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  basePriceCents: z.number().int().min(0).optional(),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

const createVariantSchema = z.object({
  productId: z.string().uuid(),
  size: z.string().trim().max(40).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  sku: z.string().trim().min(2).max(40).optional(),
  priceCents: z.number().int().min(0).optional().nullable(),
  stockQuantity: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateVariantSchema = z.object({
  variantId: z.string().uuid(),
  size: z.string().trim().max(40).nullable().optional(),
  color: z.string().trim().max(40).nullable().optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function createProduct(
  input: z.infer<typeof createProductSchema>
): Promise<Result<{ productId: string }>> {
  const parsed = createProductSchema.safeParse({
    ...input,
    slug: input.slug ? slugify(input.slug) : input.slug,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const adminUserId = await requireAdmin();
    const data = parsed.data;
    const slug = data.slug || slugify(data.name);
    const sku =
      data.sku || makeSku(data.name) || `P-${Date.now().toString(36).toUpperCase()}`;

    if (!slug) {
      return { ok: false, error: "Could not derive a valid slug from the name." };
    }

    const run = async () => {
      const admin = createServiceRoleClient();

      // DB unique indexes cover soft-deleted rows too
      const { data: bySlug } = await admin
        .from("products")
        .select("id, deleted_at")
        .eq("slug", slug)
        .maybeSingle();
      const { data: bySku } = await admin
        .from("products")
        .select("id, deleted_at")
        .eq("sku", sku)
        .maybeSingle();
      if (bySlug || bySku) {
        throw new Error(
          "A product with this slug or SKU already exists (including deleted)."
        );
      }

      const { data: product, error } = await admin
        .from("products")
        .insert({
          name: data.name,
          slug,
          sku,
          category_id: data.categoryId ?? null,
          description: data.description ?? null,
          base_price_cents: data.basePriceCents,
          compare_at_price_cents: data.compareAtPriceCents ?? null,
          currency: data.currency,
          is_active: data.isActive,
          is_featured: data.isFeatured,
        })
        .select("id, slug")
        .single();

      if (error || !product) {
        if (error?.code === "23505") {
          throw new Error("A product with this slug or SKU already exists.");
        }
        throw new Error(error?.message ?? "Insert failed");
      }

      if (data.primaryImageUrl) {
        const { error: imgErr } = await admin.from("product_images").insert({
          product_id: product.id,
          url: data.primaryImageUrl,
          alt_text: data.name,
          sort_order: 0,
          is_primary: true,
        });
        if (imgErr) {
          console.error("[createProduct] image insert", imgErr);
        }
      }

      return { data: { productId: product.id, slug: product.slug }, status: 201 };
    };

    if (data.idempotencyKey) {
      try {
        const result = await withIdempotency(
          data.idempotencyKey,
          adminUserId,
          "POST /admin/products",
          run
        );
        revalidateCatalog(result.data.productId, result.data.slug);
        return { ok: true, data: { productId: result.data.productId } };
      } catch (err) {
        if (err instanceof IdempotencyConflictError) {
          return { ok: false, error: err.message };
        }
        throw err;
      }
    }

    const result = await run();
    revalidateCatalog(result.data.productId, result.data.slug);
    return { ok: true, data: { productId: result.data.productId } };
  } catch (err) {
    console.error("[createProduct]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create product.",
    };
  }
}

export async function updateProductDetails(
  input: z.infer<typeof updateProductSchema>
): Promise<Result> {
  const parsed = updateProductSchema.safeParse({
    ...input,
    slug: input.slug ? slugify(input.slug) : input.slug,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await requireAdmin();
    const admin = createServiceRoleClient();
    const { productId, ...fields } = parsed.data;

    const { data: existing } = await admin
      .from("products")
      .select("id, slug, deleted_at")
      .eq("id", productId)
      .maybeSingle();
    if (!existing || existing.deleted_at) {
      return { ok: false, error: "Product not found." };
    }

    if (fields.slug && fields.slug !== existing.slug) {
      const { data: conflict } = await admin
        .from("products")
        .select("id")
        .eq("slug", fields.slug)
        .neq("id", productId)
        .maybeSingle();
      if (conflict) {
        return { ok: false, error: "Another product already uses this slug." };
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (fields.name !== undefined) updates.name = fields.name;
    if (fields.slug !== undefined) updates.slug = fields.slug;
    if (fields.categoryId !== undefined) updates.category_id = fields.categoryId;
    if (fields.description !== undefined) updates.description = fields.description;
    if (fields.basePriceCents !== undefined) updates.base_price_cents = fields.basePriceCents;
    if (fields.compareAtPriceCents !== undefined) {
      updates.compare_at_price_cents = fields.compareAtPriceCents;
    }
    if (fields.isActive !== undefined) updates.is_active = fields.isActive;
    if (fields.isFeatured !== undefined) updates.is_featured = fields.isFeatured;

    const { error } = await admin.from("products").update(updates).eq("id", productId);
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Slug or SKU conflict." };
      }
      return { ok: false, error: error.message };
    }

    const nextSlug = (fields.slug as string | undefined) ?? existing.slug;
    revalidateCatalog(productId, nextSlug);
    if (fields.slug && fields.slug !== existing.slug) {
      revalidatePath(`/products/${existing.slug}`);
    }
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[updateProductDetails]", err);
    return { ok: false, error: "Failed to update product." };
  }
}

export async function softDeleteProduct(productId: string): Promise<Result> {
  const id = z.string().uuid().safeParse(productId);
  if (!id.success) return { ok: false, error: "Invalid product id." };

  try {
    await requireAdmin();
    const admin = createServiceRoleClient();

    const { data: existing } = await admin
      .from("products")
      .select("id, slug, deleted_at")
      .eq("id", productId)
      .maybeSingle();
    if (!existing || existing.deleted_at) {
      return { ok: false, error: "Product not found." };
    }

    // Soft delete + deactivate variants so they cannot be purchased
    await admin
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    await admin
      .from("product_variants")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("product_id", productId);

    revalidateCatalog(productId, existing.slug);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[softDeleteProduct]", err);
    return { ok: false, error: "Failed to delete product." };
  }
}

export async function createVariant(
  input: z.infer<typeof createVariantSchema>
): Promise<Result<{ variantId: string }>> {
  const parsed = createVariantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const adminUserId = await requireAdmin();
    const admin = createServiceRoleClient();
    const data = parsed.data;

    const { data: product } = await admin
      .from("products")
      .select("id, sku, name, slug")
      .eq("id", data.productId)
      .is("deleted_at", null)
      .single();
    if (!product) return { ok: false, error: "Product not found." };

    const size = data.size?.trim() || null;
    const color = data.color?.trim() || null;
    if (!size && !color) {
      return { ok: false, error: "Provide at least a size or color." };
    }

    const sku =
      data.sku ||
      makeSku(product.sku, color ?? "", size ?? "") ||
      `V-${Date.now().toString(36).toUpperCase()}`;

    const { data: variant, error } = await admin
      .from("product_variants")
      .insert({
        product_id: data.productId,
        sku,
        size,
        color,
        price_cents: data.priceCents ?? null,
        stock_quantity: data.stockQuantity,
        is_active: data.isActive,
      })
      .select("id")
      .single();

    if (error || !variant) {
      if (error?.code === "23505") {
        return { ok: false, error: "SKU or size/color combo already exists." };
      }
      return { ok: false, error: error?.message ?? "Failed to create variant." };
    }

    if (data.stockQuantity > 0) {
      await admin.from("inventory_movements").insert({
        variant_id: variant.id,
        change_qty: data.stockQuantity,
        reason: "restock",
        reference_id: adminUserId,
        reference_type: "admin",
        created_by: adminUserId,
        note: `Initial stock for ${sku}`,
      });
    }

    revalidateCatalog(data.productId, product.slug);
    return { ok: true, data: { variantId: variant.id } };
  } catch (err) {
    console.error("[createVariant]", err);
    return { ok: false, error: "Failed to create variant." };
  }
}

export async function updateVariant(
  input: z.infer<typeof updateVariantSchema>
): Promise<Result> {
  const parsed = updateVariantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const adminUserId = await requireAdmin();
    const admin = createServiceRoleClient();
    const { variantId, ...fields } = parsed.data;

    const { data: variant } = await admin
      .from("product_variants")
      .select("id, product_id, stock_quantity, products(slug, deleted_at)")
      .eq("id", variantId)
      .single();
    if (!variant) return { ok: false, error: "Variant not found." };

    const productJoin = variant.products as
      | { slug: string; deleted_at: string | null }
      | { slug: string; deleted_at: string | null }[]
      | null;
    const productMeta = Array.isArray(productJoin) ? productJoin[0] : productJoin;
    if (productMeta?.deleted_at) {
      return { ok: false, error: "Cannot update variants on a deleted product." };
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (fields.size !== undefined) updates.size = fields.size?.trim() || null;
    if (fields.color !== undefined) updates.color = fields.color?.trim() || null;
    if (fields.priceCents !== undefined) updates.price_cents = fields.priceCents;
    if (fields.isActive !== undefined) updates.is_active = fields.isActive;

    if (fields.stockQuantity !== undefined) {
      const delta = fields.stockQuantity - variant.stock_quantity;
      updates.stock_quantity = fields.stockQuantity;
      if (delta !== 0) {
        // API Spec §8.8: stock changes create inventory_movement reason=adjustment
        await admin.from("inventory_movements").insert({
          variant_id: variantId,
          change_qty: delta,
          reason: "adjustment",
          reference_id: adminUserId,
          reference_type: "admin",
          created_by: adminUserId,
          note: "Stock set via product edit",
        });
      }
    }

    const { error } = await admin
      .from("product_variants")
      .update(updates)
      .eq("id", variantId);
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Size/color combo already exists." };
      }
      return { ok: false, error: error.message };
    }

    revalidateCatalog(variant.product_id, productMeta?.slug);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[updateVariant]", err);
    return { ok: false, error: "Failed to update variant." };
  }
}
