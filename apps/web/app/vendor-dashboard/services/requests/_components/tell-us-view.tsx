import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { PageMasthead } from '@/app/_components/page-masthead';
import { ShopCard, ShopNotice } from '@/app/vendor-dashboard/_components/kit';
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
    <Link href={SERVICE_MAKER_HREF} className="mb-3 flex w-fit text-xs font-medium text-ink/70 underline underline-offset-2">
      ← Back to your card
    </Link>
  ) : null;
  const error = sp.error ? (
    <ShopNotice tone="danger" role="alert" className="mb-4">
      {sp.error}
    </ShopNotice>
  ) : null;

  if (!tree) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {backToCard}
        <PageMasthead title="Where does it belong?" />
        <h2 aria-hidden className="mb-3 text-xl font-semibold tracking-tight text-ink">Where does it belong?</h2>
        <ShopNotice tone="danger" role="alert">
          <strong>Couldn&rsquo;t load the categories.</strong> Nothing was sent.{' '}
          <Link href={step1Href} className="font-semibold underline underline-offset-2">
            Try again
          </Link>
        </ShopNotice>
      </div>
    );
  }

  // ── Step 3 · Name your service ─────────────────────────────────────────────
  if (tile && group) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10" data-request-step="name">
        {backToCard}
        <p className="sn-eye">Step 3 of 3</p>
        <PageMasthead title="Name your service" />
        <h2 aria-hidden className="mb-3 text-xl font-semibold tracking-tight text-ink">Name your service</h2>
        {error}
        <RequestNameForm
          tileId={tile.tileId}
          fromMaker={fromMaker}
          before={
            <div>
            <p className="mb-1 text-[13px] font-medium text-ink/75">Category</p>
            <Link
              href={`${SERVICE_REQUEST_NEW_HREF}?group=${encodeURIComponent(group.id)}${carry}`}
              className="flex min-h-11 items-center justify-between rounded-full border border-ink/20 px-4 text-sm text-ink"
              aria-label="Change category"
            >
              <span>
                {group.label} › {tile.label}
              </span>
              <span aria-hidden className="text-terracotta-700">▾</span>
            </Link>
            <p className="mt-1 text-[12.5px] text-ink/60">Tap to change.</p>
          </div>
          }
          after={
          <ShopCard pad="tight">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="font-semibold text-ink">Now</dt>
              <dd className="text-ink/75">
                You go under <b>{othersPlace(tile.label)}</b>. Make your cards today — they file under
                Miscellaneous until we place your service, and stay online while you wait.
              </dd>
              <dt className="font-semibold text-ink">Then</dt>
              <dd className="text-ink/75">
                We add your service, move it to one we have, or keep it for your shop. Your cards move with it. You get
                a notice either way.
              </dd>
            </dl>
          </ShopCard>
          }
        />
      </div>
    );
  }

  // ── Step 2 · Pick a category ───────────────────────────────────────────────
  if (group) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10" data-request-step="category">
        {backToCard}
        <p className="sn-eye">Step 2 of 3</p>
        <PageMasthead title="Pick a category" />
        <h2 aria-hidden className="mb-3 text-xl font-semibold tracking-tight text-ink">Pick a category</h2>
        {error}
        <p className="mb-4 text-sm text-ink/65">Your service will sit here until we place it exactly.</p>
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm">
          {group.categories.map((c) => (
            <li key={c.tileId}>
              <Link
                href={`${SERVICE_REQUEST_NEW_HREF}?tile=${encodeURIComponent(c.tileId)}${carry}`}
                className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-ink">{c.label}</span>
                  <span className="block text-[12.5px] text-ink/60">
                    {group.label} › {c.label} › <b>Others</b>
                  </span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-terracotta-700" strokeWidth={1.75} />
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href={step1Href}
          className="mt-4 inline-flex min-h-11 items-center rounded-full border border-ink/15 px-5 text-sm font-medium text-ink"
        >
          ‹ Other groups
        </Link>
      </div>
    );
  }

  // ── Step 1 · Pick a group ──────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10" data-request-step="group">
      {backToCard}
      <p className="sn-eye">Step 1 of 3</p>
      <PageMasthead title="Where does it belong?" />
        <h2 aria-hidden className="mb-3 text-xl font-semibold tracking-tight text-ink">Where does it belong?</h2>
      {error}
      <p className="mb-4 text-sm text-ink/65">
        The same list couples browse. Open the group closest to what you do.{' '}
        <Link href={SERVICE_MAKER_HREF} className="font-semibold text-terracotta-700 underline-offset-2 hover:underline">
          Search again
        </Link>
      </p>
      <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm">
        {tree.groups.map((g) => (
          <li key={g.id}>
            <Link
              href={`${SERVICE_REQUEST_NEW_HREF}?group=${encodeURIComponent(g.id)}${carry}`}
              className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink">{g.label}</span>
                <span className="block text-[12.5px] text-ink/60">
                  {g.categories.length} {g.categories.length === 1 ? 'category' : 'categories'}
                </span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-terracotta-700" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>
      <Link href={SERVICE_REQUESTS_HREF} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-ink/70 underline underline-offset-2">
        Your requests
      </Link>
    </div>
  );
}
