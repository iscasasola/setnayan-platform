## 2026-10-26 · fix(maker, papic): the Background tiles keep the toolbar in place · a background Undo is drawn at once · a Papic filter is picked in place

Three owner reports from his phone (2026-10-26), each root-caused in `/dev/maker-lab` and the code:

- **"changing some background color … does not stay on that screen · not changeable to video, stock videos/photos or
  upload photo"** — the Stages toolbar's swipe (`stage-tools.tsx`: a sideways move on the panel steps to the next
  part) skipped the Style carousel but never the Background tool's row of picture tiles (`data-stage-bg-strip`). A
  drag along the tiles — the only way to reach the other colours, the loops, the scenes and the uploads — stepped the
  toolbar to the neighbouring part (walked: Schedule › Background › Colour, drag → Home › Closing, Background grey) and
  the canvas jumped with it. Now `lib/maker-swipe.ts`: a move that starts on the tiles, or in ANY row that scrolls
  sideways, is that row's own. The scene row's sources moved to `lib/stage-bg-sources.ts` (a Pro event is offered
  Colour · Scene · Video · Upload in every shell). Guard: `lib/the-background-tiles-keep-the-toolbar-in-place.test.ts`.
- **"when undo is pressed … it blinks quickly for around 5-6 seconds"** — the three background savers (a scene's, the
  Cover Scene's, Studio › Look's) handed no inverse to the ↺ journal (listed as "phase 2" in `UNDO_NOT_DRAWN`), so the
  ↺ after a background pick took the slow path: a whole-Maker render and a new canvas page. Now each hands one
  (`lib/background-pick-undo.ts`): the BEFORE is drawn at the press, the page redraws once in place after the ↺ lands,
  a refused ↺ draws the AFTER again. Guard: `lib/the-background-undo-is-drawn-at-once.test.ts`; the three are off
  `UNDO_NOT_DRAWN` and named in G6's must-list.
- **"on papic, picking a filter reload the whole screen"** — each look was a form whose action (`setPapicStyle`) ends
  in `redirect(...)`, a navigation. The strip now highlights the tapped look at once and saves through
  `setPapicStyleInPlace` (same gate, check and column; answers, never redirects; a refusal puts the ring back and is
  said under the row). The form stays the no-JavaScript path. Guard:
  `app/dashboard/[eventId]/studio/papic/_lib/picking-a-filter-stays-in-place.test.ts`.

SPEC IMPACT: None — behaviour restored to the approved toolbar (row 2 "swiped sideways"), the undo plan's
phase 2 for these three savers, and the controller's "one tap saves" for the Papic strip. No schema, no copy, no price.
