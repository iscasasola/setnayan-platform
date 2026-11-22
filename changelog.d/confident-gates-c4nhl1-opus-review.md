## 2026-11-18 · fix(gifts): a gift claim settles the shop's plan before it reads it

`setnayan_shop_gift_claim` now runs the login sweep (`sweep_vendor_tier_expiry`) first. The layout runs that sweep only
after the page is drawn, so a shop could press "Start it" on the load where its own term ran out: the lapse then never
took the credit with the plan, and a PAID scheduled plan was overwritten by the gift and dropped at the hand-back.
Held by test 12 in `tests/db/a-setnayan-gift-is-claimed-once.db.test.ts`.

SPEC IMPACT: None
