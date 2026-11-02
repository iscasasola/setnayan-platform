## 2026-10-03 · fix(guests): removing a guest ends that guest's account link — Home stops saying "You're invited"

Live test 2026-10-02 (prod 5666406): the host removed a guest; the account that had saved that invitation kept its `event_members` row (member_type `guest`, guest_id → the removed row), so its Home still listed the event as "You're invited" while the hub — correctly — said "You're not on the guest list for this event yet".

- **One place every remove path goes through:** trigger `a_removed_guest_ends_its_account_link` (AFTER UPDATE OF `deleted_at`, only NULL → set) and `a_deleted_guest_ends_its_account_link` (BEFORE DELETE, returns OLD) on `guests`, function `public.a_deleted_guest_ends_its_account_link()` (SECURITY DEFINER — the couple's own session cannot delete another account's membership under RLS). It deletes the same row the hosts' Unlink (`lib/seat-unlink.ts`) deletes: `event_members` WHERE guest_id = the row AND member_type = `guest`. Covers the card delete, swipe/bulk delete, the +1 seat sync, claims decline/merge and any admin or future path. Co-host / helper memberships through the row are left to their own door (as Unlink's `holds_access`).
- **Restore does not re-link:** the trigger fires only on removal; restoring the row (including the bulk delete's Undo) leaves the link ended — the person saves the invitation again themselves.
- **Hard delete:** the membership is ended instead of the FK's SET NULL leaving a seatless "invited" row.
- **Home, defence in depth:** `fetchUserEvents` (lib/events.ts) reads each membership's guest row under the account's own RLS (which hides a removed row) and drops a guest membership whose row is gone, via `anInvitationStillOnTheList` (lib/event-board.ts).
- **Data repair** in the same migration: ends every guest membership already pointing at a removed guest. Prod, measured read-only 2026-10-03: 1 row (the cale-ice link from the live test); 0 non-guest rows.

Tests: `tests/db/a-deleted-guest-ends-its-account-link.db.test.ts` (remove → link gone; restore does not re-link; hard delete; helper kept; Home drops a stale row; the repair touches exactly the orphaned rows), `lib/a-removed-guest-is-not-an-invitation.test.ts`.

SPEC IMPACT: None
