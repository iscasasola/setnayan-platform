# WHAT IS LEFT — 2026-09-21

**The register of what still has to be finished before Setnayan is usable by a real supplier and a
real couple.** Written for a handoff to a new account, so it carries what would otherwise be lost:
the decisions already made, the traps that have each cost a whole session, and an honest account of
what has never been tested.

It replaces `WHAT_IS_LEFT.md` (2026-08-07) and the corpus handoff `WHATS_NEXT_HANDOFF_2026-08-20.md`.
Both are superseded — their build lists are complete.

⚠ **A HANDOFF IS NOT EVIDENCE — including this one.** Every row carries a greppable string or the
SQL that re-measures it. **No row cites a line number** (they rot; a "corrected" line number has
itself been the error here). Re-measure before you act.

**Measured 2026-09-21** against `origin/main` and the live prod database (`njrupjnvkjkitfctetvi`,
read-only), by four parallel read-only audits. Source files: `build-sessions/HANDOFF-AUDIT-MONEY.md`,
`-VENDOR.md`, `-COUPLE.md`, `-LAUNCH.md`.

---

## 0. THE THREE FACTS THAT FRAME EVERY ROW BELOW

**1. No wedding has ever happened.** 11 events, 9 weddings, and every one of them is in the future.
The only past events are a song-desk test, a 0-guest "Movie Night", and a Papic pool test.

**2. Both shops on the platform are the owner's.** `vendor_profiles` = 2, both `tier_source='admin_comp'`,
both wearing a `verified` badge that came from a `vendor_verification_bypasses` row rather than from
the approval flow. **Zero verification applications have ever been submitted.** The path from "I
signed up as a supplier" to "couples can find me" has never once been walked end to end by anybody.

**3. One real fee has been collected, ever.** Charge `S89F-HMS91HGPAK`, ₱837.50 — 5% of a ₱16,750
booking, Saysay's 6th, driven end to end by the owner on 2026-09-19/20. It works. Everything else
on the money path is either unexercised or listed below.

```sql
-- the frame, re-measured in one query
select (select count(*) from events) events,
       (select count(*) from guests) guests,
       (select count(*) from vendor_profiles) shops,
       (select count(*) from orders) orders,
       (select count(*) from vendor_reviews) reviews,
       (select count(*) from vendor_contracts) contracts,
       (select count(*) from booking_fee_charges) fee_charges;
-- has a wedding happened yet?
select display_name, event_date from events where event_date < current_date order by event_date;
```

🔑 **Therefore: most rows below are a measured ABSENCE OF EVIDENCE, not a measured defect.** A row
marked **NEVER EXERCISED** is not broken and is not working — nobody knows. Calling it either one
would be an invention. That distinction is the single most important thing in this document.

**State key**
`BROKEN` wrong behaviour ships now · `NOT BUILT` no mechanism exists · `UNREACHABLE` built, nothing
routes to it · `DECIDED-UNBUILT` the owner ruled, the code does not follow · `NEVER EXERCISED` built,
zero production rows · `DECIDED` settled, listed so it is not re-opened.

**Effort** `S` ≤ ½ day or an owner setting · `M` ≤ 2 days / one focused PR · `L` multi-day, counsel,
or a platform migration.

---

## 1. MONEY — the revenue path

This is the only path that takes money. The owner's ruling, 2026-09-20, verbatim: **"this is the
most important part for us. because this is where we get money."** Treat everything here as
money-tier: disclose before the commitment, put the bill where the supplier already is, and re-drive
the whole run after each change instead of trusting one green test.

### 1a. A fee can be lost, double-billed, or left uncollected with nobody told

| # | Symptom in plain words | Anchor / re-measure | State | Eff |
|---|---|---|---|---|
| M1 | ~~A fee opens and the bill is never minted, and nothing retries it.~~ **FIXED 2026-09-21 (PR #5820)** — `booking-fee-unbilled-repair` runs every 30 min off `after()` on the vendor and admin layouts, oldest-first, fleet-wide. Prod had **0 charges in the broken state** when it landed. | `git grep -n "booking-fee-unbilled-repair" -- apps/web/lib` · `select c.public_id from booking_fee_charges c where c.status='pending' and not exists (select 1 from orders o where o.service_key='vendor_booking_fee__'\|\|c.charge_id::text);` | FIXED | — |
| M2 | **Approving a payment has no order-status precondition.** The promote is `.update({status:'paid'})` with no `.in('status', …)`, and the customer-side submit has no status guard either — so a payment can be logged and approved against a `cancelled`, `refunded`, or already-`paid` order. It re-activates the SKU and re-schedules payouts. | `git show origin/main:apps/web/app/admin/payments/actions.ts \| grep -n -A2 "status: 'paid', updated_at"` | **BROKEN** | S |
| M3 | **A refund does not reverse the booking fee.** `deactivateOrderSku` has no booking-fee branch (activation does). Refund a fee order and the charge stays `paid`: revenue overstated, free-5 ordinal still consumed, ledger says the supplier paid. | `git show origin/main:apps/web/lib/sku-activation.ts \| sed -n '/export async function deactivateOrderSku/,/^}/p' \| grep -c BookingFee` → **0** | **BROKEN** | S |
| M4 | **A credit owed to a supplier is recorded and paid to nobody.** Amend a booking down after the fee is paid and `booking_fee_rederive_lock_fee` writes an `amendment_credit` row. Nothing in the app ever reads it — no refund, no offset, no line on either screen. | `git grep -n "credit_centavos" origin/main -- apps/web \| grep -v test \| grep -v proposal` → **nothing** | **BROKEN** | M |
| M5 | **`expires_at` is printed and then ignored.** Written as `NOW() + 7 days` on every pending charge, read only to put a date in one notification. Nothing flips `pending → expired`, nothing chases, nothing is withheld. The notification fires **once** and never repeats. **There is no dunning of any kind.** | `git grep -n "readChargeDueDate" origin/main -- apps/web` (display only) | **NOT BUILT** | M |
| M6 | **A deposit acknowledged on a pre-contracted row makes that booking free forever.** The RPC skips with `not_contracted`; the ordinal is computed once and never recovers. Logged loudly to Sentry on every render — and there is no repair action anywhere. | `git grep -n "not_contracted" origin/main -- apps/web` | **NOT BUILT** | M |
| M7 | **An unclaimed (admin-owned) supplier profile is billed into a void.** `no_payer` leaves the charge `pending` with no order and no payer, and nothing re-runs it when the supplier later claims the profile. (PR #5820's admin desk now at least *shows* this state with its reason.) | `git grep -n "'no_payer'" origin/main -- apps/web/lib/booking-fee-lock.server.ts` | **NOT BUILT** | S |
| M8 | **An unverified shop is charged no booking fee, ever.** `!args.verified` returns `charge:false` before the ordinal is considered. Safe only while unverified shops are unfindable — any import-attribution booking by an unverified shop is free forever. | `git grep -n "if (!args.flagEnabled \|\| !args.verified)" origin/main -- apps/web/lib/booking-fee-lock.ts` | BROKEN (latent) | S |
| M9 | **The first 5 bookings are invisible on the fee bill.** A waived booking calls `createOrder: false`, so no row exists; `highest_declared_centavos` — the "what it would have cost" figure — has **zero readers in the entire app**. A supplier sees an empty bill for bookings 1–5, then ₱837.50 on #6 with no prior context. ⚠ The owner ruled the opposite: *"still tell them that there should be a booking fee. but this will be considered free."* | `git grep -rln highest_declared -- apps/web/app apps/web/lib` → **empty** | **DECIDED-UNBUILT** | M |

| M18 | **Paying the booking fee does not hold the date.** The owner ruled on 2026-09-18 that the lock on a supplier's schedule happens *upon the vendor paying their booking fee*. `vendor_calendar_blocks` is **0 rows**; `vendors_blocked_on_date` reads only that table; the one automatic writer (`event_vendor_autoblock_on_booking`) returns early unless `status = 'deposit_paid'`, which the lock/fee path never sets — `recordDeposit`'s docblock says the host advances that status separately. **Two live bookings sit in this state today.** 🔑 Capacity *is* held — `acquireSchedulePools` writes `vendor_schedule_pool_bookings` — so a second booking is refused at the door. **The missing half is availability: the supplier looks free while couples are choosing.** | `select count(*) from vendor_calendar_blocks;` → 0 · `git grep -n "event_vendor_autoblock_on_booking" origin/main -- supabase/migrations` | **DECIDED-UNBUILT** | M |
| M19 | **A send-sourced fee charge still dies with its proposal.** A charge may be anchored on `proposal_id` OR `event_vendor_id`; both still `ON DELETE CASCADE`. Migration `the_money_outlives_the_event` fixed the `event_id` half and **names this one as unfinished in its own comment**: *"a charge anchored on `proposal_id` (source='send') still dies with `vendor_proposals`, which is its own slice."* ⚠ The lock-sourced half **is** already safe (booked rows are preserved) — do not re-fix it. | `git show origin/main:supabase/migrations/20271153200818_the_money_outlives_the_event.sql \| grep -n "its own slice"` | **NOT BUILT** | S |

### 1b. Reconciliation and records that will not survive real volume

| # | Symptom | Anchor | State | Eff |
|---|---|---|---|---|
| M10 | **Every bank transfer is matched by eye.** No statement import, no auto-match on reference, no "unmatched transfers" view. (What *is* good: `classifyDuplicate` refuses the same transfer twice, and `orderReconciledToPaid` refuses to promote a short transfer.) Scales to a few a day, no further. | `git grep -n "classifyDuplicate\|orderReconciledToPaid" origin/main -- apps/web/app/admin/payments/actions.ts` | NOT BUILT | L |
| M11 | **The duplicate-reference check reads every money-status payment with no `.limit()`.** Past the PostgREST row cap it silently classifies an arbitrary subset — a money guard that reads a subset passes on the duplicate it never loaded. | `git show origin/main:apps/web/app/admin/payments/actions.ts \| grep -n -A3 "in('status', MONEY_STATUSES)"` | BROKEN at scale | S |
| M12 | **`/admin/payments` cannot page.** Queue capped at 100, unquoted orders at 100, the search's order pre-resolve at 200. Past those an admin literally cannot reach a payment from the UI. | `git show origin/main:apps/web/app/admin/payments/page.tsx \| grep -n "limit(100)\|limit(200)"` | BROKEN at scale | M |
| M13 | **Partial refunds are impossible.** `order_refunds` carries `UNIQUE(order_id)`; the migration calls partials "V1.x". Refund ₱5,000 of ₱24,000 and the second tranche cannot be recorded at all. | `git grep -n "order_refunds_order_id_uq" origin/main -- supabase/migrations` | DECIDED-UNBUILT | M |
| M14 | **`market_price_bands` is empty and only a human button fills it.** `recompute_market_price_bands()` fires from `/admin/pricing?tab=price-bands`; this repo has no scheduler by design. The Price-Position Meter is empty until someone presses Recompute, and stale a second later. | `select count(*) from market_price_bands;` → **0** | UNREACHABLE in practice | S |
| M15 | **A supplier has nothing to hand an accountant** — no statement, no period total, no export. | `git ls-tree origin/main apps/web/app/vendor-dashboard/tax-documents/` | NOT BUILT | M |
| M16 | **The owner has nothing to hand theirs either.** `/admin/money` is a nav landing of cards, not numbers. No revenue statement, no period close, no fee/receipt/refund roll-up. **The owner cannot state revenue without writing SQL.** | `git show origin/main:apps/web/app/admin/money/page.tsx \| head -20` | NOT BUILT | M |
| M17 | **Maya automation is dark; every peso went through a human.** The only rail is the manual QR overlay: couple scans, pays, uploads proof, an admin matches. | `NEXT_PUBLIC_MAYA_STATUS` **absent** from prod | DECIDED-UNBUILT | L |

### 1c. Records and tax — correct today, listed so nobody re-litigates it

- **VAT is 0 and that is right** — Setnayan is not VAT-registered; all six issued receipts carry
  `vat_rate_pct = 0.00`. ⚠ **But `receipts` still `DEFAULT 12.00`, and nothing watches the
  ₱3,000,000 registration threshold** — crossing it makes every receipt wrong, silently.
  Watch with `select sum(gross_total_php) from receipts where issued_at >= date_trunc('year', now());`
- **Form 2307: decided, build nothing.** Per RR 16-2023 Setnayan has no 2307 obligation toward
  suppliers. The table and lib are kept deliberately as audit history. 0 rows is correct.
- **Payouts are retired** (2026-05-28 V2 cutover) — but `/vendor-dashboard/earnings` still renders a
  payout section that can only ever be empty, which trains suppliers to distrust the page. `S`.

---

## 2. THE SUPPLIER

### 2a. Broken now

| # | Symptom | Anchor | State | Eff |
|---|---|---|---|---|
| V1 | ~~Earnings says ₱0 to a shop that was paid.~~ **ALREADY FIXED by PR #5680 (2026-09-19), re-measured 2026-09-21: Saysay reads ₱5,350 / 2 payments.** PR #5818 then closed the remaining hole — an *unreadable* ledger now renders an em-dash and "we couldn't load", never ₱0. ⚠ **This row was reported to the owner as broken on 2026-09-21 and was wrong.** Verify a headline finding against current code before raising it. | `git grep -n "fetchVendorLedgerEarnings" -- apps/web/lib` | FIXED | — |
| V2 | **The supplier's fee bill renders an empty page on a refused read.** `fetchVendorFeeOrders` ends `if (error) return [];` — an RLS refusal says "nothing due" instead of "we could not read". Same disease as V1, on the other money page. | `git grep -n "if (error) return \[\]" -- apps/web/lib/vendor-booking-fees.server.ts` | **BROKEN** | S |
| V3 | **The only place a supplier sees money they actually received is inside one chat thread.** `event_vendor_payments` is read on the vendor side only by `messages/[threadId]`. To answer "what have I been paid?" they must open every thread one at a time. | `git grep -ln event_vendor_payments -- apps/web/app/vendor-dashboard` | **NOT BUILT** | M |
| V4 | **Going live is silent.** `transitionVendorVisibility` writes an audit row and a tier-history row and calls **no notifier**. The best news the product ever has for a supplier reaches them only if they happen to log in. | `awk '/async function transitionVendorVisibility/,/^}/' apps/web/app/admin/verify/actions.ts \| grep -c notify` → **0** | UNREACHABLE | S |
| V5 | **Nothing ever tells a supplier their event is over and needs marking complete.** No `mark_complete` kind exists on the answers desk. | `grep -n "kind: '" apps/web/lib/vendor-overview.ts` | **NOT BUILT** | M |
| V6 | **The whole after-the-event chain is dammed behind that one control.** `coupleConfirmReceived` requires `service_marked_complete_at`; **0 of 51** rows have it. No couple has ever been able to confirm delivery — which is what unlocks the review. **No reviews ⇒ no track record ⇒ no next booking. The retention loop has never closed once.** | `select count(*) filter (where service_marked_complete_at is not null) from event_vendors;` → **0** | NEVER EXERCISED | M |
| V7 | **`is_published` is vestigial but still leaks.** `isShopLive` reads `public_visibility` + `verification_state`; `/api/v1/vendor/profile` still returns the legacy boolean. A supplier reading their own API is told "not published" about a live shop. | `grep -n "is_published" apps/web/app/api/v1/vendor/profile/route.ts` | BROKEN (minor) | S |
| V8 | **A lapsed tier keeps its public benefits until someone logs in.** Deliberate and documented (`sweep_vendor_tier_expiry` is login-driven), but `/v/[slug]` and the sitemap can serve a lapsed shop's benefits indefinitely. SetnaProd expires **2026-10-19**. | `grep -n "sweep_vendor_tier_expiry" apps/web/app/v/\[slug\]/page.tsx` | DECIDED-UNBUILT | S |

### 2b. Day one for a real supplier — the gate nobody has walked

A new shop is born `public_visibility='hidden'` + `verification_state='unverified'`, and `isShopLive()`
needs **both** to read `verified`. So it is invisible to every couple until:

1. the supplier submits documents (`submitApplication` → `pending_review`), **and**
2. a human — in practice the owner — approves the application, **and**
3. a human *separately* flips `public_visibility`, **which notifies the supplier of nothing** (V4).

**No automation, no SLA, no second admin, no notifier.** `M`. This is the row that decides whether
supply ever exists.

### 2c. Built, switched on, never used once

Everything here has zero production rows. None of it is known to be broken; none of it is known to work.

| What | Re-measure | Eff to prove |
|---|---|---|
| **Packages** — the shop's main pricing instrument; flag is `"true"` in prod | `select count(*) from vendor_packages;` → 0 | M |
| **Services are bare shells** — the 2 live rows have `title = NULL`; every structure table (`_inclusions`, `_addons`, `_discounts`, `_price_brackets`, `_time_slots`, `_payment_schedules`, `_attributes`) is empty | `select count(*) from vendor_service_inclusions;` (repeat) | M |
| **Contracts** — 0 rows; `contract_signed_at` is 0 of 51. ⚠ There is **no e-signature**: "signed" means a row went active, not that a person signed | `select count(*) from vendor_contracts;` → 0 | M |
| **Verification** — 2 applications, both `draft`, never submitted. Both live badges are bypasses whose own reason cites the owner's 2026-09-11 six-month ruling. **Nothing is scheduled to check at that deadline (~2027-03-11)** | `select status, count(*) from vendor_verification_applications group by 1;` | M |
| **Reviews** — 0 rows; the only INSERT in the tree is the demo seeder | `select count(*) from vendor_reviews;` | M |
| **Subscriptions** — 2 rows, both the owner's shop, both `order_id` NULL. No payment rail was ever touched | `select vendor_id, sku_code, status, order_id from vendor_subscriptions;` | M |
| **Branches / crew / manpower** — `vendor_branches`, `manpower_gigs`, `vendor_lines`, `registered_crew_devices`, `vendor_event_sets` all 0 | `select count(*) from vendor_branches;` (repeat) | L |
| **Disputes / change orders / handovers** — all 0. **These fire first when a real booking goes wrong.** | `select count(*) from vendor_disputes;` (repeat) | L |
| **Day-of Papic capture + per-guest delivery** — both controls read `status='active'`; 0 captures, 0 deliveries | `select control_key, status from data_privacy_controls;` | M |

⚠ **The free-5 ledger was seeded by hand.** Ordinals 2–5 are synthetic (`54200000-…`, `event_id IS NULL`,
all four stamped at one instant), inserted to burn the allowance so booking #6 could reach the paid
path. That test succeeded — but **bookings #2 through #5 on a real shop have never been exercised**,
and that is exactly where every real supplier will spend their first months.
`select booking_ordinal, event_id, is_free_booking, created_at from booking_fee_ledger order by 1;`

### 2d. Off, honest, or deliberately dark

- **The subscription paywall is OFF in production.** `VENDOR_TIER_FEATURE_GATE` is absent, so all five
  `VendorTierGate` mounts are inert and every free shop gets Solo tooling free. **The ₱1,000/mo ladder
  collects nothing and cannot.** Owner call, not a bug — `S` to flip, `L` to trust.
- `real-stories` and `recaps` are "Coming soon" in full; Instagram connect is inert (no `META_APP_*`).
  All three are labelled honestly and occupy menu slots.

---

## 3. THE COUPLE

| # | Symptom a real couple hits | Anchor | State | Eff |
|---|---|---|---|---|
| C1 | **Searching the marketplace returns one supplier.** Every "find your team" surface works and is commercially empty. | `select count(*) from vendor_profiles where is_published` → 1; `vendor_services where is_active` → 2 | NOT BUILT (supply, not code) | L |
| C2 | **`/contracts` and `/documents` promise a document that can never arrive.** The empty state says vendors will upload PDFs once you agree in chat — but for the 8 `host_manual` + 43 unsourced suppliers a couple actually uses, **no vendor account exists**. And the couple cannot upload their own signed PDF. | empty-state string `Vendors will upload PDFs here`; `select count(*) from vendor_contracts` → 0 | UNREACHABLE | M |
| C3 | **There is no way to send an invitation.** 142 guests hold a `qr_token` each; **2 have an email, 1 has a mobile.** No send path of any kind, and no bulk "mark as given" — a 142-name list is 142 individual toggles. The Invite step can therefore never complete. | `markGuestInvitationSent` is the only guest writer; `select count(*) from guests where invitation_sent_at is not null` → 0 | BUILT BUT INCOMPLETE | M |
| C4 | **Save-the-date fans out emails — to 2 of 142 guests.** One event has ever launched an STD and it had 0 guests. Honest today; a lie the moment it is sold as "we'll tell your guests". | `fanOutSaveTheDateEmails` in `lib/save-the-date-emails.ts` | NEVER EXERCISED | S (copy) |
| C5 | **`/dashboard/[eventId]/website/stories` has no link from anywhere in the app.** A shipped host control — choosing which supplier-authored stories appear on the celebration (owner, 2026-08-15) — that nobody can open. | `git grep -n "website/stories" -- app lib` → only its own `actions.ts` + 2 tests | UNREACHABLE | S |
| C6 | **73 couple-dashboard Supabase calls discard their `error`.** The highest-stakes are guest writes (`guests.update` in `claims/actions.ts` ×4) — a refused write leaves the screen unchanged and says nothing. | `grep -c "dashboard/\[eventId\]" apps/web/lib/supabase-unread-error.baseline.txt` → 73 of 369 | BROKEN (degraded) | L |
| C7 | **`completion_status = 'auto_confirmed'` has readers in 8 files and no writer anywhere.** Harmless to the couple (`reviewState` derives the same outcome from elapsed time) but any surface filtering on the literal string under-counts forever — including admin metrics. | `git grep -n auto_confirmed -- app lib` → readers only | PARTLY DEAD | S |
| C8 | **`shortlisted` is unreachable.** `vendor_status` defines it, prod has only `considering · contracted · deposit_paid`, and its only writer is behind `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED`, absent from prod. Several readers still filter on it, so `checklist-state.ts`'s `one_option`/`searching` states can never be entered. | `select status,count(*) from event_vendors group by 1;` | UNREACHABLE | M |
| C9 | **No video has ever been rendered**, and there is no `remotion` workspace under `apps/`. The V1 promise of template-driven renders is not shippable today. | `select count(*) from patiktok_render_jobs;` → 0 · `ls apps/` → `mobile`, `web` | DECIDED-UNBUILT | L |
| C10 | **Panood → your own YouTube channel is a "Coming soon" placeholder** pending Google's OAuth verified-app review. Honest today — **and becomes a lie the day review clears and nobody flips it.** | `ComingSoonPlaceholder` in `studio/panood/setup/page.tsx` | DECIDED-UNBUILT (external) | S |
| C11 | **The guest-side run-of-show trigger is off** — `NEXT_PUBLIC_GUEST_NOW_TRIGGER` absent from prod. | `vercel env ls production \| grep GUEST_NOW_TRIGGER` | FLAG OFF | S |
| C12 | **3 recorded supplier deposits sit unacknowledged** (`vendor_confirmed_at IS NULL`). Data, not a defect — but worth one look at whether the nudge reaches them. | `select count(*) from event_vendor_payments where vendor_confirmed_at is null;` → 3 | DATA | S |

**Never exercised on the couple side** (zero rows, verdict unknown): guest Papic purchasing — **switched
ON in prod and has never taken a single peso** (`papic_guest_orders` = 0) · Papic play (631 challenges,
75 missions seeded, **zero completions**) · the entire after-the-event arc (`event_recaps`,
`guest_souvenir_claims`, `live_studio_highlights`, `person_story_items` — all 0) · government paperwork
upload · `event_costs` and `budget_builds`.

---

## 4. LAUNCH BLOCKERS

| # | Area | What is true today | What is missing | Eff |
|---|---|---|---|---|
| L1 | **A false public claim** | `/signup` states verbatim **"We never sell your data — RA 10173 compliant."** on a live page. | The repo's own compliance catalog (`lib/npc-filing-tasks.ts`, 15 tasks) shows it is premature: counsel not engaged (`t0-1`), DPO designation + Privacy Manual + Breach Policy unsigned (`t3-12`), DPS unfiled (`t3-13`), sub-processor DPAs unexecuted (`t2-8`). **An unqualified compliance claim next to an unfiled DPS is evidence against the company if a complaint reaches the NPC.** | **S** to soften the line · L for the filing |
| L2 | **Browsewrap, not clickwrap** | The only checkboxes on `/signup` are "Include my wedding in Stories" and "Stay signed in". Terms/Privacy is a footnote below the submit button — no checkbox, no `required`. | One required, logged "I agree" checkbox. Browsewrap is materially weaker in PH courts and under the NPC's consent standard. | **S** |
| L3 | **Email is never verified** | Every signup is **auto-confirmed via the admin API** immediately after `auth.signUp` — a documented V1 work-around for Supabase's spam-foldering sender. Nothing verifies the signer controls the address. | Point Supabase Auth at Resend. The runbook is already written in `OWNER_ACTIONS.md`. | **M** |
| L4 | **Supabase is on the free plan** | `get_organization` → `{"plan":"free"}`, measured live. | Independently-verified backup/PITR coverage. Real couples' PII, 6 paid orders and vendor financial data sit on a database with no confirmed backup SLA — and free projects can be **paused for inactivity after 7 days**. | **S** to confirm the Backups tab in writing · M/L to upgrade |

**Should fix in week one**

- **Email delivery status is unreadable — for one permission reason.** All 20 `email_deliveries` rows
  have `last_event = NULL` and every `error` reads *"This API key is restricted to only send emails"*.
  The checker job runs every ~10 min and is refused every time. **The read-back mechanism, verdict
  logic and admin UI are all shipped and tested.** Fix = regenerate the Resend key with read scope,
  paste into Vercel. `S`.
- **Nobody is told when the site goes down.** `/api/v1/health` exists; no external uptime service
  polls it anywhere in the repo. The only two automated watchers (`deploy-drift-monitor`,
  `migration-drift-monitor`) are green and hourly — but they watch drift, not uptime. `S`.
- **Postgres advisories:** 3 `security_definer_view` ERRORs, 42 RLS-enabled-no-policy tables (deny-all
  by default, so many are likely intentional), 80 functions with mutable `search_path`, and
  **leaked-password protection is disabled** — Supabase Auth will accept a password from a known
  breach list. The toggle and the 3 views are cheap and high-value; the 42 need per-table judgment.
- 2 open Dependabot alerts, both `medium`, zero high/critical.

**Verified healthy — do not re-audit:** the cookie-consent gate is real (PostHog stays dark until
decided) · zero demo rows in prod, and demo mode is admin-cookie-gated · `/features` was swept
2026-09-06 and is fenced by `features-page-says-what-ships.test.ts` · the deletion handshake protects
paid suppliers (an event with money moved cannot be self-deleted; it routes to a human queue) ·
Turnstile is configured and the 375px zero-height mobile bug is fixed and tested · the email
allowlist is transactional-only and correct · all 25 periodic jobs have claimed inside their windows.

---

## 4b. WALKED THE LIVE SITE — observed, not inferred

Everything above this section was read from code, the database and env state. **This section was seen
on `https://setnayan.com` on 2026-09-21, logged out.** It is the only part of this document backed by
a rendered page, which is why it is worth more per row than the rest.

| # | What a visitor sees today | Where | State |
|---|---|---|---|
| W1 | **"0% commission" is claimed in five places on public pages** — "Verified suppliers · 0% commission" and "no commission on your suppliers, ever" on the home page, "**No commission on your bookings, ever**" on the *Open your shop* card, and twice more on `/features`. Suppliers are charged **5% of the booking** to ₱100,000, then 1%. The couple-facing reading is defensible (Setnayan never touches the couple's payment); the **supplier-facing** line is not. And `/pricing` is entirely couple-facing — **there is no supplier pricing page, so the fee is disclosed nowhere public.** A supplier learns it exists when the bill arrives. | `/` · `/features` · `/open-shop` (redirects anon to sign-in) | 🔑 **OWNER DECISION**, then copy everywhere |
| W2 | **A shop page contradicts itself.** `/setnaprod` lists "SERVICES OFFERED · Pabati · Day Of Coordinator" near the top and, lower down, "SetnaProd hasn't listed a service you can ask about yet." The Inquire CTA sits between them. **The same shop is featured on the home page as a verified "first shop" and does not appear on `/explore` at all** — explore is service-card driven. So the front door's featured shop is a page that argues with itself and cannot be contacted. | `/` → `/setnaprod` → `/explore` | **BROKEN** · S–M |
| W3 | **A public promise the product cannot keep.** Every shop page states *"Bookings through Setnayan generate a review request 24 hours after the event."* Nothing generates it (the review is gated behind `service_marked_complete_at`, set on **0 of 51** bookings, and no supplier is ever told to set it — §2a V5). The code's own rule is **7 days / 30 days**, not 24 hours. `vendor_reviews` is empty. | every `/[shop-slug]` | **BROKEN (copy)** · S |
| W4 | **The public shop address is a test artifact.** Saysay's live, shareable URL is `/saysay-live-band-and-hosting-fix`. ⚠ **Do not rename it** — it is the only shop with real bookings and a slug change breaks every link already shared. Whether a permanent redirect exists is unmeasured; if it does not, that is itself the build. | `/saysay-live-band-and-hosting-fix` | 🔑 **OWNER DECISION** |
| W5 | **No way to report a shop** — confirmed by searching the rendered page (`find "report"` → no matches). `ReportPageButton` accepts `event \| user_profile \| chapter`, is never mounted on a shop page, and prod's `user_reports_target_type_check` has no vendor value. | every shop page | **NOT BUILT** · M |

### Corrections this walk forced on THIS document

🔑 **Three claims made earlier the same day did not survive contact with the rendered page.** Recorded
because the retraction is the useful part, not the finding.

- **The desktop downloads work.** `/api/download/mac` and `/api/download/windows` both return **200**.
  A claim that visitors are told the download is unavailable does not hold today.
- **The signup consent box is unchecked by default** (`public_summary_consent`, verified in the DOM).
  The old hidden-consent defect is genuinely fixed and fenced. Do not re-open it.
- **The Explore card names the correct trade** — the live cards read "Live Band" and "Host / MC". A
  report that it names the shop's first service instead **did not reproduce** on the unfiltered
  marketplace. It may still be true under an active category filter; that is unproven either way.

---

## 4c. HOW MUCH OF A REGISTER IS ALREADY BUILT — measure this before you trust any list

On 2026-09-21 two agents re-measured the 2026-09-18 handoff bundle (456 register rows plus eight
dispatch briefs) against `origin/main` and prod:

| | |
|---|---|
| build-shaped items claimed open | **~106** |
| dropped as duplicates of a current list | ~18 |
| actually re-measured | **~75** |
| **turned out already built** | **~49** |
| survived | **6** |

**Roughly two in three "NOT BUILT" rows were already built.** Twenty-one closed simply by finding a
merged PR that named the row's own ID in its title — try that first, it is the cheapest close there is:

```bash
git log origin/main --oneline --grep="<ROW-ID>"
gh pr list --state merged --limit 100 --search "<ROW-ID>"
```

🛑 **And the confident rows decay too.** One row was marked *"🔴 CONFIRMED OPEN — re-measured by TWO
phrasings"* and had in fact shipped; neither phrasing was the one that shipped. Another register's
prescribed evidence was a `curl` that still returns 200 for a ruled, correct reason — so the diligent
check handed out a green light for an already-fixed bug. A third named table `messages` when the real
table is `chat_messages`, so it returned nothing, **and an empty result reads exactly like "no
protection exists."**

🔑 **A zero only proves something on a row that asks for an ABSENCE.** A row asking for a PRESENCE
that greps nothing proves only that the phrasing you tried is not the phrasing that shipped. **Try at
least two different greppable symbols before calling anything missing.**

---

## 5. OWNER DECISIONS ALREADY MADE — **DO NOT RE-ASK THESE**

**The booking fee**
- The fee is **5% to ₱100,000 then 1%, with a ₱50 floor**; the **first 5 bookings are free**.
- A waived booking **must still tell the supplier a fee exists** — "considered free", not silent (M9).
- **Yes to an email receipt for waived bookings.**
- Paying the booking fee is what **unlocks the rest of the controls for that event** (7 named items).
- Before the fee: a supplier gets **only what they need to write a quotation, free**. Everything else
  begins after the fee.
- Showing the couple's **budget band while quoting is okay**; **venue is area-only** until the fee.
  Other shops' names stay hidden. The brief fields are **sealed in SQL**, one platform-settings switch.
- **No need to pause new inquiries** on an unpaid fee.

**An unpaid booking fee — answered 2026-09-22**
- **An unpaid booking fee DOES remove access.** Owner, verbatim: *"unpaid booking fee loses access to
  event hub, portfolio, accessing more details for the event, gathering and sharing data, reviews,
  stats, and more."* This settles the question the 2026-09-21 register carried as open, and it is
  **option (B), not (A) or (C)** — access waits for payment rather than the fee merely standing as a bill.
- ⚠ **It does NOT pause new inquiries.** That was ruled separately and earlier — *"no need to pause new
  inquiries on an unpaid fee"* — and the list above does not contradict it. **Both hold: a supplier with
  an unpaid fee keeps taking inquiries and loses the working surfaces.**
- 🔑 **"and more" is not buildable as written.** The seven named surfaces are clear; the open tail is
  not. Before this ships, the list must be closed — every gated surface named, and every surface
  deliberately left ungated named too, because a gate nobody wrote down is indistinguishable from a
  bug the first time a supplier hits it. **Take the closed list back to the owner; do not infer it.**
- This unblocks **M5** (dunning): the question "is dunning even needed" is answered yes, and the
  removal is the consequence a dunning notice must warn about before it lands.

**Money and pricing**
- The deposit **follows the amount the quote requested, and that is the minimum**.
- One control reading **"Amount to pay"**, showing the **next due installment** — not just the deposit.
- **Charm pricing (-1 endings) is no longer a rule.** Never derive a price from a file or a comment —
  read `platform_retail_catalog_v2`, the only price a customer is charged.
- **Live Studio is a permanent ₱2,500 unlock**, not per-day; the hosted channel is optional at ₱3,000/day.
- **Venue screens come with the paid Live Studio unlock** (confirmed twice, 2026-09-20).
- Vendor-portfolio Papic: **5% of fee, cap 1,000 credits, granted on payment approval**; the ₱500 pack
  is 100 credits; video stays 800.
- **Form 2307: build nothing.** **VAT 0 is correct.** **Payouts are retired.**

**The guest list**
- Pairing, walking order and table arrangement **coexist** — pairing does not remove the columns.
- Immediate-family roles are **published** (the "Family section" question was answered 2026-09-20).
- A linked guest's account photo is **opt-in** — `users.share_profile_photo_with_hosts`, nullable with
  no default, silence means no. The couple's own upload always wins.

**Other**
- Inspiration gallery: 20 per category, never delete seeded photos, two watermarks, admin queue.
- Verification badges **stay for six months while the papers come in** (2026-09-11).
- **We do not own `setnayan.ph`.** Brand is SETNAYAN, never STNYN.
- Cloudflare is **storage only** — `setnayan.com` is not a Cloudflare zone, so no proxied-traffic
  feature (WAF, bot management, CSAM scanning) is available without migrating DNS off GoDaddy.

---

## 6. OWNER DECISIONS STILL OPEN

| Question | Why it matters | Where it bites |
|---|---|---|
| ~~**Does an unpaid booking fee remove anything?**~~ ✅ **ANSWERED BY THE OWNER 2026-09-22 — see §5.** | — | — |
| **Flip the subscription paywall on?** `VENDOR_TIER_FEATURE_GATE` is absent from prod, so the ₱1,000/mo ladder collects nothing | The second revenue line does not exist yet | §2d |
| **Void vs credit memo for a refunded receipt** — `receipts` has no `voided_at`, no status, no reason, and there is no credit-memo table | BIR audit exposure | M13 |
| **The OR series starts at 8** — 1–7 were burned by rolled-back transactions and there is no record. A BIR series is supposed to be accountable end to end | BIR audit exposure | `select min(or_serial), max(or_serial), count(*) from receipts;` |
| **Was a BIR OR ever issued offline for any of the six paid orders?** The app receipt is explicitly *not* the BIR OR, and nothing records the offline one | Only the owner's books can answer; the two rows above stay open until they do | — |
| **Are the four seeded `booking_fee_ledger` rows deliberate primers or debris?** They belong to one supplier and change that supplier's free-5 ordinal | Money-relevant | `select * from booking_fee_ledger where event_id is null;` |
| **A payment-dispute / chargeback surface.** `vendor_disputes` is about *service* completion; a reversed bank transfer has nowhere to go | Rare on manual GCash/BDO, load-bearing the day a gateway is added | M29 in the money audit |
| **Per-quote vs per-service-card Papic gift toggle** | — | — |
| **May a supplier inside the free five buy a Papic deal outright?** | — | — |
| **`formatRetailLabel` rounds a customer-facing price** | ₱838 vs ₱837.50 is the class that already cost a fix | `lib/budget.ts` |
| **Pool-channel reuse** — one couple's strike can delete another couple's wedding film | Irreversible loss | memory `pool-channel-reuse-is-an-open-owner-question` |
| **Is "0% commission" the promise you want to keep?** It is claimed five times on public pages, including "No commission on your bookings, ever" addressed to suppliers — beside a 5% booking fee. And no supplier pricing page exists, so the fee is disclosed nowhere public | The revenue model versus the public promise. Nothing should be reworded until this is answered | §4b W1 |
| **Rename the `-fix` shop slug, or leave it?** Renaming breaks every link already shared for the only shop with real bookings; whether a permanent redirect exists is unmeasured | — | §4b W4 |
| **A decision taken when nobody had ever been billed** rested on "production has never had a lock". That is no longer true — ₱837.50 was charged and paid on 2026-09-20, with `free_tier_booking_cap_enabled = FALSE` | It should be re-put with the real number attached rather than inherited | `platform_settings` |
| **Turn the captcha on?** Turnstile is configured and the mobile bug is fixed; enforcement is still off in Supabase. **The venue-door throttle is likewise built and shipped OFF** (`VENUE_DOOR_THROTTLE_ENABLED`) — flipping either is a choice, not a build | — | — |
| **When a guest withdraws her photograph, is the FILE deleted** — given she can undo it? The corpus states this both ways | — | — |
| **Buy `setnayan.ph`?** It is unregistered, so anyone can take it | — | — |
| **The stale `~` checkout: delete, update, or keep as a backup?** | It has cost whole sessions (see §8) | — |

---

## 7. FIXED AND LIVE — **DO NOT REBUILD THESE**

- **The payout money-direction guard.** `vendorPaysSetnayan()` short-circuits `schedulePayoutsForOrder`,
  so a booking-fee order can no longer schedule a payout back to the supplier who just paid us.
  ⚠ **The stale local checkout does NOT have this — do not "re-fix" it from a local read.**
- **Both acknowledge doors run the effects.** The customer card and the payment card both route through
  `runDepositAcknowledgedEffects`, held by `deposit-acknowledge-fires-from-every-door.test.ts`. This is
  what the platform's first real booking fell through on 2026-09-18.
- **One peso formatter**, with a guard against a second; the installment anchor widened from a spelling
  to the property; exact installments; the reference/label fusion fix. All four are on `origin/main`.
- **Money is no longer rounded before storing.** `computePlanInstances` froze plans in whole pesos and a
  no-op Save rewrote ₱13,400.50 → ₱13,401. Prod had **0 stored payment plans**, so no live money was
  harmed. Root cause was two exported `centavosToPhp` functions, one correct.
- **The shortfall guard** — a short transfer is matched but the order is not promoted: no receipt, no
  payout, no SKU.
- **Deposit refusal is a mark, not a deletion** — it keeps the couple's amount, receipt, method and
  ledger row and never un-locks the booking.
- **A covered package row is not an over-billing risk** — `booking_fee_open_lock_charge` refuses
  `package_role='covered'` before any money logic runs.
- **The completion handshake is cron-free and correct** — `reviewState` computes M=7d/N=30d against
  `now()`, so "auto-confirms after 7 days" is true with no scheduler behind it.
- **The money resolver is sound** — `resolveEventMoney` enforces `committed + overpaid === paid + stillOwed`
  and never lets an estimate into `committed`.
- **`deposit_paid_php` vs the payment log is reconciled** — prod does disagree for two suppliers, and
  `lib/paid-to-vendor.ts` is the one reader every money surface goes through, so nothing prints ₱0.
- **Entourage walking order, Move ↑/↓ and pairing are live.** Pairing already existed
  (`guests.pair_with_guest_id`, `pair_guests()`) — check before building it again.
- **`invitation_sent_at` has a writer.** C3 is about volume, not the writer's existence.
- **Every "orphan" route chased turned out to be a deliberate redirect.** `/website/stories` (C5) is the
  single real exception.
- **`pending_tier` is written by SQL, not TypeScript** — `the_plan_change_ladder`. Not a defect; recorded
  so nobody "fixes" it. **A TS grep cannot see a SQL writer, or an RLS policy's caller.**

---

## 8. TRAPS THAT HAVE EACH COST A WHOLE SESSION

**Read the right tree.**
- **`/Users/icecasasola` is a checkout of this repo and is ~749 commits behind.** A subagent aimed at it
  once returned a coherent, fully control-flow-traced, completely wrong finding — real line numbers,
  from a file whose code had since been deleted. **Never read code from `~`, and never give a subagent
  that path.**
- **The working checkout can be just as stale.** The one this audit started in was **2,290 commits
  behind `origin/main`** and produced three confident wrong findings before the divergence was caught.
  Run `git rev-list --count HEAD..origin/main` first; prefer `git show origin/main:<path>`.
- A fresh worktree has no `node_modules`, so tsc/tests/lint there "pass" while resolving nothing.

**Read the right evidence.**
- **A flag's default in code is not its value in production.** `vercel env ls production` tells you
  set/not-set; `NEXT_PUBLIC_*` is readable in plaintext; server-side vars are not readable from a
  session at all — say so rather than guess. **Set ≠ true.**
- **A code comment is not a measurement.** Six applied migration headers still carry a belief that was
  disproven twice; applied migrations are never edited, so those comments stay wrong forever.
- **A handoff decays fastest exactly where it is read most.** The previous `CLAUDE.md` pointed every new
  session at two jobs that were already finished and fenced.
- **A green PR can revert a merged one.** PR #5719 merged green while silently restoring pre-#5717 files
  and deleting a helper. Diff `--stat` for files outside the brief.
- **Two false alarms in one day is the pattern, not bad luck.** Verify a headline finding against current
  code before raising it (V1 above was one).

**Safety rules that do not bend.**
- **Never apply a migration directly to production.** A direct apply once stranded seven merged PRs for
  three hours. Let the pipeline push the committed file.
- **Never run `supabase migration repair`** — it rewrites the prod migration ledger. Surface it and stop.
- **Prod is read-only for agents.**
- **Never type credentials.** The owner signs in. Test as testnayan1–4 **by email + password, never the
  Google button** — and never as the owner's `is_internal` account, which passes every paid gate and has
  hidden real defects.
- **Never weaken a guard to go green.** If it is too noisy, raise its threshold and say so.
- **Never `pkill` by pattern.** One heavy job at a time on this 16 GB Mac — three concurrent `tsc` runs
  shut the laptop down.
- Prune each worktree as its PR merges; at zero free bytes every Bash call fails, including the `rm`
  needed to recover.

---

## 9. HOW TO RE-MEASURE THIS WHOLE FILE

```bash
git worktree add --detach /tmp/wt-read origin/main   # never read from ~ or a stale branch
cd /tmp/wt-read
git rev-list --count HEAD..origin/main               # must be 0
vercel env ls production                             # set/not-set for every flag cited above
gh pr list --state open --limit 40 --json number,title,headRefName   # who is mid-flight
```

```sql
-- §0 frame, then the per-section counts each row names
select (select count(*) from events) events, (select count(*) from guests) guests,
       (select count(*) from vendor_profiles) shops, (select count(*) from orders) orders,
       (select count(*) from vendor_reviews) reviews, (select count(*) from booking_fee_charges) charges;
select status, count(*), sum(amount_charged_centavos)/100.0 from booking_fee_charges group by 1;
select status, count(*), sum(requested_total_php) from orders group by 1;
select min(or_serial), max(or_serial), count(*) from receipts;
```

---

## 10. WHAT NOBODY COULD VERIFY

Say these are unknown rather than guessing them.

1. **The prod *values* of feature flags** — only whether each is set. Decrypted reads were refused.
2. **Anything behind a login.** No audit signed in; no claim rests on a rendered page.
3. **Whether the `no_payer` and `order_insert_failed` branches have ever fired.** They go to Sentry, not
   to a table, so there is no historical count. Search Sentry for `feature:deposit-acknowledged-effects`.
4. **The PostgREST row cap on this project** (M11's exact ceiling). Read Project Settings → API → Max rows.
5. **Supabase Auth's captcha-enforcement and leaked-password toggles.** No MCP exposes Auth config; the
   owner must open the dashboard.
6. **R2 bucket versioning/lifecycle for 4 of 5 buckets.** No Cloudflare tool available.
7. **Whether the 11 sub-processor DPAs are executed.** A document question, not a greppable one.
8. **Whether Sentry is receiving events right now.** The smoke-test button needs an admin session.
9. **Whether rows marked NEVER EXERCISED are defective.** They have never run. That is the honest verdict.

---

*Compiled 2026-09-21 from four read-only audits against `origin/main` + prod. No app code, migration
or prod row was changed in producing it. **A handoff is not evidence.** Every row carries the command
that re-measures it — run it before you act.*
