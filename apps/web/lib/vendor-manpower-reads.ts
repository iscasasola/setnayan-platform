/**
 * vendor-manpower-reads.ts — the two reads that decide which manpower gig
 * offers a supplier sees, split out of `app/vendor-dashboard/manpower/surface.tsx`
 * so a test can execute them.
 *
 *   · `readBookedEventIdsForGigs` — the events this shop is BOOKED on. It
 *     decides whether the open-gig read runs at all and over which events.
 *     It was one un-ranged SELECT: past the server's 1,000-row cap it came back
 *     short with `error: null`, and every gig on an event past the cut was
 *     silently not offered. Now paged to the exact count (`readAllPages`), and
 *     it says whether it finished.
 *   · `readOpenGigsForEvents` — the claimable gigs on those events. One
 *     `.in('event_id', …)` of every booked event is refused 400 by the gateway
 *     past ~600 ids, which blanked the list for exactly the busiest shops; it is
 *     chunked (`readInChunks`).
 *
 * The booked read runs on the ADMIN client scoped by the caller's own profile
 * id — `event_vendors` admits no vendor policy (see the surface's comment).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages, readInChunks } from '@/lib/read-all-pages';

export const GIG_BOOKED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'] as const;

export async function readBookedEventIdsForGigs(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<{ ids: string[]; error: string | null; complete: boolean }> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('event_vendors')
        .select('vendor_id, event_id', { count: 'exact' })
        .eq('marketplace_vendor_id', vendorProfileId)
        .in('status', GIG_BOOKED_STATUSES as unknown as string[])
        .is('archived_at', null)
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  const ids = Array.from(
    new Set((read.rows as { event_id: string | null }[]).map((r) => r.event_id).filter((v): v is string => Boolean(v))),
  );
  return { ids, error: read.error, complete: read.complete };
}

export const GIG_COLUMNS =
  'gig_id, event_id, posted_by_user_id, vendor_profile_id, gig_label, cash_amount_php_centavos, handshake_tokens_consumed, status, posted_at, accepted_at, completed_at, cancelled_at, cancellation_reason, notes, bir_exempt_note';

export async function readOpenGigsForEvents<Row extends { posted_at: string | null }>(
  supabase: SupabaseClient,
  eventIds: readonly string[],
): Promise<{ rows: Row[]; error: { message: string } | null }> {
  const { rows, error } = await readInChunks<Row>(eventIds, (part) =>
    supabase
      .from('manpower_gigs')
      .select(GIG_COLUMNS)
      .eq('status', 'pending')
      .in('event_id', part)
      .order('posted_at', { ascending: false }),
  );
  // Each chunk came back newest-first; the merged list must be too.
  rows.sort((a, b) => String(b.posted_at ?? '').localeCompare(String(a.posted_at ?? '')));
  return { rows, error };
}
