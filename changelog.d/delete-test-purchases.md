## 2026-11-16 · fix(data): delete every test purchase record — cale-ice keeps its credits

Owner 16 Nov 2026 (DECISION_LOG 8983dc52): every purchase on Setnayan so far was a test, so the records go now.
One migration, one transaction. It deletes every order (and the payments, receipts and order-ledger lines that
cascade from them), every booking-fee bill and booking-fee ledger row, every App Store purchase, the Papic credits
and supplier portfolio credits an order bought, and the purchase notices that point at them. A test event whose
Setnayan AI came only from a deleted purchase is switched off (0 such events in prod today).

cale-ice keeps exactly what it has: its two bought Papic credit lines become comp lines in place (same points), and
one comp grant records what its paid orders unlocked. The transaction rolls itself back if cale-ice's credit total or
Setnayan AI switch moves, or if any order, payment or booking-fee bill is left. A second run changes nothing.
Supplier subscriptions are untouched.

SPEC IMPACT: None (data cleanup; the decision is already in DECISION_LOG 8983dc52).
