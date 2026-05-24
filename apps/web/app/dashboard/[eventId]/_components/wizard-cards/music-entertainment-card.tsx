/**
 * Card 12 Music + Entertainment · Phase 3 · Style + Identity tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Bands · DJs ·
 * choirs · quartets travel — Filipino couples often book a Manila band
 * for a Cebu wedding, or a Cebu acoustic act for a Boracay one. The
 * default sort (ad_rank → review_count → avg_rating_overall) anchors on
 * sample reels + reputation, not km-from-venue.
 *
 * Wider net than Card 13 Host MC: surfaces bands · DJs · choirs · string
 * quartets — anything that fills the ceremony or reception with music.
 * INC + Muslim couples get faith-compat vendors (no DJ at a strict
 * ceremony for INC, kulintang ensembles preferred for Muslim) via the
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
  /** events.event_date · drives the availability filter. Music vendors
   *  with a confirmed booking on this date render at 30% opacity with
   *  no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = [
  'band_dj',
  'choir',
  'string_quartet',
  'host_emcee',
] as const;

export async function MusicEntertainmentCard({
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
    case 'inc':
      emptyCopy =
        "We haven't curated INC-friendly musicians for your area yet — search by name or add yours below. They'll know the music rules for your ceremony.";
      break;
    case 'muslim':
      emptyCopy =
        "We haven't curated Muslim-wedding musicians for your area yet — search by name or add yours below. Kulintang ensembles or acoustic acts work beautifully.";
      break;
    default:
      emptyCopy =
        "We haven't curated bands or DJs for your area yet — search by name or add yours below and we'll lock them into your plan.";
  }

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="music_entertainment"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'bands and entertainers',
        customAddLabel: 'Have your band or DJ already?',
        emptyStateCopy: emptyCopy,
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
