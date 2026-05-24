/**
 * Card 19 Hair + Makeup · Phase 4 · Programming tier.
 *
 * Surfaces both makeup_artist + hair_stylist coarse categories — many
 * HMUA professionals in PH offer both as a single package; surfacing
 * both pools at once gives the fullest picture.
 *
 * Muslim couples get hijab-compatible vendors via the
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

export async function HairMakeupCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['makeup_artist', 'hair_stylist'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="hair_makeup"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Found your HMUA already?"
      emptyStateCopy="We haven't curated hair + makeup artists for your area yet — add yours below. Trial sessions usually happen 2–3 months before the wedding so the look is locked in time."
    />
  );
}
