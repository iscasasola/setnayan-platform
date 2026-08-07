import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The room size a couple's BOOKED venue says it is.
 *
 * WHY THIS EXISTS. A couple opens their seating plan and picks a room from six
 * generic presets — Intimate 14×10 · Standard 20×30 · Grand 30×20 · Garden
 * 60×40 · Estate 120×90 · Field 200×200 — defaulting to Standard. They have
 * already booked a real venue with real walls. Every table they place, every
 * aisle they leave, and the whole 3D walk-through their guests explore is built
 * on that guess.
 *
 * The venue now states its size on its own shop, and this is the read half.
 * Owner, 2026-08-07: *"allowing vendors to set the sizes of their venues so
 * customers can fillup the space."*
 *
 * 🔑 A SUGGESTION, NEVER AN OVERWRITE. This only ever produces a starting
 * value. The moment a couple has sized their own room — or moved a single table
 * into one — the room is theirs, and a vendor editing their profile months
 * later must not reshape a plan already being worked on. The caller checks the
 * couple's own dimensions FIRST and only falls back to this.
 *
 * ⚠ Returns null far more often than not, and that is the normal case: most
 * events have no booked venue yet, most vendors are not venues, and a venue
 * that has not filled the field in is the default. Null means "no suggestion" —
 * it never means "the room is zero".
 */

/** The marketplace category a reception venue is filed under. Matches
 *  `RECEPTION_CATEGORY` in `lib/std-venues.ts` — one word, two readers. */
const VENUE_CATEGORY = 'venue';

/** Statuses that mean the couple has actually committed to this vendor. Kept
 *  narrow on purpose: an enquiry is not a booking, and sizing a plan from a
 *  venue the couple never books is worse than not sizing it at all. */
const BOOKED_STATUSES = ['booked', 'confirmed', 'completed'] as const;

export type VenueRoomSize = {
  widthM: number;
  lengthM: number;
  /** The venue's trading name — so the editor can say WHERE the number came
   *  from. A room that silently resizes itself is alarming; one that says
   *  "sized from Seda Vertis North" is a helpful colleague. */
  vendorName: string;
};

/**
 * Look up the booked venue's stated room size for an event.
 *
 * Returns null when there is no booked venue, when the booked venue is not a
 * venue-category vendor, when it never stated a size, or when the read fails.
 * A failure and an absence deliberately produce the SAME value here, and that
 * is safe precisely because the only consequence is "no suggestion" — the
 * couple still picks a preset exactly as they do today. This is the one shape
 * where collapsing those two is correct, and it is called out because
 * everywhere else on this codebase it has been a defect.
 */
export async function fetchBookedVenueRoomSize(
  supabase: SupabaseClient,
  eventId: string,
): Promise<VenueRoomSize | null> {
  try {
    const { data, error } = await supabase
      .from('event_vendors')
      .select(
        'vendor_name, category, status, linked_vendor_profile_id, ' +
          'vendor_profiles!event_vendors_linked_vendor_profile_id_fkey(venue_width_m, venue_length_m, business_name)',
      )
      .eq('event_id', eventId)
      .eq('category', VENUE_CATEGORY)
      .in('status', BOOKED_STATUSES as unknown as string[])
      .not('linked_vendor_profile_id', 'is', null)
      .limit(1);

    if (error || !data || data.length === 0) return null;

    const row = data[0] as {
      vendor_name?: string | null;
      vendor_profiles?:
        | { venue_width_m?: number | null; venue_length_m?: number | null; business_name?: string | null }
        | Array<{ venue_width_m?: number | null; venue_length_m?: number | null; business_name?: string | null }>
        | null;
    };
    // supabase-js returns an embedded row as an object or a one-element array
    // depending on how the relationship is inferred. Handle both rather than
    // betting on one — the wrong guess produces a silent null, which is exactly
    // the failure this whole feature is fixing.
    const profile = Array.isArray(row.vendor_profiles) ? row.vendor_profiles[0] : row.vendor_profiles;
    if (!profile) return null;

    const widthM = profile.venue_width_m;
    const lengthM = profile.venue_length_m;
    // The DB CHECK already refuses a one-sided pair, but this read must not
    // depend on that holding — a half-answer here would seed a room with one
    // real side and one invented one.
    if (typeof widthM !== 'number' || typeof lengthM !== 'number') return null;
    if (!(widthM > 0) || !(lengthM > 0)) return null;

    return {
      widthM,
      lengthM,
      vendorName: (profile.business_name || row.vendor_name || 'your venue').trim(),
    };
  } catch {
    // A seating plan must never fail to open because a suggestion could not be
    // fetched. The couple falls back to the presets, which is exactly today.
    return null;
  }
}

/**
 * Should the venue's size be offered as the starting room?
 *
 * ONLY when the couple has not set one. Their own number always wins, and
 * "already set" includes a plan they sized months ago and have been placing
 * tables into ever since.
 */
export function shouldSuggestVenueSize(
  couplesWidthM: number | null | undefined,
  couplesLengthM: number | null | undefined,
): boolean {
  return !(typeof couplesWidthM === 'number' && couplesWidthM > 0)
    && !(typeof couplesLengthM === 'number' && couplesLengthM > 0);
}
