## 2026-11-09 · feat(analytics): re-port #7338 — Shop › Analytics is "Analytics, growing", on today's main

Re-port of #7338 (owner-approved 6 Nov) onto `main` after THE ONE BUILD (#7399) and the Build 1/2 trains. #7338's own
entry follows, corrected for what moved:

- **Kept on main, NOT deleted** (#7338 deleted them): `CapacityCard`, `ConversionDealsCard`, `FunnelBenchmarkCard`,
  `PricePositionCard`, `RoiAttributionCard` — the ONE BUILD's Shop › Analytics carousel (`shop/page.tsx`) mounts them.
  Deleted as in #7338 (nothing mounts them once the page is re-laid): `SourceBreakdown`, `HealthCompositeCard`,
  `InquiryHandlingCard`, `MomentumCard`, `MomentumChart`, `MomentumWindowToggle`, `PerformanceControls`,
  `ReplyClaimCard`, `ReputationCard`.
- **Main's page deltas carried onto #7338's page:** badge rewards on the tracker rows + `<BadgeRewardSweep />` on both
  the gated and the full page (8 Nov), and the "Link up" filter (`withoutPartnershipRecWhenNobodyToLink`, owner 6 Nov)
  on BOTH windows' recs before they reach Do next (`shownGrowthRecs` / `shownGrowthRecsYear`).
- **`lib/analytics-growing.ts`** is #7338's whole module again (main carried only the buckets, strip, rail and
  `aheadLine`); `calendar-strip.tsx` keeps main's CSS-only pop-in so the carousel, which has no growth-motion engine,
  still animates. `analytics-growing.css` = #7338's sheet + main's `ag-pop` / `ag-slide` keyframes.
- **Guards re-anchored, none dropped:** `lib/partners-you-served-with.test.ts` pins the filter on both windows and that
  the unfiltered recs never reach the view; `performance/analytics-is-growing.test.ts` pins the same.
- **Left out (owned by Build 3 #7416):** `app/dev/supplier-lab/page.tsx` (so the lab's `&shop=` / `&win=` params are
  not threaded yet), `lib/ugat/screens.generated.json`, `scripts/port-control-baseline.json` — regenerate both at
  integration.

---

### (from #7338) 2026-11-06 · feat(analytics): Shop › Analytics is "Analytics, growing" — one window, six sections that grow, Do next in the open

Owner-approved 6 Nov 2026 (prototype `analytics-proto/index.html`, claude.ai/artifact/V1cMczWhoM3P3cxmTHU31Z). Built from that prototype, section by section, on the app's own tokens, from the reads the page already made:

- **One window.** Last 30 days · Last 12 months, picked once under the pinned row (`GrowthWindowScope`, `app/vendor-dashboard/_components/growth-window.tsx`). Every windowed figure follows it, including the pinned row's three numbers (`ShopSegments yearFigures`). Both windows are read on the server, so switching between them fetches nothing.
- **The headline numbers count, in the pinned row only** (`PinFigure.count` → the shared `Count`). They count up on load and slide from old to new on a window change.
- **The hero.** Three lanes (opened · asked · booked, `GrowthLanes`) and the sentence (`growthSentence`). A tie never claims "best".
- **Do next.** The top three from `buildGrowthRecs`, with the shipped icons, chips and CTAs (`DoNext`). Each recommendation appears again under the section it belongs to. "Nothing to fix right now." when none fires.
  - Two rule changes in `lib/vendor-growth-recs.ts`, both tested: `reply_faster` needs at least 1 inquiry in the window, and `open_saturdays` needs a reader that reports unopened Saturdays (none exists yet, so it does not fire).
- **Six sections** built on the shipped `Fold` (new `between` slot), each with a picture that is always visible:
  - finding: `SourceBars`;
  - asking: `ReplyGauge` and `HabitDots`;
  - booking: the funnel fills stage by stage, and an empty stage is a `GhostTrack`;
  - ahead: `CalendarStrip`, 13 weeks;
  - reputation: `StarsFill` and the badge `ProgressRing`;
  - compare: the health ring, `PriceRail`, and "Shops like yours".
- **Pictures play once** when their section is reached (`Reanimate`). Reduced motion or a hidden tab shows the final values at once.
- **New readers** in `lib/vendor-growth-series.ts`: views and inquiries per Manila day and month, plus the next 13 weeks of booked dates.
- **One view builder.** `growth-view.ts` words every read into what the screen draws. It is pure, so the lab and the page share it.
- **Honest reads.** A refused read draws "Couldn’t load". It never draws a zero, an empty chart, or new-shop copy.
- **Retired.** The 28-day reads and the "Monthly" picker; their window became 30 days / 12 months.
- **Retired, and deleted** (re-port: five of #7338's fourteen stay — see above). These cards had nothing left mounting them: `SourceBreakdown`, `InquiryHandlingCard`, `HealthCompositeCard`, `MomentumCard`, `MomentumChart`, `MomentumWindowToggle`, `PerformanceControls`, `ReplyClaimCard`, and `ReputationCard`.
  - The Ugat both-ends guard rule is "mount it or delete it", and the design replaced each one.
  - Their honest-read pins moved to the screen that ships:
    - `s41c` pins the §6 bench's "Couldn’t load" ahead of the empty line;
    - `the-price-meter-is-shown` pins the view's `unread`;
    - `the-pickers-are-one-dropdown` pins the window ▾.
  - `root-map-waves-2-3` drops the `REPLY_SPREAD_PCT` quote, because no screen prints it now.
  - `port-control-baseline.json` — NOT regenerated in the re-port (Build 3 owns the file); regenerate at integration.
- **Read errors recorded.** `lib/vendor-growth-series.ts` now logs each refused read with `[supabase-error]` before returning null, so it is no longer a silent drop.
- **Corners.** `analytics-growing.css` routes every corner through the `--m-r-*` tokens (radius guard).
- **Lab.** `/dev/supplier-lab?s=analytics[&shop=sample|new][&win=12][&fail=1]` draws the real screen on the prototype's fixture shops (`app/dev/supplier-lab/analytics-lab.tsx`).
- **Guards.**
  - New: `performance/analytics-is-growing.test.ts`, `lib/analytics-growing.test.ts`, `lib/vendor-growth-series.test.ts`, plus a new count pin in `lib/shop-section-figures.test.ts`.
  - Re-anchored with no pin dropped:
    - `the-price-meter-is-shown` now pins `<PriceRail>` under `view.price.show`, with the read gated by `canMarket`;
    - `these-features-have-a-doorway` now pins `bench: funnelBenchmark` → `view.bench.rows`;
    - `your-badges-are-on-the-page` re-anchors Batch A on its last name.
  - Shrunk: `every-fold-reveals-on-open.baseline.txt`, because the funnel no longer hand-rolls a fold.

SPEC IMPACT: None — the screen is #7338's owner-approved design (6 Nov); the ONE BUILD spec's line "#7338 (replaced)" is the controller's to update.

## 2026-11-10 · fix(analytics): #7418 brought onto main and made green (Build 6 Lane I, item 1)

- Merged `origin/main` (129 commits, clean).
- **The Booked stage reads on the admin client** (conforms to #7435, audit C2): `performance/page.tsx` makes
  `bookingsAdmin = createAdminClient()` beside the role check and hands it to the five `event_vendors` funnel reads
  (`fetchVendorFunnelTotalsResult` ×3 · `fetchBookedBySource` ×2), scoped by the shop id resolved from the session.
  `event_vendors` has no vendor SELECT policy, so on the session these answered Booked = 0, drawn as a real number.
- Regenerated the two generated files the PR left red on purpose: `lib/ugat/screens.generated.json` (the two lines
  #7338 changed) and `scripts/port-control-baseline.json`.
- ⚠ For whoever merges second of #7418 / #7435: #7435's `LIB_READERS` lists `fetchVendorFunnelTotals`,
  `fetchServiceBookedCount` and `fetchNullServiceBookedCount`; this page no longer calls them, so their three lines
  must be deleted ("has no callers left").

SPEC IMPACT: None.
