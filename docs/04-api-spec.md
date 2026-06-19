# FemFit API Specification

**Version:** 1.0
**Base path:** `/api/v1`

---

## 1. Conventions

### 1.1 URLs

- Base: `/api/v1`
- Resources plural, lowercase: `/products`, `/orders`
- IDs in path: `/products/{slug}`, `/orders/{id}`
- Sub-resources nested: `/users/me/addresses`
- Actions as POST sub-routes: `/orders/{id}/cancel`
- Query params snake_case: `?min_price=`, `?cursor=`

### 1.2 HTTP Methods

| Method | Use | Idempotent |
|---|---|---|
| GET | Retrieve | Yes |
| POST | Create / trigger action | No (use Idempotency-Key) |
| PATCH | Partial update | Yes |
| DELETE | Remove | Yes |

### 1.3 JSON Keys

- All keys are `snake_case`
- Timestamps in ISO 8601 UTC: `2026-06-09T14:30:00Z`
- UUIDs as v4 strings
- Phone in E.164: `+85512345678`

### 1.4 Standard Headers

**Request:**
- `Authorization: Bearer <jwt>` on authenticated endpoints
- `Content-Type: application/json` on writes
- `Idempotency-Key: <uuid>` on all state-changing writes (REQUIRED)
- `X-Session-Token: <token>` on guest cart endpoints

**Response:**
- `Content-Type: application/json`
- `X-Request-ID` (server-assigned for log correlation)
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## 2. Authentication

### 2.1 Flow

1. `POST /auth/otp/request` with phone → 6-digit code via SMS (5-min TTL)
2. `POST /auth/otp/verify` with phone + code → access (1h) + refresh (30d) tokens
3. Client sends `Authorization: Bearer <access_token>` on subsequent requests
4. On 401, call `POST /auth/refresh` with refresh token
5. `POST /auth/logout` revokes refresh token

### 2.2 Token Storage

- **Web:** access in memory; refresh in httpOnly secure cookie
- **Mobile PWA:** access in memory; refresh in encrypted IndexedDB
- **Never:** localStorage (XSS-vulnerable)

### 2.3 Authorization Levels

| Level | Description | Enforcement |
|---|---|---|
| Public | No auth | None |
| Authenticated | Valid JWT | Middleware + RLS |
| Owner | Own data only | RLS (`auth.uid() = user_id`) |
| Admin | `is_admin = true` | Middleware + RLS |
| Service | Server-to-server | Signature verification |

---

## 3. Request & Response Format

### 3.1 Single Resource

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "order_number": "FF-2026-000123",
  "status": "confirmed",
  "total": {
    "amount": 4998,
    "currency": "USD",
    "display": "$49.98"
  },
  "created_at": "2026-06-09T14:30:00Z"
}
```

### 3.2 List with Pagination

```json
{
  "data": [ { ... }, { ... } ],
  "pagination": {
    "next_cursor": "eyJpZCI6Li4u",
    "has_more": true,
    "limit": 20
  }
}
```

### 3.3 Field Conventions

- **Null:** field exists but no value (`"tracking_number": null`)
- **Missing:** field not present (clients handle gracefully)
- **Empty array:** explicitly returned, never null

---

## 4. Error Handling

### 4.1 RFC 7807 Format

```json
{
  "type": "https://femfit.com/errors/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Variant abc-123 has 2 in stock, 5 requested",
  "instance": "/api/v1/orders",
  "request_id": "req_8f2a91",
  "errors": [
    {
      "field": "items[0].quantity",
      "message": "exceeds available stock",
      "code": "insufficient_stock"
    }
  ]
}
```

Content-Type: `application/problem+json`

### 4.2 Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| validation_error | 400 | Schema validation failed |
| invalid_credentials | 401 | OTP wrong or expired |
| unauthorized | 401 | Missing/invalid Bearer |
| forbidden | 403 | Not authorized |
| not_found | 404 | Resource missing |
| conflict | 409 | State conflict |
| insufficient_stock | 409 | Exceeds available |
| payment_failed | 402 | Gateway failure |
| unprocessable_entity | 422 | Valid syntax, invalid semantics |
| rate_limited | 429 | Too many requests |
| internal_error | 500 | Server error |
| service_unavailable | 503 | Upstream down |

---

## 5. Idempotency

### 5.1 Why

Cambodian mobile networks are unreliable. Double-taps on slow connections, webhook retries — all happen. Idempotency prevents duplicate orders and double charges.

### 5.2 Usage

1. Client generates UUID v4 for each unique operation
2. Sends in `Idempotency-Key` header
3. **Retries with the SAME key** on network error
4. Generates new key for genuinely new operations

### 5.3 Server Behavior

- Unseen key → process and cache response
- Seen key with cached response → return cached
- In-flight key → 409 with `idempotency_in_progress`
- Cache expires after 24 hours

### 5.4 Required On

- `POST /orders`
- `POST /payments/{order_id}/initiate`
- `POST /users/me/addresses`
- `POST /products/{slug}/reviews`
- `POST /admin/products`

---

## 6. Rate Limiting

| Endpoint Group | Limit | Window | Scope |
|---|---|---|---|
| Global API | 100 req | 1 min | Per IP |
| OTP request | 3 req | 1 hour | Per phone |
| OTP verify | 5 attempts | 5 min | Per code |
| Order creation | 10 req | 1 hour | Per user |
| Search | 60 req | 1 min | Per IP |
| Webhook (ABA) | 1000 req | 1 min | Per IP |
| Admin endpoints | 300 req | 1 min | Per admin |

429 response includes `Retry-After` header.

---

## 7. Pagination

Cursor-based (not offset). Opaque base64.

```
GET /api/v1/products?cursor=eyJpZCI6IjUuLi4ifQ==&limit=20
```

| Param | Default | Max |
|---|---|---|
| limit | 20 | 50 |
| cursor | (start) | — |

### Sort options

```
?sort=newest        # most recently created
?sort=price_asc     # cheapest first
?sort=price_desc    # most expensive first
?sort=popular       # most ordered (30 days)
?sort=relevance     # search rank (with ?q=)
```

---

## 8. Endpoint Reference

### 8.1 Authentication

#### POST /auth/otp/request

Sends OTP to phone via SMS.

- **Auth:** Public
- **Rate limit:** 3 per hour per phone

**Request:**
```json
{ "phone": "+85512345678" }
```

**Response 200:**
```json
{ "request_id": "req_8f2a91", "expires_in": 300 }
```

#### POST /auth/otp/verify

**Request:**
```json
{ "phone": "+85512345678", "code": "123456" }
```

**Response 200:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "user": {
    "id": "550e8400-...",
    "phone": "+85512345678",
    "is_new": true
  }
}
```

#### POST /auth/refresh

**Request:** `{ "refresh_token": "..." }`
**Response 200:** `{ "access_token": "...", "expires_in": 3600 }`

#### POST /auth/logout

- **Auth:** Authenticated
- **Response 204**

---

### 8.2 Catalog (Public)

#### GET /products

**Cache:** 60s with stale-while-revalidate 300s.

**Query params:**
- `category` — category slug
- `size` — CSV: `S,M,L,XL`
- `color` — CSV
- `min_price`, `max_price` — integer cents
- `in_stock` — boolean
- `sort` — see Section 7
- `cursor`, `limit`

**Response 200:**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "slug": "compression-leggings-v1",
      "name": "Compression Leggings",
      "price": { "amount": 2499, "currency": "USD", "display": "$24.99" },
      "compare_at_price": { "amount": 3499, "currency": "USD", "display": "$34.99" },
      "primary_image_url": "https://cdn.femfit.com/p/abc.webp",
      "category": { "slug": "leggings", "name": "Leggings" },
      "in_stock": true,
      "rating_avg": 4.6,
      "rating_count": 23
    }
  ],
  "pagination": { "next_cursor": "...", "has_more": true, "limit": 20 }
}
```

#### GET /products/{slug}

Returns full product with variants, images, review summary.

```json
{
  "id": "550e8400-...",
  "slug": "compression-leggings-v1",
  "name": "Compression Leggings",
  "description": "...",
  "price": { "amount": 2499, "currency": "USD", "display": "$24.99" },
  "variants": [
    {
      "id": "v_001",
      "sku": "COMP-LEG-M-BLK",
      "size": "M", "color": "Black",
      "price": { "amount": 2499, "currency": "USD", "display": "$24.99" },
      "stock_quantity": 12,
      "in_stock": true
    }
  ],
  "images": [
    { "url": "...", "alt": "Front view", "is_primary": true }
  ],
  "reviews_summary": {
    "rating_avg": 4.6,
    "rating_count": 23,
    "distribution": { "5": 15, "4": 6, "3": 1, "2": 1, "1": 0 }
  }
}
```

#### GET /categories

Returns category tree.

#### GET /search?q=...

Full-text search. Same response shape as `/products`.

---

### 8.3 Cart

Works for both authenticated users and guests (via `X-Session-Token`).

#### GET /cart

Returns current cart with items and totals.

#### POST /cart/items

```json
{ "variant_id": "v_001", "quantity": 1 }
```

Returns updated cart. **Errors:** 409 `insufficient_stock` if quantity exceeds stock.

#### PATCH /cart/items/{id}

```json
{ "quantity": 3 }
```

#### DELETE /cart/items/{id}

Response 204.

#### POST /cart/merge

```json
{ "session_token": "sess_xyz" }
```

Called immediately after login. Conflicts sum quantities (clamped to stock).

---

### 8.4 Checkout & Orders

#### POST /checkout/preview

Calculates totals WITHOUT creating order.

**Request:**
```json
{
  "address_id": "addr_001",
  "items": [{ "variant_id": "v_001", "quantity": 2 }],
  "coupon_code": "WELCOME10"
}
```

**Response:**
```json
{
  "subtotal": { "amount": 4998, "currency": "USD", "display": "$49.98" },
  "shipping_fee": { "amount": 200, "currency": "USD", "display": "$2.00" },
  "discount": { "amount": 500, "currency": "USD", "display": "$5.00" },
  "total": { "amount": 4698, "currency": "USD", "display": "$46.98" },
  "shipping_options": [
    { "courier": "jt", "fee": {...}, "estimated_days": 3 }
  ],
  "available_payment_methods": ["aba_pay", "khqr", "cod"]
}
```

#### POST /orders

**Idempotency-Key: REQUIRED.** Rate limit: 10/hour per user.

**Request:**
```json
{
  "address_id": "addr_001",
  "payment_method": "aba_pay",
  "items": [{ "variant_id": "v_001", "quantity": 2 }],
  "coupon_code": "WELCOME10",
  "customer_note": "Please call before delivery"
}
```

**Response 201:**
```json
{
  "order": {
    "id": "ord_001",
    "order_number": "FF-2026-000123",
    "status": "pending_payment",
    "total": { "amount": 4698, "currency": "USD", "display": "$46.98" },
    "items": [ ... ],
    "created_at": "2026-06-09T14:30:00Z"
  },
  "payment": {
    "id": "pay_001",
    "method": "aba_pay",
    "status": "pending",
    "redirect_url": "https://payway.ababank.com/...",
    "expires_at": "2026-06-09T14:45:00Z"
  }
}
```

COD orders skip `redirect_url`; status is `confirmed` immediately.

**Errors:**
- 400 `validation_error`
- 403 `forbidden` — address not owned
- 409 `insufficient_stock`
- 409 `idempotency_in_progress`
- 422 `unprocessable_entity` — coupon expired

#### GET /orders

User's orders, most recent first. Filterable by status.

#### GET /orders/{id}

Full detail with timeline:

```json
{
  "id": "ord_001",
  "order_number": "FF-2026-000123",
  "status": "shipped",
  "items": [ ... ],
  "subtotal": {...}, "shipping_fee": {...}, "discount": {...}, "total": {...},
  "payment_method": "aba_pay",
  "shipping_address": { ... snapshot ... },
  "courier": "jt",
  "tracking_number": "JT12345678",
  "tracking_url": "https://...",
  "estimated_delivery_date": "2026-06-12",
  "timeline": [
    { "status": "pending_payment", "at": "..." },
    { "status": "confirmed", "at": "..." }
  ]
}
```

#### POST /orders/{id}/cancel

```json
{ "reason": "changed_mind" }
```

Only allowed for `pending_payment` or `confirmed` status.

---

### 8.5 Payments

#### GET /payments/{id}

Status of payment. Used by client polling.

Polling guidance: 2s for first 10s, then 5s up to 60s. Stop on terminal status.

---

### 8.6 Reviews

#### GET /products/{slug}/reviews

Lists approved reviews. Query params: `sort`, `rating`, `cursor`, `limit`.

#### POST /products/{slug}/reviews

**Idempotency-Key: REQUIRED.**

```json
{
  "order_id": "ord_001",
  "rating": 5,
  "title": "Perfect fit",
  "body": "...",
  "photo_url": "..."
}
```

**Errors:**
- 403 — no delivered order containing product
- 409 — already reviewed this product for this order

---

### 8.7 User Account

- `GET /users/me` — profile
- `PATCH /users/me` — update (partial)
- `GET /users/me/addresses` — list
- `POST /users/me/addresses` — create (Idempotency-Key required)
- `PATCH /users/me/addresses/{id}` — update
- `DELETE /users/me/addresses/{id}` — delete (cannot delete default)

---

### 8.8 Admin

All require `is_admin = true`.

**Products:**
- `POST /admin/products` (Idempotency-Key required)
- `PATCH /admin/products/{id}`
- `DELETE /admin/products/{id}` (soft delete)
- `POST /admin/products/{id}/variants`
- `PATCH /admin/variants/{id}` (changes to stock create inventory_movement reason='adjustment')
- `POST /admin/products/{id}/images`

**Orders:**
- `GET /admin/orders` — query by status, payment_method, date range, search
- `POST /admin/orders/{id}/confirm` (COD)
- `POST /admin/orders/{id}/ship` — requires `{ courier, tracking_number, estimated_delivery_date }`
- `POST /admin/orders/{id}/deliver`
- `POST /admin/orders/{id}/cancel`
- `POST /admin/orders/{id}/refund`

**Reviews:**
- `GET /admin/reviews?is_approved=...`
- `POST /admin/reviews/{id}/approve`
- `POST /admin/reviews/{id}/reject`

**Coupons:**
- `POST /admin/coupons`
- `GET /admin/coupons`
- `PATCH /admin/coupons/{id}`

---

### 8.9 Webhooks

#### POST /webhooks/aba

**Auth:** HMAC-SHA512 signature verification.

**Required headers:**
- `X-ABA-Signature` — hex HMAC-SHA512 of raw body
- `X-ABA-Timestamp` — Unix timestamp; rejected if > 5 min old

**Processing:**
1. Read **raw** request body (not parsed JSON)
2. Compute HMAC-SHA512 and compare via constant-time
3. Verify timestamp window
4. **If verification fails, return 401. Do not touch DB.**
5. Look up payment by `gateway_txn_id`
6. If terminal state, return 200 (idempotent)
7. Insert into `payment_events`
8. Update payment + order in transaction
9. Enqueue SMS, courier booking, email
10. Return 200 within 5 seconds

---

## 9. Money & Currency

**Storage and transmission rules:**

- Money is stored and transmitted as INTEGER in smallest unit
  - USD as cents (100 = $1.00)
  - KHR as riels (no decimal subdivision)
- **Never use floating-point.**
- Currency code is required wherever amount is present.

**Money object shape:**
```json
{
  "amount": 2499,
  "currency": "USD",
  "display": "$24.99"
}
```

`display` is generated server-side. Clients use it directly.

**Display:**
| Currency | Amount | Display |
|---|---|---|
| USD | 2499 | $24.99 |
| USD | 100000 | $1,000.00 |
| KHR | 10000 | ៛10,000 |

---

## 10. Webhook Security

### 10.1 Defenses

1. **HMAC signature verification** — every webhook includes signature; we recompute and compare in constant time.
2. **Timestamp validation** — reject if > 5 min old (replay protection).
3. **Idempotency by transaction ID** — unique index on `gateway_txn_id`.
4. **Rate limiting** — 1000 req/min per IP, scoped to ABA IPs.
5. **Full payload logging** — every payload stored in `payment_events`.
6. **Secret rotation** — quarterly or on suspected compromise.

### 10.2 Verification Pseudocode

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export async function POST(req: Request) {
  const body = await req.text();  // RAW, not parsed
  const signature = req.headers.get('x-aba-signature');
  const timestamp = req.headers.get('x-aba-timestamp');

  // Replay protection
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return new Response('Stale', { status: 401 });
  }

  // Constant-time signature comparison
  const expected = createHmac('sha512', process.env.ABA_SECRET!)
    .update(body).digest('hex');
  if (!signature || !timingSafeEqual(
        Buffer.from(signature), Buffer.from(expected))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(body);
  await processWebhook(payload);  // idempotent
  return new Response('OK', { status: 200 });
}
```

---

## 11. Enum Reference

### order_status
`pending_payment` → `confirmed` → `packing` → `shipped` → `delivered`
Branches: `cancelled`, `returned`, `refunded`

### payment_method
`aba_pay`, `khqr`, `card`, `cod`

### payment_status
`pending`, `processing`, `succeeded`, `failed`, `cancelled`, `refunded`

---

## 12. Status Codes

| Code | Meaning |
|---|---|
| 200 OK | Success with body |
| 201 Created | Resource created |
| 204 No Content | Success, no body |
| 400 Bad Request | Validation failed |
| 401 Unauthorized | No/invalid credentials |
| 402 Payment Required | Payment failed |
| 403 Forbidden | Not allowed |
| 404 Not Found | Missing |
| 409 Conflict | State conflict |
| 410 Gone | Expired (OTP) |
| 422 Unprocessable | Invalid semantics |
| 429 Too Many Requests | Rate limited |
| 500 Internal Server Error | Bug |
| 503 Service Unavailable | Upstream down |

---

## 13. Versioning Policy

### Within a version (additive only):
- New endpoints
- New optional fields in requests
- New fields in responses
- New optional query parameters

### Requires new version:
- Removing or renaming fields
- Making optional fields required
- Changing field types or semantics
- Tightening validation
- Changing error response shape

Old versions supported for at least 12 months after deprecation.
