import type { SupabaseClient } from '@supabase/supabase-js';
import { eventActiveSkus } from '@/lib/entitlements';

/**
 * after-summary.ts — what a finished event has to SHOW for itself.
 *
 * Owner, 2026-08-21, opening a Movie Night the morning after it happened:
 * *"why can i still plan and build and create guest list as if it hasn't
 * ended… what we want is to show the summary of the overview, guest,
 * marketplace, suite, and the editorial maker."*
 *
 * This is the read half of that answer: six cheap counts, each one loaded
 * INDEPENDENTLY and each one allowed to fail on its own.
 *
 * ─── A COUNT THAT COULD NOT BE READ IS NOT ZERO ──────────────────────────
 * Every field here is `number | null`, and `null` means NOT MEASURED. The
 * repo has paid for this distinction before: an unreadable queue filed under
 * "everything is clear" puts it in the one place a person has been told they
 * need not look, and it looks completely fine. The cards below print nothing
 * where they cannot print the truth — never a 0 they did not measure.
 *
 * 🔑 AND `.select(…, { count: 'exact', head: true })` DOES NOT THROW WHEN THE
 * QUERY IS REFUSED. Supabase resolves with `{ error }`, so every read here
 * checks `error` explicitly rather than leaning on a try/catch, which is
 * decoration around a promise that resolves. Same family as the phantom
 * column / phantom enum value / phantom RPC argument: the query is REJECTED,
 * not thrown, and the only symptom is an absence.
 */

/** `null` ⇒ the read failed or was refused. It does NOT mean zero. */
export type Measured = number | null;

export type EditorialState = 'none' | 'draft' | 'published';

export type AfterSummary = {
  guests: Measured;
  guestsAttending: Measured;
  checkedIn: Measured;
  /** Suppliers on the event's own list, archived rows excluded. */
  suppliers: Measured;
  /** Reviews this couple has already written for this event. */
  suppliersReviewed: Measured;
  /** Services active on the event (paid, comped or free-for-all). */
  services: Measured;
  /** Papic captures held for the event. */
  photos: Measured;
  editorial: EditorialState;
  editorialMeasured: boolean;
};

async function countOf(
  supabase: SupabaseClient,
  build: () => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<Measured> {
  void supabase;
  try {
    const { count, error } = await build();
    // A refused or malformed query resolves with an error and a null count.
    // Returning 0 here is the bug this whole module is shaped to avoid.
    if (error) return null;
    return count ?? null;
  } catch {
    return null;
  }
}

/**
 * Loads the finished-event summary. Never throws — the Overview must render
 * even when every read fails; it simply has less to say.
 *
 * `supabase` should be an admin client: these are the host's own aggregates
 * and several of the tables (papic_photos, event_editorial) are composer- or
 * service-owned, which is how the editorial editor already reads them.
 */
export async function loadAfterSummary(
  supabase: SupabaseClient,
  eventId: string,
): Promise<AfterSummary> {
  const [
    guests,
    guestsAttending,
    checkedIn,
    suppliers,
    suppliersReviewed,
    photos,
    editorialRow,
    services,
  ] = await Promise.all([
    countOf(supabase, () =>
      supabase.from('guests').select('guest_id', { count: 'exact', head: true }).eq('event_id', eventId),
    ),
    countOf(supabase, () =>
      supabase
        .from('guests')
        .select('guest_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('rsvp_status', 'attending'),
    ),
    countOf(supabase, () =>
      supabase
        .from('guest_checkins')
        .select('checkin_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
    ),
    countOf(supabase, () =>
      supabase
        .from('event_vendors')
        .select('vendor_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('archived_at', null),
    ),
    countOf(supabase, () =>
      supabase
        .from('vendor_reviews')
        .select('review_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
    ),
    countOf(supabase, () =>
      supabase
        .from('papic_photos')
        .select('photo_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
    ),
    (async () => {
      try {
        const { data, error } = await supabase
          .from('event_editorial')
          .select('status, published_at')
          .eq('event_id', eventId)
          .maybeSingle();
        if (error) return null;
        return (data ?? { status: null, published_at: null }) as {
          status: string | null;
          published_at: string | null;
        };
      } catch {
        return null;
      }
    })(),
    (async (): Promise<Measured> => {
      try {
        const { active } = await eventActiveSkus(supabase, eventId);
        return active.size;
      } catch {
        return null;
      }
    })(),
  ]);

  let editorial: EditorialState = 'none';
  if (editorialRow) {
    if (editorialRow.published_at || editorialRow.status === 'published') editorial = 'published';
    else if (editorialRow.status) editorial = 'draft';
  }

  return {
    guests,
    guestsAttending,
    checkedIn,
    suppliers,
    suppliersReviewed,
    services,
    photos,
    editorial,
    editorialMeasured: editorialRow !== null,
  };
}
