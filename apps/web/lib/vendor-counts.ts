import type { SupabaseClient } from '@supabase/supabase-js';

import type { VendorPublicVisibility } from './vendor-visibility';

/**
 * Per-canonical_service vendor count, broken down by publishing state.
 * `total` is the sum of `verified` and `coming_soon` rows that pass the
 * marketplace publishing gate (non-empty business_name).
 */
export type VendorCount = {
  verified: number;
  coming_soon: number;
  total: number;
};

/**
 * Catalog-mode aggregate: for every canonical_service that has at least one
 * eligible vendor, how many vendors list it in their `services[]` array.
 *
 * The marketplace catalog renders 192 tiles regardless of whether any vendor
 * has stocked the category yet; this helper drives the per-tile "3 verified"
 * vs "Recruiting" copy. Returns an empty Map when zero vendors are eligible.
 *
 * One query, aggregated in process — `services[]` is denormalized so a single
 * vendor row contributes to multiple buckets. RLS-bypassed admin client is
 * required because the public marketplace is anonymous-read.
 */
export async function fetchVendorCountsByService(
  admin: SupabaseClient,
): Promise<Map<string, VendorCount>> {
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('services,public_visibility')
    .in('public_visibility', ['verified', 'coming_soon'])
    .not('business_name', 'is', null)
    .neq('business_name', '');

  if (error) {
    // Soft-fail to an empty map so the catalog still renders 192 tiles
    // labeled "Recruiting" — better UX than a 500 on the marketplace.
    return new Map();
  }

  const counts = new Map<string, VendorCount>();
  for (const row of (data ?? []) as Array<{
    services: string[] | null;
    public_visibility: VendorPublicVisibility;
  }>) {
    const services = row.services ?? [];
    for (const service of services) {
      const existing = counts.get(service) ?? { verified: 0, coming_soon: 0, total: 0 };
      if (row.public_visibility === 'verified') existing.verified += 1;
      else if (row.public_visibility === 'coming_soon') existing.coming_soon += 1;
      existing.total = existing.verified + existing.coming_soon;
      counts.set(service, existing);
    }
  }
  return counts;
}
