import 'server-only';

import { runClaimedJob } from '@/lib/periodic-jobs';
import { runOAuthRefreshSweep } from '@/lib/oauth-refresh-sweep';
import { findPeriodicJob } from '@/lib/periodic-job-registry';

/**
 * 🔑 THE CADENCE IS READ FROM THE REGISTRY, NEVER RESTATED HERE.
 *
 * My first version declared its own `OAUTH_REFRESH_GAP_MS = 60 * 60 * 1000`
 * beside the registry's identical `gapMs`, and a sabotage caught it: widening
 * the constant the wrapper actually hands to `runClaimedJob` left every test
 * green while `/admin` went on publishing "hourly" from the registry row. Two
 * numbers for one cadence, free to drift — this project's signature disease,
 * written by the person fixing an instance of it.
 *
 * The registry row is what the admin health page reads, so the registry row is
 * the number. Hourly, because a Google access token lives an hour: a wider gap
 * means a live broadcast can meet a dead token between sweeps.
 */
const FALLBACK_GAP_MS = 60 * 60 * 1000;

/**
 * Claim-and-run, in the shape every other traffic-driven job uses.
 * `runClaimedJob` swallows its own failures and records the outcome, so this is
 * safe inside `after()`.
 */
export async function maybeRunOAuthRefresh(): Promise<void> {
  // `?? FALLBACK` only for the impossible case of the row being deleted — the
  // guard fails loudly on that, so this is belt, not policy.
  const gapMs = findPeriodicJob('oauth-refresh')?.gapMs ?? FALLBACK_GAP_MS;
  await runClaimedJob('oauth-refresh', gapMs, async () => {
    const result = await runOAuthRefreshSweep();
    if ('error' in result) throw new Error(result.error);
    if (result.failed > 0) {
      // console, not email — same posture as the interconnection probes: the
      // owner chose the admin console, and this makes it greppable in Vercel
      // logs for whoever is already looking.
      console.warn(
        `[oauth-refresh] ${result.failed} grant(s) failed to refresh, ` +
          `${result.skipped} skipped, ${result.refreshed} refreshed`,
      );
    }
    return result.refreshed;
  });
}
