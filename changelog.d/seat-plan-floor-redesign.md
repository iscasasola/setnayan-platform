## 2026-11-20 · feat(seat-plan): the floor — add a table with no sheet, rows on the stage line, Fit the room

Owner, 20 Nov, on the approved Guests drawing (`prototypes/guests_redesign_2026-11-20/…_fable.html` § 5 · 6 · 9 · 10):
*"Yes, build it"* — builder B, the seat plan's floor. Stacked on #7968 (the shared `plan-maker` core).

**One engine (`lib/plan-maker.ts`, shared by the couple's floor and a shop's Spaces).**
- `centredRun` · `gridRows` · `onGridRun` · `joinRow` · `gridLayout`: rows face the stage and centre on the stage line.
  A new table joins the first row still on the grid with room, and that row re-centres; a table placed by hand never
  moves. `snapToLines`: a moved table lines up with a row, a column or the stage line, and says with which table.
  `fitRoom`: Fit frames the room's walls in the part of the floor nothing covers. `planRoomWords`: a floor's name and
  size. `seatingFloorOf` · `seatingBoxPct` · `seatingJoinRow` · `seatingGridLayout`: the couple's tables on that grid.
- The supplier's Line up centres its rows through the same `centredRun`; the supplier's drag snaps through the same
  `snapToLines`. New `PlanPoster` (the plan's drawing with no tools).

**The couple's floor (`seating-editor.tsx` and its parts).**
- Empty floor: "Seat everyone for me" (main) and "Add a table" in a card over the thumb row — on a phone, under the
  faces in the "To seat" card. No button is drawn on the plan in Guests. (`seat-floor-start.tsx`)
- Add a table: no New-table sheet. Shape ▾ and Seats − 10 + are one row above the Add box, Round · 10 and the name
  filled in; the floor shows where the table will land; ＋ adds it there, the box closes by itself, and one line says
  "Table 2 added beside Table 1 · Undo". (`seat-floor-add.tsx`)
- Fit shows the whole room, and the plan opens that way after every add and every draft.
- "Seat everyone for me" lays the room out on the same grid (the couple's table alone on the stage line) and answers
  with one line and Undo ("8 guests seated at 2 tables") in the thumb row's toast. In Guests no notice strip is drawn
  across the floor's foot, so nothing covers the zoom. `buildSeatingDraft` takes an `undo_table_ids` intent.
- Zoomed out, a table is its number and a ring that fills (green full, gold has room); a tap says who sits there, with
  a way into that table. Names print on the chairs once they can be read. One legend line explains the rings.
- The room wears the Spaces look in Guests: an ink outline, square corners, its name and size in the corner.
- A moved table names what it lined up with. "Add a guest" on a table stays open for name after name.
- Seats › 3D: the floor plan shows at once as a poster with "Building your room…" until the room has drawn.

**Not built (see the PR):** "Start from this hall" and "Put the venue's layout back" (an event has no link to a
shop's hall, and a couple cannot read `vendor_units`); zoom inside the thumb row and the Add box as the search box
itself (the thumb row is builder A's); numbered supplier chips; the 3D row's worded controls and "Take over" card.

Guards: `lib/plan-grid.test.ts` · `the-empty-floor-starts-in-one-tap` · `a-table-is-added-without-a-sheet` ·
`the-floor-fits-the-room` · `the-3d-room-never-opens-blank`. Updated to the 20 Nov copy, claims unchanged:
`the-seat-tray-never-covers-the-zoom` · `the-seat-plan-drags-on-a-phone` · `the-seat-plan-on-the-phone`.

SPEC IMPACT: None — implements the 2026-11-20 DECISION_LOG rows ("THE COUPLE'S SEAT PLAN USES THE SAME FLOOR PLAN AS A
SUPPLIER'S SPACES", "ONE SEAT-PLAN ENGINE", "GUESTS › SEATS, ROUND TWO", "GUESTS REDESIGN: BUILD IT") as written.
