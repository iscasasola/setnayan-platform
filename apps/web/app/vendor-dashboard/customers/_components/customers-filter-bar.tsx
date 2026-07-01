'use client';

import { useId, useState } from 'react';
import { Filter, Info, Flame } from 'lucide-react';

/**
 * Filter row for My Customers — All types / All services / All agents selects
 * plus a Heat map toggle + an info tooltip. Client component because the Heat
 * map toggle is a live view switch (it dims non-booked days so the vendor's
 * busiest stretches jump out) and the info tooltip is disclosure-on-tap.
 *
 * The three selects reflect the vendor's REAL option sets (their event types,
 * their service categories, their team agents). Cross-cutting server-side
 * filtering of the calendar + customer list by these dimensions isn't wired
 * yet — there's no per-booking type/service/agent index to filter on — so the
 * selects are presentational for now and default to "All …". They never show a
 * fabricated option: an empty option set collapses the select to just "All".
 * The Heat map toggle, by contrast, is fully live (it drives `data-heatmap` on
 * the calendar via a shared parent, below).
 */

export type FilterOption = { value: string; label: string };

export function CustomersFilterBar({
  types,
  services,
  agents,
  heatmap,
  onHeatmapChange,
}: {
  types: FilterOption[];
  services: FilterOption[];
  agents: FilterOption[];
  heatmap: boolean;
  onHeatmapChange: (next: boolean) => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const infoId = useId();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        aria-hidden
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
      >
        <Filter className="h-4 w-4" strokeWidth={1.75} />
      </span>

      <FilterSelect label="All types" options={types} />
      <FilterSelect label="All services" options={services} />
      <FilterSelect label="All agents" options={agents} />

      <button
        type="button"
        onClick={() => onHeatmapChange(!heatmap)}
        aria-pressed={heatmap}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
        style={
          heatmap
            ? {
                borderColor: 'var(--m-orange-2)',
                background: 'var(--m-orange-4)',
                color: 'var(--m-orange-2)',
              }
            : {
                borderColor: 'var(--m-line)',
                background: '#fff',
                color: 'var(--m-slate)',
              }
        }
      >
        <Flame className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Heat map
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
          aria-controls={infoId}
          aria-label="What the day colours mean"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
          style={{ borderColor: 'var(--m-line)', background: '#fff', color: 'var(--m-slate)' }}
        >
          <Info className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        {showInfo ? (
          <div
            id={infoId}
            role="note"
            className="absolute right-0 z-10 mt-2 w-72 rounded-xl border p-3 text-xs shadow-lg"
            style={{
              borderColor: 'var(--m-line)',
              background: '#fff',
              color: 'var(--m-slate)',
            }}
          >
            <p className="mb-2 font-medium" style={{ color: 'var(--m-ink)' }}>
              What the day colours mean
            </p>
            <ul className="space-y-1.5">
              <LegendRow tone="full" label="Full — every schedule at capacity" />
              <LegendRow tone="booked" label="Booked — a date you've taken work on" />
              <LegendRow tone="locked" label="Locked — a hold you placed" />
              <LegendRow tone="whitelist" label="Whitelist — approve any booking first" />
              <LegendRow tone="blocked" label="Blocked — closed (holiday / rest day)" />
              <LegendRow tone="waitlist" label="Waitlist — couples waiting on this date" />
            </ul>
            <p className="mt-2" style={{ color: 'var(--m-slate-2)' }}>
              Turn on Heat map to dim the quiet days so your busy stretches stand out.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({ label, options }: { label: string; options: FilterOption[] }) {
  return (
    <select
      defaultValue=""
      aria-label={label}
      className="h-9 rounded-lg border px-3 text-sm"
      style={{ borderColor: 'var(--m-line)', background: '#fff', color: 'var(--m-slate)' }}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const LEGEND_DOT: Record<string, string> = {
  full: 'var(--m-ink)',
  booked: 'var(--m-sage-deep)',
  locked: 'var(--m-orange-2)',
  whitelist: '#8B7BB8',
  blocked: 'var(--m-slate-3)',
  waitlist: '#B8862F',
};

function LegendRow({ tone, label }: { tone: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: LEGEND_DOT[tone] ?? 'var(--m-slate-3)' }}
      />
      <span>{label}</span>
    </li>
  );
}
