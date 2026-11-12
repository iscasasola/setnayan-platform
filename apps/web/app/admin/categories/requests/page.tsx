import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { isRequestStatus } from '@/lib/service-requests';
import { loadRequestTree } from '@/lib/service-requests.server';
import { ServiceRequestsListView, type AdminRequestRow as Row } from './_components/list-view';

export const metadata = { title: 'Service requests · Admin' };

/**
 * /admin/categories/requests — "Service requests" (owner rulings 2026-11-13, ruling 5).
 *
 * What suppliers asked us to add. Pending first (one row per NAME: "n shops" when several shops asked
 * for the same one — a decision moves them all), then Decided. Extends the shipped
 * `/admin/categories?show=requests` list into a page of its own; the Decision is one dropdown on the
 * request's page.
 *
 * 🔑 Loading (loading.tsx), empty ("No requests waiting") and a refused read ("Couldn't load
 * requests · Try again") never look alike — a refused read is never drawn as "none".
 */
export default async function ServiceRequestsAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createAdminClient();
  const [reqRes, tree] = await Promise.all([
    admin
      .from('taxonomy_category_requests')
      .select('request_id, proposed_label, proposed_by_vendor_id, tile_id, status, created_at, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(500),
    loadRequestTree(),
  ]);
  if (reqRes.error) logQueryError('ServiceRequestsAdminPage (taxonomy_category_requests)', reqRes.error);
  const rows = reqRes.error ? null : ((reqRes.data ?? []) as Array<Row & { status: string }>).filter((r) => isRequestStatus(r.status)) as Row[];

  let shopName = new Map<string, string>();
  if (rows && rows.length > 0) {
    const ids = [...new Set(rows.map((r) => r.proposed_by_vendor_id))];
    const { data, error } = await admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', ids);
    if (error) logQueryError('ServiceRequestsAdminPage (vendor_profiles)', error);
    shopName = new Map(((data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>).map((v) => [v.vendor_profile_id, v.business_name ?? 'a shop']));
  }
  return <ServiceRequestsListView rows={rows} shopName={shopName} tree={tree} ok={sp.ok ?? null} />;
}
