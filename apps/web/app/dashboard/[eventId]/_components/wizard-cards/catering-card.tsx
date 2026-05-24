/**
 * Card 07 Catering · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Caterers
 * travel — most PH catering vendors deliver across NCR + nearby provinces,
 * and destination caterers fly crew to Cebu / Boracay / Bohol weddings.
 * Default sort (ad_rank → review_count → avg_rating_overall) anchors on
 * trust + portfolio first; the host can search by city if they want a
 * proximity filter.
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
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
