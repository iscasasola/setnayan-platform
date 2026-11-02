## 2026-10-22 · fix(guests): every +1 seat is on the card, counted once, and a failed read is never "no +1"

Live cale-ice (read-only): Antonio Loo and Darryl Jan Patrick Lim each bring two +1s, and their guest card said
"Allowed, but no +1 added yet." The card read its guest's +1 with `.maybeSingle()`. Two rows are an error to
PostgREST, and the card drew that error as the empty state.

- **Guest card** (`guest-card-data.ts` → `plusOneLines`): reads every live seat row, oldest first. Each seat gets
  its own line, using the shipped words ("+1: Bringing Ana Cruz" / "+2: Awaiting +1 to confirm their name").
  A refused read now says "Couldn’t read this guest’s +1s", never the empty line. The pure helper is
  `plusOneSeatLines` (lib/extra-seats.ts).
- **Check-in desk, souvenir desk, find-your-seat pass**: who a guest brings now comes from their seat rows
  (`companionNames`), not the bringer's one-name `plus_one_name` mirror. Before this, a guest bringing two showed
  one name ("party of 2"), a seat renamed on its own row showed the old name, and a guest set to None still showed
  one.
- **Pass card**: a refused party read printed the mirror's 0-or-1 guess. It now prints no party.
- **Reply page**: a refused seat read (`plusOneSeatsFor` → `null`, no longer `[]`) now keeps the single-box
  fallback. Before, it drew empty boxes over the +1s a guest had already named.
- **Event details, "N expected with their plus-ones"**: this added the +1 NUMBER to a total that already counts the
  +1 rows, so every seat was counted twice. It now adds only the seats with no row yet (`seatsNotYetOnTheList`).
- Guards: `every-seat-is-on-the-card.test.ts` (N rows → N lines for N = 0…4; a refusal is never the empty state; no
  `plus_one_of_guest_id` read in app/ or lib/ is a single-row read) and `lib/every-seat-is-counted.test.ts`.
- Lab: `/dev/guests-lab?part=card&seats=2` (plus `&seatread=empty|fail`) and `?part=screen&plusones=1&paired=1`.

Juanita and Maxima Sacdalan: no reader missed their +1s. Both seat rows were removed on 2026-10-14 (two separate
host Removes, 2.5 s apart). The Remove of that time left the number standing (fixed by #6700), and the 10-21
backfill deliberately skipped guests with a removed seat. So from 10-14 until the owner re-added the +1s on
10-22 ~00:37 PHT, each had a +1 allowed and zero live rows. Their pairing (`pair_with_guest_id`) plays no part:
the List does not draw pairs.

No data migration. The planned "legacy TBA +1" conversion was dropped: all 37 live TBA rows already have exactly
the shape today's writers produce.

SPEC IMPACT: None
