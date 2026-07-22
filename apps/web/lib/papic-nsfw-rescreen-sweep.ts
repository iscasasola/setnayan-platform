import 'server-only';
import { claimPeriodicJob } from '@/lib/periodic-jobs';
import { reScreenAllStuckCaptures } from '@/lib/nsfw-screen';

// ============================================================================
// CRON-FREE periodic NSFW re-screen heal ([[project_setnayan_cron_free]]).
//
// screenCapture() runs fail-open + fire-and-forget from the capture after()
// hook, and reScreenStuckCaptures() (its per-event healer) is only fired from
// two COUPLE-SIDE after() sites. So a capture whose first screen dropped, on an
// event no couple revisits, stays 'unscreened' forever — a safe photo dark on
// every guest-facing surface with nothing to heal it.
//
// This wrapper fires the GLOBAL heal from admin traffic (the same central
// periodic-job site as the Papic full-res drop / retention sweep, which already
// work these tables) — a path that runs whether or not any couple is around. A
// ~20-min DB claim guarantees it runs at most once per window across the fleet
// and survives deploys; reScreenAllStuckCaptures is bounded + never throws.
// ============================================================================

/** ~every 20 min (first eligible admin request after the gap wins the window).
 *  Comfortably above the 15-min re-screen grace, so a dropped screen heals in
 *  roughly one grace + one claim window while never racing an in-flight screen. */
const RESCREEN_SWEEP_GAP_MS = 20 * 60 * 1000;

/**
 * Fire the global stuck-'unscreened' heal at most once per ~20-min window.
 * Best-effort: any error (claim miss, sweep throw) is swallowed and retried on
 * the next eligible admin request. Safe to fire-and-forget from after().
 */
export async function maybeRunPapicNsfwRescreen(): Promise<void> {
  try {
    if (await claimPeriodicJob('papic-nsfw-rescreen', RESCREEN_SWEEP_GAP_MS)) {
      await reScreenAllStuckCaptures();
    }
  } catch {
    /* best-effort — a missed window retries on the next eligible admin request */
  }
}
