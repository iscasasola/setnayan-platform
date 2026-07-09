## 2026-07-09 · feat(seating-lab): tap the dance floor to start a dance party

In the couple seating lab's **Play** mode, tapping the dedicated dance floor
sends the nearest seated guest out to dance: they stand, walk to a dance-floor
spot, and loop the dance clip. Tap again → another guest joins, up to the
floor's capacity — a growing dance party.

- **Pure helpers** (`lib/seating-3d.ts`, unit-tested): `danceSpots(rect, {spacing,inset})`
  lays a non-overlapping grid of standing spots INSET inside the dance rect,
  ordered CENTRE-FIRST so the party grows from the middle out; the actual grid
  pitch is ≥ `spacing` by construction, so no two dancers overlap, and the array
  length IS the floor's capacity. `pickDanceGuest(candidates, target)` returns
  the candidate nearest the target spot (stable tie-break), or null. Both
  deterministic in their inputs.
- **`onFloorClick`** (`…/seating-lab-3d.tsx`): in Play mode a tap whose world
  point is `pointInZone(danceFloorRect(floor, room))` calls `sendDancer()` —
  purely additive after the existing `placeZone`-drop branch; Build-mode
  deselect and the floor-edit "move" drop are untouched.
- **`sendDancer`**: picks the next free spot (`spots[dancers.length]`), gathers
  seated candidates EXCLUDING anyone already dancing / mid-swap / walking in and
  +1 ghosts (no figure), picks the nearest, and walks them there with the
  dance-floor avoidance disc DROPPED (`floorObstacles(…, {skipDanceFloor:true})`)
  so the path can reach the floor. At capacity it's a no-op.
- **`<DancerToken>`**: mirrors `<MoverToken>`'s walk (2.6 m/s, faces travel), but
  on arrival flips `pose="walk"→"dance"` and holds its spot + heading forever —
  it never re-seats. The seat is never mutated for a dancer, so removing it from
  `dancers` restores the static `SeatedAvatar` for free. The walk→dance switch
  eases through `<Figure>`'s generic preset blend; the dance clip is wall-clock
  driven inside `<Figure>`.
- **Exclusion**: a new `dancingGuests` set joins `movingGuests`/`walkingIn` in
  `seatedByTable` (chair shows empty while dancing, +1 ghost suppressed) and in
  `emoteEmitters` (no bubble over the empty chair) — added to both memo deps.
- **Ending it**: tap a dancer to walk it home (a plain `Mover` back to its own
  seat, dance disc dropped; `onMoverDone` re-commits the same seat = no-op), plus
  a Play-panel **"Sit everyone down · N dancing"** button (`clearFloor`) and a
  "Tap the dance floor…" hint when a dance floor exists.
- **Reduced motion / quality low**: `<DancerToken>` snaps to the spot and starts
  dancing; `<Figure>` bakes the static `dancePose(id, 0)` held pose — the flow
  COMPLETES without per-frame motion (the figure still walked onto the floor).

Left byte-for-byte unchanged: `Mover`/`MoverToken`/`onMoverDone`/`moveGuestTo`/
`swapGuests`/`swapTables` (swap + tap-to-swap can't regress), Walk-everyone-in,
the first-person Walk-around camera, Build mode, the per-frame obstacle clamp,
and the SitController handoff.

Validated: `pnpm typecheck` clean · `pnpm test:unit` 1259/1259 green (5 new
dance-helper cases) · `pnpm lint` clean for the touched files. Live 3D
verification is the operator's (visible-interaction sign-off before ship).

SPEC IMPACT: None (lab demo interaction; no product-surface, schema, or pricing change).
