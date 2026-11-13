/**
 * papers-lapse.ts — AFTER 30 MARCH, AN UNRENEWED SHOP KEEPS ITS BOOKINGS AND
 * TAKES NO NEW ONES. The pure half.
 *
 * Owner rulings 2026-11-14 — "THE RENEWAL DAY IS 30 MARCH" · "AFTER 30 MARCH,
 * AN UNRENEWED SHOP KEEPS ITS EXISTING BOOKINGS" ("Keep them, block new") — and
 * the owner's answer B on PR #7624: the lapse is a STAMP
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

/** The one message, in-app and by email (owner's words, controller 2026-11-14). */
export const PAPERS_LAPSED_NOTICE = {
  title: 'New bookings are paused',
  body: 'Your papers weren’t renewed by 30 March. You keep your current bookings; new bookings are paused until you upload your renewed papers.',
} as const;

/** The audit action written once per lapse (and the record that the notice went out). */
export const PAPERS_LAPSED_AUDIT_ACTION = 'vendor_papers_lapsed';
