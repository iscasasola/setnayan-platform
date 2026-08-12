## 2026-08-12 · fix(life-flash): stop printing "0 people who made them"

Life-Flash was switched on in production today. The first thing the owner saw
on his home screen was the Alaala tile reading:

    14 moments · 0 people who made them — gathered while you're living them

The count is correct and the sentence is wrong. Nobody is missing — nobody has
been tagged yet. Printing the zero reads as loss on a surface whose entire
promise is the people who kept showing up, and it is the one number a person
meets before they ever press Play.

The people clause is now OMITTED when nobody is tagged rather than zeroed:

    14 moments — gathered while you're living them

The sentence moved to `lib/life-story-summary-line.ts` because the tile is an
async server component that the unit runner cannot import, so the line it prints
could not previously be asserted at all. `life-story-summary-line.test.ts` fails
if any count reaches the copy as a zero — asserted over the whole 5×5 grid, not
one hand-picked pair, so re-ordering the template cannot pass it for the wrong
reason.

Mutation-tested with occurrence counts printed: baseline 4/4 green · anchor
`peopleCount > 0` 1 → 0 occurrences with the sabotaged form confirmed present ·
tests went RED (2 fail) naming the exact sentence · restore 4/4 green.

Every other count on that tile (moments in the Recent lens, events in Attended)
already guarded `> 0` with an honest empty state. This was the only one, checked
in the same pass rather than left for a second visit.

SPEC IMPACT: None. Copy only; no schema, no flag, no route.
