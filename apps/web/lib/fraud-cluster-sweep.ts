import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * CRON-FREE fraud cluster sweep — replaces the deleted /api/cron/fraud-cluster-
 * sweep. Refreshes the identity-cluster matview then raises admin concentration
 * WATCH flags (shadow mode). Fired from the ADMIN layout `after()` so the heavy
 * `REFRESH MATERIALIZED VIEW` never rides an end-user request; a durable single-
 * row compare-and-swap on platform_settings.fraud_cluster_sweep_last_run_at makes
 * it run ~once/day across the fleet and survive deploys (mirrors
 * lib/admin/digest-flush.ts). Cheap in-memory pre-throttle so most admin renders
 * never touch the DB. Best-effort, never throws.
 *
 * Gated on device-fingerprint capture (concentration is only meaningful once
 * device edges feed the clusters) — read via env, same as the retired route.
 * Trade-off vs a cron: if literally no admin visits for a day it skips that day,
 * which is acceptable — the pipeline is shadow/human-review (staleness only
 * delays admin surfacing, never mis-acts), clusters are ALSO kept fresh by the
 * review/booking stat-refresh triggers, and an admin "Run now" fallback covers a
 * long absence.
 */
const FRAUD_SWEEP_CHECK_THROTTLE_MS = 30 * 60 * 1000;
const FRAUD_SWEEP_MIN_GAP_MS = 20 * 60 * 60 * 1000;
let lastFraudSweepCheckMs = 0;

export async function maybeRunFraudClusterSweep(): Promise<void> {
  // Pipeline activates with device-fingerprint capture (env, build-time inlined).
  if (process.env.NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED !== 'true') return;

  const nowMs = Date.now();
  if (nowMs - lastFraudSweepCheckMs < FRAUD_SWEEP_CHECK_THROTTLE_MS) return;
  lastFraudSweepCheckMs = nowMs;

  try {
    const admin = createAdminClient();
    const nowIso = new Date(nowMs).toISOString();
    const cutoffIso = new Date(nowMs - FRAUD_SWEEP_MIN_GAP_MS).toISOString();

    // Atomic daily claim on the platform_settings singleton (id=1).
    const { data: claim } = await admin
      .from('platform_settings')
      .update({ fraud_cluster_sweep_last_run_at: nowIso })
      .eq('id', 1)
      .or(`fraud_cluster_sweep_last_run_at.is.null,fraud_cluster_sweep_last_run_at.lt.${cutoffIso}`)
      .select('id');
    if (!claim || claim.length === 0) return; // throttled, lost the race, or no row

    // Step 1 — refresh the linkage matview. If it errors, don't run step 2 on
    // stale clusters (the claim is already spent; next window retries).
    const { error: refreshErr } = await admin.rpc('refresh_identity_clusters' as never);
    if (refreshErr) {
      console.error('[fraud-cluster-sweep] refresh failed:', refreshErr.message);
      return;
    }
    // Step 2 — raise admin concentration WATCH flags (human-review only).
    await admin.rpc('detect_inquiry_concentration' as never, {} as never);
  } catch {
    // Best-effort — a missed run just retries on the next eligible admin request.
  }
}
