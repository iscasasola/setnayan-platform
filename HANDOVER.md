# HANDOVER — rd/animate-works (Animate fix builder, 2026-10-16)

Spec: controller-2026-10-12/test-animate/WALK.md (11 faults). Base origin/main 14b8e33.
Owned elsewhere (#6568): lib/maker-refresh.ts, hub-draft-bar.tsx, use-scene-canvas.ts, fixed-scene-style-row.tsx,
buffered-canvas-frame.tsx, mood-board-studio.tsx — do not edit.

## Done
- F1 · scroll arrival finishes in view: `HUB_SCROLL_IN_END` (hub-canvas.ts), written for every scroll scene; CSS fallback
  = Calm's `entry min(92%, 30vh)`. Guard lib/a-scroll-arrival-finishes-in-view.test.ts (sabotaged red twice).

- F3 · delayed part holds its first frame: motionSlots fill `backwards`; fixture rehashed by a script that proves the fill is the only change; guard = the-motion-reaches-the-guest test 9 (sabotaged red).

## Next
F3 fill backwards · F4 skeleton names · F5/F6 canvas + hold-▶ arrivals · F7 rows · F8 action end · F9 From ▾ ·
F10 latest pick · F11 Slow lift · F12 no-view() engines · F2 verify live.
