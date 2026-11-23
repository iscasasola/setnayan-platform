## 2026-11-23 · feat(seat-plan): a hall's floor plan in Spaces is the couple's own seat-plan editor; PlanMaker retires

PR 2 of 2 for the one seat plan (DECISION_LOG d1fafcd5, option B). It builds on PR 1, `claude/seat-plan-one-editor`, and adds no migration.

- **One editor, two modes:**
  - The couple's `SeatingEditor` takes `source` (`seating-store.ts`: `{ kind: 'event' }` or `{ kind: 'venue', spaceId, floorPlanOpen }`).
  - In a hall it shows the hall's own tables, its room size and its doors, and nothing for guests:
    - no edit lock, presence or live refresh;
    - no Auto arrange, rules or people;
    - no publish, print or 3D;
    - no booths, signs, dance floor or cocktail area;
    - no stage yet;
    - no linking, swapping or chair marking.
- **The hall's tables:**
  - Shapes: round, long, long with a chair at each end, and half-moon booth, each with one chair count.
  - They are drawn through `rowGeometry` (`lib/seat-plan-engine/plan.ts`).
  - A couple's row still draws as `tableGeometry(shapeHintFor(type), capacity, linked)`, byte for byte. The couple's dock bodies are left verbatim, and the hall gets its own.
- **Writes:**
  - Every save the editor makes comes from ONE resolver, `useSeatingWrites()` (`seating/_components/seating-writes.ts`): the venue's store, else the event's shipped action, under the call's own name. The editor imports no action itself (`lint:dup-rule` GUARD 1: a local `createTable` must not shadow the action it isn't). The Ugat field scan follows `const { X } = useWrites()` to the hook's import (`lib/ugat/scan-fields.ts`), so the Add table form still maps to `actions.ts#createTable`.
  - The hall's store (`spaces/_components/venue-seat-plan.tsx`, `venueSeatingStore`) maps those calls to the Spaces dispatcher's existing ops (`addTables`, `updateTable`, `placeTable`, `deleteTable`, `addDoor`, `deleteDoor`).
  - The event-only calls refuse.
  - No new server action. Nothing under `app/dashboard` provides a store.
- **Spaces sheet:**
  - The hall's picture (`PlanPoster`) and one button, "Open the floor plan", which opens the editor full screen (`RiseScreen`, `kind="zoom"`).
  - On the free plan, the lock's words appear in place of the button.
- **Stable between renders:** the hall's rows are memoised on the hall's read, and the store reads the sheet's `run` through a ref. The editor's empty lists, `me` and `source` are the same objects every render, so saving a table never rebuilds the store and doesn't re-run the editor's effects.
- **Walked at 390 in `/dev/spaces-lab`, and fixed:**
  - **It opened behind its sheet.** A `RiseScreen` sits on the pop layer (40), under the Sheet (50) that opened it. Opened from inside a Sheet (`InSheet`), it now marks itself `data-rise-over-sheet`, and `globals.css` lifts it to `--sn-z-modal`. Drawn on `<body>` after the sheet, it stands over it. The sheets the editor opens are also modal and drawn later, so they still stand over the editor.
  - **On a phone it opened on the guests' List.** A hall stays on its floor at every width.
  - **The hall's tables lay metres outside its wall** (Fit at 0.15). The floor's first layout was 134 px wide, tables with no saved spot dodged each other there, and `prev` kept them. Unplaced tables are now placed, and Fit frames, in layout pixels (`layoutRectOf`, untransformed). The region and canvas are measured from `offset*` and the observer's border box. A table nobody moved is placed again when the canvas size changes; a moved (`dirty`) one keeps its spot. On an untransformed couple page every number is unchanged.
  - **Guest words in a hall.** The venue mode now drops the phone head's "0 seated · guests see it on the day" line, its Unseated + View row, the desktop List/2D picker (a hall has one view; 3D was still offered on the phone) and the people search. A hall row reads `venueRowWords` ("Long · 12 chairs · 2 at the ends"), not "0/12 seats · Long banquet (8 seats)".
  - `text-sn-13` is not a class; the hall's lock line and the phone status line use `text-sn-md`.
  - Guards 8 and 9 in `the-seat-plan-is-one-editor.test.ts` hold all of the above.
- **CI fixes for the fold:**
  - `spaces/_components/base-layout.tsx` is renamed `base-layout-fold.tsx`. The socket guard reads any `*layout.tsx` as a Next layout, and this fold now reaches the editor (whose live hooks a hall never runs).
  - The hall's dock Delete and Done are `ActionButton`s, so the seating page's template score goes from 59 back to 57, under its baseline.
  - The one-editor test uses the shared `stripComments`.
- **Line up:** PlanMaker's Line up is now the venue editor's Arrange row ("Line up the tables", `lineUpPlan`).
- **Removed:**
  - `app/_components/plan-maker/` and its test.
  - The roster line in `lib/no-delete-x-on-list-rows.test.ts`.
  - `the-floor-fits-the-room.test.ts` checks 5 and 6 read PlanMaker's file. They now hold the same two rules where they live today: the hall's picture (`PlanPoster`) draws the square wall, and the editor's one `snapToLines` isn't skipped in venue mode.
- **Guard:** `seating/_components/the-seat-plan-is-one-editor.test.ts`:
  - PlanMaker is gone;
  - both sides import the one `SeatingEditor`;
  - the hall's store answers every call;
  - no store under `app/dashboard`;
  - couple geometry is unchanged;
  - the hall-to-rows mapping and the door moves are checked.

SPEC IMPACT: None. It builds DECISION_LOG d1fafcd5 as ruled. Rows of seats and blocked areas wait for their drawing.
