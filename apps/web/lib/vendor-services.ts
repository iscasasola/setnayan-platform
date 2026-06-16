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
  crew_size: number | null;
  crew_meal_required: boolean;
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
  created_at: string;
  updated_at: string;
};

const BASE_COLS =
  'vendor_service_id,public_id,vendor_profile_id,category,starting_price_php,added_pax_price_php,crew_size,crew_meal_required,is_active,created_at,updated_at';
const FULL_SELECT = `${BASE_COLS},title,branch_id,recommended_lead_time_months,last_minute_end_months,last_minute_surcharge_pct,daily_capacity`;

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
      >),
      title: null,
      branch_id: null,
      recommended_lead_time_months: null,
      last_minute_end_months: null,
      last_minute_surcharge_pct: null,
      daily_capacity: null,
    }));
  }
  return (data ?? []) as VendorServiceRow[];
}

export function isVendorCategory(value: string): value is VendorCategory {
  // Cheap structural check: lowercase + underscores, fits the enum shape.
  // Validated against VENDOR_CATEGORIES in the server action before write.
  return /^[a-z_]+$/.test(value);
}
