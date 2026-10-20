## 2026-10-20 · fix(guests-desk): the Guests dock sits under the reading column, edge to edge, and follows it

Owner, on a screenshot of the live desktop Guests page: *"is the desktop view done fixing?"* The list was centred in its
48-rem column while the dock (Expand all · Select · Search or add · Role) ran from the stage's left edge, wider than
the list and not under it.

- **Cause 1 — the wrong box.** From 701 the dock measured the column's PARENT (the whole stage), so it was the stage's
  width at every width (1440: dock 1136 px vs column 768).
- **Cause 2 — measured once.** It re-measured only on a window resize. The column moves without one (a guest's card
  column opening/closing beside the list, the rail changing width), and the dock stayed where the column used to be —
  the owner's picture (dock's left at the stage edge, its right short of the column's right).
- **Fix.** `guests/_components/dock-follows-column.ts` measures the column itself (`.screen`: 48 rem, the Map 64 rem)
  and re-reads it on a ResizeObserver over the column, its stage and the page, plus the window resize; the right edge
  is measured from `clientWidth` (a classic scrollbar no longer shifts it). The ≥701 CSS is unchanged (`left/right:
  var(--gs-left/right)`).
- **Guard** `the-dock-sits-under-the-column.test.ts` — dock edges = column edges at 701…2560 for the List and the Map,
  after a card column opens and closes, across a resize; the ≥701 CSS draws exactly those edges and nothing sizes the
  dock; the screen hands the helper its own `.screen` root. Seven sabotages, all red.
- **Lab:** `/dev/budget-lab?shell=1` now draws the real page's 48-rem column (`sn-col max-w-3xl`) instead of a 720-px
  stand-in, so the desktop walk measures what ships.
- Walked `/dev/*-lab?…&shell=1` at 1000 · 1180 · 1280 · 1440 · 1920, Chromium + WebKit (the Safari engine, not a real
  Mac Safari): dock − column = 0 / 0 everywhere after; rail 72 → 240 at 1280 as approved; no horizontal scroll.

SPEC IMPACT: None — implements the approved 2026-10-19 couple-dashboard desktop + tablet design (dock pinned at the
bottom, page in its reading column). The prototype's own 1440 frame (a capture of the then-shipped page) shows the dock
across the stage; the open question of which width the owner wants is raised in the PR body, not decided here.
