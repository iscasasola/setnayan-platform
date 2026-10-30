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
 *            are ordered by, moved here from the list's head (it was the list head's dropdown). "Nearest" is one row
 *            per venue with a pin (owner 2026-10-30, "Reception + Ceremony": "Nearest to reception" · "Nearest to
 *            ceremony"), so the venue is picked in this same list — never a second control.
 *   Rating — any · 4.5 ★ and up · 4.0 ★ and up · new suppliers.
 *
 * 💸 PRICE IS A SORT ONLY (owner 2026-10-31, *"sort only"*): price lives in Sort as "Lowest price", which orders every
 * card and removes none. The Price thirds ("Under ₱X" …) that used to sit here filtered cards out and are gone; there
 * is no price range to type either. `find-price-is-a-sort-only.test.ts` holds both.
 *
 * Style is not offered: no card carries a style yet (`vendor_service_attributes`), and a choice that can only empty
 * the list is not a choice.
 */
import type { ThumbMenu } from '@/components/thumb-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { FilterFace } from '@/app/dashboard/[eventId]/guests/_components/guests-filter-menu';
import { FIND_FILTERS_OFF, filtersOn, type FindFilters, type FindRating } from '@/lib/find-service-cards';

const RATINGS: readonly { key: FindRating; label: string }[] = [
  { key: 'any', label: 'Any rating' },
  { key: '4.5', label: '4.5 ★ and up' },
  { key: '4.0', label: '4.0 ★ and up' },
  { key: 'new', label: 'New suppliers' },
];

const ok = (on: boolean) => (on ? { text: '✓', tone: 'ok' as const, label: 'chosen' } : undefined);

export function findSortMenu({
  sorts,
  sort,
  defaultSort,
  onSort,
  scope,
  filters,
  onFilters,
}: {
  /** The bench's sort choices, as its dropdown offered them (a lens it cannot offer carries its reason). */
  sorts: readonly { key: string; label: string; group?: string; disabledNote?: string }[];
  sort: string;
  /** The order the list starts in — not counted as a filter. */
  defaultSort: string;
  onSort: (key: string) => void;
  /** The open category's name — Rating acts on it; null (none open) → Sort only. */
  scope: string | null;
  filters: FindFilters;
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
      else if (kind === 'rating') onFilters({ ...filters, rating: value as FindRating });
    },
  };
}
