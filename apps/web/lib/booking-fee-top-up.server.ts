import 'server-only';

/**
 * 💸 THE OVERDUE TOP-UP OF ONE (SHOP × EVENT) — the read behind "words only" in the supplier's chat (owner 2026-11-12,
 * booking-fee top-up rules; prototype "New inquiry · text only").
 *
 * 🔑 NOT THE EVENT GATE. The conversation is one of the always-open three (`ALWAYS_OPEN_SURFACES`): a locked supplier
 * must always be able to TALK, and the thread page is held never to read `resolveEventFeeGate`
 * (`the-fee-unlocks-the-event.test.ts`). This narrows nothing about talking — it only says the message box keeps
 * WORDS while this event's top-up is past its event day and unsettled. Same switch as the gate
 * (`resolveFeeEnforcement`): with the lock off, nothing narrows.
 *
 * Fails open: a refused read returns null (words AND files, exactly as shipped) and is logged.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveFeeEnforcement } from '@/lib/vendor-event-fee-access.server';
import { TOP_UP_CHARGE_KIND, topUpStage } from '@/lib/booking-fee-top-up';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { DAILY_GAP_MS } from '@/lib/periodic-job-registry';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';

export async function readOverdueTopUpForEvent(
  vendorProfileId: string,
  eventId: string,
  todayPh: string,
): Promise<{ amountPhp: number } | null> {
  try {
    if (!(await resolveFeeEnforcement())) return null;
    const { data, error } = await createAdminClient()
      .from('booking_fee_charges')
      .select('amount_charged_centavos, expires_at')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .eq('kind', TOP_UP_CHARGE_KIND)
      .in('status', ['pending', 'failed']);
    if (error) {
      logQueryError('booking-fee-top-up: overdue for event', error, { vendor_profile_id: vendorProfileId, event_id: eventId });
      return null;
    }
    const overdue = ((data ?? []) as Array<{ amount_charged_centavos: number | string | null; expires_at: string | null }>)
      .filter((r) => topUpStage(r.expires_at, todayPh) === 'overdue')
      .reduce((sum, r) => sum + Math.max(0, Number(r.amount_charged_centavos ?? 0)), 0);
    return overdue > 0 ? { amountPhp: overdue / 100 } : null;
  } catch (err) {
    logQueryError('booking-fee-top-up: overdue for event', err, { vendor_profile_id: vendorProfileId, event_id: eventId });
    return null;
  }
}

/**
 * 💸 "UNLISTED AND UNCOUNTED UNTIL THE TOP-UP IS SETTLED" — the PUBLIC half (owner 2026-11-12). The events of ONE shop
 * whose booking-fee top-up is past its event day and unsettled: the shop page leaves out the review, the photos put on
 * the page and the featured story from each. The stars are uncounted in SQL by the twin of this read,
 * `booking_fee_top_up_overdue` (migration 20271341273990). Same switch as the gate: with the lock off, nothing is
 * unlisted. A refused read unlists nothing (logged) — the shipped page, never an emptied one.
 */
export async function readOverdueTopUpEventIds(vendorProfileId: string, todayPh: string): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    if (!(await resolveFeeEnforcement())) return out;
    const { data, error } = await createAdminClient()
      .from('booking_fee_charges')
      .select('event_id, expires_at')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('kind', TOP_UP_CHARGE_KIND)
      .in('status', ['pending', 'failed']);
    if (error) {
      logQueryError('booking-fee-top-up: overdue events', error, { vendor_profile_id: vendorProfileId });
      return out;
    }
    for (const r of (data ?? []) as Array<{ event_id: string | null; expires_at: string | null }>) {
      if (r.event_id && topUpStage(r.expires_at, todayPh) === 'overdue') out.add(r.event_id);
    }
  } catch (err) {
    logQueryError('booking-fee-top-up: overdue events', err, { vendor_profile_id: vendorProfileId });
  }
  return out;
}

/**
 * Once a day, re-read the public stars so a review from an event whose top-up has just become overdue stops counting
 * (`booking_fee_top_up_refresh_stars`). Settling needs no run — a trigger on the charge re-reads them at once.
 */
export async function maybeRunTopUpUnlist(): Promise<void> {
  if (!isBookingFeeEnabled()) return;
  await runClaimedJob('booking-fee-top-up-unlist', DAILY_GAP_MS, async () => {
    const { error } = await createAdminClient().rpc('booking_fee_top_up_refresh_stars');
    if (error) throw new Error(`booking_fee_top_up_refresh_stars failed: ${error.message}`);
  });
}

/**
 * The page-gallery refs ("put on my page") that came from these events — `supplier_page_photo_notices` is the only
 * link from a page photo back to its event. Left out of the PUBLIC page while that event's top-up is overdue. A
 * refused read returns nothing to leave out (logged).
 */
export async function readPageRefsFromEvents(vendorProfileId: string, eventIds: ReadonlySet<string>): Promise<Set<string>> {
  const out = new Set<string>();
  if (eventIds.size === 0) return out;
  const { data, error } = await createAdminClient()
    .from('supplier_page_photo_notices')
    .select('page_ref')
    .eq('vendor_profile_id', vendorProfileId)
    .in('event_id', [...eventIds]);
  if (error) {
    logQueryError('booking-fee-top-up: page refs', error, { vendor_profile_id: vendorProfileId });
    return out;
  }
  for (const r of (data ?? []) as Array<{ page_ref: string | null }>) if (r.page_ref) out.add(r.page_ref);
  return out;
}
