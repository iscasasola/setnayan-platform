## 2026-10-30 · fix(mood-board): dragging a photo onto another cell finally moves it — and a move that fails says so

- **Root cause (live in production):** `reorderMoodboardSlot` parked the moving photo at `slot_position = -1`
  to step out of the partial unique index `event_inspiration_assets_slot_unique`, but the table's CHECK
  `event_inspiration_assets_slot_position_check_v2` allows only 1, 2, 3. The park ran on every drag, so
  **no drag-reorder ever landed** — onto a full cell or an empty one. The board had already painted the
  swap and only showed a top-of-board line, so it looked done until a reload put the photos back.
- **Fix, no migration:** the writes moved to `lib/moodboard-swap.ts` (`swapMoodboardCells`). An empty
  destination is one write. Onto a full cell, the moving photo parks on a **free real cell of the same
  event** (its own slot first, then the destination's slot, then any part in `inspiration_parts`), the
  other photo takes its cell, and it lands. Only `slot_key` / `slot_position` are written — **never
  `removed_at`**, which #7089's `couple_photo_shares_follow_the_board` trigger treats as a removal (a reorder
  must not pull a shared photo off a supplier's card). `slot_key` cannot take a made-up parking value: it is
  a FOREIGN KEY to `inspiration_parts` (`event_inspiration_assets_slot_key_is_a_part`). Works under today's
  rules and #7090's narrowed grants. With no free cell anywhere: "Make room first — every cell is full."
- Every write asks for its row back (an RLS-filtered zero rows is not an error); a write that does not land
  undoes the earlier ones, so a failed move leaves the board exactly as it was.
- **Honest failure:** the action returns `{ ok, message }`; on a failed move the board puts both photos back
  and shows the message inside the slot it was dropped on.
- **Proof:** `tests/db/a-mood-board-photo-swaps-onto-a-full-cell.db.test.ts` (8 tests) runs the real
  `swapMoodboardCells` as the host, asserting `removed_at` unchanged on every row after every write. Sabotage:
  the `-1` park restored → 4 red; parking by `removed_at` → 5 red.

SPEC IMPACT: None — restores the drag-reorder the Mood Board redesign (2026-09-02) already specified; no schema change.
