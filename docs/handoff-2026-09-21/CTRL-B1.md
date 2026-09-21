# CTRL-B1 — MONEY THAT MUST NOT BE WRONG

**Model · effort: Opus · high.** Money-tier: every build here can take the wrong amount from a real
person or fail to take a right one. Do not run this on a lower tier.

```
cd ~/Documents/Claude/Projects/setnayan-platform && claude --model claude-opus-5
```

**Read first:** `build-sessions/BUNDLE-COMMON.md` (one PR, one commit per build, drop don't nurse),
then `build-sessions/AREA-AUDIT-TEMPLATE.md`.

**One branch, one PR, seven commits.** Branch from `origin/main`.

---

## The context you need

One real booking fee has ever been collected: charge `S89F-HMS91HGPAK`, ₱837.50, 5% of ₱16,750,
Saysay's 6th booking. The owner drove it end to end himself on 2026-09-19/20 and said: **"this is
the most important part for us. because this is where we get money."**

Fee shape: **5% to ₱100,000 then 1%, ₱50 floor. First 5 bookings free.** Settled states are
`paid | waived_free5 | waived_import`.

⚠ **Prod is READ-ONLY.** Use `select` to size a problem, never to fix one.

---

## Build in THIS order. The order is the cut line.

### 1 — A refund does not reverse the booking fee
`deactivateOrderSku` has no booking-fee branch, although **activation does**. Refund a fee order and
`booking_fee_charges.status` stays `paid`: revenue is overstated, the free-5 ordinal stays consumed,
and the ledger says the supplier paid us when they did not.

- Anchor: `git show origin/main:apps/web/lib/sku-activation.ts | sed -n '/export async function deactivateOrderSku/,/^}/p' | grep -c BookingFee` → **0**
- The activation side already knows how: find `chargeIdFromBookingFeeLockServiceKey` and mirror it.
- **Property the guard holds:** deactivating a booking-fee order moves the charge OUT of `paid`, and
  the free-5 ordinal is released. Assert both — releasing the money without releasing the ordinal
  silently costs the supplier their free booking.

### 2 — Approving a payment has no order-status precondition
The promote is `.update({status:'paid'}).eq('order_id', …)` with **no `.in('status', …)`**, and the
order is read for the notification without `status` in the select. The customer-side submit has no
status guard either. So a payment can be logged and approved against a `cancelled`, `refunded`, or
already-`paid` order — re-activating the SKU and re-scheduling payouts.

- Anchor: `git show origin/main:apps/web/app/admin/payments/actions.ts | grep -n -A2 "status: 'paid', updated_at"`
- Second door: `git show origin/main:'apps/web/app/dashboard/[eventId]/orders/actions.ts' | grep -n "Order not found for this event"`
- **Guard both doors.** A precondition on one door is not a precondition.
- **Property:** a promote against a non-promotable status changes zero rows AND says so. A zero-row
  update is success-shaped — add `.select()` and count the rows before any screen claims it worked.

### 3 — The duplicate-transfer check reads an unbounded subset
`.select(…).neq('payment_id', …).in('status', MONEY_STATUSES)` with **no `.limit()` and no
`.range()`**, then classifies in TypeScript. Past the PostgREST row cap it silently sees an arbitrary
subset — and a money guard that reads a subset passes on the duplicate it never loaded.

- Anchor: `git show origin/main:apps/web/app/admin/payments/actions.ts | grep -n -A3 "in('status', MONEY_STATUSES)"`
- The ceiling is **unmeasured** — it is Supabase platform config, not in the DB or the repo. Do not
  guess it. Narrow the query so the answer cannot depend on it (scope to the order/reference being
  classified), or page deterministically.
- ⚠ This guard already shipped inert once for a month by naming a non-existent enum value. Its own
  comment records that. **Watch your sabotage go red.**
- **Property:** the classifier's verdict does not change when the table is large.

### 4 — The fee bill says "nothing due" when it could not read
`fetchVendorFeeOrders` ends `if (error) return [];` — an RLS refusal or an outage renders an empty
bill, which reads exactly like "you owe nothing".

- Anchor: `git grep -n "if (error) return \[\]" origin/main -- apps/web/lib/vendor-booking-fees.server.ts`
- **The pattern to copy is already in this repo — do not invent a new shape:** PR #5818 did exactly
  this for Earnings (`apps/web/lib/vendor-earnings-view.ts`) — an unreadable read renders an em-dash
  and "we couldn't load", never a zero. Read it first.
- **Property:** "nothing due" is a claim, and a failure must never be able to make it.

### 5 — An unclaimed supplier profile is billed into a void
`no_payer` leaves the charge `pending` with no order and no payer, and **nothing re-runs it when the
supplier later claims the profile.**

- Anchor: `git grep -n "'no_payer'" origin/main -- apps/web/lib/booking-fee-lock.server.ts`
- PR #5820 added `booking-fee-unbilled-repair` to `PERIODIC_JOBS`, claimed per 30-min window via
  `claim_periodic_job` and fired from `after()` on the vendor and admin layouts. **Extend that job —
  do not add a second one.** Find it before you write anything.
- **Property:** a charge whose profile has since been claimed gets its bill minted on the next pass.

### 6 — An unverified shop is never charged, ever
`!args.verified` returns `charge:false` **before the ordinal is even considered.** Safe only while
unverified shops are unfindable — but an import-attribution booking (a supplier bringing their own
client) by an unverified shop is free forever.

- Anchor: `git grep -n "if (!args.flagEnabled || !args.verified)" origin/main -- apps/web/lib/booking-fee-lock.ts`
- ⚠ **Do not simply delete the check** — it is load-bearing for the marketplace case. Separate the
  two reasons: unverified-and-marketplace stays free, unverified-and-import is charged.
- **Property:** an import-sourced booking is charged regardless of verification state; a
  marketplace-sourced one is not. Attribution comes from `chat_threads.inquiry_source`.

### 7 — A waived booking tells the supplier nothing
The bill reads `orders`, and a waived booking calls `createOrder: false`, so **no row exists**.
`highest_declared_centavos` — the "what it would have cost" figure — has **zero readers in the entire
application**. A supplier sees an empty bill for bookings 1–5, then ₱837.50 on #6 with no context.

- Anchor: `git grep -rln highest_declared origin/main -- apps/web/app apps/web/lib` → **empty**
- 🔑 **The owner already ruled on this, verbatim:** *"still tell them that there should be a booking
  fee. but this will be considered free."* And: **"yes, add the email receipt for waived bookings."**
  The code does not follow the ruling. That is the build.
- **Check whether the waived-booking email receipt already shipped before building it** — grep the
  email kinds and `EMAIL_ENABLED_TYPES` in `lib/notification-emit.ts`. If it exists, say so and skip.
- **Property:** a waived booking appears on the supplier's bill showing the amount it would have
  cost and that it was free — and the receipt email is on the allowlist. An emitted notification that
  is not on the allowlist is a tray badge reaching nobody; **having one half is indistinguishable
  from having neither.**

---

## Files this bundle may touch

`apps/web/lib/sku-activation.ts` · `apps/web/app/admin/payments/actions.ts` ·
`apps/web/app/dashboard/[eventId]/orders/actions.ts` · `apps/web/lib/vendor-booking-fees.server.ts` ·
`apps/web/lib/booking-fee-lock.ts` · `apps/web/lib/booking-fee-lock.server.ts` ·
`apps/web/lib/notification-emit.ts` · the vendor booking-fee pages · new guards + one changelog fragment.

Anything outside this set: stop and report rather than widening it.

## Before you push

`git diff --stat origin/main...HEAD` and read every file. A deletion you did not intend — especially
of a helper a recent PR added — means a restore loop wrote over your merge. CI cannot see it.

## Report

Per build: done or dropped · the property the guard holds · the sabotage you watched go red.
If prod measurement contradicts this brief, **say that first** — the brief is a claim, the tree and
the database are the evidence.

---

## ➕ ADDED 2026-09-21 — build 8 (last; safe to drop if the bundle must shrink)

### A send-sourced fee charge still dies with its proposal
`booking_fee_charges` may be anchored on `proposal_id` OR `event_vendor_id`
(`booking_fee_charges_anchor_ck`). **Both still `ON DELETE CASCADE`.**

Migration `20271153200818_the_money_outlives_the_event.sql` fixed the `event_id` half — the ledger
and the charge now `SET NULL` instead of cascading — and its own comment names what it left:

> *"a charge anchored on `event_vendor_id` now survives, because slice 2 preserves booked rows. A
> charge anchored on `proposal_id` (source='send') still dies with `vendor_proposals`, which is its
> own slice. Named here rather than silently half-fixed."*

**This is that slice.** Build it the way the migration did: the money Setnayan is owed is not the
couple's data, and must outlive the record that introduced it.

- Anchor: `git show origin/main:supabase/migrations/20271153200818_the_money_outlives_the_event.sql | grep -n "its own slice"`
- ⚠ **Read the whole of that migration first**, plus the preserve trigger
  `keep_supplier_bookings_on_event_delete`. The lock-sourced half is already correct — **do not
  re-fix it**, and do not weaken the three preserve conditions (booked status · a marketplace link
  the couple cannot stamp itself · not self-dealt).
- ⚠ **A composite FK turns "preserve the parent" into an UPDATE of a referenced column, and an FK's
  `ON DELETE` rule says nothing about UPDATES.** That lesson is written at the top of the same
  migration because it once made deletion fail outright. Check every child whose FK spans a column
  you null.
- Migration rules: allocate forward with `pnpm migration:new`, land it through the pipeline,
  **never apply it to production**, and expect the Ugat db-tests to ask for a map entry.
- **Property:** deleting the anchor record leaves the charge readable on `/admin/booking-fees` with
  its money intact, and `booking_fee_ledger.fee_paid_total_centavos` still agrees with the charges
  that produced it. Assert the agreement, not merely that a row survived.
