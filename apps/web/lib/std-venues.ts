/**
 * Finalized ceremony + reception venues for the Save-the-Date (iteration 0024 ·
 * 2026-06-19).
 *
 * The STD auto-fills its venue beats from the couple's FINALIZED vendor bookings
 * (owner directive: "if they finalize the venues, the information uploads
 * automatically") — no manual entry needed when the venues are booked on
 * platform. A booking counts as finalized when its `event_vendors.status` is in
 * CONFIRMED_VENDOR_STATUSES (contracted+). Ceremony and reception are told apart
 * by category: the religious-venue / church booking is the CEREMONY, the `venue`
 * booking is the RECEPTION.
 *
 * Couples who book OFF platform (DIY) have no finalized row → the builder's
 * manual venue field is the fallback (resolved by the caller). This returns just
 * the venue NAMES (the primary content); the city/area, when shown, comes from
 * the manual override or the event's free-text venue_address.
 *
 * Read across RLS with an admin/service client (the live page renders for
 * anonymous guests, like resolveReceptionAnchor). Never throws — returns nulls
 * on any read error so the film simply falls back to manual / skips the beat.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadVenueBookings } from '@/lib/event-venues';

export type StdFinalizedVenues = {
  /** Finalized ceremony venue name, or null when none is booked on platform. */
  ceremony: string | null;
  /** Finalized reception venue name, or null when none is booked on platform. */
  reception: string | null;
};

/**
 * 🔑 ONE READ, ONE PICK (2026-09-27). This used to run its own `event_vendors`
 * query with its own copy of the ceremony/reception category lists. The Event
 * Hub's venue scene now answers the same question with addresses and pins
 * (`lib/event-venues.ts`), and two pickers of one fact would each pass their
 * own tests while naming different places — so the film and the prints take
 * the NAMES from the same pick the Event Hub draws.
 */
export async function resolveStdFinalizedVenues(
  admin: SupabaseClient,
  eventId: string,
): Promise<StdFinalizedVenues> {
  const b = await loadVenueBookings(admin, eventId);
  return { ceremony: b.ceremony?.name ?? null, reception: b.reception?.name ?? null };
}
