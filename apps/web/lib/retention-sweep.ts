import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob, WEEKLY_GAP_MS } from '@/lib/periodic-jobs';

/**
 * Data-retention chat purge (RA 10173 class 1 · 5-yr default). Hard-deletes whole
 * expired chat threads via purge_expired_chat() — which itself EXCLUDES any event
 * carrying an orders row (the 10-yr BIR/contract legal-hold floor). The safety +
 * scope live in the RPC; this is just the callable work body (shared by the
 * retained manual route and the cron-free wrapper).
 *
 * A single atomic DELETE, idempotent, and effectively a no-op until events age
 * past 5 years — so it is safe to drive from request traffic.
 */
const RETENTION_YEARS = 5;

export async function runRetentionSweep(): Promise<{ purged: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('purge_expired_chat', { p_years: RETENTION_YEARS });
  if (error) {
    console.error('[retention-sweep] purge failed:', error.message);
    return { purged: 0 };
  }
  const purged = typeof data === 'number' ? data : Number(data ?? 0);
  return { purged: Number.isFinite(purged) ? purged : 0 };
}

/**
 * CRON-FREE weekly retention sweep — replaces the Vercel Cron schedule (the route
 * stays as a manual/curl trigger). Fired from admin-layout after(); a WEEKLY DB
 * claim guarantees it runs ~once/week across the fleet and survives deploys.
 * Best-effort, never throws.
 */
export async function maybeRunRetentionSweep(): Promise<void> {
  try {
    if (await claimPeriodicJob('retention-sweep', WEEKLY_GAP_MS)) await runRetentionSweep();
  } catch {
    /* best-effort — a missed week retries on the next eligible admin request */
  }
}
