import { db } from "@/db";
import {
  products,
  productImages,
  productVariants,
  orderItems,
  orders,
  categories,
} from "@/db/schema";
import { and, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  basePriceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  primaryImageUrl: string | null;
  primaryImageAlt: string | null;
  inStock: boolean;
  isNew: boolean;
};

export type CategoryItem = {
  id: string;
  slug: string;
  name: string;
};

export async function getFeaturedProducts(limit = 4): Promise<ProductCard[]> {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      basePriceCents: products.basePriceCents,
      compareAtPriceCents: products.compareAtPriceCents,
      currency: products.currency,
      primaryImageUrl: productImages.url,
      primaryImageAlt: productImages.altText,
      totalStock: sql<number>`coalesce(sum(${productVariants.stockQuantity}), 0)`,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true)
      )
    )
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.isActive, true),
        eq(products.isFeatured, true),
        isNull(products.deletedAt)
      )
    )
    .groupBy(
      products.id,
      products.slug,
      products.name,
      products.basePriceCents,
      products.compareAtPriceCents,
      products.currency,
      productImages.url,
      productImages.altText,
      products.createdAt
    )
    .orderBy(desc(products.createdAt))
    .limit(limit);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    basePriceCents: r.basePriceCents,
    compareAtPriceCents: r.compareAtPriceCents,
    currency: r.currency,
    primaryImageUrl: r.primaryImageUrl ?? null,
    primaryImageAlt: r.primaryImageAlt ?? r.name,
    inStock: Number(r.totalStock) > 0,
    isNew: r.createdAt > thirtyDaysAgo,
  }));
}

export async function getNewArrivals(limit = 8): Promise<ProductCard[]> {
    const rows = await db.select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        basePriceCents: products.basePriceCents,
        compareAtPriceCents: products.compareAtPriceCents,
        currency: products.currency,
        primaryImageUrl: productImages.url,
        primaryImageAlt: productImages.altText,
        totalStock: sql<number>`coalesce(sum(${productVariants.stockQuantity}), 0)`,
        createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(
        productImages,
        and(
            eq(productImages.productId, products.id),
            eq(productImages.isPrimary, true),
        )
    )
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(
        and(
            eq(products.isActive, true),
            isNull(products.deletedAt),
            gt(
                products.createdAt,
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            ),
        )
    )
    .groupBy(
        products.id,
        products.slug,
        products.name,
        products.basePriceCents,
        products.compareAtPriceCents,
        products.currency,
        productImages.url,
        productImages.altText,
        products.createdAt,
    )
    .orderBy(desc(products.createdAt))
    .limit(limit);

    return rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        basePriceCents: r.basePriceCents,
        compareAtPriceCents: r.compareAtPriceCents,
        currency: r.currency,
        primaryImageUrl: r.primaryImageUrl ?? null,
        primaryImageAlt: r.primaryImageAlt ?? r.name,
        inStock: Number(r.totalStock) > 0,
        isNew: true,
    }));
}

export async function getActiveCategories(limit = 6): Promise<CategoryItem[]> {
    return db
    .select({id:categories.id, slug: categories.slug, name: categories.name})
    .from(categories)
    .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
    .orderBy(categories.sortOrder)
    .limit(limit);
}

/**
 * Best Sellers — per PRD §3.2: ranked by quantity sold in the last 30 days.
 * Counts confirmed, packing, shipped, and delivered orders only.
 */
export async function getBestSellers(limit = 8): Promise<ProductCard[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const salesRows = await db
    .select({
      productId: productVariants.productId,
      totalSold: sql<number>`sum(${orderItems.quantity})`.as("total_sold"),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        gte(orders.createdAt, thirtyDaysAgo),
        inArray(orders.status, ["confirmed", "packing", "shipped", "delivered"])
      )
    )
    .groupBy(productVariants.productId)
    .orderBy(desc(sql`total_sold`))
    .limit(limit);

  if (salesRows.length === 0) return [];

  const productIds = salesRows.map((r) => r.productId);
  const rank = new Map(salesRows.map((r, i) => [r.productId, i]));

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      basePriceCents: products.basePriceCents,
      compareAtPriceCents: products.compareAtPriceCents,
      currency: products.currency,
      createdAt: products.createdAt,
      primaryImageUrl: productImages.url,
      primaryImageAlt: productImages.altText,
      totalStock: sql<number>`coalesce(sum(${productVariants.stockQuantity}), 0)`,
    })
    .from(products)
    .leftJoin(
      productImages,
      and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true))
    )
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(
      and(
        inArray(products.id, productIds),
        eq(products.isActive, true),
        isNull(products.deletedAt)
      )
    )
    .groupBy(
      products.id,
      products.slug,
      products.name,
      products.basePriceCents,
      products.compareAtPriceCents,
      products.currency,
      products.createdAt,
      productImages.url,
      productImages.altText
    );

  return rows
    .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      basePriceCents: r.basePriceCents,
      compareAtPriceCents: r.compareAtPriceCents,
      currency: r.currency,
      primaryImageUrl: r.primaryImageUrl ?? null,
      primaryImageAlt: r.primaryImageAlt ?? r.name,
      inStock: Number(r.totalStock) > 0,
      isNew: r.createdAt > thirtyDaysAgo,
    }));
}