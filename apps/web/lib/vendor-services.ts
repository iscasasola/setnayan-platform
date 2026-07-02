import type { SupabaseClient } from '@supabase/supabase-js';
import type { VendorCategory } from '@/lib/vendors';

export type VendorServiceRow = {
  vendor_service_id: string;
  public_id: string;
  vendor_profile_id: string;
  category: string;
  /** Per-listing name (#1 multi-service-per-leaf); null → fall back to category label. */
  title: string | null;
  starting_price_php: number | null;
  /** Optional surcharge (PHP) per guest above the quoted count; null/blank =
   *  no extra charge for added pax (Adaptive Pax Pricing, 2026-06-13). */
  added_pax_price_php: number | null;
  // ── Pricing basis (service-card redesign · migration 20270502342558) ────
  /** How the "from ₱X" anchor is computed. starting_price_php stays the synced
   *  anchor for ALL bases (Explore/budget read it). */
  pricing_basis: 'fixed' | 'per_pax' | 'per_hour';
  /** Per-pax basis: rate per guest + the minimum pax floor (anchor = rate×min). */
  per_pax_price_php: number | null;
  min_pax: number | null;
  /** Per-hour basis: base covers min_hours; extra hours bill per extra_hour_php. */
  hour_base_php: number | null;
  min_hours: number | null;
  extra_hour_php: number | null;
  crew_size: number | null;
  /** Legacy: TRUE = couple provides the crew meal. Kept in sync as the inverse of
   *  crew_meal_included so the 0007 budget's Crew-Meal line still triggers. */
  crew_meal_required: boolean;
  /** TRUE = crew meal is in the price. FALSE = not included (the card flags it). */
  crew_meal_included: boolean;
  /** TRUE = transport included within coverage. FALSE = not included. */
  transport_included: boolean;
  /** Flat transport fee (PHP) when transport not included; null = quote-by-distance. */
  transport_flat_fee_php: number | null;
  /** Card cover photo ref (required to publish; the wizard + inline forms set it). */
  primary_photo_r2_key: string | null;
  /** Showcase clip (≤30s) r2 ref; null = none. primary_photo_r2_key stays the cover. */
  showcase_video_r2_key: string | null;
  /** Showcase gallery r2 refs (DB CHECK cardinality ≤5). */
  showcase_photo_r2_keys: string[];
  is_active: boolean;
  /** Branch this service belongs to (Branches V1.x); null = main/unassigned. */
  branch_id: string | null;
  /** Recommended lead time (Setnayan AI §4, vendor-owned 2026-06-16): the
   *  normal/comfortable lead in months for regular effort — the START of this
   *  service's last-minute range. null → no recommended lead → no last-minute
   *  range → always bookable whenever the schedule permits. Fractional allowed. */
  recommended_lead_time_months: number | null;
  /** Last-minute floor / hard cutoff (Setnayan AI §4): still accepts a booking
   *  until this many months before the wedding. null → 0 = until the night before. */
  last_minute_end_months: number | null;
  /** Optional 0–100% last-minute surcharge; null/0 = flat. */
  last_minute_surcharge_pct: number | null;
  /** Vendor-declared max bookings/day for this service (#2); null = unset. */
  daily_capacity: number | null;
  // Discounts moved OFF vendor_services into the vendor_service_discounts table
  // (multi-discount; couples see the best they qualify for · migration
  // 20270502342558). Fetch them with fetchDiscountsByService.
  // ── Setnayan Exclusive perk (v2.1 §7.2) ─────────────────────────────────
  /** Never shown publicly. Revealed in-thread when the vendor token-pursues.
   *  Required to publish (is_active=true). Drafts may be null. */
  exclusive_perk_text: string | null;
  // ── Coverage-first rework (migration 20270426250948) ────────────────────
  /** Guests the starting_price_php covers; pairs with added_pax_price_php
   *  (per-guest surcharge above this count). null = flat / not pax-priced. */
  base_pax: number | null;
  /** The vendor_coverages row this card belongs to; null on legacy rows,
   *  which still resolve via the coarse `category` column. */
  coverage_id: number | null;
  created_at: string;
  updated_at: string;
};

const BASE_COLS =
  'vendor_service_id,public_id,vendor_profile_id,category,starting_price_php,added_pax_price_php,crew_size,crew_meal_required,is_active,created_at,updated_at';
const PRICING_COLS =
  'pricing_basis,per_pax_price_php,min_pax,hour_base_php,min_hours,extra_hour_php,crew_meal_included,transport_included,transport_flat_fee_php,showcase_video_r2_key,showcase_photo_r2_keys';
const FULL_SELECT = `${BASE_COLS},title,branch_id,recommended_lead_time_months,last_minute_end_months,last_minute_surcharge_pct,daily_capacity,exclusive_perk_text,base_pax,coverage_id,primary_photo_r2_key,${PRICING_COLS}`;

export async function fetchVendorServices(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorServiceRow[]> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select(FULL_SELECT)
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) {
    // Graceful fallback when branch_id isn't in the DB yet (migration
    // 20260824000000 pending) — read the base columns + default branch_id null
    // so the page renders identically to a vendor with no branch assignments.
    const fallback = await supabase
      .from('vendor_services')
      .select(BASE_COLS)
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: true });
    if (fallback.error) throw new Error(`fetchVendorServices failed: ${fallback.error.message}`);
    return (fallback.data ?? []).map((s) => ({
      ...(s as Omit<
        VendorServiceRow,
        | 'title'
        | 'branch_id'
        | 'recommended_lead_time_months'
        | 'last_minute_end_months'
        | 'last_minute_surcharge_pct'
        | 'daily_capacity'
        | 'exclusive_perk_text'
        | 'base_pax'
        | 'coverage_id'
        | 'pricing_basis'
        | 'per_pax_price_php'
        | 'min_pax'
        | 'hour_base_php'
        | 'min_hours'
        | 'extra_hour_php'
        | 'crew_meal_included'
        | 'transport_included'
        | 'transport_flat_fee_php'
        | 'primary_photo_r2_key'
        | 'showcase_video_r2_key'
        | 'showcase_photo_r2_keys'
      >),
      title: null,
      branch_id: null,
      recommended_lead_time_months: null,
      last_minute_end_months: null,
      last_minute_surcharge_pct: null,
      daily_capacity: null,
      exclusive_perk_text: null,
      base_pax: null,
      coverage_id: null,
      pricing_basis: 'fixed',
      per_pax_price_php: null,
      min_pax: null,
      hour_base_php: null,
      min_hours: null,
      extra_hour_php: null,
      crew_meal_included: false,
      transport_included: false,
      transport_flat_fee_php: null,
      primary_photo_r2_key: null,
      showcase_video_r2_key: null,
      showcase_photo_r2_keys: [],
    }));
  }
  return (data ?? []) as VendorServiceRow[];
}

// ── Multi-discount (vendor_service_discounts · migration 20270502342558) ────
export type DiscountType = 'early_booking' | 'off_peak' | 'bundle' | 'promo' | 'returning';
export type VendorServiceDiscount = {
  vendor_service_id: string;
  discount_type: DiscountType;
  /** Positive rate; `unit` says whether it's a percent or a peso amount off. */
  rate: number;
  unit: 'pct' | 'php';
  /** Required for `promo`; null for other types. */
  expires_at: string | null;
  conditions_md: string | null;
  sort_order: number;
};

/**
 * Discounts for a set of service ids, grouped by service. Replaces the single
 * discount_* columns dropped in 20270502342558. Fail-soft to an empty map so a
 * missing table / RLS hiccup degrades to "no discounts" rather than crashing.
 */
export async function fetchDiscountsByService(
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

// ── Inclusions (vendor_service_inclusions · migration 20270502342558) ───────
export type VendorServiceInclusion = {
  vendor_service_id: string;
  /** 1–80 chars (DB-checked). */
  label: string;
  /** The item's stated peso worth ("₱X free"); null = no stated worth. Adds ₱0. */
  worth_php: number | null;
  sort_order: number;
};

/**
 * FREE inclusions for a set of service ids, grouped by service (the value story:
 * "Includes … · ₱X free", distinct from PAID add-ons). Fail-soft to an empty map
 * so a missing table / RLS hiccup degrades to "no inclusions" rather than
 * crashing. Mirrors fetchDiscountsByService.
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

// ── Price brackets (vendor_service_price_brackets · migration 20270502342558) ─
export type VendorServicePriceBracket = {
  vendor_service_id: string;
  /** Guest-count band. null min = from 0; null max = "any size" (open = flat). */
  min_pax: number | null;
  max_pax: number | null;
  /** The locked base price for the band. */
  price_php: number;
  sort_order: number;
};

/**
 * Fixed-basis pax price brackets for a set of service ids, grouped by service
 * (the card "from ₱X" anchor = the lowest bracket price). Fail-soft to an empty
 * map. Mirrors fetchDiscountsByService.
 */
export async function fetchBracketsByService(
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

export function isVendorCategory(value: string): value is VendorCategory {
  // Cheap structural check: lowercase + underscores, fits the enum shape.
  // Validated against VENDOR_CATEGORIES in the server action before write.
  return /^[a-z_]+$/.test(value);
}
