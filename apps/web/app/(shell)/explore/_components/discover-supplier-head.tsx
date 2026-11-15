/**
 * discover-supplier-head.tsx — the top of Discover's supplier view on `/` (2026-11-12).
 *
 * Drawn on `prototypes/discover_with_suppliers_2026-11-12_fable.html` (DECISION_LOG 2026-11-12 "DISCOVER WITH
 * SUPPLIERS — PROTOTYPE APPROVED"), in its order:
 *
 *   <Category or "Suppliers">
 *   [All categories ▾] [Sort ▾] [Filters ⓝ]
 *   Catering · Makati · Verified only · Clear all filters      ← ONE summary line (the active-filter bands' job)
 *   Compare your shortlist …                       Compare →     ← once two are saved (the shipped line)
 *
 * ⚠ NO SEARCH BOX HERE. The drawing's rule is ONE search box — the top bar's (signed out) or Discover's own search
 * row (signed in). "Narrow these results…" is not carried over; the one search carries the open category's
 * parameters, so typing narrows within it (`lib/discover-suppliers.ts`).
 *
 * Arriving from an event's plan (`?from=plan`) keeps `/explore`'s focused mode exactly: the filter controls are NOT
 * drawn and every filter still applies silently. ("Finding for <event>" is a later slice.)
 *
 * A server component: the three controls are the only client code (`discover-supplier-controls.tsx`).
 *
 * ⚠ NO "Back to Discover" LINK YET, though the drawing has one. Every back is drawn by the shared `BackButton`
 * from the page map (`lib/page-home.ts`; `lib/every-back-goes-home.test.ts` refuses a hand-drawn one), and the way
 * back is a separate slice being built elsewhere — so it is left to that work, not hand-drawn here. The rail's
 * Discover row (signed out) and the account bar's Discover tab (signed in) already lead back to the shelves.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';

import {
  DiscoverCategoryButton,
  DiscoverFiltersButton,
  DiscoverSortMenu,
} from '@/app/_components/frontdoor/discover-supplier-controls';
import type { FilterDrawerProps } from './filter-drawer';

export function DiscoverSupplierHead({
  title,
  categoryLabel,
  focused,
  summary,
  clearHref,
  sort,
  filters,
  compare,
}: {
  /** The open category's name, or "Suppliers". */
  title: string;
  /** The category the dropdown shows as chosen; null = "All categories". */
  categoryLabel: string | null;
  /** `?from=plan` — `/explore`'s focused mode: no filter controls. */
  focused: boolean;
  /** What the view is narrowed by, in words. Empty = nothing to say (no line is drawn). */
  summary: readonly string[];
  /** "Clear all filters" — every narrowing dropped, the view kept open. */
  clearHref: string;
  sort: { value: string; options: ReadonlyArray<{ key: string; label: string; href: string }> };
  filters: { count: number; drawer: Omit<FilterDrawerProps, 'open' | 'onClose'> };
  /** The shipped compare line, once two suppliers are saved (`null` = not yet). */
  compare: ReactNode;
}) {
  return (
    <div data-discover-supplier-head="">
      <h2 className="fd-sechead">
        <span>{title}</span>
      </h2>
      {focused ? null : (
        <div className="mb-3 flex flex-wrap items-center gap-2" data-discover-controls="">
          <DiscoverCategoryButton label={categoryLabel} />
          <DiscoverSortMenu value={sort.value} options={sort.options} />
          <DiscoverFiltersButton count={filters.count} drawer={filters.drawer} />
        </div>
      )}
      {summary.length > 0 ? (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/75" data-discover-summary="">
          <span>{summary.join(' · ')}</span>
          <Link href={clearHref} className="font-medium text-terracotta underline-offset-4 hover:underline">
            Clear all filters
          </Link>
        </p>
      ) : null}
      {compare}
    </div>
  );
}
