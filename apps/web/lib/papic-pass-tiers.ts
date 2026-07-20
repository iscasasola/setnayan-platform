import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * apps/web/lib/papic-pass-tiers.ts
 *
 * Papic One — the PURCHASED point buckets.
 *
 * A couple buys N shots and gets N shots, however many guests turn up. Pax is
 * SIZING GUIDANCE, never a gate: Papic One grants unlimited GUESTS and the pool
 * bounds CAPTURES, not PEOPLE. A 500-guest couple may buy the ₱500 rung; it just
 * means ~6 points each.
 *
 * ── NOT THE SAME THING AS THE GUEST-DERIVED FENCE ────────────────────────
 * lib/papic-event-pool.ts computes clamp(guests × 150, 5000, 30000) for products
 * that PROMISE unlimited — papic_event_pool_config.pass_service_codes is
 * ['PAPIC_UNLOCK','PAPIC_UNLOCK_LTD']. These tiers are self-bounding, so they
 * are deliberately absent from that list and the migration asserts it stays that
 * way. Adding one would layer a guest-derived formula on top of a purchased
 * bucket and hand a ₱500 buyer up to 30,000 points.
 *
 * ── HOW A PURCHASE BECOMES POINTS ────────────────────────────────────────
 * On payment, lib/sku-activation.ts writes ONE row to papic_event_point_grants
 * (source 'topup_order', order_id set). The pool sums grants into its total, so
 * "uncapped and repeatable" needs no new machinery — it is just another row.
 *
 * Values live in public.papic_pass_tiers (admin-editable). The constants below
 * are LAST-RESORT fallbacks for a pre-migration read, mirroring the camera-rate
 * fallback pattern in lib/papic-cameras.ts. They are never a billing source:
 * price always comes from platform_retail_catalog_v2.
 *
 * Corpus: 0012_papic/Papic_Pricing_Lock_2026-07-20.md § 2.3 + § 11.
 */

export type PapicPassTier = {
  serviceCode: string;
  points: number;
  isTopup: boolean;
  sortOrder: number;
};

/** Points a couple must already hold before the repeatable top-up unlocks. */
export const PAPIC_TOPUP_UNLOCK_POINTS = 10_000;

/**
 * Fallbacks — used ONLY when papic_pass_tiers is unreadable (pre-migration).
 * Owner-set 2026-07-20; the DB is the source of truth.
 */
const FALLBACK_TIERS: readonly PapicPassTier[] = Object.freeze([
  { serviceCode: 'PAPIC_GUEST', points: 3_000, isTopup: false, sortOrder: 10 },
  { serviceCode: 'PAPIC_GUEST_6K', points: 6_000, isTopup: false, sortOrder: 20 },
  { serviceCode: 'PAPIC_GUEST_10K', points: 10_000, isTopup: false, sortOrder: 30 },
  { serviceCode: 'PAPIC_GUEST_TOPUP', points: 10_000, isTopup: true, sortOrder: 40 },
]);

type TierRow = {
  service_code?: string | null;
  points?: number | null;
  is_topup?: boolean | null;
  sort_order?: number | null;
};

function normalise(rows: readonly TierRow[]): PapicPassTier[] {
  return rows
    .map((r) => ({
      serviceCode: typeof r.service_code === 'string' ? r.service_code : '',
      points: Number.isFinite(r.points) ? Math.max(0, Math.trunc(r.points as number)) : 0,
      isTopup: r.is_topup === true,
      sortOrder: Number.isFinite(r.sort_order) ? (r.sort_order as number) : 0,
    }))
    .filter((t) => t.serviceCode.length > 0 && t.points > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Every active tier, cheapest first. Falls back rather than throwing. */
export async function fetchPapicPassTiers(
  db: SupabaseClient,
): Promise<PapicPassTier[]> {
  const { data, error } = await db
    .from('papic_pass_tiers')
    .select('service_code, points, is_topup, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) {
    return [...FALLBACK_TIERS];
  }
  const tiers = normalise(data as TierRow[]);
  return tiers.length > 0 ? tiers : [...FALLBACK_TIERS];
}

/**
 * Points granted by one paid order of `serviceCode`, or null when the SKU is not
 * a Papic One tier. Null is the "not my SKU" signal — callers must not treat it
 * as zero.
 */
export async function papicPassPointsForSku(
  db: SupabaseClient,
  serviceCode: string,
): Promise<number | null> {
  const tiers = await fetchPapicPassTiers(db);
  return tiers.find((t) => t.serviceCode === serviceCode)?.points ?? null;
}

/** Is this SKU one of the purchased point buckets? */
export function isPapicPassSku(
  serviceCode: string,
  tiers: readonly PapicPassTier[],
): boolean {
  return tiers.some((t) => t.serviceCode === serviceCode);
}
