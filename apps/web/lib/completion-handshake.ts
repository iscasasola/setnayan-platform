/**
 * Per-vendor completion handshake — shared state logic (Event Lifecycle Menu §6.1).
 *
 * Mirrors the read-side review-gate RLS shipped in migration
 * 20270101000000 so the UI and the database agree on when a review unlocks:
 *   vendor marks complete → couple confirms received → review unlocks,
 * with M=7d customer auto-confirm, N=30d vendor auto-complete (anti-gaming),
 * and an open dispute freezing the gate — all evaluated against `now()` (no cron).
 *
 * Pure (no Supabase/React) so the couple review page, the vendor brief, and a
 * future galleries surface can all import it.
 */

export type CompletionStatus =
  | 'awaiting_vendor'
  | 'vendor_marked'
  | 'confirmed'
  | 'auto_confirmed'
  | 'disputed';

export type CompletionFields = {
  status: string | null; // legacy event_vendors.status (delivered/complete = legacy unlock)
  completion_status: CompletionStatus | string | null;
  service_marked_complete_at: string | null;
  customer_confirmed_received_at: string | null;
};

/** Where the handshake stands, from the COUPLE's point of view. */
export type ReviewState = 'reviewable' | 'awaiting_confirm' | 'disputed' | 'awaiting_vendor';

const DAY_MS = 24 * 60 * 60 * 1000;
const M_CONFIRM_DAYS = 7; // customer auto-confirm after the vendor marks complete
const N_COMPLETE_DAYS = 30; // vendor auto-complete after the event (anti-gaming)

function olderThan(iso: string | null, days: number, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && now >= t + days * DAY_MS;
}

/**
 * Resolve the couple-facing handshake state. `eventDate` (events.event_date)
 * drives the N=30d auto-complete; `now` is injected for determinism/testability.
 */
export function reviewState(
  c: CompletionFields,
  eventDate: string | null | undefined,
  now: number = Date.now(),
): ReviewState {
  if (c.completion_status === 'disputed') return 'disputed';

  const confirmed =
    Boolean(c.customer_confirmed_received_at) ||
    c.completion_status === 'confirmed' ||
    c.completion_status === 'auto_confirmed' ||
    c.status === 'delivered' ||
    c.status === 'complete' ||
    olderThan(c.service_marked_complete_at, M_CONFIRM_DAYS, now) ||
    (eventDate ? olderThan(eventDate, N_COMPLETE_DAYS, now) : false);
  if (confirmed) return 'reviewable';

  // Vendor has marked complete, the couple hasn't confirmed yet, and it's < M days.
  if (c.service_marked_complete_at) return 'awaiting_confirm';

  return 'awaiting_vendor';
}

/** True once the couple can leave a review (matches the INSERT RLS gate). */
export function isReviewable(
  c: CompletionFields,
  eventDate: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return reviewState(c, eventDate, now) === 'reviewable';
}
