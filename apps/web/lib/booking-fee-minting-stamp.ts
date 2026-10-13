import type { SupabaseClient } from '@supabase/supabase-js';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';

/**
 * THE PRODUCTION APP TELLS THE DATABASE WHETHER IT IS MAKING BOOKING FEES.
 *
 * ⚖ OWNER 2026-10-13: refuse `platform_settings.fee_unlocks_event_enforced =
 * true` while NEXT_PUBLIC_BOOKING_FEE_ENABLED is off. Since the fee is made at
 * the yes, a booked shop with NO charge is locked out of its event — so with
 * minting off every booked shop would be locked with nothing to pay. The switch
 * lives in SQL and SQL cannot read an env flag; this is the bridge. At server
 * start (`instrumentation.ts`) the production app writes what it runs with into
 * `booking_fee_minting_live`, and the trigger
 * `platform_settings_fee_lock_needs_minting` (migration 20271268087628) refuses
 * the switch unless that stamp is TRUE — and stands the switch down if the
 * stamp turns FALSE under it.
 *
 * 🔒 PRODUCTION ONLY. Previews and local dev share the production database; a
 * preview built with the fee off would otherwise stamp FALSE and switch off the
 * live lock for everybody.
 *
 * Not `server-only`: instrumentation runs outside the react-server condition.
 * Never throws; one tiny write per cold start, and none when nothing changed.
 */
export function shouldStampBookingFeeMinting(env: { VERCEL_ENV?: string | undefined }): boolean {
  return env.VERCEL_ENV === 'production';
}

export async function stampBookingFeeMinting(
  admin: SupabaseClient,
  minting: boolean = isBookingFeeEnabled(),
): Promise<'stamped' | 'unchanged_or_failed'> {
  try {
    const { data, error } = await admin
      .from('platform_settings')
      .update({ booking_fee_minting_live: minting })
      .eq('id', 1)
      // Only when it differs — the trigger fires on this column, and a cold
      // start that changes nothing must write nothing.
      .or(`booking_fee_minting_live.is.null,booking_fee_minting_live.neq.${minting}`)
      .select('id');
    if (error) {
      console.error('[booking-fee-minting-stamp] stamp failed:', error.message);
      return 'unchanged_or_failed';
    }
    return (data ?? []).length > 0 ? 'stamped' : 'unchanged_or_failed';
  } catch (e) {
    console.error('[booking-fee-minting-stamp] stamp threw:', e);
    return 'unchanged_or_failed';
  }
}
