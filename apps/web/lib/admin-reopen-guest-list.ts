/**
 * Reopen a finalized guest list from the admin console — the pure half.
 *
 * WHY THIS EXISTS: on 2026-09-30 the owner had to run SQL by hand to unlock one
 * host's finalized guest list, because nothing in the admin console could.
 *
 * ⚖ THE RULE IT FOLLOWS (owner ruling 2026-09-30, lib/guest-list-closed.ts):
 * the list is closed ONLY when the host pressed Finalize — `guestListIsClosed`
 * reads the stamp and nothing else, and no date re-stamps it. So a reopen is
 * exactly what the host's own `reopenGuestList` (lib/pax.ts) writes: clear the
 * stamp and the frozen count. The reply-by date (`guest_list_edit_deadline`) is
 * printed on the invitation and closes nothing, so it is not touched.
 *
 * Why not call `reopenGuestList` directly: it is fenced to the event's HOSTS
 * (`callerHostsEvent`), and an admin is not one. This is the same two-column
 * write, pure so a test can prove it leaves `guestListIsClosed` false.
 */

/** The audit-log action value for an admin reopen. */
export const GUEST_LIST_REOPEN_ACTION = 'event_guest_list_reopened';

export type GuestListReopenPatch = {
  guest_count_locked_at: null;
  final_pax: null;
};

/** The UPDATE a reopen applies — the same two columns the host's reopen clears. */
export function guestListReopenPatch(): GuestListReopenPatch {
  return { guest_count_locked_at: null, final_pax: null };
}

/**
 * Did the UPDATE actually land? A `.select()` after the update returns the
 * rows it touched; zero rows means the event id matched nothing, and a row that
 * still carries a stamp or a frozen count means something (a trigger, a race
 * with the host pressing Finalize) put it back. Either is a failure the admin
 * must be told about, never a silent "saved".
 */
export function reopenLanded(
  rows: Array<{
    guest_count_locked_at: string | null;
    final_pax: number | null;
  }> | null,
): boolean {
  if (!rows || rows.length !== 1) return false;
  const r = rows[0]!;
  return r.guest_count_locked_at === null && r.final_pax === null;
}
