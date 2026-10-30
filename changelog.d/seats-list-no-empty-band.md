## 2026-10-30 · fix(guests): Seats › List starts right under the pinned row — the empty band is gone

Owner, iPhone app (five screenshots of Guests): *"the guests> list has that row under top row occupiable. and the others
have that one row not used. we want to use that space"*. Builds on #7098 (Map · Seats › 2D · 3D are the whole screen).

- **The cause, measured** (`/dev/guests-lab` at 390 × 844, WebKit with touch). The ONE row is fixed under the top nav
  (`--gs-top`) from the start, while its holder sits where the Guests screen begins on the page — the column's `pt-3` plus
  the page title group's `gap-6`, 36 px on a phone. A view that scrolls the page (Guests › List, March) fills that strip
  on its first scroll; Seats › List owns its height (`SeatPlanInGuests`, the seat plan's no-page-scroll rule), so it
  never did: its first table head started 40 px under the row and "To seat" read ~64 px down, an empty band.
- **The fix.** Seats › List's body is now a ROW SURFACE (`.rowSurface` / `data-guests-row-surface` in
  `guests-screen.tsx`, chosen by `startsUnderTheRow` in `lib/guests-views.ts`): lifted by the same measured offset as the
  full surface (`--gs-top` − `--gs-root-top`) so its top is the row's bottom, and running to the bottom nav. The row does
  not float over it (the holder keeps its height), so the list's sticky table heads stick right under the row.
  `SeatPlanInGuests` fills the row surface (no measured height of its own) and keeps its phone bleed; only the full
  surface pushes its side lists under the row. The event column drops its foot under it (`globals.css`, beside the full
  surface's rule), so nothing scrolls the list away from the row.
- **Gap from the row's bottom to the first content, before → after** (lab, 390 × 844): Seats › List **40 → 4 px**;
  Guests › List 43 → 43 (unchanged, by instruction); March 44 → 44 (scrolls the page, like the List); Map · Seats › 2D ·
  3D unchanged (full surface from the top nav, the row floats over it — #7098).
- **The lab now draws the page's title group** (`app/dev/guests-lab/page.tsx`): without it the lab placed the screen
  24 px higher than the app and the band could not be seen there.
- 🔒 `lib/guests-top-row-and-full-screen.test.ts` (7): which views are row surfaces (rendered), the lift, the height, the
  column's dropped foot and the seat plan filling it. Sabotaged: `.rowSurface`'s lift removed → red. The seats-body
  anchor in `lib/maps-are-always-full-screen.test.ts` (2) follows the new expression.

SPEC IMPACT: None

## 2026-10-30 · fix(guests): nothing peeks above or under the pinned row on a scrolled Guests › List

Owner, live iPhone app, Guests › List scrolled down: *"something is peeking on the top of guests"* — with the shell bar
slid away, a guest row ("Ms. Juanita Sacdalan +1", round buttons cut in half) showed in the strip ABOVE the pinned row,
and another cut row showed BETWEEN the row and the sticky VIP group head.

- **Measured** (`/dev/guests-lab` at 390 × 844, WebKit with touch, the bar now sliding away like the real one and a 47 px
  safe area stood in): with the bar away the row pins at the safe area (`--gs-top` = `env(safe-area-inset-top)`), and
  `elementFromPoint` in the strip above it returned the list — nothing painted there. As the bar came back the row
  glided its `top` (`.stick` `transition: top 300ms`) while every sticky head keyed on `--gs-top` (the List's group heads,
  March's) jumped in one frame: **32 px** of list between the row and the head at the glide's first frame, 17 px at 60 ms.
- **Fix** (`guests-screen.module.css`): the pinned row's `top` no longer animates (`transition: none`), so the row and
  its heads move in the same frame (gap **0** in every frame); and on a phone (below 701 px, where the bar slides away;
  not on the full-screen views, whose background is the plan) the row carries the page's paper up from its top edge to
  the top of the screen, edge to edge (`::after`). It sits under the shell bar, so nothing changes while the bar shows;
  once the bar is away, the band runs from the very top of the screen to the row's bottom edge (strip above the row:
  list → the row).
- **The lab's top bar slides away now** (`app/dev/guests-lab/lab-top-bar.tsx`, the app's own `useHideOnScroll`,
  `data-hidden`, curve and safe-area padding; the wrapper carries `data-chrome="app"`), as the Suppliers lab's stage does —
  the old stand-in never moved, so this could not be seen in a walk.
- 🔒 `lib/guests-top-row-and-full-screen.test.ts` (8). Sabotaged: the row's `transition: none` dropped → red.

SPEC IMPACT: None
