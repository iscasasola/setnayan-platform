'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CalendarGrid, CalendarLegend } from '@/app/_components/calendar';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { CALENDAR_HATCH, CALENDAR_PART_STYLE, monthTitle, stepMonth, type CalendarDay, type CalendarDayState, type CalendarMonth } from '@/lib/calendar-grid';
import type { SchedulePool, VendorCalendarDayState } from '@/lib/vendor-schedule';
import type { WaitlistDateGroup } from '@/lib/vendor-waitlist';
import { buildCustomerCalendarMonth, type CustomerCalendarMonth } from '@/lib/vendor-customers';
import { dayLongWords, dayRowsOf, daySheetHref, dayStateOf, nearWord, type DatesBlock, type DatesBooking } from '@/lib/vendor-dates';
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
 * 2026-10-14 (owner ✅ "APPROVE" the simpler dashboard; prototype `supplier_easy_dashboard_2026-10-14_fable.html`
 * `datesBody` + `monthGrid`): the ONE dropdown is "All schedules ▾" and sits ABOVE the month (a shop with one schedule
 * reads "One schedule · N events a day" instead); the month's title is itself a dropdown between ‹ and ›; the legend
 * says Booked here · Outside (its own grey dot) · Asking · Not available · Full; a part-day block hatches the top half;
 * under the month, the picked day's long date with "Open the day ›", then its rows.
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
  /** Team members (Pro+): picking one narrows to the schedules of the services they are assigned. */
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
    { key: 'all', label: 'All schedules' },
    ...pools.map((p) => ({ key: `pool:${p.poolId}`, label: `${p.label} schedule` })),
    ...agents.map((a) => ({ key: `agent:${a.value}`, label: `${a.label}’s work` })),
  ];
  // The month dropdown: last month to a year ahead (prototype: the month as a dropdown with ‹ ›).
  const base = { y: Number(todayIso.slice(0, 4)), m: Number(todayIso.slice(5, 7)) };
  const monthsOffered = Array.from({ length: 14 }, (_, i) => stepMonth(base, i - 1));
  const near = nearWord(todayIso, picked);

  return (
    <div data-dates-month="" aria-busy={pending}>
      {/* "All schedules ▾" — the ONE dropdown, above the month (prototype datesBody). One schedule: its one line. */}
      {options.length > 2 ? (
        <div className="mb-2 mt-1 flex min-h-11 items-center" data-dates-eyebrow="">
          <PickMenu label="Schedules" value={scope} options={options} onPick={setScope} dataAttr="data-dates-scope" className="!min-h-11" />
        </div>
      ) : pools.length === 1 ? (
        <p className="mb-2 mt-1 text-[14px] font-medium text-ink" data-dates-one-schedule="">
          One schedule · {pools[0]!.capacity} {pools[0]!.capacity === 1 ? 'event' : 'events'} a day
        </p>
      ) : null}
      <div style={{ opacity: pending ? 0.6 : 1 }} className="transition-opacity">
        <CalendarGrid
          value={picked}
          today={todayIso}
          startAt={`${initialMonth}-01`}
          states={states}
          onPick={(d) => setPicked(d)}
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
      <CalendarLegend dots={['booked', 'outside', 'asking']} blocked full />

      {/* The picked day: its long date and "Open the day ›", then what is on it (prototype datesBody). */}
      <div className="mt-4 flex min-h-11 items-center gap-3" data-dates-picked-head="">
        <span className="home-k2 min-w-0 flex-1 truncate" data-dates-picked={picked}>
          {dayLongWords(picked).replace(/, \d{4}$/, '')}
          {near === 'Today' ? ' · today' : ''}
        </span>
        <Link href={daySheetHref(picked)} scroll className="sn-press inline-flex min-h-11 flex-none items-center gap-1 text-[14px] font-semibold text-sn-accent" data-dates-open-day="">
          Open the day
          <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
      <div data-dates-rows="">
        {rows.map((r) => (
          <DatesRow
            key={r.key}
            data={r.kind}
            title={r.title}
            line={r.line || undefined}
            badge={r.hours ? { tone: 'quiet', word: r.hours } : r.badge}
            href={daySheetHref(picked)}
            lead={
              r.kind === 'blocked' || r.kind === 'held' ? (
                <i aria-hidden className="block h-4 w-5 shrink-0 rounded-sm" style={r.hours ? CALENDAR_PART_STYLE : { backgroundImage: CALENDAR_HATCH }} />
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
