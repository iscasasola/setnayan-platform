# HANDOVER — rd/animate-works (Animate fix builder, 2026-10-16)

Spec: controller-2026-10-12/test-animate/WALK.md (11 faults). Base origin/main 14b8e33.
Owned elsewhere (#6568): lib/maker-refresh.ts, hub-draft-bar.tsx, use-scene-canvas.ts, fixed-scene-style-row.tsx,
buffered-canvas-frame.tsx, mood-board-studio.tsx — do not edit.

## Done
- F1 · scroll arrival finishes in view: `HUB_SCROLL_IN_END` (hub-canvas.ts), written for every scroll scene; CSS fallback
  = Calm’s `entry min(92%, 34vh)` (Quick min(50%,28vh) · Cinematic min(100%,40vh); Quick capped at 28vh so the 8th staggered part never gets an inverted range — guard 2b). Guard lib/a-scroll-arrival-finishes-in-view.test.ts (sabotaged red twice).

- F3 · delayed part holds its first frame: motionSlots fill `backwards`; fixture rehashed by a script that proves the fill is the only change; guard = the-motion-reaches-the-guest test 9 (sabotaged red).

- F12 · no scroll timelines (Safari<26, Firefox): `@supports not (animation-timeline: view())` gate in globals.css plays every scene arrival on the clock once `.pahina-in` (scroll scenes fall back to arrival, never a Build out); hero parts read `--el-anim-t` (`hubElementArrivalOnly`); scene parts + fixed blocks get the same block. Guard lib/arrival-plays-without-scroll-timelines.test.ts (sabotaged red twice) + the-motion-reaches-the-guest 1·4. Fixture rehashed by script proving only fill + anim-t + no-view block changed.

- F4 · live names blink: CHOSE "the loading screen does not draw a part that will arrive" (keeps its place, `data-el-waits`, visibility hold ≤2.5 s inside the motion gates) — not "skip the replay", which would mean the couple’s Build in never plays for a guest. Parts with no own Build in are drawn as before. `heroArrivingForSkeleton` (hero-design-of.ts). Guard app/[slug]/_components/the-loading-screen-never-blinks-the-names.test.ts (sabotaged red).

- F5/F10 · scene motion pick laid on the shown frame + played once (`scene-motion-lay.ts`, `sceneMotion` message from
  scene-animate-tab; `ready` re-send). Guard lib/a-scene-pick-plays-on-the-canvas.test.ts.
- F6 · hold ▶ re-arms below-fold arrivals, replays on-screen (`guest-preview-arrivals.ts`). S3 · lab mounts the real observer.
  Guard lib/hold-play-arrives-as-a-guest.test.ts.
- F7/F8 · ▶ staggers one-by-one parts and rows (`oneAfterAnother`) + CSS sn-replay rows; ends at rest (`settleAtRest`
  finishes restarted arrivals). Guard lib/play-shows-one-by-one-and-ends-at-rest.test.ts.
- F11 · Slow lift offered only where `hubLiftMoves` (photo/clip behind), plus a note on Action.
- F2 · verified live (signed out): monogram solid ink at 2.77 s (Chromium) / 2.57 s (WebKit iPhone 13); JS chunks
  blocked → the CSS fallback shows the still at 2.9 s / 3.0 s. Tester before: 6.6 s / 4.8 s / never.

## Next
F9 (From ▾ on a part) needs a browser to find the cause · walk before/after (scratchpad aw/t/scripts: probe-scroll,
g-guest RUN=f3|rows|f12, m-maker, verify-part) · F4 real-page walk needs prod env · push + draft PR + CI.
