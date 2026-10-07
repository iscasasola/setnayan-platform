/**
 * headcount-row.ts — WHEN Guests › Setup shows the Headcount row, and the words
 * of its one-way Finalize (owner 2026-10-07, DECISION_LOG "GUESTS › SETUP" and
 * "FINALIZING THE HEADCOUNT IS ONE-WAY"; HOME_AND_GUESTS_CHECK G31 · G37).
 *
 * ⚖ *"Finalize deadline is on setup and a button to force finalize (Only for
 * guestlist that needs finalization)"*. A list needs finalizing only when a
 * BOOKED supplier prices it per head — a booked row (`event_vendors.status` in
 * `COMMITTED_BOOKING_STATUSES`) whose service is `vendor_services.pricing_basis
 * = 'per_pax'`. Otherwise there is nothing to lock a price against, and the row
 * is absent.
 *
 * 🔑 NOT `adaptive_pricing_mode`, although the check doc names it: that column
 * is `NOT NULL DEFAULT 'realtime'` (migration 20261211000000), so it is "set"
 * on every event ever made and could not tell one list from another. The
 * per-head booking is the fact the owner's words describe (controller-approved
 * deviation, 2026-10-07).
 *
 * A list that is ALREADY locked always shows the row — the locked count must
 * stay visible even if the per-head booking is later cancelled.
 *
 * Pure: no I/O (the read is `headcount-row.server.ts`).
 */

/** The `pricing_basis` that makes a booking count per head. */
export const PER_HEAD_BASIS = 'per_pax';

/**
 * Show the Headcount row? `perHeadBooked` null = the read failed: the row shows
 * (so the couple is never told "nothing to finalize" by a refused read) but
 * offers no button — `headcountMayFinalize` below.
 */
export function showsHeadcountRow(input: { perHeadBooked: boolean | null; locked: boolean }): boolean {
  return input.locked || input.perHeadBooked !== false;
}

/** The ✓ Finalize now button — only on an open list a per-head booking is waiting on. Never on a locked one. */
export function headcountMayFinalize(input: { perHeadBooked: boolean | null; locked: boolean }): boolean {
  return !input.locked && input.perHeadBooked === true;
}

/** Any booked per-head service among these bases. */
export function anyPerHead(bases: ReadonlyArray<string | null | undefined>): boolean {
  return bases.some((b) => b === PER_HEAD_BASIS);
}

/* ── THE WORDS (HOME_AND_GUESTS_CHECK G31 · G37, verbatim except where the
   prototype promised a date lock: since 2026-09-30 NO date locks the list —
   `lib/guest-list-closed.ts` — so the row never says it locks by itself). ── */
export const HEADCOUNT_TITLE = 'Headcount';
export const HEADCOUNT_LOCKED_TITLE = 'Headcount locked';
export function headcountOpenLine(attending: number): string {
  return `${attending} attending now. It stays open until you lock it.`;
}
export function headcountLockedLine(heads: number | null): string {
  return heads
    ? `Locked at ${heads} heads. Your suppliers price for it; guests can no longer reply. This cannot be undone.`
    : 'Locked. Guests can no longer reply. This cannot be undone.';
}
export const HEADCOUNT_UNREAD_LINE = 'We couldn’t check your suppliers just now, so Finalize is not offered. Nothing was changed.';
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
