/**
 * Thread quotation surfacing — pure selection logic for the couple↔vendor
 * chat thread's pinned "current quote" + audit-trail list.
 *
 * This is a SURFACING layer over `vendor_proposals` — no new plumbing, no
 * mutation. The rows are read under the couple's own RLS (status <> 'draft').
 *
 * "Current quote" = the newest proposal by created_at. Sending a new proposal
 * retires older live ones via `supersede_prior_vendor_proposals` (see migration
 * 20270227904581), so the newest row is always the live/current state — a
 * superseded row can never be the newest. Older rows are NEVER hidden: they
 * stay as an ordered audit trail below the pin.
 */

import type { ProposalStatus } from './vendor-proposals';

/**
 * A sent proposal the couple can still act on. Accept/decline itself lives on
 * the shared `/proposals/[publicId]` detail page (reused, never duplicated) —
 * this only decides whether to surface the "Review & accept" call-to-action.
 */
export function isAcceptableStatus(status: ProposalStatus): boolean {
  return status === 'sent' || status === 'viewed';
}

/**
 * Split a thread's proposals into the pinned current quote and the older
 * audit trail. Input is expected to be the non-draft rows for a single
 * (event, vendor). Sorted newest-first; ties broken deterministically by
 * proposal_id so the pin never flickers between equal timestamps.
 *
 * Returns null for an empty input (nothing to pin).
 */
export function selectCurrentQuote<
  T extends { created_at: string; proposal_id: string },
>(rows: readonly T[]): { current: T; older: T[] } | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const byTime = Date.parse(b.created_at) - Date.parse(a.created_at);
    if (byTime !== 0) return byTime;
    return b.proposal_id.localeCompare(a.proposal_id);
  });
  const current = sorted[0];
  if (!current) return null;
  return { current, older: sorted.slice(1) };
}
