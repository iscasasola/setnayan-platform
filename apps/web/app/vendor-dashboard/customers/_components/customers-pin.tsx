'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { usePinFold } from '@/app/_components/pinned-row/use-pin-fold';
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_SEGMENT_LABEL,
  type CustomersDoorKey,
  type CustomersListKey,
  type CustomersSegment,
} from '../segments';
import { SupplierOpenScope } from '../../_components/supplier-open-row';

// The door keys live in the neutral `segments.ts`: a `'use client'` module hands a server page a REFERENCE, never the
// array itself (measured: `CUSTOMERS_DOORS.map is not a function` on the first render).
export type { CustomersDoorKey, CustomersListKey } from '../segments';

export type CustomersDoor = {
  key: CustomersDoorKey;
  /** Already worded ("3", "12+"), or null = the roster could not be read — "couldn't load", never 0. */
  value: string | null;
  word: string;
  /** The brand colour — the count that waits on the shop. */
  hot?: boolean;
};

/**
 * 📌 CUSTOMERS' PINNED ROW — `Events ▾ · Asking · Booked · Done · ⚙` (People ▾ until 2026-10-30 — owner
 * 2026-10-29 "CUSTOMERS ARE EVENTS, NOT PEOPLE": "Customers' first section is EVENTS"; owner 2026-10-28, DECISION_LOG
 * "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE": "Customers — People · Dates · Money + ⚙ on one
 * pinned row. People: the counts (Asking · Talking · Booked · Done) filter"; the 27 Oct template "THE PINNED ROW IS THE
 * APP-WIDE TEMPLATE": selector · counts · one action · ⚙; prototype `supplier_in_place_2026-10-28` `custRows()`).
 *
 * THE TODAY PATTERN, COPIED (`today-counts.tsx`, #7026): one sticky row, the same box at rest and pinned; each count is
 * a FILTER — pressing it shows ITS list right under the row, in place, no navigation (`aria-pressed`); the other lists
 * stay drawn but hidden, so nothing is re-read and a fold left open in one is still open on the way back.
 * 🗂 Events opens with NO count pressed — every event listed (approved v13; controller call 2026-10-30) — and pressing the
 * pressed count again goes back to every event.
 *
 *   · THE SELECTOR is the page's three views as ONE `PickMenu` ("any set of choices is a dropdown") — Events ▾ ·
 *     Dates ▾ · Money ▾, each its own address (`?seg=`), so Back works and a link can name one.
 *   · NO ACTION ON THE ROW: the approved prototype puts ＋ Add (an outside booking) in the thumb bar with the search
 *     ("Search and ＋ Add live in the thumb bar"), and one Add is one door — never two.
 *   · Dates, Money and QR draw the same row with their own figures in the doors' place (`figures`, v13).
 *   · HONEST: a count the page could not read says "couldn't load" in the number's place — never 0.
 *
 * 🔒 customers/the-customers-counts-filter-in-place.test.ts
 */
export function CustomersPin({
  seg,
  hrefs,
  doors = null,
  panels = null,
  initial = null,
  gear,
  between = null,
  after = null,
  columns = null,
  figures = null,
}: {
  /**
   * 📌 Dates · Money · QR's own figures on this row, in the doors' place (`customers-figures.tsx`, v13 2026-10-29) — the
   * same tiles, folded by the same `usePinFold`. Null on Events (its doors are the figures).
   */
  figures?: ReactNode;
  /** What follows the lists in the same column (Events' other chats and kept notes). */
  after?: ReactNode;
  /**
   * 🖥 THE TWO COLUMNS (supplier dashboard v13, 2026-10-29): the lists on the left and the opened event on the right from
   * 701 (`SupplierOpenScope`) — `rest` is what the right column says when no row can open. Absent → one column.
   */
  columns?: { rest: ReactNode } | null;
  /** A status line between the row and its lists (a payday read that fell short). */
  between?: ReactNode;
  seg: CustomersSegment;
  /** Each view's own address (a fixture page — the dev lab — hands its own). Strings, not a function: a server page
   *  cannot hand a client row a function. */
  hrefs: Readonly<Record<CustomersSegment, string>>;
  /** Events' three counts (Asking · Booked · Done); null on Dates and Money. */
  doors?: readonly CustomersDoor[] | null;
  /** Every event (`all`) and each count's list, drawn by the server. */
  panels?: Readonly<Record<CustomersListKey, ReactNode>> | null;
  /** The count an address names; null (the default) = no count pressed — every event (approved v13). */
  initial?: CustomersDoorKey | null;
  /** Customers ⚙ (`CustomersSettings`) — the row's right end. */
  gear: ReactNode;
}) {
  const router = useRouter();
  // 🔑 Null = no count pressed: EVERY event is listed (controller call 2026-10-30, the approved v13). A count filters in
  // place; pressing it again shows them all — opening on Asking alone made a supplier's booked events look gone.
  const [on, setOn] = useState<CustomersDoorKey | null>(initial);
  const showing: CustomersListKey = on ?? 'all';
  // 📌 Folds into one slim line once the page runs under it (owner 2026-10-29, the shared `usePinFold`).
  const pinRef = useRef<HTMLDivElement>(null);
  usePinFold(pinRef);

  const door = (d: CustomersDoor) => {
    const pressed = on === d.key;
    return (
      <button
        key={d.key}
        type="button"
        className={`sn-press grid min-h-11 min-w-0 max-w-[6.5rem] flex-1 content-center gap-0.5 rounded-full px-0.5 py-1 text-center transition-colors duration-200 motion-reduce:transition-none ${
          pressed ? 'bg-sn-accent' : ''
        }`}
        onClick={() => setOn(pressed ? null : d.key)}
        aria-pressed={pressed}
        aria-controls={`customers-list-${d.key}`}
        data-customers-door={d.key}
        data-pin-door=""
      >
        {d.value === null ? (
          <>
            <span
              className="block text-[20px] font-semibold leading-none"
              style={{ color: pressed ? 'rgb(var(--sn-on-accent))' : 'rgb(var(--color-warn))' }}
              aria-hidden
              data-pin-n=""
            >
              —
            </span>
            <span className={`block truncate text-[11.5px] ${pressed ? 'text-[rgb(var(--sn-on-accent))]' : 'text-ink/60'}`} data-customers-unread="" data-pin-w="">
              couldn&rsquo;t load
            </span>
          </>
        ) : (
          <>
            <span
              className={`block text-[20px] font-semibold leading-none tabular-nums ${
                pressed ? 'text-[rgb(var(--sn-on-accent))]' : d.hot ? 'text-sn-accent' : 'text-ink'
              }`}
              data-pin-n=""
            >
              {d.value}
            </span>
            <span className={`block truncate text-[11.5px] ${pressed ? 'text-[rgb(var(--sn-on-accent))]' : 'text-ink/60'}`} data-pin-w="">
              {d.word}
            </span>
          </>
        )}
      </button>
    );
  };

  const lists = panels
    ? (['all', 'asking', 'booked', 'done'] as const).map((key) => (
        <div key={key} id={`customers-list-${key}`} data-customers-list-for={key} hidden={showing !== key}>
          {panels[key]}
        </div>
      ))
    : null;

  return (
    <>
      <div
        ref={pinRef}
        className="sticky top-0 z-[5] -mx-4 mb-3 border-b border-ink/10 px-4 py-1.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        style={{ background: 'var(--sn-canvas)' }}
        data-customers-pin={seg}
        data-pin-fold=""
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
                if (k !== seg) router.push(hrefs[k as CustomersSegment], { scroll: false });
              }}
            />
          </span>
          {doors ? (
            // Doors cap at 6.5rem: on a tablet or a computer the row keeps the phone's proportions instead of
            // stretching three pills across the page; the space gathers before the ⚙.
            <span className="flex min-w-0 flex-1 items-center gap-0.5" data-customers-doors="" data-tour="customers-filter">
              {doors.map(door)}
            </span>
          ) : figures ? (
            figures
          ) : (
            <span className="flex-1" aria-hidden />
          )}
          {gear}
        </div>
      </div>
      {columns ? (
        <SupplierOpenScope name={`customers-${seg}`} paneLabel="The opened event" rest={columns.rest} watch={showing}>
          {between}
          {lists}
          {after}
        </SupplierOpenScope>
      ) : (
        <>
          {between}
          {lists}
          {after}
        </>
      )}
    </>
  );
}
