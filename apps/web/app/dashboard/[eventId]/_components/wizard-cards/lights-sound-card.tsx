/**
 * Card 10 Lights + Sound · Phase 3 · Style + Identity tier.
 *
 * Surfaces both lights_and_sound + led_screens coarse categories — many
 * PH wedding venues bring sound+lighting as one team and the LED wall is
 * a typical upsell from the same vendor. Filtering by both gives a
 * fuller pool than either alone.
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

export async function LightsSoundCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: ['lights_and_sound', 'led_screens'],
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 15,
  });

  return (
    <VendorPickCard
      eventId={eventId}
      taskId="lights_sound"
      recommendations={recs}
      defaultVisible={5}
      customAddLabel="Sound + lights crew already booked?"
      emptyStateCopy="We haven't curated sound + lighting teams for your area yet — add yours below. We'll wire your finalized mood-board palette into their lighting cues."
    />
  );
}
