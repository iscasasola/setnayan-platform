'use client';

import { ChosenRow } from '@/app/_components/form-row';
import { ShowSortSheet, ShowSortTopic } from '@/app/_components/show-sort-sheet';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { PLUS_ONE_FILTERS, type PlusOneFilter } from '@/lib/guest-roster-view';
import { applyGuestsFilterPick, guestsFilterApplied, guestsFilterOptions } from '@/lib/guests-filter';
import { formatCount } from '@/lib/format-number';
import { PAX_EVERYONE, PAX_SIDE_WORDS, paxKey, paxPickOfKey } from '@/lib/guest-pax-filter';
import type { GuestsFilterSheetProps } from './guests-filter-sheet';

/**
 * guests-filter-panel.tsx — the OPEN "Show & sort" sheet (see `guests-filter-sheet.tsx`). Its own chunk, loaded on the
 * first tap of the ≡ (`next/dynamic`), so the List — and the Maker, which draws the List — pays nothing for it at first
 * load (`scripts/check-maker-js-budget.mjs`).
 */
export const FILTER_SHEET_TOPICS = ['Who you see', 'How it is laid out'] as const;
/** 🍽 The per-head services' topic (owner 2026-11-12) — always drawn; greyed while no service is priced per head (2026-11-13). */
export const PAX_TOPIC = 'Who each service counts';

const PAX_LINE = 'Counted · not counted';
/** 🔒 Greyed, never hidden (owner 2026-11-13: "do not hide it. just grey it out until there is an available pax related
 *  booked supplier"). A refused read says so — it never reads as "none". */
const PAX_NONE_NAME = 'Per-guest suppliers';
const PAX_NONE_LINE = 'Shows once a supplier is priced per guest';
const PAX_REFUSED_LINE = 'Couldn’t load your suppliers';
const PAX_ABOUT =
  'Only services priced per head are listed. “Not counted” is the guests you ticked out of this service on their card. “Counted” is everyone this supplier counts — attending, and inside the service’s rule. The supplier sees the number only, never who.';

const SHOW_LINE = 'Which guests are in the list';
const SHOW_ABOUT = '“To invite” is everyone not sent an invitation yet. “Asking to join” opens the requests waiting for your yes.';
const PLUS_LINE = 'Only seats a guest brings';
const PLUS_ABOUT = '“No name yet” is a seat still waiting for its guest’s name. A new Group by shows everyone again.';
const GROUP_LINE = 'The headings of the list';
const GROUP_ABOUT = 'Side is offered only when your event has sides. The Map shares this choice.';
const SORT_LINE = 'The order inside each heading';
const SORT_ABOUT = 'Importance is the page’s own order — the couple first, then the entourage. A +1 always stays beside their guest.';

const PLUS_ALL = 'plus:all';

export function GuestsFilterPanel({
  filter,
  onFilter,
  hasSides,
  plus,
  asking,
  pax,
  shown,
  onClearAll,
  onClose,
}: GuestsFilterSheetProps & { onClose: () => void }) {
  const applied = guestsFilterApplied(filter, { plus: Boolean(plus?.value), asking: Boolean(asking?.on) }) + (pax?.value ? 1 : 0);
  const opts = guestsFilterOptions('list', filter, { hasSides });
  const of = (group: string): PickOption[] => opts.filter((o) => o.group === group).map((o) => ({ key: o.key, label: o.label }));
  const on = (group: string) => opts.find((o) => o.group === group && o.on)?.key ?? null;
  const showOptions = of('Show').concat(asking ? [{ key: 'asking', label: asking.label }] : []);
  const pick = (key: string) => {
    const next = applyGuestsFilterPick(filter, key);
    if (next) onFilter(next);
  };
  return (
    <ShowSortSheet
      onClose={onClose}
      titleId="guests-filter-sheet-title"
      applied={applied}
      rows="guests-filter"
      onClearAll={onClearAll}
      showLabel={`Show ${formatCount(shown)} ${shown === 1 ? 'guest' : 'guests'}`}
    >
      <ShowSortTopic name={FILTER_SHEET_TOPICS[0]} first />
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
      {pax ? (
        <>
          <ShowSortTopic name={PAX_TOPIC} />
          {pax.services.length === 0 ? (
            <div aria-disabled="true" className="pointer-events-none select-none opacity-50" data-filter-pax-none="">
              <ChosenRow
                data="filter-pax-none"
                name={PAX_NONE_NAME}
                line={pax.refused ? PAX_REFUSED_LINE : PAX_NONE_LINE}
                value="none"
                options={[{ key: 'none', label: pax.refused ? 'Couldn’t load' : 'None yet' }]}
                onPick={() => {}}
              />
            </div>
          ) : null}
          {pax.services.map((s) => (
            <ChosenRow
              key={s.id}
              data="filter-pax"
              name={s.name}
              line={PAX_LINE}
              about={{ words: PAX_ABOUT }}
              value={pax.value?.id === s.id ? paxKey(s.id, pax.value.side) : paxKey(s.id, 'all')}
              options={[
                { key: paxKey(s.id, 'all'), label: PAX_EVERYONE },
                ...(['counted', 'out'] as const).map((side) => ({
                  key: paxKey(s.id, side),
                  label: `${PAX_SIDE_WORDS[side]} · ${formatCount(pax.count({ id: s.id, side }))}`,
                })),
              ]}
              onPick={(k) => {
                // "Everyone" on a row that is not the one picked leaves the other service's pick alone.
                const next = paxPickOfKey(k);
                if (next || pax.value?.id === s.id) pax.onPick(next);
              }}
              dataAttr="data-filter-pax"
            />
          ))}
        </>
      ) : null}
      <ShowSortTopic name={FILTER_SHEET_TOPICS[1]} />
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
    </ShowSortSheet>
  );
}
