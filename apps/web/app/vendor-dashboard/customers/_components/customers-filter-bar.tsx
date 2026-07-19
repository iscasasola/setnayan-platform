'use client';

import { useId, useState } from 'react';
import { Filter, Info, Flame } from 'lucide-react';

/**
 * Filter row for My Customers — Type / Service / Agent selects plus a Heat map
 * toggle + an info tooltip. Client component: every control is a live view
 * switch over the calendar (rebuilt in-browser by the parent, no re-fetch).
 *
 * The three selects reflect the vendor's REAL option sets (their event types,
 * their service categories, their team agents) and never show a fabricated
 * option — an empty set collapses to just "All …". Wiring by dimension:
 *   • Service — filters the calendar to the schedule(s) that carry the chosen
 *     service category.
 *   • Type — filters which booked events count toward booked/full days.
 *   • Agent — a SUBSCRIPTION feature (Pro+, where agentAccounts > 0). Enabled
 *     for vendors whose tier includes agents; disabled with a hint below that
 *     (a downgrade below Pro switches it off). When on, it narrows the calendar
 *     to the service categories the chosen agent is assigned to.
 * The Heat map toggle tints each day by booking intensity so busy stretches
 * glow. The ⓘ popover is help-only — the day-colour key lives under the grid
 * (one legend, not two).
 */

export type FilterOption = { value: string; label: string };

export function CustomersFilterBar({
  types,
  services,
  agents,
  typeFilter,
  onTypeFilterChange,
  serviceFilter,
  onServiceFilterChange,
  agentFilter,
  onAgentFilterChange,
  agentDisabled = true,
  agentDisabledHint = 'Team agents come with Pro',
  heatmap,
  onHeatmapChange,
}: {
  types: FilterOption[];
  services: FilterOption[];
  agents: FilterOption[];
  typeFilter: string;
  onTypeFilterChange: (next: string) => void;
  serviceFilter: string;
  onServiceFilterChange: (next: string) => void;
  agentFilter: string;
  onAgentFilterChange: (next: string) => void;
  /** Agent filtering is a subscription feature (Pro+ — agentAccounts > 0).
   *  Disabled for tiers without agents; a downgrade below Pro switches it off. */
  agentDisabled?: boolean;
  agentDisabledHint?: string;
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

      <FilterSelect
        label="All types"
        options={types}
        value={typeFilter}
        onChange={onTypeFilterChange}
      />
      <FilterSelect
        label="All services"
        options={services}
        value={serviceFilter}
        onChange={onServiceFilterChange}
      />
      <FilterSelect
        label="All agents"
        options={agents}
        value={agentDisabled ? '' : agentFilter}
        onChange={agentDisabled ? undefined : onAgentFilterChange}
        disabled={agentDisabled}
        title={agentDisabled ? agentDisabledHint : undefined}
      />

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
                background: 'rgba(255,255,255,.72)',
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
          aria-label="How to read this calendar"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
          style={{ borderColor: 'var(--m-line)', background: 'rgba(255,255,255,.72)', color: 'var(--m-slate)' }}
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
              How to read this calendar
            </p>
            <p>
              Each day shows its status — the colour key is under the grid.
            </p>
            <p className="mt-2">
              <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                Locked
              </span>{' '}
              and{' '}
              <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                Whitelist
              </span>{' '}
              are holds you set: Locked blocks new bookings; Whitelist asks you to
              approve each one first.
            </p>
            <p className="mt-2" style={{ color: 'var(--m-slate-2)' }}>
              Turn on Heat map to tint each day by how booked it is — your busiest
              dates glow warmest.
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
  disabled = false,
  title,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange?: (next: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <select
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      disabled={disabled}
      aria-label={label}
      title={title}
      className="h-9 rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: value ? 'var(--m-orange-2)' : 'var(--m-line)',
        background: value ? 'var(--m-orange-4)' : '#fff',
        color: value ? 'var(--m-orange-2)' : 'var(--m-slate)',
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
