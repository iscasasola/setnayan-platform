## 2026-09-21 · fix(guests): the shell stays still, reads in capitals, and folds every heading

Six owner corrections to the guest-list shell shipped in #5803, each one a
defect the typecheck, all 32 CI guards and the full suite passed.

- **The table nudged when switching search → add.** Not a layout jump — both
  states measure 69.00px with every piece at 44.00. It was `focus()`, which
  scrolls the focused box into view: 8px with the row tucked under the sticky
  top bar. Now `focus({ preventScroll: true })`; the row was just clicked.
  (A first theory — the add bar wrapping mid-animation — was measured and
  disproved before anything was changed for it.)
- **The header was not all caps, and not readable.** Tailwind's preflight
  resets `text-transform` on `<button>`, so the sortable labels read in mixed
  case beside CONTACT in capitals. And it was 11px Space Mono capitals at
  0.12em and 55% ink — the widest face in the app at its smallest size. Now
  Hanken Grotesk (the dashboard's text face) 12px semibold 0.06em at 70%;
  every label reads in full at the owner's 1,022px table (measured with the
  REAL font files embedded — the harness had been rendering Times).
  Side 7→8%, Contact 8→9% (capitals are wider); weight set per cell because a
  header cell's own `font-weight: bold` beats the row's.
- **"§" gone** from beside the grouping checkbox.
- **Bride & Groom folds** like every other heading. Pinned means first, not open.
- **Icons inside the boxes**, at the end: the magnifier in search, the "+" in add.
  `LiveSearch` gains an optional `className` so the phone carousel is unchanged.
- **The Filter popup drops its Sort row** (the table header sorts). Asked what
  else it held — filters and group rename/delete/new — the owner chose to keep
  the button. `sort-select.tsx` had no other user and is removed; "First name"
  and "Newest first" leave the DESKTOP with it (the phone keeps all eight).
  Port-controls baseline regenerated, diff read first: the only removal is
  SortSelect; the rest are other PRs' additions the record had not caught.

Also fixed: `the-roster-lines-up.test.ts` counted a `<th>` in a code COMMENT as a
header column — it now strips comments via the shared lexer (sabotage-checked
both ways: prose stays green, a real extra column goes red).

New guard `the-shell-stays-still.test.ts` pins all five, each sabotage-checked.

SPEC IMPACT: None.
