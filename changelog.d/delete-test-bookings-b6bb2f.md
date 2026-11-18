## 2026-11-16 · fix(booking-fee): delete the test bookings that re-billed four fee bills

#7842 deleted every test purchase but not the bookings behind them, so `maybeCatchUpHandshakesWithoutFee`
(supplier dashboard layout) minted four pending booking-fee bills again for the test shop testnayanw1lights
(S89O-GGDS99RD7F · S89O-K9F4CNCSVV · S89O-AF3XVQJ2YC · S89O-C4YDW7PWKX). Migration
`20271349476485_delete_the_test_bookings_that_rebilled_four_fee_bills.sql` removes, in one refusing transaction,
found by joins from the shop slug: 4 notices · 4 orders (→ 4 payments) · 4 agreed test bookings (→ 4 pending fee
charges, 3 papic_missions) · 4 fee ledger rows. It rolls back if it selects any bill outside the four, leaves any of
them, removes a count other than measured, moves cale-ice or maria-and-jose, or leaves a booking the mint would bill
again. The shop's three ₱0 waived bookings are kept. Proved by
`apps/web/tests/db/the-test-bookings-that-rebilled-four-fee-bills-are-deleted.db.test.ts`.

SPEC IMPACT: None (data cleanup under DECISION_LOG 8983dc52 and the owner's 16 Nov "yes delete them").
