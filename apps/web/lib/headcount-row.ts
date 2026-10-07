/**
 * headcount-row.ts — the words of Guests › Setup's FINALIZE GUEST LIST row and
 * its confirm (owner 2026-10-07, DECISION_LOG "GUESTS › SETUP"; HOME_AND_GUESTS_CHECK
 * G31 · G37). Finalize closes replies; the event's HOSTS can reopen it (owner, the
 * same day: *"the host of the event not the supplier and coordinator always have
 * the power to unfinalize it as needed"*) — this replaced the earlier one-way ruling.
 *
 * ⚖ *"finalize should be inside the Setup. not on its current location"*
 * (owner, 2026-10-07): the roster's Finalize — which sat above the List · Map ·
 * Setup switcher for every list — moved into Setup as ONE row next to Reply by,
 * for every list, as it was. (This replaces the earlier per-head gate, which
 * hid the row unless a booked supplier priced per head.)
 *
 * Pure: no I/O.
 */

/* ── THE WORDS (HOME_AND_GUESTS_CHECK G31 · G37, verbatim except where the
   prototype promised a date lock: since 2026-09-30 NO date locks the list —
   `lib/guest-list-closed.ts` — so the row never says it locks by itself). ── */
export const FINALIZE_TITLE = 'Finalize guest list';
export const FINALIZE_LOCKED_TITLE = 'Guest list finalized';
/** Behind the row's ⓘ (owner 2026-10-07 — the words that sat above the switcher). */
export const FINALIZE_TIP = 'Guests can reply until you finalize.';
export function headcountOpenLine(attending: number): string {
  return `${attending} attending now. It stays open until you lock it.`;
}
export function headcountLockedLine(heads: number | null): string {
  return heads
    ? `Locked at ${heads} heads. Your suppliers price for it; guests can no longer reply.`
    : 'Locked. Guests can no longer reply.';
}
export const FINALIZE_NOW_LABEL = 'Finalize now';

/** The one confirmation (owner: *"a confirmation Finalize | Not Now"*). It never says "cannot be undone":
 *  the hosts can reopen (owner 2026-10-07, *"…always have the power to unfinalize it as needed"*). */
export const FINALIZE_SHEET = {
  eyebrow: 'Lock the headcount',
  title: (heads: number) => `Finalize at ${heads} heads?`,
  body: () => 'Guests can’t reply after this. You can reopen it any time.',
  confirm: 'Finalize',
  cancel: 'Not now',
} as const;

/** The hosts' way back (owner 2026-10-07) — on the locked row, for the event's hosts only. */
export const REOPEN_LABEL = 'Reopen guest list';
