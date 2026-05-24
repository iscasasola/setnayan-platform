/**
 * Card 10 Lights + Sound · Phase 3 · Style + Identity tier.
 *
 * 2026-05-24 senior-planner pass (PR follow-up · owner directive "fix
 * the ones that should be by distance"): WIRED distance filter
 * (initialKm=10 default · stepper to widen). Per CLAUDE.md 2026-05-24
 * sixth-row "Vendor presentation pattern" spec lock, Lights+Sound is
 * Pattern B "anchored to reception" → distance from reception is the
 * canonical gate. The earlier shipped rationale ("crews travel") wasn't
 * wrong but the stepper UX is the canonical answer to that — default
 * tight, host widens for big NCR teams covering Tagaytay/Cebu
 * destination jobs. Default sort still anchors reviews-first (ad_rank
 * → review_count → avg_rating_overall) per the 5-tier ladder.
 *
 * Surfaces both lights_and_sound + led_screens coarse categories — many
 * PH wedding venues bring sound+lighting as one team and the LED wall is
 * a typical upsell from the same vendor. Filtering by both gives a
 * fuller pool than either alone.
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
  /** events.event_date · drives the availability filter. Sound + lighting
   *  teams with a confirmed booking on this date render at 30% opacity
   *  with no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['lights_and_sound', 'led_screens'] as const;

export async function LightsSoundCard({
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
      taskId="lights_sound"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'sound + lighting teams',
        customAddLabel: 'Sound + lights crew already booked?',
        emptyStateCopy:
          "We haven't curated sound + lighting teams for your area yet — search by name or add yours below. We'll wire your finalized mood-board palette into their lighting cues.",
      }}
      distanceFilter={distanceFilter}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
