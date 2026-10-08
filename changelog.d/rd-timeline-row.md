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
