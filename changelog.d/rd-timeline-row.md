## 2026-10-08 · feat(ui): the Timeline row and its ticker — one row for a schedule's moment and a Love Story chapter

Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; approved gallery
`prototypes/control_templates_2026-10-08.html` § 13): *"tap the time start and
time end and name of that schedule"* · *"how about a ticker instead so it does
not eat too much space"* · *"can also be love story form"* · *"add optional for
the day it can be month and year only or month year and day or year only"*.

**The shared pieces (neutral — `app/_components/`, nothing of the Maker's):**

- `app/_components/timeline-row.tsx` — `TimelineRow`: `when · name [· trailing]`.
  The name opens across the whole row with ONLY ✕; a tap outside or Enter keeps,
  ✕ or Esc leaves it as it was; one row open at a time (the wearer's state).
- `app/_components/ticker.tsx` — `TimeTicker` (hour · minute in 5-minute steps ·
  AM/PM) and `WhenTicker` (a Year · Month · Full date pill and only the columns
  that precision needs): rolling columns with a centre band, scroll-snap, one
  line above, Done. `TickerPill` is the pill a row wears and the pop it opens —
  the house sheet on a phone, a panel under its button on a desktop, never
  taller than the screen.
- `lib/timeline.ts` — the arithmetic, pure: the start carries the end, an end at
  or before the start is the next day, rows sort by start, an overlap is one
  line; a when's precision is the SHAPE of the date (`{ y, m?, d? }`), so
  nothing is ever saved as an invented day.

Guard: `apps/web/lib/the-timeline-row-and-ticker.test.ts` (6 tests; 19 sabotages
seen red). Accent: the fill and its words are the pill selector's
`PILL_ON_CLASS`; the accent ink and the open pill's edge are the two `mulberry`
classes the test lists, until the accent token lands.

SPEC IMPACT: None — builds what `INTERACTION_RULES.md` § 9 and the approved
gallery already say.

## 2026-10-08 · feat(studio): Studio › Schedule wears the Timeline row — start · end · name

Each moment is `start pill – end pill · name · ⋯` (`studio-day.tsx`). A time
rolls on the ticker and is written ONCE when the ticker closes, through the
rail's own `updateScheduleBlock` and refusal handling: moving the start moves
the end with it, an end at or before the start is the next day (and says so),
rows sort by start, an overlap is one amber line and never blocked. An end time
was already stored (`event_schedule_blocks.end_at`) — no new storage. A moment
with no end time says "End", never the rail's 30-minute stand-in.

"+ Add a moment" now adds in place: it starts where the last one ended, one
hour long, with its name open; left unnamed it is dropped. A named one is ONE
quiet write — `createScheduleBlock` honours the existing `maker_quiet` field
(no revalidate → no whole render of the Maker; before: one whole render per
add) and takes the row's uuid from that quiet write, so the screen needs
nothing back. +0 server actions; every other caller of the action is unchanged.
With no event date, or for a coordinator who may stage, the shipped sheet adds.

Guard: `apps/web/lib/studio-schedule-wears-the-timeline-row.test.ts` (5 tests;
22 sabotages seen red). `port-control-baseline.json` regenerated.

SPEC IMPACT: None.

## 2026-10-08 · feat(studio): Studio › Schedule — the place and For ▾ move behind the row's ⋯

The row is the owner's three things: start · end · name. A moment's place and
who it is for (For ▾) are behind ⋯ with the rest — the shipped `MomentInspector`
already draws Where and For ▾ with the same writes, in a phone's sheet and a
desk's right column, so no ability is lost. ⚠ The controller's recommendation,
NOT yet confirmed by the owner — its own commit so it can be taken back alone.
What changes for the eye: the row no longer shows the place or "Only for ·
Entourage" at a glance.

Guard: test (6) of `studio-schedule-wears-the-timeline-row.test.ts` (5 sabotages
seen red).

SPEC IMPACT: None until the owner confirms where Place and For ▾ live.

## 2026-10-08 · fix(love-story): a moment marked "Together" keeps its anchor

`momentFromForm` (`lib/love-story-moment-intent.ts`) read a moment form's anchor
as `'met' | 'yes'` — a list written before the third chapter anchor,
"Together", was added on 2026-10-01. It is the ONLY writer of a moment's anchor
(the server action and the Maker both go through it), so since that day a
moment added or edited as "Together" was saved with NO anchor and sat in
whatever chapter its date gave, while the sheet closed as if kept. It now asks
the one list (`isMomentAnchor`). Stored stories are not repaired: nothing
records which moment a couple meant — they pick "Together" again.

Guard: `apps/web/lib/a-moment-keeps-its-anchor.test.ts` (3 tests, run for every
anchor; seen red against the old line).

SPEC IMPACT: None.
