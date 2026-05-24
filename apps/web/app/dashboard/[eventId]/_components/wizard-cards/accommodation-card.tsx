/**
 * Card 23 Accommodation · Phase 5 · Late additions tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with a DISTANCE FILTER FROM RECEPTION
 * (initialKm=10). Guest accommodation must be close to the reception
 * venue — out-of-town guests need a short ride between reception and
 * sleep. 10 km is the default tight radius; the host can widen via the
 * stepper any time. Mirrors the Card 03 Ceremony Venue distance pattern.
 *
 * Hotels + resorts + AirBnB-style hosts for out-of-town guests. The
 * 'accommodation' vendor_category was added per Task #42 (2026-05).
 * Filters by event's venue_setting so destination weddings (Tagaytay /
 * Boracay / Cebu / Palawan) see accommodation near the reception venue.
 *
 * Reception venue location is resolved by joining event_vendors (the
 * host's locked reception_venue row) → vendor_profiles to pull
 * hq_latitude / hq_longitude. If the locked reception is off-platform
 * (custom vendor, no lat/lng) or not yet locked, the distance filter is
 * skipped gracefully — the host still sees all accommodation in the
 * region with the standard city filter as fallback.
 *
 * Card kind: vendor_pick.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchWizardVendorRecommendations,
  fetchBookedMarketplaceVendorIdsForDate,
} from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickGridCard } from './vendor-pick-grid-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
  /** events.event_date · drives the availability filter. Accommodation
   *  vendors with a confirmed booking on this date render at 30% opacity
   *  with no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['accommodation'] as const;

export async function AccommodationCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
  eventDate,
}: Props) {
  const admin = createAdminClient();

  // Fetch reception venue lat/lng IF locked. Pattern matches Card 03 ·
  // read the host's event_vendors row whose category resolves to 'venue'
  // (reception) + its marketplace_vendor_id, then join vendor_profiles
  // for hq_latitude / hq_longitude. Fail-soft on any error · the grid
  // renders without the distance filter rather than blocking the card.
  let receptionLat: number | null = null;
  let receptionLng: number | null = null;
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
    if (marketplaceVendorId) {
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
        receptionLat = vp.hq_latitude;
        receptionLng = vp.hq_longitude;
      }
    }
  } catch {
    // Distance filter just won't apply · grid still renders.
  }

  // Limit 100 so the grid's 5-row × 1-5-col pagination has multi-page
  // depth even after distance filtering narrows the set.
  const [recs, bookedIds] = await Promise.all([
    fetchWizardVendorRecommendations(admin, {
      canonicalServices: CANONICAL_SERVICES,
      ceremonyType,
      venueSetting,
      excludeVendorIds: excludeMarketplaceIds,
      limit: 100,
    }),
    fetchBookedMarketplaceVendorIdsForDate(admin, eventId, eventDate),
  ]);

  const distanceFilter =
    receptionLat != null && receptionLng != null
      ? {
          referenceLat: receptionLat,
          referenceLng: receptionLng,
          // 10 km initial — out-of-town guests need a short ride between
          // reception and sleep. Stepper lets the host widen any time.
          initialKm: 10,
          referenceLabel: 'Reception Venue',
        }
      : undefined;

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="accommodation"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'hotels and accommodations',
        customAddLabel: 'Have a hotel block already?',
        emptyStateCopy:
          "We haven't curated accommodation for your area yet — search by name or add yours below. Destination weddings usually reserve a block of rooms for out-of-town guests; we'll surface the link on your invitation page.",
      }}
      distanceFilter={distanceFilter}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
