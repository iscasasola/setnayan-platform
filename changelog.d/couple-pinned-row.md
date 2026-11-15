## 2026-11-14 · feat(shell): every couple event page wears the ONE pinned row, mounted once from the event layout

Design template rule 1 (owner-approved 2026-11-14): the page's name lives in the shared pinned row's picker,
`Page · View ▾`. Until now the couple side drew it only on `/dashboard`, People and Memories; the ~114 event pages
under `/dashboard/[eventId]/…` had none. The event layout now mounts `<EventPinnedRow>` once — the way the admin
layout mounts `<AdminPinnedRow>` — built from the shared `PinnedRow` + `PickMenu`.

- **Where am I** comes from the event menu's ONE tree (`buildEventMenuSections` via `buildCustomerNavGroups`) and the
  rail's own resolver (`activeRailKey` over `eventRailMatchRows`), so the row names the place the rail lights. The ▾
  lists that menu row's door and the pages it holds; products carry their catalogue names, the few fixed held pages
  carry the words in `EVENT_HELD_PAGE_WORDS` (guarded both ways against the tree).
- **Skipped, as data** (`EVENT_OWN_ROW`): the event Home (its cover band — the deliberate exception) and the pages that
  already draw their own first row — Guests, Suppliers, Schedule, Memories, Hub (`/launch`), Event Details, Seat plan,
  the Maker's editor, the 3D room, Mood Board, Love Story. A page the menu does not hold draws nothing (no guessed name).
- No ⚙ on this row: each couple menu's ⚙ is mounted once on its own page (one site per menu).
- Guard: `app/dashboard/[eventId]/the-event-wears-one-pinned-row.test.ts` (mutation-checked, 5 sabotages, all red).

SPEC IMPACT: None — implements approved template rule 1.
