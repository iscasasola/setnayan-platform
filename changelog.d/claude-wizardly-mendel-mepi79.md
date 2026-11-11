## 2026-11-11 · feat(analytics): Analytics IS the Shop carousel — one long carousel, a 30 days / 12 months switch inside every card, tap = our recommendation (Build 6 Lane I)

Owner, 11 Nov 2026: *"Analytics should be the carousel."* → *"one long carousel"* → the window *"inside each card"* →
*"Sliding switch"* (DECISION_LOG 2026-11-11 🎠 · 📊✅ · 🎚✅ · 📈; prototype
`prototypes/analytics_option_b_2026-11-11/analytics-option-b.html`, option 3). Builds on #7418 (the "Analytics,
growing" re-port) and #7439 (every graph rises to one recommendation + the five new graphs), both already on main.

- **ONE Analytics, and it is the Shop tab's carousel.** The second surface (`/vendor-dashboard/performance`, "How is my
  business doing") is folded in: its reads moved unchanged into `performance/_components/one-analytics-section.tsx`,
  which the Shop tab STREAMS in its own `<Suspense>` (the cover never waits), directly above the badge row. The old
  address redirects to `/vendor-dashboard/shop#analytics`; every in-app door goes straight there.
- **One long carousel, in the prototype's order** (`analytics-cards.ts`): Opened · Asked · Booked as three cards of
  their own (each with its big number counting up), then every graph once — Where couples found you · Which card sells ·
  How fast you answer · Reply speed vs bookings · Quotes waiting · Setnayan vs your own book · The next 13 weeks · Dates
  you lost · Slow months ahead · What couples say · Compared with similar suppliers · Where your price sits.
- **The window lives inside each card** — the house sliding two-button switch (`PillSelector`), one per card; nothing
  sits above the carousel. A card whose window is fixed shows it as a label (Next 13 weeks · Next 12 months · All time ·
  Your category · region · Your service · region). Both windows are built from the SAME reads, so a switch never
  refetches. The five new graphs are bucketed per window from their one 12-month read, and the card-opens reader now
  returns both windows in one call (`service_card_opens(p_vendor_profile_id)` → `opens_30d`, `opens_12m`).
- **Tap a card → it rises full screen** (the one `RiseScreen`): the graph larger, the same switch in its head, then ONE
  recommendation from `buildGrowthRecs` for that window (Problem → Solution → one door), or "Nothing to fix right now."
- **Every card animates when it is swiped into view** — bars grow, lines draw, counts tick; reduced motion shows the
  final picture at once. An empty card draws the greyed sample, marked "Example"; a refused read says "Couldn’t load."
- **Unverified shops** (`canUse('analytics')`, on the server, before any graph read): the three count cards, each still
  switchable, and ONE shared lock card for the graphs.
- **No fact twice on one scroll:** the old Analytics page's "Your badges" block, the three-line Opened → asked → booked
  chart, the "Do next" top-three list and the per-service scope menu are gone — the badge row under the carousel already
  draws the one badge tracker, the three count cards replace the lanes chart, and each card carries its own
  recommendation. (`your-badges.tsx`, `growth-lanes.tsx`, `do-next.tsx`, `service-scope-selector.tsx`,
  `service-scope-select-client.tsx`, `perf-links.ts` and the Shop door are deleted.)
- **Deviation, flagged:** "How fast you answer" shows a fixed "Last 12 months" label instead of a switch — its read (the
  shop's reply median) exists only over 12 months, so a switch would offer a 30-day number we do not have.

Card opens (from the earlier commits of this branch): migration `20271337268841_service_card_opens.sql` — a day ledger
(hashed viewer, one per viewer per card per Manila day), ONE service-role writer, ONE reader that returns COUNTS to the
shop's own people and refuses anyone else. `offer_on_card` fires only from those counts (`quietCard`: ≥ 20 opens and an
ask rate at most half the best card's).

🔒 new `shop/analytics-is-the-carousel.test.ts` (sabotage-checked, 8 mutations, all red) · rewritten
`performance/every-graph-is-a-tile.test.ts`, `analytics-is-growing.test.ts`, `the-pickers-are-one-dropdown.test.ts`,
`your-badges-are-on-the-page.test.ts` · re-pointed lock, rise, segment, sections, columns, spotlight, render-writes
guards. DB: `tests/db/a-card-open-counts-once-and-only-for-couples.db.test.ts` checks both windows.

SPEC IMPACT: None to the rulings — this builds DECISION_LOG 2026-11-11 🎠 · 📊✅ · 🎚✅ · 📈 as drawn. Owner-visible
choices listed in the PR: the reply card's fixed 12-month label, the removed per-service scope, and the badge tracker now
living only in the Shop badge row.
