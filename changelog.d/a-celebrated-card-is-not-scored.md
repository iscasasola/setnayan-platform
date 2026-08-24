# a-celebrated-card-is-not-scored

## 2026-08-24 · fix(board): a celebrated card is kept, not graded — and the score prints once

Two defects on the My Events board, both fixes that had already landed on the
event dashboard (W1-A) and not on this identical surface:

- **"Movie Night · Celebrated · 0% planned."** The board still scored a
  finished celebration on planning — telling the owner he planned none of a day
  that happened. A finished card now shows no ring and no score; in the slot
  where the score sat it says **"Kept for good"** — the one sentence true of
  every finished celebration, in the shelf's own words. A score is the wrong
  shape for a day that has happened.
- **The ring said "7%" beside a line saying "7% planned"** — the D-6 double
  print, removed from the event dashboard and not here. The ring is now the ONE
  place the figure prints, with an sr-only "planned" suffix so a screen reader
  still hears what the number is. Swept every other `ProgressRing` mount
  (admin, go-live, vendor overview ×2, budget tile, schedule widget): each
  pairs its number with words or a different figure — the board card was the
  last double print.

Guard `a-celebrated-card-is-not-scored.test.ts` (comment-stripped source
assertions): the ring's gate must test `!finished`, the kept note must exist,
the "N% planned" template must not return, the sr-only suffix must stay.
3 mutations measured before → after, all red.

SPEC IMPACT: None.
