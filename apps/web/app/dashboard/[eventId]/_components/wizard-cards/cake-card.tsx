/**
 * Card 22 Cake · Phase 5 · Late additions tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Wedding-cake
 * makers deliver across NCR + nearby provinces, and destination cake
 * specialists often ship by refrigerated van. Default sort (ad_rank →
 * review_count → avg_rating_overall) anchors on tasting notes + design
 * portfolio + reviews, not proximity.
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
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
