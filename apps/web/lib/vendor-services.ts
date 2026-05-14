import type { SupabaseClient } from '@supabase/supabase-js';
import type { VendorCategory } from '@/lib/vendors';

export type VendorServiceRow = {
  vendor_service_id: string;
  public_id: string;
  vendor_profile_id: string;
  category: string;
  starting_price_php: number | null;
  crew_size: number | null;
  crew_meal_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const SELECT =
  'vendor_service_id,public_id,vendor_profile_id,category,starting_price_php,crew_size,crew_meal_required,is_active,created_at,updated_at';

export async function fetchVendorServices(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorServiceRow[]> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select(SELECT)
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchVendorServices failed: ${error.message}`);
  return (data ?? []) as VendorServiceRow[];
}

export function isVendorCategory(value: string): value is VendorCategory {
  // Cheap structural check: lowercase + underscores, fits the enum shape.
  // Validated against VENDOR_CATEGORIES in the server action before write.
  return /^[a-z_]+$/.test(value);
}
