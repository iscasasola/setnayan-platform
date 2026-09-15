import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PERIODIC_JOBS,
  classifyAllJobs,
  findPeriodicJob,
  type JobRunRow,
  type JobVerdict,
  type PeriodicJob,
} from '@/lib/periodic-job-registry';

/**
 * Reads the cron-free job ledger for /admin/data-privacy → "Deletions".
 *
 * 🔑 THE COLUMN HAD TO REACH A SCREEN. Before this, NOTHING in the app read
 * `cron_job_runs` — not one page. Adding outcome columns and stopping there
 * would have reproduced the defect one level up: a measurement that never
 * reaches the render is a measurement nobody has. (The house rule, learned the
 * expensive way: a log line never changed a pixel.)
 *
 * A read that FAILS must not render as "every job is fine". It returns the
 * failure, and the panel prints it instead of a clean board.
 */
export type JobLedger =
  | { ok: true; verdicts: JobVerdict[]; rows: Map<string, JobRunRow> }
  | { ok: false; reason: string };

export async function fetchPeriodicJobLedger(
  admin: SupabaseClient,
  nowMs: number = Date.now(),
): Promise<JobLedger> {
  const { data, error } = await admin
    .from('cron_job_runs')
    .select('job_key, last_run_at, started_at, finished_at, ok, rows_affected, error');

  if (error) {
    return { ok: false, reason: error.message };
  }

  const rows = (data ?? []) as JobRunRow[];
  return {
    ok: true,
    verdicts: classifyAllJobs(rows, nowMs),
    rows: new Map(rows.map((r) => [r.job_key, r])),
  };
}

/** The catalog, retention promises first — the order the panel renders in. */
export function jobsInRenderOrder(): PeriodicJob[] {
  return [
    ...PERIODIC_JOBS.filter((j) => j.kind === 'retention'),
    ...PERIODIC_JOBS.filter((j) => j.kind !== 'retention'),
  ];
}

export { findPeriodicJob };
