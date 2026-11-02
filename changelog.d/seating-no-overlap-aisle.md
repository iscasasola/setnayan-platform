## 2026-07-11 · feat(seating): no-overlap + walkable aisle on manual table drag

Manual single-table dragging in the shipped 2D seat-plan editor
(`apps/web/app/dashboard/[eventId]/seating/_components/seating-editor.tsx`) now
enforces the floor to stay physically walkable, in a to-scale (sized) room.

- **No overlap + ~0.6 m aisle.** `overlapsAny` gains a metre-scaled `gap`
  (`0.6 m × pxPerMeter`, falling back to the old 10 px breathing gap on the free
  board) applied to every obstacle: table↔table, the dance floor, the cocktail
  room, and — new — **vendor booths** (using the real `BOOTH_FOOTPRINT_M` metre
  box that PR1 wired into the editor). Chain families (serpentine / banquet /
  family-head) keep their by-design touching exemption.
- **The STAGE stays a platform.** It is deliberately not an obstacle, so a table
  (or the couple's head table) can be placed on top of it — matching the owner
  rule that only the stage may be overlapped.
- **Axis-separated slide, no spiral.** When a drag target overlaps, the table
  keeps whichever single axis is clear so it glides along the obstacle to the
  nearest gap. It only calls `overlapsAny` (a cheap AABB), never `nearestFree`
  per-frame, so it cannot resurrect the old "spiral an already-touching table
  across the room on the first drag pixel" bug. A table that STARTS overlapping
  (a pre-existing layout) drags free so it can never get boxed in.
- **Free board unchanged.** Enforcement is gated on `venueScaled`; without a
  metre scale the 0.6 m aisle is meaningless, so the free board keeps its valued
  place-anywhere behaviour.

Reverses the prior deliberate "place anywhere on manual drag" behaviour, per the
owner authoring rule ("elements cannot overlap … must have space to walk"). Last
of the three stacked floor-plan PRs (footprint/facing → booked-vendors+entrance
→ no-overlap).

Follow-ups (out of scope here): the multi-table linked-unit rigid-block drag
still places anywhere (needs a unit-bounding-box test); booth AABB ignores booth
orientation (booths have no 2D rotation state today).

SPEC IMPACT: authoring rule for the "Arrange the room" 2D editor (spec corpus /
owner memory `project_setnayan_guests_living_roster.md`) — tables can't overlap
and keep a ~0.6 m walking aisle; the stage is a platform that may be overlapped;
dance floor + cocktail room + vendor booths are obstacles. No DB change.
