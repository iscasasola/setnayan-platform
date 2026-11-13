import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ListChecks, Search } from 'lucide-react';

import { ActionButton, actionButtonClass } from '@/components/action-button';
import { PageMasthead } from '@/app/_components/page-masthead';
import {
  TEMPLATE_SUBLINE,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { RequestNameForm } from './name-fields';
import { proposeCategoryRequested, SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';
import { othersPlace, SERVICE_REQUEST_NEW_HREF, SERVICE_REQUESTS_HREF } from '@/lib/service-requests';
import type { RequestTree } from '@/lib/service-requests.server';

export type TellUsSearch = { group?: string; tile?: string; error?: string; wantCategory?: string };

/** The three steps as drawn, from the live tree — rendered by the page and, on fixtures, by /dev/service-requests-lab. */
export function TellUsWhatYouDoView({ tree, sp }: { tree: RequestTree | null; sp: TellUsSearch }) {
  const fromMaker = proposeCategoryRequested(sp.wantCategory);
  const carry = fromMaker ? '&wantCategory=1' : '';
  const step1Href = fromMaker ? `${SERVICE_REQUEST_NEW_HREF}?wantCategory=1` : SERVICE_REQUEST_NEW_HREF;
  const tile = sp.tile && tree ? tree.groups.flatMap((g) => g.categories).find((c) => c.tileId === sp.tile) ?? null : null;
  const group = tile
    ? tree?.groups.find((g) => g.categories.some((c) => c.tileId === tile.tileId)) ?? null
    : sp.group && tree
      ? tree.groups.find((g) => g.id === sp.group) ?? null
      : null;

  const backToCard = fromMaker ? (
    <Link href={SERVICE_MAKER_HREF} className={actionButtonClass('neutral', { quiet: true })} data-tone="neutral">
      <ArrowLeft aria-hidden strokeWidth={1.9} />
      <span>Back to your card</span>
    </Link>
  ) : null;
  const error = sp.error ? (
    <p role="alert" className="py-2 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
      {sp.error}
    </p>
  ) : null;

  if (!tree) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6">
        {backToCard}
        <PageMasthead title="Where does it belong?" />
        <TemplateSection label="Where does it belong?" first>
          <TemplateFail data="request-tree" retryHref={step1Href}>
            <strong>Couldn&rsquo;t load the categories.</strong> Nothing was sent.
          </TemplateFail>
        </TemplateSection>
      </div>
    );
  }

  // ── Step 3 · Name your service ─────────────────────────────────────────────
  if (tile && group) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6" data-request-step="name">
        {backToCard}
        <PageMasthead title="Name your service" />
        <TemplateSection label="Name your service" first right="Step 3 of 3">
          {error}
          <RequestNameForm
            tileId={tile.tileId}
            fromMaker={fromMaker}
            before={
              <div>
                <p className="mb-1 text-[13px] font-semibold text-ink">Category</p>
                <Link
                  href={`${SERVICE_REQUEST_NEW_HREF}?group=${encodeURIComponent(group.id)}${carry}`}
                  className="sn-press flex min-h-11 items-center justify-between rounded-full border border-[color:var(--m-line)] px-4 text-[14px] text-ink"
                  aria-label="Change category"
                >
                  <span>
                    {group.label} › {tile.label}
                  </span>
                  <span aria-hidden className="text-mulberry">▾</span>
                </Link>
                <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>Tap to change.</p>
              </div>
            }
            after={
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-y border-[color:var(--m-line)] py-3 text-[14px]">
                <dt className="font-semibold text-ink">Now</dt>
                <dd className="text-[color:var(--m-slate-2)]">
                  You go under <b className="text-ink">{othersPlace(tile.label)}</b>. Make your cards today — they file
                  under Miscellaneous until we place your service, and stay online while you wait.
                </dd>
                <dt className="font-semibold text-ink">Then</dt>
                <dd className="text-[color:var(--m-slate-2)]">
                  We add your service, move it to one we have, or keep it for your shop. Your cards move with it. You
                  get a notice either way.
                </dd>
              </dl>
            }
          />
        </TemplateSection>
      </div>
    );
  }

  // ── Step 2 · Pick a category ───────────────────────────────────────────────
  if (group) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6" data-request-step="category">
        {backToCard}
        <PageMasthead title="Pick a category" />
        <TemplateSection
          label="Pick a category"
          first
          tip="Your service will sit here until we place it exactly."
          right="Step 2 of 3"
        >
          {error}
          <TemplateRows label="Categories">
            {group.categories.map((c) => (
              <TemplateRow
                key={c.tileId}
                href={`${SERVICE_REQUEST_NEW_HREF}?tile=${encodeURIComponent(c.tileId)}${carry}`}
                title={c.label}
                line={
                  <>
                    {group.label} › {c.label} › <b>Others</b>
                  </>
                }
              />
            ))}
          </TemplateRows>
        </TemplateSection>
        <div className="pt-2">
          <ActionButton tone="neutral" icon={<ChevronLeft aria-hidden />} label="Other groups" href={step1Href} />
        </div>
      </div>
    );
  }

  // ── Step 1 · Pick a group ──────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6" data-request-step="group">
      {backToCard}
      <PageMasthead title="Where does it belong?" />
      <TemplateSection
        label="Where does it belong?"
        first
        tip="The same list couples browse. Open the group closest to what you do."
        right="Step 1 of 3"
      >
        {error}
        <TemplateRows label="Groups">
          {tree.groups.map((g) => (
            <TemplateRow
              key={g.id}
              href={`${SERVICE_REQUEST_NEW_HREF}?group=${encodeURIComponent(g.id)}${carry}`}
              title={g.label}
              line={`${g.categories.length} ${g.categories.length === 1 ? 'category' : 'categories'}`}
            />
          ))}
        </TemplateRows>
      </TemplateSection>
      <div className="flex flex-wrap gap-2 pt-2">
        <ActionButton tone="info" icon={<Search aria-hidden />} label="Search again" href={SERVICE_MAKER_HREF} />
        <ActionButton tone="neutral" icon={<ListChecks aria-hidden />} label="Your requests" href={SERVICE_REQUESTS_HREF} />
      </div>
    </div>
  );
}
