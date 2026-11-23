'use client';

/**
 * Money › To approve › Payouts — Show & filter, the round right of the thumb-row search (admin clean port, owner 19 Nov
 * 2026 "ok" on the drawing "Money screens: now and proposed": *filters go behind sliders in the thumb zone*).
 *
 * Reposition only: the four filters the page always had — Show (Pending · Paid · On hold · All), Supplier (name or
 * ID), From (scheduled), To (scheduled) — moved off the page into the shipped `ShowSortSheet`, the same face and sheet
 * as People › Show & sort (`app/admin/directory/_components/people-show-sort.tsx`). The thumb row's field stays the
 * console's ONE search, so the supplier box sits in the sheet rather than becoming a second search box.
 *
 * Each kept answer is a client navigation to the page's own address (`payoutsHref`), as the old chips were and as the
 * old Apply did; Clear all is the old Reset.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ChosenRow, TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { ShowSortSheet, ShowSortTopic } from '@/app/_components/show-sort-sheet';
import { FilterFace } from '@/app/dashboard/[eventId]/guests/_components/guests-filter-menu';
import { PAYOUT_FILTERS, parsePayoutFilter, payoutsHref, type PayoutFilters } from './payouts-filters';

export function PayoutsShowSort({ params }: { params: { get(k: string): string | null } | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const now: PayoutFilters = {
    filter: parsePayoutFilter(params?.get('filter') ?? undefined),
    vendor: params?.get('vendor')?.trim() ?? '',
    from: params?.get('from')?.trim() ?? '',
    to: params?.get('to')?.trim() ?? '',
  };
  const applied = (now.filter !== 'pending' ? 1 : 0) + (now.vendor ? 1 : 0) + (now.from ? 1 : 0) + (now.to ? 1 : 0);
  const go = (next: Partial<PayoutFilters>) => router.push(payoutsHref({ ...now, ...next }));
  return (
    <>
      <button
        type="button"
        aria-label="Show and filter payouts"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink"
        data-payouts-filter=""
      >
        <FilterFace on={applied > 0} />
      </button>
      {open ? (
        <ShowSortSheet
          onClose={() => setOpen(false)}
          titleId="payouts-show-sort-title"
          applied={applied}
          rows="payouts-filter"
          onClearAll={() => {
            setOpen(false);
            router.push(payoutsHref({ filter: now.filter, vendor: '', from: '', to: '' }));
          }}
          showLabel="Show payouts"
        >
          <ShowSortTopic name="Show" first />
          <ChosenRow
            data="payouts-show"
            name="Show"
            value={now.filter}
            options={PAYOUT_FILTERS.map((t) => ({ key: t.key, label: t.label }))}
            onPick={(key) => go({ filter: parsePayoutFilter(key) })}
            dataAttr="data-payouts-show"
            opensUp
          />
          <ShowSortTopic name="Filter" />
          <TypedRow
            data="payouts-vendor"
            name="Supplier (name or ID)"
            placeholder="Business name"
            value={now.vendor}
            onKeep={(text) => {
              go({ vendor: text.trim() });
              return { ok: true };
            }}
          />
          <DateRow
            data="payouts-from"
            name="From (scheduled)"
            value={now.from || null}
            onKeep={(day) => {
              go({ from: day });
              return { ok: true };
            }}
          />
          <DateRow
            data="payouts-to"
            name="To (scheduled)"
            value={now.to || null}
            onKeep={(day) => {
              go({ to: day });
              return { ok: true };
            }}
          />
        </ShowSortSheet>
      ) : null}
    </>
  );
}
