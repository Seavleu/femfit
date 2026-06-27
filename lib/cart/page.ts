import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import {
  carts,
  cartItems,
  productVariants,
  products,
  productImages,
} from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getGuestSessionToken } from "@/lib/cart/session";
import { formatMoney, type Money } from "@/lib/catalog/money";

/**
 * Read the current cart owner — either the logged-in user's UUID, or
 * the guest session token. Returns one of two shapes:
 *   { type: 'user', userId }   — authenticated
 *   { type: 'guest', token }   — guest with existing session
 *   { type: 'none' }           — anonymous, no cart yet
 */
export async function getCartOwner(): Promise<
  | { type: "user"; userId: string }
  | { type: "guest"; token: string }
  | { type: "none" }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return { type: "user", userId: user.id };
  }
  const token = await getGuestSessionToken();
  if (token) {
    return { type: "guest", token };
  }
  return { type: "none" };
}

/**
 * Find the current cart row, if one exists. Does not create.
 * Returns null when the user has never added an item.
 */
export async function getCurrentCartId(): Promise<string | null> {
  const owner = await getCartOwner();
  if (owner.type === "none") return null;

  // Always use service-role for cart reads: simpler than splitting between
  // session-client (for users) and service-role (for guests), and the
  // caller-side function already determined ownership.
  const admin = createServiceRoleClient();
  if (owner.type === "user") {
    const { data } = await admin
      .from("carts")
      .select("id")
      .eq("user_id", owner.userId)
      .maybeSingle();
    return data?.id ?? null;
  }
  const { data } = await admin
    .from("carts")
    .select("id")
    .eq("session_token", owner.token)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Cart item count for the nav badge. Returns 0 if no cart yet.
 * Computed as SUM(quantity), not COUNT(*) — per PRD §3.0 supporting reqs.
 */
export async function getCartItemCount(): Promise<number> {
  const cartId = await getCurrentCartId();
  if (!cartId) return 0;

  const [row] = await db
    .select({
      count: sql<number>`coalesce(sum(${cartItems.quantity}), 0)`,
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));

  return Number(row?.count ?? 0);
}

export interface CartLineItem {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string; // "Size M / Black"
  sku: string;
  size: string | null;
  color: string | null;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  stockAvailable: number;
  imageUrl: string | null;
  imageAlt: string | null;
  lineTotal: Money;
  unitPrice: Money;
}

export interface CartView {
  id: string;
  items: CartLineItem[];
  subtotal: Money;
  itemCount: number;
  isEmpty: boolean;
}

/**
 * Load the full cart with items joined to current product/variant data.
 * Returns null if no cart exists.
 *
 * Pricing is LIVE (from the variant or product), not snapshotted.
 * Per Sys Design §6.2: snapshot pattern applies to ORDERS, not carts.
 * Carts always show current prices; the price freeze happens at checkout.
 */
export async function getCartWithItems(): Promise<CartView | null> {
  const cartId = await getCurrentCartId();
  if (!cartId) return null;

  const rows = await db
    .select({
      itemId: cartItems.id,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      stockQuantity: productVariants.stockQuantity,
      size: productVariants.size,
      color: productVariants.color,
      sku: productVariants.sku,
      variantPriceCents: productVariants.priceCents,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      basePriceCents: products.basePriceCents,
      currency: products.currency,
      imageUrl: productImages.url,
      imageAlt: productImages.altText,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true)
      )
    )
    .where(eq(cartItems.cartId, cartId));

  const items: CartLineItem[] = rows.map((r) => {
    const unitPriceCents = r.variantPriceCents ?? r.basePriceCents;
    const variantLabel = [r.size, r.color].filter(Boolean).join(" / ");
    const unitPrice = formatMoney(unitPriceCents, r.currency);
    const lineTotal = formatMoney(unitPriceCents * r.quantity, r.currency);
    return {
      id: r.itemId,
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      productSlug: r.productSlug,
      variantLabel: variantLabel || "Default",
      sku: r.sku,
      size: r.size,
      color: r.color,
      unitPriceCents,
      currency: r.currency,
      quantity: r.quantity,
      stockAvailable: r.stockQuantity,
      imageUrl: r.imageUrl,
      imageAlt: r.imageAlt,
      lineTotal,
      unitPrice,
    };
  });

  // All cart items share a single currency per v1 (USD only). Mixed-currency
  // carts would need extra UX; deferred to v2 when KHR pricing lands.
  const currency = items[0]?.currency ?? "USD";
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cartId,
    items,
    subtotal: formatMoney(subtotalCents, currency),
    itemCount,
    isEmpty: items.length === 0,
  };
}