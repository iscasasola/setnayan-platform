/**
 * Card 10 Lights + Sound · Phase 3 · Style + Identity tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Sound +
 * lighting teams travel — many NCR-based crews cover Tagaytay and Cebu
 * destination weddings, and provincial crews equally cover their regional
 * radius. Default sort (ad_rank → review_count → avg_rating_overall)
 * anchors on reputation + portfolio, not proximity.
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
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
