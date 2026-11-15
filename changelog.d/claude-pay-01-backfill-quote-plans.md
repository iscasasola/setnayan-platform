## 2026-11-15 · fix(payments): backfill — a frozen 50/50 estimate becomes the accepted quote's own plan (PAY-01)

Owner ruling 2026-11-15 ("Yes"): payment plans frozen as the generic 50/50 ESTIMATE (`is_default_seeded = TRUE`) on
bookings with an ACCEPTED quote are rewritten to that quote's own fixed amounts and due days (₱20,875 + ₱20,875 →
₱8,350 + ₱33,400 on a ₱41,750 booking), mirroring `scheduleRowsFromAcceptedQuote` + `computePlanInstances`, and stop
being labelled estimates. Migration `20271347531019_pay_01_backfill_estimates_to_accepted_quote.sql`: idempotent,
touches only those rows of `event_vendor_payment_plan` (no other table, cleared/replot columns untouched), RAISES and
writes nothing if more than 20 plans qualify (6 measured 14 Nov, all test bookings). A supplier-authored plan
(`is_default_seeded = FALSE`) is left alone — whether it should lose to the quote is still open. The forward fix is
#7743. Test: `tests/db/a-frozen-estimate-becomes-the-accepted-quote.db.test.ts`.

SPEC IMPACT: DECISION_LOG.md row 2026-11-15 "PAY-01 BACKFILL" (corpus branch `claude/pay-01-backfill-ruling`).
