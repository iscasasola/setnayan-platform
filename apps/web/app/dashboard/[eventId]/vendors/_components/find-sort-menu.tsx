'use client';

/**
 * find-sort-menu.tsx — FIND'S ⇅ (owner 2026-10-29, Find v4.2: *"this row needs to be simpler"* — the filter chips
 * under a category are gone; Sort · Price · Rating live behind the thumb row's ⇅).
 *
 * It is the SHARED ⇅, not a new control: the thumb row's ≡ seat (`ThumbMenu`, `components/thumb-row.tsx`) wearing the
 * Guests ⇅ face (`FilterFace`, `guests-filter-menu.tsx`) — ONE PickMenu with labelled sections, the current choice of
 * each wearing a ✓, the round wearing a dot while anything narrows or re-orders the list. The choices only re-arrange
 * what is already on the page: no request.
 *
 *   Sort   — the bench's own ONE sort (the ranking lenses + the plain sorts) — the same value the couple's own cards
 *            are ordered by, moved here from the list's head (it was the list head's dropdown).
 *   Price  — the open category's own thirds (`priceBands`), offered only when they can be cut honestly.
 *   Rating — any · 4.5 ★ and up · 4.0 ★ and up · new suppliers.
 *
 * Style is not offered: no card carries a style yet (`vendor_service_attributes`), and a choice that can only empty
 * the list is not a choice.
 */
import type { ThumbMenu } from '@/components/thumb-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { FilterFace } from '@/app/dashboard/[eventId]/guests/_components/guests-filter-menu';
import { formatPhpRounded } from '@/lib/php';
import { FIND_FILTERS_OFF, filtersOn, type FindFilters, type FindPrice, type FindRating } from '@/lib/find-service-cards';

const RATINGS: readonly { key: FindRating; label: string }[] = [
  { key: 'any', label: 'Any rating' },
  { key: '4.5', label: '4.5 ★ and up' },
  { key: '4.0', label: '4.0 ★ and up' },
  { key: 'new', label: 'New suppliers' },
];

function priceOptions(bands: { low: number; high: number }): { key: FindPrice; label: string }[] {
  return [
    { key: 'any', label: 'Any price' },
    { key: 'low', label: `Under ${formatPhpRounded(bands.low)}` },
    { key: 'mid', label: `${formatPhpRounded(bands.low)} – ${formatPhpRounded(bands.high)}` },
    { key: 'high', label: `${formatPhpRounded(bands.high)} and up` },
  ];
}

const ok = (on: boolean) => (on ? { text: '✓', tone: 'ok' as const, label: 'chosen' } : undefined);

export function findSortMenu({
  sorts,
  sort,
  defaultSort,
  onSort,
  scope,
  filters,
  bands,
  onFilters,
}: {
  /** The bench's sort choices, as its dropdown offered them (a lens it cannot offer carries its reason). */
  sorts: readonly { key: string; label: string; group?: string; disabledNote?: string }[];
  sort: string;
  /** The order the list starts in — not counted as a filter. */
  defaultSort: string;
  onSort: (key: string) => void;
  /** The open category's name — Price and Rating act on it; null (none open) → Sort only. */
  scope: string | null;
  filters: FindFilters;
  bands: { low: number; high: number } | null;
  onFilters: (next: FindFilters) => void;
}): ThumbMenu {
  const narrowing = scope ? filtersOn(filters) : 0;
  const reordered = sort !== defaultSort;
  const menu: PickOption[] = sorts.map((s) => ({
    key: `sort:${s.key}`,
    label: s.label,
    group: 'Sort',
    disabledNote: s.disabledNote,
    trail: ok(s.key === sort),
  }));
  if (scope) {
    if (bands) {
      for (const p of priceOptions(bands)) menu.push({ key: `price:${p.key}`, label: p.label, group: 'Price', trail: ok(filters.price === p.key) });
    }
    for (const r of RATINGS) menu.push({ key: `rating:${r.key}`, label: r.label, group: 'Rating', trail: ok(filters.rating === r.key) });
  }
  if (narrowing > 0 || reordered) menu.push({ key: 'clear', label: 'Clear filters', group: ' ' });
  return {
    mark: 'data-thumb-sort',
    label: scope ? `Sort and filter ${scope}` : 'Sort suppliers',
    value: null,
    face: <FilterFace on={narrowing > 0 || reordered} />,
    menu,
    onPick: (k) => {
      if (k === 'clear') {
        onSort(defaultSort);
        onFilters(FIND_FILTERS_OFF);
        return;
      }
      const [kind, value] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
      if (kind === 'sort') onSort(value);
      else if (kind === 'price') onFilters({ ...filters, price: value as FindPrice });
      else if (kind === 'rating') onFilters({ ...filters, rating: value as FindRating });
    },
  };
}
