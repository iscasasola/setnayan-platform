/**
 * WHEN AN UNSETTLED BOOKING IS ACTUALLY STUCK — the ONE definition.
 *
 * 🔴 WHY THIS FILE EXISTS. `event_vendors.completion_status` DEFAULTS to
 * `'awaiting_vendor'` and is NOT NULL, so every row matches "unsettled" from the
 * moment it is inserted — including a supplier a couple merely typed into a
 * shortlist and never hired. `/admin/completions` always knew that and applied a
 * second, JS-side cut: a non-disputed row only needs eyes once the CELEBRATION is
 * well past. The queue BADGE, added to QUEUE_DEFS on 2026-08-19, applied only the
 * first half.
 *
 * Measured in production 2026-08-25, which is what this fixes:
 *   badge  45  ·  desk  1
 *   44 of the 45 belong to weddings 109 and 115 days in the FUTURE. Nothing is
 *   late. The single real row is a seeded test event 24 days past.
 * And because the badge aged on `created_at` — when somebody wrote the supplier's
 * name down, 68 days ago — it rendered RED "past SLA". The loudest alarm in the
 * admin pointed at nothing.
 *
 * 🔑 A BADGE WIDER THAN ITS OWN DESTINATION IS A FALSE ALARM, and the QUEUE_DEFS
 * entry's own comment claimed it "Mirrors /admin/completions exactly". It did not.
 * One predicate now, imported by the desk and by the digest, so the number on the
 * badge is the number of rows the page lists — by construction rather than by
 * two people remembering the same rule.
 */

/** A non-disputed row needs eyes only once the celebration is this far past. */
export const STUCK_AWAITING_DAYS = 14;
/** The vendor marked it done and the couple has not confirmed within this. */
export const STUCK_MARKED_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export type CompletionStuckReason = 'disputed' | 'vendor_overdue' | 'awaiting_confirm';

/** The fields the rule reads. Both callers select exactly these. */
export type CompletionCandidate = {
  completion_status: string | null;
  service_marked_complete_at: string | null;
  customer_confirmed_received_at: string | null;
};

function olderThan(iso: string | null, days: number, nowMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && nowMs >= t + days * DAY_MS;
}

/**
 * Why this row needs an admin, or null when it does not yet.
 *
 * ⚠ `eventDate` NULL ⇒ a non-disputed row is NOT stuck. An unknown celebration
 * date must not manufacture urgency — `olderThan(null, …)` is false on purpose.
 * A DISPUTED row is always stuck: somebody has actively raised a conflict, and
 * that does not wait on a date.
 */
export function completionStuckReason(
  row: CompletionCandidate,
  eventDate: string | null,
  nowMs: number,
): CompletionStuckReason | null {
  if (row.completion_status === 'disputed') return 'disputed';
  if (row.completion_status === 'awaiting_vendor' && olderThan(eventDate, STUCK_AWAITING_DAYS, nowMs)) {
    return 'vendor_overdue';
  }
  if (
    row.completion_status === 'vendor_marked' &&
    !row.customer_confirmed_received_at &&
    olderThan(row.service_marked_complete_at, STUCK_MARKED_DAYS, nowMs)
  ) {
    return 'awaiting_confirm';
  }
  return null;
}

/**
 * WHEN this row became stuck — what its SLA clock should age from.
 *
 * 🔑 NOT `created_at`. That is when a couple wrote a supplier's name down, which
 * is exactly how a wedding 109 days away rendered as 68 days overdue. A row is
 * late relative to the moment it BECAME somebody's problem, never the moment the
 * row was typed.
 */
export function completionStuckSince(
  row: CompletionCandidate & { completion_disputed_at?: string | null },
  eventDate: string | null,
  reason: CompletionStuckReason,
): string | null {
  if (reason === 'disputed') return row.completion_disputed_at ?? null;
  if (reason === 'vendor_overdue') {
    if (!eventDate) return null;
    const t = new Date(eventDate).getTime();
    return Number.isFinite(t) ? new Date(t + STUCK_AWAITING_DAYS * DAY_MS).toISOString() : null;
  }
  const t = row.service_marked_complete_at ? new Date(row.service_marked_complete_at).getTime() : NaN;
  return Number.isFinite(t) ? new Date(t + STUCK_MARKED_DAYS * DAY_MS).toISOString() : null;
}
