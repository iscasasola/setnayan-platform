'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { VENDOR_BOOKING_FEES_PATH } from '@/lib/vendor-booking-fees';
import { readLaunchOffer } from '@/lib/launch-offer.server';
import { manilaLocalToIso } from '@/lib/launch-offer';

export type LaunchOfferActionState = { ok: boolean; message: string | null };

/**
 * THE ONE ADMIN DOOR FOR THE LAUNCH OFFER — owner 2026-10-08: *"ONE admin page,
 * admin-editable, never hard-coded"*. One server action with an `intent`, so
 * the four things the page does cost one action, not four:
 *
 *   · `start`  — switch the offer on (stamps its start, once).
 *   · `save`   — the owner's three numbers: how many bookings, how many Papic
 *                credits per booking, how long a subscription cycle is.
 *   · `close`  — end it now (stamps the end and free Pro's one end date).
 *   · `window` — the free-fee window (`booking_fee_free_from/until`), which had
 *                no screen at all (audit 2026-10-12, C9).
 *
 * 🔑 IT DECIDES NO BOOKING. Which booking is fee-free is decided in SQL at the
 * supplier's yes (`booking_fee_open_lock_charge`). This page only sets the
 * numbers that rule reads, and every change writes an `admin_audit_log` row
 * with the before and after.
 */
export async function saveLaunchOffer(
  _prev: LaunchOfferActionState,
  formData: FormData,
): Promise<LaunchOfferActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();
  const intent = String(formData.get('intent') ?? '').trim();

  const before = await readLaunchOffer(admin);
  if (!before) {
    return { ok: false, message: 'Could not read the launch offer just now — nothing was changed.' };
  }

  const audit = async (action: string, after: Record<string, unknown>) => {
    await admin.from('admin_audit_log').insert({
      action,
      target_id: 'launch_offer',
      actor_user_id: adminUserId,
      metadata: { table: 'platform_settings', before, after },
    });
  };
  const done = (message: string): LaunchOfferActionState => {
    revalidatePath('/admin/launch-offer');
    revalidatePath('/for-suppliers');
    revalidatePath(VENDOR_BOOKING_FEES_PATH);
    return { ok: true, message };
  };

  if (intent === 'save' || intent === 'start') {
    const cap = wholeNumber(formData.get('launch_offer_booking_cap'));
    const credits = wholeNumber(formData.get('launch_offer_papic_credits'));
    const cycle = wholeNumber(formData.get('launch_offer_cycle_days'));
    if (cap == null || cap <= 0) return { ok: false, message: 'How many bookings must be a whole number above 0.' };
    if (cap < before.used) {
      return {
        ok: false,
        message: `${before.used.toLocaleString('en-PH')} bookings have already taken a place — the number cannot go below that.`,
      };
    }
    if (credits == null || credits < 0) return { ok: false, message: 'Papic credits must be 0 or more.' };
    if (cycle == null || cycle <= 0) return { ok: false, message: 'The cycle must be at least 1 day.' };

    const update: Record<string, unknown> = {
      launch_offer_booking_cap: cap,
      launch_offer_papic_credits: credits,
      launch_offer_cycle_days: cycle,
      updated_at: new Date().toISOString(),
    };
    if (intent === 'start') {
      if (before.closedAt) return { ok: false, message: 'This launch offer has ended. It cannot be started again.' };
      update.launch_offer_enabled = true;
      if (!before.startedAt) update.launch_offer_started_at = new Date().toISOString();
    }
    const { error } = await admin.from('platform_settings').update(update).eq('id', 1);
    if (error) return { ok: false, message: `Couldn't save — ${error.message}` };
    await audit(intent === 'start' ? 'launch_offer_start' : 'launch_offer_edit', update);
    return done(intent === 'start' ? 'The launch offer is on.' : 'Saved.');
  }

  if (intent === 'close') {
    if (!before.enabled) return { ok: false, message: 'The launch offer is not on.' };
    if (before.closedAt) return { ok: true, message: 'It has already ended.' };
    const { data, error } = await admin.rpc('booking_fee_launch_offer_close');
    if (error) return { ok: false, message: `Couldn't end it — ${error.message}` };
    await audit('launch_offer_close', { result: data });
    return done('The launch offer has ended. Free Pro runs to the end of this cycle.');
  }

  if (intent === 'window') {
    const fromRaw = String(formData.get('booking_fee_free_from') ?? '').trim();
    const untilRaw = String(formData.get('booking_fee_free_until') ?? '').trim();
    const from = fromRaw ? manilaLocalToIso(fromRaw) : null;
    const until = untilRaw ? manilaLocalToIso(untilRaw) : null;
    if ((fromRaw && !from) || (untilRaw && !until)) return { ok: false, message: 'One of the dates could not be read.' };
    if (from && until && Date.parse(until) <= Date.parse(from)) {
      return { ok: false, message: 'The end must be after the start.' };
    }
    const update = { booking_fee_free_from: from, booking_fee_free_until: until, updated_at: new Date().toISOString() };
    const { error } = await admin.from('platform_settings').update(update).eq('id', 1);
    if (error) return { ok: false, message: `Couldn't save — ${error.message}` };
    await audit('booking_fee_free_window_edit', update);
    return done(from || until ? 'Free-fee window saved.' : 'Free-fee window cleared.');
  }

  return { ok: false, message: 'Nothing to do.' };
}

function wholeNumber(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}
