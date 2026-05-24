/**
 * Card · `dance_instructor` (order 9.8 · Phase 3 · Style + Identity tier).
 *
 * 2026-05-25 owner directive verbatim: "Lock Dance Instructor will view
 * the available dance guides in the market. sort by review."
 *
 * Wizard task `dance_instructor` was added 2026-05-24 (CLAUDE.md row · "Filipino
 * weddings routinely hire a dance instructor for the couple's first dance +
 * the parents-and-couple dance + the entourage choreography. Lessons run T-2
 * to T-3 months.") The dispatcher was missing the case · so the card was
 * falling through to PlaceholderCardBody. This file adds the real surface.
 *
 * Canonical services: BOTH first_dance_choreographer + entourage_choreographer
 * per `apps/web/lib/taxonomy.ts:379-380`. Filipino weddings routinely book one
 * or the other — sometimes both — for the first dance · parents-and-couple
 * dance · entourage entry choreography. Surfacing both canonicals as a single
 * picker lets the couple see the full pool of dance guides in their area.
 *
 * Sort: NO custom sort. `fetchWizardVendorRecommendations` default ranking is
 * `ad_rank → review_count → avg_rating_overall` (per `lib/wizard-recommendations.ts:192-194`)
 * which honors the 5-tier ladder from CLAUDE.md 2026-05-24 row 7 · Boosted
 * vendors first, then highest-review-count, then highest-rating. This satisfies
 * the owner directive "sort by review" without needing a new sort prop.
 *
 * NO distance filter — dance instructors travel routinely (same reasoning as
 * `music-entertainment-card.tsx` · they come to the couple's venue or studio).
 *
 * Cross-refs: CLAUDE.md 2026-05-23 row 6 (V1 SCOPE EXPANSION · Concierge
 * active-wizard pulled forward to V1) · CLAUDE.md 2026-05-24 row 9 (canonical
 * sequence reconciled to 45 cards · dance_instructor inserted at order 9.8) ·
 * CLAUDE.md 2026-05-24 row 11 (PlanGroup parity · `dance_instructor` plan-grid
 * cell exists and this card populates it).
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
  /** events.event_date · drives the availability filter. Choreographers
   *  with a confirmed booking on this date render at 30% opacity with no
   *  action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = [
  'first_dance_choreographer',
  'entourage_choreographer',
] as const;

export async function DanceInstructorCard({
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

  const emptyCopy =
    "We haven't curated dance instructors for your area yet — search by name or add yours below and we'll lock them into your plan.";

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="dance_instructor"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        venueSetting,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'dance instructors',
        customAddLabel: 'Have your dance instructor already?',
        emptyStateCopy: emptyCopy,
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
