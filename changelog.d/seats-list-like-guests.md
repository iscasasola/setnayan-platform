## 2026-11-01 · feat(seats): Seats › List is the Guests list grouped by table (S1c)

Owner 2026-11-01 (DECISION_LOG "SEATS STAYS ITS OWN DOOR, BUT LOOKS AND WORKS LIKE THE GUESTS LIST", "SEATS: WHAT EACH
VIEW DOES", "ONE SHARED DRAG-AND-DROP"). Guests › Seats › List drops its row of faces and draws the Guest list's own rows
and headers (its stylesheet imported, the shared `ActionButton`): a header per table reading "TABLE 5 · 8 of 10 seats",
a row per seat (an empty seat is a row with Add ▾), "To seat" first. Open = picked, as on Guests › List: only the picked
table wears ✎ (rename), Type ▾ (the plan's shapes, the shared dropdown) and seats − N + (the plan's Counter). A guest is
pressed, held and dragged onto any seat or onto "To seat" with the shared edge scroll (`lib/drag-edge-scroll.ts`);
Swap / Seat + a tap stays as the fallback. One answer for a drop (`lib/seat-list-drop.ts`); every write is the plan's own
(`seatGuestHere` · `tradeSeats` · `unseat`, with "before a seat changes hands" asked first). Auto arrange stays in the
Seats row's ⋯. Guard: `lib/seats-list-is-the-guests-list.test.ts`; four older guards re-aimed at `seat-list.tsx`.

SPEC IMPACT: None — builds DECISION_LOG rows of 2026-11-01.
