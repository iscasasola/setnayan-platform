## 2026-09-03 · feat(reception-design): the couple sees the photo they uploaded for the zone they are dressing

`event_inspiration_assets` holds up to three photos across eighteen named slots,
filled during onboarding and on the mood board — and **no 3D surface has ever
read it**. A couple uploads a ceiling they love, then picks a ceiling treatment
on a different screen with that photo nowhere in sight.

The lab's design panel now shows their own reference for the active zone, above
the treatment chips.

**Reference, never composited.** The photo sits beside the choice; it does not
enter `renderVenueSvg` or the 3D palette, and a test asserts that. If an
inspiration URL ever reached the render, the room would stop being a drawing of
what the couple chose and become a collage of what they liked — and every "the
room shows X" guarantee in this codebase would quietly become false.

⚠ **THE TWO VOCABULARIES ONLY PARTLY LINE UP, AND THE MAP SAYS SO.** The data
contract describes the zone keys as already lining up with the design parts.
Measured: four match exactly (`ceiling`, `backdrop`, `stage`, `tunnel`), `table`
→ `tables` does not, and **five design parts have no slot at all** (`walls`,
`photo_wall`, `welcome_signage`, `entrance`, `people`), while `venue`,
`flowers`, `cake`, `cocktail`, `overall`, `palette` and the six attire slots
have no design part.

So `INSPIRATION_SLOT_FOR_PART` is an explicit map rather than `slot === part`.
The shortcut would silently drop the tables photo on the singular/plural
mismatch — and renaming either side to make them agree orphans live rows, which
is exactly why `venue` was never renamed to `ceremony_venue`.

A part with no slot shows **nothing**. Not a placeholder, not a nearby photo:
showing a couple their cake beside their ceiling is confidently wrong, which is
worse than blank.

**Guard — `lib/the-reference-photo-belongs-to-the-zone.test.ts`.** Pins that
every mapped slot is a real slot key and every mapped part a real part (a typo
resolves to "no photo", which is indistinguishable from "none uploaded"), that
the singular/plural pair is absorbed, that unmapped parts return `null` rather
than a guess, that the strip follows the ACTIVE zone, and that inspiration data
never reaches the render. Five sabotages verified red, including mapping
`tables` to the wrong slot and inventing a slot for a part that has none.

SPEC IMPACT: None — reads data the couple already uploaded, on a surface that
already exists.
