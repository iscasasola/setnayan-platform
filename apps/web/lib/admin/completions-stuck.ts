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
  /**
   * The supplier's own shop on the other side of this booking. NULL means the
   * couple typed a name into their list by hand — see the ruling below.
   */
  marketplace_vendor_id: string | null;
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
  /* A dispute is an active human complaint and never waits on anything — it
     stays unconditional so no real grievance can be filtered away. Production
     holds none, so this branch is defensive rather than load-bearing. */
  if (row.completion_status === 'disputed') return 'disputed';

  /* ⚖ OWNER RULING 2026-08-25: "manual only gives them reference unless they
     connect to each other." A supplier the couple TYPED INTO THEIR LIST is a
     note for the couple, not a booking, and it is not settled work.

     🔑 AND IT IS STRUCTURALLY TRUE, NOT A PREFERENCE. The only thing that can
     mark a job done is the supplier's own dashboard, which finds its row by
     `.eq('marketplace_vendor_id', profile.vendor_profile_id)`. With that column
     NULL there is NO supplier who can ever reach the row — so it could never
     leave this desk, which is exactly why it must never enter it.

     Measured in prod the day of the ruling: 44 of the 45 rows on this desk were
     hand-typed references. They are excluded today only because those weddings
     are in December; without this they would all have landed at once. */
  if (!row.marketplace_vendor_id) return null;

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
