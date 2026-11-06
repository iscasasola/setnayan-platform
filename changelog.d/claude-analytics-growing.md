## 2026-11-06 · feat(analytics): Shop › Analytics is "Analytics, growing" — one window, six sections that grow, Do next in the open

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
- **Retired, and deleted.** These cards had nothing left mounting them: `SourceBreakdown`, `PricePositionCard`, `ConversionDealsCard`, `InquiryHandlingCard`, `CapacityCard`, `FunnelBenchmarkCard`, `HealthCompositeCard`, `MomentumCard`, `MomentumChart`, `MomentumWindowToggle`, `PerformanceControls`, `ReplyClaimCard`, `ReputationCard`, and `RoiAttributionCard`.
  - The Ugat both-ends guard rule is "mount it or delete it", and the design replaced each one.
  - Their honest-read pins moved to the screen that ships:
    - `s41c` pins the §6 bench's "Couldn’t load" ahead of the empty line;
    - `the-price-meter-is-shown` pins the view's `unread`;
    - `the-pickers-are-one-dropdown` pins the window ▾.
  - `root-map-waves-2-3` drops the `REPLY_SPREAD_PCT` quote, because no screen prints it now.
  - `port-control-baseline.json` regenerated for `/vendor-dashboard` and `/vendor-dashboard/performance` only, so each removal is one line.
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

SPEC IMPACT: controller records the ruling
