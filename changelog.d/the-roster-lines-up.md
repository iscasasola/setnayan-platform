## 2026-09-20 · fix(guests): the roster lines up

⚖ Owner 2026-09-20, on the redesigned guest list: *"fix the alignment of the
table. make it clean."*

Three defects, and the first was introduced by the redesign itself (#5768):

1. **The header sat 2px off every column.** Each body row's first cell gained a
   2px side edge; the header's did not. With `table-fixed` that is a 2px shift
   between the labels and everything beneath them. The header now reserves the
   same edge, transparently.
2. **The self-join row was 2px narrower than its neighbours** — it never got the
   edge — and its name cell used `px-4` where every other row uses `px-3`, so
   that column stepped sideways on exactly those rows.
3. **Cells hung off the avatar's baseline.** A table cell's default
   `vertical-align` is `baseline`, so beside the 36px avatar every short cell
   dropped to the bottom of the row. `align-middle` on the `<tr>` fixes all of
   them at once, because `td` inherits it.

🔑 **None of these is visible in a diff.** A 2px border added to one row and not
to the header reads as a complete change in review and is only wrong once
rendered — so `the-roster-lines-up.test.ts` asserts the geometry: the header
reserves the row's edge, every row variant draws it, the grid-participating
cells share one horizontal padding, the rows centre their contents, and the cell
count still matches the header. Three sabotages confirmed red (header edge
removed · `px-4` restored on the self-join name cell · `align-middle` dropped).

Two traps recorded in the guard itself, both of which made a first draft lie:
`'<thead'` begins with `'<th'`, so searching the bare tag returned the THEAD
element and reported a missing edge that was present; and a full-width
`colSpan` banner is not a column, so comparing its padding convicted innocent
markup.

SPEC IMPACT: None.
