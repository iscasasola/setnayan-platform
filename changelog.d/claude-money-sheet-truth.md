## 2026-11-18 · fix(money): the payment sheet names its own supplier, and an accepted quote is not shown as owed

- **R9** — on a couple's supplier workspace › Payment, the embedded `VendorItemizationCard` named the supplier from
  `event_vendors.vendor_name` (the row's free-text label, which can be stale or another supplier's — "Payments to
  TEST W1 per-guest supplier…" on Liwanag's sheet) while every other line used the workspace's `displayName` (the
  shop's `business_name`). The card now takes an optional `vendorName`; the workspace passes `displayName`.
- **R10** — an ACCEPTED quote's schedule was drawn on the workspace as if owed ("Final balance ₱6,750 · that day has
  already passed") while the Budget showed Agreed ₱0 · Owed ₱0 · Booked 0. By the code's definitions the Budget is
  right: accepting a quote leaves the row `shortlisted`; the booking is `contracted` (supplier agrees to lock); the
  Budget counts only booked suppliers (BA2) and `moneyStep` already answers `not_booked`. The Schedule section now
  says "Schedule · not booked yet" with "Nothing is owed yet…" until the row is booked (`quoteScheduleFrame`).
- Tests: `app/dashboard/[eventId]/vendors/[vendorId]/workspace/the-payment-sheet-names-this-supplier.test.ts`,
  `lib/an-accepted-quote-is-not-yet-owed.test.ts` (both fail on origin/main).

SPEC IMPACT: None — copy/source-of-name fixes that apply existing rulings (BA2 2026-09-02; S5 2026-09-18 "accepted →
Ask them to lock"). No schema, price or rule change.
