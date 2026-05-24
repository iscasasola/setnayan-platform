/**
 * Card 08 Stylist · Phase 3 · Style + Identity tier.
 *
 * Reception decor + florist coarse-categories overlap heavily — the seed's
 * `coarseCategoryFor()` routes `florist|flower|floral|bouquet` → 'florist'
 * but `decor|styling|stylist|setup|backdrop|tablescape|prop` → 'reception_decor'.
 * Surfacing both gives a fuller pool of stylist-aligned vendors.
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

export async function StylistCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['reception_decor', 'florist'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="stylist"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Already have a stylist in mind?"
      emptyStateCopy="We haven't curated stylists for your area yet — add yours below and we'll lock them into your plan. They'll inherit your finalized mood board automatically."
    />
  );
}
