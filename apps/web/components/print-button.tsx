'use client';

import { Printer } from 'lucide-react';

/** Shared print trigger for vendor print surfaces (production sheet, proposals). */
export function PrintButton({ label = 'Print', round = false }: { label?: string; round?: boolean }) {
  // ◯ `round` (supplier pages set two, 21 Nov 2026): a quiet 44-px round printer on a phone, the labelled button from 701.
  if (round) {
    return (
      <button
        type="button"
        onClick={() => window.print()}
        aria-label={label}
        title={label}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-[color:var(--m-slate-2)] hover:bg-ink/5 tab:bg-[color:var(--m-paper-2)] tab:px-4 tab:text-[15px] tab:font-bold tab:text-ink print:hidden"
      >
        <Printer aria-hidden className="h-[18px] w-[18px]" />
        <span className="hidden tab:inline">{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5 dark:bg-raised dark:hover:bg-ink/5 print:hidden"
    >
      <Printer aria-hidden className="h-4 w-4" /> {label}
    </button>
  );
}
