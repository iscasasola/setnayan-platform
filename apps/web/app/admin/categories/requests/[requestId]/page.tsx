import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { ADMIN_SERVICE_REQUESTS_HREF, isRequestStatus, sameNameKey } from '@/lib/service-requests';
import { loadRequestTree } from '@/lib/service-requests.server';
import { cardsFollowingRequests } from '@/lib/service-requests-decide.server';
import { loadRequestDrafts } from '../../_components/load';
import { ServiceRequestAdminView, type AdminRequest as Req } from '../_components/request-view';

export const metadata = { title: 'Service request · Admin' };

/**
 * /admin/categories/requests/[requestId] — one service request and its ONE Decision (ruling 5).
 *
 * Filed under · their note · every shop that asked for the same name · how many cards wait under
 * "<category> › Others" — then the AI's recommendation (when its flag is on; ABOVE the decision,
 * never below the button — near-matches-sit-above-the-button.test.ts), then the Decision.
 * A decided request is shown, not re-decided.
 */
export default async function ServiceRequestAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const [{ requestId }, sp] = await Promise.all([params, searchParams]);
  const admin = createAdminClient();
  const [reqRes, tree] = await Promise.all([
    admin
      .from('taxonomy_category_requests')
      .select('request_id, proposed_label, proposed_note, proposed_by_vendor_id, tile_id, status, mapped_to_canonical, resolution_note, created_at')
      .eq('request_id', requestId)
      .maybeSingle(),
    loadRequestTree(),
  ]);

  const back = (
    <Link href={ADMIN_SERVICE_REQUESTS_HREF} className="mb-3 flex w-fit text-xs font-medium text-ink/70 underline underline-offset-2">
      ‹ Service requests
    </Link>
  );
  if (reqRes.error) {
    logQueryError('ServiceRequestAdminPage (taxonomy_category_requests)', reqRes.error);
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {back}
        <div role="alert" className="rounded-2xl bg-danger-50 p-4 text-sm text-danger-800">
          <p className="font-semibold">⚠ Couldn&rsquo;t load this request</p>
          <Link href={`${ADMIN_SERVICE_REQUESTS_HREF}/${requestId}`} className="mt-2 inline-flex font-semibold underline">
            Try again
          </Link>
        </div>
      </div>
    );
  }
  const r = reqRes.data as (Req & { status: string }) | null;
  if (!r || !isRequestStatus(r.status)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {back}
        <p className="rounded-2xl bg-ink/[0.03] p-6 text-center text-sm text-ink/60">That request is gone.</p>
      </div>
    );
  }

  // Every shop asking for the same name (pending), for "Asked by" and the cards that move together.
  const { data: sameRows, error: sameErr } = await admin
    .from('taxonomy_category_requests')
    .select('request_id, proposed_label, proposed_by_vendor_id')
    .eq('status', 'pending');
  if (sameErr) logQueryError('ServiceRequestAdminPage (same name)', sameErr);
  const siblings =
    r.status === 'pending'
      ? ((sameRows ?? []) as Array<{ request_id: string; proposed_label: string; proposed_by_vendor_id: string }>).filter(
          (x) => sameNameKey(x.proposed_label) === sameNameKey(r.proposed_label),
        )
      : [r];
  if (!siblings.some((x) => x.request_id === r.request_id)) siblings.push(r);
  const shopIds = [...new Set(siblings.map((x) => x.proposed_by_vendor_id))];
  const [vpRes, following, drafts] = await Promise.all([
    admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds),
    cardsFollowingRequests(admin, siblings),
    loadRequestDrafts(
      admin,
      [r.request_id],
      new Map([...(tree?.service ?? new Map()).entries()].map(([k, v]) => [k, v.label])),
      tree?.categoryLabel ?? new Map(),
    ),
  ]);
  const names = ((vpRes.data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>).map((v) => v.business_name ?? 'a shop');
  const myShop = ((vpRes.data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>).find(
    (v) => v.vendor_profile_id === r.proposed_by_vendor_id,
  )?.business_name;
  return (
    <ServiceRequestAdminView
      r={r}
      tree={tree}
      error={sp.error ?? null}
      shops={shopIds.length}
      names={vpRes.error ? null : names}
      myShop={myShop ?? null}
      cards={following.ok ? following.cards.length : null}
      draft={drafts.get(r.request_id) ?? null}
    />
  );
}
