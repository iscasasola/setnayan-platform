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
  - Every save the editor makes reads `useSeatingStore()?.x ?? xAction`.
  - The hall's store (`spaces/_components/venue-seat-plan.tsx`, `venueSeatingStore`) maps those calls to the Spaces dispatcher's existing ops (`addTables`, `updateTable`, `placeTable`, `deleteTable`, `addDoor`, `deleteDoor`).
  - The event-only calls refuse.
  - No new server action. Nothing under `app/dashboard` provides a store.
- **Spaces sheet:**
  - The hall's picture (`PlanPoster`) and one button, "Open the floor plan", which opens the editor full screen (`RiseScreen`, `kind="zoom"`).
  - On the free plan, the lock's words appear in place of the button.
- **Stable between renders:** the hall's rows are memoised on the hall's read, and the store reads the sheet's `run` through a ref. The editor's empty lists, `me` and `source` are the same objects every render, so saving a table never rebuilds the store and doesn't re-run the editor's effects.
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
