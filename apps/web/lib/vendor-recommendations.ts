import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Couple recommendations for a vendor (Event Lifecycle Menu §6.3).
 *
 * The marketplace "recommended by N couples" trust signal + the vendor-dashboard
 * badge both read this. "N couples" = DISTINCT events with a recommendation (one
 * event ≈ one couple; both partners could each recommend, so we dedupe by
 * event_id rather than counting rows). `vendor_recommendations` is public-read by
 * RLS, so this works from any client. Graceful-degrade to 0 on a missing/legacy
 * table.
 *
 * Recommendations per vendor are bounded (a vendor serves a finite number of
 * events), so fetching event_ids and deduping in JS avoids a materialized view +
 * refresh trigger for a number that changes rarely.
 */
export async function countVendorRecommendingCouples(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('vendor_recommendations')
    .select('event_id')
    .eq('vendor_profile_id', vendorProfileId);
  if (error || !data) return 0;
  return new Set((data as { event_id: string }[]).map((r) => r.event_id)).size;
}
