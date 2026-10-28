'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { CUSTOMER_SEGMENTS, CUSTOMER_SEGMENT_LABEL, type CustomersSegment } from '../segments';

export type CustomersDoorKey = 'asking' | 'talking' | 'booked' | 'done';

export const CUSTOMERS_DOORS: readonly CustomersDoorKey[] = ['asking', 'talking', 'booked', 'done'];

export type CustomersDoor = {
  key: CustomersDoorKey;
  /** Already worded ("3", "12+"), or null = the roster could not be read — "couldn't load", never 0. */
  value: string | null;
  word: string;
  /** The brand colour — the count that waits on the shop. */
  hot?: boolean;
};

/**
 * 📌 CUSTOMERS' PINNED ROW — `People ▾ · Asking · Talking · Booked · Done · ⚙` (owner 2026-10-28, DECISION_LOG
 * "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE": "Customers — People · Dates · Money + ⚙ on one
 * pinned row. People: the counts (Asking · Talking · Booked · Done) filter"; the 27 Oct template "THE PINNED ROW IS THE
 * APP-WIDE TEMPLATE": selector · counts · one action · ⚙; prototype `supplier_in_place_2026-10-28` `custRows()`).
 *
 * THE TODAY PATTERN, COPIED (`today-counts.tsx`, #7026): one sticky row, the same box at rest and pinned; each count is
 * a FILTER — pressing it shows ITS list right under the row, in place, no navigation (`aria-pressed`); the other lists
 * stay drawn but hidden, so nothing is re-read and a fold left open in one is still open on the way back.
 *
 *   · THE SELECTOR is the page's three views as ONE `PickMenu` ("any set of choices is a dropdown") — People ▾ ·
 *     Dates ▾ · Money ▾, each its own address (`?seg=`), so Back works and a link can name one.
 *   · NO ACTION ON THE ROW: the approved prototype puts ＋ Add (an outside booking) in the thumb bar with the search
 *     ("Search and ＋ Add live in the thumb bar"), and one Add is one door — never two.
 *   · Dates and Money draw the same row without counts (they have their own figures under it).
 *   · HONEST: a count the page could not read says "couldn't load" in the number's place — never 0.
 *
 * 🔒 customers/the-customers-counts-filter-in-place.test.ts
 */
export function CustomersPin({
  seg,
  hrefOf,
  doors = null,
  panels = null,
  initial = 'asking',
  gear,
  between = null,
}: {
  /** A status line between the row and its lists (a payday read that fell short). */
  between?: ReactNode;
  seg: CustomersSegment;
  /** Each view's own address (a fixture page — the dev lab — hands its own). */
  hrefOf: (s: CustomersSegment) => string;
  /** People's four counts; null on Dates and Money. */
  doors?: readonly CustomersDoor[] | null;
  /** Each door's list, drawn by the server. */
  panels?: Readonly<Record<CustomersDoorKey, ReactNode>> | null;
  initial?: CustomersDoorKey;
  /** Customers ⚙ (`CustomersSettings`) — the row's right end. */
  gear: ReactNode;
}) {
  const router = useRouter();
  const [on, setOn] = useState<CustomersDoorKey>(initial);

  const door = (d: CustomersDoor) => {
    const pressed = on === d.key;
    return (
      <button
        key={d.key}
        type="button"
        className={`sn-press grid min-h-11 min-w-0 flex-1 content-center gap-0.5 rounded-full px-0.5 py-1 text-center transition-colors duration-200 motion-reduce:transition-none ${
          pressed ? 'bg-sn-accent' : ''
        }`}
        onClick={() => setOn(d.key)}
        aria-pressed={pressed}
        aria-controls={`customers-list-${d.key}`}
        data-customers-door={d.key}
      >
        {d.value === null ? (
          <>
            <span
              className="block text-[20px] font-semibold leading-none"
              style={{ color: pressed ? 'rgb(var(--sn-on-accent))' : 'rgb(var(--color-warn))' }}
              aria-hidden
            >
              —
            </span>
            <span className={`block truncate text-[11.5px] ${pressed ? 'text-[rgb(var(--sn-on-accent))]' : 'text-ink/60'}`} data-customers-unread="">
              couldn&rsquo;t load
            </span>
          </>
        ) : (
          <>
            <span
              className={`block text-[20px] font-semibold leading-none tabular-nums ${
                pressed ? 'text-[rgb(var(--sn-on-accent))]' : d.hot ? 'text-sn-accent' : 'text-ink'
              }`}
            >
              {d.value}
            </span>
            <span className={`block truncate text-[11.5px] ${pressed ? 'text-[rgb(var(--sn-on-accent))]' : 'text-ink/60'}`}>{d.word}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <>
      <div
        className="sticky top-0 z-[5] -mx-4 mb-3 border-b border-ink/10 px-4 py-1.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        style={{ background: 'var(--sn-canvas)' }}
        data-customers-pin={seg}
        data-pinned-row=""
        data-first-row=""
        data-tour="customers-segments"
      >
        <div className="flex items-center gap-1" role="group" aria-label="Customers">
          <span className="shrink-0" data-customers-view="">
            <PickMenu
              label="Customers — show"
              value={seg}
              buttonText={CUSTOMER_SEGMENT_LABEL[seg]}
              options={CUSTOMER_SEGMENTS.map((s) => ({ key: s, label: CUSTOMER_SEGMENT_LABEL[s] }))}
              compact
              dataAttr="data-customers-picker"
              onPick={(k) => {
                if (k !== seg) router.push(hrefOf(k as CustomersSegment), { scroll: false });
              }}
            />
          </span>
          {doors ? (
            <span className="flex min-w-0 flex-1 items-center gap-0.5" data-customers-doors="" data-tour="customers-filter">
              {doors.map(door)}
            </span>
          ) : (
            <span className="flex-1" aria-hidden />
          )}
          {gear}
        </div>
      </div>
      {between}
      {panels
        ? (['asking', 'talking', 'booked', 'done'] as const).map((key) => (
            <div key={key} id={`customers-list-${key}`} data-customers-list-for={key} hidden={on !== key}>
              {panels[key]}
            </div>
          ))
        : null}
    </>
  );
}
