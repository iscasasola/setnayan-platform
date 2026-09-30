/**
 * Reopen a finalized guest list from the admin console — the pure half.
 *
 * WHY THIS EXISTS: on 2026-09-30 the owner had to run SQL by hand to unlock one
 * couple's finalized guest list, because nothing in the admin console could.
 *
 * 🔑 CLEARING THE STAMP ALONE DOES NOT REOPEN ANYTHING. `ensureFinalized`
 * (lib/pax.ts) stamps `guest_count_locked_at` lazily, the next time anybody on
 * the couple's side opens a page that asks — and it decides by the DEADLINE
 * (`guestListDeadlineEndMs`, lib/guest-list-closed.ts), not by the stamp. So an
 * admin who clears only the stamp on an event whose deadline has passed sees it
 * re-stamped on the couple's very next visit, with `final_pax` re-frozen. And
 * nulling the deadline is not enough either: with no explicit deadline the
 * fallback is `event_date - FINALIZE_LEAD_DAYS`, which is also in the past for
 * exactly the events that get reopened.
 *
 * So a reopen writes all THREE columns: the stamp, the frozen count, and an
 * explicit deadline `FINALIZE_LEAD_DAYS` from today. Pure so a test can prove
 * the patch leaves `guestListIsClosed` false — the question `ensureFinalized`
 * asks — without a database.
 */
import { FINALIZE_LEAD_DAYS } from './guest-list-closed';

/** The audit-log action value for an admin reopen. */
export const GUEST_LIST_REOPEN_ACTION = 'event_guest_list_reopened';

export type GuestListReopenPatch = {
  guest_count_locked_at: null;
  final_pax: null;
  /** `YYYY-MM-DD` (the column is a DATE), always in the future. */
  guest_list_edit_deadline: string;
};

/**
 * The UPDATE a reopen applies. `nowMs` is injectable so tests never depend on
 * the wall clock. The new deadline is a calendar date (UTC) `FINALIZE_LEAD_DAYS`
 * after today, so the list stays open for that long and then finalizes again on
 * its own, exactly as it did the first time.
 */
export function guestListReopenPatch(nowMs: number = Date.now()): GuestListReopenPatch {
  const d = new Date(nowMs);
  d.setUTCDate(d.getUTCDate() + FINALIZE_LEAD_DAYS);
  return {
    guest_count_locked_at: null,
    final_pax: null,
    guest_list_edit_deadline: d.toISOString().slice(0, 10),
  };
}

/**
 * Did the UPDATE actually land? A `.select()` after the update returns the
 * rows it touched; zero rows means the event id matched nothing, and a row that
 * still carries a stamp means something (a trigger, a race with
 * `ensureFinalized`) put it back. Either is a failure the admin must be told
 * about, never a silent "saved".
 */
export function reopenLanded(
  rows: Array<{
    guest_count_locked_at: string | null;
    final_pax: number | null;
    guest_list_edit_deadline: string | null;
  }> | null,
  patch: GuestListReopenPatch,
): boolean {
  if (!rows || rows.length !== 1) return false;
  const r = rows[0]!;
  return (
    r.guest_count_locked_at === null &&
    r.final_pax === null &&
    r.guest_list_edit_deadline === patch.guest_list_edit_deadline
  );
}
