## 2026-09-06 · fix(guests): a swipe-delete keeps the guest's chair

Removing a guest released their seat two different ways depending on which
control the host used, and only one of them could be taken back:

| Path | Action | Seat |
|---|---|---|
| desktop bulk bar | `bulkSoftDeleteGuestsForUndo` | captured → undo re-places it |
| mobile swipe | form → `bulkSoftDeleteGuests` | **hard-deleted, no undo** |

`event_seat_assignments` rows are hard-deleted on purpose — a soft delete sets
`deleted_at` and does not trip the FK cascade, so the chair has to be freed
explicitly. The bulk path captures those rows first so `restoreDeletedGuests`
can put them back. The swipe did not. So the same act, from a phone,
permanently lost the guest's placement and offered no way back; a host who
re-added them found a hole in the seating plan they had to rediscover for
themselves. Nothing reported it, because from the roster the two paths looked
identical.

Both now call one hook, `useGuestRemoval` — extracted from the bulk bar rather
than written fresh, so the gates (couple blocked, RSVP'd guests refused), the
optimistic hide, the seat capture and the 6-second undo snackbar have a single
home. The swipe is no longer a form post; it removes optimistically and resets
its own gesture once the server confirms, so a row cannot sit swiped open over
a guest that is already gone.

`bulkSoftDeleteGuests` stays exported (other trees may yet use it) but this page
no longer routes through it, and a test asserts it never does again.

⚠ The existing guard's "there is ONE delete form" test asserted
`action={bulkSoftDeleteGuests.bind` appeared exactly once. The swipe no longer
posts a form, so that pattern now matches ZERO — the assertion MOVED to follow
the mechanism (the delete action must have exactly one caller: the hook) rather
than being deleted. Left as it was it would have counted a pattern that no
longer exists.

⚠ And a near-miss worth recording: the first draft of the "swipe resets itself"
assertion used a bare `/setTx\(0\)/`, which also matches this component's
tap-to-close handler — deleting the reset callback scored **0 failing**. It pins
the callback itself now.

Guarded by the extended
`apps/web/app/dashboard/[eventId]/guests/_components/a-host-can-delete-in-either-density.test.ts`
(7 tests; three mutations measured RED: swipe routed back to the un-undoable
delete → 2 failing, hook removed from the swipe → 1, reset callback dropped → 1).

Suite 62/62 · route-scoped `tsc` exit 0 (ordered after the last edit,
sentinel-confirmed).

SPEC IMPACT: None. No gate or schema change; one of two existing delete paths
now behaves like the other.

FOLLOW-UP (not done here): `softDeleteGuest` — the detail page and the quick
view — still releases the seat without capturing it. Those paths redirect rather
than staying on the roster, so offering undo there needs the released seats to
survive a navigation. Left as a separate piece of work rather than half-built.
