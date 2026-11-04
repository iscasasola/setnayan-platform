## 2026-11-03 · feat(story): a Story Maker moment deletes by its swipe; the Event Hub editors' ✕ are kept kinds

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). The Story Maker's
moment rows (`story/_components/make-it-yours.tsx`, "A LIST OF ROWS") lose their × and are wrapped in the shared
`SwipeToDelete`: swipe left on a phone, the 44 px hover trash on a computer. The same `onRemoveMoment` and its own Undo
run; no swipe where the × was hidden (Automatic, or the last moment); a touch on the ⋮⋮ grip never starts the swipe,
so reordering is unchanged. `lib/the-moment-x-is-a-fingers-width.test.ts` is re-aimed onto the swipe (not deleted).
The page's photo ✕ (tiles) and the words box ✕ / toolbar Remove (editor) stay. Every other Event Hub mark in this
slice is an editor field and moves to `ALLOWED` with its reason: the Our Story milestone inputs, a photo moment's
card, the editorial editor's own column and wish, and the Maker Edit row's Remove for the picked RSVP line. Lab:
`/dev/memories-lab?story=1`.

SPEC IMPACT: None
