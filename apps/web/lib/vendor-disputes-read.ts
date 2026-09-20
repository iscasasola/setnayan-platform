/**
 * vendor-disputes-read.ts — every dispute filed against one shop, read to the
 * end, for /vendor-dashboard/disputes.
 *
 * It was `.limit(200)`: the 201st dispute — and every one older — was simply
 * not on the page, so a supplier could not contest it, and "N disputes are
 * under review" counted only the first 200. The read now pages to the server's
 * exact count (`readAllPages`) and says whether it finished; the page draws
 * 20 at a time through the shared `paginate()` + `<ListPager>`, so every
 * dispute is reachable and the open count is of all of them.
 *
 * RLS-scoped on the supplier's own session (`vendor_disputes_self_read`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages } from '@/lib/read-all-pages';

export async function readVendorDisputes<Row>(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<{ rows: Row[]; error: string | null; complete: boolean }> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await supabase
        .from('vendor_disputes')
        .select(
          'dispute_id,public_id,category,description,status,resolved_at,resolution_notes,counts_toward_demotion,vendor_contest,vendor_contested_at,created_at',
          { count: 'exact' },
        )
        .eq('vendor_profile_id', vendorProfileId)
        .order('created_at', { ascending: false })
        .order('dispute_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  return { rows: read.rows as Row[], error: read.error, complete: read.complete };
}
