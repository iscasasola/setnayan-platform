## 2026-11-03 · feat(people): a person's Remove / Withdraw is the row's swipe, with Undo after the warning

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). The People roster row
(`PersonRow`, people/_components/people-roster-view.tsx) loses its visible ✕ Remove (connected) and ✕ Withdraw
(waiting for them); the row is wrapped in the shared `SwipeToDelete` (swipe left on a phone, the hover button on a
computer), calling the same `onRemove` — so the same warning ("Remove … from your people?") still asks first. After
it, the removal now waits out the Undo window (`deleteWithUndo`): they leave the list at once, `removeFromPeople` is
written when the window closes, Undo writes nothing, a refusal brings them back with its own words. The same Undo
covers the card's foot Remove and select mode's "Remove N" (both kept: the card's own button, the bulk bar). The roster
mounts the one `UndoToastHost`. The Loved ones godparent ✕ is a chip and moves to `ALLOWED`.

SPEC IMPACT: None
