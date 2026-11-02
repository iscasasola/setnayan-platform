## 2026-10-08 · feat(ui): one press feel from one listener — nothing snaps; the ring needs no `::after`

Owner, verbatim (2026-10-08): *"the animation when tapped on selector must feel
the same on the rest when pressed"*. The CSS press of `ce6d6f779` dipped but
SNAPPED on every control that carries a Tailwind `transition-*` utility (most
pills) — not acceptable. Stacked on `rd/style-card-one-size`.

- `app/_components/press-feel.tsx`, mounted ONCE in the root layout: one
  delegated `pointerdown` on the document (never a listener per element) plays
  the dip to .93 and the spring back with the Web Animations API on the control
  under the finger — the same seven kinds the stylesheet's press names — at the
  family's speed (`--sn-pill-dur`). An animation composes with any transition, so
  nothing snaps. Skipped: anything inside the guest's Event Hub (`.sn-editorial`),
  a disabled control, "reduce motion".
- The stylesheet's own press SCALE is taken off wherever the listener acts (the
  two never double); the `:active` dimming stays as the no-script answer. The
  guest's Event Hub keeps the shipped press untouched.
- The ring (`sn-press-ring`) is drawn by the same listener as a transient fixed
  element over the control (transform and opacity only; it removes itself) — no
  `::after`, so the ⓘ and a style card's picture can wear it. Worn by: the
  dropdown's button, the ⓘ, a style card's picture, a switch's track.
- Cost: 1,653 bytes minified / 907 gzip in the root layout's client code (every
  route). No dependency, no state, no timer.

Guard: `lib/the-press-feels-the-same-everywhere.test.ts` (5; "a second press
mechanism" is red). 11 sabotages seen red; pinning tests 39 files / 332 tests.

SPEC IMPACT: None.
