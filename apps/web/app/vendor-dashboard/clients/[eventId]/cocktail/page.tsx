import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import type { CocktailEditorData } from './cocktail-editor';
import { CocktailBody, CocktailReadFailed } from './cocktail-body';
import { logQueryError } from '@/lib/supabase/error-detect';
import { partReadOutcome } from '@/lib/vendor-part-read';
import { readTheirEventName } from '@/app/vendor-dashboard/_components/set-two/their-event-line';
import { resolveEventFeeGate } from '@/lib/vendor-event-fee-access.server';
import { EventLockedPage } from '@/app/vendor-dashboard/_components/event-locked-by-fee';
import { vendorClientSurfaceHref } from '@/lib/vendor-client-return';
import { isRelationshipWorkspaceEnabled } from '@/lib/relationship-workspace-flag';

export const metadata = { title: 'Cocktail Area · Supplier' };

/**
 * Vendor-facing cocktail / waiting-area editor — the FIRST surface where a
 * booked vendor WRITES to a couple's planning blueprint (cocktail area + its
 * booths only; never reception seating or guest PII). All gating lives in the
 * get_vendor_cocktail_editor RPC + the vendor_*_cocktail_* write RPCs
 * (SECURITY DEFINER); this page just renders what the RPC allows.
 */

type Props = { params: Promise<{ eventId: string }> };

export default async function VendorCocktailPage({ params }: Props) {
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

  // not_a_vendor / not_booked / category_not_cocktail / vendor_edit_off are the RPC's GATES — an answer, and the brief is
  // the right place for it, as always. Any other error is a read that did not happen: it is SAID, in place (supplier
  // pages set two, Honest state · new) — never a redirect that makes a failure look like "this page is not yours".
  const [{ data, error }, eventName] = await Promise.all([
    supabase.rpc('get_vendor_cocktail_editor', { p_event_id: eventId }),
    readTheirEventName(supabase, eventId),
  ]);
  const outcome = partReadOutcome(error, data);
  if (outcome === 'failed') {
    logQueryError('VendorCocktailPage.editor', error!, { eventId }, 'graceful_degrade');
    return <CocktailReadFailed eventId={eventId} eventName={eventName} />;
  }
  if (outcome === 'gate') redirect(vendorClientSurfaceHref(eventId, 'brief', { shellOn: isRelationshipWorkspaceEnabled() }));
  return <CocktailBody eventId={eventId} eventName={eventName} plan={data as CocktailEditorData} />;
}
