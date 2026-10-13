'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { CalendarGrid, CalendarLegend } from '@/app/_components/calendar';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { CALENDAR_HATCH, type CalendarDay, type CalendarDayState, type CalendarMonth } from '@/lib/calendar-grid';
import type { SchedulePool, VendorCalendarDayState } from '@/lib/vendor-schedule';
import type { WaitlistDateGroup } from '@/lib/vendor-waitlist';
import { buildCustomerCalendarMonth, type CustomerCalendarMonth } from '@/lib/vendor-customers';
import { dayEyebrow, dayRowsOf, daySheetHref, dayStateOf, type DatesBlock, type DatesBooking } from '@/lib/vendor-dates';
import { fetchCustomerCalendarMonth } from '../actions';
import { DatesRow } from './dates-row';

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
}: {
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
  /** Team members (Pro+): picking one narrows to the calendars of the services they are assigned. */
  agents?: { value: string; label: string }[];
  agentCategories?: Record<string, string[]>;
  /** The month fetcher — the shipped server action; null draws other months from what is already here. */
  fetchMonth?: ((month: string) => Promise<MonthInputs | null>) | null;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [picked, setPicked] = useState<CalendarDay>(initialDay);
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
    (id: string | null) => (id === null ? 'Every calendar' : (pools.find((p) => p.poolId === id)?.label ?? 'A calendar')),
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
    (m: CalendarMonth) => {
      const next = ym(m);
      const syncUrl = () => window.history.replaceState(null, '', `${window.location.pathname}?seg=dates&m=${next}#calendar`);
      setMonth(next);
      // The picked day moves with the month (today when it is on show, else the 1st) — its rows are always this month's.
      setPicked(todayIso.startsWith(next) ? todayIso : `${next}-01`);
      syncUrl();
      if (monthInputs.has(next) || !fetchMonth) return;
      startTransition(async () => {
        const res = await fetchMonth(next);
        if (!res) return; // the month draws from what is here; a reload reads it whole
        setMonthInputs((prev) => new Map(prev).set(next, { dayStates: res.dayStates, waitlist: res.waitlist }));
      });
    },
    [monthInputs, fetchMonth, todayIso],
  );

  const pickedDay = data.days.find((d) => d.date === picked) ?? null;
  const holds = (monthInputs.get(picked.slice(0, 7))?.dayStates ?? []).map((s) => ({
    poolId: s.poolId,
    stateDate: s.stateDate,
    dayState: s.dayState,
  }));
  const rows = dayRowsOf(picked, {
    today: todayIso,
    poolIds: shownIds,
    poolLabel,
    namePools: pools.length > 1,
    bookings,
    blocks,
    holds,
    asking: pickedDay?.inquiryCount ?? 0,
    waiting: pickedDay?.waitlistCount ?? 0,
  });

  const options = [
    { key: 'all', label: 'All calendars' },
    ...pools.map((p) => ({ key: `pool:${p.poolId}`, label: p.label })),
    ...agents.map((a) => ({ key: `agent:${a.value}`, label: `${a.label}’s work` })),
  ];

  return (
    <div data-dates-month="" aria-busy={pending}>
      <div style={{ opacity: pending ? 0.6 : 1 }} className="transition-opacity">
        <CalendarGrid
          value={picked}
          today={todayIso}
          startAt={`${initialMonth}-01`}
          states={states}
          onPick={(d) => setPicked(d)}
          onMonth={goToMonth}
          data="dates"
        />
      </div>
      <CalendarLegend dots={['booked', 'holding']} blocked />

      {/* "SAT 3 · TOMORROW · All calendars ▾" — the picked day, and the one dropdown that narrows the month (frame 04). */}
      <div className="mt-4 flex min-h-11 items-center gap-3" data-dates-eyebrow="">
        <span className="home-k2" data-dates-picked={picked}>
          {dayEyebrow(todayIso, picked)}
        </span>
        {options.length > 2 ? (
          <PickMenu label="Calendars" value={scope} options={options} onPick={setScope} dataAttr="data-dates-scope" className="!min-h-11" />
        ) : null}
      </div>
      <div data-dates-rows="">
        {rows.map((r) => (
          <DatesRow
            key={r.key}
            data={r.kind}
            title={r.title}
            line={r.line || undefined}
            badge={r.badge}
            href={daySheetHref(picked)}
            lead={r.kind === 'blocked' || r.kind === 'held' ? <i aria-hidden className="block h-4 w-5 shrink-0 rounded-[4px]" style={{ backgroundImage: CALENDAR_HATCH }} /> : undefined}
          />
        ))}
      </div>
    </div>
  );
}
