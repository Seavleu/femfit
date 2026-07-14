"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, productVariants, reviews } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

type Result =
  | { ok: true; data?: { reviewId: string } }
  | { ok: false; error: string };

const submitSchema = z.object({
  productId: z.string().uuid(),
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(1000).optional(),
});

/**
 * Submit a product review — PRD §3.5.
 * Only customers with a delivered order containing the product may review.
 * Reviews enter the moderation queue (is_approved = false).
 */
export async function submitReview(input: {
  productId: string;
  orderId: string;
  rating: number;
  title?: string;
  body?: string;
}): Promise<Result> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Must be signed in to leave a review." };

  const { productId, orderId, rating, title, body } = parsed.data;

  const [order] = await db
    .select({ id: orders.id, status: orders.status, userId: orders.userId })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)))
    .limit(1);

  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "delivered") {
    return { ok: false, error: "You can only review products from delivered orders." };
  }

  const items = await db
    .select({ variantId: orderItems.variantId, productId: productVariants.productId })
    .from(orderItems)
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(eq(orderItems.orderId, orderId));

  if (!items.some((i) => i.productId === productId)) {
    return { ok: false, error: "This product was not in that order." };
  }

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.productId, productId),
        eq(reviews.userId, user.id),
        eq(reviews.orderId, orderId),
        isNull(reviews.deletedAt)
      )
    )
    .limit(1);

  if (existing) {
    return { ok: false, error: "You already reviewed this product for that order." };
  }

  try {
    const [row] = await db
      .insert(reviews)
      .values({
        productId,
        userId: user.id,
        orderId,
        rating,
        title: title?.trim() || null,
        body: body?.trim() || null,
        isApproved: false,
      })
      .returning({ id: reviews.id });

    revalidatePath("/admin/reviews");
    // Product pages — slug unknown here; list + home caches refresh via revalidate
    revalidatePath("/products");
    return { ok: true, data: { reviewId: row.id } };
  } catch (err) {
    console.error("[submitReview]", err);
    return { ok: false, error: "Could not submit review. Please try again." };
  }
}

/**
 * Delivered orders that include this product and have no review yet —
 * used to show the review form on the PDP.
 */
export async function getReviewableOrdersForProduct(productId: string): Promise<
  Array<{ orderId: string; orderNumber: string; deliveredAt: Date }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const delivered = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      deliveredAt: orders.updatedAt,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        eq(orders.userId, user.id),
        eq(orders.status, "delivered"),
        eq(productVariants.productId, productId)
      )
    );

  const unique = new Map<string, { orderId: string; orderNumber: string; deliveredAt: Date }>();
  for (const row of delivered) {
    unique.set(row.orderId, row);
  }

  const result: Array<{ orderId: string; orderNumber: string; deliveredAt: Date }> = [];
  for (const row of unique.values()) {
    const [rev] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(
        and(
          eq(reviews.productId, productId),
          eq(reviews.userId, user.id),
          eq(reviews.orderId, row.orderId),
          isNull(reviews.deletedAt)
        )
      )
      .limit(1);
    if (!rev) result.push(row);
  }

  return result;
}
