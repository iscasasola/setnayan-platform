## 2026-11-03 · feat(supplier-clients): a booking's prep-schedule item deletes by swipe, with Undo

Swipe-to-delete sweep (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON
ROWS"), supplier clients slice. Bookings → a booking's prep-schedule items: the per-row trash button left the row; each
item is the one `SwipeToDelete` (named "Remove <item>", 44 px tall so the revealed word fits), and the same
`vendorDeletePreparationItem` is written after the Undo window (`deleteWithUndo`); a refusal brings it back and says so.
The Bookings page mounts the one `UndoToastHost`. Kept, and moved to the guard's `ALLOWED`: the cocktail floor plan's
booth / sign ✕ (pieces on a drag-to-place canvas), the editorial studio's staged-photo ✕ (a media tile), and the
moment sheet's own "Delete moment" at its foot. NOT moved: the production sheet's portion-rule delete — it sits in a
`<table>` row, which the swipe cannot wrap; it stays on the baseline. Dev: `/dev/swipe-rows-lab/clients`.

SPEC IMPACT: None.
