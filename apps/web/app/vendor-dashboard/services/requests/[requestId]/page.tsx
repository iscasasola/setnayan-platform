import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { loadMyCards, loadMyRequest, loadRequestTree, markRequestSeen } from '@/lib/service-requests.server';
import { RequestDetailView, type RequestDetailSearch } from '../_components/request-detail-view';

export const metadata = { title: 'Request · Supplier' };

/**
 * /vendor-dashboard/services/requests/[requestId] — one request (owner rulings 2026-11-13, ruling 4).
 *
 * Where it was filed, the shop's note, where its cards are NOW, and the "Note from Setnayan"
 * (`resolution_note`, shown to the supplier since 2026-08-11). Opening a decided request clears the
 * notice on Services. A waiting request lets the shop put a card under it; a "Not added" one keeps
 * the cards online under Others and offers "Pick the service that fits" (ruling 7).
 */
export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<RequestDetailSearch>;
}) {
  const [{ requestId }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const vendorProfileId = profile.vendor_profile_id as string;

  const [one, tree, cards] = await Promise.all([
    loadMyRequest(supabase, vendorProfileId, requestId),
    loadRequestTree(),
    loadMyCards(supabase, vendorProfileId),
  ]);

  const r = one.ok ? one.value : null;
  if (r && r.status !== 'pending') await markRequestSeen(supabase, vendorProfileId, r.request_id);
  const sameNameOthers = r && sp.requested ? await otherShopsAskingSameName(r.proposed_label, vendorProfileId) : null;
  return <RequestDetailView requestId={requestId} one={one} tree={tree} cards={cards} sp={sp} sameNameOthers={sameNameOthers} />;
}

/**
 * How many OTHER shops are waiting on the same name — a count only, never a name (the supplier's
 * session cannot read another shop's request, and must not). Null when unreadable: then the line is
 * simply not said.
 */
async function otherShopsAskingSameName(label: string, vendorProfileId: string): Promise<number | null> {
  try {
    const exact = label.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await createAdminClient()
      .from('taxonomy_category_requests')
      .select('proposed_by_vendor_id')
      .eq('status', 'pending')
      .ilike('proposed_label', exact)
      .neq('proposed_by_vendor_id', vendorProfileId);
    if (error) {
      // The "n other shops" line is simply not said; the failure is recorded.
      logQueryError('otherShopsAskingSameName (taxonomy_category_requests)', error);
      return null;
    }
    return new Set(((data ?? []) as Array<{ proposed_by_vendor_id: string }>).map((d) => d.proposed_by_vendor_id)).size;
  } catch {
    return null;
  }
}
