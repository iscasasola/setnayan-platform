## 2026-09-19 · fix(payday): a supplier's cash-flow counts the deposit and the balance (AREA-VENDOR)

The Today page's "Confirmed cash-flow" tile said "No booked installments yet." to a supplier (Saysay) who had just confirmed a ₱2,000 deposit on a contracted ₱10,170 booking. `vendor_payday_installments()` read only the frozen installment plan, and production has never held one (0 plan rows vs 4 ledger rows, measured 2026-09-19) — so the Today tile, My Customers' "Ongoing payments" and /payday were empty for every supplier.

Migration `20271233896417` keeps the plan arm unchanged and adds a second arm for a booked row with no installments: each payment the couple logged (Deposit/Payment; confirmed when the supplier confirmed it or a dispute ruled it stands; refused and declined-deposit rows left out; an unconfirmed one carries no due date so it can never read "overdue"), plus a Balance row (agreed total minus logged, no invented due date). Checked read-only against prod: rosa-ben now reads Deposit ₱2,000 confirmed + Balance ₱8,170 → "₱2,000 of ₱10,170 booked".

Test: `tests/db/payday-reads-the-deposit-and-the-balance.db.test.ts` (8 tests, run through `buildPaydayTimeline`; sabotage — disabling the new arm — turns 4 red).

SPEC IMPACT: None (read-side fix; no product decision changed).
