'use client';

import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRows } from '@/app/_components/form-row';
import { GuestPopup } from '@/app/dashboard/[eventId]/guests/_components/guest-popup';

/**
 * 🧾 THE "SHOW & SORT" SHEET'S FRAME — extracted from the Guests list's sheet (`guests-filter-panel.tsx`), so the
 * Clients list draws the SAME sheet with its own rows (B1 step 4, spec §9 #7: "Show & sort = the Guests sheet
 * extracted"). The frame is the handle · "Show & sort · N applied" · the scrolling rows · Clear all | Show N.
 *
 * 🔑 The Guests sheet re-mounts on this with byte-identical output — its filter logic stays in `lib/guests-filter`.
 * The rows are the caller's (`ChosenRow`s under `ShowSortTopic` heads).
 *
 * 🔒 app/vendor-dashboard/customers/the-clients-list-is-v113.test.ts (test 7)
 */
export function ShowSortTopic({ name, first = false }: { name: string; first?: boolean }) {
  return (
    <p
      data-filter-topic={name}
      className={`${first ? 'pt-1' : 'pt-5'} pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 [&+*]:!border-t-0`}
    >
      {name}
    </p>
  );
}

export function ShowSortSheet({
  onClose,
  titleId,
  applied,
  rows,
  children,
  onClearAll,
  showLabel,
  rootClassName = 'fixed inset-0 z-40',
  panelData = { 'data-filter-sheet': '' },
}: {
  onClose: () => void;
  /** The title's id (the dialog is named by it). */
  titleId: string;
  /** How many choices differ from the plain list — "· N applied"; 0 greys Clear all. */
  applied: number;
  /** The rows' `FormRows` data mark. */
  rows: string;
  children: ReactNode;
  onClearAll: () => void;
  /** "Show 12 guests" · "Show 8 clients". */
  showLabel: string;
  rootClassName?: string;
  panelData?: Record<`data-${string}`, string>;
}) {
  return (
    <GuestPopup
      onClose={onClose}
      rootClassName={rootClassName}
      panelClassName="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-cream shadow-2xl tab:left-auto tab:right-4 tab:bottom-4 tab:w-[min(26rem,calc(100vw-2rem))] tab:rounded-2xl"
      panelData={panelData}
      labelledById={titleId}
    >
      <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-ink/15" />
      <h2 id={titleId} className="shrink-0 px-5 pb-1 pt-2 text-[17px] font-semibold text-ink">
        Show &amp; sort
        {applied > 0 ? (
          <span className="ml-2 text-[13px] font-semibold text-terracotta-700" data-filter-applied={applied}>
            · {applied} applied
          </span>
        ) : null}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
        <FormRows data={rows}>{children}</FormRows>
      </div>
      <div className="flex shrink-0 items-stretch gap-2.5 border-t border-ink/10 px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 [&_.ab]:w-full">
        <div className="shrink-0">
          <ActionButton tone="neutral" icon={X} label="Clear all" disabled={applied === 0} onClick={onClearAll} data-testid="filter-clear-all" />
        </div>
        <div className="min-w-0 flex-1">
          <ActionButton tone="brand" main icon={Check} label={showLabel} onClick={onClose} data-testid="filter-show-n" />
        </div>
      </div>
    </GuestPopup>
  );
}
