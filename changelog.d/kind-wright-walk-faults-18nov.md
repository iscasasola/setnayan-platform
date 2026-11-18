## 2026-11-18 · fix(walk): six live faults from the W4/W5 re-walk after waves 1 and 2 — four fixed, two measured and not reproduced

- **R7 · Discover's Occasion filter says "Other events", never "Celebration".** The admin roster's generic row
  (`celebration` → "Celebration") reached the filter drawer and Event stories' "Event type" pick unchanged. One shared
  rule, `lib/event-type-shown-words.ts` (`eventTypeShownWords`), now used by Discover and by the supplier door's
  `supplierEventWords` (which had its own copy). Only the word changes; the key stays `celebration`.
  🔒 `lib/event-type-shown-words.test.ts` · `app/open-shop/the-walk-round-1.test.ts` (F-W1-06 re-pointed).
- **#7900 follow-up · the admin tab landings' chips press at 44.** They were one-off `rounded-full px-2.5 py-1 text-xs`
  links (24 px). They now use the app's one chip (`CHIP_CLASS` + `CHIP_OFF_CLASS`: 40 px drawn, `.sn-hit` raises the
  press target to 44). The chip classes moved to a plain module, `app/_components/chip-classes.ts` (re-exported by `chips.tsx`), so
  the server-rendered landing can import them. 🔒 `lib/the-shared-controls-press-at-44.test.ts`.
- **#7909 follow-up · the Memories picker's counts say something.** Home's section numbers that FAILED to read
  (events, shop cards) now show "couldn’t count" instead of nothing (`HomeSegCounts.unread`). Each event's photo count
  carries `countMeasured`: a refused read used to become `0`; now it shows "couldn’t count". One rule for both,
  `lib/count-trail.ts`. `homeSegOptions` moved to the plain module `lib/home-seg-options.ts` (re-exported by
  `home-pin.tsx`) so it can be tested as drawn. 🔒 `lib/the-memories-picker-counts-say-something.test.ts`.
- **#7906 follow-up · a swap's Undo puts the +1 back too.** In `doAskedMove`, Undo of a swap re-swapped the two guests
  and returned before putting back the +1 who had come along. One pure plan, `seatMoveUndo`
  (`lib/seat-move-assess.ts`), now drives both Undo lines. 🔒 `lib/an-undo-puts-the-plus-one-back.test.ts`.
- **#7878 follow-up · `[data-send-run]` — NOT a fault, measured.** On the rendered run (`/dev/guests-lab?part=run`, a
  real browser), the selector matches exactly one element: the z-110 run screen. A zero reading comes from querying
  before the page has mounted (the screen is portalled in after mount). No code change. The guard now reads the
  attribute out of `SEND_RUN_LAYER` and checks it against the RENDERED run, not a typed copy of the string.
  🔒 `the-send-run-is-the-simple-page.test.ts`.
- **R8 · Discover 2 px sideways at 390 — NOT REPRODUCED, left open.** Drawn locally with fixture data at 375 and 390
  (the event shelves, people to follow, the Shops tools row, Event stories, Articles, Inspiration, and both see-all
  views): scrollWidth equals the viewport every time. The Shops shelf and Service cards shelf need the database and
  were not drawn. Next step: on live, at 390 and signed in, run
  `[...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth)` to name the
  element.

SPEC IMPACT: None
