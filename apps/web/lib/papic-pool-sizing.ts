import type { SupabaseClient } from '@supabase/supabase-js';

import {
  computeEventPool,
  DEFAULT_EVENT_POOL_CONFIG,
  type EventPoolConfig,
  type EventPoolDerivation,
} from './papic-event-pool';

/**
 * HOW MANY CREDITS THIS *KIND* OF CELEBRATION WANTS PER HEAD.
 *
 * Owner, 2026-09-22: *"how about the credit recommendation? we also want that.
 * based on they type of event and the number of guest."*
 *
 * ── THE GAP THIS CLOSES ────────────────────────────────────────────────────
 * `papic_event_pool_config` shipped as a SINGLETON — one row, `config_key =
 * 'default'` — and every reader in the tree pins that key. So the formula
 *
 *     pool = clamp(guests × points_per_guest, floor_points, ceiling_points)
 *
 * quoted **150 credits a head to a christening, a debut and a wedding alike**.
 * Event type did not exist as a dimension. Migration
 * `20271239794268_papic_pool_sizing_knows_the_event_type` adds one row per
 * `event_type_vocab` type; this module is how the app reads them.
 *
 * ── 🛑 THE PER-HEAD NUMBER ALONE WOULD HAVE SHIPPED BROKEN ────────────────
 * The clamp is part of the answer, not decoration. With the global floor of
 * 5,000 a 2-guest `date` at 50/head computes 100 and is clamped **UP to
 * 5,000** — about ₱3,360 of credits recommended for a dinner for two. So a
 * sizing row carries `floor_points` and `ceiling_points` too, and
 * {@link pickPoolSizing} returns all three together. Taking only the per-head
 * figure from a type row and the clamp from the global row is exactly the bug;
 * the return type makes that unrepresentable.
 *
 * ── ⚠ TWO KINDS OF ROW, ONE TABLE ─────────────────────────────────────────
 * `'default'` is the GLOBAL row and owns every column. Any other key is a
 * SIZING row and **only `points_per_guest`, `floor_points` and `ceiling_points`
 * are ever read from it** — see {@link POOL_CONFIG_SIZING_COLUMNS} and
 * {@link POOL_CONFIG_GLOBAL_COLUMNS}. `soft_stop_pct`, `free_grant_points` and
 * the rest are seeded copies kept only because those columns are NOT NULL, and
 * they are inert. `scripts/lint-pool-config-global-columns.mjs` fails the build
 * on any read of a global column that is not pinned to `config_key =
 * 'default'`, so the rule is a mechanism rather than this paragraph.
 *
 * ── THE SQL TWIN ──────────────────────────────────────────────────────────
 * `public.papic_event_pool_sizing(text)` implements the identical resolution,
 * and `papic_event_pool_status` now sizes the DB-side fence through it. The
 * figure the app SHOWS and the figure the fence ENFORCES therefore cannot
 * drift — the property `computeEventPool` already held for the formula, held
 * one dimension wider.
 *
 * 🔑 IT INVENTS NO NUMBER. Every figure is a row an admin can edit; the 17 seed
 * values are the owner's own, confirmed 2026-09-22 (CLAUDE.md rule 9).
 */

/** The ONLY columns read from a per-event-type sizing row. */
export const POOL_CONFIG_SIZING_COLUMNS = Object.freeze([
  'points_per_guest',
  'floor_points',
  'recommend_floor_points',
  'ceiling_points',
] as const);

/**
 * Columns that live on the `'default'` row alone. A read of any of these MUST
 * pin `config_key = 'default'`; on a sizing row they are inert seeded copies.
 * `scripts/lint-pool-config-global-columns.mjs` reads this list.
 */
export const POOL_CONFIG_GLOBAL_COLUMNS = Object.freeze([
  'soft_stop_pct',
  'pass_service_codes',
  'is_active',
  'camera_grant_points',
  'free_grant_points',
  'free_one_camera_points',
] as const);

/** The global row's key. Not a magic string at any call site. */
export const POOL_CONFIG_DEFAULT_KEY = 'default';

/** One row of `papic_event_pool_config`, narrowed to what sizing needs. */
export type PoolSizingRow = {
  config_key: string;
  points_per_guest: number;
  /** The ENTITLEMENT floor — what the pool fence meters against. */
  floor_points: number;
  /** What we RECOMMEND a couple buys. Never above `floor_points`. */
  recommend_floor_points: number;
  ceiling_points: number;
};

export type PoolSizing = Pick<
  EventPoolConfig,
  'pointsPerGuest' | 'floorPoints' | 'ceilingPoints'
> & {
  /**
   * ⚠ THE FLOOR FOR A *RECOMMENDATION*, WHICH IS NOT `floorPoints`.
   *
   * `floorPoints` is the ENTITLEMENT — the smallest pool a celebration of this
   * kind is metered against, and it is 5,000 for every type, exactly as it was
   * before this dimension existed. This one is the smallest pool we SUGGEST
   * they buy, and it is 0 for every type but a wedding.
   *
   * 🔑 ONE NUMBER USED TO DO BOTH JOBS, and that is precisely how the first cut
   * of this build shipped a money change nobody asked for: lowering the floor so
   * a 2-guest `date` was not told to buy 5,000 credits ALSO cut what a `date`
   * was entitled to. Recommending less than the entitlement is always safe;
   * they are separate fields so the two can never be confused again.
   */
  recommendFloorPoints: number;
  /**
   * WHICH ROW ANSWERED — the event type, or `'default'` when it fell back.
   * A screen may say "sized for a christening" only when this is the type;
   * inventing that sentence off a fallback is the lie this field prevents.
   */
  sizedBy: string;
};

/** The last-resort sizing, used when the table cannot be read at all. */
export const FALLBACK_POOL_SIZING: PoolSizing = Object.freeze({
  pointsPerGuest: DEFAULT_EVENT_POOL_CONFIG.pointsPerGuest,
  floorPoints: DEFAULT_EVENT_POOL_CONFIG.floorPoints,
  // The fallback recommends what every event was recommended before per-type
  // rows existed — the global floor. Falling back to 0 would quietly recommend
  // LESS whenever the config table could not be read.
  recommendFloorPoints: DEFAULT_EVENT_POOL_CONFIG.floorPoints,
  ceilingPoints: DEFAULT_EVENT_POOL_CONFIG.ceilingPoints,
  sizedBy: POOL_CONFIG_DEFAULT_KEY,
});

function intOrNull(n: unknown): number | null {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 0 ? v : null;
}

function rowToSizing(row: PoolSizingRow): PoolSizing | null {
  const pointsPerGuest = intOrNull(row.points_per_guest);
  const floorPoints = intOrNull(row.floor_points);
  const ceilingPoints = intOrNull(row.ceiling_points);
  // ⚠ A MISSING RECOMMENDATION FLOOR FALLS BACK TO THE ENTITLEMENT, not to 0.
  // 0 would silently recommend less than every event was recommended yesterday.
  const recommendFloorPoints = intOrNull(row.recommend_floor_points) ?? floorPoints;
  if (pointsPerGuest == null || floorPoints == null || ceilingPoints == null) {
    return null;
  }
  return {
    pointsPerGuest,
    floorPoints,
    recommendFloorPoints: recommendFloorPoints ?? floorPoints,
    ceilingPoints,
    sizedBy: row.config_key,
  };
}

/**
 * PURE. The event type's own row when it exists, else the global row, else null.
 *
 * ⚠ A FALLBACK IS CORRECT HERE AND A BUILD FAILURE ELSEWHERE. At runtime an
 * unpriced type must quote *something*, and the global 150/head is exactly
 * today's behaviour — silent, safe, unchanged. What must never be silent is a
 * type going unpriced in the first place, and the migration refuses to apply
 * when any `event_type_vocab` row has no sizing row. Two different jobs; this
 * one is "never show a couple a blank".
 */
export function pickPoolSizing(
  rows: readonly PoolSizingRow[],
  eventType: string | null | undefined,
): PoolSizing | null {
  const key = typeof eventType === 'string' ? eventType.trim() : '';
  if (key && key !== POOL_CONFIG_DEFAULT_KEY) {
    const own = rows.find((r) => r.config_key === key);
    if (own) {
      const sized = rowToSizing(own);
      if (sized) return sized;
    }
  }
  const fallback = rows.find((r) => r.config_key === POOL_CONFIG_DEFAULT_KEY);
  return fallback ? rowToSizing(fallback) : null;
}

/**
 * What this celebration is recommended, with the arithmetic that produced it.
 *
 * 🔑 THE DERIVATION IS RETURNED, NOT JUST THE TOTAL. The credits block on the
 * Papic controller shows its own sums — "146 guests × 150 = 21,900" — and a
 * screen cannot show working it was never given. `EventPoolDerivation` already
 * carries `rawPoints`, `flooredUp` and `cappedDown`, which is precisely the
 * difference between "you need 5,000" and "you need 5,000, because the floor
 * lifted your 100".
 */
export function recommendedCredits(
  guestCount: number,
  sizing: PoolSizing,
): EventPoolDerivation & { sizedBy: string } {
  return {
    ...computeEventPool(guestCount, {
      pointsPerGuest: sizing.pointsPerGuest,
      // 🔑 THE RECOMMENDATION FLOOR, NOT THE ENTITLEMENT ONE. This function
      // answers "what should they buy", and a 2-guest `date` must not be told
      // to buy the 5,000 credits it is merely entitled to be metered against.
      floorPoints: sizing.recommendFloorPoints,
      ceilingPoints: sizing.ceilingPoints,
    }),
    sizedBy: sizing.sizedBy,
  };
}

/**
 * Read the two candidate rows in ONE round trip and resolve them.
 *
 * Returns {@link FALLBACK_POOL_SIZING} on a refused read rather than throwing:
 * this sizes a RECOMMENDATION, and a recommendation that disappears because a
 * config table was briefly unreadable is worse than one quoted at the figure
 * every event was quoted at yesterday. The caller is told which happened
 * through `sizedBy`.
 */
export async function fetchEventPoolSizing(
  client: SupabaseClient,
  eventType: string | null,
): Promise<PoolSizing> {
  const keys = [POOL_CONFIG_DEFAULT_KEY];
  if (eventType && eventType !== POOL_CONFIG_DEFAULT_KEY) keys.push(eventType);

  const { data, error } = await client
    .from('papic_event_pool_config')
    // ⚠ INLINE, NOT `POOL_CONFIG_SIZING_COLUMNS.join()`.
    // `lib/security/select-column-scan.ts` (GUARD 2 of `pnpm lint:dup-rule`)
    // resolves a select's column list statically; a constant-built string is
    // invisible to it, and teaching that scanner an exception for this one call
    // is how a ratchet stops meaning anything. The constant is still the source
    // of truth — `papic-pool-sizing-columns-match.test.ts` fails if the literal
    // here and the constant ever diverge, in either direction.
    .select('points_per_guest, floor_points, recommend_floor_points, ceiling_points, config_key')
    .in('config_key', keys);

  if (error || !data) {
    if (error) {
      console.error(
        '[supabase-error] lib/papic-pool-sizing.ts · from:papic_event_pool_config.select',
        error,
      );
    }
    return FALLBACK_POOL_SIZING;
  }

  return (
    pickPoolSizing(data as unknown as PoolSizingRow[], eventType) ??
    FALLBACK_POOL_SIZING
  );
}
