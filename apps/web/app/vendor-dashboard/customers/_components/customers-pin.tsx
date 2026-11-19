'use client';

import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { usePinFold } from '@/app/_components/pinned-row/use-pin-fold';
import { CUSTOMER_SEGMENTS, CUSTOMER_SEGMENT_LABEL, type CustomersSegment } from '../segments';
import { CLIENTS_SHOWING_EVENT, CLIENTS_SHOW_EVENT } from '../clients-show-sort';
import { SupplierOpenScope } from '../../_components/supplier-open-row';
import { usePinTools } from '../../_components/supplier-thumb-row';
import { PinDoor, PinDoors } from '@/app/_components/pinned-row/pin-door';
import { CLIENTS_LET_GO_DAY_EVENT, CustomersCalendar } from './customers-calendar';

// The door keys live in the neutral `segments.ts`: a `'use client'` module hands a server page a REFERENCE, never the
// array itself (measured: `CUSTOMERS_DOORS.map is not a function` on the first render).
export type { CustomersDoorKey, CustomersListKey } from '../segments';

export type CustomersDoor = {
  /** The list it shows (`panels[key]`). */
  key: string;
  /** Already worded ("3", "12+"), or null = the roster could not be read — "couldn't load", never 0. */
  value: string | null;
  word: string;
  /** The brand colour — the count that waits on the shop. */
  hot?: boolean;
  /**
   * The one screen's tile dot (v113 `.tot .k`) — the SAME colour the month marks that kind of day with, so the tiles
   * read as the month's key. Only kinds the month really marks get one (booked · asked); a dot for a mark the month never
   * draws would be a key to nothing.
   */
  dot?: 'booked' | 'asking';
};

/**
 * v113 `.odue` / `.odue.ur`: the quick pills' tint from the app's own tokens — Overdue in the danger colour (money that
 * is late), Unread in the accent. (v113's purple has no token here; the app's tokens win — owner 4 Nov.)
 */
const QUICK_TINT: Record<'overdue' | 'unread', { color: string; background: string; borderColor: string }> = {
  overdue: {
    color: 'rgb(var(--color-danger))',
    background: 'color-mix(in srgb, rgb(var(--color-danger)) 9%, transparent)',
    borderColor: 'color-mix(in srgb, rgb(var(--color-danger)) 35%, transparent)',
  },
  unread: {
    color: 'rgb(var(--sn-accent))',
    background: 'color-mix(in srgb, rgb(var(--sn-accent)) 9%, transparent)',
    borderColor: 'color-mix(in srgb, rgb(var(--sn-accent)) 40%, transparent)',
  },
};

/** The month's own mark colours (`customers-calendar.tsx` week strip, the shared `CalendarGrid`). */
const TILE_DOT: Record<NonNullable<CustomersDoor['dot']>, string> = {
  booked: 'rgb(var(--color-ok))',
  asking: 'rgb(var(--color-warn))',
};

/**
 * ⏩ OVERDUE (n) › · UNREAD (n) › (v113 `.qrow`, 2026-11-08) — two buttons under the row, each showing ITS list in place
 * ("Viewing all overdue · 3 ×"); the × (or pressing it again) goes back to every event. Not drawn at 0 — there is nothing
 * to view; a count the page could not read says so and opens nothing.
 */
export type CustomersQuick = {
  key: string;
  /** Already worded, or null = not read — "couldn't load", never 0. */
  value: string | null;
  /** "Overdue" · "Unread". */
  word: string;
  /** Hidden when the count is a real 0. */
  zero: boolean;
};

/**
 * 📌 CUSTOMERS' PINNED ROW — `Customers · Events ▾ · Asking · Booked · Done · ⚙` (the ONE SELECTOR, owner 2026-10-30
 * "all yes": the page word rides the ▾ on the phone too, and the counts are the one shared door, `PinDoor`) (People ▾ until 2026-10-30 — owner
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
  quick = null,
  title = null,
  month = null,
}: {
  /**
   * 📌 THE ONE CLIENTS SCREEN'S ROW: "Clients · ⚙", no ▾ (there is one view now). Null = the shipped selector row (Money
   * keeps it). The figures that rode it ("6 booked · ₱48,000 to collect", v113 #43b) LEFT it on 19 Nov (owner "Yes, all
   * three", DECISION_LOG "SUPPLIER CLIENTS, CLEANER"): the tiles right under it say the same two numbers.
   */
  title?: Record<string, never> | null;
  /**
   * 📅 THE MONTH ON TOP (Build 2 row #43a/#43c, v113): Clients is ONE screen — the month, then the tiles as their own row,
   * then Overdue / Unread, then the day-headed list. The month is the shipped `CustomersCalendar` (one part, never a
   * second grid); the tiles and quick buttons ride its `between`, the lists its `after`, so its week strip stays pinned
   * over the list. While a day is picked the month draws that day (its head, the day bar, its rows) and the whole list
   * waits hidden (v118: the list shows the picked day).
   */
  month?: Omit<ComponentProps<typeof CustomersCalendar>, 'between' | 'after' | 'oneScreen' | 'onPicked'> | null;
  /** Overdue (n) › · Unread (n) › — under the row (v113). */
  quick?: readonly CustomersQuick[] | null;
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
  /** Events' tiles (v113: Booked · Schedules · Asked · To collect); null on Dates and Money. */
  doors?: readonly CustomersDoor[] | null;
  /** Every event (`all`) and each door's / quick button's / Show filter's list, drawn by the server. */
  panels?: Readonly<Record<string, ReactNode>> | null;
  /** The list an address names; null (the default) = no count pressed — every event (approved v13). */
  initial?: string | null;
  /** Customers ⚙ (`CustomersSettings`) — the row's right end. */
  gear: ReactNode;
}) {
  const router = useRouter();
  // 🔑 Null = no count pressed: EVERY event is listed (controller call 2026-10-30, the approved v13). A count filters in
  // place; pressing it again shows them all — opening on Asking alone made a supplier's booked events look gone.
  const [on, setOn] = useState<string | null>(initial);
  const showing: string = on ?? 'all';
  // ⇅ Show & sort's Show picks a list here, in place; the sheet is told what is shown (a door pressed changes it too).
  useEffect(() => {
    if (!panels) return;
    const pick = (e: Event) => {
      const k = (e as CustomEvent<string | null>).detail;
      setOn(k && k in panels ? k : null);
    };
    window.addEventListener(CLIENTS_SHOW_EVENT, pick);
    return () => window.removeEventListener(CLIENTS_SHOW_EVENT, pick);
  }, [panels]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CLIENTS_SHOWING_EVENT, { detail: on }));
  }, [on]);
  // 📌 Folds into one slim line once the page runs under it (owner 2026-10-29, the shared `usePinFold`).
  const pinRef = useRef<HTMLDivElement>(null);
  usePinFold(pinRef);
  // The one screen: the month's picked day (null = none — the whole list shows).
  const [dayPicked, setDayPicked] = useState<string | null>(month?.initialDay ?? null);
  const onPicked = useCallback((d: string | null) => setDayPicked(d), []);
  /** A tile or quick button shows a whole list — a picked day is let go first (v118: the day's list is the day's). */
  const show = (k: string | null) => {
    if (dayPicked) window.dispatchEvent(new Event(CLIENTS_LET_GO_DAY_EVENT));
    setOn(k);
  };

  // 📌 THE ONE COUNT DOOR (owner 2026-10-30 "all yes", Q3 — `PinDoor`): number + word, filtering = the number
  // underlined. Was a two-line round tile, pressed = the accent fill.
  const door = (d: CustomersDoor) => {
    const pressed = on === d.key;
    return (
      <PinDoor
        key={d.key}
        value={d.value}
        word={d.word}
        hot={d.hot}
        on={pressed}
        onTap={() => setOn(pressed ? null : d.key)}
        controls={`customers-list-${d.key}`}
        mark={{ 'data-customers-door': d.key }}
        unreadMark="data-customers-unread"
      />
    );
  };

  const lists = panels
    ? ['all', ...Object.keys(panels).filter((k) => k !== 'all')].map((key) => (
        <div key={key} id={`customers-list-${key}`} data-customers-list-for={key} hidden={showing !== key}>
          {panels[key]}
        </div>
      ))
    : null;

  // ⏩ The quick buttons — or, while one is viewed, its "Viewing all … ×" head (v113 `.vhd`).
  const viewing = quick?.find((q) => q.key === on) ?? null;
  const quickRow = quick ? (
    viewing ? (
      <div className="mb-2 flex min-h-11 items-center gap-2" data-customers-viewing={viewing.key}>
        <span className="home-k2 min-w-0 flex-1 truncate">
          Viewing all {viewing.word.toLowerCase()} · {viewing.value ?? 'couldn’t load'}
        </span>
        <button
          type="button"
          className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/70"
          aria-label={`Close ${viewing.word.toLowerCase()}`}
          onClick={() => setOn(null)}
          data-customers-viewing-close=""
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    ) : quick.some((q) => !q.zero) ? (
      <div className="mb-2 grid auto-cols-fr grid-flow-col gap-2" data-customers-quick-row="">
        {quick
          .filter((q) => !q.zero)
          .map((q) => (
            <button
              key={q.key}
              type="button"
              // v113 `.odue` (Build 2 #43, the one screen): a round pill tinted by what it is — Overdue in the money
              // colour, Unread in the brand — the count in a filled bubble. The shipped neutral pill elsewhere.
              className={`sn-press min-h-11 truncate rounded-full border px-3 text-[13px] font-bold disabled:opacity-60 ${
                title ? '' : 'border-ink/15 font-semibold text-ink'
              }`}
              style={title ? QUICK_TINT[q.key === 'overdue' ? 'overdue' : 'unread'] : undefined}
              aria-pressed={false}
              aria-controls={`customers-list-${q.key}`}
              disabled={q.value === null}
              onClick={() => show(q.key)}
              data-customers-quick={q.key}
            >
              {title && q.value !== null ? (
                <>
                  {q.word}
                  <span
                    className="mx-1 inline-block min-w-5 rounded-full px-1.5 py-px align-[1px] text-[13px] font-extrabold leading-tight"
                    style={{ background: 'currentColor' }}
                  >
                    <span style={{ color: 'rgb(var(--sn-on-accent))' }}>{q.value}</span>
                  </span>
                  ›
                </>
              ) : (
                <>
                  {q.word} {q.value ?? 'couldn’t load'} ›
                </>
              )}
            </button>
          ))}
      </div>
    ) : null
  ) : null;

  /*
    🧮 THE TILES, THEIR OWN ROW (Build 2 row #43c, v113 `.tot.t4`): Booked · Schedules · Asked · To collect under the month,
    never on the pinned row (there "To collect" was cut at 375). A dot + the word over the figure; pressed = the ink fill
    (v113 `.on`); a press shows that list in place, pressing it again goes back to every client. No frame at rest — the
    fill says pressed (frames only on what you press, and the pressed one is filled).
  */
  /*
    🧹 ONE ROW, FIVE TILES (owner "Yes, all three", 19 Nov — DECISION_LOG "SUPPLIER CLIENTS, CLEANER", Q3): Booked · Asked ·
    To collect, then Overdue and Unread in their own tints — they were a row of pills of their own under the tiles. The
    meetings tile left the row (its list is Show & sort › Show › Schedules, `CLIENTS_SHOW`). A press shows that list in
    place, pressing it again goes back to every client — the doors and the quick ones alike. Overdue / Unread are still
    not drawn at a real 0, and a count the page could not read says so (a dash, its name says "couldn't load").
  */
  const tile = (t: { key: string; word: string; value: string | null; hot?: boolean; dot?: CustomersDoor['dot']; tint?: 'overdue' | 'unread'; quick?: boolean }) => {
    const pressed = on === t.key;
    const tint = t.tint && !pressed ? QUICK_TINT[t.tint] : undefined;
    return (
      <button
        key={t.key}
        type="button"
        className={`sn-press min-h-11 min-w-0 flex-[0_1_auto] rounded-xl px-1.5 py-1 text-center transition-colors duration-sn-micro disabled:opacity-60 motion-reduce:transition-none ${
          pressed ? 'bg-ink text-cream' : 'text-ink'
        }`}
        style={tint ? { color: tint.color, background: tint.background } : undefined}
        aria-pressed={pressed}
        aria-controls={`customers-list-${t.key}`}
        aria-label={t.value === null ? `${t.word} couldn’t load` : undefined}
        disabled={t.quick && t.value === null}
        onClick={() => show(pressed ? null : t.key)}
        data-customers-door={t.quick ? undefined : t.key}
        data-customers-quick={t.quick ? t.key : undefined}
      >
        <span className={`block whitespace-nowrap text-[12.5px] ${pressed || tint ? '' : 'text-[color:var(--m-slate-2)]'}`}>
          {t.dot ? (
            <i aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-[1px]" style={{ background: TILE_DOT[t.dot] }} />
          ) : null}
          {t.word.charAt(0).toUpperCase() + t.word.slice(1)}
        </span>
        <b
          className={`block whitespace-nowrap text-[15px] font-bold tabular-nums ${t.hot && !pressed ? 'text-sn-accent' : ''}`}
          data-customers-unread={t.hot ? '' : undefined}
        >
          {t.value ?? '—'}
        </b>
      </button>
    );
  };
  const tilesRow =
    title && doors ? (
      <div className="-mx-1 mb-1 flex justify-between gap-0.5" role="group" aria-label="Show" data-customers-tiles="">
        {doors.map((d) => tile(d))}
        {(quick ?? [])
          .filter((q) => !q.zero)
          .map((q) => tile({ key: q.key, word: q.word, value: q.value, tint: q.key === 'overdue' ? 'overdue' : 'unread', quick: true }))}
      </div>
    ) : null;

  // The lists wait hidden while the month has a day picked (the month draws that day's rows).
  const body = title ? (
    // 🧹 Clients, cleaner (19 Nov): Overdue and Unread are tiles in the ONE row now, so the one screen has no quick row.
    tilesRow
  ) : (
    <>
      {tilesRow}
      {/* The quick row waits hidden while a day is picked on the phone (the month draws that day); a computer keeps it
          under the month in column 2, as drawn (audit 17 Nov, `supplier_clients_clean_2026-11-16`: "the month with the
          tiles, Overdue/Unread and the Events list still under it") — `supplier-frame.css` shows it from 1280. */}
      {quickRow ? (
        <div hidden={Boolean(dayPicked && month)} data-customers-quick-wrap="">
          {quickRow}
        </div>
      ) : null}
    </>
  );
  const rest = (
    <div hidden={Boolean(dayPicked && month)} data-customers-whole-list="">
      {between}
      {lists}
    </div>
  );
  const content = month ? (
    <>
      {/* `id="calendar"` is where every bare /vendor-dashboard/calendar link lands (`customers/anchors.ts`) — the month. */}
      {/* 🧹 The tiles head the screen, right under "Clients ⚙" and over the week (Clients, cleaner — 19 Nov). */}
      {body}
      <div id="calendar" className="scroll-mt-24">
        <CustomersCalendar {...month} oneScreen onPicked={onPicked} after={rest} />
      </div>
      {after}
    </>
  ) : (
    <>
      {title ? body : quickRow}
      {between}
      {lists}
      {after}
    </>
  );

  if (title) {
    return (
      <>
        {/* 🧹 NO EMPTY TOP (owner 19 Nov, "we do not want unwanted space on top"): the row sits flush under the app bar —
            no padding above or below "Clients", no gap under it. From 701 the app's bar already says "Clients ▾", so this
            row is not drawn there and its ⚙ moves up into the bar beside the thumb row's tools (`GearUp`). */}
        <div
          ref={pinRef}
          className="sticky top-0 z-[5] -mx-4 mb-1 sn-pin-hair px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 tab:hidden"
          style={{ background: 'var(--sn-canvas)' }}
          data-customers-pin={seg}
          data-pin-fold=""
          data-pinned-row=""
          data-first-row=""
          data-tour="customers-segments"
        >
          <div className="flex min-h-11 items-center gap-2.5" role="group" aria-label="Clients">
            <span className="min-w-0 flex-1 text-[18px] font-bold text-ink" data-customers-title="">
              Clients
            </span>
            <GearUp>{gear}</GearUp>
          </div>
        </div>
        {columns ? (
          <SupplierOpenScope name={`customers-${seg}`} paneLabel="The opened event" rest={columns.rest} watch={showing}>
            {content}
          </SupplierOpenScope>
        ) : (
          content
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={pinRef}
        className="sticky top-0 z-[5] -mx-4 mb-3 sn-pin-hair px-4 py-1.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        style={{ background: 'var(--sn-canvas)' }}
        data-customers-pin={seg}
        data-pin-fold=""
        data-pinned-row=""
        data-first-row=""
        data-tour="customers-segments"
      >
        <div className="flex min-h-11 items-center gap-1" role="group" aria-label="Clients">
          <span className="shrink-0" data-customers-view="">
            <PickMenu
              label="Clients — show"
              value={seg}
              buttonText={`Clients · ${CUSTOMER_SEGMENT_LABEL[seg]}`}
              // Dates is no view of its own any more (Build 2 #43a: the month heads the one Clients screen).
              options={CUSTOMER_SEGMENTS.filter((s) => s !== 'dates' || seg === 'dates').map((s) => ({ key: s, label: CUSTOMER_SEGMENT_LABEL[s] }))}
              compact
              dataAttr="data-customers-picker"
              onPick={(k) => {
                if (k !== seg) router.push(hrefs[k as CustomersSegment], { scroll: false });
              }}
            />
          </span>
          {doors ? (
            // The doors keep their own width; the space gathers before the ⚙.
            <>
              <PinDoors mark={{ 'data-customers-doors': '' }} data-tour="customers-filter">{doors.map(door)}</PinDoors>
              <span className="min-w-0 flex-1" aria-hidden />
            </>
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
          {quickRow}
          {between}
          {lists}
          {after}
        </SupplierOpenScope>
      ) : (
        <>
          {quickRow}
          {between}
          {lists}
          {after}
        </>
      )}
    </>
  );
}

/**
 * ⚙ UP INTO THE BAR FROM 701 (Clients, cleaner — owner 19 Nov): the one Clients ⚙, portalled into the app bar's tools box
 * (`[data-pin-tools]`, the same host the thumb row moves into — `usePinTools`) while the window is that wide; inline in
 * the title row on a phone. ONE gear either way — never a second sheet.
 */
function GearUp({ children }: { children: ReactNode }) {
  const box = usePinTools();
  return box ? createPortal(children, box) : <>{children}</>;
}
