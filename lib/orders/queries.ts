import { db } from "@/db";
import { orders, orderItems, productVariants, productImages, products } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { formatMoney } from "@/lib/catalog/money";

/**
 * Order queries — used by the confirmation page and future
 * account/order-history pages.
 *
 * Per RLS policies: customers can only see their own orders.
 * These queries run server-side via Drizzle (bypassing RLS via
 * the direct DB connection). The caller must verify ownership.
 */

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  subtotalDisplay: string;
  shippingDisplay: string;
  totalDisplay: string;
  currency: string;
  createdAt: Date;
  shippingAddress: {
    fullName: string;
    phone: string;
    province: string;
    district: string;
    commune: string | null;
    street: string;
    notes: string | null;
  };
  items: OrderItemDetail[];
}

export interface OrderItemDetail {
  id: string;
  productName: string;
  sku: string;
  unitPriceDisplay: string;
  quantity: number;
  lineTotalDisplay: string;
  imageUrl: string | null;
  slug: string | null;
}

/**
 * Load a single order by ID, including items with image URLs.
 * Returns null if not found or not owned by the given user.
 */
export async function getOrderById(
  orderId: string,
  userId: string
): Promise<OrderDetail | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select({
      id: orderItems.id,
      productName: orderItems.productName,
      sku: orderItems.sku,
      unitPriceCents: orderItems.unitPriceCents,
      quantity: orderItems.quantity,
      variantId: orderItems.variantId,
      imageUrl: productImages.url,
      slug: products.slug,
    })
    .from(orderItems)
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true)
      )
    )
    .where(eq(orderItems.orderId, orderId));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotalDisplay: formatMoney(order.subtotalCents, order.currency).display,
    shippingDisplay: formatMoney(order.shippingCents, order.currency).display,
    totalDisplay: formatMoney(order.totalCents, order.currency).display,
    currency: order.currency,
    createdAt: order.createdAt,
    shippingAddress: {
      fullName: order.shippingFullName,
      phone: order.shippingPhone,
      province: order.shippingProvince,
      district: order.shippingDistrict,
      commune: order.shippingCommune,
      street: order.shippingStreet,
      notes: order.shippingNotes,
    },
    items: items.map((item) => {
      const lineTotal = item.unitPriceCents * item.quantity;
      return {
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        unitPriceDisplay: formatMoney(item.unitPriceCents, order.currency).display,
        quantity: item.quantity,
        lineTotalDisplay: formatMoney(lineTotal, order.currency).display,
        imageUrl: item.imageUrl,
        slug: item.slug,
      };
    }),
  };
}