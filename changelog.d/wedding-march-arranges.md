## 2026-09-21 · feat(guests): Wedding March — tap or drag a name to pair, drag onto a name to swap

Owner, on an empty "—" beside a name: *"tapping should allow us to pair them as well with someone.
or the name can be dragged there to pair."* And: *"dragging a name to another will swap the names."*

- **Empty place:** tap it → "Walks with…" picker, or drag a name onto it. The person joins that line;
  if they had a partner, the partner keeps their own line and walks alone (the picker says so:
  "now with …").
- **A name:** drag it onto another name, or tap it → "Swap with…". The two trade partners AND spots,
  so every line stays where it was and only the names move.
- In groups with sides (Ninong left · Ninang right, Maid of Honour · Best Man, Bridesmaids ·
  Groomsmen) a name only goes where its role stands; a refused drop is said in words, never ignored.
- Dragging the ROW (number, grip) still reorders lines, as before. Pickers open inward so the right
  column's list stays on a phone screen.
- One rule for picker and server: `lib/march-moves.ts`. The server re-reads the group and asks it again
  before writing. Each move is ONE SQL call — migration `wedding_march_join_and_swap`
  (`join_entourage_line`, `swap_entourage_places`; SECURITY INVOKER, authenticated only). A group still
  in surname order has its visible order pinned first, so a move never makes a line jump.
- Guards: `lib/march-moves.test.ts` (7), `tests/db/wedding-march-join-and-swap.db.test.ts` (7),
  `guests/wedding-march-names-move.test.ts` (3) — each sabotaged (2 · via replay · 2). Exposure baseline:
  +2 function lines, both `exec=authenticated`.

Not in this PR: reordering the sections themselves (Parents, Immediate Family, …) — that needs a new
per-event setting and ships separately.

SPEC IMPACT: None
