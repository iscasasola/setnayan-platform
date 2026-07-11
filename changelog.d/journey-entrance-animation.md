## 2026-07-11 · feat(schedule): entrance animation for the Journey view

A cohesive entrance choreography for the Journey mode (`/schedule?view=journey`, PR #3100), matching the app's CSS-keyframe house style (`cubic-bezier(0.16, 1, 0.3, 1)` ease, like `subnav-lift`). Pure CSS — the view stays a **server component**, and the global `prefers-reduced-motion: reduce` block freezes all of it to instant, so reduced-motion users get the fully-rendered page with **no JS gate**.

- **Arc** rises in first (fade + lift).
- **Progress rail** grows left→right (`scaleX`) once on mount.
- **Phase headers + rows cascade** top-to-bottom on a staggered `--journey-delay` (140 ms + 55 ms × index, capped at 1100 ms so a long "road there" phase can't push later rows into a multi-second wait).
- **Milestone nodes** scale-in (uses the `scale` property so it composes with the node's left/top positioning).
- The **"you are here" marker** pops in last (~900 ms), then gently breathes (a 2.6 s beacon pulse with an expanding mulberry ring) — a quiet "this is where you are on the journey" cue.

- `app/globals.css` — four keyframe sets + `.journey-rise` / `.journey-rail-fill` / `.journey-today` / `.journey-node-pop` utilities.
- `app/dashboard/[eventId]/schedule/_components/journey-view.tsx` — applies the classes and threads a per-element stagger index (arc → phase header → each row), with a typed `--journey-delay` inline style.

**Verified** by rendering the view and freezing the animation timeline mid-flight (`getAnimations()`): the mid-cascade frame shows early rows settled, a row caught mid-rise, later rows not yet in, and the marker correctly still hidden; the settled frame matches the static layout exactly (`both` fill → no end-state drift). `tsc` ✓ · `next lint` ✓ · `next build` ✓.

SPEC IMPACT: None (cosmetic).
