## 2026-11-03 · feat(supplier-repertoire): a song on "Your set list" deletes by swipe, with Undo

Swipe-to-delete sweep (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON
ROWS"), supplier repertoire slice. Repertoire → Your set list: each song's visible trash form left the row. The list is
now a small client component (`repertoire/_components/set-list.tsx`) whose rows are the one `SwipeToDelete` (named
"Remove <title>"); the removal waits out the Undo window (`deleteWithUndo`) and is written by `removeRepertoireSong(songId)` —
the same `vendor_songs` delete, now answered instead of redirected (no second action), so a write landing after the
window never yanks the supplier off a half-typed video link. Each row's performance-video form is unchanged and is
still drawn by the server page, which hands it to the list. Dev: `/dev/swipe-rows-lab/repertoire` draws the real list on fixture songs.

SPEC IMPACT: None.
