# FemFit Database Schema Document

**Version:** 1.0
**Engine:** PostgreSQL 15+ on Supabase
**Status:** Authoritative reference for all data model decisions

---

## 1. Design Principles

- **Normalize for write integrity.** Snapshot historical data on orders.
- **Money as integers, smallest unit.** USD as cents, KHR as riels. **Never floats.**
- **UUIDs as primary keys.** Avoid enumeration attacks.
- **All timestamps timestamptz.** Stored in UTC.
- **Append-only event tables for audit.** `payment_events`, `inventory_movements`, `shipment_events`.
- **Soft delete where audit matters.** Products use `deleted_at`; cart items hard-delete.
- **Foreign key behavior is explicit.** CASCADE owns, RESTRICT financial, SET NULL catalog.
- **Every user-owned table has user_id.** Enables RLS.
- **Idempotency is built in.** Unique constraints on idempotency keys.
- **Indexes follow query patterns.** Each index has a documented query.

---

## 2. Naming Conventions

| Object | Convention | Example |
|---|---|---|
| Table | snake_case, plural | products, order_items |
| Column | snake_case, singular | user_id, created_at |
| Primary key | id (uuid) | id uuid primary key |
| Foreign key | `<table_singular>_id` | user_id, product_id |
| Timestamp | `<verb>_at` | created_at, paid_at |
| Boolean | `is_<adjective>` | is_active, is_admin |
| Money | `<purpose>_cents` | subtotal_cents, total_cents |
| Enum type | `<noun>_<purpose>` | order_status |
| Index | `idx_<table>_<columns>` | idx_orders_user |

---

## 3. Data Types & Patterns

| Use Case | Type |
|---|---|
| Primary keys | uuid |
| Money amounts | integer (cents/riels) |
| Quantities | integer with CHECK >= 0 |
| Phone numbers | text in E.164 (+85512345678) |
| Timestamps | timestamptz |
| JSON payloads | jsonb |
| Status fields | enum types |

### Soft Delete vs Hard Delete

| Table | Policy | Reason |
|---|---|---|
| products | Soft delete (deleted_at) | Must survive in historical orders |
| product_variants | Hard delete (CASCADE) | Tied to product lifecycle |
| users / profiles | Soft delete on request | PDPL compliance |
| addresses | Hard delete | Order snapshots address |
| cart_items | Hard delete | Transient |
| orders | Never delete | Financial record |
| payments | Never delete | Financial record |
| Event tables | Never delete | Audit trail |

---

## 4. Schema (DDL)

### 4.1 Extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
```

### 4.2 profiles

```sql
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  phone               text unique not null,
  email               text unique,
  full_name           text,
  preferred_currency  text not null default 'USD'
                      check (preferred_currency in ('USD','KHR')),
  is_admin            boolean not null default false,
  is_blocked_cod      boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index idx_profiles_phone on public.profiles(phone);
```

### 4.3 addresses

```sql
create table public.addresses (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  recipient_name  text not null,
  phone           text not null,
  province        text not null,
  district        text not null,
  commune         text,
  village         text,
  street_detail   text,
  landmark        text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_addresses_user_id on public.addresses(user_id);
create unique index idx_addresses_one_default
  on public.addresses(user_id) where is_default = true;
```

Cambodian addresses follow province → district → commune → village. `landmark` is essential for courier delivery.

### 4.4 categories

```sql
create table public.categories (
  id          uuid primary key default uuid_generate_v4(),
  parent_id   uuid references public.categories(id) on delete set null,
  slug        text unique not null,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
```

### 4.5 products

```sql
create table public.products (
  id                     uuid primary key default uuid_generate_v4(),
  sku                    text unique not null,
  slug                   text unique not null,
  category_id            uuid references public.categories(id) on delete set null,
  name                   text not null,
  description            text,
  base_price_cents       integer not null check (base_price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents >= 0),
  currency               text not null default 'USD'
                         check (currency in ('USD','KHR')),
  is_active              boolean not null default true,
  is_featured            boolean not null default false,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(description,'')), 'B')
  ) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index idx_products_search on public.products using gin(search_vector);
create index idx_products_category on public.products(category_id)
  where is_active = true and deleted_at is null;
create index idx_products_featured on public.products(is_featured)
  where is_featured = true and is_active = true;
```

`search_vector` is a generated column; Postgres maintains it on insert/update. Name weighted higher than description.

### 4.6 product_variants

```sql
create table public.product_variants (
  id             uuid primary key default uuid_generate_v4(),
  product_id     uuid not null references public.products(id) on delete cascade,
  sku            text unique not null,
  size           text,
  color          text,
  price_cents    integer check (price_cents >= 0),  -- null = inherit
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_variants_product on public.product_variants(product_id);
create unique index idx_variants_unique_combo
  on public.product_variants(product_id, coalesce(size,''), coalesce(color,''));
```

`price_cents` nullable means inherit from product. `stock_quantity CHECK >= 0` prevents negative stock at DB level (in addition to application-level `SELECT FOR UPDATE`).

### 4.7 product_images

```sql
create table public.product_images (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid references public.product_variants(id) on delete cascade,
  url         text not null,
  alt_text    text,
  sort_order  integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_images_product on public.product_images(product_id);
```

### 4.8 carts and cart_items

```sql
create table public.carts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade,
  session_token text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint cart_owner_check check (
    (user_id is not null) or (session_token is not null)
  )
);

create table public.cart_items (
  id         uuid primary key default uuid_generate_v4(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, variant_id)
);
```

`cart_owner_check`: every cart must belong to a user OR a guest session. `unique(cart_id, variant_id)`: same variant cannot appear twice; quantity is incremented.

### 4.9 Order Enums

```sql
create type order_status as enum (
  'pending_payment',
  'confirmed',
  'packing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded'
);

create type payment_method as enum ('aba_pay', 'khqr', 'card', 'cod');
```

### 4.10 orders

```sql
create table public.orders (
  id                      uuid primary key default uuid_generate_v4(),
  order_number            text unique not null,
  user_id                 uuid references public.profiles(id) on delete set null,
  status                  order_status not null default 'pending_payment',

  -- Pricing (cents)
  subtotal_cents          integer not null check (subtotal_cents >= 0),
  shipping_fee_cents      integer not null default 0 check (shipping_fee_cents >= 0),
  discount_cents          integer not null default 0 check (discount_cents >= 0),
  total_cents             integer not null check (total_cents >= 0),
  currency                text not null default 'USD'
                          check (currency in ('USD','KHR')),

  payment_method          payment_method not null,

  -- Shipping snapshot
  shipping_recipient      text not null,
  shipping_phone          text not null,
  shipping_province       text not null,
  shipping_district       text not null,
  shipping_commune        text,
  shipping_village        text,
  shipping_street         text,
  shipping_landmark       text,

  -- Logistics
  courier                 text,
  tracking_number         text,
  shipped_at              timestamptz,
  delivered_at            timestamptz,
  estimated_delivery_date date,

  customer_note           text,
  admin_note              text,

  idempotency_key         text unique,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_orders_user on public.orders(user_id, created_at desc);
create index idx_orders_status on public.orders(status, created_at desc);
create index idx_orders_tracking on public.orders(tracking_number)
  where tracking_number is not null;
create index idx_orders_pending_payment on public.orders(created_at)
  where status = 'pending_payment';
```

`order_number` is human-readable (`FF-2026-000123`); `id` is the system identifier. Shipping address is denormalized — snapshot at order time.

### 4.11 order_items

```sql
create table public.order_items (
  id               uuid primary key default uuid_generate_v4(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  variant_id       uuid references public.product_variants(id) on delete set null,

  -- Snapshots
  product_name     text not null,
  variant_label    text,
  sku              text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity         integer not null check (quantity > 0),
  subtotal_cents   integer not null check (subtotal_cents >= 0),

  created_at       timestamptz not null default now()
);

create index idx_order_items_order on public.order_items(order_id);
```

`variant_id ON DELETE SET NULL`: if a variant is deleted, the order line preserves the snapshot.

### 4.12 payments

```sql
create type payment_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'
);

create table public.payments (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references public.orders(id) on delete restrict,
  gateway         text not null,
  gateway_txn_id  text,
  idempotency_key text unique not null,
  status          payment_status not null default 'pending',
  amount_cents    integer not null check (amount_cents >= 0),
  currency        text not null,
  raw_request     jsonb,
  raw_response    jsonb,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_payments_order on public.payments(order_id);
create unique index idx_payments_gateway_txn
  on public.payments(gateway, gateway_txn_id)
  where gateway_txn_id is not null;
create index idx_payments_pending
  on public.payments(created_at)
  where status in ('pending','processing');
```

`ON DELETE RESTRICT`: you cannot delete an order with payment records. Unique index on `(gateway, gateway_txn_id)` prevents duplicate webhook processing.

### 4.13 payment_events (append-only)

```sql
create table public.payment_events (
  id          uuid primary key default uuid_generate_v4(),
  payment_id  uuid not null references public.payments(id) on delete restrict,
  event_type  text not null,
  payload     jsonb not null,
  received_at timestamptz not null default now()
);

create index idx_payment_events_payment
  on public.payment_events(payment_id, received_at);
```

### 4.14 inventory_movements (append-only)

```sql
create table public.inventory_movements (
  id             uuid primary key default uuid_generate_v4(),
  variant_id     uuid not null references public.product_variants(id) on delete restrict,
  change_qty     integer not null,  -- negative for decrement
  reason         text not null check (reason in (
    'sale','return','adjustment','restock','reservation_release'
  )),
  reference_type text,
  reference_id   uuid,
  note           text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

create index idx_inv_movements_variant
  on public.inventory_movements(variant_id, created_at desc);
```

### 4.15 shipment_events (append-only)

```sql
create table public.shipment_events (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  event_type  text not null,
  description text,
  location    text,
  source      text not null check (source in ('manual','api','webhook')),
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now()
);

create index idx_shipment_events_order
  on public.shipment_events(order_id, occurred_at);
```

`source = 'manual'` for ops-entered events at launch.

### 4.16 reviews

```sql
create table public.reviews (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  rating      integer not null check (rating between 1 and 5),
  title       text,
  body        text,
  photo_url   text,
  is_approved boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique(product_id, user_id, order_id)
);

create index idx_reviews_product on public.reviews(product_id)
  where is_approved = true and deleted_at is null;
create index idx_reviews_pending on public.reviews(created_at)
  where is_approved = false and deleted_at is null;
```

`unique(product_id, user_id, order_id)`: one review per user per product per order.

### 4.17 coupons

```sql
create table public.coupons (
  id              uuid primary key default uuid_generate_v4(),
  code            text unique not null,
  discount_type   text not null check (discount_type in ('percent','fixed')),
  discount_value  integer not null check (discount_value > 0),
  min_order_cents integer not null default 0,
  max_uses        integer,
  used_count      integer not null default 0,
  starts_at       timestamptz,
  expires_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index idx_coupons_active_code
  on public.coupons(code) where is_active = true;
```

For `percent`, `discount_value` is a percentage. For `fixed`, it's in cents.

### 4.18 notifications

```sql
create table public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade,
  channel       text not null check (channel in ('sms','email','push')),
  template      text not null,
  recipient     text not null,
  payload       jsonb,
  status        text not null default 'pending'
                check (status in ('pending','sent','failed')),
  external_id   text,
  error_message text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_notifications_user
  on public.notifications(user_id, created_at desc);
create index idx_notifications_pending
  on public.notifications(created_at) where status = 'pending';
```

### 4.19 idempotency_keys

```sql
create table public.idempotency_keys (
  key        text primary key,
  user_id    uuid references public.profiles(id) on delete cascade,
  endpoint   text not null,
  response   jsonb,
  status     integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index idx_idempotency_expires
  on public.idempotency_keys(expires_at);
```

### 4.20 Update Trigger

```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all tables with updated_at:
-- profiles, addresses, products, product_variants, carts, cart_items,
-- orders, payments, reviews
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.touch_updated_at();
-- ... repeat for each table
```

---

## 5. Indexing Principles

- Every FK has a supporting index.
- Composite indexes match query patterns: `(user_id, created_at desc)`.
- Partial indexes for consistent filters: `WHERE is_active = true`.
- GIN for `tsvector` (full-text search) and JSONB.
- Unique indexes enforce business invariants.
- No redundant indexes — composite (a, b) makes single (a) unnecessary.

---

## 6. Row-Level Security

Every user-owned table has RLS. Pattern:

```sql
alter table public.orders enable row level security;

create policy orders_select_own on public.orders
  for select using (auth.uid() = user_id);

create policy orders_insert_own on public.orders
  for insert with check (auth.uid() = user_id);

create policy orders_admin_all on public.orders
  for all using (
    exists (select 1 from public.profiles
            where id = auth.uid() and is_admin = true)
  );
```

| Table | Customer | Admin |
|---|---|---|
| profiles | Own row only | All |
| addresses | Own only | All |
| products | Read (active) | All |
| carts, cart_items | Own only | All |
| orders, order_items | Own only | All |
| payments | Read own (no write) | All |
| payment_events | None | Read |
| reviews | Read approved + own; insert own | All |
| notifications | Own only | Read all |

Service role bypasses RLS for webhooks, reconciliation, background jobs.

---

## 7. Migration Strategy

- **Tool:** Drizzle Kit generates SQL from TypeScript schema.
- **Storage:** `/db/migrations/` in repo, timestamp-prefixed.
- **Run order:** Migrations run BEFORE new app version switches.
- **Breaking changes:** Use **Expand → Migrate → Contract** pattern:
  1. **Expand:** Add new columns alongside old. App writes both.
  2. **Migrate:** Backfill. App reads new, writes both.
  3. **Contract:** App uses only new. Drop old.

---

## 8. Performance

- Stock decrement: `SELECT ... FOR UPDATE` inside transaction.
- Webhook deduplication: unique index on `(gateway, gateway_txn_id)`.
- Idempotent order creation: unique constraint on `idempotency_key`.
- UUIDs avoid sequential write hot spots.
- Catalog reads cached at Vercel edge.

---

## 9. Capacity Planning (3 years)

| Table | Estimated Total |
|---|---|
| profiles | 100 MB |
| orders | 110 MB |
| order_items | 66 MB |
| payments | 250 MB |
| payment_events | 500 MB |
| notifications | 200 MB |
| **DB total** | **~2 GB** |

Fits comfortably in Supabase Pro (8 GB) for 3 years.
