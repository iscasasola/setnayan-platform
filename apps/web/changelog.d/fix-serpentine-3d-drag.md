## 2026-07-10 · fix(seating): 3D serpentine drag/placement hardening (gap audit)

Four bugs the gap audit found in the 3D lab's serpentine drag + placement guard
(`commitDrag`), all around the auto-snap/link work:

1. **Auto-linked chain was UNMOVABLE (HIGH).** Dragging a *linked* wedge skips the
   snap path, so the placement guard ran — and its `others` list was filtered
   only by `t.id !== d.id`, i.e. it INCLUDED the dragged wedge's own linked
   siblings. A rigid unit is supposed to touch, so the guard always saw an
   "overlap" and reverted → you could never reposition a chain. Fix: exclude the
   dragged table's own `linkGroupId` group from the overlap test.

2. **Snap exemption skipped ALL placement rules (MED).** A snapped serpentine was
   exempted from the *entire* guard (`snappedRotDeg === null` gate), so it could
   land on the dance floor, on the stage, or over a round table. Fix: the guard
   now always runs; only serpentine-vs-serpentine overlap is exempted when
   snapped (the intentional tip-touch), while stage/dance zones and
   non-serpentine overlap stay enforced. The guard now also tests the *snapped*
   position (`dropX/dropZ`), not the raw drop.

3. **Chain move didn't clamp siblings to the board (LOW).** Moving a linked unit
   applied the drag delta raw to every sibling; only the dragged member was
   wall-clamped, so a sibling could be pushed off-board. Fix: clamp the *shared*
   delta by the group's bounding extent — keeps the unit rigid AND on-board
   (clamping members independently would pull the chain apart at a wall).

4. **Snap could land on an already-occupied tip (MED).** `serpentineChainSnapWorld`
   returned the nearest candidate with no occupancy check, so extending a chain
   could snap a new wedge onto a tip an existing member already holds (they'd
   overlap). Fix: reject any candidate that coincides (< 0.6 m) with an existing
   wedge centre — a legit tip-to-tip placement sits ~1.68–2.06 m away, so the
   filter cleanly falls back to a FREE tip. Unit-proven: the same drop snaps to a
   spot when empty, but is refused once that spot is occupied.

Tests: +1 in `lib/seating-3d.test.ts` (occupied-tip refusal); full 3D+2D seating
suites green (102/102). `tsc` clean.

Note: for a *snapped* placement, serpentine-vs-serpentine overlap is governed by
the occupancy filter (0.6 m), not the full guard, so a pathological three-wedge
fan around one anchor could still touch a non-neighbour wedge — rare and cosmetic;
left for a future pass.

SPEC IMPACT: None (behaviour fixes to the existing 3D serpentine snap/link).
