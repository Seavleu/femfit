import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

// ---------------------------------------------------------------------------
// Custom types
// ---------------------------------------------------------------------------

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "aba_pay",
  "khqr",
  "card",
  "cod",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
]);

// ---------------------------------------------------------------------------
// 4.2 profiles
// ---------------------------------------------------------------------------

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().notNull(),
    phone: text("phone").unique(),
    email: text("email").unique(),
    fullName: text("full_name"),
    preferredCurrency: text("preferred_currency").notNull().default("USD"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isBlockedCod: boolean("is_blocked_cod").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [authUsers.id],
      name: "profiles_id_fk",
    }).onDelete("cascade"),
    check(
      "profiles_preferred_currency_check",
      sql`${table.preferredCurrency} IN ('USD', 'KHR')`,
    ),
    index("idx_profiles_phone").on(table.phone),
  ],
);

// ---------------------------------------------------------------------------
// 4.3 addresses
// ---------------------------------------------------------------------------

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    province: text("province").notNull(),
    district: text("district").notNull(),
    commune: text("commune"),
    village: text("village"),
    streetDetail: text("street_detail"),
    landmark: text("landmark"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_addresses_user_id").on(table.userId),
    uniqueIndex("idx_addresses_one_default")
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
  ],
);

// ---------------------------------------------------------------------------
// 4.4 categories
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_categories_parent_id").on(table.parentId)],
);

// ---------------------------------------------------------------------------
// 4.5 products
// ---------------------------------------------------------------------------

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull().unique(),
    slug: text("slug").notNull().unique(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    basePriceCents: integer("base_price_cents").notNull(),
    compareAtPriceCents: integer("compare_at_price_cents"),
    currency: text("currency").notNull().default("USD"),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check("products_base_price_cents_check", sql`${table.basePriceCents} >= 0`),
    check(
      "products_compare_at_price_cents_check",
      sql`${table.compareAtPriceCents} IS NULL OR ${table.compareAtPriceCents} >= 0`,
    ),
    check("products_currency_check", sql`${table.currency} IN ('USD', 'KHR')`),
    index("idx_products_category_id").on(table.categoryId),
    index("idx_products_search").using("gin", table.searchVector),
    index("idx_products_category")
      .on(table.categoryId)
      .where(
        sql`${table.isActive} = true AND ${table.deletedAt} IS NULL`,
      ),
    index("idx_products_featured")
      .on(table.isFeatured)
      .where(
        sql`${table.isFeatured} = true AND ${table.isActive} = true`,
      ),
  ],
);

// ---------------------------------------------------------------------------
// 4.6 product_variants
// ---------------------------------------------------------------------------

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    size: text("size"),
    color: text("color"),
    priceCents: integer("price_cents"),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "product_variants_price_cents_check",
      sql`${table.priceCents} IS NULL OR ${table.priceCents} >= 0`,
    ),
    check(
      "product_variants_stock_quantity_check",
      sql`${table.stockQuantity} >= 0`,
    ),
    index("idx_variants_product").on(table.productId),
    uniqueIndex("idx_variants_unique_combo").on(
      table.productId,
      sql`coalesce(${table.size}, '')`,
      sql`coalesce(${table.color}, '')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 4.7 product_images
// ---------------------------------------------------------------------------

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    url: text("url").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_images_product").on(table.productId),
    index("idx_images_variant_id").on(table.variantId),
  ],
);

// ---------------------------------------------------------------------------
// 4.8 carts and cart_items
// ---------------------------------------------------------------------------

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    sessionToken: text("session_token").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "cart_owner_check",
      sql`(${table.userId} IS NOT NULL) OR (${table.sessionToken} IS NOT NULL)`,
    ),
    index("idx_carts_user_id").on(table.userId),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("cart_items_quantity_check", sql`${table.quantity} > 0`),
    index("idx_cart_items_cart_id").on(table.cartId),
    index("idx_cart_items_variant_id").on(table.variantId),
    unique("cart_items_cart_id_variant_id_unique").on(
      table.cartId,
      table.variantId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 4.10 orders
// ---------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull().unique(),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingFeeCents: integer("shipping_fee_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    shippingRecipient: text("shipping_recipient").notNull(),
    shippingPhone: text("shipping_phone").notNull(),
    shippingProvince: text("shipping_province").notNull(),
    shippingDistrict: text("shipping_district").notNull(),
    shippingCommune: text("shipping_commune"),
    shippingVillage: text("shipping_village"),
    shippingStreet: text("shipping_street"),
    shippingLandmark: text("shipping_landmark"),
    courier: text("courier"),
    trackingNumber: text("tracking_number"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    estimatedDeliveryDate: date("estimated_delivery_date"),
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("orders_subtotal_cents_check", sql`${table.subtotalCents} >= 0`),
    check(
      "orders_shipping_fee_cents_check",
      sql`${table.shippingFeeCents} >= 0`,
    ),
    check("orders_discount_cents_check", sql`${table.discountCents} >= 0`),
    check("orders_total_cents_check", sql`${table.totalCents} >= 0`),
    check("orders_currency_check", sql`${table.currency} IN ('USD', 'KHR')`),
    index("idx_orders_user").on(table.userId, table.createdAt.desc()),
    index("idx_orders_status").on(table.status, table.createdAt.desc()),
    index("idx_orders_tracking")
      .on(table.trackingNumber)
      .where(sql`${table.trackingNumber} IS NOT NULL`),
    index("idx_orders_pending_payment")
      .on(table.createdAt)
      .where(sql`${table.status} = 'pending_payment'`),
  ],
);

// ---------------------------------------------------------------------------
// 4.11 order_items
// ---------------------------------------------------------------------------

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label"),
    sku: text("sku").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "order_items_unit_price_cents_check",
      sql`${table.unitPriceCents} >= 0`,
    ),
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
    check("order_items_subtotal_cents_check", sql`${table.subtotalCents} >= 0`),
    index("idx_order_items_order").on(table.orderId),
    index("idx_order_items_variant_id").on(table.variantId),
  ],
);

// ---------------------------------------------------------------------------
// 4.12 payments
// ---------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    gateway: text("gateway").notNull(),
    gatewayTxnId: text("gateway_txn_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    rawRequest: jsonb("raw_request"),
    rawResponse: jsonb("raw_response"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("payments_amount_cents_check", sql`${table.amountCents} >= 0`),
    index("idx_payments_order").on(table.orderId),
    uniqueIndex("idx_payments_gateway_txn")
      .on(table.gateway, table.gatewayTxnId)
      .where(sql`${table.gatewayTxnId} IS NOT NULL`),
    index("idx_payments_pending")
      .on(table.createdAt)
      .where(sql`${table.status} IN ('pending', 'processing')`),
  ],
);

// ---------------------------------------------------------------------------
// 4.13 payment_events (append-only)
// ---------------------------------------------------------------------------

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_payment_events_payment").on(
      table.paymentId,
      table.receivedAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 4.14 inventory_movements (append-only)
// ---------------------------------------------------------------------------

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    changeQty: integer("change_qty").notNull(),
    reason: text("reason").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "inventory_movements_reason_check",
      sql`${table.reason} IN ('sale', 'return', 'adjustment', 'restock', 'reservation_release')`,
    ),
    index("idx_inv_movements_variant").on(
      table.variantId,
      table.createdAt.desc(),
    ),
    index("idx_inv_movements_created_by").on(table.createdBy),
  ],
);

// ---------------------------------------------------------------------------
// 4.15 shipment_events (append-only)
// ---------------------------------------------------------------------------

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    description: text("description"),
    location: text("location"),
    source: text("source").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "shipment_events_source_check",
      sql`${table.source} IN ('manual', 'api', 'webhook')`,
    ),
    index("idx_shipment_events_order").on(table.orderId, table.occurredAt),
  ],
);

// ---------------------------------------------------------------------------
// 4.16 reviews
// ---------------------------------------------------------------------------

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body"),
    photoUrl: text("photo_url"),
    isApproved: boolean("is_approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check("reviews_rating_check", sql`${table.rating} BETWEEN 1 AND 5`),
    unique("reviews_product_user_order_unique").on(
      table.productId,
      table.userId,
      table.orderId,
    ),
    index("idx_reviews_product_id").on(table.productId),
    index("idx_reviews_user_id").on(table.userId),
    index("idx_reviews_order_id").on(table.orderId),
    index("idx_reviews_product")
      .on(table.productId)
      .where(
        sql`${table.isApproved} = true AND ${table.deletedAt} IS NULL`,
      ),
    index("idx_reviews_pending")
      .on(table.createdAt)
      .where(
        sql`${table.isApproved} = false AND ${table.deletedAt} IS NULL`,
      ),
  ],
);

// ---------------------------------------------------------------------------
// 4.17 coupons
// ---------------------------------------------------------------------------

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    discountType: text("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    minOrderCents: integer("min_order_cents").notNull().default(0),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "coupons_discount_type_check",
      sql`${table.discountType} IN ('percent', 'fixed')`,
    ),
    check("coupons_discount_value_check", sql`${table.discountValue} > 0`),
    check("coupons_min_order_cents_check", sql`${table.minOrderCents} >= 0`),
    index("idx_coupons_active_code")
      .on(table.code)
      .where(sql`${table.isActive} = true`),
  ],
);

// ---------------------------------------------------------------------------
// 4.18 notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    channel: text("channel").notNull(),
    template: text("template").notNull(),
    recipient: text("recipient").notNull(),
    payload: jsonb("payload"),
    status: text("status").notNull().default("pending"),
    externalId: text("external_id"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "notifications_channel_check",
      sql`${table.channel} IN ('sms', 'email', 'push')`,
    ),
    check(
      "notifications_status_check",
      sql`${table.status} IN ('pending', 'sent', 'failed')`,
    ),
    index("idx_notifications_user").on(table.userId, table.createdAt.desc()),
    index("idx_notifications_pending")
      .on(table.createdAt)
      .where(sql`${table.status} = 'pending'`),
  ],
);

// ---------------------------------------------------------------------------
// 4.19 idempotency_keys
// ---------------------------------------------------------------------------

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: text("key").primaryKey(),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    endpoint: text("endpoint").notNull(),
    response: jsonb("response"),
    status: integer("status"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .default(sql`now() + interval '24 hours'`)
      .notNull(),
  },
  (table) => [
    index("idx_idempotency_user_id").on(table.userId),
    index("idx_idempotency_expires").on(table.expiresAt),
  ],
);
