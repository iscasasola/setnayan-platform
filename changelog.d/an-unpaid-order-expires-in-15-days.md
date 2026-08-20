## 2026-08-20 · feat(orders): an unpaid order stops waiting forever — 15 days, warned first, cancelled not deleted

**Owner ruling 2026-08-20**, after asking what happens when a payment never
reflects: an unpaid order cancels itself after **15 days**, the buyer is
**warned before** it does, the order is **cancelled rather than deleted**, and
the deadline is **shown at checkout**.

### Why 15, recorded because the number will be questioned again

Philippine payroll lands on the 15th and the 30th, so a fifteen-day window
always contains exactly one payday whichever day the order is placed; seven can
miss both. And the expensive failure here is **not** an order lingering — an
unpaid order unlocks nothing and merely sits — it is **money arriving against an
order that has already cancelled itself**, which a shorter window makes more
likely. The window is generous on purpose.

### What is built

- `lib/order-payment-window.ts` — pure, timezone-safe, and the **single source**
  for the number. Even the sentence the buyer reads is built from the constant,
  because this repo has twice shipped a figure that agreed with itself in code
  and lied on screen (a retention period, and a 12% VAT across four screens).
- The deadline is stamped by a **column DEFAULT**, not by application code.
  Orders are created from several paths, and the one somebody forgets is the one
  that never expires — this repo's "gate with no handle". A default cannot be
  forgotten by a caller that does not know it exists.
- The sweep nudges at the halfway point and cancels at the deadline, mirroring
  the shipped cron-free `sweepLapsedSubscriptions` precedent. Both writes are
  idempotent and race-safe inside their own WHERE, so two admins loading the
  page cannot double-email or double-cancel. **The stamp is taken before the
  email** — a failed stamp sends nothing, whereas sending first risks emailing
  the same person on every page load.
- Both notification types are on the **email allowlist**. A deadline a buyer
  only learns about inside the app is a tray badge that reaches nobody — the
  same half-a-mechanism that made the "somebody paid you" alert useless until
  #4595.
- **Deleting an event now cancels its unpaid orders** instead of orphaning them.
  `orders.event_id` is `ON DELETE SET NULL`, so the order survived with its link
  wiped — and a buyer's only route to an order is `/dashboard/<eventId>/orders/
  <orderId>`, with no account-level orders page. The customer kept the debt and
  lost the screen naming the amount and the reference. **This happened in
  production on 2026-08-20 to a real ₱499 order.**

⚖ **Vendor orders are deliberately out of scope.** The ruling was about a
customer who never pays; a vendor's unpaid booking fee sits in a different
relationship and cancelling one may unpick a booking a couple is relying on.
Widening later is deleting a predicate; narrowing after it has cancelled
somebody's booking is not a thing you can do.

⚖ **The sweep can only ever run LATE, never early** — it fires on page visits,
not a schedule. That is the forgiving direction, and the only safe one here.

### 🚨 Three of my own mistakes, all caught by tests, all worth carrying

1. **The guard could never fire.** It used `current_user NOT IN
   ('authenticated','anon')` inside a `SECURITY DEFINER` function — where
   `current_user` is the function OWNER, so the condition is always true and the
   gate admits everybody. Migration `20271141980127` had already written this
   exact table down after being bitten by it. Now reads
   `current_setting('role')`.
2. **Two tests passed vacuously first.** The buyer fixture had no identity, so
   RLS refused the UPDATE outright and "the buyer cannot move their deadline"
   was green for the wrong reason. Giving the fixture a real identity turned
   both red and exposed (1). **Give a fixture a real identity before trusting a
   denial** — and `SET LOCAL ROLE` outside a transaction is a no-op, so the role
   change is now asserted.
3. **`SECURITY DEFINER` was unnecessary** and the anon-callable-definer db guard
   said so. The function touches no table; it only rewrites NEW. Dropped to
   INVOKER, which both narrows the surface and fixes (1) a second way.

### Guards

`tests/db/unpaid-order-window.db.test.ts` (5) proves the DEFAULT stamps every
creation path, that a buyer can move neither their deadline nor their reminder
even though `authenticated` holds a table-level UPDATE grant on orders, that a
legitimate edit in the SAME statement still lands while the protected half is
reverted, and that the sweep itself is not blocked.
`lib/order-payment-window.test.ts` (9) pins the window, the boundary, and that
the deadline sentence names a **Manila** date whatever zone the reader is in —
green in UTC · Asia/Manila · America/New_York · Pacific/Kiritimati.

🪤 The short-form and the closed-check disagreed at the exact deadline instant
(one said "Last day to pay", the other said closed). One is now the authority
and the other asks it, rather than two independent comparisons.

Mutations, each confirmed to have LANDED by occurrence count, all red: reverting
to the `current_user` idiom (1→0) · dropping the trigger (1→0) · removing the
15-day DEFAULT (1→0) · making the guard block the sweep too (2→1).

**Exposure baseline** regenerated deliberately: exactly two lines, both
understood — `anon=-` on both columns, and the `authenticated` UPDATE is the
pre-existing table-level grant that the trigger now neuters.

Full suite 9008 unit + 1292 db passing, typecheck exit 0, lint clean.

SPEC IMPACT: Applied — `DECISION_LOG.md` 2026-08-20 records the 15-day window,
the reminder, cancel-not-delete, and the vendor-order exclusion.
