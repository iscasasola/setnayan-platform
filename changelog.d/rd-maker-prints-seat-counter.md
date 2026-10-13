## 2026-10-13 · feat(maker): Studio › Prints' six + the seat counter, on the approved templates

Owner "approved" 2026-10-13 (DECISION_LOG "THE MAKER'S PRINTS SIX + THE SEAT COUNTER"; corpus
`MAKER_PRINTS_SEAT_COUNTER_2026-10-13_fable.md` + `prototypes/maker_prints_seat_counter_2026-10-13.html`).

**Prints (Studio › Prints, the new Maker only — the shipped Details is untouched):**
1. *Changed since you printed* → the amber status line (kind 12) with one quiet "Save again" (the piece's main file).
2. *Parents' cards* → list rows (initials · name · "Bride's parent · on your guest list" · accent arrow) → the shipped
   guest card as a sheet; "＋ Add a parent" = Bride's | Groom's pill + an open box + Add; none → the empty state.
3. *Kindly reply* → the dropdown "Who guests reply to" (each host with their number, or "no number on their account";
   "Type it in…") + the typed row "Reply line"; the same `rsvp_choice` / `rsvp_manual`, one field in two doors.
4. *Menu editor* → saves as you go: no Save button, no 303 page load. The same `/api/hub-print/menu`, the same
   `menu_json` byte for byte (`menuPayload`), asked with `Accept: application/json` (the route answers `{ ok }`);
   a save is the toast from the top, a failure the red status line with Try again. Dots hold-to-lift, arrows behind
   "Arrange" on a phone (shown on a computer), "Add a moment" chips.
5. *Pass card look* → the style-card strip (kind 5; a pick still waits for Apply); ◆ on Free → the centred note
   (See Pro / Keep it) over the same link.
6. *Poster photo* → Theme's picture | My photo, the upload square with the measured 0–100 pie, a photo under the A3
   minimum allowed and warned with "Change".
The Schedule switch says the printed programme lists only the moments for Everyone.

**Seat counter (the Seat plan's table sheet):** the shared `Counter` (kind 17, `app/_components/counter.tsx`) in its
own row "Seats at this table · 6 seated · of 10 chairs"; − greys when every chair left is taken, + greys when every
chair is out; the number ticks at the press (optimistic), saves at once (`setTableSeat`, live); "Chair N removed." /
"Chair N is back." · Undo is the status line (`app/_components/status-line.tsx`, kind 12) — Undo takes back the one
last step.

**Entrance seating chart (#6503) beside the seating pack:** Prints' "Table signs & place cards" saves it by table and
A to Z; the Seat plan's share menu opens `/seating/chart`. Needs #6503 merged first.

Guards: `lib/studio-prints-six-are-the-templates.test.ts`, `lib/the-counter-is-one-drawing.test.ts` (new);
`studio-prints-money-is-unchanged` test 2 holds every money word from "Digital ticket" on byte for byte and the
ticket-style part to its approved new words; the table-sheet and free-prints guards updated. Lab:
`/dev/details-lab?seat=1` (the table sheet, no database); `?studio=1` Prints fixtures. No schema change.

SPEC IMPACT: None — builds the approved record as written (two wordings kept for the money guard: the zip stays
"Download all tickets (.zip)", the printed row keeps its long label; the parent's line says "parent", the data has no
mother/father). The Maker's ↺ is NOT wired to chairs (it is the Event Hub draft's history; chairs are live) — the
status line's Undo is the one step back.
