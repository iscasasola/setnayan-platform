## 2026-11-14 · fix(booking): a hidden shop takes no new ask or booking — in the database too

Owner, 14 Nov: *"Yes, block them"* (DECISION_LOG "A HIDDEN SHOP TAKES NO NEW BOOKINGS — ENFORCED IN THE DATABASE,
NOT ONLY THE APP"). Migration `20271346561709_a_hidden_shop_takes_no_new_ask_or_booking` (CREATE OR REPLACE FUNCTION
only, writes no data) re-defines `enforce_booking_requires_verified_vendor`:

- **The app's rule, in the database.** A shop is bookable when verified, not suspended, not banned, and
  `public_visibility = 'verified'` (the app's `shopBookingRefusal`). It used to let `hidden` through, because that is
  the column default.
- **A couple's ask is now guarded too.** The check runs on the transition into a pending ask
  (`lock_request_state → 'pending'`) as well as into a booked status. Before this the ask was the app's alone.
- **New requests only.** An existing booking is never re-checked (edits and lifecycle advances pass), and an ask
  already pending is not re-checked while it stays pending. Chats are another table. A lapsed shop is not hidden
  (the papers deadline only takes the badge off), so it keeps the events that inquired.
- **The supplier's yes on an ask is a new booking**, so it is refused if the shop went hidden after the couple asked.
- The refusal keeps the `vendor_not_verified:` prefix the app matches on (`reason=not_listed`).
- **Test fixtures:** DB tests that book or ask a "verified" shop now list it too (`public_visibility = 'verified'`),
  as `/admin/verify` writes the two together. The deliberate gap noted in `20271335513615` is closed.
- Guards: `tests/db/a-hidden-shop-takes-no-new-ask-or-booking.db.test.ts` (5 tests, no app check in the way);
  `lib/the-booking-gate-reads-hide-suspend-and-ban.test.ts` now asks for the stricter "listed" rule and the ask guard.

SPEC IMPACT: None. This implements the 2026-11-14 DECISION_LOG row.
