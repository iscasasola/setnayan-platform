'use client';

import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRows } from '@/app/_components/form-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { PLUS_ONE_FILTERS, type PlusOneFilter } from '@/lib/guest-roster-view';
import { applyGuestsFilterPick, guestsFilterApplied, guestsFilterOptions } from '@/lib/guests-filter';
import { formatCount } from '@/lib/format-number';
import { GuestPopup } from './guest-popup';
import type { GuestsFilterSheetProps } from './guests-filter-sheet';

/**
 * guests-filter-panel.tsx — the OPEN "Show & sort" sheet (see `guests-filter-sheet.tsx`). Its own chunk, loaded on the
 * first tap of the ≡ (`next/dynamic`), so the List — and the Maker, which draws the List — pays nothing for it at first
 * load (`scripts/check-maker-js-budget.mjs`).
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

export function GuestsFilterPanel({
  filter,
  onFilter,
  hasSides,
  plus,
  asking,
  shown,
  onClearAll,
  onClose,
}: GuestsFilterSheetProps & { onClose: () => void }) {
  const applied = guestsFilterApplied(filter, { plus: Boolean(plus?.value), asking: Boolean(asking?.on) });
  const opts = guestsFilterOptions('list', filter, { hasSides });
  const of = (group: string): PickOption[] => opts.filter((o) => o.group === group).map((o) => ({ key: o.key, label: o.label }));
  const on = (group: string) => opts.find((o) => o.group === group && o.on)?.key ?? null;
  const showOptions = of('Show').concat(asking ? [{ key: 'asking', label: asking.label }] : []);
  const pick = (key: string) => {
    const next = applyGuestsFilterPick(filter, key);
    if (next) onFilter(next);
  };
  return (
    <GuestPopup
      onClose={onClose}
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
            onClick={onClose}
            data-testid="filter-show-n"
          />
        </div>
      </div>
    </GuestPopup>
  );
}
