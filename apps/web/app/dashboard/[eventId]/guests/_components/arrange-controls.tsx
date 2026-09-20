'use client';

/**
 * arrange-controls.tsx — the roster header, as a control.
 *
 * ⚖ Owner 2026-09-20: *"when you click on this row … it will arrange
 * everything by name, by side … add a checkbox beside them so we can set how
 * they are arranged. this is on desktop. on mobile … an icon on the header of
 * the table … which will ask us group it by how? then we check which ones we
 * want."*
 *
 * ── ONE CELL, TWO CONTROLS, BECAUSE THEY ARE TWO QUESTIONS ─────────────────
 *   • the LABEL  → `?sort=`  — one order for the rows
 *   • the BOX    → `?by=`    — the FIRST ticked column makes the headings;
 *                              every one after it only orders rows inside them
 *                              (owner 2026-09-20: *"first one only groups[,]
 *                              the second and succeeding just arranges and
 *                              does not group"*)
 *
 * They must stay separately hittable. A single control that did both could not
 * express "role sections, ordered by RSVP inside each", which is exactly the
 * arrangement one `?sort=` could never reach.
 *
 * ⚠ THE BOX IS AN `<input>` INSIDE ITS `<label>`, and the label carries no
 * handler of its own. A click on the label text forwards ONE synthetic click to
 * the input; if both carried a handler the grouping would toggle twice and
 * appear inert. See the test.
 *
 * URL-merge contract copied verbatim from `sort-select.tsx`: read the latest
 * `searchParams` INSIDE the handler, so a filter click that landed mid-
 * interaction is never clobbered, and `router.replace(..., {scroll:false})` so
 * re-arranging a list does not throw the host back to the top of it.
 */

import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  ARRANGE_COLUMNS,
  arrangeLabel,
  serializeGrouping,
  toggleGrouping,
  type ArrangeKey,
} from '@/lib/roster-arrangement';

/** Which `?sort=` a column's label asks for. */
export const SORT_FOR_COLUMN: Record<ArrangeKey, string> = {
  name: 'last_name',
  side: 'side',
  // ⚖ NOT an A–Z of the role enum — that sort was retired 2026-06-05 in favour
  // of the curated hierarchy, which IS what "by role" means for a wedding.
  role: 'importance',
  group: 'group',
  rsvp: 'rsvp',
  seat: 'seat',
};

function useArrange(grouping: readonly ArrangeKey[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function push(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return {
    setSort: (key: ArrangeKey) =>
      push((p) => p.set('sort', SORT_FOR_COLUMN[key])),
    toggleGroup: (key: ArrangeKey) =>
      push((p) => {
        const next = toggleGrouping(grouping, key);
        // ⚠ An EMPTY `by` is a real answer ("no headings") and must survive a
        // round trip — deleting the param would hand the host back the
        // sort-derived default they just switched off.
        p.set('by', serializeGrouping(next));
      }),
  };
}

/** One header cell: a grouping box and a sorting label. */
export function ArrangeTh({
  column,
  grouping,
  sort,
  className,
}: {
  column: ArrangeKey;
  grouping: readonly ArrangeKey[];
  sort: string;
  className?: string;
}) {
  const { setSort, toggleGroup } = useArrange(grouping);
  const level = grouping.indexOf(column) + 1;
  const ticked = level > 0;
  // Only the first tick groups. The badge says WHICH job this column is doing,
  // because a row of identical ticks would claim six headings that never come.
  const groups = level === 1;
  const sorted = SORT_FOR_COLUMN[column] === sort;
  const label = arrangeLabel(column);
  const what = groups
    ? `Grouped by ${label}`
    : ticked
      ? `Ordered by ${label} (${level - 1} inside each group)`
      : `Group by ${label}`;

  return (
    <th className={className} scope="col">
      <span className="flex items-center gap-1.5">
        <label
          className="inline-flex cursor-pointer items-center gap-0.5 rounded p-0.5 hover:bg-ink/5"
          title={what}
        >
          <input
            type="checkbox"
            checked={ticked}
            onChange={() => toggleGroup(column)}
            aria-label={ticked ? `Stop arranging by ${label}` : `Group by ${label}`}
            className="h-3 w-3 rounded border-ink/30 text-terracotta-700 focus:ring-terracotta"
          />
          {ticked ? (
            <span
              className={`font-sans text-[9px] font-bold leading-none ${
                groups ? 'text-terracotta-700' : 'text-ink/40'
              }`}
            >
              {groups ? '§' : level - 1}
            </span>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() => setSort(column)}
          aria-label={`Sort by ${label}`}
          title={`Sort by ${label}`}
          className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium hover:bg-ink/5 hover:text-ink ${
            sorted ? 'text-terracotta-700' : ''
          }`}
        >
          {label}
          {sorted ? <ChevronDown className="h-3 w-3" strokeWidth={2.4} aria-hidden /> : null}
        </button>
      </span>
    </th>
  );
}

/**
 * The phone's version of the same header row.
 *
 * A phone has no header row to put six boxes in, so the same choices live
 * behind one icon — and the sheet stays OPEN across ticks, because "we check
 * which ones we want" is plural and a sheet that closed on the first tick
 * would make a second level cost two taps and a scroll.
 */
export function ArrangeSheet({
  grouping,
  sort,
}: {
  grouping: readonly ArrangeKey[];
  sort: string;
}) {
  const [open, setOpen] = useState(false);
  const { setSort, toggleGroup } = useArrange(grouping);

  return (
    <div className="relative lg:hidden">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-ink/50">
          {grouping.length
            ? `${arrangeLabel(grouping[0]!)}${
                grouping.length > 1
                  ? ` · by ${grouping.slice(1).map(arrangeLabel).join(', ')}`
                  : ''
              }`
            : 'No grouping'}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Group it by how?"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink/10 ${
            open || grouping.length ? 'text-terracotta-700' : 'text-ink/50'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      {open ? (
        <>
          {/* Tapping away closes it; tapping a row inside does not. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-tile border border-ink/10 bg-cream p-2.5 shadow-lg">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
              Group it by how?
            </p>
            {ARRANGE_COLUMNS.map((c) => {
              const level = grouping.indexOf(c.key) + 1;
              const groups = level === 1;
              return (
                <label
                  key={c.key}
                  className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-ink/[0.04] ${
                    groups
                      ? 'font-medium text-terracotta-700'
                      : level > 0
                        ? 'text-ink/80'
                        : 'text-ink/80'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={level > 0}
                    onChange={() => toggleGroup(c.key)}
                    className="h-3.5 w-3.5 rounded border-ink/30 text-terracotta-700 focus:ring-terracotta"
                  />
                  <span className="flex-1">{c.label}</span>
                  {level > 0 ? (
                    <span
                      className={`rounded px-1.5 text-[10px] leading-4 ${
                        groups
                          ? 'bg-terracotta/10 text-terracotta-700'
                          : 'bg-ink/[0.06] text-ink/50'
                      }`}
                    >
                      {groups ? 'headings' : `then ${level - 1}`}
                    </span>
                  ) : null}
                </label>
              );
            })}
            <p className="mt-1.5 px-1.5 text-[11px] leading-snug text-ink/50">
              The first one you tick makes the headings. Anything after it just
              orders the rows inside them.
            </p>
            <div className="my-2 border-t border-ink/10" />
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
              Sort inside each
            </p>
            <div className="flex flex-wrap gap-1">
              {ARRANGE_COLUMNS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setSort(c.key);
                    setOpen(false);
                  }}
                  className={`rounded-md px-2 py-1 text-xs ${
                    SORT_FOR_COLUMN[c.key] === sort
                      ? 'bg-terracotta/10 text-terracotta-700'
                      : 'text-ink/70 hover:bg-ink/5'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
