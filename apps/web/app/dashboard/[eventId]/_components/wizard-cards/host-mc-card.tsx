/**
 * Card 13 Host / MC · Phase 3 · Style + Identity tier.
 *
 * Dedicated card for the emcee role separate from Card 12 Music. PH
 * weddings typically book a professional MC distinct from the band — the
 * MC drives the timeline (program flow · sponsor introductions ·
 * traditional rites · games) while the band/DJ handles music. Same coarse
 * category (host_emcee) but standalone task.
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

export async function HostMcCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['host_emcee'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="host_mc"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Already have an MC in mind?"
      emptyStateCopy="We haven't curated hosts + emcees for your area yet — add yours below. We'll share your finalized program timeline with them so they arrive prepared."
    />
  );
}
