'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { PlusOneFilter } from '@/lib/guest-roster-view';
import { guestsFilterIsOn, type GuestsFilter } from '@/lib/guests-filter';
import type { PaxListService, PaxPick } from '@/lib/guest-pax-filter';
import { FilterFace } from './guests-filter-menu';

/**
 * guests-filter-sheet.tsx — THE LIST'S ≡ AS A "SHOW & SORT" SHEET (owner approved 2026-11-03, prototype
 * `docs/prototypes/guests_filter_popup_2026-11-03.html`; then "so fix their locations": the filter only filters).
 *
 * One sheet from the bottom, in thumb reach: "Show & sort · N applied", then two topics —
 *   Who you see          Show ▾ · +1s ▾ (only when the list has +1s)
 *   Who each service counts   one ▾ per per-head service (owner 2026-11-12) — only when the event has one
 *   How it is laid out   Group by ▾ · Sort ▾
 * — each set of choices ONE dropdown (the shipped `ChosenRow`: a PickMenu in a Form row, title + one line, the rest in
 * ⓘ), and at the foot "Clear all" + "Show N guests". The options and their rules are the shipped ones, unchanged
 * (`lib/guests-filter.ts`; "Asking to join" sits inside Show; a new Group by clears the +1 narrowing — the screen's
 * `pickFilter`). A pick applies at once, under the sheet; nothing resets the screen.
 *
 * The actions the old ≡ held live where they belong now: ＋ Add ▾ on the thumb row (From your people · Import a file),
 * Select on the top row, Download as Excel in Guests ⚙. 🔒 guests/_components/the-filter-sheet-only-filters.test.ts
 */

/* ⚡ The open sheet is its own chunk, fetched on the first tap — never with the List (or the Maker, which draws it). */
const GuestsFilterPanel = dynamic(() => import('./guests-filter-panel').then((m) => m.GuestsFilterPanel), { ssr: false });

export type GuestsFilterSheetProps = {
  filter: GuestsFilter;
  /** The next filter — the screen's `pickFilter` (a new Group by clears +1s and opens its first heading). */
  onFilter: (next: GuestsFilter) => void;
  hasSides: boolean;
  /** 🪑 The List's own +1 narrowing — null when the list has no +1s (the dropdown is not drawn). */
  plus: { value: PlusOneFilter | null; onPick: (next: PlusOneFilter | null) => void } | null;
  /** 📥 "Asking to join · N" inside Show (the couple, R4 slice 11) — null when it is not offered. */
  asking: { label: string; on: boolean; onPick: () => void } | null;
  /** 🍽 One row per PER-HEAD service — "Catering ▾ Everyone · Counted · Not counted" (owner 2026-11-12,
      `lib/guest-pax-filter.ts`). With no services the topic is drawn GREYED (owner 2026-11-13), never hidden;
      `refused` = the read failed, said as such. `count` = the guests a pick shows. */
  pax: {
    services: readonly PaxListService[];
    refused?: boolean;
    value: PaxPick | null;
    count: (pick: PaxPick) => number;
    onPick: (next: PaxPick | null) => void;
  } | null;
  /** How many guests the list shows now — "Show N guests". */
  shown: number;
  /** ✕ Clear all — every choice back to the plain list. */
  onClearAll: () => void;
};

export function GuestsFilterSheet({
  mark = 'data-thumb-sort',
  tour = 'guests-sort',
  ...props
}: GuestsFilterSheetProps & {
  mark?: string;
  /** 🔦 The spotlight tour's anchor — the shipped ≡'s token, kept. */
  tour?: string;
}) {
  const [open, setOpen] = useState(false);
  // The dot only — the count ("· N applied") is the panel's, so it loads with it.
  const on = guestsFilterIsOn(props.filter, 'list') || Boolean(props.plus?.value) || Boolean(props.asking?.on) || Boolean(props.pax?.value);
  return (
    <>
      <button
        type="button"
        aria-label="Show and sort"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink"
        data-tour={tour}
        {...{ [mark]: '' }}
      >
        <FilterFace on={on} />
      </button>
      {open ? <GuestsFilterPanel {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
