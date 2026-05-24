/**
 * Card 13 Host / MC · Phase 3 · Style + Identity tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Hosts and
 * emcees travel — a celebrity / radio personality MC routinely flies to
 * provincial weddings, and a popular regional MC equally covers their
 * own region. Default sort (ad_rank → review_count → avg_rating_overall)
 * anchors on personality + portfolio + reviews, not proximity.
 *
 * Dedicated card for the emcee role separate from Card 12 Music. PH
 * weddings typically book a professional MC distinct from the band — the
 * MC drives the timeline (program flow · sponsor introductions ·
 * traditional rites · games) while the band/DJ handles music. Same coarse
 * category (host_emcee) but standalone task.
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
  /** events.event_date · drives the availability filter. Hosts / emcees
   *  with a confirmed booking on this date render at 30% opacity with
   *  no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['host_emcee'] as const;

export async function HostMcCard({
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
      taskId="host_mc"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'hosts and emcees',
        customAddLabel: 'Already have an MC in mind?',
        emptyStateCopy:
          "We haven't curated hosts + emcees for your area yet — search by name or add yours below. We'll share your finalized program timeline with them so they arrive prepared.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
