/**
 * Card 18 Attire · Phase 4 · Programming tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Designers and
 * couture boutiques are picked by portfolio + fit-session quality, not
 * proximity — couples regularly fit at NCR ateliers for provincial
 * weddings. Default sort (ad_rank → review_count → avg_rating_overall)
 * anchors on portfolio + reputation.
 *
 * Combined gown + suit card. Filipino weddings often book the bride's
 * gown and groom's suit (and increasingly the barong tagalog) from the
 * same designer or sister boutiques, so surfacing both pools at once
 * gives the host the fullest picture.
 *
 * Muslim couples get modest-attire vendors via the
 * compatible_ceremony_types[] filter; Cultural weddings get traditional
 * Filipiniana / tribal attire designers if tagged.
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
  /** events.event_date · drives the availability filter. Attire designers
   *  with a confirmed booking on this date render at 30% opacity with
   *  no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['gown_designer', 'suit_designer'] as const;

export async function AttireCard({
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

  let emptyCopy: string;
  switch (ceremonyType) {
    case 'muslim':
      emptyCopy =
        "We haven't curated modest-attire designers for your area yet — search by name or add yours below. Many Muslim couples work with a designer who handles both the bride's modest gown and the groom's barong / formalwear.";
      break;
    case 'cultural':
      emptyCopy =
        "We haven't curated traditional Filipiniana or tribal-attire designers for your area yet — search by name or add yours below.";
      break;
    default:
      emptyCopy =
        "We haven't curated attire designers for your area yet — search by name or add yours below and we'll lock them into your plan.";
  }

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="attire"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'attire designers',
        customAddLabel: 'Already booked your designer or rental?',
        emptyStateCopy: emptyCopy,
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
