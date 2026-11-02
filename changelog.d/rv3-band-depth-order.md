## 2026-09-07 · fix(moodboard): the room now draws near things over far things, by rule

The live band's riser (added 2026-09-06 for the reception's celebration
zones) was appended last in `renderVenueSvg` and painted straight over the
back-right guest table's tall centrepiece whenever a couple booked one — the
same class of bug RV1 already fixed once for the dance floor, recurring
because that earlier fix was local to one zone instead of a rule the whole
compositor enforces.

`lib/reception-scene.ts` now gives every floor-standing element (guest
tables, the band's riser + figures, the host's spot, the booth row, the
feast) a `FloorItem` with an explicit ground-contact `anchorY`, and a single
`compositeFloorItems` sorts them ascending before emission — nearer paints
last, regardless of which line was appended to the array last. `ceiling`,
`backdrop` and `walls` keep fixed first slots ahead of that sort, since they
dress the room's own shell rather than standing in it.

The entrance/tunnel arches were deliberately left out of the general sort:
they never share a pixel with anything else in the room (confirmed by the
zone-layout note already in the file), and folding them in would have moved
non-empty output in the MB14b pinned control-image snapshots for no visual
change. Flagged for the record, not silently decided.

`lib/reception-scene.test.ts` gained three guards: a rasterised measurement
that the centrepiece pixel at (720, 367) stays the centrepiece's own colour
(WARM_LIGHT `#FCE4A6`) rather than the riser's fill, a symmetric case proving
`compositeFloorItems` orders correctly in both directions (no real guest-table
spot is ever further than the band, so this drives the shared compositor
directly with synthetic geometry), and a byte-identity pin (sha256, measured
on `origin/main @ d7e3558b9` before this change) for a room with no band and
default tables — nothing else moved.

SPEC IMPACT: None — a rendering-order bugfix, no schema or spec change.
