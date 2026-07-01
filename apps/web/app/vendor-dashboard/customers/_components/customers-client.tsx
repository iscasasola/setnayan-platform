'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import type {
  CustomerCalendarMonth,
  CustomerDayStateKind,
  CustomerStatus,
  MonthDemandHeat,
} from '@/lib/vendor-customers';
import { CustomersCalendar } from './customers-calendar';
import type { FilterOption } from './customers-filter-bar';

/**
 * Client island for My Customers — owns the three filters (state type / service
 * leaf category / agent) + the Heat map toggle, and applies them to BOTH the
 * month calendar AND the customers list below (owner correction: the filters
 * are now functional, not presentational).
 *
 * Filtering is client-side over the server-fetched, fully-indexed data:
 *   • Type   → keeps calendar days whose dominant state matches + customer rows
 *              whose status matches. The state taxonomy is the SAME on both
 *              sides ('booked'/'locked'/'whitelist'/'waitlist'), with 'full' /
 *              'blocked' living on the calendar only and 'in_conversation'
 *              ("Scheduled") on the list only.
 *   • Service→ keeps days/rows whose booking(s) carry the selected leaf service
 *              category (from event_vendors.service_id → vendor_services.category).
 *   • Agent  → keeps days/rows whose booked service is assigned to the selected
 *              team member (vendor_service_agents).
 *
 * The Heat map overlay (Demand Radar) is passed straight through to the
 * calendar; it re-keys to the selected type so the intensity reflects that
 * event type's demand.
 */

/** A customer row shaped for the client (mirrors CustomerRow + display note). */
export type CustomerRowVM = {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  place: string | null;
  status: CustomerStatus;
  threadId: string | null;
  serviceCategories: string[];
  agentMemberIds: string[];
  /** Pre-computed money note (text + tone) — resolved server-side. */
  note: { text: string; tone: string };
};

const STATUS_PILL: Record<
  CustomerStatus,
  { label: string; bg: string; fg: string; border: string }
> = {
  booked: {
    label: 'Booked',
    bg: 'rgba(79,107,74,0.12)',
    fg: 'var(--m-sage-deep)',
    border: 'rgba(79,107,74,0.28)',
  },
  locked: {
    label: 'Locked',
    bg: 'var(--m-orange-4)',
    fg: 'var(--m-orange-2)',
    border: 'var(--m-orange-3)',
  },
  whitelist: {
    label: 'Whitelist',
    bg: 'rgba(139,123,184,0.12)',
    fg: '#6D5C9C',
    border: 'rgba(139,123,184,0.30)',
  },
  waitlist: {
    label: 'Waitlist',
    bg: 'rgba(184,134,47,0.12)',
    fg: '#946A17',
    border: 'rgba(184,134,47,0.28)',
  },
  in_conversation: {
    label: 'Scheduled',
    bg: 'var(--m-paper-2)',
    fg: 'var(--m-slate)',
    border: 'var(--m-line)',
  },
};

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SN';
  if (words.length === 1) return (words[0]!.slice(0, 2) || 'SN').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date not set';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * The state-value a customer row filters by. The list uses the customer status
 * directly; the calendar day states share the same slugs for the overlapping
 * ones (booked/locked/whitelist/waitlist).
 */
type StateFilter = CustomerDayStateKind | CustomerStatus;

export function CustomersClient({
  calendar,
  rows,
  monthLabel,
  prevHref,
  nextHref,
  dayHrefBase,
  typeOptions,
  serviceOptions,
  agentOptions,
  demandHeat,
  summaryCards,
}: {
  calendar: CustomerCalendarMonth;
  rows: CustomerRowVM[];
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  dayHrefBase: string;
  typeOptions: FilterOption[];
  serviceOptions: FilterOption[];
  agentOptions: FilterOption[];
  demandHeat: MonthDemandHeat;
  /** The three server-rendered summary cards (payments / messages / services),
   *  slotted between the calendar and the list. They are month-level roll-ups,
   *  not per-filter, so they render unfiltered here. */
  summaryCards: React.ReactNode;
}) {
  const [typeFilter, setTypeFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [heatmap, setHeatmap] = useState(false);

  // Filtered calendar — a day passes when it matches every active filter.
  const filteredCalendar = useMemo<CustomerCalendarMonth>(() => {
    if (!typeFilter && !serviceFilter && !agentFilter) return calendar;
    return {
      ...calendar,
      days: calendar.days.map((d) => {
        const typeOk = !typeFilter || d.state === (typeFilter as StateFilter);
        const serviceOk =
          !serviceFilter || d.serviceCategories.includes(serviceFilter);
        const agentOk = !agentFilter || d.agentMemberIds.includes(agentFilter);
        if (typeOk && serviceOk && agentOk) return d;
        // A day that fails any active filter is emptied (chip + labels cleared),
        // keeping the month grid intact so the layout doesn't jump.
        return {
          ...d,
          state: null,
          consumed: 0,
          waitlistCount: 0,
          eventLabels: [],
          serviceCategories: [],
          agentMemberIds: [],
        };
      }),
    };
  }, [calendar, typeFilter, serviceFilter, agentFilter]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        const typeOk = !typeFilter || r.status === (typeFilter as StateFilter);
        const serviceOk =
          !serviceFilter || r.serviceCategories.includes(serviceFilter);
        const agentOk = !agentFilter || r.agentMemberIds.includes(agentFilter);
        return typeOk && serviceOk && agentOk;
      }),
    [rows, typeFilter, serviceFilter, agentFilter],
  );

  const filtersActive = Boolean(typeFilter || serviceFilter || agentFilter);

  return (
    <>
      {/* Sections 1 + 2 — filter row + month calendar (centrepiece). */}
      <CustomersCalendar
        data={filteredCalendar}
        monthLabel={monthLabel}
        prevHref={prevHref}
        nextHref={nextHref}
        dayHrefBase={dayHrefBase}
        types={typeOptions}
        services={serviceOptions}
        agents={agentOptions}
        typeValue={typeFilter}
        serviceValue={serviceFilter}
        agentValue={agentFilter}
        onTypeChange={setTypeFilter}
        onServiceChange={setServiceFilter}
        onAgentChange={setAgentFilter}
        heatmap={heatmap}
        onHeatmapChange={setHeatmap}
        demandHeat={demandHeat}
      />

      {/* Section 3 — three server-rendered summary cards (unfiltered). */}
      {summaryCards}

      {/* Section 4 — customers list (also filtered). */}
      <div
        className="rounded-xl border"
        style={{ borderColor: 'var(--m-line)', background: '#fff' }}
      >
        <div
          className="flex items-center justify-between gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            Customers
          </h2>
          <Link
            href="/vendor-dashboard/clients"
            className="inline-flex items-center gap-1 text-sm font-medium"
            style={{ color: 'var(--m-orange-2)' }}
          >
            <CalendarDays className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Book of business
          </Link>
        </div>
        {filteredRows.length === 0 ? (
          <p className="px-4 py-8 text-sm" style={{ color: 'var(--m-slate-2)' }}>
            {rows.length === 0 ? (
              <>
                No customers yet. When a couple books you, or you accept an
                inquiry, they show up here with their event, date, and where
                they&rsquo;re at with payments.
              </>
            ) : (
              <>No customers match these filters. Clear a filter to see more.</>
            )}
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
            {filteredRows.map((r) => {
              const pill = STATUS_PILL[r.status];
              const inner = (
                <>
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
                  >
                    {initialsOf(r.eventName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className="truncate text-sm font-medium"
                        style={{ color: 'var(--m-ink)' }}
                      >
                        {r.eventName}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: pill.bg,
                          color: pill.fg,
                          border: `1px solid ${pill.border}`,
                        }}
                      >
                        {pill.label}
                      </span>
                    </span>
                    <span
                      className="mt-0.5 block truncate text-xs"
                      style={{ color: 'var(--m-slate-2)' }}
                    >
                      {fmtDate(r.eventDate)}
                      {r.place ? ` · ${r.place}` : ''}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-right text-xs"
                    style={{ color: r.note.tone }}
                  >
                    {r.note.text}
                  </span>
                </>
              );
              return (
                <li key={`${r.status}:${r.eventId}`}>
                  {r.threadId ? (
                    <Link
                      href={`/vendor-dashboard/messages/${r.threadId}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--m-paper-2)]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {filtersActive && filteredRows.length > 0 ? (
          <p
            className="border-t px-4 py-2 text-[11px]"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate-3)' }}
          >
            Showing {filteredRows.length} of {rows.length} customer
            {rows.length === 1 ? '' : 's'} · filters applied
          </p>
        ) : null}
      </div>
    </>
  );
}
