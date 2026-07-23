import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchEventPoolStatus,
  type EventPoolStatus,
} from '@/lib/papic-event-pool';

/**
 * apps/web/lib/papic-pool-meter.ts
 *
 * HOST-side display shaping for the Papic capture-point pool (build ③ PR-1 —
 * the read-only pool meter). Study:
 * ~/Documents/Claude/Projects/Setnayan/OnTheDay_App_Build_Studies_2026-07-23.md § 3
 *
 * This file adds NO new data path. The single source of pool truth stays the
 * shipped machinery in lib/papic-event-pool.ts:
 *   • papic_event_pool_status (SECURITY DEFINER RPC) — base/granted/total/used/
 *     remaining, applies=FALSE when the event holds neither a flat pass nor any
 *     ledger grant (20270902148488 § 3a).
 *   • fetchEventPoolStatus — the graceful-degrade shaper the seat capture path
 *     already uses (its previously-only caller: app/papic/actions.ts).
 * Consumption is recorded event-wide in papic_event_pool_usage (one row per
 * event, bumped atomically by papic_reserve_event_points). Grants live in
 * papic_event_point_grants, tagged by `source` ('admin' · 'topup_order' ·
 * 'comp' · 'migration' · 'free_grant' · 'camera_grant') and order_id.
 *
 * ── PAPIC ONE / DEDICATED-PER-CAMERA CAVEAT (owner 2026-07-23) ────────────
 * Papic One points are meant to be DEDICATED per camera, not pooled. The
 * shipped ledger does NOT model that: 'camera_grant' rows carry event_id +
 * order_id only (no seat scope), and usage is a single per-event counter with
 * no seat attribution — so a per-camera "dedicated remaining" cannot be
 * derived from what exists. Per the build brief, this reader therefore reports
 * the ONE shared pool (which is exactly what the reserve RPC enforces today)
 * and does not attempt a shared-vs-dedicated split. Modelling dedication is a
 * ledger change owned by a later, supervised PR — do not bolt it on here.
 *
 * ── DISPLAY, NOT A GATE ───────────────────────────────────────────────────
 * Same posture as fetchEventPoolStatus: this drives a meter, never blocks a
 * capture. The fail-closed gate is papic_reserve_event_points. Returning null
 * here only hides the card.
 */

/** Amber line: the meter warns once remaining falls BELOW this % of total. */
export const POOL_METER_LOW_PCT = 10;

export type HostPoolMeterLevel = 'ok' | 'low' | 'exhausted';

export type HostPoolMeter = {
  /** Full pool capacity = clamped guest-derived base + every ledger grant. */
  totalPoints: number;
  /** Guest-derived base (0 on grant-only events per 20270902148488 § 3a). */
  basePoints: number;
  /** SUM of papic_event_point_grants (admin/top-up/comp/free/camera — shared). */
  grantedPoints: number;
  usedPoints: number;
  remainingPoints: number;
  /** 0–100, clamped — how much of the pool is spent. */
  pctUsed: number;
  /** 0–100, clamped — how much of the pool is left. */
  pctRemaining: number;
  /**
   * 'exhausted' at 0 remaining · 'low' below POOL_METER_LOW_PCT remaining ·
   * 'ok' otherwise. (The DB's own soft_stop_at — default 85% used — keeps
   * driving the capture-surface warning; this level only styles the host card.)
   */
  level: HostPoolMeterLevel;
};

/**
 * Shape a pool status into the host meter. PURE + unit-tested.
 *
 * Returns null when there is nothing to meter: the pool doesn't apply to this
 * event (no flat pass, no grants — the unlimited legacy posture), or the
 * status is degenerate (non-positive total, only possible under a
 * misconfigured pool config). A null meter renders no card.
 */
export function shapeHostPoolMeter(
  status: EventPoolStatus | null | undefined,
): HostPoolMeter | null {
  if (!status || status.applies !== true) return null;
  const totalPoints = status.totalPoints;
  if (!Number.isFinite(totalPoints) || totalPoints <= 0) return null;

  // Clamp into the ledger's invariants (grants > 0, usage >= 0) so a shaping
  // anomaly can never render a negative bar or a >100% meter.
  const usedPoints = Math.min(Math.max(0, status.usedPoints), totalPoints);
  const remainingPoints = Math.min(
    Math.max(0, status.remainingPoints),
    totalPoints,
  );

  const pctUsed = Math.min(
    100,
    Math.max(0, Math.round((usedPoints / totalPoints) * 100)),
  );
  const pctRemaining = Math.min(
    100,
    Math.max(0, Math.round((remainingPoints / totalPoints) * 100)),
  );

  // Level from RAW ratios, not the rounded pcts — a 9.6%-remaining pool must
  // read 'low' even though pctRemaining rounds to 10.
  const level: HostPoolMeterLevel =
    remainingPoints <= 0
      ? 'exhausted'
      : remainingPoints * 100 < totalPoints * POOL_METER_LOW_PCT
        ? 'low'
        : 'ok';

  return {
    totalPoints,
    basePoints: Math.max(0, status.basePoints),
    grantedPoints: Math.max(0, status.grantedPoints),
    usedPoints,
    remainingPoints,
    pctUsed,
    pctRemaining,
    level,
  };
}

/**
 * Read the host meter for an event. Thin composition over the SHIPPED reader —
 * same admin-client requirement (the ledger tables carry no read policy on
 * purpose; papic_event_pool_status is SECURITY DEFINER), same
 * graceful-degrade: any RPC problem surfaces as EVENT_POOL_ABSENT and shapes
 * to null (card hidden), never a broken page.
 */
export async function fetchHostPoolMeter(
  admin: SupabaseClient,
  eventId: string,
): Promise<HostPoolMeter | null> {
  return shapeHostPoolMeter(await fetchEventPoolStatus(admin, eventId));
}
