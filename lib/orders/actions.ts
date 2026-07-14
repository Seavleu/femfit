"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
import { PROBLEMS, problem, type ProblemDetail } from "@/lib/api/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import {
  checkoutSchema,
  getShippingCents,
  shippingAddressSchema,
  type CheckoutInput,
  type ShippingAddress,
} from "@/lib/orders/schema";
import { getCurrentCartId } from "@/lib/cart/queries";
import { formatMoney } from "@/lib/catalog/money";
import { addresses } from "@/db/schema";
import { sendOrderConfirmedEmail, sendOrderCancelledEmail } from "@/lib/notifications/email";

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
  const { paymentMethod, addressId, shippingAddress, customerNote, idempotencyKey } =
    parsed.data;

  // ── 2. Authenticate ──────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: PROBLEMS.unauthorized("Must be logged in to checkout.") };
  }

  // Resolve address_id → snapshot (API Spec §7.2)
  let resolvedAddress: ShippingAddress;
  if (addressId) {
    const [row] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, user.id)))
      .limit(1);
    if (!row) {
      return {
        ok: false,
        error: PROBLEMS.validation("Saved address not found."),
      };
    }
    const street =
      [row.streetDetail, row.village, row.landmark].filter(Boolean).join(", ") ||
      row.district;
    const mapped = {
      fullName: row.recipientName,
      phone: row.phone,
      province: row.province as ShippingAddress["province"],
      district: row.district,
      commune: row.commune ?? undefined,
      street,
      notes: customerNote || undefined,
    };
    const addrParsed = shippingAddressSchema.safeParse(mapped);
    if (!addrParsed.success) {
      return {
        ok: false,
        error: PROBLEMS.validation(
          addrParsed.error.issues[0]?.message ?? "Saved address is incomplete"
        ),
      };
    }
    resolvedAddress = addrParsed.data;
  } else if (shippingAddress) {
    resolvedAddress = {
      ...shippingAddress,
      notes: customerNote || shippingAddress.notes,
    };
  } else {
    return {
      ok: false,
      error: PROBLEMS.validation("Provide a saved address or shipping address."),
    };
  }

  // ── Rate limit: 10 orders/hr per user — Sys Design §9.1 ─────────────
  const rl = await checkRateLimit("orders", user.id, RATE_LIMITS.ordersPerUser);
  if (!rl.allowed) {
    return {
      ok: false,
      error: problem(
        429,
        "rate-limited",
        "Too many orders",
        `Order limit reached. Try again after ${rl.resetAt.toLocaleTimeString()}.`
      ),
    };
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
          resolvedAddress
        );
        return { data: confirmation, status: 201 };
      }
    );

    if (result.replayed) {
      return { ok: true, data: result.data };
    }

    // Fire-and-forget confirmation email (SMS deferred)
    void sendOrderConfirmedEmail({
      userId: user.id,
      orderId: result.data.orderId,
      orderNumber: result.data.orderNumber,
      totalDisplay: result.data.totalDisplay,
    });

    revalidatePath("/cart");
    revalidatePath("/account/orders");
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
  address: ShippingAddress
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
    // Map API payment_method → DB enum (aba_payway → aba_pay until ABA ships)
    const dbPaymentMethod: "cod" | "aba_pay" | "khqr" | "card" =
      paymentMethod === "aba_payway" ? "aba_pay" : "cod";

    const [order] = await tx
      .insert(orders)
      .values({
        userId,
        orderNumber,
        status: initialStatus,
        paymentMethod: dbPaymentMethod,
        subtotalCents,
        shippingFeeCents: shippingCents,
        totalCents,
        currency,
        shippingRecipient: address.fullName,
        shippingPhone: address.phone,
        shippingProvince: address.province,
        shippingDistrict: address.district,
        shippingCommune: address.commune ?? null,
        shippingStreet: address.street,
        customerNote: address.notes ?? null,
      })
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    // c. Snapshot product data into order_items — DB Schema §6.7
    for (const row of cartRows) {
      const unitPriceCents = row.variantPriceCents ?? row.basePriceCents;
      const lineSubtotal = unitPriceCents * row.quantity;

      await tx.insert(orderItems).values({
        orderId: order.id,
        variantId: row.variantId,
        productName: row.productName,
        sku: row.sku,
        unitPriceCents,
        quantity: row.quantity,
        subtotalCents: lineSubtotal,
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

/**
 * Customer-initiated cancel — PRD §8.3 / state machine.
 * Allowed only from pending_payment or confirmed (before packing).
 * Returns stock and marks order cancelled.
 */
export async function cancelOrder(orderId: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const idParsed = z.string().uuid().safeParse(orderId);
  if (!idParsed.success) return { ok: false, error: "Invalid order id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Must be signed in." };

  const admin = createServiceRoleClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, order_number, user_id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return { ok: false, error: "Order not found." };

  const cancellable = ["pending_payment", "confirmed"];
  if (!cancellable.includes(order.status)) {
    return {
      ok: false,
      error: `Cannot cancel an order that is "${order.status.replace(/_/g, " ")}". Contact support if you need help.`,
    };
  }

  try {
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
          note: `Order ${order.order_number} cancelled by customer — stock returned`,
        });
      }
    }

    await admin
      .from("orders")
      .update({
        status: "cancelled",
        admin_note: "Cancelled by customer",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    void sendOrderCancelledEmail({
      userId: user.id,
      orderId,
      orderNumber: order.order_number,
    });

    revalidatePath("/account/orders");
    revalidatePath(`/account/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    console.error("[cancelOrder]", err);
    return { ok: false, error: "Could not cancel order. Please try again." };
  }
}