/**
 * headcount-row.ts — the words of Guests › Setup's FINALIZE GUEST LIST row and
 * its one-way confirm (owner 2026-10-07, DECISION_LOG "GUESTS › SETUP" ·
 * "FINALIZING THE HEADCOUNT IS ONE-WAY"; HOME_AND_GUESTS_CHECK G31 · G37).
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
    ? `Locked at ${heads} heads. Your suppliers price for it; guests can no longer reply. This cannot be undone.`
    : 'Locked. Guests can no longer reply. This cannot be undone.';
}
export const FINALIZE_NOW_LABEL = 'Finalize now';

/** The one confirmation (owner: *"when this is pressed say it cannot be unfinalized"* · *"a confirmation Finalize | Not Now"*). */
export const FINALIZE_SHEET = {
  eyebrow: 'Lock the headcount',
  title: (heads: number) => `${heads} heads — this cannot be undone`,
  body: (heads: number) =>
    `Your suppliers price for ${heads} and guests can no longer reply. Once locked, it stays locked.`,
  confirm: 'Finalize',
  cancel: 'Not now',
} as const;

/** What the server says to an attempt to unlock — there is no way back (owner 2026-10-07). */
export const FINALIZE_IS_ONE_WAY = 'A locked headcount cannot be undone.';
