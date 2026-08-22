/**
 * Is the guest list closed? — the ONE place that answers it (2026-08-20).
 *
 * The guest count finalizes at the couple's guest-list edit deadline (owner
 * decision ⑥ of Adaptive Pax Pricing, DECISION_LOG 2026-06-13): after it the
 * binding count is frozen, `guard_guest_edits_when_locked` refuses count
 * changes, and the couple's roster shows "Guest list finalized".
 *
 * 🔑 TWO THINGS ANSWER THIS QUESTION AND THEY DISAGREE FOR A WHILE.
 * `events.guest_count_locked_at` is the STAMP, and the stamp is written
 * lazily — `ensureFinalized` (lib/pax.ts) writes it the next time somebody on
 * the couple's side opens a page that asks. So between the deadline passing
 * and that visit, the stamp is still NULL while the list is, in fact, closed.
 * A guest-facing surface that reads only the stamp keeps taking replies for
 * days after the door shut, and stops at a moment no one chose — whenever the
 * couple happened to open their roster.
 *
 * So: the DEADLINE decides whether the list is closed, and the stamp is an
 * accelerator (once stamped it is closed, full stop, and it never un-closes
 * even if the couple later moves the deadline out).
 *
 * Pure by design — no DB, no React, no server-only imports — so both the
 * public event hub and the server-side finalize path derive from it instead of
 * re-typing the same date arithmetic. `ensureFinalized` used to own this math
 * privately; it now calls in here, so the two can never drift.
 */

/**
 * Fallback gap between the event and the guest-list deadline when the couple
 * never set one explicitly. Provisional; the explicit column always wins.
 */
export const FINALIZE_LEAD_DAYS = 14;

/**
 * The instant the guest list stops taking changes, in epoch ms — the END of
 * the deadline DAY, parsed as UTC so the door shuts at the same instant no
 * matter what timezone the server is in.
 *
 * `null` = there is no deadline at all (no explicit date AND no event date),
 * so the list never closes on its own.
 */
export function guestListDeadlineEndMs(
  editDeadline: string | null | undefined,
  eventDate: string | null | undefined,
): number | null {
  if (editDeadline) {
    const ms = Date.parse(`${editDeadline}T23:59:59Z`);
    return Number.isNaN(ms) ? null : ms;
  }
  if (eventDate) {
    const d = new Date(`${eventDate}T23:59:59Z`);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() - FINALIZE_LEAD_DAYS);
    return d.getTime();
  }
  return null;
}

/**
 * Whether the guest list is closed right now: already stamped, or the deadline
 * has passed. `nowMs` is injectable so tests never depend on the wall clock.
 */
export function guestListIsClosed(input: {
  lockedAt: string | null | undefined;
  editDeadline: string | null | undefined;
  eventDate: string | null | undefined;
  nowMs?: number;
}): boolean {
  if (input.lockedAt) return true;
  const end = guestListDeadlineEndMs(input.editDeadline, input.eventDate);
  if (end == null) return false;
  return (input.nowMs ?? Date.now()) > end;
}
