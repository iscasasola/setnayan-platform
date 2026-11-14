import type { ReactNode } from 'react';
import { ChevronLeft, Layers, PenLine, Plus, Search } from 'lucide-react';

import { ActionButton, actionButtonClass } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { PageMasthead } from '@/app/_components/page-masthead';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
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
    <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6" data-request-detail="">
      <ActionButton tone="neutral" quiet icon={<ChevronLeft aria-hidden />} label="Your requests" href={SERVICE_REQUESTS_HREF} />
      {children}
    </div>
  );

  if (!one.ok) {
    return shell(
      <TemplateFail data="request" retryHref={`${SERVICE_REQUESTS_HREF}/${requestId}`}>
        <strong>Couldn&rsquo;t load this request.</strong> It is still with us.
      </TemplateFail>,
    );
  }
  const r = one.value;
  if (!r) {
    return shell(<TemplateEmpty data="request">That request is gone.</TemplateEmpty>);
  }

  const category = r.tile_id ? tree?.categoryLabel.get(r.tile_id) ?? null : null;
  const group = r.tile_id ? tree?.groupOf.get(r.tile_id) ?? null : null;
  const place = placeOfMine(r, tree);
  const mineHere = cards.ok ? cards.value.filter((c) => c.category_request_id === r.request_id) : [];
  const free = cards.ok ? cards.value.filter((c) => !c.category_request_id) : [];
  const okLine = 'py-2 text-[14px]';
  const okColour = { color: 'rgb(var(--color-ok))' };

  return shell(
    <>
      {sp.requested ? (
        <p role="status" className={okLine} style={okColour}>
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
        </p>
      ) : null}
      {sp.already ? (
        <p role="status" className={okLine} style={{ color: 'rgb(var(--color-warn))' }}>
          You already asked for “{r.proposed_label}” — it is the same request, still waiting.
        </p>
      ) : null}
      {sp.placed ? (
        <p role="status" className={okLine} style={okColour}>
          Your card now shows under <b>{place}</b>.
        </p>
      ) : null}
      {sp.error ? (
        <p role="alert" className={`${okLine} font-semibold`} style={{ color: 'rgb(var(--color-danger))' }}>
          {sp.error}
        </p>
      ) : null}

      <PageMasthead title={r.proposed_label} />
      {/* Rule 13 — the top of the page: the one thing that matters now, on the warm surface. */}
      <div className="rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] px-4 py-3">
        <p className={TEMPLATE_SUBLINE}>{dateFmt.format(new Date(r.created_at))}</p>
        <p className="mt-0.5 text-xl font-semibold tracking-tight text-ink">{r.proposed_label}</p>
        <div className="mt-2">
          <RequestStatusPill status={r.status} movedTo={decidedOf(r, tree)?.serviceLabel ?? null} />
        </div>
      </div>

      <TemplateSection label="Your request">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
          <dt className="text-[color:var(--m-slate-2)]">Filed under</dt>
          <dd className="text-ink">{category ? `${group ? `${group} › ` : ''}${category}` : 'No category picked'}</dd>
          {r.proposed_note ? (
            <>
              <dt className="text-[color:var(--m-slate-2)]">Your note</dt>
              <dd className="text-ink">{r.proposed_note}</dd>
            </>
          ) : null}
          <dt className="text-[color:var(--m-slate-2)]">Your cards</dt>
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
          <div className="mt-3 border-t border-[color:var(--m-line)] pt-3 text-[14px] text-ink" data-setnayan-note="">
            <b>Note from Setnayan</b>
            <br />
            {r.resolution_note}
          </div>
        ) : null}
        {r.status === 'pending' ? (
          <p className={`mt-3 ${TEMPLATE_SUBLINE}`}>
            We review requests within two working days. Nothing to do on your side.
          </p>
        ) : null}
      </TemplateSection>

      {mineHere.length > 0 ? (
        <TemplateSection label="Cards under it">
          <TemplateRows label="Cards under this request">
            {mineHere.map((c) => (
              <TemplateRow
                key={c.vendor_service_id}
                title={c.title ?? 'Untitled card'}
                line={place}
                right={<Badge tone={c.is_active ? 'ok' : 'quiet'}>{c.is_active ? 'Online' : 'Draft'}</Badge>}
              />
            ))}
          </TemplateRows>
        </TemplateSection>
      ) : null}

      {r.status === 'pending' && cards.ok && free.length > 0 ? (
        <StayForm door="svServices.putCardUnderRequest" action={putCardUnderRequest} className="mt-4 flex flex-wrap items-end gap-2" data-put-card="">
          <input type="hidden" name="request_id" value={r.request_id} />
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-[13px] font-semibold text-ink">Put a card under {othersPlace(category)}</span>
            <CardPick cards={free.map((c) => ({ id: c.vendor_service_id, title: c.title ?? 'Untitled card' }))} />
          </div>
          <SubmitButton className={actionButtonClass('brand')} pendingLabel="Placing…">
            Put it here
          </SubmitButton>
        </StayForm>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-3">
        {r.status === 'pending' ? (
          <ActionButton tone="brand" main icon={<Plus aria-hidden />} label="Make a card now" href={SERVICE_MAKER_HREF} />
        ) : null}
        {r.status === 'rejected' ? (
          <ActionButton
            tone="brand"
            main
            icon={<Search aria-hidden />}
            label="Pick the service that fits"
            href={SERVICE_MAKER_HREF}
            data-pick-the-service=""
          />
        ) : null}
        <ActionButton tone="neutral" icon={<Layers aria-hidden />} label="See your cards" href="/vendor-dashboard/shop" />
        {r.status === 'rejected' ? (
          <ActionButton tone="brand" icon={<PenLine aria-hidden />} label="Request a different name" href={SERVICE_REQUEST_NEW_HREF} />
        ) : null}
      </div>
    </>,
  );
}
