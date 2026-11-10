# Build 6 · Lane I — Now beside Proposed (10 Nov 2026)

Fixture labs (no database): `/dev/supplier-lab?s=shop-tab` and `/dev/supplier-lab?s=analytics&shop=sample|new[&locked=1]`.
**Now** = `origin/main` @ 142ab58fa · **Proposed** = this branch. Each at 375 and 390 px, light and dark (2× scale).

| Now | Proposed | What changed |
|---|---|---|
| `now-shop-tab-*` — the five-card carousel on the Shop tab | `proposed-shop-tab-*` — ONE door into Shop › Analytics | No fact twice: the carousel's five cards were copies of tiles ONE Analytics already owns (the prototype's dedupe table: "The carousel is gone"). |
| `now-shop-card-tapped-*` — a carousel card risen (its own sheet) | — | Gone with the carousel; every graph rises from its tile in Shop › Analytics. |
| `now-analytics-cardsell-*` · `now-cardsell-risen-*` — asked · booked only, "Nothing to fix right now", "opened is not counted yet" | `proposed-analytics-cardsell-*` · `proposed-cardsell-risen-*` — opened · asked · booked, **Run an offer on Same-day edit** (Problem = that card's own 84 · 2 · 0) | Card opens are counted (`service_card_opens`), so `offer_on_card` can fire from `buildGrowthRecs`. |
| — | `proposed-unverified-locked-*` · `proposed-unverified-lock-risen-*` | An unverified shop keeps its counts (the pinned row) and sees the graphs as the ONE shared lock: Problem → Solution → a view-only sample → papers progress → Get verified. |

⚠ **Dark:** the supplier dashboard is not on the dark ready-list yet (`DARK_READY`, `lib/appearance.ts`), so no supplier
sees dark today. The dark shots apply the app's own `.dark` class after load — what these screens paint once the area is
listed.
