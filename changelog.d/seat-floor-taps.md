## 2026-11-20 · fix(seat-plan): the empty floor's steps take a tap

Owner, 20 Nov 2026, live fix (*"Yes, fix it now"*), after asking *"can you also check if the auto seat plan works"*. Walked on a TEST event at 375: on an empty floor, **"Build my seating draft" did nothing, tap after tap** — and the same button's `.click()` built the floor at once (2 tables, 8 guests seated). No request ever left the page.

Cause: the "Lay out your floor" card is drawn inside the floor (`canvasRef`), and `onCanvasPointerDown` calls `setPointerCapture` on every press for its pan. A captured pointer's `click` is dispatched to the floor, never to the step under the finger — so all three steps (Set room size · Add your first table · Build my seating draft) looked pressable and did nothing.

Fix: the card stops its own `pointerdown` from reaching the floor (`data-floor-steps`). Guard `seating/_components/the-floor-steps-take-a-tap.test.ts` (goes red if the card's handler is dropped or stops nothing).

Not changed here (found in the same walk, drawn in `prototypes/guests_redesign_2026-11-20/` for the owner): a new table lands off the existing row, the draft and "Fit" fit the tables not the room, the add-table sheet stays open after adding, and an empty Seats › List floats the thumb row mid-screen.

SPEC IMPACT: None
