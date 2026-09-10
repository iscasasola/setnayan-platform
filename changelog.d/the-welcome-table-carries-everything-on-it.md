## 2026-09-03 · feat(venue-decor): the welcome table carries everything the couple put on it

`welcome_signage` is multi-select, and a real welcome table holds several things
at once — an easel sign **and** the seating chart **and** the guestbook. The room
read `sel(...)`, the primary, and silently dropped the rest: the couple ticked
three, saw three on the mood board and in the printed concept, and walked into a
3D room holding one.

`WelcomeSignage` now takes the whole list and steps each additional piece along
the wall the table stands against.

⚠ **What makes this safe is arithmetic, not intention.** Couples have shown these
rooms to suppliers and booked against them, so a board that chose one piece must
render it in the same spot as before. Two facts carry that, and both are tested:

1. `selAll(...)[0] === sel(...)` by construction — the first element is exactly
   what was already being drawn.
2. the offset is `i * SPACING`, which is `0` at `i === 0`.

`'minimal'` is filtered out rather than rendered: it is the couple saying there
is nothing here, and drawing it as an object would put furniture in a room they
asked to leave bare. An empty list renders nothing at all.

🪤 **A sabotage slipped past the first version of the guard, and the reason is
worth keeping.** The off-by-one mutation (`(i + 1) * SPACING`, which shunts every
existing table sideways by a metre) was applied with `String.replace`, which
substitutes only the FIRST occurrence — so it shifted x and left z alone. The
assertion was a single `match`, it found the surviving z occurrence, and reported
health. The guard now **counts** both axes. Anchor per site and assert the count;
finding one is not the same as checking them all.

Layering is the largest remaining gap between what the couple chose and what the
room shows — `venue-decor.tsx` still contains no other `selAll` call, so walls
and the photo wall remain primary-only. Those need per-treatment depth
composition rather than this zone's side-by-side placement, so they are separate
changes.

SPEC IMPACT: None — renders choices already stored and already shown on every
other surface.
