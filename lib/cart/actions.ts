"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  ensureGuestSessionToken,
  getGuestSessionToken,
  clearGuestSessionToken,
} from "@/lib/cart/session";

/**
 * Cart server actions.
 *
 * Mapping to API Spec §7.2:
 *   addToCart       → POST   /api/v1/cart/items
 *   updateCartItem  → PATCH  /api/v1/cart/items/{id}
 *   removeCartItem  → DELETE /api/v1/cart/items/{id}
 *   mergeGuestCart  → POST   /api/v1/cart/merge   (called on login)
 *
 * Implementation notes:
 *
 * 1. We use service-role for all mutations because cart can belong to either
 *    a guest (no auth.uid()) or a logged-in user. The action determines
 *    ownership at the top of every call. RLS still protects against direct
 *    client queries.
 *
 * 2. cart_items has a unique constraint on (cart_id, variant_id). The
 *    addToCart action uses Postgres ON CONFLICT to upsert the row,
 *    incrementing quantity if the variant is already in the cart. This is
 *    naturally idempotent within the same submission window because each
 *    add carries an explicit quantity delta.
 *
 * 3. Errors throw with a stable shape — { type, message } — consumed by
 *    the client component to display inline messages. We do not yet emit
 *    RFC 7807 problem+json because these are server actions, not API
 *    routes. When we expose /api/v1 routes, that wrapping happens at the
 *    route boundary.
 *
 * 4. revalidatePath() invalidates the cached cart page and any layout
 *    that displays the cart badge.
 */

// ── Result shape ──────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { type: string; message: string } };

function ok<T>(data: T): ActionResult<T> { return { ok: true, data }; }
function fail(type: string, message: string): ActionResult {
  return { ok: false, error: { type, message } };
}

// ── Ownership resolution ──────────────────────────────────────────────────────

type CartOwnership =
  | { type: "user"; userId: string }
  | { type: "guest"; token: string };

async function resolveOwnership(
  createIfMissing: boolean
): Promise<CartOwnership> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return { type: "user", userId: user.id };
  }
  const token = createIfMissing
    ? await ensureGuestSessionToken()
    : await getGuestSessionToken();
  if (!token) {
    throw new Error("No cart session available");
  }
  return { type: "guest", token };
}

async function getOrCreateCart(owner: CartOwnership): Promise<string> {
  const admin = createServiceRoleClient();

  if (owner.type === "user") {
    const { data: existing } = await admin
      .from("carts")
      .select("id")
      .eq("user_id", owner.userId)
      .maybeSingle();
    if (existing) return existing.id;

    const { data: created, error } = await admin
      .from("carts")
      .insert({ user_id: owner.userId })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create cart: ${error.message}`);
    return created.id;
  }

  // Guest path
  const { data: existing } = await admin
    .from("carts")
    .select("id")
    .eq("session_token", owner.token)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("carts")
    .insert({ session_token: owner.token })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create cart: ${error.message}`);
  return created.id;
}

// ── addToCart ────────────────────────────────────────────────────────────────

const addToCartSchema = z.object({
  variantId: z.string().uuid({ message: "Invalid variant" }),
  quantity: z.number().int().min(1).max(99),
});

export async function addToCart(input: {
  variantId: string;
  quantity: number;
}): Promise<ActionResult<{ cartId: string; itemCount: number }>> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { variantId, quantity } = parsed.data;

  try {
    const owner = await resolveOwnership(true);
    const admin = createServiceRoleClient();

    // 1. Verify variant exists, is active, and has enough stock
    const { data: variant, error: variantErr } = await admin
      .from("product_variants")
      .select("id, stock_quantity, is_active, product_id")
      .eq("id", variantId)
      .single();
    if (variantErr || !variant) {
      return fail("not_found", "This product variant is no longer available.");
    }
    if (!variant.is_active) {
      return fail("not_available", "This variant is no longer available.");
    }
    if (variant.stock_quantity < quantity) {
      return fail(
        "insufficient_stock",
        variant.stock_quantity === 0
          ? "This item is out of stock."
          : `Only ${variant.stock_quantity} left in stock.`
      );
    }

    // 2. Get or create the cart
    const cartId = await getOrCreateCart(owner);

    // 3. Upsert the item: if exists, sum quantities; otherwise insert.
    //    cart_items has unique(cart_id, variant_id) per DB Schema §6.5.
    const { data: existing } = await admin
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("variant_id", variantId)
      .maybeSingle();

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > variant.stock_quantity) {
        return fail(
          "insufficient_stock",
          `Only ${variant.stock_quantity} left in stock (you already have ${existing.quantity} in your cart).`
        );
      }
      const { error } = await admin
        .from("cart_items")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) {
        return fail("server_error", "Could not update cart. Please try again.");
      }
    } else {
      const { error } = await admin
        .from("cart_items")
        .insert({ cart_id: cartId, variant_id: variantId, quantity });
      if (error) {
        return fail("server_error", "Could not add to cart. Please try again.");
      }
    }

    // 4. Compute new total item count for the badge
    const { data: countRows } = await admin
      .from("cart_items")
      .select("quantity")
      .eq("cart_id", cartId);
    const itemCount = (countRows ?? []).reduce(
      (sum, row) => sum + (row.quantity ?? 0),
      0
    );

    revalidatePath("/cart");
    revalidatePath("/", "layout"); // cart badge in nav
    return ok({ cartId, itemCount });
  } catch (err) {
    console.error("[addToCart] unexpected error", err);
    return fail("server_error", "Something went wrong. Please try again.");
  }
}

// ── updateCartItem ───────────────────────────────────────────────────────────

const updateSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

export async function updateCartItem(input: {
  itemId: string;
  quantity: number;
}): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { itemId, quantity } = parsed.data;

  try {
    const owner = await resolveOwnership(false);
    const admin = createServiceRoleClient();

    // Verify the item belongs to the caller's cart
    const { data: item, error: itemErr } = await admin
      .from("cart_items")
      .select("id, cart_id, variant_id, carts!inner(user_id, session_token), product_variants!inner(stock_quantity)")
      .eq("id", itemId)
      .single();
    if (itemErr || !item) {
      return fail("not_found", "Item not found.");
    }
    const cart = (item as { carts: { user_id: string | null; session_token: string | null } }).carts;
    const variant = (item as { product_variants: { stock_quantity: number } }).product_variants;

    const isOwnedByCaller =
      (owner.type === "user" && cart.user_id === owner.userId) ||
      (owner.type === "guest" && cart.session_token === owner.token);
    if (!isOwnedByCaller) {
      return fail("forbidden", "You don't have access to this cart item.");
    }

    if (quantity > variant.stock_quantity) {
      return fail(
        "insufficient_stock",
        variant.stock_quantity === 0
          ? "This item is out of stock."
          : `Only ${variant.stock_quantity} left in stock.`
      );
    }

    const { error } = await admin
      .from("cart_items")
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (error) {
      return fail("server_error", "Could not update cart. Please try again.");
    }

    revalidatePath("/cart");
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (err) {
    console.error("[updateCartItem] unexpected error", err);
    return fail("server_error", "Something went wrong. Please try again.");
  }
}

// ── removeCartItem ───────────────────────────────────────────────────────────

const removeSchema = z.object({ itemId: z.string().uuid() });

export async function removeCartItem(input: {
  itemId: string;
}): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation_error", "Invalid input");
  }
  const { itemId } = parsed.data;

  try {
    const owner = await resolveOwnership(false);
    const admin = createServiceRoleClient();

    const { data: item } = await admin
      .from("cart_items")
      .select("id, carts!inner(user_id, session_token)")
      .eq("id", itemId)
      .single();
    if (!item) {
      // Idempotent: deleting an already-deleted item is a no-op
      revalidatePath("/cart");
      revalidatePath("/", "layout");
      return ok(undefined);
    }
    const cart = (item as { carts: { user_id: string | null; session_token: string | null } }).carts;

    const isOwnedByCaller =
      (owner.type === "user" && cart.user_id === owner.userId) ||
      (owner.type === "guest" && cart.session_token === owner.token);
    if (!isOwnedByCaller) {
      return fail("forbidden", "You don't have access to this cart item.");
    }

    const { error } = await admin.from("cart_items").delete().eq("id", itemId);
    if (error) {
      return fail("server_error", "Could not remove item. Please try again.");
    }

    revalidatePath("/cart");
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (err) {
    console.error("[removeCartItem] unexpected error", err);
    return fail("server_error", "Something went wrong. Please try again.");
  }
}

// ── mergeGuestCart ───────────────────────────────────────────────────────────
// Called from the post-login flow. Takes the guest cart_items and merges
// them into the user's cart. Then deletes the guest cart and clears the
// session cookie.

export async function mergeGuestCart(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return fail("unauthenticated", "Must be logged in to merge cart.");
    }

    const guestToken = await getGuestSessionToken();
    if (!guestToken) {
      return ok(undefined); // nothing to merge
    }

    const admin = createServiceRoleClient();

    // 1. Find guest cart
    const { data: guestCart } = await admin
      .from("carts")
      .select("id")
      .eq("session_token", guestToken)
      .maybeSingle();
    if (!guestCart) {
      await clearGuestSessionToken();
      return ok(undefined);
    }

    // 2. Get or create the user's cart
    const userCartId = await getOrCreateCart({
      type: "user",
      userId: user.id,
    });

    // 3. Fetch guest items
    const { data: guestItems } = await admin
      .from("cart_items")
      .select("variant_id, quantity")
      .eq("cart_id", guestCart.id);

    if (guestItems && guestItems.length > 0) {
      for (const gi of guestItems) {
        // Check stock for the variant
        const { data: variant } = await admin
          .from("product_variants")
          .select("stock_quantity")
          .eq("id", gi.variant_id)
          .single();
        if (!variant) continue;

        // Upsert into the user cart
        const { data: existing } = await admin
          .from("cart_items")
          .select("id, quantity")
          .eq("cart_id", userCartId)
          .eq("variant_id", gi.variant_id)
          .maybeSingle();

        const desiredQty = (existing?.quantity ?? 0) + gi.quantity;
        const finalQty = Math.min(desiredQty, variant.stock_quantity);
        if (finalQty <= 0) continue;

        if (existing) {
          await admin
            .from("cart_items")
            .update({ quantity: finalQty, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await admin.from("cart_items").insert({
            cart_id: userCartId,
            variant_id: gi.variant_id,
            quantity: finalQty,
          });
        }
      }
    }

    // 4. Delete the guest cart (cascades to its items) and clear cookie
    await admin.from("carts").delete().eq("id", guestCart.id);
    await clearGuestSessionToken();

    revalidatePath("/cart");
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (err) {
    console.error("[mergeGuestCart] unexpected error", err);
    return fail("server_error", "Could not merge cart. Please try again.");
  }
}