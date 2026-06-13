/**
 * Shared demo-vendor id lookup.
 *
 * Extracted from `app/vendors/page.tsx` (was a local `fetchDemoVendorIds`)
 * so BOTH the public `/explore` marketplace browse AND the in-dashboard
 * couple vendor search exclude `is_demo = TRUE` vendors for real (non
 * demo-mode) viewers. Demo-mode admins still surface them.
 *
 * Returns every `vendor_profiles.vendor_profile_id` where `is_demo = TRUE`,
 * for use in a `.not('vendor_profile_id', 'in', '(...)')` predicate or the
 * `excludeVendorIds` option on the wizard recommendation matcher.
 *
 * Defensive against the `is_demo` column not yet existing on a given
 * environment: any PostgREST error containing "is_demo" is swallowed and an
 * empty array returned — under that fallback callers behave exactly like
 * they did before (no exclusion). Other errors are logged but also
 * degrade to an empty array rather than breaking the render.
 *
 * The list is expected to be small at V1 dogfood scale, well under the
 * URL-length limit for the subsequent `in (...)` predicate.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchDemoVendorIds(
  admin: SupabaseClient,
): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('is_demo', true);
    if (error) {
      if (/is_demo/i.test(error.message)) return [];
      // Other errors get logged but don't break the render — opening the
      // door for prod even on partial outage.
      console.warn('[demo-mode] fetchDemoVendorIds failed:', error.message);
      return [];
    }
    return (data ?? []).map((row) => row.vendor_profile_id as string);
  } catch {
    return [];
  }
}
