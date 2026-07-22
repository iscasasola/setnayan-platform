import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePointsGate, type PointsGateVerdict } from './papic-cameras';

// ── Papic ONE-POOL capture gate (guest-camera route boundary) ────────────────
//
// The two RPC-backed decisions the guest-capture route (app/api/papic/
// guest-capture/route.ts) makes against the ONE shared event pool — extracted
// here so the reserve-before-record ordering + the FALSE→409 mapping are unit-
// testable without importing the route's `server-only` chain (R2 / Drive). The
// seat path (app/papic/actions.ts) keeps its own inline copy because it combines
// the event pool with the per-seat gate; this module is the guest-route seam.
//
// Free / Papic One / Papic Pool all draw this same pool (papic_event_point_grants
// → papic_reserve_event_points); a non-applies event (no grant / no pass) is a
// no-op on both helpers (remaining = MAXINT, reserve = TRUE without a ledger row).

/**
 * Fail-OPEN orphan-byte pre-check: returns true iff the shared event pool is
 * ALREADY definitively exhausted for a capture of `cost` points, so the caller
 * can 409 before any R2 PUT (keeps R2 free of orphans for the common exhausted
 * case). Fails OPEN by design — a non-applies event returns MAXINT (no-op) and
 * ANY RPC error skips the optimization; the authoritative reserve below is the
 * real gate, so a false-negative here never over-books.
 */
export async function papicEventPoolPreCheckExhausted(
  admin: SupabaseClient,
  eventId: string,
  cost: number,
): Promise<boolean> {
  const { data: remaining, error } = await admin.rpc('papic_event_points_remaining', {
    p_event_id: eventId,
  });
  return !error && typeof remaining === 'number' && remaining < cost;
}

export type PapicEventPoolReserve = { outcome: PointsGateVerdict; booked: boolean };

/**
 * AUTHORITATIVE, race-safe, fail-CLOSED reserve: atomically books `cost` points
 * against the shared event pool. Returns the gate verdict and whether points
 * were actually booked. Mapping the caller applies:
 *   • 'exhausted' → 409 `camera_points_exhausted`
 *   • 'blocked'   → 503 `points_check_failed`
 *   • 'allow'     → proceed
 * `booked` is TRUE only when the RPC returned exactly `true` (a fn-not-found
 * 'allow' books nothing, so there is nothing to unwind); the caller releases
 * `booked` points if the subsequent record fails. Fail-CLOSED on every RPC error
 * EXCEPT function-not-found (the seam-cutover carve-out inside resolvePointsGate).
 */
export async function papicReserveEventPoolForCapture(
  admin: SupabaseClient,
  eventId: string,
  cost: number,
): Promise<PapicEventPoolReserve> {
  const { data: poolOk, error } = await admin.rpc('papic_reserve_event_points', {
    p_event_id: eventId,
    p_cost: cost,
  });
  const outcome = resolvePointsGate(
    error ? (error.code ?? 'unknown') : null,
    poolOk === true ? true : poolOk === false ? false : null,
  );
  return { outcome, booked: poolOk === true };
}
