import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import type { RoomSizeAnswer } from './booked-rows';

/**
 * THE ROOM SIZE EACH BOOKED VENUE HAS STATED — one read, for the Booked body's
 * "Room size 18 × 24 m · sent ✓" (owner 2026-10-06: the room size comes from
 * the venue; 2026-10-07: only reception · ceremony · accommodation have one).
 *
 * The supplier states it on their own shop ("Room size & capacity",
 * `vendor_profiles.venue_width_m` / `venue_length_m`). This reads it per booked
 * supplier, keyed by the booking, through the couple's own session.
 *
 *   a size                 they stated both sides
 *   'not_sent'             their shop row answered and holds no size
 *   (absent from the map)  the shop row did not answer — an unpublished shop is
 *                          not readable by a couple, and that is NOT "not sent"
 *
 * 🛑 `null` = the read was REFUSED. Never an empty map.
 *
 * (`fetchBookedVenueRoomSize` in `lib/venue-room-size.ts` answers a different
 * question — ONE starting size for the seat plan — and is left as it is.)
 */
export async function readBookedRoomSizes(
  supabase: SupabaseClient,
  /** booking (`event_vendors.vendor_id`) → the supplier's shop (`marketplace_vendor_id`). */
  shopByVendorId: ReadonlyMap<string, string>,
): Promise<Map<string, RoomSizeAnswer> | null> {
  const out = new Map<string, RoomSizeAnswer>();
  const shopIds = [...new Set(shopByVendorId.values())];
  if (shopIds.length === 0) return out;
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, venue_width_m, venue_length_m')
    .in('vendor_profile_id', shopIds);
  if (error) {
    logQueryError('readBookedRoomSizes', error, { shops: shopIds.length }, 'graceful_degrade');
    return null;
  }
  const byShop = new Map(
    ((data ?? []) as Array<{ vendor_profile_id: string; venue_width_m: number | null; venue_length_m: number | null }>).map(
      (r) => [r.vendor_profile_id, r],
    ),
  );
  for (const [vendorId, shopId] of shopByVendorId) {
    const row = byShop.get(shopId);
    if (!row) continue;
    const w = Number(row.venue_width_m);
    const l = Number(row.venue_length_m);
    // One real side and one missing one is not a size.
    out.set(vendorId, row.venue_width_m != null && row.venue_length_m != null && w > 0 && l > 0 ? { widthM: w, lengthM: l } : 'not_sent');
  }
  return out;
}
