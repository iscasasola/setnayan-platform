## 2026-08-20 · fix(join): the invitation door says the date in words, and never says a date nobody has picked

The first screen a guest ever sees — the shared invitation link, and the branded
`/{slug}/invite` address that goes on printed QR posters — printed the event date
**straight out of the database**: `2026-12-18`. That is a machine's way of writing
a date, on the one screen whose whole job is to make a stranger feel invited. Both
`/join` doors did it, and so did the "you're in" screen after joining.

**The obvious fix would have been worse than the bug.** `events.event_date` is only
a decided day when `event_date_precision` says `'day'`. For `'month'` and `'year'`
the column holds a **placeholder**, and formatting it prettily announces a specific
date the hosts have never picked. Measured in production 2026-08-20: **4 of 9
events are `'year'` precision while holding a real-looking date** — one reads
`2027-03-09`. A guest would have been shown "March 9, 2027" for a party with no
date yet, and could book a flight on it. `2027-03-09` is ugly; "March 9, 2027" is a
lie.

So the line now asks `formatEventDateWithPrecision`, which has always been right
about this and says why in its own comment: *"Sometime in 2027"* for a year,
*"August 2027"* for a month, the full long form only for a real day. It is not a
second copy of the rule.

**One helper, not two doors.** `lib/join-door-meta.ts` mirrors the shape of
`lib/shared-join-link.ts` — pure, no I/O, one answer for every screen that shows
it. These two doors are exactly the pair that drifted before: three of `JoinShell`'s
own siblings once hand-copied its wrapper instead of importing it.

`event_date_precision` is **required, never optional**, on the helper's input. A
caller that has not selected the column must pass `null` deliberately; if it were
optional, forgetting it would compile and the door would silently go back to
guessing. Proven, not assumed — dropping the passthrough fails typecheck at all
three `JoinShell` call sites. Three pages now select the column beside the date,
including the branded QR page.

An unrecognised precision suppresses the date and still renders the venue. On a
door, a missing line costs a guest one question to the host; a wrong date costs
them a plane ticket.

Tests — 7 in `lib/join-door-meta.test.ts`, green in **UTC · Asia/Manila ·
America/New_York · Pacific/Kiritimati** (CI runs UTC, the one clock where DATE-column
mistakes cancel out). Six mutations, each confirmed to have LANDED by occurrence
count, all red: reverting to the raw column (1→0), trusting any precision (1→0),
either door hand-rolling the line (1→0 each), the branded page dropping the column
(1→0), and the meta line being deleted entirely (1→0).

🪤 **The source arm of that guard was decoration on its first run and is recorded
here because it will be written again.** It asked whether the file *contained* the
string `joinDoorMeta` and whether it matched `meta={[`. Sabotaging a door to
hand-roll the line — the exact regression — left it **green twice over**: the
import line still carried the name, and the replacement read
`meta={event ? [event.event_date, …`, with `event ? ` between the brace and the
bracket. **An import is not a call, and a file-level count cannot say which
expression renders.** It now extracts each `meta={…}` expression brace-balanced and
reads it.

SPEC IMPACT: None
