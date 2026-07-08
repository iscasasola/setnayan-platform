## 2026-07-08 · feat(seating-3d): booths face the room centre (computed facing, no more "stuck on the wall")

Booths used to render at a FIXED facing (front toward +z) regardless of where they
sit, so a perimeter booth stood sideways or backwards to the room — the bottom
booths literally faced the entrance wall with their backs to the guests. Every
booth now gets a COMPUTED facing so its FRONT points into the room, back to its
nearest wall. Global across all three seat-plan surfaces (couple lab, public guest
walk, homepage demo) via the shared `BoothMesh` visual + shared
`templateBoothObstacles` collision path.

- **New pure geometry** — `boothFacingY(booth, room)` (`lib/seating-3d.ts`): the yaw
  (radians) that turns a booth's front (+z) toward the room centre — the SAME bearing
  `boothApproach` walks in from, so a booth faces the room and is approached from the
  room side. `θ = atan2(−c.x, −c.z)` where `c = pctToWorld(...)`; dead-centre booth
  (no bearing to origin) → `0` (front-of-house +z), matching `boothApproach`'s centre
  fallback. Plus `rotateLocalRad(p, ry)` — the radian sibling of `rotateLocal`
  (which takes degrees + negates) — for rotating booth-local offsets by that yaw.
- **Visual** — `BoothTemplate` outer group + `BoothMesh` fallback silhouette group
  now carry `rotation={[0, facingY, 0]}` (chassis / props / staff / nameboard are
  children → they rotate coherently). The world-positioned branded `BoothSign`
  (outside the template group) has its booth-local anchor offset rotated via
  `rotateLocalRad` and is spun so the logo backdrop stays behind the booth.
- **Obstacles** — `templateBoothObstacles()` rotates each chassis footprint disc +
  staff-anchor disc offset by `boothFacingY` (radii unchanged), so avoidance tracks
  the rotated footprint (a 90°-turned booth swings its multi-lobe footprint to the
  other axis). The generic booth's single disc sits at the booth centre (zero
  offset) → rotation-invariant, unchanged.
- **Hit target** — all three call sites (`plan3d-scene` `BoothHitTarget`,
  `guest-venue-3d` inline map, `seating-lab-3d` `LabBoothHitTarget`) rotate the hit
  box's center offset and spin the box so the non-square / front-shifted volume
  (BUFFET 3.4w, BACKDROP z 0.35, STATION z 0.2) aligns with the rotated chassis — no
  dead tap zones.
- **`boothApproach` unchanged** — it already puts its walk-up point on the bearing
  toward the room centre and faces the booth; a new unit test pins that the front
  faces the room centre ↔ the approach point lies on that same (front) side.

No schema change — facing is COMPUTED from position; `event_floor_booths` has no
rotation column (prod booths were already repositioned flush to the walls; demo
data untouched).

New unit tests (`lib/seating-3d.test.ts`): cardinal walls (left→+x, right→−x,
top→+z, bottom→−z), dead-centre→0, front-faces-centre ↔ `boothApproach` consistency,
and `rotateLocalRad`↔`rotateLocal` parity under the degree→radian convention.

Validated: `pnpm typecheck` clean, `pnpm test:unit` 1241/1241 pass.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md — booths now compute a facing toward the room centre (back to nearest wall) across all 3 surfaces; visual + obstacle + hit footprint rotate together; no schema change.
