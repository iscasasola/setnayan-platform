# HANDOVER — rd/animate-works (Animate fix builder, 2026-10-16)

Spec: controller-2026-10-12/test-animate/WALK.md (11 faults). Base origin/main 14b8e33.
Owned elsewhere (#6568): lib/maker-refresh.ts, hub-draft-bar.tsx, use-scene-canvas.ts, fixed-scene-style-row.tsx,
buffered-canvas-frame.tsx, mood-board-studio.tsx — do not edit.

## Done
- F1 · scroll arrival finishes in view: `HUB_SCROLL_IN_END` (hub-canvas.ts), written for every scroll scene; CSS fallback
  = Calm's `entry min(92%, 30vh)`. Guard lib/a-scroll-arrival-finishes-in-view.test.ts (sabotaged red twice).

- F3 · delayed part holds its first frame: motionSlots fill `backwards`; fixture rehashed by a script that proves the fill is the only change; guard = the-motion-reaches-the-guest test 9 (sabotaged red).

- F12 · no scroll timelines (Safari<26, Firefox): `@supports not (animation-timeline: view())` gate in globals.css plays every scene arrival on the clock once `.pahina-in` (scroll scenes fall back to arrival, never a Build out); hero parts read `--el-anim-t` (`hubElementArrivalOnly`); scene parts + fixed blocks get the same block. Guard lib/arrival-plays-without-scroll-timelines.test.ts (sabotaged red twice) + the-motion-reaches-the-guest 1·4. Fixture rehashed by script proving only fill + anim-t + no-view block changed.

- F4 · live names blink: CHOSE "the loading screen does not draw a part that will arrive" (keeps its place, `data-el-waits`, visibility hold ≤2.5 s inside the motion gates) — not "skip the replay", which would mean the couple’s Build in never plays for a guest. Parts with no own Build in are drawn as before. `heroArrivingForSkeleton` (hero-design-of.ts). Guard app/[slug]/_components/the-loading-screen-never-blinks-the-names.test.ts (sabotaged red).

## Next
F3 fill backwards · F4 skeleton names · F5/F6 canvas + hold-▶ arrivals · F7 rows · F8 action end · F9 From ▾ ·
F10 latest pick · F11 Slow lift · F12 no-view() engines · F2 verify live.
