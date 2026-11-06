## 2026-11-03 · feat(seating): the seating rows delete by their swipe — no ✕ on a row, Undo on every delete

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), the Seating slice,
on the shared `SwipeToDelete` + `deleteWithUndo`:

- **Seat list — a seated guest:** the red Remove left the row; the row is the swipe, the same `onRemove` → `unseat`,
  whose toast now carries an Undo that re-seats them on the SAME chair (`assignGuest`). The press-and-hold drag is
  untouched (the swipe lets go of a finger held still — both use 300 ms).
- **Both table lists (the side list and the phone cards):** the trash left; the row / the card's head is the swipe, the
  same `requestRemoveUnit` (asks first when people sit there). A confirmed table delete now waits out the Undo window
  (`removeTables`): the table leaves the plan and its guests show unseated at once — what the cascade will do — and Undo
  brings both back with nothing written.
- **Keep-apart rules:** the − left; the rule's row is the swipe, with Undo.
- **Walkthrough zones:** the trash left; the zone's card is the swipe — the same "lose the walk video" ask, then Undo.
- Kept (editor kinds, both files moved to the guard's `ALLOWED`): the selected table's dock / phone panel Delete, a
  chair's delete in edit-chairs mode on the plan, the selected marker's Remove.

SPEC IMPACT: None — implements the 2026-11-03 DECISION_LOG row; no spec text changes.
