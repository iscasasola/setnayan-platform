'use client';

import { useState, useTransition, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import type { SchedulePool, VendorCalendarDayState } from '@/lib/vendor-schedule';
import type { WaitlistDateGroup } from '@/lib/vendor-waitlist';
import {
  buildCustomerCalendarMonth,
  type CalendarBookingInput,
  type CalendarBlockInput,
  type CustomerCalendarMonth,
  type CustomerDayStateKind,
} from '@/lib/vendor-customers';
import { CustomersFilterBar, type FilterOption } from './customers-filter-bar';
import { fetchCustomerCalendarMonth } from '../actions';

/**
 * The centrepiece month calendar. Each day cell shows the date + a small status
 * chip drawn from the 6-state day taxonomy (Full · Booked · Locked · Whitelist
 * · Blocked · Waitlist) plus up to two event labels for that day. Colours map to
 * the editorial palette.
 *
 * Month nav is CLIENT-DRIVEN. The month-independent inputs (pools / bookings /
 * blocks) are shipped once on first paint; paging to another month fetches only
 * the two datasets that actually change — the vendor's day states + the couple
 * waitlist for that month (see `fetchCustomerCalendarMonth`). Those RAW inputs
 * are cached per month (filter-agnostic); the visible grid is derived from them
 * with the pure `buildCustomerCalendarMonth`. So an arrow click is one
 * lightweight query (or instant on a revisit), not a full-page reload.
 *
 * Filtering is a pure re-derive — no re-fetch:
 *   • Service — narrows the schedule pool(s) fed to the builder to those that
 *     carry the chosen service category.
 *   • Type — narrows which booked events count toward booked/full days.
 *   • (Agent is disabled in the filter bar — per-agent scheduling isn't tracked
 *     in the booking schema yet.)
 * Vendor-level marks (blocked / locked / whitelist / waitlist) aren't event- or
 * service-scoped, so they stay visible under any filter. The Heat map toggle
 * dims non-booked days so busy stretches pop.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CHIP: Record<
  CustomerDayStateKind,
  { label: string; bg: string; fg: string; border: string }
> = {
  full: { label: 'Full', bg: 'var(--m-ink)', fg: '#fff', border: 'var(--m-ink)' },
  booked: {
    label: 'Booked',
    bg: 'rgba(79,107,74,0.14)',
    fg: 'var(--m-sage-deep)',
    border: 'rgba(79,107,74,0.30)',
  },
  locked: {
    label: 'Locked',
    bg: 'var(--m-orange-4)',
    fg: 'var(--m-orange-2)',
    border: 'var(--m-orange-3)',
  },
  whitelist: {
    label: 'Whitelist',
    bg: 'rgba(139,123,184,0.14)',
    fg: '#6D5C9C',
    border: 'rgba(139,123,184,0.32)',
  },
  blocked: {
    label: 'Blocked',
    bg: 'var(--m-paper-2)',
    fg: 'var(--m-slate-2)',
    border: 'var(--m-line)',
  },
  waitlist: {
    label: 'Waitlist',
    bg: 'rgba(184,134,47,0.14)',
    fg: '#946A17',
    border: 'rgba(184,134,47,0.30)',
  },
};

/** Raw, filter-agnostic month inputs cached per month for instant re-derive. */
type MonthInputs = { dayStates: VendorCalendarDayState[]; waitlist: WaitlistDateGroup[] };

/** Shift a 'YYYY-MM' key by whole months. Pure — safe on the client. */
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → "July 2026". */
function monthLabelOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });
}

export function CustomersCalendar({
  initialDayStates,
  initialWaitlist,
  initialMonth,
  todayIso,
  pools,
  bookings,
  blocks,
  dayHrefBase,
  types,
  services,
  agents,
  agentsEnabled,
  agentCategories,
}: {
  /** The first-painted month's raw day states + waitlist (server-fetched). */
  initialDayStates: VendorCalendarDayState[];
  initialWaitlist: WaitlistDateGroup[];
  /** 'YYYY-MM' key of the first-painted month. */
  initialMonth: string;
  /** PH civil "today" (YYYY-MM-DD) — passed to the client-side rebuild. */
  todayIso: string;
  /** Month-independent inputs the client keeps to rebuild any month locally.
   *  Bookings/blocks are trimmed to the fields the builder reads (no raw
   *  client-contact fields cross the wire); bookings also carry `eventType`
   *  for the type filter. */
  pools: SchedulePool[];
  bookings: CalendarBookingInput[];
  blocks: CalendarBlockInput[];
  /** Base path a day cell links to (e.g. the calendar day-manage route). */
  dayHrefBase: string;
  types: FilterOption[];
  services: FilterOption[];
  agents: FilterOption[];
  /** Whether the vendor's subscription tier includes agents (Pro+; agentAccounts
   *  > 0). When false the Agent filter is disabled — it's a tier feature, so a
   *  vendor who drops below Pro loses it. */
  agentsEnabled: boolean;
  /** vendor_team_member_id → the service categories that agent is assigned to.
   *  Filtering by an agent narrows the calendar to those categories' schedules. */
  agentCategories: Record<string, string[]>;
}) {
  const [heatmap, setHeatmap] = useState(false);
  const [month, setMonth] = useState(initialMonth);
  const [serviceFilter, setServiceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [pending, startTransition] = useTransition();

  // Per-mount cache of RAW month inputs (day states + waitlist), filter-agnostic
  // so switching a filter is a pure re-derive with no re-fetch. Seeded with the
  // server's first-paint month. Lifetime is this mount: any action that mutates
  // bookings navigates away (to the day-manage route) and remounts with a fresh
  // cache, so intra-session staleness is a non-issue.
  const [monthInputs, setMonthInputs] = useState<Map<string, MonthInputs>>(
    () => new Map([[initialMonth, { dayStates: initialDayStates, waitlist: initialWaitlist }]]),
  );

  // Filter narrowing (pure). Service → the pools that carry the category; Agent
  // → the pools whose category the agent is assigned to (agents "see only their
  // own work"); Type → the bookings of that event type. Pools narrow for Service
  // + Agent; bookings narrow for Type. All feed the day builder.
  const filteredPools = useMemo(() => {
    let ps = pools;
    if (serviceFilter) ps = ps.filter((p) => p.categories.includes(serviceFilter));
    if (agentFilter) {
      const cats = agentCategories[agentFilter] ?? [];
      ps = ps.filter((p) => p.categories.some((c) => cats.includes(c)));
    }
    return ps;
  }, [pools, serviceFilter, agentFilter, agentCategories]);
  const filteredBookings = useMemo(
    () => (typeFilter ? bookings.filter((b) => (b.eventType ?? '') === typeFilter) : bookings),
    [bookings, typeFilter],
  );

  // The visible grid — derived from the current month's raw inputs + active
  // filters. Current-month inputs are always present (seeded + stored on nav).
  const data = useMemo<CustomerCalendarMonth>(() => {
    const inputs = monthInputs.get(month);
    return buildCustomerCalendarMonth(
      filteredPools,
      filteredBookings,
      blocks,
      inputs?.dayStates ?? [],
      inputs?.waitlist ?? [],
      month,
      todayIso,
    );
  }, [month, monthInputs, filteredPools, filteredBookings, blocks, todayIso]);

  const goToMonth = useCallback(
    (delta: number) => {
      const nextMonth = shiftMonth(month, delta);
      const syncUrl = () =>
        window.history.replaceState(null, '', `${window.location.pathname}?m=${nextMonth}`);
      if (monthInputs.has(nextMonth)) {
        setMonth(nextMonth); // instant — inputs cached, grid re-derives
        syncUrl();
        return;
      }
      startTransition(async () => {
        const res = await fetchCustomerCalendarMonth(nextMonth);
        if (!res) {
          // Session gone / not a vendor — fall back to a full server navigation
          // so the user still lands on the month rather than getting stuck.
          window.location.href = `${window.location.pathname}?m=${nextMonth}`;
          return;
        }
        setMonthInputs((prev) => {
          const next = new Map(prev);
          next.set(nextMonth, { dayStates: res.dayStates, waitlist: res.waitlist });
          return next;
        });
        setMonth(nextMonth);
        syncUrl();
      });
    },
    [month, monthInputs],
  );

  const filtersActive = serviceFilter !== '' || typeFilter !== '' || agentFilter !== '';
  const hasAnyChip = data.days.some((d) => d.state !== null);
  const serviceLabel = services.find((o) => o.value === serviceFilter)?.label;
  const typeLabel = types.find((o) => o.value === typeFilter)?.label;
  const agentLabel = agents.find((o) => o.value === agentFilter)?.label;

  return (
    <div className="space-y-4">
      <CustomersFilterBar
        types={types}
        services={services}
        agents={agents}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        serviceFilter={serviceFilter}
        onServiceFilterChange={setServiceFilter}
        agentFilter={agentFilter}
        onAgentFilterChange={setAgentFilter}
        agentDisabled={!agentsEnabled}
        agentDisabledHint="Team agents come with Pro — filter by them once you add agents"
        heatmap={heatmap}
        onHeatmapChange={setHeatmap}
      />

      <div
        className="rounded-xl border p-4 sm:p-5"
        style={{ borderColor: 'var(--m-line)', background: '#fff' }}
        aria-busy={pending}
      >
        {/* Month nav */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            disabled={pending}
            aria-label="Previous month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-opacity disabled:opacity-50"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={1.75} aria-hidden />
          </button>
          <h2
            className="flex items-center gap-2 text-base font-semibold"
            style={{ color: 'var(--m-ink)' }}
          >
            {monthLabelOf(month)}
            {pending ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                strokeWidth={2}
                style={{ color: 'var(--m-slate-3)' }}
                aria-hidden
              />
            ) : null}
          </h2>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            disabled={pending}
            aria-label="Next month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-opacity disabled:opacity-50"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {/* Active-filter context line — makes a narrowed (possibly empty) grid
            self-explanatory. */}
        {filtersActive ? (
          <p className="mb-3 text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
            Showing{typeLabel ? ` ${typeLabel}` : ''}
            {serviceLabel ? ` · ${serviceLabel}` : ''}
            {agentLabel ? ` · ${agentLabel}` : ''}
            {!hasAnyChip ? ' — no matching activity this month.' : ''}
          </p>
        ) : null}

        {/* Weekday header */}
        <div
          className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium"
          style={{ color: 'var(--m-slate-3)' }}
        >
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid — dimmed while a month swap is in flight. */}
        <div
          className="grid grid-cols-7 gap-1 transition-opacity"
          style={{ opacity: pending ? 0.55 : 1 }}
        >
          {Array.from({ length: data.firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {data.days.map((day) => {
            const chip = day.state ? CHIP[day.state] : null;
            // Heat map: dim any day that isn't an active-work day (booked/full),
            // so the calendar reads as an intensity map of committed work.
            const heatDim =
              heatmap && day.state !== 'booked' && day.state !== 'full';
            const muted = day.past || heatDim;
            return (
              <Link
                key={day.date}
                href={`${dayHrefBase}/${day.date}`}
                className="flex min-h-[64px] flex-col rounded-lg border p-1.5 text-left transition-colors sm:min-h-[76px]"
                style={{
                  borderColor: day.isToday ? 'var(--m-orange-2)' : 'var(--m-line)',
                  background: day.isToday ? 'var(--m-orange-4)' : '#fff',
                  opacity: muted ? 0.45 : 1,
                }}
              >
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: day.isToday ? 'var(--m-orange-2)' : 'var(--m-ink)' }}
                >
                  {day.day}
                </span>
                {chip ? (
                  <span
                    className="mt-1 inline-flex items-center gap-1 self-start rounded px-1 py-px text-[10px] font-semibold leading-tight"
                    style={{
                      background: chip.bg,
                      color: chip.fg,
                      border: `1px solid ${chip.border}`,
                    }}
                    title={
                      day.state === 'booked' || day.state === 'full'
                        ? `${day.consumed}/${day.capacity} booked`
                        : day.state === 'waitlist'
                          ? `${day.waitlistCount} waiting`
                          : chip.label
                    }
                  >
                    {day.state === 'full' && day.capacity > 0
                      ? `Full ${day.consumed}/${day.capacity}`
                      : day.state === 'booked' && day.capacity > 0
                        ? `${day.consumed}/${day.capacity}`
                        : day.state === 'waitlist'
                          ? `Waitlist ${day.waitlistCount}`
                          : chip.label}
                  </span>
                ) : null}
                {day.eventLabels.slice(0, 2).map((label) => (
                  <span
                    key={label}
                    className="mt-0.5 block truncate text-[10px] leading-tight"
                    style={{ color: 'var(--m-slate-2)' }}
                    title={label}
                  >
                    {label}
                  </span>
                ))}
                {day.eventLabels.length > 2 ? (
                  <span
                    className="mt-0.5 block text-[10px] leading-tight"
                    style={{ color: 'var(--m-slate-3)' }}
                  >
                    +{day.eventLabels.length - 2} more
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* Compact legend */}
        <div
          className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]"
          style={{ color: 'var(--m-slate-2)' }}
        >
          {(
            [
              'full',
              'booked',
              'locked',
              'whitelist',
              'blocked',
              'waitlist',
            ] as CustomerDayStateKind[]
          ).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: CHIP[k].bg, border: `1px solid ${CHIP[k].border}` }}
              />
              {CHIP[k].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
