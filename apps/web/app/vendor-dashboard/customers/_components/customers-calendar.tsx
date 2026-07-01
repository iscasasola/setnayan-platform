'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type {
  CustomerCalendarMonth,
  CustomerDayStateKind,
  MonthDemandHeat,
} from '@/lib/vendor-customers';
import { CustomersFilterBar, type FilterOption } from './customers-filter-bar';

/**
 * The centrepiece month calendar. Each day cell shows the date + a small status
 * chip drawn from the 6-state day taxonomy (Full · Booked · Locked · Whitelist
 * · Blocked · Waitlist) plus up to two event labels for that day. Colours map to
 * the editorial palette. Month nav is server-driven (?m= links) so the data for
 * the visible month is fetched fresh.
 *
 * This is a CONTROLLED component: the filter selects + Heat map toggle are owned
 * by the parent island (customers-client) so the same state filters both this
 * calendar AND the customers list. When Heat map is ON it overlays a Demand
 * Radar intensity gradient (keyed to the selected event type) instead of the
 * state chips; OFF, the state chips show.
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

/**
 * The single month-level demand intensity (0..1) for the calendar, keyed to the
 * selected event type. The Demand Radar rolls up by month (no per-date grain),
 * so every date in the visible month shares this intensity; it changes as the
 * vendor navigates months (via the ?m= re-fetch) and as they pick a type.
 * Returns null when there's no demand data to overlay (honest empty state).
 */
function monthIntensity(
  heat: MonthDemandHeat,
  selectedType: string,
): number | null {
  if (heat.scaleMax <= 0) return null;
  const signal = selectedType
    ? heat.byEventType[selectedType] ?? 0
    : heat.total;
  if (signal <= 0) return 0;
  return Math.min(1, signal / heat.scaleMax);
}

/** Terracotta-toned heat fill for an intensity in [0,1]. */
function heatFill(intensity: number): string {
  // 0 → barely-there wash, 1 → strong gold. Alpha ramps with intensity.
  const alpha = 0.06 + intensity * 0.34;
  return `color-mix(in srgb, var(--m-orange) ${Math.round(alpha * 100)}%, #fff)`;
}

/** The five-stop legend swatches for the heat scale. */
const HEAT_STOPS = [0.1, 0.3, 0.55, 0.8, 1];

export function CustomersCalendar({
  data,
  monthLabel,
  prevHref,
  nextHref,
  dayHrefBase,
  types,
  services,
  agents,
  typeValue,
  serviceValue,
  agentValue,
  onTypeChange,
  onServiceChange,
  onAgentChange,
  heatmap,
  onHeatmapChange,
  demandHeat,
}: {
  data: CustomerCalendarMonth;
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  /** Base path a day cell links to (e.g. the calendar day-manage route). */
  dayHrefBase: string;
  types: FilterOption[];
  services: FilterOption[];
  agents: FilterOption[];
  typeValue: string;
  serviceValue: string;
  agentValue: string;
  onTypeChange: (v: string) => void;
  onServiceChange: (v: string) => void;
  onAgentChange: (v: string) => void;
  heatmap: boolean;
  onHeatmapChange: (next: boolean) => void;
  demandHeat: MonthDemandHeat;
}) {
  const intensity = heatmap ? monthIntensity(demandHeat, typeValue) : null;
  const selectedTypeLabel =
    types.find((t) => t.value === typeValue)?.label ?? 'all event types';

  return (
    <div className="space-y-4">
      <CustomersFilterBar
        types={types}
        services={services}
        agents={agents}
        typeValue={typeValue}
        serviceValue={serviceValue}
        agentValue={agentValue}
        onTypeChange={onTypeChange}
        onServiceChange={onServiceChange}
        onAgentChange={onAgentChange}
        heatmap={heatmap}
        onHeatmapChange={onHeatmapChange}
      />

      <div
        className="rounded-xl border p-4 sm:p-5"
        style={{ borderColor: 'var(--m-line)', background: '#fff' }}
      >
        {/* Month nav */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={prevHref}
            aria-label="Previous month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={1.75} aria-hidden />
          </Link>
          <h2 className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            {monthLabel}
          </h2>
          <Link
            href={nextHref}
            aria-label="Next month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
        </div>

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

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: data.firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {data.days.map((day) => {
            const chip = day.state ? CHIP[day.state] : null;
            // Heat map ON → wash the cell by demand intensity, hide the state
            // chip. Only future/today cells carry the wash (past demand isn't
            // actionable). OFF → normal state-chip rendering.
            const heatOn = heatmap && intensity !== null && !day.past;
            const cellBg = day.isToday
              ? 'var(--m-orange-4)'
              : heatOn
                ? heatFill(intensity)
                : '#fff';
            const muted = day.past && !heatOn;
            return (
              <Link
                key={day.date}
                href={`${dayHrefBase}/${day.date}`}
                className="flex min-h-[64px] flex-col rounded-lg border p-1.5 text-left transition-colors sm:min-h-[76px]"
                style={{
                  borderColor: day.isToday ? 'var(--m-orange-2)' : 'var(--m-line)',
                  background: cellBg,
                  opacity: muted ? 0.45 : 1,
                }}
              >
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: day.isToday ? 'var(--m-orange-2)' : 'var(--m-ink)' }}
                >
                  {day.day}
                </span>
                {!heatOn && chip ? (
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
                {!heatOn &&
                  day.eventLabels.slice(0, 2).map((label) => (
                    <span
                      key={label}
                      className="mt-0.5 block truncate text-[10px] leading-tight"
                      style={{ color: 'var(--m-slate-2)' }}
                      title={label}
                    >
                      {label}
                    </span>
                  ))}
                {!heatOn && day.eventLabels.length > 2 ? (
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

        {/* Legend — state chips OFF-heat; demand intensity scale ON-heat. */}
        {heatmap ? (
          <div className="mt-4 space-y-1.5">
            {intensity === null ? (
              <p className="text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
                No demand data to map yet for {selectedTypeLabel} — the Demand
                Radar fills in as more couples plan near you.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
                  <span>Demand for {selectedTypeLabel}</span>
                  <span aria-hidden>·</span>
                  <span>Lower</span>
                  <span className="inline-flex overflow-hidden rounded-full" aria-hidden>
                    {HEAT_STOPS.map((s) => (
                      <span
                        key={s}
                        className="inline-block h-2.5 w-5"
                        style={{ background: heatFill(s) }}
                      />
                    ))}
                  </span>
                  <span>Higher</span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
                  Month-level demand from the Demand Radar (de-identified). Every
                  date this month shares the shade; navigate months to compare.
                </p>
              </>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
