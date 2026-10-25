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
 * ⚠ WHERE IT RUNS (2026-10-16): AFTER THE FIRST RESPONSE an instance sends —
 * `scheduleBookingFeeMintingStamp`, called by the root layout, through Next's
 * `after()` — never in `instrumentation.ts`. See the docblock on the scheduler.
 *
 * 🔒 PRODUCTION ONLY. Previews and local dev share the production database; a
 * preview built with the fee off would otherwise stamp FALSE and switch off the
 * live lock for everybody.
 *
 * Never throws; one tiny write per instance, and none when nothing changed.
 */
export function shouldStampBookingFeeMinting(env: Readonly<Record<string, string | undefined>>): boolean {
  // Not while `next build` prerenders: `after()` in a static render runs at BUILD time, and a build
  // that then fails must not have stamped what it would have run with.
  return env.VERCEL_ENV === 'production' && env.NEXT_PHASE !== 'phase-production-build';
}

/**
 * ⏱ THE STAMP RUNS AFTER A RESPONSE, OFF EVERY REQUEST'S PATH (stability sweep 2, 2026-10-16).
 *
 * History, both measured in production's fault log and Vercel's log:
 *   1 · fired and forgotten from `register()` → `DB_UNREACHABLE platform_settings · fetch failed`,
 *       124 hits: the write was frozen with the instance and its socket was dead on thaw.
 *   2 · awaited in `register()` with a 1.5 s ceiling (#6571) → `AbortError: This operation was
 *       aborted`, 57 hits in 12 h, plus `write ETIMEDOUT` and `ECONNRESET … before secure TLS
 *       connection was established`. The database ran that very statement 378 times at 0.8 ms mean,
 *       98 ms max (`pg_stat_statements`): the time was never the database's. An instance's start-up
 *       can be run and FROZEN before it serves anyone, so a network call in `register()` is
 *       suspended mid-flight and its ceiling has long passed when the instance wakes.
 *
 * So the stamp is not in start-up at all. The root layout calls `scheduleBookingFeeMintingStamp`,
 * which hands the write to Next's `after()` ONCE per instance: it runs when that request's response
 * has been sent, inside the platform's `waitUntil`, so nobody waits for it and nothing freezes it
 * mid-flight. A write that did not land (a dropped connection, the ceiling) lets a later request on
 * the same instance try again — at most `STAMP_ATTEMPTS_PER_INSTANCE` times.
 *
 * The ceiling is now generous (`STAMP_CEILING_MS`): it no longer stands between a guest and a page,
 * so an abort means the database really did not answer for that long — a real failure, recorded as
 * one, not the routine noise of a frozen start-up.
 */
export const STAMP_CEILING_MS = 10_000;
export const STAMP_ATTEMPTS_PER_INSTANCE = 3;

/** What one stamp did: wrote the value · found it already right · did not land (refused, dropped, ceiling). */
export type StampOutcome = 'stamped' | 'already_right' | 'failed';

export async function stampBookingFeeMinting(
  admin: SupabaseClient,
  ceilingMs: number = STAMP_CEILING_MS,
  minting: boolean = isBookingFeeEnabled(),
): Promise<StampOutcome> {
  const ceiling = new AbortController();
  const timer = setTimeout(() => ceiling.abort(), ceilingMs);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await stampBookingFeeMintingOnce(admin, minting, ceiling.signal);
      if (out !== 'transport_failed') return out;
      if (ceiling.signal.aborted) return 'failed';
    }
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}

/** One attempt, telling a TRANSPORT failure (no answer — worth one more try) from a refusal. */
async function stampBookingFeeMintingOnce(
  admin: SupabaseClient,
  minting: boolean,
  signal: AbortSignal,
): Promise<StampOutcome | 'transport_failed'> {
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
      return transport ? 'transport_failed' : 'failed';
    }
    return (data ?? []).length > 0 ? 'stamped' : 'already_right';
  } catch (e) {
    console.error('[booking-fee-minting-stamp] stamp threw:', e);
    return signal.aborted ? 'failed' : 'transport_failed';
  }
}

/**
 * Once per instance, after a response: the scheduler the root layout calls. Its collaborators are
 * passed in (`after`, the client, the stamp itself) so the rule — at most once in flight, retried on
 * a later request when it did not land, never during a build, never outside production — is tested
 * without Next or a network (`booking-fee-minting-stamp.test.ts`).
 */
export function createMintingStampScheduler(deps: {
  env: Readonly<Record<string, string | undefined>>;
  after: (task: () => Promise<unknown>) => void;
  client: () => SupabaseClient;
  stamp?: (admin: SupabaseClient) => Promise<StampOutcome>;
}): () => void {
  let state: 'idle' | 'running' | 'done' = 'idle';
  let attempts = 0;
  const stamp = deps.stamp ?? ((admin: SupabaseClient) => stampBookingFeeMinting(admin));
  return () => {
    if (state !== 'idle' || attempts >= STAMP_ATTEMPTS_PER_INSTANCE) return;
    if (!shouldStampBookingFeeMinting(deps.env)) {
      state = 'done';
      return;
    }
    state = 'running';
    attempts += 1;
    try {
      deps.after(async () => {
        let out: StampOutcome = 'failed';
        try {
          out = await stamp(deps.client());
        } catch {
          out = 'failed';
        }
        // Landed (written, or already right) → done for this instance; otherwise a later request retries.
        state = out === 'failed' ? 'idle' : 'done';
      });
    } catch {
      // `after` outside a request scope throws — nothing was scheduled; a later request tries again.
      state = 'idle';
    }
  };
}

