## 2026-07-10 · fix(seating): serpentine tables now magnet-link end-to-end like the long tables

Owner: "the serpentine tables do not link on the end of the tables, similar to
the long tables." Root cause was a tolerance asymmetry, NOT missing logic — the
serpentine end-to-end snap (`serpentineChainSnap`) was fully implemented and
correct, but the editor called it with the **default 36 px catch radius**, while
the analogous long/banquet snap (`rectChainSnap`) was deliberately given a
generous, footprint-scaled catch (`Math.max(40, halfLen * 0.9)`).

A serpentine wedge's chain candidates (continue-the-circle / S-bend) land ~a
whole footprint from the drag centre, so a 36 px catch is essentially unhittable
by hand — the magnet never engaged, and serpentines wouldn't link.

- `seating-editor.tsx` — the serpentine snap dispatch now passes a
  footprint-scaled catch `Math.max(48, footprintPx(moving).w * 0.5)`, mirroring
  the rect path's "drag it ROUGHLY end-to-end and it snaps" generosity. No
  kernel, geometry, DB, or 3D change — `serpentineChainSnap` already accepted a
  `tolPx`; it just wasn't given one.
- Test: a hand-loose (~44 px off) drag now MISSES at the old 36 px default but
  CATCHES at the generous tolerance — locks the regression.

`tsc` clean · serpentine snap suite 5/5 · full unit suite 1343/1343. Owner
verifies live by dragging two serpentine tables roughly end-to-end in the
seating editor.

SPEC IMPACT: None (editor snap-tolerance fix).
