# FemFit System Design Document

**Version:** 1.0
**Status:** Draft for Engineering Review
**Date:** June 2026

---

## 1. Introduction

### 1.1 Purpose

High-level system design for FemFit. Complements the PRD which defines *what*; this defines *how*.

### 1.2 Design Principles

- **Boring technology wins.** Postgres, Next.js, well-understood tools.
- **Modular monolith before microservices.** Split only when team and traffic justify it.
- **Mobile-first, 4G-realistic.** Judged on mid-range Android over metered connection.
- **Correctness over scale.** Money, inventory, orders must be correct.
- **Defer cost until justified.** Free tiers aggressively.
- **Design for next 18 months, not 18 years.** Avoid premature abstraction.

---

## 2. Architecture Overview

```
                  +---------------------------------------+
                  |   Cambodian Customers (Web + Mobile)  |
                  +-------------------+-------------------+
                                      |
                                      v
                  +---------------------------------------+
                  |       Cloudflare (CDN / WAF / DNS)    |
                  +-------------------+-------------------+
                                      |
                                      v
                  +---------------------------------------+
                  |   Vercel  (Next.js 15 - Singapore)    |
                  |   - Storefront (RSC)                  |
                  |   - Admin Panel (role-gated)          |
                  |   - API Routes  (/api/v1/*)           |
                  +---+---------------+----------------+--+
                      |               |                |
                      v               v                v
              +-------------+  +-------------+  +-------------+
              |  Supabase   |  | ABA PayWay  |  | SMS / Email |
              | Postgres+   |  | Webhooks    |  | Resend +    |
              | Auth+Storage|  |             |  | SMS gateway |
              +-------------+  +-------------+  +-------------+
```

### 2.1 Architectural Style

**Modular monolith.** Single Next.js application with clear internal boundaries mapping to bounded contexts (catalog, cart, orders, payments, notifications). Future service extraction is possible without rewrites.

### 2.2 Why This Architecture

- **Latency:** Singapore = ~40ms RTT to Cambodia.
- **Cost:** Free tiers keep launch infra under $25/month.
- **Velocity:** One repo, one deploy, one set of env vars.
- **Reliability:** Managed services handle backups, scaling, uptime.

---

## 3. Technology Stack

| Layer | Choice |
|---|---|
| Web framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (strict) |
| UI styling | Tailwind CSS + shadcn/ui |
| Forms / validation | React Hook Form + Zod |
| Data fetching | RSC + TanStack Query |
| Backend runtime | Next.js API Routes |
| ORM | Drizzle ORM |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (phone OTP) |
| Object storage | Supabase Storage → R2 at scale |
| Search | Postgres full-text search |
| Hosting | Vercel (Singapore region) |
| CDN / WAF / DNS | Cloudflare (free tier) |
| Email | Resend |
| SMS | Twilio → local provider |
| Payments | ABA PayWay + COD |
| Error tracking | Sentry (free tier) |
| Analytics | PostHog + Cloudflare Analytics |
| CI / CD | GitHub + Vercel auto-deploy |

### 3.1 Explicit Rejections

| Rejected | Reason |
|---|---|
| Microservices | Overhead with no benefit at this scale |
| Kubernetes | Vercel/Railway abstract infra adequately |
| GraphQL | REST + TypeScript types is simpler |
| Redux / Zustand | RSC + URL state + TanStack Query suffice |
| Native mobile | PWA sufficient for v1 |
| Elasticsearch | Postgres FTS handles 5,000 SKUs |
| Message broker (Kafka, RabbitMQ) | No async scale yet |
| MongoDB | Wrong model for relational e-commerce |
| Self-hosted Postgres on VPS | Time savings of managed > dollar savings |

---

## 4. Capacity Estimation

**Inputs:**
- 1,000 MAU at launch; 10,000 MAU at 18 months
- 15 searches, 20 page views, 0.3 orders per user per month
- Peak factor: 10× average

**Traffic:**

| Metric | Value |
|---|---|
| Searches/month | 15,000 |
| Average search QPS | ~0.006 |
| Peak search QPS | ~0.06 |
| API calls/month | 100,000 |
| Peak API QPS | ~0.4 |

**Storage (3-year horizon):** Database ~2-5 GB; object storage ~40-60 GB.

**Interpretation:** Traffic is modest. Single small server handles peak with substantial headroom. Priorities are payment reliability, mobile UX, and operational simplicity — not throughput.

---

## 5. Logical Architecture

### 5.1 Bounded Contexts

| Module | Responsibilities | Tables |
|---|---|---|
| catalog | Products, variants, categories, search, images | products, product_variants, product_images, categories |
| cart | Cart state, item management | carts, cart_items |
| orders | Order creation, lifecycle, transitions | orders, order_items |
| payments | Payment intents, webhooks, reconciliation | payments, payment_events |
| inventory | Stock tracking, audit | inventory_movements |
| shipping | Courier handoff, tracking, events | shipment_events |
| users | Profile, addresses, preferences | profiles, addresses |
| reviews | Review submission, moderation | reviews |
| notifications | SMS, email delivery and logging | notifications |
| admin | Cross-cutting admin operations | — |

### 5.2 Module Interaction Rules

- Modules communicate via function calls within the same process — no internal HTTP.
- Cross-module data passing uses explicit TypeScript types.
- State changes spanning modules use DB transactions.
- Side effects (SMS, email, courier API) dispatched asynchronously after originating transaction commits.

### 5.3 Folder Structure

```
femfit/
├── app/
│   ├── (storefront)/
│   ├── (admin)/
│   └── api/v1/
├── lib/                  # business logic per bounded context
│   ├── catalog/
│   ├── cart/
│   ├── orders/
│   ├── payments/
│   ├── inventory/
│   ├── shipping/
│   ├── users/
│   ├── notifications/
│   └── shared/
├── components/
│   ├── ui/               # shadcn copy-paste
│   └── features/         # domain components
├── db/
│   ├── schema.ts
│   └── migrations/
└── types/
```

---

## 6. Data Architecture

### 6.1 Key Decisions

- **UUIDs as PKs** — avoid enumeration attacks.
- **Money as integers in smallest unit** — USD cents, KHR riels. Never floats.
- **Snapshot pattern on orders** — `order_items` stores `product_name`, `sku`, `unit_price_cents` at order time.
- **Denormalized shipping address on orders** — survives address changes.
- **Append-only event tables** — `payment_events`, `inventory_movements`, `shipment_events` never UPDATE/DELETE.
- **Row-level security** — every user-owned table enforces `auth.uid() = user_id`.
- **Soft delete only where audit matters** — products use `deleted_at`; cart items hard-delete.
- **All timestamps timestamptz** — UTC storage, display conversion at edge.

### 6.2 Backup & Recovery

- Daily Supabase backups (7-day free, 30-day Pro).
- Monthly logical dump (pg_dump → R2).
- Quarterly restore drill into staging.
- **RPO:** 24 hours at launch (1 hour after PITR upgrade).
- **RTO:** 4 hours.

---

## 7. API Architecture

### 7.1 Conventions

- Base path: `/api/v1`
- HTTPS only, HSTS enforced
- JSON requests/responses
- Bearer JWT from Supabase Auth (1h access, 30d refresh)
- Idempotency-Key on all state-changing writes
- Cursor-based pagination, max 50
- RFC 7807 problem+json on errors
- Cloudflare WAF + per-user rate limits

---

## 8. Critical Flows

### 8.1 Checkout with ABA Pay

```
Customer → Storefront → API → Database → ABA PayWay → SMS
1. POST /orders + Idempotency-Key
2. BEGIN TX; SELECT FOR UPDATE on variants
3. INSERT order, items, payment
4. COMMIT
5. Create ABA payment intent → redirect_url
6. Return {order, redirect_url} to customer
7. Customer pays on ABA hosted page
8. ABA POSTs webhook → verify HMAC → mark paid
9. Enqueue SMS, courier booking
10. Customer receives confirmation SMS
```

### 8.2 Order Placement Transaction

```typescript
async function placeOrder(userId, items, addressId, paymentMethod, idempotencyKey) {
  // 1. Idempotency check
  const existing = await findOrderByIdempotencyKey(idempotencyKey);
  if (existing) return existing;

  return await db.transaction(async (tx) => {
    // 2. Lock variants and verify stock
    const variants = await tx
      .select().from(productVariants)
      .where(inArray(productVariants.id, items.map(i => i.variantId)))
      .for('update');

    for (const item of items) {
      const v = variants.find(x => x.id === item.variantId);
      if (!v || v.stockQuantity < item.quantity) {
        throw new InsufficientStockError(item.variantId);
      }
    }

    // 3. Compute totals
    const totals = computeTotals(items, variants);

    // 4. Decrement stock + audit
    for (const item of items) {
      await tx.update(productVariants)
        .set({ stockQuantity: sql`stock_quantity - ${item.quantity}` })
        .where(eq(productVariants.id, item.variantId));
      await tx.insert(inventoryMovements).values({
        variantId: item.variantId,
        changeQty: -item.quantity,
        reason: 'sale',
      });
    }

    // 5. Create order, items, payment
    const order = await tx.insert(orders).values({...totals, idempotencyKey}).returning();
    await tx.insert(orderItems).values(buildOrderItems(items, variants));
    const payment = await tx.insert(payments).values({orderId: order.id}).returning();

    return { order, payment };
  });
  // After commit: enqueue ABA intent, SMS, etc.
}
```

### 8.3 ABA Webhook Handling

1. ABA POSTs to `/api/v1/webhooks/aba` with payload + signature.
2. Read **raw** body (not parsed) for signature verification.
3. Compute HMAC-SHA512 using shared secret; compare via constant-time.
4. If invalid, return 401. **Never** touch database.
5. Look up payment by `gateway_txn_id` (unique index).
6. If terminal state, return 200 (idempotent).
7. Insert into `payment_events` (append-only).
8. Update payment + order status in transaction.
9. Enqueue side effects: SMS, courier booking, email.
10. Return 200 within 5 seconds.

### 8.4 Order State Machine

```
pending_payment → confirmed → packing → shipped → delivered → returned → refunded
       ↓             ↓           ↓                    ↓
   cancelled     cancelled   cancelled             refunded
```

Valid transitions are enforced server-side. Anything else is rejected.

---

## 9. Cross-Cutting Concerns

### 9.1 Security

| Concern | Approach |
|---|---|
| Transport | TLS via Cloudflare + HSTS |
| Auth | Phone OTP via Supabase Auth; JWTs in Authorization header |
| Authorization | Postgres RLS + admin role check in middleware |
| Input validation | Zod schemas at every API route |
| SQL injection | Parameterized queries via Drizzle |
| XSS | React auto-escape; CSP header |
| CSRF | JWT in Authorization header (not cookies) |
| Secrets | Vercel env vars; rotated quarterly |
| Webhook security | HMAC-SHA512 with constant-time compare |
| Rate limiting | Cloudflare WAF + per-user limits |
| Audit | Append-only tables for payments, inventory, shipments |

### 9.2 Observability

- **Logging:** Structured JSON via Pino → Vercel logs. Every log has `request_id` + `user_id`.
- **Errors:** Sentry with stack traces and breadcrumbs.
- **Metrics:** Cloudflare Analytics + PostHog.
- **Uptime:** UptimeRobot pings `/api/health` every 5 min.

### 9.3 Reliability

- Idempotency on all writes.
- Exponential backoff retries with jitter.
- Graceful degradation: ABA down → show COD only.
- Reconciliation job every 5 min sweeps pending payments.
- Reservation timeout: orders stuck > 15 min are cancelled, stock returned.

---

## 10. Scaling Strategy

### Stage 1: Launch (0–1,000 MAU)
- Single Next.js app on Vercel
- Supabase free tier
- No Redis, no queue
- Focus: UX, payments, ops workflow

### Stage 2: Early Growth (1,000–10,000 MAU)
- Supabase Pro
- Read replica when CPU > 60% sustained
- Add Upstash Redis (rate limit + hot product cache)
- Move async work to QStash or Inngest
- Migrate images to Cloudflare R2

### Stage 3: Scale (10,000+ MAU)
- Extract Payments and Notifications into services
- Meilisearch for typo tolerance / Khmer
- Cross-region DR replica
- OpenTelemetry distributed tracing

### Never (until justified)
- Microservices on day one
- Kubernetes
- Multi-region active-active
- DB sharding

---

## 11. Cost Projection

### Launch (Stage 1)

| Item | Monthly |
|---|---|
| Vercel Pro | $20 |
| Supabase, Cloudflare, Resend, Sentry, PostHog, UptimeRobot | $0 (free tiers) |
| SMS (variable, ~300/mo via Twilio) | ~$20 |
| Domain | ~$1 |
| **Total** | **~$40** |

Plus ABA fees ~2.5% per transaction.

### Stage 2: ~$90/month
### Stage 3: ~$370/month

---

## 12. Deployment

- GitHub → Vercel auto-deploy on push to `main`.
- PR previews automatic.
- DB migrations run before app switches.
- Backward compatibility via Expand → Migrate → Contract.
- Rollback via Vercel one-click.

---

## Glossary

- **RSC** — React Server Components
- **RLS** — Row-Level Security
- **FTS** — Full-Text Search
- **HMAC** — Hash-based Message Authentication Code
- **IDOR** — Insecure Direct Object Reference
- **RPO** — Recovery Point Objective
- **RTO** — Recovery Time Objective
- **JWT** — JSON Web Token
