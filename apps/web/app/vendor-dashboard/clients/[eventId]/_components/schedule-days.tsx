'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { fetchCustomerCalendarMonth } from '@/app/vendor-dashboard/customers/actions';
import { SCHEDULE_DAY_EVENT, SCHEDULE_DAY_PARAM } from '@/lib/upcoming-schedule-door';
import {
  addDays,
  addMonths,
  dayHeading,
  monthGrid,
  monthHeading,
  otherClientDays,
  otherClientsOn,
  weekOf,
  type OtherBooking,
  type ScheduleDayItem,
} from '@/lib/schedule-days';
import { usePickedNav } from './picked-client-nav';


/** The "All clients" read: the Clients month's own action (one request per month asked), its bookings and schedules. */
export type AllClientsMonth = { bookings: OtherBooking[]; pools: { poolId: string; name: string }[] };

/**
 * 📅 THE DAYS STRIP ON A CLIENT'S SCHEDULE (owner 18 Nov 2026 "plan it and set to build"; drawing NL5NDoD6 v7). Sits on
 * top of the shipped blow-by-blow (`children`), which it never changes:
 *
 *   · a Week | Month switch and a "This client ▾ / All clients" dropdown (PickMenu);
 *   · dots on this client's days — the event day(s), Meeting-card days, payment due days (`lib/schedule-days.ts`);
 *   · tap a day → its panel: the event day says the blow-by-blow is below (and shows it); a meeting or payment day lists
 *     its rows — a payment row's door is "See payment ›", switched in place — and the blow-by-blow waits behind
 *     "Back to the event day";
 *   · "All clients" asks the Clients month once per month shown and adds the shop's other bookings in another colour,
 *     with "Clash: <hall>" when another client holds the same schedule that day. A refused read is SAID.
 *
 * The day picked on arrival: `?day=` (Calendar › a day › a client, a chat card's date), else the event's day, else today.
 * `lab` hands the All-clients month in (the dev lab has no database).
 */
export function ScheduleDays({
  eventId,
  eventName,
  eventDate,
  todayIso,
  items,
  lab,
  children,
}: {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  todayIso: string;
  items: ScheduleDayItem[];
  lab?: AllClientsMonth | null;
  children: ReactNode;
}) {
  const nav = usePickedNav();
  const home = (eventDate ?? '').slice(0, 10) || todayIso;
  const [picked, setPicked] = useState<string>(home);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [scope, setScope] = useState<'one' | 'all'>('one');
  const [month, setMonth] = useState<string>(home.slice(0, 7));
  const [weekAt, setWeekAt] = useState<string>(home);
  const [others, setOthers] = useState<Record<string, AllClientsMonth | null | 'loading'>>({});

  const pick = useCallback((day: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    setPicked(day);
    setWeekAt(day);
    setMonth(day.slice(0, 7));
  }, []);

  // `?day=` on arrival, and a chat card's date while the page is open (no request — the page is already here).
  useEffect(() => {
    try {
      const d = new URLSearchParams(window.location.search).get(SCHEDULE_DAY_PARAM);
      if (d) pick(d);
    } catch {
      /* keep the event's day */
    }
    const onDay = (e: Event) => pick(String((e as CustomEvent<string>).detail ?? ''));
    window.addEventListener(SCHEDULE_DAY_EVENT, onDay);
    return () => window.removeEventListener(SCHEDULE_DAY_EVENT, onDay);
  }, [pick]);

  // "All clients": the Clients month's one read, per month shown — asked only once the supplier chooses it.
  const shownMonths = useMemo(() => (view === 'month' ? [month] : [...new Set(weekOf(weekAt).map((d) => d.slice(0, 7)))]), [view, month, weekAt]);
  useEffect(() => {
    if (scope !== 'all') return;
    for (const m of shownMonths) {
      if (others[m] !== undefined) continue;
      if (lab !== undefined) {
        setOthers((o) => ({ ...o, [m]: lab }));
        continue;
      }
      setOthers((o) => ({ ...o, [m]: 'loading' }));
      fetchCustomerCalendarMonth(m, { whole: true }).then(
        // A read without its `whole` part is a refused read — said, never drawn as a free month.
        (r) =>
          setOthers((o) => ({
            ...o,
            [m]: r?.whole ? { bookings: r.whole.bookings, pools: r.whole.pools.map((p) => ({ poolId: p.poolId, name: p.calendarName?.trim() || p.label })) } : null,
          })),
        () => setOthers((o) => ({ ...o, [m]: null })),
      );
    }
  }, [scope, shownMonths, others, lab]);

  const byDay = useMemo(() => {
    const m = new Map<string, ScheduleDayItem[]>();
    for (const it of items) m.set(it.day, [...(m.get(it.day) ?? []), it]);
    return m;
  }, [items]);
  const all = scope === 'all' ? shownMonths.map((m) => others[m]) : [];
  const allLoading = all.some((x) => x === 'loading');
  const allRefused = all.some((x) => x === null);
  const otherBookings = all.flatMap((x) => (x && x !== 'loading' ? x.bookings : []));
  const poolNames = new Map(all.flatMap((x) => (x && x !== 'loading' ? x.pools.map((p) => [p.poolId, p.name] as const) : [])));
  const otherDays = scope === 'all' ? otherClientDays(otherBookings, eventId) : new Set<string>();

  const dayItems = byDay.get(picked) ?? [];
  const isEventDay = dayItems.some((i) => i.kind === 'event');
  const others0 = scope === 'all' ? otherClientsOn(picked, otherBookings, eventId, (id) => poolNames.get(id) ?? '') : [];
  // The blow-by-blow shows on the event day, or on a day with nothing of this client's own (nothing to stand in for it).
  const showBody = isEventDay || dayItems.length === 0;
  const eventDays = items.filter((i) => i.kind === 'event').map((i) => i.day);

  const cell = (day: string, dim: boolean) => {
    const its = byDay.get(day) ?? [];
    const on = day === picked;
    const kinds = new Set(its.map((i) => i.kind));
    return (
      <button
        key={day}
        type="button"
        onClick={() => pick(day)}
        aria-pressed={on}
        aria-label={`${dayHeading(day)}${its.length ? ` · ${its.map((i) => i.title).join(', ')}` : ''}`}
        className={`sn-press flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[15px] font-semibold tabular-nums ${
          on ? 'bg-sn-accent text-sn-on-accent' : dim ? 'text-ink/45' : 'text-ink'
        } ${day === todayIso && !on ? 'ring-1 ring-inset ring-ink/20' : ''}`}
        data-schedule-day={day}
      >
        {Number(day.slice(8, 10))}
        <span className="flex h-1.5 gap-0.5" aria-hidden>
          {kinds.has('event') || kinds.has('meeting') ? <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-sn-on-accent' : 'bg-sn-accent'}`} /> : null}
          {kinds.has('payment') ? <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-sn-on-accent' : 'bg-warn-700'}`} /> : null}
          {otherDays.has(day) ? <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-sn-on-accent/70' : 'bg-info-700'}`} data-schedule-other-dot="" /> : null}
        </span>
      </button>
    );
  };

  const heading = view === 'month' ? monthHeading(month) : monthHeading(weekAt.slice(0, 7));
  const step = (side: -1 | 1) => (view === 'month' ? setMonth((m) => addMonths(m, side)) : setWeekAt((d) => addDays(d, side * 7)));

  return (
    <div data-schedule-days="">
      <div className="rounded-2xl bg-frame px-1 pb-3 pt-1 shadow-sn-frame">
        <div className="flex min-h-11 flex-wrap items-center gap-2 px-2">
          <p className="min-w-0 flex-1 text-[16px] font-bold text-ink" data-schedule-days-heading="">
            {heading}
          </p>
          <PickMenu
            label="Whose days"
            value={scope}
            options={[
              { key: 'one', label: 'This client' },
              { key: 'all', label: 'All my clients' },
            ]}
            onPick={(k) => setScope(k === 'all' ? 'all' : 'one')}
            dataAttr="data-schedule-days-scope"
            className="!min-h-11"
          />
          <div className="inline-flex rounded-full bg-ink/[0.06] p-0.5" role="group" aria-label="Week or month">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`sn-press min-h-11 rounded-full px-3 text-[13px] font-semibold ${view === v ? 'bg-frame text-ink shadow-sm' : 'text-ink/70'}`}
                data-schedule-days-view={v}
              >
                {v === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label={view === 'month' ? 'Month before' : 'Week before'} className="sn-press grid h-11 w-8 flex-none place-items-center text-ink/70">
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </button>
          <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i} className="text-center text-[11px] font-semibold text-ink/55" aria-hidden>
                {d}
              </span>
            ))}
            {view === 'week'
              ? weekOf(weekAt).map((d) => cell(d, !byDay.has(d) && !otherDays.has(d)))
              : monthGrid(month).map((d, i) => (d ? cell(d, !byDay.has(d) && !otherDays.has(d)) : <span key={`x${i}`} aria-hidden />))}
          </div>
          <button type="button" onClick={() => step(1)} aria-label={view === 'month' ? 'Month after' : 'Week after'} className="sn-press grid h-11 w-8 flex-none place-items-center text-ink/70">
            <ChevronRight aria-hidden className="h-4 w-4" />
          </button>
        </div>
        {scope === 'all' && (allLoading || allRefused) ? (
          <p role="status" className={`px-3 pt-2 text-[13px] ${allRefused ? 'font-semibold text-danger-700' : 'text-ink/70'}`} data-schedule-days-all={allRefused ? 'unread' : 'loading'}>
            {allRefused ? 'Your other clients couldn’t load just now — only this client’s days are shown.' : 'Loading your other clients…'}
          </p>
        ) : null}
      </div>

      <section className="mt-3 rounded-2xl bg-frame px-4 py-3 shadow-sn-frame" aria-label={dayHeading(picked)} data-schedule-day-panel={picked}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold text-ink">
            {dayHeading(picked)}
            {isEventDay ? ' · Event day' : ''}
          </h3>
          {isEventDay ? <span className="text-xs text-ink/60">The blow-by-blow</span> : null}
        </div>
        {dayItems.length === 0 && others0.length === 0 ? (
          <p className="pt-1 text-sm text-ink/70" data-schedule-day-empty="">
            Nothing with {eventName} this day.{eventDays.length && !eventDays.includes(picked) ? ' Tap a day with a dot.' : ''}
          </p>
        ) : null}
        <ul>
          {dayItems
            .filter((i) => i.kind !== 'event')
            .map((i) => (
              <li key={i.key} className="flex items-start gap-3 border-t border-ink/10 py-2.5 first:border-t-0" data-schedule-day-item={i.kind}>
                <span className="w-16 flex-none pt-0.5 text-[13px] font-semibold text-ink/70">{i.time}</span>
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {i.title}
                  {i.sub ? <small className="block text-xs text-ink/60">{i.sub}</small> : null}
                  {i.chip ? <span className="mt-1 inline-block rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink/75">{i.chip}</span> : null}
                </span>
              </li>
            ))}
          {others0.map((o) => (
            <li key={o.key} className="flex items-start gap-3 border-t border-ink/10 py-2.5 first:border-t-0" data-schedule-day-other="">
              <span className="w-16 flex-none pt-0.5 text-[13px] font-semibold text-ink/70">Booked</span>
              <span className="min-w-0 flex-1 text-sm text-ink">
                {o.title}
                {o.sub ? <small className="block text-xs text-ink/60">{o.sub}</small> : null}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.clash ? 'bg-danger-100 text-danger-800' : 'bg-info-100 text-info-800'}`} data-schedule-day-clash={o.clash ? '' : undefined}>
                  {o.clash ?? 'Other client'}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {dayItems.some((i) => i.kind === 'payment') || (!showBody && eventDays.length > 0) ? (
          <div className="mt-2 flex gap-2">
            {!showBody && eventDays.length > 0 ? (
              <button type="button" onClick={() => pick(eventDays[0]!)} className="sn-press min-h-11 flex-1 rounded-full bg-ink/[0.06] px-3 text-sm font-semibold text-ink" data-schedule-day-back="">
                Back to the event day
              </button>
            ) : null}
            {dayItems.some((i) => i.kind === 'payment') && nav ? (
              <button type="button" onClick={() => nav.select('payments')} className="sn-press min-h-11 flex-1 rounded-full bg-sn-accent px-3 text-sm font-semibold text-sn-on-accent" data-schedule-day-payment="">
                See payment ›
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="mt-4" hidden={!showBody} data-schedule-days-body={showBody ? 'shown' : 'held'}>
        {children}
      </div>
    </div>
  );
}
