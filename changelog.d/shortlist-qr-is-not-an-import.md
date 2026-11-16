## 2026-11-16 · fix(fees): the Shortlist QR is not an import · an imported client is not a Completed booking

Two owner rulings of 16 Nov (specs DECISION_LOG). No UI changes and no new server action.

- **d7f4b97f, the Shortlist QR stays free but is not an import.**
  - `importVendorToEventShortlist` (the free Shortlist QR → `/vendor-invite/<slug>`) now writes
    `event_vendors.source = 'vendor_shortlist_qr'` (`SHORTLIST_QR_SOURCE`). Before, it wrote `vendor_invite`, which
    made the couple an own client.
  - The new value is a save on Setnayan: `SETNAYAN_SAVE_SOURCES` in the app, and the save lists of
    `booking_fee_attribution_for` and `booking_fee_introduced_on` in SQL. A booking from it pays the normal fee.
  - A chat started from such a row is already recorded as `shortlist`, which counts as found on Setnayan.
  - The fraud runner counts it as organic.
  - Existing `vendor_invite` rows are not rewritten.
- **fd5814dc (3), an imported client's booking does not count toward Completed bookings.**
  - `vendor_public_completed_events_stats` (the badge's number) now excludes rows whose source is `vendor_invite`,
    `vendor_locked_qr` or `reuse_accept`.
  - The supplier's own `vendor_full_completed_events_stats` is unchanged.
  - Grants and the unique index are restored exactly.

Migration `20271348281460_shortlist_qr_is_not_an_import_and_imports_are_not_completed_bookings.sql`, which only
replaces functions and rebuilds one matview, writes no data.

Guards:
- `lib/the-shortlist-qr-is-not-an-import.test.ts`
- `tests/db/the-shortlist-qr-is-not-an-import.db.test.ts`
- two new rows in `lib/fee-rule-b-cases.ts`, which run through both the app rule and the SQL rule

SPEC IMPACT: None. This implements specs DECISION_LOG d7f4b97f and fd5814dc (3) as ruled.
