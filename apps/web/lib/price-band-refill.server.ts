import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { PRICE_BAND_REFILL_GAP_MS } from '@/lib/periodic-job-registry';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * price-band-refill.server.ts — the peer benchmark refills itself.
 *
 * ── THE DEFECT, measured 2026-09-22 (CTRL-B3 build 5) ───────────────────────
 * `market_price_bands` is **0 rows in production**. It is written ONLY by
 * `recompute_market_price_bands()`, and the only caller is a human pressing
 * **Recompute** on `/admin/pricing?tab=price-bands`. So the Price-Position
 * Meter every supplier sees has been empty since it shipped — and would be
 * stale a day after any manual refill.
 *
 * 🔑 AN EMPTY BENCHMARK DOES NOT LOOK BROKEN. It looks like "not enough peer
 * data yet", which is a sentence a supplier believes. The same page's funnel
 * half carries a comment saying exactly that about its own table: the card
 * *"could never show a band, by construction"*.
 *
 * ── WHY THIS IS NOT A CRON ─────────────────────────────────────────────────
 * ⛔ THIS REPO HAS NO SCHEDULER, DELIBERATELY. The established shape is a job
 * claimed through `claim_periodic_job` and fired from `after()` on a page staff
 * already load — `booking-fee-unbilled-repair` is the worked example and this
 * mirrors it line for line, including being mounted on more than one surface so
 * it does not depend on anybody visiting one particular screen.
 *
 * ⚠ `cron_job_runs.last_run_at` records the CLAIM, not the outcome: a job that
 * claims and then throws looks identical to one that succeeded. So the count
 * returned below is the number of bands actually WRITTEN, and a failed RPC
 * throws rather than returning 0 — `runClaimedJob` stores that as `ok=false`
 * with the message, which is the difference the registry exists for.
 */

export async function maybeRefillPriceBands(): Promise<void> {
  await runClaimedJob('market-price-band-refill', PRICE_BAND_REFILL_GAP_MS, async () => {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('recompute_market_price_bands');
    if (error) {
      logQueryError('price-band-refill: recompute_market_price_bands', error);
      // Thrown, not swallowed. A refused recompute that returned 0 would be
      // indistinguishable from a healthy run over an empty catalogue, and the
      // meter would stay empty with the registry reporting success.
      throw new Error(`recompute_market_price_bands failed: ${error.message}`);
    }
    return typeof data === 'number' ? data : 0;
  });
}
