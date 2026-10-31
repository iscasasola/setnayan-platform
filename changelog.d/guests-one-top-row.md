## 2026-10-30 · fix(guests): ONE pinned top row on every Guests view — `[Page · View ▾] · counts · ⋯ · ⚙`; Seats' counts ride it, Auto arrange moves to ⋯

Owner 2026-10-30, on the iPhone app: *"The menu does not work properly"* (Seats › 2D wore the slim
`[Seats · 2D ▾] · ⋯ · ⚙`, Seats › List the old segmented `[Guests | Seats ▾ | March] · ⋯ · ⚙` with four tiles under
it), and earlier *"Seat ls should be pinned on top row and on map and 3d"* → *"Like this one"* (Guests › List's
`[Guests · List ▾] · ✓ 80 ✗ 0 ? 152 · ⚙`).

- **Why two menus showed:** #7055 drew TWO faces in one block — the segmented `Guests | Seats ▾ | March` pill at rest and
  the slim one-menu row once pinned. Full-screen views (Map · Seats 2D · 3D) started pinned, so they showed the slim row;
  Seats › List and March started at rest, so they showed the pill (and pinned it with its full face); Guests › List showed
  the pill until the carousel scrolled away. One page, two menus, depending on the view.
- **Now** (`guests-screen.tsx`, `guests-screen.module.css`): the segmented pill is gone; every view — Guests › List · Map,
  Seats › List · 2D · 3D, March — wears ONE row: the ONE ▾ (`pinMenu`, the shared PickMenu, listing Guests: List · Map,
  Seats: List · 2D floor plan · 3D room, March — picks switch in place from any view, both ways) · the view's counts ·
  the view's rounds (Seats: Edit · ⋯) · ⚙. The block is pinned (fixed under the bar, holder keeps its height) from the
  start on every view; the "pins once" scroll watcher is gone because there is nothing to swap. The Map's carousel still
  folds in the full-screen glide. Every old address still lands (`guestsViewHref` / `parseGuestsView` unchanged).
- **Counts in the row:** Guests › List and Map carry ✓ ✗ ? (the same `pickReply` doors). Seats carries seated ·
  unseated · tables on every mode, from the plan's own numbers (`seatedComing` · `unseatedComing` ·
  `displayUnits.length`), drawn with the ONE count door `PinCountDoor` (`view-summary-cards.tsx`, now also the List's)
  into a new lens seat `lens.countsSlot`. Each opens where its old tile did: Seated → the list, Unseated → the list
  narrowed to who is left (`openUnseated`), Tables → the 2D plan. The four-tile Seats count row is gone from Guests.
- **Auto arrange** moved into Seats' ⋯ (first item, `MenuRow` → the same `runAutoArrange`, same refusals: Edit first ·
  no tables · while running); its one line + Undo still rise over the thumb row.
- 3D room internals untouched (`seating-lab-3d.tsx` — #7062 owns them); Seats › 3D simply wears the same row.
- Guards: `lib/guests-top-row-and-full-screen.test.ts` extended — (5) every view renders the same one row (one first
  row, one ▾ naming the view, no segmented pill, ✓ ✗ ? on Guests' views, ⚙ last), (6) Seats' counts portal + their
  doors + Auto arrange in ⋯; (2)/(3) moved to the one-face shape. Moved to the new shape (none dropped without a
  replacement): `the-pinned-row-is-one-row`, `r4-seats-march-forwards` (6/7/8), `one-door-to-guests-settings`,
  `the-guest-list-sheet-is-calm`, `the-guest-list-draws-what-can-be-seen` + `the-guest-list-opens-from-the-phone` (the
  total is the carousel's Total guests card now), `guests-read-is-honest`, `the-march-is-reachable-on-a-phone`,
  `a-failed-refresh-shows-the-last-copy-as-old`, `guest-section-head`, `a-pair-walks-as-one-line`, `pills-are-everywhere`
  (the Guests pill leaves its table on purpose; anti-vacuity 28 → 27). Port baseline regenerated.

SPEC IMPACT: DECISION_LOG row 2026-10-30 "GUESTS: ONE TOP ROW ON EVERY VIEW" — supersedes the 2026-10-27 "pins once"
clause for Guests and #7055's segmented `Guests ▾ · Seats ▾ · March` full row; Seats' four count tiles retired in favour
of the row's counts + Auto arrange in ⋯.
