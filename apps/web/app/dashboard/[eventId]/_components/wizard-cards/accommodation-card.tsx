/**
 * Card 23 Accommodation · Phase 5 · Late additions tier.
 *
 * Hotels + resorts + AirBnB-style hosts for out-of-town guests. The
 * 'accommodation' vendor_category was added per Task #42 (2026-05).
 * Filters by event's venue_setting so destination weddings (Tagaytay /
 * Boracay / Cebu / Palawan) see accommodation near the venue.
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

export async function AccommodationCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['accommodation'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="accommodation"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Have a hotel block already?"
      emptyStateCopy="We haven't curated accommodation for your area yet — add yours below. Destination weddings usually reserve a block of rooms for out-of-town guests; we'll surface the link on your invitation page."
    />
  );
}
