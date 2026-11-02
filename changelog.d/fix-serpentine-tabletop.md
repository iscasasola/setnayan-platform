## 2026-07-09 · fix(plan3d): serpentine tabletop renders its real curved ribbon on every surface

The serpentine table showed a plain **rectangle** on the homepage demo and the
public guest walk — a `boxGeometry` fallback — even though its chairs and
collision footprint already rode the canonical 104° quarter-donut band. Only the
seating lab rendered the true curved ribbon (inline). Now all three surfaces
share one ribbon.

- **New shared geometry** — `app/_components/plan3d/kit/serpentine-top.ts`
  exports `SERPENTINE_TOP_GEO`: the 104° band outline (`serpentineBand()`,
  capacity-independent) built into a `THREE.Shape`, extruded 0.74 m and laid flat
  (floor → tabletop height). One module-scoped geometry for every serpentine
  table everywhere.
- **Homepage demo** (`plan3d-scene.tsx` `TableMesh`) and **guest walk**
  (`guest-venue-3d.tsx`): the `dims.round ? cylinder : box` split gains a
  serpentine branch that renders `SERPENTINE_TOP_GEO` and skips the leg-post
  (the ribbon is a floor-to-top solid). Round/banquet/family/sweetheart tops are
  untouched.
- **Seating lab** (`seating-lab-3d.tsx`): its inline ribbon `useMemo` is replaced
  by the shared const — one implementation, byte-identical geometry.

The band math, serpentine chair arcs, and obstacles were already correct — this
is purely the visible tabletop mesh. Verified: typecheck · 1246 unit tests · lint
· house lints (radius strict) all green; live venue walk shows the curved ribbon
(no rectangle).

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md —
serpentine tabletop unified to one shared curved-ribbon geometry across the lab,
homepage demo, and guest walk (fixes the demo/walk rectangle fallback).
