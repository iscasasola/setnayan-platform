'use client';

import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { useCompare } from './compare-provider';

/**
 * Floating compare basket pinned to the bottom of the marketplace.
 * Shows selected vendor count, lets the couple clear or remove a single
 * pick, and routes to /vendors/compare?ids=A,B,C once at least 2 are
 * selected. Renders nothing when the basket is empty so it stays out
 * of the way during normal browse.
 */
export function CompareBasket() {
  const { ids, clear, hydrated } = useCompare();

  // Skip render until localStorage has rehydrated to avoid the
  // "appears then disappears" flicker on first paint.
  if (!hydrated || ids.length === 0) return null;

  const compareHref = `/vendors/compare?ids=${ids.join(',')}`;
  const canCompare = ids.length >= 2;

  return (
    <div
      role="region"
      aria-label="Vendor comparison basket"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:justify-end sm:px-0"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-ink/10 bg-cream/95 px-4 py-3 shadow-lg backdrop-blur sm:w-auto">
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Compare
          </span>
          <span className="text-sm font-medium text-ink">
            {ids.length} selected
          </span>
        </div>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink/55 underline-offset-2 hover:text-ink hover:underline"
        >
          <X aria-hidden className="h-3 w-3" strokeWidth={2} />
          Clear
        </button>
        {canCompare ? (
          <Link
            href={compareHref}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta/90"
          >
            Compare {ids.length}
            <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        ) : (
          <span
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-ink/10 px-3 py-1.5 text-sm font-medium text-ink/45"
            aria-disabled="true"
          >
            Add 1 more
          </span>
        )}
      </div>
    </div>
  );
}
