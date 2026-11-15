import type { ReactNode } from 'react';
import Link from 'next/link';

import { PageMasthead } from '@/app/_components/page-masthead';
import { SubmitButton } from '@/app/_components/submit-button';
import { ShopCard, ShopNotice } from '@/app/vendor-dashboard/_components/kit';
import { SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';
import { othersPlace, SERVICE_REQUEST_NEW_HREF, SERVICE_REQUESTS_HREF } from '@/lib/service-requests';
import type { Loaded, MyRequest, RequestTree } from '@/lib/service-requests.server';
import { StayForm } from '@/app/_components/stay-form';
import { putCardUnderRequest } from '../actions';
import { CardPick } from './card-pick';
import { decidedOf, placeOfMine, RequestStatusPill } from './request-bits';

export type RequestDetailSearch = { requested?: string; already?: string; placed?: string; error?: string };
type MyCards = Loaded<Array<{ vendor_service_id: string; title: string | null; category: string; category_request_id: string | null; is_active: boolean }>>;

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

/** One request as drawn, from what was read — rendered by the page and, on fixtures, by /dev/service-requests-lab. */
export function RequestDetailView({
  requestId,
  one,
  tree,
  cards,
  sp,
  sameNameOthers,
}: {
  requestId: string;
  one: Loaded<MyRequest | null>;
  tree: RequestTree | null;
  cards: MyCards;
  sp: RequestDetailSearch;
  sameNameOthers: number | null;
}) {
  const shell = (children: ReactNode) => (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10" data-request-detail="">
      <Link href={SERVICE_REQUESTS_HREF} className="mb-3 flex w-fit text-xs font-medium text-ink/70 underline underline-offset-2">
        ‹ Your requests
      </Link>
      {children}
    </div>
  );

  if (!one.ok) {
    return shell(
      <ShopNotice tone="danger" role="alert">
        <strong>Couldn&rsquo;t load this request.</strong> It is still with us.{' '}
        <Link href={`${SERVICE_REQUESTS_HREF}/${requestId}`} className="font-semibold underline underline-offset-2">
          Try again
        </Link>
      </ShopNotice>,
    );
  }
  const r = one.value;
  if (!r) {
    return shell(
      <ShopNotice tone="warn" role="status">
        That request is gone.
      </ShopNotice>,
    );
  }

  const category = r.tile_id ? tree?.categoryLabel.get(r.tile_id) ?? null : null;
  const group = r.tile_id ? tree?.groupOf.get(r.tile_id) ?? null : null;
  const place = placeOfMine(r, tree);
  const mineHere = cards.ok ? cards.value.filter((c) => c.category_request_id === r.request_id) : [];
  const free = cards.ok ? cards.value.filter((c) => !c.category_request_id) : [];

  return shell(
    <>
      {sp.requested ? (
        <ShopNotice tone="success" role="status" className="mb-4">
          <strong>You&rsquo;re in.</strong> “{r.proposed_label}” is with us. Until we decide, your shop is listed under{' '}
          <b>
            {group ? `${group} › ` : ''}
            {othersPlace(category)}
          </b>
          .
          {sameNameOthers !== null
            ? sameNameOthers > 0
              ? ` ${sameNameOthers} other shop${sameNameOthers === 1 ? '' : 's'} asked for this too — the more who ask, the sooner it is its own service.`
              : ' You are the first to ask for this name.'
            : ''}
        </ShopNotice>
      ) : null}
      {sp.already ? (
        <ShopNotice tone="gold" role="status" className="mb-4">
          You already asked for “{r.proposed_label}” — it is the same request, still waiting.
        </ShopNotice>
      ) : null}
      {sp.placed ? (
        <ShopNotice tone="success" role="status" className="mb-4">
          Your card now shows under <b>{place}</b>.
        </ShopNotice>
      ) : null}
      {sp.error ? (
        <ShopNotice tone="danger" role="alert" className="mb-4">
          {sp.error}
        </ShopNotice>
      ) : null}

      <p className="sn-eye">{dateFmt.format(new Date(r.created_at))}</p>
      <PageMasthead title={r.proposed_label} />
      <h2 aria-hidden className="mb-3 text-xl font-semibold tracking-tight text-ink">{r.proposed_label}</h2>
      <div className="mb-4">
        <RequestStatusPill status={r.status} movedTo={decidedOf(r, tree)?.serviceLabel ?? null} />
      </div>

      <ShopCard>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink/60">Filed under</dt>
          <dd className="text-ink">{category ? `${group ? `${group} › ` : ''}${category}` : 'No category picked'}</dd>
          {r.proposed_note ? (
            <>
              <dt className="text-ink/60">Your note</dt>
              <dd className="text-ink">{r.proposed_note}</dd>
            </>
          ) : null}
          <dt className="text-ink/60">Your cards</dt>
          <dd className="text-ink" data-request-cards="">
            {r.cards === null ? (
              'Couldn’t count them right now'
            ) : (
              <>
                {r.cards} card{r.cards === 1 ? '' : 's'} · now under <b>{place}</b>
              </>
            )}
          </dd>
        </dl>
        {r.resolution_note ? (
          <div className="mt-3 rounded-xl bg-cream/70 p-3 text-sm text-ink" data-setnayan-note="">
            <b>Note from Setnayan</b>
            <br />
            {r.resolution_note}
          </div>
        ) : null}
        {r.status === 'pending' ? (
          <p className="mt-3 rounded-xl bg-ink/[0.03] p-3 text-sm text-ink/70">
            We review requests within two working days. Nothing to do on your side.
          </p>
        ) : null}
      </ShopCard>

      {mineHere.length > 0 ? (
        <ul className="mt-4 divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm">
          {mineHere.map((c) => (
            <li key={c.vendor_service_id} className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{c.title ?? 'Untitled card'}</span>
                <span className="block truncate text-[12.5px] text-ink/60">{place}</span>
              </span>
              <span className="text-[12px] text-ink/60">{c.is_active ? 'Online' : 'Draft'}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {r.status === 'pending' && cards.ok && free.length > 0 ? (
        <StayForm door="svServices.putCardUnderRequest" action={putCardUnderRequest} className="mt-4 flex flex-wrap items-end gap-2" data-put-card="">
          <input type="hidden" name="request_id" value={r.request_id} />
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-[13px] font-medium text-ink/75">Put a card under {othersPlace(category)}</span>
            <CardPick cards={free.map((c) => ({ id: c.vendor_service_id, title: c.title ?? 'Untitled card' }))} />
          </div>
          <SubmitButton className="button-primary min-h-11" pendingLabel="Placing…">
            Put it here
          </SubmitButton>
        </StayForm>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {r.status === 'pending' ? (
          <Link href={SERVICE_MAKER_HREF} className="button-primary inline-flex min-h-11 items-center">
            Make a card now
          </Link>
        ) : null}
        {r.status === 'rejected' ? (
          <Link href={SERVICE_MAKER_HREF} className="button-primary inline-flex min-h-11 items-center" data-pick-the-service="">
            Pick the service that fits
          </Link>
        ) : null}
        <Link href="/vendor-dashboard/shop" className="inline-flex min-h-11 items-center rounded-full border border-ink/15 px-5 text-sm font-medium text-ink">
          See your cards
        </Link>
        {r.status === 'rejected' ? (
          <Link href={SERVICE_REQUEST_NEW_HREF} className="inline-flex min-h-11 items-center rounded-full border border-terracotta px-5 text-sm font-semibold text-terracotta-700">
            Request a different name
          </Link>
        ) : null}
      </div>
    </>,
  );
}
