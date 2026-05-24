/**
 * Shared helper · fetchReceptionLatLng(admin, eventId)
 *
 * Resolves the lat/lng of a couple's locked reception venue so wizard
 * cards can ANCHOR a distance filter on it. Reception is the canonical
 * anchor for any Pattern B "anchored to reception" vendor pick per
 * CLAUDE.md 2026-05-24 sixth-row "Vendor presentation pattern" spec lock —
 * Ceremony · Accommodation · Lights+Sound · LED Background · Photobooth
 * · Mobile Bar · Pyro · Drone.
 *
 * The pattern existed inline in accommodation-card.tsx + ceremony-venue-
 * card.tsx (30 lines each, copy-pasted). Factored out 2026-05-24 to land
 * lights-sound + photobooths + led-background distance filters without
 * tripling the duplication. Fail-soft on any error: returns nulls so the
 * caller's `distanceFilter = nulls ? undefined : {…}` short-circuits
 * cleanly and the grid card renders without a distance gate.
 *
 * Resolution path: event_vendors row with category='venue' (the locked
 * reception) → marketplace_vendor_id → vendor_profiles.hq_latitude/
 * hq_longitude. Off-platform receptions (no marketplace_vendor_id) and
 * pre-lock state both return nulls; the distance filter just skips.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ReceptionLatLng = {
  receptionLat: number | null;
  receptionLng: number | null;
};

export async function fetchReceptionLatLng(
  admin: SupabaseClient,
  eventId: string,
): Promise<ReceptionLatLng> {
  try {
    const { data: receptionRow } = await admin
      .from('event_vendors')
      .select('marketplace_vendor_id, category')
      .eq('event_id', eventId)
      .eq('category', 'venue')
      .not('marketplace_vendor_id', 'is', null)
      .maybeSingle();
    const marketplaceVendorId = (
      receptionRow as { marketplace_vendor_id?: string | null } | null
    )?.marketplace_vendor_id;
    if (!marketplaceVendorId) {
      return { receptionLat: null, receptionLng: null };
    }
    const { data: vendorRow } = await admin
      .from('vendor_profiles')
      .select('hq_latitude, hq_longitude')
      .eq('vendor_profile_id', marketplaceVendorId)
      .maybeSingle();
    const vp = vendorRow as {
      hq_latitude?: number | null;
      hq_longitude?: number | null;
    } | null;
    if (vp?.hq_latitude != null && vp?.hq_longitude != null) {
      return { receptionLat: vp.hq_latitude, receptionLng: vp.hq_longitude };
    }
    return { receptionLat: null, receptionLng: null };
  } catch {
    return { receptionLat: null, receptionLng: null };
  }
}
