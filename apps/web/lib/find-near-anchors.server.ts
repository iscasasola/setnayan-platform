import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadVenueBookings, resolveEventVenues, type EventVenueColumns } from './event-venues';
import { nearAnchors, type NearAnchors } from './find-sort-choices';

/**
 * 📍 The two places Find's "Nearest" measures from (owner 2026-10-30, "Reception + Ceremony") — the Event Hub's own
 * answer to "where is this event?" (`resolveEventVenues`: a booked venue's pin, else the couple's own pin), so the
 * suppliers list and the invitation can never disagree about where the reception is.
 *
 * `admin` is the service role the caller already holds, scoped to an event the caller has ALREADY authorised (the
 * suppliers page's member gate · the category search's own gate) — the same shape the Event Hub reads it with.
 * `loadVenueBookings` never throws: a refused read logs and resolves to the event's own columns.
 */
export async function readNearAnchors(admin: SupabaseClient, eventId: string, event: EventVenueColumns): Promise<NearAnchors> {
  return nearAnchors(resolveEventVenues(await loadVenueBookings(admin, eventId), event));
}
