'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';

/**
 * ⌄ ONE ACCORDION ROW — Event Details' "unfolds here" row (owner 2026-10-07:
 * *"accordion that opens and has toggles for toggle based"*). The header keeps
 * the retired `record-fold.tsx` anatomy — title 15 px · summary 13 px ink/60 ·
 * chevron — and the body unfolds in place with the grid-rows unfold (the
 * Guests `.fold`), under a quiet left rule. ONE OPEN AT A TIME: it joins the
 * app's one mechanism (`useOneOpen`), and a dropdown inside it is its child
 * (`OneOpenScope`), so opening that dropdown never folds the row.
 */
export function DetailsFold({
  row,
  fact,
  label,
  summary,
  children,
}: {
  /** The row's name — what `data-details-fold` carries for guards and tours. */
  row: string;
  /** The MAP facts this row carries, space-separated (`data-fact`). */
  fact?: string;
  label: ReactNode;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useOneOpen(open, setOpen);
  const bodyId = useId();
  return (
    <div className="border-t border-ink/10 first:border-t-0" data-details-fold={row} data-details-row={row} data-fact={fact}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="sn-press flex min-h-11 w-full items-center gap-2.5 py-3 text-left"
      >
        <DetailsRowText label={label} summary={summary} />
        <ChevronDown
          aria-hidden
          className={`h-[18px] w-[18px] shrink-0 text-ink/60 transition-transform duration-300 ease-sn motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>
      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows] duration-300 ease-sn motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className={`min-h-0 overflow-clip ${open ? '' : 'invisible'}`}>
          <div className="mb-2.5 ml-0.5 border-l-2 border-ink/10 pl-3">
            <OneOpenScope id={id}>{children}</OneOpenScope>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A row's left side — its 1–3 word label over its one-line summary. */
export function DetailsRowText({ label, summary, quiet = false }: { label: ReactNode; summary?: ReactNode; quiet?: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <span className={`block text-[15px] font-medium ${quiet ? 'text-ink/60' : 'text-ink'}`}>{label}</span>
      {summary != null && summary !== '' ? (
        <span className={`block truncate text-[13px] ${quiet ? 'text-ink/50' : 'text-ink/60'}`}>{summary}</span>
      ) : null}
    </span>
  );
}
