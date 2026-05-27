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
 * 2026-05-28 PR (b) stage 2 / PR (g) · sub-tabs UX shipped. Server fetches
 * 6 collections in parallel (one per sub-canonical) and hands them to
 * `<AttireSubTabsClient>` which renders pills + the active
 * VendorPickGridCard. Single-pick semantics preserved · locking ANY
 * vendor advances the wizard (existing behavior). Hosts who want to
 * lock multiple sub-categories re-engage with the card after settle —
 * full multi-pick semantics (custom lock that doesn't advance +
 * "Mark complete" CTA · mirrors Card 14 Photobooths) stay V1.x scope.
 *
 * The legacy canonicals (`gown_designer` · `suit_designer`) stay in the
 * vendor_category enum as deprecated · migration 20260621000000 data-
 * migrated existing event_vendors + vendor_profiles rows to the new
 * canonical names.
 *
 * Filter approach: NO distance filter. Designers + couture boutiques are
 * picked by portfolio + fit-session quality, not proximity — couples
 * regularly fit at NCR ateliers for provincial weddings. Default sort
 * (ad_rank → review_count → avg_rating_overall) anchors on portfolio +
 * reputation per the Vendor_Taxonomy_V1_Master.md § 10 spec lock
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
  type WizardVendorRec,
} from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { AttireSubTabsClient } from './attire-card-client';

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

// 6 attire sub-canonicals · each becomes its own tab. The server fetches
// one collection per canonical so the client can swap tabs without
// re-fetching.
const ATTIRE_SUB_CANONICALS = [
  'bridal_gown',
  'groom_suit',
  'bridal_shoes',
  'groom_shoes',
  'entourage_attire',
  'parents_attire',
] as const;

type SubCanonical = (typeof ATTIRE_SUB_CANONICALS)[number];

export async function AttireCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
  eventDate,
}: Props) {
  const admin = createAdminClient();

  // Parallel fetch · 6 per-canonical recommendation collections + the
  // booked-on-event-date availability filter. Per-canonical limit is 50
  // (6 × 50 = 300 total recs is comfortable headroom for any region).
  const subRecs = await Promise.all(
    ATTIRE_SUB_CANONICALS.map((canonical) =>
      fetchWizardVendorRecommendations(admin, {
        canonicalServices: [canonical],
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
        limit: 50,
      }),
    ),
  );
  const bookedIds = await fetchBookedMarketplaceVendorIdsForDate(
    admin,
    eventId,
    eventDate,
  );

  // Position-aligned with ATTIRE_SUB_CANONICALS so the indices map cleanly.
  // `?? []` makes the index narrowing TS-friendly under
  // `noUncheckedIndexedAccess` — Promise.all preserves array length so
  // every slot is guaranteed populated at runtime.
  const recsBySubKey: Record<SubCanonical, ReadonlyArray<WizardVendorRec>> = {
    bridal_gown: subRecs[0] ?? [],
    groom_suit: subRecs[1] ?? [],
    bridal_shoes: subRecs[2] ?? [],
    groom_shoes: subRecs[3] ?? [],
    entourage_attire: subRecs[4] ?? [],
    parents_attire: subRecs[5] ?? [],
  };

  // Locale-adaptive empty-state copy resolved here on the server so the
  // ceremony-type nuance (Muslim modest-attire · Cultural Filipiniana)
  // travels with the "All attire" tab default.
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
    <AttireSubTabsClient
      eventId={eventId}
      ceremonyType={ceremonyType}
      venueSetting={venueSetting}
      excludeMarketplaceIds={excludeMarketplaceIds}
      recsBySubKey={recsBySubKey}
      bookedMarketplaceVendorIds={bookedIds}
      emptyStateCopy={emptyCopy}
    />
  );
}
