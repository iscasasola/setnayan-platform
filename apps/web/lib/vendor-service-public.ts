/**
 * vendor-service-public.ts — COUPLE-FACING reads of the service-card child
 * tables (service-card redesign · Phase 4, migration 20270502342558 activated).
 *
 * These fetchers surface a vendor's service-card enrichment to couples on the
 * public profile: FREE inclusions (with a stated worth), the single BEST
 * applicable discount, and the Fixed-basis pax brackets. They are deliberately
 * SEPARATE from `lib/vendor-services.ts` (which the vendor-dashboard forms own)
 * so the public render path never depends on the vendor-write module.
 *
 * Scope + safety:
 *   • These run under the server-role admin client on the public profile page
 *     (which bypasses RLS), so we scope the read ourselves — only child rows
 *     belonging to the caller-supplied `serviceIds` are returned, and the
 *     caller only ever passes ids of ALREADY-ACTIVE services on an
 *     ALREADY-PUBLISHED vendor. The child tables' own public-read policies add
 *     the same published+active gate for any authenticated (non-admin) reader.
 *   • Every fetch is fail-soft: a missing table / RLS hiccup / unapplied
 *     migration degrades to an empty map rather than crashing the profile.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
// READ-ONLY type imports from the vendor-write module (we do not touch it).
import type { DiscountType, VendorServiceDiscount } from '@/lib/vendor-services';

// ── Inclusions ──────────────────────────────────────────────────────────────
/** A FREE item bundled in a service card, with an optional stated peso worth. */
export type VendorServiceInclusion = {
  vendor_service_id: string;
  label: string;
  /** Peso worth shown as free value ("₱X free"); null = included, no worth. */
  worth_php: number | null;
  sort_order: number;
};

/**
 * Inclusions for a set of service ids, grouped by service and pre-sorted by
 * sort_order. Fail-soft to an empty map.
 */
export async function fetchInclusionsByService(
  supabase: SupabaseClient,
  serviceIds: string[],
): Promise<Map<string, VendorServiceInclusion[]>> {
  const out = new Map<string, VendorServiceInclusion[]>();
  if (serviceIds.length === 0) return out;
  const { data, error } = await supabase
    .from('vendor_service_inclusions')
    .select('vendor_service_id,label,worth_php,sort_order')
    .in('vendor_service_id', serviceIds)
    .order('sort_order', { ascending: true });
  if (error) return out;
  for (const row of (data ?? []) as VendorServiceInclusion[]) {
    const list = out.get(row.vendor_service_id) ?? [];
    list.push(row);
    out.set(row.vendor_service_id, list);
  }
  return out;
}

// ── Price brackets (Fixed-basis pax tiers) ──────────────────────────────────
/** A locked price for a guest-count band on a Fixed-basis service. */
export type VendorServicePriceBracket = {
  vendor_service_id: string;
  /** null = from 0. */
  min_pax: number | null;
  /** null = "any size" (open bracket ⇒ a flat price). */
  max_pax: number | null;
  price_php: number;
  sort_order: number;
};

/**
 * Fixed-basis pax brackets for a set of service ids, grouped by service and
 * pre-sorted by sort_order. Fail-soft to an empty map.
 */
export async function fetchPriceBracketsByService(
  supabase: SupabaseClient,
  serviceIds: string[],
): Promise<Map<string, VendorServicePriceBracket[]>> {
  const out = new Map<string, VendorServicePriceBracket[]>();
  if (serviceIds.length === 0) return out;
  const { data, error } = await supabase
    .from('vendor_service_price_brackets')
    .select('vendor_service_id,min_pax,max_pax,price_php,sort_order')
    .in('vendor_service_id', serviceIds)
    .order('sort_order', { ascending: true });
  if (error) return out;
  for (const row of (data ?? []) as VendorServicePriceBracket[]) {
    const list = out.get(row.vendor_service_id) ?? [];
    list.push(row);
    out.set(row.vendor_service_id, list);
  }
  return out;
}

// ── Discounts (couple sees the single BEST applicable one) ──────────────────
/**
 * Discounts for a set of service ids, grouped by service (public read path).
 * Mirrors the vendor-dashboard's fetchDiscountsByService but lives here so the
 * public surface owns its own read. Fail-soft to an empty map.
 */
export async function fetchDiscountsByServicePublic(
  supabase: SupabaseClient,
  serviceIds: string[],
): Promise<Map<string, VendorServiceDiscount[]>> {
  const out = new Map<string, VendorServiceDiscount[]>();
  if (serviceIds.length === 0) return out;
  const { data, error } = await supabase
    .from('vendor_service_discounts')
    .select('vendor_service_id,discount_type,rate,unit,expires_at,conditions_md,sort_order')
    .in('vendor_service_id', serviceIds)
    .order('sort_order', { ascending: true });
  if (error) return out;
  for (const row of (data ?? []) as VendorServiceDiscount[]) {
    const list = out.get(row.vendor_service_id) ?? [];
    list.push(row);
    out.set(row.vendor_service_id, list);
  }
  return out;
}

/** Human labels for the 5 discount types, benefit-forward (sell the value). */
const DISCOUNT_TYPE_LABEL: Record<DiscountType, string> = {
  early_booking: 'early booking',
  off_peak: 'off-season',
  bundle: 'bundle',
  promo: 'limited-time',
  returning: 'returning couple',
};

export type BestDiscount = {
  /** Short badge copy, e.g. "20% off · early booking" or "₱2,000 off · bundle". */
  label: string;
  /** Peso value saved on the anchor, used only to rank; not shown directly. */
  savingsPhp: number;
  type: DiscountType;
};

/**
 * Pick the single BEST applicable discount to show a couple among the several a
 * vendor may offer on one service.
 *
 * Heuristic (simple + honest — documented in the changelog):
 *   1. Drop expired discounts (`expires_at` in the past). A discount with no
 *      expiry never expires.
 *   2. Among the survivors, pick the one that saves the couple the MOST pesos on
 *      the "from ₱X" anchor:
 *        • pct → anchor × rate / 100
 *        • php → rate (capped at the anchor so a flat amount ≥ price reads as
 *          "up to ₱anchor off", never a negative price)
 *   3. Ties break by sort_order (the vendor's own display priority), which the
 *      fetch already applied — so a stable pick falls out of the ordered list.
 *
 * Returns null when there is no applicable discount or no positive anchor to
 * measure savings against (a pct discount is meaningless without a base price).
 */
export function pickBestDiscount(
  discounts: ReadonlyArray<VendorServiceDiscount> | undefined,
  anchorPhp: number | null,
): BestDiscount | null {
  if (!discounts || discounts.length === 0) return null;
  const now = Date.now();
  const hasAnchor = anchorPhp !== null && anchorPhp > 0;

  let best: BestDiscount | null = null;
  for (const d of discounts) {
    // 1 — skip expired.
    if (d.expires_at && Date.parse(d.expires_at) <= now) continue;

    // 2 — compute peso savings on the anchor.
    let savingsPhp: number;
    if (d.unit === 'pct') {
      // A percentage is only meaningful with a positive base price.
      if (!hasAnchor) continue;
      savingsPhp = Math.round(((anchorPhp as number) * d.rate) / 100);
    } else {
      // Flat peso amount; cap at the anchor so a ≥-price flat never over-counts.
      savingsPhp = hasAnchor ? Math.min(d.rate, anchorPhp as number) : d.rate;
    }
    if (savingsPhp <= 0) continue;

    if (best === null || savingsPhp > best.savingsPhp) {
      const amountLabel =
        d.unit === 'pct'
          ? `${formatRate(d.rate)}% off`
          : `₱${Math.round(d.rate).toLocaleString('en-PH')} off`;
      best = {
        label: `${amountLabel} · ${DISCOUNT_TYPE_LABEL[d.discount_type]}`,
        savingsPhp,
        type: d.discount_type,
      };
    }
  }
  return best;
}

/** Trim a numeric rate to a clean display (drop a trailing .0). */
function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : String(Number(rate.toFixed(1)));
}
