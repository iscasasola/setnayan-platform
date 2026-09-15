import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

import { normalizeRowsAffected } from '@/lib/periodic-job-registry';

export {
  DAILY_GAP_MS,
  WEEKLY_GAP_MS,
  PERIODIC_JOBS,
  PERIODIC_JOB_KEYS,
  RETENTION_JOB_KEYS,
  normalizeRowsAffected,
  type PeriodicJob,
  type JobRunRow,
} from '@/lib/periodic-job-registry';
/**
 * Generic CRON-FREE once-per-period claim ([[project_setnayan_cron_free]]).
 *
 * `runClaimedJob(key, gapMs, body)` wins the window for exactly one caller, runs
 * the body, and then CLOSES the row with what happened. It's the durable,
 * deploy-surviving, cross-instance version of an in-memory throttle (the state
 * lives in the DB via the `claim_periodic_job` compare-and-swap), fired from
 * Next `after()` on request traffic instead of a scheduler.
 *
 * 🔑 WHY THE CLOSE EXISTS. Until 2026-09-15 the claim was the whole record:
 * `cron_job_runs` held job_key and last_run_at, last_run_at was stamped at the
 * instant of the CLAIM — before the body ran — and every wrapper swallowed the
 * body's failure in a bare catch whose only content was the words "best-effort".
 * A retention sweep that threw
 * left a FRESH timestamp and did not retry for a full week, and a silently
 * failing deletion job was byte-identical to a working one from every record we
 * keep. `/privacy` promises deletions with dates on them under RA 10173.
 *
 * ⛔ THE CLAIM ITSELF IS UNCHANGED, AND MUST STAY THAT WAY. It is gated on
 * last_run_at ONLY — never on the previous run's `ok`. A job that failed once
 * would otherwise never run again, which is worse than the defect being fixed.
 *
 * A cheap in-memory pre-throttle per key means most requests never even touch
 * the DB. Best-effort: any error → skip now; a later request retries.
 */
const CHECK_THROTTLE_MS = 5 * 60 * 1000;
const lastCheckMs = new Map<string, number>();

/**
 * Win the window for one job. Returns TRUE for exactly one caller per gap.
 *
 * ⚠ PREFER `runClaimedJob`. A bare claim opens a run that nothing closes, which
 * renders on /admin/data-privacy as "started and NEVER FINISHED" — the state
 * reserved for a job that actually died. `lib/jobs-close-what-they-claim.test.ts`
 * fails if anything outside this file calls it.
 */
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

/**
 * Close the open run for a job: finished_at, ok, rows_affected, error.
 *
 * Never throws — it is the last thing a dying job does, and a close that threw
 * would turn a recorded failure back into an invisible one.
 *
 * `rowsAffected` 0 and null mean DIFFERENT THINGS and are written differently:
 * 0 is "it ran and nothing was due", null is "this job reports no count".
 */
export async function finishPeriodicJob(
  jobKey: string,
  outcome: { ok: boolean; rowsAffected?: number | null; error?: string | null },
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc('finish_periodic_job' as never, {
      p_job_key: jobKey,
      p_ok: outcome.ok,
      p_rows_affected: normalizeRowsAffected(outcome.rowsAffected),
      p_error: outcome.error ?? null,
    } as never);
  } catch {
    /* the run's outcome is lost, but the page that fired it must not break */
  }
}

/** The message half of an unknown throw, bounded — never the stack. */
function errorText(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e) ?? 'unknown error';
  } catch {
    return 'unknown error';
  }
}

/**
 * Claim the window, run the body, and record what it did — the ONLY sanctioned
 * way to run a periodic job.
 *
 * The body returns the number of records it touched, or nothing when the job has
 * no meaningful count. Returning 0 is a real answer and is stored as 0.
 *
 * ⛔ NEVER THROWS. These run inside `after()` on a page render; a retention
 * sweep must not be able to break the admin console. The difference from before
 * is that the failure is now WRITTEN DOWN (ok = false + the message) instead of
 * vanishing into an empty catch.
 */
export async function runClaimedJob(
  jobKey: string,
  minGapMs: number,
  body: () => Promise<number | null | void>,
): Promise<void> {
  let won = false;
  try {
    won = await claimPeriodicJob(jobKey, minGapMs);
  } catch {
    return;
  }
  if (!won) return;

  try {
    const result = await body();
    await finishPeriodicJob(jobKey, {
      ok: true,
      rowsAffected: normalizeRowsAffected(result),
      error: null,
    });
  } catch (e) {
    console.error(`[periodic-job] ${jobKey} FAILED:`, errorText(e));
    await finishPeriodicJob(jobKey, { ok: false, rowsAffected: null, error: errorText(e) });
  }
}
