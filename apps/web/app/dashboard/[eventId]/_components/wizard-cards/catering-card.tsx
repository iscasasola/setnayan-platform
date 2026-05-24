/**
 * Card 07 Catering · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * 2026-05-24 senior-planner pass (PR follow-up · owner directive
 * "there are services that is best when the vendor is nearer the
 * venue"): WIRED distance filter (initialKm=10 default · stepper to
 * widen). Even though catering is technically Pattern A "creations"
 * per CLAUDE.md 2026-05-24 sixth-row spec lock (reviews-first), it is
 * also delivery-sensitive — hot food must arrive at the reception
 * still hot, and >30 minutes of PH traffic between kitchen and venue
 * compromises every dish. Caterers far from the venue route through
 * satellite kitchens or skip the booking. The stepper lets the host
 * widen for destination weddings (Cebu / Boracay) where the entire
 * pool is "far" by NCR standards. Default sort still anchors reviews-
 * first per the 5-tier ladder.
 *
 * Filters by event's ceremony_type so INC weddings see alcohol-free /
 * kosher-style options, Muslim see halal-certified, etc. — the
 * vendor_profiles.compatible_ceremony_types[] gating handles the broad
 * faith-fit check; per-attribute deep filters (halal_certified · INC-
 * friendly · etc. from iteration 0044 shared_attribute_groups) ship in
 * V1.x once the catering attribute editor lands.
 *
 * Crew-meal mention is INTENTIONALLY in the empty-state copy — Filipino
 * couples often forget the per-vendor crew-meal allocation at booking
 * time and discover the gap weeks before the wedding. Surfacing the
 * reminder here matches the 0007 Budget iteration's 3-line model
 * (Package · Crew Meal · Transportation).
 *
 * Card kind: vendor_pick.
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
  /** events.event_date · drives the availability filter. Caterers with
   *  a confirmed booking on this date render at 30% opacity with no
   *  action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['catering'] as const;

export async function CateringCard({
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
      taskId="catering"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'caterers',
        customAddLabel: 'Found your caterer already?',
        emptyStateCopy:
          "We haven't curated caterers for your area + ceremony yet — search by name or add yours below. You can capture per-head pricing and crew meals on the budget page after.",
      }}
      distanceFilter={distanceFilter}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
