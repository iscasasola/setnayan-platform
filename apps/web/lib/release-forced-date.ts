import type { SupabaseClient } from '@supabase/supabase-js';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * releaseForcedDate — give the wedding date back when the couple undoes the lock
 * that forced it.
 *
 * THE RULE (owner, 2026-08-04): "the event can starts with multiple dates until
 * it becomes one date. then that date becomes final." The date is a property of
 * the EVENT narrowing to one candidate — not of any single vendor. So a date
 * that exists ONLY because a vendor lock forced it belongs to that lock: undo
 * the lock and the date returns to undecided. A date the couple CHOSE is theirs,
 * and no vendor exit may touch it.
 *
 * WHY THIS IS SHARED. Three couple-initiated exits undo a lock —
 * revertVendorToConsidering, deleteVendor, and cancelBookingAsHost's
 * non-downpaid branch — and each one left the date behind. Copying the
 * conditions into three call sites is how two of them drift and one silently
 * stops guarding: the "date has gone outward" test in particular is easy to
 * forget, and forgetting it deletes a date guests have already been sent.
 *
 * EVERY CONDITION IS A REFUSAL TO GUESS:
 *   • the stamp must name THIS vendor. NULL means the couple chose the date
 *     (onboarding, lockEventDate, updateEventDate, the Save-the-Date backfill,
 *     the Locked-QR claim) and it is not ours to clear. Provenance is stamped in
 *     the same statement as the date, never inferred — inference was refuted,
 *     because the couple's own lockEventDate pick is byte-identical.
 *   • no other CONFIRMED vendor may remain: they are booked on that day, and
 *     erasing it would strand them.
 *   • the date must not have gone OUTWARD — a launched Save-the-Date, a pending
 *     scheduled launch, or a public landing page all mean guests have seen it.
 *
 * The `.eq('date_forced_by_lock_of', vendorId)` inside the UPDATE re-states the
 * ownership check atomically, so a concurrent re-lock cannot slip between the
 * read and the write.
 *
 * `date_candidates` are deliberately untouched — finalizeVendor never cleared
 * them, and that is exactly what lands the couple back on their own shortlist.
 * `date_status` needs no write either: sync_event_date_status() demotes a
 * 'locked' status the moment event_date becomes NULL.
 *
 * ⚠ DOES NOT COVER a VENDOR-side cancellation, an admin action, or force
 * majeure. A supplier backing out must not silently delete the couple's wedding
 * date — that path prompts the couple instead. Call this only from an exit the
 * COUPLE initiated.
 *
 * Best-effort by contract: the caller's own revert/delete/cancel has already
 * committed and must never roll back over a date write. Returns what happened so
 * a caller can surface it; throws nothing.
 */
export type ReleaseForcedDateOutcome =
  | 'released'
  | 'not_forced_by_this_vendor'
  | 'other_confirmed_vendors'
  | 'already_outward'
  | 'error';

export async function releaseForcedDate(
  supabase: SupabaseClient,
  args: { eventId: string; vendorId: string },
): Promise<ReleaseForcedDateOutcome> {
  const { eventId, vendorId } = args;

  const { data: row, error: rowError } = await supabase
    .from('events')
    .select(
      'date_forced_by_lock_of, std_launched_at, scheduled_launch_at, landing_page_visibility',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  // 🚨 A REFUSED READ USED TO ANSWER "nothing to do". `date_forced_by_lock_of`
  // carried no SELECT grant, so through a user session PostgREST refused this
  // WHOLE query with 42501; `row` came back null, `owner` was undefined, and the
  // function returned 'not_forced_by_this_vendor' — which reads as a decision
  // and was actually a failure. Every caller (deleteVendor,
  // revertVendorToConsidering, cancelBookingAsHost) passes the user-session
  // client, so a date forced by a supplier's lock stayed forced after that
  // supplier was removed. The grant is fixed (20271179873885); this log means
  // the two states can never again be told apart only in hindsight.
  if (rowError) {
    logQueryError('releaseForcedDate.event', rowError, { eventId, vendorId }, 'graceful_degrade');
  }

  const owner = (row as { date_forced_by_lock_of?: string | null } | null)
    ?.date_forced_by_lock_of;
  if (owner !== vendorId) return 'not_forced_by_this_vendor';

  const outward =
    Boolean((row as { std_launched_at?: string | null } | null)?.std_launched_at) ||
    Boolean((row as { scheduled_launch_at?: string | null } | null)?.scheduled_launch_at) ||
    (row as { landing_page_visibility?: string | null } | null)?.landing_page_visibility ===
      'public';
  if (outward) return 'already_outward';

  const { count } = await supabase
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES)
    .is('archived_at', null);
  if ((count ?? 0) > 0) return 'other_confirmed_vendors';

  const { error } = await supabase
    .from('events')
    .update({
      event_date: null,
      event_date_precision: 'year',
      auspicious_reasons: [],
      date_forced_by_lock_of: null,
    })
    .eq('event_id', eventId)
    .eq('date_forced_by_lock_of', vendorId);

  if (error) {
    console.error(
      `[releaseForcedDate] could not release the forced date for event_id=${eventId}:`,
      error,
    );
    return 'error';
  }
  return 'released';
}
