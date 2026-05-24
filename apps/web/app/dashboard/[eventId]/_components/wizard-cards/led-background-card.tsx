/**
 * Card 10.5 LED Background · Phase 2 · Style + Identity tier.
 *
 * Added 2026-05-24 to align Today's Focus + Parallel Work Map + Your Plan
 * grid surfaces. The Plan grid already had a led_background cell tied to
 * VendorCategory='led_screens', but no wizard card pointed at it. This
 * card surfaces LED-screen rental vendors as a guided wizard flow.
 *
 * Separate from iteration 0005 LED Background Maker which is the offline
 * USB template upload flow. This card is the vendor-pick precursor —
 * lock the LED-rental vendor first, then upload the template via 0005's
 * surface a week before the wedding.
 *
 * Pattern: vendor_pick · VendorPickGridCard · default 5-tier sort.
 *
 * 2026-05-24 senior-planner pass (PR follow-up · owner directive "fix
 * the ones that should be by distance"): WIRED distance filter
 * (initialKm=10 default · stepper to widen). Per CLAUDE.md 2026-05-24
 * sixth-row "Vendor presentation pattern" spec lock, LED rental setups
 * are Pattern B "anchored to reception" — the LED wall is staged at the
 * reception venue. Default tight 10km radius matches the spec lock for
 * Pattern B Reception-anchored cards. Host widens via the stepper if
 * sourcing a specialty vendor from another region. The earlier shipped
 * "delivers across regions" rationale is true but the stepper is the
 * answer to that — default tight, widen as needed.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchWizardVendorRecommendations,
  fetchBookedMarketplaceVendorIdsForDate,
} from '@/lib/wizard-recommendations';
import { fetchReceptionLatLng } from './_reception-lat-lng';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickGridCard } from './vendor-pick-grid-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['led_screens'] as const;

export async function LedBackgroundCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
  eventDate,
}: Props) {
  const admin = createAdminClient();
  const { receptionLat, receptionLng } = await fetchReceptionLatLng(
    admin,
    eventId,
  );
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
          initialKm: 10,
          referenceLabel: 'Reception Venue',
        }
      : undefined;

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="led_background"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'LED background vendors',
        customAddLabel: 'Already have an LED rental in mind?',
        emptyStateCopy:
          "We haven't curated LED background vendors for your area yet — search by name or add yours below. The template uploads via our offline USB pipeline a week before.",
      }}
      distanceFilter={distanceFilter}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
