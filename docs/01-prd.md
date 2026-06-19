# FemFit Product Requirements Document

**Version:** 1.0
**Status:** Draft for Review
**Date:** June 2026
**Owner:** Product Management

---

## 1. Executive Summary

FemFit is a mobile-first online store for gymnastic and activewear apparel, designed for and operated in Cambodia. The store serves Cambodian women aged 16 to 30 who are comfortable browsing and purchasing in English, predominantly accessing the site via Android smartphones over 4G networks.

This document defines what the v1 product must do, who it serves, the constraints under which it operates, and the success metrics by which we will judge it.

### 1.1 Vision

Become the most trusted online destination for gymnastic and activewear in Cambodia by combining a fast, mobile-friendly shopping experience with locally familiar payment methods (ABA PayWay, Cash on Delivery) and reliable nationwide delivery.

### 1.2 Goals (v1)

- Launch a functional storefront within 8 to 10 weeks of project kickoff.
- Achieve 1,000 monthly active users within 6 months of launch.
- Reach 200 paid orders per month within 6 months.
- Maintain a checkout-to-paid conversion rate above 60% for digital payments.
- Keep COD refusal rate below 15% via pre-dispatch confirmation calls.

### 1.3 Non-Goals (v1)

- Khmer language UI (planned for v2).
- Native mobile app — a progressive web app (PWA) is sufficient at launch.
- Multi-vendor marketplace functionality.
- International shipping or cross-border payments.
- Subscription or recurring-order products.
- AI-driven personalized recommendations (rule-based only at launch).

---

## 2. Target Customer

### 2.1 Primary Persona

**Sophea, 22**, university student in Phnom Penh. Studies in English. Owns a mid-range Android phone (~$200 retail) on a 4G data plan. Active on Facebook and Instagram. Practices gymnastics, dance, or fitness 2–4 times a week. Has an ABA Mobile account and is comfortable using KHQR. Disposable income of $30–80/month for personal items.

### 2.2 Customer Constraints That Shape Design

- **Mobile-first:** 75%+ of traffic is expected from smartphones.
- **Network conditions:** 4G dominant. Pages must be fast on metered data.
- **Trust deficit:** Online shopping is still emerging in Cambodia. SMS confirmation, COD availability, and visible customer service are non-negotiable.
- **Phone-first identity:** Customers identify with phone numbers, not email.
- **Payment habits:** ABA Pay and KHQR dominate digital payments. COD expected by 40–60% of new customers.

---

## 3. Functional Requirements

### 3.1 FR-1: Search for Products

- Search input is reachable from every page header.
- Search matches product name and description (English).
- Filters supported: category, size, color, price range, in-stock-only.
- Sort: relevance (default), newest, price low-to-high, price high-to-low.
- Results paginated; first 20 results return in under 300ms (P95).
- Out-of-stock items ranked below in-stock items.

### 3.2 FR-2: Homepage Recommendations

- Homepage sections in order: featured banner, new arrivals, best sellers, by category.
- "New arrivals" shows products created in the last 30 days.
- "Best sellers" ranked by quantity sold in the last 30 days.
- Admins can pin up to 8 featured products.
- Each section loads in under 200ms (P95) using cached responses.

### 3.3 FR-3: Place Order

- Customer can place an order with one or more items.
- Customer can select shipping address (saved or new).
- Payment methods: ABA Pay, KHQR, or Cash on Delivery.
- Order creation reserves stock atomically; oversold inventory is impossible.
- Digital payment redirects to ABA PayWay hosted page.
- On successful payment, status transitions to 'confirmed' and SMS sent within 30 seconds.
- If payment fails or is abandoned, stock reservation is released within 15 minutes.
- Duplicate submissions result in a single order (idempotency).

### 3.4 FR-4: Check Order Status

- Logged-in customers see order list, most recent first.
- Order detail shows: number, items, total, status timeline, courier, tracking number.
- Status timeline: placed → confirmed → packing → shipped → delivered, with timestamps.
- Tracking number links to courier's tracking page.
- SMS on confirmed, shipped, delivered.
- Cancellation allowed while status is 'pending_payment' or 'confirmed'.

### 3.5 FR-5: Write and View Product Reviews

- All visitors can view approved reviews on product pages.
- Each product shows: average rating, total count, individual reviews.
- Only customers with a delivered order containing the product can review.
- Review fields: rating (required), title (optional), body (max 1000 chars, optional), photo (optional).
- Reviews held in moderation queue until admin approves.
- Reviewers can edit their own review within 7 days.

### 3.6 Supporting Requirements

- **User account:** Phone OTP sign in. Manage addresses, history, profile.
- **Shopping cart:** Persists across sessions for logged-in users.
- **Admin panel:** Manage products, variants, orders, reviews, promotions.
- **Notifications:** SMS and email for OTP, confirmation, shipping updates.

---

## 4. Non-Functional Requirements

| Attribute | Target | Verification |
|---|---|---|
| Search latency | P95 < 300ms, P99 < 800ms | APM tooling |
| Recommendation latency | P95 < 200ms (cached) | Synthetic tests |
| Checkout latency | P95 < 800ms | APM tooling |
| Order creation consistency | Strong (ACID): no oversold stock, no double charges | Concurrency tests |
| Payment processing | Exactly-once (idempotent webhooks) | Integration tests |
| Order status accuracy | Eventually consistent within 10s | Manual verification |
| Availability | 99.9% monthly | Uptime monitoring |
| Mobile page weight | Initial payload < 500KB | Lighthouse |
| First contentful paint | < 2s on 4G | WebPageTest |
| Data durability | 99.999999999% | Provider SLA + monthly restore test |
| Security | OWASP Top 10 mitigated, PCI-DSS scope minimized | Annual review |

---

## 5. Assumptions

### 5.1 Business

- Single warehouse in Phnom Penh.
- Cambodia-only shipping at launch.
- 200–500 SKUs initially.
- Client has or will register Cambodian business entity for ABA merchant.

### 5.2 Customer

- English-literate; Khmer UI deferred to v2.
- Has access to ABA Mobile, KHQR-capable bank, or cash for COD.
- Phone number is the primary identifier; email is optional.

### 5.3 Operational

- Manual logistics at launch (courier handoff with tracking entry).
- Customer service via Facebook Messenger, Telegram, phone — no in-app chat at launch.
- Pre-dispatch confirmation calls for COD orders above $30.

### 5.4 Technical

- User profile creation provided by Supabase Auth (phone OTP).
- Product onboarding provided (admin panel built in v1).
- Payment gateway provided (ABA PayWay).
- Image hosting and CDN provided (Supabase Storage + Cloudflare).

---

## 6. Scope

### 6.1 In Scope for v1

- Responsive web storefront (mobile-first).
- PWA for installable mobile experience.
- Admin panel.
- ABA PayWay digital payment.
- Cash on Delivery workflow.
- Phone OTP authentication.
- English UI.
- USD and KHR pricing display.
- Transactional SMS and email.
- Manual courier handoff with tracking entry.

### 6.2 Out of Scope for v1

- Khmer language UI.
- Native iOS or Android apps.
- Other payment gateways (Wing, TrueMoney, Pi Pay, direct card).
- Automated multi-carrier orchestration.
- Loyalty programs, referrals.
- Live chat, chatbot.
- AI-personalized recommendations.
- Marketplace (multiple sellers).
- Subscriptions.
- International shipping.

---

## 7. Success Metrics

### 7.1 Primary KPIs (6 months)

| Metric | Target |
|---|---|
| Monthly Active Users | 1,000 |
| Paid orders per month | 200 |
| Average Order Value | $25 USD equivalent |
| Gross Merchandise Value | $5,000 / month |
| Digital checkout-to-paid | > 60% |
| Visit-to-order conversion | > 1.5% |

### 7.2 Operational KPIs

| Metric | Target |
|---|---|
| COD refusal rate | < 15% |
| Order fulfillment (paid → shipped) | < 24 hours |
| On-time delivery rate | > 90% |
| P95 page load on 4G | < 2.5 seconds |
| Uptime | > 99.9% monthly |

---

## 8. Key User Journeys

### 8.1 First-Time Purchase (Digital Payment)

1. Customer lands from a Facebook ad.
2. Browses featured products; taps one for details.
3. Selects size and color, adds to cart.
4. Taps Checkout — prompted to sign in via phone OTP.
5. Enters phone, receives SMS code, enters code.
6. Adds shipping address.
7. Selects ABA Pay.
8. Reviews summary (USD and KHR).
9. Taps Place Order — redirected to ABA PayWay.
10. Completes payment in ABA app.
11. Returned to FemFit confirmation page.
12. Receives SMS with order number and tracking link.

### 8.2 Repeat Purchase (COD)

1. Logs in via phone OTP.
2. Searches for 'leggings'.
3. Filters by size M.
4. Adds two products.
5. Checkout — uses saved default address.
6. Selects Cash on Delivery.
7. Receives confirmation SMS.
8. Ops calls to confirm before dispatch.
9. Receives SMS when shipped, with tracking.
10. Pays cash on delivery; gets delivery SMS.

### 8.3 Return / Cancellation

1. Views order in My Orders.
2. Taps Cancel (only before shipping).
3. Provides reason from dropdown.
4. Status → cancelled; stock returned.
5. If paid, refund via ABA (T+1 to T+2).
6. SMS confirms cancellation and refund timeline.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| ABA merchant onboarding delays | Launch slip 4+ weeks | Start paperwork week 1; keep COD as fallback |
| High COD refusal rate | Lost revenue, wasted shipping | Confirmation calls; COD blocklist |
| Courier reliability variability | Delays, complaints | Multi-carrier; manual escalation |
| Low trust → low conversion | Below-target GMV | Strong SMS flow; visible service contact; real reviews |
| Mobile perf on low-end Android | Bounce rate | Image optimization; small JS bundle; CI budget |
| Payment fraud / fake webhooks | Financial loss | HMAC verification; reconciliation every 5 min |
| Inventory oversell | Cancellations, trust loss | Atomic stock decrement with row-level locking |

---

## 10. Open Questions

Resolve with client before/during build:

| Question | Resolve By |
|---|---|
| Will COD be offered alongside ABA Pay at launch? | Before week 1 |
| In-house warehouse or 3PL? | Before week 2 |
| Return/refund policy for hygiene-sensitive activewear? | Before week 4 |
| Which courier(s) for v1? Volume commitments? | Before week 3 |
| USD primary, KHR primary, or user toggle? | Before week 2 |
| Client provides photography or hire photographer? | Before week 1 |
| Launch promotion strategy? | Before week 6 |

---

## 11. Milestones

| Milestone | Week | Deliverable |
|---|---|---|
| Kickoff | 0 | PRD signed off; ABA application submitted; accounts provisioned |
| Foundation | 2 | Auth, catalog browse, cart in staging |
| Checkout MVP | 4 | End-to-end checkout with COD in staging |
| ABA Integration | 6 | ABA sandbox transactions complete |
| Admin Panel | 7 | Product, order, review management |
| Soft Launch | 8 | 50 invited customers; bug bash; perf validation |
| Public Launch | 10 | Open to public; marketing active |
| First Retro | 14 | Post-launch KPI review; v2 roadmap |

---

## Glossary

- **ABA PayWay** — ABA Bank's merchant payment product supporting ABA Pay, KHQR, cards
- **COD** — Cash on Delivery
- **KHQR** — Cambodia's national QR payment standard (Bakong)
- **KHR** — Cambodian Riel
- **OTP** — One-Time Password
- **PWA** — Progressive Web App
- **SKU** — Stock Keeping Unit
