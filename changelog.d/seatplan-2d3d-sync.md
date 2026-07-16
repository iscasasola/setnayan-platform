## 2026-07-16 · fix(seating): one coordinate contract — 2D/3D/List provably synced + render-crash guards

Implements `Seat_Plan_2D3D_Sync_Council_Verdict_2026-07-16.md` + the auto-save-on-exit
rule from `Seat_Plan_2D3D_Alignment_Directive_2026-07-15.md`, folding in the
render-crash investigation:

- **GUN A** — one serpentine body-geometry family: `lib/seating-3d.ts`'s independent
  `SERP_RI=0.95/RO=1.55` metric family is deleted; the band radii/chair gap now derive
  from the shared `metricGeometry('serpentine')` (the 2D px lock scaled to metres:
  Ri≈0.789 · Ro≈1.183 · tip rm≈0.986 · bbox≈1.864 m). Mesh, band, `tableDims`, chairs,
  `serpentineChainSnapWorld`, footprint discs — all downstream of the ONE family, so a
  3D-snapped chain passes the server validator by construction. 3D serpentines visibly
  shrink ~24% (owner sign-off #1).
- **GUN B** — the 2D free board letterboxes to the room box's 20×30 aspect exactly like
  sized rooms; table render scale is always metric; percent space is isotropic +
  canvas-independent (the anisotropic fill-the-cell shear is gone).
- **GUN C** — atomic weld persist: new `commitWeld` server action writes mover + anchor
  (x, y, rotation) in ONE round trip at connective-snap drag-end in BOTH the 2D editor
  and the 3D lab (replacing the lone instant `commitRotation` + split writes); the 3D
  drag-snap `doLink` is removed (positioning, NOT linking); a `seating-dirty:{eventId}`
  localStorage marker + a non-blocking lab banner make unsaved-2D staleness visible at
  every door into the lab.
- **Contract v2** — normative coordinate-contract header + shared projection API in
  `lib/seating.ts` (`DEFAULT_ROOM_M`, `roomBoxM`, `pctToWorldM`/`worldToPctM`,
  `rotationWorldY`, `metricGeometry`, `metricPoseM`, `legalJoinPoseM`,
  `validateChainJointM`, `resolveHomePcts`, `fitRoomToCell`, `canvasPxToPctM`,
  `editorWorldPose`, `contentBoundsM`, `weldCommitBatch`); `lib/seating-3d.ts` keeps
  thin re-exports. `linkTables` validates via `validateChainJointM` on metric poses —
  the NOMINAL_W bridge + `venueW && venueL` guard drop, so free-board links validate too.
- **Proof suite** (merge-gated in `test:unit`): `lib/seating-parity.test.ts` +
  `lib/seating-golden-room.fixture.ts` — T1 projection identity/round-trip, T2 canvas
  independence, T3 one-family frozen goldens, T4 golden S-bend cross-view, T5 200-case
  seam closure, T6 null-row home parity, T7 #3307/weld-atomicity pins, T8 render-seam
  guard.
- **Crash guards** — new `app/dashboard/[eventId]/seating/error.tsx` route boundary
  (recoverable card; the seating segment previously escalated a between-hooks throw to
  the root "Application error"); `occupantsFor` guards `new Array(capacity)` via
  `sanitizeCapacity`; `fetchTables` heals NaN/absurd persisted coords + capacities at
  read time (`sanitizePersistedCoord`).

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/Seat_Plan_2D3D_Sync_Council_Verdict_2026-07-16.md`
(implemented) + `Seat_Plan_2D3D_Alignment_Directive_2026-07-15.md` (auto-save-on-exit
door audit landed as atomic-weld + visible-staleness marker; the full generalized
exit-flush of plain moves remains Save & view + marker — see PR follow-ups). Decision
logged at the bottom of the corpus `DECISION_LOG.md`.
