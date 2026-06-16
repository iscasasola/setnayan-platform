import type { SupabaseClient } from '@supabase/supabase-js';
import { haversineKm } from './geo';

/**
 * Day-of "Get help" shortlist (Event Lifecycle Menu §4 + §10 PR5).
 *
 * When something goes wrong on the wedding day, the couple's Day-of Get-help
 * card surfaces a few VERIFIED, PAID vendors who opted into same-day work,
 * nearest the venue first. The escalation-to-support CTA stays the floor; this
 * is the "fire a flare" above it. V1 is filter + shortlist only — real same-day
 * BOOKING is V1.5.
 *
 * Why the tier gate (`tier_state <> 'free'`): only paid vendors surface, whose
 * names are always visible (free+verified names stay masked until first chat
 * reply per the hybrid-anonymity doctrine) and who have skin in the game.
 */

export type VenueAnchor = {
  lat: number | null;
  lng: number | null;
  region: string | null;
};

export type SameDayVendor = {
  vendorProfileId: string;
  name: string;
  slug: string | null;
  region: string | null;
  locationCity: string | null;
  services: string[] | null;
  /** Haversine km from the venue; null when venue or vendor geo is missing. */
  distanceKm: number | null;
};

const MAX_RESULTS = 5;
const CANDIDATE_LIMIT = 50;

type Row = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  hq_region: string | null;
  location_city: string | null;
  services: string[] | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
};

/**
 * Verified + paid + same-day-opted-in vendors, ranked for the venue:
 *   • venue geo present → haversine distance ascending; geo-less vendors trail
 *   • venue geo absent  → same-region first (city/region list), then by name —
 *     **never empty** (an off-platform venue with no lat/long still gets a list)
 *
 * Pure read; graceful-degrade to `[]` if the `same_day_available` column/table
 * isn't there yet (pre-migration) so the Get-help card never crashes.
 */
export async function findSameDayVendors(
  supabase: SupabaseClient,
  venue: VenueAnchor,
): Promise<SameDayVendor[]> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, business_name, business_slug, hq_region, location_city, services, hq_latitude, hq_longitude',
    )
    .eq('public_visibility', 'verified')
    .eq('same_day_available', true)
    .neq('tier_state', 'free')
    .limit(CANDIDATE_LIMIT);
  if (error || !data) return [];

  const haveVenueGeo =
    venue.lat != null &&
    venue.lng != null &&
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lng);

  const enriched = (data as Row[]).map((r) => {
    const hasGeo = r.hq_latitude != null && r.hq_longitude != null;
    const distanceKm =
      haveVenueGeo && hasGeo
        ? haversineKm(
            venue.lat as number,
            venue.lng as number,
            r.hq_latitude as number,
            r.hq_longitude as number,
          )
        : null;
    const name = (r.business_name ?? '').trim() || 'Setnayan vendor';
    return {
      vendorProfileId: r.vendor_profile_id,
      name,
      slug: r.business_slug,
      region: r.hq_region,
      locationCity: r.location_city,
      services: r.services,
      distanceKm,
      regionMatch:
        venue.region != null && r.hq_region != null && r.hq_region === venue.region,
    };
  });

  enriched.sort((a, b) => {
    if (haveVenueGeo) {
      // Nearest first; geo-less vendors (distanceKm null) sink to the bottom.
      if (a.distanceKm == null && b.distanceKm == null) return a.name.localeCompare(b.name);
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    }
    // No venue geo → same-region first, then alphabetical. Always returns a list.
    if (a.regionMatch !== b.regionMatch) return a.regionMatch ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return enriched.slice(0, MAX_RESULTS).map((v) => ({
    vendorProfileId: v.vendorProfileId,
    name: v.name,
    slug: v.slug,
    region: v.region,
    locationCity: v.locationCity,
    services: v.services,
    distanceKm: v.distanceKm,
  }));
}
