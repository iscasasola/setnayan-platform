## 2026-11-03 · feat(schedule): the schedule's rows delete by their swipe — no ✕ on a row, Undo on every delete

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), the Schedule slice,
on the shared `SwipeToDelete` + `deleteWithUndo`:

- **Planning Stage — a hand-added / supplier-added step:** the row's small trash left; the row is the swipe
  (`PrepItemSwipe`, prep-item-controls.tsx), the same `deletePreparationItem`, with Undo.
- **The block list (schedule/page.tsx `BlockCard`):** the card's trash form left; the card is the swipe (`BlockSwipe`),
  the same `deleteScheduleBlock` (children cascade, suppliers still told), with Undo.
- **A moment's parts (moment-inspector.tsx):** the part line's ✕ left; the line is the swipe, with Undo.
- **A moment on the Studio day (studio-day.tsx):** its Delete was only behind ⋯; the row GAINS the swipe, which opens the
  moment's OWN warning ("Delete it and its N parts") scrolled into view. A confirmed moment delete now waits out the Undo
  window too (the day hides it; Undo brings it back with nothing written; a refusal brings it back and says so).
- **One toast however many hosts:** `UndoToastHost` now draws only from its first mounted copy, so a row list can mount
  one where it is drawn without doubling a page's toast.
- Kept (editor's own action, moved to the guard's `ALLOWED`): the moment editor's "Delete it", the moment sheet's
  "Delete moment", the chapter sheet's "Delete chapter". Lab: `/dev/schedule-lab?maker=1&studio=1` draws the Studio day.

SPEC IMPACT: None — implements the 2026-11-03 DECISION_LOG row; no spec text changes.
