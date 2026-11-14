import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 🏷 F-A-08 (admin walk, round 2): whose paper is this? The shop's own name for each supplier the verification
 * documents' keys name, for the admin's Verification documents page. Its own module because
 * `verification-docs-server.ts` is pinned body-and-all (`verification-docs.test.ts` R5).
 *
 * `null` = the read was refused — the page then says the name could not load, never a blank that reads as
 * "no supplier".
 */
export async function verificationDocSupplierNames(vendorProfileIds: readonly string[]): Promise<Map<string, string> | null> {
  const ids = [...new Set(vendorProfileIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await createAdminClient()
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .in('vendor_profile_id', ids);
  if (error) {
    console.error('[read-gap] verificationDocSupplierNames', error.message);
    return null;
  }
  for (const r of (data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>) {
    const name = r.business_name?.trim();
    if (name) out.set(r.vendor_profile_id, name);
  }
  return out;
}
