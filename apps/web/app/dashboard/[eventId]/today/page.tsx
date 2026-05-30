import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WizardHero } from '../_components/wizard-hero';

/**
 * Today's Focus · /dashboard/[eventId]/today route.
 *
 * Owner directive 2026-05-30 (CLAUDE.md DIY/Paid wizard sequence
 * bifurcation lock): BOTH the Free DIY tier AND the Paid Today's Focus
 * tier render the same <WizardHero> · the bifurcation happens INSIDE
 * the hero via the `conciergeStatus` prop:
 *
 *   - PAID tier (events.concierge_status='active' OR 'trial') · the
 *     hero walks WIZARD_TASKS_PAID (full 65-card sequence).
 *
 *   - Free DIY tier (events.concierge_status IN ('diy','expired') OR
 *     NULL) · the hero walks WIZARD_TASKS_DIY (9-card Foundation + any
 *     dynamic `custom_<canonical>` tasks the host has spawned via the
 *     Add A Category card).
 *
 * Supersedes the prior <WeddingEssentialsHero> 7-essentials surface
 * that was DIY-only · the 9-card wizard surface gives DIY couples
 * actionable inline-completion across the same wizard substrate the
 * Paid couples use, without paywalling the structure of the planning
 * work itself. The ₱1,499 paid tier upgrade still surfaces as a soft
 * nudge inside the wizard chrome (managed by WizardHero itself, not
 * here).
 *
 * WHY single route serves both tiers (vs separate /today + /essentials
 * paths): keeps the BottomNav static (no jarring tab swaps when a
 * couple upgrades from Free to Paid) · per the prior 2026-05-29
 * conversation lock "static BottomNav · same tabs for everyone ·
 * Today is meaningful for both tiers". Couples who upgrade see their
 * Today content change in place rather than discovering a new route
 * exists.
 *
 * Schema column note: V2 cutover (CLAUDE.md 2026-05-28 third row +
 * 11th row template adoption arc) renamed the product brand from
 * "Setnayan Concierge" to "Today's Focus" but kept `concierge_status`
 * as the column name to avoid 200+ file churn. The brand layer rename
 * is in copy + nav + emails; the DB column stays for backward compat.
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

  // Fetch the event row with all columns WizardHero needs. The DIY
  // tier wizard cards consume estimated_pax (Card 02) +
  // estimated_budget_centavos (Card 03) + wizard_state for
  // add_a_category picks (Card 09). Paid tier ignores those fields ·
  // doesn't matter that they're always SELECTed · Postgres + Supabase
  // round-trip cost is identical for 8 columns vs 11.
  //
  // Use `maybeSingle()` per the canonical guard pattern (PGRST116 "0
  // rows" should NOT throw · falls through to `notFound()` so the host
  // sees the framework 404 page · mirrors dashboard layout pattern).
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, event_date, ceremony_type, venue_setting, venue_latitude, venue_longitude, wizard_state, concierge_status, estimated_budget_centavos, estimated_pax',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  // marketplaceIds drives the wizard's "don't recommend a vendor I've
  // already locked" filter on vendor-pick cards. Pulled from
  // event_vendors rows where the host linked a marketplace vendor
  // (marketplace_vendor_id is non-null). Off-platform / custom-added
  // vendors don't have a marketplace_vendor_id and don't affect the
  // exclusion set.
  const { data: vendorRows } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
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
  const conciergeStatus =
    ((event as { concierge_status?: string | null }).concierge_status as
      | 'diy'
      | 'trial'
      | 'active'
      | 'expired'
      | null
      | undefined) ?? null;
  const estimatedPax =
    (event as { estimated_pax?: number | null }).estimated_pax ?? null;
  const estimatedBudgetCentavos =
    (event as { estimated_budget_centavos?: number | null })
      .estimated_budget_centavos ?? null;

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
        conciergeStatus={conciergeStatus}
        estimatedPax={estimatedPax}
        estimatedBudgetCentavos={estimatedBudgetCentavos}
      />
    </section>
  );
}
