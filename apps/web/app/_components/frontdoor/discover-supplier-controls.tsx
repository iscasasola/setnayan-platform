'use client';

/**
 * discover-supplier-controls.tsx — "All categories ▾", "Sort ▾" and "Filters" on Discover (`/`).
 *
 * Owner, verbatim (2026-11-12): *"find suppliers needs to be also inside discover already. they do not need to have
 * their own page"*. Drawn on `prototypes/discover_with_suppliers_2026-11-12_fable.html` (DECISION_LOG 2026-11-12
 * "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"); its Map card names each control's kind (INTERACTION_RULES § 9):
 *   · All categories ▾ · Sort ▾ — Dropdown: a tap OPENS the choices, never cycles (`PickMenu`'s grammar);
 *   · Filters — Action button, opening the shipped filter drawer (`filter-drawer.tsx`) as a sheet over the page:
 *     bottom sheet on a phone, right-side panel on a computer — the drawer's own, unchanged layout.
 *
 * 🔑 REUSED, NOT REDRAWN. Sort is the shipped `PickMenu`. Filters is the shipped `FilterDrawer`. The category list is
 * the SAME list `/explore`'s category search offers (`lib/marketplace-category-options.ts`, folders from the code's
 * own taxonomy).
 *
 * 💸 NOTHING HERE COSTS THE PLAIN FRONT PAGE A READ. The drawer and the category list are LAZY: their code (and the
 * category list's data, which is code) loads on the first press, never on the page's first load — and the press
 * shows at once (pressed, plus one line saying what is loading). Picking goes to an address; the server draws the
 * supplier view there. No request is made by opening anything.
 */
import dynamic from 'next/dynamic';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pickArrowClass, pickButtonClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import type { FilterDrawerProps } from '@/app/(shell)/explore/_components/filter-drawer';
import { formatCount } from '@/lib/format-number';

/** The one line that says what is loading (a press shows pressed at once — house rule). */
function LoadingLine({ words }: { words: string }) {
  return (
    <p role="status" aria-live="polite" className="w-full text-xs text-ink/65" data-discover-loading="">
      {words}
    </p>
  );
}

const DiscoverFilterSheet = dynamic(() => import('./discover-filter-sheet').then((m) => m.DiscoverFilterSheet), {
  ssr: false,
  loading: () => <LoadingLine words="Loading filters…" />,
});

const DiscoverCategorySheet = dynamic(
  () => import('./discover-category-sheet').then((m) => m.DiscoverCategorySheet),
  { ssr: false, loading: () => <LoadingLine words="Loading categories…" /> },
);

/** "All categories ▾" — opens the folders and their categories, with a find-a-category box. */
export function DiscoverCategoryButton({ label }: { label: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Category: ${label ?? 'All categories'}`}
        data-discover-category=""
        onClick={() => setOpen((o) => !o)}
        className={pickButtonClass(false)}
      >
        <span className="min-w-0 truncate">{label ?? 'All categories'}</span>
        <ChevronDown aria-hidden className={pickArrowClass(open)} strokeWidth={2} />
      </button>
      {open ? <DiscoverCategorySheet current={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * "Sort ▾" — ONE dropdown that lists its choices (the drawing's Map card: "A row of pills for 3+ values is against
 * the rules"). The addresses are built by the server from the view's own `buildHref`, so a sort keeps every other
 * filter and starts again at page 1, exactly as the retired chips did.
 */
export function DiscoverSortMenu({
  value,
  options,
}: {
  value: string;
  options: ReadonlyArray<{ key: string; label: string; href: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const byKey = new Map(options.map((o) => [o.key, o.href]));
  return (
    <>
      <PickMenu
        label="Sort"
        value={value}
        dataAttr="data-discover-sort"
        options={options.map((o) => ({ key: o.key, label: o.label }))}
        onPick={(key) => {
          const href = byKey.get(key);
          if (href && key !== value) start(() => router.push(href));
        }}
      />
      {pending ? <LoadingLine words="Loading suppliers…" /> : null}
    </>
  );
}

/** "Filters" with its count — opens the shipped drawer, its form pointed at `/`. */
export function DiscoverFiltersButton({
  count,
  drawer,
}: {
  count: number;
  drawer: Omit<FilterDrawerProps, 'open' | 'onClose'>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count > 0 ? `Filters (${formatCount(count)} applied)` : 'Filters'}
        data-discover-filters=""
        onClick={() => setOpen(true)}
        className={pickButtonClass(false)}
      >
        <SlidersHorizontal aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>Filters</span>
        {count > 0 ? (
          <span
            aria-hidden
            className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-terracotta-700 px-1.5 font-mono text-[10px] text-cream"
          >
            {formatCount(count)}
          </span>
        ) : null}
      </button>
      {open ? <DiscoverFilterSheet drawer={drawer} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
