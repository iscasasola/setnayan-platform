/**
 * Card 22b Rings · Phase 5 · Late additions tier.
 *
 * 2026-05-24 owner directive ("where is the ring?") · adds the rings
 * canonical_service to the wizard sequence between Card 22 Cake and
 * Card 23 Accommodation. Reviews-first filter (no distance, no
 * city/region cascade) because Filipino ring jewelers typically operate
 * online + showroom-by-appointment + ship nationwide — the right vendor
 * is found via portfolio + reviews, not proximity to the reception.
 *
 * Pattern A creations per the 2026-05-24 row "Vendor presentation
 * pattern locked" + migration 20260623000000 backfill that classified
 * `rings` as 'creations' (jewelers post wedding band sets + engagement
 * ring designs as portfolio cards). Tile renders as 2×2 collage of
 * vendor_services.primary_photo_r2_key photos automatically via the
 * shared <TilePhoto> primitive shipped in PR #506.
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
  /** events.event_date · drives availability filter. Ring jewelers rarely
   *  hit the same-date booked conflict (deliverable not on-site) but the
   *  filter still applies for safety. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['rings'] as const;

export async function RingsCard({
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

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="rings"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'ring jewelers',
        customAddLabel: 'Jeweler already chosen?',
        emptyStateCopy:
          "We haven't curated ring jewelers for your area yet — search by name or add yours below. Most jewelers ship nationwide, so distance rarely matters.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
