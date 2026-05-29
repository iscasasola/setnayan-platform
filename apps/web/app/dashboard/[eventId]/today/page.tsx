import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WizardHero } from '../_components/wizard-hero';
import {
  WeddingEssentialsHero,
  type WeddingEssentialState,
} from '../_components/wedding-essentials-hero';
import {
  WEDDING_ESSENTIALS,
  type WeddingEssentialId,
} from '@/lib/wedding-essentials';

/**
 * Today's Focus / Wedding Essentials · per-tier rendering on the
 * /dashboard/[eventId]/today route.
 *
 * Owner directive 2026-05-29 in conversation closing CLAUDE.md "today's
 * focus is paid" reminder:
 *
 *   - PAID tier (events.concierge_status='active') · renders the full
 *     65-card guided wizard substrate via <WizardHero>. Hard-floor
 *     scheduler + religion-adaptive copy + 5-tier ranking + coordinator-
 *     scheduled meetings + everything the paid product ships.
 *
 *   - FREE DIY tier (events.concierge_status IN ('diy','trial','expired')
 *     OR NULL) · renders the new <WeddingEssentialsHero> · 7 always-
 *     visible essentials (date · venue · budget · guest list ·
 *     catering · officiant · marriage license) · brand-voice editorial
 *     register · soft upgrade nudge for Today's Focus ₱1,499 at the
 *     bottom of the surface.
 *
 * WHY single route serves both tiers (vs separate /today + /essentials
 * paths): keeps the BottomNav static (no jarring tab swaps when a couple
 * upgrades from Free to Paid) · per the conversation lock "static
 * BottomNav · same tabs for everyone · Today is meaningful for both
 * tiers". Couples who upgrade see their Today content change in place
 * rather than discovering a new route exists.
 *
 * Schema column note: V2 cutover (CLAUDE.md 2026-05-28 third row +
 * 11th row template adoption arc) renamed the product brand from
 * "Setnayan Concierge" to "Today's Focus" but kept `concierge_status`
 * as the column name to avoid 200+ file churn. The brand layer rename
 * is in copy + nav + emails; the DB column stays for backward compat.
 *
 * Data fetches: minimal · one batch with all the queries needed for
 * both branches so the per-tier branch is just a render switch. Paid
 * tier needs wizard_state + ceremony_type + venue_setting + venue
 * lat/lng + marketplaceIds. Free tier needs event_date +
 * estimated_budget_centavos + guests count + per-essential PlanGroup
 * pick counts.
 */
export default async function TodaysFocusPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch the event row with all columns either tier needs · single
  // round trip so the branch below is just a render decision.
  // Use `maybeSingle()` per the canonical guard pattern (PGRST116 "0
  // rows" should NOT throw · falls through to `notFound()` so the host
  // sees the framework 404 page · mirrors dashboard layout pattern).
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, event_date, ceremony_type, venue_setting, venue_latitude, venue_longitude, wizard_state, concierge_status, estimated_budget_centavos',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  // Per-tier branch · concierge_status='active' = paid Today's Focus.
  // Anything else (diy · trial · expired · NULL) = Free DIY Wedding
  // Essentials. The status comparison is intentionally explicit ·
  // adding new status values shouldn't accidentally unlock the paid
  // surface unless the value is named.
  const conciergeStatus = (event as { concierge_status?: string | null })
    .concierge_status;
  const showPaidWizard = conciergeStatus === 'active';

  // marketplaceIds drives the wizard's "don't recommend a vendor I've
  // already locked" filter on vendor-pick cards. Pulled from
  // event_vendors rows where the host linked a marketplace vendor
  // (marketplace_vendor_id is non-null). Off-platform / custom-added
  // vendors don't have a marketplace_vendor_id and don't affect the
  // exclusion set.
  //
  // ALSO consumed by the Free DIY tier · the per-essential status
  // counting reads event_vendors row counts grouped by category.
  const { data: vendorRows } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id, category, status')
    .eq('event_id', eventId);

  const marketplaceIds = Array.from(
    new Set(
      (vendorRows ?? [])
        .map((v) => v.marketplace_vendor_id)
        .filter((id): id is string => id !== null),
    ),
  );

  // ceremonyType + venueSetting narrowing · mirrors the type-cast
  // pattern event-home uses. The DB column allows nullable + arbitrary
  // string for legacy rows; WizardHero's prop is a narrower union of
  // the 7 canonical ceremony types per iteration 0043.
  const eventCeremonyType =
    (event as { ceremony_type?: string | null }).ceremony_type ?? null;
  const eventVenueSetting =
    (event as { venue_setting?: string | null }).venue_setting ?? null;

  if (showPaidWizard) {
    return (
      <section className="space-y-4">
        {/* No headline / breadcrumb · the wizard card body owns the
         *  page's visual hierarchy. Adding a "Today's Focus" h1 here
         *  would compete with the wizard card's own heading + create a
         *  stuttering double-title effect. The BottomNav tab label is
         *  the page's identity. */}
        <WizardHero
          eventId={eventId}
          wizardState={(event as { wizard_state?: unknown }).wizard_state}
          eventDate={event.event_date}
          ceremonyType={
            eventCeremonyType as Parameters<typeof WizardHero>[0]['ceremonyType']
          }
          venueSetting={eventVenueSetting}
          meaningfulDates={[]}
          excludeMarketplaceVendorIds={marketplaceIds}
        />
      </section>
    );
  }

  // Free DIY tier · compute per-essential status from the fetched
  // data. Three signal sources:
  //
  //   1. event row · drives 'date' + 'budget' essentials
  //   2. event_vendors rows · drives 'venue' + 'catering' + 'officiant'
  //   3. guests count · drives 'guest_list' essential
  //
  // 'marriage_license' essential stays 'empty' for V1 · the paperwork
  // tracker at /dashboard/[eventId]/documents is the canonical surface
  // but status tracking ships in a follow-up PR.
  const { count: guestCount } = await supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  const essentials = computeEssentialStates({
    eventDate: event.event_date,
    estimatedBudgetCentavos: (event as { estimated_budget_centavos?: number | null })
      .estimated_budget_centavos,
    guestCount: guestCount ?? 0,
    vendorRows: vendorRows ?? [],
  });

  return (
    <section className="space-y-4">
      <WeddingEssentialsHero eventId={eventId} essentials={essentials} />
    </section>
  );
}

/**
 * Compute per-essential status from the raw event data.
 *
 * Three signal sources mapped to the 7 essentials:
 *
 *   - `date` · event.event_date present + not null = 'done', else 'empty'.
 *     No 'in_progress' state · date is binary (set or unset).
 *
 *   - `budget` · event.estimated_budget_centavos > 0 = 'done'. NULL or
 *     0 = 'empty'. No 'in_progress' (budget is binary too · couples
 *     either set it or haven't).
 *
 *   - `venue` · counts event_vendors rows for ceremony_venue + reception_venue
 *     vendor_category values. Any LOCKED (status='contracted' OR
 *     'deposit_paid') = 'done'. Any CONSIDERING (status='considering')
 *     = 'in_progress'. Zero rows = 'empty'.
 *
 *   - `guest_list` · guestCount > 0 = 'in_progress' (couples typically
 *     keep adding throughout the runway · 'done' is hard to claim until
 *     RSVP deadline) · 0 = 'empty'.
 *
 *   - `catering` · same vendor-pick logic as venue · vendor_category =
 *     'catering'.
 *
 *   - `officiant` · same vendor-pick logic as venue · vendor_category =
 *     'officiant'.
 *
 *   - `marriage_license` · stays 'empty' for V1 · paperwork tracker
 *     status follows in a follow-up PR.
 *
 * Detail strings · short, brand-voice editorial register · concrete
 * numbers where they help ("3 considering · 1 locked") · omit when
 * the state speaks for itself.
 */
function computeEssentialStates(input: {
  eventDate: string | null;
  estimatedBudgetCentavos: number | null | undefined;
  guestCount: number;
  vendorRows: ReadonlyArray<{
    marketplace_vendor_id: string | null;
    category: string | null;
    status: string | null;
  }>;
}): WeddingEssentialState[] {
  const states: WeddingEssentialState[] = [];

  // date · binary
  states.push({
    id: 'date' as WeddingEssentialId,
    status: input.eventDate ? 'done' : 'empty',
    detail: input.eventDate
      ? new Date(input.eventDate).toLocaleDateString('en-PH', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : undefined,
  });

  // venue · couples typically have ceremony_venue + reception_venue as
  // 2 different vendor_category values. Roll both into the single
  // 'venue' essential card.
  const venueCategories = new Set([
    'religious_venue',
    'church_fees',
    'venue',
  ]);
  const venueRows = input.vendorRows.filter((v) =>
    venueCategories.has(v.category ?? ''),
  );
  states.push(rollUpVendorPick('venue', venueRows));

  // budget · binary
  const hasBudget =
    typeof input.estimatedBudgetCentavos === 'number' &&
    input.estimatedBudgetCentavos > 0;
  states.push({
    id: 'budget' as WeddingEssentialId,
    status: hasBudget ? 'done' : 'empty',
    detail: hasBudget
      ? `₱${((input.estimatedBudgetCentavos ?? 0) / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 })} set`
      : undefined,
  });

  // guest_list · 'in_progress' once any guest is added · 'done' is
  // hard to claim · keep as in_progress until couples have RSVP
  // tracking surfaces ship in follow-up.
  states.push({
    id: 'guest_list' as WeddingEssentialId,
    status: input.guestCount > 0 ? 'in_progress' : 'empty',
    detail:
      input.guestCount > 0
        ? `${input.guestCount} guest${input.guestCount === 1 ? '' : 's'} added`
        : undefined,
  });

  // catering · vendor_category = 'catering'
  const cateringRows = input.vendorRows.filter((v) => v.category === 'catering');
  states.push(rollUpVendorPick('catering', cateringRows));

  // officiant · vendor_category = 'officiant'
  const officiantRows = input.vendorRows.filter(
    (v) => v.category === 'officiant',
  );
  states.push(rollUpVendorPick('officiant', officiantRows));

  // marriage_license · status tracking ships in follow-up · stay
  // 'empty' for V1.
  states.push({
    id: 'marriage_license' as WeddingEssentialId,
    status: 'empty',
  });

  return states;
}

/**
 * Helper · rolls up event_vendors rows for a single essential into the
 * canonical (status, detail) shape.
 *
 *   - any 'contracted' / 'deposit_paid' / 'delivered' / 'complete' row
 *     = 'done'
 *   - else any 'considering' row = 'in_progress'
 *   - else 'empty'
 *
 * Detail string · "N locked · M considering" · concrete numbers.
 */
function rollUpVendorPick(
  id: WeddingEssentialId,
  rows: ReadonlyArray<{ status: string | null }>,
): WeddingEssentialState {
  const lockedStatuses = new Set([
    'contracted',
    'deposit_paid',
    'delivered',
    'complete',
  ]);
  const lockedCount = rows.filter((r) =>
    lockedStatuses.has(r.status ?? ''),
  ).length;
  const consideringCount = rows.filter(
    (r) => r.status === 'considering',
  ).length;

  if (lockedCount > 0) {
    const parts = [`${lockedCount} locked`];
    if (consideringCount > 0) parts.push(`${consideringCount} considering`);
    return {
      id,
      status: 'done',
      detail: parts.join(' · '),
    };
  }
  if (consideringCount > 0) {
    return {
      id,
      status: 'in_progress',
      detail: `${consideringCount} considering`,
    };
  }
  return { id, status: 'empty' };
}

// Silence unused import warning · WEDDING_ESSENTIALS is consumed
// transitively through the hero. Keep the import for type-checking
// future per-essential helpers.
void WEDDING_ESSENTIALS;
