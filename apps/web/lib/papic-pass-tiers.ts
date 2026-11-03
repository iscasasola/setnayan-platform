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

import { dropRetiredPapicTiers } from '@/lib/papic-retired-service-codes';

export type PapicPassTier = {
  serviceCode: string;
  points: number;
  isTopup: boolean;
  sortOrder: number;
};

/*
  🪤 `PAPIC_TOPUP_UNLOCK_POINTS` LIVED HERE AND HAD ZERO READERS — an exported
  constant that read as a rule ("points a couple must already hold before the
  repeatable top-up unlocks") while nothing anywhere enforced it. Deleted
  2026-08-26 with the sixteen-rung ladder, because the concept it described is
  gone twice over: `PAPIC_GUEST_TOPUP` was retired in 2026-07-29 and EVERY rung
  is additive and repeatable now, so there is nothing to unlock.

  It is called out rather than quietly removed because this is the smallest
  version of the shape this codebase keeps paying for: a value that states a
  threshold, is exported, is cited in another module's docblock — and gates
  nothing. Anybody reading it would have believed a rule that was not there.
*/

/**
 * Fallbacks — used ONLY when papic_pass_tiers is unreadable (pre-migration).
 * Owner-set 2026-07-20; the DB is the source of truth.
 */
export const FALLBACK_TIERS: readonly PapicPassTier[] = Object.freeze([
  // The three packs (owner 2026-11-03). A fallback is never a price: a rung whose catalogue row is missing or off sale
  // still disappears from every stepper (`loadPoolRungs`).
  { serviceCode: 'PAPIC_GUEST_150', points: 150, isTopup: false, sortOrder: 3 },
  { serviceCode: 'PAPIC_GUEST_1K', points: 1_000, isTopup: false, sortOrder: 30 },
  { serviceCode: 'PAPIC_GUEST', points: 3_000, isTopup: false, sortOrder: 40 },
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
    .sort((a, b) => a.sortOrder - b.sortOrder)
    // Papic is CREDITS. A retired seat / per-camera-per-day model may never
    // become a tier again, whatever `platform_retail_catalog_v2` says — an
    // admin toggle must not be able to resurrect a product on its own.
    .filter((t) => dropRetiredPapicTiers([t]).length === 1);
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

  // 🔴 BOTH EXITS ARE FILTERED, NOT JUST THE NORMALISED ONE. This function can
  // return WITHOUT passing through `normalise` — on a DB error, on an empty
  // table, and on a normalise that filtered everything away. A retired model
  // sitting in FALLBACK_TIERS would walk straight out of those exits. One
  // guarded exit and one unguarded exit is the same as none.
  if (error || !Array.isArray(data) || data.length === 0) {
    return dropRetiredPapicTiers(FALLBACK_TIERS);
  }
  const tiers = normalise(data as TierRow[]);
  return tiers.length > 0 ? tiers : dropRetiredPapicTiers(FALLBACK_TIERS);
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

/**
 * Points a PAID order of `serviceCode` must grant — the tier row's own points WHETHER OR NOT the rung is still on sale.
 * Only `grantPapicPassPoints` (lib/sku-activation.ts) reads this; anything that SELLS keeps `papicPassPointsForSku`.
 *
 * 🚨 WHY IT EXISTS (2026-11-03, Papic became three packs). Activation used to read ACTIVE tiers only, so a rung retired
 * between payment and approval — a GCash order still awaiting the admin, an App Store purchase already charged — was
 * marked paid and granted ZERO credits: no throw, no log. Retiring fourteen rungs at once would have done that to
 * every such order. A customer who paid gets what the rung said when they paid.
 *
 * Top-up rows (`is_topup`) are left out on purpose: `PAPIC_GUEST_TOPUP`'s retirement (2026-07-29) was written to
 * resolve to zero, and this does not reopen that decision. Retired camera models stay dropped (`dropRetiredPapicTiers`).
 */
export async function papicPointsBoughtBySku(db: SupabaseClient, serviceCode: string): Promise<number | null> {
  const live = await papicPassPointsForSku(db, serviceCode);
  if (live !== null) return live;
  const { data, error } = await db
    .from('papic_pass_tiers')
    .select('service_code, points, is_topup, sort_order')
    .eq('service_code', serviceCode)
    .eq('is_topup', false)
    .maybeSingle();
  if (error) {
    // Logged, never swallowed: a paid order that grants nothing must leave a trace.
    console.error('[supabase-error] lib/papic-pass-tiers.ts · papic_pass_tiers (retired rung read)', error);
    return null;
  }
  if (!data) return null;
  return normalise([data as TierRow])[0]?.points ?? null;
}

/** Is this SKU one of the purchased point buckets? */
export function isPapicPassSku(
  serviceCode: string,
  tiers: readonly PapicPassTier[],
): boolean {
  return tiers.some((t) => t.serviceCode === serviceCode);
}
