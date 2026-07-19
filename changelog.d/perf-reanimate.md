## 2026-07-02 · feat(vendor): re-animate My Performance graphs + numbers on window switch

Switching Daily/Monthly/Annual now visibly re-animates instead of snapping (owner
2026-07-02: *"changing to daily monthly and annual will reanimate the graphs. and
numbers"*).

- **Remount-on-toggle** — `PerformanceControls` wraps the windowed block
  (Momentum + ROI + funnel + by-source) in `<div key={mode}>`, so every switch
  remounts it and replays the mount animations. The filter row itself stays
  mounted (the toggle never flickers).
- **Graphs grow** — new CSS `.perf-reanim` (section fades up) + `.perf-bar-grow`
  (bars scale from 0, left origin) in globals.css. Applied to the ROI attribution
  bars and the funnel bars; the Momentum mini-charts ride the section fade.
- **Numbers count up** — new client `<CountUp>` (rAF, easeOutCubic, starts at 0)
  on the headline figures: Momentum bookings + earnings (₱), ROI headline (₱ or
  bookings), funnel stage counts, and the bookings/views-by-source counts
  (`SourceBreakdown`, shared — so the /demand own-data strip ticks up on load too).
- **Reduced-motion honored** — `@media (prefers-reduced-motion: reduce)` disables
  the CSS animations, and `<CountUp>` shows the final value immediately (no tick).

`<CountUp>` is a client island used inside both client (Momentum, Funnel) and
server (ROI, SourceBreakdown) components — validated by the production build.

Verified: `tsc --noEmit` clean · ESLint clean · production build.

SPEC IMPACT: None (motion/polish; no data, pricing, or logic change).
