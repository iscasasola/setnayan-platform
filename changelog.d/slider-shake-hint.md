## 2026-07-03 · feat(ux): idle "drag me" shake hint on line sliders

- When no one is touching a line slider, its knob now does a small periodic
  left↔right shake so first-time users understand it drags sideways (owner
  2026-07-03). The shake stops the instant that slider is touched.
- Reusable primitive, not per-slider wiring: a `@keyframes sn-slider-shake` +
  `.sn-shake` rule in `globals.css`, added/removed app-wide by one client
  effect `<GlobalSliderHint>` (mounted in `providers.tsx` next to
  `GlobalHaptics`). A MutationObserver (setTimeout-coalesced, not rAF — rAF is
  dead in hidden tabs) catches sliders mounted later in on-demand overlays.
- Opt-in two ways: `.sn-range` gives native-`accent-color` sliders a custom
  brand-gold knob (required — native thumbs can't be transform-animated) plus
  the shake; `data-sn-hint` adds only the shake to sliders that already have a
  custom thumb, keeping their look.
- Applied to the customer-facing planning sliders: Setnayan AI comparator
  (wedding-timeline + hourly-rate → `.sn-range`), homepage pricing calculator
  (guests + days → `data-sn-hint`), onboarding pax + budget (→ `data-sn-hint`).
  Operator-tool sliders (admin color studios, monogram editor, camera/parallax
  debug) are intentionally excluded — the hint is a first-time-user discovery
  affordance, noise on power tools.
- Accessibility: silent under `prefers-reduced-motion` (the client effect never
  adds the class, and the universal freeze block neutralises the keyframe
  anyway); `.sn-range` adds a keyboard-only `:focus-visible` ring on the knob so
  the custom thumb keeps a visible focus indicator (WCAG 2.4.7).

SPEC IMPACT: None (UI affordance; no schema, pricing, or copy change).
