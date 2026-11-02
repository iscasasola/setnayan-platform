## 2026-10-23 · feat(booking-fee): your first booking from Setnayan is on us (one free booking, not five)

Owner, verbatim: *"Your first booking is on us. Not 5. Then the first 2000
bookings is also free."* A supplier's free Setnayan-sourced bookings drop from
five to ONE. The launch offer (the first 2,000 platform bookings fee-free, Pro
free until then) is unchanged and still spends none of a shop's free booking.

- **One home for the number.** The 5 was a literal in two SQL function bodies
  (`booking_fee_open_lock_charge`, `setnayan_gift_quote_applies`) with a TS twin
  (`FREE_BOOKING_LIMIT`). It now lives in `public.booking_fee_free_booking_limit()`
  (migration `20271284624593_the_first_booking_is_on_us.sql`, returns 1), which
  both bodies call; `FREE_BOOKING_LIMIT = 1` mirrors it and a db-test fails the
  moment they disagree. Applied through the pipeline only.
- **Nothing already given is taken back.** Frozen ledger ordinals are never
  re-derived: bookings 2…5 waived under the old rule stay `waived_free5`, with no
  charge back. `resolveBookingFeeStanding` now reads the frozen
  `is_free_booking` instead of re-asking `isFreeBooking(ordinal)`, and the
  receipt for such a booking says it "stays free".
- **The words.** Every supplier line that counted free bookings now says
  "Your first booking from Setnayan is on us" (`FIRST_BOOKING_ON_US` in
  `lib/booking-fee-lock.ts`): /for-suppliers (thesis tile, fair-pay lede, tier
  matrix footnote, meta description), the front-door feed, the fee hub's empty
  state, supplier settings Help row, the Money spotlight tour, Help
  "What does Setnayan charge suppliers?", llms.txt, the commission promise, the
  quote forecast + waived receipt + sign-up disclosure, the Papic-on-a-quote line
  and the plan row (badge "First booking free" / "Free booking used").
- **The add-on window rides the same limit.** The 3D Booth / Papic Challenges
  "free while you're on your first 5 bookings" perk is defined as the fee's own
  free window (it reads `FREE_BOOKING_LIMIT`), so it now reads "Free until your
  second booking". Flag-gated (`NEXT_PUBLIC_VENDOR_ADDON_FIRST5_FREE`); flagged
  for the owner in the PR.
- **Guards.** `lib/the-first-booking-is-on-us.test.ts` (booking #1 waived, #2
  billed; frozen answers kept; no shipped string names a count of free bookings,
  comment-stripped scan of app/ + lib/) and
  `tests/db/the-first-booking-is-on-us.db.test.ts` (SQL = TS, both bodies read
  the function, #1 waived / #2 pending, legacy frees kept, launch offer still
  waives inside its cap). Sabotage runs recorded in both docblocks.

SPEC IMPACT: `DECISION_LOG.md` — one 2026-10-23 row recording the ruling
verbatim (supersedes the five-free-bookings rule wherever the corpus states it;
the launch-offer rows of 2026-10-08 / 2026-10-12 stand).
