## 2026-11-27 · feat(gown-maker): the gown maker's stage and lab (step A4)

- The bride's 3D stage, copied from the cake designer's: `GownView` (`plan3d/kit/gown-view.tsx`) loads three.js and
  the faceless mannequin lazily, solves her body to her numbers and draws it. No page outside the gown maker
  carries it.
  - The lighting scenes are the prototype's six (`lib/gown/scenes.ts`). Only its three lights are used, with no
    shadow maps.
  - Measuring-tape guides show at bust, underbust, waist and hips.
  - Colours pass through true up to 90 % brightness (`lib/gown/tone.ts`).
  - A device with no 3D gets an honest line, and her numbers are kept.
- Phones stay cool (owner rule): one loop asks the frame governor (`lib/gown/frame-governor.ts`). It draws at
  30 fps, and at 4 fps after 15 s without a touch. Measured on an emulated iPhone: 29.5, then 4, then 29 after a tap.
- `/dev/gown-maker-lab` (dev only): move any number and watch her change. Also the faceless check (front and side),
  the six scenes, and the no-3D fallback.

SPEC IMPACT: None (implements WHATS_NEXT_Gown_Maker_Port_2026-11-27.md §4 step A4).
