## 2026-11-03 · feat(playlist): a pick's delete is its swipe, with Undo

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). The playlist pick row
(`studio/playlist/_components/playlist-pick-row.tsx`) loses its visible trash: swipe left on a phone (the hover trash
on a computer) reveals Remove, through the one shared `SwipeToDelete`. The "Remove this pick?" confirm becomes Undo
(`deleteWithUndo`): the row goes at once, `deletePlaylistPick` is written when the 6 s window closes, a refusal brings
it back and says so. The playlist page mounts the one `UndoToastHost`. The row's ground moves `bg-white` → `bg-raised`
(same white in light; it was a white slab in dark). Lab: `/dev/schedule-lab?view=playlist` draws the real moment
sections on fixture picks. Held by `the-pick-row-deletes-by-its-swipe.test.ts`.

SPEC IMPACT: None
