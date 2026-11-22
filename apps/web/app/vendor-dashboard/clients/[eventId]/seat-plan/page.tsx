import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { partReadOutcome } from '@/lib/vendor-part-read';
import { readTheirEventName } from '@/app/vendor-dashboard/_components/set-two/their-event-line';
import { SeatPlanBody, SeatPlanReadFailed, type Plan } from './seat-plan-body';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveEventFeeGate } from '@/lib/vendor-event-fee-access.server';
import { EventLockedPage } from '@/app/vendor-dashboard/_components/event-locked-by-fee';
import { vendorClientSurfaceHref } from '@/lib/vendor-client-return';
import { isRelationshipWorkspaceEnabled } from '@/lib/relationship-workspace-flag';

export const metadata = { title: 'Seat Plan · Supplier' };

/**
 * Read-only vendor seat-plan viewer — feature-access program Phase 4
 * (corpus 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 6).
 *
 * The PUBLISHED floor plan for booked floor-touching vendors: stage, dance
 * floor, entrances (incl. service entrance), every table's position with
 * seated COUNTS — and per-table meal counts for food-relevant categories
 * (the caterer's covers sheet). Counts only: guest names never cross
 * (RA 10173, § 8). The gate lives in the get_vendor_seat_plan RPC.
 */

type Props = { params: Promise<{ eventId: string }> };

export default async function VendorSeatPlanPage({ params }: Props) {
  const { eventId } = await params;
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

  const [{ data, error }, eventName] = await Promise.all([
    supabase.rpc('get_vendor_seat_plan', { p_event_id: eventId }),
    readTheirEventName(supabase, eventId),
  ]);
  // A gate (not_booked / category_not_floor / not_published) is an answer — the Brief, as always. A read that did not
  // answer is SAID in place (supplier pages set two, Honest state · new) — never a silent bounce to the brief.
  const outcome = partReadOutcome(error, data);
  if (outcome === 'failed') {
    logQueryError('VendorSeatPlan.plan', error!, { eventId }, 'graceful_degrade');
    return <SeatPlanReadFailed eventId={eventId} eventName={eventName} />;
  }
  if (outcome === 'gate') redirect(vendorClientSurfaceHref(eventId, 'brief', { shellOn: isRelationshipWorkspaceEnabled() }));
  return <SeatPlanBody eventId={eventId} eventName={eventName} plan={data as Plan} />;
}

