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
