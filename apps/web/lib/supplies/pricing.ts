import type { SupabaseClient } from '@supabase/supabase-js';

import type { PricingResult, ServiceAreaCode, VolumeTier } from './types';

/**
 * 0018 Setnayan Supplies — lowest-available-wholesale pricing resolver.
 *
 * Thin wrapper around the Postgres function public.resolve_supplies_pricing
 * (see supabase/migrations/20260519220000_iteration_0018_pricing_resolver_fn.sql).
 * The function does the heavy lifting:
 *
 *   1. Find all supplier_vendor_skus rows matching sku_code that are active
 *      and whose vendor is_supplier_vendor=TRUE.
 *   2. Join supplier_vendor_sku_pricing on (sku_id, service_area_code).
 *   3. Filter to pricing rows in their effective window with min_order_quantity
 *      satisfying the requested quantity.
 *   4. Apply the best volume tier (highest min_qty that quantity satisfies).
 *   5. Order ASC by effective wholesale, tiebreak ASC by sku_id, pick first.
 *   6. Retail = wholesale × 1.5 rounded to nearest peso (100 centavos).
 *
 * Spec rule locked 2026-05-19 (CLAUDE.md decision log row "0018 Setnayan
 * Supplies — lowest-available-wholesale pricing rule locked").
 *
 * Stale-price-resolution (cart → checkout) lives in a sibling function
 * recheckCartPricing() that ships in a subsequent PR alongside cart schema.
 * This function is the foundation: a stateless resolver over (sku_code, area,
 * quantity).
 *
 * Returns a discriminated PricingResult union. Callers MUST check `status`
 * before using fields like wholesale_centavos / retail_centavos.
 */

type ResolveArgs = {
  sku_code: string;
  service_area_code: ServiceAreaCode;
  quantity: number;
};

type ResolverRow = {
  sku_id: string;
  vendor_profile_id: string;
  category:
    | 'print_fulfillment'
    | 'equipment_rental'
    | 'decor_rental'
    | 'nfc_qr_keepsake'
    | 'specialty_merch';
  display_name: string;
  unit_of_measure: string;
  base_wholesale_centavos: number;
  effective_wholesale_centavos: number;
  retail_centavos: number;
  volume_tier_applied: VolumeTier | null;
  service_area_code: string;
};

export async function resolveSuppliesPricing(
  supabase: SupabaseClient,
  args: ResolveArgs,
): Promise<PricingResult> {
  if (args.quantity < 1 || !Number.isInteger(args.quantity)) {
    throw new Error(
      `resolveSuppliesPricing: quantity must be a positive integer, got ${args.quantity}`,
    );
  }
  if (!args.sku_code) {
    throw new Error('resolveSuppliesPricing: sku_code is required');
  }

  const { data, error } = await supabase.rpc('resolve_supplies_pricing', {
    p_sku_code: args.sku_code,
    p_service_area_code: args.service_area_code,
    p_quantity: args.quantity,
  });

  if (error) {
    throw new Error(
      `resolveSuppliesPricing RPC failed: ${error.message} (code=${error.code ?? 'n/a'})`,
    );
  }

  const rows = (data ?? []) as ResolverRow[];

  if (rows.length === 0) {
    return {
      status: 'unavailable',
      reason: 'no_vendor_in_area',
      sku_code: args.sku_code,
      service_area_code: args.service_area_code,
      quantity: args.quantity,
    };
  }

  const row = rows[0];
  return {
    status: 'available',
    sku_id: row.sku_id,
    sku_code: args.sku_code,
    vendor_profile_id: row.vendor_profile_id,
    category: row.category,
    display_name: row.display_name,
    unit_of_measure: row.unit_of_measure,
    base_wholesale_centavos: row.base_wholesale_centavos,
    effective_wholesale_centavos: row.effective_wholesale_centavos,
    retail_centavos: row.retail_centavos,
    volume_tier_applied: row.volume_tier_applied,
    service_area_code: args.service_area_code,
  };
}

/**
 * Helper: format centavos as a PHP retail label (₱1,234 — no decimals since
 * retail is always rounded to the nearest peso).
 */
export function formatRetailLabel(centavos: number): string {
  const pesos = Math.round(centavos / 100);
  return `₱${pesos.toLocaleString('en-PH')}`;
}
