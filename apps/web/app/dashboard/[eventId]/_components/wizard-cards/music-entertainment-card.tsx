/**
 * Card 12 Music + Entertainment · Phase 3 · Style + Identity tier.
 *
 * Wider net than Card 13 Host MC: surfaces bands · DJs · choirs · string
 * quartets — anything that fills the ceremony or reception with music.
 * INC + Muslim couples get faith-compat vendors (no DJ at a strict
 * ceremony for INC, kulintang ensembles preferred for Muslim) via the
 * compatible_ceremony_types[] filter on vendor_market_stats.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickCard } from './vendor-pick-card';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
};

export async function MusicEntertainmentCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['band_dj', 'choir', 'string_quartet', 'host_emcee'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  let emptyCopy: string;
  switch (ceremonyType) {
    case 'inc':
      emptyCopy =
        "We haven't curated INC-friendly musicians for your area yet — add yours below. They'll know the music rules for your ceremony.";
      break;
    case 'muslim':
      emptyCopy =
        "We haven't curated Muslim-wedding musicians for your area yet — add yours below. Kulintang ensembles or acoustic acts work beautifully.";
      break;
    default:
      emptyCopy =
        "We haven't curated bands or DJs for your area yet — add yours below and we'll lock them into your plan.";
  }

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="music_entertainment"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Have your band or DJ already?"
      emptyStateCopy={emptyCopy}
    />
  );
}
