/**
 * V2 · 14-token stacking reward calculator (Phase E read-path).
 *
 * WHY THIS LIVES HERE
 * -------------------
 * v2.1 brief § 5 + CLAUDE.md 2026-05-22 fifth row lock the per-event
 * stacking reward ladder: a vendor who delivers N distinct Setnayan
 * media services on the same wedding earns 1 / 3 / 5 / 7 / 9 / 11 / 14
 * tokens (capped at 14 for 7+ services).
 *
 * The 7 services (papic / panood / patiktok / pabati / sde /
 * camera_bridge / live_wall) prove delivery through service-specific
 * telemetry checkpoints written to `public.telemetry_events` by the
 * 7 POST endpoints under /api/telemetry/<svc>. This module is the
 * READ-PATH: it counts distinct `service_code` per (vendor, event) in
 * a rolling window and converts the count to the reward amount.
 *
 * WHAT THIS MODULE DOES NOT DO (V1.x post-pilot scope)
 * ----------------------------------------------------
 * • Does NOT grant tokens · only computes the eligible amount. The
 *   reward-fanout job that actually credits the vendor's wallet via
 *   `consume_vendor_assets()` (or a token_grants_log INSERT) ships in
 *   the V1.x post-pilot Phase E follow-up — same place the
 *   telemetry_events.processed_at + token_grant_id columns get
 *   populated.
 * • Does NOT enforce idempotency · the calling job is responsible for
 *   ensuring a given (vendor, event) only ever fires one reward grant.
 *   This module is pure read.
 * • Does NOT filter out telemetry rows already linked to a granted
 *   reward — that's a calling-job concern.
 *
 * Cross-references: v2.1 brief § 5 + § 11 · telemetry_events migration
 * 20260704010000 · CLAUDE.md third 2026-05-28 row Phase E scope.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The 7 V2 media services that produce telemetry signals.
 * Mirrors the CHECK constraint on telemetry_events.service_code.
 */
export const STACKING_SERVICE_CODES = [
  'papic',
  'panood',
  'patiktok',
  'pabati',
  'sde',
  'camera_bridge',
  'live_wall',
] as const;

export type StackingServiceCode = (typeof STACKING_SERVICE_CODES)[number];

/**
 * Default rolling window for counting telemetry signals.
 *
 * 30 days covers the realistic pre-wedding + day-of + post-wedding
 * delivery window for media services. Phase E reward-fanout job (V1.x)
 * can override per-event if a couple has a longer prep window OR a
 * shorter post-wedding archive cycle.
 */
export const DEFAULT_STACKING_WINDOW_DAYS = 30;

/**
 * Stacking reward table — v2.1 § 5.
 *
 * Counts higher than 7 cap at 14 (the 7-service ceiling). Counts <= 0
 * return 0 (no signal · no reward · safe default).
 */
export function calculateStackingReward(serviceCount: number): number {
  if (!Number.isFinite(serviceCount) || serviceCount <= 0) return 0;
  if (serviceCount === 1) return 1;
  if (serviceCount === 2) return 3;
  if (serviceCount === 3) return 5;
  if (serviceCount === 4) return 7;
  if (serviceCount === 5) return 9;
  if (serviceCount === 6) return 11;
  // 7 services or more — cap at 14.
  return 14;
}

/**
 * Count DISTINCT service_codes the vendor has signalled on this event
 * within the rolling window. Returns 0 on any error · safe default for
 * a calculator that should never explode the calling job.
 *
 * Uses the admin client because reward-fanout runs server-side without
 * a user session. RLS still enabled on telemetry_events · admin reads
 * via is_admin().
 */
export async function countVendorServicesInWindow(
  vendorProfileId: string,
  eventId: string,
  windowDays: number = DEFAULT_STACKING_WINDOW_DAYS,
  client?: SupabaseClient,
): Promise<number> {
  if (!vendorProfileId || !eventId) return 0;
  const safeWindow = Math.max(1, Math.floor(windowDays));
  const cutoffIso = new Date(Date.now() - safeWindow * 24 * 60 * 60 * 1000).toISOString();

  let supabase: SupabaseClient;
  try {
    supabase = client ?? createAdminClient();
  } catch {
    return 0;
  }

  const { data, error } = await supabase
    .from('telemetry_events')
    .select('service_code')
    .eq('related_vendor_profile_id', vendorProfileId)
    .eq('related_event_id', eventId)
    .gte('received_at', cutoffIso);

  if (error || !data) return 0;

  // Dedup service_code in app code — Supabase JS doesn't expose SELECT
  // DISTINCT, and a follow-up admin GROUP-BY view is V1.x scope.
  const distinct = new Set<string>();
  for (const row of data) {
    const code = (row as { service_code?: unknown }).service_code;
    if (typeof code === 'string' && code.length > 0) distinct.add(code);
  }
  return distinct.size;
}

/**
 * Compose count + reward for a (vendor, event) pair.
 *
 * Returns the distinct service count + the matched reward amount. Both
 * fields are zero on missing inputs or query errors — calling jobs
 * decide whether to log the zero or treat it as a no-op.
 */
export async function evaluateStackingRewardForVendor(
  vendorProfileId: string,
  eventId: string,
  options: { windowDays?: number; client?: SupabaseClient } = {},
): Promise<{ serviceCount: number; tokensEarned: number }> {
  const serviceCount = await countVendorServicesInWindow(
    vendorProfileId,
    eventId,
    options.windowDays ?? DEFAULT_STACKING_WINDOW_DAYS,
    options.client,
  );
  return {
    serviceCount,
    tokensEarned: calculateStackingReward(serviceCount),
  };
}
