## 2026-07-16 · feat(seating): sweetheart-on-stage shared oracle rule + full authoring parity (2D ⇄ 3D)

Closes the seat-plan alignment program (#3274..#3278, #3281, #3285) with the owner's full-parity amendment (2026-07-16). Both projections now route every authoring act through the SAME server actions AND the SAME `lib/seating.ts` oracle — no forked validation, no act one view would reject and the other persist.

**Sweetheart-on-stage — SHARED oracle rule (retired 3D-only rule, now in the oracle):**
- `lib/seating.ts`: `OracleZone` gains `sweetheartExempt?`; new exported `stageZone(fp, rect)` helper. `checkPlacement` + `penetrationDepth` skip a sweetheart-exempt zone only for a `sweetheart` pose — every other table over the stage is an `overlap` violation (heals via the existing slide / monotone-escape). The stage is now a CONDITIONAL obstacle, not "a platform, not an obstacle".
- Both zone builders — the 2D editor `zonesFor` and the 3D lab `oracleZones` — push `stageZone(...)` (sized room only; the free auto-grow board stays place-anywhere in both). `solveAutoLayout` adds the stage as the same conditional obstacle (ppm-gated), so Auto Arrange keeps non-sweetheart rows off the platform while the sweetheart may seed on it. Applies identically to 2D drag/rotate/auto-arrange and 3D (both already route through `checkPlacement`).
- Existing saved rooms with a non-sweetheart table on the stage are never force-moved (standing rule) — they surface via the mount audit and heal on drag.
- Tests (`lib/seating-oracle.test.ts`, +8): sweetheart on stage OK · round on stage violation · round straddling the stage edge violation · monotone-escape off the stage allowed · non-stage zone still blocks a sweetheart · `stageZone` %→px + flag · solver seats nothing but a sweetheart on the stage.

**Full authoring parity (the earlier "CREATE/DELETE/LINK are 2D-only" ruling RETIRED):**
- CREATE: `createTable` now accepts an optional oracle-valid `x_pos`/`y_pos`. The 3D lab computes an oracle-valid spawn (spiral over the shared `checkPlacement`, mirroring the 2D `nearestFree`) and persists it; the 2D `AddTablePanel` passes the same via a `computeSpawn` callback. Both persist the identical off-stage, non-overlapping spot so the other view reads it exactly — no more raw grid-default in 3D.
- LINK: the 3D manual arm-link now uses `weldLink` — 2D-parity pull-to-join: the mover snaps to the anchor's nearest legal joint via the shared `legalJoinPose`, is oracle-checked vs third parties, its pose is persisted, THEN it links through the same server `linkTables` (which re-validates same-family + `isLegalJoint`). The drag-snap path keeps `doLink` (already at the joint).
- DELETE: `deleteTable` tidies a link-group remnant — a unit reduced to one member is unlinked (name + shared-QR flag cleared). Identical in both views since both delete through this one action.

SPEC IMPACT: Seat_Plan_2D3D_Alignment_Directive_2026-07-15.md (the "Full-parity amendment (owner, 2026-07-16)" section is now implemented — sweetheart-stage shared in the oracle; create/delete/link parity across 2D ⇄ 3D) + DECISION_LOG.md row (2026-07-16).
