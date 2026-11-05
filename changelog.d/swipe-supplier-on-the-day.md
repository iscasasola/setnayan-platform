## 2026-11-03 · feat(supplier-on-the-day): shots, issues and set songs delete by swipe, with Undo; a set deletes from its editor

Swipe-to-delete sweep (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON
ROWS"), supplier on-the-day slice. The day-of console's shot list and issues log rows, and a song inside a set on the
live song desk, lose their visible ✕/trash and become the one `SwipeToDelete`, each with Undo (`deleteWithUndo`): a
shot's write (`removeShot`, or the whole list when it is not saved yet) is sent only when the Undo window closes; an
issue is device-local and simply comes back; a set song's `removeSongFromVendorEventSet` waits out the window. A whole
SET used to delete at once from a ✕ on its card, taking its songs with it (`ON DELETE CASCADE`) and no way back; its
Delete now lives in the set's rename editor ("Delete set") and also waits out the Undo window, so Undo restores the
whole setlist. The console mounts the one `UndoToastHost`; the song desk's sets panel mounts its own (its own route).
Dev: `/dev/swipe-rows-lab/on-the-day`.

SPEC IMPACT: None.
