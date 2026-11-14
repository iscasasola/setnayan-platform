/**
 * papers-lapse.ts — AFTER 30 MARCH, AN UNRENEWED SHOP DROPS OUT OF SEARCH AND
 * DISCOVER, AND KEEPS EVERYTHING ELSE. The pure half.
 *
 * Owner rulings 2026-11-14 — "THE RENEWAL DAY IS 30 MARCH" · "AFTER 30 MARCH,
 * AN UNRENEWED SHOP KEEPS ITS EXISTING BOOKINGS", corrected by DECISION_LOG
 * 481b9b6b: the shop only drops out of search and Discover) — and the owner's
 * answer B on PR #7624: the lapse is a STAMP
 * (`vendor_profiles.papers_lapsed_at`, migration 20271345631375), never a change
 * of `verification_state`, because the couples who already booked the shop read
 * it through policies that require `verified`.
 *
 * PURE: no database, no clock (`now` is passed in).
 */

import { badgeDeadlineMs } from '@/lib/verified-badge';

export type LapseCandidate = {
  verification_state: string | null;
  next_renewal_due_at: string | null;
  papers_lapsed_at: string | null;
};

/**
 * Is this shop's lapse due NOW? Only a VERIFIED shop (a never-verified shop has
 * nothing to lapse), only once its renewal day has fully passed (the deadline is
 * the END of 30 March, Manila — `papersDueIn`), and only once (already stamped →
 * no). A shop with no deadline never lapses here.
 */
export function papersLapseDue(row: LapseCandidate, now: Date): boolean {
  if (row.verification_state !== 'verified') return false;
  if (row.papers_lapsed_at) return false;
  const ms = badgeDeadlineMs(row.next_renewal_due_at);
  if (ms === null) return false;
  return now.getTime() > ms;
}

/**
 * The one message, in-app and by email. Reworded for DECISION_LOG 481b9b6b (the earlier text said "new bookings are
 * paused", which is no longer what happens): the shop leaves search and Discover; bookings, clients and the events
 * that already inquired stay. ⚠ The words are this build's — the owner has not yet read them.
 */
export const PAPERS_LAPSED_NOTICE = {
  title: 'New couples can’t find you in search for now',
  body: 'Your papers weren’t renewed by 30 March, so your shop is out of search and Discover. You keep your current bookings and clients, and you can keep working with couples who already asked. Upload your renewed papers to be found again.',
} as const;

/** The audit action written once per lapse (and the record that the notice went out). */
export const PAPERS_LAPSED_AUDIT_ACTION = 'vendor_papers_lapsed';
