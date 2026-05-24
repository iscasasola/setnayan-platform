/**
 * Card 04 Officiant · Phase 2 of iteration 0016 Concierge Active Wizard.
 *
 * 2026-05-24 owner directive: migrated from the legacy list VendorPickCard
 * to the visual VendorPickGridCard with NO distance filter. Officiants
 * travel — Filipino couples routinely fly in their parish priest, a
 * family-friend judge, or a personal pastor / imam from out of town.
 * Default sort prioritises ad_rank → review_count → avg_rating_overall;
 * that's the right anchor for picking a celebrant by trust + portfolio
 * rather than proximity.
 *
 * Cross-iteration linkage with venue_directory (per PR #24 + #309): many
 * Catholic couples discover their officiant THROUGH their church (parish
 * priest, parish secretary's assigned celebrant). When the host has
 * already locked a religious_venue with a linked priest list, the
 * wizard SHOULD surface those linked officiants first. V1 scope of this
 * card defers that linkage to V1.x — the recommendations are pulled from
 * vendor_market_stats only, plus the [Add custom vendor] form for hosts
 * who already know their officiant's name (e.g., "Fr. Tito Casasola" /
 * "Judge Maria Cruz") without going through Setnayan booking.
 *
 * Booked IDs (per fetchBookedMarketplaceVendorIdsForDate) render the
 * affected vendor cards at 30% opacity with no action buttons — same
 * unavailability treatment as Cards 02 / 03.
 *
 * Card kind: vendor_pick (per WIZARD_TASKS in lib/wizard.ts).
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
  /** Accepted for API symmetry but INTENTIONALLY UNUSED · officiants
   *  travel; an event's reception venue type doesn't gate which
   *  priest / minister / imam / judge a couple can engage. See the
   *  fetch call below for the full rationale (same rule as
   *  ceremony-venue-card.tsx · sibling 2026-05-24 fix). */
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
  /** events.event_date · drives the availability filter. Officiants with
   *  a confirmed booking on this date render at 30% opacity with no
   *  action buttons. NULL = no availability check applied. */
  eventDate: string | null;
};

const CANONICAL_SERVICES = ['officiant'] as const;

export async function OfficiantCard({
  eventId,
  ceremonyType,
  // venueSetting deliberately destructured-then-ignored · see Props
  // doc + fetch comment for the why.
  excludeMarketplaceIds,
  eventDate,
}: Props) {
  const admin = createAdminClient();
  // Limit bumped 15 → 100 so the grid's 5-row × 1-5-col pagination has
  // multi-page depth as marketplace inventory grows.
  //
  // venueSetting deliberately passed as NULL · 2026-05-24 defensive
  // fix paired with ceremony-venue-card.tsx. `events.venue_setting`
  // is the host's RECEPTION venue type — it has no business gating
  // officiant recommendations. Today's seed marks all 40 officiants
  // compatible with every venue_setting, so this doesn't change
  // current behaviour; but if future seeds narrow the tags (as the
  // religious-venue seed did, breaking Card 03), Card 04 must not
  // inherit the same trap.
  const [recs, bookedIds] = await Promise.all([
    fetchWizardVendorRecommendations(admin, {
      canonicalServices: CANONICAL_SERVICES,
      ceremonyType,
      venueSetting: null,
      excludeVendorIds: excludeMarketplaceIds,
      limit: 100,
    }),
    fetchBookedMarketplaceVendorIdsForDate(admin, eventId, eventDate),
  ]);

  // Faith-specific empty-state framing so the brand voice matches who's
  // reading. Brand voice per [[feedback_setnayan_no_dev_text_post_launch]].
  let emptyCopy: string;
  switch (ceremonyType) {
    case 'catholic':
      emptyCopy =
        'Most Catholic couples book their parish priest directly — add their name below and we’ll lock them into your plan.';
      break;
    case 'civil':
      emptyCopy =
        'For civil ceremonies, your officiant is typically a judge or registrar — add their name below.';
      break;
    case 'muslim':
      emptyCopy =
        "Add your imam below — we'll lock them into your plan with the rest of your team.";
      break;
    case 'inc':
      emptyCopy =
        "Add your INC minister below — we'll lock them into your plan.";
      break;
    case 'christian':
      emptyCopy =
        "Add your pastor below — we'll lock them into your plan.";
      break;
    default:
      emptyCopy =
        "We haven't curated officiants for your area yet — search by name or add yours below and we'll lock them into your plan.";
  }

  return (
    <VendorPickGridCard
      eventId={eventId}
      taskId="officiant"
      initialRecommendations={recs}
      searchContext={{
        canonicalServices: CANONICAL_SERVICES,
        ceremonyType,
        // NULL matches the fetch above · see comment up there.
        venueSetting: null,
        excludeVendorIds: excludeMarketplaceIds,
      }}
      copy={{
        pluralNoun: 'officiants',
        customAddLabel: 'Already have someone in mind?',
        emptyStateCopy: emptyCopy,
      }}
      bookedMarketplaceVendorIds={bookedIds}
    />
  );
}
