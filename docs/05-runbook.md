# FemFit Operations Runbook

**Version:** 1.0
**Audience:** On-Call Engineers, Operations Staff
**Keep accessible at all times. Print a copy.**

---

## 1. Severity Levels

### S1 — Critical
- Site completely down, OR
- Checkout/payment broken for all users, OR
- Confirmed data breach

**Response:** Acknowledge within 15 min, 24/7. Page primary on-call; engage backup if no ack in 10 min. Status post on Facebook within 30 min if customer-visible.

### S2 — High
- Major feature broken (search, cart, login)
- Significant performance degradation
- Partial outage

**Response:** Acknowledge within 1 hour business hours / 4 hours overnight.

### S3 — Medium
- Bug with workaround
- Slow degradation trend
- One specific endpoint broken

**Response:** Acknowledge within 1 business day.

### S4 — Low
- Individual customer issue
- Feature request

**Response:** Acknowledge to customer; backlog for triage.

---

## 2. First 5 Minutes (General Triage)

1. **Acknowledge** in `#femfit-incidents`. Note start time.
2. **Confirm scope** — is it reachable from your browser? Down for everyone or one user?
3. **Check dashboards** in this order:
   - UptimeRobot — is site responding?
   - Sentry — error spike? new exception?
   - Vercel — recent deploys? function errors?
   - Supabase — DB CPU, connections, errors?
   - Cloudflare — traffic spike? WAF events?
4. **Decide severity.** Update incident channel.
5. **Match scenario** in Section 3. If none, document investigation publicly.

---

## 3. Operational Scenarios

### 3.1 Site is Down

**Symptoms:** UptimeRobot alerts. Site returns 5xx or times out.
**Severity:** S1

**Diagnose:**
1. Check status pages: status.vercel.com, status.supabase.com, cloudflarestatus.com
2. Cloudflare for traffic anomalies (DDoS) or recent rule changes
3. Vercel — did something deploy in the last 30 min?
4. Sentry for error spike aligned with outage start
5. Try from multiple networks

**Resolve:**
- **Recent deploy correlates:** rollback via Vercel one-click. Most common cause.
- **Upstream outage:** post status to Facebook; wait for resolution.
- **DB connection exhausted:** see Scenario 3.12.
- **DDoS:** enable Cloudflare "I'm under attack" mode (Security → Settings).

### 3.2 Customer Says Payment Failed but Money Was Charged

**Severity:** S2 (S1 if multiple)

**Diagnose:**
1. Get order number and phone
2. Look up order, payment, payment_events
3. Log into ABA merchant portal — confirm whether ABA received the money

**Resolve:**
- **ABA shows success, our records show pending/failed:** webhook was lost. Manually mark payment succeeded and order confirmed (use Section 5.5 query). Investigate why webhook didn't arrive.
- **ABA shows success, our records agree:** customer just hasn't refreshed. Confirm and tell them to check "My Orders".
- **ABA shows not found:** no money moved. Customer should check their ABA app.
- **ABA shows mismatched amount:** ESCALATE to Engineering Lead. Possible fraud.

### 3.3 ABA Webhook Not Received

**Severity:** S2

**Diagnose:**
1. Check Vercel logs for POST /api/v1/webhooks/aba
2. Filter for 401s (signature failed) and 5xxs (handler crashed)
3. Check Sentry for webhook handler exceptions
4. Check ABA merchant portal for webhook delivery logs

**Resolve:**
- **Signature mismatches everywhere:** HMAC secret changed but not deployed. Verify `ABA_SECRET` in Vercel env vars.
- **Handler crashing:** check Sentry. Usually schema mismatch or missing env var. Fix or rollback.
- **Webhook not reaching us:** verify URL in ABA portal; check Cloudflare firewall events for blocked ABA IPs.
- **Reconciliation:** the 5-min job (Section 4.4) sweeps pending payments. Trigger manually if needed.

### 3.4 Order Stuck in pending_payment

**Severity:** S3 (S2 if many)

**Diagnose:**
1. Look up order and payment
2. Check payment_events for any webhook
3. Verify in ABA portal whether customer paid

**Resolve:**
- **Customer did NOT pay:** auto-cancel job handles after 15 min. Or cancel manually.
- **Customer DID pay:** see Scenario 3.2.

### 3.5 Order Stuck in packing/shipped

**Severity:** S3 (S2 if pattern)

**Diagnose:**
1. Get order number and tracking
2. Check courier's tracking page
3. Verify with ops — physically picked up?

**Resolve:**
- **Courier shows delivered, customer says no:** ask customer to check neighbors. File courier claim if still missing.
- **No movement 3+ days:** contact courier account manager.
- **Marked "shipped" but never actually shipped:** mark back to "packing", dispatch ASAP, apologize with small credit.

### 3.6 Stock Mismatch / Overselling

**Severity:** S2

**Diagnose:**
1. Get variant_id
2. Sum all `inventory_movements`; compare to `stock_quantity` on variant row
3. Look for `reason='adjustment'` entries (manual edits)
4. Look for movements without `reference_id`

**Resolve:**
- **Order placed for zero stock:** race condition bug. Cancel, refund, ESCALATE. Should never happen if SELECT FOR UPDATE is in place.
- **Physical stock present, system shows zero:** ops adds `inventory_movement` with reason='adjustment' and note.
- **Sum doesn't match cached:** run reconcile query (Section 5.7).

### 3.7 Customer Cannot Log In

**Severity:** S3 (single user), S2 (many)

**Diagnose:**
1. Get phone number
2. Check `notifications` table for recent SMS to that number
3. Check Twilio dashboard for delivery status
4. Check rate limit status

**Resolve:**
- **SMS delivered but not received:** carrier issue. Try again in 5 min.
- **SMS failed:** invalid number or carrier block. Verify number.
- **Hit rate limit:** wait 1 hour, or clear key manually.
- **Code wrong:** request fresh one; use most recent.

### 3.8 OTP SMS Not Delivered (Widespread)

**Severity:** S1 — auth broken blocks new business

**Diagnose:**
1. Check Twilio status and dashboard
2. Delivery rate vs baseline (>95% normal)
3. Concentrated on one carrier?

**Resolve:**
- **Provider down:** switch to backup; post status.
- **One carrier failing:** contact provider — route issue.
- **Credit exhausted:** top up. Set up auto-top-up.
- **Account suspended (spam):** ESCALATE to Engineering Lead.

### 3.9 Customer Wants Refund

**Severity:** S4 — handle within 24 hours

**Eligibility:** Within 7-day return window from delivery. Product eligible. Proof of purchase.

**Process:**
1. Verify eligibility against returns policy
2. Look up order and payment
3. For ABA: open merchant portal, find transaction, click Refund. Note reference.
4. For COD: arrange cash refund via ops
5. Update order status to 'refunded'. Add admin_note with reference.
6. Trigger refund SMS
7. If goods returning, schedule courier pickup

**Timing:**
- ABA: T+1 to T+2 business days
- Card: 5–10 business days
- COD: Within 3 business days

### 3.10 COD Refused at Delivery

**Severity:** S4 (track refusal rate)

**Process:**
1. Mark order as 'cancelled' with reason 'cod_refused'
2. Add inventory back (reason='return')
3. Check customer's history — 2nd refusal?
4. If 2nd: set `is_blocked_cod = true`. Must prepay future orders.
5. Track in monthly COD refusal report
6. Optional: SMS asking about prepaid re-order

### 3.11 Suspicious / Fraudulent Order

**Severity:** S2 — money at risk

**Diagnose:**
1. Recent orders from this phone or address
2. IP address of order creation request (Vercel logs)
3. Patterns: bulk, identical items, sequential phones

**Resolve:**
- **Confirmed fraud, payment taken:** DO NOT SHIP. Refund. Block user and phone.
- **Suspicious but not confirmed:** call number. If unreachable/evasive, cancel and refund.
- **Pattern:** ESCALATE. Consider velocity rules.

### 3.12 Database Slow or Unresponsive

**Severity:** S1

**Diagnose:**
1. Supabase dashboard → CPU, memory, connections
2. Slow query log
3. Specific query consuming CPU? (Recent deploy missing an index?)
4. Connection count vs pool limit

**Resolve:**
- **Slow query identified:** kill long-runners (`SELECT pg_cancel_backend(pid)`). Add missing index in hotfix.
- **Connection exhaustion:** increase pool size, or redeploy Vercel to reset pools.
- **Sustained high CPU:** upgrade Supabase tier; optimize next sprint.
- **Memory exhaustion:** restart DB via Supabase dashboard (~1 min downtime).

### 3.13 Webhook Endpoint Receiving Suspicious Traffic

**Severity:** S2

**Diagnose:** Cloudflare Security → Events, filter by webhook URL. Note source IPs.

**Resolve:**
- **Random bot probing:** expected internet noise — 401s correctly rejecting.
- **Sustained attack:** add Cloudflare WAF rule allowing only ABA IP ranges.
- **Fraud attempts:** block IP range; report to ABA.

### 3.14 SMS Cost Spike

**Severity:** S2

**Diagnose:**
1. `notifications` table — which template?
2. Same phone receiving many OTPs?
3. Cloudflare rate-limit logs

**Resolve:**
- **OTP abuse:** tighten rate limit at Cloudflare. Block offending IPs.
- **Notification loop bug:** check Sentry. Patch; clear queue.
- **Legitimate spike (promotion):** top up balance.

---

## 4. Routine Operations

### 4.1 Daily
- Sentry review for new errors
- Spot-check overnight orders for stuck pending_payment
- Confirm reconciliation job ran
- Review unanswered customer messages

### 4.2 Weekly
- Review KPIs: GMV, conversion, COD refusal rate
- SMS spend vs budget
- Pending review moderation queue
- Backup verification

### 4.3 Monthly
- COD reconciliation with each courier (match remitted cash to our totals)
- Inventory audit on 20 sampled SKUs
- Review `is_blocked_cod` customers
- Renew vendor agreements

### 4.4 Reconciliation Job

**Purpose:** Catch payments where ABA webhook was lost or delayed.

**What it does:**
- Finds payments in 'pending'/'processing' older than 10 min
- Queries ABA status API for each
- Updates our records if ABA confirms success/failure

**What it does NOT do:**
- Mark anything succeeded without ABA confirmation. Gateway is source of truth.

**Manual trigger:** Admin panel → Tools → Run Reconciliation Now. Or `POST /admin/jobs/reconcile`.

### 4.5 Quarterly
- Restore drill (Section 6.3)
- Rotate secrets: ABA HMAC, Supabase service role, SMS API
- Update this runbook from incident learnings
- Review admin user access

---

## 5. Useful Database Queries

### 5.1 Look up order by number

```sql
select o.*, p.status as payment_status, p.gateway_txn_id
from orders o
left join payments p on p.order_id = o.id
where o.order_number = 'FF-2026-000123';
```

### 5.2 Order with payment events

```sql
select o.id, o.order_number, o.status as order_status,
       p.status as payment_status, p.gateway_txn_id, p.raw_response,
       e.event_type, e.received_at, e.payload
from orders o
left join payments p on p.order_id = o.id
left join payment_events e on e.payment_id = p.id
where o.order_number = 'FF-2026-000123'
order by e.received_at desc;
```

### 5.3 Find customer by phone

```sql
select id, phone, full_name, is_admin, is_blocked_cod, created_at
from profiles
where phone = '+85512345678';
```

### 5.4 Customer's recent orders

```sql
select order_number, status, total_cents, currency, payment_method, created_at
from orders
where user_id = '<uuid>'
order by created_at desc
limit 20;
```

### 5.5 Manually mark payment succeeded (DANGEROUS)

Only after verifying ABA actually received payment. Always in a transaction with audit.

```sql
begin;

-- Audit
insert into payment_events (payment_id, event_type, payload)
values (
  '<payment_uuid>',
  'manual_update',
  jsonb_build_object(
    'reason', 'webhook_lost_aba_confirmed',
    'aba_ref', '<aba_reference>',
    'operator', '<your_name>'
  )
);

-- Update payment
update payments
set status = 'succeeded', paid_at = now(), updated_at = now()
where id = '<payment_uuid>'
  and status in ('pending','processing');

-- Update order
update orders
set status = 'confirmed', updated_at = now()
where id = '<order_uuid>'
  and status = 'pending_payment';

-- Verify
select id, status from payments where id = '<payment_uuid>';
select id, status from orders where id = '<order_uuid>';

-- If correct:
commit;
-- If wrong:
-- rollback;
```

### 5.6 Inventory audit for a variant

```sql
select v.id, v.sku, v.stock_quantity as cached_qty,
       coalesce(sum(im.change_qty), 0) as computed_qty
from product_variants v
left join inventory_movements im on im.variant_id = v.id
where v.id = '<variant_uuid>'
group by v.id, v.sku, v.stock_quantity;
```

### 5.7 Reconcile cached stock from movements

```sql
update product_variants v
set stock_quantity = (
  select coalesce(sum(change_qty), 0)
  from inventory_movements im
  where im.variant_id = v.id
)
where v.id = '<variant_uuid>';
```

### 5.8 Recent SMS for a phone

```sql
select id, template, status, error_message, sent_at, created_at
from notifications
where channel = 'sms' and recipient = '+85512345678'
order by created_at desc
limit 20;
```

### 5.9 Fraud check — orders from a phone or address

```sql
select o.order_number, o.status, o.total_cents, o.payment_method,
       o.shipping_phone, o.shipping_province, o.shipping_district,
       o.shipping_street, o.created_at
from orders o
where o.shipping_phone = '+85512345678'
   or o.shipping_street ilike '%<address fragment>%'
order by o.created_at desc
limit 50;
```

### 5.10 Orders stuck in pending_payment > 20 min

```sql
select o.order_number, o.created_at, p.status as payment_status,
       p.gateway_txn_id
from orders o
join payments p on p.order_id = o.id
where o.status = 'pending_payment'
  and o.created_at < now() - interval '20 minutes'
order by o.created_at;
```

### 5.11 Daily revenue

```sql
select date_trunc('day', created_at)::date as day,
       count(*) as order_count,
       sum(total_cents) / 100.0 as revenue_usd
from orders
where status in ('confirmed','packing','shipped','delivered')
  and currency = 'USD'
  and created_at >= now() - interval '30 days'
group by 1
order by 1 desc;
```

---

## 6. Deployment & Rollback

### 6.1 Normal Deploy

Automatic on merge to main:
1. PR opened → CI runs lint, type-check, tests
2. Vercel preview deployed
3. Manual verification
4. Merge to main → Vercel deploys (2–3 min)
5. Health check → auto-rollback on failure

### 6.2 Hotfix

1. `git checkout -b hotfix/<description>`
2. Minimal change
3. PR with `[HOTFIX]` prefix
4. Merge; Vercel deploys
5. Post-incident, proper review

### 6.3 Rollback

**Application:** Vercel dashboard → Deployments → find last known good → Promote to Production. ~30 seconds.

**Database migrations:** Avoid this. Use Expand → Migrate → Contract so schema changes are forward-compatible.

---

## 7. Backup & Recovery

### 7.1 Sources
- Supabase daily backups (7-day free, 30-day Pro)
- Point-In-Time Recovery (Pro): continuous WAL, 7 days
- Monthly logical dump → Cloudflare R2: 12-month retention
- Schema in Git (Drizzle migrations): forever

### 7.2 Restore

**Never restore over live project.** Create new Supabase project, restore, verify, then cut over.

1. Decide recovery point
2. Create new Supabase project
3. Restore via dashboard or `psql < dump.sql`
4. Verify with sample queries (Sections 5.1, 5.11)
5. Update `DATABASE_URL` in Vercel
6. Redeploy
7. Monitor 1 hour

### 7.3 Restore Drill (Quarterly)

1. Schedule 1 hour
2. Identify backup from last 7 days
3. Restore into new staging project
4. Run application against restored DB
5. Verify representative queries
6. Document time elapsed and issues
7. Tear down staging project

---

## 8. Postmortem Template

After every S1/S2, within 5 business days. Blameless.

### Header
- Date of incident
- Severity
- Duration
- Affected users
- Financial impact
- Authors

### Sections
- **Summary:** one paragraph
- **Timeline:** chronological, all timestamps in ICT
- **Root Cause:** five-whys to past immediate cause
- **Resolution:** what we did
- **What Went Well**
- **What Could Be Improved**
- **Action Items:** with owners and dates
- **Lessons Learned:** update this runbook

---

## 9. URLs & Dashboards

| Service | URL |
|---|---|
| Production | https://femfit.com |
| Staging | https://staging.femfit.com |
| Vercel | https://vercel.com/femfit |
| Supabase | https://supabase.com/dashboard |
| Cloudflare | https://dash.cloudflare.com |
| Sentry | https://sentry.io/organizations/femfit |
| PostHog | https://app.posthog.com |
| UptimeRobot | https://uptimerobot.com/dashboard |
| GitHub | https://github.com/femfit/femfit |
| ABA Merchant Portal | [TBD - provided by ABA] |
| Incident channel | [TBD] |
