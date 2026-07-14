"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendOrderShippedEmail, sendOrderCancelledEmail } from "@/lib/notifications/email";

/**
 * Admin server actions.
 *
 * All actions verify is_admin before executing. Uses service_role
 * for DB operations since admin needs cross-user access.
 *
 * Per Sys Design §8.4 — order state machine:
 *   confirmed → packing → shipped → delivered
 *   pending_payment → cancelled (auto or manual)
 *   confirmed → cancelled (manual)
 *   Any terminal → refunded (manual)
 */

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

// ── Valid state transitions per Sys Design §8.4 ──────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ["cancelled"],
  confirmed: ["packing", "cancelled"],
  packing: ["shipped"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

// ── Order status transition ──────────────────────────────────────────────

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  newStatus: z.string(),
  trackingNumber: z.string().optional(),
  adminNote: z.string().max(500).optional(),
});

export async function transitionOrderStatus(input: {
  orderId: string;
  newStatus: string;
  trackingNumber?: string;
  adminNote?: string;
}): Promise<Result> {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await requireAdmin();
    const admin = createServiceRoleClient();
    const { orderId, newStatus, trackingNumber, adminNote } = parsed.data;

    // Get current status
    const { data: order } = await admin
      .from("orders")
      .select("id, status, order_number, user_id")
      .eq("id", orderId)
      .single();
    if (!order) return { ok: false, error: "Order not found." };

    // Validate transition
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return { ok: false, error: `Cannot transition from "${order.status}" to "${newStatus}".` };
    }

    // Apply transition
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (adminNote) updates.admin_note = adminNote;
    if (newStatus === "shipped") {
      updates.shipped_at = new Date().toISOString();
      if (trackingNumber) updates.tracking_number = trackingNumber;
    }
    if (newStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }

    await admin.from("orders").update(updates).eq("id", orderId);

    // Manual courier handoff — tracking optional (no Cambodia courier API)
    if (newStatus === "shipped") {
      await admin.from("shipment_events").insert({
        order_id: orderId,
        status: "shipped",
        tracking_number: trackingNumber || null,
        carrier: "manual",
        note: adminNote ?? "Handed to local courier (manual tracking)",
      });
      if (order.user_id) {
        void sendOrderShippedEmail({
          userId: order.user_id,
          orderId,
          orderNumber: order.order_number,
          trackingNumber,
        });
      }
    }

    // Record delivery event for Cambodian manual handoff (no courier API)
    if (newStatus === "delivered") {
      await admin.from("shipment_events").insert({
        order_id: orderId,
        status: "delivered",
        carrier: "manual",
        note: adminNote ?? "Marked delivered by admin",
      });
    }

    // If cancelled, return stock
    if (newStatus === "cancelled") {
      await returnStockForOrder(admin, orderId, order.order_number);
      if (order.user_id) {
        void sendOrderCancelledEmail({
          userId: order.user_id,
          orderId,
          orderNumber: order.order_number,
        });
      }
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[transitionOrderStatus]", err);
    return { ok: false, error: "Failed to update order status." };
  }
}

async function returnStockForOrder(
  admin: ReturnType<typeof createServiceRoleClient>,
  orderId: string,
  orderNumber: string
) {
  const { data: items } = await admin
    .from("order_items")
    .select("variant_id, quantity")
    .eq("order_id", orderId);

  if (items) {
    for (const item of items) {
      await admin.rpc("increment_stock", {
        p_variant_id: item.variant_id,
        p_qty: item.quantity,
      });
      await admin.from("inventory_movements").insert({
        variant_id: item.variant_id,
        change_qty: item.quantity,
        reason: "return",
        reference_id: orderId,
        reference_type: "order",
        note: `Order ${orderNumber} cancelled — stock returned`,
      });
    }
  }
}

// ── Review moderation ────────────────────────────────────────────────────

export async function moderateReview(input: {
  reviewId: string;
  action: "approve" | "reject";
}): Promise<Result> {
  try {
    await requireAdmin();
    const admin = createServiceRoleClient();

    if (input.action === "approve") {
      await admin
        .from("reviews")
        .update({ is_approved: true, updated_at: new Date().toISOString() })
        .eq("id", input.reviewId);
    } else {
      // Soft-delete rejected reviews
      await admin
        .from("reviews")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", input.reviewId);
    }

    revalidatePath("/admin/reviews");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[moderateReview]", err);
    return { ok: false, error: "Failed to moderate review." };
  }
}

// ── Inventory adjustment ─────────────────────────────────────────────────

const adjustmentSchema = z.object({
  variantId: z.string().uuid(),
  changeQty: z.number().int(),
  reason: z.string().min(1).max(200),
});

export async function adjustInventory(input: {
  variantId: string;
  changeQty: number;
  reason: string;
}): Promise<Result> {
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    const adminUserId = await requireAdmin();
    const admin = createServiceRoleClient();
    const { variantId, changeQty, reason } = parsed.data;

    // Verify the variant exists
    const { data: variant } = await admin
      .from("product_variants")
      .select("id, stock_quantity, sku")
      .eq("id", variantId)
      .single();
    if (!variant) return { ok: false, error: "Variant not found." };

    const newQty = variant.stock_quantity + changeQty;
    if (newQty < 0) return { ok: false, error: `Cannot reduce stock below 0. Current: ${variant.stock_quantity}.` };

    // Update stock
    await admin
      .from("product_variants")
      .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", variantId);

    // Append-only audit log — per DB Schema §6.9
    await admin.from("inventory_movements").insert({
      variant_id: variantId,
      change_qty: changeQty,
      reason: "adjustment",
      reference_id: adminUserId,
      reference_type: "admin",
      note: reason,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[adjustInventory]", err);
    return { ok: false, error: "Failed to adjust inventory." };
  }
}

// ── Product management ───────────────────────────────────────────────────

export async function toggleProductActive(input: {
  productId: string;
  isActive: boolean;
}): Promise<Result> {
  try {
    await requireAdmin();
    const admin = createServiceRoleClient();

    await admin
      .from("products")
      .update({
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.productId);

    revalidatePath("/admin/products");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[toggleProductActive]", err);
    return { ok: false, error: "Failed to update product." };
  }
}

export async function updateProduct(input: {
  productId: string;
  name?: string;
  description?: string;
  basePriceCents?: number;
  compareAtPriceCents?: number | null;
  isFeatured?: boolean;
}): Promise<Result> {
  try {
    await requireAdmin();
    const admin = createServiceRoleClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.basePriceCents !== undefined) updates.base_price_cents = input.basePriceCents;
    if (input.compareAtPriceCents !== undefined) updates.compare_at_price_cents = input.compareAtPriceCents;
    if (input.isFeatured !== undefined) updates.is_featured = input.isFeatured;

    await admin.from("products").update(updates).eq("id", input.productId);

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${input.productId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[updateProduct]", err);
    return { ok: false, error: "Failed to update product." };
  }
}