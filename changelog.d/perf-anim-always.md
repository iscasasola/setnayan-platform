## 2026-07-02 · fix(vendor): My Performance animation always plays + Momentum charts grow

Follow-up to the re-animation work. The animation was correct + deployed but
suppressed for anyone with OS "Reduce Motion" on (the gate I'd added), so it read
as "not animating." Owner 2026-07-02 chose **"always play it."** Also closed a
gap: the Momentum mini-charts only faded before.

- **Un-gated** — removed the `@media (prefers-reduced-motion: reduce)` rule for
  `.perf-reanim`/`.perf-bar-grow`, and dropped the reduced-motion check in
  `<CountUp>`. The bar-grow, section fade, and number count-up now play for
  everyone on every Daily/Monthly/Annual switch. (Deliberate product call — the
  motion is gentle 0.4–0.6s; other reduced-motion handling on the site is
  untouched.)
- **Momentum charts grow** — new `.perf-bar-grow-y` (scaleY from the base) on the
  Bookings bar-chart bars and the Earnings sparkline, so the Momentum graphs
  re-draw on switch instead of only fading.
- **Animate on scroll-into-view (first view guaranteed)** — owner: *"on first
  view it should animate; we always want their first animation to show."* Before,
  the animation fired at page load, so below-the-fold sections (funnel · ROI ·
  by-source) finished off-screen and were never seen. New `<Reanimate>` wrapper
  (IntersectionObserver) holds each section in its pre-animation state (hidden /
  bars at 0) until it scrolls into view, then adds `.perf-play` to run the bar
  growth + fade; `<CountUp>` reads the same in-view signal via context so the
  numbers tick at that moment too. Momentum + funnel + ROI + both by-source
  tables are each their own reveal section. Replays on the Daily/Monthly/Annual
  toggle (the block is re-keyed → wrappers remount → re-observe). IO-unsupported
  falls back to revealing immediately.

Verified: `tsc --noEmit` clean · ESLint clean · production build.

SPEC IMPACT: None (motion/polish).
