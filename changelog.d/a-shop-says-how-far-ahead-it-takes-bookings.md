## 2026-11-20 · feat(schedule): a shop says how far ahead it takes bookings — At least · At most [migration]

Owner 2026-11-19, DECISION_LOG "HOW FAR AWAY A SHOP TAKES BOOKINGS: AT LEAST AND AT MOST, EMPTY AT MOST = 3 YEARS"
(supersedes the same day's "opens at 3 years" and "at least 7 days, at most 2 years" rows); drawing
`prototypes/schedule_questions_placement_2026-11-19.html` §5, approved "OK all".

- **Migration** `20271354345662_a_shop_says_how_far_ahead_it_takes_bookings`: `vendor_profiles.booking_min_days`
  (0–30, NULL = same day) and `vendor_profiles.booking_max_months` (1–36, NULL = 3 years). Read by `authenticated`,
  never by `anon` (the `paused_at` pattern).
- **Supplier:** Clients ⚙ › Teams and days opens with "How far away you take bookings" — At least (Same day · 3 · 7 ·
  14 · 30 days) and At most (6 months · 1 · 2 · 3 years), each one dropdown that saves in place. It rides the shipped
  `updatePoolCapacity` (`op=booking_window`), so no server action is added. A refused read says so; it never shows
  "Same day · 3 years".
- **Couples:** Check a date ends on the shop's own last day and greys the days inside its At least (the page and the
  shop page's side card). `CHECK_DATE_MONTHS_AHEAD = 37` is removed — a shop that sets nothing now answers to exactly
  3 years from today (was the end of that month). Find and the bench refuse a card on a day outside its shop's window
  (`readCardRefusals`, `readSuppliersWithNoBookingLeft`); a refused window read is "could not check", never "free".
- **The ask:** `finalizeVendor` refuses a date outside the shop's window **above the slot / daily-capacity split**, so a
  card with time slots is checked too (ship review); a card's own "Order at least N days" can only be stricter. Fails
  open on a read error, logged, like the card's rule.
- **The save** reads its row back (`.select()`), so a write the row policy turns into zero rows says "did not go
  through" instead of "saved".
- `service_cards_unbookable_on` is NOT redefined: it mirrors the lock's calendar refusals line by line
  (`h6-mirrors-the-booking-path.test.ts`); the window is applied beside it in TypeScript.
- Pure rule + guards: `lib/booking-window.ts`, `lib/booking-window.test.ts`.

SPEC IMPACT: None — implements the 2026-11-19 rows as ruled. (The rows say "NOT BUILT"; the controller updates them
to built on merge.)
