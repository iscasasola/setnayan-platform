import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * WHICH BOOKED SUPPLIER ON THIS EVENT IS THE HOST/MC?
 *
 * Written for the emcee's questions (DAY-7), which need the same answer
 * `EmceePicks` computes on the same page. `EmceePicks` keeps its own inline
 * copy of these two reads because `app/dashboard/reads-are-honest.test.ts`
 * pins its `bookedError` / `profilesError` gates in that file; both import the
 * one {@link HOST_TILE}, so they cannot disagree about which tile is the host.
 *
 * THREE OUTCOMES, NOT TWO. Supabase resolves a refused read with `{ error }`
 * rather than throwing, so "no host booked" and "we could not look" used to be
 * the same silence. Callers must render `unread` as a said thing.
 *
 * Runs under the CALLER's client — RLS decides what the couple can see.
 */

/** The host/MC canonical tile — the same key the specialization gate uses. */
export const HOST_TILE = 'host_mc';

export type BookedHost = {
  vendor_profile_id: string;
  business_name: string | null;
};

export type BookedHostLookup =
  | { state: 'found'; host: BookedHost }
  | { state: 'none' }
  | { state: 'unread' };

export async function findBookedHost(
  supabase: SupabaseClient,
  eventId: string,
  caller: string,
): Promise<BookedHostLookup> {
  const { data: booked, error: bookedError } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .not('marketplace_vendor_id', 'is', null);
  if (bookedError) {
    logQueryError(`${caller}.booked`, bookedError, { event_id: eventId }, 'graceful_degrade');
    return { state: 'unread' };
  }

  const vendorIds = ((booked ?? []) as { marketplace_vendor_id: string | null }[])
    .map((r) => r.marketplace_vendor_id)
    .filter((v): v is string => Boolean(v));
  if (vendorIds.length === 0) return { state: 'none' };

  const { data: profiles, error: profilesError } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, services')
    .in('vendor_profile_id', vendorIds);
  if (profilesError) {
    logQueryError(`${caller}.profiles`, profilesError, { event_id: eventId }, 'graceful_degrade');
    return { state: 'unread' };
  }

  const host = ((profiles ?? []) as {
    vendor_profile_id: string;
    business_name: string | null;
    services: string[] | null;
  }[]).find((p) => (p.services ?? []).includes(HOST_TILE));
  if (!host) return { state: 'none' };
  return {
    state: 'found',
    host: { vendor_profile_id: host.vendor_profile_id, business_name: host.business_name },
  };
}
