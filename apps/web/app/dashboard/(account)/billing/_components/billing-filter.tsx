'use client';

import { useState, type ReactNode } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { BILLING_SECTION_LABEL, type BillingSection, type BillingShow } from '@/lib/billing-sections';

/**
 * THE ONE DROPDOWN (Build 2 #39, v118's pinned row: back · title · ONE dropdown). All · Purchases · Gifts given ·
 * Payments received · Refunds · Rewards earned. The sections are drawn on the server ONCE; picking only hides the
 * others (no refetch on a view switch — owner 29 Oct "fewest requests") and writes `?show=` with `replaceState`, so a
 * deep link opens on the same section and Back is not a list of filter taps.
 *
 * The pinned row sticks at the top; each section's heading sticks under it (`top-11`, the row's 44 px).
 */
export function BillingFilter({
  initial,
  sections,
}: {
  initial: BillingShow;
  sections: ReadonlyArray<{ key: BillingSection; node: ReactNode }>;
}) {
  const [show, setShow] = useState<BillingShow>(initial);
  const options = [{ key: 'all', label: 'All' }, ...sections.map((s) => ({ key: s.key, label: BILLING_SECTION_LABEL[s.key] }))];
  return (
    <div data-billing-filter={show}>
      <div
        className="sticky top-0 z-[5] -mx-4 flex min-h-11 items-center gap-2 px-4 py-1.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        style={{ background: 'var(--sn-canvas)' }}
        data-pinned-row=""
        data-billing-pin=""
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Billing &amp; receipts</span>
        <PickMenu
          label="Billing & receipts — show"
          value={show}
          options={options}
          compact
          dataAttr="data-billing-picker"
          onPick={(k) => {
            const next = k as BillingShow;
            setShow(next);
            try {
              const url = new URL(window.location.href);
              if (next === 'all') url.searchParams.delete('show');
              else url.searchParams.set('show', next);
              window.history.replaceState(window.history.state, '', url);
            } catch {
              /* the address is a convenience; the list already changed */
            }
          }}
        />
      </div>
      {sections.map((s) => (
        <div key={s.key} hidden={show !== 'all' && show !== s.key} data-billing-section={s.key}>
          {s.node}
        </div>
      ))}
    </div>
  );
}
