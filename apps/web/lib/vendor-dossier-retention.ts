import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob, WEEKLY_GAP_MS } from '@/lib/periodic-jobs';

/**
 * Deep Search dossier retention sweep — a data-minimization TTL on
 * `vendor_web_dossiers` (RA 10173 · storage-limitation principle).
 *
 * Deep Search (vendor-run + admin-verification) writes a web-gathered research
 * dossier per run. That data is transient + regenerable (a fresh run re-fetches
 * it), so it should not be retained indefinitely. This hard-deletes dossiers past
 * the retention window; the vendor's own usage rows (vendor_deep_search_uses)
 * reference dossier_id ON DELETE SET NULL, so a purged old dossier simply becomes
 * "no longer re-openable", never a dangling FK.
 *
 * CRON-FREE ([[project_setnayan_cron_free]]): driven from admin-layout after()
 * traffic behind a WEEKLY claim (claim_periodic_job compare-and-swap), matching
 * runRetentionSweep. A single idempotent DELETE, effectively a no-op until rows
 * age past the window — safe to drive from request traffic. Never throws.
 *
 * NOTE: this touches ONLY the stored research data. The /privacy legal notice is
 * owner/DPO-owned and is deliberately untouched here.
 */

/** Retain Deep Search dossiers for 180 days, then purge. */
const DOSSIER_RETENTION_DAYS = 180;

export async function runVendorDossierRetention(): Promise<{ purged: number }> {
  const admin = createAdminClient();
  const cutoffIso = new Date(
    Date.now() - DOSSIER_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from('vendor_web_dossiers')
    .delete()
    .lt('created_at', cutoffIso)
    .select('id');
  if (error) {
    console.error('[vendor-dossier-retention] purge failed:', error.message);
    return { purged: 0 };
  }
  return { purged: Array.isArray(data) ? data.length : 0 };
}

/**
 * CRON-FREE weekly Deep Search dossier purge — fired from admin-layout after();
 * a WEEKLY DB claim guarantees it runs ~once/week across the fleet and survives
 * deploys. Best-effort, never throws.
 */
export async function maybeRunVendorDossierRetention(): Promise<void> {
  try {
    if (await claimPeriodicJob('vendor-dossier-retention', WEEKLY_GAP_MS)) {
      await runVendorDossierRetention();
    }
  } catch {
    /* best-effort — a missed week retries on the next eligible admin request */
  }
}
