## 2026-10-12 · feat(booking-fee): the launch offer — the first 2,000 Setnayan-sourced bookings are fee-free

Owner 2026-10-08 (the offer: first 2,000 bookings fee-free, Pro free until then ending on the 4-week cycle, 50 Papic
credits per booked event, ONE admin page, never hard-coded) and 2026-10-12 "APPROVE ALL: THE BOOKING-FEE QUESTIONS
(14)" #3–#7. Audit `controller-2026-10-12/BOOKING_FEE_RULES_AUDIT_2026-10-12.md` C9–C12, E3 (supplier dashboard
copy), H3 / build item 8.

- **Migration `20271268832636`.** `platform_settings` gains `launch_offer_enabled` (NULL = off), `_booking_cap`
  (seeded 2000), `_papic_credits` (seeded 50), `_cycle_days` (seeded 28), `_started_at`, `_closed_at`,
  `_pro_ends_at`. `booking_fee_ledger.launch_offer` + `launch_offer_number`. New status `waived_launch` (the CHECK
  re-listed in full). `vendor_papic_portfolio_credit_grants` gains source `launch_offer` and `booking_fee_charge_id`
  (unique per charge — once per launch-waived charge, #6).
- **The rule** in `booking_fee_open_lock_charge` (made at the supplier's yes), sourced path, ABOVE free-5 (#4): no
  frozen place + offer open → `booking_fee_launch_offer_take` (one platform-wide advisory lock) gives it place N, the
  charge is `waived_launch` at ₱0 recording what it would have cost, and the credits are granted. The cap-th booking
  is free and closes the offer, stamping free Pro's ONE end date (#5): the end of the 28-day cycle running then,
  cycles counted from the start (`booking_fee_launch_offer_pro_end`, TS twin `launchProEndsAt`, one table of cases).
  Launch bookings take no ordinal and the free-5 count skips them, so every shop keeps its five. Imports never count.
- **Everywhere a waiver must be known:** settled set (`FEE_SETTLED_STATUSES`, the four date-hold functions), the
  receipt list (a launch receipt names its place and the credits granted), the live-charge selectors, the amendment
  re-derive (`launch_noop`), the gift quote (`fee_waived` while the offer is open — no fee, no gift, #7), the
  supplier forecast (new standing `launch_offer`).
- **Free Pro** is a virtual `PromoFreeWindow` built from the settings (`launchProWindow`), resolved by the same
  `resolveVendorDealTier`; it rolls forward while open and stops at the stamped date. Its switch is the launch offer's,
  not `PROMO_FREE_WINDOWS_ENABLED`.
- **`/admin/launch-offer`** (nav: Money → Launch offer): status, the live count, free Pro's end date, the three
  numbers, Start / End it now, and the free-fee window `booking_fee_free_from/until`, which had no screen (C9). One
  server action; every change writes `admin_audit_log`.

Tests: `tests/db/the-launch-offer.db.test.ts`, `lib/launch-offer.test.ts`.

SPEC IMPACT: None — implements rulings already in the corpus DECISION_LOG (2026-10-08 rows; 2026-10-12 81292dc).
Public marketing launch wording (E3 on `/for-suppliers`, the front door) is NOT in this PR — it rides the copy PR
`rd/booking-fee-copy` once merged.
