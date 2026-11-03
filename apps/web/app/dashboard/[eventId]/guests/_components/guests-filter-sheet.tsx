'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRows } from '@/app/_components/form-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { PLUS_ONE_FILTERS, type PlusOneFilter } from '@/lib/guest-roster-view';
import { applyGuestsFilterPick, guestsFilterApplied, guestsFilterOptions, type GuestsFilter } from '@/lib/guests-filter';
import { formatCount } from '@/lib/format-number';
import { FilterFace } from './guests-filter-menu';
import { GuestPopup } from './guest-popup';

/**
 * guests-filter-sheet.tsx — THE LIST'S ≡ AS A "SHOW & SORT" SHEET (owner approved 2026-11-03, prototype
 * `docs/prototypes/guests_filter_popup_2026-11-03.html`; then "so fix their locations": the filter only filters).
 *
 * One sheet from the bottom, in thumb reach: "Show & sort · N applied", then two topics —
 *   Who you see          Show ▾ · +1s ▾ (only when the list has +1s)
 *   How it is laid out   Group by ▾ · Sort ▾
 * — each set of choices ONE dropdown (the shipped `ChosenRow`: a PickMenu in a Form row, title + one line, the rest in
 * ⓘ), and at the foot "Clear all" + "Show N guests". The options and their rules are the shipped ones, unchanged
 * (`lib/guests-filter.ts`; "Asking to join" sits inside Show; a new Group by clears the +1 narrowing — the screen's
 * `pickFilter`). A pick applies at once, under the sheet; nothing resets the screen.
 *
 * The actions the old ≡ held live where they belong now: ＋ Add ▾ on the thumb row (From your people · Import a file),
 * Select on the top row, Download as Excel in Guests ⚙. 🔒 guests/_components/the-filter-sheet-only-filters.test.ts
 */

export const FILTER_SHEET_TOPICS = ['Who you see', 'How it is laid out'] as const;

const SHOW_LINE = 'Which guests are in the list';
const SHOW_ABOUT = '“To invite” is everyone not sent an invitation yet. “Asking to join” opens the requests waiting for your yes.';
const PLUS_LINE = 'Only seats a guest brings';
const PLUS_ABOUT = '“No name yet” is a seat still waiting for its guest’s name. A new Group by shows everyone again.';
const GROUP_LINE = 'The headings of the list';
const GROUP_ABOUT = 'Side is offered only when your event has sides. The Map shares this choice.';
const SORT_LINE = 'The order inside each heading';
const SORT_ABOUT = 'Importance is the page’s own order — the couple first, then the entourage. A +1 always stays beside their guest.';

const PLUS_ALL = 'plus:all';

function TopicHead({ name, first = false }: { name: string; first?: boolean }) {
  return (
    <p
      data-filter-topic={name}
      className={`${first ? 'pt-1' : 'pt-5'} pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 [&+*]:!border-t-0`}
    >
      {name}
    </p>
  );
}

export function GuestsFilterSheet({
  filter,
  onFilter,
  hasSides,
  plus,
  asking,
  shown,
  onClearAll,
  mark = 'data-thumb-sort',
  tour = 'guests-sort',
}: {
  filter: GuestsFilter;
  /** The next filter — the screen's `pickFilter` (a new Group by clears +1s and opens its first heading). */
  onFilter: (next: GuestsFilter) => void;
  hasSides: boolean;
  /** 🪑 The List's own +1 narrowing — null when the list has no +1s (the dropdown is not drawn). */
  plus: { value: PlusOneFilter | null; onPick: (next: PlusOneFilter | null) => void } | null;
  /** 📥 "Asking to join · N" inside Show (the couple, R4 slice 11) — null when it is not offered. */
  asking: { label: string; on: boolean; onPick: () => void } | null;
  /** How many guests the list shows now — "Show N guests". */
  shown: number;
  /** ✕ Clear all — every choice back to the plain list. */
  onClearAll: () => void;
  mark?: string;
  /** 🔦 The spotlight tour's anchor — the shipped ≡'s token, kept. */
  tour?: string;
}) {
  const [open, setOpen] = useState(false);
  const opts = guestsFilterOptions('list', filter, { hasSides });
  const of = (group: string): PickOption[] => opts.filter((o) => o.group === group).map((o) => ({ key: o.key, label: o.label }));
  const on = (group: string) => opts.find((o) => o.group === group && o.on)?.key ?? null;

  const showOptions = of('Show').concat(asking ? [{ key: 'asking', label: asking.label }] : []);
  const applied = guestsFilterApplied(filter, { plus: Boolean(plus?.value), asking: Boolean(asking?.on) });
  const pick = (key: string) => {
    const next = applyGuestsFilterPick(filter, key);
    if (next) onFilter(next);
  };

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
        <FilterFace on={applied > 0} />
      </button>
      {open ? (
        <GuestPopup
          onClose={() => setOpen(false)}
          rootClassName="fixed inset-0 z-40"
          panelClassName="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-cream shadow-2xl tab:left-auto tab:right-4 tab:bottom-4 tab:w-[min(26rem,calc(100vw-2rem))] tab:rounded-2xl"
          panelData={{ 'data-filter-sheet': '' }}
          labelledById="guests-filter-sheet-title"
        >
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-ink/15" />
          <h2 id="guests-filter-sheet-title" className="shrink-0 px-5 pb-1 pt-2 text-[17px] font-semibold text-ink">
            Show &amp; sort
            {applied > 0 ? (
              <span className="ml-2 text-[13px] font-semibold text-terracotta-700" data-filter-applied={applied}>
                · {applied} applied
              </span>
            ) : null}
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
            <FormRows data="guests-filter">
              <TopicHead name={FILTER_SHEET_TOPICS[0]} first />
              <ChosenRow
                data="filter-show"
                name="Show"
                line={SHOW_LINE}
                about={{ words: SHOW_ABOUT }}
                value={asking?.on ? 'asking' : on('Show')}
                options={showOptions}
                onPick={(k) => (k === 'asking' ? asking?.onPick() : pick(k))}
                dataAttr="data-filter-show"
              />
              {plus ? (
                <ChosenRow
                  data="filter-plus"
                  name="+1s"
                  line={PLUS_LINE}
                  about={{ words: PLUS_ABOUT }}
                  value={plus.value ? `plus:${plus.value}` : PLUS_ALL}
                  options={[{ key: PLUS_ALL, label: 'All guests' }, ...PLUS_ONE_FILTERS.map((f) => ({ key: `plus:${f.key}`, label: f.label }))]}
                  onPick={(k) => plus.onPick(k === PLUS_ALL ? null : (k.slice(5) as PlusOneFilter))}
                  dataAttr="data-filter-plus"
                />
              ) : null}
              <TopicHead name={FILTER_SHEET_TOPICS[1]} />
              <ChosenRow
                data="filter-group"
                name="Group by"
                line={GROUP_LINE}
                about={{ words: GROUP_ABOUT }}
                value={on('Group by')}
                options={of('Group by')}
                onPick={pick}
                dataAttr="data-filter-group"
              />
              <ChosenRow
                data="filter-sort"
                name="Sort"
                line={SORT_LINE}
                about={{ words: SORT_ABOUT }}
                value={on('Sort')}
                options={of('Sort')}
                onPick={pick}
                dataAttr="data-filter-sort"
              />
            </FormRows>
          </div>
          <div className="flex shrink-0 items-stretch gap-2.5 border-t border-ink/10 px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 [&_.ab]:w-full">
            <div className="shrink-0">
              <ActionButton tone="neutral" icon={X} label="Clear all" disabled={applied === 0} onClick={onClearAll} data-testid="filter-clear-all" />
            </div>
            <div className="min-w-0 flex-1">
              <ActionButton
                tone="brand"
                main
                icon={Check}
                label={`Show ${formatCount(shown)} ${shown === 1 ? 'guest' : 'guests'}`}
                onClick={() => setOpen(false)}
                data-testid="filter-show-n"
              />
            </div>
          </div>
        </GuestPopup>
      ) : null}
    </>
  );
}
