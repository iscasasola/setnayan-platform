## 2026-11-03 · feat(suppliers): the supplier pages' rows delete by their swipe — no ✕ on a row, Undo on every delete

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), the Suppliers slice,
on the shared `SwipeToDelete` + `deleteWithUndo`:

- **Your team (build-locked.tsx) — a ready or a can't-book-yet candidate:** the ✕ left (`TeamRemoveCandidate`); the row
  is the swipe (`TeamCandidateSwipe`), the same vendor-scoped `removeBuildPick`, with Undo.
- **Compare — a saved plan (build-compare.tsx):** the row's trash left; the row is the swipe, which asks the SAME
  "Delete this plan?" question, then deletes with Undo (the plan leaves the list and the compare table at once).
- **A working folder's notes:** your note's trash left; the note is the swipe (`WorkingNoteSwipe`), with Undo.
- **A booked package's Included lines:** the "Remove" button left; the line is the swipe (`PackageItemSwipe`), the same
  `removeItemFromPackage` (its refusals and the Removed section unchanged), with Undo.
- Kept: the shortlist cards' × (a horizontal card rail — a swipe would fight its scroll; file moved to the guard's
  `ALLOWED`), the compare table's column "delete" and the Build grid's column verbs (columns, not rows), and the
  duplicate-build warning's own "Delete …" confirm.

SPEC IMPACT: None — implements the 2026-11-03 DECISION_LOG row; no spec text changes.
