/**
 * Card 18 Attire · Phase 4 · Programming tier.
 *
 * 2026-05-24 owner directive (PR b · stage 1): expanded canonical-services
 * pool from 2 (gown_designer + suit_designer) to 6 (bridal_gown ·
 * groom_suit · bridal_shoes · groom_shoes · entourage_attire ·
 * parents_attire) per migration 20260621000000. Verbatim:
 *
 *   "Attire should grow on Bridal Gown, Grooms Suit, Bridal Shoes,
 *    Grooms Shoes, possible add Entourage and Parents?"
 *
 * STAGE 1 (this PR): single-grid view surfacing vendors across all 6
 * canonicals · Filipino couples see the full attire pool (gowns, suits,
 * shoes, entourage outfits, parents' outfits) interleaved by review count
 * + verification + ad rank · still single-pick (locking one vendor
 * advances the wizard).
 *
 * STAGE 2 (follow-up PR b.2): multi-pick UX with 6 sub-tabs · custom lock
 * action that doesn't auto-advance the wizard · "Mark attire complete" CTA
 * when ≥2 sub-categories locked. Mirrors the Card 14 Photobooths + Booths
 * multi-pick pattern (see `photobooths-booths-card-client.tsx`).
 *
 * The legacy canonicals (`gown_designer` · `suit_designer`) stay in the
 * vendor_category enum as deprecated · the migration migrated existing
 * event_vendors + vendor_profiles rows to the new canonical names.
 *
 * Filter approach: NO distance filter. Designers + couture boutiques are
 * picked by portfolio + fit-session quality, not proximity — couples
 * regularly fit at NCR ateliers for provincial weddings. Default sort
 * (ad_rank → review_count → avg_rating_overall) anchors on portfolio +
 * reputation per the [Vendor_Taxonomy_V1_Master.md § 10 spec lock]
 * (creations pattern · reviews-first filter approach).
 *
 * Muslim couples get modest-attire vendors via the
 * compatible_ceremony_types[] filter; Cultural weddings get traditional
 * Filipiniana / tribal attire designers if tagged.
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
  /** events.event_date · drives the availability filter. Attire designers
   *  with a confirmed booking on this date render at 30% opacity with
   *  no action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

// 2026-05-24 PR (b) stage 1 · expanded pool to all 6 attire sub-categories
// per owner directive. Migration 20260621000000 added the 4 new canonicals
// (bridal_shoes / groom_shoes / entourage_attire / parents_attire) and
// renamed the existing 2 (gown_designer → bridal_gown, suit_designer →
// groom_suit). Existing event_vendors + vendor_profiles rows were
// data-migrated to the new names; the legacy names stay in the enum as
// deprecated. PR (b) stage 2 will split this into 6 sub-tab views with
// independent locking.
const CANONICAL_SERVICES = [
  'bridal_gown',
  'groom_suit',
  'bridal_shoes',
  'groom_shoes',
  'entourage_attire',
  'parents_attire',
] as const;

export async function AttireCard({
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

  let emptyCopy: string;
  switch (ceremonyType) {
    case 'muslim':
      emptyCopy =
        "We haven't curated modest-attire designers for your area yet — search by name or add yours below. Many Muslim couples work with a designer who handles both the bride's modest gown and the groom's barong / formalwear.";
      break;
    case 'cultural':
      emptyCopy =
        "We haven't curated traditional Filipiniana or tribal-attire designers for your area yet — search by name or add yours below.";
      break;
    default:
      emptyCopy =
        "We haven't curated attire designers for your area yet — search by name or add yours below and we'll lock them into your plan.";
  }

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="attire"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'attire designers',
        customAddLabel: 'Already booked your designer or rental?',
        emptyStateCopy: emptyCopy,
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
