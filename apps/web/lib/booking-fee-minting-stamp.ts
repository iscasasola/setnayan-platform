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
export function shouldStampBookingFeeMinting(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.VERCEL_ENV === 'production';
}

/**
 * ⏱ THE STAMP AT SERVER START — AWAITED, WITH A CEILING (stability sweep 2026-10-15).
 *
 * It used to be fired and forgotten from `register()`. Production's own fault log then read
 * `DB_UNREACHABLE · platform_settings · TypeError: fetch failed` 116 times in 34 hours, and Vercel's
 * log printed `[booking-fee-minting-stamp] stamp failed: TypeError: fetch failed` on requests that
 * had nothing to do with it: a write started at a cold start, left running when the instance's
 * first response was sent and the instance was frozen, and found its socket dead when the instance
 * woke. The stamp — the bridge the fee lock's trigger trusts — did not land, and every cold start
 * added a red line to the list a real outage has to be noticed in.
 *
 * So the stamp now has a LIFETIME: `register()` awaits it, and Next awaits `register()` before the
 * instance serves its first request, so nothing can freeze it mid-flight. The wait is bounded by
 * `STAMP_CEILING_MS` — a stalled database costs a cold start at most that, never a hang — and a write
 * still in flight at the ceiling is ABORTED, not abandoned, so no half-open request is left to fail
 * later. The write is idempotent (it sets one column to one value, and only when it differs), so a
 * transport failure is retried ONCE inside the same ceiling.
 *
 * Never throws.
 */
export const STAMP_CEILING_MS = 1_500;

export async function stampBookingFeeMinting(
  admin: SupabaseClient,
  ceilingMs: number = STAMP_CEILING_MS,
  minting: boolean = isBookingFeeEnabled(),
): Promise<'stamped' | 'unchanged_or_failed'> {
  const ceiling = new AbortController();
  const timer = setTimeout(() => ceiling.abort(), ceilingMs);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await stampBookingFeeMintingOnce(admin, minting, ceiling.signal);
      if (out !== 'transport_failed' || ceiling.signal.aborted) return out === 'stamped' ? 'stamped' : 'unchanged_or_failed';
    }
    return 'unchanged_or_failed';
  } finally {
    clearTimeout(timer);
  }
}

/** One attempt, telling a TRANSPORT failure (no answer — worth one more try) from a refusal. */
async function stampBookingFeeMintingOnce(
  admin: SupabaseClient,
  minting: boolean,
  signal: AbortSignal,
): Promise<'stamped' | 'unchanged_or_failed' | 'transport_failed'> {
  try {
    const { data, error } = await admin
      .from('platform_settings')
      .update({ booking_fee_minting_live: minting })
      .eq('id', 1)
      // Only when it differs — the trigger fires on this column, and a cold
      // start that changes nothing must write nothing.
      .or(`booking_fee_minting_live.is.null,booking_fee_minting_live.neq.${minting}`)
      .select('id')
      .abortSignal(signal);
    if (error) {
      // postgrest-js RESOLVES a dropped connection as an error with no PostgREST code; a refusal
      // from the database carries one. Only the first is worth retrying.
      const transport = !error.code && /fetch failed|network|socket|ECONNRESET|terminated/i.test(error.message ?? '');
      // `details` carries undici's cause ("other side closed (UND_ERR_SOCKET)") — the one line that
      // says WHY; the message alone ("fetch failed") cannot.
      console.error('[booking-fee-minting-stamp] stamp failed:', error.message, (error.details ?? '').split('\n').slice(0, 3).join(' '));
      return transport ? 'transport_failed' : 'unchanged_or_failed';
    }
    return (data ?? []).length > 0 ? 'stamped' : 'unchanged_or_failed';
  } catch (e) {
    console.error('[booking-fee-minting-stamp] stamp threw:', e);
    return signal.aborted ? 'unchanged_or_failed' : 'transport_failed';
  }
}
