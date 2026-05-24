/**
 * Card 4.2 Coordinator · Phase 1 · Foundation tier.
 *
 * Added 2026-05-24 to align Today's Focus + Parallel Work Map + Your Plan
 * grid surfaces. The Plan grid already had a coordinator cell tied to
 * VendorCategory='planner_coordinator', but no wizard card pointed at it.
 * This card closes the alignment so couples can lock their coordinator via
 * the guided wizard flow same as every other foundation vendor.
 *
 * Pattern: vendor_pick · VendorPickGridCard · default 5-tier sort
 * (recommended-by-venue → offered-by-locked → boosted → top-rated →
 * nearest). No distance filter — coordinators travel routinely across
 * cities + provinces; reviews + portfolio + interleaved meeting capability
 * matter more than proximity.
 *
 * Coordinator-scheduled meetings interleave per CLAUDE.md 2026-05-24 row 1:
 * once locked, coordinator can inject site visits + sponsor meetings + food
 * tastings into the wizard sequence as event_schedule_blocks with
 * source='coordinator_meeting'. Lock this card early — coordinator helps
 * ratify the rest of the timeline.
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

const CANONICAL_SERVICES = ['planner_coordinator'] as const;

export async function CoordinatorCard({
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
      taskId="coordinator"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'wedding coordinators',
        customAddLabel: 'Already have a coordinator in mind?',
        emptyStateCopy:
          "We haven't curated coordinators for your area yet — search by name or add yours below. Once locked they can schedule site visits + tastings as you go.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
