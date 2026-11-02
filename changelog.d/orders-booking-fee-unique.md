## 2026-09-20 · fix(booking-fee): the database refuses a second bill for one charge

- Migration `20271234849476_one_booking_fee_bill_per_charge`: PARTIAL unique index
  `orders_booking_fee_one_bill_per_charge` on `orders(service_key)` where the key is
  `vendor_booking_fee__%`. Partial on purpose: other service_keys are shared SKU codes
  (prod: `ONBOARDING_SERVICES` × 5 legitimate orders) or renewal keys
  (`vendor_additional_branch__`), which a whole-column index would break.
- `booking_fee_upsert_vendor_order` (SQL amendment writer) now mints with
  `ON CONFLICT … DO NOTHING` and returns on a lost race instead of aborting the amendment.
- `collectBookingFeeAtLock`: a 23505 on the fee order insert is `already_billed`
  (success, no second row, logged, points at the surviving order); `already_billed`
  counts as a settled fee in `judgeDepositEffects`.
- Test: `booking-fee-order-postconditions.db.test.ts` — raw second insert refused with
  23505 (SKU and branch keys still accept repeats), and a deterministic race gives
  ONE order + ONE payment and `already_billed`. Sabotage-proven twice (index made
  non-unique → both red; 23505 branch disabled → race test red).

SPEC IMPACT: DECISION_LOG.md row 2026-09-20 "ONE BOOKING-FEE BILL PER CHARGE" (owner rulings (a) + (b), partial-index reason, retry-wording correction).
