## 2026-07-10 · fix(seating): print pack honours linked-serpentine even spacing + drop a dead import

Two small gap-audit fixes:

- **Print/PDF pack ignored the even-chairs flag (gap 10/16).** PR #3003 made the
  2D editor draw a *linked* serpentine's chairs at uniform slot-centre density,
  but `seating-pdf.ts` still called `tableGeometry(shape, capacity)` with no
  `even` arg, so the downloaded seating pack drew the chairs endpoint-anchored
  and bunched at the tips — a visibly different layout from the screen, breaking
  the pack's "print matches the plan" promise. Now passes
  `t.link_group_id != null` (already on the fetched `EventTableRow`; `box` is
  even-invariant so the spacing/scale math is untouched).
- **Dead import (gap 13).** `figure.tsx` imported `plainMaterial` but only used
  `mannequinMaterial` after the one-piece rebuild. Dropped it from the import
  (`plainMaterial` stays exported — `booth-chassis.tsx` still uses it).

`tsc` + radius + retired-string guards clean.

SPEC IMPACT: None.
