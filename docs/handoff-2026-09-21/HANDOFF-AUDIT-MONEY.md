# HANDOFF AUDIT — THE MONEY PATH AND ADMIN OPERATIONS

**Measured 2026-09-21 against `origin/main` and the live prod database (read-only).**
Scope: everything AROUND the revenue path, not the path itself. The happy run
(inquiry → quote → accept → lock → agree → deposit → confirm → fee opens → supplier
pays → admin approves) was driven end to end on 2026-09-19/20 and works; charge
`S89F-HMS91HGPAK`, ₱837.50, is the live proof and is **not** re-audited here.

---

## 🛑 READ THIS BEFORE YOU ACT ON ANY ROW

**This audit was run against `origin/main`, not against the working checkout.** The
checkout this session started in (`~/Documents/Claude/Projects/setnayan-platform`, branch
`claude/front-door-drops-hero-for-anchor`) was **2,290 commits behind `origin/main`**, and
reading it produced three confident, completely wrong findings before the divergence was
caught — including a "vendor payout fires on the fee the vendor just paid us" that
`origin/main` had already fixed with `vendorPaysSetnayan()`.
Re-measure with `git rev-list --count HEAD..origin/main` before trusting a local read, and
prefer `git show origin/main:<path>` / `git grep <pat> origin/main`.

**An anchor here is a STRING or a query, never a line number.** Every row carries the
command that re-measures it.

---

## PROD BASELINE — 2026-09-21 (re-measure, never quote)

```sql
select status, count(*), sum(amount_charged_centavos)/100.0 from booking_fee_charges group by 1;
select status, count(*), sum(requested_total_php) from orders group by 1;
select count(*) from booking_fee_ledger; select count(*) from receipts;
select count(*) from order_refunds; select count(*) from vendor_disputes;
select count(*) from vendor_payouts; select count(*) from market_price_bands;
select count(*) from vendor_2307_filings;
```

| what | now |
|---|---|
| `booking_fee_charges` | 2 — one `paid` (₱837.50), one `waived_free5` |
| `booking_fee_ledger` | 6 (4 are seeded free-5 primers with `event_id IS NULL`) |
| `orders` | 6 `paid` (₱30,431.50) · 1 `submitted` (₱350, no payment logged) · 2 `cancelled` |
| `payments` | 6, all `matched` |
| `receipts` | 6 — `or_serial` **starts at 8**; 1–7 are burned with no record |
| `order_refunds` · `vendor_disputes` · `vendor_payouts` · `market_price_bands` · `vendor_2307_filings` | **0 each** |
| VAT on every issued receipt | `vat_rate_pct = 0.00` (correct: not VAT-registered) |

---

## THE GAPS — ranked by money at risk

State key: **BROKEN** (wrong behaviour ships) · **NOT BUILT** (no mechanism) ·
**UNREACHABLE** (built, nothing routes to it) · **DECIDED-BUT-UNBUILT** (owner ruled, code
does not follow) · **DECIDED** (settled; listed so it is not re-opened).

### Tier 1 — money can be lost, double-billed, or left uncollected with nobody told

| # | Symptom in plain words | Anchor / re-measure | State | Money | Effort |
|---|---|---|---|---|---|
| 1 | **A fee opens and then the bill is never minted, and nothing ever retries it.** `collectBookingFeeAtLock` opens the charge via the RPC FIRST, then returns `skipped` at five later points (existing-order check unreadable · charge read failed · payer read failed · order insert failed · payments insert failed → the just-made order is DELETED). The charge is left `pending` with no `orders` row. The supplier's surface is order-based, so they see nothing owed; `/admin/booking-fees` lists it as "Nothing sent yet" forever. | `git grep -n "existing-order check unreadable\|order_insert_failed" origin/main -- apps/web/lib/booking-fee-lock.server.ts` · SQL: `select c.public_id, c.amount_charged_centavos from booking_fee_charges c where c.status='pending' and not exists (select 1 from orders o where o.service_key='vendor_booking_fee__'||c.charge_id::text);` (0 today) | BROKEN | whole fee, silently uncollected, per booking | M |
| 2 | **The catch-up sweep cannot see exactly that case.** `maybeCatchUpAcknowledgedDeposits` counts `pending` as already-charged, so the row in #1 is excluded by design. The sweep only rescues a booking with NO charge at all. | `git grep -n "in('status', \['pending', 'paid', 'waived_import', 'waived_free5'\])" origin/main -- apps/web/lib/deposit-acknowledged-effects.server.ts` | NOT BUILT | same money as #1 — this is why #1 never self-heals | S |
| 3 | **Approving a payment has no order-status precondition, so a cancelled or refunded order flips back to `paid`.** The promote is `.update({status:'paid'}).eq('order_id', …)` with no `.in('status', …)`; the order is read for the notification but `status` is not in the select. The customer-side submit has no status guard either — a buyer can log a payment against a `cancelled`, `refunded` or already-`paid` order. Re-activates the SKU and re-schedules payouts. | `git show origin/main:apps/web/app/admin/payments/actions.ts \| grep -n -A2 "status: 'paid', updated_at"` and `git show origin/main:'apps/web/app/dashboard/[eventId]/orders/actions.ts' \| grep -n "Order not found for this event"` | BROKEN | double-billing a customer; re-granting a refunded SKU | S |
| 4 | **A refund does not reverse the booking fee.** `deactivateOrderSku` has no `chargeIdFromBookingFeeLockServiceKey` branch (activation does; deactivation does not). Refund the fee order and `booking_fee_charges.status` stays `paid`: revenue is overstated, the free-5 ordinal stays consumed, and the ledger says the supplier paid. | `git show origin/main:apps/web/lib/sku-activation.ts \| sed -n '/export async function deactivateOrderSku/,/^}/p' \| grep -c BookingFee` → **0** | BROKEN | the refunded fee counted as revenue forever | S |
| 5 | **A credit owed to a supplier is recorded and then paid to nobody.** Amend a booking DOWN after the fee is paid and `booking_fee_rederive_lock_fee` writes a `kind='amendment_credit'` row with `credit_centavos`. Nothing in the app ever reads it — no refund, no offset against the next fee, no line on either screen. (The two TS hits for `credit_centavos` are the proposal payment schedule's crew-meal credit, a different thing.) | `git grep -n "credit_centavos" origin/main -- apps/web \| grep -v test \| grep -v proposal` → **nothing** · SQL: `select public_id, credit_centavos from booking_fee_charges where kind='amendment_credit' and coalesce(credit_centavos,0)>0;` | BROKEN | money we owe a supplier, invisible to both sides | M |
| 6 | **`expires_at` is printed and then ignored.** Written as `NOW() + 7 days` on every pending charge and read only to put a due date in one notification. Nothing flips `pending → expired` at the deadline, nothing chases, nothing is withheld. The supplier notification is emitted **once** (idempotency key = the pay-page `related_url`) and never repeated. There is no dunning of any kind. | `git grep -n "readChargeDueDate" origin/main -- apps/web` (display only) · `git grep -n "status = 'expired'" origin/main -- supabase/migrations` (only the re-derive's superseded deltas) | NOT BUILT | every unpaid fee ages to infinity, uncollected | M |
| 7 | **A fee bill reaches the supplier only if they open the vendor dashboard.** Both the notify sweep and the catch-up fire from `apps/web/app/vendor-dashboard/layout.tsx` via `after()`. A supplier who is billed by a price amendment (the DB trigger mints the order) and never logs in is never told and never emailed. | `git grep -n "maybeSweepVendorBookingFeeNotifications\|maybeCatchUpAcknowledgedDeposits" origin/main -- apps/web/app/vendor-dashboard/layout.tsx` | NOT BUILT | uncollected fees on dormant suppliers | S |
| 8 | **A deposit acknowledged on a pre-contracted row makes that booking free forever.** The RPC skips with `not_contracted`; the ledger ordinal is computed once and never recovers. It is logged loudly and reported to Sentry on every render — but there is no repair action anywhere. | `git grep -n "not_contracted" origin/main -- apps/web` | NOT BUILT (repair) | one whole fee per occurrence, permanently | M |
| 9 | **An unclaimed (admin-owned) supplier profile is billed into a void.** `no_payer` → the charge stays `pending` with no order and no payer. Nothing re-runs it when the supplier later claims the profile. | `git grep -n "'no_payer'" origin/main -- apps/web/lib/booking-fee-lock.server.ts` | NOT BUILT | whole fee | S |

### Tier 2 — reconciliation and records that will not survive real volume

| # | Symptom | Anchor / re-measure | State | Money | Effort |
|---|---|---|---|---|---|
| 10 | **Partial refunds are impossible.** `order_refunds` carries `UNIQUE(order_id)`; the migration says partials are "V1.x". Refund ₱5,000 of a ₱24,000 order and the second tranche cannot be recorded at all. | `git grep -n "order_refunds_order_id_uq" origin/main -- supabase/migrations` | DECIDED-BUT-UNBUILT | an unrecorded refund tranche | M |
| 11 | **A receipt cannot be voided and there is no credit memo.** `receipts` has no `voided_at` / `status` / reason column and no credit-memo table anywhere. A refunded order keeps its issued receipt. The code is explicit that this is *not* the BIR OR (that is issued offline) — but nothing tracks the offline OR either, so the void-vs-credit-memo question has no home in the system at all. | `git grep -n "voided\|credit_memo" origin/main -- supabase/migrations \| grep receipts` → **nothing** · `git show origin/main:apps/web/app/admin/payments/actions.ts \| grep -n "NOT a BIR Official Receipt"` | 🔑 **OWNER DECISION** | audit exposure, not cash | M |
| 12 | **The OR series has an unexplained gap.** `or_serial` starts at **8** — 1–7 were consumed and deleted. It is a plain Postgres sequence, so any rolled-back transaction burns a number permanently. A BIR series is supposed to be accountable end to end. | `select min(or_serial), max(or_serial), count(*) from receipts;` | 🔑 **OWNER DECISION** | audit exposure | S to record, M to fix |
| 13 | **Every bank transfer is matched by eye.** There is no statement import, no auto-match on reference, no "unmatched transfers" view. What exists: a duplicate-reference classifier (`classifyDuplicate` — refuses the same transfer twice on one bill, warns across bills) and a shortfall guard (`orderGrossOwed` / `orderReconciledToPaid`, which correctly refuses to promote a short transfer). Those two are good. The matching itself is a human reading a screenshot. | `git grep -n "classifyDuplicate\|orderReconciledToPaid" origin/main -- apps/web/app/admin/payments/actions.ts` | NOT BUILT | scales to a few a day, no further | L |
| 14 | **The duplicate-reference check reads every money-status payment with no `.limit()`.** `.select(…).neq('payment_id', …).in('status', MONEY_STATUSES)` and then classifies in TypeScript. Past the PostgREST row cap it silently sees an arbitrary subset — and a money guard that reads a subset passes on a duplicate it never loaded. (It already shipped inert once for a month by naming a non-existent enum value; that lesson is in the file's own comment.) | `git show origin/main:apps/web/app/admin/payments/actions.ts \| grep -n -A3 "in('status', MONEY_STATUSES)"` | BROKEN at scale | double-counted transfers | S |
| 15 | **The catch-up sweep is capped at 25 rows with no ordering.** A supplier with more than 25 acknowledged bookings gets an arbitrary 25 swept; a missed fee outside that window is never caught up. | `git show origin/main:apps/web/lib/deposit-acknowledged-effects.server.ts \| grep -n "limit(25)"` | BROKEN at scale | uncollected fees | S |
| 16 | **`/admin/payments` cannot page.** Three hard limits — the queue at 100, the unquoted-orders list at 100, and the search's order pre-resolve at 200. Past those the admin literally cannot reach a payment from the UI. (The search reaching past the newest-100 window is deliberate and good; the 200 ceiling on it is not.) | `git show origin/main:apps/web/app/admin/payments/page.tsx \| grep -n "limit(100)\|limit(200)"` | BROKEN at scale | a payment nobody can find | M |
| 17 | **`/admin/booking-fees` lists only `status='pending'`, capped at 200, and shows no bill state.** A charge with no order is indistinguishable from one the supplier simply has not paid — both read "Nothing sent yet". No overdue sort, no age escalation, no link to mint the missing order. | `git show origin/main:apps/web/app/admin/booking-fees/page.tsx \| grep -n "eq('status', 'pending')\|limit(200)"` | BROKEN (incomplete) | #1 and #9 hide here | M |
| 18 | **`market_price_bands` is empty in prod and only a human button fills it.** `recompute_market_price_bands()` is fired from `/admin/pricing?tab=price-bands`; this repo has no scheduler by design. So the Price-Position Meter is empty until someone presses Recompute, and stale from the second after. | `select count(*) from market_price_bands;` → **0** · `git grep -n "recomputePriceBands" origin/main -- apps/web` | UNREACHABLE (in practice) | mis-priced catalogue advice | S |
| 19 | **A supplier has nothing to hand an accountant.** They can see their fee orders and per-order app receipts. There is no statement, no annual or quarterly total, no export. | `git ls-tree origin/main apps/web/app/vendor-dashboard/tax-documents/` | NOT BUILT | supplier friction, not cash | M |
| 20 | **The owner has nothing to hand theirs either.** `/admin/money` is a nav landing derived from `ADMIN_NAV_GROUPS` — cards, not numbers. There is no revenue statement, no period close, no fee/receipt/refund roll-up. | `git show origin/main:apps/web/app/admin/money/page.tsx \| head -20` | NOT BUILT | the owner cannot state revenue without SQL | M |

### Tier 3 — correct today, listed so it is not re-litigated or quietly broken

| # | Finding | Anchor | State |
|---|---|---|---|
| 21 | **The 2307 question is already answered — keep the table, build nothing.** Per RR 16-2023 (1% intermediary-tax exemption) Setnayan has no Form 2307 obligation toward suppliers; suppliers handle their own. The table and lib are preserved deliberately as audit history for anything issued under V1. 0 rows is the correct state. | `git show origin/main:apps/web/app/vendor-dashboard/tax-documents/page.tsx \| head -25` | **DECIDED** |
| 22 | **VAT is 0 and that is right.** `getEffectiveVatRatePct` reads `platform_settings.default_vat_rate_pct`, falls back to 0 on any failure, and all six issued receipts carry `vat_rate_pct = 0.00`. Setnayan is not VAT-registered. ⚠ The `receipts` table still `DEFAULT 12.00`, and **nothing watches the ₱3,000,000 registration threshold** — crossing it makes every receipt wrong silently. | `git grep -n -A8 "export async function getEffectiveVatRatePct" origin/main -- apps/web/lib/platform-settings.ts` · `select sum(gross_total_php) from receipts where issued_at >= date_trunc('year', now());` | DECIDED + **owner watch item** |
| 23 | **The payout money-direction guard is fixed on `origin/main`.** `vendorPaysSetnayan(row.service_key)` now short-circuits `schedulePayoutsForOrder`, so a booking-fee order (which carries both `vendor_profile_id` AND `event_id`) can no longer schedule a payout back to the supplier who just paid us. Prod confirms: `vendor_payouts` = 0 and the ₱837.50 order's `vendor_net_centavos` = 0. **The stale local checkout does NOT have this — do not "re-fix" it from a local read.** | `git grep -n "vendorPaysSetnayan" origin/main -- apps/web/app/admin/payments/actions.ts apps/web/lib/vendor-pays-setnayan.ts` | **FIXED — do not rebuild** |
| 24 | **The 2026-09-20 money-read fixes are live on `main`.** One peso formatter with a guard against a second (`6406d2236`), the installment anchor widened from a spelling to the property (`69f4a8515`), exact installments (`ce7e85922`), the reference/label fusion fix (`8e0a1a28e`). All four are ancestors of `origin/main`. | `for c in 6406d2236 69f4a8515 ce7e85922 8e0a1a28e; do git merge-base --is-ancestor $c origin/main && echo "$c IN"; done` | **VERIFIED LIVE** |
| 25 | **A covered package row is NOT an over-billing risk.** `booking_fee_open_lock_charge` refuses `package_role='covered'` before any money logic, on the live prod function. `resolveFeeAnchorRowId` exists for the opposite reason — UNDER-billing, and the schedule-pool double-consume. | `select pg_get_functiondef('public.booking_fee_open_lock_charge'::regproc);` | **CORRECT — the old docblock's claim was wrong** |
| 26 | **The shortfall guard is real and correct.** A short transfer is matched but the order is NOT promoted, so no receipt, no payout, no SKU. It surfaces as an inline notice, not a 500. | `git grep -n "orderReconciledToPaid" origin/main -- apps/web/app/admin/payments/actions.ts` | **WORKS** |
| 27 | **Deposit refusal is a mark, not a deletion.** `reject_vendor_deposit` stamps the refusal, keeps the couple's amount/receipt/method/ledger row, never un-locks the booking, refuses to touch a confirmed deposit, and retires any earlier settlement. | `select pg_get_functiondef('public.reject_vendor_deposit'::regproc);` | **WORKS** |
| 28 | **Both acknowledge doors now run the effects.** The customer card (`acknowledge_vendor_deposit`) and the payment card (`confirm_vendor_payment`, which PERFORMs the first inside SQL) both route through `runDepositAcknowledgedEffects`, held by `deposit-acknowledge-fires-from-every-door.test.ts`. This is what the platform's first real booking fell through on 2026-09-18. | `git grep -n "runDepositAcknowledgedEffects" origin/main -- apps/web` | **FIXED — do not rebuild** |
| 29 | **There is no payment-dispute or chargeback surface, and that is a gap, not a decision.** `vendor_disputes` (0 rows) is about SERVICE completion — raised from a couple's review or admin completions, adjudicated at `/admin/disputes`. A refused/reversed BANK transfer has nowhere to go. Today's rails are manual GCash/BDO where a reversal is rare; the moment a gateway is added this is load-bearing. | `git grep -n "from('vendor_disputes')" origin/main -- apps/web \| grep insert` | NOT BUILT · **owner call** |
| 30 | **Booking-fee enforcement is still an open owner call.** Access comes from `lock_request_state='agreed'` (`lib/vendor-room-access-rule.ts`); an unpaid or expired charge removes nothing. Options on the table since 2026-09-20: (A) it stays a bill, (B) full access waits for payment, (C) access stays but an overdue fee pauses new inquiries and marketplace visibility. **Nothing has been decided, so today the answer is (A) by default.** | `git grep -n "lock_request_state" origin/main -- apps/web/lib/vendor-room-access-rule.ts` | 🔑 **OWNER DECISION** — blocks #6 |

---

## COULD NOT VERIFY

1. **The PostgREST row cap on this project.** `pg_db_role_setting` carries no `pgrst.db_max_rows`, and the value is set in Supabase platform config, not in the database or the repo — so row #14's exact ceiling is unmeasured from here. What IS certain is that the query has no `.limit()` and no `.range()`, so it is bounded by something nobody chose. To settle it: read **Project Settings → API → Max rows** in the Supabase dashboard, or insert >1000 rows in a scratch table and count what a client read returns.
2. **Whether the `no_payer` and `order_insert_failed` branches have ever fired in prod.** The returns are not persisted anywhere — they go to `console`/Sentry via `judgeDepositEffects`, not to a table — so there is no historical count. Rows #1 and #9 are proven reachable by code, not by an observed occurrence. To settle it: search Sentry for `feature:deposit-acknowledged-effects`.
3. **Whether the four seeded `booking_fee_ledger` rows (`54200000-…`, `event_id IS NULL`) are deliberate free-5 primers or debris.** They belong to one supplier profile and carry no charges. They change the free-5 ordinal for that supplier, so they are money-relevant. Owner question: `select * from booking_fee_ledger where event_id is null;`
4. **Whether a BIR OR was ever issued offline for any of the six paid orders.** The code says the app receipt is explicitly not the BIR OR, and nothing in the system records the offline one. Only the owner's own books can answer it — and rows #11 and #12 stay open until they do.

---

*Audited 2026-09-21 · read-only · `origin/main` + prod. No app code, migrations or prod
rows were changed. This document is a handoff, and **a handoff is not evidence** — every
row carries the command that re-measures it. Run it before you act.*
