## 2026-06-30 · feat(vendor): recommend-to-couples engine — Phase 3b (couple-facing share)

The couple-facing close of the loop: a vendor CONNECTED to a couple (an accepted
`chat_thread`) suggests a buyable Studio add-on; the couple sees a "Suggested by
<vendor>" entry in the Studio hub and buys or dismisses it.

Mirrors the existing `coordinator_feature_recommendations` pattern (owner
2026-06-22) — same shape, same couple buy/dismiss flow — but the recommender is
gated on an **accepted chat_thread** instead of event-delegate membership.

Migration `20270326901252_vendor_feature_recommendations.sql`: new table + RLS
(vendor insert/select gated by owned profile + accepted thread; couple
select/update; admin select). Applied to prod + ledger recorded. Money stays
walled off — buy/dismiss is couple-only, entitlement always from `orders`.

UI: vendor "Suggest to a couple" action (from the `/vendor-dashboard/recommendations`
panel, scoped to the vendor's accepted-thread couples) + the Studio-hub couple
render extended to show vendor suggestions alongside the coordinator strip.

SPEC IMPACT: Decision to be logged in corpus `DECISION_LOG.md` (2026-06-30 —
Phase 3b couple-facing share). New surfaces on already-applied table; no
schema/pricing/SKU change beyond this table.
