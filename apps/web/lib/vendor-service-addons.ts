import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vendor service add-ons read layer (Vendor Services rework 2026-07-02).
 * Priced optional extras on a service card ("+ Drone coverage · from ₱5,000").
 */
export type ServiceAddonRow = {
  id: number;
  label: string;
  from_price_php: number | null;
};

/** Add-ons keyed by vendor_service_id, ordered by sort_order. Fails soft. */
export async function fetchAddonsByService(
  supabase: SupabaseClient,
  serviceIds: string[],
): Promise<Map<string, ServiceAddonRow[]>> {
  const out = new Map<string, ServiceAddonRow[]>();
  if (serviceIds.length === 0) return out;
  const { data, error } = await supabase
    .from('vendor_service_addons')
    .select('id,vendor_service_id,label,from_price_php,sort_order')
    .in('vendor_service_id', serviceIds)
    .order('sort_order', { ascending: true });
  if (error) return out;
  for (const r of (data ?? []) as {
    id: number;
    vendor_service_id: string;
    label: string;
    from_price_php: number | null;
  }[]) {
    const arr = out.get(r.vendor_service_id) ?? [];
    arr.push({ id: r.id, label: r.label, from_price_php: r.from_price_php });
    out.set(r.vendor_service_id, arr);
  }
  return out;
}
