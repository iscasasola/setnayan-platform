import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * apps/web/lib/papic-one.ts
 *
 * Papic ONE — a DEDICATED camera: its own QR, its own UNSHARED point balance.
 * The sibling of lib/papic-pass-tiers.ts, which does the same job for the
 * SHARED Papic Pool rungs.
 *
 * ── THE MODEL (owner-locked 2026-07-29) ──────────────────────────────────
 *   free : ONE free One camera per event, 5 dedicated points.
 *   paid : 50 pts ₱50 · 100 pts ₱100 — PER CAMERA, ₱1 per photo flat, and no
 *          cap on how many an event buys.
 *   RELOADABLE: the same two rungs top up a camera that ALREADY exists,
 *          including the free one. That is the whole reason this module has a
 *          notion of a "target": a reload must not mint a second QR mid-event,
 *          because the guest holding the first one would be shooting at a dead
 *          camera while the couple's new shots sat somewhere they can't reach.
 *
 * ── WHERE THE NUMBERS LIVE ───────────────────────────────────────────────
 * Points come from `public.papic_one_tiers` (admin-editable, migration
 * 20271019231590); price comes from `platform_retail_catalog_v2`. Neither is
 * ever written as a literal in a display surface — the constants below are
 * LAST-RESORT fallbacks for a pre-migration read, exactly like
 * FALLBACK_TIERS in papic-pass-tiers.ts, and they are never a billing source.
 *
 * ── HOW A PURCHASE BECOMES POINTS ────────────────────────────────────────
 * The buy action writes ONE `papic_one_orders` row (order -> camera + rung +
 * snapshotted points). On approval, lib/sku-activation.ts calls
 * `papic_grant_camera_points`, which reads that row and writes ONE
 * `papic_event_point_grants` row with `seat_id` SET — which is what makes the
 * points dedicated: `papic_event_pool_status` sums only seat_id IS NULL rows,
 * so a One camera's shots are invisible to the shared pool and cannot be spent
 * by anybody else.
 */

/** The two live One rungs. Codes are LOCKED (never-rename lock). */
export const PAPIC_ONE_50_SKU = 'PAPIC_CAMERA_MINI_DAY';
export const PAPIC_ONE_100_SKU = 'PAPIC_ONE_100';

export type PapicOneTier = {
  serviceCode: string;
  points: number;
  sortOrder: number;
};

/**
 * Fallbacks — used ONLY when papic_one_tiers is unreadable (pre-migration).
 * Owner-locked 2026-07-29; the DB is the source of truth.
 */
export const FALLBACK_ONE_TIERS: readonly PapicOneTier[] = Object.freeze([
  { serviceCode: PAPIC_ONE_50_SKU, points: 50, sortOrder: 10 },
  { serviceCode: PAPIC_ONE_100_SKU, points: 100, sortOrder: 20 },
]);

type OneTierRow = {
  service_code?: string | null;
  points?: number | null;
  sort_order?: number | null;
};

/** PURE. Normalise + sort raw rows; drops anything unusable. */
export function normalisePapicOneTiers(rows: readonly OneTierRow[]): PapicOneTier[] {
  return rows
    .map((r) => ({
      serviceCode: typeof r.service_code === 'string' ? r.service_code : '',
      points: Number.isFinite(r.points) ? Math.max(0, Math.trunc(r.points as number)) : 0,
      sortOrder: Number.isFinite(r.sort_order) ? (r.sort_order as number) : 0,
    }))
    .filter((t) => t.serviceCode.length > 0 && t.points > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Every active One rung, cheapest first. Falls back rather than throwing. */
export async function fetchPapicOneTiers(db: SupabaseClient): Promise<PapicOneTier[]> {
  try {
    const { data, error } = await db
      .from('papic_one_tiers')
      .select('service_code, points, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) {
      return [...FALLBACK_ONE_TIERS];
    }
    const tiers = normalisePapicOneTiers(data as OneTierRow[]);
    return tiers.length > 0 ? tiers : [...FALLBACK_ONE_TIERS];
  } catch {
    return [...FALLBACK_ONE_TIERS];
  }
}

/**
 * PURE. Points one paid order of `serviceCode` grants, or null when the SKU is
 * not a One rung. Null is the "not my SKU" signal — callers must NOT read it as
 * zero, or a Pool order would look like a One order that grants nothing.
 */
export function papicOnePointsForSkuIn(
  tiers: readonly PapicOneTier[],
  serviceCode: string,
): number | null {
  return tiers.find((t) => t.serviceCode === serviceCode)?.points ?? null;
}

/** Async convenience over the live table. */
export async function papicOnePointsForSku(
  db: SupabaseClient,
  serviceCode: string,
): Promise<number | null> {
  return papicOnePointsForSkuIn(await fetchPapicOneTiers(db), serviceCode);
}

/** Is this SKU one of the Papic One rungs? */
export function isPapicOneSku(
  serviceCode: string,
  tiers: readonly PapicOneTier[] = FALLBACK_ONE_TIERS,
): boolean {
  return tiers.some((t) => t.serviceCode === serviceCode);
}

// ── the RELOAD-vs-NEW decision ─────────────────────────────────────────────

export type PapicOneTarget =
  | { mode: 'reload'; seatId: string }
  | { mode: 'new' }
  | { mode: 'rejected'; reason: 'unknown_seat' };

/**
 * PURE. Decide what a One purchase is aimed at.
 *
 * A reload names an EXISTING camera on THIS event; anything else is a new
 * camera. The rejection branch matters more than it looks: `reloadSeatId`
 * arrives from a form the couple controls, so a seat id belonging to a
 * DIFFERENT event must never be honoured — that would top up a stranger's
 * camera on this couple's money. Hence the caller passes the event's own seat
 * ids and an unrecognised one is refused outright rather than quietly demoted
 * to "new camera", which would charge for something they didn't ask for.
 */
export function resolvePapicOneTarget(
  reloadSeatId: string | null | undefined,
  eventSeatIds: readonly string[],
): PapicOneTarget {
  const wanted = (reloadSeatId ?? '').trim();
  if (!wanted) return { mode: 'new' };
  return eventSeatIds.includes(wanted)
    ? { mode: 'reload', seatId: wanted }
    : { mode: 'rejected', reason: 'unknown_seat' };
}

/** The `papic_one_orders` row a purchase writes. PURE + unit-tested. */
export type PapicOneOrderRow = {
  order_id: string;
  event_id: string;
  seat_id: string;
  service_code: string;
  points: number;
  is_reload: boolean;
};

export function papicOneOrderRow(input: {
  orderId: string;
  eventId: string;
  seatId: string;
  serviceCode: string;
  points: number;
  isReload: boolean;
}): PapicOneOrderRow {
  return {
    order_id: input.orderId,
    event_id: input.eventId,
    seat_id: input.seatId,
    service_code: input.serviceCode,
    // Snapshotted, deliberately: an admin editing papic_one_tiers tomorrow must
    // not silently reprice an order already in reconciliation today.
    points: input.points,
    is_reload: input.isReload,
  };
}

// ── the free One camera ────────────────────────────────────────────────────

/**
 * Last-resort mirror of `papic_event_pool_config.free_one_camera_points`. The
 * live value is admin-editable and is read by the SQL function itself, so this
 * literal exists ONLY so a display surface has something to render on a
 * pre-migration / service-key-less build. Same posture (and same one-place rule)
 * as PAPIC_FREE_GRANT_POINTS_FALLBACK in lib/papic-tier-copy.ts.
 */
export const PAPIC_FREE_ONE_POINTS_FALLBACK = 5;

/**
 * How many free Papic One cameras an event gets: exactly ONE.
 *
 * This is STRUCTURAL, not a tunable, which is why it is a constant here rather
 * than another admin column. `papic_ensure_free_one_camera` pins the free One
 * camera to a FIXED `seat_index` (110), so "does this event already have one?"
 * is a unique-key question — the (event_id, seat_index) UNIQUE plus the partial
 * index `papic_event_point_grants_one_free_camera_per_seat` make a second one
 * impossible. The admin column tunes the POINTS on that camera
 * (`free_one_camera_points`), never the count.
 *
 * ⚠ NOT the same number as `papicFreeCameraCount()`. That one reads
 * `papic_tier_config.free.seats_per_event` (3) and counts the free SHARED-POOL
 * seats — cameras that spend the event's shared 50-point pool. Those are a Papic
 * POOL fact. Reading it as a Papic One allowance is exactly the confusion that
 * made /pricing tell couples "your first 3 cameras are free" on the DEDICATED
 * product, where only one is.
 */
export const PAPIC_FREE_ONE_CAMERA_COUNT = 1;

/**
 * The LIVE dedicated-point allowance on the free One camera, straight from the
 * admin-editable column — the sibling of `fetchPapicFreeGrantPoints` in
 * lib/papic-tier-copy.ts, and for the same reason: `papic_ensure_free_one_camera`
 * reads this column to decide what to MINT, so any surface that quotes the number
 * must read the same column or the two drift the moment an admin edits it.
 *
 * Never throws; falls back to PAPIC_FREE_ONE_POINTS_FALLBACK in ONE place.
 */
export async function fetchPapicFreeOneCameraPoints(
  db: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await db
      .from('papic_event_pool_config')
      .select('free_one_camera_points')
      .eq('config_key', 'default')
      .maybeSingle();
    if (error || !data) return PAPIC_FREE_ONE_POINTS_FALLBACK;
    const n = Number((data as { free_one_camera_points?: unknown }).free_one_camera_points);
    // A 0 here is MEANINGFUL, not a miss: the SQL treats `<= 0` as "don't arm a
    // free camera at all", so a surface must be able to render that state (and
    // drop the free rung) rather than substituting the fallback and promising a
    // camera the meter will never mint.
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : PAPIC_FREE_ONE_POINTS_FALLBACK;
  } catch {
    return PAPIC_FREE_ONE_POINTS_FALLBACK;
  }
}

/**
 * Arm the ONE free Papic One camera for an event: a dedicated seat plus its
 * 5-point dedicated grant.
 *
 * Idempotent, best-effort, non-fatal — the same contract as
 * ensureFreePapicPoolGrantAdmin, and for the same reason: this runs from every
 * event-commit path AND lazily from the Papic studio, so it WILL run more than
 * once per event, and a hiccup must never cost a couple their event. The
 * idempotency lives in SQL (the (event_id, seat_index) UNIQUE plus the partial
 * unique index papic_event_point_grants_one_free_camera_per_seat), not here, so
 * two concurrent callers collapse to one camera rather than racing to two.
 *
 * MUST be called with an ADMIN (service-role) client: the grants ledger has no
 * INSERT policy and must not — a host granting themselves points is exactly what
 * the fence exists to stop.
 *
 * Returns the seat id when the event is armed, null when it is not (and the
 * next call should retry).
 */
export async function ensureFreePapicOneCameraAdmin(
  admin: SupabaseClient,
  eventId: string,
): Promise<string | null> {
  if (!eventId) return null;
  try {
    const { data, error } = await admin.rpc('papic_ensure_free_one_camera', {
      p_event_id: eventId,
    });
    if (error) return null;
    return typeof data === 'string' && data.length > 0 ? data : null;
  } catch {
    // Pre-bootstrap DB / missing function / transport hiccup. Never fatal: the
    // Papic-studio self-heal call retries on the next render.
    return null;
  }
}

/**
 * A camera's DEDICATED balance, or null when the seat is not a One camera (i.e.
 * it draws the shared pool). Display only — the fail-closed gate is
 * papic_reserve_camera_points.
 */
export async function fetchPapicOneDedicatedPoints(
  admin: SupabaseClient,
  seatId: string,
): Promise<number | null> {
  if (!seatId) return null;
  try {
    const { data, error } = await admin.rpc('papic_seat_dedicated_points', {
      p_seat_id: seatId,
    });
    if (error) return null;
    const n = Number(data);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
