'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarGrid, CalendarLegend } from '@/app/_components/calendar';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { CALENDAR_HATCH, CALENDAR_PART_STYLE, monthTitle, stepMonth, type CalendarDay, type CalendarDayState, type CalendarMonth } from '@/lib/calendar-grid';
import type { SchedulePool, VendorCalendarDayState } from '@/lib/vendor-schedule';
import type { WaitlistDateGroup } from '@/lib/vendor-waitlist';
import { buildCustomerCalendarMonth, type CustomerCalendarMonth } from '@/lib/vendor-customers';
import { dayLongWords, dayRowsOf, daySheetHref, dayStateOf, nearWord, type DatesBlock, type DatesBooking, type DayRow } from '@/lib/vendor-dates';
import { fetchCustomerCalendarMonth } from '../actions';
import { DatesRow } from './dates-row';
import { DayBar } from './day-bar';
import { DATES_FIGURES_EVENT, DATES_JUMP_EVENT } from './customers-figures';
import { datesDayIs, datesFiguresOf, type DatesFigureKey } from '../dates-figures';

/**
 * CUSTOMERS › DATES — the month (S-PR3; plan § 2 "one month grid (booked · holding · blocked), the day's rows under
 * it"; prototype frame 04; control templates round 2, kind 31).
 *
 * THE SHARED MONTH GRID (`app/_components/calendar.tsx`, kind 8 extended to kind 31) — the picked day is the one
 * terracotta circle; a green dot says something is booked, an amber dot that couples are waiting on the day, a
 * hatched square that nothing new can be booked; a full day is bold. The legend says every mark in words. Under the
 * month: the picked day's eyebrow ("Sat 3 · Tomorrow") with the ONE dropdown of calendars (plan § 2: "One dropdown
 * for 'All calendars'"), then that day's rows — each opens the day (`?seg=dates&day=`, frame 35).
 *
 * 🔑 ONE SOURCE FOR THE DAY'S TRUTH. Every mark is `buildCustomerCalendarMonth` (`lib/vendor-customers.ts`, the same
 * derivation the shop's other date surfaces read) folded by `dayStateOf` (`lib/vendor-dates.ts`). Nothing here
 * counts a booking.
 *
 * 2026-10-14 (owner ✅ "APPROVE" the simpler dashboard; prototype `supplier_easy_dashboard_2026-10-14_fable.html`
 * `datesBody` + `monthGrid`): the ONE dropdown is "All schedules ▾" and sits ABOVE the month (a shop with one schedule
 * reads "One schedule · N events a day" instead); the month's title is itself a dropdown between ‹ and ›; the legend
 * says Booked here · Outside (its own grey dot) · Asking · Not available · Full; a part-day block hatches the top half;
 * under the month, the picked day's long date with "Open the day ›", then its rows.
 *
 * 📌 v13 (APPROVED 2026-10-29, prototype `custDates()`; DECISION_LOG "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS
 * COMPRESS INTO ONE PINNED ROW ON SCROLL" — *"after the Dates ruling: month → one pinned week row with ‹ › a day"*):
 *   · THE FIGURES — booked · asking · days off for the month on show sit on Customers' pinned row
 *     (`customers-figures.tsx`); the month counts them (`dates-figures.ts`) and says so on every ‹ ›, and a tap on one
 *     picks the first day of its kind here.
 *   · THE WEEK STRIP — once the month has scrolled up under the pinned row, the picked day's week (Sun–Sat) pins under
 *     it as ONE row, ‹ › stepping a day at a time (across a month's edge too). Scrolling back up, the month is there.
 *     Everything under the month (`after`: the Dates folds) sits inside this block so the strip stays pinned over it.
 *
 * Month nav is client-driven (kept from the shipped calendar): the month-independent inputs (pools · bookings ·
 * blocks) ship once; a new month fetches only its day states + waiting list (`fetchCustomerCalendarMonth`), cached
 * per month. Without a fetcher (the dev lab), another month draws from the inputs it has.
 */

/** Raw, filter-agnostic month inputs cached per month for instant re-derive. */
type MonthInputs = { dayStates: VendorCalendarDayState[]; waitlist: WaitlistDateGroup[] };

const ym = (m: CalendarMonth) => `${m.y}-${String(m.m).padStart(2, '0')}`;

export function CustomersCalendar({
  initialDayStates,
  initialWaitlist,
  inquiries = [],
  initialMonth,
  initialDay,
  todayIso,
  pools,
  bookings,
  blocks,
  agents = [],
  agentCategories = {},
  fetchMonth = fetchCustomerCalendarMonth,
  halls = false,
  dayActions = null,
  closuresComplete = true,
  after = null,
  place = 'clients',
}: {
  /**
   * 📅 WHERE THIS MONTH IS DRAWN — one part, two places (controller 2026-11-08: the picked client's Schedule draws "the
   * Clients calendar component, not a second calendar"; v113 `calC`):
   *   · 'clients'  — Clients › Dates: the Schedules dropdown, the pinned row's figures, the URL, the day bar, every day
   *                  still to come when none is picked.
   *   · 'schedule' — the picked client's Schedule page: the same month, week strip and toggle, its event's day picked
   *                  on arrival; no dropdown, no figures, no URL writes (the picked client owns the URL), no day bar;
   *                  the picked day's rows only, and nothing listed when none is picked (the schedule follows).
   */
  place?: 'clients' | 'schedule';
  /** False ⇒ some closures did not load — "days off" says "—", never a short count. */
  closuresComplete?: boolean;
  /** What follows the picked day (the Dates folds) — inside this block, so the week strip stays pinned over it. */
  after?: ReactNode;
  /**
   * The picked day's "You can take bookings" switch (2026-10-28) — the shipped `addManualBlock` / `removeBlock`, in
   * place. Absent → no switch (the dev lab's fixtures without actions).
   */
  dayActions?: { addManualBlock: (fd: FormData) => void | Promise<void>; removeBlock: (fd: FormData) => void | Promise<void> } | null;
  /** Every schedule is a venue's hall (2026-10-14 🏛) — the dropdown says "All halls" and each hall by its name. */
  halls?: boolean;
  /** The first-painted month's raw day states + waiting list (server-fetched). */
  initialDayStates: VendorCalendarDayState[];
  initialWaitlist: WaitlistDateGroup[];
  /** Dates couples are asking about, counted (`pendingInquiryDates`). */
  inquiries?: { requestedDate: string; count: number }[];
  /** 'YYYY-MM' of the first-painted month. */
  initialMonth: string;
  /** The day picked on arrival. */
  initialDay: CalendarDay;
  /** PH civil "today" (YYYY-MM-DD). */
  todayIso: string;
  pools: SchedulePool[];
  /** Trimmed to what the month and the day's rows read. */
  bookings: DatesBooking[];
  /** Trimmed: a closure's own label and an outside client's name — never their contact or note. */
  blocks: DatesBlock[];
  /** Team members (Pro+): picking one narrows to the schedules of the services they are assigned. */
  agents?: { value: string; label: string }[];
  agentCategories?: Record<string, string[]>;
  /** The month fetcher — the shipped server action; null draws other months from what is already here. */
  fetchMonth?: ((month: string) => Promise<MonthInputs | null>) | null;
}) {
  const [month, setMonth] = useState(initialMonth);
  /*
    🔘 A PICKED DAY CAN BE LET GO (v113, B1 step 1): tapping the picked day again — on the month or the week strip —
    clears it, and the rows under the month become EVERY day still to come in it, each under its own pinned heading.
    Null = no day picked.
  */
  const onClients = place === 'clients';
  const [picked, setPicked] = useState<CalendarDay | null>(initialDay);
  const toggleDay = (d: CalendarDay) => setPicked((was) => (was === d ? null : d));
  const [scope, setScope] = useState('all');
  const [pending, startTransition] = useTransition();
  const [monthInputs, setMonthInputs] = useState<Map<string, MonthInputs>>(
    () => new Map([[initialMonth, { dayStates: initialDayStates, waitlist: initialWaitlist }]]),
  );

  /* The ONE dropdown: every calendar, one of them, or (Pro+) one person's calendars. */
  const shownPools = useMemo(() => {
    if (scope.startsWith('pool:')) return pools.filter((p) => p.poolId === scope.slice(5));
    if (scope.startsWith('agent:')) {
      const cats = agentCategories[scope.slice(6)] ?? [];
      return pools.filter((p) => p.categories.some((c) => cats.includes(c)));
    }
    return pools;
  }, [pools, scope, agentCategories]);
  const shownIds = useMemo(() => new Set(shownPools.map((p) => p.poolId)), [shownPools]);
  const poolLabel = useCallback(
    (id: string | null) => (id === null ? 'Every schedule' : (pools.find((p) => p.poolId === id)?.label ?? 'A schedule')),
    [pools],
  );

  const data = useMemo<CustomerCalendarMonth>(() => {
    const inputs = monthInputs.get(month);
    return buildCustomerCalendarMonth(
      shownPools,
      bookings,
      blocks,
      inputs?.dayStates ?? [],
      inputs?.waitlist ?? [],
      month,
      todayIso,
      inquiries,
    );
  }, [month, monthInputs, shownPools, bookings, blocks, todayIso, inquiries]);

  const states = useMemo(() => {
    const out = new Map<CalendarDay, CalendarDayState>();
    for (const d of data.days) {
      const st = dayStateOf(d);
      if (st) out.set(d.date, st);
    }
    return out;
  }, [data.days]);

  const goToMonth = useCallback(
    (m: CalendarMonth, day?: CalendarDay) => {
      const next = ym(m);
      const syncUrl = () => window.history.replaceState(null, '', `${window.location.pathname}?seg=dates&m=${next}#calendar`);
      setMonth(next);
      // The picked day moves with the month (today when it is on show, else the 1st) — its rows are always this month's.
      // A step of the week strip names the day itself (the 31st's next day is the 1st of the next month).
      // With no day picked, the month changes and still no day is picked (every day of the new month is listed).
      setPicked((was) => day ?? (was === null ? null : todayIso.startsWith(next) ? todayIso : `${next}-01`));
      if (onClients) syncUrl();
      if (monthInputs.has(next) || !fetchMonth) return;
      startTransition(async () => {
        const res = await fetchMonth(next);
        if (!res) return; // the month draws from what is here; a reload reads it whole
        setMonthInputs((prev) => new Map(prev).set(next, { dayStates: res.dayStates, waitlist: res.waitlist }));
      });
    },
    [monthInputs, fetchMonth, todayIso, onClients],
  );

  /* 📌 THE FIGURES — counted here, for the month on show, and handed to the pinned row; a tap there picks a day here. */
  const figures = useMemo(() => datesFiguresOf(data.days, closuresComplete), [data.days, closuresComplete]);
  useEffect(() => {
    // The Schedule page's month never speaks for Clients' pinned row (the list is still mounted under it).
    if (onClients) window.dispatchEvent(new CustomEvent(DATES_FIGURES_EVENT, { detail: figures }));
  }, [figures, onClients]);
  useEffect(() => {
    if (!onClients) return;
    const onJump = (e: Event) => {
      const key = (e as CustomEvent<DatesFigureKey>).detail;
      const first = data.days.find((d) => datesDayIs(key, d));
      if (first) setPicked(first.date);
    };
    window.addEventListener(DATES_JUMP_EVENT, onJump);
    return () => window.removeEventListener(DATES_JUMP_EVENT, onJump);
  }, [data.days, onClients]);

  /* 📌 THE WEEK STRIP — shown once the month is up under the pinned row; it pins right under that row. */
  const monthRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState(false);
  /** The pinned row's height — the week strip pins under it, and the day headings under both. */
  const [pinH, setPinH] = useState(0);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const grid = monthRef.current;
      const strip = stripRef.current;
      if (!grid || !strip) return;
      // Clients: under the Customers pinned row. Schedule: the picked client's pinned row sits OUTSIDE its scroller, so
      // the strip pins at the scroller's own top.
      const pin = onClients ? document.querySelector<HTMLElement>('[data-customers-pin]') : null;
      const box = onClients ? null : grid.closest<HTMLElement>('[data-picked-body]');
      const under = pin ? pin.getBoundingClientRect().bottom : box ? box.getBoundingClientRect().top : 0;
      strip.style.top = `${pin ? pin.offsetHeight : 0}px`;
      setPinH(pin ? pin.offsetHeight : 0);
      // Hysteresis: fold once the month's last week is under the row, unfold as soon as a week of it shows again.
      const bottom = grid.getBoundingClientRect().bottom;
      setFolded((was) => (was ? bottom < under + 48 : bottom < under));
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    document.addEventListener('scroll', soon, { passive: true, capture: true });
    window.addEventListener('resize', soon);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
    };
  }, [onClients]);
  // The week the strip draws: the picked day's, or — none picked — today's when it is in this month, else the 1st's.
  const anchor: CalendarDay = picked ?? (todayIso.startsWith(month) ? todayIso : `${month}-01`);
  const stepDay = (by: number) => {
    const at = new Date(`${anchor}T00:00:00Z`);
    at.setUTCDate(at.getUTCDate() + by);
    const next = at.toISOString().slice(0, 10);
    if (next.slice(0, 7) === month) setPicked(next);
    else goToMonth({ y: Number(next.slice(0, 4)), m: Number(next.slice(5, 7)) }, next);
  };
  const week = useMemo(() => {
    const at = new Date(`${anchor}T00:00:00Z`);
    const sunday = new Date(at);
    sunday.setUTCDate(at.getUTCDate() - at.getUTCDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setUTCDate(sunday.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [anchor]);

  const holds = (monthInputs.get(month)?.dayStates ?? []).map((s) => ({
    poolId: s.poolId,
    stateDate: s.stateDate,
    dayState: s.dayState,
  }));
  const rowsOf = (day: CalendarDay) => {
    const at = data.days.find((d) => d.date === day) ?? null;
    return dayRowsOf(day, {
      today: todayIso,
      poolIds: shownIds,
      poolLabel,
      namePools: pools.length > 1,
      bookings,
      blocks,
      holds,
      asking: at?.inquiryCount ?? 0,
      waiting: at?.waitlistCount ?? 0,
    });
  };
  /* No day picked: every day of the month still to come that has something on it, in order (v113 `listAll`). */
  const allDays = picked || !onClients
    ? []
    : data.days
        .filter((d) => d.date >= todayIso)
        .map((d) => ({ day: d.date, rows: rowsOf(d.date).filter((r) => r.kind !== 'nothing') }))
        .filter((g) => g.rows.length > 0);
  const drawRow = (r: DayRow, day: CalendarDay) => (
    <DatesRow
      key={r.key}
      data={r.kind}
      title={r.title}
      line={r.line || undefined}
      badge={r.hours ? { tone: 'quiet', word: r.hours } : r.badge}
      href={onClients ? daySheetHref(day) : undefined}
      lead={
        r.kind === 'blocked' || r.kind === 'held' ? (
          <i aria-hidden className="block h-4 w-5 shrink-0 rounded-sm" style={r.hours ? CALENDAR_PART_STYLE : { backgroundImage: CALENDAR_HATCH }} />
        ) : undefined
      }
    />
  );
  // 📌 A day heading pins under the pinned row, and under the week strip once it shows.
  const headTop = pinH + (folded ? 54 : 0);

  const options = [
    { key: 'all', label: halls ? 'All halls' : 'All schedules' },
    ...pools.map((p) => ({ key: `pool:${p.poolId}`, label: halls ? p.label : `${p.label} schedule` })),
    ...agents.map((a) => ({ key: `agent:${a.value}`, label: `${a.label}’s work` })),
  ];
  // The month dropdown: last month to a year ahead (prototype: the month as a dropdown with ‹ ›).
  const base = { y: Number(todayIso.slice(0, 4)), m: Number(todayIso.slice(5, 7)) };
  const monthsOffered = Array.from({ length: 14 }, (_, i) => stepMonth(base, i - 1));
  const near = picked ? nearWord(todayIso, picked) : '';

  return (
    <div data-dates-month={place} aria-busy={pending}>
      {/* "All schedules ▾" — the ONE dropdown, above the month (prototype datesBody). One schedule: its one line. */}
      {!onClients ? null : options.length > 2 ? (
        <div className="mb-2 mt-1 flex min-h-11 items-center" data-dates-eyebrow="">
          <PickMenu label="Schedules" value={scope} options={options} onPick={setScope} dataAttr="data-dates-scope" className="!min-h-11" />
        </div>
      ) : pools.length === 1 ? (
        <p className="mb-2 mt-1 text-[14px] font-medium text-ink" data-dates-one-schedule="">
          {halls ? 'One hall' : 'One schedule'} · {pools[0]!.capacity} {pools[0]!.capacity === 1 ? 'event' : 'events'} a day
        </p>
      ) : null}
      {/* 🔦 The Dates tour's first stop — the month itself (lib/tours.ts vendor_dates_v1). */}
      <div ref={monthRef} style={{ opacity: pending ? 0.6 : 1 }} className="transition-opacity" data-tour="dates-calendar">
        {/* Keyed by the month on show: the grid keeps its own month, so a step of the week strip across a month's edge
            (or the Schedule page's ‹ ›) must land it on the same month as the rows — not leave it on the old one. */}
        <CalendarGrid
          key={month}
          value={picked}
          today={todayIso}
          startAt={`${month}-01`}
          states={states}
          onPick={toggleDay}
          onMonth={goToMonth}
          monthPicker={(view, go) => (
            <PickMenu
              label="Month"
              value={ym(view)}
              options={[
                ...(monthsOffered.some((m) => ym(m) === ym(view)) ? [] : [{ key: ym(view), label: monthTitle(view) }]),
                ...monthsOffered.map((m) => ({ key: ym(m), label: monthTitle(m) })),
              ]}
              onPick={(k) => go({ y: Number(k.slice(0, 4)), m: Number(k.slice(5, 7)) })}
              dataAttr="data-dates-month-pick"
              className="!min-h-11"
            />
          )}
          data="dates"
        />
      </div>
      {/* The Schedule month has no "asking" marks (its one read skips the shop's threads) — its legend says only what it draws. */}
      <CalendarLegend dots={onClients ? ['booked', 'outside', 'asking'] : ['booked', 'outside']} blocked full />

      {/* 📌 THE WEEK STRIP (v13 `.weekstrip`): the picked day's week, ‹ › a day. Drawn always, shown only once folded —
          height and opacity glide, so the page under it never jumps; hidden from the tab order while folded away. */}
      <div
        ref={stripRef}
        className={`sticky z-[4] -mx-4 flex items-center gap-1 overflow-hidden border-ink/10 px-2 transition-[height,opacity] duration-300 motion-reduce:transition-none sm:-mx-6 sm:px-4 lg:-mx-8 lg:px-6 ${
          folded ? 'h-[54px] border-b opacity-100' : 'pointer-events-none h-0 opacity-0'
        }`}
        style={{ background: 'var(--sn-canvas)' }}
        aria-hidden={!folded}
        inert={!folded}
        data-dates-week-strip={folded ? 'shown' : 'folded-away'}
      >
        <button type="button" className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink" aria-label="A day earlier" onClick={() => stepDay(-1)} data-dates-step="-1">
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
        {week.map((d) => {
          const inMonth = d.slice(0, 7) === month;
          const st = inMonth ? states.get(d) : undefined;
          const on = d === picked;
          const dot = st?.dots?.includes('asking') ? 'rgb(var(--color-warn))' : st?.dots?.length ? 'rgb(var(--color-ok))' : null;
          return (
            <button
              key={d}
              type="button"
              className={`sn-press relative grid h-11 min-w-0 flex-1 content-center justify-items-center rounded-full text-[13.5px] leading-tight tabular-nums ${on ? 'bg-sn-accent text-[rgb(var(--sn-on-accent))]' : 'text-ink'}`}
              style={!on && st?.blocked ? { backgroundImage: CALENDAR_HATCH } : undefined}
              aria-pressed={on}
              aria-label={dayLongWords(d)}
              onClick={() => (inMonth ? toggleDay(d) : goToMonth({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) }, d))}
              data-dates-week-day={d}
            >
              <small className={`text-[9.5px] leading-none ${on ? '' : 'text-ink/55'}`}>{'SMTWTFS'[new Date(`${d}T00:00:00Z`).getUTCDay()]}</small>
              <span className={st?.full ? 'font-bold' : undefined}>{Number(d.slice(8))}</span>
              {dot && !on ? <i aria-hidden className="absolute bottom-0.5 block h-1 w-1 rounded-full" style={{ background: dot }} /> : null}
            </button>
          );
        })}
        <button type="button" className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink" aria-label="A day later" onClick={() => stepDay(1)} data-dates-step="1">
          <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {picked ? (
        <>
          {/* The picked day: its long date and "Open the day ›", then what is on it (prototype datesBody). */}
          <div className="mt-4 flex min-h-11 items-center gap-3" data-dates-picked-head="">
            <span className="home-k2 min-w-0 flex-1 truncate" data-dates-picked={picked}>
              {dayLongWords(picked).replace(/, \d{4}$/, '')}
              {near === 'Today' ? ' · today' : ''}
            </span>
            {onClients ? (
              <Link href={daySheetHref(picked)} scroll className="sn-press inline-flex min-h-11 flex-none items-center gap-1 text-[14px] font-semibold text-sn-accent" data-dates-open-day="">
                Open the day
                <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </Link>
            ) : null}
          </div>
          {/* 📅 THE DAY BAR (v113 `.dayact`): Accept bookings + Book a client, for the picked day. */}
          {dayActions && onClients ? <DayBar day={picked} today={todayIso} blocks={blocks} actions={dayActions} /> : null}
          <div data-dates-rows="">{rowsOf(picked).map((r) => drawRow(r, picked))}</div>
        </>
      ) : !onClients ? null : (
        <div className="mt-4" data-dates-all-days="">
          {allDays.length === 0 ? (
            <p className="py-3 text-[14px] text-ink/70" data-dates-all-empty="">
              Nothing booked, asked or closed for the rest of {monthTitle({ y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) })}.
            </p>
          ) : (
            allDays.map((g) => (
              <section key={g.day} data-dates-day-group={g.day}>
                {/* 📌 STICKY DAY HEADING (v113): the day's name stays at the top while its rows scroll under it. */}
                <h3
                  className="home-k2 sticky z-[3] -mx-4 flex min-h-10 items-center px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
                  style={{ top: headTop, background: 'var(--sn-canvas)' }}
                  data-dates-day-heading={g.day}
                >
                  <button type="button" className="sn-press min-h-10 text-left" onClick={() => setPicked(g.day)} data-dates-heading-pick={g.day}>
                    {dayLongWords(g.day).replace(/, \d{4}$/, '')}
                    {nearWord(todayIso, g.day) === 'Today' ? ' · today' : ''}
                  </button>
                </h3>
                {g.rows.map((r) => drawRow(r, g.day))}
              </section>
            ))
          )}
        </div>
      )}
      {after}
    </div>
  );
}
