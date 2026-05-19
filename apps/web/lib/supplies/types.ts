/**
 * 0018 Setnayan Supplies — shared types.
 *
 * Source of truth: spec corpus 0018_supplies_marketplace/0018_supplies_marketplace.md
 * Schema: supabase/migrations/20260519210000_iteration_0018_supplies_foundation.sql
 * Resolver: supabase/migrations/20260519220000_iteration_0018_pricing_resolver_fn.sql
 */

/** SKU category enum (mirrors the DB CHECK constraint on supplier_vendor_skus.category). */
export type SupplyCategory =
  | 'print_fulfillment'
  | 'equipment_rental'
  | 'decor_rental'
  | 'nfc_qr_keepsake'
  | 'specialty_merch';

export const SUPPLY_CATEGORY_LABEL: Record<SupplyCategory, string> = {
  print_fulfillment: 'Print fulfillment',
  equipment_rental: 'Equipment rentals',
  decor_rental: 'Backdrop + decor rentals',
  nfc_qr_keepsake: 'NFC + QR keepsakes',
  specialty_merch: 'Specialty merch',
};

/** Service area enum (mirrors the DB CHECK constraint on supplies_orders.delivery_service_area_code). V1 is Metro Manila only; V1.5+ adds more. */
export type ServiceAreaCode = 'METRO_MANILA';

export const SERVICE_AREA_LABEL: Record<ServiceAreaCode, string> = {
  METRO_MANILA: 'Metro Manila',
};

/**
 * Volume tier entry as stored in supplier_vendor_sku_pricing.volume_tiers JSONB.
 * Each entry says: at quantities >= min_qty, the wholesale unit price drops to wholesale_centavos.
 * Tiers are evaluated greedy-best: the tier with the highest min_qty that the order quantity satisfies wins.
 */
export type VolumeTier = {
  min_qty: number;
  wholesale_centavos: number;
};

/** Default markup pct on wholesale (50% markup → ~33% of retail). Mirrors the env-controllable SUPPLIES_DEFAULT_MARKUP_PCT but the DB function hardcodes 1.5 for V1. */
export const DEFAULT_MARKUP_PCT = 50;

/** Successful pricing resolution: a vendor was available and a quote was computed. */
export type PricingAvailable = {
  status: 'available';
  sku_id: string;
  sku_code: string;
  vendor_profile_id: string;
  category: SupplyCategory;
  display_name: string;
  unit_of_measure: string;
  base_wholesale_centavos: number;
  effective_wholesale_centavos: number;
  retail_centavos: number;
  volume_tier_applied: VolumeTier | null;
  service_area_code: ServiceAreaCode;
};

/** Failed pricing resolution: no supplier vendor available for this (sku_code, area, quantity). */
export type PricingUnavailable = {
  status: 'unavailable';
  reason:
    | 'no_vendor_in_area' // no active supplier carries this sku_code in this area
    | 'min_quantity_unmet'; // suppliers exist but their min_order_quantity excludes the requested qty
  sku_code: string;
  service_area_code: ServiceAreaCode;
  quantity: number;
};

export type PricingResult = PricingAvailable | PricingUnavailable;

/** Delivery address shape couples submit at cart/checkout. */
export type DeliveryAddress = {
  street?: string;
  barangay?: string;
  city: string;
  province?: string;
  postal_code?: string;
  contact_phone?: string;
};
