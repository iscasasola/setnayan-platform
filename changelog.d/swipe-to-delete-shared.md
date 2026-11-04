## 2026-11-03 · feat(rows): one shared swipe-left-to-delete, guest rows first, and a guard that no list row ships a visible ✕

Owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS" — slice 1 of the area-by-area move.

- **`app/_components/swipe-to-delete.tsx` — the ONE swipe.** Moved, not re-invented: the guest list's `SwipeToDelete` (owner 2026-06-03), which was deleted with the retired `GuestListMultiselect` on 2026-10-09 (`21b9499381`). Lifted out with its gesture intact (axis locks on the first 8 px so a vertical move is the list's scroll; the tap a drag ends in is swallowed; a tap on an open row closes it; no resting transform). New: the guest-only parts are the caller's (`onDelete`), one row open at a time, a finger held still first is the row's own press-and-hold (guests' role drag lifts at 350 ms), and on a computer Delete shows at the row's end on hover / keyboard focus in its own column.
- **`app/_components/undo/delete-with-undo.ts` — every delete keeps Undo.** For rows that delete for good: hidden at once, written only after the Undo window (6 s), Undo writes nothing, a refusal brings the row back and says so, leaving the page writes it then. Uses the shipped guest Undo toast (`undo-store.ts` / `UndoToastHost`) — one Undo toast, not two (`UNDO_WINDOW_MS` exported).
- **Guest rows:** Delete — or Release seat for a +1 with no name — leaves the row's visible buttons and becomes the swipe; same `onRemove` → the same in-page warning (`DeleteGuestSheet`) → the same Undo. Share stays on the row. `the-guest-row-is-share-and-delete.test.ts`, `guest-row-actions-share-the-name-line.test.ts` and `a-seat-with-no-name-can-be-released.test.ts` re-pinned to the new shape.
- **Guard `lib/no-delete-x-on-list-rows.test.ts`** + shrink-only `no-delete-x-on-list-rows.baseline.txt` (124 marks in 81 files after this slice; 126 before): a new visible delete/remove ✕ outside the kept kinds (tile · chip · editor field, `ALLOWED`) fails; each area slice lowers its line.

One toast however many hosts: a row list that deletes with Undo may mount its own `UndoToastHost` where it is
drawn; only the first mounted host draws, so a page that already has one never shows the toast twice.

SPEC IMPACT: None — builds the 2026-11-03 ruling. One reading flagged for the owner: rows with no ⋯ menu get Delete on hover/focus on a computer (keyboard-reachable) rather than a new ⋯ button on every row.
