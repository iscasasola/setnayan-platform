import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Generic CRON-FREE once-per-period claim ([[project_setnayan_cron_free]]).
 *
 * `claimPeriodicJob(key, gapMs)` returns TRUE for exactly one caller per gap
 * window — the winner runs the job; everyone else bails. It's the durable,
 * deploy-surviving, cross-instance version of an in-memory throttle (the state
 * lives in the DB via the `claim_periodic_job` compare-and-swap), fired from
 * Next `after()` on request traffic instead of a scheduler. This replaces the
 * Vercel Cron entries for the "safe" periodic jobs.
 *
 * A cheap in-memory pre-throttle per key means most requests never even touch
 * the DB. Best-effort: any error → false (skip now; a later request retries).
 */
const CHECK_THROTTLE_MS = 5 * 60 * 1000;
const lastCheckMs = new Map<string, number>();

/** ~once per day (the first eligible request after this gap wins the day). */
export const DAILY_GAP_MS = 20 * 60 * 60 * 1000;

/** ~once per week (slightly under 7d so it reliably fires each week). */
export const WEEKLY_GAP_MS = 6 * 24 * 60 * 60 * 1000;

export async function claimPeriodicJob(jobKey: string, minGapMs: number): Promise<boolean> {
  const nowMs = Date.now();
  if (nowMs - (lastCheckMs.get(jobKey) ?? 0) < CHECK_THROTTLE_MS) return false;
  lastCheckMs.set(jobKey, nowMs);
  try {
    const admin = createAdminClient();
    const seconds = Math.max(1, Math.round(minGapMs / 1000));
    const { data, error } = await admin.rpc('claim_periodic_job' as never, {
      p_job_key: jobKey,
      p_min_gap: `${seconds} seconds`,
    } as never);
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
