import Link from 'next/link';

import { PageMasthead } from '@/app/_components/page-masthead';
import { ADMIN_SERVICE_REQUESTS_HREF, othersPlace, type RequestStatus } from '@/lib/service-requests';
import type { RequestTree } from '@/lib/service-requests.server';
import type { RequestDraft } from '../../_components/model';
import { RequestDraftNotes } from '../../_components/request-row';
import { AdminStatusPill } from './admin-request-bits';
import { DecisionForm, type DecisionCategory, type DecisionService } from './decision-form';

export type AdminRequest = {
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
 * One request and its Decision, as drawn from what was read — rendered by the page and, on fixtures, by
 * /dev/service-requests-lab. `names === null` / `cards === null` are refused reads, said as such.
 */
export function ServiceRequestAdminView({
  r,
  tree,
  error,
  shops,
  names,
  myShop,
  cards,
  draft,
}: {
  r: AdminRequest;
  tree: RequestTree | null;
  error: string | null;
  shops: number;
  names: string[] | null;
  myShop: string | null;
  cards: number | null;
  draft: RequestDraft | null;
}) {
  const back = (
    <Link href={ADMIN_SERVICE_REQUESTS_HREF} className="mb-3 flex w-fit text-xs font-medium text-ink/70 underline underline-offset-2">
      ‹ Service requests
    </Link>
  );
  const filedCategory = r.tile_id ? tree?.categoryLabel.get(r.tile_id) ?? null : null;
  const filedGroup = r.tile_id ? tree?.groupOf.get(r.tile_id) ?? null : null;
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
      <h2 aria-hidden className="mb-3 text-xl font-semibold tracking-tight text-ink">“{r.proposed_label}”</h2>
      <div className="mb-4">
        <AdminStatusPill status={r.status} />
      </div>
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {error}
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
            {shops} shop{shops === 1 ? '' : 's'}
            {names === null ? (
              <span className="block text-[12.5px] text-ink/60">Couldn&rsquo;t read the shop names.</span>
            ) : shops > 1 ? (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {(names ?? []).map((n) => (
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
              shops={shops}
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
