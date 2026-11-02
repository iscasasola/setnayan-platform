## 2026-07-02 · feat(vendor): extend scroll-into-view animation to the rest of My Performance

Closes the consistency gap from the animation pass: only the windowed zone
(Momentum · ROI · funnel · by-source) animated. The other Pro+ cards — **Inquiry
handling, Conversion & deals, Reputation, Capacity, Demand radar** — now animate
on scroll-into-view too, so the whole page reveals as the vendor scrolls.

- **`<Reanimate>` wraps each card** (sections 3–5 in `page.tsx`) → each fades up
  the first time it enters the viewport.
- **Bars grow** — `perf-bar-grow` on the Reputation star-distribution bars +
  Demand look bars; `perf-bar-grow-y` on the Reputation review-velocity bars +
  Demand month-heat.
- **Counts tick** — `<CountUp>` on the direct integer displays: Conversion
  win/decline/lost counts, Inquiry slipped-lead counts, Reputation star-tally
  counts, Demand look counts. They read the same in-view context, so numbers tick
  as their card reveals.
- **Formatted stat tiles fade (not counted)** — the `text-3xl` tiles hold
  pre-formatted strings (durations, ₱, %, ratings); counting a duration up reads
  as misleading, so those animate via the section fade rather than a tick. The
  Health hero is left untouched (it's the always-visible signature card).

Built on the proven `<Reanimate>` + `perf-bar-grow*` + `<CountUp>` primitives from
the prior PRs — no new mechanism.

Verified: `tsc --noEmit` clean · ESLint clean · production build.

SPEC IMPACT: None (motion/polish).
