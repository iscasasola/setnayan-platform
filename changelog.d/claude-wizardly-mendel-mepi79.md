## 2026-11-10 · feat(analytics): ONE Analytics, not two — the Shop carousel goes, card opens are counted, analytics beyond counts opens on Verified (Build 6 Lane I, finish)

Finishes Build 6 Lane I on top of #7418 (the "Analytics, growing" re-port) and #7439 (every graph a tile that rises to
one recommendation + the five new graphs), both already on main. What those two left open:

- **No fact twice — the Shop tab's five-card carousel is gone** (#7439's flag 2; the approved prototype
  `build6_makers_analytics_2026-11-10`'s dedupe table: *"The carousel is gone; its five pictures live on as tiles."*).
  The Shop tab's Analytics section is now ONE door into Shop › Analytics (`shop-analytics-door.tsx`): it states no
  number about the shop and reads nothing, so the Shop tab drops its whole analytics batch (`lib/shop-analytics.server.ts`,
  `lib/shop-analytics-series.ts` and the carousel are deleted). Owners and admins only, as before; the tour stop keeps its
  anchor. 🔒 new `shop/one-analytics-not-two.test.ts` (sabotage-checked: a carousel face back on the Shop tab fails it).
- **"Which card sells" counts OPENS** (#7439's flag 1): migration `20271337268841_service_card_opens.sql` — the SAME shape
  as the portfolio photo views: a day ledger (hashed viewer, one per viewer per card per Manila day), ONE service-role
  writer `record_service_card_view` (refuses the shop's own people, admins and any card not the shop's), ONE reader
  `service_card_opens` that returns COUNTS to the shop's own people and REFUSES anyone else. Each grown-card open on the
  public shop counts (never on a demo shop or a team preview), routed through the existing view action (no new server
  action). Graph b draws opened · asked · booked; a refused opens read leaves `opened: null` (never 0) and the graph
  advises only on asks and bookings.
- **`offer_on_card` fires** — from the graph's own numbers only, through one pure rule (`quietCard`,
  `lib/vendor-analytics-graphs.ts`): a card with ≥ 20 opens whose asks per open are at most half the best card's. Its
  Problem line is that card's own three numbers. Still `buildGrowthRecs` only — no per-card copy.
- **Analytics beyond simple counts opens once Verified** (DECISION_LOG 2026-11-10 "FREE (UNVERIFIED): THE LAST SEVEN";
  corpus free-unverified-limits §5): the Analytics page asks `canUse('analytics', …)` on the SERVER and, for an
  unverified shop, reads only the opened · asked · booked counts and the badges — no graph read runs — and draws the
  graphs as Build 5 Lane B's shared `LockedFeature` (Problem → Solution → a view-only sample → papers progress → Get
  verified). `lib/locks.ts` `analytics.server` now names the page; the lock guard proves the gate sits before every graph
  read. Measured in prod (SELECT): SetnaProd is Verified and keeps everything.

DB: `tests/db/a-card-open-counts-once-and-only-for-couples.db.test.ts` (writer service-role only · once a day · own
people/admins never count · foreign card refused · reader counts for the shop, refuses others · ledger closed).

SPEC IMPACT: None to the rulings — this builds DECISION_LOG 2026-11-10 "EVERY ANALYTICS GRAPH HELPS", "ALL FIVE NEW
ANALYTICS GRAPHS PICKED" and "FREE (UNVERIFIED): THE LAST SEVEN" as drawn. The quiet-card thresholds (20 opens · half the
best card's ask rate) are new and listed in the PR for the owner; they govern advice, not money.
