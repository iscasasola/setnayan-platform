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

## 2026-11-21 · refactor(seat-plan): the grid lives in the one engine (`lib/seat-plan-engine/rows.ts`)

Caught up with #7968 + `main` (merge only). Per `ADAPTER.md` §7: the grid section (`GRID_GAP` … `seatingGridLayout`)
moved unchanged from `lib/plan-maker.ts` to `lib/seat-plan-engine/rows.ts`, its spacing reads the engine's names
(`GRID_GAP = SLOT_GAP_PCT` · `GRID_ROW_GAP = ROW_GAP_PCT` · `GRID_LO/HI = TABLE_BAND_PCT`, the same 3 · 4 · 10 · 90),
`lib/plan-grid.test.ts` → `lib/seat-plan-engine/rows.test.ts`, and every `@/lib/plan-maker` import reads the engine.
The engine's gap guard now pins Line up's `centredRun(…, GRID_GAP)`.

SPEC IMPACT: None.

## 2026-11-21 · feat(seat-plan): zoom in the thumb row, supplier spots, the 3D row's words, "Table ▾"

Drawing § 5 · § 6 · § 9 — the rows the first block listed as not built that wait on nobody.

- **Zoom in the thumb row** (§ 5): on Guests › Seats › 2D, fit · − · + is one pill in the thumb row (search · zoom ·
  Show and sort), each press 44 px, on the plan's own `fitView` · `zoomAround`; the stack at the floor's right edge is
  no longer drawn in Guests, so nothing stands on the plan. The standalone page keeps its stack. (`seat-floor-zoom.tsx`)
- **Supplier spots** (§ 5): a booth on Guests' 2D floor is a small numbered chip on its wall with the booth's own
  presses; a tap shows its name. The legend ends "Supplier spots · N", a dropdown of who is where; a pick names that
  chip. (`seat-floor-spots.tsx`)
- **The 3D row has words** (§ 6): Walk in · Accents · View only — one row, one size. "View only" reads "Editing" while
  you hold the seat plan's edit and opens a card: "<Name> is editing" with "Take over" (the plan's own `lock.acquire`,
  handed down through `SeatRoomLinkContext`; the room still takes no lock), Switch to 2D, Show ▾ and what the ⓘ said.
  In Guests the thumb row's search, Entered on 3D, walks that guest to their seat (the room's own Guide me), so Guide me
  leaves that row; a room drawn on its own keeps it. Walk around / Walk everyone in keep their words while playing.
- **"Table ▾" at the Add box's right end** (§ 9): the ＋ menu's own list and handler (`seatAddOptions` · `onSeatAdd`);
  picking anything but a table closes the box and adds it the ＋ menu's way.

Guards: `the-floor-wears-its-chrome` · `the-room-says-its-controls`. Updated, claims kept: `the-seat-tray-never-covers-
the-zoom` (the zoom is now a seat of the row the tray stands above) · `lib/maps-are-always-full-screen` (5).

SPEC IMPACT: None — implements drawing § 5 · § 6 · § 9 as approved 2026-11-20.

- **2026-11-22 · fix(seat-plan): a late Undo never un-seats a guest (ship review 21 Nov).** The draft's Undo used to delete
  whatever table ids the browser sent back. The server now takes them back only when they are this event's, from the
  draft's one insert, and every seat on them is still the solver's from that minute (`placed_by = 'auto'`). Otherwise
  the draft stays and the screen says "Guests moved since the draft, so it stays." Held by
  `the-floor-fits-the-room.test.ts` 3.
