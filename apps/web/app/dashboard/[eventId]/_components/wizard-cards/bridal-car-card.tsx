/**
 * Card 24 Bridal Car · Phase 5 · Late additions tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Transport
 * services are picked by fleet + reputation + reliability — many NCR
 * fleets serve Tagaytay / Batangas / La Union weddings, and provincial
 * operators serve their region. Default sort (ad_rank → review_count →
 * avg_rating_overall) anchors on portfolio + service quality, not km.
 *
 * Bridal car + guest shuttle + entourage transport all share the
 * 'transportation' coarse category in the demo-vendor seed. The host
 * typically books one combined transportation vendor for the wedding —
 * this card surfaces both bridal-car-only specialists and broader
 * transport teams.
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
  /** events.event_date · drives the availability filter. Transport
   *  vendors with a confirmed booking on this date render at 30% opacity
   *  with no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['transportation'] as const;

export async function BridalCarCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
  eventDate,
}: Props) {
  const admin = createAdminClient();
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

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="bridal_car"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'bridal-car services',
        customAddLabel: "Family's lending a car? Add it here.",
        emptyStateCopy:
          "We haven't curated bridal-car services for your area yet — search by name or add yours below. Many Filipino couples borrow from family; you can lock that here too.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
