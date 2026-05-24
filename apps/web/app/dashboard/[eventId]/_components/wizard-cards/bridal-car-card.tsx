/**
 * Card 24 Bridal Car · Phase 5 · Late additions tier.
 *
 * Bridal car + guest shuttle + entourage transport all share the
 * 'transportation' coarse category in the demo-vendor seed. The host
 * typically books one combined transportation vendor for the wedding —
 * this card surfaces both bridal-car-only specialists and broader
 * transport teams.
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

export async function BridalCarCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['transportation'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="bridal_car"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Family's lending a car? Add it here."
      emptyStateCopy="We haven't curated bridal-car services for your area yet — add yours below. Many Filipino couples borrow from family; you can lock that here too."
    />
  );
}
