## 2026-09-21 · fix(booking-fee): a fee that opens is eventually billed, and a fee that cannot be is visible

The booking fee is the only revenue path this product has, and it could open
without anyone ever being asked to pay it — silently.

`collectBookingFeeAtLock` opens the charge through `booking_fee_open_lock_charge`
**first**, then mints the bill. Between those two moments it can return
`{status:'skipped'}` at five places: the existing-order check is unreadable, the
charge read fails, the payer read fails, the `orders` insert fails, or the
`payments` insert fails — the last of which **deletes the order it just
created**. Each one leaves a `booking_fee_charges` row `pending` with no
`orders` row: the supplier is shown nothing owed, the couple sees nothing, and
`/admin/booking-fees` rendered the row as *"Nothing sent yet"*, which is also
what a supplier who HAS been billed and simply has not paid looks like. Two
opposite situations, one sentence.

The existing catch-up could not heal it: `maybeCatchUpAcknowledgedDeposits`
counts a `pending` charge as already-charged and skips exactly the rows that
need repair. It also capped at 25 rows with no `ORDER BY` at all, and applied
the cap *before* subtracting the charged ones — so a supplier whose 25
arbitrary rows were all charged had a sweep that could never reach the 26th.

**What now happens**

- New cron-free periodic job `booking-fee-unbilled-repair`
  (`lib/unbilled-fee-repair.ts` + `.server.ts`), registered in `PERIODIC_JOBS`,
  claimed once per 30-minute window, mounted via `after()` on **both**
  `app/vendor-dashboard/layout.tsx` and `app/admin/layout.tsx`. It finds a
  charge that is `pending` (never waived, never paid) with no
  `vendor_booking_fee__<chargeId>` order and re-mints the bill through the one
  sanctioned collector call site. Idempotent twice over: the RPC reuses its one
  live charge, and `orders_booking_fee_one_bill_per_charge` (#5727) makes a
  second bill impossible — a 23505 is read as "already billed", not an error.
  Fleet-wide on purpose: a supplier who was never billed has been told nothing
  is owed, so a per-visitor sweep would reach everyone except the shops it is
  for.
- The 25-row cap is replaced by a **deterministic oldest-first scan (200) with a
  cap on the WORK (25 collector runs)**, and durably-unbillable charges — no
  booking row, archived, not acknowledged, unclaimed shop, legacy send-path —
  are set aside without spending any of that budget, so they cannot wedge the
  repairable rows behind them. `maybeCatchUpAcknowledgedDeposits` gets the same
  treatment (scan 200 oldest-acknowledged-first, cap 10 runs, subtract after).
- `/admin/booking-fees` now separates **"Never billed"** from **"Billed —
  nothing sent yet"**, prints the reason for every unbillable charge, and
  headlines how many there are. The reason is judged by the same pure
  `whyNotBilled` the sweep uses, so the desk and the sweep can never disagree.
  It is derived at read time and deliberately **not** stored on the charge:
  `booking_fee_charges_size_the_gift` is a BEFORE UPDATE trigger that re-sizes
  `gift_credits` / `gift_centavos` on a `pending` row, so a bookkeeping write to
  the unused `failed_reason` column could silently move the money the supplier
  is about to be billed.

Not changed: when a fee opens, the fee schedule, or the free-five rule.

**Measured against production, read-only, 2026-09-21:** 2 charges exist in
total (1 `waived_free5`, 1 `paid` with its order), **0 in the broken state**, and
0 acknowledged bookings with no charge. Latent, not live lost revenue — re-measure
with `select count(*) from booking_fee_charges c where c.status='pending' and not
exists (select 1 from orders o where o.service_key='vendor_booking_fee__'||c.charge_id::text)`.

Guards: `lib/unbilled-fee-repair.test.ts` drives all five skip points and asserts
the charge is repaired and billed EXACTLY ONCE (a mint counter, not a claim),
that a waived charge is never billed, the ordering, and the work cap — seven
sabotages, each confirmed RED by pass/fail count.
`app/admin/booking-fees/the-desk-says-never-billed.test.ts` holds the desk's
sentence (five sabotages). `deposit-acknowledge-fires-from-every-door.test.ts`
gains an explicit `SWEEPS` whitelist so a new caller of the money effects still
has to be reviewed.

SPEC IMPACT: None. No schema change, no migration, no pricing change, no change
to when a fee opens or to the first-five-free rule.
