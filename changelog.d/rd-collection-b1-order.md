## 2026-09-24 · feat(home): Planning runs soonest first, ten to a page — the collection template's order

Step B1 of the owner-approved collection template (DECISION_LOG 2026-09-24, "the template is good";
prototype `prototypes/collection_template_posters_add_flow_v4_2026-09-24.html`). Planning shelf only.

- **Soonest first, undated last.** `orderSoonestFirst` in `lib/event-board.ts`, applied by
  `splitPlanningShelves` to the `planning` shelf. This reverses the 2026-07-13 newest-on-top timeline
  **for Planning only** — `splitEventBoard`'s `comingUp` and the finished shelves keep it (its test still
  holds it). Stable on a shared day.
- **Ten per page.** `lib/collection-pagination.ts` (`paginateCollection`, `parseCollectionPage`) — the
  template's, not Planning's, so the next collection pages with the same numbers. `?page=N` is a URL,
  not state: server-rendered, linkable, no server action. The pager ("1 · 2 · … · Last", "1–10 of N")
  renders only when there is more than one page (`CollectionPager` in `collection-card.tsx`).
- **The dashed tile only while the page has room.** A full page's door is the new header (+).
- **The template's empty state** (`CollectionEmptyState`). ⚠ Its copy deliberately departs from the
  prototype's "No celebrations yet": `fetchUserEvents` degrades to `[]` on a refused read and a person
  whose events have all finished also has an empty Planning shelf, so the line says what the shelf is
  for and never that they have none.
- Header shows "N events" (never a zero) beside the put-away switch.

Tests: `lib/collection-pagination.test.ts` (every prototype stop, 3/10/11/100 events),
`lib/event-board-shelves.test.ts` (soonest-first through the real seam, timeline still holds elsewhere,
stability), `app/dashboard/(launcher)/planning-is-the-collection-template.test.ts` (pager + empty state
rendered; the page slices by the page and gates the tile). Sabotage: flipping the sort direction and
ungating the tile each went red.

SPEC IMPACT: None — implements the 2026-09-24 DECISION_LOG row as written (the empty-state copy
deviation is flagged in the PR for the owner).
