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
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';

/** event_vendors.category values that represent the CEREMONY venue. */
const CEREMONY_CATEGORIES = ['religious_venue', 'church_fees'] as const;
/** event_vendors.category value for the RECEPTION venue. */
const RECEPTION_CATEGORY = 'venue';

export type StdFinalizedVenues = {
  /** Finalized ceremony venue name, or null when none is booked on platform. */
  ceremony: string | null;
  /** Finalized reception venue name, or null when none is booked on platform. */
  reception: string | null;
};

export async function resolveStdFinalizedVenues(
  admin: SupabaseClient,
  eventId: string,
): Promise<StdFinalizedVenues> {
  try {
    const { data, error } = await admin
      .from('event_vendors')
      .select('category, status, vendor_name, updated_at')
      .eq('event_id', eventId)
      .is('archived_at', null);
    if (error || !data) return { ceremony: null, reception: null };

    type Row = {
      category: string | null;
      status: string | null;
      vendor_name: string | null;
      updated_at: string | null;
    };
    const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES as unknown as string[]);
    const rows = (data as Row[]).filter(
      (r) => r.status != null && confirmed.has(r.status) && r.vendor_name?.trim(),
    );

    // Most-recently-locked wins when a couple has more than one finalized pick
    // in a category (e.g. switched venues).
    const pick = (match: (c: string) => boolean): string | null =>
      rows
        .filter((r) => r.category != null && match(r.category))
        .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0]
        ?.vendor_name?.trim() ?? null;

    return {
      ceremony: pick((c) => (CEREMONY_CATEGORIES as readonly string[]).includes(c)),
      reception: pick((c) => c === RECEPTION_CATEGORY),
    };
  } catch {
    return { ceremony: null, reception: null };
  }
}
