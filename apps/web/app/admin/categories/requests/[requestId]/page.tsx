import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ADMIN_SERVICE_REQUESTS_HREF, isRequestStatus, othersPlace, sameNameKey, type RequestStatus } from '@/lib/service-requests';
import { loadRequestTree } from '@/lib/service-requests.server';
import { cardsFollowingRequests } from '@/lib/service-requests-decide.server';
import { loadRequestDrafts } from '../../_components/load';
import { RequestDraftNotes } from '../../_components/request-row';
import { AdminStatusPill } from '../_components/admin-request-bits';
import { DecisionForm, type DecisionCategory, type DecisionService } from '../_components/decision-form';

export const metadata = { title: 'Service request · Admin' };

type Req = {
  request_id: string;
  proposed_label: string;
  proposed_note: string | null;
  proposed_by_vendor_id: string;
  tile_id: string | null;
  status: RequestStatus;
  mapped_to_canonical: string | null;
  resolution_note: string | null;
  created_at: string;
};

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

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
    <Link href={ADMIN_SERVICE_REQUESTS_HREF} className="mb-3 inline-flex text-xs font-medium text-ink/70 underline underline-offset-2">
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
  const cards = following.ok ? following.cards.length : null;
  const filedCategory = r.tile_id ? tree?.categoryLabel.get(r.tile_id) ?? null : null;
  const filedGroup = r.tile_id ? tree?.groupOf.get(r.tile_id) ?? null : null;
  const draft = drafts.get(r.request_id) ?? null;
  const decidedService = r.mapped_to_canonical ? tree?.service.get(r.mapped_to_canonical) ?? null : null;

  const categories: DecisionCategory[] = (tree?.groups ?? []).flatMap((g) => g.categories.map((c) => ({ key: c.tileId, label: c.label, group: g.label })));
  const services: DecisionService[] = (tree?.groups ?? []).flatMap((g) =>
    g.categories.flatMap((c) => c.services.map((s) => ({ key: s.key, label: s.label, tileId: c.tileId, categoryLabel: c.label, group: g.label }))),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6" data-admin-service-request="">
      {back}
      <p className="sn-eye">
        {dateFmt.format(new Date(r.created_at))} · {myShop ?? 'a shop'}
      </p>
      <PageMasthead title={`“${r.proposed_label}”`} />
      <div className="-mt-2 mb-4">
        <AdminStatusPill status={r.status} />
      </div>
      {sp.error ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {sp.error}
        </p>
      ) : null}

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink/60">Filed under</dt>
          <dd className="text-ink">
            {filedCategory ? (
              <>
                {filedGroup ? `${filedGroup} › ` : ''}
                <b>{filedCategory}</b> › Others
              </>
            ) : (
              'No category picked (an older request)'
            )}
          </dd>
          {r.proposed_note ? (
            <>
              <dt className="text-ink/60">Their note</dt>
              <dd className="text-ink">{r.proposed_note}</dd>
            </>
          ) : null}
          <dt className="text-ink/60">Asked by</dt>
          <dd className="text-ink">
            {shopIds.length} shop{shopIds.length === 1 ? '' : 's'}
            {vpRes.error ? (
              <span className="block text-[12.5px] text-ink/60">Couldn&rsquo;t read the shop names.</span>
            ) : shopIds.length > 1 ? (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {names.map((n) => (
                  <span key={n} className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[12px]">
                    {n}
                  </span>
                ))}
              </span>
            ) : null}
          </dd>
          <dt className="text-ink/60">Cards</dt>
          <dd className="text-ink">
            {cards === null ? 'Couldn’t count them' : `${cards} under ${othersPlace(filedCategory)}`}
          </dd>
        </dl>
      </section>

      {r.status === 'pending' ? (
        <>
          <RequestDraftNotes draft={draft} />
          <div className="mt-4">
            <DecisionForm
              requestId={r.request_id}
              label={r.proposed_label}
              filedTileId={r.tile_id && tree?.categoryLabel.has(r.tile_id) ? r.tile_id : draft?.suggestedTileId ?? null}
              filedCategoryLabel={filedCategory}
              suggestedName={draft?.suggestedLabel ?? null}
              suggestedTarget={draft?.verdict === 'existing' ? draft.closestExisting?.canonical ?? null : null}
              cards={cards ?? 0}
              shops={shopIds.length}
              categories={categories}
              services={services}
            />
          </div>
        </>
      ) : (
        <section className="rounded-2xl bg-white p-4 shadow-sm text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-ink/60">Decision</dt>
            <dd className="text-ink">
              {r.status === 'promoted'
                ? `Added as a new service: ${decidedService ? `${decidedService.categoryLabel} › ${decidedService.label}` : r.mapped_to_canonical}`
                : r.status === 'mapped'
                  ? `Moved to ${decidedService ? `${decidedService.categoryLabel} › ${decidedService.label}` : r.mapped_to_canonical}`
                  : r.status === 'kept_private'
                    ? `Kept just for ${myShop ?? 'the shop'}`
                    : 'Not added'}
            </dd>
            {r.resolution_note ? (
              <>
                <dt className="text-ink/60">Note sent</dt>
                <dd className="text-ink">{r.resolution_note}</dd>
              </>
            ) : null}
          </dl>
          <p className="mt-3 text-[13px] text-ink/60">
            A decided request is not re-decided here. Merging or moving the service happens on the taxonomy map.
          </p>
        </section>
      )}
    </div>
  );
}
