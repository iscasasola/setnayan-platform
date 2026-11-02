## 2026-09-05 · fix(guests): the phone roster's delete survived the density toggle

On a phone the Guests roster renders the same guests two ways, and the host
picks between them with one tap of the carousel's grid/list toggle
(`?density=list`). The photo grid (`MobileGridItem`) has had swipe-left-to-Delete
since 2026-06-03. The compact list (`MobileListRow`) shipped without it — so a
host who preferred the denser view had no way to remove anybody from the list
itself, and nothing on screen suggested a display preference had taken an action
away. `MobileListRow` now reaches the SAME `SwipeToDelete` wrapper the grid uses,
under the same gate (not in select mode, never the couple).

No new delete: both densities call the one existing
`bulkSoftDeleteGuests` form, so the server-side gates are untouched and
unduplicated — the couple stays protected, an RSVP'd guest still has to be reset
to Pending first, and the delete stays a recoverable soft delete.
`SwipeToDelete` gained one optional `radiusClass` prop because its clipping
wrapper is `overflow-hidden`: the grid card is `rounded-lg` and the list row
`rounded-xl`, and a hardcoded radius shaves the corners of whichever one it is
not. Guarded by
`apps/web/app/dashboard/[eventId]/guests/_components/a-host-can-delete-in-either-density.test.ts`
(5 tests, three mutations measured RED).

Delete was already reachable from three other surfaces and none of them changed:
the desktop SelectionBar's optimistic bulk delete + 6s undo, the mobile photo
grid's swipe, and "Remove guest" on `/guests/[guestId]`.

SPEC IMPACT: None. This restores parity with an affordance the corpus already
describes (owner directive 2026-06-03, swipe-to-delete on the mobile roster);
the density toggle post-dates it (Living Roster P4, 2026-07-11) and no locked
decision named which densities carry it.
