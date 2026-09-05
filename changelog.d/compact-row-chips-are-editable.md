## 2026-09-05 · fix(guests): the compact density edits what the grid density edits

`?density=list` swaps the phone's photo grid for `MobileListRow`, which was
built as avatar / name / RSVP / seat — no side, no role, no groups, not even
displayed. A host who preferred the denser view could set an RSVP and nothing
else, while the identical guest one tap away could be re-sided, re-roled and
re-grouped. A display preference was deciding which fields existed.

This is the second time this exact row has had that defect: swipe-to-delete
shipped on the grid card and not here (fixed earlier today). Twice in one
component is a pattern, so both densities are now pinned against each other by
a test rather than left to match by hand.

- **Side costs nothing.** The avatar is already tinted by side (and `SIDE_RING`
  tints the row border), so it becomes the trigger for the thing it already
  signalled — no new pixels in a row whose whole point is density.
- **Role and groups had to be shown to be editable**, so most rows gain a second
  line (owner call — "allow it if possible"). It is ONE horizontally-scrolling
  flex line, never a wrapping one: `w-max` keeps chips at their natural width
  and the shared `.m-no-scrollbar` utility from `globals.css` hides the bar, so
  a guest in four groups scrolls instead of growing the row a third time.
- `palette`, `groups`, `groupsById`, `currentGroupId` and `bulkRoleSections`
  thread down from the same map that already feeds `MobileGridItem`, so the
  compact row offers the same role sections as the bulk bar — no second list.

No gate is forked: `RoleChipEditor` keeps sole ownership of the bride/groom
lock, and the test asserts this row spells that condition exactly once (its
pre-existing swipe gate) rather than gaining a second copy. Guarded by
`apps/web/app/dashboard/[eventId]/guests/_components/the-compact-row-edits-what-it-shows.test.ts`
(6 tests; four mutations measured RED; route-scoped `tsc` exit 0; suite 45/45).

⚠ Not visually verified in a browser — the change is a layout change (a second
line on most rows) and the evidence here is static analysis plus typecheck, not
a rendered screenshot.

SPEC IMPACT: None. Brings the compact density to the parity the grid density
already had; no locked decision named which density carries the inline editors.
