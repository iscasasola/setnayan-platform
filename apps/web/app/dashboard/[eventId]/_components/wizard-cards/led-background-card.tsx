/**
 * Card 10.5 LED Background · Phase 2 · Style + Identity tier.
 *
 * Added 2026-05-24 to align Today's Focus + Parallel Work Map + Your Plan
 * grid surfaces. The Plan grid already had a led_background cell tied to
 * VendorCategory='led_screens', but no wizard card pointed at it. This
 * card surfaces LED-screen rental vendors as a guided wizard flow.
 *
 * Separate from iteration 0005 LED Background Maker which is the offline
 * USB template upload flow. This card is the vendor-pick precursor —
 * lock the LED-rental vendor first, then upload the template via 0005's
 * surface a week before the wedding.
 *
 * Pattern: vendor_pick · VendorPickGridCard · default 5-tier sort.
 * Distance filter NOT applied — LED rental vendors deliver setups across
 * regions on event day; portfolio + capability matter more than proximity.
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
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['led_screens'] as const;

export async function LedBackgroundCard({
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
      taskId="led_background"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'LED background vendors',
        customAddLabel: 'Already have an LED rental in mind?',
        emptyStateCopy:
          "We haven't curated LED background vendors for your area yet — search by name or add yours below. The template uploads via our offline USB pipeline a week before.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
