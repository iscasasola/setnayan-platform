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

Verified: `tsc --noEmit` clean · ESLint clean (production build runs in CI before
auto-merge).

SPEC IMPACT: None (motion/polish).
