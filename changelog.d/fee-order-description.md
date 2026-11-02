## 2026-07-27 · fix(booking-fee): derive the vendor fee order description from the schedule

The vendor booking-fee `orders.description` hard-coded `Setnayan booking fee (5%)`.
That claim has been wrong since the 2026-07-25 taper (5% on the first ₱100,000,
then 1%, floor ₱50, no cap): a ₱1,000,000 booking is billed ₱14,000 = **1.40%**,
so the money document the vendor reads in `/vendor-dashboard/booking-fees` — and
that ops read in `/admin/payments` — overstated its own rate, hid the taper
discount, and made Setnayan look like it had taken 5% of a ₱1M deal. The fee is
armed in production, so the first large marketplace booking would have shipped
that document.

- `apps/web/lib/booking-fee.ts` — new `bookingFeeScheduleSummary()`, rendered
  ENTIRELY from the `BOOKING_FEE` constants (no literal numbers in the string;
  rates via `Intl` percent so a non-integer reprice reads `2.5%`, not
  `2.5000000000000004%`). Today it renders
  `5% of the first ₱100,000, then 1%, minimum ₱50`. The minimum is part of the
  claim, not a footnote — below ₱1,000 the ₱50 floor dominates and the effective
  rate EXCEEDS the headline (₱200 → ₱50 = 25%).
- `apps/web/lib/booking-fee-lock.server.ts` — the parenthetical is now
  interpolated from that function. Em dash and the 24-hr SLA wording unchanged.
- `apps/web/lib/booking-fee-schedule-summary.test.ts` (new) — pins every claim
  the summary makes against `bookingFeePhp` (expected values derived from
  `BOOKING_FEE`, so a reprice moves the suite instead of being blocked by it),
  plus a guard asserting the description is interpolated and no `(5%)`-style
  literal is typed back into the money document.
- `apps/web/tests/db/booking-fee-rederive.db.test.ts` — stale `(5%)` seed
  literal removed (seed data only, rate-agnostic now).

The fee MATH is untouched: no change to `bookingFeePhp`, the SQL schedule, or
`BOOKING_FEE_SCHEDULE_VERSION`. Copy only.

Noted, NOT changed here (out of scope for this focused PR): the SQL twin
`booking_fee_upsert_vendor_order` in
`supabase/migrations/20270930120000_booking_fee_rederive_on_amendment.sql`
mints the amendment-path order with the same stale `(5%)` parenthetical, and the
vendor/marketing copy in `apps/web/app/vendor-dashboard/booking-fees/page.tsx`
and `apps/web/app/vendors/_components/vendor-grow-sections.tsx` still advertises
a "flat 5%".

SPEC IMPACT: None (copy derived from the already-locked taper; no pricing change).
