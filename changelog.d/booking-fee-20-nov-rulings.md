## 2026-11-20 · fix(fees): supplier booking-fee billing follows the owner's 20 Nov rulings

Migration `20271354437946_the_20_nov_booking_fee_rulings.sql` + the TypeScript twins.

- **The schedule.** 5% of the first ₱100,000, **3%** after (was 1%), **locked at ₱100,000** (new
  `platform_settings.booking_fee_cap_php`). An **unverified** shop pays the head rate on the whole booking, locked
  too (`booking_fee_flat_centavos`, `booking_fee_centavos_for`, `unverifiedBookingFeePhp`). Every number is read from
  `platform_settings`; the tail-rate setting moves to 3.00 in the migration (ALTER first, then the one UPDATE).
  Schedule version `2026-11-20-taper5-3-cap100k`. The bill sentence now says "never more than ₱100,000".
- **No free first booking.** `booking_fee_free_booking_limit()` → 0, `FREE_BOOKING_LIMIT` → 0. A ledger place frozen
  free before this stays free. Supplier-brought clients keep the 16 Nov import rule already in
  `booking_fee_attribution_for` (unchanged).
- **Every 100,000th booking fee on Setnayan is free.** One-row `booking_fee_platform_counter` (RLS on, service-role
  only) + `booking_fee_take_platform_number()` (one `INSERT … ON CONFLICT DO UPDATE … RETURNING`: row-locked, exact,
  a rolled-back booking gives its number back). `booking_fee_charges.platform_fee_number` (UNIQUE) +
  `free_by_platform_count`. N is `platform_settings.booking_fee_free_every_nth` (100000). Existing fee charges are
  numbered so the count is Setnayan's real count. It sits above the free booking fee ticket, so the ticket is kept for
  the next booking; an amendment never re-bills it.
- **Tickets** stay auto-claimed (unchanged SQL); copy says so and never "redeem".
- **Screens and receipts:** the forecast before Agree, the Plan row, the waived-fee list on Booking fees / Money /
  the client page, and the emailed receipt name the flat rate, the lock and Setnayan's every-Nth fee; no fee surface
  promises a free first booking. Admin pricing shows the lock and the count.
- `decideLockFee` is rewritten as the arm-for-arm mirror of the new RPC. The add-on "free window"
  (`vendor-addon-first5-free.ts`) is decoupled and unchanged at one booking pending an owner ruling.

Tests: `tests/db/the-20-nov-booking-fee-rulings.db.test.ts` (new, fails without the migration),
`lib/the-20-nov-fee-rulings.test.ts` (new), and the fee suites updated to the new rule.

SPEC IMPACT: Billing now matches DECISION_LOG 2026-11-20 rows "BOOKING FEE: 5%… 3% AFTER, LOCKED AT ₱100,000", "FREE
BOOKING FEE TICKETS ARE AUTO-CLAIMED", "EVERY 100,000TH BOOKING FEE IS FREE", "…COUNTED ACROSS ALL OF SETNAYAN" and
"BILLING MUST FOLLOW THE RETIRED COPY" — each of which says "Not built"; the corpus rows should be marked built when
this merges. Open for the owner: whether the add-on free window follows the fee to zero.
