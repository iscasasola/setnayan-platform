/**
 * Card 19 Hair + Makeup · Phase 4 · Programming tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. HMUA travel
 * to the venue is standard — couples regularly fly in a Manila MUA for a
 * Cebu wedding, or book a Boracay-based artist for an island wedding.
 * Trial sessions can also happen near the artist's studio. Default sort
 * (ad_rank → review_count → avg_rating_overall) anchors on portfolio +
 * reviews, not proximity.
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
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
