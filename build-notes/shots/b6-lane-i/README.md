# Build 6 · Lane I — Now beside Proposed (rework 11 Nov 2026: Analytics IS the carousel)

Owner, 11 Nov 2026: *"Analytics should be the carousel."* → *"one long carousel"* → the window *"inside each card"* →
*"Sliding switch"*. Prototype: Setnayan-specs `prototypes/analytics_option_b_2026-11-11/analytics-option-b.html`, option 3.

Fixture labs (no database): `/dev/supplier-lab?s=shop-tab` and `/dev/supplier-lab?s=analytics&shop=sample|new[&locked=1][&fail=1]`.
**Now** = `origin/main` (taken 10 Nov @ 142ab58fa; the Shop carousel and the separate Analytics page are unchanged on
main since) · **Proposed** = this branch. Each at 375 and 390 px, light and dark (2× scale, reduced motion so the
picture is final).

| Now | Proposed | What changed |
|---|---|---|
| `now-shop-tab-*` — the five-card carousel on the Shop tab, with a separate Analytics page behind it | `proposed-shop-tab-*` — the carousel IS the one Analytics: "Opened" first, its own 30 days / 12 months switch beside the number, the badge row directly under | One Analytics, in the carousel's form. 15 cards: Opened · Asked · Booked, then every graph once. |
| `now-analytics-cardsell-*` — a tile on the separate Analytics page, one page-wide window ▾ | `proposed-carousel-cardsell-*` · `proposed-carousel-cardsell-12-months-*` — the same graph as a card, its switch on the card; flipped to 12 months, the card's numbers change in place | The window lives inside each card; both windows come from the same reads (no refetch). |
| `now-cardsell-risen-*` · `now-shop-card-tapped-*` | `proposed-card-risen-*` — the card risen full screen: the graph larger, the same switch in the head, ONE recommendation (Problem → Solution), one door | Tap = our recommendation, from `buildGrowthRecs` for that window. The Problem names the window its numbers are from. |
| — | `proposed-new-shop-example-*` | An empty graph draws the greyed sample, marked "Example", with one door to start. |
| — | `proposed-refused-*` | A refused read: "—" and "Couldn’t load." — never a zero. |
| — | `proposed-unverified-locked-*` | An unverified shop: the three count cards (each still switchable), then ONE shared lock card for the graphs. |

⚠ **Dark:** the supplier dashboard is not on the dark ready-list yet (`DARK_READY`, `lib/appearance.ts`), so no supplier
sees dark today. The dark shots apply the app's own `.dark` class after load — what these screens paint once the area is
listed.
