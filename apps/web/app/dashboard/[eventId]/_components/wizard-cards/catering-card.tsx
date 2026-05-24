/**
 * Card 07 Catering · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * Server component · fetches top-15 catering recommendations from
 * vendor_market_stats with services && ['catering']. Filters by event's
 * ceremony_type so INC weddings see alcohol-free / kosher-style options,
 * Muslim see halal-certified, etc. — the
 * vendor_profiles.compatible_ceremony_types[] gating handles the broad
 * faith-fit check; per-attribute deep filters (halal_certified · INC-
 * friendly · etc. from iteration 0044 shared_attribute_groups) ship in
 * V1.x once the catering attribute editor lands.
 *
 * Crew-meal mention is INTENTIONALLY in the empty-state copy — Filipino
 * couples often forget the per-vendor crew-meal allocation at booking
 * time and discover the gap weeks before the wedding. Surfacing the
 * reminder here matches the 0007 Budget iteration's 3-line model
 * (Package · Crew Meal · Transportation).
 *
 * Card kind: vendor_pick.
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

export async function CateringCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['catering'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="catering"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Found your caterer already?"
      emptyStateCopy="We haven't curated caterers for your area + ceremony yet — add yours below. You can capture per-head pricing and crew meals on the budget page after."
    />
  );
}
