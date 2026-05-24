/**
 * Card 19 Hair + Makeup · Phase 4 · Programming tier.
 *
 * 2026-05-24 senior-planner pass (PR follow-up · owner directive
 * "there are services that is best when the vendor is nearer the
 * venue"): WIRED distance filter (initialKm=10 default · stepper to
 * widen). Even though HMUA is Pattern A "creations" per CLAUDE.md
 * 2026-05-24 sixth-row spec lock (reviews-first), it is also morning-
 * of timing-sensitive — the artist travels to the bride's hotel/home
 * for prep at sunrise, and a 2-hour drive on wedding morning =
 * compressed prep window + tired artist. Premium HMUA do fly into
 * destination weddings; the stepper widens for Cebu/Boracay couples
 * where the full pool is "far" by NCR standards. Default sort still
 * anchors reviews-first per the 5-tier ladder.
 *
 * Surfaces both makeup_artist + hair_stylist coarse categories — many
 * HMUA professionals in PH offer both as a single package; surfacing
 * both pools at once gives the fullest picture.
 *
 * Muslim couples get hijab-compatible vendors via the
 * compatible_ceremony_types[] filter on vendor_market_stats.
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
  /** events.event_date · drives the availability filter. HMUA with a
   *  confirmed booking on this date render at 30% opacity with no
   *  action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['makeup_artist', 'hair_stylist'] as const;

export async function HairMakeupCard({
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
      taskId="hair_makeup"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'hair + makeup artists',
        customAddLabel: 'Found your HMUA already?',
        emptyStateCopy:
          "We haven't curated hair + makeup artists for your area yet — search by name or add yours below. Trial sessions usually happen 2–3 months before the wedding so the look is locked in time.",
      }}
      distanceFilter={distanceFilter}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
