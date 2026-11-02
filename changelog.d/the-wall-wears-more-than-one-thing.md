## 2026-09-04 · feat(venue-decor): the side walls wear every treatment the couple chose

`walls` is multi-select — greenery behind a drape, a garland along the top of it
— and the room drew the primary and dropped the rest. Side walls and pillars are
the largest continuous surface in a reception, so this was the biggest remaining
gap between what a couple chose and what they saw.

⚠ **UNLIKE THE WELCOME TABLE, THESE OCCUPY THE SAME PLANE.** Its pieces are
separate objects that stand side by side, so drawing them all was placement.
Wall treatments all hang on the wall: rendering two without separating them
z-fights instead of layering. Each extra treatment now hangs
`WALL_LAYER_STEP_M` (9 cm) further into the room — close enough to read as one
dressed wall, far enough that a garland sits ON a drape rather than through it.

**Layer 0 is at depth 0, and that is the whole safety argument.**
`selAll(...)[0] === sel(...)` by construction, and `li * STEP` is `0` at
`li === 0`, so a wall that chose one treatment renders in exactly the plane it
always did. Both halves are asserted rather than promised — an off-by-one
(`(li + 1) * STEP`) would push every existing dressed wall 9 cm off its own
surface, in every room already built and shown to a supplier.

⚠ **THE STACK FOLLOWS PICK ORDER, NOT PHYSICS, AND THAT IS A DELIBERATE TRADE.**
Choose a garland first and a greenery wall second and the greenery hangs in
front of the garland. Ordering by physical depth instead would move whichever
treatment is currently drawn — the one thing rule 03 forbids. Their first choice
is the one they are already looking at, so it keeps its plane.

`'bare'` is filtered rather than drawn: it is the couple asking for a plain wall.

**`walls` also leaves `ROOM_DRAWN_ATTRIBUTES`** — the primary-only disclosure
list — because the zone no longer draws only the primary. The sibling guard
added yesterday asserts that rule generally; this change is the second zone to
move, and the first one it caught.

**Guard — `lib/the-wall-wears-more-than-one-thing.test.ts`.** Five sabotages
verified red, including the off-by-one depth and re-listing walls as
primary-only.

Remaining: `photo_wall` is now the last primary-only multi-select zone, and it
needs a different rule again — its options split into backdrop SURFACES
(floral / step-and-repeat / greenery) and things that hang ON one (balloon
garland, neon), so two surfaces cannot simply stack.

SPEC IMPACT: None — draws choices already stored and already shown on every
other surface.
