/**
 * Card 08 Stylist · Phase 3 · Style + Identity tier.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Stylists
 * travel — Filipino couples regularly fly in a Manila stylist for a
 * Bohol or Boracay wedding, or a Cebu stylist for a Tagaytay one.
 * Default sort (ad_rank → review_count → avg_rating_overall) anchors on
 * portfolio + reputation first; couples pick by visual style, not km.
 *
 * Reception decor + florist coarse-categories overlap heavily — the seed's
 * `coarseCategoryFor()` routes `florist|flower|floral|bouquet` → 'florist'
 * but `decor|styling|stylist|setup|backdrop|tablescape|prop` → 'reception_decor'.
 * Surfacing both gives a fuller pool of stylist-aligned vendors.
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
  /** events.event_date · drives the availability filter. Stylists with
   *  a confirmed booking on this date render at 30% opacity with no
   *  action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['reception_decor', 'florist'] as const;

export async function StylistCard({
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
      taskId="stylist"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'stylists',
        customAddLabel: 'Already have a stylist in mind?',
        emptyStateCopy:
          "We haven't curated stylists for your area yet — search by name or add yours below. They'll inherit your finalized mood board automatically.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
