## 2026-07-10 · feat(seating-lab): serpentine end-to-end auto-snap in the 3D view

Owner (from the live 3D seat plan, hitting "Objects can't overlap each other"):
"put the ends of the serpentine next to each other to create that auto connect
snap between tables." Two real gaps in the **3D lab** (distinct from the 2D
editor, which already chains):

1. The 3D lab had **no chain-snap at all** — that auto-connect only lived in the
   2D editor (`seating-editor.tsx`).
2. Its placement guard (`checkPlacement`) rejects overlap using a **coarse
   bounding circle** (radius = half the table's longest side), so two touching
   serpentines always "overlap" and were blocked.

- **New pure world-space snap** `serpentineChainSnapWorld` (+ `serpentineTipsWorld`)
  in `lib/seating-3d.ts` — the 3D twin of the 2D pixel-space `serpentineChainSnap`,
  built on the lab's own metre band geometry (`serpentineBand` now also exposes
  the two tip points) and the lab's render rotation convention
  (`g.rotation.y = -rotationDeg`). 4 candidates per neighbour (continue-the-circle
  ±sweep, S-bend ±180° about a tip). Unit-tested: a near-tip drop glues the tips
  together **exactly** (gap < 1e-9), never stacked, at a legal junction angle —
  provable without a GPU.
- **Lab wiring** (`seating-lab-3d.tsx` `commitDrag`): dropping a serpentine near
  another serpentine's tip snaps it into the chained placement (position +
  rotation), persists both (position + the dedicated rotation action), and
  **skips the overlap guard** for that intentional touch (still wall-clamped).
  Gated to standalone serpentines (`!linkGroupId`).

`tsc` clean · seating-3d suite 66/66 (incl. 3 new snap tests) · full unit suite
1346/1346 · radius lint clean. The drag *feel* isn't headless-verifiable (r3f
drags + the auth-gated lab) → owner drags two serpentine ends together in the
3D seat plan; they should click into a flowing curve instead of being blocked.

SPEC IMPACT: None (brings the 2D editor's serpentine chaining to the 3D lab).
