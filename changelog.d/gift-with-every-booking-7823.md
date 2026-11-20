## 2026-11-21 · feat(supplier): every booking carries at least one gift, never on the bill (#7823)

- **At least 1 gift, no exceptions** (DECISION_LOG 20 Nov): the Agree step starts on the smallest Papic pack and the last
  gift cannot be taken off. `vendorAgreeToLock` asks the SQL door with a **dry run before the yes**
  (`booking_gift_pick(..., p_dry_run => true)`), so a refusal books nothing; a form with no picker (imported, no-fee
  bookings) is pre-filled server-side with the smallest pack.
- **Never on the booking-fee bill** (16 Nov): the "bought on the bill" path is gone; the old Papic-150-in-fee retires.
  Bills already carrying a gift are untouched.
- **0 left · Buy more ›** opens Your gifts with that gift in the order and a same-site way back (`?gift=&back=`, kept for
  the tab so it survives the pay page); "Back to the booking ›" returns to Agree on the gift bought (`agree_gift=`).
- **BDO Option A** (controller 21 Nov): a SENT store payment ("Waiting for approval") covers ONE pick
  (`booking_gift_lines.gift_order_line_id`, one live pick per order line). Approved → it becomes a stock hold and lands
  at the couple's first payment. Refused or refunded → the pick is CLEARED (never deleted), the shipped in-app
  notification is the shop's word, the couple is told nothing, and the agreed booking reads "Needs at least 1 gift." with
  the same picker (`regift=1`, folded into `vendorAgreeToLock` — no new server action).
- Tests: `tests/db/a-gift-is-picked-when-the-supplier-agrees.db.test.ts` ①–⑫ (failing-first 11/13 red on the old
  migration) · `lib/the-gift-is-picked-when-the-supplier-agrees.test.ts` 10 tests, sabotage-checked.

SPEC IMPACT: None — implements DECISION_LOG 2026-11-16 / 20 / 21 rulings already in the corpus.
