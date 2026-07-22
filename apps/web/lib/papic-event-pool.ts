import type { SupabaseClient } from '@supabase/supabase-js';
import type { PointsGateVerdict } from '@/lib/papic-cameras';

/**
 * apps/web/lib/papic-event-pool.ts
 *
 * The EVENT-SCOPED capture fence for a FLAT PER-EVENT PASS (Phase 0c).
 *
 * ── THE PROBLEM ──────────────────────────────────────────────────────────
 * Papic meters per CAMERA per DAY (lib/papic-cameras.ts + the points RPCs in
 * migration 20270821110100). A flat per-event PASS — PAPIC_UNLOCK (₱15,000),
 * PAPIC_UNLOCK_LTD (₱9,000), and the ₱1,499 flat pass the monetization council
 * proposed — currently bypasses that metering entirely: both enforcement seams
 * wrap the points gate in `if (!unlocked)`. A pass event is therefore an
 * unbounded capture free-for-all, which at the fat tail (300 pax) MODELS to
 * ~24% gross margin against a ₱1,499 pass. (A model, not a measurement: Papic
 * is pre-revenue — zero PAPIC_CAMERA_* orders have ever been placed.)
 *
 * ── THE FENCE ────────────────────────────────────────────────────────────
 * One EVENT-LIFETIME capture-points pool, consulted ALONGSIDE the per-camera
 * budget. The TIGHTER of the two wins (see {@link combinePointsGates}). Same
 * point costs as the ladder: 1 photo = 1 pt · 1 ten-second clip = 7 pts.
 *
 * ── THE FORMULA (pricing-relevant · admin-tunable, NOT hardcoded) ─────────
 *   pool = clamp(guestCount × pointsPerGuest, floorPoints, ceilingPoints)
 *
 * The council's flat-10,000-point proposal was a **3× TIGHTENING**: the SHIPPED
 * model is 150 credits PER GUEST (lib/papic-guest.ts · GUEST_CAPTURE_CREDITS),
 * i.e. ~30,000 captures at 200 pax, so a flat 10,000 is only 66 pts/guest at
 * 150 pax — tighter than today above 66 pax. Shipping a 50% price cut and a 67%
 * capacity cut together reads as a downgrade, and against a rival advertising
 * "unlimited uploads" it is the single bound most likely to generate a refund.
 *
 * So the pool is re-derived from GUEST COUNT and the defaults are chosen to be
 * **non-tightening**:
 *   • pointsPerGuest 150  — EXACTLY the shipped per-guest allowance. At 150 pax
 *                           the pool is 22,500 pts = 150 × 150 today. Identical.
 *   • floorPoints  5,000  — a small-event floor (≈ a 33-pax equivalent) so a
 *                           20-pax intimate wedding isn't fenced at 3,000.
 *   • ceilingPoints 30,000— the fat-tail brake, set at today's 200-pax shipped
 *                           equivalent (200 × 150). It binds ONLY above 200 pax,
 *                           which is precisely where an unbounded pass takes the
 *                           flat-pass margin under water.
 *   • softStopPct  85     — where the UI warns, before the hard stop.
 * Below 200 pax the fence is >= what the shipped model already granted. Nothing
 * gets smaller. Above 200 pax the ceiling is the only place it binds.
 *
 * Live values come from public.papic_event_pool_config (admin-editable, single
 * 'default' row). The constants below are LAST-RESORT fallbacks used only when
 * the config table is missing (pre-migration) — same pattern as the camera rate
 * fallbacks in lib/papic-cameras.ts.
 *
 * ── SCOPE FENCE ──────────────────────────────────────────────────────────
 * The pool applies ONLY to events holding an ACTIVE flat pass (the config's
 * pass_service_codes). Every non-pass event reads back "unlimited" from every
 * function here, so today's behaviour is byte-identical.
 *
 * ── FAIL POSTURE ─────────────────────────────────────────────────────────
 * Identical to the per-camera gate: fail-CLOSED on every RPC error EXCEPT
 * function-not-found (the seam-cutover carve-out). This is money logic — a
 * metering outage must block, not silently un-fence a pass event.
 */

/** Config row shape (public.papic_event_pool_config, key 'default'). */
export type EventPoolConfig = {
  pointsPerGuest: number;
  floorPoints: number;
  ceilingPoints: number;
  softStopPct: number;
};

/**
 * LAST-RESORT fallbacks — used only when papic_event_pool_config is absent
 * (pre-migration DB). The live, owner-tunable values live in the table.
 */
export const DEFAULT_EVENT_POOL_CONFIG: EventPoolConfig = Object.freeze({
  pointsPerGuest: 150, // = GUEST_CAPTURE_CREDITS (lib/papic-guest.ts)
  floorPoints: 5_000,
  ceilingPoints: 30_000,
  softStopPct: 85,
});

/** Sentinel "no fence on this event" remaining, mirroring the SQL MAXINT. */
export const EVENT_POOL_UNLIMITED_REMAINING = 2_147_483_647;

export type EventPoolDerivation = {
  guestCount: number;
  /** Raw guestCount × pointsPerGuest, BEFORE the floor/ceiling clamp. */
  rawPoints: number;
  /** The clamped base pool (excludes top-up grants). */
  basePoints: number;
  /** True when the floor lifted the pool (small event). */
  flooredUp: boolean;
  /** True when the ceiling clamped the pool (fat tail). */
  cappedDown: boolean;
  /** Points at which the UI should show the soft-stop warning. */
  softStopAt: number;
};

/** Clamp any input to a non-negative integer. */
function nonNegInt(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * The pool formula. PURE + unit-tested — the single source the SQL
 * (papic_event_pool_status) mirrors, so the fence the app displays and the
 * fence the DB enforces can never drift.
 *
 *   pool = clamp(guestCount × pointsPerGuest, floorPoints, ceilingPoints)
 */
export function computeEventPool(
  guestCount: number,
  config: Partial<EventPoolConfig> = {},
): EventPoolDerivation {
  const pointsPerGuest =
    Number.isFinite(Number(config.pointsPerGuest)) &&
    Number(config.pointsPerGuest) >= 0
      ? Math.floor(Number(config.pointsPerGuest))
      : DEFAULT_EVENT_POOL_CONFIG.pointsPerGuest;
  const floorPoints =
    Number.isFinite(Number(config.floorPoints)) && Number(config.floorPoints) >= 0
      ? Math.floor(Number(config.floorPoints))
      : DEFAULT_EVENT_POOL_CONFIG.floorPoints;
  const ceilingRaw =
    Number.isFinite(Number(config.ceilingPoints)) &&
    Number(config.ceilingPoints) >= 0
      ? Math.floor(Number(config.ceilingPoints))
      : DEFAULT_EVENT_POOL_CONFIG.ceilingPoints;
  // A misconfigured ceiling below the floor must never invert the clamp.
  const ceilingPoints = Math.max(ceilingRaw, floorPoints);
  const softStopPctRaw = Math.floor(Number(config.softStopPct));
  const softStopPct =
    Number.isFinite(softStopPctRaw) && softStopPctRaw > 0 && softStopPctRaw <= 100
      ? softStopPctRaw
      : DEFAULT_EVENT_POOL_CONFIG.softStopPct;

  const n = nonNegInt(guestCount);
  const rawPoints = n * pointsPerGuest;
  const basePoints = Math.min(ceilingPoints, Math.max(floorPoints, rawPoints));

  return {
    guestCount: n,
    rawPoints,
    basePoints,
    flooredUp: rawPoints < floorPoints,
    cappedDown: rawPoints > ceilingPoints,
    softStopAt: Math.floor((basePoints * softStopPct) / 100),
  };
}

/**
 * Combine the per-SEAT verdict and the per-EVENT verdict — the TIGHTER wins.
 *
 * PURE + unit-tested. Precedence, strictest first:
 *   blocked > exhausted > allow
 * so a fail-closed 'blocked' on either side blocks, a definitive 'exhausted' on
 * either side is exhausted, and only allow+allow allows.
 */
export function combinePointsGates(
  seat: PointsGateVerdict,
  event: PointsGateVerdict,
): PointsGateVerdict {
  if (seat === 'blocked' || event === 'blocked') return 'blocked';
  if (seat === 'exhausted' || event === 'exhausted') return 'exhausted';
  return 'allow';
}

export type EventPoolStatus = {
  /** False for every non-pass event — the fence is absent, nothing is metered. */
  applies: boolean;
  guestCount: number;
  basePoints: number;
  grantedPoints: number;
  totalPoints: number;
  usedPoints: number;
  remainingPoints: number;
  softStopAt: number;
  /** True once usage crosses the soft-stop line (UI warns BEFORE the hard stop). */
  soft: boolean;
};

/** The "no fence here" status — what every non-pass event reads back. */
export const EVENT_POOL_ABSENT: EventPoolStatus = Object.freeze({
  applies: false,
  guestCount: 0,
  basePoints: 0,
  grantedPoints: 0,
  totalPoints: 0,
  usedPoints: 0,
  remainingPoints: EVENT_POOL_UNLIMITED_REMAINING,
  softStopAt: 0,
  soft: false,
});

type PoolStatusRow = {
  applies?: boolean | null;
  guest_count?: number | null;
  base_points?: number | null;
  granted_points?: number | null;
  total_points?: number | null;
  used_points?: number | null;
  remaining_points?: number | null;
  soft_stop_at?: number | null;
};

/**
 * Shape a papic_event_pool_status row into the app type. PURE + unit-tested so
 * the soft-stop threshold logic isn't duplicated across the seams.
 */
export function shapeEventPoolStatus(
  row: PoolStatusRow | null | undefined,
): EventPoolStatus {
  if (!row || row.applies !== true) return EVENT_POOL_ABSENT;
  const totalPoints = nonNegInt(row.total_points);
  const usedPoints = nonNegInt(row.used_points);
  const softStopAt = nonNegInt(row.soft_stop_at);
  return {
    applies: true,
    guestCount: nonNegInt(row.guest_count),
    basePoints: nonNegInt(row.base_points),
    grantedPoints: nonNegInt(row.granted_points),
    totalPoints,
    usedPoints,
    remainingPoints: nonNegInt(row.remaining_points),
    softStopAt,
    soft: softStopAt > 0 && usedPoints >= softStopAt,
  };
}

/**
 * Read an event's pool status (admin client — the capture surfaces are public /
 * claimer sessions, and the ledger tables carry no read policy on purpose).
 *
 * Graceful-degrade to EVENT_POOL_ABSENT on ANY error: this is the DISPLAY read
 * that drives the soft-stop banner, NOT a gate. The gate is the reserve RPC,
 * which fails CLOSED on its own. Degrading the display never widens the fence.
 */
export async function fetchEventPoolStatus(
  admin: SupabaseClient,
  eventId: string,
): Promise<EventPoolStatus> {
  if (!eventId) return EVENT_POOL_ABSENT;
  try {
    const { data, error } = await admin.rpc('papic_event_pool_status', {
      p_event_id: eventId,
    });
    if (error) return EVENT_POOL_ABSENT;
    // SETOF-returning plpgsql surfaces as an array through PostgREST.
    const row = Array.isArray(data)
      ? (data[0] as PoolStatusRow | undefined)
      : (data as PoolStatusRow | null);
    return shapeEventPoolStatus(row);
  } catch {
    return EVENT_POOL_ABSENT;
  }
}
