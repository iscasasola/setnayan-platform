/**
 * Card 20.7 Invitations & Stationery · Phase 3 · Programming tier.
 *
 * Added 2026-05-24 to align Today's Focus + Parallel Work Map + Your Plan
 * grid surfaces. The Plan grid already had an invitations_stationery cell
 * tied to VendorCategory='invitations_stationery', but no wizard card
 * pointed at it. Card 24 deploy_invitation is the action of sending —
 * this card is the vendor lock that comes before.
 *
 * Pattern: vendor_pick · VendorPickGridCard · default 5-tier sort. No
 * distance filter — stationery vendors ship digital proofs nationwide;
 * portfolio + style match matter more than proximity.
 *
 * Prereq: finalize_entourage — entourage names must be locked before
 * stationery design so place cards + entourage cards land the right names.
 * Lock vendor → couple shares finalized sponsor + entourage list →
 * vendor designs and proofs → couple approves → printer runs → couple
 * deploys via Card 24.
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

const CANONICAL_SERVICES = ['invitations_stationery'] as const;

export async function InvitationsStationeryCard({
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
      taskId="invitations_stationery"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'invitation & stationery designers',
        customAddLabel: 'Already have a stationer in mind?',
        emptyStateCopy:
          "We haven't curated invitation designers for your area yet — search by name or add yours below. They'll design your save-the-date, main invitation, entourage cards, place cards, and menus.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
