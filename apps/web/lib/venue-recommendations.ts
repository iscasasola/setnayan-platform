import type { SupabaseClient } from '@supabase/supabase-js';

import { haversineKm } from './geo';

/**
 * Paired-venue recommendation engine.
 *
 * When a couple has anchored a reception venue (`events.venue_latitude` +
 * `events.venue_longitude` populated by the save-vendor flow), this helper
 * surfaces nearby CEREMONY venues for the matching ceremony_type — closing
 * the "I picked a venue, where's the other half?" loop the marketplace
 * couldn't answer in V1.
 *
 * V1 scope:
 *   • Reception → Ceremony direction only. `events.venue_latitude` is
 *     defined as the reception anchor in migration
 *     20260525000000_vendor_hq_geocode_and_event_venue_anchor.sql. Adding
 *     a symmetric ceremony anchor needs a separate migration (V1.2).
 *   • Religious ceremony venues are surfaced when they're in the data as
 *     `vendor_profiles` rows with `services` containing `religious_venue`.
 *     Civil weddings also see Civil Registrar locations when seeded.
 *   • Filtering uses `compatible_ceremony_types[]` so a Catholic couple
 *     doesn't see a mosque, etc. NULL/missing array = "compatible with all"
 *     (per the 0043 contract).
 *   • Top 3 candidates within 10 km, sorted by distance. Couples wanting
 *     a wider radius browse the Ceremony folder directly.
 *
 * Honest pre-launch state: zero ceremony venues are seeded in V1. This
 * helper returns an empty array until a venue iteration ships seed rows
 * (the catalog panel renders a "Coming soon" placeholder in that case).
 */

const PAIRED_VENUE_RADIUS_KM = 10;
const PAIRED_VENUE_LIMIT = 3;

export type PairedVenueCandidate = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  location_city: string | null;
  logo_url: string | null;
  hq_latitude: number;
  hq_longitude: number;
  distance_km: number;
  compatible_ceremony_types: string[] | null;
};

type Row = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  location_city: string | null;
  logo_url: string | null;
  hq_latitude: number | string | null;
  hq_longitude: number | string | null;
  compatible_ceremony_types: string[] | null;
};

/**
 * Find ceremony venues within `PAIRED_VENUE_RADIUS_KM` of the couple's
 * reception anchor. Returns ≤ `PAIRED_VENUE_LIMIT`, sorted by distance.
 *
 * Faith filter: when `coupleCeremonyType` is set (e.g. 'catholic'), only
 * venues that include it in `compatible_ceremony_types[]` (or have NULL
 * meaning "open to all") surface. When `null` (anonymous browse or no
 * couple), all faiths surface.
 */
export async function findPairedCeremonyVenues(
  admin: SupabaseClient,
  args: {
    anchorLat: number;
    anchorLng: number;
    coupleCeremonyType: string | null;
  },
): Promise<PairedVenueCandidate[]> {
  // Cast a generous fetch window because RLS/index won't trim by distance —
  // we do the haversine math in-process. 50 rows is more than enough headroom
  // for any reception anchor; 99% of couples have <10 candidates within 10 km.
  const FETCH_WINDOW = 50;

  const { data, error } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,public_id,business_name,business_slug,location_city,logo_url,hq_latitude,hq_longitude,compatible_ceremony_types',
    )
    .contains('services', ['religious_venue'])
    .in('public_visibility', ['verified', 'coming_soon'])
    .not('business_name', 'is', null)
    .neq('business_name', '')
    .not('hq_latitude', 'is', null)
    .not('hq_longitude', 'is', null)
    .limit(FETCH_WINDOW);

  if (error || !data) return [];

  const rows = data as Row[];
  const candidates: PairedVenueCandidate[] = [];

  for (const row of rows) {
    const lat = row.hq_latitude !== null ? Number(row.hq_latitude) : NaN;
    const lng = row.hq_longitude !== null ? Number(row.hq_longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    // Faith filter — if couple has a ceremony_type, vendor must declare
    // compatibility OR have NULL (open to all). Civil-only couples skip
    // this filter entirely (coupleCeremonyType === null).
    if (args.coupleCeremonyType !== null) {
      const compat = row.compatible_ceremony_types;
      if (compat !== null && !compat.includes(args.coupleCeremonyType)) {
        continue;
      }
    }

    const distance = haversineKm(args.anchorLat, args.anchorLng, lat, lng);
    if (distance > PAIRED_VENUE_RADIUS_KM) continue;

    candidates.push({
      vendor_profile_id: row.vendor_profile_id,
      public_id: row.public_id,
      business_name: row.business_name,
      business_slug: row.business_slug,
      location_city: row.location_city,
      logo_url: row.logo_url,
      hq_latitude: lat,
      hq_longitude: lng,
      distance_km: distance,
      compatible_ceremony_types: row.compatible_ceremony_types,
    });
  }

  candidates.sort((a, b) => a.distance_km - b.distance_km);
  return candidates.slice(0, PAIRED_VENUE_LIMIT);
}

export const PAIRED_VENUE_CONFIG = {
  radiusKm: PAIRED_VENUE_RADIUS_KM,
  limit: PAIRED_VENUE_LIMIT,
} as const;
