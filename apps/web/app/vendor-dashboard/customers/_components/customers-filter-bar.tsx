'use client';

import { useId, useState } from 'react';
import { Filter, Info, Flame, X } from 'lucide-react';

/**
 * Filter row for My Customers — All types / All services / All agents selects
 * plus a Heat map toggle + an info tooltip. Client component: the three selects
 * are CONTROLLED by the parent island so the same values filter both the month
 * calendar AND the customers list below.
 *
 *   • All types    — the booking/day STATE (Full · Booked · Locked · Whitelist ·
 *                    Blocked · Waitlist · Scheduled), NOT the event type.
 *   • All services — the vendor's leaf service CATEGORIES (distinct taxonomy
 *                    leaves of their vendor_services).
 *   • All agents   — team-member NAMES (resolved from vendor_team + users).
 *
 * Each option set reflects the vendor's REAL data — an empty set collapses the
 * select to just "All …" and never fabricates an option. The Heat map toggle
 * overlays the Demand Radar intensity on the calendar.
 */

export type FilterOption = { value: string; label: string };

export function CustomersFilterBar({
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
}: {
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
}) {
  const [showInfo, setShowInfo] = useState(false);
  const infoId = useId();
  const anyActive = Boolean(typeValue || serviceValue || agentValue);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        aria-hidden
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
      >
        <Filter className="h-4 w-4" strokeWidth={1.75} />
      </span>

      <FilterSelect label="All types" options={types} value={typeValue} onChange={onTypeChange} />
      <FilterSelect
        label="All services"
        options={services}
        value={serviceValue}
        onChange={onServiceChange}
      />
      <FilterSelect label="All agents" options={agents} value={agentValue} onChange={onAgentChange} />

      {anyActive ? (
        <button
          type="button"
          onClick={() => {
            onTypeChange('');
            onServiceChange('');
            onAgentChange('');
          }}
          className="inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-sm font-medium transition-colors"
          style={{ borderColor: 'var(--m-line)', background: '#fff', color: 'var(--m-slate)' }}
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Clear
        </button>
      ) : null}

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
              Filters narrow the calendar and the list below. Turn on Heat map to
              overlay demand for your area instead.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const active = value !== '';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-9 rounded-lg border px-3 text-sm"
      style={{
        borderColor: active ? 'var(--m-orange-2)' : 'var(--m-line)',
        background: active ? 'var(--m-orange-4)' : '#fff',
        color: active ? 'var(--m-orange-2)' : 'var(--m-slate)',
        fontWeight: active ? 600 : 400,
      }}
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
