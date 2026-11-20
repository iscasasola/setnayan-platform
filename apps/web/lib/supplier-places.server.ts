import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pinOf, type LatLng } from '@/lib/mall-card';

/**
 * 📍 THE LIVE BRANCHES OF MANY SHOPS, IN ONE READ — the "nearest branch" half of card 14's distance line
 * (`lib/mall-card.ts` `nearestKm`). The HQ pin (`vendor_profiles.hq_latitude/longitude`) is already read by every
 * surface that draws the card; this adds the shop's branches (`vendor_branches.branch_latitude/longitude`).
 *
 * A branch counts while it is not cancelled AND is either included in the plan or has a live paid subscription — the
 * same two ways `lib/vendor-branches.ts` says a branch is open. Only the pin crosses: no label, no address.
 *
 * Fails SOFT to "no branches": the HQ still gives a distance, and a missing branch only ever makes the number larger,
 * never invents one.
 */
export async function readBranchPins(
  admin: SupabaseClient,
  vendorProfileIds: readonly string[],
): Promise<Map<string, LatLng[]>> {
  const out = new Map<string, LatLng[]>();
  const ids = [...new Set(vendorProfileIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const { data, error } = await admin
    .from('vendor_branches')
    .select('parent_vendor_profile_id, branch_latitude, branch_longitude, included_in_plan, branch_subscription_active')
    .in('parent_vendor_profile_id', ids)
    .is('cancelled_at', null)
    .not('branch_latitude', 'is', null);
  if (error || !Array.isArray(data)) {
    if (error) console.error('[supabase-error] readBranchPins · vendor_branches', error);
    return out;
  }
  for (const r of data as Array<{
    parent_vendor_profile_id: string;
    branch_latitude: number | null;
    branch_longitude: number | null;
    included_in_plan: boolean | null;
    branch_subscription_active: boolean | null;
  }>) {
    if (r.included_in_plan !== true && r.branch_subscription_active !== true) continue;
    const pin = pinOf(r.branch_latitude, r.branch_longitude);
    if (!pin) continue;
    const list = out.get(r.parent_vendor_profile_id);
    if (list) list.push(pin);
    else out.set(r.parent_vendor_profile_id, [pin]);
  }
  return out;
}
