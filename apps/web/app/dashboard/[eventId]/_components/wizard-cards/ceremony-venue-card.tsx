/**
 * Card 03 Ceremony Venue · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * 2026-05-24 owner directives:
 *   1. Swap from the legacy list VendorPickCard to the visual
 *      VendorPickGridCard (same shape as Card 02 reception venue).
 *   2. Replace the city filter with a "Distance from Reception Venue"
 *      stepper (default 15 km, ±5 km steps). When the host has locked
 *      their reception venue, the grid only shows ceremony venues
 *      within the distance radius. Without a locked reception (preview
 *      mode / not-yet-locked), the distance filter is skipped and the
 *      grid behaves like Card 02 with a regular city filter as
 *      fallback (so the preview surface stays usable).
 *
 * Server component · fetches top-100 ceremony-venue recommendations from
 * vendor_market_stats (canonical: 'religious_venue' — churches, mosques,
 * INC chapels, civil registrar venues per the demo-vendor seed's
 * coarseCategoryFor() map). Filters by event's ceremony_type so Catholic
 * couples see churches, Muslim see mosques, INC see INC chapels, civil
 * see civil registrars / city hall halls.
 *
 * Reception venue location is resolved by joining event_vendors (the
 * host's locked reception_venue row) → vendor_profiles to pull
 * hq_latitude / hq_longitude. If the locked reception is off-platform
 * (custom vendor, no lat/lng) or not yet locked, distance filter is
 * skipped gracefully — the host still sees all churches in the region.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickGridCard } from './vendor-pick-grid-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  /** Ceremony venues aren't typically filtered by venue_setting (a Catholic
   *  church doesn't have a "garden" attribute the way a reception venue
   *  does), but we pass it through for vendors who tagged compat anyway. */
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
};

const CANONICAL_SERVICES = ['religious_venue'] as const;

export async function CeremonyVenueCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();

  // Fetch reception venue lat/lng IF locked. Pattern: read the host's
  // event_vendors row whose category resolves to 'venue' (reception) +
  // its marketplace_vendor_id, then join vendor_profiles for
  // hq_latitude/hq_longitude. Fail-soft on any error · the grid renders
  // without the distance filter rather than blocking the card.
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

  // Limit bumped to 100 so the 15-per-page pagination has multi-page
  // depth even after distance filtering narrows the set.
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: CANONICAL_SERVICES,
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 100,
  });

  // Ceremony-type-specific empty state copy — civil couples often find
  // their "ceremony venue" IS the city hall or a civil registrar, neither
  // of which surfaces from religious_venue. We say so plainly.
  const emptyCopy =
    ceremonyType === 'civil'
      ? "Civil ceremonies happen at city hall, a civil registrar, or your reception venue — add yours below and we'll lock it into your plan."
      : "We haven't curated ceremony venues for your area + faith yet — add yours below and we'll lock it into your plan.";

  const distanceFilter =
    receptionLat != null && receptionLng != null
      ? {
          referenceLat: receptionLat,
          referenceLng: receptionLng,
          initialKm: 15, // 2026-05-24 owner directive
          referenceLabel: 'Reception Venue',
        }
      : undefined;

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="ceremony_venue"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun:
          ceremonyType === 'civil'
            ? 'civil ceremony venues'
            : 'churches and chapels',
        customAddLabel: 'Booked your church or chapel already?',
        emptyStateCopy: emptyCopy,
      }}
      distanceFilter={distanceFilter}
    />
  );
}
