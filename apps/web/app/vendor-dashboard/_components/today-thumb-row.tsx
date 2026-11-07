'use client';

import { useRef, useState } from 'react';
import { ListFilter } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { SupplierThumbRow } from './supplier-thumb-row';
import { TODAY_SHOW_OPTIONS } from '@/lib/supplier-today';
import { narrowTodayNeeds, type TodayShow as Show } from '@/lib/today-needs-narrow';

/**
 * 🔍 TODAY'S THUMB ROW (THE ONE BUILD A10, v113): [ 🔍 Search today ] · Show ▾ — the shared `ThumbRow` in the supplier's
 * floating plumbing (`SupplierThumbRow`, 10 px above the bar). Show is ONE dropdown (any set of choices is one
 * `PickMenu`): Everything · Inquiries · Bookings · Payments · Meetings · Messages · Quotes & contracts · Reviews ·
 * Documents — the kinds `todayRowWords` already names (no "Access requests": owner Q7, no source).
 *
 * Both narrow the SERVER-DRAWN Needs-you rows in place, by their words and their `data-today-need-kind` (the shipped
 * Hub row's way — `hub-thumb-row.tsx`): nothing is read, nothing re-renders. A miss says "Nothing waiting matches that
 * search" (the shipped "No services match that search" pattern), never a blank list.
 * 🔒 app/vendor-dashboard/_components/today-rows-jump.test.ts
 */
export function TodayThumbRow() {
  const [show, setShow] = useState<Show>('all');
  const words = useRef('');
  const narrow = (w: string, s: Show) => narrowTodayNeeds(document, w, s);
  return (
    <SupplierThumbRow
      name="today"
      label="Today tools"
      row={
        <ThumbRow
          name="today"
          field={{
            placeholder: 'Search today',
            tour: 'today-search',
            input: {
              onInput: (e) => {
                words.current = e.currentTarget.value;
                narrow(words.current, show);
              },
              'data-today-search': '',
            },
            onClear: () => {
              words.current = '';
              narrow('', show);
            },
          }}
          right={[
            {
              menu: TODAY_SHOW_OPTIONS.map((o) => ({ key: o.key, label: o.label })),
              label: 'Show',
              value: show,
              // The menu's face: one funnel (v113's Show round) — its options carry no icons of their own.
              face: (
                <span aria-hidden className="grid place-items-center">
                  <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </span>
              ),
              mark: 'data-today-show',
              tour: 'today-show',
              onPick: (k) => {
                const next = k as Show;
                setShow(next);
                narrow(words.current, next);
              },
            },
          ]}
        />
      }
    />
  );
}
