## 2026-07-02 · feat(vendor): My Performance animates on scroll-into-view (first view always shows)

Owner: *"on first view it should animate; we always want their first animation to
show."* Before, the graph/number animation fired at page load, so anything below
the fold (funnel · ROI · by-source) finished off-screen and was never seen.

- **New `<Reanimate>` wrapper** (IntersectionObserver, threshold 0.2) holds each
  section in its pre-animation state — `.perf-reanim` at opacity 0, `.perf-bar-grow*`
  scaled to 0 — until it scrolls into view, then adds `.perf-play` to run the
  section fade + bar growth. So the vendor's first look at each section always
  shows the animation, wherever they are on the page.
- **`<CountUp>` reads the same in-view signal via React context** (client provider
  wrapping RSC children with client consumers), so the numbers tick at the exact
  moment their section reveals. Context: `null` = no wrapper → tick on mount
  (fallback); `false` = armed, hold 0; `true` = in view → tick.
- **CSS** moved from animate-on-render to gated under `.perf-play`.
- **Reveal sections:** Momentum · funnel · ROI · both by-source tables — each its
  own `<Reanimate>`. Replays on the Daily/Monthly/Annual toggle (the block is
  re-keyed → wrappers remount → re-observe). IntersectionObserver-unsupported
  falls back to revealing immediately (content never stuck hidden).

Verified: `tsc --noEmit` clean · ESLint clean · production build (exit 0).

SPEC IMPACT: None (motion/polish).
