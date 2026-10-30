## 2026-10-30 · fix(mood-board): dragging a photo onto another cell finally moves it — and a move that fails says so

- **Root cause (live in production):** `reorderMoodboardSlot` parked the moving photo at `slot_position = -1`
  to step out of the partial unique index `event_inspiration_assets_slot_unique`, but the table's CHECK
  `event_inspiration_assets_slot_position_check_v2` allows only 1, 2, 3. The park ran on every drag, so
  **no drag-reorder ever landed** — onto a full cell or an empty one. The board had already painted the
  swap and only showed a top-of-board line, so it looked done until a reload put the photos back.
- **Fix, no migration:** the writes moved to `lib/moodboard-swap.ts` (`swapMoodboardCells`). The moving
  photo is parked by setting `removed_at` — the index's own WHERE clause — and the landing write clears it.
  Only `removed_at`, `slot_key`, `slot_position` are written, so it works under today's rules and under
  #7090's narrowed grants. Every write asks for its row back; a write that does not land (an RLS-filtered
  zero rows is not an error) undoes the earlier ones, so no photo is ever left removed.
- **Honest failure:** the action now returns `{ ok, message }`. On a failed move the board puts both photos
  back and shows the message inside the slot it was dropped on.
- **Proof:** `tests/db/a-mood-board-photo-swaps-onto-a-full-cell.db.test.ts` runs the real
  `swapMoodboardCells` as the host (A in cell 1 onto B in cell 2 → A in 2, B in 1; across slots; onto an
  empty cell; under #7090's rules; a mid-swap refusal rolled back; a stale cell). Sabotage (the `-1` park
  restored) → tests 1–4 red.

SPEC IMPACT: None — restores the drag-reorder the Mood Board redesign (2026-09-02) already specified; no schema change.
