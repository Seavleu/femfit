"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  orders,
  orderItems,
  cartItems,
  productVariants,
  products,
  inventoryMovements,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { withIdempotency, IdempotencyConflictError } from "@/lib/api/idempotency";
import { PROBLEMS, type ProblemDetail } from "@/lib/api/errors";
import {
  checkoutSchema,
  getShippingCents,
  type CheckoutInput,
} from "@/lib/orders/schema";
import { getCurrentCartId } from "@/lib/cart/queries";
import { formatMoney } from "@/lib/catalog/money";

/**
 * Order creation — the most critical server action in the application.
 *
 * Per Sys Design §8.1–8.4 and API Spec §7.2:
 *
 * 1. Validate input (Zod) — API Spec §7.1
 * 2. Authenticate user — must be logged in for checkout
 * 3. Check Idempotency-Key — Sys Design §9.3
 * 4. Load cart items
 * 5. Inside a SERIALIZABLE transaction:
 *    a. SELECT FOR UPDATE on each product_variant — Sys Design §6.2
 *    b. Verify stock >= requested quantity
 *    c. Snapshot product_name, sku, unit_price_cents → order_items — DB Schema §6.7
 *    d. Decrement stock_quantity on variants
 *    e. INSERT inventory_movements with reason='sale' — DB Schema §6.9
 *    f. INSERT order + order_items
 * 6. Clear the cart
 * 7. Return order confirmation
 *
 * COD path: order.status starts at 'confirmed' (no payment wait).
 * ABA path: order.status starts at 'pending_payment' (implemented in Week 6).
 */

export type CreateOrderResult =
  | { ok: true; data: OrderConfirmation }
  | { ok: false; error: ProblemDetail };

export interface OrderConfirmation {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  subtotalDisplay: string;
  shippingDisplay: string;
  totalDisplay: string;
  itemCount: number;
  shippingAddress: {
    fullName: string;
    phone: string;
    province: string;
    district: string;
    street: string;
  };
}

export async function createOrder(
  input: CheckoutInput
): Promise<CreateOrderResult> {
  // ── 1. Validate ──────────────────────────────────────────────────────
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: PROBLEMS.validation(
        parsed.error.issues[0]?.message ?? "Invalid input",
        parsed.error.issues
      ),
    };
  }
  const { paymentMethod, shippingAddress, idempotencyKey } = parsed.data;

  // ── 2. Authenticate ──────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: PROBLEMS.unauthorized("Must be logged in to checkout.") };
  }

  // ── 3. Idempotency ──────────────────────────────────────────────────
  try {
    const result = await withIdempotency<OrderConfirmation>(
      idempotencyKey,
      user.id,
      "POST /api/v1/orders",
      async () => {
        const confirmation = await executeOrderCreation(
          user.id,
          paymentMethod,
          shippingAddress
        );
        return { data: confirmation, status: 201 };
      }
    );

    if (result.replayed) {
      // Return the cached response from the original request
      return { ok: true, data: result.data };
    }

    revalidatePath("/cart");
    revalidatePath("/", "layout");
    return { ok: true, data: result.data };
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return { ok: false, error: PROBLEMS.conflict(err.message) };
    }
    console.error("[createOrder] unexpected error", err);
    return {
      ok: false,
      error: PROBLEMS.serverError("Order creation failed. Please try again."),
    };
  }
}

// ── Core transactional logic ────────────────────────────────────────────────

async function executeOrderCreation(
  userId: string,
  paymentMethod: string,
  address: CheckoutInput["shippingAddress"]
): Promise<OrderConfirmation> {
  // Load the user's cart
  const cartId = await getCurrentCartId();
  if (!cartId) {
    throw new OrderError("Your cart is empty.");
  }

  // Load cart items with product/variant data for the snapshot
  const cartRows = await db
    .select({
      itemId: cartItems.id,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      variantPriceCents: productVariants.priceCents,
      stockQuantity: productVariants.stockQuantity,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      isActive: productVariants.isActive,
      productId: products.id,
      productName: products.name,
      basePriceCents: products.basePriceCents,
      currency: products.currency,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(cartItems.cartId, cartId));

  if (cartRows.length === 0) {
    throw new OrderError("Your cart is empty.");
  }

  // All items must use the same currency (USD for v1)
  const currency = cartRows[0].currency;

  // Calculate totals before the transaction for display
  const subtotalCents = cartRows.reduce((sum, r) => {
    const unitPrice = r.variantPriceCents ?? r.basePriceCents;
    return sum + unitPrice * r.quantity;
  }, 0);
  const shippingCents = getShippingCents(address.province);
  const totalCents = subtotalCents + shippingCents;

  // Generate order number: FF-YYYY-XXXXXX
  const year = new Date().getFullYear();
  const seq = Math.floor(100000 + Math.random() * 900000); // 6-digit random
  const orderNumber = `FF-${year}-${seq}`;

  // COD orders go straight to "confirmed" — no payment pending.
  // ABA orders would start at "pending_payment" (Week 6 milestone).
  const initialStatus = paymentMethod === "cod" ? "confirmed" : "pending_payment";

  // ── Transaction with SELECT FOR UPDATE ────────────────────────────

  const result = await db.transaction(async (tx) => {
    // a. Lock each variant row and verify stock
    for (const row of cartRows) {
      // SELECT FOR UPDATE — per Sys Design §6.2
      const [locked] = await tx
        .select({
          id: productVariants.id,
          stockQuantity: productVariants.stockQuantity,
          isActive: productVariants.isActive,
          sku: productVariants.sku,
        })
        .from(productVariants)
        .where(eq(productVariants.id, row.variantId))
        .for("update");

      if (!locked) {
        throw new OrderError(`Product variant ${row.sku} is no longer available.`);
      }
      if (!locked.isActive) {
        throw new OrderError(`${row.productName} (${row.sku}) has been discontinued.`);
      }
      if (locked.stockQuantity < row.quantity) {
        throw new OrderError(
          locked.stockQuantity === 0
            ? `${row.productName} (${row.sku}) is out of stock.`
            : `Only ${locked.stockQuantity} of ${row.productName} (${row.sku}) left in stock.`
        );
      }
    }

    // b. Create the order with denormalized shipping address
    const [order] = await tx
      .insert(orders)
      .values({
        userId,
        orderNumber,
        status: initialStatus,
        paymentMethod,
        subtotalCents,
        shippingCents,
        totalCents,
        currency,
        shippingFullName: address.fullName,
        shippingPhone: address.phone,
        shippingProvince: address.province,
        shippingDistrict: address.district,
        shippingCommune: address.commune ?? null,
        shippingStreet: address.street,
        shippingNotes: address.notes ?? null,
      })
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    // c. Snapshot product data into order_items — DB Schema §6.7
    for (const row of cartRows) {
      const unitPriceCents = row.variantPriceCents ?? row.basePriceCents;

      await tx.insert(orderItems).values({
        orderId: order.id,
        variantId: row.variantId,
        productName: row.productName,
        sku: row.sku,
        unitPriceCents,
        quantity: row.quantity,
      });
    }

    // d. Decrement stock and write inventory_movements
    for (const row of cartRows) {
      // Decrement stock_quantity
      await tx
        .update(productVariants)
        .set({
          stockQuantity: sql`${productVariants.stockQuantity} - ${row.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, row.variantId));

      // Append-only inventory_movements — DB Schema §6.9
      await tx.insert(inventoryMovements).values({
        variantId: row.variantId,
        changeQty: -row.quantity,
        reason: "sale",
        referenceId: order.id,
        referenceType: "order",
        note: `Order ${orderNumber}`,
      });
    }

    return order;
  });

  // ── Post-transaction: clear the cart ──────────────────────────────

  const admin = createServiceRoleClient();
  await admin.from("cart_items").delete().eq("cart_id", cartId);

  // Compute item count for confirmation display
  const itemCount = cartRows.reduce((sum, r) => sum + r.quantity, 0);

  return {
    orderId: result.id,
    orderNumber: result.orderNumber,
    status: initialStatus,
    paymentMethod,
    subtotalCents,
    shippingCents,
    totalCents,
    currency,
    subtotalDisplay: formatMoney(subtotalCents, currency).display,
    shippingDisplay: formatMoney(shippingCents, currency).display,
    totalDisplay: formatMoney(totalCents, currency).display,
    itemCount,
    shippingAddress: {
      fullName: address.fullName,
      phone: address.phone,
      province: address.province,
      district: address.district,
      street: address.street,
    },
  };
}

class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}