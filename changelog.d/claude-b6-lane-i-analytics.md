## 2026-11-10 · feat(analytics): ONE Analytics — every graph a tile that rises to one recommendation, plus five new graphs (Build 6 Lane I)

The approved prototype `build6_makers_analytics_2026-11-10` ("Proposed · one Analytics", owner OK 10 Nov), built on
#7418's "Analytics growing" re-port and on Lane A's Rise full screen (#7437):

- **Every graph is a tile** (`performance/_components/graph-tile.tsx`): title, its data named in one line, the picture,
  one line in words. Tap → it rises through THE one `RiseScreen` (no second rise) with the graph larger, ONE
  recommendation (Problem → Solution) from `buildGrowthRecs` — only when that rule fired, else "Nothing to fix right
  now." — the section's approved details, and one door in the thumb zone.
- **Thirteen graphs, each once, in the six sections.** The five live Shop carousel cards are folded into the tile that
  owns their fact (the dedupe table in `analytics-growing.tsx`'s docblock).
- **Five new graphs** (`lib/vendor-analytics-graphs.ts` pure + `.server.ts` reads): a · Dates you lost
  (`vendor_date_waitlist` × calendar blocks/locked days) · b · Which card sells (`event_vendors` asked/booked per card) ·
  c · Reply speed vs bookings (`chat_threads.vendor_first_reply_at` × booked events) · d · Slow months ahead
  (`vendor_schedule_pool_bookings`) · e · Quotes waiting (`vendor_proposals`, lazy expiry on `valid_until`).
  `event_vendors` is read on the admin client only (no vendor SELECT policy), scoped by the session's shop.
- **Five new rules** in `buildGrowthRecs`: `open_lost_dates` · `add_team` · `offer_on_card` · `offer_for_month` (the
  shipped off-season offer door, pre-filled) · `requote_expired`. Each fires only on a number its graph shows.
- **Empty = the real picture with sample data, faded, "Example"** (`graph-sample.ts`); **refused = "Couldn’t load."** —
  never the Example, never a zero, never advice.
- 🔒 `performance/every-graph-is-a-tile.test.ts` (sabotage-checked) · `lib/vendor-analytics-graphs.test.ts`;
  re-anchored `analytics-is-growing.test.ts` (recs take the graphs' options; unread is the tile's state).

⚠ FLAGS for the owner/controller:
- **No table records which card a couple OPENED**, so graph b draws asked + booked only and `offer_on_card` never fires.
  Opens per card need a logger (a migration + a writer) — not built.
- **The Shop tab's live carousel (`shop-analytics-carousel.tsx`) still draws its five cards**; ONE Analytics lives on
  Shop › Analytics. Removing the carousel's copies is left for after #7437 (which edits that file) lands.

SPEC IMPACT: None — builds the approved Build 6 Lane I prototype as recorded in DECISION_LOG 2026-11-10 ("ALL FIVE
BUILDS 5–6 PROTOTYPES APPROVED"). The two flags above are open questions, not spec changes.
