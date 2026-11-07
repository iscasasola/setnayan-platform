'use client';

import { ListFilter } from 'lucide-react';
import type { ThumbMenu } from '@/components/thumb-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { applyGuestsFilterPick, guestsFilterIsOn, guestsFilterOptions, type GuestsFilter } from '@/lib/guests-filter';
import type { GuestsView } from '@/lib/guests-views';

/**
 * guests-filter-menu.tsx — THE ⇅ ROUND OF EVERY GUESTS VIEW (R4 slice 1, owner 2026-10-29, prototype `filterSheet`).
 *
 * ONE PickMenu (owner 2026-09-28, "any set of choices is a dropdown") with up to three sections — Show · Group by · Sort
 * (`lib/guests-filter.ts`, the one state) — and after them the view's own shipped items (the List's +1 · Select… ·
 * File · Add ways; the Map's Add ways; Seats' people), so nothing a view's ≡ held before is lost. The current choice of
 * each section wears a ✓; the round wears a dot while anything narrows or re-orders the list.
 *
 * The face is the List's shipped ≡ icon (`ListFilter`) on every view — the same round the owner already knows.
 */
export function FilterFace({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="relative inline-flex h-[18px] w-[18px]" data-filter-face={on ? 'on' : 'off'}>
      <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} />
      {on ? <i className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-terracotta" /> : null}
    </span>
  );
}

export function guestsFilterMenu({
  view,
  filter,
  onFilter,
  hasSides,
  extras = [],
  showExtras = [],
  onExtra,
  alsoOn = false,
  label = 'Show, group or sort',
  mark = 'data-thumb-filter',
  tour,
}: {
  view: GuestsView;
  filter: GuestsFilter;
  /** The next filter — the screen writes it (and the address). */
  onFilter: (next: GuestsFilter) => void;
  hasSides: boolean;
  /** The view's own shipped items, after the filter's sections. */
  extras?: readonly PickOption[];
  /** Choices of the view's own that belong IN the Show section (the List's "Asking to join", R4 slice 11) — drawn right
   *  after Show's last choice, picked through `onExtra`. */
  showExtras?: readonly PickOption[];
  onExtra?: (key: string) => void;
  /** Something of the view's own also narrows the list (the List's +1 filter) — the dot shows. */
  alsoOn?: boolean;
  label?: string;
  mark?: string;
  tour?: string;
}): ThumbMenu {
  const menu: PickOption[] = guestsFilterOptions(view, filter, { hasSides }).map((o) => ({
    key: o.key,
    label: o.label,
    group: o.group,
    trail: o.on ? { text: '✓', tone: 'ok' as const, label: 'shown now' } : undefined,
  }));
  // The view's own Show choices sit inside Show, right after its last choice — never a second "Show" at the foot.
  const lastShow = menu.map((o) => o.group).lastIndexOf('Show');
  if (showExtras.length) {
    // One ✓ in Show: a picked view-own choice takes it from the filter's.
    if (showExtras.some((o) => o.trail)) for (const o of menu) if (o.group === 'Show') o.trail = undefined;
    menu.splice(lastShow + 1, 0, ...showExtras);
  }
  return {
    mark,
    tour,
    label,
    value: null,
    face: <FilterFace on={alsoOn || guestsFilterIsOn(filter, view)} />,
    menu: menu.concat(extras),
    onPick: (k) => {
      const next = applyGuestsFilterPick(filter, k);
      if (next) onFilter(next);
      else onExtra?.(k);
    },
  };
}
