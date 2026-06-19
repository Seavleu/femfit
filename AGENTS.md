# AGENTS.md — FemFit Engineering Instructions

> This file follows the cross-tool AGENTS.md standard. It is read by Cursor,
> Claude Code, GitHub Copilot, Codex CLI, and most other modern AI coding tools.

## Project Context

FemFit is an English-language e-commerce store selling gymnastic apparel in
Cambodia. Customers are mobile-first (predominantly Android over 4G). The
primary digital payment is ABA PayWay; Cash on Delivery is supported and
expected to account for 40–60% of orders at launch.

Target launch: 8–10 weeks from project kickoff.

For the full picture, read these documents in order:

1. `docs/01-prd.md` — What we're building and why
2. `docs/02-system-design.md` — Architecture and tech stack
3. `docs/03-database-schema.md` — Data model (authoritative)
4. `docs/04-api-spec.md` — API contract (authoritative)
5. `docs/05-runbook.md` — Operations and incident response

When implementing any feature, reference the relevant document above.

## Tech Stack (Non-Negotiable for v1)

- **Framework:** Next.js 15 (App Router) with React 19
- **Language:** TypeScript in strict mode
- **Styling:** Tailwind CSS + shadcn/ui components
- **Forms:** React Hook Form + Zod
- **ORM:** Drizzle ORM
- **Database / Auth / Storage:** Supabase (PostgreSQL 15+)
- **Auth method:** Phone OTP via Supabase Auth
- **Hosting:** Vercel (Singapore region)
- **CDN / WAF / DNS:** Cloudflare
- **Payments:** ABA PayWay (hosted checkout) + Cash on Delivery
- **Email:** Resend
- **SMS:** Twilio at launch, local gateway later
- **Errors:** Sentry
- **Analytics:** PostHog + Cloudflare Analytics

Do not introduce other technologies without explicit approval.

## Hard Rules — Never Violate These

1. **Money is integer cents/riels.** Always. Stored, transmitted, computed.
   - USD as cents (multiply by 100)
   - KHR as riels (no subdivision)
   - Columns end in `_cents` (`subtotal_cents`, `total_cents`, `unit_price_cents`)
   - **Never** use `Number` arithmetic on user-supplied money values. **Never** use floats.
   - API responses use `{ amount, currency, display }` shape.

2. **All write endpoints require `Idempotency-Key` header.**
   - Order creation, payment initiation, address creation, review submission.
   - Server stores key and returns cached response on retry.

3. **Webhook handlers MUST verify HMAC signatures BEFORE any DB write.**
   - Read raw body (not parsed JSON) for signature verification.
   - Use `crypto.timingSafeEqual` for constant-time comparison.
   - Verify timestamp is within 5 minutes (replay protection).
   - On failure: return 401 immediately. Do not touch the database.

4. **Stock decrement uses `SELECT ... FOR UPDATE` inside a transaction.**
   - Order creation, stock check, and decrement all in one atomic block.
   - Prevents oversold inventory under concurrent checkouts.

5. **Order state transitions follow the documented state machine.**
   - See `docs/02-system-design.md` §8.4.
   - Valid: `pending_payment → confirmed → packing → shipped → delivered → returned → refunded`
   - Branches to `cancelled` from early states.
   - Any other transition is rejected server-side.

6. **Every user-owned table has Row-Level Security policies.**
   - Policy: `auth.uid() = user_id` for owners, `is_admin = true` for admins.
   - RLS is enforced at the database, not just in the application layer.

7. **All timestamps are `timestamptz` stored in UTC.**
   - Display conversion happens at the edge.
   - Never use naive `timestamp` columns.

8. **Append-only event tables are never UPDATEd or DELETEd.**
   - `payment_events`, `inventory_movements`, `shipment_events`
   - These are audit trails. Add new rows, never modify existing ones.

9. **All API input is validated with Zod before reaching business logic.**
   - Catch malformed payloads with 400 + RFC 7807 error envelope.
   - Never trust client input.

10. **Snapshots on orders.** `order_items` stores `product_name`, `sku`,
    `unit_price_cents` at order creation time. Future product changes do not
    alter historical orders.

## Folder Conventions

```
app/
├── (storefront)/        # Customer-facing routes
├── (admin)/             # Admin routes (role-gated)
└── api/v1/              # API routes

lib/                     # Business logic per bounded context
├── catalog/             # Products, variants, categories, search
├── cart/                # Shopping cart
├── orders/              # Order lifecycle and state machine
├── payments/            # Payment intents, webhooks, reconciliation
├── inventory/           # Stock tracking and audit
├── shipping/            # Courier handoff and tracking
├── users/               # Profiles and addresses
├── notifications/       # SMS, email delivery
├── reviews/             # Review submission and moderation
└── shared/              # Cross-cutting utilities

components/
├── ui/                  # shadcn copy-paste components
└── features/            # Domain-specific components

db/
├── schema.ts            # Drizzle schema (source of truth)
└── migrations/          # SQL migrations

types/                   # Shared TypeScript types
```

Cross-module communication uses function calls, not internal HTTP. Modules
import from each other's public interface only.

## Coding Conventions

- **TypeScript strict mode.** No `any` without a comment justifying it.
- **snake_case** in the database and JSON; **camelCase** in TypeScript variables.
- **Server Components** by default. Add `"use client"` only when needed.
- **No localStorage** for tokens. Refresh token in httpOnly cookie.
- **Drizzle queries**, never raw SQL strings with concatenation.
- **Zod schemas** at every API route boundary.
- **No `dangerouslySetInnerHTML`** — React auto-escapes; trust that.

## Definition of Done

A feature is done when:
- Code passes lint, type-check, and unit tests.
- API routes have Zod validation.
- Database changes have a migration file in `db/migrations/`.
- Critical paths have E2E tests (Playwright).
- Sentry will capture any errors with `request_id` correlation.
- Relevant docs in `/docs` are updated to reflect the change.

## When Making Changes

| Change touches… | Read first |
|---|---|
| Database schema | `docs/03-database-schema.md` |
| API endpoint | `docs/04-api-spec.md` |
| Money or pricing | `docs/02-system-design.md` §6.2 |
| Payment or webhooks | `docs/04-api-spec.md` §10 (Webhook Security) |
| Order lifecycle | `docs/02-system-design.md` §8.4 (state machine) |
| Operations / runbook | `docs/05-runbook.md` |

## What NOT to Do

- **Do not add microservices.** We are a modular monolith. Logical boundaries, single deployment.
- **Do not add Redis, message queues, or Elasticsearch** unless explicitly approved. Use Next.js `after()` for async work; Postgres FTS for search.
- **Do not introduce new payment gateways.** ABA PayWay + COD only.
- **Do not add Khmer language.** v2 only.
- **Do not store card data.** Use ABA's hosted checkout, stay out of PCI scope.
- **Do not bypass RLS** in client code. RLS is the second line of defense.
- **Do not commit secrets.** Use environment variables. `.env.local` is gitignored.
- **Do not deploy database changes without a migration.** Schema drift between environments is forbidden.
- **Do not call payment-touching code "done" without human review.** AI suggestions in `lib/payments/` and webhook handlers always need a second pair of eyes.

## Build, Test, and Deploy Commands

```bash
# Install dependencies
pnpm install

# Local development
pnpm dev

# Type-check
pnpm typecheck

# Lint
pnpm lint

# Unit and integration tests
pnpm test

# E2E tests (Playwright)
pnpm test:e2e

# Build for production
pnpm build

# Run database migrations
pnpm db:migrate

# Generate a new migration from schema changes
pnpm db:generate
```

Deployment is automatic via Vercel on push to `main`. PR previews are created
on every pull request.

## Security Notes

- The webhook endpoint `/api/v1/webhooks/aba` is public by necessity. It MUST
  verify HMAC signatures before doing anything else.
- OTP rate limiting: 3 requests/hour per phone, 5 verify attempts per code.
- Order creation rate limiting: 10 per hour per user.
- All cross-origin requests are rejected except for the ABA webhook IPs.
- Secrets are rotated quarterly or immediately on suspected compromise.
- Anything touching `lib/payments/`, `app/api/v1/webhooks/`, or `app/api/v1/auth/`
  requires human code review before merge.

## Cambodian Context

- Customers identify by **phone number**, not email. Phone is the primary key
  for user identity. Email is optional.
- **Addresses follow province → district → commune → village hierarchy.** No
  postal codes. The `landmark` field is important for couriers.
- **SMS is the trust channel.** Order confirmation, shipping updates, and OTP
  all flow through SMS.
- **COD is real.** Pre-dispatch confirmation calls for COD orders > $30
  reduce refusal rates from ~25% to ~8%.
- **ABA Pay is the dominant digital payment.** KHQR (Bakong) covers other banks.

## Questions to Ask Before Coding

Before writing new code, ask:
1. Does this match a pattern already established in `lib/`? Use the existing pattern.
2. Does it touch money? Re-read the money rules above.
3. Does it touch state transitions? Check the state machine.
4. Is it a write endpoint? Add Idempotency-Key handling.
5. Does it call an external service? Add retry, timeout, and circuit-breaker considerations.
6. Could it be exploited? See Security Notes above.

When in doubt, leave a comment with `TODO(question):` and ask in the PR.
