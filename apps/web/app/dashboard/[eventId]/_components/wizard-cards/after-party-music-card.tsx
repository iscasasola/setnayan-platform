/**
 * Card · After-party DJ · Phase 3 · Style + Identity tier.
 *
 * 2026-05-25 owner directive ("finding after party band/dj is gone"):
 * dedicated wizard card for the after-party DJ who carries the
 * late-night dance floor block once the formal reception ends. PH
 * weddings increasingly run a separate after-party block (often at the
 * same venue but with a distinct vibe — high-energy dance music,
 * informal seating, drinks-only catering) and couples typically want a
 * separate DJ for that block.
 *
 * Why narrow the filter to `dj` only (not the full music_entertainment
 * canonical set): the after-party is overwhelmingly DJ-driven · live
 * bands rarely cover both the formal reception program + the late-night
 * dance block (different gear, different setlist, longer call time).
 * Acoustic acts + cultural ensembles + wedding singers also wouldn't
 * fit the after-party vibe. Surfacing the same vendor list as Card 12
 * Music + Entertainment would defeat the purpose of a dedicated card.
 *
 * Sort: reviews-first (default `ad_rank → review_count → avg_rating_overall`
 * via fetchWizardVendorRecommendations). No distance filter — DJs
 * travel routinely across PH metro areas.
 *
 * Soft prereq music_entertainment per wizard.ts: hosts lock the primary
 * band/DJ for the reception program first, then book the after-party DJ
 * once the program timeline is clear (informs the after-party start
 * time + duration the DJ quotes against).
 *
 * Cross-references:
 *   - CLAUDE.md 2026-05-25 row "Setnayan Concierge wizard pilot polish"
 *     + AskUserQuestion "Both — seed + new card"
 *   - 20260521040000_iteration_0044_v11_full_taxonomy_seeds.sql — `dj`
 *     canonical_service definition
 *   - Sibling music-entertainment-card.tsx (Card 12) — primary band/DJ
 *     for the formal reception program
 *   - host-mc-card.tsx (Card 13) — template for the no-distance-filter
 *     reviews-first vendor-pick card pattern this card follows
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
  /** events.event_date · drives the availability filter. DJs with a
   *  confirmed booking on this date render at 30% opacity with no
   *  action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

// After-party block is DJ-driven · narrow filter avoids duplicating
// Card 12's recommendation set. Real v11 canonical from
// 20260521040000_iteration_0044_v11_full_taxonomy_seeds.
const CANONICAL_SERVICES = ['dj'] as const;

export async function AfterPartyMusicCard({
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
      matchEventId: eventId,
      limit: 100,
    }),
    fetchBookedMarketplaceVendorIdsForDate(admin, eventId, eventDate),
  ]);

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="after_party_music"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'after-party DJs',
        customAddLabel: 'Have an after-party DJ already?',
        emptyStateCopy:
          "We haven't curated after-party DJs for your area yet — search by name or add yours below. The right DJ keeps the dance floor moving long past the formal program.",
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
