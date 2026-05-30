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

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchWizardVendorRecommendations,
  fetchBookedMarketplaceVendorIdsForDate,
} from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import { VendorPickGridCard } from './vendor-pick-grid-card';
import {
  OfficiantAutoResolvedPanel,
  type OfficiantAutoResolutionFraming,
} from './officiant-auto-resolved-panel';

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

  // 2026-05-30 owner directive · Card 04 Officiant auto-resolve · per
  // CLAUDE.md 2026-05-29 "Vendor Discovery Architecture" row item (1).
  // When the host's locked ceremony venue implicitly handles the
  // officiant role (Catholic+parish · Civil+civil_registrar · INC+chapel),
  // skip the VendorPickGridCard surface and render
  // OfficiantAutoResolvedPanel instead · provides framing-specific
  // copy + Mark-Done CTA + "Use a different officiant" override.
  // Other ceremony × venue combinations fall through to the standard
  // picker grid below.
  //
  // Gate: only auto-resolve when no existing officiant row exists ·
  // couples who already picked or considered an officiant see their
  // picks via VendorPickGridCard (auto-resolve never overrides an
  // explicit choice).
  //
  // Mirrors the DIY tier auto-resolve helper in
  // apps/web/app/dashboard/[eventId]/today/page.tsx (PR #682) ·
  // duplicates the lookup logic intentionally to keep this PR's blast
  // radius scoped to the wizard surface. Future refactor can extract
  // a shared lib helper if a third surface needs the same logic.
  const autoResolution = await computeOfficiantAutoResolution(
    admin,
    eventId,
    ceremonyType,
  );
  if (autoResolution) {
    return (
      <OfficiantAutoResolvedPanel
        eventId={eventId}
        framing={autoResolution.framing}
        providerName={autoResolution.providerName}
        overrideHref="/vendors?folder=ceremony"
      />
    );
  }

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

/**
 * Detect whether the host's locked ceremony venue implicitly handles
 * the officiant role.
 *
 * Three framings qualify per CLAUDE.md 2026-05-29 "Vendor Discovery
 * Architecture" row item (1):
 *
 *   - Catholic · locked religious_venue whose compatible_ceremony_types
 *     includes 'catholic' (parish church) · framing='catholic_parish'.
 *   - INC · locked religious_venue whose compatible_ceremony_types
 *     includes 'inc' (INC chapel) · framing='inc_chapel'.
 *   - Civil · locked venue with venue_type='civil_registrar' (admin-
 *     seeded city hall) OR compatible_venue_settings includes
 *     'civil_registrar' (marketplace-listed registrar) ·
 *     framing='civil_registrar'.
 *
 * Falls through to null (= standard vendor picker) for:
 *
 *   - Ceremony types other than catholic/civil/inc.
 *   - Events with no locked venue.
 *   - Events where the host has already picked or considered a separate
 *     officiant (event_vendors row with category='officiant' exists) ·
 *     explicit picks always win over auto-resolution.
 *   - Locked venues whose compat metadata doesn't match the host's
 *     ceremony_type (e.g., Catholic+banquet-hall destination).
 *
 * Mirrors the DIY tier helper at
 * apps/web/app/dashboard/[eventId]/today/page.tsx (PR #682). Duplicated
 * intentionally to keep this PR scoped to the wizard surface · future
 * refactor can extract a shared lib helper if a third surface needs
 * the same logic.
 */
async function computeOfficiantAutoResolution(
  admin: SupabaseClient,
  eventId: string,
  ceremonyType: string | null,
): Promise<{
  framing: OfficiantAutoResolutionFraming;
  providerName: string;
} | null> {
  if (!ceremonyType || !['catholic', 'civil', 'inc'].includes(ceremonyType)) {
    return null;
  }

  // Fetch event_vendors for this event · need both the gate (existing
  // officiant row blocks auto-resolve) AND the locked venue candidates.
  const { data: vendorRows } = await admin
    .from('event_vendors')
    .select('marketplace_vendor_id, source_venue_directory_id, category, status')
    .eq('event_id', eventId);
  if (!vendorRows) return null;

  // Gate · don't override explicit officiant picks.
  const hasOfficiantRow = vendorRows.some((v) => v.category === 'officiant');
  if (hasOfficiantRow) return null;

  // Same locked-statuses + venue categories as the DIY tier helper for
  // consistency · couple's locked venue is the anchor.
  const lockedStatuses = new Set([
    'contracted',
    'deposit_paid',
    'delivered',
    'complete',
  ]);
  const venueCategories = new Set(['religious_venue', 'venue']);
  const candidates = vendorRows.filter(
    (v) =>
      venueCategories.has(v.category ?? '') &&
      lockedStatuses.has(v.status ?? ''),
  );
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    let providerName: string | null = null;
    let compatibleTypes: ReadonlyArray<string> = [];
    let isCivilRegistrar = false;

    if (candidate.source_venue_directory_id) {
      const { data } = await admin
        .from('venue_directory')
        .select('name, compatible_ceremony_types, venue_type')
        .eq('venue_directory_id', candidate.source_venue_directory_id)
        .maybeSingle();
      if (data) {
        const row = data as {
          name?: string | null;
          compatible_ceremony_types?: ReadonlyArray<string> | null;
          venue_type?: string | null;
        };
        providerName = row.name ?? null;
        compatibleTypes = row.compatible_ceremony_types ?? [];
        isCivilRegistrar = row.venue_type === 'civil_registrar';
      }
    } else if (candidate.marketplace_vendor_id) {
      const { data } = await admin
        .from('vendor_profiles')
        .select(
          'business_name, compatible_ceremony_types, compatible_venue_settings',
        )
        .eq('vendor_profile_id', candidate.marketplace_vendor_id)
        .maybeSingle();
      if (data) {
        const row = data as {
          business_name?: string | null;
          compatible_ceremony_types?: ReadonlyArray<string> | null;
          compatible_venue_settings?: ReadonlyArray<string> | null;
        };
        providerName = row.business_name ?? null;
        compatibleTypes = row.compatible_ceremony_types ?? [];
        isCivilRegistrar = (row.compatible_venue_settings ?? []).includes(
          'civil_registrar',
        );
      }
    }

    if (!providerName) continue;

    if (ceremonyType === 'catholic' && compatibleTypes.includes('catholic')) {
      return { framing: 'catholic_parish', providerName };
    }
    if (ceremonyType === 'inc' && compatibleTypes.includes('inc')) {
      return { framing: 'inc_chapel', providerName };
    }
    if (ceremonyType === 'civil' && isCivilRegistrar) {
      return { framing: 'civil_registrar', providerName };
    }
  }

  return null;
}
