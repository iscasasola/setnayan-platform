import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob, WEEKLY_GAP_MS } from '@/lib/periodic-jobs';

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

export async function runRetentionSweep(): Promise<{ purged: number; failed?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('purge_expired_chat', { p_years: RETENTION_YEARS });
  if (error) {
    console.error('[retention-sweep] purge failed:', error.message);
    // ⚠ `purged: 0` ALONE IS A LIE HERE. Zero is what a healthy sweep with
    // nothing due also returns, so the failure has to travel with the number —
    // otherwise the run records a confident, successful "deleted nothing".
    return { purged: 0, failed: error.message };
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
  await runClaimedJob('retention-sweep', WEEKLY_GAP_MS, async () => {
    const { purged, failed } = await runRetentionSweep();
    if (failed) throw new Error(`purge_expired_chat failed: ${failed}`);
    return purged;
  });
}
