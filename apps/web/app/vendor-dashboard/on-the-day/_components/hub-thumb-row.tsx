'use client';

/**
 * 👍 THE HUB'S THUMB ROW (supplier dashboard v13, owner "Approved." 2026-10-29; prototype `renderThumb`, `hub:`):
 *
 *   · Set up            — [ 🔍 Find an event to set up ] (＋) — the field opens the Hub ▾ with its words in the menu's
 *                          own search (`HUB_FIND_EVENT`: one list of events, never a second finder); ＋ is "Add a
 *                          moment, tool or helper", each choice a door the page already has (the hosts' schedule ·
 *                          the tools on this page · Crew). A choice this supplier cannot use here is not offered.
 *   · The event's pages — [ 🔍 Find a guest or a table ] alone — it narrows the page rows in place by their words; when
 *                          nothing matches it says so (`data-hub-pages-none`) rather than leaving a blank list.
 *   · Crew              — [ 🔍 Search your crew ] (v13 desktop frame, 2026-10-31) — it narrows the crew's phones in place
 *                          by name · role · state; when nothing matches it says so (`data-crew-none`).
 *
 * The shared `ThumbRow` in the supplier's floating plumbing (`SupplierThumbRow`: the foot on a phone, up into the
 * pinned row from 701). Nothing here reads or writes — every door is handed in by the page.
 * 🔒 on-the-day/the-hub-is-set-up-per-event.test.ts
 */
import { useRouter } from 'next/navigation';
import { ThumbRow } from '@/components/thumb-row';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import type { HubAddChoice, HubSegment } from '@/lib/hub-events';
import { HUB_FIND_EVENT } from './hub-event-menu';

/** Hide every page row whose words do not hold `words`; say so when none is left. */
function narrowPageRows(words: string) {
  const needle = words.trim().toLowerCase();
  let shown = 0;
  for (const row of document.querySelectorAll<HTMLElement>('[data-hub-page-row]')) {
    const hit = !needle || (row.textContent ?? '').toLowerCase().includes(needle);
    row.hidden = !hit;
    if (hit) shown += 1;
  }
  const none = document.querySelector<HTMLElement>('[data-hub-pages-none]');
  if (none) none.hidden = shown > 0;
}

/** Crew: hide every phone whose words (name · role · state) do not hold `words`; say so when none is left. */
function narrowCrewRows(words: string) {
  const needle = words.trim().toLowerCase();
  let shown = 0;
  for (const row of document.querySelectorAll<HTMLElement>('[data-crew-pass]')) {
    const hit = !needle || (row.textContent ?? '').toLowerCase().includes(needle);
    row.hidden = !hit;
    if (hit) shown += 1;
  }
  const none = document.querySelector<HTMLElement>('[data-crew-none]');
  if (none) none.hidden = shown > 0 || document.querySelectorAll('[data-crew-pass]').length === 0;
}

export function HubThumbRow({ seg, add = [] }: { seg: HubSegment; add?: readonly HubAddChoice[] }) {
  const router = useRouter();
  if (seg === 'crew') {
    // 🔎 CREW SEARCH (v13 desktop: "Search your crew" in the bar): narrows the crew's phones in place by their words.
    return (
      <SupplierThumbRow
        name="hub-crew"
        label="Crew tools"
        row={
          <ThumbRow
            name="hub-crew"
            field={{
              placeholder: 'Search your crew',
              input: { onInput: (e) => narrowCrewRows(e.currentTarget.value), 'data-hub-thumb-find': 'crew' },
            }}
          />
        }
      />
    );
  }
  if (seg === 'pages') {
    return (
      <SupplierThumbRow
        name="hub-pages"
        label="Page tools"
        row={
          <ThumbRow
            name="hub-pages"
            field={{
              placeholder: 'Find a guest or a table',
              input: { onInput: (e) => narrowPageRows(e.currentTarget.value), 'data-hub-thumb-find': 'pages' },
            }}
          />
        }
      />
    );
  }
  return (
    <SupplierThumbRow
      name="hub-setup"
      label="Set up tools"
      row={
        <ThumbRow
          name="hub-setup"
          field={{
            placeholder: 'Find an event to set up',
            input: {
              'data-hub-thumb-find': 'setup',
              // The prototype's own move: the field hands its words to the Hub ▾ and steps aside for its list.
              onFocus: (e) => {
                const el = e.currentTarget;
                window.dispatchEvent(new CustomEvent(HUB_FIND_EVENT, { detail: el.value }));
                el.value = '';
                el.blur();
              },
            },
          }}
          action={
            add.length
              ? {
                  menu: add.map((a) => ({ key: a.key, label: a.label, hint: a.hint })),
                  label: 'Add a moment, tool or helper',
                  value: null,
                  mark: 'data-hub-thumb-add',
                  onPick: (k) => {
                    const to = add.find((a) => a.key === k);
                    if (to) router.push(to.href);
                  },
                }
              : null
          }
        />
      }
    />
  );
}
