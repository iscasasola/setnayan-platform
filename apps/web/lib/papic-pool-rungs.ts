/**
 * lib/papic-pool-rungs.ts — THE CREDIT LADDER, read once, for every place that
 * sells it: the Papic page's `PapicPoolCard` and Home's in-place "Buy more"
 * (owner 2026-10-13 📍 — the same stepper, never a second price list).
 *
 * Rungs READ from `papic_pass_tiers` (admin-editable, `is_active` filtered in
 * the fetch), price READ from `platform_retail_catalog_v2` — the single billing
 * source. A rung whose catalog row is missing, zero or inactive DISAPPEARS
 * rather than rendering at an invented price. No literal peso figure or credit
 * count appears here. Sorted by PRICE, so the stepper's + always costs more.
 *
 * `is_topup` rungs are excluded: PAPIC_GUEST_TOPUP is RETIRED (every rung is
 * additive since migration 20271019231590), and `purchasePapicPoolTopUp`
 * refuses it too — the ladder and the charge path agree.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPapicPassTiers } from '@/lib/papic-pass-tiers';
import { papicRungDiscountPercent } from '@/lib/papic-tier-copy';

export type PoolRung = {
  serviceCode: string;
  points: number;
  pricePhp: number;
  /** Whole-percent saving against ₱1 a credit, or null when there is none. */
  discountPercent: number | null;
};

export async function loadPoolRungs(admin: SupabaseClient): Promise<PoolRung[]> {
  const sellable = (await fetchPapicPassTiers(admin)).filter((t) => !t.isTopup);
  if (sellable.length === 0) return [];
  const prices = await fetchPoolRungPrices(admin, sellable.map((t) => t.serviceCode));
  return sellable
    .map((t) => ({ serviceCode: t.serviceCode, points: t.points, pricePhp: prices.get(t.serviceCode) ?? null }))
    .filter((t): t is { serviceCode: string; points: number; pricePhp: number } => t.pricePhp != null && t.pricePhp > 0)
    .sort((a, b) => a.pricePhp - b.pricePhp)
    .map((t) => ({ ...t, discountPercent: papicRungDiscountPercent(t.points, t.pricePhp) }));
}

/** Live rung prices, straight from the catalog — the single billing source. */
async function fetchPoolRungPrices(admin: SupabaseClient, codes: readonly string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (codes.length === 0) return out;
  try {
    const { data, error } = await admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, is_active')
      .in('service_code', codes as string[]);
    if (error) {
      // No price shown rather than a guessed one — and the reason is kept.
      console.error('[supabase-error] papic pack prices: platform_retail_catalog_v2', error);
      return out;
    }
    if (!Array.isArray(data)) return out;
    for (const row of data) {
      if ((row as { is_active?: unknown }).is_active !== true) continue;
      const n = Number((row as { retail_price_php?: unknown }).retail_price_php ?? 0);
      if (Number.isFinite(n) && n > 0) {
        out.set(String((row as { service_code?: unknown }).service_code ?? ''), n);
      }
    }
    return out;
  } catch {
    return out;
  }
}
