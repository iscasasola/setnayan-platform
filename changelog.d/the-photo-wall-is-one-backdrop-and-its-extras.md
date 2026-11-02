## 2026-09-04 · feat(venue-decor): the photo wall shows the backdrop AND what hangs on it

`photo_wall` is multi-select, and its own catalogue comment says the photo op is
"usually two things at once" — a balloon garland over a step-and-repeat. The room
drew the primary and dropped the rest.

⚠ **THIS ZONE NEEDED A DIFFERENT RULE FROM THE WALLS.** Side-wall treatments all
hang on a wall, so they stack: each extra hangs further into the room. A photo
wall cannot stack, because it is **one physical panel** — it cannot be both a
greenery wall and a lit neon panel, since those are the same surface described
two ways.

So: the **panel takes the primary's material**, and **every chosen style's
decoration draws on it**. A garland over a step-and-repeat is two things. A
greenery wall over a neon panel is one thing chosen twice, and the primary wins.

**The primary does not move — material and depth.** `selAll(...)[0] === sel(...)`,
and `lift()` returns 0 at index 0, so a board that chose one style renders
exactly as before. Extras lift `PHOTO_LAYER_STEP_M` forward, which matters here:
monogram plates sit at z 0.07 and floral blossoms at 0.08, so without a lift the
blossoms swallow the plates whenever both are chosen.

One detail worth naming: greenery only tints the blossoms leaf-green when it is
the **sole** floral surface. Greenery *and* a floral wall is a floral wall ON
greenery, and green blossoms would read as the flowers having been swapped out.

**`photo_wall` leaves `ROOM_DRAWN_ATTRIBUTES`** — every multi-select zone now
draws in full, so the primary-only legend has only single-select zones left to
speak about.

🪤 **A sabotage found a hole in this guard before it shipped.** Reverting the
reader to `sel()` stayed GREEN: every other assertion — the panel rule, the
membership gates, the lift, the registry — passes against a one-element array,
while only the primary ever draws. The reader itself is now pinned. A guard that
checks the shape of a fix, but not that the fix is connected, verifies nothing.

An earlier assertion also went red against the *correct* implementation: it
banned `style === …` outright, and the panel's own primary-wins rule looked like
the bug it was hunting. Narrowed to assert the panel rule instead.

**Two obsolete fixtures moved.** `the-room-draws-what-the-couple-saved` used
`photo_wall` as its primary-only example; every named decor zone now draws in
full, so the ceiling group gained a `decor-ceiling-*` name and the read-back
check moved there rather than being deleted.

SPEC IMPACT: None — draws choices already stored and already shown everywhere else.
