/**
 * Is the guest list closed? — the ONE place that answers it.
 *
 * ⚖ OWNER RULING 2026-09-30 (DECISION_LOG): *"i must click a finalize to
 * finalize it."* The guest list is closed ONLY when the host pressed Finalize.
 * No date closes it — not the reply-by date, not "14 days before the event",
 * not the event day itself. Until the host presses Finalize, guests can reply
 * and the host can add, change and remove names.
 *
 * 🔑 WHY THE DATE RULE HAD TO GO, MEASURED. Until this date, the list closed
 * itself at `guest_list_edit_deadline` or, when none was set, at
 * `event_date − 14 days`. A birthday created ON its own day ("Birthday
 * Salubong ni Ate", 2026-09-30) had a deadline 14 days in the past from the
 * moment it existed: the first Guest list visit stamped it finalized, every
 * add was refused by `guard_guest_edits_when_locked`, and the host's "Add from
 * your people" came back empty on the night of the party. Every stamp in
 * production had come from that date rule, and all four were stamps nobody had
 * asked for.
 *
 * So `events.guest_count_locked_at` is now the host's own act, written only by
 * `finalizeGuestList` (lib/pax.ts), after a confirm, and cleared again by
 * `reopenGuestList`. `guest_list_edit_deadline` stays as the reply-by date the
 * invitation PRINTS. It asks guests to reply by then and closes nothing.
 *
 * Pure by design (no DB, no React, no server-only imports), so the public event
 * hub, the reply path and the roster all derive from it and cannot drift.
 */

/**
 * Whether the guest list is closed right now: the host finalized it, which
 * means the stamp is written. There is deliberately no date input, because a
 * date that could close the list is exactly the defect this replaced.
 */
export function guestListIsClosed(input: { lockedAt: string | null | undefined }): boolean {
  return Boolean(input.lockedAt);
}
