import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveEventFeeGate } from '@/lib/vendor-event-fee-access.server';
import { EventLockedPage } from '@/app/vendor-dashboard/_components/event-locked-by-fee';
import { vendorClientSurfaceHref } from '@/lib/vendor-client-return';
import { isRelationshipWorkspaceEnabled } from '@/lib/relationship-workspace-flag';
import { crewMealLines, crewMealTotal } from '@/lib/crew-meals';
import { partReadOutcome } from '@/lib/vendor-part-read';
import { readTheirEventName } from '@/app/vendor-dashboard/_components/set-two/their-event-line';
import { ProductionSheetBody, ProductionSheetReadFailed } from './production-sheet-body';
import type { Metrics, PortionRule } from './production-sheet-model';

export const metadata = { title: 'Production Sheet · Supplier' };

/**
 * Caterer Production Sheet — Vendor Portal data-link program ②
 * (corpus 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 2).
 *
 * Live RSVP metrics (counts only — guest PII never crosses) × the vendor's
 * own per-head portion rules = deterministic ingredient totals. Setnayan
 * never invents quantities; every number traces to a rule the vendor wrote
 * and a count the couple's guest list produced. Food-relevant categories
 * only — the RPC enforces the same gate as the Brief's dietary section.
 */


type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ rule?: string }>;
};

export default async function ProductionSheetPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // ── THE BOOKING FEE UNLOCKS THE EVENT (owner, 2026-09-20) ────────────────
  // A per-event workroom is item 1/5/6/7 of the ruling. Flag OFF ⇒ the stage is
  // always 'unlocked' and this is a no-op. Flag ON and the fee unsettled ⇒ a
  // PAGE that says the amount, the due date and where to pay — never a redirect
  // and never a 404.
  const feeGate = await resolveEventFeeGate(profile.vendor_profile_id, eventId);
  if (feeGate.stage !== 'unlocked') {
    return <EventLockedPage eventId={eventId} gate={feeGate} />;
  }

  // Booked + food-category gates live in the RPC (not_booked · not_food_relevant · event_not_found …): an answer, and
  // the Brief is the right place for it, as always. A read that did not answer is SAID — every number on the sheet
  // comes from it, so none is shown (supplier pages set two, Honest state · new) — never a silent bounce to the brief.
  const [{ data, error }, eventName] = await Promise.all([
    supabase.rpc('get_vendor_catering_metrics', { p_event_id: eventId }),
    readTheirEventName(supabase, eventId),
  ]);
  const countsRead = partReadOutcome(error, data);
  if (countsRead === 'failed') {
    logQueryError('VendorProductionSheet.metrics', error!, { eventId }, 'graceful_degrade');
    return <ProductionSheetReadFailed eventId={eventId} eventName={eventName} />;
  }
  if (countsRead === 'gate') redirect(vendorClientSurfaceHref(eventId, 'brief', { shellOn: isRelationshipWorkspaceEnabled() }));
  const metrics = data as Metrics;

  // One round trip: the portion rules and the crew meals ask nothing of each other (neither throws — each hands back
  // its own error, handled below in the order it always was).
  const [{ data: ruleRows, error: ruleRowsError }, { data: crewRows, error: crewError }] = await Promise.all([
    supabase
      .from('vendor_portion_rules')
      .select(
        'rule_id, label, unit, qty_per_guest, applies_to_meals, applies_to_block, headcount_basis, waste_factor_pct',
      )
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.rpc('get_vendor_crew_meals', { p_event_id: eventId }),
  ]);
  // ⚠ THE PORTION RULES EVERY NUMBER ON THIS SHEET IS COMPUTED FROM, on the
  // ⚠ page a caterer works from on the day. Refused, `?? []` empties them, the
  // ⚠ ingredient totals silently compute from nothing, and the page says "No
  // ⚠ portion rules yet — add your first below" to somebody who wrote them
  // ⚠ months ago.
  if (ruleRowsError) {
    logQueryError(
      'VendorProductionSheet.rules',
      ruleRowsError,
      { vendorProfileId: profile.vendor_profile_id },
      'graceful_degrade',
    );
  }
  const rulesMeasured = !ruleRowsError && ruleRows !== null;

  // 🍱 THE CREW MEALS THE HOST SET (owner 2026-11-02, 4 additions (4); migration 20271303132255): each booked supplier
  // whose crew the event feeds, with the host's number. Names and counts only. A refused read is said — never "none".
  // (Read in the batch above.)
  if (crewError) logQueryError('VendorProductionSheet.crewMeals', crewError, { eventId }, 'graceful_degrade');
  const crewMeals = crewError ? null : crewMealLines(crewRows as Record<string, unknown>[] | null);
  const crewTotal = crewMeals ? crewMealTotal(crewMeals) : 0;
  const rules = (ruleRows ?? []) as PortionRule[];

  return (
    <ProductionSheetBody
      eventId={eventId}
      eventName={eventName}
      metrics={metrics}
      rules={rules}
      rulesMeasured={rulesMeasured}
      crewMeals={crewMeals}
      crewTotal={crewTotal}
      ruleFlag={search.rule}
    />
  );
}
