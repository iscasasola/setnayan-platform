## 2026-06-25 · fix(a11y): respect prefers-reduced-motion in JS-driven motion (item 3/4)

CSS animations were already covered by the global `@media (prefers-reduced-motion:
reduce)` reset; this closes the JS-driven motion a media query can't reach.
Audit found 14 JS-motion violations (the heavy WebGL/canvas/RAF surfaces); all
gated to a static end-state while ALWAYS firing their completion callbacks
(never strand the guest). Standardized on the canonical `usePrefersReducedMotion()`
(`lib/use-responsive.ts`); for react-three-fiber `useFrame` loops the flag is read
once and threaded in (mirroring the file's existing MonogramPlane pattern).

Gated:
- **Reveals** — veil-reveal (WebGL cloth → static lifted veil, fires onRevealed),
  rigid-stage (envelope → snap open, onOpened), reveal-preview (studio preview →
  static + onDone), save-the-date-film (no RAF auto-advance / no autoplay video;
  added an explicit **Continue** escape on the reduced video beat so a guest who
  never plays the clip still reaches the closing card / Add-to-calendar),
  wax-stamp-maker (canvas → instant seal).
- **Seating 3D** (seating-lab-3d, 5 useFrame loops) — camera fly-through, walker,
  mover tokens, table pop, OrbitControls damping → snap-to-final, onArrive/onDone
  still fire; direct dragging preserved.
- **Alaala orb** — gate clip playback/crossfade (reuse existing `reduced` state).
- **App-store studio card** — gate auto-advance slideshow + autoplay/loop video.
- **globals.css** — added `animation-delay/transition-delay: 0.001ms !important`
  to the reduced block so CSS-delayed reveals can't briefly hide content.

Already-compliant surfaces (live guest reveal path, hero scrub, all monogram
surfaces, GSAP marketing reveals) were left untouched. Adversarially verified
`ship` (a first-pass blocker — stranding on a video beat — was caught and fixed).

NOTE: WebGL/seating snap-to-final + the film Continue tap-through were verified by
static trace; a browser/iOS spot-check with reduce-motion on is recommended.

SPEC IMPACT: None — a11y correctness, no schema/SKU/pricing/flow change.
