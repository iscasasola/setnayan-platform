'use client';

import { Printer } from 'lucide-react';

/** Shared print trigger for vendor print surfaces (production sheet, proposals). */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink/5 print:hidden"
    >
      <Printer aria-hidden className="h-4 w-4" /> {label}
    </button>
  );
}
