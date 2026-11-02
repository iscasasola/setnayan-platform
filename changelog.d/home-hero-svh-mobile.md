## 2026-07-02 · fix(home): show the 5 pillar cards on mobile Safari (svh hero)

On iOS Safari the homepage's 5-pillar dock was cut off / hidden behind the
browser's bottom toolbar. The cinematic gate hero (`.hr-hero`) was sized with
`height: 100vh`, which on iOS Safari resolves to the *toolbar-hidden* height —
taller than the visible area while the bottom toolbar is showing. That pushed
the bottom-anchored `.hr-dock` (the 5 tiles) below the fold, and because the
gate locks scroll (`overflow: hidden`), the user couldn't scroll to reveal it.

- `home-reskin.css` — `.hr-hero` now uses `height: 100svh` (smallest / toolbar-
  shown viewport) with `100vh` kept as the pre-`svh` fallback, so the hero always
  fits the visible area and the dock stays on-screen in every toolbar state.
  Matches the `100dvh` convention already used by the content sections below.
- `.hr-dock` bottom offset now adds `env(safe-area-inset-bottom, 0px)` so the
  tiles also clear the home indicator when Safari's toolbar minimizes (no-op in
  the common locked-gate state, where the inset reports 0 under the toolbar).

SPEC IMPACT: None — pure CSS viewport-unit fix, no behavior, schema, pricing, or
copy change.
