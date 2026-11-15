import 'server-only';

/**
 * 💸 WORDS ONLY ON A NEW INQUIRY — the read behind the supplier's narrowed message box (owner 2026-11-12, booking-fee
 * top-up rules; prototype "New inquiry · text only": "Text replies only until you settle ₱X booking fee … booked
 * clients are unaffected").
 *
 * WHO: a thread where this shop is NOT booked (`event_vendors.status` in `CONFIRMED_VENDOR_STATUSES`, the same set
 * `shopIsBookedOnEvent` reads), while the shop has an OVERDUE top-up on ANY of its events. A booked client — the couple
 * who owes the top-up included — keeps files (audit hold, 13 Nov: it used to narrow the booked event that owed it).
 *
 * 🔑 NOT THE EVENT GATE. The conversation is one of the always-open three (`ALWAYS_OPEN_SURFACES`): a locked supplier
 * must always be able to TALK, and the thread page is held never to read `resolveEventFeeGate`
 * (`the-fee-unlocks-the-event.test.ts`). This narrows only files. Same switch as the gate (`resolveFeeEnforcement`).
 *
 * A refused read (either one) narrows nothing and is logged — the decision is `wordsOnlyTopUpPhp`, which never reads
 * a failed booked read as "unbooked".
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveFeeEnforcement } from '@/lib/vendor-event-fee-access.server';
import { TOP_UP_CHARGE_KIND, topUpStage, wordsOnlyTopUpPhp } from '@/lib/booking-fee-top-up';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { DAILY_GAP_MS } from '@/lib/periodic-job-registry';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';

export async function readWordsOnlyTopUp(
  vendorProfileId: string,
  eventId: string,
  todayPh: string,
): Promise<{ amountPhp: number } | null> {
  const ctx = { vendor_profile_id: vendorProfileId, event_id: eventId };
  try {
    if (!(await resolveFeeEnforcement())) return null;
    const admin = createAdminClient();
    const [bookedRes, chargesRes] = await Promise.all([
      admin
        .from('event_vendors')
        .select('vendor_id')
        .eq('event_id', eventId)
        .eq('marketplace_vendor_id', vendorProfileId)
        .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
        .limit(1),
      admin
        .from('booking_fee_charges')
        .select('amount_charged_centavos, expires_at')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('kind', TOP_UP_CHARGE_KIND)
        .in('status', ['pending', 'failed']),
    ]);
    if (bookedRes.error) logQueryError('booking-fee-top-up: words-only booked read', bookedRes.error, ctx);
    if (chargesRes.error) logQueryError('booking-fee-top-up: words-only top-ups', chargesRes.error, ctx);
    const amountPhp = wordsOnlyTopUpPhp({
      booked: bookedRes.error ? null : (bookedRes.data ?? []).length > 0,
      charges: chargesRes.error
        ? null
        : ((chargesRes.data ?? []) as Array<{ amount_charged_centavos: number | string | null; expires_at: string | null }>),
      todayPh,
    });
    return amountPhp === null ? null : { amountPhp };
  } catch (err) {
    logQueryError('booking-fee-top-up: words-only', err, ctx);
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
