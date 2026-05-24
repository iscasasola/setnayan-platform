/**
 * Card 22 Cake · Phase 5 · Late additions tier.
 *
 * Wedding cake + dessert station vendors share the cake_maker coarse
 * category in the demo-vendor seed's coarseCategoryFor() heuristic.
 * Muslim couples get halal-ingredients vendors via the
 * compatible_ceremony_types[] filter.
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

export async function CakeCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['cake_maker'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="cake"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Cake-maker already booked?"
      emptyStateCopy="We haven't curated cake makers for your area yet — add yours below. Most accept design briefs from your finalized mood board palette."
    />
  );
}
