/**
 * Card 22 Cake · Phase 5 · Late additions tier.
 *
 * 2026-05-24 senior-planner pass (PR follow-up · owner directive
 * "there are services that is best when the vendor is nearer the
 * venue"): WIRED distance filter (initialKm=10 default · stepper to
 * widen). Even though cake is Pattern A "creations" per CLAUDE.md
 * 2026-05-24 sixth-row spec lock (reviews-first), it is also
 * delivery-sensitive — tiered + fondant wedding cakes don't survive
 * 1+ hour van rides in PH traffic without structural compromise.
 * Multi-tier cakes need short refrigerated transit windows; the
 * default 10km radius lets the host see local-first, and the stepper
 * widens for destination weddings or specialty cake-makers worth the
 * extra travel. Default sort still anchors reviews-first per the
 * 5-tier ladder.
 *
 * Wedding cake + dessert station vendors share the cake_maker coarse
 * category in the demo-vendor seed's coarseCategoryFor() heuristic.
 * Muslim couples get halal-ingredients vendors via the
 * compatible_ceremony_types[] filter.
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
  /** events.event_date · drives the availability filter. Cake makers
   *  with a confirmed booking on this date render at 30% opacity with
   *  no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['cake_maker'] as const;

export async function CakeCard({
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
      taskId="cake"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'cake makers',
        customAddLabel: 'Cake-maker already booked?',
        emptyStateCopy:
          "We haven't curated cake makers for your area yet — search by name or add yours below. Most accept design briefs from your finalized mood board palette.",
      }}
      distanceFilter={distanceFilter}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
